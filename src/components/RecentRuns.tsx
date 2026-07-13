import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { executionsApi } from "../api/executions";
import type { ExecutionRecord } from "../api/executions";
import { formatTimeAgo, formatDuration } from "../utils/dateTime";

interface Props {
  orchestratorId: string;
  onResume: (sessionId: string, status: string) => void;
}

const STATUS_STYLE: Record<string, { color: string; bg: string; dot: boolean }> = {
  COMPLETED:         { color: "var(--status-done)",    bg: "var(--status-done-dim)",    dot: false },
  FAILED:            { color: "var(--status-failed)",  bg: "var(--status-failed-dim)",  dot: false },
  CANCELLED:         { color: "var(--text-muted)",     bg: "rgba(255,255,255,0.05)",    dot: false },
  RUNNING:           { color: "var(--status-running)", bg: "var(--status-running-dim)", dot: true  },
  WAITING_FOR_HUMAN: { color: "var(--status-waiting)", bg: "var(--status-waiting-dim)", dot: true  },
};

function RunRow({
  run, onResume, isLast,
}: {
  run: ExecutionRecord;
  onResume: (sessionId: string, status: string) => void;
  isLast: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const st = STATUS_STYLE[run.status] || STATUS_STYLE.CANCELLED;
  const isActive = run.status === "RUNNING" || run.status === "WAITING_FOR_HUMAN";

  async function handleClick() {
    setLoading(true);
    try {
      await onResume(run.session_id, run.status);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: "12px",
        padding: "9px 16px",
        borderBottom: isLast ? "none" : "1px solid var(--border)",
        transition: "background 0.1s",
      }}
      onMouseEnter={e =>
        (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)"
      }
      onMouseLeave={e =>
        (e.currentTarget as HTMLDivElement).style.background = "transparent"
      }
    >
      {/* Status badge */}
      <span style={{
        display: "inline-flex", alignItems: "center", gap: "4px",
        padding: "2px 8px", borderRadius: "10px", fontSize: "10px",
        fontWeight: 500, background: st.bg, color: st.color, flexShrink: 0,
      }}>
        {st.dot && (
          <span style={{
            width: "5px", height: "5px", borderRadius: "50%",
            background: st.color,
            animation: "pulse 1.5s ease-in-out infinite",
            flexShrink: 0,
          }} />
        )}
        {run.status}
      </span>

      {/* Session ID + time */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: "11px", fontFamily: "var(--font-mono)",
          color: "var(--text-muted)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {run.session_id.slice(0, 20)}...
        </div>
        <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "1px" }}>
          {formatTimeAgo(run.start_time)}
          {" · "}
          {formatDuration(run.start_time, run.end_time)}
          {run.cost_usd && parseFloat(run.cost_usd) > 0
            ? ` · $${parseFloat(run.cost_usd).toFixed(4)}`
            : ""}
        </div>
      </div>

      {/* Token count */}
      {run.total_tokens ? (
        <span style={{
          fontSize: "11px", color: "var(--text-muted)",
          fontFamily: "var(--font-mono)", flexShrink: 0,
        }}>
          {run.total_tokens.toLocaleString()} tok
        </span>
      ) : null}

      {/* Action button */}
      <button
        onClick={handleClick}
        disabled={loading}
        style={{
          padding: "4px 10px", borderRadius: "6px", fontSize: "11px",
          background: loading
            ? "var(--bg-overlay)"
            : isActive ? "var(--accent-dim)" : "transparent",
          border: `1px solid ${isActive
            ? "rgba(0,200,150,0.3)" : "var(--border-hover)"}`,
          color: loading
            ? "var(--text-muted)"
            : isActive ? "var(--accent)" : "var(--text-secondary)",
          cursor: loading ? "not-allowed" : "pointer",
          fontFamily: "var(--font)",
          fontWeight: isActive ? 600 : 400,
          flexShrink: 0, whiteSpace: "nowrap",
          display: "flex", alignItems: "center", gap: "5px",
          transition: "all 0.15s",
        }}
      >
        {loading ? (
          <>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2"
              style={{ animation: "spin 0.8s linear infinite" }}>
              <polyline points="1 4 1 10 7 10"/>
              <path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
            </svg>
            Loading...
          </>
        ) : isActive ? "Resume" : "View logs"}
      </button>
    </div>
  );
}

export default function RecentRuns({ orchestratorId, onResume }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["recent-runs", orchestratorId],
    queryFn: () => executionsApi.history(orchestratorId).then(r => r.data),
    enabled: !!orchestratorId,
  });

  const runs = (data || []).slice(0, 5);

  if (isLoading) {
    return (
      <div style={{
        padding: "12px 16px",
        background: "var(--bg-surface)", border: "1px solid var(--border)",
        borderRadius: "var(--border-radius-lg, 12px)",
        fontSize: "12px", color: "var(--text-muted)",
      }}>
        Loading recent runs...
      </div>
    );
  }

  if (!runs.length) {
    return (
      <div style={{
        padding: "14px 16px",
        background: "var(--bg-surface)", border: "1px solid var(--border)",
        borderRadius: "var(--border-radius-lg, 12px)",
        display: "flex", alignItems: "center", gap: "10px",
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="var(--text-muted)" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
          No previous runs for this orchestrator
        </span>
      </div>
    );
  }

  return (
    <div style={{
      background: "var(--bg-surface)", border: "1px solid var(--border)",
      borderRadius: "var(--border-radius-lg, 12px)", overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "10px 16px",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: "8px",
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="var(--text-muted)" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <span style={{
          fontSize: "11px", fontWeight: 600, color: "var(--text-muted)",
          textTransform: "uppercase", letterSpacing: "0.5px",
        }}>
          Recent runs
        </span>
        <span style={{
          fontSize: "10px", padding: "1px 6px", borderRadius: "8px",
          background: "var(--bg-overlay)", color: "var(--text-muted)",
        }}>
          {runs.length}
        </span>
      </div>

      {/* Run rows */}
      {runs.map((run, i) => (
        <RunRow
          key={run.session_id}
          run={run}
          onResume={onResume}
          isLast={i === runs.length - 1}
        />
      ))}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}