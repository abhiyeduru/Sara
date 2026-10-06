import React, { useState, useEffect } from 'react';
import { GitBranch, Plus, Play, Pause, MoreHorizontal, ArrowDown, ArrowRight,
  CheckCircle2, XCircle, Clock, Zap, Bot, MessageCircle, Database, Bell, RefreshCw } from 'lucide-react';
import SkeletonLoader from '../common/SkeletonLoader';

export default function Workflows({ onNavigate }) {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newTrigger, setNewTrigger] = useState('lead_created');
  const [creating, setCreating] = useState(false);

  const fetchWorkflows = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/workflows');
      if (res.ok) {
        const data = await res.json();
        setWorkflows(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching workflows:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const handleCreateWorkflow = async (e) => {
    e.preventDefault();
    if (!newName) return;
    setCreating(true);
    try {
      const res = await fetch('/api/v1/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          description: newDesc,
          trigger: newTrigger,
        }),
      });
      if (res.ok) {
        setShowModal(false);
        setNewName('');
        setNewDesc('');
        fetchWorkflows();
      }
    } catch (err) {
      console.error('Error creating workflow:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (wf) => {
    const nextStatus = wf.status === 'active' ? 'paused' : 'active';
    try {
      await fetch(`/api/v1/workflows/${wf.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      fetchWorkflows();
    } catch (err) {
      console.error('Error updating workflow:', err);
    }
  };

  return (
    <div className="page-content animate-fade-in">
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:'var(--text-primary)', fontFamily:'Plus Jakarta Sans' }}>Workflows</h1>
          <p style={{ margin:'4px 0 0', fontSize:14, color:'var(--text-muted)' }}>
            {workflows.filter(w=>w.status==='active').length} active · {workflows.length} total autonomous workflows
          </p>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button className="btn btn-secondary" onClick={fetchWorkflows}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={14} /> New Workflow
          </button>
        </div>
      </div>

      {/* Grid */}
      {loading && workflows.length === 0 ? (
        <SkeletonLoader type="cards" count={4} />
      ) : workflows.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><GitBranch size={28} color="#94a3b8" /></div>
          <div style={{ fontWeight:700, fontSize:16, color:'var(--text-primary)', marginBottom:6 }}>No Workflows Created</div>
          <p style={{ color:'var(--text-muted)', fontSize:14, marginBottom:16 }}>
            Set up automatic business triggers to run AI calls, messages, and CRM updates without manual work.
          </p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={14} /> Create First Workflow
          </button>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(360px, 1fr))', gap:16 }}>
          {workflows.map(w => (
            <div key={w.id} className="card" style={{ padding:20, display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
              <div>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:34, height:34, borderRadius:8, background:'rgba(124,58,237,0.1)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <Zap size={16} color="var(--primary)" />
                    </div>
                    <div>
                      <div style={{ fontWeight:700, fontSize:15, color:'var(--text-primary)' }}>{w.name}</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)' }}>Trigger: {w.trigger}</div>
                    </div>
                  </div>
                  <span style={{
                    padding:'2px 8px', borderRadius:10, fontSize:11, fontWeight:600,
                    background: w.status === 'active' ? '#ecfdf5' : '#f1f5f9',
                    color: w.status === 'active' ? '#059669' : '#64748b'
                  }}>
                    {w.status}
                  </span>
                </div>

                <p style={{ fontSize:13, color:'var(--text-secondary)', lineHeight:1.5, marginBottom:14 }}>
                  {w.description || 'Executes autonomous steps on business event triggers.'}
                </p>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, padding:'10px 14px', borderRadius:8, background:'var(--bg-secondary, #f8fafc)', marginBottom:16 }}>
                  <div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>Total Executions</div>
                    <div style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)', marginTop:2 }}>{w.total_runs || 0}</div>
                  </div>
                  <div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>Success Rate</div>
                    <div style={{ fontSize:16, fontWeight:700, color:'#10b981', marginTop:2 }}>
                      {w.total_runs > 0 ? `${Math.round((w.success_runs / w.total_runs) * 100)}%` : '100%'}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display:'flex', gap:8, borderTop:'1px solid var(--border)', paddingTop:14 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ flex:1, justifyContent:'center' }}
                  onClick={() => handleToggleStatus(w)}
                >
                  {w.status === 'active' ? <Pause size={12} /> : <Play size={12} />}
                  {w.status === 'active' ? 'Pause' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, padding: 24, borderRadius: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>
              Create Autonomous Workflow
            </h2>
            <form onSubmit={handleCreateWorkflow}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Workflow Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Inbound Lead Fast Response SLA"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 14 }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Trigger Event
                </label>
                <select
                  value={newTrigger}
                  onChange={e => setNewTrigger(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 14 }}
                >
                  <option value="lead_created">New Lead Created / Webhook Received</option>
                  <option value="call_ended">Call Ended with Positive Sentiment</option>
                  <option value="task_completed">AI Task Completed</option>
                  <option value="schedule_cron">Scheduled Cron Routine</option>
                </select>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Description & Goal
                </label>
                <textarea
                  rows={3}
                  placeholder="Explain what action sequence this workflow triggers..."
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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
                  {creating ? 'Saving...' : 'Create Workflow'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
