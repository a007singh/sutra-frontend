/**
 * SourcesConfig.tsx
 * Regulatory Intelligence OS — KB Sources Configuration
 *
 * Route:  page === "kb-sources"
 * API:    VITE_KB_API_URL (.env)
 *
 * Reads/writes DynamoDB table: sutra-regulatory-sources
 * via kb_ingestion_api Lambda.
 * URL stored in DynamoDB — never passed to the LLM.
 */

import { useState, useEffect, useCallback } from "react";
import PageHeader            from "../PageHeader";
import Field, { inputCss, selectCss } from "../Field";
import Badge                 from "../Badge";
import { globalToast }       from "../../hooks/useGlobalToast";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Source {
  source_id:         string;
  regulator_code:    string;
  regulator_name:    string;
  source_type:       "HTML_INDEX" | "RSS_FEED" | "PDF_DIRECT";
  source_url:        string;
  description:       string;
  scrape_schedule:   string[];
  company_relevance: string[];
  is_active:         boolean;
  last_scraped_at?:  string;
}

interface SourceForm {
  source_id:         string;
  regulator_code:    string;
  regulator_name:    string;
  source_type:       string;
  source_url:        string;
  description:       string;
  scrape_schedule:   string[];
  company_relevance: string[];
  is_active:         boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const API_BASE     = import.meta.env.VITE_KB_API_URL ?? "";
const API_READY    = API_BASE.startsWith("http");
const REGULATORS   = ["RBI","SEBI","IRDAI","MCA","DGFT","CBIC","GSTN","PFRDA","CMS","HHS","FCA","SEC"];
const SOURCE_TYPES = [
  { value: "HTML_INDEX", label: "HTML index page" },
  { value: "RSS_FEED",   label: "RSS feed"         },
  { value: "PDF_DIRECT", label: "Direct PDF link"  },
];
const DAYS = ["MON","TUE","WED","THU","FRI"];

const EMPTY_FORM: SourceForm = {
  source_id: "", regulator_code: "RBI", regulator_name: "",
  source_type: "HTML_INDEX", source_url: "", description: "",
  scrape_schedule: ["MON","WED","FRI"], company_relevance: ["ALL"],
  is_active: true,
};

// ── Shared button styles (matches platform pattern) ───────────────────────────

const secondaryBtn: React.CSSProperties = {
  padding: "8px 16px", borderRadius: "var(--radius)", fontSize: 13,
  background: "transparent", border: "1px solid var(--border-hover)",
  color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)",
};

const primaryBtn: React.CSSProperties = {
  padding: "8px 20px", borderRadius: "var(--radius)", fontSize: 13, fontWeight: 600,
  background: "var(--accent)", border: "none", color: "#0A0B0F",
  cursor: "pointer", fontFamily: "var(--font)", transition: "opacity 0.15s",
};

const inlineBtn: React.CSSProperties = {
  padding: "5px 10px", borderRadius: "6px", fontSize: 12,
  background: "transparent", border: "1px solid var(--border-hover)",
  color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function SourcesConfig() {
  const [sources, setSources] = useState<Source[]>([]);
  const [filter,  setFilter]  = useState("");
  const [loading, setLoading] = useState(false);
  const [form,    setForm]    = useState<SourceForm | null>(null);
  const [editId,  setEditId]  = useState<string | null>(null);
  const [saving,  setSaving]  = useState(false);

  const fetchSources = useCallback(async () => {
    if (!API_READY) return;
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/sources`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const text = await r.text();
      const d = JSON.parse(text) as { sources: Source[] };
      setSources(d.sources ?? []);
    } catch (e) {
      globalToast(`Failed to load sources: ${(e as Error).message}`, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSources(); }, [fetchSources]);

  const openAdd  = () => { setForm({ ...EMPTY_FORM }); setEditId(null); };
  const openEdit = (s: Source) => {
    setForm({
      ...s,
      scrape_schedule:   s.scrape_schedule   ?? [],
      company_relevance: s.company_relevance ?? ["ALL"],
    });
    setEditId(s.source_id);
  };
  const patch = (p: Partial<SourceForm>) => setForm(f => f ? { ...f, ...p } : f);

  const save = async () => {
    if (!form) return;
    if (!form.source_id || !form.source_url) {
      globalToast("Source ID and URL are required", "error"); return;
    }
    if (!form.source_id.startsWith("SRC-")) {
      globalToast("Source ID must start with SRC-", "error"); return;
    }
    setSaving(true);
    try {
      if (!API_READY) { globalToast("KB API not configured. Set VITE_KB_API_URL in .env", "error"); setSaving(false); return; }
      const r = await fetch(`${API_BASE}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await r.json() as { ok?: boolean; error?: string };
      if (d.ok) {
        globalToast(`${editId ? "Updated" : "Saved"} ${form.source_id}`);
        setForm(null); setEditId(null); fetchSources();
      } else {
        globalToast(d.error ?? "Save failed", "error");
      }
    } catch (e) {
      globalToast(`Save failed: ${(e as Error).message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (source_id: string, current: boolean) => {
    try {
      await fetch(`${API_BASE}/sources/${source_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !current }),
      });
      globalToast(`${source_id} ${!current ? "activated" : "deactivated"}`);
      fetchSources();
    } catch (e) {
      globalToast(`Update failed: ${(e as Error).message}`, "error");
    }
  };

  const shown = filter ? sources.filter(s => s.regulator_code === filter) : sources;

  return (
    <div style={{ paddingBottom: 40 }}>
      <PageHeader
        title="KB Sources"
        subtitle="Configure regulatory sources. URL is stored in DynamoDB — never passed to the LLM."
        action={{ label: "Add source", onClick: openAdd }}
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

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
          {["", ...REGULATORS].map(r => (
            <button key={r} onClick={() => setFilter(r)} style={{
              padding: "4px 12px", fontSize: 12, borderRadius: 20,
              cursor: "pointer", fontFamily: "var(--font)",
              border: "1px solid var(--border-hover)",
              background: filter === r ? "var(--accent-dim)" : "transparent",
              color:      filter === r ? "var(--accent)"     : "var(--text-secondary)",
            }}>
              {r || "All"}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading sources...</p>
        )}

        {/* Empty state */}
        {!loading && shown.length === 0 && (
          <div style={{
            background: "var(--bg-surface)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg, 12px)", padding: "36px",
            textAlign: "center",
          }}>
            <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "0 0 6px" }}>
              {filter ? `No ${filter} sources configured.` : "No sources configured yet."}
            </p>
            <p style={{ color: "var(--text-muted)", fontSize: 12, margin: 0 }}>
              Click "Add source" to register your first regulatory source.
            </p>
          </div>
        )}

        {/* Sources table */}
        {shown.length > 0 && (
          <div style={{
            background: "var(--bg-surface)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg, 12px)", overflow: "hidden",
          }}>
            {shown.map((s, i) => (
              <div key={s.source_id} style={{
                display: "grid", gridTemplateColumns: "1fr auto",
                alignItems: "start", gap: 12, padding: "14px 20px",
                borderBottom: i < shown.length - 1 ? "1px solid var(--border)" : "none",
              }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <code style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.source_id}</code>
                    <Badge variant="accent">{s.regulator_code}</Badge>
                    <Badge variant="default">{s.source_type.replace("_", " ")}</Badge>
                    <Badge variant={s.is_active ? "done" : "default"}>
                      {s.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 3px" }}>
                    {s.regulator_name}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 4px" }}>
                    {s.description}
                  </p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
                    Last ingested: {s.last_scraped_at ?? "never"} ·
                    Schedule: {(s.scrape_schedule ?? []).join(", ")}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 6, paddingTop: 2 }}>
                  <button style={inlineBtn} onClick={() => openEdit(s)}>Edit</button>
                  <button
                    style={{
                      ...inlineBtn,
                      color:       s.is_active ? "var(--status-failed)"     : "var(--status-done)",
                      borderColor: s.is_active ? "rgba(255,92,92,0.3)"      : "rgba(0,200,150,0.3)",
                      background:  s.is_active ? "var(--status-failed-dim)" : "var(--status-done-dim)",
                    }}
                    onClick={() => toggleActive(s.source_id, s.is_active)}
                  >
                    {s.is_active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add / Edit form */}
        {form && (
          <div style={{
            background: "var(--bg-surface)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg, 12px)", padding: "20px 24px", marginTop: 20,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
                {editId ? "Edit source" : "Add regulatory source"}
              </h3>
              <button onClick={() => setForm(null)} style={{ ...inlineBtn, padding: "4px 8px" }}>✕</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Field label="Source ID">
                <input
                  style={inputCss}
                  value={form.source_id}
                  disabled={!!editId}
                  placeholder="SRC-RBI-CIRC"
                  onChange={e => patch({ source_id: e.target.value })}
                />
              </Field>
              <Field label="Regulator">
                <select style={selectCss} value={form.regulator_code}
                  onChange={e => patch({ regulator_code: e.target.value })}>
                  {REGULATORS.map(r => <option key={r}>{r}</option>)}
                </select>
              </Field>
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Name">
                  <input style={inputCss} value={form.regulator_name}
                    placeholder="Reserve Bank of India — Circulars"
                    onChange={e => patch({ regulator_name: e.target.value })} />
                </Field>
              </div>
              <Field label="Source type">
                <select style={selectCss} value={form.source_type}
                  onChange={e => patch({ source_type: e.target.value })}>
                  {SOURCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
              <Field label="Company types (JSON)">
                <input style={inputCss} value={JSON.stringify(form.company_relevance)}
                  placeholder='["NBFC","BANK"]'
                  onChange={e => {
                    try { patch({ company_relevance: JSON.parse(e.target.value) as string[] }); }
                    catch { /* ignore mid-type JSON */ }
                  }} />
              </Field>
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="URL — stored in DynamoDB, never passed to the LLM">
                  <input style={inputCss} value={form.source_url}
                    placeholder="https://www.rbi.org.in/Scripts/..."
                    onChange={e => patch({ source_url: e.target.value })} />
                </Field>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Description — used for natural-language source matching by the agent">
                  <input style={inputCss} value={form.description}
                    placeholder="RBI master circulars and notifications for banks and NBFCs..."
                    onChange={e => patch({ description: e.target.value })} />
                </Field>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, fontWeight: 500 }}>
                  Scrape schedule
                </label>
                <div style={{ display: "flex", gap: 16 }}>
                  {DAYS.map(d => (
                    <label key={d} style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", color: "var(--text-secondary)" }}>
                      <input type="checkbox"
                        checked={form.scrape_schedule.includes(d)}
                        onChange={e => {
                          const days = form.scrape_schedule;
                          patch({ scrape_schedule: e.target.checked ? [...days, d] : days.filter(x => x !== d) });
                        }}
                      />
                      {d}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <button style={secondaryBtn} onClick={() => setForm(null)}>Cancel</button>
              <button
                style={{ ...primaryBtn, opacity: saving ? 0.7 : 1, cursor: saving ? "not-allowed" : "pointer" }}
                onClick={save}
                disabled={saving}
                onMouseEnter={e => !saving && ((e.currentTarget as HTMLButtonElement).style.opacity = "0.85")}
                onMouseLeave={e => !saving && ((e.currentTarget as HTMLButtonElement).style.opacity = "1")}
              >
                {saving ? "Saving..." : "Save to DynamoDB"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
