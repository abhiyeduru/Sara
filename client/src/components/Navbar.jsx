import React from 'react';
import { Sparkles, Mic, Activity, Sliders, ShieldCheck, Database } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, currentAgent, agents, onSelectAgent }) {
  return (
    <header className="sticky top-0 z-50 w-full glass-panel border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('voice')}>
          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-lg shadow-white/10">
            <span className="text-black font-bold text-xs tracking-widest">S</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold tracking-wider text-base text-white">S A R A</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-sara-300 font-mono">v1.0</span>
            </div>
            <p className="text-[10px] text-sara-400">Configurable Multilingual Voice Agent</p>
          </div>
        </div>

        {/* Navigation Switcher */}
        <nav className="flex items-center p-1 bg-sara-900/80 rounded-lg border border-white/5">
          <button
            onClick={() => setActiveTab('voice')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'voice'
                ? 'bg-white text-black shadow-sm'
                : 'text-sara-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Voice Agent</span>
          </button>

          <button
            onClick={() => setActiveTab('builder')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'builder'
                ? 'bg-white text-black shadow-sm'
                : 'text-sara-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Agent Builder</span>
          </button>

          <button
            onClick={() => setActiveTab('console')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'console'
                ? 'bg-white text-black shadow-sm'
                : 'text-sara-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Test & Latency</span>
          </button>
        </nav>

        {/* Right side: Agent selector & DB Status */}
        <div className="flex items-center gap-3">
          {agents && agents.length > 0 && (
            <select
              value={currentAgent?.id || ''}
              onChange={(e) => onSelectAgent(e.target.value)}
              className="bg-sara-900 text-xs text-sara-200 border border-white/10 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-white/30"
            >
              {agents.map((ag) => (
                <option key={ag.id} value={ag.id}>
                  {ag.name} ({ag.business_type})
                </option>
              ))}
            </select>
          )}

          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-white/5 border border-white/10 rounded text-[11px] text-sara-300">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
            <span className="font-mono">Neon DB Connected</span>
          </div>
        </div>
      </div>
    </header>
  );
}
