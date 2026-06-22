"use client";

import { useState } from "react";

import type { Equipment, Zone } from "@/lib/types";

const zoneColors = (risk: number) => {
  if (risk >= 90) return { fill: "#f8cbc6", stroke: "#d92d20", text: "#8f1f17" };
  if (risk >= 55) return { fill: "#ffe1ad", stroke: "#d97706", text: "#854800" };
  if (risk >= 25) return { fill: "#dceceb", stroke: "#087e8b", text: "#155d64" };
  return { fill: "#dceee6", stroke: "#11845b", text: "#0b6446" };
};

export function PlantMap({ zones, equipment, risk }: { zones: Zone[]; equipment: Equipment[]; risk: number }) {
  const [selected, setSelected] = useState("ZONE-3");
  return (
    <div className="map-stage" data-testid="plant-map">
      <svg viewBox="0 0 1000 620" role="img" aria-label="Interactive plant digital twin and risk heatmap">
        <defs>
          <pattern id="floorDots" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="#cbd1ce" />
          </pattern>
        </defs>
        <path d="M42 74 L900 32 L962 522 L96 576 Z" fill="url(#floorDots)" stroke="#c8cecb" strokeWidth="2" />
        {zones.map((zone) => {
          const color = zoneColors(zone.risk);
          const x = zone.x * 9.2;
          const y = zone.y * 5.3;
          const w = zone.w * 8.6;
          const h = zone.h * 4.8;
          return (
            <g key={zone.id} onClick={() => setSelected(zone.id)} role="button" tabIndex={0} aria-label={`${zone.name}, risk ${zone.risk}%`}>
              <rect
                className={`zone-shape ${selected === zone.id ? "selected" : ""}`}
                x={x}
                y={y}
                width={w}
                height={h}
                rx="4"
                fill={color.fill}
                stroke={color.stroke}
                strokeWidth="2"
                opacity={selected === zone.id ? 0.96 : 0.78}
                transform={`skewY(-2)`}
              />
              <text x={x + 14} y={y + 26} fill={color.text} fontSize="14" fontWeight="800">{zone.name}</text>
              <text x={x + 14} y={y + 46} fill={color.text} fontSize="11" fontWeight="700">RISK {zone.risk}%</text>
            </g>
          );
        })}
        <g stroke="#7a8387" strokeWidth="8" opacity="0.7">
          <path d="M110 350 L410 340 L490 440 L845 420" fill="none" />
          <path d="M440 80 L455 520" fill="none" />
        </g>
        {equipment.map((item) => {
          const x = item.x * 9.2;
          const y = item.y * 5.3;
          const alert = item.status !== "normal" || (item.zone_id === "ZONE-3" && risk >= 42);
          return (
            <g key={item.id} transform={`translate(${x} ${y})`}>
              {alert && <circle r="23" fill="none" stroke="#d92d20" strokeWidth="2" opacity="0.5" />}
              <rect x="-12" y="-12" width="24" height="24" rx="3" fill={alert ? "#d92d20" : "#202427"} />
              <circle cx="0" cy="0" r="5" fill="#fff" />
              <text x="18" y="4" fill="#202427" fontSize="11" fontWeight="800">{item.name}</text>
            </g>
          );
        })}
        {risk >= 78 && (
          <g>
            <circle cx="770" cy="195" r="9" fill="#d92d20" stroke="#fff" strokeWidth="3" />
            <text x="785" y="200" fill="#8f1f17" fontSize="11" fontWeight="800">WORKER-17</text>
          </g>
        )}
        {risk >= 97 && (
          <g>
            <path d="M770 195 C720 240 690 310 610 352 S430 440 310 510" fill="none" stroke="#d92d20" strokeWidth="6" strokeDasharray="12 8" />
            <circle cx="310" cy="510" r="15" fill="#11845b" stroke="#fff" strokeWidth="4" />
            <text x="335" y="515" fill="#0b6446" fontSize="13" fontWeight="800">MUSTER A</text>
          </g>
        )}
      </svg>
      <div className="absolute left-4 bottom-4 flex gap-2 text-[10px] font-bold">
        <span className="badge safe">Normal</span>
        <span className="badge warning">Elevated</span>
        <span className="badge critical">Critical</span>
      </div>
    </div>
  );
}

