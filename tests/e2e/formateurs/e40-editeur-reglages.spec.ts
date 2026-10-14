// @formateurs E40 — L'éditeur de réglages général refuse les clés du chantier.
//
// Contrôle clé : un `admin` ne peut ni écrire ni effacer
// `formateurs.passage_paiement` / `formateurs.textes_valides` par l'éditeur
// général (même en changeant la casse) ; la direction non plus — ces clés ne
// se changent que par l'écran Interrupteurs ; et `relances_auto` ne s'allume
// pas sans `dossier_en_ligne`. Refus dans les trois cas, aucune ligne écrite,
// aucune ligne de journal au nom de l'administrateur.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { executerScenarioSecurite } from "../fixtures/formateurs/securite-execution";

const REFUS = "Ce réglage se change dans Formateurs freelance › Interrupteurs";

interface Observations {
  coupe: { ok: boolean };
  avant: Record<string, unknown>;
  ecritures: Record<string, { ok: boolean; error?: string }>;
  effacerDirection: Record<string, { ok: boolean; error?: string }>;
  relances: { ok: boolean; error?: string };
  apres: Record<string, unknown>;
  journalAdmin: number;
  ecritesParAdmin: number;
}

test.describe("@formateurs E40 — l'éditeur de réglages général", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  let o: Observations;

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    o = await executerScenarioSecurite<Observations>("e40-editeur-reglages", {});
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("écrire passage_paiement ou textes_valides : refusé, quelle que soit la casse", () => {
    const ecrire = Object.entries(o.ecritures).filter(([k]) => k.startsWith("ecrire "));
    expect(ecrire).toHaveLength(4);
    for (const [k, r] of ecrire) expect(r, k).toEqual({ ok: false, error: REFUS });
  });

  test("effacer : refusé à l'administrateur, et à la direction par cet écran", () => {
    const effacer = Object.entries(o.ecritures).filter(([k]) => k.startsWith("effacer "));
    expect(effacer).toHaveLength(4);
    for (const [k, r] of effacer) {
      expect(r, k).toEqual({ ok: false, error: "Suppression réservée au super-admin." });
    }
    for (const [k, r] of Object.entries(o.effacerDirection)) {
      expect(r, k).toEqual({ ok: false, error: REFUS });
    }
  });

  test("relances_auto sans dossier_en_ligne : allumage refusé", () => {
    expect(o.coupe.ok).toBe(true);
    expect(o.relances).toEqual({
      ok: false,
      error: "Allumage refusé : « Dossier en ligne » doit être allumé.",
    });
  });

  test("rien n'a été écrit ni journalisé", () => {
    expect(o.ecritesParAdmin).toBe(0);
    expect(o.journalAdmin).toBe(0);
    // Sous le verrou du banc, rien d'autre n'a bougé non plus.
    expect(o.apres["formateurs.relances_auto"]).toEqual(o.avant["formateurs.relances_auto"]);
  });
});
