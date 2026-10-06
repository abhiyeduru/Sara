import React, { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, Bot, Phone, Users, CheckSquare, Star, Zap,
  ArrowRight, AlertCircle, Clock, ChevronRight, Play, PlusCircle, Sparkles, RefreshCw, Mic, IndianRupee
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import SkeletonLoader from '../common/SkeletonLoader';

export default function Dashboard({ onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [dashData, setDashData] = useState(null);
  const [balance, setBalance] = useState('1,000');
  const [rawBalance, setRawBalance] = useState(1000);
  const [chartData, setChartData] = useState([]);
  const [callLimits, setCallLimits] = useState({ call_limit_minutes: 10, rate_per_minute: 6.0, min_limit_minutes: 5, max_limit_minutes: 10 });
  const [updatingLimit, setUpdatingLimit] = useState(false);
  const [limitNotice, setLimitNotice] = useState('');

  const fetchDashboardData = async () => {
    try {
      const [analyticsRes, billingRes, limitsRes] = await Promise.all([
        fetch('/api/v1/analytics/dashboard'),
        fetch('/api/v1/billing/balance'),
        fetch('/api/v1/billing/limits'),
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
        const balNum = Number(b.balance || 0);
        setRawBalance(balNum);
        setBalance(balNum.toLocaleString('en-IN'));
      }

      if (limitsRes.ok) {
        const lim = await limitsRes.json();
        setCallLimits(lim);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateLimit = async (newMins) => {
    setUpdatingLimit(true);
    try {
      const res = await fetch('/api/v1/billing/limits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes: Number(newMins) }),
      });
      if (res.ok) {
        const data = await res.json();
        setCallLimits(prev => ({ ...prev, call_limit_minutes: data.call_limit_minutes }));
        setLimitNotice(`Call limit set to ${data.call_limit_minutes} minutes!`);
        setTimeout(() => setLimitNotice(''), 3500);
      }
    } catch (err) {
      console.error('Failed to update call limit:', err);
    } finally {
      setUpdatingLimit(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    const start = Date.now();
    await fetchDashboardData();
    const elapsed = Date.now() - start;
    if (elapsed < 350) {
      await new Promise(r => setTimeout(r, 350 - elapsed));
    }
  };

  const workforce = dashData?.workforce || { total: 0, active: 0, paused: 0 };
  const tasks = dashData?.tasks || { total: 0, running: 0, completed: 0, completion_rate: 0 };
  const leads = dashData?.leads || { total: 0, qualified: 0, conversion_rate: 0 };
  const calls = dashData?.calls || { total: 0, active: 0 };
  const pendingApprovals = dashData?.approvals?.pending || 0;
  const recentActivity = dashData?.recent_activity || [];
  const topEmployees = dashData?.top_employees || [];

  const kpis = [
    {
      label: 'AI Employees',
      value: workforce.total.toString(),
      badge: workforce.active > 0 ? `${workforce.active} active` : '0 active',
      icon: Bot,
      color: '#2563eb',
      bg: '#eff6ff',
      badgeColor: workforce.active > 0 ? '#059669' : '#64748b',
      badgeBg: workforce.active > 0 ? '#ecfdf5' : '#f1f5f9'
    },
    {
      label: 'Total Calls',
      value: calls.total.toString(),
      badge: calls.active > 0 ? `${calls.active} live` : '0 live',
      icon: Phone,
      color: '#0284c7',
      bg: '#eff6ff',
      badgeColor: calls.active > 0 ? '#059669' : '#64748b',
      badgeBg: calls.active > 0 ? '#ecfdf5' : '#f1f5f9'
    },
    {
      label: 'Total Leads',
      value: leads.total.toString(),
      badge: leads.qualified > 0 ? `${leads.qualified} qualified` : '0 qualified',
      icon: Users,
      color: '#10b981',
      bg: '#ecfdf5',
      badgeColor: leads.qualified > 0 ? '#059669' : '#64748b',
      badgeBg: leads.qualified > 0 ? '#ecfdf5' : '#f1f5f9'
    },
    {
      label: 'Tasks Done',
      value: tasks.completed.toString(),
      badge: tasks.running > 0 ? `${tasks.running} running` : '0 running',
      icon: CheckSquare,
      color: '#6366f1',
      bg: '#eef2ff',
      badgeColor: tasks.running > 0 ? '#2563eb' : '#64748b',
      badgeBg: tasks.running > 0 ? '#eff6ff' : '#f1f5f9'
    },
    {
      label: 'Conversion',
      value: `${leads.conversion_rate || 0}%`,
      badge: 'Avg Rate',
      icon: TrendingUp,
      color: '#d97706',
      bg: '#fffbeb',
      badgeColor: '#b45309',
      badgeBg: '#fef3c7'
    },
    {
      label: 'Credits Left',
      value: `₹${balance}`,
      badge: 'Available',
      icon: IndianRupee,
      color: '#059669',
      bg: '#ecfdf5',
      badgeColor: '#059669',
      badgeBg: '#ecfdf5'
    },
    {
      label: 'Approvals',
      value: pendingApprovals.toString(),
      badge: pendingApprovals > 0 ? `${pendingApprovals} pending` : 'All clear',
      icon: Zap,
      color: '#64748b',
      bg: '#f8fafc',
      badgeColor: pendingApprovals > 0 ? '#ea580c' : '#059669',
      badgeBg: pendingApprovals > 0 ? '#fff7ed' : '#ecfdf5'
    },
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

  if (loading) {
    return (
      <div className="page-content animate-fade-in">
        <SkeletonLoader type="dashboard" />
      </div>
    );
  }

  return (
    <div className="page-content animate-fade-in">
      {/* Modern Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
              margin: 0,
              color: 'var(--text-primary)',
            }}
          >
            Good day, Abhi
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: '4px 0 0', lineHeight: 1.45 }}>
            Live status of your autonomous AI workforce, real-time calling telemetry, and operations.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => onNavigate('talk-sara')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px',
              borderRadius: 8, border: 'none', cursor: 'pointer',
              background: '#10b981',
              color: '#ffffff', fontWeight: 600, fontSize: 13,
              boxShadow: '0 1px 3px rgba(16, 185, 129, 0.3)',
              transition: 'all 0.15s ease'
            }}
            title="Open Instant Voice Assistant"
          >
            <Mic size={14} />
            Talk with Sara
          </button>
          <button className="btn btn-secondary" onClick={handleRefresh} title="Refresh live stats">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button className="btn btn-secondary" onClick={() => onNavigate('ask')}>
            <Sparkles size={13} color="#2563eb" />
            Ask Sara
          </button>
          <button className="btn btn-primary" onClick={() => onNavigate('employees/new')}>
            <PlusCircle size={14} />
            Create AI Employee
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        {kpis.map(({ label, value, badge, icon: Icon, color, bg, badgeColor, badgeBg }) => (
          <div
            className="kpi-card"
            key={label}
            style={{
              padding: '16px 14px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: '#FFFFFF',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={15} color={color} />
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 12,
                background: badgeBg, color: badgeColor, display: 'inline-flex', alignItems: 'center', gap: 4,
                border: `1px solid ${badgeBg}`
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: badgeColor }} />
                {badge}
              </span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', lineHeight: 1.1, marginBottom: 4, letterSpacing: '-0.02em' }}>
              {value}
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#64748b' }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Call Duration Limits & Telephony Billing Card */}
      <div
        className="card"
        style={{
          padding: '22px 24px',
          marginBottom: 24,
          background: '#ffffff',
          border: '1px solid var(--border)',
          borderRadius: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: '#eff6ff', color: '#2563eb',
              border: '1px solid #dbeafe',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Phone size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 16,
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                    color: '#0f172a'
                  }}
                >
                  Call Duration Limits & Telephony Billing
                </h3>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12,
                  background: '#ecfdf5', color: '#059669', border: '1px solid #d1fae5'
                }}>
                  ₹{callLimits.rate_per_minute || 6}/min Direct Deduct
                </span>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#64748b' }}>
                Configurable 5 to 10 minute call cap. Direct wallet deduction of ₹6/min with 30s auto-warning.
              </p>
            </div>
          </div>

          {limitNotice && (
            <div style={{ padding: '4px 12px', borderRadius: 14, background: '#ecfdf5', border: '1px solid #d1fae5', color: '#059669', fontSize: 12, fontWeight: 600 }}>
              ✓ {limitNotice}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, alignItems: 'center' }}>
          {/* Minutes Available from Wallet */}
          <div style={{ display: 'flex', gap: 14, background: '#f8fafc', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Available Call Time
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                {Math.floor(rawBalance / (callLimits.rate_per_minute || 6.0))} <span style={{ fontSize: 13, fontWeight: 500, color: '#64748b' }}>mins</span>
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                Balance: ₹{balance} (min ₹6 required to place a call)
              </div>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              style={{ alignSelf: 'center' }}
              onClick={() => onNavigate('billing')}
            >
              Top Up
            </button>
          </div>

          {/* 5-10 Min Limit Selector */}
          <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Max Call Duration Limit
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#2563eb' }}>
                Current: {callLimits.call_limit_minutes} min {updatingLimit && '(Saving...)'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[5, 6, 7, 8, 9, 10].map((m) => {
                const isActive = callLimits.call_limit_minutes === m;
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={updatingLimit}
                    onClick={() => handleUpdateLimit(m)}
                    style={{
                      flex: 1,
                      minWidth: 40,
                      padding: '6px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      border: isActive ? '1px solid #2563eb' : '1px solid var(--border)',
                      background: isActive ? '#2563eb' : '#ffffff',
                      color: isActive ? '#ffffff' : '#475569',
                    }}
                  >
                    {m}m
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, marginBottom: 24 }}>
        {/* Activity Chart & Live Feed */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                AI Workforce Activity
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                Real-time actions executed by AI employees
              </div>
            </div>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px',
              borderRadius: 12, background: '#ecfdf5', color: '#059669',
              border: '1px solid #d1fae5', fontSize: 11, fontWeight: 600
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
              Live
            </span>
          </div>
          
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={chartData.length > 0 ? chartData : [{ t: '9am', v: 0 }, { t: '12pm', v: 0 }, { t: '3pm', v: 0 }, { t: '6pm', v: 0 }]}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)' }} />
              <Area type="monotone" dataKey="v" stroke="#2563eb" strokeWidth={2} fill="url(#grad)" />
            </AreaChart>
          </ResponsiveContainer>

          {/* Timeline */}
          <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            {recentActivity.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#64748b' }}>
                <Clock size={20} style={{ margin: '0 auto 6px', opacity: 0.5 }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>No activity events logged yet</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Run a voice call, assign a task, or trigger a workflow to see live audit logs.</div>
              </div>
            ) : (
              recentActivity.slice(0, 5).map((act, i) => (
                <div key={act.id || i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: '#eff6ff', border: '1px solid #dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Bot size={13} color="#2563eb" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, color: '#0f172a' }}>
                      <strong>{act.actor_name || 'Sara AI'}</strong> {act.action}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
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
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <AlertCircle size={15} color="#ea580c" />
                <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Needs Attention</span>
              </div>
              {attentionItems.length > 0 && (
                <span style={{
                  background: '#fff7ed', color: '#ea580c', border: '1px solid #ffedd5',
                  borderRadius: 12, padding: '1px 7px', fontSize: 11, fontWeight: 600
                }}>
                  {attentionItems.length}
                </span>
              )}
            </div>

            {attentionItems.length === 0 ? (
              <div style={{ padding: '10px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 12, color: '#166534', display: 'flex', alignItems: 'center', gap: 7 }}>
                <CheckSquare size={14} color="#16a34a" />
                All systems healthy. No action items required.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {attentionItems.map((a, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                    borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s ease',
                    background: '#f8fafc', border: '1px solid var(--border)'
                  }}
                    onClick={() => onNavigate(a.page)}
                    onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                    onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
                  >
                    <div style={{ width: 26, height: 26, borderRadius: 6, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <a.icon size={13} color="#2563eb" />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#1e293b', flex: 1, lineHeight: 1.35 }}>{a.text}</span>
                    <ChevronRight size={13} color="#94a3b8" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>
              Quick Actions
            </div>
            {[
              { label: 'Make outbound call', icon: Phone, page: 'calls' },
              { label: 'View new leads', icon: Users, page: 'leads' },
              { label: 'Create workflow', icon: ArrowRight, page: 'workflows' },
              { label: 'Review approvals', icon: CheckSquare, page: 'approvals' },
              { label: 'Manage phone lines', icon: Phone, page: 'phone-numbers' },
            ].map(({ label, icon: Icon, page }) => (
              <button key={label} className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 6, fontSize: 12.5 }}
                onClick={() => onNavigate(page)}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active AI Employees */}
      <div className="card" style={{ padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
              Active AI Employees
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              Autonomous workforce overview
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('employees')}>
            View all ({workforce.total}) <ChevronRight size={13} />
          </button>
        </div>

        {topEmployees.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 20px', border: '1px dashed var(--border)', borderRadius: 12, background: '#f8fafc' }}>
            <Bot size={32} color="#64748b" style={{ margin: '0 auto 10px', opacity: 0.8 }} />
            <h4 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#0f172a' }}>No AI Employees Found</h4>
            <p style={{ margin: '0 0 14px', fontSize: 12.5, color: '#64748b', maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
              Create an AI employee to handle outbound sales, customer inquiries, or operations.
            </p>
            <button className="btn btn-primary btn-sm" onClick={() => onNavigate('employees/new')}>
              <PlusCircle size={13} />
              Create AI Employee
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {topEmployees.map((e) => (
              <div key={e.id} className="card" style={{ padding: 16, cursor: 'pointer' }}
                onClick={() => onNavigate('employees')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div className="avatar avatar-md av-sales">
                    {(e.name || 'AI').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {e.name}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {e.role}
                    </div>
                  </div>
                  <span className={`badge ${e.status === 'active' ? 'badge-active' : 'badge-paused'}`} style={{ marginLeft: 'auto', fontSize: 10.5 }}>
                    {e.status}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <div style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 10px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{e.total_tasks || 0}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Tasks</div>
                  </div>
                  <div style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 10px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{e.total_calls || 0}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Calls</div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11.5, color: '#64748b' }}>Performance</span>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: '#2563eb' }}>{e.performance_score || 90}%</span>
                  </div>
                  <div className="progress-bar" style={{ height: 5, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                    <div className="progress-fill" style={{ width: `${e.performance_score || 90}%`, height: '100%', background: '#2563eb', borderRadius: 99 }} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
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
