/**
 * Persistance du rapport avant audit (2026-11-02) — table `rapports_avant_audit`.
 *
 * Règles tenues ICI, et nulle part ailleurs :
 *   1. chaque lancement est une NOUVELLE ligne (`creerRapport`) : aucune fonction de ce module ne
 *      supprime une ligne, et aucune ne réécrit une base d'audit déjà enregistrée
 *      (`enregistrerResultat` exige `base_audit IS NULL` et le statut `en_cours`) ;
 *   2. la base d'audit (elle contient les réponses intégrales du questionnaire) n'est JAMAIS
 *      écrite en clair : `chiffrerParole`, qui LÈVE sans clé, plutôt qu'un repli en clair ;
 *   3. `base_empreinte` = SHA-256 du JSON en clair ; à la lecture, le JSON déchiffré doit rendre
 *      la même empreinte PUIS passer `BaseAuditSchema`. Sinon la lecture LÈVE : une base altérée
 *      ou hors contrat n'est jamais rendue ;
 *   4. une ligne MISE À L'ÉCART (demande d'effacement RGPD) n'est plus déchiffrée.
 *
 * Aucune écriture sur `clients` : la fiche n'est que LUE (raison sociale), par le worker.
 * Aucun contenu dans les journaux : des identifiants et des nombres seulement.
 */

import { createHash, timingSafeEqual } from "node:crypto";

import { chiffrerParole, dechiffrerParole } from "@/lib/chiffrer-parole";
import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "../../../prisma/generated/client";

import { BaseAuditSchema, VERSION_BASE_AUDIT, type BaseAudit } from "./base-audit-schema";
import type { ResultatRapport } from "./executer";

export type BaseRapports = Pick<PrismaClient, "rapportAvantAudit">;

export const STATUTS_RAPPORT = ["en_attente", "en_cours", "termine", "erreur", "annule"] as const;
export type StatutRapport = (typeof STATUTS_RAPPORT)[number];

/** Les colonnes lisibles sans déchiffrer (jamais `base_audit` ni `propositions_fiche`). */
const SELECT_ETAT = {
  id: true,
  clientId: true,
  questionnaireIds: true,
  statut: true,
  etape: true,
  progression: true,
  erreur: true,
  lanceParId: true,
  debutLe: true,
  finLe: true,
  versionSchema: true,
  baseEmpreinte: true,
  jetonsEntree: true,
  jetonsSortie: true,
  nbRecherches: true,
  pdfChemin: true,
  pdfValideLe: true,
  pdfValideParId: true,
  ecarteLe: true,
  creeLe: true,
  majLe: true,
} as const;

export interface EtatRapport {
  readonly id: string;
  readonly clientId: string;
  readonly questionnaireIds: ReadonlyArray<string>;
  readonly statut: string;
  readonly etape: string | null;
  readonly progression: number;
  readonly erreur: string | null;
  readonly lanceParId: string | null;
  readonly debutLe: Date | null;
  readonly finLe: Date | null;
  readonly versionSchema: string | null;
  readonly baseEmpreinte: string | null;
  readonly jetonsEntree: number;
  readonly jetonsSortie: number;
  readonly nbRecherches: number;
  readonly pdfChemin: string | null;
  readonly pdfValideLe: Date | null;
  readonly pdfValideParId: string | null;
  readonly ecarteLe: Date | null;
  readonly creeLe: Date;
  readonly majLe: Date;
}

// ── Erreurs ─────────────────────────────────────────────────────────────────

export class RapportIntrouvable extends Error {
  constructor() {
    super("Rapport avant audit introuvable.");
    this.name = "RapportIntrouvable";
  }
}

export class RapportEcarte extends Error {
  constructor() {
    super("Ce rapport a été mis à l'écart (demande d'effacement) : il n'est plus lu.");
    this.name = "RapportEcarte";
  }
}

export class BaseAbsente extends Error {
  constructor() {
    super("Ce rapport n'a pas (encore) de base d'audit enregistrée.");
    this.name = "BaseAbsente";
  }
}

/** L'empreinte ne correspond pas : la base a été altérée (ou mal enregistrée). */
export class EmpreinteAlteree extends Error {
  constructor() {
    super("La base d'audit ne correspond pas à son empreinte : elle n'est pas rendue.");
    this.name = "EmpreinteAlteree";
  }
}

export class BaseHorsContrat extends Error {
  constructor(detail: string) {
    super(`La base d'audit enregistrée ne respecte pas le contrat : ${detail}`);
    this.name = "BaseHorsContrat";
  }
}

/** La ligne n'était pas dans l'état attendu : l'écriture n'a rien changé. */
export class TransitionRefusee extends Error {
  constructor(attendu: string) {
    super(`Rapport avant audit : transition refusée (attendu : ${attendu}).`);
    this.name = "TransitionRefusee";
  }
}

// ── Chiffrement et empreinte (purs) ─────────────────────────────────────────

export function empreinteDe(json: string): string {
  return createHash("sha256").update(json, "utf8").digest("hex");
}

export interface BaseScellee {
  readonly chiffre: string;
  readonly empreinte: string;
}

/** Valide puis chiffre une base. Une base hors contrat n'est jamais scellée. */
export function scellerBase(base: BaseAudit): BaseScellee {
  const valide = BaseAuditSchema.safeParse(base);
  if (!valide.success) {
    throw new BaseHorsContrat(valide.error.issues[0]?.message ?? "invalide");
  }
  const json = JSON.stringify(valide.data);
  return { chiffre: chiffrerParole(json), empreinte: empreinteDe(json) };
}

function memeEmpreinte(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Déchiffre, vérifie l'empreinte, puis le contrat. Lève à la moindre anomalie. */
export function ouvrirBase(chiffre: string, empreinte: string): BaseAudit {
  const json = dechiffrerParole(chiffre);
  if (!/^[0-9a-f]{64}$/.test(empreinte) || !memeEmpreinte(empreinteDe(json), empreinte)) {
    throw new EmpreinteAlteree();
  }
  let brut: unknown;
  try {
    brut = JSON.parse(json);
  } catch {
    throw new BaseHorsContrat("JSON illisible");
  }
  const valide = BaseAuditSchema.safeParse(brut);
  if (!valide.success) {
    const i = valide.error.issues[0];
    throw new BaseHorsContrat(i === undefined ? "invalide" : `${i.path.join(".")} : ${i.message}`);
  }
  return valide.data;
}

/** Enveloppe chiffrée des propositions de mise à jour de la fiche (colonne JSON). */
export interface EnveloppePropositions {
  readonly v: 1;
  readonly chiffre: string;
}

export function scellerPropositions(
  propositions: BaseAudit["propositions_fiche"],
): EnveloppePropositions {
  return { v: 1, chiffre: chiffrerParole(JSON.stringify(propositions)) };
}

export function ouvrirPropositions(valeur: unknown): BaseAudit["propositions_fiche"] {
  const e = valeur as { v?: unknown; chiffre?: unknown } | null;
  if (e === null || typeof e !== "object" || e.v !== 1 || typeof e.chiffre !== "string") {
    throw new BaseHorsContrat("enveloppe des propositions illisible");
  }
  const brut: unknown = JSON.parse(dechiffrerParole(e.chiffre));
  return BaseAuditSchema.innerType().shape.propositions_fiche.parse(brut);
}

// ── Écritures ───────────────────────────────────────────────────────────────

/** Un nouveau lancement : TOUJOURS une nouvelle ligne, jamais la réutilisation d'une ancienne. */
export async function creerRapport(
  entree: {
    readonly clientId: string;
    readonly questionnaireIds: ReadonlyArray<string>;
    readonly lanceParId: string | null;
  },
  base: BaseRapports = prisma,
): Promise<{ id: string }> {
  return base.rapportAvantAudit.create({
    data: {
      clientId: entree.clientId,
      questionnaireIds: [...entree.questionnaireIds],
      statut: "en_attente",
      progression: 0,
      lanceParId: entree.lanceParId,
    },
    select: { id: true },
  });
}

/**
 * Prise du lancement par le worker : `en_attente` → `en_cours`, atomiquement. Rend `false` si la
 * ligne n'était pas en attente (déjà prise, terminée, annulée, ou mise à l'écart).
 */
export async function prendreRapport(
  id: string,
  maintenant: Date = new Date(),
  base: BaseRapports = prisma,
): Promise<boolean> {
  const r = await base.rapportAvantAudit.updateMany({
    where: { id, statut: "en_attente", ecarteLe: null },
    data: { statut: "en_cours", debutLe: maintenant, erreur: null, etape: "Démarrage" },
  });
  return r.count === 1;
}

/** Progression (0-100) et étape lisible. N'écrit que sur une ligne `en_cours`. */
export async function noterProgression(
  id: string,
  etape: string,
  progression: number,
  base: BaseRapports = prisma,
): Promise<void> {
  const pct = Math.max(0, Math.min(100, Math.round(progression)));
  await base.rapportAvantAudit.updateMany({
    where: { id, statut: "en_cours" },
    data: { etape: etape.slice(0, 200), progression: pct },
  });
}

/**
 * Le résultat : base chiffrée, empreinte, compteurs. Une seule fois par ligne : refusé si la
 * ligne n'est plus `en_cours` ou porte déjà une base (jamais d'écrasement).
 */
export async function enregistrerResultat(
  id: string,
  resultat: ResultatRapport,
  maintenant: Date = new Date(),
  base: BaseRapports = prisma,
): Promise<void> {
  const scellee = scellerBase(resultat.base);
  const r = await base.rapportAvantAudit.updateMany({
    where: { id, statut: "en_cours", baseAudit: null, ecarteLe: null },
    data: {
      statut: "termine",
      etape: "Terminé",
      progression: 100,
      finLe: maintenant,
      versionSchema: VERSION_BASE_AUDIT,
      baseAudit: scellee.chiffre,
      baseEmpreinte: scellee.empreinte,
      jetonsEntree: resultat.jetonsEntree,
      jetonsSortie: resultat.jetonsSortie,
      nbRecherches: resultat.nbRecherches,
      propositionsFiche: scellerPropositions(resultat.base.propositions_fiche) as never,
    },
  });
  if (r.count !== 1) throw new TransitionRefusee("en_cours, sans base enregistrée");
}

/** Échec : le message est écrit pour Will (jamais un extrait de réponse). */
export async function marquerErreur(
  id: string,
  message: string,
  maintenant: Date = new Date(),
  base: BaseRapports = prisma,
): Promise<void> {
  await base.rapportAvantAudit.updateMany({
    where: { id, statut: { in: ["en_attente", "en_cours"] } },
    data: { statut: "erreur", erreur: message.slice(0, 2000), finLe: maintenant },
  });
}

/**
 * Interruption (SIGTERM, redémarrage) : `en_cours` → `en_attente`, SANS erreur ni essai compté.
 * La reprise est dans l'état en base : `reprendreRapportsEnSuspens` la remet en file.
 */
export async function remettreEnAttente(id: string, base: BaseRapports = prisma): Promise<void> {
  await base.rapportAvantAudit.updateMany({
    where: { id, statut: "en_cours", baseAudit: null },
    data: {
      statut: "en_attente",
      etape: "Interrompu par un redémarrage : reprise automatique",
      progression: 0,
    },
  });
}

/** Au-delà de ce silence, une ligne `en_cours` est tenue pour abandonnée (conteneur tué). */
export const SILENCE_ABANDON_MS = 30 * 60_000;

/**
 * Lancements à reprendre au démarrage du worker : les lignes `en_attente`, et les `en_cours` sans
 * nouvelles depuis `SILENCE_ABANDON_MS` (remises en attente). Rend leurs identifiants.
 */
export async function lancementsEnSuspens(
  maintenant: Date = new Date(),
  base: BaseRapports = prisma,
): Promise<string[]> {
  await base.rapportAvantAudit.updateMany({
    where: {
      statut: "en_cours",
      baseAudit: null,
      majLe: { lt: new Date(maintenant.getTime() - SILENCE_ABANDON_MS) },
    },
    data: { statut: "en_attente", etape: "Reprise après un arrêt du worker", progression: 0 },
  });
  const lignes = await base.rapportAvantAudit.findMany({
    where: { statut: "en_attente", ecarteLe: null },
    select: { id: true },
    orderBy: { creeLe: "asc" },
    take: 50,
  });
  return lignes.map((l) => l.id);
}

// ── Lectures ────────────────────────────────────────────────────────────────

export async function lireEtatRapport(
  id: string,
  base: BaseRapports = prisma,
): Promise<EtatRapport | null> {
  return base.rapportAvantAudit.findUnique({ where: { id }, select: SELECT_ETAT });
}

/** L'historique d'une fiche, du plus récent au plus ancien (sans rien déchiffrer). */
export async function listerRapportsDuClient(
  clientId: string,
  base: BaseRapports = prisma,
): Promise<EtatRapport[]> {
  return base.rapportAvantAudit.findMany({
    where: { clientId },
    select: SELECT_ETAT,
    orderBy: { creeLe: "desc" },
  });
}

/** La base d'audit d'un rapport : déchiffrée, empreinte vérifiée, contrat validé. */
export async function lireBaseAudit(id: string, base: BaseRapports = prisma): Promise<BaseAudit> {
  const l = await base.rapportAvantAudit.findUnique({
    where: { id },
    select: { baseAudit: true, baseEmpreinte: true, ecarteLe: true },
  });
  if (l === null) throw new RapportIntrouvable();
  if (l.ecarteLe !== null) throw new RapportEcarte();
  if (l.baseAudit === null || l.baseEmpreinte === null) throw new BaseAbsente();
  return ouvrirBase(l.baseAudit, l.baseEmpreinte);
}
