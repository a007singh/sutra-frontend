import { useState, useEffect } from "react";
import { brainApi } from "../api/secondBrain";
import type { AvailableModel, BrainSettings } from "../api/secondBrain";
import { globalToast } from "../hooks/useGlobalToast";

/**
 * BrainSettings.tsx — Second Brain — Settings (model picker)
 * =========================================================
 * Lets an admin choose the enrichment + answer models from a LIVE list of models
 * the account can invoke (so the list never goes stale and never offers a model
 * you lack access to). Stored config overrides the env var; clearing a choice
 * falls back to the env var / built-in default.
 *
 * Place at: frontend/src/pages/BrainSettings.tsx
 */

const card: React.CSSProperties = {
  background: "var(--bg-surface)", border: "1px solid var(--border)",
  borderRadius: "12px", padding: "18px 20px",
};

function ModelPicker({
  label, hint, value, models, fallback, source, onChange,
}: {
  label: string; hint: string; value: string; models: AvailableModel[];
  fallback: string; source: string; onChange: (v: string) => void;
}) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>{label}</div>
      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px" }}>{hint}</div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: "100%", padding: "9px 12px", borderRadius: "8px", fontSize: "13px",
          background: "var(--bg-elevated)", border: "1px solid var(--border-hover)",
          color: "var(--text-primary)", fontFamily: "var(--font)",
        }}>
        <option value="">— Use default ({fallback}) —</option>
        {models.map(m => (
          <option key={m.id} value={m.id}>{m.provider} · {m.name} ({m.id})</option>
        ))}
        {/* if the stored value isn't in the live list, still show it so it's not lost */}
        {value && !models.some(m => m.id === value) && (
          <option value={value}>{value} (not in current model list)</option>
        )}
      </select>
      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
        {source === "settings" ? "Set here (overrides env/default)" : "Using env var / built-in default"}
      </div>
    </div>
  );
}

export default function BrainSettings() {
  const [models, setModels] = useState<AvailableModel[]>([]);
  const [settings, setSettings] = useState<BrainSettings | null>(null);
  const [enrich, setEnrich] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modelsError, setModelsError] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [m, s] = await Promise.all([brainApi.models(), brainApi.getSettings()]);
      setModels(m.data.models || []);
      if (!m.data.models || m.data.models.length === 0) setModelsError(true);
      const st: BrainSettings = s.data;
      setSettings(st);
      setEnrich(st.enrich_model.stored || "");
      setAnswer(st.answer_model.stored || "");
    } catch {
      setModelsError(true);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      const r = await brainApi.saveSettings(enrich, answer);
      setSettings(r.data);
      globalToast("Model settings saved", "success");
    } catch (e: any) {
      globalToast(e?.response?.data?.detail || "Save failed", "error");
    } finally { setSaving(false); }
  };

  if (loading) return <div style={{ color: "var(--text-muted)", fontSize: "13px", padding: "60px", textAlign: "center" }}>Loading settings…</div>;

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto" }}>
      <div style={{ marginBottom: "18px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Second Brain Settings</h1>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0" }}>
          Choose the AI models the Second Brain uses. Changes take effect immediately — no restart.
        </p>
      </div>

      <div style={card}>
        <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "16px" }}>Models</div>

        {modelsError && (
          <div style={{ fontSize: "12px", color: "#d97706", marginBottom: "14px", padding: "8px 12px", background: "var(--bg-elevated)", borderRadius: "8px" }}>
            ⚠ Couldn't list available models (needs the <code>bedrock:ListFoundationModels</code> permission).
            You can still type a model ID by selecting the fallback, or add the permission to see the live list.
          </div>
        )}

        <ModelPicker
          label="Answer model"
          hint="Synthesizes grounded answers from retrieved knowledge. This is the one that failed if you saw an end-of-life error."
          value={answer}
          models={models}
          fallback={settings?.answer_model.fallback || ""}
          source={settings?.answer_model.source || ""}
          onChange={setAnswer}
        />

        <ModelPicker
          label="Enrichment model"
          hint="Summarizes and auto-classifies documents at upload time. A cheaper/faster model is fine here."
          value={enrich}
          models={models}
          fallback={settings?.enrich_model.fallback || ""}
          source={settings?.enrich_model.source || ""}
          onChange={setEnrich}
        />

        <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "8px" }}>
          <button onClick={save} disabled={saving}
            style={{
              padding: "9px 20px", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
              background: "var(--accent)", color: "#0A0B0F", border: "none",
              cursor: saving ? "default" : "pointer", fontFamily: "var(--font)",
            }}>
            {saving ? "Saving…" : "Save"}
          </button>
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Currently answering with: <strong style={{ color: "var(--text-secondary)" }}>{settings?.answer_model.effective}</strong>
          </span>
        </div>
      </div>

      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "14px", lineHeight: 1.6 }}>
        Resolution order: your choice here → environment variable → built-in default. Leaving a field
        on "Use default" means the Second Brain uses whatever the backend env var / default provides.
      </div>
    </div>
  );
}
