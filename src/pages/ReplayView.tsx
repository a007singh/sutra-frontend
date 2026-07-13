/**
 * ReplayView — split-panel execution replay
 * Left : original conversation from DB — read-only, greyed, full trace
 * Right: live replay — WebSocket trace exactly like RunWorkflow
 */
import { useState, useEffect, useRef } from "react";
import { api } from "../api/client";
import { executionsApi } from "../api/executions";
import { useExecutionWS } from "../hooks/useexecutionws";

interface Usage {
  input_tokens: number; output_tokens: number;
  total_tokens: number; estimated_cost_usd: number;
}
interface TraceEvent {
  type: "reasoning"|"delegating"|"tool_selected"|"tool_input"|"tool_result"|"log";
  content: string;
}
interface Turn {
  id: string; role: "user"|"agent"; content: string;
  trace: TraceEvent[]; status: "done"|"running"|"waiting"|"error";
  hitlQuestion?: string; usage?: Usage;
}

function renderMd(text: string) {
  return text
    .replace(/<thinking>[\s\S]*?<\/thinking>/g, "")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^- (.*)/gm, `<div style="display:flex;gap:8px;padding:2px 0"><span style="color:var(--text-muted)">•</span><span>$1</span></div>`)
    .replace(/\n\n/g, `<div style="height:6px"></div>`)
    .replace(/\n/g, "<br/>").trim();
}

function parseLine(line: string): TraceEvent | null {
  if (line.includes("Delegating to"))
    return { type: "delegating",    content: line.replace(/^.*?Delegating to[:\s]*/i, "").trim() };
  if (line.includes("Invoking MCP Tool") || line.includes("Tool Selected:"))
    return { type: "tool_selected", content: line.replace(/^.*?(Tool Selected:|🔨 Invoking MCP Tool:)[:\s]*/i, "").trim() };
  if (line.includes("Final Payload:") || line.includes("🚀"))
    return { type: "tool_input",    content: line.replace(/^.*?(Final Payload:|🚀)[:\s]*/i, "").trim() };
  if (line.includes("Tool Output:") || line.includes("📦"))
    return { type: "tool_result",   content: line.replace(/^.*?(Tool Output:|📦)[:\s]*/i, "").trim() };
  if (line.includes("Reasoning:"))
    return { type: "reasoning",     content: line.replace(/^.*?Reasoning:\s*/i, "") };
  return { type: "log", content: line };
}

function mLabel(id: string) {
  if (!id) return "Unknown";
  if (id.includes("nova-pro"))   return "Nova Pro";
  if (id.includes("nova-lite"))  return "Nova Lite";
  if (id.includes("nova-micro")) return "Nova Micro";
  if (id.includes("sonnet-4-5")) return "Claude Sonnet 4.5";
  if (id.includes("sonnet-4-6")) return "Claude Sonnet 4.6";
  if (id.includes("opus"))       return "Claude Opus";
  return id.split(":")[0].split(".").pop() || id;
}

function TracePanel({ trace, isRunning, isWaiting }: { trace: TraceEvent[]; isRunning?: boolean; isWaiting?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!trace.length && !isRunning && !isWaiting) return null;
  return (
    <div style={{ marginBottom: "8px" }}>
      {isWaiting && <div style={{ fontSize: "12px", color: "var(--status-waiting)", marginBottom: "4px" }}>⏸ Waiting for human input…</div>}
      {isRunning && !isWaiting && (
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic", marginBottom: trace.length ? "4px" : 0 }}>
          <div style={{ display: "flex", gap: "3px" }}>
            {[0,1,2].map(i => <div key={i} style={{ width: "4px", height: "4px", borderRadius: "50%", background: "var(--text-muted)", animation: `pulse 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
          </div>
          Running…
        </div>
      )}
      {trace.length > 0 && (
        <>
          <button onClick={() => setOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: "5px", background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: "11px", padding: "2px 0", fontFamily: "var(--font)" }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>
              <polyline points="9 18 15 12 9 6"/>
            </svg>
            {open ? "Hide" : "View"} trace
            <span style={{ fontSize: "10px", padding: "0 5px", borderRadius: "8px", background: "var(--accent-dim)", color: "var(--accent)" }}>{trace.length}</span>
          </button>
          {open && (
            <div style={{ border: "1px solid var(--border)", borderRadius: "6px", overflow: "hidden", marginTop: "4px" }}>
              {trace.map((t, i) => (
                <div key={i} style={{ padding: "7px 10px", borderBottom: i < trace.length - 1 ? "1px solid var(--border)" : "none", background: i % 2 ? "rgba(255,255,255,0.01)" : "transparent" }}>
                  {t.type === "delegating"    && <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>🤖 → <code style={{ color: "var(--status-running)", background: "var(--status-running-dim)", padding: "0 4px", borderRadius: "3px" }}>{t.content}</code></div>}
                  {t.type === "tool_selected" && <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>🔨 <code style={{ color: "var(--status-waiting)", background: "var(--status-waiting-dim)", padding: "0 4px", borderRadius: "3px" }}>{t.content}</code></div>}
                  {t.type === "tool_input"    && <pre style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--accent)", background: "var(--accent-dim)", padding: "5px 7px", borderRadius: "4px", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{t.content}</pre>}
                  {t.type === "tool_result"   && <pre style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--text-secondary)", background: "var(--bg-overlay)", padding: "5px 7px", borderRadius: "4px", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: "80px", overflowY: "auto" }}>{t.content}</pre>}
                  {t.type === "reasoning"     && <div style={{ fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic" }}>{t.content}</div>}
                  {t.type === "log"           && <div style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{t.content}</div>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function UserBubble({ content, dim }: { content: string; dim?: boolean }) {
  return (
    <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", marginBottom: "12px" }}>
      <div style={{ width: "26px", height: "26px", borderRadius: "6px", flexShrink: 0, background: dim ? "rgba(249,115,22,0.35)" : "linear-gradient(135deg,#f97316,#ea580c)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      </div>
      <div style={{ flex: 1, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "9px 13px", fontSize: "13px", color: dim ? "var(--text-muted)" : "var(--text-primary)", lineHeight: "1.6" }}>
        {content}
      </div>
    </div>
  );
}

function AgentBubbleView({ turn, sessionId, dim, onHitlSubmit }: {
  turn: Turn; sessionId: string | null; dim?: boolean; onHitlSubmit?: (a: string) => void;
}) {
  const [hitlInput, setHitlInput] = useState("");
  return (
    <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", marginBottom: "16px" }}>
      <div style={{ width: "26px", height: "26px", borderRadius: "6px", flexShrink: 0, background: dim ? "rgba(245,158,11,0.35)" : "linear-gradient(135deg,#f59e0b,#d97706)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/></svg>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "11px 13px" }}>
          <TracePanel trace={turn.trace} isRunning={turn.status === "running"} isWaiting={turn.status === "waiting"} />
          {turn.content && <div style={{ fontSize: "13px", color: dim ? "var(--text-muted)" : "var(--text-primary)", lineHeight: "1.7" }} dangerouslySetInnerHTML={{ __html: renderMd(turn.content) }} />}
          {turn.status === "error" && <div style={{ fontSize: "12px", color: "var(--status-failed)" }}>{turn.content || "Error."}</div>}
          {turn.usage && (
            <div style={{ display: "flex", gap: "10px", marginTop: "8px", paddingTop: "8px", borderTop: "1px solid var(--border)", fontSize: "11px", color: "var(--text-muted)", flexWrap: "wrap" }}>
              <span>{turn.usage.input_tokens.toLocaleString()} in</span>
              <span>{turn.usage.output_tokens.toLocaleString()} out</span>
              <span style={{ marginLeft: "auto", color: "var(--accent)", fontWeight: 600 }}>${turn.usage.estimated_cost_usd.toFixed(4)}</span>
            </div>
          )}
        </div>
        {turn.hitlQuestion && onHitlSubmit && (
          <div style={{ marginTop: "8px", padding: "12px 14px", background: "var(--status-waiting-dim)", border: "1px solid rgba(255,181,71,0.3)", borderRadius: "8px" }}>
            <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)", marginBottom: "10px" }}>{turn.hitlQuestion}</div>
            <div style={{ display: "flex", gap: "8px" }}>
              <input value={hitlInput} onChange={e => setHitlInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { onHitlSubmit(hitlInput); setHitlInput(""); } }} placeholder="Type your response…" autoFocus style={{ flex: 1, padding: "7px 11px", background: "var(--bg-overlay)", border: "1px solid var(--border-hover)", borderRadius: "6px", color: "var(--text-primary)", fontSize: "13px", fontFamily: "var(--font)", outline: "none" }} />
              <button onClick={() => { onHitlSubmit(hitlInput); setHitlInput(""); }} style={{ padding: "7px 14px", borderRadius: "6px", background: "var(--status-waiting)", border: "none", color: "#0A0B0F", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)" }}>Submit</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function OriginalPanel({ convId }: { convId: string }) {
  const [turns, setTurns]     = useState<Turn[]>([]);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const runsRes = await api.get<any[]>(`/api/executions/conversations/${convId}/runs`);
        const runs = runsRes.data || [];
        const out: Turn[] = [];
        for (const run of runs) {
          try {
            const full = await executionsApi.get(run.session_id);
            const rec  = full.data as any;
            const logs: string[] = rec.logs || [];
            const trace: TraceEvent[] = [];
            let finalContent = "";
            for (const line of logs) {
              if (line.includes("FINAL OUTPUT:")) {
                finalContent = line.replace(/.*✅ \*?\*?FINAL OUTPUT:\*?\*?\s*/i, "").trim();
              } else {
                const p = parseLine(line);
                if (p && p.type !== "log") trace.push(p);
              }
            }
            const usage: Usage | undefined = rec.total_tokens ? { input_tokens: rec.input_tokens || 0, output_tokens: rec.output_tokens || 0, total_tokens: rec.total_tokens || 0, estimated_cost_usd: parseFloat(rec.cost_usd || "0") } : undefined;
            if (rec.prompt) out.push({ id: `${run.session_id}-u`, role: "user",  content: rec.prompt, trace: [], status: "done" });
            out.push({ id: `${run.session_id}-a`, role: "agent", content: finalContent || "Session completed.", trace, status: "done", usage });
          } catch {
            out.push({ id: `${run.session_id}-err`, role: "agent", content: "Could not load this turn.", trace: [], status: "error" });
          }
        }
        setTurns(out);
      } catch {
        setTurns([{ id: "err", role: "agent", content: "Could not load original conversation.", trace: [], status: "error" }]);
      } finally { setLoading(false); }
    }
    load();
  }, [convId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [turns]);

  return (
    <div style={{ flex: "0 0 44%", overflowY: "auto", padding: "16px 14px 16px 24px", borderRight: "1px solid var(--border)", opacity: 0.62 }}>
      <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        Original · read-only
      </div>
      {loading ? <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Loading original…</div>
        : turns.map(t => t.role === "user" ? <UserBubble key={t.id} content={t.content} dim /> : <AgentBubbleView key={t.id} turn={t} sessionId={null} dim />)}
      <div ref={bottomRef} />
    </div>
  );
}

function ReplayPanel({ orchId, modelOverride, prompts }: { orchId: string; modelOverride: string | null; prompts: string[] }) {
  const [turns,     setTurns]     = useState<Turn[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [running,   setRunning]   = useState(false);
  const [queue,     setQueue]     = useState<string[]>([]);
  const [done,      setDone]      = useState(false);
  const [totalCost, setTotalCost] = useState(0);

  const convRef   = useRef<string | null>(null);
  const firstRef  = useRef(true);
  const procRef   = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { events } = useExecutionWS(sessionId);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [turns]);
  useEffect(() => { setQueue([...prompts]); }, []); // eslint-disable-line

  useEffect(() => {
    if (running) return;
    if (queue.length === 0) { if (!firstRef.current) setDone(true); return; }
    const [next, ...rest] = queue;
    setQueue(rest);
    firePrompt(next);
  }, [running, queue]); // eslint-disable-line

  useEffect(() => {
    if (!events.length) return;
    const newEvts = events.slice(procRef.current);
    procRef.current = events.length;
    for (const evt of newEvts) {
      if (evt.type === "hitl_question" && evt.question) {
        setTurns(prev => { const u=[...prev]; const l=u[u.length-1]; if (!l||l.role!=="agent") return prev; u[u.length-1]={...l,status:"waiting",hitlQuestion:evt.question}; return u; });
        continue;
      }
      if (evt.type === "usage") {
        const cost = evt.estimated_cost_usd || 0;
        const usage: Usage = { input_tokens: evt.input_tokens||0, output_tokens: evt.output_tokens||0, total_tokens: evt.total_tokens||0, estimated_cost_usd: cost };
        setTurns(prev => { const u=[...prev]; const l=u[u.length-1]; if (!l||l.role!=="agent") return prev; u[u.length-1]={...l,usage}; return u; });
        setTotalCost(p => p + cost);
        continue;
      }
      if (evt.type === "status") {
        const fin = ["COMPLETED","FAILED","CANCELLED"].includes(evt.status||"");
        if (fin) {
          const fc = (evt.line||"").replace(/.*✅ \*?\*?FINAL OUTPUT:\*?\*?\s*/i,"").trim();
          setTurns(prev => { const u=[...prev]; const l=u[u.length-1]; if (!l||l.role!=="agent") return prev; u[u.length-1]={...l,content:fc||l.content,status:evt.status==="COMPLETED"?"done":"error",hitlQuestion:undefined}; return u; });
          setRunning(false);
        }
        continue;
      }
      if (evt.type === "log" && evt.line) {
        const line = evt.line;
        if (line.includes("✅ FINAL OUTPUT:") || line.includes("✅ **FINAL OUTPUT:**")) {
          const fc = line.replace(/.*✅ \*?\*?FINAL OUTPUT:\*?\*?\s*/i,"").trim();
          setTurns(prev => { const u=[...prev]; const l=u[u.length-1]; if (!l||l.role!=="agent") return prev; u[u.length-1]={...l,content:fc,status:"done",hitlQuestion:undefined}; return u; });
          setRunning(false);
          continue;
        }
        const parsed = parseLine(line);
        if (parsed && parsed.type !== "log") {
          setTurns(prev => { const u=[...prev]; const l=u[u.length-1]; if (!l||l.role!=="agent") return prev; u[u.length-1]={...l,trace:[...l.trace,parsed]}; return u; });
        }
      }
    }
  }, [events]);

  async function firePrompt(prompt: string) {
    firstRef.current = false;
    setRunning(true);
    procRef.current = 0;
    const uTurn: Turn = { id: `${Date.now()}-u`, role: "user",  content: prompt, trace: [], status: "done" };
    const aTurn: Turn = { id: `${Date.now()}-a`, role: "agent", content: "",     trace: [], status: "running" };
    setTurns(prev => [...prev, uTurn, aTurn]);
    try {
      const body: any = { orchestrator_id: orchId, trigger_id: "manual", prompt, conversation_id: convRef.current || null };
      if (modelOverride) body.model_override = modelOverride;
      const res = await api.post<{ session_id: string; conversation_id: string }>("/api/executions/", body);
      setSessionId(res.data.session_id);
      if (!convRef.current) convRef.current = res.data.conversation_id || res.data.session_id;
    } catch {
      setTurns(prev => { const u=[...prev]; const l=u[u.length-1]; if (l?.role==="agent") u[u.length-1]={...l,content:"Failed to start.",status:"error"}; return u; });
      setRunning(false);
    }
  }

  async function handleHitl(answer: string) {
    if (!sessionId) return;
    await executionsApi.submitHitl(sessionId, answer);
    setTurns(prev => { const u=[...prev]; const l=u[u.length-1]; if (l?.role==="agent") u[u.length-1]={...l,status:"running",hitlQuestion:undefined}; return u; });
    setRunning(true);
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "16px 24px 0", flexShrink: 0, display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.07em", display: "flex", alignItems: "center", gap: "6px" }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
          Replay · live
        </div>
        {running && <div style={{ display: "flex", gap: "3px" }}>{[0,1,2].map(i => <div key={i} style={{ width: "4px", height: "4px", borderRadius: "50%", background: "var(--status-running)", animation: `pulse 1.2s ease-in-out ${i*0.2}s infinite` }} />)}</div>}
        {done && <span style={{ fontSize: "10px", color: "var(--status-done)", background: "rgba(0,200,100,0.1)", padding: "1px 8px", borderRadius: "8px" }}>✓ Done · ${totalCost.toFixed(4)}</span>}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 24px 16px" }}>
        {turns.map(t => t.role === "user" ? <UserBubble key={t.id} content={t.content} /> : <AgentBubbleView key={t.id} turn={t} sessionId={sessionId} onHitlSubmit={handleHitl} />)}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

interface Props {
  convId: string; orchId: string; orchName: string;
  modelOverride: string | null; prompts: string[];
  cost: number; model: string; onBack: () => void;
}

export default function ReplayView({ convId, orchId, orchName, modelOverride, prompts, cost, model, onBack }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ padding: "12px 24px", borderBottom: "1px solid var(--border)", background: "var(--bg-surface)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 12px", borderRadius: "6px", fontSize: "12px", background: "transparent", border: "1px solid var(--border-hover)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)" }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            Back
          </button>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>Replay — {orchName}</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "1px" }}>
              {prompts.length} turn{prompts.length !== 1 ? "s" : ""} · Original: {mLabel(model)} · ${cost.toFixed(4)}
              {modelOverride && ` → replaying with ${mLabel(modelOverride)}`}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "var(--text-muted)" }}>
          <span style={{ padding: "2px 10px", borderRadius: "10px", background: "var(--bg-overlay)", border: "1px solid var(--border)" }}>Original</span>
          <span>←→</span>
          <span style={{ padding: "2px 10px", borderRadius: "10px", background: "var(--accent-dim)", border: "1px solid rgba(0,200,150,0.2)", color: "var(--accent)" }}>Replay</span>
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <OriginalPanel convId={convId} />
        <ReplayPanel orchId={orchId} modelOverride={modelOverride} prompts={prompts} />
      </div>
    </div>
  );
}