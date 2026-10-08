import React, { useState } from 'react';
import { GripVertical, Trash2, ChevronDown, ChevronUp, Edit3 } from 'lucide-react';

export default function StepRow({ step, index, onUpdate, onDelete, isTelugu }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const stepTitle = step.shortTitle || `Step ${index + 1}`;
  const stepContent = typeof step === 'string' ? step : (step.content || '');

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: '#FFFFFF',
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
        padding: '10px 14px',
        transition: 'all 200ms ease-out',
        boxShadow: isHovered ? '0 4px 12px rgba(16, 24, 40, 0.05)' : 'none',
        borderColor: isHovered ? 'rgba(124, 58, 237, 0.3)' : 'var(--border-subtle)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Drag handle on hover */}
        <div style={{
          opacity: isHovered ? 1 : 0.25,
          cursor: 'grab',
          marginTop: 2,
          color: 'var(--text-label)',
          transition: 'opacity 150ms ease'
        }}>
          <GripVertical size={16} />
        </div>

        {/* Numbered Circle */}
        <div style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: 'var(--purple-tint)',
          color: 'var(--purple-primary)',
          fontSize: 12,
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 1
        }}>
          {index + 1}
        </div>

        {/* Title & Preview Content */}
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          style={{ flex: 1, cursor: 'pointer', minWidth: 0 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)' }}>
              {stepTitle}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-label)' }}>
              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </span>
          </div>

          {!isExpanded && (
            <p className={isTelugu ? 'telugu-text' : ''} style={{
              margin: '2px 0 0',
              fontSize: 12.5,
              color: 'var(--text-body)',
              lineHeight: 1.45,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {stepContent}
            </p>
          )}
        </div>

        {/* Hover Delete Icon */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 150ms ease'
        }}>
          <button
            type="button"
            onClick={() => onDelete(index)}
            title="Delete step"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#EF4444',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 6
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Expanded Inline Editor */}
      {isExpanded && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-subtle)', animation: 'fadeInPage 150ms ease' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, marginBottom: 8 }}>
            <input
              type="text"
              placeholder="Short title"
              value={step.shortTitle || ''}
              onChange={e => onUpdate(index, { ...step, shortTitle: e.target.value })}
              className="premium-input"
              style={{ height: 36, fontSize: 12 }}
            />
            <span style={{ fontSize: 11, color: 'var(--text-label)', alignSelf: 'center' }}>Step Name / Label</span>
          </div>

          <textarea
            rows={3}
            value={stepContent}
            onChange={e => onUpdate(index, { ...step, content: e.target.value })}
            className={`premium-textarea ${isTelugu ? 'telugu-text' : ''}`}
            style={{ fontSize: 13, padding: '8px 12px' }}
          />
        </div>
      )}
    </div>
  );
}
