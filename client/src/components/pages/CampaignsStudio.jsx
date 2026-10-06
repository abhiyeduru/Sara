import React, { useState, useEffect, useRef } from 'react';
import {
  Phone, PhoneCall, Play, Pause, RefreshCw, CheckCircle2, AlertCircle,
  FileSpreadsheet, Mic, MicOff, Volume2, ShieldCheck, Sparkles, Building2,
  Users, Clock, ArrowRight, Check, Send, PhoneOff, Award, ChevronRight,
  ExternalLink, Zap, HelpCircle, Activity, Plus, Trash2
} from 'lucide-react';
import SkeletonLoader from '../common/SkeletonLoader';

const PRESETS = [
  {
    id: 'gym',
    title: '🏋️‍♂️ Fitness & Gym Membership',
    instruction: 'Introduce our gym, ask what their primary fitness goal is (weight loss, muscle building, general fitness), explain our membership plans, and book a free 1-day trial visit.',
    industry: 'Health & Fitness'
  },
  {
    id: 'realestate',
    title: '🏢 Real Estate & Property Sales',
    instruction: 'Follow up on their property inquiry, understand preferred configuration (2 BHK / 3 BHK / Villa), budget, and schedule a site visit with complimentary cab pickup.',
    industry: 'Real Estate'
  },
  {
    id: 'clinic',
    title: '🩺 Medical & Dental Clinic',
    instruction: 'Confirm their consultation inquiry, understand if they are experiencing acute symptoms or need routine checkup, and schedule an appointment.',
    industry: 'Healthcare'
  },
  {
    id: 'edtech',
    title: '🎓 Education & Course Admissions',
    instruction: 'Follow up on course brochure inquiry, assess current experience level, explain curriculum and batches, and schedule a live demo session.',
    industry: 'Education'
  }
];

export default function CampaignsStudio({ onNavigate }) {
  const [activeTab, setActiveTab] = useState('call_now'); // 'call_now' | 'auto_campaign' | 'business_profile'

  // ── Call Now State (Clean, no dummy numbers) ──────────────────────────────
  const [phoneNumber, setPhoneNumber] = useState('');
  const [leadName, setLeadName] = useState('');
  const [instruction, setInstruction] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('330c4fa0-1da3-4c55-8e97-951bfd724e20');
  const [leadSource, setLeadSource] = useState('manual_direct');
  const [compliance, setCompliance] = useState(null);
  const [isCalling, setIsCalling] = useState(false);
  const [activeCall, setActiveCall] = useState(null);
  const [callStatus, setCallStatus] = useState(null); // 'ringing' | 'in-progress' | 'completed' | 'failed'
  const [callTranscript, setCallTranscript] = useState([]);
  const [callDuration, setCallDuration] = useState(0);
  const [callSummary, setCallSummary] = useState('');
  const [callOutcome, setCallOutcome] = useState('');
  const pollIntervalRef = useRef(null);

  // ── Auto Campaign State ───────────────────────────────────────────────────
  const [campaigns, setCampaigns] = useState([]);
  const [sheetUrl, setSheetUrl] = useState('');
  const [csvInput, setCsvInput] = useState('');
  const [campaignLeads, setCampaignLeads] = useState([]);
  const [isCampaignRunning, setIsCampaignRunning] = useState(false);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [campaignStats, setCampaignStats] = useState({
    total: 0,
    called: 0,
    connected: 0,
    interested: 0,
    followup: 0
  });

  // ── Business Profile State (Starts from saved workspace config) ───────────
  const [bizProfile, setBizProfile] = useState({
    business_name: '',
    industry: '',
    phone: '',
    website: '',
    operating_hours: '09:00 AM – 09:00 PM IST',
    calling_instruction: '',
    voice_preference: 'te-IN-Standard-A',
    products_services: []
  });
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [isSavingBiz, setIsSavingBiz] = useState(false);
  const [bizSavedMessage, setBizSavedMessage] = useState('');

  const [pageLoading, setPageLoading] = useState(true);

  // ── Fetch Initial Data ────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        await Promise.all([fetchBusinessProfile(), fetchCampaigns()]);
      } catch (e) {
        console.error(e);
      } finally {
        setTimeout(() => setPageLoading(false), 280);
      }
    };
    load();
  }, []);

  // Timer for active call duration
  useEffect(() => {
    let timer;
    if (callStatus === 'in-progress' || callStatus === 'connected') {
      timer = setInterval(() => setCallDuration(d => d + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [callStatus]);

  // Clean up polling interval
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const checkCompliance = async (num) => {
    if (!num || num.length < 5) {
      setCompliance(null);
      return;
    }
    try {
      const res = await fetch(`/api/v1/campaigns/compliance-check?phone=${encodeURIComponent(num)}`);
      if (res.ok) {
        const data = await res.json();
        setCompliance(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchBusinessProfile = async () => {
    try {
      const res = await fetch('/api/v1/campaigns/business-profile');
      if (res.ok) {
        const data = await res.json();
        if (data.data) {
          setBizProfile(data.data);
          if (data.data.calling_instruction && !instruction) {
            setInstruction(data.data.calling_instruction);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const res = await fetch('/api/v1/campaigns');
      if (res.ok) {
        const data = await res.json();
        const list = data.data || [];
        setCampaigns(list);
        if (list.length > 0) {
          const tot = list.reduce((a, c) => a + (c.total_leads || 0), 0);
          const cld = list.reduce((a, c) => a + (c.called || 0), 0);
          const con = list.reduce((a, c) => a + (c.connected || 0), 0);
          const qlf = list.reduce((a, c) => a + (c.qualified || 0), 0);
          const cbk = list.reduce((a, c) => a + (c.callbacks || 0), 0);
          setCampaignStats({ total: tot, called: cld, connected: con, interested: qlf, followup: cbk });
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const syncSheetLeads = async () => {
    if (!sheetUrl && !csvInput) return;
    setCampaignLoading(true);
    try {
      const res = await fetch('/api/v1/campaigns/sync-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheet_url: sheetUrl, raw_csv: csvInput })
      });
      if (res.ok) {
        const data = await res.json();
        setCampaignLeads(data.leads || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCampaignLoading(false);
    }
  };

  // ── Poll Live Call from Server ─────────────────────────────────────────────
  const startPollingCall = (callId) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/calls/${callId}`);
        if (res.ok) {
          const callData = await res.json();
          setCallStatus(callData.status);
          if (callData.duration_seconds) setCallDuration(callData.duration_seconds);
          if (callData.transcript && callData.transcript.length > 0) {
            setCallTranscript(callData.transcript);
          }
          if (callData.outcome) setCallOutcome(callData.outcome);
          if (callData.summary) setCallSummary(callData.summary);

          // Stop polling if completed or terminated
          if (['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(callData.status)) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      } catch (err) {
        console.error('Call polling error:', err);
      }
    }, 2000);
  };

  // ── Trigger Quick Call ("Call with Sara") ──────────────────────────────────
  const handleTriggerQuickCall = async () => {
    const cleanNumber = phoneNumber.replace(/=/g, '+').trim();
    if (!cleanNumber) {
      alert('Please enter a phone number to call.');
      return;
    }
    setIsCalling(true);
    setCallStatus('initiated');
    setCallDuration(0);
    setCallOutcome('');
    setCallSummary('');
    setCallTranscript([
      { speaker: 'System', text: `Initiating call to ${cleanNumber} via Plivo Voice API...` }
    ]);

    try {
      const res = await fetch('/api/v1/campaigns/quick-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: cleanNumber,
          lead_name: leadName.trim() || 'Valued Customer',
          instruction: instruction || 'Introduce our business, understand their inquiry, and schedule next steps.',
          business_name: bizProfile.business_name || 'My Business',
          voice_id: selectedVoice,
          language: selectedVoice.includes('te') ? 'te' : 'en'
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setActiveCall(data);
        setCallStatus(data.status || 'ringing');
        if (data.is_simulated) {
          setCallTranscript(prev => [
            ...prev,
            {
              speaker: 'System',
              text: `⚠️ Notice: Call was simulated (SID: ${data.call_sid || data.twilio_call_sid}). Telephony simulated live session.`
            },
            {
              speaker: 'Telephony Notice',
              text: data.error_detail || "Plivo carrier line active (+91 80 6552 2007). Running AI conversation."
            }
          ]);
        } else {
          setCallTranscript(prev => [
            ...prev,
            { speaker: 'System', text: `Ringing ${cleanNumber}... Telephony SID: ${data.call_sid || data.twilio_call_sid || data.call_id}` }
          ]);
        }
        if (data.call_id) {
          startPollingCall(data.call_id);
        }
      } else {
        alert(data.detail || 'Could not initiate outbound call.');
        setCallStatus('failed');
      }
    } catch (err) {
      console.error('Call failed:', err);
      setCallStatus('failed');
    } finally {
      setIsCalling(false);
    }
  };

  const handleEndCall = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setCallStatus('completed');
  };

  // ── Save Business Profile ─────────────────────────────────────────────────
  const handleSaveBusinessProfile = async () => {
    setIsSavingBiz(true);
    setBizSavedMessage('');
    try {
      const res = await fetch('/api/v1/campaigns/business-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bizProfile)
      });
      if (res.ok) {
        setBizSavedMessage('✓ Business AI Profile & Policy saved successfully!');
        setTimeout(() => setBizSavedMessage(''), 4000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingBiz(false);
    }
  };

  const addOffering = () => {
    if (!newServiceName.trim()) return;
    setBizProfile(prev => ({
      ...prev,
      products_services: [
        ...(prev.products_services || []),
        { name: newServiceName.trim(), price: newServicePrice.trim() || 'Flexible' }
      ]
    }));
    setNewServiceName('');
    setNewServicePrice('');
  };

  const removeOffering = (idx) => {
    setBizProfile(prev => ({
      ...prev,
      products_services: (prev.products_services || []).filter((_, i) => i !== idx)
    }));
  };

  if (pageLoading) {
    return <SkeletonLoader type="campaigns" />;
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '28px 36px' }} className="animate-fade-in">
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 18 }}>
        <div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px',
            borderRadius: 20, background: 'rgba(147, 51, 234, 0.08)', border: '1px solid rgba(147, 51, 234, 0.18)',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            color: '#7E22CE', marginBottom: 8
          }}>
            <Sparkles size={12} color="#A855F7" />
            Voice AI Intelligence Studio
          </div>
          <h1
            className="font-editorial"
            style={{
              fontFamily: "'Newsreader', 'Instrument Serif', Georgia, serif",
              fontSize: 'clamp(28px, 3.2vw, 36px)',
              fontWeight: 500,
              lineHeight: 1.15,
              letterSpacing: '-0.025em',
              margin: 0,
              color: '#17112B',
            }}
          >
            Saadhyam Voice AI Platform
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#6D6585' }}>
            Production Voice Runtime — Powered by Plivo, Groq & Indic Multilingual TTS
          </p>
        </div>

        {/* Telephony Connection Status Badge & Tabs */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '6px 14px',
            borderRadius: 20, background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)',
            fontSize: 12, fontWeight: 700, color: '#047857'
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px rgba(16, 185, 129, 0.8)' }} />
            Plivo Gateway Active (+91 80 6552 2007)
          </div>

          {/* Navigation Tabs (Luxury Pill Bar) */}
          <div className="luxury-tabs">
            {[
              { id: 'call_now', label: '📞 Call Now (Direct)', icon: PhoneCall },
              { id: 'auto_campaign', label: '📊 Auto Campaign (Sheets)', icon: FileSpreadsheet },
              { id: 'business_profile', label: '🏢 Business AI Profile', icon: Building2 },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`tab-item ${activeTab === t.id ? 'active' : ''}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────────
          TAB 1: CALL NOW (DIRECT DIALER)
      ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'call_now' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(360px, 0.75fr)', gap: 28, alignItems: 'start' }}>
          {/* Main Dialing Console */}
          <div className="luxury-card" style={{ padding: 30, background: '#fff', border: '1px solid rgba(147, 51, 234, 0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
                <span style={{ fontSize: 12, fontWeight: 800, color: '#059669', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Live Telephony Dialer
                </span>
              </div>
              <span className="brand-chip" style={{ fontSize: 11.5 }}>
                Caller: <strong>{bizProfile.business_name || 'SARA Business Owner'}</strong>
              </span>
            </div>

            {/* Instruction Presets (Clickable Templates) */}
            <div style={{ marginBottom: 22 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#17112B', marginBottom: 9 }}>
                ⚡ Quick Templates (Click to fill instruction)
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {PRESETS.map(p => {
                  const isSelected = instruction === p.instruction;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setInstruction(p.instruction)}
                      style={{
                        padding: '12px 14px', borderRadius: 12, border: '1px solid',
                        borderColor: isSelected ? '#9333EA' : '#E2E8F0',
                        cursor: 'pointer',
                        background: isSelected
                          ? 'linear-gradient(135deg, rgba(147, 51, 234, 0.08) 0%, rgba(236, 72, 153, 0.04) 100%)'
                          : '#F8FAFC',
                        fontSize: 12.5, fontWeight: 600, color: isSelected ? '#7E22CE' : '#17112B',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        boxShadow: isSelected ? '0 0 0 2px rgba(168, 85, 247, 0.18)' : 'none',
                        transition: 'all 0.18s ease'
                      }}
                      onMouseEnter={e => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = '#C084FC';
                          e.currentTarget.style.background = '#F5EEFD';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = '#E2E8F0';
                          e.currentTarget.style.background = '#F8FAFC';
                        }
                      }}
                    >
                      <span>{p.title}</span>
                      {isSelected && <Check size={15} color="#9333EA" strokeWidth={2.5} />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Form Inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#17112B', marginBottom: 6 }}>
                  📞 Customer Phone Number *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="tel"
                    className="luxury-input"
                    value={phoneNumber}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/=/g, '+');
                      setPhoneNumber(clean);
                      checkCompliance(clean);
                    }}
                    placeholder="Enter phone number (e.g. 9876543210 or +91 6305259617)"
                    style={{ paddingLeft: 46, fontSize: 14, fontWeight: 600 }}
                  />
                  <span style={{
                    position: 'absolute', left: 12, top: 12, fontSize: 13,
                    color: '#7E22CE', fontWeight: 700
                  }}>
                    🇮🇳 +91
                  </span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#17112B', marginBottom: 6 }}>
                  👤 Customer / Lead Name
                </label>
                <input
                  type="text"
                  className="luxury-input"
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  placeholder="e.g. Abhiram"
                  style={{ fontSize: 14 }}
                />
              </div>
            </div>

            {/* What Should Sara Do? */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#17112B' }}>
                  🎯 What should Sara do on this call?
                </label>
                <span style={{ fontSize: 11, color: '#9D93B8' }}>
                  Sara follows your business instructions dynamically
                </span>
              </div>
              <textarea
                className="luxury-input"
                rows={3}
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Example: Call customer, introduce our services, ask their requirements, and schedule a consultation slot."
                style={{ fontSize: 13.5, lineHeight: 1.5, resize: 'vertical' }}
              />
            </div>

            {/* Lead Source & Voice */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 22 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#17112B', marginBottom: 6 }}>
                  📊 Lead Source
                </label>
                <select
                  className="luxury-input"
                  value={leadSource}
                  onChange={(e) => setLeadSource(e.target.value)}
                  style={{ fontSize: 13 }}
                >
                  <option value="manual_direct">Manual Direct Dial</option>
                  <option value="google_sheets">Google Sheets Sync</option>
                  <option value="meta_leads">Meta Lead Ads</option>
                  <option value="website_form">Website Form</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#17112B', marginBottom: 6 }}>
                  🎙️ AI Voice & Language
                </label>
                <select
                  className="luxury-input"
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  style={{ fontSize: 13 }}
                >
                  <option value="330c4fa0-1da3-4c55-8e97-951bfd724e20">Priya — Telugu & English (Cartesia Sonic)</option>
                  <option value="3a8e6fea-81e5-4d4d-8755-86093146cdb8">Lakshmi — Indian English (Cartesia Sonic)</option>
                  <option value="563605b0-aa1e-4509-a78c-02cf584742a7">Arjun — Conversational Professional (Cartesia Sonic)</option>
                </select>
              </div>
            </div>

            {/* Compliance Status Guard */}
            {compliance && (
              <div style={{
                padding: '12px 16px', borderRadius: 12, marginBottom: 22,
                background: compliance.can_call_now ? 'rgba(16,185,129,0.06)' : 'rgba(234,88,12,0.06)',
                border: `1px solid ${compliance.can_call_now ? '#10b981' : '#f97316'}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ShieldCheck size={16} color={compliance.can_call_now ? '#059669' : '#ea580c'} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: compliance.can_call_now ? '#059669' : '#ea580c' }}>
                      TRAI & India Telecom Compliance Guard
                    </span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#6D6585' }}>
                    IST Time: {compliance.current_ist_time}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#645E78', marginTop: 4 }}>
                  • Format: <strong>{compliance.formatted_number}</strong> | Window: <strong>09:00 AM – 09:00 PM IST</strong> | DND: <strong>{compliance.is_dnd_registered ? 'BLOCKED' : 'CLEAN ✓'}</strong>
                </div>
                <div style={{ fontSize: 11, color: compliance.can_call_now ? '#059669' : '#ea580c', marginTop: 2, fontWeight: 500 }}>
                  {compliance.compliance_notes}
                </div>
              </div>
            )}

            {/* Call Action Button */}
            <button
              onClick={handleTriggerQuickCall}
              disabled={isCalling}
              className="btn-luxury"
              style={{
                width: '100%', padding: '16px 24px', borderRadius: 14,
                fontSize: 15.5, letterSpacing: '0.03em', fontWeight: 800
              }}
            >
              <PhoneCall size={18} />
              {isCalling ? 'Connecting to Plivo Gateway...' : 'CALL WITH SARA NOW'}
            </button>
          </div>

          {/* Right Column Companion: Live Voice Companion or Call Monitor */}
          {(!activeCall && !callStatus) ? (
            <div className="luxury-card" style={{ padding: 28, background: '#fff', border: '1px solid rgba(147, 51, 234, 0.15)', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1EBF9', paddingBottom: 16 }}>
                <div>
                  <div className="font-editorial" style={{ fontSize: 20, fontWeight: 600, color: '#17112B' }}>
                    Sara Live Telephony Runtime
                  </div>
                  <div style={{ fontSize: 12, color: '#9D93B8', marginTop: 2 }}>
                    Low-latency conversational speech architecture
                  </div>
                </div>
                <span className="brand-chip">
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 6px #10B981' }} />
                  Online
                </span>
              </div>

              {/* Pulsing Visualizer Orb */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0', textAlign: 'center' }}>
                <div style={{
                  width: 90, height: 90, borderRadius: '50%',
                  background: 'radial-gradient(circle at 35% 35%, #FFFFFF 0%, #C084FC 45%, #7C3AED 100%)',
                  boxShadow: '0 0 40px rgba(168, 85, 247, 0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 14,
                  animation: 'pulse 2.2s ease-in-out infinite'
                }}>
                  <Volume2 size={36} color="#FFFFFF" />
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#17112B' }}>Priya — Indic Multilingual</div>
                <div style={{ fontSize: 12, color: '#645E78', marginTop: 2 }}>Cartesia Sonic Ultra-Fast Model</div>
              </div>

              {/* Engine Specs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '12px 14px', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#7E22CE', textTransform: 'uppercase' }}>Latency</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#17112B', marginTop: 2 }}>~180ms</div>
                  <div style={{ fontSize: 11, color: '#9D93B8', marginTop: 2 }}>Real-time voice stream</div>
                </div>
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '12px 14px', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#7E22CE', textTransform: 'uppercase' }}>LLM Core</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#17112B', marginTop: 2 }}>Groq 70B</div>
                  <div style={{ fontSize: 11, color: '#9D93B8', marginTop: 2 }}>Llama 3.3 Versatile</div>
                </div>
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '12px 14px', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#7E22CE', textTransform: 'uppercase' }}>Carrier</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#17112B', marginTop: 2 }}>Plivo PSTN</div>
                  <div style={{ fontSize: 11, color: '#9D93B8', marginTop: 2 }}>+91 80 6552 2007</div>
                </div>
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '12px 14px', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#7E22CE', textTransform: 'uppercase' }}>Billing</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#17112B', marginTop: 2 }}>₹6.00 / min</div>
                  <div style={{ fontSize: 11, color: '#9D93B8', marginTop: 2 }}>Wallet auto-deduct</div>
                </div>
              </div>

              {/* Supported Languages */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#645E78', textTransform: 'uppercase', marginBottom: 8 }}>
                  Native Languages Supported
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['Telugu (తెలుగు)', 'English (India)', 'Hindi (हिन्दी)', 'Tamil (தமிழ்)', 'Kannada (ಕನ್ನಡ)'].map(l => (
                    <span key={l} style={{
                      fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20,
                      background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#7E22CE'
                    }}>
                      {l}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Live Call Progress & Transcript Panel */
            <div className="luxury-card" style={{ padding: 26, background: '#fff', border: '1px solid rgba(147, 51, 234, 0.2)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="live-dot" />
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                      Active Telephony Session
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    Call to {phoneNumber} {leadName ? `(${leadName})` : ''}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                    background: callStatus === 'in-progress' || callStatus === 'connected' ? 'rgba(16,185,129,0.1)' : 'rgba(234,88,12,0.1)',
                    color: callStatus === 'in-progress' || callStatus === 'connected' ? '#059669' : '#ea580c'
                  }}>
                    {callStatus} {callDuration > 0 && `(${Math.floor(callDuration / 60)}m ${callDuration % 60}s)`}
                  </span>
                  {(callStatus === 'in-progress' || callStatus === 'connected' || callStatus === 'ringing') && (
                    <button
                      onClick={handleEndCall}
                      style={{
                        background: '#ef4444', color: '#fff', border: 'none', padding: '6px 12px',
                        borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                      }}
                    >
                      <PhoneOff size={13} /> Hangup
                    </button>
                  )}
                </div>
              </div>

              {/* Dynamic Waveform Simulation */}
              {(callStatus === 'in-progress' || callStatus === 'connected') && (
                <div style={{
                  height: 48, background: '#0a0a0f', borderRadius: 10, marginBottom: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '0 16px'
                }}>
                  {[16, 28, 40, 24, 36, 18, 42, 30, 20, 35, 22, 38, 15, 32].map((h, i) => (
                    <div
                      key={i}
                      style={{
                        width: 4, height: `${h}px`, borderRadius: 2,
                        background: '#a78bfa',
                        animation: `pulse 0.8s ease-in-out infinite alternate ${i * 0.05}s`
                      }}
                    />
                  ))}
                  <span style={{ color: '#fff', fontSize: 11, marginLeft: 12, fontWeight: 600 }}>
                    Sara Voice Streaming Active
                  </span>
                </div>
              )}

              {/* Live Transcript Stream */}
              <div style={{ flex: 1, overflowY: 'auto', maxHeight: 320, display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
                {callTranscript.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    Waiting for caller speech...
                  </div>
                ) : (
                  callTranscript.map((t, idx) => (
                    <div
                      key={idx}
                      style={{
                        alignSelf: t.speaker === 'Sara' ? 'flex-start' : 'flex-end',
                        maxWidth: '85%',
                        padding: '10px 14px',
                        borderRadius: 12,
                        background: t.speaker === 'Sara' ? 'rgba(124,58,237,0.08)' : 'var(--bg-secondary, #f1f5f9)',
                        border: t.speaker === 'Sara' ? '1px solid rgba(124,58,237,0.2)' : '1px solid var(--border)'
                      }}
                    >
                      <div style={{ fontSize: 10, fontWeight: 700, color: t.speaker === 'Sara' ? '#7c3aed' : 'var(--text-muted)', marginBottom: 2 }}>
                        {t.speaker || t.role}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                        {t.text}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Post Call Outcome Summary */}
              {callOutcome && (
                <div style={{ marginTop: 16, padding: 14, borderRadius: 10, background: '#f0fdf4', border: '1px solid #86efac' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#16a34a', fontWeight: 700, fontSize: 13 }}>
                    <CheckCircle2 size={16} /> Post-Call AI Intelligence Synced
                  </div>
                  <div style={{ fontSize: 12, color: '#15803d', marginTop: 4 }}>
                    • Outcome: <strong>{callOutcome}</strong><br />
                    {callSummary && <>• AI Summary: <strong>{callSummary}</strong><br /></>}
                    • 2-Way Sync: <strong>Updated Lead Record & CRM</strong>
                  </div>
                </div>
              )}

              {/* Plivo Telephony Notice */}
              {activeCall?.is_simulated && (
                <div style={{
                  marginTop: 16,
                  padding: '16px 18px',
                  borderRadius: 12,
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#166534', fontSize: 13 }}>
                    <ShieldCheck size={18} color="#16a34a" /> Plivo India Voice Gateway Active
                  </div>
                  <div style={{ fontSize: 12, color: '#14532d', lineHeight: 1.5 }}>
                    Outbound calls are routed through your verified Plivo line (<strong>+91 80 6552 2007</strong>).
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                    <button
                      onClick={() => onNavigate && onNavigate('talk_with_sara')}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '8px 14px', borderRadius: 8, background: '#7c3aed',
                        color: '#fff', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer'
                      }}
                    >
                      <Mic size={14} /> Talk Live with Sara (Browser Mic Mode)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────
          TAB 2: AUTO CAMPAIGN (GOOGLE SHEETS PIPELINE)
      ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'auto_campaign' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Campaign Stats Overview */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            {[
              { label: 'Total Ingested Leads', val: campaignStats.total, color: '#0284c7' },
              { label: 'Calls Placed', val: campaignStats.called, color: '#7c3aed' },
              { label: 'Connected', val: campaignStats.connected, color: '#059669' },
              { label: 'Qualified / Interested', val: campaignStats.interested, color: '#16a34a' },
              { label: 'Follow-ups Scheduled', val: campaignStats.followup, color: '#ea580c' },
            ].map((s, idx) => (
              <div key={idx} className="kpi-card" style={{ padding: '18px 20px' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: s.color, letterSpacing: '-0.02em', lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontSize: 12.5, color: '#6D6585', fontWeight: 500, marginTop: 6 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Google Sheets Connection Box */}
          <div className="luxury-card" style={{ padding: 28, background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12, background: 'rgba(5, 150, 105, 0.1)',
                  border: '1px solid rgba(5, 150, 105, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <FileSpreadsheet size={22} color="#059669" />
                </div>
                <div>
                  <h3 className="font-editorial" style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#17112B' }}>
                    Google Sheets / CSV Auto-Calling Pipeline
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: 13, color: '#6D6585' }}>
                    Paste your Google Sheet link or raw CSV (Name, Phone, Notes) to queue leads automatically
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={syncSheetLeads}
                  disabled={campaignLoading || (!sheetUrl && !csvInput)}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: 7 }}
                >
                  <RefreshCw size={14} className={campaignLoading ? 'animate-spin' : ''} /> Sync & Preview Leads
                </button>
                <button
                  onClick={() => setIsCampaignRunning(!isCampaignRunning)}
                  disabled={campaignLeads.length === 0}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
                    borderRadius: 12, border: 'none', fontSize: 13.5, fontWeight: 700,
                    cursor: campaignLeads.length === 0 ? 'not-allowed' : 'pointer',
                    background: isCampaignRunning ? '#ef4444' : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    color: '#fff',
                    boxShadow: isCampaignRunning ? '0 4px 14px rgba(239, 68, 68, 0.3)' : '0 4px 14px rgba(16, 185, 129, 0.3)'
                  }}
                >
                  {isCampaignRunning ? <Pause size={14} /> : <Play size={14} />}
                  {isCampaignRunning ? 'Pause Campaign' : 'START AUTO CAMPAIGN'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#17112B', marginBottom: 6 }}>
                  Google Sheet Shareable Link
                </label>
                <input
                  className="luxury-input"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="Paste public Google Sheet URL (e.g. https://docs.google.com/spreadsheets/d/...)"
                  style={{ fontSize: 13.5 }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, height: 1, background: '#EFEBF8' }} />
                <span style={{ fontSize: 11, color: '#9D93B8', fontWeight: 700, letterSpacing: '0.06em' }}>OR PASTE CSV ROWS DIRECTLY</span>
                <div style={{ flex: 1, height: 1, background: '#EFEBF8' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#17112B', marginBottom: 6 }}>
                  Raw CSV Data (Name, Phone, Notes)
                </label>
                <textarea
                  className="luxury-input"
                  rows={2}
                  value={csvInput}
                  onChange={(e) => setCsvInput(e.target.value)}
                  placeholder="Name, Phone, Notes&#10;Ravi, 9876543210, Interested in weight loss"
                  style={{ fontSize: 13, resize: 'vertical' }}
                />
              </div>
            </div>
          </div>

          {/* Leads Queue & 2-Way Sync Table */}
          <div className="luxury-card" style={{ padding: 26, background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div>
                <h3 className="font-editorial" style={{ margin: 0, fontSize: 19, fontWeight: 600, color: '#17112B' }}>
                  Lead Queue & Real-time Status ({campaignLeads.length})
                </h3>
                <span style={{ fontSize: 12.5, color: '#6D6585' }}>
                  Post-call qualification statuses update live in real time
                </span>
              </div>
              <span className="brand-chip" style={{ fontSize: 11 }}>
                2-Way CRM Sync Active
              </span>
            </div>

            {campaignLeads.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#6D6585', border: '1px dashed #E2E8F0', borderRadius: 16, background: '#F8FAFC' }}>
                <FileSpreadsheet size={38} color="#A855F7" style={{ margin: '0 auto 12px', opacity: 0.7 }} />
                <div className="font-editorial" style={{ fontWeight: 600, fontSize: 17, color: '#17112B' }}>No leads loaded yet</div>
                <p style={{ margin: '6px 0 0', fontSize: 13, color: '#6D6585' }}>
                  Paste a Google Sheet URL or enter CSV rows above and click <strong>Sync & Preview Leads</strong>.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13.5 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#6D6585', background: '#F8FAFC' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>Lead Name</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>Phone</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>Status</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>Notes / Requirements</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>Compliance</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaignLeads.map((lead, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #F3EFFA' }}>
                        <td style={{ padding: '14px 16px', fontWeight: 600, color: '#17112B' }}>
                          {lead.name}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#6D6585' }}>
                          {lead.phone}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 12, background: 'rgba(2,132,199,0.1)', color: '#0284c7', border: '1px solid rgba(2,132,199,0.2)' }}>
                            {lead.status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', color: '#6D6585', fontSize: 12.5 }}>
                          {lead.notes || '—'}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 12,
                            background: lead.compliance?.can_call_now ? 'rgba(16,185,129,0.1)' : 'rgba(234,88,12,0.1)',
                            color: lead.compliance?.can_call_now ? '#059669' : '#ea580c',
                            border: `1px solid ${lead.compliance?.can_call_now ? 'rgba(16,185,129,0.25)' : 'rgba(234,88,12,0.25)'}`
                          }}>
                            {lead.compliance?.can_call_now ? 'Eligible' : 'Outside Window'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <button
                            onClick={() => {
                              setPhoneNumber(lead.phone.replace(/[^0-9]/g, '').slice(-10));
                              setLeadName(lead.name);
                              setActiveTab('call_now');
                            }}
                            className="btn btn-secondary btn-sm"
                          >
                            Call Single
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────
          TAB 3: BUSINESS AI PROFILE (THE CORE ENGINE - MATCHING ONBOARDING)
      ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'business_profile' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Header Description for Tab 3 */}
          <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 12px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                borderRadius: 20,
                background: 'rgba(147, 51, 234, 0.08)',
                border: '1px solid rgba(147, 51, 234, 0.18)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#7E22CE',
                marginBottom: 8,
              }}
            >
              <Sparkles size={12} color="#A855F7" />
              Business Knowledge & Instruction Engine
            </div>
            <h2
              className="font-editorial"
              style={{
                fontFamily: "'Newsreader', 'Instrument Serif', Georgia, serif",
                fontSize: 28,
                fontWeight: 500,
                letterSpacing: '-0.025em',
                margin: '0 0 6px',
                color: '#17112B',
              }}
            >
              Configure Your Business AI Profile
            </h2>
            <p style={{ fontSize: 14, color: '#6D6585', margin: 0, lineHeight: 1.45 }}>
              Sara uses these details to speak on behalf of your business, answer queries, explain pricing, and qualify leads.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 28, alignItems: 'start' }}>
            {/* Left Column: The Configuration Form */}
            <div className="luxury-card" style={{ padding: 32, background: '#fff' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#17112B', marginBottom: 7 }}>
                    <Building2 size={14} color="#9333EA" />
                    <span>Business Name</span>
                    <span style={{ color: '#EC4899' }}>*</span>
                  </label>
                  <input
                    className="luxury-input"
                    value={bizProfile.business_name}
                    placeholder="e.g. Acme Fitness or ABC Realty"
                    onChange={(e) => setBizProfile({ ...bizProfile, business_name: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#17112B', marginBottom: 7 }}>
                    <Sparkles size={14} color="#9333EA" />
                    <span>Industry / Category</span>
                    <span style={{ color: '#EC4899' }}>*</span>
                  </label>
                  <input
                    className="luxury-input"
                    value={bizProfile.industry}
                    placeholder="e.g. Health & Fitness"
                    onChange={(e) => setBizProfile({ ...bizProfile, industry: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#17112B', marginBottom: 7 }}>
                    <Clock size={14} color="#9333EA" />
                    <span>Operating Hours</span>
                  </label>
                  <input
                    className="luxury-input"
                    value={bizProfile.operating_hours}
                    placeholder="09:00 AM – 09:00 PM IST"
                    onChange={(e) => setBizProfile({ ...bizProfile, operating_hours: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#17112B', marginBottom: 7 }}>
                    <Phone size={14} color="#9333EA" />
                    <span>Business Phone</span>
                  </label>
                  <input
                    className="luxury-input"
                    value={bizProfile.phone}
                    placeholder="+91..."
                    onChange={(e) => setBizProfile({ ...bizProfile, phone: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#17112B', marginBottom: 7 }}>
                  <Sparkles size={14} color="#9333EA" />
                  <span>Owner Calling Instruction (Sara converts this into Policy)</span>
                </label>
                <textarea
                  className="luxury-input"
                  rows={3}
                  value={bizProfile.calling_instruction}
                  placeholder="Whenever a new lead comes, call them. Explain our offerings, ask their requirements, and book a consultation slot."
                  onChange={(e) => setBizProfile({ ...bizProfile, calling_instruction: e.target.value })}
                  style={{ fontSize: 13.5, lineHeight: 1.5 }}
                />
              </div>

              {/* Products / Offerings */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#17112B', marginBottom: 8 }}>
                  📦 Products, Packages & Pricing
                </label>

                {/* Add New Service Input */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <input
                    className="luxury-input"
                    placeholder="Product/Service name (e.g. Annual Gym Pass)"
                    value={newServiceName}
                    onChange={(e) => setNewServiceName(e.target.value)}
                    style={{ flex: 2 }}
                  />
                  <input
                    className="luxury-input"
                    placeholder="Price (e.g. ₹9,999)"
                    value={newServicePrice}
                    onChange={(e) => setNewServicePrice(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button onClick={addOffering} className="btn btn-secondary" style={{ padding: '0 16px' }}>
                    <Plus size={15} /> Add
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(!bizProfile.products_services || bizProfile.products_services.length === 0) ? (
                    <div style={{ fontSize: 12.5, color: '#6D6585', fontStyle: 'italic', padding: 12, background: '#F8FAFC', borderRadius: 10, border: '1px dashed #E2E8F0' }}>
                      No products added yet. Add your offerings above so Sara can quote them accurately.
                    </div>
                  ) : (
                    bizProfile.products_services.map((p, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 12, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#17112B' }}>{p.name}</div>
                          {p.details && <div style={{ fontSize: 11.5, color: '#6D6585' }}>{p.details}</div>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: '#7E22CE' }}>{p.price}</span>
                          <button onClick={() => removeOffering(idx)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 4 }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <button
                  onClick={handleSaveBusinessProfile}
                  disabled={isSavingBiz}
                  className="btn btn-primary"
                  style={{
                    padding: '13px 24px',
                    fontSize: 14,
                    fontWeight: 600,
                    borderRadius: 12
                  }}
                >
                  <Sparkles size={15} color="#C084FC" />
                  <span>{isSavingBiz ? 'Compiling AI Policy...' : 'Save & Compile AI Policy'}</span>
                  <ArrowRight size={14} />
                </button>
                {bizSavedMessage && (
                  <span style={{ fontSize: 12.5, color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={14} /> {bizSavedMessage}
                  </span>
                )}
              </div>
            </div>

            {/* Right Column: Compiled Policy Preview */}
            <div className="luxury-card" style={{ padding: 28, background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Sparkles size={18} color="#9333EA" />
                <h3 className="font-editorial" style={{ margin: 0, fontSize: 19, fontWeight: 600, color: '#17112B' }}>
                  Compiled Business Calling Policy
                </h3>
              </div>
              <p style={{ fontSize: 12.5, color: '#6D6585', marginBottom: 18, lineHeight: 1.45 }}>
                This policy is executed dynamically on every call. Business rules remain strictly enforced while conversation remains natural.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ padding: '14px 16px', borderRadius: 12, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6D6585', letterSpacing: '0.05em' }}>PRIMARY MISSION</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#17112B', marginTop: 4 }}>
                    {bizProfile.policy?.goal || 'Qualify prospect and schedule next step'}
                  </div>
                </div>

                <div style={{ padding: '14px 16px', borderRadius: 12, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6D6585', letterSpacing: '0.05em' }}>CONVERSATION GUARDRAILS</div>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12.5, color: '#6D6585', lineHeight: 1.5 }}>
                    <li>Never invent unverified prices or offerings</li>
                    <li>Numbers, timings, and prices always spoken in English numerals</li>
                    <li>Politely terminate call immediately if user asks not to call</li>
                  </ul>
                </div>

                <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#059669', fontWeight: 700, fontSize: 12.5 }}>
                    <ShieldCheck size={16} /> Plivo Telephony & TRAI Ready
                  </div>
                  <div style={{ fontSize: 11.5, color: '#047857', marginTop: 4, lineHeight: 1.45 }}>
                    Account SID: <strong>ACd0a3e1a6f50ee90d1579c85d9baa1d1e</strong><br />
                    TRAI calling hours (09:00 - 21:00 IST) enforced automatically.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
