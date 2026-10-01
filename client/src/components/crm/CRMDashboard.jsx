import React, { useState, useEffect } from "react";
import { crmApi } from "../../services/crmApi";

export default function CRMDashboard({ onSelectCustomer }) {
  const [role, setRole] = useState("CEO");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics(role);
  }, [role]);

  const loadAnalytics = async (selectedRole) => {
    setLoading(true);
    try {
      const res = await crmApi.getAnalytics(selectedRole);
      setData(res);
    } catch (e) {
      console.error("Failed to load analytics:", e);
    } finally {
      setLoading(false);
    }
  };

  const roles = ["CEO", "CRO", "Sales Manager", "Sales Rep", "AI Workforce"];

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mr-3"></div>
        Synthesizing business intelligence...
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const sources = data?.lead_sources || {};
  const stages = data?.pipeline_stages || {};
  const sentiments = data?.call_sentiments || {};
  const objections = data?.top_objections || [];
  const aiInfo = data?.ai_workforce || {};

  return (
    <div className="space-y-6">
      {/* Top Bar: Role Selector & System Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>Executive Business Intelligence</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Live Real-Time
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Holistic view of leads, revenue pipeline, conversation intelligence, and AI workforce performance
          </p>
        </div>

        {/* Role Tabs */}
        <div className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 overflow-x-auto">
          {roles.map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap ${
                role === r
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/30 font-semibold"
                  : "text-slate-400 hover:text-white hover:bg-slate-700/40"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Pipeline Value */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-indigo-950/40 p-4 rounded-2xl border border-indigo-500/20 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl"></div>
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Pipeline Value</span>
          <div className="text-2xl font-black text-white mt-1">
            ₹{((kpis.total_pipeline_value_inr || 0) / 10000000).toFixed(2)} Cr
          </div>
          <div className="text-xs text-indigo-400 mt-2 flex items-center gap-1">
            <span>↑ Active deals in flight</span>
          </div>
        </div>

        {/* Lead Qualification */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-emerald-950/40 p-4 rounded-2xl border border-emerald-500/20 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl"></div>
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Qualified Leads</span>
          <div className="text-2xl font-black text-white mt-1">
            {kpis.qualified_leads} <span className="text-xs font-normal text-slate-400">/ {kpis.total_leads}</span>
          </div>
          <div className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
            <span>★ {kpis.qualification_rate_pct}% qualification rate</span>
          </div>
        </div>

        {/* AI Call Automation Ratio */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-cyan-950/40 p-4 rounded-2xl border border-cyan-500/20 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl"></div>
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">AI Voice Handling</span>
          <div className="text-2xl font-black text-cyan-300 mt-1">
            {kpis.ai_handled_calls_pct}%
          </div>
          <div className="text-xs text-cyan-400/80 mt-2 flex items-center gap-1">
            <span>⚡ {kpis.total_calls} calls captured & diarized</span>
          </div>
        </div>

        {/* Conversion Velocity */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-amber-950/40 p-4 rounded-2xl border border-amber-500/20 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl"></div>
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Avg AI Response</span>
          <div className="text-2xl font-black text-amber-300 mt-1">
            {kpis.average_response_time_seconds}s
          </div>
          <div className="text-xs text-amber-400/80 mt-2 flex items-center gap-1">
            <span>🎯 {kpis.pending_followups} pending follow-ups</span>
          </div>
        </div>
      </div>

      {/* Middle Grid: Pipeline Funnel + Lead Ingestion Channels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Distribution */}
        <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              Pipeline Stage Velocity
            </h3>
            <span className="text-xs text-slate-400">{kpis.total_leads} Active Leads</span>
          </div>

          <div className="space-y-3">
            {Object.entries(stages).map(([stage, count]) => {
              const pct = kpis.total_leads > 0 ? Math.round((count / kpis.total_leads) * 100) : 0;
              return (
                <div key={stage} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 font-medium">{stage}</span>
                    <span className="text-slate-400">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(pct, 5)}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Lead Source Ingestion */}
        <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Multi-Channel Ingestion
            </h3>
            <span className="text-xs text-slate-400">Automated Attribution</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {Object.entries(sources).map(([source, count]) => (
              <div
                key={source}
                className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50 flex items-center justify-between"
              >
                <div>
                  <span className="text-xs text-slate-400 block">{source}</span>
                  <span className="text-lg font-bold text-white">{count} Leads</span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center text-xs font-bold text-emerald-400">
                  {Math.round((count / (kpis.total_leads || 1)) * 100)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Grid: Conversation Intelligence + AI Workforce */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer Sentiment Breakdown */}
        <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-md">
          <h3 className="font-semibold text-white text-sm mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Customer Sentiment Analysis
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Derived from automatic call transcription and speech emotion signals
          </p>

          <div className="space-y-2.5">
            {Object.entries(sentiments).map(([sentiment, count]) => (
              <div key={sentiment} className="flex items-center justify-between text-xs bg-slate-800/40 px-3 py-2 rounded-lg border border-slate-700/30">
                <span className="font-medium text-slate-300">{sentiment}</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
                  {count} calls
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Extracted Objections */}
        <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-md">
          <h3 className="font-semibold text-white text-sm mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            Top Customer Objections
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Aggregated from calls across all sales reps and AI voice sessions
          </p>

          <div className="space-y-2.5">
            {objections.map((item, idx) => (
              <div key={idx} className="text-xs bg-slate-800/40 p-2.5 rounded-lg border border-slate-700/30">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-slate-200">{item.objection}</span>
                  <span className="text-rose-400 font-bold whitespace-nowrap bg-rose-500/10 px-1.5 py-0.5 rounded">
                    {item.frequency}x
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Workforce Status */}
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950/30 to-slate-900 p-5 rounded-2xl border border-indigo-500/30 shadow-md">
          <h3 className="font-semibold text-white text-sm mb-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            Saadhyam AI Workforce
          </h3>
          <p className="text-xs text-indigo-300/80 mb-4">Autonomous 24/7 Voice & Chat Agents</p>

          <div className="space-y-3">
            <div className="bg-slate-800/70 p-3 rounded-xl border border-indigo-500/20">
              <span className="text-xs text-slate-400 block">Deployed Voice Agents</span>
              <div className="space-y-1 mt-1">
                {(aiInfo.active_agents || []).map((agent, i) => (
                  <div key={i} className="text-xs text-white font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    {agent}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800/50 p-2.5 rounded-lg border border-slate-700/40">
                <span className="text-slate-400 block text-[10px] uppercase">Auto-Tasks Created</span>
                <span className="text-base font-bold text-emerald-400">{aiInfo.auto_tasks_generated || 0}</span>
              </div>
              <div className="bg-slate-800/50 p-2.5 rounded-lg border border-slate-700/40">
                <span className="text-slate-400 block text-[10px] uppercase">Resolution Speed</span>
                <span className="text-base font-bold text-cyan-400">{aiInfo.resolution_velocity_hours || 1.2} hrs</span>
              </div>
            </div>

            <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-[11px] text-indigo-300">
              🔒 Privacy Controls & Recording Consent Active. Audit logs tamper-resistant.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
