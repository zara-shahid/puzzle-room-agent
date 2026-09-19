import secrets
import time
import asyncio
from typing import Dict, List, Optional, Literal
from pydantic import BaseModel
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from backend.schemas import DifficultyLevel
from backend.rag import StudyMaterialRAG
from backend.grounded_generator import GroundedPuzzleGenerator
from backend.reflection_agent import ReflectionLoopAgent, DifficultyCritique

app = FastAPI(title="The Puzzle Room Agent API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Data Models ---
class User(BaseModel):
    user_id: str
    username: str
    role: Literal["player", "spectator"] = "player"

class PuzzleState(BaseModel):
    id: str
    title: str
    puzzle_type: str
    riddle_text: Optional[str] = None
    problem_statement: Optional[str] = None
    clues: Optional[List[str]] = None
    passage: Optional[str] = None
    prompt: Optional[str] = None
    hint: str
    solution: str
    solved: bool = False
    solved_by: Optional[str] = None
    start_time: float = 0.0
    solve_time_seconds: Optional[float] = None
    failed_attempts: int = 0
    lore_entry: Optional[str] = None

class Room(BaseModel):
    room_code: str
    host_id: str
    topic: str = "General Knowledge"
    difficulty: DifficultyLevel = DifficultyLevel.MEDIUM
    mode: Literal["cooperative", "competitive"] = "cooperative"
    users: Dict[str, User] = {}
    puzzles: List[PuzzleState] = []
    current_puzzle_index: int = 0
    reflection_log: List[dict] = []
    # Competitive mode fields
    teams: Dict[str, List[str]] = {}          # team_id -> list of user_ids
    team_scores: Dict[str, int] = {}          # team_id -> score
    # Voting fields (puzzle_id -> {user_id -> vote})
    puzzle_votes: Dict[str, Dict[str, str]] = {}
    # Replay timeline
    solve_timeline: List[dict] = []

class CreateRoomRequest(BaseModel):
    username: str
    topic: Optional[str] = "Cellular Biology"
    study_text: Optional[str] = None
    mode: Optional[Literal["cooperative", "competitive"]] = "cooperative"

class JoinRoomRequest(BaseModel):
    room_code: str
    username: str
    role: Optional[Literal["player", "spectator"]] = "player"

class AssignTeamRequest(BaseModel):
    room_code: str
    user_id: str
    team_id: Literal["team_a", "team_b"]

class SubmitAnswerRequest(BaseModel):
    room_code: str
    user_id: str
    puzzle_id: str
    answer: str

class VoteDifficultyRequest(BaseModel):
    room_code: str
    user_id: str
    puzzle_id: str
    vote: Literal["easy", "medium", "hard"]

# --- In-Memory State & Connection Manager ---
rooms: Dict[str, Room] = {}
rag = StudyMaterialRAG()
generator = GroundedPuzzleGenerator(rag=rag)
reflection_agent = ReflectionLoopAgent(target_solve_time_sec=45.0, max_allowed_failures=2)

# Pending vote timers: puzzle_id -> asyncio Task
_vote_timers: Dict[str, asyncio.Task] = {}

class RoomManager:
    def __init__(self):
        self.active_rooms: Dict[str, Dict[str, WebSocket]] = {}

    async def connect(self, room_code: str, user_id: str, websocket: WebSocket):
        await websocket.accept()
        if room_code not in self.active_rooms:
            self.active_rooms[room_code] = {}
        self.active_rooms[room_code][user_id] = websocket

    def disconnect(self, room_code: str, user_id: str):
        if room_code in self.active_rooms and user_id in self.active_rooms[room_code]:
            del self.active_rooms[room_code][user_id]
            if not self.active_rooms[room_code]:
                del self.active_rooms[room_code]

    async def broadcast_to_room(self, room_code: str, message: dict):
        if room_code in self.active_rooms:
            for connection in self.active_rooms[room_code].values():
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

room_manager = RoomManager()

# --- Helpers ---
def _get_player_count(room: Room) -> int:
    return sum(1 for u in room.users.values() if u.role == "player")

def _get_spectator_count(room: Room) -> int:
    return sum(1 for u in room.users.values() if u.role == "spectator")

def _tally_votes(votes: Dict[str, str]) -> str:
    """Return majority vote; ties prefer medium."""
    counts = {"easy": 0, "medium": 0, "hard": 0}
    for v in votes.values():
        if v in counts:
            counts[v] += 1
    return max(counts, key=lambda k: (counts[k], k == "medium"))

def _merge_difficulty(ai_rec: str, player_vote: str) -> DifficultyLevel:
    """50/50 weighted merge. If same, return it; otherwise use simple rule."""
    order = {"easy": 0, "medium": 1, "hard": 2}
    avg = (order.get(ai_rec, 1) + order.get(player_vote, 1)) / 2
    if avg < 0.75:
        return DifficultyLevel.EASY
    elif avg > 1.25:
        return DifficultyLevel.HARD
    return DifficultyLevel.MEDIUM

async def _finalize_vote(room_code: str, puzzle_id: str, ai_rec: str):
    """Called after 8 seconds or when all players voted."""
    await asyncio.sleep(8)
    if room_code not in rooms:
        return
    room = rooms[room_code]
    votes = room.puzzle_votes.get(puzzle_id, {})
    if not votes:
        return
    player_vote = _tally_votes(votes)
    new_difficulty = _merge_difficulty(ai_rec, player_vote)
    room.difficulty = new_difficulty
    await room_manager.broadcast_to_room(room_code, {
        "type": "VOTE_RESULT",
        "puzzle_id": puzzle_id,
        "votes": votes,
        "player_vote_tally": player_vote,
        "ai_recommendation": ai_rec,
        "final_difficulty": new_difficulty.value,
    })

# --- REST Endpoints ---
@app.post("/api/rooms/create")
def create_room(req: CreateRoomRequest):
    user_id = f"usr_{secrets.token_hex(4)}"
    room_code = secrets.token_hex(3).upper()

    user = User(user_id=user_id, username=req.username, role="player")

    study_text = req.study_text or "Cellular respiration produces ATP energy inside mitochondria."
    generated_chain = generator.generate_grounded_chain(
        topic=req.topic or "Cellular Biology",
        study_text=study_text,
        difficulty=DifficultyLevel.MEDIUM
    )

    now = time.time()
    puzzle_states: List[PuzzleState] = []
    for idx, p in enumerate(generated_chain.puzzles):
        p_dict = p.model_dump()
        solution_str = str(p_dict.get("solution") or p_dict.get("passcode") or p_dict.get("target_keyword") or "SOLVED")
        puzzle_states.append(PuzzleState(
            id=p_dict["id"],
            title=p_dict["title"],
            puzzle_type=p_dict["puzzle_type"],
            riddle_text=p_dict.get("riddle_text"),
            problem_statement=p_dict.get("problem_statement"),
            clues=p_dict.get("clues"),
            passage=p_dict.get("passage"),
            prompt=p_dict.get("prompt"),
            hint=p_dict["hint"],
            solution=solution_str,
            solved=False,
            start_time=now if idx == 0 else 0.0,
            lore_entry=p_dict.get("lore_entry"),
        ))

    # Initialize teams for competitive mode
    teams: Dict[str, List[str]] = {}
    team_scores: Dict[str, int] = {}
    if req.mode == "competitive":
        teams = {"team_a": [user_id], "team_b": []}
        team_scores = {"team_a": 0, "team_b": 0}

    new_room = Room(
        room_code=room_code,
        host_id=user_id,
        topic=req.topic or "Cellular Biology",
        difficulty=DifficultyLevel.MEDIUM,
        mode=req.mode or "cooperative",
        users={user_id: user},
        puzzles=puzzle_states,
        current_puzzle_index=0,
        reflection_log=[],
        teams=teams,
        team_scores=team_scores,
    )
    rooms[room_code] = new_room

    return {
        "room_code": room_code,
        "user_id": user_id,
        "username": req.username,
        "is_host": True,
        "mode": new_room.mode,
    }


@app.post("/api/rooms/join")
def join_room(req: JoinRoomRequest):
    room_code = req.room_code.upper()
    if room_code not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")

    user_id = f"usr_{secrets.token_hex(4)}"
    role = req.role or "player"
    user = User(user_id=user_id, username=req.username, role=role)
    rooms[room_code].users[user_id] = user

    return {
        "room_code": room_code,
        "user_id": user_id,
        "username": req.username,
        "is_host": False,
        "role": role,
        "mode": rooms[room_code].mode,
    }


@app.post("/api/rooms/assign-team")
def assign_team(req: AssignTeamRequest):
    room_code = req.room_code.upper()
    if room_code not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    room = rooms[room_code]
    if room.mode != "competitive":
        raise HTTPException(status_code=400, detail="Room is not in competitive mode")
    if req.user_id not in room.users:
        raise HTTPException(status_code=403, detail="User not in room")

    # Remove from any existing team
    for t in room.teams.values():
        if req.user_id in t:
            t.remove(req.user_id)

    room.teams.setdefault(req.team_id, []).append(req.user_id)
    return {"status": "ok", "team": req.team_id, "teams": room.teams}


@app.post("/api/rooms/vote-difficulty")
async def vote_difficulty(req: VoteDifficultyRequest):
    room_code = req.room_code.upper()
    if room_code not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    room = rooms[room_code]
    user = room.users.get(req.user_id)
    if not user or user.role != "player":
        raise HTTPException(status_code=403, detail="Only players can vote")

    if req.puzzle_id not in room.puzzle_votes:
        room.puzzle_votes[req.puzzle_id] = {}
    room.puzzle_votes[req.puzzle_id][req.user_id] = req.vote

    votes = room.puzzle_votes[req.puzzle_id]
    player_count = _get_player_count(room)

    await room_manager.broadcast_to_room(room_code, {
        "type": "VOTE_UPDATE",
        "puzzle_id": req.puzzle_id,
        "votes": votes,
        "player_count": player_count,
    })

    # If everyone has voted, cancel the timer and finalize immediately
    if len(votes) >= player_count:
        timer_key = f"{room_code}_{req.puzzle_id}"
        if timer_key in _vote_timers and not _vote_timers[timer_key].done():
            _vote_timers[timer_key].cancel()
        # Get last AI recommendation from reflection log
        ai_rec = room.reflection_log[-1].get("recommended_difficulty", "medium") if room.reflection_log else "medium"
        player_vote = _tally_votes(votes)
        new_difficulty = _merge_difficulty(ai_rec, player_vote)
        room.difficulty = new_difficulty
        await room_manager.broadcast_to_room(room_code, {
            "type": "VOTE_RESULT",
            "puzzle_id": req.puzzle_id,
            "votes": votes,
            "player_vote_tally": player_vote,
            "ai_recommendation": ai_rec,
            "final_difficulty": new_difficulty.value,
        })

    return {"status": "voted", "votes": votes}


@app.get("/api/rooms/{room_code}/summary")
def get_room_summary(room_code: str):
    from backend.summary_analyzer import SessionSummaryAnalyzer
    room_code = room_code.upper()
    if room_code not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")

    room = rooms[room_code]
    analyzer = SessionSummaryAnalyzer()

    puzzles_data = [p.dict() for p in room.puzzles]
    report = analyzer.generate_summary_report(
        room_code=room.room_code,
        topic=room.topic,
        puzzles=puzzles_data
    )
    return report.dict()


@app.get("/api/rooms/{room_code}/replay")
def get_room_replay(room_code: str):
    room_code = room_code.upper()
    if room_code not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    room = rooms[room_code]
    return {
        "room_code": room_code,
        "topic": room.topic,
        "mode": room.mode,
        "team_scores": room.team_scores,
        "solve_timeline": room.solve_timeline,
        "puzzles": [
            {
                "id": p.id,
                "title": p.title,
                "puzzle_type": p.puzzle_type,
                "solved": p.solved,
                "solved_by": p.solved_by,
                "solve_time_seconds": p.solve_time_seconds,
                "failed_attempts": p.failed_attempts,
                "lore_entry": p.lore_entry,
            }
            for p in room.puzzles
        ],
    }


@app.post("/api/rooms/submit-answer")
async def submit_answer(req: SubmitAnswerRequest):
    room_code = req.room_code.upper()
    if room_code not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")

    room = rooms[room_code]
    user = room.users.get(req.user_id)
    if not user:
        raise HTTPException(status_code=403, detail="User not in room")
    if user.role == "spectator":
        raise HTTPException(status_code=403, detail="Spectators cannot submit answers")

    target_puzzle = next((p for p in room.puzzles if p.id == req.puzzle_id), None)
    if not target_puzzle:
        raise HTTPException(status_code=404, detail="Puzzle not found")

    is_correct = req.answer.strip().lower() == target_puzzle.solution.strip().lower()

    if is_correct:
        now = time.time()
        target_puzzle.solved = True
        target_puzzle.solved_by = user.username
        solve_duration = now - (target_puzzle.start_time or now)
        target_puzzle.solve_time_seconds = solve_duration

        # Record replay timeline event
        room.solve_timeline.append({
            "puzzle_id": target_puzzle.id,
            "puzzle_title": target_puzzle.title,
            "solved_by": user.username,
            "solve_time_seconds": solve_duration,
            "failed_attempts": target_puzzle.failed_attempts,
            "timestamp": now,
        })

        # Competitive scoring
        solver_team = None
        speed_bonus = 50 if solve_duration < 30 else 0
        points = 100 + speed_bonus
        for team_id, members in room.teams.items():
            if req.user_id in members:
                solver_team = team_id
                room.team_scores[team_id] = room.team_scores.get(team_id, 0) + points
                break

        # AI Reflection critique
        critique = reflection_agent.critique_group_performance(
            current_difficulty=room.difficulty,
            solve_time_seconds=solve_duration,
            failed_attempts=target_puzzle.failed_attempts
        )
        room.reflection_log.append(critique.dict())

        # Advance puzzle index & set start_time for next puzzle
        if room.current_puzzle_index < len(room.puzzles) - 1:
            room.current_puzzle_index += 1
            room.puzzles[room.current_puzzle_index].start_time = now

        broadcast_payload = {
            "type": "PUZZLE_SOLVED",
            "puzzle_id": req.puzzle_id,
            "solved_by": user.username,
            "solver_team": solver_team,
            "team_scores": room.team_scores,
            "points_awarded": points if solver_team else 0,
            "critique": critique.dict(),
            "lore_entry": target_puzzle.lore_entry,
            "spectator_count": _get_spectator_count(room),
            "room_state": room.dict(),
        }

        # Start difficulty-vote timer (8s) after puzzle solve
        ai_rec = critique.recommended_difficulty.value if hasattr(critique.recommended_difficulty, "value") else str(critique.recommended_difficulty)
        timer_key = f"{room_code}_{req.puzzle_id}"
        loop = asyncio.get_event_loop()
        task = loop.create_task(_finalize_vote(room_code, req.puzzle_id, ai_rec))
        _vote_timers[timer_key] = task

        await room_manager.broadcast_to_room(room_code, broadcast_payload)
        return {"status": "correct", "message": "Puzzle unlocked!", "critique": critique.dict()}

    else:
        target_puzzle.failed_attempts += 1

        elapsed = time.time() - (target_puzzle.start_time or time.time())
        stuck_check = reflection_agent.check_stuck_signal(
            failed_attempts=target_puzzle.failed_attempts,
            elapsed_seconds=elapsed,
            base_hint=target_puzzle.hint
        )

        await room_manager.broadcast_to_room(room_code, {
            "type": "FAILED_ATTEMPT",
            "puzzle_id": req.puzzle_id,
            "submitted_by": user.username,
            "failed_attempts": target_puzzle.failed_attempts,
            "stuck_signal": stuck_check.dict() if stuck_check.is_stuck else None,
        })
        return {
            "status": "incorrect",
            "message": "Incorrect answer. Try again!",
            "stuck_signal": stuck_check.dict() if stuck_check.is_stuck else None,
        }


# --- Real-Time WebSocket Synchronization Endpoint ---
@app.websocket("/ws/room/{room_code}/{user_id}")
async def room_websocket(websocket: WebSocket, room_code: str, user_id: str):
    room_code = room_code.upper()
    if room_code not in rooms or user_id not in rooms[room_code].users:
        await websocket.close(code=4000)
        return

    await room_manager.connect(room_code, user_id, websocket)

    joining_user = rooms[room_code].users[user_id]
    room = rooms[room_code]

    await room_manager.broadcast_to_room(room_code, {
        "type": "USER_JOINED",
        "user": joining_user.dict(),
        "room_state": room.dict(),
        "spectator_count": _get_spectator_count(room),
    })

    try:
        while True:
            data = await websocket.receive_json()
            event_type = data.get("type")

            if event_type == "CHAT_MESSAGE":
                # Spectators can chat
                await room_manager.broadcast_to_room(room_code, {
                    "type": "CHAT_MESSAGE",
                    "sender": joining_user.username,
                    "role": joining_user.role,
                    "text": data.get("text"),
                })

            elif event_type == "TYPING":
                await room_manager.broadcast_to_room(room_code, {
                    "type": "TYPING",
                    "user_id": user_id,
                    "username": joining_user.username,
                })

    except WebSocketDisconnect:
        room_manager.disconnect(room_code, user_id)
        if room_code in rooms:
            if user_id in rooms[room_code].users:
                del rooms[room_code].users[user_id]
            if not rooms[room_code].users:
                del rooms[room_code]
            else:
                if rooms[room_code].host_id == user_id:
                    rooms[room_code].host_id = next(iter(rooms[room_code].users.keys()))

                await room_manager.broadcast_to_room(room_code, {
                    "type": "USER_LEFT",
                    "user_id": user_id,
                    "username": joining_user.username,
                    "room_state": rooms[room_code].dict(),
                    "spectator_count": _get_spectator_count(rooms[room_code]),
                })
