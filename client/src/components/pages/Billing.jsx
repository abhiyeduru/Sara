import React, { useState, useEffect } from 'react';
import {
  CreditCard, Zap, TrendingUp, BarChart3, Download, Plus, CheckCircle2,
  RefreshCw, DollarSign, X
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, XAxis, Tooltip } from 'recharts';

const PLANS = [
  { id: 'starter', name: 'Starter', price: '₹4,999/mo', features: ['3 AI Employees', '1,000 AI calls/mo', 'Basic CRM', 'Email support'] },
  { id: 'growth', name: 'Growth', price: '₹14,999/mo', features: ['10 AI Employees', '5,000 AI calls/mo', 'Full CRM', 'WhatsApp Integration', 'Priority support'] },
  { id: 'enterprise', name: 'Enterprise', price: 'Custom', features: ['Unlimited AI Employees', 'Unlimited voice calls', 'Custom MCP integrations', 'Dedicated account manager', '99.9% SLA'] },
];

export default function Billing({ onNavigate }) {
  const [account, setAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [usageEvents, setUsageEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [topupAmount, setTopupAmount] = useState(2500);
  const [submittingTopup, setSubmittingTopup] = useState(false);
  const [callLimitMinutes, setCallLimitMinutes] = useState(10);
  const [updatingLimit, setUpdatingLimit] = useState(false);
  const [limitSavedMsg, setLimitSavedMsg] = useState('');

  const fetchBillingData = async () => {
    setLoading(true);
    try {
      const [accRes, txnRes, usageRes] = await Promise.all([
        fetch('/api/v1/billing/balance'),
        fetch('/api/v1/billing/transactions?limit=20'),
        fetch('/api/v1/billing/usage?limit=30'),
      ]);

      if (accRes.ok) {
        const accData = await accRes.json();
        setAccount(accData);
        if (accData.call_limit_minutes) {
          setCallLimitMinutes(accData.call_limit_minutes);
        }
      }

      if (txnRes.ok) {
        const txnData = await txnRes.json();
        setTransactions(txnData.data || []);
      }

      if (usageRes.ok) {
        const uData = await usageRes.json();
        setUsageEvents(uData.data || []);
      }
    } catch (err) {
      console.error('Error fetching billing data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingData();
  }, []);

  const handleTopup = async (e) => {
    e.preventDefault();
    if (topupAmount <= 0) return;
    setSubmittingTopup(true);
    try {
      const res = await fetch('/api/v1/billing/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(topupAmount) }),
      });
      if (res.ok) {
        setShowTopupModal(false);
        await fetchBillingData();
      }
    } catch (err) {
      console.error('Error topping up:', err);
    } finally {
      setSubmittingTopup(false);
    }
  };

  const handleUpdateCallLimit = async (mins) => {
    setUpdatingLimit(true);
    try {
      const res = await fetch('/api/v1/billing/limits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes: Number(mins) }),
      });
      if (res.ok) {
        const d = await res.json();
        setCallLimitMinutes(d.call_limit_minutes);
        setLimitSavedMsg(`Call duration limit set to ${d.call_limit_minutes} minutes!`);
        setTimeout(() => setLimitSavedMsg(''), 3500);
      }
    } catch (err) {
      console.error('Failed to set call limit:', err);
    } finally {
      setUpdatingLimit(false);
    }
  };

  const balance = account?.balance || 0;
  const totalPurchased = account?.total_purchased || balance;
  const totalConsumed = account?.total_consumed || 0;
  const currentPlan = account?.plan || 'growth';

  // Construct chart data dynamically from usage events or transactions
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayBuckets = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayName = daysOfWeek[d.getDay()];
    dayBuckets[dayName] = 0;
  }

  usageEvents.forEach((ev) => {
    if (ev.created_at) {
      const dayName = daysOfWeek[new Date(ev.created_at).getDay()];
      if (dayBuckets[dayName] !== undefined) {
        dayBuckets[dayName] += Number(ev.total_cost || 0);
      }
    }
  });

  const chartData = Object.entries(dayBuckets).map(([day, credits]) => ({
    day,
    credits: Math.round(credits),
  }));

  const usagePercent = totalPurchased > 0 ? Math.min(100, Math.round((totalConsumed / totalPurchased) * 100)) : 0;

  return (
    <div className="page-content animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans' }}>Billing & Credits</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-muted)' }}>Manage subscription, credit balance, and telephony consumption</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={fetchBillingData} title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button className="btn btn-primary" onClick={() => setShowTopupModal(true)}>
            <Plus size={14} />
            Top Up Credits
          </button>
        </div>
      </div>

      {/* Balance Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Credit Balance', value: `₹${Number(balance).toLocaleString('en-IN')}`, sub: 'Ready for calls & AI tasks', color: '#7c3aed', bg: '#f5f3ff', icon: Zap },
          { label: 'Total Consumed', value: `₹${Number(totalConsumed).toLocaleString('en-IN')}`, sub: 'Telephony & model usage', color: '#ea580c', bg: '#fff7ed', icon: CreditCard },
          { label: 'Total Purchased', value: `₹${Number(totalPurchased).toLocaleString('en-IN')}`, sub: `${currentPlan.toUpperCase()} tier`, color: '#0284c7', bg: '#eff6ff', icon: BarChart3 },
          { label: 'Active Plan', value: currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1), sub: 'Auto-recharge enabled', color: '#16a34a', bg: '#f0fdf4', icon: TrendingUp },
        ].map(({ label, value, sub, color, bg, icon: Icon }) => (
          <div key={label} className="kpi-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, background: bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Icon size={16} color={color} />
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)' }}>{value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
            <div style={{ fontSize: 11, color, marginTop: 3, fontWeight: 600 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Telephony Rate & Call Duration Limits Card */}
      <div className="card" style={{ padding: '18px 22px', marginBottom: 24, background: 'linear-gradient(135deg, #ffffff 0%, #faf5ff 100%)', border: '1px solid #e9d5ff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1e1b4b' }}>
                Telephony Billing & Call Duration Limits
              </h3>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
                ₹{account?.rate_per_minute || 6.0}/min Direct Wallet Deduction
              </span>
            </div>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
              Enforces a strict per-minute calling rate of ₹6.00 with configurable 5–10 minute auto-cutoff.
            </p>
          </div>

          {limitSavedMsg && (
            <div style={{ padding: '6px 14px', borderRadius: 8, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', fontSize: 12, fontWeight: 700 }}>
              ✓ {limitSavedMsg}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, alignItems: 'center' }}>
          <div style={{ background: '#fff', padding: '12px 16px', borderRadius: 10, border: '1px solid #ede9fe' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Available Calling Minutes
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#7c3aed', marginTop: 2 }}>
              {Math.floor((account?.balance || 0) / (account?.rate_per_minute || 6.0))} <span style={{ fontSize: 13, fontWeight: 600, color: '#6b7280' }}>mins</span>
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
              Calculated as ₹{Number(account?.balance || 0).toLocaleString('en-IN')} ÷ ₹{account?.rate_per_minute || 6}/min (min ₹6 required per call)
            </div>
          </div>

          <div style={{ background: '#fff', padding: '12px 16px', borderRadius: 10, border: '1px solid #ede9fe' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Max Call Duration Setting
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed' }}>
                Current: {callLimitMinutes} min {updatingLimit && '(Saving...)'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[5, 6, 7, 8, 9, 10].map((m) => {
                const isActive = callLimitMinutes === m;
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={updatingLimit}
                    onClick={() => handleUpdateCallLimit(m)}
                    style={{
                      flex: 1,
                      minWidth: 42,
                      padding: '6px 8px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      border: isActive ? '1px solid #7c3aed' : '1px solid #e5e7eb',
                      background: isActive ? '#7c3aed' : '#f9fafb',
                      color: isActive ? '#fff' : '#374151',
                      boxShadow: isActive ? '0 2px 6px rgba(124,58,237,0.25)' : 'none',
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
        {/* Usage Chart */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div className="section-heading">Credit Consumption</div>
              <div className="section-sub">Expenditure over the last 7 days</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowTopupModal(true)}>
              <Plus size={12} />Top Up Credits
            </button>
          </div>

          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="cred" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <Area type="monotone" dataKey="credits" stroke="#7c3aed" strokeWidth={2} fill="url(#cred)" />
            </AreaChart>
          </ResponsiveContainer>

          {/* Usage bar */}
          <div style={{ marginTop: 16, padding: '12px', background: 'var(--surface-soft)', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Consumption against purchased credits</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed' }}>
                ₹{Number(totalConsumed).toLocaleString('en-IN')} / ₹{Number(totalPurchased).toLocaleString('en-IN')} ({usagePercent}%)
              </span>
            </div>
            <div className="progress-bar" style={{ height: 8 }}>
              <div className="progress-fill" style={{ width: `${usagePercent}%` }} />
            </div>
          </div>
        </div>

        {/* Transactions */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="section-heading" style={{ fontSize: 14 }}>Transactions</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{transactions.length} entries</span>
          </div>

          {transactions.length === 0 ? (
            <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No credit transactions recorded yet.
            </div>
          ) : (
            <div style={{ maxHeight: 250, overflowY: 'auto' }}>
              {transactions.map((t) => {
                const isTopup = t.type === 'topup' || t.amount > 0;
                return (
                  <div key={t.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: isTopup ? '#dcfce7' : '#eff6ff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {isTopup ? <Plus size={14} color="#16a34a" /> : <Zap size={14} color="#0284c7" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {t.description || (isTopup ? 'Credit top-up' : 'Usage deduction')}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {t.created_at ? new Date(t.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Recent'}
                      </div>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 13, color: isTopup ? '#16a34a' : 'var(--text-primary)' }}>
                      {isTopup ? '+' : '-'}₹{Math.abs(Number(t.amount || 0)).toLocaleString('en-IN')}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Plans */}
      <div>
        <div className="section-heading" style={{ marginBottom: 16 }}>Available Plans</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {PLANS.map((plan) => {
            const isCurrent = plan.id === currentPlan;
            return (
              <div key={plan.name} className="card" style={{
                padding: 24,
                border: isCurrent ? '2px solid #7c3aed' : '1px solid var(--border)',
                background: isCurrent ? '#fafaff' : '#fff'
              }}>
                {isCurrent && <div style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', marginBottom: 8 }}>✦ ACTIVE WORKSPACE PLAN</div>}
                <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-primary)', marginBottom: 4 }}>{plan.name}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#7c3aed', marginBottom: 16 }}>{plan.price}</div>
                <div style={{ marginBottom: 20 }}>
                  {plan.features.map((f) => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <CheckCircle2 size={14} color="#16a34a" />
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{f}</span>
                    </div>
                  ))}
                </div>
                <button
                  className={`btn ${isCurrent ? 'btn-secondary' : 'btn-primary'}`}
                  style={{ width: '100%', justifyContent: 'center' }}
                  disabled={isCurrent}
                >
                  {isCurrent ? 'Current Plan' : plan.price === 'Custom' ? 'Contact Sales' : 'Switch Plan'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Topup Modal */}
      {showTopupModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 440, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={18} color="#7c3aed" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Top Up Sara Credits</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Instant balance recharge for AI voice & tasks</div>
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowTopupModal(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleTopup}>
              <div style={{ marginBottom: 16 }}>
                <label className="label">Select Top-Up Amount</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                  {[1000, 2500, 5000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      className={`btn ${topupAmount === amt ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ justifyContent: 'center', fontSize: 13 }}
                      onClick={() => setTopupAmount(amt)}
                    >
                      ₹{amt.toLocaleString('en-IN')}
                    </button>
                  ))}
                </div>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: 10, color: 'var(--text-muted)', fontWeight: 600 }}>₹</span>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    className="input"
                    style={{ paddingLeft: 28 }}
                    value={topupAmount}
                    onChange={(e) => setTopupAmount(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div style={{ padding: 12, background: 'var(--surface-soft)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
                Voice calls are billed directly at <strong>₹6.00 / minute</strong> with a configurable <strong>5–10 minute</strong> duration limit and 30s auto-warning.
                <div style={{ marginTop: 4, color: '#059669', fontWeight: 600 }}>
                  This top-up will provide approximately <strong>{Math.floor(topupAmount / 6)}</strong> calling minutes.
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowTopupModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submittingTopup}>
                  {submittingTopup ? 'Processing...' : `Confirm Top-Up (₹${topupAmount.toLocaleString('en-IN')})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
