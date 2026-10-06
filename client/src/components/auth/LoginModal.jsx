import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowRight, CheckCircle2, User, Zap, Sun, Moon
} from 'lucide-react';
import lottie from 'lottie-web';

// Custom Brand Icon with vibrant Pink-Purple gradient pattern
function BrandIcon({ size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ display: 'inline-block', flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="saraPinkPurpleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A855F7" />
          <stop offset="50%" stopColor="#9333EA" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="2.8" fill="url(#saraPinkPurpleGrad)" />
      <line x1="12" y1="2" x2="12" y2="6.5" stroke="url(#saraPinkPurpleGrad)" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="12" y1="17.5" x2="12" y2="22" stroke="url(#saraPinkPurpleGrad)" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="2" y1="12" x2="6.5" y2="12" stroke="url(#saraPinkPurpleGrad)" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="17.5" y1="12" x2="22" y2="12" stroke="url(#saraPinkPurpleGrad)" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="4.93" y1="4.93" x2="8.1" y2="8.1" stroke="url(#saraPinkPurpleGrad)" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="15.9" y1="15.9" x2="19.07" y2="19.07" stroke="url(#saraPinkPurpleGrad)" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="4.93" y1="19.07" x2="8.1" y2="15.9" stroke="url(#saraPinkPurpleGrad)" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="15.9" y1="8.1" x2="19.07" y2="4.93" stroke="url(#saraPinkPurpleGrad)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

// Right-Side Lottie Animation Component
function LottieShowcase() {
  const containerRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      if (animRef.current) {
        try { animRef.current.destroy(); } catch (_) {}
      }

      try {
        const loadFn = lottie?.loadAnimation || lottie?.default?.loadAnimation || (typeof window !== 'undefined' && window.lottie?.loadAnimation);
        if (typeof loadFn === 'function') {
          animRef.current = loadFn({
            container: containerRef.current,
            renderer: 'svg',
            loop: true,
            autoplay: true,
            path: '/login-animation.json',
          });
        }
      } catch (err) {
        console.warn('Lottie animation failed to load:', err);
      }
    }

    return () => {
      try {
        if (animRef.current) {
          animRef.current.destroy();
        }
      } catch (_) {}
    };
  }, []);

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 580,
        height: 'clamp(360px, 62vh, 600px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        background: 'transparent',
      }}
    >
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
        }}
      />
    </div>
  );
}

export default function LoginModal({ onLoginSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [googleClientId, setGoogleClientId] = useState('');
  const [emailInput, setEmailInput] = useState('abhiyeduru8@gmail.com');
  const googleBtnRef = useRef(null);

  // Theme: 'light' (pure white) or 'dark' (obsidian purple)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('sara_login_theme') || 'light';
  });

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('sara_login_theme', next);
  };

  const DEFAULT_GOOGLE_CLIENT_ID =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_CLIENT_ID) ||
    '78592580498-jal2ukdmui3tq3rt2csj0u7r80173asn.apps.googleusercontent.com';
  const apiBase = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '';

  const parseJwt = (token) => {
    try {
      const base64Url = token.split('.')[1];
      if (!base64Url) return null;
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  };

  // Initialize Google Sign In
  useEffect(() => {
    const initialClientId = DEFAULT_GOOGLE_CLIENT_ID;
    setGoogleClientId(initialClientId);
    initGoogleSignIn(initialClientId);

    const apiEndpoint = apiBase ? `${apiBase}/api/v1/auth/config` : '/api/v1/auth/config';
    fetch(apiEndpoint)
      .then((res) => {
        if (!res.ok) throw new Error('Not ok');
        return res.json();
      })
      .then((data) => {
        if (data.google_client_id && data.google_client_id !== initialClientId) {
          setGoogleClientId(data.google_client_id);
          initGoogleSignIn(data.google_client_id);
        }
      })
      .catch(() => {});
  }, [theme]);

  const initGoogleSignIn = (clientId) => {
    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        if (googleBtnRef.current) {
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            theme: theme === 'dark' ? 'filled_black' : 'outline',
            size: 'large',
            width: 340,
            text: 'continue_with',
            shape: 'rectangular',
          });
        }
      } catch (e) {
        console.error('Google accounts.id init error:', e);
      }
    } else {
      setTimeout(() => initGoogleSignIn(clientId), 500);
    }
  };

  const handleGoogleCredentialResponse = async (response) => {
    setLoading(true);
    setError('');

    const jwtData = parseJwt(response.credential);
    const verifiedGoogleUser = jwtData
      ? {
          id: `google_${jwtData.sub}`,
          name: jwtData.name || jwtData.given_name || (jwtData.email ? jwtData.email.split('@')[0] : 'Google User'),
          email: jwtData.email || '',
          avatar_url: jwtData.picture || '',
          auth_provider: 'google',
        }
      : null;

    try {
      const verifyEndpoint = apiBase ? `${apiBase}/api/v1/auth/google/verify` : '/api/v1/auth/google/verify';
      const res = await fetch(verifyEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          localStorage.setItem('sara_token', data.token || response.credential);
          localStorage.setItem('sara_user', JSON.stringify(data.user));
          onLoginSuccess(data.user, data.needs_business_onboarding || false);
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Backend server verification bypassed:', err);
    }

    if (verifiedGoogleUser?.email) {
      localStorage.setItem('sara_token', response.credential);
      localStorage.setItem('sara_user', JSON.stringify(verifiedGoogleUser));
      onLoginSuccess(verifiedGoogleUser, false);
    } else {
      setError('Google authentication could not be completed. Please try again.');
    }
    setLoading(false);
  };

  const handleCustomEmailLogin = async (emailToUse) => {
    setLoading(true);
    setError('');
    const targetEmail = (emailToUse || emailInput).trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      setError('Please enter a valid email address.');
      setLoading(false);
      return;
    }
    const cleanName = targetEmail
      .split('@')[0]
      .replace(/[._-]/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
    const user = {
      id: `user_${targetEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
      name: cleanName,
      email: targetEmail,
      display_name: cleanName,
      auth_provider: 'email',
    };

    try {
      const res = await fetch(`${apiBase}/api/v1/auth/demo-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, name: cleanName }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          localStorage.setItem('sara_token', data.token || `dev-token-${user.id}`);
          localStorage.setItem('sara_user', JSON.stringify(data.user));
          onLoginSuccess(data.user, data.needs_business_onboarding || false);
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Backend login notice, activating local session:', err);
    }

    localStorage.setItem('sara_token', `dev-token-${user.id}`);
    localStorage.setItem('sara_user', JSON.stringify(user));
    onLoginSuccess(user, false);
    setLoading(false);
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    setError('');
    const fallbackUser = {
      id: 'user_business_owner_1',
      name: 'Business Owner',
      email: 'owner@mentneo.com',
      display_name: 'Business Owner',
      auth_provider: 'demo',
    };

    try {
      const res = await fetch(`${apiBase}/api/v1/auth/demo-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'owner@mentneo.com', name: 'Business Owner' }),
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

    localStorage.setItem('sara_token', 'dev-token-business-owner');
    localStorage.setItem('sara_user', JSON.stringify(fallbackUser));
    onLoginSuccess(fallbackUser, false);
    setLoading(false);
  };

  const handleGoogleRedirectLogin = () => {
    if (window.google?.accounts?.id?.prompt) {
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          launchDirectOAuth();
        }
      });
      return;
    }
    launchDirectOAuth();
  };

  const launchDirectOAuth = () => {
    if (apiBase || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      window.location.href = `${apiBase}/api/v1/auth/google/login`;
      return;
    }
    const clientId = googleClientId || DEFAULT_GOOGLE_CLIENT_ID;
    const redirectUri = window.location.origin;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'token id_token',
      scope: 'openid email profile',
      nonce: Date.now().toString(),
      prompt: 'select_account',
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  };

  // Theme tokens
  const isDark = theme === 'dark';
  const colors = isDark
    ? {
        bg: '#0E0B16',
        text: '#F5EEFD',
        textMuted: '#9D93B8',
        cardBg: '#161224',
        cardBorder: 'rgba(168, 85, 247, 0.2)',
        inputBg: '#1E1733',
        inputBorder: 'rgba(168, 85, 247, 0.26)',
        inputText: '#FFFFFF',
        btnSecondaryBg: '#221B38',
        btnSecondaryBorder: 'rgba(168, 85, 247, 0.22)',
        btnSecondaryText: '#F5EEFD',
        btnSecondaryHover: '#2C2347',
        btnPrimaryBg: '#F5EEFD',
        btnPrimaryText: '#0E0B16',
        btnPrimaryHover: '#FFFFFF',
        brandAccent: '#C084FC',
        brandPink: '#F472B6',
        dividerLine: 'rgba(168, 85, 247, 0.2)',
        chipBg: 'rgba(217, 70, 239, 0.15)',
        chipText: '#F472B6',
        chipBorder: 'rgba(217, 70, 239, 0.3)',
      }
    : {
        bg: '#FFFFFF', // Pure, clean white background as requested
        text: '#17112B',
        textMuted: '#6D6585',
        cardBg: '#FFFFFF',
        cardBorder: 'rgba(124, 58, 237, 0.12)',
        inputBg: '#FFFFFF',
        inputBorder: '#E4DCF5',
        inputText: '#17112B',
        btnSecondaryBg: '#F8F6FE',
        btnSecondaryBorder: '#E2E8F0',
        btnSecondaryText: '#1E1238',
        btnSecondaryHover: '#F2EDFD',
        btnPrimaryBg: '#17112B',
        btnPrimaryText: '#FFFFFF',
        btnPrimaryHover: '#0F091F',
        brandAccent: '#8B5CF6',
        brandPink: '#D946EF',
        dividerLine: '#EFEBF8',
        chipBg: 'rgba(147, 51, 234, 0.08)',
        chipText: '#7E22CE',
        chipBorder: 'rgba(147, 51, 234, 0.2)',
      };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: colors.bg,
        color: colors.text,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Plus Jakarta Sans', Inter, -apple-system, sans-serif",
        overflowY: 'auto',
        transition: 'background-color 0.3s ease, color 0.3s ease',
      }}
    >
      {/* Top Banner & Navigation Header */}
      <header
        style={{
          width: '100%',
          maxWidth: 1600,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '28px 48px 12px',
          boxSizing: 'border-box',
          zIndex: 10,
        }}
      >
        {/* Brand Logo & Title with Pink/Purple Brand Pattern */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img
            src="/saadhyam-logo.png"
            alt="Saadhyam Logo"
            style={{ height: 32, width: 'auto', objectFit: 'contain', display: 'block' }}
          />
          <span
            className="font-editorial"
            style={{
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: colors.text,
              fontFamily: "'Newsreader', 'Instrument Serif', Georgia, serif",
            }}
          >
            Saadhyam
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '3px 9px',
              borderRadius: 6,
              background: colors.chipBg,
              color: colors.chipText,
              border: `1px solid ${colors.chipBorder}`,
            }}
          >
            Voice AI
          </span>
        </div>

        {/* Top Right Controls: Theme Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={toggleTheme}
            title={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '8px 14px',
              borderRadius: 20,
              border: `1px solid ${colors.btnSecondaryBorder}`,
              background: colors.btnSecondaryBg,
              color: colors.text,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {isDark ? <Sun size={15} color="#FBBF24" /> : <Moon size={15} color="#A855F7" />}
            <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </div>
      </header>

      {/* Main Split Section: Left Form + Right Lottie Animation */}
      <main
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 1600,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 48px 48px',
          gap: 48,
          boxSizing: 'border-box',
        }}
        className="login-lottie-split"
      >
        {/* LEFT COLUMN: Clean Left-Aligned Form */}
        <div
          style={{
            flex: '1 1 540px',
            maxWidth: 600,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            textAlign: 'left',
          }}
        >
          {/* Editorial Headline */}
          <h1
            className="font-editorial"
            style={{
              fontFamily: "'Newsreader', 'Instrument Serif', Georgia, serif",
              fontSize: 'clamp(38px, 4.2vw, 54px)',
              fontWeight: 500,
              lineHeight: 1.08,
              letterSpacing: '-0.03em',
              margin: '0 0 14px',
              color: colors.text,
              textAlign: 'left',
            }}
          >
            Question what’s next
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: 16,
              lineHeight: 1.5,
              color: colors.textMuted,
              margin: '0 0 32px',
              fontWeight: 400,
              textAlign: 'left',
            }}
          >
            Your thinking partner & multilingual voice workforce for big ambitions
          </p>

          {/* Login Card / Box (Clean, Elegant Container) */}
          <div
            style={{
              width: '100%',
              background: colors.cardBg,
              borderRadius: 22,
              border: `1px solid ${colors.cardBorder}`,
              padding: '32px 28px',
              boxShadow: isDark
                ? '0 16px 40px rgba(0,0,0,0.45)'
                : '0 12px 36px rgba(0, 0, 0, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: 15,
              boxSizing: 'border-box',
            }}
          >
            {error && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2',
                  border: isDark ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid #FECACA',
                  color: '#EF4444',
                  fontSize: 13,
                  lineHeight: 1.4,
                }}
              >
                {error}
              </div>
            )}

            {/* 1. Continue with Google Button */}
            <button
              onClick={handleGoogleRedirectLogin}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 20px',
                borderRadius: 12,
                border: `1px solid ${colors.btnSecondaryBorder}`,
                background: colors.btnSecondaryBg,
                color: colors.text,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.btnSecondaryHover)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = colors.btnSecondaryBg)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Google Identity Services Hidden/Mounted Button */}
            <div ref={googleBtnRef} style={{ display: 'none' }} />

            {/* 2. Continue with Demo / Quick Access Button */}
            <button
              onClick={handleDemoLogin}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 20px',
                borderRadius: 12,
                border: `1px solid ${colors.btnSecondaryBorder}`,
                background: colors.btnSecondaryBg,
                color: colors.text,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.btnSecondaryHover)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = colors.btnSecondaryBg)}
            >
              <Zap size={16} color={colors.brandAccent} />
              <span>Continue as Business Owner (Demo)</span>
            </button>

            {/* OR Divider */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                margin: '4px 0',
              }}
            >
              <div style={{ flex: 1, height: 1, backgroundColor: colors.dividerLine }} />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: colors.textMuted,
                  textTransform: 'uppercase',
                }}
              >
                or
              </span>
              <div style={{ flex: 1, height: 1, backgroundColor: colors.dividerLine }} />
            </div>

            {/* 3. Email Input Field */}
            <div>
              <input
                type="email"
                placeholder="Enter your email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCustomEmailLogin(emailInput);
                }}
                style={{
                  width: '100%',
                  padding: '13px 16px',
                  borderRadius: 12,
                  border: `1px solid ${colors.inputBorder}`,
                  backgroundColor: colors.inputBg,
                  color: colors.inputText,
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = colors.brandAccent)}
                onBlur={(e) => (e.currentTarget.style.borderColor = colors.inputBorder)}
              />
            </div>

            {/* 4. Continue with Email (High-contrast action button) */}
            <button
              onClick={() => handleCustomEmailLogin(emailInput)}
              disabled={loading || !emailInput.trim()}
              style={{
                width: '100%',
                padding: '13px 20px',
                borderRadius: 12,
                border: 'none',
                backgroundColor: colors.btnPrimaryBg,
                color: colors.btnPrimaryText,
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'background-color 0.15s ease, transform 0.1s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.btnPrimaryHover)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = colors.btnPrimaryBg)}
            >
              {loading ? (
                <span>Signing in...</span>
              ) : (
                <>
                  <span>Continue with email</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>

            {/* One-Click Shortcut for abhiyeduru8@gmail.com */}
            {emailInput !== 'abhiyeduru8@gmail.com' && (
              <div style={{ textAlign: 'center', marginTop: 2 }}>
                <button
                  onClick={() => handleCustomEmailLogin('abhiyeduru8@gmail.com')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: colors.brandAccent,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  ⚡ One-click sign in as abhiyeduru8@gmail.com
                </button>
              </div>
            )}
          </div>

          {/* Footer Legal & Privacy Links */}
          <div
            style={{
              marginTop: 32,
              fontSize: 12,
              color: colors.textMuted,
              display: 'flex',
              gap: 16,
              flexWrap: 'wrap',
              justifyContent: 'flex-start',
            }}
          >
            <span>Terms of Service</span>
            <span>•</span>
            <span>Privacy Policy</span>
            <span>•</span>
            <span>Enterprise Security</span>
          </div>
        </div>

        {/* RIGHT COLUMN: Lottie Animation Showcase */}
        <div
          style={{
            flex: '1 1 480px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 380,
          }}
        >
          <LottieShowcase />
        </div>
      </main>

      {/* Responsive Breakpoints */}
      <style>{`
        @media (max-width: 1024px) {
          .login-lottie-split {
            flex-direction: column !important;
            padding: 16px 20px 40px !important;
            gap: 32px !important;
          }
        }
      `}</style>
    </div>
  );
}
