type Variant = "default" | "running" | "done" | "failed" | "waiting" | "accent";

interface Props {
  children: React.ReactNode;
  variant?: Variant;
}

const styles: Record<Variant, React.CSSProperties> = {
  default:  { background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)" },
  running:  { background: "var(--status-running-dim)", color: "var(--status-running)" },
  done:     { background: "var(--status-done-dim)", color: "var(--status-done)" },
  failed:   { background: "var(--status-failed-dim)", color: "var(--status-failed)" },
  waiting:  { background: "var(--status-waiting-dim)", color: "var(--status-waiting)" },
  accent:   { background: "var(--accent-dim)", color: "var(--accent)" },
};

export default function Badge({ children, variant = "default" }: Props) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: "3px 8px", borderRadius: "20px",
      fontSize: "11px", fontWeight: 500,
      ...styles[variant],
    }}>
      {(variant === "running") && (
        <span style={{
          width: "5px", height: "5px", borderRadius: "50%",
          background: "var(--status-running)",
          animation: "pulse 1.5s ease-in-out infinite",
        }} />
      )}
      {children}
    </span>
  );
}