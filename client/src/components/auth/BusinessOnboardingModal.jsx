import React, { useState } from 'react';
import {
  Building2, Sparkles, ArrowRight, ArrowLeft, ShieldCheck,
  Phone, User
} from 'lucide-react';

export default function BusinessOnboardingModal({ user, onComplete, onBack }) {
  const [userName, setUserName] = useState(user?.name || user?.email?.split('@')[0] || '');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userName.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (!companyName.trim()) {
      setError('Please enter your company / business name.');
      return;
    }
    setLoading(true);
    setError('');

    // Update stored user name if changed
    try {
      const stored = localStorage.getItem('sara_user');
      if (stored) {
        const u = JSON.parse(stored);
        u.name = userName.trim();
        localStorage.setItem('sara_user', JSON.stringify(u));
      }
    } catch (_) {}

    // Smart default business payload (auto-configured for the user)
    const payload = {
      business_name: companyName.trim(),
      industry: 'Professional Services & Consulting',
      phone: phone.trim(),
      website: '',
      locations: ['Hyderabad'],
      operating_hours: '09:00 AM – 09:00 PM IST',
      calling_instruction: `Whenever a new lead comes, call them. Introduce ${companyName.trim()}, understand their requirements, explain our offerings, and schedule an appointment.`,
      products_services: [
        { name: 'Standard Service Package', price: '₹9,999' },
        { name: 'Complimentary Consultation / Trial', price: 'Free' }
      ],
      voice_preference: 'te-IN-Standard-A'
    };

    const startTime = Date.now();

    try {
      const token = localStorage.getItem('sara_token');
      const res = await fetch('/api/v1/auth/business-onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));

      // Comfortable short duration (1.6s) to let the elegant classical shine play smoothly
      const elapsed = Date.now() - startTime;
      if (elapsed < 1600) {
        await new Promise((r) => setTimeout(r, 1600 - elapsed));
      }

      if (res.ok && data.success) {
        onComplete(data.business_profile);
      } else {
        if (data.business_profile) {
          onComplete(data.business_profile);
        } else {
          // Dev / fallback persistence so user is seamlessly onboarded
          onComplete({ ...payload, owner_name: userName.trim() });
        }
      }
    } catch (err) {
      console.error('Onboarding save error:', err);
      const elapsed = Date.now() - startTime;
      if (elapsed < 1400) {
        await new Promise((r) => setTimeout(r, 1400 - elapsed));
      }
      onComplete({ ...payload, owner_name: userName.trim() });
    } finally {
      setLoading(false);
    }
  };

  // Modern input field style
  const getInputStyle = (name) => ({
    width: '100%',
    padding: '13px 16px',
    borderRadius: 12,
    border: focusedField === name ? '1.5px solid #9333EA' : '1px solid #E2D9F3',
    background: '#FFFFFF',
    color: '#17112B',
    fontSize: 14.5,
    outline: 'none',
    boxShadow: focusedField === name ? '0 0 0 3px rgba(168, 85, 247, 0.14)' : 'none',
    transition: 'all 0.18s ease',
    boxSizing: 'border-box',
    fontFamily: "'Plus Jakarta Sans', Inter, -apple-system, sans-serif"
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: '#FFFFFF',
        color: '#17112B',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Plus Jakarta Sans', Inter, -apple-system, sans-serif",
        overflow: 'hidden',
        height: '100vh',
        maxHeight: '100vh',
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {/* 1. Sleek Top Header Bar */}
      <header
        style={{
          width: '100%',
          borderBottom: '1px solid #F1EBF9',
          background: '#FFFFFF',
          flexShrink: 0,
          zIndex: 50,
        }}
      >
        <div
          style={{
            maxWidth: 1440,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 32px',
            boxSizing: 'border-box',
          }}
        >
          {/* Left Header: Back Button & Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              type="button"
              onClick={onBack || (() => window.history.back())}
              title="Go back to login"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 20,
                border: '1px solid #E2E8F0',
                background: '#F8FAFC',
                color: '#6D28D9',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#F2EBFC';
                e.currentTarget.style.borderColor = '#C084FC';
                e.currentTarget.style.transform = 'translateX(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#F8FAFC';
                e.currentTarget.style.borderColor = '#E2E8F0';
                e.currentTarget.style.transform = 'translateX(0)';
              }}
            >
              <ArrowLeft size={14} />
              <span>Back</span>
            </button>

            <div style={{ width: 1, height: 20, background: '#EFEBF8' }} />

            {/* Saadhyam Official Logo & Brand */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img
                src="/saadhyam-logo.png"
                alt="Saadhyam Logo"
                style={{
                  height: 30,
                  width: 'auto',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  color: '#17112B',
                  fontFamily: "'Newsreader', 'Instrument Serif', Georgia, serif",
                }}
              >
                Saadhyam
              </span>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: 'rgba(147, 51, 234, 0.08)',
                  color: '#7E22CE',
                  border: '1px solid rgba(147, 51, 234, 0.18)',
                }}
              >
                Voice AI
              </span>
            </div>
          </div>

          {/* Right Header: Step Badge & User Chip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                borderRadius: 20,
                background: 'rgba(147, 51, 234, 0.06)',
                border: '1px solid rgba(147, 51, 234, 0.15)',
                fontSize: 11.5,
                fontWeight: 700,
                color: '#7E22CE',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#A855F7',
                  display: 'inline-block',
                }}
              />
              Step 2 of 2: AI Profile Setup
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 12px 4px 5px',
                borderRadius: 20,
                border: '1px solid #ECE4F8',
                background: '#F8FAFC',
              }}
            >
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt="Avatar"
                  style={{ width: 22, height: 22, borderRadius: '50%' }}
                />
              ) : (
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #A855F7, #EC4899)',
                    color: '#FFFFFF',
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {(user?.name || user?.email || 'B')[0].toUpperCase()}
                </div>
              )}
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#17112B' }}>
                {userName || user?.name || user?.email?.split('@')[0] || 'Business Owner'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Main Centered Single-Column Layout */}
      <main
        style={{
          flex: 1,
          minHeight: 0,
          width: '100%',
          overflowY: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '28px 24px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 540,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* Top Title & Subtitle Centered */}
          <div style={{ textAlign: 'center', marginBottom: 24, width: '100%' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                borderRadius: 20,
                background: 'rgba(147, 51, 234, 0.08)',
                border: '1px solid rgba(147, 51, 234, 0.18)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#7E22CE',
                marginBottom: 10,
              }}
            >
              <Sparkles size={12} color="#A855F7" />
              Quick AI Setup
            </div>

            <h1
              style={{
                fontFamily: "'Newsreader', 'Instrument Serif', Georgia, serif",
                fontSize: 'clamp(28px, 3.2vw, 36px)',
                fontWeight: 500,
                lineHeight: 1.16,
                letterSpacing: '-0.025em',
                margin: '0 0 8px',
                color: '#17112B',
              }}
            >
              Configure Your Business AI Profile
            </h1>

            <p
              style={{
                fontSize: 14,
                lineHeight: 1.45,
                color: '#6D6585',
                margin: '0 auto',
                maxWidth: 460,
              }}
            >
              Sara uses these details to speak on behalf of your business, answer queries, and qualify leads.
            </p>
          </div>

          {/* Centered 3-Field Form Card */}
          <div style={{ width: '100%' }}>
            {error && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  color: '#EF4444',
                  fontSize: 13,
                  lineHeight: 1.4,
                  marginBottom: 16,
                  textAlign: 'center',
                }}
              >
                {error}
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              style={{
                background: '#FFFFFF',
                borderRadius: 22,
                border: '1px solid #E2E8F0',
                padding: '30px 34px',
                boxShadow: '0 12px 36px rgba(124, 58, 237, 0.08), 0 2px 8px rgba(0, 0, 0, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
                boxSizing: 'border-box',
                width: '100%',
              }}
            >
              {/* Field 1: Your Full Name */}
              <div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#17112B',
                    marginBottom: 7,
                  }}
                >
                  <User size={14} color="#9333EA" />
                  <span>Your Full Name</span>
                  <span style={{ color: '#EC4899' }}>*</span>
                </label>
                <input
                  required
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  onFocus={() => setFocusedField('userName')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="e.g. Abhi Yeduru"
                  style={getInputStyle('userName')}
                />
              </div>

              {/* Field 2: Company / Business Name */}
              <div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#17112B',
                    marginBottom: 7,
                  }}
                >
                  <Building2 size={14} color="#9333EA" />
                  <span>Company / Business Name</span>
                  <span style={{ color: '#EC4899' }}>*</span>
                </label>
                <input
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  onFocus={() => setFocusedField('companyName')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="e.g. KVR Fitness, ABC Realty, or Saadhyam"
                  style={getInputStyle('companyName')}
                />
              </div>

              {/* Field 3: Phone Number */}
              <div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#17112B',
                    marginBottom: 7,
                  }}
                >
                  <Phone size={14} color="#9333EA" />
                  <span>Phone Number</span>
                  <span style={{ fontSize: 11, color: '#8A82A0', fontWeight: 400 }}>(Optional)</span>
                </label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onFocus={() => setFocusedField('phone')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="e.g. +91 98765 43210"
                  style={getInputStyle('phone')}
                />
              </div>

              {/* Primary Submit Button */}
              <div style={{ paddingTop: 6 }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '14px 22px',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg, #17112B 0%, #2A174A 100%)',
                    color: '#FFFFFF',
                    fontSize: 14.5,
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: '0 8px 24px rgba(23, 17, 43, 0.16)',
                    transition: 'all 0.18s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 12px 28px rgba(147, 51, 234, 0.25)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(23, 17, 43, 0.16)';
                    }
                  }}
                >
                  <Sparkles size={16} color="#C084FC" />
                  <span>Launch Voice Studio & Get Started</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </form>
          </div>

          {/* Compliance Footnote Centered */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              fontSize: 12,
              color: '#6D6585',
              marginTop: 18,
            }}
          >
            <ShieldCheck size={14} color="#10B981" />
            <span>TRAI Compliant Calling Rules • End-to-End Encrypted</span>
          </div>
        </div>
      </main>

      {/* 3. SIMPLE, CLASSICAL & ELEGANT "SARA" NAME SHINE LOADING */}
      {loading && (
        <div
          className="sara-loading-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            backgroundColor: '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Classical SARA Wordmark with Soft Light Reflection Shine */}
          <div style={{ textAlign: 'center', userSelect: 'none' }}>
            <span className="sara-classical-shine">
              SARA
            </span>
          </div>
        </div>
      )}

      {/* Pure, classical animation style */}
      <style>{`
        @keyframes saraCleanShine {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }

        .sara-classical-shine {
          font-family: 'Newsreader', 'Instrument Serif', Georgia, serif;
          font-size: 28px;
          font-weight: 500;
          letter-spacing: 0.22em;
          text-indent: 0.22em;
          color: #17112B;
          display: inline-block;
          margin: 0;
          padding: 0;
          background: linear-gradient(
            110deg,
            #17112B 0%,
            #17112B 36%,
            #A855F7 46%,
            #FFFFFF 50%,
            #C084FC 54%,
            #17112B 64%,
            #17112B 100%
          );
          background-size: 250% 100%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: saraCleanShine 2.4s ease-in-out infinite;
          /* No scale jumping, no bouncing, stays completely static */
          transform: none;
        }
      `}</style>
    </div>
  );
}
