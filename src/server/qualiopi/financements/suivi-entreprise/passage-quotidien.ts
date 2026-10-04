/**
 * Lot OPCO A8 — le passage quotidien (08:30 Paris, jours ouvrés), lancé par le
 * worker des crons formation (`formation-crons.suivi-entreprise-opco`).
 *
 *   1. ENVOI AUTOMATIQUE des dossiers devenus prêts (convention signée, contact
 *      avec e-mail, dépôt par l'entreprise constaté au référentiel) — une seule
 *      fois par dossier : il ne part que sur un dossier SANS suivi ;
 *   2. RELANCES dues aujourd'hui (`prochaineRelance`), une par dossier au plus.
 *
 * Gardes : interrupteur `OPCO_SUIVI_ENTREPRISE_ENABLED`, tables présentes
 * (fenêtre app/worker), plafond d'e-mails par passage — la boîte d'envoi est
 * partagée (40/h) ; ce qui dépasse part au passage suivant, la relance due
 * étant rattrapée un jour après l'autre.
 */

import { prisma } from "@/lib/prisma";
import { opcoDuClient } from "../opco-referentiel";
import { suiviEntrepriseActif } from "./drapeau";
import { envoyerDossierEntreprise, envoyerRelance } from "./envoi";
import { SELECT_DOSSIER_SUIVI, contexteSuivi } from "./lecture";
import { depotParEntreprise, estWeekEnd, jourParis, prochaineRelance } from "./planning";
import { tablesSuiviDisponibles } from "./tables";

export const PLAFOND_EMAILS_PAR_PASSAGE = 30;
const PLAFOND_DOSSIERS_LUS = 500;

export interface BilanPassageSuivi {
  actif: boolean;
  abstenu: boolean;
  envoisAuto: number;
  relances: number;
  ecartes: Record<string, number>;
  echecs: number;
  plafondAtteint: boolean;
}

/** 08:xx à Paris, du lundi au vendredi — l'horaire porte deux déclencheurs UTC (heure d'été / d'hiver). */
export function estLHeureDuPassage(now: Date): boolean {
  const heure = Number(
    new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", hour12: false })
      .format(now)
      .slice(0, 2),
  );
  return heure === 8 && !estWeekEnd(jourParis(now));
}

export async function passerSuiviEntreprise(now: Date = new Date()): Promise<BilanPassageSuivi> {
  const bilan: BilanPassageSuivi = {
    actif: suiviEntrepriseActif(),
    abstenu: false,
    envoisAuto: 0,
    relances: 0,
    ecartes: {},
    echecs: 0,
    plafondAtteint: false,
  };
  if (!bilan.actif) return bilan;
  if (!(await tablesSuiviDisponibles())) return { ...bilan, abstenu: true };
  if (estWeekEnd(jourParis(now))) return bilan;

  const ecarter = (motif: string) => {
    bilan.ecartes[motif] = (bilan.ecartes[motif] ?? 0) + 1;
  };
  const restant = () => PLAFOND_EMAILS_PAR_PASSAGE - bilan.envoisAuto - bilan.relances;

  // ── 1. Envois automatiques ───────────────────────────────────────────────
  const aEnvoyer = await prisma.dossierFinancement.findMany({
    where: {
      type: { in: ["opco", "mixte"] },
      statut: { in: ["a_monter", "envoye"] },
      depotFaitLe: null,
      accordEcritLe: null,
      suiviEntreprise: { is: null },
      trainingSession: { dateDebut: { gt: now } },
    },
    orderBy: { createdAt: "asc" },
    take: PLAFOND_DOSSIERS_LUS,
    select: {
      id: true,
      client: { select: { opco: true, opcoIdentifie: true, contactEmail: true } },
      trainingSession: {
        select: { client: { select: { opco: true, opcoIdentifie: true, contactEmail: true } } },
      },
    },
  });
  for (const d of aEnvoyer) {
    // Pré-tri bon marché : ni kit ni lecture du stockage pour un dossier qui
    // ne partira pas (OPCO non reconnu, dépôt non constaté, pas d'e-mail).
    const client = d.client ?? d.trainingSession?.client ?? null;
    const opco = opcoDuClient(client);
    if (!opco || depotParEntreprise(opco) !== "constate") {
      ecarter("depot_non_constate");
      continue;
    }
    if (!client?.contactEmail) {
      ecarter("contact");
      continue;
    }
    if (restant() <= 0) {
      bilan.plafondAtteint = true;
      break;
    }
    try {
      const r = await envoyerDossierEntreprise({ dossierId: d.id, mode: "auto", now });
      if (r.ok) bilan.envoisAuto++;
      else ecarter(r.motif);
    } catch (err) {
      bilan.echecs++;
      console.error(
        `[suivi-entreprise-opco] envoi automatique en échec (${d.id}) :`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  // ── 2. Relances ──────────────────────────────────────────────────────────
  const suivis = await prisma.dossierFinancement.findMany({
    where: {
      statut: { notIn: ["clos", "refuse"] },
      suiviEntreprise: { is: { relancesArreteesLe: null, refusDeclareLe: null } },
    },
    orderBy: { createdAt: "asc" },
    take: PLAFOND_DOSSIERS_LUS,
    select: SELECT_DOSSIER_SUIVI,
  });
  for (const brut of suivis) {
    const c = contexteSuivi(brut);
    if (!c?.suivi) continue;
    const relance = prochaineRelance(c.dossier, c.suivi, now);
    if (!relance) continue;
    if (restant() <= 0) {
      bilan.plafondAtteint = true;
      break;
    }
    try {
      const r = await envoyerRelance(c, relance, now);
      if (r === "envoyee") bilan.relances++;
      else ecarter(r);
    } catch (err) {
      bilan.echecs++;
      console.error(
        `[suivi-entreprise-opco] relance en échec (${brut.id}) :`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
  return bilan;
}
