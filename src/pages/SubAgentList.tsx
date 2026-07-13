import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { subAgentsApi } from "../api/subAgents";
import type { SubAgent } from "../api/subAgents";
import PageHeader from "../components/PageHeader";
import { useCanBuild } from "../components/BuilderOnly";
import DataTable from "../components/DataTable";
import FormModal from "../components/FormModal";
import ConfirmModal from "../components/ConfirmModal";
import Field, { inputCss, selectCss } from "../components/Field";
import Badge from "../components/Badge";
import { AVAILABLE_MODELS } from "../api/client";
import { globalToast } from "../hooks/useGlobalToast";
import { api } from "../api/client";
import PromptLibrary from "../components/PromptLibrary";
import { formatDate } from "../utils/dateTime";
import SubAgentDrawer from "../components/SubAgentDrawer";

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

interface TestResult {
  results: TestServerResult[];
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
    mcp_server_id:  s.mcp_server_id,   // unique key — URL alone is not unique (shared Gateway)
    url:            s.url,
    transport_type: s.transport_type,
    target_prefix:  s.target_prefix,
    auth_type:      s.auth_type,
  };
}

const editBtnStyle: React.CSSProperties = {
  padding: "5px 12px", borderRadius: "6px", fontSize: "12px",
  background: "transparent", border: "1px solid var(--border-hover)",
  color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)",
};

const deleteBtnStyle: React.CSSProperties = {
  padding: "5px 12px", borderRadius: "6px", fontSize: "12px",
  background: "var(--status-failed-dim)",
  border: "1px solid rgba(255,92,92,0.3)",
  color: "var(--status-failed)", cursor: "pointer", fontFamily: "var(--font)",
};

export default function SubAgentList() {
  const canBuild = useCanBuild();
  const queryClient = useQueryClient();

  const [showForm, setShowForm]         = useState(false);
  const [editing, setEditing]           = useState<SubAgent | null>(null);
  const [deleting, setDeleting]         = useState<SubAgent | null>(null);
  const [name, setName]                 = useState("");
  const [modelName, setModelName]       = useState("anthropic.claude-3-5-sonnet-20241022-v2:0");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [mcpServers, setMcpServers]     = useState("[]");
  const [mcpError, setMcpError]         = useState("");
  const [testing, setTesting]           = useState(false);
  const [testResult, setTestResult]     = useState<TestResult | null>(null);
  const [showPromptLib, setShowPromptLib] = useState(false);
  const [mcpMode, setMcpMode] = useState<"toggles" | "json">("toggles");
  const [viewing, setViewing] = useState<SubAgent | null>(null);

  // Versioning state
  const [historyAgent,   setHistoryAgent]   = useState<SubAgent | null>(null);
  const [historyData,    setHistoryData]    = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [syncAgent,      setSyncAgent]      = useState<SubAgent | null>(null);
  const [syncDiffData,   setSyncDiffData]   = useState<any>(null);
  const [syncLoading,    setSyncLoading]    = useState(false);
  const [versionViewSA,  setVersionViewSA]  = useState<{sha:string;data:any}|null>(null);
  const [rollbackShaSA,  setRollbackShaSA]  = useState<string|null>(null);
  const [rollingBackSA,  setRollingBackSA]  = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["sub-agents"],
    queryFn: () => subAgentsApi.list().then(r => r.data),
  });

  const { data: mcpServerList = [] } = useQuery({
    queryKey: ["mcp-servers"],
    queryFn: () => api.get<McpServer[]>("/api/mcp-servers/").then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => subAgentsApi.create(name, modelName, systemPrompt, mcpServers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sub-agents"] });
      globalToast("Sub-agent created");
      reset();
    },
    onError: () => globalToast("Failed to create sub-agent", "error"),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      subAgentsApi.update(editing!.sub_agent_id, name, modelName, systemPrompt, mcpServers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sub-agents"] });
      globalToast("Sub-agent updated");
      reset();
    },
    onError: () => globalToast("Failed to update sub-agent", "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => subAgentsApi.delete(deleting!.sub_agent_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sub-agents"] });
      globalToast("Sub-agent deleted");
      setDeleting(null);
    },
    onError: () => globalToast("Failed to delete sub-agent", "error"),
  });

  function openCreate() {
    setEditing(null); setName("");
    setModelName("anthropic.claude-3-5-sonnet-20241022-v2:0");
    setSystemPrompt(""); setMcpServers("[]");
    setMcpError(""); setTestResult(null); setMcpMode("toggles"); setShowForm(true);
  }

  function openEdit(s: SubAgent) {
    setEditing(s); setName(s.sub_agent_name); setModelName(s.model_name);
    setSystemPrompt(s.system_prompt); setMcpServers(s.mcp_servers || "[]");
    setMcpError(""); setTestResult(null); setMcpMode("toggles"); setShowForm(true);
  }

  function reset() {
    setShowForm(false); setEditing(null); setName(""); setSystemPrompt("");
    setMcpServers("[]"); setMcpError(""); setTestResult(null);
  }

  function handleSubmit() {
    if (!name.trim()) return;
    try { JSON.parse(mcpServers); setMcpError(""); }
    catch { setMcpError("Must be valid JSON"); return; }
    editing ? updateMutation.mutate() : createMutation.mutate();
  }

  async function handleTestMcp() {
    try { JSON.parse(mcpServers); }
    catch { setMcpError("Must be valid JSON before testing"); return; }
    setTesting(true); setTestResult(null);
    try {
      // Use /api/mcp-servers/test-raw which applies target_prefix filtering
      // (same as agent_backend) so results match what the agent actually sees
      const parsed = JSON.parse(mcpServers);
      const res = await api.post("/api/mcp-servers/test-raw", { servers: parsed });
      setTestResult(res.data);
    } catch (e: any) {
      setTestResult({
        results: [{
          server: "unknown", status: "error",
          error: e?.response?.data?.detail || "Request failed",
          tools: [],
        }],
      });
    } finally {
      setTesting(false);
    }
  }

  const columns = [
    {
      key: "name", label: "Name",
      render: (s: SubAgent) => (
        <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>
          {s.sub_agent_name}
        </span>
      ),
    },
    {
      key: "model", label: "Model",
      render: (s: SubAgent) => (
        <span style={{
          fontSize: "12px", fontFamily: "var(--font-mono)",
          color: "var(--text-secondary)",
        }}>
          {s.model_name}
        </span>
      ),
    },
    {
      key: "mcp", label: "MCP servers", width: "120px",
      render: (s: SubAgent) => {
        try {
          const n = JSON.parse(s.mcp_servers || "[]").length;
          return (
            <Badge variant={n > 0 ? "accent" : "default"}>
              {n} server{n !== 1 ? "s" : ""}
            </Badge>
          );
        } catch { return <Badge>—</Badge>; }
      },
    },
    {
      key: "date", label: "Created", width: "120px",
      render: (s: SubAgent) => (
        <span style={{
          color: "var(--text-muted)", fontSize: "12px",
          fontFamily: "var(--font-mono)",
        }}>
          {formatDate(s.created_at)}
        </span>
      ),
    },
    {
      key: "action", label: "", width: "260px",
      render: (s: SubAgent) => (
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <button onClick={() => setViewing(s)} style={{
            padding: "5px 12px", borderRadius: "6px", fontSize: "12px",
            background: "var(--accent-dim)", border: "1px solid rgba(0,200,150,0.2)",
            color: "var(--accent)", cursor: "pointer", fontFamily: "var(--font)",
          }}>View</button>
          {canBuild && <button onClick={() => openEdit(s)} style={editBtnStyle}>Edit</button>}
          {canBuild && <button
            onClick={async () => {
              setHistoryAgent(s); setHistoryData([]); setHistoryLoading(true);
              try {
                const r = await api.get(`/api/sub-agents/${s.sub_agent_id}/versions`);
                setHistoryData(r.data.history || []);
              } catch { globalToast("Could not load history", "error"); }
              finally { setHistoryLoading(false); }
            }}
            style={{ ...editBtnStyle, color: "var(--accent)", borderColor: "rgba(0,200,150,0.3)", background: "var(--accent-dim)" }}
          >History ↺</button>}
          {canBuild && <button
            onClick={async () => {
              setSyncAgent(s); setSyncLoading(true); setSyncDiffData(null);
              try {
                const r = await api.get(`/api/sub-agents/${s.sub_agent_id}/github-sync`);
                setSyncDiffData(r.data);
                if (!r.data.has_diff && r.data.github_configured) globalToast("Already up to date with GitHub", "info");
              } catch { globalToast("Sync check failed", "error"); }
              finally { setSyncLoading(false); }
            }}
            style={{ ...editBtnStyle, fontSize: "11px", padding: "4px 8px" }}
          >{syncLoading && syncAgent?.sub_agent_id === s.sub_agent_id ? "…" : "Sync ↓"}</button>}
          {canBuild && <button onClick={() => setDeleting(s)} style={deleteBtnStyle}>Delete</button>}
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: "28px 32px" }}>
      <PageHeader
        title="Sub-agents"
        subtitle="Specialized agents with tools and instructions"
        action={canBuild ? { label: "New sub-agent", onClick: openCreate } : undefined}
      />

      <DataTable
        columns={columns} data={data} isLoading={isLoading}
        rowKey={s => s.sub_agent_id} emptyMessage="No sub-agents yet."
      />

      {showForm && (
        <FormModal
          title={editing ? "Edit sub-agent" : "New sub-agent"}
          onClose={reset} onSubmit={handleSubmit}
          submitLabel={editing ? "Save" : "Create"}
        >
          <Field label="Name">
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. HR Document Agent" style={inputCss} />
          </Field>

          <Field label="Model">
            <select value={modelName} onChange={e => setModelName(e.target.value)}
              style={selectCss}>
              {AVAILABLE_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            <div style={{
              fontSize: "11px", color: "var(--text-muted)",
              marginTop: "4px", fontFamily: "var(--font-mono)",
            }}>
              {modelName}
            </div>
          </Field>

          <Field label="System prompt">
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "5px" }}>
              <button
                type="button"
                onClick={() => setShowPromptLib(true)}
                style={{
                  display: "flex", alignItems: "center", gap: "5px",
                  padding: "3px 10px", borderRadius: "5px", fontSize: "11px",
                  background: "var(--accent-dim)", border: "1px solid rgba(0,200,150,0.25)",
                  color: "var(--accent)", cursor: "pointer", fontFamily: "var(--font)",
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
                Browse library
              </button>
            </div>
            <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)}
              placeholder="You are a specialist agent that..." rows={4}
              style={{ ...inputCss, resize: "vertical" }} />
          </Field>

          <Field label="MCP servers" error={mcpError}>
            {/* Mode switcher */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <div style={{ display: "flex", gap: "4px" }}>
                {(["toggles", "json"] as const).map(mode => (
                  <button key={mode} type="button" onClick={() => setMcpMode(mode)} style={{
                    padding: "3px 12px", borderRadius: "6px", fontSize: "11px",
                    border: "1px solid var(--border-hover)", cursor: "pointer",
                    fontFamily: "var(--font)",
                    background: mcpMode === mode ? "var(--accent-dim)" : "transparent",
                    color:      mcpMode === mode ? "var(--accent)"     : "var(--text-muted)",
                    fontWeight: mcpMode === mode ? 600 : 400,
                  }}>
                    {mode === "toggles" ? "Pick from registry" : "Raw JSON"}
                  </button>
                ))}
              </div>
              {mcpMode === "toggles" && parseMcpJson(mcpServers).length > 0 && (
                <span style={{ fontSize: "11px", color: "var(--accent)" }}>
                  {parseMcpJson(mcpServers).length} attached
                </span>
              )}
            </div>

            {/* Toggle mode */}
            {mcpMode === "toggles" && (
              (mcpServerList as McpServer[]).length === 0 ? (
                <div style={{ padding: "12px", textAlign: "center", background: "var(--bg-elevated,rgba(128,128,128,0.06))", borderRadius: "var(--radius)", fontSize: "12px", color: "var(--text-muted)" }}>
                  No MCP servers registered yet.{" "}
                  <span style={{ color: "var(--accent)", cursor: "pointer" }}
                    onClick={() => window.dispatchEvent(new CustomEvent("navigate", { detail: "settings" }))}>
                    Register in Settings →
                  </span>
                </div>
              ) : (
                <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
                  {(mcpServerList as McpServer[]).map((s, idx) => {
                    const current    = parseMcpJson(mcpServers);
                    const checked    = current.some((c: any) =>
                      c.mcp_server_id ? c.mcp_server_id === s.mcp_server_id
                                      : c.url === s.url && c.target_prefix === s.target_prefix);
                    const isInactive = s.status !== "ACTIVE";
                    return (
                      <div key={s.mcp_server_id} style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "9px 12px", borderBottom: idx < (mcpServerList as McpServer[]).length - 1 ? "1px solid var(--border)" : "none", opacity: isInactive ? 0.45 : 1 }}>
                        {/* Toggle */}
                        <label style={{ position: "relative", width: "34px", height: "19px", flexShrink: 0, marginTop: "2px", cursor: isInactive ? "not-allowed" : "pointer" }}>
                          <input type="checkbox" checked={checked} disabled={isInactive}
                            onChange={e => {
                              const cur = parseMcpJson(mcpServers);
                              const next = e.target.checked
                                ? [...cur, mcpServerToConfig(s)]
                                : cur.filter((c: any) =>
                                    c.mcp_server_id ? c.mcp_server_id !== s.mcp_server_id
                                                    : !(c.url === s.url && c.target_prefix === s.target_prefix));
                              setMcpServers(JSON.stringify(next));
                              setTestResult(null);
                            }}
                            style={{ opacity: 0, width: 0, height: 0, position: "absolute" }} />
                          <span style={{ position: "absolute", inset: 0, background: checked ? "var(--accent,#00c896)" : "rgba(128,128,128,0.3)", borderRadius: "19px", transition: ".15s" }}>
                            <span style={{ position: "absolute", width: "13px", height: "13px", left: checked ? "18px" : "3px", top: "3px", background: "#fff", borderRadius: "50%", transition: ".15s" }} />
                          </span>
                        </label>
                        {/* Info */}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary)" }}>{s.name}</span>
                            {s.tool_count > 0 && <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>{s.tool_count} tools</span>}
                            {isInactive && <span style={{ fontSize: "10px", color: "var(--status-waiting,#f59e0b)" }}>{s.status.toLowerCase()}</span>}
                          </div>
                          {s.description && <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "1px" }}>{s.description}</div>}
                          {s.tools_discovered.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "3px", marginTop: "4px" }}>
                              {s.tools_discovered.slice(0, 4).map(t => (
                                <span key={t} style={{ padding: "1px 6px", borderRadius: "4px", fontSize: "10px", background: "var(--bg-overlay,rgba(128,128,128,0.1))", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{t}</span>
                              ))}
                              {s.tools_discovered.length > 4 && <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>+{s.tools_discovered.length - 4}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* Raw JSON mode — original textarea + test button */}
            {mcpMode === "json" && (
              <>
                <textarea value={mcpServers}
                  onChange={e => { setMcpServers(e.target.value); setTestResult(null); }}
                  rows={3} style={{ ...inputCss, resize: "vertical", fontFamily: "var(--font-mono)", fontSize: "12px" }} />
                <button type="button" onClick={handleTestMcp}
                  disabled={testing || mcpServers === "[]"}
                  style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "var(--radius)", background: testing ? "var(--accent-dim)" : "transparent", border: `1px solid ${testing ? "rgba(0,200,150,0.3)" : "var(--border-hover)"}`, color: testing ? "var(--accent)" : "var(--text-secondary)", fontSize: "12px", cursor: testing || mcpServers === "[]" ? "not-allowed" : "pointer", fontFamily: "var(--font)", transition: "all 0.15s", opacity: mcpServers === "[]" ? 0.4 : 1 }}>
                  {testing ? (
                    <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 0.8s linear infinite" }}><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>Testing...</>
                  ) : (
                    <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>Test connection</>
                  )}
                </button>
              </>
            )}
          </Field>

          {testResult && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {testResult.results.map((r, i) => (
                <div key={i} style={{
                  border: `1px solid ${r.status === "ok"
                    ? "rgba(0,200,150,0.3)" : "rgba(255,92,92,0.3)"}`,
                  borderLeft: `3px solid ${r.status === "ok"
                    ? "var(--status-done)" : "var(--status-failed)"}`,
                  borderRadius: "var(--radius)", overflow: "hidden",
                }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    padding: "8px 12px",
                    background: r.status === "ok"
                      ? "var(--status-done-dim)" : "var(--status-failed-dim)",
                  }}>
                    {r.status === "ok" ? (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                        stroke="var(--status-done)" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                        stroke="var(--status-failed)" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="15" y1="9" x2="9" y2="15"/>
                        <line x1="9" y1="9" x2="15" y2="15"/>
                      </svg>
                    )}
                    <span style={{
                      fontSize: "12px", fontWeight: 600, flex: 1,
                      color: r.status === "ok"
                        ? "var(--status-done)" : "var(--status-failed)",
                    }}>
                      {r.status === "ok"
                        ? `Connected · ${r.tool_count} tool${r.tool_count !== 1 ? "s" : ""} found`
                        : "Connection failed"}
                    </span>
                    <span style={{
                      fontSize: "10px", color: "var(--text-muted)",
                      fontFamily: "var(--font-mono)", maxWidth: "200px",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {r.server}
                    </span>
                  </div>

                  {r.status === "error" && r.error && (
                    <div style={{
                      padding: "8px 12px", fontSize: "12px",
                      fontFamily: "var(--font-mono)", color: "var(--status-failed)",
                      background: "var(--bg-overlay)",
                    }}>
                      {r.error}
                    </div>
                  )}

                  {r.status === "ok" && r.tools && r.tools.length > 0 && (
                    <div style={{ maxHeight: "180px", overflowY: "auto" }}>
                      {r.tools.map((t, j) => (
                        <div key={j} style={{
                          padding: "7px 12px",
                          borderTop: "1px solid var(--border)",
                          display: "flex", flexDirection: "column", gap: "2px",
                        }}>
                          <div style={{
                            display: "flex", alignItems: "center", gap: "8px",
                          }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                              stroke="var(--accent)" strokeWidth="2">
                              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                            </svg>
                            <span style={{
                              fontSize: "12px", fontWeight: 500,
                              color: "var(--text-primary)",
                              fontFamily: "var(--font-mono)",
                            }}>
                              {t.name}
                            </span>
                            {t.required_args.length > 0 && (
                              <span style={{
                                fontSize: "10px", color: "var(--text-muted)",
                                background: "var(--bg-overlay)",
                                padding: "1px 6px", borderRadius: "4px",
                                fontFamily: "var(--font-mono)",
                              }}>
                                {t.required_args.join(", ")}
                              </span>
                            )}
                          </div>
                          {t.description && (
                            <div style={{
                              fontSize: "11px", color: "var(--text-secondary)",
                              paddingLeft: "19px", lineHeight: "1.4",
                            }}>
                              {t.description}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </FormModal>
      )}

      {deleting && (
        <ConfirmModal
          title="Delete sub-agent"
          message={`Are you sure you want to delete "${deleting.sub_agent_name}"? Any orchestrators using it will lose this agent.`}
          onConfirm={() => deleteMutation.mutate()}
          onClose={() => setDeleting(null)}
        />
      )}

      {showPromptLib && (
        <PromptLibrary
          onInsert={(prompt, role) => {
            setSystemPrompt(prompt);
            if (!name.trim()) setName(role);
            globalToast(`"${role}" prompt inserted`, "info");
          }}
          onClose={() => setShowPromptLib(false)}
        />
      )}

      {/* ── Sub-agent version history modal ── */}
      {historyAgent && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => { setHistoryAgent(null); setHistoryData([]); }}>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px 28px", width: "520px", maxWidth: "92vw", maxHeight: "80vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>Version history — {historyAgent.sub_agent_name}</div>
            <div style={{ height: "0.5px", background: "var(--border)", margin: "10px 0 14px" }} />
            {historyLoading ? (
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Loading…</div>
            ) : historyData.length === 0 ? (
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>No versions yet. Configure GitHub in Settings to enable versioning.</div>
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
                        const r = await api.get(`/api/sub-agents/${historyAgent.sub_agent_id}/versions/${v.sha}`);
                        setVersionViewSA({ sha: v.sha, data: r.data });
                      } catch { globalToast("Could not load version", "error"); }
                    }}
                    style={{ padding: "3px 8px", borderRadius: "5px", fontSize: "11px", background: "transparent", border: "1px solid var(--border-hover)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)" }}
                  >View</button>
                  <button onClick={() => setRollbackShaSA(v.sha)} style={{ padding: "3px 8px", borderRadius: "5px", fontSize: "11px", background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.2)", color: "var(--status-failed)", cursor: "pointer", fontFamily: "var(--font)" }}>Rollback</button>
                </div>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
              <button onClick={() => { setHistoryAgent(null); setHistoryData([]); }} style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "13px", background: "transparent", border: "1px solid var(--border-hover)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)" }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Version view popup (SA) ── */}
      {versionViewSA && (
        <div style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setVersionViewSA(null)}>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px 28px", width: "500px", maxWidth: "92vw", maxHeight: "80vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "12px" }}>
              Version <code style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--accent)" }}>{versionViewSA.sha.slice(0,7)}</code>
            </div>
            {versionViewSA.data.config?.model_name && (
              <div style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "4px" }}>Model</div>
                <code style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{versionViewSA.data.config.model_name}</code>
              </div>
            )}
            <div>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "6px" }}>System prompt</div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", background: "var(--bg-overlay)", border: "1px solid var(--border)", borderRadius: "6px", padding: "10px 12px", whiteSpace: "pre-wrap", lineHeight: "1.7", maxHeight: "240px", overflowY: "auto" }}>{versionViewSA.data.system_prompt || "—"}</div>
            </div>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "16px" }}>
              <button onClick={() => setVersionViewSA(null)} style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "13px", background: "transparent", border: "1px solid var(--border-hover)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)" }}>Close</button>
              <button onClick={() => { setRollbackShaSA(versionViewSA.sha); setVersionViewSA(null); }} style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "13px", background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.2)", color: "var(--status-failed)", cursor: "pointer", fontFamily: "var(--font)" }}>Rollback to this</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Rollback confirm (SA) ── */}
      {rollbackShaSA && historyAgent && (
        <div style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setRollbackShaSA(null)}>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px 28px", width: "400px", maxWidth: "92vw" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}>Confirm rollback</div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.6", marginBottom: "20px" }}>
              Restore <strong>{historyAgent.sub_agent_name}</strong> to commit <code style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>{rollbackShaSA?.slice(0,7)}</code>. This overwrites the current DynamoDB record.
            </div>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button onClick={() => setRollbackShaSA(null)} style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "13px", background: "transparent", border: "1px solid var(--border-hover)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)" }}>Cancel</button>
              <button
                disabled={rollingBackSA}
                onClick={async () => {
                  setRollingBackSA(true);
                  try {
                    await api.post(`/api/sub-agents/${historyAgent.sub_agent_id}/rollback/${rollbackShaSA}`);
                    queryClient.invalidateQueries({ queryKey: ["sub-agents"] });
                    setRollbackShaSA(null); setHistoryAgent(null); setHistoryData([]);
                    globalToast("Sub-agent rolled back successfully");
                  } catch { globalToast("Rollback failed", "error"); }
                  finally { setRollingBackSA(false); }
                }}
                style={{ padding: "8px 20px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.3)", color: "var(--status-failed)", cursor: rollingBackSA ? "not-allowed" : "pointer", fontFamily: "var(--font)", opacity: rollingBackSA ? 0.6 : 1 }}
              >{rollingBackSA ? "Rolling back…" : "Confirm rollback"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sync diff popup (SA) ── */}
      {syncAgent && syncDiffData && syncDiffData.has_diff && (
        <div style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => { setSyncAgent(null); setSyncDiffData(null); }}>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px 28px", width: "540px", maxWidth: "92vw", maxHeight: "80vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>GitHub has changes — {syncAgent.sub_agent_name}</div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "16px" }}>The following differs between GitHub and Sutra:</div>
            {["model_name","system_prompt"].map(field => {
              const cur = syncDiffData.current?.[field] || "";
              const gh  = syncDiffData.github?.[field]  || "";
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
              <button onClick={() => { setSyncAgent(null); setSyncDiffData(null); }} style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "13px", background: "transparent", border: "1px solid var(--border-hover)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)" }}>Cancel</button>
              <button onClick={async () => {
                try {
                  await api.post(`/api/sub-agents/${syncAgent.sub_agent_id}/github-sync`);
                  queryClient.invalidateQueries({ queryKey: ["sub-agents"] });
                  globalToast("Sub-agent synced from GitHub");
                  setSyncAgent(null); setSyncDiffData(null);
                } catch { globalToast("Sync failed", "error"); }
              }} style={{ padding: "8px 20px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, background: "var(--accent)", border: "none", color: "#0A0B0F", cursor: "pointer", fontFamily: "var(--font)" }}>
                Apply GitHub version
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-agent drawer */}
      {viewing && (
        <SubAgentDrawer
          subAgent={viewing}
          onClose={() => setViewing(null)}
        />
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}