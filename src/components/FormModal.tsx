import type { ReactNode } from "react";

interface Props {
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel?: string;
  children: ReactNode;
}

export default function FormModal({ title, onClose, onSubmit, submitLabel = "Create", children }: Props) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(4px)",
    }} onClick={onClose}>
      <div style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-hover)",
        borderRadius: "var(--radius-lg)",
        padding: "24px",
        width: "100%", maxWidth: "480px",
        maxHeight: "80vh", overflowY: "auto",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <h2 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>{title}</h2>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-muted)", fontSize: "18px", lineHeight: 1, padding: "2px 6px",
          }}>×</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {children}
        </div>
        <div style={{ display: "flex", gap: "10px", marginTop: "24px", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "8px 16px", borderRadius: "var(--radius)", fontSize: "13px",
            background: "transparent", border: "1px solid var(--border-hover)",
            color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)",
          }}>Cancel</button>
          <button onClick={onSubmit} style={{
            padding: "8px 20px", borderRadius: "var(--radius)", fontSize: "13px",
            background: "var(--accent)", border: "none",
            color: "#0A0B0F", cursor: "pointer", fontWeight: 600, fontFamily: "var(--font)",
          }}>{submitLabel}</button>
        </div>
      </div>
    </div>
  );
}