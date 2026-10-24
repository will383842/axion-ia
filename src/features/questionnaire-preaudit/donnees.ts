/**
 * La charge « schéma 3 » envoyée par le questionnaire de Will (2026-10-24) — module PUR.
 *
 * On ne change pas le schéma : on vérifie seulement la forme minimale (assez pour classer la
 * réponse par personne) et on borne la taille. Le contenu complet est gardé tel quel, chiffré.
 */

export const CHARGE_MAX_OCTETS = 200_000;
export const ENVOIS_MAX_PAR_QUESTIONNAIRE = 60;

export type ModeReponse = "main" | "emp" | "it";

export interface ChargeValide {
  readonly mode: ModeReponse;
  readonly membre: string | null;
  readonly json: string;
}

export type ResultatCharge =
  | { readonly ok: true; readonly charge: ChargeValide }
  | { readonly ok: false; readonly motif: string };

const MODES: ReadonlySet<string> = new Set(["main", "emp", "it"]);

function objet(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

export function validerCharge(texte: string): ResultatCharge {
  if (Buffer.byteLength(texte, "utf8") > CHARGE_MAX_OCTETS) {
    return { ok: false, motif: "Réponse trop volumineuse." };
  }
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    return { ok: false, motif: "Réponse illisible." };
  }
  const o = objet(brut);
  if (o === null || o["schema"] !== 3) return { ok: false, motif: "Schéma inattendu." };
  const mode = o["mode"];
  if (typeof mode !== "string" || !MODES.has(mode)) {
    return { ok: false, motif: "Parcours inconnu." };
  }
  const consent = objet(o["consentements"]);
  if (consent === null || consent["traitement"] !== true) {
    return { ok: false, motif: "Le consentement au traitement est requis." };
  }
  if (objet(o["donnees"]) === null) return { ok: false, motif: "Aucune réponse." };
  const m = o["membre"];
  const membre = typeof m === "string" && m.trim() !== "" ? m.trim().slice(0, 60) : null;
  return { ok: true, charge: { mode: mode as ModeReponse, membre, json: texte } };
}

/** Pour l'affichage sur la fiche : les réponses d'une personne, en paires lisibles. */
export interface ReponseLisible {
  readonly id: string;
  readonly mode: ModeReponse;
  readonly membre: string | null;
  readonly recuLe: Date;
  readonly lignes: ReadonlyArray<{ readonly cle: string; readonly valeur: string }>;
}

function enTexte(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v))
    return v
      .map(enTexte)
      .filter((s) => s !== "")
      .join(", ");
  return JSON.stringify(v);
}

export function lignesDeLaCharge(json: string): ReadonlyArray<{ cle: string; valeur: string }> {
  try {
    const d = objet(objet(JSON.parse(json))?.["donnees"]);
    if (d === null) return [];
    return Object.entries(d)
      .map(([cle, v]) => ({ cle, valeur: enTexte(v) }))
      .filter((l) => l.valeur !== "");
  } catch {
    return [];
  }
}
