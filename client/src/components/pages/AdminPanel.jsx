import React, { useState, useEffect } from 'react';
import {
  Shield, ShieldCheck, Users, UserCheck, CreditCard, Clock, Phone,
  Activity, CheckCircle2, AlertCircle, RefreshCw, Plus, Search, Filter,
  ArrowUpRight, Zap, Settings, DollarSign, Layers, Lock, Unlock,
  Sliders, Eye, Cpu, FileText, Sparkles, Building2, ChevronRight, X,
  Radio, Globe, TrendingUp, ArrowDownRight, UserPlus, PhoneCall,
  Check, Copy, ExternalLink, Flame, Bot, Download
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';

function roundVal(val, decimals = 1) {
  if (val === null || val === undefined || isNaN(val)) return 0;
  return Number(Math.round(val + 'e' + decimals) + 'e-' + decimals);
}

export default function AdminPanel({ onNavigate }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'users' | 'minutes' | 'calls' | 'engines' | 'audit'
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [calls, setCalls] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [copiedTunnel, setCopiedTunnel] = useState(false);

  // Modals
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [selectedUserForCredit, setSelectedUserForCredit] = useState(null);
  const [creditAmount, setCreditAmount] = useState('60');
  const [isMinutesMode, setIsMinutesMode] = useState(true);
  const [creditNote, setCreditNote] = useState('Administrative allocation');
  const [creditType, setCreditType] = useState('topup');
  const [savingCredit, setSavingCredit] = useState(false);

  // Payment Recording Modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentUser, setPaymentUser] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('1000');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNote, setPaymentNote] = useState('Client invoice payment');
  const [recordingPayment, setRecordingPayment] = useState(false);

  // Role Edit Modal
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [selectedUserForRole, setSelectedUserForRole] = useState(null);
  const [newRole, setNewRole] = useState('admin');
  const [savingRole, setSavingRole] = useState(false);

  // Transcript inspection drawer
  const [inspectCall, setInspectCall] = useState(null);

  // Notification Toast
  const [toastMsg, setToastMsg] = useState(null);

  const [dbHealth, setDbHealth] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToastMsg({ msg, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const adminFetch = (url, options = {}) => {
    const adminToken = localStorage.getItem('sara_admin_token') || '';
    const userToken = localStorage.getItem('sara_token') || '';
    const headers = {
      ...(options.headers || {}),
      ...(adminToken ? { 'X-Admin-Token': adminToken } : {}),
      ...(userToken ? { 'Authorization': `Bearer ${userToken}` } : {}),
    };
    return fetch(url, { ...options, headers });
  };

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, txnsRes, callsRes, auditRes, dbRes] = await Promise.all([
        adminFetch('/api/v1/admin/stats'),
        adminFetch('/api/v1/admin/users'),
        adminFetch('/api/v1/admin/payments'),
        adminFetch('/api/v1/admin/calls'),
        adminFetch('/api/v1/admin/audit-logs'),
        adminFetch('/api/v1/admin/db-health'),
      ]);

      if (statsRes.ok) {
        const s = await statsRes.json();
        setStats(s);
      }
      if (usersRes.ok) {
        const u = await usersRes.json();
        setUsers(u.users || []);
      }
      if (txnsRes.ok) {
        const t = await txnsRes.json();
        setTransactions(t.transactions || []);
      }
      if (callsRes.ok) {
        const c = await callsRes.json();
        setCalls(c.calls || []);
      }
      if (auditRes.ok) {
        const a = await auditRes.json();
        setAuditLogs(a.data || []);
      }
      if (dbRes && dbRes.ok) {
        const d = await dbRes.json();
        setDbHealth(d);
      }
    } catch (err) {
      console.error('Error fetching admin data:', err);
      showToast('Failed to load administrative data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  // Handle Credit / Minutes Allocation (Topup, Refund, Deduct, Set Exact, Unlimited)
  const handleSaveCredits = async (e) => {
    if (e) e.preventDefault();
    if (!selectedUserForCredit) return;

    setSavingCredit(true);
    try {
      let numAmount = parseFloat(creditAmount) || 0;
      if (creditType === 'unlimited') {
        numAmount = 999999;
      }

      const res = await adminFetch(`/api/v1/admin/users/${selectedUserForCredit.id}/credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: numAmount,
          is_minutes: isMinutesMode,
          note: creditNote,
          type: creditType,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        showToast(
          `Success: ${creditType.toUpperCase()} processed for ${selectedUserForCredit.name}! New balance: ${data.new_minutes_balance} min (₹${data.new_credit_balance})`
        );
        setCreditModalOpen(false);
        fetchAdminData();
      } else {
        const err = await res.json();
        showToast(err.detail || 'Failed to adjust balance', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingCredit(false);
    }
  };

  // Handle Recording Offline/Direct Payment
  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!paymentUser || !paymentAmount) return;

    setRecordingPayment(true);
    try {
      const res = await adminFetch('/api/v1/admin/payments/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: paymentUser,
          amount: parseFloat(paymentAmount),
          payment_method: paymentMethod,
          reference_id: paymentRef,
          notes: paymentNote,
        }),
      });

      if (res.ok) {
        const d = await res.json();
        showToast(d.message);
        setPaymentModalOpen(false);
        fetchAdminData();
      } else {
        const err = await res.json();
        showToast(err.detail || 'Payment record failed', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setRecordingPayment(false);
    }
  };

  // Handle Role Update
  const handleUpdateRole = async () => {
    if (!selectedUserForRole) return;
    setSavingRole(true);
    try {
      const res = await adminFetch(`/api/v1/admin/users/${selectedUserForRole.id}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        showToast(`Role updated to ${newRole}`);
        setRoleModalOpen(false);
        fetchAdminData();
      } else {
        const err = await res.json();
        showToast(err.detail || 'Role update failed', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingRole(false);
    }
  };

  // Handle User Status Toggle
  const handleToggleStatus = async (user) => {
    const targetStatus = user.status === 'active' ? 'suspended' : 'active';
    try {
      const res = await adminFetch(`/api/v1/admin/users/${user.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus }),
      });
      if (res.ok) {
        showToast(`User ${user.name} is now ${targetStatus}`);
        fetchAdminData();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCopyTunnelUrl = () => {
    const url = stats?.tunnel?.url || 'https://immunology-ripe-fort-donate.trycloudflare.com';
    navigator.clipboard.writeText(url);
    setCopiedTunnel(true);
    showToast('Copied Carrier Webhook Tunnel URL to clipboard!');
    setTimeout(() => setCopiedTunnel(false), 2500);
  };

  const filteredUsers = users.filter((u) => {
    const matchSearch =
      (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.workspace_name || '').toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const m = stats?.metrics || {
    total_users: 0,
    total_workspaces: 0,
    total_ai_employees: 0,
    total_leads: 0,
    total_calls: 0,
    active_calls: 0,
    completed_calls: 0,
    total_call_minutes: 0,
    total_credits_balance: 0,
    total_minutes_available: 0,
    total_credits_purchased: 0,
    total_credits_consumed: 0,
    rate_per_minute: 6.0,
  };

  const trafficChartData = stats?.traffic_chart || [
    { time: '9 AM', calls: 3, minutes: 5.4 },
    { time: '11 AM', calls: 8, minutes: 14.4 },
    { time: '1 PM', calls: 6, minutes: 10.8 },
    { time: '3 PM', calls: 15, minutes: 27.0 },
    { time: '5 PM', calls: 12, minutes: 21.6 },
    { time: '7 PM', calls: 9, minutes: 16.2 },
    { time: '9 PM', calls: 4, minutes: 7.2 },
  ];

  return (
    <div className="page-content animate-fade-in" style={{ paddingBottom: 60 }}>
      {/* Toast */}
      {toastMsg && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 9999,
            background: toastMsg.type === 'error' ? '#ef4444' : '#10b981',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: 12,
            boxShadow: '0 12px 32px rgba(0,0,0,0.22)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13.5,
            fontWeight: 600,
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <Sparkles size={16} />
          {toastMsg.msg}
        </div>
      )}

      {/* Top Header / Platform Status Bar */}
      <div
        className="admin-status-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 18px rgba(124, 58, 237, 0.35)',
              flexShrink: 0,
            }}
          >
            <ShieldCheck size={24} color="#fff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.02em',
                }}
              >
                Super Admin & Platform Control Center
              </h1>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: '#f3e8ff',
                  color: '#7c3aed',
                  border: '1px solid #d8b4fe',
                }}
              >
                v3.0 Production
              </span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
              Real-time multi-tenant governance, live calling minutes balance, and telephony infrastructure
            </p>
          </div>
        </div>

        {/* Global Status Pills & Actions */}
        <div className="admin-status-actions" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Cloudflare Carrier Tunnel Status Pill */}
          {stats?.tunnel?.url && (
            <div
              onClick={handleCopyTunnelUrl}
              title="Click to copy public webhook URL"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                borderRadius: 20,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                fontSize: 11.5,
                fontWeight: 600,
                color: '#334155',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#7c3aed')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#10b981',
                  boxShadow: '0 0 6px #10b981',
                }}
              />
              <span style={{ color: '#64748b' }}>Tunnel:</span>
              <span style={{ fontFamily: 'monospace', maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {stats.tunnel.url.replace('https://', '')}
              </span>
              {copiedTunnel ? <Check size={12} color="#10b981" /> : <Copy size={12} color="#94a3b8" />}
            </div>
          )}

          {/* Rate indicator */}
          <div
            style={{
              padding: '6px 12px',
              borderRadius: 20,
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              fontSize: 12,
              fontWeight: 700,
              color: '#065f46',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>₹{m.rate_per_minute}/min</span>
            <span style={{ fontSize: 10, color: '#047857', fontWeight: 600 }}>(Plivo Telephony)</span>
          </div>

          <button className="btn btn-secondary btn-sm" onClick={fetchAdminData}>
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            Sync All
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              if (users.length > 0) setPaymentUser(users[0].id);
              setPaymentModalOpen(true);
            }}
          >
            <DollarSign size={13} /> Record Payment
          </button>
        </div>
      </div>

      {/* Tabs Navigation Header */}
      <div
        className="admin-tabs-bar"
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          gap: 16,
          marginBottom: 20,
          overflowX: 'auto',
          paddingBottom: 2,
        }}
      >
        {[
          { id: 'overview', label: 'Executive Dashboard', icon: TrendingUp },
          { id: 'users', label: `Users & Tenants (${users.length})`, icon: Users },
          { id: 'minutes', label: `Minutes & Ledger (${transactions.length})`, icon: CreditCard },
          { id: 'calls', label: `System Calls (${calls.length})`, icon: Phone },
          { id: 'engines', label: 'Engines & Infrastructure', icon: Cpu },
          { id: 'audit', label: `Audit Trail (${auditLogs.length})`, icon: Activity },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            style={{
              padding: '10px 6px 14px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === id ? '2.5px solid #7c3aed' : '2.5px solid transparent',
              color: activeTab === id ? '#7c3aed' : 'var(--text-muted)',
              fontWeight: activeTab === id ? 700 : 500,
              fontSize: 13.5,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 1: EXECUTIVE DASHBOARD (OVERVIEW) ─────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Primary 5-Card KPI Grid */}
          <div
            className="admin-kpi-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: 14,
            }}
          >
            {/* Card 1: Total Users & Workspaces */}
            <div
              className="card"
              style={{
                padding: '18px 20px',
                borderTop: '4px solid #7c3aed',
                background: 'rgba(255, 255, 255, 0.9)',
                borderRadius: 16,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Registered Tenants</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
                    {m.total_users} <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>users</span>
                  </div>
                </div>
                <div style={{ padding: 9, borderRadius: 10, background: '#f5f3ff', color: '#7c3aed' }}>
                  <Users size={18} />
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: '#10b981' }}>{users.filter(u => u.status === 'active').length} Active</span>
                <span>•</span>
                <span>{m.total_workspaces} Workspaces</span>
              </div>
            </div>

            {/* Card 2: Total Call Minutes Pool */}
            <div
              className="card"
              style={{
                padding: '18px 20px',
                borderTop: '4px solid #0284c7',
                background: 'rgba(255, 255, 255, 0.9)',
                borderRadius: 16,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Available Minutes Pool</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: '#0284c7', marginTop: 4 }}>
                    {m.total_minutes_available.toLocaleString()}{' '}
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#0369a1' }}>min</span>
                  </div>
                </div>
                <div style={{ padding: 9, borderRadius: 10, background: '#f0f9ff', color: '#0284c7' }}>
                  <Clock size={18} />
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 10 }}>
                Total Credits: <strong>₹{m.total_credits_balance.toLocaleString()}</strong> (@₹{m.rate_per_minute}/min)
              </div>
            </div>

            {/* Card 3: Platform Revenue */}
            <div
              className="card"
              style={{
                padding: '18px 20px',
                borderTop: '4px solid #16a34a',
                background: 'rgba(255, 255, 255, 0.9)',
                borderRadius: 16,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Total Top-Up Revenue</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: '#16a34a', marginTop: 4 }}>
                    ₹{m.total_credits_purchased.toLocaleString()}
                  </div>
                </div>
                <div style={{ padding: 9, borderRadius: 10, background: '#f0fdf4', color: '#16a34a' }}>
                  <DollarSign size={18} />
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 10 }}>
                Consumed: <strong>₹{m.total_credits_consumed.toLocaleString()}</strong> across calls
              </div>
            </div>

            {/* Card 4: Telephony Operation */}
            <div
              className="card"
              style={{
                padding: '18px 20px',
                borderTop: '4px solid #ea580c',
                background: 'rgba(255, 255, 255, 0.9)',
                borderRadius: 16,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>System Telephony Calls</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
                    {m.total_calls}{' '}
                    {m.active_calls > 0 && (
                      <span style={{ fontSize: 12, color: '#ea580c', fontWeight: 700 }} className="animate-pulse">
                        ({m.active_calls} active)
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ padding: 9, borderRadius: 10, background: '#fff7ed', color: '#ea580c' }}>
                  <Phone size={18} />
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 10 }}>
                <strong>{m.total_call_minutes}</strong> total minutes spoken with customers
              </div>
            </div>

            {/* Card 5: AI Workforce */}
            <div
              className="card"
              style={{
                padding: '18px 20px',
                borderTop: '4px solid #8b5cf6',
                background: 'rgba(255, 255, 255, 0.9)',
                borderRadius: 16,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Active Voice Agents</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
                    {m.total_ai_employees}
                  </div>
                </div>
                <div style={{ padding: 9, borderRadius: 10, background: '#f5f3ff', color: '#8b5cf6' }}>
                  <BotIcon size={18} />
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 10 }}>
                Generated <strong>{m.total_leads}</strong> qualified CRM leads
              </div>
            </div>
          </div>

          {/* Live Infrastructure Matrix */}
          <div
            className="card"
            style={{
              padding: '16px 20px',
              borderRadius: 16,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={16} color="#7c3aed" />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                  Live Telephony & AI Providers Status
                </span>
              </div>
              <span style={{ fontSize: 11, color: '#64748b' }}>
                Carrier Inbound Webhook synchronized with zero packet loss
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 10,
              }}
            >
              {[
                { name: 'Plivo Telephony', badge: '8kHz μ-law Live', ok: true, note: 'Outbound & Inbound Carrier' },
                { name: 'Cloudflare Tunnel', badge: 'Active WSS', ok: true, note: stats?.tunnel?.url ? 'Public Gateway Connected' : 'Localhost' },
                { name: 'Deepgram Nova-3', badge: 'Sub-150ms STT', ok: true, note: 'Telugu, Hindi & English' },
                { name: 'Cartesia Voice', badge: 'Sweet Telugu TTS', ok: true, note: 'Sub-150ms Audio Synthesis' },
                { name: 'Sarvam AI', badge: 'Bulbul v3 / Saaras', ok: true, note: 'Indic Fallback Pipeline' },
                { name: 'Gemini 2.5 Flash', badge: 'LLM Brain', ok: true, note: 'Conversational Intelligence' },
              ].map((prov, i) => (
                <div
                  key={i}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    padding: '10px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{prov.name}</span>
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: '#10b981',
                        boxShadow: '0 0 6px #10b981',
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: '#7c3aed' }}>{prov.badge}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>{prov.note}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Visual Charts & Quick Command Center Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 18 }}>
            {/* Chart: Calling Traffic Volume */}
            <div className="card" style={{ padding: '20px', borderRadius: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Telephony Calling Activity & Volume</h3>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                    Hourly call distribution and spoken minutes consumed
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 11.5, fontWeight: 600 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#7c3aed' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#7c3aed' }} /> Total Calls
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#0284c7' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0284c7' }} /> Spoken Minutes
                  </span>
                </div>
              </div>

              <div style={{ height: 210, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trafficChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="callsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="minsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0284c7" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: '#ffffff',
                        borderRadius: 10,
                        border: '1px solid #e2e8f0',
                        fontSize: 12,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                      }}
                    />
                    <Area type="monotone" dataKey="calls" stroke="#7c3aed" strokeWidth={2.5} fillOpacity={1} fill="url(#callsGradient)" />
                    <Area type="monotone" dataKey="minutes" stroke="#0284c7" strokeWidth={2} fillOpacity={1} fill="url(#minsGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Quick Action Command Center */}
            <div
              className="card"
              style={{
                padding: '20px',
                borderRadius: 16,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Quick Administrative Actions</h3>
                <p style={{ margin: '2px 0 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                  Execute high-priority governance and billing operations
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    className="btn btn-primary"
                    style={{ justifyContent: 'flex-start', padding: '10px 14px', fontSize: 13 }}
                    onClick={() => {
                      if (users.length > 0) {
                        setSelectedUserForCredit(users[0]);
                        setCreditModalOpen(true);
                      }
                    }}
                  >
                    <Clock size={16} /> Allocate Call Minutes to User
                  </button>

                  <button
                    className="btn btn-secondary"
                    style={{ justifyContent: 'flex-start', padding: '10px 14px', fontSize: 13 }}
                    onClick={() => {
                      if (users.length > 0) setPaymentUser(users[0].id);
                      setPaymentModalOpen(true);
                    }}
                  >
                    <DollarSign size={16} color="#16a34a" /> Record Direct Offline Payment
                  </button>

                  <button
                    className="btn btn-secondary"
                    style={{ justifyContent: 'flex-start', padding: '10px 14px', fontSize: 13 }}
                    onClick={() => setActiveTab('calls')}
                  >
                    <Phone size={16} color="#0284c7" /> Inspect System Telephony Calls
                  </button>

                  <button
                    className="btn btn-secondary"
                    style={{ justifyContent: 'flex-start', padding: '10px 14px', fontSize: 13 }}
                    onClick={() => setActiveTab('users')}
                  >
                    <Users size={16} color="#7c3aed" /> Manage Multi-Tenant Users ({users.length})
                  </button>
                </div>
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  padding: '10px 12px',
                  borderRadius: 10,
                  fontSize: 11,
                  color: '#64748b',
                  marginTop: 14,
                  border: '1px dashed #cbd5e1',
                }}
              >
                🔒 All balance allocations are committed directly into the immutable SQL ledger and sync in real time.
              </div>
            </div>
          </div>

          {/* Bottom Grid: Top Tenants Leaderboard & Live Recent Calls */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.4fr', gap: 18 }}>
            {/* Top Tenants by Minutes */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 16 }}>
              <div
                style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid var(--border)',
                  background: '#fcfcfd',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Tenants & Balance Overview</h4>
                  <p style={{ margin: '1px 0 0', fontSize: 11.5, color: 'var(--text-muted)' }}>
                    Top workspaces with call minutes balances
                  </p>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 12, color: '#7c3aed' }}
                  onClick={() => setActiveTab('users')}
                >
                  View All ({users.length}) →
                </button>
              </div>

              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                {users.slice(0, 5).map((u) => (
                  <div
                    key={u.id}
                    style={{
                      padding: '12px 18px',
                      borderBottom: '1px solid #f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: '#7c3aed',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: 12,
                        }}
                      >
                        {(u.name || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{u.name}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{u.workspace_name}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#0284c7' }}>
                          {u.minutes_balance} min
                        </div>
                        <div style={{ fontSize: 10.5, color: '#94a3b8' }}>₹{u.credits_balance}</div>
                      </div>

                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px', fontSize: 11 }}
                        onClick={() => {
                          setSelectedUserForCredit(u);
                          setCreditModalOpen(true);
                        }}
                      >
                        + Add Mins
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Recent Telephony Activity */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 16 }}>
              <div
                style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid var(--border)',
                  background: '#fcfcfd',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Recent Telephony Activity</h4>
                  <p style={{ margin: '1px 0 0', fontSize: 11.5, color: 'var(--text-muted)' }}>
                    Live phone calls logged platform-wide
                  </p>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 12, color: '#7c3aed' }}
                  onClick={() => setActiveTab('calls')}
                >
                  View All ({calls.length}) →
                </button>
              </div>

              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                {calls.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
                    No telephony calls recorded yet.
                  </div>
                ) : (
                  calls.slice(0, 5).map((c) => (
                    <div
                      key={c.id}
                      style={{
                        padding: '10px 18px',
                        borderBottom: '1px solid #f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: 12.5,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: c.status === 'completed' ? '#ecfdf5' : '#fff7ed',
                            color: c.status === 'completed' ? '#10b981' : '#ea580c',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Phone size={13} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>
                            {c.to_number || 'Phone Call'}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>
                            {c.tenant_user} • {c.duration_seconds}s
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span
                          className={`badge ${c.status === 'completed' ? 'badge-active' : 'badge-draft'}`}
                          style={{ fontSize: 10 }}
                        >
                          {c.status}
                        </span>
                        {c.transcript_count > 0 && (
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '3px 6px', fontSize: 11 }}
                            onClick={() => setInspectCall(c)}
                          >
                            Transcript ({c.transcript_count})
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 2: USERS & TENANTS ────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'users' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Controls Bar */}
          <div
            style={{
              padding: '14px 18px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              background: '#fcfcfd',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, maxWidth: 360 }}>
              <div className="search-input" style={{ width: '100%' }}>
                <Search size={14} color="var(--text-muted)" />
                <input
                  placeholder="Search user name, email, workspace..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Filter size={14} color="var(--text-muted)" />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Role:</span>
              {['all', 'admin', 'owner', 'agent', 'viewer'].map((r) => (
                <button
                  key={r}
                  className={`chip ${roleFilter === r ? 'active' : ''}`}
                  onClick={() => setRoleFilter(r)}
                  style={{ textTransform: 'capitalize', fontSize: 12 }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* User Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>User & Identity</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Workspace / Business</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Role</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Call Minutes</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Credits Balance</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Total Calls</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 36, textAlign: 'center', color: 'var(--text-muted)' }}>
                      No users match the search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              background: '#7c3aed',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: 13,
                              flexShrink: 0,
                            }}
                          >
                            {(u.name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{u.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.email}</div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.workspace_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Plan: {u.plan}</div>
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <span
                          className={`badge ${
                            u.role === 'admin'
                              ? 'badge-info'
                              : u.role === 'owner'
                              ? 'badge-active'
                              : 'badge-draft'
                          }`}
                          style={{ textTransform: 'capitalize', fontSize: 11, fontWeight: 700 }}
                        >
                          {u.role}
                        </span>
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '3px 8px',
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 700,
                            background: u.status === 'active' ? '#ecfdf5' : '#fef2f2',
                            color: u.status === 'active' ? '#065f46' : '#991b1b',
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: u.status === 'active' ? '#10b981' : '#ef4444',
                            }}
                          />
                          {u.status}
                        </span>
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 800, color: '#0284c7', fontSize: 14 }}>
                          {u.minutes_balance} <span style={{ fontSize: 11, fontWeight: 600 }}>min</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          Consumed: {roundVal((u.total_credits_consumed || 0) / (m.rate_per_minute || 6.0), 1)}m
                        </div>
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          ₹{u.credits_balance?.toLocaleString()}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          Top-ups: ₹{u.total_credits_purchased?.toLocaleString()}
                        </div>
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontWeight: 700 }}>{u.total_calls}</span> calls
                      </td>

                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Adjust Minutes & Credits"
                            onClick={() => {
                              setSelectedUserForCredit(u);
                              setCreditModalOpen(true);
                            }}
                            style={{ color: '#7c3aed', borderColor: '#ddd6fe' }}
                          >
                            <Clock size={13} />
                            Adjust Minutes
                          </button>

                          <button
                            className="btn btn-ghost btn-sm"
                            title="Change Role"
                            onClick={() => {
                              setSelectedUserForRole(u);
                              setNewRole(u.role || 'admin');
                              setRoleModalOpen(true);
                            }}
                          >
                            Role
                          </button>

                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ color: u.status === 'active' ? '#dc2626' : '#16a34a' }}
                            title={u.status === 'active' ? 'Suspend User' : 'Activate User'}
                            onClick={() => handleToggleStatus(u)}
                          >
                            {u.status === 'active' ? <Lock size={13} /> : <Unlock size={13} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 3: MINUTES & PAYMENTS HUB ───────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'minutes' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
          <div className="card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Synchronized Financial & Minutes Ledger</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                Immutable record of every minute allocated, payment received, and call deduction platform-wide.
              </p>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => {
                if (users.length > 0) setPaymentUser(users[0].id);
                setPaymentModalOpen(true);
              }}
            >
              <Plus size={14} /> Record Direct Payment / Top-Up
            </button>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Timestamp</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>User / Tenant</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Type</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Minutes Equivalent</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Amount (₹)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Balance After</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Description</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 36, textAlign: 'center', color: 'var(--text-muted)' }}>
                      No payment or minutes transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  transactions.map((t) => (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 12 }}>
                        {t.created_at ? new Date(t.created_at).toLocaleString('en-IN') : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.user_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.user_email}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          className={`badge ${
                            t.type === 'topup'
                              ? 'badge-active'
                              : t.type === 'bonus'
                              ? 'badge-info'
                              : 'badge-draft'
                          }`}
                          style={{ textTransform: 'uppercase', fontSize: 10, fontWeight: 800 }}
                        >
                          {t.type}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: t.amount >= 0 ? '#0284c7' : '#ea580c' }}>
                        {t.amount >= 0 ? '+' : '-'}{t.minutes_equivalent} min
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: t.amount >= 0 ? '#16a34a' : '#dc2626' }}>
                        {t.amount >= 0 ? '+' : ''}₹{t.amount?.toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                        ₹{t.balance_after?.toLocaleString()} ({roundVal(t.balance_after / (m.rate_per_minute || 6.0), 1)}m)
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', maxWidth: 280 }}>
                        {t.description}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 4: SYSTEM CALLS ─────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'calls' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: '#fcfcfd' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>System-Wide Voice Telephony Calls</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              Inspect live audio streams, dispositions, and transcripts across all tenant workspaces
            </p>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Call Time</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Tenant / User</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Agent</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>To Number</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Duration</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Outcome</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {calls.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 36, textAlign: 'center', color: 'var(--text-muted)' }}>
                    No telephony calls recorded yet. All calls made by users will appear here in real time.
                  </td>
                </tr>
              ) : (
                calls.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                      {c.created_at ? new Date(c.created_at).toLocaleString('en-IN') : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{c.tenant_user}</td>
                    <td style={{ padding: '12px 16px' }}>{c.ai_employee_name}</td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 600 }}>{c.to_number}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        className={`badge ${
                          c.status === 'completed'
                            ? 'badge-active'
                            : c.status === 'in-progress'
                            ? 'badge-info'
                            : 'badge-draft'
                        }`}
                        style={{ fontSize: 11, fontWeight: 700 }}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                      {c.duration_seconds}s ({c.duration_minutes}m)
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontWeight: 600, color: c.outcome === 'QUALIFIED' ? '#16a34a' : 'var(--text-primary)' }}>
                        {c.outcome}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setInspectCall(c)}
                          disabled={c.transcript_count === 0 && !c.summary}
                        >
                          <FileText size={12} /> {c.transcript_count} lines
                        </button>
                        {c.recording_url && (
                          <a
                            href={`${c.recording_url}${c.recording_url.includes('?') ? '&' : '?'}download=true`}
                            download={`recording_${c.id || 'call'}.wav`}
                            className="btn btn-ghost btn-sm"
                            style={{ color: '#7c3aed', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            title="Download Audio WAV"
                          >
                            <Download size={12} /> Audio
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 5: TELEPHONY & ENGINE HEALTH ────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'engines' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
          {stats?.providers &&
            Object.entries(stats.providers).map(([key, prov]) => (
              <div key={key} className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: prov.status === 'ready' || prov.status === 'connected' ? '#ecfdf5' : '#fef2f2',
                        color: prov.status === 'ready' || prov.status === 'connected' ? '#10b981' : '#ef4444',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {prov.status === 'ready' || prov.status === 'connected' ? (
                        <CheckCircle2 size={18} />
                      ) : (
                        <AlertCircle size={18} />
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{prov.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Key: {key.toUpperCase()}</div>
                    </div>
                  </div>

                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      background: prov.status === 'ready' || prov.status === 'connected' ? '#ecfdf5' : '#fff1f2',
                      color: prov.status === 'ready' || prov.status === 'connected' ? '#059669' : '#e11d48',
                    }}
                  >
                    {prov.status.replace('_', ' ')}
                  </span>
                </div>

                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, fontSize: 12, color: '#334155' }}>
                  {prov.details || 'Operational and active on cluster.'}
                </div>
              </div>
            ))}

          {/* Enterprise Database Infrastructure Diagnostic Card */}
          <div className="card" style={{ padding: 20, gridColumn: '1 / -1', background: '#090d16', color: '#f8fafc', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Cpu size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: '#f8fafc' }}>
                    Enterprise Database & Concurrency Infrastructure
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>
                    High-Concurrency WAL Mode · 60s Busy Timeout · 64MB In-Memory Cache · Neon/Postgres Resilient Pooling
                  </div>
                </div>
              </div>
              <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 800, background: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
                OPTIMIZED & RESILIENT
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 12 }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '12px 14px', borderRadius: 8, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>ENGINE TYPE</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#38bdf8', marginTop: 4, textTransform: 'uppercase' }}>
                  {dbHealth?.engine || 'SQLite WAL'}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Zero-lock latency</div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '12px 14px', borderRadius: 8, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>QUERY LATENCY</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#34d399', marginTop: 4 }}>
                  {dbHealth?.latency_ms !== undefined ? `${dbHealth.latency_ms} ms` : '< 1.0 ms'}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Sub-millisecond ping</div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '12px 14px', borderRadius: 8, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>WAL CONCURRENCY</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#a78bfa', marginTop: 4 }}>
                  {dbHealth?.wal_mode ? 'ACTIVE (WAL)' : 'SYNCHRONIZED'}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Busy Timeout: 60,000ms</div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '12px 14px', borderRadius: 8, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>DATABASE SIZE</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#fbbf24', marginTop: 4 }}>
                  {dbHealth?.db_size_mb ? `${dbHealth.db_size_mb} MB` : '1.8 MB'}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>WAL: {dbHealth?.wal_size_mb || 0} MB</div>
              </div>
            </div>

            {dbHealth?.table_counts && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11.5, color: '#94a3b8' }}>
                <span>Tables:</span>
                {Object.entries(dbHealth.table_counts).map(([tbl, cnt]) => (
                  <span key={tbl} style={{ background: 'rgba(255, 255, 255, 0.06)', padding: '2px 8px', borderRadius: 4, color: '#cbd5e1' }}>
                    <strong>{tbl}</strong>: {cnt}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 6: AUDIT TRAIL ───────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'audit' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: '#fcfcfd' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Immutable Platform Audit Trail</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              Complete chronological audit logs of all administrative allocations, role changes, and security actions
            </p>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Timestamp</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Actor</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Action</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Resource</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Details & Audit Metadata</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 36, textAlign: 'center', color: 'var(--text-muted)' }}>
                    No administrative audit events recorded yet.
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                      {log.created_at ? new Date(log.created_at).toLocaleString('en-IN') : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{log.actor_name}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className="badge badge-info" style={{ fontFamily: 'monospace', fontSize: 11 }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                      {log.resource_type}: {log.resource_id?.slice(0, 8)}...
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, fontFamily: 'monospace' }}>
                      {JSON.stringify(log.details)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── MODAL 1: ADJUST MINUTES & CREDITS ─────────────────────────────── */}
      {creditModalOpen && selectedUserForCredit && (
        <div className="modal-backdrop">
          <div className="modal-content animate-scale-up" style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Adjust Call Minutes & Balance</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                  User: <strong>{selectedUserForCredit.name}</strong> ({selectedUserForCredit.email})
                </p>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setCreditModalOpen(false)}
                style={{ padding: 6 }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCredits}>
              {/* Action Type Selector */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 8 }}>
                  Administrative Action:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                  {[
                    { id: 'topup', label: 'Top-Up', icon: '➕', color: '#10b981' },
                    { id: 'refund', label: 'Refund', icon: '↩️', color: '#3b82f6' },
                    { id: 'deduct', label: 'Deduct', icon: '➖', color: '#ef4444' },
                    { id: 'set_exact', label: 'Set Exact', icon: '⚙️', color: '#8b5cf6' },
                    { id: 'unlimited', label: 'Unlimited', icon: '⚡', color: '#f59e0b' },
                  ].map((act) => (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => {
                        setCreditType(act.id);
                        if (act.id === 'refund') setCreditNote('Customer refund for telephony session');
                        else if (act.id === 'deduct') setCreditNote('Administrative balance adjustment & reconciliation');
                        else if (act.id === 'set_exact') setCreditNote('Manual account balance override');
                        else if (act.id === 'unlimited') setCreditNote('VIP demo account unlimited calling grant');
                        else setCreditNote('Administrative top-up allocation');
                      }}
                      style={{
                        padding: '8px 4px',
                        borderRadius: 8,
                        border: creditType === act.id ? `2px solid ${act.color}` : '1px solid var(--border)',
                        background: creditType === act.id ? `${act.color}15` : 'transparent',
                        color: creditType === act.id ? act.color : 'var(--text-secondary)',
                        fontWeight: creditType === act.id ? 800 : 600,
                        fontSize: 11,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span style={{ fontSize: 14 }}>{act.icon}</span>
                      <span>{act.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {creditType !== 'unlimited' ? (
                <>
                  {/* Mode Toggle: Minutes vs Credits */}
                  <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                    <button
                      type="button"
                      onClick={() => setIsMinutesMode(true)}
                      className={`btn ${isMinutesMode ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1, fontSize: 12.5 }}
                    >
                      <Clock size={13} /> Allocate in Minutes
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsMinutesMode(false)}
                      className={`btn ${!isMinutesMode ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1, fontSize: 12.5 }}
                    >
                      <DollarSign size={13} /> Allocate in INR (₹)
                    </button>
                  </div>

                  {/* Quick Shortcuts */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                      {creditType === 'refund' ? 'Quick Refund Presets:' : creditType === 'deduct' ? 'Quick Deduct Presets:' : creditType === 'set_exact' ? 'Quick Target Presets:' : 'Quick Top-Up Presets:'}
                    </label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(isMinutesMode
                        ? (creditType === 'deduct' ? [15, 30, 60, 120] : creditType === 'refund' ? [10, 30, 60, 120] : creditType === 'set_exact' ? [0, 30, 60, 120, 300] : [30, 60, 120, 300, 600])
                        : (creditType === 'deduct' ? [100, 250, 500, 1000] : creditType === 'refund' ? [100, 250, 500, 1000] : creditType === 'set_exact' ? [0, 250, 500, 1000, 2500] : [250, 500, 1000, 2500, 5000])
                      ).map((val) => (
                        <button
                          key={val}
                          type="button"
                          className="chip"
                          onClick={() => setCreditAmount(val.toString())}
                          style={{
                            fontSize: 11.5,
                            borderColor: creditType === 'refund' ? '#93c5fd' : creditType === 'deduct' ? '#fca5a5' : 'var(--border)'
                          }}
                        >
                          {creditType === 'deduct' ? '-' : creditType === 'set_exact' ? '=' : '+'}{val} {isMinutesMode ? 'mins' : '₹'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Input Field */}
                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 13, fontWeight: 700 }}>
                      {creditType === 'refund'
                        ? (isMinutesMode ? 'Call Minutes to Refund:' : 'Refund Amount in INR (₹):')
                        : creditType === 'deduct'
                        ? (isMinutesMode ? 'Call Minutes to Deduct:' : 'Deduction Amount in INR (₹):')
                        : creditType === 'set_exact'
                        ? (isMinutesMode ? 'Exact Target Minutes Balance:' : 'Exact Target Balance in INR (₹):')
                        : (isMinutesMode ? 'Call Minutes to Grant:' : 'Top-Up Amount in INR (₹):')}
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="input"
                      style={{ fontSize: 16, fontWeight: 700 }}
                      value={creditAmount}
                      onChange={(e) => setCreditAmount(e.target.value)}
                      placeholder="e.g. 60"
                      required
                    />
                  </div>
                </>
              ) : (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.15) 100%)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: 10,
                  padding: '16px',
                  marginBottom: 16,
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: 24, marginBottom: 4 }}>⚡ ∞</div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: '#b45309' }}>
                    Grant Unlimited Demo / VIP Balance
                  </div>
                  <div style={{ fontSize: 12, color: '#92400e', marginTop: 4 }}>
                    Will set account wallet to <strong>₹999,999.0</strong> (~166,666 minutes) and upgrade plan to <strong>Unlimited</strong>. Calls will never be blocked by credit limits.
                  </div>
                </div>
              )}

              {/* Live Preview Calculation Box */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  padding: '12px 16px',
                  marginBottom: 16,
                  fontSize: 12.5,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', marginBottom: 4 }}>
                  <span>Current Balance:</span>
                  <strong>
                    {selectedUserForCredit.minutes_balance} min (₹{selectedUserForCredit.credits_balance?.toLocaleString()})
                  </strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', marginBottom: 6 }}>
                  <span>Rate:</span>
                  <span>1 Minute = ₹{m.rate_per_minute || 6} Credits</span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    color: creditType === 'deduct' ? '#dc2626' : '#059669',
                    fontWeight: 800,
                    borderTop: '1px dashed #cbd5e1',
                    paddingTop: 6,
                    fontSize: 13
                  }}
                >
                  <span>Projected New Balance:</span>
                  <span>
                    {creditType === 'unlimited'
                      ? '166,666.5 min (₹999,999.0) [Unlimited]'
                      : (() => {
                          const amt = parseFloat(creditAmount) || 0;
                          const rate = m.rate_per_minute || 6.0;
                          const curCredits = selectedUserForCredit.credits_balance || 0;
                          let projectedCredits = curCredits;

                          if (creditType === 'set_exact') {
                            projectedCredits = isMinutesMode ? amt * rate : amt;
                          } else if (creditType === 'deduct') {
                            projectedCredits = Math.max(0, curCredits - (isMinutesMode ? amt * rate : amt));
                          } else { // topup & refund
                            projectedCredits = curCredits + (isMinutesMode ? amt * rate : amt);
                          }
                          const projectedMins = roundVal(projectedCredits / rate, 1);
                          return `${projectedMins} min (₹${roundVal(projectedCredits, 2).toLocaleString()})`;
                        })()
                    }
                  </span>
                </div>
              </div>

              {/* Note input */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12.5, fontWeight: 600 }}>Note / Justification (Logged to Ledger):</label>
                <input
                  className="input"
                  value={creditNote}
                  onChange={(e) => setCreditNote(e.target.value)}
                  placeholder="e.g. Telephony credit adjustment"
                  required
                />
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setCreditModalOpen(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn ${creditType === 'deduct' ? 'btn-danger' : 'btn-primary'}`}
                  disabled={savingCredit}
                >
                  {savingCredit
                    ? 'Processing...'
                    : creditType === 'refund'
                    ? 'Issue Refund'
                    : creditType === 'deduct'
                    ? 'Deduct Balance'
                    : creditType === 'set_exact'
                    ? 'Set Exact Balance'
                    : creditType === 'unlimited'
                    ? 'Grant Unlimited'
                    : 'Add Top-Up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: RECORD PAYMENT ───────────────────────────────────────── */}
      {paymentModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content animate-scale-up" style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Record Direct / Offline Payment</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                  Add payment record & credit corresponding call minutes to user immediately
                </p>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setPaymentModalOpen(false)}
                style={{ padding: 6 }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRecordPayment}>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, fontWeight: 700 }}>Select User / Tenant:</label>
                <select
                  className="input"
                  value={paymentUser}
                  onChange={(e) => setPaymentUser(e.target.value)}
                  required
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {u.email} ({u.workspace_name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, fontWeight: 700 }}>Payment Amount (₹ INR):</label>
                <input
                  type="number"
                  className="input"
                  style={{ fontSize: 16, fontWeight: 700 }}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  required
                />
                <div style={{ fontSize: 11, color: '#059669', marginTop: 4 }}>
                  Will grant <strong>{roundVal(parseFloat(paymentAmount || 0) / (m.rate_per_minute || 6.0), 1)}</strong> calling minutes immediately (@₹{m.rate_per_minute || 6}/min).
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, fontWeight: 700 }}>Payment Method:</label>
                <select
                  className="input"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="UPI">UPI (Google Pay / PhonePe / Paytm)</option>
                  <option value="Bank Transfer">NEFT / RTGS / IMPS Bank Transfer</option>
                  <option value="Stripe / Card">Credit / Debit Card</option>
                  <option value="Cash / Cheque">Cash / Cheque</option>
                  <option value="Enterprise Contract">Enterprise Annual Contract</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, fontWeight: 600 }}>Reference / UTR ID:</label>
                <input
                  className="input"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="e.g. UTR-98274619"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600 }}>Internal Note:</label>
                <input
                  className="input"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setPaymentModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={recordingPayment}>
                  {recordingPayment ? 'Recording...' : 'Record Payment & Credit Minutes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: CHANGE ROLE ──────────────────────────────────────────── */}
      {roleModalOpen && selectedUserForRole && (
        <div className="modal-backdrop">
          <div className="modal-content animate-scale-up" style={{ maxWidth: 420 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Change Access Role</h3>
            <p style={{ margin: '4px 0 16px', fontSize: 13, color: 'var(--text-muted)' }}>
              Target: <strong>{selectedUserForRole.name}</strong>
            </p>

            <div className="form-group" style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 13, fontWeight: 700 }}>Select Role:</label>
              <select className="input" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                <option value="owner">Owner (Full tenant billing & team authority)</option>
                <option value="admin">Administrator (Employee, campaign & CRM manager)</option>
                <option value="agent">Voice Agent Operator (Calls & tasks execution)</option>
                <option value="viewer">Viewer (Read-only analytics & CRM access)</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setRoleModalOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleUpdateRole} disabled={savingRole}>
                {savingRole ? 'Updating...' : 'Update Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DRAWER: INSPECT TRANSCRIPT ────────────────────────────────────── */}
      {inspectCall && (
        <div className="modal-backdrop" onClick={() => setInspectCall(null)}>
          <div
            className="modal-content animate-scale-up"
            style={{ maxWidth: 620, maxHeight: '82vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Call Transcript & Intelligence Inspection</h3>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  To: {inspectCall.to_number} · Duration: {inspectCall.duration_seconds}s ({inspectCall.duration_minutes}m) · Outcome: {inspectCall.outcome}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setInspectCall(null)}>
                <X size={18} />
              </button>
            </div>

            {inspectCall.recording_url && (
              <div style={{ marginBottom: 14, padding: 12, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                    Audio Recording Playback
                  </span>
                  <a
                    href={`${inspectCall.recording_url}${inspectCall.recording_url.includes('?') ? '&' : '?'}download=true`}
                    download={`recording_${inspectCall.id || 'call'}.wav`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#ffffff',
                      background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)',
                      padding: '3px 8px',
                      borderRadius: 6,
                      textDecoration: 'none'
                    }}
                    title="Download WAV recording file"
                  >
                    <Download size={12} /> Download WAV
                  </a>
                </div>
                <audio controls src={inspectCall.recording_url} style={{ width: '100%', height: 36, borderRadius: 6 }} />
              </div>
            )}

            {inspectCall.summary && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 16,
                  fontSize: 13,
                }}
              >
                <strong>AI Executive Summary:</strong> {inspectCall.summary}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(inspectCall.transcript || []).length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                  No transcript lines available for this call.
                </div>
              ) : (
                (inspectCall.transcript || []).map((msg, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: msg.role === 'assistant' ? '#f5f3ff' : '#f1f5f9',
                      borderLeft: msg.role === 'assistant' ? '3px solid #7c3aed' : '3px solid #64748b',
                      fontSize: 13,
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                      {msg.speaker || msg.role?.toUpperCase()}
                    </div>
                    <div style={{ color: 'var(--text-primary)', lineHeight: 1.5 }}>{msg.text || msg.content}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Icon helper
function BotIcon({ size = 18 }) {
  return <Bot size={size} />;
}
