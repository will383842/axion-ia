/**
 * CLIQUET — Playwright doit BORNER ses actions et ses navigations.
 *
 * 🔴 2026-08-22 — CAUSE RACINE DE TOUTE UNE FAMILLE DE FAUX DIAGNOSTICS.
 *
 * `actionTimeout` et `navigationTimeout` non déclarés ne valent PAS « une
 * limite par défaut raisonnable » : ils valent **0**, c'est-à-dire *aucune
 * limite*. Chacun des ~70 `page.goto()` du dossier pouvait donc consommer le
 * budget entier de son test avant de rendre « Test timeout of Nms exceeded ».
 *
 * Ce message ne nomme ni l'URL, ni l'étape, ni la cause. Trois rouges distincts
 * de la session du 2026-08-21 ont été lus à tort à cause de lui :
 *
 *   · parcours 6 — une attente réseau consommait 300 s puis ne disait rien ;
 *   · `/fr/implantations` — 8,7 Mo, 62 s d'analyse axe, présenté comme un délai ;
 *   · `vente-parcours` — message d'échec au texte VIDE, faute de budget.
 *
 * 🔑 Une borne posée à la SOURCE fait dire à l'échec quelle ACTION n'a pas
 * abouti, au lieu du test qui l'englobe. C'est la même leçon que le texte de
 * l'écran dans `loginAsAdmin` : un délai dépassé ne dit pas pourquoi.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CONFIG = readFileSync(join(process.cwd(), "playwright.config.ts"), "utf8");

/** Valeur déclarée pour une clé de `use:`, ou `null` si absente. */
function borne(cle: string): number | null {
  const m = new RegExp(`${cle}:\\s*([0-9_]+)`).exec(CONFIG);
  return m?.[1] ? Number(m[1].replace(/_/g, "")) : null;
}

describe("playwright.config.ts borne ses attentes", () => {
  for (const cle of ["actionTimeout", "navigationTimeout"] as const) {
    it(`déclare \`${cle}\``, () => {
      expect(
        borne(cle),
        `\`${cle}\` non déclaré vaut 0 — soit AUCUNE limite. L'action hérite ` +
          "alors du budget entier du test et l'échec ne nomme plus ce qui a échoué.",
      ).not.toBeNull();
    });

    it(`\`${cle}\` reste sous le budget de suite le plus court`, () => {
      // Contre-témoin : une borne plus large que le budget du test la rendrait
      // inopérante — on retomberait exactement sur le défaut d'origine.
      const v = borne(cle) ?? Number.POSITIVE_INFINITY;
      expect(
        v,
        "une borne d'action doit expirer AVANT le test qui la contient, sinon " +
          "c'est le test qui rend le verdict et le message redevient muet",
      ).toBeLessThan(90_000);
    });
  }

  it("le budget global de suite reste déclaré", () => {
    // Sans lui, les bornes ci-dessus n'auraient rien à protéger.
    expect(CONFIG).toMatch(/timeout:\s*30_000/);
  });
});
