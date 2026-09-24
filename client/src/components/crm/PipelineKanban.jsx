import React, { useState, useEffect } from "react";
import { crmApi } from "../../services/crmApi";

export default function PipelineKanban({ onSelectCustomer }) {
  const [pipeline, setPipeline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLead, setNewLead] = useState({
    name: "",
    phone: "",
    email: "",
    company: "",
    location: "Hyderabad",
    budget: "₹85 Lakhs",
    interest: "3 BHK Apartment",
    source: "Website",
    pipeline_stage: "New Lead",
    requirements: "3 BHK, East Facing",
  });

  useEffect(() => {
    loadPipeline();
  }, []);

  const loadPipeline = async () => {
    setLoading(true);
    try {
      const data = await crmApi.getPipeline();
      setPipeline(data);
    } catch (e) {
      console.error("Failed to load pipeline:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleStageChange = async (e, customerId, newStage) => {
    e.stopPropagation();
    try {
      await crmApi.updateCustomer(customerId, { pipeline_stage: newStage });
      loadPipeline();
    } catch (err) {
      console.error("Failed to update stage:", err);
    }
  };

  const handleCreateLead = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...newLead,
        requirements: newLead.requirements
          ? newLead.requirements.split(",").map((s) => s.trim())
          : [],
      };
      await crmApi.createCustomer(payload);
      setShowAddModal(false);
      setNewLead({
        name: "",
        phone: "",
        email: "",
        company: "",
        location: "Hyderabad",
        budget: "₹85 Lakhs",
        interest: "3 BHK Apartment",
        source: "Website",
        pipeline_stage: "New Lead",
        requirements: "3 BHK, East Facing",
      });
      loadPipeline();
    } catch (err) {
      alert("Failed to create lead: " + err.message);
    }
  };

  if (loading && !pipeline) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mr-3"></div>
        Loading Lead Pipeline...
      </div>
    );
  }

  const stages = pipeline?.stages || [];

  return (
    <div className="space-y-4">
      {/* Top Filter and Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Filter Source:
          </div>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="bg-slate-800 text-xs text-white border border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Sources (Meta, WhatsApp, Google, Web)</option>
            <option value="Meta Ads">Meta Ads</option>
            <option value="Google Ads">Google Ads</option>
            <option value="WhatsApp">WhatsApp</option>
            <option value="Website">Website</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-xs shadow-md shadow-emerald-900/30 flex items-center gap-1.5 transition-all"
          >
            <span>+</span> Quick Add Lead
          </button>
          <button
            onClick={loadPipeline}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700"
            title="Refresh Kanban"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Kanban Horizontal Scrollable Columns */}
      <div className="flex gap-4 overflow-x-auto pb-4 pt-1">
        {stages.map((stage) => {
          // Filter leads by source if selected
          const filteredLeads = stage.leads.filter(
            (l) => sourceFilter === "all" || l.source === sourceFilter
          );

          return (
            <div
              key={stage.stage_id}
              className="w-72 shrink-0 bg-slate-900/70 rounded-2xl border border-slate-800/90 flex flex-col max-h-[750px] shadow-sm"
            >
              {/* Column Header */}
              <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: stage.color || "#3B82F6" }}
                  ></div>
                  <span className="font-semibold text-xs text-white uppercase tracking-wide">
                    {stage.name}
                  </span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold border border-slate-700">
                  {filteredLeads.length}
                </span>
              </div>

              {/* Cards Container */}
              <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1">
                {filteredLeads.map((lead) => (
                  <div
                    key={lead.id}
                    onClick={() => onSelectCustomer(lead.id)}
                    className="group bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 hover:border-indigo-500/50 p-3 rounded-xl cursor-pointer shadow-sm hover:shadow-md transition-all space-y-2"
                  >
                    {/* Header: Name + Lead Score */}
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <h4 className="font-bold text-sm text-white group-hover:text-indigo-300 transition-colors">
                          {lead.name}
                        </h4>
                        <span className="text-[11px] text-slate-400 block truncate max-w-[170px]">
                          {lead.company || lead.location || "Direct Contact"}
                        </span>
                      </div>

                      {/* Lead Score Badge */}
                      <div
                        className={`text-[10px] font-black px-1.5 py-0.5 rounded-md border ${
                          lead.lead_score >= 80
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                            : lead.lead_score >= 60
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                            : "bg-slate-700 text-slate-300 border-slate-600"
                        }`}
                        title="AI Qualified Lead Score (0-100)"
                      >
                        {lead.lead_score} pts
                      </div>
                    </div>

                    {/* Interest / Budget Tag */}
                    <div className="flex flex-wrap gap-1 text-[10px]">
                      {lead.budget && (
                        <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 font-semibold border border-indigo-500/20">
                          {lead.budget}
                        </span>
                      )}
                      <span className="px-1.5 py-0.5 rounded-md bg-slate-700/60 text-slate-300">
                        {lead.source}
                      </span>
                    </div>

                    {/* Assigned Rep & AI Agent */}
                    <div className="pt-1 border-t border-slate-700/40 flex items-center justify-between text-[10px] text-slate-400">
                      <div className="flex items-center gap-1 truncate max-w-[140px]" title={lead.assigned_user}>
                        <span>👤</span>
                        <span className="truncate">{lead.assigned_user.split(" ")[0]}</span>
                      </div>

                      {/* Stage Mover Selector */}
                      <select
                        value={stage.name}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => handleStageChange(e, lead.id, e.target.value)}
                        className="bg-slate-900 border border-slate-700 text-slate-300 text-[10px] rounded px-1.5 py-0.5 hover:border-slate-500 focus:outline-none"
                      >
                        {stages.map((s) => (
                          <option key={s.stage_id} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}

                {filteredLeads.length === 0 && (
                  <div className="text-center py-6 text-slate-500 text-xs italic">
                    No leads in this stage
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Add Lead Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">Create New Lead</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1">Customer / Lead Name *</label>
                <input
                  required
                  type="text"
                  value={newLead.name}
                  onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                  placeholder="e.g. Ramesh Varma"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-300 block mb-1">Phone Number *</label>
                  <input
                    required
                    type="text"
                    value={newLead.phone}
                    onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                    placeholder="+91 98490 ..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1">Email</label>
                  <input
                    type="email"
                    value={newLead.email}
                    onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                    placeholder="name@example.com"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-300 block mb-1">Budget</label>
                  <input
                    type="text"
                    value={newLead.budget}
                    onChange={(e) => setNewLead({ ...newLead, budget: e.target.value })}
                    placeholder="e.g. ₹85 Lakhs"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1">Location</label>
                  <input
                    type="text"
                    value={newLead.location}
                    onChange={(e) => setNewLead({ ...newLead, location: e.target.value })}
                    placeholder="e.g. Kakinada, Gachibowli"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-300 block mb-1">Lead Source</label>
                  <select
                    value={newLead.source}
                    onChange={(e) => setNewLead({ ...newLead, source: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-white"
                  >
                    <option value="Website">Website</option>
                    <option value="Meta Ads">Meta Ads</option>
                    <option value="Google Ads">Google Ads</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Phone calls">Phone Call</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 block mb-1">Initial Stage</label>
                  <select
                    value={newLead.pipeline_stage}
                    onChange={(e) => setNewLead({ ...newLead, pipeline_stage: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-white"
                  >
                    {stages.map((s) => (
                      <option key={s.stage_id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Requirements (comma separated)</label>
                <input
                  type="text"
                  value={newLead.requirements}
                  onChange={(e) => setNewLead({ ...newLead, requirements: e.target.value })}
                  placeholder="3 BHK, Gated Community, East Facing"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold shadow-md shadow-emerald-900/40"
                >
                  Create & Auto-Assign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
