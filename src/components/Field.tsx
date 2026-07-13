import type { ReactNode } from "react";

interface Props {
  label: string;
  error?: string;
  children: ReactNode;
}

export const inputCss: React.CSSProperties = {
  width: "100%", padding: "9px 12px",
  background: "var(--bg-overlay)", border: "1px solid var(--border-hover)",
  borderRadius: "var(--radius)", color: "var(--text-primary)",
  fontSize: "13px", fontFamily: "var(--font)", outline: "none",
  transition: "border-color 0.15s",
};

export const selectCss: React.CSSProperties = {
  ...inputCss, cursor: "pointer",
};

export default function Field({ label, error, children }: Props) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "6px", fontWeight: 500 }}>
        {label}
      </label>
      {children}
      {error && <p style={{ fontSize: "11px", color: "var(--status-failed)", marginTop: "4px" }}>{error}</p>}
    </div>
  );
}