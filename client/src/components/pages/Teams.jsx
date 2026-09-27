import React, { useState, useEffect } from 'react';
import {
  UsersRound, Plus, Bot, ArrowRight, CheckCircle2, Target, Sparkles,
  GitBranch, ShieldCheck, MoreVertical, Settings, UserPlus, RefreshCw, Trash2, X
} from 'lucide-react';

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
        setTeams(tData.data || []);
      }

      if (empsRes.ok) {
        const eData = await empsRes.json();
        setEmployees(eData.data || []);
      }
    } catch (err) {
      console.error('Error fetching teams:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
    <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <UsersRound size={26} color="var(--primary)" />
            AI Teams
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
            Organize AI employees into multi-agent units that collaborate, delegate tasks to each other, and execute end-to-end business outcomes.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={fetchData} title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Plus size={16} /> Create AI Team
          </button>
        </div>
      </div>

      {/* Grid or Empty State */}
      {teams.length === 0 ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center', borderRadius: 12 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <UsersRound size={28} color="#7c3aed" />
          </div>
          <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>No AI Teams Created Yet</h3>
          <p style={{ margin: '0 auto 20px', fontSize: 13, color: 'var(--text-muted)', maxWidth: 440 }}>
            Group specialized AI employees into collaborative units (e.g. Sales Pod, Support Tier 1) that share context and delegate sub-tasks autonomously.
          </p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={14} /> Create First AI Team
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 20 }}>
          {teams.map((t) => (
            <div key={t.id} className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRadius: 12 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{t.name}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                        background: t.status === 'active' ? '#ecfdf5' : '#f1f5f9',
                        color: t.status === 'active' ? '#059669' : '#64748b'
                      }}>
                        ● {(t.status || 'ACTIVE').toUpperCase()}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Department: <strong style={{ color: 'var(--text-primary)' }}>{t.department || 'General'}</strong>
                      </span>
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(t.id)} title="Delete team">
                    <Trash2 size={15} color="#ef4444" />
                  </button>
                </div>

                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 16 }}>
                  {t.mission || t.description || 'Autonomous collaborative unit.'}
                </p>

                {/* Team Members List */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Bot size={14} color="var(--primary)" /> ASSIGNED AI EMPLOYEES ({t.members_count || 0})
                  </div>
                  {(!t.members || t.members.length === 0) ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No members assigned yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {t.members.map((m) => (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-soft)', padding: '4px 10px', borderRadius: 16 }}>
                          <div className="avatar avatar-sm av-sales" style={{ width: 20, height: 20, fontSize: 10 }}>
                            {(m.name || 'AI').charAt(0)}
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</span>
                          {m.role === 'lead' && (
                            <span style={{ fontSize: 9, background: '#ede9fe', color: '#7c3aed', padding: '1px 5px', borderRadius: 6, fontWeight: 700 }}>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Team Lead: <strong style={{ color: 'var(--text-primary)' }}>{t.leader || 'Sara Lead'}</strong>
                </span>
                <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('tasks')}>
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
