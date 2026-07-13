import { useState, useEffect, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import { api } from "../api/client";
import { logout, getIdToken } from "../api/auth";
import { useMe } from "../hooks/useMe";
import { canSeeOps, canManageUsers, canSeeBuild, canSeeApprovals, canSeeBilling } from "../api/roles";
import { useQueryClient } from "@tanstack/react-query";

// ── Icons ──────────────────────────────────────────────────────────────────
function Home() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
}
function GitBranch() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>;
}
function UsersRound() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/></svg>;
}
function InboxCheck() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><path d="m9 9 2 2 4-4"/></svg>;
}
function GroupIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="6" rx="1"/><rect x="2" y="16" width="7" height="6" rx="1"/><rect x="15" y="16" width="7" height="6" rx="1"/><path d="M12 8v4M12 12H5.5v4M12 12h6.5v4"/></svg>;
}
function BillingIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
}
function Bot() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>;
}
function Network() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 7v4M5 17l7-6 7 6"/></svg>;
}
function Zap() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
}
function PlugIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18"/><path d="M7 17H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h3"/><path d="M17 7v3a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V7"/><path d="M17 7h3a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-3"/></svg>;
}
function HistoryIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
}
function SettingsIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
}
function DatabaseIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>;
}
function BrainAskIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a5 5 0 0 0-5 5v1a4 4 0 0 0-1 7.87V17a3 3 0 0 0 6 0M12 2a5 5 0 0 1 5 5v1a4 4 0 0 1 1 7.87V17a3 3 0 0 1-6 0"/></svg>;
}
function BrainLibIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>;
}
function BrainInsightsIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>;
}
function BrainSettingsIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
}
function LinkIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>;
}

// ── Data types ─────────────────────────────────────────────────────────────
interface Conversation {
  session_id: string;
  title: string;
  orchestrator_id: string;
  orchestrator_name: string;
  status: string;
  start_time: string;
  cost_usd: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  if (!iso) return "";
  // Backend stores UTC without "Z" — append it so browser parses as UTC,
  // not local time (fixes the IST +5:30 offset showing "5 hours ago").
  const utc  = iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z";
  const diff = Date.now() - new Date(utc).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const STATUS_COLOR: Record<string, string> = {
  COMPLETED:          "#00c896",
  RUNNING:            "#3b82f6",
  WAITING_FOR_HUMAN:  "#f59e0b",
  FAILED:             "#ff5c5c",
  CANCELLED:          "#555",
};

// ── Nav config ─────────────────────────────────────────────────────────────
const NAV_TOP    = [{ id: "dashboard",  label: "Dashboard",  icon: Home }];
const NAV_BUILD  = [
  { id: "workflows",     label: "Workflows",     icon: GitBranch },
  { id: "subagents",     label: "Sub-agents",    icon: Bot },
  { id: "orchestrators", label: "Orchestrators", icon: Network },
  { id: "triggers",      label: "Triggers",      icon: Zap },
];
const NAV_OBSERVE = [
  { id: "history",     label: "History",      icon: HistoryIcon },
  { id: "mcp-servers", label: "MCP servers",  icon: PlugIcon },
  { id: "settings",    label: "Settings",     icon: SettingsIcon },
];
const NAV_DATA = [
  { id: "kb-sources",    label: "KB Sources",    icon: LinkIcon     },
  { id: "kb-management", label: "Knowledge Base", icon: DatabaseIcon },
];
// Second Brain — Ask & Library are for everyone; Insights is management-only.
const NAV_BRAIN_ALL = [
  { id: "brain-ask",     label: "Ask",     icon: BrainAskIcon },
  { id: "brain-library", label: "Library", icon: BrainLibIcon },
];

// ── Props ──────────────────────────────────────────────────────────────────
interface Props {
  page: string;
  onNavigate: (page: string) => void;
  children: ReactNode;
  conversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onRefreshReady?: (refreshFn: () => void) => void;
  onLogout?: () => void;
}

// ── NavButton ──────────────────────────────────────────────────────────────
function NavButton({ id, label, icon: Icon, active, onClick }: {
  id: string; label: string; icon: () => JSX.Element;
  active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      width: "100%", display: "flex", alignItems: "center", gap: "10px",
      padding: "8px 10px", borderRadius: "8px", border: "none",
      cursor: "pointer", fontSize: "13px", fontFamily: "var(--font)",
      background: active ? "var(--accent-dim)" : "transparent",
      color: active ? "var(--accent)" : "var(--text-secondary)",
      marginBottom: "2px", transition: "all 0.15s",
    }}
      onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.background = "rgba(128,128,128,0.08)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)"; } }}
      onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)"; } }}
    >
      <Icon />
      <span>{label}</span>
      {active && <div style={{ marginLeft: "auto", width: "4px", height: "4px", borderRadius: "50%", background: "var(--accent)" }} />}
    </button>
  );
}

// ── ConversationItem ───────────────────────────────────────────────────────
function ConversationItem({ conv, active, onClick, onDelete }: {
  conv: Conversation; active: boolean; onClick: () => void; onDelete: () => void;
}) {
  const [hov,    setHov]    = useState(false);
  const [delHov, setDelHov] = useState(false);
  const dotColor = STATUS_COLOR[conv.status] || "#555";
  const isLive   = conv.status === "RUNNING" || conv.status === "WAITING_FOR_HUMAN";

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={conv.title}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: "8px",
        padding: "7px 10px", borderRadius: "6px",
        cursor: "pointer", transition: "all 0.15s", position: "relative",
        background: active ? "var(--accent-dim)" : hov ? "rgba(128,128,128,0.08)" : "transparent",
      }}
    >
      {/* Selectable area */}
      <div onClick={onClick} style={{ display: "flex", alignItems: "flex-start", gap: "8px", flex: 1, minWidth: 0 }}>
        {/* Lettered status dot — A = agent, O = orchestrator */}
        <div style={{
          width: "14px", height: "14px", borderRadius: "50%",
          flexShrink: 0, marginTop: "2px", background: dotColor,
          boxShadow: isLive ? `0 0 5px ${dotColor}` : "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "7px", fontWeight: 700, color: "#0A0B0F",
          letterSpacing: 0, lineHeight: 1, fontFamily: "var(--font)",
        }}>
          {conv.orchestrator_name?.startsWith("Trigger · ") ? "T"
            : conv.orchestrator_name?.startsWith("Agent · ") ? "A"
            : "O"}
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: "12px", lineHeight: "1.4",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            color: active ? "var(--accent)" : "var(--text-primary)",
            fontWeight: active ? 500 : 400,
          }}>
            {conv.title}
          </div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px", display: "flex", gap: "4px", alignItems: "center" }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "90px" }}>
              {conv.orchestrator_name}
            </span>
            <span>·</span>
            <span style={{ flexShrink: 0 }}>{timeAgo(conv.start_time)}</span>
          </div>
        </div>
      </div>

      {/* Trash button — visible on hover only */}
      {hov && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          onMouseEnter={() => setDelHov(true)}
          onMouseLeave={() => setDelHov(false)}
          title="Delete conversation"
          style={{
            flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            width: "20px", height: "20px", borderRadius: "4px", border: "none",
            background: delHov ? "rgba(255,80,80,0.15)" : "transparent",
            color: delHov ? "var(--status-failed)" : "var(--text-muted)",
            cursor: "pointer", padding: 0, transition: "all 0.15s",
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
        </button>
      )}
    </div>
  );
}

// ── Layout ─────────────────────────────────────────────────────────────────
export default function Layout({ page, onNavigate, children, conversationId, onSelectConversation, onNewChat, onRefreshReady, onLogout }: Props) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [conversations, setConversations] = useState<Conversation[]>([]);

  // Derive the logged-in user from the Cognito id token (email + initial)
  const { data: me } = useMe();
  const showOps = canSeeOps(me);
  const showUsers = canManageUsers(me);
  const showBuild = canSeeBuild(me);   // build + data sections (not viewer/auditor/approver)
  const showApprovals = canSeeApprovals(me);  // approval queue (approvers + ops/admin)
  const showBilling = canSeeBilling(me);      // usage & billing (ops + client_admin)
  // Pretty role label for the header (CLIENT_ADMIN -> "Client Admin")
  const roleLabel = me?.role
    ? me.role.split("_").map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(" ")
    : "";
  // Client roles don't see MCP servers or Settings (operator-only features).
  const observeNav = showOps
    ? NAV_OBSERVE
    : NAV_OBSERVE.filter(n => n.id !== "mcp-servers" && n.id !== "settings");
  const queryClient = useQueryClient();
  const userInfo = (() => {
    const tok = getIdToken();
    if (!tok) return { email: "", label: "User", initial: "U" };
    try {
      const p = JSON.parse(atob(tok.split(".")[1]));
      const email = p.email || p["cognito:username"] || "";
      const name  = p.name || email || "User";
      return { email, label: name, initial: (name[0] || "U").toUpperCase() };
    } catch {
      return { email: "", label: "User", initial: "U" };
    }
  })();

  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); }, [theme]);

  const loadConversations = useCallback(async () => {
    try {
      const res  = await api.get<any[]>("/api/executions/conversations");
      const data = res.data ?? [];
      const convs: Conversation[] = data.slice(0, 30).map((e: any) => {
        return {
          session_id:        e.conversation_id || e.session_id || "",
          // If title is missing or the DB default "Untitled", fall back to
          // "Chat · <orchestrator>" so sidebar entries are always meaningful.
          title: (e.title && e.title !== "Untitled")
            ? e.title
            : (e.orchestrator_name ? `Chat · ${e.orchestrator_name}` : "Untitled"),
          orchestrator_id:   e.orchestrator_id   || "",
          orchestrator_name: e.orchestrator_name || "Unknown",
          status:            e.status             || "UNKNOWN",
          start_time:        e.start_time         || "",
          cost_usd:          parseFloat(e.cost_usd || "0"),
        };
      });
      setConversations(convs);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  }, []);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function handleDeleteConversation(convId: string) {
    // Optimistic remove from sidebar immediately
    setConversations(prev => prev.filter(c => c.session_id !== convId));
    setConfirmDeleteId(null);
    try {
      await api.delete(`/api/executions/conversations/${convId}`);
    } catch {
      loadConversations();
    }
  }

  // Expose loadConversations so RunWorkflow can trigger immediate sidebar refresh
  useEffect(() => {
    if (onRefreshReady) onRefreshReady(loadConversations);
  }, [onRefreshReady, loadConversations]);

  // Reload when conversationId changes
  useEffect(() => { loadConversations(); }, [loadConversations, conversationId]);
  // Background refresh every 15s for live status dots
  useEffect(() => {
    const id = setInterval(loadConversations, 15000);
    return () => clearInterval(id);
  }, [loadConversations]);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: "var(--sidebar-w, 220px)", flexShrink: 0,
        background: "var(--bg-surface)", borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>

        {/* Logo + New Chat icon */}
        <div style={{ padding: "20px 18px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "28px", height: "28px", borderRadius: "7px", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0A0B0F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5"/>
                  <path d="M2 12l10 5 10-5"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.2px" }}>Sutra</div>
                <div style={{ fontSize: "10px", color: "var(--text-muted)", letterSpacing: "0.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "140px" }} title={`${me?.tenant_name || "PLATFORM"}${roleLabel ? " · " + roleLabel : ""}`}>
                  {me?.tenant_name ? me.tenant_name.toUpperCase() : "PLATFORM"}
                  {roleLabel && (
                    <span style={{ color: "var(--accent)", fontWeight: 600 }}> · {roleLabel}</span>
                  )}
                </div>
              </div>
            </div>

            {/* ✏️ New Chat button */}
            <button
              onClick={onNewChat}
              title="New chat"
              style={{
                width: "28px", height: "28px", borderRadius: "7px",
                background: "transparent", border: "1px solid var(--border)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--text-secondary)", transition: "all 0.15s", flexShrink: 0,
              }}
              onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "var(--accent-dim)"; b.style.color = "var(--accent)"; b.style.borderColor = "var(--accent)"; }}
              onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "transparent"; b.style.color = "var(--text-secondary)"; b.style.borderColor = "var(--border)"; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable nav */}
        <nav style={{ flex: 1, padding: "10px 8px", overflowY: "auto", overflowX: "hidden" }}>

          {NAV_TOP.map(({ id, label, icon }) => (
            <NavButton key={id} id={id} label={label} icon={icon}
              active={page === id && conversationId === null}
              onClick={() => onNavigate(id)} />
          ))}
          {showApprovals && (
            <NavButton id="approvals" label="Approvals" icon={InboxCheck}
              active={page === "approvals"} onClick={() => onNavigate("approvals")} />
          )}
          {showBilling && (
            <NavButton id="billing" label="Usage & Billing" icon={BillingIcon}
              active={page === "billing"} onClick={() => onNavigate("billing")} />
          )}

          <div style={{ height: "1px", background: "var(--border)", margin: "8px 4px" }} />

          {showBuild && (
            <>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", padding: "8px 10px 6px", letterSpacing: "0.8px", fontWeight: 600 }}>BUILD</div>
              {NAV_BUILD.map(({ id, label, icon }) => (
                <NavButton key={id} id={id} label={label} icon={icon}
                  active={page === id} onClick={() => onNavigate(id)} />
              ))}
            </>
          )}

          {showBuild && (
            <>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", padding: "14px 10px 6px", letterSpacing: "0.8px", fontWeight: 600 }}>DATA</div>
              {NAV_DATA.map(({ id, label, icon }) => (
                <NavButton key={id} id={id} label={label} icon={icon}
                  active={page === id} onClick={() => onNavigate(id)} />
              ))}
            </>
          )}

          {/* SECOND BRAIN — Ask & Library for everyone; Insights management-only */}
          <div style={{ fontSize: "10px", color: "var(--text-muted)", padding: "14px 10px 6px", letterSpacing: "0.8px", fontWeight: 600 }}>SECOND BRAIN</div>
          {NAV_BRAIN_ALL.map(({ id, label, icon }) => (
            <NavButton key={id} id={id} label={label} icon={icon}
              active={page === id} onClick={() => onNavigate(id)} />
          ))}
          {showUsers && (
            <NavButton id="brain-insights" label="Insights" icon={BrainInsightsIcon}
              active={page === "brain-insights"} onClick={() => onNavigate("brain-insights")} />
          )}
          {showUsers && (
            <NavButton id="brain-settings" label="Settings" icon={BrainSettingsIcon}
              active={page === "brain-settings"} onClick={() => onNavigate("brain-settings")} />
          )}
          {showUsers && (
            <NavButton id="brain-connectors" label="Connectors" icon={LinkIcon}
              active={page === "brain-connectors"} onClick={() => onNavigate("brain-connectors")} />
          )}

          <div style={{ fontSize: "10px", color: "var(--text-muted)", padding: "14px 10px 6px", letterSpacing: "0.8px", fontWeight: 600 }}>OBSERVE</div>
          {observeNav.map(({ id, label, icon }) => (
            <NavButton key={id} id={id} label={label} icon={icon}
              active={page === id} onClick={() => onNavigate(id)} />
          ))}


          {showUsers && (
            <>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", padding: "14px 10px 6px", letterSpacing: "0.8px", fontWeight: 600 }}>ADMINISTER</div>
              <NavButton id="users" label="Users" icon={UsersRound}
                active={page === "users"} onClick={() => onNavigate("users")} />
              <NavButton id="org-units" label="Approver Groups" icon={GroupIcon}
                active={page === "org-units"} onClick={() => onNavigate("org-units")} />
            </>
          )}

          {/* CHATS section */}
          <div style={{ height: "1px", background: "var(--border)", margin: "10px 4px 8px" }} />

          <div style={{ display: "flex", alignItems: "center", padding: "0 10px 6px" }}>
            <span style={{ fontSize: "10px", color: "var(--text-muted)", letterSpacing: "0.8px", fontWeight: 600, flex: 1 }}>
              CHATS
            </span>
            <button
              onClick={onNewChat}
              style={{
                display: "flex", alignItems: "center", gap: "3px",
                padding: "2px 7px", borderRadius: "4px", border: "none",
                background: "transparent", cursor: "pointer",
                fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font)",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.color = "var(--accent)"; b.style.background = "var(--accent-dim)"; }}
              onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.color = "var(--text-muted)"; b.style.background = "transparent"; }}
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New
            </button>
          </div>

          {conversations.length === 0 ? (
            <div style={{ padding: "6px 10px 12px", fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic" }}>
              No chats yet
            </div>
          ) : (
            conversations.map(conv => (
              <ConversationItem
                key={conv.session_id}
                conv={conv}
                active={conversationId === conv.session_id && page === "run"}
                onClick={() => onSelectConversation(conv.session_id)}
                onDelete={() => setConfirmDeleteId(conv.session_id)}
              />
            ))
          )}

        </nav>

        {/* Bottom: theme + user */}
        <div style={{ padding: "12px 8px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
          <button
            onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: "10px",
              padding: "8px 10px", borderRadius: "8px", border: "none",
              background: "transparent", cursor: "pointer", fontSize: "12px",
              color: "var(--text-secondary)", fontFamily: "var(--font)",
              marginBottom: "4px", transition: "background 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(128,128,128,0.08)"}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "transparent"}
          >
            {theme === "dark" ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px" }}>
            <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 600, color: "#fff", flexShrink: 0 }}>{userInfo.initial}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "12px", color: "var(--text-primary)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userInfo.label}</div>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userInfo.email || "Signed in"}</div>
            </div>
            <button
              onClick={() => { queryClient.clear(); logout(); onLogout?.(); }}
              title="Sign out"
              style={{
                flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                width: "26px", height: "26px", borderRadius: "6px", border: "1px solid var(--border)",
                background: "transparent", cursor: "pointer", color: "var(--text-muted)", transition: "all 0.15s",
              }}
              onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.color = "var(--status-failed)"; b.style.borderColor = "rgba(255,80,80,0.3)"; b.style.background = "rgba(255,80,80,0.08)"; }}
              onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.color = "var(--text-muted)"; b.style.borderColor = "var(--border)"; b.style.background = "transparent"; }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, overflow: "auto", background: "var(--bg-base)" }}>
        {children}
      </main>

      {/* ── Delete confirmation popup ── */}
      {confirmDeleteId && (() => {
        const conv = conversations.find(c => c.session_id === confirmDeleteId);
        const title = conv?.title || "this conversation";
        return (
          <div
            style={{
              position: "fixed", inset: 0, zIndex: 999,
              background: "rgba(0,0,0,0.5)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
            onClick={() => setConfirmDeleteId(null)}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: "var(--bg-surface)", border: "1px solid var(--border)",
                borderRadius: "var(--border-radius-lg, 12px)",
                padding: "24px 28px", width: "380px", maxWidth: "90vw",
              }}
            >
              <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}>
                Delete conversation?
              </div>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.6", marginBottom: "20px" }}>
                "<span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                  {title.length > 60 ? title.slice(0, 60) + "…" : title}
                </span>" and all its execution history will be permanently deleted.
              </div>
              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  style={{
                    padding: "8px 16px", borderRadius: "8px", fontSize: "13px",
                    background: "transparent", border: "1px solid var(--border-hover)",
                    color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteConversation(confirmDeleteId)}
                  style={{
                    padding: "8px 18px", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
                    background: "var(--status-failed-dim)", border: "1px solid rgba(255,80,80,0.3)",
                    color: "var(--status-failed)", cursor: "pointer", fontFamily: "var(--font)",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}