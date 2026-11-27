/**
 * B08 (réponse directe) et B11 (complétude). B11 reprend les règles de
 * `data-quality-gate.ts` côté porte seulement : point clé et sources externes,
 * rendus bloquants. Volontairement SANS la règle FAQ (W07, avertissement) et SANS
 * `expertQuote` (une IA qui doit la produire invente un expert : faux témoignage).
 * La réponse directe de data-quality-gate est portée par B08.
 */

import { TYPES_PLANCHER_MOTS } from "../../quality/barrieres-publication";
import { compterMots, estExterne, liens, nettoyer, texteDe, titres } from "../html";
import type { ContenuPorte, ContextePorte, ResultatBrut } from "../types";
import type { ReglagesPorte } from "../reglages";

const OK: ResultatBrut = { statut: "ok", raison: null, preuves: [] };

export function evaluerB08(c: ContenuPorte, r: ReglagesPorte): ResultatBrut {
  const n = c.directAnswer ? compterMots(c.directAnswer) : 0;
  if (n >= r.motsMinReponseDirecte && n <= r.motsMaxReponseDirecte) return OK;
  return {
    statut: "echec",
    raison:
      n === 0
        ? "Aucune réponse directe en tête."
        : `La réponse directe fait ${n} mots : il en faut de ${r.motsMinReponseDirecte} à ${r.motsMaxReponseDirecte}.`,
    preuves: [`${n} mots`],
  };
}

export function evaluerB11(c: ContenuPorte, x: ContextePorte, r: ReglagesPorte): ResultatBrut {
  const html = nettoyer(c.corpsHtml);
  const mots = compterMots(texteDe(html));
  const raisons: string[] = [];
  const preuves: string[] = [`${mots} mots`];

  const articleLong = TYPES_PLANCHER_MOTS.has(c.contentType);
  const plancher = articleLong ? r.motsMinArticleLong : r.motsMinPageMince;
  if (mots < plancher) {
    raisons.push(
      articleLong
        ? `Article trop court : ${mots} mots, ${plancher} au moins.`
        : `Page trop mince : ${mots} mots, ${plancher} au moins.`,
    );
  }

  const h2 = titres(html).filter((t) => t.niveau === 2).length;
  preuves.push(`${h2} H2`);
  if (h2 < r.h2Min || h2 > r.h2Max) {
    raisons.push(`Il faut de ${r.h2Min} à ${r.h2Max} titres H2 (il y en a ${h2}).`);
  }

  const externes = new Set(
    liens(html)
      .map((l) => l.href)
      .filter((h) => estExterne(h, x.hotesInternes)),
  ).size;
  preuves.push(`${externes} source(s) externe(s)`);
  if (externes < r.citationsMin) {
    raisons.push(`Sources externes insuffisantes : ${externes} sur ${r.citationsMin}.`);
  }

  if (c.contentType !== "blog_from_rss") {
    const kt = c.keyTakeaway ? compterMots(c.keyTakeaway) : 0;
    if (kt < r.motsMinPointCle)
      raisons.push(`Point clé absent ou de moins de ${r.motsMinPointCle} mots.`);
  }

  return raisons.length === 0
    ? { ...OK, preuves }
    : { statut: "echec", raison: raisons.join(" "), preuves };
}
