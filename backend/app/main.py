from __future__ import annotations

import io
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pypdf import PdfReader

from .models import QueryRequest, QueryResponse, SimulationRequest, SimulationResult
from .runtime import PlantRuntime
from .store import SQLiteSafetyStore


store = SQLiteSafetyStore()
runtime = PlantRuntime(store)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await runtime.start_background()
    yield
    await runtime.stop_background()


app = FastAPI(title="SentinelAI API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001", "http://127.0.0.1:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "sentinel-api"}


@app.get("/api/v1/bootstrap")
def bootstrap() -> dict:
    return runtime.bootstrap()


@app.post("/api/v1/demo/start")
async def start_demo() -> dict:
    return await runtime.start_demo()


@app.post("/api/v1/demo/reset")
async def reset_demo() -> dict:
    return await runtime.reset_demo()


@app.websocket("/ws/plant")
async def plant_socket(websocket: WebSocket) -> None:
    await runtime.connect(websocket)
    await websocket.send_json({"type": "bootstrap", "payload": runtime.bootstrap()})
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        runtime.disconnect(websocket)


@app.post("/api/v1/vision/analyze")
async def analyze_vision(file: UploadFile = File(...)) -> dict:
    await file.read()
    return runtime.analyze_fixture(file.filename or "upload")


@app.post("/api/v1/documents")
async def ingest_document(file: UploadFile = File(...)) -> dict:
    if file.content_type != "application/pdf" and not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=415, detail="Only PDF documents are supported")
    content = await file.read()
    try:
        reader = PdfReader(io.BytesIO(content))
        pages = [(page.extract_text() or "").strip() for page in reader.pages]
    except Exception as exc:
        raise HTTPException(status_code=400, detail="The PDF could not be read") from exc
    if not any(pages):
        raise HTTPException(status_code=422, detail="The PDF contains no extractable text")
    document_id = store.add_document(file.filename or "Uploaded safety document", pages)
    return {"document_id": document_id, "title": file.filename, "pages": len(pages)}


@app.post("/api/v1/query", response_model=QueryResponse)
def query_documents(request: QueryRequest) -> QueryResponse:
    return runtime.query(request.question)


@app.post("/api/v1/simulations", response_model=SimulationResult)
def run_simulation(request: SimulationRequest) -> SimulationResult:
    return runtime.simulate(request.equipment_id, request.failure_mode)


@app.get("/api/v1/memory/graph")
def memory_graph() -> dict:
    return store.snapshot(runtime.risk.score).model_dump()


@app.get("/api/v1/incidents")
def list_incidents() -> list[dict]:
    return [item.model_dump() for item in store.list_incidents()]


@app.post("/api/v1/incidents/{incident_id}/acknowledge")
async def acknowledge_incident(incident_id: str) -> dict:
    incident = runtime.acknowledge(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    await runtime.publish("incident_acknowledged", incident.model_dump())
    return incident.model_dump()


@app.get("/api/v1/incidents/{incident_id}/report")
def incident_report(incident_id: str) -> Response:
    incident = store.get_incident(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return Response(
        runtime.build_report(incident),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{incident_id}.pdf"'},
    )

