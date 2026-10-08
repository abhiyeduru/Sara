import React from 'react';
import { Check } from 'lucide-react';

export default function WizardStepper({ currentStep, onStepClick }) {
  const steps = [
    { number: 1, label: 'Choose Character', sub: 'Pick a role & personality' },
    { number: 2, label: 'Name & Job', sub: 'Customize details' },
    { number: 3, label: 'Review & Create', sub: 'Launch AI worker' },
  ];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      marginBottom: 14,
      padding: '10px 18px',
      background: '#ffffff',
      border: '1px solid var(--border)',
      borderRadius: 16,
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)'
    }}>
      {steps.map((step, index) => {
        const isActive = currentStep === step.number;
        const isCompleted = currentStep > step.number;
        const isClickable = currentStep > step.number;

        return (
          <React.Fragment key={step.number}>
            {/* Step Item */}
            <div
              onClick={() => isClickable && onStepClick && onStepClick(step.number)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: isClickable ? 'pointer' : 'default',
                opacity: currentStep >= step.number ? 1 : 0.5,
                transition: 'all 0.2s ease'
              }}
            >
              {/* Badge Circle */}
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: isCompleted
                  ? '#10b981'
                  : isActive
                  ? '#7c3aed'
                  : '#e2e8f0',
                color: isCompleted || isActive ? '#ffffff' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 700,
                boxShadow: isActive ? '0 0 0 4px rgba(124, 58, 237, 0.15)' : 'none',
                transition: 'all 0.2s ease'
              }}>
                {isCompleted ? <Check size={16} color="#ffffff" /> : step.number}
              </div>

              {/* Text Label */}
              <div>
                <div style={{
                  fontSize: 13.5,
                  fontWeight: isActive || isCompleted ? 700 : 600,
                  color: isActive ? '#7c3aed' : 'var(--text-primary)',
                  lineHeight: 1.2
                }}>
                  {step.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {step.sub}
                </div>
              </div>
            </div>

            {/* Connector Line between steps */}
            {index < steps.length - 1 && (
              <div style={{
                width: 40,
                height: 2,
                background: currentStep > step.number ? '#10b981' : '#e2e8f0',
                transition: 'background 0.3s ease'
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
