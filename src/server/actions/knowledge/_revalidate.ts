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
export async function revalidatePublicKbRoutes(type: KbType): Promise<void> {
  const route = KB_PUBLIC_ROUTES[type];
  if (route) {
    revalidatePath(`/fr${route.fr}`);
    revalidatePath(`/en${route.en}`);
  }
  // Hub agrégateur (créé Sprint KB-8 — revalidatePath sans erreur si la page n'existe pas)
  revalidatePath("/fr/ressources");
  revalidatePath("/en/resources");
}
