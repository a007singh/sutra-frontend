/**
 * FlowDiagram.tsx
 * ================
 * Modal popup that renders a visual execution flow diagram from turn.trace.
 *
 * Two-layer approach:
 *  1. Rule-based summaries render instantly when modal opens (zero latency)
 *  2. One Bedrock Nova Pro call fires in the background → summaries update
 *     in-place per tool row when the response arrives
 *  3. If the API call fails → rule-based summaries stay (no regression)
 *
 * Changes from RunWorkflow.tsx: zero (only FlowDiagram is touched here)
 */

import { useState, useEffect, useRef } from "react";
import { api } from "../api/client";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TraceEvent {
  type: "reasoning" | "delegating" | "tool_selected" | "tool_input" | "tool_result" | "log";
  content: string;
}

interface ToolCall {
  name:       string;
  input:      string | null;
  output:     string | null;
  status:     "success" | "error" | "pending";
  ruleInput:  string;   // instant rule-based summary
  ruleOutput: string;
  flatIdx:    number;   // position in flattened tool list
}

interface AgentNode {
  name:            string;
  tools:           ToolCall[];
  thinkingSnippet: string;
}

interface AiSummary {
  inputSummary:  string;
  outputSummary: string;
}

interface FlowDiagramProps {
  trace:        TraceEvent[];
  userPrompt?:  string;     // the user's question/command
  agentOutput?: string;     // the agent's final response
  modelId?:     string;     // orchestrator model ID — falls back to Nova Pro
  onClose:      () => void;
}

// ── Agent colour palette ──────────────────────────────────────────────────────

const AGENT_COLOURS = [
  { bg: "#0F3460", border: "#1a5276", badge: "#2980b9" },
  { bg: "#1a3c34", border: "#1e8449", badge: "#27ae60" },
  { bg: "#3d1a5e", border: "#7d3c98", badge: "#9b59b6" },
  { bg: "#3d2000", border: "#b7770d", badge: "#e67e22" },
  { bg: "#1a0a0a", border: "#922b21", badge: "#e74c3c" },
  { bg: "#0d2d3a", border: "#0e6655", badge: "#1abc9c" },
  { bg: "#2c1654", border: "#6c3483", badge: "#8e44ad" },
  { bg: "#1a2a00", border: "#4a7c0a", badge: "#7dbb00" },
];

// ── Rule-based translator (instant fallback) ──────────────────────────────────

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function humanizePayload(raw: string): string {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return truncate(raw, 120);
    const obj = JSON.parse(
      jsonMatch[0]
        .replace(/'/g, '"')
        .replace(/\bNone\b/g, "null")
        .replace(/\bTrue\b/g, "true")
        .replace(/\bFalse\b/g, "false")
    );
    const parts: string[] = [];
    if (obj.query)           parts.push(`query: "${obj.query}"`);
    if (obj.action)          parts.push(`action: "${obj.action}"`);
    if (obj.prefix)          parts.push(`prefix: "${obj.prefix}"`);
    if (obj.s3_key)          parts.push(`file: "${obj.s3_key.split("/").pop()}"`);
    if (obj.patient_id)      parts.push(`patient: ${obj.patient_id}`);
    if (obj.policy_number)   parts.push(`policy: ${obj.policy_number}`);
    if (obj.diagnosis_icd)   parts.push(`ICD: ${obj.diagnosis_icd}`);
    if (obj.procedure_code)  parts.push(`CPT: ${obj.procedure_code}`);
    if (obj.source_id)       parts.push(`source: ${obj.source_id}`);
    if (obj.project_key)     parts.push(`project: ${obj.project_key}`);
    if (obj.epic_id)         parts.push(`epic: ${obj.epic_id}`);
    if (obj.story_id)        parts.push(`story: ${obj.story_id}`);
    if (obj.transition)      parts.push(`→ ${obj.transition}`);
    if (obj.tags)            parts.push(`tags: ${obj.tags}`);
    if (obj.kwargs)          parts.push(truncate(String(obj.kwargs), 80));
    if (obj.stories)         parts.push(`${Array.isArray(obj.stories) ? obj.stories.length : "N"} stories`);
    if (parts.length === 0) {
      Object.entries(obj)
        .filter(([, v]) => v !== null && v !== "")
        .slice(0, 2)
        .forEach(([k, v]) => parts.push(`${k}: ${truncate(String(v), 40)}`));
    }
    return parts.join("  ·  ") || truncate(raw, 100);
  } catch {
    return truncate(raw.replace(/Final Payload:\s*/i, "").trim(), 120);
  }
}

function humanizeResult(raw: string, isError: boolean): string {
  if (isError) {
    return raw.includes("ValidationException")
      ? "❌ Validation error — invalid request parameters"
      : "❌ Tool returned an error";
  }
  try {
    const outerMatch = raw.match(/"content":\s*\[.*?"text":\s*"(.*?)"\s*\}/s);
    let inner: any = raw;
    if (outerMatch) {
      try { inner = JSON.parse(outerMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\")); }
      catch { inner = outerMatch[1]; }
    }
    const jsonMatch = typeof inner === "string" ? inner.match(/\{[\s\S]*\}/) : null;
    const obj: any  = jsonMatch ? JSON.parse(jsonMatch[0]) : (typeof inner === "object" ? inner : null);
    if (!obj) return "✓ Done";

    if (obj.count !== undefined && obj.files)      return `✓ ${obj.count} file${obj.count !== 1 ? "s" : ""} found`;
    if (obj.total_documents !== undefined)          return `✓ ${obj.total_documents} documents in KB`;
    if (obj.ok === true && obj.epic_key)            return `✓ Epic ${obj.epic_key} created`;
    if (obj.ok === true && obj.created !== undefined) return `✓ ${obj.created} stories created`;
    if (obj.story_key)                              return `✓ Story ${obj.story_key} — ${obj.status || "done"}`;
    if (obj.coverage_status)                        return `✓ ${obj.coverage_status}`;
    if (obj.all_documents_ready === false)           return `⚠ ${obj.missing_count} doc${obj.missing_count !== 1 ? "s" : ""} missing`;
    if (obj.is_network === false)                   return `⚠ Not in network — reimbursement only`;
    if (obj.clinical_necessity_met !== undefined)   return `✓ Clinical necessity: ${obj.clinical_necessity_met ? "ESTABLISHED" : "NOT MET"}`;
    if (obj.determination)                          return `✓ ${obj.determination} (confidence: ${obj.confidence_score ?? "?"})`;
    if (obj.raw_text)                               return `✓ ${obj.char_count || "?"} chars extracted`;
    if (obj.error)                                  return `❌ ${truncate(String(obj.error), 100)}`;
    if (obj.ok && obj.message)                      return `✓ ${obj.message}`;

    const summary = ["status","message","summary","result","determination"];
    for (const f of summary) {
      if (obj[f]) return `✓ ${truncate(String(obj[f]), 100)}`;
    }
    return "✓ Success";
  } catch {
    return "✓ Done";
  }
}

// ── Trace Parser ──────────────────────────────────────────────────────────────

function parseTrace(trace: TraceEvent[]): AgentNode[] {
  const agents: AgentNode[] = [];
  let currentAgent: AgentNode | null = null;
  let currentTool:  ToolCall  | null = null;
  let flatIdx = 0;

  for (const evt of trace) {
    const c = evt.content || "";
    if (evt.type === "delegating") {
      const name = c.replace(/^Delegating to\s*/i, "").replace(/\.\.\.\s*$/, "").replace(/^🤖\s*/, "").trim();
      currentAgent = { name, tools: [], thinkingSnippet: "" };
      agents.push(currentAgent);
      currentTool = null;
    } else if (evt.type === "tool_selected") {
      const name = c.replace(/^Tool:\s*/i, "").replace(/^🔨\s*/, "").trim();
      currentTool = { name, input: null, output: null, status: "pending", ruleInput: "", ruleOutput: "", flatIdx: flatIdx++ };
      currentAgent?.tools.push(currentTool);
    } else if (evt.type === "tool_input") {
      if (currentTool) {
        const raw = c.replace(/^Input:\s*/i, "").replace(/^🚀\s*/i, "").trim();
        currentTool.input   = raw;
        currentTool.ruleInput = humanizePayload(raw);
      }
    } else if (evt.type === "tool_result") {
      if (currentTool) {
        const raw = c.replace(/^Result:\s*/i, "").replace(/^📦\s*/i, "").trim();
        currentTool.output = raw;
        const isError = raw.includes('"isError": true') || raw.includes('"isError":true') || raw.includes('"status": "error"');
        currentTool.status     = isError ? "error" : "success";
        currentTool.ruleOutput = humanizeResult(raw, isError);
      }
    } else if (evt.type === "reasoning") {
      if (currentAgent && !currentAgent.thinkingSnippet) {
        currentAgent.thinkingSnippet = truncate(c.replace(/<\/?thinking>/g, "").trim(), 100);
      }
    }
  }
  return agents;
}

// ── Build request payload for the backend ─────────────────────────────────────

function buildRequestTools(agents: AgentNode[]) {
  const tools: { agent: string; tool: string; input: string | null; output: string | null }[] = [];
  for (const agent of agents) {
    for (const t of agent.tools) {
      tools.push({
        agent:  agent.name,
        tool:   t.name,
        input:  t.input  ? t.input.replace(/Final Payload:\s*/i, "").slice(0, 600)  : null,
        output: t.output ? t.output.replace(/Result: Tool Output:\s*/i, "").slice(0, 600) : null,
      });
    }
  }
  return tools;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AiChip() {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "3px",
      fontSize: "9px", padding: "1px 6px", borderRadius: "8px",
      background: "rgba(0,190,180,0.12)", border: "1px solid rgba(0,190,180,0.3)",
      color: "#00BEB4", fontWeight: 700, letterSpacing: "0.5px",
      marginLeft: "6px", flexShrink: 0,
    }}>
      ✦ AI
    </span>
  );
}

function ToolRow({
  tool, idx, aiSummary, aiLoading,
}: {
  tool: ToolCall;
  idx: number;
  aiSummary?: AiSummary;
  aiLoading: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const statusColor = tool.status === "error"   ? "#e74c3c"
                    : tool.status === "success"  ? "#2ecc71"
                    : "#f39c12";
  const statusIcon  = tool.status === "error"   ? "✗"
                    : tool.status === "success"  ? "✓"
                    : "◎";

  // Use AI summary if available; fall back to rule-based
  const inputText  = aiSummary?.inputSummary  || tool.ruleInput;
  const outputText = aiSummary?.outputSummary || tool.ruleOutput;
  const isAi       = Boolean(aiSummary?.inputSummary || aiSummary?.outputSummary);

  // Loading shimmer for this tool while AI is in flight
  const loadingShimmer = aiLoading && !aiSummary && (tool.ruleInput === "" || tool.ruleOutput === "");

  return (
    <div style={{ borderTop: idx > 0 ? "1px solid rgba(255,255,255,0.06)" : "none", padding: "8px 12px" }}>
      <div
        onClick={() => (tool.input || tool.output) && setExpanded(e => !e)}
        style={{ display: "flex", alignItems: "flex-start", gap: "8px", cursor: (tool.input || tool.output) ? "pointer" : "default" }}
      >
        {/* Status dot */}
        <div style={{
          width: "18px", height: "18px", borderRadius: "50%",
          background: `${statusColor}22`, border: `1.5px solid ${statusColor}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "9px", color: statusColor, flexShrink: 0, marginTop: "1px",
        }}>
          {statusIcon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Tool name + AI badge */}
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#e8f4f8", fontFamily: "monospace" }}>
              {tool.name}
            </span>
            {isAi && <AiChip />}
            {(tool.input || tool.output) && (
              <span style={{ fontSize: "9px", color: "#8ca0b3", fontFamily: "sans-serif" }}>
                {expanded ? "▲ hide" : "▼ detail"}
              </span>
            )}
          </div>

          {/* Input summary */}
          {loadingShimmer ? (
            <div style={{ height: "11px", width: "60%", borderRadius: "3px", background: "rgba(255,255,255,0.06)", marginTop: "4px", animation: "shimmer 1.4s ease infinite" }} />
          ) : inputText ? (
            <div style={{ fontSize: "11px", color: "#8ca0b3", marginTop: "3px" }}>
              ↳ {inputText}
            </div>
          ) : null}

          {/* Output summary */}
          {loadingShimmer ? (
            <div style={{ height: "11px", width: "45%", borderRadius: "3px", background: "rgba(255,255,255,0.06)", marginTop: "4px", animation: "shimmer 1.4s ease infinite" }} />
          ) : outputText ? (
            <div style={{ fontSize: "11px", color: tool.status === "error" ? "#e74c3c" : "#7dbb00", marginTop: "3px" }}>
              {outputText}
            </div>
          ) : null}
        </div>
      </div>

      {/* Expandable raw payload */}
      {expanded && (tool.input || tool.output) && (
        <div style={{ marginTop: "8px", marginLeft: "26px", borderLeft: "2px solid rgba(255,255,255,0.08)", paddingLeft: "10px" }}>
          {tool.input && (
            <div style={{ marginBottom: "6px" }}>
              <div style={{ fontSize: "9px", color: "#5a7a8a", fontWeight: 700, letterSpacing: "1px", marginBottom: "3px" }}>INPUT</div>
              <pre style={{ fontSize: "10px", color: "#8ca0b3", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: "120px", overflowY: "auto", background: "rgba(0,0,0,0.3)", padding: "6px 8px", borderRadius: "4px" }}>
                {tool.input.replace(/Final Payload:\s*/i, "")}
              </pre>
            </div>
          )}
          {tool.output && (
            <div>
              <div style={{ fontSize: "9px", color: "#5a7a8a", fontWeight: 700, letterSpacing: "1px", marginBottom: "3px" }}>OUTPUT</div>
              <pre style={{ fontSize: "10px", color: "#8ca0b3", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: "180px", overflowY: "auto", background: "rgba(0,0,0,0.3)", padding: "6px 8px", borderRadius: "4px" }}>
                {tool.output.replace(/Result: Tool Output:\s*/i, "").slice(0, 2000)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AgentCard({
  agent, idx, isLast, aiSummaries, aiLoading,
}: {
  agent: AgentNode;
  idx: number;
  isLast: boolean;
  aiSummaries: Record<number, AiSummary>;
  aiLoading: boolean;
}) {
  const colour      = AGENT_COLOURS[idx % AGENT_COLOURS.length];
  const errorCount  = agent.tools.filter(t => t.status === "error").length;
  const successCount= agent.tools.filter(t => t.status === "success").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: "100%", background: colour.bg, border: `1px solid ${colour.border}`, borderRadius: "10px", overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>
        {/* Header */}
        <div style={{ background: colour.border, padding: "10px 14px", display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "15px" }}>🤖</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>{agent.name}</div>
            {agent.thinkingSnippet && (
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)", marginTop: "2px" }}>{agent.thinkingSnippet}</div>
            )}
          </div>
          <div style={{ display: "flex", gap: "5px", flexShrink: 0 }}>
            {successCount > 0 && (
              <div style={{ background: "#2ecc7133", border: "1px solid #2ecc71", borderRadius: "10px", padding: "1px 7px", fontSize: "10px", color: "#2ecc71", fontWeight: 700 }}>
                {successCount} ✓
              </div>
            )}
            {errorCount > 0 && (
              <div style={{ background: "#e74c3c33", border: "1px solid #e74c3c", borderRadius: "10px", padding: "1px 7px", fontSize: "10px", color: "#e74c3c", fontWeight: 700 }}>
                {errorCount} ✗
              </div>
            )}
            {agent.tools.length === 0 && (
              <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: "10px", padding: "1px 7px", fontSize: "10px", color: "rgba(255,255,255,0.4)" }}>no tools</div>
            )}
          </div>
        </div>

        {/* Tools */}
        {agent.tools.map((tool, i) => (
          <ToolRow
            key={i}
            tool={tool}
            idx={i}
            aiSummary={aiSummaries[tool.flatIdx]}
            aiLoading={aiLoading}
          />
        ))}
      </div>

      {/* Connector */}
      {!isLast && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 0" }}>
          <div style={{ width: "2px", height: "20px", background: "rgba(255,255,255,0.15)" }} />
          <div style={{ width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "8px solid rgba(255,255,255,0.2)" }} />
        </div>
      )}
    </div>
  );
}

function FlowSummary({ agents, aiLoading, aiDone }: { agents: AgentNode[]; aiLoading: boolean; aiDone: boolean }) {
  const totalTools  = agents.reduce((n, a) => n + a.tools.length, 0);
  const totalErrors = agents.reduce((n, a) => n + a.tools.filter(t => t.status === "error").length, 0);
  const totalOk     = agents.reduce((n, a) => n + a.tools.filter(t => t.status === "success").length, 0);

  return (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", padding: "10px 0 14px", alignItems: "center" }}>
      {[
        { label: "Agents",    value: agents.length, color: "#2980b9" },
        { label: "Tool calls",value: totalTools,    color: "#8e44ad" },
        { label: "Succeeded", value: totalOk,       color: "#27ae60" },
        { label: "Errors",    value: totalErrors,   color: totalErrors > 0 ? "#e74c3c" : "#4a5568" },
      ].map(s => (
        <div key={s.label} style={{ background: `${s.color}18`, border: `1px solid ${s.color}44`, borderRadius: "8px", padding: "5px 14px", display: "flex", flexDirection: "column", alignItems: "center", minWidth: "68px" }}>
          <span style={{ fontSize: "18px", fontWeight: 700, color: s.color }}>{s.value}</span>
          <span style={{ fontSize: "10px", color: "#8ca0b3", marginTop: "1px" }}>{s.label}</span>
        </div>
      ))}

      {/* AI status pill */}
      <div style={{ marginLeft: "auto" }}>
        {aiLoading && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "5px 12px", borderRadius: "20px", background: "rgba(0,190,180,0.08)", border: "1px solid rgba(0,190,180,0.25)" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", border: "1.5px solid #00BEB4", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
            <span style={{ fontSize: "11px", color: "#00BEB4", fontWeight: 600 }}>AI summarising…</span>
          </div>
        )}
        {aiDone && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "5px 12px", borderRadius: "20px", background: "rgba(0,190,180,0.08)", border: "1px solid rgba(0,190,180,0.25)" }}>
            <span style={{ fontSize: "11px", color: "#00BEB4", fontWeight: 600 }}>✦ AI summaries active</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

// Module-level cache: trace signature → summaries map
// Persists across modal open/close within the same browser session
const summaryCache = new Map<string, Record<number, AiSummary>>();

function traceKey(trace: TraceEvent[]): string {
  // Key = type sequence + first/last content snippet
  return trace.length + "|" + trace.map(e => e.type[0]).join("") + "|" + (trace[0]?.content.slice(0, 20) ?? "");
}

export default function FlowDiagram({ trace, userPrompt, agentOutput, modelId, onClose }: FlowDiagramProps) {
  const agents      = parseTrace(trace);
  const [aiSummaries, setAiSummaries] = useState<Record<number, AiSummary>>({});
  const [aiLoading,   setAiLoading  ] = useState(false);
  const [aiDone,      setAiDone     ] = useState(false);
  const scrollRef   = useRef<HTMLDivElement>(null);
  const cacheKey    = traceKey(trace);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Fire AI summarisation once per unique trace (cached)
  useEffect(() => {
    if (agents.length === 0) return;

    // Cache hit → instant
    const cached = summaryCache.get(cacheKey);
    if (cached) {
      setAiSummaries(cached);
      setAiDone(true);
      return;
    }

    const requestTools = buildRequestTools(agents);
    if (requestTools.length === 0) return;

    setAiLoading(true);
    setAiDone(false);

    api.post("/api/trace/summarise", { tools: requestTools, model_id: modelId || undefined })
      .then(res => {
        const list: { agent: string; tool: string; inputSummary: string; outputSummary: string }[] =
          res.data?.summaries ?? [];

        // Build flatIdx → AiSummary map
        const map: Record<number, AiSummary> = {};
        let flatIdx = 0;
        for (const agent of agents) {
          for (const tool of agent.tools) {
            if (flatIdx < list.length) {
              const row = list[flatIdx];
              if (row.inputSummary || row.outputSummary) {
                map[tool.flatIdx] = {
                  inputSummary:  row.inputSummary  || "",
                  outputSummary: row.outputSummary || "",
                };
              }
            }
            flatIdx++;
          }
        }

        summaryCache.set(cacheKey, map);
        setAiSummaries(map);
        setAiDone(true);
      })
      .catch(err => {
        // Silently fall back to rule-based summaries
        console.warn("AI trace summarisation failed — using rule-based summaries", err);
      })
      .finally(() => setAiLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.78)",
        backdropFilter: "blur(4px)",
        zIndex: 9999,
        display: "flex", alignItems: "stretch", justifyContent: "center",
        padding: "24px",
      }}
    >
      {/* Shimmer + spin keyframes */}
      <style>{`
        @keyframes shimmer {
          0%   { opacity: 0.3; }
          50%  { opacity: 0.7; }
          100% { opacity: 0.3; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Modal panel */}
      <div style={{
        background: "#0d1b2a",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: "14px",
        width: "100%", maxWidth: "700px",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", gap: "12px",
          background: "#0f2035", flexShrink: 0,
        }}>
          <div style={{
            width: "34px", height: "34px", borderRadius: "8px",
            background: "linear-gradient(135deg, #0e8a8a, #1a5276)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "16px", flexShrink: 0,
          }}>
            📊
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#e8f4f8" }}>
              Execution Flow
            </div>
            {prompt && (
              <div style={{ fontSize: "11px", color: "#8ca0b3", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {userPrompt.slice(0, 110)}{userPrompt.length > 110 ? "…" : ""}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              width: "28px", height: "28px", borderRadius: "6px",
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              color: "#8ca0b3", cursor: "pointer", fontSize: "14px",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "0 20px 20px" }}>
          {agents.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", color: "#8ca0b3", gap: "12px" }}>
              <span style={{ fontSize: "36px" }}>⏳</span>
              <div style={{ fontSize: "14px" }}>Trace is still building…</div>
              <div style={{ fontSize: "12px", color: "#5a7a8a" }}>Re-open once execution completes.</div>
            </div>
          ) : (
            <>
              <FlowSummary agents={agents} aiLoading={aiLoading} aiDone={aiDone} />

              {/* User prompt box */}
              {prompt && (
                <>
                  <div style={{ background: "#1a2e44", border: "1px solid #2e4a6a", borderRadius: "10px", padding: "10px 14px", marginBottom: "0" }}>
                    <div style={{ fontSize: "10px", color: "#5a8a9a", fontWeight: 700, letterSpacing: "1px", marginBottom: "4px" }}>USER PROMPT</div>
                    <div style={{ fontSize: "13px", color: "#c8dce8", lineHeight: "1.5" }}>{userPrompt}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 0" }}>
                    <div style={{ width: "2px", height: "20px", background: "rgba(255,255,255,0.15)" }} />
                    <div style={{ width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "8px solid rgba(255,255,255,0.2)" }} />
                  </div>
                </>
              )}

              {agents.map((agent, idx) => (
                <AgentCard
                  key={idx}
                  agent={agent}
                  idx={idx}
                  isLast={idx === agents.length - 1}
                  aiSummaries={aiSummaries}
                  aiLoading={aiLoading}
                />
              ))}

                {/* Output Result box */}
                {agentOutput && (
                  <>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 0" }}>
                      <div style={{ width: "2px", height: "20px", background: "rgba(255,255,255,0.15)" }} />
                      <div style={{ width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "8px solid rgba(255,255,255,0.2)" }} />
                    </div>
                    <div style={{ background: "#0f2e1a", border: "1px solid #1e5c30", borderRadius: "10px", padding: "10px 14px" }}>
                      <div style={{ fontSize: "10px", color: "#3a9a5a", fontWeight: 700, letterSpacing: "1px", marginBottom: "4px" }}>
                        OUTPUT RESULT
                      </div>
                      <div style={{ fontSize: "13px", color: "#a8d8b8", lineHeight: "1.6", whiteSpace: "pre-wrap", maxHeight: "200px", overflowY: "auto" }}>
                        {agentOutput}
                      </div>
                    </div>
                  </>
                )}

              <div style={{ marginTop: "16px", padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: "8px", fontSize: "11px", color: "#5a7a8a" }}>
                💡 Click any tool row to expand raw input/output.
                {aiDone ? " ✦ AI-powered summaries courtesy of Amazon Nova Pro." : " AI summaries load in the background."}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
