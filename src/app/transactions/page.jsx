"use client";

import { useState, useEffect, useMemo } from "react";
import { getTransactions, deleteTransaction, saveTransaction } from "@/lib/storage";
import CustomSelect from "@/components/CustomSelect";

const SPEND_CATEGORIES = ["Food", "Transportation", "Entertainment", "Utilities", "Health", "Other"];
const EARN_CATEGORIES = ["Salary", "Investments", "Side Project", "Other"];

const CATEGORY_COLORS = {
  Food: "#f59e0b", // Amber
  Transportation: "#8b5cf6", // Violet
  Entertainment: "#ec4899", // Pink
  Utilities: "#0ea5e9", // Sky
  Health: "#ef4444", // Red
  Salary: "#10b981", // Emerald
  Investments: "#3b82f6", // Blue
  "Side Project": "#14b8a6", // Teal
  Other: "#64748b" // Slate
};

export default function TransactionsList() {
  const [mounted, setMounted] = useState(false);
  const [transactions, setTransactions] = useState([]);
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Edit Form States
  const [editingTx, setEditingTx] = useState(null);
  const [editType, setEditType] = useState("spend");
  const [editTitle, setEditTitle] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState("Food");
  const [editDate, setEditDate] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editError, setEditError] = useState("");

  const maxDate = useMemo(() => {
    return new Date().toLocaleDateString("en-CA");
  }, []);

  useEffect(() => {
    setMounted(true);
    const loadData = async () => {
      try {
        const txs = await getTransactions();
        setTransactions(txs);
      } catch (err) {
        console.error("Failed to load transactions", err);
      }
    };
    loadData();

    // Auto detect current real month (YYYY-MM)
    const today = new Date();
    const currentRealMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    setSelectedMonth(currentRealMonth);
  }, []);

  // Sync edit category selection when edit type switches
  useEffect(() => {
    if (editingTx) {
      if (editType === "spend" && !SPEND_CATEGORIES.includes(editCategory)) {
        setEditCategory("Food");
      } else if (editType === "earn" && !EARN_CATEGORIES.includes(editCategory)) {
        setEditCategory("Salary");
      }
    }
  }, [editType, editingTx]);

  const handleStartEdit = (tx) => {
    setEditingTx(tx);
    setEditType(tx.type);
    setEditTitle(tx.title);
    setEditAmount(tx.amount.toString());
    setEditCategory(tx.category);
    setEditDate(tx.date);
    setEditDescription(tx.description || "");
    setEditError("");
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditError("");

    if (!editTitle.trim()) {
      setEditError("Please enter a title or vendor name.");
      return;
    }

    if (editDate > maxDate) {
      setEditError("Transaction date cannot be in the future.");
      return;
    }

    const numericAmount = parseFloat(editAmount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setEditError("Please enter a valid amount greater than zero.");
      return;
    }

    const updatedTx = {
      ...editingTx,
      title: editTitle.trim(),
      amount: numericAmount,
      type: editType,
      category: editCategory,
      date: editDate,
      description: editDescription.trim()
    };

    try {
      await saveTransaction(updatedTx);
      const txs = await getTransactions();
      setTransactions(txs);
      setEditingTx(null);
    } catch (err) {
      console.error("Error saving edit", err);
      setEditError("Failed to save changes. Please try again.");
    }
  };

  // Extract all unique categories dynamically present in storage
  const availableCategories = useMemo(() => {
    const categories = new Set();
    transactions.forEach(t => {
      if (t.category) {
        categories.add(t.category);
      }
    });
    return Array.from(categories).sort();
  }, [transactions]);

  // Extract unique months dynamically based on available transaction dates
  const uniqueMonths = useMemo(() => {
    const months = new Set();
    transactions.forEach(t => {
      if (t.date && t.date.length >= 7) {
        months.add(t.date.substring(0, 7));
      }
    });
    const today = new Date();
    const currentRealMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    months.add(currentRealMonth);
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  // Handle transaction deletion
  const handleDeleteTx = async (id, titleText) => {
    if (confirm(`Are you sure you want to delete the transaction "${titleText}"?`)) {
      await deleteTransaction(id);
      const updated = await getTransactions();
      setTransactions(updated);
    }
  };

  // Filter and Sort Transactions (Newest Date First)
  const filteredTransactions = useMemo(() => {
    if (!selectedMonth) return [];
    return transactions
      .filter(t => {
        // Month Filter
        const matchesMonth = t.date && t.date.startsWith(selectedMonth);

        // Search Term (matches title or description)
        const matchesSearch = 
          t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase()));
        
        // Type Filter
        const matchesType = typeFilter === "all" || t.type === typeFilter;

        // Category Filter
        const matchesCategory = categoryFilter === "all" || t.category === categoryFilter;

        return matchesMonth && matchesSearch && matchesType && matchesCategory;
      })
      .sort((a, b) => b.date.localeCompare(a.date)); // Sort chronologically day-by-day (newest first)
  }, [transactions, selectedMonth, searchTerm, typeFilter, categoryFilter]);

  // Compute Stats for the filtered subset
  const filteredStats = useMemo(() => {
    let inflow = 0;
    let outflow = 0;

    filteredTransactions.forEach(t => {
      if (t.type === "earn") {
        inflow += t.amount;
      } else if (t.type === "spend") {
        outflow += t.amount;
      }
    });

    return {
      count: filteredTransactions.length,
      inflow,
      outflow,
      net: inflow - outflow
    };
  }, [filteredTransactions]);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat("en-MY", {
      style: "currency",
      currency: "MYR"
    }).format(val);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const parts = dateStr.split("T")[0].split("-");
    if (parts.length !== 3) return dateStr;
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const day = parseInt(parts[2]);
    const date = new Date(year, month, day);
    return date.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  };

  const formatMonthLabel = (monthStr) => {
    if (!monthStr) return "";
    const [year, month] = monthStr.split("-");
    const date = new Date(year, parseInt(month) - 1, 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  if (!mounted) {
    return (
      <div className="empty-state">
        <h2>Loading transactions...</h2>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Transaction Records</h1>
          <p className="page-subtitle">View and manage your complete historical records day-by-day</p>
        </div>
      </div>

      {/* Filter and Search Bar Card */}
      <div className="section-card desktop-filters" style={{ gap: "20px", padding: "24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", gap: "16px" }}>
          
          {/* Search box */}
          <div className="form-group">
            <label className="form-label" htmlFor="search-input" style={{ fontSize: "0.75rem" }}>Search Payee / Description</label>
            <input
              id="search-input"
              type="text"
              className="form-input"
              style={{ padding: "10px 14px", fontSize: "0.9rem" }}
              placeholder="e.g. Whole Foods, Grocery, Freelance..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Month dropdown */}
          <div className="form-group">
            <label className="form-label" htmlFor="month-filter" style={{ fontSize: "0.75rem" }}>Filter Month</label>
            <CustomSelect
              id="month-filter"
              size="compact"
              value={selectedMonth}
              onChange={(val) => setSelectedMonth(val)}
              options={uniqueMonths.map(m => ({ value: m, label: formatMonthLabel(m) }))}
            />
          </div>

          {/* Type dropdown */}
          <div className="form-group">
            <label className="form-label" htmlFor="type-filter" style={{ fontSize: "0.75rem" }}>Transaction Type</label>
            <CustomSelect
              id="type-filter"
              size="compact"
              value={typeFilter}
              onChange={(val) => setTypeFilter(val)}
              options={[
                { value: "all", label: "All Types" },
                { value: "spend", label: "Spend / Expense", icon: "💸" },
                { value: "earn", label: "Earn / Income", icon: "📈" },
              ]}
            />
          </div>

          {/* Category dropdown */}
          <div className="form-group">
            <label className="form-label" htmlFor="cat-filter" style={{ fontSize: "0.75rem" }}>Category</label>
            <CustomSelect
              id="cat-filter"
              size="compact"
              value={categoryFilter}
              onChange={(val) => setCategoryFilter(val)}
              options={[
                { value: "all", label: "All Categories" },
                ...availableCategories.map(cat => ({ value: cat, label: cat }))
              ]}
            />
          </div>

        </div>
      </div>

      {/* Mobile Search & Filter Trigger Bar */}
      <div className="mobile-search-container">
        <div style={{ position: "relative", flex: 1 }}>
          <input
            type="text"
            className="form-input"
            style={{ width: "100%", padding: "12px 16px 12px 40px", fontSize: "0.95rem" }}
            placeholder="Search payee or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}>
            🔍
          </span>
        </div>
        <button 
          className={`mobile-filter-trigger ${mobileFiltersOpen || selectedMonth || typeFilter !== "all" || categoryFilter !== "all" ? "active" : ""}`}
          onClick={() => setMobileFiltersOpen(true)}
          aria-label="Filter transactions"
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
        </button>
      </div>

      {/* Mobile Filters Bottom Sheet */}
      {mobileFiltersOpen && (
        <div className="bottom-sheet-overlay" onClick={() => setMobileFiltersOpen(false)}>
          <div className="bottom-sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="bottom-sheet-header">
              <span className="bottom-sheet-title">Filter Records</span>
              <button className="bottom-sheet-close-btn" onClick={() => setMobileFiltersOpen(false)}>
                ✕
              </button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Month Dropdown */}
              <div className="form-group">
                <label className="form-label" style={{ fontSize: "0.8rem" }}>Filter Month</label>
                <CustomSelect
                  id="mobile-month-filter"
                  value={selectedMonth}
                  onChange={(val) => setSelectedMonth(val)}
                  options={uniqueMonths.map(m => ({ value: m, label: formatMonthLabel(m) }))}
                />
              </div>

              {/* Type Dropdown */}
              <div className="form-group">
                <label className="form-label" style={{ fontSize: "0.8rem" }}>Transaction Type</label>
                <CustomSelect
                  id="mobile-type-filter"
                  value={typeFilter}
                  onChange={(val) => setTypeFilter(val)}
                  options={[
                    { value: "all", label: "All Types" },
                    { value: "spend", label: "Spend / Expense", icon: "💸" },
                    { value: "earn", label: "Earn / Income", icon: "📈" },
                  ]}
                />
              </div>

              {/* Category Dropdown */}
              <div className="form-group">
                <label className="form-label" style={{ fontSize: "0.8rem" }}>Category</label>
                <CustomSelect
                  id="mobile-cat-filter"
                  value={categoryFilter}
                  onChange={(val) => setCategoryFilter(val)}
                  options={[
                    { value: "all", label: "All Categories" },
                    ...availableCategories.map(cat => ({ value: cat, label: cat }))
                  ]}
                />
              </div>
            </div>

            <button 
              className="btn btn-primary" 
              style={{ width: "100%", marginTop: "10px" }}
              onClick={() => setMobileFiltersOpen(false)}
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}

      {/* Filtered Subset Statistics Bar */}
      <div className="stats-summary-bar">
        <div className="stats-summary-item">
          <span>Results:</span>
          <span className="stats-summary-val">{filteredStats.count} entries</span>
        </div>
        <div className="stats-summary-item">
          <span>Total Inflow:</span>
          <span className="stats-summary-val text-earn">{formatCurrency(filteredStats.inflow)}</span>
        </div>
        <div className="stats-summary-item">
          <span>Total Outflow:</span>
          <span className="stats-summary-val text-spend">{formatCurrency(filteredStats.outflow)}</span>
        </div>
        <div className="stats-summary-item">
          <span>Net Balance:</span>
          <span className={`stats-summary-val ${filteredStats.net >= 0 ? "text-earn" : "text-spend"}`}>
            {formatCurrency(filteredStats.net)}
          </span>
        </div>
      </div>

      {/* Main Table & Mobile List Display */}
      {filteredTransactions.length === 0 ? (
        <div className="empty-state" style={{ backgroundColor: "var(--bg-card)" }}>
          <span style={{ fontSize: "2.5rem" }}>🔍</span>
          <h3>No transactions found</h3>
          <p>Try adjusting your search query or filters to inspect other entries.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="table-wrapper">
            <table className="fpa-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Title / Payee</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id}>
                    {/* Date column */}
                    <td style={{ fontWeight: 500, fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                      {formatDate(tx.date)}
                    </td>
                    
                    {/* Title / payee column */}
                    <td>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: 600 }}>{tx.title}</span>
                        {tx.description && (
                          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "2px" }}>
                            {tx.description}
                          </span>
                        )}
                      </div>
                    </td>
                    
                    {/* Category Column */}
                    <td>
                      <span 
                        className="badge" 
                        style={{ 
                          backgroundColor: `${CATEGORY_COLORS[tx.category] || "#64748b"}15`, 
                          color: CATEGORY_COLORS[tx.category] || "#64748b",
                          borderColor: `${CATEGORY_COLORS[tx.category] || "#64748b"}30` 
                        }}
                      >
                        {tx.category || "Other"}
                      </span>
                    </td>
                    
                    {/* Type Column */}
                    <td>
                      <span className={`badge ${tx.type === "earn" ? "badge-earn" : "badge-spend"}`}>
                        {tx.type === "earn" ? "Earn" : "Spend"}
                      </span>
                    </td>
                    
                    {/* Amount Column */}
                    <td style={{ fontWeight: 700, fontFamily: "monospace", fontSize: "1rem" }} className={tx.type === "earn" ? "text-earn" : "text-spend"}>
                      {tx.type === "earn" ? "+" : "-"} {formatCurrency(tx.amount)}
                    </td>
                    
                    {/* Actions Column */}
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                        <button
                          className="edit-action-btn"
                          onClick={() => handleStartEdit(tx)}
                        >
                          <svg 
                            width="14" 
                            height="14" 
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor" 
                            strokeWidth="2.5"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                          Edit
                        </button>
                        <button
                          className="delete-action-btn"
                          onClick={() => handleDeleteTx(tx.id, tx.title)}
                        >
                          <svg 
                            width="14" 
                            height="14" 
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor" 
                            strokeWidth="2"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Line-by-Line Cards View */}
          <div className="mobile-transactions-list">
            {filteredTransactions.map((tx) => (
              <div key={tx.id} className="mobile-transaction-card">
                <div className="mobile-tx-header">
                  <div className="mobile-tx-title-section">
                    <span className="mobile-tx-title">{tx.title}</span>
                    {tx.description && (
                      <span className="mobile-tx-desc">{tx.description}</span>
                    )}
                  </div>
                  <span className={`mobile-tx-amount ${tx.type === "earn" ? "text-earn" : "text-spend"}`} style={{ fontFamily: "monospace" }}>
                    {tx.type === "earn" ? "+" : "-"} {formatCurrency(tx.amount)}
                  </span>
                </div>

                <div className="mobile-tx-body">
                  <div className="mobile-tx-meta">
                    <span 
                      className="badge" 
                      style={{ 
                        backgroundColor: `${CATEGORY_COLORS[tx.category] || "#64748b"}15`, 
                        color: CATEGORY_COLORS[tx.category] || "#64748b",
                        borderColor: `${CATEGORY_COLORS[tx.category] || "#64748b"}30` 
                      }}
                    >
                      {tx.category || "Other"}
                    </span>
                    <span className={`badge ${tx.type === "earn" ? "badge-earn" : "badge-spend"}`}>
                      {tx.type === "earn" ? "Earn" : "Spend"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span className="mobile-tx-date">{formatDate(tx.date)}</span>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        className="edit-action-btn"
                        style={{ padding: "6px", fontSize: "0.75rem", gap: "4px" }}
                        onClick={() => handleStartEdit(tx)}
                        title="Edit Transaction"
                      >
                        <svg 
                          width="14" 
                          height="14" 
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor" 
                          strokeWidth="2.5"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        className="delete-action-btn"
                        style={{ padding: "6px", fontSize: "0.75rem", gap: "4px" }}
                        onClick={() => handleDeleteTx(tx.id, tx.title)}
                        title="Delete Transaction"
                      >
                        <svg 
                          width="14" 
                          height="14" 
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor" 
                          strokeWidth="2"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Edit Drawer Modal */}
      {editingTx && (
        <div className="modal-overlay" onClick={() => setEditingTx(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="section-title" style={{ margin: 0 }}>Edit Transaction</h2>
              <button 
                type="button" 
                className="modal-close-btn" 
                onClick={() => setEditingTx(null)}
                aria-label="Close Edit Drawer"
                style={{ cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {editError && (
              <div className="error-message" style={{ margin: 0, padding: "10px", backgroundColor: "var(--color-spend-bg)", color: "var(--color-spend)", borderRadius: "var(--radius-sm)", fontSize: "0.85rem" }}>
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              
              {/* Type Switcher */}
              <div className="form-group">
                <label className="form-label">Transaction Type</label>
                <div className="toggle-group" style={{ height: "40px" }}>
                  <button
                    type="button"
                    className={`toggle-btn ${editType === "spend" ? "active spend" : ""}`}
                    onClick={() => setEditType("spend")}
                    style={{ fontSize: "0.85rem", padding: "8px", flex: 1 }}
                  >
                    💸 Spend
                  </button>
                  <button
                    type="button"
                    className={`toggle-btn ${editType === "earn" ? "active earn" : ""}`}
                    onClick={() => setEditType("earn")}
                    style={{ fontSize: "0.85rem", padding: "8px", flex: 1 }}
                  >
                    📈 Earn
                  </button>
                </div>
              </div>

              {/* Title / Payee */}
              <div className="form-group">
                <label className="form-label" htmlFor="edit-title">Title / Payee</label>
                <input
                  id="edit-title"
                  type="text"
                  className="form-input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                />
              </div>

              {/* Amount & Date row */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-amount">Amount (RM)</label>
                  <input
                    id="edit-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="form-input"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-date">Date</label>
                  <input
                    id="edit-date"
                    type="date"
                    className="form-input"
                    value={editDate}
                    max={maxDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Category */}
              <div className="form-group">
                <label className="form-label" htmlFor="edit-category">Category</label>
                <CustomSelect
                  id="edit-category"
                  value={editCategory}
                  onChange={(val) => setEditCategory(val)}
                  options={(editType === "spend" ? SPEND_CATEGORIES : EARN_CATEGORIES).map(cat => ({ value: cat, label: cat }))}
                />
              </div>

              {/* Description */}
              <div className="form-group">
                <label className="form-label" htmlFor="edit-desc">Description (Optional)</label>
                <textarea
                  id="edit-desc"
                  className="form-input"
                  style={{ minHeight: "80px", resize: "vertical" }}
                  placeholder="Notes about the transaction..."
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>

              {/* Form Actions */}
              <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setEditingTx(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  Save Changes
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </>
  );
}
