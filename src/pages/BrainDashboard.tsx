import { useState, useEffect } from "react";
import { brainApi } from "../api/secondBrain";
import type { BrainDashboard } from "../api/secondBrain";

/**
 * BrainDashboard.tsx — Second Brain — Insights
 * ============================================
 * Founder/Manager view: what's in the brain, what people ask, popular topics,
 * and — most valuable — knowledge gaps (questions the brain couldn't answer),
 * which tell founders what to document next.
 *
 * Place at: frontend/src/pages/BrainDashboard.tsx
 */

const card: React.CSSProperties = {
  background: "var(--bg-surface)", border: "1px solid var(--border)",
  borderRadius: "12px", padding: "18px 20px",
};

function Kpi({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div style={{ ...card, borderColor: accent ? "rgba(0,200,150,0.25)" : "var(--border)" }}>
      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px" }}>{label}</div>
      <div style={{ fontSize: "28px", fontWeight: 600, color: accent ? "var(--accent)" : "var(--text-primary)", letterSpacing: "-0.5px" }}>{value}</div>
    </div>
  );
}

function Bar({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div style={{ marginBottom: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
        <span style={{ color: "var(--text-primary)" }}>{label}</span>
        <span style={{ color: "var(--text-secondary)" }}>{count}</span>
      </div>
      <div style={{ height: "6px", background: "var(--bg-elevated)", borderRadius: "3px", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "var(--accent)", borderRadius: "3px" }} />
      </div>
    </div>
  );
}

export default function BrainDashboard() {
  const [data, setData] = useState<BrainDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    brainApi.dashboard().then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: "var(--text-muted)", fontSize: "13px", padding: "60px", textAlign: "center" }}>Loading insights…</div>;
  if (!data) return <div style={{ color: "var(--text-muted)", fontSize: "13px", padding: "60px", textAlign: "center" }}>No data yet.</div>;

  const answerRate = data.questions_total > 0 ? Math.round((data.questions_answered / data.questions_total) * 100) : 0;
  const maxFolder = Math.max(...data.folders.map(f => f.count), 1);
  const maxTopic = Math.max(...data.popular_topics.map(t => t.count), 1);

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
      <div style={{ marginBottom: "18px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Second Brain Insights</h1>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0" }}>
          What your team knows, asks, and still needs documented.
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "14px", marginBottom: "20px" }}>
        <Kpi label="Documents" value={data.documents_total} accent />
        <Kpi label="Knowledge chunks" value={data.chunks_total} />
        <Kpi label="Questions asked" value={data.questions_total} />
        <Kpi label="Answer rate" value={`${answerRate}%`} accent />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
        {/* Folders */}
        <div style={card}>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "14px" }}>Knowledge by folder</div>
          {data.folders.length === 0 ? <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>No documents yet.</div> :
            data.folders.slice(0, 8).map(f => <Bar key={f.folder} label={f.folder} count={f.count} max={maxFolder} />)}
        </div>

        {/* Popular topics */}
        <div style={card}>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "14px" }}>Popular topics</div>
          {data.popular_topics.length === 0 ? <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>No questions asked yet.</div> :
            data.popular_topics.map(t => <Bar key={t.topic} label={t.topic} count={t.count} max={maxTopic} />)}
        </div>
      </div>

      {/* Knowledge gaps — the actionable part */}
      <div style={{ ...card, borderColor: data.knowledge_gaps > 0 ? "rgba(217,119,6,0.3)" : "var(--border)", marginBottom: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>Knowledge gaps</div>
          <span style={{ fontSize: "12px", color: data.knowledge_gaps > 0 ? "#d97706" : "var(--text-muted)" }}>
            {data.knowledge_gaps} unanswered
          </span>
        </div>
        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "14px" }}>
          Questions the brain couldn't answer — what your team needs documented next.
        </div>
        {data.recent_gaps.length === 0 ? (
          <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>No gaps — every question was answered from the knowledge base. 🎯</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {data.recent_gaps.map((g, i) => (
              <div key={i} style={{ fontSize: "13px", color: "var(--text-secondary)", padding: "8px 12px", background: "var(--bg-elevated)", borderRadius: "8px", borderLeft: "2px solid #d97706" }}>
                {g.question}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent questions */}
      <div style={card}>
        <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "14px" }}>Recent questions</div>
        {data.recent_questions.length === 0 ? <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>No questions yet.</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {data.recent_questions.map((q, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", fontSize: "13px" }}>
                <span style={{ color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.question}</span>
                <span style={{ fontSize: "11px", flexShrink: 0, padding: "2px 8px", borderRadius: "5px", color: q.grounded ? "#16a34a" : "var(--text-muted)", background: q.grounded ? "rgba(22,163,74,0.1)" : "var(--bg-elevated)" }}>
                  {q.grounded ? q.confidence : "no answer"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
