import React, { useState, useEffect } from 'react';
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
import CampaignsStudio from './components/pages/CampaignsStudio';
import ComingSoon from './components/pages/ComingSoon';
import LoginModal from './components/auth/LoginModal';
import BusinessOnboardingModal from './components/auth/BusinessOnboardingModal';

import { UsersRound, GraduationCap, Zap, Megaphone, PhoneIncoming, MessageCircle,
  Inbox, UserCheck, Users, BarChart3, Cpu, Hash, Code2, Activity, Sparkles, Mic } from 'lucide-react';

const PAGE_META = {
  dashboard:         { title: 'Dashboard', subtitle: 'Good morning — your AI workforce at a glance' },
  'talk-sara':       { title: 'Talk with Sara', subtitle: 'Live human-like conversational voice agent' },
  ask:               { title: 'Ask Sara', subtitle: 'Your AI workplace assistant' },
  employees:         { title: 'My AI Employees', subtitle: 'Manage your AI workforce' },
  'employees/new':   { title: 'Create AI Employee', subtitle: 'Build a new AI employee with Sara' },
  'employee-detail': { title: 'Farhan — Real Estate Lead Caller', subtitle: 'AI Employee Profile & Call Script Studio' },
  teams:             { title: 'AI Teams', subtitle: 'Organize AI employees into teams' },
  tasks:             { title: 'Task Center', subtitle: 'All AI and human tasks' },
  workflows:         { title: 'Workflows', subtitle: 'Automated business workflows' },
  training:          { title: 'Knowledge & Training', subtitle: 'Train your AI employees with business facts' },
  calls:             { title: 'Voice Calls', subtitle: 'AI-powered voice calling dashboard' },
  'instant-leads':   { title: 'Instant Lead Calling', subtitle: 'Self-serve direct outbound calling with Sara' },
  campaigns:         { title: 'Saadhyam Voice AI Studio', subtitle: 'Self-serve single dialer & Google Sheet auto campaigns' },
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

    case 'instant-leads':   return <CampaignsStudio onNavigate={onNavigate} />;
    case 'campaigns':       return <CampaignsStudio onNavigate={onNavigate} />;
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
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('sara_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [page, setPage] = useState('campaigns');
  const [pageParams, setPageParams] = useState({});
  const [showAskSara, setShowAskSara] = useState(false);
  const meta = PAGE_META[page] || {};

  // Check URL params & hash fragment for Google OAuth redirect callback
  useEffect(() => {
    try {
      // Normalize path if user was routed to an auth or API endpoint
      if (window.location.pathname.includes('/auth/google')) {
        window.history.replaceState({}, document.title, '/' + window.location.search + window.location.hash);
      }

      const urlParams = new URLSearchParams(window.location.search);
      let hashParams = new URLSearchParams();
      if (window.location.hash && window.location.hash.startsWith('#')) {
        hashParams = new URLSearchParams(window.location.hash.substring(1));
      }

      const parseJwt = (token) => {
        try {
          const base64Url = token.split('.')[1];
          if (!base64Url) return null;
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(
            atob(base64)
              .split('')
              .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              .join('')
          );
          return JSON.parse(jsonPayload);
        } catch (e) {
          return null;
        }
      };

      if (urlParams.get('google_auth') === 'success') {
        const token = urlParams.get('token') || '';
        const userObj = {
          id: urlParams.get('user_id'),
          name: decodeURIComponent(urlParams.get('name') || ''),
          email: decodeURIComponent(urlParams.get('email') || ''),
          avatar_url: decodeURIComponent(urlParams.get('avatar') || ''),
          auth_provider: 'google'
        };
        const needsSetup = urlParams.get('needs_onboarding') === '1';

        localStorage.setItem('sara_token', token);
        localStorage.setItem('sara_user', JSON.stringify(userObj));
        setCurrentUser(userObj);
        setNeedsOnboarding(needsSetup);
        if (needsSetup) {
          setShowOnboarding(true);
        }
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (hashParams.get('id_token') || hashParams.get('access_token')) {
        const rawToken = hashParams.get('id_token') || hashParams.get('access_token');
        const jwtPayload = parseJwt(rawToken);
        if (jwtPayload && jwtPayload.email) {
          const userObj = {
            id: `google_${jwtPayload.sub || Date.now()}`,
            name: jwtPayload.name || jwtPayload.given_name || jwtPayload.email.split('@')[0],
            email: jwtPayload.email,
            avatar_url: jwtPayload.picture || '',
            auth_provider: 'google'
          };
          localStorage.setItem('sara_token', rawToken);
          localStorage.setItem('sara_user', JSON.stringify(userObj));
          setCurrentUser(userObj);
          setNeedsOnboarding(false);
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } else if (currentUser) {
        fetch('/api/v1/auth/me')
          .then(r => r.json())
          .then(data => {
            if (data && data.needs_business_onboarding) {
              setNeedsOnboarding(true);
              setShowOnboarding(true);
            }
          })
          .catch(() => {});
      }
    } catch (e) {
      console.error('Auth callback error:', e);
    }
  }, []);

  const handleNavigate = (newPage, params = {}) => {
    setPage(newPage);
    setPageParams(params || {});
  };

  const handleLogout = () => {
    localStorage.removeItem('sara_token');
    localStorage.removeItem('sara_user');
    setCurrentUser(null);
    setNeedsOnboarding(false);
    setShowOnboarding(false);
  };

  // Ask and Voice Assistant are full-screen without standard topbar
  const isFullPage = page === 'ask' || page === 'talk-sara';

  // 1. If not logged in, show Google Login screen
  if (!currentUser) {
    return (
      <LoginModal
        onLoginSuccess={(user, needsSetup) => {
          setCurrentUser(user);
          setNeedsOnboarding(needsSetup);
          if (needsSetup) {
            setShowOnboarding(true);
          }
        }}
      />
    );
  }

  return (
    <div className="app-shell">
      {/* Step 2: Post-Login Business Details Onboarding Modal */}
      {showOnboarding && (
        <BusinessOnboardingModal
          user={currentUser}
          onBack={handleLogout}
          onComplete={(bizData) => {
            setShowOnboarding(false);
            setNeedsOnboarding(false);
            handleNavigate('campaigns');
          }}
        />
      )}

      {/* Sidebar */}
      <Sidebar activePage={page} onNavigate={handleNavigate} />

      {/* Main */}
      <div className="main-content">
        {/* Topbar */}
        {!isFullPage && (
          <Topbar
            title={meta.title}
            subtitle={meta.subtitle}
            onAskSara={() => setShowAskSara(s => !s)}
            onTalkWithSara={() => handleNavigate('talk-sara')}
            currentUser={currentUser}
            onLogout={handleLogout}
            onOpenOnboarding={() => setShowOnboarding(true)}
          />
        )}

        {/* Page */}
        <div style={{ flex: 1, overflow: 'auto' }}>
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
