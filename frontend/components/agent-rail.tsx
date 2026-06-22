import { AlertTriangle, Check, CircleDashed } from "lucide-react";

import type { AgentRun } from "@/lib/types";

export function AgentRail({ agents }: { agents: AgentRun[] }) {
  return (
    <div className="divide-y divide-[#e0e3e2]">
      {agents.map((agent) => {
        const attention = agent.status === "attention";
        return (
          <div key={agent.agent_id} className="grid grid-cols-[28px_1fr_auto] items-start gap-2 px-4 py-3">
            <span className={`mt-0.5 grid h-7 w-7 place-items-center rounded-[5px] ${attention ? "bg-[#ffe4e1] text-[#d92d20]" : agent.status === "idle" ? "bg-[#edf0f1] text-[#707a7f]" : "bg-[#e5f6ef] text-[#11845b]"}`}>
              {attention ? <AlertTriangle size={15} /> : agent.status === "idle" ? <CircleDashed size={15} /> : <Check size={15} />}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[12px] font-bold">{agent.name}</div>
              <div className="mt-1 text-[11px] leading-4 text-[#626a70]">{agent.message}</div>
            </div>
            <span className={`badge ${attention ? "critical" : agent.status === "idle" ? "neutral" : "safe"}`}>{agent.layer}</span>
          </div>
        );
      })}
    </div>
  );
}

