"use client";

import { useState, useEffect } from "react";
import { saveTransaction } from "@/lib/storage";
import CustomSelect from "@/components/CustomSelect";

const SPEND_CATEGORIES = ["Food", "Transportation", "Entertainment", "Utilities", "Health", "Other"];
const EARN_CATEGORIES = ["Salary", "Investments", "Side Project", "Other"];

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

  useEffect(() => {
    setMounted(true);
    
    // Set default date to today in YYYY-MM-DD local format
    const today = new Date();
    const formattedDate = today.toLocaleDateString("en-CA"); // YYYY-MM-DD standard format
    const requestedDate = new URLSearchParams(window.location.search).get("date");
    const initialDate =
      requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) && requestedDate <= formattedDate
        ? requestedDate
        : formattedDate;

    setDate(initialDate);
    setMaxDate(formattedDate);
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

      <div className="page-header">
        <div>
          <h1 className="page-title">Add Transaction</h1>
          <p className="page-subtitle">Log new expense or income entries manually</p>
        </div>
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
              <label className="form-label" htmlFor="tx-amount">Amount (RM)</label>
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
              <label className="form-label" htmlFor="tx-date">Transaction Date</label>
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
    </>
  );
}
