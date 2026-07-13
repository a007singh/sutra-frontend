import type { Toast } from "../hooks/useToast";

interface Props {
  toasts: Toast[];
  dismiss: (id: string) => void;
}

const icons = {
  success: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  error: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10"/>
      <line x1="15" y1="9" x2="9" y2="15"/>
      <line x1="9" y1="9" x2="15" y2="15"/>
    </svg>
  ),
  warning: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  info: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
};

const colors = {
  success: { bg: "var(--status-done-dim)",    border: "rgba(0,200,150,0.3)",    color: "var(--status-done)"    },
  error:   { bg: "var(--status-failed-dim)",  border: "rgba(255,92,92,0.3)",    color: "var(--status-failed)"  },
  warning: { bg: "var(--status-waiting-dim)", border: "rgba(255,181,71,0.3)",   color: "var(--status-waiting)" },
  info:    { bg: "var(--status-running-dim)", border: "rgba(59,158,255,0.3)",   color: "var(--status-running)" },
};

export default function Toaster({ toasts, dismiss }: Props) {
  if (!toasts.length) return null;

  return (
    <div style={{
      position: "fixed", bottom: "24px", right: "24px",
      display: "flex", flexDirection: "column", gap: "8px",
      zIndex: 9999, pointerEvents: "none",
    }}>
      {toasts.map(t => {
        const { bg, border, color } = colors[t.type];
        return (
          <div key={t.id} style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "10px 14px",
            background: "var(--bg-elevated)",
            border: `1px solid ${border}`,
            borderLeft: `3px solid ${color}`,
            borderRadius: "var(--radius-lg)",
            minWidth: "260px", maxWidth: "380px",
            pointerEvents: "all",
            animation: "toastIn 0.2s ease",
            boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
          }}>
            <span style={{ color, flexShrink: 0 }}>{icons[t.type]}</span>
            <span style={{
              fontSize: "13px", color: "var(--text-primary)",
              flex: 1, lineHeight: "1.4",
            }}>
              {t.message}
            </span>
            <button onClick={() => dismiss(t.id)} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-muted)", fontSize: "16px", lineHeight: 1,
              padding: "0 2px", flexShrink: 0,
            }}>×</button>
          </div>
        );
      })}
      <style>{`
        @keyframes toastIn {
          from { transform: translateX(20px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}