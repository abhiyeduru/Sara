import { getCurrentUserToken } from "./firebase";

const API_BASE = ""; // Relative path proxied by Vite to http://localhost:8000

export async function request(endpoint, options = {}) {
  const token = await getCurrentUserToken();
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `HTTP error ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Health
  getHealth: () => request("/api/health"),

  // Business Templates
  getCategories: () => request("/api/agents/categories"),

  // Agents
  getAgents: () => request("/api/agents"),
  getAgent: (id) => request(`/api/agents/${id}`),
  createAgent: (data) => request("/api/agents", { method: "POST", body: JSON.stringify(data) }),
  updateAgent: (id, data) => request(`/api/agents/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  regeneratePrompt: (id) => request(`/api/agents/${id}/generate-prompt`, { method: "POST" }),

  // FAQs
  addFAQ: (agentId, data) => request(`/api/agents/${agentId}/faqs`, { method: "POST", body: JSON.stringify(data) }),
  deleteFAQ: (agentId, faqId) => request(`/api/agents/${agentId}/faqs/${faqId}`, { method: "DELETE" }),

  // Voices
  getVoices: (gender) => request(`/api/voices${gender ? `?gender=${gender}` : ''}`),
  getVoicePreviewUrl: (voiceId, text, lang) => `/api/voices/preview/${voiceId}?text=${encodeURIComponent(text)}&language=${lang || 'en'}`,

  // Sessions & Latency Metrics
  getAgentSessions: (agentId) => request(`/api/sessions/agent/${agentId}`),
  getSessionDetail: (sessionId) => request(`/api/sessions/${sessionId}`),
  getSessionLatencies: (sessionId) => request(`/api/sessions/${sessionId}/latencies`)
};
