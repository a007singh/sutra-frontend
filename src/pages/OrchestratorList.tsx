import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orchestratorsApi } from "../api/orchestrators";
import type { Orchestrator } from "../api/orchestrators";
import { subAgentsApi } from "../api/subAgents";
import { workflowsApi } from "../api/workflows";
import DataTable from "../components/DataTable";
import { useCanBuild } from "../components/BuilderOnly";
import FormModal from "../components/FormModal";
import ConfirmModal from "../components/ConfirmModal";
import TemplateSelector from "../components/TemplateSelector";
import type { OrchestratorTemplate } from "../data/orchestratorTemplates";
import Field, { inputCss, selectCss } from "../components/Field";
import Badge from "../components/Badge";
import { AVAILABLE_MODELS } from "../api/client";
import { globalToast } from "../hooks/useGlobalToast";
import TemplateSubAgentCard from "../components/TemplateSubAgentCard";
import OrchestratorDrawer from "../components/OrchestratorDrawer";
import { formatDate } from "../utils/dateTime";
import { ExportButton, ImportModal } from "../components/WorkflowImportExport";

const editBtnStyle: React.CSSProperties = {
  padding: "5px 12px", borderRadius: "6px", fontSize: "12px",
  background: "transparent", border: "1px solid var(--border-hover)",
  color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)",
};

const deleteBtnStyle: React.CSSProperties = {
  padding: "5px 12px", borderRadius: "6px", fontSize: "12px",
  background: "var(--status-failed-dim)",
  border: "1px solid rgba(255,92,92,0.3)",
  color: "var(--status-failed)", cursor: "pointer", fontFamily: "var(--font)",
};

export default function OrchestratorList() {
  const canBuild = useCanBuild();
  const queryClient = useQueryClient();

  const [showForm, setShowForm]             = useState(false);
  const [showTemplates, setShowTemplates]   = useState(false);
  const [editing, setEditing]               = useState<Orchestrator | null>(null);
  const [deleting, setDeleting]             = useState<Orchestrator | null>(null);
  const [templateInfo, setTemplateInfo]     = useState<OrchestratorTemplate | null>(null);
  const [name, setName]                     = useState("");
  const [workflowId, setWorkflowId]         = useState("");
  const [modelId, setModelId]               = useState("anthropic.claude-3-5-sonnet-20241022-v2:0");
  const [systemPrompt, setSystemPrompt]     = useState("");
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [createdTemplateAgentIds, setCreatedTemplateAgentIds] = useState<string[]>([]);
  const [budgetDaily,   setBudgetDaily]   = useState("");
  const [budgetMonthly, setBudgetMonthly] = useState("");
  const [roiTarget,     setRoiTarget]     = useState("");
  const [viewing, setViewing] = useState<Orchestrator | null>(null);
  const [showImport, setShowImport] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["orchestrators"],
    queryFn: () => orchestratorsApi.list().then(r => r.data),
  });

  const { data: subAgents } = useQuery({
    queryKey: ["sub-agents"],
    queryFn: () => subAgentsApi.list().then(r => r.data),
  });

  const { data: workflows } = useQuery({
    queryKey: ["workflows"],
    queryFn: () => workflowsApi.list().then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      orchestratorsApi.create(name, workflowId, modelId, systemPrompt, selectedAgents),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["orchestrators"] });
      globalToast("Orchestrator created");
      // Save governance settings on newly created orchestrator
      const newId = data?.data?.orchestrator_agent_id;
      if (newId && (budgetDaily || budgetMonthly || roiTarget)) {
        fetch(`/api/executions/governance/orchestrator/${newId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            budget_daily_usd:   budgetDaily   ? parseFloat(budgetDaily)   : null,
            budget_monthly_usd: budgetMonthly ? parseFloat(budgetMonthly) : null,
            roi_target:         roiTarget     ? parseFloat(roiTarget)     : null,
          }),
        }).catch(() => {});
      }
      reset();
    },
    onError: () => globalToast("Failed to create orchestrator", "error"),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      await orchestratorsApi.update(
        editing!.orchestrator_agent_id,
        name, workflowId, modelId, systemPrompt, selectedAgents
      );
      // Save governance settings (non-fatal if endpoint missing)
      try {
        await fetch(`/api/executions/governance/orchestrator/${editing!.orchestrator_agent_id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            budget_daily_usd:   budgetDaily   ? parseFloat(budgetDaily)   : null,
            budget_monthly_usd: budgetMonthly ? parseFloat(budgetMonthly) : null,
            roi_target:         roiTarget     ? parseFloat(roiTarget)     : null,
          }),
        });
      } catch (_) {}
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orchestrators"] });
      globalToast("Orchestrator updated");
      reset();
    },
    onError: () => globalToast("Failed to update orchestrator", "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => orchestratorsApi.delete(deleting!.orchestrator_agent_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orchestrators"] });
      globalToast("Orchestrator deleted");
      setDeleting(null);
    },
    onError: () => globalToast("Failed to delete orchestrator", "error"),
  });

  function openCreate() {
    setCreatedTemplateAgentIds([]);
    setEditing(null); setName(""); setWorkflowId("");
    setModelId("anthropic.claude-3-5-sonnet-20241022-v2:0");
    setSystemPrompt(""); setSelectedAgents([]);
    setTemplateInfo(null); setShowForm(true);
  }

  function openEdit(o: Orchestrator) {
    setCreatedTemplateAgentIds([]);
    setEditing(o); setName(o.name); setWorkflowId(o.workflow_id);
    setModelId(o.model_id); setSystemPrompt(o.system_prompt);
    setSelectedAgents(o.sub_agents || []);
    setTemplateInfo(null); setShowForm(true);
    setBudgetDaily(  String((o as any).budget_daily_usd   || ""));
    setBudgetMonthly(String((o as any).budget_monthly_usd || ""));
    setRoiTarget(    String((o as any).roi_target         || ""));
  }

  function reset() {
    setCreatedTemplateAgentIds([]);
    setShowForm(false); setEditing(null); setName("");
    setSystemPrompt(""); setSelectedAgents([]);
    setTemplateInfo(null);
    setBudgetDaily(""); setBudgetMonthly(""); setRoiTarget("");
  }

  function toggleAgent(id: string) {
    setSelectedAgents(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function handleSubmit() {
    if (!name.trim() || !workflowId) return;
    editing ? updateMutation.mutate() : createMutation.mutate();
  }

  function applyTemplate(template: OrchestratorTemplate) {
    setCreatedTemplateAgentIds([]);
    setShowTemplates(false);
    setEditing(null);
    setName(template.name);
    setModelId(template.model_id);
    setSystemPrompt(template.system_prompt);
    setTemplateInfo(template);
    setSelectedAgents([]);
    setWorkflowId("");
    setShowForm(true);
    globalToast(`Template "${template.name}" loaded`, "info");
  }

  const columns = [
    {
      key: "name", label: "Name",
      render: (o: Orchestrator) => (
        <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{o.name}</span>
      ),
    },
    {
      key: "workflow", label: "Workflow",
      render: (o: Orchestrator) => (
        <span style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
          {workflows?.find(w => w.workflow_id === o.workflow_id)?.name || "—"}
        </span>
      ),
    },
    {
      key: "model", label: "Model",
      render: (o: Orchestrator) => (
        <span style={{
          fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--text-muted)",
        }}>
          {o.model_id?.split(".").pop()?.slice(0, 24)}
        </span>
      ),
    },
    {
      key: "agents", label: "Sub-agents", width: "100px",
      render: (o: Orchestrator) => (
        <Badge variant="accent">{(o.sub_agents || []).length} agents</Badge>
      ),
    },
    {
      key: "date", label: "Created", width: "120px",
      render: (o: Orchestrator) => (
        <span style={{
          color: "var(--text-muted)", fontSize: "12px", fontFamily: "var(--font-mono)",
        }}>
          {formatDate(o.created_at)}
        </span>
      ),
    },
    { key: "action", label: "", width: "220px",
      render: (o: Orchestrator) => (
        <div style={{ display: "flex", gap: "6px" }}>
          <button onClick={() => setViewing(o)} style={{
            padding: "5px 12px", borderRadius: "6px", fontSize: "12px",
            background: "var(--accent-dim)", border: "1px solid rgba(0,200,150,0.2)",
            color: "var(--accent)", cursor: "pointer", fontFamily: "var(--font)",
          }}>View</button>
          <ExportButton orchestrator={o} />
          {canBuild && <button onClick={() => openEdit(o)} style={editBtnStyle}>Edit</button>}
          {canBuild && <button onClick={() => setDeleting(o)} style={deleteBtnStyle}>Delete</button>}
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: "28px 32px" }}>
      {/* Custom header with two buttons */}
      <div style={{
        display: "flex", alignItems: "flex-start",
        justifyContent: "space-between", marginBottom: "20px",
      }}>
        <div>
          <h1 style={{
            fontSize: "20px", fontWeight: 600,
            color: "var(--text-primary)", letterSpacing: "-0.3px",
          }}>
            Orchestrators
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "3px" }}>
            Coordinate multiple sub-agents to complete complex workflows
          </p>
        </div>
        {canBuild && <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => setShowTemplates(true)}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "8px 16px", borderRadius: "var(--radius)",
              background: "transparent", border: "1px solid var(--border-hover)",
              color: "var(--text-secondary)", fontSize: "13px",
              cursor: "pointer", fontFamily: "var(--font)", transition: "all 0.15s",
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
            </svg>
            Start from template
          </button>
          <button onClick={openCreate} style={{
            display: "flex", alignItems: "center", gap: "6px",
            padding: "8px 16px", borderRadius: "var(--radius)",
            background: "var(--accent)", border: "none",
            color: "#0A0B0F", fontSize: "13px", fontWeight: 600,
            cursor: "pointer", fontFamily: "var(--font)",
          }}>
            <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span>
            New orchestrator
          </button>
          <button onClick={() => setShowImport(true)} style={{
            display: "flex", alignItems: "center", gap: "6px",
            padding: "8px 16px", borderRadius: "var(--radius)",
            background: "transparent", border: "1px solid var(--border-hover)",
            color: "var(--text-secondary)", fontSize: "13px",
            cursor: "pointer", fontFamily: "var(--font)", transition: "all 0.15s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(128,128,128,0.08)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)"; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Import config
          </button>
        </div>}
      </div>

      <DataTable
        columns={columns} data={data} isLoading={isLoading}
        rowKey={o => o.orchestrator_agent_id} emptyMessage="No orchestrators yet."
      />

      {/* Create / Edit form */}
      {showForm && (
        <FormModal
          title={editing ? "Edit orchestrator" : "New orchestrator"}
          onClose={reset} onSubmit={handleSubmit}
          submitLabel={editing ? "Save" : "Create"}
        >
          {/* Template banner */}
          {templateInfo && (
            <div style={{
              padding: "10px 14px", borderRadius: "var(--radius)",
              background: "var(--accent-dim)",
              border: "1px solid rgba(0,200,150,0.2)",
              display: "flex", alignItems: "center", gap: "10px",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="var(--accent)" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span style={{ fontSize: "12px", color: "var(--accent)", flex: 1 }}>
                Loaded from{" "}
                <strong style={{ fontWeight: 600 }}>{templateInfo.name}</strong>{" "}
                template. System prompt and model are pre-filled.
              </span>
              <button onClick={() => setTemplateInfo(null)} style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--accent)", fontSize: "16px", lineHeight: 1,
              }}>×</button>
            </div>
          )}

          <Field label="Name">
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. KYC Orchestrator" style={inputCss} />
          </Field>

          <Field label="Workflow">
            <select value={workflowId} onChange={e => setWorkflowId(e.target.value)}
              style={selectCss}>
              <option value="">Select workflow...</option>
              {workflows?.map(w => (
                <option key={w.workflow_id} value={w.workflow_id}>{w.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Model">
            <select value={modelId} onChange={e => setModelId(e.target.value)}
              style={selectCss}>
              {AVAILABLE_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            <div style={{
              fontSize: "11px", color: "var(--text-muted)",
              marginTop: "4px", fontFamily: "var(--font-mono)",
            }}>
              {modelId}
            </div>
          </Field>

          <Field label="System prompt">
            <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)}
              rows={6} style={{ ...inputCss, resize: "vertical" }}
              placeholder="You are an orchestrator that..." />
          </Field>

          {/* ── Governance settings (shown for both create and edit) ── */}
          <div style={{
            borderTop: "1px solid var(--border)", paddingTop: "14px", marginTop: "4px",
          }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>
              Governance settings
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "5px", display: "block" }}>
                  Daily budget (USD)
                </label>
                <input
                  type="number" min="0" step="0.01"
                  value={budgetDaily}
                  onChange={e => setBudgetDaily(e.target.value)}
                  placeholder="e.g. 1.00"
                  style={{ width: "100%", padding: "9px 12px", background: "var(--bg-overlay)", border: "1px solid var(--border-hover)", borderRadius: "8px", color: "var(--text-primary)", fontSize: "13px", fontFamily: "var(--font)", outline: "none", boxSizing: "border-box" as const }}
                />
                <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "3px" }}>Alert when exceeded</div>
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "5px", display: "block" }}>
                  Monthly budget (USD)
                </label>
                <input
                  type="number" min="0" step="0.01"
                  value={budgetMonthly}
                  onChange={e => setBudgetMonthly(e.target.value)}
                  placeholder="e.g. 20.00"
                  style={{ width: "100%", padding: "9px 12px", background: "var(--bg-overlay)", border: "1px solid var(--border-hover)", borderRadius: "8px", color: "var(--text-primary)", fontSize: "13px", fontFamily: "var(--font)", outline: "none", boxSizing: "border-box" as const }}
                />
                <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "3px" }}>Alert when exceeded</div>
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "5px", display: "block" }}>
                  ROI target (×)
                </label>
                <input
                  type="number" min="0" step="1"
                  value={roiTarget}
                  onChange={e => setRoiTarget(e.target.value)}
                  placeholder="e.g. 100"
                  style={{ width: "100%", padding: "9px 12px", background: "var(--bg-overlay)", border: "1px solid var(--border-hover)", borderRadius: "8px", color: "var(--text-primary)", fontSize: "13px", fontFamily: "var(--font)", outline: "none", boxSizing: "border-box" as const }}
                />
                <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "3px" }}>Expected ROI multiplier</div>
              </div>
            </div>
          </div>

          <Field label="Sub-agents">
            {/* Template suggested agents hint */}
            {templateInfo && templateInfo.suggested_sub_agents.length > 0 && (
              <div style={{ marginBottom: "10px" }}>
                <div style={{
                  fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)",
                  marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px",
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke="var(--status-running)" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <span style={{ color: "var(--status-running)" }}>
                    Template includes {templateInfo.suggested_sub_agents.length} suggested sub-agents.
                    Review and create them below.
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "10px" }}>
                  {templateInfo.suggested_sub_agents.map((sa, i) => (
                    <TemplateSubAgentCard
                      key={i}
                      index={i}
                      agent={sa}
                      isCreated={createdTemplateAgentIds.includes(
                        subAgents?.find(s => s.sub_agent_name === sa.name)?.sub_agent_id || "__none__"
                      )}
                      onCreated={id => {
                        setCreatedTemplateAgentIds(prev => [...prev, id]);
                        setSelectedAgents(prev => [...new Set([...prev, id])]);
                        queryClient.invalidateQueries({ queryKey: ["sub-agents"] });
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div style={{
              background: "var(--bg-overlay)", border: "1px solid var(--border-hover)",
              borderRadius: "var(--radius)", padding: "10px",
              maxHeight: "160px", overflowY: "auto",
              display: "flex", flexDirection: "column", gap: "6px",
            }}>
              {!subAgents?.length ? (
                <div style={{ fontSize: "12px", color: "var(--text-muted)", padding: "4px" }}>
                  No sub-agents found. Create sub-agents first.
                </div>
              ) : subAgents.map(sa => (
                <label key={sa.sub_agent_id} style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  cursor: "pointer", padding: "4px 6px", borderRadius: "6px",
                }}>
                  <input type="checkbox"
                    checked={selectedAgents.includes(sa.sub_agent_id)}
                    onChange={() => toggleAgent(sa.sub_agent_id)}
                    style={{ accentColor: "var(--accent)", width: "14px", height: "14px" }}
                  />
                  <span style={{ fontSize: "13px", color: "var(--text-primary)" }}>
                    {sa.sub_agent_name}
                  </span>
                  <span style={{
                    fontSize: "11px", color: "var(--text-muted)",
                    fontFamily: "var(--font-mono)", marginLeft: "auto",
                  }}>
                    {sa.model_name?.split(".").pop()?.slice(0, 16)}
                  </span>
                </label>
              ))}
            </div>
            <div style={{
              fontSize: "11px", color: "var(--text-muted)", marginTop: "5px",
            }}>
              {selectedAgents.length} selected
            </div>
          </Field>
        </FormModal>
      )}

      {/* Template selector */}
      {showTemplates && (
        <TemplateSelector
          onSelect={applyTemplate}
          onClose={() => setShowTemplates(false)}
        />
      )}

      {/* Delete confirmation */}
      {deleting && (
        <ConfirmModal
          title="Delete orchestrator"
          message={`Are you sure you want to delete "${deleting.name}"? Any triggers pointing to it will stop working.`}
          onConfirm={() => deleteMutation.mutate()}
          onClose={() => setDeleting(null)}
        />
      )}

      {viewing && (
        <OrchestratorDrawer
          orchestrator={viewing}
          onClose={() => setViewing(null)}
          onEdit={(o) => { setViewing(null); openEdit(o); }}
        />
      )}

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={() => queryClient.invalidateQueries({ queryKey: ["orchestrators"] })}
        />
      )}
      
    </div>
  );
}