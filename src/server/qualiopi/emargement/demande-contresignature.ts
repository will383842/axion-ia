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
 * ## Une demande PAR JOURNÉE, le soir, jamais la nuit (relecture #1096)
 *
 * 🔴 L'idempotence portait d'abord sur le jour civil de Paris où l'on envoyait.
 * Sur une session de trois jours sans réaction, cela donnait : demande le 16 à
 * 17:25, deuxième envoi le 17 à 00:25 (clé du 17 libre), plus rien le soir du
 * 17 (clé prise), troisième envoi le 18 à 00:25, rien pour le 18. Des e-mails
 * en pleine nuit, et deux journées jamais demandées.
 *
 * La trace porte désormais la JOURNÉE réclamée :
 *
 *  · chaque journée signée a sa propre demande, envoyée après sa fin ;
 *  · au plus `PLAFOND_ENVOIS_PAR_JOURNEE` envois PARTIS par journée (une
 *    demande, deux rappels), espacés d'au moins `ECART_MIN_ENTRE_ENVOIS_MS` ;
 *  · rien hors de la plage `PLAGE_ENVOI_PARIS` (heure de Paris, changement
 *    d'heure compris) ;
 *  · les journées dues au même passage partent dans UN seul e-mail : un
 *    formateur ne reçoit pas deux messages le même soir.
 *
 * Le `jobId` porte l'heure du passage et chaque journée réclamée
 * (`…-2026091617-j20260916-j20260917`). Le journal `email_logs` — une ligne par
 * `jobId`, posée dès l'enfilage — sert à la fois de trace et de compteur.
 *
 * 🔴 Un envoi en ÉCHEC (`failed`) ne compte pas : il n'est jamais parti. Il ne
 * consomme ni un des trois envois, ni l'écart de 23 h, et le passage suivant le
 * retente. `PLAFOND_TENTATIVES_PAR_JOURNEE` borne ces reprises pour qu'une
 * panne durable ne fasse pas tourner l'envoi toutes les heures pendant une
 * semaine.
 *
 * ⚠️ Aucune colonne neuve, aucune migration : le worker atterrit ~50 min avant
 * l'app qui migre (AGENTS.md).
 *
 * Worker-safe : ni `server-only`, ni `next/*`. Stub-aware.
 */

import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/server/queue/queues";
import { verdictAvantEnvoi } from "@/server/email/suppression";
import { FORMATEUR_BASE_PATH } from "@/server/formateur/routes";
import { parisDateISO, parisMinutesDuJour } from "@/server/qualiopi/presence/time";
import {
  bilanContresignature,
  libelleDemiJourneeAContresigner,
  type DemiJourneeAContresigner,
} from "./contresignatures-manquantes";

export const TEMPLATE_DEMANDE_CONTRESIGNATURE = "formateur-contresignature" as const;

/** Par journée : une demande, puis deux rappels au plus, sans réaction du formateur. */
export const PLAFOND_ENVOIS_PAR_JOURNEE = 3;

/** Un rappel ne part pas moins de 23 h après l'envoi précédent pour la même journée. */
export const ECART_MIN_ENTRE_ENVOIS_MS = 23 * 60 * 60 * 1000;

/** Plage d'envoi, en minutes depuis minuit, heure de Paris : 08:00 → 21:00. */
export const PLAGE_ENVOI_PARIS = { debutMin: 8 * 60, finMin: 21 * 60 } as const;

/** Reprises après échec, par journée, tous statuts confondus. */
export const PLAFOND_TENTATIVES_PAR_JOURNEE = 6;

/** Au-delà, la demande s'arrête ; le signalement console, lui, demeure. */
export const FENETRE_DEMANDE_APRES_FIN_JOURS = 7;

/** Journées réclamées dans un même e-mail — la longueur du `jobId` (200) le borne. */
const MAX_JOURNEES_PAR_ENVOI = 8;

const MS_JOUR = 24 * 60 * 60 * 1000;

export interface BilanDemandesContresignature {
  readonly sessions: number;
  readonly envoyees: number;
  /** Journées à contresigner dont le prochain envoi n'est pas encore dû. */
  readonly enAttente: number;
  /** Journées au plafond d'envois : plus d'e-mail, la console demeure. */
  readonly plafonnees: number;
  /** Demi-journées sans formateur MEMBRE à qui demander (signalées en console). */
  readonly sansFormateur: number;
  /** Destinataires retenus par la liste de suppression. */
  readonly retenues: number;
  readonly echecs: number;
  /** Vrai si le passage tombait hors de la plage d'envoi : rien n'a été tenté. */
  readonly horsPlage: boolean;
}

/** Préfixe du `jobId` d'une (session, formateur). */
export function prefixeJobDemande(sessionId: string, trainerId: string): string {
  return `${TEMPLATE_DEMANDE_CONTRESIGNATURE}-${sessionId}-${trainerId}-`;
}

/** Marqueur d'une journée réclamée dans un `jobId` : `-j20260916`. */
export function marqueurJournee(dateIso: string): string {
  return `-j${dateIso.replace(/-/g, "")}`;
}

/** Le passage tombe-t-il dans la plage d'envoi (heure de Paris) ? */
export function dansPlageEnvoi(maintenant: Date): boolean {
  const m = parisMinutesDuJour(maintenant);
  return m >= PLAGE_ENVOI_PARIS.debutMin && m < PLAGE_ENVOI_PARIS.finMin;
}

/** Clé d'heure du passage, heure de Paris : `2026091617`. */
function clePassage(maintenant: Date): string {
  const heure = String(Math.floor(parisMinutesDuJour(maintenant) / 60)).padStart(2, "0");
  return `${parisDateISO(maintenant).replace(/-/g, "")}${heure}`;
}

export async function envoyerDemandesContresignature(
  maintenant: Date = new Date(),
): Promise<BilanDemandesContresignature> {
  const bilan = {
    sessions: 0,
    envoyees: 0,
    enAttente: 0,
    plafonnees: 0,
    sansFormateur: 0,
    retenues: 0,
    echecs: 0,
    horsPlage: false,
  };
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return bilan;
  // Jamais la nuit : hors plage, on ne lit même pas la base.
  if (!dansPlageEnvoi(maintenant)) return { ...bilan, horsPlage: true };

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
  const passage = clePassage(maintenant);

  for (const s of sessions) {
    bilan.sessions++;
    const { aContresigner, sansDestinataire } = bilanContresignature({
      jours: s.jours,
      formateurPrincipalId: s.formateurPrincipalId,
      creneauxSignes: s.enrollments.flatMap((e) => e.presences),
      contresignatures: s.emargementContresignatures,
      // Relecture #1096 — seul un formateur MEMBRE est désigné ; un formateur
      // de journée qui ne l'est pas replie sur le principal.
      membres: new Set(
        [s.formateurPrincipalId, ...s.sessionFormateurs.map((sf) => sf.trainerId)].filter(
          (id): id is string => id !== null,
        ),
      ),
      maintenant,
    });
    if (aContresigner.length === 0) continue;
    if (sansDestinataire > 0) {
      bilan.sansFormateur += sansDestinataire;
      console.error(
        `[demande-contresignature] ${s.numero} — ${sansDestinataire} demi-journée(s) sans formateur ` +
          "membre de la session à qui demander : signalé sur la fiche session.",
      );
    }

    const parFormateur = new Map<string, DemiJourneeAContresigner[]>();
    for (const d of aContresigner) {
      if (d.formateurId === null) continue;
      parFormateur.set(d.formateurId, [...(parFormateur.get(d.formateurId) ?? []), d]);
    }

    for (const [trainerId, demiJournees] of parFormateur) {
      const prefixe = prefixeJobDemande(s.id, trainerId);
      try {
        const traces = await prisma.emailLog.findMany({
          where: { jobId: { startsWith: prefixe } },
          select: { jobId: true, status: true, createdAt: true },
        });

        // Journée par journée : le prochain envoi est-il dû ?
        const journees = [...new Set(demiJournees.map((d) => d.date))].sort();
        const dues: Array<{ date: string; rang: number }> = [];
        for (const date of journees) {
          const miennes = traces.filter((t) => t.jobId?.includes(marqueurJournee(date)) === true);
          const parties = miennes.filter((t) => t.status !== "failed");
          if (
            parties.length >= PLAFOND_ENVOIS_PAR_JOURNEE ||
            miennes.length >= PLAFOND_TENTATIVES_PAR_JOURNEE
          ) {
            bilan.plafonnees++;
            continue;
          }
          const derniere = parties.reduce<Date | null>(
            (max, t) => (max === null || t.createdAt > max ? t.createdAt : max),
            null,
          );
          if (
            derniere !== null &&
            maintenant.getTime() - derniere.getTime() < ECART_MIN_ENTRE_ENVOIS_MS
          ) {
            bilan.enAttente++;
            continue;
          }
          dues.push({ date, rang: parties.length });
        }
        if (dues.length === 0) continue;
        const retenues = dues.slice(0, MAX_JOURNEES_PAR_ENVOI);
        const datesDues = new Set(retenues.map((d) => d.date));

        const trainer = await prisma.trainer.findUnique({
          where: { id: trainerId },
          select: { email: true, prenom: true, nom: true },
        });
        if (trainer === null) {
          bilan.sansFormateur++;
          continue;
        }
        // Liste de suppression AVANT d'enfiler : sinon chaque passage de la
        // plage retenterait, et signalerait, la même adresse morte.
        const verdict = await verdictAvantEnvoi(trainer.email, {
          template: TEMPLATE_DEMANDE_CONTRESIGNATURE,
          marketing: false,
        });
        if (verdict.retenu) {
          bilan.retenues++;
          continue;
        }

        const rang = Math.max(...retenues.map((d) => d.rang));
        const envoi = await enqueueEmail(
          TEMPLATE_DEMANDE_CONTRESIGNATURE,
          trainer.email,
          "fr",
          {
            formateurPrenomNom: `${trainer.prenom} ${trainer.nom}`.trim(),
            titreFormation: s.titreSession,
            numeroSession: s.numero,
            demiJournees: demiJournees
              .filter((d) => datesDues.has(d.date))
              .map(libelleDemiJourneeAContresigner),
            lienEspace: `${base}${FORMATEUR_BASE_PATH}/sessions/${s.id}#emargement`,
            rangRappel: rang,
            dernierRappel: retenues.every((d) => d.rang === PLAFOND_ENVOIS_PAR_JOURNEE - 1),
          },
          {
            jobId: `${prefixe}${passage}${retenues.map((d) => marqueurJournee(d.date)).join("")}`,
            entityType: "TrainingSession",
            entityId: s.id,
          },
        );
        if (envoi.enqueued) bilan.envoyees++;
        else {
          bilan.echecs++;
          console.error(
            `[demande-contresignature] ${s.numero} — demande NON partie` +
              (envoi.garePourValidation === true
                ? " (garée en corbeille de validation)"
                : " (file indisponible)") +
              " ; elle sera retentée au prochain passage.",
          );
        }
      } catch (err) {
        // 🔑 Journal illisible : on S'ABSTIENT. Une demande retardée d'une heure
        // ne coûte rien ; des doublons apprennent au formateur à les ignorer.
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
