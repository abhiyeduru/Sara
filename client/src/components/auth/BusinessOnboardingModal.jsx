import React, { useState } from 'react';
import { Building2, Sparkles, Plus, Trash2, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

const INDUSTRIES = [
  'Health & Fitness / Gym',
  'Real Estate & Construction',
  'Healthcare & Dental Clinics',
  'Education & Coaching Institutes',
  'Financial Services & Insurance',
  'Automotive & Dealerships',
  'Professional Consulting & Legal',
  'E-Commerce & Retail',
  'Other Services'
];

export default function BusinessOnboardingModal({ user, onComplete }) {
  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState(INDUSTRIES[0]);
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [location, setLocation] = useState('Hyderabad');
  const [operatingHours, setOperatingHours] = useState('09:00 AM – 09:00 PM IST');
  const [callingInstruction, setCallingInstruction] = useState(
    'Whenever a new lead comes, call them. Introduce our business, understand their requirements, explain our offerings, and schedule an appointment.'
  );
  const [products, setProducts] = useState([
    { name: 'Standard Package', price: '₹9,999' },
    { name: 'Complimentary Consultation / Trial', price: 'Free' }
  ]);
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const addProduct = () => {
    if (!newProdName.trim()) return;
    setProducts([...products, { name: newProdName.trim(), price: newProdPrice.trim() || 'Flexible' }]);
    setNewProdName('');
    setNewProdPrice('');
  };

  const removeProduct = (idx) => {
    setProducts(products.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!businessName.trim()) {
      setError('Please enter your business name.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/v1/auth/business-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: businessName.trim(),
          industry: industry,
          phone: phone.trim(),
          website: website.trim(),
          locations: [location.trim()],
          operating_hours: operatingHours,
          calling_instruction: callingInstruction.trim(),
          products_services: products,
          voice_preference: 'te-IN-Standard-A'
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onComplete(data.business_profile);
      } else {
        setError(data.detail || 'Could not save business details.');
      }
    } catch (err) {
      console.error('Onboarding save error:', err);
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(9, 9, 11, 0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{
        width: '100%', maxWidth: 640, background: '#ffffff',
        borderRadius: 24, boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
        padding: '36px 36px', maxHeight: '92vh', overflowY: 'auto',
        border: '1px solid rgba(255,255,255,0.1)'
      }} className="animate-fade-in">

        {/* Welcome Tag */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="User" style={{ width: 38, height: 38, borderRadius: '50%' }} />
            ) : (
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: 'linear-gradient(135deg,#7c3aed,#a78bfa)',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700
              }}>
                {(user?.name || user?.email || 'B')[0].toUpperCase()}
              </div>
            )}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                Welcome, {user?.name || 'Business Owner'}!
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {user?.email}
              </div>
            </div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(124,58,237,0.08)', color: '#7c3aed', padding: '4px 10px', borderRadius: 20 }}>
            Step 2: Business Onboarding
          </span>
        </div>

        <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans' }}>
          Configure Your Business AI Profile
        </h2>
        <p style={{ margin: '0 0 22px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.4 }}>
          Sara uses these details to speak on behalf of your business, answer customer queries, and follow your calling rules.
        </p>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 12, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Business Name & Industry */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                Business / Brand Name *
              </label>
              <input
                className="input"
                required
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
                placeholder="e.g. KVR Fitness or ABC Properties"
                style={{ width: '100%', fontSize: 13 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                Industry *
              </label>
              <select
                className="input"
                value={industry}
                onChange={e => setIndustry(e.target.value)}
                style={{ width: '100%', fontSize: 13 }}
              >
                {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
          </div>

          {/* Phone & Operating Hours */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                Caller Phone Number
              </label>
              <input
                className="input"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="e.g. +91 9876543210"
                style={{ width: '100%', fontSize: 13 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                Operating Hours (TRAI Compliant)
              </label>
              <input
                className="input"
                value={operatingHours}
                onChange={e => setOperatingHours(e.target.value)}
                style={{ width: '100%', fontSize: 13 }}
              />
            </div>
          </div>

          {/* Location & Website */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                Primary Location
              </label>
              <input
                className="input"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="e.g. Madhapur, Hyderabad"
                style={{ width: '100%', fontSize: 13 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                Website / Social Page
              </label>
              <input
                className="input"
                value={website}
                onChange={e => setWebsite(e.target.value)}
                placeholder="https://..."
                style={{ width: '100%', fontSize: 13 }}
              />
            </div>
          </div>

          {/* Owner Voice Calling Instruction */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                🎯 How should Sara speak to your leads? (Owner Instruction)
              </label>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Auto-compiled to policy</span>
            </div>
            <textarea
              className="input"
              rows={3}
              value={callingInstruction}
              onChange={e => setCallingInstruction(e.target.value)}
              placeholder="Sara, whenever a new lead comes, call them. Explain our offerings, ask their requirements, and schedule a visit or demo."
              style={{ width: '100%', fontSize: 13, lineHeight: 1.4, resize: 'vertical' }}
            />
          </div>

          {/* Products & Pricing */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
              Key Products, Plans or Packages
            </label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                className="input"
                placeholder="Plan or product name"
                value={newProdName}
                onChange={e => setNewProdName(e.target.value)}
                style={{ flex: 2, fontSize: 13 }}
              />
              <input
                className="input"
                placeholder="Price (e.g. ₹4,999/mo)"
                value={newProdPrice}
                onChange={e => setNewProdPrice(e.target.value)}
                style={{ flex: 1, fontSize: 13 }}
              />
              <button type="button" onClick={addProduct} className="btn btn-secondary" style={{ padding: '0 12px' }}>
                <Plus size={14} /> Add
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {products.map((p, idx) => (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '6px 12px', borderRadius: 8, background: 'var(--bg-secondary, #f8fafc)', border: '1px solid var(--border)'
                }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed' }}>{p.price}</span>
                    <button type="button" onClick={() => removeProduct(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '14px 20px', borderRadius: 12,
              background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              color: '#fff', border: 'none', fontSize: 15, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 4px 14px rgba(124,58,237,0.35)'
            }}
          >
            <Sparkles size={16} />
            {loading ? 'Compiling AI Policy & Setting Up...' : 'SAVE BUSINESS DETAILS & ENTER VOICE STUDIO'}
          </button>
        </form>
      </div>
    </div>
  );
}
