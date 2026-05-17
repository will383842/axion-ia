// Refonte admin mai 2026 — Pré-flight §3bis (cf. _AUDIT/ADMIN-REFONTE-2026-05-17/).
//
// Pourquoi ce helper :
//   La refonte de la console admin est livrée en PRs-équivalents séquentielles
//   (0 → 14). Pour éviter le big-bang merge final, chaque page migrée propose
//   son rendu via `<PageV2 />` quand `ADMIN_V2_ENABLED=true`, sinon fallback
//   vers `<PageV1 />` (ancien JSX). Le pattern d'usage est :
//
//     import { isAdminV2Enabled } from "@/lib/feature-flags";
//     import { PageV1 } from "./_v1/page-v1";
//     import { PageV2 } from "./_v2/page-v2";
//
//     export default async function Page(props: Props) {
//       return (await isAdminV2Enabled()) ? <PageV2 {...props} /> : <PageV1 {...props} />;
//     }
//
//   Une fois la migration consolidée (Phase 7), le flag est retiré et les
//   dossiers `_v1/` supprimés (PR-équivalent 14 = clean-up).
//
// Lecture runtime (pas de cache module-level) :
//   Même pattern que `adminSegment()` dans `src/lib/admin-path.ts` —
//   `process.env` lu à chaque appel pour préserver la testabilité
//   (`vi.stubEnv`) et permettre un toggle live sans rebuild.
//
// Override per-session (cookie `admin_v2=1`) :
//   Sera câblé en PR-équivalent 0 (middleware admin lit le cookie et passe
//   l'info en header serveur). En attendant, ce helper ne lit que l'env var
//   globale — pas de regression possible (flag défaut = false).

/**
 * Indique si la version V2 (refonte mai 2026) de la console admin est active.
 *
 * @returns `true` si `process.env.ADMIN_V2_ENABLED === "true"`, `false` sinon.
 */
export function isAdminV2Enabled(): boolean {
  return process.env["ADMIN_V2_ENABLED"] === "true";
}
