import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { triggersApi } from "../api/triggers";
import type { Trigger } from "../api/triggers";
import { orchestratorsApi } from "../api/orchestrators";
import { subAgentsApi } from "../api/subAgents";
import PageHeader from "../components/PageHeader";
import { useCanBuild } from "../components/BuilderOnly";
import { useMe } from "../hooks/useMe";
import { canToggleTriggers } from "../api/roles";
import DataTable from "../components/DataTable";
import FormModal from "../components/FormModal";
import ConfirmModal from "../components/ConfirmModal";
import Field, { inputCss, selectCss } from "../components/Field";
import Badge from "../components/Badge";
import { globalToast } from "../hooks/useGlobalToast";
import { formatDate } from "../utils/dateTime";

interface Props {
  onRunStarted: (sessionId: string) => void;
}

const deleteBtnStyle: React.CSSProperties = {
  padding: "5px 10px", borderRadius: "6px", fontSize: "12px",
  background: "var(--status-failed-dim)",
  border: "1px solid rgba(255,92,92,0.3)",
  color: "var(--status-failed)", cursor: "pointer", fontFamily: "var(--font)",
};

const ghostBtnStyle: React.CSSProperties = {
  padding: "5px 10px", borderRadius: "6px", fontSize: "12px",
  background: "transparent", border: "1px solid var(--border-hover)",
  color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)",
};

function TriggerStatusPill({ status, isActive }: { status?: string; isActive?: boolean }) {
  const active = status === "ACTIVE" || (status == null && isActive !== false);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "4px",
      padding: "2px 8px", borderRadius: "20px", fontSize: "11px", fontWeight: 500,
      background: active ? "rgba(0,200,150,0.12)" : "rgba(255,255,255,0.06)",
      color: active ? "var(--accent)" : "var(--text-muted)",
      border: `1px solid ${active ? "rgba(0,200,150,0.2)" : "transparent"}`,
    }}>
      <span style={{
        width: "5px", height: "5px", borderRadius: "50%",
        background: active ? "var(--accent)" : "var(--text-muted)",
        flexShrink: 0,
      }} />
      {active ? "Active" : "Paused"}
    </span>
  );
}

function _timeAgo(iso: string): string {
  if (!iso) return "";
  const utc  = iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z";
  const diff = Date.now() - new Date(utc).getTime();
  const m    = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function LastFiredBadge({ lastFiredAt, lastStatus }: { lastFiredAt?: string; lastStatus?: string }) {
  if (!lastFiredAt) return <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>Never</span>;
  const ok    = !lastStatus || lastStatus === "OK";
  const color = ok ? "var(--status-done)" : "var(--status-failed)";
  return (
    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
      {_timeAgo(lastFiredAt)}{" "}
      <span style={{
        padding: "1px 5px", borderRadius: "4px", fontSize: "10px",
        background: ok ? "var(--status-done-dim)" : "var(--status-failed-dim)",
        color,
      }}>
        {ok ? "OK" : "ERR"}
      </span>
    </span>
  );
}

const PROMPT_VARS: Record<string, string[]> = {
  gmail:    ["{{sender}}", "{{subject}}", "{{body}}", "{{date}}"],
  github:   ["{{repo}}", "{{action}}", "{{pr_title}}", "{{author}}", "{{body}}"],
  slack:    ["{{channel}}", "{{user}}", "{{message}}", "{{timestamp}}"],
  schedule: ["{{timestamp}}", "{{trigger_name}}"],
  webhook:  ["{{body}}", "{{headers}}", "{{source}}"],
  manual:   ["{{body}}", "{{source}}"],
};

export default function TriggerManager({ onRunStarted }: Props) {
  const canBuild = useCanBuild();
  const { data: _me } = useMe();
  const canToggle = canToggleTriggers(_me);   // operators + client_admin (pause/resume)
  const queryClient = useQueryClient();

  const [showForm,    setShowForm]    = useState(false);
  const [editing,     setEditing]     = useState<Trigger | null>(null);
  const [deleting,    setDeleting]    = useState<Trigger | null>(null);
  const [testingId,   setTestingId]   = useState<string | null>(null);
  const [togglingId,  setTogglingId]  = useState<string | null>(null);
  const [testOverride, setTestOverride] = useState("");

  // Form fields
  const [name,           setName]          = useState("");
  const [type,           setType]          = useState("manual");
  const [targetOrchId,   setTargetOrchId]  = useState("");
  const [routerAgentId,  setRouterAgentId] = useState("");
  const [promptTemplate, setPromptTemplate] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["triggers"],
    queryFn: () => triggersApi.list().then(r => r.data),
  });

  const { data: orchestrators } = useQuery({
    queryKey: ["orchestrators"],
    queryFn: () => orchestratorsApi.list().then(r => r.data),
  });

  const { data: subAgents } = useQuery({
    queryKey: ["sub-agents"],
    queryFn: () => subAgentsApi.list().then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => triggersApi.create(
      name, type, {}, targetOrchId,
      routerAgentId || undefined,
      promptTemplate || undefined,
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["triggers"] });
      globalToast("Trigger created");
      reset();
    },
    onError: () => globalToast("Failed to create trigger", "error"),
  });

  const updateMutation = useMutation({
    mutationFn: () => triggersApi.update(
      editing!.trigger_id,
      name, type, {}, targetOrchId,
      routerAgentId || undefined,
      promptTemplate || undefined,
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["triggers"] });
      globalToast("Trigger updated");
      reset();
    },
    onError: () => globalToast("Failed to update trigger", "error"),
  });

  function handleSubmit() {
    if (!name.trim()) { globalToast("Name is required", "error"); return; }
    if (!routerAgentId && !targetOrchId) {
      globalToast("Select a target orchestrator (required when no Router Agent is set)", "error");
      return;
    }
    if (!routerAgentId && !promptTemplate.trim()) {
      globalToast("Prompt template is required when no Router Agent is set", "error");
      return;
    }
    if (editing) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  }

  const deleteMutation = useMutation({
    mutationFn: () => triggersApi.delete(deleting!.trigger_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["triggers"] });
      globalToast("Trigger deleted");
      setDeleting(null);
    },
    onError: () => globalToast("Failed to delete trigger", "error"),
  });

  function reset() {
    setShowForm(false);
    setEditing(null);
    setName(""); setType("manual"); setTargetOrchId("");
    setRouterAgentId(""); setPromptTemplate("");
  }

  function handleEdit(t: Trigger) {
    setEditing(t);
    setName(t.name);
    setType(t.type);
    setTargetOrchId(t.target_orchestrator_id || "");
    setRouterAgentId(t.router_agent_id || "");
    setPromptTemplate(t.prompt_template || "");
    setShowForm(true);
  }

  async function handleTestFire(t: Trigger) {
    setTestingId(t.trigger_id);
    try {
      const res = await triggersApi.testFire(t.trigger_id, testOverride.trim() || undefined);
      const convId = res.data.conversation_id || res.data.session_id;
      globalToast("Trigger fired — opening conversation…", "info");
      // Refresh conversations sidebar so T-badge entry appears immediately
      queryClient.invalidateQueries({ queryKey: ["triggers"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      // Navigate to the triggered conversation directly (not blank Run Workflow)
      // Uses same window event pattern as ExecutionHistory replay
      window.dispatchEvent(new CustomEvent("navigate", {
        detail: { page: "run", conversationId: convId },
      }));
    } catch {
      globalToast("Failed to fire trigger", "error");
    } finally {
      setTestingId(null);
    }
  }

  async function handleToggleStatus(t: Trigger) {
    const isActive = t.status === "ACTIVE" || (t.status == null && t.is_active !== false);
    setTogglingId(t.trigger_id);
    try {
      if (isActive) {
        await triggersApi.pause(t.trigger_id);
        globalToast(`"${t.name}" paused`);
      } else {
        await triggersApi.resume(t.trigger_id);
        globalToast(`"${t.name}" resumed`);
      }
      queryClient.invalidateQueries({ queryKey: ["triggers"] });
    } catch {
      globalToast("Failed to update trigger status", "error");
    } finally {
      setTogglingId(null);
    }
  }

  const columns = [
    {
      key: "name", label: "Name",
      render: (t: Trigger) => (
        <div>
          <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{t.name}</span>
          {t.router_agent_id && (
            <div style={{ fontSize: "10px", color: "var(--accent)", marginTop: "2px" }}>
              ⚡ Router agent configured
            </div>
          )}
        </div>
      ),
    },
    {
      key: "type", label: "Type", width: "90px",
      render: (t: Trigger) => (
        <Badge variant={t.type === "manual" ? "accent" : "default"}>{t.type}</Badge>
      ),
    },
    {
      key: "status", label: "Status", width: "100px",
      render: (t: Trigger) => (
        <TriggerStatusPill status={t.status} isActive={t.is_active} />
      ),
    },
    {
      key: "orch", label: "Target",
      render: (t: Trigger) => (
        <span style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
          {orchestrators?.find(o => o.orchestrator_agent_id === t.target_orchestrator_id)?.name || "—"}
        </span>
      ),
    },
    {
      key: "last_fired", label: "Last fired", width: "130px",
      render: (t: Trigger) => (
        <LastFiredBadge lastFiredAt={t.last_fired_at} lastStatus={t.last_status} />
      ),
    },
    {
      key: "date", label: "Created", width: "110px",
      render: (t: Trigger) => (
        <span style={{ color: "var(--text-muted)", fontSize: "12px", fontFamily: "var(--font-mono)" }}>
          {formatDate(t.created_at)}
        </span>
      ),
    },
    {
      key: "action", label: "", width: "260px",
      render: (t: Trigger) => {
        const isActive  = t.status === "ACTIVE" || (t.status == null && t.is_active !== false);
        const isTesting = testingId === t.trigger_id;
        return (
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            {canBuild && <>
            <button
              onClick={() => handleTestFire(t)}
              disabled={!!testingId}
              style={{
                padding: "6px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: 600,
                background: isTesting ? "rgba(0,200,150,0.3)" : "var(--accent-dim)",
                border: "1px solid rgba(0,200,150,0.3)",
                color: "var(--accent)",
                cursor: testingId ? "not-allowed" : "pointer",
                fontFamily: "var(--font)", transition: "all 0.15s",
                display: "flex", alignItems: "center", gap: "4px",
              }}
            >
              {isTesting ? "Firing..." : (
                <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                  Test fire
                </>
              )}
            </button>
            <button
              onClick={() => handleEdit(t)}
              style={ghostBtnStyle}
            >
              Edit
            </button>
            </>}
            {/* Pause/Resume — operational control; operators AND client_admin */}
            {canToggle && (
            <button
              onClick={() => handleToggleStatus(t)}
              disabled={togglingId === t.trigger_id}
              style={{ ...ghostBtnStyle, opacity: togglingId === t.trigger_id ? 0.5 : 1 }}
            >
              {isActive ? "Pause" : "Resume"}
            </button>
            )}
            {canBuild && (
            <button onClick={() => setDeleting(t)} style={deleteBtnStyle}>Delete</button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div style={{ padding: "28px 32px" }}>
      <PageHeader
        title="Triggers"
        subtitle="Configure automatic workflow activation from Gmail, schedules, and webhooks"
        action={canBuild ? { label: "New trigger", onClick: () => setShowForm(true) } : undefined}
      />

      {/* Test-fire prompt override box */}
      <div style={{
        background: "var(--bg-surface)", border: "1px solid var(--border)",
        borderRadius: "var(--border-radius-lg, 12px)",
        padding: "16px 20px", marginBottom: "16px",
      }}>
        <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: 500 }}>
          Test-fire prompt override
        </div>
        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "8px" }}>
          Optional — overrides the trigger's prompt template for this test run only.
          Leave blank to use the configured template.
        </div>
        <textarea
          value={testOverride}
          onChange={e => setTestOverride(e.target.value)}
          placeholder="e.g. New email from vendor@acme.com — Subject: Low stock alert — Body: Aura Smartwatch 12 units remaining..."
          rows={2}
          style={{ ...inputCss, resize: "vertical" }}
        />
      </div>

      <DataTable
        columns={columns} data={data} isLoading={isLoading}
        rowKey={t => t.trigger_id} emptyMessage="No triggers yet."
      />

      {showForm && (
        <FormModal
          title={editing ? "Edit trigger" : "New trigger"}
          onClose={reset}
          onSubmit={handleSubmit}
          submitLabel={editing ? "Save changes" : "Create"}
        >
          <Field label="Name">
            <input
              value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Vendor Stock Alert" style={inputCss}
            />
          </Field>

          <Field label="Type">
            <select value={type} onChange={e => setType(e.target.value)} style={selectCss}>
              <option value="manual">Manual</option>
              <option value="gmail">Gmail</option>
              <option value="schedule">Schedule</option>
              <option value="webhook">Webhook</option>
            </select>
          </Field>

          {/* Router Agent — shown first. When set, orchestrator + template are irrelevant */}
          <Field label="Router Agent" hint="LLM that reads the event and routes to the correct orchestrator. Use when you have multiple orchestrators sharing this trigger.">
            <select value={routerAgentId} onChange={e => { setRouterAgentId(e.target.value); setTargetOrchId(""); setPromptTemplate(""); }} style={selectCss}>
              <option value="">None — fire target orchestrator directly</option>
              {subAgents?.map(sa => (
                <option key={sa.sub_agent_id} value={sa.sub_agent_id}>
                  {sa.sub_agent_name}
                </option>
              ))}
            </select>
          </Field>

          {/* Target orchestrator + Prompt template — only shown when no Router Agent */}
          {!routerAgentId && (
            <>
              <Field label="Target orchestrator">
                <select value={targetOrchId} onChange={e => setTargetOrchId(e.target.value)} style={selectCss}>
                  <option value="">Select orchestrator...</option>
                  {orchestrators?.map(o => (
                    <option key={o.orchestrator_agent_id} value={o.orchestrator_agent_id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Prompt template"
                hint={`Variables for ${type}: ${(PROMPT_VARS[type] || PROMPT_VARS.webhook).join("  ")}`}
              >
                <textarea
                  value={promptTemplate}
                  onChange={e => setPromptTemplate(e.target.value)}
                  placeholder={
                    type === "gmail"
                      ? "New email received.\nFrom: {{sender}}\nSubject: {{subject}}\nBody:\n{{body}}\n\nAnalyse and take appropriate action."
                      : type === "github"
                      ? "New GitHub event.\nRepo: {{repo}}\nAction: {{action}}\nTitle: {{pr_title}}\nAuthor: {{author}}\nDetails:\n{{body}}\n\nAnalyse and take appropriate action."
                      : type === "slack"
                      ? "New Slack message.\nChannel: {{channel}}\nFrom: {{user}}\nMessage: {{message}}\n\nAnalyse and take appropriate action."
                      : type === "schedule"
                      ? "Scheduled trigger fired at {{timestamp}}.\n\nRun the configured workflow."
                      : "New event received.\n{{body}}\n\nAnalyse and take appropriate action."
                  }
                  rows={5}
                  style={{ ...inputCss, resize: "vertical", fontFamily: "var(--font-mono)", fontSize: "12px" }}
                />
              </Field>
            </>
          )}

          {/* Hint when Router Agent is set */}
          {routerAgentId && (
            <div style={{
              padding: "10px 14px", borderRadius: "8px",
              background: "var(--accent-dim)", border: "1px solid rgba(0,200,150,0.15)",
              fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.6",
            }}>
              ⚡ Router Agent will receive the raw event (sender, subject, body) and
              decide which orchestrator to fire based on its system prompt.
              No prompt template needed.
            </div>
          )}
        </FormModal>
      )}

      {deleting && (
        <ConfirmModal
          title="Delete trigger"
          message={`Are you sure you want to delete "${deleting.name}"?`}
          onConfirm={() => deleteMutation.mutate()}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}