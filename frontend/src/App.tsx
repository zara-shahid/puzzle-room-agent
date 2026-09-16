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

// Helper to generate avatar initials color
function avatarGradient(name: string) {
  const gradients = [
    'linear-gradient(135deg, #9f5de2, #e8521a)',
    'linear-gradient(135deg, #2dd4bf, #9f5de2)',
    'linear-gradient(135deg, #d4a853, #e8521a)',
    'linear-gradient(135deg, #e8521a, #d4a853)',
    'linear-gradient(135deg, #9f5de2, #2dd4bf)',
  ];
  const i = name.charCodeAt(0) % gradients.length;
  return gradients[i];
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const PUZZLE_TYPE_ICON: Record<string, string> = {
  riddle: '🔮',
  logic: '⚗️',
  cipher: '📜',
  reading_comprehension: '📖',
  creative: '✨',
  default: '🗝️',
};

function getPuzzleIcon(type: string) {
  return PUZZLE_TYPE_ICON[type?.toLowerCase()] || PUZZLE_TYPE_ICON.default;
}

const DIFFICULTY_CONFIG: Record<string, { label: string; className: string; color: string }> = {
  easy: { label: 'NOVICE', className: 'badge-teal', color: '#2dd4bf' },
  medium: { label: 'ADEPT', className: 'badge-gold', color: '#d4a853' },
  hard: { label: 'ARCANE', className: 'badge-ember', color: '#e8521a' },
};

// ============================================================
// LOBBY SCREEN
// ============================================================
function LobbyScreen({
  username, setUsername,
  topic, setTopic,
  studyText, setStudyText,
  roomInput, setRoomInput,
  errorMsg,
  handleCreateRoom,
  handleJoinRoom,
}: {
  username: string; setUsername: (v: string) => void;
  topic: string; setTopic: (v: string) => void;
  studyText: string; setStudyText: (v: string) => void;
  roomInput: string; setRoomInput: (v: string) => void;
  errorMsg: string | null;
  handleCreateRoom: (e: React.FormEvent) => void;
  handleJoinRoom: (e: React.FormEvent) => void;
}) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative' }}>
      {/* Ambient background orbs */}
      <div className="lobby-hero-glow" style={{ width: 500, height: 500, background: 'rgba(159,93,226,0.08)', top: -100, left: -150 }} />
      <div className="lobby-hero-glow" style={{ width: 400, height: 400, background: 'rgba(232,82,26,0.06)', bottom: -80, right: -100 }} />
      <div className="lobby-hero-glow" style={{ width: 300, height: 300, background: 'rgba(212,168,83,0.06)', top: '40%', left: '50%', transform: 'translate(-50%,-50%)' }} />

      <div className="animate-fade-up" style={{ width: '100%', maxWidth: 520, position: 'relative', zIndex: 10 }}>
        {/* Header ornament */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div className="ornament animate-flicker" style={{ fontSize: '1.5rem', marginBottom: 16, opacity: 0.7 }}>⚜ ✦ ⚜</div>
          <div className="badge badge-arcane" style={{ marginBottom: 12, display: 'inline-flex' }}>
            ✦ Arcane AI Escape Room ✦
          </div>
          <h1 className="font-cinzel text-gold-shimmer animate-shimmer" style={{ fontSize: '2.4rem', fontWeight: 900, lineHeight: 1.15, marginBottom: 12 }}>
            The Puzzle Room
          </h1>
          <p className="font-crimson" style={{ fontSize: '1.05rem', color: 'var(--text-dim)', fontStyle: 'italic', lineHeight: 1.6 }}>
            Enter the chamber. Your knowledge is the key.
          </p>
        </div>

        {/* Main card */}
        <div className="card-arcane" style={{ padding: '32px', marginBottom: 0 }}>
          {/* Spinning arcane ring ornament */}
          <div style={{ position: 'absolute', top: -24, right: -24, width: 80, height: 80, opacity: 0.12 }}>
            <svg className="animate-spin-slow" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="40" cy="40" r="36" stroke="#d4a853" strokeWidth="1" strokeDasharray="8 4" />
              <circle cx="40" cy="40" r="28" stroke="#9f5de2" strokeWidth="0.5" strokeDasharray="4 6" />
            </svg>
          </div>

          {errorMsg && (
            <div style={{
              background: 'rgba(248,113,113,0.08)',
              border: '1px solid rgba(248,113,113,0.3)',
              borderRadius: 10,
              padding: '12px 16px',
              marginBottom: 20,
              color: '#fda4af',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              animation: 'shake 0.4s ease',
            }}>
              <span style={{ fontSize: '1rem' }}>🚫</span>
              <span className="font-crimson">{errorMsg}</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Username */}
            <div>
              <label style={{ display: 'block', fontFamily: 'Cinzel, serif', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
                ⚔ Adventurer Name
              </label>
              <input
                id="lobby-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. Maya Lin"
                className="input-arcane"
              />
            </div>

            {/* Topic */}
            <div>
              <label style={{ display: 'block', fontFamily: 'Cinzel, serif', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
                📚 Arcane Subject
              </label>
              <input
                id="lobby-topic"
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Cellular Respiration & ATP"
                className="input-arcane"
              />
            </div>

            {/* Study Material */}
            <div>
              <label style={{ display: 'block', fontFamily: 'Cinzel, serif', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
                📜 Grimoire — Study Material
              </label>
              <textarea
                id="lobby-study-text"
                value={studyText}
                onChange={(e) => setStudyText(e.target.value)}
                placeholder="Paste your lecture notes, textbook passages, or course material here to inscribe the puzzles with your knowledge…"
                rows={4}
                className="input-arcane"
                style={{ resize: 'vertical', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}
              />
              <p style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: 6, fontStyle: 'italic' }}>
                ✦ Your material becomes the arcane knowledge source for AI-grounded puzzles
              </p>
            </div>

            {/* Create button */}
            <button
              id="lobby-create-room"
              onClick={handleCreateRoom}
              disabled={!username.trim()}
              className="btn-primary"
              style={{ width: '100%', fontSize: '0.9rem', padding: '14px 24px', marginTop: 4 }}
            >
              🔑 Summon the Escape Room
            </button>

            {/* Divider */}
            <div className="rune-divider" style={{ margin: '4px 0' }}>
              ⚜ or join an active chamber ⚜
            </div>

            {/* Join room */}
            <form id="lobby-join-form" onSubmit={handleJoinRoom} style={{ display: 'flex', gap: 10 }}>
              <input
                id="lobby-room-code"
                type="text"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                placeholder="Room Code (e.g. A1B2C3)"
                className="input-arcane purple"
                style={{ fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.15em', textTransform: 'uppercase' }}
              />
              <button
                id="lobby-join-btn"
                type="submit"
                disabled={!username.trim() || !roomInput.trim()}
                className="btn-secondary"
                style={{ whiteSpace: 'nowrap', fontSize: '0.78rem', padding: '12px 20px' }}
              >
                Enter
              </button>
            </form>
          </div>
        </div>

        <div className="ornament" style={{ marginTop: 24, fontSize: '0.8rem' }}>✦ ✦ ✦</div>
      </div>
    </div>
  );
}

// ============================================================
// SUMMARY SCREEN
// ============================================================
function SummaryScreen({ report, onReturn }: { report: SummaryReport; onReturn: () => void }) {
  const mins = Math.floor(report.total_session_time_seconds / 60);
  const secs = report.total_session_time_seconds % 60;

  const ratingColors: Record<string, string> = {
    HIGH: '#f87171',
    MODERATE: '#fb923c',
    LOW: '#6ee7b7',
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative' }}>
      <div className="lobby-hero-glow" style={{ width: 600, height: 400, background: 'rgba(52,211,153,0.06)', top: -50, left: '50%', transform: 'translateX(-50%)' }} />

      <div className="animate-fade-up" style={{ width: '100%', maxWidth: 740, position: 'relative', zIndex: 10 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>🏆</div>
          <div className="badge badge-emerald" style={{ display: 'inline-flex', marginBottom: 12 }}>
            ✦ Chamber Conquered ✦
          </div>
          <h1 className="font-cinzel text-gold" style={{ fontSize: '2rem', fontWeight: 900, marginBottom: 8 }}>
            End-of-Session Scroll
          </h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
            Chamber: <span className="font-mono" style={{ color: '#2dd4bf' }}>{report.room_code}</span>
            &nbsp;·&nbsp; Subject: <span style={{ color: 'var(--text-mid)' }}>{report.topic}</span>
          </p>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div className="stat-card" style={{ '--gradient': 'linear-gradient(90deg, #2dd4bf, #9f5de2)' } as React.CSSProperties}>
            <div style={{ fontSize: '0.6rem', fontFamily: 'Cinzel, serif', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 6 }}>Puzzles Cleared</div>
            <div className="font-cinzel text-gold" style={{ fontSize: '1.8rem', fontWeight: 900 }}>{report.total_puzzles}</div>
          </div>
          <div className="stat-card" style={{ '--gradient': 'linear-gradient(90deg, #d4a853, #e8521a)' } as React.CSSProperties}>
            <div style={{ fontSize: '0.6rem', fontFamily: 'Cinzel, serif', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 6 }}>Session Duration</div>
            <div className="font-cinzel" style={{ fontSize: '1.8rem', fontWeight: 900, color: '#fb923c' }}>{mins}m {secs}s</div>
          </div>
          <div className="stat-card" style={{ '--gradient': `linear-gradient(90deg, ${ratingColors[report.overall_struggle_rating] || '#d4a853'}, transparent)` } as React.CSSProperties}>
            <div style={{ fontSize: '0.6rem', fontFamily: 'Cinzel, serif', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 6 }}>Overall Struggle</div>
            <div className="font-cinzel" style={{ fontSize: '1.4rem', fontWeight: 900, color: ratingColors[report.overall_struggle_rating] || '#d4a853' }}>{report.overall_struggle_rating}</div>
          </div>
        </div>

        {/* Summary quote */}
        <div className="card-arcane" style={{ padding: '20px 24px', marginBottom: 20 }}>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', letterSpacing: '0.12em', color: 'var(--gold)', marginBottom: 10, textTransform: 'uppercase' }}>📜 Sage's Wisdom</div>
          <blockquote className="font-crimson" style={{ fontSize: '1.05rem', color: 'var(--text-mid)', lineHeight: 1.7, fontStyle: 'italic' }}>
            "{report.key_takeaway_summary}"
          </blockquote>
        </div>

        {/* Concept breakdown */}
        {report.struggled_concepts.length > 0 && (
          <div className="card-arcane" style={{ padding: '20px 24px', marginBottom: 24 }}>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', letterSpacing: '0.12em', color: 'var(--gold)', marginBottom: 14, textTransform: 'uppercase' }}>⚔ Concept Struggle Grimoire</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 280, overflowY: 'auto', paddingRight: 4 }}>
              {report.struggled_concepts.map((c) => {
                const sevCfg = c.struggle_severity === 'HIGH'
                  ? { cls: 'badge-rose', icon: '🔥' }
                  : c.struggle_severity === 'MODERATE'
                  ? { cls: 'badge-ember', icon: '⚡' }
                  : { cls: 'badge-emerald', icon: '✓' };
                return (
                  <div key={c.puzzle_id} style={{ background: 'var(--bg-void)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-bright)' }}>{c.puzzle_title}</span>
                        <span className={`badge ${sevCfg.cls}`}>{sevCfg.icon} {c.struggle_severity}</span>
                      </div>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>{c.learning_recommendation}</p>
                    </div>
                    <div style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                      <div>{c.solve_time_seconds}s</div>
                      <div>{c.failed_attempts} ✗</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <button id="summary-return-btn" onClick={onReturn} className="btn-danger" style={{ width: '100%', padding: '14px', fontSize: '0.8rem', textAlign: 'center' }}>
          ↩ Return to the Lobby
        </button>
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
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
  const [latestCritique, setLatestCritique] = useState<ReflectionCritique | null>(null);
  const [activeHintBanner, setActiveHintBanner] = useState<StuckSignal | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryReport, setSummaryReport] = useState<SummaryReport | null>(null);
  const [optimisticSolved, setOptimisticSolved] = useState<Record<string, boolean>>({});
  const [answerShake, setAnswerShake] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (session) sessionStorage.setItem('puzzle_room_session', JSON.stringify(session));
    else sessionStorage.removeItem('puzzle_room_session');
  }, [session]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog]);

  useEffect(() => {
    if (!session) return;

    const ws = new WebSocket(`ws://localhost:8000/ws/room/${session.roomCode}/${session.userId}`);
    wsRef.current = ws;

    ws.onopen = () => { setConnected(true); setErrorMsg(null); };
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'USER_JOINED' || data.type === 'USER_LEFT') {
        setRoomState(data.room_state);
        setChatLog((prev) => [...prev, {
          sender: 'SYSTEM',
          text: data.type === 'USER_JOINED'
            ? `⚔ ${data.user.username} entered the chamber.`
            : `🚪 ${data.username} left the chamber.`
        }]);
      } else if (data.type === 'PUZZLE_SOLVED') {
        setRoomState(data.room_state);
        setOptimisticSolved((prev) => ({ ...prev, [data.puzzle_id]: true }));
        if (data.critique) {
          setLatestCritique(data.critique);
          setTimeout(() => setLatestCritique(null), 8000);
        }
        setChatLog((prev) => [...prev, {
          sender: 'ORACLE',
          text: `🔓 "${data.puzzle_id}" seal broken by ${data.solved_by}!`
        }]);
        if (data.room_state.puzzles.every((p: PuzzleState) => p.solved)) {
          fetchSummaryReport(data.room_state.room_code);
        }
      } else if (data.type === 'FAILED_ATTEMPT') {
        setChatLog((prev) => [...prev, {
          sender: 'ORACLE',
          text: `❌ ${data.submitted_by} — the seal holds. Wrong answer.`
        }]);
        setAnswerShake(true);
        setTimeout(() => setAnswerShake(false), 500);
        if (data.stuck_signal?.is_stuck) {
          setActiveHintBanner(data.stuck_signal);
          setChatLog((prev) => [...prev, { sender: 'WHISPER', text: data.stuck_signal.subtle_hint, isHint: true }]);
        }
      } else if (data.type === 'CHAT_MESSAGE') {
        setChatLog((prev) => [...prev, { sender: data.sender, text: data.text }]);
      }
    };

    return () => { ws.close(); };
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
      console.error('Failed to fetch summary', err);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    try {
      const res = await fetch('http://localhost:8000/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), topic: topic.trim() || 'Cellular Respiration & Biology', study_text: studyText.trim() || undefined }),
      });
      const data = await res.json();
      setSession({ roomCode: data.room_code, userId: data.user_id, username: data.username, isHost: data.is_host });
    } catch {
      setErrorMsg('Failed to summon room. Ensure the backend is running.');
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
      if (!res.ok) { const err = await res.json(); setErrorMsg(err.detail || 'Failed to enter chamber'); return; }
      const data = await res.json();
      setSession({ roomCode: data.room_code, userId: data.user_id, username: data.username, isHost: data.is_host });
    } catch {
      setErrorMsg('Failed to connect to backend server.');
    }
  };

  const handleSubmitAnswer = async (e: React.FormEvent, puzzleId: string) => {
    e.preventDefault();
    if (!session || !answerInput.trim()) return;
    const currentAnswer = answerInput.trim();
    setAnswerInput('');
    setOptimisticSolved((prev) => ({ ...prev, [puzzleId]: true }));
    try {
      const res = await fetch('http://localhost:8000/api/rooms/submit-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_code: session.roomCode, user_id: session.userId, puzzle_id: puzzleId, answer: currentAnswer }),
      });
      const data = await res.json();
      if (data.status !== 'correct') setOptimisticSolved((prev) => ({ ...prev, [puzzleId]: false }));
    } catch {
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
    setSession(null); setRoomState(null); setOptimisticSolved({});
    setLatestCritique(null); setActiveHintBanner(null);
    setShowSummary(false); setSummaryReport(null); setChatLog([]);
  };

  // ---- SCREENS ----
  if (!session) {
    return (
      <LobbyScreen
        username={username} setUsername={setUsername}
        topic={topic} setTopic={setTopic}
        studyText={studyText} setStudyText={setStudyText}
        roomInput={roomInput} setRoomInput={setRoomInput}
        errorMsg={errorMsg}
        handleCreateRoom={handleCreateRoom}
        handleJoinRoom={handleJoinRoom}
      />
    );
  }

  if (showSummary && summaryReport) {
    return <SummaryScreen report={summaryReport} onReturn={handleLeaveRoom} />;
  }

  // ---- ROOM SCREEN ----
  const usersList = roomState ? Object.values(roomState.users) : [];
  const activePuzzle = roomState?.puzzles[roomState.current_puzzle_index] ?? null;
  const isCurrentSolved = activePuzzle ? (activePuzzle.solved || optimisticSolved[activePuzzle.id]) : false;
  const diffCfg = DIFFICULTY_CONFIG[roomState?.difficulty ?? 'medium'] ?? DIFFICULTY_CONFIG['medium'];
  const puzzleIcon = activePuzzle ? getPuzzleIcon(activePuzzle.puzzle_type) : '🗝️';
  const solvedCount = roomState?.puzzles.filter(p => p.solved || optimisticSolved[p.id]).length ?? 0;
  const totalCount = roomState?.puzzles.length ?? 0;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Ambient bg */}
      <div className="particle-bg" />

      {/* ---- BANNERS ---- */}
      {latestCritique && (
        <div className="banner-arcane" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '1.4rem' }}>🤖</span>
            <div>
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', color: '#c084fc', textTransform: 'uppercase', marginBottom: 2 }}>
                Oracle Reflection ✦ New Difficulty: {latestCritique.recommended_difficulty.toUpperCase()}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#e9d5ff' }}>{latestCritique.reasoning}</div>
            </div>
          </div>
          <button id="banner-critique-close" onClick={() => setLatestCritique(null)} style={{ color: '#c084fc', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>✕</button>
        </div>
      )}

      {activeHintBanner && (
        <div className="banner-amber" style={{ position: 'fixed', top: latestCritique ? 60 : 0, left: 0, right: 0, zIndex: 99, padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '1.4rem' }}>💡</span>
            <div>
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', color: '#fbbf24', textTransform: 'uppercase', marginBottom: 2 }}>
                ✦ Whisper from the Shadows
              </div>
              <div style={{ fontSize: '0.8rem', color: '#fde68a' }}>{activeHintBanner.subtle_hint}</div>
            </div>
          </div>
          <button id="banner-hint-close" onClick={() => setActiveHintBanner(null)} style={{ color: '#fbbf24', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>✕</button>
        </div>
      )}

      {/* ---- MAIN ROOM LAYOUT ---- */}
      <div style={{ display: 'flex', flex: 1, minHeight: '100vh', paddingTop: (latestCritique || activeHintBanner) ? 56 : 0 }}>

        {/* === LEFT SIDEBAR === */}
        <div style={{
          width: 300,
          flexShrink: 0,
          background: 'var(--bg-deep)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px 20px',
          gap: 24,
          position: 'relative',
        }}>
          {/* Top gradient accent */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, var(--gold), var(--arcane), transparent)', opacity: 0.5 }} />

          {/* Room code & info */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.58rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>Chamber Code</span>
              <span className={`badge ${diffCfg.className}`}>{diffCfg.label}</span>
            </div>
            <div className="font-mono" style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '0.15em', color: '#d4a853', lineHeight: 1.1, animation: 'glow-pulse 3s ease-in-out infinite' }}>
              {session.roomCode}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: 6, fontStyle: 'italic' }}>
              Subject: <span style={{ color: 'var(--text-mid)' }}>{roomState?.topic}</span>
            </div>
          </div>

          {/* Connection indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: connected ? '#34d399' : '#f87171',
              boxShadow: connected ? '0 0 8px rgba(52,211,153,0.6)' : '0 0 8px rgba(248,113,113,0.6)',
              animation: connected ? 'glow-pulse 2s ease-in-out infinite' : 'none',
              display: 'inline-block',
            }} />
            <span style={{ fontSize: '0.68rem', color: connected ? '#6ee7b7' : '#fca5a5', fontFamily: 'Cinzel, serif', letterSpacing: '0.08em' }}>
              {connected ? 'Connected to Chamber' : 'Disconnected'}
            </span>
          </div>

          {/* Progress */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.58rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
                Escape Progress
              </span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: '#d4a853' }}>{solvedCount}/{totalCount}</span>
            </div>
            {/* Progress bar */}
            <div style={{ height: 4, background: 'var(--bg-surface)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${totalCount ? (solvedCount / totalCount) * 100 : 0}%`,
                background: 'linear-gradient(90deg, #d4a853, #9f5de2)',
                borderRadius: 2,
                transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
                boxShadow: '0 0 8px rgba(212,168,83,0.5)',
              }} />
            </div>
          </div>

          {/* Puzzle chain */}
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.58rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 10 }}>
              Puzzle Chain
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', maxHeight: 280 }}>
              {roomState?.puzzles.map((p, idx) => {
                const isSolved = p.solved || optimisticSolved[p.id];
                const isCurrent = idx === roomState.current_puzzle_index;
                const icon = getPuzzleIcon(p.puzzle_type);
                return (
                  <div key={p.id} className={`chain-link ${isSolved ? 'solved' : isCurrent ? 'active' : 'locked'}`}>
                    <span style={{ fontSize: '1rem', flexShrink: 0 }}>{icon}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif' }}>
                      {p.title}
                    </span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', flexShrink: 0 }}>
                      {isSolved ? '🔓' : isCurrent ? '⚡' : '🔒'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active players */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.58rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
                Adventurers ({usersList.length})
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {usersList.map((u) => (
                <div key={u.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10 }}>
                  <div className="player-avatar" style={{ background: avatarGradient(u.username), width: 28, height: 28, fontSize: '0.65rem' }}>
                    {getInitials(u.username)}
                  </div>
                  <span style={{ flex: 1, fontSize: '0.8rem', color: 'var(--text-bright)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.username}</span>
                  {u.user_id === roomState?.host_id && (
                    <span className="badge badge-gold" style={{ fontSize: '0.55rem', padding: '2px 6px' }}>HOST</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Leave button */}
          <button id="leave-room-btn" onClick={handleLeaveRoom} className="btn-danger" style={{ width: '100%', textAlign: 'center' }}>
            🚪 Abandon Chamber
          </button>
        </div>

        {/* === RIGHT PANEL === */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          {/* Puzzle area */}
          <div style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
            {activePuzzle ? (
              <div className="animate-fade-up" style={{ maxWidth: 760, margin: '0 auto' }}>
                {/* Puzzle header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '1.4rem' }}>{puzzleIcon}</span>
                    <span className="badge badge-arcane">{activePuzzle.puzzle_type}</span>
                  </div>
                  {isCurrentSolved && (
                    <span className="badge badge-emerald unlock-celebration" style={{ fontSize: '0.7rem', padding: '5px 14px' }}>
                      ✨ Seal Broken!
                    </span>
                  )}
                </div>

                {/* Puzzle title */}
                <h2 className="font-cinzel" style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-bright)', marginBottom: 20, lineHeight: 1.3 }}>
                  {activePuzzle.title}
                </h2>

                {/* Puzzle body */}
                <div className="puzzle-card" style={{ marginBottom: 20 }}>
                  <p className="font-crimson" style={{ fontSize: '1.1rem', color: 'var(--text-mid)', lineHeight: 1.8 }}>
                    {activePuzzle.riddle_text || activePuzzle.problem_statement || activePuzzle.passage || activePuzzle.prompt}
                  </p>
                </div>

                {/* Clues */}
                {activePuzzle.clues && activePuzzle.clues.length > 0 && (
                  <div style={{ background: 'var(--bg-void)', border: '1px solid rgba(212,168,83,0.15)', borderRadius: 12, padding: '16px 20px', marginBottom: 20, position: 'relative' }}>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.62rem', letterSpacing: '0.12em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 10 }}>
                      🔮 Arcane Clues
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {activePuzzle.clues.map((c, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, color: 'var(--text-mid)', fontSize: '0.85rem' }}>
                          <span style={{ color: 'var(--gold-dim)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', marginTop: 2, flexShrink: 0 }}>
                            {String(i + 1).padStart(2, '0')}.
                          </span>
                          <span className="font-crimson" style={{ fontSize: '1rem', lineHeight: 1.5 }}>{c}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Answer form / success state */}
                {!isCurrentSolved ? (
                  <form id="answer-form" onSubmit={(e) => handleSubmitAnswer(e, activePuzzle.id)} style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <input
                        id="answer-input"
                        type="text"
                        value={answerInput}
                        onChange={(e) => setAnswerInput(e.target.value)}
                        placeholder="Speak the passphrase or answer…"
                        className={`input-arcane ${answerShake ? 'animate-shake' : ''}`}
                        style={{ fontFamily: 'JetBrains Mono, monospace', paddingRight: 16 }}
                      />
                    </div>
                    <button
                      id="answer-submit-btn"
                      type="submit"
                      disabled={!answerInput.trim()}
                      className="btn-primary"
                      style={{ whiteSpace: 'nowrap', fontSize: '0.82rem', padding: '12px 24px' }}
                    >
                      🗝 Break the Seal
                    </button>
                  </form>
                ) : (
                  <div className="unlock-celebration" style={{
                    background: 'linear-gradient(135deg, rgba(52,211,153,0.08), rgba(52,211,153,0.04))',
                    border: '1px solid rgba(52,211,153,0.3)',
                    borderRadius: 12,
                    padding: '18px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                  }}>
                    <span style={{ fontSize: '2rem' }}>🎉</span>
                    <div>
                      <div className="font-cinzel" style={{ color: '#6ee7b7', fontSize: '0.85rem', fontWeight: 700, marginBottom: 4 }}>Chamber Unlocked!</div>
                      <div style={{ color: '#a7f3d0', fontSize: '0.78rem' }}>
                        Solved by <strong>{activePuzzle.solved_by || session.username}</strong> — advancing to the next seal…
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                <div style={{ fontSize: '3rem', animation: 'float-rune 4s ease-in-out infinite' }}>⌛</div>
                <p className="font-cinzel" style={{ color: 'var(--text-dim)', fontSize: '0.85rem', letterSpacing: '0.1em' }}>Awaiting puzzle generation…</p>
              </div>
            )}
          </div>

          {/* Chat / Activity log */}
          <div style={{
            height: 220,
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-deep)',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Chat header */}
            <div style={{ padding: '8px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.75rem' }}>🗺</span>
              <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.6rem', letterSpacing: '0.1em', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Team Comms & Oracle Feed</span>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {chatLog.length === 0 && (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontStyle: 'italic', textAlign: 'center', paddingTop: 10 }}>
                  The chamber is silent… for now.
                </div>
              )}
              {chatLog.map((msg, idx) => {
                const isSystem = msg.sender === 'SYSTEM' || msg.sender === 'ORACLE';
                const isWhisper = msg.sender === 'WHISPER' || msg.isHint;
                return (
                  <div key={idx} className={`chat-msg ${isWhisper ? 'hint' : isSystem ? 'system' : 'player'}`}>
                    <span style={{
                      fontFamily: 'Cinzel, serif',
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      marginRight: 8,
                      color: isWhisper ? '#fbbf24' : isSystem ? 'var(--text-dim)' : '#d4a853',
                      textTransform: 'uppercase',
                    }}>
                      [{msg.sender}]
                    </span>
                    {msg.text}
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Chat input */}
            <form id="chat-form" onSubmit={handleSendChat} style={{ padding: '10px 16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 10 }}>
              <input
                id="chat-input"
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Speak to your fellow adventurers…"
                className="input-arcane"
                style={{ fontSize: '0.78rem', padding: '9px 14px' }}
              />
              <button
                id="chat-send-btn"
                type="submit"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-dim)',
                  borderRadius: 8,
                  color: 'var(--text-dim)',
                  fontFamily: 'Cinzel, serif',
                  fontSize: '0.65rem',
                  letterSpacing: '0.08em',
                  padding: '9px 16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { (e.target as HTMLButtonElement).style.color = 'var(--gold)'; (e.target as HTMLButtonElement).style.borderColor = 'var(--gold)'; }}
                onMouseLeave={e => { (e.target as HTMLButtonElement).style.color = 'var(--text-dim)'; (e.target as HTMLButtonElement).style.borderColor = 'var(--border-dim)'; }}
              >
                Send ⚡
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
