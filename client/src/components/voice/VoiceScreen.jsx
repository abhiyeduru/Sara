import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, VolumeX, Volume2, Radio, Sparkles, AlertCircle, MessageSquare, Send, PhoneOff, Globe } from 'lucide-react';
import { AudioStreamer } from '../../services/audioStreamer';
import { api } from '../../services/api';

const CURATED_VOICES = [
  { id: 'sarvam-te-pooja', name: 'Pooja (Sweet & Warm)', desc: 'Silky smooth, respectful & most human native Telugu' },
  { id: 'sarvam-te-roopa', name: 'Roopa (Sweet & Soothing)', desc: 'Melodious, gentle & empathetic Telugu tone' },
  { id: 'sarvam-te-priya', name: 'Priya (Cheerful & Sweet)', desc: 'Bright, sweet, high-energy conversational Telugu' },
  { id: 'sarvam-te-kavitha', name: 'Kavitha (Gentle & Polite)', desc: 'Crystal clear, soft, traditional polite Telugu' },
  { id: 'sarvam-te-shruti', name: 'Shruti (Articulate & Crisp)', desc: 'Sweet, crisp, luxury consultative real estate voice' },
  { id: 'sarvam-te-kavya', name: 'Kavya (Friendly & Warm)', desc: 'Bubbly, warm & approachable Telugu conversational voice' },
  { id: 'sarvam-te-neha', name: 'Neha (Sweet Support)', desc: 'Comforting, sweet customer care & follow-up voice' },
  { id: 'sarvam-te-simran', name: 'Simran (Bilingual Sweet)', desc: 'Modern sweet voice switching Telugu & Indian English' },
  { id: 'sarvam-te-vijay', name: 'Vijay (Telugu Friendly Male)', desc: 'Warm, polite, respectful native Telugu male voice' },
  { id: 'sarvam-te-aditya', name: 'Aditya (Confident Male)', desc: 'Deep, trustworthy Indian & Telugu male voice' }
];

export default function VoiceScreen({ agent, onTurnMetrics, onClose, onNavigate }) {
  const [activeAgent, setActiveAgent] = useState(agent || null);
  const [streamer, setStreamer] = useState(null);
  const [state, setState] = useState('idle'); // idle, listening, thinking, speaking, connected, error
  const [isMicOn, setIsMicOn] = useState(false);
  const [transcripts, setTranscripts] = useState([]);
  const [latestUserMessage, setLatestUserMessage] = useState('');
  const [interimText, setInterimText] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState(agent?.primary_language || 'auto');
  const [latestAgentMessage, setLatestAgentMessage] = useState(
    agent?.primary_language === 'te' 
      ? "నమస్కారం అండీ! నేను సారా. మీకు ఏ విధంగా సహాయపడగలను?" 
      : "Hi, welcome to ABC Properties. I'm SARA. How can I help you today?"
  );
  const [textInput, setTextInput] = useState('');
  const [activeLanguage, setActiveLanguage] = useState(agent?.primary_language || 'te');
  const [activeVoiceId, setActiveVoiceId] = useState(agent?.voice_id || 'sarvam-te-pooja');
  const [activeVoiceName, setActiveVoiceName] = useState(agent?.voice_name || 'Pooja');

  useEffect(() => {
    if (!activeAgent) {
      api.getAgents().then(list => {
        if (list && list.length > 0) {
          setActiveAgent(list[0]);
          if (list[0].voice_id) setActiveVoiceId(list[0].voice_id);
          if (list[0].voice_name) setActiveVoiceName(list[0].voice_name);
        }
      }).catch(err => {
        console.warn("Could not fetch agents, using fallback SARA agent:", err);
        setActiveAgent({
          id: 'agent_sara_default',
          name: 'SARA',
          voice_id: 'sarvam-te-kavitha',
          voice_name: 'Kavitha',
          primary_language: 'auto',
          business_type: 'AI Voice Assistant'
        });
      });
    }
  }, [agent]);

  useEffect(() => {
    if (activeAgent?.voice_id) {
      setActiveVoiceId(activeAgent.voice_id);
      setActiveVoiceName(activeAgent.voice_name || 'Kavitha');
    }
  }, [activeAgent?.id, activeAgent?.voice_id]);

  const speakTextNative = (text) => {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const isTe = /[\u0C00-\u0C7F]/.test(text) || selectedLanguage === 'te';
      const isHi = /[\u0900-\u097F]/.test(text) || selectedLanguage === 'hi';
      utterance.lang = isTe ? 'te-IN' : isHi ? 'hi-IN' : 'en-IN';
      utterance.rate = 1.0;
      utterance.pitch = 1.05;
      utterance.onstart = () => {
        setState('speaking');
        isSpeakingRef.current = true;
      };
      utterance.onend = () => {
        setState(isMicOn ? 'listening' : 'idle');
        isSpeakingRef.current = false;
      };
      utterance.onerror = () => {
        setState(isMicOn ? 'listening' : 'idle');
        isSpeakingRef.current = false;
      };
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("SpeechSynthesis error:", e);
    }
  };

  const handleVoiceChange = (v) => {
    setActiveVoiceId(v.id);
    setActiveVoiceName(v.name);
    if (streamer && streamer.ws && streamer.ws.readyState === WebSocket.OPEN) {
      streamer.ws.send(JSON.stringify({ type: 'voice.change', voice_id: v.id }));
    }
    if (activeAgent?.id) {
      api.updateAgent(activeAgent.id, { voice_id: v.id, voice_name: v.name }).catch(() => {});
    }
  };

  const canvasRef = useRef(null);
  const audioLevelRef = useRef(0);
  const audioDataRef = useRef(null);

  // Web Speech API recognition reference for instant streaming STT
  const recognitionRef = useRef(null);
  const isSpeakingRef = useRef(false);
  const lastSentTextRef = useRef('');
  const lastSentTimeRef = useRef(0);

  useEffect(() => {
    isSpeakingRef.current = (state === 'speaking');
  }, [state]);

  useEffect(() => {
    if (!activeAgent) return;

    const newStreamer = new AudioStreamer({
      onStateChange: (newState) => {
        setState(newState);
        if (newStreamer.continuousMode || newState === 'listening') {
          setIsMicOn(true);
        } else if (newState === 'idle' && !newStreamer.continuousMode) {
          setIsMicOn(false);
        }
      },
      onAudioLevel: (level, freqData) => {
        audioLevelRef.current = level;
        audioDataRef.current = freqData;
      },
      onTranscript: (item) => {
        if (item.role === 'user') {
          setLatestUserMessage(item.text);
          setInterimText('');
        } else if (item.role === 'agent') {
          setLatestAgentMessage(item.text);
        }
        if (item.language) {
          setActiveLanguage(item.language);
        }
        setTranscripts((prev) => [...prev.slice(-8), item]);
      },
      onMetrics: (metrics) => {
        if (onTurnMetrics) onTurnMetrics(metrics);
      },
      onEvent: (ev) => {
        if (ev.type === 'session.started' && ev.greeting) {
          setLatestAgentMessage(ev.greeting);
        }
        if (ev.type === 'session.ended') {
          stopWebSpeech();
          setIsMicOn(false);
          setState('idle');
        }
      }
    });

    newStreamer.connect(activeAgent.id);
    setStreamer(newStreamer);

    // Setup Canvas Waveform animation loop
    let animId;
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      const drawWaveform = () => {
        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);

        const level = audioLevelRef.current || 0;
        const data = audioDataRef.current;

        const numBars = 32;
        const barWidth = 7;
        const gap = Math.max(2, (width - numBars * barWidth) / (numBars + 1));

        for (let i = 0; i < numBars; i++) {
          let mag = 0;
          if (data && data.length > i * 3) {
            mag = data[i * 3] / 255.0;
          } else {
            // Ambient wave when idle
            mag = 0.08 * (Math.sin(Date.now() / 240 + i * 0.35) + 1.2);
          }

          const amp = Math.max(mag, level * 1.8);
          const barHeight = Math.max(6, Math.min(height - 4, amp * height));
          const x = gap + i * (barWidth + gap);
          const y = (height - barHeight) / 2;

          // Glowing vibrant gradient (Emerald -> Sky -> Violet)
          const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
          grad.addColorStop(0, '#10b981'); // emerald-500
          grad.addColorStop(0.5, '#06b6d4'); // cyan-500
          grad.addColorStop(1, '#6366f1'); // indigo-500

          ctx.fillStyle = grad;
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(x, y, barWidth, barHeight, 3);
          } else {
            ctx.rect(x, y, barWidth, barHeight);
          }
          ctx.fill();
        }

        animId = requestAnimationFrame(drawWaveform);
      };

      drawWaveform();
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
      stopWebSpeech();
      newStreamer.disconnect();
    };
  }, [activeAgent?.id]);

  // Global browser audio unlock listener
  useEffect(() => {
    if (!streamer) return;
    const unlock = () => {
      streamer.unlockAudio();
    };
    window.addEventListener('click', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, [streamer]);

  // Start instant streaming speech recognition via Web Speech API
  const startWebSpeech = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      
      // Select recognition language
      if (selectedLanguage === 'te') {
        rec.lang = 'te-IN';
      } else if (selectedLanguage === 'hi') {
        rec.lang = 'hi-IN';
      } else if (selectedLanguage === 'en') {
        rec.lang = 'en-IN';
      } else {
        // Auto: defaults to Telugu for regional Telugu agents, or English
        rec.lang = agent?.primary_language === 'te' ? 'te-IN' : 'en-IN';
      }

      rec.onresult = (event) => {
        // Do not process speech if SARA is actively speaking through laptop speakers
        if (isSpeakingRef.current) return;

        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          const text = res[0].transcript;
          if (res.isFinal) {
            const cleanFinal = text.trim();
            if (cleanFinal && cleanFinal.length > 1) {
              const now = Date.now();
              const prevText = (lastSentTextRef.current || '').toLowerCase().trim();
              const currText = cleanFinal.toLowerCase().trim();
              // Prevent duplicate dispatch within 2.5s for same or similar utterance
              if (now - lastSentTimeRef.current < 2500 && (currText === prevText || (currText.length > 4 && prevText.includes(currText)))) {
                return;
              }
              // Prevent dispatch if audioStreamer just uploaded audio within 2 seconds
              if (streamer && (now - (streamer.lastAudioSentTime || 0) < 2000)) {
                return;
              }

              lastSentTextRef.current = cleanFinal;
              lastSentTimeRef.current = now;
              setLatestUserMessage(cleanFinal);
              setInterimText('');
              // Immediately transmit text over WebSocket to bypass audio upload latency completely!
              if (streamer && streamer.ws && streamer.ws.readyState === WebSocket.OPEN) {
                streamer.unlockAudio();
                streamer.sendText(cleanFinal);
              }
            }
          } else {
            interim += text;
            setInterimText(interim);
          }
        }
      };

      rec.onerror = (e) => {
        // Non-fatal, audioStreamer VAD serves as continuous guaranteed fallback
        console.debug('WebSpeech note:', e.error);
      };

      rec.onend = () => {
        // Automatically restart speech recognition while mic is turned on and not speaking
        if (isMicOn && !isSpeakingRef.current) {
          try { rec.start(); } catch {}
        }
      };

      rec.start();
      recognitionRef.current = rec;
    } catch (err) {
      console.warn('SpeechRecognition startup:', err);
    }
  };

  const stopWebSpeech = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    setInterimText('');
  };

  const toggleMicrophone = async () => {
    if (!streamer) return;
    streamer.unlockAudio();

    if (isMicOn) {
      stopWebSpeech();
      streamer.stopPlayback();
      streamer.stopMic();
      setIsMicOn(false);
      setState('idle');
    } else {
      if (!streamer.ws || streamer.ws.readyState !== WebSocket.OPEN) {
        setState('connecting');
        const targetId = activeAgent?.id || 'b1697412-6442-4f31-af04-d9f767d6eb5f';
        await streamer.connect(targetId);
      }
      await streamer.startMic();
      startWebSpeech();
      setIsMicOn(true);
    }
  };

  const handleStopConversation = () => {
    stopWebSpeech();
    if (streamer) {
      streamer.endSession();
    }
    setIsMicOn(false);
    setState('idle');
  };

  const handleBargeIn = () => {
    if (streamer) {
      streamer.interrupt();
    }
  };

  const handleSendText = (e) => {
    e?.preventDefault();
    if (!textInput.trim() || !streamer) return;
    streamer.unlockAudio();
    streamer.sendText(textInput.trim());
    setTranscripts((prev) => [...prev, { role: 'user', text: textInput.trim() }]);
    setTextInput('');
  };

  const sendPreset = (text) => {
    if (!streamer) return;
    streamer.unlockAudio();
    streamer.sendText(text);
    setTranscripts((prev) => [...prev, { role: 'user', text }]);
  };

  const playTestChime = () => {
    try {
      if (streamer) streamer.unlockAudio();
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      ctx.resume().then(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.6);
      });
    } catch (e) {
      console.warn('Test chime notice:', e);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex flex-col items-center justify-between p-4 sm:p-8 max-w-4xl mx-auto w-full">
      {/* Top Navbar matching SARA Screenshot */}
      <div className="w-full flex items-center justify-between border-b border-white/10 pb-3 mb-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white text-black font-extrabold flex items-center justify-center text-sm shadow-md font-display">
            S
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-white tracking-widest text-sm">S A R A</span>
              <span className="text-[10px] bg-white/10 text-sara-300 px-1.5 py-0.5 rounded font-mono">v1.0</span>
            </div>
            <div className="text-[11px] text-sara-400">Configurable Multilingual Voice Agent</div>
          </div>
        </div>

        {/* Center Pill Tabs */}
        <div className="hidden md:flex items-center gap-1 p-1 bg-white/5 border border-white/10 rounded-lg text-xs">
          <button className="px-3 py-1 rounded-md bg-white text-black font-semibold flex items-center gap-1.5 shadow-sm">
            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>Voice Agent</span>
          </button>
          <button onClick={() => onNavigate && onNavigate('dashboard')} className="px-3 py-1 rounded-md text-sara-400 hover:text-white transition-all">
            Workforce OS
          </button>
          <button onClick={() => onNavigate && onNavigate('crm')} className="px-3 py-1 rounded-md text-sara-400 hover:text-white transition-all">
            Universal CRM
          </button>
        </div>

        {/* Right Status & Exit */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-sara-300 font-mono text-[11px]">Backend Live</span>
          </div>

          {(onClose || onNavigate) && (
            <button
              onClick={() => {
                if (onClose) onClose();
                else if (onNavigate) onNavigate('dashboard');
              }}
              className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium border border-white/20 transition-all flex items-center gap-1.5"
              title="Return to Workspace"
            >
              <span>✕ Return</span>
            </button>
          )}
        </div>
      </div>

      {/* Safari Audio Unmute / Speaker Check Banner */}
      <div className="w-full max-w-xl mx-auto mt-1 mb-2 px-3.5 py-2 rounded-xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-between text-xs text-amber-200 shadow-lg shadow-amber-500/5 animate-fadeIn">
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
          <span>If you hear no voice, <strong>click the blue speaker icon next to "localhost"</strong> in Safari's address bar to unmute!</span>
        </div>
        <button
          onClick={playTestChime}
          className="ml-3 shrink-0 px-2.5 py-1 rounded-md bg-amber-400/25 hover:bg-amber-400/40 text-amber-100 text-[11px] font-mono font-medium border border-amber-400/50 active:scale-95 transition-all shadow-sm"
          title="Play a test chime through your speakers"
        >
          🔊 Test Sound
        </button>
      </div>

      {/* Top Header: Minimal Luxury Branding */}
      <div className="text-center pt-1">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-2">
          <span className={`w-2 h-2 rounded-full ${state === 'error' ? 'bg-red-500' : 'bg-white'} animate-pulse`}></span>
          <span className="text-[11px] font-mono tracking-wider uppercase text-sara-300">
            {state === 'listening' ? 'Listening' : state === 'speaking' ? 'Speaking' : state === 'thinking' ? 'Reasoning' : 'Connected'}
          </span>
          <span className="text-[10px] text-sara-500">|</span>
          <span className="text-[10px] uppercase font-mono text-sara-400">{activeLanguage}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-light tracking-[0.25em] text-white">S A R A</h1>
        <p className="text-xs text-sara-400 tracking-wider mt-0.5">{agent?.business_type || 'AI Voice Agent'}</p>

        {/* Language Selection Filter for Instant Speech Accuracy */}
        <div className="mt-3 flex items-center justify-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-sara-400 mr-1" />
          {[
            { id: 'auto', label: 'Auto (Multilingual)' },
            { id: 'te', label: 'Telugu (తెలుగు)' },
            { id: 'en', label: 'English' },
            { id: 'hi', label: 'Hindi (हिंदी)' }
          ].map((l) => (
            <button
              key={l.id}
              onClick={() => {
                setSelectedLanguage(l.id);
                if (isMicOn) {
                  stopWebSpeech();
                  setTimeout(startWebSpeech, 100);
                }
              }}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono transition-all ${
                selectedLanguage === l.id
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'bg-white/5 text-sara-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Curated Voice Selector Bar — High Visibility */}
        <div className="mt-3 flex flex-col items-center justify-center gap-1.5 w-full">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-sara-300 flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Voice:</span>
              <strong className="text-emerald-300 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-400/30">
                {activeVoiceName}
              </strong>
            </span>

            {/* Live Audio Preview Button */}
            <button
              onClick={() => {
                if (streamer) {
                  streamer.unlockAudio();
                  const isTe = activeVoiceId.includes('te') || selectedLanguage === 'te';
                  const testPhrase = isTe 
                    ? "నమస్కారం! నేను సారా. ఈ వాయిస్ మీకు నచ్చిందా?" 
                    : "Hello! I am SARA. How does this voice sound?";
                  streamer.sendText(testPhrase);
                  setTranscripts((prev) => [...prev, { role: 'user', text: `[Voice Preview] ${testPhrase}` }]);
                }
              }}
              title="Test selected voice audio"
              className="px-2.5 py-0.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-[11px] font-mono text-sara-200 hover:text-white transition-all flex items-center gap-1 active:scale-95"
            >
              <span>🔊 Preview Voice</span>
            </button>
          </div>

          <div className="flex items-center justify-center gap-1.5 flex-wrap mt-1">
            {CURATED_VOICES.map((v) => {
              const isSelected = activeVoiceId === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => handleVoiceChange(v)}
                  title={v.desc}
                  className={`px-3 py-1 rounded-full text-xs font-mono transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400 shadow-md shadow-emerald-500/20 font-bold ring-2 ring-emerald-500/30 scale-105'
                      : 'bg-white/5 text-sara-300 hover:text-white hover:bg-white/10 border border-white/10'
                  }`}
                >
                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>}
                  <span>{v.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Central Interactive Voice Visualizer */}
      <div className="my-auto flex flex-col items-center justify-center py-4 w-full">
        
        {/* Breathing animated SARA Orb - Tap to Talk */}
        <div className="relative mb-6">
          <div 
            onClick={toggleMicrophone}
            className={`w-36 h-36 sm:w-44 sm:h-44 rounded-full sara-orb ${state} cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-2xl`}
            title={isMicOn ? "Microphone Active (Tap to pause)" : "Tap Orb to Speak with SARA"}
          >
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-sara-950 flex flex-col items-center justify-center text-center shadow-inner border border-white/15">
              <span className="text-xs font-semibold tracking-widest text-white">SARA</span>
              <span className="px-2 py-0.5 mt-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-[10px] text-emerald-300 font-mono font-medium">
                {activeVoiceName}
              </span>
              <span className="text-[9px] font-mono text-emerald-400/90 mt-1 uppercase tracking-wider font-bold">
                {isMicOn ? "● LIVE" : "TAP TO TALK"}
              </span>
            </div>
          </div>
        </div>

        {/* Real-time Audio Reactive Waveform */}
        <div className="w-full max-w-md h-12 flex items-center justify-center mb-4">
          <canvas 
            ref={canvasRef} 
            width={400} 
            height={48} 
            className="w-full h-full"
          />
        </div>

        {/* Dynamic Subtitle Display: Shows Real-time Listening, User Question, and SARA Response */}
        <div className="max-w-xl w-full text-center px-6 py-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md shadow-2xl min-h-[5.5rem] flex flex-col items-center justify-center gap-2.5">
          {interimText && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-xs text-emerald-200 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="text-emerald-300 font-mono text-[10px] uppercase font-bold">Hearing You:</span>
              <span className="italic font-normal text-white">"{interimText}"</span>
            </div>
          )}

          {latestUserMessage && !interimText && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs text-sara-200 animate-fadeIn">
              <span className="text-sara-400 font-mono text-[10px] uppercase">You Said:</span>
              <span className="italic font-light text-white">"{latestUserMessage}"</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-300">
              SARA ({activeVoiceName})
            </span>
          </div>
          <p className="text-base sm:text-lg text-white font-normal leading-relaxed">
            "{latestAgentMessage}"
          </p>
        </div>

        {/* Quick Testing Chips for Multilingual & Code-Switching */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-6 max-w-xl">
          <button
            onClick={() => sendPreset("గచ్చిబౌలిలో 2 BHK ఫ్లాట్ ధర ఎంత?")}
            className="px-3 py-1.5 rounded-full bg-sara-900 border border-white/10 text-[11px] text-sara-300 hover:border-white/30 hover:text-white transition-all"
          >
            "2 BHK ధర ఎంత?" (TE)
          </button>
          <button
            onClick={() => sendPreset("కోకాపేట్‌లో విల్లా ధర ఎంత?")}
            className="px-3 py-1.5 rounded-full bg-sara-900 border border-white/10 text-[11px] text-sara-300 hover:border-white/30 hover:text-white transition-all"
          >
            "కోకాపేట్‌లో విల్లా ధర?" (TE)
          </button>
          <button
            onClick={() => sendPreset("What is the starting price for 2 BHK in Gachibowli?")}
            className="px-3 py-1.5 rounded-full bg-sara-900 border border-white/10 text-[11px] text-sara-300 hover:border-white/30 hover:text-white transition-all"
          >
            "2 BHK starting price?" (EN)
          </button>
          <button
            onClick={() => sendPreset("Can I schedule a site visit this Sunday at 2 PM?")}
            className="px-3 py-1.5 rounded-full bg-sara-900 border border-white/10 text-[11px] text-sara-300 hover:border-white/30 hover:text-white transition-all"
          >
            "Book Sunday 2 PM visit" (EN)
          </button>
          <button
            onClick={() => sendPreset("చాలు అండీ థాంక్స్ బై")}
            className="px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-[11px] text-red-300 hover:bg-red-500/20 hover:text-white transition-all"
          >
            "చాలు అండీ థాంక్స్" (Stop)
          </button>
        </div>
      </div>

      {/* Bottom Controls: Microphone, Barge-in, Text Input */}
      <div className="w-full max-w-lg pb-4">
        <div className="flex flex-col items-center justify-center gap-2 mb-4">
          {!isMicOn && state !== 'speaking' && (
            <button
              onClick={toggleMicrophone}
              className="mb-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-bold text-xs tracking-wide transition-all shadow-xl shadow-emerald-500/25 flex items-center gap-2 active:scale-95 animate-pulse"
            >
              <Mic className="w-4 h-4" />
              <span>Tap to Speak with SARA (Telugu / English Live)</span>
            </button>
          )}
          <div className="flex items-center gap-4">
            {/* Voice Conversation Mic Button */}
            <button
              onClick={toggleMicrophone}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 active:scale-95 shadow-2xl ${
                isMicOn
                  ? 'bg-white text-black shadow-white/40 scale-105 ring-4 ring-white/20'
                  : state === 'speaking'
                    ? 'bg-sara-800 text-white border border-white/20 hover:border-white/40'
                    : 'bg-sara-850 text-white border border-white/10 hover:border-white/30'
              }`}
              title={isMicOn ? "Microphone active. Tap to turn off" : "Tap to speak with SARA"}
            >
              {isMicOn ? <Mic className="w-6 h-6 animate-pulse" /> : <MicOff className="w-6 h-6 text-sara-400" />}
            </button>

            {/* Barge-in / Interrupt Button */}
            {state === 'speaking' && (
              <button
                onClick={handleBargeIn}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-white/10 border border-white/30 text-white text-xs font-medium hover:bg-white/20 transition-all active:scale-95 shadow-lg shadow-white/5"
              >
                <VolumeX className="w-4 h-4" />
                <span>Interrupt</span>
              </button>
            )}

            {/* Stop Talk / End Call Button */}
            {(isMicOn || state === 'speaking' || state === 'thinking') && (
              <button
                onClick={handleStopConversation}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-200 hover:bg-red-500/30 hover:text-white text-xs font-medium transition-all active:scale-95 shadow-lg shadow-red-500/10"
                title="Stop talking with AI and end conversation"
              >
                <PhoneOff className="w-4 h-4 text-red-400" />
                <span>Stop Talk</span>
              </button>
            )}
          </div>

          <p className="text-[11px] font-mono text-sara-400">
            {isMicOn 
              ? (state === 'listening' ? "● Listening... Speak naturally (Instant Response)" : "● Reasoning and preparing response...") 
              : state === 'speaking'
                ? "SARA is speaking... (Tap mic or Interrupt)"
                : state === 'thinking'
                  ? "SARA is reasoning..."
                  : "Tap microphone to speak or click quick test phrases"}
          </p>
        </div>

        {/* Text Input Fallback Bar */}
        <form onSubmit={handleSendText} className="relative flex items-center">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Type your message or speak naturally..."
            className="w-full bg-sara-900/90 border border-white/10 rounded-full py-2.5 pl-4 pr-11 text-xs text-white placeholder-sara-500 focus:outline-none focus:border-white/40 backdrop-blur-md"
          />
          <button
            type="submit"
            disabled={!textInput.trim()}
            className="absolute right-1.5 p-1.5 rounded-full bg-white text-black hover:bg-sara-200 disabled:opacity-30 disabled:hover:bg-white transition-all"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

    </div>
  );
}
