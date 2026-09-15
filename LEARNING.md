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

---

## Day 5: Ground Puzzles in Real Content (Sep 20, 2026)

### Key Learnings & Notes (Day 5):
- Wired RAG retrieval into `backend/grounded_generator.py` so generated puzzles derive directly from retrieved study material text chunks rather than generic knowledge.
- Implemented an automated reflection guardrail (`validate_puzzle_answerability`) that verifies whether generated solutions and clues exist within source study text.
- Re-used reflection-loop pattern to reject unanswerable puzzles prior to serving them to players in a room session.

---

## Day 6: Live Puzzle State Across Clients (Sep 21, 2026)

### Key Learnings & Notes (Day 6):
- Added `POST /api/rooms/submit-answer` endpoint in `backend/main.py` to evaluate puzzle solutions and update room puzzle chain progress.
- Implemented WebSocket `PUZZLE_SOLVED` and `FAILED_ATTEMPT` broadcasts across all clients connected to a room.
- Built **Optimistic UI Updates** in `frontend/src/App.tsx`: when a player clicks "Unlock Passcode", the puzzle instantly updates to solved state on the client before server response, and automatically reconciles/reverts if rejected.

---

## Day 7: Reflection Loop: Adaptive Difficulty (Sep 22, 2026)

### Key Learnings & Notes (Day 7):
- Implemented `ReflectionLoopAgent` in `backend/reflection_agent.py` to evaluate group performance (solve speed in seconds, failed attempt count).
- Formulated an **explainable rule critique engine**:
  - `High Failed Attempts (>=2) OR Solve Time > 67.5s` -> Lower difficulty to `EASY` with explicit reasoning.
  - `0 Failed Attempts AND Solve Time < 22.5s` -> Elevate difficulty to `HARD` with clean mastery log.
  - `Otherwise` -> Maintain optimal flow state difficulty at `MEDIUM`.
- Integrated reflection loop into `submit_answer` in `backend/main.py`, logging critique history directly into `room.reflection_log` for demo transparency.
- Tested and verified with `tests/test_reflection_agent.py`.

---

## Day 8: Adaptive Hints, Not Answers (Sep 23, 2026)

### Key Learnings & Notes (Day 8):
- Extended `ReflectionLoopAgent` in `backend/reflection_agent.py` to detect group **Stuck Signals**:
  - **Signal 1:** `failed_attempts >= 2` consecutive incorrect submissions.
  - **Signal 2:** `elapsed_seconds >= 45.0s` without puzzle unlock.
- Designed progressive, non-spoiler subtle hint synthesis (`HintTriggerResult`) that provides conceptual guidance rather than giving away solutions.
- Integrated stuck signal checks into live WebSocket broadcasts and answer submission handlers in `backend/main.py`.
- Automated test coverage provided by `tests/test_hints.py`.
