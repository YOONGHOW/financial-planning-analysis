"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { getTransactions, getMonthlySalary, getFixedSpends, getSettings } from "@/lib/storage";

export default function CalendarPage() {
  const [mounted, setMounted] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [tasks, setTasks] = useState([]);
  
  // Budget settings for allowance forecast calculations
  const [grossSalary, setGrossSalary] = useState(4200.0);
  const [fixedSpends, setFixedSpends] = useState([]);
  const [savingsTarget, setSavingsTarget] = useState(20);
  const [coupleData, setCoupleData] = useState(null);

  // Date states
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState(() => {
    const today = new Date();
    return today.toLocaleDateString("en-CA"); // YYYY-MM-DD format
  });

  useEffect(() => {
    setMounted(true);
    
    // Load financial settings
    const loadSettings = async () => {
      try {
        const salary = await getMonthlySalary();
        const fixed = await getFixedSpends();
        const settings = await getSettings();
        
        setGrossSalary(salary);
        setFixedSpends(fixed || []);
        if (settings.savings_target !== undefined) {
          setSavingsTarget(parseInt(settings.savings_target));
        }
        if (settings.coupleData) {
          setCoupleData(settings.coupleData);
        }
      } catch (err) {
        console.error("Failed to load budget settings on calendar page", err);
      }
    };
    loadSettings();

    // Load Transactions
    const loadTx = async () => {
      try {
        const txs = await getTransactions();
        setTransactions(txs || []);
      } catch (err) {
        console.error("Failed to load transactions", err);
      }
    };
    loadTx();

    // Load Tasks
    const savedTasks = localStorage.getItem("personal_super_app_tasks");
    if (savedTasks) {
      try {
        setTasks(JSON.parse(savedTasks));
      } catch (err) {
        console.error("Failed to load tasks", err);
      }
    }
  }, []);

  // Format Helper: date object to YYYY-MM-DD
  const formatDateString = (year, month, day) => {
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    return `${year}-${mm}-${dd}`;
  };

  // Group transactions by date string
  const transactionsByDate = useMemo(() => {
    const map = {};
    transactions.forEach((tx) => {
      if (!tx.date) return;
      if (!map[tx.date]) {
        map[tx.date] = { spend: 0, earn: 0, list: [] };
      }
      if (tx.type === "spend") {
        map[tx.date].spend += tx.amount;
      } else {
        map[tx.date].earn += tx.amount;
      }
      map[tx.date].list.push(tx);
    });
    return map;
  }, [transactions]);

  // Group tasks by date string
  const tasksByDate = useMemo(() => {
    const map = {};
    tasks.forEach((task) => {
      if (!task.dueDate) return;
      if (!map[task.dueDate]) {
        map[task.dueDate] = [];
      }
      map[task.dueDate].push(task);
    });
    return map;
  }, [tasks]);

  // Couple Forecast Calculations
  const periodDateStr = useMemo(() => {
    if (!coupleData || !coupleData.periodStartDate) return null;
    try {
      const pStart = new Date(coupleData.periodStartDate);
      const cycleLength = coupleData.cycleLength || 28;
      const dStart = new Date(pStart.getFullYear(), pStart.getMonth(), pStart.getDate());
      
      const today = new Date();
      const dToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

      const daysSincePStart = Math.floor((dToday - dStart) / (1000 * 60 * 60 * 24));
      
      const nextPeriodStart = new Date(dStart.getTime() + cycleLength * (1000 * 60 * 60 * 24));
      let projectedNextStart = new Date(nextPeriodStart);
      if (dToday >= projectedNextStart) {
        const remainingCycles = Math.floor(daysSincePStart / cycleLength) + 1;
        projectedNextStart = new Date(dStart.getTime() + (remainingCycles * cycleLength) * (1000 * 60 * 60 * 24));
      }

      const y = projectedNextStart.getFullYear();
      const m = String(projectedNextStart.getMonth() + 1).padStart(2, "0");
      const d = String(projectedNextStart.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [coupleData]);

  const milestoneInfo = useMemo(() => {
    try {
      const start = new Date(2022, 7, 4); // Aug 4 2022
      const today = new Date();
      const dStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const dToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      const diffDays = Math.floor((dToday - dStart) / (1000 * 60 * 60 * 24));
      const currentFiveHundredMultiplier = Math.floor(diffDays / 500) + 1;
      const nextMilestoneDays = currentFiveHundredMultiplier * 500;
      const nextMilestoneDate = new Date(dStart.getTime() + nextMilestoneDays * (1000 * 60 * 60 * 24));
      
      const y = nextMilestoneDate.getFullYear();
      const m = String(nextMilestoneDate.getMonth() + 1).padStart(2, "0");
      const d = String(nextMilestoneDate.getDate()).padStart(2, "0");
      return {
        dateStr: `${y}-${m}-${d}`,
        days: nextMilestoneDays
      };
    } catch (e) {
      console.error(e);
      return { dateStr: "", days: 500 };
    }
  }, []);

  const anniversaryDateStr = useMemo(() => {
    try {
      const today = new Date();
      const dToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

      // Anniversary is Aug 4 each year starting from 2022
      let annivYear = today.getFullYear();
      let candidateAnniv = new Date(annivYear, 7, 4); // Aug 4 this year

      // If Aug 4 has already passed this year, move to next year
      if (dToday > candidateAnniv) {
        annivYear += 1;
        candidateAnniv = new Date(annivYear, 7, 4);
      }

      const y = candidateAnniv.getFullYear();
      const m = String(candidateAnniv.getMonth() + 1).padStart(2, "0");
      const d = String(candidateAnniv.getDate()).padStart(2, "0");
      const anniversaryNum = y - 2022;
      return {
        dateStr: `${y}-${m}-${d}`,
        num: anniversaryNum,
      };
    } catch (e) {
      console.error(e);
      return { dateStr: "", num: 0 };
    }
  }, []);

  // Calendar Helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed (0 = Jan)

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // First day of month (0 = Sun, 1 = Mon ... 6 = Sat)
  const firstDayIndex = new Date(year, month, 1).getDay();
  // Adjust so Monday is 0 index, Sunday is 6 index
  const firstDayOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

  // Discretionary Pool Budget Analysis
  const budgetAnalysis = useMemo(() => {
    const epfRate = 0.11;
    const socsoRate = 0.005;
    const epfDeduction = grossSalary * epfRate;
    const socsoDeduction = grossSalary * socsoRate;
    
    const fixedSum = fixedSpends.reduce((sum, item) => sum + item.amount, 0);
    const totalFixed = fixedSum + epfDeduction + socsoDeduction;
    const savingsGoal = grossSalary * (savingsTarget / 100);
    const disposableIncome = Math.max(0, grossSalary - totalFixed - savingsGoal);

    // Get current active calendar year and month (1-indexed)
    const calYear = currentDate.getFullYear();
    const calMonth = currentDate.getMonth() + 1;

    // Filter transactions in this month
    const activeMonthTxs = transactions.filter((tx) => {
      if (!tx.date) return false;
      const [y, m] = tx.date.split("-").map(Number);
      return y === calYear && m === calMonth;
    });

    const spendSum = activeMonthTxs
      .filter((tx) => tx.type === "spend")
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    const earnSum = activeMonthTxs
      .filter((tx) => tx.type === "earn")
      .reduce((sum, tx) => sum + tx.amount, 0);

    const remainingBudget = Math.max(0, disposableIncome - spendSum + earnSum);

    // Calculate days remaining
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth() + 1;
    const todayDate = today.getDate();

    let daysLeft = 0;
    if (calYear > todayYear || (calYear === todayYear && calMonth > todayMonth)) {
      // Future month: all days remaining
      daysLeft = totalDaysInMonth;
    } else if (calYear === todayYear && calMonth === todayMonth) {
      // Current month: days remaining from today inclusive
      daysLeft = totalDaysInMonth - todayDate + 1;
    } else {
      // Past month: 0 days remaining
      daysLeft = 0;
    }

    const dailyAllowance = daysLeft > 0 ? remainingBudget / daysLeft : 0;

    return {
      disposableIncome,
      remainingBudget,
      daysLeft,
      dailyAllowance,
      calYear,
      calMonth,
      todayDate,
      isCurrentMonth: calYear === todayYear && calMonth === todayMonth
    };
  }, [grossSalary, fixedSpends, savingsTarget, transactions, currentDate, totalDaysInMonth]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleGoToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDateStr(today.toLocaleDateString("en-CA"));
  };

  // Selected Day Details
  const selectedDayDetails = useMemo(() => {
    const txInfo = transactionsByDate[selectedDateStr] || { spend: 0, earn: 0, list: [] };
    const taskInfo = tasksByDate[selectedDateStr] || [];
    
    // Format Readable Date
    let readableDate = selectedDateStr;
    try {
      const parts = selectedDateStr.split("-");
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      readableDate = d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    } catch (e) {}

    return {
      dateStr: selectedDateStr,
      readableDate,
      transactions: txInfo.list,
      spendSum: txInfo.spend,
      earnSum: txInfo.earn,
      tasks: taskInfo
    };
  }, [selectedDateStr, transactionsByDate, tasksByDate]);

  if (!mounted) return null;

  // Generate grid days
  const calendarCells = [];
  
  // Padding cells for previous month days
  for (let i = 0; i < firstDayOffset; i++) {
    calendarCells.push({ isPadding: true, key: `pad-start-${i}` });
  }

  // Actual month days
  for (let day = 1; day <= totalDaysInMonth; day++) {
    const dateStr = formatDateString(year, month + 1, day);
    const dayTransactions = transactionsByDate[dateStr];
    const dayTasks = tasksByDate[dateStr] || [];
    
    calendarCells.push({
      isPadding: false,
      dayNum: day,
      dateStr,
      transactions: dayTransactions,
      tasks: dayTasks,
      key: `day-${day}`
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", minHeight: "100%" }}>
      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: "700", marginBottom: "4px" }}>Calendar</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
            Track daily cashflow and task allocations
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button className="btn btn-secondary" onClick={handleGoToToday}>
            Today
          </button>
        </div>
      </div>

      {/* Budget Forecast Banner */}
      {budgetAnalysis.disposableIncome > 0 && (
        <div 
          className="card" 
          style={{ 
            padding: "12px 16px", 
            background: "rgba(20, 184, 166, 0.05)", 
            border: "1px solid rgba(20, 184, 166, 0.2)", 
            borderRadius: "var(--radius-md)",
            fontSize: "0.9rem",
            color: "var(--text-secondary)",
            lineHeight: "1.4",
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px"
          }}
        >
          <span>
            {budgetAnalysis.isCurrentMonth ? (
              <>
                You have <strong>RM{budgetAnalysis.remainingBudget.toFixed(2)}</strong> left for the remaining <strong>{budgetAnalysis.daysLeft} days</strong>.
              </>
            ) : budgetAnalysis.daysLeft > 0 ? (
              <>
                Future month budget: <strong>RM{budgetAnalysis.remainingBudget.toFixed(2)}</strong> for <strong>{budgetAnalysis.daysLeft} days</strong>.
              </>
            ) : (
              <>
                Total discretionary budget was <strong>RM{budgetAnalysis.disposableIncome.toFixed(2)}</strong>.
              </>
            )}
          </span>
          {budgetAnalysis.daysLeft > 0 && (
            <span style={{ fontWeight: "700", color: "#14b8a6" }}>
              Daily Allowance Limit: RM{budgetAnalysis.dailyAllowance.toFixed(2)}
            </span>
          )}
        </div>
      )}

      {/* Calendar layout grid & side details drawer */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "24px" }} className="calendar-layout-container">
        
        {/* Left Side: Calendar Grid */}
        <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          
          {/* Calendar Header: Month/Year navigation */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: "1.3rem", fontWeight: "700", margin: 0 }}>
              {monthNames[month]} {year}
            </h2>
            <div style={{ display: "flex", gap: "8px" }}>
              <button 
                className="btn btn-secondary" 
                onClick={handlePrevMonth} 
                style={{ padding: "6px 12px", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <i className="fa-solid fa-chevron-left" style={{ fontSize: "0.85rem" }}></i>
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={handleNextMonth} 
                style={{ padding: "6px 12px", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <i className="fa-solid fa-chevron-right" style={{ fontSize: "0.85rem" }}></i>
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", textAlign: "center", fontWeight: "600", fontSize: "0.85rem", color: "var(--text-muted)", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
            <span>
              <span className="desktop-only-indicator">Mon</span>
              <span className="mobile-only-indicator">M</span>
            </span>
            <span>
              <span className="desktop-only-indicator">Tue</span>
              <span className="mobile-only-indicator">T</span>
            </span>
            <span>
              <span className="desktop-only-indicator">Wed</span>
              <span className="mobile-only-indicator">W</span>
            </span>
            <span>
              <span className="desktop-only-indicator">Thu</span>
              <span className="mobile-only-indicator">T</span>
            </span>
            <span>
              <span className="desktop-only-indicator">Fri</span>
              <span className="mobile-only-indicator">F</span>
            </span>
            <span>
              <span className="desktop-only-indicator">Sat</span>
              <span className="mobile-only-indicator">S</span>
            </span>
            <span>
              <span className="desktop-only-indicator">Sun</span>
              <span className="mobile-only-indicator">S</span>
            </span>
          </div>

          {/* Month Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px", minHeight: "300px" }}>
            {calendarCells.map((cell, idx) => {
              if (cell.isPadding) {
                return (
                  <div 
                    key={cell.key} 
                    style={{ 
                      background: "rgba(255,255,255,0.01)", 
                      borderRadius: "var(--radius-sm)", 
                      opacity: 0.25 
                    }} 
                  />
                );
              }

              const isSelected = selectedDateStr === cell.dateStr;
              const hasEarnings = cell.transactions && cell.transactions.earn > 0;
              const hasSpendings = cell.transactions && cell.transactions.spend > 0;
              
              // Calculate net cashflow for this cell
              const netCash = cell.transactions 
                ? cell.transactions.earn - cell.transactions.spend 
                : 0;

              const isLimitDay = 
                budgetAnalysis.daysLeft > 0 && 
                (budgetAnalysis.isCurrentMonth ? cell.dayNum >= budgetAnalysis.todayDate : true);

              return (
                <div
                  key={cell.key}
                  onClick={() => setSelectedDateStr(cell.dateStr)}
                  style={{
                    padding: "8px",
                    borderRadius: "var(--radius-sm)",
                    background: isSelected ? "var(--bg-card-hover)" : "rgba(255,255,255,0.03)",
                    border: isSelected 
                      ? "1px solid var(--primary)" 
                      : "1px solid var(--border-color)",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    minHeight: "65px",
                    transition: "all 0.25s ease",
                    position: "relative"
                  }}
                  className="calendar-cell"
                >
                  {/* Day number */}
                  <span style={{ 
                    fontSize: "0.95rem", 
                    fontWeight: isSelected ? "700" : "500", 
                    color: isSelected ? "var(--primary)" : "var(--text-primary)" 
                  }}>
                    {cell.dayNum}
                  </span>

                  {/* Native task dot for mobile layout */}
                  {cell.tasks.length > 0 && (
                    <span 
                      className="mobile-only-indicator"
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        backgroundColor: "var(--primary)",
                        position: "absolute",
                        top: "8px",
                        right: "8px"
                      }}
                    />
                  )}

                  {/* Indicators inside cell */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", width: "100%" }}>
                    
                    {/* Financial Net summary - Desktop */}
                    {netCash !== 0 ? (
                      <span 
                        className="desktop-only-indicator"
                        style={{ 
                          fontSize: "0.72rem", 
                          fontWeight: "700", 
                          color: netCash > 0 ? "var(--color-earn)" : "var(--color-spend)",
                          textAlign: "left",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}
                      >
                        {netCash > 0 ? `+RM${netCash.toFixed(0)}` : `-RM${Math.abs(netCash).toFixed(0)}`}
                      </span>
                    ) : (
                      isLimitDay && budgetAnalysis.dailyAllowance > 0 && (
                        <span 
                          className="desktop-only-indicator"
                          style={{ 
                            fontSize: "0.7rem", 
                            fontWeight: "500", 
                            color: "var(--text-muted)",
                            textAlign: "left"
                          }}
                        >
                          Limit: RM{budgetAnalysis.dailyAllowance.toFixed(0)}
                        </span>
                      )
                    )}

                    {/* Financial Net summary - Mobile */}
                    {netCash !== 0 ? (
                      <span 
                        className="mobile-only-indicator"
                        style={{ 
                          fontSize: "0.62rem", 
                          fontWeight: "700", 
                          color: netCash > 0 ? "var(--color-earn)" : "var(--color-spend)",
                          textAlign: "left",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          lineHeight: 1
                        }}
                      >
                        {netCash > 0 ? `+${netCash.toFixed(0)}` : `-${Math.abs(netCash).toFixed(0)}`}
                      </span>
                    ) : (
                      isLimitDay && budgetAnalysis.dailyAllowance > 0 && (
                        <span 
                          className="mobile-only-indicator"
                          style={{ 
                            fontSize: "0.58rem", 
                            fontWeight: "500", 
                            color: "var(--text-muted)",
                            textAlign: "left",
                            lineHeight: 1
                          }}
                        >
                          L: {budgetAnalysis.dailyAllowance.toFixed(0)}
                        </span>
                      )
                    )}

                    {/* Task badge - Desktop */}
                    {cell.tasks.length > 0 && (
                      <span 
                        className="desktop-only-indicator"
                        style={{ 
                          fontSize: "0.68rem", 
                          padding: "2px 4px", 
                          borderRadius: "4px", 
                          background: "var(--primary-glow)", 
                          color: "var(--primary)",
                          alignItems: "center",
                          alignSelf: "flex-start",
                          gap: "3px",
                          fontWeight: "600",
                          marginTop: "2px"
                        }}
                        title={`${cell.tasks.length} tasks due`}
                      >
                        <i className="fa-solid fa-list-check" style={{ fontSize: "0.6rem" }}></i>
                        {cell.tasks.length}
                      </span>
                    )}

                    {/* Period Date Marker */}
                    {cell.dateStr === periodDateStr && (
                      <>
                        <span 
                          className="desktop-only-indicator"
                          style={{ 
                            fontSize: "0.66rem", 
                            fontWeight: "700", 
                            color: "#ff4b72",
                            background: "rgba(255, 75, 114, 0.12)",
                            padding: "2px 4px",
                            borderRadius: "4px",
                            alignSelf: "flex-start",
                            marginTop: "2px",
                            whiteSpace: "nowrap"
                          }}
                        >
                          🩸 Period
                        </span>
                        <span 
                          className="mobile-only-indicator"
                          style={{ 
                            fontSize: "0.56rem", 
                            fontWeight: "700", 
                            color: "#ff4b72",
                            background: "rgba(255, 75, 114, 0.12)",
                            padding: "1px 3px",
                            borderRadius: "3px",
                            alignSelf: "flex-start",
                            marginTop: "1px",
                            lineHeight: 1
                          }}
                        >
                          🩸 Period
                        </span>
                      </>
                    )}

                    {/* Milestone Date Marker */}
                    {cell.dateStr === milestoneInfo.dateStr && (
                      <>
                        <span 
                          className="desktop-only-indicator"
                          style={{ 
                            fontSize: "0.66rem", 
                            fontWeight: "700", 
                            color: "#ff4b72",
                            background: "rgba(255, 75, 114, 0.12)",
                            padding: "2px 4px",
                            borderRadius: "4px",
                            alignSelf: "flex-start",
                            marginTop: "2px",
                            whiteSpace: "nowrap"
                          }}
                        >
                          💖 {milestoneInfo.days}d
                        </span>
                        <span 
                          className="mobile-only-indicator"
                          style={{ 
                            fontSize: "0.56rem", 
                            fontWeight: "700", 
                            color: "#ff4b72",
                            background: "rgba(255, 75, 114, 0.12)",
                            padding: "1px 3px",
                            borderRadius: "3px",
                            alignSelf: "flex-start",
                            marginTop: "1px",
                            lineHeight: 1
                          }}
                        >
                        💖 {milestoneInfo.days}d
                        </span>
                      </>
                    )}

                    {/* Anniversary Marker */}
                    {cell.dateStr === anniversaryDateStr.dateStr && (
                      <>
                        <span
                          className="desktop-only-indicator"
                          style={{
                            fontSize: "0.66rem",
                            fontWeight: "700",
                            color: "#ff4b72",
                            background: "rgba(255, 75, 114, 0.12)",
                            padding: "2px 4px",
                            borderRadius: "4px",
                            alignSelf: "flex-start",
                            marginTop: "2px",
                            whiteSpace: "nowrap"
                          }}
                        >
                          🎂 {anniversaryDateStr.num}yr Anniv
                        </span>
                        <span
                          className="mobile-only-indicator"
                          style={{
                            fontSize: "0.56rem",
                            fontWeight: "700",
                            color: "#ff4b72",
                            background: "rgba(255, 75, 114, 0.12)",
                            padding: "1px 3px",
                            borderRadius: "3px",
                            alignSelf: "flex-start",
                            marginTop: "1px",
                            lineHeight: 1
                          }}
                        >
                          🎂 {anniversaryDateStr.num}yr
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Day Drawer (Detail Pane) */}
        <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: "700", color: "var(--text-primary)", marginBottom: "4px" }}>
              Selected Day Details
            </h3>
            <span style={{ fontSize: "0.9rem", color: "var(--primary)", fontWeight: "600" }}>
              {selectedDayDetails.readableDate}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "20px" }} className="day-details-grid">
            
            {/* Daily Financial Cashflow Section */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                <span style={{ fontSize: "0.95rem", fontWeight: "600", color: "var(--text-secondary)" }}>
                  <i className="fa-solid fa-wallet" style={{ marginRight: "6px" }}></i> Transactions
                </span>
                <div 
                  className="day-summary-amounts" 
                  style={{ 
                    fontSize: "0.85rem", 
                    color: "var(--text-muted)", 
                    display: "flex", 
                    gap: "6px", 
                    flexWrap: "wrap", 
                    justifyContent: "flex-end",
                    textAlign: "right"
                  }}
                >
                  <span>
                    Earned: <span style={{ color: "var(--color-earn)", fontWeight: "600" }}>RM{selectedDayDetails.earnSum.toFixed(2)}</span>
                  </span>
                  <span className="desktop-only-indicator">|</span>
                  <span>
                    Spent: <span style={{ color: "var(--color-spend)", fontWeight: "600" }}>RM{selectedDayDetails.spendSum.toFixed(2)}</span>
                  </span>
                </div>
              </div>

              {selectedDayDetails.transactions.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontStyle: "italic", margin: 0, padding: "8px 0" }}>
                  No transactions logged on this day.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {selectedDayDetails.transactions.map((tx) => (
                    <div 
                      key={tx.id} 
                      style={{ 
                        display: "flex", 
                        justifyContent: "space-between", 
                        alignItems: "center", 
                        padding: "8px 12px", 
                        borderRadius: "var(--radius-sm)", 
                        background: "rgba(255,255,255,0.02)", 
                        border: "1px solid var(--border-color)" 
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: "0.9rem", fontWeight: "600", color: "var(--text-primary)" }}>
                          {tx.title}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          <i className="fa-solid fa-tag" style={{ marginRight: "4px" }}></i> {tx.category} {tx.description ? `• ${tx.description}` : ""}
                        </span>
                      </div>
                      <span style={{ 
                        fontWeight: "700", 
                        fontSize: "0.95rem", 
                        color: tx.type === "spend" ? "var(--color-spend)" : "var(--color-earn)" 
                      }}>
                        {tx.type === "spend" ? "-" : "+"}RM{tx.amount.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Daily Tasks Allocation Section */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                <span style={{ fontSize: "0.95rem", fontWeight: "600", color: "var(--text-secondary)" }}>
                  <i className="fa-solid fa-list-check" style={{ marginRight: "6px" }}></i> Allocated Tasks
                </span>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                  {selectedDayDetails.tasks.filter(t => t.completed).length}/{selectedDayDetails.tasks.length} Completed
                </span>
              </div>

              {selectedDayDetails.tasks.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontStyle: "italic", margin: 0, padding: "8px 0" }}>
                  No tasks allocated to this day.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {selectedDayDetails.tasks.map((task) => (
                    <div 
                      key={task.id} 
                      style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "space-between",
                        padding: "8px 12px", 
                        borderRadius: "var(--radius-sm)", 
                        background: "rgba(255,255,255,0.02)", 
                        border: "1px solid var(--border-color)" 
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <i 
                          className={task.completed ? "fa-regular fa-circle-check" : "fa-regular fa-circle"} 
                          style={{ 
                            color: task.completed ? "var(--color-earn)" : "var(--text-muted)", 
                            fontSize: "1rem" 
                          }}
                        ></i>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ 
                            fontSize: "0.9rem", 
                            fontWeight: "600", 
                            color: task.completed ? "var(--text-muted)" : "var(--text-primary)",
                            textDecoration: task.completed ? "line-through" : "none"
                          }}>
                            {task.title}
                          </span>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            Priority: <span style={{ 
                              color: task.priority === "High" ? "var(--color-spend)" : task.priority === "Medium" ? "var(--primary)" : "var(--text-muted)",
                              fontWeight: "600"
                            }}>{task.priority}</span> {task.description ? `• ${task.description}` : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
