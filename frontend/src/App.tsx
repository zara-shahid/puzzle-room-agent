import React, { useState, useEffect, useRef, useCallback } from 'react';

// ============================================================
// TYPES
// ============================================================
interface User {
  user_id: string;
  username: string;
  role: 'player' | 'spectator';
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
  lore_entry?: string;
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
  mode: 'cooperative' | 'competitive';
  users: Record<string, User>;
  puzzles: PuzzleState[];
  current_puzzle_index: number;
  reflection_log: ReflectionCritique[];
  teams: Record<string, string[]>;
  team_scores: Record<string, number>;
}

interface ChatMessage {
  sender: string;
  role?: string;
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

interface VoteState {
  puzzle_id: string;
  votes: Record<string, string>;
  player_count: number;
  myVote: string | null;
  timeLeft: number;
  visible: boolean;
}

interface LoreEntry {
  puzzle_id: string;
  puzzle_title: string;
  text: string;
}

// ============================================================
// HELPERS
// ============================================================
function avatarGradient(name: string) {
  const gradients = [
    'linear-gradient(135deg, #8b4dc4, #c0391a)',
    'linear-gradient(135deg, #1fb89e, #8b4dc4)',
    'linear-gradient(135deg, #d4a853, #c0391a)',
    'linear-gradient(135deg, #c0391a, #d4a853)',
    'linear-gradient(135deg, #8b4dc4, #1fb89e)',
  ];
  const i = name.charCodeAt(0) % gradients.length;
  return gradients[i];
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const PUZZLE_TYPE_ICON: Record<string, string> = {
  riddle: '🔮', logic: '⚗️', cipher: '📜', 'code-lock': '🔐',
  'logic-grid': '⚗️', 'hidden-clue': '🕵️', reading_comprehension: '📖',
  creative: '✨', default: '🗝️',
};

function getPuzzleIcon(type: string) {
  return PUZZLE_TYPE_ICON[type?.toLowerCase()] || PUZZLE_TYPE_ICON.default;
}

const DIFFICULTY_CONFIG: Record<string, { label: string; className: string; color: string }> = {
  easy:   { label: 'NOVICE',  className: 'badge-teal',  color: '#2dd4bf' },
  medium: { label: 'ADEPT',   className: 'badge-gold',  color: '#d4a853' },
  hard:   { label: 'ARCANE',  className: 'badge-ember', color: '#e8521a' },
};

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// ============================================================
// PARTICLE CANVAS
// ============================================================
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const SYMBOLS = ['✦', '⚜', '✧', '◈', '⋆', '◉'];
    const particles: Array<{
      x: number; y: number; vx: number; vy: number;
      size: number; opacity: number; sym: string; phase: number;
    }> = Array.from({ length: 55 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.25,
      vy: -Math.random() * 0.35 - 0.1,
      size: Math.random() * 10 + 6,
      opacity: Math.random() * 0.2 + 0.04,
      sym: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      phase: Math.random() * Math.PI * 2,
    }));

    let animId: number;
    let t = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t += 0.008;
      for (const p of particles) {
        const flicker = 0.5 + 0.5 * Math.sin(t * 1.5 + p.phase);
        ctx.save();
        ctx.globalAlpha = p.opacity * flicker;
        ctx.fillStyle = flicker > 0.6 ? '#d4a853' : '#8b4dc4';
        ctx.font = `${p.size}px serif`;
        ctx.fillText(p.sym, p.x, p.y);
        ctx.restore();
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -20) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
        if (p.x < -20)  p.x = canvas.width + 10;
        if (p.x > canvas.width + 20) p.x = -10;
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, opacity: 0.7 }}
    />
  );
}

// ============================================================
// CONFETTI
// ============================================================
function Confetti({ active }: { active: boolean }) {
  if (!active) return null;
  const pieces = Array.from({ length: 28 }, (_, i) => ({
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 1.5}s`,
    color: ['#d4a853','#8b4dc4','#2dd4bf','#c0391a','#f0c878','#a855f7'][i % 6],
    rotate: `${Math.random() * 360}deg`,
    size: `${Math.random() * 6 + 5}px`,
  }));
  return (
    <div className="confetti-container">
      {pieces.map((p, i) => (
        <div key={i} className="confetti-piece" style={{
          left: p.left, background: p.color, animationDelay: p.delay,
          width: p.size, height: p.size, transform: `rotate(${p.rotate})`,
        }} />
      ))}
    </div>
  );
}

// ============================================================
// ARCANE SIGIL (decorative SVG)
// ============================================================
function ArcaneSigil({ size = 240, opacity = 0.06 }: { size?: number; opacity?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity }}>
      <circle cx="100" cy="100" r="95"  stroke="#d4a853" strokeWidth="0.8" strokeDasharray="6 3" className="animate-spin-slow" />
      <circle cx="100" cy="100" r="78"  stroke="#8b4dc4" strokeWidth="0.5" strokeDasharray="3 6" className="animate-spin-rev" />
      <circle cx="100" cy="100" r="60"  stroke="#d4a853" strokeWidth="0.6" />
      <polygon points="100,15 185,155 15,155"   stroke="#d4a853" strokeWidth="0.7" fill="none" opacity="0.6" />
      <polygon points="100,185 15,45 185,45"    stroke="#8b4dc4" strokeWidth="0.5" fill="none" opacity="0.5" />
      <circle cx="100" cy="100" r="8"  fill="#d4a853" opacity="0.3" />
      <circle cx="100" cy="15"  r="3"  fill="#d4a853" opacity="0.5" />
      <circle cx="185" cy="155" r="3"  fill="#d4a853" opacity="0.5" />
      <circle cx="15"  cy="155" r="3"  fill="#d4a853" opacity="0.5" />
    </svg>
  );
}

// ============================================================
// TEAM SCOREBOARD
// ============================================================
function TeamScoreboard({
  teamScores, solverTeam, mode, topOffset,
}: {
  teamScores: Record<string, number>;
  teams?: Record<string, string[]>;
  users?: Record<string, User>;
  solverTeam: string | null;
  mode: string;
  topOffset: number;
}) {
  if (mode !== 'competitive') return null;

  const teamAName = 'Team Flame';
  const teamBName = 'Team Frost';

  return (
    <div className="team-scoreboard" style={{ top: topOffset }}>
      <div className="team-score-block" style={{ justifyContent: 'flex-end' }}>
        <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.6rem', letterSpacing: '0.1em', color: '#fb923c', textTransform: 'uppercase' }}>
          🔥 {teamAName}
        </span>
        <span className={`team-score-value ${solverTeam === 'team_a' ? 'score-update' : ''}`}
          style={{ color: '#fb923c' }}>
          {teamScores['team_a'] ?? 0}
        </span>
      </div>
      <div className="vs-divider">VS</div>
      <div className="team-score-block team-b">
        <span className={`team-score-value ${solverTeam === 'team_b' ? 'score-update' : ''}`}
          style={{ color: '#93c5fd' }}>
          {teamScores['team_b'] ?? 0}
        </span>
        <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.6rem', letterSpacing: '0.1em', color: '#93c5fd', textTransform: 'uppercase' }}>
          ❄️ {teamBName}
        </span>
      </div>
    </div>
  );
}

// ============================================================
// VOTE MODAL
// ============================================================
function VoteModal({
  vote, onVote, onClose,
}: {
  vote: VoteState;
  onVote: (v: string) => void;
  onClose: () => void;
}) {
  if (!vote.visible) return null;

  const total = Object.keys(vote.votes).length;
  const counts = { easy: 0, medium: 0, hard: 0 };
  for (const v of Object.values(vote.votes)) {
    if (v in counts) counts[v as keyof typeof counts]++;
  }
  const pct = (k: keyof typeof counts) => total > 0 ? Math.round((counts[k] / total) * 100) : 0;

  const radius = 14;
  const circ   = 2 * Math.PI * radius;
  const offset = circ - (vote.timeLeft / 8) * circ;

  return (
    <div className="vote-modal-overlay">
      <div className="vote-modal">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: 'Cinzel Decorative, serif', fontSize: '0.75rem', color: '#d4a853', letterSpacing: '0.1em', marginBottom: 2 }}>
              ⚖ Democracy Speaks
            </div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.58rem', color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              How did that puzzle feel?
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="vote-timer-ring">
              <svg width="36" height="36" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r={radius} stroke="rgba(212,168,83,0.1)" strokeWidth="2.5" fill="none" />
                <circle cx="18" cy="18" r={radius} stroke="#d4a853" strokeWidth="2.5" fill="none"
                  strokeDasharray={circ} strokeDashoffset={offset}
                  strokeLinecap="round" transform="rotate(-90 18 18)"
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
                <text x="18" y="22" textAnchor="middle" fill="#d4a853"
                  style={{ fontFamily: 'JetBrains Mono', fontSize: '9px', fontWeight: 700 }}>
                  {vote.timeLeft}
                </text>
              </svg>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
          </div>
        </div>

        {/* Vote buttons */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          {(['easy', 'medium', 'hard'] as const).map(v => (
            <button key={v} className={`vote-btn ${v} ${vote.myVote === v ? 'selected' : ''}`}
              onClick={() => onVote(v)} disabled={!!vote.myVote}>
              <span style={{ fontSize: '1.4rem' }}>
                {v === 'easy' ? '😴' : v === 'medium' ? '⚖️' : '🔥'}
              </span>
              {v === 'easy' ? 'Too Easy' : v === 'medium' ? 'Just Right' : 'Too Hard'}
            </button>
          ))}
        </div>

        {/* Live bar chart */}
        {total > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(['easy','medium','hard'] as const).map(v => (
              <div key={v}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.58rem', color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    {v === 'easy' ? 'Easy' : v === 'medium' ? 'Medium' : 'Hard'}
                  </span>
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.62rem', color: 'var(--text-mid)' }}>
                    {counts[v]} · {pct(v)}%
                  </span>
                </div>
                <div className="vote-bar">
                  <div className="vote-bar-fill" style={{
                    width: `${pct(v)}%`,
                    background: v === 'easy' ? '#2dd4bf' : v === 'medium' ? '#d4a853' : '#fb923c',
                  }} />
                </div>
              </div>
            ))}
            <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontStyle: 'italic', marginTop: 4, textAlign: 'center' }}>
              {total} of {vote.player_count} voted
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// CODEX DRAWER
// ============================================================
function CodexDrawer({
  entries, onClose,
}: {
  entries: LoreEntry[];
  onClose: () => void;
  hasNew?: boolean;
}) {
  return (
    <div className="codex-drawer">
      {/* Header */}
      <div style={{
        padding: '20px 24px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontFamily: 'Cinzel Decorative, serif', fontSize: '0.85rem', color: '#d4a853', letterSpacing: '0.08em', marginBottom: 2 }}>
            📖 The Lore Codex
          </div>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.55rem', color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Unveiled fragments · {entries.length} entries
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 8,
          color: 'var(--text-dim)', cursor: 'pointer', padding: '6px 10px', fontSize: '0.8rem',
          transition: 'all 0.2s', fontFamily: 'Cinzel, serif',
        }}>✕</button>
      </div>

      {/* Top gradient */}
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, var(--gold), transparent)', opacity: 0.3 }} />

      {/* Entries */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {entries.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }} className="animate-float-rune">📜</div>
            <div style={{ fontFamily: 'IM Fell English, serif', fontSize: '0.9rem', color: 'var(--text-dim)', fontStyle: 'italic', lineHeight: 1.6 }}>
              The pages are blank. Solve a puzzle to unveil the first scroll…
            </div>
          </div>
        ) : (
          entries.map((e, idx) => (
            <div key={e.puzzle_id} className="lore-entry">
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.55rem', color: 'var(--gold-dim)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6, marginLeft: 14 }}>
                Fragment {idx + 1} · {e.puzzle_title}
              </div>
              <p style={{ fontFamily: 'IM Fell English, serif', fontSize: '0.95rem', color: 'var(--text-parchment)', lineHeight: 1.75, fontStyle: 'italic', marginLeft: 14 }}>
                {e.text}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Bottom ornament */}
      <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border-void)' }}>
        <div className="ornament" style={{ fontSize: '0.8rem' }}>⚜ ✦ ⚜</div>
      </div>
    </div>
  );
}

// ============================================================
// LOBBY SCREEN
// ============================================================
function LobbyScreen({
  username, setUsername, topic, setTopic, studyText, setStudyText,
  roomInput, setRoomInput, errorMsg, gameMode, setGameMode,
  handleCreateRoom, handleJoinRoom, handleSpectatorJoin,
}: {
  username: string; setUsername: (v: string) => void;
  topic: string; setTopic: (v: string) => void;
  studyText: string; setStudyText: (v: string) => void;
  roomInput: string; setRoomInput: (v: string) => void;
  errorMsg: string | null;
  gameMode: 'cooperative' | 'competitive';
  setGameMode: (v: 'cooperative' | 'competitive') => void;
  handleCreateRoom: (e: React.FormEvent) => void;
  handleJoinRoom: (e: React.FormEvent) => void;
  handleSpectatorJoin: (e: React.FormEvent) => void;
}) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative', overflow: 'hidden' }}>
      <ParticleCanvas />
      <div className="particle-bg" />

      {/* Background ambient glows */}
      <div className="lobby-hero-glow" style={{ width: 600, height: 600, background: 'rgba(139,77,196,0.12)', top: -150, left: -200 }} />
      <div className="lobby-hero-glow" style={{ width: 500, height: 500, background: 'rgba(192,57,26,0.08)', bottom: -100, right: -150 }} />
      <div className="lobby-hero-glow" style={{ width: 350, height: 350, background: 'rgba(212,168,83,0.06)', top: '45%', left: '55%', transform: 'translate(-50%,-50%)' }} />

      {/* Decorative sigil background */}
      <div className="lobby-crest">
        <ArcaneSigil size={420} opacity={0.055} />
      </div>

      <div className="animate-fade-up" style={{ width: '100%', maxWidth: 540, position: 'relative', zIndex: 10 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div className="ornament animate-candle" style={{ fontSize: '1.3rem', marginBottom: 18, letterSpacing: '1em', opacity: 0.6 }}>⚜</div>
          <div className="badge badge-arcane" style={{ marginBottom: 14, display: 'inline-flex' }}>
            ✦ Arcane AI Escape Room ✦
          </div>
          <h1 className="font-cinzel-deco text-gold-shimmer"
            style={{ fontSize: '2.6rem', fontWeight: 900, lineHeight: 1.1, marginBottom: 14 }}>
            The Puzzle Room
          </h1>
          <p className="font-fell" style={{ fontSize: '1.1rem', color: 'var(--text-mid)', fontStyle: 'italic', lineHeight: 1.7 }}>
            Enter the chamber. Your knowledge is the only key.
          </p>
        </div>

        {/* Main card */}
        <div className="card-arcane" style={{ padding: '32px' }}>
          {/* Spinning sigil ornament */}
          <div style={{ position: 'absolute', top: -28, right: -28, width: 90, height: 90, opacity: 0.1, pointerEvents: 'none' }}>
            <ArcaneSigil size={90} opacity={1} />
          </div>

          {errorMsg && (
            <div style={{
              background: 'rgba(200,57,26,0.08)', border: '1px solid rgba(200,57,26,0.3)',
              borderRadius: 12, padding: '12px 16px', marginBottom: 22,
              color: '#fca5a5', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 8,
              animation: 'shake 0.4s ease',
            }}>
              <span style={{ fontSize: '1rem' }}>🚫</span>
              <span className="font-fell">{errorMsg}</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Username */}
            <div>
              <label style={{ display: 'block', fontFamily: 'Cinzel, serif', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
                ⚔ Adventurer Name
              </label>
              <input id="lobby-username" type="text" value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. Maya Lin" className="input-arcane" />
            </div>

            {/* Topic */}
            <div>
              <label style={{ display: 'block', fontFamily: 'Cinzel, serif', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
                📚 Arcane Subject
              </label>
              <input id="lobby-topic" type="text" value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="e.g. Cellular Respiration & ATP" className="input-arcane" />
            </div>

            {/* Study Material */}
            <div>
              <label style={{ display: 'block', fontFamily: 'Cinzel, serif', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
                📜 Grimoire — Study Material
              </label>
              <textarea id="lobby-study-text" value={studyText}
                onChange={e => setStudyText(e.target.value)}
                placeholder="Paste your lecture notes, textbook passages, or course material here to inscribe the puzzles with your knowledge…"
                rows={4} className="input-arcane"
                style={{ resize: 'vertical', fontFamily: 'Inter, sans-serif', lineHeight: 1.65 }} />
              <p style={{ fontSize: '0.66rem', color: 'var(--text-dim)', marginTop: 5, fontStyle: 'italic' }}>
                ✦ Your material becomes the arcane knowledge source for AI-grounded puzzles
              </p>
            </div>

            {/* Mode Toggle */}
            <div>
              <label style={{ display: 'block', fontFamily: 'Cinzel, serif', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
                ⚔ Chamber Mode
              </label>
              <div className="mode-toggle">
                <button className={`mode-btn ${gameMode === 'cooperative' ? 'active' : ''}`}
                  onClick={() => setGameMode('cooperative')}>
                  🤝 Cooperative
                </button>
                <button className={`mode-btn ${gameMode === 'competitive' ? 'active competitive' : ''}`}
                  onClick={() => setGameMode('competitive')}>
                  ⚔️ Competitive
                </button>
              </div>
              {gameMode === 'competitive' && (
                <p style={{ fontSize: '0.66rem', color: '#fb923c', marginTop: 5, fontStyle: 'italic' }}>
                  🔥 Two teams race for points — solve faster to earn bonus!
                </p>
              )}
            </div>

            {/* Create button */}
            <button id="lobby-create-room" onClick={handleCreateRoom}
              disabled={!username.trim()} className="btn-primary"
              style={{ width: '100%', fontSize: '0.88rem', padding: '15px 24px', marginTop: 2 }}>
              🔑 Summon the Escape Room
            </button>

            {/* Divider */}
            <div className="rune-divider" style={{ margin: '0' }}>⚜ or enter an active chamber ⚜</div>

            {/* Join section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <form id="lobby-join-form" onSubmit={handleJoinRoom} style={{ display: 'flex', gap: 10 }}>
                <input id="lobby-room-code" type="text" value={roomInput}
                  onChange={e => setRoomInput(e.target.value)}
                  placeholder="Room Code (e.g. A1B2C3)"
                  className="input-arcane purple"
                  style={{ fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.15em', textTransform: 'uppercase' }} />
                <button id="lobby-join-btn" type="submit"
                  disabled={!username.trim() || !roomInput.trim()}
                  className="btn-secondary"
                  style={{ whiteSpace: 'nowrap', fontSize: '0.76rem', padding: '12px 20px' }}>
                  Enter
                </button>
              </form>

              {/* Spectator join */}
              <form id="lobby-spectator-form" onSubmit={handleSpectatorJoin} style={{ display: 'flex', gap: 10 }}>
                <button id="lobby-spectator-btn" type="submit"
                  disabled={!username.trim() || !roomInput.trim()}
                  className="btn-ghost"
                  style={{ flex: 1, fontSize: '0.72rem' }}>
                  👁 Join as Spectator
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="ornament animate-candle" style={{ marginTop: 24, fontSize: '0.8rem' }}>✦ ✦ ✦</div>
      </div>
    </div>
  );
}

// ============================================================
// SUMMARY SCREEN
// ============================================================
function SummaryScreen({ report, onReturn, teamScores, mode }: {
  report: SummaryReport; onReturn: () => void;
  teamScores: Record<string, number>; mode: string;
}) {
  const mins = Math.floor(report.total_session_time_seconds / 60);
  const secs = report.total_session_time_seconds % 60;

  const ratingColors: Record<string, string> = {
    HIGH: '#f87171', MODERATE: '#fb923c', LOW: '#6ee7b7',
  };

  const winnerTeam = mode === 'competitive'
    ? (teamScores['team_a'] > teamScores['team_b'] ? '🔥 Team Flame' : teamScores['team_b'] > teamScores['team_a'] ? '❄️ Team Frost' : '⚖️ Draw')
    : null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative' }}>
      <ParticleCanvas />
      <div className="particle-bg" />
      <div className="lobby-hero-glow" style={{ width: 700, height: 400, background: 'rgba(52,211,153,0.07)', top: -50, left: '50%', transform: 'translateX(-50%)' }} />

      <div className="animate-fade-up" style={{ width: '100%', maxWidth: 780, position: 'relative', zIndex: 10 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>🏆</div>
          <div className="badge badge-emerald" style={{ display: 'inline-flex', marginBottom: 14 }}>✦ Chamber Conquered ✦</div>
          <h1 className="font-cinzel-deco text-gold" style={{ fontSize: '2rem', fontWeight: 900, marginBottom: 10 }}>
            End-of-Session Scroll
          </h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.84rem' }}>
            Chamber: <span className="font-mono" style={{ color: '#2dd4bf' }}>{report.room_code}</span>
            &nbsp;·&nbsp; Subject: <span style={{ color: 'var(--text-mid)' }}>{report.topic}</span>
          </p>

          {/* Competitive winner */}
          {winnerTeam && (
            <div style={{ marginTop: 16, display: 'inline-block', padding: '10px 24px', borderRadius: 14,
              background: 'linear-gradient(135deg, rgba(212,168,83,0.15), rgba(212,168,83,0.05))',
              border: '1px solid rgba(212,168,83,0.4)' }}>
              <span className="font-cinzel" style={{ fontSize: '1rem', color: '#d4a853' }}>
                Winner: {winnerTeam}
              </span>
            </div>
          )}
        </div>

        {/* Competitive team scores */}
        {mode === 'competitive' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div className="stat-card" style={{ '--gradient': 'linear-gradient(90deg, #c0391a, #fb923c)' } as React.CSSProperties}>
              <div style={{ fontSize: '0.6rem', fontFamily: 'Cinzel, serif', color: 'var(--text-dim)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>🔥 Team Flame Score</div>
              <div className="font-cinzel" style={{ fontSize: '2rem', fontWeight: 900, color: '#fb923c' }}>{teamScores['team_a'] ?? 0}</div>
            </div>
            <div className="stat-card" style={{ '--gradient': 'linear-gradient(90deg, #3b82f6, #93c5fd)' } as React.CSSProperties}>
              <div style={{ fontSize: '0.6rem', fontFamily: 'Cinzel, serif', color: 'var(--text-dim)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>❄️ Team Frost Score</div>
              <div className="font-cinzel" style={{ fontSize: '2rem', fontWeight: 900, color: '#93c5fd' }}>{teamScores['team_b'] ?? 0}</div>
            </div>
          </div>
        )}

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div className="stat-card" style={{ '--gradient': 'linear-gradient(90deg, #2dd4bf, #8b4dc4)' } as React.CSSProperties}>
            <div style={{ fontSize: '0.6rem', fontFamily: 'Cinzel, serif', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 6 }}>Puzzles Cleared</div>
            <div className="font-cinzel text-gold" style={{ fontSize: '1.8rem', fontWeight: 900 }}>{report.total_puzzles}</div>
          </div>
          <div className="stat-card" style={{ '--gradient': 'linear-gradient(90deg, #d4a853, #c0391a)' } as React.CSSProperties}>
            <div style={{ fontSize: '0.6rem', fontFamily: 'Cinzel, serif', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 6 }}>Session Duration</div>
            <div className="font-cinzel" style={{ fontSize: '1.8rem', fontWeight: 900, color: '#fb923c' }}>{mins}m {secs}s</div>
          </div>
          <div className="stat-card" style={{ '--gradient': `linear-gradient(90deg, ${ratingColors[report.overall_struggle_rating] || '#d4a853'}, transparent)` } as React.CSSProperties}>
            <div style={{ fontSize: '0.6rem', fontFamily: 'Cinzel, serif', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 6 }}>Overall Struggle</div>
            <div className="font-cinzel" style={{ fontSize: '1.4rem', fontWeight: 900, color: ratingColors[report.overall_struggle_rating] || '#d4a853' }}>{report.overall_struggle_rating}</div>
          </div>
        </div>

        {/* Sage's wisdom */}
        <div className="card-arcane" style={{ padding: '22px 28px', marginBottom: 20 }}>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.62rem', letterSpacing: '0.13em', color: 'var(--gold)', marginBottom: 12, textTransform: 'uppercase' }}>📜 Sage's Wisdom</div>
          <blockquote className="font-fell" style={{ fontSize: '1.1rem', color: 'var(--text-parchment)', lineHeight: 1.8, fontStyle: 'italic' }}>
            "{report.key_takeaway_summary}"
          </blockquote>
        </div>

        {/* Concept breakdown */}
        {report.struggled_concepts.length > 0 && (
          <div className="card-arcane" style={{ padding: '20px 28px', marginBottom: 24 }}>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.62rem', letterSpacing: '0.13em', color: 'var(--gold)', marginBottom: 16, textTransform: 'uppercase' }}>⚔ Concept Struggle Grimoire</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 280, overflowY: 'auto', paddingRight: 4 }}>
              {report.struggled_concepts.map(c => {
                const sevCfg = c.struggle_severity === 'HIGH'
                  ? { cls: 'badge-rose', icon: '🔥' }
                  : c.struggle_severity === 'MODERATE'
                  ? { cls: 'badge-ember', icon: '⚡' }
                  : { cls: 'badge-emerald', icon: '✓' };
                return (
                  <div key={c.puzzle_id} style={{ background: 'var(--bg-void)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '13px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-bright)' }}>{c.puzzle_title}</span>
                        <span className={`badge ${sevCfg.cls}`}>{sevCfg.icon} {c.struggle_severity}</span>
                      </div>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', lineHeight: 1.55 }}>{c.learning_recommendation}</p>
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
  const [username, setUsername]     = useState('');
  const [topic, setTopic]           = useState('Cellular Respiration & Biology');
  const [studyText, setStudyText]   = useState('');
  const [roomInput, setRoomInput]   = useState('');
  const [gameMode, setGameMode]     = useState<'cooperative' | 'competitive'>('cooperative');

  const [session, setSession] = useState<{
    roomCode: string; userId: string; username: string;
    isHost: boolean; role: 'player' | 'spectator'; mode: string;
  } | null>(() => {
    const saved = sessionStorage.getItem('puzzle_room_session');
    return saved ? JSON.parse(saved) : null;
  });

  const [roomState,        setRoomState]        = useState<RoomState | null>(null);
  const [answerInput,      setAnswerInput]       = useState('');
  const [chatLog,          setChatLog]           = useState<ChatMessage[]>([]);
  const [chatInput,        setChatInput]         = useState('');
  const [connected,        setConnected]         = useState(false);
  const [errorMsg,         setErrorMsg]          = useState<string | null>(null);
  const [latestCritique,   setLatestCritique]    = useState<ReflectionCritique | null>(null);
  const [activeHintBanner, setActiveHintBanner]  = useState<StuckSignal | null>(null);
  const [showSummary,      setShowSummary]       = useState(false);
  const [summaryReport,    setSummaryReport]     = useState<SummaryReport | null>(null);
  const [optimisticSolved, setOptimisticSolved]  = useState<Record<string, boolean>>({});
  const [answerShake,      setAnswerShake]       = useState(false);
  const [showHint,         setShowHint]          = useState(false);
  const [showConfetti,     setShowConfetti]      = useState(false);
  const [battleFlash,      setBattleFlash]       = useState<'fire' | 'ice' | null>(null);
  const [copiedCode,       setCopiedCode]        = useState(false);
  const [solverTeam,       setSolverTeam]        = useState<string | null>(null);
  const [teamScores,       setTeamScores]        = useState<Record<string, number>>({ team_a: 0, team_b: 0 });
  const [spectatorCount,   setSpectatorCount]    = useState(0);

  // Codex
  const [showCodex,   setShowCodex]   = useState(false);
  const [loreEntries, setLoreEntries] = useState<LoreEntry[]>([]);
  const [hasNewLore,  setHasNewLore]  = useState(false);

  // Difficulty vote
  const [voteState, setVoteState] = useState<VoteState>({
    puzzle_id: '', votes: {}, player_count: 1, myVote: null, timeLeft: 8, visible: false,
  });
  const voteTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Puzzle elapsed timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const wsRef     = useRef<WebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (session) sessionStorage.setItem('puzzle_room_session', JSON.stringify(session));
    else sessionStorage.removeItem('puzzle_room_session');
  }, [session]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog]);

  // Puzzle elapsed timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setElapsedSeconds(0);
    if (roomState && !showSummary) {
      timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [roomState?.current_puzzle_index]);

  // WebSocket
  useEffect(() => {
    if (!session) return;
    const ws = new WebSocket(`ws://localhost:8000/ws/room/${session.roomCode}/${session.userId}`);
    wsRef.current = ws;

    ws.onopen  = () => { setConnected(true);  setErrorMsg(null); };
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'USER_JOINED' || data.type === 'USER_LEFT') {
        setRoomState(data.room_state);
        setSpectatorCount(data.spectator_count ?? 0);
        setChatLog(prev => [...prev, {
          sender: 'SYSTEM',
          text: data.type === 'USER_JOINED'
            ? `⚔ ${data.user.username} ${data.user.role === 'spectator' ? '(spectator)' : ''} entered the chamber.`
            : `🚪 ${data.username} left the chamber.`,
        }]);

      } else if (data.type === 'PUZZLE_SOLVED') {
        setRoomState(data.room_state);
        setOptimisticSolved(prev => ({ ...prev, [data.puzzle_id]: true }));
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);

        // Team score update
        if (data.solver_team) {
          setSolverTeam(data.solver_team);
          setTeamScores(data.team_scores || {});
          setBattleFlash(data.solver_team === 'team_a' ? 'fire' : 'ice');
          setTimeout(() => { setSolverTeam(null); setBattleFlash(null); }, 1500);
        }

        // Lore entry
        if (data.lore_entry) {
          const puzzle = data.room_state.puzzles.find((p: PuzzleState) => p.id === data.puzzle_id);
          setLoreEntries(prev => [...prev, {
            puzzle_id: data.puzzle_id,
            puzzle_title: puzzle?.title || data.puzzle_id,
            text: data.lore_entry,
          }]);
          setHasNewLore(true);
        }

        if (data.critique) {
          setLatestCritique(data.critique);
          setTimeout(() => setLatestCritique(null), 8000);
        }

        // Start vote modal
        if (session.role === 'player') {
          setVoteState({ puzzle_id: data.puzzle_id, votes: {}, player_count: data.room_state ? Object.values(data.room_state.users).filter((u: any) => u.role === 'player').length : 1, myVote: null, timeLeft: 8, visible: true });
          if (voteTimerRef.current) clearInterval(voteTimerRef.current);
          voteTimerRef.current = setInterval(() => {
            setVoteState(prev => {
              if (prev.timeLeft <= 1) {
                clearInterval(voteTimerRef.current!);
                return { ...prev, timeLeft: 0, visible: false };
              }
              return { ...prev, timeLeft: prev.timeLeft - 1 };
            });
          }, 1000);
        }

        setShowHint(false);
        setChatLog(prev => [...prev, {
          sender: 'ORACLE',
          text: `🔓 "${data.puzzle_id}" seal broken by ${data.solved_by}!${data.points_awarded ? ` +${data.points_awarded} pts` : ''}`,
        }]);

        if (data.room_state.puzzles.every((p: PuzzleState) => p.solved)) {
          fetchSummaryReport(data.room_state.room_code);
        }

      } else if (data.type === 'FAILED_ATTEMPT') {
        setChatLog(prev => [...prev, { sender: 'ORACLE', text: `❌ ${data.submitted_by} — the seal holds. Wrong answer.` }]);
        setAnswerShake(true);
        setTimeout(() => setAnswerShake(false), 500);
        if (data.stuck_signal?.is_stuck) {
          setActiveHintBanner(data.stuck_signal);
          setChatLog(prev => [...prev, { sender: 'WHISPER', text: data.stuck_signal.subtle_hint, isHint: true }]);
        }

      } else if (data.type === 'CHAT_MESSAGE') {
        setChatLog(prev => [...prev, { sender: data.sender, role: data.role, text: data.text }]);

      } else if (data.type === 'VOTE_UPDATE') {
        setVoteState(prev => ({ ...prev, votes: data.votes, player_count: data.player_count }));

      } else if (data.type === 'VOTE_RESULT') {
        if (voteTimerRef.current) clearInterval(voteTimerRef.current);
        setVoteState(prev => ({ ...prev, visible: false }));
        setChatLog(prev => [...prev, {
          sender: 'ORACLE',
          text: `⚖ Democracy spoke: ${data.player_vote_tally} (voted) × AI: ${data.ai_recommendation} → New difficulty: ${data.final_difficulty.toUpperCase()}`,
        }]);

      } else if (data.type === 'TEAM_SCORE_UPDATE') {
        setTeamScores(data.team_scores);
        setSolverTeam(data.solver_team);
        setTimeout(() => setSolverTeam(null), 1500);
      }
    };

    return () => { ws.close(); };
  }, [session]);

  const fetchSummaryReport = async (code: string) => {
    try {
      const res = await fetch(`http://localhost:8000/api/rooms/${code}/summary`);
      if (res.ok) {
        const data = await res.json();
        setSummaryReport(data); setShowSummary(true);
      }
    } catch (err) { console.error('Failed to fetch summary', err); }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    try {
      const res = await fetch('http://localhost:8000/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), topic: topic.trim() || 'Cellular Respiration & Biology', study_text: studyText.trim() || undefined, mode: gameMode }),
      });
      const data = await res.json();
      setSession({ roomCode: data.room_code, userId: data.user_id, username: data.username, isHost: data.is_host, role: 'player', mode: data.mode });
    } catch { setErrorMsg('Failed to summon room. Ensure the backend is running.'); }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !roomInput.trim()) return;
    try {
      const res = await fetch('http://localhost:8000/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), room_code: roomInput.trim(), role: 'player' }),
      });
      if (!res.ok) { const err = await res.json(); setErrorMsg(err.detail || 'Failed to enter chamber'); return; }
      const data = await res.json();
      setSession({ roomCode: data.room_code, userId: data.user_id, username: data.username, isHost: data.is_host, role: 'player', mode: data.mode });
    } catch { setErrorMsg('Failed to connect to backend server.'); }
  };

  const handleSpectatorJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !roomInput.trim()) return;
    try {
      const res = await fetch('http://localhost:8000/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), room_code: roomInput.trim(), role: 'spectator' }),
      });
      if (!res.ok) { const err = await res.json(); setErrorMsg(err.detail || 'Failed to join as spectator'); return; }
      const data = await res.json();
      setSession({ roomCode: data.room_code, userId: data.user_id, username: data.username, isHost: false, role: 'spectator', mode: data.mode });
    } catch { setErrorMsg('Failed to connect to backend server.'); }
  };

  const handleSubmitAnswer = async (e: React.FormEvent, puzzleId: string) => {
    e.preventDefault();
    if (!session || !answerInput.trim() || session.role === 'spectator') return;
    const currentAnswer = answerInput.trim();
    setAnswerInput('');
    setOptimisticSolved(prev => ({ ...prev, [puzzleId]: true }));
    try {
      const res = await fetch('http://localhost:8000/api/rooms/submit-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_code: session.roomCode, user_id: session.userId, puzzle_id: puzzleId, answer: currentAnswer }),
      });
      const data = await res.json();
      if (data.status !== 'correct') setOptimisticSolved(prev => ({ ...prev, [puzzleId]: false }));
    } catch { setOptimisticSolved(prev => ({ ...prev, [puzzleId]: false })); }
  };

  const handleVote = async (vote: string) => {
    if (!session || voteState.myVote || session.role === 'spectator') return;
    setVoteState(prev => ({ ...prev, myVote: vote }));
    try {
      await fetch('http://localhost:8000/api/rooms/vote-difficulty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_code: session.roomCode, user_id: session.userId, puzzle_id: voteState.puzzle_id, vote }),
      });
    } catch { console.error('Vote failed'); }
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
    if (timerRef.current) clearInterval(timerRef.current);
    if (voteTimerRef.current) clearInterval(voteTimerRef.current);
    setSession(null); setRoomState(null); setOptimisticSolved({});
    setLatestCritique(null); setActiveHintBanner(null);
    setShowSummary(false); setSummaryReport(null); setChatLog([]);
    setLoreEntries([]); setShowCodex(false); setHasNewLore(false);
    setTeamScores({ team_a: 0, team_b: 0 });
  };

  const handleCopyCode = useCallback(() => {
    if (session) {
      navigator.clipboard.writeText(session.roomCode).then(() => {
        setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000);
      });
    }
  }, [session]);

  // ---- SCREENS ----
  if (!session) {
    return (
      <LobbyScreen
        username={username} setUsername={setUsername}
        topic={topic} setTopic={setTopic}
        studyText={studyText} setStudyText={setStudyText}
        roomInput={roomInput} setRoomInput={setRoomInput}
        errorMsg={errorMsg}
        gameMode={gameMode} setGameMode={setGameMode}
        handleCreateRoom={handleCreateRoom}
        handleJoinRoom={handleJoinRoom}
        handleSpectatorJoin={handleSpectatorJoin}
      />
    );
  }

  if (showSummary && summaryReport) {
    return <SummaryScreen report={summaryReport} onReturn={handleLeaveRoom} teamScores={teamScores} mode={session.mode} />;
  }

  // ---- ROOM SCREEN ----
  const usersList    = roomState ? Object.values(roomState.users) : [];
  const playersList  = usersList.filter(u => u.role === 'player');
  const activePuzzle = roomState?.puzzles[roomState.current_puzzle_index] ?? null;
  const isCurrentSolved = activePuzzle ? (activePuzzle.solved || optimisticSolved[activePuzzle.id]) : false;
  const diffCfg     = DIFFICULTY_CONFIG[roomState?.difficulty ?? 'medium'] ?? DIFFICULTY_CONFIG['medium'];
  const puzzleIcon  = activePuzzle ? getPuzzleIcon(activePuzzle.puzzle_type) : '🗝️';
  const solvedCount = roomState?.puzzles.filter(p => p.solved || optimisticSolved[p.id]).length ?? 0;
  const totalCount  = roomState?.puzzles.length ?? 0;
  const roomMode    = roomState?.mode ?? session.mode ?? 'cooperative';

  // banner offset
  const hasBannerTop = latestCritique || activeHintBanner;
  const scoreboardH  = roomMode === 'competitive' ? 48 : 0;
  const bannerOffset = scoreboardH + (hasBannerTop ? 56 : 0);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }} className={battleFlash === 'fire' ? 'battle-flash-fire' : battleFlash === 'ice' ? 'battle-flash-ice' : ''}>
      <ParticleCanvas />
      <div className="particle-bg" />

      <Confetti active={showConfetti} />

      {/* ---- COMPETITIVE SCOREBOARD ---- */}
      <TeamScoreboard
        teamScores={teamScores}
        teams={roomState?.teams ?? {}}
        users={roomState?.users ?? {}}
        solverTeam={solverTeam}
        mode={roomMode}
        topOffset={0}
      />

      {/* ---- BANNERS ---- */}
      {latestCritique && (
        <div className="banner-arcane" style={{ position: 'fixed', top: scoreboardH, left: 0, right: 0, zIndex: 100, padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '1.4rem' }}>🤖</span>
            <div>
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', color: '#c084fc', textTransform: 'uppercase', marginBottom: 2 }}>
                Oracle Reflection ✦ New Difficulty: {latestCritique.recommended_difficulty.toUpperCase()}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#e9d5ff' }}>{latestCritique.reasoning}</div>
            </div>
          </div>
          <button id="banner-critique-close" onClick={() => setLatestCritique(null)} style={{ color: '#c084fc', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
        </div>
      )}

      {activeHintBanner && (
        <div className="banner-amber" style={{ position: 'fixed', top: scoreboardH + (latestCritique ? 56 : 0), left: 0, right: 0, zIndex: 99, padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '1.4rem' }}>💡</span>
            <div>
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', color: '#fbbf24', textTransform: 'uppercase', marginBottom: 2 }}>
                ✦ Whisper from the Shadows
              </div>
              <div style={{ fontSize: '0.8rem', color: '#fde68a' }}>{activeHintBanner.subtle_hint}</div>
            </div>
          </div>
          <button id="banner-hint-close" onClick={() => setActiveHintBanner(null)} style={{ color: '#fbbf24', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
        </div>
      )}

      {/* ---- VOTE MODAL ---- */}
      <VoteModal vote={voteState} onVote={handleVote} onClose={() => { setVoteState(prev => ({ ...prev, visible: false })); if (voteTimerRef.current) clearInterval(voteTimerRef.current); }} />

      {/* ---- CODEX DRAWER ---- */}
      {showCodex && (
        <CodexDrawer entries={loreEntries} onClose={() => { setShowCodex(false); setHasNewLore(false); }} hasNew={hasNewLore} />
      )}

      {/* ---- MAIN 3-COLUMN LAYOUT ---- */}
      <div style={{ display: 'flex', flex: 1, minHeight: '100vh', paddingTop: bannerOffset, position: 'relative', zIndex: 1 }}>

        {/* ===== LEFT SIDEBAR ===== */}
        <div style={{
          width: 280,
          flexShrink: 0,
          background: 'linear-gradient(180deg, var(--bg-abyss) 0%, var(--bg-deep) 100%)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px 16px',
          gap: 20,
          position: 'relative',
        }}>
          {/* Top gradient accent */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, var(--gold), var(--arcane-bright), transparent)', opacity: 0.5 }} />

          {/* Room code & info */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.55rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>Chamber Code</span>
              <span className={`badge ${diffCfg.className}`}>{diffCfg.label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="font-mono animate-glow-pulse" style={{ fontSize: '1.9rem', fontWeight: 700, letterSpacing: '0.15em', color: '#d4a853', lineHeight: 1.1 }}>
                {session.roomCode}
              </div>
              <button id="copy-room-code-btn" onClick={handleCopyCode} title="Copy room code" style={{
                background: copiedCode ? 'rgba(52,211,153,0.1)' : 'rgba(212,168,83,0.06)',
                border: `1px solid ${copiedCode ? 'rgba(52,211,153,0.35)' : 'rgba(212,168,83,0.2)'}`,
                borderRadius: 8, color: copiedCode ? '#6ee7b7' : 'var(--text-dim)',
                cursor: 'pointer', padding: '5px 9px', fontSize: '0.7rem',
                transition: 'all 0.25s', flexShrink: 0,
              }}>
                {copiedCode ? '✓' : '📋'}
              </button>
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: 4, fontStyle: 'italic' }}>
              {roomState?.topic}
            </div>
          </div>

          {/* Connection indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: connected ? '#34d399' : '#f87171', boxShadow: connected ? '0 0 8px rgba(52,211,153,0.6)' : '0 0 8px rgba(248,113,113,0.6)', animation: connected ? 'glow-pulse 2s ease-in-out infinite' : 'none', display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: '0.65rem', color: connected ? '#6ee7b7' : '#fca5a5', fontFamily: 'Cinzel, serif', letterSpacing: '0.08em' }}>
              {connected ? 'Connected' : 'Disconnected'}
            </span>
            {session.role === 'spectator' && (
              <span className="badge badge-spectator" style={{ fontSize: '0.5rem' }}>SPECTATOR</span>
            )}
          </div>

          {/* Spectator count */}
          {spectatorCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.68rem', color: '#94a3b8', fontFamily: 'Cinzel, serif', letterSpacing: '0.08em' }}>
              <span>👁</span> {spectatorCount} watching
            </div>
          )}

          {/* Progress */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.55rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>Escape Progress</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', color: '#d4a853' }}>{solvedCount}/{totalCount}</span>
            </div>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${totalCount ? (solvedCount / totalCount) * 100 : 0}%` }} />
            </div>
          </div>

          {/* Puzzle chain timeline */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.55rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 10 }}>
              Puzzle Chain
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', maxHeight: 260 }}>
              {roomState?.puzzles.map((p, idx) => {
                const isSolved  = p.solved || optimisticSolved[p.id];
                const isCurrent = idx === roomState.current_puzzle_index;
                const icon = getPuzzleIcon(p.puzzle_type);
                return (
                  <div key={p.id} className={`chain-link ${isSolved ? 'solved' : isCurrent ? 'active' : 'locked'}`}>
                    <span style={{ fontSize: '0.95rem', flexShrink: 0 }}>{icon}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif', fontSize: '0.74rem' }}>{p.title}</span>
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
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.55rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 8 }}>
              Adventurers ({playersList.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {playersList.map(u => (
                <div key={u.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10 }}>
                  <div className="player-avatar" style={{ background: avatarGradient(u.username), width: 26, height: 26, fontSize: '0.6rem' }}>
                    {getInitials(u.username)}
                  </div>
                  <span style={{ flex: 1, fontSize: '0.76rem', color: 'var(--text-bright)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.username}</span>
                  {u.user_id === roomState?.host_id && (
                    <span className="badge badge-gold" style={{ fontSize: '0.5rem', padding: '2px 6px' }}>HOST</span>
                  )}
                  {/* Team badge */}
                  {roomMode === 'competitive' && roomState?.teams && (
                    roomState.teams['team_a']?.includes(u.user_id)
                      ? <span className="badge badge-fire" style={{ fontSize: '0.5rem', padding: '2px 5px' }}>🔥A</span>
                      : roomState.teams['team_b']?.includes(u.user_id)
                      ? <span className="badge badge-ice" style={{ fontSize: '0.5rem', padding: '2px 5px' }}>❄️B</span>
                      : null
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Codex + Leave */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button id="codex-btn" onClick={() => { setShowCodex(true); setHasNewLore(false); }} className="btn-hint" style={{ width: '100%', position: 'relative' }}>
              📖 Lore Codex
              {hasNewLore && (
                <span style={{ position: 'absolute', top: 6, right: 8, width: 8, height: 8, borderRadius: '50%', background: '#d4a853', boxShadow: '0 0 8px rgba(212,168,83,0.8)', animation: 'glow-pulse 1.5s ease-in-out infinite' }} />
              )}
            </button>
            <button id="leave-room-btn" onClick={handleLeaveRoom} className="btn-danger" style={{ width: '100%', textAlign: 'center' }}>
              🚪 Abandon Chamber
            </button>
          </div>
        </div>

        {/* ===== CENTER — PUZZLE AREA ===== */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg-deep)' }}>
          <div style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' }}>
            {activePuzzle ? (
              <div className="animate-fade-up" style={{ maxWidth: 720, margin: '0 auto' }}>
                {/* Puzzle header row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '1.5rem' }}>{puzzleIcon}</span>
                    <span className="badge badge-arcane">{activePuzzle.puzzle_type}</span>
                    {isCurrentSolved && (
                      <span className="badge badge-emerald unlock-celebration" style={{ fontSize: '0.65rem', padding: '5px 14px' }}>
                        ✨ Seal Broken!
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className={`timer-display ${elapsedSeconds > 60 ? 'warning' : ''}`}>
                      ⏱ {formatTime(elapsedSeconds)}
                    </div>
                  </div>
                </div>

                {/* Puzzle title */}
                <h2 className="font-cinzel-deco" style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-bright)', marginBottom: 22, lineHeight: 1.3 }}>
                  {activePuzzle.title}
                </h2>

                {/* Puzzle body */}
                <div className="puzzle-card" style={{ marginBottom: 20 }}>
                  <p className="font-fell animate-ink-reveal" style={{ fontSize: '1.1rem', color: 'var(--text-parchment)', lineHeight: 1.85 }}>
                    {activePuzzle.riddle_text || activePuzzle.problem_statement || activePuzzle.passage || activePuzzle.prompt}
                  </p>
                </div>

                {/* Clues */}
                {activePuzzle.clues && activePuzzle.clues.length > 0 && (
                  <div style={{ background: 'rgba(4,2,8,0.7)', border: '1px solid rgba(212,168,83,0.18)', borderRadius: 14, padding: '18px 22px', marginBottom: 20, position: 'relative' }}>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.6rem', letterSpacing: '0.12em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 12 }}>
                      🔮 Arcane Clues
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                      {activePuzzle.clues.map((c, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, color: 'var(--text-mid)', fontSize: '0.85rem' }}>
                          <span style={{ color: 'var(--gold-dim)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', marginTop: 3, flexShrink: 0 }}>
                            {String(i + 1).padStart(2, '0')}.
                          </span>
                          <span className="font-fell" style={{ fontSize: '1rem', lineHeight: 1.55 }}>{c}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hint reveal */}
                {!isCurrentSolved && activePuzzle.hint && (
                  <div style={{ marginBottom: 18 }}>
                    {!showHint ? (
                      <button id="show-hint-btn" onClick={() => setShowHint(true)} className="btn-hint" style={{ fontSize: '0.72rem' }}>
                        🔮 Seek the Oracle's Wisdom
                      </button>
                    ) : (
                      <div style={{ background: 'rgba(212,168,83,0.06)', border: '1px solid rgba(212,168,83,0.25)', borderRadius: 12, padding: '14px 18px', animation: 'fade-in 0.4s ease' }}>
                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.6rem', color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                          🔮 Oracle's Whisper
                        </div>
                        <p className="font-fell" style={{ fontSize: '0.98rem', color: 'var(--text-parchment)', lineHeight: 1.7, fontStyle: 'italic' }}>
                          {activePuzzle.hint}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Answer form / success state / spectator bar */}
                {session.role === 'spectator' ? (
                  <div className="spectator-bar">
                    <span style={{ fontSize: '1.4rem' }}>👁</span>
                    <div>
                      <div style={{ fontFamily: 'Cinzel Decorative, serif', fontSize: '0.7rem', letterSpacing: '0.06em', marginBottom: 3 }}>Spectating</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>You are watching — only players can submit answers</div>
                    </div>
                  </div>
                ) : !isCurrentSolved ? (
                  <div>
                    {/* Failed attempts candles */}
                    {(activePuzzle.failed_attempts ?? 0) > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.58rem', color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                          Failed attempts:
                        </span>
                        <div className="attempts-display">
                          {Array.from({ length: Math.min(activePuzzle.failed_attempts ?? 0, 5) }).map((_, i) => (
                            <span key={i} className="candle-icon burned">🕯️</span>
                          ))}
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: '#f87171', marginLeft: 4 }}>
                            ×{activePuzzle.failed_attempts}
                          </span>
                        </div>
                      </div>
                    )}
                    <form id="answer-form" onSubmit={e => handleSubmitAnswer(e, activePuzzle.id)} style={{ display: 'flex', gap: 12 }}>
                      <div style={{ flex: 1, position: 'relative' }}>
                        <input
                          id="answer-input" type="text" value={answerInput}
                          onChange={e => setAnswerInput(e.target.value)}
                          placeholder="Speak the passphrase or answer…"
                          className={`input-arcane ${answerShake ? 'animate-shake' : ''}`}
                          style={{ fontFamily: 'JetBrains Mono, monospace' }}
                        />
                      </div>
                      <button id="answer-submit-btn" type="submit" disabled={!answerInput.trim()} className="btn-primary"
                        style={{ whiteSpace: 'nowrap', fontSize: '0.8rem', padding: '12px 22px' }}>
                        🗝 Break the Seal
                      </button>
                    </form>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', marginTop: 6, fontStyle: 'italic' }}>
                      Press <kbd style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '1px 5px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: 'var(--text-mid)' }}>Enter</kbd> to submit
                    </div>
                  </div>
                ) : (
                  <div className="unlock-celebration" style={{
                    background: 'linear-gradient(135deg, rgba(52,211,153,0.08), rgba(52,211,153,0.03))',
                    border: '1px solid rgba(52,211,153,0.3)', borderRadius: 14,
                    padding: '20px 26px', display: 'flex', alignItems: 'center', gap: 16,
                  }}>
                    <span style={{ fontSize: '2.2rem' }}>🎉</span>
                    <div>
                      <div className="font-cinzel" style={{ color: '#6ee7b7', fontSize: '0.88rem', fontWeight: 700, marginBottom: 5 }}>Chamber Unlocked!</div>
                      <div style={{ color: '#a7f3d0', fontSize: '0.78rem' }}>
                        Solved by <strong>{activePuzzle.solved_by || session.username}</strong> — advancing to the next seal…
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
                <div style={{ fontSize: '3rem', animation: 'float-rune 4s ease-in-out infinite' }}>⌛</div>
                <p className="font-cinzel" style={{ color: 'var(--text-dim)', fontSize: '0.85rem', letterSpacing: '0.1em' }}>Awaiting puzzle generation…</p>
              </div>
            )}
          </div>
        </div>

        {/* ===== RIGHT — CHAT PANEL ===== */}
        <div style={{
          width: 300,
          flexShrink: 0,
          background: 'linear-gradient(180deg, var(--bg-abyss) 0%, var(--bg-deep) 100%)',
          borderLeft: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}>
          {/* Top gradient accent */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, var(--arcane-bright), var(--gold), transparent)', opacity: 0.4 }} />

          {/* Chat header */}
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: '0.9rem' }}>🗺</span>
            <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.58rem', letterSpacing: '0.1em', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              Team Comms & Oracle Feed
            </span>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {chatLog.length === 0 && (
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontStyle: 'italic', textAlign: 'center', paddingTop: 12, fontFamily: 'IM Fell English, serif' }}>
                The chamber is silent… for now.
              </div>
            )}
            {chatLog.map((msg, idx) => {
              const isSystem  = msg.sender === 'SYSTEM' || msg.sender === 'ORACLE';
              const isWhisper = msg.sender === 'WHISPER' || msg.isHint;
              const isSpec    = msg.role === 'spectator';
              return (
                <div key={idx} className={`chat-msg ${isWhisper ? 'hint' : isSystem ? 'system' : isSpec ? 'spectator-msg' : 'player'}`}>
                  <span style={{
                    fontFamily: 'Cinzel, serif', fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.08em',
                    marginRight: 7, color: isWhisper ? '#fbbf24' : isSystem ? 'var(--text-dim)' : '#d4a853',
                    textTransform: 'uppercase',
                  }}>
                    [{isSpec ? '👁 ' : ''}{msg.sender}]
                  </span>
                  {msg.text}
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          <form id="chat-form" onSubmit={handleSendChat} style={{ padding: '10px 14px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 8, flexShrink: 0 }}>
            <input
              id="chat-input" type="text" value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder={session.role === 'spectator' ? 'Spectators can chat…' : 'Speak to your adventurers…'}
              className="input-arcane"
              style={{ fontSize: '0.76rem', padding: '9px 13px' }}
            />
            <button id="chat-send-btn" type="submit" style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border-dim)', borderRadius: 9,
              color: 'var(--text-dim)', fontFamily: 'Cinzel, serif', fontSize: '0.62rem', letterSpacing: '0.08em',
              padding: '9px 14px', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { (e.target as HTMLButtonElement).style.color = 'var(--gold)'; (e.target as HTMLButtonElement).style.borderColor = 'var(--gold)'; }}
            onMouseLeave={e => { (e.target as HTMLButtonElement).style.color = 'var(--text-dim)'; (e.target as HTMLButtonElement).style.borderColor = 'var(--border-dim)'; }}>
              ⚡
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;
