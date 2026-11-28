/**
 * Chantier QNC, NC6 (indicateur 12) — LES ENVOIS DE LA CONFIRMATION DE PRÉSENCE (P-12, étapes
 * 3 et 4), au passage horaire `formation-crons.liens-emargement-j0` (aucun nouveau job).
 *
 *  - demande   : au stagiaire, de J-3 à J-1 entre 9 h et 19 h, si aucune n'est partie ;
 *  - relance   : une seule, de J-2 à J-1, si la demande est partie un jour de Paris antérieur
 *                et reste sans réponse ;
 *  - information de l'entreprise : à J-1 entre 12 h et 19 h, SEULE et automatique (décision de
 *                Will, 19/10), si le stagiaire n'a pas confirmé — jamais de motif.
 * Le calendrier (`etapesDues`) est pur ; ce fichier lit les faits, envoie, puis trace.
 *
 * Interrupteur `qualiopi.presence.actif` : lu UNE fois par passage ; éteint = aucune requête
 * sur les sessions ; essai = seulement les sessions `estTestInterne`.
 *
 * Anti-doublon : on envoie D'ABORD, puis on écrit la trace — la trace (`RelanceJournal`) EST la
 * garde. Un envoi non parti (`enqueued:false` : essai bloqué, garé en validation, file absente)
 * n'écrit rien et se retente au passage suivant. Le `jobId` stable
 * `presence-<étape>-<inscription>` double la garde côté file.
 *
 * ⚠️ Atteint par le WORKER : aucun import Next ni Server Action, et `enqueueEmail` (qui tire
 * `queues.ts`) est importé à la demande.
 *
 * ⚠️ En rattrapage (session créée tardivement, worker arrêté), la relance et l'information de
 * l'entreprise peuvent partir au même passage : la règle est écrite ainsi, et assumée.
 */

import { prisma } from "@/lib/prisma";
import { parisDateISO } from "@/server/qualiopi/presence/time";
import { inscriptionsActives } from "@/server/qualiopi/inscriptions/inscriptions-actives";
import { estActifPour } from "@/server/qualiopi/socle/interrupteurs";
import { lireInterrupteurPresence } from "./activation";
import {
  etapesDues,
  jourJ,
  libelleJour,
  type EtapePresence,
  type FaitsPresence,
} from "./calendrier";
import { debutPremiereDemiJournee } from "./debut";
import { emettreJetonPresence } from "./jeton";
import {
  JOURS_DEMANDE_PREMIER,
  JOUR_DERNIER,
  OBJET_PRESENCE_DEMANDE,
  OBJET_PRESENCE_INFO_ENTREPRISE,
  OBJET_PRESENCE_NON,
  OBJET_PRESENCE_OUI,
  RANG_DEMANDE,
  RANG_INFO_ENTREPRISE,
  RANG_RELANCE,
  type ReponsePresence,
} from "./objets";

export interface BilanPresence {
  readonly sessions: number;
  readonly demandes: number;
  readonly relances: number;
  readonly informations: number;
  readonly echecs: ReadonlyArray<string>;
}

const BILAN_VIDE: BilanPresence = {
  sessions: 0,
  demandes: 0,
  relances: 0,
  informations: 0,
  echecs: [],
};

const SELECT_CLIENT = { raisonSociale: true, contactNom: true, contactEmail: true } as const;

/** Un jour de plus ou de moins sur un jour civil `YYYY-MM-DD`, rendu à minuit UTC. */
function jourDecale(iso: string, jours: number): Date {
  return new Date(Date.parse(`${iso}T00:00:00.000Z`) + jours * 86_400_000);
}

function reponseDepuisObjet(objet: string): ReponsePresence | null {
  if (objet === OBJET_PRESENCE_OUI) return "oui";
  if (objet === OBJET_PRESENCE_NON) return "non";
  return null;
}

type EnqueueEmail = (typeof import("@/server/queue/queues"))["enqueueEmail"];

interface Client {
  readonly raisonSociale: string;
  readonly contactNom: string | null;
  readonly contactEmail: string | null;
}

interface Contexte {
  readonly enqueueEmail: EnqueueEmail;
  readonly base: string;
  readonly session: {
    readonly id: string;
    readonly titreSession: string;
    readonly dateDebut: Date;
    readonly jours: ReadonlyArray<{ date: Date; heureDebut: string; heureFin: string }>;
  };
  readonly inscription: { readonly id: string; readonly trainee: { readonly email: string } };
  readonly payeur: Client | null;
  readonly stagiaire: string;
  readonly dateDebutFormation: string;
}

/** Envoie, PUIS trace. Vrai si l'e-mail est parti (et tracé). */
async function envoyerEtape(etape: EtapePresence, c: Contexte): Promise<boolean> {
  const { session: s, inscription: e, payeur } = c;
  const options = { jobId: `presence-${etape}-${e.id}`, entityType: "Enrollment", entityId: e.id };

  if (etape === "information_entreprise") {
    const destinataire = payeur?.contactEmail?.trim() ?? "";
    if (payeur === null || destinataire === "") return false;
    const envoi = await c.enqueueEmail(
      "qualiopi-presence-entreprise",
      destinataire,
      "fr",
      {
        contactNom: payeur.contactNom ?? "",
        raisonSociale: payeur.raisonSociale,
        stagiairePrenomNom: c.stagiaire,
        titreFormation: s.titreSession,
        dateDebutFormation: c.dateDebutFormation,
      },
      options,
    );
    if (!envoi.enqueued) return false;
    await prisma.$transaction([
      prisma.remiseRetour.create({
        data: {
          sessionId: s.id,
          enrollmentId: e.id,
          nature: "remise",
          destinataire: "entreprise",
          canal: "email",
          objet: OBJET_PRESENCE_INFO_ENTREPRISE,
          libelle: "Information de l'entreprise : présence non confirmée à ce jour.",
        },
      }),
      prisma.relanceJournal.create({
        data: {
          sessionId: s.id,
          enrollmentId: e.id,
          objet: OBJET_PRESENCE_INFO_ENTREPRISE,
          destinataire: "entreprise",
          canal: "email",
          rang: RANG_INFO_ENTREPRISE,
          automatique: true,
        },
      }),
    ]);
    return true;
  }

  const relance = etape === "relance";
  const jeton = await emettreJetonPresence(e.id, debutPremiereDemiJournee(s));
  const envoi = await c.enqueueEmail(
    "qualiopi-presence-confirmation",
    e.trainee.email,
    "fr",
    {
      stagiairePrenomNom: c.stagiaire,
      titreFormation: s.titreSession,
      dateDebutFormation: c.dateDebutFormation,
      lienPresence: `${c.base}/fr/portail/presence/${jeton}`,
      ...(relance ? { relance: true } : {}),
    },
    options,
  );
  if (!envoi.enqueued) return false;
  const journal = prisma.relanceJournal.create({
    data: {
      sessionId: s.id,
      enrollmentId: e.id,
      objet: OBJET_PRESENCE_DEMANDE,
      destinataire: "stagiaire",
      canal: "email",
      rang: relance ? RANG_RELANCE : RANG_DEMANDE,
      automatique: true,
    },
  });
  if (relance) {
    // La relance n'est pas une seconde remise : la demande reste la seule que la réponse vise.
    await journal;
    return true;
  }
  await prisma.$transaction([
    prisma.remiseRetour.create({
      data: {
        sessionId: s.id,
        enrollmentId: e.id,
        nature: "remise",
        destinataire: "stagiaire",
        canal: "email",
        objet: OBJET_PRESENCE_DEMANDE,
        libelle: "Demande de confirmation de présence envoyée au stagiaire.",
      },
    }),
    journal,
  ]);
  return true;
}

export async function envoyerConfirmationsPresence(maintenant: Date): Promise<BilanPresence> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return BILAN_VIDE;
  const etat = await lireInterrupteurPresence();
  if (etat === "eteint") return BILAN_VIDE;

  const aujourdhui = parisDateISO(maintenant);
  const premier = jourDecale(aujourdhui, JOUR_DERNIER);
  const dernier = jourDecale(aujourdhui, JOURS_DEMANDE_PREMIER);

  const sessions = await prisma.trainingSession.findMany({
    where: {
      statut: "planifiee",
      ...(etat === "essai" ? { estTestInterne: true } : {}),
      // J est la première journée : une session dont aucune journée ne tombe de J-3 à J-1 n'a
      // rien de dû. Superset volontaire (un J plus ancien est écarté par `etapesDues`).
      OR: [
        { jours: { some: { date: { gte: premier, lte: dernier } } } },
        { jours: { none: {} }, dateDebut: { gte: premier, lte: dernier } },
      ],
    },
    select: {
      id: true,
      numero: true,
      titreSession: true,
      dateDebut: true,
      estTestInterne: true,
      jours: { select: { date: true, heureDebut: true, heureFin: true } },
      client: { select: SELECT_CLIENT },
      enrollments: {
        where: { ...inscriptionsActives(), trainee: { deletedAt: null } },
        select: {
          id: true,
          trainee: { select: { email: true, prenom: true, nom: true } },
          client: { select: SELECT_CLIENT },
          relancesJournal: {
            where: { objet: { in: [OBJET_PRESENCE_DEMANDE, OBJET_PRESENCE_INFO_ENTREPRISE] } },
            select: { objet: true, rang: true, creeLe: true },
          },
          remisesRetours: {
            where: { nature: "reponse", objet: { startsWith: OBJET_PRESENCE_DEMANDE } },
            select: { objet: true, survenuLe: true },
            orderBy: { survenuLe: "asc" },
          },
        },
      },
    },
    // Le plafond ne coupe pas au hasard : les sessions les plus proches d'abord.
    orderBy: { dateDebut: "asc" },
    take: 200,
  });

  const base = (process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://axion-ia.com").replace(/\/+$/, "");
  const bilan = { sessions: 0, demandes: 0, relances: 0, informations: 0 };
  const echecs: string[] = [];
  let enqueueEmail: EnqueueEmail | undefined;

  for (const s of sessions) {
    if (!estActifPour(etat, s)) continue;
    const jour = jourJ(s);
    let servie = false;

    for (const e of s.enrollments) {
      const journal = e.relancesJournal;
      const trace = (objet: string, rang: number) =>
        journal.find((j) => j.objet === objet && j.rang === rang)?.creeLe ?? null;
      const derniere = e.remisesRetours.at(-1);
      const payeur = e.client ?? s.client;
      const faits: FaitsPresence = {
        demandeLe: trace(OBJET_PRESENCE_DEMANDE, RANG_DEMANDE),
        relanceLe: trace(OBJET_PRESENCE_DEMANDE, RANG_RELANCE),
        informationEntrepriseLe: trace(OBJET_PRESENCE_INFO_ENTREPRISE, RANG_INFO_ENTREPRISE),
        reponse: derniere === undefined ? null : reponseDepuisObjet(derniere.objet),
        contactEmail: (payeur?.contactEmail ?? "").trim() !== "",
      };
      const dues = etapesDues(maintenant, jour, faits);
      if (dues.length === 0) continue;

      enqueueEmail ??= (await import("@/server/queue/queues")).enqueueEmail;

      const contexte: Contexte = {
        enqueueEmail,
        base,
        session: s,
        inscription: e,
        payeur: payeur ?? null,
        stagiaire: `${e.trainee.prenom} ${e.trainee.nom}`.trim(),
        dateDebutFormation: libelleJour(jour),
      };

      for (const etape of dues) {
        try {
          const envoye = await envoyerEtape(etape, contexte);
          if (!envoye) continue;
          servie = true;
          if (etape === "demande") bilan.demandes++;
          else if (etape === "relance") bilan.relances++;
          else bilan.informations++;
        } catch (err) {
          echecs.push(
            `${s.numero} — ${etape} — ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }
    if (servie) bilan.sessions++;
  }

  return { ...bilan, echecs };
}
