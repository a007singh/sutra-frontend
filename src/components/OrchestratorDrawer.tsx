import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orchestratorsApi } from "../api/orchestrators";
import { useCanBuild } from "./BuilderOnly";
import ApproverRoutingSection from "./ApproverRoutingSection";
import type { Orchestrator } from "../api/orchestrators";
import { subAgentsApi } from "../api/subAgents";
import type { SubAgent } from "../api/subAgents";
import { workflowsApi } from "../api/workflows";
import { AVAILABLE_MODELS, api } from "../api/client";
import { globalToast } from "../hooks/useGlobalToast";
import OrchestratorStats from "./OrchestratorStats";
import { formatDateTime } from "../utils/dateTime";
import { evaluationsApi } from "../api/evaluations";
import type { TestCase, EvalRun } from "../api/evaluations";

interface TestToolResult {
  name: string;
  description: string;
  required_args: string[];
}
interface TestServerResult {
  server: string;
  status: "ok" | "error";
  tool_count?: number;
  tools?: TestToolResult[];
  error?: string;
}

interface McpServer {
  mcp_server_id:    string;
  name:             string;
  description:      string;
  url:              string;
  transport_type:   string;
  target_prefix:    string;
  auth_type:        string;
  status:           string;
  tools_discovered: string[];
  tool_count:       number;
}

function parseMcpJson(raw: string): any[] {
  try { return JSON.parse(raw || "[]"); } catch { return []; }
}

function mcpServerToConfig(s: McpServer): object {
  return {
    mcp_server_id:  s.mcp_server_id,
    url:            s.url,
    transport_type: s.transport_type,
    target_prefix:  s.target_prefix,
    auth_type:      s.auth_type,
  };
}

function isMcpAttached(s: McpServer, current: any[]): boolean {
  return current.some(c =>
    c.mcp_server_id ? c.mcp_server_id === s.mcp_server_id
                    : c.url === s.url && c.target_prefix === s.target_prefix
  );
}

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

// ── Inline editable sub-agent card ──────────────────────────────────────────
function SubAgentCard({ sa }: { sa: SubAgent }) {
  const canBuild = useCanBuild();
  const queryClient                       = useQueryClient();
  const [expanded, setExpanded]           = useState(false);
  const [editing, setEditing]             = useState(false);
  const [name, setName]                   = useState(sa.sub_agent_name);
  const [modelName, setModelName]         = useState(sa.model_name);
  const [systemPrompt, setSystemPrompt]   = useState(sa.system_prompt);
  const [mcpServers, setMcpServers]       = useState(sa.mcp_servers || "[]");
  const [mcpError, setMcpError]           = useState("");
  const [testing, setTesting]             = useState(false);
  const [testResult, setTestResult]       = useState<{ results: TestServerResult[] } | null>(null);
  const [mcpMode, setMcpMode]             = useState<"toggles" | "json">("toggles");

  const { data: mcpServerList = [] } = useQuery({
    queryKey: ["mcp-servers"],
    queryFn: () => api.get<McpServer[]>("/api/mcp-servers/").then(r => r.data),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      subAgentsApi.update(sa.sub_agent_id, name, modelName, systemPrompt, mcpServers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sub-agents"] });
      globalToast(`"${name}" updated`);
      setEditing(false);
    },
    onError: () => globalToast("Failed to update sub-agent", "error"),
  });

  function handleSave() {
    try { JSON.parse(mcpServers); setMcpError(""); }
    catch { setMcpError("Must be valid JSON"); return; }
    updateMutation.mutate();
  }

  function handleCancel() {
    setName(sa.sub_agent_name); setModelName(sa.model_name);
    setSystemPrompt(sa.system_prompt); setMcpServers(sa.mcp_servers || "[]");
    setMcpError(""); setEditing(false); setTestResult(null);
  }

  async function handleTest() {
    try { JSON.parse(mcpServers); setMcpError(""); }
    catch { setMcpError("Must be valid JSON before testing"); return; }
    setTesting(true); setTestResult(null);
    try {
      // Use /api/mcp-servers/test-raw which applies target_prefix filtering
      const parsed = JSON.parse(mcpServers);
      const res = await api.post("/api/mcp-servers/test-raw", { servers: parsed });
      setTestResult(res.data);
    } catch (e: any) {
      setTestResult({ results: [{ server: "unknown", status: "error", error: e?.response?.data?.detail || "Request failed", tools: [] }] });
    } finally { setTesting(false); }
  }

  return (
    <div style={{
      border: "1px solid var(--border)", borderRadius: "8px",
      overflow: "hidden", background: "var(--bg-overlay)",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: "10px",
        padding: "10px 12px", cursor: "pointer",
      }} onClick={() => { if (!editing) setExpanded(e => !e); }}>
        <div style={{
          width: "28px", height: "28px", borderRadius: "7px",
          background: "linear-gradient(135deg, #f59e0b, #d97706)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <rect x="3" y="11" width="18" height="10" rx="2"/>
            <circle cx="12" cy="5" r="2"/>
            <path d="M12 7v4"/>
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>
            {sa.sub_agent_name}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: "1px" }}>
            {sa.model_name.split(".").pop()?.slice(0, 32)}
          </div>
        </div>
        {canBuild && <button
          onClick={e => { e.stopPropagation(); setExpanded(true); setEditing(true); }}
          style={{
            padding: "4px 10px", borderRadius: "6px", fontSize: "11px",
            background: "transparent", border: "1px solid var(--border-hover)",
            color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)",
          }}
        >Edit</button>}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="var(--text-muted)" strokeWidth="2" style={{
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s", flexShrink: 0,
          }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "10px", background: "var(--bg-surface)" }}>

          {/* Name */}
          <div>
            <label style={labelStyle}>Name</label>
            {editing ? (
              <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
            ) : (
              <div style={{ fontSize: "13px", color: "var(--text-primary)" }}>{sa.sub_agent_name}</div>
            )}
          </div>

          {/* Model */}
          <div>
            <label style={labelStyle}>Model</label>
            {editing ? (
              <>
                <select value={modelName} onChange={e => setModelName(e.target.value)} style={selectStyle}>
                  {AVAILABLE_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
                <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "3px", fontFamily: "var(--font-mono)" }}>{modelName}</div>
              </>
            ) : (
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{sa.model_name}</div>
            )}
          </div>

          {/* System prompt */}
          <div>
            <label style={labelStyle}>System prompt</label>
            {editing ? (
              <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)}
                rows={5} style={{ ...inputStyle, resize: "vertical", lineHeight: "1.6" }} />
            ) : (
              <div style={{
                fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.7",
                background: "var(--bg-elevated)", border: "1px solid var(--border)",
                borderRadius: "6px", padding: "8px 10px",
                maxHeight: "100px", overflowY: "auto",
              }}>{sa.system_prompt}</div>
            )}
          </div>

          {/* MCP servers */}
          <div>
            <label style={labelStyle}>MCP servers</label>
            {editing ? (
              <>
                {/* Mode switcher */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "7px" }}>
                  <div style={{ display: "flex", gap: "4px" }}>
                    {(["toggles", "json"] as const).map(mode => (
                      <button key={mode} type="button" onClick={() => setMcpMode(mode)} style={{
                        padding: "2px 10px", borderRadius: "5px", fontSize: "10px",
                        border: "1px solid var(--border-hover)", cursor: "pointer", fontFamily: "var(--font)",
                        background: mcpMode === mode ? "var(--accent-dim)" : "transparent",
                        color:      mcpMode === mode ? "var(--accent)"     : "var(--text-muted)",
                        fontWeight: mcpMode === mode ? 600 : 400,
                      }}>
                        {mode === "toggles" ? "Pick from registry" : "Raw JSON"}
                      </button>
                    ))}
                  </div>
                  {mcpMode === "toggles" && parseMcpJson(mcpServers).length > 0 && (
                    <span style={{ fontSize: "10px", color: "var(--accent)" }}>
                      {parseMcpJson(mcpServers).length} attached
                    </span>
                  )}
                </div>

                {/* Toggle mode */}
                {mcpMode === "toggles" && (
                  (mcpServerList as McpServer[]).length === 0 ? (
                    <div style={{ padding: "10px", textAlign: "center", background: "var(--bg-overlay)", borderRadius: "5px", fontSize: "11px", color: "var(--text-muted)" }}>
                      No MCP servers registered.{" "}
                      <span style={{ color: "var(--accent)", cursor: "pointer" }} onClick={() => window.dispatchEvent(new CustomEvent("navigate", { detail: "mcp-servers" }))}>
                        Register in MCP servers →
                      </span>
                    </div>
                  ) : (
                    <div style={{ border: "1px solid var(--border)", borderRadius: "6px", overflow: "hidden", background: "var(--bg-overlay)" }}>
                      {(mcpServerList as McpServer[]).map((s, idx) => {
                        const current    = parseMcpJson(mcpServers);
                        const checked    = isMcpAttached(s, current);
                        const isInactive = s.status !== "ACTIVE";
                        return (
                          <div key={s.mcp_server_id} style={{ display: "flex", alignItems: "flex-start", gap: "9px", padding: "8px 10px", borderBottom: idx < (mcpServerList as McpServer[]).length - 1 ? "1px solid var(--border)" : "none", opacity: isInactive ? 0.45 : 1 }}>
                            <label style={{ position: "relative", width: "32px", height: "18px", flexShrink: 0, marginTop: "2px", cursor: isInactive ? "not-allowed" : "pointer" }}>
                              <input type="checkbox" checked={checked} disabled={isInactive}
                                onChange={e => {
                                  const cur  = parseMcpJson(mcpServers);
                                  const next = e.target.checked
                                    ? [...cur, mcpServerToConfig(s)]
                                    : cur.filter((c: any) => c.mcp_server_id ? c.mcp_server_id !== s.mcp_server_id : !(c.url === s.url && c.target_prefix === s.target_prefix));
                                  setMcpServers(JSON.stringify(next));
                                  setTestResult(null);
                                }}
                                style={{ opacity: 0, width: 0, height: 0, position: "absolute" }} />
                              <span style={{ position: "absolute", inset: 0, background: checked ? "var(--accent,#00c896)" : "rgba(128,128,128,0.3)", borderRadius: "18px", transition: ".15s" }}>
                                <span style={{ position: "absolute", width: "12px", height: "12px", left: checked ? "17px" : "3px", top: "3px", background: "#fff", borderRadius: "50%", transition: ".15s" }} />
                              </span>
                            </label>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-primary)" }}>{s.name}</span>
                                {s.tool_count > 0 && <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>{s.tool_count} tools</span>}
                                {isInactive && <span style={{ fontSize: "9px", color: "var(--status-waiting,#f59e0b)" }}>{s.status.toLowerCase()}</span>}
                              </div>
                              {s.tools_discovered.length > 0 && (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "2px", marginTop: "3px" }}>
                                  {s.tools_discovered.slice(0, 4).map(t => (
                                    <span key={t} style={{ padding: "0px 5px", borderRadius: "3px", fontSize: "9px", background: "var(--bg-elevated)", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{t}</span>
                                  ))}
                                  {s.tools_discovered.length > 4 && <span style={{ fontSize: "9px", color: "var(--text-muted)" }}>+{s.tools_discovered.length - 4}</span>}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                )}

                {/* Raw JSON mode */}
                {mcpMode === "json" && (
                  <textarea value={mcpServers}
                    onChange={e => { setMcpServers(e.target.value); setTestResult(null); setMcpError(""); }}
                    rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-mono)", fontSize: "11px" }} />
                )}

                {mcpError && <div style={{ fontSize: "11px", color: "var(--status-failed)", marginTop: "3px" }}>{mcpError}</div>}
              </>
            ) : (
              <pre style={{
                fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-secondary)",
                background: "var(--bg-elevated)", border: "1px solid var(--border)",
                borderRadius: "6px", padding: "8px 10px", margin: 0,
                overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all",
              }}>
                {JSON.stringify(JSON.parse(sa.mcp_servers || "[]"), null, 2)}
              </pre>
            )}

            {/* Test MCP — always visible */}
            <button onClick={handleTest} disabled={testing} style={{
              marginTop: "8px", display: "flex", alignItems: "center", gap: "6px",
              padding: "6px 12px", borderRadius: "6px", fontSize: "12px",
              background: testing ? "var(--accent-dim)" : "transparent",
              border: `1px solid ${testing ? "rgba(0,200,150,0.3)" : "var(--border-hover)"}`,
              color: testing ? "var(--accent)" : "var(--text-secondary)",
              cursor: testing ? "not-allowed" : "pointer", fontFamily: "var(--font)",
            }}>
              {testing ? (
                <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 0.8s linear infinite" }}><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>Testing...</>
              ) : (
                <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>Test MCP connection</>
              )}
            </button>

            {/* Test results */}
            {testResult && (
              <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                {testResult.results.map((r, i) => (
                  <div key={i} style={{
                    border: `1px solid ${r.status === "ok" ? "rgba(0,200,150,0.3)" : "rgba(255,92,92,0.3)"}`,
                    borderLeft: `3px solid ${r.status === "ok" ? "var(--status-done)" : "var(--status-failed)"}`,
                    borderRadius: "6px", overflow: "hidden",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 10px", background: r.status === "ok" ? "var(--status-done-dim)" : "var(--status-failed-dim)" }}>
                      {r.status === "ok"
                        ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--status-done)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--status-failed)" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                      }
                      <span style={{ fontSize: "12px", fontWeight: 600, color: r.status === "ok" ? "var(--status-done)" : "var(--status-failed)" }}>
                        {r.status === "ok" ? `Connected · ${r.tool_count} tools found` : "Connection failed"}
                      </span>
                    </div>
                    {r.status === "error" && r.error && (
                      <div style={{ padding: "6px 10px", fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--status-failed)", background: "var(--bg-overlay)" }}>{r.error}</div>
                    )}
                    {r.status === "ok" && r.tools && r.tools.length > 0 && (
                      <div style={{ maxHeight: "100px", overflowY: "auto" }}>
                        {r.tools.map((t, j) => (
                          <div key={j} style={{ padding: "5px 10px", borderTop: "1px solid var(--border)", display: "flex", gap: "8px" }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" style={{ marginTop: "2px", flexShrink: 0 }}>
                              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                            </svg>
                            <div>
                              <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{t.name}</span>
                              {t.description && <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginTop: "1px" }}>{t.description}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action buttons */}
          {editing && (
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "4px" }}>
              <button onClick={handleCancel} style={{
                padding: "7px 14px", borderRadius: "6px", fontSize: "12px",
                background: "transparent", border: "1px solid var(--border-hover)",
                color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)",
              }}>Cancel</button>
              <button onClick={handleSave} disabled={updateMutation.isPending} style={{
                padding: "7px 16px", borderRadius: "6px", fontSize: "12px",
                background: "var(--accent)", border: "none",
                color: "#0A0B0F", cursor: "pointer", fontWeight: 600, fontFamily: "var(--font)",
              }}>
                {updateMutation.isPending ? "Saving..." : "Save changes"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main drawer ──────────────────────────────────────────────────────────────
interface Props {
  orchestrator: Orchestrator;
  onClose: () => void;
  onEdit: (o: Orchestrator) => void;
}

export default function OrchestratorDrawer({ orchestrator, onClose, onEdit }: Props) {
  const canBuild = useCanBuild();
  const queryClient = useQueryClient();

  const { data: allSubAgents } = useQuery({
    queryKey: ["sub-agents"],
    queryFn: () => subAgentsApi.list().then(r => r.data),
  });

  const { data: workflows } = useQuery({
    queryKey: ["workflows"],
    queryFn: () => workflowsApi.list().then(r => r.data),
  });

  // Live orchestrator data — re-fetches after every save/sync via invalidateQueries
  // so the drawer always shows current values without needing to close and reopen.
  const { data: liveOrch } = useQuery({
    queryKey: ["orchestrator-live", orchestrator.orchestrator_agent_id],
    queryFn: () => api.get(`/api/orchestrators/${orchestrator.orchestrator_agent_id}`)
                      .then(r => r.data),
    initialData: orchestrator,   // render immediately from prop, update after fetch
  });
  // Use live data for display; fall back to prop if query hasn't resolved yet
  const live = (liveOrch as any) || orchestrator;

  // Inline orchestrator field editing
  const [editingOrch, setEditingOrch]     = useState(false);
  const [orchName, setOrchName]           = useState(orchestrator.name);
  const [orchModel, setOrchModel]         = useState(orchestrator.model_id);
  const [orchPrompt, setOrchPrompt]       = useState(orchestrator.system_prompt);
  const [orchAgents, setOrchAgents]       = useState<string[]>(orchestrator.sub_agents || []);
  const [orchMemoryId, setOrchMemoryId]   = useState<string>((orchestrator as any).agentcore_memory_id || "");

  // Versioning state
  const [showHistory,  setShowHistory]  = useState(false);
  const [historyData,  setHistoryData]  = useState<any[]>([]);
  const [historyLoad,  setHistoryLoad]  = useState(false);
  const [syncLoading,  setSyncLoading]  = useState(false);
  const [syncDiff,     setSyncDiff]     = useState<any>(null);
  const [versionView,  setVersionView]  = useState<{sha:string;data:any}|null>(null);
  const [rollbackSha,  setRollbackSha]  = useState<string|null>(null);
  const [rollingBack,  setRollingBack]  = useState(false);

  // ── Evaluations state ─────────────────────────────────────────────────────
  const [showEvals,    setShowEvals]    = useState(false);
  const [evalSuite,    setEvalSuite]    = useState<TestCase[]>([]);
  const [evalRuns,     setEvalRuns]     = useState<EvalRun[]>([]);
  const [evalLoading,  setEvalLoading]  = useState(false);
  const [runningEval,  setRunningEval]  = useState(false);
  const [activeRunId,  setActiveRunId]  = useState<string|null>(null);
  const [showAddTest,  setShowAddTest]  = useState(false);
  // New test case form
  const [tcName,       setTcName]       = useState("");
  const [tcPrompt,     setTcPrompt]     = useState("");
  const [tcContains,   setTcContains]   = useState("");
  const [tcNotContains,setTcNotContains]= useState("");
  const [tcTools,      setTcTools]      = useState("");
  const [tcJudge,      setTcJudge]      = useState("");
  const [tcHITL,       setTcHITL]       = useState("yes");
  const [tcMethod,     setTcMethod]     = useState<"deterministic"|"llm_judge">("llm_judge");

  const updateOrchMutation = useMutation({
    mutationFn: async () => {
      await orchestratorsApi.update(
        orchestrator.orchestrator_agent_id,
        orchName, orchestrator.workflow_id, orchModel, orchPrompt, orchAgents
      );
      // Memory ID is stored separately via PATCH — never goes through PUT update
      // This keeps the existing update path completely untouched
      await api.patch(`/api/orchestrators/${orchestrator.orchestrator_agent_id}/memory`, {
        agentcore_memory_id: orchMemoryId.trim() || "",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orchestrators"] });
      queryClient.invalidateQueries({ queryKey: ["orchestrator-live", orchestrator.orchestrator_agent_id] });
      globalToast("Orchestrator updated");
      setEditingOrch(false);
    },
    onError: () => globalToast("Failed to update orchestrator", "error"),
  });

  const attachedAgents: SubAgent[] = (allSubAgents || []).filter(
    sa => (live.sub_agents || []).includes(sa.sub_agent_id)
  );

  const workflowName = workflows?.find(w => w.workflow_id === live.workflow_id)?.name || "—";

  function toggleAgent(id: string) {
    setOrchAgents(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      background: "rgba(0,0,0,0.5)", backdropFilter: "blur(3px)",
      display: "flex", justifyContent: "flex-end",
    }} onClick={onClose}>
      <div style={{
        width: "520px", height: "100%",
        background: "var(--bg-elevated)",
        borderLeft: "1px solid var(--border-hover)",
        display: "flex", flexDirection: "column",
        animation: "slideIn 0.2s ease",
        overflow: "hidden",
      }} onClick={e => e.stopPropagation()}>

        {/* Drawer header */}
        <div style={{
          padding: "18px 20px 14px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{
                width: "32px", height: "32px", borderRadius: "8px",
                background: "var(--accent-dim)", border: "1px solid rgba(0,200,150,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                  <circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/>
                  <path d="M12 7v4M5 17l7-6 7 6"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>
                  {live.name}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "1px" }}>
                  {workflowName} · {(live.sub_agents || []).length} sub-agents
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              {!editingOrch && canBuild && (
                <>
                  <button
                    onClick={async () => {
                      setSyncLoading(true); setSyncDiff(null);
                      try {
                        const r = await api.get(`/api/orchestrators/${orchestrator.orchestrator_agent_id}/github-sync`);
                        setSyncDiff(r.data);
                        if (!r.data.has_diff && r.data.github_configured) globalToast("Already up to date with GitHub", "info");
                      } catch { globalToast("Sync check failed", "error"); }
                      finally { setSyncLoading(false); }
                    }}
                    disabled={syncLoading}
                    style={{ padding: "6px 12px", borderRadius: "6px", fontSize: "12px", background: "transparent", border: "1px solid var(--border-hover)", color: "var(--accent)", cursor: "pointer", fontFamily: "var(--font)", opacity: syncLoading ? 0.6 : 1 }}
                  >
                    {syncLoading ? "Checking…" : "Sync ↓"}
                  </button>
                  <button
                    onClick={async () => {
                      setShowEvals(true); setEvalLoading(true);
                      try {
                        const [s, r] = await Promise.all([
                          evaluationsApi.getSuite(orchestrator.orchestrator_agent_id),
                          evaluationsApi.listRuns(orchestrator.orchestrator_agent_id),
                        ]);
                        setEvalSuite(s.data.test_cases || []);
                        setEvalRuns(r.data || []);
                      } catch { }
                      finally { setEvalLoading(false); }
                    }}
                    style={{ padding: "6px 12px", borderRadius: "6px", fontSize: "12px", background: "transparent", border: "1px solid var(--border-hover)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)" }}
                  >
                    ⚡ Evals
                  </button>
                  <button
                    onClick={async () => {
                      setShowHistory(true);
                      setHistoryData([]);
                      setHistoryLoad(true);
                      try {
                        const r = await api.get(`/api/orchestrators/${orchestrator.orchestrator_agent_id}/versions`);
                        setHistoryData(r.data.history || []);
                      } catch { globalToast("Could not load version history", "error"); }
                      finally { setHistoryLoad(false); }
                    }}
                    style={{ padding: "6px 12px", borderRadius: "6px", fontSize: "12px", background: "transparent", border: "1px solid var(--border-hover)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)" }}
                  >
                    History ↺
                  </button>
                  <button onClick={() => setEditingOrch(true)} style={{
                    padding: "6px 12px", borderRadius: "6px", fontSize: "12px",
                    background: "transparent", border: "1px solid var(--border-hover)",
                    color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)",
                  }}>
                    Edit orchestrator
                  </button>
                </>
              )}
              <button onClick={onClose} style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--text-muted)", fontSize: "20px", lineHeight: 1, padding: "2px 6px",
              }}>×</button>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>

          {/* ── Orchestrator details section ── */}
          <div style={{ marginBottom: "20px" }}>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "10px" }}>
              Orchestrator
            </div>

            {editingOrch ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "12px" }}>
                <div>
                  <label style={labelStyle}>Name</label>
                  <input value={orchName} onChange={e => setOrchName(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Model</label>
                  <select value={orchModel} onChange={e => setOrchModel(e.target.value)} style={selectStyle}>
                    {AVAILABLE_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "3px", fontFamily: "var(--font-mono)" }}>{orchModel}</div>
                </div>
                <div>
                  <label style={labelStyle}>System prompt</label>
                  <textarea value={orchPrompt} onChange={e => setOrchPrompt(e.target.value)} rows={5} style={{ ...inputStyle, resize: "vertical", lineHeight: "1.6" }} />
                </div>
                <div>
                  <label style={labelStyle}>Attached sub-agents</label>
                  <div style={{ background: "var(--bg-overlay)", border: "1px solid var(--border-hover)", borderRadius: "6px", padding: "8px", maxHeight: "140px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
                    {(allSubAgents || []).map(sa => (
                      <label key={sa.sub_agent_id} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", padding: "3px 4px", borderRadius: "4px", fontSize: "12px" }}>
                        <input type="checkbox" checked={orchAgents.includes(sa.sub_agent_id)} onChange={() => toggleAgent(sa.sub_agent_id)} style={{ accentColor: "var(--accent)" }} />
                        <span style={{ color: "var(--text-primary)" }}>{sa.sub_agent_name}</span>
                        <span style={{ fontSize: "10px", color: "var(--text-muted)", marginLeft: "auto", fontFamily: "var(--font-mono)" }}>{sa.model_name.split(".").pop()?.slice(0, 16)}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>AgentCore Memory ID <span style={{ color: "var(--text-muted)", fontWeight: 400, textTransform: "none" }}>(optional)</span></label>
                  <input
                    value={orchMemoryId}
                    onChange={e => setOrchMemoryId(e.target.value)}
                    placeholder="mem-xxxxxxxxxxxxxxxxxx  (leave blank to disable)"
                    style={{ ...inputStyle, fontFamily: "var(--font-mono)", fontSize: "11px" }}
                  />
                  <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "3px" }}>
                    Run <code style={{ fontFamily: "var(--font-mono)" }}>python setup_agentcore_memory.py</code> to provision and get this ID.
                    Requires <code style={{ fontFamily: "var(--font-mono)" }}>AGENTCORE_MEMORY_ENABLED=true</code> in .env.
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                  <button onClick={() => { setOrchName(orchestrator.name); setOrchModel(orchestrator.model_id); setOrchPrompt(orchestrator.system_prompt); setOrchAgents(orchestrator.sub_agents || []); setOrchMemoryId((orchestrator as any).agentcore_memory_id || ""); setEditingOrch(false); }} style={{ padding: "7px 14px", borderRadius: "6px", fontSize: "12px", background: "transparent", border: "1px solid var(--border-hover)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)" }}>Cancel</button>
                  <button onClick={() => updateOrchMutation.mutate()} disabled={updateOrchMutation.isPending} style={{ padding: "7px 16px", borderRadius: "6px", fontSize: "12px", background: "var(--accent)", border: "none", color: "#0A0B0F", cursor: "pointer", fontWeight: 600, fontFamily: "var(--font)" }}>
                    {updateOrchMutation.isPending ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[
                  { label: "Workflow", value: workflowName },
                  { label: "Model", value: live.model_id.split(".").pop() || live.model_id, mono: true },
                  ...(live.agentcore_memory_id ? [{ label: "Memory ID", value: live.agentcore_memory_id, mono: true }] : []),
                  { label: "Created", value: formatDateTime(live.created_at) },
                ].map(({ label, value, mono }) => (
                  <div key={label} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", minWidth: "72px", paddingTop: "1px", textTransform: "uppercase", letterSpacing: "0.3px", fontSize: "10px", fontWeight: 600 }}>{label}</div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontFamily: mono ? "var(--font-mono)" : "var(--font)" }}>{value}</div>
                  </div>
                ))}
                <div>
                  <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: "5px" }}>System prompt</div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.7", background: "var(--bg-overlay)", border: "1px solid var(--border)", borderRadius: "6px", padding: "8px 10px", maxHeight: "80px", overflowY: "auto" }}>
                    {live.system_prompt}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Performance stats section ── */}
          <div style={{ marginBottom: "20px" }}>
            <div style={{
              fontSize: "11px", fontWeight: 600, color: "var(--text-muted)",
              textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "10px",
            }}>
              Performance
            </div>
            <OrchestratorStats orchestratorId={orchestrator.orchestrator_agent_id} />
          </div>

          {/* ── Attached sub-agents section ── */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px" }}>
                Attached sub-agents ({attachedAgents.length})
              </div>
            </div>

            {attachedAgents.length === 0 ? (
              <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px", background: "var(--bg-overlay)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                No sub-agents attached. Edit the orchestrator to add some.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {attachedAgents.map(sa => (
                  <SubAgentCard key={sa.sub_agent_id} sa={sa} />
                ))}
              </div>
            )}

            {/* Phase 2.5a: approver tagging (operator/admin only; gated inside) */}
            {!editingOrch && (
              <ApproverRoutingSection orchId={orchestrator.orchestrator_agent_id} />
            )}
          </div>
        </div>
      </div>



      {/* ── Evaluations popup ── */}
      {showEvals && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => { setShowEvals(false); setShowAddTest(false); }}>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px 28px", width: "620px", maxWidth: "94vw", maxHeight: "82vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
              <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>
                ⚡ Evaluations — {live.name}
              </div>
              {evalRuns[0] && (
                <span style={{
                  padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 600,
                  background: evalRuns[0].regression ? "rgba(255,92,92,0.12)" : "rgba(0,200,150,0.12)",
                  color: evalRuns[0].regression ? "var(--status-failed)" : "var(--accent)",
                  border: `1px solid ${evalRuns[0].regression ? "rgba(255,92,92,0.2)" : "rgba(0,200,150,0.2)"}`,
                }}>
                  {evalRuns[0].regression ? "⚠️ REGRESSION" : "✅ STABLE"}
                  {" · "}{evalRuns[0].pass_count}/{(evalRuns[0].pass_count||0)+(evalRuns[0].fail_count||0)} passed
                </span>
              )}
            </div>
            <div style={{ height: "0.5px", background: "var(--border)", margin: "10px 0 14px" }} />

            {evalLoading ? (
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Loading…</div>
            ) : (
              <>
                {/* Test cases list */}
                {evalSuite.length === 0 ? (
                  <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px", background: "var(--bg-overlay)", borderRadius: "8px", border: "1px solid var(--border)", marginBottom: "12px" }}>
                    No test cases yet. Add your first test case below.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" }}>
                    {evalSuite.map((tc, i) => {
                      const lastResult = evalRuns[0]?.results?.find(r => r.test_case_id === tc.test_case_id);
                      return (
                        <div key={tc.test_case_id || i} style={{
                          display: "flex", alignItems: "center", gap: "10px",
                          padding: "8px 12px", borderRadius: "8px",
                          background: "var(--bg-overlay)", border: "1px solid var(--border)",
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tc.name}</div>
                            <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tc.input_prompt}</div>
                          </div>
                          {lastResult && (
                            <span style={{
                              padding: "2px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: 600, flexShrink: 0,
                              background: lastResult.status === "PASS" ? "var(--status-done-dim)" : lastResult.status === "PARTIAL" ? "rgba(255,170,0,0.12)" : "var(--status-failed-dim)",
                              color: lastResult.status === "PASS" ? "var(--status-done)" : lastResult.status === "PARTIAL" ? "#FFA500" : "var(--status-failed)",
                            }}>
                              {lastResult.score}/10 {lastResult.status}
                            </span>
                          )}
                          <button
                            onClick={async () => {
                              try {
                                await evaluationsApi.deleteTestCase(orchestrator.orchestrator_agent_id, tc.test_case_id!);
                                setEvalSuite(prev => prev.filter(t => t.test_case_id !== tc.test_case_id));
                              } catch (err: any) { globalToast(err?.response?.data?.detail || "Delete failed", "error"); console.error("deleteTestCase:", err?.response?.data || err); }
                            }}
                            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "14px", lineHeight: 1, padding: "2px 4px", flexShrink: 0 }}
                          >×</button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add test case form */}
                {showAddTest ? (
                  <div style={{ background: "var(--bg-overlay)", border: "1px solid var(--border-hover)", borderRadius: "8px", padding: "12px", marginBottom: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>New test case</div>
                    <input value={tcName} onChange={e => setTcName(e.target.value)} placeholder="Test case name" style={inputStyle} />
                    <textarea value={tcPrompt} onChange={e => setTcPrompt(e.target.value)} placeholder="Input prompt to send to orchestrator" rows={2} style={{ ...inputStyle, resize: "vertical" }} />
                    <input value={tcContains} onChange={e => setTcContains(e.target.value)} placeholder="Output must contain (comma-separated keywords)" style={inputStyle} />
                    <input value={tcNotContains} onChange={e => setTcNotContains(e.target.value)} placeholder="Output must NOT contain (comma-separated)" style={inputStyle} />
                    <input value={tcTools} onChange={e => setTcTools(e.target.value)} placeholder="Sub-agents/tools that must be called (comma-separated)" style={inputStyle} />
                    <select value={tcMethod} onChange={e => setTcMethod(e.target.value as any)} style={selectStyle}>
                      <option value="llm_judge">LLM-as-judge (Claude Haiku scores 0-10)</option>
                      <option value="deterministic">Deterministic only (keyword matching)</option>
                    </select>
                    {tcMethod === "llm_judge" && (
                      <textarea value={tcJudge} onChange={e => setTcJudge(e.target.value)} placeholder="Judge prompt: describe what a good response looks like..." rows={2} style={{ ...inputStyle, resize: "vertical" }} />
                    )}
                    <input value={tcHITL} onChange={e => setTcHITL(e.target.value)} placeholder="HITL auto-response (e.g. yes / no)" style={inputStyle} />
                    <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                      <button onClick={() => setShowAddTest(false)} style={{ padding: "6px 12px", borderRadius: "6px", fontSize: "12px", background: "transparent", border: "1px solid var(--border-hover)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)" }}>Cancel</button>
                      <button onClick={async () => {
                        if (!tcName.trim() || !tcPrompt.trim()) { globalToast("Name and prompt are required", "error"); return; }
                        const splitTrim = (s: string) => s.split(",").map(x => x.trim()).filter(Boolean);
                        try {
                          const res = await evaluationsApi.addTestCase(orchestrator.orchestrator_agent_id, {
                            name:              tcName.trim(),
                            input_prompt:      tcPrompt.trim(),
                            expected:          { output_contains: splitTrim(tcContains), output_not_contains: splitTrim(tcNotContains), tools_called: splitTrim(tcTools), completed: true },
                            scoring_method:    tcMethod,
                            judge_prompt:      tcJudge.trim(),
                            hitl_auto_response: tcHITL.trim() || "yes",
                          });
                          // Re-fetch suite from backend to get the exact stored record
                          const refreshed = await evaluationsApi.getSuite(orchestrator.orchestrator_agent_id);
                          setEvalSuite(refreshed.data.test_cases || []);
                          setTcName(""); setTcPrompt(""); setTcContains(""); setTcNotContains(""); setTcTools(""); setTcJudge(""); setTcHITL("yes"); setTcMethod("llm_judge");
                          setShowAddTest(false);
                          globalToast("Test case added");
                        } catch (err: any) {
                          const msg = err?.response?.data?.detail || err?.message || String(err);
                          globalToast(`Add failed: ${msg}`, "error");
                          console.error("addTestCase error:", err?.response?.data || err);
                        }
                      }} style={{ padding: "6px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: 600, background: "var(--accent)", border: "none", color: "#0A0B0F", cursor: "pointer", fontFamily: "var(--font)" }}>
                        Add test case
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowAddTest(true)} style={{ width: "100%", padding: "8px", borderRadius: "8px", fontSize: "12px", background: "transparent", border: "1px dashed var(--border-hover)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)", marginBottom: "12px" }}>
                    + Add test case
                  </button>
                )}

                {/* Last run results (if any) */}
                {evalRuns.length > 0 && evalRuns[0].status === "COMPLETED" && evalRuns[0].results?.length > 0 && (
                  <div style={{ marginBottom: "12px" }}>
                    <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
                      Last run — {new Date(evalRuns[0].created_at).toLocaleString("en-IN")}
                    </div>
                    {evalRuns[0].results.map((r, i) => (
                      <div key={i} style={{ padding: "6px 10px", borderRadius: "6px", border: `1px solid ${r.status === "PASS" ? "rgba(0,200,150,0.2)" : "rgba(255,92,92,0.2)"}`, background: r.status === "PASS" ? "var(--status-done-dim)" : "var(--status-failed-dim)", marginBottom: "4px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "12px", color: "var(--text-primary)" }}>{r.status === "PASS" ? "✅" : "❌"} {r.test_case_name}</span>
                          <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: r.status === "PASS" ? "var(--status-done)" : "var(--status-failed)" }}>{r.score}/10</span>
                        </div>
                        {r.reason && <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>{r.reason}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Running indicator */}
                {activeRunId && evalRuns[0]?.status === "RUNNING" && (
                  <div style={{ padding: "10px", borderRadius: "8px", background: "var(--accent-dim)", border: "1px solid rgba(0,200,150,0.2)", fontSize: "12px", color: "var(--accent)", marginBottom: "12px", textAlign: "center" }}>
                    ⏳ Evaluation running… test cases executing sequentially
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                  <button onClick={() => { setShowEvals(false); setShowAddTest(false); }} style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "13px", background: "transparent", border: "1px solid var(--border-hover)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)" }}>Close</button>
                  <button
                    disabled={evalSuite.length === 0 || runningEval}
                    onClick={async () => {
                      setRunningEval(true);
                      try {
                        const res = await evaluationsApi.runEvaluation(orchestrator.orchestrator_agent_id);
                        const runId = res.data.eval_run_id;
                        setActiveRunId(runId);
                        globalToast(`Evaluation started — ${res.data.test_case_count} test cases`);
                        // Poll for completion every 5s
                        const poll = setInterval(async () => {
                          try {
                            const run = await evaluationsApi.getRun(runId);
                            if (run.data.status !== "RUNNING") {
                              clearInterval(poll);
                              setEvalRuns(prev => [run.data, ...prev.filter(r => r.eval_run_id !== runId)]);
                              setRunningEval(false);
                              setActiveRunId(null);
                              globalToast(`Eval complete: ${run.data.pass_count}/${(run.data.pass_count||0)+(run.data.fail_count||0)} passed`, run.data.regression ? "error" : "info");
                            }
                          } catch { clearInterval(poll); setRunningEval(false); }
                        }, 5000);
                      } catch (e: any) {
                        globalToast((e as any)?.response?.data?.detail || (e as any)?.message || "Failed to start evaluation", "error"); console.error("runEval error:", (e as any)?.response?.data || e);
                        setRunningEval(false);
                      }
                    }}
                    style={{ padding: "8px 20px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, background: evalSuite.length === 0 || runningEval ? "var(--bg-overlay)" : "var(--accent)", border: "none", color: evalSuite.length === 0 || runningEval ? "var(--text-muted)" : "#0A0B0F", cursor: evalSuite.length === 0 || runningEval ? "not-allowed" : "pointer", fontFamily: "var(--font)" }}
                  >
                    {runningEval ? "Running…" : "▶ Run evaluation"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Version history popup ── */}
      {showHistory && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setShowHistory(false)}>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px 28px", width: "520px", maxWidth: "92vw", maxHeight: "80vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
              Version history — {live.name}
            </div>
            <div style={{ height: "0.5px", background: "var(--border)", margin: "10px 0 14px" }} />
            {historyLoad ? (
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Loading…</div>
            ) : historyData.length === 0 ? (
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                No versions found. Configure GitHub in Settings to enable versioning.
              </div>
            ) : historyData.map((v: any, i: number) => (
              <div key={v.sha} style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "8px 0", borderBottom: i < historyData.length - 1 ? "1px solid var(--border)" : "none" }}>
                <code style={{ fontSize: "10px", color: "var(--accent)", background: "var(--accent-dim)", padding: "1px 6px", borderRadius: "4px", flexShrink: 0, marginTop: "2px" }}>{v.short_sha}</code>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "12px", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.message}</div>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>{new Date(v.date).toLocaleString("en-IN")} · {v.author}</div>
                </div>
                <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                  <button
                    onClick={async () => {
                      try {
                        const r = await api.get(`/api/orchestrators/${orchestrator.orchestrator_agent_id}/versions/${v.sha}`);
                        setVersionView({ sha: v.sha, data: r.data });
                      } catch { globalToast("Could not load version", "error"); }
                    }}
                    style={{ padding: "3px 8px", borderRadius: "5px", fontSize: "11px", background: "transparent", border: "1px solid var(--border-hover)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)" }}
                  >View</button>
                  <button
                    onClick={() => { setRollbackSha(v.sha); setShowHistory(false); }}
                    style={{ padding: "3px 8px", borderRadius: "5px", fontSize: "11px", background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.2)", color: "var(--status-failed)", cursor: "pointer", fontFamily: "var(--font)" }}
                  >Rollback</button>
                </div>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
              <button onClick={() => setShowHistory(false)} style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "13px", background: "transparent", border: "1px solid var(--border-hover)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)" }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sync diff popup ── */}
      {syncDiff && syncDiff.has_diff && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setSyncDiff(null)}>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px 28px", width: "560px", maxWidth: "92vw", maxHeight: "80vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>GitHub has changes</div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "16px" }}>The following differs between GitHub and Sutra:</div>
            {["model_id", "system_prompt"].map(field => {
              const cur = syncDiff.current?.[field] || "";
              const gh  = syncDiff.github?.[field] || "";
              if (cur === gh) return null;
              return (
                <div key={field} style={{ marginBottom: "12px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "6px" }}>{field}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <div>
                      <div style={{ fontSize: "10px", color: "var(--status-failed)", marginBottom: "3px" }}>Sutra (current)</div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)", background: "var(--bg-overlay)", border: "1px solid var(--border)", borderRadius: "6px", padding: "6px 8px", maxHeight: "120px", overflowY: "auto", fontFamily: field === "system_prompt" ? "var(--font)" : "var(--font-mono)", whiteSpace: "pre-wrap" }}>{cur}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "10px", color: "var(--status-done)", marginBottom: "3px" }}>GitHub (latest)</div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)", background: "var(--bg-overlay)", border: "1px solid rgba(0,200,150,0.2)", borderRadius: "6px", padding: "6px 8px", maxHeight: "120px", overflowY: "auto", fontFamily: field === "system_prompt" ? "var(--font)" : "var(--font-mono)", whiteSpace: "pre-wrap" }}>{gh}</div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "16px" }}>
              <button onClick={() => setSyncDiff(null)} style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "13px", background: "transparent", border: "1px solid var(--border-hover)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)" }}>Cancel</button>
              <button onClick={async () => {
                try {
                  await api.post(`/api/orchestrators/${orchestrator.orchestrator_agent_id}/github-sync`);
                  queryClient.invalidateQueries({ queryKey: ["orchestrators"] });
                  queryClient.invalidateQueries({ queryKey: ["orchestrator-live", orchestrator.orchestrator_agent_id] });
                  globalToast("Synced from GitHub");
                  setSyncDiff(null);
                } catch { globalToast("Sync failed", "error"); }
              }} style={{ padding: "8px 20px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, background: "var(--accent)", border: "none", color: "#0A0B0F", cursor: "pointer", fontFamily: "var(--font)" }}>
                Apply GitHub version
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Version view popup ── */}
      {versionView && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setVersionView(null)}>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px 28px", width: "520px", maxWidth: "92vw", maxHeight: "80vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>Version <code style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--accent)" }}>{versionView.sha.slice(0,7)}</code></div>
            <div style={{ height: "0.5px", background: "var(--border)", margin: "10px 0 14px" }} />
            {["model_id","model_name"].filter(k => versionView.data.config?.[k]).slice(0,1).map(k => (
              <div key={k} style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "4px" }}>Model</div>
                <code style={{ fontSize: "12px", color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{versionView.data.config[k]}</code>
              </div>
            ))}
            <div>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "6px" }}>System prompt</div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", background: "var(--bg-overlay)", border: "1px solid var(--border)", borderRadius: "6px", padding: "10px 12px", whiteSpace: "pre-wrap", lineHeight: "1.7", maxHeight: "260px", overflowY: "auto" }}>
                {versionView.data.system_prompt || "—"}
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "16px" }}>
              <button onClick={() => setVersionView(null)} style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "13px", background: "transparent", border: "1px solid var(--border-hover)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)" }}>Close</button>
              <button onClick={() => { setRollbackSha(versionView.sha); setVersionView(null); }} style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "13px", background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.2)", color: "var(--status-failed)", cursor: "pointer", fontFamily: "var(--font)" }}>Rollback to this version</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Rollback confirmation ── */}
      {rollbackSha && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setRollbackSha(null)}>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px 28px", width: "420px", maxWidth: "92vw" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}>Confirm rollback</div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.6", marginBottom: "20px" }}>
              This will restore the orchestrator config from commit <code style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>{rollbackSha?.slice(0,7)}</code> and overwrite the current DynamoDB record. A new commit will be created to record the rollback.
            </div>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button onClick={() => setRollbackSha(null)} style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "13px", background: "transparent", border: "1px solid var(--border-hover)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)" }}>Cancel</button>
              <button
                disabled={rollingBack}
                onClick={async () => {
                  setRollingBack(true);
                  try {
                    await api.post(`/api/orchestrators/${orchestrator.orchestrator_agent_id}/rollback/${rollbackSha}`);
                    queryClient.invalidateQueries({ queryKey: ["orchestrators"] });
                    queryClient.invalidateQueries({ queryKey: ["orchestrator-live", orchestrator.orchestrator_agent_id] });
                    setHistoryData([]);
                    setRollbackSha(null);
                    setShowHistory(false);
                    globalToast("Rolled back successfully");
                  } catch { globalToast("Rollback failed", "error"); }
                  finally { setRollingBack(false); }
                }}
                style={{ padding: "8px 20px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.3)", color: "var(--status-failed)", cursor: rollingBack ? "not-allowed" : "pointer", fontFamily: "var(--font)", opacity: rollingBack ? 0.6 : 1 }}
              >
                {rollingBack ? "Rolling back…" : "Confirm rollback"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}