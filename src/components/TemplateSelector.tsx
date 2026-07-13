import { useState } from "react";
import { ORCHESTRATOR_TEMPLATES } from "../data/orchestratorTemplates";
import type { OrchestratorTemplate } from "../data/orchestratorTemplates";

const ICONS: Record<string, React.ReactNode> = {
  shield: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  users:  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  receipt:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  headset:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/><path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>,
  bank:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>,
};

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  BFSI:       { bg: "#E6F1FB", color: "#0C447C" },
  HR:         { bg: "#EAF3DE", color: "#27500A" },
  Finance:    { bg: "#FAEEDA", color: "#633806" },
  Operations: { bg: "#EEEDFE", color: "#3C3489" },
};

interface Props {
  onSelect: (template: OrchestratorTemplate) => void;
  onClose: () => void;
}

export default function TemplateSelector({ onSelect, onClose }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categories = ["All", ...Array.from(new Set(ORCHESTRATOR_TEMPLATES.map(t => t.category)))];

  const filtered = ORCHESTRATOR_TEMPLATES.filter(t =>
    selectedCategory === "All" || t.category === selectedCategory
  );

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-hover)",
        borderRadius: "var(--border-radius-lg, 12px)",
        width: "100%", maxWidth: "720px",
        maxHeight: "80vh", overflow: "hidden",
        display: "flex", flexDirection: "column",
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}>
          <div style={{
            display: "flex", alignItems: "center",
            justifyContent: "space-between", marginBottom: "14px",
          }}>
            <div>
              <h2 style={{
                fontSize: "16px", fontWeight: 600,
                color: "var(--text-primary)", marginBottom: "3px",
              }}>
                Start from a template
              </h2>
              <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                Pre-built for Indian enterprise use cases. Customise after selecting.
              </p>
            </div>
            <button onClick={onClose} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-muted)", fontSize: "20px", lineHeight: 1,
              padding: "2px 6px",
            }}>×</button>
          </div>

          {/* Category filter */}
          <div style={{ display: "flex", gap: "6px" }}>
            {categories.map(c => (
              <button key={c} onClick={() => setSelectedCategory(c)} style={{
                padding: "4px 12px", borderRadius: "20px", fontSize: "12px",
                border: "1px solid",
                borderColor: selectedCategory === c ? "var(--accent)" : "var(--border-hover)",
                background: selectedCategory === c ? "var(--accent-dim)" : "transparent",
                color: selectedCategory === c ? "var(--accent)" : "var(--text-secondary)",
                cursor: "pointer", fontFamily: "var(--font)",
              }}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Template grid */}
        <div style={{
          overflowY: "auto", padding: "16px 24px 24px",
          display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: "12px", alignContent: "start",
        }}>
          {filtered.map(t => {
            const catColor = CATEGORY_COLORS[t.category] || CATEGORY_COLORS.Operations;
            const isHov = hovered === t.id;

            return (
              <div
                key={t.id}
                onClick={() => onSelect(t)}
                onMouseEnter={() => setHovered(t.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  background: isHov ? "var(--bg-overlay)" : "var(--bg-surface)",
                  border: `1px solid ${isHov ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: "var(--border-radius-lg, 12px)",
                  padding: "16px", cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {/* Card header */}
                <div style={{
                  display: "flex", alignItems: "flex-start",
                  justifyContent: "space-between", marginBottom: "10px",
                }}>
                  <div style={{
                    width: "36px", height: "36px", borderRadius: "9px",
                    background: isHov ? "var(--accent-dim)" : "rgba(255,255,255,0.05)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: isHov ? "var(--accent)" : "var(--text-secondary)",
                    transition: "all 0.15s", flexShrink: 0,
                  }}>
                    {ICONS[t.icon] || ICONS.receipt}
                  </div>
                  <span style={{
                    fontSize: "10px", fontWeight: 600, padding: "2px 8px",
                    borderRadius: "10px",
                    background: catColor.bg, color: catColor.color,
                  }}>
                    {t.category}
                  </span>
                </div>

                {/* Name */}
                <div style={{
                  fontSize: "14px", fontWeight: 600,
                  color: "var(--text-primary)", marginBottom: "6px",
                }}>
                  {t.name}
                </div>

                {/* Description */}
                <div style={{
                  fontSize: "12px", color: "var(--text-secondary)",
                  lineHeight: "1.6", marginBottom: "12px",
                }}>
                  {t.description}
                </div>

                {/* Sub-agents preview */}
                <div style={{
                  borderTop: "1px solid var(--border)", paddingTop: "10px",
                  display: "flex", flexWrap: "wrap", gap: "5px",
                }}>
                  {t.suggested_sub_agents.map((sa, i) => (
                    <span key={i} style={{
                      fontSize: "10px", padding: "2px 7px", borderRadius: "4px",
                      background: "var(--bg-overlay)", color: "var(--text-muted)",
                      fontFamily: "var(--font-mono)",
                    }}>
                      {sa.name.replace(" Agent", "")}
                    </span>
                  ))}
                  <span style={{
                    fontSize: "10px", color: "var(--text-muted)",
                    paddingTop: "2px", marginLeft: "2px",
                  }}>
                    + {t.suggested_sub_agents.length} agents
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}