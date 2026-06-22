from __future__ import annotations

import os
from pathlib import Path
from typing import Any, TypedDict
from urllib.parse import quote

import httpx
from dotenv import load_dotenv
from langgraph.graph import END, StateGraph

from .models import AgentRun, RiskAssessment


load_dotenv(Path(__file__).resolve().parents[1] / ".env")


AGENTS = [
    ("sensor", "Sensor Intelligence", "perception"),
    ("vision", "Computer Vision", "perception"),
    ("permit", "Permit Intelligence", "perception"),
    ("risk", "Risk Correlation", "reasoning"),
    ("prediction", "Incident Prediction", "reasoning"),
    ("compliance", "Compliance", "reasoning"),
    ("emergency", "Emergency Response", "action"),
    ("simulation", "Simulation", "action"),
]


class SafetyState(TypedDict, total=False):
    gas_high: bool
    permit_active: bool
    worker_present: bool
    ppe_missing: bool
    score: int
    factors: list[str]
    agent_runs: list[dict[str, Any]]


def calculate_risk(state: SafetyState) -> RiskAssessment:
    score = 18
    factors: list[str] = []
    if state.get("gas_high"):
        score += 24
        factors.append("Hydrogen concentration above action threshold")
    if state.get("permit_active"):
        score += 20
        factors.append("Hot-work permit overlaps live gas anomaly")
    if state.get("worker_present"):
        score += 16
        factors.append("Worker detected inside restricted Zone 3")
    if state.get("ppe_missing"):
        score += 19
        factors.append("Helmet and high-visibility vest not detected")

    if score >= 90:
        level, title = "critical", "Explosion risk"
        recommendation = "Suspend hot work, isolate Zone 3, and evacuate via Route E-3."
    elif score >= 65:
        level, title = "high", "Escalating process risk"
        recommendation = "Hold work and verify personnel, permit, and ventilation status."
    elif score >= 40:
        level, title = "guarded", "Abnormal operating condition"
        recommendation = "Increase monitoring frequency and validate the gas reading."
    else:
        level, title = "low", "Plant operating normally"
        recommendation = "Continue standard monitoring."
    return RiskAssessment(
        score=score,
        level=level,
        title=title,
        zone_id="ZONE-3",
        factors=factors,
        recommendation=recommendation,
    )


def _append_run(state: SafetyState, agent_id: str, message: str, status: str = "complete") -> dict:
    agent = next(item for item in AGENTS if item[0] == agent_id)
    run = AgentRun(
        agent_id=agent_id,
        name=agent[1],
        layer=agent[2],  # type: ignore[arg-type]
        status=status,  # type: ignore[arg-type]
        message=message,
        confidence=0.99 if agent_id == "risk" else 0.94,
    )
    return {"agent_runs": [*state.get("agent_runs", []), run.model_dump()]}


def sensor_node(state: SafetyState) -> dict:
    message = "Hydrogen threshold exceeded" if state.get("gas_high") else "Telemetry within envelope"
    return _append_run(state, "sensor", message)


def vision_node(state: SafetyState) -> dict:
    if state.get("ppe_missing"):
        message = "Worker detected without helmet and vest"
        status = "attention"
    elif state.get("worker_present"):
        message, status = "Worker tracked in Zone 3", "complete"
    else:
        message, status = "CCTV stream clear", "complete"
    return _append_run(state, "vision", message, status)


def permit_node(state: SafetyState) -> dict:
    message = "Hot-work permit HW-204 is active" if state.get("permit_active") else "No conflicting permits"
    return _append_run(state, "permit", message)


def risk_node(state: SafetyState) -> dict:
    risk = calculate_risk(state)
    result = _append_run(state, "risk", f"Correlated risk calculated at {risk.score}%", "attention" if risk.score >= 90 else "complete")
    return {**result, "score": risk.score, "factors": risk.factors}


def prediction_node(state: SafetyState) -> dict:
    score = state.get("score", calculate_risk(state).score)
    message = "Explosion precursor pattern detected" if score >= 90 else "No imminent incident pattern"
    return _append_run(state, "prediction", message, "attention" if score >= 90 else "complete")


def compliance_node(state: SafetyState) -> dict:
    score = state.get("score", calculate_risk(state).score)
    message = "Hot-work controls breached; permit suspension required" if score >= 90 else "Controls aligned with active SOP"
    return _append_run(state, "compliance", message, "attention" if score >= 90 else "complete")


def emergency_node(state: SafetyState) -> dict:
    score = state.get("score", calculate_risk(state).score)
    message = "Route E-3 prepared; simulated alerts dispatched" if score >= 90 else "Response plan standing by"
    return _append_run(state, "emergency", message, "attention" if score >= 90 else "complete")


def simulation_node(state: SafetyState) -> dict:
    return _append_run(state, "simulation", "Impact model synchronized with live plant state")


def build_safety_graph():
    graph = StateGraph(SafetyState)
    nodes = {
        "sensor": sensor_node,
        "vision": vision_node,
        "permit": permit_node,
        "risk": risk_node,
        "prediction": prediction_node,
        "compliance": compliance_node,
        "emergency": emergency_node,
        "simulation": simulation_node,
    }
    for name, node in nodes.items():
        graph.add_node(name, node)
    graph.set_entry_point("sensor")
    ordered = list(nodes)
    for current, following in zip(ordered, ordered[1:]):
        graph.add_edge(current, following)
    graph.add_edge("simulation", END)
    return graph.compile()


SAFETY_GRAPH = build_safety_graph()


class OptionalGeminiReasoner:
    def __init__(self) -> None:
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    @property
    def enabled(self) -> bool:
        return bool(self.api_key and self.model)

    def answer(self, question: str, context: str) -> str | None:
        if not self.enabled:
            return None
        try:
            model = quote(self.model or "gemini-2.5-flash", safe="")
            response = httpx.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                headers={"x-goog-api-key": self.api_key or ""},
                json={
                    "contents": [
                        {
                            "parts": [
                                {
                                    "text": (
                                        "You are SentinelAI, an industrial safety assistant. "
                                        "Answer only from the provided evidence, state uncertainty "
                                        f"clearly, and do not invent citations.\n\nEvidence:\n{context}"
                                        f"\n\nQuestion: {question}"
                                    )
                                }
                            ]
                        }
                    ],
                    "generationConfig": {"temperature": 0.1, "maxOutputTokens": 600},
                },
                timeout=20.0,
            )
            response.raise_for_status()
            parts = response.json()["candidates"][0]["content"]["parts"]
            answer = "".join(part.get("text", "") for part in parts).strip()
            return answer or None
        except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError):
            return None
