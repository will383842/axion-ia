// Droits RGPD d'un formateur indépendant — effacement art. 17 (lot L16a, ADR 0066).
//
// Geste d'ADMINISTRATEUR, jamais automatique : garde super-admin, confirmation
// saisie mot pour mot, identifiant de fiche (UUID). L'effacement est une
// PSEUDONYMISATION — aucune suppression de fiche, de pièce ni de contenu (cf.
// `@/lib/rgpd-formateur-independant`). Le journal est écrit dans la même
// transaction, sans donnée personnelle.

"use server";

import { z } from "zod";
import { requireSuperAdmin, donneesJournalQualiopi } from "@/server/actions/qualiopi/_guards";
import {
  CONFIRMATION_EFFACEMENT_FORMATEUR,
  effacerFormateurIndependant,
  type EffacementFormateurResult,
} from "@/lib/rgpd-formateur-independant";

const schema = z.object({
  trainerId: z.string().uuid(),
  confirmation: z.literal(CONFIRMATION_EFFACEMENT_FORMATEUR),
});

export type EtatEffacementFormateur =
  { ok: true; resultat: EffacementFormateurResult } | { ok: false; error: string };

export async function effacerFormateurIndependantAction(
  input: z.input<typeof schema>,
): Promise<EtatEffacementFormateur> {
  const session = await requireSuperAdmin();
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Confirmation requise : saisir « ${CONFIRMATION_EFFACEMENT_FORMATEUR} ».`,
    };
  }
  const { trainerId } = parsed.data;
  try {
    const resultat = await effacerFormateurIndependant(trainerId, {
      acteurId: session.userId,
      journal: (r) =>
        donneesJournalQualiopi({
          action: "qualiopi.trainer.rgpd_effacement",
          targetType: "Trainer",
          targetId: trainerId,
          changes: { ...r },
          session,
        }),
    });
    if (resultat.formateur === "eteint") {
      return { ok: false, error: "Droits RGPD des formateurs non encore ouverts." };
    }
    if (resultat.formateur === "illisible") {
      return { ok: false, error: "Réglage illisible : rien n'a été fait." };
    }
    if (resultat.formateur === "aucun") {
      return { ok: false, error: "Aucun formateur indépendant pour cette fiche." };
    }
    return { ok: true, resultat };
  } catch {
    return { ok: false, error: "Effacement impossible : rien n'a été modifié." };
  }
}
