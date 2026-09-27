import React, { useState, useEffect } from 'react';
import { Search, Bell, Zap, ChevronDown, Command, Sparkles, Mic } from 'lucide-react';

export default function Topbar({ title, subtitle, onAskSara, onTalkWithSara, onSearch }) {
  const [searchVal, setSearchVal] = useState('');
  const [credits, setCredits] = useState('...');

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
      <div className="search-input" style={{ flex: '0 0 280px' }}>
        <Search size={14} color="var(--text-muted)" />
        <input
          placeholder="Search anything..."
          value={searchVal}
          onChange={e => setSearchVal(e.target.value)}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, opacity: 0.6, fontSize: 11 }}>
          <Command size={11} />
          <span>K</span>
        </div>
      </div>

      {/* Title */}
      <div style={{ flex: 1, paddingLeft: 16 }}>
        {title && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{subtitle}</div>}
          </div>
        )}
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Credits */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
          background: 'linear-gradient(135deg,#f5f3ff,#ede9fe)',
          border: '1px solid #ddd6fe', borderRadius: 20, cursor: 'pointer'
        }}>
          <Zap size={12} color="#7c3aed" />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed' }}>₹{credits}</span>
          <span style={{ fontSize: 11, color: '#a78bfa' }}>credits</span>
        </div>

        {/* Talk with Sara Button */}
        <button
          className="btn btn-primary btn-sm"
          onClick={onTalkWithSara}
          style={{
            background: 'linear-gradient(135deg, #10b981, #059669)',
            border: 'none',
            boxShadow: '0 2px 10px rgba(16, 185, 129, 0.35)',
            gap: 6,
            fontWeight: 700,
            padding: '6px 14px'
          }}
          title="Start live conversational speech with SARA"
        >
          <Mic size={14} className="animate-pulse" />
          Talk with Sara
        </button>

        {/* Ask Sara */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={onAskSara}
        >
          <Sparkles size={13} color="#7c3aed" />
          Ask Sara
        </button>

        {/* Notifications */}
        <button className="btn-ghost btn btn-icon" style={{ position: 'relative' }}>
          <Bell size={16} />
          <div style={{
            position: 'absolute', top: 6, right: 6,
            width: 7, height: 7, borderRadius: '50%',
            background: '#7c3aed', border: '2px solid #fff'
          }} />
        </button>

        {/* Profile */}
        <div style={{ display:'flex', alignItems:'center', gap: 7, cursor:'pointer',
          padding: '4px 8px', borderRadius: 8, transition:'background 0.15s' }}
          onMouseEnter={e=>e.currentTarget.style.background='var(--surface-soft)'}
          onMouseLeave={e=>e.currentTarget.style.background='transparent'}
        >
          <div className="avatar avatar-sm" style={{
            background: 'linear-gradient(135deg,#7c3aed,#a78bfa)',
            color: '#fff', fontWeight: 700, fontSize: 12
          }}>A</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Abhi</div>
          <ChevronDown size={13} color="var(--text-muted)" />
        </div>
      </div>
    </header>
  );
}
