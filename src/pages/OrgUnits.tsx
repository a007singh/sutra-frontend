import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orgUnitsApi } from "../api/orgUnits";
import type { OrgUnit } from "../api/orgUnits";
import { usersAdminApi } from "../api/usersAdmin";
import type { TenantUser } from "../api/usersAdmin";
import { useMe } from "../hooks/useMe";
import PageHeader from "../components/PageHeader";
import DataTable from "../components/DataTable";
import FormModal from "../components/FormModal";
import Field, { inputCss } from "../components/Field";
import { globalToast } from "../hooks/useGlobalToast";

/**
 * OrgUnits — approver groups (Finance / HR / Purchase / ...)
 * Create/rename/delete units and assign approvers to them. Once approvers are in
 * a unit, that unit can be tagged to an orchestrator (2.5a) for group-based
 * approval routing.
 *
 * Place at: frontend/src/pages/OrgUnits.tsx
 */

const chip = (active: boolean): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: "6px",
  padding: "5px 10px", borderRadius: "8px", fontSize: "12px", cursor: "pointer",
  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
  background: active ? "var(--accent-dim)" : "transparent",
  color: active ? "var(--accent)" : "var(--text-secondary)",
  fontFamily: "var(--font)", transition: "all 0.15s",
});

const actionBtn: React.CSSProperties = {
  padding: "5px 12px", borderRadius: "6px", fontSize: "12px",
  background: "transparent", border: "1px solid var(--border-hover)",
  color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)",
};

export default function OrgUnits() {
  const queryClient = useQueryClient();
  const { data: me } = useMe();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<OrgUnit | null>(null);
  const [name, setName] = useState("");
  const [unitType, setUnitType] = useState("");

  // Members modal
  const [membersFor, setMembersFor] = useState<OrgUnit | null>(null);

  const { data: units, isLoading } = useQuery({
    queryKey: ["org-units"],
    queryFn: () => orgUnitsApi.list().then(r => r.data as OrgUnit[]),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      if (editing) {
        return orgUnitsApi.update(editing.org_unit_id, { name: name.trim(), unit_type: unitType.trim() });
      }
      return orgUnitsApi.create({ name: name.trim(), unit_type: unitType.trim() });
    },
    onSuccess: () => {
      globalToast(editing ? "Group updated" : "Group created", "success");
      queryClient.invalidateQueries({ queryKey: ["org-units"] });
      closeForm();
    },
    onError: (e: any) => globalToast(e?.response?.data?.detail || "Failed to save", "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => orgUnitsApi.remove(id),
    onSuccess: () => {
      globalToast("Group deleted", "success");
      queryClient.invalidateQueries({ queryKey: ["org-units"] });
    },
    onError: (e: any) => globalToast(e?.response?.data?.detail || "Failed to delete", "error"),
  });

  const closeForm = () => { setShowForm(false); setEditing(null); setName(""); setUnitType(""); };
  const openCreate = () => { setEditing(null); setName(""); setUnitType(""); setShowForm(true); };
  const openEdit = (u: OrgUnit) => { setEditing(u); setName(u.name); setUnitType(u.unit_type || ""); setShowForm(true); };

  const columns = [
    {
      key: "name", label: "Group",
      render: (u: OrgUnit) => (
        <div>
          <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>{u.name}</div>
          {u.unit_type && <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{u.unit_type}</div>}
        </div>
      ),
    },
    {
      key: "member_count", label: "Members",
      render: (u: OrgUnit) => (
        <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
          {u.member_count} {u.member_count === 1 ? "member" : "members"}
        </span>
      ),
    },
    {
      key: "actions", label: "",
      render: (u: OrgUnit) => (
        <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
          <button onClick={() => setMembersFor(u)} style={actionBtn}>Members</button>
          <button onClick={() => openEdit(u)} style={actionBtn}>Rename</button>
          <button
            onClick={() => { if (confirm(`Delete "${u.name}"?`)) deleteMutation.mutate(u.org_unit_id); }}
            style={{ ...actionBtn, color: "var(--status-failed, #e5484d)" }}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Approver Groups"
        subtitle={me?.tenant_name ? `Org units in ${me.tenant_name}` : "Org units"}
        action={{ label: "New group", onClick: openCreate }}
      />

      <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "-8px", marginBottom: "16px" }}>
        Groups like Finance, HR, or Purchase. Assign approvers to a group, then tag
        the group to an orchestrator so its executions route to that group for approval.
      </p>

      <DataTable
        columns={columns}
        data={units || []}
        isLoading={isLoading}
        emptyMessage="No groups yet. Create one to enable group-based approval routing."
        rowKey={(u: OrgUnit) => u.org_unit_id}
      />

      {showForm && (
        <FormModal
          title={editing ? "Rename group" : "New group"}
          onClose={closeForm}
          onSubmit={() => {
            if (!name.trim()) { globalToast("Name is required", "error"); return; }
            saveMutation.mutate();
          }}
          submitLabel={saveMutation.isPending ? "Saving…" : (editing ? "Save" : "Create")}
        >
          <Field label="Name">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Finance" style={inputCss} autoFocus />
          </Field>
          <Field label="Type (optional)">
            <input value={unitType} onChange={e => setUnitType(e.target.value)} placeholder="e.g. Department" style={inputCss} />
          </Field>
        </FormModal>
      )}

      {membersFor && (
        <MembersModal
          unit={membersFor}
          onClose={() => { setMembersFor(null); queryClient.invalidateQueries({ queryKey: ["org-units"] }); }}
        />
      )}
    </div>
  );
}

/** Modal to assign approvers to a group. Shows tenant approvers as chips;
 *  toggling adds/removes this unit from each user's org_unit_ids. */
function MembersModal({ unit, onClose }: { unit: OrgUnit; onClose: () => void }) {
  const queryClient = useQueryClient();

  const { data: users } = useQuery({
    queryKey: ["tenant-users"],
    queryFn: () => usersAdminApi.list().then(r => r.data as TenantUser[]),
  });

  // Only approvers are meaningful for approval routing groups
  const approvers = (users || []).filter(u => (u.role || "").toUpperCase() === "APPROVER");

  const setUnits = useMutation({
    mutationFn: ({ userId, unitIds }: { userId: string; unitIds: string[] }) =>
      orgUnitsApi.setUserUnits(userId, unitIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-users"] });
    },
    onError: (e: any) => globalToast(e?.response?.data?.detail || "Failed to update", "error"),
  });

  const toggle = (u: TenantUser) => {
    const current = u.org_unit_ids || [];
    const inUnit = current.includes(unit.org_unit_id);
    const next = inUnit
      ? current.filter(id => id !== unit.org_unit_id)
      : [...current, unit.org_unit_id];
    setUnits.mutate({ userId: u.user_id, unitIds: next });
  };

  return (
    <FormModal
      title={`Members of ${unit.name}`}
      onClose={onClose}
      onSubmit={onClose}
      submitLabel="Done"
    >
      <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
        Tap an approver to add or remove them from this group.
      </p>
      {approvers.length === 0 ? (
        <div style={{ fontSize: "13px", color: "var(--text-muted)", fontStyle: "italic" }}>
          No approvers in this tenant yet. Invite approvers from the Users page first.
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {approvers.map(u => {
            const inUnit = (u.org_unit_ids || []).includes(unit.org_unit_id);
            return (
              <button key={u.user_id} onClick={() => toggle(u)} style={chip(inUnit)} title={u.email}>
                {u.name || u.email}
              </button>
            );
          })}
        </div>
      )}
    </FormModal>
  );
}
