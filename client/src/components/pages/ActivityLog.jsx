import React, { useState, useEffect } from 'react';
import {
  Activity, Shield, User, Bot, Clock, Filter, RefreshCw, CheckCircle2,
  AlertCircle, ArrowRight, Download, Search
} from 'lucide-react';

export default function ActivityLog({ onNavigate }) {
  const [activeTab, setActiveTab] = useState('activity'); // activity | audit
  const [activities, setActivities] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actorFilter, setActorFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'activity') {
        const url = actorFilter === 'all' ? '/api/v1/activity' : `/api/v1/activity?actor_type=${actorFilter}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setActivities(data.data || []);
        }
      } else {
        const res = await fetch('/api/v1/activity/audit');
        if (res.ok) {
          const data = await res.json();
          setAuditLogs(data.data || []);
        }
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab, actorFilter]);

  const items = activeTab === 'activity' ? activities : auditLogs;
  const filteredItems = items.filter((item) => {
    const text = `${item.action || ''} ${item.actor_name || ''} ${item.entity_type || ''}`.toLowerCase();
    return !searchQuery || text.includes(searchQuery.toLowerCase());
  });

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Activity size={26} color="var(--primary)" />
            Activity Log & Audit Trail
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
            Immutable chronological record of every decision, action, workflow trigger, and call made by your AI employees.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={fetchData}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 13 }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        <button
          onClick={() => setActiveTab('activity')}
          style={{
            padding: '10px 16px',
            fontSize: 14,
            fontWeight: 600,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'activity' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'activity' ? 'var(--primary)' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Activity size={16} /> Operational Activity
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          style={{
            padding: '10px 16px',
            fontSize: 14,
            fontWeight: 600,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'audit' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'audit' ? 'var(--primary)' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Shield size={16} /> Security & Governance Audit
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        {activeTab === 'activity' && (
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { id: 'all', label: 'All Actors' },
              { id: 'ai_employee', label: 'AI Employees Only' },
              { id: 'user', label: 'Humans Only' },
              { id: 'system', label: 'System Workflows' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setActorFilter(f.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: '1px solid',
                  borderColor: actorFilter === f.id ? 'var(--primary)' : 'var(--border)',
                  background: actorFilter === f.id ? 'rgba(124,58,237,0.1)' : 'transparent',
                  color: actorFilter === f.id ? 'var(--primary)' : 'var(--text-muted)',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
        <div style={{ position: 'relative', width: 280 }}>
          <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 10 }} />
          <input
            type="text"
            placeholder="Search events by action, entity..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 34px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              fontSize: 13,
            }}
          />
        </div>
      </div>

      {/* Timeline / Table Card */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} className="spin" style={{ marginBottom: 10 }} />
            <div>Loading activity history...</div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <Activity size={40} color="var(--text-muted)" style={{ marginBottom: 12, opacity: 0.5 }} />
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>No Records Found</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Events are automatically recorded as your AI employees perform voice calls, execute tasks, and trigger workflows.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredItems.map((item, idx) => (
              <div
                key={item.id || idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '16px 20px',
                  borderBottom: idx !== filteredItems.length - 1 ? '1px solid var(--border)' : 'none',
                  gap: 16,
                  transition: 'background 0.15s ease',
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: item.actor_type === 'ai_employee' ? 'rgba(124,58,237,0.1)' : '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {item.actor_type === 'ai_employee' ? (
                    <Bot size={18} color="var(--primary)" />
                  ) : item.actor_type === 'system' ? (
                    <Clock size={18} color="#64748b" />
                  ) : (
                    <User size={18} color="#0284c7" />
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>
                      {item.actor_name || (item.actor_type === 'ai_employee' ? 'AI Employee' : 'User')}
                    </span>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 10,
                      fontSize: 11,
                      fontWeight: 500,
                      background: item.actor_type === 'ai_employee' ? 'rgba(124,58,237,0.08)' : '#f1f5f9',
                      color: item.actor_type === 'ai_employee' ? 'var(--primary)' : 'var(--text-muted)'
                    }}>
                      {item.actor_type}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary, #475569)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{item.action}</span>
                    {item.entity_type && (
                      <span style={{ color: 'var(--text-muted)' }}>
                        on <strong style={{ color: 'var(--text-primary)' }}>{item.entity_type}</strong>
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                    <Clock size={13} />
                    {item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
