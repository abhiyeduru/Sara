import React, { useState } from 'react';
import { Grid2x2, CheckCircle2, XCircle, Plus, ExternalLink, Search } from 'lucide-react';

const INTEGRATIONS = [
  { cat:'Google', items:[
    { name:'Google Calendar', logo:'📅', status:'connected', desc:'Book meetings automatically' },
    { name:'Google Sheets', logo:'📊', status:'connected', desc:'Export leads and reports' },
    { name:'Gmail', logo:'📧', status:'disconnected', desc:'Send and receive emails' },
    { name:'Google Drive', logo:'📁', status:'disconnected', desc:'Store documents and files' },
  ]},
  { cat:'Microsoft', items:[
    { name:'Outlook', logo:'📨', status:'disconnected', desc:'Microsoft email integration' },
    { name:'Teams', logo:'💬', status:'disconnected', desc:'Send notifications to Teams' },
    { name:'OneDrive', logo:'☁️', status:'disconnected', desc:'Cloud file storage' },
  ]},
  { cat:'Communication', items:[
    { name:'WhatsApp Business', logo:'🟢', status:'disconnected', desc:'Send WhatsApp messages', badge:'Setup Required' },
    { name:'Twilio', logo:'📞', status:'connected', desc:'Voice calls infrastructure' },
    { name:'Slack', logo:'💻', status:'connected', desc:'Team notifications' },
    { name:'Telegram', logo:'✈️', status:'disconnected', desc:'Telegram bot integration' },
  ]},
  { cat:'CRM & Sales', items:[
    { name:'HubSpot', logo:'🔶', status:'disconnected', desc:'Two-way CRM sync' },
    { name:'Salesforce', logo:'☁️', status:'disconnected', desc:'Enterprise CRM integration' },
    { name:'Zoho CRM', logo:'🔵', status:'disconnected', desc:'Zoho suite integration' },
  ]},
  { cat:'Payments', items:[
    { name:'Razorpay', logo:'💳', status:'disconnected', desc:'Payment processing India' },
    { name:'Stripe', logo:'💜', status:'disconnected', desc:'Global payment gateway' },
  ]},
  { cat:'Databases', items:[
    { name:'Notion', logo:'◻️', status:'connected', desc:'Knowledge base sync' },
    { name:'Airtable', logo:'🟣', status:'disconnected', desc:'Database and spreadsheet' },
  ]},
];

export default function Integrations({ onNavigate }) {
  const [search, setSearch] = useState('');

  return (
    <div className="page-content animate-fade-in">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:'var(--text-primary)', fontFamily:'Plus Jakarta Sans' }}>Integrations</h1>
          <p style={{ margin:'4px 0 0', fontSize:14, color:'var(--text-muted)' }}>Connect tools to power your AI workforce</p>
        </div>
        <button className="btn btn-primary" onClick={()=>onNavigate('mcp')}><Plus size={14} />Connect MCP</button>
      </div>

      {/* Search */}
      <div className="search-input" style={{ marginBottom:24, maxWidth:300 }}>
        <Search size={14} color="var(--text-muted)" />
        <input placeholder="Search integrations..." value={search} onChange={e=>setSearch(e.target.value)} />
      </div>

      {INTEGRATIONS.map(cat => (
        <div key={cat.cat} style={{ marginBottom:28 }}>
          <div className="section-heading" style={{ marginBottom:12 }}>{cat.cat}</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
            {cat.items.filter(i => i.name.toLowerCase().includes(search.toLowerCase())).map(item => (
              <div key={item.name} className="card" style={{ padding:16, display:'flex', flexDirection:'column', gap:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:40, height:40, borderRadius:10, background:'var(--surface-soft)',
                    border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>
                    {item.logo}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:13, color:'var(--text-primary)' }}>{item.name}</div>
                    {item.badge && <span className="badge badge-warning" style={{ fontSize:9, marginTop:2 }}>{item.badge}</span>}
                  </div>
                </div>
                <div style={{ fontSize:12, color:'var(--text-muted)', lineHeight:1.4 }}>{item.desc}</div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span className={`badge ${item.status==='connected'?'badge-active':'badge-draft'}`} style={{fontSize:10}}>
                    {item.status==='connected'?<CheckCircle2 size={10} />:<XCircle size={10} />}
                    {item.status}
                  </span>
                  <button className={`btn btn-sm ${item.status==='connected'?'btn-secondary':'btn-primary'}`} style={{ fontSize:11, padding:'4px 10px' }}>
                    {item.status==='connected'?'Manage':'Connect'}
                    <ExternalLink size={10} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
