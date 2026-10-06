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
      { id: 'ask',         label: 'Ask Sara',     icon: Sparkles },
    ]
  },
  {
    section: 'AI Workforce',
    items: [
      { id: 'employees',        label: 'My AI Employees',     icon: Bot },
      { id: 'teams',            label: 'AI Teams',            icon: UsersRound },
      { id: 'employees/new',    label: 'Create AI Employee',  icon: PlusCircle },
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
      {/* Logo */}
      <div style={{ padding: '16px 16px 10px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
             onClick={() => onNavigate('dashboard')}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'linear-gradient(135deg,#7c3aed,#a78bfa)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, boxShadow: '0 2px 8px rgba(124,58,237,0.3)'
          }}>
            <Sparkles size={17} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)', lineHeight: 1.1, fontFamily: 'Plus Jakarta Sans' }}>SARA</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, letterSpacing:'0.02em' }}>AI Workforce</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, paddingBottom: 16 }}>
        {NAV.map(({ section, items }) => (
          <div key={section}>
            <div className="nav-section-label">{section}</div>
            {items.map(({ id, label, icon: Icon }) => (
              <div
                key={id}
                className={`nav-item ${activePage === id ? 'active' : ''}`}
                onClick={() => onNavigate(id)}
              >
                <Icon size={15} className="nav-icon" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        ))}
      </nav>

      {/* Bottom — Workspace */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer',
          padding: '7px 8px', borderRadius: 8, transition: 'background 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.background='var(--surface-soft)'}
          onMouseLeave={e => e.currentTarget.style.background='transparent'}
        >
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg,#7c3aed,#6d28d9)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize: 11, fontWeight: 700, color:'#fff' }}>A</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>Abhi's Workspace</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Admin</div>
          </div>
          <ChevronDown size={13} color="var(--text-muted)" />
        </div>
      </div>
    </aside>
  );
}
