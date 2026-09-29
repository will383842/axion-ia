// Enregistrer le point fait après un rendez-vous (2026-09-27).
//
// Garde : celle de l'écriture des appels (`peutVoirLesAppels`).
// `calendly_events.status` n'est pas touché, donc la synchro CRM (qui part sur
// `completed` / `no_show`) ne se déclenche pas.
//
// 2026-09-29 (chantier visio, PR 4) — l'écriture passe par la fonction UNIQUE
// `enregistrerSuivi()` (`features/dossier-client/suivi.ts`) : pour un
// rendez-vous CLIENT (liste blanche), elle écrit dans la même transaction le
// suivi de la rencontre du dossier (`rencontre_suivis`, l'autorité) ET la
// recopie lue par l'onglet (`rendez_vous_suivis`) ; pour un autre type, la
// recopie seule, comme avant.

"use server";

import { revalidatePath, updateTag } from "next/cache";
import * as Sentry from "@sentry/nextjs";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import { peutVoirLesAppels } from "@/features/admin-calendly/acces";
import { enregistrerSuivi } from "@/features/dossier-client/suivi";
import { lireFormulaireSuivi, normaliserSuivi, suiviSchema } from "./suivi";

export type EtatSuivi =
  { etat: "initial" } | { etat: "ok"; message: string } | { etat: "erreur"; message: string };

export async function enregistrerSuiviAction(
  _precedent: EtatSuivi,
  fd: FormData,
): Promise<EtatSuivi> {
  const session = await auth();
  if (!session?.user?.id) return { etat: "erreur", message: "Session expirée : reconnectez-vous." };
  const role = (session.user as { role?: string }).role;
  if (!peutVoirLesAppels(role)) {
    return { etat: "erreur", message: "Votre rôle ne permet pas de faire le point des appels." };
  }

  const parsed = suiviSchema.safeParse(lireFormulaireSuivi(fd));
  if (!parsed.success) {
    return { etat: "erreur", message: parsed.error.issues[0]?.message ?? "Champs invalides." };
  }
  const { calendlyEventId } = parsed.data;
  const donnees = normaliserSuivi(parsed.data);
  const renseignePar = session.user.email ?? null;

  try {
    const existe = await prisma.calendlyEvent.findUnique({
      where: { id: calendlyEventId },
      select: { id: true },
    });
    if (!existe) return { etat: "erreur", message: "Rendez-vous introuvable." };

    await enregistrerSuivi(prisma, {
      calendlyEventId,
      issue: donnees.issue,
      suite: donnees.suite,
      suiteLe: donnees.suiteLe,
      note: donnees.note,
      auteurId: session.user.id,
      renseignePar,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "rendez-vous-suivi" } });
    return { etat: "erreur", message: "L'enregistrement a échoué. Réessayez dans un instant." };
  }

  revalidatePath(adminPath("fr", "rendez-vous"));
  revalidatePath(adminPath("fr", `contacts/appels/${calendlyEventId}`));
  // La pastille du menu doit tomber tout de suite, pas dans 60 s.
  updateTag("admin:rendez-vous-a-faire");
  return { etat: "ok", message: "Point enregistré." };
}
