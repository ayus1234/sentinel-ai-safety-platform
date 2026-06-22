import type { GraphSnapshot, PlantSnapshot, SimulationResult } from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws/plant";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(body.detail ?? "Request failed");
  }
  return response.json() as Promise<T>;
}

export const api = {
  bootstrap: () => request<PlantSnapshot>("/api/v1/bootstrap"),
  startDemo: () => request<{ status: string }>("/api/v1/demo/start", { method: "POST" }),
  resetDemo: () => request<{ status: string }>("/api/v1/demo/reset", { method: "POST" }),
  acknowledge: (id: string) => request(`/api/v1/incidents/${id}/acknowledge`, { method: "POST" }),
  graph: () => request<GraphSnapshot>("/api/v1/memory/graph"),
  simulate: () =>
    request<SimulationResult>("/api/v1/simulations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ equipment_id: "PUMP-7", failure_mode: "seal failure" }),
    }),
  query: (question: string) =>
    request<{ answer: string; citations: Array<{ title: string; page: number; excerpt: string }>; mode: string }>("/api/v1/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    }),
  analyzeFixture: async () => {
    const image = await fetch("/cctv/sentinel-cctv-fixture.png").then((res) => res.blob());
    const form = new FormData();
    form.append("file", image, "sentinel-cctv-fixture.png");
    return request<{ status: string; detections: Array<{ label: string; confidence: number; bbox: number[]; severity: string }> }>("/api/v1/vision/analyze", { method: "POST", body: form });
  },
  uploadDocument: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ document_id: string; pages: number }>("/api/v1/documents", { method: "POST", body: form });
  },
  reportUrl: (id: string) => `${API_URL}/api/v1/incidents/${id}/report`,
};

