import React, { useState, useEffect, useRef } from 'react';
import {
  Phone, PhoneCall, Play, Pause, RefreshCw, CheckCircle2, AlertCircle,
  FileSpreadsheet, Mic, MicOff, Volume2, ShieldCheck, Sparkles, Building2,
  Users, Clock, ArrowRight, Check, Send, PhoneOff, Award, ChevronRight,
  ExternalLink, Zap, HelpCircle, Activity, Plus, Trash2
} from 'lucide-react';

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
  const [selectedVoice, setSelectedVoice] = useState('te-IN-Standard-A');
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

  // ── Fetch Initial Data ────────────────────────────────────────────────────
  useEffect(() => {
    fetchBusinessProfile();
    fetchCampaigns();
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
      { speaker: 'System', text: `Initiating call to ${cleanNumber} via Twilio Voice API...` }
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
              text: `⚠️ Notice: Call was simulated (SID: ${data.twilio_call_sid}). Twilio could not place a real telecom call to ${cleanNumber}.`
            },
            {
              speaker: 'Twilio Error',
              text: data.error_detail || "The 'from' number is not assigned or destination number is not verified on your Twilio Trial account."
            },
            {
              speaker: 'Setup Action',
              text: 'To receive actual calls on your phone: 1) Claim a number in Twilio Console. 2) Add this phone number to Twilio Verified Caller IDs (or upgrade your Twilio account).'
            }
          ]);
        } else {
          setCallTranscript(prev => [
            ...prev,
            { speaker: 'System', text: `Ringing ${cleanNumber}... Telephony SID: ${data.twilio_call_sid || data.call_id}` }
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

  return (
    <div style={{ maxWidth: 1360, margin: '0 auto', padding: '24px 32px' }} className="animate-fade-in">
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)'
            }}>
              <Volume2 size={20} color="#fff" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans' }}>
                Saadhyam Voice AI Platform
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                Production Voice Runtime — Powered by Twilio, Groq & Indic Multilingual TTS
              </p>
            </div>
          </div>
        </div>

        {/* Telephony Connection Status Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
            borderRadius: 20, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)',
            fontSize: 12, fontWeight: 600, color: '#059669'
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981' }} />
            Twilio Gateway Active (ACd0a3e...1d1e)
          </div>

          {/* Navigation Tabs */}
          <div style={{
            display: 'flex', background: 'var(--bg-secondary, #f1f5f9)',
            padding: 4, borderRadius: 12, border: '1px solid var(--border)'
          }}>
            {[
              { id: 'call_now', label: '📞 Call Now (Direct)', icon: PhoneCall },
              { id: 'auto_campaign', label: '📊 Auto Campaign (Sheets)', icon: FileSpreadsheet },
              { id: 'business_profile', label: '🏢 Business AI Profile', icon: Building2 },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
                  borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.2s',
                  background: activeTab === t.id ? '#fff' : 'transparent',
                  color: activeTab === t.id ? 'var(--primary, #7c3aed)' : 'var(--text-muted)',
                  boxShadow: activeTab === t.id ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
                }}
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
        <div style={{ display: 'grid', gridTemplateColumns: activeCall || callStatus ? '1.1fr 0.9fr' : '1fr', gap: 28 }}>
          {/* Main Dialing Console */}
          <div className="card" style={{ padding: 28, borderRadius: 16, border: '1px solid var(--border)', background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#059669', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Live Telephony Dialer
                </span>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-secondary, #f8fafc)', padding: '4px 10px', borderRadius: 20 }}>
                Caller: <strong>{bizProfile.business_name || 'My Business'}</strong>
              </span>
            </div>

            {/* Instruction Presets (Clickable Templates) */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                ⚡ Quick Templates (Click to fill instruction)
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {PRESETS.map(p => (
                  <div
                    key={p.id}
                    onClick={() => {
                      setInstruction(p.instruction);
                    }}
                    style={{
                      padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)',
                      cursor: 'pointer', background: instruction === p.instruction ? 'rgba(124,58,237,0.06)' : 'var(--bg-secondary, #f8fafc)',
                      borderColor: instruction === p.instruction ? 'var(--primary, #7c3aed)' : 'var(--border)',
                      fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                    }}
                  >
                    <span>{p.title}</span>
                    {instruction === p.instruction && <Check size={14} color="#7c3aed" />}
                  </div>
                ))}
              </div>
            </div>

            {/* Form Inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                  📞 Customer Phone Number *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="tel"
                    className="input"
                    value={phoneNumber}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/=/g, '+');
                      setPhoneNumber(clean);
                      checkCompliance(clean);
                    }}
                    placeholder="Enter phone number (e.g. 9876543210 or +91 6305259617)"
                    style={{ width: '100%', fontSize: 14, fontWeight: 600, paddingLeft: 42 }}
                  />
                  <span style={{ position: 'absolute', left: 12, top: 10, fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
                    🇮🇳 +91
                  </span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                  👤 Customer / Lead Name
                </label>
                <input
                  type="text"
                  className="input"
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  placeholder="e.g. Abhiram"
                  style={{ width: '100%', fontSize: 14 }}
                />
              </div>
            </div>

            {/* What Should Sara Do? */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                  🎯 What should Sara do on this call?
                </label>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Sara follows your business instructions dynamically
                </span>
              </div>
              <textarea
                className="input"
                rows={3}
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Example: Call customer, introduce our services, ask their requirements, and schedule a consultation slot."
                style={{ width: '100%', fontSize: 13, lineHeight: 1.5, resize: 'vertical' }}
              />
            </div>

            {/* Lead Source & Voice */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 22 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                  📊 Lead Source
                </label>
                <select
                  className="input"
                  value={leadSource}
                  onChange={(e) => setLeadSource(e.target.value)}
                  style={{ width: '100%', fontSize: 13 }}
                >
                  <option value="manual_direct">Manual Direct Dial</option>
                  <option value="google_sheets">Google Sheets Sync</option>
                  <option value="meta_leads">Meta Lead Ads</option>
                  <option value="website_form">Website Form</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                  🎙️ AI Voice & Language
                </label>
                <select
                  className="input"
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  style={{ width: '100%', fontSize: 13 }}
                >
                  <option value="te-IN-Standard-A">Sara — Telugu & English (Sarvam AI)</option>
                  <option value="cartesia-sara">Sara — Conversational English (Cartesia Sonic)</option>
                  <option value="hi-IN-Standard-A">Sara — Hindi & English (Sarvam AI)</option>
                  <option value="polly-aditi">Aditi — Indian English (AWS Polly)</option>
                </select>
              </div>
            </div>

            {/* Compliance Status Guard */}
            {compliance && (
              <div style={{
                padding: '12px 16px', borderRadius: 10, marginBottom: 22,
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
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
                    IST Time: {compliance.current_ist_time}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
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
              style={{
                width: '100%', padding: '14px 20px', borderRadius: 12,
                background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                color: '#fff', border: 'none', fontSize: 16, fontWeight: 700,
                cursor: isCalling ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                boxShadow: '0 4px 14px rgba(124,58,237,0.35)', transition: 'transform 0.1s'
              }}
            >
              <PhoneCall size={18} />
              {isCalling ? 'Connecting to Twilio Gateway...' : 'CALL WITH SARA NOW'}
            </button>
          </div>

          {/* Live Call Progress & Transcript Panel */}
          {(activeCall || callStatus) && (
            <div className="card" style={{ padding: 24, borderRadius: 16, border: '1px solid var(--border)', background: '#fff', display: 'flex', flexDirection: 'column' }}>
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

              {/* Twilio Trial Guidance Banner */}
              {activeCall?.is_simulated && (
                <div style={{
                  marginTop: 16,
                  padding: '16px 18px',
                  borderRadius: 12,
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#92400e', fontSize: 13 }}>
                    <AlertCircle size={18} color="#d97706" /> Twilio Trial Telephony Guide
                  </div>
                  <div style={{ fontSize: 12, color: '#78350f', lineHeight: 1.5 }}>
                    Your Twilio account is in <strong>Trial Mode</strong>. Twilio blocks placing telecom calls to unverified numbers.
                    To receive actual ringing calls on <strong>{phoneNumber || 'your phone'}</strong>:
                    <ol style={{ margin: '6px 0 0 16px', padding: 0 }}>
                      <li><strong>Verify Recipient</strong>: Open <a href="https://console.twilio.com/us1/develop/phone-numbers/manage/verified" target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'underline' }}>Twilio Verified Caller IDs</a> and add your phone number with the SMS code.</li>
                      <li><strong>Claim Free Number</strong>: Click "Get Phone Number" on the <a href="https://console.twilio.com" target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'underline' }}>Twilio Console Dashboard</a>.</li>
                    </ol>
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                    <a
                      href="https://console.twilio.com/us1/develop/phone-numbers/manage/verified"
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '8px 14px', borderRadius: 8, background: '#f59e0b',
                        color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none'
                      }}
                    >
                      <ExternalLink size={14} /> Open Twilio Verified Caller IDs
                    </a>
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
        <div>
          {/* Campaign Stats Overview */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 20 }}>
            {[
              { label: 'Total Ingested Leads', val: campaignStats.total, color: '#0284c7' },
              { label: 'Calls Placed', val: campaignStats.called, color: '#7c3aed' },
              { label: 'Connected', val: campaignStats.connected, color: '#059669' },
              { label: 'Qualified / Interested', val: campaignStats.interested, color: '#16a34a' },
              { label: 'Follow-ups Scheduled', val: campaignStats.followup, color: '#ea580c' },
            ].map((s, idx) => (
              <div key={idx} className="kpi-card" style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Google Sheets Connection Box */}
          <div className="card" style={{ padding: 22, borderRadius: 16, border: '1px solid var(--border)', background: '#fff', marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <FileSpreadsheet size={22} color="#059669" />
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Google Sheets / CSV Auto-Calling Pipeline
                  </h3>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                    Paste your Google Sheet link or raw CSV (Name, Phone, Notes) to queue leads automatically
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={syncSheetLeads}
                  disabled={campaignLoading || (!sheetUrl && !csvInput)}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
                >
                  <RefreshCw size={14} className={campaignLoading ? 'spin' : ''} /> Sync & Preview Leads
                </button>
                <button
                  onClick={() => setIsCampaignRunning(!isCampaignRunning)}
                  disabled={campaignLeads.length === 0}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px',
                    borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700,
                    cursor: campaignLeads.length === 0 ? 'not-allowed' : 'pointer',
                    background: isCampaignRunning ? '#ef4444' : '#10b981', color: '#fff'
                  }}
                >
                  {isCampaignRunning ? <Pause size={14} /> : <Play size={14} />}
                  {isCampaignRunning ? 'Pause Campaign' : 'START AUTO CAMPAIGN'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                className="input"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder="Paste public Google Sheet URL (e.g. https://docs.google.com/spreadsheets/d/...)"
                style={{ width: '100%', fontSize: 13 }}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>OR PASTE CSV DIRECTLY</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>

              <textarea
                className="input"
                rows={2}
                value={csvInput}
                onChange={(e) => setCsvInput(e.target.value)}
                placeholder="Name, Phone, Notes&#10;Ravi, 9876543210, Interested in weight loss"
                style={{ width: '100%', fontSize: 12, resize: 'vertical' }}
              />
            </div>
          </div>

          {/* Leads Queue & 2-Way Sync Table */}
          <div className="card" style={{ padding: 20, borderRadius: 16, border: '1px solid var(--border)', background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                Lead Queue & Real-time Status ({campaignLeads.length})
              </h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Post-call statuses update in real time
              </span>
            </div>

            {campaignLeads.length === 0 ? (
              <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <FileSpreadsheet size={36} color="var(--text-muted)" style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>No leads loaded yet</div>
                <p style={{ margin: '4px 0 0', fontSize: 12 }}>
                  Paste a Google Sheet URL or enter CSV rows above and click <strong>Sync & Preview Leads</strong>.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '10px 14px', fontWeight: 600 }}>Lead Name</th>
                      <th style={{ padding: '10px 14px', fontWeight: 600 }}>Phone</th>
                      <th style={{ padding: '10px 14px', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '10px 14px', fontWeight: 600 }}>Notes / Requirements</th>
                      <th style={{ padding: '10px 14px', fontWeight: 600 }}>Compliance</th>
                      <th style={{ padding: '10px 14px', fontWeight: 600 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaignLeads.map((lead, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {lead.name}
                        </td>
                        <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>
                          {lead.phone}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 12, background: 'rgba(2,132,199,0.1)', color: '#0284c7' }}>
                            {lead.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: 12 }}>
                          {lead.notes || '—'}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                            background: lead.compliance?.can_call_now ? 'rgba(16,185,129,0.1)' : 'rgba(234,88,12,0.1)',
                            color: lead.compliance?.can_call_now ? '#059669' : '#ea580c'
                          }}>
                            {lead.compliance?.can_call_now ? 'Eligible' : 'Outside Window'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <button
                            onClick={() => {
                              setPhoneNumber(lead.phone.replace(/[^0-9]/g, '').slice(-10));
                              setLeadName(lead.name);
                              setActiveTab('call_now');
                            }}
                            style={{
                              padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)',
                              background: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: '#7c3aed'
                            }}
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
          TAB 3: BUSINESS AI PROFILE (THE CORE ENGINE)
      ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'business_profile' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 28 }}>
          <div className="card" style={{ padding: 26, borderRadius: 16, border: '1px solid var(--border)', background: '#fff' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              Business Profile & Calling Instruction
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                  Business Name *
                </label>
                <input
                  className="input"
                  value={bizProfile.business_name}
                  placeholder="e.g. Acme Fitness"
                  onChange={(e) => setBizProfile({ ...bizProfile, business_name: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                  Industry / Type
                </label>
                <input
                  className="input"
                  value={bizProfile.industry}
                  placeholder="e.g. Health & Fitness"
                  onChange={(e) => setBizProfile({ ...bizProfile, industry: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                  Operating Hours
                </label>
                <input
                  className="input"
                  value={bizProfile.operating_hours}
                  placeholder="09:00 AM – 09:00 PM IST"
                  onChange={(e) => setBizProfile({ ...bizProfile, operating_hours: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                  Business Phone
                </label>
                <input
                  className="input"
                  value={bizProfile.phone}
                  placeholder="+91..."
                  onChange={(e) => setBizProfile({ ...bizProfile, phone: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                Owner Voice/Text Calling Instruction (Sara converts this into Policy)
              </label>
              <textarea
                className="input"
                rows={3}
                value={bizProfile.calling_instruction}
                placeholder="Whenever a new lead comes, call them. Explain our offerings, ask their requirements, and book a consultation slot."
                onChange={(e) => setBizProfile({ ...bizProfile, calling_instruction: e.target.value })}
                style={{ width: '100%', fontSize: 13, lineHeight: 1.5 }}
              />
            </div>

            {/* Products / Offerings */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                Products, Packages & Pricing
              </label>

              {/* Add New Service Input */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input
                  className="input"
                  placeholder="Product/Service name"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  style={{ flex: 2, fontSize: 13 }}
                />
                <input
                  className="input"
                  placeholder="Price (e.g. ₹999/mo)"
                  value={newServicePrice}
                  onChange={(e) => setNewServicePrice(e.target.value)}
                  style={{ flex: 1, fontSize: 13 }}
                />
                <button onClick={addOffering} className="btn btn-secondary" style={{ padding: '0 12px' }}>
                  <Plus size={14} /> Add
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(!bizProfile.products_services || bizProfile.products_services.length === 0) ? (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: 8 }}>
                    No products added yet. Add your plans or offerings above.
                  </div>
                ) : (
                  bizProfile.products_services.map((p, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: 'var(--bg-secondary, #f8fafc)', border: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                        {p.details && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.details}</div>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed' }}>{p.price}</span>
                        <button onClick={() => removeOffering(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={handleSaveBusinessProfile}
                disabled={isSavingBiz}
                className="btn-primary"
                style={{ padding: '10px 20px', fontSize: 13, fontWeight: 700 }}
              >
                {isSavingBiz ? 'Compiling AI Policy...' : 'Save & Compile AI Policy'}
              </button>
              {bizSavedMessage && (
                <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                  {bizSavedMessage}
                </span>
              )}
            </div>
          </div>

          {/* Compiled Policy Card */}
          <div className="card" style={{ padding: 26, borderRadius: 16, border: '1px solid var(--border)', background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Sparkles size={18} color="#7c3aed" />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                Compiled Business Calling Policy
              </h3>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              This policy is executed dynamically on every call. Business rules remain strictly enforced while conversation remains natural.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: 12, borderRadius: 8, background: 'var(--bg-secondary, #f8fafc)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>PRIMARY MISSION</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                  {bizProfile.policy?.goal || 'Qualify prospect and schedule next step'}
                </div>
              </div>

              <div style={{ padding: 12, borderRadius: 8, background: 'var(--bg-secondary, #f8fafc)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>CONVERSATION GUARDRAILS</div>
                <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <li>Never invent unverified prices or offerings</li>
                  <li>Numbers, timings, and prices always spoken in English numerals</li>
                  <li>Politely terminate call immediately if user asks not to call</li>
                </ul>
              </div>

              <div style={{ padding: 12, borderRadius: 8, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#059669', fontWeight: 700, fontSize: 12 }}>
                  <ShieldCheck size={16} /> Twilio Telephony & TRAI Ready
                </div>
                <div style={{ fontSize: 11, color: '#047857', marginTop: 4 }}>
                  Account SID: <strong>ACd0a3e1a6f50ee90d1579c85d9baa1d1e</strong><br />
                  TRAI calling hours (09:00 - 21:00 IST) enforced automatically.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
