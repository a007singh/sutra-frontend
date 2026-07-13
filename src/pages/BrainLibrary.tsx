import { useState, useEffect, useRef, useCallback } from "react";
import { brainApi } from "../api/secondBrain";
import type { BrainConfig, BrainDoc, FolderCount } from "../api/secondBrain";
import { globalToast } from "../hooks/useGlobalToast";

/**
 * BrainLibrary.tsx — Second Brain — Library & Upload
 * ==================================================
 * Founders/Managers upload documents (auto-organized into folders by AI) and
 * browse the institutional memory. Team Members can view titles/summaries but
 * never the original files.
 *
 * Place at: frontend/src/pages/BrainLibrary.tsx
 */

const card: React.CSSProperties = {
  background: "var(--bg-surface)", border: "1px solid var(--border)",
  borderRadius: "12px", padding: "16px 18px",
};

const kindIcon: Record<string, string> = {
  policy: "§", contract: "✎", deck: "▤", financial_model: "$",
  meeting_notes: "✐", email: "✉", report: "▦", sop: "☑", proposal: "◆", other: "•",
};

export default function BrainLibrary() {
  const [cfg, setCfg] = useState<BrainConfig | null>(null);
  const [docs, setDocs] = useState<BrainDoc[]>([]);
  const [folders, setFolders] = useState<FolderCount[]>([]);
  const [activeFolder, setActiveFolder] = useState<string>("All");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, f] = await Promise.all([
        brainApi.documents(activeFolder === "All" ? {} : { folder: activeFolder }),
        brainApi.folders(),
      ]);
      setDocs(d.data.documents || []);
      setFolders(f.data.folders || []);
    } catch { /* noop */ } finally { setLoading(false); }
  }, [activeFolder]);

  useEffect(() => { brainApi.config().then(r => setCfg(r.data)).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);

  const onUpload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true);
    let ok = 0, fail = 0;
    for (const file of Array.from(files)) {
      try {
        const r = await brainApi.upload(file);
        ok++;
        globalToast(`"${r.data.document.title}" → ${r.data.document.folder} (${r.data.document.chunks} chunks)`, "success");
      } catch (e: any) {
        fail++;
        globalToast(`${file.name}: ${e?.response?.data?.detail || "upload failed"}`, "error");
      }
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    load();
  };

  const onUrl = async () => {
    if (!urlInput.trim()) return;
    setUploading(true);
    try {
      const r = await brainApi.ingestUrl(urlInput.trim());
      globalToast(`"${r.data.document.title}" → ${r.data.document.folder}`, "success");
      setUrlInput("");
      load();
    } catch (e: any) {
      globalToast(e?.response?.data?.detail || "URL ingest failed", "error");
    } finally { setUploading(false); }
  };

  const onDelete = async (doc: BrainDoc) => {
    if (!confirm(`Remove "${doc.title}" from the Second Brain?`)) return;
    try {
      await brainApi.remove(doc.doc_id);
      globalToast("Removed");
      load();
    } catch (e: any) {
      globalToast(e?.response?.data?.detail || "Delete failed", "error");
    }
  };

  const canUpload = cfg?.can_upload;
  const canManage = cfg?.can_manage;

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
      <div style={{ marginBottom: "16px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Knowledge Library</h1>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0" }}>
          Your company's institutional memory, auto-organized by AI. {cfg?.role_label ? `Signed in as ${cfg.role_label}.` : ""}
        </p>
      </div>

      {/* Upload zone (founders/managers only) */}
      {canUpload && (
        <div style={{ ...card, marginBottom: "18px" }}>
          {!cfg?.archival_ready && (
            <div style={{ fontSize: "12px", color: "#d97706", marginBottom: "10px" }}>
              ⚠ Archival storage not configured — set BRAIN_S3_BUCKET on the backend to enable uploads.
            </div>
          )}
          {cfg && !cfg.kb_ready && (
            <div style={{ fontSize: "12px", color: "#d97706", marginBottom: "10px" }}>
              ⚠ Second Brain knowledge base not configured — set BRAIN_KB_LAMBDA to the dedicated
              Second Brain KB (separate from the general knowledge base) to enable ingestion.
            </div>
          )}
          <div
            onDragOver={e => { e.preventDefault(); }}
            onDrop={e => { e.preventDefault(); onUpload(e.dataTransfer.files); }}
            onClick={() => fileRef.current?.click()}
            style={{
              border: "1.5px dashed var(--border-hover)", borderRadius: "10px",
              padding: "28px", textAlign: "center", cursor: "pointer",
              background: "var(--bg-elevated)", transition: "border-color 0.15s",
            }}>
            <input ref={fileRef} type="file" multiple hidden
              onChange={e => onUpload(e.target.files)}
              accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.pptx,.ppt,.png,.jpg,.jpeg,.tiff,.eml,.txt,.md,.html" />
            <div style={{ fontSize: "14px", color: "var(--text-primary)", fontWeight: 500 }}>
              {uploading ? "Processing…" : "Drop files here or click to upload"}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px" }}>
              PDF, Word, Excel, PowerPoint, images, email, text — AI will summarize and file them automatically
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
            <input value={urlInput} onChange={e => setUrlInput(e.target.value)}
              placeholder="…or paste a URL to ingest"
              style={{ flex: 1, padding: "9px 12px", borderRadius: "8px", fontSize: "13px", background: "var(--bg-elevated)", border: "1px solid var(--border-hover)", color: "var(--text-primary)", fontFamily: "var(--font)" }} />
            <button onClick={onUrl} disabled={uploading || !urlInput.trim()}
              style={{ padding: "9px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, background: urlInput.trim() ? "var(--accent)" : "var(--bg-elevated)", color: urlInput.trim() ? "#0A0B0F" : "var(--text-muted)", border: "none", cursor: urlInput.trim() ? "pointer" : "not-allowed", fontFamily: "var(--font)" }}>
              Ingest URL
            </button>
          </div>
        </div>
      )}

      {/* Folder tabs */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "16px", flexWrap: "wrap" }}>
        {[{ folder: "All", count: docs.length }, ...folders.filter(f => f.count > 0)].map(f => (
          <button key={f.folder} onClick={() => setActiveFolder(f.folder)}
            style={{
              padding: "6px 12px", borderRadius: "8px", fontSize: "13px", cursor: "pointer", fontFamily: "var(--font)",
              border: `1px solid ${activeFolder === f.folder ? "var(--accent)" : "var(--border)"}`,
              background: activeFolder === f.folder ? "var(--accent-dim)" : "transparent",
              color: activeFolder === f.folder ? "var(--accent)" : "var(--text-secondary)",
            }}>
            {f.folder} {f.folder !== "All" ? `· ${f.count}` : ""}
          </button>
        ))}
      </div>

      {/* Document list */}
      {loading ? (
        <div style={{ color: "var(--text-muted)", fontSize: "13px", padding: "40px", textAlign: "center" }}>Loading…</div>
      ) : docs.length === 0 ? (
        <div style={{ color: "var(--text-muted)", fontSize: "14px", padding: "50px", textAlign: "center" }}>
          {canUpload ? "No documents yet. Upload files above to build your Second Brain." : "No documents in this folder yet."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {docs.map(doc => (
            <div key={doc.doc_id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={{ fontSize: "14px", color: "var(--text-muted)" }}>{kindIcon[doc.doc_kind] || "•"}</span>
                    <span style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>{doc.title}</span>
                    {doc.ingest_ok === false && <span style={{ fontSize: "11px", color: "#dc2626" }}>ingest failed</span>}
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    {doc.summary}
                  </div>
                  <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "5px", background: "var(--accent-dim)", color: "var(--accent)" }}>{doc.folder}</span>
                    {doc.source === "connector" && (
                      <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "5px", background: "var(--bg-elevated)", color: "var(--text-muted)" }}>synced</span>
                    )}
                    {doc.created_at && (
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }} title={new Date(doc.created_at).toLocaleString()}>
                        {new Date(doc.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                      </span>
                    )}
                    {(doc.tags || []).filter(t => !t.startsWith("ws:") && !t.startsWith("folder:") && t !== "brain").slice(0, 5).map(t => (
                      <span key={t} style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "5px", background: "var(--bg-elevated)", color: "var(--text-muted)" }}>{t}</span>
                    ))}
                    {doc.key_decisions?.length > 0 && (
                      <button onClick={() => setExpanded(expanded === doc.doc_id ? null : doc.doc_id)}
                        style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "5px", background: "transparent", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)" }}>
                        {doc.key_decisions.length} key point{doc.key_decisions.length > 1 ? "s" : ""} {expanded === doc.doc_id ? "▾" : "▸"}
                      </button>
                    )}
                  </div>
                  {expanded === doc.doc_id && doc.key_decisions?.length > 0 && (
                    <ul style={{ margin: "10px 0 0", paddingLeft: "18px", fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                      {doc.key_decisions.map((d, i) => <li key={i}>{d}</li>)}
                    </ul>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px", flexShrink: 0 }}>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{doc.doc_type} · {doc.chunks} chunks</span>
                  {canManage && (
                    <button onClick={() => onDelete(doc)}
                      style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "6px", background: "transparent", border: "1px solid var(--border-hover)", color: "var(--text-muted)", cursor: "pointer", fontFamily: "var(--font)" }}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
