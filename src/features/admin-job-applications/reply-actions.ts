// Répondre à un candidat DEPUIS LA CONSOLE — Server Actions.
//
// Calque de `admin-submissions/reply-actions.ts`, avec deux écarts assumés,
// tous deux documentés à leur point d'application :
//   1. la garde de rôle (voir `requireEcritureCandidature`) ;
//   2. l'écriture au journal DANS la transaction (voir `repondreAuCandidatAction`).

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { updateTag } from "next/cache";
import * as Sentry from "@sentry/nextjs";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import { enqueueEmail } from "@/server/queue/queues";
import { peutOuvrirDossierCandidat } from "@/server/auth/habilitations";
import { INBOX_COUNTS_TAG } from "@/features/admin-inbox/cache-tags";

import { ecrireEtEnfilerReponse } from "./envoyer-reponse";
import { remplirModele } from "@/content/recrutement/modeles-reponse";
import { CHEMIN_COMPLEMENT, lienComplement } from "@/features/job-application/complement";
import { DUREE_JETON_COMPLEMENT_MS } from "@/server/recrutement/jeton-complement";
import {
  MODELES_COMPOSEUR_IDS,
  MODELES_REPONSE_FORMATEUR_IDS,
  modeleAutorise,
} from "@/content/recrutement/modeles-reponse";
import { estCandidatureFormateurFreelance } from "@/lib/careers/formateur-freelance";
import { lireEtatsEntree } from "@/server/qualiopi/formateurs-independants/etats-entree";

/**
 * Qui peut écrire à un candidat.
 *
 * 🔴 ÉCART DÉLIBÉRÉ avec `requireAdminWriteSession` des messages, qui autorise
 * `super_admin | admin | editor`.
 *
 * Répondre à une candidature expose nécessairement l'identité du candidat :
 * l'action lit son adresse, la déchiffre, et la met dans un e-mail. Or `editor`
 * n'a PAS le droit d'ouvrir un dossier de candidat (`ROLES_DOSSIER_CANDIDAT`).
 * Reprendre la garde des messages ici aurait recréé, sur une surface neuve,
 * exactement le défaut `T5` de l'audit : un rôle qui écrit sur un dossier qu'il
 * ne peut pas lire.
 *
 * On applique donc le prédicat de LECTURE du dossier, qui est le bon périmètre
 * — quiconque peut écrire doit pouvoir lire. L'alignement du reste des actions
 * de candidature (mise à jour de statut, notes) relève du lot 6 ; ce n'est pas
 * une raison pour construire le défaut en avant.
 */
async function requireEcritureCandidature(): Promise<{
  userId: string;
  nom: string;
}> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role ?? "reader";
  if (!peutOuvrirDossierCandidat(role)) throw new Error("forbidden");
  const nom = (session.user as { name?: string }).name ?? session.user.email ?? session.user.id;
  return { userId: session.user.id, nom };
}

const schemaReponse = z.object({
  applicationId: z.string().uuid(),
  /**
   * Objet du message.
   *
   * Le référentiel e-mail borne l'objet à 45 caractères VISIBLES (`OBJET_MAX`) —
   * au-delà, les clients de messagerie coupent. Ce n'est pas imposé ici : c'est
   * un objet écrit par un humain pour un autre, et refuser une soumission à 47
   * caractères serait une contrainte de forme là où le composeur peut se
   * contenter d'avertir. La borne à 120 protège la colonne, pas le style.
   */
  subject: z.string().min(2).max(120),
  bodyMarkdown: z.string().min(1).max(50_000),
  modele: z.enum(MODELES_COMPOSEUR_IDS).default("libre"),
  internalNote: z.string().max(2000).optional(),
});

export type EtatReponse =
  | { ok: true; replyId: string }
  /** `replyId` présent si la réponse est en base mais que l'envoi a échoué :
   *  elle est alors rejouable, et l'écran doit le proposer. */
  | { ok: false; error: string; replyId?: string };

export async function repondreAuCandidatAction(
  input: z.input<typeof schemaReponse>,
): Promise<EtatReponse> {
  let acteur: { userId: string; nom: string };
  try {
    acteur = await requireEcritureCandidature();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unauthorized" };
  }

  const parsed = schemaReponse.safeParse(input);
  if (!parsed.success) return { ok: false, error: "champs_invalides" };
  const data = parsed.data;

  const candidature = await prisma.jobApplication.findUnique({
    where: { id: data.applicationId },
    select: {
      id: true,
      email: true,
      locale: true,
      status: true,
      offerTitleSnap: true,
      firstName: true,
      lastName: true,
      offer: {
        select: {
          id: true,
          screeningQuestions: true,
          slug: true,
          titleFr: true,
          employmentType: true,
          secondaryEmploymentType: true,
        },
      },
    },
  });
  if (!candidature) return { ok: false, error: "candidature_introuvable" };

  // Lot L0c-2 — un modèle « formateur » n'est accepté que là où le composeur le
  // propose (candidature de formateur freelance, `formateurs.modeles_composeur`).
  if ((MODELES_REPONSE_FORMATEUR_IDS as readonly string[]).includes(data.modele)) {
    const modelesFormateur =
      (await lireEtatsEntree()).modeles_composeur &&
      estCandidatureFormateurFreelance({
        offerTitleSnap: candidature.offerTitleSnap,
        offer: candidature.offer,
      });
    if (!modeleAutorise(data.modele, { modelesFormateur })) {
      return { ok: false, error: "modele_indisponible" };
    }
  }

  // `{lien_complement}` se résout ICI, côté serveur : le lien est signé avec
  // AUTH_SECRET, que le navigateur n'a pas. Une offre sans questions n'a pas
  // de lien — on refuse plutôt que d'envoyer « {lien_complement} » en clair.
  let corps = data.bodyMarkdown;
  if (corps.includes("{lien_complement}")) {
    const lien = await lienComplement(candidature.id, candidature.offer);
    if (!lien) return { ok: false, error: "lien_complement_indisponible" };
    corps = remplirModele(corps, { lien_complement: lien });
  }

  // 🔴 GARDE CONTRE LE DOUBLE ENVOI, CÔTÉ SERVEUR — dans la transaction
  // d'écriture (`garderContreDoublon`), sous verrou consultatif : une recherche
  // faite ici, hors transaction, ne tenait pas face à deux requêtes simultanées.
  // Une réponse identique (même auteur, objet, corps, moins de 60 s, ni
  // `failed` ni `bounced`) est LA MÊME demande : on rend son identifiant.

  // 🔑 L'ÉCRITURE PASSE PAR `ecrireEtEnfilerReponse`, ET C'EST LE MÊME CHEMIN
  // QUE L'ENVOI GROUPÉ. Ces cent lignes vivaient ici ; les recopier dans le
  // geste groupé les aurait fait dériver, et ce qui se perd dans une copie, ce
  // sont exactement les gestes qui ne se voient pas à l'écran : la transaction
  // qui tient ensemble la réponse et sa trace, le `new` qui passe à
  // `reviewing`, et le `failed` posé quand la file d'envoi refuse.
  const issue = await ecrireEtEnfilerReponse(
    candidature,
    acteur,
    {
      subject: data.subject,
      bodyMarkdown: corps,
      // Le texte saisi, avant remplacement du lien : la garde compare dessus.
      texteSaisi: data.bodyMarkdown,
      modele: data.modele,
      internalNote: data.internalNote,
    },
    { garderContreDoublon: true },
  );

  if (!issue.ecrit && issue.error === "doublon") return { ok: true, replyId: issue.replyId };
  if (!issue.ecrit) return { ok: false, error: issue.error };

  revalidatePath(adminPath("fr", "contacts/candidatures"));
  revalidatePath(adminPath("fr", `contacts/candidatures/${candidature.id}`));
  updateTag(INBOX_COUNTS_TAG);

  // 🔴 La réponse EXISTE, marquée `failed`. On rend son identifiant pour que
  // l'écran propose de la rejouer — un échec de file n'est pas un message perdu.
  if (!issue.enfile) return { ok: false, error: issue.error, replyId: issue.replyId };

  return { ok: true, replyId: issue.replyId };
}

/** Remet en file une réponse dont l'envoi a échoué. */
export async function rejouerReponseEchoueeAction(replyId: string): Promise<EtatReponse> {
  try {
    await requireEcritureCandidature();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unauthorized" };
  }

  const reponse = await prisma.jobApplicationReply.findUnique({
    where: { id: replyId },
    select: {
      id: true,
      applicationId: true,
      subject: true,
      deliveryStatus: true,
      bodyText: true,
      repliedAt: true,
    },
  });
  if (!reponse) return { ok: false, error: "candidature_introuvable" };
  // 🔴 Seule une réponse `failed` se rejoue. `pending` (déjà en file ou en cours
  // d'envoi : un rejeu ferait partir deux fois le même message), `sent`,
  // `bounced` (adresse refusée : on ne sait pas distinguer un refus définitif
  // d'un refus temporaire) et tout autre statut sont refusés, sans mise en file.
  if (reponse.deliveryStatus === "sent") return { ok: false, error: "deja_envoyee" };
  if (reponse.deliveryStatus !== "failed") return { ok: false, error: "not_retryable" };

  const candidature = await prisma.jobApplication.findUnique({
    where: { id: reponse.applicationId },
    select: { locale: true },
  });
  if (!candidature) return { ok: false, error: "candidature_introuvable" };

  // Le lien de complément porte un jeton de 60 jours : on ne rejoue pas un message
  // dont le lien expirerait avant d'être lu (marge de 2 jours pour l'attente en file).
  if (
    reponse.bodyText.includes(CHEMIN_COMPLEMENT) &&
    Date.now() - reponse.repliedAt.getTime() > DUREE_JETON_COMPLEMENT_MS - 2 * 24 * 3600 * 1000
  ) {
    return { ok: false, error: "lien_complement_expire" };
  }

  // Prise de la ligne AVANT la mise en file, de façon atomique : deux rejeux
  // simultanés ne passent pas tous les deux (le second ne trouve plus `failed`),
  // et le worker ne peut plus marquer `sent` puis se faire écraser par `pending`.
  const prise = await prisma.jobApplicationReply.updateMany({
    where: { id: reponse.id, deliveryStatus: "failed" },
    data: { deliveryStatus: "pending", errorMsg: null },
  });
  if (prise.count === 0) return { ok: false, error: "not_retryable" };

  let misEnFile = false;
  try {
    const r = await enqueueEmail("candidature-reponse", "", candidature.locale, {
      replyId: reponse.id,
      subject: reponse.subject,
      applicationId: reponse.applicationId,
    });
    misEnFile = r.enqueued;
  } catch (e) {
    Sentry.captureException(e);
  }
  if (!misEnFile) {
    // La file a refusé : la ligne redevient rejouable.
    await prisma.jobApplicationReply
      .updateMany({
        where: { id: reponse.id, deliveryStatus: "pending" },
        data: { deliveryStatus: "failed", errorMsg: "enqueue_failed (file d'envoi indisponible)" },
      })
      .catch((e) => Sentry.captureException(e));
    return { ok: false, error: "enqueue_failed", replyId: reponse.id };
  }

  revalidatePath(adminPath("fr", `contacts/candidatures/${reponse.applicationId}`));
  return { ok: true, replyId: reponse.id };
}

/** État de livraison d'une réponse — sondé par le composeur après l'envoi. */
export async function etatLivraisonReponseAction(
  replyId: string,
): Promise<{ statut: string; erreur: string | null } | null> {
  try {
    await requireEcritureCandidature();
  } catch {
    return null;
  }
  const r = await prisma.jobApplicationReply.findUnique({
    where: { id: replyId },
    select: { deliveryStatus: true, errorMsg: true },
  });
  return r ? { statut: r.deliveryStatus, erreur: r.errorMsg } : null;
}
