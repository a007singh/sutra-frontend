import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { approverRoutingApi } from "../api/approverRouting";
import type { ApproverOption, OrgUnitOption } from "../api/approverRouting";
import { useCanBuild } from "./BuilderOnly";
import { useMe } from "../hooks/useMe";
import { globalToast } from "../hooks/useGlobalToast";

/**
 * ApproverRoutingSection — Phase 2.5a
 * ===================================
 * A self-contained panel (rendered inside the OrchestratorDrawer) for tagging
 * approvers and org-units to an orchestrator. OPERATOR/ADMIN only (gated by
 * useCanBuild + the backend require_role). Once tagged, FUTURE executions of
 * this orchestrator become visible to the named approvers / org-unit members.
 *
 * Place at: frontend/src/components/ApproverRoutingSection.tsx
 */

const chip = (active: boolean): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: "6px",
  padding: "5px 10px", borderRadius: "8px", fontSize: "12px", cursor: "pointer",
  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
  background: active ? "var(--accent-dim)" : "transparent",
  color: active ? "var(--accent)" : "var(--text-secondary)",
  fontFamily: "var(--font)", transition: "all 0.15s",
});

export default function ApproverRoutingSection({ orchId }: { orchId: string }) {
  const { data: me } = useMe();
  // Approver-routing is governance the client owns, so operator/admin AND
  // client_admin can edit it (client_admin is scoped to own-tenant orchestrators
  // server-side). This does NOT grant orchestrator config editing.
  const canEdit = useCanBuild() || me?.role === "CLIENT_ADMIN";
  const canView = canEdit;
  const queryClient = useQueryClient();

  const [userIds, setUserIds] = useState<string[]>([]);
  const [orgUnitIds, setOrgUnitIds] = useState<string[]>([]);
  const [seeded, setSeeded] = useState(false);

  const { data: routing } = useQuery({
    queryKey: ["approver-routing", orchId],
    queryFn: () => approverRoutingApi.get(orchId).then(r => r.data),
    enabled: !!orchId,
  });
  const { data: approvers } = useQuery({
    queryKey: ["tenant-approvers"],
    queryFn: () => approverRoutingApi.listApprovers().then(r => r.data as ApproverOption[]),
  });
  const { data: orgUnits } = useQuery({
    queryKey: ["tenant-org-units"],
    queryFn: () => approverRoutingApi.listOrgUnits().then(r => r.data as OrgUnitOption[]),
  });

  // Seed local selection from server ONCE, on first load only. We deliberately
  // do NOT re-seed on later refetches, otherwise the refetch triggered after a
  // save would overwrite the user's current selection.
  useEffect(() => {
    if (routing && !seeded) {
      setUserIds(routing.user_ids || []);
      setOrgUnitIds(routing.org_unit_ids || []);
      setSeeded(true);
    }
  }, [routing, seeded]);

  const saveMutation = useMutation({
    mutationFn: () => approverRoutingApi.set(orchId, { user_ids: userIds, org_unit_ids: orgUnitIds }),
    onSuccess: (res) => {
      globalToast("Approver routing saved", "success");
      // Trust the response as authoritative; update local state from it so the
      // UI reflects exactly what was persisted (no refetch race).
      const saved = res?.data || {};
      setUserIds(saved.user_ids || userIds);
      setOrgUnitIds(saved.org_unit_ids || orgUnitIds);
      // Update the cached query too, without a refetch.
      queryClient.setQueryData(["approver-routing", orchId], {
        user_ids: saved.user_ids || userIds,
        org_unit_ids: saved.org_unit_ids || orgUnitIds,
      });
    },
    onError: (e: any) =>
      globalToast(e?.response?.data?.detail || "Failed to save routing", "error"),
  });

  if (!canView) return null; // operator/admin (edit) or client_admin (read-only)

  const toggleUser = (id: string) => {
    if (!canEdit) return;
    setUserIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleUnit = (id: string) => {
    if (!canEdit) return;
    setOrgUnitIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const hasApprovers = (approvers || []).length > 0;
  const hasUnits = (orgUnits || []).length > 0;
  const nothingTagged = userIds.length === 0 && orgUnitIds.length === 0;

  return (
    <div style={{
      marginTop: "16px", padding: "14px",
      border: "1px solid var(--border)", borderRadius: "10px",
      background: "var(--surface, rgba(128,128,128,0.04))",
    }}>
      <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
        Approvers
      </div>
      <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
        Tag approvers or org-units. Future executions of this orchestrator become
        visible to them for review and approval. Existing executions are unaffected.
      </p>


      {/* Individual approvers */}
      <div style={{ marginBottom: "12px" }}>
        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px", letterSpacing: "0.5px", fontWeight: 600 }}>
          INDIVIDUAL APPROVERS
        </div>
        {hasApprovers ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {approvers!.filter(a => canEdit || userIds.includes(a.user_id)).map(a => (
              <button key={a.user_id} onClick={() => toggleUser(a.user_id)}
                style={{ ...chip(userIds.includes(a.user_id)), cursor: canEdit ? "pointer" : "default" }}
                title={a.email}>
                {a.name || a.email}
              </button>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>
            No approvers in this tenant yet. Invite approvers from the Users page.
          </div>
        )}
      </div>

      {/* Org-unit approvers */}
      <div style={{ marginBottom: "14px" }}>
        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px", letterSpacing: "0.5px", fontWeight: 600 }}>
          APPROVER GROUPS (ORG UNITS)
        </div>
        {hasUnits ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {orgUnits!.filter(u => canEdit || orgUnitIds.includes(u.org_unit_id)).map(u => (
              <button key={u.org_unit_id} onClick={() => toggleUnit(u.org_unit_id)}
                style={{ ...chip(orgUnitIds.includes(u.org_unit_id)), cursor: canEdit ? "pointer" : "default" }}
                title={u.unit_type || ""}>
                {u.name}
              </button>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>
            No org units defined in this tenant.
          </div>
        )}
      </div>

      {canEdit && <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          style={{
            padding: "7px 16px", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
            border: "none", background: "var(--accent)", color: "#fff",
            cursor: saveMutation.isPending ? "default" : "pointer", fontFamily: "var(--font)",
            opacity: saveMutation.isPending ? 0.7 : 1,
          }}
        >
          {saveMutation.isPending ? "Saving…" : "Save routing"}
        </button>
        {nothingTagged && (
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            Nothing tagged — no approver will see this orchestrator's runs.
          </span>
        )}
      </div>}
    </div>
  );
}
