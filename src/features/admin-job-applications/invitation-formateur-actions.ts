// L-INV et CAMP-4 — les gestes de la console sur l'invitation d'un candidat formateur
// indépendant :
//   · « J'ai répondu ailleurs » (calque du geste apporteur `repondu-ailleurs`) : une ligne
//     `reponses_entrantes_formateurs` (source `hors_circuit`), qui arrête les rappels S1 ;
//   · le RATTRAPAGE unique du stock (F55, U7 b) : envoi à la liste FIGÉE vue en aperçu.
//
// Gardes : rôle relu ici (pas seulement à l'écran) ; interrupteurs relus ; aucun statut de
// recrutement écrit ; journal sans donnée personnelle (identifiants et compteurs).

"use server";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { adminPath } from "@/lib/admin-path";
import { prisma } from "@/lib/prisma";
import { peutEngager } from "@/server/auth/habilitations";
import { invitationAutoFormateursAllumee } from "@/server/qualiopi/formateurs-independants/etats-entree";
import { envoyerRattrapage } from "@/server/qualiopi/formateurs-independants/invitation-formateurs";

export type EtatGesteInvitation =
  { etat: "initial" } | { etat: "ok"; message: string } | { etat: "erreur"; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function acteur(
  acte: "habiliter_formateur" | "contresigner",
): Promise<{ id: string } | string> {
  const s = await auth();
  if (!s?.user?.id) return "Session expirée : reconnectez-vous.";
  const role = (s.user as { role?: string }).role;
  if (!peutEngager(role, acte)) return "Votre rôle ne permet pas ce geste.";
  return { id: s.user.id };
}

export async function reponduAilleursFormateurAction(
  _prev: EtatGesteInvitation,
  fd: FormData,
): Promise<EtatGesteInvitation> {
  const qui = await acteur("habiliter_formateur");
  if (typeof qui === "string") return { etat: "erreur", message: qui };
  if (!(await invitationAutoFormateursAllumee())) {
    return { etat: "erreur", message: "L'invitation automatique est coupée." };
  }
  const id = fd.get("candidatureId");
  if (typeof id !== "string" || !UUID.test(id))
    return { etat: "erreur", message: "Candidature invalide." };
  try {
    const existe = await prisma.jobApplication.findUnique({ where: { id }, select: { id: true } });
    if (!existe) return { etat: "erreur", message: "Candidature introuvable." };
    await prisma.reponseEntranteFormateur.create({
      data: {
        candidatureId: id,
        source: "hors_circuit",
        recuLe: new Date(),
        auto: false,
        auteurId: qui.id,
      },
      select: { id: true },
    });
    await prisma.activityLog.create({
      data: {
        adminUserId: qui.id,
        action: "careers.candidature.formateur_repondu_ailleurs",
        targetType: "JobApplication",
        targetId: id,
        changes: { source: "hors_circuit" },
      },
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "repondu-ailleurs-formateur" } });
    return { etat: "erreur", message: "Le geste n'a pas été enregistré. Réessayez." };
  }
  revalidatePath(adminPath("fr", `contacts/candidatures/${id}`));
  return { etat: "ok", message: "Noté : les rappels de l'invitation s'arrêtent." };
}

export async function envoyerRattrapageFormateursAction(
  _prev: EtatGesteInvitation,
  fd: FormData,
): Promise<EtatGesteInvitation> {
  // Un envoi groupé : l'administrateur seulement.
  const qui = await acteur("contresigner");
  if (typeof qui === "string") return { etat: "erreur", message: qui };
  if (fd.get("confirmer") !== "oui") {
    return { etat: "erreur", message: "Confirmez l'envoi : rien ne part sans votre relecture." };
  }
  const empreinte = fd.get("empreinte");
  if (typeof empreinte !== "string" || !/^[0-9a-f]{64}$/.test(empreinte)) {
    return { etat: "erreur", message: "Aperçu manquant : rouvrez la liste." };
  }
  let r: Awaited<ReturnType<typeof envoyerRattrapage>>;
  try {
    r = await envoyerRattrapage(new Date(), empreinte);
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "rattrapage-formateurs" } });
    return { etat: "erreur", message: "L'envoi a échoué. Réessayez dans un instant." };
  }
  if (!r.ok) {
    return {
      etat: "erreur",
      message:
        r.motif === "coupe"
          ? "L'invitation automatique ou le suivi de l'échange est coupé."
          : "La liste a changé depuis votre aperçu : rien n'est parti. Relisez-la.",
    };
  }
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: qui.id,
        action: "formateurs.rattrapage_invitation.envoye",
        targetType: null,
        targetId: null,
        changes: {
          empreinteListe: r.empreinteAvant,
          nombre: r.nombreAvant,
          envoyes: r.envoyes,
          refus: r.refus,
          restants: r.restants,
          date: new Date().toISOString(),
        },
      },
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "rattrapage-formateurs", step: "journal" } });
  }
  revalidatePath(adminPath("fr", "qualiopi/formateurs/rattrapage"));
  return {
    etat: "ok",
    message:
      `${r.envoyes} invitation(s) envoyée(s) sur ${r.nombreAvant}` +
      (r.refus ? `, ${r.refus} non partie(s)` : "") +
      (r.restants ? `. Reste ${r.restants} : rouvrez la liste pour la suite.` : "."),
  };
}
