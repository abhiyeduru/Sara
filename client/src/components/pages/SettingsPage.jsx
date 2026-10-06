import React, { useState } from 'react';
import { Settings, ChevronRight, User, Building2, Users, Shield, Bell, Database, CreditCard, Eye } from 'lucide-react';

const SETTINGS_NAV = [
  { id:'general', label:'General', icon:Settings },
  { id:'workspace', label:'Workspace', icon:Building2 },
  { id:'members', label:'Team Members', icon:Users },
  { id:'security', label:'Security', icon:Shield },
  { id:'notifications', label:'Notifications', icon:Bell },
  { id:'privacy', label:'Privacy & Data', icon:Database },
];

const MEMBERS = [
  { name:'Abhiram Yeduru', email:'owner@sara.ai', role:'Owner', status:'active', joined:'Jan 2025' },
];

export default function SettingsPage({ onNavigate }) {
  const [section, setSection] = useState('general');
  const [companyName, setCompanyName] = useState('Sara AI Corp');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [notifications, setNotifications] = useState({
    email: true, ai_alerts: true, task_alerts: true, call_alerts: false,
    approval_alerts: true, billing_alerts: true
  });

  return (
    <div className="page-content animate-fade-in">
      <div style={{ marginBottom:24 }}>
        <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:'var(--text-primary)', fontFamily:'Plus Jakarta Sans' }}>Settings</h1>
        <p style={{ margin:'4px 0 0', fontSize:14, color:'var(--text-muted)' }}>Manage your workspace and account preferences</p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'200px 1fr', gap:20 }}>
        {/* Sidebar */}
        <div className="card" style={{ padding:8, height:'fit-content' }}>
          {SETTINGS_NAV.map(({ id, label, icon:Icon }) => (
            <div key={id} className={`nav-item ${section===id?'active':''}`}
              style={{ borderRadius:8, margin:'2px 0' }}
              onClick={()=>setSection(id)}>
              <Icon size={14} />{label}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="card" style={{ padding:28 }}>
          {section === 'general' && (
            <div>
              <div className="section-heading" style={{ marginBottom:20 }}>General Settings</div>
              <div style={{ display:'grid', gap:16, maxWidth:480 }}>
                {[
                  { label:'Company Name', value:companyName, set:setCompanyName },
                  { label:'Company Website', value:'https://saraai.com' },
                  { label:'Industry', value:'SaaS / Technology' },
                  { label:'Company Size', value:'11–50 employees' },
                  { label:'Timezone', value:timezone },
                  { label:'Currency', value:'INR (₹)' },
                  { label:'Language', value:'English' },
                ].map(({ label, value, set }) => (
                  <div key={label}>
                    <label className="input-label">{label}</label>
                    <input className="input" defaultValue={value}
                      onChange={set ? e=>set(e.target.value) : undefined} />
                  </div>
                ))}
                <button className="btn btn-primary" style={{ alignSelf:'flex-start' }}>Save Changes</button>
              </div>
            </div>
          )}

          {section === 'members' && (
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
                <div className="section-heading">Team Members</div>
                <button className="btn btn-primary btn-sm">+ Invite Member</button>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:0, border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
                {MEMBERS.map((m, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px',
                    borderBottom: i<MEMBERS.length-1?'1px solid var(--border)':'none',
                    background: m.status==='inactive'?'#fafafa':'#fff' }}>
                    <div className="avatar avatar-md av-default">{m.name[0]}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, fontSize:14, color:'var(--text-primary)' }}>{m.name}</div>
                      <div style={{ fontSize:12, color:'var(--text-muted)' }}>{m.email}</div>
                    </div>
                    <span className="badge badge-info" style={{ fontSize:10 }}>{m.role}</span>
                    <span className={`badge ${m.status==='active'?'badge-active':'badge-draft'}`} style={{fontSize:10}}>{m.status}</span>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>{m.joined}</div>
                    <button className="btn btn-ghost btn-sm">Manage</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === 'notifications' && (
            <div>
              <div className="section-heading" style={{ marginBottom:20 }}>Notification Preferences</div>
              {Object.entries(notifications).map(([key, value]) => (
                <div key={key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'14px 0', borderBottom:'1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight:600, fontSize:14, color:'var(--text-primary)' }}>
                      {key.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
                    </div>
                    <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                      Receive alerts for {key.replace(/_/g,' ')}
                    </div>
                  </div>
                  <button
                    onClick={()=>setNotifications(n=>({...n,[key]:!n[key]}))}
                    style={{ width:44, height:24, borderRadius:12, border:'none', cursor:'pointer',
                      background: value?'#7c3aed':'#e2e8f0', transition:'background 0.2s', position:'relative' }}>
                    <div style={{ width:18, height:18, borderRadius:'50%', background:'#fff',
                      position:'absolute', top:3, transition:'left 0.2s',
                      left: value?22:3 }} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {section === 'security' && (
            <div>
              <div className="section-heading" style={{ marginBottom:20 }}>Security</div>
              <div style={{ display:'flex', flexDirection:'column', gap:16, maxWidth:480 }}>
                {[
                  { label:'Two-Factor Authentication', desc:'Add an extra layer of security', action:'Enable 2FA', done:false },
                  { label:'Active Sessions', desc:'3 devices currently logged in', action:'Manage Sessions', done:false },
                  { label:'Login History', desc:'View recent login activity', action:'View History', done:false },
                  { label:'API Security', desc:'Manage API key access', action:'Manage Keys', done:false },
                ].map(({ label, desc, action, done }) => (
                  <div key={label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:16, background:'var(--surface-soft)', borderRadius:10, border:'1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontWeight:600, fontSize:14, color:'var(--text-primary)' }}>{label}</div>
                      <div style={{ fontSize:12, color:'var(--text-muted)' }}>{desc}</div>
                    </div>
                    <button className="btn btn-secondary btn-sm">{action}</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(section === 'workspace' || section === 'privacy') && (
            <div>
              <div className="section-heading" style={{ marginBottom:16 }}>
                {section === 'workspace' ? 'Workspace Settings' : 'Privacy & Data'}
              </div>
              <div style={{ color:'var(--text-muted)', fontSize:14 }}>
                Configure your {section} preferences here.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
