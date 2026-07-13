import { useState } from "react";
import { subAgentsApi } from "../api/subAgents";
import { AVAILABLE_MODELS } from "../api/client";
import { globalToast } from "../hooks/useGlobalToast";

interface SubAgentDef {
  name: string;
  model_name: string;
  system_prompt: string;
  mcp_servers: string;
}

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

interface Props {
  agent: SubAgentDef;
  index: number;
  isCreated: boolean;
  onCreated: (id: string) => void;
}

const fieldLabelStyle: React.CSSProperties = {
  fontSize: "10px", fontWeight: 600, color: "var(--text-muted)",
  textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "5px",
  display: "block",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px",
  background: "var(--bg-elevated)", border: "1px solid var(--border-hover)",
  borderRadius: "6px", color: "var(--text-primary)",
  fontSize: "12px", fontFamily: "var(--font)", outline: "none",
  boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle, cursor: "pointer",
};

export default function TemplateSubAgentCard({
  agent, index, isCreated, onCreated,
}: Props) {
  const [expanded, setExpanded]     = useState(false);
  const [creating, setCreating]     = useState(false);
  const [testing, setTesting]       = useState(false);
  const [mcpError, setMcpError]     = useState("");
  const [testResult, setTestResult] = useState<{ results: TestServerResult[] } | null>(null);

  // Editable local state — initialised from template
  const [name, setName]               = useState(agent.name);
  const [modelName, setModelName]     = useState(agent.model_name);
  const [systemPrompt, setSystemPrompt] = useState(agent.system_prompt);
  const [mcpServers, setMcpServers]   = useState(agent.mcp_servers);

  async function handleCreate() {
    // Validate JSON
    try { JSON.parse(mcpServers); setMcpError(""); }
    catch { setMcpError("MCP servers must be valid JSON"); return; }

    if (!name.trim()) {
      globalToast("Name is required", "warning");
      return;
    }

    setCreating(true);
    try {
      const res = await subAgentsApi.create(name, modelName, systemPrompt, mcpServers);
      const id = res.data?.sub_agent_id;
      if (id) {
        globalToast(`"${name}" created and attached`);
        onCreated(id);
      }
    } catch {
      globalToast(`Failed to create "${name}"`, "error");
    } finally {
      setCreating(false);
    }
  }

  async function handleTest() {
    try { JSON.parse(mcpServers); setMcpError(""); }
    catch { setMcpError("Must be valid JSON before testing"); return; }

    setTesting(true);
    setTestResult(null);
    try {
      const res = await subAgentsApi.testMcp(mcpServers);
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

  return (
    <div style={{
      border: `1px solid ${isCreated ? "rgba(0,200,150,0.3)" : "var(--border)"}`,
      borderRadius: "8px", overflow: "hidden",
      background: isCreated ? "var(--status-done-dim)" : "var(--bg-overlay)",
      transition: "border-color 0.15s",
    }}>
      {/* Header row — always visible */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: "10px",
          padding: "10px 12px", cursor: "pointer",
        }}
        onClick={() => !isCreated && setExpanded(e => !e)}
      >
        {/* Index / check bubble */}
        <div style={{
          width: "22px", height: "22px", borderRadius: "50%", flexShrink: 0,
          background: isCreated ? "var(--status-done)" : "rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {isCreated ? (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke="white" strokeWidth="3">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          ) : (
            <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)" }}>
              {index + 1}
            </span>
          )}
        </div>

        {/* Name + model pill */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: "13px", fontWeight: 500,
            color: isCreated ? "var(--status-done)" : "var(--text-primary)",
          }}>
            {name}
          </div>
          <div style={{
            fontSize: "11px", color: "var(--text-muted)",
            fontFamily: "var(--font-mono)", marginTop: "1px",
          }}>
            {modelName.split(".").pop()?.slice(0, 35)}
          </div>
        </div>

        {isCreated ? (
          <span style={{
            fontSize: "11px", fontWeight: 500, color: "var(--status-done)",
            padding: "2px 8px", borderRadius: "10px",
            background: "rgba(0,200,150,0.1)", flexShrink: 0,
          }}>
            Created & attached
          </span>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              onClick={e => { e.stopPropagation(); handleCreate(); }}
              disabled={creating}
              style={{
                padding: "5px 12px", borderRadius: "6px", fontSize: "12px",
                background: "var(--accent)", border: "none",
                color: "#0A0B0F", cursor: creating ? "not-allowed" : "pointer",
                fontWeight: 600, fontFamily: "var(--font)", flexShrink: 0,
                opacity: creating ? 0.7 : 1,
              }}
            >
              {creating ? "Creating..." : "Create & attach"}
            </button>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="var(--text-muted)" strokeWidth="2" style={{
                transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.15s", flexShrink: 0,
              }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
        )}
      </div>

      {/* Expanded editable panel */}
      {expanded && !isCreated && (
        <div style={{
          borderTop: "1px solid var(--border)",
          padding: "14px",
          display: "flex", flexDirection: "column", gap: "12px",
          background: "var(--bg-surface)",
        }}>
          {/* Info banner */}
          <div style={{
            padding: "8px 10px", borderRadius: "6px",
            background: "var(--accent-dim)", border: "1px solid rgba(0,200,150,0.2)",
            fontSize: "11px", color: "var(--accent)",
          }}>
            Review and edit before creating. Changes only apply to this creation.
          </div>

          {/* Name */}
          <div>
            <label style={fieldLabelStyle}>Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Model */}
          <div>
            <label style={fieldLabelStyle}>Model</label>
            <select
              value={modelName}
              onChange={e => setModelName(e.target.value)}
              style={selectStyle}
            >
              {AVAILABLE_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            <div style={{
              fontSize: "10px", color: "var(--text-muted)",
              marginTop: "3px", fontFamily: "var(--font-mono)",
            }}>
              {modelName}
            </div>
          </div>

          {/* System prompt */}
          <div>
            <label style={fieldLabelStyle}>System prompt</label>
            <textarea
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              rows={5}
              style={{ ...inputStyle, resize: "vertical", lineHeight: "1.6" }}
            />
          </div>

          {/* MCP servers */}
          <div>
            <label style={fieldLabelStyle}>MCP servers (JSON)</label>
            <textarea
              value={mcpServers}
              onChange={e => {
                setMcpServers(e.target.value);
                setTestResult(null);
                setMcpError("");
              }}
              rows={3}
              style={{
                ...inputStyle, resize: "vertical",
                fontFamily: "var(--font-mono)", fontSize: "11px",
              }}
            />
            {mcpError && (
              <div style={{
                fontSize: "11px", color: "var(--status-failed)", marginTop: "4px",
              }}>
                {mcpError}
              </div>
            )}

            {/* Test MCP button — always visible */}
            <button
              onClick={handleTest}
              disabled={testing}
              style={{
                marginTop: "8px",
                display: "flex", alignItems: "center", gap: "6px",
                padding: "6px 12px", borderRadius: "6px", fontSize: "12px",
                background: testing ? "var(--accent-dim)" : "transparent",
                border: `1px solid ${testing
                  ? "rgba(0,200,150,0.3)" : "var(--border-hover)"}`,
                color: testing ? "var(--accent)" : "var(--text-secondary)",
                cursor: testing ? "not-allowed" : "pointer",
                fontFamily: "var(--font)", transition: "all 0.15s",
              }}
            >
              {testing ? (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2"
                    style={{ animation: "spin 0.8s linear infinite" }}>
                    <polyline points="1 4 1 10 7 10"/>
                    <path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
                  </svg>
                  Testing connection...
                </>
              ) : (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                  Test MCP connection
                </>
              )}
            </button>

            {/* Test results */}
            {testResult && (
              <div style={{
                marginTop: "8px",
                display: "flex", flexDirection: "column", gap: "6px",
              }}>
                {testResult.results.map((r, i) => (
                  <div key={i} style={{
                    border: `1px solid ${r.status === "ok"
                      ? "rgba(0,200,150,0.3)" : "rgba(255,92,92,0.3)"}`,
                    borderLeft: `3px solid ${r.status === "ok"
                      ? "var(--status-done)" : "var(--status-failed)"}`,
                    borderRadius: "6px", overflow: "hidden",
                  }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: "8px",
                      padding: "7px 10px",
                      background: r.status === "ok"
                        ? "var(--status-done-dim)" : "var(--status-failed-dim)",
                    }}>
                      {r.status === "ok" ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                          stroke="var(--status-done)" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
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
                    </div>
                    {r.status === "error" && r.error && (
                      <div style={{
                        padding: "6px 10px", fontSize: "11px",
                        fontFamily: "var(--font-mono)", color: "var(--status-failed)",
                        background: "var(--bg-overlay)",
                      }}>
                        {r.error}
                      </div>
                    )}
                    {r.status === "ok" && r.tools && r.tools.length > 0 && (
                      <div style={{ maxHeight: "120px", overflowY: "auto" }}>
                        {r.tools.map((t, j) => (
                          <div key={j} style={{
                            padding: "6px 10px",
                            borderTop: "1px solid var(--border)",
                            display: "flex", alignItems: "flex-start", gap: "8px",
                          }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                              stroke="var(--accent)" strokeWidth="2"
                              style={{ marginTop: "2px", flexShrink: 0 }}>
                              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                            </svg>
                            <div>
                              <span style={{
                                fontSize: "11px", fontWeight: 500,
                                color: "var(--text-primary)",
                                fontFamily: "var(--font-mono)",
                              }}>
                                {t.name}
                              </span>
                              {t.required_args.length > 0 && (
                                <span style={{
                                  fontSize: "10px", color: "var(--text-muted)",
                                  background: "var(--bg-overlay)",
                                  padding: "1px 5px", borderRadius: "3px",
                                  fontFamily: "var(--font-mono)", marginLeft: "6px",
                                }}>
                                  {t.required_args.join(", ")}
                                </span>
                              )}
                              {t.description && (
                                <div style={{
                                  fontSize: "10px", color: "var(--text-secondary)",
                                  marginTop: "1px", lineHeight: "1.4",
                                }}>
                                  {t.description}
                                </div>
                              )}
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

          {/* Create button at bottom of panel too */}
          <button
            onClick={handleCreate}
            disabled={creating}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: "6px", padding: "9px 16px", borderRadius: "8px",
              background: "var(--accent)", border: "none",
              color: "#0A0B0F", cursor: creating ? "not-allowed" : "pointer",
              fontWeight: 600, fontSize: "13px", fontFamily: "var(--font)",
              opacity: creating ? 0.7 : 1, transition: "opacity 0.15s",
            }}
          >
            {creating ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2"
                  style={{ animation: "spin 0.8s linear infinite" }}>
                  <polyline points="1 4 1 10 7 10"/>
                  <path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
                </svg>
                Creating...
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Create & attach to orchestrator
              </>
            )}
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}