import React, { useState, useEffect } from 'react';
import { Phone, Sparkles, X, ChevronRight, Bot } from 'lucide-react';

export default function SetupNotificationBanner({ onContinue, hasIncompleteSetup = true }) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem('sara_dismiss_setup_banner') === 'true';
    } catch {
      return false;
    }
  });

  if (dismissed || !hasIncompleteSetup) {
    return null;
  }

  const handleDismiss = (e) => {
    e.stopPropagation();
    setDismissed(true);
    try {
      localStorage.setItem('sara_dismiss_setup_banner', 'true');
    } catch {}
  };

  return (
    <div
      className="setup-notification-banner animate-fade-in"
      style={{
        background: '#fffdf5',
        border: '1.5px solid rgba(245, 158, 11, 0.35)',
        borderRadius: 16,
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        boxShadow: '0 4px 18px rgba(245, 158, 11, 0.08), 0 1px 3px rgba(0,0,0,0.02)',
        position: 'relative',
        transition: 'all 0.2s ease',
        cursor: 'pointer'
      }}
      onClick={onContinue}
    >
      {/* Left Icon & Text */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#b45309',
            flexShrink: 0,
            boxShadow: '0 2px 6px rgba(245, 158, 11, 0.15)'
          }}
        >
          <Phone size={18} />
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 14.5,
                fontWeight: 700,
                color: '#78350f',
                letterSpacing: '-0.01em',
                lineHeight: 1.2
              }}
            >
              Finish setting up your AI employee
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: '#b45309',
                background: '#fef3c7',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                padding: '1px 7px',
                borderRadius: 10,
                textTransform: 'uppercase'
              }}
            >
              Ready to deploy
            </span>
          </div>

          <div
            style={{
              fontSize: 12.5,
              color: '#92400e',
              marginTop: 2,
              lineHeight: 1.3
            }}
          >
            About three minutes, and free to build and test.
          </div>
        </div>
      </div>

      {/* Right Action Button & Dismiss */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button
          className="btn-banner-continue"
          onClick={(e) => {
            e.stopPropagation();
            if (onContinue) onContinue();
          }}
          style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            border: 'none',
            borderRadius: 20,
            padding: '7px 18px',
            color: '#ffffff',
            fontSize: 12.5,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
            boxShadow: '0 3px 10px rgba(245, 158, 11, 0.35)',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 5px 14px rgba(245, 158, 11, 0.45)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = '0 3px 10px rgba(245, 158, 11, 0.35)';
          }}
        >
          <span>Continue</span>
          <ChevronRight size={14} />
        </button>

        <button
          onClick={handleDismiss}
          title="Dismiss banner"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#b45309',
            padding: 6,
            borderRadius: 8,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.7,
            transition: 'opacity 0.15s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
          aria-label="Dismiss setup reminder"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
