import React from 'react';

/**
 * Professional Skeleton Loader Component
 * Supports multiple layout presets: 'dashboard', 'campaigns', 'table', 'cards', 'detail'
 */
export default function SkeletonLoader({ type = 'dashboard', count = 1 }) {
  if (type === 'dashboard') {
    return (
      <div className="skeleton-container animate-fade-in" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Header Skeleton */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="skeleton-shimmer" style={{ width: 220, height: 28, borderRadius: 8, marginBottom: 8 }} />
            <div className="skeleton-shimmer" style={{ width: 340, height: 16, borderRadius: 6 }} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="skeleton-shimmer" style={{ width: 130, height: 38, borderRadius: 10 }} />
            <div className="skeleton-shimmer" style={{ width: 100, height: 38, borderRadius: 10 }} />
            <div className="skeleton-shimmer" style={{ width: 140, height: 38, borderRadius: 10 }} />
          </div>
        </div>

        {/* 7 Metric KPI Cards Skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
          {[...Array(7)].map((_, i) => (
            <div key={i} className="skeleton-card" style={{ padding: '16px', borderRadius: 14, border: '1px solid #E2E8F0', background: '#FFFFFF' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <div className="skeleton-shimmer" style={{ width: 32, height: 32, borderRadius: 8 }} />
                <div className="skeleton-shimmer" style={{ width: 54, height: 18, borderRadius: 20 }} />
              </div>
              <div className="skeleton-shimmer" style={{ width: '50%', height: 26, borderRadius: 6, marginBottom: 6 }} />
              <div className="skeleton-shimmer" style={{ width: '80%', height: 13, borderRadius: 4 }} />
            </div>
          ))}
        </div>

        {/* Telephony Billing Banner Skeleton */}
        <div className="skeleton-card" style={{ padding: '24px', borderRadius: 18, border: '1px solid #E2E8F0', background: '#FFFFFF' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 20 }}>
            <div className="skeleton-shimmer" style={{ width: 42, height: 42, borderRadius: 12 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton-shimmer" style={{ width: 260, height: 20, borderRadius: 6, marginBottom: 6 }} />
              <div className="skeleton-shimmer" style={{ width: 400, height: 14, borderRadius: 4 }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="skeleton-shimmer" style={{ height: 72, borderRadius: 12 }} />
            <div className="skeleton-shimmer" style={{ height: 72, borderRadius: 12 }} />
          </div>
        </div>

        {/* Activity & Attention Grid Skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
          <div className="skeleton-card" style={{ padding: '22px', borderRadius: 18, border: '1px solid #E2E8F0', background: '#FFFFFF', minHeight: 240 }}>
            <div className="skeleton-shimmer" style={{ width: 180, height: 20, borderRadius: 6, marginBottom: 16 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[...Array(3)].map((_, i) => (
                <div key={i} className="skeleton-shimmer" style={{ height: 48, borderRadius: 10 }} />
              ))}
            </div>
          </div>
          <div className="skeleton-card" style={{ padding: '22px', borderRadius: 18, border: '1px solid #E2E8F0', background: '#FFFFFF', minHeight: 240 }}>
            <div className="skeleton-shimmer" style={{ width: 140, height: 20, borderRadius: 6, marginBottom: 16 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[...Array(2)].map((_, i) => (
                <div key={i} className="skeleton-shimmer" style={{ height: 60, borderRadius: 10 }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'campaigns') {
    return (
      <div className="skeleton-container animate-fade-in" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
        {/* Top Banner Skeleton */}
        <div className="skeleton-card" style={{ padding: '22px', borderRadius: 18, border: '1px solid #E2E8F0', background: '#FFFFFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div className="skeleton-shimmer" style={{ width: 44, height: 44, borderRadius: 12 }} />
            <div>
              <div className="skeleton-shimmer" style={{ width: 280, height: 22, borderRadius: 6, marginBottom: 6 }} />
              <div className="skeleton-shimmer" style={{ width: 380, height: 14, borderRadius: 4 }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="skeleton-shimmer" style={{ width: 120, height: 38, borderRadius: 10 }} />
            <div className="skeleton-shimmer" style={{ width: 140, height: 38, borderRadius: 10 }} />
          </div>
        </div>

        {/* Quick Templates Grid Skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton-card" style={{ padding: '16px', borderRadius: 14, border: '1px solid #E2E8F0', background: '#FFFFFF' }}>
              <div className="skeleton-shimmer" style={{ width: '70%', height: 18, borderRadius: 6, marginBottom: 8 }} />
              <div className="skeleton-shimmer" style={{ width: '90%', height: 12, borderRadius: 4 }} />
            </div>
          ))}
        </div>

        {/* Form Fields Skeleton */}
        <div className="skeleton-card" style={{ padding: '28px', borderRadius: 20, border: '1px solid #E2E8F0', background: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
            <div>
              <div className="skeleton-shimmer" style={{ width: 140, height: 14, borderRadius: 4, marginBottom: 8 }} />
              <div className="skeleton-shimmer" style={{ width: '100%', height: 46, borderRadius: 12 }} />
            </div>
            <div>
              <div className="skeleton-shimmer" style={{ width: 140, height: 14, borderRadius: 4, marginBottom: 8 }} />
              <div className="skeleton-shimmer" style={{ width: '100%', height: 46, borderRadius: 12 }} />
            </div>
          </div>
          <div>
            <div className="skeleton-shimmer" style={{ width: 180, height: 14, borderRadius: 4, marginBottom: 8 }} />
            <div className="skeleton-shimmer" style={{ width: '100%', height: 90, borderRadius: 12 }} />
          </div>
          <div className="skeleton-shimmer" style={{ width: '100%', height: 52, borderRadius: 14, marginTop: 8 }} />
        </div>
      </div>
    );
  }

  if (type === 'cards') {
    return (
      <div className="skeleton-container animate-fade-in" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="skeleton-shimmer" style={{ width: 180, height: 26, borderRadius: 6, marginBottom: 6 }} />
            <div className="skeleton-shimmer" style={{ width: 280, height: 14, borderRadius: 4 }} />
          </div>
          <div className="skeleton-shimmer" style={{ width: 140, height: 38, borderRadius: 8 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {[...Array(count || 6)].map((_, i) => (
            <div key={i} className="skeleton-card" style={{ padding: '20px', borderRadius: 14, border: '1px solid #E2E8F0', background: '#FFFFFF' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div className="skeleton-shimmer" style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton-shimmer" style={{ width: '60%', height: 18, borderRadius: 4, marginBottom: 6 }} />
                  <div className="skeleton-shimmer" style={{ width: '40%', height: 12, borderRadius: 4 }} />
                </div>
              </div>
              <div className="skeleton-shimmer" style={{ width: '100%', height: 40, borderRadius: 8, marginBottom: 14 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <div className="skeleton-shimmer" style={{ flex: 1, height: 34, borderRadius: 8 }} />
                <div className="skeleton-shimmer" style={{ flex: 1, height: 34, borderRadius: 8 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'kanban') {
    return (
      <div className="skeleton-container animate-fade-in" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="skeleton-shimmer" style={{ width: 200, height: 26, borderRadius: 6 }} />
          <div className="skeleton-shimmer" style={{ width: 130, height: 38, borderRadius: 8 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', overflowX: 'auto' }}>
          {[...Array(4)].map((_, col) => (
            <div key={col} style={{ background: '#F8FAFC', borderRadius: 12, padding: 14, border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="skeleton-shimmer" style={{ width: '70%', height: 18, borderRadius: 4 }} />
              {[...Array(3)].map((_, i) => (
                <div key={i} className="skeleton-card" style={{ padding: 14, borderRadius: 10, border: '1px solid #E2E8F0', background: '#FFFFFF' }}>
                  <div className="skeleton-shimmer" style={{ width: '80%', height: 16, borderRadius: 4, marginBottom: 8 }} />
                  <div className="skeleton-shimmer" style={{ width: '50%', height: 12, borderRadius: 4, marginBottom: 12 }} />
                  <div className="skeleton-shimmer" style={{ width: '100%', height: 20, borderRadius: 4 }} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Generic table or list skeleton
  return (
    <div className="skeleton-container animate-fade-in" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div className="skeleton-shimmer" style={{ width: 220, height: 24, borderRadius: 6 }} />
        <div className="skeleton-shimmer" style={{ width: 120, height: 36, borderRadius: 8 }} />
      </div>
      <div className="skeleton-card" style={{ borderRadius: 14, border: '1px solid #E2E8F0', background: '#FFFFFF', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', gap: 16 }}>
          <div className="skeleton-shimmer" style={{ width: 140, height: 16, borderRadius: 4 }} />
          <div className="skeleton-shimmer" style={{ width: 120, height: 16, borderRadius: 4 }} />
          <div className="skeleton-shimmer" style={{ width: 100, height: 16, borderRadius: 4 }} />
          <div className="skeleton-shimmer" style={{ width: 80, height: 16, borderRadius: 4 }} />
        </div>
        {[...Array(count || 5)].map((_, i) => (
          <div key={i} style={{ padding: '16px 20px', borderBottom: '1px solid #F8FAFC', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className="skeleton-shimmer" style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton-shimmer" style={{ width: '45%', height: 16, borderRadius: 4, marginBottom: 6 }} />
              <div className="skeleton-shimmer" style={{ width: '70%', height: 12, borderRadius: 4 }} />
            </div>
            <div className="skeleton-shimmer" style={{ width: 80, height: 24, borderRadius: 20 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
