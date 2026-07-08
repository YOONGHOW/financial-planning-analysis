"use client";

import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import SpendingReminder from "./SpendingReminder";

export default function LayoutWrapper({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Load sidebar collapse preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("fpa_sidebar_collapsed");
    if (saved) {
      setSidebarCollapsed(saved === "true");
    }
  }, []);

  const toggleCollapse = () => {
    const nextState = !sidebarCollapsed;
    setSidebarCollapsed(nextState);
    localStorage.setItem("fpa_sidebar_collapsed", nextState.toString());
  };

  return (
    <div className={`app-container ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <SpendingReminder />

      {/* Mobile Top Navbar Header */}
      <header className="mobile-header">
        <button 
          className="hamburger-btn" 
          onClick={() => setSidebarOpen(true)}
          aria-label="Open Navigation Menu"
        >
          <svg 
            width="24" 
            height="24" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor" 
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="mobile-logo-text">Financial Planner</span>
        <div style={{ width: "24px" }} /> {/* Spacer to balance logo text */}
      </header>

      {/* Drawer Backdrop Overlay (collapses drawer on click) */}
      {sidebarOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}

      {/* Sidebar container - slide-in on mobile, standard layout on desktop */}
      <div 
        className={`sidebar-wrapper ${sidebarOpen ? "open" : ""} ${sidebarCollapsed ? "collapsed" : ""}`}
      >
        <Sidebar 
          collapsed={sidebarCollapsed} 
          onToggleCollapse={toggleCollapse} 
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* Content Area */}
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

