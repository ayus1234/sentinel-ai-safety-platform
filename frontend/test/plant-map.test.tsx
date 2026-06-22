import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PlantMap } from "@/components/plant-map";

describe("PlantMap", () => {
  it("renders zones, equipment, and a critical evacuation route", () => {
    render(
      <PlantMap
        risk={97}
        zones={[{ id: "ZONE-3", name: "Hydrogen Processing", risk: 97, x: 68, y: 12, w: 27, h: 42 }]}
        equipment={[{ id: "BOILER-4", name: "Boiler 4", zone_id: "ZONE-3", x: 78, y: 29, status: "warning" }]}
      />,
    );
    expect(screen.getByLabelText("Interactive plant digital twin and risk heatmap")).toBeInTheDocument();
    expect(screen.getByText("Hydrogen Processing")).toBeInTheDocument();
    expect(screen.getByText("MUSTER A")).toBeInTheDocument();
  });
});

