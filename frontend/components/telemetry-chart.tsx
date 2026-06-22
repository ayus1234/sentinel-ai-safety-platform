"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { TelemetryPoint } from "@/lib/types";

export function TelemetryChart({ data }: { data: TelemetryPoint[] }) {
  const formatted = data.map((point) => ({ ...point, time: new Date(point.timestamp).toLocaleTimeString([], { minute: "2-digit", second: "2-digit" }) }));
  return (
    <div className="h-[238px] px-2 py-3" data-testid="telemetry-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formatted} margin={{ top: 8, right: 14, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="#e2e6e4" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#667076" }} tickLine={false} axisLine={false} minTickGap={28} />
          <YAxis tick={{ fontSize: 10, fill: "#667076" }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ borderRadius: 4, border: "1px solid #d9dddf", fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Line type="monotone" dataKey="hydrogen" name="H2 % LEL" stroke="#d92d20" strokeWidth={2.5} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="pressure" name="Pressure bar" stroke="#087e8b" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

