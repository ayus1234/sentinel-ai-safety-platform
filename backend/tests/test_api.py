import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app, runtime, store


def api_client() -> AsyncClient:
    return AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    )


@pytest.mark.anyio
async def test_bootstrap_and_simulation_contracts():
    async with api_client() as client:
        bootstrap = await client.get("/api/v1/bootstrap")
        assert bootstrap.status_code == 200
        assert bootstrap.json()["plant"]["name"] == "Sentinel Hydrogen Works"
        assert len(bootstrap.json()["agents"]) == 8

        simulation = await client.post(
            "/api/v1/simulations",
            json={"equipment_id": "PUMP-7", "failure_mode": "seal failure"},
        )
        assert simulation.status_code == 200
        assert simulation.json()["risk_score"] == 88
        assert simulation.json()["affected_workers"] == 14


@pytest.mark.anyio
async def test_rag_returns_page_citations():
    async with api_client() as client:
        response = await client.post(
            "/api/v1/query",
            json={"question": "Can maintenance continue during the hydrogen alarm?"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["answer"].startswith("No,")
        assert body["citations"]
        assert body["citations"][0]["page"] >= 1


@pytest.mark.anyio
async def test_vision_fixture_and_arbitrary_upload_behavior():
    async with api_client() as client:
        fixture = await client.post(
            "/api/v1/vision/analyze",
            files={"file": ("sentinel-cctv-fixture.png", b"fixture", "image/png")},
        )
        assert fixture.status_code == 200
        assert len(fixture.json()["detections"]) == 4

        arbitrary = await client.post(
            "/api/v1/vision/analyze",
            files={"file": ("random.png", b"other", "image/png")},
        )
        assert arbitrary.json()["status"] == "analysis_unavailable"


@pytest.mark.anyio
async def test_acknowledgement_is_idempotent():
    incident = runtime.current_incident
    if incident is None:
        from app.models import Incident

        incident = Incident(
            id="INC-DEMO-TEST",
            title="Test",
            zone_id="ZONE-3",
            risk_score=97,
            evidence=["evidence"],
            actions=["action"],
        )
        store.save_incident(incident)
    async with api_client() as client:
        first = await client.post(f"/api/v1/incidents/{incident.id}/acknowledge")
        second = await client.post(f"/api/v1/incidents/{incident.id}/acknowledge")
        assert first.status_code == 200
        assert second.status_code == 200
        assert second.json()["status"] == "acknowledged"
