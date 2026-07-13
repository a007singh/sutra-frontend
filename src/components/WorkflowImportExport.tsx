import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { orchestratorsApi } from "../api/orchestrators";
import type { Orchestrator } from "../api/orchestrators";
import { globalToast } from "../hooks/useGlobalToast";

// ── Export button ────────────────────────────────────────────────────────────
interface ExportProps {
  orchestrator: Orchestrator;
}

export function ExportButton({ orchestrator }: ExportProps) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const res  = await orchestratorsApi.exportConfig(orchestrator.orchestrator_agent_id);
      const data = res.data;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `${orchestrator.name.toLowerCase().replace(/\s+/g, "-")}-workflow.json`;
      a.click();
      URL.revokeObjectURL(url);
      globalToast(`Exported "${orchestrator.name}" config`);
    } catch {
      globalToast("Failed to export workflow config", "error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      title="Export workflow config as JSON"
      style={{
        padding: "5px 10px", borderRadius: "6px", fontSize: "12px",
        background: "transparent", border: "1px solid var(--border-hover)",
        color: "var(--text-secondary)", cursor: exporting ? "not-allowed" : "pointer",
        fontFamily: "var(--font)", display: "flex", alignItems: "center", gap: "4px",
        opacity: exporting ? 0.6 : 1, transition: "all 0.15s",
      }}
    >
      {exporting ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2"
          style={{ animation: "spin 0.8s linear infinite" }}>
          <polyline points="1 4 1 10 7 10"/>
          <path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
        </svg>
      ) : (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      )}
      Export
    </button>
  );
}

// ── Import modal ─────────────────────────────────────────────────────────────
interface ImportProps {
  onClose: () => void;
  onImported: () => void;
}

export function ImportModal({ onClose, onImported }: ImportProps) {
  const queryClient                   = useQueryClient();
  const fileRef                       = useRef<HTMLInputElement>(null);
  const [config, setConfig]           = useState<any>(null);
  const [fileName, setFileName]       = useState("");
  const [mode, setMode]               = useState<"create" | "update">("create");
  const [targetOrchId, setTargetOrchId] = useState("");
  const [importing, setImporting]     = useState(false);
  const [preview, setPreview]         = useState(false);
  const [error, setError]             = useState("");

  const { data: orchestrators } = useQuery({
    queryKey: ["orchestrators"],
    queryFn: () => orchestratorsApi.list().then(r => r.data),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError("");
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (!parsed.orchestrator || !parsed.sub_agents) {
          setError("Invalid config file — missing orchestrator or sub_agents fields.");
          setConfig(null);
          return;
        }
        setConfig(parsed);
      } catch {
        setError("Invalid JSON file — could not parse.");
        setConfig(null);
      }
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!config) return;
    if (mode === "update" && !targetOrchId) {
      setError("Select the orchestrator to update.");
      return;
    }
    setImporting(true);
    try {
      await orchestratorsApi.importConfig(
        config, mode, mode === "update" ? targetOrchId : undefined
      );
      queryClient.invalidateQueries({ queryKey: ["orchestrators"] });
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["sub-agents"] });
      queryClient.invalidateQueries({ queryKey: ["triggers"] });
      globalToast(
        mode === "create"
          ? "Workflow imported and created successfully"
          : "Workflow updated from config",
        "success"
      );
      onImported();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Import failed");
    } finally {
      setImporting(false);
    }
  }

  const labelStyle: React.CSSProperties = {
    fontSize: "11px", fontWeight: 600, color: "var(--text-muted)",
    textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px",
    display: "block",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: "var(--bg-elevated)", border: "1px solid var(--border-hover)",
        borderRadius: "var(--border-radius-lg, 12px)",
        width: "100%", maxWidth: "560px",
        maxHeight: "85vh", overflow: "hidden",
        display: "flex", flexDirection: "column",
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          padding: "20px 24px 16px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>
              Import workflow config
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
              Create a new workflow or update an existing one from a JSON config file
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-muted)", fontSize: "20px", lineHeight: 1, padding: "2px 6px",
          }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

          {/* File upload */}
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Config file (.json)</label>
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${config ? "rgba(0,200,150,0.4)" : "var(--border-hover)"}`,
                borderRadius: "8px", padding: "20px",
                textAlign: "center", cursor: "pointer",
                background: config ? "var(--accent-dim)" : "var(--bg-overlay)",
                transition: "all 0.15s",
              }}
            >
              {config ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="var(--status-done)" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--status-done)" }}>
                    {fileName}
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    (click to change)
                  </span>
                </div>
              ) : (
                <div>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                    stroke="var(--text-muted)" strokeWidth="1.5"
                    style={{ marginBottom: "8px" }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                    Click to select a workflow JSON file
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                    Exported from AgentFlow — orchestrator + sub-agents + triggers
                  </div>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".json"
              onChange={handleFileChange} style={{ display: "none" }} />
          </div>

          {/* Config preview */}
          {config && (
            <div style={{ marginBottom: "16px" }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: "8px",
              }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Config preview</label>
                <button onClick={() => setPreview(p => !p)} style={{
                  fontSize: "11px", color: "var(--accent)", background: "none",
                  border: "none", cursor: "pointer", fontFamily: "var(--font)",
                }}>
                  {preview ? "Hide" : "Show"} details
                </button>
              </div>

              {/* Summary cards */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "8px" }}>
                {[
                  { label: "Orchestrator", value: config.orchestrator?.name || "—", icon: "🔧" },
                  { label: "Sub-agents",   value: `${(config.sub_agents || []).length} agents`, icon: "🤖" },
                  { label: "Triggers",     value: `${(config.triggers || []).length} triggers`, icon: "⚡" },
                ].map(({ label, value, icon }) => (
                  <div key={label} style={{
                    background: "var(--bg-overlay)", border: "1px solid var(--border)",
                    borderRadius: "8px", padding: "10px 12px",
                  }}>
                    <div style={{ fontSize: "16px", marginBottom: "4px" }}>{icon}</div>
                    <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary)" }}>
                      {value}
                    </div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Sub-agent names */}
              <div style={{
                display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "8px",
              }}>
                {(config.sub_agents || []).map((sa: any, i: number) => (
                  <span key={i} style={{
                    fontSize: "11px", padding: "2px 8px", borderRadius: "10px",
                    background: "var(--bg-overlay)", color: "var(--text-secondary)",
                    border: "1px solid var(--border)",
                  }}>
                    {sa.sub_agent_name}
                  </span>
                ))}
              </div>

              {/* Raw JSON preview */}
              {preview && (
                <pre style={{
                  fontSize: "11px", fontFamily: "var(--font-mono)",
                  color: "var(--text-secondary)", background: "var(--bg-overlay)",
                  border: "1px solid var(--border)", borderRadius: "8px",
                  padding: "10px 12px", overflowX: "auto", maxHeight: "160px",
                  overflowY: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all",
                  margin: 0,
                }}>
                  {JSON.stringify(config, null, 2)}
                </pre>
              )}
            </div>
          )}

          {/* Import mode */}
          {config && (
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Import mode</label>
              <div style={{ display: "flex", gap: "8px" }}>
                {(["create", "update"] as const).map(m => (
                  <button key={m} onClick={() => { setMode(m); setError(""); }} style={{
                    flex: 1, padding: "10px", borderRadius: "8px", cursor: "pointer",
                    border: `1px solid ${mode === m ? "var(--accent)" : "var(--border-hover)"}`,
                    background: mode === m ? "var(--accent-dim)" : "var(--bg-overlay)",
                    color: mode === m ? "var(--accent)" : "var(--text-secondary)",
                    fontFamily: "var(--font)", fontSize: "13px", fontWeight: mode === m ? 600 : 400,
                    transition: "all 0.15s", textAlign: "center",
                  }}>
                    {m === "create" ? (
                      <div>
                        <div>Create new</div>
                        <div style={{ fontSize: "11px", marginTop: "2px", opacity: 0.7 }}>
                          New workflow, sub-agents &amp; orchestrator
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div>Update existing</div>
                        <div style={{ fontSize: "11px", marginTop: "2px", opacity: 0.7 }}>
                          Overwrite prompts &amp; config in place
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Target orchestrator selector — update mode only */}
          {config && mode === "update" && (
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Orchestrator to update</label>
              <select
                value={targetOrchId}
                onChange={e => { setTargetOrchId(e.target.value); setError(""); }}
                style={{
                  width: "100%", padding: "9px 12px",
                  background: "var(--bg-overlay)", border: "1px solid var(--border-hover)",
                  borderRadius: "8px", color: "var(--text-primary)",
                  fontSize: "13px", fontFamily: "var(--font)", outline: "none",
                }}
              >
                <option value="">Select orchestrator to update...</option>
                {(orchestrators || []).map((o: Orchestrator) => (
                  <option key={o.orchestrator_agent_id} value={o.orchestrator_agent_id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                Sub-agents will be matched by name. New sub-agents in the config will be created.
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              padding: "10px 12px", borderRadius: "8px",
              background: "var(--status-failed-dim)",
              border: "1px solid rgba(255,92,92,0.3)",
              fontSize: "12px", color: "var(--status-failed)",
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 24px", borderTop: "1px solid var(--border)",
          display: "flex", gap: "10px", justifyContent: "flex-end",
          flexShrink: 0,
        }}>
          <button onClick={onClose} style={{
            padding: "8px 16px", borderRadius: "8px", fontSize: "13px",
            background: "transparent", border: "1px solid var(--border-hover)",
            color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)",
          }}>
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!config || importing}
            style={{
              padding: "8px 20px", borderRadius: "8px", fontSize: "13px",
              background: !config ? "var(--bg-overlay)" : "var(--accent)",
              border: "none",
              color: !config ? "var(--text-muted)" : "#0A0B0F",
              cursor: !config || importing ? "not-allowed" : "pointer",
              fontWeight: 600, fontFamily: "var(--font)",
              display: "flex", alignItems: "center", gap: "6px",
            }}
          >
            {importing ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2"
                  style={{ animation: "spin 0.8s linear infinite" }}>
                  <polyline points="1 4 1 10 7 10"/>
                  <path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
                </svg>
                Importing...
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                {mode === "create" ? "Create from config" : "Update from config"}
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}