"use client";

import { useState, useEffect, useMemo } from "react";
import { getDebts, saveDebts } from "@/lib/storage";

export default function DebtPlannerPage() {
  const [mounted, setMounted] = useState(false);
  const [debts, setDebts] = useState([]);
  const [extraPayment, setExtraPayment] = useState(200); // Default RM 200 extra monthly
  
  // Modal / Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDebtId, setEditingDebtId] = useState(null);
  const [debtName, setDebtName] = useState("");
  const [debtBalance, setDebtBalance] = useState("");
  const [debtInterest, setDebtInterest] = useState("");
  const [debtMinPay, setDebtMinPay] = useState("");
  
  // UI toasts feedback state
  const [toasts, setToasts] = useState([]);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    setMounted(true);
    const loadDebtsData = async () => {
      try {
        const saved = await getDebts();
        setDebts(saved || []);
      } catch (err) {
        console.error("Failed to load debts", err);
      }
    };
    loadDebtsData();
  }, []);

  const addToast = (message, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const handleOpenAddModal = () => {
    setEditingDebtId(null);
    setDebtName("");
    setDebtBalance("");
    setDebtInterest("");
    setDebtMinPay("");
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (debt) => {
    setEditingDebtId(debt.id);
    setDebtName(debt.name);
    setDebtBalance(debt.balance.toString());
    setDebtInterest(debt.interestRate.toString());
    setDebtMinPay(debt.minPayment.toString());
    setFormError("");
    setIsModalOpen(true);
  };

  const handleDeleteDebt = async (id) => {
    const updated = debts.filter((d) => d.id !== id);
    setDebts(updated);
    try {
      await saveDebts(updated);
      addToast("Debt deleted successfully", "success");
    } catch (e) {
      console.error(e);
      addToast("Failed to sync delete with server", "error");
    }
  };

  const handleSaveDebt = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!debtName.trim()) {
      setFormError("Please enter a debt name.");
      return;
    }

    const bal = parseFloat(debtBalance);
    const interest = parseFloat(debtInterest);
    const minPay = parseFloat(debtMinPay);

    if (isNaN(bal) || bal <= 0) {
      setFormError("Total balance must be a positive number.");
      return;
    }
    if (isNaN(interest) || interest < 0) {
      setFormError("Interest rate cannot be negative.");
      return;
    }
    if (isNaN(minPay) || minPay <= 0) {
      setFormError("Minimum monthly payment must be positive.");
      return;
    }

    // Check if minimum payment is too small to cover initial interest
    const monthlyRate = (interest / 100) / 12;
    const initialMonthlyInterest = bal * monthlyRate;
    if (minPay <= initialMonthlyInterest) {
      setFormError(
        `Warning: Minimum payment (RM ${minPay.toFixed(2)}) is less than or equal to the monthly interest accrued (RM ${initialMonthlyInterest.toFixed(2)}). The debt balance will grow indefinitely!`
      );
      return;
    }

    let updatedDebts = [...debts];

    if (editingDebtId) {
      // Edit mode
      updatedDebts = updatedDebts.map((d) =>
        d.id === editingDebtId
          ? { ...d, name: debtName.trim(), balance: bal, interestRate: interest, minPayment: minPay }
          : d
      );
      addToast("Debt updated successfully", "success");
    } else {
      // Add mode
      const newDebt = {
        id: Date.now().toString(),
        name: debtName.trim(),
        balance: bal,
        interestRate: interest,
        minPayment: minPay
      };
      updatedDebts.push(newDebt);
      addToast("New debt added successfully", "success");
    }

    setDebts(updatedDebts);
    setIsModalOpen(false);
    
    try {
      await saveDebts(updatedDebts);
    } catch (e) {
      console.error(e);
      addToast("Failed to sync changes with server", "error");
    }
  };

  // Simulation Calculations Engine
  const simulations = useMemo(() => {
    if (debts.length === 0) return null;

    const runSim = (strategy) => {
      let currentDebts = debts.map((d) => ({
        ...d,
        currentBalance: d.balance,
        paidOffMonth: null,
        totalInterestPaid: 0
      }));

      let months = 0;
      const maxMonths = 360; // 30 years maximum boundary
      const history = [];

      const sortDebts = (list) => {
        if (strategy === "avalanche") {
          return [...list].sort((a, b) => b.interestRate - a.interestRate || a.balance - b.balance);
        } else if (strategy === "snowball") {
          return [...list].sort((a, b) => a.balance - b.balance || b.interestRate - a.interestRate);
        } else {
          return [...list];
        }
      };

      const initialTotal = currentDebts.reduce((sum, d) => sum + d.currentBalance, 0);
      history.push({ month: 0, totalBalance: initialTotal });

      while (months < maxMonths) {
        const activeDebts = currentDebts.filter((d) => d.currentBalance > 0);
        if (activeDebts.length === 0) break;

        months++;
        const sortedActive = sortDebts(activeDebts);
        
        let monthlyPool = 0;
        if (strategy === "baseline") {
          // Baseline: minimums only
          monthlyPool = sortedActive.reduce((sum, d) => sum + d.minPayment, 0);
        } else {
          // Extra payment plus rolled over minimums
          monthlyPool = debts.reduce((sum, d) => sum + d.minPayment, 0) + extraPayment;
        }

        const allocations = {};
        let totalMinAllocated = 0;

        sortedActive.forEach((d) => {
          const minToPay = Math.min(d.currentBalance, d.minPayment);
          allocations[d.id] = minToPay;
          totalMinAllocated += minToPay;
        });

        monthlyPool -= totalMinAllocated;

        // Apply remaining rollover pool to highest priority active debt
        if (strategy !== "baseline" && monthlyPool > 0) {
          for (let i = 0; i < sortedActive.length; i++) {
            const d = sortedActive[i];
            const remainingToPay = d.currentBalance - (allocations[d.id] || 0);
            if (remainingToPay > 0) {
              const extraToPay = Math.min(remainingToPay, monthlyPool);
              allocations[d.id] = (allocations[d.id] || 0) + extraToPay;
              monthlyPool -= extraToPay;
              if (monthlyPool <= 0) break;
            }
          }
        }

        // Apply payments and accumulate interest
        sortedActive.forEach((d) => {
          const payment = allocations[d.id] || 0;
          const monthlyRate = (d.interestRate / 100) / 12;
          const interestAccrued = d.currentBalance * monthlyRate;

          const nextBalance = Math.max(0, d.currentBalance - payment + interestAccrued);
          d.totalInterestPaid += interestAccrued;
          d.currentBalance = nextBalance;

          if (nextBalance <= 0 && d.paidOffMonth === null) {
            d.paidOffMonth = months;
          }
        });

        const totalRemaining = currentDebts.reduce((sum, d) => sum + d.currentBalance, 0);
        history.push({ month: months, totalBalance: totalRemaining });

        if (totalRemaining <= 0) break;
      }

      return {
        monthsNeeded: months,
        totalInterest: currentDebts.reduce((sum, d) => sum + d.totalInterestPaid, 0),
        debtsInfo: currentDebts,
        history
      };
    };

    return {
      baseline: runSim("baseline"),
      snowball: runSim("snowball"),
      avalanche: runSim("avalanche")
    };
  }, [debts, extraPayment]);

  // SVG coordinates converter
  const chartPoints = useMemo(() => {
    if (!simulations) return { baseline: "", snowball: "", avalanche: "" };

    const maxMonths = Math.max(
      simulations.baseline.monthsNeeded,
      simulations.snowball.monthsNeeded,
      simulations.avalanche.monthsNeeded,
      1
    );
    const initialDebt = debts.reduce((sum, d) => sum + d.balance, 0);

    const generatePoints = (history) => {
      const w = 500;
      const h = 200;
      const padding = 20;

      return history
        .map((pt) => {
          const x = padding + (pt.month / maxMonths) * (w - 2 * padding);
          const y = h - padding - (pt.totalBalance / initialDebt) * (h - 2 * padding);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ");
    };

    return {
      baseline: generatePoints(simulations.baseline.history),
      snowball: generatePoints(simulations.snowball.history),
      avalanche: generatePoints(simulations.avalanche.history),
      maxMonths,
      initialDebt
    };
  }, [simulations, debts]);

  if (!mounted) {
    return (
      <div className="empty-state">
        <h2>Loading Debt Planner...</h2>
      </div>
    );
  }

  const totalMinRequired = debts.reduce((sum, d) => sum + d.minPayment, 0);

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

      <div style={{ display: "flex", flexDirection: "column", gap: "24px", minHeight: "100%" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1 style={{ fontSize: "1.8rem", fontWeight: "700", marginBottom: "4px" }}>Debt payoff Optimizer</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
              Strategize and accelerate your path to becoming debt-free
            </p>
          </div>
          <button className="btn btn-primary" onClick={handleOpenAddModal}>
            <i className="fa-solid fa-plus" style={{ marginRight: "6px" }}></i> Add Debt
          </button>
        </div>

        {debts.length === 0 ? (
          <div className="card" style={{ padding: "40px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
            <div style={{ fontSize: "3rem" }}>📉</div>
            <h3 style={{ margin: 0, fontWeight: "700" }}>No Liabilities Logged</h3>
            <p style={{ color: "var(--text-secondary)", maxWidth: "400px", margin: 0, fontSize: "0.9rem" }}>
              Add your car loan, student loans, or credit cards to run strategies and see how much interest you can save!
            </p>
            <button className="btn btn-primary" onClick={handleOpenAddModal}>
              <i className="fa-solid fa-plus" style={{ marginRight: "6px" }}></i> Add Your First Debt
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            
            {/* Top Scorecard Metrics */}
            {simulations && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                <div className="kpi-card expense" style={{ padding: "14px 16px" }}>
                  <span className="kpi-title" style={{ fontSize: "0.8rem" }}>Baseline payoff (Minimums Only)</span>
                  <span className="kpi-value text-spend" style={{ fontSize: "1.3rem", display: "block", marginTop: "4px" }}>
                    {simulations.baseline.monthsNeeded} months
                  </span>
                  <div className="kpi-meta" style={{ marginTop: "8px" }}>
                    <span>Interest: RM {simulations.baseline.totalInterest.toFixed(2)}</span>
                  </div>
                </div>

                <div className="kpi-card" style={{ padding: "14px 16px", position: "relative" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "4px", backgroundColor: "#f59e0b" }} />
                  <span className="kpi-title" style={{ fontSize: "0.8rem" }}>Snowball payoff (+RM {extraPayment})</span>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "4px" }}>
                    <span className="kpi-value" style={{ color: "#f59e0b", fontSize: "1.3rem" }}>
                      {simulations.snowball.monthsNeeded} months
                    </span>
                    <span className="kpi-meta-badge positive" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", fontSize: "0.72rem" }}>
                      Saves {simulations.baseline.monthsNeeded - simulations.snowball.monthsNeeded} mos
                    </span>
                  </div>
                  <div className="kpi-meta" style={{ marginTop: "8px" }}>
                    <span>Interest: RM {simulations.snowball.totalInterest.toFixed(2)} (Saved: RM {(simulations.baseline.totalInterest - simulations.snowball.totalInterest).toFixed(0)})</span>
                  </div>
                </div>

                <div className="kpi-card savings" style={{ padding: "14px 16px" }}>
                  <span className="kpi-title" style={{ fontSize: "0.8rem" }}>Avalanche payoff (Highest Interest First)</span>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "4px" }}>
                    <span className="kpi-value" style={{ color: "var(--primary)", fontSize: "1.3rem" }}>
                      {simulations.avalanche.monthsNeeded} months
                    </span>
                    <span className="kpi-meta-badge positive" style={{ fontSize: "0.72rem" }}>
                      Saves {simulations.baseline.monthsNeeded - simulations.avalanche.monthsNeeded} mos
                    </span>
                  </div>
                  <div className="kpi-meta" style={{ marginTop: "8px" }}>
                    <span>Interest: RM {simulations.avalanche.totalInterest.toFixed(2)} (Saved: RM {(simulations.baseline.totalInterest - simulations.avalanche.totalInterest).toFixed(0)})</span>
                  </div>
                </div>
              </div>
            )}

            {/* Layout Grid */}
            <div className="responsive-grid" style={{ gap: "20px" }}>
              
              {/* Left Column: Extra Allocation Controls & Chart */}
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                
                {/* Controller Panel */}
                <div className="card" style={{ padding: "16px" }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: "700", marginBottom: "12px" }}>
                    Extra Monthly Contribution
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                        Adding to minimums (RM {totalMinRequired.toFixed(2)})
                      </span>
                      <span style={{ fontSize: "1.2rem", fontWeight: "800", color: "var(--primary)" }}>
                        + RM {extraPayment} / month
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="3000"
                      step="50"
                      value={extraPayment}
                      onChange={(e) => setExtraPayment(parseInt(e.target.value))}
                      style={{ width: "100%", accentColor: "var(--primary)" }}
                    />
                    <p style={{ margin: "4px 0 0 0", fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: "1.4" }}>
                      💡 Tip: Allocating leftover funds from your <strong>Flexible Discretionary Pool</strong> directly to debt speeds up payoff and saves interest.
                    </p>
                  </div>
                </div>

                {/* SVG Visualizer Chart */}
                <div className="card" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                    <h3 style={{ fontSize: "1rem", fontWeight: "700", margin: 0 }}>
                      Payoff Timeline Projections
                    </h3>
                    <div style={{ display: "flex", gap: "12px", fontSize: "0.8rem", flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ width: "14px", borderTop: "2px dashed var(--color-spend)", display: "inline-block" }}></span> Min Only
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ width: "14px", borderTop: "2.5px solid #f59e0b", display: "inline-block" }}></span> Snowball
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ width: "14px", borderTop: "2.5px dashed #14b8a6", display: "inline-block" }}></span> Avalanche
                      </span>
                    </div>
                  </div>

                  <div style={{ padding: "10px", background: "rgba(0,0,0,0.2)", borderRadius: "var(--radius-sm)", width: "100%" }}>
                    <svg viewBox="0 0 500 200" style={{ width: "100%", height: "auto", overflow: "visible" }}>
                      {/* Grid Lines */}
                      <line x1="20" y1="20" x2="20" y2="180" stroke="var(--border-color)" />
                      <line x1="20" y1="180" x2="480" y2="180" stroke="var(--border-color)" />
                      <text x="22" y="32" fill="var(--text-muted)" fontSize="8">RM {chartPoints.initialDebt.toFixed(0)}</text>
                      <text x="440" y="176" fill="var(--text-muted)" fontSize="8">{chartPoints.maxMonths} mos</text>
                      
                      {/* Baseline Line */}
                      {chartPoints.baseline && (
                        <polyline
                          fill="none"
                          stroke="var(--color-spend)"
                          strokeWidth="1.5"
                          strokeDasharray="3 3"
                          points={chartPoints.baseline}
                        />
                      )}

                      {/* Snowball Line */}
                      {chartPoints.snowball && (
                        <polyline
                          fill="none"
                          stroke="#f59e0b"
                          strokeWidth="2.5"
                          points={chartPoints.snowball}
                        />
                      )}

                      {/* Avalanche Line */}
                      {chartPoints.avalanche && (
                        <polyline
                          fill="none"
                          stroke="#14b8a6"
                          strokeWidth="2.5"
                          strokeDasharray="5 3"
                          points={chartPoints.avalanche}
                        />
                      )}
                    </svg>
                  </div>
                </div>

              </div>

              {/* Right Column: Active Liabilities List */}
              <div className="card" style={{ padding: "16px" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: "700", marginBottom: "12px" }}>
                  Active Liabilities
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {debts.map((debt) => (
                    <div
                      key={debt.id}
                      style={{
                        padding: "14px",
                        borderRadius: "var(--radius-sm)",
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid var(--border-color)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "12px"
                      }}
                    >
                      <div>
                        <h4 style={{ margin: 0, fontWeight: "700", fontSize: "0.95rem" }}>{debt.name}</h4>
                        <div style={{ display: "flex", gap: "12px", marginTop: "4px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                          <span>Int: <strong>{debt.interestRate}%</strong></span>
                          <span>Min: <strong>RM {debt.minPayment.toFixed(0)}</strong></span>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        <span style={{ fontSize: "1rem", fontWeight: "800" }}>
                          RM {debt.balance.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <div style={{ display: "flex", gap: "4px" }}>
                          <button
                            className="btn btn-secondary"
                            onClick={() => handleOpenEditModal(debt)}
                            style={{ padding: "6px 10px", fontSize: "0.8rem" }}
                          >
                            <i className="fa-solid fa-pen"></i>
                          </button>
                          <button
                            className="btn btn-secondary"
                            onClick={() => handleDeleteDebt(debt.id)}
                            style={{ padding: "6px 10px", fontSize: "0.8rem", color: "var(--color-spend)" }}
                          >
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Payoff Schedule Timeline */}
            {simulations && (
              <div className="card" style={{ padding: "16px" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: "700", marginBottom: "12px" }}>
                  Clearing Timeline Comparison
                </h3>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border-color)", textAlign: "left" }}>
                        <th style={{ padding: "10px 8px", color: "var(--text-secondary)" }}>Debt Name</th>
                        <th style={{ padding: "10px 8px", color: "var(--text-secondary)" }}>Balance</th>
                        <th style={{ padding: "10px 8px", color: "var(--text-secondary)", color: "var(--color-spend)" }}>Min Only</th>
                        <th style={{ padding: "10px 8px", color: "var(--text-secondary)", color: "#f59e0b" }}>Snowball</th>
                        <th style={{ padding: "10px 8px", color: "var(--text-secondary)", color: "#14b8a6" }}>Avalanche</th>
                      </tr>
                    </thead>
                    <tbody>
                      {debts.map((d) => {
                        const baseDebt = simulations.baseline.debtsInfo.find((di) => di.id === d.id);
                        const snowDebt = simulations.snowball.debtsInfo.find((di) => di.id === d.id);
                        const avaDebt = simulations.avalanche.debtsInfo.find((di) => di.id === d.id);

                        return (
                          <tr key={d.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
                            <td style={{ padding: "12px 8px", fontWeight: "600" }}>{d.name}</td>
                            <td style={{ padding: "12px 8px" }}>RM {d.balance.toFixed(2)}</td>
                            <td style={{ padding: "12px 8px", color: "var(--text-muted)" }}>
                              {baseDebt?.paidOffMonth ? `${baseDebt.paidOffMonth} mos` : "30+ years"}
                            </td>
                            <td style={{ padding: "12px 8px", fontWeight: "600", color: "#f59e0b" }}>
                              {snowDebt?.paidOffMonth ? `${snowDebt.paidOffMonth} mos` : "30+ years"}
                            </td>
                            <td style={{ padding: "12px 8px", fontWeight: "600", color: "#14b8a6" }}>
                              {avaDebt?.paidOffMonth ? `${avaDebt.paidOffMonth} mos` : "30+ years"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {/* Modal Dialog */}
      {isModalOpen && (
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
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "700" }}>
                {editingDebtId ? "Edit Debt Record" : "Add Debt Record"}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1.3rem", fontWeight: "700" }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveDebt} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              
              <div className="form-group">
                <label className="form-label" htmlFor="debt-name">Debt Description</label>
                <input
                  id="debt-name"
                  type="text"
                  placeholder="e.g. Car Loan, PTPTN, Credit Card"
                  value={debtName}
                  onChange={(e) => setDebtName(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="debt-bal">Remaining Balance (RM)</label>
                <input
                  id="debt-bal"
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  value={debtBalance}
                  onChange={(e) => setDebtBalance(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="debt-int">Interest Rate (% p.a.)</label>
                  <input
                    id="debt-int"
                    type="number"
                    placeholder="0.0"
                    step="0.01"
                    value={debtInterest}
                    onChange={(e) => setDebtInterest(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="debt-min">Min Monthly Payment (RM)</label>
                  <input
                    id="debt-min"
                    type="number"
                    placeholder="0.00"
                    step="0.01"
                    value={debtMinPay}
                    onChange={(e) => setDebtMinPay(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>
              </div>

              {formError && (
                <div style={{ color: "var(--color-spend)", fontSize: "0.85rem", fontWeight: "600", lineHeight: "1.4" }}>
                  ⚠️ {formError}
                </div>
              )}

              <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>
                  Save Record
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </>
  );
}
