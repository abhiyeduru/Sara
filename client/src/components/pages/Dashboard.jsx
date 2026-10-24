import React, { useState, useEffect } from 'react';
import {
  TrendingUp, Bot, Phone, Users, CheckSquare, Zap,
  AlertCircle, Clock, ChevronRight, Play, PlusCircle, Sparkles, RefreshCw, Mic, IndianRupee, UsersRound,
  FileSpreadsheet
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import SkeletonLoader from '../common/SkeletonLoader';
import SetupNotificationBanner from '../employee-builder/SetupNotificationBanner';
import EmployeeBuilder from '../employee-builder/EmployeeBuilder';
import BulkLeadsModal from '../employee-builder/BulkLeadsModal';
import DashboardWorkforceSection from '../dashboard/DashboardWorkforceSection';
import QuickTestCallModal from '../dashboard/QuickTestCallModal';

export default function Dashboard({ onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [isBulkLeadsOpen, setIsBulkLeadsOpen] = useState(false);
  const [selectedBulkEmployee, setSelectedBulkEmployee] = useState(null);
  const [dashData, setDashData] = useState(null);
  const [employeesList, setEmployeesList] = useState([]);
  const [testCallEmployee, setTestCallEmployee] = useState(null);
  const [isTestCallModalOpen, setIsTestCallModalOpen] = useState(false);
  const [balance, setBalance] = useState('1,000');
  const [rawBalance, setRawBalance] = useState(1000);
  const [chartData, setChartData] = useState([]);
  const [callLimits, setCallLimits] = useState({ call_limit_minutes: 10, rate_per_minute: 6.0, min_limit_minutes: 5, max_limit_minutes: 10 });
  const [updatingLimit, setUpdatingLimit] = useState(false);
  const [limitNotice, setLimitNotice] = useState('');

  const fetchDashboardData = async () => {
    try {
      const [analyticsRes, billingRes, limitsRes, employeesRes] = await Promise.all([
        fetch('/api/v1/analytics/dashboard'),
        fetch('/api/v1/billing/balance'),
        fetch('/api/v1/billing/limits'),
        fetch('/api/v1/employees'),
      ]);

      if (analyticsRes.ok) {
        const d = await analyticsRes.json();
        setDashData(d);

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

        // Fallback employees from analytics if separate endpoint not yet populated
        if (d.all_employees && d.all_employees.length > 0) {
          setEmployeesList(prev => {
            const newIds = new Set(d.all_employees.map(e => e.id));
            const preservedNew = prev.filter(e => e.isNew && !newIds.has(e.id));
            return [...preservedNew, ...d.all_employees];
          });
        }
      }

      if (employeesRes.ok) {
        const emps = await employeesRes.json();
        if (Array.isArray(emps) && emps.length > 0) {
          setEmployeesList(prev => {
            const newIds = new Set(emps.map(e => e.id));
            const preservedNew = prev.filter(e => e.isNew && !newIds.has(e.id));
            return [...preservedNew, ...emps];
          });
        }
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
        setLimitNotice(`Call cap updated to ${data.call_limit_minutes} mins`);
        setTimeout(() => setLimitNotice(''), 3000);
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
    await fetchDashboardData();
  };

  const workforce = dashData?.workforce || { total: 0, active: 0, paused: 0 };
  const tasks = dashData?.tasks || { total: 0, running: 0, completed: 0, completion_rate: 0 };
  const leads = dashData?.leads || { total: 0, qualified: 0, conversion_rate: 0 };
  const calls = dashData?.calls || { total: 0, active: 0 };
  const pendingApprovals = dashData?.approvals?.pending || 0;
  const recentActivity = dashData?.recent_activity || [];
  const topEmployees = dashData?.top_employees || [];

  if (loading) {
    return (
      <div className="page-content animate-fade-in">
        <SkeletonLoader type="dashboard" />
      </div>
    );
  }

  return (
    <div
      className="animate-fade-in dashboard-page-container"
      style={{
        maxWidth: 1440,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        boxSizing: 'border-box'
      }}
    >
      {/* ── 1. Clean Editorial Header (No Box) ───────────────────────── */}
      <div className="dashboard-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div className="dashboard-header-title">
          <h1
            className="font-editorial"
            style={{
              fontSize: 30,
              fontWeight: 600,
              margin: 0,
              color: 'var(--text-primary)',
              lineHeight: 1.15
            }}
          >
            Good day, Abhi
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            Autonomous AI Workforce Telephony & Live Command Center
          </p>
        </div>

        <div className="dashboard-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className="dashboard-gateway-badge" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px',
            borderRadius: 20, background: '#f0fdf4', border: '1px solid #bbf7d0',
            fontSize: 12, fontWeight: 700, color: '#047857'
          }}>
            <span className="live-dot" style={{ width: 6, height: 6 }} />
            Plivo Voice Gateway Active (+91 80 6552 2007)
          </span>

          <div className="dashboard-header-btns" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={handleRefresh} style={{ borderRadius: 20 }}>
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>

            <button
              className="btn btn-sm"
              onClick={() => onNavigate('call-by-sara')}
              style={{
                borderRadius: 20,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                padding: '7px 18px',
                boxShadow: '0 4px 14px rgba(124, 58, 237, 0.35)',
                cursor: 'pointer',
                transition: 'transform 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px) scale(1.02)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
            >
              <Phone size={14} />
              Call by Sara 📞
            </button>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setIsBulkLeadsOpen(true)}
              style={{ borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 6, color: '#6d28d9', borderColor: '#ddd6fe', background: '#f5f3ff' }}
            >
              <FileSpreadsheet size={14} color="#7c3aed" />
              Bulk Leads 📂
            </button>

            <button
              className="btn btn-primary btn-sm"
              onClick={() => onNavigate('employees/new')}
              style={{ background: 'var(--brand-gradient)', border: 'none', borderRadius: 20, padding: '7px 16px' }}
            >
              <PlusCircle size={14} />
              New AI Worker
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. Setup Notification Onboarding Banner ─────────────────── */}
      <SetupNotificationBanner
        onContinue={() => {
          const el = document.getElementById('ai-employee-builder-workspace');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }}
        hasIncompleteSetup={true}
      />

      {/* ── 3. Main AI Employee Builder Workspace ────────────────────── */}
      <div id="ai-employee-builder-workspace">
        <EmployeeBuilder
          onNavigate={onNavigate}
          onEmployeeCreated={(newEmp) => {
            if (newEmp) {
              setEmployeesList(prev => [{ ...newEmp, isNew: true }, ...prev.filter(e => e.id !== newEmp.id)]);
            }
            fetchDashboardData();
            setTimeout(() => {
              const el = document.getElementById('dashboard-workforce-display');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 300);
          }}
          onTestCall={(emp) => {
            setTestCallEmployee(emp);
            setIsTestCallModalOpen(true);
          }}
        />
      </div>

      {/* ── 3.5. Autonomous AI Workforce Display (మీ AI ఉద్యోగులు) ─────── */}
      <div id="dashboard-workforce-display">
        <DashboardWorkforceSection
          employees={employeesList}
          onNavigate={onNavigate}
          onTestCall={(emp) => {
            setTestCallEmployee(emp);
            setIsTestCallModalOpen(true);
          }}
          onOpenBulkModal={(emp) => {
            setSelectedBulkEmployee(emp);
            setIsBulkLeadsOpen(true);
          }}
        />
      </div>

      {/* ── 4. Unified Executive Metrics Bar (Replaces 7 Separate Boxes) ── */}
      <div className="dashboard-metrics-bar" style={{
        background: '#ffffff',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '16px 24px',
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: 16,
        alignItems: 'center',
        boxShadow: '0 4px 20px rgba(124, 58, 237, 0.03)'
      }}>
        {[
          { label: 'AI Employees', value: workforce.total ?? 0, sub: `${workforce.active ?? 0} active`, icon: Bot, color: '#7c3aed' },
          { label: 'Voice Calls', value: calls.total ?? 0, sub: `${calls.active ?? 0} live`, icon: Phone, color: '#2563eb' },
          { label: 'CRM Leads', value: leads.total ?? 0, sub: `${leads.qualified ?? 0} qualified`, icon: Users, color: '#10b981' },
          { label: 'Tasks Done', value: tasks.completed ?? 0, sub: `${tasks.running ?? 0} running`, icon: CheckSquare, color: '#4f46e5' },
          { label: 'Conversion Rate', value: `${leads.conversion_rate ?? 0}%`, sub: 'Avg Rate', icon: TrendingUp, color: '#d97706' },
          { label: 'Call Wallet', value: `₹${balance}`, sub: 'Credits left', icon: IndianRupee, color: '#059669' },
        ].map((m, idx) => (
          <div key={m.label} className="dashboard-metric-item" style={{
            display: 'flex', alignItems: 'center', gap: 12,
            borderRight: idx < 5 ? '1px solid var(--border-light)' : 'none',
            paddingRight: idx < 5 ? 12 : 0
          }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <m.icon size={16} color={m.color} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                {m.value}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>{m.label}</span>
                <span style={{ fontSize: 10, color: m.color, fontWeight: 700 }}>• {m.sub}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── 3. Single-Screen 2-Column Command Center ───────────────────── */}
      <div className="dashboard-command-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 20, alignItems: 'stretch' }}>
        
        {/* LEFT COLUMN: Telephony Cap & Live Activity Graph */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Telephony Session Duration Limit Bar */}
          <div style={{
            background: '#ffffff',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: '20px 24px',
            boxShadow: '0 4px 20px rgba(124, 58, 237, 0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed' }}>
                  <Phone size={17} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Telephony Call Duration Cap & Billing
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
                    5 credits (₹5)/min wallet deduct • 30s auto-warning
                  </div>
                </div>
              </div>

              {limitNotice && (
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#059669', background: '#ecfdf5', padding: '3px 10px', borderRadius: 12 }}>
                  ✓ {limitNotice}
                </span>
              )}
            </div>

            <div className="dashboard-cap-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, background: 'var(--surface-soft)', padding: '12px 18px', borderRadius: 12, border: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Available Calling Time</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                  {Math.floor(rawBalance / (callLimits.rate_per_minute || 5.0))} <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>mins</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', marginRight: 4 }}>Set Cap:</span>
                {[5, 6, 7, 8, 9, 10].map((m) => {
                  const isActive = callLimits.call_limit_minutes === m;
                  return (
                    <button
                      key={m}
                      disabled={updatingLimit}
                      onClick={() => handleUpdateLimit(m)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        border: isActive ? '1px solid #7c3aed' : '1px solid var(--border)',
                        background: isActive ? '#7c3aed' : '#ffffff',
                        color: isActive ? '#ffffff' : 'var(--text-secondary)',
                      }}
                    >
                      {m}m
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Recharts Telephony Activity Graph */}
          <div style={{
            background: '#ffffff',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: '20px 24px',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justify: 'space-between',
            boxShadow: '0 4px 20px rgba(124, 58, 237, 0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Workforce Telephony Stream
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
                  Hourly call volume & execution density
                </div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', background: '#f5f3ff', padding: '3px 10px', borderRadius: 12 }}>
                Live Stream
              </span>
            </div>

            <ResponsiveContainer width="100%" height={150}>
              <AreaChart data={chartData.length > 0 ? chartData : [{ t: '9am', v: 4 }, { t: '12pm', v: 12 }, { t: '3pm', v: 19 }, { t: '6pm', v: 9 }]}>
                <defs>
                  <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="t" tick={{ fontSize: 11, fill: '#8c85a3' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid rgba(124, 58, 237, 0.15)', borderRadius: 10, fontSize: 12 }} />
                <Area type="monotone" dataKey="v" stroke="#7c3aed" strokeWidth={2.5} fill="url(#purpleGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* RIGHT COLUMN: Digital Workers Spotlight & Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Active AI Employees Spotlight */}
          <div style={{
            background: '#ffffff',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: '20px 24px',
            flex: 1,
            boxShadow: '0 4px 20px rgba(124, 58, 237, 0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Active Digital Workers
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
                  Autonomous workforce members
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('employees')} style={{ fontSize: 12, borderRadius: 12 }}>
                View All ({workforce.total || 1}) <ChevronRight size={13} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(topEmployees.length > 0 ? topEmployees.slice(0, 3) : [
                { id: 'sara_1', name: 'Sara', role: 'Executive Business Assistant', total_calls: 388, performance_score: 98 },
                { id: 'kiet_2', name: 'Kiet', role: 'Outbound Sales Specialist', total_calls: 214, performance_score: 94 },
              ]).map((emp) => (
                <div
                  key={emp.id}
                  onClick={() => onNavigate('employees')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                    borderRadius: 12, background: 'var(--surface-soft)', border: '1px solid var(--border)',
                    cursor: 'pointer', transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f5f3ff'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-soft)'}
                >
                  <div className="avatar avatar-md av-sales" style={{ background: 'var(--brand-gradient)', width: 34, height: 34, fontSize: 13 }}>
                    {(emp.name || 'S')[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{emp.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.role}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#7c3aed' }}>{emp.performance_score || 96}%</span>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{emp.total_calls || 120} calls</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Direct Execution Shortcuts */}
          <div style={{
            background: '#ffffff',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: '20px 24px',
            boxShadow: '0 4px 20px rgba(124, 58, 237, 0.03)'
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
              Quick Navigation Actions
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Outbound Calls', icon: Phone, page: 'calls' },
                { label: 'CRM Leads', icon: Users, page: 'leads' },
                { label: 'AI Teams', icon: UsersRound, page: 'teams' },
                { label: 'Phone Lines', icon: Phone, page: 'phone-numbers' },
              ].map(({ label, icon: Icon, page }) => (
                <button
                  key={label}
                  className="btn btn-secondary btn-sm"
                  style={{ justifyContent: 'flex-start', fontSize: 12, borderRadius: 10, padding: '9px 12px' }}
                  onClick={() => onNavigate(page)}
                >
                  <Icon size={13} color="#7c3aed" />
                  {label}
                </button>
              ))}
            </div>
          </div>

        </div>

      </div>

      <BulkLeadsModal
        isOpen={isBulkLeadsOpen}
        onClose={() => {
          setIsBulkLeadsOpen(false);
          setSelectedBulkEmployee(null);
        }}
        preselectedEmployeeId={selectedBulkEmployee?.id}
        preselectedEmployeeName={selectedBulkEmployee?.name}
        preselectedScript={selectedBulkEmployee?.call_script}
        onCampaignCreated={() => fetchDashboardData()}
      />

      <QuickTestCallModal
        employee={testCallEmployee}
        isOpen={isTestCallModalOpen}
        onClose={() => {
          setIsTestCallModalOpen(false);
          setTestCallEmployee(null);
        }}
      />
    </div>
  );
}


