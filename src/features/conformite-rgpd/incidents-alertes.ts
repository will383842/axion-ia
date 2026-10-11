// Conformité RGPD — les alertes Telegram d'un incident de données (demande Will,
// 2026-10-11) : à la déclaration, puis des rappels tant que la décision CNIL
// n'est pas renseignée et que l'incident est ouvert.
//
// 🔴 AUCUN CONTENU SAISI NE PART : le numéro et l'échéance, rien d'autre (cf. le
// payload de `DATA_INCIDENT_ALERT`). La description peut décrire des personnes.
//
// 🔑 FAIL-SOFT : une alerte qui échoue ne fait jamais échouer la déclaration.
//
// Idempotence des rappels SANS migration : chaque rappel envoyé laisse une ligne
// au journal (`activity_logs`, action `conformite.incident.rappel.<palier>`), et
// c'est cette ligne qu'on relit avant d'envoyer — même mécanique que le constat
// de manquement des apporteurs. Un rappel dont l'envoi a échoué n'est pas noté :
// il repart au passage suivant.

import type { PrismaClient } from "../../../prisma/generated/client";

import { prisma } from "@/lib/prisma";
import { journaliser } from "@/server/journal/journaliser";
import { notify } from "@/server/notifications";
import type { NotifyResult, PalierAlerteIncident } from "@/server/notifications/types";

import { decisionCnilPrise, echeanceCnil, heuresRestantesCnil } from "./incidents";

type PalierRappel = Exclude<PalierAlerteIncident, "declare">;

/** Du plus avancé au moins avancé : le premier atteint est le palier courant. */
const PALIERS: ReadonlyArray<{ palier: PalierRappel; seuilHeures: number }> = [
  { palier: "depasse", seuilHeures: 0 },
  { palier: "6h", seuilHeures: 6 },
  { palier: "24h", seuilHeures: 24 },
  { palier: "48h", seuilHeures: 48 },
];

/** Plafond par passage : une dégénérescence reste bornée. */
const PLAFOND_PASSAGE = 200;

export const ACTION_RAPPEL = "conformite.incident.rappel";

/** Vrai si Telegram a explicitement échoué (pas « non configuré »). */
function envoiEchoue(r: NotifyResult): boolean {
  return r.channels.telegram === "failed";
}

/**
 * L'alerte de déclaration. Ne lève jamais : un échec se journalise et s'arrête là.
 */
export async function alerterDeclarationIncident(numero: number, decouvertLe: Date): Promise<void> {
  try {
    const r = await notify({
      category: "DATA_INCIDENT_ALERT",
      payload: { numero, palier: "declare", echeance: echeanceCnil(decouvertLe).toISOString() },
    });
    if (envoiEchoue(r)) {
      console.error(`[conformite-rgpd] alerte Telegram de l'incident n° ${numero} non partie`);
    }
  } catch (err) {
    console.error(
      `[conformite-rgpd] alerte Telegram de l'incident n° ${numero} : erreur :`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * Le palier de rappel dû maintenant, ou `null`.
 *
 * Seul le palier le PLUS AVANCÉ atteint compte : après une panne du worker, on
 * n'envoie pas trois rappels d'un coup, seulement le plus urgent. Et un palier
 * déjà franchi au moment de la déclaration n'est pas rappelé : l'alerte de
 * déclaration donnait déjà l'échéance.
 */
export function palierDu(
  i: { decouvertLe: Date; creeLe: Date },
  maintenant: Date,
): PalierRappel | null {
  const restant = heuresRestantesCnil(i.decouvertLe, maintenant);
  const restantALaDeclaration = heuresRestantesCnil(i.decouvertLe, i.creeLe);
  for (const { palier, seuilHeures } of PALIERS) {
    if (restant <= seuilHeures) return restantALaDeclaration > seuilHeures ? palier : null;
  }
  return null;
}

export interface BilanRappels {
  examines: number;
  envoyes: number;
  echecs: number;
  plafondAtteint: boolean;
}

type Client = Pick<PrismaClient, "incidentDonnees" | "activityLog">;

/** Le passage horaire : un rappel par incident et par palier, au plus. */
export async function passerRappelsIncidents(
  maintenant: Date = new Date(),
  client: Client = prisma,
): Promise<BilanRappels> {
  const bilan: BilanRappels = { examines: 0, envoyes: 0, echecs: 0, plafondAtteint: false };
  // Le premier palier tombe à 48 h restantes, soit 24 h après la découverte.
  const premierPalier = new Date(maintenant.getTime() - 24 * 60 * 60 * 1000);
  const lignes = await client.incidentDonnees.findMany({
    where: {
      statut: "ouvert",
      OR: [{ declareCnil: null }, { declareCnil: false }],
      decouvertLe: { lte: premierPalier },
    },
    orderBy: { decouvertLe: "asc" },
    take: PLAFOND_PASSAGE,
    // Le motif est chiffré : non vide en clair ⇔ non vide chiffré, pas besoin de le lire.
    select: {
      id: true,
      numero: true,
      decouvertLe: true,
      creeLe: true,
      declareCnil: true,
      motifNonDeclaration: true,
    },
  });
  bilan.plafondAtteint = lignes.length >= PLAFOND_PASSAGE;

  for (const l of lignes) {
    if (decisionCnilPrise(l)) continue;
    bilan.examines += 1;
    const palier = palierDu(l, maintenant);
    if (!palier) continue;
    const action = `${ACTION_RAPPEL}.${palier}`;
    const deja = await client.activityLog.findFirst({
      where: { action, targetType: "IncidentDonnees", targetId: l.id },
      select: { id: true },
    });
    if (deja) continue;

    const r = await notify({
      category: "DATA_INCIDENT_ALERT",
      payload: {
        numero: l.numero,
        palier,
        echeance: echeanceCnil(l.decouvertLe).toISOString(),
      },
    });
    if (envoiEchoue(r)) {
      bilan.echecs += 1;
      continue;
    }
    await journaliser(client, {
      action,
      targetType: "IncidentDonnees",
      targetId: l.id,
      session: null,
      changes: { numero: l.numero, palier },
    });
    bilan.envoyes += 1;
  }
  return bilan;
}

/** Le salon des alertes est-il dédié ? (ligne de l'onglet Incidents) */
export function salonIncidentsDedie(): boolean {
  return Boolean(process.env["TELEGRAM_CHAT_ID_INCIDENTS"]?.trim());
}
