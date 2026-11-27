/**
 * Pilotage de l'équipe éditoriale depuis la console (PR 17).
 *
 * L'équipe ne tourne que si LES DEUX conditions sont réunies :
 *  1. la variable `CONTENT_EQUIPE_EDITORIALE` vaut exactement « true » (coupe-circuit général) ;
 *  2. le réglage console `equipe_marche` (ContentGenConfig) est sur marche.
 * Réglage absent, illisible ou de forme inattendue = ARRÊT (lecture tolérante, côté sûr).
 *
 * Module sans « use server » : lecture via `readContentGenConfigDirect`, utilisable par les workers.
 */

import { readContentGenConfigDirect } from "../config-store";
import {
  CLE_ARTICLES_MAX_JOUR,
  CLE_MAJ_MAX_JOUR,
  ARTICLES_MAX_JOUR_DEFAUT,
  MAJ_MAX_JOUR_DEFAUT,
} from "../scheduler/anti-burst";
import {
  equipeEditorialeActive,
  type EnvEquipeEditoriale,
} from "../fact-check/equipe-editoriale-drapeau";

export const CLE_EQUIPE_MARCHE = "equipe_marche";
/** Bornes des quotas modifiables depuis la console (inclusives). */
export const BORNE_ARTICLES_MAX_JOUR = 10;
export const BORNE_MAJ_MAX_JOUR = 5;
/** Au plus un renvoi en correction depuis la console, par article. */
export const RENVOIS_CONSOLE_MAX = 1;

export const ACTION_PUBLIER = "content-gen.equipe.publier";
export const ACTION_RENVOYER = "content-gen.equipe.renvoyer";
export const ACTION_MARCHE = "content-gen.equipe.marche";
export const ACTION_QUOTAS = "content-gen.equipe.quotas";

/** Valeur stockée : `true`/`false` ou `{ marche: boolean }`. Autre chose = arrêt. */
export function lireMarche(valeur: unknown): boolean {
  if (valeur === true) return true;
  if (valeur && typeof valeur === "object" && !Array.isArray(valeur)) {
    return (valeur as Record<string, unknown>)["marche"] === true;
  }
  return false;
}

/** Lecture tolérante : clé absente ou base illisible = arrêt. */
export async function marcheConsole(): Promise<boolean> {
  try {
    return lireMarche(await readContentGenConfigDirect<unknown>(CLE_EQUIPE_MARCHE, false));
  } catch {
    return false;
  }
}

export interface EtatEquipe {
  readonly active: boolean;
  readonly variable: boolean;
  readonly console: boolean;
  /** Présente seulement si l'équipe est arrêtée. */
  readonly raison?: string;
}

export function etatEquipe(marche: boolean, env?: EnvEquipeEditoriale): EtatEquipe {
  const variable = equipeEditorialeActive(env);
  if (variable && marche) return { active: true, variable, console: marche };
  const raison = !variable
    ? "Coupe-circuit général : la variable CONTENT_EQUIPE_EDITORIALE n'est pas sur « true » (réglage serveur)."
    : "Arrêtée depuis la console (réglage « marche / arrêt » sur arrêt).";
  return { active: false, variable, console: marche, raison };
}

/** Porte unique pour les workers : variable allumée ET console sur marche. */
export async function equipeEnMarche(env?: EnvEquipeEditoriale): Promise<boolean> {
  if (!equipeEditorialeActive(env)) return false;
  return marcheConsole();
}

export interface QuotasEquipe {
  readonly articlesMaxJour: number;
  readonly majMaxJour: number;
}

function entierBorne(v: unknown, max: number, nom: string): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > max) {
    throw new Error(`quota_invalide : ${nom} doit être un entier entre 0 et ${max}`);
  }
  return v;
}

/** Valide les quotas saisis : lève si hors bornes (0-10 articles, 0-5 mises à jour). */
export function validerQuotas(entree: {
  articlesMaxJour: unknown;
  majMaxJour: unknown;
}): QuotasEquipe {
  return {
    articlesMaxJour: entierBorne(
      entree.articlesMaxJour,
      BORNE_ARTICLES_MAX_JOUR,
      "articles par jour",
    ),
    majMaxJour: entierBorne(entree.majMaxJour, BORNE_MAJ_MAX_JOUR, "mises à jour par jour"),
  };
}

export { CLE_ARTICLES_MAX_JOUR, CLE_MAJ_MAX_JOUR, ARTICLES_MAX_JOUR_DEFAUT, MAJ_MAX_JOUR_DEFAUT };

/** Lit les quotas stockés (tolérant : valeur absente/aberrante = défaut, plafonnée aux bornes console). */
export async function lireQuotas(): Promise<QuotasEquipe> {
  const lire = async (cle: string, defaut: number, max: number): Promise<number> => {
    try {
      const v = await readContentGenConfigDirect<unknown>(cle, defaut);
      return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max ? v : defaut;
    } catch {
      return defaut;
    }
  };
  return {
    articlesMaxJour: await lire(
      CLE_ARTICLES_MAX_JOUR,
      ARTICLES_MAX_JOUR_DEFAUT,
      BORNE_ARTICLES_MAX_JOUR,
    ),
    majMaxJour: await lire(CLE_MAJ_MAX_JOUR, MAJ_MAX_JOUR_DEFAUT, BORNE_MAJ_MAX_JOUR),
  };
}
