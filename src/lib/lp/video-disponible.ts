/**
 * La vidéo d'une page n'existe que si ses fichiers existent.
 *
 * La page VSL apporteurs doit être LIVRABLE SANS FILM : Will pose le MP4 et
 * l'affiche dans `public/videos/`, et le bloc apparaît au prochain rendu (la
 * page est régénérée toutes les heures). Tant que l'un des deux manque, rien
 * n'est rendu — ni lecteur noir, ni image cassée.
 *
 * Serveur seulement (`node:fs`). Les chemins sont ceux servis par le site
 * (`/videos/…`), résolus dans `public/` ; toute valeur qui sortirait de
 * `public/videos/` est refusée.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const RACINE_VIDEOS = "/videos/";

function cheminDisque(chemin: string, racine: string): string | null {
  if (!chemin.startsWith(RACINE_VIDEOS) || chemin.includes("..")) return null;
  return path.join(racine, "public", chemin);
}

/** Vrai si le fichier servi à ce chemin public existe (jamais de levée). */
export function fichierPublicExiste(chemin: string, racine: string = process.cwd()): boolean {
  try {
    const p = cheminDisque(chemin, racine);
    return p !== null && existsSync(p);
  } catch {
    return false;
  }
}

/** Le film ET son affiche doivent exister. */
export function videoDisponible(
  fichiers: { readonly src: string; readonly poster: string },
  racine: string = process.cwd(),
): boolean {
  return fichierPublicExiste(fichiers.src, racine) && fichierPublicExiste(fichiers.poster, racine);
}

/**
 * Texte des répliques d'un fichier WebVTT, sans horodatage : sert de
 * transcription repliable sous le film (accessibilité). Vide si le fichier
 * manque — le film reste lisible, sans bloc de transcription.
 */
export function transcriptionDepuisVtt(vtt: string): string[] {
  const lignes = vtt.replace(/\r/g, "").split("\n");
  const repliques: string[] = [];
  let enBloc = false;
  for (const brute of lignes) {
    const ligne = brute.trim();
    if (ligne === "" || ligne === "WEBVTT" || /^(NOTE|STYLE|REGION)\b/.test(ligne)) {
      enBloc = false;
      continue;
    }
    if (ligne.includes("-->")) {
      enBloc = true;
      continue;
    }
    if (!enBloc) continue; // identifiant de réplique
    repliques.push(ligne.replace(/<[^>]+>/g, "").trim());
  }
  return repliques.filter((l) => l.length > 0);
}

export function lireTranscription(chemin: string, racine: string = process.cwd()): string[] {
  try {
    const p = cheminDisque(chemin, racine);
    if (p === null || !existsSync(p)) return [];
    return transcriptionDepuisVtt(readFileSync(p, "utf-8"));
  } catch {
    return [];
  }
}
