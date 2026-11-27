/**
 * La FICHE DES COMMISSIONS et le LIVRET D'ACCUEIL de l'apporteur (versions du 27/11/2026).
 *
 * Deux PDF gardés sous `private/apporteurs/` : Next ne sert jamais ce dossier, le Dockerfile le
 * copie dans l'image. Ils sortent par DEUX chemins seulement, qui servent le MÊME fichier :
 *   · les routes `…/[jeton]/fiche-commissions` et `…/[jeton]/livret`, qui vérifient le lien
 *     personnel de l'apporteur (avant comme après signature) ;
 *   · l'e-mail « contrat signé » (annexes déclarées avec les autres pièces jointes).
 *
 * Modèle : `guide-demarrage.ts`.
 *
 * ⚠️ Aucun `server-only` : le script de dépôt (tsx, hors Next) importe ce module.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import type { EtatPage } from "./signature-regles";

export const FICHIER_PRIVE_FICHE_COMMISSIONS = "private/apporteurs/fiche-des-commissions.pdf";
export const NOM_FICHIER_FICHE_COMMISSIONS = "Fiche-des-commissions-Axion-IA.pdf";
export const FICHIER_PRIVE_LIVRET = "private/apporteurs/livret-apporteur.pdf";
export const NOM_FICHIER_LIVRET = "Livret-apporteur-Axion-IA.pdf";

/** Lit un PDF sous la racine du projet : `null` s'il est absent, vide ou pas un PDF. */
async function lirePdf(relatif: string): Promise<Buffer | null> {
  try {
    const buf = await readFile(path.resolve(process.cwd(), relatif));
    if (buf.byteLength === 0 || buf.subarray(0, 5).toString("latin1") !== "%PDF-") return null;
    return buf;
  } catch {
    return null;
  }
}

/** Le PDF de la fiche des commissions, ou `null`. Ne lève jamais. */
export function lireFicheCommissions(): Promise<Buffer | null> {
  return lirePdf(FICHIER_PRIVE_FICHE_COMMISSIONS);
}

/** Le PDF du livret d'accueil, ou `null`. Ne lève jamais. */
export function lireLivret(): Promise<Buffer | null> {
  return lirePdf(FICHIER_PRIVE_LIVRET);
}

/**
 * États de la page où les documents remis (fiche, livret, guide) sont ouverts par le lien
 * personnel : avant la signature (modifiable, à vérifier) comme après. Tout autre état — refusé,
 * résilié, fiche retirée — reste en 404 neutre.
 */
export function documentsOuvertsPour(etat: EtatPage): boolean {
  return etat === "modifiable" || etat === "a_verifier" || etat === "signe";
}
