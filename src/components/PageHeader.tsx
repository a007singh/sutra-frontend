interface Props {
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
}

export default function PageHeader({ title, subtitle, action }: Props) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "28px 32px 0",
      marginBottom: "24px",
    }}>
      <div>
        <h1 style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.3px" }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "3px" }}>{subtitle}</p>
        )}
      </div>
      {action && (
        <button onClick={action.onClick} style={{
          display: "flex", alignItems: "center", gap: "6px",
          padding: "8px 16px", borderRadius: "var(--radius)",
          background: "var(--accent)", border: "none",
          color: "#0A0B0F", fontSize: "13px", fontWeight: 600,
          cursor: "pointer", fontFamily: "var(--font)",
          transition: "opacity 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.opacity = "0.85"}
        onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.opacity = "1"}
        >
          <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span>
          {action.label}
        </button>
      )}
    </div>
  );
}