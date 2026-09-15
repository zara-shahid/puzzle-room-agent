import React, { useState, useEffect, useRef } from 'react';

export function App() {
  const [clientId] = useState(() => 'user_' + Math.floor(Math.random() * 1000));
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8000/ws/${clientId}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (event) => {
      setMessages((prev) => [...prev, event.data]);
    };

    return () => {
      ws.close();
    };
  }, [clientId]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (wsRef.current && inputMsg.trim()) {
      wsRef.current.send(inputMsg);
      setInputMsg('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-slate-800/80 px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
              The Puzzle Room Agent
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Day 1: WebSocket Spike & Infrastructure</p>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`w-3 h-3 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        {/* Client Tag */}
        <div className="bg-slate-800/30 px-6 py-2 border-b border-slate-800 flex justify-between items-center text-xs text-slate-400">
          <span>Client Identifier: <code className="text-cyan-400 font-mono">{clientId}</code></span>
          <span>WebSocket URL: <code className="text-slate-500 font-mono">ws://localhost:8000/ws/{clientId}</code></span>
        </div>

        {/* Messages Container */}
        <div className="flex-1 p-6 space-y-3 min-h-[300px] max-h-[400px] overflow-y-auto bg-slate-950/50">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2 py-12">
              <span className="text-sm">No WebSocket messages received yet.</span>
              <span className="text-xs text-slate-600">Type a message below to test real-time broadcast.</span>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div key={index} className="p-3 rounded-lg bg-slate-800/70 border border-slate-700/50 text-sm font-mono text-slate-200 animate-fadeIn">
                {msg}
              </div>
            ))
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={sendMessage} className="p-4 border-t border-slate-800 bg-slate-900 flex space-x-3">
          <input
            type="text"
            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 transition"
            placeholder="Type a message to broadcast..."
            value={inputMsg}
            onChange={(e) => setInputMsg(e.target.value)}
            disabled={!connected}
          />
          <button
            type="submit"
            disabled={!connected || !inputMsg.trim()}
            className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-medium text-sm px-5 py-2.5 rounded-xl transition duration-150 shadow-md shadow-cyan-900/20"
          >
            Send Spike
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;
