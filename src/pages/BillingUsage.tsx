import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { billingApi } from "../api/billing";
import type { UsageResponse, BillingConfig } from "../api/billing";
import { useMe } from "../hooks/useMe";
import { globalToast } from "../hooks/useGlobalToast";

const RANGES = [
  { key: "7d", label: "7 days" }, { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" }, { key: "all", label: "All time" },
];

const MODELS = [
  { key: "plan", label: "Plan (setup + retainer + overage)" },
  { key: "per_execution", label: "Per execution ($/run)" },
  { key: "markup", label: "Cost-plus markup (x)" },
  { key: "flat", label: "Flat monthly fee" },
  { key: "flat_plus_usage", label: "Flat fee + per-run" },
];

const fmtUsd = (n: number) => "$" + (n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtUsd4 = (n: number) => "$" + (n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const fmtNum = (n: number) => (n || 0).toLocaleString();
const fmtTokens = (n: number) => {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n || 0);
};

const card: React.CSSProperties = {
  background: "var(--bg-surface)", border: "1px solid var(--border)",
  borderRadius: "12px", padding: "18px 20px",
};

function modelLabel(model: string, rate: number | null): string {
  const r = rate ?? 0;
  switch (model) {
    case "per_execution": return `${fmtUsd(r)}/run`;
    case "markup": return `${r}x markup`;
    case "flat": return `flat fee`;
    case "flat_plus_usage": return `flat + ${fmtUsd(r)}/run`;
    case "plan": return "Plan";
    default: return model;
  }
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div style={{ ...card, borderColor: accent ? "rgba(0,200,150,0.25)" : "var(--border)" }}>
      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px" }}>{label}</div>
      <div style={{ fontSize: "26px", fontWeight: 600, color: accent ? "var(--accent)" : "var(--text-primary)", letterSpacing: "-0.5px" }}>{value}</div>
      {sub && <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>{sub}</div>}
    </div>
  );
}

function TrendChart({ data }: { data: { date: string; cost_usd: number }[] }) {
  if (!data.length) return <div style={{ color: "var(--text-muted)", fontSize: "13px", padding: "30px", textAlign: "center" }}>No data in this range</div>;
  const W = 720, H = 200, pad = { l: 48, r: 16, t: 16, b: 28 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const maxCost = Math.max(...data.map(d => d.cost_usd), 0.0001);
  const n = data.length;
  const x = (i: number) => pad.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (c: number) => pad.t + ih - (c / maxCost) * ih;
  const linePts = data.map((d, i) => `${x(i)},${y(d.cost_usd)}`).join(" ");
  const areaPts = `${pad.l},${pad.t + ih} ${linePts} ${x(n - 1)},${pad.t + ih}`;
  const labelIdx = n <= 3 ? data.map((_, i) => i) : [0, Math.floor(n / 2), n - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
        const gy = pad.t + ih - f * ih;
        return (
          <g key={i}>
            <line x1={pad.l} y1={gy} x2={W - pad.r} y2={gy} stroke="var(--border)" strokeWidth="1" opacity="0.4" />
            <text x={pad.l - 8} y={gy + 3} textAnchor="end" fontSize="10" fill="var(--text-muted)">{fmtUsd(maxCost * f)}</text>
          </g>
        );
      })}
      <polygon points={areaPts} fill="var(--accent)" opacity="0.10" />
      <polyline points={linePts} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => <circle key={i} cx={x(i)} cy={y(d.cost_usd)} r="2.5" fill="var(--accent)" />)}
      {labelIdx.map(i => <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--text-muted)">{data[i].date.slice(5)}</text>)}
    </svg>
  );
}

function CostBar({ label, cost, execs, max, sub }: { label: string; cost: number; execs: number; max: number; sub?: string }) {
  const pct = max > 0 ? (cost / max) * 100 : 0;
  return (
    <div style={{ marginBottom: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
        <span style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>{label}</span>
        <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{fmtUsd4(cost)} <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>&middot; {fmtNum(execs)} runs</span></span>
      </div>
      <div style={{ height: "7px", background: "var(--bg-overlay, rgba(128,128,128,0.15))", borderRadius: "4px", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "var(--accent)", borderRadius: "4px", transition: "width 0.4s" }} />
      </div>
      {sub && <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "3px" }}>{sub}</div>}
    </div>
  );
}

function PricingModal({ tenantId, tenantName, runsUsed, onClose }: { tenantId: string; tenantName: string; runsUsed: number; onClose: () => void }) {
  const { data: cfg, isLoading } = useQuery({
    queryKey: ["billing-config", tenantId],
    queryFn: () => billingApi.getConfig(tenantId).then(r => r.data as BillingConfig),
  });
  const [model, setModel] = useState<string>("");
  const [rate, setRate] = useState<string>("");
  const [fee, setFee] = useState<string>("");
  const [setup, setSetup] = useState<string>("");
  const [retainer, setRetainer] = useState<string>("");
  const [included, setIncluded] = useState<string>("");
  const [overage, setOverage] = useState<string>("");
  const [valuePerRun, setValuePerRun] = useState<string>("");
  const [seeded, setSeeded] = useState(false);

  if (cfg && !seeded) {
    setSeeded(true);
    setModel(cfg.model);
    setRate(String(cfg.rate ?? ""));
    setFee(String(cfg.monthly_fee ?? ""));
    setSetup(String(cfg.setup_fee ?? ""));
    setRetainer(String(cfg.monthly_retainer ?? ""));
    setIncluded(String(cfg.included_runs ?? ""));
    setOverage(String(cfg.overage_rate ?? ""));
    setValuePerRun(String(cfg.value_per_run ?? ""));
  }

  const save = useMutation({
    mutationFn: () => billingApi.setConfig(tenantId, {
      model,
      rate: parseFloat(rate) || 0,
      monthly_fee: parseFloat(fee) || 0,
      setup_fee: parseFloat(setup) || 0,
      monthly_retainer: parseFloat(retainer) || 0,
      included_runs: parseInt(included) || 0,
      overage_rate: parseFloat(overage) || 0,
      value_per_run: parseFloat(valuePerRun) || 0,
    }),
    onSuccess: () => { globalToast("Pricing updated", "success"); onClose(); },
    onError: (e: any) => globalToast(e?.response?.data?.detail || "Failed to save", "error"),
  });

  const usesRate = model === "per_execution" || model === "markup" || model === "flat_plus_usage";
  const usesFee = model === "flat" || model === "flat_plus_usage";
  const isPlan = model === "plan";
  const inputCss: React.CSSProperties = { width: "100%", padding: "9px 11px", borderRadius: "8px", background: "var(--bg-elevated)", border: "1px solid var(--border-hover)", color: "var(--text-primary)", fontFamily: "var(--font)", fontSize: "13px" };
  const lbl: React.CSSProperties = { fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "5px" };

  // Live plan preview (this month)
  const nRetainer = parseFloat(retainer) || 0;
  const nIncluded = parseInt(included) || 0;
  const nOverage = parseFloat(overage) || 0;
  const nValue = parseFloat(valuePerRun) || 0;
  const overageRuns = Math.max(0, runsUsed - nIncluded);
  const monthlyBill = nRetainer + overageRuns * nOverage;
  const valueDelivered = nValue * runsUsed;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "24px", width: "460px", maxWidth: "92vw", maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>Pricing &mdash; {tenantName}</div>
        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "18px" }}>How this client is billed. Cost basis stays the raw AWS number; this sets what they pay.</div>
        {isLoading ? <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>Loading...</div> : (
          <>
            <label style={lbl}>Billing model</label>
            <select value={model} onChange={e => setModel(e.target.value)} style={{ ...inputCss, marginBottom: "14px", cursor: "pointer" }}>
              {MODELS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>

            {isPlan && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div><label style={lbl}>Setup fee (one-time $)</label>
                    <input type="number" step="100" value={setup} onChange={e => setSetup(e.target.value)} style={inputCss} placeholder="15000" /></div>
                  <div><label style={lbl}>Monthly retainer ($)</label>
                    <input type="number" step="100" value={retainer} onChange={e => setRetainer(e.target.value)} style={inputCss} placeholder="8000" /></div>
                  <div><label style={lbl}>Included runs / mo</label>
                    <input type="number" step="100" value={included} onChange={e => setIncluded(e.target.value)} style={inputCss} placeholder="2000" /></div>
                  <div><label style={lbl}>Overage ($/run)</label>
                    <input type="number" step="0.01" value={overage} onChange={e => setOverage(e.target.value)} style={inputCss} placeholder="2.00" /></div>
                </div>
                <div style={{ marginTop: "12px" }}>
                  <label style={lbl}>Value per run ($ saved — optional, for the value story)</label>
                  <input type="number" step="0.01" value={valuePerRun} onChange={e => setValuePerRun(e.target.value)} style={inputCss} placeholder="18.00" />
                </div>

                {/* Live preview — what both sides see */}
                <div style={{ marginTop: "16px", padding: "14px", borderRadius: "10px", background: "var(--accent-dim)", border: "1px solid rgba(0,200,150,0.25)" }}>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px" }}>This month ({runsUsed.toLocaleString()} runs used)</div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Retainer</span><span style={{ color: "var(--text-primary)" }}>{fmtUsd(nRetainer)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Overage ({overageRuns.toLocaleString()} runs &times; {fmtUsd(nOverage)})</span><span style={{ color: "var(--text-primary)" }}>{fmtUsd(overageRuns * nOverage)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", fontWeight: 600, paddingTop: "6px", borderTop: "1px solid rgba(0,200,150,0.2)", marginTop: "4px" }}>
                    <span style={{ color: "var(--text-primary)" }}>Monthly bill</span><span style={{ color: "var(--accent)" }}>{fmtUsd(monthlyBill)}</span>
                  </div>
                  {nValue > 0 && (
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px", paddingTop: "8px", borderTop: "1px solid rgba(0,200,150,0.2)" }}>
                      Value delivered: <span style={{ color: "var(--accent)", fontWeight: 600 }}>{fmtUsd(valueDelivered)}</span> ({runsUsed.toLocaleString()} &times; {fmtUsd(nValue)}) &mdash; billed {fmtUsd(monthlyBill)}
                    </div>
                  )}
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "8px" }}>
                    + {fmtUsd(parseFloat(setup) || 0)} one-time setup
                  </div>
                </div>
              </>
            )}

            {usesRate && (
              <div style={{ marginBottom: "14px" }}>
                <label style={lbl}>{model === "markup" ? "Markup multiplier (e.g. 4 = 4x)" : "Rate ($ per execution)"}</label>
                <input type="number" step="0.01" value={rate} onChange={e => setRate(e.target.value)} style={inputCss} />
              </div>
            )}
            {usesFee && (
              <div style={{ marginBottom: "14px" }}>
                <label style={lbl}>Monthly fee ($)</label>
                <input type="number" step="1" value={fee} onChange={e => setFee(e.target.value)} style={inputCss} />
              </div>
            )}

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "18px" }}>
              <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "13px", background: "transparent", border: "1px solid var(--border-hover)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)" }}>Cancel</button>
              <button onClick={() => save.mutate()} disabled={save.isPending} style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, background: "var(--accent)", border: "none", color: "#0A0B0F", cursor: "pointer", fontFamily: "var(--font)" }}>
                {save.isPending ? "Saving..." : "Save pricing"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function BillingUsage() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const [range, setRange] = useState("30d");
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [configFor, setConfigFor] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["billing-usage", range, selectedTenant],
    queryFn: () => billingApi.usage(range, selectedTenant || null).then(r => r.data as UsageResponse),
  });

  const isPlatform = data?.scope === "platform";
  const t = data?.totals;
  const maxOrchCost = Math.max(...(data?.orchestrators || []).map(o => o.cost_usd), 0.0001);
  const tenantOptions = (data?.tenants || []);
  const totalBillable = tenantOptions.reduce((s, x) => s + (x.billable || 0), 0);
  const totalMargin = tenantOptions.reduce((s, x) => s + (x.margin || 0), 0);
  const totalAws = tenantOptions.reduce((s, x) => s + (x.cost_usd || 0), 0);
  const blendedMarginPct = totalBillable > 0 ? (totalMargin / totalBillable) * 100 : 0;
  const selName = selectedTenant ? (tenantOptions.find(x => x.tenant_id === selectedTenant)?.tenant_name || "Client") : "All Accounts";
  const selTn = selectedTenant ? tenantOptions.find(x => x.tenant_id === selectedTenant) : undefined;

  return (
    <div style={{ maxWidth: "1080px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "6px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Usage &amp; Billing</h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0" }}>
            {isPlatform ? `${selName} — usage, cost basis, and margin.` : `Your organization's usage and cost${data?.tenant_name ? ` — ${data.tenant_name}` : ""}.`}
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          {isPlatform && (
            <select value={selectedTenant} onChange={e => setSelectedTenant(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: "9px", fontSize: "13px", background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)", fontFamily: "var(--font)", cursor: "pointer" }}>
              <option value="">All Accounts</option>
              {tenantOptions.map(tn => <option key={tn.tenant_id} value={tn.tenant_id}>{tn.tenant_name} — {fmtUsd(tn.cost_usd)}</option>)}
            </select>
          )}
          <div style={{ display: "flex", gap: "4px", background: "var(--bg-surface)", padding: "4px", borderRadius: "10px", border: "1px solid var(--border)" }}>
            {RANGES.map(r => (
              <button key={r.key} onClick={() => setRange(r.key)}
                style={{ padding: "6px 12px", borderRadius: "7px", fontSize: "12px", fontWeight: 500, border: "none", cursor: "pointer", fontFamily: "var(--font)", background: range === r.key ? "var(--accent)" : "transparent", color: range === r.key ? "#0A0B0F" : "var(--text-secondary)" }}>{r.label}</button>
            ))}
          </div>
        </div>
      </div>

      {isLoading || !data ? (
        <div style={{ color: "var(--text-muted)", fontSize: "13px", padding: "60px", textAlign: "center" }}>Loading usage...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "18px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px" }}>
            <Kpi label="AWS cost (real)" value={fmtUsd(t!.cost_usd)} sub={`${fmtUsd4(t!.avg_cost_usd)} avg / run`} />
            {isPlatform && !selectedTenant ? (
              <>
                <Kpi label="Billable (all clients)" value={fmtUsd(totalBillable)} accent sub={`${fmtNum(t!.executions)} runs`} />
                <Kpi label="Gross margin" value={fmtUsd(totalMargin)} accent sub={`${blendedMarginPct.toFixed(1)}% over compute cost`} />
                <Kpi label="Active clients" value={fmtNum(t!.active_tenants)} sub="with usage" />
              </>
            ) : isPlatform && selTn ? (
              <>
                <Kpi label="Billable" value={fmtUsd(selTn.billable || 0)} accent sub={selTn.billing_model ? modelLabel(selTn.billing_model, selTn.billing_rate) : ""} />
                <Kpi label="Gross margin" value={fmtUsd(selTn.margin || 0)} accent sub={`${selTn.margin_pct ?? 0}% over compute`} />
                <Kpi label="Executions" value={fmtNum(t!.executions)} sub={`${t!.success_rate}% success`} />
              </>
            ) : (
              <>
                <Kpi label="Executions" value={fmtNum(t!.executions)} sub={`${t!.success_rate}% success`} />
                <Kpi label="Total tokens" value={fmtTokens(t!.total_tokens)} sub={`${fmtTokens(t!.input_tokens)} in · ${fmtTokens(t!.output_tokens)} out`} />
                <Kpi label="Pending approvals" value={fmtNum(t!.waiting)} sub={`${t!.running} running now`} />
              </>
            )}
          </div>

          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>Cost over time</span>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>daily · AWS cost basis</span>
            </div>
            <TrendChart data={data.trend} />
          </div>

          {isPlatform && !selectedTenant && tenantOptions.length > 0 && (
            <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }}>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>Billing by client</div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>AWS cost {fmtUsd(totalAws)} · Billable {fmtUsd(totalBillable)} · Gross margin {fmtUsd(totalMargin)} ({blendedMarginPct.toFixed(1)}%)</div>
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "14px" }}>Billable vs. raw AWS compute cost. Gross margin nets out compute only — not team/service time. Click Pricing to configure.</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-muted)", textAlign: "left" }}>
                      <th style={{ padding: "8px 10px", fontWeight: 500 }}>Client</th>
                      <th style={{ padding: "8px 10px", fontWeight: 500, textAlign: "right" }}>Runs</th>
                      <th style={{ padding: "8px 10px", fontWeight: 500, textAlign: "right" }}>AWS cost</th>
                      <th style={{ padding: "8px 10px", fontWeight: 500, textAlign: "right" }}>Billable</th>
                      <th style={{ padding: "8px 10px", fontWeight: 500, textAlign: "right" }}>Gross margin</th>
                      <th style={{ padding: "8px 10px", fontWeight: 500, textAlign: "right" }}>GM %</th>
                      <th style={{ padding: "8px 10px", fontWeight: 500 }}>Model</th>
                      <th style={{ padding: "8px 10px", fontWeight: 500 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenantOptions.map(tn => (
                      <tr key={tn.tenant_id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "10px", color: "var(--text-primary)", fontWeight: 500 }}>{tn.tenant_name}</td>
                        <td style={{ padding: "10px", textAlign: "right", color: "var(--text-secondary)" }}>{fmtNum(tn.executions)}</td>
                        <td style={{ padding: "10px", textAlign: "right", color: "var(--text-secondary)" }}>{fmtUsd(tn.cost_usd)}</td>
                        <td style={{ padding: "10px", textAlign: "right", color: "var(--accent)", fontWeight: 600 }}>{tn.billable != null ? fmtUsd(tn.billable) : "—"}</td>
                        <td style={{ padding: "10px", textAlign: "right", color: (tn.margin ?? 0) >= 0 ? "var(--text-primary)" : "var(--status-failed, #e5484d)" }}>{tn.margin != null ? fmtUsd(tn.margin) : "—"}</td>
                        <td style={{ padding: "10px", textAlign: "right", color: "var(--text-secondary)" }}>{tn.margin_pct != null ? `${tn.margin_pct}%` : "—"}</td>
                        <td style={{ padding: "10px", color: "var(--text-muted)", fontSize: "12px" }}>
                          {tn.billing_model ? modelLabel(tn.billing_model, tn.billing_rate) : "—"}
                          {tn.billing_model === "plan" && tn.included_runs != null && (
                            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                              {fmtNum(tn.executions)}/{fmtNum(tn.included_runs)} runs{(tn.overage_runs ?? 0) > 0 ? ` · +${fmtNum(tn.overage_runs || 0)} over` : ""}
                            </div>
                          )}
                          {(tn.value_delivered ?? 0) > 0 && (
                            <div style={{ fontSize: "11px", color: "var(--accent)" }}>
                              {fmtUsd(tn.value_delivered || 0)} value
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "10px", textAlign: "right" }}>
                          {tn.tenant_id !== "__untagged__" && (
                            <button onClick={() => setConfigFor(tn.tenant_id)} style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "12px", background: "transparent", border: "1px solid var(--border-hover)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font)" }}>Pricing</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.orchestrators.length > 0 && (
            <div style={card}>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>Cost by orchestrator</div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "16px" }}>Which workflows drive spend{selectedTenant ? ` for ${selName}` : ""}.</div>
              {data.orchestrators.slice(0, 8).map(o => (
                <CostBar key={o.orchestrator_id} label={o.orchestrator_name} cost={o.cost_usd} execs={o.executions} max={maxOrchCost}
                  sub={`${fmtUsd4(o.avg_cost_usd)} avg · ${o.success_rate}% success · ${fmtTokens(o.total_tokens)} tokens`} />
              ))}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "14px" }}>
            <Kpi label="Completed" value={fmtNum(t!.completed)} />
            <Kpi label="Failed" value={fmtNum(t!.failed)} />
            <Kpi label="Running" value={fmtNum(t!.running)} />
            <Kpi label="Awaiting approval" value={fmtNum(t!.waiting)} />
          </div>

          <div style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center", paddingBottom: "8px" }}>
            AWS cost = raw Bedrock usage. Gross margin = billable − compute cost (excludes team/service cost). Generated {new Date(data.generated_at + "Z").toLocaleString()}.
          </div>
        </div>
      )}

      {configFor && (
        <PricingModal tenantId={configFor}
          tenantName={tenantOptions.find(x => x.tenant_id === configFor)?.tenant_name || "Client"}
          runsUsed={tenantOptions.find(x => x.tenant_id === configFor)?.executions || 0}
          onClose={() => { setConfigFor(null); queryClient.invalidateQueries({ queryKey: ["billing-usage"] }); }} />
      )}
    </div>
  );
}
