import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { subAgentsApi } from "../api/subAgents";
import { useCanBuild } from "./BuilderOnly";
import type { SubAgent } from "../api/subAgents";
import { AVAILABLE_MODELS, api } from "../api/client";
import { globalToast } from "../hooks/useGlobalToast";
import { formatDateTime } from "../utils/dateTime";

const labelStyle: React.CSSProperties = {
  fontSize: "10px", fontWeight: 600, color: "var(--text-muted)",
  textTransform: "uppercase", letterSpacing: "0.5px",
  marginBottom: "5px", display: "block",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px",
  background: "var(--bg-overlay)", border: "1px solid var(--border-hover)",
  borderRadius: "6px", color: "var(--text-primary)",
  fontSize: "12px", fontFamily: "var(--font)", outline: "none",
  boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };

function parseMcp(raw: string): any[] {
  try { return JSON.parse(raw || "[]"); } catch { return []; }
}

interface Props {
  subAgent: SubAgent;
  onClose: () => void;
}

export default function SubAgentDrawer({ subAgent, onClose }: Props) {
  const canBuild = useCanBuild();
  const queryClient = useQueryClient();

  // ── Live data query — re-fetches after save/sync ──────────────────────────
  const { data: liveData } = useQuery({
    queryKey: ["sub-agent-live", subAgent.sub_agent_id],
    queryFn: () => api.get(`/api/sub-agents/${subAgent.sub_agent_id}`).then(r => r.data),
    initialData: subAgent,
  });
  const live = (liveData as any) || subAgent;

  // ── Edit state ─────────────────────────────────────────────────────────────
  const [editing,      setEditing]      = useState(false);
  const [name,         setName]         = useState(subAgent.sub_agent_name);
  const [modelName,    setModelName]    = useState(subAgent.model_name);
  const [systemPrompt, setSystemPrompt] = useState(subAgent.system_prompt);
  const [mcpServers,   setMcpServers]   = useState(subAgent.mcp_servers || "[]");
  const [mcpError,     setMcpError]     = useState("");

  // ── Versioning state ───────────────────────────────────────────────────────
  const [showHistory,   setShowHistory]   = useState(false);
  const [historyData,   setHistoryData]   = useState<any[]>([]);
  const [historyLoad,   setHistoryLoad]   = useState(false);
  const [syncLoading,   setSyncLoading]   = useState(false);
  const [syncDiff,      setSyncDiff]      = useState<any>(null);
  const [versionView,   setVersionView]   = useState<{sha:string;data:any}|null>(null);
  const [rollbackSha,   setRollbackSha]   = useState<string|null>(null);
  const [rollingBack,   setRollingBack]   = useState(false);

  const updateMutation = useMutation({
    mutationFn: () =>
      subAgentsApi.update(subAgent.sub_agent_id, name, modelName, systemPrompt, mcpServers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sub-agents"] });
      queryClient.invalidateQueries({ queryKey: ["sub-agent-live", subAgent.sub_agent_id] });
      globalToast(`"${name}" updated`);
      setEditing(false);
    },
    onError: () => globalToast("Failed to update sub-agent", "error"),
  });

  function handleSave() {
    try { JSON.parse(mcpServers); setMcpError(""); }
    catch { setMcpError("MCP servers must be valid JSON"); return; }
    updateMutation.mutate();
  }

  function handleCancel() {
    setName(live.sub_agent_name); setModelName(live.model_name);
    setSystemPrompt(live.system_prompt); setMcpServers(live.mcp_servers || "[]");
    setMcpError(""); setEditing(false);
  }

  const mcpList = parseMcp(live.mcp_servers);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,0.5)", backdropFilter: "blur(3px)",
        display: "flex", justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "500px", height: "100%",
          background: "var(--bg-elevated)",
          borderLeft: "1px solid var(--border-hover)",
          display: "flex", flexDirection: "column",
          animation: "slideIn 0.2s ease", overflow: "hidden",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div style={{
          padding: "18px 20px 14px",
          borderBottom: "1px solid var(--border)", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{
                width: "32px", height: "32px", borderRadius: "8px",
                background: "linear-gradient(135deg,#f59e0b,#d97706)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="10" rx="2"/>
                  <circle cx="12" cy="5" r="2"/><path d="M12 7v4"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>
                  {live.sub_agent_name}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "1px", fontFamily: "var(--font-mono)" }}>
                  {live.model_name?.split(".").pop()?.slice(0, 36)}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {!editing && canBuild && (
                <>
                  {/* Sync ↓ */}
                  <button
                    onClick={async () => {
                      setSyncLoading(true); setSyncDiff(null);
                      try {
                        const r = await api.get(`/api/sub-agents/${subAgent.sub_agent_id}/github-sync`);
                        setSyncDiff(r.data);
                        if (!r.data.has_diff && r.data.github_configured)
                          globalToast("Already up to date with GitHub", "info");
                      } catch { globalToast("Sync check failed", "error"); }
                      finally { setSyncLoading(false); }
                    }}
                    disabled={syncLoading}
                    style={{ padding: "6px 12px", borderRadius: "6px", fontSize: "12px", background: "transparent", border: "1px solid var(--border-hover)", color: "var(--accent)", cursor: "pointer", fontFamily: "var(--font)", opacity: syncLoading ? 0.6 : 1 }}
                  >{syncLoading ? "Checking…" : "Sync ↓"}</button>

                  {/* History ↺ */}
                  <button
                    onClick={async () => {
                      setShowHistory(true); setHistoryData([]); setHistoryLoad(true);
                      try {
                        const r = await api.get(`/api/sub-agents/${subAgent.sub_agent_id}/versions`);
                        setHistoryData(r.data.history || []);
                      } catch { globalToast("Could not load history", "error"); }
                      finally { setHistoryLoad(false); }
                    }}
                    style={{ padding: "6px 12px", borderRadius: "6px", fontSize: "12px", background: "transparent", border: "1px solid var(--border-hover)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)" }}
                  >History ↺</button>

                  {/* Edit */}
                  <button
                    onClick={() => {
                      setName(live.sub_agent_name); setModelName(live.model_name);
                      setSystemPrompt(live.system_prompt); setMcpServers(live.mcp_servers || "[]");
                      setEditing(true);
                    }}
                    style={{ padding: "6px 12px", borderRadius: "6px", fontSize: "12px", background: "transparent", border: "1px solid var(--border-hover)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)" }}
                  >Edit</button>
                </>
              )}
              <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "20px", lineHeight: 1, padding: "2px 6px" }}>×</button>
            </div>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>

          {editing ? (
            /* ── Edit form ── */
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "14px" }}>
              <div>
                <label style={labelStyle}>Name</label>
                <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Model</label>
                <select value={modelName} onChange={e => setModelName(e.target.value)} style={selectStyle}>
                  {AVAILABLE_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
                <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "3px", fontFamily: "var(--font-mono)" }}>{modelName}</div>
              </div>
              <div>
                <label style={labelStyle}>System prompt</label>
                <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)}
                  rows={7} style={{ ...inputStyle, resize: "vertical", lineHeight: "1.6" }} />
              </div>
              <div>
                <label style={labelStyle}>MCP servers (JSON)</label>
                <textarea value={mcpServers} onChange={e => { setMcpServers(e.target.value); setMcpError(""); }}
                  rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-mono)", fontSize: "11px" }} />
                {mcpError && <div style={{ fontSize: "11px", color: "var(--status-failed)", marginTop: "3px" }}>{mcpError}</div>}
              </div>
              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <button onClick={handleCancel} style={{ padding: "7px 14px", borderRadius: "6px", fontSize: "12px", background: "transparent", border: "1px solid var(--border-hover)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)" }}>Cancel</button>
                <button onClick={handleSave} disabled={updateMutation.isPending} style={{ padding: "7px 16px", borderRadius: "6px", fontSize: "12px", background: "var(--accent)", border: "none", color: "#0A0B0F", cursor: "pointer", fontWeight: 600, fontFamily: "var(--font)" }}>
                  {updateMutation.isPending ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
          ) : (
            /* ── Read-only view ── */
            <>
              {/* Meta grid */}
              <div style={{ marginBottom: "20px" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "10px" }}>
                  Details
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {[
                    { label: "Model",   value: live.model_name, mono: true },
                    { label: "Created", value: formatDateTime(live.created_at), mono: false },
                  ].map(({ label, value, mono }) => (
                    <div key={label} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                      <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.3px", minWidth: "64px", paddingTop: "1px" }}>{label}</div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontFamily: mono ? "var(--font-mono)" : "var(--font)" }}>{value || "—"}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* System prompt */}
              <div style={{ marginBottom: "20px" }}>
                <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>System prompt</div>
                <div style={{
                  fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.7",
                  background: "var(--bg-overlay)", border: "1px solid var(--border)",
                  borderRadius: "6px", padding: "10px 12px",
                  maxHeight: "220px", overflowY: "auto", whiteSpace: "pre-wrap",
                }}>
                  {live.system_prompt || <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>No system prompt</span>}
                </div>
              </div>

              {/* MCP servers */}
              <div>
                <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                  MCP servers
                  {mcpList.length > 0 && (
                    <span style={{ marginLeft: "8px", fontSize: "10px", color: "var(--accent)", background: "var(--accent-dim)", padding: "1px 7px", borderRadius: "8px", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                      {mcpList.length} attached
                    </span>
                  )}
                </div>
                {mcpList.length === 0 ? (
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>No MCP servers configured</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {mcpList.map((srv: any, i: number) => (
                      <div key={i} style={{ background: "var(--bg-overlay)", border: "1px solid var(--border)", borderRadius: "6px", padding: "8px 10px" }}>
                        <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary)", marginBottom: "2px" }}>
                          {srv.name || srv.url || srv.command || `Server ${i + 1}`}
                        </div>
                        {srv.url && (
                          <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{srv.url}</div>
                        )}
                        {srv.target_prefix && (
                          <div style={{ fontSize: "10px", color: "var(--accent)", marginTop: "2px" }}>prefix: {srv.target_prefix}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Version history popup ── */}
      {showHistory && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setShowHistory(false)}>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px 28px", width: "520px", maxWidth: "92vw", maxHeight: "80vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>Version history — {live.sub_agent_name}</div>
            <div style={{ height: "0.5px", background: "var(--border)", margin: "10px 0 14px" }} />
            {historyLoad ? (
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Loading…</div>
            ) : historyData.length === 0 ? (
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>No versions found. Configure GitHub in Settings to enable versioning.</div>
            ) : historyData.map((v: any, i: number) => (
              <div key={v.sha} style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "8px 0", borderBottom: i < historyData.length - 1 ? "1px solid var(--border)" : "none" }}>
                <code style={{ fontSize: "10px", color: "var(--accent)", background: "var(--accent-dim)", padding: "1px 6px", borderRadius: "4px", flexShrink: 0, marginTop: "2px" }}>{v.short_sha}</code>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "12px", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.message}</div>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>{new Date(v.date).toLocaleString("en-IN")} · {v.author}</div>
                </div>
                <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                  <button onClick={async () => {
                    try { const r = await api.get(`/api/sub-agents/${subAgent.sub_agent_id}/versions/${v.sha}`); setVersionView({ sha: v.sha, data: r.data }); }
                    catch { globalToast("Could not load version", "error"); }
                  }} style={{ padding: "3px 8px", borderRadius: "5px", fontSize: "11px", background: "transparent", border: "1px solid var(--border-hover)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)" }}>View</button>
                  <button onClick={() => { setRollbackSha(v.sha); setShowHistory(false); }}
                    style={{ padding: "3px 8px", borderRadius: "5px", fontSize: "11px", background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.2)", color: "var(--status-failed)", cursor: "pointer", fontFamily: "var(--font)" }}>Rollback</button>
                </div>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
              <button onClick={() => setShowHistory(false)} style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "13px", background: "transparent", border: "1px solid var(--border-hover)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)" }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Version view popup ── */}
      {versionView && (
        <div style={{ position: "fixed", inset: 0, zIndex: 210, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setVersionView(null)}>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px 28px", width: "500px", maxWidth: "92vw", maxHeight: "80vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "12px" }}>
              Version <code style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--accent)" }}>{versionView.sha.slice(0,7)}</code>
            </div>
            {versionView.data.config?.model_name && (
              <div style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "4px" }}>Model</div>
                <code style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{versionView.data.config.model_name}</code>
              </div>
            )}
            <div>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "6px" }}>System prompt</div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", background: "var(--bg-overlay)", border: "1px solid var(--border)", borderRadius: "6px", padding: "10px 12px", whiteSpace: "pre-wrap", lineHeight: "1.7", maxHeight: "240px", overflowY: "auto" }}>{versionView.data.system_prompt || "—"}</div>
            </div>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "16px" }}>
              <button onClick={() => setVersionView(null)} style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "13px", background: "transparent", border: "1px solid var(--border-hover)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)" }}>Close</button>
              <button onClick={() => { setRollbackSha(versionView.sha); setVersionView(null); }} style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "13px", background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.2)", color: "var(--status-failed)", cursor: "pointer", fontFamily: "var(--font)" }}>Rollback to this</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sync diff popup ── */}
      {syncDiff && syncDiff.has_diff && (
        <div style={{ position: "fixed", inset: 0, zIndex: 210, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setSyncDiff(null)}>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px 28px", width: "560px", maxWidth: "92vw", maxHeight: "80vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>GitHub has changes — {live.sub_agent_name}</div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "16px" }}>The following differs between GitHub and Sutra:</div>
            {["model_name","system_prompt"].map(field => {
              const cur = syncDiff.current?.[field] || "";
              const gh  = syncDiff.github?.[field]  || "";
              if (cur === gh) return null;
              return (
                <div key={field} style={{ marginBottom: "12px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "6px" }}>{field}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <div>
                      <div style={{ fontSize: "10px", color: "var(--status-failed)", marginBottom: "3px" }}>Sutra (current)</div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)", background: "var(--bg-overlay)", border: "1px solid var(--border)", borderRadius: "6px", padding: "6px 8px", maxHeight: "100px", overflowY: "auto", whiteSpace: "pre-wrap", fontFamily: field === "system_prompt" ? "var(--font)" : "var(--font-mono)" }}>{cur}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "10px", color: "var(--status-done)", marginBottom: "3px" }}>GitHub (latest)</div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)", background: "var(--bg-overlay)", border: "1px solid rgba(0,200,150,0.2)", borderRadius: "6px", padding: "6px 8px", maxHeight: "100px", overflowY: "auto", whiteSpace: "pre-wrap", fontFamily: field === "system_prompt" ? "var(--font)" : "var(--font-mono)" }}>{gh}</div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "16px" }}>
              <button onClick={() => setSyncDiff(null)} style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "13px", background: "transparent", border: "1px solid var(--border-hover)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)" }}>Cancel</button>
              <button onClick={async () => {
                try {
                  await api.post(`/api/sub-agents/${subAgent.sub_agent_id}/github-sync`);
                  queryClient.invalidateQueries({ queryKey: ["sub-agents"] });
                  queryClient.invalidateQueries({ queryKey: ["sub-agent-live", subAgent.sub_agent_id] });
                  globalToast("Synced from GitHub"); setSyncDiff(null);
                } catch { globalToast("Sync failed", "error"); }
              }} style={{ padding: "8px 20px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, background: "var(--accent)", border: "none", color: "#0A0B0F", cursor: "pointer", fontFamily: "var(--font)" }}>
                Apply GitHub version
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Rollback confirm ── */}
      {rollbackSha && (
        <div style={{ position: "fixed", inset: 0, zIndex: 210, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setRollbackSha(null)}>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px 28px", width: "400px", maxWidth: "92vw" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}>Confirm rollback</div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.6", marginBottom: "20px" }}>
              Restore <strong>{live.sub_agent_name}</strong> to commit{" "}
              <code style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>{rollbackSha?.slice(0,7)}</code>.
              This overwrites the current DynamoDB record.
            </div>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button onClick={() => setRollbackSha(null)} style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "13px", background: "transparent", border: "1px solid var(--border-hover)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)" }}>Cancel</button>
              <button
                disabled={rollingBack}
                onClick={async () => {
                  setRollingBack(true);
                  try {
                    await api.post(`/api/sub-agents/${subAgent.sub_agent_id}/rollback/${rollbackSha}`);
                    queryClient.invalidateQueries({ queryKey: ["sub-agents"] });
                    queryClient.invalidateQueries({ queryKey: ["sub-agent-live", subAgent.sub_agent_id] });
                    setRollbackSha(null); globalToast("Sub-agent rolled back successfully");
                  } catch { globalToast("Rollback failed", "error"); }
                  finally { setRollingBack(false); }
                }}
                style={{ padding: "8px 20px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.3)", color: "var(--status-failed)", cursor: rollingBack ? "not-allowed" : "pointer", fontFamily: "var(--font)", opacity: rollingBack ? 0.6 : 1 }}
              >{rollingBack ? "Rolling back…" : "Confirm rollback"}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
