/**
 * Corps XML de `sitemap-videos.xml` (lot W3, plan PLAN-W1-W4 §7). Pur : la liste des
 * vidéos PUBLIÉES entre en paramètre ; `null` quand il n'y en a aucune (la route répond 404).
 *
 * Par vidéo : `<loc>`, `<lastmod>` = `modifiee_le`, puis les balises `video:` (miniature
 * 16:9, titre, description, fichier, durée, date de publication avec fuseau, tout public).
 * Aucun `player_loc` (pas de page d'intégration) et aucune adresse `?t=`. Y figurent aussi la
 * galerie, les pages de thème et de série qui EXISTENT (≥ 3 vidéos), sans balise vidéo.
 */
import { dateIsoParis } from "@/lib/seo/video-jsonld";
import { groupesParSerie, groupesParTheme } from "./groupes";
import type { VideoPubliee } from "./lecture";

export function echapperXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function derniereModification(videos: ReadonlyArray<VideoPubliee>): Date {
  return new Date(Math.max(...videos.map((v) => v.modifieeLe.getTime())));
}

function noeud(loc: string, lastmod: Date, priorite: string, video = ""): string {
  return `  <url>\n    <loc>${echapperXml(loc)}</loc>\n    <lastmod>${lastmod.toISOString()}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${priorite}</priority>${video}\n  </url>`;
}

function balisesVideo(v: VideoPubliee, site: string): string {
  const f = v.fichiers;
  return (
    `\n    <video:video>` +
    `\n      <video:thumbnail_loc>${echapperXml(site + f.affiche169.chemin)}</video:thumbnail_loc>` +
    `\n      <video:title>${echapperXml(v.titre)}</video:title>` +
    `\n      <video:description>${echapperXml(v.description)}</video:description>` +
    `\n      <video:content_loc>${echapperXml(site + f.video.chemin)}</video:content_loc>` +
    `\n      <video:duration>${v.dureeSecondes}</video:duration>` +
    `\n      <video:publication_date>${dateIsoParis(v.publieeLe)}</video:publication_date>` +
    `\n      <video:family_friendly>yes</video:family_friendly>` +
    `\n    </video:video>`
  );
}

export function construireSitemapVideos(
  videos: ReadonlyArray<VideoPubliee>,
  siteUrl: string,
): string | null {
  if (videos.length === 0) return null;
  const site = siteUrl.replace(/\/+$/, "");
  const urls: string[] = [noeud(`${site}/fr/videos`, derniereModification(videos), "0.7")];

  for (const g of groupesParTheme(videos)) {
    if (g.aPage) {
      urls.push(
        noeud(`${site}/fr/videos/theme/${g.theme.slug}`, derniereModification(g.videos), "0.6"),
      );
    }
  }
  for (const g of groupesParSerie(videos)) {
    if (g.aPage) {
      urls.push(noeud(`${site}/fr/videos/serie/${g.slug}`, derniereModification(g.videos), "0.5"));
    }
  }
  for (const v of videos) {
    urls.push(noeud(`${site}/fr/videos/${v.slug}`, v.modifieeLe, "0.8", balisesVideo(v, site)));
  }

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n` +
    `${urls.join("\n")}\n</urlset>`
  );
}
