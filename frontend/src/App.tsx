import React, { useState, useEffect, useRef } from 'react';

interface User {
  user_id: string;
  username: string;
}

interface PuzzleState {
  id: string;
  title: string;
  puzzle_type: string;
  riddle_text?: string;
  problem_statement?: string;
  clues?: string[];
  passage?: string;
  prompt?: string;
  hint: string;
  solved: boolean;
  solved_by?: string;
}

interface RoomState {
  room_code: string;
  host_id: string;
  topic: string;
  users: Record<string, User>;
  puzzles: PuzzleState[];
  current_puzzle_index: number;
}

interface ChatMessage {
  sender: string;
  text: string;
}

export function App() {
  const [username, setUsername] = useState('');
  const [topic, setTopic] = useState('Cellular Biology');
  const [studyText, setStudyText] = useState('');
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

  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [answerInput, setAnswerInput] = useState('');
  const [chatLog, setChatLog] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Optimistic UI state map: puzzle_id -> boolean
  const [optimisticSolved, setOptimisticSolved] = useState<Record<string, boolean>>({});

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (session) {
      sessionStorage.setItem('puzzle_room_session', JSON.stringify(session));
    } else {
      sessionStorage.removeItem('puzzle_room_session');
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;

    const ws = new WebSocket(`ws://localhost:8000/ws/room/${session.roomCode}/${session.userId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setErrorMsg(null);
    };

    ws.onclose = () => setConnected(false);

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
      } else if (data.type === 'PUZZLE_SOLVED') {
        // Reconcile server truth with optimistic updates
        setRoomState(data.room_state);
        setOptimisticSolved((prev) => ({ ...prev, [data.puzzle_id]: true }));
        setChatLog((prev) => [
          ...prev,
          { sender: 'System', text: `🎉 Puzzle "${data.puzzle_id}" UNLOCKED by ${data.solved_by}!` }
        ]);
      } else if (data.type === 'FAILED_ATTEMPT') {
        setChatLog((prev) => [
          ...prev,
          { sender: 'System', text: `❌ ${data.submitted_by} tried an incorrect solution.` }
        ]);
      } else if (data.type === 'CHAT_MESSAGE') {
        setChatLog((prev) => [...prev, { sender: data.sender, text: data.text }]);
      }
    };

    return () => {
      ws.close();
    };
  }, [session]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    try {
      const res = await fetch('http://localhost:8000/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          topic: topic.trim() || 'Cellular Biology',
          study_text: studyText.trim() || undefined
        }),
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

  const handleSubmitAnswer = async (e: React.FormEvent, puzzleId: string) => {
    e.preventDefault();
    if (!session || !answerInput.trim()) return;

    const currentAnswer = answerInput.trim();
    setAnswerInput('');

    // OPTIMISTIC UI UPDATE: Instantly show puzzle as solved on the client!
    setOptimisticSolved((prev) => ({ ...prev, [puzzleId]: true }));

    try {
      const res = await fetch('http://localhost:8000/api/rooms/submit-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_code: session.roomCode,
          user_id: session.userId,
          puzzle_id: puzzleId,
          answer: currentAnswer
        })
      });

      const data = await res.json();
      if (data.status !== 'correct') {
        // Revert optimistic update if server rejects the answer
        setOptimisticSolved((prev) => ({ ...prev, [puzzleId]: false }));
      }
    } catch (err) {
      // Revert optimistic update on network failure
      setOptimisticSolved((prev) => ({ ...prev, [puzzleId]: false }));
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
    if (wsRef.current) wsRef.current.close();
    setSession(null);
    setRoomState(null);
    setOptimisticSolved({});
    setChatLog([]);
  };

  // Render Lobby Screen
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-teal-300 to-purple-500 bg-clip-text text-transparent">
              The Puzzle Room Agent
            </h1>
            <p className="text-xs text-slate-400">Day 6: Optimistic UI & Real-Time Puzzle Sync</p>
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
                placeholder="e.g. Maya"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Study Topic</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Quantum Computing"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Pasted Study Material (Optional RAG Context)</label>
              <textarea
                value={studyText}
                onChange={(e) => setStudyText(e.target.value)}
                placeholder="Paste notes, textbook excerpts, or lectures here..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="border-t border-slate-800 pt-4 space-y-3">
              <button
                onClick={handleCreateRoom}
                disabled={!username.trim()}
                className="w-full bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition shadow-lg shadow-cyan-950"
              >
                Create Room & Generate Puzzles
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

  // Active Room & Live Puzzle State View
  const usersList = roomState ? Object.values(roomState.users) : [];
  const activePuzzle = roomState && roomState.puzzles.length > 0 
    ? roomState.puzzles[roomState.current_puzzle_index] 
    : null;

  const isCurrentSolved = activePuzzle ? (activePuzzle.solved || optimisticSolved[activePuzzle.id]) : false;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[580px]">
        {/* Left Sidebar */}
        <div className="w-full md:w-72 bg-slate-900/90 border-r border-slate-800 p-6 flex flex-col justify-between">
          <div className="space-y-6">
            <div>
              <span className="text-xs text-slate-400 uppercase font-semibold">Room Code</span>
              <div className="text-2xl font-mono font-bold tracking-wider text-cyan-400 mt-1">
                {session.roomCode}
              </div>
              <div className="text-xs text-slate-500 mt-1">Topic: <span className="text-slate-300 font-medium">{roomState?.topic}</span></div>
            </div>

            <div>
              <span className="text-xs text-slate-400 uppercase font-semibold">Puzzle Chain Progress</span>
              <div className="mt-2 space-y-2">
                {roomState?.puzzles.map((p, idx) => {
                  const isSolved = p.solved || optimisticSolved[p.id];
                  const isCurrent = idx === roomState.current_puzzle_index;
                  return (
                    <div
                      key={p.id}
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between transition ${
                        isSolved
                          ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                          : isCurrent
                          ? 'bg-cyan-950/50 border-cyan-500/60 text-cyan-200 shadow-md shadow-cyan-950'
                          : 'bg-slate-950/50 border-slate-800 text-slate-500'
                      }`}
                    >
                      <span className="font-semibold">{idx + 1}. {p.title}</span>
                      <span>{isSolved ? '🔓 SOLVED' : isCurrent ? '⚡ ACTIVE' : '🔒 LOCKED'}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 uppercase font-semibold">Teammates ({usersList.length})</span>
                <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              </div>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {usersList.map((u) => (
                  <div key={u.user_id} className="flex items-center space-x-2 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span className="font-medium text-slate-200 flex-1 truncate">{u.username}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handleLeaveRoom}
            className="w-full mt-6 bg-slate-800 hover:bg-rose-900/40 hover:text-rose-300 text-slate-400 text-xs font-semibold py-2.5 rounded-xl border border-slate-700 transition"
          >
            Leave Room
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col bg-slate-950/40">
          {/* Active Puzzle Display */}
          <div className="p-6 flex-1 border-b border-slate-800 space-y-4">
            {activePuzzle ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-1 rounded-full">
                    {activePuzzle.puzzle_type}
                  </span>
                  {isCurrentSolved && (
                    <span className="text-xs font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full animate-bounce">
                      ✨ Optimistically Unlocked!
                    </span>
                  )}
                </div>

                <h2 className="text-xl font-bold text-slate-100">{activePuzzle.title}</h2>

                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 text-sm text-slate-300 leading-relaxed">
                  {activePuzzle.riddle_text || activePuzzle.problem_statement || activePuzzle.passage || activePuzzle.prompt}
                </div>

                {activePuzzle.clues && activePuzzle.clues.length > 0 && (
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 text-xs space-y-1">
                    <span className="font-semibold text-cyan-400">Clues:</span>
                    {activePuzzle.clues.map((c, i) => (
                      <div key={i} className="text-slate-400">• {c}</div>
                    ))}
                  </div>
                )}

                {/* Answer Submission Form */}
                {!isCurrentSolved ? (
                  <form onSubmit={(e) => handleSubmitAnswer(e, activePuzzle.id)} className="flex space-x-3 pt-2">
                    <input
                      type="text"
                      value={answerInput}
                      onChange={(e) => setAnswerInput(e.target.value)}
                      placeholder="Enter solution to unlock..."
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      type="submit"
                      disabled={!answerInput.trim()}
                      className="bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-50 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition shadow-lg shadow-emerald-950"
                    >
                      Unlock Passcode
                    </button>
                  </form>
                ) : (
                  <div className="bg-emerald-950/30 border border-emerald-800/50 text-emerald-300 p-4 rounded-xl text-xs flex justify-between items-center">
                    <span>🎉 Puzzle solved by {activePuzzle.solved_by || session.username}! Next room unlocked.</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                No active puzzles in room.
              </div>
            )}
          </div>

          {/* Activity / Chat Log */}
          <div className="h-44 p-4 flex flex-col justify-between bg-slate-950/70">
            <div className="flex-1 overflow-y-auto space-y-1.5 max-h-28">
              {chatLog.map((msg, idx) => (
                <div key={idx} className="text-xs font-mono text-slate-400">
                  <span className="font-bold text-cyan-400 mr-2">[{msg.sender}]:</span>
                  {msg.text}
                </div>
              ))}
            </div>
            <form onSubmit={handleSendChat} className="flex space-x-2 pt-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Team chat / hints..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
              />
              <button type="submit" className="bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-700">
                Send
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
