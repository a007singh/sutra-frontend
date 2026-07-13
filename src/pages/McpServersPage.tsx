import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { inputCss, selectCss } from "../components/Field";
import { globalToast } from "../hooks/useGlobalToast";

// ── Types ──────────────────────────────────────────────────────────────────
interface McpServer {
  mcp_server_id:    string;
  name:             string;
  description:      string;
  url:              string;
  transport_type:   string;
  target_prefix:    string;
  auth_type:        string;
  status:           "ACTIVE" | "PENDING" | "ERROR";
  tools_discovered: string[];
  tool_count:       number;
  created_at:       string;
  updated_at:       string;
}

// ── API helpers ────────────────────────────────────────────────────────────
interface AuthField {
  key:      string;
  label:    string;
  hint:     string;
  secret:   boolean;
  required: boolean;
}
interface CatalogEntry {
  integration_id:  string;
  name:            string;
  category:        string;
  description:     string;
  logo_emoji:      string;
  route_type:      string;
  target_prefix:   string;
  known_tools:     string[];
  auth_schema:     AuthField[];
  setup_guide_url: string;
  tags:            string[];
}

const CATEGORY_LABELS: Record<string, string> = {
  messaging:          "Messaging & Chat",
  email:              "Email",
  project_management: "Project Management",
  crm:                "CRM & Sales",
  devtools:           "Developer Tools",
  support:            "Customer Support",
  productivity:       "Productivity",
};

const mcpApi = {
  list:             () => api.get<McpServer[]>("/api/mcp-servers/"),
  create:           (body: object) => api.post<McpServer>("/api/mcp-servers/", body),
  update:           (id: string, body: object) => api.put<McpServer>(`/api/mcp-servers/${id}`, body),
  delete:           (id: string) => api.delete(`/api/mcp-servers/${id}`),
  test:             (id: string) => api.post(`/api/mcp-servers/${id}/test`, {}),
  registerExternal: (body: object) => api.post("/api/mcp-servers/register-external", body),
  getCatalog:       ()             => api.get("/api/mcp-servers/catalog"),
  install:          (body: object) => api.post("/api/mcp-servers/install", body),
};

const PRESETS: Record<string, { description: string; auth_type: string; token_hint: string; docs: string }> = {
  "slack-tools":      { description: "Slack — send messages, list channels, manage workspace",  auth_type: "API_KEY",                   token_hint: "xoxb-... (Slack Bot Token)",               docs: "https://github.com/modelcontextprotocol/servers/tree/main/src/slack" },
  "jira-tools":       { description: "Jira — create/update issues, list projects, search",      auth_type: "API_KEY",                   token_hint: "email:api_token (Atlassian API token)",    docs: "https://github.com/sooperset/mcp-atlassian" },
  "salesforce-tools": { description: "Salesforce — query records, create leads, accounts",      auth_type: "OAUTH2_CLIENT_CREDENTIALS", token_hint: "client_id:client_secret (Connected App)",  docs: "https://github.com/salesforce/mcp-server-salesforce" },
  "github-tools":     { description: "GitHub — repos, issues, PRs, file operations",            auth_type: "API_KEY",                   token_hint: "ghp_... (Personal Access Token)",          docs: "https://github.com/modelcontextprotocol/servers/tree/main/src/github" },
  "custom":           { description: "", auth_type: "API_KEY", token_hint: "Auth token for your server", docs: "" },
};

// ── Status dot ─────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  ACTIVE:  "var(--status-done, #00c896)",
  PENDING: "var(--status-waiting, #f59e0b)",
  ERROR:   "var(--status-failed, #ff5c5c)",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: "2px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 500,
      background: status === "ACTIVE" ? "rgba(0,200,150,0.12)"
                : status === "PENDING" ? "rgba(245,158,11,0.12)"
                : "rgba(255,92,92,0.12)",
      color: STATUS_COLOR[status] || "var(--text-muted)",
    }}>
      <span style={{
        width: "5px", height: "5px", borderRadius: "50%",
        background: STATUS_COLOR[status] || "var(--text-muted)",
        display: "inline-block",
        animation: status === "PENDING" ? "pulse 1.5s ease-in-out infinite" : "none",
      }} />
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

// ── Tool pills ─────────────────────────────────────────────────────────────
function ToolPills({ tools }: { tools: string[] }) {
  const MAX = 4;
  const visible = tools.slice(0, MAX);
  const rest    = tools.length - MAX;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "6px" }}>
      {visible.map(t => (
        <span key={t} style={{
          display: "inline-block", padding: "2px 8px", borderRadius: "6px",
          fontSize: "11px", background: "var(--bg-elevated, rgba(128,128,128,0.1))",
          color: "var(--text-secondary)", border: "1px solid var(--border)",
          fontFamily: "var(--font-mono)",
        }}>{t}</span>
      ))}
      {rest > 0 && (
        <span style={{
          display: "inline-block", padding: "2px 8px", borderRadius: "6px",
          fontSize: "11px", background: "var(--accent-dim)", color: "var(--accent)",
          border: "1px solid var(--border)",
        }}>+{rest} more</span>
      )}
      {tools.length === 0 && (
        <span style={{ fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic" }}>
          No tools discovered yet — click Test to fetch
        </span>
      )}
    </div>
  );
}

// ── Server card ────────────────────────────────────────────────────────────
function ServerCard({
  server,
  onEdit,
  onDelete,
  onTest,
  testing,
  testResult,
}: {
  server: McpServer;
  onEdit: (s: McpServer) => void;
  onDelete: (id: string) => void;
  onTest: (id: string) => void;
  testing: boolean;
  testResult?: any;
}) {
  return (
    <div style={{
      background: "var(--bg-surface)", border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg, 12px)", padding: "16px 20px", marginBottom: "12px",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
              {server.name}
            </span>
            <StatusBadge status={server.status} />
            {server.tool_count > 0 && (
              <span style={{
                fontSize: "11px", padding: "1px 8px", borderRadius: "10px",
                background: "var(--accent-dim)", color: "var(--accent)",
              }}>
                {server.tool_count} tools
              </span>
            )}
          </div>
          {server.description && (
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "0 0 4px" }}>
              {server.description}
            </p>
          )}
          <ToolPills tools={server.tools_discovered} />
          <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: "8px 0 0" }}>
            {server.transport_type}
            {server.target_prefix && ` · prefix: ${server.target_prefix}`}
            {" · "}{server.url.length > 60 ? server.url.slice(0, 60) + "…" : server.url}
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
          <button
            onClick={() => onTest(server.mcp_server_id)}
            disabled={testing}
            style={{
              padding: "5px 14px", borderRadius: "var(--radius)",
              border: "1px solid var(--border-hover)", background: "transparent",
              color: "var(--text-secondary)", fontSize: "12px", cursor: testing ? "wait" : "pointer",
              fontFamily: "var(--font)",
            }}
          >
            {testing ? "Testing…" : "Test connection"}
          </button>
          <button
            onClick={() => onEdit(server)}
            style={{
              padding: "5px 14px", borderRadius: "var(--radius)",
              border: "1px solid var(--border-hover)", background: "transparent",
              color: "var(--text-secondary)", fontSize: "12px", cursor: "pointer",
              fontFamily: "var(--font)",
            }}
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(server.mcp_server_id)}
            style={{
              padding: "5px 14px", borderRadius: "var(--radius)",
              border: "1px solid rgba(255,92,92,0.3)", background: "transparent",
              color: "var(--status-failed, #ff5c5c)", fontSize: "12px", cursor: "pointer",
              fontFamily: "var(--font)",
            }}
          >
            Remove
          </button>
        </div>
      </div>

      {/* Inline test result */}
      {testResult && (
        <div style={{
          marginTop: "12px", borderTop: "1px solid var(--border)", paddingTop: "12px",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px",
          }}>
            {testResult.success ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--status-done,#00c896)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--status-done,#00c896)" }}>
                  Connected · {testResult.tool_count} tool{testResult.tool_count !== 1 ? "s" : ""} discovered
                </span>
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--status-failed,#ff5c5c)" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--status-failed,#ff5c5c)" }}>
                  Connection failed
                </span>
              </>
            )}
          </div>
          {testResult.success && testResult.tools_discovered?.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {testResult.tools_discovered.map((t: string) => (
                <span key={t} style={{
                  padding: "2px 8px", borderRadius: "5px", fontSize: "11px",
                  background: "var(--status-done-dim,rgba(0,200,150,0.1))",
                  color: "var(--status-done,#00c896)",
                  border: "1px solid rgba(0,200,150,0.2)",
                  fontFamily: "var(--font-mono)",
                }}>{t}</span>
              ))}
            </div>
          )}
          {!testResult.success && testResult.message && (
            <div style={{
              fontSize: "12px", fontFamily: "var(--font-mono)",
              color: "var(--status-failed,#ff5c5c)",
              background: "var(--status-failed-dim,rgba(255,92,92,0.08))",
              padding: "8px 10px", borderRadius: "var(--radius)",
            }}>
              {testResult.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Install modal ─────────────────────────────────────────────────────────
function InstallModal({
  entry, onInstall, onCancel, saving,
}: {
  entry: CatalogEntry;
  onInstall: (fields: Record<string, string>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => setFields(p => ({ ...p, [k]: v }));
  const canSave = entry.auth_schema
    .filter(f => f.required)
    .every(f => (fields[f.key] || "").trim());

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.5)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onCancel}>
      <div style={{
        background: "var(--bg-elevated)", borderRadius: "var(--radius-lg, 12px)",
        border: "1px solid var(--border-hover)", padding: "24px 28px",
        width: "480px", maxWidth: "95vw", maxHeight: "85vh", overflowY: "auto",
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
          <span style={{ fontSize: "28px" }}>{entry.logo_emoji}</span>
          <div>
            <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" }}>
              Install {entry.name}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {entry.description}
            </div>
          </div>
        </div>

        {/* Route info */}
        <div style={{
          padding: "8px 12px", borderRadius: "var(--radius)",
          background: "var(--accent-dim)", fontSize: "12px",
          color: "var(--text-secondary)", marginBottom: "16px", lineHeight: "1.5",
        }}>
          <strong style={{ color: "var(--accent)" }}>Routed through AgentCore Gateway</strong> —
          your credentials are stored in the Gateway and never exposed to agents.
          Agents connect via your existing Gateway URL using Cognito M2M auth.
          {entry.setup_guide_url && (
            <> {" "}<a href={entry.setup_guide_url} target="_blank" rel="noreferrer"
              style={{ color: "var(--accent)" }}>Setup guide →</a></>
          )}
        </div>

        {/* Auth fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
          {entry.auth_schema.map(f => (
            <div key={f.key}>
              <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                {f.label}{f.required ? " *" : ""}
              </label>
              <input
                type={f.secret ? "password" : "text"}
                value={fields[f.key] || ""}
                onChange={e => set(f.key, e.target.value)}
                placeholder={f.hint}
                style={{
                  ...inputCss,
                  ...(f.key === "mcp_url" || !f.secret ? { fontFamily: "var(--font-mono)", fontSize: "12px" } : {}),
                }}
              />
            </div>
          ))}
        </div>

        {/* Known tools preview */}
        {entry.known_tools.length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px" }}>
              Tools that will be available
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {entry.known_tools.map(t => (
                <span key={t} style={{
                  padding: "2px 8px", borderRadius: "5px", fontSize: "11px",
                  background: "var(--bg-elevated)", color: "var(--text-secondary)",
                  border: "1px solid var(--border)", fontFamily: "var(--font-mono)",
                }}>{t}</span>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => onInstall(fields)}
            disabled={saving || !canSave}
            style={{
              flex: 1, padding: "9px 0", borderRadius: "var(--radius)",
              background: "var(--accent)", border: "none",
              color: "#0A0B0F", fontSize: "13px", fontWeight: 600,
              cursor: saving ? "wait" : "pointer", fontFamily: "var(--font)",
              opacity: !canSave ? 0.5 : 1,
            }}>
            {saving ? "Installing…" : `Install ${entry.name}`}
          </button>
          <button onClick={onCancel} style={{
            padding: "9px 20px", borderRadius: "var(--radius)",
            background: "transparent", border: "1px solid var(--border-hover)",
            color: "var(--text-secondary)", fontSize: "13px",
            cursor: "pointer", fontFamily: "var(--font)",
          }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── External server registration form ────────────────────────────────────
const EXT_BLANK = { name: "", target_prefix: "", url: "", auth_type: "API_KEY", auth_token: "", description: "" };

function ExternalForm({ onSave, onCancel, saving }: { onSave: (v: typeof EXT_BLANK) => void; onCancel: () => void; saving: boolean }) {
  const [vals, setVals] = useState({ ...EXT_BLANK });
  const [preset, setPreset] = useState("");
  const set = (k: string, v: string) => setVals(p => ({ ...p, [k]: v }));

  function applyPreset(p: string) {
    setPreset(p === preset ? "" : p);
    if (p && p !== "custom" && p !== preset) {
      const info = PRESETS[p];
      const label = p.replace("-tools","");
      set("target_prefix", p);
      set("name", label.charAt(0).toUpperCase() + label.slice(1) + " tools");
      set("description",   info.description);
      set("auth_type",     info.auth_type);
    }
  }

  const selectedPreset = preset ? PRESETS[preset] : null;

  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg, 12px)", padding: "20px 24px", marginBottom: "16px" }}>
      <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>Connect external MCP server</div>
      <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "0 0 14px" }}>
        Registers a public MCP server (Slack, Jira, GitHub…) on your AgentCore Gateway. The Gateway proxies calls and handles tool discovery.
      </p>

      <div style={{ marginBottom: "12px" }}>
        <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>Quick start</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {Object.keys(PRESETS).map(p => (
            <button key={p} type="button" onClick={() => applyPreset(p)} style={{
              padding: "3px 12px", borderRadius: "20px", fontSize: "12px", cursor: "pointer", fontFamily: "var(--font)",
              border: preset === p ? "1px solid var(--accent)" : "1px solid var(--border-hover)",
              background: preset === p ? "var(--accent-dim)" : "transparent",
              color: preset === p ? "var(--accent)" : "var(--text-secondary)",
            }}>
              {p === "custom" ? "+ Custom" : p.replace("-tools","").charAt(0).toUpperCase() + p.replace("-tools","").slice(1)}
            </button>
          ))}
        </div>
        {selectedPreset?.docs && (
          <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: "5px 0 0" }}>
            {selectedPreset.description}{" "}
            <a href={selectedPreset.docs} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>Setup guide →</a>
          </p>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
        <div>
          <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Display name *</label>
          <input value={vals.name} onChange={e => set("name", e.target.value)} placeholder="Slack tools" style={inputCss} />
        </div>
        <div>
          <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Target prefix * <span style={{ fontWeight: 400 }}>(tools appear as prefix___toolname)</span></label>
          <input value={vals.target_prefix} onChange={e => set("target_prefix", e.target.value)} placeholder="slack-tools" style={{ ...inputCss, fontFamily: "var(--font-mono)" }} />
        </div>
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>External MCP server URL * <span style={{ fontWeight: 400 }}>(must be publicly accessible via HTTPS)</span></label>
        <input value={vals.url} onChange={e => set("url", e.target.value)} placeholder="https://your-slack-mcp.example.com/mcp" style={{ ...inputCss, fontFamily: "var(--font-mono)" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "12px", marginBottom: "12px" }}>
        <div>
          <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Auth type</label>
          <select value={vals.auth_type} onChange={e => set("auth_type", e.target.value)} style={selectCss}>
            <option value="API_KEY">API Key / Bearer token</option>
            <option value="OAUTH2_CLIENT_CREDENTIALS">OAuth2 Client Credentials</option>
            <option value="NONE">None (public)</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
            Auth token{vals.auth_type !== "NONE" ? " *" : ""}
            {selectedPreset && <span style={{ marginLeft: "6px", fontWeight: 400, color: "var(--text-muted)" }}>{selectedPreset.token_hint}</span>}
          </label>
          <input type="password" value={vals.auth_token} onChange={e => set("auth_token", e.target.value)}
            placeholder={selectedPreset?.token_hint || "Token or client_id:client_secret"}
            style={inputCss} disabled={vals.auth_type === "NONE"} />
        </div>
      </div>

      <div style={{ marginBottom: "14px" }}>
        <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Description</label>
        <input value={vals.description} onChange={e => set("description", e.target.value)} placeholder="What this server provides" style={inputCss} />
      </div>

      <div style={{ padding: "10px 14px", background: "var(--accent-dim)", borderRadius: "var(--radius)", marginBottom: "14px", fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.6" }}>
        The Gateway will connect to your URL, discover tools automatically, and prefix them with{" "}
        <code style={{ fontFamily: "var(--font-mono)", background: "rgba(128,128,128,0.15)", padding: "1px 5px", borderRadius: "3px" }}>{vals.target_prefix || "prefix"}___</code>.
        Sub-agents see only those tools when this server is attached.
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        <button onClick={() => onSave(vals)}
          disabled={saving || !vals.name.trim() || !vals.url.trim() || !vals.target_prefix.trim()}
          style={{ padding: "8px 20px", borderRadius: "var(--radius)", background: "var(--accent)", border: "none", color: "#0A0B0F", fontSize: "13px", fontWeight: 600, cursor: saving ? "wait" : "pointer", fontFamily: "var(--font)", opacity: (!vals.name.trim() || !vals.url.trim() || !vals.target_prefix.trim()) ? 0.5 : 1 }}>
          {saving ? "Registering on Gateway…" : "Register on Gateway"}
        </button>
        <button onClick={onCancel} style={{ padding: "8px 20px", borderRadius: "var(--radius)", background: "transparent", border: "1px solid var(--border-hover)", color: "var(--text-secondary)", fontSize: "13px", cursor: "pointer", fontFamily: "var(--font)" }}>Cancel</button>
      </div>
    </div>
  );
}

// ── Form ───────────────────────────────────────────────────────────────────
const BLANK = {
  name: "", description: "", url: "",
  transport_type: "streamable_http", target_prefix: "", auth_type: "cognito_m2m",
};

function ServerForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: Partial<typeof BLANK>;
  onSave: (vals: typeof BLANK) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [vals, setVals]           = useState({ ...BLANK, ...initial });
  const [testing, setTesting]     = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const set = (k: string, v: string) => { setVals(p => ({ ...p, [k]: v })); setTestResult(null); };

  async function handleFormTest() {
    if (!vals.url.trim()) return;
    setTesting(true); setTestResult(null);
    try {
      // Build a temporary server config matching what test-raw expects
      const servers = [{ url: vals.url, transport_type: vals.transport_type, target_prefix: vals.target_prefix, auth_type: vals.auth_type }];
      const res = await api.post("/api/mcp-servers/test-raw", { servers });
      setTestResult((res.data as any).results?.[0] ?? null);
    } catch (e: any) {
      setTestResult({ status: "error", error: e?.response?.data?.detail || "Request failed", tools: [] });
    } finally { setTesting(false); }
  }

  return (
    <div style={{
      background: "var(--bg-surface)", border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg, 12px)", padding: "20px 24px", marginBottom: "16px",
    }}>
      <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "14px" }}>
        {initial?.name ? "Edit server" : "Register new MCP server"}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
        <div>
          <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
            Name *
          </label>
          <input
            value={vals.name}
            onChange={e => set("name", e.target.value)}
            placeholder="Math tools"
            style={inputCss}
          />
        </div>
        <div>
          <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
            Target prefix
          </label>
          <input
            value={vals.target_prefix}
            onChange={e => set("target_prefix", e.target.value)}
            placeholder="math-tools (tools start with this)"
            style={inputCss}
          />
        </div>
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
          Description
        </label>
        <input
          value={vals.description}
          onChange={e => set("description", e.target.value)}
          placeholder="Short description of what this server provides"
          style={inputCss}
        />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
          URL *
        </label>
        <input
          value={vals.url}
          onChange={e => set("url", e.target.value)}
          placeholder="https://gateway.bedrock-agentcore.../mcp"
          style={{ ...inputCss, fontFamily: "var(--font-mono)" }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
        <div>
          <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
            Transport type
          </label>
          <select value={vals.transport_type} onChange={e => set("transport_type", e.target.value)} style={selectCss}>
            <option value="streamable_http">streamable_http</option>
            <option value="sse">sse</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
            Auth type
          </label>
          <select value={vals.auth_type} onChange={e => set("auth_type", e.target.value)} style={selectCss}>
            <option value="cognito_m2m">Cognito M2M (AgentCore Gateway)</option>
            <option value="bearer">Bearer token</option>
            <option value="none">None</option>
          </select>
        </div>
      </div>

      {/* Test connection */}
      <div style={{ marginBottom: "12px" }}>
        <button type="button" onClick={handleFormTest}
          disabled={testing || !vals.url.trim()}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            padding: "7px 14px", borderRadius: "var(--radius)",
            background: testing ? "var(--accent-dim)" : "transparent",
            border: `1px solid ${testing ? "rgba(0,200,150,0.3)" : "var(--border-hover)"}`,
            color: testing ? "var(--accent)" : "var(--text-secondary)",
            fontSize: "12px", cursor: testing || !vals.url.trim() ? "not-allowed" : "pointer",
            fontFamily: "var(--font)", opacity: !vals.url.trim() ? 0.4 : 1,
          }}>
          {testing
            ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 0.8s linear infinite" }}><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>Testing...</>
            : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>Test connection</>
          }
        </button>

        {testResult && (
          <div style={{ marginTop: "8px", border: `1px solid ${testResult.status === "ok" ? "rgba(0,200,150,0.3)" : "rgba(255,92,92,0.3)"}`, borderLeft: `3px solid ${testResult.status === "ok" ? "var(--status-done,#00c896)" : "var(--status-failed,#ff5c5c)"}`, borderRadius: "var(--radius)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", background: testResult.status === "ok" ? "var(--status-done-dim)" : "var(--status-failed-dim)" }}>
              {testResult.status === "ok"
                ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--status-done,#00c896)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--status-failed,#ff5c5c)" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              }
              <span style={{ fontSize: "12px", fontWeight: 600, color: testResult.status === "ok" ? "var(--status-done,#00c896)" : "var(--status-failed,#ff5c5c)" }}>
                {testResult.status === "ok" ? `Connected · ${testResult.tool_count} tool${testResult.tool_count !== 1 ? "s" : ""} found` : "Connection failed"}
              </span>
            </div>
            {testResult.status === "error" && testResult.error && (
              <div style={{ padding: "7px 12px", fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--status-failed,#ff5c5c)", background: "var(--bg-overlay)" }}>{testResult.error}</div>
            )}
            {testResult.status === "ok" && testResult.tools?.length > 0 && (
              <div style={{ maxHeight: "140px", overflowY: "auto" }}>
                {testResult.tools.map((t: any, i: number) => (
                  <div key={i} style={{ padding: "5px 12px", borderTop: "1px solid var(--border)", display: "flex", gap: "8px", alignItems: "flex-start" }}>
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
        )}
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={() => onSave(vals)}
          disabled={saving || !vals.name.trim() || !vals.url.trim()}
          style={{
            padding: "8px 20px", borderRadius: "var(--radius)",
            background: "var(--accent)", border: "none",
            color: "#0A0B0F", fontSize: "13px", fontWeight: 600,
            cursor: saving ? "wait" : "pointer", fontFamily: "var(--font)",
            opacity: (!vals.name.trim() || !vals.url.trim()) ? 0.5 : 1,
          }}
        >
          {saving ? "Saving…" : "Save server"}
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: "8px 20px", borderRadius: "var(--radius)",
            background: "transparent", border: "1px solid var(--border-hover)",
            color: "var(--text-secondary)", fontSize: "13px", cursor: "pointer",
            fontFamily: "var(--font)",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function McpServersPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm]       = useState(false);
  const [showExtForm, setShowExtForm] = useState(false);
  const [activeTab, setActiveTab]     = useState<"installed" | "catalog">("installed");
  const [installing, setInstalling]   = useState<CatalogEntry | null>(null);
  const [editing, setEditing]         = useState<McpServer | null>(null);
  const [testingId,   setTestingId]   = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, any>>({});

  const { data: servers = [], isLoading } = useQuery({
    queryKey: ["mcp-servers"],
    queryFn: () => mcpApi.list().then(r => r.data),
  });

  const registerExtMut = useMutation({
    mutationFn: (vals: any) => mcpApi.registerExternal(vals),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mcp-servers"] });
      setShowExtForm(false);
      globalToast("External MCP server registered on Gateway", "success");
    },
    onError: (e: any) => globalToast(
      (e as any)?.response?.data?.detail || "Registration failed — check Gateway config and server URL",
      "error"
    ),
  });

  const { data: catalog = [] } = useQuery({
    queryKey: ["integration-catalog"],
    queryFn:  () => mcpApi.getCatalog().then(r => r.data as CatalogEntry[]),
  });

  const installMut = useMutation({
    mutationFn: ({ entry, fields }: { entry: CatalogEntry; fields: Record<string, string> }) =>
      mcpApi.install({ integration_id: entry.integration_id, auth_fields: fields }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mcp-servers"] });
      setInstalling(null);
      globalToast("Integration installed via Gateway", "success");
    },
    onError: (e: any) => globalToast(
      (e as any)?.response?.data?.detail || "Installation failed",
      "error"
    ),
  });

  const createMut = useMutation({
    mutationFn: (vals: typeof BLANK) => mcpApi.create(vals),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mcp-servers"] });
      setShowForm(false);
      globalToast("MCP server registered", "success");
    },
    onError: () => globalToast("Failed to register server", "error"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, vals }: { id: string; vals: typeof BLANK }) =>
      mcpApi.update(id, vals),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mcp-servers"] });
      setEditing(null);
      globalToast("Server updated", "success");
    },
    onError: () => globalToast("Failed to update server", "error"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => mcpApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mcp-servers"] });
      globalToast("Server removed");
    },
    onError: () => globalToast("Failed to remove server", "error"),
  });

  async function handleTest(id: string) {
    setTestingId(id);
    setTestResults(prev => ({ ...prev, [id]: null }));
    try {
      const res = await mcpApi.test(id);
      const data = res.data as any;
      setTestResults(prev => ({ ...prev, [id]: data }));
      if (data.success) {
        globalToast(`Connected — ${data.tool_count} tool(s) discovered`, "success");
      } else {
        globalToast(`Connection failed: ${data.message}`, "error");
      }
      qc.invalidateQueries({ queryKey: ["mcp-servers"] });
    } catch {
      globalToast("Test request failed", "error");
      setTestResults(prev => ({ ...prev, [id]: { success: false, message: "Request failed" } }));
    } finally {
      setTestingId(null);
    }
  }

  function handleDelete(id: string) {
    if (!confirm("Remove this MCP server from the registry?")) return;
    deleteMut.mutate(id);
  }

  return (
    <div style={{ padding: "28px 32px", maxWidth: "900px" }}>
      {/* Header */}
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px" }}>
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: 600, letterSpacing: "-0.3px", marginBottom: "4px" }}>
            MCP servers
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
            Install third-party integrations or register custom MCP servers for your sub-agents.
          </p>
        </div>
        {!showForm && !showExtForm && !editing && activeTab === "installed" && (
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => setShowForm(true)}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "8px 18px", borderRadius: "var(--radius)",
                background: "var(--accent)", border: "none",
                color: "#0A0B0F", fontSize: "13px", fontWeight: 600,
                cursor: "pointer", fontFamily: "var(--font)", flexShrink: 0,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Register server
            </button>
            <button onClick={() => setShowExtForm(true)} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "var(--radius)", background: "transparent", border: "1px solid var(--border-hover)", color: "var(--text-secondary)", fontSize: "13px", cursor: "pointer", fontFamily: "var(--font)", flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18"/><path d="M7 17H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h3"/><path d="M17 7v3a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V7"/><path d="M17 7h3a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-3"/></svg>
              Connect external
            </button>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: "0", marginBottom: "20px", borderBottom: "1px solid var(--border)" }}>
        {(["installed", "catalog"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: "8px 20px", background: "none", border: "none",
            borderBottom: tab === activeTab ? "2px solid var(--accent)" : "2px solid transparent",
            color: tab === activeTab ? "var(--accent)" : "var(--text-muted)",
            fontSize: "13px", fontWeight: tab === activeTab ? 600 : 400,
            cursor: "pointer", fontFamily: "var(--font)", marginBottom: "-1px",
            transition: "color 0.15s",
          }}>
            {tab === "installed" ? "Installed" : `Marketplace (${catalog.length})`}
          </button>
        ))}
      </div>

      {/* ── Catalog tab ── */}
      {activeTab === "catalog" && (
        <div>
          {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
            const entries = (catalog as CatalogEntry[]).filter(e => e.category === cat);
            if (!entries.length) return null;
            return (
              <div key={cat} style={{ marginBottom: "24px" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" }}>
                  {label}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px" }}>
                  {entries.map(entry => (
                    <div key={entry.integration_id} style={{
                      background: "var(--bg-surface)", border: "1px solid var(--border)",
                      borderRadius: "var(--radius-lg, 12px)", padding: "14px 16px",
                      cursor: "pointer", transition: "border-color 0.15s",
                    }}
                      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent)"}
                      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"}
                    >
                      <div style={{ fontSize: "24px", marginBottom: "8px" }}>{entry.logo_emoji}</div>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>{entry.name}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "10px", lineHeight: "1.4" }}>{entry.description}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "3px", marginBottom: "10px" }}>
                        {entry.known_tools.slice(0, 3).map(t => (
                          <span key={t} style={{ padding: "1px 6px", borderRadius: "4px", fontSize: "10px", background: "var(--bg-elevated)", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{t}</span>
                        ))}
                        {entry.known_tools.length > 3 && <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>+{entry.known_tools.length - 3}</span>}
                      </div>
                      <button
                        onClick={() => setInstalling(entry)}
                        style={{
                          width: "100%", padding: "6px 0", borderRadius: "var(--radius)",
                          background: "var(--accent)", border: "none",
                          color: "#0A0B0F", fontSize: "12px", fontWeight: 600,
                          cursor: "pointer", fontFamily: "var(--font)",
                        }}>
                        Install
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Installed tab content ── */}
      {activeTab === "installed" && (
        <>

      {/* External registration form */}
      {showExtForm && (
        <ExternalForm
          onSave={vals => registerExtMut.mutate(vals)}
          onCancel={() => setShowExtForm(false)}
          saving={registerExtMut.isPending}
        />
      )}

      {/* Add form */}
      {showForm && (
        <ServerForm
          onSave={vals => createMut.mutate(vals)}
          onCancel={() => setShowForm(false)}
          saving={createMut.isPending}
        />
      )}

      {/* Edit form */}
      {editing && (
        <ServerForm
          initial={{
            name:           editing.name,
            description:    editing.description,
            url:            editing.url,
            transport_type: editing.transport_type,
            target_prefix:  editing.target_prefix,
            auth_type:      editing.auth_type,
          }}
          onSave={vals => updateMut.mutate({ id: editing.mcp_server_id, vals })}
          onCancel={() => setEditing(null)}
          saving={updateMut.isPending}
        />
      )}

      {/* List */}
      {isLoading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
          Loading…
        </div>
      ) : servers.length === 0 && !showForm ? (
        <div style={{
          textAlign: "center", padding: "60px 20px",
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg, 12px)",
        }}>
          <div style={{
            width: "44px", height: "44px", borderRadius: "10px",
            background: "var(--accent-dim)", margin: "0 auto 14px",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <path d="M8 21h8M12 17v4"/>
            </svg>
          </div>
          <div style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)", marginBottom: "6px" }}>
            No MCP servers registered
          </div>
          <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "16px" }}>
            Register your existing Math and Invoice servers to make them available in sub-agents
          </div>
          <button
            onClick={() => setShowForm(true)}
            style={{
              padding: "8px 20px", borderRadius: "var(--radius)",
              background: "var(--accent)", border: "none",
              color: "#0A0B0F", fontSize: "13px", fontWeight: 600,
              cursor: "pointer", fontFamily: "var(--font)",
            }}
          >
            Register first server
          </button>
        </div>
      ) : (
        servers.map(s => (
          <ServerCard
            key={s.mcp_server_id}
            server={s}
            onEdit={setEditing}
            onDelete={handleDelete}
            onTest={handleTest}
            testing={testingId === s.mcp_server_id}
            testResult={testResults[s.mcp_server_id]}
          />
        ))
      )}

      {servers.length > 0 && (
        <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>
          {servers.filter(s => s.status === "ACTIVE").length} active ·{" "}
          {servers.reduce((n, s) => n + s.tool_count, 0)} total tools
        </p>
      )}
        </>
      )}

      {/* Install modal */}
      {installing && (
        <InstallModal
          entry={installing}
          onInstall={fields => installMut.mutate({ entry: installing, fields })}
          onCancel={() => setInstalling(null)}
          saving={installMut.isPending}
        />
      )}
    </div>
  );
}