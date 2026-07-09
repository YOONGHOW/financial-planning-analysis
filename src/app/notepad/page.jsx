"use client";

import { useState, useEffect, useMemo, useRef } from "react";

export default function NotepadPage() {
  const [mounted, setMounted] = useState(false);
  const [notes, setNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [mobileActiveView, setMobileActiveView] = useState("list"); // list | editor
  
  // Speech Recording States & Refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState("");

  // Editor State
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [viewMode, setViewMode] = useState("edit"); // edit | preview | split
  const [searchQuery, setSearchQuery] = useState("");

  // Load notes on mount
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("personal_super_app_notes");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setNotes(parsed);
        
        const params = new URLSearchParams(window.location.search);
        const requestedId = params.get("id");
        const found = parsed.find((n) => n.id === requestedId);
        
        if (found) {
          setActiveNoteId(found.id);
          setMobileActiveView("editor");
        } else if (parsed.length > 0) {
          setActiveNoteId(parsed[0].id);
        }
      } catch (e) {
        console.error("Failed to parse notes", e);
      }
    }
  }, []);

  // Sync active note state when activeNoteId changes
  useEffect(() => {
    if (activeNoteId) {
      const active = notes.find((n) => n.id === activeNoteId);
      if (active) {
        setTitle(active.title);
        setContent(active.content);
      }
    } else {
      setTitle("");
      setContent("");
    }
  }, [activeNoteId]);

  // Reset viewMode to edit if on mobile and split view is active
  useEffect(() => {
    const checkMobileWidth = () => {
      if (typeof window !== "undefined" && window.innerWidth <= 768 && viewMode === "split") {
        setViewMode("edit");
      }
    };
    checkMobileWidth();
    window.addEventListener("resize", checkMobileWidth);
    return () => window.removeEventListener("resize", checkMobileWidth);
  }, [viewMode]);

  // Save notes helper
  const saveNotesToLocalStorage = (updatedNotes) => {
    setNotes(updatedNotes);
    localStorage.setItem("personal_super_app_notes", JSON.stringify(updatedNotes));
  };

  const startRecording = async () => {
    setTranscriptionError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Check audio recording MIME type
      let mimeType = "audio/webm";
      if (MediaRecorder.isTypeSupported("audio/webm")) {
        mimeType = "audio/webm";
      } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
        mimeType = "audio/mp4"; // iOS fallback
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        stream.getTracks().forEach((track) => track.stop()); // Stop mic stream
        await handleTranscribe(audioBlob, mimeType);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Recording start error:", err);
      setTranscriptionError("Microphone access denied or not supported.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleTranscribe = async (audioBlob, mimeType) => {
    setIsTranscribing(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Data = reader.result.split(",")[1];
        
        const res = await fetch("/api/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audioData: base64Data, mimeType }),
        });

        if (!res.ok) {
          throw new Error("API call failed.");
        }

        const data = await res.json();
        if (data.text) {
          // Sync with the absolute latest content in localStorage to prevent overwriting other entries
          const savedNotes = localStorage.getItem("personal_super_app_notes");
          let latestContent = "";
          let latestTitle = title;
          
          if (savedNotes) {
            try {
              const parsed = JSON.parse(savedNotes);
              const active = parsed.find((n) => n.id === activeNoteId);
              if (active) {
                latestContent = active.content || "";
                latestTitle = active.title || title;
              }
            } catch (e) {}
          }

          const separator = latestContent ? "\n" : "";
          handleUpdateNote(latestTitle, latestContent + separator + data.text);
        } else {
          setTranscriptionError("No speech detected by Gemini.");
        }
      };
    } catch (err) {
      console.error("Gemini transcription failed:", err);
      setTranscriptionError("Speech-to-text failed. Please try again.");
    } finally {
      setIsTranscribing(false);
    }
  };

  const createNewNote = () => {
    const newNote = {
      id: `note-${Date.now()}`,
      title: "Untitled Note",
      content: "",
      updatedAt: new Date().toISOString(),
    };

    const updated = [newNote, ...notes];
    saveNotesToLocalStorage(updated);
    setActiveNoteId(newNote.id);
    setMobileActiveView("editor");
  };

  const handleUpdateNote = (updatedTitle, updatedContent) => {
    if (!activeNoteId) return;
    
    setTitle(updatedTitle);
    setContent(updatedContent);

    const updated = notes.map((note) => {
      if (note.id === activeNoteId) {
        return {
          ...note,
          title: updatedTitle,
          content: updatedContent,
          updatedAt: new Date().toISOString(),
        };
      }
      return note;
    });

    // Move active note to top of list as it was just edited
    const activeIdx = updated.findIndex((n) => n.id === activeNoteId);
    if (activeIdx > -1) {
      const activeNote = updated[activeIdx];
      updated.splice(activeIdx, 1);
      updated.unshift(activeNote);
    }

    saveNotesToLocalStorage(updated);
  };

  const deleteNote = (id, e) => {
    e.stopPropagation();
    const updated = notes.filter((n) => n.id !== id);
    saveNotesToLocalStorage(updated);

    if (activeNoteId === id) {
      if (updated.length > 0) {
        setActiveNoteId(updated[0].id);
      } else {
        setActiveNoteId(null);
      }
      setMobileActiveView("list");
    }
  };

  // Simple custom Markdown parser
  const renderMarkdown = (text) => {
    if (!text) return "<p style='color:var(--text-muted); font-style:italic;'>No content yet...</p>";

    // Escape basic HTML to prevent XSS
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3 style="font-size:1.1rem; font-weight:600; margin-top:16px; margin-bottom:8px; color:var(--text-primary);">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 style="font-size:1.3rem; font-weight:600; margin-top:20px; margin-bottom:10px; color:var(--text-primary); border-bottom:1px solid var(--border-color); padding-bottom:4px;">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 style="font-size:1.6rem; font-weight:700; margin-top:24px; margin-bottom:12px; color:var(--text-primary);">$1</h1>');

    // Bold & Italics
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Lists
    html = html.replace(/^\s*-\s+(.*$)/gim, '<li style="margin-left:20px; list-style-type:disc; margin-bottom:4px;">$1</li>');
    html = html.replace(/^\s*\*\s+(.*$)/gim, '<li style="margin-left:20px; list-style-type:disc; margin-bottom:4px;">$1</li>');

    // Paragraphs / Linebreaks
    html = html.split('\n').map(line => {
      if (line.trim().startsWith('<h') || line.trim().startsWith('<li')) {
        return line;
      }
      return line.trim() ? `<p style="margin-bottom:12px; color:var(--text-secondary);">${line}</p>` : '<br/>';
    }).join('\n');

    return html;
  };

  const filteredNotes = useMemo(() => {
    return notes.filter(
      (note) =>
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [notes, searchQuery]);

  const wordCount = useMemo(() => {
    return content ? content.trim().split(/\s+/).filter(Boolean).length : 0;
  }, [content]);

  if (!mounted) {
    return (
      <div className="empty-state">
        <h2>Loading notes...</h2>
      </div>
    );
  }

  return (
    <div className="notepad-container" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 48px)", gap: "20px", paddingBottom: "24px" }}>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="page-title">Notepad</h1>
          <p className="page-subtitle">Rich markdown-ready editor for your ideas, plans, and summaries</p>
        </div>
        <button className="btn btn-primary" onClick={createNewNote}>
          + New Note
        </button>
      </div>

      <div className="notepad-workspace" style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "24px", flexGrow: 1, minHeight: 0 }}>
        {/* Left pane: Notes list */}
        <div className={`card notepad-list-pane ${mobileActiveView === "editor" ? "mobile-hidden" : ""}`} style={{ display: "flex", flexDirection: "column", padding: "16px", minHeight: 0, overflowY: "auto", gap: "16px" }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: "8px", flexGrow: 1, overflowY: "auto" }}>
            {filteredNotes.length === 0 ? (
              <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem", marginTop: "24px" }}>
                No notes found
              </p>
            ) : (
              filteredNotes.map((note) => {
                const dateObj = new Date(note.updatedAt);
                const formattedDate = dateObj.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " + dateObj.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
                
                return (
                  <div
                    key={note.id}
                    onClick={() => {
                      setActiveNoteId(note.id);
                      setMobileActiveView("editor");
                    }}
                    style={{
                      padding: "12px",
                      borderRadius: "var(--radius-md)",
                      background: activeNoteId === note.id ? "var(--bg-card-hover)" : "rgba(255,255,255,0.02)",
                      border: activeNoteId === note.id ? "1px solid var(--border-hover)" : "1px solid var(--border-color)",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      transition: "all 0.2s ease"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                      <span style={{ fontWeight: "600", fontSize: "0.95rem", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexGrow: 1 }}>
                        {note.title || "Untitled Note"}
                      </span>
                      <button
                        onClick={(e) => deleteNote(note.id, e)}
                        style={{ background: "transparent", border: "none", color: "var(--color-spend)", cursor: "pointer", fontSize: "0.85rem", padding: "0 2px" }}
                        title="Delete note"
                      >
                        <i className="fa-solid fa-trash-can" style={{ fontSize: "0.85rem" }}></i>
                      </button>
                    </div>
                    
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {note.content ? note.content.substring(0, 45) + (note.content.length > 45 ? "..." : "") : "Empty note"}
                    </span>

                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", alignSelf: "flex-end" }}>
                      {formattedDate}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right pane: Note Editor */}
        <div className={`card notepad-editor-pane ${mobileActiveView === "list" ? "mobile-hidden" : ""}`} style={{ display: "flex", flexDirection: "column", padding: "24px", minHeight: 0, overflow: "hidden" }}>
          {activeNoteId ? (
            <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "16px" }}>
              {/* Note Edit Header Controls */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px", gap: "12px" }}>
                {mobileActiveView === "editor" && (
                  <button 
                    onClick={() => setMobileActiveView("list")}
                    className="btn btn-secondary mobile-only-btn"
                    style={{ padding: "4px 8px", fontSize: "0.85rem", whiteSpace: "nowrap" }}
                  >
                    ← Notes
                  </button>
                )}
                <input
                  type="text"
                  placeholder="Note Title"
                  style={{
                    fontSize: "1.3rem",
                    fontWeight: "700",
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "var(--text-primary)",
                    flexGrow: 1
                  }}
                  value={title}
                  onChange={(e) => handleUpdateNote(e.target.value, content)}
                />
              </div>

              {/* Sub-toolbar: Voice-to-Text & View Mode tabs */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                {/* Speech to text microphone button */}
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isTranscribing}
                  className="btn"
                  style={{
                    padding: "6px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "0.85rem",
                    backgroundColor: isRecording ? "var(--color-spend)" : "var(--bg-main)",
                    color: isRecording ? "white" : "var(--text-secondary)",
                    borderColor: isRecording ? "var(--color-spend)" : "var(--border-color)",
                    cursor: "pointer",
                    borderRadius: "var(--radius-md)",
                    height: "36px",
                    fontWeight: "600",
                    whiteSpace: "nowrap"
                  }}
                  title={isRecording ? "Stop recording speech" : "Start speech-to-text recording"}
                >
                  {isTranscribing ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i> Transcribing...
                    </>
                  ) : isRecording ? (
                    <>
                      <i className="fa-solid fa-microphone-slash fa-pulse" style={{ color: "white" }}></i> Stop
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-microphone"></i> Speech -{">"} Text
                    </>
                  )}
                </button>

                <div style={{ display: "flex", gap: "4px", background: "var(--bg-main)", padding: "4px", borderRadius: "var(--radius-sm)" }}>
                  {["edit", "preview", "split"].map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className={mode === "split" ? "split-tab-btn" : ""}
                      style={{
                        padding: "4px 10px",
                        fontSize: "0.8rem",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        background: viewMode === mode ? "var(--primary)" : "transparent",
                        color: viewMode === mode ? "white" : "var(--text-secondary)",
                        fontWeight: "600",
                        textTransform: "capitalize"
                      }}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Editor Workspace */}
              <div style={{ display: "grid", gridTemplateColumns: viewMode === "split" ? "1fr 1fr" : "1fr", gap: "24px", flexGrow: 1, minHeight: 0 }}>
                 {/* Editor textarea container */}
                {(viewMode === "edit" || viewMode === "split") && (
                  <div style={{ position: "relative", height: "100%", width: "100%" }}>
                    <textarea
                      placeholder="Write some ideas using markdown: # title, **bold**, *italics*, - list item..."
                      style={{
                        width: "100%",
                        height: "100%",
                        background: "rgba(0,0,0,0.2)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "var(--radius-md)",
                        padding: "16px",
                        color: "var(--text-secondary)",
                        fontSize: "0.95rem",
                        lineHeight: "1.6",
                        fontFamily: "monospace",
                        resize: "none",
                        outline: "none"
                      }}
                      disabled={isTranscribing}
                      value={content}
                      onChange={(e) => handleUpdateNote(title, e.target.value)}
                    />
                    
                    {/* Pulsing skeleton loader overlay during speech-to-text processing */}
                    {isTranscribing && (
                      <div 
                        style={{
                          position: "absolute",
                          bottom: "16px",
                          left: "16px",
                          right: "16px",
                          padding: "16px",
                          background: "rgba(15, 21, 36, 0.92)",
                          border: "1px solid var(--border-hover)",
                          borderRadius: "var(--radius-md)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                          boxShadow: "var(--shadow-glow)",
                          backdropFilter: "blur(4px)",
                          zIndex: 5
                        }}
                      >
                        <span style={{ fontSize: "0.8rem", color: "var(--primary)", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}>
                          <i className="fa-solid fa-microphone fa-beat" style={{ color: "var(--primary)" }}></i> Transcribing Voice Input...
                        </span>
                        <div className="skeleton-pulse" style={{ width: "95%", height: "12px", background: "rgba(255,255,255,0.08)", borderRadius: "3px" }} />
                        <div className="skeleton-pulse" style={{ width: "70%", height: "12px", background: "rgba(255,255,255,0.08)", borderRadius: "3px" }} />
                      </div>
                    )}
                  </div>
                )}

                {/* Markdown Preview */}
                {(viewMode === "preview" || viewMode === "split") && (
                  <div
                    style={{
                      height: "100%",
                      overflowY: "auto",
                      border: viewMode === "split" ? "1px dashed var(--border-color)" : "none",
                      padding: viewMode === "split" ? "16px" : "8px",
                      borderRadius: "var(--radius-md)",
                      lineHeight: "1.6",
                    }}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                  />
                )}
              </div>

              {/* Footer status bar */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem", color: "var(--text-muted)", paddingTop: "8px", borderTop: "1px solid var(--border-color)" }}>
                <span>{wordCount} words | {content.length} characters</span>
                {transcriptionError && (
                  <span style={{ color: "var(--color-spend)", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}>
                    <i className="fa-solid fa-triangle-exclamation"></i> {transcriptionError}
                  </span>
                )}
                <span>Auto-saved locally</span>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", gap: "12px" }}>
              <i className="fa-regular fa-clipboard" style={{ fontSize: "3.5rem", color: "var(--text-muted)", marginBottom: "12px" }}></i>
              <h2>No Active Note</h2>
              <p>Create a new note to start brainstorming!</p>
              <button className="btn btn-primary" onClick={createNewNote}>
                Create Note
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
