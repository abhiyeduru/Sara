import React, { useState } from 'react';
import {
  Sparkles, Bot, Zap, HeartHandshake, GraduationCap, Building2, Stethoscope,
  ShoppingCart, Factory, ChevronRight, Loader2, CheckCircle2, Phone, Volume2,
  ArrowLeft, Plus, Check, Sliders, MessageSquare, Play
} from 'lucide-react';

const PRESET_TEMPLATES = [
  {
    id: 'farhan',
    name: 'Farhan',
    role: 'Real Estate Lead Caller',
    department: 'Sales',
    color: '#e05638',
    avatar: 'F',
    language: 'Telugu & English (te-IN)',
    voice_id: 'sarvam-te-kavitha',
    voice_name: 'Kavitha (Telugu)',
    desc: 'Calls property inquiry leads, qualifies living vs investment, budget, and books site visits in Telugu & English.',
    opening_line: 'హలో అండి, {Lead Name} తో మాట్లాడుతున్నానా?',
    variables: ['Phone number', 'Lead Name', 'Property Type', 'Preferred Location', 'Budget Range'],
    steps: [
      {
        id: 'step_1',
        title: '1. Orient & Context',
        badge: 'START',
        content: "Once they confirm their identity, briefly say you're Farhan calling about their recent property enquiry, and mention you're here to help with their search. Reference the enquiry (e.g. 'మీరు ప్రాపర్టీ గురించి ఇంక్వైరీ చేశారు'). Start by asking which area they're interested in. For example you might say: 'నేను ఫర్హాన్ మాట్లాడుతున్నాను, మీరు ప్రాపర్టీ కోసం ఇంక్వైరీ చేశారు కదా అండి? ఏ ఏరియా లో చూస్తున్నారు చెప్పగలరా?'"
      },
      {
        id: 'step_2',
        title: '2. Qualify Need',
        badge: null,
        content: "Qualify their requirement ONE question at a time: first ask if it's for living or investment; once they answer, ask their budget range; then, if not already clear, ask when they could come for a site visit. React to each answer before moving to the next. If their budget is much lower than your properties, gently inform them and check if they're open to higher options or want to wait. For example, start with: 'మీరు లివింగ్ కి చూస్తున్నారా లేక ఇన్వెస్ట్మెంట్ కి వెతుకుతున్నారా అండి?'"
      },
      {
        id: 'step_3',
        title: '3. Book Site Visit',
        badge: null,
        content: "If their budget fits, offer to book a site visit and suggest a couple of date/time options. If they're interested, confirm the slot. If they're not ready, ask if they'd like more info over వాట్సాప్ or a follow-up call. For example: 'మీ బడ్జెట్ లో మంచి ఆప్షన్స్ ఉన్నాయి అండి. సైట్ విజిట్ కి ఎప్పుడు రాగలరు? ఈ వీకెండ్ లేదా ఇంకో టైం?'"
      },
      {
        id: 'step_4',
        title: '4. Confirm & Close',
        badge: null,
        content: "Confirm the agreed next step (site visit details or info sharing). Thank them warmly and let them know you'll send the location/details on వాట్సాప్. Offer to answer any last questions before ending. For example: 'సరే అండి, మీకు డీటెయిల్స్ వాట్సాప్ చేస్తాను. ఇంకేమైనా అడగాలనిపిస్తే చెప్పొచ్చు.'"
      },
      {
        id: 'step_5',
        title: '5. FAQs',
        badge: null,
        content: "Common questions callers ask, and how to answer them. Add one per line as 'Q: ... A: ...'. Answer ONLY from what's written here; if a question isn't listed, use your don't-know response.\n\ne.g.\nQ: What are your timings?\nA: We're open 9am to 6pm, Monday to Saturday."
      }
    ]
  },
  {
    id: 'priya',
    name: 'Priya',
    role: 'Clinic & Healthcare Coordinator',
    department: 'Customer Care',
    color: '#059669',
    avatar: 'P',
    language: 'Telugu & English (te-IN)',
    voice_id: 'sarvam-te-kavitha',
    voice_name: 'Kavitha (Telugu)',
    desc: 'Confirms patient consultation slots, asks about symptoms politely, and shares clinic directions.',
    opening_line: 'నమస్కారం అండి, {Lead Name} గారేనా మాట్లాడేది?',
    variables: ['Phone number', 'Lead Name', 'Doctor Name', 'Preferred Slot', 'Clinic Location'],
    steps: [
      {
        id: 'step_1',
        title: '1. Greet & Reference Booking',
        badge: 'START',
        content: "Introduce yourself as Priya from the healthcare clinic. Say: 'నమస్కారం అండి, డాక్టర్ కన్సల్టేషన్ కోసం మీరు అడిగిన వివరాల గురించి కాల్ చేస్తున్నాను.'"
      },
      {
        id: 'step_2',
        title: '2. Check Symptoms & Urgency',
        badge: null,
        content: "Ask what consultation or symptoms they are looking to discuss. Listen carefully and confirm: 'మీరు ఏ సమస్య కోసం చెకప్ అనుకుంటున్నారు అండి?'"
      },
      {
        id: 'step_3',
        title: '3. Schedule & Confirm Slot',
        badge: null,
        content: "Offer available morning or evening slots: 'రేపు ఉదయం 11 గంటలకు లేదా సాయంత్రం 5 గంటలకు స్లాట్ ఖాళీగా ఉంది, ఏది మీకు వీలవుతుంది?'"
      },
      {
        id: 'step_4',
        title: '4. Send WhatsApp Confirmation',
        badge: null,
        content: "Confirm appointment and send clinic address and token on WhatsApp: 'మీ అపాయింట్మెంట్ కన్ఫర్మ్ చేశాను అండి. లొకేషన్ వివరాలు వాట్సాప్ చేస్తాను. ధన్యవాదాలు!'"
      }
    ]
  },
  {
    id: 'rahul',
    name: 'Rahul',
    role: 'Fitness & Gym Sales Advisor',
    department: 'Sales',
    color: '#7c3aed',
    avatar: 'R',
    language: 'Telugu & English (te-IN)',
    voice_id: 'sarvam-te-kavitha',
    voice_name: 'Kavitha (Telugu)',
    desc: 'Qualifies fitness goals (weight loss, muscle gain), invites for free trial sessions, and sells gym memberships.',
    opening_line: 'హలో అండి, {Lead Name} గారితో మాట్లాడుతున్నానా? ఫిట్నెస్ సెంటర్ నుండి రాహుల్ ని.',
    variables: ['Phone number', 'Lead Name', 'Fitness Goal', 'Trial Date', 'Branch Location'],
    steps: [
      {
        id: 'step_1',
        title: '1. Connect & Acknowledge Inquiry',
        badge: 'START',
        content: "Briefly reference their inquiry about gym membership or personal training. 'మా జిమ్ మెంబర్షిప్ గురించి మీరు ఎంక్వైరీ చేశారు కదా అండి?'"
      },
      {
        id: 'step_2',
        title: '2. Understand Fitness Goal',
        badge: null,
        content: "Ask what their primary fitness goal is: weight loss, muscle building, or general fitness. 'మీ మెయిన్ గోల్ వెయిట్ లాస్ ఆ లేక ఫిట్నెస్ కోసమా అండి?'"
      },
      {
        id: 'step_3',
        title: '3. Offer Free Trial Workout',
        badge: null,
        content: "Invite them for a free 1-day pass with a certified trainer. 'ఈ శనివారం లేదా ఆదివారం ఫ్రీ ట్రయల్ వర్కౌట్ కి రండి, మా ట్రైనర్స్ మీకు ప్లాన్ ఎక్స్ప్లెయిన్ చేస్తారు.'"
      },
      {
        id: 'step_4',
        title: '4. WhatsApp Pass & Closure',
        badge: null,
        content: "Confirm their visit and send VIP pass on WhatsApp. 'మీరు వచ్చే సమయానికి పాస్ వాట్సాప్ చేస్తాను అండి. సీ యూ అట్ ద జిమ్!'"
      }
    ]
  }
];

export default function CreateEmployee({ onNavigate }) {
  const [selectedTemplate, setSelectedTemplate] = useState(PRESET_TEMPLATES[0]);
  const [name, setName] = useState(PRESET_TEMPLATES[0].name);
  const [role, setRole] = useState(PRESET_TEMPLATES[0].role);
  const [department, setDepartment] = useState(PRESET_TEMPLATES[0].department);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSelectTemplate = (tmpl) => {
    setSelectedTemplate(tmpl);
    setName(tmpl.name);
    setRole(tmpl.role);
    setDepartment(tmpl.department);
  };

  const handleCreateEmployee = async () => {
    if (!name.trim()) {
      setError('Please provide an employee name.');
      return;
    }
    setIsSubmitting(true);
    setError('');

    const templateToUse = selectedTemplate || PRESET_TEMPLATES[0];
    const callScriptData = {
      opening_line: templateToUse.opening_line || `హలో అండి, {Lead Name} తో మాట్లాడుతున్నానా?`,
      steps: templateToUse.steps || []
    };

    const universalSpec = {
      pre_call_variables: templateToUse.variables || ['Phone number', 'Lead Name', 'Property Type', 'Budget Range'],
      call_script: callScriptData
    };

    try {
      const res = await fetch('/api/v1/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          role: role.trim() || 'AI Telephony Caller',
          department: department || 'Sales',
          mission: customPrompt || templateToUse.desc,
          description: customPrompt || templateToUse.desc,
          personality: 'Professional, warm, encouraging',
          communication_style: 'Concise and natural',
          sales_behavior: 'Consultative & proactive',
          languages: ['te', 'en'],
          voice_id: templateToUse.voice_id || 'sarvam-te-kavitha',
          voice_name: templateToUse.voice_name || 'Kavitha (Telugu)',
          voice_gender: 'female',
          voice_language: 'te',
          primary_model: 'groq',
          call_script: callScriptData,
          universal_spec: universalSpec,
          working_hours: { start: '09:00', end: '21:00', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] }
        })
      });

      if (res.ok) {
        const created = await res.json();
        onNavigate('employee-detail', { employeeId: created.id });
      } else {
        const data = await res.json();
        setError(data.detail || 'Could not create AI employee.');
      }
    } catch (err) {
      console.error('Failed to create employee:', err);
      setError('Connection error while creating employee.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '28px 24px' }} className="animate-fade-in">
      {/* Back button */}
      <button
        onClick={() => onNavigate('employees')}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#64748b',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 16
        }}
      >
        <ArrowLeft size={16} /> Back to My Employees
      </button>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a', fontFamily: 'Plus Jakarta Sans' }}>
          Create New AI Employee
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: '#64748b' }}>
          Create an autonomous voice agent that speaks fluent Telugu & English, follows structured call steps, and dials customers automatically.
        </p>
      </div>

      {error && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
          padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 20
        }}>
          {error}
        </div>
      )}

      {/* 1. Choose Pre-configured Template */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          1. Choose Role & Script Template
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: 14 }}>
          {PRESET_TEMPLATES.map(t => {
            const isSelected = selectedTemplate?.id === t.id;
            return (
              <div
                key={t.id}
                onClick={() => handleSelectTemplate(t)}
                style={{
                  background: isSelected ? '#faf5ff' : '#ffffff',
                  border: isSelected ? '2px solid #7c3aed' : '1px solid #e2e8f0',
                  borderRadius: 14,
                  padding: 18,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? '0 4px 14px rgba(124,58,237,0.1)' : '0 1px 3px rgba(0,0,0,0.02)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 10,
                      background: t.color, color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, fontWeight: 800
                    }}>
                      {t.avatar}
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{t.role}</div>
                    </div>
                  </div>
                  {isSelected && (
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={13} color="#fff" />
                    </div>
                  )}
                </div>
                <p style={{ margin: '0 0 10px', fontSize: 12, color: '#475569', lineHeight: 1.4 }}>
                  {t.desc}
                </p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: '#f1f5f9', color: '#334155' }}>
                    {t.language}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: '#f5f3ff', color: '#7c3aed' }}>
                    {t.steps.length} call steps
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Customise Employee Profile */}
      <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          2. Employee Details
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              Employee Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Farhan"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              Designation / Role *
            </label>
            <input
              type="text"
              value={role}
              onChange={e => setRole(e.target.value)}
              placeholder="e.g. Real Estate Lead Caller"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
            Custom Mission / Extra Guidance (Optional)
          </label>
          <textarea
            rows={2}
            value={customPrompt}
            onChange={e => setCustomPrompt(e.target.value)}
            placeholder="e.g. Focus on luxury 2BHK and 3BHK villas in Gachibowli and tell customers our weekend discount is ending soon."
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 8,
              border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box', resize: 'vertical'
            }}
          />
        </div>

        {/* Script Preview Box */}
        <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>
            DEFAULT OPENING LINE PREVIEW
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
            {selectedTemplate?.opening_line || 'హలో అండి, {Lead Name} తో మాట్లాడుతున్నానా?'}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
            Includes 5 full call steps in Telugu & English, pre-call variables, and automated customer dialer.
          </div>
        </div>
      </div>

      {/* 3. Action Button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
        <button
          onClick={() => onNavigate('employees')}
          style={{
            background: '#ffffff', border: '1px solid #cbd5e1', color: '#475569',
            padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer'
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleCreateEmployee}
          disabled={isSubmitting}
          style={{
            background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
            border: 'none', color: '#ffffff',
            padding: '12px 28px', borderRadius: 10, fontSize: 14, fontWeight: 700,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: '0 4px 14px rgba(124,58,237,0.35)'
          }}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Configuring Voice & Script...
            </>
          ) : (
            <>
              <Sparkles size={16} />
              Launch {name || 'Employee'} & Open Studio
            </>
          )}
        </button>
      </div>
    </div>
  );
}
