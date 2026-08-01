"use server";

// Server Action — Défaut P0 « file de validation sans action » (audit UX
// 2026-08). La file « Qualité » (`requiresHumanReview` / `requiresHumanTaxonomy`)
// renvoyait vers la fiche détail, strictement en lecture : aucun bouton pour
// en sortir une image, la page n'avait donc aucun sens pour un utilisateur.
//
// Deux actions minimales, sur le modèle des Server Actions de mutation déjà
// présentes du dossier (`publish.action.ts` : auth() + redirect si non-admin,
// Zod aux frontières, `revalidateTag` Next 16 2-arg) :
//   - validateImageAction      : efface les deux flags de revue humaine
//                                 (priorité P0 — c'est elle qui donne son sens
//                                 à la file).
//   - correctImageModuleAction : réécrit `module` (taxonomie SSOT
//                                 @/server/image-bank/taxonomy) + efface
//                                 requiresHumanTaxonomy (l'admin vient de
//                                 corriger manuellement).
//
// Signature `(prevState, formData)` : compatible `useActionState` (React 19),
// idiome dominant de la console pour les boutons de mutation avec feedback
// (cf. `OptionActions.tsx`, `BookingActions.tsx`, `InvoiceActions.tsx`).

import { redirect } from "next/navigation";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CACHE_TAGS } from "@/server/image-bank/constants";
import { isValidModule } from "@/server/image-bank/taxonomy";

async function requireAdmin(): Promise<void> {
  const session = await auth();
  if (
    !session?.user?.role ||
    (session.user.role !== "admin" && session.user.role !== "super_admin")
  ) {
    redirect("/api/auth/signin?error=Unauthorized");
  }
}

export type ReviewActionState = { ok: true } | { ok: false; error: string };

const ValidateSchema = z.object({ imageId: z.string().uuid() });

/** Efface `requiresHumanReview` + `requiresHumanTaxonomy` — sort l'image de la
 * file « Qualité ». Action prioritaire (P0) : sans elle, la file n'a aucune
 * issue possible. */
export async function validateImageAction(
  _prev: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  await requireAdmin();

  const parsed = ValidateSchema.safeParse({ imageId: formData.get("imageId") });
  if (!parsed.success) {
    return { ok: false, error: "Image invalide." };
  }

  try {
    await prisma.imageAsset.update({
      where: { id: parsed.data.imageId },
      data: { requiresHumanReview: false, requiresHumanTaxonomy: false },
    });
    revalidateTag(CACHE_TAGS.root, "default");
    return { ok: true };
  } catch (err) {
    // Jamais err.message à l'écran (P0 audit UX) — détail en log serveur.
    console.error("[image-bank:review] validateImageAction:", err);
    return { ok: false, error: "Échec de la validation — réessayez ou contactez le support." };
  }
}

const CorrectModuleSchema = z.object({
  imageId: z.string().uuid(),
  module: z.string().refine(isValidModule, "Module invalide."),
});

/** Réécrit `module` (taxonomie SSOT) — correctif manuel quand la détection
 * automatique a échoué ou est incertaine. Efface `requiresHumanTaxonomy`
 * (l'admin vient de trancher). */
export async function correctImageModuleAction(
  _prev: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  await requireAdmin();

  const parsed = CorrectModuleSchema.safeParse({
    imageId: formData.get("imageId"),
    module: formData.get("module"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Classement invalide." };
  }

  try {
    await prisma.imageAsset.update({
      where: { id: parsed.data.imageId },
      data: { module: parsed.data.module, requiresHumanTaxonomy: false },
    });
    revalidateTag(CACHE_TAGS.root, "default");
    return { ok: true };
  } catch (err) {
    // Jamais err.message à l'écran (P0 audit UX) — détail en log serveur.
    console.error("[image-bank:review] correctImageModuleAction:", err);
    return { ok: false, error: "Échec de l'enregistrement — réessayez ou contactez le support." };
  }
}
