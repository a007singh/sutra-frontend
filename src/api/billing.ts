/**
 * billing.ts — Phase 1B
 * =====================
 * Client for the per-tenant billing/usage aggregation.
 * Place at: frontend/src/api/billing.ts
 */

import { api } from "./client";

export interface UsageBucketTotals {
  executions: number;
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  completed: number;
  failed: number;
  running: number;
  waiting: number;
  avg_cost_usd: number;
  success_rate: number;
  active_tenants: number;
}

export interface TenantUsage {
  tenant_id: string;
  tenant_name: string;
  executions: number;
  cost_usd: number;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  completed: number;
  failed: number;
  running: number;
  waiting: number;
  avg_cost_usd: number;
  success_rate: number;
  billable: number | null;
  margin: number | null;
  margin_pct: number | null;
  billing_model: string | null;
  billing_rate: number | null;
  setup_fee?: number | null;
  monthly_retainer?: number | null;
  included_runs?: number | null;
  overage_runs?: number | null;
  value_delivered?: number | null;
}

export interface OrchUsage {
  orchestrator_id: string;
  orchestrator_name: string;
  executions: number;
  cost_usd: number;
  total_tokens: number;
  avg_cost_usd: number;
  success_rate: number;
}

export interface TrendPoint {
  date: string;
  executions: number;
  cost_usd: number;
  total_tokens: number;
}

export interface UsageResponse {
  scope: "platform" | "tenant";
  range: string;
  tenant_id: string | null;
  tenant_name: string | null;
  generated_at: string;
  totals: UsageBucketTotals;
  tenants: TenantUsage[];
  orchestrators: OrchUsage[];
  trend: TrendPoint[];
  selected_tenant: string | null;
}

export interface BillingConfig {
  model: string;
  rate: number;
  monthly_fee: number;
  currency: string;
  setup_fee?: number;
  monthly_retainer?: number;
  included_runs?: number;
  overage_rate?: number;
  value_per_run?: number;
}

export const billingApi = {
  usage: (range: string, tenant?: string | null) =>
    api.get(`/api/billing/usage?range=${range}${tenant ? `&tenant=${encodeURIComponent(tenant)}` : ""}`),
  getConfig: (tenantId: string) =>
    api.get(`/api/billing/config/${tenantId}`),
  setConfig: (tenantId: string, cfg: Partial<BillingConfig>) =>
    api.put(`/api/billing/config/${tenantId}`, cfg),
};
