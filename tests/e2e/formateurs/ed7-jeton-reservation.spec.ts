// @formateurs E-D7 (correction du 14/10) — Jeton de réservation réutilisé après
// la réservation : réponse neutre.
//
// Contrôle clé : avant la réservation, le jeton préremplit nom et e-mail
// (témoin) ; après, il rend exactement ce que rend un jeton faux ou échu —
// rien — y compris si le rendez-vous a été annulé depuis.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { executerScenarioSecurite } from "../fixtures/formateurs/securite-execution";

interface Observations {
  emailCandidat: string;
  avant: { nom: string; email: string } | null;
  apresReservation: unknown;
  apresAnnulation: unknown;
  altere: unknown;
  echu: unknown;
}

test.describe("@formateurs E-D7 — jeton de réservation après réservation", () => {
  test.setTimeout(180_000);

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("le jeton ne livre plus rien une fois l'échange réservé", async () => {
    const o = await executerScenarioSecurite<Observations>("ed7-jeton-reservation", {});
    expect(o.avant).toEqual({ nom: expect.stringContaining("Hortense"), email: o.emailCandidat });
    // Réponses neutres de référence.
    expect(o.altere).toBeNull();
    expect(o.echu).toBeNull();
    // Réutilisé : la même réponse que ces jetons-là.
    expect(o.apresReservation).toBeNull();
    expect(o.apresAnnulation).toBeNull();
  });
});
