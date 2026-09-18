import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, VolumeX, Radio, Sparkles, AlertCircle, MessageSquare, Send } from 'lucide-react';
import { AudioStreamer } from '../../services/audioStreamer';

export default function VoiceScreen({ agent, onTurnMetrics }) {
  const [streamer, setStreamer] = useState(null);
  const [state, setState] = useState('idle'); // idle, listening, thinking, speaking, connected, error
  const [isMicOn, setIsMicOn] = useState(false);
  const [transcripts, setTranscripts] = useState([]);
  const [latestUserMessage, setLatestUserMessage] = useState('');
  const [latestAgentMessage, setLatestAgentMessage] = useState("Hi, welcome to ABC Properties. I'm SARA. How can I help you today?");
  const [textInput, setTextInput] = useState('');
  const [activeLanguage, setActiveLanguage] = useState('en');
  const canvasRef = useRef(null);
  const audioLevelRef = useRef(0);
  const audioDataRef = useRef(null);

  useEffect(() => {
    if (!agent) return;

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
      }
    });

    newStreamer.connect(agent.id);
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

        const level = audioLevelRef.current;
        const data = audioDataRef.current;

        // Minimal luxury monochrome waveform
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();

        const sliceWidth = width / 64;
        let x = 0;

        for (let i = 0; i < 64; i++) {
          let v = 0;
          if (data && data.length > i * 2) {
            v = data[i * 2] / 255.0;
          } else {
            // Subtle breathing wave when idle
            v = 0.05 * Math.sin(Date.now() / 300 + i / 5);
          }

          const amplitude = Math.max(v * (height / 2), level * (height / 2));
          const y = (height / 2) + (i % 2 === 0 ? amplitude : -amplitude) * 0.7;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.stroke();
        animId = requestAnimationFrame(drawWaveform);
      };

      drawWaveform();
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
      newStreamer.disconnect();
    };
  }, [agent?.id]);

  const toggleMicrophone = async () => {
    if (!streamer) return;
    if (isMicOn) {
      streamer.stopMic();
      setIsMicOn(false);
      setState('idle');
    } else {
      await streamer.startMic();
      setIsMicOn(true);
    }
  };

  const handleBargeIn = () => {
    if (streamer) {
      streamer.interrupt();
    }
  };

  const handleSendText = (e) => {
    e?.preventDefault();
    if (!textInput.trim() || !streamer) return;
    streamer.sendText(textInput.trim());
    setTranscripts((prev) => [...prev, { role: 'user', text: textInput.trim() }]);
    setTextInput('');
  };

  const sendPreset = (text) => {
    if (!streamer) return;
    streamer.sendText(text);
    setTranscripts((prev) => [...prev, { role: 'user', text }]);
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex flex-col items-center justify-between p-4 sm:p-8 max-w-4xl mx-auto">
      
      {/* Top Header: Minimal Luxury Branding */}
      <div className="text-center pt-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-3">
          <span className={`w-2 h-2 rounded-full ${state === 'error' ? 'bg-red-500' : 'bg-white'} animate-pulse`}></span>
          <span className="text-[11px] font-mono tracking-wider uppercase text-sara-300">
            {state === 'listening' ? 'Listening' : state === 'speaking' ? 'Speaking' : state === 'thinking' ? 'Reasoning' : 'Connected'}
          </span>
          <span className="text-[10px] text-sara-500">|</span>
          <span className="text-[10px] uppercase font-mono text-sara-400">{activeLanguage}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-light tracking-[0.25em] text-white">S A R A</h1>
        <p className="text-xs text-sara-400 tracking-wider mt-1">{agent?.business_type || 'AI Voice Agent'}</p>
      </div>

      {/* Central Interactive Voice Visualizer */}
      <div className="my-auto flex flex-col items-center justify-center py-6 w-full">
        
        {/* Breathing animated SARA Orb */}
        <div className="relative mb-8">
          <div 
            className={`w-36 h-36 sm:w-44 sm:h-44 rounded-full sara-orb ${state}`}
          >
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-sara-950 flex flex-col items-center justify-center text-center shadow-inner">
              <span className="text-xs font-semibold tracking-widest text-white">SARA</span>
              <span className="text-[9px] text-sara-400 font-mono mt-0.5">{agent?.voice_name || 'Skylar'}</span>
            </div>
          </div>
        </div>

        {/* Real-time Audio Reactive Waveform */}
        <div className="w-full max-w-md h-16 flex items-center justify-center mb-6">
          <canvas 
            ref={canvasRef} 
            width={400} 
            height={64} 
            className="w-full h-full opacity-80"
          />
        </div>

        {/* Dynamic Subtitle Display: Shows both User Question and SARA Response */}
        <div className="max-w-xl w-full text-center px-4 min-h-[4.5rem] flex flex-col items-center justify-center gap-2">
          {latestUserMessage && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-sara-300 animate-fadeIn">
              <span className="text-sara-500 font-mono text-[10px] uppercase">You:</span>
              <span className="italic font-light text-sara-200">"{latestUserMessage}"</span>
            </div>
          )}
          <p className="text-base sm:text-lg text-white font-light leading-relaxed">
            "{latestAgentMessage}"
          </p>
        </div>

        {/* Quick Testing Chips for Multilingual & Code-Switching */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-6 max-w-lg">
          <button
            onClick={() => sendPreset("What is the cost of a villa?")}
            className="px-3 py-1.5 rounded-full bg-sara-900 border border-white/5 text-[11px] text-sara-300 hover:border-white/30 hover:text-white transition-all"
          >
            "Cost of villa?"
          </button>
          <button
            onClick={() => sendPreset("What is the starting price for 2 BHK?")}
            className="px-3 py-1.5 rounded-full bg-sara-900 border border-white/5 text-[11px] text-sara-300 hover:border-white/30 hover:text-white transition-all"
          >
            "What is the price?" (EN)
          </button>
          <button
            onClick={() => sendPreset("Hyderabad lo 2 BHK available unda?")}
            className="px-3 py-1.5 rounded-full bg-sara-900 border border-white/5 text-[11px] text-sara-300 hover:border-white/30 hover:text-white transition-all"
          >
            "Hyderabad lo 2 BHK unda?" (TE)
          </button>
          <button
            onClick={() => sendPreset("విల్లా ధర ఎంత?")}
            className="px-3 py-1.5 rounded-full bg-sara-900 border border-white/5 text-[11px] text-sara-300 hover:border-white/30 hover:text-white transition-all"
          >
            "విల్లా ధర ఎంత?" (TE)
          </button>
          <button
            onClick={() => sendPreset("Price kya hai?")}
            className="px-3 py-1.5 rounded-full bg-sara-900 border border-white/5 text-[11px] text-sara-300 hover:border-white/30 hover:text-white transition-all"
          >
            "Price kya hai?" (HI)
          </button>
          <button
            onClick={() => sendPreset("Can I talk to a human manager?")}
            className="px-3 py-1.5 rounded-full bg-sara-900 border border-white/5 text-[11px] text-sara-300 hover:border-white/30 hover:text-white transition-all"
          >
            "Talk to human" (Escalate)
          </button>
        </div>
      </div>

      {/* Bottom Controls: Microphone, Barge-in, Text Input */}
      <div className="w-full max-w-lg pb-4">
        <div className="flex flex-col items-center justify-center gap-2 mb-4">
          <div className="flex items-center gap-4">
            {/* Push-to-talk / Voice Conversation Mic Button */}
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
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-white/10 border border-white/30 text-white text-xs font-medium hover:bg-white/20 transition-all active:scale-95 shadow-lg shadow-white/5"
              >
                <VolumeX className="w-4 h-4" />
                <span>Interrupt SARA</span>
              </button>
            )}
          </div>

          <p className="text-[11px] font-mono text-sara-400">
            {isMicOn 
              ? (state === 'listening' ? "● Listening... Speak naturally (Auto-responds on pause)" : "● Processing your voice...") 
              : state === 'speaking'
                ? "SARA is speaking... (Tap mic or Interrupt)"
                : state === 'thinking'
                  ? "SARA is reasoning..."
                  : "Tap microphone to speak or click quick phrases"}
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
