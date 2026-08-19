/**
 * Knowledge Base — helpers de revalidation de cache Next.js.
 *
 * V1 (KB-3) : revalide les pages admin + pages publiques alimentées par la KB.
 * Étendu en KB-6 (routes publiques branchées sur backend unifié).
 *
 * 🔴 2026-08-19 — retrait de `"use server"` : purger le cache ISR de tout le hub
 * KB n'a aucune raison d'être joignable par un client anonyme (invalidation
 * répétée = coût de rendu à la demande). Ces helpers ne sont appelés que par les
 * Server Actions KB, gardées, et aucun composant client ne les importe. Défense
 * en profondeur, même geste que `ingest.ts` (P0-S1-1).
 */

import { revalidatePath } from "next/cache";
import type { KbType } from "../../../../prisma/generated/client";
import { KB_PUBLIC_ROUTES } from "@/content/knowledge/routes";

/**
 * Revalide les routes admin KB (liste + détail).
 * `async` conservé (contrat d'appel des Server Actions appelantes) — ce n'est
 * plus une contrainte Next depuis le retrait de la directive.
 */
export async function revalidateAdminKbRoutes(entryId?: string): Promise<void> {
  revalidatePath("/fr/[adminPrefix]/connaissances", "page");
  if (entryId) {
    revalidatePath(`/fr/[adminPrefix]/connaissances/${entryId}`, "page");
  }
}

/**
 * Revalide les routes publiques préservées + hub `/ressources/` selon le type.
 * En KB-3 V1, on revalide systématiquement les routes connues — KB-6 affinera.
 * `async` conservé (contrat d'appel des Server Actions appelantes) — ce n'est
 * plus une contrainte Next depuis le retrait de la directive.
 */
export async function revalidatePublicKbRoutes(
  type: KbType,
  translationSlug?: string,
): Promise<void> {
  const route = KB_PUBLIC_ROUTES[type];
  if (route) {
    revalidatePath(`/fr${route.fr}`);
    revalidatePath(`/en${route.en}`);
    // Audit KB 2026-08-11 — page de DÉTAIL : publier/dépublier depuis l'admin
    // purgeait le hub mais laissait la page `/…/[slug]` en cache ISR jusqu'à 1 h.
    if (translationSlug) {
      revalidatePath(`/fr${route.fr}/${translationSlug}`);
    }
  }
  // Hub connaissances (pages réelles servant les types factory — décision
  // « public assumé » 2026-08-11) + hub agrégateur /ressources (KB-8).
  revalidatePath("/fr/connaissances");
  revalidatePath("/fr/ressources");
  revalidatePath("/en/resources");
}
