import React, { useState, useEffect } from "react";
import { crmApi } from "../../services/crmApi";

export default function CallRecordingHub({ onSelectCustomer }) {
  const [calls, setCalls] = useState([]);
  const [selectedCallId, setSelectedCallId] = useState(null);
  const [callDetail, setCallDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    loadCalls();
  }, []);

  const loadCalls = async () => {
    setLoading(true);
    try {
      const data = await crmApi.getCalls();
      setCalls(data.calls || []);
      if (data.calls && data.calls.length > 0) {
        setSelectedCallId(data.calls[0].id);
        loadCallDetail(data.calls[0].id);
      }
    } catch (e) {
      console.error("Failed to load calls:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadCallDetail = async (callId) => {
    try {
      const detail = await crmApi.getCallDetail(callId);
      setCallDetail(detail);
    } catch (e) {
      console.error("Failed to load call detail:", e);
    }
  };

  const handleSelectCall = (callId) => {
    setSelectedCallId(callId);
    loadCallDetail(callId);
  };

  const handleTriggerAnalysis = async () => {
    if (!selectedCallId) return;
    setAnalyzing(true);
    try {
      await crmApi.analyzeCall(selectedCallId);
      loadCallDetail(selectedCallId);
      loadCalls();
    } catch (e) {
      alert("Failed to analyze call: " + e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading && calls.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mr-3"></div>
        Loading Conversation Intelligence & Recordings...
      </div>
    );
  }

  const intel = callDetail?.intelligence || {};
  const transcripts = callDetail?.transcripts || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column: Call Recordings List */}
      <div className="lg:col-span-5 space-y-3">
        <div className="flex items-center justify-between pb-1">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <span>🎙️</span>
            Recorded Conversations
          </h3>
          <span className="text-xs text-slate-400">{calls.length} calls captured</span>
        </div>

        <div className="space-y-2.5 max-h-[750px] overflow-y-auto pr-1">
          {calls.map((c) => {
            const isSelected = c.id === selectedCallId;
            return (
              <div
                key={c.id}
                onClick={() => handleSelectCall(c.id)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  isSelected
                    ? "bg-slate-800/90 border-emerald-500/60 shadow-lg shadow-emerald-950/20"
                    : "bg-slate-900/60 hover:bg-slate-800/50 border-slate-800"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-sm text-white">{c.customer_name}</h4>
                    <span className="text-xs text-slate-400 block">{c.phone_number || "Direct Audio"}</span>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      c.sentiment === "Interested" || c.sentiment === "Positive"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        : "bg-slate-700 text-slate-300 border-slate-600"
                    }`}
                  >
                    {c.sentiment || "Analyzed"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 mt-2.5 pt-2 border-t border-slate-700/40">
                  <span className="flex items-center gap-1">
                    <span>⏱️</span> {c.duration_seconds}s
                  </span>
                  <span>{c.direction}</span>
                  <span className="text-indigo-400 font-medium">{c.purchase_intent} Intent</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column: Audio Player + Diarized Transcript + AI Intelligence */}
      <div className="lg:col-span-7 space-y-5">
        {callDetail ? (
          <>
            {/* Audio Player Card */}
            <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 shadow-md space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <span>🔊</span>
                    Audio Recording & Transcripts
                  </h3>
                  <span className="text-xs text-slate-400">
                    Caller: {callDetail.customer_name} • Duration: {callDetail.duration_seconds}s • Authenticated Storage
                  </span>
                </div>

                <button
                  onClick={handleTriggerAnalysis}
                  disabled={analyzing}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-md shadow-emerald-950/30 flex items-center gap-1.5 transition-all"
                >
                  <span>⚡</span> {analyzing ? "Analyzing..." : "Re-Analyze AI"}
                </button>
              </div>

              {/* HTML5 Audio Player */}
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex items-center justify-center">
                <audio
                  controls
                  src={`/api/crm/calls/${callDetail.id}/recording/stream`}
                  className="w-full h-10"
                />
              </div>
            </div>

            {/* AI Conversation Intelligence Card */}
            <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 shadow-md space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h4 className="font-bold text-sm text-emerald-400 flex items-center gap-1.5 uppercase tracking-wide text-xs">
                  <span>🧠</span>
                  AI Conversation Intelligence Extraction
                </h4>
                <div className="flex gap-2 text-xs">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                    Sentiment: {intel.sentiment || "Interested"}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                    Purchase Intent: {intel.purchase_intent || "High"}
                  </span>
                </div>
              </div>

              {/* Intent & Budget tags */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/50">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                    Customer Intent
                  </span>
                  <p className="text-white font-medium">{intel.customer_intent || "Residential property enquiry"}</p>
                </div>

                <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/50">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                    Budget & Timeline
                  </span>
                  <p className="text-white font-medium">
                    Budget: <strong className="text-emerald-400">{intel.budget || "Not specified"}</strong> • Timeline: {intel.timeline || "Flexible"}
                  </p>
                </div>
              </div>

              {/* Requirements & Objections */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/50 space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">
                    Extracted Requirements
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {(intel.requirements || []).map((r, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/50 space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">
                    Customer Objections / Hesitations
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {(intel.objections || []).map((obj, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20">
                        ⚠️ {obj}
                      </span>
                    ))}
                    {(!intel.objections || intel.objections.length === 0) && (
                      <span className="text-slate-400 italic">None stated</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Automatic Call Summary Box */}
              <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Automatic Structured Call Summary
                </span>
                <div className="font-mono text-xs text-slate-200 whitespace-pre-line leading-relaxed">
                  {intel.call_summary || "Call processed and summarized."}
                </div>
              </div>

              {/* Recommended Next Action */}
              <div className="p-3 bg-indigo-950/30 rounded-xl border border-indigo-500/30 text-xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-indigo-400 block">
                    Next Recommended Action
                  </span>
                  <p className="text-white font-medium mt-0.5">{intel.next_recommended_action}</p>
                </div>
                {callDetail.customer_id && (
                  <button
                    onClick={() => onSelectCustomer(callDetail.customer_id)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs whitespace-nowrap ml-3"
                  >
                    View Customer Profile →
                  </button>
                )}
              </div>
            </div>

            {/* Speaker Diarized Transcripts Drawer */}
            <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 shadow-md space-y-3">
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <span>💬</span>
                Speaker Diarized Transcript
              </h4>

              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {transcripts.map((seg, idx) => {
                  const isAgent = seg.speaker.toLowerCase() === "agent";
                  return (
                    <div
                      key={seg.id || idx}
                      className={`p-3 rounded-xl border text-xs leading-relaxed ${
                        isAgent
                          ? "bg-slate-800/40 border-cyan-500/20 text-slate-200 ml-4"
                          : "bg-emerald-950/20 border-emerald-500/20 text-emerald-100 mr-4"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-bold ${isAgent ? "text-cyan-300" : "text-emerald-400"}`}>
                          {seg.speaker_name || seg.speaker}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {seg.start_time_offset.toFixed(1)}s - {seg.end_time_offset.toFixed(1)}s
                        </span>
                      </div>
                      <p>{seg.text}</p>
                    </div>
                  );
                })}

                {transcripts.length === 0 && (
                  <div className="text-center py-6 text-slate-400 text-xs italic">
                    No transcript segments available for this call.
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-16 text-slate-400 text-xs italic bg-slate-900/40 rounded-2xl border border-slate-800">
            Select a call on the left to inspect audio recordings, diarized transcript, and AI extracted intelligence.
          </div>
        )}
      </div>
    </div>
  );
}
