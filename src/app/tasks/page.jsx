"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

const CATEGORIES = ["Personal", "Work", "Financial", "Urgent", "Other"];
const PRIORITIES = ["Low", "Medium", "High"];

export default function TasksPage() {
  const [mounted, setMounted] = useState(false);
  const [tasks, setTasks] = useState([]);
  
  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Personal");
  const [priority, setPriority] = useState("Medium");
  const [dueDate, setDueDate] = useState("");
  const [financialAmount, setFinancialAmount] = useState("");

  // Filters State
  const [filterStatus, setFilterStatus] = useState("All"); // All | Active | Completed
  const [filterCategory, setFilterCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Load tasks on mount
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("personal_super_app_tasks");
    if (saved) {
      try {
        setTasks(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse tasks", e);
      }
    }
  }, []);

  // Save tasks on change
  const saveTasksToLocalStorage = (newTasks) => {
    setTasks(newTasks);
    localStorage.setItem("personal_super_app_tasks", JSON.stringify(newTasks));
    
    // Sync with Service Worker for background reminders
    if (typeof window !== "undefined" && "serviceWorker" in navigator && navigator.serviceWorker.controller) {
      const uncompleted = newTasks.filter((t) => !t.completed);
      navigator.serviceWorker.controller.postMessage({
        type: "SET_TASKS",
        tasks: uncompleted,
      });
    }
  };

  const handleAddTask = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newTask = {
      id: `task-${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
      dueDate: dueDate || null,
      financialAmount: category === "Financial" && financialAmount ? parseFloat(financialAmount) : null,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    saveTasksToLocalStorage([newTask, ...tasks]);

    // Reset Form
    setTitle("");
    setDescription("");
    setCategory("Personal");
    setPriority("Medium");
    setDueDate("");
    setFinancialAmount("");
  };

  const toggleTaskCompleted = (id) => {
    const updated = tasks.map((task) =>
      task.id === id ? { ...task, completed: !task.completed } : task
    );
    saveTasksToLocalStorage(updated);
  };

  const deleteTask = (id) => {
    const updated = tasks.filter((task) => task.id !== id);
    saveTasksToLocalStorage(updated);
  };

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchStatus =
        filterStatus === "All" ||
        (filterStatus === "Active" && !task.completed) ||
        (filterStatus === "Completed" && task.completed);

      const matchCategory = filterCategory === "All" || task.category === filterCategory;

      const matchSearch =
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description.toLowerCase().includes(searchQuery.toLowerCase());

      return matchStatus && matchCategory && matchSearch;
    });
  }, [tasks, filterStatus, filterCategory, searchQuery]);

  if (!mounted) {
    return (
      <div className="empty-state">
        <h2>Loading tasks...</h2>
      </div>
    );
  }

  return (
    <div className="tasks-container" style={{ display: "flex", flexDirection: "column", gap: "24px", paddingBottom: "40px" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Task Manager</h1>
          <p className="page-subtitle">Organize your daily schedule and financial action items</p>
        </div>
      </div>

      <div className="super-app-layout" style={{ display: "grid", gridTemplateColumns: "1fr 350px", gap: "24px" }}>
        
        {/* Left pane: Task List & Filtering */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* Filters Bar */}
          <div className="card" style={{ padding: "16px", display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              {["All", "Active", "Completed"].map((status) => (
                <button
                  key={status}
                  className={`btn ${filterStatus === status ? "btn-primary" : "btn-secondary"}`}
                  style={{ padding: "6px 12px", fontSize: "0.85rem" }}
                  onClick={() => setFilterStatus(status)}
                >
                  {status}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: "12px", flexGrow: 1, maxWidth: "400px" }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search tasks..."
                style={{ padding: "6px 12px", fontSize: "0.85rem" }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              
              <select
                className="form-input"
                style={{ padding: "6px 12px", fontSize: "0.85rem", width: "150px" }}
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="All">All Categories</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tasks List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {filteredTasks.length === 0 ? (
              <div className="card" style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>
                <p>No tasks found. Try adding a new task!</p>
              </div>
            ) : (
              filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className={`card task-item ${task.completed ? "completed" : ""}`}
                  style={{
                    padding: "16px 20px",
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "16px",
                    borderLeft: `4px solid ${
                      task.priority === "High"
                        ? "var(--color-spend)"
                        : task.priority === "Medium"
                        ? "var(--primary)"
                        : "var(--text-muted)"
                    }`,
                    opacity: task.completed ? 0.7 : 1,
                    transition: "opacity 0.2s ease"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "16px", flexGrow: 1 }}>
                    <div 
                      onClick={() => toggleTaskCompleted(task.id)}
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "6px",
                        border: `2px solid ${task.completed ? "var(--primary)" : "var(--text-muted)"}`,
                        backgroundColor: task.completed ? "var(--primary)" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        flexShrink: 0,
                        transition: "all 0.2s ease"
                      }}
                    >
                      {task.completed && (
                        <i className="fa-solid fa-check" style={{ fontSize: "10px", color: "white" }}></i>
                      )}
                    </div>
                    <div>
                      <h3
                        style={{
                          fontSize: "1rem",
                          fontWeight: "600",
                          textDecoration: task.completed ? "line-through" : "none",
                          color: task.completed ? "var(--text-muted)" : "var(--text-primary)",
                          marginBottom: "4px"
                        }}
                      >
                        {task.title}
                      </h3>
                      {task.description && (
                        <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                          {task.description}
                        </p>
                      )}
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                        <span
                          className={`badge`}
                          style={{
                            fontSize: "0.75rem",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            backgroundColor: "rgba(255,255,255,0.05)",
                            color: "var(--text-secondary)"
                          }}
                        >
                          <i className="fa-solid fa-tag" style={{ marginRight: "4px", fontSize: "0.75rem" }}></i> {task.category}
                        </span>

                        <span
                          style={{
                            fontSize: "0.75rem",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontWeight: "600",
                            backgroundColor:
                              task.priority === "High"
                                ? "var(--color-spend-bg)"
                                : task.priority === "Medium"
                                ? "var(--primary-glow)"
                                : "rgba(255,255,255,0.03)",
                            color:
                              task.priority === "High"
                                ? "var(--color-spend)"
                                : task.priority === "Medium"
                                ? "var(--primary)"
                                : "var(--text-muted)"
                          }}
                        >
                          {task.priority}
                        </span>

                        {task.dueDate && (
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                            <i className="fa-regular fa-calendar" style={{ fontSize: "0.75rem" }}></i> {task.dueDate}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    {task.category === "Financial" && (
                      <Link
                        href={`/add?title=${encodeURIComponent(task.title)}&amount=${task.financialAmount || ""}&description=${encodeURIComponent(task.description || "")}`}
                        className="btn btn-secondary"
                        title="Log as transaction"
                        style={{
                          padding: "6px 10px",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          fontSize: "0.8rem",
                          borderColor: "var(--color-earn)",
                          color: "var(--color-earn)"
                        }}
                      >
                        <i className="fa-solid fa-money-bill-transfer"></i> Log
                      </Link>
                    )}

                    <button
                      type="button"
                      className="btn"
                      style={{
                        padding: "6px",
                        backgroundColor: "transparent",
                        border: "none",
                        color: "var(--color-spend)",
                        cursor: "pointer"
                      }}
                      onClick={() => deleteTask(task.id)}
                    >
                      <i className="fa-solid fa-trash-can" style={{ fontSize: "0.9rem" }}></i>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right pane: Add Task Form */}
        <div>
          <div className="card" style={{ padding: "20px", position: "sticky", top: "24px" }}>
            <h2 style={{ fontSize: "1.15rem", fontWeight: "600", marginBottom: "16px" }}>New Task</h2>
            <form onSubmit={handleAddTask} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: "0.8rem" }}>Title</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Task title..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: "0.8rem" }}>Description (Optional)</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: "60px", resize: "vertical" }}
                  placeholder="Details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: "0.8rem" }}>Category</label>
                  <select
                    className="form-input"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontSize: "0.8rem" }}>Priority</label>
                  <select
                    className="form-input"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  >
                    {PRIORITIES.map((pri) => (
                      <option key={pri} value={pri}>{pri}</option>
                    ))}
                  </select>
                </div>
              </div>

              {category === "Financial" && (
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: "0.8rem" }}>Amount (RM - Optional)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    placeholder="0.00"
                    value={financialAmount}
                    onChange={(e) => setFinancialAmount(e.target.value)}
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label" style={{ fontSize: "0.8rem" }}>Due Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "8px" }}>
                Add Task
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
