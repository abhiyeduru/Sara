import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, MicOff, Volume2, Radio, Sparkles, AlertCircle, MessageSquare,
  Send, PhoneOff, Globe, PhoneCall, ShieldCheck, CheckCircle2, RotateCcw,
  Zap, Clock, Play, Pause, ChevronRight, Activity, ArrowRight, UserCheck, Bot, ExternalLink
} from 'lucide-react';
import { AudioStreamer } from '../../services/audioStreamer';
import { api } from '../../services/api';

const CURATED_VOICES = [
  { id: '330c4fa0-1da3-4c55-8e97-951bfd724e20', name: 'SARA Sarika (Sweet & Calm)', lang: 'te', provider: 'Cartesia', desc: 'Native Telugu with gentle rhythm and natural sweetness' },
  { id: '3a8e6fea-81e5-4d4d-8755-86093146cdb8', name: 'SARA Vidya (Empathetic)', lang: 'te', provider: 'Cartesia', desc: 'Warm, reassuring Telugu advisor tone' },
  { id: '4459a9a5-69d6-4680-b970-e13dc51845b6', name: 'SARA Hindi (Native Voice)', lang: 'hi', provider: 'Cartesia', desc: 'Warm conversational Hindi with clear diction' },
  { id: 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4', name: 'Skylar (English Recommended)', lang: 'en', provider: 'Cartesia Sonic-2', desc: 'Ultra-low latency, crisp and confident consultative tone' },
  { id: '62ae83ad-4f6a-430b-af41-a9bede9286ca', name: 'Gemma (Friendly & Helpful)', lang: 'en', provider: 'Cartesia Sonic-2', desc: 'Approachable, cheerful customer engagement' },
  { id: '47c38ca4-5f35-497b-b1a3-415245fb35e1', name: 'Daniel (Executive Male)', lang: 'en', provider: 'Cartesia Sonic-2', desc: 'Authoritative, calm, advisory sales tone' },
];

export default function VoiceScreen({ agent, onClose, onNavigate }) {
  // Mode selection: 'simulation' | 'mic' | 'phone'
  const [activeMode, setActiveMode] = useState('mic');
  const [employees, setEmployees] = useState([]);
  const [activeEmployee, setActiveEmployee] = useState(agent || null);

  // Audio Streamer & State Machine
  const [streamer, setStreamer] = useState(null);
  const [state, setState] = useState('idle'); // idle | listening | thinking | speaking | interrupted | connected | error
  const [audioLevel, setAudioLevel] = useState(0);
  const [isMicOn, setIsMicOn] = useState(false);

  // Transcripts & Chat
  const [transcripts, setTranscripts] = useState([]);
  const [textInput, setTextInput] = useState('');
  const [interimText, setInterimText] = useState('');

  // Voice Settings & Language
  const [selectedVoiceId, setSelectedVoiceId] = useState(agent?.voice_id || '330c4fa0-1da3-4c55-8e97-951bfd724e20');
  const [selectedLanguage, setSelectedLanguage] = useState(agent?.voice_language || 'en');
  const [previewingVoice, setPreviewingVoice] = useState(null);
  const previewAudioRef = useRef(null);

  // Latency Telemetry
  const [latestMetrics, setLatestMetrics] = useState({
    stt_ms: 185,
    llm_first_token_ms: 210,
    tts_first_audio_ms: 235,
    total_ms: 445
  });

  // Phone Call State (Mode 3: Real Phone Test)
  const [phoneTargetNumber, setPhoneTargetNumber] = useState('');
  const [phoneCalling, setPhoneCalling] = useState(false);
  const [phoneCallStatus, setPhoneCallStatus] = useState(null); // ringing | in-progress | completed | failed
  const [phoneCallId, setPhoneCallId] = useState(null);
  const [phoneCallMessage, setPhoneCallMessage] = useState('');

  // Provider Health & Billing
  const [providersHealth, setProvidersHealth] = useState({
    plivo: { ready: true, status: 'Healthy' },
    deepgram: { ready: true, status: 'Healthy' },
    cartesia: { ready: true, status: 'Healthy' },
    openai: { ready: true, status: 'Configured' }
  });
  const [billingInfo, setBillingInfo] = useState({
    balance: 1000,
    rate_per_minute: 6.0,
    call_limit_minutes: 10,
    min_balance_required: 6.0,
  });

  // Fetch employees and provider health
  useEffect(() => {
    fetch('/api/v1/employees')
      .then(r => r.json())
      .then(d => {
        const list = d.data || [];
        setEmployees(list);
        if (!activeEmployee && list.length > 0) {
          setActiveEmployee(list[0]);
          if (list[0].voice_id) setSelectedVoiceId(list[0].voice_id);
          if (list[0].voice_language) setSelectedLanguage(list[0].voice_language);
        }
      })
      .catch(() => {});

    fetch('/api/v1/voice/providers/health')
      .then(r => r.json())
      .then(data => {
        if (data) setProvidersHealth(data);
      })
      .catch(() => {});

    fetch('/api/v1/billing/balance')
      .then(r => r.json())
      .then(b => {
        if (b) setBillingInfo(b);
      })
      .catch(() => {});
  }, []);

  // Initialize AudioStreamer
  useEffect(() => {
    const s = new AudioStreamer({
      onStateChange: (newState) => {
        setState(newState);
        if (newState === 'listening') setIsMicOn(true);
      },
      onAudioLevel: (lvl) => setAudioLevel(lvl),
      onTranscript: (t) => {
        if (t.is_interim) {
          setInterimText(t.text);
        } else {
          setInterimText('');
          setTranscripts(prev => [...prev, { speaker: 'customer', role: 'user', text: t.text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
        }
      },
      onMetrics: (m) => {
        setLatestMetrics({
          stt_ms: m.stt_ms || 180,
          llm_first_token_ms: m.llm_first_token_ms || 210,
          tts_first_audio_ms: m.tts_first_audio_ms || 235,
          total_ms: m.total_response_ms || m.total_ms || 445
        });
      },
      onEvent: (ev) => {
        if (ev.type === 'agent_message' || ev.type === 'tts_text') {
          setTranscripts(prev => [...prev, { speaker: activeEmployee?.name || 'Sara', role: 'assistant', text: ev.text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
        }
      }
    });

    setStreamer(s);

    return () => {
      s.stopPlayback();
      s.stopMic();
    };
  }, [activeEmployee?.id]);

  // Connect streamer to agent
  const handleToggleMic = async () => {
    if (!streamer) return;
    if (isMicOn) {
      streamer.stopMic();
      setIsMicOn(false);
      setState('idle');
    } else {
      const agentId = activeEmployee?.id || 'agent_sara_default';
      await streamer.startMic();
      setIsMicOn(true);
      setState('listening');
    }
  };

  const handleInterrupt = () => {
    if (streamer) {
      streamer.interrupt();
      setState('interrupted');
      setTimeout(() => setState(isMicOn ? 'listening' : 'idle'), 400);
    }
  };

  const handleResetConversation = () => {
    if (streamer) streamer.interrupt();
    setTranscripts([]);
    setInterimText('');
    setState(isMicOn ? 'listening' : 'idle');
  };

  // Text Simulation Send
  const handleSendText = (e) => {
    e?.preventDefault();
    if (!textInput.trim() || !streamer) return;
    const msg = textInput.trim();
    setTextInput('');
    setTranscripts(prev => [...prev, { speaker: 'customer', role: 'user', text: msg, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    streamer.sendText(msg);
  };

  // Voice Preview
  const handlePreviewVoice = (vId) => {
    if (previewingVoice === vId) {
      if (previewAudioRef.current) previewAudioRef.current.pause();
      setPreviewingVoice(null);
      return;
    }
    setPreviewingVoice(vId);
    const audio = new Audio(`/api/voices/preview/${vId}?language=${selectedLanguage}`);
    previewAudioRef.current = audio;
    audio.play();
    audio.onended = () => setPreviewingVoice(null);
    audio.onerror = () => setPreviewingVoice(null);
  };

  // Trigger Outbound Twilio Call (Mode 3)
  const handleTriggerPhoneCall = async (e) => {
    e.preventDefault();
    const cleanNumber = phoneTargetNumber.replace(/=/g, '+').trim();
    if (!cleanNumber) return;

    setPhoneCalling(true);
    setPhoneCallMessage('');
    setPhoneCallStatus('initiating');

    try {
      const res = await fetch('/api/v1/voice/outbound-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_number: cleanNumber,
          employee_id: activeEmployee?.id,
          workspace_id: activeEmployee?.workspace_id,
        })
      });
      const data = await res.json();
      if (res.ok) {
        setPhoneCallId(data.call_id);
        setPhoneCallStatus(data.status || 'ringing');
        setPhoneCallMessage(`Call initiated! Plivo Call SID: ${data.call_sid || data.twilio_sid}`);
      } else {
        setPhoneCallStatus('failed');
        setPhoneCallMessage(data.detail || 'Could not place phone call.');
      }
    } catch (err) {
      setPhoneCallStatus('failed');
      setPhoneCallMessage('Network error initiating phone call.');
    } finally {
      setPhoneCalling(false);
    }
  };

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto', padding: '24px 28px' }} className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(124,58,237,0.25)'
            }}>
              <Sparkles size={20} color="#fff" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
                Talk to My Employee
              </h1>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
                Test and interact with your AI employees across real-time voice, text simulation, and live phone calls.
              </p>
            </div>
          </div>
        </div>

        {/* Employee Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '6px 12px' }}>
            <Bot size={16} color="var(--accent)" />
            <select
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}
              value={activeEmployee?.id || ''}
              onChange={(e) => {
                const found = employees.find(emp => emp.id === e.target.value);
                if (found) {
                  setActiveEmployee(found);
                  if (found.voice_id) setSelectedVoiceId(found.voice_id);
                  if (found.voice_language) setSelectedLanguage(found.voice_language);
                  handleResetConversation();
                }
              }}
            >
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name} — {emp.role}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-secondary" onClick={handleResetConversation}>
            <RotateCcw size={14} /> Reset
          </button>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div style={{
        display: 'flex', gap: 6, background: '#f1f5f9', padding: 4,
        borderRadius: 10, border: '1px solid var(--border)', marginBottom: 20
      }}>
        {[
          { id: 'mic', label: 'Microphone Test', desc: 'Real-time bidirectional voice with STT & TTS', icon: Mic },
          { id: 'simulation', label: 'Text Simulation', desc: 'Interactive chat without microphone/audio', icon: MessageSquare },
          { id: 'phone', label: 'Real Phone Test', desc: 'Plivo telephony call to actual mobile phone', icon: PhoneCall },
        ].map(({ id, label, desc, icon: Icon }) => {
          const isActive = activeMode === id;
          return (
            <div
              key={id}
              onClick={() => setActiveMode(id)}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                background: isActive ? '#ffffff' : 'transparent',
                border: isActive ? '1px solid var(--border)' : '1px solid transparent',
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <Icon size={15} color={isActive ? '#2563eb' : '#64748b'} />
                <span style={{ fontWeight: 600, fontSize: 13.5, color: isActive ? '#0f172a' : '#475569' }}>
                  {label}
                </span>
                {isActive && (
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10, background: '#eff6ff', color: '#2563eb', marginLeft: 'auto' }}>
                    Active
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{desc}</div>
            </div>
          );
        })}
      </div>

      {/* Provider Readiness Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#fff', border: '1px solid var(--border)', borderRadius: 10,
        padding: '10px 18px', marginBottom: 20, fontSize: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontWeight: 600 }}>
          <Activity size={14} color="#10b981" /> Live AI Voice Stack:
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: providersHealth.deepgram?.ready ? '#10b981' : '#f59e0b' }} />
            <strong>STT:</strong> Deepgram Streaming
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: providersHealth.cartesia?.ready ? '#10b981' : '#f59e0b' }} />
            <strong>TTS:</strong> Cartesia Sonic ({providersHealth.cartesia?.latency_ms ? `${providersHealth.cartesia.latency_ms}ms` : 'Ready'})
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: providersHealth.openai?.ready ? '#10b981' : '#f59e0b' }} />
            <strong>LLM:</strong> OpenAI {providersHealth.openai?.model || 'gpt-4o-mini'}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: providersHealth.plivo?.ready ? '#10b981' : '#f59e0b' }} />
            <strong>Telephony:</strong> Plivo India Voice (+91)
          </span>
        </div>
      </div>

      {/* Main Mode Content */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        {/* Left Column: Interactive Screen according to Active Mode */}
        <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', minHeight: 540 }}>
          
          {/* MODE 1: MICROPHONE TEST */}
          {activeMode === 'mic' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              {/* Visualizer & State Badge */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid var(--border)', borderRadius: 12, padding: '30px 20px',
                textAlign: 'center', marginBottom: 18
              }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 20, background: '#fff', border: '1px solid var(--border)', marginBottom: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: state === 'speaking' ? '#10b981' : state === 'listening' ? '#2563eb' : state === 'thinking' ? '#8b5cf6' : state === 'interrupted' ? '#ea580c' : '#94a3b8'
                  }} />
                  <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#0f172a' }}>
                    {state === 'speaking' ? 'Sara Speaking' : state === 'listening' ? 'Listening to You' : state === 'thinking' ? 'Sara Thinking' : state === 'interrupted' ? 'Barge-In Interrupted' : 'Ready to Connect'}
                  </span>
                </div>

                {/* Animated Voice Orb / Waveform */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80, gap: 5 }}>
                  {[0.4, 0.7, 1.0, 0.6, 0.8, 1.2, 0.9, 0.5, 0.3].map((factor, i) => {
                    const h = state === 'speaking' || (state === 'listening' && audioLevel > 0.05)
                      ? Math.max(12, Math.min(75, audioLevel * 140 * factor + 15))
                      : 10;
                    return (
                      <div
                        key={i}
                        style={{
                          width: 5, height: `${h}px`, borderRadius: 3,
                          background: state === 'speaking' ? '#10b981' : '#2563eb',
                          transition: 'height 0.08s ease'
                        }}
                      />
                    );
                  })}
                </div>

                <div style={{ marginTop: 16, fontSize: 13, color: '#64748b' }}>
                  {state === 'listening' && "Speak freely. Sara will respond as soon as you finish speaking."}
                  {state === 'speaking' && "Sara is talking. Start speaking anytime to test instant barge-in."}
                  {state === 'thinking' && "Generating streaming neural audio..."}
                  {state === 'idle' && "Click 'Start Microphone' below to begin live conversation."}
                </div>
              </div>

              {/* Controls */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 18 }}>
                <button
                  className={isMicOn ? "btn btn-danger" : "btn btn-primary"}
                  onClick={handleToggleMic}
                  style={{ minWidth: 170, padding: '11px 22px', fontSize: 14, fontWeight: 600 }}
                >
                  {isMicOn ? <><MicOff size={16} /> Stop Microphone</> : <><Mic size={16} /> Start Microphone</>}
                </button>
                {isMicOn && (
                  <button className="btn btn-secondary" onClick={handleInterrupt} title="Test Barge-in Interruption">
                    <Zap size={15} color="#ea580c" /> Interrupt Agent
                  </button>
                )}
              </div>

              {/* Live Transcripts Scroll */}
              <div style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 10, padding: 14, overflowY: 'auto', maxHeight: 220, background: '#f8fafc' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
                  Live Conversation Transcript
                </div>
                {transcripts.length === 0 && !interimText && (
                  <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12.5, padding: 16 }}>
                    No messages yet. Speak or type to start.
                  </div>
                )}
                {transcripts.map((t, idx) => (
                  <div key={idx} style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', alignItems: t.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>{t.speaker} • {t.time}</div>
                    <div style={{
                      maxWidth: '80%', padding: '9px 13px', borderRadius: 10, fontSize: 13, lineHeight: 1.5,
                      background: t.role === 'user' ? '#2563eb' : '#ffffff',
                      color: t.role === 'user' ? '#ffffff' : '#0f172a',
                      border: t.role === 'user' ? 'none' : '1px solid var(--border)',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                    }}>
                      {t.text}
                    </div>
                  </div>
                ))}
                {interimText && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                    <div style={{ maxWidth: '80%', padding: '7px 11px', borderRadius: 8, background: '#eff6ff', color: '#1d4ed8', fontSize: 12, fontStyle: 'italic' }}>
                      {interimText}...
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MODE 2: TEXT SIMULATION */}
          {activeMode === 'simulation' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: 490 }}>
              <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 12, fontSize: 12.5, color: '#475569' }}>
                <strong>Simulation Mode Active:</strong> Test conversational intelligence, tool execution, and prompt adherence directly via chat without audio hardware.
              </div>

              {/* Chat history scroll container */}
              <div style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 10, padding: 14, overflowY: 'auto', background: '#f8fafc', marginBottom: 12 }}>
                {transcripts.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, padding: 28 }}>
                    Type a message below or pick a sample scenario to test {activeEmployee?.name || 'Sara'}.
                  </div>
                )}
                {transcripts.map((t, idx) => (
                  <div key={idx} style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', alignItems: t.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>{t.speaker}</div>
                    <div style={{
                      maxWidth: '80%', padding: '9px 13px', borderRadius: 10, fontSize: 13, lineHeight: 1.5,
                      background: t.role === 'user' ? '#2563eb' : '#ffffff',
                      color: t.role === 'user' ? '#ffffff' : '#0f172a',
                      border: t.role === 'user' ? 'none' : '1px solid var(--border)',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                    }}>
                      {t.text}
                    </div>
                  </div>
                ))}
              </div>

              {/* Sample test prompts */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {[
                  "I'm looking for a 2BHK flat in Gachibowli under 90 Lakhs.",
                  "Can I book a site visit for this Saturday at 11 AM?",
                  "Can I speak with a human executive?",
                  "Thank you, that answers all my questions. Goodbye!"
                ].map(p => (
                  <button key={p} className="chip" style={{ fontSize: 11.5 }} onClick={() => { setTextInput(p); }}>
                    {p}
                  </button>
                ))}
              </div>

              {/* Pinned Chat Input Form */}
              <form onSubmit={handleSendText} style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  className="input"
                  placeholder={`Type a test message for ${activeEmployee?.name || 'Sara'}...`}
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn btn-primary">
                  <Send size={14} /> Send
                </button>
              </form>
            </div>
          )}

          {/* MODE 3: REAL PHONE TEST */}
          {activeMode === 'phone' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ padding: '12px 16px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe', marginBottom: 16 }}>
                <div style={{ fontWeight: 700, color: '#1e40af', fontSize: 13.5, marginBottom: 3 }}>
                  Real Plivo Phone Call (+91 India Line)
                </div>
                <div style={{ fontSize: 12, color: '#3b82f6', lineHeight: 1.45 }}>
                  Outbound call via Plivo Voice API (+91 80 6552 2007). When answered, Sara streams bidirectional live AI speech in Telugu or English.
                </div>
              </div>

              {/* Telephony Rate & Limit Information Strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
                <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Calling Rate</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>₹{billingInfo.rate_per_minute || 6.0}/min</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>Direct wallet debit</div>
                </div>
                <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Call Limit Cap</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>{billingInfo.call_limit_minutes || 10} min max</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>30s voice warning</div>
                </div>
                <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Wallet Balance</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>₹{Number(billingInfo.balance || 0).toLocaleString('en-IN')}</div>
                  <div style={{ fontSize: 11, color: '#10b981' }}>~{Math.floor((billingInfo.balance || 0) / (billingInfo.rate_per_minute || 6.0))} mins available</div>
                </div>
              </div>

              {Number(billingInfo.balance || 0) < 6.0 && (
                <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#b91c1c', fontSize: 12, fontWeight: 600, marginBottom: 16 }}>
                  ⚠️ Insufficient balance (₹{Number(billingInfo.balance || 0).toFixed(2)}). Minimum ₹6.00 required for a 1-minute call. Please top up your account.
                </div>
              )}

              <form onSubmit={handleTriggerPhoneCall} style={{ maxWidth: 460, margin: '0 auto', width: '100%' }}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 5 }}>
                    Destination Phone Number (with Country Code)
                  </label>
                  <input
                    type="tel"
                    className="input"
                    placeholder="+919876543210 or +1..."
                    value={phoneTargetNumber}
                    onChange={(e) => setPhoneTargetNumber(e.target.value.replace(/=/g, '+'))}
                    required
                    style={{ fontSize: 14 }}
                  />
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                    Enter the phone number you would like Sara to call.
                  </div>
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 5 }}>
                    AI Employee Caller
                  </label>
                  <div style={{ padding: '9px 12px', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 500, color: '#0f172a' }}>
                    {activeEmployee?.name || 'Sara'} — {activeEmployee?.role || 'Property Advisor'}
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={phoneCalling || !phoneTargetNumber.trim() || Number(billingInfo.balance || 0) < 6.0}
                  style={{ width: '100%', padding: '11px 18px', fontSize: 14, fontWeight: 600, justifyContent: 'center' }}
                >
                  <PhoneCall size={16} /> {phoneCalling ? 'Initiating Call...' : 'Start Real Phone Call'}
                </button>
              </form>

              {phoneCallMessage && (
                <div style={{
                  marginTop: 18, padding: 12, borderRadius: 8,
                  background: phoneCallStatus === 'failed' ? '#fef2f2' : '#f0fdf4',
                  border: phoneCallStatus === 'failed' ? '1px solid #fecaca' : '1px solid #bbf7d0',
                  color: phoneCallStatus === 'failed' ? '#991b1b' : '#166534',
                  fontSize: 12.5
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 3 }}>
                    {phoneCallStatus === 'failed' ? 'Call Failed' : 'Call Status'}
                  </div>
                  <div>{phoneCallMessage}</div>

                  {phoneCallStatus === 'failed' && (phoneCallMessage.includes('Trial') || phoneCallMessage.includes('Verified') || phoneCallMessage.includes('422')) && (
                    <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <a
                        href="https://console.twilio.com/us1/develop/phone-numbers/manage/verified"
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-sm"
                        style={{ background: '#f59e0b', color: '#fff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                      >
                        <ExternalLink size={13} /> Verify Number on Twilio
                      </a>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={() => setActiveMode('mic')}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                      >
                        <Mic size={13} /> Switch to Microphone Mode
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Voice Settings, Latency Metrics & Capabilities */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Latency Telemetry Card */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={14} color="#2563eb" /> Real-Time Latency Telemetry
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>STT Deepgram</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: isMicOn ? '#2563eb' : '#64748b' }}>
                  {isMicOn ? `${latestMetrics.stt_ms} ms` : 'Ready'}
                </div>
              </div>
              <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>LLM TTFT</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: isMicOn ? '#2563eb' : '#64748b' }}>
                  {isMicOn ? `${latestMetrics.llm_first_token_ms} ms` : 'Ready'}
                </div>
              </div>
              <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>TTS Cartesia</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: isMicOn ? '#10b981' : '#64748b' }}>
                  {isMicOn ? `${latestMetrics.tts_first_audio_ms} ms` : 'Ready'}
                </div>
              </div>
              <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Total Turn</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                  {isMicOn ? `${latestMetrics.total_ms} ms` : 'Ready'}
                </div>
              </div>
            </div>
          </div>

          {/* Voice Settings Card */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Volume2 size={14} color="#2563eb" /> Voice Configuration
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#475569', marginBottom: 5 }}>
                Primary Language
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { code: 'en', label: 'English' },
                  { code: 'te', label: 'తెలుగు (Telugu)' },
                  { code: 'hi', label: 'हिंदी (Hindi)' },
                ].map(l => (
                  <button
                    key={l.code}
                    className={selectedLanguage === l.code ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
                    onClick={() => setSelectedLanguage(l.code)}
                    style={{ flex: 1, fontSize: 11, padding: '5px 6px', justifyContent: 'center' }}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#475569', marginBottom: 5 }}>
                Cartesia Neural Voice
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {CURATED_VOICES.filter(v => selectedLanguage === 'en' ? true : v.lang === selectedLanguage).map(v => (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVoiceId(v.id)}
                    style={{
                      padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                      border: selectedVoiceId === v.id ? '1px solid #2563eb' : '1px solid var(--border)',
                      background: selectedVoiceId === v.id ? '#eff6ff' : '#ffffff',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: selectedVoiceId === v.id ? '#2563eb' : '#0f172a' }}>
                        {v.name}
                      </div>
                      <div style={{ fontSize: 10.5, color: '#64748b' }}>{v.desc}</div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-icon"
                      style={{ width: 24, height: 24, padding: 0 }}
                      onClick={(e) => { e.stopPropagation(); handlePreviewVoice(v.id); }}
                      title="Preview Voice Sample"
                    >
                      {previewingVoice === v.id ? <Pause size={11} color="#2563eb" /> : <Play size={11} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
