import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "../api/settings";
import type { Settings, ModelPricing } from "../api/settings";
import { AVAILABLE_MODELS } from "../api/client";
import { globalToast } from "../hooks/useGlobalToast";

const sectionStyle: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--border-radius-lg, 12px)",
  padding: "20px 24px",
  marginBottom: "16px",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "13px", fontWeight: 600,
  color: "var(--text-primary)", marginBottom: "4px",
};

const sectionSubStyle: React.CSSProperties = {
  fontSize: "12px", color: "var(--text-secondary)",
  marginBottom: "16px", lineHeight: "1.5",
};

const labelStyle: React.CSSProperties = {
  fontSize: "12px", fontWeight: 500,
  color: "var(--text-secondary)", marginBottom: "5px", display: "block",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px",
  background: "var(--bg-overlay)", border: "1px solid var(--border-hover)",
  borderRadius: "8px", color: "var(--text-primary)",
  fontSize: "13px", fontFamily: "var(--font)", outline: "none",
  boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };

const AWS_REGIONS = [
  { value: "ap-south-1",    label: "Asia Pacific (Mumbai)" },
  { value: "us-east-1",     label: "US East (N. Virginia)" },
  { value: "us-west-2",     label: "US West (Oregon)" },
  { value: "eu-west-1",     label: "Europe (Ireland)" },
  { value: "ap-southeast-1",label: "Asia Pacific (Singapore)" },
  { value: "ap-northeast-1",label: "Asia Pacific (Tokyo)" },
];

export default function Settings() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => settingsApi.get().then(r => r.data),
  });

  const [defaultModel,    setDefaultModel]    = useState("");
  const [awsRegion,       setAwsRegion]       = useState("ap-south-1");
  const [bedrockEndpoint, setBedrockEndpoint] = useState("");
  const [pricing,         setPricing]         = useState<Record<string, ModelPricing>>({});
  const [dirty,           setDirty]           = useState(false);
  const [agentcoreRuntimeArn, setAgentcoreRuntimeArn] = useState("");
  const [githubToken,  setGithubToken]  = useState("");
  const [githubRepo,   setGithubRepo]   = useState("");
  const [githubBranch, setGithubBranch] = useState("main");
  const [recFastModel,  setRecFastModel]  = useState("");
  const [recDeepModel,  setRecDeepModel]  = useState("");

  // Populate form when data loads
  useEffect(() => {
    if (!data) return;
    setDefaultModel(data.default_model || "");
    setAwsRegion(data.aws_region || "ap-south-1");
    setBedrockEndpoint(data.bedrock_endpoint || "");
    setAgentcoreRuntimeArn((data as any).agentcore_runtime_arn || "");
    setRecFastModel((data as any).rec_fast_model || "");
    setRecDeepModel((data as any).rec_deep_model || "");
    setGithubToken( (data as any).github_token  || "");
    setGithubRepo(  (data as any).github_repo   || "");
    setGithubBranch((data as any).github_branch || "main");
    setPricing(data.pricing || {});
    setDirty(false);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => settingsApi.save({
      default_model:    defaultModel,
      aws_region:       awsRegion,
      bedrock_endpoint: bedrockEndpoint,
      agentcore_runtime_arn:  agentcoreRuntimeArn,
      rec_fast_model:         recFastModel,
      rec_deep_model:         recDeepModel,
      github_token:           githubToken,
      github_repo:            githubRepo,
      github_branch:          githubBranch,
      pricing,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      globalToast("Settings saved");
      setDirty(false);
    },
    onError: () => globalToast("Failed to save settings", "error"),
  });

  function updatePricing(modelId: string, field: "input" | "output", val: string) {
    const num = parseFloat(val);
    setPricing(prev => ({
      ...prev,
      [modelId]: { ...prev[modelId], [field]: isNaN(num) ? 0 : num },
    }));
    setDirty(true);
  }

  function mark() { setDirty(true); }

  if (isLoading) {
    return (
      <div style={{ padding: "28px 32px", color: "var(--text-muted)", fontSize: "13px" }}>
        Loading settings...
      </div>
    );
  }

  return (
    <div style={{ padding: "28px 32px", maxWidth: "760px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 600, letterSpacing: "-0.3px", color: "var(--text-primary)" }}>
            Settings
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "3px" }}>
            Platform configuration — AWS, models, and cost pricing
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {dirty && (
            <span style={{ fontSize: "12px", color: "var(--status-waiting)" }}>
              Unsaved changes
            </span>
          )}
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !dirty}
            style={{
              padding: "8px 20px", borderRadius: "8px",
              background: dirty ? "var(--accent)" : "var(--bg-overlay)",
              border: "none", color: dirty ? "#0A0B0F" : "var(--text-muted)",
              fontSize: "13px", fontWeight: 600,
              cursor: dirty ? "pointer" : "not-allowed",
              fontFamily: "var(--font)", transition: "all 0.15s",
            }}
          >
            {saveMutation.isPending ? "Saving..." : "Save settings"}
          </button>
        </div>
      </div>

      {/* ── Section 1: Default model ── */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Default model</div>
        <div style={sectionSubStyle}>
          Used when no model is explicitly set on a sub-agent or orchestrator.
        </div>
        <div>
          <label style={labelStyle}>Model</label>
          <select
            value={defaultModel}
            onChange={e => { setDefaultModel(e.target.value); mark(); }}
            style={{ ...selectStyle, maxWidth: "460px" }}
          >
            <option value="">— Select default model —</option>
            {AVAILABLE_MODELS.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
          {defaultModel && (
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", fontFamily: "var(--font-mono)" }}>
              {defaultModel}
            </div>
          )}
        </div>
      </div>

      {/* ── Section 2: AWS configuration ── */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>AWS configuration</div>
        <div style={sectionSubStyle}>
          Region and Bedrock endpoint for agent execution. Use Mumbai (ap-south-1) for DPDP Act data residency compliance.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div>
            <label style={labelStyle}>AWS region</label>
            <select
              value={awsRegion}
              onChange={e => { setAwsRegion(e.target.value); mark(); }}
              style={selectStyle}
            >
              {AWS_REGIONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", fontFamily: "var(--font-mono)" }}>
              {awsRegion}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Bedrock endpoint override</label>
            <input
              value={bedrockEndpoint}
              onChange={e => { setBedrockEndpoint(e.target.value); mark(); }}
              placeholder="Leave blank to use default"
              style={inputStyle}
            />
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
              Optional. e.g. https://bedrock-runtime.ap-south-1.amazonaws.com
            </div>
          </div>
          <div>
            <label style={labelStyle}>AgentCore Runtime ARN</label>
            <input
              value={agentcoreRuntimeArn}
              onChange={e => { setAgentcoreRuntimeArn(e.target.value); mark(); }}
              placeholder="arn:aws:bedrock-agentcore:us-east-1:985317221420:runtime/agentcore_agent-ugfJRz3zi3"
              style={inputStyle}
            />
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
              Leave blank to run locally. Set after deploying via{" "}
              <code style={{ fontFamily: "var(--font-mono)", fontSize: "10px" }}>agentcore launch</code>.
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 3: Cost pricing ── */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Cost pricing overrides</div>
        <div style={sectionSubStyle}>
          Prices in USD per million tokens. Used to calculate cost estimates on the execution monitor and dashboard.
          These are approximate — check AWS pricing page for exact rates.
        </div>

        {/* Table header */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 130px 130px",
          gap: "10px", marginBottom: "8px", padding: "0 2px",
        }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Model</div>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Input ($/M tokens)</div>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Output ($/M tokens)</div>
        </div>

        {/* Pricing rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {AVAILABLE_MODELS.map(m => {
            const p = pricing[m.id] || { input: 0, output: 0 };
            return (
              <div key={m.id} style={{
                display: "grid", gridTemplateColumns: "1fr 130px 130px",
                gap: "10px", alignItems: "center",
                padding: "10px 12px",
                background: "var(--bg-overlay)", borderRadius: "8px",
                border: "1px solid var(--border)",
              }}>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>
                    {m.label}
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: "1px" }}>
                    {m.id.split(".").pop()?.slice(0, 36)}
                  </div>
                </div>
                <div>
                  <div style={{ position: "relative" }}>
                    <span style={{
                      position: "absolute", left: "9px", top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: "12px", color: "var(--text-muted)",
                    }}>$</span>
                    <input
                      type="number" min="0" step="0.001"
                      value={p.input}
                      onChange={e => updatePricing(m.id, "input", e.target.value)}
                      style={{ ...inputStyle, paddingLeft: "20px", fontSize: "12px" }}
                    />
                  </div>
                </div>
                <div>
                  <div style={{ position: "relative" }}>
                    <span style={{
                      position: "absolute", left: "9px", top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: "12px", color: "var(--text-muted)",
                    }}>$</span>
                    <input
                      type="number" min="0" step="0.001"
                      value={p.output}
                      onChange={e => updatePricing(m.id, "output", e.target.value)}
                      style={{ ...inputStyle, paddingLeft: "20px", fontSize: "12px" }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Reset to defaults */}
        <button
          onClick={async () => {
            const res = await settingsApi.get();
            const defaults = await fetch("/api/settings/defaults").then(r => r.json()).catch(() => null);
            if (defaults?.pricing) {
              setPricing(defaults.pricing);
              setDirty(true);
              globalToast("Pricing reset to defaults", "info");
            }
          }}
          style={{
            marginTop: "12px", padding: "6px 14px", borderRadius: "6px",
            fontSize: "12px", background: "transparent",
            border: "1px solid var(--border-hover)",
            color: "var(--text-secondary)", cursor: "pointer",
            fontFamily: "var(--font)",
          }}
        >
          Reset to defaults
        </button>
      </div>

      {/* ── Section 4: GitHub versioning ── */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>GitHub versioning</div>
        <div style={sectionSubStyle}>
          Every orchestrator and sub-agent save auto-commits to a GitHub repo.
          Provides full version history, diff, and rollback for all configs.
          Requires a GitHub personal access token with <code style={{ fontFamily: "var(--font-mono)", fontSize: "11px" }}>repo</code> scope.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Personal access token</label>
            <input
              type="password"
              value={githubToken}
              onChange={e => { setGithubToken(e.target.value); mark(); }}
              placeholder="ghp_xxxxxxxxxxxx"
              style={inputStyle}
              autoComplete="off"
            />
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
              Settings → Developer settings → Personal access tokens → Classic → repo scope
            </div>
          </div>
          <div>
            <label style={labelStyle}>Repository</label>
            <input
              value={githubRepo}
              onChange={e => { setGithubRepo(e.target.value); mark(); }}
              placeholder="your-org/sutra-configs"
              style={inputStyle}
            />
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
              Format: owner/repo-name
            </div>
          </div>
          <div>
            <label style={labelStyle}>Branch</label>
            <input
              value={githubBranch}
              onChange={e => { setGithubBranch(e.target.value); mark(); }}
              placeholder="main"
              style={inputStyle}
            />
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
              Target branch for version commits
            </div>
          </div>
        </div>
        {githubRepo && (
          <div style={{ marginTop: "10px", fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            https://github.com/{githubRepo}/tree/{githubBranch || "main"}
          </div>
        )}
      </div>

      {/* ── Section 5: AI Recommendations ── */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>AI recommendations</div>
        <div style={sectionSubStyle}>
          Models used in Governance → Agent cost recommendations.
          Quick analysis runs on demand for a fast diagnosis.
          Deep analysis produces specific prompt rewrites. Both are user-triggered.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Quick analysis model</label>
            <select
              value={recFastModel}
              onChange={e => { setRecFastModel(e.target.value); mark(); }}
              style={{ ...selectStyle, maxWidth: "100%" }}
            >
              <option value="">— Platform default (Nova Pro) —</option>
              {AVAILABLE_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
              Fast cost/waste diagnosis. Runs in ~3 s.
            </div>
          </div>
          <div>
            <label style={labelStyle}>Deep analysis model</label>
            <select
              value={recDeepModel}
              onChange={e => { setRecDeepModel(e.target.value); mark(); }}
              style={{ ...selectStyle, maxWidth: "100%" }}
            >
              <option value="">— Platform default (Claude Sonnet) —</option>
              {AVAILABLE_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
              Detailed prompt rewrites and root-cause analysis. Runs in ~8 s.
            </div>
          </div>
        </div>
        {(recFastModel || recDeepModel) && (
          <div style={{ marginTop: "10px", fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {recFastModel && <div>Quick: {recFastModel}</div>}
            {recDeepModel && <div>Deep:  {recDeepModel}</div>}
          </div>
        )}
      </div>

      {/* ── Section 5: Info ── */}
      <div style={{
        background: "var(--accent-dim)", border: "1px solid rgba(0,200,150,0.2)",
        borderRadius: "var(--border-radius-lg, 12px)", padding: "14px 18px",
      }}>
        <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="var(--accent)" strokeWidth="2" style={{ marginTop: "1px", flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.6" }}>
            Settings are stored in DynamoDB (<code style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--accent)" }}>platform-settings</code> table) and applied to all new executions.
            Changes to pricing are not retroactive — they apply to runs started after saving.
            AWS region changes require a backend restart to take effect.
          </div>
        </div>
      </div>
    </div>
  );
}