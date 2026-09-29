// ⚠️ PAS de `import "server-only"` : ce module tourne dans le WORKER (`tsx`).
// Gardé par `tests/unit/ci/aucun-module-du-worker-nimporte-server-only.spec.ts`.

/**
 * PROPOSER LE RÉSEAU D'APPORTEURS AUTOMATIQUEMENT (Will, 2026-09-29).
 *
 * « Pour ceux qui postulent à des offres salariées, ne pourrait-on pas leur dire
 * que les postes salariés sont pourvus et qu'ils peuvent, s'ils le souhaitent,
 * postuler au poste d'apporteur d'affaires indépendant, et leur envoyer le même
 * lien Calendly pour un rendez-vous de 15 minutes ? » — pour les FUTURES
 * candidatures seulement (`DEBUT_PROPOSITION_RESEAU`).
 *
 * Le geste est EXACTEMENT celui du bouton « Proposer le réseau d'apporteurs »
 * de la fiche (`proposer-reseau-actions.ts`) : fiche apporteur née de la
 * candidature, puis `envoyerInvitationApporteur` — donc toutes ses gardes (une
 * invitation par personne, opposition, envoi à valider), le texte adapté à une
 * personne venue d'une offre d'emploi, les rappels J+3 / J+7 et le suivi de la
 * réservation dans la console. Rien n'est recopié.
 *
 * Deux cas :
 *  · poste SALARIÉ → avec la réponse « poste pourvu » (appelé par
 *    `reponse-poste-pourvu.ts`, qui annonce l'invitation dans son texte) ;
 *  · candidature SPONTANÉE à un poste commercial → invitation seule, sans
 *    « poste pourvu » : c'était le seul chemin commercial qui n'entrait pas
 *    dans le tunnel (les offres `commercial` y entrent par `invitation-auto`).
 */

import * as Sentry from "@sentry/nextjs";

import { prisma } from "@/lib/prisma";
import { creerFicheApporteurDepuisCandidature } from "@/features/admin-job-applications/fiche-apporteur-depuis-candidature";
import { envoyerInvitationApporteur } from "@/features/commercial-application/invitation-apporteur";
import { lienReservationAuto } from "@/features/commercial-application/invitation-auto";
import { consignerEvenement } from "@/features/admin-job-applications/journal";

/**
 * Seules les candidatures reçues À PARTIR de cette date sont concernées : les
 * précédentes sont traitées (ordre de Will, 29/09 — ne pas y revenir).
 */
export const DEBUT_PROPOSITION_RESEAU = new Date("2026-09-29T12:00:00+02:00");

/** Une spontanée commerciale attend ce délai, comme les autres invitations automatiques. */
export const DELAI_SPONTANEE_MS = 15 * 60_000;

/** Intitulés d'une candidature spontanée qui relèvent du tunnel apporteur. */
export const MOTS_COMMERCIAUX = ["commercial", "business dev", "apporteur"] as const;

export type IssueProposition =
  | { readonly fiche: "creee"; readonly submissionId: string }
  | { readonly fiche: "impossible"; readonly raison: string };

/** Le lien de réservation est-il posé ? Sans lui, on ne promet rien. */
export function propositionPossible(): boolean {
  return lienReservationAuto() !== null;
}

/**
 * Étape 1 : la fiche apporteur. Faite AVANT la réponse « poste pourvu » pour que
 * celle-ci n'annonce une invitation QUE si elle va vraiment partir (une personne
 * déjà apporteur, par exemple, n'est pas réinvitée).
 */
export async function preparerProposition(
  applicationId: string,
  cas: "poste-pourvu" | "spontanee-commerciale",
): Promise<IssueProposition> {
  if (!propositionPossible()) return { fiche: "impossible", raison: "lien-calendly-absent" };
  const r = await creerFicheApporteurDepuisCandidature({
    applicationId,
    acteurId: null,
    proposition: cas,
    message:
      cas === "poste-pourvu"
        ? "Réseau proposé automatiquement avec la réponse « poste pourvu ». Invitation à l'échange de 15 minutes envoyée."
        : "Candidature spontanée à un poste commercial : invitation automatique à l'échange de 15 minutes.",
  });
  if (!r.ok) return { fiche: "impossible", raison: r.erreur };
  if (r.deja) return { fiche: "impossible", raison: "deja-proposee" };
  return { fiche: "creee", submissionId: r.submissionId };
}

/** Étape 2 : l'invitation, par la fonction du bouton de la console. Trace au journal de la candidature. */
export async function envoyerProposition(
  applicationId: string,
  submissionId: string,
): Promise<"envoyee" | "en-validation" | "non-partie"> {
  const calendlyUrl = lienReservationAuto();
  let issue: "envoyee" | "en-validation" | "non-partie" = "non-partie";
  if (calendlyUrl) {
    try {
      const r = await envoyerInvitationApporteur({ submissionId, calendlyUrl, adminId: null });
      issue = r.ok ? (r.enValidation ? "en-validation" : "envoyee") : "non-partie";
    } catch (err) {
      Sentry.captureException(err, { tags: { action: "envoyerProposition" } });
    }
  }
  try {
    await consignerEvenement({
      applicationId,
      type: "note",
      authorId: null,
      authorName: "Proposition automatique du réseau d'apporteurs",
      summary:
        issue === "envoyee"
          ? "Réseau d'apporteurs proposé — invitation à l'échange de 15 minutes envoyée"
          : issue === "en-validation"
            ? "Réseau d'apporteurs proposé — invitation en attente de validation"
            : "Réseau d'apporteurs proposé — l'invitation n'est pas partie (voir la fiche apporteur)",
      meta: { submissionId, issue },
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "envoyerProposition", step: "journal" } });
  }
  return issue;
}

/**
 * Passage : les candidatures SPONTANÉES à un poste commercial, reçues depuis
 * `DEBUT_PROPOSITION_RESEAU`, vieilles d'au moins 15 minutes, jamais basculées.
 * Invitation seule — jamais de « poste pourvu ».
 */
export async function proposerAuxSpontaneesCommerciales(
  maintenant: Date = new Date(),
  idsTunnel: readonly string[] = [],
): Promise<{ proposees: number; ecartees: number }> {
  if (!propositionPossible()) return { proposees: 0, ecartees: 0 };
  const candidates = await prisma.jobApplication.findMany({
    where: {
      offer: null,
      status: "new",
      replies: { none: {} },
      vivierOpposedAt: null,
      submittedAt: {
        gte: DEBUT_PROPOSITION_RESEAU,
        lte: new Date(maintenant.getTime() - DELAI_SPONTANEE_MS),
      },
      ...(idsTunnel.length > 0 ? { id: { notIn: [...idsTunnel] } } : {}),
      OR: MOTS_COMMERCIAUX.map((m) => ({
        offerTitleSnap: { contains: m, mode: "insensitive" as const },
      })),
    },
    select: { id: true },
    orderBy: { submittedAt: "asc" },
    // Fenêtre large : une personne déjà apporteur (doublon) reste éligible et ne
    // doit pas occuper la place des suivantes.
    take: 50,
  });
  let proposees = 0;
  let ecartees = 0;
  for (const c of candidates) {
    const p = await preparerProposition(c.id, "spontanee-commerciale");
    if (p.fiche !== "creee") {
      ecartees += 1;
      continue;
    }
    await envoyerProposition(c.id, p.submissionId);
    proposees += 1;
  }
  return { proposees, ecartees };
}
