import { useQuery } from "@tanstack/react-query";
import { approvalQueueApi } from "../api/approvalQueue";
import type { QueueItem } from "../api/approvalQueue";
import { formatDate } from "../utils/dateTime";

/**
 * ApprovalQueue — Phase 2.5b
 * ==========================
 * A purpose-built "what needs my decision" surface for approvers (and a useful
 * overview for operators/client_admins). Lists executions awaiting human
 * approval, scoped server-side (tenant + approver-routing).
 *
 * ADDITIVE — this does NOT replace the chat section. Clicking an item opens the
 * existing conversation, where approval is given via the current chat/email
 * mechanism (unchanged). This page is a triage layer on top.
 *
 * Place at: frontend/src/pages/ApprovalQueue.tsx
 */

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "";
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m waiting`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h waiting`;
  const days = Math.floor(hrs / 24);
  return `${days}d waiting`;
}

// Longer waits get a warmer urgency color
function urgencyColor(iso: string | null): string {
  if (!iso) return "var(--text-muted)";
  const hrs = (Date.now() - new Date(iso).getTime()) / 3600000;
  if (hrs >= 24) return "var(--status-failed, #e5484d)";
  if (hrs >= 4)  return "var(--accent, #f5a623)";
  return "var(--text-muted)";
}

export default function ApprovalQueue() {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["approval-queue"],
    queryFn: () => approvalQueueApi.pending().then(r => r.data as QueueItem[]),
    refetchInterval: 30000, // gentle auto-refresh; approvals arrive over time
  });

  const items = data || [];

  const openConversation = (it: QueueItem) => {
    // Navigate to the existing chat conversation (unchanged approval surface).
    window.dispatchEvent(new CustomEvent("navigate", {
      detail: { page: "run", conversationId: it.conversation_id },
    }));
  };

  return (
    <div style={{ maxWidth: "860px", margin: "0 auto", padding: "8px 4px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
          Approvals
        </h1>
        <button
          onClick={() => refetch()}
          style={{
            padding: "6px 12px", borderRadius: "8px", fontSize: "12px",
            border: "1px solid var(--border)", background: "transparent",
            color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)",
          }}
        >
          {isRefetching ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: 0, marginBottom: "18px" }}>
        Items awaiting your decision. Opening one takes you to the conversation,
        where you review the full context and approve or reject as usual.
      </p>

      {isLoading ? (
        <div style={{ color: "var(--text-muted)", fontSize: "13px", padding: "40px", textAlign: "center" }}>
          Loading queue…
        </div>
      ) : items.length === 0 ? (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "56px 20px", border: "1px dashed var(--border)", borderRadius: "12px",
          color: "var(--text-muted)",
        }}>
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>✓</div>
          <div style={{ fontSize: "14px", color: "var(--text-secondary)", fontWeight: 500 }}>
            Nothing awaiting approval
          </div>
          <div style={{ fontSize: "12px", marginTop: "4px" }}>
            You're all caught up. New items will appear here automatically.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {items.map(it => (
            <div
              key={it.session_id}
              onClick={() => openConversation(it)}
              style={{
                padding: "14px 16px", borderRadius: "12px", cursor: "pointer",
                border: "1px solid var(--border)", background: "var(--surface, rgba(128,128,128,0.03))",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-hover)"; (e.currentTarget as HTMLDivElement).style.background = "rgba(128,128,128,0.06)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLDivElement).style.background = "var(--surface, rgba(128,128,128,0.03))"; }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: "14px", color: "var(--text-primary)", fontWeight: 500,
                    marginBottom: "5px", lineHeight: 1.4,
                  }}>
                    {it.human_question || "Approval required"}
                  </div>
                  {it.prompt && (
                    <div style={{
                      fontSize: "12px", color: "var(--text-muted)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {it.prompt}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px", flexShrink: 0 }}>
                  <span style={{ fontSize: "11px", color: urgencyColor(it.start_time), fontWeight: 600, whiteSpace: "nowrap" }}>
                    {timeAgo(it.start_time)}
                  </span>
                  <span style={{
                    fontSize: "11px", color: "var(--accent)", fontWeight: 600,
                    display: "flex", alignItems: "center", gap: "3px",
                  }}>
                    Review →
                  </span>
                </div>
              </div>
              {it.start_time && (
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "8px" }}>
                  Started {formatDate(it.start_time)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
