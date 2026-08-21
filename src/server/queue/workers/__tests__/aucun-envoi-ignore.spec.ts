/**
 * 🔴 `D5-1-C2` — aucun envoi du cron ne voit sa réponse jetée.
 *
 * ## Le défaut d'origine, et sa dernière trace
 *
 * `enqueueEmail` NE LÈVE PAS quand l'envoi échoue : elle RETOURNE
 * `{ enqueued: false }`. Six fonctions d'envoi rendaient `Promise<void>` ; les
 * crons posaient donc la date d'envoi dès que l'appel ne levait pas,
 * c'est-à-dire toujours. C'est la reconstitution littérale de l'incident
 * « aucune convocation jamais envoyée en production ». Corrigé le 2026-08-20 :
 * les six rendent un booléen, et leurs six appels le lisent.
 *
 * `envoyerConvocation` était restée en dehors — parce que SA trace était déjà
 * juste : elle écrit `convocationEnvoyeeAt` elle-même, et seulement en cas de
 * succès. Les données étaient donc saines.
 *
 * ⚠️ Mais son appelant jetait la réponse et incrémentait `ok++` quoi qu'il
 * arrive. Le journal annonçait « N convocation(s) envoyée(s) » en comptant
 * celles qui n'étaient pas parties — et c'est cette ligne qu'un opérateur lit le
 * matin pour décider qu'il n'y a rien à faire.
 *
 * 🔑 Un compte-rendu faux n'est pas une donnée fausse, mais il produit la même
 * inaction. « Traiter le cas sans regarder la classe » : la famille avait été
 * corrigée à six sur sept.
 *
 * ## Ce que ce fichier garde
 *
 * Que plus aucun appel d'envoi ne soit une instruction NUE. Il ne dit pas quoi
 * faire de la réponse — compter, journaliser, reprendre —, il exige seulement
 * qu'elle soit LUE.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE = readFileSync(
  join(process.cwd(), "src", "server", "queue", "workers", "qualiopi-formation-crons-worker.ts"),
  "utf-8",
)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("`D5-1-C2` — le cron lit toujours la réponse d'un envoi", () => {
  it("le témoin : le fichier contient bien des appels d'envoi", () => {
    // 🔑 Sans lui, un renommage viderait la recherche et le test suivant
    // passerait au vert en ne vérifiant plus rien.
    expect([...SOURCE.matchAll(/await envoyer[A-Z]\w*\(/g)].length).toBeGreaterThanOrEqual(6);
  });

  it("🔴 aucun appel d'envoi n'est une instruction nue", () => {
    // Une instruction nue est un `await envoyerX(...)` en début d'expression :
    // la réponse n'est ni testée, ni affectée, ni retournée.
    const nus = SOURCE.split("\n")
      .map((l, i) => [l.trim(), i + 1] as const)
      .filter(([l]) => /^await envoyer[A-Z]\w*\(/.test(l));

    expect(
      nus.map(([l, n]) => `${n}: ${l}`),
      "la réponse est jetée : le cron comptera comme envoyé ce qui ne l'est pas",
    ).toEqual([]);
  });

  it("🔴 la convocation, en particulier, est lue", () => {
    // C'est elle qui a donné son nom à l'incident, et elle a été la dernière à
    // rejoindre le contrat de ses sœurs.
    expect(SOURCE).toMatch(/if \(await envoyerConvocation\(/);
  });
});
