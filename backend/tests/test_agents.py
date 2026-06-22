import httpx

from app.agents import OptionalGeminiReasoner, SAFETY_GRAPH, calculate_risk


def test_correlated_signals_produce_exactly_97_percent():
    state = {
        "gas_high": True,
        "permit_active": True,
        "worker_present": True,
        "ppe_missing": True,
    }
    assessment = calculate_risk(state)
    assert assessment.score == 97
    assert assessment.level == "critical"
    assert len(assessment.factors) == 4


def test_graph_runs_eight_agents_in_order():
    result = SAFETY_GRAPH.invoke(
        {
            "gas_high": True,
            "permit_active": True,
            "worker_present": True,
            "ppe_missing": True,
            "agent_runs": [],
        }
    )
    assert [run["agent_id"] for run in result["agent_runs"]] == [
        "sensor",
        "vision",
        "permit",
        "risk",
        "prediction",
        "compliance",
        "emergency",
        "simulation",
    ]
    assert result["score"] == 97


def test_partial_signals_do_not_create_critical_risk():
    assessment = calculate_risk({"gas_high": True, "permit_active": True})
    assert assessment.score == 62
    assert assessment.level == "guarded"


def test_gemini_reasoner_uses_configured_model_and_falls_back(monkeypatch):
    captured = {}

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"candidates": [{"content": {"parts": [{"text": " Suspend hot work. "}]}}]}

    def fake_post(url, **kwargs):
        captured["url"] = url
        captured.update(kwargs)
        return FakeResponse()

    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-2.5-flash")
    monkeypatch.setattr(httpx, "post", fake_post)

    reasoner = OptionalGeminiReasoner()
    assert reasoner.answer("Can work continue?", "Hydrogen alarm active") == "Suspend hot work."
    assert captured["url"].endswith("/gemini-2.5-flash:generateContent")
    assert captured["headers"] == {"x-goog-api-key": "test-key"}
    prompt = captured["json"]["contents"][0]["parts"][0]["text"]
    assert "Hydrogen alarm active" in prompt

    def offline(*args, **kwargs):
        raise httpx.ConnectError("offline")

    monkeypatch.setattr(httpx, "post", offline)
    assert reasoner.answer("Can work continue?", "Hydrogen alarm active") is None
