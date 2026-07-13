import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersAdminApi } from "../api/usersAdmin";
import type { TenantUser } from "../api/usersAdmin";
import { useMe } from "../hooks/useMe";
import PageHeader from "../components/PageHeader";
import DataTable from "../components/DataTable";
import FormModal from "../components/FormModal";
import Field, { inputCss } from "../components/Field";
import { globalToast } from "../hooks/useGlobalToast";
import { formatDate } from "../utils/dateTime";

// Roles a CLIENT_ADMIN may assign. OPERATOR/ADMIN additionally see platform roles.
const CLIENT_ROLES = ["CLIENT_ADMIN", "APPROVER", "VIEWER", "AUDITOR"];
const PLATFORM_ROLES = ["OPERATOR", "ADMIN"];

const roleLabel = (r: string) =>
  r.split("_").map(w => w[0] + w.slice(1).toLowerCase()).join(" ");

const pillStyle = (color: string, dim: string): React.CSSProperties => ({
  display: "inline-block", padding: "2px 9px", borderRadius: "11px",
  fontSize: "11px", fontWeight: 600, color, background: dim,
});

const actionBtn: React.CSSProperties = {
  padding: "5px 12px", borderRadius: "6px", fontSize: "12px",
  background: "transparent", border: "1px solid var(--border-hover)",
  color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)",
};

export default function UserManagement() {
  const queryClient = useQueryClient();
  const { data: me } = useMe();

  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName]   = useState("");
  const [role, setRole]   = useState("APPROVER");

  // Operators/admins may also assign platform roles; client_admin only client roles.
  const isPlatform = me?.role === "OPERATOR" || me?.role === "ADMIN";
  const assignableRoles = isPlatform ? [...CLIENT_ROLES, ...PLATFORM_ROLES] : CLIENT_ROLES;

  const { data, isLoading } = useQuery({
    queryKey: ["tenant-users"],
    queryFn: () => usersAdminApi.list().then(r => r.data as TenantUser[]),
  });

  const inviteMutation = useMutation({
    mutationFn: () => usersAdminApi.invite({ email: email.trim(), name: name.trim(), role }),
    onSuccess: () => {
      globalToast("Invitation sent", "success");
      queryClient.invalidateQueries({ queryKey: ["tenant-users"] });
      setShowInvite(false); setEmail(""); setName(""); setRole("APPROVER");
    },
    onError: (e: any) =>
      globalToast(e?.response?.data?.detail || "Failed to invite user", "error"),
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, newRole }: { userId: string; newRole: string }) =>
      usersAdminApi.setRole(userId, newRole),
    onSuccess: () => {
      globalToast("Role updated", "success");
      queryClient.invalidateQueries({ queryKey: ["tenant-users"] });
    },
    onError: (e: any) =>
      globalToast(e?.response?.data?.detail || "Failed to update role", "error"),
  });

  const statusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: string }) =>
      usersAdminApi.setStatus(userId, status),
    onSuccess: () => {
      globalToast("Status updated", "success");
      queryClient.invalidateQueries({ queryKey: ["tenant-users"] });
    },
    onError: (e: any) =>
      globalToast(e?.response?.data?.detail || "Failed to update status", "error"),
  });

  const columns = [
    {
      key: "name", label: "User",
      render: (u: TenantUser) => (
        <div>
          <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>{u.name || "—"}</div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{u.email}</div>
        </div>
      ),
    },
    {
      key: "role", label: "Role",
      render: (u: TenantUser) => {
        const isPlat = PLATFORM_ROLES.includes(u.role);
        return <span style={pillStyle(
          isPlat ? "var(--accent)" : "var(--text-secondary)",
          isPlat ? "var(--accent-dim)" : "rgba(128,128,128,0.12)",
        )}>{roleLabel(u.role)}</span>;
      },
    },
    {
      key: "status", label: "Status",
      render: (u: TenantUser) => {
        const active = (u.status || "ACTIVE") === "ACTIVE";
        const invited = u.status === "INVITED";
        const color = active ? "var(--status-success, #2ecc71)" : invited ? "var(--accent)" : "var(--text-muted)";
        const dim   = active ? "rgba(46,204,113,0.12)" : invited ? "var(--accent-dim)" : "rgba(128,128,128,0.12)";
        return <span style={pillStyle(color, dim)}>{u.status || "ACTIVE"}</span>;
      },
    },
    {
      key: "created_at", label: "Added",
      render: (u: TenantUser) => (
        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
          {u.created_at ? formatDate(u.created_at) : "—"}
        </span>
      ),
    },
    {
      key: "actions", label: "",
      render: (u: TenantUser) => {
        const isSelf = u.user_id === me?.user_id;
        const active = (u.status || "ACTIVE") === "ACTIVE";
        const targetIsPlatform = PLATFORM_ROLES.includes(u.role);
        // A client_admin may VIEW operators (read-only) but not modify them.
        const readOnlyRow = !isPlatform && targetIsPlatform;
        // Self rows are also non-actionable (no self role change / self disable).
        if (readOnlyRow || isSelf) {
          return (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic" }}>
                {readOnlyRow ? "Sutra-managed" : "You"}
              </span>
            </div>
          );
        }
        return (
          <div style={{ display: "flex", gap: "6px", alignItems: "center", justifyContent: "flex-end" }}>
            <select
              value={u.role}
              onChange={e => roleMutation.mutate({ userId: u.user_id, newRole: e.target.value })}
              style={{ ...inputCss, padding: "5px 8px", fontSize: "12px", width: "auto" }}
              title="Change role"
            >
              {/* Offer only roles this caller may assign; include current role if client. */}
              {Array.from(new Set([
                ...(PLATFORM_ROLES.includes(u.role) && isPlatform ? [u.role] : []),
                ...assignableRoles,
                ...(!PLATFORM_ROLES.includes(u.role) ? [u.role] : []),
              ])).map(r => (
                <option key={r} value={r}>{roleLabel(r)}</option>
              ))}
            </select>
            <button
              onClick={() => statusMutation.mutate({
                userId: u.user_id, status: active ? "DISABLED" : "ACTIVE",
              })}
              style={actionBtn}
              title={active ? "Disable user" : "Enable user"}
            >
              {active ? "Disable" : "Enable"}
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle={me?.tenant_name ? `Manage users in ${me.tenant_name}` : "Manage users"}
        action={{ label: "Invite user", onClick: () => setShowInvite(true) }}
      />

      <DataTable
        columns={columns}
        data={data || []}
        isLoading={isLoading}
        emptyMessage="No users yet. Invite your first team member."
        rowKey={(u: TenantUser) => u.user_id}
      />

      {showInvite && (
        <FormModal
          title="Invite user"
          onClose={() => setShowInvite(false)}
          onSubmit={() => {
            if (!email.trim() || !email.includes("@")) { globalToast("Enter a valid email", "error"); return; }
            if (!name.trim()) { globalToast("Enter a name", "error"); return; }
            inviteMutation.mutate();
          }}
          submitLabel={inviteMutation.isPending ? "Sending…" : "Send invite"}
        >
          <Field label="Email">
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="person@company.com" style={inputCss} autoFocus
            />
          </Field>
          <Field label="Name">
            <input
              value={name} onChange={e => setName(e.target.value)}
              placeholder="Full name" style={inputCss}
            />
          </Field>
          <Field label="Role">
            <select value={role} onChange={e => setRole(e.target.value)} style={inputCss}>
              {assignableRoles.map(r => (
                <option key={r} value={r}>{roleLabel(r)}</option>
              ))}
            </select>
          </Field>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
            They'll receive an email invitation to set a password and configure MFA.
          </p>
        </FormModal>
      )}
    </div>
  );
}
