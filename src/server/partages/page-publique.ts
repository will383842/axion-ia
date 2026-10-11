/**
 * LA PAGE DE TÉLÉCHARGEMENT d'un lien privé (Candidatures unifiées L5, ADR 0065 D6) — module PUR.
 *
 * HTML statique, SANS AUCUN SCRIPT : la page pèse quelques kilo-octets, s'ouvre
 * sur n'importe quel téléphone (lisible à 390 px) et sa politique de sécurité
 * peut tout interdire sauf le style en ligne. Charte des pièces envoyées aux
 * clients — TERRACOTTA du gabarit e-mail (`src/lib/email/templates/_layout.tsx`,
 * objet `C`), pas le bleu du site ; le bleu ne sert qu'aux liens texte.
 * Vouvoiement. Les textes sont relus par Will
 * (`_PLAN-CANDIDATURES-UNIFIEES-2026-10-07/TEXTES-A-RELIRE.md`).
 *
 * ⚠️ Le jeton est dans l'adresse : `Referrer-Policy: no-referrer` (posé ici ET
 * par la règle `/api/partage/:path*` de `next.config.ts`, la dernière règle
 * gagnant sur `/:path*`) — l'adresse n'est jamais transmise au stockage ni au
 * site d'un lien externe.
 */

import { dateCourte, PHRASE_SUIVI } from "./liens";
import { tailleLisible } from "./regles";

export const CSP_PAGE_PARTAGE = [
  "default-src 'none'",
  "style-src 'unsafe-inline'",
  "img-src 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
].join("; ");

/** En-têtes de toute réponse de `/api/partage/…` : rien en cache, ni chez Cloudflare ni ailleurs. */
export const ENTETES_PAGE_PARTAGE: Readonly<Record<string, string>> = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": CSP_PAGE_PARTAGE,
};

const ADRESSE_CONTACT = "contact@axion-ia.com";

/** Fichiers confiés pour un essai : la mention de la décision 8 de Will, mot pour mot. */
export const MENTION_RUSHS =
  "Fichiers confiés pour l'essai uniquement, à ne pas diffuser ni réutiliser.";

export function echapper(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Couleurs : objet `C` du gabarit e-mail (ivoire, encre, terracotta).
const STYLE = `
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:#f6f1e8;color:#241d15;font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.bandeau{height:6px;background:linear-gradient(90deg,#c24a1b 0%,#d1561f 55%,#8c3010 100%)}
header{padding:18px 16px 0;max-width:600px;margin:0 auto;font-weight:700;font-size:18px;color:#1c150e}
header span{display:inline-block;width:10px;height:10px;border-radius:50%;background:#c24a1b;margin-right:10px}
main{max-width:600px;margin:0 auto;padding:16px 16px 48px}
.carte{background:#fff;border:1px solid #eee2d2;border-radius:16px;padding:22px 18px}
h1{font-family:Georgia,"Times New Roman",Times,serif;font-weight:500;font-size:26px;line-height:1.25;margin:0 0 12px;color:#1c150e}
p{margin:0 0 14px}
.muted{color:#6b6153;font-size:14px}
.mention{background:#f7ebe2;border-left:4px solid #c24a1b;border-radius:8px;padding:12px 14px;font-weight:600}
ul{list-style:none;margin:18px 0 0;padding:0}
li{border-top:1px solid #eee2d2;padding:14px 0}
.titre{font-weight:700;color:#1c150e;overflow-wrap:anywhere}
.details{color:#6b6153;font-size:14px;overflow-wrap:anywhere;margin:2px 0 10px}
.bouton{display:inline-block;min-height:44px;padding:11px 22px;border-radius:999px;background:#c24a1b;color:#fff;font-weight:700;text-decoration:none}
.bouton:focus-visible{outline:3px solid #8c3010;outline-offset:2px}
.etat{color:#6b6153;font-size:14px;margin:0}
a{color:#1a4dd9}
a.bouton{color:#fff}
footer{max-width:600px;margin:0 auto;padding:0 16px 32px;color:#6b6153;font-size:13px}
`;

function page(titre: string, corps: string): string {
  return (
    '<!doctype html><html lang="fr"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="robots" content="noindex, nofollow">' +
    '<meta name="referrer" content="no-referrer">' +
    `<title>${echapper(titre)} — Axion-IA</title><style>${STYLE}</style></head>` +
    '<body><div class="bandeau" aria-hidden="true"></div>' +
    '<header><span aria-hidden="true"></span>Axion-IA</header>' +
    `<main><div class="carte">${corps}</div></main>` +
    `<footer>Une question ? Écrivez-nous : <a href="mailto:${ADRESSE_CONTACT}">${ADRESSE_CONTACT}</a></footer>` +
    "</body></html>"
  );
}

/** Lien faux, expiré, retiré, ou fonction éteinte : UNE page, rien ne dit lequel [I18]. */
export function pageNeutre(): string {
  return page(
    "Lien indisponible",
    "<h1>Ce lien n'est plus disponible</h1>" +
      "<p>Il a peut-être expiré ou été retiré.</p>" +
      `<p>Si vous avez encore besoin de ces fichiers, écrivez-nous : <a href="mailto:${ADRESSE_CONTACT}">${ADRESSE_CONTACT}</a>.</p>`,
  );
}

/** Stockage injoignable : une panne de notre côté, dite comme telle [I18]. */
export function pageIndisponible(): string {
  return page(
    "Fichiers momentanément indisponibles",
    "<h1>Fichiers momentanément indisponibles</h1>" +
      "<p>Nous ne parvenons pas à les atteindre pour l'instant. Réessayez dans quelques minutes : votre lien reste valable.</p>" +
      `<p>Si le problème continue, écrivez-nous : <a href="mailto:${ADRESSE_CONTACT}">${ADRESSE_CONTACT}</a>.</p>`,
  );
}

/** Ce qu'on peut faire d'un fichier, vu de la page. */
export type EtatFichierPage = "pret" | "verification" | "plafond" | "indisponible";

export interface FichierPage {
  readonly id: string;
  readonly titre: string;
  readonly nature: "fichier" | "lien_externe";
  readonly nomFichier: string | null;
  readonly tailleOctets: number | null;
  readonly etat: EtatFichierPage;
}

export interface ContenuPageLien {
  /** Chemin de la page, sans domaine : `/api/partage/<id>/<jeton>`. */
  readonly chemin: string;
  readonly expireLe: Date;
  readonly rushs: boolean;
  readonly fichiers: ReadonlyArray<FichierPage>;
}

function ligneFichier(chemin: string, f: FichierPage): string {
  const details =
    f.nature === "fichier"
      ? [f.nomFichier, f.tailleOctets !== null ? tailleLisible(f.tailleOctets) : null]
          .filter((x): x is string => !!x)
          .join(" · ")
      : "Lien vers un service de partage";
  const action = (() => {
    switch (f.etat) {
      case "pret":
        return f.nature === "fichier"
          ? `<a class="bouton" href="${echapper(`${chemin}/${f.id}`)}" rel="nofollow" download>Télécharger</a>`
          : `<a class="bouton" href="${echapper(`${chemin}/${f.id}`)}" rel="nofollow noreferrer">Ouvrir le lien</a>`;
      case "verification":
        return '<p class="etat">En cours de vérification par notre antivirus : réessayez dans quelques minutes.</p>';
      case "plafond":
        return `<p class="etat">Ce fichier a atteint sa limite de téléchargements. Pour le télécharger à nouveau, écrivez-nous : <a href="mailto:${ADRESSE_CONTACT}">${ADRESSE_CONTACT}</a>.</p>`;
      case "indisponible":
        return '<p class="etat">Ce fichier n\'est plus disponible.</p>';
    }
  })();
  return (
    `<li><div class="titre">${echapper(f.titre)}</div>` +
    (details ? `<div class="details">${echapper(details)}</div>` : "") +
    `${action}</li>`
  );
}

/** La page d'un lien valide : un bouton par fichier. */
export function pageLien(c: ContenuPageLien): string {
  const n = c.fichiers.length;
  return page(
    "Vos fichiers",
    "<h1>Vos fichiers</h1>" +
      `<p>L'équipe Axion-IA ${n > 1 ? "vous a envoyé ces fichiers" : "vous a envoyé ce fichier"}. ` +
      `Ils sont disponibles jusqu'au <strong>${dateCourte(c.expireLe)}</strong>.</p>` +
      (c.rushs ? `<p class="mention">${MENTION_RUSHS}</p>` : "") +
      `<p class="muted">${PHRASE_SUIVI} Un gros fichier peut demander un moment : si le téléchargement s'interrompt, cliquez à nouveau sur le bouton.</p>` +
      `<ul>${c.fichiers.map((f) => ligneFichier(c.chemin, f)).join("")}</ul>`,
  );
}
