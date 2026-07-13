import { useState, useEffect, useRef, useCallback } from "react";
import { brainApi } from "../api/secondBrain";
import type { BrainConfig, AskResult, FolderCount, BrainConversationMeta, BrainTurn } from "../api/secondBrain";

/**
 * BrainChat.tsx — Second Brain — Ask (persisted, per-user conversations)
 * =====================================================================
 * The employee interface: ask a question, get a grounded answer with citations
 * and a confidence badge. Conversations are persisted PER USER (each user sees
 * only their own threads), with a sidebar and a "New conversation" button —
 * mirroring the workflow execution chat.
 *
 * Place at: frontend/src/pages/BrainChat.tsx
 */

interface LiveTurn {
  q: string;
  result?: AskResult;
  pending?: boolean;
}

const confColor: Record<string, string> = {
  high: "#16a34a", medium: "#d97706", low: "#dc2626", none: "var(--text-muted)",
};

function ConfidenceBadge({ c }: { c: string }) {
  if (c === "none" || !c) return null;
  return (
    <span style={{
      fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "6px",
      color: confColor[c] || "var(--text-muted)",
      background: "color-mix(in srgb, " + (confColor[c] || "#888") + " 12%, transparent)",
      border: `1px solid color-mix(in srgb, ${confColor[c] || "#888"} 30%, transparent)`,
      textTransform: "capitalize",
    }}>
      {c} confidence
    </span>
  );
}

function AnswerBlock({ answer, citations, confidence, knowledge_gap }: {
  answer: string; citations: { n: number; doc_id: string; title: string }[];
  confidence: string; knowledge_gap: boolean;
}) {
  return (
    <div style={{ alignSelf: "flex-start", maxWidth: "88%", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px 12px 12px 2px", padding: "14px 16px" }}>
      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: (confidence && confidence !== "none") || knowledge_gap ? "8px" : "0" }}>
        <ConfidenceBadge c={confidence} />
        {knowledge_gap && (
          <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "6px", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
            Knowledge gap
          </span>
        )}
      </div>
      <div style={{ fontSize: "14px", color: "var(--text-primary)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{answer}</div>
      {citations && citations.length > 0 && (
        <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px solid var(--border)" }}>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px" }}>Sources</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {citations.map(c => (
              <span key={c.n} title={c.title} style={{ fontSize: "12px", padding: "3px 9px", borderRadius: "6px", background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                {c.folder && (
                  <span style={{ fontSize: "10px", fontWeight: 600, padding: "1px 6px", borderRadius: "4px", background: "var(--accent-dim)", color: "var(--accent)" }}>{c.folder}</span>
                )}
                <span>[{c.n}] {c.title || c.doc_id}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BrainChat() {
  const [cfg, setCfg] = useState<BrainConfig | null>(null);
  const [folders, setFolders] = useState<FolderCount[]>([]);
  const [folder, setFolder] = useState<string>("All");
  const [q, setQ] = useState("");
  const [asking, setAsking] = useState(false);

  // conversation state
  const [conversations, setConversations] = useState<BrainConversationMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [history, setHistory] = useState<BrainTurn[]>([]);   // persisted turns of the active thread
  const [live, setLive] = useState<LiveTurn[]>([]);          // turns added this session (before reload)
  const endRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    try {
      const r = await brainApi.listConversations();
      setConversations(r.data.conversations || []);
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    brainApi.config().then(r => setCfg(r.data)).catch(() => {});
    brainApi.folders().then(r => setFolders(r.data.folders || [])).catch(() => {});
    loadConversations();
  }, [loadConversations]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [history, live]);

  const openConversation = async (id: string) => {
    setActiveId(id);
    setLive([]);
    try {
      const r = await brainApi.getConversation(id);
      setHistory(r.data.turns || []);
    } catch { setHistory([]); }
  };

  const startNew = async () => {
    // Optimistic: clear the view; the thread is created lazily on first send
    // (so empty "New conversation" rows don't pile up).
    setActiveId(null);
    setHistory([]);
    setLive([]);
    setQ("");
  };

  const submit = async () => {
    const question = q.trim();
    if (!question || asking) return;
    setQ("");
    setAsking(true);
    setLive(l => [...l, { q: question, pending: true }]);

    try {
      // ensure a conversation exists (create lazily on first message)
      let cid = activeId;
      if (!cid) {
        const nc = await brainApi.newConversation(undefined, question.slice(0, 60));
        cid = nc.data.conversation_id;
        setActiveId(cid);
      }
      const r = await brainApi.ask(question, {
        folder: folder === "All" ? undefined : folder,
        conversation_id: cid || undefined,
      });
      setLive(l => l.map((t, i) => i === l.length - 1 ? { q: question, result: r.data } : t));
      loadConversations();  // refresh sidebar (title/updated_at)
    } catch {
      setLive(l => l.map((t, i) => i === l.length - 1
        ? { q: question, result: { answer: "Something went wrong answering that.", citations: [], confidence: "none", grounded: false, chunks_found: 0, knowledge_gap: false } }
        : t));
    } finally {
      setAsking(false);
    }
  };

  const deleteConv = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this conversation?")) return;
    try {
      await brainApi.deleteConversation(id);
      if (activeId === id) startNew();
      loadConversations();
    } catch { /* noop */ }
  };

  return (
    <div style={{ display: "flex", height: "calc(100vh - 90px)", gap: "16px" }}>
      {/* Sidebar — this user's conversations */}
      <div style={{ width: "230px", flexShrink: 0, display: "flex", flexDirection: "column", borderRight: "1px solid var(--border)", paddingRight: "12px" }}>
        <button onClick={startNew}
          style={{ padding: "9px 12px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, background: "var(--accent)", color: "#0A0B0F", border: "none", cursor: "pointer", fontFamily: "var(--font)", marginBottom: "12px" }}>
          + New conversation
        </button>
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "2px" }}>
          {conversations.length === 0 && (
            <div style={{ fontSize: "12px", color: "var(--text-muted)", padding: "8px 4px" }}>No conversations yet.</div>
          )}
          {conversations.map(c => (
            <div key={c.conversation_id} onClick={() => openConversation(c.conversation_id)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px",
                padding: "8px 10px", borderRadius: "8px", cursor: "pointer",
                background: activeId === c.conversation_id ? "var(--accent-dim)" : "transparent",
              }}>
              <span style={{ fontSize: "13px", color: activeId === c.conversation_id ? "var(--accent)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                {c.title}
              </span>
              <button onClick={e => deleteConv(c.conversation_id, e)} title="Delete"
                style={{ fontSize: "13px", background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "0 2px", lineHeight: 1 }}>
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main chat column */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ marginBottom: "12px" }}>
          <h1 style={{ fontSize: "22px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Ask the Second Brain</h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0" }}>
            Answers come only from your company's knowledge — with sources. {cfg?.role_label ? `You're signed in as ${cfg.role_label}.` : ""}
          </p>
        </div>

        {/* Folder scope */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Scope:</span>
          {[{ folder: "All", count: 0 }, ...folders.filter(f => f.count > 0)].map(f => (
            <button key={f.folder} onClick={() => setFolder(f.folder)}
              style={{
                padding: "4px 10px", borderRadius: "7px", fontSize: "12px", cursor: "pointer", fontFamily: "var(--font)",
                border: `1px solid ${folder === f.folder ? "var(--accent)" : "var(--border)"}`,
                background: folder === f.folder ? "var(--accent-dim)" : "transparent",
                color: folder === f.folder ? "var(--accent)" : "var(--text-secondary)",
              }}>
              {f.folder}{f.folder !== "All" ? ` (${f.count})` : ""}
            </button>
          ))}
        </div>

        {/* Conversation */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "18px", paddingRight: "4px" }}>
          {history.length === 0 && live.length === 0 && (
            <div style={{ color: "var(--text-muted)", fontSize: "14px", textAlign: "center", marginTop: "40px", lineHeight: 1.7 }}>
              Ask anything about your company's documents, decisions, policies, or processes.<br />
              <span style={{ fontSize: "13px" }}>e.g. "What's our refund policy?" · "What did we decide about Q3 pricing?"</span>
            </div>
          )}

          {/* persisted turns */}
          {history.map((t, i) => (
            <div key={`h${i}`} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ alignSelf: "flex-end", maxWidth: "80%", background: "var(--accent-dim)", border: "1px solid rgba(0,200,150,0.2)", borderRadius: "12px 12px 2px 12px", padding: "10px 14px", fontSize: "14px", color: "var(--text-primary)" }}>{t.question}</div>
              <AnswerBlock answer={t.answer} citations={t.citations} confidence={t.confidence} knowledge_gap={t.knowledge_gap} />
            </div>
          ))}

          {/* live turns (this session) */}
          {live.map((turn, i) => (
            <div key={`l${i}`} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ alignSelf: "flex-end", maxWidth: "80%", background: "var(--accent-dim)", border: "1px solid rgba(0,200,150,0.2)", borderRadius: "12px 12px 2px 12px", padding: "10px 14px", fontSize: "14px", color: "var(--text-primary)" }}>{turn.q}</div>
              {turn.pending ? (
                <div style={{ alignSelf: "flex-start", color: "var(--text-muted)", fontSize: "13px", padding: "8px 4px" }}>Searching the knowledge base…</div>
              ) : turn.result && (
                <AnswerBlock answer={turn.result.answer} citations={turn.result.citations} confidence={turn.result.confidence} knowledge_gap={turn.result.knowledge_gap} />
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {/* Composer */}
        <div style={{ display: "flex", gap: "8px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder="Ask a question…"
            style={{ flex: 1, padding: "11px 14px", borderRadius: "10px", fontSize: "14px", background: "var(--bg-surface)", border: "1px solid var(--border-hover)", color: "var(--text-primary)", fontFamily: "var(--font)", outline: "none" }}
          />
          <button onClick={submit} disabled={asking || !q.trim()}
            style={{ padding: "11px 20px", borderRadius: "10px", fontSize: "14px", fontWeight: 600, background: q.trim() && !asking ? "var(--accent)" : "var(--bg-elevated)", color: q.trim() && !asking ? "#0A0B0F" : "var(--text-muted)", border: "none", cursor: q.trim() && !asking ? "pointer" : "not-allowed", fontFamily: "var(--font)" }}>
            {asking ? "…" : "Ask"}
          </button>
        </div>
      </div>
    </div>
  );
}
