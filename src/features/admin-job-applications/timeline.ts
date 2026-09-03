import "server-only";

/**
 * LA FRISE D'UNE CANDIDATURE — lecture.
 *
 * ## Pourquoi ce module n'est PAS `"use server"`
 *
 * Chaque export d'un module `"use server"` devient un point d'entrée réseau.
 * Une lecture nue qui y vivrait serait appelable depuis l'extérieur, et la
 * garde de rôle de la page ne la protégerait pas. Les lectures vivent donc ici,
 * et l'appelant applique le prédicat — la même doctrine que `reads.ts`.
 *
 * ## Ce que la frise fusionne, et pourquoi ce n'est pas une simple liste
 *
 * Le journal dit ce qu'un HUMAIN a fait (« réponse envoyée »). L'état de
 * livraison dit ce que la chaîne d'envoi en a fait (`pending`, `sent`,
 * `failed`, `bounced`). Ce sont deux faits distincts, écrits par deux acteurs
 * distincts, et les confondre produirait soit deux lignes pour un seul geste,
 * soit une frise qui affirme « envoyée » d'un message resté en file.
 *
 * On garde donc UNE ligne par geste humain, ENRICHIE de ce que la chaîne
 * d'envoi en a fait. C'est la seule forme qui permette de lire « j'ai répondu
 * lundi, et ce n'est jamais parti ».
 */

import { prisma } from "@/lib/prisma";
import { peutOuvrirDossierCandidat } from "@/server/auth/habilitations";
import type {
  JobApplicationEventType,
  JobApplicationReplyStatus,
} from "../../../prisma/generated/client";

export interface LivraisonReponse {
  readonly statut: JobApplicationReplyStatus;
  readonly erreur: string | null;
  readonly envoyeeAt: Date | null;
  readonly reessais: number;
}

export interface EntreeFrise {
  readonly id: string;
  readonly type: JobApplicationEventType;
  /** Quand le FAIT a eu lieu — jamais quand il a été saisi. */
  readonly occurredAt: Date;
  readonly authorName: string;
  readonly summary: string;
  readonly body: string | null;
  /**
   * Présent uniquement pour un événement qui pointe une réponse. `null` quand
   * la réponse a disparu — un événement survit à ce qu'il mentionne, et la
   * frise doit continuer de dire qu'un message est parti ce jour-là.
   */
  readonly livraison: LivraisonReponse | null;
}

/**
 * La frise d'une candidature, du plus RÉCENT au plus ancien.
 *
 * 🔴 Refuse par défaut : un rôle inconnu n'obtient rien. Le prédicat est le même
 * que celui de l'ouverture du dossier — la frise porte le corps des messages
 * envoyés, donc le nom de la personne.
 */
export async function lireFrise(
  applicationId: string,
  acteur: { role: string | null | undefined },
): Promise<EntreeFrise[]> {
  if (!peutOuvrirDossierCandidat(acteur.role)) return [];

  const evenements = await prisma.jobApplicationEvent.findMany({
    where: { applicationId },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: 200,
  });
  if (evenements.length === 0) return [];

  // Une SEULE requête pour toutes les réponses citées — pas une par ligne.
  // Sur une candidature à vingt échanges, la version naïve ferait vingt
  // allers-retours pour afficher un écran.
  const idsReponses = evenements
    .map((e) => e.replyId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  const livraisons = new Map<string, LivraisonReponse>();
  if (idsReponses.length > 0) {
    const reponses = await prisma.jobApplicationReply.findMany({
      where: { id: { in: idsReponses } },
      select: {
        id: true,
        deliveryStatus: true,
        errorMsg: true,
        sentAt: true,
        retryCount: true,
      },
    });
    for (const r of reponses) {
      livraisons.set(r.id, {
        statut: r.deliveryStatus,
        erreur: r.errorMsg,
        envoyeeAt: r.sentAt,
        reessais: r.retryCount,
      });
    }
  }

  return evenements.map((e) => ({
    id: e.id,
    type: e.type,
    occurredAt: e.occurredAt,
    authorName: e.authorName,
    summary: e.summary,
    body: e.body,
    livraison: e.replyId ? (livraisons.get(e.replyId) ?? null) : null,
  }));
}

/** Libellés français des types d'événement — dérivés de l'enum, exhaustifs. */
export const LIBELLE_EVENEMENT: Record<JobApplicationEventType, string> = {
  statut_change: "Changement de statut",
  email_envoye: "Réponse envoyée",
  email_recu: "Message reçu",
  appel: "Appel",
  note: "Note",
  entretien_planifie: "Entretien planifié",
  entretien_tenu: "Entretien tenu",
  // Un seul libellé pour l'annulation ET l'absence : le RÉSUMÉ de
  // l'événement dit lequel des deux, et il le dit mieux qu'un intitulé de
  // colonne. « Entretien manqué — le candidat ne s'est pas présenté » se lit
  // d'un coup ; « Absent » demande de deviner qui.
  entretien_sans_suite: "Entretien sans suite",
  piece_recue: "Pièce reçue",
  vivier_info: "Information vivier",
  vivier_opposition: "Opposition au vivier",
  decision: "Décision",
};

/** Libellés français des états de livraison. */
export const LIBELLE_LIVRAISON: Record<JobApplicationReplyStatus, string> = {
  pending: "en cours d'envoi",
  sent: "remise",
  failed: "échec d'envoi",
  bounced: "rejetée par le serveur du destinataire",
};
