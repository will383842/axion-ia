/**
 * CLIQUET — `'unsafe-eval'` ne doit JAMAIS atteindre la production.
 *
 * L'exemption ajoutée le 2026-08-21 rend la console admin utilisable sous
 * `next dev` (webpack livre les modules clients dans des `eval()`, que la CSP
 * stricte bloquait — React n'hydratait donc jamais l'admin en local).
 *
 * 🔑 Une exemption de développement est exactement le genre de chose qui part
 * en production sans que personne s'en aperçoive : elle n'a aucun symptôme, elle
 * ne fait que retirer une protection. Ce test est la seule chose qui l'empêche.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCspHeader } from "../csp";

const NONCE = "aaaaaaaaaaaaaaaaaaaaaaaa";

afterEach(() => {
  vi.unstubAllEnvs();
});

function sous(env: string, options: { strict: boolean; embed?: boolean }): string {
  // `vi.stubEnv` plutôt qu'une écriture directe : `process.env` refuse un
  // descripteur non énumérable, et Vitest restaure la valeur d'origine.
  vi.stubEnv("NODE_ENV", env);
  return buildCspHeader({ nonce: NONCE, ...options });
}

describe("CSP — l'exemption eval reste hors production", () => {
  it("la CSP admin de production n'autorise pas unsafe-eval", () => {
    expect(sous("production", { strict: true })).not.toContain("'unsafe-eval'");
  });

  it("la CSP admin de développement l'autorise, sinon l'admin n'hydrate pas", () => {
    // Contre-témoin : sans cette assertion, retirer l'exemption laisserait le
    // test ci-dessus vert tout en recassant la console admin en local — le
    // défaut d'origine, revenu par la porte de derrière.
    expect(sous("development", { strict: true })).toContain("'unsafe-eval'");
  });

  it("la CSP admin de production garde son nonce et strict-dynamic", () => {
    const csp = sous("production", { strict: true });
    expect(csp).toContain(`'nonce-${NONCE}'`);
    expect(csp).toContain("'strict-dynamic'");
  });

  it("aucune variante du mode strict ne fait fuiter unsafe-eval en production", () => {
    // ⚠️ Le mode SOUPLE (site public SSG) porte `'unsafe-eval'` en production
    // par choix assumé et documenté dans `csp.ts` — l'y interdire ferait rougir
    // ce test sur un arbitrage, pas sur un défaut. On ne balaie donc que le mode
    // strict, seul périmètre où l'exemption de développement s'ajoute.
    for (const options of [{ strict: true }, { strict: true, embed: true }]) {
      expect(sous("production", options), `mode ${JSON.stringify(options)}`).not.toContain(
        "'unsafe-eval'",
      );
    }
  });
});
