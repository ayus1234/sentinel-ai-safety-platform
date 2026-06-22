from __future__ import annotations

from typing import Protocol

from .models import Citation, EventEnvelope, GraphSnapshot, Incident


class IncidentStore(Protocol):
    def save_incident(self, incident: Incident) -> None: ...

    def list_incidents(self) -> list[Incident]: ...


class RetrievalStore(Protocol):
    def add_document(self, title: str, pages: list[str]) -> str: ...

    def search(self, query: str, limit: int = 3) -> list[Citation]: ...


class GraphStore(Protocol):
    def snapshot(self) -> GraphSnapshot: ...


class EventPublisher(Protocol):
    async def publish(self, event: EventEnvelope) -> None: ...


class PostgresIncidentAdapter:
    """Production adapter boundary; intentionally not configured in the MVP."""


class Neo4jGraphAdapter:
    """Production adapter boundary; intentionally not configured in the MVP."""


class QdrantRetrievalAdapter:
    """Production adapter boundary; intentionally not configured in the MVP."""

