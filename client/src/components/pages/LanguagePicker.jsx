import React, { useState } from 'react';
import { Check, Volume2, Play, Pause } from 'lucide-react';

const AVAILABLE_LANGUAGES = [
  { id: 'Telugu', label: 'Telugu', code: 'te', voice: 'Kavitha (Sarvam AI)' },
  { id: 'Hindi', label: 'Hindi', code: 'hi', voice: 'Anushka (Sarvam AI)' },
  { id: 'English', label: 'English', code: 'en', voice: 'Sarah (Sarvam AI)' },
];

export default function LanguagePicker({ selectedLanguages = ['Telugu', 'English'], onToggleLanguage }) {
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const primaryVoice = AVAILABLE_LANGUAGES.find(l => selectedLanguages.includes(l.id)) || AVAILABLE_LANGUAGES[0];

  const handlePreviewVoice = () => {
    setIsPlayingPreview(true);
    // Simulate short 2.5s speech preview audio
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const text = selectedLanguages.includes('Telugu')
        ? 'నమస్కారం అండి, నేను మీ AI వాయిస్ అసిస్టెంట్ ని.'
        : selectedLanguages.includes('Hindi')
        ? 'नमस्ते, मैं आपकी AI वॉइस असिस्टेंट हूँ।'
        : 'Hello, I am your voice AI assistant.';
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.onend = () => setIsPlayingPreview(false);
      utterance.onerror = () => setIsPlayingPreview(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => setIsPlayingPreview(false), 2000);
    }
  };

  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid var(--border-subtle)',
      borderRadius: 16,
      padding: '14px 18px',
      boxShadow: 'var(--shadow-soft)'
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--text-label)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: 10
      }}>
        2. Language Selection
      </div>

      {/* Pill Toggle Chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {AVAILABLE_LANGUAGES.map(lang => {
          const isSelected = selectedLanguages.includes(lang.id);
          return (
            <button
              key={lang.id}
              type="button"
              onClick={() => onToggleLanguage && onToggleLanguage(lang.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 16px',
                borderRadius: 999,
                border: isSelected ? '1.5px solid var(--purple-primary)' : '1px solid var(--border-subtle)',
                background: isSelected ? 'var(--purple-tint)' : '#FFFFFF',
                color: isSelected ? 'var(--purple-primary)' : 'var(--text-heading)',
                fontSize: 13,
                fontWeight: isSelected ? 700 : 600,
                cursor: 'pointer',
                transition: 'all 200ms ease-out',
                boxShadow: isSelected ? 'var(--purple-glow)' : 'none'
              }}
            >
              {isSelected && <Check size={14} color="var(--purple-primary)" />}
              <span>{lang.label}</span>
            </button>
          );
        })}
      </div>

      {/* Auto-Voice line with Speaker Icon & "Preview voice" Play Button */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 12,
        paddingTop: 10,
        borderTop: '1px solid var(--border-subtle)',
        fontSize: 12,
        color: 'var(--purple-primary)',
        fontWeight: 600
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Volume2 size={15} color="var(--purple-primary)" />
          <span>Auto-Voice: <strong>{primaryVoice.voice}</strong> ({selectedLanguages.join(' & ')})</span>
        </div>

        <button
          type="button"
          onClick={handlePreviewVoice}
          style={{
            background: 'var(--purple-tint)',
            border: '1px solid rgba(124, 58, 237, 0.2)',
            color: 'var(--purple-primary)',
            padding: '4px 10px',
            borderRadius: 20,
            fontSize: 11.5,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            transition: 'all 150ms ease'
          }}
        >
          {isPlayingPreview ? <Pause size={11} /> : <Play size={11} />}
          <span>{isPlayingPreview ? 'Playing...' : 'Preview voice'}</span>
        </button>
      </div>
    </div>
  );
}
