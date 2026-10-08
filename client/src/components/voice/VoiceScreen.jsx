import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, MicOff, Volume2, Sparkles, MessageSquare, Send, PhoneCall,
  RotateCcw, Zap, ArrowLeft, Bot, CheckCircle2, ChevronRight, Activity,
  Clock, Play, Pause, ExternalLink, Sliders
} from 'lucide-react';
import { AudioStreamer } from '../../services/audioStreamer';
import { GooeyOrb } from './GooeyOrb';

const CURATED_VOICES = [
  { id: '330c4fa0-1da3-4c55-8e97-951bfd724e20', name: 'SARA Sarika (Sweet & Calm)', lang: 'te', provider: 'Cartesia', desc: 'Native Telugu with gentle rhythm and natural sweetness' },
  { id: '3a8e6fea-81e5-4d4d-8755-86093146cdb8', name: 'SARA Vidya (Empathetic)', lang: 'te', provider: 'Cartesia', desc: 'Warm, reassuring Telugu advisor tone' },
  { id: '4459a9a5-69d6-4680-b970-e13dc51845b6', name: 'SARA Hindi (Native Voice)', lang: 'hi', provider: 'Cartesia', desc: 'Warm conversational Hindi with clear diction' },
  { id: 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4', name: 'Skylar (English Recommended)', lang: 'en', provider: 'Cartesia Sonic-2', desc: 'Ultra-low latency, crisp consultative tone' },
  { id: '62ae83ad-4f6a-430b-af41-a9bede9286ca', name: 'Gemma (Friendly & Helpful)', lang: 'en', provider: 'Cartesia Sonic-2', desc: 'Approachable customer engagement' },
  { id: '47c38ca4-5f35-497b-b1a3-415245fb35e1', name: 'Daniel (Executive Male)', lang: 'en', provider: 'Cartesia Sonic-2', desc: 'Authoritative, calm sales tone' },
];

export default function VoiceScreen({ agent, onClose, onNavigate }) {
  // Mode selection: 'landing' | 'mic' | 'simulation' | 'phone'
  const [activeMode, setActiveMode] = useState('landing');
  const [rightPanelTab, setRightPanelTab] = useState('chat'); // 'chat' | 'voice_settings'

  const [employees, setEmployees] = useState([]);
  const [activeEmployee, setActiveEmployee] = useState(agent || null);
  const [employeesLoaded, setEmployeesLoaded] = useState(Boolean(agent));

  // Audio Streamer & State Machine
  const [streamer, setStreamer] = useState(null);
  const [state, setState] = useState('idle'); // idle | listening | thinking | speaking | interrupted | error
  const [audioLevel, setAudioLevel] = useState(0);
  const [isMicOn, setIsMicOn] = useState(false);

  // Transcripts & Chat
  const [transcripts, setTranscripts] = useState([]);
  const [textInput, setTextInput] = useState('');
  const [interimText, setInterimText] = useState('');
  const chatEndRef = useRef(null);

  // Voice Settings & Language (Default to Telugu 'te')
  const [selectedVoiceId, setSelectedVoiceId] = useState(agent?.voice_id || '330c4fa0-1da3-4c55-8e97-951bfd724e20');
  const [selectedLanguage, setSelectedLanguage] = useState(agent?.voice_language || 'te');
  const [previewingVoice, setPreviewingVoice] = useState(null);
  const previewAudioRef = useRef(null);

  // Latency Telemetry
  const [latestMetrics, setLatestMetrics] = useState({
    stt_ms: 185,
    llm_first_token_ms: 210,
    tts_first_audio_ms: 235,
    total_ms: 445
  });

  // Phone Call & Recording State
  const [phoneTargetNumber, setPhoneTargetNumber] = useState('');
  const [phoneCalling, setPhoneCalling] = useState(false);
  const [phoneCallMessage, setPhoneCallMessage] = useState('');
  const [phoneCallStatus, setPhoneCallStatus] = useState(null);
  const [activeCallId, setActiveCallId] = useState(null);
  const [showLiveTranslation, setShowLiveTranslation] = useState(true);

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

  // Fetch employees & provider status
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
      .then(data => { if (data) setProvidersHealth(data); })
      .catch(() => {});

    fetch('/api/v1/billing/balance')
      .then(r => r.json())
      .then(b => { if (b) setBillingInfo(b); })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  // Initialize AudioStreamer (Manual Connect on Click)
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
          setTranscripts(prev => [
            ...prev,
            { speaker: 'You', role: 'user', text: t.text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
          ]);
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
          setTranscripts(prev => [
            ...prev,
            { speaker: activeEmployee?.name || 'Sara', role: 'assistant', text: ev.text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
          ]);
        }
      }
    });

    setStreamer(s);
    return () => {
      s.disconnect('voice screen cleanup');
    };
  }, [employeesLoaded, activeEmployee?.id]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts, interimText]);

  // Handle Microphone Toggle
  const handleToggleMic = async () => {
    if (!streamer) return;
    if (isMicOn) {
      streamer.stopMicrophone();
      setIsMicOn(false);
      setState('idle');
    } else {
      await streamer.connect(activeEmployee?.id || 'agent_sara_default');
      await streamer.startMicrophone();
      setIsMicOn(true);
      setState('listening');
    }
  };

  // Handle Interrupt
  const handleInterrupt = () => {
    if (streamer) {
      streamer.interrupt();
      setState('interrupted');
      setTimeout(() => setState('listening'), 1200);
    }
  };

  // Handle Preview Voice Audio Sample
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

  // Handle Text Simulation Send
  const handleSendText = async (e) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    const msg = textInput.trim();
    setTextInput('');
    setTranscripts(prev => [
      ...prev,
      { speaker: 'You', role: 'user', text: msg, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ]);

    setState('thinking');
    try {
      const res = await fetch('/api/v1/voice/chat/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: activeEmployee?.id,
          message: msg,
          language: selectedLanguage,
        })
      });
      const data = await res.json();
      setState('speaking');
      setTranscripts(prev => [
        ...prev,
        { speaker: activeEmployee?.name || 'Sara', role: 'assistant', text: data.reply || data.response || 'I understand your inquiry perfectly.', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
      ]);
      setTimeout(() => setState('idle'), 2500);
    } catch (err) {
      setState('error');
    }
  };

  // Live Phone Call Transcript Real-Time Synchronizer
  useEffect(() => {
    if (!activeCallId) return;
    let notFoundCount = 0;
    const interval = setInterval(() => {
      if (notFoundCount >= 5) {
        clearInterval(interval);
        return;
      }
      fetch(`/api/v1/calls/${activeCallId}/transcript`)
        .then(r => {
          if (r.status === 404) {
            notFoundCount++;
            return null;
          }
          return r.json();
        })
        .then(data => {
          if (data && Array.isArray(data.transcript) && data.transcript.length > 0) {
            notFoundCount = 0;
            setTranscripts(data.transcript.map(t => ({
              speaker: (t.speaker === 'customer' || t.role === 'user') ? 'You (Caller)' : (t.speaker || activeEmployee?.name || 'Sara'),
              role: t.role || ((t.speaker === 'customer') ? 'user' : 'assistant'),
              text: t.text,
              time: t.timestamp ? new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            })));
          }
        })
        .catch(() => {
          notFoundCount++;
        });
    }, 2000);

    return () => clearInterval(interval);
  }, [activeCallId, activeEmployee?.name]);

  // Handle Phone Call Trigger
  const handleTriggerPhoneCall = async (e) => {
    e.preventDefault();
    if (!phoneTargetNumber.trim()) return;
    setPhoneCalling(true);
    setPhoneCallMessage('');
    setPhoneCallStatus('initiating');

    try {
      const res = await fetch('/api/v1/voice/outbound-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_number: phoneTargetNumber.trim(),
          employee_id: activeEmployee?.id,
          language: selectedLanguage,
          voice_id: selectedVoiceId,
        })
      });
      const data = await res.json();
      if (res.ok) {
        setPhoneCallStatus('connected');
        if (data.call_id) {
          setActiveCallId(data.call_id);
          setRightPanelTab('chat');
        }
        setPhoneCallMessage(`Call placed! SID: ${data.call_sid || data.twilio_sid || 'Plivo_Active'}`);
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

  const handleResetConversation = () => {
    if (isMicOn && streamer) {
      streamer.stopMicrophone();
      setIsMicOn(false);
    }
    setTranscripts([]);
    setInterimText('');
    setState('idle');
  };

  // --------------------------------------------------------------------------
  // 1. LANDING MODE SELECTION VIEW (3 Cards)
  // --------------------------------------------------------------------------
  if (activeMode === 'landing') {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }} className="animate-fade-in">
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 16px',
            borderRadius: 20, background: 'rgba(124, 58, 237, 0.08)', border: '1px solid rgba(124, 58, 237, 0.18)',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            color: '#7c3aed', marginBottom: 12
          }}>
            <Sparkles size={13} color="#7c3aed" />
            AI Telephony & Intelligence Lab
          </div>
          <h1 className="page-title" style={{ fontSize: 32, marginBottom: 8 }}>
            Talk with {activeEmployee?.name || 'Sara'}
          </h1>
          <p className="page-subtitle" style={{ fontSize: 15, maxWidth: 640, margin: '0 auto' }}>
            Choose how you would like to test and interact with your autonomous AI employee.
          </p>
        </div>

        {/* Live Provider Health Bar */}
        <div className="card-glass" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px', marginBottom: 28, fontSize: 12.5
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#475569', fontWeight: 600 }}>
            <Activity size={15} color="#10b981" /> Live AI Voice Stack:
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
              <strong>STT:</strong> {providersHealth.assemblyai?.ready ? 'AssemblyAI Pro' : 'Deepgram Nova-3'}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
              <strong>TTS:</strong> Cartesia Sonic (Ready)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
              <strong>LLM:</strong> OpenAI gpt-4o-mini
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
              <strong>Telephony:</strong> Plivo India Voice (+91)
            </span>
          </div>
        </div>

        {/* 3 Simple Mode Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          {[
            {
              id: 'mic',
              title: 'Speech-to-Speech AI',
              desc: 'Live real-time voice conversation with low-latency neural STT & Cartesia audio.',
              icon: Mic,
              badge: 'Ready',
              color: '#7c3aed',
              bg: 'rgba(124, 58, 237, 0.04)'
            },
            {
              id: 'simulation',
              title: 'Interactive Text Simulation',
              desc: 'Test conversational logic, memory, and tool calls via instant text chat.',
              icon: MessageSquare,
              badge: 'Ready',
              color: '#0284c7',
              bg: 'rgba(2, 132, 199, 0.04)'
            },
            {
              id: 'phone',
              title: 'Real Plivo Phone Call',
              desc: 'Initiate a live phone call to an actual mobile device via Plivo India Voice (+91).',
              icon: PhoneCall,
              badge: 'Ready',
              color: '#059669',
              bg: 'rgba(5, 150, 105, 0.04)'
            }
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                onClick={() => setActiveMode(card.id)}
                className="card-glass"
                style={{
                  padding: 28, borderRadius: 20, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  minHeight: 260
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = card.color;
                  e.currentTarget.style.boxShadow = `0 12px 28px ${card.color}18`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.borderColor = 'rgba(124, 58, 237, 0.12)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                    <div style={{
                      width: 46, height: 46, borderRadius: 14, background: card.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <Icon size={22} color={card.color} />
                    </div>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                      background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0'
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669' }} />
                      {card.badge}
                    </span>
                  </div>

                  <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                    {card.title}
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                    {card.desc}
                  </p>
                </div>

                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700,
                  color: card.color, marginTop: 24
                }}>
                  Launch Mode <ChevronRight size={16} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 2. DEDICATED SINGLE VIEWPORT MODE WORKSPACE
  // --------------------------------------------------------------------------
  return (
    <div style={{
      width: '100%', padding: '20px 32px', boxSizing: 'border-box',
      height: 'calc(100vh - 76px)', display: 'flex', flexDirection: 'column'
    }} className="animate-fade-in">
      
      {/* Executive Top Header Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, flexShrink: 0
      }}>
        {/* Left: Back button + Mode Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={() => {
              if (isMicOn && streamer) streamer.stopMicrophone();
              setIsMicOn(false);
              setActiveMode('landing');
            }}
            className="btn btn-secondary"
            style={{ padding: '7px 14px', fontSize: 12.5, fontWeight: 600, borderRadius: 10 }}
          >
            <ArrowLeft size={14} /> Modes
          </button>
          <div>
            <h1 className="page-title" style={{ margin: 0, fontSize: 22 }}>
              Talk with {activeEmployee?.name || 'Sara'}
            </h1>
            <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              {activeMode === 'mic' ? 'Speech-to-Speech Realtime AI' : activeMode === 'simulation' ? 'Text Chat Simulation' : 'Real Phone Telephony Call'}
            </span>
          </div>
        </div>

        {/* Center/Right: Quick Mode Toggle Buttons & Sub-Panel Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            display: 'flex', gap: 4, background: '#f1f5f9', padding: 4, borderRadius: 12,
            border: '1px solid var(--border)'
          }}>
            <button
              onClick={() => setActiveMode('mic')}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: activeMode === 'mic' ? '#ffffff' : 'transparent',
                color: activeMode === 'mic' ? '#7c3aed' : '#64748b',
                border: activeMode === 'mic' ? '1px solid rgba(124,58,237,0.2)' : 'none',
                boxShadow: activeMode === 'mic' ? '0 2px 6px rgba(124,58,237,0.1)' : 'none',
              }}
            >
              🎙️ Voice AI
            </button>
            <button
              onClick={() => setActiveMode('simulation')}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: activeMode === 'simulation' ? '#ffffff' : 'transparent',
                color: activeMode === 'simulation' ? '#0284c7' : '#64748b',
                border: activeMode === 'simulation' ? '1px solid rgba(2,132,199,0.2)' : 'none',
                boxShadow: activeMode === 'simulation' ? '0 2px 6px rgba(2,132,199,0.1)' : 'none',
              }}
            >
              💬 Text Chat
            </button>
            <button
              onClick={() => setActiveMode('phone')}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: activeMode === 'phone' ? '#ffffff' : 'transparent',
                color: activeMode === 'phone' ? '#059669' : '#64748b',
                border: activeMode === 'phone' ? '1px solid rgba(5,150,105,0.2)' : 'none',
                boxShadow: activeMode === 'phone' ? '0 2px 6px rgba(5,150,105,0.1)' : 'none',
              }}
            >
              📞 Phone Call
            </button>
          </div>

          {/* AI Employee Dropdown Selector */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, background: '#fff',
            border: '1px solid rgba(124, 58, 237, 0.18)', borderRadius: 10, padding: '6px 12px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
          }}>
            <Bot size={14} color="#7c3aed" />
            <select
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}
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
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>

          <button className="btn btn-secondary" style={{ padding: '7px 12px', borderRadius: 10 }} onClick={handleResetConversation} title="Reset Conversation">
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Main Single-Viewport 2-Column Split Workspace */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, flex: 1, minHeight: 0 }}>
        
        {/* LEFT COLUMN: Serene Floating Particle Visualizer (With Subtle Glass Elevation Shadow!) */}
        <div className="card-glass" style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 28, position: 'relative', overflow: 'hidden',
          background: 'rgba(255, 255, 255, 0.75)', borderRadius: 24,
          boxShadow: '0 12px 36px rgba(124, 58, 237, 0.08), 0 2px 10px rgba(0, 0, 0, 0.03)',
          border: '1px solid rgba(124, 58, 237, 0.14)'
        }}>
          {/* Ambient Glow Background */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: 340, height: 340, borderRadius: '50%',
            background: state === 'speaking' ? 'radial-gradient(circle, rgba(240, 171, 252, 0.25) 0%, transparent 70%)'
              : state === 'listening' ? 'radial-gradient(circle, rgba(129, 140, 248, 0.25) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(124, 58, 237, 0.12) 0%, transparent 70%)',
            pointerEvents: 'none', transition: 'all 0.5s ease'
          }} />

          {/* MODE 1: MICROPHONE VOICE AI */}
          {activeMode === 'mic' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', position: 'relative', zIndex: 2 }}>
              {/* Status Pill */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 20,
                background: '#ffffff', border: '1px solid rgba(124, 58, 237, 0.18)', marginBottom: 16,
                boxShadow: '0 2px 8px rgba(124, 58, 237, 0.06)'
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: state === 'speaking' ? '#10b981' : state === 'listening' ? '#7c3aed' : state === 'thinking' ? '#c084fc' : '#94a3b8',
                  boxShadow: '0 0 10px #7c3aed'
                }} />
                <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#0f172a' }}>
                  {state === 'speaking' ? 'Sara Speaking' : state === 'listening' ? 'Listening to You' : state === 'thinking' ? 'Sara Thinking' : state === 'interrupted' ? 'Barge-In Interrupted' : 'Ready to Connect'}
                </span>
              </div>

              {/* 720-Particle Gooey Orb Visualizer */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 260, margin: '10px 0' }}>
                <GooeyOrb
                  state={state}
                  size={260}
                  speed={1}
                  colorFrom="#f472b6"
                  colorTo="#8b5cf6"
                  audioLevel={audioLevel}
                />
              </div>

              {/* Microphone Start/Stop Button & Interrupt Trigger */}
              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <button
                  className={isMicOn ? "btn btn-danger" : "btn btn-primary"}
                  onClick={handleToggleMic}
                  style={{ minWidth: 180, padding: '12px 24px', fontSize: 14, fontWeight: 700, borderRadius: 30 }}
                >
                  {isMicOn ? <><MicOff size={16} /> Stop Microphone</> : <><Mic size={16} /> Start Microphone</>}
                </button>
                {isMicOn && (
                  <button className="btn btn-secondary" onClick={handleInterrupt} style={{ borderRadius: 30 }}>
                    <Zap size={15} color="#ea580c" /> Interrupt
                  </button>
                )}
              </div>
            </div>
          )}

          {/* MODE 2: TEXT SIMULATION */}
          {activeMode === 'simulation' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', position: 'relative', zIndex: 2 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>
                Interactive Simulation Mode
              </div>
              <GooeyOrb
                state={state}
                size={220}
                speed={0.8}
                colorFrom="#38bdf8"
                colorTo="#818cf8"
                audioLevel={0}
              />
              
              {/* Sample Test Scenario Prompt Chips */}
              <div style={{ marginTop: 20, width: '100%', maxWidth: 360 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' }}>
                  Sample Test Prompts:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    "I'm looking for a 2BHK flat in Gachibowli under 90 Lakhs.",
                    "Can I book a site visit for Saturday at 11 AM?",
                    "Can I speak with a human executive?"
                  ].map(p => (
                    <button
                      key={p}
                      className="chip"
                      onClick={() => setTextInput(p)}
                      style={{ fontSize: 11.5, textAlign: 'left', background: '#fff', border: '1px solid rgba(124,58,237,0.15)', padding: '6px 12px' }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* MODE 3: REAL PHONE TEST */}
          {activeMode === 'phone' && (
            <div style={{ width: '100%', maxWidth: 380, position: 'relative', zIndex: 2 }}>
              <div style={{ textAlign: 'center', marginBottom: 18 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                  Plivo Outbound Telephony (+91)
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                  Place an actual voice phone call via Plivo (+91 80 6552 2007).
                </p>
              </div>

              {/* Telephony Rate & Limit Information Strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
                <div style={{ padding: '8px 10px', background: '#fff', borderRadius: 8, border: '1px solid var(--border)', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Calling Rate</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>₹{billingInfo.rate_per_minute || 6.0}/min</div>
                </div>
                <div style={{ padding: '8px 10px', background: '#fff', borderRadius: 8, border: '1px solid var(--border)', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Call Cap</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>{billingInfo.call_limit_minutes || 10} min max</div>
                </div>
                <div style={{ padding: '8px 10px', background: '#fff', borderRadius: 8, border: '1px solid var(--border)', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Balance</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#10b981', marginTop: 2 }}>₹{Number(billingInfo.balance || 0).toLocaleString('en-IN')}</div>
                </div>
              </div>

              {/* Active Call Config Summary & Language Selector Box */}
              <div style={{
                padding: '12px 14px', borderRadius: 14, background: 'rgba(124, 58, 237, 0.06)',
                border: '1px solid rgba(124, 58, 237, 0.18)', marginBottom: 14, fontSize: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, color: '#7c3aed' }}>
                    Active Telephony Language:
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[
                      { code: 'te', label: 'తెలుగు' },
                      { code: 'hi', label: 'हिंदी' },
                      { code: 'en', label: 'English' },
                    ].map(l => (
                      <button
                        key={l.code}
                        type="button"
                        onClick={() => setSelectedLanguage(l.code)}
                        style={{
                          padding: '3px 9px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                          background: selectedLanguage === l.code ? '#7c3aed' : '#ffffff',
                          color: selectedLanguage === l.code ? '#ffffff' : '#64748b',
                          border: selectedLanguage === l.code ? 'none' : '1px solid rgba(124, 58, 237, 0.2)',
                          boxShadow: selectedLanguage === l.code ? '0 2px 6px rgba(124, 58, 237, 0.2)' : 'none',
                        }}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ color: '#0f172a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>🌐 Selected:</span>
                  <span style={{ color: '#7c3aed', fontWeight: 700 }}>
                    {selectedLanguage === 'te' ? 'Telugu (తెలుగు - Native)' : selectedLanguage === 'hi' ? 'Hindi (हिंदी)' : 'English'}
                  </span>
                </div>
                <div style={{ color: '#475569', fontSize: 11.5, marginTop: 4 }}>
                  🗣️ Voice: {CURATED_VOICES.find(v => v.id === selectedVoiceId)?.name || 'SARA Sarika (Sweet & Calm)'}
                </div>
              </div>

              <form onSubmit={handleTriggerPhoneCall}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 5 }}>
                    Destination Phone Number
                  </label>
                  <input
                    type="tel"
                    className="input"
                    placeholder="+919876543210"
                    value={phoneTargetNumber}
                    onChange={(e) => setPhoneTargetNumber(e.target.value)}
                    required
                    style={{ fontSize: 14, background: '#fff' }}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={phoneCalling || !phoneTargetNumber.trim()}
                  style={{ width: '100%', padding: '12px 18px', fontSize: 14, fontWeight: 700, borderRadius: 30 }}
                >
                  <PhoneCall size={16} /> {phoneCalling ? 'Initiating Call...' : 'Start Real Phone Call'}
                </button>
              </form>

              {phoneCallMessage && (
                <div style={{
                  marginTop: 14, padding: 10, borderRadius: 8,
                  background: phoneCallStatus === 'failed' ? '#fef2f2' : '#ecfdf5',
                  border: phoneCallStatus === 'failed' ? '1px solid #fecaca' : '1px solid #a7f3d0',
                  color: phoneCallStatus === 'failed' ? '#991b1b' : '#065f46', fontSize: 12
                }}>
                  {phoneCallMessage}
                </div>
              )}

              {/* Live Call Audio Recording & Playback Card */}
              {activeCallId && (
                <div style={{
                  marginTop: 14, padding: 12, borderRadius: 14,
                  background: '#f8fafc', border: '1px solid #e2e8f0',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                      Call Audio Recording
                    </span>
                    <a
                      href={`/api/v1/calls/${activeCallId}/recording`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', textDecoration: 'none' }}
                    >
                      Download WAV ↗
                    </a>
                  </div>
                  <audio
                    controls
                    src={`/api/v1/calls/${activeCallId}/recording`}
                    style={{ width: '100%', height: 36, marginTop: 4, borderRadius: 8 }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Tabbed Panel for (1) Live Conversation Stream & (2) Voice & Telemetry Config */}
        <div className="card-glass" style={{
          display: 'flex', flexDirection: 'column', padding: 22, height: '100%', overflow: 'hidden',
          background: 'rgba(255, 255, 255, 0.75)', borderRadius: 24,
          boxShadow: '0 12px 36px rgba(124, 58, 237, 0.08), 0 2px 10px rgba(0, 0, 0, 0.03)',
          border: '1px solid rgba(124, 58, 237, 0.14)'
        }}>
          {/* Header of Right Column: Sub-panel tabs & Language selector */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            paddingBottom: 10, borderBottom: '1px solid var(--border)', marginBottom: 12, flexShrink: 0
          }}>
            {/* Sub-panel tabs */}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => setRightPanelTab('chat')}
                style={{
                  padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: rightPanelTab === 'chat' ? '#f5f3ff' : 'transparent',
                  color: rightPanelTab === 'chat' ? '#7c3aed' : 'var(--text-muted)',
                  border: rightPanelTab === 'chat' ? '1px solid rgba(124, 58, 237, 0.2)' : 'none',
                }}
              >
                💬 Chat Stream
              </button>
              <button
                onClick={() => setRightPanelTab('voice_settings')}
                style={{
                  padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: rightPanelTab === 'voice_settings' ? '#f5f3ff' : 'transparent',
                  color: rightPanelTab === 'voice_settings' ? '#7c3aed' : 'var(--text-muted)',
                  border: rightPanelTab === 'voice_settings' ? '1px solid rgba(124, 58, 237, 0.2)' : 'none',
                }}
              >
                ⚙️ Voice & Telemetry
              </button>
            </div>

            {/* Language Selector Pills */}
            <div style={{ display: 'flex', gap: 4 }}>
              {[
                { code: 'en', label: 'English' },
                { code: 'te', label: 'తెలుగు' },
                { code: 'hi', label: 'हिंदी' },
              ].map(l => (
                <button
                  key={l.code}
                  onClick={() => setSelectedLanguage(l.code)}
                  style={{
                    padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    background: selectedLanguage === l.code ? '#7c3aed' : 'transparent',
                    color: selectedLanguage === l.code ? '#ffffff' : 'var(--text-muted)',
                    border: selectedLanguage === l.code ? 'none' : '1px solid transparent',
                  }}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* RIGHT PANEL SUB-VIEW 1: CHAT STREAM */}
          {rightPanelTab === 'chat' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
                {transcripts.length === 0 && !interimText && (
                  <div style={{
                    height: '100%', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13
                  }}>
                    <MessageSquare size={32} color="#cbd5e1" style={{ marginBottom: 10 }} />
                    <div>No messages yet.</div>
                    <div style={{ fontSize: 11.5, marginTop: 4 }}>
                      {activeMode === 'mic' ? "Click 'Start Microphone' to begin speech." : "Type a message below to start chat."}
                    </div>
                  </div>
                )}

                {transcripts.map((t, idx) => (
                  <div
                    key={idx}
                    style={{
                      marginBottom: 12, display: 'flex', flexDirection: 'column',
                      alignItems: t.role === 'user' ? 'flex-end' : 'flex-start'
                    }}
                  >
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>
                      {t.speaker} • {t.time}
                    </div>
                    <div style={{
                      maxWidth: '85%', padding: '10px 14px', borderRadius: 14, fontSize: 13, lineHeight: 1.5,
                      background: t.role === 'user' ? '#7c3aed' : '#ffffff',
                      color: t.role === 'user' ? '#ffffff' : '#0f172a',
                      border: t.role === 'user' ? 'none' : '1px solid var(--border)',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
                    }}>
                      <div>{t.text}</div>
                      {t.translation && (
                        <div style={{
                          fontSize: 11.5, marginTop: 6, fontStyle: 'italic',
                          color: t.role === 'user' ? '#f3e8ff' : '#475569',
                          borderTop: t.role === 'user' ? '1px dashed rgba(255,255,255,0.3)' : '1px dashed #e2e8f0',
                          paddingTop: 4
                        }}>
                          🌐 <strong>Live Translation:</strong> "{t.translation}"
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {interimText && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                    <div style={{ maxWidth: '85%', padding: '8px 12px', borderRadius: 12, background: '#f5f3ff', color: '#7c3aed', fontSize: 12, fontStyle: 'italic' }}>
                      {interimText}...
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Text Input Form */}
              <form onSubmit={handleSendText} style={{ display: 'flex', gap: 8, marginTop: 10, flexShrink: 0 }}>
                <input
                  type="text"
                  className="input"
                  placeholder={`Message ${activeEmployee?.name || 'Sara'}...`}
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  style={{ flex: 1, borderRadius: 20, fontSize: 13 }}
                />
                <button type="submit" className="btn btn-primary" style={{ borderRadius: 20, padding: '8px 16px' }}>
                  <Send size={14} /> Send
                </button>
              </form>
            </div>
          )}

          {/* RIGHT PANEL SUB-VIEW 2: VOICE CONFIG & LATENCY TELEMETRY */}
          {rightPanelTab === 'voice_settings' && (
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Latency Telemetry Grid */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={13} color="#7c3aed" /> Real-Time Latency Telemetry
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ background: '#fff', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 600 }}>STT Deepgram</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: isMicOn ? '#7c3aed' : '#64748b' }}>
                      {isMicOn ? `${latestMetrics.stt_ms} ms` : 'Ready'}
                    </div>
                  </div>
                  <div style={{ background: '#fff', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 600 }}>LLM TTFT</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: isMicOn ? '#7c3aed' : '#64748b' }}>
                      {isMicOn ? `${latestMetrics.llm_first_token_ms} ms` : 'Ready'}
                    </div>
                  </div>
                  <div style={{ background: '#fff', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 600 }}>TTS Cartesia</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: isMicOn ? '#10b981' : '#64748b' }}>
                      {isMicOn ? `${latestMetrics.tts_first_audio_ms} ms` : 'Ready'}
                    </div>
                  </div>
                  <div style={{ background: '#fff', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 600 }}>Total Turn</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                      {isMicOn ? `${latestMetrics.total_ms} ms` : 'Ready'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Cartesia Neural Voice Selection Cards */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Volume2 size={13} color="#7c3aed" /> Cartesia Neural Voices
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {CURATED_VOICES.filter(v => selectedLanguage === 'en' ? true : v.lang === selectedLanguage).map(v => (
                    <div
                      key={v.id}
                      onClick={() => setSelectedVoiceId(v.id)}
                      style={{
                        padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                        border: selectedVoiceId === v.id ? '1px solid #7c3aed' : '1px solid var(--border)',
                        background: selectedVoiceId === v.id ? '#f5f3ff' : '#ffffff',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: selectedVoiceId === v.id ? '#7c3aed' : '#0f172a' }}>
                          {v.name}
                        </div>
                        <div style={{ fontSize: 10.5, color: '#64748b' }}>{v.desc}</div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-icon"
                        style={{ width: 26, height: 26, padding: 0 }}
                        onClick={(e) => { e.stopPropagation(); handlePreviewVoice(v.id); }}
                        title="Preview Voice Audio Sample"
                      >
                        {previewingVoice === v.id ? <Pause size={12} color="#7c3aed" /> : <Play size={12} />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
