import React, { useState } from 'react';
import { Sparkles, Bot, Zap, HeartHandshake, GraduationCap, Building2, Stethoscope,
  ShoppingCart, Factory, ChevronRight, Loader2, CheckCircle2, BookOpen, Wrench, Settings } from 'lucide-react';

const TEMPLATES = [
  { id:'sales', label:'Sales AI', icon: Zap, color:'#7c3aed', desc:'Qualifies leads, makes calls, books demos' },
  { id:'support', label:'Customer Support', icon: HeartHandshake, color:'#0284c7', desc:'Resolves tickets, answers queries 24/7' },
  { id:'hr', label:'HR AI', icon: GraduationCap, color:'#16a34a', desc:'Screens candidates, schedules interviews' },
  { id:'finance', label:'Finance AI', icon: Building2, color:'#ca8a04', desc:'Analyzes data, generates reports' },
  { id:'marketing', label:'Marketing AI', icon: Sparkles, color:'#ec4899', desc:'Campaigns, content, analytics' },
  { id:'real-estate', label:'Real Estate', icon: Building2, color:'#ea580c', desc:'Property calls, lead qualification' },
  { id:'healthcare', label:'Healthcare', icon: Stethoscope, color:'#10b981', desc:'Patient communication, scheduling' },
  { id:'ecommerce', label:'E-Commerce', icon: ShoppingCart, color:'#f97316', desc:'Order support, product queries' },
  { id:'ops', label:'Operations', icon: Factory, color:'#64748b', desc:'Workflow optimization, coordination' },
];

const GENERATED = {
  name: 'Lakshmi',
  role: 'Senior Sales AI Employee',
  dept: 'Sales',
  mission: 'Qualify inbound leads, make intelligent outbound calls, handle objections professionally, and book demo meetings with qualified prospects.',
  responsibilities: [
    'Call and qualify new leads within 5 minutes of receiving them',
    'Make up to 50 outbound calls per day to warm leads',
    'Answer product questions using company knowledge base',
    'Handle common objections using trained scripts',
    'Book demo meetings directly into the sales team calendar',
    'Update CRM records after every interaction',
  ],
  skills: ['Lead Qualification','Objection Handling','Demo Booking','Product Knowledge','CRM Updates','Follow-up Sequences'],
  tools: ['Phone Calls','WhatsApp','CRM','Google Calendar','Email'],
  permissions: ['Read CRM','Update CRM','Make Calls','Send WhatsApp','Book Meetings'],
  voice: 'Shreya (Indian English, Female)',
  hours: '9 AM – 7 PM IST, Mon–Sat',
};

export default function CreateEmployee({ onNavigate }) {
  const [prompt, setPrompt] = useState('');
  const [step, setStep] = useState('input'); // 'input' | 'generating' | 'blueprint'
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [activeSection, setActiveSection] = useState('overview');

  function handleBuild() {
    if (!prompt.trim() && !selectedTemplate) return;
    setStep('generating');
    setTimeout(() => setStep('blueprint'), 2200);
  }

  if (step === 'generating') {
    return (
      <div className="page-content animate-fade-in" style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'60vh' }}>
        <div style={{ width:64, height:64, borderRadius:20, background:'linear-gradient(135deg,#7c3aed,#a78bfa)',
          display:'flex', alignItems:'center', justifyContent:'center', marginBottom:24,
          boxShadow:'0 4px 24px rgba(124,58,237,0.3)', animation:'bounce-subtle 2s ease-in-out infinite' }}>
          <Sparkles size={28} color="#fff" />
        </div>
        <h2 style={{ fontSize:20, fontWeight:800, color:'var(--text-primary)', marginBottom:8, fontFamily:'Plus Jakarta Sans' }}>
          Building your AI employee...
        </h2>
        <p style={{ color:'var(--text-muted)', fontSize:14, marginBottom:32 }}>
          Sara is analyzing your requirements and compiling the perfect employee
        </p>
        {['Analyzing requirements', 'Defining role & mission', 'Assigning skills', 'Configuring tools & permissions', 'Setting up voice & personality'].map((s, i) => (
          <div key={s} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, opacity: i < 3 ? 1 : 0.4,
            transition:`opacity ${0.5+i*0.3}s ease`, color:'var(--text-secondary)', fontSize:14 }}>
            {i < 3 ? <CheckCircle2 size={16} color="#16a34a" /> : <Loader2 size={16} color="#7c3aed" style={{ animation:'spin 1s linear infinite' }} />}
            {s}
          </div>
        ))}
      </div>
    );
  }

  if (step === 'blueprint') {
    return (
      <div className="page-content animate-fade-in">
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <div style={{ width:40, height:40, borderRadius:12, background:'linear-gradient(135deg,#7c3aed,#a78bfa)',
            display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Sparkles size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin:0, fontSize:20, fontWeight:800, color:'var(--text-primary)', fontFamily:'Plus Jakarta Sans' }}>AI Employee Blueprint</h1>
            <p style={{ margin:0, fontSize:13, color:'var(--text-muted)' }}>Review and customise before activating</p>
          </div>
          <div style={{ marginLeft:'auto', display:'flex', gap:10 }}>
            <button className="btn btn-secondary" onClick={() => setStep('input')}>Edit Prompt</button>
            <button className="btn btn-primary" onClick={() => onNavigate('employees')}>
              <CheckCircle2 size={14} /> Activate Employee
            </button>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'260px 1fr', gap:20 }}>
          {/* Left Panel */}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {/* Avatar */}
            <div className="card" style={{ padding:20, textAlign:'center' }}>
              <div className="avatar avatar-xl av-sales" style={{ margin:'0 auto 12px' }}>L</div>
              <div style={{ fontWeight:800, fontSize:18, color:'var(--text-primary)', fontFamily:'Plus Jakarta Sans' }}>{GENERATED.name}</div>
              <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:2 }}>{GENERATED.role}</div>
              <span className="badge badge-draft" style={{ marginTop:8 }}>Draft</span>
              <div style={{ marginTop:14, display:'flex', gap:8 }}>
                <button className="btn btn-secondary btn-sm" style={{ flex:1, justifyContent:'center' }}>Edit Name</button>
                <button className="btn btn-secondary btn-sm" style={{ flex:1, justifyContent:'center' }}>Avatar</button>
              </div>
            </div>
            {/* Sections Nav */}
            {[
              { id:'overview', label:'Overview', icon:Bot },
              { id:'skills', label:'Skills', icon:Sparkles },
              { id:'tools', label:'Tools', icon:Wrench },
              { id:'permissions', label:'Permissions', icon:Settings },
              { id:'voice', label:'Voice', icon:BookOpen },
            ].map(({id,label,icon:Icon}) => (
              <div key={id} className={`nav-item ${activeSection===id?'active':''}`}
                onClick={()=>setActiveSection(id)}
                style={{ margin:0, borderRadius:8 }}>
                <Icon size={14} />{label}
              </div>
            ))}
          </div>

          {/* Right Panel */}
          <div className="card" style={{ padding:24 }}>
            {activeSection === 'overview' && (
              <div>
                <div className="section-heading" style={{ marginBottom:16 }}>Role Overview</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
                  {[
                    { label:'Department', value: GENERATED.dept },
                    { label:'Working Hours', value: GENERATED.hours },
                  ].map(({label,value}) => (
                    <div key={label} style={{ background:'var(--surface-soft)', borderRadius:8, padding:12 }}>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:2 }}>{label}</div>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{value}</div>
                    </div>
                  ))}
                </div>
                <label className="input-label">Mission</label>
                <textarea className="input" style={{ marginBottom:16 }} defaultValue={GENERATED.mission} />
                <label className="input-label">Core Responsibilities</label>
                {GENERATED.responsibilities.map((r, i) => (
                  <div key={i} style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                    <CheckCircle2 size={14} color="#16a34a" style={{ flexShrink:0, marginTop:1 }} />
                    <span style={{ fontSize:13, color:'var(--text-primary)', flex:1 }}>{r}</span>
                  </div>
                ))}
              </div>
            )}
            {activeSection === 'skills' && (
              <div>
                <div className="section-heading" style={{ marginBottom:16 }}>Skills</div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {GENERATED.skills.map(s => (
                    <div key={s} style={{ padding:'8px 14px', borderRadius:8, background:'#f5f3ff', border:'1px solid #ddd6fe',
                      fontSize:13, fontWeight:600, color:'#7c3aed', display:'flex', alignItems:'center', gap:6 }}>
                      <CheckCircle2 size={12} color="#7c3aed" />{s}
                    </div>
                  ))}
                </div>
                <button className="btn btn-secondary btn-sm" style={{ marginTop:16 }}>+ Add Skill</button>
              </div>
            )}
            {activeSection === 'tools' && (
              <div>
                <div className="section-heading" style={{ marginBottom:16 }}>Connected Tools</div>
                {GENERATED.tools.map(t => (
                  <div key={t} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 0', borderBottom:'1px solid var(--border)' }}>
                    <div style={{ width:32, height:32, borderRadius:8, background:'var(--surface-soft)', border:'1px solid var(--border)',
                      display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <Wrench size={14} color="#7c3aed" />
                    </div>
                    <span style={{ flex:1, fontSize:13, fontWeight:500, color:'var(--text-primary)' }}>{t}</span>
                    <span className="badge badge-active">Connected</span>
                  </div>
                ))}
              </div>
            )}
            {activeSection === 'permissions' && (
              <div>
                <div className="section-heading" style={{ marginBottom:16 }}>Permissions</div>
                {[
                  { label:'Read CRM', access:'allowed' },
                  { label:'Update CRM', access:'allowed' },
                  { label:'Make Phone Calls', access:'allowed' },
                  { label:'Send WhatsApp', access:'allowed' },
                  { label:'Book Meetings', access:'allowed' },
                  { label:'Delete Data', access:'denied' },
                  { label:'Financial Transactions', access:'approval' },
                  { label:'External API Access', access:'limited' },
                ].map(({ label, access }) => (
                  <div key={label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                    <span style={{ fontSize:13, color:'var(--text-primary)' }}>{label}</span>
                    <span className={`badge ${
                      access==='allowed'?'badge-active':
                      access==='denied'?'badge-error':
                      access==='approval'?'badge-warning':'badge-info'}`}>
                      {access}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {activeSection === 'voice' && (
              <div>
                <div className="section-heading" style={{ marginBottom:16 }}>Voice Configuration</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  {[
                    { label:'Voice', value: GENERATED.voice },
                    { label:'Language', value: 'English (Indian)' },
                    { label:'Speed', value: 'Normal (1.0x)' },
                    { label:'Tone', value: 'Professional & Warm' },
                  ].map(({label,value}) => (
                    <div key={label}>
                      <label className="input-label">{label}</label>
                      <div className="input" style={{ display:'flex', alignItems:'center', cursor:'pointer' }}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
                <button className="btn btn-secondary" style={{ marginTop:16 }}>
                  Test Voice
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content animate-fade-in">
      <div style={{ maxWidth:720, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ width:56, height:56, borderRadius:18, background:'linear-gradient(135deg,#7c3aed,#a78bfa)',
            display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px',
            boxShadow:'0 4px 20px rgba(124,58,237,0.3)' }}>
            <Bot size={26} color="#fff" />
          </div>
          <h1 style={{ fontSize:26, fontWeight:800, color:'var(--text-primary)', margin:'0 0 8px', fontFamily:'Plus Jakarta Sans' }}>
            Build your AI Employee
          </h1>
          <p style={{ fontSize:15, color:'var(--text-muted)', margin:0 }}>
            Tell Sara what you want this employee to do — she'll build the perfect AI worker for you.
          </p>
        </div>

        {/* Main Input */}
        <div className="card" style={{ padding:24, marginBottom:20 }}>
          <label className="input-label" style={{ fontSize:13 }}>Describe your AI employee</label>
          <textarea
            className="input"
            rows={4}
            placeholder="E.g. Create an AI sales employee that contacts leads, qualifies them, answers product questions, handles objections and books demo meetings for our SaaS product."
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            style={{ marginBottom:16, resize:'none' }}
          />
          <button
            className="btn btn-primary btn-lg"
            style={{ width:'100%', justifyContent:'center', background:'linear-gradient(135deg,#7c3aed,#6d28d9)' }}
            onClick={handleBuild}
            disabled={!prompt.trim() && !selectedTemplate}
          >
            <Sparkles size={17} />
            Build Employee with Sara AI
          </button>
        </div>

        {/* OR */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <div style={{ flex:1, height:1, background:'var(--border)' }} />
          <span style={{ fontSize:12, color:'var(--text-muted)', fontWeight:600 }}>OR START WITH A TEMPLATE</span>
          <div style={{ flex:1, height:1, background:'var(--border)' }} />
        </div>

        {/* Templates */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
          {TEMPLATES.map(t => (
            <div key={t.id}
              className="card"
              style={{ padding:14, cursor:'pointer', border:`1.5px solid ${selectedTemplate===t.id?t.color:'var(--border)'}`,
                background: selectedTemplate===t.id?`${t.color}08`:'#fff', transition:'all 0.15s' }}
              onClick={() => { setSelectedTemplate(t.id); setPrompt(`Create a ${t.label} for my company.`); }}
            >
              <div style={{ width:32, height:32, borderRadius:8, background:`${t.color}15`,
                display:'flex', alignItems:'center', justifyContent:'center', marginBottom:8 }}>
                <t.icon size={16} color={t.color} />
              </div>
              <div style={{ fontWeight:700, fontSize:13, color:'var(--text-primary)', marginBottom:3 }}>{t.label}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)', lineHeight:1.4 }}>{t.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
