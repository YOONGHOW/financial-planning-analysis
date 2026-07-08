"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar({ collapsed, onToggleCollapse, onClose }) {
  const pathname = usePathname();

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      {/* Desktop Collapse Toggle Button (Floating on right border edge) */}
      <button
        type="button"
        className="sidebar-toggle-btn"
        onClick={(e) => {
          e.stopPropagation();
          if (onToggleCollapse) onToggleCollapse();
        }}
        aria-label={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
      >
        <svg 
          className="toggle-chevron" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor" 
          strokeWidth={3}
          style={{ transform: collapsed ? "rotate(180deg)" : "none" }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Sidebar Logo Header */}
      <div className="logo-container">
        <div className="logo-icon">$</div>
        <span className="logo-text">Financial Planner</span>
        
        {/* Mobile close button (styled display: none on desktop) */}
        <button 
          type="button"
          className="sidebar-close-btn"
          onClick={(e) => {
            e.stopPropagation();
            if (onClose) onClose();
          }}
          aria-label="Close navigation"
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="nav-menu">
        <Link 
          href="/" 
          className={`nav-item ${pathname === "/" ? "active" : ""}`}
        >
          <svg 
            className="nav-icon" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor" 
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
          </svg>
          <span className="nav-text">Dashboard</span>
        </Link>

        <Link 
          href="/add" 
          className={`nav-item ${pathname === "/add" ? "active" : ""}`}
        >
          <svg 
            className="nav-icon" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor" 
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="nav-text">Add Transaction</span>
        </Link>

        <Link 
          href="/transactions" 
          className={`nav-item ${pathname === "/transactions" ? "active" : ""}`}
        >
          <svg 
            className="nav-icon" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor" 
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span className="nav-text">Transactions</span>
        </Link>

        <Link 
          href="/fixed" 
          className={`nav-item ${pathname === "/fixed" ? "active" : ""}`}
        >
          <svg 
            className="nav-icon" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor" 
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="nav-text">Fixed Spends</span>
        </Link>

        <Link 
          href="/savings-plan" 
          className={`nav-item ${pathname === "/savings-plan" ? "active" : ""}`}
        >
          <svg 
            className="nav-icon" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor" 
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="nav-text">Savings Plan</span>
        </Link>

        <Link 
          href="/yearly-planner" 
          className={`nav-item ${pathname === "/yearly-planner" ? "active" : ""}`}
        >
          <svg 
            className="nav-icon" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor" 
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 17c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 13c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1z" />
          </svg>
          <span className="nav-text">Yearly Planner</span>
        </Link>
      </nav>

      {/* Sidebar User Footer */}
      <div className="sidebar-footer">
        <div style={{ position: "relative", display: "flex", flexShrink: 0 }}>
          <div className="avatar">LY</div>
          <span className="status-dot" />
        </div>
        <div className="user-info">
          <span className="user-name">Lim Yoong How</span>
          <span className="user-role">Premium User</span>
        </div>
      </div>
    </aside>
  );
}
