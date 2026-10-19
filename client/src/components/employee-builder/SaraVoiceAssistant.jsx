import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Square, RefreshCw, Volume2, Sparkles, Check, AlertCircle } from 'lucide-react';

export default function SaraVoiceAssistant({
  selectedLanguage,
  onTranscriptionUpdate,
  currentDescription,
  onAutoBuild
}) {
  const [isListening, setIsListening] = useState(false);
  const [recognitionError, setRecognitionError] = useState('');
  const [transcriptInterim, setTranscriptInterim] = useState('');
  const [hasCapturedSpeech, setHasCapturedSpeech] = useState(false);
  const recognitionRef = useRef(null);

  // Map language code to SpeechRecognition BCP-47 locale
  const getLocaleForLang = (code) => {
    switch (code) {
      case 'te': return 'te-IN';
      case 'hi': return 'hi-IN';
      case 'ta': return 'ta-IN';
      case 'kn': return 'kn-IN';
      case 'ml': return 'ml-IN';
      case 'mr': return 'mr-IN';
      case 'en': return 'en-IN';
      default: return 'en-US';
    }
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  const startVoiceSession = () => {
    setRecognitionError('');
    setTranscriptInterim('');

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRec) {
      setRecognitionError('Speech recognition not supported in this browser. Please type your description.');
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = getLocaleForLang(selectedLanguage);
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setRecognitionError('');
      };

      recognition.onresult = (event) => {
        let interim = '';
        let finalStr = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalStr += trans + ' ';
          } else {
            interim += trans;
          }
        }

        if (interim) {
          setTranscriptInterim(interim);
        }

        if (finalStr) {
          setHasCapturedSpeech(true);
          setTranscriptInterim('');
          onTranscriptionUpdate((prev) => {
            const trimmedPrev = (prev || '').trim();
            const space = trimmedPrev ? ' ' : '';
            return trimmedPrev + space + finalStr.trim();
          });
        }
      };

      recognition.onerror = (event) => {
        console.warn('SpeechRecognition error:', event.error);
        if (event.error === 'not-allowed') {
          setRecognitionError('Microphone permission blocked. Please allow mic access in your browser.');
        } else if (event.error !== 'no-speech') {
          setRecognitionError(`Voice input notice: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setRecognitionError('Could not start microphone session.');
      setIsListening(false);
    }
  };

  const stopVoiceSession = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsListening(false);
  };

  const toggleVoiceSession = () => {
    if (isListening) {
      stopVoiceSession();
    } else {
      startVoiceSession();
    }
  };

  return (
    <div
      className="sara-voice-assistant-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '28px 22px',
        position: 'relative',
        height: '100%',
        boxSizing: 'border-box'
      }}
    >
      {/* Top Best Result Badge */}
      <div style={{ marginBottom: 16 }}>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 800,
            color: '#b45309',
            background: '#fef3c7',
            border: '1px solid #fde68a',
            padding: '4px 12px',
            borderRadius: 20,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            boxShadow: '0 1px 3px rgba(180, 83, 9, 0.1)'
          }}
        >
          ✦ SPEAK DIRECTLY
        </span>
      </div>

      {/* Prominent Circular Microphone Interaction Button */}
      <div style={{ position: 'relative', marginBottom: 18 }}>
        {/* Animated Ripple Waves when Listening */}
        {isListening && (
          <>
            <div
              className="mic-pulse-wave"
              style={{
                position: 'absolute',
                inset: -14,
                borderRadius: '50%',
                border: '2px solid rgba(16, 185, 129, 0.5)',
                animation: 'pulseRing 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite'
              }}
            />
            <div
              className="mic-pulse-wave-2"
              style={{
                position: 'absolute',
                inset: -28,
                borderRadius: '50%',
                border: '1.5px solid rgba(16, 185, 129, 0.3)',
                animation: 'pulseRing 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite 0.4s'
              }}
            />
          </>
        )}

        <button
          type="button"
          onClick={toggleVoiceSession}
          className={`mic-hero-button ${isListening ? 'listening' : ''}`}
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: isListening
              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
              : 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
            border: isListening
              ? '3px solid #6ee7b7'
              : '3px solid #ffffff',
            boxShadow: isListening
              ? '0 0 30px rgba(16, 185, 129, 0.45)'
              : '0 8px 24px rgba(124, 58, 237, 0.35), 0 2px 6px rgba(0, 0, 0, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            cursor: 'pointer',
            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            transform: isListening ? 'scale(1.05)' : 'none',
            position: 'relative',
            zIndex: 2
          }}
          title={isListening ? 'Click to stop listening' : 'Click to talk with Sara'}
          aria-label={isListening ? 'Stop voice recording' : 'Start speaking to Sara'}
        >
          {isListening ? (
            <Square size={26} fill="#ffffff" />
          ) : (
            <Mic size={32} />
          )}
        </button>
      </div>

      {/* Headings */}
      <div style={{ maxWidth: 240 }}>
        <h3
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: '#1e1b4b',
            margin: '0 0 4px',
            letterSpacing: '-0.02em',
            lineHeight: 1.2
          }}
        >
          {isListening ? 'Listening to your instructions...' : 'Talk to Sara'}
        </h3>
        <p
          style={{
            fontSize: 12.5,
            color: isListening ? '#059669' : '#64748b',
            margin: 0,
            lineHeight: 1.4,
            fontWeight: isListening ? 600 : 400
          }}
        >
          {isListening
            ? `Speaking in ${selectedLanguage.toUpperCase()} — transcribing in real-time.`
            : 'Speak naturally in Telugu or English. She drafts your script.'}
        </p>
      </div>

      {/* Live Interim Transcript Feedback */}
      {transcriptInterim && (
        <div
          style={{
            marginTop: 14,
            padding: '6px 12px',
            borderRadius: 10,
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            fontSize: 11.5,
            color: '#065f46',
            maxWidth: 240,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          🎙️ “{transcriptInterim}”
        </div>
      )}

      {/* Error notice */}
      {recognitionError && (
        <div
          style={{
            marginTop: 12,
            padding: '6px 10px',
            borderRadius: 8,
            background: '#fef2f2',
            border: '1px solid #fecaca',
            fontSize: 11,
            color: '#dc2626',
            maxWidth: 230
          }}
        >
          {recognitionError}
        </div>
      )}

      {/* Live Active Audio Waveform Bar */}
      {isListening && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginTop: 14,
            height: 18
          }}
        >
          {[8, 16, 24, 14, 28, 18, 10].map((h, i) => (
            <span
              key={i}
              className="sound-bar"
              style={{
                width: 3,
                height: `${h}px`,
                background: '#10b981',
                borderRadius: 2,
                animation: `soundWave 0.8s ease-in-out infinite alternate ${i * 0.1}s`
              }}
            />
          ))}
        </div>
      )}

      {/* Fast Action prompt if speech captured */}
      {!isListening && hasCapturedSpeech && currentDescription && (
        <div style={{ marginTop: 14 }}>
          <span
            style={{
              fontSize: 11.5,
              color: '#059669',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: '#ecfdf5',
              padding: '3px 8px',
              borderRadius: 8
            }}
          >
            <Check size={12} /> Voice captured into description
          </span>
        </div>
      )}
    </div>
  );
}
