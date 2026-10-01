import React from 'react';
import VoiceScreen from '../voice/VoiceScreen';

export default function TalkWithSara({ onNavigate }) {
  return (
    <div style={{
      background: '#060608',
      minHeight: '100vh',
      color: '#f1f1f5',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflowX: 'hidden'
    }} className="animate-fade-in">
      <VoiceScreen
        onNavigate={onNavigate}
        onClose={() => onNavigate('dashboard')}
      />
    </div>
  );
}
