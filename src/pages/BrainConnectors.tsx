import { useState, useEffect, useCallback } from "react";
import { brainApi } from "../api/secondBrain";
import type { BrainConnector, ConnectorType, SyncResult } from "../api/secondBrain";

/**
 * BrainConnectors.tsx — Second Brain — Connectors (sync sources)
 * =============================================================
 * Admin/leadership page to connect knowledge sources (Confluence, Google Drive)
 * that auto-sync into the brain KB. Add a connector, validate it, "Sync now", and
 * see per-connector status. Connect once — the brain stays current.
 *
 * Place at: frontend/src/pages/BrainConnectors.tsx
 */

const statusColor = (s: string) =>
  s === "ok" ? "#16a34a"
  : s?.startsWith("error") ? "#dc2626"
  : s === "syncing" ? "#d97706"
  : "var(--text-muted)";

export default function BrainConnectors() {
  const [connectors, setConnectors] = useState<BrainConnector[]>([]);
  const [types, setTypes] = useState<ConnectorType[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("");
  const [form, setForm] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);      // connector_id being synced/validated
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [syncResult, setSyncResult] = useState<Record<string, SyncResult>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, t] = await Promise.all([brainApi.listConnectors(), brainApi.connectorTypes()]);
      setConnectors(c.data.connectors || []);
      setTypes(t.data.types || []);
    } catch { /* noop */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const currentType = types.find(t => t.type === selectedType);

  const startAdd = (type: string) => {
    setSelectedType(type);
    setForm({});
    setName(types.find(t => t.type === type)?.label || type);
    setAdding(true);
    setMsg(null);
  };

  const submitAdd = async () => {
    if (!selectedType) return;
    setBusy("adding");
    setMsg(null);
    try {
      const r = await brainApi.addConnector(selectedType, name, form);
      setMsg({ text: r.data.validation || "Connector added.", ok: true });
      setAdding(false);
      setForm({});
      await load();
    } catch (e: any) {
      setMsg({ text: e?.response?.data?.detail || "Failed to add connector.", ok: false });
    } finally {
      setBusy(null);
    }
  };

  const doSync = async (id: string) => {
    setBusy(id);
    setMsg(null);
    try {
      const r = await brainApi.syncConnector(id);
      setSyncResult(prev => ({ ...prev, [id]: r.data }));
      const d = r.data;
      setMsg({ text: `Sync complete: +${d.added} added, ${d.updated} updated, ${d.deleted} removed, ${d.unchanged} unchanged${d.errors ? `, ${d.errors} errors` : ""}.`, ok: d.errors === 0 });
      await load();
    } catch (e: any) {
      setMsg({ text: e?.response?.data?.detail || "Sync failed.", ok: false });
    } finally {
      setBusy(null);
    }
  };

  const doValidate = async (id: string) => {
    setBusy(id);
    try {
      const r = await brainApi.validateConnector(id);
      setMsg({ text: r.data.message, ok: r.data.ok });
    } catch (e: any) {
      setMsg({ text: e?.response?.data?.detail || "Validation failed.", ok: false });
    } finally {
      setBusy(null);
    }
  };

  const toggleEnabled = async (c: BrainConnector) => {
    try { await brainApi.setConnectorEnabled(c.connector_id, !c.enabled); await load(); } catch { /* noop */ }
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this connector? Documents it synced will also be removed from the brain.")) return;
    try { await brainApi.deleteConnector(id); await load(); } catch { /* noop */ }
  };

  return (
    <div style={{ maxWidth: "860px" }}>
      <h1 style={{ fontSize: "22px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Connectors</h1>
      <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 20px" }}>
        Connect a knowledge source once — Confluence, Google Drive — and the Second Brain keeps itself current as documents change.
      </p>

      {msg && (
        <div style={{ marginBottom: "16px", padding: "10px 14px", borderRadius: "8px", fontSize: "13px",
          background: msg.ok ? "color-mix(in srgb, #16a34a 12%, transparent)" : "color-mix(in srgb, #dc2626 12%, transparent)",
          color: msg.ok ? "#16a34a" : "#dc2626", border: `1px solid ${msg.ok ? "#16a34a" : "#dc2626"}33` }}>
          {msg.text}
        </div>
      )}

      {/* Add connector */}
      {!adding ? (
        <div style={{ display: "flex", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
          {types.map(t => (
            <button key={t.type} onClick={() => startAdd(t.type)}
              style={{ padding: "9px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer",
                background: "var(--accent)", color: "#0A0B0F", border: "none", fontFamily: "var(--font)" }}>
              + Connect {t.label}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ marginBottom: "24px", padding: "18px", borderRadius: "12px", background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <h3 style={{ margin: 0, fontSize: "15px", color: "var(--text-primary)" }}>Connect {currentType?.label}</h3>
            <button onClick={() => setAdding(false)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "18px" }}>×</button>
          </div>
          <div style={{ marginBottom: "12px" }}>
            <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Display name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", fontSize: "13px", background: "var(--bg-elevated)", border: "1px solid var(--border-hover)", color: "var(--text-primary)", fontFamily: "var(--font)", boxSizing: "border-box" }} />
          </div>
          {currentType?.fields.map(f => (
            <div key={f.key} style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>{f.label}</label>
              <input
                type={f.secret ? "password" : "text"}
                value={form[f.key] || ""}
                placeholder={f.placeholder}
                onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", fontSize: "13px", background: "var(--bg-elevated)", border: "1px solid var(--border-hover)", color: "var(--text-primary)", fontFamily: "var(--font)", boxSizing: "border-box" }} />
            </div>
          ))}
          <button onClick={submitAdd} disabled={busy === "adding"}
            style={{ marginTop: "6px", padding: "9px 18px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer",
              background: busy === "adding" ? "var(--bg-elevated)" : "var(--accent)", color: busy === "adding" ? "var(--text-muted)" : "#0A0B0F", border: "none", fontFamily: "var(--font)" }}>
            {busy === "adding" ? "Validating…" : "Validate & Add"}
          </button>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "10px" }}>
            Credentials are validated before saving. Secrets are stored securely and never shown back.
          </p>
        </div>
      )}

      {/* Connector list */}
      {loading ? (
        <div style={{ color: "var(--text-muted)", fontSize: "14px" }}>Loading…</div>
      ) : connectors.length === 0 ? (
        <div style={{ color: "var(--text-muted)", fontSize: "14px", textAlign: "center", padding: "40px 0" }}>
          No connectors yet. Connect a source above to auto-sync documents into the brain.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {connectors.map(c => {
            const res = syncResult[c.connector_id];
            return (
              <div key={c.connector_id} style={{ padding: "16px", borderRadius: "12px", background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <span style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>{c.name}</span>
                      <span style={{ fontSize: "10px", fontWeight: 600, padding: "2px 7px", borderRadius: "4px", background: "var(--accent-dim)", color: "var(--accent)", textTransform: "uppercase" }}>{c.connector_type}</span>
                      {!c.enabled && <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "4px", border: "1px solid var(--border)", color: "var(--text-muted)" }} title="Automatic background sync is paused; manual Sync now still works">AUTO-SYNC PAUSED</span>}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      <span style={{ color: statusColor(c.last_status) }}>● {c.last_status}</span>
                      {" · "}{c.item_count} items
                      {c.last_synced && ` · last synced ${new Date(c.last_synced).toLocaleString()}`}
                    </div>
                    {res && (
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "6px" }}>
                        +{res.added} added · {res.updated} updated · {res.deleted} removed · {res.unchanged} unchanged{res.errors ? ` · ${res.errors} errors` : ""}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                    <button onClick={() => doSync(c.connector_id)} disabled={busy === c.connector_id}
                      title="Manually sync now (works even when auto-sync is paused)"
                      style={{ padding: "6px 12px", borderRadius: "7px", fontSize: "12px", fontWeight: 600, cursor: busy === c.connector_id ? "not-allowed" : "pointer",
                        background: busy === c.connector_id ? "var(--bg-elevated)" : "var(--accent)", color: busy === c.connector_id ? "var(--text-muted)" : "#0A0B0F", border: "none", fontFamily: "var(--font)" }}>
                      {busy === c.connector_id ? "Syncing…" : "Sync now"}
                    </button>
                    <button onClick={() => doValidate(c.connector_id)} disabled={busy === c.connector_id}
                      style={{ padding: "6px 12px", borderRadius: "7px", fontSize: "12px", cursor: "pointer", background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border)", fontFamily: "var(--font)" }}>
                      Test
                    </button>
                    <button onClick={() => toggleEnabled(c)}
                      title={c.enabled ? "Pause automatic background sync (manual Sync now still works)" : "Resume automatic background sync"}
                      style={{ padding: "6px 12px", borderRadius: "7px", fontSize: "12px", cursor: "pointer", background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border)", fontFamily: "var(--font)" }}>
                      {c.enabled ? "Pause auto-sync" : "Resume auto-sync"}
                    </button>
                    <button onClick={() => remove(c.connector_id)}
                      style={{ padding: "6px 10px", borderRadius: "7px", fontSize: "12px", cursor: "pointer", background: "transparent", color: "#dc2626", border: "1px solid #dc262633", fontFamily: "var(--font)" }}>
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
