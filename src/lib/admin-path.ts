// Sprint 24 — helper canonique pour les chemins admin.
//
// Pourquoi ce helper :
//   process.env.ADMIN_URL_PREFIX lu directement dans les Server Actions est
//   fragile (caché côté build, fallback dev `admin-dev-x7k2n9` exposé dans le
//   repo). Centraliser la lecture runtime ici garantit :
//     - une seule source de vérité (DRY),
//     - un fallback contrôlé,
//     - un point d'instrumentation futur (logging, audit, tests).
//
// Le helper lit `process.env.ADMIN_URL_PREFIX` à chaque appel : aucun cache
// module-level pour préserver la testabilité (vi.stubEnv) et permettre un
// hot-reload du segment en local sans redémarrage.
//
// Usage :
//   revalidatePath(adminPath("fr", "options"));
//   redirect(adminPath("en", "settings/2fa"));

import type { Locale } from "../../prisma/generated/client";

const DEV_FALLBACK = "admin-dev-x7k2n9";

/**
 * Retourne le segment admin courant (ADMIN_URL_PREFIX) ou le fallback dev.
 * Le fallback est validé en prod par `src/env.ts` (refusé via superRefine).
 */
export function adminSegment(): string {
  return process.env.ADMIN_URL_PREFIX ?? DEV_FALLBACK;
}

/**
 * Construit le chemin admin pour une locale + sous-chemin donnés.
 *
 * @param locale - "fr" | "en"
 * @param subpath - segments après le préfixe admin (sans slash initial), ex. "options" ou "settings/2fa"
 * @returns "/fr/<ADMIN_URL_PREFIX>/options"
 */
export function adminPath(locale: Locale, subpath = ""): string {
  const cleaned = subpath.replace(/^\/+/, "");
  const suffix = cleaned ? `/${cleaned}` : "";
  return `/${locale}/${adminSegment()}${suffix}`;
}
