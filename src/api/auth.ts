/**
 * auth.ts — Phase 2.2d
 * ====================
 * Frontend Cognito authentication for Sutra.
 *
 * Uses `amazon-cognito-identity-js` (lightweight, no Amplify framework) to
 * match your existing axios + localStorage pattern. The api/client.ts
 * interceptor ALREADY attaches `localStorage.getItem("id_token")` as the
 * Bearer token — this module's job is simply to LOG IN and put a valid
 * Cognito token there (and refresh/clear it).
 *
 * Install:
 *   npm install amazon-cognito-identity-js
 *
 * Config: reads pool id + client id from Vite env:
 *   VITE_COGNITO_USER_POOL_ID = us-east-1_xxxxx
 *   VITE_COGNITO_CLIENT_ID    = xxxxxxxxxxxxx
 *   VITE_COGNITO_REGION       = us-east-1
 * (these come from cognito_users_config.json produced by setup_cognito_users.py)
 *
 * Handles the real-world Cognito login states:
 *   - normal success
 *   - first-login NEW_PASSWORD_REQUIRED (temp password -> set permanent)
 *   - TOTP MFA challenge (SOFTWARE_TOKEN_MFA)
 *   - first-time TOTP setup (MFA_SETUP)
 */

import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
} from "amazon-cognito-identity-js";

const POOL_DATA = {
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID as string,
  ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID as string,
};

const userPool = new CognitoUserPool(POOL_DATA);

// ── Token storage (matches the existing client.ts interceptor) ───────────────
// client.ts reads localStorage "id_token" — we store id + access + refresh.
const TOKEN_KEYS = {
  id: "id_token",
  access: "access_token",
  refresh: "refresh_token",
};

function storeSession(session: CognitoUserSession) {
  localStorage.setItem(TOKEN_KEYS.id, session.getIdToken().getJwtToken());
  localStorage.setItem(TOKEN_KEYS.access, session.getAccessToken().getJwtToken());
  localStorage.setItem(TOKEN_KEYS.refresh, session.getRefreshToken().getToken());
}

export function clearSession() {
  Object.values(TOKEN_KEYS).forEach((k) => localStorage.removeItem(k));
}

export function getIdToken(): string | null {
  return localStorage.getItem(TOKEN_KEYS.id);
}

// ── Result types the login UI reacts to ──────────────────────────────────────
export type LoginResult =
  | { status: "SUCCESS" }
  | { status: "NEW_PASSWORD_REQUIRED"; user: CognitoUser; userAttributes: any }
  | { status: "MFA_REQUIRED"; user: CognitoUser }
  | { status: "MFA_SETUP"; user: CognitoUser; secretCode: string }
  | { status: "ERROR"; message: string };

// ── Login ────────────────────────────────────────────────────────────────────
export function login(email: string, password: string): Promise<LoginResult> {
  return new Promise((resolve) => {
    const user = new CognitoUser({ Username: email, Pool: userPool });
    const details = new AuthenticationDetails({
      Username: email,
      Password: password,
    });

    user.authenticateUser(details, {
      onSuccess: (session) => {
        storeSession(session);
        resolve({ status: "SUCCESS" });
      },
      onFailure: (err) => {
        resolve({ status: "ERROR", message: err.message || String(err) });
      },
      newPasswordRequired: (userAttributes) => {
        // First login with the temporary password — must set a permanent one.
        delete userAttributes.email_verified;
        delete userAttributes.email;
        resolve({ status: "NEW_PASSWORD_REQUIRED", user, userAttributes });
      },
      totpRequired: () => {
        // TOTP MFA challenge — user must enter their authenticator code.
        resolve({ status: "MFA_REQUIRED", user });
      },
      mfaSetup: () => {
        // First-time MFA setup — associate a TOTP secret to show as QR.
        user.associateSoftwareToken({
          associateSecretCode: (secretCode: string) => {
            resolve({ status: "MFA_SETUP", user, secretCode });
          },
          onFailure: (err: any) => {
            resolve({ status: "ERROR", message: err.message || String(err) });
          },
        });
      },
    });
  });
}

// ── Complete the NEW_PASSWORD_REQUIRED challenge ─────────────────────────────
export function completeNewPassword(
  user: CognitoUser,
  newPassword: string,
  userAttributes: any
): Promise<LoginResult> {
  return new Promise((resolve) => {
    user.completeNewPasswordChallenge(newPassword, userAttributes, {
      onSuccess: (session) => {
        storeSession(session);
        resolve({ status: "SUCCESS" });
      },
      onFailure: (err) => resolve({ status: "ERROR", message: err.message || String(err) }),
      mfaSetup: () => {
        user.associateSoftwareToken({
          associateSecretCode: (secretCode: string) =>
            resolve({ status: "MFA_SETUP", user, secretCode }),
          onFailure: (err: any) =>
            resolve({ status: "ERROR", message: err.message || String(err) }),
        });
      },
      totpRequired: () => resolve({ status: "MFA_REQUIRED", user }),
    });
  });
}

// ── Submit a TOTP code (for the MFA challenge) ───────────────────────────────
export function submitMfaCode(user: CognitoUser, code: string): Promise<LoginResult> {
  return new Promise((resolve) => {
    user.sendMFACode(
      code,
      {
        onSuccess: (session) => {
          storeSession(session);
          resolve({ status: "SUCCESS" });
        },
        onFailure: (err) => resolve({ status: "ERROR", message: err.message || String(err) }),
      },
      "SOFTWARE_TOKEN_MFA"
    );
  });
}

// ── Verify the first-time TOTP setup, then it becomes the MFA method ─────────
export function verifyTotpSetup(user: CognitoUser, code: string): Promise<LoginResult> {
  return new Promise((resolve) => {
    user.verifySoftwareToken(code, "Sutra Authenticator", {
      onSuccess: (session: any) => {
        // session may be returned; if so store it, else user logs in normally next
        try {
          if (session && session.getIdToken) storeSession(session);
        } catch {
          /* no-op */
        }
        resolve({ status: "SUCCESS" });
      },
      onFailure: (err: any) =>
        resolve({ status: "ERROR", message: err.message || String(err) }),
    });
  });
}

// ── Logout ────────────────────────────────────────────────────────────────────
export function logout() {
  const user = userPool.getCurrentUser();
  if (user) user.signOut();
  clearSession();
}

// ── Session check / refresh (call on app load) ───────────────────────────────
export function getCurrentSession(): Promise<boolean> {
  return new Promise((resolve) => {
    const user = userPool.getCurrentUser();
    if (!user) {
      resolve(false);
      return;
    }
    user.getSession((err: any, session: CognitoUserSession | null) => {
      if (err || !session || !session.isValid()) {
        resolve(false);
        return;
      }
      storeSession(session); // refresh stored tokens
      resolve(true);
    });
  });
}

// ── Is the user currently authenticated (token present & unexpired)? ─────────
export function isAuthenticated(): boolean {
  const token = getIdToken();
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}
