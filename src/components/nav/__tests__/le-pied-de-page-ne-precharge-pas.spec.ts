/**
 * LE PIED DE PAGE NE PRÉCHARGE PAS CE QUE L'EN-TÊTE PRÉCHARGE DÉJÀ.
 *
 * ── Pourquoi ce fichier ──────────────────────────────────────────────────
 * Mesuré le 2026-09-24 sur le HTML servi par `/fr` : `/fr/contact` y figure
 * **5 fois**, `/fr/tarifs` et `/fr/audit` **4 fois** — menu bureau, menu
 * mobile, pied de page, corps de page. Chaque occurrence déclenche son propre
 * préchargement RSC.
 *
 * Relevé au navigateur sur DEUX chargements distincts : chaque URL était
 * demandée deux fois, et la seconde répondait **503**, sans exception. Une
 * cinquantaine de requêtes perdues par visite.
 *
 * ⚠️ CE QUE CE FICHIER NE PRÉTEND PAS. Il ne garde pas « le 503 est réparé » :
 *    la cause du 503 n'est pas identifiée (non reproductible en ligne de
 *    commande, et les journaux d'accès du proxy sont désactivés). Il garde la
 *    seule chose qu'on ait mesurée et corrigée : le pied de page ne relance
 *    plus un préchargement que l'en-tête a déjà lancé.
 *
 * 🔑 L'en-tête, lui, DOIT garder son préchargement — c'est par là qu'on
 *    navigue. Une garde qui interdirait `prefetch` partout aurait l'air plus
 *    stricte et rendrait le site plus lent.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const FOOTER = path.join(process.cwd(), "src/components/nav/Footer.tsx");
const source = readFileSync(FOOTER, "utf8");

/** Le corps de `FooterLinkList`, qui rend la trentaine de liens du pied. */
function listeDuPiedDePage(): string {
  const debut = source.indexOf("function FooterLinkList");
  expect(debut, "FooterLinkList a été renommé ou déplacé").toBeGreaterThan(-1);
  const fin = source.indexOf("\n}", debut);
  expect(fin, "la fin de FooterLinkList est introuvable").toBeGreaterThan(debut);
  const corps = source.slice(debut, fin);

  // 🔴 LES COMMENTAIRES SONT RETIRES, ET C'EST LE POINT DU FICHIER.
  //    Premiere redaction : on cherchait `prefetch={false}` dans le corps brut.
  //    Le commentaire qui EXPLIQUE le correctif contient ces mots-la, si bien
  //    que la garde restait verte apres avoir retire l'attribut du `<Link>` —
  //    mutation jouee, zero rouge. Elle mesurait la prose, pas le code.
  return corps.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

describe("préchargement du pied de page", () => {
  it("🔑 CONTRE-TÉMOIN : on lit bien un composant qui rend des liens", () => {
    // Sans ceci, un renommage rendrait la garde suivante verte en ne
    // regardant rien du tout.
    const liste = listeDuPiedDePage();
    expect(liste).toContain("<Link");
    expect(liste).toContain("items.map");
  });

  it("🔴 les liens du pied de page portent prefetch={false}", () => {
    expect(listeDuPiedDePage()).toContain("prefetch={false}");
  });
});
