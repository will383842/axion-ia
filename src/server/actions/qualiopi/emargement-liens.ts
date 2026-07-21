/**
 * Qualiopi T13 — Délivrance des liens de signature (oubli O4 du plan).
 *
 * Le jeton existait et n'atteignait personne : le plan marque ce point comme
 * bloquant, et il a raison. Trois surfaces, décidées par Will, qui servent des
 * publics disjoints :
 *
 *  · **QR + lien affichés à l'admin** — le formateur montre l'écran, chacun
 *    scanne et signe EN PARALLÈLE sur son propre téléphone. C'est le meilleur
 *    mode en salle : douze signatures simultanées, et l'identification ne repose
 *    pas sur le formateur.
 *  · **E-mail** — indispensable en distanciel, où le stagiaire est chez lui.
 *  · **Poste du formateur** — pour qui n'a rien (déjà livré, tranche 16).
 *
 * ⚠️ Le lien en CLAIR n'existe qu'ici, le temps de l'afficher ou de l'envoyer.
 * La base n'en conserve que le SHA-256 : régénérer un lien perdu suppose d'en
 * émettre un nouveau, ce qui révoque l'ancien. C'est voulu — deux liens en
 * circulation rendraient la révocation illusoire.
 */

"use server";

import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { qrDataUrl } from "@/server/qualiopi/documents/qr";
import {
  creerTokenInscription,
  revoquerTokensInscription,
  TokenEmargementError,
} from "@/server/qualiopi/emargement/token-service";

type ActionResult<T> = { data: T } | { error: string };

export interface LienEmargement {
  enrollmentId: string;
  stagiaireNom: string;
  url: string;
  /** PNG en data-URL, prêt à afficher. */
  qr: string;
  expiresAt: Date;
}

/**
 * Émet un lien de signature pour CHAQUE inscrit actif d'une session.
 *
 * Idempotent au sens utile : réémettre remplace les liens précédents, dans la
 * même transaction que leur révocation. Un admin qui reclique n'obtient donc
 * jamais deux liens vivants pour la même personne.
 *
 * Les abandons et exclus sont exclus de l'émission — mais leurs signatures
 * DÉJÀ apposées restent valides et comptées : c'est l'oubli O3 du plan, et les
 * heures concernées sont précisément celles à facturer à l'OPCO.
 */
export async function emettreLiensSessionAction(input: {
  sessionId: string;
}): Promise<ActionResult<{ liens: LienEmargement[] }>> {
  const session = await requireAdminWrite();

  const formation = await prisma.trainingSession.findUnique({
    where: { id: input.sessionId },
    select: {
      dateFin: true,
      enrollments: {
        where: { statut: { notIn: ["abandon", "exclu"] }, trainee: { deletedAt: null } },
        select: { id: true, trainee: { select: { nom: true, prenom: true } } },
        orderBy: { trainee: { nom: "asc" } },
      },
    },
  });

  if (formation === null) return { error: "Session introuvable" };
  if (formation.enrollments.length === 0) {
    return { error: "Aucun stagiaire actif inscrit à cette session." };
  }

  // Même convention que le reste du dépôt (`indexnow.ts`, `same-origin.ts`).
  const base = (process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://axion-ia.com").replace(/\/+$/, "");
  const liens: LienEmargement[] = [];

  for (const inscription of formation.enrollments) {
    try {
      const { token, expiresAt } = await creerTokenInscription({
        enrollmentId: inscription.id,
        dateFinSession: formation.dateFin,
      });
      const url = `${base}/fr/portail/emarger/${token}`;
      liens.push({
        enrollmentId: inscription.id,
        stagiaireNom: `${inscription.trainee.prenom} ${inscription.trainee.nom}`.trim(),
        url,
        qr: await qrDataUrl(url),
        expiresAt,
      });
    } catch (err) {
      // Le refus « journées non déclarées » est actionnable : il vaut pour toute
      // la session, inutile de le répéter par stagiaire.
      if (err instanceof TokenEmargementError) return { error: err.message };
      Sentry.captureException(err, {
        tags: { action: "emettreLiensSessionAction" },
        extra: { sessionId: input.sessionId },
      });
      return { error: "Impossible d'émettre les liens de signature." };
    }
  }

  await logQualiopiActivity({
    action: "qualiopi.emargement.liens.emettre",
    targetType: "TrainingSession",
    targetId: input.sessionId,
    changes: { nbLiens: liens.length },
    session,
  });

  return { data: { liens } };
}

/**
 * Révoque tous les liens d'une session.
 *
 * Cas d'usage : session annulée ou reportée (oubli O7). Sans cela, un stagiaire
 * pourrait signer une session qui n'a pas eu lieu — et la signature serait
 * parfaitement valide au sens cryptographique, ce qui est pire qu'inutile.
 */
export async function revoquerLiensSessionAction(input: {
  sessionId: string;
  motif: string;
}): Promise<ActionResult<{ revoques: number }>> {
  const session = await requireAdminWrite();

  const inscriptions = await prisma.enrollment.findMany({
    where: { sessionId: input.sessionId },
    select: { id: true },
  });

  let revoques = 0;
  for (const i of inscriptions) {
    revoques += await revoquerTokensInscription({
      enrollmentId: i.id,
      motif: input.motif,
      parAdminId: session.userId,
    });
  }

  await logQualiopiActivity({
    action: "qualiopi.emargement.liens.revoquer",
    targetType: "TrainingSession",
    targetId: input.sessionId,
    changes: { revoques, motif: input.motif },
    session,
  });

  return { data: { revoques } };
}
