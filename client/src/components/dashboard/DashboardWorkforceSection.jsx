import React, { useState } from 'react';
import {
  Bot, Phone, Sparkles, ChevronDown, ChevronUp, Play,
  FileSpreadsheet, Settings, CheckCircle2, ShieldCheck,
  PhoneCall, Users, ArrowUpRight, Copy, Check
} from 'lucide-react';

export default function DashboardWorkforceSection({
  employees = [],
  onNavigate,
  onOpenBulkModal,
  onTestCall,
}) {
  const [expandedScriptId, setExpandedScriptId] = useState(null);
  const [copiedStageKey, setCopiedStageKey] = useState(null);

  const toggleExpand = (id) => {
    setExpandedScriptId(prev => prev === id ? null : id);
  };

  const handleCopy = (text, key) => {
    navigator.clipboard?.writeText(text);
    setCopiedStageKey(key);
    setTimeout(() => setCopiedStageKey(null), 2000);
  };

  return (
    <div
      className="dashboard-workforce-section"
      style={{
        background: '#ffffff',
        border: '1px solid rgba(124, 58, 237, 0.15)',
        borderRadius: 20,
        padding: '24px 28px',
        boxShadow: '0 4px 25px rgba(124, 58, 237, 0.05), 0 1px 3px rgba(0, 0, 0, 0.03)',
        marginBottom: 20,
        position: 'relative'
      }}
    >
      {/* ── SECTION HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)'
          }}>
            <Bot size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Autonomous AI Workforce
              </h3>
              <span style={{
                background: '#f5f3ff',
                color: '#7c3aed',
                border: '1px solid #ddd6fe',
                fontSize: 11,
                fontWeight: 800,
                padding: '2px 9px',
                borderRadius: 20
              }}>
                మీ AI ఉద్యోగులు ({employees.length})
              </span>
            </div>
            <p style={{ fontSize: 13, color: '#64748b', margin: '2px 0 0' }}>
              Your active digital telecallers with customized business scripts, ready for live inbound & outbound calls.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onNavigate && onNavigate('employees')}
            style={{ borderRadius: 12, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Users size={14} color="#7c3aed" />
            Manage All
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              const el = document.getElementById('ai-employee-builder-workspace');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)',
              border: 'none',
              borderRadius: 12,
              padding: '8px 16px',
              fontSize: 12.5,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: '#ffffff'
            }}
          >
            <Sparkles size={14} />
            + Build Another Employee
          </button>
        </div>
      </div>

      {/* ── EMPLOYEES GRID ── */}
      {employees.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          background: '#f8fafc',
          borderRadius: 14,
          border: '1.5px dashed #cbd5e1'
        }}>
          <Bot size={36} color="#94a3b8" style={{ margin: '0 auto 10px' }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: '#334155' }}>No AI Employees Created Yet</div>
          <div style={{ fontSize: 13, color: '#64748b', maxWidth: 420, margin: '6px auto 16px' }}>
            Describe your business in the builder above and click <b>"Build your AI employee"</b> to launch your first digital worker with a customized Telugu script!
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 16
          }}
        >
          {employees.map((emp) => {
            const isExpanded = expandedScriptId === emp.id;
            const cs = emp.call_script || {};
            const stages = emp.script_stages || cs.steps || [];
            const opening = cs.opening_line || (stages[0]?.dialogue?.te || stages[0]?.dialogue?.en || stages[0]?.content || '');
            const isInstant = (emp.calling_mode || 'instant') === 'instant';

            return (
              <div
                key={emp.id}
                style={{
                  background: emp.isNew ? 'linear-gradient(180deg, #faf5ff 0%, #ffffff 100%)' : '#ffffff',
                  border: emp.isNew ? '2px solid #a855f7' : '1px solid #e2e8f0',
                  borderRadius: 16,
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  boxShadow: emp.isNew
                    ? '0 8px 30px rgba(124, 58, 237, 0.15)'
                    : '0 2px 10px rgba(0, 0, 0, 0.03)',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                {/* Just Created Highlight Badge */}
                {emp.isNew && (
                  <div style={{
                    position: 'absolute',
                    top: -10,
                    right: 16,
                    background: 'linear-gradient(135deg, #7c3aed 0%, #d946ef 100%)',
                    color: '#ffffff',
                    fontSize: 10.5,
                    fontWeight: 800,
                    padding: '2px 10px',
                    borderRadius: 20,
                    boxShadow: '0 2px 8px rgba(124, 58, 237, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    <Sparkles size={11} />
                    ✨ JUST CREATED • READY
                  </div>
                )}

                {/* Card Top: Avatar, Name, Status */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: 18,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    position: 'relative',
                    boxShadow: '0 4px 12px rgba(139, 92, 246, 0.25)'
                  }}>
                    {(emp.name || 'S')[0]}
                    <span style={{
                      position: 'absolute',
                      bottom: -2,
                      right: -2,
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: '#10b981',
                      border: '2px solid #ffffff'
                    }} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <h4 style={{
                        fontSize: 15,
                        fontWeight: 800,
                        color: '#0f172a',
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {emp.name || 'Sara'}
                      </h4>
                      <span style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: '#059669',
                        background: '#ecfdf5',
                        border: '1px solid #a7f3d0',
                        padding: '1px 7px',
                        borderRadius: 10,
                        flexShrink: 0
                      }}>
                        ● Active
                      </span>
                    </div>

                    <div style={{
                      fontSize: 12.5,
                      color: '#6366f1',
                      fontWeight: 700,
                      marginTop: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {emp.role || 'Autonomous Telephony Specialist'}
                    </div>
                  </div>
                </div>

                {/* Badges: Calling Mode & Language */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 9px',
                    borderRadius: 12,
                    background: isInstant ? '#f5f3ff' : '#eff6ff',
                    color: isInstant ? '#7c3aed' : '#2563eb',
                    border: isInstant ? '1px solid #ddd6fe' : '1px solid #bfdbfe',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    {isInstant ? '⚡ Instant Lead Calling' : '📢 Bulk Campaign Calling'}
                  </span>

                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 9px',
                    borderRadius: 12,
                    background: '#f8fafc',
                    color: '#475569',
                    border: '1px solid #e2e8f0'
                  }}>
                    🇮🇳 {emp.voice_language === 'te' ? 'Telugu (Sweet)' : (emp.voice_language || 'Telugu').toUpperCase()}
                  </span>
                </div>

                {/* Script Snippet Accordion */}
                <div style={{
                  background: '#faf5ff',
                  border: '1px solid #e9d5ff',
                  borderRadius: 12,
                  padding: '10px 12px'
                }}>
                  <div
                    onClick={() => toggleExpand(emp.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      fontSize: 11.5,
                      fontWeight: 800,
                      color: '#7c3aed'
                    }}
                  >
                    <span>📜 Business Call Script ({stages.length || 5} Stages)</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </span>
                  </div>

                  {/* Collapsed State: Opening Greeting */}
                  {!isExpanded && opening && (
                    <div style={{
                      fontSize: 12,
                      color: '#4b5563',
                      marginTop: 6,
                      lineHeight: 1.4,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      "{opening}"
                    </div>
                  )}

                  {/* Expanded State: All 5 Stages */}
                  {isExpanded && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {stages.length > 0 ? stages.map((stg, sIdx) => {
                        const sNum = stg.step || sIdx + 1;
                        const sTitle = stg.title || stg.shortTitle || `Stage ${sNum}`;
                        const dText = typeof stg.dialogue === 'object'
                          ? (stg.dialogue?.te || stg.dialogue?.en || stg.dialogue?.hi || '')
                          : (stg.dialogue || stg.content || '');

                        return (
                          <div
                            key={sIdx}
                            style={{
                              background: '#ffffff',
                              border: '1px solid #f3e8ff',
                              borderRadius: 8,
                              padding: '8px 10px',
                              fontSize: 11.5
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                              <span style={{ fontWeight: 800, color: '#6d28d9' }}>{sTitle}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopy(dText, `${emp.id}_${sIdx}`);
                                }}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: copiedStageKey === `${emp.id}_${sIdx}` ? '#10b981' : '#94a3b8',
                                  cursor: 'pointer',
                                  padding: 0
                                }}
                              >
                                {copiedStageKey === `${emp.id}_${sIdx}` ? <Check size={12} /> : <Copy size={12} />}
                              </button>
                            </div>
                            <div style={{ color: '#334155', lineHeight: 1.35 }}>
                              "{dText}"
                            </div>
                          </div>
                        );
                      }) : (
                        <div style={{ fontSize: 11.5, color: '#64748b' }}>Customized business script active.</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Performance Stats */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 4,
                  borderTop: '1px solid #f1f5f9',
                  fontSize: 11.5,
                  color: '#64748b'
                }}>
                  <span>Calls: <b style={{ color: '#0f172a' }}>{emp.total_calls || 0}</b></span>
                  <span>Tasks: <b style={{ color: '#0f172a' }}>{emp.total_tasks || 0}</b></span>
                  <span>Score: <b style={{ color: '#7c3aed' }}>{emp.performance_score || 98}%</b></span>
                </div>

                {/* Card Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => onTestCall && onTestCall(emp)}
                    style={{
                      flex: 1,
                      background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 10,
                      padding: '7px 10px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                      boxShadow: '0 2px 8px rgba(124, 58, 237, 0.25)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <PhoneCall size={13} />
                    Test Call Now
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenBulkModal && onOpenBulkModal(emp)}
                    style={{
                      background: '#f5f3ff',
                      color: '#7c3aed',
                      border: '1px solid #ddd6fe',
                      borderRadius: 10,
                      padding: '7px 10px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4
                    }}
                    title="Send bulk leads to this AI employee"
                  >
                    <FileSpreadsheet size={13} />
                    Leads
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigate && onNavigate(`employees/${emp.id}`)}
                    style={{
                      background: '#f8fafc',
                      color: '#64748b',
                      border: '1px solid #e2e8f0',
                      borderRadius: 10,
                      padding: '7px 10px',
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Configure Employee"
                  >
                    <Settings size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
