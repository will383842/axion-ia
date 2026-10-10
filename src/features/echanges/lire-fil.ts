import "server-only";

/**
 * LE FIL « ÉCHANGES » — les lectures (Candidatures unifiées L7).
 *
 * Lit les sources de chaque monde et les remet à l'adaptateur pur
 * (`fil.ts`). Chaque source est ACCESSOIRE : si l'une ne répond pas, le fil
 * s'affiche sans elle (Sentry prévenu) plutôt que de faire tomber la fiche.
 *
 * Pas `"use server"` : une lecture nue y deviendrait un point d'entrée réseau.
 * Les gardes de rôle sont celles des blocs remplacés — le journal d'une
 * candidature se lit avec `peutOuvrirDossierCandidat` (dans `lireFrise`), les
 * échanges Calendly d'un apporteur avec `peutVoirLesAppels`.
 */

import * as Sentry from "@sentry/nextjs";

import { prisma } from "@/lib/prisma";
import { peutVoirLesAppels } from "@/features/admin-calendly/acces";
import { lireFrise, LIBELLE_EVENEMENT } from "@/features/admin-job-applications/timeline";
import { lireReponsesRecuesCandidat } from "@/features/admin-job-applications/reponses-recues";
import { lireReponsesRecues } from "@/features/commercial-application/reponses-recues";
import { GABARIT_INVITATION_APPORTEUR } from "@/features/commercial-application/invitation-apporteur";
import { GABARIT_RELANCE_INVITATION } from "@/lib/commercial-application/relance-invitation";
import { MODELES_REPONSE_APPORTEUR } from "@/content/apporteurs/modeles-reponse";
import {
  lireFichiersEnvoyes,
  lireFichiersEnvoyesFiche,
  type LienEnvoye,
} from "@/server/partages/suivi";
import { tailleLisible } from "@/server/partages/regles";
import { partagesActifs } from "@/server/partages/config";

import {
  faitsApporteur,
  faitsEmploi,
  type EchangeDuFil,
  type FaitFil,
  type LienDuFil,
} from "./fil";

async function accessoire<T>(etape: string, lire: () => Promise<T>, defaut: T): Promise<T> {
  try {
    return await lire();
  } catch (err) {
    Sentry.captureException(err, { tags: { ecran: "fil-echanges", etape } });
    return defaut;
  }
}

function versLiensDuFil(liens: ReadonlyArray<LienEnvoye>): LienDuFil[] {
  return liens.map((l) => ({
    id: l.id,
    reponseId: l.reponseId,
    creeLe: l.creeLe,
    ouvertLe: l.ouvertLe,
    etat: l.etat,
    fichiers: l.fichiers.map((f) => ({
      titre: f.titre,
      nomFichier: f.nomFichier,
      tailleLisible: f.tailleOctets === null ? null : tailleLisible(f.tailleOctets),
      telechargeLe: f.telechargeLe,
      apercuSeulement: f.apercuSeulement,
    })),
  }));
}

/** Le fil d'une candidature (emploi). Vide pour un rôle qui n'ouvre pas le dossier. */
export async function lireFilEmploi(
  applicationId: string,
  acteur: { role: string | null | undefined },
): Promise<FaitFil[]> {
  const [frise, recues, liens] = await Promise.all([
    accessoire("frise", () => lireFrise(applicationId, acteur), []),
    accessoire("recues", () => lireReponsesRecuesCandidat(applicationId, acteur), []),
    partagesActifs()
      ? accessoire("liens", () => lireFichiersEnvoyes(applicationId), [])
      : Promise.resolve([]),
  ]);
  return faitsEmploi({
    evenements: frise.map((e) => ({
      id: e.id,
      type: e.type,
      libelle: LIBELLE_EVENEMENT[e.type],
      occurredAt: e.occurredAt,
      authorName: e.authorName,
      summary: e.summary,
      body: e.body,
      replyId: e.replyId ?? null,
      reponseRecueId: e.reponseRecueId ?? null,
      livraison: e.livraison
        ? { statut: e.livraison.statut, erreur: e.livraison.erreur, reessais: e.livraison.reessais }
        : null,
    })),
    recues,
    liens: versLiensDuFil(liens),
  });
}

/** Le libellé du modèle de départ d'une réponse (`apporteur:<id>`), ou `null`. */
function libelleModele(templateUsed: string | null): string | null {
  const id = templateUsed?.replace(/^apporteur(-groupe)?:/, "");
  if (!id || id === templateUsed) return null;
  return MODELES_REPONSE_APPORTEUR.find((m) => m.id === id && m.id !== "libre")?.libelle ?? null;
}

/** Le fil d'un futur apporteur. */
export async function lireFilApporteur(
  submissionId: string,
  acteur: { role: string | null | undefined },
): Promise<FaitFil[]> {
  const voitLesAppels = peutVoirLesAppels(acteur.role);
  const [envoyees, recues, invitations, echanges, liens] = await Promise.all([
    accessoire(
      "envoyees",
      () =>
        prisma.submissionReply.findMany({
          where: { submissionId },
          orderBy: { repliedAt: "desc" },
          take: 50,
          select: {
            id: true,
            repliedAt: true,
            repliedByName: true,
            subject: true,
            deliveryStatus: true,
            errorMsg: true,
            templateUsed: true,
            bodyText: true,
          },
        }),
      [],
    ),
    accessoire("recues", () => lireReponsesRecues(submissionId), []),
    accessoire(
      "invitations",
      () =>
        prisma.emailLog.findMany({
          where: {
            template: { in: [GABARIT_INVITATION_APPORTEUR, GABARIT_RELANCE_INVITATION] },
            entityType: "Submission",
            entityId: submissionId,
            status: { in: ["pending", "sent"] },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { id: true, createdAt: true, template: true, status: true },
        }),
      [],
    ),
    voitLesAppels
      ? accessoire(
          "echanges",
          () =>
            prisma.calendlyEvent.findMany({
              where: { linkedSubmissionId: submissionId },
              orderBy: { capturedAt: "desc" },
              take: 20,
              select: {
                id: true,
                capturedAt: true,
                startTime: true,
                status: true,
                suivi: {
                  select: { renseigneLe: true, issue: true, decision: true, note: true },
                },
              },
            }),
          [],
        )
      : Promise.resolve([]),
    partagesActifs()
      ? accessoire("liens", () => lireFichiersEnvoyesFiche(submissionId), [])
      : Promise.resolve([]),
  ]);

  return faitsApporteur({
    envoyees: envoyees.map((r) => ({
      id: r.id,
      repliedAt: r.repliedAt,
      repliedByName: r.repliedByName,
      subject: r.subject,
      deliveryStatus: r.deliveryStatus,
      errorMsg: r.errorMsg,
      modele: libelleModele(r.templateUsed),
      bodyText: r.bodyText,
    })),
    recues,
    invitations: invitations.map((i) => ({
      id: i.id,
      le: i.createdAt,
      nature: i.template === GABARIT_INVITATION_APPORTEUR ? "invitation" : "rappel",
      statut: i.status,
    })),
    echanges: echanges.map((e): EchangeDuFil => ({
      id: e.id,
      reserveLe: e.capturedAt,
      pour: e.startTime,
      annule: e.status === "canceled",
      suivi: e.suivi
        ? {
            le: e.suivi.renseigneLe,
            issue: e.suivi.issue,
            decision: e.suivi.decision,
            note: e.suivi.note,
          }
        : null,
    })),
    liens: versLiensDuFil(liens),
  });
}
