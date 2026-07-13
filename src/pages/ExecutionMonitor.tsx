import { useState, useRef, useEffect } from "react";
import { executionsApi } from "../api/executions";
import { useExecutionWS } from "../hooks/useExecutionWS";
import type { WSEvent } from "../hooks/useExecutionWS";
import PageHeader from "../components/PageHeader";
import Badge from "../components/Badge";
import Field, { inputCss } from "../components/Field";

interface Props { initialSessionId?: string; }

function LogLine({ event }: { event: WSEvent }) {
  if (event.type === "hitl_question") return null;
  const line = event.line || "";
  const isError = line.includes("❌") || line.includes("ERROR");
  const isTool = line.includes("🔨") || line.includes("Tool");
  const isDone = line.includes("✅");
  const isAgent = line.includes("🤖") || line.includes("Agent");
  const color = isError ? "var(--status-failed)" : isDone ? "var(--status-done)" : isTool ? "var(--status-waiting)" : isAgent ? "var(--status-running)" : "var(--text-secondary)";
  return (
    <div style={{ padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.03)", display: "flex", gap: "12px", alignItems: "flex-start" }}>
      <span style={{ color: "var(--text-muted)", fontSize: "10px", fontFamily: "var(--font-mono)", flexShrink: 0, paddingTop: "2px", minWidth: "60px" }}>
        {new Date().toLocaleTimeString("en", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </span>
      <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color, lineHeight: "1.6", wordBreak: "break-all" }}>{line}</span>
    </div>
  );
}

export default function ExecutionMonitor({ initialSessionId }: Props) {
  const [orchId, setOrchId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "failed">(initialSessionId ? "running" : "idle");
  const [hitlAnswer, setHitlAnswer] = useState("");
  const logsEndRef = useRef<HTMLDivElement>(null);

  const { events, hitlQuestion, setHitlQuestion } = useExecutionWS(sessionId);

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [events]);
  useEffect(() => {
    const last = events[events.length - 1];
    if (last?.type === "status") setStatus(last.status === "COMPLETED" ? "done" : last.status === "FAILED" ? "failed" : "running");
  }, [events]);

  async function handleTrigger() {
    if (!orchId || !prompt) return;
    const res = await executionsApi.trigger(orchId, "manual", prompt);
    setSessionId(res.data.session_id);
    setStatus("running");
  }

  async function handleHitlSubmit() {
    if (!sessionId || !hitlAnswer) return;
    await executionsApi.submitHitl(sessionId, hitlAnswer);
    setHitlAnswer("");
    setHitlQuestion(null);
  }

  const statusVariant = status === "running" ? "running" : status === "done" ? "done" : status === "failed" ? "failed" : "default";

  return (
    <div style={{ padding: "28px 32px", height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 600, letterSpacing: "-0.3px" }}>Live monitor</h1>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "3px" }}>Real-time agent execution traces</p>
        </div>
        {sessionId && <Badge variant={statusVariant}>{status === "running" ? "Running" : status === "done" ? "Completed" : status === "failed" ? "Failed" : "Idle"}</Badge>}
      </div>

      {/* Trigger bar */}
      {!sessionId && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "16px 20px", marginBottom: "16px", display: "flex", gap: "12px", alignItems: "flex-end" }}>
          <Field label="Orchestrator ID" >
            <input value={orchId} onChange={e => setOrchId(e.target.value)} placeholder="orchestrator_agent_id" style={{ ...inputCss, fontFamily: "var(--font-mono)", fontSize: "12px", width: "280px" }} />
          </Field>
          <Field label="Prompt">
            <input value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="What should the agent do?" style={{ ...inputCss, width: "300px" }} />
          </Field>
          <button onClick={handleTrigger} style={{ padding: "9px 20px", borderRadius: "var(--radius)", background: "var(--accent)", border: "none", color: "#0A0B0F", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)", flexShrink: 0 }}>
            Run
          </button>
        </div>
      )}

      {/* Session info */}
      {sessionId && (
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Session</span>
          <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-secondary)", background: "var(--bg-elevated)", padding: "2px 8px", borderRadius: "4px" }}>{sessionId}</span>
          <button onClick={() => { setSessionId(null); setStatus("idle"); }} style={{ fontSize: "11px", color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", marginLeft: "auto" }}>New session</button>
        </div>
      )}

      {/* Log panel */}
      <div style={{ flex: 1, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", display: "flex", flexDirection: "column", minHeight: "320px" }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: status === "running" ? "var(--status-running)" : "var(--text-muted)" }} />
          <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase" }}>Execution trace</span>
          <span style={{ marginLeft: "auto", fontSize: "11px", color: "var(--text-muted)" }}>{events.filter(e => e.type === "log").length} events</span>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          {events.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: "12px", fontFamily: "var(--font-mono)", paddingTop: "8px" }}>
              {sessionId ? "Waiting for agent output..." : "Start a run to see the live trace here."}
            </div>
          ) : events.map((e, i) => <LogLine key={i} event={e} />)}
          <div ref={logsEndRef} />
        </div>
      </div>

      {/* HITL panel */}
      {hitlQuestion && (
        <div style={{ marginTop: "12px", background: "var(--status-waiting-dim)", border: "1px solid rgba(255,181,71,0.25)", borderRadius: "var(--radius-lg)", padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--status-waiting)", animation: "pulse 1.5s ease-in-out infinite" }} />
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--status-waiting)" }}>Agent requires your input</span>
          </div>
          <p style={{ fontSize: "13px", color: "var(--text-primary)", marginBottom: "12px", lineHeight: "1.6" }}>{hitlQuestion}</p>
          <div style={{ display: "flex", gap: "8px" }}>
            <input value={hitlAnswer} onChange={e => setHitlAnswer(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleHitlSubmit()}
              placeholder="Type your response..."
              style={{ ...inputCss, flex: 1 }} />
            <button onClick={handleHitlSubmit} style={{ padding: "9px 20px", borderRadius: "var(--radius)", background: "var(--status-waiting)", border: "none", color: "#0A0B0F", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)" }}>
              Submit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}