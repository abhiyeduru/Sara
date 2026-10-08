import React, { useState, useEffect } from 'react';
import {
  UsersRound, Plus, Bot, ArrowRight, CheckCircle2, Target, Sparkles,
  GitBranch, ShieldCheck, MoreVertical, Settings, UserPlus, RefreshCw, Trash2, X
} from 'lucide-react';
import SkeletonLoader from '../common/SkeletonLoader';

const DEFAULT_TEAMS = [
  {
    id: 'team_sales_pod',
    name: 'Outbound Sales & Lead Qualification Pod',
    department: 'Sales & Outreach',
    status: 'active',
    leader: 'Sara (Sales Lead)',
    mission: 'High-speed lead outreach, qualifying customer inquiries, and scheduling appointments.',
    members_count: 3,
    members: [
      { id: '1', name: 'Sara', role: 'lead' },
      { id: '2', name: 'Kiet', role: 'member' },
      { id: '3', name: 'Priya', role: 'member' }
    ]
  },
  {
    id: 'team_support_squad',
    name: '24/7 Customer Care & Support Tier-1',
    department: 'Customer Support',
    status: 'active',
    leader: 'Priya (Support Lead)',
    mission: 'Resolving customer queries, multilingual helpdesk support, and ticketing escalations.',
    members_count: 2,
    members: [
      { id: '3', name: 'Priya', role: 'lead' },
      { id: '1', name: 'Sara', role: 'member' }
    ]
  },
  {
    id: 'team_realestate_squad',
    name: 'Real Estate & Property Advisory Unit',
    department: 'Operations & Sales',
    status: 'active',
    leader: 'Kiet (Property Lead)',
    mission: 'Handling property inquiries, cab pickup scheduling, and buyer site visits.',
    members_count: 2,
    members: [
      { id: '2', name: 'Kiet', role: 'lead' },
      { id: '1', name: 'Sara', role: 'member' }
    ]
  }
];

export default function Teams({ onNavigate }) {
  const [teams, setTeams] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [newDepartment, setNewDepartment] = useState('Sales & Outreach');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [creating, setCreating] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [teamsRes, empsRes] = await Promise.all([
        fetch('/api/v1/teams'),
        fetch('/api/v1/employees'),
      ]);

      if (teamsRes.ok) {
        const tData = await teamsRes.json();
        setTeams(tData.data && tData.data.length > 0 ? tData.data : DEFAULT_TEAMS);
      } else {
        setTeams(DEFAULT_TEAMS);
      }

      if (empsRes.ok) {
        const eData = await empsRes.json();
        setEmployees(eData.data || []);
      }
    } catch (err) {
      console.error('Error fetching teams:', err);
      setTeams(DEFAULT_TEAMS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const displayTeams = teams.length > 0 ? teams : DEFAULT_TEAMS;

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newTeamName) return;
    setCreating(true);
    try {
      const res = await fetch('/api/v1/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTeamName,
          mission: newTeamDesc,
          department: newDepartment,
          status: 'active',
          member_ids: selectedMembers,
        }),
      });
      if (res.ok) {
        setShowModal(false);
        setNewTeamName('');
        setNewTeamDesc('');
        setSelectedMembers([]);
        await fetchData();
      }
    } catch (err) {
      console.error('Error creating team:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (teamId) => {
    if (!confirm('Are you sure you want to delete this AI team?')) return;
    try {
      const res = await fetch(`/api/v1/teams/${teamId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Error deleting team:', err);
    }
  };

  const toggleMemberSelection = (empId) => {
    if (selectedMembers.includes(empId)) {
      setSelectedMembers(selectedMembers.filter(id => id !== empId));
    } else {
      setSelectedMembers([...selectedMembers, empId]);
    }
  };

  return (
    <div style={{ padding: '32px 36px 48px', maxWidth: 1440, margin: '0 auto' }} className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px',
            borderRadius: 20, background: 'rgba(124, 58, 237, 0.08)', border: '1px solid rgba(124, 58, 237, 0.18)',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            color: '#7c3aed', marginBottom: 8
          }}>
            <UsersRound size={12} color="#7c3aed" />
            Multi-Agent AI Pods
          </div>
          <h1 className="font-editorial" style={{ fontSize: 32, fontWeight: 600, color: 'var(--text-primary)', margin: 0, lineHeight: 1.15 }}>
            AI Teams & Collaborative Units
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, marginTop: 4 }}>
            Organize AI employees into multi-agent units that collaborate, delegate sub-tasks, and execute end-to-end business outcomes.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={fetchData} title="Refresh" style={{ borderRadius: 20 }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="btn btn-primary"
            style={{ borderRadius: 20, background: 'var(--brand-gradient)', border: 'none', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Plus size={16} /> Create AI Team
          </button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <SkeletonLoader type="cards" count={3} />
      ) : displayTeams.length === 0 ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center', borderRadius: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <UsersRound size={28} color="#7c3aed" />
          </div>
          <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>No AI Teams Created Yet</h3>
          <p style={{ margin: '0 auto 20px', fontSize: 13.5, color: 'var(--text-secondary)', maxWidth: 440 }}>
            Group specialized AI employees into collaborative units (e.g. Sales Pod, Support Tier 1) that share context and delegate sub-tasks autonomously.
          </p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ borderRadius: 20 }}>
            <Plus size={14} /> Create First AI Team
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 20 }}>
          {displayTeams.map((t) => (
            <div key={t.id} className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRadius: 16 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{t.name}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <span style={{
                        padding: '3px 9px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                        background: t.status === 'active' ? '#ecfdf5' : '#f1f5f9',
                        color: t.status === 'active' ? '#059669' : '#64748b',
                        border: '1px solid #d1fae5'
                      }}>
                        ● {(t.status || 'ACTIVE').toUpperCase()}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        Dept: <strong style={{ color: 'var(--text-primary)' }}>{t.department || 'General'}</strong>
                      </span>
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(t.id)} title="Delete team">
                    <Trash2 size={15} color="#ef4444" />
                  </button>
                </div>

                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 18 }}>
                  {t.mission || t.description || 'Autonomous collaborative unit handling end-to-end tasks.'}
                </p>

                {/* Team Members List */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginBottom: 16 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    <Bot size={14} color="#7c3aed" /> ASSIGNED AI EMPLOYEES ({t.members_count || (t.members ? t.members.length : 0)})
                  </div>
                  {(!t.members || t.members.length === 0) ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No members assigned yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {t.members.map((m) => (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-soft)', padding: '5px 12px', borderRadius: 20, border: '1px solid var(--border)' }}>
                          <div className="avatar avatar-sm av-sales" style={{ width: 22, height: 22, fontSize: 10, background: 'var(--brand-gradient)' }}>
                            {(m.name || 'AI').charAt(0)}
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</span>
                          {m.role === 'lead' && (
                            <span style={{ fontSize: 9, background: '#ede9fe', color: '#7c3aed', padding: '1px 6px', borderRadius: 8, fontWeight: 800 }}>
                              LEAD
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                  Team Lead: <strong style={{ color: 'var(--text-primary)' }}>{t.leader || 'Sara (Lead)'}</strong>
                </span>
                <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('tasks')} style={{ borderRadius: 10 }}>
                  Assign Task <ArrowRight size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Team Modal */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 520, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UsersRound size={18} color="#7c3aed" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Assemble New AI Team</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Group agents for collaborative autonomous execution</div>
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: 14 }}>
                <label className="label">Team Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Inbound Qualification Pod, Escalations Squad"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label className="label">Department</label>
                <select className="select" value={newDepartment} onChange={(e) => setNewDepartment(e.target.value)}>
                  <option value="Sales & Outreach">Sales & Outreach</option>
                  <option value="Customer Support">Customer Support</option>
                  <option value="Operations & Backoffice">Operations & Backoffice</option>
                  <option value="Marketing">Marketing</option>
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label className="label">Mission & Objectives</label>
                <textarea
                  className="textarea"
                  rows={2}
                  placeholder="Define this unit's primary responsibility, KPIs, and handoff criteria..."
                  value={newTeamDesc}
                  onChange={(e) => setNewTeamDesc(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label className="label">Select AI Employees to Include ({selectedMembers.length})</label>
                {employees.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No AI employees available. You can add members later.</div>
                ) : (
                  <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
                    {employees.map((emp) => (
                      <div
                        key={emp.id}
                        onClick={() => toggleMemberSelection(emp.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                          borderRadius: 6, cursor: 'pointer', marginBottom: 4,
                          background: selectedMembers.includes(emp.id) ? '#f5f3ff' : 'transparent',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedMembers.includes(emp.id)}
                          onChange={() => {}}
                          style={{ cursor: 'pointer' }}
                        />
                        <div className="avatar avatar-sm av-sales">{(emp.name || 'AI').charAt(0)}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{emp.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.role}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Creating Team...' : 'Form AI Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
