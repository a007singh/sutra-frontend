interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  danger?: boolean;
}

export default function ConfirmModal({
  title, message, confirmLabel = "Delete",
  onConfirm, onClose, danger = true,
}: Props) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-hover)",
        borderRadius: "var(--border-radius-lg, 12px)",
        padding: "24px", width: "100%", maxWidth: "400px",
      }} onClick={e => e.stopPropagation()}>

        {/* Icon */}
        <div style={{
          width: "40px", height: "40px", borderRadius: "10px",
          background: danger ? "var(--status-failed-dim)" : "var(--accent-dim)",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: "16px",
        }}>
          {danger ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="var(--status-failed)" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="var(--accent)" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          )}
        </div>

        <h2 style={{
          fontSize: "15px", fontWeight: 600,
          color: "var(--text-primary)", marginBottom: "8px",
        }}>
          {title}
        </h2>
        <p style={{
          fontSize: "13px", color: "var(--text-secondary)",
          lineHeight: "1.6", marginBottom: "24px",
        }}>
          {message}
        </p>

        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "8px 16px", borderRadius: "8px", fontSize: "13px",
            background: "transparent", border: "1px solid var(--border-hover)",
            color: "var(--text-secondary)", cursor: "pointer",
            fontFamily: "var(--font)",
          }}>
            Cancel
          </button>
          <button onClick={() => { onConfirm(); onClose(); }} style={{
            padding: "8px 20px", borderRadius: "8px", fontSize: "13px",
            background: danger ? "var(--status-failed)" : "var(--accent)",
            border: "none",
            color: "#fff", cursor: "pointer",
            fontWeight: 600, fontFamily: "var(--font)",
          }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}