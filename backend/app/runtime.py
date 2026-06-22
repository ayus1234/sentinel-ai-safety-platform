from __future__ import annotations

import asyncio
import io
import math
import random
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import WebSocket
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from .agents import AGENTS, SAFETY_GRAPH, OptionalGeminiReasoner, calculate_risk
from .models import (
    AgentRun,
    Detection,
    EventEnvelope,
    Incident,
    QueryResponse,
    RiskAssessment,
    SimulationResult,
    TelemetryEvent,
    utc_now,
)
from .store import SQLiteSafetyStore


class PlantRuntime:
    def __init__(self, store: SQLiteSafetyStore) -> None:
        self.store = store
        self.reasoner = OptionalGeminiReasoner()
        self.clients: set[WebSocket] = set()
        self.scenario_task: asyncio.Task | None = None
        self.telemetry_task: asyncio.Task | None = None
        self.running = False
        self.step = 0
        self.flags = self._empty_flags()
        self.risk = calculate_risk(self.flags)
        self.current_incident: Incident | None = None
        self.agent_runs = self._idle_agents()
        self.telemetry_history: list[dict[str, Any]] = []

    @staticmethod
    def _empty_flags() -> dict[str, Any]:
        return {
            "gas_high": False,
            "permit_active": False,
            "worker_present": False,
            "ppe_missing": False,
        }

    @staticmethod
    def _idle_agents() -> list[dict[str, Any]]:
        return [
            AgentRun(
                agent_id=agent_id,
                name=name,
                layer=layer,  # type: ignore[arg-type]
                status="idle",
                message="Monitoring",
            ).model_dump()
            for agent_id, name, layer in AGENTS
        ]

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.clients.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self.clients.discard(websocket)

    async def publish(self, event_type: str, payload: dict[str, Any]) -> None:
        envelope = EventEnvelope(type=event_type, payload=payload)
        self.store.audit(event_type, payload)
        dead: list[WebSocket] = []
        for client in list(self.clients):
            try:
                await client.send_json(envelope.model_dump())
            except Exception:
                dead.append(client)
        for client in dead:
            self.disconnect(client)

    def bootstrap(self) -> dict[str, Any]:
        incidents = self.store.list_incidents()
        return {
            "plant": {
                "id": "PLANT-01",
                "name": "Sentinel Hydrogen Works",
                "location": "Vadodara, India",
                "status": "critical" if self.risk.score >= 90 else "operational",
                "workers_on_site": 148,
            },
            "zones": [
                {"id": "ZONE-1", "name": "Utilities", "risk": 12, "x": 6, "y": 12, "w": 26, "h": 30},
                {"id": "ZONE-2", "name": "Compressor Bay", "risk": 31, "x": 36, "y": 8, "w": 28, "h": 34},
                {"id": "ZONE-3", "name": "Hydrogen Processing", "risk": self.risk.score, "x": 68, "y": 12, "w": 27, "h": 42},
                {"id": "ZONE-4", "name": "Storage", "risk": 22, "x": 8, "y": 58, "w": 38, "h": 32},
                {"id": "ZONE-5", "name": "Loading", "risk": 18, "x": 51, "y": 62, "w": 44, "h": 27},
            ],
            "equipment": [
                {"id": "BOILER-4", "name": "Boiler 4", "zone_id": "ZONE-3", "x": 78, "y": 29, "status": "warning" if self.step >= 1 else "normal"},
                {"id": "PUMP-7", "name": "Pump 7", "zone_id": "ZONE-3", "x": 72, "y": 44, "status": "normal"},
                {"id": "COMP-2", "name": "Compressor 2", "zone_id": "ZONE-2", "x": 49, "y": 29, "status": "normal"},
                {"id": "TANK-12", "name": "Tank 12", "zone_id": "ZONE-4", "x": 27, "y": 73, "status": "normal"},
            ],
            "risk": self.risk.model_dump(),
            "incidents": [item.model_dump() for item in incidents],
            "agents": self.agent_runs,
            "scenario": {"running": self.running, "step": self.step},
            "telemetry": self.telemetry_history[-30:],
            "provider": {"reasoning": "gemini" if self.reasoner.enabled else "deterministic", "vision": "demo"},
        }

    async def start_background(self) -> None:
        if self.telemetry_task is None or self.telemetry_task.done():
            self.telemetry_task = asyncio.create_task(self._telemetry_loop())

    async def stop_background(self) -> None:
        for task in (self.scenario_task, self.telemetry_task):
            if task and not task.done():
                task.cancel()
        await asyncio.gather(
            *[task for task in (self.scenario_task, self.telemetry_task) if task],
            return_exceptions=True,
        )

    async def start_demo(self) -> dict[str, Any]:
        if self.running:
            return {"status": "already_running", "step": self.step}
        await self.reset_demo(clear_incidents=True)
        self.running = True
        self.scenario_task = asyncio.create_task(self._run_demo())
        await self.publish("scenario", {"running": True, "step": 0})
        return {"status": "started", "step": 0}

    async def reset_demo(self, clear_incidents: bool = True) -> dict[str, Any]:
        if self.scenario_task and not self.scenario_task.done() and self.scenario_task is not asyncio.current_task():
            self.scenario_task.cancel()
            await asyncio.gather(self.scenario_task, return_exceptions=True)
        self.running = False
        self.step = 0
        self.flags = self._empty_flags()
        self.risk = calculate_risk(self.flags)
        self.current_incident = None
        self.agent_runs = self._idle_agents()
        if clear_incidents:
            self.store.clear_demo_incidents()
        await self.publish("reset", self.bootstrap())
        return {"status": "reset", "risk": self.risk.model_dump()}

    async def _run_demo(self) -> None:
        stages = [
            (1, "gas_high", "Sensor Intelligence", "Hydrogen increased 28% above baseline"),
            (2, "permit_active", "Permit Intelligence", "Hot-work permit HW-204 overlaps the anomaly"),
            (3, "worker_present", "Computer Vision", "Worker entered restricted Zone 3"),
            (4, "ppe_missing", "Computer Vision", "Helmet and high-visibility vest not detected"),
        ]
        try:
            for step, flag, source, message in stages:
                await asyncio.sleep(1.7)
                self.step = step
                self.flags[flag] = True
                self.risk = calculate_risk(self.flags)
                graph_state = SAFETY_GRAPH.invoke({**self.flags, "agent_runs": []})
                self.agent_runs = graph_state["agent_runs"]
                await self.publish(
                    "evidence",
                    {"step": step, "source": source, "message": message, "risk": self.risk.model_dump(), "agents": self.agent_runs},
                )
            await self._create_incident()
            await asyncio.sleep(1.1)
            await self.publish(
                "emergency_actions",
                {
                    "incident_id": self.current_incident.id if self.current_incident else None,
                    "actions": self.current_incident.actions if self.current_incident else [],
                    "route": ["ZONE-3", "CORRIDOR-E", "MUSTER-A"],
                },
            )
        except asyncio.CancelledError:
            raise
        finally:
            self.running = False
            await self.publish("scenario", {"running": False, "step": self.step})

    async def _create_incident(self) -> None:
        if self.current_incident:
            return
        incident = Incident(
            id=f"INC-DEMO-{datetime.now(timezone.utc).strftime('%H%M%S')}",
            title="Correlated explosion risk in Zone 3",
            zone_id="ZONE-3",
            risk_score=97,
            evidence=self.risk.factors,
            actions=[
                "Simulated worker alert dispatched",
                "Hot-work permit HW-204 suspended",
                "Evacuation Route E-3 activated",
                "Emergency contacts queued",
                "Incident report prepared",
            ],
        )
        self.current_incident = incident
        self.store.save_incident(incident)
        await self.publish("incident", incident.model_dump())

    async def _telemetry_loop(self) -> None:
        tick = 0
        while True:
            tick += 1
            h2 = 0.42 + random.uniform(-0.03, 0.03)
            if self.flags.get("gas_high"):
                h2 = min(3.8, 1.1 + self.step * 0.61 + math.sin(tick / 2) * 0.08)
            event = TelemetryEvent(
                sensor_id="SENSOR-H2-03",
                equipment_id="BOILER-4",
                zone_id="ZONE-3",
                metric="hydrogen",
                value=round(h2, 2),
                unit="% LEL",
                status="critical" if h2 >= 3 else "warning" if h2 >= 1 else "normal",
            )
            temperature = 72 + self.step * 4 + random.uniform(-1.5, 1.5)
            point = {"timestamp": event.timestamp, "hydrogen": event.value, "temperature": round(temperature, 1), "pressure": round(5.2 + self.step * 0.22, 2)}
            self.telemetry_history.append(point)
            self.telemetry_history = self.telemetry_history[-60:]
            await self.publish("telemetry", {"event": event.model_dump(), "point": point})
            await asyncio.sleep(1)

    def analyze_fixture(self, filename: str) -> dict[str, Any]:
        accepted = any(token in filename.lower() for token in ("sentinel", "fixture", "cctv"))
        if not accepted:
            return {"status": "analysis_unavailable", "provider": "demo", "detections": [], "message": "Enable the Ultralytics provider for arbitrary images."}
        detections = [
            Detection(label="person", confidence=0.98, bbox=[58.4, 34.2, 67.1, 69.5], severity="info"),
            Detection(label="no_helmet", confidence=0.96, bbox=[59.7, 34.0, 62.4, 41.2], severity="critical"),
            Detection(label="no_safety_vest", confidence=0.93, bbox=[58.8, 40.0, 65.4, 57.5], severity="warning"),
            Detection(label="restricted_zone_entry", confidence=0.99, bbox=[45.0, 31.0, 83.0, 92.0], severity="critical"),
        ]
        return {"status": "complete", "provider": "demo", "detections": [item.model_dump() for item in detections], "message": "Four safety observations correlated."}

    def query(self, question: str) -> QueryResponse:
        citations = self.store.search(question)
        if not citations:
            return QueryResponse(answer="No supporting safety document was found.", citations=[])
        context = "\n".join(f"{item.title}, page {item.page}: {item.excerpt}" for item in citations)
        live_answer = self.reasoner.answer(question, context)
        if live_answer:
            return QueryResponse(answer=live_answer, citations=citations, mode="gemini")
        if "continue" in question.lower() or "maintenance" in question.lower() or "hot work" in question.lower():
            answer = "No. Suspend the hot-work permit while the gas anomaly is active, evacuate non-essential personnel, and require supervisor review before maintenance resumes."
        else:
            answer = "The applicable controls require PPE, continuous gas monitoring, permit suspension when telemetry conflicts, and preservation of incident evidence."
        return QueryResponse(answer=answer, citations=citations)

    @staticmethod
    def simulate(equipment_id: str, failure_mode: str) -> SimulationResult:
        label = "Pump 7" if equipment_id.upper() == "PUMP-7" else equipment_id
        return SimulationResult(
            scenario_id="SIM-P7-SEAL",
            title=f"{label}: {failure_mode.title()}",
            risk_score=88,
            timeline=[
                {"offset": "T+00m", "event": "Seal integrity lost", "value": "Pressure +12%"},
                {"offset": "T+18m", "event": "Hydrogen accumulates near Boiler 4", "value": "1.8% LEL"},
                {"offset": "T+46m", "event": "Ventilation capacity exceeded", "value": "3.1% LEL"},
                {"offset": "T+82m", "event": "Ignition likelihood becomes critical", "value": "88% risk"},
            ],
            affected_workers=14,
            evacuation_route=["ZONE-3", "CORRIDOR-E", "MUSTER-A"],
            estimated_loss_usd=480000,
            recommendation="Isolate Pump 7, reduce upstream pressure, and clear Zone 3 within 18 minutes.",
        )

    def acknowledge(self, incident_id: str) -> Incident | None:
        incident = self.store.get_incident(incident_id)
        if not incident:
            return None
        incident.status = "acknowledged"
        incident.acknowledged_at = utc_now()
        self.store.save_incident(incident)
        if self.current_incident and self.current_incident.id == incident_id:
            self.current_incident = incident
        return incident

    def build_report(self, incident: Incident) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, title=f"SentinelAI Incident {incident.id}")
        styles = getSampleStyleSheet()
        story = [
            Paragraph("SentinelAI Incident Report", styles["Title"]),
            Paragraph(f"Incident: {incident.id}", styles["Heading2"]),
            Paragraph(f"Risk: {incident.risk_score}% | Zone: {incident.zone_id} | Status: {incident.status}", styles["BodyText"]),
            Spacer(1, 12),
            Paragraph("Correlated evidence", styles["Heading2"]),
        ]
        story.extend(Paragraph(f"- {item}", styles["BodyText"]) for item in incident.evidence)
        story.append(Spacer(1, 12))
        story.append(Paragraph("Autonomous response (simulated)", styles["Heading2"]))
        story.extend(Paragraph(f"- {item}", styles["BodyText"]) for item in incident.actions)
        story.append(Spacer(1, 12))
        story.append(Paragraph("Demonstration only. Not a certified operational safety record.", styles["Italic"]))
        doc.build(story)
        return buffer.getvalue()
