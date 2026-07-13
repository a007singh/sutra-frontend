import { useState, useEffect, useRef } from "react";
import { useMe } from "./hooks/useMe";
import { landingPage } from "./api/roles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Layout from "./components/Layout";
import Toaster from "./components/Toaster";
import { useToast } from "./hooks/useToast";
import Dashboard from "./pages/Dashboard";
import WorkflowList from "./pages/WorkflowList";
import SubAgentList from "./pages/SubAgentList";
import OrchestratorList from "./pages/OrchestratorList";
import TriggerManager from "./pages/TriggerManager";
import RunWorkflow from "./pages/RunWorkflow";
import ExecutionHistory from "./pages/ExecutionHistory";
import Settings from "./pages/Settings";
import UserManagement from "./pages/UserManagement";
import ApprovalQueue from "./pages/ApprovalQueue";
import OrgUnits from "./pages/OrgUnits";
import BillingUsage from "./pages/BillingUsage";
import BrainChat from "./pages/BrainChat";
import BrainLibrary from "./pages/BrainLibrary";
import BrainDashboard from "./pages/BrainDashboard";
import BrainSettings from "./pages/BrainSettings";
import BrainConnectors from "./pages/BrainConnectors";
import McpServersPage from "./pages/McpServersPage";
import SourcesConfig  from "./components/regulatory_intelligence/SourcesConfig";
import KBManagement   from "./components/regulatory_intelligence/KBManagement";
import ReplayView from "./pages/ReplayView";
import Login from "./pages/Login";
import { isAuthenticated, getCurrentSession, logout } from "./api/auth";

const queryClient = new QueryClient();

// Phase 2.5b: role-based landing. This lives INSIDE QueryClientProvider (unlike
// App itself, which mounts the provider) so useMe/useQuery has a client.
function RoleLanding({ onLand }: { onLand: (page: string) => void }) {
  const { data: me } = useMe();
  const done = useRef(false);
  useEffect(() => {
    if (me && !done.current) {
      done.current = true;
      const target = landingPage(me);
      if (target && target !== "dashboard") onLand(target);
    }
  }, [me, onLand]);
  return null;
}

export default function App() {
  // ── Auth gate (Phase 2.2d) ──────────────────────────────────────────────
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    // On load, try to restore/refresh an existing Cognito session
    getCurrentSession().then((ok) => setAuthed(ok || isAuthenticated()));
  }, []);

  const [page, _setPage] = useState("dashboard");
  const landedRef = useRef(false);
  const [historyFilter,    setHistoryFilter]    = useState("ALL");
  const [replayOriginPage, setReplayOriginPage] = useState("run");
  const [replayData, setReplayData] = useState<null|{
    convId: string; orchId: string; orchName: string;
    modelOverride: string|null; prompts: string[]; cost: number; model: string;
  }>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const refreshConversationsRef = useRef<(() => void) | null>(null);

  // Wrapper: clears conversationId when navigating away from run page so
  // RunWorkflow always starts fresh — fixes "new conversations disappear" bug.
  const setPage = (newPage: string) => {
    if (newPage !== "run") setConversationId(null);
    _setPage(newPage);
  };

  const handleNewChat = () => {
    setConversationId(null);
    setPage("run");
  };

  const handleSelectConversation = (id: string) => {
    setConversationId(id);
    setPage("run");
  };

  const handleRefreshReady = (fn: () => void) => {
    refreshConversationsRef.current = fn;
  };
  const { toasts, toast, dismiss } = useToast();

  // Navigation handler — supports both string and object forms
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === "string") {
        setPage(detail);
        if (detail === "history") setHistoryFilter("ALL");
      } else if (detail?.page === "replay") {
        setReplayOriginPage(page);   // remember where we came from
        setReplayData({
          convId:        detail.replayConvId        || "",
          orchId:        detail.replayOrchId        || "",
          orchName:      detail.replayOrchName      || "",
          modelOverride: detail.replayModelOverride || null,
          prompts:       detail.replayPrompts       || [],
          cost:          detail.replayCost          || 0,
          model:         detail.replayModel         || "",
        });
        _setPage("replay");
      } else if (detail?.page) {
        if (detail.page === "run" && detail.conversationId) {
          // Trigger test-fire: navigate to run AND select the triggered conversation
          handleSelectConversation(detail.conversationId);
        } else {
          setPage(detail.page);
        }
        if (detail.filter) {
          setHistoryFilter(detail.filter);
        }
      }
    };
    window.addEventListener("navigate", handler);
    return () => window.removeEventListener("navigate", handler);
  }, []);

  // New chat event — clears active conversation and navigates to run page
  useEffect(() => {
    const handler = () => handleNewChat();
    window.addEventListener("newchat", handler);
    return () => window.removeEventListener("newchat", handler);
  }, []);

  // Global toast event so any page can fire a toast without prop drilling
  useEffect(() => {
    const handler = (e: Event) => {
      const { message, type } = (e as CustomEvent).detail;
      toast(message, type);
    };
    window.addEventListener("toast", handler);
    return () => window.removeEventListener("toast", handler);
  }, [toast]);

  // While checking the session, render nothing (or a minimal splash)
  if (authed === null) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", background: "var(--bg-base, #0a0e14)",
        color: "var(--text-secondary, #8b97a7)", fontFamily: "var(--font, system-ui)" }}>
        Loading…
      </div>
    );
  }

  // Not authenticated -> show the login screen
  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <RoleLanding onLand={(p) => { if (!landedRef.current) { landedRef.current = true; _setPage(p); } }} />
      <Layout page={page} onNavigate={setPage} conversationId={conversationId} onSelectConversation={handleSelectConversation} onNewChat={handleNewChat} onRefreshReady={handleRefreshReady} onLogout={() => setAuthed(false)}>
        {page === "dashboard"     && <Dashboard />}
        {page === "workflows"     && <WorkflowList />}
        {page === "subagents"     && <SubAgentList />}
        {page === "orchestrators" && <OrchestratorList />}
        {page === "settings"    && <Settings />}
        {page === "users"       && <UserManagement />}
        {page === "approvals"   && <ApprovalQueue />}
        {page === "org-units"   && <OrgUnits />}
        {page === "billing"     && <BillingUsage />}
        {page === "brain-ask"      && <BrainChat />}
        {page === "brain-library"  && <BrainLibrary />}
        {page === "brain-insights" && <BrainDashboard />}
        {page === "brain-settings" && <BrainSettings />}
        {page === "brain-connectors" && <BrainConnectors />}
        {page === "mcp-servers"    && <McpServersPage />}
        {page === "kb-sources"     && <SourcesConfig />}
        {page === "kb-management"  && <KBManagement />}
        {page === "triggers"      && <TriggerManager onRunStarted={() => setPage("run")} />}
        <div style={{ display: page === "run" ? "contents" : "none", height: "100%" }}>
          <RunWorkflow conversationId={conversationId} onConversationStarted={setConversationId} onNewChat={handleNewChat} refreshSidebar={() => refreshConversationsRef.current?.()} />
        </div>
        {page === "history" && <ExecutionHistory initialFilter={historyFilter} />}
        {page === "replay" && replayData && (
          <ReplayView
            convId={replayData.convId}
            orchId={replayData.orchId}
            orchName={replayData.orchName}
            modelOverride={replayData.modelOverride}
            prompts={replayData.prompts}
            cost={replayData.cost}
            model={replayData.model}
            onBack={() => setPage(replayOriginPage)}
          />
        )}
      </Layout>
      <Toaster toasts={toasts} dismiss={dismiss} />
    </QueryClientProvider>
  );
}