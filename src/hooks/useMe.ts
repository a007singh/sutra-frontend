/**
 * useMe.ts — Phase 2.3 Step D1
 * ===========================
 * Fetches the logged-in user's identity + tenant context from /api/me.
 * Drives the tenant indicator in the header and (later) role-based UI gating.
 *
 * Place at: frontend/src/hooks/useMe.ts
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

export interface MeInfo {
  user_id: string;
  email: string;
  tenant_id: string;
  tenant_name: string;
  role: string;
  is_operator: boolean;
  org_unit_ids: string[];
}

export function useMe() {
  return useQuery<MeInfo>({
    queryKey: ["me"],
    queryFn: () => api.get("/api/me").then((r) => r.data),
    staleTime: 0,              // always revalidate — identity must never be stale across logins
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: false,
    gcTime: 0,                 // don't keep cached identity after unmount
  });
}
