import React, { useState, useEffect } from 'react';
import { Search, Bell, Zap, ChevronDown, Command, Sparkles, Mic } from 'lucide-react';

export default function Topbar({ title, subtitle, onAskSara, onTalkWithSara, onSearch, currentUser, onLogout, onOpenOnboarding }) {
  const [searchVal, setSearchVal] = useState('');
  const [credits, setCredits] = useState('...');
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    fetch('/api/v1/billing/balance')
      .then(res => res.json())
      .then(data => {
        if (data && data.balance !== undefined) {
          setCredits(Number(data.balance).toLocaleString('en-IN'));
        }
      })
      .catch(() => setCredits('1,000'));
  }, []);

  return (
    <header className="topbar">
      {/* Search */}
      <div className="search-input" style={{
        flex: '0 0 280px',
        background: '#f8fafc',
        border: '1px solid var(--border)',
        borderRadius: 8
      }}>
        <Search size={14} color="#94a3b8" />
        <input
          placeholder="Search anything..."
          value={searchVal}
          onChange={e => setSearchVal(e.target.value)}
          style={{ fontSize: 13, background: 'transparent' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 11, background: '#e2e8f0', padding: '1px 5px', borderRadius: 4, color: '#475569', fontWeight: 600 }}>
          <Command size={10} />
          <span>K</span>
        </div>
      </div>

      {/* Title */}
      <div style={{ flex: 1, paddingLeft: 16 }}>
        {title && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', lineHeight: 1.2, letterSpacing: '-0.01em' }}>
              {title}
            </div>
            {subtitle && <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>{subtitle}</div>}
          </div>
        )}
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Credits */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
          background: '#f8fafc',
          border: '1px solid var(--border)', borderRadius: 20, cursor: 'pointer'
        }}>
          <Zap size={13} color="#2563eb" />
          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>₹{credits}</span>
          <span style={{ fontSize: 11, color: '#64748b' }}>credits</span>
        </div>

        {/* Talk with Sara Button */}
        <button
          className="btn btn-primary btn-sm"
          onClick={onTalkWithSara}
          style={{
            background: '#10b981',
            border: 'none',
            boxShadow: '0 1px 3px rgba(16, 185, 129, 0.3)',
            gap: 6,
            fontWeight: 600,
            padding: '6px 14px'
          }}
          title="Start live conversational speech with SARA"
        >
          <Mic size={14} />
          Talk with Sara
        </button>

        {/* Ask Sara */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={onAskSara}
        >
          <Sparkles size={13} color="#2563eb" />
          Ask Sara
        </button>

        {/* Notifications */}
        <button className="btn-ghost btn btn-icon" style={{ position: 'relative' }}>
          <Bell size={16} />
          <div style={{
            position: 'absolute', top: 6, right: 6,
            width: 7, height: 7, borderRadius: '50%',
            background: '#2563eb', border: '2px solid #fff'
          }} />
        </button>

        {/* Profile Dropdown */}
        <div style={{ position: 'relative' }}>
          <div
            onClick={() => setShowUserMenu(!showUserMenu)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
              padding: '4px 10px', borderRadius: 20, border: '1px solid var(--border)',
              background: 'var(--bg-secondary, #f8fafc)', transition: 'background 0.15s'
            }}
          >
            {currentUser?.avatar_url ? (
              <img src={currentUser.avatar_url} alt="Avatar" style={{ width: 24, height: 24, borderRadius: '50%' }} />
            ) : (
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: 'linear-gradient(135deg,#7c3aed,#a78bfa)',
                color: '#fff', fontWeight: 700, fontSize: 11,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {(currentUser?.name || currentUser?.email || 'U')[0].toUpperCase()}
              </div>
            )}
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUser?.name || 'Account'}
            </div>
            <ChevronDown size={13} color="var(--text-muted)" />
          </div>

          {showUserMenu && (
            <div style={{
              position: 'absolute', right: 0, top: 38, width: 220, background: '#fff',
              borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.15)', border: '1px solid var(--border)',
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
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary, #f8fafc)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  🏢 Edit Business Details
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
