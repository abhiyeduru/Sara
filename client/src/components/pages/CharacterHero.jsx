import React from 'react';
import MascotDisplay from './MascotDisplay';

export default function CharacterHero({ character, reaction }) {
  if (!character) return null;

  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid var(--border-subtle)',
      borderRadius: 16,
      padding: '16px 20px',
      boxShadow: 'var(--shadow-soft)',
      display: 'flex',
      alignItems: 'center',
      gap: 18
    }}>
      {/* Larger Mascot Avatar (120px) */}
      <MascotDisplay
        mascotKey={character.mascot || (character.name === 'Sara' ? 'glasses' : 'beard')}
        size={120}
        fallbackLetter={character.avatar || character.name[0]}
        label={character.name}
        color={character.color}
      />

      {/* Info Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: 'var(--text-heading)', tracking: '-0.02em' }}>
            {character.name}
          </h3>
          <span style={{
            fontSize: 10.5,
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 6,
            background: 'var(--purple-tint)',
            color: 'var(--purple-primary)',
            letterSpacing: '0.05em'
          }}>
            PRESET
          </span>
        </div>

        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--purple-primary)', marginTop: 3 }}>
          {character.role}
        </div>

        <p style={{ margin: '5px 0 0', fontSize: 12.5, color: 'var(--text-body)', lineHeight: 1.45, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {character.desc || character.about}
        </p>
      </div>
    </div>
  );
}
