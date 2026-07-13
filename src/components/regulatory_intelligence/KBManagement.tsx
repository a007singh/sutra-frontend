/**
 * KBManagement.tsx
 * Regulatory Intelligence OS — Knowledge Base Management
 *
 * Route:  page === "kb-management"
 * API:    VITE_KB_API_URL (.env)
 *
 * Select sources → click Ingest → Python fetches URL → KB Lambda embeds into FAISS.
 * LLM never involved in ingestion. LLM queries KB separately in chat.
 */

import { useState, useEffect, useCallback } from "react";
import PageHeader      from "../PageHeader";
import Badge           from "../Badge";
import { globalToast } from "../../hooks/useGlobalToast";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Source {
  source_id:          string;
  regulator_code:     string;
  regulator_name:     string;
  source_type:        string;
  description:        string;
  is_active:          boolean;
  last_scraped_at?:   string;
  scrape_schedule?:   string[];
  company_relevance?: string[];
}

interface KBDocument {
  doc_id:       string;
  source_id?:   string;
  title:        string;
  tags:         string[];
  category?:    string;
  chunks:       number;
  ingested_at?: string;
}

interface KBStats {
  documents:      number;
  chunks:         number;
  embedded:       number;
  faiss_vectors:  number;
  tags:           Record<string, number>;
  last_ingested?: string;
  ready:          boolean;
}

interface IngestResult {
  source_id: string;
  doc_id?:   string;
  title?:    string;
  tags?:     string[];
  chunks?:   number;
  ok:        boolean;
  error?:    string;
}

interface IngestResponse {
  ingested:     number;
  failed:       number;
  total_chunks: number;
  results:      IngestResult[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const API_BASE   = import.meta.env.VITE_KB_API_URL ?? "";
const API_READY  = API_BASE.startsWith("http");
const REGULATORS = ["RBI","SEBI","IRDAI","MCA","DGFT","CBIC","GSTN"];

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, accent = false }: {
  label: string; value: number | string; accent?: boolean;
}) {
  return (
    <div style={{
      background: "var(--bg-overlay)", border: "1px solid var(--border)",
      borderRadius: "var(--radius, 8px)", padding: "14px 18px",
    }}>
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 4px", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase" }}>
        {label}
      </p>
      <p style={{ fontSize: 22, fontWeight: 600, margin: 0, color: accent ? "var(--accent)" : "var(--text-primary)" }}>
        {value}
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function KBManagement() {
  const [sources,   setSources]   = useState<Source[]>([]);
  const [docs,      setDocs]      = useState<KBDocument[]>([]);
  const [stats,     setStats]     = useState<KBStats | null>(null);
  const [selected,  setSelected]  = useState<Set<string>>(new Set());
  const [ingesting, setIngesting] = useState(false);
  const [progress,  setProgress]  = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState("");
  const [regFilter, setRegFilter] = useState("");

  const fetchAll = useCallback(async () => {
    if (!API_READY) return;
    try {
      const safeJson = async (url: string) => {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
        const text = await r.text();
        return JSON.parse(text);
      };
      const [sr, dr, st] = await Promise.all([
        safeJson(`${API_BASE}/sources`)       as Promise<{ sources: Source[] }>,
        safeJson(`${API_BASE}/kb/documents`)  as Promise<{ documents: KBDocument[] }>,
        safeJson(`${API_BASE}/kb/stats`)      as Promise<KBStats>,
      ]);
      setSources((sr as { sources: Source[] }).sources ?? []);
      setDocs((dr as { documents: KBDocument[] }).documents ?? []);
      setStats(st as KBStats);
    } catch (e) {
      globalToast(`Failed to load: ${(e as Error).message}`, "error");
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const toggleSource = (id: string) =>
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const triggerIngest = async () => {
    if (selected.size === 0) return;
    if (!API_READY) { globalToast("KB API not configured. Set VITE_KB_API_URL in .env", "error"); return; }
    setIngesting(true);
    setProgress([]);
    const log = (msg: string) => setProgress(p => [...p, msg]);
    try {
      log(`Starting ingestion of ${selected.size} source(s)...`);
      const res  = await fetch(`${API_BASE}/kb/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_ids: [...selected] }),
      });
      const data = await res.json() as IngestResponse;
      data.results.forEach(r => {
        if (r.ok) log(`✓ ${r.source_id} → ${r.doc_id} (${r.chunks ?? 0} chunks, tags: ${r.tags?.join(", ") ?? "—"})`);
        else      log(`✗ ${r.source_id}: ${r.error ?? "unknown error"}`);
      });
      log(`Done. ${data.ingested} ingested, ${data.failed} failed, ${data.total_chunks} total chunks.`);
      globalToast(`Ingested ${data.ingested} source(s), ${data.total_chunks} chunks total`);
      setSelected(new Set());
      fetchAll();
    } catch (e) {
      log(`Error: ${(e as Error).message}`);
      globalToast(`Ingestion failed: ${(e as Error).message}`, "error");
    } finally {
      setIngesting(false);
    }
  };

  const deleteDoc = async (doc_id: string) => {
    try {
      await fetch(`${API_BASE}/kb/doc/${doc_id}`, { method: "DELETE" });
      globalToast(`Deleted ${doc_id}`);
      fetchAll();
    } catch (e) {
      globalToast(`Delete failed: ${(e as Error).message}`, "error");
    }
  };

  const filteredSources = regFilter
    ? sources.filter(s => s.regulator_code === regFilter)
    : sources;

  const filteredDocs = docs.filter(d => {
    if (!tagFilter) return true;
    const f = tagFilter.toLowerCase();
    return (d.tags ?? []).some(t => t.toLowerCase().includes(f))
        || (d.title ?? "").toLowerCase().includes(f);
  });

  const allTags = [...new Set(docs.flatMap(d => d.tags ?? []))].sort();

  return (
    <div style={{ paddingBottom: 40 }}>
      <PageHeader
        title="Knowledge Base"
        subtitle="Select sources and ingest into the vector KB. Query via chat after ingestion."
        action={{ label: "↺ Refresh", onClick: fetchAll }}
      />

      <div style={{ padding: "0 32px" }}>

        {/* Not configured banner */}
        {!API_READY && (
          <div style={{
            background: "var(--status-waiting-dim)",
            border: "1px solid rgba(245,158,11,0.3)",
            borderRadius: "var(--radius, 8px)",
            padding: "14px 18px",
            marginBottom: 20,
            display: "flex", alignItems: "flex-start", gap: 12,
          }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--status-waiting)", margin: "0 0 4px" }}>
                KB API not configured
              </p>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 6px" }}>
                Deploy the ingestion API first, then add the URL to your <code>.env</code> file.
              </p>
              <code style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>
                1. python deploy_kb_api.py
              </code>
              <code style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>
                2. Add to .env: VITE_KB_API_URL=https://&lt;your-api-gateway-url&gt;
              </code>
              <code style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>
                3. Restart dev server: npm run dev
              </code>
            </div>
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
            <StatCard label="Documents"    value={stats.documents} />
            <StatCard label="Embedded"     value={stats.embedded} />
            <StatCard label="FAISS vectors" value={stats.faiss_vectors} />
            <StatCard label="Status"       value={stats.ready ? "Ready" : "Empty"} accent={stats.ready} />
          </div>
        )}

        {/* Tag cloud */}
        {allTags.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 8 }}>
              Filter by tag
            </p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button onClick={() => setTagFilter("")} style={{
                padding: "2px 10px", borderRadius: 20, fontSize: 11, cursor: "pointer",
                fontFamily: "var(--font)", border: "1px solid var(--border-hover)",
                background: !tagFilter ? "var(--accent-dim)" : "transparent",
                color:      !tagFilter ? "var(--accent)"     : "var(--text-muted)",
              }}>
                All
              </button>
              {allTags.map(t => (
                <button key={t} onClick={() => setTagFilter(t === tagFilter ? "" : t)} style={{
                  padding: "2px 10px", borderRadius: 20, fontSize: 11, cursor: "pointer",
                  fontFamily: "var(--font)", border: "1px solid var(--border-hover)",
                  background: tagFilter === t ? "var(--accent-dim)" : "transparent",
                  color:      tagFilter === t ? "var(--accent)"     : "var(--text-muted)",
                }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Two-column layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

          {/* Left: Sources */}
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg, 12px)", display: "flex", flexDirection: "column" }}>

            {/* Header */}
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
                Configured sources
              </p>
              <select value={regFilter} onChange={e => setRegFilter(e.target.value)} style={{
                fontSize: 12, padding: "4px 8px",
                background: "var(--bg-overlay)", border: "1px solid var(--border-hover)",
                borderRadius: "var(--radius)", color: "var(--text-secondary)", fontFamily: "var(--font)",
              }}>
                <option value="">All regulators</option>
                {REGULATORS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>

            {/* Source rows */}
            <div style={{ flex: 1, overflowY: "auto", maxHeight: 340 }}>
              {filteredSources.length === 0 && (
                <p style={{ padding: "20px", fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
                  No sources configured. Go to KB Sources to add some.
                </p>
              )}
              {filteredSources.map((s, i) => (
                <div
                  key={s.source_id}
                  onClick={() => toggleSource(s.source_id)}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 10,
                    padding: "12px 20px", cursor: "pointer",
                    borderBottom: i < filteredSources.length - 1 ? "1px solid var(--border)" : "none",
                    background: selected.has(s.source_id) ? "var(--accent-dim)" : "transparent",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={e => {
                    if (!selected.has(s.source_id))
                      (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)";
                  }}
                  onMouseLeave={e => {
                    if (!selected.has(s.source_id))
                      (e.currentTarget as HTMLDivElement).style.background = "transparent";
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(s.source_id)}
                    onChange={() => {/* handled by parent onClick */}}
                    style={{ marginTop: 2, flexShrink: 0, accentColor: "var(--accent)" }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
                        {s.regulator_name}
                      </span>
                      <Badge variant="accent">{s.regulator_code}</Badge>
                      <Badge variant="default">{s.source_type.replace("_", " ")}</Badge>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 2px" }}>
                      {s.description}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
                      Last ingested: {s.last_scraped_at ?? "never"}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {selected.size} selected
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => setSelected(new Set(sources.map(s => s.source_id)))}
                  style={{ padding: "5px 10px", fontSize: 12, cursor: "pointer", background: "transparent", border: "1px solid var(--border-hover)", color: "var(--text-secondary)", borderRadius: "var(--radius)", fontFamily: "var(--font)" }}
                >
                  All
                </button>
                <button
                  onClick={() => setSelected(new Set())}
                  style={{ padding: "5px 10px", fontSize: 12, cursor: "pointer", background: "transparent", border: "1px solid var(--border-hover)", color: "var(--text-secondary)", borderRadius: "var(--radius)", fontFamily: "var(--font)" }}
                >
                  None
                </button>
                <button
                  onClick={triggerIngest}
                  disabled={selected.size === 0 || ingesting}
                  style={{
                    padding: "6px 16px", fontSize: 13, fontWeight: 600,
                    background: "var(--accent)", border: "none",
                    color: "#0A0B0F", borderRadius: "var(--radius)", fontFamily: "var(--font)",
                    cursor: selected.size > 0 && !ingesting ? "pointer" : "not-allowed",
                    opacity: selected.size > 0 && !ingesting ? 1 : 0.4,
                    transition: "opacity 0.15s",
                  }}
                  onMouseEnter={e => {
                    if (selected.size > 0 && !ingesting)
                      (e.currentTarget as HTMLButtonElement).style.opacity = "0.85";
                  }}
                  onMouseLeave={e => {
                    if (selected.size > 0 && !ingesting)
                      (e.currentTarget as HTMLButtonElement).style.opacity = "1";
                  }}
                >
                  {ingesting ? "Ingesting..." : "⬇ Ingest selected"}
                </button>
              </div>
            </div>
          </div>

          {/* Right: Documents */}
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg, 12px)", display: "flex", flexDirection: "column" }}>

            {/* Header */}
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
                Documents in KB
                {filteredDocs.length > 0 && (
                  <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 400, marginLeft: 6 }}>
                    ({filteredDocs.length})
                  </span>
                )}
              </p>
              <input
                placeholder="tag or title..."
                value={tagFilter}
                onChange={e => setTagFilter(e.target.value)}
                style={{
                  fontSize: 12, padding: "5px 10px", width: 140,
                  background: "var(--bg-overlay)", border: "1px solid var(--border-hover)",
                  borderRadius: "var(--radius)", color: "var(--text-primary)", fontFamily: "var(--font)",
                  outline: "none",
                }}
              />
            </div>

            {/* Document rows */}
            <div style={{ flex: 1, overflowY: "auto", maxHeight: 340 }}>
              {filteredDocs.length === 0 && (
                <p style={{ padding: "20px", fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
                  {docs.length === 0
                    ? "No documents yet. Select sources on the left and click Ingest."
                    : "No documents match the current filter."}
                </p>
              )}
              {filteredDocs.map((d, i) => (
                <div key={d.doc_id} style={{
                  display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "start",
                  padding: "12px 20px",
                  borderBottom: i < filteredDocs.length - 1 ? "1px solid var(--border)" : "none",
                }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", margin: "0 0 5px" }}>
                      {d.title}
                    </p>
                    <div style={{ marginBottom: 5, display: "flex", flexWrap: "wrap", gap: 3 }}>
                      {(d.tags ?? []).map(t => <Badge key={t} variant="default">{t}</Badge>)}
                    </div>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
                      {d.category ?? "general"} · {d.chunks} chunks · {d.ingested_at?.slice(0, 16) ?? "—"}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteDoc(d.doc_id)}
                    title="Delete document"
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      padding: "4px 6px", fontSize: 12, borderRadius: "var(--radius)",
                      color: "var(--text-muted)", fontFamily: "var(--font)", transition: "color 0.15s",
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = "var(--status-failed)"}
                    onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Ingestion progress log */}
        {progress.length > 0 && (
          <div style={{
            background: "var(--bg-surface)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg, 12px)", padding: "16px 20px", marginTop: 16,
          }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 10px" }}>
              {ingesting ? "Ingesting..." : "Ingestion complete"}
            </p>
            <div style={{
              fontFamily: "var(--font-mono, 'Fira Code', monospace)", fontSize: 12,
              color: "var(--text-secondary)", maxHeight: 140, overflowY: "auto", lineHeight: 1.7,
            }}>
              {progress.map((line, i) => <div key={i}>{line}</div>)}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
