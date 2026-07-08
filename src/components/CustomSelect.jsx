"use client";

import { useState, useRef, useEffect } from "react";

/**
 * CustomSelect — a fully div-based dropdown replacing native <select>.
 *
 * Props:
 *   value       – current selected value (string)
 *   onChange    – called with (value: string) when user picks an option
 *   options     – array of { value: string, label: string, icon?: string }
 *   placeholder – text shown when no value selected (optional)
 *   id          – id for the trigger button (accessibility, optional)
 *   size        – "default" | "compact"  (compact = filter bar variant)
 *   disabled    – boolean
 */
export default function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = "Select...",
  id,
  size = "default",
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const selected = options.find((o) => o.value === value);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleSelect = (optValue) => {
    onChange(optValue);
    setOpen(false);
  };

  const isCompact = size === "compact";

  return (
    <div
      ref={containerRef}
      className={`custom-select-wrapper ${isCompact ? "custom-select-compact" : ""} ${open ? "custom-select-open" : ""} ${disabled ? "custom-select-disabled" : ""}`}
      style={{ position: "relative", width: "100%" }}
    >
      {/* Trigger Button */}
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className="custom-select-trigger"
      >
        <span className="custom-select-label">
          {selected ? (
            <>
              {selected.icon && (
                <span className="custom-select-icon">{selected.icon}</span>
              )}
              {selected.label}
            </>
          ) : (
            <span className="custom-select-placeholder">{placeholder}</span>
          )}
        </span>
        <span
          className="custom-select-chevron"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {/* Dropdown Panel */}
      {open && (
        <ul
          role="listbox"
          className="custom-select-dropdown"
        >
          {options.map((opt) => {
            const isActive = opt.value === value;
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isActive}
                onClick={() => handleSelect(opt.value)}
                className={`custom-select-option ${isActive ? "custom-select-option-active" : ""}`}
              >
                {opt.icon && (
                  <span className="custom-select-option-icon">{opt.icon}</span>
                )}
                <span>{opt.label}</span>
                {isActive && (
                  <span className="custom-select-check">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
