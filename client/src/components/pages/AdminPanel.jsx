import React, { useState, useEffect } from 'react';
import {
  Shield, ShieldCheck, Users, UserCheck, CreditCard, Clock, Phone,
  Activity, CheckCircle2, AlertCircle, RefreshCw, Plus, Search, Filter,
  ArrowUpRight, Zap, Settings, DollarSign, Layers, Lock, Unlock,
  Sliders, Eye, Cpu, FileText, Sparkles, Building2, ChevronRight, X
} from 'lucide-react';

export default function AdminPanel({ onNavigate }) {
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'minutes' | 'calls' | 'engines' | 'audit'
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [calls, setCalls] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

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

  const showToast = (msg, type = 'success') => {
    setToastMsg({ msg, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, txnsRes, callsRes, auditRes] = await Promise.all([
        fetch('/api/v1/admin/stats'),
        fetch('/api/v1/admin/users'),
        fetch('/api/v1/admin/payments'),
        fetch('/api/v1/admin/calls'),
        fetch('/api/v1/admin/audit-logs'),
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

  // Handle Credit / Minutes Allocation
  const handleSaveCredits = async (e) => {
    e.preventDefault();
    if (!selectedUserForCredit || !creditAmount) return;

    setSavingCredit(true);
    try {
      const numAmount = parseFloat(creditAmount);
      const res = await fetch(`/api/v1/admin/users/${selectedUserForCredit.id}/credits`, {
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
          `Synced: ${numAmount} ${isMinutesMode ? 'minutes' : 'credits'} granted to ${selectedUserForCredit.name}! New balance: ${data.new_minutes_balance} min (₹${data.new_credit_balance})`
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
      const res = await fetch('/api/v1/admin/payments/record', {
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
      const res = await fetch(`/api/v1/admin/users/${selectedUserForRole.id}/role`, {
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
      const res = await fetch(`/api/v1/admin/users/${user.id}/status`, {
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
    total_calls: 0,
    total_call_minutes: 0,
    total_credits_balance: 0,
    total_minutes_available: 0,
    total_credits_purchased: 0,
    rate_per_minute: 6.0,
  };

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
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          <Sparkles size={16} />
          {toastMsg.msg}
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(124, 58, 237, 0.3)',
              }}
            >
              <Shield size={20} color="#fff" />
            </div>
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  fontFamily: 'Plus Jakarta Sans',
                }}
              >
                Admin & Platform Control Center
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                Multi-tenant governance, live calling minutes, financial ledger, and real-time sync
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 20,
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              fontSize: 12,
              fontWeight: 700,
              color: '#065f46',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 0 3px rgba(16,185,129,0.3)',
              }}
            />
            Platform Live & Operational
          </div>

          <button className="btn btn-secondary" onClick={fetchAdminData}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Sync All Data
          </button>

          <button
            className="btn btn-primary"
            onClick={() => {
              if (users.length > 0) setPaymentUser(users[0].id);
              setPaymentModalOpen(true);
            }}
          >
            <DollarSign size={14} /> Record Payment
          </button>
        </div>
      </div>

      {/* Top High-Impact KPI Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 14,
          marginBottom: 24,
        }}
      >
        <div className="card" style={{ padding: '16px 18px', borderLeft: '4px solid #7c3aed' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Total Registered Users</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
                {m.total_users}
              </div>
            </div>
            <div style={{ padding: 8, borderRadius: 8, background: '#f5f3ff', color: '#7c3aed' }}>
              <Users size={18} />
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Across {m.total_workspaces} isolated workspaces</div>
        </div>

        <div className="card" style={{ padding: '16px 18px', borderLeft: '4px solid #0284c7' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Available Call Minutes</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#0284c7', marginTop: 4 }}>
                {m.total_minutes_available.toLocaleString()} <span style={{ fontSize: 13, fontWeight: 600 }}>min</span>
              </div>
            </div>
            <div style={{ padding: 8, borderRadius: 8, background: '#eff6ff', color: '#0284c7' }}>
              <Clock size={18} />
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
            Total Credits: ₹{m.total_credits_balance.toLocaleString()} (@₹{m.rate_per_minute}/min)
          </div>
        </div>

        <div className="card" style={{ padding: '16px 18px', borderLeft: '4px solid #16a34a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Platform Top-up Revenue</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#16a34a', marginTop: 4 }}>
                ₹{m.total_credits_purchased.toLocaleString()}
              </div>
            </div>
            <div style={{ padding: 8, borderRadius: 8, background: '#f0fdf4', color: '#16a34a' }}>
              <DollarSign size={18} />
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
            Total Consumed: ₹{m.total_credits_consumed.toLocaleString()}
          </div>
        </div>

        <div className="card" style={{ padding: '16px 18px', borderLeft: '4px solid #ea580c' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Total Telephony Calls</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
                {m.total_calls}
              </div>
            </div>
            <div style={{ padding: 8, borderRadius: 8, background: '#fff7ed', color: '#ea580c' }}>
              <Phone size={18} />
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
            {m.total_call_minutes} spoken minutes across all tenants
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          gap: 20,
          marginBottom: 20,
        }}
      >
        {[
          { id: 'users', label: `Users & Tenants (${users.length})`, icon: Users },
          { id: 'minutes', label: `Minutes & Payments (${transactions.length})`, icon: CreditCard },
          { id: 'calls', label: `System Calls (${calls.length})`, icon: Phone },
          { id: 'engines', label: 'Telephony & AI Engines', icon: Cpu },
          { id: 'audit', label: 'Audit Trail', icon: Activity },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            style={{
              padding: '10px 4px 14px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === id ? '2px solid #7c3aed' : '2px solid transparent',
              color: activeTab === id ? '#7c3aed' : 'var(--text-muted)',
              fontWeight: activeTab === id ? 700 : 500,
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.15s ease',
            }}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: USERS & TENANTS ────────────────────────────────────────── */}
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
                          Consumed: {round((u.total_credits_consumed || 0) / (m.rate_per_minute || 6.0), 1)}m
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

      {/* ── TAB 2: MINUTES & PAYMENTS HUB ───────────────────────────────── */}
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
                        ₹{t.balance_after?.toLocaleString()} ({round(t.balance_after / (m.rate_per_minute || 6.0), 1)}m)
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

      {/* ── TAB 3: SYSTEM CALLS ─────────────────────────────────────────── */}
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
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Transcript</th>
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
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setInspectCall(c)}
                        disabled={c.transcript_count === 0}
                      >
                        <FileText size={12} /> {c.transcript_count} lines
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TAB 4: TELEPHONY & ENGINE HEALTH ────────────────────────────── */}
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

                {key === 'twilio' && (
                  <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, fontSize: 12 }}>
                    <div>
                      <strong>Assigned Phone:</strong> {prov.phone_number}
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <strong>Twilio SID:</strong> {prov.account_sid_masked}
                    </div>
                  </div>
                )}

                {key === 'sarvam' && (
                  <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, fontSize: 12 }}>
                    <strong>Capabilities:</strong> Real-time Telugu STT, natural prosody Hindi & Indian English TTS.
                  </div>
                )}

                {key === 'cartesia' && (
                  <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, fontSize: 12 }}>
                    <strong>Capabilities:</strong> Sonic 100ms ultra-low latency streaming voice engine.
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {/* ── TAB 5: AUDIT TRAIL ───────────────────────────────────────────── */}
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
              {/* Mode Toggle */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <button
                  type="button"
                  onClick={() => setIsMinutesMode(true)}
                  className={`btn ${isMinutesMode ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, fontSize: 13 }}
                >
                  <Clock size={14} /> Allocate in Minutes
                </button>
                <button
                  type="button"
                  onClick={() => setIsMinutesMode(false)}
                  className={`btn ${!isMinutesMode ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, fontSize: 13 }}
                >
                  <DollarSign size={14} /> Allocate in Credits (₹)
                </button>
              </div>

              {/* Quick Chips */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  Quick Shortcuts:
                </label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(isMinutesMode ? [30, 60, 120, 300, 600] : [250, 500, 1000, 2500]).map((val) => (
                    <button
                      key={val}
                      type="button"
                      className="chip"
                      onClick={() => setCreditAmount(val.toString())}
                      style={{ fontSize: 12 }}
                    >
                      +{val} {isMinutesMode ? 'mins' : '₹'}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="chip"
                    onClick={() => setCreditAmount((-30).toString())}
                    style={{ fontSize: 12, color: '#dc2626', borderColor: '#fca5a5' }}
                  >
                    -30 {isMinutesMode ? 'mins' : '₹'}
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, fontWeight: 700 }}>
                  {isMinutesMode ? 'Call Minutes to Grant / Deduct:' : 'Credit Amount in INR (₹):'}
                </label>
                <input
                  type="number"
                  step="any"
                  className="input"
                  style={{ fontSize: 16, fontWeight: 700 }}
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  placeholder="e.g. 60"
                  required
                />
              </div>

              {/* Live Preview Box */}
              <div
                style={{
                  background: '#f5f3ff',
                  border: '1px solid #ddd6fe',
                  borderRadius: 8,
                  padding: '12px 16px',
                  marginBottom: 16,
                  fontSize: 13,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#5b21b6' }}>
                  <span>Current Balance:</span>
                  <strong>
                    {selectedUserForCredit.minutes_balance} min (₹{selectedUserForCredit.credits_balance})
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#7c3aed', marginTop: 4 }}>
                  <span>Converted Rate:</span>
                  <span>1 Minute = ₹{m.rate_per_minute || 6} Credits</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    color: '#065f46',
                    fontWeight: 700,
                    marginTop: 6,
                    borderTop: '1px dashed #c4b5fd',
                    paddingTop: 6,
                  }}
                >
                  <span>Projected Balance:</span>
                  <span>
                    {isMinutesMode
                      ? `${selectedUserForCredit.minutes_balance + (parseFloat(creditAmount) || 0)} min (₹${
                          selectedUserForCredit.credits_balance + (parseFloat(creditAmount) || 0) * (m.rate_per_minute || 6.0)
                        })`
                      : `${round(
                          (selectedUserForCredit.credits_balance + (parseFloat(creditAmount) || 0)) / (m.rate_per_minute || 6.0),
                          1
                        )} min (₹${selectedUserForCredit.credits_balance + (parseFloat(creditAmount) || 0)})`}
                  </span>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600 }}>Note / Justification:</label>
                <input
                  className="input"
                  value={creditNote}
                  onChange={(e) => setCreditNote(e.target.value)}
                  placeholder="e.g. Promotional launch bundle"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setCreditModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingCredit}>
                  {savingCredit ? 'Synchronizing...' : 'Save & Sync to User'}
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
                  Will grant <strong>{round(parseFloat(paymentAmount || 0) / (m.rate_per_minute || 6.0), 1)}</strong> calling minutes immediately (@₹{m.rate_per_minute || 6}/min).
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
            style={{ maxWidth: 600, maxHeight: '80vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Call Transcript Inspection</h3>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  To: {inspectCall.to_number} · Duration: {inspectCall.duration_seconds}s · Outcome: {inspectCall.outcome}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setInspectCall(null)}>
                <X size={18} />
              </button>
            </div>

            {inspectCall.summary && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 16,
                  fontSize: 13,
                }}
              >
                <strong>AI Executive Summary:</strong> {inspectCall.summary}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(inspectCall.transcript || []).map((msg, i) => (
                <div
                  key={i}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: msg.role === 'assistant' ? '#f5f3ff' : '#f1f5f9',
                    borderLeft: msg.role === 'assistant' ? '3px solid #7c3aed' : '3px solid #64748b',
                    fontSize: 13,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                    {msg.speaker || msg.role?.toUpperCase()}
                  </div>
                  <div style={{ color: 'var(--text-primary)' }}>{msg.text || msg.content}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function round(val, decimals = 1) {
  if (isNaN(val)) return 0;
  return Number(Math.round(val + 'e' + decimals) + 'e-' + decimals);
}
