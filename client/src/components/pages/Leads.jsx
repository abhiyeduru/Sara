import React, { useState, useEffect } from 'react';
import { Users, Star, Phone, MessageCircle, Mail, Filter, Search,
  ChevronRight, Plus, TrendingUp, Clock, ArrowUpRight, RefreshCw, PhoneCall } from 'lucide-react';

const STATUSES = ['All', 'new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];

export default function Leads({ onNavigate }) {
  const [leads, setLeads] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newIntent, setNewIntent] = useState('');
  const [newBudget, setNewBudget] = useState('');
  const [newEmpId, setNewEmpId] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const [lRes, eRes] = await Promise.all([
        fetch('/api/v1/leads'),
        fetch('/api/v1/employees')
      ]);
      if (lRes.ok) {
        const lData = await lRes.json();
        setLeads(lData.data || []);
      }
      if (eRes.ok) {
        const eData = await eRes.json();
        const emps = eData.data || [];
        setEmployees(emps);
        if (emps.length > 0 && !newEmpId) {
          setNewEmpId(emps[0].id);
        }
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

  const handleCreateLead = async (e) => {
    e.preventDefault();
    if (!newName) return;
    setCreating(true);
    try {
      const res = await fetch('/api/v1/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          phone: newPhone,
          email: newEmail,
          intent: newIntent,
          budget: newBudget,
          ai_employee_id: newEmpId || null,
        }),
      });
      if (res.ok) {
        setShowAddModal(false);
        setNewName('');
        setNewPhone('');
        setNewEmail('');
        setNewIntent('');
        setNewBudget('');
        fetchLeads();
      }
    } catch (err) {
      console.error('Error adding lead:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleCallLead = async (lead) => {
    if (!lead.phone) {
      alert('Lead does not have a phone number');
      return;
    }
    const empId = lead.ai_employee_id || (employees[0]?.id);
    if (!empId) {
      alert('Please select or assign an AI employee first.');
      return;
    }

    try {
      const res = await fetch('/api/v1/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: empId,
          to: lead.phone,
          lead_id: lead.id,
        }),
      });
      if (res.ok) {
        alert(`Autonomous AI call initiated to ${lead.name}!`);
        onNavigate('calls');
      } else {
        const data = await res.json();
        alert(data.detail || 'Could not place call');
      }
    } catch (err) {
      console.error('Call lead error:', err);
    }
  };

  const filtered = leads.filter(l => {
    const matchSearch = (l.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.phone || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.intent || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="page-content animate-fade-in">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:'var(--text-primary)', fontFamily:'Plus Jakarta Sans' }}>Leads</h1>
          <p style={{ margin:'4px 0 0', fontSize:14, color:'var(--text-muted)' }}>{leads.length} leads · AI-managed qualification pipeline</p>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button className="btn btn-secondary" onClick={fetchLeads}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={14} /> Add Lead
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <div className="search-input" style={{ flex:'0 0 280px' }}>
          <Search size={14} color="var(--text-muted)" />
          <input placeholder="Search leads by name, phone..." value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        <div style={{ display:'flex', gap:6, overflowX:'auto' }}>
          {STATUSES.map(s => (
            <button key={s} className={`chip ${statusFilter===s?'active':''}`} onClick={() => setStatusFilter(s)}>
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading && leads.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} className="spin" style={{ marginBottom: 10 }} />
            <div>Loading leads...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <Users size={36} color="var(--text-muted)" style={{ marginBottom: 10, opacity: 0.5 }} />
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>No Leads in Pipeline</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
              Add inbound leads or connect website forms to auto-route to AI sales employees.
            </p>
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              <Plus size={14} /> Add Lead
            </button>
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', textAlign:'left', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--border)', background:'var(--bg-secondary, #fafafa)', color:'var(--text-muted)' }}>
                <th style={{ padding:'12px 16px', fontWeight: 600 }}>LEAD NAME</th>
                <th style={{ padding:'12px 16px', fontWeight: 600 }}>CONTACT</th>
                <th style={{ padding:'12px 16px', fontWeight: 600 }}>INTENT & BUDGET</th>
                <th style={{ padding:'12px 16px', fontWeight: 600 }}>SCORE</th>
                <th style={{ padding:'12px 16px', fontWeight: 600 }}>STAGE</th>
                <th style={{ padding:'12px 16px', fontWeight: 600, textAlign:'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td style={{ padding:'14px 16px', fontWeight: 600, color:'var(--text-primary)' }}>
                    <div>{l.name}</div>
                    <div style={{ fontSize: 11, color:'var(--text-muted)', fontWeight: 400 }}>Source: {l.source || 'Website'}</div>
                  </td>
                  <td style={{ padding:'14px 16px', color:'var(--text-muted)', fontFamily:'monospace' }}>
                    <div>{l.phone || '—'}</div>
                    <div style={{ fontSize: 11, fontFamily:'sans-serif' }}>{l.email || ''}</div>
                  </td>
                  <td style={{ padding:'14px 16px' }}>
                    <div style={{ fontWeight: 500, color:'var(--text-primary)' }}>{l.intent || 'General Inquiry'}</div>
                    <div style={{ fontSize: 11, color:'var(--text-muted)' }}>{l.budget || ''}</div>
                  </td>
                  <td style={{ padding:'14px 16px' }}>
                    <span style={{
                      padding:'2px 8px', borderRadius:10, fontSize:12, fontWeight:700,
                      background: l.lead_score >= 80 ? '#ecfdf5' : '#fffbeb',
                      color: l.lead_score >= 80 ? '#059669' : '#d97706',
                    }}>
                      {l.lead_score || 50}
                    </span>
                  </td>
                  <td style={{ padding:'14px 16px' }}>
                    <span style={{
                      padding:'3px 8px', borderRadius:12, fontSize:11, fontWeight:600, textTransform:'capitalize',
                      background: l.status === 'qualified' ? '#ecfdf5' : '#f1f5f9',
                      color: l.status === 'qualified' ? '#059669' : '#475569',
                    }}>
                      {l.pipeline_stage || l.status}
                    </span>
                  </td>
                  <td style={{ padding:'14px 16px', textAlign:'right' }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleCallLead(l)}
                      style={{ display:'inline-flex', alignItems:'center', gap: 6 }}
                    >
                      <PhoneCall size={12} /> Call
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, padding: 24, borderRadius: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>
              Add Lead to Pipeline
            </h2>
            <form onSubmit={handleCreateLead}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Varma"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 14 }}
                />
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 98490 12345"
                    value={newPhone}
                    onChange={e => setNewPhone(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, fontFamily:'monospace' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="name@example.com"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                    Intent / Requirement
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 3 BHK Villa, Gachibowli"
                    value={newIntent}
                    onChange={e => setNewIntent(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                    Budget Range
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ₹2 Cr - ₹2.5 Cr"
                    value={newBudget}
                    onChange={e => setNewBudget(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Assign to AI Employee
                </label>
                <select
                  value={newEmpId}
                  onChange={e => setNewEmpId(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }}
                >
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn btn-primary"
                  style={{ padding: '8px 18px', borderRadius: 6, fontSize: 14, fontWeight: 600 }}
                >
                  {creating ? 'Saving...' : 'Add Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
