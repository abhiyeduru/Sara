import React, { useState, useEffect } from 'react';
import { Building2, Users, TrendingUp, Phone, MessageCircle,
  Search, Filter, Plus, ChevronRight, ArrowRight, RefreshCw, PhoneCall } from 'lucide-react';
import SkeletonLoader from '../common/SkeletonLoader';

const STAGES = [
  { id:'new', label:'New', color:'#64748b' },
  { id:'contacted', label:'Contacted', color:'#0284c7' },
  { id:'qualified', label:'Qualified', color:'#7c3aed' },
  { id:'proposal', label:'Proposal Sent', color:'#ea580c' },
  { id:'negotiation', label:'Negotiation', color:'#ca8a04' },
  { id:'won', label:'Won', color:'#16a34a' },
  { id:'lost', label:'Lost', color:'#dc2626' },
];

export default function CRM({ onNavigate }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/leads');
      if (res.ok) {
        const data = await res.json();
        setLeads(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const filteredLeads = leads.filter(l =>
    (l.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.intent || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-content animate-fade-in">
      {/* Luxury Editorial Header */}
      <div className="page-header" style={{ marginBottom: 28 }}>
        <div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px',
            borderRadius: 20, background: 'rgba(147, 51, 234, 0.08)', border: '1px solid rgba(147, 51, 234, 0.18)',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            color: '#7E22CE', marginBottom: 8
          }}>
            <Building2 size={12} color="#A855F7" />
            Autonomous CRM & Deals
          </div>
          <h1 className="page-title">
            CRM & Pipeline Center
          </h1>
          <p className="page-subtitle">
            AI-managed sales pipeline · {leads.length} active leads tracked across stages
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={fetchLeads}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => onNavigate('leads')}>
            <Plus size={14} /> Add Lead
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 22, maxWidth: 340 }}>
        <div className="search-input" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12 }}>
          <Search size={14} color="#94A3B8" />
          <input placeholder="Filter pipeline leads..." value={search} onChange={e => setSearch(e.target.value)} style={{ fontSize: 13.5 }} />
        </div>
      </div>

      {/* Kanban Board */}
      {loading && leads.length === 0 ? (
        <SkeletonLoader type="kanban" />
      ) : leads.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><Building2 size={28} color="#94a3b8" /></div>
          <div style={{ fontWeight:700, fontSize:16, color:'var(--text-primary)', marginBottom:6 }}>No Leads in CRM</div>
          <p style={{ color:'var(--text-muted)', fontSize:14, marginBottom:16 }}>
            Add leads to see them progress through autonomous qualification stages.
          </p>
          <button className="btn btn-primary" onClick={() => onNavigate('leads')}>
            <Plus size={14} /> Add First Lead
          </button>
        </div>
      ) : (
        <div style={{ display:'flex', gap:16, overflowX:'auto', paddingBottom: 16 }}>
          {STAGES.map(stage => {
            const stageLeads = filteredLeads.filter(l =>
              (l.pipeline_stage || l.status || '').toLowerCase() === stage.id ||
              (stage.id === 'proposal' && (l.pipeline_stage || '').toLowerCase().includes('proposal')) ||
              (stage.id === 'negotiation' && (l.pipeline_stage || '').toLowerCase().includes('negotiat')) ||
              (stage.id === 'qualified' && (l.status || '').toLowerCase() === 'qualified')
            );

            return (
              <div
                key={stage.id}
                style={{
                  flex:'0 0 280px',
                  background:'var(--bg-secondary, #f8fafc)',
                  borderRadius:10,
                  border:'1px solid var(--border)',
                  padding:14,
                  display:'flex',
                  flexDirection:'column',
                  maxHeight:'calc(100vh - 240px)'
                }}
              >
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ width:8, height:8, borderRadius:'50%', background: stage.color }} />
                    <span style={{ fontWeight:700, fontSize:13, color:'var(--text-primary)' }}>{stage.label}</span>
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:10, background:'#fff', border:'1px solid var(--border)', color:'var(--text-muted)' }}>
                    {stageLeads.length}
                  </span>
                </div>

                <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:10 }}>
                  {stageLeads.length === 0 ? (
                    <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, fontStyle: 'italic' }}>
                      No leads in this stage
                    </div>
                  ) : (
                    stageLeads.map(l => (
                      <div
                        key={l.id}
                        className="card"
                        style={{ padding:14, borderRadius:8, border:'1px solid var(--border)', background:'#fff', cursor:'pointer' }}
                        onClick={() => onNavigate('leads')}
                      >
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                          <span style={{ fontWeight:700, fontSize:14, color:'var(--text-primary)' }}>{l.name}</span>
                          <span style={{
                            fontSize:11, fontWeight:700, padding:'2px 6px', borderRadius:8,
                            background: l.lead_score >= 80 ? '#ecfdf5' : '#fffbeb',
                            color: l.lead_score >= 80 ? '#059669' : '#d97706'
                          }}>
                            {l.lead_score || 50}
                          </span>
                        </div>

                        <div style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:8, lineHeight:1.4 }}>
                          {l.intent || 'General Property Inquiry'}
                        </div>

                        {l.budget && (
                          <div style={{ fontSize:11, fontWeight:600, color:'var(--primary)', marginBottom:8 }}>
                            Budget: {l.budget}
                          </div>
                        )}

                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', borderTop:'1px solid var(--border)', paddingTop:8 }}>
                          <span style={{ fontSize:11, color:'var(--text-muted)' }}>{l.phone || 'Web Lead'}</span>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding:'4px 8px', fontSize:11 }}
                            onClick={(e) => { e.stopPropagation(); onNavigate('calls'); }}
                          >
                            <PhoneCall size={11} /> Call
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
