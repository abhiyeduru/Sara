import React, { useState } from "react";
import { crmApi } from "../../services/crmApi";

export default function CRMAISearch({ onSelectCustomer }) {
  const [query, setQuery] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const sampleQueries = [
    "Show me customers interested in 3BHK in Kakinada",
    "Which leads came from Meta this week?",
    "Show customers who asked for a callback",
    "Customers with budget > ₹80 Lakhs",
    "Show deals won and closed",
  ];

  const handleSearch = async (queryString) => {
    const q = queryString || query;
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await crmApi.searchCRM(q);
      setSearchResult(res);
    } catch (e) {
      alert("Search failed: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 p-6 rounded-3xl border border-indigo-500/20 shadow-xl space-y-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <span>🔍</span>
            Natural Language CRM Intelligence Search
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Query your entire customer database, call transcripts, extracted objections, and pipeline stages using plain English.
          </p>
        </div>

        {/* Input Bar */}
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Ask anything (e.g. 'Show me leads from Meta with budget > 80 Lakhs' or 'Who needs a callback?')..."
            className="flex-1 bg-slate-950/80 border border-slate-700/80 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 shadow-inner"
          />
          <button
            onClick={() => handleSearch()}
            disabled={loading}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-bold text-xs shadow-lg shadow-indigo-950/40 transition-all flex items-center gap-2 whitespace-nowrap"
          >
            {loading ? "Searching..." : "Ask CRM AI →"}
          </button>
        </div>

        {/* Query Suggestions */}
        <div className="flex items-center gap-2 flex-wrap text-xs pt-1">
          <span className="text-slate-400 font-semibold">Try asking:</span>
          {sampleQueries.map((sq, idx) => (
            <button
              key={idx}
              onClick={() => {
                setQuery(sq);
                handleSearch(sq);
              }}
              className="px-3 py-1 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-all text-[11px]"
            >
              "{sq}"
            </button>
          ))}
        </div>
      </div>

      {/* Search Results Display */}
      {searchResult && (
        <div className="space-y-4">
          {/* AI Explanation Banner */}
          <div className="bg-emerald-950/20 border border-emerald-500/30 p-4 rounded-2xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">🤖</span>
              <div>
                <span className="font-bold text-emerald-400 block">AI Search Interpretation:</span>
                <p className="text-slate-200">{searchResult.explanation}</p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
              {searchResult.match_count} Matches
            </span>
          </div>

          {/* Matches Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {searchResult.results.map((c) => (
              <div
                key={c.id}
                onClick={() => onSelectCustomer(c.id)}
                className="bg-slate-900/80 hover:bg-slate-850 p-4 rounded-2xl border border-slate-800 hover:border-indigo-500/50 shadow-sm transition-all cursor-pointer space-y-3 group"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-sm text-white group-hover:text-indigo-300 transition-colors">
                      {c.name}
                    </h4>
                    <span className="text-xs text-slate-400 block">{c.company || c.location}</span>
                  </div>

                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 font-bold border border-indigo-500/20">
                    {c.pipeline_stage}
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="text-slate-300 flex justify-between">
                    <span className="text-slate-400">Budget:</span>
                    <strong className="text-emerald-400">{c.budget || "Not stated"}</strong>
                  </div>
                  <div className="text-slate-300 flex justify-between">
                    <span className="text-slate-400">Source:</span>
                    <span>{c.source}</span>
                  </div>
                  <div className="text-slate-300 flex justify-between">
                    <span className="text-slate-400">Lead Score:</span>
                    <strong className="text-amber-400">{c.lead_score}/100</strong>
                  </div>
                </div>

                {c.requirements && c.requirements.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {c.requirements.slice(0, 3).map((r, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {r}
                      </span>
                    ))}
                  </div>
                )}

                <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[11px] text-indigo-400 font-medium">
                  <span>View 360° Profile</span>
                  <span>→</span>
                </div>
              </div>
            ))}
          </div>

          {searchResult.results.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-xs italic bg-slate-900/40 rounded-2xl border border-slate-800">
              No matching records found. Try a different query.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
