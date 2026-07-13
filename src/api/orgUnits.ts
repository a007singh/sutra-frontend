/**
 * orgUnits.ts — Org-units UI
 * ==========================
 * Tenant-scoped org-unit CRUD (approver groups) + assigning users to units.
 * Backend scopes everything to the caller's tenant.
 *
 * Place at: frontend/src/api/orgUnits.ts
 */

import { api } from "./client";

export interface OrgUnit {
  org_unit_id: string;
  name: string;
  unit_type: string;
  parent_unit_id: string | null;
  member_count: number;
  created_at?: string;
}

export interface OrgUnitCreate {
  name: string;
  unit_type?: string;
  parent_unit_id?: string | null;
}

export const orgUnitsApi = {
  list:   ()                              => api.get("/api/org-units"),
  create: (body: OrgUnitCreate)           => api.post("/api/org-units", body),
  update: (id: string, body: Partial<OrgUnitCreate> & { clear_parent?: boolean }) =>
    api.patch(`/api/org-units/${id}`, body),
  remove: (id: string)                    => api.delete(`/api/org-units/${id}`),
  // assign a user (approver) to org units
  setUserUnits: (userId: string, orgUnitIds: string[]) =>
    api.patch(`/api/users/${userId}/org-units`, { org_unit_ids: orgUnitIds }),
};
