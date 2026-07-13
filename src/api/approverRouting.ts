/**
 * approverRouting.ts — Phase 2.5a
 * ===============================
 * API client for tagging approvers/org-units to an orchestrator, and for
 * listing the tenant's approvers and org-units.
 *
 * Place at: frontend/src/api/approverRouting.ts
 */

import { api } from "./client";

export interface Routing {
  user_ids: string[];
  org_unit_ids: string[];
}

export interface ApproverOption {
  user_id: string;
  email: string;
  name: string;
}

export interface OrgUnitOption {
  org_unit_id: string;
  name: string;
  unit_type?: string;
}

export const approverRoutingApi = {
  get:  (orchId: string) =>
    api.get(`/api/orchestrators/${orchId}/approver-routing`),
  set:  (orchId: string, routing: Routing) =>
    api.put(`/api/orchestrators/${orchId}/approver-routing`, routing),
  listApprovers: () => api.get("/api/tenant/approvers"),
  listOrgUnits:  () => api.get("/api/tenant/org-units"),
};
