import React, { useState, useEffect, useRef } from 'react';

interface User {
  user_id: string;
  username: string;
}

interface RoomState {
  room_code: string;
  host_id: string;
  users: Record<string, User>;
}

interface ChatMessage {
  sender: string;
  text: string;
}

export function App() {
  // Auth / Session State
  const [username, setUsername] = useState('');
  const [roomInput, setRoomInput] = useState('');
  const [session, setSession] = useState<{
    roomCode: string;
    userId: string;
    username: string;
    isHost: boolean;
  } | null>(() => {
    const saved = sessionStorage.getItem('puzzle_room_session');
    return saved ? JSON.parse(saved) : null;
  });

  // Room & WebSocket State
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [chatLog, setChatLog] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Persistence handler
  useEffect(() => {
    if (session) {
      sessionStorage.setItem('puzzle_room_session', JSON.stringify(session));
    } else {
      sessionStorage.removeItem('puzzle_room_session');
    }
  }, [session]);

  // WebSocket Connection Lifecycle
  useEffect(() => {
    if (!session) return;

    const ws = new WebSocket(`ws://localhost:8000/ws/room/${session.roomCode}/${session.userId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setErrorMsg(null);
    };

    ws.onclose = () => {
      setConnected(false);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'USER_JOINED' || data.type === 'USER_LEFT') {
        setRoomState(data.room_state);
        setChatLog((prev) => [
          ...prev,
          {
            sender: 'System',
            text: data.type === 'USER_JOINED' 
              ? `${data.user.username} entered the room.` 
              : `${data.username} left the room.`
          }
        ]);
      } else if (data.type === 'CHAT_MESSAGE') {
        setChatLog((prev) => [...prev, { sender: data.sender, text: data.text }]);
      }
    };

    return () => {
      ws.close();
    };
  }, [session]);

  // REST Handlers
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    try {
      const res = await fetch('http://localhost:8000/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      });
      const data = await res.json();
      setSession({
        roomCode: data.room_code,
        userId: data.user_id,
        username: data.username,
        isHost: data.is_host,
      });
    } catch (err) {
      setErrorMsg('Failed to create room. Ensure backend is running.');
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !roomInput.trim()) return;

    try {
      const res = await fetch('http://localhost:8000/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), room_code: roomInput.trim() }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        setErrorMsg(errorData.detail || 'Failed to join room');
        return;
      }
      const data = await res.json();
      setSession({
        roomCode: data.room_code,
        userId: data.user_id,
        username: data.username,
        isHost: data.is_host,
      });
    } catch (err) {
      setErrorMsg('Failed to connect to backend server.');
    }
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (wsRef.current && chatInput.trim()) {
      wsRef.current.send(JSON.stringify({ type: 'CHAT_MESSAGE', text: chatInput.trim() }));
      setChatInput('');
    }
  };

  const handleLeaveRoom = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    setSession(null);
    setRoomState(null);
    setChatLog([]);
  };

  // Render Auth / Lobby Screen
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
              Puzzle Room Agent
            </h1>
            <p className="text-xs text-slate-400">Day 2: Multiplayer Room State Sync</p>
          </div>

          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs p-3 rounded-lg text-center">
              {errorMsg}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Your Display Name</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. Alex"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="border-t border-slate-800 pt-4 space-y-3">
              <button
                onClick={handleCreateRoom}
                disabled={!username.trim()}
                className="w-full bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition shadow-lg shadow-cyan-950"
              >
                Create New Escape Room
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink mx-3 text-xs text-slate-500 uppercase">Or Join Existing</span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              <form onSubmit={handleJoinRoom} className="flex space-x-2">
                <input
                  type="text"
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  placeholder="Room Code (e.g. A1B2C3)"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-100 uppercase focus:outline-none focus:border-purple-500"
                />
                <button
                  type="submit"
                  disabled={!username.trim() || !roomInput.trim()}
                  className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-xl transition"
                >
                  Join
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render Active Room View
  const usersList = roomState ? Object.values(roomState.users) : [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[500px]">
        {/* Left Sidebar: Room Details & Users */}
        <div className="w-full md:w-64 bg-slate-900/90 border-r border-slate-800 p-6 flex flex-col justify-between">
          <div className="space-y-6">
            <div>
              <span className="text-xs text-slate-400 uppercase font-semibold">Room Code</span>
              <div className="text-2xl font-mono font-bold tracking-wider text-cyan-400 mt-1">
                {session.roomCode}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-slate-400 uppercase font-semibold">Teammates ({usersList.length})</span>
                <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              </div>

              <div className="space-y-2">
                {usersList.map((u) => (
                  <div key={u.user_id} className="flex items-center space-x-2 bg-slate-950/60 px-3 py-2 rounded-lg border border-slate-800 text-xs">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span className="font-medium text-slate-200 flex-1 truncate">{u.username}</span>
                    {u.user_id === roomState?.host_id && (
                      <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded">HOST</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handleLeaveRoom}
            className="w-full mt-6 bg-slate-800 hover:bg-rose-900/40 hover:text-rose-300 text-slate-400 text-xs font-semibold py-2 rounded-xl border border-slate-700 hover:border-rose-700/50 transition"
          >
            Leave Room
          </button>
        </div>

        {/* Right Panel: Real-time Sync & Chat Stream */}
        <div className="flex-1 flex flex-col bg-slate-950/40">
          <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
            <span className="text-xs font-medium text-slate-400">Live State Sync Stream</span>
            <span className="text-xs text-slate-500 font-mono">User: {session.username}</span>
          </div>

          <div className="flex-1 p-4 space-y-2 overflow-y-auto max-h-[380px]">
            {chatLog.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-600">
                Connected to room. Chat or state updates will appear here in real time.
              </div>
            ) : (
              chatLog.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-lg text-xs font-sans ${
                    msg.sender === 'System'
                      ? 'bg-slate-800/40 border border-slate-800 text-slate-400 italic text-center'
                      : 'bg-slate-800/80 border border-slate-700 text-slate-200'
                  }`}
                >
                  {msg.sender !== 'System' && (
                    <span className="font-bold text-cyan-400 mr-2">{msg.sender}:</span>
                  )}
                  {msg.text}
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSendChat} className="p-4 border-t border-slate-800 bg-slate-900 flex space-x-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Send message to room..."
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              disabled={!chatInput.trim()}
              className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-xl transition"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;
