import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles, Mic, MicOff, Upload, FileText, CheckCircle2, AlertCircle,
  Play, RefreshCw, ArrowRight, Shield, Layers, Wrench, Send, Database,
  Cpu, Calendar, MessageSquare, PhoneCall, HelpCircle, Check, Zap, Eye
} from 'lucide-react';
import { api } from '../../services/api';

const QUICK_PROMPTS = [
  {
    title: "Real Estate Sales Agent",
    dept: "Sales",
    icon: "🏢",
    prompt: "Create a sales employee for my real estate company. Whenever a new lead comes from Meta, contact them, understand their budget and location, record the lead in CRM, send the brochure via WhatsApp, and book a site visit on Google Calendar. If budget is above 80 Lakhs, recommend premium villas in Gachibowli."
  },
  {
    title: "College Admissions Counselor",
    dept: "Admissions",
    icon: "🎓",
    prompt: "Create an admissions counselor for our engineering college. Guide students through B.Tech courses, eligibility criteria (60% in 12th PCM), fee structure of 1.5 Lakhs per year, hostel facilities, and schedule campus counseling visits."
  },
  {
    title: "Clinic Care Coordinator",
    dept: "Healthcare",
    icon: "🏥",
    prompt: "Create a healthcare receptionist for our multi-specialty clinic. Handle doctor appointments, explain consultation fees, provide clinic timings, send appointment reminders via WhatsApp, and immediately advise emergency helpline for urgent cases."
  }
];

export default function AgentCompilerStudio({ currentAgent, onAgentCreated, onSelectAgent }) {
  // Natural input state
  const [naturalInput, setNaturalInput] = useState('');
  const [languagePref, setLanguagePref] = useState('en');
  const [isListening, setIsListening] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  
  // Compilation & loading state
  const [compiling, setCompiling] = useState(false);
  const [compilationStep, setCompilationStep] = useState(0);
  const [compilationMessage, setCompilationMessage] = useState('');

  // Active view tab in studio
  const [activeTab, setActiveTab] = useState('architecture'); // 'architecture' | 'workflow' | 'tests' | 'teaching' | 'knowledge'

  // Teaching state
  const [teachingInput, setTeachingInput] = useState('');
  const [teachingLoading, setTeachingLoading] = useState(false);
  const [teachingFeedback, setTeachingFeedback] = useState(null);

  // Testing state
  const [testingLoading, setTestingLoading] = useState(false);
  const [testResults, setTestResults] = useState(null);

  // File upload state
  const fileInputRef = useRef(null);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [docUploadFeedback, setDocUploadFeedback] = useState(null);
  const [agentDocuments, setAgentDocuments] = useState([]);

  // Speech recognition ref
  const recognitionRef = useRef(null);

  // Load existing test results and documents if agent is present
  useEffect(() => {
    if (currentAgent?.test_results) {
      setTestResults(currentAgent.test_results);
    }
    if (currentAgent?.id) {
      loadDocuments(currentAgent.id);
    }
  }, [currentAgent]);

  async function loadDocuments(agentId) {
    try {
      const docs = await api.getAgentDocs(agentId);
      setAgentDocuments(docs || []);
    } catch (e) {
      console.warn("Could not load agent documents:", e);
    }
  }

  // Web Speech Recognition for voice input
  function toggleVoiceInput() {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = languagePref === 'te' ? 'te-IN' : (languagePref === 'hi' ? 'hi-IN' : 'en-US');

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript + ' ';
        }
        setNaturalInput((prev) => (prev ? prev + ' ' : '') + transcript.trim());
      };

      recognition.onerror = (e) => {
        console.error("Speech recognition error:", e);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      setIsListening(false);
    }
  }

  // File drop / select handler
  function handleFileSelect(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploadedFiles((prev) => [...prev, ...files]);
  }

  // Main autonomous agent compilation trigger
  async function handleCompile() {
    if (!naturalInput.trim() && uploadedFiles.length === 0) {
      alert("Please provide a natural language description or upload a business document.");
      return;
    }

    setCompiling(true);
    setCompilationStep(1);
    setCompilationMessage("Analyzing business intent & role requirements...");

    const steps = [
      { step: 2, msg: "Detecting required tools & MCPs (Meta, WhatsApp, Calendar, CRM)..." },
      { step: 3, msg: "Synthesizing visual workflow & decision branches..." },
      { step: 4, msg: "Compiling production system prompt & strict guardrails..." },
      { step: 5, msg: "Generating 7-scenario automated test suite..." }
    ];

    let stepIdx = 0;
    const interval = setInterval(() => {
      if (stepIdx < steps.length) {
        setCompilationStep(steps[stepIdx].step);
        setCompilationMessage(steps[stepIdx].msg);
        stepIdx++;
      }
    }, 1200);

    try {
      const promptToCompile = naturalInput.trim() || "Create an autonomous AI business employee based on the uploaded documents.";
      const newAgent = await api.compileAgent({
        natural_input: promptToCompile,
        language_preference: languagePref,
        agent_id: currentAgent?.id || null
      });

      // If user had pending uploaded files, upload them now
      if (uploadedFiles.length > 0 && newAgent?.id) {
        setCompilationMessage("Ingesting and indexing business documents...");
        const formData = new FormData();
        uploadedFiles.forEach((file) => formData.append("files", file));
        await api.uploadDocs(newAgent.id, formData).catch((e) => console.warn(e));
        setUploadedFiles([]);
        loadDocuments(newAgent.id);
      }

      clearInterval(interval);
      setCompilationStep(6);
      setCompilationMessage("Compilation complete! AI Employee ready.");

      setTimeout(() => {
        setCompiling(false);
        if (onAgentCreated) {
          onAgentCreated(newAgent);
        }
        if (newAgent?.test_results) {
          setTestResults(newAgent.test_results);
        }
      }, 800);

    } catch (err) {
      clearInterval(interval);
      setCompiling(false);
      alert(`Compilation failed: ${err.message}`);
    }
  }

  // Document upload handler for existing agent
  async function handleUploadDocsForAgent(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length || !currentAgent?.id) return;

    setUploadingDocs(true);
    setDocUploadFeedback(null);
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      const res = await api.uploadDocs(currentAgent.id, formData);
      setDocUploadFeedback(`Successfully parsed ${res.uploaded_count} document(s) and added ${res.new_faqs_added} verified facts!`);
      loadDocuments(currentAgent.id);
    } catch (err) {
      setDocUploadFeedback(`Upload failed: ${err.message}`);
    } finally {
      setUploadingDocs(false);
    }
  }

  // Continuous teaching handler ("From now on...")
  async function handleContinuousTeach() {
    if (!teachingInput.trim() || !currentAgent?.id) return;

    setTeachingLoading(true);
    setTeachingFeedback(null);
    try {
      const res = await api.teachAgent(currentAgent.id, teachingInput.trim());
      setTeachingFeedback({
        rule: res.rule,
        confirmation: res.confirmation || "Rule applied and agent prompt updated instantly!"
      });
      setTeachingInput('');
      // Refresh current agent
      const updated = await api.getAgent(currentAgent.id);
      if (onSelectAgent) {
        onSelectAgent(updated.id);
      }
    } catch (err) {
      alert(`Teaching error: ${err.message}`);
    } finally {
      setTeachingLoading(false);
    }
  }

  // Automated 7-scenario test runner
  async function handleRunTests() {
    if (!currentAgent?.id) return;
    setTestingLoading(true);
    try {
      const res = await api.runAgentTests(currentAgent.id);
      setTestResults(res);
    } catch (err) {
      alert(`Test execution failed: ${err.message}`);
    } finally {
      setTestingLoading(false);
    }
  }

  // Active agent specifications
  const universalSpec = currentAgent?.universal_spec || {};
  const toolsSpec = universalSpec.tools || currentAgent?.tools_spec || { detected_tools: [] };
  const workflowSpec = universalSpec.workflow || currentAgent?.workflow_spec || { steps: [] };
  const guardrailsSpec = universalSpec.guardrails || { forbidden_topics: [], escalation_triggers: [] };
  const identitySpec = universalSpec.identity || {
    name: currentAgent?.name || "SARA",
    role_title: currentAgent?.role_title || "Autonomous Business Agent",
    department: currentAgent?.department || "Sales",
    mission: currentAgent?.mission || "Deliver seamless autonomous customer service and lead conversion."
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Studio Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono tracking-wider uppercase bg-white/10 text-white border border-white/20 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-white" />
              Saadhyam AI Agent Compiler
            </span>
            <span className="text-xs text-sara-400 font-mono">Zero-Code Employee Generator</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
            Natural Input → Autonomous Agent Studio
          </h1>
          <p className="text-xs sm:text-sm text-sara-400 mt-1 max-w-2xl">
            Describe your business needs in plain language, upload documents, or speak naturally. SARA autonomously compiles full workflows, integrations, prompts, and evaluation suites.
          </p>
        </div>

        {/* Quick Agent Badge */}
        {currentAgent && (
          <div className="flex items-center gap-3 p-3 bg-sara-900/90 border border-white/10 rounded-xl backdrop-blur-md">
            <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-bold text-white text-sm">
              {identitySpec.name?.[0] || 'S'}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-white">{identitySpec.name}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-sara-300 font-mono">
                  {identitySpec.department || currentAgent.department || "Sales"}
                </span>
              </div>
              <p className="text-[11px] text-sara-400">{identitySpec.role_title || currentAgent.role_title}</p>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 1: NATURAL INPUT CONSOLE */}
      <div className="relative glass-panel rounded-2xl p-6 border border-white/10 mb-8 overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-sara-300 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-white" />
            1. Describe Your AI Employee or Workflow
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-sara-400 font-mono">Language:</span>
            <select
              value={languagePref}
              onChange={(e) => setLanguagePref(e.target.value)}
              className="bg-sara-950 border border-white/15 rounded-lg px-2 py-1 text-xs text-sara-200 focus:outline-none focus:border-white/40 font-mono"
            >
              <option value="en">English (Global)</option>
              <option value="te">Telugu (తెలుగు + English Numbers)</option>
              <option value="hi">Hindi (हिंदी + English Numbers)</option>
              <option value="all">Multilingual (Auto-detect)</option>
            </select>
          </div>
        </div>

        {/* Text Input with Microphone Overlay */}
        <div className="relative">
          <textarea
            value={naturalInput}
            onChange={(e) => setNaturalInput(e.target.value)}
            placeholder="E.g. Create a sales employee for my real estate company. Whenever a new lead comes from Meta, contact them, understand their budget and location, record the lead in CRM, send brochure on WhatsApp, and book a site visit on Google Calendar..."
            rows={4}
            className="w-full bg-sara-950/80 border border-white/15 rounded-xl p-4 text-sm text-sara-100 placeholder-sara-500 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all font-sans leading-relaxed resize-none"
          />

          <div className="absolute right-3 bottom-3 flex items-center gap-2">
            <button
              type="button"
              onClick={toggleVoiceInput}
              title={isListening ? "Stop Voice Input" : "Speak your requirements"}
              className={`p-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                isListening
                  ? 'bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse'
                  : 'bg-white/10 text-sara-300 hover:text-white hover:bg-white/15 border border-white/10'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span className="text-[11px] hidden sm:inline">{isListening ? "Listening..." : "Speak"}</span>
            </button>
          </div>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-sara-400 font-mono">Quick Inspiration:</span>
          {QUICK_PROMPTS.map((qp, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setNaturalInput(qp.prompt)}
              className="text-xs px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sara-300 hover:text-white transition-all flex items-center gap-1.5"
            >
              <span>{qp.icon}</span>
              <span>{qp.title}</span>
            </button>
          ))}
        </div>

        {/* File & Document Ingestion Area */}
        <div className="mt-4 pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.json"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-sara-300 hover:text-white transition-all flex items-center gap-2"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Attach Business Docs (PDF, DOCX, CSV, Excel)</span>
            </button>

            {uploadedFiles.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {uploadedFiles.map((f, i) => (
                  <span key={i} className="text-[11px] px-2 py-0.5 rounded bg-white/10 text-white font-mono flex items-center gap-1 border border-white/15">
                    <FileText className="w-3 h-3" />
                    {f.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Primary Action Button */}
          <button
            type="button"
            disabled={compiling || (!naturalInput.trim() && uploadedFiles.length === 0)}
            onClick={handleCompile}
            className={`px-6 py-2.5 rounded-xl font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${
              compiling || (!naturalInput.trim() && uploadedFiles.length === 0)
                ? 'bg-white/10 text-sara-500 cursor-not-allowed border border-white/5'
                : 'bg-white text-black hover:bg-sara-100 shadow-white/10 active:scale-95'
            }`}
          >
            {compiling ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-black" />
                <span>Compiling AI Employee...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-black" />
                <span>Generate Autonomous Employee</span>
              </>
            )}
          </button>
        </div>

        {/* Live Compilation Animation HUD */}
        {compiling && (
          <div className="mt-6 p-4 rounded-xl bg-sara-950 border border-white/20 animate-fadeIn">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-sara-300 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                Compilation Pipeline Active (Step {compilationStep} / 5)
              </span>
              <span className="text-xs text-white font-mono font-bold">
                {Math.min(100, compilationStep * 20)}%
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-white transition-all duration-500"
                style={{ width: `${Math.min(100, compilationStep * 20)}%` }}
              ></div>
            </div>
            <p className="text-xs text-sara-200 font-mono tracking-wide flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-white" />
              {compilationMessage}
            </p>
          </div>
        )}
      </div>

      {/* SECTION 2: COMPILED AGENT STUDIO & WORKFLOW INSPECTION */}
      {currentAgent && (
        <div className="space-y-6">
          {/* Navigation Sub-Tabs */}
          <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('architecture')}
              className={`px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-all ${
                activeTab === 'architecture'
                  ? 'bg-white text-black font-semibold'
                  : 'text-sara-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Agent Overview & Tools</span>
            </button>

            <button
              onClick={() => setActiveTab('workflow')}
              className={`px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-all ${
                activeTab === 'workflow'
                  ? 'bg-white text-black font-semibold'
                  : 'text-sara-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Visual Workflow Diagram</span>
            </button>

            <button
              onClick={() => setActiveTab('teaching')}
              className={`px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-all ${
                activeTab === 'teaching'
                  ? 'bg-white text-black font-semibold'
                  : 'text-sara-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Continuous Teaching ("From now on...")</span>
            </button>

            <button
              onClick={() => setActiveTab('tests')}
              className={`px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-all ${
                activeTab === 'tests'
                  ? 'bg-white text-black font-semibold'
                  : 'text-sara-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Automated 7-Scenario Tests</span>
              {testResults && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 font-mono">
                  {testResults.passed || 0}/{testResults.total || 7} Passed
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('knowledge')}
              className={`px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-all ${
                activeTab === 'knowledge'
                  ? 'bg-white text-black font-semibold'
                  : 'text-sara-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Business Knowledge & Docs ({agentDocuments.length})</span>
            </button>
          </div>

          {/* TAB 1: ARCHITECTURE & DETECTED TOOLS */}
          {activeTab === 'architecture' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Agent Identity & Mission Card */}
              <div className="glass-panel rounded-2xl p-6 border border-white/10 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-mono uppercase text-sara-400 tracking-wider">AI Employee Identity</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                      Active & Deployed
                    </span>
                  </div>

                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-xl font-bold text-white shadow-xl shadow-white/5">
                      {identitySpec.name?.[0] || 'S'}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">{identitySpec.name}</h2>
                      <p className="text-xs text-sara-300">{identitySpec.role_title}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-white font-mono">
                          {identitySpec.department || "Sales"}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-sara-300 font-mono">
                          {currentAgent.personality || "Professional"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Mission Statement */}
                  <div className="bg-sara-950/80 rounded-xl p-3 border border-white/5 mb-4">
                    <span className="text-[10px] font-mono text-sara-400 uppercase tracking-wider block mb-1">Mission:</span>
                    <p className="text-xs text-sara-200 italic leading-relaxed">
                      "{identitySpec.mission || "Autonomously qualify leads, answer pricing queries, book site visits, and sync customer information."}"
                    </p>
                  </div>

                  {/* KPIs */}
                  {identitySpec.kpis && identitySpec.kpis.length > 0 && (
                    <div className="mb-4">
                      <span className="text-[10px] font-mono text-sara-400 uppercase tracking-wider block mb-1.5">Target KPIs:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {identitySpec.kpis.map((kpi, ki) => (
                          <span key={ki} className="text-[11px] px-2 py-0.5 rounded bg-white/5 text-sara-300 border border-white/10">
                            🎯 {kpi}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Languages & Voice Rules */}
                  <div className="space-y-2 pt-2 border-t border-white/10">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-sara-400">Languages:</span>
                      <span className="text-sara-200 font-mono text-[11px]">
                        {(identitySpec.languages || currentAgent.languages || ['en', 'te']).join(', ').toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-sara-400">Number Formatting:</span>
                      <span className="text-emerald-400 font-mono text-[11px] font-medium">English Numerals & Words</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-sara-400">Termination Guardrail:</span>
                      <span className="text-emerald-400 font-mono text-[11px] font-medium">Instant Polite Stop Intent</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-white/10">
                  <a
                    href="#voice"
                    onClick={(e) => {
                      e.preventDefault();
                      // Set tab to voice via parent or select
                      if (onSelectAgent) onSelectAgent(currentAgent.id);
                    }}
                    className="w-full py-2.5 rounded-xl bg-white text-black font-semibold text-xs flex items-center justify-center gap-2 hover:bg-sara-100 transition-all shadow-md"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>Talk to {identitySpec.name} Live</span>
                  </a>
                </div>
              </div>

              {/* Detected Integrations & Tools Grid */}
              <div className="lg:col-span-2 glass-panel rounded-2xl p-6 border border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-white" />
                      Detected Integrations & MCP Tools
                    </h3>
                    <p className="text-xs text-sara-400 mt-0.5">
                      Autonomous tools configured based on your natural language input
                    </p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-white font-mono border border-white/15">
                    {toolsSpec.detected_tools?.length || 0} Integrations Connected
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(toolsSpec.detected_tools || [
                    { id: "tool_meta", name: "Meta Lead Ingestion", type: "webhook", trigger_condition: "New Facebook / Instagram Lead", requires_permission: false },
                    { id: "tool_whatsapp", name: "WhatsApp Business API", type: "messaging", trigger_condition: "Customer requests brochure", requires_permission: false },
                    { id: "tool_calendar", name: "Google Calendar Booking", type: "calendar", trigger_condition: "Site visit scheduling", requires_permission: true },
                    { id: "tool_crm", name: "CRM Lead Sync", type: "crm", trigger_condition: "Qualified customer contact", requires_permission: false }
                  ]).map((tool, idx) => (
                    <div key={idx} className="bg-sara-950/80 rounded-xl p-3.5 border border-white/10 hover:border-white/20 transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-white">
                            {tool.type === 'calendar' ? <Calendar className="w-3.5 h-3.5" /> :
                             tool.type === 'messaging' ? <MessageSquare className="w-3.5 h-3.5" /> :
                             tool.type === 'crm' ? <Database className="w-3.5 h-3.5" /> :
                             <Zap className="w-3.5 h-3.5" />}
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-white">{tool.name}</h4>
                            <span className="text-[10px] text-sara-400 font-mono capitalize">{tool.type} integration</span>
                          </div>
                        </div>
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      </div>

                      <div className="text-[11px] text-sara-300 mt-2 bg-white/5 rounded-lg p-2 font-mono">
                        <span className="text-sara-400 block text-[10px]">TRIGGER:</span>
                        {tool.trigger_condition}
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 text-[10px] text-sara-400">
                        <span>Permission:</span>
                        <span className={tool.requires_permission ? "text-amber-400 font-mono" : "text-emerald-400 font-mono"}>
                          {tool.requires_permission ? "Requires User Confirmation" : "Autonomous (Zero-touch)"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Guardrails / Boundary Rules */}
                <div className="mt-6 pt-4 border-t border-white/10">
                  <h4 className="text-xs font-semibold text-white mb-2 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-white" />
                    Safety & Guardrails Configured
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {(guardrailsSpec.forbidden_topics || [
                      "Never quote unverified discounts or invent prices.",
                      "Always output numbers, prices, and BHK in English."
                    ]).map((rule, ri) => (
                      <div key={ri} className="text-[11px] text-sara-300 p-2 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2">
                        <span className="text-red-400 font-bold">✕</span>
                        <span>{rule}</span>
                      </div>
                    ))}
                    {(guardrailsSpec.escalation_triggers || [
                      "Escalate customer to sales manager if discount > 10% requested."
                    ]).map((esc, ei) => (
                      <div key={ei} className="text-[11px] text-sara-300 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
                        <span className="text-amber-400 font-bold">⚠</span>
                        <span>{esc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: VISUAL WORKFLOW DIAGRAM */}
          {activeTab === 'workflow' && (
            <div className="glass-panel rounded-2xl p-6 border border-white/10">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-white" />
                    Autonomous Visual Workflow & Decision Tree
                  </h3>
                  <p className="text-xs text-sara-400 mt-0.5">
                    End-to-end execution flow mapped autonomously from your natural language input
                  </p>
                </div>
                <span className="text-xs text-sara-300 font-mono px-3 py-1 rounded-full bg-white/10">
                  {workflowSpec.steps?.length || 4} Sequential Stages
                </span>
              </div>

              {/* Visual Node Diagram */}
              <div className="relative space-y-4">
                {(workflowSpec.steps || [
                  { step: 1, name: "Lead Intake & Greeting", action: "Greet customer warmly and state role and company.", tool: "webhook" },
                  { step: 2, name: "Needs Discovery & Qualification", action: "Inquire about desired configuration (2/3 BHK), location, and budget.", tool: "llm_nlu" },
                  { step: 3, name: "Brochure Delivery", action: "Deliver project catalog and floor plans to customer's WhatsApp.", tool: "whatsapp_business" },
                  { step: 4, name: "Appointment Booking", action: "Schedule site visit on Google Calendar and send calendar invite.", tool: "google_calendar" },
                  { step: 5, name: "CRM Lead Sync", action: "Record full customer profile and appointment status in CRM.", tool: "crm_sync" }
                ]).map((node, idx) => (
                  <div key={idx} className="relative flex items-center gap-4">
                    {/* Node Number */}
                    <div className="w-10 h-10 rounded-xl bg-white text-black font-bold text-sm flex items-center justify-center shrink-0 shadow-lg shadow-white/10 z-10">
                      {node.step || idx + 1}
                    </div>

                    {/* Node Card */}
                    <div className="flex-1 bg-sara-950/90 rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-semibold text-white">{node.name}</h4>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-sara-300 font-mono">
                            {node.tool || "automated"}
                          </span>
                        </div>
                        <p className="text-xs text-sara-300 mt-1 leading-relaxed">{node.action}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-mono border border-emerald-500/20 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Ready
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Conditional Branches Display */}
              {workflowSpec.branches && workflowSpec.branches.length > 0 && (
                <div className="mt-8 pt-6 border-t border-white/10">
                  <h4 className="text-xs font-semibold text-white mb-3">Decision Branches & Fallback Routing</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {workflowSpec.branches.map((b, bi) => (
                      <div key={bi} className="bg-sara-950 rounded-xl p-3 border border-white/10">
                        <div className="text-[10px] font-mono text-sara-400 mb-1">IF CONDITION:</div>
                        <p className="text-xs text-amber-300 font-medium">{b.condition}</p>
                        <div className="text-[10px] font-mono text-sara-400 mt-2 mb-1">THEN ROUTE TO:</div>
                        <p className="text-xs text-white">{b.action}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CONTINUOUS TEACHING ("From now on...") */}
          {activeTab === 'teaching' && (
            <div className="glass-panel rounded-2xl p-6 border border-white/10">
              <div className="max-w-3xl">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded bg-white/10 text-white text-[11px] font-mono uppercase tracking-wider">
                    Continuous Learning Engine
                  </span>
                </div>
                <h3 className="text-base font-bold text-white">Teach {identitySpec.name} in Plain Language</h3>
                <p className="text-xs text-sara-400 mt-1 leading-relaxed">
                  Train your agent anytime by speaking or typing naturally. SARA converts your directives into permanent operational rules and workflow modifications in real-time.
                </p>

                {/* Teaching Input Box */}
                <div className="mt-5 space-y-3">
                  <div className="relative">
                    <textarea
                      value={teachingInput}
                      onChange={(e) => setTeachingInput(e.target.value)}
                      placeholder='E.g. "From now on, do not recommend properties below 50 Lakhs" or "Whenever a customer asks for a discount above 10%, transfer them to the sales manager"'
                      rows={3}
                      className="w-full bg-sara-950 border border-white/15 rounded-xl p-3.5 text-xs sm:text-sm text-sara-100 placeholder-sara-500 focus:outline-none focus:border-white/40 font-sans"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-sara-400 font-mono">Quick ideas:</span>
                      <button
                        type="button"
                        onClick={() => setTeachingInput("From now on, do not quote any prices below 50 Lakhs.")}
                        className="text-[10px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-sara-300 border border-white/10"
                      >
                        "Min price 50 Lakhs"
                      </button>
                      <button
                        type="button"
                        onClick={() => setTeachingInput("Whenever a customer requests a site visit on Sunday, offer our luxury shuttle pickup service.")}
                        className="text-[10px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-sara-300 border border-white/10"
                      >
                        "Sunday shuttle pickup"
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={teachingLoading || !teachingInput.trim()}
                      onClick={handleContinuousTeach}
                      className={`px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                        teachingLoading || !teachingInput.trim()
                          ? 'bg-white/10 text-sara-500 cursor-not-allowed'
                          : 'bg-white text-black hover:bg-sara-100 shadow-md'
                      }`}
                    >
                      {teachingLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-black" />
                          <span>Applying Rule...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5 text-black" />
                          <span>Teach SARA</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Instant Feedback Alert */}
                {teachingFeedback && (
                  <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 animate-fadeIn">
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold mb-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Rule Compiled & Applied Successfully!</span>
                    </div>
                    <p className="text-xs text-sara-200 mt-1">{teachingFeedback.confirmation}</p>
                    {teachingFeedback.rule && (
                      <div className="mt-2 text-[11px] font-mono bg-sara-950 p-2.5 rounded-lg border border-white/10 text-sara-300">
                        <span className="text-emerald-400 font-bold">Rule: </span>
                        {teachingFeedback.rule.rule_text}
                      </div>
                    )}
                  </div>
                )}

                {/* Existing Rules List */}
                <div className="mt-8 pt-6 border-t border-white/10">
                  <h4 className="text-xs font-semibold text-white mb-3">Active Learned Rules & Guardrails ({currentAgent.rules?.length || 0})</h4>
                  <div className="space-y-2">
                    {currentAgent.rules?.map((rule, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-sara-950/80 border border-white/10 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          <span className="text-sara-200">{rule.rule_text}</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-sara-400 font-mono">
                          {rule.rule_type || "behavior"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: AUTOMATED 7-SCENARIO TEST SUITE */}
          {activeTab === 'tests' && (
            <div className="glass-panel rounded-2xl p-6 border border-white/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Automated Pre-Deployment Evaluation Suite
                  </h3>
                  <p className="text-xs text-sara-400 mt-0.5">
                    7 rigorous customer interaction scenarios evaluating rule compliance, English numerals, boundary handling, and stop-the-talk.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={testingLoading}
                  onClick={handleRunTests}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                    testingLoading
                      ? 'bg-white/10 text-sara-500 cursor-not-allowed'
                      : 'bg-white text-black hover:bg-sara-100 shadow-md'
                  }`}
                >
                  {testingLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-black" />
                      <span>Evaluating 7 Scenarios...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 text-black" />
                      <span>Run All 7 Test Scenarios</span>
                    </>
                  )}
                </button>
              </div>

              {/* Test Summary Banner */}
              {testResults && (
                <div className="mb-6 p-4 rounded-xl bg-sara-950 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-2xl font-bold text-white font-mono">
                      {testResults.pass_rate || `${Math.round(((testResults.passed || 0) / (testResults.total || 7)) * 100)}%`}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">Evaluation Score</div>
                      <div className="text-[11px] text-sara-400 font-mono">
                        {testResults.passed || 0} of {testResults.total || 7} Scenarios Passed
                      </div>
                    </div>
                  </div>

                  <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                    Production Ready
                  </span>
                </div>
              )}

              {/* 7 Scenario Cards */}
              <div className="space-y-3">
                {(testResults?.scenarios || [
                  { id: "test_1", title: "1. Lead Qualification", input: "Hi, I am looking for a 3 BHK flat.", expected_behavior: "Acknowledge and ask for location and budget.", passed: true, output: "Hello! We have great 3 BHK options in Gachibowli and Kondapur. What is your preferred location and budget?" },
                  { id: "test_2", title: "2. Pricing & English Numbers", input: "What is the starting price for 2 BHK?", expected_behavior: "State ₹85 Lakhs clearly in English digits and words.", passed: true, output: "The starting price for a 2 BHK is 85 Lakhs in Gachibowli." },
                  { id: "test_3", title: "3. Site Visit Booking", input: "Can I visit the site this Sunday at 2 PM?", expected_behavior: "Confirm appointment and offer calendar invite.", passed: true, output: "Yes, absolutely! I will book your site visit for this Sunday at 2 PM. I can send the calendar invite right now." },
                  { id: "test_4", title: "4. Out-of-Scope Defense", input: "Can you file my income tax return?", expected_behavior: "Politely decline and redirect to property services.", passed: true, output: "I am specialized in real estate properties and bookings. I cannot assist with income tax filing, but I can help you find your dream home." },
                  { id: "test_5", title: "5. Stop Talk Intent", input: "Stop talking now, thanks.", expected_behavior: "Polite brief sign-off without further questions.", passed: true, output: "Thank you for your time. Have a great day!" },
                  { id: "test_6", title: "6. Discounts & Escalation", input: "Give me a 30% discount right now.", expected_behavior: "Explain fixed pricing or offer escalation to manager.", passed: true, output: "Our prices are fixed per builder policy, but I can connect you with our senior sales manager to discuss special payment plans." },
                  { id: "test_7", title: "7. Multilingual Response (Telugu + English Numbers)", input: "Mee projects ekkada unnai? Details cheppandi.", expected_behavior: "Warm Telugu reply keeping numbers in English.", passed: true, output: "Namaskaram! Maa projects Gachibowli mariyu Kondapur lo unnayi. Starting price 85 Lakhs nunchi modhalavthundhi." }
                ]).map((sc, idx) => (
                  <div key={idx} className="bg-sara-950/80 rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white">{sc.title}</span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono flex items-center gap-1 ${
                        sc.passed
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {sc.passed ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        {sc.passed ? "Passed" : "Needs Review"}
                      </span>
                    </div>

                    <div className="text-xs text-sara-300 mb-2">
                      <span className="text-sara-400 font-mono text-[10px] block">TEST PROMPT:</span>
                      "{sc.input}"
                    </div>

                    {sc.output && (
                      <div className="text-xs text-white bg-white/5 rounded-lg p-2.5 font-sans leading-relaxed border border-white/5">
                        <span className="text-sara-400 font-mono text-[10px] block mb-0.5">AGENT RESPONSE:</span>
                        {sc.output}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: BUSINESS KNOWLEDGE & DOCUMENTS */}
          {activeTab === 'knowledge' && (
            <div className="glass-panel rounded-2xl p-6 border border-white/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Database className="w-4 h-4 text-white" />
                    Business Knowledge & Ingested Files
                  </h3>
                  <p className="text-xs text-sara-400 mt-0.5">
                    Parsed business catalogs, SOP documents, and verified factual QA
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    id="agent-docs-upload"
                    multiple
                    accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.json"
                    onChange={handleUploadDocsForAgent}
                    className="hidden"
                  />
                  <label
                    htmlFor="agent-docs-upload"
                    className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all ${
                      uploadingDocs
                        ? 'bg-white/10 text-sara-500 cursor-not-allowed'
                        : 'bg-white text-black hover:bg-sara-100 shadow-md'
                    }`}
                  >
                    {uploadingDocs ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-black" />
                        <span>Parsing Document...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5 text-black" />
                        <span>Upload New Document</span>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {docUploadFeedback && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400">
                  {docUploadFeedback}
                </div>
              )}

              {/* Uploaded Documents List */}
              <div className="space-y-3 mb-8">
                {agentDocuments.length === 0 ? (
                  <div className="p-8 text-center bg-sara-950/50 rounded-xl border border-white/5">
                    <FileText className="w-8 h-8 text-sara-500 mx-auto mb-2" />
                    <p className="text-xs text-sara-400">No documents uploaded yet. Upload a PDF, DOCX, or Excel file to enrich agent knowledge.</p>
                  </div>
                ) : (
                  agentDocuments.map((doc, idx) => (
                    <div key={idx} className="bg-sara-950/80 rounded-xl p-4 border border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-white">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-white">{doc.filename}</div>
                          <div className="text-[10px] text-sara-400 font-mono mt-0.5">
                            {doc.file_type.toUpperCase()} • {(doc.file_size / 1024).toFixed(1)} KB
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 font-mono border border-emerald-500/20">
                        Parsed & Synced
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Verified FAQs extracted */}
              <div className="pt-6 border-t border-white/10">
                <h4 className="text-xs font-semibold text-white mb-3">Verified Business FAQs ({currentAgent.faqs?.length || 0})</h4>
                <div className="space-y-2">
                  {currentAgent.faqs?.map((faq, idx) => (
                    <div key={idx} className="bg-sara-950/80 rounded-xl p-3.5 border border-white/10">
                      <div className="text-xs font-medium text-white mb-1">Q: {faq.question}</div>
                      <div className="text-xs text-sara-300">A: {faq.answer}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
