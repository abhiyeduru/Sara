import React from 'react';
import { Globe } from 'lucide-react';

const LANGUAGES = [
  { code: 'te', label: 'తెలుగు', name: 'Telugu', badge: 'Primary' },
  { code: 'hi', label: 'हिन्दी', name: 'Hindi' },
  { code: 'ta', label: 'தமிழ்', name: 'Tamil' },
  { code: 'kn', label: 'ಕನ್ನಡ', name: 'Kannada' },
  { code: 'ml', label: 'മലയാളം', name: 'Malayalam' },
  { code: 'mr', label: 'मराठी', name: 'Marathi' },
  { code: 'en', label: 'English', name: 'English' }
];

export default function LanguageSelector({ selectedLanguage, onSelectLanguage }) {
  return (
    <div className="language-selector-section" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 800,
            color: '#b45309',
            background: '#fef3c7',
            border: '1px solid #fde68a',
            padding: '2px 7px',
            borderRadius: 6,
            letterSpacing: '0.08em',
            textTransform: 'uppercase'
          }}
        >
          PRIMARY
        </span>
        <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>
          Callers will be addressed natively in this language
        </span>
      </div>

      <div
        className="language-pills-row"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          overflowX: 'auto',
          paddingBottom: 4,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
      >
        {LANGUAGES.map((lang) => {
          const isActive = selectedLanguage === lang.code;

          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => onSelectLanguage(lang.code)}
              className={`lang-pill ${isActive ? 'active' : ''}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 12.5,
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                border: isActive
                  ? '1px solid #7c3aed'
                  : '1px solid #e2e8f0',
                background: isActive
                  ? 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)'
                  : '#ffffff',
                color: isActive ? '#ffffff' : '#334155',
                boxShadow: isActive
                  ? '0 3px 12px rgba(124, 58, 237, 0.25)'
                  : '0 1px 3px rgba(0, 0, 0, 0.03)',
                whiteSpace: 'nowrap',
                userSelect: 'none'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                }
              }}
            >
              <span>{lang.label}</span>
              {lang.name !== lang.label && (
                <span
                  style={{
                    fontSize: 10,
                    opacity: isActive ? 0.9 : 0.65,
                    marginLeft: 2,
                    fontWeight: 600
                  }}
                >
                  ({lang.name})
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
