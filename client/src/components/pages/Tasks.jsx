import React, { useState, useEffect } from 'react';
import { CheckSquare, Plus, Filter, Clock, Bot, User, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import SkeletonLoader from '../common/SkeletonLoader';

const TABS = ['All Tasks', 'Pending', 'Running', 'Completed'];
const STATUS_COLORS = { running:'#0284c7', completed:'#16a34a', pending:'#64748b' };

export default function Tasks({ onNavigate }) {
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('All Tasks');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New task form state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [newEmpId, setNewEmpId] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const [tRes, eRes] = await Promise.all([
        fetch('/api/v1/tasks'),
        fetch('/api/v1/employees')
      ]);
      if (tRes.ok) {
        const tData = await tRes.json();
        setTasks(tData.data || []);
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
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTitle) return;
    setCreating(true);
    try {
      const res = await fetch('/api/v1/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          description: newDesc,
          priority: newPriority,
          ai_employee_id: newEmpId || null,
        }),
      });
      if (res.ok) {
        setShowCreateModal(false);
        setNewTitle('');
        setNewDesc('');
        fetchTasks();
      }
    } catch (err) {
      console.error('Error creating task:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateStatus = async (taskId, newStatus) => {
    try {
      await fetch(`/api/v1/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchTasks();
    } catch (err) {
      console.error('Error updating task:', err);
    }
  };

  const filtered = tasks.filter(t => {
    if (tab === 'Pending') return t.status === 'pending';
    if (tab === 'Running') return t.status === 'running' || t.status === 'in_progress';
    if (tab === 'Completed') return t.status === 'completed';
    return true;
  });

  return (
    <div className="page-content animate-fade-in">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px',
            borderRadius: 20, background: 'rgba(124, 58, 237, 0.08)', border: '1px solid rgba(124, 58, 237, 0.18)',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            color: '#7c3aed', marginBottom: 8
          }}>
            <CheckSquare size={12} color="#7c3aed" />
            Execution Engine
          </div>
          <h1 className="page-title">
            Task Center
          </h1>
          <p className="page-subtitle">
            Delegate, track, and monitor real-time task execution across your autonomous AI workforce.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={fetchTasks}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={14} /> New Task
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Tasks', value: tasks.length, color: '#64748b' },
          { label: 'Running / Active', value: tasks.filter(t => t.status === 'running' || t.status === 'in_progress').length, color: '#0284c7' },
          { label: 'Pending Queue', value: tasks.filter(t => t.status === 'pending').length, color: '#ca8a04' },
          { label: 'Completed', value: tasks.filter(t => t.status === 'completed').length, color: '#16a34a' },
        ].map(s => (
          <div key={s.label} className="card-glass" style={{ padding: '16px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color, fontFamily: 'Newsreader, serif' }}>{s.value}</div>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              border: '1px solid',
              borderColor: tab === t ? 'rgba(124,58,237,0.3)' : 'rgba(0,0,0,0.06)',
              background: tab === t ? '#f5f3ff' : 'transparent',
              color: tab === t ? '#7c3aed' : 'var(--text-muted)',
              transition: 'all 0.15s ease'
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Task List */}
      <div className="card-glass" style={{ overflow: 'hidden' }}>
        {loading && tasks.length === 0 ? (
          <SkeletonLoader type="table" count={5} />
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <CheckSquare size={36} color="var(--text-muted)" style={{ marginBottom: 10, opacity: 0.5 }} />
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>No Tasks Found</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
              Create an AI or human task to delegate work across your workforce.
            </p>
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              <Plus size={14} /> Create Task
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filtered.map(t => (
              <div
                key={t.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 20px', borderBottom: '1px solid var(--border)', gap: 14
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{t.title}</span>
                    <span style={{
                      padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, textTransform: 'capitalize',
                      background: t.priority === 'urgent' || t.priority === 'high' ? '#fee2e2' : '#f1f5f9',
                      color: t.priority === 'urgent' || t.priority === 'high' ? '#dc2626' : '#475569'
                    }}>
                      {t.priority}
                    </span>
                  </div>
                  {t.description && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>{t.description}</div>
                  )}
                </div>

                <div style={{ display:'flex', alignItems:'center', gap: 14 }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 500,
                    background: STATUS_COLORS[t.status] ? `${STATUS_COLORS[t.status]}15` : '#f1f5f9',
                    color: STATUS_COLORS[t.status] || '#475569'
                  }}>
                    {t.status}
                  </span>

                  {t.status !== 'completed' && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleUpdateStatus(t.id, 'completed')}
                    >
                      <CheckCircle2 size={13} color="#16a34a" /> Complete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Task Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, padding: 24, borderRadius: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>
              Create New Task
            </h2>
            <form onSubmit={handleCreateTask}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Task Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Follow up on Q4 lead responses"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 14 }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Description / Instructions
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide context, required actions, or outcome criteria..."
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }}
                />
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 12, marginBottom: 18 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                    Assignee
                  </label>
                  <select
                    value={newEmpId}
                    onChange={e => setNewEmpId(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }}
                  >
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                    Priority
                  </label>
                  <select
                    value={newPriority}
                    onChange={e => setNewPriority(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
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
                  {creating ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
