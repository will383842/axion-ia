/**
 * Section « ## Vidéos » de `llms.txt` / `llms-full.txt` (lot W3). Pure : la liste des vidéos
 * PUBLIÉES entre en paramètre ; chaîne vide quand il n'y en a aucune (aucune section, aucune
 * mention de `/fr/videos`). Une vidéo retirée n'y figure plus : la lecture ne rend que les
 * publiées. Aucune adresse `?t=`.
 */
import { libelleDuree } from "@/content/videos/duree";
import type { VideoPubliee } from "./lecture";

/** Première phrase d'un texte (jusqu'au premier point suivi d'un espace ou de la fin). */
export function premierePhrase(texte: string): string {
  const m = /^[\s\S]*?[.!?](?=\s|$)/.exec(texte.trim());
  return (m ? m[0] : texte).trim();
}

export function sectionVideosLlms(
  videos: ReadonlyArray<VideoPubliee>,
  siteUrl: string,
  detail = false,
): string {
  if (videos.length === 0) return "";
  const site = siteUrl.replace(/\/+$/, "");
  const lignes = videos.map((v) => {
    const base = `- [${v.titre}](${site}/fr/videos/${v.slug}) — ${libelleDuree(v.dureeSecondes)} · ${premierePhrase(v.description)}`;
    return detail ? `${base}\n${v.aRetenir.map((p) => `  - ${p}`).join("\n")}` : base;
  });
  return `\n## Vidéos\n\n- [Toutes les vidéos](${site}/fr/videos) — galerie par thème, chaque vidéo est résumée par écrit.\n${lignes.join("\n")}\n`;
}
