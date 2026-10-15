// @formateurs V2-S06 (vérification n° 2, sécurité) — Fausse réservation par la
// route publique `client-event`.
//
// Un script poste une « réservation » d'échange formateur au nom d'un candidat
// réel (son adresse, le marqueur de sa candidature, le type « échange »). La
// ligne naît (la route est publique par conception, garde d'origine forgeable :
// ÉCART connu, écrit dans la route), mais elle n'est rattachée à rien, ne
// consomme pas le lien de réservation du candidat, ne fait partir aucun e-mail,
// et la réponse ne renvoie rien de personnel.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { RESSEMBLE_A_UN_EMAIL, scenarioV2 } from "../fixtures/formateurs/v2s-commun";

interface Http {
  statut: number;
  corps: string;
}
interface Observations {
  sansOrigine: Http;
  autreOrigine: Http;
  forgee: Http;
  email: string;
  lignes: Array<{ rattachee: boolean; statut: string }>;
  avant: boolean;
  apres: boolean;
  emails: number;
}

test.describe("@formateurs V2-S06 — fausse réservation par la route publique", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  let o: Observations;

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    o = await scenarioV2<Observations>("v2s06-fausse-reservation");
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("garde d'origine : sans Origin ou d'ailleurs, 403", () => {
    const refus = { statut: 403, corps: '{"error":"cross_origin_forbidden"}' };
    expect(o.sansOrigine).toEqual(refus);
    expect(o.autreOrigine).toEqual(refus);
  });

  test("ÉCART constaté : un Origin forgé passe, la ligne naît (route publique)", () => {
    expect(o.forgee.statut).toBe(200);
    expect(o.lignes).toHaveLength(1);
  });

  test("la ligne forgée n'est rattachée à aucune candidature", () => {
    expect(o.lignes.every((l) => !l.rattachee)).toBe(true);
  });

  test("le lien de réservation du candidat n'est pas consommé", () => {
    expect(o.avant).toBe(true);
    expect(o.apres).toBe(true);
  });

  test("aucun e-mail vers le candidat, rien de personnel dans la réponse", () => {
    expect(o.emails).toBe(0);
    for (const h of [o.sansOrigine, o.autreOrigine, o.forgee]) {
      expect(h.corps).not.toContain(o.email);
      expect(h.corps).not.toMatch(RESSEMBLE_A_UN_EMAIL);
      expect(h.corps).not.toContain("Hortense");
    }
  });
});
