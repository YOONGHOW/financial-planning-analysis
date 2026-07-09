"use client";

import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import SpendingReminder from "./SpendingReminder";

export default function LayoutWrapper({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Register SW and Request Notification Permissions on mount
  useEffect(() => {
    // Load sidebar preference
    const saved = localStorage.getItem("fpa_sidebar_collapsed");
    if (saved) {
      setSidebarCollapsed(saved === "true");
    }

    // Register PWA Service Worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // Sync current uncompleted tasks once SW is active
          navigator.serviceWorker.ready.then(() => {
            const savedTasks = localStorage.getItem("personal_super_app_tasks");
            if (savedTasks) {
              try {
                const parsed = JSON.parse(savedTasks);
                const uncompleted = parsed.filter((t) => !t.completed);
                if (navigator.serviceWorker.controller) {
                  navigator.serviceWorker.controller.postMessage({
                    type: "SET_TASKS",
                    tasks: uncompleted,
                  });
                }
              } catch (e) {}
            }
          });
        })
        .catch((err) =>
          console.error("Service Worker registration failed:", err),
        );
    }

    // Request desktop/mobile notification permission
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission();
    }
  }, []);

  const toggleCollapse = () => {
    const nextState = !sidebarCollapsed;
    setSidebarCollapsed(nextState);
    localStorage.setItem("fpa_sidebar_collapsed", nextState.toString());
  };

  return (
    <div
      className={`app-container ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}
    >
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
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <img
            src="/logo.png"
            alt="Logo"
            className="logo-icon"
            style={{ height: "32px", width: "auto" }}
          />
          <span className="mobile-logo-text">My SuperApp</span>
        </div>
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
        <SpendingReminder />
        {children}
      </main>
    </div>
  );
}
