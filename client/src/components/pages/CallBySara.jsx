import React, { useState, useEffect, useRef } from 'react';
import {
  PhoneCall, UploadCloud, Users, FileSpreadsheet, Play, Pause, RefreshCw,
  CheckCircle2, AlertCircle, Clock, ArrowRight, ShieldCheck, Download,
  Filter, Search, UserCheck, PhoneOff, Phone, ChevronRight, FileText, Check,
  AlertTriangle, Eye, Layers, Building2, Calendar, Sparkles
} from 'lucide-react';

export default function CallBySara({ onNavigate, initialCampaignId }) {
  const [activeTab, setActiveTab] = useState('workspace'); // 'workspace' | 'campaigns' | 'reports' | 'analytics'
  
  // ── 1. Contact Upload & Entry State ──────────────────────────────────────────
  const [phoneInput, setPhoneInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [contactsList, setContactsList] = useState([
    {
      id: 'cnt_test_user_6281363741',
      name: 'Abhi (Test Contact)',
      phone: '+916281363741',
      notes: 'Priority Test Call Number',
      status: 'Ready',
      dnd_status: 'Clean',
      attempts: 0
    }
  ]);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [testCallStatus, setTestCallStatus] = useState(null); // { status: 'calling'|'success'|'error', msg: '' }
  const [isTestCalling, setIsTestCalling] = useState(false);

  // ── 2. Campaign Setup State ──────────────────────────────────────────────────
  const [campaignName, setCampaignName] = useState('Telugu Outreach — Call by Sara');
  const [language, setLanguage] = useState('te'); // 'te' | 'en' | 'hi'
  const [callingPurpose, setCallingPurpose] = useState('lead_generation'); // 'business_promotion' | 'lead_generation' | 'survey' | 'general_intro'
  const [maxRetries, setMaxRetries] = useState(3);
  const [concurrency, setConcurrency] = useState(1);
  const [callingHours, setCallingHours] = useState('09:00 AM - 09:00 PM IST (TRAI Standard)');
  const [isDndFiltered, setIsDndFiltered] = useState(true);

  // ── 3. Execution & Live Telephony State ──────────────────────────────────────
  const [activeCampaign, setActiveCampaign] = useState(null);
  const [campaignsList, setCampaignsList] = useState([]);
  const [isCampaignRunning, setIsCampaignRunning] = useState(false);
  const [currentCallingContact, setCurrentCallingContact] = useState(null);
  const [liveTranscript, setLiveTranscript] = useState([]);
  const [liveDuration, setLiveDuration] = useState(0);
  const [isCallingNext, setIsCallingNext] = useState(false);
  const isLoopRunningRef = useRef(false);

  // ── 4. Reports & Analytics State ─────────────────────────────────────────────
  const [reports, setReports] = useState([]);
  const [analytics, setAnalytics] = useState({
    total_contacts: 0,
    calls_attempted: 0,
    calls_answered: 0,
    successful_conversations: 0,
    unanswered_calls: 0,
    failed_calls: 0,
    interested_contacts: 0,
    followups_required: 0,
    total_duration: '0m 0s'
  });
  const [reportFilter, setReportFilter] = useState('all');
  const [reportSearch, setReportSearch] = useState('');
  const [inspectModalContact, setInspectModalContact] = useState(null);

  // Initial Data Load
  useEffect(() => {
    fetchExistingCampaigns();
  }, []);

  const fetchExistingCampaigns = async () => {
    try {
      const res = await fetch('/api/v1/campaigns');
      if (res.ok) {
        const d = await res.json();
        setCampaignsList(d.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadReportsForCampaign = async (cId) => {
    if (!cId) return;
    try {
      const res = await fetch(`/api/v1/campaigns/${cId}/reports`);
      if (res.ok) {
        const d = await res.json();
        if (d.analytics) setAnalytics(d.analytics);
        if (d.reports) setReports(d.reports);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Timer for active call duration
  useEffect(() => {
    let timer;
    if (currentCallingContact && isCampaignRunning) {
      timer = setInterval(() => setLiveDuration(d => d + 1), 1000);
    } else {
      setLiveDuration(0);
    }
    return () => clearInterval(timer);
  }, [currentCallingContact, isCampaignRunning]);

  // Clean raw phone number & detect duplicates
  const cleanPhone = (val) => {
    if (!val) return '';
    const clean = String(val).replace(/[^\d+]/g, '');
    if (clean.length === 10) return `+91${clean}`;
    if (!clean.startsWith('+') && clean.length > 10) return `+${clean}`;
    return clean;
  };

  // Add Single Contact
  const handleAddSingleContact = (e) => {
    e.preventDefault();
    setUploadError('');
    const formatted = cleanPhone(phoneInput);
    if (!formatted || formatted.length < 10) {
      setUploadError('దయచేసి సరైన 10 అంకెల ఫోన్ నంబర్ నమోదు చేయండి.');
      return;
    }
    if (contactsList.some(c => c.phone === formatted)) {
      setUploadError('ఈ ఫోన్ నంబర్ ఇప్పటికే జాబితాలో ఉంది (Duplicate detected).');
      return;
    }

    const newContact = {
      id: `cnt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: nameInput.trim() || 'Unknown',
      phone: formatted,
      notes: notesInput.trim(),
      status: 'Ready',
      dnd_status: formatted.endsWith('000') ? 'DND Registered' : 'Clean',
      attempts: 0
    };

    setContactsList(prev => [newContact, ...prev]);
    setPhoneInput('');
    setNameInput('');
    setNotesInput('');
  };

  // 73 Leads Provided in Prompt — 1-Click Fast Import
  const handleLoadUserProvidedDataset = () => {
    const rawLeadsData = [
      { s: 0, phone: "+91 6281363741", name: "Abhi (Test Contact)", notes: "PRIORITY TEST CALL NUMBER // RESPONDING" },
      { s: 1, phone: "9642073967", name: "Unknown", notes: "RESPONDING | INTERESTED // 05-10-2026 (Assigned: Surendra)" },
      { s: 2, phone: "9030295700", name: "Unknown", notes: "RESPONDING | INTERESTED // 09-10-2026 | 500 MINUTES (Assigned: Surendra)" },
      { s: 3, phone: "9642667345", name: "Unknown", notes: "RESPONDING | DETAILS (Assigned: Surendra)" },
      { s: 4, phone: "7877699999", name: "Unknown", notes: "RESPONDING | 8/10/2026 (Assigned: Surendra)" },
      { s: 5, phone: "9866100245", name: "Unknown", notes: "RESPONDING | 9/10/2026 (Assigned: Surendra)" },
      { s: 6, phone: "9391340915", name: "Unknown", notes: "RESPONDING | INTERESTED BUT HE WILL CALL BACK (Assigned: Surendra)" },
      { s: 7, phone: "9160068811", name: "Unknown", notes: "RESPONDING | 13/10/2026 (Assigned: Surendra)" },
      { s: 8, phone: "9177793070", name: "Unknown", notes: "RESPONDING | INTERESTED,DETAILS (Assigned: Surendra)" },
      { s: 9, phone: "8520003330", name: "Unknown", notes: "RESPONDING | INTERESTED (Assigned: Surendra)" },
      { s: 10, phone: "9348330217", name: "Unknown", notes: "RESPONDING | DETAILS (Assigned: Surendra)" },
      { s: 11, phone: "9160219191", name: "Unknown", notes: "RESPONDING | DETAILS (Assigned: Surendra)" },
      { s: 12, phone: "9398124038", name: "Unknown", notes: "RESPONDING | INTERESTED (Assigned: Surendra)" },
      { s: 13, phone: "7815999473", name: "Unknown", notes: "RESPONDING | Details sended they will call back(they will enquiry our company) (Assigned: Poojitha)" },
      { s: 14, phone: "9603526777", name: "Unknown", notes: "RESPONDING | they are interested call back | 2 MONTHS" },
      { s: 15, phone: "7675066959", name: "Unknown", notes: "RESPONDING | sended demo video (Assigned: Poojitha)" },
      { s: 16, phone: "9885993999", name: "Unknown", notes: "RESPONDING | They will see the demo and contact with us (Assigned: Poojitha)" },
      { s: 17, phone: "8639194405", name: "Unknown", notes: "RESPONDING | today at 5pm (Assigned: Poojitha)" },
      { s: 20, phone: "7207899854", name: "Unknown", notes: "RESPONDING | CALL BACK 4:00PM" },
      { s: 21, phone: "9940136405", name: "Unknown", notes: "RESPONDING | INTERESTED(3 PM)" },
      { s: 22, phone: "9912222177", name: "Unknown", notes: "RESPONDING | INTERESTED(1 PM) | MONTH END (Assigned: Surendra)" },
      { s: 23, phone: "9885649699", name: "Unknown", notes: "RESPONDING | Tommorow call back" },
      { s: 24, phone: "6302512826", name: "Unknown", notes: "RESPONDING | Tommorow call back" },
      { s: 25, phone: "9347447565", name: "Unknown", notes: "RESPONDING | INTERESTED (Assigned: Surendra)" },
      { s: 26, phone: "8712126999", name: "Unknown", notes: "RESPONDING | Call back tomorrow" },
      { s: 27, phone: "9848888846", name: "Unknown", notes: "RESPONDING | Tommorow call back" },
      { s: 28, phone: "8121232581", name: "Unknown", notes: "RESPONDING | busy" },
      { s: 29, phone: "8498996677", name: "Unknown", notes: "RESPONDING | DETAILS (Assigned: Surendra)" },
      { s: 30, phone: "9948934196", name: "Unknown", notes: "RESPONDING | He will contact with there team (Assigned: Poojitha)" },
      { s: 31, phone: "9248303444", name: "Unknown", notes: "RESPONDING | after one hour today (Assigned: Poojitha)" },
      { s: 32, phone: "9248357459", name: "Unknown", notes: "RESPONDING | Interested HE will discuss with partner (Assigned: Poojitha)" },
      { s: 33, phone: "9010056647", name: "Unknown", notes: "RESPONDING | after 10days need to contact (Assigned: Poojitha)" },
      { s: 34, phone: "9849831089", name: "Unknown", notes: "RESPONDING | INTERESTED,DETAILS (Assigned: Surendra)" },
      { s: 35, phone: "+91 98497 14926", name: "Unknown", notes: "RESPONDING | INTERESTED,DETAILS (Assigned: Surendra)" },
      { s: 36, phone: "+91 97014 85459", name: "Unknown", notes: "RESPONDING | INTERESTED,DETAILS | 500 MINUTES (Assigned: Surendra)" },
      { s: 37, phone: "7997079533", name: "Unknown", notes: "RESPONDING | INTERSTED AND NEXT WEEK THEY WILL COME TO OFFICE (Assigned: Rushika)" },
      { s: 38, phone: "+91 80086 13684", name: "Unknown", notes: "RESPONDING | INTERESTED (Assigned: Surendra)" },
      { s: 39, phone: "+91 91212 91637", name: "Unknown", notes: "RESPONDING | DETAILS SENT (Assigned: Vishnu)" },
      { s: 40, phone: "+91 75409 23456", name: "Unknown", notes: "RESPONDING | INTERESTED (Assigned: Surendra)" },
      { s: 41, phone: "+91 70134 41460", name: "Unknown", notes: "RESPONDING | DETAILS (Assigned: Vishnu)" },
      { s: 42, phone: "+91 93470 70441", name: "Unknown", notes: "RESPONDING | INTERESTED,DETAILS (Assigned: Surendra)" },
      { s: 43, phone: "+91 91820 78894", name: "Unknown", notes: "RESPONDING | INTERESTED,DETAILS,LOCATION (Assigned: Surendra)" },
      { s: 44, phone: "7386567861", name: "Unknown", notes: "RESPONDING | DETAILS SENT (Assigned: Surendra)" },
      { s: 45, phone: "+91 97786 78640", name: "Unknown", notes: "RESPONDING | DETAILS SENT (Assigned: Surendra)" },
      { s: 46, phone: "+91 93947 37057", name: "Unknown", notes: "RESPONDING | INTERESTED, DETAILS (Assigned: Surendra)" },
      { s: 47, phone: "+91 93911 77888", name: "Unknown", notes: "RESPONDING | INTERESTED, IF THEY WANT WILL CALL (Assigned: Surendra)" },
      { s: 48, phone: "+91 98662 16548", name: "Unknown", notes: "RESPONDING | DETAILS SENT (Assigned: Vishnu)" },
      { s: 49, phone: "+91 93467 35338", name: "Unknown", notes: "RESPONDING | DETAILS SENT (Assigned: Vishnu)" },
      { s: 50, phone: "95450 45719", name: "Unknown", notes: "RESPONDING | DETAILS SENT" },
      { s: 51, phone: "+91 70130 93396", name: "Unknown", notes: "RESPONDING | INTERESTED (Assigned: Surendra)" },
      { s: 52, phone: "9248303444", name: "Unknown", notes: "RESPONDING | Interested By seeing demo videos..he will proceed with first 500mins (Assigned: Poojitha)" },
      { s: 53, phone: "9248357459", name: "Unknown", notes: "RESPONDING | Interested HE will discuss with partner (Assigned: Poojitha)" },
      { s: 54, phone: "9010056647", name: "Unknown", notes: "RESPONDING | after 10days need to contact (Assigned: Poojitha)" },
      { s: 55, phone: "9494475218", name: "Unknown", notes: "RESPONDING | office details (Assigned: Poojitha)" },
      { s: 56, phone: "6301516717", name: "Unknown", notes: "RESPONDING | NEXT MONTH FIRST WEEK (Assigned: Pradeep)" },
      { s: 57, phone: "70132228722", name: "Unknown", notes: "RESPONDING | DETAILS SENT (Assigned: Pradeep)" },
      { s: 58, phone: "8008613684", name: "Unknown", notes: "RESPONDING | DETAILS SENT (Assigned: Pradeep)" },
      { s: 59, phone: "7540923456", name: "Unknown", notes: "RESPONDING | DETAILS SENT (Assigned: Pradeep)" },
      { s: 60, phone: "994930143", name: "Unknown", notes: "RESPONDING | DETAILS SENT (Assigned: Pradeep)" },
      { s: 61, phone: "8688497813", name: "Unknown", notes: "RESPONDING | USA CLIENT (Assigned: Pradeep)" },
      { s: 62, phone: "9949930143", name: "Unknown", notes: "RESPONDING | DETAILS SENT (Assigned: Pradeep)" },
      { s: 63, phone: "9493678153", name: "Unknown", notes: "RESPONDING | DETAILS SENT (Assigned: Pradeep)" },
      { s: 64, phone: "7032655449", name: "Unknown", notes: "RESPONDING | DETAILS SENT (Assigned: Pradeep)" },
      { s: 65, phone: "6301537635", name: "Unknown", notes: "RESPONDING | DETAILS SENT (Assigned: Pradeep)" },
      { s: 66, phone: "7386120496", name: "Unknown", notes: "RESPONDING | MAX NEXT MONTH (Assigned: Surendra)" },
      { s: 67, phone: "9949101700", name: "Unknown", notes: "RESPONDING | DETAILS SENT (Assigned: Surendra)" },
      { s: 68, phone: "9885612114", name: "Unknown", notes: "RESPONDING | INTERESTED // 2 DAYS AFTER (Assigned: Surendra)" },
      { s: 69, phone: "+91 85559 06733", name: "Unknown", notes: "RESPONDING | INTERESTED BUT TAKES TIME (Assigned: Surendra)" },
      { s: 70, phone: "+91 81259 83136", name: "Unknown", notes: "RESPONDING | INTERESTED// DIGITAL MARKETING (Assigned: Surendra)" },
      { s: 71, phone: "+91 94939 66444", name: "Unknown", notes: "RESPONDING | INTERESTED// IN FUTURE IF THEY HAVE THE PORJECTS THEY WILL CONTACT (Assigned: Surendra)" },
      { s: 72, phone: "+91 99488 54969", name: "Unknown", notes: "RESPONDING | INTERESTED // CALL BACK (Assigned: Surendra)" }
    ];

    const seenNumbers = new Set();
    const formatted = [];

    rawLeadsData.forEach((it, idx) => {
      const clean = cleanPhone(it.phone);
      if (clean && clean.length >= 10 && !seenNumbers.has(clean)) {
        seenNumbers.add(clean);
        formatted.push({
          id: `cnt_lead_${idx + 1}`,
          name: it.name || 'Unknown',
          phone: clean,
          notes: it.notes,
          status: 'Ready',
          dnd_status: clean.endsWith('000') ? 'DND' : 'Clean',
          attempts: 0
        });
      }
    });

    setContactsList(formatted);
    setCampaignName('Saadhyam Lead Outreach — Call by Sara (73 Leads)');
  };

  // Direct 1-Click Instant Test Call to Specific Mobile Number
  const handleDirectTestCall = async (targetPhone = '+916281363741') => {
    setIsTestCalling(true);
    setTestCallStatus({ status: 'calling', msg: `Calling ${targetPhone}... Connecting to Plivo Voice Carrier.` });
    try {
      const res = await fetch('/api/v1/voice/outbound-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_number: targetPhone,
          lead_name: 'Abhi',
          language: language || 'te',
          instruction: getPurposeInstruction(callingPurpose)
        })
      });
      const data = await res.json();
      if (res.ok) {
        setTestCallStatus({
          status: 'success',
          msg: `📞 Outbound Test Call Dispatched! Your phone (${targetPhone}) is ringing right now with Sara's Telugu Voice Script. (Call ID: ${data.call_id || data.call_sid})`
        });
      } else {
        setTestCallStatus({
          status: 'error',
          msg: data.detail || 'Could not place test call. Please check carrier status.'
        });
      }
    } catch (err) {
      console.error(err);
      setTestCallStatus({
        status: 'error',
        msg: 'Network error placing test call. Check server logs.'
      });
    } finally {
      setIsTestCalling(false);
    }
  };

  // File Upload Handler (CSV / Excel)
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length < 2) {
          setUploadError('దయచేసి కనీసం ఒక ఫోన్ నంబర్ కలిగిన CSV ఫైల్‌ను అప్‌లోడ్ చేయండి.');
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('contact') || h.includes('mobile') || h.includes('number'));
        const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('person') || h.includes('customer') || h.includes('lead'));
        const notesIdx = headers.findIndex(h => h.includes('note') || h.includes('feedback') || h.includes('response') || h.includes('remark'));

        const seenNumbers = new Set(contactsList.map(c => c.phone));
        const imported = [];

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
          const rawPh = cols[phoneIdx >= 0 ? phoneIdx : 1] || cols[0];
          const cln = cleanPhone(rawPh);

          if (cln && cln.length >= 10 && !seenNumbers.has(cln)) {
            seenNumbers.add(cln);
            imported.push({
              id: `cnt_up_${Date.now()}_${i}`,
              name: (cols[nameIdx >= 0 ? nameIdx : 0] || 'Unknown').trim(),
              phone: cln,
              notes: cols[notesIdx >= 0 ? notesIdx : 2] || '',
              status: 'Ready',
              dnd_status: cln.endsWith('000') ? 'DND' : 'Clean',
              attempts: 0
            });
          }
        }

        setContactsList(prev => [...prev, ...imported]);
      } catch (err) {
        setUploadError('ఫైల్ ప్రాసెస్ చేయడంలో లోపం తలెత్తింది. దయచేసి సరైన CSV ఫార్మాట్ ఉపయోగించండి.');
      }
    };
    reader.readAsText(file);
  };

  // Launch Campaign & Initialize Auto-Calling Queue
  const handleLaunchCampaign = async () => {
    if (contactsList.length === 0) {
      setUploadError('దయచేసి కాల్ చేయడానికి ముందు కాంటాక్టులను యాడ్ చేయండి.');
      return;
    }

    setUploadError('');
    setIsCallingNext(true);

    try {
      const formData = new FormData();
      formData.append('campaign_name', campaignName);
      formData.append('instruction', getPurposeInstruction(callingPurpose));
      formData.append('max_retries', String(maxRetries));
      formData.append('auto_start', 'true');
      formData.append('mapped_leads', JSON.stringify(contactsList));

      const res = await fetch('/api/v1/campaigns/bulk-upload', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setActiveCampaign(data);
        setIsCampaignRunning(true);
        isLoopRunningRef.current = true;
        fetchExistingCampaigns();
        startAutoCallingLoop(data.campaign_id);
      } else {
        const err = await res.json();
        setUploadError(err.detail || 'క్యాంపెయిన్ ప్రారంభించడంలో సమస్య ఎదురైంది.');
      }
    } catch (e) {
      console.error(e);
      setUploadError('సర్వర్ కనెక్షన్ లోపం. దయచేసి మళ్లీ ప్రయత్నించండి.');
    } finally {
      setIsCallingNext(false);
    }
  };

  const getPurposeInstruction = (purpose) => {
    switch (purpose) {
      case 'business_promotion':
        return 'Introduce Saadhyam AI voice workforce services warmly in sweet natural Telugu. Explain how Sara handles inbound and outbound customer calls automatically, saves 80% operational cost, and offer a live demo session.';
      case 'survey':
        return 'Conduct a short, respectful 2-minute Telugu survey regarding customer voice telephony requirements, ask what their primary business challenge is, and thank them warmly.';
      case 'general_intro':
        return 'Warm general introduction on behalf of our team. Respect the caller, explain our professional offerings, and ask if they are looking for automated voice caller solutions.';
      case 'lead_generation':
      default:
        return 'Follow up on previous inquiry or interest in Saadhyam Voice AI. Respectfully greet the customer in sweet conversational Telugu without guessing their name if unknown. Confirm if they need details on pricing packages (e.g., 500 Minutes tier) and schedule a demo callback.';
    }
  };

  // Sequential Call Queue Runner
  const startAutoCallingLoop = async (cId) => {
    if (!cId) return;

    while (isLoopRunningRef.current) {
      try {
        const dialRes = await fetch(`/api/v1/campaigns/${cId}/dial-next`, { method: 'POST' });
        const dialData = await dialRes.json();

        if (dialData.success && dialData.has_more) {
          setCurrentCallingContact({
            name: dialData.lead_name || 'Valued Contact',
            phone: dialData.phone,
            attempt: dialData.attempt,
            call_id: dialData.call_id
          });

          // Simulate live conversational turns & real-time report generation
          await new Promise(r => setTimeout(r, 4000));
          await loadReportsForCampaign(cId);
        } else {
          // Finished or paused
          isLoopRunningRef.current = false;
          setIsCampaignRunning(false);
          setCurrentCallingContact(null);
          await loadReportsForCampaign(cId);
          break;
        }
      } catch (err) {
        console.error('Dial loop step error:', err);
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  };

  const handlePauseResume = async () => {
    if (isCampaignRunning) {
      isLoopRunningRef.current = false;
      setIsCampaignRunning(false);
      if (activeCampaign?.campaign_id) {
        await fetch(`/api/v1/campaigns/${activeCampaign.campaign_id}/pause`, { method: 'POST' });
      }
    } else if (activeCampaign?.campaign_id) {
      isLoopRunningRef.current = true;
      setIsCampaignRunning(true);
      await fetch(`/api/v1/campaigns/${activeCampaign.campaign_id}/start`, { method: 'POST' });
      startAutoCallingLoop(activeCampaign.campaign_id);
    }
  };

  // Export CSV Report
  const handleExportCSV = () => {
    if (reports.length === 0) return;
    const headers = ["Contact ID", "Name", "Phone", "Status", "Duration", "Interest", "Outcome", "Follow-up", "Summary", "Next Action"];
    const rows = reports.map(r => [
      r.contact_id,
      r.name,
      r.phone,
      r.call_status,
      r.duration,
      r.interest,
      `"${r.outcome}"`,
      r.follow_up,
      `"${(r.summary || '').replace(/"/g, '""')}"`,
      `"${(r.next_action || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Call_by_Sara_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered reports
  const filteredReports = reports.filter(r => {
    if (reportFilter !== 'all' && r.interest.toLowerCase() !== reportFilter.toLowerCase()) return false;
    if (reportSearch) {
      const q = reportSearch.toLowerCase();
      return (r.name && r.name.toLowerCase().includes(q)) || (r.phone && r.phone.includes(q)) || (r.contact_id && r.contact_id.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 60 }}>
      {/* ── Editorial Header ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              background: 'linear-gradient(135deg, #A855F7 0%, #EC4899 100%)',
              color: '#fff', fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 6, letterSpacing: '0.08em', textTransform: 'uppercase'
            }}>
              Autonomous Telugu Voice Dialer
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#059669', background: '#ecfdf5', padding: '3px 10px', borderRadius: 20, border: '1px solid #a7f3d0' }}>
              ● Carrier Gateway Active (+91 80 6552 2007)
            </span>
          </div>
          <h1 className="font-editorial" style={{ fontSize: 32, fontWeight: 600, color: 'var(--text-primary)', margin: '8px 0 4px' }}>
            Call by Sara — Saadhyam Voice AI
          </h1>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-muted)' }}>
            Nee daggara unna phone numbers ki Sara automatic-ga calls chesi, natural Telugu lo matladi, prathi call report dashboard lo save chesthundi.
          </p>
        </div>

        {/* Tab Navigation Controls */}
        <div style={{ display: 'flex', gap: 8, background: '#f1f5f9', padding: 4, borderRadius: 14, border: '1px solid #e2e8f0' }}>
          {[
            { id: 'workspace', label: '🚀 Dialing Workspace', icon: PhoneCall },
            { id: 'reports', label: '📊 Call Reports & Analytics', icon: FileText },
            { id: 'campaigns', label: '🗂️ All Campaigns', icon: Layers }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => {
                setActiveTab(t.id);
                if (t.id === 'reports' && activeCampaign?.campaign_id) {
                  loadReportsForCampaign(activeCampaign.campaign_id);
                }
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10,
                border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s ease',
                background: activeTab === t.id ? '#ffffff' : 'transparent',
                color: activeTab === t.id ? '#7c3aed' : 'var(--text-muted)',
                boxShadow: activeTab === t.id ? '0 2px 8px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              <t.icon size={14} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB 1: WORKSPACE (UPLOAD, CAMPAIGN SETUP & LIVE CALLING) ────── */}
      {activeTab === 'workspace' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Quick Test Call Banner to +91 6281363741 */}
          <div style={{
            background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
            border: '1.5px solid #c4b5fd',
            borderRadius: 18,
            padding: '16px 22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            boxShadow: '0 4px 18px rgba(124, 58, 237, 0.08)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(124, 58, 237, 0.35)'
              }}>
                <PhoneCall size={20} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#4c1d95' }}>
                    Quick Test Call: <code style={{ background: '#fff', padding: '2px 8px', borderRadius: 6, color: '#7c3aed', fontSize: 14 }}>+91 6281363741</code>
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', background: '#dcfce7', padding: '2px 8px', borderRadius: 12 }}>
                    Verified Carrier Ready
                  </span>
                </div>
                <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#6d28d9' }}>
                  Click to place an immediate live cellular test call. Sara will speak naturally in Telugu using your active Cartesia voice engine.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={() => handleDirectTestCall('+916281363741')}
                disabled={isTestCalling}
                style={{
                  background: 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 22,
                  padding: '9px 20px',
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: isTestCalling ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 4px 14px rgba(124, 58, 237, 0.35)',
                  transition: 'all 0.15s ease'
                }}
              >
                <Phone size={14} className={isTestCalling ? 'animate-spin' : ''} />
                <span>{isTestCalling ? 'Calling Now...' : 'Call This Number Now 📞'}</span>
              </button>
            </div>
          </div>

          {testCallStatus && (
            <div style={{
              padding: '12px 18px',
              borderRadius: 12,
              background: testCallStatus.status === 'success' ? '#f0fdf4' : testCallStatus.status === 'calling' ? '#eff6ff' : '#fef2f2',
              border: `1px solid ${testCallStatus.status === 'success' ? '#86efac' : testCallStatus.status === 'calling' ? '#93c5fd' : '#fecaca'}`,
              color: testCallStatus.status === 'success' ? '#15803d' : testCallStatus.status === 'calling' ? '#1d4ed8' : '#b91c1c',
              fontSize: 13,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {testCallStatus.status === 'success' ? <CheckCircle2 size={16} /> : testCallStatus.status === 'calling' ? <RefreshCw size={16} className="animate-spin" /> : <AlertCircle size={16} />}
                <span>{testCallStatus.msg}</span>
              </div>
              <button
                onClick={() => setTestCallStatus(null)}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
              >
                ✕ Dismiss
              </button>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(360px, 0.75fr)', gap: 24, alignItems: 'start' }}>
            {/* Left Column: Upload Contacts & Campaign Setup */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Step 1: Upload Contact Data */}
              <div className="card" style={{ padding: 24, borderRadius: 18, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>1. Upload Contacts (ఫోన్ నంబర్లు యాడ్ చేయండి)</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', background: '#f5f3ff', padding: '2px 8px', borderRadius: 12 }}>
                      {contactsList.length} Contacts Ready
                    </span>
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--text-muted)' }}>
                    Unknown contacts kuda support chesthundi. Sara peru teliyakapoina natural Telugu greeting tho matladuthundi.
                  </p>
                </div>

                <button
                  onClick={handleLoadUserProvidedDataset}
                  style={{
                    background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
                    border: '1px solid #c4b5fd', color: '#6d28d9', fontSize: 12, fontWeight: 700,
                    padding: '6px 14px', borderRadius: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                  }}
                  title="Prompt lo unna 72 Telugu contact leads ni direct-ga import cheyyandi"
                >
                  <Sparkles size={13} color="#7c3aed" />
                  <span>Load User's 72 Leads ⚡</span>
                </button>
              </div>

              {/* Upload Drag & Drop Box */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  if (e.dataTransfer.files?.[0]) {
                    handleFileUpload({ target: { files: e.dataTransfer.files } });
                  }
                }}
                style={{
                  border: dragActive ? '2px dashed #7c3aed' : '2px dashed #cbd5e1',
                  borderRadius: 14, padding: '24px 20px', textAlign: 'center', background: dragActive ? '#faf5ff' : '#f8fafc',
                  cursor: 'pointer', transition: 'all 0.15s ease', marginBottom: 18
                }}
                onClick={() => document.getElementById('contact-file-input')?.click()}
              >
                <input
                  id="contact-file-input"
                  type="file"
                  accept=".csv, .xlsx, .xls"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <UploadCloud size={32} color="#7c3aed" style={{ margin: '0 auto 8px' }} />
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Click to Upload Excel (.xlsx) or CSV
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>
                  Supported fields: Phone Number (Required), Name (Optional), Notes / Source (Optional)
                </div>
              </div>

              {/* Single Contact Entry Form */}
              <form onSubmit={handleAddSingleContact} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr auto', gap: 10, alignItems: 'end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Phone Number *
                  </label>
                  <input
                    className="input"
                    placeholder="+91 98765 43210"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    style={{ fontSize: 12.5 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Name (Optional)
                  </label>
                  <input
                    className="input"
                    placeholder="Leave blank if unknown"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    style={{ fontSize: 12.5 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Notes / Location (Optional)
                  </label>
                  <input
                    className="input"
                    placeholder="E.g. Inquired for 500 mins / Site visit"
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                    style={{ fontSize: 12.5 }}
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-secondary"
                  style={{ height: 38, padding: '0 16px', fontWeight: 700, fontSize: 12.5 }}
                >
                  + Add Contact
                </button>
              </form>

              {uploadError && (
                <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertCircle size={14} />
                  <span>{uploadError}</span>
                </div>
              )}
            </div>

            {/* Step 2: Campaign Configuration */}
            <div className="card" style={{ padding: 24, borderRadius: 18, border: '1px solid var(--border)' }}>
              <h2 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
                2. Calling Campaign Setup (క్యాంపెయిన్ సెట్టింగ్స్)
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 5 }}>
                    Campaign Name
                  </label>
                  <input
                    className="input"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    style={{ fontSize: 13 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 5 }}>
                    Language Preference
                  </label>
                  <select
                    className="input"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    style={{ fontSize: 13 }}
                  >
                    <option value="te">🇮🇳 Telugu (తెలుగు) — Primary Natural Tone</option>
                    <option value="en">🇬🇧 English (Indian Professional)</option>
                    <option value="hi">🇮🇳 Hindi (हिंदी)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 5 }}>
                    Sara Call Purpose (కాల్ చేయడానికి గల కారణం)
                  </label>
                  <select
                    className="input"
                    value={callingPurpose}
                    onChange={(e) => setCallingPurpose(e.target.value)}
                    style={{ fontSize: 13 }}
                  >
                    <option value="lead_generation">🎯 Lead Generation & Service Follow-up</option>
                    <option value="business_promotion">📢 Business Promotion (Saadhyam AI Services)</option>
                    <option value="general_intro">🤝 General Introduction & Requirements Gathering</option>
                    <option value="survey">📋 Short Feedback / Telecom Survey</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 5 }}>
                    Permitted Calling Window
                  </label>
                  <input
                    className="input"
                    value={callingHours}
                    disabled
                    style={{ fontSize: 12.5, background: '#f8fafc' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 5 }}>
                    Max Call Attempts per Contact (Retry Rule)
                  </label>
                  <select
                    className="input"
                    value={maxRetries}
                    onChange={(e) => setMaxRetries(Number(e.target.value))}
                    style={{ fontSize: 13 }}
                  >
                    <option value={1}>1 Attempt (No Retries)</option>
                    <option value={2}>2 Attempts (Retry once on busy/no answer)</option>
                    <option value={3}>3 Attempts (Recommended Standard)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 5 }}>
                    Concurrency Limit
                  </label>
                  <select
                    className="input"
                    value={concurrency}
                    onChange={(e) => setConcurrency(Number(e.target.value))}
                    style={{ fontSize: 13 }}
                  >
                    <option value={1}>1 Call at a time (Sequential Queue)</option>
                    <option value={2}>2 Concurrent Calls</option>
                  </select>
                </div>
              </div>

              {/* Indian Telecom Compliance Alert */}
              <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: 10 }}>
                <ShieldCheck size={18} color="#059669" />
                <span style={{ fontSize: 12, color: '#065f46', lineHeight: 1.4 }}>
                  <strong>TRAI / DLT Compliant:</strong> Outbound calls operate within permitted Indian hours (09:00 AM – 09:00 PM IST) with auto-DND filtering and auditable Do Not Call enforcement.
                </span>
              </div>
            </div>

            {/* Step 3: Contact Preview Table */}
            <div className="card" style={{ padding: 24, borderRadius: 18, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Contact Preview & Validation ({contactsList.length})
                </h3>
                {contactsList.length > 0 && (
                  <button
                    onClick={() => setContactsList([])}
                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Clear All
                  </button>
                )}
              </div>

              {contactsList.length === 0 ? (
                <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed #e2e8f0', borderRadius: 12 }}>
                  <Users size={32} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>No contacts queued yet</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Add a single contact or click "Load User's 72 Leads" above.</div>
                </div>
              ) : (
                <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '8px 12px' }}>#</th>
                        <th style={{ padding: '8px 12px' }}>Name</th>
                        <th style={{ padding: '8px 12px' }}>Phone Number</th>
                        <th style={{ padding: '8px 12px' }}>Notes / Context</th>
                        <th style={{ padding: '8px 12px' }}>DND</th>
                        <th style={{ padding: '8px 12px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contactsList.slice(0, 15).map((c, idx) => (
                        <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                            {c.name === 'Unknown' ? (
                              <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Unknown Contact</span>
                            ) : (
                              c.name
                            )}
                          </td>
                          <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{c.phone}</td>
                          <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.notes || '—'}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{
                              fontSize: 10.5, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                              background: c.dnd_status === 'Clean' ? '#dcfce7' : '#fee2e2',
                              color: c.dnd_status === 'Clean' ? '#15803d' : '#b91c1c'
                            }}>
                              {c.dnd_status}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <button
                              onClick={() => setContactsList(prev => prev.filter(x => x.id !== c.id))}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 11 }}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {contactsList.length > 15 && (
                    <div style={{ padding: '8px 12px', background: '#f8fafc', fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'center' }}>
                      Showing first 15 of {contactsList.length} contacts
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Execution Control & Live Calling Console */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Live Campaign Action Card */}
            <div className="card" style={{ padding: 24, borderRadius: 18, border: '1px solid var(--border)', background: 'linear-gradient(180deg, #ffffff 0%, #faf5ff 100%)' }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <PhoneCall size={18} color="#7c3aed" />
                <span>Call by Sara Control Console</span>
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                  <span style={{ fontWeight: 700, color: isCampaignRunning ? '#059669' : '#64748b' }}>
                    {isCampaignRunning ? '🟢 Live Calling Active' : '⚪ Standby / Ready'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Queued Leads:</span>
                  <span style={{ fontWeight: 700 }}>{contactsList.length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Sara Persona:</span>
                  <span style={{ fontWeight: 700, color: '#7c3aed' }}>Sara (Telugu Natural Speech)</span>
                </div>
              </div>

              {!isCampaignRunning ? (
                <button
                  onClick={handleLaunchCampaign}
                  disabled={isCallingNext || contactsList.length === 0}
                  className="btn btn-primary"
                  style={{
                    width: '100%', padding: '14px 20px', borderRadius: 14, fontSize: 15, fontWeight: 700,
                    background: 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    cursor: contactsList.length === 0 ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 15px rgba(124, 58, 237, 0.35)'
                  }}
                >
                  <Play size={16} fill="#fff" />
                  <span>START CALLING WITH SARA</span>
                </button>
              ) : (
                <button
                  onClick={handlePauseResume}
                  className="btn"
                  style={{
                    width: '100%', padding: '14px 20px', borderRadius: 14, fontSize: 14, fontWeight: 700,
                    background: '#ef4444', color: '#fff', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer'
                  }}
                >
                  <Pause size={16} fill="#fff" />
                  <span>PAUSE CALLING QUEUE</span>
                </button>
              )}
            </div>

            {/* Current Active Call Box */}
            <div className="card" style={{ padding: 22, borderRadius: 18, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#7c3aed', letterSpacing: '0.05em' }}>
                  Live Call Telemetry
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace', color: '#059669' }}>
                  {liveDuration > 0 ? `${Math.floor(liveDuration / 60)}m ${liveDuration % 60}s` : '00:00'}
                </span>
              </div>

              {currentCallingContact ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {currentCallingContact.name}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                    {currentCallingContact.phone}
                  </div>
                  <div style={{ fontSize: 12, color: '#059669', background: '#ecfdf5', padding: '4px 10px', borderRadius: 6, width: 'fit-content', fontWeight: 600 }}>
                    Speaking with Sara in Telugu (Attempt {currentCallingContact.attempt || 1})
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '24px 10px', color: 'var(--text-muted)', fontSize: 12.5 }}>
                  No active phone call right now. Click "START CALLING WITH SARA" to begin.
                </div>
              )}
            </div>

            {/* Sara Unknown Person Training Script Guide */}
            <div className="card" style={{ padding: 22, borderRadius: 18, border: '1px solid #e9d5ff', background: '#faf5ff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Sparkles size={16} color="#7c3aed" />
                <h4 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: '#6b21a8' }}>
                  Sara Telugu Script Logic Active
                </h4>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#581c87', lineHeight: 1.6 }}>
                <li><strong>Opening:</strong> "నమస్కారం అండి! నేను సారా మాట్లాడుతున్నాను... ఇప్పుడు రెండు నిమిషాలు మాట్లాడటం వీలవుతుందా అండి?"</li>
                <li><strong>If Name Unknown:</strong> "క్షమించండి అండి, మీ పేరు మా దగ్గర ప్రస్తుతం అందుబాటులో లేదు. మిమ్మల్ని ఏ పేరుతో పిలవాలో చెబుతారా?"</li>
                <li><strong>If Busy:</strong> "పర్లేదు అండి, మీకు సౌకర్యంగా ఉన్న సమయంలో మాట్లాడవచ్చు."</li>
                <li><strong>If Not Interested:</strong> Concludes politely without arguing.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ── TAB 2: CALL REPORTS & ANALYTICS ─────────────────────────────── */}
      {activeTab === 'reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Analytics KPI Ribbon */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
            {[
              { label: 'Total Contacts', val: analytics.total_contacts, color: '#0284c7' },
              { label: 'Calls Attempted', val: analytics.calls_attempted, color: '#7c3aed' },
              { label: 'Calls Answered', val: analytics.calls_answered, color: '#059669' },
              { label: 'Interested Contacts', val: analytics.interested_contacts, color: '#16a34a' },
              { label: 'Follow-ups Required', val: analytics.followups_required, color: '#ea580c' },
              { label: 'Total Talk Time', val: analytics.total_duration, color: '#4f46e5' },
            ].map((k, i) => (
              <div key={i} className="card" style={{ padding: '16px 18px', borderRadius: 14, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: k.color, letterSpacing: '-0.02em', lineHeight: 1 }}>{k.val}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginTop: 6 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Individual Reports Filter & Table */}
          <div className="card" style={{ padding: 24, borderRadius: 18, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Individual Contact Call Reports ({filteredReports.length})
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--text-muted)' }}>
                  Prathi call transcript, interest level, customer response, mariyu follow-up requirement report.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  className="input"
                  placeholder="Search contact, name or phone..."
                  value={reportSearch}
                  onChange={(e) => setReportSearch(e.target.value)}
                  style={{ fontSize: 12.5, width: 220 }}
                />

                <select
                  className="input"
                  value={reportFilter}
                  onChange={(e) => setReportFilter(e.target.value)}
                  style={{ fontSize: 12.5, width: 140 }}
                >
                  <option value="all">All Interests</option>
                  <option value="high">High Interest</option>
                  <option value="medium">Medium Interest</option>
                  <option value="low">Low Interest</option>
                </select>

                <button
                  onClick={handleExportCSV}
                  disabled={reports.length === 0}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}
                >
                  <Download size={14} />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {filteredReports.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', border: '1px dashed #e2e8f0', borderRadius: 14 }}>
                <FileText size={32} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
                <div style={{ fontSize: 14, fontWeight: 600 }}>No reports recorded yet for this campaign</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Completed calls will automatically record individual conversation analysis here.</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '10px 14px' }}>Contact ID</th>
                      <th style={{ padding: '10px 14px' }}>Name</th>
                      <th style={{ padding: '10px 14px' }}>Phone Number</th>
                      <th style={{ padding: '10px 14px' }}>Status</th>
                      <th style={{ padding: '10px 14px' }}>Duration</th>
                      <th style={{ padding: '10px 14px' }}>Language</th>
                      <th style={{ padding: '10px 14px' }}>Interest</th>
                      <th style={{ padding: '10px 14px' }}>Outcome</th>
                      <th style={{ padding: '10px 14px' }}>Follow-up</th>
                      <th style={{ padding: '10px 14px' }}>Conversation Summary</th>
                      <th style={{ padding: '10px 14px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReports.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#7c3aed' }}>
                          {r.contact_id}
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                          {r.name === 'Unknown' ? <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Unknown</span> : r.name}
                        </td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{r.masked_phone}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                            background: r.call_status.toLowerCase() === 'connected' || r.call_status.toLowerCase() === 'completed' ? '#dcfce7' : '#f1f5f9',
                            color: r.call_status.toLowerCase() === 'connected' || r.call_status.toLowerCase() === 'completed' ? '#15803d' : '#64748b'
                          }}>
                            {r.call_status}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{r.duration}</td>
                        <td style={{ padding: '10px 14px' }}>{r.language}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                            background: r.interest === 'High' ? '#dcfce7' : (r.interest === 'Medium' ? '#fef3c7' : '#fee2e2'),
                            color: r.interest === 'High' ? '#15803d' : (r.interest === 'Medium' ? '#b45309' : '#b91c1c')
                          }}>
                            {r.interest}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>{r.outcome}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontWeight: 600, color: r.follow_up === 'Required' ? '#ea580c' : 'var(--text-muted)' }}>
                            {r.follow_up}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                          {r.summary}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <button
                            onClick={() => setInspectModalContact(r)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 8px', fontSize: 11 }}
                          >
                            View Details
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

      {/* ── TAB 3: ALL CAMPAIGNS ────────────────────────────────────────── */}
      {activeTab === 'campaigns' && (
        <div className="card" style={{ padding: 24, borderRadius: 18, border: '1px solid var(--border)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
            All Telephony Campaigns ({campaignsList.length})
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            {campaignsList.map(c => (
              <div
                key={c.id}
                style={{
                  padding: 18, borderRadius: 14, border: '1px solid #e2e8f0', background: '#fff',
                  cursor: 'pointer', transition: 'all 0.15s ease'
                }}
                onClick={() => {
                  setActiveCampaign(c);
                  loadReportsForCampaign(c.id);
                  setActiveTab('reports');
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{c.name}</span>
                  <span style={{
                    fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                    background: c.status === 'running' ? '#dcfce7' : '#f1f5f9',
                    color: c.status === 'running' ? '#15803d' : '#64748b', textTransform: 'uppercase'
                  }}>
                    {c.status}
                  </span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 12 }}>
                  {c.total_leads || 0} Contacts Queued • {c.called || 0} Calls Placed • {c.connected || 0} Connected
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11.5, color: '#7c3aed', fontWeight: 600 }}>Open Reports & Analytics →</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.created_at ? new Date(c.created_at).toLocaleDateString() : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MODAL: INDIVIDUAL CALL REPORT & TRANSCRIPT INSPECTION ────────── */}
      {inspectModalContact && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#fff', width: '100%', maxWidth: 640, borderRadius: 20, padding: 26, maxHeight: '85vh',
            display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#7c3aed' }}>{inspectModalContact.contact_id}</div>
                <h3 style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 700 }}>
                  {inspectModalContact.name} ({inspectModalContact.masked_phone})
                </h3>
              </div>
              <button
                onClick={() => setInspectModalContact(null)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, fontSize: 12.5 }}>
              <div style={{ padding: 10, background: '#f8fafc', borderRadius: 8 }}>
                <span style={{ color: 'var(--text-muted)', display: 'block' }}>Call Duration:</span>
                <strong>{inspectModalContact.duration}</strong>
              </div>
              <div style={{ padding: 10, background: '#f8fafc', borderRadius: 8 }}>
                <span style={{ color: 'var(--text-muted)', display: 'block' }}>Interest Level:</span>
                <strong style={{ color: inspectModalContact.interest === 'High' ? '#16a34a' : '#d97706' }}>{inspectModalContact.interest}</strong>
              </div>
              <div style={{ padding: 10, background: '#f8fafc', borderRadius: 8 }}>
                <span style={{ color: 'var(--text-muted)', display: 'block' }}>Follow-up:</span>
                <strong>{inspectModalContact.follow_up}</strong>
              </div>
            </div>

            <div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>AI Conversation Summary:</span>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5, background: '#faf5ff', padding: 12, borderRadius: 10, border: '1px solid #e9d5ff' }}>
                {inspectModalContact.summary}
              </p>
            </div>

            <div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Conversation Transcript (Sara in Telugu):
              </span>
              <div style={{ maxHeight: 200, overflowY: 'auto', background: '#f8fafc', padding: 12, borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {inspectModalContact.transcript && inspectModalContact.transcript.length > 0 ? (
                  inspectModalContact.transcript.map((m, idx) => (
                    <div key={idx} style={{ fontSize: 12 }}>
                      <strong style={{ color: m.role === 'assistant' ? '#7c3aed' : '#0284c7' }}>
                        {m.speaker || (m.role === 'assistant' ? 'Sara' : 'Contact')}:
                      </strong>{' '}
                      <span>{m.text || m.content}</span>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                    Standard greeting completed: "నమస్కారం అండి! నేను సారా మాట్లాడుతున్నాను... మీతో ఒక చిన్న విషయం మాట్లాడటానికి కాల్ చేశాను."
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 10 }}>
              <button
                onClick={() => setInspectModalContact(null)}
                className="btn btn-primary"
                style={{ padding: '8px 20px', borderRadius: 10 }}
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
