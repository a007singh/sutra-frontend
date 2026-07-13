import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { executionsApi } from "../api/executions";
import type { ExecutionRecord } from "../api/executions";
import { api } from "../api/client";
import PageHeader from "../components/PageHeader";
import { globalToast } from "../hooks/useGlobalToast";
import { formatDateTime, formatDuration } from "../utils/dateTime";

const REPLAY_MODELS = [
  { id: "us.amazon.nova-pro-v1:0",                       label: "Nova Pro" },
  { id: "us.amazon.nova-lite-v1:0",                      label: "Nova Lite" },
  { id: "us.amazon.nova-micro-v1:0",                     label: "Nova Micro" },
  { id: "us.anthropic.claude-sonnet-4-5-20250929-v1:0",  label: "Claude Sonnet 4.5" },
  { id: "us.anthropic.claude-sonnet-4-6",                label: "Claude Sonnet 4.6" },
];
function mLabel(id: string) {
  return REPLAY_MODELS.find(m => m.id === id)?.label
    || id.split(":")[0].split(".").pop() || id;
}

type StatusVariant = "running" | "done" | "failed" | "waiting" | "cancelled" | "default";

function statusVariant(status: string): StatusVariant {
  switch (status?.toUpperCase()) {
    case "COMPLETED":            return "done";
    case "RUNNING":              return "running";
    case "FAILED":               return "failed";
    case "WAITING_FOR_HUMAN":    return "waiting";
    case "CANCELLED":            return "cancelled";
    default:                     return "default";
  }
}

const statusColors: Record<StatusVariant, { bg: string; color: string }> = {
  running:   { bg: "var(--status-running-dim)",  color: "var(--status-running)"  },
  done:      { bg: "var(--status-done-dim)",     color: "var(--status-done)"     },
  failed:    { bg: "var(--status-failed-dim)",   color: "var(--status-failed)"   },
  waiting:   { bg: "var(--status-waiting-dim)",  color: "var(--status-waiting)"  },
  cancelled: { bg: "rgba(255,255,255,0.06)",     color: "var(--text-muted)"      },
  default:   { bg: "rgba(255,255,255,0.06)",     color: "var(--text-muted)"      },
};

function StatusBadge({ status }: { status: string }) {
  const variant = statusVariant(status);
  const { bg, color } = statusColors[variant];
  const isRunning = variant === "running";
  const isWaiting = variant === "waiting";

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: "3px 9px", borderRadius: "20px",
      fontSize: "11px", fontWeight: 500,
      background: bg, color,
    }}>
      {(isRunning || isWaiting) && (
        <span style={{
          width: "5px", height: "5px", borderRadius: "50%",
          background: color,
          animation: "pulse 1.5s ease-in-out infinite",
        }} />
      )}
      {status || "UNKNOWN"}
    </span>
  );
}

function RunByBadge({ name }: { name?: string }) {
  if (!name) return <span style={{ color: "var(--text-muted)" }}>Unknown</span>;
  if (name.startsWith("Agent · ")) {
    const agentName = name.slice("Agent · ".length);
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
        <span style={{
          display: "inline-flex", alignItems: "center",
          padding: "2px 7px", borderRadius: "20px",
          fontSize: "10px", fontWeight: 600, letterSpacing: "0.3px",
          background: "rgba(0,200,150,0.12)", color: "var(--accent)",
          border: "1px solid rgba(0,200,150,0.2)",
        }}>
          Agent
        </span>
        <span>{agentName}</span>
      </span>
    );
  }
  return <span>{name}</span>;
}

function LogDrawer({
  record, onClose, onCancelled,
}: {
  record: ExecutionRecord;
  onClose: () => void;
  onCancelled: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["execution", record.session_id],
    queryFn: () => executionsApi.get(record.session_id).then(r => r.data),
  });

  const logs = data?.logs || [];
  const isActive = record.status === "RUNNING" || record.status === "WAITING_FOR_HUMAN";

  async function handleCancel() {
    try {
      await executionsApi.cancel(record.session_id);
      globalToast("Execution cancelled");
      onCancelled();
      onClose();
    } catch {
      globalToast("Failed to cancel execution", "error");
      onCancelled();
      onClose();
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      display: "flex", justifyContent: "flex-end",
    }} onClick={onClose}>
      <div style={{
        width: "560px", height: "100%",
        background: "var(--bg-elevated)",
        borderLeft: "1px solid var(--border-hover)",
        display: "flex", flexDirection: "column",
        animation: "slideIn 0.2s ease",
      }} onClick={e => e.stopPropagation()}>

        {/* Drawer header */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}>
          <div style={{
            display: "flex", alignItems: "center",
            justifyContent: "space-between", marginBottom: "12px",
          }}>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>
              Execution details
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {isActive && (
                <button onClick={handleCancel} style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "6px 14px", borderRadius: "8px",
                  background: "var(--status-failed-dim)",
                  border: "1px solid rgba(255,92,92,0.3)",
                  color: "var(--status-failed)", fontSize: "12px", fontWeight: 500,
                  cursor: "pointer", fontFamily: "var(--font)",
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                  Cancel execution
                </button>
              )}
              <button onClick={onClose} style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--text-muted)", fontSize: "20px", lineHeight: 1,
                padding: "2px 6px",
              }}>×</button>
            </div>
          </div>

          {(record as any).prompt && (
            <div style={{
              background: "var(--bg-overlay)", borderRadius: "8px",
              padding: "8px 12px", marginBottom: "10px",
            }}>
              <div style={{
                fontSize: "10px", color: "var(--text-muted)", marginBottom: "4px",
                textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600,
              }}>
                User prompt
              </div>
              <div style={{
                fontSize: "13px", color: "var(--text-primary)", lineHeight: "1.6",
                fontStyle: "italic",
              }}>
                "{(record as any).prompt}"
              </div>
            </div>
          )}

          {/* Meta grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {[
              { label: "Session ID",   value: record.session_id.slice(0, 18) + "...", mono: true },
              { label: "Status",       value: <StatusBadge status={record.status} />, mono: false },
              { label: "Run by", value: <RunByBadge name={(record as any).orchestrator_name} />, mono: false },
              { label: "Started",      value: record.start_time ? formatDateTime(record.start_time) : "—", mono: false },
              { label: "Ended",        value: record.end_time   ? formatDateTime(record.end_time)   : "—", mono: false },
              {
                label: "Duration",
                value: record.start_time && record.end_time
                  ? formatDuration(record.start_time, record.end_time) : "—",
                mono: true,
              },
            ].map(({ label, value, mono }) => (
              <div key={label} style={{
                background: "var(--bg-overlay)",
                borderRadius: "8px", padding: "8px 12px",
              }}>
                <div style={{
                  fontSize: "10px", color: "var(--text-muted)", marginBottom: "3px",
                  textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600,
                }}>
                  {label}
                </div>
                <div style={{
                  fontSize: "12px", color: "var(--text-primary)",
                  fontFamily: mono ? "var(--font-mono)" : "var(--font)",
                }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* Token usage row */}
          {record.total_tokens ? (
            <div style={{
              display: "flex", alignItems: "center", gap: "16px",
              marginTop: "10px", padding: "8px 12px",
              background: "var(--accent-dim)", borderRadius: "8px",
            }}>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                <span style={{ color: "var(--text-muted)" }}>in </span>
                {(record.input_tokens || 0).toLocaleString()}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                <span style={{ color: "var(--text-muted)" }}>out </span>
                {(record.output_tokens || 0).toLocaleString()}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                <span style={{ color: "var(--text-muted)" }}>total </span>
                {(record.total_tokens || 0).toLocaleString()}
              </div>
              <div style={{
                marginLeft: "auto", fontSize: "12px",
                fontWeight: 600, color: "var(--accent)",
              }}>
                ${parseFloat(record.cost_usd || "0").toFixed(4)}
              </div>
            </div>
          ) : null}
        </div>

        {/* Log panel */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{
            padding: "10px 24px 8px",
            borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", gap: "8px",
            flexShrink: 0,
          }}>
            <div style={{
              width: "6px", height: "6px", borderRadius: "50%",
              background: "var(--text-muted)",
            }} />
            <span style={{
              fontSize: "11px", color: "var(--text-muted)",
              fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase",
            }}>
              Execution trace
            </span>
            <span style={{ marginLeft: "auto", fontSize: "11px", color: "var(--text-muted)" }}>
              {logs.length} lines
            </span>

            {/* Export button */}
            <button
              onClick={() => {
                const blob = new Blob([logs.join("\n")], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `execution-${record.session_id.slice(0, 8)}.txt`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              style={{
                display: "flex", alignItems: "center", gap: "5px",
                padding: "4px 10px", borderRadius: "6px", fontSize: "11px",
                background: "transparent", border: "1px solid var(--border-hover)",
                color: "var(--text-secondary)", cursor: "pointer",
                fontFamily: "var(--font)",
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export
            </button>
          </div>

          <div style={{
            flex: 1, overflowY: "auto",
            padding: "12px 24px",
            fontFamily: "var(--font-mono)",
          }}>
            {isLoading ? (
              <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                Loading logs...
              </div>
            ) : logs.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                No logs found for this session.
              </div>
            ) : logs.map((line, i) => {
              const isError = line.includes("❌") || line.includes("ERROR");
              const isDone  = line.includes("✅");
              const isTool  = line.includes("🔨") || line.includes("📦") || line.includes("🚀");
              const isAgent = line.includes("🤖");
              const isHitl  = line.includes("✋");
              const color = isError ? "var(--status-failed)"
                : isDone   ? "var(--status-done)"
                : isTool   ? "var(--status-waiting)"
                : isAgent  ? "var(--status-running)"
                : isHitl   ? "var(--status-waiting)"
                : "var(--text-secondary)";

              return (
                <div key={i} style={{
                  display: "flex", gap: "12px",
                  padding: "3px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.02)",
                }}>
                  <span style={{
                    fontSize: "10px", color: "var(--text-muted)",
                    flexShrink: 0, minWidth: "28px", paddingTop: "2px",
                  }}>
                    {i + 1}
                  </span>
                  <span style={{
                    fontSize: "12px", color, lineHeight: "1.6",
                    wordBreak: "break-all",
                  }}>
                    {line}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

interface Props {
  initialFilter?: string;
}

export default function ExecutionHistory({ initialFilter = "ALL" }: Props) {
  const [selected,     setSelected]     = useState<ExecutionRecord | null>(null);
  const [statusFilter, setStatusFilter] = useState(initialFilter);
  const [replayRec,    setReplayRec]    = useState<ExecutionRecord | null>(null);
  const [replayOption, setReplayOption] = useState<"same"|"model"|"prompt">("same");
  const [replayModel,  setReplayModel]  = useState("");
  const [replayLoading,setReplayLoading]= useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["execution-history"],
    queryFn: () => executionsApi.history().then(r => r.data),
    // refetchInterval: 5000,
  });

  const filtered = data?.filter(e =>
    statusFilter === "ALL" || e.status === statusFilter
  ) || [];

  const statuses = [
    "ALL", "COMPLETED", "RUNNING", "WAITING_FOR_HUMAN", "FAILED", "CANCELLED",
  ];

  async function handleCancelRow(e: ExecutionRecord) {
    try {
      await executionsApi.cancel(e.session_id);
      globalToast("Execution cancelled");
    } catch {
      globalToast("Failed to cancel execution", "error");
    }
    refetch();
  }

  return (
    <div style={{ padding: "28px 32px" }}>
      <PageHeader
        title="Execution history"
        subtitle="All past and active workflow runs"
      />

      {/* Filter + refresh bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: "8px",
        marginBottom: "16px", flexWrap: "wrap",
      }}>
        {statuses.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} style={{
            padding: "5px 12px", borderRadius: "20px", fontSize: "12px",
            border: "1px solid",
            borderColor: statusFilter === s ? "var(--accent)" : "var(--border-hover)",
            background: statusFilter === s ? "var(--accent-dim)" : "transparent",
            color: statusFilter === s ? "var(--accent)" : "var(--text-secondary)",
            cursor: "pointer", fontFamily: "var(--font)", transition: "all 0.15s",
          }}>
            {s === "ALL" ? `All (${data?.length || 0})` : s}
          </button>
        ))}

        <button onClick={() => refetch()} style={{
          marginLeft: "auto",
          display: "flex", alignItems: "center", gap: "6px",
          padding: "5px 12px", borderRadius: "8px", fontSize: "12px",
          background: isFetching ? "var(--accent-dim)" : "transparent",
          border: `1px solid ${isFetching ? "rgba(0,200,150,0.3)" : "var(--border-hover)"}`,
          color: isFetching ? "var(--accent)" : "var(--text-secondary)",
          cursor: "pointer", fontFamily: "var(--font)", transition: "all 0.2s",
        }}>
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2"
            style={{ animation: isFetching ? "spin 0.8s linear infinite" : "none" }}
          >
            <polyline points="1 4 1 10 7 10"/>
            <path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
          </svg>
          {isFetching ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Table */}
      <div style={{
        background: "var(--bg-surface)", border: "1px solid var(--border)",
        borderRadius: "12px", overflow: "hidden",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Run by", "Status", "Started", "Duration", "Tokens", "Cost", ""].map(h => (
                <th key={h} style={{
                  textAlign: "left", padding: "10px 16px",
                  fontSize: "11px", color: "var(--text-muted)",
                  fontWeight: 600, letterSpacing: "0.6px", textTransform: "uppercase",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} style={{
                  padding: "40px 16px", textAlign: "center",
                  color: "var(--text-muted)", fontSize: "13px",
                }}>
                  Loading...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{
                  padding: "40px 16px", textAlign: "center",
                  color: "var(--text-muted)", fontSize: "13px",
                }}>
                  No executions found
                </td>
              </tr>
            ) : filtered.map((e, i) => {
              const isActive = e.status === "RUNNING" || e.status === "WAITING_FOR_HUMAN";
              return (
                <tr
                  key={e.session_id}
                  style={{
                    borderBottom: i < filtered.length - 1
                      ? "1px solid var(--border)" : "none",
                    cursor: "pointer", transition: "background 0.1s",
                  }}
                  onMouseEnter={el =>
                    (el.currentTarget as HTMLTableRowElement).style.background =
                      "rgba(255,255,255,0.02)"
                  }
                  onMouseLeave={el =>
                    (el.currentTarget as HTMLTableRowElement).style.background = "transparent"
                  }
                  onClick={() => setSelected(e)}
                >
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{
                      fontWeight: 500, color: "var(--text-primary)", fontSize: "13px",
                    }}>
                      <RunByBadge name={(e as any).orchestrator_name} />
                    </div>
                    <div style={{
                      fontSize: "11px", color: "var(--text-muted)",
                      fontFamily: "var(--font-mono)", marginTop: "2px",
                    }}>
                      {e.session_id.slice(0, 12)}...
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <StatusBadge status={e.status} />
                  </td>
                  <td style={{
                    padding: "12px 16px", fontSize: "12px",
                    color: "var(--text-secondary)", whiteSpace: "nowrap",
                  }}>
                    {e.start_time ? formatDateTime(e.start_time) : "—"}
                  </td>
                  <td style={{
                    padding: "12px 16px", fontSize: "12px",
                    color: "var(--text-secondary)", fontFamily: "var(--font-mono)",
                  }}>
                    {formatDuration(e.start_time, e.end_time)}
                  </td>
                  <td style={{
                    padding: "12px 16px", fontSize: "12px",
                    color: "var(--text-secondary)", fontFamily: "var(--font-mono)",
                  }}>
                    {e.total_tokens ? e.total_tokens.toLocaleString() : "—"}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {e.cost_usd ? (
                      <span style={{
                        fontSize: "12px", fontWeight: 600, color: "var(--accent)",
                      }}>
                        ${parseFloat(e.cost_usd).toFixed(4)}
                      </span>
                    ) : (
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <button
                        onClick={ev => { ev.stopPropagation(); setSelected(e); }}
                        style={{
                          padding: "5px 12px", borderRadius: "6px", fontSize: "12px",
                          background: "transparent", border: "1px solid var(--border-hover)",
                          color: "var(--text-secondary)", cursor: "pointer",
                          fontFamily: "var(--font)",
                        }}
                      >
                        View
                      </button>
                      {!isActive && (
                        <button
                          onClick={ev => {
                            ev.stopPropagation();
                            setReplayRec(e);
                            setReplayOption("same");
                            setReplayModel("");
                          }}
                          style={{
                            padding: "5px 10px", borderRadius: "6px", fontSize: "12px",
                            background: "var(--accent-dim)", border: "1px solid rgba(0,200,150,0.2)",
                            color: "var(--accent)", cursor: "pointer", fontFamily: "var(--font)",
                            display: "flex", alignItems: "center", gap: "4px",
                          }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="1 4 1 10 7 10"/>
                            <path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
                          </svg>
                          Replay
                        </button>
                      )}
                      {isActive && (
                        <button
                          onClick={ev => { ev.stopPropagation(); handleCancelRow(e); }}
                          style={{
                            padding: "5px 10px", borderRadius: "6px", fontSize: "12px",
                            background: "var(--status-failed-dim)",
                            border: "1px solid rgba(255,92,92,0.3)",
                            color: "var(--status-failed)", cursor: "pointer",
                            fontFamily: "var(--font)",
                            display: "flex", alignItems: "center", gap: "4px",
                          }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="15" y1="9" x2="9" y2="15"/>
                            <line x1="9" y1="9" x2="15" y2="15"/>
                          </svg>
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Replay modal ── */}
      {replayRec && (() => {
        const orchName = (replayRec as any).orchestrator_name || "Unknown";
        const cost     = parseFloat(replayRec.cost_usd || "0");
        const canStart = replayOption !== "model" || !!replayModel;

        async function fireReplay() {
          setReplayLoading(true);
          try {
            // Fetch all turns for this conversation
            const convId = (replayRec as any).conversation_id || replayRec.session_id;
            const orchId = (replayRec as any).orchestrator_id || "";
            const runsRes = await api.get<any[]>(`/api/executions/conversations/${convId}/runs`);
            const runs = runsRes.data || [];
            const prompts = runs
              .filter((r: any) => r.prompt)
              .map((r: any) => r.prompt as string);

            // If no multi-turn data fall back to the single prompt on the record
            if (prompts.length === 0 && (replayRec as any).prompt) {
              prompts.push((replayRec as any).prompt);
            }

            window.dispatchEvent(new CustomEvent("navigate", {
              detail: {
                page:                "replay",
                replayConvId:        convId,
                replayOrchId:        orchId,
                replayOrchName:      orchName,
                replayModelOverride: replayOption === "model" ? replayModel : null,
                replayPrompts:       prompts,
                replayCost:          cost,
                replayModel:         "",   // not stored on session — label shown from orchName
              },
            }));
            setReplayRec(null);
          } catch {
            globalToast("Could not load conversation turns for replay", "error");
          } finally {
            setReplayLoading(false);
          }
        }

        return (
          <div
            style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={e => { if (e.target === e.currentTarget) setReplayRec(null); }}
          >
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--border-radius-lg, 12px)", padding: "24px 28px", width: "480px", maxWidth: "92vw" }}>
              <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>Replay conversation</div>
              <div style={{ height: "0.5px", background: "var(--border)", margin: "10px 0 14px" }} />

              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>
                  <strong style={{ color: "var(--text-primary)" }}>Original:</strong>{" "}
                  "{((replayRec as any).prompt || "").length > 70
                    ? ((replayRec as any).prompt || "").slice(0, 70) + "…"
                    : (replayRec as any).prompt || "—"}"
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  {orchName} · ${cost.toFixed(4)} · {formatDateTime(replayRec.start_time || "")}
                </div>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "10px" }}>Replay options</div>
                {(["same", "model", "prompt"] as const).map(opt => (
                  <label key={opt} style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "8px 12px", borderRadius: "8px", cursor: "pointer", marginBottom: "6px",
                    background: replayOption === opt ? "var(--accent-dim)" : "transparent",
                    border: `1px solid ${replayOption === opt ? "rgba(0,200,150,0.2)" : "transparent"}`,
                  }}>
                    <input type="radio" name="hropt" value={opt} checked={replayOption === opt} onChange={() => setReplayOption(opt)} style={{ accentColor: "var(--accent)", flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>
                        {opt === "same"   && "Same settings"}
                        {opt === "model"  && "Different model"}
                        {opt === "prompt" && "Edited prompt"}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                        {opt === "same"   && "Exact replay with original settings"}
                        {opt === "model"  && "Override the model for this replay only"}
                        {opt === "prompt" && "Uses current orchestrator system prompt"}
                      </div>
                    </div>
                    {opt === "model" && replayOption === "model" && (
                      <select
                        value={replayModel}
                        onChange={e => { e.stopPropagation(); setReplayModel(e.target.value); }}
                        onClick={e => e.stopPropagation()}
                        style={{ padding: "5px 8px", fontSize: "12px", background: "var(--bg-overlay)", border: "1px solid var(--border-hover)", borderRadius: "6px", color: "var(--text-primary)", fontFamily: "var(--font)", outline: "none", cursor: "pointer" }}
                      >
                        <option value="">Select model…</option>
                        {REPLAY_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                      </select>
                    )}
                  </label>
                ))}
              </div>

              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <button onClick={() => setReplayRec(null)} style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "13px", background: "transparent", border: "1px solid var(--border-hover)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)" }}>
                  Cancel
                </button>
                <button onClick={fireReplay} disabled={!canStart || replayLoading} style={{ padding: "8px 20px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, fontFamily: "var(--font)", border: "none", cursor: (canStart && !replayLoading) ? "pointer" : "not-allowed", background: (canStart && !replayLoading) ? "var(--accent)" : "var(--bg-overlay)", color: (canStart && !replayLoading) ? "#0A0B0F" : "var(--text-muted)" }}>
                  {replayLoading ? "Loading…" : "Start replay ↺"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Log drawer */}
      {selected && (
        <LogDrawer
          record={selected}
          onClose={() => setSelected(null)}
          onCancelled={() => { setSelected(null); refetch(); }}
        />
      )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}