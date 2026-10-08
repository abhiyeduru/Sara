import React, { useState, useEffect } from 'react';
import { ArrowLeft, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { CHARACTERS, EXTRA_MASCOTS } from '../../config/characters.config';
import CharacterCard from './CharacterCard';
import CharacterHero from './CharacterHero';
import LanguagePicker from './LanguagePicker';
import ScriptPanel from './ScriptPanel';
import SuccessScreen from './SuccessScreen';
import './create-employee.css';

// Script generator helper
const generateAIScript = (roleTitle, languagesArray) => {
  const roleLower = (roleTitle || '').toLowerCase();
  const langText = (languagesArray || []).join(' & ') || 'Telugu & English';
  const isTelugu = languagesArray.includes('Telugu');
  const isHindi = languagesArray.includes('Hindi');

  let opening = isTelugu
    ? 'హలో అండి, {Lead Name} తో మాట్లాడుతున్నానా? నేను మీ AI వర్క్‌ఫోర్స్ అసిస్టెంట్ ని.'
    : isHindi
    ? 'नमस्ते {Lead Name} जी, मैं आपकी AI असिस्टेंट बोल रही हूँ।'
    : 'Hello {Lead Name}, I am your AI assistant following up on your request.';

  let stepsList = [];

  if (roleLower.includes('real estate') || roleLower.includes('property') || roleLower.includes('caller')) {
    opening = isTelugu
      ? 'హలో అండి, {Lead Name} తో మాట్లాడుతున్నానా? నేను ప్రాపర్టీ గైడ్ నుండి ఫర్హాన్ ని.'
      : isHindi
      ? 'नमस्ते {Lead Name} जी, मैं प्रॉपर्टी एडवाइजर की तरफ से बात कर रहा हूँ।'
      : 'Hello {Lead Name}, this is your Property Advisor following up on your inquiry.';

    stepsList = [
      { id: 's1', shortTitle: 'Introduce & Context', content: isTelugu ? 'హలో అండి, నేను ప్రాపర్టీ గైడ్ నుండి మాట్లాడుతున్నాను. మీరు ప్రాపర్టీ కోసం ఇంక్వైరీ చేశారు కదా అండి?' : 'Introduce yourself and reference their recent property inquiry.' },
      { id: 's2', shortTitle: 'Ask Living vs Investment', content: isTelugu ? 'మీరు లివింగ్ కి చూస్తున్నారా లేక ఇన్‌వెస్ట్‌మెంట్ కి వెతుకుతున్నారా అండి?' : 'Qualify if they want personal residence or investment property.' },
      { id: 's3', shortTitle: 'Ask Budget & Location', content: isTelugu ? 'మీ బడ్జెట్ రేంజ్ మరియు ఏ లొకేషన్ లో చూస్తున్నారో చెప్పగలరా?' : 'Inquire about their target budget and preferred location.' },
      { id: 's4', shortTitle: 'Book Site Visit', content: isTelugu ? 'ఈ వీకెండ్ సైట్ విజిట్ కి ఎప్పుడు రాగలరు అండి?' : 'Offer site visit slots for this weekend.' },
      { id: 's5', shortTitle: 'Confirm & WhatsApp', content: isTelugu ? 'సరే అండి, వివరాలన్నీ వాట్సాప్ చేస్తాను. ధన్యవాదాలు!' : 'Confirm details and send brochure on WhatsApp.' }
    ];
  } else if (roleLower.includes('health') || roleLower.includes('clinic') || roleLower.includes('doctor')) {
    opening = isTelugu
      ? 'నమస్కారం అండి, {Lead Name} గారేనా మాట్లాడేది? హెల్త్‌కేర్ క్లినిక్ నుండి ప్రియ ని.'
      : 'Hello {Lead Name}, calling from the Healthcare Clinic regarding your booking.';

    stepsList = [
      { id: 's1', shortTitle: 'Greet & Booking', content: isTelugu ? 'నమస్కారం అండి, డాక్టర్ కన్సల్టేషన్ కోసం మీరు అడిగిన వివరాల గురించి కాల్ చేస్తున్నాను.' : 'Reference consultation booking request.' },
      { id: 's2', shortTitle: 'Check Symptoms', content: isTelugu ? 'మీరు ఏ సమస్య కోసం చెకప్ అనుకుంటున్నారు అండి?' : 'Ask about their primary health consultation needs.' },
      { id: 's3', shortTitle: 'Schedule Time Slot', content: isTelugu ? 'రేపు ఉదయం 11 గంటలకు లేదా సాయంత్రం 5 గంటలకు స్లాట్ ఖాళీగా ఉంది, ఏది వీలవుతుంది?' : 'Offer available morning/evening slots.' },
      { id: 's4', shortTitle: 'Confirm & Directions', content: isTelugu ? 'మీ అపాయింట్మెంట్ కన్ఫర్మ్ చేశాను అండి. క్లినిక్ లొకేషన్ వాట్సాప్ చేస్తాను.' : 'Confirm appointment and text clinic location.' }
    ];
  } else if (roleLower.includes('fitness') || roleLower.includes('gym')) {
    opening = isTelugu
      ? 'హలో అండి, {Lead Name} గారితో మాట్లాడుతున్నానా? ఫిట్నెస్ సెంటర్ నుండి రాహుల్ ని.'
      : 'Hello {Lead Name}, calling from Fitness Studio regarding your trial pass.';

    stepsList = [
      { id: 's1', shortTitle: 'Connect & Inquiry', content: isTelugu ? 'మా జిమ్ మెంబర్షిప్ గురించి మీరు ఎంక్వైరీ చేశారు కదా అండి?' : 'Reference gym trial inquiry.' },
      { id: 's2', shortTitle: 'Understand Fitness Goal', content: isTelugu ? 'మీ మెయిన్ గోల్ వెయిట్ లాస్ ఆ లేక ఫిట్నెస్ కోసమా అండి?' : 'Ask primary goal (weight loss, strength, fitness).' },
      { id: 's3', shortTitle: 'Offer Free Trial', content: isTelugu ? 'ఈ శనివారం లేదా ఆదివారం ఫ్రీ ట్రయల్ వర్కౌట్ కి రండి.' : 'Invite for complimentary workout session.' },
      { id: 's4', shortTitle: 'WhatsApp VIP Pass', content: isTelugu ? 'మీరు వచ్చే సమయానికి VIP పాస్ వాట్సాప్ చేస్తాను అండి.' : 'Send VIP pass via WhatsApp.' }
    ];
  } else {
    stepsList = [
      { id: 's1', shortTitle: 'Introduce & Context', content: `Introduce company and reference inquiry in ${langText}.` },
      { id: 's2', shortTitle: 'Qualify Needs', content: 'Ask qualifying questions regarding budget and requirements.' },
      { id: 's3', shortTitle: 'Schedule Action', content: 'Propose next step or consultation appointment.' },
      { id: 's4', shortTitle: 'Confirm & Close', content: 'Confirm details and send follow-up on WhatsApp.' }
    ];
  }

  return { opening_line: opening, steps: stepsList };
};

export default function CreateEmployee({ onNavigate }) {
  const [selectedCharacter, setSelectedCharacter] = useState(CHARACTERS[0]);

  // Form Fields
  const [name, setName] = useState(CHARACTERS[0].name);
  const [role, setRole] = useState(CHARACTERS[0].role);
  const [department, setDepartment] = useState(CHARACTERS[0].department || 'Sales');
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Languages
  const [selectedLanguages, setSelectedLanguages] = useState(['Telugu', 'English']);

  // Call Script State
  const [openingLine, setOpeningLine] = useState(CHARACTERS[0].opening_line || '');
  const [steps, setSteps] = useState(CHARACTERS[0].steps || []);
  const [isGenerating, setIsGenerating] = useState(false);

  // Reaction State for Hero Mascot
  const [heroReaction, setHeroReaction] = useState('idle');

  // Submit State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [createdEmployee, setCreatedEmployee] = useState(null);
  const [apiError, setApiError] = useState('');

  // Select Preset Character
  const handleSelectCharacter = (character) => {
    setSelectedCharacter(character);
    setName(character.name);
    setRole(character.role);
    setDepartment(character.department || 'Sales');
    setOpeningLine(character.opening_line || '');
    setSteps(character.steps || []);

    // Trigger reaction
    setHeroReaction('smile');
    setTimeout(() => setHeroReaction('idle'), 1500);
  };

  // Toggle Language Chip
  const handleToggleLanguage = (langId) => {
    let updated;
    if (selectedLanguages.includes(langId)) {
      if (selectedLanguages.length === 1) return;
      updated = selectedLanguages.filter(l => l !== langId);
    } else {
      updated = [...selectedLanguages, langId];
    }
    setSelectedLanguages(updated);

    // Trigger reaction
    setHeroReaction('nod');
    setTimeout(() => setHeroReaction('idle'), 1200);
  };

  // Generate Script
  const handleGenerateScript = () => {
    setIsGenerating(true);
    setHeroReaction('thinking');

    setTimeout(() => {
      const generated = generateAIScript(role, selectedLanguages);
      setOpeningLine(generated.opening_line);
      setSteps(generated.steps);
      setIsGenerating(false);
      setHeroReaction('happy');
      setTimeout(() => setHeroReaction('idle'), 2000);
    }, 600);
  };

  // Validation Check
  const missingFields = [];
  if (!name.trim()) missingFields.push('Employee Name');
  if (!role.trim()) missingFields.push('Role / Job Title');
  if (selectedLanguages.length === 0) missingFields.push('Language Selection');
  if (steps.length === 0) missingFields.push('Call Script Steps');

  const isFormValid = missingFields.length === 0;

  // Submit API Call
  const handleCreateEmployee = async () => {
    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    setApiError('');

    const templateToUse = selectedCharacter || CHARACTERS[0];
    const callScriptData = {
      opening_line: openingLine.trim() || `హలో అండి, {Lead Name} తో మాట్లాడుతున్నానా?`,
      steps: steps.map((s, idx) => ({
        id: s.id || `step_${idx+1}`,
        title: s.shortTitle || `${idx+1}. Call Step`,
        content: typeof s === 'string' ? s : s.content
      }))
    };

    const universalSpec = {
      pre_call_variables: templateToUse.variables || ['Phone number', 'Lead Name', 'Property Type', 'Budget Range'],
      call_script: callScriptData
    };

    const finalMission = specialInstructions.trim()
      ? `${templateToUse.desc || templateToUse.about} Special Guidance: ${specialInstructions.trim()}`
      : (templateToUse.desc || templateToUse.about || 'Autonomous digital worker.');

    const primaryLangCode = selectedLanguages.includes('Telugu') ? 'te' : selectedLanguages.includes('Hindi') ? 'hi' : 'en';

    try {
      const res = await fetch('/api/v1/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          role: role.trim(),
          department: department || 'Sales',
          mission: finalMission,
          description: finalMission,
          personality: 'Professional, warm, encouraging',
          communication_style: 'Concise and natural',
          sales_behavior: 'Consultative & proactive',
          languages: selectedLanguages.map(l => l.toLowerCase().slice(0, 2)),
          voice_id: primaryLangCode === 'te' ? 'sarvam-te-kavitha' : primaryLangCode === 'hi' ? 'sarvam-hi-anushka' : 'sarvam-en-sarah',
          voice_name: primaryLangCode === 'te' ? 'Kavitha (Sarvam AI)' : primaryLangCode === 'hi' ? 'Anushka (Sarvam AI)' : 'Sarah (Sarvam AI)',
          voice_gender: 'female',
          voice_language: primaryLangCode,
          primary_model: 'groq',
          mascot: selectedCharacter?.mascot || 'beard',
          call_script: callScriptData,
          universal_spec: universalSpec,
          working_hours: { start: '09:00', end: '21:00', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] }
        })
      });

      if (res.ok) {
        const created = await res.json();
        setCreatedEmployee({
          ...created,
          mascot: selectedCharacter?.mascot || 'beard',
          name: name.trim(),
          role: role.trim()
        });
        setIsSuccess(true);
      } else {
        const data = await res.json();
        setApiError(data.detail || 'Could not create AI employee.');
      }
    } catch (err) {
      console.error('Failed to create employee:', err);
      setApiError('Connection error. Please verify server connectivity and retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form to create another
  const handleCreateAnother = () => {
    setIsSuccess(false);
    setCreatedEmployee(null);
    setSelectedCharacter(CHARACTERS[0]);
    setName(CHARACTERS[0].name);
    setRole(CHARACTERS[0].role);
    setSpecialInstructions('');
    setOpeningLine(CHARACTERS[0].opening_line);
    setSteps(CHARACTERS[0].steps);
  };

  // SUCCESS SCREEN
  if (isSuccess && createdEmployee) {
    return (
      <SuccessScreen
        employee={createdEmployee}
        onOpenStudio={() => onNavigate('employee-detail', { employeeId: createdEmployee.id })}
        onCreateAnother={handleCreateAnother}
      />
    );
  }

  return (
    <div className="create-employee-root" style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'fixed', top: 0, left: 0, zIndex: 100 }}>
      {/* HEADER BAR */}
      <header style={{
        height: 60,
        background: '#FFFFFF',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '0 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        {/* Left: Back Link & Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            type="button"
            onClick={() => onNavigate('employees')}
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-heading)',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 20,
              transition: 'all 200ms ease-out',
              boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)'
            }}
          >
            <ArrowLeft size={15} /> Back to My Employees
          </button>

          <div style={{ height: 18, width: 1, background: 'var(--border-subtle)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/saadhyam-logo.png" alt="Saadhyam Logo" style={{ height: 22, width: 'auto' }} />
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-heading)', fontFamily: 'Newsreader, serif' }}>
              Saadhyam
            </span>
          </div>
        </div>

        {/* Center Title */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-heading)', tracking: '-0.02em' }}>
            Create New AI Employee
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-label)' }}>
            Hire an autonomous digital worker in under 1 minute
          </div>
        </div>

        {/* Right Badge */}
        <div>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: 20,
            background: 'var(--purple-tint)',
            color: 'var(--purple-primary)'
          }}>
            Voice AI Builder
          </span>
        </div>
      </header>

      {/* TOAST / ERROR BANNER WITH RETRY */}
      {apiError && (
        <div style={{
          background: '#FEF2F2',
          borderBottom: '1px solid #FECACA',
          color: '#B91C1C',
          padding: '8px 28px',
          fontSize: 12.5,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={15} color="#B91C1C" />
            <span>{apiError}</span>
          </div>
          <button
            onClick={handleCreateEmployee}
            style={{
              background: '#B91C1C',
              color: '#FFFFFF',
              border: 'none',
              padding: '3px 12px',
              borderRadius: 12,
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* MAIN TWO-COLUMN BODY (55% LEFT / 45% RIGHT) */}
      <main style={{
        flex: 1,
        padding: '16px 28px 80px',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}>
        <div style={{
          maxWidth: 1320,
          margin: '0 auto',
          height: '100%',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 52%) minmax(0, 48%)',
          gap: 20,
          alignItems: 'start'
        }}>

          {/* LEFT COLUMN: PRESETS, IDENTITY & LANGUAGE */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>

            {/* 1. Character Presets Row */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-label)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                1. Select Character Preset
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                {CHARACTERS.map(char => (
                  <CharacterCard
                    key={char.id}
                    character={char}
                    isSelected={selectedCharacter?.id === char.id}
                    onSelect={handleSelectCharacter}
                  />
                ))}
              </div>
            </div>

            {/* 2. Side-by-Side Employee Name & Role Inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 4 }}>
                  Employee Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Farhan"
                  className="premium-input"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 4 }}>
                  Role / Job Title *
                </label>
                <input
                  type="text"
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  placeholder="e.g. Real Estate Lead Caller"
                  className="premium-input"
                />
              </div>
            </div>

            {/* 3. Language Selection Component */}
            <LanguagePicker
              selectedLanguages={selectedLanguages}
              onToggleLanguage={handleToggleLanguage}
            />

            {/* 4. Special Instructions Textarea (Compact 2-line with char counter) */}
            <div style={{
              background: '#FFFFFF',
              border: '1px solid var(--border-subtle)',
              borderRadius: 16,
              padding: '12px 16px',
              boxShadow: 'var(--shadow-soft)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-label)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Special Instructions (Optional)
                </label>
                <span style={{ fontSize: 11, color: 'var(--text-label)' }}>
                  {specialInstructions.length} / 200
                </span>
              </div>
              <textarea
                rows={2}
                maxLength={200}
                value={specialInstructions}
                onChange={e => setSpecialInstructions(e.target.value)}
                placeholder="e.g. Focus on 2BHK property listings in Gachibowli, mention weekend discounts..."
                className="premium-textarea"
                style={{ fontSize: 13 }}
              />
            </div>
          </div>

          {/* RIGHT COLUMN: SINGLE HERO CARD (CHARACTER STRIP + SCRIPT PANEL) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', minHeight: 0 }}>
            {/* Slim Hero Strip */}
            <CharacterHero
              character={selectedCharacter}
              reaction={heroReaction}
            />

            {/* Script Panel (Fills rest of height) */}
            <ScriptPanel
              openingLine={openingLine}
              setOpeningLine={setOpeningLine}
              steps={steps}
              setSteps={setSteps}
              role={role}
              selectedLanguages={selectedLanguages}
              onGenerateScript={handleGenerateScript}
              isGenerating={isGenerating}
            />
          </div>
        </div>
      </main>

      {/* FIXED FROSTED GLASS FOOTER */}
      <footer className="frosted-footer" style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 64,
        padding: '0 36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 110
      }}>
        <div style={{ fontSize: 13, color: 'var(--text-body)' }}>
          Ready to launch <strong>{name || 'AI Worker'}</strong> as <strong>{role || 'Voice Role'}</strong>
        </div>

        {/* Create Employee CTA Button with Tooltip for Missing Fields */}
        <div style={{ position: 'relative' }} title={!isFormValid ? `Please complete: ${missingFields.join(', ')}` : ''}>
          <button
            type="button"
            onClick={handleCreateEmployee}
            disabled={!isFormValid || isSubmitting}
            style={{
              height: 50,
              padding: '0 32px',
              borderRadius: 25,
              background: isFormValid ? 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)' : '#E2E8F0',
              color: isFormValid ? '#FFFFFF' : '#94A3B8',
              border: 'none',
              fontSize: 15,
              fontWeight: 700,
              cursor: isFormValid && !isSubmitting ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: isFormValid ? '0 4px 16px rgba(124, 58, 237, 0.35)' : 'none',
              transition: 'all 200ms ease-out'
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Launching Worker...</span>
              </>
            ) : (
              <>
                <Sparkles size={18} />
                <span>Create Employee</span>
              </>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}
