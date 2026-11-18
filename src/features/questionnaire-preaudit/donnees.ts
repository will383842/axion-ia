/**
 * La charge envoyée par le questionnaire de Will (2026-10-24) — module PUR.
 *
 * Schémas acceptés : 3, et 4 (qui ajoute `service`, `calc`, le bloc `prefill`
 * {confirmes, modifies, non_verifies, vides}, `ref`…). Tout autre est refusé.
 * On ne change pas le schéma : on vérifie seulement la forme minimale (assez pour classer la
 * réponse par personne) et on borne la taille. Le contenu complet est gardé TEL QUEL (le texte
 * reçu, octet pour octet), chiffré : zéro perte de réponses.
 */

import type { LectureReponse } from "./lecture";

export const SCHEMAS_ACCEPTES: ReadonlySet<unknown> = new Set([3, 4]);

/**
 * 1 000 000 octets (audit des données du 24/10/2026) : TOUTES les cases remplies au maximum
 * pèsent 452 Ko (v2) à 467 Ko (Oury) pour une réponse, et le brouillon (état complet de la page)
 * 586 à 605 Ko — l'ancien plafond de 400 000 octets aurait refusé ces deux cas. 1 Mo les couvre
 * avec une marge de 1,6 fois et reste une BORNE DE SÉCURITÉ : le corps est lu en flux et coupé
 * au plafond (`corps.ts`), chaque lien est limité en débit, et au chiffrement (base64, ×1,33)
 * une ligne pèse au plus ~1,4 Mo.
 */
export const CHARGE_MAX_OCTETS = 1_000_000;
/**
 * 300 réponses par questionnaire : la page admet 60 collaborateurs + le dirigeant + le référent
 * informatique (62 personnes) ; chacune peut renvoyer une version corrigée. Un renvoi IDENTIQUE
 * (même `envoyeLe`) ne crée pas de ligne (idempotence, `enregistrerReponse`) et ne compte pas.
 */
export const ENVOIS_MAX_PAR_QUESTIONNAIRE = 300;

export type ModeReponse = "main" | "emp" | "it";

export interface ChargeValide {
  readonly mode: ModeReponse;
  readonly membre: string | null;
  /** `envoyeLe` de la charge (heure du navigateur, texte tel quel, ≤ 40 car.) ou `null`. */
  readonly envoyeLe: string | null;
  /**
   * Case séparée « recevoir des informations par e-mail » (`consentements.infosEmail`) : booléen,
   * ou `null` si absente ou mal formée (jamais un refus). N'abonne personne, n'envoie rien.
   */
  readonly infosEmail: boolean | null;
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
  const e = o["envoyeLe"];
  const envoyeLe = typeof e === "string" && e !== "" && e.length <= 40 ? e : null;
  const ie = consent["infosEmail"];
  const infosEmail = typeof ie === "boolean" ? ie : null;
  return {
    ok: true,
    charge: { mode: mode as ModeReponse, membre, envoyeLe, infosEmail, json: texte },
  };
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
  /** Réponse impossible à déchiffrer ou à lire : alerte rouge dans la console, jamais du vide. */
  readonly illisible: boolean;
  /** Mise à l'écart sur demande d'effacement d'un salarié (effacement définitif : clic de Will). */
  readonly ecarteLe: Date | null;
  /** Case « informations par e-mail » : oui, non, ou `null` (non posée). Datée par `recuLe`. */
  readonly infosEmail: boolean | null;
  /** Lecture complète (en-tête, tableaux, calc, prefill, brut), ou `null` (illisible, écartée). */
  readonly lecture: LectureReponse | null;
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
