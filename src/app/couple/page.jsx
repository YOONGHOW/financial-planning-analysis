"use client";

import { useState, useEffect, useMemo } from "react";
import { getCoupleData, saveCoupleData } from "@/lib/storage";

export default function CouplePage() {
  const [mounted, setMounted] = useState(false);
  const [periodStartDate, setPeriodStartDate] = useState("");
  const [cycleLength, setCycleLength] = useState(28);
  const [periodDuration, setPeriodDuration] = useState(5);

  // Partner Notes / Wishlist
  const CATEGORIES = [
    "❤️ Loves",
    "🎁 Wants",
    "🍽️ Food",
    "🌍 Places",
    "✨ Other",
  ];
  const [notes, setNotes] = useState([]);
  const [noteForm, setNoteForm] = useState({
    category: "❤️ Loves",
    title: "",
    detail: "",
  });
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [noteFilter, setNoteFilter] = useState("All");
  const [notesLoading, setNotesLoading] = useState(false);

  // UI toast feedback
  const [toasts, setToasts] = useState([]);
  const [saving, setSaving] = useState(false);

  // Load notes from API
  const loadNotes = async () => {
    setNotesLoading(true);
    try {
      const res = await fetch("/api/couple-notes");
      if (res.ok) {
        const data = await res.json();
        // Normalise created_at to a readable string
        setNotes(
          data.map((n) => ({
            ...n,
            createdAt: new Date(n.created_at).toLocaleDateString("en-MY", {
              year: "numeric",
              month: "short",
              day: "numeric",
            }),
          }))
        );
      }
    } catch (err) {
      console.error("Failed to load couple notes", err);
    } finally {
      setNotesLoading(false);
    }
  };

  // Load persisted data on mount
  useEffect(() => {
    setMounted(true);
    const loadData = async () => {
      try {
        const data = await getCoupleData();
        if (data) {
          if (data.periodStartDate) setPeriodStartDate(data.periodStartDate);
          if (data.cycleLength) setCycleLength(data.cycleLength);
          if (data.periodDuration) setPeriodDuration(data.periodDuration);
        }
      } catch (err) {
        console.error("Failed to load couple data", err);
      }
    };
    loadData();
    loadNotes();
  }, []);

  const addToast = (message, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const handleSaveData = async (e) => {
    e.preventDefault();
    if (!periodStartDate) {
      addToast("Please select a valid period start date.", "error");
      return;
    }

    setSaving(true);
    try {
      const data = {
        periodStartDate,
        cycleLength: parseInt(cycleLength) || 28,
        periodDuration: parseInt(periodDuration) || 5,
      };
      await saveCoupleData(data);
      addToast("Period details updated successfully!", "success");
    } catch (err) {
      console.error(err);
      addToast("Failed to save period details.", "error");
    } finally {
      setSaving(false);
    }
  };

  // Notes CRUD helpers
  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!noteForm.title.trim()) return;
    try {
      const payload = {
        id: editingNoteId || undefined,
        category: noteForm.category,
        title: noteForm.title.trim(),
        detail: noteForm.detail.trim(),
      };
      const res = await fetch("/api/couple-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      await loadNotes();
      setEditingNoteId(null);
      setNoteForm({ category: noteForm.category, title: "", detail: "" });
      addToast(editingNoteId ? "Note updated!" : "Note added!", "success");
    } catch (err) {
      console.error(err);
      addToast("Failed to save note.", "error");
    }
  };

  const handleEditNote = (note) => {
    setNoteForm({
      category: note.category,
      title: note.title,
      detail: note.detail || "",
    });
    setEditingNoteId(note.id);
  };

  const handleDeleteNote = async (id) => {
    try {
      const res = await fetch(`/api/couple-notes?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      await loadNotes();
      if (editingNoteId === id) {
        setEditingNoteId(null);
        setNoteForm({ category: "❤️ Loves", title: "", detail: "" });
      }
      addToast("Note deleted.", "success");
    } catch (err) {
      console.error(err);
      addToast("Failed to delete note.", "error");
    }
  };

  const filteredNotes =
    noteFilter === "All"
      ? notes
      : notes.filter((n) => n.category === noteFilter);

  // Calculations for Together Days, Anniversary, and milestones
  const relationshipStats = useMemo(() => {
    const start = new Date(2022, 7, 4); // August 4, 2022 (Month is 0-indexed)
    const today = new Date();

    // Clear time components for whole days
    const dStart = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate(),
    );
    const dToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );

    const diffDays = Math.floor((dToday - dStart) / (1000 * 60 * 60 * 24));

    // Next Anniversary Calculation
    const currentYear = today.getFullYear();
    let nextAnnivDate = new Date(currentYear, 7, 4);
    if (dToday > nextAnnivDate) {
      nextAnnivDate = new Date(currentYear + 1, 7, 4);
    }
    const daysToAnniv = Math.ceil(
      (nextAnnivDate - dToday) / (1000 * 60 * 60 * 24),
    );
    const annivIndex = nextAnnivDate.getFullYear() - start.getFullYear();

    // Next 500-Day Milestone Calculation
    const currentFiveHundredMultiplier = Math.floor(diffDays / 500) + 1;
    const nextMilestoneDays = currentFiveHundredMultiplier * 500;
    const daysToMilestone = nextMilestoneDays - diffDays;
    const nextMilestoneDate = new Date(
      dStart.getTime() + nextMilestoneDays * (1000 * 60 * 60 * 24),
    );

    return {
      totalDays: diffDays,
      nextAnnivDate,
      daysToAnniv,
      annivIndex,
      nextMilestoneDays,
      daysToMilestone,
      nextMilestoneDate,
    };
  }, [mounted]);

  // Calculations for Menstrual Cycle Forecast
  const periodForecast = useMemo(() => {
    if (!periodStartDate) return null;

    const start = new Date(periodStartDate);
    const today = new Date();

    // Clear time components
    const dStart = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate(),
    );
    const dToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );

    const daysSinceStart = Math.floor(
      (dToday - dStart) / (1000 * 60 * 60 * 24),
    );

    // Current cycle status (supports repeating cycles if date is older)
    let cycleDay = (daysSinceStart % cycleLength) + 1;
    if (cycleDay < 1) cycleDay += cycleLength;

    // Next expected period date
    const nextPeriodStart = new Date(
      dStart.getTime() + cycleLength * (1000 * 60 * 60 * 24),
    );
    // If the next expected date is in the past, project forward to the upcoming one
    let projectedNextStart = new Date(nextPeriodStart);
    if (dToday >= projectedNextStart) {
      const remainingCycles = Math.floor(daysSinceStart / cycleLength) + 1;
      projectedNextStart = new Date(
        dStart.getTime() +
          remainingCycles * cycleLength * (1000 * 60 * 60 * 24),
      );
    }
    const daysToNextPeriod = Math.ceil(
      (projectedNextStart - dToday) / (1000 * 60 * 60 * 24),
    );

    return {
      cycleDay,
      projectedNextStart,
      daysToNextPeriod,
    };
  }, [periodStartDate, cycleLength, periodDuration, mounted]);

  if (!mounted) {
    return (
      <div className="empty-state">
        <h2>Loading Couple Page...</h2>
      </div>
    );
  }

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

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        {/* Header */}
        <div>
          <h1
            style={{
              fontSize: "1.8rem",
              fontWeight: "700",
              marginBottom: "4px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            💖 Couple Space
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
            Track your milestones, anniversaries, and health timelines together
          </p>
        </div>

        {/* Dashboard Grid */}
        <div className="responsive-grid" style={{ gap: "20px" }}>
          {/* Left Column: Relationship milestones */}
          <div
            style={{ display: "flex", flexDirection: "column", gap: "20px" }}
          >
            {/* Days Together Counter Card */}
            <div
              className="card"
              style={{
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                gap: "12px",
                borderTop: "4px solid #ff4b72",
              }}
            >
              <div
                style={{
                  fontSize: "2.8rem",
                  lineHeight: "1",
                  filter: "drop-shadow(0 0 10px rgba(255, 75, 114, 0.3))",
                  animation: "pulse 2s infinite",
                }}
              >
                ❤️
              </div>
              <span
                style={{
                  fontSize: "0.85rem",
                  color: "var(--text-secondary)",
                  fontWeight: "600",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                }}
              >
                Total Days Together
              </span>
              <span
                style={{
                  fontSize: "3.2rem",
                  fontWeight: "900",
                  color: "#ff4b72",
                  lineHeight: "1",
                }}
              >
                {relationshipStats.totalDays.toLocaleString()} Days
              </span>
              <p
                style={{
                  margin: "4px 0 0 0",
                  fontSize: "0.85rem",
                  color: "var(--text-muted)",
                }}
              >
                Start date: <strong>August 4, 2022</strong>
              </p>
            </div>

            {/* Upcoming milestones Card */}
            <div
              className="card"
              style={{
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              <h3 style={{ fontSize: "1rem", fontWeight: "700", margin: 0 }}>
                Upcoming Milestones
              </h3>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {/* Anniversary Countdown */}
                <div
                  style={{
                    padding: "12px",
                    borderRadius: "var(--radius-sm)",
                    background: "rgba(255, 75, 114, 0.03)",
                    border: "1px solid rgba(255, 75, 114, 0.15)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <h4
                      style={{
                        margin: 0,
                        fontWeight: "700",
                        fontSize: "0.9rem",
                        color: "#ff4b72",
                      }}
                    >
                      {relationshipStats.annivIndex}th Anniversary
                    </h4>
                    <span
                      style={{
                        fontSize: "0.78rem",
                        color: "var(--text-muted)",
                      }}
                    >
                      {relationshipStats.nextAnnivDate.toLocaleDateString(
                        "en-MY",
                        { year: "numeric", month: "long", day: "numeric" },
                      )}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: "1.1rem",
                      fontWeight: "800",
                      color: "#ff4b72",
                    }}
                  >
                    {relationshipStats.daysToAnniv} days left
                  </span>
                </div>

                {/* Thousand Day Countdown */}
                <div
                  style={{
                    padding: "12px",
                    borderRadius: "var(--radius-sm)",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid var(--border-color)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <h4
                      style={{
                        margin: 0,
                        fontWeight: "700",
                        fontSize: "0.9rem",
                      }}
                    >
                      {relationshipStats.nextMilestoneDays.toLocaleString()}{" "}
                      Days Milestone
                    </h4>
                    <span
                      style={{
                        fontSize: "0.78rem",
                        color: "var(--text-muted)",
                      }}
                    >
                      {relationshipStats.nextMilestoneDate.toLocaleDateString(
                        "en-MY",
                        { year: "numeric", month: "long", day: "numeric" },
                      )}
                    </span>
                  </div>
                  <span style={{ fontSize: "1.1rem", fontWeight: "800" }}>
                    {relationshipStats.daysToMilestone} days left
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Menstrual Cycle tracker */}
          <div
            style={{ display: "flex", flexDirection: "column", gap: "20px" }}
          >
            {/* Cycle Tracker details card */}
            <div
              className="card"
              style={{
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                <h3 style={{ fontSize: "1rem", fontWeight: "700", margin: 0 }}>
                  Menstrual Cycle Forecast
                </h3>
              </div>

              {periodForecast ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                  }}
                >
                  {/* Key Cycle KPIs */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "12px",
                    }}
                  >
                    <div
                      style={{
                        padding: "12px",
                        borderRadius: "var(--radius-sm)",
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid var(--border-color)",
                        textAlign: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-secondary)",
                          display: "block",
                          marginBottom: "4px",
                        }}
                      >
                        Current Cycle Day
                      </span>
                      <span
                        style={{
                          fontSize: "1.5rem",
                          fontWeight: "800",
                          color: "var(--primary)",
                        }}
                      >
                        Day {periodForecast.cycleDay}
                      </span>
                    </div>

                    <div
                      style={{
                        padding: "12px",
                        borderRadius: "var(--radius-sm)",
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid var(--border-color)",
                        textAlign: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-secondary)",
                          display: "block",
                          marginBottom: "4px",
                        }}
                      >
                        Next Period expected
                      </span>
                      <span
                        style={{
                          fontSize: "1.5rem",
                          fontWeight: "800",
                          color:
                            periodForecast.daysToNextPeriod <= 5
                              ? "#ef4444"
                              : "var(--text-primary)",
                        }}
                      >
                        {periodForecast.daysToNextPeriod} Days
                      </span>
                    </div>
                  </div>

                  {/* Phase Progression visual bar */}
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "0.75rem",
                        color: "var(--text-muted)",
                        marginBottom: "6px",
                      }}
                    >
                      <span>
                        Start:{" "}
                        {new Date(periodStartDate).toLocaleDateString("en-MY", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span>
                        Progress (
                        {Math.round(
                          (periodForecast.cycleDay / cycleLength) * 100,
                        )}
                        %)
                      </span>
                      <span>Next Cycle</span>
                    </div>
                    <div
                      style={{
                        height: "8px",
                        width: "100%",
                        background: "rgba(255,255,255,0.05)",
                        borderRadius: "100px",
                        overflow: "hidden",
                        position: "relative",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${(periodForecast.cycleDay / cycleLength) * 100}%`,
                          background:
                            "linear-gradient(90deg, #ff4b72, var(--primary))",
                          borderRadius: "100px",
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                  </div>

                  {/* Calendar Projections */}
                  <div
                    style={{
                      padding: "12px",
                      borderRadius: "var(--radius-sm)",
                      background: "rgba(255,255,255,0.01)",
                      border: "1px solid var(--border-color)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      fontSize: "0.82rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ color: "var(--text-secondary)" }}>
                        📅 Next Period Start Date:
                      </span>
                      <strong style={{ color: "#ef4444" }}>
                        {periodForecast.projectedNextStart.toLocaleDateString(
                          "en-MY",
                          { year: "numeric", month: "long", day: "numeric" },
                        )}
                      </strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: "20px",
                    textAlign: "center",
                    color: "var(--text-muted)",
                    fontSize: "0.85rem",
                    background: "rgba(255,255,255,0.01)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px dashed var(--border-color)",
                  }}
                >
                  🌸 Log your last period details below to forecast cycle
                  indicators.
                </div>
              )}

              {/* Form Input fields */}
              <form
                onSubmit={handleSaveData}
                style={{
                  borderTop: "1px solid var(--border-color)",
                  paddingTop: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div className="form-group">
                  <label
                    className="form-label"
                    htmlFor="period-date"
                    style={{ fontSize: "0.8rem" }}
                  >
                    Last Period Start Date
                  </label>
                  <input
                    id="period-date"
                    type="date"
                    value={periodStartDate}
                    onChange={(e) => setPeriodStartDate(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label
                      className="form-label"
                      htmlFor="cycle-len"
                      style={{ fontSize: "0.8rem" }}
                    >
                      Cycle Length (days)
                    </label>
                    <input
                      id="cycle-len"
                      type="number"
                      min="20"
                      max="45"
                      value={cycleLength}
                      onChange={(e) => setCycleLength(e.target.value)}
                      className="form-input"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label
                      className="form-label"
                      htmlFor="period-dur"
                      style={{ fontSize: "0.8rem" }}
                    >
                      Duration (days)
                    </label>
                    <input
                      id="period-dur"
                      type="number"
                      min="2"
                      max="10"
                      value={periodDuration}
                      onChange={(e) => setPeriodDuration(e.target.value)}
                      className="form-input"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: "100%", marginTop: "4px" }}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Period Details"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Partner Notes / Wishlist */}
      <div
        className="card"
        style={{
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <h2 style={{ fontSize: "1.2rem", fontWeight: "700", margin: 0 }}>
              💝 About Her
            </h2>
            <p
              style={{
                fontSize: "0.82rem",
                color: "var(--text-muted)",
                margin: "4px 0 0",
              }}
            >
              Record what she loves, wants, and more.
            </p>
          </div>
          <span
            style={{
              fontSize: "0.8rem",
              color: "var(--text-muted)",
              background: "rgba(255,255,255,0.04)",
              padding: "4px 10px",
              borderRadius: "100px",
              border: "1px solid var(--border-color)",
            }}
          >
            {notes.length} {notes.length === 1 ? "entry" : "entries"}
          </span>
        </div>

        {/* Add / Edit Form */}
        <form
          onSubmit={handleAddNote}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
            padding: "16px",
            borderRadius: "var(--radius-sm)",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid var(--border-color)",
          }}
        >
          <div className="form-group" style={{ gridColumn: "1 / -1" }}>
            <label className="form-label" style={{ fontSize: "0.78rem" }}>
              Category
            </label>
            <div
              style={{
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
                marginTop: "6px",
              }}
            >
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setNoteForm((f) => ({ ...f, category: cat }))}
                  style={{
                    padding: "4px 12px",
                    borderRadius: "100px",
                    fontSize: "0.78rem",
                    fontWeight: "600",
                    cursor: "pointer",
                    border: "1px solid",
                    background:
                      noteForm.category === cat
                        ? "rgba(255,75,114,0.15)"
                        : "transparent",
                    borderColor:
                      noteForm.category === cat
                        ? "#ff4b72"
                        : "var(--border-color)",
                    color:
                      noteForm.category === cat
                        ? "#ff4b72"
                        : "var(--text-muted)",
                    transition: "all 0.2s ease",
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontSize: "0.78rem" }}>
              Title *
            </label>
            <input
              className="form-input"
              type="text"
              placeholder="e.g. Bubble tea, Paris trip..."
              value={noteForm.title}
              onChange={(e) =>
                setNoteForm((f) => ({ ...f, title: e.target.value }))
              }
              required
              maxLength={80}
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontSize: "0.78rem" }}>
              Details
            </label>
            <input
              className="form-input"
              type="text"
              placeholder="e.g. Brown sugar, with pearls"
              value={noteForm.detail}
              onChange={(e) =>
                setNoteForm((f) => ({ ...f, detail: e.target.value }))
              }
              maxLength={120}
            />
          </div>

          <div style={{ gridColumn: "1 / -1", display: "flex", gap: "8px" }}>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 1 }}
            >
              {editingNoteId !== null ? "✏️ Update Note" : "➕ Add Note"}
            </button>
            {editingNoteId !== null && (
              <button
                type="button"
                className="btn"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid var(--border-color)",
                }}
                onClick={() => {
                  setEditingNoteId(null);
                  setNoteForm({ category: "❤️ Loves", title: "", detail: "" });
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {/* Filter Tabs */}
        {notes.length > 0 && (
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {["All", ...CATEGORIES].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setNoteFilter(cat)}
                style={{
                  padding: "4px 12px",
                  borderRadius: "100px",
                  fontSize: "0.75rem",
                  fontWeight: "600",
                  cursor: "pointer",
                  border: "1px solid",
                  background:
                    noteFilter === cat
                      ? "rgba(255,75,114,0.15)"
                      : "transparent",
                  borderColor:
                    noteFilter === cat ? "#ff4b72" : "var(--border-color)",
                  color:
                    noteFilter === cat ? "#ff4b72" : "var(--text-secondary)",
                  transition: "all 0.2s ease",
                }}
              >
                {cat}
                {cat !== "All" && (
                  <span style={{ marginLeft: "5px", opacity: 0.7 }}>
                    ({notes.filter((n) => n.category === cat).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Notes List */}
        {notesLoading ? (
          <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
            Loading notes...
          </div>
        ) : filteredNotes.length === 0 ? (
          <div
            style={{
              padding: "32px",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: "0.85rem",
              background: "rgba(255,255,255,0.01)",
              borderRadius: "var(--radius-sm)",
              border: "1px dashed var(--border-color)",
            }}
          >
            💝 No entries yet. Add something above!
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {filteredNotes.map((note, idx) => (
              <div
                key={note.id}
                style={{
                  padding: "14px 16px",
                  borderRadius: "var(--radius-sm)",
                  border: `1px solid ${editingNoteId === note.id ? "#ff4b72" : "var(--border-color)"}`,
                  background:
                    editingNoteId === note.id
                      ? "rgba(255,75,114,0.06)"
                      : idx % 2 === 0
                        ? "rgba(255,255,255,0.02)"
                        : "rgba(255,255,255,0.01)",
                  transition: "border-color 0.2s ease, background 0.2s ease",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {/* Top row: badge + title + date */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      padding: "3px 9px",
                      borderRadius: "100px",
                      fontSize: "0.72rem",
                      fontWeight: "700",
                      background: "rgba(255,75,114,0.12)",
                      color: "#ff4b72",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {note.category}
                  </span>
                  <span
                    style={{
                      fontWeight: "700",
                      fontSize: "0.9rem",
                      color: "var(--text-primary)",
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {note.title}
                  </span>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      color: "var(--text-muted)",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {note.createdAt}
                  </span>
                </div>

                {/* Detail row */}
                {note.detail && (
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.82rem",
                      color: "var(--text-secondary)",
                      paddingLeft: "4px",
                    }}
                  >
                    {note.detail}
                  </p>
                )}

                {/* Action buttons */}
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleEditNote(note)}
                    style={{
                      background: "rgba(99,102,241,0.12)",
                      color: "#818cf8",
                      border: "none",
                      borderRadius: "6px",
                      padding: "5px 14px",
                      fontSize: "0.78rem",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteNote(note.id)}
                    style={{
                      background: "rgba(239,68,68,0.12)",
                      color: "#f87171",
                      border: "none",
                      borderRadius: "6px",
                      padding: "5px 14px",
                      fontSize: "0.78rem",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes pulse {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.15);
          }
        }
      `}</style>
    </>
  );
}
