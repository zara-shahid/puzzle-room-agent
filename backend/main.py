import secrets
from typing import Dict, List, Optional
from pydantic import BaseModel
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="The Puzzle Room Agent API", version="0.2.0")

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

class Room(BaseModel):
    room_code: str
    host_id: str
    users: Dict[str, User] = {}

class CreateRoomRequest(BaseModel):
    username: str

class JoinRoomRequest(BaseModel):
    room_code: str
    username: str

# --- In-Memory State & Connection Manager ---
rooms: Dict[str, Room] = {}

class RoomManager:
    def __init__(self):
        # Mapping: room_code -> { user_id: WebSocket }
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

# --- REST Endpoints for Auth & Room Creation ---
@app.post("/api/rooms/create", response_model=dict)
def create_room(req: CreateRoomRequest):
    user_id = f"usr_{secrets.token_hex(4)}"
    room_code = secrets.token_hex(3).upper() # 6 char code
    
    user = User(user_id=user_id, username=req.username)
    new_room = Room(room_code=room_code, host_id=user_id, users={user_id: user})
    rooms[room_code] = new_room

    return {
        "room_code": room_code,
        "user_id": user_id,
        "username": req.username,
        "is_host": True
    }

@app.post("/api/rooms/join", response_model=dict)
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

@app.get("/api/rooms/{room_code}")
def get_room_details(room_code: str):
    room_code = room_code.upper()
    if room_code not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    return rooms[room_code].dict()

# --- Real-Time WebSocket Synchronization Endpoint ---
@app.websocket("/ws/room/{room_code}/{user_id}")
async def room_websocket(websocket: WebSocket, room_code: str, user_id: str):
    room_code = room_code.upper()
    if room_code not in rooms or user_id not in rooms[room_code].users:
        await websocket.close(code=4000)
        return

    await room_manager.connect(room_code, user_id, websocket)

    # Broadcast join event
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
            
            # If host left, reassign host or cleanup room if empty
            if not rooms[room_code].users:
                del rooms[room_code]
            else:
                if rooms[room_code].host_id == user_id:
                    rooms[room_code].host_id = next(iter(rooms[room_code].users.keys()))

                # Broadcast leave event
                await room_manager.broadcast_to_room(room_code, {
                    "type": "USER_LEFT",
                    "user_id": user_id,
                    "username": joining_user.username,
                    "room_state": rooms[room_code].dict()
                })
