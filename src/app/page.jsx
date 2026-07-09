"use client";

import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import {
  getTransactions,
  deleteTransaction,
  getFixedSpends,
  getMonthlySalary,
  saveMonthlySalary,
  getGoals,
} from "@/lib/storage";
import CustomSelect from "@/components/CustomSelect";

// Category configuration with modern icons and colors
const CATEGORY_CONFIGS = {
  Food: { icon: "🍔", color: "#f59e0b" }, // Amber
  Transportation: { icon: "🚗", color: "#8b5cf6" }, // Violet
  Entertainment: { icon: "🎬", color: "#ec4899" }, // Pink
  Utilities: { icon: "⚡", color: "#0ea5e9" }, // Sky
  Health: { icon: "❤️", color: "#ef4444" }, // Red
  Salary: { icon: "💼", color: "#10b981" }, // Emerald
  Investments: { icon: "📈", color: "#3b82f6" }, // Blue
  "Side Project": { icon: "🚀", color: "#14b8a6" }, // Teal
  "Fixed Spend": { icon: "🔒", color: "#6366f1" }, // Indigo
  Other: { icon: "🏷️", color: "#64748b" }, // Slate
};

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [fixedSpends, setFixedSpends] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedCategoryDetails, setSelectedCategoryDetails] = useState(null);

  // Salary State
  const [monthlySalary, setMonthlySalary] = useState(4200.0);
  const [isEditingSalary, setIsEditingSalary] = useState(false);
  const [tempSalary, setTempSalary] = useState("");
  const [goals, setGoals] = useState([]);

  // Super App States
  const [tasks, setTasks] = useState([]);
  const [notes, setNotes] = useState([]);

  // Set mounted status on client load
  useEffect(() => {
    setMounted(true);
    const loadData = async () => {
      try {
        const txs = await getTransactions();
        const fixed = await getFixedSpends();
        const salary = await getMonthlySalary();
        const dbGoals = await getGoals();
        setTransactions(txs);
        setFixedSpends(fixed);
        setMonthlySalary(salary);
        setGoals(dbGoals);

        // Load Super App components
        const savedTasks = localStorage.getItem("personal_super_app_tasks");
        if (savedTasks) {
          try {
            setTasks(JSON.parse(savedTasks));
          } catch (e) {}
        }
        const savedNotes = localStorage.getItem("personal_super_app_notes");
        if (savedNotes) {
          try {
            setNotes(JSON.parse(savedNotes));
          } catch (e) {}
        }
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      }
    };
    loadData();
  }, []);

  const handleToggleTaskDashboard = (id) => {
    const updated = tasks.map((task) =>
      task.id === id ? { ...task, completed: !task.completed } : task,
    );
    setTasks(updated);
    localStorage.setItem("personal_super_app_tasks", JSON.stringify(updated));

    // Sync with Service Worker for background reminders
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      navigator.serviceWorker.controller
    ) {
      const uncompleted = updated.filter((t) => !t.completed);
      navigator.serviceWorker.controller.postMessage({
        type: "SET_TASKS",
        tasks: uncompleted,
      });
    }
  };

  const handleSaveSalary = async () => {
    const parsed = parseFloat(tempSalary);
    if (!isNaN(parsed) && parsed >= 0) {
      await saveMonthlySalary(parsed);
      setMonthlySalary(parsed);
      setIsEditingSalary(false);
    }
  };

  // Set default selected month to the latest available month in transactions
  useEffect(() => {
    if (transactions.length > 0 && !selectedMonth) {
      // Find the most recent transaction date
      const sortedDates = [...transactions]
        .map((t) => t.date)
        .sort((a, b) => b.localeCompare(a));

      if (sortedDates.length > 0) {
        const latestMonth = sortedDates[0].substring(0, 7); // YYYY-MM
        setSelectedMonth(latestMonth);
      }
    }
  }, [transactions, selectedMonth]);

  // Calculate Cumulative Actual Balance (Net Worth)
  const totalBalance = useMemo(() => {
    let balance = 0;
    transactions.forEach((t) => {
      if (t.type === "earn") {
        balance += t.amount;
      } else if (t.type === "spend") {
        balance -= t.amount;
      }
    });
    return balance;
  }, [transactions]);

  // Next Upcoming Goal
  const nextGoal = useMemo(() => {
    return (
      goals
        .filter((g) => !g.completed)
        .sort((a, b) => a.target_date.localeCompare(b.target_date))[0] || null
    );
  }, [goals]);

  // Extract all unique months from transactions for the filter dropdown
  const uniqueMonths = useMemo(() => {
    const months = new Set();
    transactions.forEach((t) => {
      if (t.date && t.date.length >= 7) {
        months.add(t.date.substring(0, 7));
      }
    });

    // If empty, add current month
    if (months.size === 0) {
      const today = new Date();
      months.add(
        `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`,
      );
    }

    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  // Filter transactions for the selected month
  const filteredTransactions = useMemo(() => {
    if (!selectedMonth) return [];
    return transactions.filter(
      (t) => t.date && t.date.startsWith(selectedMonth),
    );
  }, [transactions, selectedMonth]);

  // Calculate dynamic EPF and SOCSO
  const epfAmount = useMemo(() => monthlySalary * 0.11, [monthlySalary]);
  const socsoAmount = useMemo(
    () => Math.min(monthlySalary * 0.005, 24.75),
    [monthlySalary],
  );

  const dynamicFixedTotal = useMemo(() => {
    const staticFixed = fixedSpends.reduce((sum, item) => sum + item.amount, 0);
    return staticFixed + epfAmount + socsoAmount;
  }, [fixedSpends, epfAmount, socsoAmount]);

  // Calculations for KPI Cards
  const kpis = useMemo(() => {
    let income = 0;
    let expenses = 0;

    // Sum non-salary transactions to avoid duplication
    filteredTransactions.forEach((t) => {
      if (t.type === "earn") {
        if (t.category !== "Salary") {
          income += t.amount;
        }
      } else if (t.type === "spend") {
        expenses += t.amount;
      }
    });

    // Auto-inject Gross Salary
    income += monthlySalary;

    // Auto-deduct dynamic fixed spends
    expenses += dynamicFixedTotal;

    const savings = income - expenses;
    const savingsRate = income > 0 ? (savings / income) * 100 : 0;

    return {
      income,
      expenses,
      savings,
      savingsRate,
    };
  }, [filteredTransactions, monthlySalary, dynamicFixedTotal]);

  // Calculate expense categories breakdown
  const categoryBreakdown = useMemo(() => {
    const categories = {};
    let totalSpend = 0;

    filteredTransactions.forEach((t) => {
      if (t.type === "spend") {
        const cat = t.category || "Other";
        categories[cat] = (categories[cat] || 0) + t.amount;
        totalSpend += t.amount;
      }
    });

    // Append dynamic fixed spends
    if (dynamicFixedTotal > 0) {
      categories["Fixed Spend"] = dynamicFixedTotal;
      totalSpend += dynamicFixedTotal;
    }

    const breakdownList = Object.keys(categories).map((catName) => {
      const amount = categories[catName];
      const percentage = totalSpend > 0 ? (amount / totalSpend) * 100 : 0;
      return {
        name: catName,
        amount,
        percentage,
        config: CATEGORY_CONFIGS[catName] || CATEGORY_CONFIGS.Other,
      };
    });

    // Sort by amount descending
    return {
      list: breakdownList.sort((a, b) => b.amount - a.amount),
      totalSpend,
    };
  }, [filteredTransactions, dynamicFixedTotal]);

  // SVG Chart Ring Segment Calculations
  const chartSegments = useMemo(() => {
    let currentPercentageAccum = 0;
    const circumference = 282.7; // 2 * PI * r (r=45)

    return categoryBreakdown.list.map((cat) => {
      const percentage = cat.percentage;
      const strokeDashoffset =
        circumference - (percentage / 100) * circumference;
      const strokeDasharray = `${circumference} ${circumference}`;

      // Calculate rotation to stack segments correctly
      const rotation = (currentPercentageAccum / 100) * 360 - 90;
      currentPercentageAccum += percentage;

      return {
        ...cat,
        strokeDashoffset,
        strokeDasharray,
        rotation,
      };
    });
  }, [categoryBreakdown]);

  // Handle transaction deletion
  const handleDeleteTx = (id) => {
    if (confirm("Are you sure you want to delete this transaction?")) {
      const updated = deleteTransaction(id);
      setTransactions(updated);

      // Update selected category details if modal is open
      if (selectedCategoryDetails) {
        const categoryName = selectedCategoryDetails.name;
        // Filter updated transactions to check if any still exist in this category/month
        const remainingForCategory = updated.filter(
          (t) =>
            t.date.startsWith(selectedMonth) && t.category === categoryName,
        );

        if (remainingForCategory.length === 0) {
          setSelectedCategoryDetails(null);
        } else {
          setSelectedCategoryDetails({
            name: categoryName,
            transactions: remainingForCategory,
          });
        }
      }
    }
  };

  // Open transaction list details for a clicked category
  const handleCategoryClick = (categoryName) => {
    if (categoryName === "Fixed Spend") {
      const autoDeductions = [
        {
          id: "fix-epf-auto",
          title: "EPF Contribution (Auto)",
          amount: epfAmount,
          type: "spend",
          category: "Fixed Spend",
          date: `${selectedMonth}-01`,
          description:
            "Employees Provident Fund monthly contribution (11% of salary)",
          isFixed: true,
          isAuto: true,
        },
        {
          id: "fix-socso-auto",
          title: "SOCSO Contribution (Auto)",
          amount: socsoAmount,
          type: "spend",
          category: "Fixed Spend",
          date: `${selectedMonth}-01`,
          description:
            "Social Security Organization monthly contribution (0.5% of salary, capped at $24.75)",
          isFixed: true,
          isAuto: true,
        },
      ];

      const manualList = fixedSpends.map((item) => ({
        id: item.id,
        title: item.title,
        amount: item.amount,
        type: "spend",
        category: "Fixed Spend",
        date: `${selectedMonth}-01`,
        description: item.description,
        isFixed: true,
      }));

      setSelectedCategoryDetails({
        name: categoryName,
        transactions: [...autoDeductions, ...manualList],
      });
    } else {
      const list = filteredTransactions.filter(
        (t) => t.category === categoryName,
      );
      setSelectedCategoryDetails({
        name: categoryName,
        transactions: list,
      });
    }
  };

  // Helper to format currency
  const formatCurrency = (val) => {
    return new Intl.NumberFormat("en-MY", {
      style: "currency",
      currency: "MYR",
    }).format(val);
  };

  // Helper to translate YYYY-MM to readable Month Year
  const formatMonthLabel = (monthStr) => {
    if (!monthStr) return "";
    const [year, month] = monthStr.split("-");
    const date = new Date(year, parseInt(month) - 1, 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  // Pre-render skeleton or mount check
  if (!mounted) {
    return (
      <div className="empty-state">
        <h2>Loading my super app...</h2>
      </div>
    );
  }

  return (
    <>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Financial Dashboard</h1>
          <p className="page-subtitle">
            Track, filter, and plan your expense categories
          </p>
        </div>

        {/* Month Selector Filter & Salary config */}
        <div className="filter-container" style={{ gap: "20px" }}>
          {/* Gross Salary Config */}
          <div className="select-wrapper" style={{ padding: "8px 16px" }}>
            <span style={{ opacity: 0.8, marginRight: "4px" }}>
              Monthly Salary:
            </span>
            {isEditingSalary ? (
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <input
                  type="number"
                  value={tempSalary}
                  onChange={(e) => setTempSalary(e.target.value)}
                  className="form-input"
                  style={{
                    width: "90px",
                    padding: "4px 8px",
                    fontSize: "0.9rem",
                    height: "30px",
                    backgroundColor: "var(--bg-input)",
                  }}
                  min="0"
                  step="1"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSaveSalary}
                  className="btn btn-primary"
                  style={{
                    padding: "4px 10px",
                    height: "30px",
                    fontSize: "0.8rem",
                    minWidth: "30px",
                  }}
                >
                  ✓
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingSalary(false)}
                  className="btn btn-secondary"
                  style={{
                    padding: "4px 10px",
                    height: "30px",
                    fontSize: "0.8rem",
                    minWidth: "30px",
                  }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <span style={{ fontWeight: 700 }}>
                  {formatCurrency(monthlySalary)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setTempSalary(monthlySalary.toString());
                    setIsEditingSalary(true);
                  }}
                  className="delete-action-btn"
                  style={{
                    padding: "2px 6px",
                    color: "var(--primary)",
                    border: "1px solid rgba(99, 102, 241, 0.2)",
                    fontSize: "0.75rem",
                  }}
                >
                  Edit
                </button>
              </div>
            )}
          </div>

          <div style={{ minWidth: "180px" }}>
            <CustomSelect
              id="month-filter"
              size="compact"
              value={selectedMonth}
              onChange={(val) => setSelectedMonth(val)}
              options={uniqueMonths.map((m) => ({
                value: m,
                label: formatMonthLabel(m),
              }))}
            />
          </div>
        </div>
      </div>

      {/* Wealth & Goals Summary Panel */}
      <div
        className="kpi-grid"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "20px",
          marginBottom: "-12px",
        }}
      >
        <div
          className="kpi-card"
          style={{
            borderLeftColor: "var(--primary)",
            background:
              "linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(0, 0, 0, 0) 100%)",
          }}
        >
          <span className="kpi-title">Total Balance (Net Worth)</span>
          <span className="kpi-value" style={{ color: "#ffffff" }}>
            {formatCurrency(totalBalance)}
          </span>
          <div className="kpi-meta">
            <span>Cumulative savings across all history</span>
          </div>
        </div>

        <div
          className="kpi-card"
          style={{
            borderLeftColor: "#f59e0b",
            background:
              "linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(0, 0, 0, 0) 100%)",
          }}
        >
          <span className="kpi-title">Active Planner Goals</span>
          <span className="kpi-value" style={{ color: "#f59e0b" }}>
            {goals.filter((g) => !g.completed).length} Goals
          </span>
          <div className="kpi-meta">
            <span>
              {goals.filter((g) => g.completed).length} completed milestones
            </span>
          </div>
        </div>

        <div
          className="kpi-card"
          style={{
            borderLeftColor: "#ec4899",
            background:
              "linear-gradient(135deg, rgba(236, 72, 153, 0.05) 0%, rgba(0, 0, 0, 0) 100%)",
          }}
        >
          <span className="kpi-title">Next Milestone Goal</span>
          {nextGoal ? (
            <>
              <span
                className="kpi-value"
                style={{
                  fontSize: "1.35rem",
                  marginTop: "4px",
                  color: "#ec4899",
                }}
              >
                {nextGoal.title}
              </span>
              <div className="kpi-meta">
                <span>
                  {formatCurrency(nextGoal.amount)} due {nextGoal.target_date}
                </span>
              </div>
            </>
          ) : (
            <>
              <span
                className="kpi-value"
                style={{ color: "var(--text-muted)", fontSize: "1.35rem" }}
              >
                No active goals
              </span>
              <div className="kpi-meta">
                <Link
                  href="/yearly-planner"
                  style={{
                    color: "var(--primary)",
                    textDecoration: "underline",
                  }}
                >
                  Configure Planner
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        <div className="kpi-card income">
          <span className="kpi-title">Total Earned</span>
          <span className="kpi-value text-earn">
            {formatCurrency(kpis.income)}
          </span>
          <div className="kpi-meta">
            <span className="kpi-meta-badge positive">INFLOW</span>
            <span>for {formatMonthLabel(selectedMonth)}</span>
          </div>
        </div>

        <div className="kpi-card expense">
          <span className="kpi-title">Total Spent</span>
          <span className="kpi-value text-spend">
            {formatCurrency(kpis.expenses)}
          </span>
          <div className="kpi-meta">
            <span className="kpi-meta-badge negative">OUTFLOW</span>
            <span>for {formatMonthLabel(selectedMonth)}</span>
          </div>
        </div>

        <div className="kpi-card savings">
          <span className="kpi-title">Net Savings</span>
          <span
            className={`kpi-value ${kpis.savings >= 0 ? "text-earn" : "text-spend"}`}
          >
            {formatCurrency(kpis.savings)}
          </span>
          <div className="kpi-meta">
            <span
              className={`kpi-meta-badge ${kpis.savings >= 0 ? "positive" : "negative"}`}
            >
              {kpis.savingsRate.toFixed(1)}% Rate
            </span>
            <span>saved this month</span>
          </div>
        </div>
      </div>

      {/* Main Charts & Categories Breakdown */}
      <div className="dashboard-grid">
        {/* Category Expenses Breakdown */}
        <div className="section-card">
          <h2 className="section-title">Expense Distribution by Category</h2>

          {categoryBreakdown.list.length === 0 ? (
            <div className="empty-state">
              <span style={{ fontSize: "2rem" }}>📊</span>
              <h3>No expenses found for this month</h3>
              <p>
                Add spends in the "Add Transaction" page to populate the
                breakdown.
              </p>
            </div>
          ) : (
            <div className="category-list">
              {categoryBreakdown.list.map((cat) => (
                <div
                  key={cat.name}
                  className="category-card"
                  onClick={() => handleCategoryClick(cat.name)}
                >
                  <div className="category-info-wrapper">
                    <span className="category-icon-box">{cat.config.icon}</span>
                    <div className="category-text">
                      <div className="category-name">{cat.name}</div>
                      <div className="category-progress-container">
                        <div
                          className="category-progress-bar"
                          style={{
                            width: `${cat.percentage}%`,
                            backgroundColor: cat.config.color,
                            backgroundImage: `linear-gradient(90deg, ${cat.config.color} 0%, ${cat.config.color}dd 100%)`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="category-amount-wrapper">
                    <span className="category-amount">
                      {formatCurrency(cat.amount)}
                    </span>
                    <span className="category-percent">
                      {cat.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Graphical Summary Panel */}
        <div
          className="section-card"
          style={{ alignItems: "center", justifyContent: "center" }}
        >
          <h2
            className="section-title"
            style={{ width: "100%", textAlign: "left" }}
          >
            Visualization
          </h2>

          {categoryBreakdown.list.length === 0 ? (
            <div
              className="empty-state"
              style={{ width: "100%", border: "none" }}
            >
              <span style={{ fontSize: "2.5rem", opacity: 0.5 }}>📉</span>
              <p>No expense data visual is available</p>
            </div>
          ) : (
            <>
              {/* Interactive Donut Chart */}
              <div className="chart-container">
                <svg
                  width="220"
                  height="220"
                  viewBox="0 0 120 120"
                  className="chart-ring"
                >
                  {/* Background Ring */}
                  <circle
                    cx="60"
                    cy="60"
                    r="45"
                    fill="transparent"
                    stroke="var(--border-color)"
                    strokeWidth="8"
                  />
                  {/* Dynamic Segments */}
                  {chartSegments.map((segment) => (
                    <circle
                      key={segment.name}
                      className="chart-segment"
                      cx="60"
                      cy="60"
                      r="45"
                      stroke={segment.config.color}
                      strokeWidth="8"
                      style={{
                        strokeDasharray: segment.strokeDasharray,
                        strokeDashoffset: segment.strokeDashoffset,
                        transform: `rotate(${segment.rotation}deg)`,
                        transformOrigin: "60px 60px",
                      }}
                      onClick={() => handleCategoryClick(segment.name)}
                    />
                  ))}
                </svg>

                {/* Center Stats */}
                <div className="chart-center-text">
                  <span className="chart-center-value">
                    {formatCurrency(categoryBreakdown.totalSpend)}
                  </span>
                  <span className="chart-center-label">Total Outflow</span>
                </div>
              </div>

              {/* Dynamic Legend */}
              <div className="legend-container">
                {categoryBreakdown.list.map((cat) => (
                  <div key={cat.name} className="legend-item">
                    <div className="legend-label-group">
                      <span
                        className="legend-dot"
                        style={{ backgroundColor: cat.config.color }}
                      />
                      <span>{cat.name}</span>
                    </div>
                    <span style={{ fontWeight: 600 }}>
                      {cat.percentage.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Super App Quick Widgets */}
      <div className="dashboard-grid" style={{ marginTop: "24px" }}>
        {/* Quick Tasks Widget */}
        <div className="section-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <h2 className="section-title" style={{ marginBottom: 0 }}>
              <i
                className="fa-solid fa-list-check"
                style={{ marginRight: "6px" }}
              ></i>{" "}
              Quick Tasks
            </h2>
            <Link
              href="/tasks"
              className="btn btn-secondary"
              style={{ padding: "4px 10px", fontSize: "0.8rem" }}
            >
              Manage
            </Link>
          </div>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "10px" }}
          >
            {tasks.filter((t) => !t.completed).slice(0, 3).length === 0 ? (
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: "0.9rem",
                  fontStyle: "italic",
                  textAlign: "center",
                  padding: "16px 0",
                }}
              >
                No active tasks. Good job!
              </p>
            ) : (
              tasks
                .filter((t) => !t.completed)
                .slice(0, 3)
                .map((task) => (
                  <div
                    key={task.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "10px 12px",
                      borderRadius: "var(--radius-sm)",
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid var(--border-color)",
                    }}
                  >
                    <div
                      onClick={() => handleToggleTaskDashboard(task.id)}
                      style={{
                        width: "18px",
                        height: "18px",
                        borderRadius: "5px",
                        border: "2px solid var(--text-muted)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        flexShrink: 0,
                        transition: "all 0.2s ease",
                      }}
                    >
                      {task.completed && (
                        <i
                          className="fa-solid fa-check"
                          style={{ fontSize: "9px", color: "white" }}
                        ></i>
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        flexGrow: 1,
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.9rem",
                          color: "var(--text-primary)",
                          fontWeight: "500",
                        }}
                      >
                        {task.title}
                      </span>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        <i
                          className="fa-solid fa-tag"
                          style={{ marginRight: "4px", fontSize: "0.7rem" }}
                        ></i>{" "}
                        {task.category} • {task.priority} Priority
                      </span>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Recent Notes Widget */}
        <div className="section-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <h2 className="section-title" style={{ marginBottom: 0 }}>
              <i
                className="fa-regular fa-clipboard"
                style={{ marginRight: "6px" }}
              ></i>{" "}
              Recent Notes
            </h2>
            <Link
              href="/notepad"
              className="btn btn-secondary"
              style={{ padding: "4px 10px", fontSize: "0.8rem" }}
            >
              Manage
            </Link>
          </div>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "10px" }}
          >
            {notes.slice(0, 3).length === 0 ? (
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: "0.9rem",
                  fontStyle: "italic",
                  textAlign: "center",
                  padding: "16px 0",
                }}
              >
                No notes created yet.
              </p>
            ) : (
              notes.slice(0, 3).map((note) => (
                <Link
                  href={`/notepad?id=${note.id}`}
                  key={note.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    padding: "10px 12px",
                    borderRadius: "var(--radius-sm)",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid var(--border-color)",
                    transition: "border-color 0.2s ease",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.borderColor = "var(--border-hover)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.borderColor = "var(--border-color)")
                  }
                >
                  <span
                    style={{
                      fontSize: "0.9rem",
                      color: "var(--text-primary)",
                      fontWeight: "600",
                    }}
                  >
                    {note.title || "Untitled Note"}
                  </span>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {note.content
                      ? note.content.substring(0, 50) + "..."
                      : "Empty note content"}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Category Detail Modal Side Drawer */}
      {selectedCategoryDetails && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedCategoryDetails(null)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="modal-sub-title">Category Breakdown</span>
                <h2
                  className="section-title"
                  style={{
                    marginTop: "4px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span>
                    {CATEGORY_CONFIGS[selectedCategoryDetails.name]?.icon ||
                      "🏷️"}
                  </span>
                  <span>{selectedCategoryDetails.name}</span>
                </h2>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setSelectedCategoryDetails(null)}
              >
                ✕
              </button>
            </div>

            <div className="detail-item-list">
              {selectedCategoryDetails.transactions.map((tx) => (
                <div key={tx.id} className="detail-item">
                  <div className="detail-item-header">
                    <span className="detail-item-title">{tx.title}</span>
                    <span
                      className={`detail-item-amount ${tx.type === "spend" ? "spend" : "earn"}`}
                    >
                      {tx.type === "spend" ? "-" : "+"}{" "}
                      {formatCurrency(tx.amount)}
                    </span>
                  </div>

                  {tx.description && (
                    <p className="detail-item-desc">{tx.description}</p>
                  )}

                  <div className="detail-item-footer">
                    <span className="detail-item-date">
                      {tx.isAuto
                        ? "Auto-Calculated Deduction"
                        : tx.isFixed
                          ? "Monthly Auto-Deduction"
                          : (() => {
                              if (!tx.date) return "";
                              const parts = tx.date.split("T")[0].split("-");
                              if (parts.length !== 3) return tx.date;
                              const date = new Date(
                                parseInt(parts[0]),
                                parseInt(parts[1]) - 1,
                                parseInt(parts[2]),
                              );
                              return date.toLocaleDateString("en-US", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              });
                            })()}
                    </span>
                    {tx.isAuto ? (
                      <span
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--text-muted)",
                          fontStyle: "italic",
                        }}
                      >
                        Read-only
                      </span>
                    ) : tx.isFixed ? (
                      <Link
                        href="/fixed"
                        className="delete-action-btn"
                        style={{ color: "var(--primary)" }}
                        onClick={() => setSelectedCategoryDetails(null)}
                      >
                        Manage
                      </Link>
                    ) : (
                      <button
                        className="delete-action-btn"
                        onClick={() => handleDeleteTx(tx.id)}
                      >
                        <svg
                          width="14"
                          height="14"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
