import React, { useState, useEffect } from 'react';
import { 
  Building2, Briefcase, Info, BookOpen, ShieldAlert, 
  Sparkles, Languages, Volume2, FileText, Rocket, 
  Plus, Trash2, Play, Check, ChevronRight, ChevronLeft, RefreshCw
} from 'lucide-react';
import { api } from '../../services/api';

const STEPS = [
  { id: 1, title: 'Business', icon: Building2 },
  { id: 2, title: 'Services', icon: Briefcase },
  { id: 3, title: 'Business Info', icon: Info },
  { id: 4, title: 'FAQs', icon: BookOpen },
  { id: 5, title: 'Rules', icon: ShieldAlert },
  { id: 6, title: 'Personality', icon: Sparkles },
  { id: 7, title: 'Languages', icon: Languages },
  { id: 8, title: 'Voice', icon: Volume2 },
  { id: 9, title: 'Prompt', icon: FileText },
  { id: 10, title: 'Deploy', icon: Rocket }
];

export default function AgentBuilder({ onAgentCreated, onSelectAgent }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [categories, setCategories] = useState({});
  const [voices, setVoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState(null);
  const [audioElem, setAudioElem] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: 'SARA',
    role_title: 'Real Estate Assistant',
    business_type: 'Real Estate',
    service_type: 'Property enquiries',
    selectedServices: ['Property enquiries', 'Pricing questions', 'Site visit booking'],
    business_name: 'ABC Properties',
    description: 'ABC Properties is a premier real estate company operating in Hyderabad.',
    locations: 'Gachibowli, Kondapur, Kokapet',
    operating_hours: '9:00 AM – 7:00 PM IST',
    contact_info: '+91 9876543210 / contact@abcproperties.example.com',
    important_policies: 'Transparent pricing, no hidden brokerage for direct buyers.',
    personality: 'Professional & Friendly',
    communication_style: 'Concise',
    sales_behavior: 'Consultative',
    languages: ['en', 'te', 'hi'],
    voice_id: 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4',
    voice_gender: 'female',
    voice_name: 'Skylar',
    faqs: [
      { question: 'What is the starting price for a 2 BHK?', answer: 'The starting price for a 2 BHK is ₹85 Lakhs.', category: 'Pricing', priority: 1 },
      { question: 'Where are your projects located?', answer: 'Our projects are located in Gachibowli, Kondapur, and Kokapet.', category: 'Locations', priority: 1 },
      { question: 'Can I schedule a site visit?', answer: 'Yes! We arrange site visits daily between 10 AM and 6 PM.', category: 'Booking', priority: 1 }
    ],
    rules: [
      'Never invent prices or discounts not listed in business knowledge.',
      'Never promise unavailable inventory or unverified offers.',
      'If information is unavailable, politely offer human representative assistance.',
      'Never mention internal AI models or architecture.',
      'Ask one question at a time to maintain conversational flow.'
    ]
  });

  const [generatedPrompt, setGeneratedPrompt] = useState(null);
  const [newFaq, setNewFaq] = useState({ question: '', answer: '', category: 'General' });
  const [newRule, setNewRule] = useState('');

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    try {
      const [catData, voiceData] = await Promise.all([
        api.getCategories().catch(() => ({})),
        api.getVoices().catch(() => [])
      ]);
      setCategories(catData);
      setVoices(voiceData);
    } catch (err) {
      console.error('Error loading builder metadata:', err);
    }
  }

  function handleSelectBusiness(bType) {
    const template = categories[bType] || {};
    setFormData(prev => ({
      ...prev,
      business_type: bType,
      role_title: template.role_title || 'Business Representative',
      service_type: template.services ? template.services[0] : 'General Inquiry',
      selectedServices: template.services ? template.services.slice(0, 3) : ['General Inquiry'],
      faqs: template.faqs && template.faqs.length > 0 ? template.faqs : prev.faqs,
      rules: template.rules && template.rules.length > 0 ? template.rules : prev.rules
    }));
  }

  function toggleService(svc) {
    setFormData(prev => {
      const exists = prev.selectedServices.includes(svc);
      const updated = exists 
        ? prev.selectedServices.filter(s => s !== svc)
        : [...prev.selectedServices, svc];
      return { ...prev, selectedServices: updated, service_type: updated[0] || 'General Inquiry' };
    });
  }

  function toggleLanguage(lang) {
    setFormData(prev => {
      const exists = prev.languages.includes(lang);
      const updated = exists 
        ? prev.languages.filter(l => l !== lang)
        : [...prev.languages, lang];
      return { ...prev, languages: updated.length > 0 ? updated : ['en'] };
    });
  }

  function addFaq() {
    if (!newFaq.question.trim() || !newFaq.answer.trim()) return;
    setFormData(prev => ({
      ...prev,
      faqs: [...prev.faqs, { ...newFaq, priority: 1 }]
    }));
    setNewFaq({ question: '', answer: '', category: 'General' });
  }

  function removeFaq(idx) {
    setFormData(prev => ({
      ...prev,
      faqs: prev.faqs.filter((_, i) => i !== idx)
    }));
  }

  function addRule() {
    if (!newRule.trim()) return;
    setFormData(prev => ({
      ...prev,
      rules: [...prev.rules, newRule.trim()]
    }));
    setNewRule('');
  }

  function removeRule(idx) {
    setFormData(prev => ({
      ...prev,
      rules: prev.rules.filter((_, i) => i !== idx)
    }));
  }

  function playVoicePreview(voiceId) {
    if (audioElem) {
      audioElem.pause();
    }
    if (playingVoiceId === voiceId) {
      setPlayingVoiceId(null);
      return;
    }

    const previewUrl = api.getVoicePreviewUrl(voiceId, "Namaste! I am SARA, your AI voice agent.");
    const audio = new Audio(previewUrl);
    setAudioElem(audio);
    setPlayingVoiceId(voiceId);

    audio.onended = () => setPlayingVoiceId(null);
    audio.onerror = () => setPlayingVoiceId(null);
    audio.play();
  }

  async function handleGeneratePreview() {
    // Generate prompt dynamically
    const bizDict = {
      business_name: formData.business_name,
      description: formData.description,
      locations: formData.locations.split(',').map(s => s.trim()),
      services: formData.selectedServices,
      operating_hours: formData.operating_hours,
      contact_info: formData.contact_info,
      important_policies: formData.important_policies
    };

    setGeneratedPrompt({
      identity: `You are ${formData.name}, a voice representative for ${formData.business_name}. Role: ${formData.role_title}. Personality: ${formData.personality}. Communication Style: ${formData.communication_style} (1-3 short spoken sentences).`,
      business: `Business: ${formData.business_name}. Locations: ${formData.locations}. Offerings: ${formData.selectedServices.join(', ')}. Hours: ${formData.operating_hours}.`,
      languages: `Supported: ${formData.languages.join(', ').toUpperCase()}. Mirror user language (English, Telugu, Hindi) and support natural Indian code-switching.`,
      faqs: formData.faqs.map(f => `[${f.category}] Q: ${f.question} -> A: ${f.answer}`).join('\n'),
      rules: formData.rules.map(r => `- ${r}`).join('\n'),
      greeting: `Hi, welcome to ${formData.business_name}. I'm ${formData.name}. How can I help you today?`
    });
  }

  async function handleDeploy() {
    setLoading(true);
    try {
      const payload = {
        name: formData.name,
        role_title: formData.role_title,
        business_type: formData.business_type,
        service_type: formData.service_type,
        personality: formData.personality,
        communication_style: formData.communication_style,
        sales_behavior: formData.sales_behavior,
        languages: formData.languages,
        voice_id: formData.voice_id,
        voice_gender: formData.voice_gender,
        voice_name: formData.voice_name,
        is_active: true,
        business_profile: {
          business_name: formData.business_name,
          description: formData.description,
          industry: formData.business_type,
          locations: formData.locations.split(',').map(s => s.trim()),
          services_offered: formData.selectedServices,
          operating_hours: formData.operating_hours,
          contact_info: formData.contact_info,
          important_policies: formData.important_policies
        },
        faqs: formData.faqs,
        rules: formData.rules.map(r => ({ rule_text: r, rule_type: 'behavior', is_active: true }))
      };

      const created = await api.createAgent(payload);
      if (onAgentCreated) onAgentCreated(created);
      if (onSelectAgent) onSelectAgent(created.id);
    } catch (err) {
      alert(`Deployment notice: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6">
      {/* Step Progress Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4 overflow-x-auto pb-2">
          {STEPS.map((s) => {
            const Icon = s.icon;
            const isDone = s.id < currentStep;
            const isActive = s.id === currentStep;
            return (
              <button
                key={s.id}
                onClick={() => setCurrentStep(s.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
                  isActive 
                    ? 'bg-white text-black font-semibold shadow-md' 
                    : isDone 
                      ? 'text-sara-200 hover:text-white bg-white/5' 
                      : 'text-sara-500 hover:text-sara-300'
                }`}
              >
                {isDone ? (
                  <Check className="w-3.5 h-3.5 text-white" />
                ) : (
                  <Icon className="w-3.5 h-3.5" />
                )}
                <span>0{s.id} {s.title}</span>
              </button>
            );
          })}
        </div>
        <div className="w-full bg-sara-800 h-1 rounded-full overflow-hidden">
          <div 
            className="bg-white h-full transition-all duration-300"
            style={{ width: `${(currentStep / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Step Content Card */}
      <div className="glass-panel rounded-2xl p-6 sm:p-8 border border-white/5 mb-6">
        
        {/* Step 1: Business Selection */}
        {currentStep === 1 && (
          <div>
            <h2 className="text-xl font-semibold text-white mb-1">Select Business Category</h2>
            <p className="text-xs text-sara-400 mb-6">Choose the industry template for SARA. Configures services and FAQs automatically.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {[
                { name: 'Real Estate', desc: 'Property inquiries, 2/3 BHK pricing, site visits' },
                { name: 'College / University', desc: 'Admissions, fees, CSE eligibility, hostel' },
                { name: 'Product Sales', desc: 'Features, warranty, pricing, product recommendations' },
                { name: 'Healthcare', desc: 'Doctor appointments, timings, clinic queries' },
                { name: 'Custom Business', desc: 'Tailored for any custom enterprise workflow' },
              ].map((b) => (
                <div
                  key={b.name}
                  onClick={() => handleSelectBusiness(b.name)}
                  className={`p-4 rounded-xl cursor-pointer border transition-all ${
                    formData.business_type === b.name
                      ? 'bg-white/10 border-white text-white shadow-lg'
                      : 'bg-sara-900/60 border-white/5 text-sara-300 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-medium text-sm text-white">{b.name}</span>
                    {formData.business_type === b.name && <Check className="w-4 h-4 text-white" />}
                  </div>
                  <p className="text-xs text-sara-400">{b.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Services Selection */}
        {currentStep === 2 && (
          <div>
            <h2 className="text-xl font-semibold text-white mb-1">Select Active Services</h2>
            <p className="text-xs text-sara-400 mb-6">Which services or use-cases should SARA assist callers with?</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(categories[formData.business_type]?.services || [
                'General enquiries', 'Pricing questions', 'Booking assistance', 'Customer support'
              ]).map((svc) => {
                const isSelected = formData.selectedServices.includes(svc);
                return (
                  <div
                    key={svc}
                    onClick={() => toggleService(svc)}
                    className={`p-3.5 rounded-lg cursor-pointer border flex items-center justify-between transition-all ${
                      isSelected
                        ? 'bg-white/10 border-white text-white'
                        : 'bg-sara-900/40 border-white/5 text-sara-300 hover:border-white/20'
                    }`}
                  >
                    <span className="text-xs font-medium">{svc}</span>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="accent-white rounded cursor-pointer"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Business Information */}
        {currentStep === 3 && (
          <div>
            <h2 className="text-xl font-semibold text-white mb-1">Business Profile Information</h2>
            <p className="text-xs text-sara-400 mb-6">Ground SARA with exact facts. The agent will never hallucinate beyond these details.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-sara-300 mb-1.5">Business Name</label>
                <input
                  type="text"
                  value={formData.business_name}
                  onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                  className="w-full bg-sara-900 border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-sara-300 mb-1.5">Agent Role Title</label>
                <input
                  type="text"
                  value={formData.role_title}
                  onChange={(e) => setFormData({ ...formData, role_title: e.target.value })}
                  className="w-full bg-sara-900 border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-sara-300 mb-1.5">Description & Value Proposition</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-sara-900 border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-sara-300 mb-1.5">Locations / Branches</label>
                <input
                  type="text"
                  value={formData.locations}
                  onChange={(e) => setFormData({ ...formData, locations: e.target.value })}
                  placeholder="Gachibowli, Kondapur, Kokapet"
                  className="w-full bg-sara-900 border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-sara-300 mb-1.5">Operating Hours</label>
                <input
                  type="text"
                  value={formData.operating_hours}
                  onChange={(e) => setFormData({ ...formData, operating_hours: e.target.value })}
                  placeholder="9:00 AM – 7:00 PM IST"
                  className="w-full bg-sara-900 border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-sara-300 mb-1.5">Contact Details & Policy</label>
                <input
                  type="text"
                  value={formData.contact_info}
                  onChange={(e) => setFormData({ ...formData, contact_info: e.target.value })}
                  className="w-full bg-sara-900 border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Knowledge / FAQ Builder */}
        {currentStep === 4 && (
          <div>
            <h2 className="text-xl font-semibold text-white mb-1">Knowledge & FAQ Builder</h2>
            <p className="text-xs text-sara-400 mb-6">Configure exact verified answers. Prioritized over general LLM intuition.</p>

            <div className="space-y-3 mb-6">
              {formData.faqs.map((faq, idx) => (
                <div key={idx} className="p-3.5 bg-sara-900/60 border border-white/5 rounded-xl flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-sara-300 font-mono">{faq.category}</span>
                      <h4 className="text-xs font-semibold text-white">{faq.question}</h4>
                    </div>
                    <p className="text-xs text-sara-300">{faq.answer}</p>
                  </div>
                  <button
                    onClick={() => removeFaq(idx)}
                    className="p-1 text-sara-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add FAQ Form */}
            <div className="p-4 bg-sara-900/30 rounded-xl border border-white/5">
              <h4 className="text-xs font-medium text-sara-200 mb-3">Add New Business FAQ</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <input
                  type="text"
                  placeholder="Question (e.g., What is the price for 3 BHK?)"
                  value={newFaq.question}
                  onChange={(e) => setNewFaq({ ...newFaq, question: e.target.value })}
                  className="sm:col-span-2 bg-sara-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
                />
                <select
                  value={newFaq.category}
                  onChange={(e) => setNewFaq({ ...newFaq, category: e.target.value })}
                  className="bg-sara-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
                >
                  <option value="Pricing">Pricing</option>
                  <option value="Booking">Booking</option>
                  <option value="Locations">Locations</option>
                  <option value="Eligibility">Eligibility</option>
                  <option value="General">General</option>
                </select>
              </div>
              <textarea
                rows={2}
                placeholder="Verified answer to provide callers..."
                value={newFaq.answer}
                onChange={(e) => setNewFaq({ ...newFaq, answer: e.target.value })}
                className="w-full bg-sara-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white mb-3"
              />
              <button
                onClick={addFaq}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white text-black font-semibold rounded-lg text-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Add FAQ
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Business Rules & Compliance */}
        {currentStep === 5 && (
          <div>
            <h2 className="text-xl font-semibold text-white mb-1">Operational Rules & Safeguards</h2>
            <p className="text-xs text-sara-400 mb-6">Zero-hallucination and conversational policies enforced on every turn.</p>

            <div className="space-y-2.5 mb-6">
              {formData.rules.map((rule, idx) => (
                <div key={idx} className="p-3 bg-sara-900/60 border border-white/5 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/60"></span>
                    <span className="text-xs text-sara-200">{rule}</span>
                  </div>
                  <button onClick={() => removeRule(idx)} className="text-sara-500 hover:text-red-400">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add rule (e.g. Never promise discounts not confirmed in writing)"
                value={newRule}
                onChange={(e) => setNewRule(e.target.value)}
                className="flex-1 bg-sara-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
              />
              <button
                onClick={addRule}
                className="px-3.5 py-1.5 bg-white text-black font-semibold rounded-lg text-xs"
              >
                Add Rule
              </button>
            </div>
          </div>
        )}

        {/* Step 6: Agent Personality */}
        {currentStep === 6 && (
          <div>
            <h2 className="text-xl font-semibold text-white mb-1">Agent Personality & Tone</h2>
            <p className="text-xs text-sara-400 mb-6">Shape how SARA articulates answers and guides conversations.</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-sara-300 mb-2">Personality Tone</label>
                {['Professional & Friendly', 'Warm & Empathetic', 'Confident & Executive', 'Casual & Approachable'].map(p => (
                  <div
                    key={p}
                    onClick={() => setFormData({ ...formData, personality: p })}
                    className={`p-3 rounded-lg cursor-pointer border mb-2 text-xs transition-all ${
                      formData.personality === p ? 'bg-white/15 border-white text-white font-medium' : 'bg-sara-900/40 border-white/5 text-sara-400 hover:border-white/20'
                    }`}
                  >
                    {p}
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-sara-300 mb-2">Spoken Communication Style</label>
                {['Concise (1-2 sentences)', 'Balanced (2-3 sentences)', 'Detailed (Only on request)'].map(c => (
                  <div
                    key={c}
                    onClick={() => setFormData({ ...formData, communication_style: c.split(' ')[0] })}
                    className={`p-3 rounded-lg cursor-pointer border mb-2 text-xs transition-all ${
                      formData.communication_style === c.split(' ')[0] ? 'bg-white/15 border-white text-white font-medium' : 'bg-sara-900/40 border-white/5 text-sara-400 hover:border-white/20'
                    }`}
                  >
                    {c}
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-sara-300 mb-2">Sales & Conversation Approach</label>
                {['Consultative (Needs-first)', 'Lead-Focused (Book visits)', 'Informational (Q&A only)'].map(s => (
                  <div
                    key={s}
                    onClick={() => setFormData({ ...formData, sales_behavior: s.split(' ')[0] })}
                    className={`p-3 rounded-lg cursor-pointer border mb-2 text-xs transition-all ${
                      formData.sales_behavior === s.split(' ')[0] ? 'bg-white/15 border-white text-white font-medium' : 'bg-sara-900/40 border-white/5 text-sara-400 hover:border-white/20'
                    }`}
                  >
                    {s}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 7: Language Configuration */}
        {currentStep === 7 && (
          <div>
            <h2 className="text-xl font-semibold text-white mb-1">Supported Languages & Code-Switching</h2>
            <p className="text-xs text-sara-400 mb-6">SARA automatically detects caller language on-the-fly and mirrors it naturally.</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {[
                { code: 'en', name: 'English', desc: 'Natural Indian & Global English pronunciation' },
                { code: 'te', name: 'Telugu', desc: 'Fluent conversational Telugu & Romanized code-switching' },
                { code: 'hi', name: 'Hindi', desc: 'Polite spoken Hindi with business vocabulary' }
              ].map(lang => {
                const isSelected = formData.languages.includes(lang.code);
                return (
                  <div
                    key={lang.code}
                    onClick={() => toggleLanguage(lang.code)}
                    className={`p-4 rounded-xl cursor-pointer border transition-all ${
                      isSelected
                        ? 'bg-white/10 border-white text-white shadow-md'
                        : 'bg-sara-900/40 border-white/5 text-sara-400 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm text-white">{lang.name}</span>
                      <input type="checkbox" checked={isSelected} readOnly className="accent-white" />
                    </div>
                    <p className="text-xs text-sara-400">{lang.desc}</p>
                  </div>
                );
              })}
            </div>

            <div className="p-4 bg-sara-900/30 rounded-xl border border-white/5">
              <h4 className="text-xs font-semibold text-white mb-1">Indian Multilingual Code-Switching</h4>
              <p className="text-xs text-sara-300">
                Callers can seamlessly mix languages (e.g., <span className="text-white italic">"Gachibowli lo 2 BHK price entha?"</span> or <span className="text-white italic">"Admission kaise karna hai?"</span>). SARA detects the primary intent and responds coherently in natural speech.
              </p>
            </div>
          </div>
        )}

        {/* Step 8: Voice Selection */}
        {currentStep === 8 && (
          <div>
            <h2 className="text-xl font-semibold text-white mb-1">Select Cartesia Voice</h2>
            <p className="text-xs text-sara-400 mb-6">Select a male or female neural voice and preview live Cartesia audio synthesis.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {(voices.length > 0 ? voices.slice(0, 6) : [
                { id: 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4', name: 'Skylar', gender: 'female', style: 'Warm & Professional', description: 'Crystal clear neural voice ideal for corporate representatives.' },
                { id: '62ae83ad-4f6a-430b-af41-a9bede9286ca', name: 'Gemma', gender: 'female', style: 'Friendly & Supportive', description: 'Approachable, warm tone for customer queries.' },
                { id: '47c38ca4-5f35-497b-b1a3-415245fb35e1', name: 'Daniel', gender: 'male', style: 'Executive & Calm', description: 'Deep, confident masculine voice for consultative advisory.' },
                { id: 'ef191366-f52f-447a-a398-ed8c0f2943a1', name: 'Archie', gender: 'male', style: 'Energetic & Modern', description: 'Upbeat and articulate voice for admissions & tech.' }
              ]).map(v => {
                const isSelected = formData.voice_id === v.id;
                return (
                  <div
                    key={v.id}
                    onClick={() => setFormData({ ...formData, voice_id: v.id, voice_name: v.name, voice_gender: v.gender })}
                    className={`p-4 rounded-xl cursor-pointer border flex items-center justify-between transition-all ${
                      isSelected
                        ? 'bg-white/15 border-white text-white shadow-lg'
                        : 'bg-sara-900/50 border-white/5 text-sara-300 hover:border-white/20'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-xs text-white">{v.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 uppercase font-mono">{v.gender}</span>
                      </div>
                      <p className="text-xs text-sara-400">{v.description}</p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        playVoicePreview(v.id);
                      }}
                      className="p-2.5 rounded-full bg-white text-black hover:bg-sara-200 transition-transform active:scale-95"
                      title="Preview Voice"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 9: Automatic Prompt Generator Preview */}
        {currentStep === 9 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-white mb-1">Generated SARA System Prompt</h2>
                <p className="text-xs text-sara-400">Modular prompt generated automatically from structured configuration.</p>
              </div>
              <button
                onClick={handleGeneratePreview}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/20 text-xs font-medium text-white hover:bg-white/10"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Regenerate
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs max-h-96 overflow-y-auto pr-2">
              <div className="p-3 bg-sara-900 rounded-lg border border-white/5">
                <span className="text-sara-500 font-bold block mb-1">// 1. IDENTITY & SPOKEN RULES</span>
                <p className="text-sara-200">{generatedPrompt?.identity || `You are ${formData.name}, a voice representative for ${formData.business_name}. Keep responses under 2 sentences.`}</p>
              </div>

              <div className="p-3 bg-sara-900 rounded-lg border border-white/5">
                <span className="text-sara-500 font-bold block mb-1">// 2. BUSINESS CONTEXT & OFFERINGS</span>
                <p className="text-sara-200">{generatedPrompt?.business || `Locations: ${formData.locations}. Services: ${formData.selectedServices.join(', ')}`}</p>
              </div>

              <div className="p-3 bg-sara-900 rounded-lg border border-white/5">
                <span className="text-sara-500 font-bold block mb-1">// 3. KNOWLEDGE & FAQS (ZERO HALLUCINATION)</span>
                <pre className="text-sara-300 whitespace-pre-wrap">{generatedPrompt?.faqs || 'Configured FAQs prioritized over generic predictions.'}</pre>
              </div>

              <div className="p-3 bg-sara-900 rounded-lg border border-white/5">
                <span className="text-sara-500 font-bold block mb-1">// 4. LANGUAGE & CODE-SWITCHING POLICY</span>
                <p className="text-sara-200">{generatedPrompt?.languages || `Supported: ${formData.languages.join(', ').toUpperCase()}`}</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 10: Deploy Agent */}
        {currentStep === 10 && (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-4">
              <Rocket className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Ready to Deploy {formData.name}</h2>
            <p className="text-xs text-sara-400 max-w-md mx-auto mb-8">
              Your voice agent is configured with business intelligence, custom Cartesia voice <span className="text-white font-medium">({formData.voice_name})</span>, multilingual code-switching in <span className="text-white font-medium">{formData.languages.join(', ').toUpperCase()}</span>, and real-time streaming pipeline.
            </p>

            <button
              onClick={handleDeploy}
              disabled={loading}
              className="px-8 py-3 bg-white text-black font-semibold rounded-xl text-sm shadow-xl shadow-white/10 hover:bg-sara-200 transition-all active:scale-95 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Deploying to Neon PostgreSQL...</span>
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4" />
                  <span>Deploy & Launch Voice Session</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Footer Navigation Buttons */}
        <div className="flex items-center justify-between mt-8 pt-4 border-t border-white/5">
          <button
            onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
            disabled={currentStep === 1}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-sara-400 hover:text-white disabled:opacity-30 disabled:hover:text-sara-400"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>

          {currentStep < 10 ? (
            <button
              onClick={() => {
                if (currentStep === 8) handleGeneratePreview();
                setCurrentStep(prev => Math.min(10, prev + 1));
              }}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold bg-white text-black hover:bg-sara-200 transition-all"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : null}
        </div>

      </div>
    </div>
  );
}
