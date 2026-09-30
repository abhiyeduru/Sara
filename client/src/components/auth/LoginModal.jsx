import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Sparkles, Shield, ArrowRight, CheckCircle2, Building2, User, Key, Zap } from 'lucide-react';

export default function LoginModal({ onLoginSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [googleClientId, setGoogleClientId] = useState('');
  const googleBtnRef = useRef(null);

  useEffect(() => {
    // 1. Fetch public Google Client ID from backend
    fetch('/api/v1/auth/config')
      .then(res => res.json())
      .then(data => {
        if (data.google_client_id) {
          setGoogleClientId(data.google_client_id);
          initGoogleSignIn(data.google_client_id);
        }
      })
      .catch(err => console.error('Could not fetch auth config:', err));
  }, []);

  const initGoogleSignIn = (clientId) => {
    if (window.google && window.google.accounts && window.google.accounts.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        if (googleBtnRef.current) {
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            theme: 'outline',
            size: 'large',
            width: 320,
            text: 'continue_with',
            shape: 'pill'
          });
        }
      } catch (e) {
        console.error('Google accounts.id init error:', e);
      }
    } else {
      // Retry in 500ms if script is still downloading
      setTimeout(() => initGoogleSignIn(clientId), 500);
    }
  };

  const handleGoogleCredentialResponse = async (response) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/auth/google/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('sara_token', data.token);
        localStorage.setItem('sara_user', JSON.stringify(data.user));
        onLoginSuccess(data.user, data.needs_business_onboarding);
      } else {
        setError(data.detail || 'Google authentication failed.');
      }
    } catch (err) {
      console.error('Verify error:', err);
      setError('Connection to server failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const apiBase = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '';

  const handleDemoLogin = async () => {
    setLoading(true);
    setError('');
    const fallbackUser = {
      id: 'user_business_owner_1',
      name: 'Business Owner',
      email: 'owner@mentneo.com',
      display_name: 'Business Owner',
      auth_provider: 'demo'
    };

    try {
      const res = await fetch(`${apiBase}/api/v1/auth/demo-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'owner@mentneo.com', name: 'Business Owner' })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          localStorage.setItem('sara_token', data.token || 'dev-token-business-owner');
          localStorage.setItem('sara_user', JSON.stringify(data.user));
          onLoginSuccess(data.user, data.needs_business_onboarding || false);
          return;
        }
      }
    } catch (err) {
      console.warn('Backend connection note, using local session:', err);
    }

    // Instant fail-safe login for Vercel/offline environments
    localStorage.setItem('sara_token', 'dev-token-business-owner');
    localStorage.setItem('sara_user', JSON.stringify(fallbackUser));
    onLoginSuccess(fallbackUser, false);
    setLoading(false);
  };

  const handleGoogleRedirectLogin = () => {
    if (apiBase) {
      window.location.href = `${apiBase}/api/v1/auth/google/login`;
    } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      window.location.href = '/api/v1/auth/google/login';
    } else {
      // In static cloud deployments without backend proxy, log in seamlessly via demo or notify
      handleDemoLogin();
    }
  };


  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'radial-gradient(circle at 50% 20%, #1e1b4b 0%, #09090b 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{
        width: '100%', maxWidth: 440, background: '#ffffff',
        borderRadius: 24, boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
        padding: '36px 32px', textAlign: 'center', position: 'relative',
        border: '1px solid rgba(255,255,255,0.1)'
      }} className="animate-fade-in">

        {/* Brand Icon */}
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(124,58,237,0.35)'
        }}>
          <Volume2 size={30} color="#fff" />
        </div>

        {/* Header */}
        <h2 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans' }}>
          Saadhyam Voice AI
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.4 }}>
          Autonomous Multilingual Voice Workforce for your Business
        </p>

        {/* Value Prop Pills */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left',
          background: 'var(--bg-secondary, #f8fafc)', padding: '14px 16px', borderRadius: 12,
          marginBottom: 26, border: '1px solid var(--border)'
        }}>
          {[
            'Single-Number Calling with Sara (Telugu, English, Hindi)',
            'Google Sheets 2-Way Sync & Automated Call Campaigns',
            'Business Calling Policy — Rules fixed, conversation dynamic',
          ].map((item, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
              <CheckCircle2 size={14} color="#10b981" style={{ flexShrink: 0 }} />
              <span>{item}</span>
            </div>
          ))}
        </div>

        {error && (
          <div style={{
            padding: '10px 14px', borderRadius: 10, background: '#fef2f2',
            border: '1px solid #fecaca', color: '#dc2626', fontSize: 12, marginBottom: 18
          }}>
            {error}
          </div>
        )}

        {/* Google Sign-in Container */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          {/* Render Google Identity Services button */}
          <div ref={googleBtnRef} style={{ minHeight: 44, display: 'flex', justifyContent: 'center' }} />

          {/* Direct Google OAuth Button Fallback */}
          <button
            onClick={handleGoogleRedirectLogin}
            disabled={loading}
            style={{
              width: '100%', maxWidth: 320, padding: '10px 18px', borderRadius: 24,
              border: '1px solid #dadce0', background: '#fff', color: '#3c4043',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)', transition: 'background 0.2s'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            Sign in with Google OAuth
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', margin: '6px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>OR QUICK ACCESS</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* Quick Demo Access Button */}
          <button
            onClick={handleDemoLogin}
            disabled={loading}
            style={{
              width: '100%', maxWidth: 320, padding: '10px 18px', borderRadius: 24,
              border: '1px solid var(--border)', background: 'var(--bg-secondary, #f8fafc)',
              color: 'var(--text-primary)', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
            }}
          >
            <Zap size={14} color="#7c3aed" />
            Continue as Business Owner (Instant Demo)
          </button>
        </div>

        {/* Footer info */}
        <div style={{ marginTop: 22, fontSize: 11, color: 'var(--text-muted)' }}>
          Secure OAuth 2.0 • Data isolated per workspace
        </div>
      </div>
    </div>
  );
}
