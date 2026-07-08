"use client";

import { useState, useEffect } from "react";
import {
  getFixedSpends,
  saveFixedSpend,
  deleteFixedSpend,
  getMonthlySalary,
} from "@/lib/storage";
import CustomSelect from "@/components/CustomSelect";

const FIXED_CATEGORIES = [
  "Contributions",
  "Housing/Rent",
  "Bills/Utilities",
  "Insurance",
  "Subscription",
  "Other",
];

export default function FixedSpends() {
  const [mounted, setMounted] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [fixedSpends, setFixedSpends] = useState([]);
  const [monthlySalary, setMonthlySalary] = useState(4200.0);

  // Form State
  const [editId, setEditId] = useState(null); // null when adding new
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Contributions");
  const [description, setDescription] = useState("");

  // UI State
  const [error, setError] = useState("");
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    setMounted(true);
    const loadData = async () => {
      try {
        const fixed = await getFixedSpends();
        const salary = await getMonthlySalary();
        setFixedSpends(fixed);
        setMonthlySalary(salary);
      } catch (err) {
        console.error("Failed to load fixed spends", err);
      }
    };
    loadData();
  }, []);

  const addToast = (message, toastType = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type: toastType }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const handleEditClick = (item) => {
    setEditId(item.id);
    setTitle(item.title);
    setAmount(item.amount.toString());
    setCategory(item.category || "Contributions");
    setDescription(item.description || "");
    setError("");
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setTitle("");
    setAmount("");
    setCategory("Contributions");
    setDescription("");
    setError("");
  };

  const handleDeleteClick = async (id, titleText) => {
    if (
      confirm(
        `Are you sure you want to remove the monthly fixed spend for "${titleText}"?`,
      )
    ) {
      await deleteFixedSpend(id);
      const updated = await getFixedSpends();
      setFixedSpends(updated);
      addToast(`Removed fixed spend: "${titleText}"`, "success");

      // If we were editing the deleted item, reset the form
      if (editId === id) {
        handleCancelEdit();
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Please enter a title.");
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError("Please enter a valid, positive monthly amount.");
      return;
    }

    const payload = {
      id: editId || undefined,
      title: title.trim(),
      amount: numericAmount,
      category,
      description: description.trim(),
    };

    try {
      await saveFixedSpend(payload);
      const updated = await getFixedSpends();
      setFixedSpends(updated);

      addToast(
        editId
          ? `Updated fixed spend: "${payload.title}"`
          : `Added new fixed spend: "${payload.title}"`,
        "success",
      );

      // Reset form
      handleCancelEdit();
    } catch (err) {
      console.error("Error saving fixed spend", err);
      setError("Failed to save. Please try again.");
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat("en-MY", {
      style: "currency",
      currency: "MYR",
    }).format(val);
  };

  const epfAmount = monthlySalary * 0.11;
  const socsoAmount = Math.min(monthlySalary * 0.005, 24.75);

  const autoCalculatedSpends = [
    {
      id: "fix-epf-auto",
      title: "EPF Contribution (Auto)",
      amount: epfAmount,
      category: "Contributions",
      description:
        "Employees Provident Fund monthly deduction (11% of gross salary)",
      isAuto: true,
    },
    {
      id: "fix-socso-auto",
      title: "SOCSO Contribution (Auto)",
      amount: socsoAmount,
      category: "Contributions",
      description:
        "Social Security Organization monthly deduction (0.5%, capped at $24.75)",
      isAuto: true,
    },
  ];

  const allFixedSpends = [...autoCalculatedSpends, ...fixedSpends];

  const totalFixedAmount = allFixedSpends.reduce(
    (sum, item) => sum + item.amount,
    0,
  );

  if (!mounted) {
    return (
      <div className="empty-state">
        <h2>Loading Fixed Spends...</h2>
      </div>
    );
  }

  return (
    <>
      {/* Toast notifications */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <span className="toast-icon">✓</span>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Monthly Fixed Spends</h1>
          <p className="page-subtitle">
            Configure recurring deductions that occur automatically every month
          </p>
        </div>
      </div>

      {/* KPI Card for Total Fixed Spends */}
      <div className="kpi-grid" style={{ gridTemplateColumns: "1fr" }}>
        <div className="kpi-card expense" style={{ alignSelf: "start" }}>
          <span className="kpi-title">Total Auto-Deducted Fixed Cost</span>
          <span className="kpi-value text-spend">
            {formatCurrency(totalFixedAmount)}
          </span>
          <div className="kpi-meta">
            <span>
              Deducted automatically from your monthly Net Savings on the
              Dashboard.
            </span>
          </div>
        </div>
      </div>

      {/* Two column grid: left (list of items), right (editor form) */}
      <div className="responsive-grid">
        {/* Left Column: List of items */}
        <div className="section-card">
          <h2 className="section-title">Active Fixed Spends</h2>

          {allFixedSpends.length === 0 ? (
            <div className="empty-state" style={{ padding: "30px 20px" }}>
              <span style={{ fontSize: "2rem" }}>🔒</span>
              <h3>No fixed spends configured</h3>
              <p>
                Add itemized fixed expenses on the right (like rent,
                subscriptions, or statutory dues).
              </p>
            </div>
          ) : (
            <div className="detail-item-list" style={{ maxHeight: "480px" }}>
              {allFixedSpends.map((item) => (
                <div
                  key={item.id}
                  className="detail-item"
                  style={{
                    borderLeft: `4px solid ${item.isAuto ? "var(--primary)" : editId === item.id ? "var(--primary)" : "var(--color-spend)"}`,
                  }}
                >
                  <div className="detail-item-header">
                    <span className="detail-item-title">{item.title}</span>
                    <span className="detail-item-amount spend">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>

                  {item.description && (
                    <p className="detail-item-desc">{item.description}</p>
                  )}

                  <div
                    className="detail-item-footer"
                    style={{ marginTop: "8px" }}
                  >
                    <span
                      className="kpi-meta-badge"
                      style={{
                        backgroundColor: item.isAuto
                          ? "var(--primary-glow)"
                          : "rgba(244, 63, 94, 0.05)",
                        color: item.isAuto
                          ? "var(--primary)"
                          : "var(--text-secondary)",
                      }}
                    >
                      {item.category || "Fixed Spend"}
                    </span>
                    {item.isAuto ? (
                      <span
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--text-muted)",
                          fontStyle: "italic",
                        }}
                      >
                        Auto-Calculated
                      </span>
                    ) : (
                      <div style={{ display: "flex", gap: "12px" }}>
                        <button
                          className="delete-action-btn"
                          style={{ color: "var(--primary)" }}
                          onClick={() => handleEditClick(item)}
                        >
                          Edit
                        </button>
                        <button
                          className="delete-action-btn"
                          onClick={() => handleDeleteClick(item.id, item.title)}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Editor Form */}
        <div className="section-card">
          <h2 className="section-title">
            {editId ? "Edit Fixed Spend" : "Add Monthly Fixed Spend"}
          </h2>

          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "18px" }}
          >
            <div className="form-group">
              <label className="form-label" htmlFor="fix-title">
                Fixed Cost Name
              </label>
              <input
                id="fix-title"
                type="text"
                className="form-input"
                placeholder="e.g. EPF, Rent, Spotify, Insurance"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="fix-amount">
                  Monthly Amount (RM)
                </label>
                <input
                  id="fix-amount"
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
                <label className="form-label" htmlFor="fix-category">
                  Category
                </label>
                <CustomSelect
                  id="fix-category"
                  value={category}
                  onChange={(val) => setCategory(val)}
                  options={FIXED_CATEGORIES.map((c) => ({ value: c, label: c }))}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="fix-desc">
                Description (Optional)
              </label>
              <textarea
                id="fix-desc"
                className="form-input form-textarea"
                style={{ minHeight: "80px" }}
                placeholder="e.g. SOCSO contribution or monthly apartment rent"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {error && (
              <div
                style={{
                  color: "var(--color-spend)",
                  fontSize: "0.9rem",
                  fontWeight: "600",
                }}
              >
                ⚠️ {error}
              </div>
            )}

            <div style={{ display: "flex", gap: "16px", marginTop: "8px" }}>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flexGrow: 1 }}
              >
                {editId ? "Update Fixed Spend" : "Save Fixed Spend"}
              </button>
              {editId && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCancelEdit}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
