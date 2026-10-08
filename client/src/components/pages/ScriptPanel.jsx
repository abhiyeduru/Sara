import React, { useState } from 'react';
import { Sparkles, Plus, MessageSquare, RefreshCw } from 'lucide-react';
import StepRow from './StepRow';

export default function ScriptPanel({
  openingLine,
  setOpeningLine,
  steps,
  setSteps,
  role,
  selectedLanguages = [],
  onGenerateScript,
  isGenerating
}) {
  const [newStepText, setNewStepText] = useState('');

  const isTelugu = selectedLanguages.includes('Telugu');

  const handleUpdateStep = (index, updatedStep) => {
    const updated = [...steps];
    updated[index] = updatedStep;
    setSteps(updated);
  };

  const handleDeleteStep = (index) => {
    if (steps.length <= 1) return;
    const updated = steps.filter((_, i) => i !== index);
    setSteps(updated);
  };

  const handleAddStep = () => {
    if (!newStepText.trim()) return;
    const newStepObj = {
      id: `step_${Date.now()}`,
      shortTitle: `Question ${steps.length + 1}`,
      content: newStepText.trim()
    };
    setSteps([...steps, newStepObj]);
    setNewStepText('');
  };

  return (
    <div className="hero-script-panel" style={{ padding: '18px 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--purple-primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 3
          }}>
            Main Call Flow
          </div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-heading)', tracking: '-0.02em' }}>
            What will your AI ask?
          </h3>
        </div>

        <button
          type="button"
          onClick={onGenerateScript}
          disabled={isGenerating}
          style={{
            background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
            border: 'none',
            color: '#FFFFFF',
            padding: '8px 16px',
            borderRadius: 24,
            fontSize: 13,
            fontWeight: 700,
            cursor: isGenerating ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 4px 14px rgba(124, 58, 237, 0.25)',
            transition: 'all 200ms ease-out'
          }}
        >
          <Sparkles size={14} className={isGenerating ? 'animate-spin' : ''} />
          <span>{isGenerating ? 'Drafting...' : 'Generate Script with AI'}</span>
        </button>
      </div>

      {/* Opening Greeting Box */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-label)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
          1. Opening Greeting Line
        </label>
        <textarea
          rows={2}
          value={openingLine}
          onChange={e => setOpeningLine(e.target.value)}
          placeholder="Opening greeting line..."
          className={`premium-textarea ${isTelugu ? 'telugu-text' : ''}`}
          style={{ fontSize: 13, padding: '8px 12px' }}
        />
      </div>

      {/* Call Steps Section (Thin custom scrollbar) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-label)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
          2. Call Steps & Questions ({steps.length})
        </label>

        {isGenerating ? (
          /* Shimmer Loading skeleton while generating */
          <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--purple-primary)', textAlign: 'center', marginBottom: 6 }}>
              Writing your script for {role || 'AI Employee'}...
            </div>
            {[1, 2, 3].map(i => (
              <div key={i} className="shimmer-row" style={{ height: 48, borderRadius: 12 }} />
            ))}
          </div>
        ) : (
          <div
            className="thin-scrollbar"
            style={{
              maxHeight: 240,
              overflowY: 'auto',
              paddingRight: 4,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              marginBottom: 10
            }}
          >
            {steps.map((step, idx) => (
              <div
                key={step.id || idx}
                style={{
                  animation: `fadeInPage 200ms ease-out ${idx * 40}ms both`
                }}
              >
                <StepRow
                  step={step}
                  index={idx}
                  onUpdate={handleUpdateStep}
                  onDelete={handleDeleteStep}
                  isTelugu={isTelugu}
                />
              </div>
            ))}
          </div>
        )}

        {/* "+ Add another step" Pinned at Bottom */}
        <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
          <input
            type="text"
            placeholder="+ Add another question/step..."
            value={newStepText}
            onChange={e => setNewStepText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddStep(); } }}
            className="premium-input"
            style={{ height: 38, fontSize: 12.5, flex: 1 }}
          />
          <button
            type="button"
            onClick={handleAddStep}
            disabled={!newStepText.trim()}
            style={{
              background: newStepText.trim() ? 'var(--purple-primary)' : '#E2E8F0',
              color: '#FFFFFF',
              border: 'none',
              padding: '0 14px',
              borderRadius: 12,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: newStepText.trim() ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </div>
    </div>
  );
}
