import React, { useState, useEffect } from 'react';
import {
  Hash, Plus, Phone, PhoneCall, Bot, CheckCircle2, Shield, Search,
  RefreshCw, Trash2, Globe, Radio, ExternalLink, ArrowRight, UserCheck
} from 'lucide-react';

export default function PhoneNumbers({ onNavigate }) {
  const [numbers, setNumbers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Buy Modal
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [searchCountry, setSearchCountry] = useState('US');
  const [availableNumbers, setAvailableNumbers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [buyingNumber, setBuyingNumber] = useState(null);

  // Test Call Modal
  const [showCallModal, setShowCallModal] = useState(false);
  const [callTargetNumber, setCallTargetNumber] = useState('');
  const [callSelectedEmp, setCallSelectedEmp] = useState('');
  const [callProvider, setCallProvider] = useState('plivo');
  const [callSimulate, setCallSimulate] = useState(false);
  const [calling, setCalling] = useState(false);
  const [callSuccessMessage, setCallSuccessMessage] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [numRes, empRes] = await Promise.all([
        fetch('/api/v1/phone-numbers'),
        fetch('/api/v1/employees')
      ]);

      if (numRes.ok) {
        const numData = await numRes.json();
        setNumbers(numData.data || []);
      }
      if (empRes.ok) {
        const empData = await empRes.json();
        const emps = empData.data || [];
        setEmployees(emps);
        if (emps.length > 0 && !callSelectedEmp) {
          setCallSelectedEmp(emps[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching numbers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSearchAvailable = async () => {
    setSearching(true);
    try {
      const res = await fetch(`/api/v1/phone-numbers/search?country=${searchCountry}`);
      if (res.ok) {
        const data = await res.json();
        setAvailableNumbers(data.data || []);
      }
    } catch (err) {
      console.error('Search numbers error:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleBuyNumber = async (numObj) => {
    setBuyingNumber(numObj.phone_number);
    try {
      const res = await fetch('/api/v1/phone-numbers/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: numObj.phone_number,
          friendly_name: numObj.friendly_name,
        }),
      });
      if (res.ok) {
        setShowBuyModal(false);
        fetchData();
      }
    } catch (err) {
      console.error('Buy number error:', err);
    } finally {
      setBuyingNumber(null);
    }
  };

  const handleAssignEmployee = async (numberId, empId) => {
    try {
      await fetch('/api/v1/phone-numbers/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number_id: numberId,
          employee_id: empId || null,
        }),
      });
      fetchData();
    } catch (err) {
      console.error('Assign error:', err);
    }
  };

  const handleTriggerTestCall = async (e) => {
    e.preventDefault();
    if (!callTargetNumber || !callSelectedEmp) return;
    setCalling(true);
    setCallSuccessMessage('');
    try {
      const res = await fetch('/api/v1/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: callSelectedEmp,
          to: callTargetNumber,
          provider: callProvider,
          simulate: callSimulate,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCallSuccessMessage(data.message || `Outbound AI Call Initiated via ${callProvider.toUpperCase()}! Call SID: ${data.call_sid || data.call_id}`);
        setTimeout(() => {
          setShowCallModal(false);
          setCallSuccessMessage('');
          setCallTargetNumber('');
          onNavigate('calls');
        }, 2000);
      } else {
        alert(data.detail || data.message || 'Could not initiate call');
      }
    } catch (err) {
      console.error('Call error:', err);
    } finally {
      setCalling(false);
    }
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Hash size={26} color="var(--primary)" />
            Telephony & Virtual Phone Lines
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
            Manage active phone lines powered by Plivo (+91 India carrier) and SARA Voice Runtime. Route inbound inquiries and place autonomous outbound AI calls.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => setShowCallModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--bg-secondary, #fff)',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', color: 'var(--text-primary)'
            }}
          >
            <PhoneCall size={16} color="var(--primary)" />
            Test Outbound AI Call
          </button>
          <button
            onClick={() => { setShowBuyModal(true); handleSearchAvailable(); }}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600 }}
          >
            <Plus size={16} /> Get New Phone Number
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Radio size={16} color="#10b981" /> Primary Carrier Status
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#10b981', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
            Plivo Voice Active
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Line: +91 80 6552 2007 (Auth: MAYMJLZ...1YY)</div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Phone size={16} color="var(--primary)" /> Active Phone Lines
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', marginTop: 8 }}>{numbers.length}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Connected to SARA AI runtime</div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Bot size={16} color="#0284c7" /> Dedicated AI Responders
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', marginTop: 8 }}>
            {numbers.filter((n) => n.assigned_employee).length} / {numbers.length || 1}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Direct inbound routing</div>
        </div>
      </div>

      {/* Webhook Endpoint Banner */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 24, background: 'linear-gradient(180deg, rgba(124,58,237,0.03), transparent)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Production Plivo Inbound Webhook URL
          </div>
          <div style={{ fontSize: 14, fontFamily: 'monospace', color: 'var(--text-primary)', marginTop: 4 }}>
            https://sara.saadhyam.com/api/v1/voice/plivo/inbound
          </div>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Shield size={14} color="#10b981" /> Plivo Audio Stream XML v2.0
        </span>
      </div>

      {/* Numbers Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} className="spin" style={{ marginBottom: 10 }} />
            <div>Loading virtual lines...</div>
          </div>
        ) : numbers.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <Hash size={40} color="var(--text-muted)" style={{ marginBottom: 12, opacity: 0.5 }} />
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>No Phone Numbers Configured</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 440, margin: '0 auto 16px' }}>
              Add a carrier phone number so your AI employees can receive inbound calls and place outbound phone campaigns.
            </p>
            <button
              onClick={() => { setShowBuyModal(true); handleSearchAvailable(); }}
              className="btn-primary"
              style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13 }}
            >
              + Get First Number
            </button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary, #fafafa)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>PHONE NUMBER</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>CARRIER</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>CAPABILITIES</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>ASSIGNED AI EMPLOYEE</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>STATUS</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {numbers.map((n) => (
                <tr key={n.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(124,58,237,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Phone size={15} color="var(--primary)" />
                      </div>
                      <div>
                        <div style={{ fontFamily: 'monospace', fontSize: 14 }}>{n.phone_number}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>{n.friendly_name}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', color: 'var(--text-primary)' }}>
                    <span style={{ textTransform: 'uppercase', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {n.provider === 'plivo' ? (
                        <span style={{ padding: '2px 8px', borderRadius: 4, background: '#dbeafe', color: '#1d4ed8' }}>
                          Plivo Voice (+91)
                        </span>
                      ) : (
                        <span style={{ padding: '2px 8px', borderRadius: 4, background: '#f3f4f6', color: '#374151' }}>
                          {n.provider ? `${n.provider.toUpperCase()} Voice` : 'Voice Carrier'}
                        </span>
                      )}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {(n.capabilities || ['voice', 'sms']).map((cap) => (
                        <span key={cap} style={{ padding: '2px 6px', borderRadius: 4, background: '#f1f5f9', fontSize: 11, textTransform: 'uppercase', color: '#475569' }}>
                          {cap}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <select
                      value={n.assigned_employee?.id || ''}
                      onChange={(e) => handleAssignEmployee(n.id, e.target.value)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                        fontSize: 13,
                        background: 'var(--bg-input, #fff)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="">-- Unassigned (Auto-route) --</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.role})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px',
                      borderRadius: 12, fontSize: 12, fontWeight: 500, background: '#ecfdf5', color: '#059669'
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                      Active Line
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <button
                      onClick={() => {
                        setCallSelectedEmp(n.assigned_employee?.id || (employees[0]?.id || ''));
                        setShowCallModal(true);
                      }}
                      className="btn-primary"
                      style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}
                    >
                      Call with this Line
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal: Search & Buy Twilio Number */}
      {showBuyModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 580, padding: 24, borderRadius: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              Provision Plivo Virtual Phone Line
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              Select a phone number for your AI employees. Webhooks and Speech TwiML will be configured automatically.
            </p>

            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <select
                value={searchCountry}
                onChange={(e) => setSearchCountry(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }}
              >
                <option value="US">United States (+1)</option>
                <option value="IN">India (+91)</option>
                <option value="GB">United Kingdom (+44)</option>
                <option value="CA">Canada (+1)</option>
              </select>
              <button
                onClick={handleSearchAvailable}
                disabled={searching}
                className="btn-primary"
                style={{ padding: '8px 16px', borderRadius: 6, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Search size={14} /> {searching ? 'Searching...' : 'Search Available'}
              </button>
            </div>

            <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 16 }}>
              {availableNumbers.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  Click "Search Available" to fetch live phone numbers from Plivo.
                </div>
              ) : (
                availableNumbers.map((num) => (
                  <div
                    key={num.phone_number}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px 16px', borderBottom: '1px solid var(--border)'
                    }}
                  >
                    <div>
                      <div style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {num.phone_number}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {num.locality || 'Toll Free'}, {num.region || num.country} • $1.15/month
                      </div>
                    </div>
                    <button
                      onClick={() => handleBuyNumber(num)}
                      disabled={buyingNumber === num.phone_number}
                      className="btn-primary"
                      style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}
                    >
                      {buyingNumber === num.phone_number ? 'Provisioning...' : 'Provision'}
                    </button>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowBuyModal(false)}
                style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Test Outbound Call */}
      {showCallModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, padding: 24, borderRadius: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              Initiate Outbound AI Call
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              Trigger carrier to dial the destination phone. The customer will converse directly with your selected AI Employee.
            </p>

            {callSuccessMessage ? (
              <div style={{ padding: 16, borderRadius: 8, background: '#ecfdf5', color: '#059669', fontSize: 13, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={18} />
                {callSuccessMessage}
              </div>
            ) : (
              <form onSubmit={handleTriggerTestCall}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                    Select AI Employee Caller
                  </label>
                  <select
                    value={callSelectedEmp}
                    onChange={(e) => setCallSelectedEmp(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 14 }}
                  >
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} — {emp.role}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                    Telephony Gateway Provider
                  </label>
                  <select
                    value={callProvider}
                    onChange={(e) => setCallProvider(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 14 }}
                  >
                    <option value="plivo">Plivo (India +91 Calling — Direct Carrier Line: +91 80 6552 2007)</option>
                    <option value="exotel">Exotel (India +91 Calling — Sarvam Telugu / Qwen)</option>
                  </select>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                    Destination Phone Number (with Country Code)
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 98490 12345"
                    value={callTargetNumber}
                    onChange={(e) => setCallTargetNumber(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'monospace' }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    {callProvider === 'plivo' || callProvider === 'exotel'
                      ? 'Indian mobile number (+91 or 10 digits starting with 6, 7, 8, 9, e.g. +91 98490 12345)'
                      : 'Enter in E.164 international format (e.g. +1... or +44...)'}
                  </div>
                </div>

                <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--bg-secondary, #fafafa)', borderRadius: 6, border: '1px solid var(--border)' }}>
                  <input
                    type="checkbox"
                    id="callSimulate"
                    checked={callSimulate}
                    onChange={(e) => setCallSimulate(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <label htmlFor="callSimulate" style={{ fontSize: 12, color: 'var(--text-primary)', cursor: 'pointer' }}>
                    Safe Simulation Mode (test voice workflow without cellular network charge)
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowCallModal(false)}
                    style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={calling}
                    className="btn-primary"
                    style={{ padding: '8px 18px', borderRadius: 6, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <PhoneCall size={15} />
                    {calling ? `Dialing via ${callProvider.toUpperCase()}...` : 'Dial Now'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
