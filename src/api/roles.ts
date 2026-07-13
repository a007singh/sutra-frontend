/**
 * roles.ts — Phase 2.3 Step E
 * ==========================
 * Centralized role predicates for frontend UI gating.
 *
 * IMPORTANT: This is UX only, NOT security. Hiding a button does not stop an
 * API call — the backend Step C role checks (require_role) are the real lock.
 * This module just keeps the UI clean by not showing controls a user can't use.
 *
 * Place at: frontend/src/api/roles.ts
 */

import type { MeInfo } from "../hooks/useMe";

// Roles that build/edit platform config (orchestrators, agents, workflows,
// triggers, MCP, settings). Per the service model: Sutra team only.
const BUILDER_ROLES = ["OPERATOR", "ADMIN"];

/** Can this user create/edit/delete platform config + see ops features? */
export function canBuild(me?: MeInfo | null): boolean {
  if (!me) return false;
  return BUILDER_ROLES.includes(me.role);
}

/** Can this user see operator-only features (MCP servers, Settings)? */
export function canSeeOps(me?: MeInfo | null): boolean {
  return canBuild(me); // same set for now — operators/admins only
}

/** Is this user a client-side role (not Sutra team)? */
export function isClientRole(me?: MeInfo | null): boolean {
  if (!me) return false;
  return !BUILDER_ROLES.includes(me.role);
}

/** Can this user manage users in their tenant (invite/assign roles)? */
export function canManageUsers(me?: MeInfo | null): boolean {
  if (!me) return false;
  // Sutra team OR a client's own admin
  return ["OPERATOR", "ADMIN", "CLIENT_ADMIN"].includes(me.role);
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2.5b — role-based experience differentiation
// ─────────────────────────────────────────────────────────────────────────────

/** Roles that may PROMPT / run / continue conversations (act on executions).
 *  Viewer and Auditor are strictly read-only. Approver can prompt on their
 *  routed conversations (enforced per-conversation server-side). */
export function canPrompt(me?: MeInfo | null): boolean {
  if (!me) return false;
  return ["OPERATOR", "ADMIN", "CLIENT_ADMIN", "APPROVER"].includes(me.role);
}

/** Approver-specific: may approve/reject HITL decisions. */
export function isApprover(me?: MeInfo | null): boolean {
  return (me?.role || "") === "APPROVER";
}

/** Auditor: read-only, compliance-focused (sees the audit log). */
export function isAuditor(me?: MeInfo | null): boolean {
  return (me?.role || "") === "AUDITOR";
}

/** Viewer: read-only stakeholder. */
export function isViewer(me?: MeInfo | null): boolean {
  return (me?.role || "") === "VIEWER";
}

/** Can this user see the audit log (operators, client_admin, auditor)? */
export function canSeeAudit(me?: MeInfo | null): boolean {
  if (!me) return false;
  return ["OPERATOR", "ADMIN", "CLIENT_ADMIN", "AUDITOR"].includes(me.role);
}

/** Can this user see the Build section (Workflows/Sub-agents/Orchestrators/
 *  Triggers)? Client roles see them read-only via Step E gating; but pure
 *  viewer/auditor/approver don't need the Build nav at all. */
export function canSeeBuild(me?: MeInfo | null): boolean {
  if (!me) return false;
  // Operators/admins build; client_admin sees build (read-only config visibility).
  return ["OPERATOR", "ADMIN", "CLIENT_ADMIN"].includes(me.role);
}

/** The page a user should land on after login, by role. */
export function landingPage(me?: MeInfo | null): string {
  const role = me?.role || "";
  switch (role) {
    case "APPROVER": return "approvals";  // their pending-approval queue (chat still available)
    case "AUDITOR":  return "dashboard";  // Dashboard already has cost/budget/governance/audit-log
    case "VIEWER":   return "dashboard";  // read-only overview
    default:         return "dashboard";  // operator/admin/client_admin
  }
}


/** Can this user see the Approvals queue? Approvers (their routed items) plus
 *  operators/client_admins (oversight of their tenant's pending approvals). */
export function canSeeApprovals(me?: MeInfo | null): boolean {
  if (!me) return false;
  // Approvers (their queue) + client_admin (oversight of their tenant's
  // approvals). NOT operators/admins — approval is a client-side responsibility.
  return ["CLIENT_ADMIN", "APPROVER"].includes(me.role);
}


/** Can pause/resume triggers? Operators/admins (any) + client_admin (own
 *  tenant). This is operational control, distinct from editing trigger config
 *  (which stays operator/admin only). */
export function canToggleTriggers(me?: MeInfo | null): boolean {
  if (!me) return false;
  return ["OPERATOR", "ADMIN", "CLIENT_ADMIN"].includes(me.role);
}


/** Can this user see the Usage & Billing dashboard? Operators/admins (cross-
 *  tenant commercial view) and client_admin (their own tenant's usage). */
export function canSeeBilling(me?: MeInfo | null): boolean {
  if (!me) return false;
  return ["OPERATOR", "ADMIN", "CLIENT_ADMIN"].includes(me.role);
}
