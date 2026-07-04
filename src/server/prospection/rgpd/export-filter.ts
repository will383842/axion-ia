/**
 * Prospection — Re-filtre RGPD à la génération d'export (T8, pur).
 *
 * Vérifie l'opt-out à 3 points (05-CONFORMITE §6) : ici le 3e = **au moment de
 * générer l'export** (re-filtre live). Exclut :
 *  - `optOut` (droit d'opposition) ;
 *  - non-diffusible INSEE (matrice #4 — jamais exporté) ;
 *  - `SuppressionEntry` multi-clé (siren / email / domaine) — un opt-out arrivé
 *    APRÈS la collecte n'est jamais exporté (matrice #5).
 * Pur → testable sans DB.
 */

import { normalizeEmail, emailDomain } from "@/server/prospection/enrichment/email";

export type SuppressionType = "siren" | "email" | "domaine" | "personKey";

/** Normalise la valeur d'opposition selon son type (clé de dédup + matching). */
export function normalizeSuppression(type: SuppressionType, value: string): string {
  const v = value.trim();
  if (type === "siren") return v.replace(/\D/g, "");
  if (type === "email") return normalizeEmail(v);
  if (type === "domaine")
    return v
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "");
  return v;
}

export interface SuppressionSets {
  sirens: Set<string>;
  emails: Set<string>;
  domaines: Set<string>;
  personKeys: Set<string>;
}

export function emptySuppressionSets(): SuppressionSets {
  return { sirens: new Set(), emails: new Set(), domaines: new Set(), personKeys: new Set() };
}

/** Construit les ensembles d'opposition depuis les entrées SuppressionEntry. */
export function buildSuppressionSets(
  entries: ReadonlyArray<{ type: string; valueNormalized: string }>,
): SuppressionSets {
  const sets = emptySuppressionSets();
  for (const e of entries) {
    if (e.type === "siren") sets.sirens.add(e.valueNormalized);
    else if (e.type === "email") sets.emails.add(e.valueNormalized.toLowerCase());
    else if (e.type === "domaine") sets.domaines.add(e.valueNormalized.toLowerCase());
    else if (e.type === "personKey") sets.personKeys.add(e.valueNormalized);
  }
  return sets;
}

export interface ExportCandidate {
  siren: string;
  statutDiffusion: string | null;
  optOut: boolean;
  emails: string[];
}

export type ExclusionReason = "opt_out" | "non_diffusible" | "siren" | "email" | "domaine" | null;

/** Décide si une entreprise doit être EXCLUE de l'export (et pourquoi). */
export function exportExclusionReason(
  company: ExportCandidate,
  sets: SuppressionSets,
): ExclusionReason {
  if (company.optOut) return "opt_out";
  if (company.statutDiffusion !== "diffusible") return "non_diffusible"; // #4
  if (sets.sirens.has(company.siren)) return "siren"; // #5 (opt-out post-collecte)
  for (const raw of company.emails) {
    const e = normalizeEmail(raw);
    if (sets.emails.has(e)) return "email";
    if (sets.domaines.has(emailDomain(e))) return "domaine";
  }
  return null;
}

export function isExcludedFromExport(company: ExportCandidate, sets: SuppressionSets): boolean {
  return exportExclusionReason(company, sets) !== null;
}
