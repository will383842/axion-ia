// Refonte admin mai 2026 — Pré-flight §3bis + PR 1.
//
// Cf. _AUDIT/ADMIN-REFONTE-2026-05-17/ + ADR 0028.
//
// Pourquoi ce helper :
//   La refonte admin est livrée en PRs séquentielles (0 → 14). Pour éviter
//   le big-bang merge final, chaque page migrée propose `<PageV2 />` quand
//   `ADMIN_V2_ENABLED=true`, sinon fallback `<PageV1 />`.
//
// Sources de vérité (par ordre de priorité) :
//   1. Cookie session `admin_v2=1` (override per-utilisateur — Will peut
//      basculer V2 dans son navigateur sans flip global).
//   2. Env var `ADMIN_V2_ENABLED=true` (bascule globale prod).
//   3. Default `false` (legacy V1).
//
// Lecture runtime (pas de cache module-level) :
//   - Même pattern que `adminSegment()` dans `src/lib/admin-path.ts` —
//     `process.env` et `cookies()` lus à chaque appel pour préserver la
//     testabilité (`vi.stubEnv`) et permettre toggle live sans rebuild.
//
// API asynchrone :
//   Le helper retourne `Promise<boolean>` car `cookies()` de Next.js 16 est
//   async (RSC). Usage en Server Component :
//
//     import { isAdminV2Enabled } from "@/lib/feature-flags";
//     export default async function Page() {
//       const v2 = await isAdminV2Enabled();
//       return v2 ? <PageV2 /> : <PageV1 />;
//     }
//
//   Pour les contextes hors RSC (workers, tests), utiliser
//   `isAdminV2EnabledFromEnv()` qui ne lit que l'env var.

import { cookies } from "next/headers";

/**
 * Indique si la V2 admin est active pour la requête courante.
 *
 * Vérifie d'abord le cookie `admin_v2=1` (override per-session), puis
 * l'env var `ADMIN_V2_ENABLED`. Échec silencieux hors contexte RSC.
 */
export async function isAdminV2Enabled(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    if (cookieStore.get("admin_v2")?.value === "1") return true;
  } catch {
    // cookies() throws hors contexte RSC (route handlers static, scripts, etc.)
    // — on retombe sur l'env var.
  }
  return isAdminV2EnabledFromEnv();
}

/**
 * Variante synchrone, env-var-only (pour contextes hors RSC : workers,
 * scripts, tests Vitest, build-time SSG).
 */
export function isAdminV2EnabledFromEnv(): boolean {
  return process.env["ADMIN_V2_ENABLED"] === "true";
}
