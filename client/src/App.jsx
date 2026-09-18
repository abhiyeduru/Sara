import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import VoiceScreen from './components/voice/VoiceScreen';
import AgentBuilder from './components/builder/AgentBuilder';
import TestConsole from './components/console/TestConsole';
import { api } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('voice'); // 'voice' | 'builder' | 'console'
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
      setAgents(list);
      if (list && list.length > 0) {
        setCurrentAgent(list[0]);
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
    setAgents((prev) => [newAgent, ...prev]);
    setCurrentAgent(newAgent);
    setActiveTab('voice');
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
              <AgentBuilder
                onAgentCreated={handleAgentCreated}
                onSelectAgent={handleSelectAgent}
              />
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
