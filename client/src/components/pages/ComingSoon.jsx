import React from 'react';
import { Bot, PlusCircle } from 'lucide-react';

export default function ComingSoon({ title, subtitle, icon: Icon = Bot, ctaLabel, onCta }) {
  return (
    <div className="page-content animate-fade-in">
      <div className="empty-state" style={{ minHeight:'60vh' }}>
        <div style={{ width:72, height:72, borderRadius:20, background:'linear-gradient(135deg,#f5f3ff,#ede9fe)',
          border:'1px solid #ddd6fe', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20 }}>
          <Icon size={32} color="#7c3aed" />
        </div>
        <h2 style={{ fontSize:20, fontWeight:800, color:'var(--text-primary)', margin:'0 0 8px', fontFamily:'Plus Jakarta Sans' }}>{title}</h2>
        <p style={{ color:'var(--text-muted)', fontSize:14, margin:'0 0 24px', maxWidth:380, textAlign:'center' }}>{subtitle}</p>
        {ctaLabel && (
          <button className="btn btn-primary btn-lg" onClick={onCta}>
            <PlusCircle size={16} />{ctaLabel}
          </button>
        )}
      </div>
    </div>
  );
}
