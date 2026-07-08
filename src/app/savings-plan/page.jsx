"use client";

import { useState, useEffect, useMemo } from "react";
import {
  getMonthlySalary,
  getFixedSpends,
  getTransactions,
  getSettings,
  saveSetting,
} from "@/lib/storage";
import CustomSelect from "@/components/CustomSelect";

const CATEGORY_COLORS = {
  Food: "#f59e0b", // Amber
  Transportation: "#8b5cf6", // Violet
  Entertainment: "#ec4899", // Pink
  Utilities: "#0ea5e9", // Sky
  Health: "#ef4444", // Red
  Other: "#64748b", // Slate
};

export default function SavingsPlan() {
  const [mounted, setMounted] = useState(false);
  const [grossSalary, setGrossSalary] = useState(4200.0);
  const [fixedSpends, setFixedSpends] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState("");

  // Plan State
  const [isEditing, setIsEditing] = useState(false);
  const [savingsTarget, setSavingsTarget] = useState(20); // 20% of salary
  const [allocations, setAllocations] = useState({
    Food: 35,
    Transportation: 20,
    Entertainment: 15,
    Utilities: 10,
    Health: 10,
    Other: 10,
  });

  useEffect(() => {
    setMounted(true);
    const loadData = async () => {
      try {
        const salary = await getMonthlySalary();
        const fixed = await getFixedSpends();
        const txs = await getTransactions();
        const settings = await getSettings();

        setGrossSalary(salary);
        setFixedSpends(fixed);
        setTransactions(txs);

        if (settings.savings_target !== undefined) {
          setSavingsTarget(parseInt(settings.savings_target));
        }
        if (settings.category_allocations) {
          setAllocations(settings.category_allocations);
        }
      } catch (err) {
        console.error("Failed to load savings plan data", err);
      }
    };
    loadData();
  }, []);

  // Set default selected month to the latest available month in transactions
  useEffect(() => {
    if (transactions.length > 0 && !selectedMonth) {
      const sortedDates = [...transactions]
        .map((t) => t.date)
        .sort((a, b) => b.localeCompare(a));

      if (sortedDates.length > 0) {
        const latestMonth = sortedDates[0].substring(0, 7); // YYYY-MM
        setSelectedMonth(latestMonth);
      }
    }
  }, [transactions, selectedMonth]);

  // Extract unique months for filter
  const uniqueMonths = useMemo(() => {
    const months = new Set();
    transactions.forEach((t) => {
      if (t.date && t.date.length >= 7) {
        months.add(t.date.substring(0, 7));
      }
    });

    if (months.size === 0) {
      const today = new Date();
      months.add(
        `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`,
      );
    }

    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  // Calculate actual spends by category for selected month
  const actualSpends = useMemo(() => {
    const spends = {
      Food: 0,
      Transportation: 0,
      Entertainment: 0,
      Utilities: 0,
      Health: 0,
      Other: 0,
    };

    if (!selectedMonth) return spends;

    transactions.forEach((t) => {
      if (t.type === "spend" && t.date && t.date.startsWith(selectedMonth)) {
        const cat = t.category || "Other";
        // Check if category is standard, else map to Other
        if (spends[cat] !== undefined) {
          spends[cat] += t.amount;
        } else if (cat !== "Fixed Spend") {
          // Fixed spends are tracked separately
          spends.Other += t.amount;
        }
      }
    });

    return spends;
  }, [transactions, selectedMonth]);

  // Proportional weight slider balancing logic
  const handleAllocationChange = (catName, newVal) => {
    const val = Math.round(newVal);
    const delta = val - allocations[catName];
    const otherCats = Object.keys(allocations).filter((c) => c !== catName);
    const otherSum = otherCats.reduce((sum, c) => sum + allocations[c], 0);

    let updated = { ...allocations, [catName]: val };

    if (otherSum > 0) {
      otherCats.forEach((c) => {
        const proportion = allocations[c] / otherSum;
        const adjustment = delta * proportion;
        // Ensure values stay between 0 and 100
        updated[c] = Math.max(0, Math.round(allocations[c] - adjustment));
      });
    } else {
      const share = delta / otherCats.length;
      otherCats.forEach((c) => {
        updated[c] = Math.max(0, Math.round(allocations[c] - share));
      });
    }

    // Direct normalization step to ensure sum is exactly 100
    const currentSum = Object.values(updated).reduce((s, v) => s + v, 0);
    if (currentSum !== 100) {
      const diff = 100 - currentSum;
      // Add correction to the first active category that isn't the edited one
      const targetCat =
        otherCats.find((c) => updated[c] + diff >= 0) || otherCats[0];
      updated[targetCat] = Math.max(0, updated[targetCat] + diff);
    }

    setAllocations(updated);
  };

  // Financial Calculations
  const calculations = useMemo(() => {
    const epf = grossSalary * 0.11;
    const socso = Math.min(grossSalary * 0.005, 24.75);
    const manualFixed = fixedSpends.reduce((sum, item) => sum + item.amount, 0);
    const totalFixed = epf + socso + manualFixed;

    const savingsGoal = grossSalary * (savingsTarget / 100);

    // Discretionary income pool for flexible category budgets
    const discretionaryPool = Math.max(
      0,
      grossSalary - totalFixed - savingsGoal,
    );

    // Dynamic Category Budget Recommendations
    const categoryBudgets = {};
    Object.keys(allocations).forEach((cat) => {
      categoryBudgets[cat] = discretionaryPool * (allocations[cat] / 100);
    });

    return {
      epf,
      socso,
      manualFixed,
      totalFixed,
      savingsGoal,
      discretionaryPool,
      categoryBudgets,
    };
  }, [grossSalary, fixedSpends, savingsTarget, allocations]);

  // Helper format currency
  const formatCurrency = (val) => {
    return new Intl.NumberFormat("en-MY", {
      style: "currency",
      currency: "MYR",
    }).format(val);
  };

  // Translate YYYY-MM to Month Year
  const formatMonthLabel = (monthStr) => {
    if (!monthStr) return "";
    const [year, month] = monthStr.split("-");
    const date = new Date(year, parseInt(month) - 1, 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  // Calculate status of category budget
  const getBudgetStatus = (actual, budget) => {
    if (budget <= 0) {
      return actual > 0
        ? { label: "Over Budget", color: "var(--color-spend)", percent: 100 }
        : { label: "Zero Budget", color: "var(--text-muted)", percent: 0 };
    }

    const percent = (actual / budget) * 100;
    if (percent > 100) {
      return { label: "Over Budget", color: "var(--color-spend)", percent };
    } else if (percent >= 80) {
      return { label: "Warning", color: "#f59e0b", percent };
    }
    return { label: "Healthy", color: "var(--color-earn)", percent };
  };

  if (!mounted) {
    return (
      <div className="empty-state">
        <h2>Loading Plan Estimator...</h2>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Savings Plan Estimator</h1>
          <p className="page-subtitle">
            Personalize your budget targets and evaluate monthly spends
          </p>
        </div>

        {/* Month Selector Filter */}
        <div className="filter-container">
          <div style={{ minWidth: "200px" }}>
            <CustomSelect
              id="savings-month-filter"
              size="compact"
              value={selectedMonth}
              onChange={(val) => setSelectedMonth(val)}
              options={uniqueMonths.map((m) => ({ value: m, label: `📅 ${formatMonthLabel(m)}` }))}
            />
          </div>
        </div>
      </div>

      {/* Financial Summary KPIs Row */}
      <div className="kpi-grid">
        <div
          className="kpi-card income"
          style={{ borderLeft: "4px solid var(--color-earn)" }}
        >
          <span className="kpi-title">Gross Salary</span>
          <span className="kpi-value text-earn">
            {formatCurrency(grossSalary)}
          </span>
          <div className="kpi-meta">
            <span>Primary auto-added monthly income</span>
          </div>
        </div>

        <div
          className="kpi-card expense"
          style={{ borderLeft: "4px solid var(--color-spend)" }}
        >
          <span className="kpi-title">Total Monthly Fixed Spends</span>
          <span className="kpi-value text-spend">
            {formatCurrency(calculations.totalFixed)}
          </span>
          <div className="kpi-meta">
            <span>EPF, SOCSO + configured fixed costs</span>
          </div>
        </div>

        <div
          className="kpi-card savings"
          style={{ borderLeft: "4px solid var(--primary)" }}
        >
          <span className="kpi-title">Allocated Savings Goal</span>
          <span className="kpi-value" style={{ color: "var(--primary)" }}>
            {formatCurrency(calculations.savingsGoal)}
          </span>
          <div className="kpi-meta">
            <span className="kpi-meta-badge positive">
              {savingsTarget}% Target
            </span>
            <span>saved first monthly</span>
          </div>
        </div>

        <div
          className="kpi-card savings"
          style={{ borderLeft: "4px solid #14b8a6" }}
        >
          <span className="kpi-title">Flexible Discretionary Pool</span>
          <span className="kpi-value" style={{ color: "#14b8a6" }}>
            {formatCurrency(calculations.discretionaryPool)}
          </span>
          <div className="kpi-meta">
            <span>Leftover for flexible category spends</span>
          </div>
        </div>
      </div>

      {/* Main Budget Planner Layout */}
      <div className="savings-grid">
        {/* Left Column: Sliders Panel */}
        <div className="section-card" style={{ gap: "24px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h2 className="section-title" style={{ margin: 0 }}>
              Targets & Allocations
            </h2>
            <button
              type="button"
              onClick={async () => {
                if (isEditing) {
                  // Save state
                  await saveSetting("savings_target", savingsTarget.toString());
                  await saveSetting("category_allocations", allocations);
                }
                setIsEditing(!isEditing);
              }}
              className="btn btn-primary"
              style={{
                padding: "6px 16px",
                fontSize: "0.85rem",
                height: "34px",
                backgroundColor: isEditing
                  ? "var(--color-earn)"
                  : "var(--primary)",
                boxShadow: isEditing
                  ? "0 4px 12px rgba(16, 185, 129, 0.2)"
                  : "0 4px 12px rgba(99, 102, 241, 0.2)",
              }}
            >
              {isEditing ? "Save & Lock" : "Edit Plan"}
            </button>
          </div>

          {/* Master Savings Slider */}
          <div
            style={{
              padding: "16px",
              backgroundColor: "var(--bg-input)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-color)",
              opacity: isEditing ? 1 : 0.85,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
              }}
            >
              <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                Savings Target
              </span>
              <span
                style={{
                  fontWeight: 700,
                  color: isEditing ? "var(--primary)" : "var(--text-muted)",
                  fontSize: "1.1rem",
                }}
              >
                {savingsTarget}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              step="1"
              value={savingsTarget}
              onChange={(e) => setSavingsTarget(parseInt(e.target.value))}
              disabled={!isEditing}
              style={{
                width: "100%",
                height: "6px",
                accentColor: isEditing ? "var(--primary)" : "var(--text-muted)",
                cursor: isEditing ? "pointer" : "not-allowed",
              }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                marginTop: "4px",
              }}
            >
              <span>0% (No savings)</span>
              <span>50% (Max target)</span>
            </div>
          </div>

          {/* Proportional Category Weights */}
          <div
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid var(--border-color)",
                paddingBottom: "8px",
              }}
            >
              <span style={{ fontWeight: 600, fontSize: "1rem" }}>
                Category Allocation Weights
              </span>
              <span
                style={{
                  fontSize: "0.85rem",
                  color: "var(--color-earn)",
                  fontWeight: "600",
                  padding: "2px 8px",
                  backgroundColor: "var(--color-earn-bg)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                Total: 100%
              </span>
            </div>

            {Object.keys(allocations).map((catName) => (
              <div
                key={catName}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  opacity:
                    isEditing && calculations.discretionaryPool > 0 ? 1 : 0.8,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.85rem",
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontWeight: 500,
                    }}
                  >
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: CATEGORY_COLORS[catName],
                      }}
                    />
                    <span>{catName}</span>
                  </span>
                  <span style={{ fontWeight: 600 }}>
                    {allocations[catName]}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={allocations[catName]}
                  onChange={(e) =>
                    handleAllocationChange(catName, parseInt(e.target.value))
                  }
                  disabled={!isEditing || calculations.discretionaryPool <= 0}
                  style={{
                    width: "100%",
                    height: "5px",
                    accentColor: isEditing ? "#14b8a6" : "var(--text-muted)",
                    cursor:
                      isEditing && calculations.discretionaryPool > 0
                        ? "pointer"
                        : "not-allowed",
                  }}
                />
              </div>
            ))}

            {calculations.discretionaryPool <= 0 && (
              <p
                style={{
                  fontSize: "0.8rem",
                  color: "var(--color-spend)",
                  textAlign: "center",
                  fontStyle: "italic",
                  marginTop: "4px",
                }}
              >
                ⚠️ Discretionary pool is zero. Reduce Savings Target or Fixed
                Spends to enable category weights.
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Comparative Budgets display */}
        <div className="section-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h2 className="section-title">Plan Budget vs. Actual Spends</h2>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Comparing details for {formatMonthLabel(selectedMonth)}
            </span>
          </div>

          <div className="category-list">
            {Object.keys(allocations).map((catName) => {
              const budgetVal = calculations.categoryBudgets[catName] || 0;
              const actualVal = actualSpends[catName] || 0;
              const status = getBudgetStatus(actualVal, budgetVal);

              return (
                <div
                  key={catName}
                  className="category-card"
                  style={{ cursor: "default", display: "block" }}
                >
                  {/* Top line detail */}
                  <div
                    style={{
                      display: "flex",
                      justifyContents: "space-between",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "8px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <span
                        style={{
                          width: "12px",
                          height: "12px",
                          borderRadius: "50%",
                          backgroundColor: CATEGORY_COLORS[catName],
                          display: "inline-block",
                        }}
                      />
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                          {catName}
                        </span>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-muted)",
                          }}
                        >
                          Target weight: {allocations[catName]}%
                        </span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "0.75rem",
                        fontWeight: "700",
                        color: status.color,
                        backgroundColor: `${status.color}15`,
                        border: `1px solid ${status.color}30`,
                      }}
                    >
                      {status.label}
                    </span>
                  </div>

                  {/* Allocation and Actual comparisons */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "12px",
                      marginBottom: "8px",
                      fontSize: "0.85rem",
                    }}
                  >
                    <div>
                      <span
                        style={{
                          color: "var(--text-muted)",
                          display: "block",
                          fontSize: "0.75rem",
                          textTransform: "uppercase",
                        }}
                      >
                        Recommended Budget
                      </span>
                      <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                        {formatCurrency(budgetVal)}
                      </span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span
                        style={{
                          color: "var(--text-muted)",
                          display: "block",
                          fontSize: "0.75rem",
                          textTransform: "uppercase",
                        }}
                      >
                        Actual Spent
                      </span>
                      <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                        {formatCurrency(actualVal)}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar comparison */}
                  <div
                    className="category-progress-container"
                    style={{ height: "8px" }}
                  >
                    <div
                      className="category-progress-bar"
                      style={{
                        width: `${Math.min(100, status.percent)}%`,
                        backgroundColor: status.color,
                        backgroundImage: `linear-gradient(90deg, ${status.color} 0%, ${status.color}dd 100%)`,
                      }}
                    />
                  </div>

                  {budgetVal > 0 && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "0.75rem",
                        color: "var(--text-muted)",
                        marginTop: "4px",
                      }}
                    >
                      <span>Spent {status.percent.toFixed(1)}% of budget</span>
                      {budgetVal > actualVal ? (
                        <span style={{ color: "var(--color-earn)" }}>
                          Under limit by {formatCurrency(budgetVal - actualVal)}
                        </span>
                      ) : (
                        <span style={{ color: "var(--color-spend)" }}>
                          Exceeded limit by{" "}
                          {formatCurrency(actualVal - budgetVal)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
