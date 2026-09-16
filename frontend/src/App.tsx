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
  failed_attempts?: number;
}

interface ReflectionCritique {
  current_difficulty: string;
  recommended_difficulty: string;
  reasoning: string;
  time_to_solve: number;
  failed_attempts: number;
}

interface StuckSignal {
  is_stuck: boolean;
  stuck_signal_reason?: string;
  subtle_hint?: string;
}

interface RoomState {
  room_code: string;
  host_id: string;
  topic: string;
  difficulty: string;
  users: Record<string, User>;
  puzzles: PuzzleState[];
  current_puzzle_index: number;
  reflection_log: ReflectionCritique[];
}

interface ChatMessage {
  sender: string;
  text: string;
  isHint?: boolean;
}

interface SummaryReport {
  room_code: string;
  topic: string;
  total_puzzles: number;
  total_session_time_seconds: number;
  overall_struggle_rating: string;
  key_takeaway_summary: string;
  struggled_concepts: Array<{
    puzzle_id: string;
    puzzle_title: string;
    concept_name: string;
    failed_attempts: number;
    solve_time_seconds: number;
    struggle_score: number;
    struggle_severity: string;
    learning_recommendation: string;
  }>;
}

export function App() {
  const [username, setUsername] = useState('');
  const [topic, setTopic] = useState('Cellular Respiration & Biology');
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
  
  // Day 10 Visual Demo Banners State
  const [latestCritique, setLatestCritique] = useState<ReflectionCritique | null>(null);
  const [activeHintBanner, setActiveHintBanner] = useState<StuckSignal | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryReport, setSummaryReport] = useState<SummaryReport | null>(null);

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
            sender: 'SYSTEM',
            text: data.type === 'USER_JOINED' 
              ? `👋 ${data.user.username} joined the escape room.` 
              : `🚪 ${data.username} left the room.`
          }
        ]);
      } else if (data.type === 'PUZZLE_SOLVED') {
        setRoomState(data.room_state);
        setOptimisticSolved((prev) => ({ ...prev, [data.puzzle_id]: true }));
        
        // Trigger Day 10 Camera-Noticeable Adaptive Difficulty Banner
        if (data.critique) {
          setLatestCritique(data.critique);
          setTimeout(() => setLatestCritique(null), 8000); // Display for 8s
        }

        setChatLog((prev) => [
          ...prev,
          { sender: 'SYSTEM', text: `🎉 UNLOCKED! "${data.puzzle_id}" solved by ${data.solved_by}!` }
        ]);

        // Check if all puzzles solved
        if (data.room_state.puzzles.every((p: PuzzleState) => p.solved)) {
          fetchSummaryReport(data.room_state.room_code);
        }
      } else if (data.type === 'FAILED_ATTEMPT') {
        setChatLog((prev) => [
          ...prev,
          { sender: 'SYSTEM', text: `❌ ${data.submitted_by} entered an incorrect solution.` }
        ]);

        // Trigger Day 10 Camera-Noticeable Hint Nudge Banner
        if (data.stuck_signal && data.stuck_signal.is_stuck) {
          setActiveHintBanner(data.stuck_signal);
          setChatLog((prev) => [
            ...prev,
            { sender: 'AGENT NUDGE', text: data.stuck_signal.subtle_hint, isHint: true }
          ]);
        }
      } else if (data.type === 'CHAT_MESSAGE') {
        setChatLog((prev) => [...prev, { sender: data.sender, text: data.text }]);
      }
    };

    return () => {
      ws.close();
    };
  }, [session]);

  const fetchSummaryReport = async (code: string) => {
    try {
      const res = await fetch(`http://localhost:8000/api/rooms/${code}/summary`);
      if (res.ok) {
        const data = await res.json();
        setSummaryReport(data);
        setShowSummary(true);
      }
    } catch (err) {
      console.error("Failed to fetch summary report", err);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    try {
      const res = await fetch('http://localhost:8000/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          topic: topic.trim() || 'Cellular Respiration & Biology',
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

    // OPTIMISTIC UI UPDATE
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
        setOptimisticSolved((prev) => ({ ...prev, [puzzleId]: false }));
      }
    } catch (err) {
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
    setLatestCritique(null);
    setActiveHintBanner(null);
    setShowSummary(false);
    setSummaryReport(null);
    setChatLog([]);
  };

  // --- LOBBY SCREEN PASS ---
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-8 space-y-8 relative overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl" />

          <div className="text-center space-y-3 relative z-10">
            <span className="text-xs font-mono font-semibold uppercase tracking-widest bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-3 py-1 rounded-full">
              Day 10 UI Polish • Escape Room Agent
            </span>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-teal-300 to-purple-400 bg-clip-text text-transparent">
              The Puzzle Room Agent
            </h1>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Collaborative RAG-grounded escape rooms built from your study material, featuring real-time adaptive AI reflection.
            </p>
          </div>

          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs p-3.5 rounded-xl text-center font-medium">
              ⚠️ {errorMsg}
            </div>
          )}

          <div className="space-y-5 relative z-10">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">Player Display Name</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. Maya Lin"
                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 transition shadow-inner"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">Study Topic</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Cellular Respiration & ATP"
                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 transition shadow-inner"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">Pasted Study Material (RAG Knowledge Base)</label>
              <textarea
                value={studyText}
                onChange={(e) => setStudyText(e.target.value)}
                placeholder="Paste course notes, lecture extracts, or textbook paragraphs here to ground generated puzzles..."
                rows={3}
                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 transition shadow-inner"
              />
            </div>

            <div className="border-t border-slate-800 pt-5 space-y-3">
              <button
                onClick={handleCreateRoom}
                disabled={!username.trim()}
                className="w-full bg-gradient-to-r from-cyan-600 via-teal-600 to-cyan-500 hover:from-cyan-500 hover:to-teal-400 disabled:opacity-50 text-white font-bold text-sm py-3 rounded-xl transition-all shadow-lg shadow-cyan-950/50 flex items-center justify-center space-x-2"
              >
                <span>🔑 Create Escape Room & Generate Puzzles</span>
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink mx-3 text-[11px] text-slate-500 font-mono uppercase">Or Join Active Teammate Room</span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              <form onSubmit={handleJoinRoom} className="flex space-x-2">
                <input
                  type="text"
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  placeholder="Room Code (e.g. A1B2C3)"
                  className="flex-1 bg-slate-950/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-slate-100 uppercase tracking-wider font-mono focus:outline-none focus:border-purple-500"
                />
                <button
                  type="submit"
                  disabled={!username.trim() || !roomInput.trim()}
                  className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition shadow-md shadow-purple-950/50"
                >
                  Join Room
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- POST-SESSION SUMMARY SCREEN PASS ---
  if (showSummary && summaryReport) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-8 space-y-6">
          <div className="text-center space-y-2 border-b border-slate-800 pb-5">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400 bg-emerald-950/50 border border-emerald-800 px-3 py-1 rounded-full">
              Post-Escape Room Learning Analytics
            </span>
            <h1 className="text-3xl font-extrabold text-slate-100 mt-2">End-of-Session Diagnostic Summary</h1>
            <p className="text-xs text-slate-400">Room: <span className="font-mono text-cyan-400 font-bold">{summaryReport.room_code}</span> • Topic: <span className="text-slate-200">{summaryReport.topic}</span></p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-2xl space-y-1">
              <span className="text-[11px] font-bold uppercase text-slate-400">Overall Session Rating</span>
              <div className="text-base font-bold text-cyan-400">{summaryReport.overall_struggle_rating}</div>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-2xl space-y-1">
              <span className="text-[11px] font-bold uppercase text-slate-400">Total Session Duration</span>
              <div className="text-base font-bold text-purple-400">{summaryReport.total_session_time_seconds}s</div>
            </div>
          </div>

          <div className="bg-slate-950/50 border border-slate-800/80 p-4 rounded-2xl text-xs text-slate-300 leading-relaxed italic">
            "{summaryReport.key_takeaway_summary}"
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">Concept Struggle Breakdown</h3>
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {summaryReport.struggled_concepts.map((c) => (
                <div key={c.puzzle_id} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex justify-between items-start text-xs">
                  <div className="space-y-1 flex-1 pr-4">
                    <div className="font-bold text-slate-100 flex items-center space-x-2">
                      <span>{c.puzzle_title}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        c.struggle_severity === 'HIGH' ? 'bg-rose-950 text-rose-300 border-rose-800' :
                        c.struggle_severity === 'MODERATE' ? 'bg-amber-950 text-amber-300 border-amber-800' :
                        'bg-emerald-950 text-emerald-300 border-emerald-800'
                      }`}>
                        {c.struggle_severity} STRUGGLE
                      </span>
                    </div>
                    <div className="text-slate-400 text-[11px]">{c.learning_recommendation}</div>
                  </div>
                  <div className="text-right font-mono text-[11px] text-slate-400 whitespace-nowrap">
                    <div>Time: {c.solve_time_seconds}s</div>
                    <div>Wrong Attempts: {c.failed_attempts}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleLeaveRoom}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs py-3 rounded-xl transition border border-slate-700"
          >
            Return to Room Lobby
          </button>
        </div>
      </div>
    );
  }

  // --- DAY 10 LIVE PUZZLE ROOM PASS ---
  const usersList = roomState ? Object.values(roomState.users) : [];
  const activePuzzle = roomState && roomState.puzzles.length > 0 
    ? roomState.puzzles[roomState.current_puzzle_index] 
    : null;

  const isCurrentSolved = activePuzzle ? (activePuzzle.solved || optimisticSolved[activePuzzle.id]) : false;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-6xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[620px] relative">

        {/* Day 10 Visual Demo Banner: Adaptive Difficulty Reflection Moment (Camera Noticeable) */}
        {latestCritique && (
          <div className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-r from-purple-900/95 via-indigo-900/95 to-purple-900/95 border-b-2 border-purple-400 px-6 py-3 shadow-2xl animate-pulse flex items-center justify-between text-xs">
            <div className="flex items-center space-x-3">
              <span className="text-lg">🤖</span>
              <div>
                <span className="font-extrabold text-purple-200 uppercase tracking-wider block">
                  Adaptive AI Reflection Triggered • New Difficulty: {latestCritique.recommended_difficulty.toUpperCase()}
                </span>
                <span className="text-purple-300">{latestCritique.reasoning}</span>
              </div>
            </div>
            <button onClick={() => setLatestCritique(null)} className="text-purple-300 font-bold hover:text-white text-sm">✕</button>
          </div>
        )}

        {/* Day 10 Visual Demo Banner: Adaptive Hint Nudge (Camera Noticeable) */}
        {activeHintBanner && (
          <div className="absolute top-12 left-0 right-0 z-40 bg-gradient-to-r from-amber-950/95 via-yellow-900/95 to-amber-950/95 border-b-2 border-amber-400 px-6 py-3 shadow-2xl flex items-center justify-between text-xs">
            <div className="flex items-center space-x-3">
              <span className="text-lg">💡</span>
              <div>
                <span className="font-extrabold text-amber-200 uppercase tracking-wider block">
                  Group Stuck Signal Detected • Subtle Nudge Triggered
                </span>
                <span className="text-amber-100 font-medium">{activeHintBanner.subtle_hint}</span>
              </div>
            </div>
            <button onClick={() => setActiveHintBanner(null)} className="text-amber-300 font-bold hover:text-white text-sm">✕</button>
          </div>
        )}

        {/* Left Sidebar: Room Details & Teammate Presence Pass */}
        <div className="w-full md:w-80 bg-slate-900/95 border-r border-slate-800 p-6 flex flex-col justify-between">
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">Room Code</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  roomState?.difficulty === 'hard' ? 'bg-rose-950/80 text-rose-300 border-rose-800' :
                  roomState?.difficulty === 'easy' ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800' :
                  'bg-cyan-950/80 text-cyan-300 border-cyan-800'
                }`}>
                  DIFFICULTY: {roomState?.difficulty?.toUpperCase() || 'MEDIUM'}
                </span>
              </div>
              <div className="text-3xl font-mono font-extrabold tracking-widest text-cyan-400 mt-1">
                {session.roomCode}
              </div>
              <div className="text-xs text-slate-400 mt-1 truncate">Topic: <span className="text-slate-200 font-semibold">{roomState?.topic}</span></div>
            </div>

            {/* Teammate Presence Indicators Pass */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">Active Teammates ({usersList.length})</span>
                <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              </div>
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                {usersList.map((u) => (
                  <div key={u.user_id} className="flex items-center space-x-2.5 bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50" />
                    <span className="font-semibold text-slate-200 flex-1 truncate">{u.username}</span>
                    {u.user_id === roomState?.host_id && (
                      <span className="text-[9px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded-md">HOST</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Puzzle Progress Stepper Pass */}
            <div>
              <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">Escape Room Chain</span>
              <div className="mt-2 space-y-2">
                {roomState?.puzzles.map((p, idx) => {
                  const isSolved = p.solved || optimisticSolved[p.id];
                  const isCurrent = idx === roomState.current_puzzle_index;
                  return (
                    <div
                      key={p.id}
                      className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${
                        isSolved
                          ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300 font-semibold'
                          : isCurrent
                          ? 'bg-gradient-to-r from-cyan-950/80 to-slate-900 border-cyan-500 text-cyan-200 shadow-md shadow-cyan-950 font-bold ring-1 ring-cyan-500/30'
                          : 'bg-slate-950/60 border-slate-800/80 text-slate-500'
                      }`}
                    >
                      <span className="truncate pr-2">{idx + 1}. {p.title}</span>
                      <span className="whitespace-nowrap font-mono text-[10px]">
                        {isSolved ? '🔓 SOLVED' : isCurrent ? '⚡ ACTIVE' : '🔒 LOCKED'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <button
            onClick={handleLeaveRoom}
            className="w-full mt-6 bg-slate-800/80 hover:bg-rose-900/40 hover:text-rose-300 text-slate-400 text-xs font-bold py-2.5 rounded-xl border border-slate-700/80 transition"
          >
            Leave Escape Room
          </button>
        </div>

        {/* Right Panel: Live Puzzle Interface Pass */}
        <div className="flex-1 flex flex-col bg-slate-950/40">
          <div className="p-6 flex-1 border-b border-slate-800 space-y-5">
            {activePuzzle ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-widest bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1 rounded-full">
                    {activePuzzle.puzzle_type}
                  </span>
                  {isCurrentSolved && (
                    <span className="text-[11px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3.5 py-1 rounded-full animate-bounce">
                      ✨ Optimistically Unlocked!
                    </span>
                  )}
                </div>

                <h2 className="text-2xl font-extrabold text-slate-100 tracking-tight">{activePuzzle.title}</h2>

                <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 text-sm text-slate-200 leading-relaxed shadow-inner">
                  {activePuzzle.riddle_text || activePuzzle.problem_statement || activePuzzle.passage || activePuzzle.prompt}
                </div>

                {activePuzzle.clues && activePuzzle.clues.length > 0 && (
                  <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 text-xs space-y-1.5">
                    <span className="font-bold text-cyan-400 uppercase tracking-wider text-[11px]">Deduction Clues:</span>
                    {activePuzzle.clues.map((c, i) => (
                      <div key={i} className="text-slate-300 font-mono">• {c}</div>
                    ))}
                  </div>
                )}

                {/* Solution Form Pass */}
                {!isCurrentSolved ? (
                  <form onSubmit={(e) => handleSubmitAnswer(e, activePuzzle.id)} className="flex space-x-3 pt-2">
                    <input
                      type="text"
                      value={answerInput}
                      onChange={(e) => setAnswerInput(e.target.value)}
                      placeholder="Enter exact passcode or answer keyword..."
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 font-mono transition"
                    />
                    <button
                      type="submit"
                      disabled={!answerInput.trim()}
                      className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-50 text-white font-extrabold text-xs px-6 py-3 rounded-xl transition shadow-lg shadow-emerald-950/60"
                    >
                      Unlock Room
                    </button>
                  </form>
                ) : (
                  <div className="bg-emerald-950/40 border border-emerald-800/80 text-emerald-300 p-4 rounded-2xl text-xs flex justify-between items-center font-medium">
                    <span>🎉 Room puzzle unlocked by {activePuzzle.solved_by || session.username}! Progressing to next chain link...</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                No active puzzles.
              </div>
            )}
          </div>

          {/* Activity Log & Live Reflection Stream Pass */}
          <div className="h-48 p-4 flex flex-col justify-between bg-slate-950/80">
            <div className="flex-1 overflow-y-auto space-y-2 max-h-32 pr-1">
              {chatLog.map((msg, idx) => (
                <div
                  key={idx}
                  className={`text-xs font-mono p-2 rounded-lg ${
                    msg.isHint
                      ? 'bg-amber-950/40 border border-amber-800/60 text-amber-200'
                      : msg.sender === 'SYSTEM'
                      ? 'text-slate-400 italic'
                      : 'text-slate-300 bg-slate-900/60 border border-slate-800'
                  }`}
                >
                  <span className={`font-bold mr-2 ${msg.isHint ? 'text-amber-400' : 'text-cyan-400'}`}>[{msg.sender}]:</span>
                  {msg.text}
                </div>
              ))}
            </div>
            <form onSubmit={handleSendChat} className="flex space-x-2 pt-2 border-t border-slate-800/60">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Message team / discuss hints..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
              <button type="submit" className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold transition">
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
