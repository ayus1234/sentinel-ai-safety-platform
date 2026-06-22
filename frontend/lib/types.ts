export type RiskLevel = "low" | "guarded" | "high" | "critical";

export interface RiskAssessment {
  score: number;
  level: RiskLevel;
  title: string;
  zone_id: string;
  factors: string[];
  recommendation: string;
  updated_at: string;
}

export interface AgentRun {
  agent_id: string;
  name: string;
  layer: "perception" | "reasoning" | "action";
  status: "idle" | "running" | "complete" | "attention";
  message: string;
  confidence: number;
  timestamp: string;
}

export interface Incident {
  id: string;
  title: string;
  status: "active" | "contained" | "acknowledged";
  severity: "high" | "critical";
  zone_id: string;
  risk_score: number;
  evidence: string[];
  actions: string[];
  occurred_at: string;
  acknowledged_at?: string;
}

export interface Zone {
  id: string;
  name: string;
  risk: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Equipment {
  id: string;
  name: string;
  zone_id: string;
  x: number;
  y: number;
  status: "normal" | "warning" | "critical";
}

export interface TelemetryPoint {
  timestamp: string;
  hydrogen: number;
  temperature: number;
  pressure: number;
}

export interface PlantSnapshot {
  plant: { id: string; name: string; location: string; status: string; workers_on_site: number };
  zones: Zone[];
  equipment: Equipment[];
  risk: RiskAssessment;
  incidents: Incident[];
  agents: AgentRun[];
  scenario: { running: boolean; step: number };
  telemetry: TelemetryPoint[];
  provider: { reasoning: string; vision: string };
}

export interface Citation {
  document_id: string;
  title: string;
  page: number;
  excerpt: string;
  score: number;
}

export interface GraphSnapshot {
  nodes: { id: string; label: string; type: string; risk: number }[];
  edges: { source: string; target: string; relation: string }[];
}

export interface SimulationResult {
  scenario_id: string;
  title: string;
  risk_score: number;
  timeline: { offset: string; event: string; value: string }[];
  affected_workers: number;
  evacuation_route: string[];
  estimated_loss_usd: number;
  recommendation: string;
}

