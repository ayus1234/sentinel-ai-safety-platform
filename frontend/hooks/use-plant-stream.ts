"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { api, WS_URL } from "@/lib/api";
import type { Incident, PlantSnapshot, TelemetryPoint } from "@/lib/types";

export function usePlantStream() {
  const [snapshot, setSnapshot] = useState<PlantSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSnapshot(await api.bootstrap());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backend unavailable");
    }
  }, []);

  useEffect(() => {
    void refresh();
    let active = true;
    let socket: WebSocket | null = null;

    const connect = () => {
      socket = new WebSocket(WS_URL);
      socket.onopen = () => setConnected(true);
      socket.onclose = () => {
        setConnected(false);
        if (active) reconnectTimer.current = setTimeout(connect, 1500);
      };
      socket.onerror = () => socket?.close();
      socket.onmessage = (message) => {
        const event = JSON.parse(message.data) as { type: string; payload: Record<string, unknown> };
        if (event.type === "bootstrap" || event.type === "reset") {
          setSnapshot(event.payload as unknown as PlantSnapshot);
          return;
        }
        setSnapshot((current) => {
          if (!current) return current;
          if (event.type === "telemetry") {
            const point = event.payload.point as unknown as TelemetryPoint;
            return { ...current, telemetry: [...current.telemetry, point].slice(-45) };
          }
          if (event.type === "evidence") {
            const risk = event.payload.risk as unknown as PlantSnapshot["risk"];
            const agents = event.payload.agents as unknown as PlantSnapshot["agents"];
            return {
              ...current,
              risk,
              agents,
              scenario: { running: true, step: Number(event.payload.step) },
              zones: current.zones.map((zone) => (zone.id === "ZONE-3" ? { ...zone, risk: risk.score } : zone)),
            };
          }
          if (event.type === "incident") {
            const incident = event.payload as unknown as Incident;
            return { ...current, incidents: [incident, ...current.incidents], plant: { ...current.plant, status: "critical" } };
          }
          if (event.type === "incident_acknowledged") {
            const incident = event.payload as unknown as Incident;
            return { ...current, incidents: current.incidents.map((item) => (item.id === incident.id ? incident : item)) };
          }
          if (event.type === "scenario") {
            return { ...current, scenario: { running: Boolean(event.payload.running), step: Number(event.payload.step) } };
          }
          return current;
        });
      };
    };
    connect();
    return () => {
      active = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      socket?.close();
    };
  }, [refresh]);

  return { snapshot, connected, error, refresh, setSnapshot };
}

