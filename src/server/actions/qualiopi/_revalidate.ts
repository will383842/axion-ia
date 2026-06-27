/**
 * Qualiopi — Invalidation de cache après mutation d'une Formation (WS1).
 *
 * Pourquoi ce helper :
 *   Les actions admin de formation (create/update/validate/publish/certification/
 *   indicateurs + import catalogue) muent la table `Formation` sans invalider le
 *   cache Next.js. Tant que le flag `OF_PUBLIC_DISCLOSURE_ENABLED` est à false
 *   (Phase A), les pages publiques lisent `catalog-v2.ts` (statique) → impact nul.
 *   Mais dès l'activation Phase B, la page détail + ses metadata + son JSON-LD se
 *   rendent DEPUIS LA DB : sans invalidation, elles restent périmées jusqu'à 1h
 *   (ISR `revalidate = 3600`). Ce helper rend l'invalidation systématique et
 *   immédiate, et garde l'admin (liste) frais en Phase A comme en Phase B.
 *
 * Convention identique aux autres ressources (presse/blog/faq/jobs) : on
 * revalide le chemin admin (via `adminPath`) + les chemins publics FR canoniques.
 * On ne revalide pas EN : le locale est désactivé au runtime (301 → FR, cf.
 * `EN_LOCALE_ENABLED`), et la route formations a un mapping `pathnames` localisé
 * — revalider `/en/...` viserait un mauvais chemin pour un gain nul.
 */

import { revalidatePath } from "next/cache";
import { adminPath } from "@/lib/admin-path";

/**
 * Invalide le cache des pages formation après une mutation.
 *
 * @param slug - slug de la formation (optionnel) : si fourni, la fiche publique
 *   `/fr/formations/<slug>` est invalidée en plus de la liste. Passer aussi
 *   `oldSlug` en cas de renommage pour purger l'ancienne URL.
 */
export function revalidateFormationPages(opts?: {
  slug?: string | null;
  oldSlug?: string | null;
}): void {
  // Admin (liste + détail couverts par la page de liste)
  revalidatePath(adminPath("fr", "qualiopi/formations"));

  // Public — liste (Phase B : alimentée par la DB ; Phase A : catalogue, no-op sûr)
  revalidatePath("/fr/formations");

  // Public — fiche détail par slug
  if (opts?.slug) revalidatePath(`/fr/formations/${opts.slug}`);
  if (opts?.oldSlug && opts.oldSlug !== opts.slug) {
    revalidatePath(`/fr/formations/${opts.oldSlug}`);
  }
}
