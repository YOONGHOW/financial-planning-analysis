"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { saveTransaction } from "@/lib/storage";
import CustomSelect from "@/components/CustomSelect";

const SPEND_CATEGORIES = ["Food", "Transportation", "Entertainment", "Utilities", "Health", "Other"];
const EARN_CATEGORIES = ["Salary", "Investments", "Side Project", "Other"];

function getFlagEmoji(currencyCode) {
  if (!currencyCode) return "🏳️";
  const code = currencyCode.toUpperCase();
  if (code === "EUR") return "🇪🇺";
  if (code === "USD") return "🇺🇸";
  if (code === "GBP") return "🇬🇧";
  if (code === "CAD") return "🇨🇦";
  if (code === "AUD") return "🇦🇺";
  if (code === "SGD") return "🇸🇬";
  if (code === "HKD") return "🇭🇰";
  
  const countryCode = code.slice(0, 2);
  const codePoints = countryCode
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  try {
    return String.fromCodePoint(...codePoints);
  } catch (e) {
    return "🏳️";
  }
}

export default function AddTransaction() {
  const [mounted, setMounted] = useState(false);
  
  // Form State
  const [type, setType] = useState("spend"); // spend | earn
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [maxDate, setMaxDate] = useState("");
  
  // UI feedback state
  const [error, setError] = useState("");
  const [toasts, setToasts] = useState([]); // List of active toast notifications

  // Currency Converter Modal State
  const [rates, setRates] = useState({});
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [srcCurrency, setSrcCurrency] = useState("USD");
  const [targetCurrency, setTargetCurrency] = useState("MYR");
  const [srcAmount, setSrcAmount] = useState("");
  const [convertedValue, setConvertedValue] = useState(0);
  const [isLoadingRates, setIsLoadingRates] = useState(false);
  const [ratesError, setRatesError] = useState("");

  // Custom Dropdown UI States
  const [isSrcDropdownOpen, setIsSrcDropdownOpen] = useState(false);
  const [isTargetDropdownOpen, setIsTargetDropdownOpen] = useState(false);
  const [srcSearch, setSrcSearch] = useState("");
  const [targetSearch, setTargetSearch] = useState("");

  const currencyList = useMemo(() => {
    return Object.keys(rates).sort();
  }, [rates]);

  // Fetch Exchange Rates on Modal Open
  useEffect(() => {
    if (isConvertModalOpen) {
      setIsLoadingRates(true);
      setRatesError("");
      fetch("https://open.er-api.com/v6/latest/USD")
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load live exchange rates from the API.");
          return res.json();
        })
        .then((data) => {
          if (data && data.rates) {
            setRates(data.rates);
          } else {
            throw new Error("Invalid API response format.");
          }
        })
        .catch((e) => {
          console.error("Exchange rates fetch failed:", e);
          setRatesError("Unable to retrieve live exchange rates. Please check your internet connection.");
        })
        .finally(() => {
          setIsLoadingRates(false);
        });
    }
  }, [isConvertModalOpen]);

  // Compute Converted Amount Reactively
  useEffect(() => {
    const amt = parseFloat(srcAmount);
    if (isNaN(amt) || amt <= 0) {
      setConvertedValue(0);
      return;
    }

    const rateSrc = rates[srcCurrency];
    const rateTarget = rates[targetCurrency];

    if (rateSrc && rateTarget) {
      const result = (amt / rateSrc) * rateTarget;
      setConvertedValue(result);
    } else {
      setConvertedValue(0);
    }
  }, [srcAmount, srcCurrency, targetCurrency, rates]);

  useEffect(() => {
    setMounted(true);
    
    // Set default date to today in YYYY-MM-DD local format
    const today = new Date();
    const formattedDate = today.toLocaleDateString("en-CA"); // YYYY-MM-DD standard format
    
    const params = new URLSearchParams(window.location.search);
    const requestedDate = params.get("date");
    const initialDate =
      requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) && requestedDate <= formattedDate
        ? requestedDate
        : formattedDate;

    setDate(initialDate);
    setMaxDate(formattedDate);

    // Prefill form from URL query parameters (Task integration)
    const urlTitle = params.get("title");
    const urlAmount = params.get("amount");
    const urlDesc = params.get("description");
    const urlType = params.get("type");

    if (urlTitle) setTitle(urlTitle);
    if (urlAmount) setAmount(urlAmount);
    if (urlDesc) setDescription(urlDesc);
    if (urlType === "spend" || urlType === "earn") {
      setType(urlType);
    }
  }, []);

  // Update default category when type toggles
  useEffect(() => {
    if (type === "spend") {
      setCategory("Food");
    } else {
      setCategory("Salary");
    }
  }, [type]);

  const addToast = (message, toastType = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type: toastType }]);
    
    // Remove toast after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!title.trim()) {
      setError("Please enter a title or vendor name.");
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError("Please enter a valid, positive amount.");
      return;
    }

    if (!date) {
      setError("Please select a date.");
      return;
    }

    if (date > maxDate) {
      setError("Transaction date cannot be in the future.");
      return;
    }

    // Prepare transaction payload
    const transaction = {
      title: title.trim(),
      amount: numericAmount,
      type,
      category,
      date,
      description: description.trim()
    };

    try {
      await saveTransaction(transaction);
      
      // Success feedback
      addToast(
        `Added ${type === "spend" ? "Spend" : "Earnings"}: "${title}" of RM ${numericAmount.toFixed(2)}`,
        "success"
      );

      // Reset fields but keep type, date and categories
      setTitle("");
      setAmount("");
      setDescription("");
      setError("");
    } catch (err) {
      console.error("Error saving transaction", err);
      setError("Failed to save transaction. Please try again.");
    }
  };

  if (!mounted) {
    return (
      <div className="empty-state">
        <h2>Loading form...</h2>
      </div>
    );
  }

  const categoryOptions = type === "spend" ? SPEND_CATEGORIES : EARN_CATEGORIES;

  return (
    <>
      {/* Toast Notification Container */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <span className="toast-icon">
              {toast.type === "success" ? "✓" : "⚠"}
            </span>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 className="page-title">Add Transaction</h1>
          <p className="page-subtitle">Log new expense or income entries manually</p>
        </div>
        <Link
          href="/fixed"
          className="btn"
          style={{
            padding: "8px 28px",
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            height: "38px",
            minWidth: "180px",
            background: "#f59e0b",
            color: "#0f172a",
            border: "none",
            fontWeight: "700"
          }}
        >
          🔒 Fixed Spends
        </Link>
      </div>

      <div className="form-container">
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Toggle Type spend vs earn */}
          <div className="form-group">
            <label className="form-label">Transaction Type</label>
            <div className="toggle-group">
              <button
                type="button"
                className={`toggle-btn ${type === "spend" ? "active spend" : ""}`}
                onClick={() => setType("spend")}
              >
                💸 Spend / Expense
              </button>
              <button
                type="button"
                className={`toggle-btn ${type === "earn" ? "active earn" : ""}`}
                onClick={() => setType("earn")}
              >
                📈 Earn / Income
              </button>
            </div>
          </div>

          {/* Title / Description */}
          <div className="form-group">
            <label className="form-label" htmlFor="tx-title">Title / Payee</label>
            <input
              id="tx-title"
              type="text"
              className="form-input"
              placeholder="e.g. Whole Foods, Monthly Salary, Gas Station"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Amount and Date Form Row */}
          <div className="form-row">
            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px", height: "26px" }}>
                <label className="form-label" htmlFor="tx-amount" style={{ margin: 0 }}>Amount (RM)</label>
                <button
                  type="button"
                  onClick={() => setIsConvertModalOpen(true)}
                  className="btn btn-secondary"
                  style={{
                    padding: "4px 8px",
                    fontSize: "0.75rem",
                    height: "auto",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    cursor: "pointer",
                    borderRadius: "4px"
                  }}
                >
                  <i className="fa-solid fa-coins" style={{ fontSize: "0.7rem" }}></i> Convert
                </button>
              </div>
              <input
                id="tx-amount"
                type="number"
                step="0.01"
                min="0.01"
                className="form-input"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <div style={{ display: "flex", alignItems: "center", marginBottom: "6px", height: "26px" }}>
                <label className="form-label" htmlFor="tx-date" style={{ margin: 0 }}>Transaction Date</label>
              </div>
              <input
                id="tx-date"
                type="date"
                className="form-input"
                value={date}
                max={maxDate}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Category Dropdown */}
          <div className="form-group">
            <label className="form-label" htmlFor="tx-category">Category</label>
            <CustomSelect
              id="tx-category"
              value={category}
              onChange={(val) => setCategory(val)}
              options={categoryOptions.map((cat) => ({ value: cat, label: cat }))}
            />
          </div>

          {/* Notes / Description */}
          <div className="form-group">
            <label className="form-label" htmlFor="tx-desc">Notes / Description (Optional)</label>
            <textarea
              id="tx-desc"
              className="form-input form-textarea"
              placeholder="Provide a brief explanation or details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Form Level Error Message */}
          {error && (
            <div style={{ color: "var(--color-spend)", fontSize: "0.9rem", fontWeight: "600" }}>
              ⚠️ {error}
            </div>
          )}

          {/* Submission buttons */}
          <div style={{ display: "flex", gap: "16px", marginTop: "12px" }}>
            <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>
              Save Transaction
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setTitle("");
                setAmount("");
                setDescription("");
                setError("");
              }}
            >
              Clear Form
            </button>
          </div>

        </form>
      </div>

      {/* Currency Converter Modal */}
      {isConvertModalOpen && (
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px"
          }}
        >
          <div 
            className="card" 
            style={{ 
              width: "100%", 
              maxWidth: "460px", 
              padding: "24px", 
              display: "flex", 
              flexDirection: "column", 
              gap: "20px",
              boxShadow: "var(--shadow-glow)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>
                <i className="fa-solid fa-calculator" style={{ color: "var(--primary)" }}></i>
                Convert Currency
              </h3>
              <button 
                type="button"
                onClick={() => setIsConvertModalOpen(false)}
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1.3rem", fontWeight: "700" }}
              >
                &times;
              </button>
            </div>

            {isLoadingRates ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 0", gap: "12px", color: "var(--text-secondary)" }}>
                <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: "1.8rem", color: "var(--primary)" }}></i>
                <span>Fetching live exchange rates...</span>
              </div>
            ) : ratesError ? (
              <div style={{ padding: "16px", background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", gap: "10px", color: "var(--color-spend)", fontSize: "0.85rem", lineHeight: "1.4" }}>
                <i className="fa-solid fa-circle-exclamation" style={{ fontSize: "1.1rem" }}></i>
                <span>{ratesError}</span>
              </div>
            ) : (
              <>
                {/* Source currency input */}
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: "6px" }}>From Currency Amount</label>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={srcAmount}
                      onChange={(e) => setSrcAmount(e.target.value)}
                      className="form-input"
                      style={{ flexGrow: 1 }}
                    />
                    
                    {/* Custom Source Currency Dropdown using DIV */}
                    <div style={{ position: "relative", width: "120px" }}>
                      <div
                        onClick={() => {
                          setIsSrcDropdownOpen(!isSrcDropdownOpen);
                          setIsTargetDropdownOpen(false);
                        }}
                        className="form-input"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          cursor: "pointer",
                          height: "100%",
                          padding: "0 10px"
                        }}
                      >
                        <span>{getFlagEmoji(srcCurrency)} {srcCurrency}</span>
                        <i className={`fa-solid fa-chevron-${isSrcDropdownOpen ? "up" : "down"}`} style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}></i>
                      </div>

                      {isSrcDropdownOpen && (
                        <div
                          style={{
                            position: "absolute",
                            top: "105%",
                            right: 0,
                            width: "260px",
                            backgroundColor: "var(--bg-card)",
                            border: "1px solid var(--border-color)",
                            borderRadius: "var(--radius-sm)",
                            maxHeight: "220px",
                            overflowY: "auto",
                            zIndex: 1100,
                            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)"
                          }}
                        >
                          <input
                            type="text"
                            placeholder="Search currency..."
                            value={srcSearch}
                            onChange={(e) => setSrcSearch(e.target.value)}
                            style={{
                              width: "100%",
                              padding: "8px 12px",
                              background: "var(--bg-main)",
                              border: "none",
                              borderBottom: "1px solid var(--border-color)",
                              color: "var(--text-primary)",
                              fontSize: "0.85rem",
                              outline: "none",
                              position: "sticky",
                              top: 0,
                              zIndex: 1
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          {currencyList
                            .filter((code) => code.toLowerCase().includes(srcSearch.toLowerCase()))
                            .map((code) => {
                              const rate = rates[code] || 0;
                              return (
                                <div
                                  key={code}
                                  onClick={() => {
                                    setSrcCurrency(code);
                                    setIsSrcDropdownOpen(false);
                                    setSrcSearch("");
                                  }}
                                  style={{
                                    padding: "8px 12px",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    cursor: "pointer",
                                    background: srcCurrency === code ? "rgba(20, 184, 166, 0.15)" : "transparent",
                                    borderBottom: "1px solid rgba(255,255,255,0.02)",
                                    fontSize: "0.85rem"
                                  }}
                                  className="custom-dropdown-item"
                                >
                                  <span>{getFlagEmoji(code)} {code}</span>
                                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                    1 USD = {rate.toFixed(2)}
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Target currency input */}
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: "6px" }}>To Target Currency</label>
                  
                  {/* Custom Target Currency Dropdown using DIV */}
                  <div style={{ position: "relative", width: "100%" }}>
                    <div
                      onClick={() => {
                        setIsTargetDropdownOpen(!isTargetDropdownOpen);
                        setIsSrcDropdownOpen(false);
                      }}
                      className="form-input"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: "pointer",
                        padding: "10px 12px"
                      }}
                    >
                      <span>
                        {getFlagEmoji(targetCurrency)} {targetCurrency} {rates[targetCurrency] ? `(1 USD = ${rates[targetCurrency].toFixed(2)})` : ""}
                      </span>
                      <i className={`fa-solid fa-chevron-${isTargetDropdownOpen ? "up" : "down"}`} style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}></i>
                    </div>

                    {isTargetDropdownOpen && (
                      <div
                        style={{
                          position: "absolute",
                          top: "105%",
                          left: 0,
                          right: 0,
                          backgroundColor: "var(--bg-card)",
                          border: "1px solid var(--border-color)",
                          borderRadius: "var(--radius-sm)",
                          maxHeight: "220px",
                          overflowY: "auto",
                          zIndex: 1100,
                          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)"
                        }}
                      >
                        <input
                          type="text"
                          placeholder="Search currency..."
                          value={targetSearch}
                          onChange={(e) => setTargetSearch(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            background: "var(--bg-main)",
                            border: "none",
                            borderBottom: "1px solid var(--border-color)",
                            color: "var(--text-primary)",
                            fontSize: "0.85rem",
                            outline: "none",
                            position: "sticky",
                            top: 0,
                            zIndex: 1
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        {currencyList
                          .filter((code) => code.toLowerCase().includes(targetSearch.toLowerCase()))
                          .map((code) => {
                            const rate = rates[code] || 0;
                            return (
                              <div
                                key={code}
                                onClick={() => {
                                  setTargetCurrency(code);
                                  setIsTargetDropdownOpen(false);
                                  setTargetSearch("");
                                }}
                                style={{
                                  padding: "8px 12px",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  cursor: "pointer",
                                  background: targetCurrency === code ? "rgba(20, 184, 166, 0.15)" : "transparent",
                                  borderBottom: "1px solid rgba(255,255,255,0.02)",
                                  fontSize: "0.85rem"
                                }}
                                className="custom-dropdown-item"
                              >
                                <span>{getFlagEmoji(code)} {code}</span>
                                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                  1 USD = {rate.toFixed(2)}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Converted Output Display */}
                {convertedValue > 0 && (
                  <div 
                    style={{ 
                      padding: "16px", 
                      background: "rgba(255,255,255,0.02)", 
                      border: "1px dashed var(--border-color)", 
                      borderRadius: "var(--radius-md)", 
                      textAlign: "center" 
                    }}
                  >
                    <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                      Converted Value
                    </div>
                    <div style={{ fontSize: "1.5rem", fontWeight: "800", color: "var(--color-earn)" }}>
                      {targetCurrency} {convertedValue.toFixed(2)}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "6px" }}>
                      Rate: 1 {srcCurrency} ≈ {(convertedValue / parseFloat(srcAmount)).toFixed(4)} {targetCurrency}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Modal Buttons */}
            <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ flexGrow: 1 }}
                disabled={convertedValue <= 0 || isLoadingRates || !!ratesError}
                onClick={() => {
                  setAmount(convertedValue.toFixed(2));
                  setIsConvertModalOpen(false);
                }}
              >
                Apply to Amount
              </button>
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => setIsConvertModalOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
