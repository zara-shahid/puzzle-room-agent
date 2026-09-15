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

---

## Day 2: Multiplayer Room State (Stretch Skill) (Sep 17, 2026)

### Stretch Skill Focus:
- Real-time in-memory multiplayer room management and event broadcasting over WebSockets.

### What broke and how it was fixed:
1. **Broken:** Generic client connection manager didn't separate connection connections by room ID, causing messages from client A in room X to broadcast to client B in room Y.
   - **Fix:** Refactored `ConnectionManager` into `RoomManager` with a `dict[str, Dict[str, WebSocket]]` mapping `room_code -> {user_id: websocket}`.
2. **Broken:** Race condition where client disconnected unexpectedly without sending a formal leave message, leaving orphan user presence in room state.
   - **Fix:** Wrapped WebSocket loop in `try...except WebSocketDisconnect` block that automatically triggers `leave_room` cleanup and broadcasts the updated room state to remaining participants.
3. **Broken:** Client lost session state on browser refresh.
   - **Fix:** Persisted `userId`, `username`, and `roomCode` in browser `sessionStorage` so refreshing re-establishes the WebSocket session cleanly.

---

## Day 3: Structured Puzzle Schema & Generator (Sep 18, 2026)

### Key Learnings & Notes (Day 3):
- Designed comprehensive Pydantic models for four distinct puzzle categories in `backend/schemas.py`:
  - `RiddlePuzzle`
  - `CodeLockPuzzle`
  - `LogicGridPuzzle`
  - `HiddenCluePuzzle`
- Built single-agent structured puzzle chain generator in `backend/generator.py`.
- Automated schema validation and quality verification using `tests/test_generator.py` on the sample study topic *"Quantum Computing"*.

---

## Day 4: RAG over Study Material (Sep 19, 2026)

### Key Learnings & Notes (Day 4):
- Created study material vector RAG pipeline in `backend/rag.py` using character text chunking and vector embedding search.
- Added hybrid keyword-density boosting to vector similarity scores to ensure precision retrieval on domain-specific study terms (e.g. *glycolysis*, *photosynthesis*, *chloroplasts*).
- Validated text chunking and query accuracy with automated test suite `tests/test_rag.py`.
