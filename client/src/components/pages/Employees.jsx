import React, { useState, useEffect } from 'react';
import { Bot, Phone, Play, MoreHorizontal, PlusCircle, Search, Filter,
  TrendingUp, CheckSquare, Sparkles, Pause, Edit3, Mic, RefreshCw } from 'lucide-react';

const FILTERS = ['All', 'Active', 'Idle', 'Draft'];

export default function Employees({ onNavigate }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/employees');
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching employees:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const filtered = employees.filter(e => {
    const matchSearch = (e.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.role || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.department || '').toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'All' ||
      (filter === 'Active' && e.status === 'active') ||
      (filter === 'Idle' && e.status === 'idle') ||
      (filter === 'Draft' && e.status === 'draft');
    return matchSearch && matchFilter;
  });

  return (
    <div className="page-content animate-fade-in">
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:'var(--text-primary)', fontFamily:'Plus Jakarta Sans' }}>
            My AI Employees
          </h1>
          <p style={{ margin:'4px 0 0', fontSize:14, color:'var(--text-muted)' }}>
            {employees.filter(e=>e.status==='active').length} active · {employees.length} total AI employees in your workforce
          </p>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button className="btn btn-secondary" onClick={fetchEmployees}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => onNavigate('employees/new')}>
            <PlusCircle size={15} />
            Create AI Employee
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <div className="search-input" style={{ flex:'0 0 260px' }}>
          <Search size={14} color="var(--text-muted)" />
          <input placeholder="Search employees..." value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        <div style={{ display:'flex', gap:6 }}>
          {FILTERS.map(f => (
            <button key={f} className={`chip ${filter===f?'active':''}`} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={24} className="spin" style={{ marginBottom: 10 }} />
          <div>Loading AI employees...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><Bot size={28} color="#94a3b8" /></div>
          <div style={{ fontWeight:700, fontSize:16, color:'var(--text-primary)', marginBottom:6 }}>No AI employees found</div>
          <p style={{ color:'var(--text-muted)', fontSize:14, marginBottom:16 }}>
            Create your first AI employee and let Sara handle the work.
          </p>
          <button className="btn btn-primary" onClick={() => onNavigate('employees/new')}>
            <PlusCircle size={14} /> Create AI Employee
          </button>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:16 }}>
          {filtered.map(e => (
            <div key={e.id} className="card" style={{ padding:0, overflow:'hidden', cursor:'pointer' }}
              onClick={() => onNavigate('employee-detail', { employeeId: e.id })}>
              {/* Card Header */}
              <div style={{ padding:'18px 18px 14px', borderBottom:'1px solid var(--border)' }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                  <div className="avatar avatar-lg" style={{
                    background: (e.name && (e.name.toLowerCase().includes('yashwanth') || e.name.toLowerCase().includes('karthik')))
                      ? '#e05638'
                      : 'linear-gradient(135deg, #7c3aed, #a78bfa)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 18
                  }}>
                    {e.name ? e.name[0] : 'A'}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontWeight:800, fontSize:16, color:'var(--text-primary)' }}>{e.name}</span>
                      <span className={`badge ${
                        e.status==='active'?'badge-active':
                        e.status==='idle'?'badge-paused':'badge-training'
                      }`} style={{fontSize:10}}>
                        {e.status==='active'&&<span className="live-dot" style={{width:5,height:5}} />}
                        {e.status}
                      </span>
                    </div>
                    <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{e.role}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:1 }}>Dept: {e.department || 'General'}</div>
                  </div>
                </div>

                <p style={{ fontSize:12, color:'var(--text-secondary)', marginTop:10, lineHeight:1.5, margin:'10px 0 0' }}>
                  {e.mission || e.description || 'Dedicated AI employee handling assigned business outcomes.'}
                </p>
              </div>

              {/* Stats */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:0 }}>
                {[
                  { label:'Tasks', value:e.total_tasks || 0, icon:CheckSquare },
                  { label:'Calls', value:e.total_calls || 0, icon:Phone },
                  { label:'Score', value:e.performance_score ? `${e.performance_score}` : '5.0', icon:TrendingUp },
                ].map(({ label, value, icon:Icon }) => (
                  <div key={label} style={{ padding:'12px', textAlign:'center', borderRight:'1px solid var(--border)' }}>
                    <div style={{ fontSize:18, fontWeight:800, color:'var(--text-primary)' }}>{value}</div>
                    <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Skills / Actions */}
              <div style={{ padding:'12px 18px', borderTop:'1px solid var(--border)' }}>
                <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:12 }}>
                  {(e.skills || []).slice(0,3).map(s => (
                    <span key={s.name || s} style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:20,
                      background:'var(--surface-soft)', border:'1px solid var(--border)', color:'var(--text-secondary)' }}>
                      {s.name || s}
                    </span>
                  ))}
                  {(!e.skills || e.skills.length === 0) && (
                    <span style={{ fontSize:11, color:'var(--text-muted)' }}>Universal Skills Enabled</span>
                  )}
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button className="btn btn-primary btn-sm" style={{ flex:1, justifyContent:'center' }}
                    onClick={ev=>{ev.stopPropagation(); onNavigate('employee-detail', { employeeId: e.id })}}>
                    <Play size={11} /> Profile
                  </button>
                  <button className="btn btn-secondary btn-sm" style={{ flex:1, justifyContent:'center' }}
                    onClick={ev=>{ev.stopPropagation(); onNavigate('calls')}}>
                    <Mic size={11} /> Call
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
