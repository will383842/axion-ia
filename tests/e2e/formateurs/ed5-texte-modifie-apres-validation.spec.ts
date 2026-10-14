// @formateurs E-D5 (correction du 14/10) — Un texte modifié après sa validation
// n'est plus envoyé.
//
// Contrôle clé : validé par la console, le texte part (témoin) ; une fois son
// empreinte périmée (état que laisse une mise en ligne qui change le texte),
// l'enfilage le refuse ET un e-mail déjà en file est retenu au départ, ligne
// close en « cancelled ». Deux textes : un gabarit entier (F20) et une
// variante validée à part (F30 « lettre non signée »).
//
// Défaut consigné : V1-D-3 — au DÉPART, la variante n'est pas relue.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { viderPuitsPour } from "../fixtures/formateurs/puits-smtp";
import { executerScenarioSecurite } from "../fixtures/formateurs/securite-execution";

interface Ligne {
  status: string;
  error: string | null;
}
interface Observations {
  adresse: string;
  temoins: { entier: string; variante: string };
  fileEntier: { r: { enqueued: boolean }; id: string | null };
  fileVariante: { r: { enqueued: boolean }; id: string | null };
  apresModification: { entier: string; variante: string };
  auDepart: { entier: Ligne | null; variante: Ligne | null };
}

test.describe("@formateurs E-D5 — texte modifié après validation", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  let o: Observations;

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    o = await executerScenarioSecurite<Observations>("ed5-texte-modifie", {});
  });

  test.afterAll(async () => {
    if (o) await viderPuitsPour(o.adresse);
    await prisma.$disconnect();
  });

  test("témoin : validés, le gabarit et la variante partent", () => {
    expect(o.temoins).toEqual({ entier: "envoye", variante: "envoye" });
    expect(o.fileEntier.r.enqueued).toBe(true);
    expect(o.fileVariante.r.enqueued).toBe(true);
  });

  test("modifiés : l'enfilage refuse le gabarit et la variante", () => {
    expect(o.apresModification).toEqual({
      entier: "texte-non-valide",
      variante: "texte-non-valide",
    });
  });

  test("déjà en file : le gabarit modifié est retenu au départ", () => {
    expect(o.auDepart.entier).toEqual({
      status: "cancelled",
      error: "Retenu à l'envoi : texte de cet e-mail non validé",
    });
  });

  // V1-D-3 — gravité faible. Un e-mail déjà en file dont la VARIANTE a changé
  // depuis sa validation part quand même : la relecture au départ ne relit que
  // la validation du gabarit, pas celle de la variante.
  // Probable : src/server/email/relecture-au-depart.ts ~l. 103-104
  // (`estTexteValide(…, gabarit)` sans la variante du payload).
  test.fixme("V1-D-3 — déjà en file : la variante modifiée est retenue au départ", () => {
    expect(o.auDepart.variante?.status).toBe("cancelled");
  });
});
