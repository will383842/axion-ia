/**
 * Demande de CONTRESIGNATURE au formateur — l'envoi automatique, borné.
 *
 * ## Ce que ce service automatise, et ce qu'il n'automatise pas
 *
 * Une signature ne s'appose jamais à la place de quelqu'un : la contresignature
 * reste le geste du formateur, depuis son espace authentifié
 * (`contresignerDemiJourneeAction`). Ce qui part seul, c'est la DEMANDE — à la
 * fin d'une journée que des stagiaires ont signée et qu'aucun formateur n'a
 * contresignée (`contresignatures-manquantes.ts`).
 *
 * Non bloquant pour l'attestation : décision de Will, conservée. Les OPCO la
 * demandent ; le manque se voit donc tant qu'il dure — ici par e-mail, dans
 * l'espace du formateur et sur la fiche session.
 *
 * ## Idempotence et borne
 *
 *  · UNE demande par (session, formateur, jour civil de Paris). La trace est
 *    `email_logs` — une ligne par `jobId`, posée dès l'enfilage — et non la
 *    déduplication BullMQ, qui expire : le cron est horaire.
 *  · Au plus `PLAFOND_DEMANDES_SANS_REPONSE` demandes consécutives sans que CE
 *    formateur contresigne quoi que ce soit sur la session. Dès qu'il réagit,
 *    le compteur repart : un formateur qui contresigne chaque soir en retard
 *    n'épuise pas ses rappels sur la première journée d'une session de cinq.
 *  · Plus rien au-delà de `FENETRE_DEMANDE_APRES_FIN_JOURS` après la fin.
 *
 * ⚠️ Aucune colonne neuve, aucune migration : le worker atterrit ~50 min avant
 * l'app qui migre (AGENTS.md). Le journal des envois dit déjà tout ce qu'il faut.
 *
 * Worker-safe : ni `server-only`, ni `next/*`. Stub-aware.
 */

import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/server/queue/queues";
import { FORMATEUR_BASE_PATH } from "@/server/formateur/routes";
import { resoudreAppartenance, type RoleFormateur } from "@/server/formateur/session-membership";
import { parisDateISO } from "@/server/qualiopi/presence/time";
import {
  bilanContresignature,
  libelleDemiJourneeAContresigner,
  type DemiJourneeAContresigner,
} from "./contresignatures-manquantes";

export const TEMPLATE_DEMANDE_CONTRESIGNATURE = "formateur-contresignature" as const;

/** Une demande, puis deux rappels au plus, sans réaction du formateur. */
export const PLAFOND_DEMANDES_SANS_REPONSE = 3;

/** Au-delà, la demande s'arrête ; le signalement console, lui, demeure. */
export const FENETRE_DEMANDE_APRES_FIN_JOURS = 7;

const MS_JOUR = 24 * 60 * 60 * 1000;

export interface BilanDemandesContresignature {
  readonly sessions: number;
  readonly envoyees: number;
  readonly dejaAujourdhui: number;
  readonly plafonnees: number;
  /** Demi-journées sans formateur désigné : personne à qui écrire. */
  readonly sansFormateur: number;
  /** Formateur désigné qui n'est pas membre de la session : il ne pourrait pas agir. */
  readonly nonMembre: number;
  readonly echecs: number;
}

/** Préfixe du `jobId` d'une (session, formateur) — le compteur de rappels le lit. */
export function prefixeJobDemande(sessionId: string, trainerId: string): string {
  return `${TEMPLATE_DEMANDE_CONTRESIGNATURE}-${sessionId}-${trainerId}-`;
}

export async function envoyerDemandesContresignature(
  maintenant: Date = new Date(),
): Promise<BilanDemandesContresignature> {
  const bilan = {
    sessions: 0,
    envoyees: 0,
    dejaAujourdhui: 0,
    plafonnees: 0,
    sansFormateur: 0,
    nonMembre: 0,
    echecs: 0,
  };
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return bilan;

  const sessions = await prisma.trainingSession.findMany({
    where: {
      // Une session annulée ou reportée ne se contresigne pas (le service le
      // refuse) : on ne la demande pas.
      statut: { in: ["planifiee", "en_cours", "realisee"] },
      dateDebut: { lte: maintenant },
      dateFin: { gte: new Date(maintenant.getTime() - FENETRE_DEMANDE_APRES_FIN_JOURS * MS_JOUR) },
      enrollments: {
        some: { presences: { some: { emargementSignatures: { some: { revokedAt: null } } } } },
      },
    },
    select: {
      id: true,
      numero: true,
      titreSession: true,
      formateurPrincipalId: true,
      sessionFormateurs: { select: { trainerId: true, role: true } },
      jours: { select: { date: true, heureDebut: true, heureFin: true, trainerId: true } },
      emargementContresignatures: {
        where: { revokedAt: null },
        select: { date: true, demiJournee: true, trainerId: true, createdAt: true },
      },
      enrollments: {
        select: {
          presences: {
            where: { emargementSignatures: { some: { revokedAt: null } } },
            select: { date: true, demiJournee: true },
          },
        },
      },
    },
    take: 100,
  });

  const base = (process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://axion-ia.com").replace(/\/+$/, "");
  const jourCle = parisDateISO(maintenant).replace(/-/g, "");

  for (const s of sessions) {
    bilan.sessions++;
    const { aContresigner } = bilanContresignature({
      jours: s.jours,
      formateurPrincipalId: s.formateurPrincipalId,
      creneauxSignes: s.enrollments.flatMap((e) => e.presences),
      contresignatures: s.emargementContresignatures,
      maintenant,
    });
    if (aContresigner.length === 0) continue;

    const parFormateur = new Map<string, DemiJourneeAContresigner[]>();
    for (const d of aContresigner) {
      if (d.formateurId === null) {
        bilan.sansFormateur++;
        continue;
      }
      parFormateur.set(d.formateurId, [...(parFormateur.get(d.formateurId) ?? []), d]);
    }

    for (const [trainerId, demiJournees] of parFormateur) {
      const role = s.sessionFormateurs.find((sf) => sf.trainerId === trainerId)?.role ?? null;
      const { estMembre } = resoudreAppartenance({
        estPrincipalFk: s.formateurPrincipalId === trainerId,
        roleSessionFormateur: (role as RoleFormateur | null) ?? null,
      });
      if (!estMembre) {
        bilan.nonMembre++;
        console.error(
          `[demande-contresignature] ${s.numero} — le formateur désigné d'une journée n'est pas ` +
            "membre de la session : il ne pourrait pas contresigner. Corrigez l'affectation de la journée.",
        );
        continue;
      }

      const prefixe = prefixeJobDemande(s.id, trainerId);
      const jobId = `${prefixe}${jourCle}`;
      try {
        if (
          (await prisma.emailLog.findFirst({ where: { jobId }, select: { id: true } })) !== null
        ) {
          bilan.dejaAujourdhui++;
          continue;
        }
        const derniereReaction = s.emargementContresignatures
          .filter((c) => c.trainerId === trainerId)
          .reduce<Date | null>(
            (max, c) => (max === null || c.createdAt > max ? c.createdAt : max),
            null,
          );
        const sansReponse = await prisma.emailLog.count({
          where: {
            jobId: { startsWith: prefixe },
            ...(derniereReaction !== null ? { createdAt: { gt: derniereReaction } } : {}),
          },
        });
        if (sansReponse >= PLAFOND_DEMANDES_SANS_REPONSE) {
          bilan.plafonnees++;
          continue;
        }

        const trainer = await prisma.trainer.findUnique({
          where: { id: trainerId },
          select: { email: true, prenom: true, nom: true },
        });
        if (trainer === null) {
          bilan.nonMembre++;
          continue;
        }

        const envoi = await enqueueEmail(
          TEMPLATE_DEMANDE_CONTRESIGNATURE,
          trainer.email,
          "fr",
          {
            formateurPrenomNom: `${trainer.prenom} ${trainer.nom}`.trim(),
            titreFormation: s.titreSession,
            numeroSession: s.numero,
            demiJournees: demiJournees.map(libelleDemiJourneeAContresigner),
            lienEspace: `${base}${FORMATEUR_BASE_PATH}/sessions/${s.id}#emargement`,
            rangRappel: sansReponse,
            dernierRappel: sansReponse === PLAFOND_DEMANDES_SANS_REPONSE - 1,
          },
          { jobId, entityType: "TrainingSession", entityId: s.id },
        );
        if (envoi.enqueued) bilan.envoyees++;
        else {
          bilan.echecs++;
          console.error(
            `[demande-contresignature] ${s.numero} — demande NON partie` +
              (envoi.garePourValidation === true
                ? " (garée en corbeille de validation)"
                : envoi.retenu !== undefined
                  ? ` (adresse retenue : ${envoi.retenu})`
                  : " (file indisponible)") +
              " ; elle sera retentée au prochain passage.",
          );
        }
      } catch (err) {
        // 🔑 Journal illisible : on S'ABSTIENT. Une demande de contresignature
        // retardée d'une heure ne coûte rien ; vingt-quatre doublons dans la
        // boîte d'un formateur lui apprennent à ignorer la suivante.
        bilan.echecs++;
        console.error(
          `[demande-contresignature] ${s.numero} — passage abandonné pour un formateur :`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }

  return bilan;
}
