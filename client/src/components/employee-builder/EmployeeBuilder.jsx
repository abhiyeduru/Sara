import React, { useState, useEffect, useRef } from 'react';
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

export default function EmployeeBuilder({ onNavigate, onEmployeeCreated, onTestCall }) {
  const [callingMode, setCallingMode] = useState('instant'); // 'instant' | 'bulk'
  const [selectedLanguage, setSelectedLanguage] = useState('te'); // 'te', 'hi', etc.
  const [selectedTemplate, setSelectedTemplate] = useState(BUSINESS_TEMPLATES[0]);
  const [description, setDescription] = useState(BUSINESS_TEMPLATES[0].prompt);
  
  // Script Preview State
  const [isScriptExpanded, setIsScriptExpanded] = useState(true);
  const [copiedStage, setCopiedStage] = useState(null);

  // Custom Voice & Text Synthesized Script State:
  // "dashboard nunci emplyoe crete chesinapudu autometoc ga scipt daniki thaggattu maripovali"
  const [customScriptStages, setCustomScriptStages] = useState(null);
  const [customScriptTitle, setCustomScriptTitle] = useState(null);
  const [isVoicePrepared, setIsVoicePrepared] = useState(false);
  const [isAdaptingScript, setIsAdaptingScript] = useState(false);

  // Bulk Leads Modal
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  // Generation & Success States
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileStep, setCompileStep] = useState('');
  const [createdEmployee, setCreatedEmployee] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // ── Smart Domain Synthesizer: Instantly matches script stages to user's text ──
  const getDomainScript = (text, lang) => {
    const lower = (text || '').toLowerCase();

    if (lower.includes('ప్లాట్') || lower.includes('విల్లా') || lower.includes('రియల్ ఎస్టేట్') || lower.includes('plot') || lower.includes('villa') || lower.includes('real estate') || lower.includes('land') || lower.includes('venture') || lower.includes('వెంచర్')) {
      return {
        title: '🏡 Real Estate & Property Advisory',
        stages: [
          {
            step: 1,
            title: '1. Greet & Reference Property Enquiry',
            subtitle: 'Warm Introduction & context',
            dialogue: {
              te: 'నమస్కారం అండి! మీరు మా వెంచర్‌లో ఓపెన్ ప్లాట్లు/విల్లాల గురించి వివరాలు అడిగారు కదా, ఆ సమాచారం తెలియజేయడానికి కాల్ చేస్తున్నానండి.',
              en: 'Hello! Calling regarding the property and villa details you enquired about in our gated venture.',
              hi: 'नमस्ते! आपने हमारे वेंचर में ओपन प्लॉट्स और विला के बारे में जानकारी मांगी थी, उसी संदर्भ में बात करने के लिए कॉल किया है।'
            }
          },
          {
            step: 2,
            title: '2. Qualify Layout & Budget',
            subtitle: 'Discover specific needs & budget',
            dialogue: {
              te: 'మీరు ఏ సైజు ప్లాట్ లేదా 2/3 BHK విల్లా కోసం చూస్తున్నారు అండి? మరియు మీ బడ్జెట్ ఎంతవరకు అనుకుంటున్నారు?',
              en: 'May I know what plot size or BHK configuration you are looking for, and your preferred budget range?',
              hi: 'आप किस साइज का प्लॉट या विला देख रहे हैं, और आपका बजट लगभग कितना रहेगा?'
            }
          },
          {
            step: 3,
            title: '3. Highlight Venture Amenities & Clear Title',
            subtitle: 'Highlight top offerings & advantages',
            dialogue: {
              te: 'మా ప్రాజెక్ట్ 100% క్లియర్ టైటిల్, RERA/DTCP అప్రూవల్ మరియు ప్రీమియం క్లబ్‌హౌస్ సౌకర్యాలతో వేగంగా అభివృద్ధి చెందుతోంది అండి.',
              en: 'Our venture is 100% RERA & DTCP approved with premium clubhouse amenities and rapid development.',
              hi: 'हमारा प्रोजेक्ट 100% RERA/DTCP अप्रूव्ड है और सभी मॉडर्न क्लब हाउस सुविधाओं के साथ तैयार हो रहा है।'
            }
          },
          {
            step: 4,
            title: '4. Address Bank Loans & Registration',
            subtitle: 'Resolve doubts, pricing, or assurances',
            dialogue: {
              te: 'ప్రముఖ జాతీయ బ్యాంకుల నుండి 80% వరకు ఈజీ హోమ్ లోన్ సదుపాయం కూడా అందుబాటులో ఉంది అండి.',
              en: 'Pre-approved bank loans up to 80% are readily available from all leading national banks.',
              hi: 'प्रमुख बैंकों से 80% तक आसान होम लोन की सुविधा भी तुरंत उपलब्ध है।'
            }
          },
          {
            step: 5,
            title: '5. Confirm Free Site Visit & WhatsApp Share',
            subtitle: 'Schedule visit, slot, or WhatsApp brochure',
            dialogue: {
              te: 'ఈ వారాంతంలో ఉచిత సైట్ విజిట్ కోసం కారు పికప్ ఏర్పాటు చేద్దామా అండి? లొకేషన్ వివరాలు మీ వాట్సాప్‌కి కూడా పంపిస్తున్నాను.',
              en: 'Shall we schedule a complimentary site visit with car pickup this weekend? I am also sending the venture map to your WhatsApp.',
              hi: 'क्या इस वीकेंड पर फ्री साइट विजिट के लिए कैब पिकअप बुक करें? लोकेशन और ब्रोशर आपके व्हाट्सऐप पर भेज रही हूँ।'
            }
          }
        ]
      };
    } else if (lower.includes('హాస్పిటల్') || lower.includes('డాక్టర్') || lower.includes('క్లినిక్') || lower.includes('చెకప్') || lower.includes('hospital') || lower.includes('clinic') || lower.includes('doctor') || lower.includes('teeth') || lower.includes('dental') || lower.includes('health') || lower.includes('appointment')) {
      return {
        title: '🏥 Healthcare & Clinic Appointments',
        stages: [
          {
            step: 1,
            title: '1. Greet & Reference Health Consultation',
            subtitle: 'Warm Introduction & context',
            dialogue: {
              te: 'నమస్కారం అండి! మీరు డాక్టర్ కన్సల్టేషన్ అపాయింట్‌మెంట్ కోసం వివరాలు అడిగారు కదా, ఆ సమాచారం కోసం కాల్ చేస్తున్నానండి.',
              en: 'Hello! Calling regarding the doctor consultation appointment you requested details for.',
              hi: 'नमस्ते! आपने डॉक्टर अपॉइंटमेंट के लिए जानकारी मांगी थी, उसी संबंध में बात कर रही हूँ।'
            }
          },
          {
            step: 2,
            title: '2. Understand Health Query & Specialty',
            subtitle: 'Discover specific needs & symptoms',
            dialogue: {
              te: 'మీరు ఏ సమస్య లేదా చెకప్ కోసం డాక్టర్‌ని సంప్రదించాలనుకుంటున్నారో చెప్పగలరా అండి?',
              en: 'Could you share the symptoms or medical consultation you are looking for?',
              hi: 'आप किस परेशानी या चेकअप के लिए डॉक्टर से परामर्श लेना चाहते हैं?'
            }
          },
          {
            step: 3,
            title: '3. Offer Consultation Time Slots',
            subtitle: 'Highlight top offerings & doctor timings',
            dialogue: {
              te: 'రేపు ఉదయం 11:00 AM లేదా సాయంత్రం 5:30 PM స్లాట్ ఖాళీగా ఉంది అండి. మీకు ఏ సమయం అనుకూలంగా ఉంటుంది?',
              en: 'We have consultation slots available tomorrow at 11:00 AM or 5:30 PM. Which timing suits you best?',
              hi: 'कल सुबह 11:00 AM या शाम 5:30 PM का समय खाली है, आपके लिए कौन सा समय सही रहेगा?'
            }
          },
          {
            step: 4,
            title: '4. Address Fees & Clinic Location',
            subtitle: 'Resolve doubts, pricing, or assurances',
            dialogue: {
              te: 'కన్సల్టేషన్ ఫీజు చాలా అందుబాటులో ఉంది మరియు అవసరమైతే రిపోర్ట్స్ ఆన్‌లైన్‌లో కూడా రివ్యూ చేయవచ్చు అండి.',
              en: 'The consultation fees are transparent, and previous medical reports can also be reviewed.',
              hi: 'कंसल्टेशन फीस बहुत ही किफायती है और पिछली रिपोर्ट्स भी डॉक्टर तुरंत देख सकते हैं।'
            }
          },
          {
            step: 5,
            title: '5. Confirm Token & WhatsApp Directions',
            subtitle: 'Schedule visit, slot, or WhatsApp brochure',
            dialogue: {
              te: 'మీ అపాయింట్‌మెంట్ స్లాట్ బుక్ చేశానండి. టోకెన్ నంబర్ మరియు క్లినిక్ లొకేషన్ మీ వాట్సాప్‌కి పంపిస్తున్నాను. ధన్యవాదాలు!',
              en: 'Your consultation is booked! Sending the token number and Google Maps location to your WhatsApp now. Thank you!',
              hi: 'आपका अपॉइंटमेंट बुक हो गया है! टोकन नंबर और क्लिनिक की लोकेशन आपके व्हाट्सऐप पर भेज दी है।'
            }
          }
        ]
      };
    } else if (lower.includes('కార్') || lower.includes('షోరూమ్') || lower.includes('వాహనం') || lower.includes('car') || lower.includes('automobile') || lower.includes('dealership') || lower.includes('test drive')) {
      return {
        title: '🚗 Automobile & Test Drive Sales',
        stages: [
          {
            step: 1,
            title: '1. Greet & Reference Car Inquiry',
            subtitle: 'Warm Introduction & context',
            dialogue: {
              te: 'నమస్కారం అండి! మీరు కొత్త కారు లేదా టెస్ట్ డ్రైవ్ వివరాల కోసం అడిగారు కదా, ఆ సమాచారం అందించడానికి కాల్ చేస్తున్నాను.',
              en: 'Hello! Calling regarding the car model and test drive details you enquired about.',
              hi: 'नमस्ते! आपने कार टेस्ट ड्राइव और नए मॉडल के बारे में जानकारी मांगी थी, उसी संदर्भ में बात करने के लिए कॉल किया है।'
            }
          },
          {
            step: 2,
            title: '2. Qualify Variant, Fuel & Budget',
            subtitle: 'Discover specific needs & budget',
            dialogue: {
              te: 'మీరు పెట్రోల్, డీజిల్ లేదా ఈవీ మోడల్ కోసం చూస్తున్నారా అండి? మరియు మీ ప్రైస్ రేంజ్ ఎంతవరకు అనుకుంటున్నారు?',
              en: 'Are you interested in the Petrol, Diesel or EV variant, and what is your preferred budget?',
              hi: 'आप पेट्रोल, डीजल या इलेक्ट्रिक वैरिएंट में से कौन सा मॉडल देख रहे हैं, और आपका बजट क्या है?'
            }
          },
          {
            step: 3,
            title: '3. Highlight On-Road Discounts & Exchange Bonus',
            subtitle: 'Highlight top offerings & advantages',
            dialogue: {
              te: 'ఈ నెలలో మా వద్ద ఎక్స్ఛేంజ్ బోనస్ మరియు ఆన్-రోడ్ ప్రైస్ పై స్పెషల్ క్యాష్ డిస్కౌంట్స్ అందుబాటులో ఉన్నాయి అండి.',
              en: 'We have special festive exchange bonuses and ready on-road discounts available this month.',
              hi: 'इस महीने हमारे पास एक्सचेंज बोनस और ऑन-रोड प्राइस पर बेहतरीन फेस्टिव डिस्काउंट्स उपलब्ध हैं।'
            }
          },
          {
            step: 4,
            title: '4. Offer Doorstep Test Drive',
            subtitle: 'Resolve doubts, pricing, or assurances',
            dialogue: {
              te: 'మీకు అనుకూలమైన సమయంలో మీ ఇంటి వద్దకే టెస్ట్ డ్రైవ్ వాహనం తీసుకువస్తాము అండి.',
              en: 'We can arrange a complimentary doorstep test drive right at your residence or office.',
              hi: 'हम आपके घर या ऑफिस पर ही फ्री टेस्ट ड्राइव की गाड़ी भिजवा सकते हैं।'
            }
          },
          {
            step: 5,
            title: '5. Book Slot & WhatsApp Brochure',
            subtitle: 'Schedule visit, slot, or WhatsApp brochure',
            dialogue: {
              te: 'రేపు మీకు ఏ సమయానికి టెస్ట్ డ్రైవ్ ప్లాన్ చేద్దాం అండి? కొటేషన్ మీ వాట్సాప్‌కి కూడా పంపిస్తున్నాను.',
              en: 'What time tomorrow shall we schedule your test drive? Sending the full quote to your WhatsApp now.',
              hi: 'कल किस समय आपके लिए टेस्ट ड्राइव फिक्स करें? पूरी कोटेशन आपके व्हाट्सऐप पर भेज रही हूँ।'
            }
          }
        ]
      };
    } else {
      return {
        title: '💼 Business Sales & Lead Advisory',
        stages: [
          {
            step: 1,
            title: '1. Greet & Reference Inquiry',
            subtitle: 'Warm Introduction & context',
            dialogue: {
              te: 'నమస్కారం అండి! మీరు మా సేవల గురించి అడిగారు కదా, ఆ వివరాలు తెలియజేయడానికి కాల్ చేశానండి. ఒక నిమిషం మాట్లాడవచ్చా?',
              en: 'Hello! Calling regarding your inquiry with us. May I take a quick moment to assist you?',
              hi: 'नमस्ते! आपने हमारी सेवाओं के बारे में पूछताछ की थी, उसी के बारे में बात करने के लिए कॉल किया है।'
            }
          },
          {
            step: 2,
            title: '2. Understand Customer Requirement',
            subtitle: 'Discover specific needs & budget',
            dialogue: {
              te: 'మీకు కావలసిన నిర్దిష్ట అవసరాలు మరియు మీ ప్రాధాన్యత గురించి కాస్త వివరంగా చెప్పగలరా అండి?',
              en: 'Could you tell me a little more about your exact requirement and preferred timeline?',
              hi: 'आपकी मुख्य आवश्यकता और बजट के बारे में थोड़ा विस्तार से बता सकते हैं क्या?'
            }
          },
          {
            step: 3,
            title: '3. Explain Solutions & Exclusive Offers',
            subtitle: 'Highlight top offerings & advantages',
            dialogue: {
              te: 'మా వద్ద మీ అవసరానికి సరిపోయే ఉత్తమమైన ప్లాన్స్ మరియు ఈ వారం ప్రత్యేక ఆఫర్లు కూడా అందుబాటులో ఉన్నాయి అండి.',
              en: 'We offer customized packages tailored directly to your requirement with special pricing this week.',
              hi: 'हमारे पास आपकी जरूरत के मुताबिक बेहतरीन पैकेज और इस हफ्ते के स्पेशल डिस्काउंट्स उपलब्ध हैं।'
            }
          },
          {
            step: 4,
            title: '4. Answer Questions & Clarify Pricing',
            subtitle: 'Resolve doubts, pricing, or assurances',
            dialogue: {
              te: 'ధరలు చాలా పారదర్శకంగా ఉంటాయి మరియు పూర్తి కస్టమర్ సపోర్ట్ ఎల్లప్పుడూ మీకు అందుబాటులో ఉంటుంది అండి.',
              en: 'Our pricing is fully transparent with dedicated end-to-end customer assistance.',
              hi: 'हमारी कीमतें बिल्कुल स्पष्ट हैं और 100% कस्टमर सपोर्ट हमेशा उपलब्ध रहेगा।'
            }
          },
          {
            step: 5,
            title: '5. Confirm Next Step & WhatsApp Share',
            subtitle: 'Schedule visit, slot, or WhatsApp brochure',
            dialogue: {
              te: 'పూర్తి వివరాలు, ప్రైసింగ్ కోట్ మీ వాట్సాప్‌కి ఇప్పుడే పంపిస్తున్నాను అండి. మీరు చూసిన తర్వాత తదుపరి స్టెప్ ప్లాన్ చేద్దాం. థాంక్యూ అండి!',
              en: 'I am sending the complete brochure and pricing proposal to your WhatsApp right away. Looking forward to assisting you. Thank you!',
              hi: 'पूरी जानकारी और कोटेशन आपके व्हाट्सऐप पर भेज रही हूँ। धन्यवाद!'
            }
          }
        ]
      };
    }
  };

  // ── Reactive Auto-Adaptation: Script changes automatically to match business description ──
  useEffect(() => {
    const text = description.trim();
    if (!text) return;

    // Instant local adaptation
    const localAdapted = getDomainScript(text, selectedLanguage);
    if (localAdapted) {
      setCustomScriptStages(localAdapted.stages);
      setCustomScriptTitle(localAdapted.title);
      setIsScriptExpanded(true);
    }

    // Debounced Gemini AI fine-tuning for custom descriptions
    const timer = setTimeout(async () => {
      if (text.length > 20 && !isVoicePrepared) {
        setIsAdaptingScript(true);
        try {
          const res = await fetch('/api/v1/voice/generate-script-from-voice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transcript: text,
              language: selectedLanguage,
              calling_mode: callingMode
            })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.script_stages && data.script_stages.length >= 3) {
              setCustomScriptStages(data.script_stages);
              if (data.business_type) setCustomScriptTitle(data.business_type);
            }
          }
        } catch (e) {
          // Local fallback already active
        } finally {
          setIsAdaptingScript(false);
        }
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [description, selectedLanguage]);

  // Handle template selection
  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
    setDescription(template.prompt);
    setIsVoicePrepared(false);
    setErrorMessage('');
    const adapted = getDomainScript(template.prompt, selectedLanguage);
    if (adapted) {
      setCustomScriptStages(adapted.stages);
      setCustomScriptTitle(adapted.title);
    }
  };

  // Autonomously prepare complete business script from voice
  const handleVoiceScriptReady = ({ transcript, scriptStages, businessTitle, cleanedGoal }) => {
    if (scriptStages && scriptStages.length > 0) {
      setCustomScriptStages(scriptStages);
      setCustomScriptTitle(businessTitle || 'Custom Business Calling Script');
      setIsVoicePrepared(true);
      setIsScriptExpanded(true);
    }
    if (cleanedGoal) {
      setDescription(cleanedGoal);
    } else if (transcript) {
      setDescription(transcript);
    }
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

      const activeStages = customScriptStages || selectedTemplate?.scriptStages || [];
      const openingLine = activeStages[0]?.dialogue?.[selectedLanguage] || activeStages[0]?.dialogue?.['en'] || (typeof activeStages[0]?.dialogue === 'string' ? activeStages[0]?.dialogue : '');
      const templateCategory = customScriptTitle || selectedTemplate?.title || 'Custom business';

      const res = await fetch('/api/v1/employees/compile-and-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: textToBuild,
          calling_mode: callingMode,
          language: selectedLanguage,
          template_category: templateCategory,
          script_stages: activeStages,
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

      {/* ── TWO-COLUMN MAIN BUILDER WORKSPACE (FLUID RESPONSIVE) ── */}
      <div
        className="builder-grid-container"
        style={{
          position: 'relative',
          zIndex: 2,
          marginBottom: 18,
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box'
        }}
      >
        {/* LEFT COLUMN: Text Builder & Selectors */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0, width: '100%' }}>
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

          {/* ── AUTO-PREPARED DYNAMIC CALL SCRIPT PREVIEW (TELUGU & SPEECH READY) ── */}
          {((customScriptStages && customScriptStages.length > 0) || (selectedTemplate?.scriptStages && selectedTemplate.scriptStages.length > 0)) && (
            (() => {
              const currentStages = customScriptStages || selectedTemplate?.scriptStages || [];
              const currentTitle = customScriptTitle || `Auto-Prepared Script for ${selectedTemplate?.title || 'Your Business'}`;

              return (
                <div
                  style={{
                    background: isVoicePrepared ? 'linear-gradient(135deg, #faf5ff 0%, #f5f3ff 100%)' : '#faf5ff',
                    border: isVoicePrepared ? '1.5px solid #a855f7' : '1.5px solid #e9d5ff',
                    borderRadius: 14,
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    boxShadow: isVoicePrepared ? '0 4px 20px rgba(124, 58, 237, 0.12)' : 'none',
                    transition: 'all 0.25s ease'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      flexWrap: 'wrap',
                      gap: 6
                    }}
                    onClick={() => setIsScriptExpanded(!isScriptExpanded)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {isVoicePrepared ? <Sparkles size={16} color="#7c3aed" /> : <MessageSquare size={15} color="#7c3aed" />}
                      <span style={{ fontSize: 12.5, fontWeight: 800, color: '#1e1b4b' }}>
                        {currentTitle}
                      </span>
                      {isVoicePrepared && (
                        <span
                          style={{
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: '#ffffff',
                            fontSize: 9.5,
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: 12,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)'
                          }}
                        >
                          🎙️ READY FROM VOICE
                        </span>
                      )}
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
                        {isScriptExpanded ? 'Hide Script' : `Preview Script (${currentStages.length} Stages)`}
                      </span>
                      {isScriptExpanded ? <ChevronUp size={14} color="#6d28d9" /> : <ChevronDown size={14} color="#6d28d9" />}
                    </div>
                  </div>

                  {isScriptExpanded && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                      {currentStages.map((stg, idx) => {
                        const dialogueText = (stg.dialogue && (stg.dialogue[selectedLanguage] || stg.dialogue['en'] || (typeof stg.dialogue === 'string' ? stg.dialogue : Object.values(stg.dialogue)[0]))) || (typeof stg.content === 'string' ? stg.content : '');

                        return (
                          <div
                            key={stg.step || idx}
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
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
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
                                    justifyContent: 'center',
                                    flexShrink: 0
                                  }}
                                >
                                  {stg.step || idx + 1}
                                </span>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
                                  {stg.title}
                                </span>
                                {stg.subtitle && (
                                  <span style={{ fontSize: 10.5, color: '#64748b' }}>
                                    • {stg.subtitle}
                                  </span>
                                )}
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
                                  fontSize: 10.5,
                                  flexShrink: 0
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
                                lineHeight: 1.45,
                                paddingLeft: 24,
                                fontStyle: 'normal'
                              }}
                            >
                              "{dialogueText}"
                            </div>

                            {selectedLanguage === 'te' && stg.dialogue?.['en'] && (
                              <div
                                style={{
                                  fontSize: 10.5,
                                  color: '#64748b',
                                  paddingLeft: 24,
                                  fontStyle: 'italic'
                                }}
                              >
                                EN: "{stg.dialogue['en']}"
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()
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
            justifyContent: 'center',
            minWidth: 0,
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box',
            overflow: 'hidden'
          }}
        >
          <SaraVoiceAssistant
            selectedLanguage={selectedLanguage}
            onTranscriptionUpdate={setDescription}
            currentDescription={description}
            onAutoBuild={handleBuildEmployee}
            onVoiceScriptReady={handleVoiceScriptReady}
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
