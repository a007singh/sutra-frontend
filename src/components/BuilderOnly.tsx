/**
 * BuilderOnly.tsx — Phase 2.3 Step E
 * =================================
 * Renders its children ONLY for builder roles (OPERATOR/ADMIN). Client roles
 * see nothing. Use to wrap create/edit/delete buttons on the build pages.
 *
 * UX only, not security — the backend Step C role checks are the real lock.
 *
 * Place at: frontend/src/components/BuilderOnly.tsx
 *
 * Usage:
 *   <BuilderOnly>
 *     <button onClick={openCreate}>New workflow</button>
 *   </BuilderOnly>
 *
 * Or for an action prop (like DataTable's action), use the hook:
 *   const canBuild = useCanBuild();
 *   action={canBuild ? { label: "New workflow", onClick: openCreate } : undefined}
 */

import type { ReactNode } from "react";
import { useMe } from "../hooks/useMe";
import { canBuild } from "../api/roles";

export function useCanBuild(): boolean {
  const { data: me } = useMe();
  return canBuild(me);
}

export default function BuilderOnly({ children }: { children: ReactNode }) {
  const allowed = useCanBuild();
  if (!allowed) return null;
  return <>{children}</>;
}
