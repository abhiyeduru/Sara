import React from 'react';
import {
  LayoutDashboard, MessageSquare, Users, UsersRound, PlusCircle,
  CheckSquare, GitBranch, GraduationCap, Phone, Zap, Megaphone,
  PhoneIncoming, MessageCircle, Inbox, Building2, UserCheck,
  BarChart3, LineChart, Grid2x2, Link, Cpu, Hash, Code2,
  CreditCard, Settings, ChevronDown, Bot, Sparkles,
  Bell, Shield, ShieldCheck, Activity, Mic
} from 'lucide-react';

const NAV = [
  {
    section: 'Overview',
    items: [
      { id: 'dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
      { id: 'talk-sara',    label: 'Talk with Sara', icon: Mic },
    ]
  },
  {
    section: 'AI Workforce',
    items: [
      { id: 'employees',        label: 'My AI Employees',     icon: Bot },
      { id: 'teams',            label: 'AI Teams',            icon: UsersRound },
      { id: 'tasks',            label: 'Tasks',               icon: CheckSquare },
      { id: 'workflows',        label: 'Workflows',           icon: GitBranch },
      { id: 'training',         label: 'Training',            icon: GraduationCap },
    ]
  },
  {
    section: 'Communication',
    items: [
      { id: 'calls',        label: 'Voice Calls',     icon: Phone },
      { id: 'instant-leads',label: 'Instant Leads',   icon: Zap },
      { id: 'campaigns',    label: 'Campaigns',       icon: Megaphone },
      { id: 'inbound',      label: 'Inbound Calls',   icon: PhoneIncoming },
      { id: 'whatsapp',     label: 'WhatsApp',        icon: MessageCircle },
      { id: 'conversations',label: 'Conversations',   icon: Inbox },
    ]
  },
  {
    section: 'Business',
    items: [
      { id: 'crm',       label: 'CRM',       icon: Building2 },
      { id: 'leads',     label: 'Leads',     icon: UserCheck },
      { id: 'customers', label: 'Customers', icon: Users },
      { id: 'reports',   label: 'Reports',   icon: BarChart3 },
      { id: 'analytics', label: 'Analytics', icon: LineChart },
    ]
  },
  {
    section: 'Integrations',
    items: [
      { id: 'integrations',  label: 'Apps',           icon: Grid2x2 },
      { id: 'mcp',           label: 'MCP Connections', icon: Cpu },
      { id: 'phone-numbers', label: 'Phone Numbers',  icon: Hash },
      { id: 'developers',    label: 'API & Webhooks', icon: Code2 },
    ]
  },
  {
    section: 'Administration',
    items: [
      { id: 'admin',     label: 'Admin Panel',  icon: ShieldCheck },
      { id: 'approvals', label: 'Approvals',   icon: Shield },
      { id: 'activity',  label: 'Activity Log', icon: Activity },
      { id: 'billing',   label: 'Billing',      icon: CreditCard },
      { id: 'settings',  label: 'Settings',     icon: Settings },
    ]
  },
];

export default function Sidebar({ activePage, onNavigate }) {
  return (
    <aside className="sidebar">
      {/* Logo Header (Fixed top) */}
      <div className="sidebar-header">
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', width: '100%' }}
          onClick={() => onNavigate('dashboard')}
        >
          <img
            src="/saadhyam-logo.png"
            alt="Saadhyam Logo"
            style={{
              height: 26,
              width: 'auto',
              objectFit: 'contain',
              display: 'block'
            }}
          />
          <span
            style={{
              fontSize: 19,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              lineHeight: 1,
              fontFamily: 'Newsreader, serif',
            }}
          >
            Saadhyam
          </span>
          <span
            className="brand-chip"
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: 6,
              marginLeft: 'auto'
            }}
          >
            Voice AI
          </span>
        </div>
      </div>

      {/* Navigation (Smooth scrollable body) */}
      <nav className="sidebar-nav">
        {NAV.map(({ section, items }) => (
          <div key={section} style={{ marginBottom: 4 }}>
            <div className="nav-section-label">{section}</div>
            {items.map(({ id, label, icon: Icon }) => {
              const isActive = activePage === id;
              return (
                <div
                  key={id}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => onNavigate(id)}
                >
                  <Icon size={15} className="nav-icon" />
                  <span style={{ fontSize: 13, flex: 1 }}>{label}</span>
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom — Workspace (Fixed bottom) */}
      <div className="sidebar-footer">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            padding: '6px 8px',
            borderRadius: 8,
            transition: 'background 0.15s ease'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-soft)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700,
              color: '#fff'
            }}
          >
            A
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              Abhi's Workspace
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Admin</div>
          </div>
          <ChevronDown size={14} color="var(--text-muted)" />
        </div>
      </div>
    </aside>
  );
}
