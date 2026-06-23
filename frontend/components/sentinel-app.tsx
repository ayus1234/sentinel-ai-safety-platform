"use client";

import Image from "next/image";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertOctagon,
  Bell,
  Bot,
  BrainCircuit,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileSearch,
  GitBranch,
  History,
  LayoutGrid,
  LoaderCircle,
  Network,
  Play,
  Radio,
  RefreshCcw,
  RotateCcw,
  Search,
  ShieldCheck,
  Siren,
  Sparkles,
  Upload,
  Users,
  Video,
  X,
  Zap,
} from "lucide-react";

import { AgentRail } from "@/components/agent-rail";
import { PlantMap } from "@/components/plant-map";
import { TelemetryChart } from "@/components/telemetry-chart";
import { VoiceCommand } from "@/components/voice-command";
import { usePlantStream } from "@/hooks/use-plant-stream";
import { api } from "@/lib/api";
import type { GraphSnapshot, Incident, PlantSnapshot, SimulationResult } from "@/lib/types";

const tabs = [
  { id: "command", label: "Command Center", icon: LayoutGrid },
  { id: "twin", label: "Digital Twin", icon: Building2 },
  { id: "incidents", label: "Incidents", icon: Siren },
  { id: "memory", label: "Safety Memory", icon: Network },
  { id: "simulation", label: "Simulation", icon: GitBranch },
  { id: "compliance", label: "Compliance", icon: ClipboardCheck },
  { id: "agents", label: "Agent Activity", icon: BrainCircuit },
] as const;

type TabId = (typeof tabs)[number]["id"];
type Detection = { label: string; confidence: number; bbox: number[]; severity: string };

function LoadingState() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#f7f8f7]">
      <div className="flex items-center gap-3 text-sm font-bold text-[#454c50]"><LoaderCircle className="animate-spin text-[#087e8b]" size={20} /> Synchronizing plant state</div>
    </main>
  );
}

function RiskBand({ snapshot, onStart, onReset }: { snapshot: PlantSnapshot; onStart: () => void; onReset: () => void }) {
  const critical = snapshot.risk.score >= 90;
  return (
    <section className="risk-band">
      <div className="flex min-w-0 items-center gap-5">
        <div className="risk-score">
          <span className={`text-[46px] leading-none font-extrabold ${critical ? "text-[#d92d20]" : "text-[#087e8b]"}`}>{snapshot.risk.score}</span>
          <span className="text-sm font-bold">%</span>
        </div>
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className={`badge ${critical ? "critical" : snapshot.risk.score >= 40 ? "warning" : "safe"}`}>{snapshot.risk.level} risk</span>
            <span className="text-[11px] font-semibold text-[#687176]">ZONE 3 / HYDROGEN PROCESSING</span>
          </div>
          <h1 className="m-0 truncate text-[21px] font-extrabold">{snapshot.risk.title}</h1>
          <p className="mt-1 mb-0 max-w-[800px] text-[12px] leading-5 text-[#626a70]">{snapshot.risk.recommendation}</p>
        </div>
      </div>
      <div className="risk-actions flex items-center gap-2">
        <button className={`button-primary ${critical ? "danger" : ""}`} onClick={onStart} disabled={snapshot.scenario.running}>
          {snapshot.scenario.running ? <LoaderCircle size={15} className="animate-spin" /> : <Play size={15} fill="currentColor" />}
          {snapshot.scenario.running ? `Correlating ${snapshot.scenario.step}/4` : "Run critical scenario"}
        </button>
        <button className="icon-button" onClick={onReset} title="Reset scenario" aria-label="Reset scenario"><RotateCcw size={16} /></button>
      </div>
    </section>
  );
}

function VisionPanel({ active }: { active: boolean }) {
  const [detections, setDetections] = useState<Detection[]>([]);
  const [analyzing, setAnalyzing] = useState(false);

  const analyze = async () => {
    setAnalyzing(true);
    try {
      const result = await api.analyzeFixture();
      setDetections(result.detections);
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    if (active && detections.length === 0) void analyze();
    // The fixture should auto-analyze once when the scenario reaches worker detection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <section className="panel border-r-0">
      <div className="section-heading">
        <div className="flex items-center gap-2"><Video size={15} className="text-[#087e8b]" /><h2>CCTV / CAM-03</h2></div>
        <button className="button-secondary h-[30px]! px-2.5!" onClick={() => void analyze()} disabled={analyzing}>
          {analyzing ? <LoaderCircle size={13} className="animate-spin" /> : <Search size={13} />} Analyze
        </button>
      </div>
      <div className="cctv-frame">
        <Image src="/cctv/sentinel-cctv-fixture.png" alt="CCTV view of the Zone 3 compressor bay" fill sizes="(max-width: 780px) 100vw, 40vw" priority />
        {detections.map((detection) => {
          const [x1, y1, x2, y2] = detection.bbox;
          return (
            <div
              key={detection.label}
              className={`detection-box ${detection.severity === "critical" ? "critical" : ""}`}
              style={{ left: `${x1}%`, top: `${y1}%`, width: `${x2 - x1}%`, height: `${y2 - y1}%` }}
            >
              <span className="absolute -top-[18px] left-[-2px] whitespace-nowrap px-1">{detection.label.replaceAll("_", " ")} {Math.round(detection.confidence * 100)}%</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between px-4 py-2 text-[10px] font-bold text-[#626a70]">
        <span>DEMO VISION PROVIDER</span><span>{detections.length ? `${detections.length} OBSERVATIONS` : "READY"}</span>
      </div>
    </section>
  );
}

function CommandView({ snapshot, onStart, onReset }: { snapshot: PlantSnapshot; onStart: () => void; onReset: () => void }) {
  const latest = snapshot.telemetry.at(-1) ?? { hydrogen: 0.42, temperature: 72, pressure: 5.2 };
  const evidence = [
    snapshot.risk.score >= 42 && { source: "SENSOR INTELLIGENCE", text: "Hydrogen concentration rose 28% above baseline", time: "T+00:02" },
    snapshot.risk.score >= 62 && { source: "PERMIT INTELLIGENCE", text: "Hot-work permit HW-204 is active on Boiler 4", time: "T+00:04" },
    snapshot.risk.score >= 78 && { source: "COMPUTER VISION", text: "Worker entered restricted Zone 3", time: "T+00:05" },
    snapshot.risk.score >= 97 && { source: "RISK CORRELATION", text: "Missing PPE completes explosion precursor pattern", time: "T+00:07" },
  ].filter(Boolean) as { source: string; text: string; time: string }[];

  return (
    <>
      <RiskBand snapshot={snapshot} onStart={onStart} onReset={onReset} />
      <div className="workspace-grid">
        <section className="panel">
          <div className="section-heading">
            <div className="flex items-center gap-2"><Radio size={15} className="text-[#11845b]" /><h2>Live plant intelligence</h2></div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-[#626a70]"><span className="status-dot live" /> DIGITAL TWIN SYNCED</div>
          </div>
          <PlantMap zones={snapshot.zones} equipment={snapshot.equipment} risk={snapshot.risk.score} />
        </section>
        <aside className="intel-rail">
          <div className="section-heading">
            <div className="flex items-center gap-2"><Zap size={15} className="text-[#d97706]" /><h2>Correlated evidence</h2></div>
            <span className="text-[10px] font-bold text-[#626a70]">{evidence.length}/4 SIGNALS</span>
          </div>
          <div className="pt-4">
            {evidence.length === 0 ? (
              <div className="px-5 py-10 text-center text-[12px] leading-5 text-[#687176]">
                <ShieldCheck size={24} className="mx-auto mb-3 text-[#11845b]" />
                No correlated hazard pattern. Agents are monitoring 428 live signals.
              </div>
            ) : evidence.map((item) => (
              <div className="evidence-item" key={item.source}>
                <div className="mb-1 flex items-center justify-between gap-2 text-[9px] font-extrabold text-[#687176]"><span>{item.source}</span><span>{item.time}</span></div>
                <div className="text-[12px] leading-5 font-semibold">{item.text}</div>
              </div>
            ))}
            {snapshot.risk.score >= 97 && (
              <div className="mx-4 mb-4 border-l-4 border-[#d92d20] bg-[#fff0ee] px-3 py-3">
                <div className="text-[10px] font-extrabold text-[#a51c13]">UNIFIED CRITICAL INCIDENT</div>
                <div className="mt-1 text-[13px] font-extrabold">Explosion Risk = 97%</div>
                <div className="mt-1 text-[11px] leading-4 text-[#6e3a35]">Four signals collapsed into one actionable response.</div>
              </div>
            )}
          </div>
        </aside>
      </div>
      <div className="metric-strip">
        <div className="metric-cell"><div className="text-[9px] font-bold text-[#687176]">HYDROGEN / ZONE 3</div><div className="mt-1 text-xl font-extrabold tabular-nums">{latest.hydrogen}<span className="ml-1 text-[10px] text-[#687176]">% LEL</span></div></div>
        <div className="metric-cell"><div className="text-[9px] font-bold text-[#687176]">BOILER 4 TEMP</div><div className="mt-1 text-xl font-extrabold tabular-nums">{latest.temperature}<span className="ml-1 text-[10px] text-[#687176]">deg C</span></div></div>
        <div className="metric-cell"><div className="text-[9px] font-bold text-[#687176]">LINE PRESSURE</div><div className="mt-1 text-xl font-extrabold tabular-nums">{latest.pressure}<span className="ml-1 text-[10px] text-[#687176]">bar</span></div></div>
      </div>
      <div className="lower-grid">
        <section className="panel">
          <div className="section-heading"><div className="flex items-center gap-2"><Activity size={15} className="text-[#087e8b]" /><h2>Live telemetry</h2></div><span className="text-[10px] font-bold text-[#687176]">1 HZ STREAM</span></div>
          <TelemetryChart data={snapshot.telemetry} />
        </section>
        <VisionPanel active={snapshot.risk.score >= 78} />
      </div>
    </>
  );
}

function TwinView({ snapshot }: { snapshot: PlantSnapshot }) {
  return (
    <div className="content-view">
      <div className="mb-4 flex items-end justify-between">
        <div><div className="text-[10px] font-bold text-[#687176]">SPATIAL OPERATIONS</div><h1 className="mt-1 mb-0 text-[24px] font-extrabold">Plant digital twin</h1></div>
        <span className="badge safe"><Radio size={11} /> Live</span>
      </div>
      <div className="border border-[#d9dddf] bg-white">
        <PlantMap zones={snapshot.zones} equipment={snapshot.equipment} risk={snapshot.risk.score} />
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Asset</th><th>Zone</th><th>State</th><th>Risk contribution</th></tr></thead>
            <tbody>{snapshot.equipment.map((item) => <tr key={item.id}><td className="font-bold">{item.name}<div className="text-[10px] font-normal text-[#687176]">{item.id}</div></td><td>{item.zone_id}</td><td><span className={`badge ${item.status === "normal" ? "safe" : "warning"}`}>{item.status}</span></td><td>{item.zone_id === "ZONE-3" ? `${Math.max(snapshot.risk.score - 18, 0)} points` : "Monitored"}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function IncidentsView({ incidents, onAcknowledge }: { incidents: Incident[]; onAcknowledge: (id: string) => void }) {
  return (
    <div className="content-view">
      <div className="mb-4"><div className="text-[10px] font-bold text-[#687176]">RESPONSE COMMAND</div><h1 className="mt-1 mb-0 text-[24px] font-extrabold">Incidents</h1></div>
      {incidents.length === 0 ? (
        <div className="grid min-h-[360px] place-items-center border border-[#d9dddf] bg-white text-center"><div><ShieldCheck className="mx-auto mb-3 text-[#11845b]" size={32} /><div className="font-bold">No active incidents</div><div className="mt-1 text-[12px] text-[#687176]">Plant evidence is being continuously correlated.</div></div></div>
      ) : incidents.map((incident) => (
        <div key={incident.id} className="mb-4 border border-[#d9dddf] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d9dddf] px-5 py-4">
            <div><div className="mb-1 flex items-center gap-2"><span className="badge critical">{incident.risk_score}% risk</span><span className="text-[10px] font-bold text-[#687176]">{incident.id}</span></div><h2 className="m-0 text-[17px] font-extrabold">{incident.title}</h2></div>
            <div className="flex gap-2">
              <button className="button-secondary" onClick={async () => { const res = await fetch(api.reportUrl(incident.id)); const blob = await res.blob(); const url = window.URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${incident.id}.pdf`; a.click(); setTimeout(() => window.URL.revokeObjectURL(url), 100); }}><Download size={14} /> Report</button>
              <button className="button-primary" onClick={() => onAcknowledge(incident.id)} disabled={incident.status === "acknowledged"}><CheckCircle2 size={14} /> {incident.status === "acknowledged" ? "Acknowledged" : "Acknowledge"}</button>
            </div>
          </div>
          <div className="view-split border-0!">
            <div className="p-5">
              <div className="mb-3 text-[10px] font-extrabold text-[#687176]">CORRELATED EVIDENCE</div>
              {incident.evidence.map((item) => <div className="mb-2 flex gap-2 text-[12px] leading-5" key={item}><ChevronRight size={14} className="mt-0.5 shrink-0 text-[#d92d20]" />{item}</div>)}
            </div>
            <div className="border-l border-[#d9dddf] p-5">
              <div className="mb-3 text-[10px] font-extrabold text-[#687176]">AUTONOMOUS RESPONSE / SIMULATED</div>
              {incident.actions.map((item) => <div className="mb-2 flex gap-2 text-[12px] leading-5" key={item}><Check size={14} className="mt-0.5 shrink-0 text-[#11845b]" />{item}</div>)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SafetyMemoryView({ risk }: { risk: number }) {
  const [graph, setGraph] = useState<GraphSnapshot | null>(null);
  useEffect(() => { void api.graph().then(setGraph); }, [risk]);
  const positions = [{ x: 320, y: 210 }, { x: 110, y: 100 }, { x: 110, y: 310 }, { x: 315, y: 55 }, { x: 535, y: 100 }, { x: 540, y: 310 }];
  return (
    <div className="content-view">
      <div className="mb-4"><div className="text-[10px] font-bold text-[#687176]">PERSISTENT SAFETY CONTEXT</div><h1 className="mt-1 mb-0 text-[24px] font-extrabold">Safety Memory</h1></div>
      <div className="view-split">
        <section className="min-h-[500px] border-r border-[#d9dddf]">
          <div className="section-heading"><h2>Live knowledge graph</h2><span className="badge neutral">SQLite adapter</span></div>
          {graph && <svg viewBox="0 0 650 410" className="h-[430px] w-full" aria-label="Safety memory knowledge graph">
            {graph.edges.map((edge) => {
              const sourceIndex = graph.nodes.findIndex((node) => node.id === edge.source);
              const targetIndex = graph.nodes.findIndex((node) => node.id === edge.target);
              const source = positions[sourceIndex]; const target = positions[targetIndex];
              if (!source || !target) return null;
              return <g key={`${edge.source}-${edge.target}`}><line x1={source.x} y1={source.y} x2={target.x} y2={target.y} stroke="#b9c0c3" strokeWidth="2" /><text x={(source.x + target.x) / 2} y={(source.y + target.y) / 2 - 5} textAnchor="middle" fill="#687176" fontSize="8" fontWeight="700">{edge.relation}</text></g>;
            })}
            {graph.nodes.map((node, index) => { const pos = positions[index]; return <g key={node.id} transform={`translate(${pos.x} ${pos.y})`}><circle r="38" fill={node.risk >= 90 ? "#ffe4e1" : node.type === "worker" ? "#fff1d6" : "#e6f3f1"} stroke={node.risk >= 90 ? "#d92d20" : "#087e8b"} strokeWidth="2" /><text textAnchor="middle" y="-4" fill="#202427" fontSize="10" fontWeight="800">{node.label}</text><text textAnchor="middle" y="13" fill="#687176" fontSize="8" fontWeight="700">{node.type.toUpperCase()}</text></g>; })}
          </svg>}
        </section>
        <aside className="p-5">
          <div className="mb-2 flex items-center gap-2 text-[12px] font-bold"><History size={15} className="text-[#087e8b]" /> Learned pattern</div>
          <blockquote className="m-0 border-l-4 border-[#087e8b] bg-[#eef7f6] px-4 py-3 text-[13px] leading-6 font-semibold">After maintenance on Boiler 4, rising temperature and active hot work have preceded hydrogen anomalies in Zone 3.</blockquote>
          <div className="mt-6 mb-2 text-[10px] font-extrabold text-[#687176]">MEMORY COVERAGE</div>
          {["Telemetry observations", "Permit relationships", "Worker presence", "Incident decisions"].map((item, index) => <div key={item} className="flex items-center justify-between border-b border-[#e2e5e4] py-3 text-[12px]"><span>{item}</span><span className="font-extrabold">{[428, 26, 148, 12][index]}</span></div>)}
        </aside>
      </div>
    </div>
  );
}

function SimulationView() {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [running, setRunning] = useState(false);
  const run = async () => { setRunning(true); try { setResult(await api.simulate()); } finally { setRunning(false); } };
  return (
    <div className="content-view">
      <div className="mb-4 flex items-end justify-between gap-4"><div><div className="text-[10px] font-bold text-[#687176]">WHAT-IF ENGINE</div><h1 className="mt-1 mb-0 text-[24px] font-extrabold">Failure simulation</h1></div><button className="button-primary" onClick={() => void run()} disabled={running}>{running ? <LoaderCircle size={15} className="animate-spin" /> : <Play size={15} fill="currentColor" />} Run Pump-7 failure</button></div>
      <div className="view-split min-h-[520px]">
        <section className="border-r border-[#d9dddf]">
          <div className="section-heading"><h2>Propagation timeline</h2><span className={`badge ${result ? "critical" : "neutral"}`}>{result ? `${result.risk_score}% projected` : "Awaiting run"}</span></div>
          {!result ? <div className="grid min-h-[440px] place-items-center text-center"><div><GitBranch size={34} className="mx-auto mb-3 text-[#087e8b]" /><div className="font-bold">Pump-7 seal failure</div><div className="mt-1 text-[12px] text-[#687176]">Ready for deterministic impact propagation.</div></div></div> : <div className="p-6">{result.timeline.map((item) => <div className="evidence-item" key={item.offset}><div className="text-[10px] font-extrabold text-[#d92d20]">{item.offset} / {item.value}</div><div className="mt-1 text-[13px] font-bold">{item.event}</div></div>)}</div>}
        </section>
        <aside className="p-5">
          <div className="text-[10px] font-extrabold text-[#687176]">PROJECTED IMPACT</div>
          <div className="mt-4 grid grid-cols-2 gap-px bg-[#d9dddf] border border-[#d9dddf]">
            <div className="bg-white p-4"><Users size={17} className="text-[#d97706]" /><div className="mt-2 text-2xl font-extrabold">{result?.affected_workers ?? "--"}</div><div className="text-[10px] text-[#687176]">WORKERS EXPOSED</div></div>
            <div className="bg-white p-4"><AlertOctagon size={17} className="text-[#d92d20]" /><div className="mt-2 text-2xl font-extrabold">{result ? `$${Math.round(result.estimated_loss_usd / 1000)}K` : "--"}</div><div className="text-[10px] text-[#687176]">ESTIMATED LOSS</div></div>
          </div>
          {result && <><div className="mt-6 text-[10px] font-extrabold text-[#687176]">EVACUATION ROUTE</div><div className="mt-2 flex flex-wrap items-center gap-2">{result.evacuation_route.map((item, index) => <span key={item} className="flex items-center gap-2 text-[11px] font-bold"><span className="badge safe">{item}</span>{index < result.evacuation_route.length - 1 && <ChevronRight size={13} />}</span>)}</div><div className="mt-6 border-l-4 border-[#d97706] bg-[#fff7e8] px-4 py-3 text-[12px] leading-5 font-semibold">{result.recommendation}</div></>}
        </aside>
      </div>
    </div>
  );
}

function ComplianceView() {
  const [question, setQuestion] = useState("Can maintenance continue while the hydrogen alarm is active?");
  const [response, setResponse] = useState<{ answer: string; citations: Array<{ title: string; page: number; excerpt: string }>; mode: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadState, setUploadState] = useState("");
  const ask = async () => { setBusy(true); try { setResponse(await api.query(question)); } finally { setBusy(false); } };
  const upload = async (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; setUploadState("Indexing..."); try { const result = await api.uploadDocument(file); setUploadState(`${result.pages} pages indexed`); } catch (error) { setUploadState(error instanceof Error ? error.message : "Upload failed"); } };
  return (
    <div className="content-view">
      <div className="mb-4"><div className="text-[10px] font-bold text-[#687176]">CONTROL ASSURANCE</div><h1 className="mt-1 mb-0 text-[24px] font-extrabold">Compliance intelligence</h1></div>
      <div className="view-split min-h-[520px]">
        <section className="border-r border-[#d9dddf] p-5">
          <label className="mb-2 block text-[10px] font-extrabold text-[#687176]" htmlFor="compliance-question">SAFETY QUESTION</label>
          <textarea id="compliance-question" className="form-textarea" value={question} onChange={(event) => setQuestion(event.target.value)} />
          <div className="mt-3 flex flex-wrap items-center gap-2"><button className="button-primary" onClick={() => void ask()} disabled={busy}>{busy ? <LoaderCircle size={14} className="animate-spin" /> : <FileSearch size={14} />} Check controls</button><label className="button-secondary cursor-pointer"><Upload size={14} /> Add PDF<input type="file" accept="application/pdf" className="hidden" onChange={upload} /></label>{uploadState && <span className="text-[11px] font-semibold text-[#687176]">{uploadState}</span>}</div>
          {response && <div className="mt-6 border-l-4 border-[#087e8b] bg-[#eef7f6] p-4"><div className="mb-2 flex items-center gap-2 text-[10px] font-extrabold text-[#155d64]"><Sparkles size={13} /> {response.mode.toUpperCase()} REASONING</div><p className="m-0 text-[13px] leading-6 font-semibold">{response.answer}</p></div>}
        </section>
        <aside>
          <div className="section-heading"><h2>Evidence citations</h2><span className="badge neutral">Page-level</span></div>
          {!response ? <div className="p-6 text-[12px] leading-5 text-[#687176]">Run a control check to retrieve permit and SOP evidence.</div> : response.citations.map((citation) => <div key={`${citation.title}-${citation.page}`} className="border-b border-[#e0e3e2] p-4"><div className="flex items-start justify-between gap-2"><div className="text-[12px] font-extrabold">{citation.title}</div><span className="badge neutral">P. {citation.page}</span></div><p className="mb-0 text-[11px] leading-5 text-[#626a70]">{citation.excerpt}</p></div>)}
        </aside>
      </div>
    </div>
  );
}

function AgentsView({ snapshot }: { snapshot: PlantSnapshot }) {
  return (
    <div className="content-view">
      <div className="mb-4"><div className="text-[10px] font-bold text-[#687176]">ORCHESTRATION TRACE</div><h1 className="mt-1 mb-0 text-[24px] font-extrabold">Agent activity</h1></div>
      <div className="view-split">
        <section className="border-r border-[#d9dddf]"><div className="section-heading"><h2>Eight-agent execution</h2><span className="badge safe">LangGraph</span></div><AgentRail agents={snapshot.agents} /></section>
        <aside className="p-5">
          <div className="text-[10px] font-extrabold text-[#687176]">CONTROL FLOW</div>
          {[{ name: "Perception", agents: "Sensors - Vision - Permits", color: "#087e8b" }, { name: "Reasoning", agents: "Risk - Prediction - Compliance", color: "#d97706" }, { name: "Action", agents: "Emergency - Simulation", color: "#d92d20" }].map((layer, index) => <div key={layer.name}><div className="mt-4 border-l-4 bg-[#f4f6f5] px-4 py-3" style={{ borderColor: layer.color }}><div className="text-[12px] font-extrabold">{layer.name} layer</div><div className="mt-1 text-[11px] text-[#687176]">{layer.agents}</div></div>{index < 2 && <div className="ml-7 h-6 border-l-2 border-dashed border-[#b9c0c3]" />}</div>)}
          <div className="mt-6 text-[10px] font-extrabold text-[#687176]">PROVIDER STATE</div>
          <div className="mt-2 flex items-center justify-between border-b border-[#e0e3e2] py-3 text-[12px]"><span>Safety decisions</span><span className="badge safe">Deterministic</span></div>
          <div className="flex items-center justify-between border-b border-[#e0e3e2] py-3 text-[12px]"><span>Narrative reasoning</span><span className="badge neutral">{snapshot.provider.reasoning}</span></div>
        </aside>
      </div>
    </div>
  );
}

export function SentinelApp() {
  const [activeTab, setActiveTab] = useState<TabId>("command");
  const { snapshot, connected, error, refresh, setSnapshot } = usePlantStream();
  const currentTab = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  const start = async () => { await api.startDemo(); };
  const reset = async () => { await api.resetDemo(); await refresh(); };
  const acknowledge = async (id: string) => { await api.acknowledge(id); setSnapshot((current) => current ? { ...current, incidents: current.incidents.map((item) => item.id === id ? { ...item, status: "acknowledged" } : item) } : current); };

  const view = useMemo(() => {
    if (!snapshot) return null;
    if (activeTab === "command") return <CommandView snapshot={snapshot} onStart={() => void start()} onReset={() => void reset()} />;
    if (activeTab === "twin") return <TwinView snapshot={snapshot} />;
    if (activeTab === "incidents") return <IncidentsView incidents={snapshot.incidents} onAcknowledge={(id) => void acknowledge(id)} />;
    if (activeTab === "memory") return <SafetyMemoryView risk={snapshot.risk.score} />;
    if (activeTab === "simulation") return <SimulationView />;
    if (activeTab === "compliance") return <ComplianceView />;
    return <AgentsView snapshot={snapshot} />;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, snapshot]);

  if (!snapshot) return error ? <main className="grid min-h-dvh place-items-center bg-[#f7f8f7]"><div className="text-center"><X className="mx-auto mb-3 text-[#d92d20]" /><div className="font-bold">Sentinel API unavailable</div><div className="mt-1 text-sm text-[#687176]">{error}</div><button className="button-primary mt-4" onClick={() => void refresh()}><RefreshCcw size={14} /> Retry</button></div></main> : <LoadingState />;

  return (
    <div className="sentinel-shell">
      <aside className="sidebar">
        <div className="flex h-[72px] items-center gap-3 border-b border-[#363c3f] px-4"><span className="brand-mark"><ShieldCheck size={20} /></span><div><div className="text-[15px] font-extrabold">SentinelAI</div><div className="text-[9px] font-semibold text-[#aeb5b8]">CHIEF SAFETY OFFICER</div></div></div>
        <nav className="flex-1 py-3" aria-label="Primary navigation">{tabs.map((tab) => { const Icon = tab.icon; return <button key={tab.id} className={`nav-button ${activeTab === tab.id ? "active" : ""}`} onClick={() => setActiveTab(tab.id)}><Icon size={16} />{tab.label}{tab.id === "incidents" && snapshot.incidents.some((item) => item.status === "active") && <span className="ml-auto h-2 w-2 rounded-full bg-[#ff554b]" />}</button>; })}</nav>
        <div className="border-t border-[#363c3f] p-4"><div className="mb-2 flex items-center gap-2 text-[11px] font-bold"><span className={`status-dot ${connected ? "live" : ""}`} /> {connected ? "Plant stream live" : "Reconnecting"}</div><div className="text-[10px] leading-4 text-[#9ea6aa]">Demo identity<br /><span className="text-[#e7e9e8]">A. Sharma - Safety Officer</span></div></div>
      </aside>
      <main className="main-shell">
        <header className="topbar">
          <div className="flex min-w-0 items-center gap-3"><currentTab.icon size={18} className="text-[#087e8b]" /><div><div className="truncate text-[14px] font-extrabold">{currentTab.label}</div><div className="plant-location text-[10px] font-semibold text-[#687176]">{snapshot.plant.name} - {snapshot.plant.location}</div></div></div>
          <div className="flex items-center gap-3"><span className={`badge ${snapshot.plant.status === "critical" ? "critical" : "safe"}`}>{snapshot.plant.status}</span><button className="icon-button" onClick={() => setActiveTab("incidents")} title="Notifications" aria-label="Notifications"><Bell size={16} />{snapshot.incidents.some((item) => item.status === "active") && <span className="absolute mt-[-22px] ml-[22px] h-2 w-2 rounded-full bg-[#d92d20]" />}</button></div>
        </header>
        <div className="command-strip"><VoiceCommand risk={snapshot.risk.score} onNavigate={(tab) => setActiveTab(tab as TabId)} /></div>
        <nav className="mobile-nav" aria-label="Mobile navigation">{tabs.slice(0, 5).map((tab) => { const Icon = tab.icon; return <button key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)} aria-label={tab.label} title={tab.label}><Icon size={19} /></button>; })}</nav>
        <div className="page-content">{view}</div>
      </main>
    </div>
  );
}
