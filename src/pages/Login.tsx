/**
 * Login.tsx — Phase 2.2d
 * ======================
 * Minimal, functional login screen handling every Cognito state:
 *   - email + password
 *   - first-login NEW_PASSWORD_REQUIRED (set permanent password)
 *   - first-time TOTP setup (shows secret/QR to scan, then verify)
 *   - TOTP MFA challenge (enter authenticator code)
 *
 * Styled with the existing dark aesthetic (operator-facing first). When you
 * build the CLIENT-facing surface later, restyle this for a branded, calmer
 * executive look — the auth logic stays identical.
 *
 * On SUCCESS it stores tokens (via auth.ts) and calls onSuccess(), which your
 * app uses to route into the platform. The api/client.ts interceptor then
 * attaches the token to every API call automatically.
 */

import { useState } from "react";
import LoginBackground from "../components/LoginBackground";
import {
  login,
  completeNewPassword,
  submitMfaCode,
  verifyTotpSetup,
  type LoginResult,
} from "../api/auth";

type Stage = "LOGIN" | "NEW_PASSWORD" | "MFA_SETUP" | "MFA_CODE";

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [stage, setStage] = useState<Stage>("LOGIN");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [code, setCode] = useState("");
  const [secret, setSecret] = useState("");
  const [pendingUser, setPendingUser] = useState<any>(null);
  const [pendingAttrs, setPendingAttrs] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function handle(result: LoginResult) {
    setBusy(false);
    switch (result.status) {
      case "SUCCESS":
        onSuccess();
        break;
      case "NEW_PASSWORD_REQUIRED":
        setPendingUser(result.user);
        setPendingAttrs(result.userAttributes);
        setStage("NEW_PASSWORD");
        break;
      case "MFA_SETUP":
        setPendingUser(result.user);
        setSecret(result.secretCode);
        setStage("MFA_SETUP");
        break;
      case "MFA_REQUIRED":
        setPendingUser(result.user);
        setStage("MFA_CODE");
        break;
      case "ERROR":
        setError(result.message);
        break;
    }
  }

  async function doLogin() {
    setError(""); setBusy(true);
    handle(await login(email, password));
  }
  async function doNewPassword() {
    setError(""); setBusy(true);
    handle(await completeNewPassword(pendingUser, newPassword, pendingAttrs));
  }
  async function doVerifyTotp() {
    setError(""); setBusy(true);
    const r = await verifyTotpSetup(pendingUser, code);
    if (r.status === "SUCCESS") {
      // After setup, user logs in again to obtain tokens
      setStage("LOGIN"); setCode(""); setBusy(false);
      setError("MFA configured. Please sign in again.");
    } else handle(r);
  }
  async function doMfaCode() {
    setError(""); setBusy(true);
    handle(await submitMfaCode(pendingUser, code));
  }

  const otpauthUrl =
    secret && email
      ? `otpauth://totp/Sutra:${encodeURIComponent(email)}?secret=${secret}&issuer=Sutra`
      : "";

  return (
    <div style={S.wrap}>
      <LoginBackground />
      <div style={S.card}>
        <div style={S.logo}>Sutra</div>
        <div style={S.sub}>Intelligent operations, supervised by humans</div>

        {error && <div style={S.error}>{error}</div>}

        {stage === "LOGIN" && (
          <>
            <input style={S.input} type="email" placeholder="Email" value={email}
              onChange={(e) => setEmail(e.target.value)} autoFocus />
            <input style={S.input} type="password" placeholder="Password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doLogin()} />
            <button style={S.btn} onClick={doLogin} disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </>
        )}

        {stage === "NEW_PASSWORD" && (
          <>
            <div style={S.hint}>Set a new password to finish activating your account.</div>
            <input style={S.input} type="password" placeholder="New password (12+ chars)"
              value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoFocus />
            <button style={S.btn} onClick={doNewPassword} disabled={busy}>
              {busy ? "Saving…" : "Set password"}
            </button>
          </>
        )}

        {stage === "MFA_SETUP" && (
          <>
            <div style={S.hint}>
              Scan this in your authenticator app (Google Authenticator, Authy…),
              then enter the 6-digit code.
            </div>
            {otpauthUrl && (
              <img alt="TOTP QR" style={S.qr}
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(otpauthUrl)}`} />
            )}
            <div style={S.secret}>Secret: {secret}</div>
            <input style={S.input} placeholder="6-digit code" value={code}
              onChange={(e) => setCode(e.target.value)} autoFocus />
            <button style={S.btn} onClick={doVerifyTotp} disabled={busy}>
              {busy ? "Verifying…" : "Verify & enable MFA"}
            </button>
          </>
        )}

        {stage === "MFA_CODE" && (
          <>
            <div style={S.hint}>Enter the 6-digit code from your authenticator app.</div>
            <input style={S.input} placeholder="6-digit code" value={code}
              onChange={(e) => setCode(e.target.value)} autoFocus
              onKeyDown={(e) => e.key === "Enter" && doMfaCode()} />
            <button style={S.btn} onClick={doMfaCode} disabled={busy}>
              {busy ? "Verifying…" : "Verify"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Dark aesthetic matching the existing platform (operator-facing).
const S: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: "100vh", display: "flex", alignItems: "center",
    justifyContent: "center", background: "transparent", position: "relative",
    fontFamily: "var(--font, system-ui)",
  },
  card: {
    width: 360, padding: "40px 32px", background: "#ffffff",
    position: "relative", zIndex: 1, borderRadius: 16,
    boxShadow: "0 12px 40px rgba(26,43,74,0.12)", border: "1px solid rgba(26,43,74,0.08)",
    display: "flex", flexDirection: "column", gap: 14,
  },
  logo: { fontSize: 28, fontWeight: 700, color: "#1a2b4a", textAlign: "center" },
  sub: { fontSize: 12, color: "#6b7a90", textAlign: "center", marginBottom: 8 },
  hint: { fontSize: 12, color: "#6b7a90", lineHeight: 1.5 },
  input: {
    padding: "11px 14px", fontSize: 14, borderRadius: 8,
    background: "#fafcfb", border: "1px solid rgba(26,43,74,0.16)",
    color: "#1a2b4a", outline: "none", fontFamily: "inherit",
  },
  btn: {
    padding: "11px 14px", fontSize: 14, fontWeight: 600, borderRadius: 8, border: "none",
    background: "#14b88a", color: "#ffffff", cursor: "pointer", marginTop: 4,
  },
  error: {
    fontSize: 12, color: "var(--status-failed, #f87171)", background: "rgba(248,113,113,0.08)",
    border: "1px solid rgba(248,113,113,0.2)", borderRadius: 8, padding: "8px 12px",
  },
  qr: { alignSelf: "center", borderRadius: 8, background: "#fff", padding: 8 },
  secret: { fontSize: 11, color: "#6b7a90", wordBreak: "break-all", fontFamily: "monospace", background: "#f4f7f9", padding: "6px 8px", borderRadius: 6 },
};
