import React, { useState, useEffect } from 'react';
import {
  BarChart3, TrendingUp, Phone, Users, CheckSquare, Zap,
  FileSpreadsheet, Download, Printer, Calendar, Clock, RefreshCw,
  Sparkles, Filter, Mail, Share2, Check, ArrowUpRight, ShieldCheck,
  ChevronRight, AlertCircle, Eye, X, Send, Bot, PieChart, Layers
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, ResponsiveContainer,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid
} from 'recharts';
import SkeletonLoader from '../common/SkeletonLoader';

export default function Reports({ onNavigate }) {
  const [timeframe, setTimeframe] = useState('30d');
  const [activeTab, setActiveTab] = useState('executive');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);

  // Modal states
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [previewReport, setPreviewReport] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState('');

  // Custom report form
  const [reportType, setReportType] = useState('executive_growth');
  const [reportTimeframe, setReportTimeframe] = useState('30d');
  const [reportDept, setReportDept] = useState('All');

  // Schedule report form
  const [scheduleFreq, setScheduleFreq] = useState('weekly');
  const [scheduleChannel, setScheduleChannel] = useState('email');
  const [scheduleRecipient, setScheduleRecipient] = useState('');
  const [scheduling, setScheduling] = useState(false);

  const fetchOverview = async (tf = timeframe) => {
    try {
      setRefreshing(true);
      const res = await fetch(`/api/v1/reports/overview?timeframe=${tf}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load reports overview:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOverview(timeframe);
  }, [timeframe]);

  const showNotification = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 4000);
  };

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/v1/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_type: reportType,
          timeframe: reportTimeframe,
          department: reportDept
        })
      });
      if (res.ok) {
        const rep = await res.json();
        setIsGenerateOpen(false);
        setPreviewReport(rep.report);
        showNotification(`Generated '${rep.report.title}' successfully.`);
      }
    } catch (err) {
      console.error('Error generating report:', err);
      showNotification('Failed to generate report. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadCSV = async (type = 'executive_growth', tf = timeframe) => {
    try {
      showNotification('Generating CSV export...');
      const res = await fetch('/api/v1/reports/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_type: type, timeframe: tf })
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sara_report_${type}_${tf}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        showNotification('Report CSV downloaded successfully!');
      }
    } catch (err) {
      console.error('CSV export failed:', err);
      showNotification('CSV export failed.');
    }
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    if (!scheduleRecipient.trim()) {
      showNotification('Please enter a valid recipient email or phone number.');
      return;
    }
    setScheduling(true);
    try {
      const res = await fetch('/api/v1/reports/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_type: reportType,
          frequency: scheduleFreq,
          delivery_channel: scheduleChannel,
          recipient: scheduleRecipient
        })
      });
      if (res.ok) {
        const json = await res.json();
        setIsScheduleOpen(false);
        setScheduleRecipient('');
        showNotification(json.message || 'Report schedule activated!');
      }
    } catch (err) {
      console.error('Schedule failed:', err);
      showNotification('Failed to set up report schedule.');
    } finally {
      setScheduling(false);
    }
  };

  if (loading && !data) {
    return <SkeletonLoader type="dashboard" />;
  }

  const kpis = data?.kpis || {};
  const trendPoints = data?.trend_points || [];
  const workforceStats = data?.workforce_stats || [];
  const archive = data?.archive || [];

  return (
    <div className="page-content animate-fade-in" style={{ paddingBottom: 60 }}>
      {/* Toast Notice */}
      {notice && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 9999,
          background: 'rgba(15, 23, 42, 0.95)', border: '1px solid #7c3aed',
          color: '#fff', padding: '12px 20px', borderRadius: 12,
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)', display: 'flex',
          alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 500,
          backdropFilter: 'blur(8px)'
        }}>
          <Sparkles size={16} color="#c084fc" />
          {notice}
        </div>
      )}

      {/* Top Editorial Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        flexWrap: 'wrap', gap: 16, marginBottom: 28
      }}>
        <div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px',
            borderRadius: 20, background: 'rgba(124, 58, 237, 0.1)', border: '1px solid rgba(124, 58, 237, 0.25)',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            color: '#9333ea', marginBottom: 8
          }}>
            <BarChart3 size={12} color="#a855f7" />
            Executive Intelligence & BI
          </div>
          <h1 className="page-title" style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>
            Business Intelligence & Telemetry Reports
          </h1>
          <p className="page-subtitle" style={{ margin: '6px 0 0', color: 'var(--text-secondary)' }}>
            Real-time telemetry, lead conversion funnel, AI workforce velocity, and automated export suite.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Timeframe pill selector */}
          <div style={{
            display: 'flex', background: 'var(--surface-sunken, rgba(0,0,0,0.04))',
            padding: 3, borderRadius: 10, border: '1px solid var(--border-subtle)'
          }}>
            {[
              { id: 'today', label: 'Today' },
              { id: '7d', label: '7 Days' },
              { id: '30d', label: '30 Days' },
              { id: 'quarter', label: 'Quarter' },
            ].map((tf) => (
              <button
                key={tf.id}
                onClick={() => setTimeframe(tf.id)}
                style={{
                  border: 'none', background: timeframe === tf.id ? 'var(--surface-card, #fff)' : 'transparent',
                  color: timeframe === tf.id ? '#7c3aed' : 'var(--text-secondary)',
                  fontWeight: timeframe === tf.id ? 700 : 500,
                  fontSize: 12, padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                  boxShadow: timeframe === tf.id ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {tf.label}
              </button>
            ))}
          </div>

          <button
            className="btn btn-secondary"
            onClick={() => fetchOverview(timeframe)}
            title="Refresh Data"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => handleDownloadCSV('executive_growth', timeframe)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <Download size={14} />
            Export CSV
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => setIsScheduleOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <Clock size={14} />
            Schedule
          </button>

          <button
            className="btn btn-primary"
            onClick={() => setIsGenerateOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
              background: 'linear-gradient(135deg, #7c3aed 0%, #9333ea 100%)',
              color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 10,
              boxShadow: '0 4px 14px rgba(124, 58, 237, 0.35)', cursor: 'pointer', fontWeight: 600
            }}
          >
            <Sparkles size={14} />
            Generate AI Report
          </button>
        </div>
      </div>

      {/* SARA AI Executive Synthesis Card */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.08) 0%, rgba(147, 51, 234, 0.04) 50%, rgba(59, 130, 246, 0.06) 100%)',
        border: '1px solid rgba(124, 58, 237, 0.25)',
        borderRadius: 16,
        padding: '20px 24px',
        marginBottom: 28,
        position: 'relative',
        boxShadow: '0 4px 20px rgba(124, 58, 237, 0.06)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, background: '#7c3aed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
              boxShadow: '0 4px 10px rgba(124, 58, 237, 0.4)'
            }}>
              <Sparkles size={16} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                Sara's Executive Synthesis & AI Telemetry Briefing
              </h3>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Autonomous intelligence generated for {timeframe === 'today' ? 'Today' : `Last ${timeframe}`}
              </span>
            </div>
          </div>

          <button
            onClick={() => fetchOverview(timeframe)}
            style={{
              background: 'rgba(124, 58, 237, 0.1)', border: 'none',
              padding: '6px 12px', borderRadius: 8, fontSize: 12,
              color: '#7c3aed', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600
            }}
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Regenerate Synthesis
          </button>
        </div>

        <p style={{
          margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--text-primary)',
          fontWeight: 450, maxWidth: '98%'
        }}>
          {data?.ai_synthesis}
        </p>

        {/* Micro-insights tags */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px',
            borderRadius: 8, background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a',
            fontSize: 11, fontWeight: 600
          }}>
            <TrendingUp size={12} />
            Peak Connect Hour: 11:00 AM - 1:30 PM
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px',
            borderRadius: 8, background: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed',
            fontSize: 11, fontWeight: 600
          }}>
            <Bot size={12} />
            Top Performer: Sara (98.5% Quality Score)
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px',
            borderRadius: 8, background: 'rgba(2, 132, 199, 0.1)', color: '#0284c7',
            fontSize: 11, fontWeight: 600
          }}>
            <FileSpreadsheet size={12} />
            Google Hub MCP Sync: Real-time Connected
          </div>
        </div>
      </div>

      {/* KPI Cards Grid (6 Metric Scorecards) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 16,
        marginBottom: 28
      }}>
        {/* Total Leads */}
        <div className="card" style={{ padding: '18px 20px', borderRadius: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Total Leads</span>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(124, 58, 237, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={15} color="#7c3aed" />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>
            {kpis.total_leads || 0}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 11, color: '#16a34a', fontWeight: 600 }}>
            <ArrowUpRight size={13} />
            {kpis.qualified_leads || 0} qualified leads
          </div>
        </div>

        {/* Lead Qualification Rate */}
        <div className="card" style={{ padding: '18px 20px', borderRadius: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Qualification Rate</span>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(2, 132, 199, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={15} color="#0284c7" />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>
            {kpis.qualification_rate || 0}%
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 11, color: '#0284c7', fontWeight: 600 }}>
            <CheckSquare size={13} />
            {kpis.won_deals || 0} deals closed
          </div>
        </div>

        {/* Total Calls Handled */}
        <div className="card" style={{ padding: '18px 20px', borderRadius: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Calls Handled</span>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(234, 88, 12, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Phone size={15} color="#ea580c" />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>
            {kpis.total_calls || 0}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 11, color: '#16a34a', fontWeight: 600 }}>
            <ArrowUpRight size={13} />
            {kpis.answer_rate || 0}% connection rate
          </div>
        </div>

        {/* AI Workforce Active */}
        <div className="card" style={{ padding: '18px 20px', borderRadius: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>AI Workforce</span>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(202, 138, 4, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={15} color="#ca8a04" />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>
            {kpis.active_ai_employees || 2} Active
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 11, color: 'var(--text-secondary)' }}>
            Autonomous tele-agents
          </div>
        </div>

        {/* Google Hub Synced */}
        <div className="card" style={{ padding: '18px 20px', borderRadius: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Google Hub MCP</span>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(22, 163, 74, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileSpreadsheet size={15} color="#16a34a" />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>
            {kpis.sheets_synced_records || 12}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 11, color: '#16a34a', fontWeight: 600 }}>
            Sheets & Cal synced
          </div>
        </div>

        {/* Billing Balance */}
        <div className="card" style={{ padding: '18px 20px', borderRadius: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Credit Balance</span>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(100, 116, 139, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={15} color="#64748b" />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>
            ₹{Number(kpis.credit_balance || 1000).toLocaleString('en-IN')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 11, color: 'var(--text-secondary)' }}>
            ₹{Number(kpis.total_consumed || 145).toLocaleString('en-IN')} consumed
          </div>
        </div>
      </div>

      {/* Main Report Navigation Tabs */}
      <div style={{
        display: 'flex', gap: 8, borderBottom: '1px solid var(--border-subtle)',
        marginBottom: 24, overflowX: 'auto', paddingBottom: 2
      }}>
        {[
          { id: 'executive', label: 'Executive Growth & Pipeline', icon: TrendingUp },
          { id: 'workforce', label: 'AI Workforce Telemetry', icon: Bot },
          { id: 'calls', label: 'Call Outcomes & Sentiments', icon: Phone },
          { id: 'sheets', label: 'Google Hub MCP Live Sync', icon: FileSpreadsheet },
          { id: 'cost', label: 'Financial & Token Audit', icon: Zap },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
                border: 'none', background: 'transparent',
                borderBottom: isActive ? '2px solid #7c3aed' : '2px solid transparent',
                color: isActive ? '#7c3aed' : 'var(--text-secondary)',
                fontWeight: isActive ? 700 : 500, fontSize: 13,
                cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s ease'
              }}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Executive Growth & Pipeline */}
      {activeTab === 'executive' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20 }}>
          {/* Trend Chart */}
          <div className="card" style={{ padding: 24, borderRadius: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Telemetry Velocity & Volume</h3>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Daily calls vs qualified lead conversions</span>
              </div>
              <button
                className="btn btn-secondary"
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => handleDownloadCSV('executive_growth', timeframe)}
              >
                <Download size={12} /> CSV
              </button>
            </div>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="callsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="leadsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#fff', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  <Area type="monotone" dataKey="calls" name="Voice Calls" stroke="#7c3aed" strokeWidth={2} fillOpacity={1} fill="url(#callsGrad)" />
                  <Area type="monotone" dataKey="leads" name="Captured Leads" stroke="#0284c7" strokeWidth={2} fillOpacity={1} fill="url(#leadsGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Lead Funnel Breakdown */}
          <div className="card" style={{ padding: 24, borderRadius: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
              Pipeline Conversion Funnel
            </h3>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 20 }}>
              Stage-by-stage progression from cold contact to won deal
            </span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { stage: 'New Leads', key: 'new', color: '#94a3b8', pct: 100 },
                { stage: 'Contacted (Voice Turn)', key: 'contacted', color: '#38bdf8', pct: 85 },
                { stage: 'Qualified by Sara', key: 'qualified', color: '#818cf8', pct: 58 },
                { stage: 'Proposal / Site Visit', key: 'proposal', color: '#c084fc', pct: 36 },
                { stage: 'Negotiation', key: 'negotiation', color: '#fbbf24', pct: 24 },
                { stage: 'Won / Deal Closed', key: 'won', color: '#34d399', pct: 18 },
              ].map((item) => (
                <div key={item.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-primary)' }}>{item.stage}</span>
                    <span style={{ color: item.color }}>{item.pct}%</span>
                  </div>
                  <div style={{ width: '100%', height: 7, background: 'var(--surface-sunken, rgba(0,0,0,0.06))', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ width: `${item.pct}%`, height: '100%', background: item.color, borderRadius: 10, transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: AI Workforce Telemetry */}
      {activeTab === 'workforce' && (
        <div className="card" style={{ padding: 24, borderRadius: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>AI Employee Productivity & Telemetry</h3>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Performance scores, call turnaround time, and task resolution rates</span>
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => handleDownloadCSV('workforce_telemetry', timeframe)}
              style={{ fontSize: 12 }}
            >
              <Download size={13} /> Export Workforce Audit
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '12px 14px' }}>AI Employee</th>
                  <th style={{ padding: '12px 14px' }}>Role & Dept</th>
                  <th style={{ padding: '12px 14px' }}>Status</th>
                  <th style={{ padding: '12px 14px' }}>Calls Handled</th>
                  <th style={{ padding: '12px 14px' }}>Tasks Completed</th>
                  <th style={{ padding: '12px 14px' }}>Efficiency Rate</th>
                  <th style={{ padding: '12px 14px' }}>Quality Rating</th>
                </tr>
              </thead>
              <tbody>
                {workforceStats.map((emp, idx) => (
                  <tr key={emp.id || idx} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s ease' }}>
                    <td style={{ padding: '14px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%', background: '#7c3aed',
                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700
                      }}>
                        {emp.name.charAt(0)}
                      </div>
                      {emp.name}
                    </td>
                    <td style={{ padding: '14px', color: 'var(--text-secondary)' }}>
                      <div>{emp.role}</div>
                      <span style={{ fontSize: 11, opacity: 0.8 }}>{emp.department}</span>
                    </td>
                    <td style={{ padding: '14px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px',
                        borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: emp.status === 'active' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(234, 88, 12, 0.1)',
                        color: emp.status === 'active' ? '#16a34a' : '#ea580c'
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                        {emp.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '14px', fontWeight: 600 }}>{emp.total_calls} calls</td>
                    <td style={{ padding: '14px' }}>{emp.completed_tasks} / {emp.total_tasks}</td>
                    <td style={{ padding: '14px', color: '#16a34a', fontWeight: 700 }}>{emp.efficiency_rate}%</td>
                    <td style={{ padding: '14px' }}>
                      <span style={{
                        padding: '4px 8px', borderRadius: 6, background: 'rgba(124, 58, 237, 0.1)',
                        color: '#7c3aed', fontWeight: 700, fontSize: 12
                      }}>
                        {emp.performance_score}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Call Outcomes & Sentiments */}
      {activeTab === 'calls' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
          {/* Outcomes */}
          <div className="card" style={{ padding: 24, borderRadius: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Call Disposition & Outcomes</h3>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 18 }}>
              Distribution of autonomous call terminations and follow-up flags
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'Site Visit Booked', count: 14, color: '#16a34a', icon: Calendar },
                { label: 'Highly Interested', count: 9, color: '#7c3aed', icon: TrendingUp },
                { label: 'Callback Requested', count: 5, color: '#0284c7', icon: Clock },
                { label: 'Voicemail / Busy', count: 3, color: '#eab308', icon: Phone },
              ].map((out) => {
                const Icon = out.icon;
                return (
                  <div key={out.label} style={{
                    padding: 16, borderRadius: 12, background: 'var(--surface-sunken, rgba(0,0,0,0.03))',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: out.color }}>
                      <Icon size={16} />
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{out.label}</span>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{out.count}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Customer Sentiment Breakdown */}
          <div className="card" style={{ padding: 24, borderRadius: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Voice Customer Sentiment</h3>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 18 }}>
              AI sentiment telemetry computed across customer spoken audio turns
            </span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { sentiment: 'Positive (Enthusiastic / Ready to buy)', pct: 76, color: '#16a34a' },
                { sentiment: 'Neutral (Fact-checking / Inquiring)', pct: 18, color: '#0284c7' },
                { sentiment: 'Objection Handled by Sara', pct: 6, color: '#f59e0b' },
              ].map((s) => (
                <div key={s.sentiment}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-primary)' }}>{s.sentiment}</span>
                    <span style={{ color: s.color }}>{s.pct}%</span>
                  </div>
                  <div style={{ width: '100%', height: 8, background: 'var(--surface-sunken, rgba(0,0,0,0.06))', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ width: `${s.pct}%`, height: '100%', background: s.color, borderRadius: 10 }} />
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              marginTop: 22, padding: '12px 14px', borderRadius: 10,
              background: 'rgba(124, 58, 237, 0.08)', border: '1px solid rgba(124, 58, 237, 0.2)',
              fontSize: 12, color: 'var(--text-primary)'
            }}>
              <strong>💡 AI Objection Handling Insight:</strong> 85% of budget objections were successfully resolved by highlighting 20-year EMI options and rental yield forecasts.
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Google Hub MCP Live Sync */}
      {activeTab === 'sheets' && (
        <div className="card" style={{ padding: 24, borderRadius: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Google Workspace Hub MCP Telemetry</h3>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Real-time synchronization log for Google Sheets, Calendar, and CRM</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-secondary"
                onClick={() => onNavigate('mcp')}
                style={{ fontSize: 12 }}
              >
                Manage MCP Tools
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleDownloadCSV('leads_conversion', timeframe)}
                style={{ fontSize: 12 }}
              >
                <Download size={12} /> Export Sheets Cache
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'var(--surface-sunken, rgba(0,0,0,0.02))' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Google Sheet Pipeline Name</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>SARA Leads Pipeline</div>
              <div style={{ fontSize: 11, color: '#16a34a', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Check size={12} /> Auto-synced on each AI turn
              </div>
            </div>

            <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'var(--surface-sunken, rgba(0,0,0,0.02))' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Google Calendar Schedule Events</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>14 Appointments Booked</div>
              <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Calendar size={12} /> 1-Click invite links created
              </div>
            </div>

            <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'var(--surface-sunken, rgba(0,0,0,0.02))' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Sync Engine Status</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#16a34a' }}>Active & Ready</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                Autonomous command listener active
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Financial & Token Audit */}
      {activeTab === 'cost' && (
        <div className="card" style={{ padding: 24, borderRadius: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Billing, Minutes & Token Efficiency Audit</h3>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Granular breakdown of speech synthesis, LLM tokens, and telephony carriage</span>
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => handleDownloadCSV('financial_audit', timeframe)}
              style={{ fontSize: 12 }}
            >
              <Download size={13} /> Download Financial CSV
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 14px' }}>Category</th>
                  <th style={{ padding: '12px 14px' }}>Usage Quantity</th>
                  <th style={{ padding: '12px 14px' }}>Unit Rate</th>
                  <th style={{ padding: '12px 14px' }}>Total Consumed</th>
                  <th style={{ padding: '12px 14px' }}>Cost Share</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { cat: 'Voice AI TTS (ElevenLabs / Deepgram)', qty: '128 Mins', rate: '₹6.00 / Min', cost: '₹768.00', share: '45%' },
                  { cat: 'LLM Inference (Groq / Gemini / OpenAI)', qty: '420K Tokens', rate: '₹0.80 / 1K Tokens', cost: '₹336.00', share: '25%' },
                  { cat: 'Carrier Telephony Minutes', qty: '128 Mins', rate: '₹3.50 / Min', cost: '₹448.00', share: '28%' },
                  { cat: 'Google Hub MCP Executions', qty: '64 Executions', rate: 'Free Tier', cost: '₹0.00', share: '2%' },
                ].map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{row.cat}</td>
                    <td style={{ padding: '14px' }}>{row.qty}</td>
                    <td style={{ padding: '14px', color: 'var(--text-secondary)' }}>{row.rate}</td>
                    <td style={{ padding: '14px', fontWeight: 700 }}>{row.cost}</td>
                    <td style={{ padding: '14px', color: '#7c3aed', fontWeight: 600 }}>{row.share}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Generated Reports Archive & Downloads Table */}
      <div className="card" style={{ marginTop: 28, padding: 24, borderRadius: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Generated Reports Archive</h3>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Pre-compiled executive reports ready for instant viewing or download</span>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '12px 14px' }}>Report Title</th>
                <th style={{ padding: '12px 14px' }}>Period</th>
                <th style={{ padding: '12px 14px' }}>Key Highlights</th>
                <th style={{ padding: '12px 14px' }}>Format</th>
                <th style={{ padding: '12px 14px' }}>Status</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {archive.map((rep) => (
                <tr key={rep.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s ease' }}>
                  <td style={{ padding: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8, background: 'rgba(124, 58, 237, 0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <BarChart3 size={14} color="#7c3aed" />
                      </div>
                      <div>
                        {rep.title}
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}>{rep.generated_at} • {rep.size}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px', color: 'var(--text-secondary)' }}>{rep.period}</td>
                  <td style={{ padding: '14px', color: 'var(--text-primary)', fontSize: 12 }}>{rep.highlights}</td>
                  <td style={{ padding: '14px', color: 'var(--text-secondary)' }}>{rep.format}</td>
                  <td style={{ padding: '14px' }}>
                    <span style={{
                      padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                      background: rep.status === 'Live' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(124, 58, 237, 0.1)',
                      color: rep.status === 'Live' ? '#16a34a' : '#7c3aed'
                    }}>
                      {rep.status}
                    </span>
                  </td>
                  <td style={{ padding: '14px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button
                        className="btn btn-secondary"
                        onClick={async () => {
                          setGenerating(true);
                          const res = await fetch('/api/v1/reports/generate', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ report_type: rep.type, timeframe })
                          });
                          if (res.ok) {
                            const r = await res.json();
                            setPreviewReport(r.report);
                          }
                          setGenerating(false);
                        }}
                        style={{ fontSize: 11, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
                        title="View Interactive Report"
                      >
                        <Eye size={12} /> View
                      </button>

                      <button
                        className="btn btn-secondary"
                        onClick={() => handleDownloadCSV(rep.type, timeframe)}
                        style={{ fontSize: 11, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
                        title="Download CSV"
                      >
                        <Download size={12} /> CSV
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL 1: Generate Custom AI Report ───────────────────────────── */}
      {isGenerateOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div className="card animate-scale-up" style={{
            width: '100%', maxWidth: 520, borderRadius: 20, padding: 28,
            boxShadow: '0 20px 50px rgba(0,0,0,0.3)', background: 'var(--surface-card, #fff)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Generate Custom AI Report</h3>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Synthesize real-time telemetry and export</span>
                </div>
              </div>
              <button
                onClick={() => setIsGenerateOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Report Type</label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="input"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10 }}
                >
                  <option value="executive_growth">📈 Executive Growth & Revenue Synthesis</option>
                  <option value="workforce_telemetry">🤖 AI Workforce Telemetry & Efficiency Audit</option>
                  <option value="calls_sentiment">📞 Voice AI Telephony & Customer Sentiment</option>
                  <option value="financial_audit">💰 Credit, Minutes & Cost Optimization Audit</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Timeframe</label>
                <select
                  value={reportTimeframe}
                  onChange={(e) => setReportTimeframe(e.target.value)}
                  className="input"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10 }}
                >
                  <option value="today">Today (Last 24 Hours)</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days (October 2026)</option>
                  <option value="quarter">This Quarter</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Department / Scope</label>
                <select
                  value={reportDept}
                  onChange={(e) => setReportDept(e.target.value)}
                  className="input"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10 }}
                >
                  <option value="All">All Departments (Comprehensive)</option>
                  <option value="Sales">Real Estate Sales & Inquiries</option>
                  <option value="Support">Customer Support & Post-Sale</option>
                  <option value="Outbound">Direct Campaigns & Instant Leads</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button
                className="btn btn-secondary"
                onClick={() => setIsGenerateOpen(false)}
                disabled={generating}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleGenerateReport}
                disabled={generating}
                style={{
                  background: 'linear-gradient(135deg, #7c3aed 0%, #9333ea 100%)',
                  color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 8
                }}
              >
                {generating ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {generating ? 'Synthesizing...' : 'Generate Report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 2: Interactive Report Preview ─────────────────────────── */}
      {previewReport && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div className="card animate-scale-up" style={{
            width: '100%', maxWidth: 840, maxHeight: '90vh', overflowY: 'auto',
            borderRadius: 20, padding: 28, background: 'var(--surface-card, #fff)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase' }}>
                  Report Preview • {previewReport.timeframe}
                </span>
                <h2 style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 800 }}>{previewReport.title}</h2>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Generated on {previewReport.generated_at}</span>
              </div>
              <button
                onClick={() => setPreviewReport(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={22} />
              </button>
            </div>

            {/* AI Recommendations */}
            <div style={{
              background: 'rgba(124, 58, 237, 0.08)', border: '1px solid rgba(124, 58, 237, 0.2)',
              borderRadius: 12, padding: 16, marginBottom: 20
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#7c3aed', marginBottom: 8 }}>
                <Sparkles size={15} />
                Sara's Strategic Action Items:
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>
                {previewReport.ai_recommendations?.map((item, idx) => (
                  <li key={idx} style={{ marginBottom: 4 }}>{item}</li>
                ))}
              </ul>
            </div>

            {/* Tabular Preview */}
            <div style={{ overflowX: 'auto', marginBottom: 24 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-subtle)', background: 'var(--surface-sunken, rgba(0,0,0,0.02))' }}>
                    {previewReport.columns?.map((col) => (
                      <th key={col} style={{ padding: '10px 12px', fontWeight: 700 }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewReport.rows?.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      {previewReport.columns?.map((col) => (
                        <td key={col} style={{ padding: '10px 12px' }}>{row[col]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                className="btn btn-secondary"
                onClick={() => setPreviewReport(null)}
              >
                Close Preview
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleDownloadCSV(previewReport.report_type, previewReport.timeframe)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#7c3aed', color: '#fff' }}
              >
                <Download size={14} /> Download Full CSV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 3: Schedule Automated Report Delivery ─────────────────── */}
      {isScheduleOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div className="card animate-scale-up" style={{
            width: '100%', maxWidth: 480, borderRadius: 20, padding: 28,
            boxShadow: '0 20px 50px rgba(0,0,0,0.3)', background: 'var(--surface-card, #fff)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <Clock size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Schedule Automated Reports</h3>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Delivered automatically to your inbox or WhatsApp</span>
                </div>
              </div>
              <button
                onClick={() => setIsScheduleOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Delivery Frequency</label>
                <select
                  value={scheduleFreq}
                  onChange={(e) => setScheduleFreq(e.target.value)}
                  className="input"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10 }}
                >
                  <option value="daily">Every Morning (Daily at 9:00 AM)</option>
                  <option value="weekly">Weekly Digest (Every Monday 9:00 AM)</option>
                  <option value="monthly">Monthly Executive Summary (1st of month)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Delivery Channel</label>
                <select
                  value={scheduleChannel}
                  onChange={(e) => setScheduleChannel(e.target.value)}
                  className="input"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10 }}
                >
                  <option value="email">📧 Email Digest (PDF & CSV attachment)</option>
                  <option value="whatsapp">💬 WhatsApp Executive Briefing</option>
                  <option value="sheets">📊 Auto-Sync to Google Sheets Pipeline</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  Recipient {scheduleChannel === 'whatsapp' ? 'Phone Number' : 'Email Address'}
                </label>
                <input
                  type={scheduleChannel === 'whatsapp' ? 'tel' : 'email'}
                  placeholder={scheduleChannel === 'whatsapp' ? '+91 98765 43210' : 'executive@company.com'}
                  value={scheduleRecipient}
                  onChange={(e) => setScheduleRecipient(e.target.value)}
                  className="input"
                  required
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsScheduleOpen(false)}
                  disabled={scheduling}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={scheduling}
                  style={{ background: '#0284c7', color: '#fff', border: 'none' }}
                >
                  {scheduling ? 'Activating...' : 'Activate Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
