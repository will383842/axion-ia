/**
 * Knowledge Base — helpers de revalidation de cache Next.js.
 *
 * V1 (KB-3) : revalide les pages admin + pages publiques alimentées par la KB.
 * Étendu en KB-6 (routes publiques branchées sur backend unifié).
 */

"use server";

import { revalidatePath } from "next/cache";
import type { KbType } from "../../../../prisma/generated/client";
import { KB_PUBLIC_ROUTES } from "@/content/knowledge/routes";

/**
 * Revalide les routes admin KB (liste + détail).
 * `async` requis par Next 16 strict pour tout export d'un fichier `"use server"`.
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
 * `async` requis par Next 16 strict pour tout export d'un fichier `"use server"`.
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
