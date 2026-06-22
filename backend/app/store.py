from __future__ import annotations

import json
import os
import re
import sqlite3
import uuid
from pathlib import Path

from rank_bm25 import BM25Okapi

from .models import Citation, GraphEdge, GraphNode, GraphSnapshot, Incident


def tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


class SQLiteSafetyStore:
    def __init__(self, path: str | None = None) -> None:
        default = Path(__file__).resolve().parents[1] / "data" / "sentinel.db"
        self.path = Path(path or os.getenv("DATABASE_PATH", str(default)))
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()
        self._seed_documents()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, check_same_thread=False)
        connection.row_factory = sqlite3.Row
        return connection

    def _init_db(self) -> None:
        with self._connect() as db:
            db.executescript(
                """
                CREATE TABLE IF NOT EXISTS incidents (
                    id TEXT PRIMARY KEY, payload TEXT NOT NULL, occurred_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY, title TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS chunks (
                    id TEXT PRIMARY KEY, document_id TEXT NOT NULL, page INTEGER NOT NULL,
                    content TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS audit_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT NOT NULL,
                    payload TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
                """
            )

    def _seed_documents(self) -> None:
        with self._connect() as db:
            count = db.execute("SELECT COUNT(*) FROM documents").fetchone()[0]
        if count:
            return
        self.add_document(
            "Hydrogen Hot Work Safety Standard",
            [
                "Hot work must stop when hydrogen exceeds the site action threshold. Isolate ignition sources, verify ventilation, and evacuate non-essential personnel.",
                "A hot-work permit does not override live gas monitoring. Conflicting telemetry requires permit suspension and supervisor review before work resumes.",
            ],
        )
        self.add_document(
            "Confined Area PPE and Entry SOP",
            [
                "Personnel entering a restricted process zone must wear helmet, gloves, eye protection, and high-visibility clothing. Entry is logged against the active permit.",
                "When gas alarms and missing PPE coincide, raise a unified critical incident, direct the worker to the nearest safe muster point, and preserve all evidence.",
            ],
        )

    def add_document(self, title: str, pages: list[str]) -> str:
        document_id = f"DOC-{uuid.uuid4().hex[:8].upper()}"
        with self._connect() as db:
            db.execute("INSERT INTO documents(id, title) VALUES (?, ?)", (document_id, title))
            for page_number, content in enumerate(pages, start=1):
                if not content.strip():
                    continue
                db.execute(
                    "INSERT INTO chunks(id, document_id, page, content) VALUES (?, ?, ?, ?)",
                    (uuid.uuid4().hex, document_id, page_number, content.strip()),
                )
        return document_id

    def search(self, query: str, limit: int = 3) -> list[Citation]:
        with self._connect() as db:
            rows = db.execute(
                "SELECT c.document_id, d.title, c.page, c.content "
                "FROM chunks c JOIN documents d ON d.id = c.document_id"
            ).fetchall()
        if not rows:
            return []
        corpus = [tokenize(row["content"]) for row in rows]
        scores = BM25Okapi(corpus).get_scores(tokenize(query))
        ranked = sorted(zip(rows, scores), key=lambda item: item[1], reverse=True)[:limit]
        max_score = max((float(score) for _, score in ranked), default=1.0) or 1.0
        return [
            Citation(
                document_id=row["document_id"],
                title=row["title"],
                page=row["page"],
                excerpt=row["content"][:240],
                score=round(max(float(score), 0.0) / max_score, 3),
            )
            for row, score in ranked
        ]

    def save_incident(self, incident: Incident) -> None:
        with self._connect() as db:
            db.execute(
                "INSERT OR REPLACE INTO incidents(id, payload, occurred_at) VALUES (?, ?, ?)",
                (incident.id, incident.model_dump_json(), incident.occurred_at),
            )

    def list_incidents(self) -> list[Incident]:
        with self._connect() as db:
            rows = db.execute("SELECT payload FROM incidents ORDER BY occurred_at DESC").fetchall()
        return [Incident.model_validate_json(row["payload"]) for row in rows]

    def get_incident(self, incident_id: str) -> Incident | None:
        with self._connect() as db:
            row = db.execute("SELECT payload FROM incidents WHERE id = ?", (incident_id,)).fetchone()
        return Incident.model_validate_json(row["payload"]) if row else None

    def clear_demo_incidents(self) -> None:
        with self._connect() as db:
            db.execute("DELETE FROM incidents WHERE id LIKE 'INC-DEMO-%'")

    def audit(self, event_type: str, payload: dict) -> None:
        with self._connect() as db:
            db.execute(
                "INSERT INTO audit_events(event_type, payload) VALUES (?, ?)",
                (event_type, json.dumps(payload)),
            )

    def snapshot(self, active_score: int = 18) -> GraphSnapshot:
        nodes = [
            GraphNode(id="ZONE-3", label="Hydrogen Processing", type="zone", risk=active_score),
            GraphNode(id="BOILER-4", label="Boiler 4", type="equipment", risk=max(active_score - 18, 0)),
            GraphNode(id="PUMP-7", label="Pump 7", type="equipment", risk=34),
            GraphNode(id="SENSOR-H2-03", label="H2 Sensor 03", type="sensor", risk=active_score),
            GraphNode(id="PERMIT-HW-204", label="Hot Work Permit", type="permit", risk=62 if active_score > 42 else 10),
            GraphNode(id="WORKER-17", label="Arjun Mehta", type="worker", risk=active_score if active_score > 70 else 12),
        ]
        edges = [
            GraphEdge(source="SENSOR-H2-03", target="ZONE-3", relation="MONITORS"),
            GraphEdge(source="BOILER-4", target="ZONE-3", relation="LOCATED_IN"),
            GraphEdge(source="PUMP-7", target="ZONE-3", relation="FEEDS"),
            GraphEdge(source="PERMIT-HW-204", target="BOILER-4", relation="AUTHORIZES_WORK_ON"),
            GraphEdge(source="WORKER-17", target="PERMIT-HW-204", relation="ASSIGNED_TO"),
            GraphEdge(source="WORKER-17", target="ZONE-3", relation="PRESENT_IN"),
        ]
        return GraphSnapshot(nodes=nodes, edges=edges)

