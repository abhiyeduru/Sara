import React, { useState, useEffect } from 'react';
import { Search, Bell, Zap, ChevronDown, Command, Sparkles, Mic, Menu } from 'lucide-react';

export default function Topbar({
  title,
  subtitle,
  onAskSara,
  onTalkWithSara,
  currentUser,
  onLogout,
  onOpenOnboarding,
  onNavigate,
  onToggleMobileMenu
}) {
  const [searchVal, setSearchVal] = useState('');
  const [credits, setCredits] = useState('...');
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    fetch('/api/v1/billing/balance')
      .then(res => res.json())
      .then(data => {
        if (data && data.balance !== undefined) {
          if (data.is_unlimited || data.plan === 'unlimited') {
            setCredits('Unlimited');
          } else {
            setCredits(Number(data.balance).toLocaleString('en-IN'));
          }
        }
      })
      .catch(() => setCredits('1,000'));
  }, []);

  return (
    <header className="topbar">
      {/* Mobile Hamburger Toggle */}
      <button
        className="topbar-hamburger-btn"
        onClick={onToggleMobileMenu}
        aria-label="Toggle Navigation Menu"
      >
        <Menu size={20} />
      </button>

      {/* Search Bar (Desktop only) */}
      <div className="search-input topbar-search-box">
        <Search size={14} color="var(--text-muted)" />
        <input
          placeholder="Search anything..."
          value={searchVal}
          onChange={e => setSearchVal(e.target.value)}
          style={{ fontSize: 13, background: 'transparent' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 10, background: '#f1f5f9', padding: '1px 5px', borderRadius: 4, color: 'var(--text-secondary)', fontWeight: 700 }}>
          <Command size={10} />
          <span>K</span>
        </div>
      </div>

      {/* Dynamic Page Title */}
      <div className="topbar-title-section" style={{ flex: 1, minWidth: 0, paddingLeft: 8 }}>
        {title && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {title}
            </div>
            {subtitle && <div className="hide-on-mobile" style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>}
          </div>
        )}
      </div>

      {/* Right Action Controls */}
      <div className="topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Billing Balance */}
        <div
          onClick={() => onNavigate && onNavigate('billing')}
          className="topbar-credit-pill"
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
            background: 'var(--accent-light)',
            border: '1px solid rgba(124, 58, 237, 0.2)', borderRadius: 20, cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          title="View Billing & Add Credits"
        >
          <Zap size={13} color="#7c3aed" />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed' }}>
            {credits === 'Unlimited' ? '∞ Unlimited' : `₹${credits}`}
          </span>
          <span className="hide-on-mobile" style={{ fontSize: 11, color: 'var(--text-muted)' }}>credits</span>
        </div>

        {/* Talk with Sara Button (Desktop only; on mobile it is the Hero center button on bottom nav) */}
        <button
          className="btn btn-primary btn-sm topbar-btn-talk hide-on-mobile"
          onClick={onTalkWithSara}
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            border: 'none',
            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
            gap: 5,
            fontWeight: 700,
            padding: '6px 12px',
            borderRadius: 20
          }}
          title="Start live voice assistant with SARA"
        >
          <Mic size={14} />
          <span>Talk with Sara</span>
        </button>

        {/* Ask Sara Button (Desktop only) */}
        <button
          className="btn btn-secondary btn-sm topbar-btn-ask hide-on-mobile"
          onClick={onAskSara}
          style={{ borderRadius: 20, padding: '6px 12px' }}
        >
          <Sparkles size={13} color="#7c3aed" />
          <span>Ask Sara</span>
        </button>

        {/* Notifications */}
        <button className="btn-ghost btn btn-icon" style={{ position: 'relative' }}>
          <Bell size={16} color="var(--text-secondary)" />
          <div style={{
            position: 'absolute', top: 6, right: 6,
            width: 7, height: 7, borderRadius: '50%',
            background: '#7c3aed', border: '2px solid #fff'
          }} />
        </button>

        {/* Profile Dropdown */}
        <div style={{ position: 'relative' }}>
          <div
            onClick={() => setShowUserMenu(!showUserMenu)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
              padding: '4px 10px', borderRadius: 20, border: '1px solid var(--border)',
              background: '#ffffff', transition: 'background 0.15s'
            }}
          >
            {currentUser?.avatar_url ? (
              <img src={currentUser.avatar_url} alt="Avatar" style={{ width: 24, height: 24, borderRadius: '50%' }} />
            ) : (
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: 'linear-gradient(135deg,#7c3aed,#ec4899)',
                color: '#fff', fontWeight: 700, fontSize: 11,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {(currentUser?.name || currentUser?.email || 'U')[0].toUpperCase()}
              </div>
            )}
            <div className="hide-on-mobile" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUser?.name || 'Account'}
            </div>
            <ChevronDown size={13} color="var(--text-muted)" className="hide-on-mobile" />
          </div>

          {showUserMenu && (
            <div style={{
              position: 'absolute', right: 0, top: 38, width: 220, background: '#fff',
              borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.12)', border: '1px solid var(--border)',
              zIndex: 100, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 6
            }}>
              <div style={{ padding: '4px 8px 8px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{currentUser?.name || 'User'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUser?.email}</div>
              </div>

              {onOpenOnboarding && (
                <button
                  onClick={() => { setShowUserMenu(false); onOpenOnboarding(); }}
                  style={{
                    background: 'none', border: 'none', textAlign: 'left', padding: '8px 10px',
                    borderRadius: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-soft)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  🏢 Edit Business Details
                </button>
              )}

              {onNavigate && (
                <button
                  onClick={() => { setShowUserMenu(false); onNavigate('admin'); }}
                  style={{
                    background: 'none', border: 'none', textAlign: 'left', padding: '8px 10px',
                    borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#7c3aed',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(124, 58, 237, 0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  🛡️ Admin Control Center
                </button>
              )}



              {onLogout && (
                <button
                  onClick={() => { setShowUserMenu(false); onLogout(); }}
                  style={{
                    background: 'none', border: 'none', textAlign: 'left', padding: '8px 10px',
                    borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#ef4444',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  🚪 Log Out
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}


