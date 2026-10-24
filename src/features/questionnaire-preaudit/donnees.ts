/**
 * La charge envoyée par le questionnaire de Will (2026-10-24) — module PUR.
 *
 * Schémas acceptés : 3, et 4 (qui ajoute `service`, `calc`, le bloc `prefill`
 * {confirmes, modifies, non_verifies, vides}, `ref`…). Tout autre est refusé.
 * On ne change pas le schéma : on vérifie seulement la forme minimale (assez pour classer la
 * réponse par personne) et on borne la taille. Le contenu complet est gardé TEL QUEL (le texte
 * reçu, octet pour octet), chiffré : zéro perte de réponses.
 */

export const SCHEMAS_ACCEPTES: ReadonlySet<unknown> = new Set([3, 4]);

/** 400 Ko : le pire cas borné du schéma 4 mesuré à ~229 Ko. */
export const CHARGE_MAX_OCTETS = 400_000;
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
  if (o === null || !SCHEMAS_ACCEPTES.has(o["schema"])) {
    return { ok: false, motif: "Schéma inattendu." };
  }
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

/** État d'une case pré-remplie par Axion (bloc `prefill` du schéma 4). */
export type EtatPrefill = "confirme" | "modifie" | "non_verifie" | "vide";

export const LIBELLE_PREFILL: Readonly<Record<EtatPrefill, string>> = {
  confirme: "pré-rempli, confirmé",
  modifie: "pré-rempli, modifié",
  non_verifie: "pré-rempli, non vérifié",
  vide: "pré-rempli, vidé",
};

export interface LigneLisible {
  readonly cle: string;
  readonly valeur: string;
  /** Présent seulement si la case avait été pré-remplie (schéma 4). */
  readonly prefill?: EtatPrefill;
}

/** Pour l'affichage sur la fiche : les réponses d'une personne, en paires lisibles. */
export interface ReponseLisible {
  readonly id: string;
  readonly mode: ModeReponse;
  readonly membre: string | null;
  readonly recuLe: Date;
  readonly lignes: ReadonlyArray<LigneLisible>;
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

const LISTES_PREFILL: ReadonlyArray<readonly [string, EtatPrefill]> = [
  ["confirmes", "confirme"],
  ["modifies", "modifie"],
  ["non_verifies", "non_verifie"],
  ["vides", "vide"],
];

/** Le bloc `prefill`, lu en `id → état` ; vide pour le schéma 3 ou un bloc mal formé. */
function etatsPrefill(p: Record<string, unknown> | null): Map<string, EtatPrefill> {
  const etats = new Map<string, EtatPrefill>();
  if (p === null) return etats;
  for (const [liste, etat] of LISTES_PREFILL) {
    const ids = p[liste];
    if (!Array.isArray(ids)) continue;
    for (const id of ids) if (typeof id === "string" && !etats.has(id)) etats.set(id, etat);
  }
  return etats;
}

export function lignesDeLaCharge(json: string): ReadonlyArray<LigneLisible> {
  try {
    const o = objet(JSON.parse(json));
    const d = objet(o?.["donnees"]);
    if (d === null) return [];
    const etats = etatsPrefill(objet(o?.["prefill"]));
    const lignes: LigneLisible[] = Object.entries(d)
      .map(([cle, v]) => {
        const etat = etats.get(cle);
        return etat === undefined
          ? { cle, valeur: enTexte(v) }
          : { cle, valeur: enTexte(v), prefill: etat };
      })
      .filter((l) => l.valeur !== "");
    // Une case pré-remplie que la personne a VIDÉE n'est plus dans `donnees` : on la montre.
    const vues = new Set(lignes.map((l) => l.cle));
    for (const [cle, etat] of etats) {
      if (etat === "vide" && !vues.has(cle)) {
        lignes.push({ cle, valeur: "(vidée par la personne)", prefill: "vide" });
      }
    }
    return lignes;
  } catch {
    return [];
  }
}
