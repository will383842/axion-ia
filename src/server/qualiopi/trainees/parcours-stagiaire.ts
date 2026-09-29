/**
 * Le dossier d'UNE personne, tel que l'auditeur le demande : « montrez-moi le
 * dossier de madame X ».
 *
 * 🔴 Audit du 2026-09-30 : la fiche stagiaire n'était qu'un formulaire
 * d'édition. Pour répondre à cette question, il fallait connaître la session,
 * l'ouvrir, puis y retrouver la personne. Ce module rassemble, inscription par
 * inscription, ce que les indicateurs 4, 8, 9, 10, 11, 12 et 30 regardent :
 * statut, présence, émargement, convocation, questionnaires, évaluation finale,
 * attestation — et les pièces NOMINATIVES émises pour elle.
 *
 * Lecture seule. Le besoin d'adaptation (donnée de santé) n'y figure PAS : il a
 * sa propre porte, journalisée (`lireBesoinAdaptationAction`).
 */

import { prisma } from "@/lib/prisma";

export interface InscriptionParcours {
  readonly enrollmentId: string;
  readonly sessionId: string;
  readonly sessionNumero: string;
  readonly formationTitre: string;
  readonly dateDebut: Date;
  readonly dateFin: Date;
  readonly statutSession: string;
  readonly statutInscription: string;
  readonly tauxPresencePct: number | null;
  readonly emargementSigneAt: Date | null;
  readonly convocationEnvoyeeAt: Date | null;
  readonly questionnaires: ReadonlyArray<{
    readonly type: string;
    readonly envoyeAt: Date | null;
    readonly reponduAt: Date | null;
    readonly noteGlobale: number | null;
  }>;
  readonly evaluationFinaleAt: Date | null;
  readonly attestation: { readonly numero: string; readonly documentId: string } | null;
  readonly attestationResultat: string | null;
}

export interface PieceNominative {
  readonly id: string;
  readonly type: string;
  readonly numero: string;
  readonly createdAt: Date;
  readonly annuleeAt: Date | null;
  readonly sessionId: string | null;
}

export interface ParcoursStagiaire {
  readonly inscriptions: ReadonlyArray<InscriptionParcours>;
  readonly pieces: ReadonlyArray<PieceNominative>;
}

export async function getParcoursStagiaire(traineeId: string): Promise<ParcoursStagiaire> {
  const [enrollments, pieces] = await Promise.all([
    prisma.enrollment.findMany({
      where: { traineeId },
      orderBy: { session: { dateDebut: "desc" } },
      select: {
        id: true,
        statut: true,
        tauxPresencePct: true,
        emargementSigneAt: true,
        convocationEnvoyeeAt: true,
        attestationResultat: true,
        attestationDocument: { select: { id: true, numero: true } },
        questionnaires: {
          orderBy: { type: "asc" },
          select: { type: true, envoyeAt: true, reponduAt: true, noteGlobale: true },
        },
        evaluations: {
          where: { type: "finale" },
          orderBy: { dateEvaluation: "desc" },
          take: 1,
          select: { dateEvaluation: true },
        },
        session: {
          select: {
            id: true,
            numero: true,
            dateDebut: true,
            dateFin: true,
            statut: true,
            formation: { select: { titre: true } },
          },
        },
      },
    }),
    prisma.documentGenere.findMany({
      where: { traineeId },
      orderBy: { createdAt: "desc" },
      select: { id: true, type: true, numero: true, createdAt: true, annuleeAt: true, sessionId: true },
    }),
  ]);

  return {
    inscriptions: enrollments.map((e) => ({
      enrollmentId: e.id,
      sessionId: e.session.id,
      sessionNumero: e.session.numero,
      formationTitre: e.session.formation.titre,
      dateDebut: e.session.dateDebut,
      dateFin: e.session.dateFin,
      statutSession: e.session.statut,
      statutInscription: e.statut,
      tauxPresencePct: e.tauxPresencePct,
      emargementSigneAt: e.emargementSigneAt,
      convocationEnvoyeeAt: e.convocationEnvoyeeAt,
      questionnaires: e.questionnaires,
      evaluationFinaleAt: e.evaluations[0]?.dateEvaluation ?? null,
      attestation: e.attestationDocument
        ? { numero: e.attestationDocument.numero, documentId: e.attestationDocument.id }
        : null,
      attestationResultat: e.attestationResultat,
    })),
    pieces,
  };
}
