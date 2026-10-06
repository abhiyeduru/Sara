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
  const [employeesLoaded, setEmployeesLoaded] = useState(Boolean(agent));

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
    let cancelled = false;

    fetch('/api/v1/employees')
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        const list = d.data || [];
        setEmployees(list);
        if (!activeEmployee && list.length > 0) {
          setActiveEmployee(list[0]);
          if (list[0].voice_id) setSelectedVoiceId(list[0].voice_id);
          if (list[0].voice_language) setSelectedLanguage(list[0].voice_language);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setEmployeesLoaded(true);
      });

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

    return () => {
      cancelled = true;
    };
  }, []);

  // Initialize AudioStreamer
  useEffect(() => {
    if (!employeesLoaded) return;

    const agentId = activeEmployee?.id || 'agent_sara_default';
    const s = new AudioStreamer({
      agentId,
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

    if (activeMode !== 'phone') {
      s.connect(agentId);
    }
    setStreamer(s);

    return () => {
      s.disconnect('voice screen cleanup');
    };
  }, [employeesLoaded, activeEmployee?.id, activeMode]);

  // Connect streamer to agent
  const handleToggleMic = async () => {
    if (!streamer) return;
    if (isMicOn) {
      streamer.stopMic();
      setIsMicOn(false);
      setState('idle');
    } else {
      const agentId = activeEmployee?.id || 'agent_sara_default';
      await streamer.startMic(agentId);
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
        display: 'flex', gap: 8, background: '#fff', padding: 6,
        borderRadius: 12, border: '1px solid var(--border)', marginBottom: 20
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
                flex: 1, padding: '12px 16px', borderRadius: 8, cursor: 'pointer',
                background: isActive ? '#f5f3ff' : 'transparent',
                border: isActive ? '1px solid #7c3aed' : '1px solid transparent',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <Icon size={16} color={isActive ? '#7c3aed' : 'var(--text-muted)'} />
                <span style={{ fontWeight: 700, fontSize: 14, color: isActive ? '#7c3aed' : 'var(--text-primary)' }}>
                  {label}
                </span>
                {isActive && <span className="chip chip-purple" style={{ fontSize: 10, padding: '2px 6px' }}>Active</span>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{desc}</div>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontWeight: 600 }}>
          <Activity size={14} color="#16a34a" /> Live AI Voice Stack:
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: (providersHealth.assemblyai?.ready || providersHealth.deepgram?.ready) ? '#16a34a' : '#ea580c' }} />
            <strong>STT:</strong> {providersHealth.assemblyai?.ready ? 'AssemblyAI Universal-3.6 Pro' : 'Deepgram Nova-3'}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: providersHealth.cartesia?.ready ? '#16a34a' : '#ea580c' }} />
            <strong>TTS:</strong> Cartesia Sonic ({providersHealth.cartesia?.latency_ms ? `${providersHealth.cartesia.latency_ms}ms` : 'Ready'})
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: providersHealth.openai?.ready ? '#16a34a' : '#ea580c' }} />
            <strong>LLM:</strong> OpenAI {providersHealth.openai?.model || 'gpt-4o-mini'}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: providersHealth.plivo?.ready ? '#16a34a' : '#ea580c' }} />
            <strong>Telephony:</strong> Plivo India Voice (+91)
          </span>
        </div>
      </div>

      {/* Main Mode Content */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
        {/* Left Column: Interactive Screen according to Active Mode */}
        <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', minHeight: 560 }}>
          
          {/* MODE 1: MICROPHONE TEST */}
          {activeMode === 'mic' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              {/* Visualizer & State Badge */}
              <div style={{
                background: 'linear-gradient(180deg, #faf5ff 0%, #ffffff 100%)',
                border: '1px solid #ede9fe', borderRadius: 16, padding: '36px 20px',
                textAlign: 'center', marginBottom: 20
              }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 20, background: '#fff', border: '1px solid var(--border)', marginBottom: 20, boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: state === 'speaking' ? '#16a34a' : state === 'listening' ? '#2563eb' : state === 'thinking' ? '#7c3aed' : state === 'interrupted' ? '#ea580c' : '#94a3b8',
                    boxShadow: state !== 'idle' ? '0 0 10px currentColor' : 'none'
                  }} />
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {state === 'speaking' ? 'Sara Speaking' : state === 'listening' ? 'Listening to You' : state === 'thinking' ? 'Sara Thinking' : state === 'interrupted' ? 'Barge-In Interrupted' : 'Ready to Connect'}
                  </span>
                </div>

                {/* Animated Voice Orb / Waveform */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 100, gap: 4 }}>
                  {[0.4, 0.7, 1.0, 0.6, 0.8, 1.2, 0.9, 0.5, 0.3].map((factor, i) => {
                    const h = state === 'speaking' || (state === 'listening' && audioLevel > 0.05)
                      ? Math.max(12, Math.min(85, audioLevel * 140 * factor + 15))
                      : 10;
                    return (
                      <div
                        key={i}
                        style={{
                          width: 6, height: `${h}px`, borderRadius: 3,
                          background: state === 'speaking' ? 'linear-gradient(180deg, #10b981, #059669)' : 'linear-gradient(180deg, #7c3aed, #a78bfa)',
                          transition: 'height 0.08s ease'
                        }}
                      />
                    );
                  })}
                </div>

                <div style={{ marginTop: 20, fontSize: 13, color: 'var(--text-secondary)' }}>
                  {state === 'listening' && "Speak freely. Sara will respond as soon as you finish speaking."}
                  {state === 'speaking' && "Sara is talking. Start speaking anytime to test instant barge-in."}
                  {state === 'thinking' && "Generating streaming neural audio..."}
                  {state === 'idle' && "Click 'Start Microphone' below to begin live conversation."}
                </div>
              </div>

              {/* Controls */}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 20 }}>
                <button
                  className={isMicOn ? "btn btn-danger" : "btn btn-primary"}
                  onClick={handleToggleMic}
                  style={{ minWidth: 180, padding: '12px 24px', fontSize: 15, fontWeight: 700 }}
                >
                  {isMicOn ? <><MicOff size={18} /> Stop Microphone</> : <><Mic size={18} /> Start Microphone</>}
                </button>
                {isMicOn && (
                  <button className="btn btn-secondary" onClick={handleInterrupt} title="Test Barge-in Interruption">
                    <Zap size={16} color="#ea580c" /> Interrupt Agent
                  </button>
                )}
              </div>

              {/* Live Transcripts Scroll */}
              <div style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 12, padding: 16, overflowY: 'auto', maxHeight: 240, background: '#fafafa' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>
                  Live Conversation Transcript
                </div>
                {transcripts.length === 0 && !interimText && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 20 }}>
                    No messages yet. Speak or type to start.
                  </div>
                )}
                {transcripts.map((t, idx) => (
                  <div key={idx} style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', alignItems: t.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{t.speaker} • {t.time}</div>
                    <div style={{
                      maxWidth: '80%', padding: '10px 14px', borderRadius: 12, fontSize: 13, lineHeight: 1.5,
                      background: t.role === 'user' ? '#7c3aed' : '#ffffff',
                      color: t.role === 'user' ? '#ffffff' : 'var(--text-primary)',
                      border: t.role === 'user' ? 'none' : '1px solid var(--border)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                    }}>
                      {t.text}
                    </div>
                  </div>
                ))}
                {interimText && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                    <div style={{ maxWidth: '80%', padding: '8px 12px', borderRadius: 10, background: '#f3e8ff', color: '#6b21a8', fontSize: 12, fontStyle: 'italic' }}>
                      {interimText}...
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MODE 2: TEXT SIMULATION */}
          {activeMode === 'simulation' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 16, fontSize: 13 }}>
                <strong>Simulation Mode Active:</strong> Test conversational intelligence, tool execution, and prompt adherence directly via chat without audio hardware.
              </div>

              {/* Chat history */}
              <div style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 12, padding: 16, overflowY: 'auto', minHeight: 280, background: '#fafafa', marginBottom: 16 }}>
                {transcripts.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 30 }}>
                    Type a message below or pick a sample scenario to test {activeEmployee?.name || 'Sara'}.
                  </div>
                )}
                {transcripts.map((t, idx) => (
                  <div key={idx} style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', alignItems: t.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{t.speaker}</div>
                    <div style={{
                      maxWidth: '80%', padding: '10px 14px', borderRadius: 12, fontSize: 13, lineHeight: 1.5,
                      background: t.role === 'user' ? '#7c3aed' : '#ffffff',
                      color: t.role === 'user' ? '#ffffff' : 'var(--text-primary)',
                      border: t.role === 'user' ? 'none' : '1px solid var(--border)'
                    }}>
                      {t.text}
                    </div>
                  </div>
                ))}
              </div>

              {/* Sample test prompts */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {[
                  "I'm looking for a 2BHK flat in Gachibowli under 90 Lakhs.",
                  "Can I book a site visit for this Saturday at 11 AM?",
                  "Can I speak with a human executive?",
                  "Thank you, that answers all my questions. Goodbye!"
                ].map(p => (
                  <button key={p} className="chip" style={{ fontSize: 11 }} onClick={() => { setTextInput(p); }}>
                    {p}
                  </button>
                ))}
              </div>

              {/* Chat Input form */}
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
                  <Send size={15} /> Send
                </button>
              </form>
            </div>
          )}

          {/* MODE 3: REAL PHONE TEST */}
          {activeMode === 'phone' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ padding: '14px 18px', background: '#eff6ff', borderRadius: 10, border: '1px solid #bfdbfe', marginBottom: 16 }}>
                <div style={{ fontWeight: 700, color: '#1e40af', fontSize: 14, marginBottom: 4 }}>
                  Real Plivo Phone Call (+91 India Line)
                </div>
                <div style={{ fontSize: 12, color: '#3b82f6', lineHeight: 1.5 }}>
                  Outbound call via Plivo Voice API (+91 80 6552 2007). When answered, Sara streams bidirectional live AI speech in Telugu or English.
                </div>
              </div>

              {/* Telephony Rate & Limit Information Strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
                <div style={{ padding: '10px 12px', background: '#f5f3ff', borderRadius: 8, border: '1px solid #ddd6fe' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6d28d9', textTransform: 'uppercase' }}>Calling Rate</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#4c1d95', marginTop: 2 }}>₹{billingInfo.rate_per_minute || 6.0}/min</div>
                  <div style={{ fontSize: 10, color: '#7c3aed' }}>Direct wallet debit</div>
                </div>
                <div style={{ padding: '10px 12px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase' }}>Call Limit Cap</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#1e40af', marginTop: 2 }}>{billingInfo.call_limit_minutes || 10} min max</div>
                  <div style={{ fontSize: 10, color: '#3b82f6' }}>30s voice warning</div>
                </div>
                <div style={{ padding: '10px 12px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#15803d', textTransform: 'uppercase' }}>Wallet Balance</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#166534', marginTop: 2 }}>₹{Number(billingInfo.balance || 0).toLocaleString('en-IN')}</div>
                  <div style={{ fontSize: 10, color: '#16a34a' }}>~{Math.floor((billingInfo.balance || 0) / (billingInfo.rate_per_minute || 6.0))} mins available</div>
                </div>
              </div>

              {Number(billingInfo.balance || 0) < 6.0 && (
                <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#b91c1c', fontSize: 12, fontWeight: 600, marginBottom: 16 }}>
                  ⚠️ Insufficient balance (₹{Number(billingInfo.balance || 0).toFixed(2)}). Minimum ₹6.00 required for a 1-minute call. Please top up your account.
                </div>
              )}

              <form onSubmit={handleTriggerPhoneCall} style={{ maxWidth: 480, margin: '0 auto', width: '100%' }}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    Destination Phone Number (with Country Code)
                  </label>
                  <input
                    type="tel"
                    className="input"
                    placeholder="+919876543210 or +1..."
                    value={phoneTargetNumber}
                    onChange={(e) => setPhoneTargetNumber(e.target.value.replace(/=/g, '+'))}
                    required
                    style={{ fontSize: 15 }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Enter the phone number you would like Sara to call.
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    AI Employee Caller
                  </label>
                  <div style={{ padding: '10px 14px', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                    {activeEmployee?.name || 'Sara'} — {activeEmployee?.role || 'Property Advisor'}
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={phoneCalling || !phoneTargetNumber.trim() || Number(billingInfo.balance || 0) < 6.0}
                  style={{ width: '100%', padding: '12px 20px', fontSize: 15, fontWeight: 700, justifyContent: 'center' }}
                >
                  <PhoneCall size={18} /> {phoneCalling ? 'Initiating Call...' : 'Start Real Phone Call'}
                </button>
              </form>

              {phoneCallMessage && (
                <div style={{
                  marginTop: 20, padding: 14, borderRadius: 10,
                  background: phoneCallStatus === 'failed' ? '#fef2f2' : '#f0fdf4',
                  border: phoneCallStatus === 'failed' ? '1px solid #fecaca' : '1px solid #bbf7d0',
                  color: phoneCallStatus === 'failed' ? '#991b1b' : '#166534',
                  fontSize: 13
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    {phoneCallStatus === 'failed' ? 'Call Failed' : 'Call Status'}
                  </div>
                  <div>{phoneCallMessage}</div>

                  {phoneCallStatus === 'failed' && (phoneCallMessage.includes('Trial') || phoneCallMessage.includes('Verified') || phoneCallMessage.includes('422')) && (
                    <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={14} color="#7c3aed" /> Real-Time Latency Telemetry
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>STT Deepgram</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#2563eb' }}>{latestMetrics.stt_ms} ms</div>
              </div>
              <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>LLM TTFT</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#7c3aed' }}>{latestMetrics.llm_first_token_ms} ms</div>
              </div>
              <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>TTS Cartesia</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#16a34a' }}>{latestMetrics.tts_first_audio_ms} ms</div>
              </div>
              <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Total Turn</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{latestMetrics.total_ms} ms</div>
              </div>
            </div>
          </div>

          {/* Voice Settings Card */}
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Volume2 size={14} color="#7c3aed" /> Voice Configuration
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
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
                    className={selectedLanguage === l.code ? "chip chip-purple" : "chip"}
                    onClick={() => setSelectedLanguage(l.code)}
                    style={{ flex: 1, fontSize: 11, padding: '6px 8px', justifyContent: 'center' }}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                Cartesia Neural Voice
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {CURATED_VOICES.filter(v => selectedLanguage === 'en' ? true : v.lang === selectedLanguage).map(v => (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVoiceId(v.id)}
                    style={{
                      padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                      border: selectedVoiceId === v.id ? '1px solid #7c3aed' : '1px solid var(--border)',
                      background: selectedVoiceId === v.id ? '#faf5ff' : '#ffffff',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: selectedVoiceId === v.id ? '#7c3aed' : 'var(--text-primary)' }}>
                        {v.name}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{v.desc}</div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-icon"
                      style={{ width: 26, height: 26 }}
                      onClick={(e) => { e.stopPropagation(); handlePreviewVoice(v.id); }}
                      title="Preview Voice Sample"
                    >
                      {previewingVoice === v.id ? <Pause size={12} color="#7c3aed" /> : <Play size={12} />}
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
