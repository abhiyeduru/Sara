import { request } from "./api";

export const crmApi = {
  // Customers & Leads
  getCustomers: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/crm/customers${query ? `?${query}` : ""}`);
  },
  getCustomer: (id) => request(`/api/crm/customers/${id}`),
  createCustomer: (data) =>
    request("/api/crm/customers", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCustomer: (id, data) =>
    request(`/api/crm/customers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // 1-Click AI Intelligence
  getOneClickSummary: (id) =>
    request(`/api/crm/customers/${id}/summarize`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  getEmployeeHandoff: (id) =>
    request(`/api/crm/customers/${id}/handoff`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  // Pipeline & Kanban
  getPipeline: () => request("/api/crm/pipeline"),

  // Calls, Recordings & Diarized Transcripts
  getCalls: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/crm/calls${query ? `?${query}` : ""}`);
  },
  getCallDetail: (id) => request(`/api/crm/calls/${id}`),
  analyzeCall: (id) =>
    request(`/api/crm/calls/${id}/analyze`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  getStreamUrl: (callId) => `/api/crm/calls/${callId}/recording/stream`,

  // Natural Language Search & Copilot
  searchCRM: (query) =>
    request("/api/crm/search", {
      method: "POST",
      body: JSON.stringify({ query }),
    }),

  // Executive BI Analytics
  getAnalytics: (role = "CEO") => request(`/api/crm/analytics?role=${encodeURIComponent(role)}`),

  // Tasks & Follow-ups
  getTasks: (status = "") => request(`/api/crm/tasks${status ? `?status_filter=${status}` : ""}`),
  updateTask: (id, data) =>
    request(`/api/crm/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // Automations
  getAutomations: () => request("/api/crm/automations"),
  createAutomation: (data) =>
    request("/api/crm/automations", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // WhatsApp & Email Communications
  getCommunications: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/crm/communications${query ? `?${query}` : ""}`);
  },
  sendCommunication: (data) =>
    request("/api/crm/communications", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Meetings
  getMeetings: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/crm/meetings${query ? `?${query}` : ""}`);
  },
  scheduleMeeting: (data) =>
    request("/api/crm/meetings", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Duplicate Detection & Merge (Section 31)
  getDuplicates: () => request("/api/crm/duplicates"),
  mergeCustomers: (primaryId, secondaryId) =>
    request("/api/crm/duplicates/merge", {
      method: "POST",
      body: JSON.stringify({ primary_id: primaryId, secondary_id: secondaryId }),
    }),

  // Privacy & Retention Settings (Sections 29, 30)
  getSettings: () => request("/api/crm/settings"),
  updateSettings: (data) =>
    request("/api/crm/settings", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // AI Sales Assistant Copilot (Section 18)
  getCopilotAdvice: (customerId) =>
    request("/api/crm/copilot", {
      method: "POST",
      body: JSON.stringify({ customer_id: customerId }),
    }),
};
