// Phone Utility Functions for E.164 and Plivo normalization
export function normalize_plivo_phone_number(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) {
    return digits;
  }
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  return `+${digits}`;
}

export function format_display_phone(raw) {
  if (!raw) return '';
  const clean = String(raw).replace(/[^\d+]/g, '');
  if (clean.length === 13 && clean.startsWith('+91')) {
    return `+91 ${clean.slice(3, 8)} ${clean.slice(8)}`;
  }
  return clean;
}

export default {
  normalize_plivo_phone_number,
  format_display_phone,
};
