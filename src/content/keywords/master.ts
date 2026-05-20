// src/content/keywords/master.ts
// AUTO-GENERATED — Mode G complet (6 phases) — 2026-05-20
// Généré par Claude Sonnet 4.6 depuis PROMPT-KEYWORD-STRATEGY-MASTER-V1.md v1.2
//
// Modifier via admin console /admin/content-gen/keyword-engine
// ou éditer les fichiers g1-g6 puis relancer ce fichier.
//
// FILTRE APPLIQUÉ : seeds contenant OPCO / Qualiopi / CPF exclus
// (Axion-IA non certifié — ne pas induire les visiteurs en erreur)

import type { KeywordSeed } from "./types";

import { KW_AUDIT_G1 } from "./g1-audit";
import { KW_INTERVENTIONS_G2 } from "./g2-interventions";
import { KW_IMPLEMENTATION_G3, KW_CODAGE_G3 } from "./g3-implementation-codage";
import { KW_AEO_G4 } from "./g4-aeo";
import { KW_COMPARATIFS_G5, KW_PARTENAIRES_G5 } from "./g5-comparatifs-partenaires";
import { KW_SECTORIELS_G6, KW_COACHING_G6 } from "./g6-sectoriels-coaching";

// Termes à filtrer — Axion-IA ne peut pas prétendre offrir ces financements
const BANNED_TERMS = ["OPCO", "Qualiopi", "CPF", "FIFPL", "Datadock"];

function isClean(seed: KeywordSeed): boolean {
  const text = JSON.stringify(seed).toLowerCase();
  return !BANNED_TERMS.some((t) => text.toLowerCase().includes(t.toLowerCase()));
}

// ─── Exports par dimension sémantique ──────────────────────────────────────

export const KW_TRANSACTIONNEL: KeywordSeed[] = [
  ...KW_AUDIT_G1,
  ...KW_INTERVENTIONS_G2,
  ...KW_IMPLEMENTATION_G3,
  ...KW_CODAGE_G3,
  ...KW_SECTORIELS_G6,
  ...KW_COACHING_G6,
].filter((s) => s.intent === "transactionnel" && isClean(s));

export const KW_BENEFICE: KeywordSeed[] = [
  ...KW_AUDIT_G1,
  ...KW_INTERVENTIONS_G2,
  ...KW_IMPLEMENTATION_G3,
  ...KW_CODAGE_G3,
].filter((s) => s.intent === "benefice" && isClean(s));

export const KW_INFORMATIONNEL: KeywordSeed[] = [
  ...KW_AUDIT_G1,
  ...KW_INTERVENTIONS_G2,
  ...KW_IMPLEMENTATION_G3,
  ...KW_CODAGE_G3,
  ...KW_SECTORIELS_G6,
].filter((s) => s.intent === "informationnel" && isClean(s));

export const KW_AEO: KeywordSeed[] = [
  ...KW_AEO_G4,
  ...KW_AUDIT_G1,
  ...KW_INTERVENTIONS_G2,
  ...KW_SECTORIELS_G6,
].filter((s) => s.intent === "aeo" && isClean(s));

export const KW_COMPARATIF: KeywordSeed[] = [...KW_COMPARATIFS_G5].filter(
  (s) => s.intent === "comparatif" && isClean(s),
);

export const KW_PARTENAIRE: KeywordSeed[] = [...KW_PARTENAIRES_G5].filter(
  (s) => s.intent === "partenaire" && isClean(s),
);

export const KW_SECTORIEL: KeywordSeed[] = [
  ...KW_SECTORIELS_G6,
  ...KW_AUDIT_G1,
  ...KW_INTERVENTIONS_G2,
  ...KW_IMPLEMENTATION_G3,
].filter((s) => s.intent === "sectoriel" && isClean(s));

// ─── Export master ───────────────────────────────────────────────────────────

export const ALL_KEYWORD_SEEDS: KeywordSeed[] = [
  ...KW_TRANSACTIONNEL,
  ...KW_BENEFICE,
  ...KW_INFORMATIONNEL,
  ...KW_AEO,
  ...KW_COMPARATIF,
  ...KW_PARTENAIRE,
  ...KW_SECTORIEL,
];

// ─── Filtres utiles pour le Content Engine ───────────────────────────────────

export const PRIORITY_1 = ALL_KEYWORD_SEEDS.filter((s) => s.priorite === 1);
export const PRIORITY_2 = ALL_KEYWORD_SEEDS.filter((s) => s.priorite === 2);

export const BY_MODULE = (m: KeywordSeed["module"]) =>
  ALL_KEYWORD_SEEDS.filter((s) => s.module === m);

export const BY_CIBLE = (c: KeywordSeed["cible"]) => ALL_KEYWORD_SEEDS.filter((s) => s.cible === c);

export const BY_SECTEUR = (slug: string) => ALL_KEYWORD_SEEDS.filter((s) => s.secteur === slug);
