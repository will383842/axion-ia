/**
 * U7-f — « Relire les échanges du pont » (lot F-CAL-2). Un geste humain, confirmé
 * (`confirmer=oui`), réservé à la direction et à la responsable qualité, et seulement
 * quand `formateurs.suivi_echange` est allumé. Le journal garde la liste figée AVANT
 * (nombre, empreinte des identifiants) et le résultat APRÈS — aucun nom, aucune adresse.
 */

"use server";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { adminPath } from "@/lib/admin-path";
import { prisma } from "@/lib/prisma";
import { peutEngager } from "@/server/auth/habilitations";
import { enrichCalendlyEvent } from "@/server/calendly/enrich";
import { relireEchangesDuPont } from "@/server/calendly/pont-echanges-formateur";
import { lireEtatsEntree } from "@/server/qualiopi/formateurs-independants/etats-entree";

export type EtatPontEchanges =
  { etat: "initial" } | { etat: "ok"; message: string } | { etat: "erreur"; message: string };

export async function relireEchangesDuPontAction(
  _prev: EtatPontEchanges,
  fd: FormData,
): Promise<EtatPontEchanges> {
  const session = await auth();
  if (!session?.user?.id) return { etat: "erreur", message: "Session expirée." };
  const role = (session.user as { role?: string }).role;
  if (!peutEngager(role, "habiliter_formateur")) {
    return { etat: "erreur", message: "Ce geste est réservé à la direction et à la qualité." };
  }
  if (!(await lireEtatsEntree()).suivi_echange) {
    return { etat: "erreur", message: "Le suivi de l'échange formateur est coupé." };
  }
  if (fd.get("confirmer") !== "oui") {
    return { etat: "erreur", message: "Confirmez la relecture : rien n'est fait sans vous." };
  }

  let bilan: Awaited<ReturnType<typeof relireEchangesDuPont>>;
  try {
    bilan = await relireEchangesDuPont(new Date(), (id) => enrichCalendlyEvent(id));
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "pont-echanges-formateur" } });
    return { etat: "erreur", message: "La relecture a échoué. Réessayez dans un instant." };
  }

  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: session.user.id,
        action: "formateurs.pont_echanges.relus",
        targetType: null,
        targetId: null,
        changes: { ...bilan, date: new Date().toISOString() },
      },
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "pont-echanges-formateur", step: "journal" } });
  }

  revalidatePath(adminPath("fr", "qualiopi/formateurs/echanges-du-pont"));
  return {
    etat: "ok",
    message:
      `Liste figée : ${bilan.avant.nombre} échange(s), dont ${bilan.avant.aVerifier} sans candidature. ` +
      `${bilan.relus} relu(s) auprès de Calendly, ${bilan.rattaches} rattaché(s). ` +
      `Reste : ${bilan.apres.aVerifier} à vérifier, ${bilan.apres.aTrancher} à trancher.` +
      (bilan.plafondAtteint ? " Plafond atteint : relancez la relecture pour la suite." : ""),
  };
}
