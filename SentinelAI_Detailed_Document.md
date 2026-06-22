# SentinelAI: Autonomous Industrial Safety Intelligence Platform
**ET AI Hackathon 2.0 - Phase 2: Build Sprint Submission**

## 1. Executive Summary
SentinelAI is a local-first, multi-agent AI platform designed to act as an autonomous "Chief Safety Officer" for high-risk industrial environments. Rather than presenting passive dashboards, SentinelAI utilizes an 8-agent LangGraph architecture to continuously correlate telemetry, computer vision data, permit contexts, and safety rules to predict, detect, and respond to critical incidents in real-time.

## 2. The Problem
Industrial safety systems currently operate in silos. A gas leak is detected by a SCADA system, a worker without PPE is caught on a separate CCTV feed, and hot-work permits are buried in static PDF databases. Human operators struggle to correlate these isolated data points in real-time, often leading to catastrophic, preventable accidents. 

## 3. Our Solution: Multi-Agent Orchestration
SentinelAI bridges these silos through a highly deterministic multi-agent pipeline. The system translates isolated warnings into a single, unified "Explosion Risk Score" using the following agents:
1. **Sensor Intelligence Agent:** Monitors 1Hz WebSocket telemetry (hydrogen, pressure).
2. **Computer Vision Agent:** Analyzes real-time CCTV feeds for PPE violations and hazards.
3. **Permit Intelligence Agent:** Cross-references active maintenance work orders.
4. **Risk Correlation Agent:** Fuses inputs into a deterministic risk score.
5. **Incident Prediction Agent:** Simulates equipment failure consequences.
6. **Compliance Agent:** Uses RAG (Retrieval-Augmented Generation) powered by Gemini 2.5 to answer regulatory queries.
7. **Simulation Agent:** Runs "what-if" physics-based scenarios.
8. **Emergency Response Agent:** Automates zone evacuations and generates incident reports.

## 4. Key Features & Innovation
- **Deterministic Risk Engine:** Safety-critical decisions (e.g., sounding alarms) are strictly mathematical, avoiding LLM hallucinations.
- **Safety Memory (Knowledge Graph):** Relationships between workers, permits, sensors, and equipment are mapped in a local SQLite database, ready to scale to Neo4j.
- **Digital Twin Command Center:** A Next.js UI providing live spatial mapping of facility risks.
- **Gemini-Powered Compliance RAG:** Complex safety manuals are indexed via BM25 and synthesized by Gemini 2.5 Flash, providing operators with immediate, cited regulatory guidance.

## 5. Technical Architecture
- **Frontend:** Next.js 15, TailwindCSS, WebSockets.
- **API Gateway:** FastAPI (Python).
- **AI Orchestration:** LangGraph, Gemini 2.5 Flash.
- **Data Persistence:** SQLite (Knowledge Graph & Incident memory).


![Command Center Dashboard](frontend/public/command_center.png)
*(Include your Architecture Diagram from the README here before saving to PDF)*

## 6. Business Impact
SentinelAI transforms safety from reactive monitoring to proactive intelligence, significantly reducing the probability of industrial disasters, lowering insurance premiums, and ensuring rigorous regulatory compliance.
