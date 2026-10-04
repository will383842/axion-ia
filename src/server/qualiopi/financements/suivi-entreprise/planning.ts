/**
 * Lot OPCO A8 — suivi de l'ENTREPRISE qui dépose sa demande de prise en charge
 * (module PUR : aucun import Prisma, testable seul).
 *
 * Aujourd'hui le « dossier prêt à déposer » (lot A6) produit un ZIP que l'admin
 * envoie à la main, et rien ne relance l'entreprise. Ce module décide :
 *
 *  • si un dossier de financement peut être ENVOYÉ à l'entreprise
 *    (`eligibiliteEnvoi`) — automatiquement ou depuis la console ;
 *  • QUELLE relance part aujourd'hui (`prochaineRelance`) :
 *      – dépôt pas encore fait : J+3, J+7, J+12 après l'envoi, et une dernière
 *        à J-5 de la date limite de dépôt si elle est connue ; jamais le jour
 *        du début de la session ni après ;
 *      – dépôt fait (par l'entreprise ou saisi par l'admin) : J+10, J+20, J+30
 *        du dépôt, tant que ni accord ni refus ;
 *      – jamais le week-end (Paris), au plus un e-mail par jour et par dossier ;
 *  • quelles alertes « à appeler » se lèvent (`alertesSuivi`).
 *
 * Les jours se comparent en JOUR CIVIL DE PARIS (« AAAA-MM-JJ »). Les colonnes
 * `@db.Date` (`depotFaitLe`, `accordEcritLe`) sont lues par leur partie UTC,
 * comme elles ont été écrites (`jourSaisiVersDate`).
 */

import { dayKeyInParis } from "@/lib/calendar-grid";
import type { DossierFinancementStatut } from "../../../../../prisma/generated/client";
import { OPCO_FICHES, type OpcoId } from "../opco-referentiel";

export type EtapeMessage = "envoi" | "relance_depot" | "relance_reponse";
export type QuestionMessage = "depot" | "reponse";
export type ReponseEntreprise = "oui" | "pas_encore" | "accord" | "refus";

export const REPONSES_PAR_QUESTION: Record<QuestionMessage, readonly ReponseEntreprise[]> = {
  depot: ["oui", "pas_encore"],
  reponse: ["accord", "refus", "pas_encore"],
};

/** Relances « dépôt fait ? », en jours après le premier envoi. */
export const DECALAGES_RELANCE_DEPOT = [3, 7, 12] as const;
/** Dernière relance de dépôt, en jours AVANT la date limite de dépôt. */
export const RELANCE_FINALE_AVANT_LIMITE_JOURS = 5;
/** Rang de la relance finale (après les trois relances régulières). */
export const RANG_RELANCE_FINALE = DECALAGES_RELANCE_DEPOT.length + 1;
/** Relances « réponse de l'OPCO ? », en jours après le dépôt. */
export const DECALAGES_RELANCE_REPONSE = [10, 20, 30] as const;
/** Nombre de relances sans réponse au-delà duquel il faut appeler l'entreprise. */
export const SEUIL_RELANCES_SANS_REPONSE = 3;
/** Alerte « appeler pour le dépôt » dès J-3 de la date limite. */
export const ALERTE_DEPOT_AVANT_LIMITE_JOURS = 3;
/** Alerte « appeler pour la réponse » quand la session commence dans 10 jours sans accord. */
export const ALERTE_REPONSE_AVANT_DEBUT_JOURS = 10;
/** Durée de vie d'un jeton de réponse (et du lien de téléchargement qu'il porte). */
export const DUREE_JETON_JOURS = 30;

const JOUR_MS = 24 * 60 * 60 * 1000;

// ── Jours civils ────────────────────────────────────────────────────────────

/** Jour civil de Paris d'un instant. */
export function jourParis(d: Date): string {
  return dayKeyInParis(d);
}

/** Jour d'une colonne `@db.Date` (minuit UTC), tel qu'il a été saisi. */
export function jourDeDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** « AAAA-MM-JJ » + n jours (n négatif accepté). */
export function decalerJour(jour: string, n: number): string {
  const d = new Date(`${jour}T12:00:00.000Z`);
  return new Date(d.getTime() + n * JOUR_MS).toISOString().slice(0, 10);
}

/** Samedi ou dimanche. */
export function estWeekEnd(jour: string): boolean {
  const j = new Date(`${jour}T12:00:00.000Z`).getUTCDay();
  return j === 0 || j === 6;
}

/** « AAAA-MM-JJ » → « JJ/MM/AAAA ». */
export function jourFr(jour: string): string {
  return jour.split("-").reverse().join("/");
}

// ── Qui dépose ──────────────────────────────────────────────────────────────

/**
 * Le dépôt est-il fait par l'ENTREPRISE, selon le référentiel ?
 *
 *  • `constate` : la fiche OPCO le dit (`modeDeDepotConstate = compte_adherent`) ;
 *  • `non_constate` : la fiche ne dit rien (fait non relevé) ;
 *  • `organisme` : l'OPCO fait déposer l'organisme mandaté — rien à envoyer.
 *
 * L'envoi AUTOMATIQUE n'a lieu que sur `constate` : on n'écrit pas tout seul à
 * une entreprise pour lui dire de déposer quand le référentiel ne l'établit pas.
 * Le bouton de la console reste possible sur `non_constate` (l'admin sait).
 */
export function depotParEntreprise(opco: OpcoId): "constate" | "non_constate" | "organisme" {
  const mode = OPCO_FICHES[opco].modeDeDepotConstate.valeur;
  if (mode === "compte_adherent") return "constate";
  if (mode === "of_mandate") return "organisme";
  return "non_constate";
}

// ── Éligibilité de l'envoi ──────────────────────────────────────────────────

const STATUTS_ACCORD: readonly DossierFinancementStatut[] = [
  "accord_recu",
  "facture",
  "paiement_recu",
];

export interface DossierPourEnvoi {
  type: string;
  statut: DossierFinancementStatut;
  depotFaitLe: Date | null;
  accordEcritLe: Date | null;
  opco: OpcoId | null;
  /** Convention SIGNÉE présente, exemplaire signé constaté au stockage (lot A6). */
  conventionSignee: boolean;
  contactEmail: string | null;
  dateDebutSession: Date;
  /** Un envoi a déjà eu lieu pour ce dossier. */
  dejaEnvoye: boolean;
}

export type Eligibilite = { ok: true } | { ok: false; motif: string; message: string };

const EMAIL_PLAUSIBLE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function refus(motif: string, message: string): Eligibilite {
  return { ok: false, motif, message };
}

export function eligibiliteEnvoi(
  d: DossierPourEnvoi,
  mode: "auto" | "manuel",
  now: Date,
): Eligibilite {
  if (d.type !== "opco" && d.type !== "mixte") {
    return refus("type", "Ce dossier n'est pas un financement OPCO.");
  }
  if (d.statut === "clos" || d.statut === "refuse") {
    return refus("statut", "Dossier clos ou refusé : rien à envoyer à l'entreprise.");
  }
  if (STATUTS_ACCORD.includes(d.statut) || d.accordEcritLe !== null) {
    return refus("accord", "L'accord de l'OPCO est déjà enregistré.");
  }
  if (d.opco === null) {
    return refus("opco", "OPCO du client non renseigné : renseignez-le sur la fiche client.");
  }
  const qui = depotParEntreprise(d.opco);
  if (qui === "organisme") {
    return refus("depot_par_organisme", "Pour cet OPCO, le dépôt n'est pas fait par l'entreprise.");
  }
  if (mode === "auto" && qui !== "constate") {
    return refus(
      "depot_non_constate",
      "Le référentiel ne constate pas que l'entreprise dépose elle-même chez cet OPCO.",
    );
  }
  if (!d.conventionSignee) {
    return refus("convention", "La convention signée n'est pas encore au dossier.");
  }
  if (!d.contactEmail || !EMAIL_PLAUSIBLE.test(d.contactEmail.trim())) {
    return refus("contact", "Aucune adresse e-mail de contact sur la fiche de l'entreprise.");
  }
  if (mode === "auto") {
    if (d.dejaEnvoye) return refus("deja_envoye", "Dossier déjà envoyé à l'entreprise.");
    if (d.depotFaitLe !== null) return refus("depot_fait", "Le dépôt est déjà saisi.");
    if (jourParis(now) >= jourParis(d.dateDebutSession)) {
      return refus("session_commencee", "La session a déjà commencé.");
    }
  }
  return { ok: true };
}

// ── Relances ────────────────────────────────────────────────────────────────

export interface MessageLu {
  etape: EtapeMessage;
  rang: number;
  question: QuestionMessage;
  jourParis: string;
  envoyeLe: Date;
  reponse: ReponseEntreprise | null;
  reponduLe: Date | null;
}

export interface SuiviLu {
  envoyeLe: Date;
  relancesArreteesLe: Date | null;
  refusDeclareLe: Date | null;
  messages: readonly MessageLu[];
}

export interface DossierPourRelance {
  statut: DossierFinancementStatut;
  depotFaitLe: Date | null;
  accordEcritLe: Date | null;
  accordAt: Date | null;
  envoyeAt: Date | null;
  dateDebutSession: Date;
  /** Date limite de dépôt du référentiel (`dateLimiteDepotPourSession`), si connue. */
  dateLimiteDepot: Date | null;
}

export interface RelancePrevue {
  etape: "relance_depot" | "relance_reponse";
  rang: number;
  jour: string;
}

/** L'accord est acquis (statut ou date écrite) : plus rien à demander. */
export function accordAcquis(d: DossierPourRelance): boolean {
  return STATUTS_ACCORD.includes(d.statut) || d.accordEcritLe !== null || d.accordAt !== null;
}

/** Le suivi est terminé : arrêt console, refus, dossier clos ou accord acquis. */
export function suiviTermine(d: DossierPourRelance, s: SuiviLu): boolean {
  return (
    s.relancesArreteesLe !== null ||
    s.refusDeclareLe !== null ||
    d.statut === "clos" ||
    d.statut === "refuse" ||
    accordAcquis(d)
  );
}

/**
 * Le calendrier COMPLET des relances de la phase en cours, trié par jour.
 * Phase « dépôt » tant que `depotFaitLe` est vide, phase « réponse » ensuite.
 */
export function calendrierRelances(d: DossierPourRelance, s: SuiviLu): RelancePrevue[] {
  if (d.depotFaitLe === null) {
    const envoi = jourParis(s.envoyeLe);
    const debut = jourParis(d.dateDebutSession);
    const prevues: RelancePrevue[] = DECALAGES_RELANCE_DEPOT.map((n, i) => ({
      etape: "relance_depot" as const,
      rang: i + 1,
      jour: decalerJour(envoi, n),
    }));
    if (d.dateLimiteDepot !== null) {
      const finale = decalerJour(jourParis(d.dateLimiteDepot), -RELANCE_FINALE_AVANT_LIMITE_JOURS);
      if (finale > envoi) {
        prevues.push({ etape: "relance_depot", rang: RANG_RELANCE_FINALE, jour: finale });
      }
    }
    // Jamais le jour du début de la session, ni après : l'entreprise ne peut
    // plus déposer utilement, c'est un appel qu'il faut.
    return prevues.filter((p) => p.jour < debut).sort((a, b) => a.jour.localeCompare(b.jour));
  }
  const depot = jourDeDate(d.depotFaitLe);
  return DECALAGES_RELANCE_REPONSE.map((n, i) => ({
    etape: "relance_reponse" as const,
    rang: i + 1,
    jour: decalerJour(depot, n),
  }));
}

/**
 * La relance à envoyer AUJOURD'HUI, ou `null`.
 *
 * La première relance prévue, échue et non encore partie : un passage manqué
 * (worker arrêté, week-end) se rattrape un jour après l'autre, jamais en rafale.
 */
export function prochaineRelance(
  d: DossierPourRelance,
  s: SuiviLu,
  now: Date,
): RelancePrevue | null {
  const aujourdhui = jourParis(now);
  if (estWeekEnd(aujourdhui)) return null;
  if (suiviTermine(d, s)) return null;
  // Au plus un e-mail par jour et par dossier, envoi compris.
  if (s.messages.some((m) => m.jourParis === aujourdhui)) return null;
  const parties = new Set(s.messages.map((m) => `${m.etape}:${m.rang}`));
  for (const p of calendrierRelances(d, s)) {
    if (p.jour > aujourdhui) return null;
    if (!parties.has(`${p.etape}:${p.rang}`)) return p;
  }
  return null;
}

/** Prochaine relance prévue (affichage console), même si elle n'est pas due. */
export function prochaineRelancePrevue(
  d: DossierPourRelance,
  s: SuiviLu,
  now: Date,
): RelancePrevue | null {
  if (suiviTermine(d, s)) return null;
  const parties = new Set(s.messages.map((m) => `${m.etape}:${m.rang}`));
  const aujourdhui = jourParis(now);
  const restante = calendrierRelances(d, s).find((p) => !parties.has(`${p.etape}:${p.rang}`));
  if (!restante) return null;
  // Le jour affiché est celui où elle partira : pas avant demain si un e-mail
  // est déjà parti aujourd'hui, et jamais un samedi ou un dimanche.
  let jour = restante.jour < aujourdhui ? aujourdhui : restante.jour;
  if (jour === aujourdhui && s.messages.some((m) => m.jourParis === aujourdhui)) {
    jour = decalerJour(jour, 1);
  }
  while (estWeekEnd(jour)) jour = decalerJour(jour, 1);
  return { ...restante, jour };
}

// ── Alertes « à appeler » ───────────────────────────────────────────────────

export type CodeAlerteSuivi =
  "entreprise_a_appeler_depot" | "entreprise_a_appeler_reponse_opco" | "opco_refus_a_traiter";

export interface DecisionAlerte {
  code: CodeAlerteSuivi;
  motif: string;
}

/**
 * Les alertes à lever pour UN suivi. Se referment d'elles-mêmes quand la
 * condition disparaît (`resolutionAuto`).
 */
export function alertesSuivi(d: DossierPourRelance, s: SuiviLu, now: Date): DecisionAlerte[] {
  const aujourdhui = jourParis(now);
  const out: DecisionAlerte[] = [];

  // Refus déclaré : à traiter tant que l'admin n'a ni clos ni renvoyé le dossier.
  if (
    s.refusDeclareLe !== null &&
    d.statut !== "clos" &&
    !accordAcquis(d) &&
    !(d.envoyeAt !== null && d.envoyeAt > s.refusDeclareLe)
  ) {
    out.push({ code: "opco_refus_a_traiter", motif: "refus déclaré par l'entreprise" });
  }

  if (suiviTermine(d, s)) return out;

  const nb = (etape: EtapeMessage) => s.messages.filter((m) => m.etape === etape).length;

  if (d.depotFaitLe === null) {
    const relances = nb("relance_depot");
    const limite = d.dateLimiteDepot === null ? null : jourParis(d.dateLimiteDepot);
    const procheLimite =
      limite !== null && aujourdhui >= decalerJour(limite, -ALERTE_DEPOT_AVANT_LIMITE_JOURS);
    if (relances >= SEUIL_RELANCES_SANS_REPONSE || procheLimite) {
      out.push({
        code: "entreprise_a_appeler_depot",
        motif:
          relances >= SEUIL_RELANCES_SANS_REPONSE
            ? `${relances} relances sans confirmation du dépôt`
            : `date limite de dépôt le ${jourFr(limite ?? "")}`,
      });
    }
    return out;
  }

  const relances = nb("relance_reponse");
  const debut = jourParis(d.dateDebutSession);
  const debutProche =
    aujourdhui <= debut && aujourdhui >= decalerJour(debut, -ALERTE_REPONSE_AVANT_DEBUT_JOURS);
  if (relances >= SEUIL_RELANCES_SANS_REPONSE || debutProche) {
    out.push({
      code: "entreprise_a_appeler_reponse_opco",
      motif:
        relances >= SEUIL_RELANCES_SANS_REPONSE
          ? `${relances} relances sans réponse de l'OPCO`
          : `session le ${jourFr(debut)} sans accord de l'OPCO`,
    });
  }
  return out;
}
