import React, { useState, useEffect } from 'react';
import AdminLogin from './AdminLogin';
import AdminPanel from '../pages/AdminPanel';
import { ShieldCheck, LogOut, ArrowLeft, Radio, Server } from 'lucide-react';

export default function AdminPortal({ onNavigate }) {
  const [adminToken, setAdminToken] = useState(() => {
    try {
      return localStorage.getItem('sara_admin_token') || null;
    } catch {
      return null;
    }
  });

  const [adminUser, setAdminUser] = useState(() => {
    try {
      const saved = localStorage.getItem('sara_admin_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [verifying, setVerifying] = useState(true);

  // Verify session on mount with dedicated admin token or authorized user bearer token
  useEffect(() => {
    const existingAdminToken = adminToken || localStorage.getItem('sara_admin_token');
    if (existingAdminToken) {
      fetch('/api/v1/admin/auth/me', {
        headers: { 'X-Admin-Token': existingAdminToken }
      })
        .then(res => {
          if (!res.ok) throw new Error('Invalid token');
          return res.json();
        })
        .then(data => {
          if (data && data.authenticated) {
            setAdminUser(data.admin_user);
            setAdminToken(existingAdminToken);
            localStorage.setItem('sara_admin_token', existingAdminToken);
            localStorage.setItem('sara_admin_user', JSON.stringify(data.admin_user));
          }
        })
        .catch(() => {
          localStorage.removeItem('sara_admin_token');
          localStorage.removeItem('sara_admin_user');
          setAdminToken(null);
          setAdminUser(null);
        })
        .finally(() => {
          setVerifying(false);
        });
      return;
    }

    // Check if active user session is an authorized platform administrator or owner
    const userToken = localStorage.getItem('sara_token');
    const userObj = JSON.parse(localStorage.getItem('sara_user') || 'null');
    if (userToken && userObj) {
      fetch('/api/v1/admin/auth/me', {
        headers: { 'Authorization': `Bearer ${userToken}` }
      })
        .then(res => {
          if (!res.ok) throw new Error('Not admin');
          return res.json();
        })
        .then(data => {
          if (data && data.authenticated) {
            setAdminUser(data.admin_user);
            setAdminToken(userToken);
            localStorage.setItem('sara_admin_user', JSON.stringify(data.admin_user));
          }
        })
        .catch(() => {})
        .finally(() => {
          setVerifying(false);
        });
      return;
    }

    setVerifying(false);
  }, []);

  const handleLoginSuccess = (user, token) => {
    setAdminToken(token);
    setAdminUser(user);
  };

  const handleLogout = async () => {
    try {
      if (adminToken) {
        await fetch('/api/v1/admin/auth/logout', {
          method: 'POST',
          headers: { 'X-Admin-Token': adminToken }
        });
      }
    } catch {}

    localStorage.removeItem('sara_admin_token');
    localStorage.removeItem('sara_admin_user');
    setAdminToken(null);
    setAdminUser(null);
  };

  const handleReturnToCustomer = () => {
    const hostname = (typeof window !== 'undefined' ? window.location.hostname || '' : '').toLowerCase();
    if (hostname.includes('admin.saadhyam.com') || hostname.startsWith('admin.')) {
      window.location.href = 'https://sara.saadhyam.com';
      return;
    }
    if (onNavigate) {
      onNavigate('dashboard');
    } else {
      window.location.hash = '#dashboard';
    }
  };

  // If still checking session
  if (verifying) {
    return (
      <div style={{
        minHeight: '100vh',
        width: '100vw',
        background: '#090d16',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#94a3b8',
        fontSize: 14,
        fontWeight: 600
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShieldCheck size={20} color="#7c3aed" />
          <span>Verifying Administrator Credentials...</span>
        </div>
      </div>
    );
  }

  // If not logged in as Admin, show AdminLogin
  if (!adminToken) {
    return (
      <AdminLogin
        onLoginSuccess={handleLoginSuccess}
        onCancel={handleReturnToCustomer}
      />
    );
  }

  // Once authenticated, show Executive Admin Layout & Dashboard
  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      background: 'var(--bg-main, #f8fafc)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Dedicated Executive Admin Portal Top Bar */}
      <header
        className="admin-header"
        style={{
          minHeight: 56,
          background: '#090d16',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
        }}
      >
        {/* Left: Branding & Role */}
        <div className="admin-header-left" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer'
          }} onClick={handleReturnToCustomer}>
            <div style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(124, 58, 237, 0.4)',
              flexShrink: 0
            }}>
              <ShieldCheck size={16} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>ADMIN CONTROL</span>
                <span style={{
                  fontSize: 9.5,
                  padding: '2px 5px',
                  borderRadius: 4,
                  background: 'rgba(124, 58, 237, 0.3)',
                  border: '1px solid rgba(124, 58, 237, 0.5)',
                  color: '#c4b5fd',
                  fontWeight: 700,
                  letterSpacing: '0.04em'
                }}>
                  SUPERADMIN
                </span>
              </div>
              <div className="admin-header-sub hide-on-mobile" style={{ fontSize: 10.5, color: '#64748b' }}>
                Multi-Tenant Telecom OS
              </div>
            </div>
          </div>
        </div>

        {/* Center: Live Platform Connectivity Badge */}
        <div className="admin-header-center hide-on-mobile" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            padding: '4px 10px',
            borderRadius: 20,
            fontSize: 11.5,
            fontWeight: 600,
            color: '#34d399'
          }}>
            <Radio size={12} color="#10b981" />
            <span>Carrier Gateway & WSS Tunnel Active</span>
          </div>
        </div>

        {/* Right: User Profile & Actions */}
        <div className="admin-header-right" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Admin User Pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 20
          }}>
            <div style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: '#7c3aed',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              A
            </div>
            <span className="admin-user-pill-email hide-on-mobile" style={{ fontSize: 11.5, fontWeight: 600, color: '#e2e8f0', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {adminUser?.email || 'admin@sara.ai'}
            </span>
          </div>

          {/* Switch to Customer Dashboard */}
          <button
            onClick={handleReturnToCustomer}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              borderRadius: 8,
              padding: '5px 10px',
              color: '#cbd5e1',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#fff';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.14)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = '#cbd5e1';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            }}
            title="Switch back to standard customer workspace view"
          >
            <ArrowLeft size={13} />
            <span className="hide-on-mobile">Customer App</span>
          </button>

          {/* Admin Logout Button */}
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: 8,
              padding: '5px 10px',
              color: '#f87171',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
            }}
            title="Log out from Admin Portal"
          >
            <LogOut size={13} />
            <span className="hide-on-mobile">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Admin Content Body */}
      <main style={{ flex: 1, padding: 0, overflow: 'auto' }}>
        <AdminPanel onNavigate={onNavigate} />
      </main>
    </div>
  );
}
