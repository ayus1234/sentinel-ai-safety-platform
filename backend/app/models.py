from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class TelemetryEvent(BaseModel):
    sensor_id: str
    equipment_id: str
    zone_id: str
    metric: str
    value: float
    unit: str
    status: Literal["normal", "warning", "critical"] = "normal"
    timestamp: str = Field(default_factory=utc_now)


class Detection(BaseModel):
    label: str
    confidence: float
    bbox: list[float]
    severity: Literal["info", "warning", "critical"] = "warning"


class PermitContext(BaseModel):
    permit_id: str
    permit_type: str
    equipment_id: str
    zone_id: str
    status: Literal["active", "expired", "closed"]
    holder: str
    valid_until: str


class Citation(BaseModel):
    document_id: str
    title: str
    page: int
    excerpt: str
    score: float


class RiskAssessment(BaseModel):
    score: int
    level: Literal["low", "guarded", "high", "critical"]
    title: str
    zone_id: str
    factors: list[str]
    recommendation: str
    updated_at: str = Field(default_factory=utc_now)


class AgentRun(BaseModel):
    agent_id: str
    name: str
    layer: Literal["perception", "reasoning", "action"]
    status: Literal["idle", "running", "complete", "attention"]
    message: str
    confidence: float = 1.0
    timestamp: str = Field(default_factory=utc_now)


class Incident(BaseModel):
    id: str
    title: str
    status: Literal["active", "contained", "acknowledged"] = "active"
    severity: Literal["high", "critical"] = "critical"
    zone_id: str
    risk_score: int
    evidence: list[str]
    actions: list[str]
    occurred_at: str = Field(default_factory=utc_now)
    acknowledged_at: str | None = None


class SimulationResult(BaseModel):
    scenario_id: str
    title: str
    risk_score: int
    timeline: list[dict[str, Any]]
    affected_workers: int
    evacuation_route: list[str]
    estimated_loss_usd: int
    recommendation: str


class GraphNode(BaseModel):
    id: str
    label: str
    type: str
    risk: int = 0


class GraphEdge(BaseModel):
    source: str
    target: str
    relation: str


class GraphSnapshot(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class QueryRequest(BaseModel):
    question: str = Field(min_length=3, max_length=500)


class QueryResponse(BaseModel):
    answer: str
    citations: list[Citation]
    mode: Literal["deterministic", "gemini"] = "deterministic"


class SimulationRequest(BaseModel):
    equipment_id: str = "PUMP-7"
    failure_mode: str = "seal failure"


class EventEnvelope(BaseModel):
    type: str
    payload: dict[str, Any]
    timestamp: str = Field(default_factory=utc_now)
