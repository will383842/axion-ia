// @formateurs V2-S10 (vérification n° 2, sécurité) — Redirection ouverte par `suite`.
//
// La vraie route de connexion, un lien neuf par essai : aucune variante hostile
// de `suite` ne sort du site ni de l'espace formateur ; elle retombe sur
// l'accueil de l'espace. Témoins : deux chemins de la liste blanche sont suivis.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { scenarioV2 } from "../fixtures/formateurs/v2s-commun";

const UUID = "0b6f0d55-6c1d-4d0e-9f73-0d2a1b7c3e44";
const ESPACE = "/fr/espace-formateur";

const VARIANTES = [
  "https://evil.example",
  "//evil.example",
  "/\\evil.example",
  "\\/evil.example",
  "/%2F%2Fevil.example",
  "%2F%2Fevil.example",
  "https:evil.example",
  "javascript:alert(1)",
  ` ${ESPACE}`,
  `${ESPACE}\n//evil.example`,
  `${ESPACE}\r\nLocation: https://evil.example`,
  `${ESPACE}\t`,
  `${ESPACE}/../../fr/admin`,
  `${ESPACE}/./sessions`,
  `${ESPACE}//evil.example`,
  `${ESPACE}@evil.example`,
  `${ESPACE}.evil.example`,
  `${ESPACE}/sessions/${UUID.toUpperCase()}`,
  `${ESPACE}/sessions/${UUID}/../../../x`,
  `${ESPACE}/sessions/${UUID}?x=https://evil.example`,
  `${ESPACE}?lettre=${UUID}&suite=//evil.example`,
  `${ESPACE}?lettre=${UUID}#@evil.example`,
  `/FR/ESPACE-FORMATEUR`,
  `/en/espace-formateur`,
  `${ESPACE}／／evil.example`,
  `${ESPACE}/remuneration${"a".repeat(300)}`,
];
const TEMOINS = [`${ESPACE}/remuneration`, `${ESPACE}?lettre=${UUID}`];

interface Suivi {
  suite: string;
  statut: number;
  location: string | null;
}

test.describe("@formateurs V2-S10 — aucune redirection ouverte par `suite`", () => {
  test.setTimeout(240_000);

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("chaque variante hostile retombe sur l'accueil de l'espace ; les témoins sont suivis", async () => {
    const o = await scenarioV2<{ variantes: Suivi[]; temoins: Suivi[] }>(
      "v2s10-suite-redirection",
      { variantes: VARIANTES, temoins: TEMOINS },
    );
    expect(o.variantes).toHaveLength(VARIANTES.length);
    for (const v of o.variantes) {
      expect.soft(v.statut, JSON.stringify(v.suite)).toBe(307);
      expect.soft(v.location, JSON.stringify(v.suite)).toBe(`https://axion-ia.com${ESPACE}`);
    }
    expect(o.temoins.map((t) => t.location)).toEqual(
      TEMOINS.map((t) => `https://axion-ia.com${t}`),
    );
  });
});
