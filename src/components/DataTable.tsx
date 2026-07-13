import type { ReactNode } from "react";

interface Column<T> {
  key: string;
  label: string;
  width?: string;
  render: (row: T) => ReactNode;
}

interface Props<T> {
  columns: Column<T>[];
  data: T[] | undefined;
  isLoading?: boolean;
  rowKey: (row: T) => string;
  emptyMessage?: string;
}

export default function DataTable<T>({ columns, data, isLoading, rowKey, emptyMessage }: Props<T>) {
  return (
    <div style={{
      background: "var(--bg-surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)",
      overflow: "hidden",
    }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {columns.map(col => (
              <th key={col.key} style={{
                textAlign: "left", padding: "10px 16px",
                fontSize: "11px", color: "var(--text-muted)",
                fontWeight: 600, letterSpacing: "0.6px",
                textTransform: "uppercase",
                width: col.width,
              }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr><td colSpan={columns.length} style={{ padding: "40px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
              Loading...
            </td></tr>
          ) : !data?.length ? (
            <tr><td colSpan={columns.length} style={{ padding: "40px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
              {emptyMessage || "No items yet"}
            </td></tr>
          ) : data.map((row, i) => (
            <tr key={rowKey(row)} style={{
              borderBottom: i < data.length - 1 ? "1px solid var(--border)" : "none",
              transition: "background 0.1s",
            }}
            onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.02)"}
            onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = "transparent"}
            >
              {columns.map(col => (
                <td key={col.key} style={{ padding: "12px 16px" }}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}