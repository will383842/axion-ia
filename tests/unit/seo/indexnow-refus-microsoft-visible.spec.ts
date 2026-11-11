/**
 * Tests — le refus de Microsoft par IndexNow se VOIT (audit GEO du 2026-11-11).
 *
 * `api.indexnow.org` renvoie 403 pour ce domaine ; la cascade bascule sur Yandex et le
 * lot passait « OK » en silence. Le cron émet désormais une annotation `::warning::`,
 * sans échouer (il est indépendant du déploiement).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ENDPOINT_MICROSOFT, alerteRefusMicrosoft } from "../../../scripts/daily-indexnow-resubmit";

const ROOT = path.resolve(__dirname, "../../..");

describe("alerteRefusMicrosoft", () => {
  it("Microsoft accepte : aucune alerte", () => {
    expect(
      alerteRefusMicrosoft(
        { accepted: ENDPOINT_MICROSOFT, attempts: [`${ENDPOINT_MICROSOFT} → 200 OK`] },
        12,
        true,
      ),
    ).toBeNull();
  });

  it("Microsoft refuse, Yandex accepte : annotation ::warning:: qui nomme le 403", () => {
    const alerte = alerteRefusMicrosoft(
      {
        accepted: "https://yandex.com/indexnow",
        attempts: [
          `${ENDPOINT_MICROSOFT} → 403 Forbidden UserForbiddedToAccessSite`,
          "https://yandex.com/indexnow → 202 OK",
        ],
      },
      12,
      true,
    );
    expect(alerte).toMatch(/^::warning title=IndexNow Microsoft refuse::/);
    expect(alerte).toContain("403");
    expect(alerte).toContain("repli accepté par https://yandex.com/indexnow");
  });

  it("hors GitHub Actions : message lisible, sans syntaxe d'annotation", () => {
    const alerte = alerteRefusMicrosoft(
      { accepted: null, attempts: [`${ENDPOINT_MICROSOFT} → 403 Forbidden`] },
      3,
      false,
    );
    expect(alerte).not.toMatch(/^::/);
    expect(alerte).toContain("aucun repli n'a accepté");
  });

  it("l'endpoint surveillé est bien le premier de la cascade de src/lib/indexnow.ts", () => {
    const lib = readFileSync(path.join(ROOT, "src/lib/indexnow.ts"), "utf8");
    const premier = lib.match(/const ENDPOINTS = \[\s*"([^"]+)"/)?.[1];
    expect(premier).toBe(ENDPOINT_MICROSOFT);
  });
});

describe("workflow daily-indexnow-resubmit", () => {
  const wf = readFileSync(path.join(ROOT, ".github/workflows/daily-indexnow-resubmit.yml"), "utf8");

  it("ne référence aucun secret autre qu'INDEXNOW_KEY", () => {
    const secrets = [...wf.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((m) => m[1]);
    expect(new Set(secrets)).toEqual(new Set(["INDEXNOW_KEY"]));
  });

  it("documente l'annotation du refus Microsoft", () => {
    expect(wf).toMatch(/IndexNow Microsoft refuse/);
  });
});
