import React, { useState, useEffect } from "react";
import { crmApi } from "../../services/crmApi";

export default function CustomerDetailModal({ customerId, onClose, onCustomerUpdated }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview"); // overview, timeline, calls, memory, tasks, deals
  const [summaryData, setSummaryData] = useState(null);
  const [handoffData, setHandoffData] = useState(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showHandoffModal, setShowHandoffModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (customerId) {
      loadProfile();
    }
  }, [customerId]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await crmApi.getCustomer(customerId);
      setProfile(data);
    } catch (e) {
      console.error("Failed to load customer profile:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleStageChange = async (newStage) => {
    try {
      await crmApi.updateCustomer(customerId, { pipeline_stage: newStage });
      loadProfile();
      if (onCustomerUpdated) onCustomerUpdated();
    } catch (e) {
      alert("Failed to update stage: " + e.message);
    }
  };

  const handle1ClickSummary = async () => {
    setActionLoading(true);
    try {
      const res = await crmApi.getOneClickSummary(customerId);
      setSummaryData(res.summary);
      setShowSummaryModal(true);
    } catch (e) {
      alert("Failed to generate AI summary: " + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEmployeeHandoff = async () => {
    setActionLoading(true);
    try {
      const res = await crmApi.getEmployeeHandoff(customerId);
      setHandoffData(res);
      setShowHandoffModal(true);
    } catch (e) {
      alert("Failed to generate employee handoff: " + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleTask = async (taskId, currentStatus) => {
    try {
      const nextStatus = currentStatus === "Completed" ? "Pending" : "Completed";
      await crmApi.updateTask(taskId, { status: nextStatus });
      loadProfile();
    } catch (e) {
      console.error("Failed to update task:", e);
    }
  };

  if (!customerId) return null;

  const c = profile?.customer || {};
  const calls = profile?.calls || [];
  const timeline = profile?.timeline || [];
  const tasks = profile?.tasks || [];
  const deals = profile?.deals || [];
  const memory = c.memory || {};

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 md:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-30 bg-slate-950/80 flex items-center justify-center text-slate-300">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mr-3"></div>
            Loading 360° Universal Profile...
          </div>
        )}

        {/* Modal Top Header */}
        <div className="p-5 md:p-6 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/60 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Lead Score Avatar */}
            <div
              className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black shadow-lg border ${
                (c.lead_score || 50) >= 80
                  ? "bg-emerald-950/80 text-emerald-400 border-emerald-500/40 shadow-emerald-900/20"
                  : "bg-slate-800 text-slate-300 border-slate-700"
              }`}
            >
              <span className="text-lg leading-none">{c.lead_score || 50}</span>
              <span className="text-[9px] uppercase tracking-tighter text-slate-400 font-semibold mt-0.5">
                Score
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl md:text-2xl font-black text-white">{c.name || "Customer"}</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700">
                  {c.source || "Website"}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30">
                  {c.pipeline_stage || "New Lead"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-1">
                {c.phone && <span>📞 {c.phone}</span>}
                {c.email && <span>✉️ {c.email}</span>}
                {c.company && <span>🏢 {c.company}</span>}
                {c.location && <span>📍 {c.location}</span>}
              </div>
            </div>
          </div>

          {/* Action Buttons: 1-Click AI Summary & Employee Handoff */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handle1ClickSummary}
              disabled={actionLoading}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold text-xs shadow-lg shadow-orange-950/40 flex items-center gap-1.5 transition-all"
            >
              <span>⚡</span> 1-Click AI Summary
            </button>

            <button
              onClick={handleEmployeeHandoff}
              disabled={actionLoading}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-950/40 flex items-center gap-1.5 transition-all"
            >
              <span>🤝</span> Employee Handoff Pack
            </button>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all ml-1"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900/90 px-6 gap-2 overflow-x-auto text-xs">
          {[
            { id: "overview", label: "Overview & Requirements", count: null },
            { id: "timeline", label: "Unified Timeline", count: timeline.length },
            { id: "calls", label: "Calls & Recordings", count: calls.length },
            { id: "memory", label: "AI Continuous Memory", count: null },
            { id: "tasks", label: "Tasks & Follow-ups", count: tasks.length },
            { id: "deals", label: "Deals & Revenue", count: deals.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-3 font-semibold border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.label}
              {tab.count !== null && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Column: Requirements & Details */}
              <div className="md:col-span-2 space-y-5">
                <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/60 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Lead Interest & Requirements
                  </h4>
                  <div className="text-base font-bold text-white">{c.interest || "Residential Property"}</div>
                  
                  <div className="flex flex-wrap gap-2 pt-1">
                    {(c.requirements || []).map((req, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-medium"
                      >
                        ✓ {req}
                      </span>
                    ))}
                    {(c.preferences || []).map((pref, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-xs font-medium"
                      >
                        ★ {pref}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Key Commercial Metrics */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-800/40 p-3.5 rounded-xl border border-slate-700/50">
                    <span className="text-[11px] text-slate-400 block">Stated Budget</span>
                    <span className="text-sm font-bold text-white mt-0.5 block">{c.budget || "Flexible"}</span>
                  </div>
                  <div className="bg-slate-800/40 p-3.5 rounded-xl border border-slate-700/50">
                    <span className="text-[11px] text-slate-400 block">Purchase Timeline</span>
                    <span className="text-sm font-bold text-white mt-0.5 block">{c.timeline || "Within 2 months"}</span>
                  </div>
                  <div className="bg-slate-800/40 p-3.5 rounded-xl border border-slate-700/50">
                    <span className="text-[11px] text-slate-400 block">Ad Campaign</span>
                    <span className="text-sm font-bold text-white mt-0.5 block truncate">{c.campaign || "Direct Web"}</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Assignment & Stage */}
              <div className="space-y-4">
                <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/60 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Ownership & Assignment
                  </h4>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Human Specialist</span>
                      <span className="text-white font-semibold flex items-center gap-1.5 mt-0.5">
                        <span>👤</span> {c.assigned_user || "Unassigned"}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-700/50">
                      <span className="text-slate-400 block text-[10px] uppercase">AI Voice Representative</span>
                      <span className="text-cyan-300 font-semibold flex items-center gap-1.5 mt-0.5">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                        {c.assigned_agent || "SARA"}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-700/50">
                      <span className="text-slate-400 block text-[10px] uppercase">Pipeline Stage</span>
                      <select
                        value={c.pipeline_stage}
                        onChange={(e) => handleStageChange(e.target.value)}
                        className="mt-1 w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                      >
                        {["New Lead", "Contacted", "Qualified", "Interested", "Proposal Sent", "Negotiation", "Won", "Lost"].map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: UNIFIED TIMELINE */}
          {activeTab === "timeline" && (
            <div className="space-y-4">
              <div className="text-xs text-slate-400">
                Connected ledger of all customer touchpoints, calls, AI qualification events, WhatsApp messages, and stage changes.
              </div>

              <div className="relative border-l-2 border-slate-800 ml-4 pl-6 space-y-6 py-2">
                {timeline.map((item, idx) => (
                  <div key={item.id || idx} className="relative group">
                    {/* Dot */}
                    <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full bg-indigo-500 border-2 border-slate-900 shadow-md"></div>

                    <div className="bg-slate-800/40 group-hover:bg-slate-800/70 p-3.5 rounded-xl border border-slate-700/40 transition-all space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-white flex items-center gap-1.5">
                          <span>{item.activity_type === "call" ? "📞" : item.activity_type === "message" ? "💬" : "⚡"}</span>
                          {item.title}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {item.timestamp ? new Date(item.timestamp).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Recent"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">{item.description}</p>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2 pt-1">
                        <span>Actor: <strong className="text-slate-200">{item.actor_name}</strong> ({item.actor_type})</span>
                        <span>•</span>
                        <span>Source: {item.source}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: CALLS & RECORDINGS */}
          {activeTab === "calls" && (
            <div className="space-y-4">
              {calls.map((call) => (
                <div key={call.id} className="bg-slate-800/50 p-5 rounded-2xl border border-slate-700/60 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/40 pb-3">
                    <div>
                      <h4 className="font-bold text-sm text-white flex items-center gap-2">
                        <span>🎙️ {call.direction} {call.call_type}</span>
                        <span className="text-xs font-normal text-slate-400">
                          ({call.duration_seconds}s)
                        </span>
                      </h4>
                      <span className="text-xs text-slate-400">
                        Agent: {call.receiver} • Caller: {call.caller} ({call.phone_number})
                      </span>
                    </div>

                    {/* Audio Player for Secure Recording Stream */}
                    {call.has_recording && (
                      <div className="flex items-center gap-2">
                        <audio
                          controls
                          src={`/api/crm/calls/${call.id}/recording/stream`}
                          className="h-8 max-w-xs"
                          preload="none"
                        />
                      </div>
                    )}
                  </div>

                  {/* Extracted Intelligence Summary */}
                  {call.intelligence && (
                    <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-700/40 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-emerald-400 uppercase tracking-wider text-[11px]">
                          AI Conversation Intelligence
                        </span>
                        <div className="flex gap-2">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                            Sentiment: {call.intelligence.sentiment}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold">
                            Intent: {call.intelligence.purchase_intent}
                          </span>
                        </div>
                      </div>

                      <div className="text-slate-200 whitespace-pre-line font-mono bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                        {call.intelligence.call_summary}
                      </div>

                      <div className="text-indigo-300 pt-1">
                        <strong>Next Action:</strong> {call.intelligence.next_recommended_action}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {calls.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-xs italic">
                  No recorded calls for this customer yet. Inbound or outbound voice agent calls will appear here automatically.
                </div>
              )}
            </div>
          )}

          {/* TAB 4: AI CONTINUOUS MEMORY */}
          {activeTab === "memory" && (
            <div className="space-y-4">
              <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Cumulative Customer Memory (Cross-Interaction Synthesis)
                  </h4>
                  <span className="text-[11px] text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                    Non-Duplicating Memory
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Saadhyam merges facts from Call 1, Call 2, and WhatsApp messages into structured customer memory without repeating details.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-2">
                    <span className="text-xs font-semibold text-slate-300 block">Consolidated Requirements</span>
                    <ul className="space-y-1 text-xs text-slate-300">
                      {(memory.consolidated_requirements || c.requirements || []).map((req, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          <span className="text-emerald-400">✓</span> {req}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-2">
                    <span className="text-xs font-semibold text-slate-300 block">Objections & Constraints Log</span>
                    <ul className="space-y-1 text-xs text-slate-300">
                      {(memory.objection_history || ["Requested flexible payment options"]).map((obj, i) => (
                        <li key={i} className="flex items-center gap-1.5 text-rose-300">
                          <span>⚠️</span> {obj}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Commitments Log */}
                <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-xs font-semibold text-slate-300 block">Promises & Commitments Log</span>
                  <div className="space-y-1.5 text-xs">
                    {(memory.commitments_log || []).map((com, i) => (
                      <div key={i} className="flex justify-between items-center text-slate-300 bg-slate-800/40 p-2 rounded-lg">
                        <span>💬 {com.promise}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{com.source} • {com.timestamp}</span>
                      </div>
                    ))}
                    {(!memory.commitments_log || memory.commitments_log.length === 0) && (
                      <div className="text-slate-400 italic">Brochure dispatch and site visit coordination promised.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: TASKS & FOLLOW-UPS */}
          {activeTab === "tasks" && (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 flex items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={task.status === "Completed"}
                      onChange={() => handleToggleTask(task.id, task.status)}
                      className="mt-1 rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0 w-4 h-4 cursor-pointer"
                    />
                    <div>
                      <h4 className={`text-sm font-semibold text-white ${task.status === "Completed" ? "line-through text-slate-400" : ""}`}>
                        {task.title}
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">{task.description}</p>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                        <span>Assignee: <strong className="text-slate-200">{task.assigned_to}</strong></span>
                        {task.is_ai_generated && (
                          <span className="text-cyan-400 bg-cyan-500/10 px-1.5 py-0.2 rounded text-[10px]">
                            AI Triggered
                          </span>
                        )}
                        {task.due_date && <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-xs px-2.5 py-1 rounded-lg font-bold border ${
                      task.status === "Completed"
                        ? "bg-slate-800 text-slate-400 border-slate-700"
                        : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                    }`}
                  >
                    {task.status}
                  </span>
                </div>
              ))}

              {tasks.length === 0 && (
                <div className="text-center py-6 text-slate-400 text-xs italic">
                  No pending follow-ups or callbacks.
                </div>
              )}
            </div>
          )}

          {/* TAB 6: DEALS */}
          {activeTab === "deals" && (
            <div className="space-y-3">
              {deals.map((deal) => (
                <div key={deal.id} className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-sm text-white">{deal.name}</h4>
                    <span className="text-xs text-slate-400">Stage: {deal.stage} • Probability: {deal.probability}%</span>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black text-emerald-400">
                      ₹{((deal.amount || 0) / 100000).toFixed(1)} Lakhs
                    </span>
                    <span className="text-[10px] text-slate-400 block">Expected close in 45 days</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 1-CLICK AI SUMMARY MODAL */}
      {showSummaryModal && summaryData && (
        <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  Saadhyam One-Click AI Summary
                </span>
                <h3 className="text-lg font-black text-white">{c.name} Executive Dossier</h3>
              </div>
              <button onClick={() => setShowSummaryModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              {Object.entries(summaryData).map(([key, value]) => (
                <div key={key} className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                  <span className="font-bold text-amber-400 uppercase tracking-wide block text-[10px] mb-1">
                    {key.replace(/_/g, " ")}
                  </span>
                  <p className="text-slate-200">{value}</p>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowSummaryModal(false)}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1-CLICK EMPLOYEE HANDOFF BRIEFING MODAL */}
      {showHandoffModal && handoffData && (
        <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-500/40 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
                  AI-to-Human Handover Dossier
                </span>
                <h3 className="text-lg font-black text-white">Representative Briefing Pack</h3>
              </div>
              <button onClick={() => setShowHandoffModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Suggested Opening Script */}
              <div className="bg-purple-950/30 p-3.5 rounded-xl border border-purple-500/30">
                <span className="font-bold text-purple-300 block text-[11px] mb-1">
                  🗣️ Recommended Opening Call Script
                </span>
                <p className="text-purple-100 italic">"{handoffData.suggested_opening_script}"</p>
              </div>

              {/* Recommended Next Action */}
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700">
                <span className="font-bold text-emerald-400 block text-[10px] uppercase mb-1">
                  🎯 Recommended Next Action
                </span>
                <p className="text-slate-200">{handoffData.recommended_next_action}</p>
              </div>

              {/* Objections to Address */}
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700">
                <span className="font-bold text-rose-400 block text-[10px] uppercase mb-1">
                  ⚠️ Objections & Concerns to Overcome
                </span>
                <ul className="space-y-1 text-slate-300">
                  {(handoffData.objections_to_address || []).map((obj, i) => (
                    <li key={i}>• {obj}</li>
                  ))}
                  {(!handoffData.objections_to_address || handoffData.objections_to_address.length === 0) && (
                    <li className="italic text-slate-400">No major objections recorded.</li>
                  )}
                </ul>
              </div>

              {/* Last Conversation Highlights */}
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700">
                <span className="font-bold text-slate-400 block text-[10px] uppercase mb-1">
                  Recent Interaction Highlights
                </span>
                <p className="text-slate-200 whitespace-pre-line font-mono text-[11px]">
                  {handoffData.last_conversation_highlights}
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowHandoffModal(false)}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs"
              >
                Done / Accepted Handoff
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
