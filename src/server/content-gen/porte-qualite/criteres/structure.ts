/** B11a, B11b, B11c : structure des titres (déterministe, sans modèle). */

import { compterMots, nettoyer, texteDe, titres } from "../html";
import type { ContenuPorte, ResultatBrut } from "../types";
import type { ReglagesPorte } from "../reglages";

const OK: ResultatBrut = { statut: "ok", raison: null, preuves: [] };
const echec = (raison: string, preuves: string[] = []): ResultatBrut => ({
  statut: "echec",
  raison,
  preuves,
});

/** B11a : exactement un H1. */
export function evaluerB11a(c: ContenuPorte): ResultatBrut {
  const n = titres(nettoyer(c.corpsHtml)).filter((t) => t.niveau === 1).length;
  if (n === 1) return OK;
  return echec(
    n === 0
      ? "La page n'a aucun titre principal (H1)."
      : `La page a ${n} titres principaux (H1) : un seul est permis.`,
  );
}

/** B11b : on ne descend jamais de plus d'un niveau à la fois (h2 → h4 refusé, h4 → h2 permis). */
export function evaluerB11b(c: ContenuPorte): ResultatBrut {
  let precedent = 0;
  for (const t of titres(nettoyer(c.corpsHtml))) {
    if (t.niveau > precedent + 1) {
      const depuis = precedent === 0 ? "le début de la page" : `h${precedent}`;
      return echec(`Saut de niveau de titre : h${t.niveau} placé juste après ${depuis}.`, [
        `« ${t.texte.slice(0, 80)} »`,
      ]);
    }
    precedent = t.niveau;
  }
  return OK;
}

const BLOC = /<(p|ul|ol|dl|table|blockquote|figure|img|pre)\b/i;

/**
 * B11c : le premier bloc sous le H1 (avant tout autre titre) est un paragraphe d'au
 * moins `motsMinReponseSousH1` mots, qui se termine dans les `fenetreReponseMots`
 * premiers mots de la page. Que cette réponse réponde vraiment à la question
 * n'est pas mesurable ici : c'est le rôle de B16.
 */
export function evaluerB11c(c: ContenuPorte, r: ReglagesPorte): ResultatBrut {
  const html = nettoyer(c.corpsHtml);
  const ts = titres(html);
  const h1 = ts.find((t) => t.niveau === 1);
  if (!h1) return echec("Pas de H1 : impossible de chercher la réponse directe juste en dessous.");
  const suivant = ts.find((t) => t.debut >= h1.fin);
  const segment = html.slice(h1.fin, suivant ? suivant.debut : html.length);
  const premier = BLOC.exec(segment);
  if (!premier) return echec("Aucun paragraphe de réponse sous le H1.");
  if (premier[1]!.toLowerCase() !== "p") {
    return echec(
      `Le premier bloc sous le H1 est « ${premier[1]!.toLowerCase()} », pas un paragraphe de réponse.`,
    );
  }
  const p = /<p\b[^>]*>([\s\S]*?)<\/p\s*>/i.exec(segment.slice(premier.index));
  if (!p) return echec("Le paragraphe sous le H1 n'est pas fermé.");
  const mots = compterMots(texteDe(p[1] ?? ""));
  if (mots < r.motsMinReponseSousH1) {
    return echec(
      `La réponse sous le H1 est trop courte (${mots} mots, ${r.motsMinReponseSousH1} au moins).`,
    );
  }
  const finP = h1.fin + premier.index + p.index! + p[0].length;
  const motsAvantFin = compterMots(texteDe(html.slice(0, finP)));
  if (motsAvantFin > r.fenetreReponseMots) {
    return echec(
      `La réponse finit au mot ${motsAvantFin}, après les ${r.fenetreReponseMots} premiers mots.`,
    );
  }
  return OK;
}
