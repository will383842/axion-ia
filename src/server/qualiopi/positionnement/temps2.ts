/**
 * Chantier QNC, lot L04 — TEMPS 2 : ce que le cron quotidien du positionnement
 * fait de plus, derrière `qualiopi.positionnement.actif` (NC1).
 *
 *   1. `positionnementsRetenusFauteDeConvention` — le positionnement ne part que
 *      si la convention est signée (`convention-signee.ts`) ;
 *   2. `passerDemandesListeStagiaires` — la liste des stagiaires est demandée à
 *      l'entreprise, puis relancée (`liste-stagiaires.ts`). Chaque envoi est
 *      rangé au dossier de la session : `remises_retours` (la remise) et, pour
 *      une relance, `relances_journal` (le rang). Dates posées par le serveur.
 *
 * Éteint (clé absente, valeur inconnue, base injoignable) : rien ne change —
 * aucune requête sur les colonnes du socle, aucun envoi.
 *
 * ⚠️ Atteint par le WORKER : aucun import `server-only`, Next ni Server Action.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../../../prisma/generated/client";
import { inscriptionsActives } from "@/server/qualiopi/inscriptions/inscriptions-actives";
import {
  estActifPour,
  lireInterrupteurQualiopi,
  type EtatInterrupteur,
} from "@/server/qualiopi/socle/interrupteurs";
import { conventionSigneePourInscription, TYPES_PIECE_CONTRACTUELLE } from "./convention-signee";
import { gesteListeStagiaires, OBJET_LISTE_STAGIAIRES } from "./liste-stagiaires";

export const LOT_POSITIONNEMENT = "positionnement";

export const CODE_ALERTE_POSITIONNEMENT_RETENU = "positionnement_retenu_sans_convention";

function estStub(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") === true;
}

/** Le filtre Prisma de la pièce contractuelle — même définition que le module pur. */
const wherePieceContractuelle = {
  type: { in: [...TYPES_PIECE_CONTRACTUELLE] },
  annuleeAt: null,
} satisfies Prisma.DocumentGenereWhereInput;

const piecesContractuelles = {
  where: wherePieceContractuelle,
  select: { type: true, statutSignature: true, annuleeAt: true, clientId: true, traineeId: true },
} satisfies Prisma.TrainingSession$documentsArgs;

/**
 * Parmi ces positionnements candidats, ceux qu'il faut RETENIR : l'interrupteur
 * s'applique à leur session et aucune convention signée ne couvre l'inscription.
 * Éteint : ensemble vide, sans requête sur le socle.
 *
 * 🔴 Relecture #1571 — une retenue ne reste pas silencieuse : allumé, chaque
 * passage met à jour l'alerte `positionnement_retenu_sans_convention` (nombre
 * et numéros de session, aucun nom), et la referme quand plus rien n'est retenu.
 */
export async function positionnementsRetenusFauteDeConvention(
  questionnaireIds: readonly string[],
  etat?: EtatInterrupteur,
): Promise<Set<string>> {
  const retenus = new Set<string>();
  if (estStub()) return retenus;
  const e = etat ?? (await lireInterrupteurQualiopi(LOT_POSITIONNEMENT));
  if (e === "eteint") return retenus;
  if (questionnaireIds.length === 0) {
    // Plus aucun candidat : une alerte restée ouverte ne dit plus rien de vrai.
    await signalerRetenues(0, []);
    return retenus;
  }

  const lignes = await prisma.questionnaire.findMany({
    where: { id: { in: [...questionnaireIds] } },
    select: {
      id: true,
      enrollment: {
        select: {
          traineeId: true,
          clientId: true,
          estTestInterne: true,
          session: {
            select: {
              numero: true,
              estTestInterne: true,
              interEntreprises: true,
              documents: piecesContractuelles,
            },
          },
        },
      },
    },
  });
  const sessions = new Set<string>();
  for (const q of lignes) {
    const ins = q.enrollment;
    const cible = { estTestInterne: ins.estTestInterne || ins.session.estTestInterne };
    if (!estActifPour(e, cible)) continue;
    const couverte = conventionSigneePourInscription(ins.session.documents, {
      traineeId: ins.traineeId,
      clientId: ins.clientId,
      interEntreprises: ins.session.interEntreprises,
    });
    if (!couverte) {
      retenus.add(q.id);
      sessions.add(ins.session.numero);
    }
  }
  await signalerRetenues(retenus.size, [...sessions].sort());
  return retenus;
}

/** L'alerte des retenues : créée ou mise à jour, refermée quand il n'y en a plus. */
async function signalerRetenues(nombre: number, sessions: readonly string[]): Promise<void> {
  // Import DIFFÉRÉ, comme la file : le service d'alertes tire l'évaluateur entier.
  try {
    const { creerOuActualiser, resoudreAlertesParCode } =
      await import("@/server/qualiopi/alertes/alertes-service");
    if (nombre === 0) {
      await resoudreAlertesParCode([CODE_ALERTE_POSITIONNEMENT_RETENU]);
      return;
    }
    await creerOuActualiser({
      code: CODE_ALERTE_POSITIONNEMENT_RETENU,
      niveau: "important",
      titre: `Positionnement retenu : convention non signée (${nombre})`,
      message:
        `${nombre} positionnement(s) ne partent pas : aucune convention signée ne couvre ` +
        `l'inscription (sessions ${sessions.join(", ")}). Faites signer la convention ` +
        `(convention papier, financement sans contrat généré : vérifiez la pièce de la ` +
        `session) — l'envoi partira au passage suivant. Le questionnaire reste visible dans ` +
        `l'espace stagiaire ; seul l'e-mail est retenu.`,
    });
  } catch (err) {
    // L'alerte ne doit pas priver le cron de son passage.
    console.error(
      "[positionnement] alerte des retenues : écriture impossible :",
      err instanceof Error ? err.message : String(err),
    );
  }
}

export interface BilanListes {
  readonly demandes: number;
  readonly relances: number;
  readonly ko: number;
  readonly candidates: number;
}

const BILAN_VIDE: BilanListes = { demandes: 0, relances: 0, ko: 0, candidates: 0 };

const dateCourte = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeZone: "Europe/Paris",
});

/**
 * Demande (ou relance) la liste des stagiaires aux entreprises dont la
 * convention est signée et dont la session, à venir, compte moins d'inscrits
 * que prévu.
 *
 * Inter-entreprises exclu : chaque participant y est inscrit pour lui-même, il
 * n'y a pas UNE entreprise à qui demander une liste.
 */
export async function passerDemandesListeStagiaires(
  maintenant: Date,
  etat?: EtatInterrupteur,
): Promise<BilanListes> {
  if (estStub()) return BILAN_VIDE;
  const e = etat ?? (await lireInterrupteurQualiopi(LOT_POSITIONNEMENT));
  if (e === "eteint") return BILAN_VIDE;

  const sessions = await prisma.trainingSession.findMany({
    where: {
      statut: "planifiee",
      dateDebut: { gt: maintenant },
      interEntreprises: false,
      ...(e === "essai" ? { estTestInterne: true } : {}),
      client: { contactEmail: { not: null } },
      documents: { some: { ...wherePieceContractuelle, statutSignature: "signee" } },
    },
    select: {
      id: true,
      numero: true,
      titreSession: true,
      dateDebut: true,
      nbParticipantsPrevus: true,
      clientId: true,
      estTestInterne: true,
      client: { select: { raisonSociale: true, contactNom: true, contactEmail: true } },
      documents: piecesContractuelles,
      _count: { select: { enrollments: { where: inscriptionsActives() } } },
      remisesRetours: {
        where: { objet: OBJET_LISTE_STAGIAIRES, nature: "remise" },
        select: { survenuLe: true },
        orderBy: { survenuLe: "desc" },
      },
    },
  });

  // Import DIFFÉRÉ : ce module est tiré par le worker des crons, dont les suites
  // de tests simulent `bullmq` sans `Queue` — la file n'est chargée qu'au besoin.
  const { enqueueEmail } = await import("@/server/queue/queues");
  let demandes = 0;
  let relances = 0;
  let ko = 0;
  for (const s of sessions) {
    if (!estActifPour(e, s)) continue;
    // La convention doit couvrir l'entreprise de la SESSION (intra).
    if (
      !conventionSigneePourInscription(s.documents, {
        traineeId: "",
        clientId: s.clientId,
        interEntreprises: false,
      })
    ) {
      continue;
    }
    const envois = s.remisesRetours.length;
    const geste = gesteListeStagiaires({
      envois,
      dernierEnvoiLe: s.remisesRetours[0]?.survenuLe ?? null,
      inscrits: s._count.enrollments,
      prevus: s.nbParticipantsPrevus,
      dateDebut: s.dateDebut,
      maintenant,
    });
    if (geste === "rien" || s.client === null || s.client.contactEmail === null) continue;

    const rang = envois; // 0 = la demande, 1..n = les relances
    try {
      const envoi = await enqueueEmail(
        "qualiopi-liste-stagiaires",
        s.client.contactEmail,
        "fr",
        {
          contactNom: s.client.contactNom ?? "",
          raisonSociale: s.client.raisonSociale,
          titreFormation: s.titreSession,
          dateDebutFormation: dateCourte.format(s.dateDebut),
          numeroSession: s.numero,
          nbPrevus: s.nbParticipantsPrevus,
          nbInscrits: s._count.enrollments,
          relance: rang > 0,
        },
        {
          jobId: `qualiopi-liste-stagiaires-${s.id}-${rang}`,
          entityType: "TrainingSession",
          entityId: s.id,
          clientId: s.clientId,
        },
      );
      // La trace n'est posée QUE si l'envoi est réellement parti (cf. `D5-1-C1`).
      if (!envoi.enqueued) {
        ko++;
        continue;
      }
      await prisma.$transaction(async (tx) => {
        await tx.remiseRetour.create({
          data: {
            sessionId: s.id,
            nature: "remise",
            destinataire: "entreprise",
            canal: "email",
            objet: OBJET_LISTE_STAGIAIRES,
            libelle:
              rang === 0
                ? "Demande de la liste des stagiaires (noms, e-mails)"
                : `Relance n° ${rang} de la demande de liste des stagiaires`,
          },
        });
        if (rang > 0) {
          await tx.relanceJournal.create({
            data: {
              sessionId: s.id,
              objet: OBJET_LISTE_STAGIAIRES,
              destinataire: "entreprise",
              canal: "email",
              rang,
              automatique: true,
            },
          });
        }
      });
      if (rang === 0) demandes++;
      else relances++;
    } catch (err) {
      ko++;
      console.error(
        `[temps2] liste des stagiaires : erreur session ${s.id} :`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
  return { demandes, relances, ko, candidates: sessions.length };
}
