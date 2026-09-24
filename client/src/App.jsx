import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import VoiceScreen from './components/voice/VoiceScreen';
import AgentBuilder from './components/builder/AgentBuilder';
import AgentCompilerStudio from './components/builder/AgentCompilerStudio';
import TestConsole from './components/console/TestConsole';
import CRMWorkspace from './components/crm/CRMWorkspace';
import { api } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('voice'); // 'voice' | 'builder' | 'console'
  const [builderMode, setBuilderMode] = useState('compiler'); // 'compiler' | 'wizard'
  const [agents, setAgents] = useState([]);
  const [currentAgent, setCurrentAgent] = useState(null);
  const [latestMetrics, setLatestMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAgents();
  }, []);

  async function loadAgents() {
    setLoading(true);
    try {
      const list = await api.getAgents();
      const unique = Array.from(new Map((list || []).map((a) => [a.id, a])).values());
      setAgents(unique);
      if (unique && unique.length > 0) {
        setCurrentAgent(unique[0]);
      }
    } catch (err) {
      console.error('Error loading voice agents:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectAgent(agentId) {
    const selected = agents.find((a) => a.id === agentId);
    if (selected) {
      setCurrentAgent(selected);
    }
  }

  function handleAgentCreated(newAgent) {
    if (!newAgent || !newAgent.id) return;
    setAgents((prev) => [newAgent, ...prev.filter((a) => a.id !== newAgent.id)]);
    setCurrentAgent(newAgent);
  }

  return (
    <div className="min-h-screen bg-sara-950 text-sara-100 flex flex-col selection:bg-white selection:text-black">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentAgent={currentAgent}
        agents={agents}
        onSelectAgent={handleSelectAgent}
      />

      {/* Main Tab Content */}
      <main className="flex-1">
        {loading ? (
          <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
            <div className="text-center">
              <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin mx-auto mb-3"></div>
              <p className="text-xs text-sara-400 font-mono">Initializing SARA Voice Engine...</p>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'voice' && (
              <VoiceScreen
                agent={currentAgent}
                onTurnMetrics={(m) => setLatestMetrics(m)}
              />
            )}

            {activeTab === 'builder' && (
              <div>
                {/* Mode Switcher Banner */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 flex items-center justify-end">
                  <div className="flex items-center gap-1 p-1 bg-sara-900 border border-white/10 rounded-lg text-xs">
                    <button
                      onClick={() => setBuilderMode('compiler')}
                      className={`px-3 py-1 rounded-md transition-all ${
                        builderMode === 'compiler'
                          ? 'bg-white text-black font-semibold'
                          : 'text-sara-400 hover:text-white'
                      }`}
                    >
                      Natural Input Studio
                    </button>
                    <button
                      onClick={() => setBuilderMode('wizard')}
                      className={`px-3 py-1 rounded-md transition-all ${
                        builderMode === 'wizard'
                          ? 'bg-white text-black font-semibold'
                          : 'text-sara-400 hover:text-white'
                      }`}
                    >
                      10-Step Wizard
                    </button>
                  </div>
                </div>

                {builderMode === 'compiler' ? (
                  <AgentCompilerStudio
                    currentAgent={currentAgent}
                    onAgentCreated={handleAgentCreated}
                    onSelectAgent={handleSelectAgent}
                  />
                ) : (
                  <AgentBuilder
                    onAgentCreated={handleAgentCreated}
                    onSelectAgent={handleSelectAgent}
                  />
                )}
              </div>
            )}


            {activeTab === 'crm' && (
              <CRMWorkspace />
            )}

            {activeTab === 'console' && (
              <TestConsole
                agent={currentAgent}
                currentMetrics={latestMetrics}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
