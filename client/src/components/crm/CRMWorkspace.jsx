import React, { useState, useEffect } from "react";
import CRMDashboard from "./CRMDashboard";
import PipelineKanban from "./PipelineKanban";
import CallRecordingHub from "./CallRecordingHub";
import CRMAISearch from "./CRMAISearch";
import CustomerDetailModal from "./CustomerDetailModal";
import { crmApi } from "../../services/crmApi";

export default function CRMWorkspace() {
  const [subTab, setSubTab] = useState("dashboard"); // dashboard, pipeline, customers, calls, search, tasks, automations
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (subTab === "customers") loadCustomers();
    if (subTab === "tasks") loadTasks();
    if (subTab === "automations") loadAutomations();
  }, [subTab]);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const data = await crmApi.getCustomers({ search: searchTerm });
      setCustomers(data.customers || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async () => {
    setLoading(true);
    try {
      const data = await crmApi.getTasks();
      setTasks(data.tasks || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadAutomations = async () => {
    setLoading(true);
    try {
      const data = await crmApi.getAutomations();
      setAutomations(data.automations || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTask = async (taskId, currentStatus) => {
    try {
      const nextStatus = currentStatus === "Completed" ? "Pending" : "Completed";
      await crmApi.updateTask(taskId, { status: nextStatus });
      loadTasks();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-indigo-600 flex items-center justify-center text-xl shadow-lg shadow-emerald-950/40">
              💎
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                Saadhyam Universal CRM
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  AI-Native OS
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Connected Operating System for Leads, Customers, Calls, Diarized Transcripts & Intelligence
              </p>
            </div>
          </div>
        </div>

        {/* Global Quick Action & Status */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Continuous Memory Synced
          </div>

          <button
            onClick={() => setSubTab("pipeline")}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-950/40 transition-all flex items-center gap-1.5"
          >
            <span>+</span> Pipeline Board
          </button>
        </div>
      </div>

      {/* Primary Sub-Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-800 text-xs font-semibold">
        {[
          { id: "dashboard", label: "📊 Executive BI", icon: "📊" },
          { id: "pipeline", label: "📋 Leads & Pipeline", icon: "📋" },
          { id: "customers", label: "👥 All Customers", icon: "👥" },
          { id: "calls", label: "🎙️ Call Recordings & Intelligence", icon: "🎙️" },
          { id: "search", label: "🔍 Natural AI Search", icon: "🔍" },
          { id: "tasks", label: "✅ Tasks & Follow-ups", icon: "✅" },
          { id: "automations", label: "⚡ Automations", icon: "⚡" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={`px-4 py-2.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
              subTab === tab.id
                ? "bg-slate-800 text-white border border-slate-700 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active Tab View */}
      <div className="pt-2">
        {subTab === "dashboard" && (
          <CRMDashboard onSelectCustomer={(id) => setSelectedCustomerId(id)} />
        )}

        {subTab === "pipeline" && (
          <PipelineKanban onSelectCustomer={(id) => setSelectedCustomerId(id)} />
        )}

        {subTab === "calls" && (
          <CallRecordingHub onSelectCustomer={(id) => setSelectedCustomerId(id)} />
        )}

        {subTab === "search" && (
          <CRMAISearch onSelectCustomer={(id) => setSelectedCustomerId(id)} />
        )}

        {/* CUSTOMERS TABLE VIEW */}
        {subTab === "customers" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadCustomers()}
                placeholder="Search customers by name, phone, or company..."
                className="bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white w-72 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={loadCustomers}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700"
              >
                Search
              </button>
            </div>

            <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-700/60">
                  <tr>
                    <th className="p-3.5">Customer / Contact</th>
                    <th className="p-3.5">Company & Location</th>
                    <th className="p-3.5">Pipeline Stage</th>
                    <th className="p-3.5">Lead Score</th>
                    <th className="p-3.5">Assigned Specialist</th>
                    <th className="p-3.5">Source</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {customers.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedCustomerId(c.id)}
                      className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                    >
                      <td className="p-3.5 font-bold text-white">
                        {c.name}
                        <span className="block text-[11px] font-normal text-slate-400">{c.phone}</span>
                      </td>
                      <td className="p-3.5">
                        {c.company || "Individual"}
                        <span className="block text-[11px] text-slate-400">{c.location || "Hyderabad"}</span>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 font-semibold border border-indigo-500/20">
                          {c.pipeline_stage}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold text-emerald-400">
                        {c.lead_score} pts
                      </td>
                      <td className="p-3.5 text-slate-300">
                        {c.assigned_user}
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          {c.source}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCustomerId(c.id);
                          }}
                          className="px-3 py-1 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white font-semibold text-[11px]"
                        >
                          View 360°
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TASKS VIEW */}
        {subTab === "tasks" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base text-white">Pending Tasks & Scheduled Callbacks</h3>
                <p className="text-xs text-slate-400">Automatically generated from AI voice call commitments</p>
              </div>
            </div>

            <div className="space-y-3">
              {tasks.map((t) => (
                <div
                  key={t.id}
                  className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 flex items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={t.status === "Completed"}
                      onChange={() => handleToggleTask(t.id, t.status)}
                      className="mt-1 rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0 w-4 h-4 cursor-pointer"
                    />
                    <div>
                      <h4 className={`text-sm font-bold text-white ${t.status === "Completed" ? "line-through text-slate-400" : ""}`}>
                        {t.title}
                      </h4>
                      <p className="text-xs text-slate-300 mt-0.5">{t.description}</p>
                      <div className="flex items-center gap-2.5 mt-1.5 text-xs text-slate-400">
                        <span>Assignee: <strong className="text-slate-200">{t.assigned_to}</strong></span>
                        <span>•</span>
                        <span>Customer: <strong className="text-slate-200">{t.customer_name}</strong></span>
                        {t.is_ai_generated && (
                          <span className="text-cyan-400 bg-cyan-500/10 px-2 py-0.2 rounded-full border border-cyan-500/20 text-[10px]">
                            AI Auto-Generated
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-xs px-2.5 py-1 rounded-lg font-bold border ${
                      t.status === "Completed"
                        ? "bg-slate-800 text-slate-400 border-slate-700"
                        : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                    }`}
                  >
                    {t.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AUTOMATIONS VIEW */}
        {subTab === "automations" && (
          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-base text-white">AI CRM Workflow Automation Builder</h3>
              <p className="text-xs text-slate-400">Event-driven triggers configured in natural language</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {automations.map((a) => (
                <div key={a.id} className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-white">{a.name}</h4>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold">
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">{a.description}</p>
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-xs text-slate-300 font-mono">
                    "{a.natural_language_prompt}"
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                    <span>Trigger: <code className="text-indigo-400">{a.trigger_event}</code></span>
                    <span>Executed: <strong>{a.execution_count}x</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 360° Customer Profile Modal */}
      {selectedCustomerId && (
        <CustomerDetailModal
          customerId={selectedCustomerId}
          onClose={() => setSelectedCustomerId(null)}
          onCustomerUpdated={() => {
            if (subTab === "customers") loadCustomers();
          }}
        />
      )}
    </div>
  );
}
