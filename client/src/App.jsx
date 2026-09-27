import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';

// Pages
import Dashboard from './components/pages/Dashboard';
import AskSara from './components/pages/AskSara';
import Employees from './components/pages/Employees';
import CreateEmployee from './components/pages/CreateEmployee';
import EmployeeDetail from './components/pages/EmployeeDetail';
import Tasks from './components/pages/Tasks';
import Workflows from './components/pages/Workflows';
import VoiceCalls from './components/pages/VoiceCalls';
import Leads from './components/pages/Leads';
import CRM from './components/pages/CRM';
import Analytics from './components/pages/Analytics';
import Approvals from './components/pages/Approvals';
import Integrations from './components/pages/Integrations';
import Billing from './components/pages/Billing';
import SettingsPage from './components/pages/SettingsPage';
import Knowledge from './components/pages/Knowledge';
import ActivityLog from './components/pages/ActivityLog';
import Teams from './components/pages/Teams';
import MCPConnections from './components/pages/MCPConnections';
import PhoneNumbers from './components/pages/PhoneNumbers';
import TalkWithSara from './components/pages/TalkWithSara';
import ComingSoon from './components/pages/ComingSoon';

import { UsersRound, GraduationCap, Zap, Megaphone, PhoneIncoming, MessageCircle,
  Inbox, UserCheck, Users, BarChart3, Cpu, Hash, Code2, Activity, Sparkles, Mic } from 'lucide-react';

const PAGE_META = {
  dashboard:         { title: 'Dashboard', subtitle: 'Good morning — your AI workforce at a glance' },
  'talk-sara':       { title: 'Talk with Sara', subtitle: 'Live human-like conversational voice agent' },
  ask:               { title: 'Ask Sara', subtitle: 'Your AI workplace assistant' },
  employees:         { title: 'My AI Employees', subtitle: 'Manage your AI workforce' },
  'employees/new':   { title: 'Create AI Employee', subtitle: 'Build a new AI employee with Sara' },
  'employee-detail': { title: 'Lakshmi — Sales AI', subtitle: 'AI Employee Profile' },
  teams:             { title: 'AI Teams', subtitle: 'Organize AI employees into teams' },
  tasks:             { title: 'Task Center', subtitle: 'All AI and human tasks' },
  workflows:         { title: 'Workflows', subtitle: 'Automated business workflows' },
  training:          { title: 'Knowledge & Training', subtitle: 'Train your AI employees with business facts' },
  calls:             { title: 'Voice Calls', subtitle: 'AI-powered voice calling dashboard' },
  'instant-leads':   { title: 'Instant Leads', subtitle: 'Real-time lead management' },
  campaigns:         { title: 'Campaigns', subtitle: 'Bulk outreach campaigns' },
  inbound:           { title: 'Inbound Calls', subtitle: 'Manage incoming calls' },
  whatsapp:          { title: 'WhatsApp', subtitle: 'WhatsApp AI inbox' },
  conversations:     { title: 'Conversations', subtitle: 'Unified communication center' },
  crm:               { title: 'CRM', subtitle: 'AI-managed sales pipeline' },
  leads:             { title: 'Leads', subtitle: 'Lead database and management' },
  customers:         { title: 'Customers', subtitle: 'Customer database' },
  reports:           { title: 'Reports', subtitle: 'Business intelligence reports' },
  analytics:         { title: 'Analytics', subtitle: 'Executive analytics dashboard' },
  integrations:      { title: 'Integrations', subtitle: 'Connected apps and services' },
  mcp:               { title: 'MCP Connections', subtitle: 'Model Context Protocol tool connections' },
  'phone-numbers':   { title: 'Phone Numbers', subtitle: 'Manage phone lines' },
  developers:        { title: 'API & Webhooks', subtitle: 'Developer settings' },
  approvals:         { title: 'Approvals', subtitle: 'Review AI actions' },
  activity:          { title: 'Activity & Audit Log', subtitle: 'Audit trail for all AI actions' },
  billing:           { title: 'Billing', subtitle: 'Subscription and usage' },
  settings:          { title: 'Settings', subtitle: 'Workspace preferences' },
};

function renderPage(page, onNavigate, pageParams = {}) {
  switch (page) {
    case 'dashboard':       return <Dashboard onNavigate={onNavigate} />;
    case 'talk-sara':       return <TalkWithSara onNavigate={onNavigate} />;
    case 'ask':             return <AskSara onNavigate={onNavigate} />;
    case 'employees':       return <Employees onNavigate={onNavigate} />;
    case 'employees/new':   return <CreateEmployee onNavigate={onNavigate} />;
    case 'employee-detail': return <EmployeeDetail onNavigate={onNavigate} employeeId={pageParams?.employeeId} />;
    case 'teams':           return <Teams onNavigate={onNavigate} />;
    case 'tasks':           return <Tasks onNavigate={onNavigate} />;
    case 'workflows':       return <Workflows onNavigate={onNavigate} />;
    case 'training':        return <Knowledge onNavigate={onNavigate} />;
    case 'calls':           return <VoiceCalls onNavigate={onNavigate} />;
    case 'leads':           return <Leads onNavigate={onNavigate} />;
    case 'crm':             return <CRM onNavigate={onNavigate} />;
    case 'analytics':       return <Analytics onNavigate={onNavigate} />;
    case 'approvals':       return <Approvals onNavigate={onNavigate} />;
    case 'integrations':    return <Integrations onNavigate={onNavigate} />;
    case 'mcp':             return <MCPConnections onNavigate={onNavigate} />;
    case 'phone-numbers':   return <PhoneNumbers onNavigate={onNavigate} />;
    case 'activity':        return <ActivityLog onNavigate={onNavigate} />;
    case 'billing':         return <Billing onNavigate={onNavigate} />;
    case 'settings':        return <SettingsPage onNavigate={onNavigate} />;

    case 'instant-leads':   return <ComingSoon title="Instant Leads" subtitle="Receive and auto-route leads to AI employees in real-time." icon={Zap} ctaLabel="Configure Lead Routing" onCta={() => {}} />;
    case 'campaigns':       return <ComingSoon title="Campaigns" subtitle="Launch bulk AI-powered outreach campaigns." icon={Megaphone} ctaLabel="Create Campaign" onCta={() => {}} />;
    case 'inbound':         return <ComingSoon title="Inbound Calls" subtitle="Configure AI employees to handle inbound customer calls." icon={PhoneIncoming} ctaLabel="Set Up Inbound" onCta={() => {}} />;
    case 'whatsapp':        return <ComingSoon title="WhatsApp" subtitle="Connect WhatsApp Business to your AI employees." icon={MessageCircle} ctaLabel="Connect WhatsApp" onCta={() => onNavigate('integrations')} />;
    case 'conversations':   return <ComingSoon title="Conversations" subtitle="Unified inbox for all AI-customer interactions." icon={Inbox} ctaLabel="View Calls" onCta={() => onNavigate('calls')} />;
    case 'customers':       return <ComingSoon title="Customers" subtitle="Full customer database with AI interaction history." icon={Users} ctaLabel="View Leads" onCta={() => onNavigate('leads')} />;
    case 'reports':         return <ComingSoon title="Reports" subtitle="Generate AI-powered business intelligence reports." icon={BarChart3} ctaLabel="View Analytics" onCta={() => onNavigate('analytics')} />;
    case 'developers':      return <ComingSoon title="API & Webhooks" subtitle="Access Sara AI via REST API and configure webhooks." icon={Code2} ctaLabel="View Docs" onCta={() => {}} />;

    default: return <Dashboard onNavigate={onNavigate} />;
  }
}

// Ask Sara Floating Panel
function AskSaraPanel({ onClose, currentPage }) {
  const [msg, setMsg] = useState('');
  return (
    <div style={{ position:'fixed', bottom:90, right:24, width:360, background:'#fff',
      borderRadius:16, boxShadow:'0 20px 60px rgba(0,0,0,0.15)', border:'1px solid var(--border)',
      zIndex:200, animation:'slideUp 0.3s cubic-bezier(0.16,1,0.3,1)', overflow:'hidden' }}>
      <div style={{ padding:'16px', background:'linear-gradient(135deg,#7c3aed,#6d28d9)', color:'#fff',
        display:'flex', alignItems:'center', gap:10 }}>
        <Sparkles size={18} />
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:700, fontSize:14 }}>Ask Sara</div>
          <div style={{ fontSize:11, opacity:0.8 }}>Context: {PAGE_META[currentPage]?.title || 'Dashboard'}</div>
        </div>
        <button onClick={onClose} style={{ background:'transparent', border:'none', color:'#fff', cursor:'pointer', fontSize:18, lineHeight:1 }}>×</button>
      </div>
      <div style={{ padding:14 }}>
        <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:10 }}>
          Ask about this page or anything in your workspace...
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input
            className="input"
            placeholder="Type your question..."
            value={msg}
            onChange={e=>setMsg(e.target.value)}
            style={{ flex:1 }}
          />
          <button className="btn btn-primary btn-icon"><Sparkles size={14} /></button>
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:10 }}>
          {['Show summary','Create task','View analytics'].map(s => (
            <button key={s} className="chip" style={{ fontSize:11 }} onClick={()=>setMsg(s)}>{s}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [pageParams, setPageParams] = useState({});
  const [showAskSara, setShowAskSara] = useState(false);
  const meta = PAGE_META[page] || {};

  const handleNavigate = (newPage, params = {}) => {
    setPage(newPage);
    setPageParams(params || {});
  };

  // Ask and Voice Assistant are full-screen without standard topbar
  const isFullPage = page === 'ask' || page === 'talk-sara';

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <Sidebar activePage={page} onNavigate={handleNavigate} />

      {/* Main */}
      <div className="main-content">
        {/* Topbar — hide for Ask Sara & Voice Assistant (they have dedicated headers) */}
        {!isFullPage && (
          <Topbar
            title={meta.title}
            subtitle={meta.subtitle}
            onAskSara={() => setShowAskSara(s => !s)}
            onTalkWithSara={() => handleNavigate('talk-sara')}
          />
        )}

        {/* Page */}
        <div style={{ flex:1, overflow:'auto' }}>
          {renderPage(page, handleNavigate, pageParams)}
        </div>
      </div>

      {/* Floating Ask Sara Button */}
      {!isFullPage && (
        <button className="ask-sara-fab" onClick={() => setShowAskSara(s => !s)} title="Ask Sara">
          <Sparkles size={22} />
        </button>
      )}

      {/* Ask Sara Panel */}
      {showAskSara && !isFullPage && (
        <AskSaraPanel onClose={() => setShowAskSara(false)} currentPage={page} />
      )}
    </div>
  );
}
