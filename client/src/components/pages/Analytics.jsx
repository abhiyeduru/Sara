import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend
} from 'recharts';
import {
  TrendingUp, Users, DollarSign, Phone, Bot, Zap, ArrowUpRight, ArrowDownRight,
  Sparkles, RefreshCw, CheckSquare
} from 'lucide-react';

export default function Analytics({ onNavigate }) {
  const [period, setPeriod] = useState('1M');
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [workforce, setWorkforce] = useState([]);
  const [leadStats, setLeadStats] = useState(null);
  const [callStats, setCallStats] = useState(null);
  const [billing, setBilling] = useState(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [dashRes, wfRes, leadsRes, callsRes, billRes] = await Promise.all([
        fetch('/api/v1/analytics/dashboard'),
        fetch('/api/v1/analytics/workforce'),
        fetch('/api/v1/analytics/leads'),
        fetch('/api/v1/analytics/calls'),
        fetch('/api/v1/billing/balance'),
      ]);

      if (dashRes.ok) setDashboard(await dashRes.json());
      if (wfRes.ok) {
        const d = await wfRes.json();
        setWorkforce(d.data || []);
      }
      if (leadsRes.ok) setLeadStats(await leadsRes.json());
      if (callsRes.ok) setCallStats(await callsRes.json());
      if (billRes.ok) setBilling(await billRes.json());
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const totalCalls = callStats?.total ?? dashboard?.calls?.total ?? 0;
  const totalLeads = leadStats?.total ?? dashboard?.leads?.total ?? 0;
  const conversionRate = dashboard?.leads?.conversion_rate ?? 0;
  const totalEmployees = dashboard?.workforce?.total ?? 0;
  const activeEmployees = dashboard?.workforce?.active ?? 0;
  const tasksCompleted = dashboard?.tasks?.completed ?? 0;
  const totalCost = billing?.total_consumed ?? 0;
  const balance = billing?.balance ?? 0;

  const KPIs = [
    { label: 'Total Leads', value: totalLeads.toString(), change: `${dashboard?.leads?.qualified || 0} qualified`, up: totalLeads > 0, icon: Users, color: '#7c3aed' },
    { label: 'Conversion Rate', value: `${conversionRate}%`, change: 'Funnel win rate', up: conversionRate > 0, icon: TrendingUp, color: '#0284c7' },
    { label: 'Calls Executed', value: totalCalls.toString(), change: `${dashboard?.calls?.active || 0} active`, up: totalCalls > 0, icon: Phone, color: '#ea580c' },
    { label: 'AI Employees', value: totalEmployees.toString(), change: `${activeEmployees} active`, up: true, icon: Bot, color: '#ca8a04' },
    { label: 'Tasks Completed', value: tasksCompleted.toString(), change: `${dashboard?.tasks?.running || 0} running`, up: tasksCompleted > 0, icon: CheckSquare, color: '#16a34a' },
    { label: 'AI & Call Cost', value: `₹${Number(totalCost).toLocaleString('en-IN')}`, change: 'Consumed', up: false, icon: Zap, color: '#64748b' },
    { label: 'Credit Balance', value: `₹${Number(balance).toLocaleString('en-IN')}`, change: 'Available', up: true, icon: DollarSign, color: '#7c3aed' },
  ];

  // Dynamic Funnel data from leadStats
  const funnelData = leadStats?.funnel || [];

  return (
    <div className="page-content animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans' }}>Executive Analytics</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-muted)' }}>Real-time business telemetry and AI workforce performance</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={fetchAnalytics} title="Refresh">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('ask')}>
            <Sparkles size={13} />Ask Sara
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 12, marginBottom: 24 }}>
        {KPIs.map(({ label, value, change, up, icon: Icon, color }) => (
          <div className="kpi-card" key={label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, background: `${color}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Icon size={15} color={color} />
              </div>
              <span className={`kpi-change ${up ? 'up' : 'down'}`}>
                {up ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}{change}
              </span>
            </div>
            <div className="kpi-value" style={{ fontSize: 22 }}>{loading ? '...' : value}</div>
            <div className="kpi-label">{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Lead Funnel Chart */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <div className="section-heading">Lead Pipeline Funnel</div>
            <div className="section-sub">Distribution of active leads across deal stages</div>
          </div>
          {funnelData.length === 0 ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No leads currently in the pipeline.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={funnelData}>
                <defs>
                  <linearGradient id="funnelGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="stage" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="count" stroke="#7c3aed" strokeWidth={2.5} fill="url(#funnelGrad)" name="Leads" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Call Outcomes Breakdown */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <div className="section-heading">Voice Call Telemetry</div>
            <div className="section-sub">Outcomes and statuses from Twilio telephony layer</div>
          </div>
          {(!callStats?.by_outcome || callStats.by_outcome.length === 0) ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No calls initiated yet.
            </div>
          ) : (
            <div style={{ padding: '8px 0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
                <div style={{ background: 'var(--surface-soft)', padding: 14, borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Telephony Calls</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>{totalCalls}</div>
                </div>
                <div style={{ background: 'var(--surface-soft)', padding: 14, borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Active Voice Sessions</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#16a34a', marginTop: 4 }}>{dashboard?.calls?.active || 0}</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {callStats.by_outcome.map((item) => (
                  <div key={item.outcome} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                    <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{item.outcome}</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Employee Performance Table */}
      <div className="table-wrap">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="section-heading">AI Employee Performance</div>
            <div className="section-sub">Actual verified contributions by each autonomous agent</div>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{workforce.length} AI Employees</span>
        </div>

        {workforce.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No AI employees found. Create an employee to view performance metrics.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Status</th>
                <th>Calls Handled</th>
                <th>Tasks Completed</th>
                <th>Task Completion %</th>
                <th>Performance Score</th>
              </tr>
            </thead>
            <tbody>
              {workforce.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="avatar avatar-sm av-sales">{(e.name || 'AI').charAt(0)}</div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{e.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.role}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{e.department || 'General'}</td>
                  <td>
                    <span className={`badge ${e.status === 'active' ? 'badge-active' : 'badge-paused'}`}>
                      {e.status}
                    </span>
                  </td>
                  <td><span style={{ fontWeight: 700 }}>{e.total_calls || 0}</span></td>
                  <td><span style={{ fontWeight: 700 }}>{e.completed_tasks || 0} / {e.total_tasks || 0}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div className="progress-bar" style={{ width: 60 }}>
                        <div className="progress-fill" style={{ width: `${e.task_completion_rate || 0}%` }} />
                      </div>
                      <span style={{ fontWeight: 700, fontSize: 12 }}>{e.task_completion_rate || 0}%</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div className="progress-bar" style={{ width: 80 }}>
                        <div className="progress-fill" style={{ width: `${e.performance_score || 90}%` }} />
                      </div>
                      <span style={{ fontWeight: 700, fontSize: 12, color: '#7c3aed' }}>{e.performance_score || 90}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
