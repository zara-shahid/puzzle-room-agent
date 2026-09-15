import secrets
from typing import Dict, List, Optional
from pydantic import BaseModel
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from backend.schemas import DifficultyLevel
from backend.rag import StudyMaterialRAG
from backend.grounded_generator import GroundedPuzzleGenerator
from backend.reflection_agent import ReflectionLoopAgent, DifficultyCritique

app = FastAPI(title="The Puzzle Room Agent API", version="0.7.0")

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

class Room(BaseModel):
    room_code: str
    host_id: str
    topic: str = "General Knowledge"
    difficulty: DifficultyLevel = DifficultyLevel.MEDIUM
    users: Dict[str, User] = {}
    puzzles: List[PuzzleState] = []
    current_puzzle_index: int = 0
    reflection_log: List[dict] = []

class CreateRoomRequest(BaseModel):
    username: str
    topic: Optional[str] = "Cellular Biology"
    study_text: Optional[str] = None

class JoinRoomRequest(BaseModel):
    room_code: str
    username: str

class SubmitAnswerRequest(BaseModel):
    room_code: str
    user_id: str
    puzzle_id: str
    answer: str

# --- In-Memory State & Connection Manager ---
rooms: Dict[str, Room] = {}
rag = StudyMaterialRAG()
generator = GroundedPuzzleGenerator(rag=rag)
reflection_agent = ReflectionLoopAgent(target_solve_time_sec=45.0, max_allowed_failures=2)

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
                await connection.send_json(message)

room_manager = RoomManager()

# --- REST Endpoints ---
@app.post("/api/rooms/create")
def create_room(req: CreateRoomRequest):
    import time
    user_id = f"usr_{secrets.token_hex(4)}"
    room_code = secrets.token_hex(3).upper()
    
    user = User(user_id=user_id, username=req.username)
    
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
            start_time=now if idx == 0 else 0.0
        ))

    new_room = Room(
        room_code=room_code,
        host_id=user_id,
        topic=req.topic or "Cellular Biology",
        difficulty=DifficultyLevel.MEDIUM,
        users={user_id: user},
        puzzles=puzzle_states,
        current_puzzle_index=0,
        reflection_log=[]
    )
    rooms[room_code] = new_room

    return {
        "room_code": room_code,
        "user_id": user_id,
        "username": req.username,
        "is_host": True
    }

@app.post("/api/rooms/join")
def join_room(req: JoinRoomRequest):
    room_code = req.room_code.upper()
    if room_code not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")

    user_id = f"usr_{secrets.token_hex(4)}"
    user = User(user_id=user_id, username=req.username)
    rooms[room_code].users[user_id] = user

    return {
        "room_code": room_code,
        "user_id": user_id,
        "username": req.username,
        "is_host": False
    }

@app.post("/api/rooms/submit-answer")
async def submit_answer(req: SubmitAnswerRequest):
    import time
    room_code = req.room_code.upper()
    if room_code not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = rooms[room_code]
    user = room.users.get(req.user_id)
    if not user:
        raise HTTPException(status_code=403, detail="User not in room")

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

        # Trigger Explainable Reflection Critique for adaptive difficulty on upcoming puzzles
        critique = reflection_agent.critique_group_performance(
            current_difficulty=room.difficulty,
            solve_time_seconds=solve_duration,
            failed_attempts=target_puzzle.failed_attempts
        )
        room.difficulty = critique.recommended_difficulty
        room.reflection_log.append(critique.dict())

        # Advance puzzle index & set start_time for next puzzle
        if room.current_puzzle_index < len(room.puzzles) - 1:
            room.current_puzzle_index += 1
            room.puzzles[room.current_puzzle_index].start_time = now

        await room_manager.broadcast_to_room(room_code, {
            "type": "PUZZLE_SOLVED",
            "puzzle_id": req.puzzle_id,
            "solved_by": user.username,
            "critique": critique.dict(),
            "room_state": room.dict()
        })
        return {"status": "correct", "message": "Puzzle unlocked!", "critique": critique.dict()}
    else:
        target_puzzle.failed_attempts += 1
        await room_manager.broadcast_to_room(room_code, {
            "type": "FAILED_ATTEMPT",
            "puzzle_id": req.puzzle_id,
            "submitted_by": user.username,
            "failed_attempts": target_puzzle.failed_attempts
        })
        return {"status": "incorrect", "message": "Incorrect answer. Try again!"}

# --- Real-Time WebSocket Synchronization Endpoint ---
@app.websocket("/ws/room/{room_code}/{user_id}")
async def room_websocket(websocket: WebSocket, room_code: str, user_id: str):
    room_code = room_code.upper()
    if room_code not in rooms or user_id not in rooms[room_code].users:
        await websocket.close(code=4000)
        return

    await room_manager.connect(room_code, user_id, websocket)

    joining_user = rooms[room_code].users[user_id]
    await room_manager.broadcast_to_room(room_code, {
        "type": "USER_JOINED",
        "user": joining_user.dict(),
        "room_state": rooms[room_code].dict()
    })

    try:
        while True:
            data = await websocket.receive_json()
            event_type = data.get("type")
            
            if event_type == "CHAT_MESSAGE":
                await room_manager.broadcast_to_room(room_code, {
                    "type": "CHAT_MESSAGE",
                    "sender": joining_user.username,
                    "text": data.get("text")
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
                    "room_state": rooms[room_code].dict()
                })
