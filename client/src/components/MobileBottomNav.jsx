import React from 'react';
import { LayoutDashboard, Bot, Mic, Phone, Menu } from 'lucide-react';

export default function MobileBottomNav({ activePage, onNavigate, onToggleMobileMenu }) {
  const navItems = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'employees', label: 'Employees', icon: Bot },
    { id: 'talk-sara', label: 'Talk', icon: Mic, isHero: true },
    { id: 'calls', label: 'Calls', icon: Phone },
    { id: 'menu', label: 'Menu', icon: Menu, isMenuToggle: true },
  ];

  return (
    <nav className="mobile-bottom-nav">
      <div className="mobile-bottom-nav-inner">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;

          if (item.isHero) {
            return (
              <button
                key={item.id}
                className={`mobile-bottom-hero-btn ${isActive ? 'active' : ''}`}
                onClick={() => onNavigate(item.id)}
                aria-label="Talk with Sara"
              >
                <div className="mobile-bottom-hero-orb">
                  <Icon size={20} color="#ffffff" />
                </div>
                <span className="mobile-bottom-hero-label">{item.label}</span>
              </button>
            );
          }

          if (item.isMenuToggle) {
            return (
              <button
                key={item.id}
                className="mobile-bottom-nav-item"
                onClick={onToggleMobileMenu}
                aria-label="Open Navigation Menu"
              >
                <div className="mobile-bottom-nav-icon-wrap">
                  <Icon size={20} />
                </div>
                <span className="mobile-bottom-nav-label">{item.label}</span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              className={`mobile-bottom-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onNavigate(item.id)}
              aria-label={item.label}
            >
              <div className="mobile-bottom-nav-icon-wrap">
                <Icon size={20} />
                {isActive && <div className="mobile-bottom-active-dot" />}
              </div>
              <span className="mobile-bottom-nav-label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
