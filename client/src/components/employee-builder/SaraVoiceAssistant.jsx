import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Square, RefreshCw, Volume2, Sparkles, Check, AlertCircle, ArrowRight, Radio, Wand2, Layers } from 'lucide-react';

export default function SaraVoiceAssistant({
  selectedLanguage = 'te',
  onTranscriptionUpdate,
  currentDescription,
  onAutoBuild,
  onVoiceScriptReady
}) {
  const [isListening, setIsListening] = useState(false);
  const [isRecordingMedia, setIsRecordingMedia] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSynthesizingScript, setIsSynthesizingScript] = useState(false);
  const [synthesisNotice, setSynthesisNotice] = useState('');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recognitionError, setRecognitionError] = useState('');
  const [transcriptInterim, setTranscriptInterim] = useState('');
  const [hasCapturedSpeech, setHasCapturedSpeech] = useState(false);
  const [selectedPromptKey, setSelectedPromptKey] = useState(null);

  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  // Map language code to SpeechRecognition BCP-47 locale
  const getLocaleForLang = (code) => {
    switch (code) {
      case 'te': return 'te-IN';
      case 'hi': return 'hi-IN';
      case 'ta': return 'ta-IN';
      case 'kn': return 'kn-IN';
      case 'ml': return 'ml-IN';
      case 'mr': return 'mr-IN';
      case 'en': return 'en-IN';
      default: return 'te-IN';
    }
  };

  // Quick Voice Starter Chips for 1-Click "Click that then also take from that"
  const QUICK_PROMPTS = [
    {
      key: 'real-estate',
      badge: '🏡 Real Estate',
      label: 'Plot Sales & Site Visits (Telugu)',
      text: 'నమస్కారం, మా వెంచర్‌లో ఓపెన్ ప్లాట్లు మరియు ప్రీమియం విల్లాలు అందుబాటులో ఉన్నాయి. సైట్ విజిట్ బుక్ చేయడానికి మరియు ఆఫర్ల కోసం నేను మీకు సహాయం చేస్తాను.'
    },
    {
      key: 'customer-support',
      badge: '💼 Support',
      label: 'Order Support & Inquiries (English/Telugu)',
      text: 'Hello! I am your AI customer support specialist. I can help with order tracking, invoice details, pricing, and answering any client questions.'
    },
    {
      key: 'healthcare',
      badge: '🏥 Healthcare',
      label: 'Clinic & Doctor Appointments (Telugu)',
      text: 'నమస్కారం! డాక్టర్ కన్సల్టేషన్ అపాయింట్‌మెంట్ బుక్ చేసుకోవడానికి, సమయం మార్చడానికి లేదా రిపోర్ట్స్ సమాచారం కోసం నేను అందుబాటులో ఉన్నాను.'
    },
    {
      key: 'collections',
      badge: '💳 Finance',
      label: 'EMI Reminder & Payment Links',
      text: 'నమస్కారం! మీ లోన్ EMI గడువు తేదీ సమీపిస్తోంది. సులభమైన UPI పేమెంట్ లింక్ SMS లేదా WhatsApp ద్వారా పంపించమంటారా?'
    }
  ];

  useEffect(() => {
    return () => {
      stopVoiceSession();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // 1. Direct Audio Recording via MediaRecorder (Server Sarvam STT Fallback)
  const startMediaRecorderSession = async () => {
    try {
      setRecognitionError('');
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : (MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '');
      
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        setRecordingSeconds(0);
        setIsRecordingMedia(false);

        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (audioBlob.size > 100) {
          await sendAudioForTranscription(audioBlob);
        }
      };

      recorder.start(250);
      setIsRecordingMedia(true);
      setIsListening(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('MediaRecorder error:', err);
      setRecognitionError('Microphone permission blocked or unavailable. Click one of the quick prompts below.');
      setIsRecordingMedia(false);
      setIsListening(false);
    }
  };

  const stopMediaRecorderSession = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const sendAudioForTranscription = async (blob) => {
    setIsTranscribing(true);
    setSynthesisNotice('Transcribing your speech in Telugu...');
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64Audio = reader.result;
        try {
          const res = await fetch('/api/v1/voice/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audio_base64: base64Audio,
              language: selectedLanguage
            })
          });
          const data = await res.json();
          if (data.success && data.transcript) {
            await handleApplyScript(data.transcript);
          } else {
            setRecognitionError('No clear audio speech detected. Try speaking closer or click a sample prompt below.');
          }
        } catch (e) {
          console.warn('STT API error:', e);
          setRecognitionError('Audio transcribed with notice. You can select a sample prompt below.');
        } finally {
          setIsTranscribing(false);
        }
      };
    } catch (err) {
      console.error('Error reading audio blob:', err);
      setIsTranscribing(false);
    }
  };

  // 2. Primary Web Speech API Session
  const startVoiceSession = () => {
    setRecognitionError('');
    setTranscriptInterim('');
    setSynthesisNotice('');

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRec) {
      startMediaRecorderSession();
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = getLocaleForLang(selectedLanguage);
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setRecognitionError('');
        setSynthesisNotice(`🎙️ Listening in ${selectedLanguage === 'te' ? 'Telugu' : selectedLanguage.toUpperCase()}... Speak your business requirement.`);
      };

      recognition.onresult = (event) => {
        let interim = '';
        let finalStr = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalStr += trans + ' ';
          } else {
            interim += trans;
          }
        }

        if (interim) {
          setTranscriptInterim(interim);
        }

        if (finalStr && finalStr.trim()) {
          handleApplyScript(finalStr.trim());
        }
      };

      recognition.onerror = (event) => {
        console.warn('SpeechRecognition error:', event.error);
        if (event.error === 'service-not-allowed' || event.error === 'network' || event.error === 'not-allowed') {
          try { recognition.abort(); } catch {}
          startMediaRecorderSession();
          return;
        } else if (event.error !== 'no-speech') {
          setRecognitionError(`Voice notice: ${event.error}. You can record or click a prompt below.`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        if (!isRecordingMedia) {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Failed to start speech recognition, attempting MediaRecorder:', err);
      startMediaRecorderSession();
    }
  };

  const stopVoiceSession = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    if (isRecordingMedia) {
      stopMediaRecorderSession();
    }
    setIsListening(false);
  };

  const toggleVoiceSession = () => {
    if (isListening || isRecordingMedia) {
      stopVoiceSession();
    } else {
      startVoiceSession();
    }
  };

  // 3. Fallback Client Script Synthesizer (Instant Offline Guarantee)
  const synthesizeClientFallbackScript = (text, lang) => {
    const lower = text.toLowerCase();
    let bizTitle = "💼 Business Inquiries & Sales";
    let cleanedGoal = `Call new client enquiries, explain product/service details, qualify budget, and schedule next step.`;
    let stages = [];

    if (lower.includes('ప్లాట్') || lower.includes('విల్లా') || lower.includes('రియల్ ఎస్టేట్') || lower.includes('plot') || lower.includes('villa') || lower.includes('real estate') || lower.includes('land')) {
      bizTitle = "🏡 Real Estate & Plots";
      cleanedGoal = `Call property enquiries, explain venture amenities, qualify budget and book a site visit.`;
      stages = [
        {
          step: 1,
          title: "1. Greet & Reference Property Enquiry",
          subtitle: "Warm Introduction & context",
          dialogue: {
            te: 'నమస్కారం అండి! మీరు మా వెంచర్‌లో ఓపెన్ ప్లాట్లు/విల్లాల గురించి వివరాలు అడిగారు కదా, ఆ సమాచారం తెలియజేయడానికి కాల్ చేస్తున్నానండి.',
            en: 'Hello! Calling regarding the property and villa details you enquired about in our gated venture.'
          }
        },
        {
          step: 2,
          title: "2. Qualify Layout & Budget",
          subtitle: "Discover specific needs & budget",
          dialogue: {
            te: 'మీరు ఏ సైజు ప్లాట్ లేదా 2/3 BHK విల్లా కోసం చూస్తున్నారు అండి? మరియు మీ బడ్జెట్ ఎంతవరకు అనుకుంటున్నారు?',
            en: 'May I know what plot size or BHK configuration you are looking for, and your preferred budget range?'
          }
        },
        {
          step: 3,
          title: "3. Highlight Venture Amenities & Clear Title",
          subtitle: "Highlight top offerings & advantages",
          dialogue: {
            te: 'మా ప్రాజెక్ట్ 100% క్లియర్ టైటిల్, RERA/DTCP అప్రూవల్ మరియు ప్రీమియం క్లబ్‌హౌస్ సౌకర్యాలతో వేగంగా అభివృద్ధి చెందుతోంది అండి.',
            en: 'Our venture is 100% RERA & DTCP approved with premium clubhouse amenities and rapid development.'
          }
        },
        {
          step: 4,
          title: "4. Address Bank Loans & Registration",
          subtitle: "Resolve doubts, pricing, or assurances",
          dialogue: {
            te: 'ప్రముఖ జాతీయ బ్యాంకుల నుండి 80% వరకు ఈజీ హోమ్ లోన్ సదుపాయం కూడా అందుబాటులో ఉంది అండి.',
            en: 'Pre-approved bank loans up to 80% are readily available from all leading national banks.'
          }
        },
        {
          step: 5,
          title: "5. Confirm Free Site Visit & WhatsApp Share",
          subtitle: "Schedule visit, slot, or WhatsApp brochure",
          dialogue: {
            te: 'ఈ వారాంతంలో ఉచిత సైట్ విజిట్ కోసం కారు పికప్ ఏర్పాటు చేద్దామా అండి? లొకేషన్ వివరాలు మీ వాట్సాప్‌కి కూడా పంపిస్తున్నాను.',
            en: 'Shall we schedule a complimentary site visit with car pickup this weekend? I am also sending the venture map to your WhatsApp.'
          }
        }
      ];
    } else if (lower.includes('డాక్టర్') || lower.includes('హాస్పిటల్') || lower.includes('క్లినిక్') || lower.includes('doctor') || lower.includes('clinic') || lower.includes('dental')) {
      bizTitle = "🏥 Clinic & Healthcare";
      cleanedGoal = `Call patient inquiries, identify required doctor specialty, and book a consultation slot.`;
      stages = [
        {
          step: 1,
          title: "1. Greet & Reference Health Consultation",
          subtitle: "Warm Introduction & context",
          dialogue: {
            te: 'నమస్కారం అండి! మీరు డాక్టర్ కన్సల్టేషన్ అపాయింట్‌మెంట్ కోసం వివరాలు అడిగారు కదా, ఆ సమాచారం కోసం కాల్ చేస్తున్నానండి.',
            en: 'Hello! Calling regarding the doctor consultation appointment you requested details for.'
          }
        },
        {
          step: 2,
          title: "2. Understand Health Query & Specialty",
          subtitle: "Discover specific needs & symptoms",
          dialogue: {
            te: 'మీరు ఏ సమస్య లేదా చెకప్ కోసం డాక్టర్‌ని సంప్రదించాలనుకుంటున్నారో చెప్పగలరా అండి?',
            en: 'Could you share the symptoms or medical consultation you are looking for?'
          }
        },
        {
          step: 3,
          title: "3. Offer Consultation Time Slots",
          subtitle: "Highlight top offerings & doctor timings",
          dialogue: {
            te: 'రేపు ఉదయం 11:00 AM లేదా సాయంత్రం 5:30 PM స్లాట్ ఖాళీగా ఉంది అండి. మీకు ఏ సమయం అనుకూలంగా ఉంటుంది?',
            en: 'We have consultation slots available tomorrow at 11:00 AM or 5:30 PM. Which timing suits you best?'
          }
        },
        {
          step: 4,
          title: "4. Address Fees & Clinic Location",
          subtitle: "Resolve doubts, pricing, or assurances",
          dialogue: {
            te: 'కన్సల్టేషన్ ఫీజు చాలా అందుబాటులో ఉంది మరియు అవసరమైతే రిపోర్ట్స్ ఆన్‌లైన్‌లో కూడా రివ్యూ చేయవచ్చు అండి.',
            en: 'The consultation fees are transparent, and previous medical reports can also be reviewed.'
          }
        },
        {
          step: 5,
          title: "5. Confirm Token & WhatsApp Directions",
          subtitle: "Schedule visit, slot, or WhatsApp brochure",
          dialogue: {
            te: 'మీ అపాయింట్‌మెంట్ స్లాట్ బుక్ చేశానండి. టోకెన్ నంబర్ మరియు క్లినిక్ లొకేషన్ మీ వాట్సాప్‌కి పంపిస్తున్నాను. ధన్యవాదాలు!',
            en: 'Your consultation is booked! Sending the token number and Google Maps location to your WhatsApp now. Thank you!'
          }
        }
      ];
    } else {
      stages = [
        {
          step: 1,
          title: "1. Greet & Reference Inquiry",
          subtitle: "Warm Introduction & context",
          dialogue: {
            te: 'నమస్కారం అండి! మీరు మా సేవల గురించి వివరాలు అడిగారు కదా, ఆ వివరాలు తెలియజేయడానికి కాల్ చేశానండి. ఒక నిమిషం మాట్లాడవచ్చా?',
            en: 'Hello! Calling regarding the inquiry you submitted for our services. May I take a quick minute to assist you?'
          }
        },
        {
          step: 2,
          title: "2. Understand Customer Requirement",
          subtitle: "Discover specific needs & budget",
          dialogue: {
            te: 'మీకు కావలసిన నిర్దిష్ట అవసరాలు మరియు మీ ప్రాధాన్యత గురించి కాస్త వివరంగా చెప్పగలరా అండి?',
            en: 'Could you tell me a little more about your exact requirement and preferred timeline?'
          }
        },
        {
          step: 3,
          title: "3. Explain Solutions & Exclusive Offers",
          subtitle: "Highlight top offerings & advantages",
          dialogue: {
            te: 'మా వద్ద మీ అవసరానికి సరిపోయే ఉత్తమమైన ప్లాన్స్ మరియు ఈ వారం ప్రత్యేక ఆఫర్లు కూడా అందుబాటులో ఉన్నాయి అండి.',
            en: 'We offer customized packages tailored directly to your requirement with special pricing this week.'
          }
        },
        {
          step: 4,
          title: "4. Answer Questions & Clarify Pricing",
          subtitle: "Resolve doubts, pricing, or assurances",
          dialogue: {
            te: 'ధరలు చాలా పారదర్శకంగా ఉంటాయి మరియు పూర్తి కస్టమర్ సపోర్ట్ ఎల్లప్పుడూ మీకు అందుబాటులో ఉంటుంది అండి.',
            en: 'Our pricing is fully transparent with dedicated end-to-end customer assistance.'
          }
        },
        {
          step: 5,
          title: "5. Confirm Order / Next Action over WhatsApp",
          subtitle: "Schedule visit, slot, or WhatsApp brochure",
          dialogue: {
            te: 'పూర్తి వివరాలు, ప్రైసింగ్ కోట్ మీ వాట్సాప్‌కి ఇప్పుడే పంపిస్తున్నాను అండి. మీరు చూసిన తర్వాత తదుపరి స్టెప్ ప్లాన్ చేద్దాం. థాంక్యూ అండి!',
            en: 'I am sending the complete brochure and pricing proposal to your WhatsApp right away. Looking forward to assisting you. Thank you!'
          }
        }
      ];
    }

    if (onVoiceScriptReady) {
      onVoiceScriptReady({
        transcript: text,
        scriptStages: stages,
        businessTitle: bizTitle,
        cleanedGoal: cleanedGoal,
        openingLine: stages[0].dialogue
      });
    }
  };

  // 4. Central Script Generator: "user aa mic lo china dani bati athani business script antha ready avvali"
  const handleApplyScript = async (textToApply, promptKey = null) => {
    if (!textToApply || !textToApply.trim()) return;
    const cleanText = textToApply.trim();

    setHasCapturedSpeech(true);
    setTranscriptInterim('');
    if (promptKey) setSelectedPromptKey(promptKey);

    // 1. Immediately update description box
    if (onTranscriptionUpdate) {
      onTranscriptionUpdate(cleanText);
    }

    // 2. Synthesize complete 5-stage business calling script
    setIsSynthesizingScript(true);
    setSynthesisNotice(`🎙️ Synthesizing complete 5-stage call script in Telugu from your voice...`);

    try {
      const res = await fetch('/api/v1/voice/generate-script-from-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: cleanText,
          language: selectedLanguage,
          calling_mode: 'instant'
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.script_stages && data.script_stages.length > 0) {
          if (onVoiceScriptReady) {
            onVoiceScriptReady({
              transcript: cleanText,
              scriptStages: data.script_stages,
              businessTitle: data.business_type || 'Custom Business Voice Script',
              cleanedGoal: data.cleaned_description || cleanText,
              openingLine: data.opening_line
            });
          }
          if (onTranscriptionUpdate && data.cleaned_description) {
            onTranscriptionUpdate(data.cleaned_description);
          }
          setSynthesisNotice(`✨ Script ready for ${data.business_type || 'your business'}! 5 stages prepared.`);
          return;
        }
      }
    } catch (err) {
      console.warn('Voice script generation API call error, using client domain generator:', err);
    } finally {
      setIsSynthesizingScript(false);
    }

    // Fallback if network was slow
    synthesizeClientFallbackScript(cleanText, selectedLanguage);
    setSynthesisNotice(`✨ Script ready for your business! 5 stages prepared.`);
  };

  return (
    <div
      className="sara-voice-assistant-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '22px 18px',
        position: 'relative',
        height: '100%',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        overflow: 'hidden',
        background: 'linear-gradient(180deg, #faf5ff 0%, #fdf4ff 100%)',
        borderRadius: 16
      }}
    >
      {/* Top Speak Directly Badge */}
      <div style={{ marginBottom: 12 }}>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 800,
            color: '#7c3aed',
            background: '#ede9fe',
            border: '1px solid #ddd6fe',
            padding: '4px 10px',
            borderRadius: 20,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            boxShadow: '0 2px 6px rgba(124, 58, 237, 0.08)'
          }}
        >
          <Sparkles size={12} color="#7c3aed" /> SPEAK OR CLICK TO PREPARE SCRIPT
        </span>
      </div>

      {/* Prominent Circular Microphone Interaction Button */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        {(isListening || isRecordingMedia) && (
          <>
            <div
              className="mic-pulse-wave"
              style={{
                position: 'absolute',
                inset: -12,
                borderRadius: '50%',
                border: '2px solid rgba(16, 185, 129, 0.5)',
                animation: 'pulseRing 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite'
              }}
            />
            <div
              className="mic-pulse-wave-2"
              style={{
                position: 'absolute',
                inset: -24,
                borderRadius: '50%',
                border: '1.5px solid rgba(16, 185, 129, 0.3)',
                animation: 'pulseRing 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite 0.4s'
              }}
            />
          </>
        )}

        <button
          type="button"
          onClick={toggleVoiceSession}
          disabled={isTranscribing || isSynthesizingScript}
          className={`mic-hero-button ${isListening || isRecordingMedia ? 'listening' : ''}`}
          style={{
            width: 78,
            height: 78,
            borderRadius: '50%',
            background: (isListening || isRecordingMedia)
              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
              : 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
            border: (isListening || isRecordingMedia)
              ? '3px solid #6ee7b7'
              : '3px solid #ffffff',
            boxShadow: (isListening || isRecordingMedia)
              ? '0 0 32px rgba(16, 185, 129, 0.45)'
              : '0 10px 26px rgba(124, 58, 237, 0.35), 0 2px 6px rgba(0, 0, 0, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            cursor: (isTranscribing || isSynthesizingScript) ? 'wait' : 'pointer',
            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            transform: (isListening || isRecordingMedia) ? 'scale(1.05)' : 'none',
            position: 'relative',
            zIndex: 2
          }}
          title={isListening || isRecordingMedia ? 'Click to stop and prepare script' : 'Click to speak to Sara in Telugu'}
          aria-label={isListening || isRecordingMedia ? 'Stop voice recording' : 'Start speaking to Sara'}
        >
          {(isTranscribing || isSynthesizingScript) ? (
            <RefreshCw size={26} className="animate-spin" />
          ) : (isListening || isRecordingMedia) ? (
            <Square size={24} fill="#ffffff" />
          ) : (
            <Mic size={30} />
          )}
        </button>
      </div>

      {/* Headings & Live Status */}
      <div style={{ width: '100%', maxWidth: 290, minWidth: 0, boxSizing: 'border-box' }}>
        <h3
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: '#1e1b4b',
            margin: '0 0 3px',
            letterSpacing: '-0.02em',
            lineHeight: 1.2
          }}
        >
          {isSynthesizingScript
            ? 'Preparing your 5-stage script...'
            : isTranscribing
            ? 'Transcribing audio with Sara AI...'
            : isRecordingMedia
            ? `Recording Voice (${recordingSeconds}s)...`
            : isListening
            ? 'Listening to your business idea...'
            : 'Talk to Sara in Telugu'}
        </h3>
        <p
          style={{
            fontSize: 11.5,
            color: (isListening || isRecordingMedia) ? '#059669' : '#64748b',
            margin: 0,
            lineHeight: 1.35,
            fontWeight: (isListening || isRecordingMedia) ? 600 : 400
          }}
        >
          {isSynthesizingScript
            ? 'Sara is tailoring your script stages for customer calling.'
            : isRecordingMedia
            ? 'Click the square button when done to prepare your script.'
            : isListening
            ? `Speaking in ${selectedLanguage.toUpperCase()} — speak naturally about your business.`
            : 'Say your business in Telugu, and your complete call script will be prepared!'}
        </p>
      </div>

      {/* Live Interim Transcript Feedback */}
      {transcriptInterim && (
        <div
          style={{
            marginTop: 8,
            padding: '5px 10px',
            borderRadius: 8,
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            fontSize: 11,
            color: '#065f46',
            width: '100%',
            maxWidth: 270,
            boxSizing: 'border-box',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          🎙️ “{transcriptInterim}”
        </div>
      )}

      {/* Synthesis Notice Badge */}
      {synthesisNotice && (
        <div
          style={{
            marginTop: 8,
            padding: '5px 10px',
            borderRadius: 8,
            background: 'rgba(124, 58, 237, 0.08)',
            border: '1px solid rgba(124, 58, 237, 0.25)',
            fontSize: 11,
            color: '#6d28d9',
            fontWeight: 600,
            width: '100%',
            maxWidth: 270,
            boxSizing: 'border-box'
          }}
        >
          {synthesisNotice}
        </div>
      )}

      {/* Error notice */}
      {recognitionError && (
        <div
          style={{
            marginTop: 8,
            padding: '6px 10px',
            borderRadius: 8,
            background: '#fffbeb',
            border: '1px solid #fde68a',
            fontSize: 11,
            color: '#b45309',
            width: '100%',
            maxWidth: 270,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            textAlign: 'left'
          }}
        >
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{recognitionError}</span>
        </div>
      )}

      {/* ── INTERACTIVE QUICK SCRIPT PICKS: "CLICK THAT THEN ALSO TAKE FROM THAT" ── */}
      <div
        style={{
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          marginTop: 14,
          paddingTop: 10,
          borderTop: '1px dashed #e9d5ff',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          textAlign: 'left',
          boxSizing: 'border-box'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#6b21a8', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            ⚡ Instant Prompts (Click to Take)
          </span>
          <span style={{ fontSize: 10, color: '#9333ea', fontWeight: 600 }}>1-Click Prepare</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
          {QUICK_PROMPTS.map((item) => {
            const isSelected = selectedPromptKey === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleApplyScript(item.text, item.key)}
                style={{
                  width: '100%',
                  maxWidth: '100%',
                  minWidth: 0,
                  boxSizing: 'border-box',
                  background: isSelected ? '#ede9fe' : '#ffffff',
                  border: isSelected ? '1.5px solid #7c3aed' : '1px solid #e2e8f0',
                  borderRadius: 10,
                  padding: '7px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                  boxShadow: isSelected ? '0 2px 8px rgba(124, 58, 237, 0.18)' : '0 1px 3px rgba(0, 0, 0, 0.03)'
                }}
                onMouseEnter={e => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = '#c084fc';
                    e.currentTarget.style.background = '#faf5ff';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={e => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.background = '#ffffff';
                    e.currentTarget.style.transform = 'none';
                  }
                }}
              >
                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 9.5, fontWeight: 800, color: '#7c3aed', background: '#f5f3ff', padding: '1px 5px', borderRadius: 4, flexShrink: 0 }}>
                      {item.badge}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.text}
                  </div>
                </div>

                <div style={{ flexShrink: 0 }}>
                  {isSelected ? (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', background: '#7c3aed', color: '#fff' }}>
                      <Check size={12} />
                    </span>
                  ) : (
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', display: 'flex', alignItems: 'center', gap: 2 }}>
                      Take <ArrowRight size={10} />
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
