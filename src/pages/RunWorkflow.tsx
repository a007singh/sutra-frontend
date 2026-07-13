import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { workflowsApi } from "../api/workflows";
import { useMe } from "../hooks/useMe";
import { canPrompt } from "../api/roles";
import { orchestratorsApi } from "../api/orchestrators";
import { executionsApi } from "../api/executions";
import { api } from "../api/client";
import { useExecutionWS } from "../hooks/useexecutionws";
import Field, { selectCss, inputCss } from "../components/Field";
import { globalToast } from "../hooks/useGlobalToast";
import { subAgentsApi } from "../api/subAgents";
import FlowDiagram from "../components/FlowDiagram";

interface Usage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
}

interface TraceEvent {
  type: "reasoning" | "delegating" | "tool_selected" | "tool_input" | "tool_result" | "log";
  content: string;
}

interface Turn {
  id: string;
  role: "user" | "agent";
  content: string;
  trace: TraceEvent[];
  status: "running" | "waiting" | "done" | "error" | "cancelled";
  hitlQuestion?: string;
  usage?: Usage;
}

function renderMarkdown(text: string): string {
  return text
    // Remove any remaining <thinking> blocks
    .replace(/<thinking>[\s\S]*?<\/thinking>/g, "")
    // Bold **text**
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    // Italic *text*
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    // Bullet points - **label:** value  or - text
    .replace(/^- \*\*(.*?)\*\*:\s*(.*)/gm,
      `<div style="display:flex;gap:8px;padding:3px 0">
        <span style="color:var(--text-muted)">•</span>
        <span><strong>$1:</strong> $2</span>
      </div>`
    )
    .replace(/^- (.*)/gm,
      `<div style="display:flex;gap:8px;padding:3px 0">
        <span style="color:var(--text-muted)">•</span>
        <span>$1</span>
      </div>`
    )
    // Headers ### ## #
    .replace(/^### (.*)/gm,
      `<div style="font-size:13px;font-weight:600;color:var(--text-primary);margin:12px 0 4px">$1</div>`
    )
    .replace(/^## (.*)/gm,
      `<div style="font-size:14px;font-weight:600;color:var(--text-primary);margin:14px 0 6px">$1</div>`
    )
    .replace(/^# (.*)/gm,
      `<div style="font-size:15px;font-weight:700;color:var(--text-primary);margin:16px 0 8px">$1</div>`
    )
    // Code `inline`
    .replace(/`(.*?)`/g,
      `<code style="font-family:var(--font-mono);font-size:12px;background:var(--bg-overlay);padding:1px 5px;border-radius:4px;color:var(--accent)">$1</code>`
    )
    // Line breaks
    .replace(/\n\n/g, `<div style="height:8px"></div>`)
    .replace(/\n/g, "<br/>")
    .trim();
}

function parseLineToTrace(line: string): TraceEvent | null {
  if (line.includes("Reasoning:") || line.includes("reasoning"))
    return { type: "reasoning", content: line.replace(/^.*?Reasoning:\s*/i, "") };
  if (line.includes("Delegating to"))
    return { type: "delegating", content: line.replace(/^.*?Delegating to[:\s]*/i, "").trim() };
  if (line.includes("Tool Selected:") || line.includes("Invoking MCP Tool"))
    return { type: "tool_selected", content: line.replace(/^.*?(Tool Selected:|🔨 Invoking MCP Tool:)[:\s]*/i, "").trim() };
  if (line.includes("Final Payload:") || line.includes("🚀"))
    return { type: "tool_input", content: line.replace(/^.*?(Final Payload:|🚀)[:\s]*/i, "").trim() };
  if (line.includes("Tool Output:") || line.includes("📦"))
    return { type: "tool_result", content: line.replace(/^.*?(Tool Output:|📦)[:\s]*/i, "").trim() };
  return { type: "log", content: line };
}

function UsagePill({ usage }: { usage: Usage }) {
  const costStr = usage.estimated_cost_usd < 0.001
    ? `< $0.001`
    : `$${usage.estimated_cost_usd.toFixed(4)}`;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "12px",
      marginTop: "10px", paddingTop: "10px",
      borderTop: "1px solid var(--border)",
      flexWrap: "wrap",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          {usage.input_tokens.toLocaleString()} in
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          {usage.output_tokens.toLocaleString()} out
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          {usage.total_tokens.toLocaleString()} total
        </span>
      </div>
      <div style={{
        marginLeft: "auto",
        fontSize: "11px", fontWeight: 600,
        color: "var(--accent)",
        background: "var(--accent-dim)",
        padding: "2px 8px", borderRadius: "10px",
      }}>
        {costStr}
      </div>
    </div>
  );
}

function TraceBlock({
  trace, isRunning, isWaiting, sessionId, turnContent, turnUsage, modelId, userPrompt,
}: {
  trace: TraceEvent[];
  isRunning?: boolean;
  isWaiting?: boolean;
  sessionId?: string | null;
  turnContent?: string;
  turnUsage?: Usage;
  modelId?: string;
  userPrompt?: string;
}) {
  const [open, setOpen] = useState(false);
  const [showFlow, setShowFlow] = useState(false);

  return (
    <div style={{ marginBottom: (trace.length || isRunning || isWaiting) ? "10px" : "0" }}>
      {/* Waiting indicator */}
      {isWaiting && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 0", marginBottom: "6px" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--status-waiting)" strokeWidth="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span style={{ fontSize: "13px", color: "var(--status-waiting)", fontWeight: 500 }}>
            Waiting for human input...
          </span>
        </div>
      )}

      {/* Show thinking */}
      {isRunning && !isWaiting && (
        <div style={{
          display: "flex", alignItems: "center", gap: "8px",
          padding: "4px 0", marginBottom: trace.length ? "6px" : "0",
        }}>
          <div style={{ display: "flex", gap: "3px" }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: "5px", height: "5px", borderRadius: "50%",
                background: "var(--text-muted)",
                animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
          <span style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>
            Show thinking...
          </span>
        </div>
      )}

      {/* Trace toggle */}
      {trace.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button onClick={() => setOpen(o => !o)} style={{
              display: "flex", alignItems: "center", gap: "8px",
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-secondary)", fontSize: "13px", padding: "4px 0",
              fontFamily: "var(--font)",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>
                <polyline points="9 18 15 12 9 6"/>
              </svg>
              <span style={{ fontSize: "12px" }}>{open ? "Hide" : "View"} execution trace</span>
              <span style={{
                fontSize: "10px", padding: "1px 6px", borderRadius: "10px",
                background: "var(--accent-dim)", color: "var(--accent)",
              }}>{trace.length}</span>
            </button>

            {!isRunning && !isWaiting && (
              <button
                onClick={() => {
                  const lines = [
                    `Session: ${sessionId || "unknown"}`,
                    ``,
                    `=== EXECUTION TRACE ===`,
                    ...trace.map(t => {
                      if (t.type === "delegating")   return `🤖 Delegating to ${t.content}`;
                      if (t.type === "tool_selected") return `🔨 Tool: ${t.content}`;
                      if (t.type === "tool_input")   return `🚀 Input: ${t.content}`;
                      if (t.type === "tool_result")  return `📦 Result: ${t.content}`;
                      if (t.type === "reasoning")    return `💭 Reasoning: ${t.content}`;
                      return t.content;
                    }),
                    ``,
                    `=== FINAL OUTPUT ===`,
                    turnContent || "",
                    ``,
                    `=== USAGE ===`,
                    turnUsage
                      ? `Input: ${turnUsage.input_tokens} | Output: ${turnUsage.output_tokens} | Total: ${turnUsage.total_tokens} | Cost: $${turnUsage.estimated_cost_usd.toFixed(4)}`
                      : "No usage data",
                  ];
                  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
                  const url  = URL.createObjectURL(blob);
                  const a    = document.createElement("a");
                  a.href     = url;
                  a.download = `trace-${sessionId?.slice(0, 8) || "session"}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                style={{
                  display: "flex", alignItems: "center", gap: "5px",
                  padding: "3px 10px", borderRadius: "6px", fontSize: "11px",
                  background: "transparent", border: "1px solid var(--border-hover)",
                  color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)",
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export
              </button>
            )}

            {/* Flow diagram button */}
            {trace.length > 0 && (
              <button
                onClick={() => setShowFlow(true)}
                style={{
                  display: "flex", alignItems: "center", gap: "5px",
                  padding: "3px 10px", borderRadius: "6px", fontSize: "11px",
                  background: "transparent", border: "1px solid var(--border-hover)",
                  color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)",
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/>
                  <line x1="12" y1="7" x2="5" y2="17"/><line x1="12" y1="7" x2="19" y2="17"/>
                </svg>
                Flow
              </button>
            )}

            {/* Flow diagram modal */}
            {showFlow && (
              <FlowDiagram
                trace={trace}
                userPrompt={userPrompt}
                agentOutput={turnContent}
                modelId={modelId}
                onClose={() => setShowFlow(false)}
              />
            )}
          </div>

          {open && (
            <div style={{
              border: "1px solid var(--border)", borderRadius: "var(--radius)",
              overflow: "hidden", marginTop: "4px",
            }}>
              {trace.map((t, i) => (
                <div key={i} style={{
                  padding: "10px 14px",
                  borderBottom: i < trace.length - 1 ? "1px solid var(--border)" : "none",
                  background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                }}>
                  {t.type === "reasoning" && (
                    <div>
                      <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Reasoning
                      </div>
                      <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.6" }}>
                        {t.content}
                      </div>
                    </div>
                  )}
                  {t.type === "delegating" && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--status-running)" strokeWidth="2">
                        <circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/>
                        <path d="M12 7v4M5 17l7-6 7 6"/>
                      </svg>
                      <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Delegating to</span>
                      <code style={{ fontSize: "12px", color: "var(--status-running)", background: "var(--status-running-dim)", padding: "1px 7px", borderRadius: "4px" }}>
                        {t.content}
                      </code>
                    </div>
                  )}
                  {t.type === "tool_selected" && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--status-waiting)" strokeWidth="2">
                        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                      </svg>
                      <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Tool selected</span>
                      <code style={{ fontSize: "12px", color: "var(--status-waiting)", background: "var(--status-waiting-dim)", padding: "1px 7px", borderRadius: "4px" }}>
                        {t.content}
                      </code>
                    </div>
                  )}
                  {t.type === "tool_input" && (
                    <div>
                      <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Input
                      </div>
                      <pre style={{
                        fontSize: "12px", fontFamily: "var(--font-mono)",
                        color: "var(--accent)", background: "var(--accent-dim)",
                        padding: "8px 10px", borderRadius: "6px",
                        overflowX: "auto", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all",
                      }}>{t.content}</pre>
                    </div>
                  )}
                  {t.type === "tool_result" && (
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--status-done)" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--status-done)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          Tool result
                        </span>
                      </div>
                      <pre style={{
                        fontSize: "12px", fontFamily: "var(--font-mono)",
                        color: "var(--text-secondary)", background: "var(--bg-overlay)",
                        padding: "8px 10px", borderRadius: "6px",
                        overflowX: "auto", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all",
                        maxHeight: "120px", overflowY: "auto",
                      }}>{t.content}</pre>
                    </div>
                  )}
                  {t.type === "log" && (
                    <div style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                      {t.content}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "20px" }}>
      <div style={{
        width: "32px", height: "32px", borderRadius: "8px", flexShrink: 0,
        background: "linear-gradient(135deg, #f97316, #ea580c)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      </div>
      <div style={{
        flex: 1, background: "var(--bg-surface)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)", padding: "12px 16px",
        fontSize: "14px", color: "var(--text-primary)", lineHeight: "1.6",
      }}>
        {content}
      </div>
    </div>
  );
}

function AgentBubble({
  turn, sessionId, onHitlSubmitted, modelId, userPrompt,
}: {
  turn: Turn;
  sessionId: string | null;
  onHitlSubmitted: () => void;
  modelId?: string;
  userPrompt?: string;
}) {
  const [hitlAnswer, setHitlAnswer] = useState("");

  async function handleSubmit() {
    if (!sessionId || !hitlAnswer.trim()) return;
    await executionsApi.submitHitl(sessionId, hitlAnswer);
    setHitlAnswer("");
    onHitlSubmitted();
  }

  return (
    <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "24px" }}>
      {/* Avatar */}
      <div style={{
        width: "32px", height: "32px", borderRadius: "8px", flexShrink: 0,
        background: "linear-gradient(135deg, #f59e0b, #d97706)",
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative",
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <rect x="3" y="11" width="18" height="10" rx="2"/>
          <circle cx="12" cy="5" r="2"/>
          <path d="M12 7v4"/>
        </svg>
        {(turn.status === "running" || turn.status === "waiting") && (
          <div style={{
            position: "absolute", bottom: "-2px", right: "-2px",
            width: "8px", height: "8px", borderRadius: "50%",
            background: turn.status === "waiting" ? "var(--status-waiting)" : "var(--status-running)",
            animation: "pulse 1.5s ease-in-out infinite",
            border: "1.5px solid var(--bg-base)",
          }} />
        )}
      </div>

      <div style={{ flex: 1 }}>
        {/* Main bubble */}
        <div style={{
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)", padding: "14px 16px",
          marginBottom: turn.hitlQuestion ? "8px" : "0",
        }}>
          <TraceBlock
            trace={turn.trace}
            isRunning={turn.status === "running"}
            isWaiting={turn.status === "waiting"}
            sessionId={sessionId}
            turnContent={turn.content}
            turnUsage={turn.usage}
            modelId={modelId}
            userPrompt={userPrompt}
          />
          {turn.content && (
            <div style={{ fontSize: "14px", color: "var(--text-primary)", lineHeight: "1.8" }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(turn.content) }}
            />
          )}
          {turn.status === "error" && (
            <div style={{ fontSize: "13px", color: "var(--status-failed)", display: "flex", alignItems: "center", gap: "6px" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {turn.content}
            </div>
          )}
          {turn.status === "cancelled" && (
            <div style={{
              fontSize: "13px", color: "var(--text-muted)",
              display: "flex", alignItems: "center", gap: "6px",
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              Execution cancelled
            </div>
          )}
          {turn.usage && <UsagePill usage={turn.usage} />}
        </div>

        {/* HITL panel */}
        {turn.hitlQuestion && (
          <div style={{
            background: "var(--status-waiting-dim)",
            border: "1px solid rgba(255,181,71,0.3)",
            borderRadius: "var(--radius-lg)", padding: "16px 20px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <div style={{
                width: "6px", height: "6px", borderRadius: "50%",
                background: "var(--status-waiting)",
                animation: "pulse 1.5s ease-in-out infinite",
              }} />
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--status-waiting)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Action required
              </span>
            </div>
            <p style={{ fontSize: "14px", color: "var(--text-primary)", marginBottom: "14px", lineHeight: "1.7", fontWeight: 500 }}>
              {turn.hitlQuestion}
            </p>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "8px" }}>
              Your response / approval
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                value={hitlAnswer}
                onChange={e => setHitlAnswer(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                placeholder="Type your response..."
                style={{ ...inputCss, flex: 1 }}
                autoFocus
              />
              <button onClick={handleSubmit} style={{
                padding: "9px 20px", borderRadius: "var(--radius)",
                background: "var(--status-waiting)", border: "none",
                color: "#0A0B0F", fontSize: "13px", fontWeight: 600,
                cursor: "pointer", fontFamily: "var(--font)", flexShrink: 0,
              }}>
                Submit response
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface Props {
  conversationId: string | null;
  onConversationStarted: (id: string) => void;
  onNewChat: () => void;
  refreshSidebar: () => void;
}

export default function RunWorkflow({ conversationId, onConversationStarted, onNewChat, refreshSidebar }: Props) {
  const { data: _me } = useMe();
  const _canPrompt = canPrompt(_me);
  const [mode, setMode]             = useState<"orchestrator"|"agent">("orchestrator");
  const [agentId, setAgentId]       = useState("");
  const [workflowId, setWorkflowId] = useState("");
  const [orchId, setOrchId]         = useState("");
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [sessionTotal, setSessionTotal] = useState<Usage>({
    input_tokens: 0, output_tokens: 0,
    total_tokens: 0, estimated_cost_usd: 0,
  });
  const [showReplayModal, setShowReplayModal] = useState(false);
  const [replayOption,    setReplayOption]    = useState<"same"|"model"|"prompt">("same");
  const [replayModelSel,  setReplayModelSel]  = useState("");

  const REPLAY_MODELS = [
    { id: "us.amazon.nova-pro-v1:0",                       label: "Nova Pro" },
    { id: "us.amazon.nova-lite-v1:0",                      label: "Nova Lite" },
    { id: "us.amazon.nova-micro-v1:0",                     label: "Nova Micro" },
    { id: "us.anthropic.claude-sonnet-4-5-20250929-v1:0",  label: "Claude Sonnet 4.5" },
    { id: "us.anthropic.claude-sonnet-4-6",                label: "Claude Sonnet 4.6" },
  ];
  function mLabel(id: string) {
    return REPLAY_MODELS.find(m => m.id === id)?.label
      || id.split(":")[0].split(".").pop() || id;
  }

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const prevConvId = useRef<string | null | undefined>(undefined); // undefined = first mount
  // Tracks when we set conversationId ourselves (via onConversationStarted)
  // so the useEffect doesn't wrongly call handleResume during an active run
  const skipNextConvEffect = useRef(false);
  // True for the first send in each new chat — only the first send creates
  // a new sidebar entry (like Claude/Gemini where one chat = many exchanges)
  const isFirstSendRef        = useRef(true);
  // Persists across sends within the same chat — sent to backend as conversation_id
  const conversationGroupIdRef = useRef<string | null>(null);

  const { data: workflows } = useQuery({
    queryKey: ["workflows"],
    queryFn: () => workflowsApi.list().then(r => r.data),
  });
  const { data: orchestrators } = useQuery({
    queryKey: ["orchestrators"],
    queryFn: () => orchestratorsApi.list().then(r => r.data),
  });

  const filteredOrchestrators = orchestrators?.filter(o =>
    !workflowId || o.workflow_id === workflowId
  );

  const { data: subAgents } = useQuery({
    queryKey: ["sub-agents"],
    queryFn:  () => subAgentsApi.list().then(r => r.data),
  });

  const { events, setHitlQuestion } = useExecutionWS(sessionId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  // ── Auto-load or reset when conversationId prop changes ──────────────────
  useEffect(() => {
    // Skip if this change was triggered internally (new execution just started)
    // — we don't want to call handleResume over a live running session
    if (skipNextConvEffect.current) {
      skipNextConvEffect.current = false;
      return;
    }
    if (prevConvId.current === undefined) {
      // First mount — only load if a conversation was pre-selected from sidebar
      prevConvId.current = conversationId;
      if (conversationId !== null) handleResume(conversationId);
      return;
    }
    prevConvId.current = conversationId;
    if (conversationId === null) {
      // Parent explicitly cleared → new chat
      handleReset();
    } else {
      // User clicked a conversation in the sidebar → load it
      handleResume(conversationId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // ── Main event processor ──────────────────────────────────────────────────
  // ── Main event processor — processes every new event ─────────────────────
  const processedCountRef = useRef(0);

  useEffect(() => {
    if (!events.length) {
      // Events were cleared (new session started) -- reset counter here, not in handleSend
      processedCountRef.current = 0;
      return;
    }

    // Process only genuinely new events since last render
    const newEvents = events.slice(processedCountRef.current);
    processedCountRef.current = events.length;

    for (const evt of newEvents) {
      if (evt.type === "hitl_question" && evt.question) {
        setTurns(prev => {
          const updated = [...prev];
          const lastTurn = updated[updated.length - 1];
          if (!lastTurn || lastTurn.role !== "agent") return prev;
          updated[updated.length - 1] = { ...lastTurn, trace: [...lastTurn.trace], status: "waiting", hitlQuestion: evt.question };
          return updated;
        });
        continue;
      }

      if (evt.type === "usage") {
        const u: Usage = {
          input_tokens:       evt.input_tokens       || 0,
          output_tokens:      evt.output_tokens      || 0,
          total_tokens:       evt.total_tokens        || 0,
          estimated_cost_usd: evt.estimated_cost_usd || 0,
        };
        setTurns(prev => {
          const updated = [...prev];
          const lastTurn = updated[updated.length - 1];
          if (!lastTurn || lastTurn.role !== "agent") return prev;
          updated[updated.length - 1] = { ...lastTurn, trace: [...lastTurn.trace], usage: u };
          return updated;
        });
        setSessionTotal(prev => ({
          input_tokens:       prev.input_tokens       + u.input_tokens,
          output_tokens:      prev.output_tokens      + u.output_tokens,
          total_tokens:       prev.total_tokens       + u.total_tokens,
          estimated_cost_usd: prev.estimated_cost_usd + u.estimated_cost_usd,
        }));
        continue;
      }

      if (evt.type === "status") {
        if (evt.status === "COMPLETED") {
          const finalContent = (evt.line || "").replace(/.*✅ \*?\*?FINAL OUTPUT:\*?\*?\s*/i, "").trim();
          setTurns(prev => {
            const updated = [...prev];
            const lastTurn = updated[updated.length - 1];
            if (!lastTurn || lastTurn.role !== "agent") return prev;
            updated[updated.length - 1] = { ...lastTurn, trace: [...lastTurn.trace], content: finalContent || lastTurn.content, status: "done", hitlQuestion: undefined };
            return updated;
          });
          setRunning(false);
          continue;
        }
        if (evt.status === "CANCELLED") {
          setTurns(prev => {
            const updated = [...prev];
            const lastTurn = updated[updated.length - 1];
            if (!lastTurn || lastTurn.role !== "agent") return prev;
            updated[updated.length - 1] = { ...lastTurn, trace: [...lastTurn.trace], content: "Execution cancelled.", status: "cancelled", hitlQuestion: undefined };
            return updated;
          });
          setRunning(false);
          continue;
        }
        if (evt.status === "FAILED") {
          setTurns(prev => {
            const updated = [...prev];
            const lastTurn = updated[updated.length - 1];
            if (!lastTurn || lastTurn.role !== "agent") return prev;
            updated[updated.length - 1] = { ...lastTurn, trace: [...lastTurn.trace], content: evt.line || "An error occurred.", status: "error", hitlQuestion: undefined };
            return updated;
          });
          setRunning(false);
          continue;
        }
      }

      if (evt.type === "log" && evt.line) {
        const line = evt.line;
        if (line.includes("✅ FINAL OUTPUT:") || line.includes("✅ **FINAL OUTPUT:**")) {
          const finalContent = line.replace(/.*✅ \*?\*?FINAL OUTPUT:\*?\*?\s*/i, "").trim();
          setTurns(prev => {
            const updated = [...prev];
            const lastTurn = updated[updated.length - 1];
            if (!lastTurn || lastTurn.role !== "agent") return prev;
            updated[updated.length - 1] = { ...lastTurn, trace: [...lastTurn.trace], content: finalContent || lastTurn.content, status: "done", hitlQuestion: undefined };
            return updated;
          });
          setRunning(false);
          continue;
        }
        const parsed = parseLineToTrace(line);
        if (parsed && parsed.type !== "log") {
          setTurns(prev => {
            const updated = [...prev];
            const lastTurn = updated[updated.length - 1];
            if (!lastTurn || lastTurn.role !== "agent") return prev;
            updated[updated.length - 1] = { ...lastTurn, trace: [...lastTurn.trace, parsed] };
            return updated;
          });
        }
      }
    }
  }, [events]);

  // ── Safety net: sync running flag from turns status ───────────────────────
  useEffect(() => {
    if (turns.length === 0) return;
    const lastTurn = turns[turns.length - 1];
    if (lastTurn?.role !== "agent") return;
    if (
      lastTurn.status === "done" ||
      lastTurn.status === "error" ||
      lastTurn.status === "cancelled"
    ) {
      setRunning(false);
    }
  }, [turns]);

  // ── Fallback: poll DB directly if WebSocket goes silent ──────────────────
  useEffect(() => {
    if (!running || !sessionId) return;

    const interval = setInterval(async () => {
      try {
        const res = await executionsApi.get(sessionId);
        const status = (res.data as any)?.status;
        if (status === "COMPLETED" || status === "FAILED" || status === "CANCELLED") {
          const logs: string[] = (res.data as any)?.logs || [];
          const finalLine = logs.slice().reverse().find(l => l.includes("FINAL OUTPUT")) || "";
          const finalContent = finalLine.replace(/.*✅ \*?\*?FINAL OUTPUT:\*?\*?\s*/i, "").trim();
          setTurns(prev => {
            const updated = [...prev];
            const lastTurn = updated[updated.length - 1];
            if (!lastTurn || lastTurn.role !== "agent") return prev;
            updated[updated.length - 1] = {
              ...lastTurn,
              trace: [...lastTurn.trace],
              content: finalContent || lastTurn.content,
              status: status === "COMPLETED" ? "done" : status === "CANCELLED" ? "cancelled" : "error",
              hitlQuestion: undefined,
            };
            return updated;
          });
          setRunning(false);
          clearInterval(interval);
        }
      } catch (_) {}
    }, 3000); // poll every 3 seconds as fallback

    return () => clearInterval(interval);
  }, [running, sessionId]);

  // ── Helper: build Turn objects from one execution record ─────────────────
  function buildTurnsFromRun(record: any, runStatus: string): Turn[] {
    const logs: string[]  = record.logs || [];
    const prompt: string  = record.prompt || "";
    const trace: TraceEvent[] = [];
    let finalContent = "";

    for (const line of logs) {
      if (line.includes("✅ FINAL OUTPUT:") || line.includes("✅ **FINAL OUTPUT:**")) {
        finalContent = line.replace(/.*✅ \*?\*?FINAL OUTPUT:\*?\*?\s*/i, "").trim();
      } else {
        const parsed = parseLineToTrace(line);
        if (parsed && parsed.type !== "log") trace.push(parsed);
      }
    }
    const usage: Usage | undefined = record.total_tokens ? {
      input_tokens:       record.input_tokens  || 0,
      output_tokens:      record.output_tokens || 0,
      total_tokens:       record.total_tokens  || 0,
      estimated_cost_usd: parseFloat(record.cost_usd || "0"),
    } : undefined;
    const agentStatus: Turn["status"] =
      runStatus === "FAILED" ? "error" : runStatus === "CANCELLED" ? "cancelled" : "done";
    const turns: Turn[] = [];
    if (prompt) turns.push({ id: `${record.session_id}-u`, role: "user" as const, content: prompt, trace: [], status: "done" as const });
    turns.push({ id: `${record.session_id}-a`, role: "agent" as const, content: finalContent || "Session completed — expand trace to view execution steps.", trace, status: agentStatus, usage });
    return turns;
  }

  async function handleResume(conversationId: string, runStatus?: string) {
    setTurns([]);
    setRunning(false);
    setMode("orchestrator");
    setAgentId("");
    setSessionTotal({ input_tokens: 0, output_tokens: 0, total_tokens: 0, estimated_cost_usd: 0 });
    processedCountRef.current = 0;
    conversationGroupIdRef.current = conversationId;
    isFirstSendRef.current = false;

    try {
      const runsRes = await api.get<any[]>(`/api/executions/conversations/${conversationId}/runs`);
      const runs = runsRes.data ?? [];

      if (runs.length === 0) {
        const r = await executionsApi.get(conversationId);
        const rec = r.data as any;
        if (rec?.orchestrator_id) {
          const eid = rec.orchestrator_id;
          const isSA2 = (subAgents as any[] | undefined)?.some((sa: any) => sa.sub_agent_id === eid);
          if (isSA2) {
            setMode("agent"); setAgentId(eid);
          } else {
            setMode("orchestrator"); setOrchId(eid);
            const orch = orchestrators?.find(o => o.orchestrator_agent_id === eid);
            if (orch?.workflow_id) setWorkflowId(orch.workflow_id);
          }
        }
        setSessionId(conversationId);
        const st = rec?.status || "COMPLETED";
        if (st === "RUNNING" || st === "WAITING_FOR_HUMAN") {
          setRunning(true);
          setTurns([{ id: Date.now() + "-r", role: "agent", content: "", trace: [], status: "running" }]);
        } else {
          setTurns(buildTurnsFromRun(rec, st));
        }
        return;
      }

      if (runs[0]?.orchestrator_id) {
        const eid = runs[0].orchestrator_id;
        const isSA = (subAgents as any[] | undefined)?.some((sa: any) => sa.sub_agent_id === eid);
        if (isSA) {
          setMode("agent"); setAgentId(eid);
        } else {
          setMode("orchestrator"); setOrchId(eid);
          const orch = orchestrators?.find(o => o.orchestrator_agent_id === eid);
          if (orch?.workflow_id) setWorkflowId(orch.workflow_id);
        }
      }
      const lastRun = runs[runs.length - 1];
      setSessionId(lastRun.session_id);
      const lastStatus = lastRun?.status || "COMPLETED";
      const isActive   = lastStatus === "RUNNING" || lastStatus === "WAITING_FOR_HUMAN";

      if (isActive) {
        const completedTurns = runs.slice(0, -1).flatMap((r: any) => buildTurnsFromRun(r, r.status));
        setRunning(true);
        setTurns([...completedTurns, { id: `${lastRun.session_id}-r`, role: "agent" as const, content: "", trace: [], status: "running" as const }]);
      } else {
        const allTurns: Turn[] = [];
        let totalUsage: Usage  = { input_tokens: 0, output_tokens: 0, total_tokens: 0, estimated_cost_usd: 0 };
        for (const run of runs) {
          try {
            const full = await executionsApi.get(run.session_id);
            const rec  = full.data as any;
            allTurns.push(...buildTurnsFromRun(rec, run.status));
            if (rec.total_tokens) {
              totalUsage.input_tokens       += rec.input_tokens  || 0;
              totalUsage.output_tokens      += rec.output_tokens || 0;
              totalUsage.total_tokens       += rec.total_tokens  || 0;
              totalUsage.estimated_cost_usd += parseFloat(rec.cost_usd || "0");
            }
          } catch { allTurns.push({ id: `${run.session_id}-err`, role: "agent", content: "Could not load this exchange.", trace: [], status: "error" }); }
        }
        if (totalUsage.total_tokens > 0) setSessionTotal(totalUsage);
        setTurns(allTurns);
      }
    } catch {
      try {
        const r = await executionsApi.get(conversationId);
        const rec = r.data as any;
        setSessionId(conversationId);
        if (rec?.orchestrator_id) {
          const eid = rec.orchestrator_id;
          const isSA3 = (subAgents as any[] | undefined)?.some((sa: any) => sa.sub_agent_id === eid);
          if (isSA3) {
            setMode("agent"); setAgentId(eid);
          } else {
            setMode("orchestrator"); setOrchId(eid);
            const orch = orchestrators?.find(o => o.orchestrator_agent_id === eid);
            if (orch?.workflow_id) setWorkflowId(orch.workflow_id);
          }
        }
        setTurns(buildTurnsFromRun(rec, rec?.status || "COMPLETED"));
      } catch {
        setTurns([{ id: Date.now() + "-err", role: "agent", content: "Could not load conversation.", trace: [], status: "error" }]);
      }
    }
  }


  async function handleSend() {
    if (!input.trim() || running) return;
    if (mode === "orchestrator" && !orchId)   return;
    if (mode === "agent"        && !agentId)  return;
    const prompt = input.trim();
    setInput("");
    setSessionId(null);     // stop old poll + close old WS before new session starts
    setRunning(true);

    const userTurn: Turn = { id: Date.now() + "-u", role: "user", content: prompt, trace: [], status: "done" };
    const agentTurn: Turn = { id: Date.now() + "-a", role: "agent", content: "", trace: [], status: "running" };
    setTurns(prev => [...prev, userTurn, agentTurn]);
  
    try {
      // First send: don't pass conversation_id — backend uses session_id as conversation key.
      // Subsequent sends: pass the stored conversationGroupIdRef (= first session_id).
      const res = await api.post<{ session_id: string; conversation_id: string }>("/api/executions/", {
        orchestrator_id: mode === "agent" ? "" : orchId,
        trigger_id:      "manual",
        prompt,
        conversation_id: conversationGroupIdRef.current || null,
        ...(mode === "agent" ? { sub_agent_id: agentId } : {}),
      });
      setSessionId(res.data.session_id);
      if (isFirstSendRef.current) {
        conversationGroupIdRef.current = res.data.conversation_id || res.data.session_id;
        skipNextConvEffect.current = true;
        onConversationStarted(conversationGroupIdRef.current);
        isFirstSendRef.current = false;
        refreshSidebar();
      }
      globalToast("Workflow started", "info");
    } catch {
      globalToast("Failed to start workflow", "error");
      setRunning(false);
      setTurns(prev => prev.slice(0, -2));
    }
    inputRef.current?.focus();
  }

  function handleHitlSubmitted() {
    setHitlQuestion(null);
    setTurns(prev => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last?.role === "agent") {
        updated[updated.length - 1] = {
          ...last, status: "running", hitlQuestion: undefined,
        };
        setRunning(true);
      }
      return updated;
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleCancel() {
    if (!sessionId) return;
    try {
      await executionsApi.cancel(sessionId);
      globalToast("Execution cancelled");
    } catch {
      globalToast("Failed to cancel", "error");
    }
  }
  
  function handleReset() {
    setTurns([]);
    setSessionId(null);
    setRunning(false);
    setMode("orchestrator");
    setAgentId("");
    setWorkflowId("");
    setOrchId("");
    setSessionTotal({ input_tokens: 0, output_tokens: 0, total_tokens: 0, estimated_cost_usd: 0 });
    setInput("");
    processedCountRef.current = 0;
    isFirstSendRef.current         = true;
    conversationGroupIdRef.current  = null;
  }

  const canSend = mode === "agent"
    ? !!agentId && !!input.trim() && !running
    : !!orchId  && !!input.trim() && !running;
  const isWaiting = turns.some(t => t.role === "agent" && t.status === "waiting");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* Header */}
      <div style={{
        padding: "20px 32px 16px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-surface)",
        flexShrink: 0,
      }}>
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between", marginBottom: "14px",
        }}>
          <h1 style={{ fontSize: "18px", fontWeight: 600, letterSpacing: "-0.3px" }}>
            Run workflow
          </h1>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {running && !isWaiting && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{
                  width: "6px", height: "6px", borderRadius: "50%",
                  background: "var(--status-running)",
                  animation: "pulse 1.5s ease-in-out infinite",
                }} />
                <span style={{ fontSize: "12px", color: "var(--status-running)", fontWeight: 500 }}>
                  Agent running
                </span>
              </div>
            )}
            {isWaiting && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{
                  width: "6px", height: "6px", borderRadius: "50%",
                  background: "var(--status-waiting)",
                  animation: "pulse 1.5s ease-in-out infinite",
                }} />
                <span style={{ fontSize: "12px", color: "var(--status-waiting)", fontWeight: 500 }}>
                  Waiting for your input
                </span>
              </div>
            )}
            {sessionTotal.total_tokens > 0 && (
              <div style={{
                display: "flex", alignItems: "center", gap: "8px",
                fontSize: "12px", color: "var(--text-muted)",
                background: "var(--bg-elevated)", border: "1px solid var(--border)",
                padding: "4px 12px", borderRadius: "20px",
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>{sessionTotal.total_tokens.toLocaleString()} tokens</span>
                <span style={{ color: "var(--border-hover)" }}>·</span>
                <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                  ${sessionTotal.estimated_cost_usd.toFixed(4)}
                </span>
              </div>
            )}

            {/* Cancel button — only while running */}
            {running && (
              <button onClick={handleCancel} style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "6px 14px", borderRadius: "var(--radius)",
                background: "var(--status-failed-dim)",
                border: "1px solid rgba(255,92,92,0.3)",
                color: "var(--status-failed)", fontSize: "12px", fontWeight: 500,
                cursor: "pointer", fontFamily: "var(--font)", transition: "opacity 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.opacity = "0.8"}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.opacity = "1"}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                Cancel
              </button>
            )}

            {/* Replay button */}
            {turns.length > 0 && !running && conversationGroupIdRef.current && (
              <button
                onClick={() => {
                  const curOrch = orchestrators?.find(o => o.orchestrator_agent_id === orchId);
                  setReplayModelSel(curOrch?.model_id || "");
                  setReplayOption("same");
                  setShowReplayModal(true);
                }}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "6px 14px", borderRadius: "var(--radius)",
                  background: "var(--accent-dim)", border: "1px solid rgba(0,200,150,0.2)",
                  color: "var(--accent)", fontSize: "12px", fontWeight: 500,
                  cursor: "pointer", fontFamily: "var(--font)", transition: "all 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.opacity = "0.8"}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.opacity = "1"}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="1 4 1 10 7 10"/>
                  <path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
                </svg>
                Replay ↺
              </button>
            )}

            {/* Reset button — always visible when there are turns */}
            {turns.length > 0 && !running && (
              <button onClick={() => { handleReset(); onNewChat(); }} style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "6px 14px", borderRadius: "var(--radius)",
                background: "transparent",
                border: "1px solid var(--border-hover)",
                color: "var(--text-secondary)", fontSize: "12px", fontWeight: 500,
                cursor: "pointer", fontFamily: "var(--font)", transition: "all 0.15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(128,128,128,0.08)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)"; }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="1 4 1 10 7 10"/>
                  <path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
                </svg>
                New chat
              </button>
            )}
          </div>
        </div>

        {/* Mode toggle + Selectors */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {/* Mode pill toggle */}
          <div style={{
            display: "flex", gap: 0,
            background: "var(--bg-overlay)", border: "1px solid var(--border-hover)",
            borderRadius: "8px", padding: "2px", alignSelf: "flex-start",
          }}>
            {(["orchestrator", "agent"] as const).map(m => (
              <button
                key={m}
                disabled={turns.length > 0}
                onClick={() => {
                  if (turns.length > 0) return;
                  setMode(m); setOrchId(""); setAgentId(""); setWorkflowId("");
                }}
                style={{
                  padding: "5px 18px", borderRadius: "6px", fontSize: "12px",
                  fontWeight: 500, border: "none", fontFamily: "var(--font)",
                  cursor: turns.length > 0 ? "not-allowed" : "pointer",
                  transition: "all 0.15s",
                  background: mode === m ? "var(--accent)" : "transparent",
                  color:      mode === m ? "#0A0B0F" : "var(--text-secondary)",
                }}
              >
                {m === "orchestrator" ? "Orchestrator" : "Agent"}
              </button>
            ))}
          </div>

          {/* Selector row */}
          {mode === "orchestrator" ? (
            <div style={{ display: "flex", gap: "12px" }}>
              <div style={{ flex: 1 }}>
                <Field label="Workflow">
                  <select
                    value={workflowId}
                    onChange={e => { setWorkflowId(e.target.value); setOrchId(""); }}
                    disabled={turns.length > 0}
                    style={{ ...selectCss, opacity: turns.length > 0 ? 0.55 : 1, cursor: turns.length > 0 ? "not-allowed" : "pointer" }}
                  >
                    <option value="">All workflows</option>
                    {workflows?.map(w => (
                      <option key={w.workflow_id} value={w.workflow_id}>{w.name}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Orchestrator">
                  <select
                    value={orchId}
                    onChange={e => setOrchId(e.target.value)}
                    disabled={turns.length > 0}
                    style={{ ...selectCss, opacity: turns.length > 0 ? 0.55 : 1, cursor: turns.length > 0 ? "not-allowed" : "pointer" }}
                  >
                    <option value="">Select orchestrator...</option>
                    {filteredOrchestrators?.map(o => (
                      <option key={o.orchestrator_agent_id} value={o.orchestrator_agent_id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: "380px" }}>
              <Field label="Agent">
                <select
                  value={agentId}
                  onChange={e => setAgentId(e.target.value)}
                  disabled={turns.length > 0}
                  style={{ ...selectCss, opacity: turns.length > 0 ? 0.55 : 1, cursor: turns.length > 0 ? "not-allowed" : "pointer" }}
                >
                  <option value="">Select agent...</option>
                  {(subAgents as any[] | undefined)?.map((sa: any) => (
                    <option key={sa.sub_agent_id} value={sa.sub_agent_id}>
                      {sa.sub_agent_name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}
        </div>
      </div>

      {/* Conversation */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
        {turns.length === 0 && (
          <>
            <div style={{ textAlign: "center", paddingTop: "60px" }}>
              <div style={{
                width: "48px", height: "48px", borderRadius: "12px",
                background: "var(--accent-dim)", border: "1px solid rgba(0,200,150,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              </div>
              <div style={{ fontSize: "15px", fontWeight: 500, color: "var(--text-primary)", marginBottom: "6px" }}>
                Ready to run
              </div>
              <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                {mode === "agent"
                  ? "Select an agent above and type your first message"
                  : "Select an orchestrator above and type your first command"}
              </div>
            </div>

          </>
        )}

        {turns.map((turn, idx) =>
          turn.role === "user"
            ? <UserBubble key={turn.id} content={turn.content} />
            : <AgentBubble
                key={turn.id}
                turn={turn}
                sessionId={sessionId}
                onHitlSubmitted={handleHitlSubmitted}
                modelId={orchestrators?.find(o => o.orchestrator_agent_id === orchId)?.model_id}
                userPrompt={turns[idx - 1]?.role === "user" ? turns[idx - 1].content : undefined}
              />
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: "16px 32px 20px",
        borderTop: "1px solid var(--border)",
        background: "var(--bg-surface)",
        flexShrink: 0,
      }}>
        {((mode === "orchestrator" && !orchId) || (mode === "agent" && !agentId)) && (
          <div style={{
            fontSize: "12px", color: "var(--status-waiting)",
            marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px",
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {mode === "agent" ? "Select an agent to start" : "Select an orchestrator to start"}
          </div>
        )}

        {!_canPrompt ? (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "var(--bg-elevated)", border: "1px solid var(--border-hover)",
            borderRadius: "var(--radius-lg)", padding: "14px 12px",
            color: "var(--text-muted)", fontSize: "13px",
          }}>
            Your role has read-only access — you can view this conversation but not send messages.
          </div>
        ) : (
        <div style={{
          display: "flex", gap: "10px", alignItems: "flex-end",
          background: "var(--bg-elevated)", border: "1px solid var(--border-hover)",
          borderRadius: "var(--radius-lg)", padding: "10px 12px",
          opacity: isWaiting ? 0.5 : 1,
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isWaiting
                ? "Respond to the agent's question above first..."
                : mode === "agent"
                  ? (agentId ? "Chat with agent... (Enter to send)" : "Select an agent first...")
                  : (orchId  ? "Enter your command... (Enter to send, Shift+Enter for new line)"
                             : "Select an orchestrator first...")
            }
            disabled={running || (mode === "agent" ? !agentId : !orchId)}
            rows={1}
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              color: "var(--text-primary)", fontSize: "14px", fontFamily: "var(--font)",
              resize: "none", lineHeight: "1.5", maxHeight: "120px", overflowY: "auto",
              opacity: (running || (mode === "agent" ? !agentId : !orchId)) ? 0.5 : 1,
            }}
          />
          <button
            onClick={handleSend}
            disabled={!canSend}
            style={{
              width: "34px", height: "34px", borderRadius: "8px", flexShrink: 0,
              background: canSend ? "var(--accent)" : "var(--bg-overlay)",
              border: "none", cursor: canSend ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s",
            }}
          >
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke={canSend ? "#0A0B0F" : "var(--text-muted)"}
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
        )}

        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px", textAlign: "center" }}>
          Enter to send · Shift+Enter for new line
        </div>
      </div>

      {/* ── Replay modal ── */}
      {showReplayModal && (() => {
        const userTurns   = turns.filter(t => t.role === "user");
        const firstPrompt = userTurns[0]?.content || "";
        const curOrch     = orchestrators?.find(o => o.orchestrator_agent_id === orchId);
        const curModel    = curOrch?.model_id || "";
        const canStart    = replayOption !== "model" || !!replayModelSel;

        function fireReplay() {
          window.dispatchEvent(new CustomEvent("navigate", {
            detail: {
              page:                "replay",
              replayConvId:        conversationGroupIdRef.current,
              replayOrchId:        orchId,
              replayOrchName:      curOrch?.name || "",
              replayModelOverride: replayOption === "model" ? replayModelSel : null,
              replayPrompts:       userTurns.map(t => t.content),
              replayCost:          sessionTotal.estimated_cost_usd,
              replayModel:         curModel,
            },
          }));
          setShowReplayModal(false);
        }

        return (
          <div
            style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={e => { if (e.target === e.currentTarget) setShowReplayModal(false); }}
          >
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--border-radius-lg, 12px)", padding: "24px 28px", width: "480px", maxWidth: "92vw" }}>
              <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>Replay conversation</div>
              <div style={{ height: "0.5px", background: "var(--border)", margin: "10px 0 14px" }} />

              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>
                  <strong style={{ color: "var(--text-primary)" }}>Original:</strong>{" "}
                  "{firstPrompt.length > 70 ? firstPrompt.slice(0, 70) + "…" : firstPrompt}"
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  Ran: {userTurns.length} turn{userTurns.length !== 1 ? "s" : ""} · ${sessionTotal.estimated_cost_usd.toFixed(4)} · {mLabel(curModel)}
                </div>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "10px" }}>Replay options</div>
                {(["same", "model", "prompt"] as const).map(opt => (
                  <label key={opt} style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "8px 12px", borderRadius: "8px", cursor: "pointer", marginBottom: "6px",
                    background: replayOption === opt ? "var(--accent-dim)" : "transparent",
                    border: `1px solid ${replayOption === opt ? "rgba(0,200,150,0.2)" : "transparent"}`,
                  }}>
                    <input type="radio" name="ropt" value={opt} checked={replayOption === opt} onChange={() => setReplayOption(opt)} style={{ accentColor: "var(--accent)", flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>
                        {opt === "same"   && "Same settings"}
                        {opt === "model"  && "Different model"}
                        {opt === "prompt" && "Edited prompt"}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                        {opt === "same"   && `Exact replay with ${mLabel(curModel)}`}
                        {opt === "model"  && "Override the model for this replay only"}
                        {opt === "prompt" && "Uses current orchestrator system prompt"}
                      </div>
                    </div>
                    {opt === "model" && replayOption === "model" && (
                      <select
                        value={replayModelSel}
                        onChange={e => { e.stopPropagation(); setReplayModelSel(e.target.value); }}
                        onClick={e => e.stopPropagation()}
                        style={{ padding: "5px 8px", fontSize: "12px", background: "var(--bg-overlay)", border: "1px solid var(--border-hover)", borderRadius: "6px", color: "var(--text-primary)", fontFamily: "var(--font)", outline: "none", cursor: "pointer" }}
                      >
                        <option value="">Select model…</option>
                        {REPLAY_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                      </select>
                    )}
                  </label>
                ))}
              </div>

              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <button onClick={() => setShowReplayModal(false)} style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "13px", background: "transparent", border: "1px solid var(--border-hover)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)" }}>
                  Cancel
                </button>
                <button onClick={fireReplay} disabled={!canStart} style={{ padding: "8px 20px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, fontFamily: "var(--font)", border: "none", cursor: canStart ? "pointer" : "not-allowed", background: canStart ? "var(--accent)" : "var(--bg-overlay)", color: canStart ? "#0A0B0F" : "var(--text-muted)" }}>
                  Start replay ↺
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}