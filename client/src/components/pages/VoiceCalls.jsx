import React, { useState, useEffect } from 'react';
import { Phone, Play, Pause, PhoneCall, Clock, TrendingUp, DollarSign,
  Users, ChevronRight, Mic, MicOff, PhoneOff, MessageSquare, RefreshCw, Volume2 } from 'lucide-react';

export default function VoiceCalls({ onNavigate }) {
  const [calls, setCalls] = useState([]);
  const [liveCalls, setLiveCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCallDetail, setActiveCallDetail] = useState(null);

  const fetchCalls = async () => {
    setLoading(true);
    try {
      const [callsRes, liveRes] = await Promise.all([
        fetch('/api/v1/calls'),
        fetch('/api/v1/calls/live')
      ]);
      if (callsRes.ok) {
        const data = await callsRes.json();
        setCalls(data.data || []);
      }
      if (liveRes.ok) {
        const liveData = await liveRes.json();
        setLiveCalls(liveData.data || []);
      }
    } catch (err) {
      console.error('Error fetching calls:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls();
    const interval = setInterval(fetchCalls, 8000);
    return () => clearInterval(interval);
  }, []);

  const totalCalls = calls.length;
  const connectedCalls = calls.filter(c => c.status === 'completed' || c.status === 'in-progress' || c.status === 'connected').length;
  const qualifiedCalls = calls.filter(c => c.outcome === 'QUALIFIED' || c.outcome === 'INTERESTED').length;
  const totalDurationSec = calls.reduce((acc, c) => acc + (c.duration_seconds || 0), 0);
  const avgDuration = totalCalls > 0 ? Math.round(totalDurationSec / totalCalls) : 0;
  const totalCredits = calls.reduce((acc, c) => acc + (c.credits_used || 0), 0);

  return (
    <div className="page-content animate-fade-in">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:'var(--text-primary)', fontFamily:'Plus Jakarta Sans' }}>Voice Calls</h1>
          <p style={{ margin:'4px 0 0', fontSize:14, color:'var(--text-muted)' }}>AI-powered voice calling dashboard & telephony logs</p>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button className="btn btn-secondary" onClick={fetchCalls}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => onNavigate('phone-numbers')}>
            <PhoneCall size={14} /> Make Outbound Call
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:12, marginBottom:20 }}>
        {[
          { label:'Active Now', value: liveCalls.length, color:'#16a34a' },
          { label:'Total Calls', value: totalCalls, color:'#0284c7' },
          { label:'Connected', value: connectedCalls, color:'#7c3aed' },
          { label:'Qualified / Interested', value: qualifiedCalls, color:'#16a34a' },
          { label:'Avg Duration', value: `${Math.floor(avgDuration / 60)}m ${avgDuration % 60}s`, color:'#ea580c' },
          { label:'Credits Used', value: totalCredits.toFixed(1), color:'#64748b' },
        ].map(({ label, value, color }) => (
          <div className="kpi-card" key={label} style={{ padding:14 }}>
            <div style={{ fontSize:22, fontWeight:800, color, marginBottom:4 }}>{value}</div>
            <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:500 }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns: activeCallDetail ? '1fr 380px' : '1fr', gap:20 }}>
        <div>
          {/* Live Calls (if any) */}
          {liveCalls.length > 0 && (
            <div className="card" style={{ marginBottom: 20, border: '1px solid #10b981', background: 'rgba(16,185,129,0.03)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: 14 }}>
                <span className="live-dot" />
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#059669' }}>Active Live Calls ({liveCalls.length})</h3>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap: 10 }}>
                {liveCalls.map(c => (
                  <div key={c.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', borderRadius:8, background:'#fff', border:'1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color:'var(--text-primary)' }}>{c.phone_number || c.to_number}</div>
                      <div style={{ fontSize: 11, color:'var(--text-muted)' }}>Caller: {c.employee_name || 'AI Employee'}</div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#10b981' }}>{c.duration_seconds || 0}s</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Calls History Table */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Call History</h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{calls.length} calls logged</span>
            </div>

            {loading && calls.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw size={24} className="spin" style={{ marginBottom: 10 }} />
                <div>Loading call records...</div>
              </div>
            ) : calls.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center' }}>
                <Phone size={36} color="var(--text-muted)" style={{ marginBottom: 10, opacity: 0.5 }} />
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>No Calls Logged Yet</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
                  Make your first outbound AI phone call to see live transcripts, recordings, and lead qualification scores.
                </p>
                <button className="btn btn-primary" onClick={() => onNavigate('phone-numbers')}>
                  <PhoneCall size={14} /> Make Outbound Call
                </button>
              </div>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse', textAlign:'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid var(--border)', background:'var(--bg-secondary, #fafafa)', color:'var(--text-muted)' }}>
                    <th style={{ padding:'10px 16px', fontWeight: 600 }}>DESTINATION</th>
                    <th style={{ padding:'10px 16px', fontWeight: 600 }}>AI EMPLOYEE</th>
                    <th style={{ padding:'10px 16px', fontWeight: 600 }}>STATUS</th>
                    <th style={{ padding:'10px 16px', fontWeight: 600 }}>DURATION</th>
                    <th style={{ padding:'10px 16px', fontWeight: 600 }}>OUTCOME</th>
                    <th style={{ padding:'10px 16px', fontWeight: 600 }}>DATE</th>
                    <th style={{ padding:'10px 16px', fontWeight: 600, textAlign:'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map(c => (
                    <tr
                      key={c.id}
                      onClick={() => setActiveCallDetail(c)}
                      style={{ borderBottom:'1px solid var(--border)', cursor:'pointer', background: activeCallDetail?.id === c.id ? 'var(--surface-soft)' : 'transparent' }}
                    >
                      <td style={{ padding:'12px 16px', fontWeight: 600, color:'var(--text-primary)', fontFamily:'monospace' }}>
                        {c.to_number || c.phone_number || 'Direct Call'}
                      </td>
                      <td style={{ padding:'12px 16px', color:'var(--text-primary)' }}>
                        {c.employee_name || 'AI Employee'}
                      </td>
                      <td style={{ padding:'12px 16px' }}>
                        <span style={{
                          padding:'2px 8px', borderRadius:10, fontSize:11, fontWeight:600, textTransform:'capitalize',
                          background: c.status === 'completed' ? '#ecfdf5' : '#f1f5f9',
                          color: c.status === 'completed' ? '#059669' : '#475569'
                        }}>
                          {c.status}
                        </span>
                      </td>
                      <td style={{ padding:'12px 16px', color:'var(--text-muted)' }}>
                        {c.duration_seconds || 0}s
                      </td>
                      <td style={{ padding:'12px 16px' }}>
                        {c.outcome ? (
                          <span style={{
                            padding:'2px 8px', borderRadius:10, fontSize:11, fontWeight:600,
                            background: c.outcome === 'QUALIFIED' || c.outcome === 'INTERESTED' ? '#ecfdf5' : '#fef2f2',
                            color: c.outcome === 'QUALIFIED' || c.outcome === 'INTERESTED' ? '#059669' : '#dc2626'
                          }}>
                            {c.outcome}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding:'12px 16px', color:'var(--text-muted)', fontSize: 12 }}>
                        {c.created_at ? new Date(c.created_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : 'Today'}
                      </td>
                      <td style={{ padding:'12px 16px', textAlign:'right' }}>
                        <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); setActiveCallDetail(c); }}>
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Call Detail Sidebar Drawer */}
        {activeCallDetail && (
          <div className="card" style={{ padding: 20, display:'flex', flexDirection:'column', gap: 14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color:'var(--text-primary)' }}>Call Inspection</h3>
                <div style={{ fontSize: 12, color:'var(--text-muted)', fontFamily:'monospace', marginTop: 2 }}>{activeCallDetail.id}</div>
              </div>
              <button
                onClick={() => setActiveCallDetail(null)}
                style={{ background:'none', border:'none', fontSize: 18, cursor:'pointer', color:'var(--text-muted)' }}
              >
                ×
              </button>
            </div>

            {/* AI Summary */}
            {activeCallDetail.summary && (
              <div style={{ padding:'12px 14px', borderRadius:8, background:'var(--bg-secondary, #f8fafc)', border:'1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color:'var(--primary)', marginBottom: 4, textTransform:'uppercase' }}>AI Summary</div>
                <div style={{ fontSize: 13, color:'var(--text-secondary)', lineHeight: 1.5 }}>{activeCallDetail.summary}</div>
              </div>
            )}

            {/* Audio Recording */}
            {activeCallDetail.recording_url && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color:'var(--text-primary)', marginBottom: 6, display:'flex', alignItems:'center', gap: 6 }}>
                  <Volume2 size={14} color="var(--primary)" /> Call Recording
                </div>
                <audio controls src={activeCallDetail.recording_url} style={{ width:'100%', height: 36 }} />
              </div>
            )}

            {/* Transcript */}
            <div style={{ flex: 1, minHeight: 200, display:'flex', flexDirection:'column' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color:'var(--text-primary)', marginBottom: 8, display:'flex', alignItems:'center', gap: 6 }}>
                <MessageSquare size={14} color="var(--primary)" /> Conversation Transcript
              </div>
              <div style={{ flex: 1, maxHeight: 300, overflowY:'auto', border:'1px solid var(--border)', borderRadius: 8, padding: 10, display:'flex', flexDirection:'column', gap: 8, background:'var(--bg-input, #fff)' }}>
                {(activeCallDetail.transcript || []).length === 0 ? (
                  <div style={{ color:'var(--text-muted)', fontSize: 12, fontStyle:'italic', textAlign:'center', padding: 20 }}>
                    No speech recorded for this session.
                  </div>
                ) : (
                  (activeCallDetail.transcript || []).map((msg, i) => (
                    <div key={i} style={{ fontSize: 12 }}>
                      <span style={{ fontWeight: 700, color: msg.speaker === 'Customer' || msg.role === 'user' ? '#0284c7' : 'var(--primary)' }}>
                        {msg.speaker || msg.role}:
                      </span>{' '}
                      <span style={{ color:'var(--text-primary)' }}>{msg.text || msg.content}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
