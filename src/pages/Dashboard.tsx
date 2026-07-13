import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { executionsApi } from "../api/executions";
import { orchestratorsApi } from "../api/orchestrators";
import { api } from "../api/client";
import type { ExecutionRecord } from "../api/executions";
import { formatTimeAgo, formatDuration } from "../utils/dateTime";

function MetricCard({
  label, value, sub, accent, icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div style={{
      background: "var(--bg-surface)",
      border: `1px solid ${accent ? "rgba(0,200,150,0.25)" : "var(--border)"}`,
      borderRadius: "var(--border-radius-lg, 12px)",
      padding: "20px 24px",
      display: "flex", flexDirection: "column", gap: "12px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{
          width: "36px", height: "36px", borderRadius: "9px",
          background: accent ? "var(--accent-dim)" : "rgba(255,255,255,0.05)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: accent ? "var(--accent)" : "var(--text-secondary)",
        }}>
          {icon}
        </div>
        {sub && (
          <span style={{
            fontSize: "11px", padding: "2px 8px", borderRadius: "10px",
            background: "var(--accent-dim)", color: "var(--accent)", fontWeight: 500,
          }}>{sub}</span>
        )}
      </div>
      <div>
        <div style={{ fontSize: "28px", fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.5px" }}>
          {value}
        </div>
        <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "3px" }}>
          {label}
        </div>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const s = status?.toUpperCase();
  const color = s === "COMPLETED" ? "var(--status-done)"
    : s === "RUNNING"            ? "var(--status-running)"
    : s === "FAILED"             ? "var(--status-failed)"
    : s === "CANCELLED"          ? "var(--text-muted)"
    : s === "WAITING_FOR_HUMAN"  ? "var(--status-waiting)"
    : "var(--text-muted)";

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      fontSize: "11px", fontWeight: 500, color,
    }}>
      <span style={{
        width: "5px", height: "5px", borderRadius: "50%",
        background: color,
        animation: s === "RUNNING" ? "pulse 1.5s ease-in-out infinite" : "none",
      }} />
      {status}
    </span>
  );
}

function DashboardOverview() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => executionsApi.stats().then(r => r.data),
    refetchInterval: 10000,
  });

  const { data: anomalyData } = useQuery({
    queryKey: ["governance-anomalies-overview"],
    queryFn: () => api.get("/api/executions/governance/anomalies").then(r => r.data),
    refetchInterval: 60000,
  });
  const anomalyCritical = anomalyData?.critical_count || 0;
  const anomalyWarning  = anomalyData?.warning_count  || 0;
  const anomalyWorst    = (anomalyData?.results || []).find(
    (r: any) => r.overall_severity === "critical" || r.overall_severity === "warning"
  );

  const counts          = data?.counts           || {};
  const execStats       = data?.execution_stats  || {};
  const totalCost       = data?.total_cost_usd   || 0;
  const recent: ExecutionRecord[] = data?.recent_executions || [];

  const successRate = execStats.total > 0
    ? Math.round((execStats.completed / execStats.total) * 100)
    : 0;

  return (
    <div style={{ padding: "28px 32px", maxWidth: "1100px" }}>
      {/* Greeting */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 600, letterSpacing: "-0.4px", color: "var(--text-primary)" }}>
          Welcome back
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
          Here's what's happening with your agent platform
        </p>
      </div>

      {/* Metric cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: "14px",
        marginBottom: "28px",
      }}>
        <MetricCard
          label="Workflows"
          value={isLoading ? "—" : counts.workflows ?? 0}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>}
        />
        <MetricCard
          label="Sub-agents"
          value={isLoading ? "—" : counts.sub_agents ?? 0}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/></svg>}
        />
        <MetricCard
          label="Orchestrators"
          value={isLoading ? "—" : counts.orchestrators ?? 0}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 7v4M5 17l7-6 7 6"/></svg>}
        />
        <MetricCard
          label="Runs this week"
          value={isLoading ? "—" : counts.executions_this_week ?? 0}
          accent
          sub={
            (execStats.waiting_for_human || 0) > 0
              ? `${execStats.waiting_for_human} waiting`
              : execStats.running > 0
                ? `${execStats.running} live`
                : undefined
          }
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>}
        />
      </div>

      {/* Waiting for human alert banner */}
      {(execStats.waiting_for_human || 0) > 0 && (
        <div
          onClick={() => window.dispatchEvent(new CustomEvent("navigate", {
            detail: { page: "history", filter: "WAITING_FOR_HUMAN" }
          }))}
          style={{
            display: "flex", alignItems: "center", gap: "12px",
            padding: "12px 20px", marginBottom: "20px",
            background: "var(--status-waiting-dim)",
            border: "1px solid rgba(255,181,71,0.3)",
            borderRadius: "var(--border-radius-lg, 12px)",
            cursor: "pointer", transition: "opacity 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.opacity = "0.85"}
          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.opacity = "1"}
        >
          <div style={{
            width: "8px", height: "8px", borderRadius: "50%",
            background: "var(--status-waiting)",
            animation: "pulse 1.5s ease-in-out infinite",
            flexShrink: 0,
          }} />
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--status-waiting)" }}>
              {execStats.waiting_for_human} execution{execStats.waiting_for_human > 1 ? "s" : ""} waiting for your input
            </span>
            <span style={{ fontSize: "12px", color: "var(--text-secondary)", marginLeft: "8px" }}>
              Agent{execStats.waiting_for_human > 1 ? "s are" : " is"} paused and need a response to continue
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--status-waiting)", fontWeight: 500 }}>
            Review
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
        </div>
      )}

      {/* Cost anomaly alert banner */}
      {(anomalyCritical > 0 || anomalyWarning > 0) && (
        <div
          onClick={() => window.dispatchEvent(new CustomEvent("navigate", { detail: "dashboard-governance" }))}
          style={{
            display: "flex", alignItems: "center", gap: "12px",
            padding: "12px 20px", marginBottom: "20px",
            background: anomalyCritical > 0 ? "rgba(255,80,80,0.08)" : "var(--status-waiting-dim)",
            border: `1px solid ${anomalyCritical > 0 ? "rgba(255,80,80,0.3)" : "rgba(255,181,71,0.3)"}`,
            borderRadius: "var(--border-radius-lg, 12px)",
            cursor: "pointer", transition: "opacity 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.opacity = "0.85"}
          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.opacity = "1"}
        >
          <div style={{
            width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0,
            background: anomalyCritical > 0 ? "var(--status-failed)" : "var(--status-waiting)",
            animation: "pulse 1.5s ease-in-out infinite",
          }} />
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: anomalyCritical > 0 ? "var(--status-failed)" : "var(--status-waiting)" }}>
              {anomalyCritical > 0
                ? `${anomalyCritical} critical cost anomaly${anomalyCritical > 1 ? "s" : ""} detected`
                : `${anomalyWarning} cost warning${anomalyWarning > 1 ? "s" : ""} detected`}
            </span>
            {anomalyWorst && (
              <span style={{ fontSize: "12px", color: "var(--text-secondary)", marginLeft: "8px" }}>
                {anomalyWorst.name} — {anomalyWorst.trend_ratio
                  ? `${anomalyWorst.trend_ratio}× vs last week`
                  : anomalyWorst.spike_ratio
                  ? `single run ${anomalyWorst.spike_ratio}× avg`
                  : ""}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 500, color: anomalyCritical > 0 ? "var(--status-failed)" : "var(--status-waiting)" }}>
            Review
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
        </div>
      )}

      {/* Second row: execution stats + cost */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: "14px",
        marginBottom: "28px",
      }}>
        {/* Success rate */}
        <div style={{
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "var(--border-radius-lg, 12px)", padding: "20px 24px",
        }}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "14px" }}>
            Success rate
          </div>
          <div style={{ fontSize: "32px", fontWeight: 600, color: successRate >= 80 ? "var(--status-done)" : successRate >= 50 ? "var(--status-waiting)" : "var(--status-failed)", letterSpacing: "-1px" }}>
            {isLoading ? "—" : `${successRate}%`}
          </div>
          <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
            {[
              { label: "Completed", val: execStats.completed, color: "var(--status-done)" },
              { label: "Failed",    val: execStats.failed,    color: "var(--status-failed)" },
              { label: "Total",     val: execStats.total,     color: "var(--text-muted)" },
            ].map(({ label, val, color }) => (
              <div key={label}>
                <div style={{ fontSize: "16px", fontWeight: 600, color }}>{val ?? 0}</div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Total spend */}
        <div style={{
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "var(--border-radius-lg, 12px)", padding: "20px 24px",
        }}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "14px" }}>
            Total spend
          </div>
          <div style={{ fontSize: "32px", fontWeight: 600, color: "var(--accent)", letterSpacing: "-1px" }}>
            {isLoading ? "—" : `$${totalCost.toFixed(4)}`}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>
            Across all executions
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
            {execStats.total > 0
              ? `≈ $${(totalCost / execStats.total).toFixed(5)} avg per run`
              : "No runs yet"}
          </div>
        </div>

        {/* Quick actions */}
        <div style={{
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "var(--border-radius-lg, 12px)", padding: "20px 24px",
        }}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "14px" }}>
            Quick actions
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              { label: "New chat",          page: "newchat",       icon: "✏" },
              { label: "View history",      page: "history",       icon: "⏱" },
              { label: "New sub-agent",     page: "subagents",     icon: "+" },
              { label: "New orchestrator",  page: "orchestrators", icon: "+" },
            ].map(({ label, page, icon }) => (
              <button
                key={page + label}
                onClick={() => window.dispatchEvent(new CustomEvent(
                  page === "newchat" ? "newchat" : "navigate",
                  { detail: page === "newchat" ? undefined : page }
                ))}
                style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "7px 10px", borderRadius: "var(--radius)",
                  background: "transparent", border: "1px solid var(--border-hover)",
                  color: "var(--text-secondary)", cursor: "pointer",
                  fontSize: "12px", fontFamily: "var(--font)",
                  textAlign: "left", transition: "all 0.15s",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(128,128,128,0.08)";
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
                }}
              >
                <span style={{ fontSize: "14px", width: "16px", textAlign: "center" }}>{icon}</span>
                {label}
                <svg style={{ marginLeft: "auto" }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Recent executions */}
      <div style={{
        background: "var(--bg-surface)", border: "1px solid var(--border)",
        borderRadius: "var(--border-radius-lg, 12px)", overflow: "hidden",
      }}>
        <div style={{
          padding: "14px 20px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>
            Recent executions
          </span>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("navigate", { detail: "history" }))}
            style={{
              fontSize: "12px", color: "var(--accent)", background: "none",
              border: "none", cursor: "pointer", fontFamily: "var(--font)",
            }}
          >
            View all →
          </button>
        </div>

        {isLoading ? (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
            Loading...
          </div>
        ) : recent.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center" }}>
            <div style={{
              width: "44px", height: "44px", borderRadius: "10px",
              background: "var(--accent-dim)", margin: "0 auto 12px",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            </div>
            <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)", marginBottom: "4px" }}>
              No executions yet
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Run a workflow to see activity here
            </div>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Orchestrator", "Status", "Started", "Duration", "Cost"].map(h => (
                  <th key={h} style={{
                    textAlign: "left", padding: "8px 20px",
                    fontSize: "11px", color: "var(--text-muted)",
                    fontWeight: 600, letterSpacing: "0.6px", textTransform: "uppercase",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map((e, i) => (
                <tr key={e.session_id} style={{
                  borderBottom: i < recent.length - 1 ? "1px solid var(--border)" : "none",
                  transition: "background 0.1s",
                }}
                onMouseEnter={el => (el.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.02)"}
                onMouseLeave={el => (el.currentTarget as HTMLTableRowElement).style.background = "transparent"}
                >
                  <td style={{ padding: "12px 20px" }}>
                    <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>
                      {(e as any).orchestrator_name || "Unknown"}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: "1px" }}>
                      {e.session_id?.slice(0, 12)}...
                    </div>
                  </td>
                  <td style={{ padding: "12px 20px" }}>
                    <StatusDot status={e.status} />
                  </td>
                  <td style={{ padding: "12px 20px", fontSize: "12px", color: "var(--text-secondary)" }}>
                    {formatTimeAgo(e.start_time)}
                  </td>
                  <td style={{ padding: "12px 20px", fontSize: "12px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                    {formatDuration(e.start_time, e.end_time)}
                  </td>
                  <td style={{ padding: "12px 20px" }}>
                    {e.cost_usd ? (
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--accent)" }}>
                        ${parseFloat(e.cost_usd).toFixed(4)}
                      </span>
                    ) : <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Usage & Cost tab ──────────────────────────────────────────────────────────

type UsagePeriod = 1 | 7 | 30;

function UsageDashboard() {
  const [period, setPeriod] = useState<UsagePeriod>(7);

  const { data, isLoading } = useQuery({
    queryKey: ["usage-stats", period],
    queryFn: () => (executionsApi as any).usage(period).then((r: any) => r.data),
    refetchInterval: 30000,
  });

  const kpis   = data?.kpis            || {};
  const daily  = data?.daily           || [];
  const byOrch  = data?.by_orchestrator || [];
  const byModel     = data?.by_model          || [];
  const effScores   = data?.efficiency_scores || [];
  const hitlStats   = data?.hitl_stats        || {};
  const toolHealth  = data?.tool_health        || [];
  const workflowRoi = data?.workflow_roi       || {};
  const tokenWaste  = data?.token_waste        || {};
  const convDepth   = data?.conv_depth         || { buckets: [], total_convs: 0 };
  const concurrency = data?.concurrency        || { runs: [], run_count: 0 };

  const maxCost = daily.reduce((m: number, d: any) => Math.max(m, d.cost_usd), 0.00001);
  const maxTok  = byOrch.reduce((m: number, o: any) => Math.max(m, o.input_tokens + o.output_tokens), 1);

  const fmtCost = (v: number) =>
    v < 0.001 ? `$${v.toFixed(6)}` : `$${v.toFixed(4)}`;

  const fmtTok = (v: number) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
    : v >= 1_000   ? `${(v / 1_000).toFixed(1)}K`
    : String(v);

  const periodLabel: Record<UsagePeriod, string> = { 1: "Today", 7: "Last 7 days", 30: "Last 30 days" };

  return (
    <div style={{ padding: "28px 32px", maxWidth: "1100px" }}>
      {/* Period selector */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            Usage & cost
          </h2>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "3px" }}>
            Token consumption and spend across all workflows
          </p>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          {([1, 7, 30] as UsagePeriod[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: "5px 14px", fontSize: "12px", borderRadius: "var(--radius)",
                border: "1px solid var(--border)", cursor: "pointer", fontFamily: "var(--font)",
                background: period === p ? "var(--accent-dim)" : "transparent",
                color: period === p ? "var(--accent)" : "var(--text-secondary)",
                fontWeight: period === p ? 600 : 400,
              }}
            >
              {p === 1 ? "Today" : p === 7 ? "7 days" : "30 days"}
            </button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "14px", marginBottom: "24px" }}>
        {[
          { label: "Total cost", value: isLoading ? "—" : fmtCost(kpis.total_cost_usd || 0) },
          { label: "Total tokens", value: isLoading ? "—" : fmtTok(kpis.total_tokens || 0),
            sub: `${fmtTok(kpis.input_tokens || 0)} in · ${fmtTok(kpis.output_tokens || 0)} out` },
          { label: "Runs", value: isLoading ? "—" : String(kpis.total_runs || 0) },
          { label: "Avg cost / run", value: isLoading ? "—" : fmtCost(kpis.avg_cost_per_run || 0) },
        ].map(({ label, value, sub }: any) => (
          <div key={label} style={{
            background: "var(--bg-surface)", border: "1px solid var(--border)",
            borderRadius: "var(--border-radius-lg, 12px)", padding: "18px 20px",
          }}>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" }}>
              {label}
            </div>
            <div style={{ fontSize: "24px", fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.5px" }}>
              {value}
            </div>
            {sub && <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>{sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "14px", marginBottom: "24px" }}>
        {/* Daily cost trend */}
        <div style={{
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "var(--border-radius-lg, 12px)", padding: "20px 24px",
        }}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "16px" }}>
            Daily cost — {periodLabel[period]}
          </div>
          {isLoading ? (
            <div style={{ height: "100px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "12px" }}>Loading…</div>
          ) : daily.length === 0 ? (
            <div style={{ height: "100px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "12px" }}>No data for this period</div>
          ) : (
            <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: "80px" }}>
              {daily.map((d: any) => {
                const h = Math.max(4, Math.round((d.cost_usd / maxCost) * 80));
                const isToday = d.date === new Date().toISOString().slice(0, 10);
                return (
                  <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                    <div
                      title={`${d.date}: ${fmtCost(d.cost_usd)} · ${d.runs} run${d.runs !== 1 ? "s" : ""}`}
                      style={{
                        width: "100%", height: `${h}px`,
                        background: isToday ? "var(--accent)" : "rgba(var(--accent-rgb, 0,200,150), 0.25)",
                        borderRadius: "3px 3px 0 0", cursor: "default",
                      }}
                    />
                    {period <= 7 && (
                      <div style={{ fontSize: "9px", color: "var(--text-muted)", transform: "rotate(-30deg)", transformOrigin: "center" }}>
                        {d.date.slice(5)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Per-orchestrator breakdown */}
        <div style={{
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "var(--border-radius-lg, 12px)", padding: "20px 24px",
        }}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "16px" }}>
            Cost by workflow
          </div>
          {isLoading ? (
            <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>Loading…</div>
          ) : byOrch.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>No data for this period</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {byOrch.slice(0, 6).map((o: any) => {
                const pct = Math.max(4, Math.round(((o.input_tokens + o.output_tokens) / maxTok) * 100));
                return (
                  <div key={o.orchestrator_id}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontSize: "12px", color: "var(--text-secondary)", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {o.name}
                      </span>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>
                        {fmtCost(o.cost_usd)}
                      </span>
                    </div>
                    <div style={{ height: "4px", background: "var(--border)", borderRadius: "2px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "var(--accent)", borderRadius: "2px" }} />
                    </div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>
                      {fmtTok(o.input_tokens + o.output_tokens)} tokens · {o.runs} run{o.runs !== 1 ? "s" : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cost by model + Monthly forecast row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "24px" }}>

        {/* Cost by model */}
        <div style={{
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "var(--border-radius-lg, 12px)", padding: "20px 24px",
        }}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "16px" }}>
            Cost by model
          </div>
          {isLoading ? (
            <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>Loading…</div>
          ) : byModel.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>No data for this period</div>
          ) : (() => {
            const totalModelCost = byModel.reduce((s: number, m: any) => s + m.cost_usd, 0) || 0.000001;
            const palette = ["var(--accent)", "rgba(0,200,150,0.45)", "rgba(0,200,150,0.25)", "var(--text-muted)"];
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {byModel.map((m: any, i: number) => {
                  const pct = Math.round((m.cost_usd / totalModelCost) * 100);
                  return (
                    <div key={m.model_id}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{m.label}</span>
                        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>
                          {fmtCost(m.cost_usd)} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>· {pct}%</span>
                        </span>
                      </div>
                      <div style={{ height: "6px", background: "var(--border)", borderRadius: "3px", overflow: "hidden" }}>
                        <div style={{
                          height: "100%", width: `${Math.max(2, pct)}%`,
                          background: palette[i % palette.length], borderRadius: "3px",
                        }} />
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>
                        {m.runs} run{m.runs !== 1 ? "s" : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Monthly spend forecast */}
        <div style={{
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "var(--border-radius-lg, 12px)", padding: "20px 24px",
        }}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "16px" }}>
            Monthly spend forecast
          </div>
          {isLoading ? (
            <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>Loading…</div>
          ) : (() => {
            const mf = data?.monthly_forecast || {};
            const spent     = mf.month_spent    || 0;
            const projected = mf.projected       || 0;
            const lastMonth = mf.last_month_cost || 0;
            const elapsed   = mf.days_elapsed    || 1;
            const inMonth   = mf.days_in_month   || 30;
            const pct = projected > 0 ? Math.min(100, Math.round((spent / projected) * 100)) : 0;
            return (
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "28px", fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.5px" }}>
                    {fmtCost(projected)}
                  </span>
                  <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>projected this month</span>
                </div>
                <div style={{ background: "var(--border)", borderRadius: "4px", overflow: "hidden", height: "8px", margin: "12px 0 8px" }}>
                  <div style={{
                    width: `${pct}%`, height: "100%",
                    background: "var(--accent)", borderRadius: "4px", transition: "width 0.4s",
                  }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)", marginBottom: "16px" }}>
                  <span>{fmtCost(spent)} spent (day {elapsed})</span>
                  <span>{pct}% of projection</span>
                </div>
                <div style={{ height: "0.5px", background: "var(--border)", margin: "0 0 14px" }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                  {[
                    { label: "Last month",    value: fmtCost(lastMonth) },
                    { label: "Daily rate",    value: fmtCost(mf.daily_rate || 0) },
                    { label: "Days left",     value: String(mf.days_remaining ?? "—") },
                  ].map(({ label, value }) => (
                    <div key={label} style={{
                      background: "rgba(128,128,128,0.06)", borderRadius: "var(--radius)",
                      padding: "8px 10px",
                    }}>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</div>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── Agent Insights divider ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "32px 0 20px" }}>
        <div style={{ flex: 1, height: "0.5px", background: "var(--border)" }} />
        <span style={{
          fontSize: "11px", fontWeight: 600, color: "var(--text-muted)",
          textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap",
        }}>Agent insights</span>
        <div style={{ flex: 1, height: "0.5px", background: "var(--border)" }} />
      </div>

      {/* Efficiency + HITL row */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "14px", marginBottom: "14px" }}>

        {/* Agent efficiency scores */}
        <div style={{
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "var(--border-radius-lg, 12px)", padding: "20px 24px",
        }}>
          <div style={{ marginBottom: "4px" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Agent efficiency score
            </span>
          </div>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "16px", marginTop: "2px" }}>
            Success rate ÷ avg cost per run — higher is better
          </p>
          {isLoading ? (
            <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>Loading…</div>
          ) : effScores.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>No data yet</div>
          ) : (() => {
            const maxScore = effScores[0]?.efficiency_score || 1;
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {effScores.slice(0, 5).map((e: any, i: number) => {
                  const barPct = Math.max(4, Math.round((e.efficiency_score / maxScore) * 100));
                  const srColor = e.success_rate >= 90 ? "var(--status-done)"
                    : e.success_rate >= 70 ? "var(--status-waiting)" : "var(--status-failed)";
                  return (
                    <div key={e.orchestrator_id}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span style={{ fontSize: "12px", color: "var(--text-secondary)", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {i === 0 && <span style={{ fontSize: "10px", marginRight: "5px" }}>★</span>}{e.name}
                        </span>
                        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                          <span style={{ fontSize: "11px", color: srColor, fontWeight: 600 }}>{e.success_rate}%</span>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{fmtCost(e.avg_cost_usd)}/run</span>
                        </div>
                      </div>
                      <div style={{ height: "5px", background: "var(--border)", borderRadius: "3px", overflow: "hidden" }}>
                        <div style={{
                          height: "100%", width: `${barPct}%`,
                          background: i === 0 ? "var(--accent)" : "rgba(0,200,150,0.35)",
                          borderRadius: "3px",
                        }} />
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>
                        {e.runs} run{e.runs !== 1 ? "s" : ""} · {e.failed} failed
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* HITL wait time */}
        <div style={{
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "var(--border-radius-lg, 12px)", padding: "20px 24px",
        }}>
          <div style={{ marginBottom: "4px" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Human-in-the-loop
            </span>
          </div>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "20px", marginTop: "2px" }}>
            How long agents wait for human input
          </p>
          {isLoading ? (
            <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>Loading…</div>
          ) : (() => {
            const fmtDur = (s: number) =>
              s >= 3600 ? `${(s/3600).toFixed(1)}h`
              : s >= 60  ? `${Math.round(s/60)}m`
              : `${Math.round(s)}s`;
            const hitlPct = hitlStats.hitl_pct || 0;
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div style={{ background: "rgba(128,128,128,0.06)", borderRadius: "var(--radius)", padding: "10px 12px" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "6px" }}>Avg wait</div>
                    <div style={{ fontSize: "20px", fontWeight: 600, color: hitlStats.avg_hitl_wait_s > 300 ? "var(--status-waiting)" : "var(--text-primary)" }}>
                      {fmtDur(hitlStats.avg_hitl_wait_s || 0)}
                    </div>
                  </div>
                  <div style={{ background: "rgba(128,128,128,0.06)", borderRadius: "var(--radius)", padding: "10px 12px" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "6px" }}>Auto avg</div>
                    <div style={{ fontSize: "20px", fontWeight: 600, color: "var(--status-done)" }}>
                      {fmtDur(hitlStats.avg_auto_dur_s || 0)}
                    </div>
                  </div>
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px" }}>
                    <span>HITL runs: {hitlStats.hitl_run_count || 0}</span>
                    <span>Auto runs: {hitlStats.auto_run_count || 0}</span>
                  </div>
                  <div style={{ height: "8px", background: "var(--border)", borderRadius: "4px", overflow: "hidden" }}>
                    <div style={{
                      width: `${Math.min(100, hitlPct)}%`, height: "100%",
                      background: "var(--status-waiting)", borderRadius: "4px",
                    }} />
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px", textAlign: "center" }}>
                    {hitlPct}% of runs required human input
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Tool call success rate — full width */}
      <div style={{
        background: "var(--bg-surface)", border: "1px solid var(--border)",
        borderRadius: "var(--border-radius-lg, 12px)", padding: "20px 24px",
        marginBottom: "24px",
      }}>
        <div style={{ marginBottom: "4px" }}>
          <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Tool call success rate
          </span>
        </div>
        <p style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "16px", marginTop: "2px" }}>
          Per-tool success vs failure — sorted worst first so issues surface immediately
        </p>
        {isLoading ? (
          <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>Loading…</div>
        ) : toolHealth.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>No tool calls recorded in this period</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Tool", "Success rate", "Calls", "Succeeded", "Failed", "Health"].map((h, i) => (
                  <th key={h} style={{
                    textAlign: i === 0 ? "left" : "right",
                    padding: "6px 12px", fontSize: "11px",
                    color: "var(--text-muted)", fontWeight: 600,
                    letterSpacing: "0.5px", textTransform: "uppercase",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {toolHealth.map((t: any, i: number) => {
                const sr = t.success_rate as number;
                const srColor = sr >= 90 ? "var(--status-done)"
                  : sr >= 70 ? "var(--status-waiting)" : "var(--status-failed)";
                const badge = sr >= 90
                  ? { label: "Healthy",  bg: "rgba(0,200,100,0.12)",   color: "var(--status-done)" }
                  : sr >= 70
                  ? { label: "Degraded", bg: "rgba(255,181,71,0.15)",  color: "var(--status-waiting)" }
                  : { label: "Failing",  bg: "rgba(255,80,80,0.12)",   color: "var(--status-failed)" };
                return (
                  <tr key={t.tool} style={{
                    borderBottom: i < toolHealth.length - 1 ? "1px solid var(--border)" : "none",
                  }}>
                    <td style={{ padding: "10px 12px", fontSize: "12px", fontWeight: 500, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                      {t.tool}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
                        <div style={{ width: "80px", height: "5px", background: "var(--border)", borderRadius: "3px", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${sr}%`, background: srColor, borderRadius: "3px" }} />
                        </div>
                        <span style={{ fontSize: "12px", fontWeight: 600, color: srColor, minWidth: "36px", textAlign: "right" }}>
                          {sr}%
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: "12px", color: "var(--text-secondary)", textAlign: "right" }}>{t.total}</td>
                    <td style={{ padding: "10px 12px", fontSize: "12px", color: "var(--status-done)", textAlign: "right", fontWeight: 500 }}>{t.success}</td>
                    <td style={{ padding: "10px 12px", fontSize: "12px", textAlign: "right", fontWeight: t.error > 0 ? 600 : 400, color: t.error > 0 ? "var(--status-failed)" : "var(--text-muted)" }}>{t.error}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <span style={{ fontSize: "11px", fontWeight: 500, padding: "2px 8px", borderRadius: "10px", background: badge.bg, color: badge.color }}>
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Workflow ROI + Token Waste row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>

        {/* Workflow ROI estimate */}
        <div style={{
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "var(--border-radius-lg, 12px)", padding: "20px 24px",
        }}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
            Workflow ROI estimate
          </div>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "16px", marginTop: "2px" }}>
            Transactions created vs AI cost — a proxy for value delivered
          </p>
          {isLoading ? (
            <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>Loading…</div>
          ) : (() => {
            const soCount  = (workflowRoi as any).so_created     || 0;
            const poCount  = (workflowRoi as any).po_created     || 0;
            const aiCost   = (workflowRoi as any).total_ai_cost  || 0;
            const byOrch   = (workflowRoi as any).by_orchestrator || [];
            const txTotal  = soCount + poCount;
            const costPerTx = txTotal > 0 ? fmtCost(aiCost / txTotal) : "—";
            return (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "16px" }}>
                  {[
                    { label: "Sales orders",    value: String(soCount) },
                    { label: "Purchase orders", value: String(poCount) },
                    { label: "AI cost / txn",   value: costPerTx },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ background: "rgba(128,128,128,0.06)", borderRadius: "var(--radius)", padding: "8px 10px" }}>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "4px" }}>{label}</div>
                      <div style={{ fontSize: "18px", fontWeight: 600, color: "var(--text-primary)" }}>{value}</div>
                    </div>
                  ))}
                </div>
                {byOrch.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {byOrch.slice(0, 4).map((o: any) => (
                      <div key={o.orchestrator_id} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                        <span style={{ color: "var(--text-secondary)", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.name}</span>
                        <span style={{ color: "var(--text-muted)" }}>{o.runs} runs · {fmtCost(o.cost_per_run)}/run</span>
                      </div>
                    ))}
                  </div>
                )}
                {txTotal === 0 && (
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                    No SO/PO creations detected in this period
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Token waste indicator */}
        <div style={{
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "var(--border-radius-lg, 12px)", padding: "20px 24px",
        }}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
            Token waste indicator
          </div>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "16px", marginTop: "2px" }}>
            Output tokens per successful tool call — lower is more efficient
          </p>
          {isLoading ? (
            <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>Loading…</div>
          ) : (() => {
            const byOrch = (tokenWaste as any).by_orchestrator || [];
            if (byOrch.length === 0) {
              return <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>No data for this period</div>;
            }
            const maxTpt = byOrch[0]?.tokens_per_call || 1;
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {byOrch.slice(0, 5).map((o: any) => {
                  const tpt       = o.tokens_per_call as number;
                  const barPct    = Math.max(4, Math.round((tpt / maxTpt) * 100));
                  const wasteColor = tpt <= maxTpt * 0.33 ? "var(--status-done)"
                    : tpt <= maxTpt * 0.66 ? "var(--status-waiting)" : "var(--status-failed)";
                  const label = tpt <= maxTpt * 0.33 ? "Efficient"
                    : tpt <= maxTpt * 0.66 ? "Moderate" : "Wasteful";
                  return (
                    <div key={o.orchestrator_id}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span style={{ fontSize: "12px", color: "var(--text-secondary)", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {o.name}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 600, color: wasteColor }}>{label}</span>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{fmtTok(tpt)}/call</span>
                        </div>
                      </div>
                      <div style={{ height: "5px", background: "var(--border)", borderRadius: "3px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${barPct}%`, background: wasteColor, borderRadius: "3px" }} />
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>
                        {fmtTok(o.output_tokens)} total output · {o.successful_calls} successful calls
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Conversation depth + Concurrency timeline row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: "14px", marginBottom: "14px" }}>

        {/* Conversation depth distribution */}
        <div style={{
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "var(--border-radius-lg, 12px)", padding: "20px 24px",
        }}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
            Conversation depth
          </div>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "20px", marginTop: "2px" }}>
            How many turns before agents resolve a task
          </p>
          {isLoading ? (
            <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>Loading…</div>
          ) : (() => {
            const buckets   = (convDepth as any).buckets    || [];
            const total     = (convDepth as any).total_convs || 0;
            if (total === 0) return <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>No conversations yet</div>;
            const maxCount  = Math.max(...buckets.map((b: any) => b.count), 1);
            const barColors = ["var(--status-done)", "var(--accent)", "var(--status-waiting)", "var(--status-failed)"];
            return (
              <div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: "12px", height: "80px", marginBottom: "10px" }}>
                  {buckets.map((b: any, i: number) => {
                    const h   = Math.max(4, Math.round((b.count / maxCount) * 80));
                    const pct = total > 0 ? Math.round((b.count / total) * 100) : 0;
                    return (
                      <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>{pct}%</span>
                        <div
                          title={`${b.label}: ${b.count} conversation${b.count !== 1 ? "s" : ""}`}
                          style={{
                            width: "100%", height: `${h}px`,
                            background: barColors[i % barColors.length],
                            borderRadius: "3px 3px 0 0", opacity: 0.85,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: "12px" }}>
                  {buckets.map((b: any, i: number) => (
                    <div key={b.label} style={{ flex: 1, textAlign: "center" }}>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>{b.label}</div>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", marginTop: "2px" }}>{b.count}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "12px", textAlign: "center" }}>
                  {total} total conversations
                </div>
              </div>
            );
          })()}
        </div>

        {/* Agent concurrency timeline */}
        <div style={{
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "var(--border-radius-lg, 12px)", padding: "20px 24px",
        }}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
            Execution timeline
          </div>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "16px", marginTop: "2px" }}>
            Recent runs — overlapping bars = concurrent executions
          </p>
          {isLoading ? (
            <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>Loading…</div>
          ) : (() => {
            const runs = (concurrency as any).runs || [];
            if (runs.length === 0) return <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>No runs in this period</div>;
            // Find time window
            const tMin = new Date(runs[0].start_time).getTime();
            const tMax = Math.max(...runs.map((r: any) =>
              r.end_time ? new Date(r.end_time).getTime() : new Date(r.start_time).getTime() + 60000
            ));
            const span = Math.max(tMax - tMin, 1);
            // Assign each unique orchestrator a colour slot
            const orchIds = [...new Set(runs.map((r: any) => r.orchestrator_id))] as string[];
            const palette = ["var(--accent)", "var(--status-waiting)", "#7F77DD", "#D85A30", "#1D9E75", "#D4537E"];
            const orchColor = Object.fromEntries(orchIds.map((id, i) => [id, palette[i % palette.length]]));
            const statusOpacity = (s: string) =>
              s === "COMPLETED" ? 1 : s === "FAILED" ? 0.5 : s === "RUNNING" ? 0.9 : 0.6;
            return (
              <div>
                <div style={{ position: "relative", height: `${Math.min(runs.length, 12) * 24}px` }}>
                  {runs.slice(-12).map((r: any, i: number) => {
                    const st  = new Date(r.start_time).getTime();
                    const et  = r.end_time ? new Date(r.end_time).getTime() : st + 60000;
                    const left = ((st - tMin) / span) * 100;
                    const width = Math.max(0.5, ((et - st) / span) * 100);
                    const top  = i * 24;
                    const col  = orchColor[r.orchestrator_id] || "var(--accent)";
                    const op   = statusOpacity(r.status);
                    return (
                      <div
                        key={r.session_id}
                        title={`${r.name} · ${r.status} · ${r.duration_s}s · ${r.cost_usd > 0 ? fmtCost(r.cost_usd) : "—"}`}
                        style={{
                          position: "absolute", top: `${top}px`, height: "18px",
                          left: `${left}%`, width: `${width}%`,
                          minWidth: "3px",
                          background: col, opacity: op,
                          borderRadius: "3px", cursor: "default",
                        }}
                      />
                    );
                  })}
                </div>
                {/* Legend */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "12px" }}>
                  {orchIds.slice(0, 4).map(id => {
                    const name = runs.find((r: any) => r.orchestrator_id === id)?.name || id.slice(0, 8);
                    return (
                      <div key={id} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <div style={{ width: "10px", height: "10px", borderRadius: "2px", background: orchColor[id], flexShrink: 0 }} />
                        <span style={{ fontSize: "10px", color: "var(--text-muted)", maxWidth: "100px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "6px" }}>
                  Hover bars for details · Overlapping bars = concurrent runs
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Token detail table */}
      <div style={{
        background: "var(--bg-surface)", border: "1px solid var(--border)",
        borderRadius: "var(--border-radius-lg, 12px)", overflow: "hidden",
      }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>
            Per-workflow token & cost breakdown
          </span>
        </div>
        {isLoading ? (
          <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>Loading…</div>
        ) : byOrch.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>
            No executions in this period
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Workflow", "Runs", "Input tokens", "Output tokens", "Total tokens", "Total cost", "Avg cost/run"].map(h => (
                  <th key={h} style={{
                    textAlign: h === "Workflow" ? "left" : "right",
                    padding: "8px 20px", fontSize: "11px",
                    color: "var(--text-muted)", fontWeight: 600,
                    letterSpacing: "0.6px", textTransform: "uppercase",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byOrch.map((o: any, i: number) => (
                <tr key={o.orchestrator_id} style={{
                  borderBottom: i < byOrch.length - 1 ? "1px solid var(--border)" : "none",
                }}>
                  <td style={{ padding: "10px 20px", fontSize: "13px", fontWeight: 500, color: "var(--text-primary)", maxWidth: "220px" }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.name}</div>
                  </td>
                  <td style={{ padding: "10px 20px", fontSize: "12px", color: "var(--text-secondary)", textAlign: "right" }}>{o.runs}</td>
                  <td style={{ padding: "10px 20px", fontSize: "12px", color: "var(--text-secondary)", textAlign: "right", fontFamily: "var(--font-mono)" }}>{fmtTok(o.input_tokens)}</td>
                  <td style={{ padding: "10px 20px", fontSize: "12px", color: "var(--text-secondary)", textAlign: "right", fontFamily: "var(--font-mono)" }}>{fmtTok(o.output_tokens)}</td>
                  <td style={{ padding: "10px 20px", fontSize: "12px", color: "var(--text-secondary)", textAlign: "right", fontFamily: "var(--font-mono)" }}>{fmtTok(o.input_tokens + o.output_tokens)}</td>
                  <td style={{ padding: "10px 20px", fontSize: "12px", fontWeight: 600, color: "var(--accent)", textAlign: "right" }}>{fmtCost(o.cost_usd)}</td>
                  <td style={{ padding: "10px 20px", fontSize: "12px", color: "var(--text-muted)", textAlign: "right" }}>{fmtCost(o.runs > 0 ? o.cost_usd / o.runs : 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Governance tab ───────────────────────────────────────────────────────────

function GovernanceDashboard() {
  // ── Recommendations state ───────────────────────────────────────────────
  const [recOrchId,  setRecOrchId]  = useState("");
  const [recResult,  setRecResult]  = useState<any>(null);
  const [recLoading, setRecLoading] = useState<"fast"|"deep"|null>(null);
  const [recError,   setRecError]   = useState("");

  // ── Audit filter state ──────────────────────────────────────────────────
  const [auditQ,      setAuditQ]      = useState("");
  const [auditOrch,   setAuditOrch]   = useState("");
  const [auditStatus, setAuditStatus] = useState("");

  // ── Queries ─────────────────────────────────────────────────────────────
  // Dedicated orchestrator query — NOT derived from budget data so the
  // dropdown is always populated regardless of budget query state.
  const { data: orchData } = useQuery({
    queryKey: ["orchestrators-gov"],
    queryFn:  () => orchestratorsApi.list().then(r => r.data),
  });
  const orchList: {id: string; name: string}[] = (orchData || []).map((o: any) => ({
    id:   o.orchestrator_agent_id,
    name: o.name,
  }));

  const { data: budgetData, isLoading: budgetLoading, refetch: refetchBudget } = useQuery({
    queryKey: ["governance-budget"],
    queryFn: () => api.get("/api/executions/governance/budget-alerts").then(r => r.data),
    refetchInterval:      false,
    refetchOnWindowFocus: false,
    staleTime:            Infinity,
  });

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ["governance-audit", auditQ, auditOrch, auditStatus],
    queryFn: () => {
      const p = new URLSearchParams();
      if (auditQ)      p.set("q", auditQ);
      if (auditOrch)   p.set("orchestrator_id", auditOrch);
      if (auditStatus) p.set("status", auditStatus);
      p.set("limit", "50");
      return api.get(`/api/executions/governance/audit-log?${p}`).then(r => r.data);
    },
    refetchInterval: 30000,
  });

  const { data: roiData, isLoading: roiLoading, refetch: refetchRoi } = useQuery({
    queryKey: ["governance-roi"],
    queryFn: () => api.get("/api/executions/governance/roi-targets").then(r => r.data),
    refetchInterval:      false,
    refetchOnWindowFocus: false,
    staleTime:            Infinity,
  });

  const { data: anomalyGovData, isLoading: anomalyLoading, refetch: refetchAnomalies } = useQuery({
    queryKey: ["governance-anomalies"],
    queryFn: () => api.get("/api/executions/governance/anomalies").then(r => r.data),
    refetchInterval:      false,
    refetchOnWindowFocus: false,
    staleTime:            Infinity,
  });

  const alerts     = budgetData?.alerts     || [];
  const records    = auditData?.records     || [];
  const roiRows    = roiData?.results       || [];
  const anomalyRows = anomalyGovData?.results || [];
  const anomalyCritCount = anomalyGovData?.critical_count || 0;
  const anomalyWarnCount  = anomalyGovData?.warning_count  || 0;

  // ── Helpers ─────────────────────────────────────────────────────────────
  const fmtCostG = (v: number) => v < 0.001 ? `$${v.toFixed(6)}` : `$${v.toFixed(4)}`;
  const fmtTimeG = (iso: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  };
  const statusDotG = (s: string) => {
    const color = s === "breach" ? "var(--status-failed)" : s === "warning" ? "var(--status-waiting)" : s === "ok" ? "var(--status-done)" : "var(--text-muted)";
    const label = s === "breach" ? "Breach" : s === "warning" ? "Warning" : s === "ok" ? "OK" : "No limit";
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: 500, color }}>
        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, flexShrink: 0 }} />
        {label}
      </span>
    );
  };
  const impactColor = (impact: string) =>
    impact === "high" ? "var(--status-failed)" : impact === "medium" ? "var(--status-waiting)" : "var(--text-muted)";

  // ── Recommendations trigger ──────────────────────────────────────────────
  async function runAnalysis(depth: "fast" | "deep") {
    if (!recOrchId) return;
    setRecLoading(depth);
    setRecError("");
    setRecResult(null);
    try {
      const res = await api.get(
        `/api/executions/governance/recommendations/${recOrchId}?depth=${depth}`
      );
      setRecResult(res.data);
    } catch (e: any) {
      const msg = (e as any)?.response?.data?.detail || (e as any)?.message || "Analysis failed";
      setRecError(String(msg));
    } finally {
      setRecLoading(null);
    }
  }

  const orchOptions = orchList.map(o => [o.id, o.name] as [string, string]);

  return (
    <div style={{ padding: "28px 32px", maxWidth: "1100px" }}>
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Governance</h2>
        <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "3px" }}>
          Budget controls, prompt audit trail, ROI tracking, and AI cost recommendations
        </p>
      </div>

      {/* ── Section 1: AI Recommendations (top panel) ── */}
      <div style={{
        background: "var(--bg-surface)", border: "1px solid var(--border)",
        borderRadius: "var(--border-radius-lg, 12px)", padding: "20px 24px", marginBottom: "16px",
      }}>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
          Agent cost recommendations
        </div>
        <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "16px", marginTop: "2px" }}>
          Select an orchestrator then run an AI analysis to get specific cost-reduction advice.
          Quick analysis uses Nova Pro (~3 s). Deep analysis uses Claude Sonnet for prompt rewrites (~8 s).
          Configure models in Settings → AI recommendations.
        </p>

        {/* Selector + buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
          <select
            value={recOrchId}
            onChange={e => { setRecOrchId(e.target.value); setRecResult(null); setRecError(""); }}
            style={{
              padding: "8px 12px", fontSize: "13px", minWidth: "280px",
              background: "var(--bg-overlay)", border: "1px solid var(--border-hover)",
              borderRadius: "8px", color: recOrchId ? "var(--text-primary)" : "var(--text-muted)",
              fontFamily: "var(--font)", outline: "none", cursor: "pointer",
            }}
          >
            <option value="">— Select orchestrator to analyse —</option>
            {orchList.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>

          <button
            onClick={() => runAnalysis("fast")}
            disabled={!recOrchId || recLoading !== null}
            style={{
              padding: "8px 16px", fontSize: "13px", fontWeight: 600, borderRadius: "8px",
              border: "none", fontFamily: "var(--font)", transition: "all 0.15s",
              cursor: recOrchId && !recLoading ? "pointer" : "not-allowed",
              background: recOrchId && !recLoading ? "var(--accent)" : "var(--bg-overlay)",
              color:      recOrchId && !recLoading ? "#0A0B0F"       : "var(--text-muted)",
            }}
          >
            {recLoading === "fast" ? "Analysing…" : "Quick analysis ↗"}
          </button>

          <button
            onClick={() => runAnalysis("deep")}
            disabled={!recOrchId || recLoading !== null}
            style={{
              padding: "8px 16px", fontSize: "13px", borderRadius: "8px",
              border: "1px solid var(--border-hover)", fontFamily: "var(--font)", transition: "all 0.15s",
              cursor: recOrchId && !recLoading ? "pointer" : "not-allowed",
              background: "transparent",
              color: recOrchId && !recLoading ? "var(--text-primary)" : "var(--text-muted)",
            }}
          >
            {recLoading === "deep" ? "Analysing…" : "Deep analysis ↗"}
          </button>

          {recResult && (
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              {recResult.model_used?.split("/").pop()?.split(":")[0] || recResult.model_used} · {recResult.elapsed_s}s
            </span>
          )}
        </div>

        {/* Error */}
        {recError && (
          <div style={{ padding: "10px 14px", borderRadius: "8px", marginBottom: "12px", fontSize: "12px", color: "var(--status-failed)", background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.2)" }}>
            {recError}
          </div>
        )}

        {/* Loading */}
        {recLoading && (
          <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>
            Running {recLoading} analysis — this may take a few seconds…
          </div>
        )}

        {/* Results */}
        {recResult && !recLoading && (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
            <div style={{
              padding: "12px 16px", borderRadius: "8px", marginBottom: "16px",
              background: "var(--accent-dim)", border: "1px solid rgba(0,200,150,0.2)",
              fontSize: "13px", fontWeight: 500, color: "var(--text-primary)",
            }}>
              {recResult.verdict}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "16px" }}>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>Root causes</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {(recResult.root_causes || []).map((c: string, i: number) => (
                    <div key={i} style={{ display: "flex", gap: "8px", fontSize: "12px", color: "var(--text-secondary)" }}>
                      <span style={{ color: "var(--status-waiting)", flexShrink: 0 }}>•</span>
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
                {recResult.estimated_saving && (
                  <div style={{ marginTop: "12px", fontSize: "12px", fontWeight: 600, color: "var(--status-done)" }}>
                    {recResult.estimated_saving}
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>Recommendations</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {(recResult.recommendations || []).map((r: any, i: number) => (
                    <div key={i} style={{ padding: "10px 12px", borderRadius: "8px", background: "var(--bg-overlay)", border: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span style={{
                          fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px",
                          color: impactColor(r.impact),
                          background: r.impact === "high" ? "rgba(255,80,80,0.1)" : r.impact === "medium" ? "rgba(255,181,71,0.12)" : "rgba(128,128,128,0.1)",
                          padding: "2px 7px", borderRadius: "4px",
                        }}>{r.impact}</span>
                        <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary)" }}>{r.issue}</span>
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.5", whiteSpace: "pre-wrap" }}>{r.fix}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {recResult.depth === "fast" && (
              <div style={{ marginTop: "14px", display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Want specific prompt rewrites?</span>
                <button
                  onClick={() => runAnalysis("deep")}
                  style={{ padding: "5px 14px", fontSize: "12px", borderRadius: "6px", cursor: "pointer", background: "transparent", border: "1px solid var(--border-hover)", color: "var(--text-secondary)", fontFamily: "var(--font)" }}
                >
                  Run deep analysis →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!recOrchId && !recResult && !recLoading && (
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Select an orchestrator above to begin.
          </div>
        )}
      </div>

      {/* ── Section 2: Budget alerts ── */}
      <div style={{
        background: "var(--bg-surface)", border: "1px solid var(--border)",
        borderRadius: "var(--border-radius-lg, 12px)", overflow: "hidden", marginBottom: "16px",
      }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>Cost budget alerts</span>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", marginLeft: "8px" }}>Set budgets via Orchestrators → Edit</span>
          </div>
          {alerts.filter((a: any) => a.daily_status === "breach" || a.monthly_status === "breach").length > 0 && (
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--status-failed)", background: "rgba(255,80,80,0.1)", padding: "2px 10px", borderRadius: "10px" }}>
              {alerts.filter((a: any) => a.daily_status === "breach" || a.monthly_status === "breach").length} breach
            </span>
          )}
        </div>
        {budgetLoading ? (
          <div style={{ padding: "20px", color: "var(--text-muted)", fontSize: "12px" }}>Loading…</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Orchestrator","Daily budget","Spent today","Daily status","Monthly budget","Spent this month","Monthly status"].map((h, i) => (
                  <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: "8px 16px", fontSize: "11px", color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alerts.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>No orchestrators found. Create one to start tracking budgets.</td></tr>
              ) : alerts.map((a: any, i: number) => (
                <tr key={a.orchestrator_id} style={{ borderBottom: i < alerts.length - 1 ? "1px solid var(--border)" : "none", background: (a.daily_status === "breach" || a.monthly_status === "breach") ? "rgba(255,80,80,0.04)" : "transparent" }}>
                  <td style={{ padding: "10px 16px", fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>{a.name}</td>
                  <td style={{ padding: "10px 16px", fontSize: "12px", color: "var(--text-secondary)", textAlign: "right" }}>{a.budget_daily_usd > 0 ? fmtCostG(a.budget_daily_usd) : <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                  <td style={{ padding: "10px 16px", fontSize: "12px", textAlign: "right", color: a.daily_status === "breach" ? "var(--status-failed)" : a.daily_status === "warning" ? "var(--status-waiting)" : "var(--text-secondary)" }}>
                    {fmtCostG(a.spent_today_usd)}{a.daily_pct != null && <span style={{ color: "var(--text-muted)", marginLeft: "4px", fontSize: "11px" }}>({a.daily_pct}%)</span>}
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "right" }}>{statusDotG(a.daily_status)}</td>
                  <td style={{ padding: "10px 16px", fontSize: "12px", color: "var(--text-secondary)", textAlign: "right" }}>{a.budget_monthly_usd > 0 ? fmtCostG(a.budget_monthly_usd) : <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                  <td style={{ padding: "10px 16px", fontSize: "12px", textAlign: "right", color: a.monthly_status === "breach" ? "var(--status-failed)" : a.monthly_status === "warning" ? "var(--status-waiting)" : "var(--text-secondary)" }}>
                    {fmtCostG(a.spent_month_usd)}{a.monthly_pct != null && <span style={{ color: "var(--text-muted)", marginLeft: "4px", fontSize: "11px" }}>({a.monthly_pct}%)</span>}
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "right" }}>{statusDotG(a.monthly_status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Section 2b: Cost anomalies ── */}
      <div style={{
        background: "var(--bg-surface)", border: "1px solid var(--border)",
        borderRadius: "var(--border-radius-lg, 12px)", overflow: "hidden", marginBottom: "16px",
      }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>Cost anomalies</span>
            {anomalyCritCount > 0 && (
              <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--status-failed)", background: "rgba(255,80,80,0.1)", padding: "2px 8px", borderRadius: "10px" }}>
                {anomalyCritCount} critical
              </span>
            )}
            {anomalyWarnCount > 0 && (
              <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--status-waiting)", background: "rgba(255,181,71,0.1)", padding: "2px 8px", borderRadius: "10px" }}>
                {anomalyWarnCount} warning
              </span>
            )}
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Current 7-day avg vs prior 7-day avg</span>
          </div>
          <button
            onClick={() => refetchAnomalies()}
            disabled={anomalyLoading}
            style={{ fontSize: "12px", color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font)", opacity: anomalyLoading ? 0.5 : 1 }}
          >{anomalyLoading ? "Checking…" : "Refresh ↻"}</button>
        </div>
        {anomalyLoading ? (
          <div style={{ padding: "20px", color: "var(--text-muted)", fontSize: "12px" }}>Checking for anomalies…</div>
        ) : anomalyRows.length === 0 ? (
          <div style={{ padding: "20px", color: "var(--text-muted)", fontSize: "12px" }}>No execution data yet to analyse.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Orchestrator", "Severity", "Current avg/run", "Prior avg/run", "Trend", "Spike", "Runs (curr/prior)"].map((h, i) => (
                  <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: "8px 16px", fontSize: "11px", color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {anomalyRows.map((r: any, i: number) => {
                const sevColor = r.overall_severity === "critical" ? "var(--status-failed)"
                  : r.overall_severity === "warning" ? "var(--status-waiting)" : "var(--status-done)";
                const sevLabel = r.overall_severity === "critical" ? "Critical"
                  : r.overall_severity === "warning" ? "Warning" : "Normal";
                const sevBg = r.overall_severity === "critical" ? "rgba(255,80,80,0.1)"
                  : r.overall_severity === "warning" ? "rgba(255,181,71,0.1)" : "rgba(0,200,100,0.08)";
                const fmtC = (v: number | null) => v == null ? "—" : v < 0.001 ? `$${v.toFixed(6)}` : `$${v.toFixed(4)}`;
                return (
                  <tr key={r.orchestrator_id} style={{
                    borderBottom: i < anomalyRows.length - 1 ? "1px solid var(--border)" : "none",
                    background: r.overall_severity === "critical" ? "rgba(255,80,80,0.03)" : "transparent",
                  }}>
                    <td style={{ padding: "10px 16px", fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>{r.name}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right" }}>
                      <span style={{ fontSize: "11px", fontWeight: 600, color: sevColor, background: sevBg, padding: "2px 8px", borderRadius: "10px" }}>{sevLabel}</span>
                    </td>
                    <td style={{ padding: "10px 16px", fontSize: "12px", color: "var(--text-secondary)", textAlign: "right" }}>{fmtC(r.curr_avg_usd)}</td>
                    <td style={{ padding: "10px 16px", fontSize: "12px", color: "var(--text-secondary)", textAlign: "right" }}>{fmtC(r.prior_avg_usd)}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right" }}>
                      {r.trend_ratio != null ? (
                        <span style={{ fontSize: "12px", fontWeight: 600, color: r.trend_severity !== "normal" ? sevColor : "var(--status-done)" }}>
                          {r.trend_ratio}×
                        </span>
                      ) : <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>—</span>}
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "right" }}>
                      {r.spike_ratio != null ? (
                        <span style={{ fontSize: "12px", fontWeight: 600, color: r.spike_severity !== "normal" ? sevColor : "var(--text-secondary)" }}>
                          {r.spike_ratio}× single run
                        </span>
                      ) : <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>—</span>}
                    </td>
                    <td style={{ padding: "10px 16px", fontSize: "12px", color: "var(--text-muted)", textAlign: "right" }}>
                      {r.curr_runs} / {r.prior_runs}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Section 3: ROI targets ── */}
      <div style={{
        background: "var(--bg-surface)", border: "1px solid var(--border)",
        borderRadius: "var(--border-radius-lg, 12px)", overflow: "hidden", marginBottom: "16px",
      }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>ROI targets</span>
          <span style={{ fontSize: "12px", color: "var(--text-muted)", marginLeft: "8px" }}>Actual vs expected ROI per orchestrator</span>
        </div>
        {roiLoading ? (
          <div style={{ padding: "20px", color: "var(--text-muted)", fontSize: "12px" }}>Loading…</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Orchestrator","Target ROI","Actual ROI","AI cost","Txn value","Status"].map((h, i) => (
                  <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: "8px 16px", fontSize: "11px", color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roiRows.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>No data yet.</td></tr>
              ) : roiRows.map((r: any, i: number) => {
                const stColor = r.status === "under" ? "var(--status-failed)" : r.status === "close" ? "var(--status-waiting)" : r.status === "on_target" ? "var(--status-done)" : "var(--text-muted)";
                const stLabel = r.status === "under" ? "Under target" : r.status === "close" ? "Close" : r.status === "on_target" ? "On target" : "No target";
                const fmtINR  = (v: number) => v >= 100000 ? `₹${(v/100000).toFixed(1)}L` : v >= 1000 ? `₹${(v/1000).toFixed(1)}K` : `₹${v.toFixed(0)}`;
                return (
                  <tr key={r.orchestrator_id} style={{ borderBottom: i < roiRows.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <td style={{ padding: "10px 16px", fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>{r.name}</td>
                    <td style={{ padding: "10px 16px", fontSize: "12px", color: "var(--text-secondary)", textAlign: "right" }}>{r.roi_target > 0 ? `${r.roi_target}×` : <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                    <td style={{ padding: "10px 16px", fontSize: "12px", fontWeight: 600, color: r.actual_roi > 0 ? "var(--status-done)" : "var(--text-muted)", textAlign: "right" }}>{r.actual_roi > 0 ? `${r.actual_roi}×` : "—"}</td>
                    <td style={{ padding: "10px 16px", fontSize: "12px", color: "var(--text-secondary)", textAlign: "right" }}>{fmtCostG(r.ai_cost_usd)}</td>
                    <td style={{ padding: "10px 16px", fontSize: "12px", color: "var(--text-secondary)", textAlign: "right" }}>{r.txn_value > 0 ? fmtINR(r.txn_value) : "—"}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right" }}>
                      <span style={{ fontSize: "11px", fontWeight: 500, color: stColor, padding: "2px 8px", borderRadius: "10px" }}>{stLabel}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Section 4: Prompt audit log ── */}
      <div style={{
        background: "var(--bg-surface)", border: "1px solid var(--border)",
        borderRadius: "var(--border-radius-lg, 12px)", overflow: "hidden",
      }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginRight: "4px" }}>Prompt audit log</span>
          <input
            value={auditQ} onChange={e => setAuditQ(e.target.value)} placeholder="Search prompts…"
            style={{ padding: "5px 10px", fontSize: "12px", background: "var(--bg-overlay)", border: "1px solid var(--border-hover)", borderRadius: "6px", color: "var(--text-primary)", fontFamily: "var(--font)", outline: "none", width: "200px" }}
          />
          <select value={auditOrch} onChange={e => setAuditOrch(e.target.value)}
            style={{ padding: "5px 10px", fontSize: "12px", background: "var(--bg-overlay)", border: "1px solid var(--border-hover)", borderRadius: "6px", color: auditOrch ? "var(--text-primary)" : "var(--text-muted)", fontFamily: "var(--font)", outline: "none", cursor: "pointer" }}>
            <option value="">All orchestrators</option>
            {orchOptions.map(([id, name]: any) => <option key={id} value={id}>{name}</option>)}
          </select>
          <select value={auditStatus} onChange={e => setAuditStatus(e.target.value)}
            style={{ padding: "5px 10px", fontSize: "12px", background: "var(--bg-overlay)", border: "1px solid var(--border-hover)", borderRadius: "6px", color: auditStatus ? "var(--text-primary)" : "var(--text-muted)", fontFamily: "var(--font)", outline: "none", cursor: "pointer" }}>
            <option value="">All statuses</option>
            {["COMPLETED","FAILED","CANCELLED","RUNNING","WAITING_FOR_HUMAN"].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <span style={{ marginLeft: "auto", fontSize: "12px", color: "var(--text-muted)" }}>{auditData?.total ?? 0} records</span>
        </div>
        {auditLoading ? (
          <div style={{ padding: "20px", color: "var(--text-muted)", fontSize: "12px" }}>Loading…</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Prompt","Orchestrator","Started","Status","Cost","Tokens"].map((h, i) => (
                  <th key={h} style={{ textAlign: i < 2 ? "left" : "right", padding: "8px 16px", fontSize: "11px", color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>
                  {auditQ || auditOrch || auditStatus ? "No records match the filter." : "No executions recorded yet."}
                </td></tr>
              ) : records.map((r: any, i: number) => {
                const stColor = r.status === "COMPLETED" ? "var(--status-done)" : r.status === "FAILED" ? "var(--status-failed)" : r.status === "RUNNING" ? "var(--status-running)" : r.status === "WAITING_FOR_HUMAN" ? "var(--status-waiting)" : "var(--text-muted)";
                return (
                  <tr key={r.session_id} style={{ borderBottom: i < records.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <td style={{ padding: "10px 16px", fontSize: "12px", color: "var(--text-primary)", maxWidth: "320px" }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.prompt}>{r.prompt || <span style={{ color: "var(--text-muted)" }}>—</span>}</div>
                    </td>
                    <td style={{ padding: "10px 16px", fontSize: "12px", color: "var(--text-secondary)" }}>{r.orchestrator_name}</td>
                    <td style={{ padding: "10px 16px", fontSize: "12px", color: "var(--text-secondary)", textAlign: "right", whiteSpace: "nowrap" }}>{fmtTimeG(r.start_time)}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right" }}>
                      <span style={{ fontSize: "11px", fontWeight: 500, color: stColor }}>{r.status}</span>
                    </td>
                    <td style={{ padding: "10px 16px", fontSize: "12px", fontWeight: 600, color: "var(--accent)", textAlign: "right" }}>{r.cost_usd > 0 ? fmtCostG(r.cost_usd) : "—"}</td>
                    <td style={{ padding: "10px 16px", fontSize: "12px", color: "var(--text-muted)", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                      {(r.input_tokens + r.output_tokens) > 0 ? `${((r.input_tokens + r.output_tokens)/1000).toFixed(1)}K` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Agent Performance tab (operator view) ────────────────────────────────────

type APPeriod = 1 | 7 | 30;

function healthColor(h: string): string {
  return h === "healthy"  ? "var(--status-done)"
       : h === "warning"  ? "var(--status-waiting)"
       : h === "critical" ? "var(--status-failed)"
       : "var(--text-muted)";
}

function AgentPerformanceDashboard() {
  const [period, setPeriod] = useState<APPeriod>(7);

  const { data, isLoading } = useQuery({
    queryKey: ["agent-performance", period],
    queryFn: () => executionsApi.agentPerformance(period).then(r => r.data),
    refetchInterval: 30000,
  });

  const fmtSec = (s: number | null) =>
    s == null ? "—" : s >= 60 ? `${(s / 60).toFixed(1)}m` : `${s.toFixed(1)}s`;

  return (
    <div style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header + period selector */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: "18px", fontWeight: 600, color: "var(--text-primary)" }}>
            Agent Performance
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
            Reliability and tool health across your AI workforce
          </div>
        </div>
        <div style={{ display: "flex", gap: "4px", background: "var(--bg-surface)", padding: "3px", borderRadius: "8px", border: "1px solid var(--border)" }}>
          {([1, 7, 30] as APPeriod[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{
                padding: "5px 12px", fontSize: "12px", borderRadius: "6px", border: "none", cursor: "pointer",
                fontFamily: "var(--font)", fontWeight: period === p ? 600 : 400,
                background: period === p ? "var(--accent-dim)" : "transparent",
                color: period === p ? "var(--accent)" : "var(--text-secondary)",
              }}>
              {p === 1 ? "24h" : `${p}d`}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
          Loading agent performance…
        </div>
      ) : !data ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
          No data available for this period.
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
            <MetricCard
              label="Run success rate"
              value={data.run_success_rate != null ? `${data.run_success_rate}%` : "—"}
              sub={`${data.runs_completed}/${data.runs_parsed} runs`}
              accent
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
            />
            <MetricCard
              label="Tool success rate"
              value={data.overall_tool_success_rate != null ? `${data.overall_tool_success_rate}%` : "—"}
              sub={`${data.total_tool_calls} calls`}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>}
            />
            <MetricCard
              label="kwargs fallbacks"
              value={data.total_kwargs_fallbacks ?? 0}
              sub={data.total_kwargs_fallbacks > 0 ? "needs attention" : "clean"}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>}
            />
            <MetricCard
              label="Avg turnaround"
              value={fmtSec(data.avg_turnaround_sec)}
              sub={`median ${fmtSec(data.median_turnaround_sec)}`}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
            />
          </div>

          {/* Per-agent table */}
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
              Agents
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Agent", "Health", "Invocations", "Tool calls", "Failures", "kwargs", "Success"].map((h, i) => (
                    <th key={h} style={{ padding: "10px 16px", fontSize: "11px", fontWeight: 500, color: "var(--text-muted)", textAlign: i === 0 ? "left" : "right", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.agents.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>No agent activity in this period.</td></tr>
                ) : data.agents.map((a: any, i: number) => (
                  <tr key={a.agent} style={{ borderBottom: i < data.agents.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <td style={{ padding: "10px 16px", fontSize: "12px", color: "var(--text-primary)", fontWeight: 500 }}>{a.agent}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", color: healthColor(a.health) }}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: healthColor(a.health) }} />
                        {a.health}
                      </span>
                    </td>
                    <td style={{ padding: "10px 16px", fontSize: "12px", color: "var(--text-secondary)", textAlign: "right" }}>{a.invocations}</td>
                    <td style={{ padding: "10px 16px", fontSize: "12px", color: "var(--text-secondary)", textAlign: "right" }}>{a.tool_calls}</td>
                    <td style={{ padding: "10px 16px", fontSize: "12px", color: a.tool_failures > 0 ? "var(--status-failed)" : "var(--text-secondary)", textAlign: "right", fontWeight: a.tool_failures > 0 ? 600 : 400 }}>{a.tool_failures}</td>
                    <td style={{ padding: "10px 16px", fontSize: "12px", color: a.kwargs_fallbacks > 0 ? "var(--status-waiting)" : "var(--text-muted)", textAlign: "right" }}>{a.kwargs_fallbacks}</td>
                    <td style={{ padding: "10px 16px", fontSize: "12px", fontWeight: 600, color: "var(--accent)", textAlign: "right" }}>{a.success_rate != null ? `${a.success_rate}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Per-tool table */}
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
              Tools
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Tool", "Calls", "Failures", "kwargs", "Success"].map((h, i) => (
                    <th key={h} style={{ padding: "10px 16px", fontSize: "11px", fontWeight: 500, color: "var(--text-muted)", textAlign: i === 0 ? "left" : "right", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.tools.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>No tool activity in this period.</td></tr>
                ) : data.tools.map((t: any, i: number) => (
                  <tr key={t.tool} style={{ borderBottom: i < data.tools.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <td style={{ padding: "10px 16px", fontSize: "12px", color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{t.tool}</td>
                    <td style={{ padding: "10px 16px", fontSize: "12px", color: "var(--text-secondary)", textAlign: "right" }}>{t.calls}</td>
                    <td style={{ padding: "10px 16px", fontSize: "12px", color: t.failures > 0 ? "var(--status-failed)" : "var(--text-secondary)", textAlign: "right", fontWeight: t.failures > 0 ? 600 : 400 }}>{t.failures}</td>
                    <td style={{ padding: "10px 16px", fontSize: "12px", color: t.kwargs_fallbacks > 0 ? "var(--status-waiting)" : "var(--text-muted)", textAlign: "right" }}>{t.kwargs_fallbacks}</td>
                    <td style={{ padding: "10px 16px", fontSize: "12px", fontWeight: 600, color: "var(--accent)", textAlign: "right" }}>{t.success_rate != null ? `${t.success_rate}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Tab wrapper — default export ──────────────────────────────────────────────

export default function Dashboard() {
  const [tab, setTab] = useState<"overview" | "usage" | "agents" | "governance">("overview");

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 16px", fontSize: "13px", fontWeight: active ? 600 : 400,
    color: active ? "var(--text-primary)" : "var(--text-secondary)",
    background: "transparent", border: "none",
    borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
    cursor: "pointer", fontFamily: "var(--font)", transition: "color 0.15s",
    marginBottom: "-1px",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Tab bar */}
      <div style={{
        display: "flex", gap: "4px",
        borderBottom: "1px solid var(--border)",
        padding: "0 32px",
        background: "var(--bg-surface)",
      }}>
        <button style={tabStyle(tab === "overview")}    onClick={() => setTab("overview")}>Overview</button>
        <button style={tabStyle(tab === "usage")}       onClick={() => setTab("usage")}>Usage & cost</button>
        <button style={tabStyle(tab === "agents")}      onClick={() => setTab("agents")}>Agent performance</button>
        <button style={tabStyle(tab === "governance")} onClick={() => setTab("governance")}>Governance</button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {tab === "overview" ? <DashboardOverview /> : tab === "usage" ? <UsageDashboard /> : tab === "agents" ? <AgentPerformanceDashboard /> : <GovernanceDashboard />}
      </div>
    </div>
  );
}