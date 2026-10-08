import React, { useState } from 'react';
import { Sparkles, Bot, ShieldCheck } from 'lucide-react';

export default function CharacterPreview({ character }) {
  const [imgError, setImgError] = useState(false);

  if (!character) return null;

  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid var(--border)',
      borderRadius: 16,
      padding: '12px 14px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }}>
      {/* Square Crop Face Avatar */}
      <div style={{
        width: 54,
        height: 54,
        borderRadius: 12,
        overflow: 'hidden',
        border: '1.5px solid rgba(124, 58, 237, 0.25)',
        boxShadow: '0 3px 8px rgba(124, 58, 237, 0.12)',
        background: character.color || 'linear-gradient(135deg, #7c3aed, #a855f7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        {!imgError && character.imageSrc ? (
          <img
            src={character.imageSrc}
            alt={character.name}
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <span style={{ fontSize: 24, fontWeight: 800, color: '#ffffff' }}>
            {character.avatar || character.name[0]}
          </span>
        )}
      </div>

      {/* Details */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
            {character.name}
          </span>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '1px 6px',
            borderRadius: 8,
            background: 'rgba(124, 58, 237, 0.08)',
            color: '#7c3aed'
          }}>
            PRESET
          </span>
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#7c3aed', marginTop: 1 }}>
          {character.role}
        </div>
        <div style={{
          fontSize: 11,
          color: 'var(--text-secondary)',
          marginTop: 3,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {character.about || character.desc}
        </div>
      </div>
    </div>
  );
}
