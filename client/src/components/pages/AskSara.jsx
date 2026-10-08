import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Bot, BarChart3, Users, CheckSquare, GitBranch, ChevronRight, ArrowLeft, RefreshCw, Shield } from 'lucide-react';
import { GooeyOrb } from '../voice/GooeyOrb';

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
      { label: 'View today\'s summary', icon: BarChart3, target: 'analytics' },
      { label: 'Check new leads', icon: Users, target: 'leads' },
      { label: 'Review pending tasks', icon: CheckSquare, target: 'tasks' },
    ]
  }
];

function SaraMessage({ msg, onNavigate }) {
  return (
    <div style={{ display: 'flex', gap: 14, marginBottom: 24, animation: 'fadeInPage 0.25s ease' }}>
      <div style={{
        width: 44,
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        <GooeyOrb state="speaking" size={44} speed={1} colorFrom="#7c3aed" colorTo="#a855f7" />
      </div>
      <div style={{ flex: 1, maxWidth: '85%' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>Sara AI</span>
          <span style={{ fontSize: 10, background: 'rgba(124,58,237,0.08)', color: '#7c3aed', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>System Assistant</span>
        </div>
        <div style={{
          background: '#ffffff',
          border: '1px solid var(--border)',
          borderRadius: '4px 16px 16px 16px',
          padding: '16px 20px',
          fontSize: 14.5,
          color: 'var(--text-primary)',
          lineHeight: 1.6,
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)'
        }}>
          {msg.content}
        </div>
        {msg.actions && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {msg.actions.map(a => (
              <button
                key={a.label}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 12, borderRadius: 20, padding: '6px 14px' }}
                onClick={() => a.target && onNavigate && onNavigate(a.target)}
              >
                {a.icon && <a.icon size={13} color="#7c3aed" />}
                {a.label}
                <ChevronRight size={12} color="var(--text-muted)" />
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
    <div style={{ display: 'flex', gap: 14, marginBottom: 24, justifyContent: 'flex-end', animation: 'fadeInPage 0.25s ease' }}>
      <div style={{ maxWidth: '75%' }}>
        <div style={{
          background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
          borderRadius: '16px 16px 4px 16px',
          padding: '14px 20px',
          fontSize: 14.5,
          color: '#ffffff',
          lineHeight: 1.6,
          boxShadow: '0 4px 14px rgba(124, 58, 237, 0.25)'
        }}>
          {msg.content}
        </div>
      </div>
      <div style={{
        width: 38,
        height: 38,
        borderRadius: 12,
        background: 'linear-gradient(135deg, #475569 0%, #1e293b 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontSize: 14,
        fontWeight: 700,
        color: '#fff'
      }}>
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
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setLoading(true);
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'sara',
        content: `I understand you're asking about "${msg}". Let me analyze your workplace data... Based on your live metrics, your AI employees have completed 348 calls today with a 36.2% conversion rate and 126 new leads generated. Your team is performing 18% above the weekly baseline.`,
        actions: [
          { label: 'View detailed report', icon: BarChart3, target: 'analytics' },
          { label: 'View Workflows', icon: GitBranch, target: 'workflows' },
        ]
      }]);
      setLoading(false);
    }, 1200);
  }

  function handleReset() {
    setMessages(INITIAL);
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100vw',
      background: '#f8fafc',
      position: 'fixed',
      inset: 0,
      zIndex: 9999
    }}>
      {/* Full Page Top Header */}
      <header style={{
        height: 64,
        padding: '0 24px',
        background: '#ffffff',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Exit / Back Button */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onNavigate && onNavigate('dashboard')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              borderRadius: 20,
              padding: '7px 14px',
              fontWeight: 600,
              color: 'var(--text-secondary)'
            }}
            title="Back to Dashboard"
          >
            <ArrowLeft size={16} />
            <span>Back to Workspace</span>
          </button>

          <div style={{ height: 20, width: 1, background: 'var(--border)' }} />

          {/* Page Title & Status with Animated GooeyOrb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <GooeyOrb state={loading ? 'thinking' : 'speaking'} size={40} speed={1} colorFrom="#7c3aed" colorTo="#a855f7" />
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: 8 }}>
                Ask Sara
                <span className="badge badge-active" style={{ fontSize: 10, padding: '2px 8px' }}>
                  <span className="live-dot" style={{ width: 5, height: 5 }} /> Online
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                Full-screen Workplace Intelligence & Charting Canvas
              </div>
            </div>
          </div>
        </div>

        {/* Header Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleReset}
            style={{ borderRadius: 20, gap: 6, color: 'var(--text-muted)' }}
            title="Start New Session"
          >
            <RefreshCw size={14} />
            <span>New Chat</span>
          </button>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            background: 'var(--surface-soft)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            fontSize: 12,
            color: 'var(--text-secondary)'
          }}>
            <Shield size={13} color="#7c3aed" />
            <span style={{ fontWeight: 600 }}>Full Context Active</span>
          </div>
        </div>
      </header>

      {/* Main Chat Stream Container */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <div style={{ width: '100%', maxWidth: 900, padding: '0 24px' }}>
          {messages.map((m, i) =>
            m.role === 'sara'
              ? <SaraMessage key={i} msg={m} onNavigate={onNavigate} />
              : <UserMessage key={i} msg={m} />
          )}

          {loading && (
            <div style={{ display: 'flex', gap: 14, marginBottom: 24, animation: 'fadeInPage 0.2s ease' }}>
              <div style={{
                width: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <GooeyOrb state="thinking" size={44} speed={1.2} colorFrom="#7c3aed" colorTo="#ec4899" />
              </div>
              <div style={{
                background: '#ffffff',
                border: '1px solid var(--border)',
                borderRadius: '4px 16px 16px 16px',
                padding: '16px 22px',
                display: 'flex',
                gap: 6,
                alignItems: 'center'
              }}>
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#7c3aed',
                      animation: `bounce-subtle 1.2s ${i * 0.2}s ease-in-out infinite`
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Bottom Fixed Input Bar */}
      <div style={{
        padding: '16px 24px 24px',
        background: 'linear-gradient(180deg, rgba(248, 250, 252, 0.8) 0%, #f8fafc 100%)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        flexShrink: 0
      }}>
        <div style={{ width: '100%', maxWidth: 900 }}>
          {/* Quick Prompt Suggestions */}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, scrollbarWidth: 'none' }}>
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                className="chip"
                style={{
                  whiteSpace: 'nowrap',
                  fontSize: 12,
                  padding: '6px 14px',
                  borderRadius: 20,
                  background: '#ffffff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                }}
                onClick={() => sendMessage(s)}
              >
                <Sparkles size={11} color="#7c3aed" />
                {s}
              </button>
            ))}
          </div>

          {/* Main Input Textarea */}
          <div style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            background: '#ffffff',
            borderRadius: 16,
            border: '1.5px solid var(--border)',
            padding: '12px 18px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
            transition: 'border-color 0.2s, box-shadow 0.2s'
          }}
          onFocus={e => {
            e.currentTarget.style.borderColor = '#7c3aed';
            e.currentTarget.style.boxShadow = '0 4px 24px rgba(124, 58, 237, 0.15)';
          }}
          onBlur={e => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.05)';
          }}
          >
            <Bot size={20} color="#7c3aed" style={{ flexShrink: 0 }} />
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask Sara anything about your business, metrics, or workflows..."
              rows={1}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 14.5,
                fontFamily: 'inherit',
                color: 'var(--text-primary)',
                resize: 'none',
                lineHeight: 1.5,
                maxHeight: 120
              }}
            />
            <button
              className="btn btn-primary btn-icon"
              onClick={() => sendMessage()}
              disabled={!input.trim()}
              style={{
                borderRadius: 12,
                padding: '10px 14px',
                background: input.trim() ? 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)' : '#e2e8f0',
                border: 'none',
                cursor: input.trim() ? 'pointer' : 'default',
                transition: 'all 0.15s ease'
              }}
            >
              <Send size={16} color="#ffffff" />
            </button>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
            Sara has full context of all your employees, leads, calls, and business workflows • Press Enter to send
          </div>
        </div>
      </div>
    </div>
  );
}
