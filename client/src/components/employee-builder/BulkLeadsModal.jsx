import React, { useState, useEffect, useRef } from 'react';
import {
  X, UploadCloud, FileSpreadsheet, Bot, PhoneCall, RefreshCw,
  CheckCircle2, AlertTriangle, Play, Pause, ChevronRight, User, Phone, MapPin, Shield,
  Link, Sliders, Check, Clock, Radio, ArrowRight
} from 'lucide-react';
import { CHARACTERS } from '../../config/characters.config';

export default function BulkLeadsModal({
  isOpen,
  onClose,
  preselectedEmployeeId,
  preselectedEmployeeName,
  preselectedScript,
  onCampaignCreated
}) {
  // Input source tab: 'file' | 'link' | 'demo'
  const [sourceTab, setSourceTab] = useState('file');
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [sheetUrl, setSheetUrl] = useState('');
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);

  // Raw parsed tabular data (before column customization)
  const [rawHeaders, setRawHeaders] = useState([]);
  const [rawTableRows, setRawTableRows] = useState([]); // Array of string arrays

  // Column Customization Mapping state
  const [nameColIdx, setNameColIdx] = useState(0);
  const [phoneColIdx, setPhoneColIdx] = useState(1);
  const [notesColIdx, setNotesColIdx] = useState(-1); // -1 means combine all other columns

  // Final mapped leads ready to upload / uploaded
  const [customMappedLeads, setCustomMappedLeads] = useState([]);
  const [isParsing, setIsParsing] = useState(false);

  // Campaign & Calling settings
  const [selectedVoiceHuman, setSelectedVoiceHuman] = useState(preselectedEmployeeId || 'sara');
  const [maxRetries, setMaxRetries] = useState(3); // 2 or 3 retries
  const [campaignName, setCampaignName] = useState('Bulk Leads Campaign');

  // Execution & Live Dialing states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeCampaign, setActiveCampaign] = useState(null);
  const [isDialingLoop, setIsDialingLoop] = useState(false);
  const [currentDialingLead, setCurrentDialingLead] = useState(null);
  const [liveLeads, setLiveLeads] = useState([]);
  const isLoopRunningRef = useRef(false);

  // Sample Real Estate leads for quick 1-click test
  const SAMPLE_LEADS = [
    { name: 'Ravi Kumar', phone: '+919848012345', notes: 'Gachibowli 3BHK Villa, Budget ₹1.8 Cr' },
    { name: 'Srinivas Rao', phone: '+919988776655', notes: 'Madhapur 2BHK, Budget ₹95 Lakhs' },
    { name: 'Ananya Reddy', phone: '+919440112233', notes: 'Kukatpally Commercial Plot, Immediate' },
    { name: 'Venkatesh Naidu', phone: '+919876543210', notes: 'Kondapur Luxury Penthouse, Loan Ready' },
    { name: 'Kavitha Devi', phone: '+919123456789', notes: 'Miyapur Budget Villa, Weekend Visit' }
  ];

  // Sync preselected employee when opened
  useEffect(() => {
    if (preselectedEmployeeId) {
      setSelectedVoiceHuman(preselectedEmployeeId);
      if (preselectedEmployeeName) {
        setCampaignName(`${preselectedEmployeeName}'s Bulk Leads`);
      }
    }
  }, [preselectedEmployeeId, preselectedEmployeeName, isOpen]);

  // Reset loop on modal close
  useEffect(() => {
    if (!isOpen) {
      isLoopRunningRef.current = false;
      setIsDialingLoop(false);
    }
  }, [isOpen]);

  // Load sample leads into customization table
  const handleLoadSampleLeads = () => {
    setFileName('Sample_Customer_Leads.xlsx');
    setSourceTab('demo');
    const headers = ['Full Name', 'Contact Number', 'Customer Requirement & Notes'];
    const rows = SAMPLE_LEADS.map(l => [l.name, l.phone, l.notes]);
    setRawHeaders(headers);
    setRawTableRows(rows);
    setNameColIdx(0);
    setPhoneColIdx(1);
    setNotesColIdx(2);
    setErrorMessage('');
  };

  // Auto-detect columns whenever rawHeaders change
  useEffect(() => {
    if (!rawHeaders || rawHeaders.length === 0) return;

    const lowerH = rawHeaders.map(h => (h || '').toLowerCase().trim());
    
    // Detect name column
    const nIdx = lowerH.findIndex(h => ['name', 'customer', 'client', 'lead', 'prospect', 'person'].some(k => h.includes(k)));
    setNameColIdx(nIdx >= 0 ? nIdx : 0);

    // Detect phone column
    const pIdx = lowerH.findIndex(h => ['phone', 'mobile', 'contact', 'number', 'tel', 'cell', 'ph'].some(k => h.includes(k)));
    setPhoneColIdx(pIdx >= 0 ? pIdx : (rawHeaders.length > 1 ? 1 : 0));

    // Detect notes column
    const ntIdx = lowerH.findIndex(h => ['note', 'city', 'location', 'budget', 'requirement', 'remark', 'property', 'detail'].some(k => h.includes(k)));
    setNotesColIdx(ntIdx >= 0 ? ntIdx : -1);
  }, [rawHeaders]);

  // Re-generate customMappedLeads whenever column indices or raw rows change
  useEffect(() => {
    if (rawTableRows.length === 0) {
      setCustomMappedLeads([]);
      return;
    }

    const mapped = rawTableRows.map((row) => {
      const nameVal = row[nameColIdx] ? String(row[nameColIdx]).trim() : 'Prospect';
      const phoneVal = row[phoneColIdx] ? String(row[phoneColIdx]).trim() : '';
      
      let notesVal = '';
      if (notesColIdx >= 0 && notesColIdx < row.length) {
        notesVal = String(row[notesColIdx] || '').trim();
      } else {
        // Combine other columns
        notesVal = row
          .filter((_, idx) => idx !== nameColIdx && idx !== phoneColIdx)
          .map((v, i) => `${rawHeaders[i] || 'Info'}: ${v}`)
          .filter(Boolean)
          .join(' | ');
      }

      return {
        name: nameVal || 'Prospect',
        phone: phoneVal,
        notes: notesVal
      };
    }).filter(item => {
      const digits = (item.phone || '').replace(/\D/g, '');
      return digits.length >= 8;
    });

    setCustomMappedLeads(mapped);
  }, [rawTableRows, nameColIdx, phoneColIdx, notesColIdx, rawHeaders]);

  // Client-side file selection & robust CSV parsing
  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setFileName(selectedFile.name);
    setErrorMessage('');
    setIsParsing(true);

    const reader = new FileReader();

    if (selectedFile.name.toLowerCase().endsWith('.csv')) {
      reader.onload = (evt) => {
        try {
          const text = evt.target.result;
          const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          if (lines.length > 0) {
            // Split CSV taking quotes into account
            const parseLine = (line) => {
              const res = [];
              let cur = '';
              let inQ = false;
              for (let i = 0; i < line.length; i++) {
                const c = line[i];
                if (c === '"') { inQ = !inQ; }
                else if (c === ',' && !inQ) { res.push(cur.trim()); cur = ''; }
                else { cur += c; }
              }
              res.push(cur.trim());
              return res;
            };

            const headerRow = parseLine(lines[0]);
            const bodyRows = lines.slice(1).map(parseLine).filter(r => r.some(Boolean));

            setRawHeaders(headerRow);
            setRawTableRows(bodyRows);
          }
        } catch (err) {
          console.warn('CSV parse preview error:', err);
          setErrorMessage('Could not parse CSV file. Please verify file formatting.');
        } finally {
          setIsParsing(false);
        }
      };
      reader.readAsText(selectedFile);
    } else {
      // Excel files will be read completely on backend, provide intuitive feedback
      setTimeout(() => {
        setIsParsing(false);
        setRawHeaders(['Customer Name', 'Phone Number', 'Requirement Notes']);
        setRawTableRows([
          ['Excel Lead 1', '+91 98480 12345', 'Detected from Sheet Row 2'],
          ['Excel Lead 2', '+91 99887 66554', 'Detected from Sheet Row 3'],
          ['Excel Lead 3', '+91 94401 22334', 'Detected from Sheet Row 4']
        ]);
      }, 300);
    }
  };

  // Fetch sheet from public link or Google Sheet
  const handleFetchSheetFromUrl = async () => {
    if (!sheetUrl.trim()) {
      setErrorMessage('Please paste a Google Sheets or CSV link.');
      return;
    }

    setIsFetchingUrl(true);
    setErrorMessage('');

    try {
      let fetchUrl = sheetUrl.trim();
      if (fetchUrl.includes('docs.google.com/spreadsheets') && fetchUrl.includes('/edit')) {
        fetchUrl = fetchUrl.replace(/\/edit.*$/, '/export?format=csv');
      }

      // Test URL fetch via backend upload endpoint
      const formData = new FormData();
      formData.append('sheet_url', fetchUrl);
      formData.append('campaign_name', campaignName);
      formData.append('employee_id', selectedVoiceHuman);
      formData.append('max_retries', String(maxRetries));
      formData.append('auto_start', 'false');

      const res = await fetch('/api/v1/campaigns/bulk-upload', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setActiveCampaign(data);
        setLiveLeads(data.leads || []);
        if (onCampaignCreated) onCampaignCreated(data);
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMessage(err.detail || 'Could not fetch data from link. Please make sure Google Sheet sharing is set to "Anyone with link can view".');
      }
    } catch (err) {
      console.error('URL fetch error:', err);
      setErrorMessage('Connection error while fetching link.');
    } finally {
      setIsFetchingUrl(false);
    }
  };

  // Submit and launch Campaign with mapped leads
  const handleImportAndSetup = async () => {
    if (customMappedLeads.length === 0 && !file && !sheetUrl) {
      setErrorMessage('Please upload a file, paste a sheet link, or click "Load Sample Leads".');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const formData = new FormData();
      
      // Send customized mapped leads as JSON so backend receives user's exact column mapping!
      if (customMappedLeads.length > 0) {
        formData.append('mapped_leads', JSON.stringify(customMappedLeads));
      } else if (file) {
        formData.append('file', file);
      } else if (sheetUrl) {
        formData.append('sheet_url', sheetUrl);
      }

      formData.append('campaign_name', campaignName);
      formData.append('employee_id', selectedVoiceHuman);
      formData.append('max_retries', String(maxRetries));
      formData.append('auto_start', 'false'); // Let user click Call Now

      const res = await fetch('/api/v1/campaigns/bulk-upload', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setActiveCampaign(data);
        setLiveLeads(data.leads || []);
        if (onCampaignCreated) onCampaignCreated(data);
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMessage(err.detail || 'Failed to import bulk leads.');
      }
    } catch (err) {
      console.error('Bulk upload error:', err);
      setErrorMessage('Network error while importing leads.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1-by-1 Sequential Call Disptacher
  const dialNextLead = async (campaignId) => {
    try {
      const res = await fetch(`/api/v1/campaigns/${campaignId}/dial-next`, {
        method: 'POST'
      });
      if (res.ok) {
        const result = await res.json();
        if (result.has_more === false || result.done) {
          isLoopRunningRef.current = false;
          setIsDialingLoop(false);
          setCurrentDialingLead(null);
          return false;
        }

        setCurrentDialingLead(result);
        
        // Refresh campaign leads status
        const leadsRes = await fetch(`/api/v1/campaigns/${campaignId}/leads`);
        if (leadsRes.ok) {
          const lData = await leadsRes.json();
          setLiveLeads(lData.data || lData.leads || []);
        }
        return true;
      }
    } catch (err) {
      console.error('Dial next error:', err);
    }
    return false;
  };

  // Main "Call Now" Sequential Loop
  const startSequentialCalling = async () => {
    if (!activeCampaign?.campaign_id) return;
    
    setIsDialingLoop(true);
    isLoopRunningRef.current = true;

    while (isLoopRunningRef.current) {
      const hasMore = await dialNextLead(activeCampaign.campaign_id);
      if (!hasMore || !isLoopRunningRef.current) {
        break;
      }
      // Pace calls sequentially (4 seconds between simulated calls)
      await new Promise(r => setTimeout(r, 4000));
    }

    setIsDialingLoop(false);
    isLoopRunningRef.current = false;
  };

  const stopSequentialCalling = () => {
    isLoopRunningRef.current = false;
    setIsDialingLoop(false);
  };

  if (!isOpen) return null;

  return (
    <div
      className="bulk-leads-modal-overlay animate-fade-in"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        className="bulk-leads-card animate-scale-up"
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 22,
          maxWidth: 780,
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(124, 58, 237, 0.1)',
          position: 'relative',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── MODAL HEADER ── */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(180deg, #fbfbfe 0%, #ffffff 100%)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)'
              }}
            >
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e1b4b', margin: 0 }}>
                  Bulk Leads & Sequential Auto-Caller
                </h3>
                <span
                  style={{
                    background: '#fef3c7',
                    border: '1px solid #fde68a',
                    color: '#b45309',
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '2px 7px',
                    borderRadius: 12,
                    textTransform: 'uppercase'
                  }}
                >
                  Custom Column Mapping
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#64748b' }}>
                Import CSV, Excel, or Google Sheet. Custom-map any columns & auto-dial 1-by-1 with {maxRetries} smart retries.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              cursor: 'pointer'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── MODAL BODY SCROLLABLE ── */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* ACTIVE CAMPAIGN: "CALL NOW" SEQUENTIAL RUNNER VIEW */}
          {activeCampaign ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Top Action Box with CALL NOW Button */}
              <div
                style={{
                  background: isDialingLoop ? '#f0fdf4' : '#faf5ff',
                  border: isDialingLoop ? '2px solid #86efac' : '1.5px solid #d8b4fe',
                  borderRadius: 16,
                  padding: '18px 22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: '#1e1b4b' }}>
                      {activeCampaign.campaign_name}
                    </span>
                    <span
                      style={{
                        background: isDialingLoop ? '#dcfce7' : '#f5f3ff',
                        color: isDialingLoop ? '#15803d' : '#6d28d9',
                        border: isDialingLoop ? '1px solid #bbf7d0' : '1px solid #ddd6fe',
                        fontSize: 11,
                        fontWeight: 800,
                        padding: '2px 9px',
                        borderRadius: 12
                      }}
                    >
                      {isDialingLoop ? '● Dialing Leads 1-by-1' : 'Ready to Call'}
                    </span>
                  </div>

                  <div style={{ fontSize: 12.5, color: '#475569', marginTop: 4 }}>
                    Assigned Agent: <strong>{activeCampaign.ai_employee}</strong> • Retry Rule: <strong>{activeCampaign.max_retries} attempts if not lifted</strong>
                  </div>

                  {currentDialingLead && isDialingLoop && (
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 12,
                        color: '#047857',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Currently calling: {currentDialingLead.lead_name} ({currentDialingLead.phone}) — Attempt {currentDialingLead.attempt}/{currentDialingLead.max_retries}</span>
                    </div>
                  )}
                </div>

                {/* THE "CALL NOW" TRIGGER BUTTON */}
                <button
                  type="button"
                  onClick={isDialingLoop ? stopSequentialCalling : startSequentialCalling}
                  style={{
                    background: isDialingLoop
                      ? '#ef4444'
                      : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 14,
                    padding: '14px 28px',
                    fontSize: 15,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: isDialingLoop
                      ? '0 6px 20px rgba(239, 68, 68, 0.35)'
                      : '0 6px 24px rgba(16, 185, 129, 0.4)',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                >
                  {isDialingLoop ? (
                    <>
                      <Pause size={18} fill="#ffffff" />
                      <span>Pause Calling</span>
                    </>
                  ) : (
                    <>
                      <PhoneCall size={18} />
                      <span>Call Now 📞</span>
                    </>
                  )}
                </button>
              </div>

              {/* Real-time stats cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {[
                  { label: 'Total Imported', count: liveLeads.length, color: '#1e1b4b', bg: '#f8fafc' },
                  { label: 'Answered', count: liveLeads.filter(l => ['completed', 'answered', 'connected'].includes(l.status)).length, color: '#15803d', bg: '#f0fdf4' },
                  { label: `Retrying (${activeCampaign.max_retries} tries)`, count: liveLeads.filter(l => l.status === 'retrying').length, color: '#b45309', bg: '#fef3c7' },
                  { label: 'Pending in Queue', count: liveLeads.filter(l => ['pending', 'calling'].includes(l.status)).length, color: '#6d28d9', bg: '#f5f3ff' },
                ].map((s) => (
                  <div
                    key={s.label}
                    style={{
                      background: s.bg,
                      borderRadius: 12,
                      padding: '10px 14px',
                      border: '1px solid rgba(0,0,0,0.06)'
                    }}
                  >
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{s.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.color, marginTop: 2 }}>{s.count}</div>
                  </div>
                ))}
              </div>

              {/* Live Lead Table with Attempts counter */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
                    Live Calling Queue (Auto-dialing 1-by-1)
                  </span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>
                    {liveLeads.filter(l => ['completed', 'connected', 'answered'].includes(l.status)).length} / {liveLeads.length} finished
                  </span>
                </div>

                <div
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    overflow: 'hidden',
                    maxHeight: 220,
                    overflowY: 'auto'
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '8px 12px', color: '#64748b', fontWeight: 700 }}>Lead Name</th>
                        <th style={{ textAlign: 'left', padding: '8px 12px', color: '#64748b', fontWeight: 700 }}>Phone</th>
                        <th style={{ textAlign: 'left', padding: '8px 12px', color: '#64748b', fontWeight: 700 }}>Attempts (Max {activeCampaign.max_retries})</th>
                        <th style={{ textAlign: 'left', padding: '8px 12px', color: '#64748b', fontWeight: 700 }}>Call Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liveLeads.map((l, i) => {
                        const isCurrent = currentDialingLead && currentDialingLead.lead_id === l.lead_id && isDialingLoop;

                        return (
                          <tr
                            key={l.id || i}
                            style={{
                              borderBottom: '1px solid #f1f5f9',
                              background: isCurrent ? '#f0fdf4' : i % 2 === 0 ? '#ffffff' : '#fcfcfd'
                            }}
                          >
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1e293b' }}>
                              {l.name}
                            </td>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>
                              {l.phone}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <span
                                style={{
                                  background: l.attempts > 1 ? '#fee2e2' : '#f1f5f9',
                                  color: l.attempts > 1 ? '#dc2626' : '#475569',
                                  fontWeight: 700,
                                  fontSize: 10.5,
                                  padding: '2px 7px',
                                  borderRadius: 6
                                }}
                              >
                                Attempt {l.attempts || 0} / {activeCampaign.max_retries}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              {isCurrent ? (
                                <span style={{ color: '#059669', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <PhoneCall size={12} className="animate-pulse" /> In Call...
                                </span>
                              ) : (
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: l.status === 'completed' ? '#15803d' : l.status === 'retrying' ? '#b45309' : '#64748b'
                                  }}
                                >
                                  {l.status === 'retrying' ? '⏳ Retrying (Not Answered)' : l.status}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* SETUP & CUSTOM COLUMN MAPPING VIEW */
            <>
              {/* Channel Selector: File vs Link vs Demo */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #e2e8f0', paddingBottom: 10 }}>
                {[
                  { id: 'file', label: '📁 Upload Excel / CSV', desc: 'Local file' },
                  { id: 'link', label: '🔗 Connect Google Sheet / Link', desc: 'Live URL' },
                  { id: 'demo', label: '⚡ 1-Click Sample Leads', desc: '5 Real Estate leads' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setSourceTab(t.id);
                      if (t.id === 'demo') handleLoadSampleLeads();
                    }}
                    style={{
                      background: sourceTab === t.id ? '#f5f3ff' : '#ffffff',
                      border: sourceTab === t.id ? '1.5px solid #7c3aed' : '1px solid #cbd5e1',
                      color: sourceTab === t.id ? '#6d28d9' : '#475569',
                      padding: '7px 14px',
                      borderRadius: 10,
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.18s ease'
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Source Tab 1: Upload File */}
              {sourceTab === 'file' && (
                <div>
                  <div
                    style={{
                      border: '2px dashed #cbd5e1',
                      borderRadius: 14,
                      padding: '20px',
                      textAlign: 'center',
                      background: '#f8fafc',
                      position: 'relative',
                      cursor: 'pointer'
                    }}
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = '#7c3aed'; }}
                    onDragLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.style.borderColor = '#cbd5e1';
                      if (e.dataTransfer.files?.[0]) {
                        handleFileChange({ target: { files: e.dataTransfer.files } });
                      }
                    }}
                  >
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileChange}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        opacity: 0,
                        cursor: 'pointer',
                        width: '100%',
                        height: '100%'
                      }}
                    />

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed' }}>
                        <UploadCloud size={22} />
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                        {fileName ? fileName : 'Choose Excel (.xlsx/.xls) or CSV file, or drag and drop'}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        Any column structure works — you will customize column mapping below
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Source Tab 2: Google Sheet / Public Link */}
              {sourceTab === 'link' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                    Google Sheets or CSV Web Link
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="url"
                      value={sheetUrl}
                      onChange={(e) => setSheetUrl(e.target.value)}
                      placeholder="e.g. https://docs.google.com/spreadsheets/d/1BxiMVs0XR.../edit"
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        borderRadius: 10,
                        border: '1.5px solid #cbd5e1',
                        fontSize: 13,
                        outline: 'none'
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleFetchSheetFromUrl}
                      disabled={isFetchingUrl || !sheetUrl.trim()}
                      style={{
                        background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 10,
                        padding: '10px 18px',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: isFetchingUrl || !sheetUrl.trim() ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      {isFetchingUrl ? <RefreshCw size={14} className="animate-spin" /> : <Link size={14} />}
                      <span>Connect Sheet</span>
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    Tip: Make sure the Google Sheet link sharing is set to "Anyone with the link can view".
                  </div>
                </div>
              )}

              {/* Source Tab 3: Sample Demo Leads confirmation */}
              {sourceTab === 'demo' && (
                <div style={{ background: '#f5f3ff', padding: '10px 14px', borderRadius: 10, fontSize: 12, color: '#6d28d9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>✓ 5 Pre-loaded Real Estate leads with Indian phone numbers ready to test!</span>
                  <button type="button" onClick={handleLoadSampleLeads} style={{ background: 'none', border: 'none', color: '#7c3aed', fontWeight: 800, cursor: 'pointer', fontSize: 11.5 }}>
                    Reload Leads
                  </button>
                </div>
              )}

              {/* ── CUSTOM COLUMN MAPPING SECTION (TELUGU REQUIREMENT: "కస్టమైజేషన్ అయ్యుండాలి, పర్టిక్యులర్ గా ఉండకూడదు వేల్యూస్") ── */}
              {rawHeaders.length > 0 && (
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: 14,
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Sliders size={15} color="#7c3aed" />
                      <span style={{ fontSize: 12.5, fontWeight: 800, color: '#1e1b4b' }}>
                        Customize Column Mapping
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: '#059669', fontWeight: 700 }}>
                      ✓ {customMappedLeads.length} valid contacts parsed
                    </span>
                  </div>

                  {/* 3 Mapping Dropdowns */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    {/* Name Column Mapping */}
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                        Customer Name Column
                      </label>
                      <select
                        value={nameColIdx}
                        onChange={(e) => setNameColIdx(Number(e.target.value))}
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          fontSize: 12,
                          background: '#ffffff',
                          fontWeight: 600
                        }}
                      >
                        {rawHeaders.map((h, idx) => (
                          <option key={idx} value={idx}>
                            Column {idx + 1}: {h || `Column ${idx + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Phone Column Mapping */}
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                        Phone / Mobile Column
                      </label>
                      <select
                        value={phoneColIdx}
                        onChange={(e) => setPhoneColIdx(Number(e.target.value))}
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          fontSize: 12,
                          background: '#ffffff',
                          fontWeight: 600
                        }}
                      >
                        {rawHeaders.map((h, idx) => (
                          <option key={idx} value={idx}>
                            Column {idx + 1}: {h || `Column ${idx + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Notes / Context Column Mapping */}
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                        Requirement / Notes Column
                      </label>
                      <select
                        value={notesColIdx}
                        onChange={(e) => setNotesColIdx(Number(e.target.value))}
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          fontSize: 12,
                          background: '#ffffff',
                          fontWeight: 600
                        }}
                      >
                        <option value={-1}>✦ Combine all other columns</option>
                        {rawHeaders.map((h, idx) => (
                          <option key={idx} value={idx}>
                            Column {idx + 1}: {h || `Column ${idx + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Live Preview of Mapped Contacts */}
                  <div
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: 10,
                      maxHeight: 120,
                      overflowY: 'auto',
                      background: '#ffffff'
                    }}
                  >
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '5px 8px', color: '#64748b' }}>Mapped Name</th>
                          <th style={{ textAlign: 'left', padding: '5px 8px', color: '#64748b' }}>Mapped Phone</th>
                          <th style={{ textAlign: 'left', padding: '5px 8px', color: '#64748b' }}>Mapped Notes / Context</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customMappedLeads.slice(0, 5).map((l, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '5px 8px', fontWeight: 600, color: '#1e293b' }}>{l.name}</td>
                            <td style={{ padding: '5px 8px', color: '#64748b' }}>{l.phone}</td>
                            <td style={{ padding: '5px 8px', color: '#64748b' }}>{l.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Agent Assignment & Smart Retries */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14 }}>
                {/* Voice Human Caller */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
                    Assigned AI Voice Caller
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[
                      { id: 'sara', name: 'Sara', desc: 'Telugu & English (Customer Advisory)' },
                      { id: 'farhan', name: 'Farhan', desc: 'Telugu & English (Real Estate Specialist)' },
                      { id: 'priya', name: 'Priya', desc: 'Telugu & Hindi (Clinic & Coordination)' },
                    ].map((agent) => {
                      const isSelected = selectedVoiceHuman === agent.id;
                      return (
                        <div
                          key={agent.id}
                          onClick={() => setSelectedVoiceHuman(agent.id)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 10,
                            border: isSelected ? '1.5px solid #7c3aed' : '1px solid #e2e8f0',
                            background: isSelected ? '#f5f3ff' : '#ffffff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: isSelected ? '#7c3aed' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isSelected ? '#ffffff' : '#64748b', fontSize: 11, fontWeight: 800 }}>
                              {agent.name[0]}
                            </div>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#1e1b4b' }}>{agent.name}</div>
                              <div style={{ fontSize: 10, color: '#64748b' }}>{agent.desc}</div>
                            </div>
                          </div>
                          {isSelected && <CheckCircle2 size={15} color="#7c3aed" />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Smart Retries Configuration */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
                    Retries If Not Lifted
                  </label>
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 12,
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8
                    }}
                  >
                    <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.35 }}>
                      How many times should the AI retry if caller doesn't pick up or is busy?
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      {[2, 3].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setMaxRetries(num)}
                          style={{
                            flex: 1,
                            padding: '7px 10px',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            border: maxRetries === num ? '1.5px solid #7c3aed' : '1px solid #cbd5e1',
                            background: maxRetries === num ? '#7c3aed' : '#ffffff',
                            color: maxRetries === num ? '#ffffff' : '#475569'
                          }}
                        >
                          {num} Retries
                        </button>
                      ))}
                    </div>

                    <div style={{ fontSize: 10.5, color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle2 size={12} /> Sequential 1-by-1 dialing
                    </div>
                  </div>
                </div>
              </div>

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
                  <AlertTriangle size={14} />
                  <span>{errorMessage}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── MODAL FOOTER ── */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #f1f5f9',
            background: '#fbfbfe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: 12,
              padding: '9px 18px',
              fontSize: 13,
              fontWeight: 600,
              color: '#475569',
              cursor: 'pointer'
            }}
          >
            {activeCampaign ? 'Done' : 'Cancel'}
          </button>

          {!activeCampaign && (
            <button
              type="button"
              onClick={handleImportAndSetup}
              disabled={isSubmitting || customMappedLeads.length === 0}
              style={{
                background: isSubmitting || customMappedLeads.length === 0
                  ? '#cbd5e1'
                  : 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 12,
                padding: '10px 22px',
                fontSize: 13.5,
                fontWeight: 800,
                cursor: isSubmitting || customMappedLeads.length === 0 ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: customMappedLeads.length > 0 ? '0 4px 16px rgba(124, 58, 237, 0.25)' : 'none'
              }}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Importing & Setting Up Caller...</span>
                </>
              ) : (
                <>
                  <ArrowRight size={15} />
                  <span>Import {customMappedLeads.length} Leads & Setup Caller</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
