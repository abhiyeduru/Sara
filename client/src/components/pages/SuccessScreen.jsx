import React from 'react';
import { Play, PlusCircle, CheckCircle2, Sparkles } from 'lucide-react';
import MascotDisplay from './MascotDisplay';

export default function SuccessScreen({ employee, onOpenStudio, onCreateAnother }) {
  if (!employee) return null;

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#FAFAFB',
      backgroundImage: 'radial-gradient(circle at 50% 30%, rgba(124, 58, 237, 0.08) 0%, transparent 70%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: 24,
        border: '1px solid rgba(17, 24, 39, 0.08)',
        padding: '44px 40px',
        boxShadow: '0 20px 60px rgba(124, 58, 237, 0.12)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        maxWidth: 520,
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden'
      }} className="animate-fade-in">

        {/* Ambient Top Glow */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 240,
          height: 4,
          background: 'linear-gradient(90deg, #7C3AED 0%, #10B981 100%)',
          borderRadius: '0 0 8px 8px'
        }} />

        {/* Mascot Avatar (~120px) */}
        <div style={{ marginBottom: 20 }}>
          <MascotDisplay
            mascotKey={employee.mascot || 'beard'}
            size={110}
            fallbackLetter={employee.name ? employee.name[0] : 'A'}
            label={employee.name}
          />
        </div>

        {/* Success Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px',
          borderRadius: 20,
          background: 'rgba(16, 185, 129, 0.1)',
          color: '#10B981',
          fontSize: 12,
          fontWeight: 700,
          marginBottom: 12
        }}>
          <CheckCircle2 size={15} />
          <span>EMPLOYEE HIRED SUCCESSFULLY</span>
        </div>

        <h2 className="font-editorial" style={{ fontSize: 28, fontWeight: 700, color: '#111827', margin: 0, tracking: '-0.02em' }}>
          {employee.name} is ready to work
        </h2>

        <p style={{ fontSize: 14, color: '#4B5563', marginTop: 8, maxWidth: 420, lineHeight: 1.55 }}>
          Your new AI digital worker <strong>{employee.name}</strong> ({employee.role}) is provisioned with voice models, scripts, and workspace context.
        </p>

        {/* Two Action Buttons */}
        <div style={{ display: 'flex', gap: 12, marginTop: 28, width: '100%', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={onOpenStudio}
            style={{
              background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
              border: 'none',
              color: '#FFFFFF',
              padding: '13px 24px',
              borderRadius: 24,
              fontSize: 14.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 6px 20px rgba(124, 58, 237, 0.35)',
              flex: 1,
              justifyContent: 'center'
            }}
          >
            <Play size={16} /> Open Call Script Studio
          </button>

          <button
            type="button"
            onClick={onCreateAnother}
            style={{
              background: '#FFFFFF',
              border: '1px solid rgba(17, 24, 39, 0.15)',
              color: '#111827',
              padding: '13px 20px',
              borderRadius: 24,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <PlusCircle size={15} /> Create another
          </button>
        </div>
      </div>
    </div>
  );
}
