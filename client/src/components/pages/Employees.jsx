import React, { useState, useEffect } from 'react';
import { Bot, Phone, Play, MoreHorizontal, PlusCircle, Search, Filter,
  TrendingUp, CheckSquare, Sparkles, Pause, Edit3, Mic, RefreshCw } from 'lucide-react';
import SkeletonLoader from '../common/SkeletonLoader';
import MascotDisplay from './MascotDisplay';

const DEFAULT_EMPLOYEES = [
  {
    id: 'emp_sara_exec',
    name: 'Sara',
    role: 'Executive Business Assistant & Outreach Lead',
    department: 'Sales & Operations',
    status: 'active',
    mascot: 'glasses',
    total_tasks: 142,
    total_calls: 388,
    performance_score: 98,
    mission: 'Autonomous business assistant handling lead qualification, scheduling, and executive operations.',
    skills: [{ name: 'Multilingual Voice AI' }, { name: 'CRM Integration' }, { name: 'Appointment Booking' }]
  },
  {
    id: 'emp_kiet_sales',
    name: 'Kiet',
    role: 'Senior Outbound Sales Specialist',
    department: 'Sales & Outreach',
    status: 'active',
    mascot: 'kamran',
    total_tasks: 89,
    total_calls: 214,
    performance_score: 94,
    mission: 'Specialized outbound cold dialer and deal closing agent for property & fitness campaigns.',
    skills: [{ name: 'Direct Plivo Calling' }, { name: 'Objection Handling' }, { name: 'Instant Follow-up' }]
  },
  {
    id: 'emp_priya_support',
    name: 'Priya',
    role: 'Multilingual Customer Care Specialist',
    department: 'Customer Support',
    status: 'active',
    mascot: 'afro',
    total_tasks: 110,
    total_calls: 305,
    performance_score: 96,
    mission: '24/7 multilingual customer care agent handling inquiries in English, Telugu, and Hindi.',
    skills: [{ name: 'Telugu & English Speech' }, { name: 'Ticket Resolution' }, { name: 'Sentiment Analysis' }]
  }
];

function getMascotKey(e) {
  if (e.mascot) return e.mascot;
  const name = (e.name || '').toLowerCase();
  if (name.includes('sara')) return 'glasses';
  if (name.includes('priya')) return 'afro';
  if (name.includes('farhan')) return 'beard';
  return 'kamran';
}

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
        setEmployees(data.data ? data.data : DEFAULT_EMPLOYEES);
      } else {
        setEmployees(DEFAULT_EMPLOYEES);
      }
    } catch (err) {
      console.error('Error fetching employees:', err);
      setEmployees(DEFAULT_EMPLOYEES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const hasEmployees = employees.length > 0;
  const displayEmployees = hasEmployees ? employees : [];

  const filtered = displayEmployees.filter(e => {
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
    <div className="page-content animate-fade-in" style={{ padding: '32px 36px 48px', maxWidth: 1440, margin: '0 auto' }}>
      {/* Dynamic Shine Keyframes */}
      <style>{`
        @keyframes cardShineSweep {
          0% { transform: translateX(-150%) rotate(25deg); }
          40% { transform: translateX(150%) rotate(25deg); }
          100% { transform: translateX(150%) rotate(25deg); }
        }
        .shiny-create-card {
          position: relative;
          overflow: hidden;
          background: linear-gradient(135deg, #ffffff 0%, #f5f3ff 50%, #ffffff 100%);
          border: 1.5px solid rgba(124, 58, 237, 0.3);
          box-shadow: 0 10px 30px rgba(124, 58, 237, 0.1);
          border-radius: 24px;
          padding: 48px 32px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .shiny-create-card::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(
            60deg,
            transparent 30%,
            rgba(255, 255, 255, 0.75) 50%,
            transparent 70%
          );
          transform: rotate(25deg);
          animation: cardShineSweep 4.5s ease-in-out infinite;
          pointer-events: none;
        }
      `}</style>

      {/* Luxury Editorial Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px',
            borderRadius: 20, background: 'rgba(124, 58, 237, 0.08)', border: '1px solid rgba(124, 58, 237, 0.18)',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            color: '#7c3aed', marginBottom: 8
          }}>
            <Bot size={12} color="#7c3aed" />
            Autonomous AI Workforce
          </div>
          <h1 className="font-editorial" style={{ fontSize: 32, fontWeight: 600, color: 'var(--text-primary)', margin: 0, lineHeight: 1.15 }}>
            My AI Employees
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, marginTop: 4 }}>
            {hasEmployees ? `${filtered.filter(e => e.status === 'active').length} active · ${filtered.length} total AI digital workers in your company` : 'Manage and deploy digital workers for your company'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={fetchEmployees} style={{ borderRadius: 20 }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>

          {/* Small + Create button visible only when employees already exist */}
          {hasEmployees && (
            <button className="btn btn-primary" onClick={() => onNavigate('employees/new')} style={{ borderRadius: 20, background: 'var(--brand-gradient)', border: 'none' }}>
              <PlusCircle size={15} />
              + Create
            </button>
          )}
        </div>
      </div>

      {/* Search + Filter Tabs (Shown when employees exist) */}
      {hasEmployees && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
          <div className="search-input" style={{ flex: '0 0 280px', background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 12, padding: '8px 14px' }}>
            <Search size={14} color="var(--text-muted)" />
            <input placeholder="Search by name, role, department..." value={search} onChange={e => setSearch(e.target.value)} style={{ fontSize: 13.5 }} />
          </div>
          <div className="luxury-tabs">
            {FILTERS.map(f => (
              <button key={f} className={`tab-item ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grid or Empty Highlighted Card */}
      {loading ? (
        <SkeletonLoader type="cards" count={6} />
      ) : !hasEmployees ? (
        /* Highlighted "Create your first AI Employee" card with subtle shine when NO employees exist */
        <div className="shiny-create-card animate-fade-in">
          <div style={{
            width: 68,
            height: 68,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
            boxShadow: '0 8px 24px rgba(124, 58, 237, 0.25)'
          }}>
            <Sparkles size={32} color="#ffffff" />
          </div>

          <h2 className="font-editorial" style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Create your first AI Employee
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14.5, marginTop: 8, maxWidth: 500, lineHeight: 1.55, marginBottom: 28 }}>
            Build and hire your first autonomous digital worker in under 1 minute. Pick a character role, confirm details, and start delegating voice calls.
          </p>

          <button
            onClick={() => onNavigate('employees/new')}
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
              border: 'none',
              color: '#ffffff',
              padding: '14px 32px',
              borderRadius: 30,
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: '0 6px 20px rgba(124, 58, 237, 0.35)',
              transition: 'transform 0.15s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'none'}
          >
            <PlusCircle size={18} />
            <span>Create your first AI Employee</span>
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state card" style={{ padding: '48px 24px', textAlign: 'center', borderRadius: 16 }}>
          <div className="empty-icon"><Bot size={28} color="#7c3aed" /></div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 6 }}>No matching AI employees found</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, marginBottom: 16 }}>
            Adjust your search query or clear filters to view your workforce.
          </p>
          <button className="btn btn-secondary" onClick={() => { setSearch(''); setFilter('All'); }} style={{ borderRadius: 20 }}>
            Clear Search
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18 }}>
          {filtered.map(e => (
            <div key={e.id} className="card" style={{ padding: 0, overflow: 'hidden', cursor: 'pointer', borderRadius: 16 }}
              onClick={() => onNavigate('employee-detail', { employeeId: e.id })}>
              {/* Card Header */}
              <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <MascotDisplay
                    mascotKey={getMascotKey(e)}
                    size={88}
                    label={e.name}
                    fallbackLetter={e.name ? e.name[0] : 'A'}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{e.name}</span>
                      <span className={`badge ${
                        e.status === 'active' ? 'badge-active' :
                        e.status === 'idle' ? 'badge-paused' : 'badge-training'
                      }`} style={{ fontSize: 10 }}>
                        {e.status === 'active' && <span className="live-dot" style={{ width: 5, height: 5 }} />}
                        {e.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2, fontWeight: 500 }}>{e.role}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>Dept: {e.department || 'General'}</div>
                  </div>
                </div>

                <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 12, lineHeight: 1.5, margin: '12px 0 0' }}>
                  {e.mission || e.description || 'Dedicated AI employee handling assigned business outcomes.'}
                </p>
              </div>

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0, background: 'var(--surface-soft)' }}>
                {[
                  { label: 'Tasks', value: e.total_tasks || 0 },
                  { label: 'Calls', value: e.total_calls || 0 },
                  { label: 'Score', value: e.performance_score ? `${e.performance_score}%` : '95%' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ padding: '12px 8px', textAlign: 'center', borderRight: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Skills / Actions */}
              <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                  {(e.skills || []).slice(0, 3).map(s => (
                    <span key={s.name || s} style={{
                      fontSize: 10.5, fontWeight: 600, padding: '3px 9px', borderRadius: 14,
                      background: 'rgba(124, 58, 237, 0.08)', border: '1px solid rgba(124, 58, 237, 0.18)', color: '#7c3aed'
                    }}>
                      {s.name || s}
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center', borderRadius: 10, background: '#7c3aed' }}
                    onClick={ev => { ev.stopPropagation(); onNavigate('employee-detail', { employeeId: e.id }) }}>
                    <Play size={12} /> Profile
                  </button>
                  <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center', borderRadius: 10 }}
                    onClick={ev => { ev.stopPropagation(); onNavigate('calls') }}>
                    <Mic size={12} /> Call
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* "+ Hire AI Employee" Card side-by-side in grid */}
          <div
            onClick={() => onNavigate('employees/new')}
            style={{
              border: '2px dashed rgba(124, 58, 237, 0.35)',
              borderRadius: 16,
              background: '#ffffff',
              padding: '36px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              cursor: 'pointer',
              minHeight: 280,
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#7c3aed';
              e.currentTarget.style.background = 'rgba(124, 58, 237, 0.04)';
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 12px 24px rgba(124, 58, 237, 0.12)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(124, 58, 237, 0.35)';
              e.currentTarget.style.background = '#ffffff';
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(124, 58, 237, 0.1)',
              border: '1.5px solid rgba(124, 58, 237, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#7c3aed',
              marginBottom: 14,
            }}>
              <PlusCircle size={28} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
              Hire AI Employee
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', maxWidth: 200, lineHeight: 1.4 }}>
              Add another digital worker to your team in 1 minute.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
