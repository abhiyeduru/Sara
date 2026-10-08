import React from 'react';
import { Check } from 'lucide-react';
import MascotDisplay from './MascotDisplay';

export default function CharacterCard({ character, isSelected, onSelect }) {
  return (
    <div
      onClick={() => onSelect(character)}
      className={`preset-card-item ${isSelected ? 'selected' : ''}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        position: 'relative'
      }}
    >
      {/* 80px Mascot Avatar */}
      <MascotDisplay
        mascotKey={character.mascot || (character.name === 'Sara' ? 'glasses' : 'beard')}
        size={80}
        fallbackLetter={character.avatar || character.name[0]}
        label={character.name}
        color={character.color}
      />

      {/* Details */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-heading)', lineHeight: 1.2 }}>
          {character.name}
        </div>
        <div style={{
          fontSize: 12,
          fontWeight: 600,
          color: isSelected ? 'var(--purple-primary)' : 'var(--text-body)',
          marginTop: 3,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {character.role}
        </div>
      </div>

      {/* Animated Check Badge for Selected state */}
      {isSelected && (
        <div style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: 'var(--purple-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 6px rgba(124, 58, 237, 0.3)',
          flexShrink: 0,
          animation: 'fadeInPage 200ms ease-out'
        }}>
          <Check size={12} color="#ffffff" />
        </div>
      )}
    </div>
  );
}
