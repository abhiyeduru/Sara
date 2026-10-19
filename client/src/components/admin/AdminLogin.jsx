import React, { useState } from 'react';
import { ShieldCheck, Lock, Mail, ArrowRight, Eye, EyeOff, AlertCircle, ArrowLeft, KeyRound } from 'lucide-react';

export default function AdminLogin({ onLoginSuccess, onCancel }) {
  const [email, setEmail] = useState('admin@sara.ai');
  const [password, setPassword] = useState('sara@Admin2026!');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/v1/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: password.trim() })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('sara_admin_token', data.admin_token);
        localStorage.setItem('sara_admin_user', JSON.stringify(data.admin_user));
        if (onLoginSuccess) {
          onLoginSuccess(data.admin_user, data.admin_token);
        }
      } else {
        setError(data.detail || 'Invalid administrative credentials. Please verify your email and password.');
      }
    } catch (err) {
      console.error('Admin login error:', err);
      setError('Unable to connect to the authentication server. Please check connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = () => {
    setEmail('admin@sara.ai');
    setPassword('sara@Admin2026!');
    setError(null);
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      background: 'radial-gradient(ellipse at top, #111827 0%, #030712 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      color: '#f8fafc',
      overflow: 'hidden'
    }}>
      {/* Background ambient glowing orbs */}
      <div style={{
        position: 'absolute',
        top: '15%',
        left: '20%',
        width: 380,
        height: 380,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(124, 58, 237, 0.16) 0%, rgba(124, 58, 237, 0) 70%)',
        filter: 'blur(40px)',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '15%',
        right: '20%',
        width: 420,
        height: 420,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59, 130, 246, 0.14) 0%, rgba(59, 130, 246, 0) 70%)',
        filter: 'blur(50px)',
        pointerEvents: 'none'
      }} />

      {/* Main Login Card */}
      <div style={{
        width: '100%',
        maxWidth: 440,
        background: 'rgba(17, 24, 39, 0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 24,
        padding: '36px 32px',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 40px rgba(124, 58, 237, 0.12)',
        position: 'relative',
        zIndex: 10
      }}>
        {/* Back button */}
        {onCancel && (
          <button
            onClick={onCancel}
            type="button"
            style={{
              position: 'absolute',
              top: 20,
              left: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 8,
              padding: '6px 12px',
              color: '#94a3b8',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#f8fafc';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = '#94a3b8';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            }}
          >
            <ArrowLeft size={13} />
            <span>Customer App</span>
          </button>
        )}

        {/* Header Icon */}
        <div style={{ textAlign: 'center', marginTop: onCancel ? 18 : 0, marginBottom: 24 }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(124, 58, 237, 0.4)',
            marginBottom: 16
          }}>
            <ShieldCheck size={30} color="#ffffff" />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.02em', color: '#ffffff' }}>
            SARA Admin Portal
          </h2>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>
            Platform Governance & Telephony Control Center
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 12.5,
            color: '#fca5a5'
          }}>
            <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Email input */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
              Administrator Email or ID
            </label>
            <div style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center'
            }}>
              <Mail size={16} color="#64748b" style={{ position: 'absolute', left: 14 }} />
              <input
                type="text"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@sara.ai"
                required
                style={{
                  width: '100%',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  borderRadius: 12,
                  padding: '12px 14px 12px 42px',
                  fontSize: 14,
                  color: '#ffffff',
                  outline: 'none',
                  transition: 'border 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={e => e.target.style.borderColor = '#7c3aed'}
                onBlur={e => e.target.style.borderColor = 'rgba(255, 255, 255, 0.14)'}
              />
            </div>
          </div>

          {/* Password input */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1' }}>
                Security Access Password
              </label>
            </div>
            <div style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center'
            }}>
              <Lock size={16} color="#64748b" style={{ position: 'absolute', left: 14 }} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                style={{
                  width: '100%',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  borderRadius: 12,
                  padding: '12px 42px 12px 42px',
                  fontSize: 14,
                  color: '#ffffff',
                  outline: 'none',
                  transition: 'border 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={e => e.target.style.borderColor = '#7c3aed'}
                onBlur={e => e.target.style.borderColor = 'rgba(255, 255, 255, 0.14)'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 12,
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Quick Credential Badge & Helper */}
          <div style={{
            background: 'rgba(124, 58, 237, 0.08)',
            border: '1px solid rgba(124, 58, 237, 0.2)',
            borderRadius: 12,
            padding: '12px',
            fontSize: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 6
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#c4b5fd', fontWeight: 600 }}>
                <KeyRound size={13} color="#a78bfa" />
                <span>Default Admin Credentials:</span>
              </div>
              <button
                type="button"
                onClick={handleQuickFill}
                style={{
                  background: 'rgba(124, 58, 237, 0.2)',
                  border: '1px solid rgba(124, 58, 237, 0.4)',
                  borderRadius: 6,
                  color: '#e9d5ff',
                  padding: '3px 8px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Auto Fill
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: 11.5 }}>
              <span>Email: <strong style={{ color: '#f8fafc' }}>admin@sara.ai</strong></span>
              <span>Pass: <strong style={{ color: '#f8fafc' }}>sara@Admin2026!</strong></span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 6,
              background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 12,
              padding: '13px',
              fontSize: 14,
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 8px 24px rgba(124, 58, 237, 0.35)',
              transition: 'all 0.2s',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? (
              <span>Authenticating Superadmin...</span>
            ) : (
              <>
                <span>Access Admin Control Center</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Security badge footer */}
        <div style={{
          marginTop: 24,
          paddingTop: 16,
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          textAlign: 'center',
          fontSize: 11.5,
          color: '#64748b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6
        }}>
          <ShieldCheck size={13} color="#10b981" />
          <span>Encrypted Session • HMAC Signed SHA-256 Token</span>
        </div>
      </div>
    </div>
  );
}
