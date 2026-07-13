import { useQuery } from "@tanstack/react-query";
import { orchestratorsApi } from "../api/orchestrators";
import { formatTimeAgo } from "../utils/dateTime";

interface Props {
  orchestratorId: string;
}

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  color?: string;
}

function StatCard({ label, value, sub, accent, color }: StatCardProps) {
  return (
    <div style={{
      background: accent ? "var(--accent-dim)" : "var(--bg-overlay)",
      border: `1px solid ${accent ? "rgba(0,200,150,0.2)" : "var(--border)"}`,
      borderRadius: "8px",
      padding: "12px 14px",
    }}>
      <div style={{
        fontSize: "10px", fontWeight: 600, color: "var(--text-muted)",
        textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px",
      }}>
        {label}
      </div>
      <div style={{
        fontSize: "22px", fontWeight: 600, letterSpacing: "-0.5px",
        color: color || (accent ? "var(--accent)" : "var(--text-primary)"),
        lineHeight: 1,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function BarSegment({ value, total, color }: { value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div style={{
      flex: pct, background: color, height: "100%",
      minWidth: pct > 0 ? "3px" : "0",
      transition: "flex 0.4s ease",
    }} />
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60)  return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export default function OrchestratorStats({ orchestratorId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["orchestrator-stats", orchestratorId],
    queryFn: () => orchestratorsApi.stats(orchestratorId).then(r => r.data),
  });

  if (isLoading) {
    return (
      <div style={{
        padding: "14px", borderRadius: "8px",
        background: "var(--bg-overlay)", border: "1px solid var(--border)",
        fontSize: "12px", color: "var(--text-muted)", textAlign: "center",
      }}>
        Loading stats...
      </div>
    );
  }

  if (!data || data.total_runs === 0) {
    return (
      <div style={{
        padding: "16px", borderRadius: "8px",
        background: "var(--bg-overlay)", border: "1px solid var(--border)",
        textAlign: "center",
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="var(--text-muted)" strokeWidth="1.5" style={{ marginBottom: "8px" }}>
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
        <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
          No executions yet for this orchestrator
        </div>
      </div>
    );
  }

  const successRate = data.success_rate;
  const rateColor = successRate >= 80
    ? "var(--status-done)"
    : successRate >= 50
      ? "var(--status-waiting)"
      : "var(--status-failed)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>

      {/* Top metric cards — 2x2 grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        <StatCard
          label="Total runs"
          value={data.total_runs}
          sub={`Last run ${formatTimeAgo(data.last_run)}`}
        />
        <StatCard
          label="Success rate"
          value={`${successRate}%`}
          sub={`${data.completed} completed`}
          color={rateColor}
        />
        <StatCard
          label="Avg cost"
          value={data.avg_cost_usd > 0 ? `$${data.avg_cost_usd.toFixed(4)}` : "—"}
          sub={`$${data.total_cost_usd.toFixed(4)} total`}
          accent
        />
        <StatCard
          label="Avg duration"
          value={data.avg_duration_s > 0 ? formatDuration(data.avg_duration_s) : "—"}
          sub={`${data.avg_tokens > 0 ? data.avg_tokens.toLocaleString() + " avg tokens" : "no token data"}`}
        />
      </div>

      {/* Run breakdown bar */}
      {data.total_runs > 0 && (
        <div style={{
          background: "var(--bg-overlay)", border: "1px solid var(--border)",
          borderRadius: "8px", padding: "12px 14px",
        }}>
          <div style={{
            fontSize: "10px", fontWeight: 600, color: "var(--text-muted)",
            textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px",
          }}>
            Run breakdown
          </div>

          {/* Stacked bar */}
          <div style={{
            height: "6px", borderRadius: "3px", overflow: "hidden",
            display: "flex", marginBottom: "10px",
            background: "var(--bg-elevated)",
          }}>
            <BarSegment value={data.completed} total={data.total_runs} color="var(--status-done)" />
            <BarSegment value={data.failed}    total={data.total_runs} color="var(--status-failed)" />
            <BarSegment value={data.cancelled} total={data.total_runs} color="var(--text-muted)" />
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: "16px" }}>
            {[
              { label: "Completed", val: data.completed,  color: "var(--status-done)"    },
              { label: "Failed",    val: data.failed,     color: "var(--status-failed)"  },
              { label: "Cancelled", val: data.cancelled,  color: "var(--text-muted)"     },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: color, flexShrink: 0 }} />
                <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                  {label}
                </span>
                <span style={{ fontSize: "11px", fontWeight: 600, color }}>
                  {val}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Token + cost summary row */}
      {data.total_tokens > 0 && (
        <div style={{
          background: "var(--bg-overlay)", border: "1px solid var(--border)",
          borderRadius: "8px", padding: "10px 14px",
          display: "flex", alignItems: "center", gap: "20px",
        }}>
          <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Lifetime
          </div>
          <div style={{ display: "flex", gap: "20px", flex: 1 }}>
            {[
              { label: "tokens consumed", val: data.total_tokens.toLocaleString() },
              { label: "total spend",     val: `$${data.total_cost_usd.toFixed(4)}`, accent: true },
              { label: "avg per run",     val: data.avg_cost_usd > 0 ? `$${data.avg_cost_usd.toFixed(5)}` : "—" },
            ].map(({ label, val, accent }) => (
              <div key={label}>
                <div style={{
                  fontSize: "13px", fontWeight: 600,
                  color: accent ? "var(--accent)" : "var(--text-primary)",
                }}>
                  {val}
                </div>
                <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "1px" }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}