"use client";

import { useState, useEffect, useMemo } from "react";
import { getMonthlySalary, getFixedSpends, getTransactions, getSettings, getGoals, saveGoal, deleteGoal } from "@/lib/storage";
import CustomSelect from "@/components/CustomSelect";

const GOAL_CATEGORIES = {
  house: { label: "House 🏠", color: "#f59e0b", icon: "🏠" },
  car: { label: "Car 🚗", color: "#8b5cf6", icon: "🚗" },
  travel: { label: "Travel ✈️", color: "#ec4899", icon: "✈️" },
  product: { label: "Product 💻", color: "#0ea5e9", icon: "💻" }
};

export default function YearlyPlanner() {
  const [mounted, setMounted] = useState(false);
  
  // Data States
  const [transactions, setTransactions] = useState([]);
  const [fixedSpends, setFixedSpends] = useState([]);
  const [monthlySalary, setMonthlySalary] = useState(4200);
  const [savingsTarget, setSavingsTarget] = useState(20); // %
  const [goals, setGoals] = useState([]);
  
  // UI States
  const [editingGoal, setEditingGoal] = useState(null);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  const [goalDate, setGoalDate] = useState(""); // YYYY-MM
  const [goalCategory, setGoalCategory] = useState("product");
  const [goalCompleted, setGoalCompleted] = useState(false);
  const [error, setError] = useState("");
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    setMounted(true);
    const loadData = async () => {
      try {
        const txs = await getTransactions();
        const fixed = await getFixedSpends();
        const salary = await getMonthlySalary();
        const settings = await getSettings();
        const dbGoals = await getGoals();

        setTransactions(txs);
        setFixedSpends(fixed);
        setMonthlySalary(salary);
        setGoals(dbGoals);

        if (settings.savings_target !== undefined) {
          setSavingsTarget(parseInt(settings.savings_target));
        }
      } catch (err) {
        console.error("Failed to load planner data", err);
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

  // Calculate Cumulative Actual Balance
  const totalBalance = useMemo(() => {
    let balance = 0;
    transactions.forEach(t => {
      if (t.type === "earn") {
        balance += t.amount;
      } else if (t.type === "spend") {
        balance -= t.amount;
      }
    });
    return balance;
  }, [transactions]);

  // Calculate Planned Monthly Savings
  const plannedMonthlySavings = useMemo(() => {
    const epf = monthlySalary * 0.11;
    const socso = Math.min(monthlySalary * 0.005, 24.75);
    const totalFixed = fixedSpends.reduce((acc, f) => acc + f.amount, 0) + epf + socso;
    const netSalary = monthlySalary - totalFixed;
    return Math.max(0, netSalary * (savingsTarget / 100));
  }, [monthlySalary, fixedSpends, savingsTarget]);

  // Generate 24-Month Balance Projection Timeline
  const projectionTimeline = useMemo(() => {
    const timeline = [];
    const today = new Date();
    
    // Sort uncompleted goals chronologically
    const activeGoals = goals
      .filter(g => !g.completed)
      .sort((a, b) => a.target_date.localeCompare(b.target_date));

    let projectedBalance = totalBalance;

    for (let i = 0; i <= 24; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      
      if (i > 0) {
        projectedBalance += plannedMonthlySavings;
      }

      // Check which goals are scheduled for this target month
      const goalsDue = activeGoals.filter(g => g.target_date === yearMonth);
      
      // Check which goals can be afforded based on cumulative balance
      const goalsAffordable = activeGoals.filter(g => g.target_date <= yearMonth && g.amount <= projectedBalance);

      timeline.push({
        yearMonth,
        label: date.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        projectedBalance,
        goalsDue,
        goalsAffordable,
        isCurrent: i === 0
      });
    }

    return timeline;
  }, [totalBalance, plannedMonthlySavings, goals]);

  // Next Upcoming Goal
  const nextGoal = useMemo(() => {
    return goals
      .filter(g => !g.completed)
      .sort((a, b) => a.target_date.localeCompare(b.target_date))[0] || null;
  }, [goals]);

  // Open Drawer Form for Add
  const handleStartAdd = () => {
    setEditingGoal(null);
    setGoalTitle("");
    setGoalAmount("");
    
    const today = new Date();
    const formatted = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    setGoalDate(formatted);
    setGoalCategory("product");
    setGoalCompleted(false);
    setError("");
    
    // Trigger opening dummy ID to show modal
    setEditingGoal({ id: "" });
  };

  // Open Drawer Form for Edit
  const handleStartEdit = (goal) => {
    setEditingGoal(goal);
    setGoalTitle(goal.title);
    setGoalAmount(goal.amount.toString());
    setGoalDate(goal.target_date);
    setGoalCategory(goal.category);
    setGoalCompleted(goal.completed);
    setError("");
  };

  // Save Goal
  const handleSaveGoal = async (e) => {
    e.preventDefault();
    setError("");

    if (!goalTitle.trim()) {
      setError("Please enter a goal title.");
      return;
    }

    const numericAmount = parseFloat(goalAmount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError("Please enter a valid target amount.");
      return;
    }

    if (!goalDate) {
      setError("Please select a target date.");
      return;
    }

    const payload = {
      id: editingGoal.id || undefined,
      title: goalTitle.trim(),
      amount: numericAmount,
      target_date: goalDate,
      category: goalCategory,
      completed: goalCompleted
    };

    try {
      await saveGoal(payload);
      const dbGoals = await getGoals();
      setGoals(dbGoals);
      setEditingGoal(null);
      addToast(editingGoal.id ? "Updated goal successfully" : "Added goal successfully");
    } catch (err) {
      console.error(err);
      setError("Failed to save goal.");
    }
  };

  // Delete Goal
  const handleDeleteGoal = async (id, titleText) => {
    if (confirm(`Are you sure you want to delete the goal "${titleText}"?`)) {
      try {
        await deleteGoal(id);
        const dbGoals = await getGoals();
        setGoals(dbGoals);
        addToast(`Deleted goal: "${titleText}"`, "success");
      } catch (err) {
        console.error(err);
        addToast("Failed to delete goal", "error");
      }
    }
  };

  // Toggle Goal Complete In-place
  const handleToggleComplete = async (goal) => {
    const payload = {
      ...goal,
      completed: !goal.completed
    };
    try {
      await saveGoal(payload);
      const dbGoals = await getGoals();
      setGoals(dbGoals);
      addToast(payload.completed ? `Goal completed! 🎉` : `Goal reopened`);
    } catch (err) {
      console.error(err);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat("en-MY", {
      style: "currency",
      currency: "MYR"
    }).format(val);
  };

  if (!mounted) {
    return (
      <div className="empty-state">
        <h2>Loading Planner...</h2>
      </div>
    );
  }

  return (
    <>
      {/* Toast notifications */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span style={{ fontSize: "1.1rem" }}>
              {t.type === "success" ? "✓" : "⚡"}
            </span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      <div className="page-header">
        <div>
          <h1 className="page-title">Yearly Financial Planner</h1>
          <p className="page-subtitle">
            Plan your long-term milestones and simulate your balance projection over the next 2 years.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleStartAdd}>
          + Add New Goal
        </button>
      </div>

      {/* KPI Stats Panel */}
      <div className="kpi-grid">
        <div className="kpi-card" style={{ borderLeftColor: "var(--primary)" }}>
          <span className="kpi-title">Current Balance</span>
          <span className="kpi-value">{formatCurrency(totalBalance)}</span>
          <div className="kpi-meta">
            <span>Cumulative earnings minus spends</span>
          </div>
        </div>

        <div className="kpi-card" style={{ borderLeftColor: "#14b8a6" }}>
          <span className="kpi-title">Monthly Planned Savings</span>
          <span className="kpi-value">{formatCurrency(plannedMonthlySavings)}</span>
          <div className="kpi-meta">
            <span>Based on {savingsTarget}% of Net Income</span>
          </div>
        </div>

        <div className="kpi-card" style={{ borderLeftColor: "#f59e0b" }}>
          <span className="kpi-title">Upcoming Goal</span>
          {nextGoal ? (
            <>
              <span className="kpi-value" style={{ fontSize: "1.4rem", marginTop: "4px" }}>
                {nextGoal.title}
              </span>
              <div className="kpi-meta">
                <span>{formatCurrency(nextGoal.amount)} due {nextGoal.target_date}</span>
              </div>
            </>
          ) : (
            <>
              <span className="kpi-value" style={{ color: "var(--text-muted)", fontSize: "1.4rem" }}>No active goals</span>
              <div className="kpi-meta">
                <span>Add one to start planning!</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Projection Timeline Chart Roadmap */}
      <div className="section-card">
        <h2 className="section-title">24-Month Roadmap Projection</h2>
        <p className="page-subtitle" style={{ margin: "-12px 0 16px 0" }}>
          Simulated cumulative cash growth including target timelines. Green flags indicate affordable milestones.
        </p>

        <div style={{ display: "flex", gap: "16px", overflowX: "auto", paddingBottom: "16px", paddingTop: "14px", scrollbarWidth: "thin" }}>
          {projectionTimeline.map((month) => {
            const hasDueGoals = month.goalsDue.length > 0;
            const hasAffordableGoals = month.goalsAffordable.length > 0;
            
            return (
              <div 
                key={month.yearMonth}
                style={{
                  minWidth: "150px",
                  padding: "16px",
                  paddingTop: month.isCurrent ? "22px" : "16px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: month.isCurrent ? "rgba(99, 102, 241, 0.08)" : "var(--bg-card)",
                  border: month.isCurrent ? "2px solid var(--primary)" : "1px solid var(--border-color)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  gap: "10px",
                  position: "relative"
                }}
              >
                {month.isCurrent && (
                  <span style={{ position: "absolute", top: "-10px", backgroundColor: "var(--primary)", color: "white", fontSize: "0.65rem", padding: "2px 8px", borderRadius: "var(--radius-full)", fontWeight: 700 }}>
                    CURRENT
                  </span>
                )}
                
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                  {month.label}
                </span>

                <span style={{ fontSize: "1rem", fontWeight: 700, color: month.projectedBalance >= 0 ? "var(--color-earn)" : "var(--color-spend)" }}>
                  {formatCurrency(month.projectedBalance)}
                </span>

                {/* Goals Lists inside cell */}
                <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
                  {month.goalsDue.map(g => (
                    <div 
                      key={g.id} 
                      style={{
                        padding: "6px",
                        borderRadius: "var(--radius-sm)",
                        backgroundColor: month.goalsAffordable.some(a => a.id === g.id) 
                          ? "rgba(16, 185, 129, 0.15)" // affordable green
                          : "rgba(239, 68, 68, 0.1)", // not yet affordable red
                        border: `1px solid ${month.goalsAffordable.some(a => a.id === g.id) ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.2)"}`,
                        fontSize: "0.75rem",
                        textAlign: "left",
                        color: month.goalsAffordable.some(a => a.id === g.id) ? "#10b981" : "#ef4444"
                      }}
                    >
                      <span style={{ marginRight: "4px" }}>{GOAL_CATEGORIES[g.category]?.icon || "🎯"}</span>
                      <strong style={{ display: "block", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{g.title}</strong>
                      <span>{formatCurrency(g.amount)}</span>
                      {!month.goalsAffordable.some(a => a.id === g.id) && (
                        <span style={{ display: "block", fontSize: "0.65rem", opacity: 0.8, marginTop: "2px" }}>
                          Short: {formatCurrency(g.amount - month.projectedBalance)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Goal Items Grid List */}
      <div className="section-card">
        <h2 className="section-title">Milestone Goals</h2>
        
        {goals.length === 0 ? (
          <div className="empty-state" style={{ backgroundColor: "var(--bg-card)", padding: "40px" }}>
            <span style={{ fontSize: "2.5rem" }}>🎯</span>
            <h3>No planner goals set</h3>
            <p>Define your major goals (House purchase, Car, Travel, or Products) to simulate savings.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
            {goals.map((goal) => {
              const categoryDetails = GOAL_CATEGORIES[goal.category] || { label: "Goal 🎯", color: "#64748b" };
              const progress = Math.min(100, Math.max(0, (totalBalance / goal.amount) * 100));
              const isAffordable = totalBalance >= goal.amount;
              
              return (
                <div 
                  key={goal.id} 
                  style={{
                    backgroundColor: "var(--bg-card)",
                    border: `1px solid ${goal.completed ? "rgba(255,255,255,0.03)" : "var(--border-color)"}`,
                    borderRadius: "var(--radius-lg)",
                    padding: "20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                    opacity: goal.completed ? 0.6 : 1,
                    position: "relative"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <span 
                      className="badge" 
                      style={{ 
                        backgroundColor: `${categoryDetails.color}15`, 
                        color: categoryDetails.color,
                        borderColor: `${categoryDetails.color}30`
                      }}
                    >
                      {categoryDetails.label}
                    </span>
                    
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button 
                        onClick={() => handleToggleComplete(goal)}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem" }}
                        title={goal.completed ? "Reopen goal" : "Complete goal"}
                      >
                        {goal.completed ? "✅" : "⬜"}
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 style={{ margin: "0 0 4px 0", fontSize: "1.1rem", fontWeight: 700 }}>
                      {goal.title}
                    </h3>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      Target Date: {goal.target_date}
                    </span>
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "6px" }}>
                      <span style={{ color: "var(--text-secondary)" }}>Progress</span>
                      <strong style={{ color: isAffordable ? "var(--color-earn)" : "var(--text-primary)" }}>
                        {progress.toFixed(0)}%
                      </strong>
                    </div>
                    {/* Progress Bar */}
                    <div style={{ width: "100%", height: "8px", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
                      <div 
                        style={{ 
                          width: `${progress}%`, 
                          height: "100%", 
                          background: isAffordable ? "linear-gradient(90deg, #10b981 0%, #059669 100%)" : "linear-gradient(90deg, #6366f1 0%, #a855f7 100%)",
                          borderRadius: "var(--radius-full)"
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "auto", paddingTop: "10px", borderTop: "1px solid rgba(255,255,255,0.03)" }}>
                    <span style={{ fontSize: "1.15rem", fontWeight: 700 }}>
                      {formatCurrency(goal.amount)}
                    </span>
                    <div style={{ display: "flex", gap: "10px" }}>
                      <button 
                        className="edit-action-btn"
                        onClick={() => handleStartEdit(goal)}
                      >
                        Edit
                      </button>
                      <button 
                        className="delete-action-btn"
                        onClick={() => handleDeleteGoal(goal.id, goal.title)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Goal Edit Slide-out Drawer */}
      {editingGoal && (
        <div className="modal-overlay" onClick={() => setEditingGoal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="section-title" style={{ margin: 0 }}>
                {editingGoal.id ? "Edit Goal" : "Add Goal"}
              </h2>
              <button 
                type="button" 
                className="modal-close-btn" 
                onClick={() => setEditingGoal(null)}
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="error-message" style={{ padding: "10px", backgroundColor: "var(--color-spend-bg)", color: "var(--color-spend)", borderRadius: "var(--radius-sm)", fontSize: "0.85rem" }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSaveGoal} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              
              <div className="form-group">
                <label className="form-label" htmlFor="goal-title">Goal Name</label>
                <input
                  id="goal-title"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Europe Trip, Car downpayment..."
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="goal-amount">Target Amount (RM)</label>
                  <input
                    id="goal-amount"
                    type="number"
                    step="0.01"
                    min="1"
                    className="form-input"
                    placeholder="0.00"
                    value={goalAmount}
                    onChange={(e) => setGoalAmount(e.target.value)}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label" htmlFor="goal-date">Target Month</label>
                  <input
                    id="goal-date"
                    type="month"
                    className="form-input"
                    value={goalDate}
                    onChange={(e) => setGoalDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="goal-category">Goal Category</label>
                <CustomSelect
                  id="goal-category"
                  value={goalCategory}
                  onChange={(val) => setGoalCategory(val)}
                  options={[
                    { value: "product", label: "Product (Phone, Laptop, etc.)", icon: "💻" },
                    { value: "travel", label: "Travel (Vacation, Trip)", icon: "✈️" },
                    { value: "car", label: "Car (Downpayment, Purchase)", icon: "🚗" },
                    { value: "house", label: "House (Downpayment, Mortgage)", icon: "🏠" },
                  ]}
                />
              </div>

              {editingGoal.id && (
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <input 
                    id="goal-completed"
                    type="checkbox"
                    checked={goalCompleted}
                    onChange={(e) => setGoalCompleted(e.target.checked)}
                    style={{ width: "16px", height: "16px", accentColor: "var(--primary)" }}
                  />
                  <label htmlFor="goal-completed" style={{ fontSize: "0.95rem", fontWeight: 500, cursor: "pointer" }}>
                    Mark goal as completed
                  </label>
                </div>
              )}

              <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setEditingGoal(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  Save Goal
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </>
  );
}
