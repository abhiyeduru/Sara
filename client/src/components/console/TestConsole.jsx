import React, { useState, useEffect } from 'react';
import { Activity, Clock, Zap, Cpu, Volume2, ShieldAlert, CheckCircle2, Terminal } from 'lucide-react';
import { api } from '../../services/api';

export default function TestConsole({ agent, currentMetrics }) {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [liveMetrics, setLiveMetrics] = useState(currentMetrics || {
    stt_ms: 0,
    llm_first_token_ms: 0,
    tts_first_audio_ms: 0,
    time_to_first_audio_ms: 0,
    total_response_ms: 0
  });

  useEffect(() => {
    if (currentMetrics) {
      setLiveMetrics(currentMetrics);
    }
  }, [currentMetrics]);

  useEffect(() => {
    if (agent?.id) {
      loadHistory();
    }
  }, [agent?.id]);

  async function loadHistory() {
    try {
      const sessList = await api.getAgentSessions(agent.id);
      setSessions(sessList);
      if (sessList.length > 0) {
        setSelectedSession(sessList[0]);
      }
    } catch (err) {
      console.error('Error loading session history:', err);
    }
  }

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white">Live Diagnostics & Latency Dashboard</h2>
          <p className="text-xs text-sara-400">High-precision measurements recorded turn-by-turn during voice interactions.</p>
        </div>
        <button
          onClick={loadHistory}
          className="px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-xs text-sara-300 hover:text-white hover:bg-white/10"
        >
          Refresh History
        </button>
      </div>

      {/* Latency Instrumentation Cards (Measured Values Only) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5 mb-8">
        
        <div className="glass-panel p-4 rounded-xl border border-white/5">
          <div className="flex items-center gap-1.5 text-sara-400 text-[11px] font-mono mb-2">
            <Zap className="w-3.5 h-3.5" />
            <span>STT LATENCY</span>
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {liveMetrics.stt_ms > 0 ? `${liveMetrics.stt_ms} ms` : '—'}
          </div>
          <p className="text-[10px] text-sara-500 mt-1">Sarvam AI Saaras/Saarika</p>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-white/5">
          <div className="flex items-center gap-1.5 text-sara-400 text-[11px] font-mono mb-2">
            <Cpu className="w-3.5 h-3.5" />
            <span>LLM FIRST TOKEN</span>
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {liveMetrics.llm_first_token_ms > 0 ? `${liveMetrics.llm_first_token_ms} ms` : '—'}
          </div>
          <p className="text-[10px] text-sara-500 mt-1">Groq (qwen/qwen3.8-27b)</p>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-white/5">
          <div className="flex items-center gap-1.5 text-sara-400 text-[11px] font-mono mb-2">
            <Volume2 className="w-3.5 h-3.5" />
            <span>TTS FIRST AUDIO</span>
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {liveMetrics.tts_first_audio_ms > 0 ? `${liveMetrics.tts_first_audio_ms} ms` : '—'}
          </div>
          <p className="text-[10px] text-sara-500 mt-1">Cartesia Sonic-2</p>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-white/10 bg-white/5">
          <div className="flex items-center gap-1.5 text-white text-[11px] font-mono mb-2">
            <Clock className="w-3.5 h-3.5" />
            <span>TIME TO 1ST AUDIO</span>
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {liveMetrics.time_to_first_audio_ms > 0 ? `${liveMetrics.time_to_first_audio_ms} ms` : '—'}
          </div>
          <p className="text-[10px] text-sara-400 mt-1">End-to-End Latency</p>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-white/5 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-1.5 text-sara-400 text-[11px] font-mono mb-2">
            <Activity className="w-3.5 h-3.5" />
            <span>TOTAL RESPONSE</span>
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {liveMetrics.total_response_ms > 0 ? `${liveMetrics.total_response_ms} ms` : '—'}
          </div>
          <p className="text-[10px] text-sara-500 mt-1">Turn Completion</p>
        </div>

      </div>

      {/* Two Column Layout: Conversation State & Session Transcripts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Session State & Slots */}
        <div className="space-y-4">
          <div className="glass-panel p-5 rounded-xl border border-white/5">
            <h3 className="text-xs font-semibold text-white tracking-wider uppercase mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>Conversation State Machine</span>
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-sara-400">Current Stage</span>
                <span className="font-mono px-2 py-0.5 rounded bg-white/10 text-white font-medium">
                  {selectedSession?.current_stage || 'GREETING'}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-sara-400">Detected Language</span>
                <span className="font-mono text-sara-200 uppercase">
                  {selectedSession?.active_language || 'EN'}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-sara-400">Escalation Status</span>
                <span className="font-mono text-sara-200">Standard</span>
              </div>
            </div>
          </div>

          {/* Business Grounding Info */}
          <div className="glass-panel p-5 rounded-xl border border-white/5">
            <h3 className="text-xs font-semibold text-white tracking-wider uppercase mb-3 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-sara-400" />
              <span>Active Agent Intelligence</span>
            </h3>
            <div className="space-y-2 text-xs text-sara-300">
              <p><strong className="text-white">Business:</strong> {agent?.business_type}</p>
              <p><strong className="text-white">Voice:</strong> {agent?.voice_name} ({agent?.voice_gender})</p>
              <p><strong className="text-white">Personality:</strong> {agent?.personality}</p>
              <p><strong className="text-white">Style:</strong> {agent?.communication_style}</p>
            </div>
          </div>
        </div>

        {/* Right: Message History & Transcripts */}
        <div className="lg:col-span-2 glass-panel p-5 rounded-xl border border-white/5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold text-white tracking-wider uppercase">Turn-by-Turn Transcript History</h3>
            <span className="text-[10px] font-mono text-sara-400">
              {selectedSession?.messages?.length || 0} messages recorded
            </span>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {selectedSession?.messages && selectedSession.messages.length > 0 ? (
              selectedSession.messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-lg text-xs leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-sara-900/90 border border-white/10 ml-8 text-white'
                      : 'bg-white/5 border border-white/5 mr-8 text-sara-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1 text-[10px] font-mono text-sara-400">
                    <span className="uppercase font-semibold tracking-wider">
                      {m.role === 'user' ? 'Caller' : 'SARA'}
                    </span>
                    <div className="flex items-center gap-2">
                      {m.detected_language && (
                        <span className="px-1.5 py-0.2 rounded bg-white/10 uppercase">
                          {m.detected_language}
                        </span>
                      )}
                      {m.detected_intent && (
                        <span className="text-sara-500">
                          [{m.detected_intent}]
                        </span>
                      )}
                    </div>
                  </div>
                  <p>{m.content}</p>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-xs text-sara-500">
                Start speaking or send a test prompt in the Voice Screen to record transcripts and live latency.
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
