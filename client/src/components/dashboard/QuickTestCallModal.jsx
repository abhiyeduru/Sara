import React, { useState } from 'react';
import { PhoneCall, X, Loader2, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

export default function QuickTestCallModal({ employee, isOpen, onClose }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isCalling, setIsCalling] = useState(false);
  const [callStatus, setCallStatus] = useState(null); // 'success' | 'error' | null
  const [statusMessage, setStatusMessage] = useState('');

  if (!isOpen || !employee) return null;

  const handlePlaceCall = async () => {
    const cleanNumber = phoneNumber.trim();
    if (!cleanNumber || cleanNumber.length < 10) {
      setCallStatus('error');
      setStatusMessage('Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsCalling(true);
    setCallStatus(null);
    setStatusMessage('');

    try {
      const res = await fetch('/api/v1/voice/outbound-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employee.id,
          to_number: cleanNumber.startsWith('+') ? cleanNumber : `+91${cleanNumber.replace(/^0+/, '')}`,
          language: employee.voice_language || 'te',
          lead_name: 'Business Owner'
        })
      });

      const data = await res.json();
      if (res.ok) {
        setCallStatus('success');
        if (data.is_simulated) {
          setStatusMessage(`Call Dispatched! (Telephony simulated: ${data.error_detail || 'Gateway check'})`);
        } else {
          setStatusMessage(`📞 Live Cellular Call Initiated! Your phone (${cleanNumber}) is ringing right now with ${employee.name}'s script.`);
        }
      } else {
        setCallStatus('error');
        setStatusMessage(data.detail || 'Could not initiate test call. Check server logs.');
      }
    } catch (err) {
      console.error('Test call network error:', err);
      setCallStatus('error');
      setStatusMessage('Network error while placing test call.');
    } finally {
      setIsCalling(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: 16
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: 20,
        maxWidth: 460,
        width: '100%',
        padding: '26px 28px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
        position: 'relative'
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 18,
            right: 18,
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: 4
          }}
        >
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff'
          }}>
            <PhoneCall size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a' }}>
              Test Call with {employee.name}
            </h3>
            <div style={{ fontSize: 12.5, color: '#6366f1', fontWeight: 600 }}>
              {employee.role}
            </div>
          </div>
        </div>

        <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.45, marginBottom: 18 }}>
          Enter your mobile phone number below. Sara will immediately place a live outbound call to your phone using this employee's tailored business script in <b>Telugu</b>.
        </p>

        {/* Input Field */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: 6 }}>
            Your Phone Number (+91)
          </label>
          <input
            type="tel"
            placeholder="e.g. 9876543210 or +919876543210"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 14px',
              fontSize: 15,
              borderRadius: 12,
              border: '1.5px solid #cbd5e1',
              outline: 'none',
              boxSizing: 'border-box'
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = '#7c3aed'}
            onBlur={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
          />
        </div>

        {/* Status Feedback */}
        {statusMessage && (
          <div style={{
            marginBottom: 16,
            padding: '10px 14px',
            borderRadius: 10,
            fontSize: 12.5,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            background: callStatus === 'success' ? '#ecfdf5' : '#fef2f2',
            color: callStatus === 'success' ? '#065f46' : '#991b1b',
            border: callStatus === 'success' ? '1px solid #a7f3d0' : '1px solid #fecaca'
          }}>
            {callStatus === 'success' ? <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 1 }} /> : <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />}
            <div>{statusMessage}</div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '11px 16px',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              color: '#475569',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>

          <button
            onClick={handlePlaceCall}
            disabled={isCalling}
            style={{
              flex: 1.5,
              padding: '11px 16px',
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 700,
              cursor: isCalling ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 4px 14px rgba(124, 58, 237, 0.3)'
            }}
          >
            {isCalling ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Calling Phone...
              </>
            ) : (
              <>
                <PhoneCall size={15} />
                Call My Phone Now
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
