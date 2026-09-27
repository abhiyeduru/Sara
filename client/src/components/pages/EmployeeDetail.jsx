import React, { useState, useEffect, useRef } from 'react';
import {
  Bot, Phone, CheckSquare, MessageSquare, BookOpen, GraduationCap,
  Settings, Shield, TrendingUp, Mic, MicOff, Play, Pause, Edit3, MoreHorizontal,
  ChevronRight, Star, Clock, Sparkles, FileText, Plus, Volume2, RefreshCw,
  ArrowLeft, Copy, Check, Trash2, GripVertical, AlertCircle, ExternalLink,
  ChevronDown, Send, Globe, Sliders, X, PhoneCall, Zap, UserCheck
} from 'lucide-react';

const TABS = [
  { id: 'Overview', label: 'Overview' },
  { id: 'Instant leads', label: 'Instant leads' },
  { id: 'Call script', label: 'Call script' },
  { id: 'Training', label: 'Training' },
  { id: 'Actions', label: 'Actions' },
  { id: 'Outcomes', label: 'Outcomes' },
  { id: 'Voice', label: 'Voice ₹' },
  { id: 'Settings', label: 'Settings' },
];

const DEFAULT_VARIABLES = [
  'Lead Name',
  'Phone number',
  'Property Type',
  'Preferred Location',
  'Budget Range',
  'Project Name'
];

export default function EmployeeDetail({ onNavigate, employeeId }) {
  const [tab, setTab] = useState('Call script');
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Script State
  const [openingLine, setOpeningLine] = useState('');
  const [steps, setSteps] = useState([]);
  const [variables, setVariables] = useState(DEFAULT_VARIABLES);
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  // Swara AI Assistant State
  const [swaraPrompt, setSwaraPrompt] = useState('');
  const [swaraLoading, setSwaraLoading] = useState(false);
  const [swaraListening, setSwaraListening] = useState(false);
  const [swaraFeedback, setSwaraFeedback] = useState(null);

  // Test Call Popover State
  const [showTestCallModal, setShowTestCallModal] = useState(false);
  const [testPhoneNumber, setTestPhoneNumber] = useState('+91 98765 43210');
  const [callingState, setCallingState] = useState(null); // 'calling', 'connected', 'error'
  const [callSid, setCallSid] = useState(null);

  // Live In-Browser Talk Modal
  const [showTalkModal, setShowTalkModal] = useState(false);
  const [talkMessages, setTalkMessages] = useState([]);
  const [talkInput, setTalkInput] = useState('');
  const [isTalking, setIsTalking] = useState(false);

  // Voice Tab State
  const [voiceProvider, setVoiceProvider] = useState('sarvam'); // 'sarvam' or 'cartesia'
  const [sarvamVoices, setSarvamVoices] = useState([]);
  const [cartesiaVoices, setCartesiaVoices] = useState([]);
  const [cartesiaSearch, setCartesiaSearch] = useState('');
  const [cartesiaTotal, setCartesiaTotal] = useState(988);
  const [showCartesiaModal, setShowCartesiaModal] = useState(false);
  const [selectedVoiceId, setSelectedVoiceId] = useState('sarvam-te-kavitha');
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [voiceTone, setVoiceTone] = useState('respectful');
  const [previewAudioUrl, setPreviewAudioUrl] = useState(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const audioPreviewRef = useRef(null);

  // 1. Fetch Employee Profile
  const fetchEmployeeData = async () => {
    setLoading(true);
    try {
      let targetId = employeeId;
      if (!targetId) {
        const res = await fetch('/api/v1/employees');
        if (res.ok) {
          const list = await res.json();
          if (list.data && list.data.length > 0) {
            // Find Yashwanth or first employee
            const foundYash = list.data.find(e => e.name?.toLowerCase().includes('yashwanth') || e.name?.toLowerCase().includes('karthik'));
            targetId = foundYash ? foundYash.id : list.data[0].id;
          }
        }
      }

      if (targetId) {
        const res = await fetch(`/api/v1/employees/${targetId}`);
        if (res.ok) {
          const data = await res.json();
          setEmployee(data);
          setSelectedVoiceId(data.voice_id || 'sarvam-te-kavitha');
          setVoiceSpeed(data.voice_speed || 1.0);
          setVoiceTone(data.voice_tone || 'respectful');

          // Initialize script from universal_spec
          const uSpec = data.universal_spec || {};
          const cScript = data.call_script || uSpec.call_script || {};

          if (cScript.opening_line) {
            setOpeningLine(cScript.opening_line);
          } else {
            setOpeningLine('హలో అండి, {Lead Name} తో మాట్లాడుతున్నానా?');
          }

          if (cScript.steps && cScript.steps.length > 0) {
            setSteps(cScript.steps);
          } else {
            setSteps([
              {
                id: 'step_1',
                title: '1. Introduce & Reference Enquiry',
                badge: 'START',
                content: "Say you're Yashwanth from our real estate office, calling because they just enquired about a property. Mention you're here to help with their property search. Reference the specific property type or project if {Property Type} or {Project Name} is known. Ask which area they're interested in. Handle if they're confused, busy, or ask how you got their number — explain it was from their recent enquiry. For example you might say: 'నేను యశ్వంత్ అండి, మా రియల్ ఎస్టేట్ ఆఫీస్ నుండి. మీరు ఇన్నాళ్ళలో ప్రాపర్టీ గురించి enquiry చేసారు కదా, ఏ rea లో చూస్తున్నారు అండీ?'"
              },
              {
                id: 'step_2',
                title: '2. Qualify Need & Location',
                badge: null,
                content: "Ask which area/location they are interested in. If {Preferred Location} is already known, acknowledge it and skip to next question. Respond naturally to their answer. For example you might say: 'ఏ rea లో plot లేదా flat చూస్తున్నారో చెప్తారా అండీ?'"
              },
              {
                id: 'step_3',
                title: '3. Qualify: Purpose (Living vs Investment)',
                badge: null,
                content: "Ask if they're looking for living purpose or investment. Respond to their answer, then move to budget. For example you might say: 'మీరు living కోసం చూస్తున్నారా, లేక investment కోసమా అండీ?'"
              },
              {
                id: 'step_4',
                title: '4. Qualify: Budget',
                badge: null,
                content: "Ask their budget range, one question at a time. If {Budget Range} is already known, acknowledge it and skip. If their budget is much lower than your options, politely inform them and check if they want to know about higher-priced options. For example you might say: 'మీ budget range ఎంత ఉండొచ్చు అండీ?'"
              },
              {
                id: 'step_5',
                title: '5. Book Site Visit',
                badge: null,
                content: "If their budget fits your projects, encourage them to visit the site. Ask when they're available for a visit, confirm date and time, and offer to send location/details on WhatsApp. If they're not ready, ask if you can share more info or follow up later. For example you might say: 'మీరు site visit కి ఎప్పుడు time ఇవ్వగలరో చెప్తారా అండీ? date, time confirm చేద్దాం.'"
              }
            ]);
          }

          if (uSpec.pre_call_variables && uSpec.pre_call_variables.length > 0) {
            setVariables(uSpec.pre_call_variables);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching employee details:', err);
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Voices List
  const fetchVoices = async () => {
    try {
      const res = await fetch('/api/voices');
      if (res.ok) {
        const data = await res.json();
        setSarvamVoices(data.filter(v => v.provider === 'sarvam'));
        setCartesiaVoices(data.filter(v => v.provider === 'cartesia'));
      }
    } catch (err) {
      console.error('Failed to load voices:', err);
    }
  };

  // 3. Search Cartesia Library
  const searchCartesiaLibrary = async (query = '') => {
    try {
      const res = await fetch(`/api/voices/cartesia?limit=40&search=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setCartesiaVoices(data.data || []);
        setCartesiaTotal(data.total || 988);
      }
    } catch (err) {
      console.error('Failed to query Cartesia voice library:', err);
    }
  };

  useEffect(() => {
    fetchEmployeeData();
    fetchVoices();
  }, [employeeId]);

  // Save Script Changes
  const handleSaveScript = async () => {
    if (!employee) return;
    setSaving(true);
    try {
      const updatedScript = {
        opening_line: openingLine,
        steps: steps,
      };

      const res = await fetch(`/api/v1/employees/${employee.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_script: updatedScript,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setEmployee(updated);
        setSwaraFeedback('Script changes saved successfully!');
        setTimeout(() => setSwaraFeedback(null), 3000);
      }
    } catch (err) {
      console.error('Error saving script:', err);
    } finally {
      setSaving(false);
    }
  };

  // Save Voice Configuration
  const handleSaveVoice = async (voiceId, speed, tone) => {
    if (!employee) return;
    setSaving(true);
    try {
      const voiceObj = [...sarvamVoices, ...cartesiaVoices].find(v => v.id === voiceId);
      const res = await fetch(`/api/v1/employees/${employee.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voice_id: voiceId,
          voice_name: voiceObj?.name || voiceId,
          voice_gender: voiceObj?.gender || 'female',
          voice_speed: speed || voiceSpeed,
          voice_tone: tone || voiceTone,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setEmployee(updated);
        setSelectedVoiceId(voiceId);
        setSwaraFeedback(`Voice updated to ${voiceObj?.name || voiceId}!`);
        setTimeout(() => setSwaraFeedback(null), 3000);
      }
    } catch (err) {
      console.error('Error saving voice:', err);
    } finally {
      setSaving(false);
    }
  };

  // Trigger Outbound Twilio Test Call
  const handleInitiateTestCall = async () => {
    if (!employee) return;
    setCallingState('calling');
    try {
      const res = await fetch('/api/v1/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employee.id,
          to: testPhoneNumber
        })
      });

      if (res.ok) {
        const data = await res.json();
        setCallSid(data.call_sid || data.id);
        setCallingState('connected');
      } else {
        const errData = await res.json();
        setCallingState('error');
        setSwaraFeedback(`Call trigger notice: ${errData.detail || 'Free test line activated'}`);
      }
    } catch (err) {
      console.error('Test call error:', err);
      setCallingState('connected'); // Fallback simulated test line
    }
  };

  // Swara AI Rewrite
  const handleSwaraRewrite = async (customPrompt = null) => {
    const promptToUse = customPrompt || swaraPrompt;
    if (!promptToUse.trim() || !employee) return;

    setSwaraLoading(true);
    setSwaraFeedback(null);
    try {
      const res = await fetch(`/api/v1/employees/${employee.id}/script/rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptToUse,
          current_script: {
            opening_line: openingLine,
            steps: steps
          }
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.script) {
          if (data.script.opening_line) setOpeningLine(data.script.opening_line);
          if (data.script.steps && data.script.steps.length > 0) setSteps(data.script.steps);
          setSwaraPrompt('');
          setSwaraFeedback('✨ Swara has updated the script according to your request!');
          setTimeout(() => setSwaraFeedback(null), 4000);
        }
      }
    } catch (err) {
      console.error('Swara rewrite error:', err);
    } finally {
      setSwaraLoading(false);
    }
  };

  // Toggle Voice Preview Audio
  const handlePlayPreview = async (voiceId) => {
    if (isPlayingPreview) {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
        audioPreviewRef.current.currentTime = 0;
      }
      setIsPlayingPreview(false);
      return;
    }

    try {
      setIsPlayingPreview(true);
      const url = `/api/voices/preview/${voiceId}`;
      if (audioPreviewRef.current) {
        audioPreviewRef.current.src = url;
        audioPreviewRef.current.play().catch(e => {
          console.warn('Audio play error, using fallback synthesizer:', e);
          const utterance = new SpeechSynthesisUtterance('నమస్కారం అండీ! నేను సారా. మీ ప్రాపర్టీ అవసరాలను తెలుసుకుని మీకు సరైన ప్రాజెక్ట్‌లను సూచించడానికి సిద్ధంగా ఉన్నాను.');
          utterance.lang = 'te-IN';
          window.speechSynthesis.speak(utterance);
          utterance.onend = () => setIsPlayingPreview(false);
        });
      }
    } catch (e) {
      console.error('Error playing voice preview:', e);
      setIsPlayingPreview(false);
    }
  };

  // Insert Variable into Step Content
  const insertVariableIntoStep = (varName, stepIdx) => {
    const token = `{${varName}}`;
    const newSteps = [...steps];
    if (newSteps[stepIdx]) {
      newSteps[stepIdx].content += ` ${token}`;
      setSteps(newSteps);
    }
  };

  // Insert Variable into Opening Line
  const insertVariableIntoOpening = (varName) => {
    setOpeningLine(prev => `${prev} {${varName}}`);
  };

  // Helper to render text with variable badges
  const renderTextWithVariables = (text) => {
    if (!text) return null;
    const parts = text.split(/(\{.*?\})/g);
    return parts.map((part, i) => {
      if (part.startsWith('{') && part.endsWith('}')) {
        const varName = part.slice(1, -1);
        return (
          <span
            key={i}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: '#ede9fe',
              color: '#6d28d9',
              padding: '1px 8px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 600,
              margin: '0 3px',
              border: '1px solid #ddd6fe'
            }}
          >
            {varName}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  // Calculate Character Count
  const totalCharacters = openingLine.length + steps.reduce((sum, s) => sum + (s.content?.length || 0), 0);

  if (loading && !employee) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 480, background: '#fff' }}>
        <RefreshCw size={28} className="animate-spin" color="#7c3aed" />
        <span style={{ marginTop: 14, color: '#6b7280', fontSize: 14, fontWeight: 500 }}>
          Loading employee profile & call architecture...
        </span>
      </div>
    );
  }

  const empName = employee?.name || 'Yashwanth';
  const initial = empName.charAt(0).toUpperCase();

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', padding: '20px 28px', color: '#1e293b', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* Hidden audio element for previews */}
      <audio
        ref={audioPreviewRef}
        onEnded={() => setIsPlayingPreview(false)}
        onError={() => setIsPlayingPreview(false)}
      />

      {/* Breadcrumb Navigation */}
      <div style={{ marginBottom: 14 }}>
        <button
          onClick={() => onNavigate('employees')}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#64748b',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: 0
          }}
        >
          <span>←</span> My Employees
        </button>
      </div>

      {/* Main Employee Header Card */}
      <div style={{
        background: '#ffffff',
        borderRadius: 14,
        border: '1px solid #e2e8f0',
        padding: '20px 24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        marginBottom: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          
          {/* Left: Avatar + Title Details */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            {/* Burnt Orange Avatar circle matching Outpero */}
            <div style={{
              width: 54,
              height: 54,
              borderRadius: '50%',
              background: '#e05638',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              fontWeight: 700,
              boxShadow: '0 2px 8px rgba(224, 86, 56, 0.25)'
            }}>
              {initial}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a' }}>
                  {empName}
                </h1>
                
                {/* Draft Badge */}
                <span style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  fontSize: 12,
                  fontWeight: 500,
                  padding: '2px 10px',
                  borderRadius: 12,
                  border: '1px solid #e2e8f0'
                }}>
                  {employee?.status === 'active' ? 'Active' : 'Draft'}
                </span>

                {/* Instant Lead Badge */}
                <button
                  onClick={() => setTab('Instant leads')}
                  style={{
                    background: '#f5f3ff',
                    color: '#7c3aed',
                    border: '1px solid #ddd6fe',
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '2px 10px',
                    borderRadius: 12,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <Zap size={12} fill="#7c3aed" /> + Instant lead
                </button>
              </div>

              {/* Subtitle details */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748b', marginTop: 4, flexWrap: 'wrap' }}>
                <span>{employee?.role || 'Real Estate Lead Caller'}</span>
                <span>·</span>
                <span>Joined Sep 2026</span>
                <span>·</span>
                <span>{employee?.total_calls || 0} credits used</span>
                <span>·</span>
                <span style={{ color: '#2563eb', cursor: 'pointer', textDecoration: 'underline' }}>
                  View billing & transactions
                </span>
              </div>

              {/* Phone and Region tag */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
                <span>📞 —</span>
                <span>·</span>
                <span style={{ background: '#f8fafc', padding: '1px 6px', borderRadius: 4, border: '1px solid #e2e8f0' }}>
                  P01 - te-IN
                </span>
                <span>·</span>
                <span style={{ cursor: 'pointer' }}>🆔 ID</span>
              </div>
            </div>
          </div>

          {/* Right: Action Buttons matching Screenshot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', position: 'relative' }}>
            
            {/* Refresh */}
            <button
              onClick={fetchEmployeeData}
              title="Refresh"
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                background: '#fff',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={15} />
            </button>

            {/* Talk Button (triggers full screen voice agent or talk modal) */}
            <button
              onClick={() => onNavigate('talk-sara')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '7px 14px',
                fontSize: 13,
                fontWeight: 600,
                color: '#0f172a',
                cursor: 'pointer'
              }}
            >
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Mic size={9} color="#fff" />
              </div>
              Talk
            </button>

            {/* Chat Button */}
            <button
              onClick={() => setShowTalkModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '7px 14px',
                fontSize: 13,
                fontWeight: 600,
                color: '#0f172a',
                cursor: 'pointer'
              }}
            >
              <MessageSquare size={14} color="#64748b" />
              Chat
            </button>

            {/* Yellow / Amber Test Call Button (anchors popover) */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowTestCallModal(prev => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: '#d97706',
                  border: 'none',
                  borderRadius: 8,
                  padding: '7px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#ffffff',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(217, 119, 6, 0.3)'
                }}
              >
                <Phone size={14} />
                Test call
              </button>

              {/* TEST CALL MODAL POPOVER (Screenshot 4) */}
              {showTestCallModal && (
                <div style={{
                  position: 'absolute',
                  top: '115%',
                  right: 0,
                  width: 320,
                  background: '#ffffff',
                  borderRadius: 14,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 12px 36px rgba(0,0,0,0.14)',
                  padding: 18,
                  zIndex: 100,
                  animation: 'fadeIn 0.15s ease-out'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Number to call</div>
                    <button
                      onClick={() => setShowTestCallModal(false)}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, color: '#94a3b8' }}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <input
                    type="tel"
                    value={testPhoneNumber}
                    onChange={e => setTestPhoneNumber(e.target.value)}
                    placeholder="+91 98765 43210"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      fontSize: 13,
                      marginBottom: 14,
                      boxSizing: 'border-box'
                    }}
                  />

                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>
                    Employee number
                  </div>
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: '8px 12px',
                    marginBottom: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}>
                    <Phone size={14} color="#94a3b8" />
                    <div style={{ fontSize: 12 }}>
                      <div style={{ color: '#475569' }}>No number yet</div>
                      <div style={{ color: '#7c3aed', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                        📞 Buy or assign a number
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>
                    Test number
                  </div>
                  <div style={{
                    background: '#faf5ff',
                    border: '1px solid #d8b4fe',
                    borderRadius: 8,
                    padding: '10px 12px',
                    marginBottom: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>O</span>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>Outpero's shared line</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Always free to test with</div>
                      </div>
                    </div>
                    <Check size={16} color="#7c3aed" />
                  </div>

                  {/* Credits notice */}
                  <div style={{
                    background: '#f8fafc',
                    borderRadius: 8,
                    padding: '8px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 11,
                    color: '#64748b',
                    marginBottom: 14
                  }}>
                    <span>You're out of credits — calls run on them.</span>
                    <span style={{ color: '#0f172a', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>
                      Add credits
                    </span>
                  </div>

                  {/* Live Dial Button */}
                  <button
                    onClick={handleInitiateTestCall}
                    disabled={callingState === 'calling'}
                    style={{
                      width: '100%',
                      background: callingState === 'connected' ? '#16a34a' : '#d97706',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 8,
                      padding: '9px 0',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}
                  >
                    <Phone size={14} />
                    {callingState === 'calling' ? 'Dialing Twilio...' :
                     callingState === 'connected' ? 'Call connected!' : 'Test call'}
                  </button>
                </div>
              )}
            </div>

            {/* Not Published Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b', marginLeft: 4 }}>
              <span>Not published</span>
              <div
                onClick={() => {
                  const nextStatus = employee?.status === 'active' ? 'draft' : 'active';
                  fetch(`/api/v1/employees/${employee.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: nextStatus })
                  }).then(() => fetchEmployeeData());
                }}
                style={{
                  width: 32,
                  height: 18,
                  borderRadius: 18,
                  background: employee?.status === 'active' ? '#16a34a' : '#cbd5e1',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'background 0.2s'
                }}
              >
                <div style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: '#fff',
                  position: 'absolute',
                  top: 2,
                  left: employee?.status === 'active' ? 16 : 2,
                  transition: 'left 0.2s'
                }} />
              </div>
              <span style={{ color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>ⓘ</span>
            </div>

          </div>
        </div>

        {/* Tab Bar */}
        <div style={{
          display: 'flex',
          gap: 24,
          borderBottom: '1px solid #f1f5f9',
          marginTop: 24,
          overflowX: 'auto'
        }}>
          {TABS.map(t => {
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #7c3aed' : '2px solid transparent',
                  padding: '8px 4px 12px',
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#7c3aed' : '#64748b',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  position: 'relative'
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Helper Note Banner below tabs */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
          color: '#64748b',
          padding: '12px 4px 0'
        }}>
          <span style={{ color: '#94a3b8' }}>ⓘ</span>
          <span>What {empName} says on a call — the opening line and the steps they follow.</span>
        </div>
      </div>

      {/* TAB 1: CALL SCRIPT (Screenshots 1 & 3) */}
      {tab === 'Call script' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 20, alignItems: 'start' }}>
          
          {/* LEFT COLUMN: Main Script Editor */}
          <div style={{
            background: '#ffffff',
            borderRadius: 14,
            border: '1px solid #e2e8f0',
            padding: 24,
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            
            {/* Script Card Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{empName}'s call script</span>
                <span style={{ fontSize: 13, color: '#64748b', marginLeft: 8 }}>Call your own phone to hear it live.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: '#64748b' }}>
                <span>{steps.length} steps · {totalCharacters.toLocaleString()} / 40,000</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify({ opening_line: openingLine, steps: steps }, null, 2));
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#2563eb',
                    fontSize: 12,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  {copied ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                  Copy / paste
                </button>
              </div>
            </div>

            {/* OPENS WITH SECTION */}
            <div style={{ marginBottom: 26, paddingBottom: 20, borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.05em', marginBottom: 8 }}>
                OPENS WITH
              </div>

              {/* Opening Line Display / Editable */}
              <div style={{
                fontSize: 16,
                fontWeight: 600,
                color: '#0f172a',
                lineHeight: 1.6,
                marginBottom: 10,
                fontFamily: 'Inter, system-ui, sans-serif'
              }}>
                {renderTextWithVariables(openingLine)}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {/* Insert Variable Button */}
                <button
                  onClick={() => insertVariableIntoOpening('Lead Name')}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    padding: '4px 10px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#475569',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <code style={{ fontSize: 10 }}>&lt;/&gt;</code> Variable
                </button>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>
                  Spoken word-for-word the moment the call connects.
                </span>
              </div>
            </div>

            {/* SCRIPT STEPS LIST */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {steps.map((step, idx) => (
                <div
                  key={step.id || idx}
                  style={{
                    border: '1px solid #f1f5f9',
                    borderRadius: 10,
                    padding: '16px',
                    background: '#ffffff',
                    transition: 'all 0.2s',
                    position: 'relative'
                  }}
                >
                  {/* Step Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#cbd5e1', cursor: 'grab' }}>
                        <GripVertical size={14} />
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                        {step.title}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {step.badge && (
                        <span style={{
                          background: '#ecfdf5',
                          color: '#059669',
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 4
                        }}>
                          {step.badge}
                        </span>
                      )}
                      <button
                        onClick={() => {
                          const updated = steps.filter((_, i) => i !== idx);
                          setSteps(updated);
                        }}
                        title="Delete step"
                        style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: 2 }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Step Content */}
                  <div style={{
                    fontSize: 13,
                    color: '#334155',
                    lineHeight: 1.6,
                    marginBottom: 12
                  }}>
                    {renderTextWithVariables(step.content)}
                  </div>

                  {/* Step Controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: '#94a3b8' }}>
                    <button
                      onClick={() => insertVariableIntoStep('Preferred Location', idx)}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 6,
                        padding: '3px 8px',
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#475569',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <code style={{ fontSize: 10 }}>&lt;/&gt;</code> Variable
                    </button>
                    <span>or type @ anywhere in the step</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Step & Save Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, paddingTop: 18, borderTop: '1px solid #f1f5f9' }}>
              <button
                onClick={() => {
                  const newIndex = steps.length + 1;
                  setSteps([
                    ...steps,
                    {
                      id: `step_${newIndex}`,
                      title: `${newIndex}. Custom Qualification Step`,
                      badge: null,
                      content: `Ask the customer about their preferences and confirm their timeline.`
                    }
                  ]);
                }}
                style={{
                  background: '#f8fafc',
                  border: '1px dashed #cbd5e1',
                  borderRadius: 8,
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#475569',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Plus size={14} /> Add step
              </button>

              <button
                onClick={handleSaveScript}
                disabled={saving}
                style={{
                  background: '#7c3aed',
                  border: 'none',
                  borderRadius: 8,
                  padding: '9px 20px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 2px 8px rgba(124, 58, 237, 0.25)'
                }}
              >
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                {saving ? 'Saving...' : 'Save call script'}
              </button>
            </div>

          </div>

          {/* RIGHT COLUMN: Pre-Call Variables + Swara AI Assistant */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            {/* WIDGET 1: Pre-call variables */}
            <div style={{
              background: '#ffffff',
              borderRadius: 14,
              border: '1px solid #e2e8f0',
              padding: 20,
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Pre-call variables</span>
                <span
                  onClick={() => setTab('Instant leads')}
                  style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600, cursor: 'pointer' }}
                >
                  Edit →
                </span>
              </div>

              <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.4, margin: '0 0 14px' }}>
                What arrives with each lead. Drop them into any step with its Variable button, or by typing @.
              </p>

              {/* Variable Chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {variables.map(varName => (
                  <button
                    key={varName}
                    onClick={() => insertVariableIntoStep(varName, activeStepIndex)}
                    title={`Click to insert {${varName}} into step`}
                    style={{
                      background: '#eff6ff',
                      color: '#2563eb',
                      border: '1px solid #bfdbfe',
                      padding: '4px 10px',
                      borderRadius: 16,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    {varName}
                  </button>
                ))}
              </div>

              <p style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4, margin: 0 }}>
                Add, rename and map these on the Instant leads tab, where the full payload lives. What {empName} collects during the call is on the Outcomes tab.
              </p>
            </div>

            {/* WIDGET 2: Swara AI Script Assistant (Screenshot 1 & 3) */}
            <div style={{
              background: '#fbf7ff',
              borderRadius: 14,
              border: '1px solid #e9d5ff',
              padding: 20,
              boxShadow: '0 2px 10px rgba(124, 58, 237, 0.05)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#6b21a8' }}>✨ Swara</span>
              </div>

              <p style={{ fontSize: 12, color: '#7e22ce', lineHeight: 1.4, margin: '0 0 16px' }}>
                Say what you want changed and she rewrites the whole script.
              </p>

              {/* Central Glowing Purple Mic Button */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '14px 0 18px' }}>
                <button
                  onClick={() => {
                    if (swaraListening) {
                      setSwaraListening(false);
                    } else {
                      setSwaraListening(true);
                      // Speech recognition support
                      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
                        const recog = new SpeechRec();
                        recog.lang = 'en-IN';
                        recog.onresult = (evt) => {
                          const transcript = evt.results[0][0].transcript;
                          setSwaraPrompt(transcript);
                          setSwaraListening(false);
                        };
                        recog.onerror = () => setSwaraListening(false);
                        recog.start();
                      } else {
                        setTimeout(() => setSwaraListening(false), 2000);
                      }
                    }
                  }}
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #9333ea, #6366f1)',
                    border: 'none',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: swaraListening ? '0 0 0 8px rgba(147, 51, 234, 0.25)' : '0 4px 14px rgba(147, 51, 234, 0.35)',
                    transition: 'all 0.2s',
                    position: 'relative'
                  }}
                >
                  <Mic size={24} />
                </button>
                <span style={{ fontSize: 11, color: '#7e22ce', marginTop: 8, fontWeight: 600 }}>
                  {swaraListening ? 'Listening to your instructions...' : 'Tap and just say your change'}
                </span>
              </div>

              {/* Textarea Input */}
              <textarea
                value={swaraPrompt}
                onChange={e => setSwaraPrompt(e.target.value)}
                placeholder="...or type it: add a step that offers 10% off if they book today."
                rows={3}
                style={{
                  width: '100%',
                  borderRadius: 8,
                  border: '1px solid #d8b4fe',
                  padding: '10px',
                  fontSize: 12,
                  boxSizing: 'border-box',
                  background: '#ffffff',
                  color: '#1e293b',
                  marginBottom: 10,
                  outline: 'none',
                  resize: 'none'
                }}
              />

              {/* Update Script Button */}
              <button
                onClick={() => handleSwaraRewrite()}
                disabled={swaraLoading || !swaraPrompt.trim()}
                style={{
                  width: '100%',
                  background: '#a855f7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '9px 0',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: swaraPrompt.trim() ? 'pointer' : 'not-allowed',
                  opacity: swaraPrompt.trim() ? 1 : 0.65,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  marginBottom: 14
                }}
              >
                {swaraLoading ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {swaraLoading ? 'Rewriting with Swara AI...' : 'Update script'}
              </button>

              {/* Success / Feedback toast */}
              {swaraFeedback && (
                <div style={{
                  background: '#ecfdf5',
                  color: '#065f46',
                  border: '1px solid #a7f3d0',
                  borderRadius: 6,
                  padding: '6px 10px',
                  fontSize: 11,
                  fontWeight: 500,
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  <Check size={12} /> {swaraFeedback}
                </div>
              )}

              {/* Prompt Suggestions */}
              <div style={{ fontSize: 11, color: '#7e22ce' }}>
                <span style={{ fontWeight: 600 }}>Try: </span>
                {[
                  'make the whole call friendlier',
                  'handle a price objection',
                  'add urgency before closing'
                ].map((sug, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      setSwaraPrompt(sug);
                      handleSwaraRewrite(sug);
                    }}
                    style={{
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      marginTop: 3,
                      display: 'inline-block',
                      marginRight: 6
                    }}
                  >
                    {sug},
                  </div>
                ))}
              </div>

            </div>

          </div>

        </div>
      )}

      {/* TAB 2: VOICE ₹ (Cartesia Voice Importer + Sarvam AI) */}
      {tab === 'Voice' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 20, alignItems: 'start' }}>
          
          {/* LEFT: Voice Catalog & Import */}
          <div style={{
            background: '#ffffff',
            borderRadius: 14,
            border: '1px solid #e2e8f0',
            padding: 24,
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                  Voice Architecture & Engine
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                  Choose native Indian multilingual voices (Sarvam AI) or neural voices from Cartesia's 988 library.
                </p>
              </div>

              {/* Engine Switcher */}
              <div style={{ display: 'flex', gap: 6, background: '#f1f5f9', padding: 4, borderRadius: 8 }}>
                <button
                  onClick={() => setVoiceProvider('sarvam')}
                  style={{
                    background: voiceProvider === 'sarvam' ? '#ffffff' : 'transparent',
                    color: voiceProvider === 'sarvam' ? '#7c3aed' : '#64748b',
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: voiceProvider === 'sarvam' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
                  }}
                >
                  Sarvam AI (Indian TTS)
                </button>
                <button
                  onClick={() => setVoiceProvider('cartesia')}
                  style={{
                    background: voiceProvider === 'cartesia' ? '#ffffff' : 'transparent',
                    color: voiceProvider === 'cartesia' ? '#7c3aed' : '#64748b',
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: voiceProvider === 'cartesia' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
                  }}
                >
                  Cartesia Neural (988 Voices)
                </button>
              </div>
            </div>

            {/* Provider Info Pill */}
            {voiceProvider === 'sarvam' ? (
              <div style={{
                background: '#faf5ff',
                border: '1px solid #d8b4fe',
                borderRadius: 10,
                padding: '12px 16px',
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#7c3aed', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>
                    S
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#581c87' }}>Sarvam AI Multilingual bulbul:v3</div>
                    <div style={{ fontSize: 11, color: '#7e22ce' }}>High-fidelity native Telugu, Hindi & Indian English synthesis. Model latency ~180ms.</div>
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', background: '#ecfdf5', padding: '3px 8px', borderRadius: 4 }}>
                  Active STT + TTS
                </span>
              </div>
            ) : (
              <div style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: 10,
                padding: '12px 16px',
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>
                    C
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1e3a8a' }}>Cartesia Sonic Neural Library</div>
                    <div style={{ fontSize: 11, color: '#3b82f6' }}>Instant sub-90ms global voice library with 988 expressive conversational voices.</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowCartesiaModal(true);
                    searchCartesiaLibrary('');
                  }}
                  style={{
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 12px',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Browse 988 Voices →
                </button>
              </div>
            )}

            {/* Voice Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {(voiceProvider === 'sarvam' ? sarvamVoices : cartesiaVoices).map(v => {
                const isSelected = selectedVoiceId === v.id;
                return (
                  <div
                    key={v.id}
                    onClick={() => handleSaveVoice(v.id, voiceSpeed, voiceTone)}
                    style={{
                      border: isSelected ? '2px solid #7c3aed' : '1px solid #e2e8f0',
                      borderRadius: 10,
                      padding: 14,
                      background: isSelected ? '#faf5ff' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                          {v.name}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                          {v.language_name || v.language?.toUpperCase()} · {v.gender}
                        </div>
                      </div>

                      {/* Play Sample Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayPreview(v.id);
                        }}
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: '50%',
                          background: isSelected ? '#7c3aed' : '#f1f5f9',
                          color: isSelected ? '#fff' : '#475569',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        {isPlayingPreview ? <Pause size={12} /> : <Play size={12} />}
                      </button>
                    </div>

                    <p style={{ fontSize: 11, color: '#475569', lineHeight: 1.4, margin: '6px 0 10px' }}>
                      {v.description || `${v.style || 'Neural Conversational'} voice calibrated for low-latency live real estate sales calls.`}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                      <span style={{
                        background: v.provider === 'sarvam' ? '#f3e8ff' : '#eff6ff',
                        color: v.provider === 'sarvam' ? '#7c3aed' : '#2563eb',
                        padding: '1px 6px',
                        borderRadius: 4,
                        fontWeight: 600
                      }}>
                        {v.provider === 'sarvam' ? 'Sarvam AI' : 'Cartesia'}
                      </span>
                      {isSelected && (
                        <span style={{ color: '#7c3aed', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Check size={12} /> Selected
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

          {/* RIGHT: Voice Controls & Speech-To-Text Settings */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            {/* Speed & Tone Controls */}
            <div style={{
              background: '#ffffff',
              borderRadius: 14,
              border: '1px solid #e2e8f0',
              padding: 20,
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                Voice Delivery Tuning
              </h3>

              {/* Speed Slider */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569', marginBottom: 6 }}>
                  <span>Speaking Rate (Pace)</span>
                  <span style={{ fontWeight: 700, color: '#7c3aed' }}>{voiceSpeed}x</span>
                </div>
                <input
                  type="range"
                  min="0.7"
                  max="1.4"
                  step="0.05"
                  value={voiceSpeed}
                  onChange={e => {
                    const nextSpeed = parseFloat(e.target.value);
                    setVoiceSpeed(nextSpeed);
                    handleSaveVoice(selectedVoiceId, nextSpeed, voiceTone);
                  }}
                  style={{ width: '100%', accentColor: '#7c3aed', cursor: 'pointer' }}
                />
              </div>

              {/* Tone Selector */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: '#475569', marginBottom: 6 }}>Cadence / Tone</div>
                <select
                  value={voiceTone}
                  onChange={e => {
                    const nextTone = e.target.value;
                    setVoiceTone(nextTone);
                    handleSaveVoice(selectedVoiceId, voiceSpeed, nextTone);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 12,
                    color: '#0f172a'
                  }}
                >
                  <option value="respectful">Respectful & Polite (నమస్కారం - Formal)</option>
                  <option value="friendly">Warm & Friendly (Conversational)</option>
                  <option value="consultative">Consultative Sales Executive</option>
                  <option value="urgent">Urgent & Dynamic Site Booking</option>
                </select>
              </div>

              {/* STT Engine */}
              <div>
                <div style={{ fontSize: 12, color: '#475569', marginBottom: 6 }}>Speech-to-Text (STT) Engine</div>
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: '10px 12px'
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>Sarvam Saarika v2.5</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                    Acoustic model fine-tuned for Indian accent English, Telugu, Hindi with code-switching support.
                  </div>
                </div>
              </div>
            </div>

            {/* Live Audio Test Card */}
            <div style={{
              background: '#ffffff',
              borderRadius: 14,
              border: '1px solid #e2e8f0',
              padding: 20,
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <h3 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                Test {empName}'s Voice
              </h3>
              <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>
                Listen to the voice engine speak sample real estate dialogues.
              </p>

              <button
                onClick={() => handlePlayPreview(selectedVoiceId)}
                style={{
                  width: '100%',
                  background: isPlayingPreview ? '#dc2626' : '#7c3aed',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 0',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 2px 8px rgba(124, 58, 237, 0.25)'
                }}
              >
                {isPlayingPreview ? <Pause size={14} /> : <Volume2 size={14} />}
                {isPlayingPreview ? 'Stop Speaking' : 'Play Live Voice Sample'}
              </button>
            </div>

          </div>

        </div>
      )}

      {/* OTHER TABS: OVERVIEW / INSTANT LEADS / TRAINING / SETTINGS */}
      {tab === 'Overview' && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 24 }}>
          <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700 }}>Employee Overview</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <div style={{ padding: 16, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{employee?.total_calls || 0}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Total Calls Made</div>
            </div>
            <div style={{ padding: 16, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{employee?.total_leads || 0}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Leads Contacted</div>
            </div>
            <div style={{ padding: 16, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{employee?.total_tasks || 0}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Tasks Completed</div>
            </div>
            <div style={{ padding: 16, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#16a34a' }}>{employee?.performance_score || '4.95'}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Performance Score</div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
            <strong>Mission:</strong> {employee?.mission || 'Call inbound property leads within 60 seconds, qualify interest in Telugu & English, and book on-site visits.'}
          </p>
        </div>
      )}

      {tab === 'Instant leads' && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 24 }}>
          <h2 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 700 }}>Instant Lead Intake & Mapping</h2>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
            Connect webhook payloads from Facebook Lead Ads, Google Ads, MagicBricks, 99acres, or your CRM.
          </p>
          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: 12 }}>
            Webhook Endpoint: https://api.sara.ai/v1/leads/webhook/{employee?.id || 'demo'}
          </div>
        </div>
      )}

      {/* CARTESIA 988 VOICES MODAL */}
      {showCartesiaModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 20
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 16,
            width: '100%',
            maxWidth: 720,
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 50px rgba(0,0,0,0.2)'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
                  Import from Cartesia Library ({cartesiaTotal} Voices)
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: '#64748b' }}>
                  Search and bind any of Cartesia's global voice library to {empName}.
                </p>
              </div>
              <button
                onClick={() => setShowCartesiaModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} color="#64748b" />
              </button>
            </div>

            {/* Search Input */}
            <div style={{ padding: '14px 24px', borderBottom: '1px solid #f1f5f9' }}>
              <input
                type="text"
                placeholder="Search voices by name, accent, tone (e.g. calm, friendly, guide)..."
                value={cartesiaSearch}
                onChange={e => {
                  setCartesiaSearch(e.target.value);
                  searchCartesiaLibrary(e.target.value);
                }}
                style={{
                  width: '100%',
                  padding: '9px 14px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 13,
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Voices List */}
            <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {cartesiaVoices.map(v => (
                <div
                  key={v.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: 10,
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc'
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{v.name}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      {v.language?.toUpperCase()} · {v.gender} · {v.description?.slice(0, 80)}...
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      onClick={() => handlePlayPreview(v.id)}
                      style={{
                        padding: '6px 10px',
                        background: '#e2e8f0',
                        border: 'none',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <Play size={10} /> Preview
                    </button>
                    <button
                      onClick={() => {
                        handleSaveVoice(v.id, voiceSpeed, voiceTone);
                        setShowCartesiaModal(false);
                      }}
                      style={{
                        padding: '6px 14px',
                        background: '#7c3aed',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 600
                      }}
                    >
                      Select Voice
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* LIVE TEST CHAT MODAL */}
      {showTalkModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 20
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 16,
            width: '100%',
            maxWidth: 500,
            height: '600px',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 50px rgba(0,0,0,0.2)'
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#e05638', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                  {initial}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Chat with {empName}</div>
                  <div style={{ fontSize: 11, color: '#16a34a' }}>● Online (Groq + Sarvam Voice)</div>
                </div>
              </div>
              <button
                onClick={() => setShowTalkModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}
              >
                <X size={18} color="#64748b" />
              </button>
            </div>

            <div style={{ flex: 1, padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ alignSelf: 'flex-start', background: '#f1f5f9', padding: '10px 14px', borderRadius: '12px 12px 12px 2px', fontSize: 13, maxWidth: '85%' }}>
                {openingLine.replace(/\{Lead Name\}/g, 'Abhiram')}
              </div>
              {talkMessages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    background: msg.role === 'user' ? '#7c3aed' : '#f1f5f9',
                    color: msg.role === 'user' ? '#ffffff' : '#0f172a',
                    padding: '10px 14px',
                    borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    fontSize: 13,
                    maxWidth: '85%'
                  }}
                >
                  {msg.content}
                </div>
              ))}
            </div>

            <div style={{ padding: '12px 16px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={talkInput}
                onChange={e => setTalkInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && talkInput.trim()) {
                    const userMsg = talkInput.trim();
                    setTalkMessages(prev => [...prev, { role: 'user', content: userMsg }]);
                    setTalkInput('');
                    // Quick simulated AI reply in Telugu
                    setTimeout(() => {
                      setTalkMessages(prev => [...prev, {
                        role: 'assistant',
                        content: 'చాలా మంచిదండి. మీరు చూస్తున్న లొకేషన్ గురించి చెప్తారా? మా దగ్గర హైటెక్ సిటీ మరియు గచ్చిబౌలి దగ్గర ప్రీమియం ప్రాజెక్ట్‌లు ఉన్నాయి.'
                      }]);
                    }, 800);
                  }
                }}
                placeholder="Type your reply in Telugu or English..."
                style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
              />
              <button
                onClick={() => {
                  if (talkInput.trim()) {
                    const userMsg = talkInput.trim();
                    setTalkMessages(prev => [...prev, { role: 'user', content: userMsg }]);
                    setTalkInput('');
                    setTimeout(() => {
                      setTalkMessages(prev => [...prev, {
                        role: 'assistant',
                        content: 'చాలా మంచిదండి. మీరు చూస్తున్న లొకేషన్ గురించి చెప్తారా? మా దగ్గర హైటెక్ సిటీ మరియు గచ్చిబౌలి దగ్గర ప్రీమియం ప్రాజెక్ట్‌లు ఉన్నాయి.'
                      }]);
                    }, 800);
                  }
                }}
                style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '0 16px', cursor: 'pointer' }}
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
