import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Bot, BarChart3, Users, CheckSquare, GitBranch, ChevronRight } from 'lucide-react';

const SUGGESTIONS = [
  "Show today's sales performance",
  "Why did leads decrease this week?",
  "Create a follow-up workflow for cold leads",
  "Show pending approval tasks",
  "How are my AI employees performing?",
  "Generate a weekly marketing report",
];

const INITIAL = [
  {
    role: 'sara',
    content: "Hi Abhi! I'm Sara, your AI workplace assistant. I have full context of your business — your AI employees, leads, calls, customers, and workflows. What would you like to know or do today?",
    actions: [
      { label: 'View today\'s summary', icon: BarChart3 },
      { label: 'Check new leads', icon: Users },
      { label: 'Review pending tasks', icon: CheckSquare },
    ]
  }
];

function SaraMessage({ msg, onNavigate }) {
  return (
    <div style={{ display:'flex', gap: 12, marginBottom: 20, animation:'slideUp 0.3s ease' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10,
        background:'linear-gradient(135deg,#7c3aed,#a78bfa)',
        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <Sparkles size={16} color="#fff" />
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', marginBottom:5 }}>Sara</div>
        <div style={{ background:'#ffffff', border:'1px solid var(--border)', borderRadius:'0 12px 12px 12px',
          padding:'12px 16px', fontSize:14, color:'var(--text-primary)', lineHeight:1.6,
          boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
          {msg.content}
        </div>
        {msg.actions && (
          <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
            {msg.actions.map(a => (
              <button key={a.label} className="btn btn-secondary btn-sm" style={{ fontSize:12 }}>
                {a.icon && <a.icon size={12} />}
                {a.label}
                <ChevronRight size={11} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UserMessage({ msg }) {
  return (
    <div style={{ display:'flex', gap:12, marginBottom:20, justifyContent:'flex-end', animation:'slideUp 0.3s ease' }}>
      <div style={{ maxWidth:'70%' }}>
        <div style={{ background:'linear-gradient(135deg,#7c3aed,#6d28d9)', borderRadius:'12px 12px 0 12px',
          padding:'12px 16px', fontSize:14, color:'#fff', lineHeight:1.6 }}>
          {msg.content}
        </div>
      </div>
      <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#94a3b8,#64748b)',
        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:13, fontWeight:700, color:'#fff' }}>
        A
      </div>
    </div>
  );
}

export default function AskSara({ onNavigate }) {
  const [messages, setMessages] = useState(INITIAL);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function sendMessage(text) {
    const msg = text || input;
    if (!msg.trim()) return;
    setInput('');
    setMessages(prev => [...prev, { role:'user', content: msg }]);
    setLoading(true);
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'sara',
        content: `I understand you're asking about "${msg}". Let me analyze your data... Based on your current metrics, I can see some interesting patterns. Your AI employees have been performing well today with 348 calls made and 126 new leads generated. Would you like me to break this down further or take any specific action?`,
        actions: [
          { label: 'View detailed report', icon: BarChart3 },
          { label: 'Create workflow', icon: GitBranch },
        ]
      }]);
      setLoading(false);
    }, 1500);
  }

  return (
    <div className="page-content animate-fade-in" style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 56px)', padding:0 }}>
      {/* Header */}
      <div style={{ padding:'20px 28px 0', background:'#fff', borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
          <div style={{ width:40, height:40, borderRadius:12, background:'linear-gradient(135deg,#7c3aed,#a78bfa)',
            display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Sparkles size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin:0, fontSize:18, fontWeight:800, color:'var(--text-primary)' }}>Ask Sara</h1>
            <p style={{ margin:0, fontSize:13, color:'var(--text-muted)' }}>Your AI workplace assistant — always in context</p>
          </div>
          <span className="badge badge-active" style={{ marginLeft:'auto' }}>
            <span className="live-dot" style={{width:6,height:6}} />Online
          </span>
        </div>

        {/* Suggestions */}
        <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:14 }}>
          {SUGGESTIONS.map(s => (
            <button key={s} className="chip" style={{ whiteSpace:'nowrap' }} onClick={() => sendMessage(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:'auto', padding:'24px 28px' }}>
        {messages.map((m, i) =>
          m.role === 'sara'
            ? <SaraMessage key={i} msg={m} onNavigate={onNavigate} />
            : <UserMessage key={i} msg={m} />
        )}
        {loading && (
          <div style={{ display:'flex', gap:12, marginBottom:20 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#7c3aed,#a78bfa)',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Sparkles size={16} color="#fff" />
            </div>
            <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:'0 12px 12px 12px',
              padding:'14px 18px', display:'flex', gap:6, alignItems:'center' }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width:7, height:7, borderRadius:'50%', background:'#7c3aed',
                  animation:`bounce-subtle 1.2s ${i*0.2}s ease-in-out infinite` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding:'16px 28px', background:'#fff', borderTop:'1px solid var(--border)' }}>
        <div style={{ display:'flex', gap:10, alignItems:'flex-end',
          background:'var(--surface-soft)', borderRadius:12, border:'1.5px solid var(--border)', padding:'10px 14px',
          transition:'border-color 0.15s'}}
          onFocus={e=>e.currentTarget.style.borderColor='#7c3aed'}
          onBlur={e=>e.currentTarget.style.borderColor='var(--border)'}
        >
          <Bot size={18} color="#7c3aed" style={{ flexShrink:0, marginTop:2 }} />
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }}}
            placeholder="Ask Sara anything about your business..."
            rows={1}
            style={{ flex:1, border:'none', outline:'none', background:'transparent', fontSize:14,
              fontFamily:'inherit', color:'var(--text-primary)', resize:'none', lineHeight:1.5 }}
          />
          <button className="btn btn-primary btn-icon" onClick={() => sendMessage()} disabled={!input.trim()}>
            <Send size={15} />
          </button>
        </div>
        <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:6, textAlign:'center' }}>
          Sara has context of all your employees, leads, calls, and workflows • Press Enter to send
        </div>
      </div>
    </div>
  );
}
