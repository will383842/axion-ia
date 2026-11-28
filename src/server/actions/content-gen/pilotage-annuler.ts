/**
 * Pilotage SEO — bouton « Annuler » (P13). Réservé à super_admin, admin et editor (`requireAdmin`).
 * Ne dépend pas du kill switch : un retour arrière est toujours permis.
 */
"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./_auth";
import { ConflitEcritureError } from "@/server/seo-pilotage/actions/journal";
import {
  annulerModification,
  type ResultatAnnulation,
  type TxAnnulation,
} from "@/server/seo-pilotage/actions/annuler";

export async function annulerModificationSeo(modificationId: string): Promise<ResultatAnnulation> {
  const session = await requireAdmin();
  if (
    typeof modificationId !== "string" ||
    modificationId.length === 0 ||
    modificationId.length > 60
  ) {
    return { ok: false, motif: "introuvable" };
  }
  const decidePar = session.userId.slice(0, 80);
  try {
    return await prisma.$transaction((tx) =>
      annulerModification(tx as unknown as TxAnnulation, modificationId, decidePar),
    );
  } catch (e) {
    if (e instanceof ConflitEcritureError) return { ok: false, motif: "conflit" };
    throw e;
  }
}
