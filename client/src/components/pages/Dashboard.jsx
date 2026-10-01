import React, { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, Bot, Phone, Users, CheckSquare, Star, DollarSign, Zap,
  ArrowRight, AlertCircle, Clock, ChevronRight, Play, PlusCircle, Sparkles, RefreshCw, Mic
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

export default function Dashboard({ onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [dashData, setDashData] = useState(null);
  const [balance, setBalance] = useState('1,000');
  const [chartData, setChartData] = useState([]);

  const fetchDashboardData = async () => {
    try {
      const [analyticsRes, billingRes] = await Promise.all([
        fetch('/api/v1/analytics/dashboard'),
        fetch('/api/v1/billing/balance'),
      ]);

      if (analyticsRes.ok) {
        const d = await analyticsRes.json();
        setDashData(d);

        // Build 24h activity chart based on real task/call activity or recent activity
        const recent = d.recent_activity || [];
        const hourlyBuckets = { '9am': 0, '11am': 0, '1pm': 0, '3pm': 0, '5pm': 0, '7pm': 0 };
        recent.forEach((act) => {
          if (act.created_at) {
            const h = new Date(act.created_at).getHours();
            if (h < 10) hourlyBuckets['9am']++;
            else if (h < 12) hourlyBuckets['11am']++;
            else if (h < 14) hourlyBuckets['1pm']++;
            else if (h < 16) hourlyBuckets['3pm']++;
            else if (h < 18) hourlyBuckets['5pm']++;
            else hourlyBuckets['7pm']++;
          }
        });
        const chartPoints = Object.entries(hourlyBuckets).map(([t, v]) => ({ t, v }));
        setChartData(chartPoints);
      }

      if (billingRes.ok) {
        const b = await billingRes.json();
        setBalance(Number(b.balance || 0).toLocaleString());
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const workforce = dashData?.workforce || { total: 0, active: 0, paused: 0 };
  const tasks = dashData?.tasks || { total: 0, running: 0, completed: 0, completion_rate: 0 };
  const leads = dashData?.leads || { total: 0, qualified: 0, conversion_rate: 0 };
  const calls = dashData?.calls || { total: 0, active: 0 };
  const pendingApprovals = dashData?.approvals?.pending || 0;
  const recentActivity = dashData?.recent_activity || [];
  const topEmployees = dashData?.top_employees || [];

  const kpis = [
    { label: 'AI Employees', value: workforce.total.toString(), change: `${workforce.active} active`, up: true, icon: Bot, color: '#7c3aed', bg: '#f5f3ff' },
    { label: 'Total Calls', value: calls.total.toString(), change: `${calls.active} live`, up: calls.total > 0, icon: Phone, color: '#0284c7', bg: '#eff6ff' },
    { label: 'Total Leads', value: leads.total.toString(), change: `${leads.qualified} qualified`, up: leads.total > 0, icon: Users, color: '#16a34a', bg: '#f0fdf4' },
    { label: 'Tasks Done', value: tasks.completed.toString(), change: `${tasks.running} running`, up: tasks.completed > 0, icon: CheckSquare, color: '#ea580c', bg: '#fff7ed' },
    { label: 'Conversion', value: `${leads.conversion_rate}%`, change: 'Rate', up: leads.conversion_rate > 0, icon: Star, color: '#ca8a04', bg: '#fefce8' },
    { label: 'Credits Left', value: `₹${balance}`, change: 'Available', up: true, icon: DollarSign, color: '#7c3aed', bg: '#f5f3ff' },
    { label: 'Approvals', value: pendingApprovals.toString(), change: pendingApprovals > 0 ? 'Pending' : 'All clear', up: pendingApprovals === 0, icon: Zap, color: '#64748b', bg: '#f8fafc' },
  ];

  const attentionItems = [];
  if (pendingApprovals > 0) {
    attentionItems.push({
      type: 'warning',
      text: `${pendingApprovals} pending approval${pendingApprovals > 1 ? 's' : ''} require human sign-off`,
      icon: AlertCircle,
      page: 'approvals'
    });
  }
  if (workforce.total === 0) {
    attentionItems.push({
      type: 'info',
      text: 'No AI employees created yet. Build your first digital worker.',
      icon: Bot,
      page: 'employees/new'
    });
  }
  if (leads.total === 0) {
    attentionItems.push({
      type: 'info',
      text: 'No leads registered in CRM. Add new leads or start outreach.',
      icon: Users,
      page: 'leads'
    });
  }

  return (
    <div className="page-content animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontFamily: 'Plus Jakarta Sans' }}>
            Good day, Abhi 👋
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Live status of your autonomous AI workforce.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-primary"
            onClick={() => onNavigate('talk-sara')}
            style={{
              background: 'linear-gradient(135deg, #10b981, #059669)',
              border: 'none',
              boxShadow: '0 2px 10px rgba(16, 185, 129, 0.35)',
              gap: 8,
              fontWeight: 700
            }}
            title="Open Instant Voice Assistant"
          >
            <Mic size={15} />
            Talk with Sara
          </button>
          <button className="btn btn-secondary" onClick={() => fetchDashboardData()} title="Refresh live stats">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button className="btn btn-secondary" onClick={() => onNavigate('ask')}>
            <Sparkles size={14} />
            Ask Sara
          </button>
          <button className="btn btn-secondary" onClick={() => onNavigate('employees/new')}>
            <PlusCircle size={14} />
            Create AI Employee
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 12, marginBottom: 24 }}>
        {kpis.map(({ label, value, change, up, icon: Icon, color, bg }) => (
          <div className="kpi-card" key={label}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={16} color={color} />
              </div>
              <span className={`kpi-change ${up ? 'up' : 'down'}`}>
                {up ? <TrendingUp size={9} style={{ marginRight: 2, display: 'inline' }} /> : <TrendingDown size={9} style={{ marginRight: 2, display: 'inline' }} />}
                {change}
              </span>
            </div>
            <div className="kpi-value">{loading ? '...' : value}</div>
            <div className="kpi-label">{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, marginBottom: 20 }}>
        {/* Activity Chart & Live Feed */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div className="section-heading">AI Workforce Activity</div>
              <div className="section-sub">Real-time actions executed by AI employees</div>
            </div>
            <span className="badge badge-active"><span className="live-dot" style={{ width: 6, height: 6 }} />Live</span>
          </div>
          
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={chartData.length > 0 ? chartData : [{ t: '9am', v: 0 }, { t: '12pm', v: 0 }, { t: '3pm', v: 0 }, { t: '6pm', v: 0 }]}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="v" stroke="#7c3aed" strokeWidth={2} fill="url(#grad)" />
            </AreaChart>
          </ResponsiveContainer>

          {/* Timeline */}
          <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            {recentActivity.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                <Clock size={24} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                <div style={{ fontSize: 13, fontWeight: 600 }}>No activity events logged yet</div>
                <div style={{ fontSize: 12 }}>Run a voice call, assign a task, or trigger a workflow to see live audit logs.</div>
              </div>
            ) : (
              recentActivity.slice(0, 5).map((act, i) => (
                <div key={act.id || i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: '#7c3aed15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Bot size={13} color="#7c3aed" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                      <strong>{act.actor_name || 'Sara AI'}</strong> {act.action}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {act.created_at ? new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Needs Attention */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <AlertCircle size={15} color="#ea580c" />
              <span className="section-heading" style={{ fontSize: 14 }}>Needs Attention</span>
              {attentionItems.length > 0 && (
                <span className="badge badge-warning" style={{ marginLeft: 'auto' }}>{attentionItems.length}</span>
              )}
            </div>

            {attentionItems.length === 0 ? (
              <div style={{ padding: '12px 10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 12, color: '#166534', display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckSquare size={14} color="#16a34a" />
                All systems healthy. No action items required.
              </div>
            ) : (
              attentionItems.map((a, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
                  borderRadius: 8, marginBottom: 6, cursor: 'pointer', transition: 'background 0.15s',
                  background: a.type === 'error' ? '#fff5f5' : a.type === 'warning' ? '#fffbeb' : '#f0f9ff',
                  border: `1px solid ${a.type === 'error' ? '#fecaca' : a.type === 'warning' ? '#fde68a' : '#bae6fd'}`
                }}
                  onClick={() => onNavigate(a.page)}
                >
                  <a.icon size={13} color={a.type === 'error' ? '#dc2626' : a.type === 'warning' ? '#ca8a04' : '#0284c7'} />
                  <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1 }}>{a.text}</span>
                  <ChevronRight size={12} color="var(--text-muted)" />
                </div>
              ))
            )}
          </div>

          {/* Quick Actions */}
          <div className="card" style={{ padding: 16 }}>
            <div className="section-heading" style={{ fontSize: 14, marginBottom: 12 }}>Quick Actions</div>
            {[
              { label: 'Make outbound call', icon: Phone, page: 'calls' },
              { label: 'View new leads', icon: Users, page: 'leads' },
              { label: 'Create workflow', icon: ArrowRight, page: 'workflows' },
              { label: 'Review approvals', icon: CheckSquare, page: 'approvals' },
              { label: 'Manage phone lines', icon: Phone, page: 'phone-numbers' },
            ].map(({ label, icon: Icon, page }) => (
              <button key={label} className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 6, fontSize: 13 }}
                onClick={() => onNavigate(page)}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active AI Employees */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div className="section-heading">Active AI Employees</div>
            <div className="section-sub">Autonomous workforce overview</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('employees')}>
            View all ({workforce.total}) <ChevronRight size={13} />
          </button>
        </div>

        {topEmployees.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 20px', border: '1px dashed var(--border)', borderRadius: 12 }}>
            <Bot size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px', opacity: 0.6 }} />
            <h4 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>No AI Employees Found</h4>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)', maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
              Create an AI employee to handle outbound sales, customer inquiries, or operations.
            </p>
            <button className="btn btn-primary" onClick={() => onNavigate('employees/new')}>
              <PlusCircle size={14} />
              Create AI Employee
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {topEmployees.map((e) => (
              <div key={e.id} className="card" style={{ padding: 16, cursor: 'pointer' }}
                onClick={() => onNavigate('employees')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div className="avatar avatar-md av-sales">
                    {(e.name || 'AI').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {e.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {e.role}
                    </div>
                  </div>
                  <span className={`badge ${e.status === 'active' ? 'badge-active' : 'badge-paused'}`} style={{ marginLeft: 'auto', fontSize: 10 }}>
                    {e.status}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <div style={{ background: 'var(--surface-soft)', borderRadius: 6, padding: '6px 8px' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{e.total_tasks || 0}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Tasks</div>
                  </div>
                  <div style={{ background: 'var(--surface-soft)', borderRadius: 6, padding: '6px 8px' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{e.total_calls || 0}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Calls</div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Performance</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed' }}>{e.performance_score || 90}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${e.performance_score || 90}%` }} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                  <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={(ev) => { ev.stopPropagation(); onNavigate('employees'); }}>
                    <Play size={11} />Manage
                  </button>
                  <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={(ev) => { ev.stopPropagation(); onNavigate('calls'); }}>
                    <Phone size={11} />Call
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
