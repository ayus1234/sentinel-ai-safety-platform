"use client";

import { FormEvent, useState } from "react";
import { Mic, Send, Volume2 } from "lucide-react";

interface SpeechRecognitionEventLike extends Event {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  start(): void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

export function VoiceCommand({ risk, onNavigate }: { risk: number; onNavigate: (tab: string) => void }) {
  const [value, setValue] = useState("");
  const [answer, setAnswer] = useState("");
  const [listening, setListening] = useState(false);

  const respond = (question: string) => {
    const normalized = question.toLowerCase();
    let response = "Zone 3 is currently the highest-risk area. All other zones remain within operating limits.";
    if (normalized.includes("highest risk") || normalized.includes("zone")) {
      response = risk >= 90
        ? "Zone 3. Hydrogen concentration increased 28 percent. Hot work overlaps with a worker missing required PPE. Explosion risk is 97 percent."
        : `Zone 3 is highest at ${risk} percent. No critical incident is active.`;
    } else if (normalized.includes("simulate") || normalized.includes("pump")) {
      response = "Opening the Pump 7 failure simulation.";
      onNavigate("simulation");
    } else if (normalized.includes("incident")) {
      response = "Opening the incident command view.";
      onNavigate("incidents");
    }
    setAnswer(response);
    if ("speechSynthesis" in window && "SpeechSynthesisUtterance" in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new window.SpeechSynthesisUtterance(response));
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!value.trim()) return;
    respond(value.trim());
    setValue("");
  };

  const listen = () => {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setAnswer("Voice recognition is unavailable in this browser. Type a command instead.");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setValue(transcript);
      setListening(false);
      respond(transcript);
    };
    recognition.onerror = () => setListening(false);
    setListening(true);
    recognition.start();
  };

  return (
    <div className={`voice-command ${answer ? "with-answer" : ""}`}>
      <form className="command-dock" onSubmit={submit}>
        <button type="button" className="icon-button" aria-label="Start voice command" title="Voice command" onClick={listen}>
          <Mic size={17} className={listening ? "text-[#62d0bd]" : ""} />
        </button>
        <input value={value} onChange={(event) => setValue(event.target.value)} aria-label="Ask SentinelAI" placeholder="Ask SentinelAI about plant risk..." />
        <button type="submit" className="icon-button" aria-label="Send command" title="Send command"><Send size={17} /></button>
      </form>
      {answer && (
        <div className="voice-answer">
          <div className="mb-1 flex items-center gap-2 font-bold"><Volume2 size={14} className="text-[#087e8b]" /> SentinelAI</div>
          {answer}
        </div>
      )}
    </div>
  );
}
