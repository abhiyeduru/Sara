import React, { useState } from 'react';
import { Sparkles, Trash2, Plus, RefreshCw, MessageSquare, Check } from 'lucide-react';

export default function ScriptGenerator({
  openingLine,
  setOpeningLine,
  steps,
  setSteps,
  role,
  selectedLanguages,
  onGenerateScript,
  isGenerating
}) {
  const [newStepText, setNewStepText] = useState('');

  const handleStepChange = (index, newContent) => {
    const updated = [...steps];
    if (typeof updated[index] === 'string') {
      updated[index] = newContent;
    } else {
      updated[index] = { ...updated[index], content: newContent };
    }
    setSteps(updated);
  };

  const handleDeleteStep = (index) => {
    if (steps.length <= 1) return; // Keep at least one step
    const updated = steps.filter((_, i) => i !== index);
    setSteps(updated);
  };

  const handleAddStep = () => {
    if (!newStepText.trim()) return;
    const newStepObj = {
      id: `step_${steps.length + 1}`,
      title: `${steps.length + 1}. Call Step`,
      content: newStepText.trim()
    };
    setSteps([...steps, newStepObj]);
    setNewStepText('');
  };

  return (
    <div style={{
      background: '#ffffff',
      border: '2px solid #7c3aed',
      borderRadius: 20,
      padding: '16px 20px',
      boxShadow: '0 8px 30px rgba(124, 58, 237, 0.12)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Header bar inside Script Generator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '2px 8px',
            borderRadius: 12,
            background: 'rgba(124, 58, 237, 0.1)',
            fontSize: 10,
            fontWeight: 700,
            color: '#7c3aed',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 4
          }}>
            <MessageSquare size={11} color="#7c3aed" />
            Main Call Flow
          </div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
            What will your AI ask?
          </h3>
        </div>

        <button
          type="button"
          onClick={onGenerateScript}
          disabled={isGenerating}
          style={{
            background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
            border: 'none',
            color: '#ffffff',
            padding: '7px 14px',
            borderRadius: 20,
            fontSize: 12.5,
            fontWeight: 700,
            cursor: isGenerating ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)',
            transition: 'all 0.15s ease'
          }}
        >
          <Sparkles size={13} className={isGenerating ? 'animate-spin' : ''} />
          <span>{isGenerating ? 'Generating...' : 'Generate Script with AI'}</span>
        </button>
      </div>

      {/* Loading Shimmer State */}
      {isGenerating ? (
        <div style={{ padding: '24px 12px', textAlign: 'center' }}>
          <div className="animate-spin" style={{ display: 'inline-block', marginBottom: 10 }}>
            <RefreshCw size={24} color="#7c3aed" />
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed' }}>
            Drafting tailored call questions for {role || 'AI Employee'} in {selectedLanguages.join(' & ')}...
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Opening Line Field */}
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
              1. Opening Greeting Line
            </label>
            <textarea
              rows={2}
              value={openingLine}
              onChange={e => setOpeningLine(e.target.value)}
              placeholder="Enter opening greeting..."
              className="input"
              style={{
                fontSize: 12.5,
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                lineHeight: 1.4,
                resize: 'none',
                width: '100%'
              }}
            />
          </div>

          {/* Numbered Call Steps List (Scrollable container to prevent page scroll) */}
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
              2. Qualifying Questions & Call Steps ({steps.length})
            </label>

            <div style={{
              maxHeight: 210,
              overflowY: 'auto',
              paddingRight: 4,
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}>
              {steps.map((step, idx) => {
                const stepContent = typeof step === 'string' ? step : (step.content || step.title || '');
                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      background: 'var(--surface-soft)',
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: '1px solid var(--border)'
                    }}
                  >
                    <div style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#7c3aed',
                      background: '#ffffff',
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: 2,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                    }}>
                      {idx + 1}
                    </div>

                    <textarea
                      rows={2}
                      value={stepContent}
                      onChange={e => handleStepChange(idx, e.target.value)}
                      className="input"
                      style={{
                        flex: 1,
                        fontSize: 12,
                        padding: '6px 8px',
                        borderRadius: 8,
                        background: '#ffffff',
                        border: '1px solid var(--border)',
                        resize: 'none',
                        lineHeight: 1.35
                      }}
                    />

                    {steps.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteStep(idx)}
                        title="Delete question step"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          padding: 4,
                          marginTop: 2
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Add Step Input */}
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <input
              type="text"
              placeholder="+ Add another question/step..."
              value={newStepText}
              onChange={e => setNewStepText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddStep(); } }}
              className="input"
              style={{ flex: 1, fontSize: 12, padding: '6px 10px', borderRadius: 10 }}
            />
            <button
              type="button"
              onClick={handleAddStep}
              disabled={!newStepText.trim()}
              style={{
                background: newStepText.trim() ? '#7c3aed' : '#e2e8f0',
                color: '#ffffff',
                border: 'none',
                padding: '6px 12px',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 600,
                cursor: newStepText.trim() ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <Plus size={13} /> Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
