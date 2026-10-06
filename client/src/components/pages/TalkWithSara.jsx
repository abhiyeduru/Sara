import React from 'react';
import VoiceScreen from '../voice/VoiceScreen';

export default function TalkWithSara({ onNavigate }) {
  return (
    <div style={{
      background: 'var(--surface-soft)',
      minHeight: 'calc(100vh - var(--topbar-height))',
      color: 'var(--text-primary)',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative'
    }} className="animate-fade-in">
      <VoiceScreen
        onNavigate={onNavigate}
        onClose={() => onNavigate('dashboard')}
      />
    </div>
  );
}
