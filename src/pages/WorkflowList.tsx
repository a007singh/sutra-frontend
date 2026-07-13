import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { workflowsApi } from "../api/workflows";
import type { Workflow } from "../api/workflows";
import PageHeader from "../components/PageHeader";
import { useCanBuild } from "../components/BuilderOnly";
import DataTable from "../components/DataTable";
import FormModal from "../components/FormModal";
import ConfirmModal from "../components/ConfirmModal";
import Field, { inputCss } from "../components/Field";
import { globalToast } from "../hooks/useGlobalToast";
import { formatDate } from "../utils/dateTime";

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

export default function WorkflowList() {
  const canBuild = useCanBuild();
  const queryClient = useQueryClient();

  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<Workflow | null>(null);
  const [deleting, setDeleting]   = useState<Workflow | null>(null);
  const [name, setName]           = useState("");
  const [description, setDescription] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["workflows"],
    queryFn: () => workflowsApi.list().then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => workflowsApi.create(name, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      globalToast("Workflow created");
      reset();
    },
    onError: () => globalToast("Failed to create workflow", "error"),
  });

  const updateMutation = useMutation({
    mutationFn: () => workflowsApi.update(editing!.workflow_id, name, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      globalToast("Workflow updated");
      reset();
    },
    onError: () => globalToast("Failed to update workflow", "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => workflowsApi.delete(deleting!.workflow_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      globalToast("Workflow deleted");
      setDeleting(null);
    },
    onError: () => globalToast("Failed to delete workflow", "error"),
  });

  function openCreate() {
    setEditing(null); setName(""); setDescription(""); setShowForm(true);
  }

  function openEdit(w: Workflow) {
    setEditing(w); setName(w.name); setDescription(w.description); setShowForm(true);
  }

  function reset() {
    setShowForm(false); setEditing(null); setName(""); setDescription("");
  }

  function handleSubmit() {
    if (!name.trim()) return;
    editing ? updateMutation.mutate() : createMutation.mutate();
  }

  const columns = [
    {
      key: "name", label: "Name",
      render: (w: Workflow) => (
        <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{w.name}</span>
      ),
    },
    {
      key: "desc", label: "Description",
      render: (w: Workflow) => (
        <span style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
          {w.description}
        </span>
      ),
    },
    {
      key: "date", label: "Created", width: "140px",
      render: (w: Workflow) => (
        <span style={{
          color: "var(--text-muted)", fontSize: "12px",
          fontFamily: "var(--font-mono)",
        }}>
          {formatDate(w.created_at)}
        </span>
      ),
    },
    {
      key: "action", label: "", width: "160px",
      render: (w: Workflow) => (
        <div style={{ display: "flex", gap: "6px" }}>
          {canBuild && <button onClick={() => openEdit(w)} style={editBtnStyle}>Edit</button>}
          {canBuild && <button onClick={() => setDeleting(w)} style={deleteBtnStyle}>Delete</button>}
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: "28px 32px" }}>
      <PageHeader
        title="Workflows"
        subtitle="Define the business processes your agents will execute"
        action={canBuild ? { label: "New workflow", onClick: openCreate } : undefined}
      />

      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        rowKey={w => w.workflow_id}
        emptyMessage="No workflows yet. Create your first one."
      />

      {showForm && (
        <FormModal
          title={editing ? "Edit workflow" : "New workflow"}
          onClose={reset}
          onSubmit={handleSubmit}
          submitLabel={editing ? "Save" : "Create"}
        >
          <Field label="Name">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. HR Onboarding Pipeline"
              style={inputCss}
            />
          </Field>
          <Field label="Description">
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What does this workflow do?"
              rows={3}
              style={{ ...inputCss, resize: "vertical" }}
            />
          </Field>
        </FormModal>
      )}

      {deleting && (
        <ConfirmModal
          title="Delete workflow"
          message={`Are you sure you want to delete "${deleting.name}"? This cannot be undone.`}
          onConfirm={() => deleteMutation.mutate()}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}