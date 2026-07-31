/**
 * Harnais d'audit de page — audit de certification Qualiopi 2026-07-25.
 *
 * Une seule implémentation, appliquée à une LISTE de routes : c'est ce qui rend
 * l'audit des 166 routes publiques et des 249 routes admin tenable, et surtout
 * REJOUABLE avant chaque audit de surveillance.
 *
 * Détecte l'objectivable — erreurs console, requêtes en échec, violations
 * d'accessibilité bloquantes, textes qui ne devraient jamais atteindre un
 * utilisateur, débordement horizontal. Ne juge ni le sens ni la logique métier :
 * ça reste du travail humain.
 */

import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

/** Motifs qui ne doivent JAMAIS apparaître dans un rendu utilisateur. */
const INTERDITS: ReadonlyArray<readonly [string, RegExp]> = [
  ["undefined", /\bundefined\b/],
  ["NaN", /\bNaN\b/],
  ["Invalid Date", /Invalid Date/],
  ["[object Object]", /\[object Object\]/],
  ["token de gabarit", /\{\{[^}]{1,60}\}\}/],
  ["donnée de démo", /\[DEMO\]/],
  ["lorem ipsum", /lorem ipsum/i],
  ["TODO visible", /\bTODO\b/],
  // Audit F13 : plus aucune affirmation de certification tant que
  // QUALIOPI_CERTIFICATION_OBTENUE !== "true".
  ["revendication Qualiopi", /certifi[ée]\s+Qualiopi|certification qualité a été délivrée/i],
];

export interface ResultatAudit {
  url: string;
  statut: number | null;
  erreursConsole: string[];
  requetesEnEchec: string[];
  axeBloquant: { id: string; help: string; noeuds: number }[];
  textesInterdits: string[];
  debordementA: number[];
  msChargement: number;
}

export async function auditerPage(page: Page, url: string): Promise<ResultatAudit> {
  const erreursConsole: string[] = [];
  const requetesEnEchec: string[] = [];

  page.on("console", (m) => {
    if (m.type() === "error") erreursConsole.push(m.text().slice(0, 200));
  });
  page.on("requestfailed", (r) => {
    const t = r.failure()?.errorText ?? "";
    // ERR_ABORTED = navigation annulée, bruit d'instrumentation, pas un défaut.
    if (!t.includes("ERR_ABORTED")) requetesEnEchec.push(`${r.url().slice(0, 90)} — ${t}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400) requetesEnEchec.push(`${r.status()} ${r.url().slice(0, 90)}`);
  });

  const t0 = Date.now();
  const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
  const msChargement = Date.now() - t0;
  await page.waitForTimeout(400); // laisse l'hydratation émettre ses avertissements

  const corps = (
    await page
      .locator("body")
      .innerText()
      .catch(() => "")
  ).slice(0, 200_000);
  const textesInterdits = INTERDITS.filter(([, re]) => re.test(corps)).map(([label]) => label);

  const debordementA: number[] = [];
  for (const w of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(150);
    const deborde = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    if (deborde) debordementA.push(w);
  }
  await page.setViewportSize({ width: 1440, height: 900 });

  let axeBloquant: ResultatAudit["axeBloquant"] = [];
  try {
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
    axeBloquant = axe.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => ({ id: v.id, help: v.help, noeuds: v.nodes.length }));
  } catch {
    // axe peut échouer sur une page en erreur : on ne masque pas le reste.
  }

  return {
    url,
    statut: resp?.status() ?? null,
    erreursConsole,
    requetesEnEchec,
    axeBloquant,
    textesInterdits,
    debordementA,
    msChargement,
  };
}

/** Vrai si la page coche toute la grille §8 du prompt d'audit. */
export function estParfaite(r: ResultatAudit): boolean {
  return (
    r.statut === 200 &&
    r.erreursConsole.length === 0 &&
    r.requetesEnEchec.length === 0 &&
    r.axeBloquant.length === 0 &&
    r.textesInterdits.length === 0 &&
    r.debordementA.length === 0
  );
}
