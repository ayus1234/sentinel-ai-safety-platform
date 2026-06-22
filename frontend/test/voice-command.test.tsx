import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { VoiceCommand } from "@/components/voice-command";

describe("VoiceCommand", () => {
  it("supports typed commands when browser speech recognition is unavailable", () => {
    Object.defineProperty(window, "speechSynthesis", { value: { cancel: vi.fn(), speak: vi.fn() }, configurable: true });
    render(<VoiceCommand risk={97} onNavigate={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Ask SentinelAI"), { target: { value: "Show the highest risk area" } });
    fireEvent.click(screen.getByLabelText("Send command"));
    expect(screen.getByText(/Zone 3\. Hydrogen concentration increased 28 percent/)).toBeInTheDocument();
  });
});

