/**
 * CLIQUET — toute suite qui OUVRE UNE SESSION ADMIN déclare son budget.
 *
 * 🔴 2026-08-21. `tests/e2e/qualiopi/vente-parcours.spec.ts` tournait avec le
 * budget par défaut de `playwright.config.ts` — 30 s — alors qu'elle ouvre une
 * session admin puis traverse un wizard en trois étapes.
 *
 * Elle échouait sur :
 *
 *     loginAsAdmin a échoué pour admin@axion-ia.com — URL atteinte : …/login
 *     Texte de la page :
 *
 * 🔑 LE TEXTE ÉTAIT VIDE. La page de connexion n'avait pas fini de rendre : ce
 * n'est pas le produit qui refusait, c'est le budget qui manquait. Ses sœurs
 * déclaraient toutes le leur (90 s à 600 s) ; celle-ci avait été oubliée, et
 * rien ne pouvait le dire.
 *
 * La vérification de mot de passe est délibérément coûteuse (Argon2id), et
 * quatre workers se la disputent en CI. 30 s ne suffisent pas — jamais.
 *
 * ⚠️ Ce test est STATIQUE : il lit les fichiers de specs. Un test dynamique
 * n'aurait rien vu — le budget par défaut ne produit d'erreur que sous charge.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(process.cwd(), "tests", "e2e");

/** Budget minimal, en millisecondes, pour une suite qui se connecte. */
const PLANCHER = 90_000;

function specs(dossier: string): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) trouves.push(...specs(chemin));
    else if (entree.endsWith(".spec.ts")) trouves.push(chemin);
  }
  return trouves;
}

/** Budget déclaré par un fichier, ou `null` s'il n'en déclare aucun. */
function budgetDeclare(source: string): number | null {
  const m = /describe\.configure\(\{[^}]*timeout:\s*([0-9_]+)/.exec(source);
  return m?.[1] ? Number(m[1].replace(/_/g, "")) : null;
}

describe("les specs qui ouvrent une session admin déclarent leur budget", () => {
  const concernees = specs(RACINE)
    .map((chemin) => ({ chemin, source: readFileSync(chemin, "utf8") }))
    .filter(({ source }) => /\bloginAsAdmin\s*\(/.test(source));

  it("il y a bien des specs concernées", () => {
    // Contre-témoin : si `loginAsAdmin` était renommée, la liste se viderait et
    // les deux tests suivants passeraient au vert sans rien garder.
    expect(
      concernees.length,
      "aucune spec n'appelle `loginAsAdmin` — le cliquet ne garde plus rien",
    ).toBeGreaterThanOrEqual(4);
  });

  it("chacune déclare un budget", () => {
    const sans = concernees
      .filter(({ source }) => budgetDeclare(source) === null)
      .map(({ chemin }) => chemin.replace(process.cwd(), "").replace(/\\/g, "/"));
    expect(
      sans,
      "le défaut de `playwright.config.ts` est de 30 s ; la seule vérification " +
        "du mot de passe peut les consommer sous quatre workers",
    ).toEqual([]);
  });

  it("aucun budget déclaré n'est sous le plancher", () => {
    const trop = concernees
      .map(({ chemin, source }) => ({ chemin, budget: budgetDeclare(source) }))
      .filter((e) => e.budget !== null && e.budget < PLANCHER)
      .map((e) => `${e.chemin.replace(process.cwd(), "").replace(/\\/g, "/")} = ${e.budget} ms`);
    expect(trop, `plancher : ${PLANCHER} ms`).toEqual([]);
  });
});
