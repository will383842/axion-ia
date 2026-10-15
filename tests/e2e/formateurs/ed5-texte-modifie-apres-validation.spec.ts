// @formateurs E-D5 (correction du 14/10) — Un texte modifié après sa validation
// n'est plus envoyé.
//
// Contrôle clé : validé par la console, le texte part (témoin) ; une fois son
// empreinte périmée (état que laisse une mise en ligne qui change le texte),
// l'enfilage le refuse ET un e-mail déjà en file est retenu au départ, ligne
// close en « cancelled ». Deux textes : un gabarit entier (F20) et une
// variante validée à part (F30 « lettre non signée »).
//
// Défaut V1-D-3 (corrigé, lot 4) — au DÉPART, la variante est relue.

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
  temoins: { entier: boolean; variante: boolean };
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

  test("témoin : validés, le gabarit et la variante peuvent partir", () => {
    expect(o.temoins).toEqual({ entier: true, variante: true });
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

  // V1-D-3 — corrigé (lot 4). La relecture au départ relit aussi la validation de la
  // VARIANTE que porte le job (son étape), comme l'enfilage : une variante changée depuis
  // sa validation est retenue, ligne close en « cancelled ».
  test("V1-D-3 — déjà en file : la variante modifiée est retenue au départ", () => {
    expect(o.auDepart.variante?.status).toBe("cancelled");
  });
});
