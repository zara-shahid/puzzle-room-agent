# LEARNING.md - The Puzzle Room Agent Development Log

## Day 1: Project Skeleton & WebSocket Spike (Sep 16, 2026)

### What I know going in:
- Basic Python (FastAPI, Pydantic) and React/TypeScript development patterns.
- Basic principles of WebSockets for bi-directional real-time communication.
- General AI/LLM concepts and basic RAG pipeline theory.

### What I expect to be hardest:
1. **Real-time State Synchronization:** Ensuring smooth, conflict-free state sync across multiple WebSocket clients (Day 2 & Day 6).
2. **Adaptive Reflection Loop:** Designing a deterministic and reliable reflection loop (Day 7 & Day 8) that critiques difficulty and provides non-spoiler hints based on player metrics.
3. **Structured & Grounded Puzzle Generation:** Ensuring LLM outputs strictly follow schemas and are verifiable against ingested RAG context (Day 3 & Day 5).

### Key Learnings & Notes (Day 1):
- Scaffolded FastAPI backend with Uvicorn and WebSocket endpoint `/ws/{client_id}`.
- Scaffolded React + TypeScript + Vite frontend with Tailwind CSS styling.
- Created live WebSocket connection spike to confirm real-time bi-directional message echo/broadcast functionality.
