import React, { useState } from 'react';
import {
  Sparkles, Bot, PhoneCall, Zap, CheckCircle2, ArrowRight,
  Loader2, Play, Volume2, Shield, Calendar, Users, X, RefreshCw,
  FileSpreadsheet, MessageSquare, ChevronDown, ChevronUp, Copy, Check
} from 'lucide-react';

import CallingModeSelector from './CallingModeSelector';
import LanguageSelector from './LanguageSelector';
import BusinessTemplatePicker, { BUSINESS_TEMPLATES } from './BusinessTemplatePicker';
import SaraVoiceAssistant from './SaraVoiceAssistant';
import BulkLeadsModal from './BulkLeadsModal';

export default function EmployeeBuilder({ onNavigate, onEmployeeCreated }) {
  const [callingMode, setCallingMode] = useState('instant'); // 'instant' | 'bulk'
  const [selectedLanguage, setSelectedLanguage] = useState('te'); // 'te', 'hi', etc.
  const [selectedTemplate, setSelectedTemplate] = useState(BUSINESS_TEMPLATES[0]);
  const [description, setDescription] = useState(BUSINESS_TEMPLATES[0].prompt);
  
  // Script Preview State
  const [isScriptExpanded, setIsScriptExpanded] = useState(true);
  const [copiedStage, setCopiedStage] = useState(null);

  // Bulk Leads Modal
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  // Generation & Success States
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileStep, setCompileStep] = useState('');
  const [createdEmployee, setCreatedEmployee] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Handle template selection
  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
    setDescription(template.prompt);
    setErrorMessage('');
  };

  // Compile and create the AI employee
  const handleBuildEmployee = async () => {
    const textToBuild = description.trim() || selectedTemplate?.prompt;
    if (!textToBuild) {
      setErrorMessage('Please enter a brief job description or select a template.');
      return;
    }

    setIsCompiling(true);
    setErrorMessage('');
    setCompileStep('Synthesizing business job description...');

    try {
      setTimeout(() => setCompileStep('Generating multi-stage conversation script & qualification rules...'), 700);
      setTimeout(() => setCompileStep('Configuring sweet regional voice persona & tools...'), 1400);

      const scriptStages = selectedTemplate?.scriptStages || [];
      const openingLine = scriptStages[0]?.dialogue?.[selectedLanguage] || '';

      const res = await fetch('/api/v1/employees/compile-and-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: textToBuild,
          calling_mode: callingMode,
          language: selectedLanguage,
          template_category: selectedTemplate?.title || 'Custom business',
          script_stages: scriptStages,
          opening_line: openingLine,
          save_immediately: true
        })
      });

      if (res.ok) {
        const data = await res.json();
        setCreatedEmployee(data);
        if (onEmployeeCreated) {
          onEmployeeCreated(data);
        }
        if (callingMode === 'bulk') {
          setTimeout(() => setIsBulkModalOpen(true), 600);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMessage(err.detail || 'Could not compile employee. Please try again.');
      }
    } catch (err) {
      console.error('Failed to compile employee:', err);
      setErrorMessage('Network connection error while building employee.');
    } finally {
      setIsCompiling(false);
      setCompileStep('');
    }
  };

  const handleCopyScriptStage = (text, idx) => {
    navigator.clipboard?.writeText(text);
    setCopiedStage(idx);
    setTimeout(() => setCopiedStage(null), 2000);
  };

  return (
    <div
      className="employee-builder-card"
      style={{
        background: '#ffffff',
        border: '1px solid rgba(124, 58, 237, 0.15)',
        borderRadius: 20,
        padding: '24px 28px',
        boxShadow: '0 4px 25px rgba(124, 58, 237, 0.05), 0 1px 3px rgba(0, 0, 0, 0.03)',
        position: 'relative',
        overflow: 'hidden',
        color: '#1e293b'
      }}
    >
      {/* ── HEADER SECTION ────────────────────────────────────────── */}
      <div className="employee-builder-header" style={{ marginBottom: 18, position: 'relative', zIndex: 2, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 800,
              color: '#7c3aed',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <span>✦ DESCRIBE THE JOB · WE BUILD THE EMPLOYEE</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: '#1e1b4b',
                margin: 0,
                letterSpacing: '-0.02em',
                lineHeight: 1.15
              }}
            >
              Build your AI employee
            </h2>

            <span
              style={{
                background: '#fef3c7',
                border: '1px solid #fde68a',
                color: '#b45309',
                fontSize: 10.5,
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 20,
                letterSpacing: '0.04em'
              }}
            >
              FREE TO CREATE
            </span>
          </div>

          <p
            style={{
              fontSize: 13,
              color: '#64748b',
              margin: '4px 0 0',
              lineHeight: 1.4
            }}
          >
            Describe the job or choose a business. The AI auto-generates your call script & qualification workflow.
          </p>
        </div>

        {/* Action Buttons: Bulk Leads & Launch */}
        <div className="employee-builder-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            className="employee-builder-excel-btn"
            onClick={() => setIsBulkModalOpen(true)}
            style={{
              background: '#f5f3ff',
              border: '1px solid #ddd6fe',
              color: '#6d28d9',
              borderRadius: 12,
              padding: '8px 14px',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.18s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#ede9fe'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#f5f3ff'; }}
          >
            <FileSpreadsheet size={15} />
            <span>Bulk Leads / Excel 📂</span>
          </button>
        </div>
      </div>

      {/* ── TWO-COLUMN MAIN BUILDER WORKSPACE ─────────────────────── */}
      <div
        className="builder-grid-container"
        style={{
          display: 'grid',
          gridTemplateColumns: '1.45fr auto 0.9fr',
          gap: 22,
          alignItems: 'stretch',
          position: 'relative',
          zIndex: 2,
          marginBottom: 18
        }}
      >
        {/* LEFT COLUMN: Text Builder & Selectors */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Calling Mode Selector */}
          <CallingModeSelector
            selectedMode={callingMode}
            onSelectMode={(mode) => {
              setCallingMode(mode);
              if (mode === 'bulk') {
                setIsBulkModalOpen(true);
              }
            }}
            onOpenBulkModal={() => setIsBulkModalOpen(true)}
          />

          {/* Primary Language Selector */}
          <LanguageSelector
            selectedLanguage={selectedLanguage}
            onSelectLanguage={setSelectedLanguage}
          />

          {/* Natural Language Job Description Text Area */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em'
                }}
              >
                Job Description & Goal
              </label>
              {description && (
                <button
                  type="button"
                  onClick={() => setDescription('')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    fontSize: 11,
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  Clear
                </button>
              )}
            </div>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={selectedTemplate?.placeholder || 'e.g. Call every new property enquiry from my ad, ask what they need, and book a site visit.'}
              rows={3}
              style={{
                width: '100%',
                background: '#f8fafc',
                border: '1.5px solid #e2e8f0',
                borderRadius: 12,
                padding: '12px 14px',
                color: '#0f172a',
                fontSize: 13.5,
                lineHeight: 1.45,
                boxSizing: 'border-box',
                resize: 'vertical',
                outline: 'none',
                transition: 'all 0.2s ease',
                fontFamily: 'inherit'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#7c3aed';
                e.currentTarget.style.background = '#ffffff';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(124, 58, 237, 0.1)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.background = '#f8fafc';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#64748b' }}>
              <span>Specify customer questions and the closing goal (e.g. book site visit).</span>
              <span>{description.length} chars</span>
            </div>
          </div>

          {/* ── AUTO-PREPARED DYNAMIC CALL SCRIPT PREVIEW (TELUGU REQUIREMENT) ── */}
          {selectedTemplate?.scriptStages && selectedTemplate.scriptStages.length > 0 && (
            <div
              style={{
                background: '#faf5ff',
                border: '1.5px solid #e9d5ff',
                borderRadius: 14,
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer'
                }}
                onClick={() => setIsScriptExpanded(!isScriptExpanded)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MessageSquare size={15} color="#7c3aed" />
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: '#1e1b4b' }}>
                    Auto-Prepared Script for {selectedTemplate.title}
                  </span>
                  <span
                    style={{
                      background: '#7c3aed',
                      color: '#ffffff',
                      fontSize: 9.5,
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: 10,
                      textTransform: 'uppercase'
                    }}
                  >
                    {selectedLanguage.toUpperCase()}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: '#6d28d9', fontWeight: 600 }}>
                    {isScriptExpanded ? 'Hide Script' : 'Preview Script (5 Stages)'}
                  </span>
                  {isScriptExpanded ? <ChevronUp size={14} color="#6d28d9" /> : <ChevronDown size={14} color="#6d28d9" />}
                </div>
              </div>

              {isScriptExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                  {selectedTemplate.scriptStages.map((stg, idx) => {
                    const dialogueText = stg.dialogue[selectedLanguage] || stg.dialogue['en'] || Object.values(stg.dialogue)[0];

                    return (
                      <div
                        key={stg.step}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #f1f5f9',
                          borderRadius: 10,
                          padding: '8px 10px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 3
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: '50%',
                                background: '#7c3aed',
                                color: '#ffffff',
                                fontSize: 10,
                                fontWeight: 800,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              {stg.step}
                            </span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
                              {stg.title}
                            </span>
                            <span style={{ fontSize: 10.5, color: '#64748b' }}>
                              • {stg.subtitle}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleCopyScriptStage(dialogueText, idx)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: copiedStage === idx ? '#059669' : '#94a3b8',
                              padding: 0,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 2,
                              fontSize: 10.5
                            }}
                            title="Copy stage dialogue"
                          >
                            {copiedStage === idx ? <Check size={11} /> : <Copy size={11} />}
                            <span>{copiedStage === idx ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>

                        <div
                          style={{
                            fontSize: 12,
                            color: '#334155',
                            lineHeight: 1.4,
                            paddingLeft: 24,
                            fontStyle: 'normal'
                          }}
                        >
                          "{dialogueText}"
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                padding: '8px 12px',
                borderRadius: 10,
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>⚠️</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Primary CTA: "Build my employee" */}
          <div style={{ marginTop: 2 }}>
            <button
              type="button"
              onClick={handleBuildEmployee}
              disabled={isCompiling || (!description.trim() && !selectedTemplate?.prompt)}
              className="btn-build-employee"
              style={{
                background: isCompiling
                  ? '#cbd5e1'
                  : 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 12,
                padding: '12px 26px',
                fontSize: 14,
                fontWeight: 800,
                cursor: isCompiling ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 16px rgba(124, 58, 237, 0.25)',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
              onMouseEnter={(e) => {
                if (!isCompiling) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(124, 58, 237, 0.35)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isCompiling) {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(124, 58, 237, 0.25)';
                }
              }}
            >
              {isCompiling ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{compileStep || 'Building Employee...'}</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Build my employee</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* VERTICAL DIVIDER WITH "OR" SEPARATOR */}
        <div
          className="builder-vertical-divider"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative'
          }}
        >
          <div
            style={{
              width: 1,
              height: '100%',
              background: '#e2e8f0'
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '50%',
              transform: 'translateY(-50%)',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: 20,
              padding: '3px 9px',
              fontSize: 10,
              fontWeight: 800,
              color: '#64748b',
              letterSpacing: '0.06em'
            }}
          >
            OR
          </div>
        </div>

        {/* RIGHT COLUMN: Talk to Sara Voice-First Creation */}
        <div
          style={{
            background: '#faf5ff',
            border: '1px solid #ede9fe',
            borderRadius: 16,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}
        >
          <SaraVoiceAssistant
            selectedLanguage={selectedLanguage}
            onTranscriptionUpdate={setDescription}
            currentDescription={description}
            onAutoBuild={handleBuildEmployee}
          />
        </div>
      </div>

      {/* ── BOTTOM ROW: Business Template Quick Picks ─────────────── */}
      <div style={{ position: 'relative', zIndex: 2, borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
        <BusinessTemplatePicker
          selectedTemplateId={selectedTemplate?.id}
          onSelectTemplate={handleSelectTemplate}
        />
      </div>

      {/* ── SUCCESS DIALOG: Created Employee Showcase ── */}
      {createdEmployee && (
        <div
          className="created-employee-modal-overlay animate-fade-in"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
          }}
          onClick={() => setCreatedEmployee(null)}
        >
          <div
            className="created-employee-card animate-scale-up"
            style={{
              background: '#ffffff',
              border: '1.5px solid #7c3aed',
              borderRadius: 22,
              padding: '28px 30px',
              maxWidth: 560,
              width: '100%',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.2), 0 0 30px rgba(124, 58, 237, 0.1)',
              color: '#1e293b',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setCreatedEmployee(null)}
              style={{
                position: 'absolute',
                top: 18,
                right: 18,
                background: '#f1f5f9',
                border: 'none',
                color: '#64748b',
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={16} />
            </button>

            {/* Header Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff'
                }}
              >
                <Bot size={22} />
              </div>
              <div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: '#059669',
                    background: '#ecfdf5',
                    padding: '2px 7px',
                    borderRadius: 6,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase'
                  }}
                >
                  ✓ AI EMPLOYEE COMPILED & LIVE
                </span>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: '#1e1b4b', margin: '2px 0 0' }}>
                  {createdEmployee.employee?.name || 'Sara'} is ready to work!
                </h3>
              </div>
            </div>

            {/* Configured Details */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 14,
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                marginBottom: 18
              }}
            >
              <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.45 }}>
                <strong>Role:</strong> {createdEmployee.employee?.role || 'Lead Qualification Specialist'}
              </div>
              <div style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.45 }}>
                <strong>Opening Greeting:</strong> “{createdEmployee.employee?.persona_prompt?.split('\n')?.[0]?.slice(0, 120) || 'నమస్కారం! నేను మీ ప్రాపర్టీ అసిస్టెంట్ మాట్లాడుతున్నాను...'}...”
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                <span style={{ fontSize: 11, background: '#f5f3ff', color: '#6d28d9', padding: '3px 8px', borderRadius: 6, fontWeight: 700 }}>
                  Mode: {callingMode === 'bulk' ? 'Bulk Auto-Calling' : 'Instant Inbound & Outbound'}
                </span>
                <span style={{ fontSize: 11, background: '#f5f3ff', color: '#6d28d9', padding: '3px 8px', borderRadius: 6, fontWeight: 700 }}>
                  Language: {selectedLanguage.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Next Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  const empId = createdEmployee.id || createdEmployee.employee?.id;
                  setCreatedEmployee(null);
                  if (onNavigate) {
                    onNavigate('employee-detail', { employeeId: empId, tab: 'Call script' });
                  }
                }}
                style={{
                  background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 12,
                  padding: '10px 18px',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 4px 14px rgba(124, 58, 237, 0.3)'
                }}
              >
                <Sparkles size={14} />
                <span>Open Call Script Studio & Customize</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCreatedEmployee(null);
                  setIsBulkModalOpen(true);
                }}
                style={{
                  background: '#f5f3ff',
                  border: '1px solid #ddd6fe',
                  color: '#6d28d9',
                  borderRadius: 12,
                  padding: '10px 16px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <FileSpreadsheet size={15} />
                <span>Upload Bulk Leads for {createdEmployee.employee?.name || 'Sara'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCreatedEmployee(null);
                  if (onNavigate) onNavigate('employees');
                }}
                style={{
                  background: '#ffffff',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: 12,
                  padding: '10px 16px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <span>Workforce</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BULK LEADS & EXCEL AUTO-CALLER MODAL ── */}
      <BulkLeadsModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        preselectedEmployeeId={createdEmployee?.id || createdEmployee?.employee?.id || 'sara'}
        preselectedEmployeeName={createdEmployee?.name || createdEmployee?.employee?.name || 'Sara'}
        preselectedScript={createdEmployee?.call_script || createdEmployee?.universal_spec?.call_script}
        onCampaignCreated={() => {}}
      />
    </div>
  );
}
