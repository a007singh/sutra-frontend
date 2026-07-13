import { useState } from "react";
import { SUB_AGENT_PROMPTS, PROMPT_CATEGORIES } from "../data/subAgentPrompts";
import type { PromptTemplate } from "../data/subAgentPrompts";

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  General:    { bg: "#F1EFE8", color: "#444441" },
  Governance: { bg: "#EEEDFE", color: "#3C3489" },
  Operations: { bg: "#E1F5EE", color: "#085041" },
  Analytics:  { bg: "#E6F1FB", color: "#0C447C" },
  Support:    { bg: "#FAEEDA", color: "#633806" },
  BFSI:       { bg: "#FAECE7", color: "#712B13" },
  Finance:    { bg: "#EAF3DE", color: "#27500A" },
  HR:         { bg: "#FBEAF0", color: "#72243E" },
};

interface Props {
  onInsert: (prompt: string, role: string) => void;
  onClose: () => void;
}

export default function PromptLibrary({ onInsert, onClose }: Props) {
  const [search, setSearch]             = useState("");
  const [category, setCategory]         = useState("All");
  const [previewing, setPreviewing]     = useState<PromptTemplate | null>(null);

  const filtered = SUB_AGENT_PROMPTS.filter(p => {
    const matchCat  = category === "All" || p.category === category;
    const matchSearch = !search || p.role.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.5)", backdropFilter: "blur(3px)",
      display: "flex", justifyContent: "flex-end",
    }} onClick={onClose}>
      <div style={{
        width: previewing ? "860px" : "440px",
        height: "100%",
        background: "var(--bg-elevated)",
        borderLeft: "1px solid var(--border-hover)",
        display: "flex",
        animation: "slideIn 0.2s ease",
        overflow: "hidden",
        transition: "width 0.2s ease",
      }} onClick={e => e.stopPropagation()}>

        {/* ── Left: prompt list ── */}
        <div style={{
          width: "440px", flexShrink: 0,
          display: "flex", flexDirection: "column",
          borderRight: previewing ? "1px solid var(--border)" : "none",
        }}>
          {/* Header */}
          <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <div>
                <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>
                  Prompt library
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                  {SUB_AGENT_PROMPTS.length} ready-to-use system prompts
                </div>
              </div>
              <button onClick={onClose} style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--text-muted)", fontSize: "20px", lineHeight: 1, padding: "2px 6px",
              }}>×</button>
            </div>

            {/* Search */}
            <div style={{ position: "relative", marginBottom: "10px" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="var(--text-muted)" strokeWidth="2"
                style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }}>
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search prompts..."
                style={{
                  width: "100%", padding: "8px 10px 8px 30px",
                  background: "var(--bg-overlay)", border: "1px solid var(--border-hover)",
                  borderRadius: "6px", color: "var(--text-primary)",
                  fontSize: "12px", fontFamily: "var(--font)", outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Category chips */}
            <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
              {PROMPT_CATEGORIES.map(c => (
                <button key={c} onClick={() => setCategory(c)} style={{
                  padding: "3px 10px", borderRadius: "20px", fontSize: "11px",
                  border: "1px solid",
                  borderColor: category === c ? "var(--accent)" : "var(--border-hover)",
                  background: category === c ? "var(--accent-dim)" : "transparent",
                  color: category === c ? "var(--accent)" : "var(--text-secondary)",
                  cursor: "pointer", fontFamily: "var(--font)",
                }}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>
                No prompts match your search
              </div>
            ) : filtered.map(p => {
              const cat = CATEGORY_COLORS[p.category] || CATEGORY_COLORS.General;
              const isSelected = previewing?.id === p.id;

              return (
                <div
                  key={p.id}
                  onClick={() => setPreviewing(isSelected ? null : p)}
                  style={{
                    padding: "10px 12px", borderRadius: "8px", cursor: "pointer",
                    marginBottom: "4px",
                    background: isSelected ? "var(--accent-dim)" : "transparent",
                    border: `1px solid ${isSelected ? "rgba(0,200,150,0.3)" : "transparent"}`,
                    transition: "all 0.1s",
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)";
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "transparent";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 500, color: isSelected ? "var(--accent)" : "var(--text-primary)" }}>
                          {p.role}
                        </span>
                        <span style={{
                          fontSize: "10px", fontWeight: 600, padding: "1px 6px",
                          borderRadius: "8px", background: cat.bg, color: cat.color,
                          flexShrink: 0,
                        }}>
                          {p.category}
                        </span>
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.4" }}>
                        {p.description}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", flexShrink: 0 }}>
                      <button
                        onClick={ev => { ev.stopPropagation(); onInsert(p.prompt, p.role); onClose(); }}
                        style={{
                          padding: "4px 10px", borderRadius: "5px", fontSize: "11px",
                          background: "var(--accent)", border: "none",
                          color: "#0A0B0F", cursor: "pointer", fontWeight: 600,
                          fontFamily: "var(--font)", whiteSpace: "nowrap",
                        }}
                      >
                        Use
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right: preview panel ── */}
        {previewing && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                  {previewing.role}
                </div>
                <button onClick={() => setPreviewing(null)} style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--text-muted)", fontSize: "16px", lineHeight: 1,
                }}>×</button>
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                {previewing.description}
              </div>
            </div>

            {/* Prompt preview */}
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px" }}>
              <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                System prompt preview
              </div>
              <pre style={{
                fontSize: "12px", fontFamily: "var(--font)",
                color: "var(--text-secondary)", lineHeight: "1.75",
                whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0,
                background: "var(--bg-overlay)", border: "1px solid var(--border)",
                borderRadius: "8px", padding: "12px 14px",
              }}>
                {previewing.prompt}
              </pre>
            </div>

            {/* Insert button */}
            <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
              <button
                onClick={() => { onInsert(previewing.prompt, previewing.role); onClose(); }}
                style={{
                  width: "100%", padding: "10px 16px", borderRadius: "8px",
                  background: "var(--accent)", border: "none",
                  color: "#0A0B0F", fontSize: "13px", fontWeight: 600,
                  cursor: "pointer", fontFamily: "var(--font)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Insert into system prompt
              </button>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center", marginTop: "6px" }}>
                This will replace the current system prompt
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
