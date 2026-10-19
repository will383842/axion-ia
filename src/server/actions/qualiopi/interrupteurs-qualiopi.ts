/**
 * Qualiopi — Server Action de l'écran « Interrupteurs Qualiopi » (chantier QNC).
 *
 * basculerInterrupteurQualiopiAction : change l'état d'UN interrupteur
 *   `qualiopi.<lot>.actif` (eteint / essai / actif). Réglage et ligne
 *   `activity_logs` s'écrivent dans la même transaction
 *   (`basculerInterrupteurQualiopi`) : sans trace, pas de bascule.
 *
 * Le lot doit appartenir à la liste connue de l'écran (jamais une clé libre) ;
 * le passage à `actif` exige la confirmation explicite du second temps de
 * l'interface, vérifiée AUSSI ici. Aucune suppression : une clé ne s'efface pas,
 * elle revient à `eteint`.
 */

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { adminPath } from "@/lib/admin-path";
import { requireAdminWrite } from "@/server/actions/qualiopi/_guards";
import {
  basculerInterrupteurQualiopi,
  ETATS_INTERRUPTEUR,
} from "@/server/qualiopi/socle/interrupteurs";
import { NOMS_LOTS_INTERRUPTEURS } from "@/server/qualiopi/socle/lots-interrupteurs";

export type EtatBasculeQualiopi =
  | { ok: true; message: string; etat: (typeof ETATS_INTERRUPTEUR)[number] }
  | { ok: false; error: string };

const basculeSchema = z.object({
  lot: z
    .string()
    .refine((l) => NOMS_LOTS_INTERRUPTEURS.includes(l), { message: "Interrupteur inconnu." }),
  etat: z.enum(ETATS_INTERRUPTEUR),
  confirmerActif: z.boolean().optional(),
});

export async function basculerInterrupteurQualiopiAction(input: {
  lot: string;
  etat: string;
  confirmerActif?: boolean;
}): Promise<EtatBasculeQualiopi> {
  const session = await requireAdminWrite();
  const parsed = basculeSchema.safeParse(input);
  if (!parsed.success) {
    const inconnu = parsed.error.issues.some((i) => i.path[0] === "lot");
    return { ok: false, error: inconnu ? "Interrupteur inconnu." : "État invalide." };
  }
  const { lot, etat, confirmerActif } = parsed.data;
  if (etat === "actif" && confirmerActif !== true) {
    return { ok: false, error: "Le passage à « actif » demande une confirmation explicite." };
  }
  try {
    const b = await basculerInterrupteurQualiopi({ lot, etat, adminUserId: session.userId });
    revalidatePath(adminPath("fr", "qualiopi/interrupteurs"));
    return {
      ok: true,
      etat: b.apres,
      message: b.avant === b.apres ? "Aucun changement." : `Enregistré : ${b.avant} → ${b.apres}.`,
    };
  } catch {
    return { ok: false, error: "La bascule a échoué : rien n'a été modifié." };
  }
}
