/**
 * usersAdmin.ts — Phase 2.4
 * =========================
 * Frontend API client for tenant-scoped user management.
 * All calls are auto-scoped to the caller's tenant by the backend (tenant comes
 * from the token, never the request) — the UI never sends a tenant_id.
 *
 * Place at: frontend/src/api/usersAdmin.ts
 */

import { api } from "./client";

export interface TenantUser {
  user_id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  org_unit_ids: string[];
  created_at?: string;
}

export interface InvitePayload {
  email: string;
  name: string;
  role: string;
  org_unit_ids?: string[];
}

export const usersAdminApi = {
  list:   ()                                  => api.get("/api/users"),
  invite: (body: InvitePayload)               => api.post("/api/users/invite", body),
  setRole:   (userId: string, role: string)   => api.patch(`/api/users/${userId}/role`, { role }),
  setStatus: (userId: string, status: string) => api.patch(`/api/users/${userId}/status`, { status }),
};
