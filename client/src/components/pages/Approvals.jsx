import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, CheckCircle2, XCircle, Eye, AlertTriangle, Clock,
  Bot, DollarSign, MessageCircle, Megaphone, RefreshCw, Plus
} from 'lucide-react';

const TYPE_ICONS = {
  campaign: Megaphone,
  financial: DollarSign,
  api: Bot,
  content: MessageCircle,
};

export default function Approvals({ onNavigate }) {
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  const fetchApprovals = async () => {
    setLoading(true);
    try {
      const [pendingRes, allRes] = await Promise.all([
        fetch('/api/v1/approvals/pending'),
        fetch('/api/v1/approvals?limit=50'),
      ]);

      if (pendingRes.ok) {
        const pData = await pendingRes.json();
        setPending(pData.data || []);
      }

      if (allRes.ok) {
        const aData = await allRes.json();
        const allItems = aData.data || [];
        const decided = allItems.filter(i => i.status === 'approved' || i.status === 'rejected');
        setHistory(decided);
      }
    } catch (err) {
      console.error('Error fetching approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, []);

  const handleDecision = async (id, decision) => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/v1/approvals/${id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, note: `Decision made via Sara Approval Center: ${decision}` }),
      });
      if (res.ok) {
        await fetchApprovals();
      }
    } catch (err) {
      console.error(`Error deciding approval ${id}:`, err);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="page-content animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: '#f5f3ff', border: '1px solid #ddd6fe',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <ShieldCheck size={22} color="#7c3aed" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans' }}>Approval Center</h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>Review and authorize high-impact AI actions before autonomous execution</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn btn-secondary" onClick={fetchApprovals} title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          {pending.length > 0 && (
            <span className="badge badge-warning" style={{ fontSize: 13, padding: '6px 14px' }}>
              {pending.length} pending
            </span>
          )}
        </div>
      </div>

      {/* Pending Approvals */}
      <div style={{ marginBottom: 32 }}>
        <div className="section-heading" style={{ marginBottom: 16 }}>Pending Approval</div>

        {pending.length === 0 ? (
          <div className="empty-state" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '36px 20px', textAlign: 'center' }}>
            <div className="empty-icon" style={{ display: 'inline-flex', padding: 12, borderRadius: '50%', background: '#f0fdf4', marginBottom: 12 }}>
              <CheckCircle2 size={32} color="#16a34a" />
            </div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 4 }}>All clear!</div>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
              No pending approval requests. Your AI employees are operating safely within configured risk policies.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pending.map((item) => {
              const Icon = TYPE_ICONS[item.action_type] || Bot;
              const isHigh = item.risk_level === 'high';
              const isMed = item.risk_level === 'medium';
              const borderCol = isHigh ? '#dc2626' : isMed ? '#ea580c' : '#ca8a04';
              const bgCol = isHigh ? '#fee2e2' : isMed ? '#ffedd5' : '#fefce8';

              return (
                <div key={item.id} className="card" style={{
                  padding: 20, borderLeft: `4px solid ${borderCol}`
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                      background: bgCol,
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <Icon size={20} color={borderCol} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <span className="badge" style={{
                          background: bgCol,
                          color: borderCol,
                          fontSize: 10
                        }}>
                          <AlertTriangle size={10} /> {item.risk_level || 'medium'} risk
                        </span>
                        <span className="badge badge-info" style={{ fontSize: 10 }}>{item.action_type || 'action'}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 11, marginLeft: 'auto' }}>
                          <Clock size={11} />
                          {item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                        </div>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                        {item.action_title || item.action}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Requested by <strong>{item.requested_by || 'AI Employee'}</strong>
                      </div>

                      {expanded === item.id && item.action_details && (
                        <div style={{ marginTop: 12, padding: 12, background: 'var(--surface-soft)', borderRadius: 8, border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>PAYLOAD & PARAMETERS</div>
                          {Object.entries(item.action_details).length === 0 ? (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No additional parameters provided.</div>
                          ) : (
                            Object.entries(item.action_details).map(([k, v]) => (
                              <div key={k} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                                <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 90 }}>{k}:</span>
                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{String(v)}</span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setExpanded(expanded === item.id ? null : item.id)}>
                      <Eye size={12} />Review
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ background: '#16a34a' }}
                      disabled={processingId === item.id}
                      onClick={() => handleDecision(item.id, 'approved')}
                    >
                      <CheckCircle2 size={12} />Approve
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      disabled={processingId === item.id}
                      onClick={() => handleDecision(item.id, 'rejected')}
                    >
                      <XCircle size={12} />Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* History */}
      <div>
        <div className="section-heading" style={{ marginBottom: 12 }}>Decision History</div>
        {history.length === 0 ? (
          <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No prior approval decisions recorded.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Requested By</th>
                  <th>Decision</th>
                  <th>Decided At</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{h.action_title || h.action}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className="avatar avatar-sm av-sales">{(h.requested_by || 'AI').charAt(0)}</div>
                        <span style={{ fontSize: 12 }}>{h.requested_by || 'AI'}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${h.status === 'approved' ? 'badge-active' : 'badge-error'}`}>
                        {h.status === 'approved' ? 'Approved' : 'Rejected'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {h.decided_at ? new Date(h.decided_at).toLocaleString() : '—'}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{h.decision_note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
