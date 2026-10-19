import React from 'react';
import { Zap, Megaphone, CheckCircle2, PhoneIncoming, Users } from 'lucide-react';

const MODES = [
  {
    id: 'instant',
    title: 'Instant Lead Calling',
    subtitle: 'Under 5 seconds for new ads & web leads',
    badge: 'Real-time',
    icon: Zap,
    description: 'Handles individual incoming enquiries or newly generated leads within seconds.'
  },
  {
    id: 'bulk',
    title: 'Bulk Calling',
    subtitle: 'Auto campaigns & scheduled contact lists',
    badge: 'Campaigns',
    icon: Megaphone,
    description: 'Processes a selected contact list or campaign according to configured cadence rules.'
  }
];

export default function CallingModeSelector({ selectedMode, onSelectMode, onOpenBulkModal }) {
  return (
    <div className="calling-mode-selector" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <span>Calling Mode</span>
        </label>
        {selectedMode === 'bulk' && onOpenBulkModal && (
          <button
            type="button"
            onClick={onOpenBulkModal}
            style={{
              background: '#f5f3ff',
              border: '1px solid #ddd6fe',
              color: '#6d28d9',
              fontSize: 11,
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: 14,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <span>📂 Open Bulk Leads / Excel</span>
          </button>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 10
        }}
      >
        {MODES.map((m) => {
          const isActive = selectedMode === m.id;
          const Icon = m.icon;

          return (
            <div
              key={m.id}
              onClick={() => {
                onSelectMode(m.id);
                if (m.id === 'bulk' && onOpenBulkModal) {
                  onOpenBulkModal();
                }
              }}
              className={`mode-card ${isActive ? 'active' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 14,
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                background: isActive ? '#f5f3ff' : '#ffffff',
                border: isActive ? '1.5px solid #7c3aed' : '1px solid #e2e8f0',
                boxShadow: isActive
                  ? '0 4px 16px rgba(124, 58, 237, 0.12)'
                  : '0 1px 3px rgba(0, 0, 0, 0.04)',
                position: 'relative',
                userSelect: 'none'
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: isActive
                    ? 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)'
                    : '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isActive ? '#ffffff' : '#64748b',
                  flexShrink: 0,
                  transition: 'all 0.2s ease',
                  boxShadow: isActive ? '0 2px 8px rgba(124, 58, 237, 0.25)' : 'none'
                }}
              >
                <Icon size={16} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: isActive ? '#1e1b4b' : '#1e293b',
                      lineHeight: 1.2
                    }}
                  >
                    {m.title}
                  </span>
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      padding: '2px 6px',
                      borderRadius: 6,
                      background: isActive ? '#7c3aed' : '#f1f5f9',
                      color: isActive ? '#ffffff' : '#64748b',
                      letterSpacing: '0.04em'
                    }}
                  >
                    {m.badge}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: 11.5,
                    color: isActive ? '#6d28d9' : '#64748b',
                    marginTop: 3,
                    lineHeight: 1.35
                  }}
                >
                  {m.subtitle}
                </div>
              </div>

              {isActive && (
                <div
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    color: '#7c3aed',
                    display: 'flex'
                  }}
                >
                  <CheckCircle2 size={13} fill="#7c3aed" color="#ffffff" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
