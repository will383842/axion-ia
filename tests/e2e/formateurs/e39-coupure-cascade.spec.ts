// @formateurs E39 — Coupure en cascade : `dossier_en_ligne` coupé avec des F9
// en file ; `echange_ouvert` coupé avec des F2 dus — aucun F9 ni F2 ne part.
//
// Tout est allumé PUIS coupé par la console. Témoins : avant la coupure, un F9
// et un F2 partent réellement par la file jusqu'au puits ; le passage des
// campagnes compte ses deux campagnes actives. Après : les filles sont coupées
// dans la même opération (une ligne de journal chacune, avec sa mère), les
// e-mails déjà en file sont retenus au départ, et le passage n'a plus aucune
// campagne active.
//
// ÉCART consigné (le code de main fait foi) : la tuile « relances suspendues »
// du plan n'existe pas dans le code de main (ni dans « À faire maintenant »,
// ni ailleurs dans la console). La suspension se lit aujourd'hui sur l'écran
// Interrupteurs et au journal — c'est ce que le test constate.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { viderPuitsPour } from "../fixtures/formateurs/puits-smtp";
import { executerScenarioSecurite } from "../fixtures/formateurs/securite-execution";

interface Ligne {
  template: string;
  status: string;
  error: string | null;
}
interface Passage {
  horsFenetre: boolean;
  campagnesActives: number;
  envoyes: number;
}
interface Observations {
  adresses: string[];
  passageAvant: Passage;
  temoinF9: Ligne[];
  temoinF2: Ligne[];
  enFile: { f9: { enqueued: boolean }; f2: { enqueued: boolean } };
  coupures: Record<string, { ok: boolean }>;
  filles: Record<string, unknown>;
  journalCascade: Array<{ cle: string; apres: unknown; cascade?: string }>;
  passageApres: Passage;
  apresF9: Ligne[];
  apresF2: Ligne[];
}

test.describe("@formateurs E39 — coupure en cascade", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  let o: Observations;

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    o = await executerScenarioSecurite<Observations>("e39-coupure-cascade", {});
  });

  test.afterAll(async () => {
    for (const a of o?.adresses ?? []) await viderPuitsPour(a);
    await prisma.$disconnect();
  });

  test("témoins : tout allumé, F9 et F2 partent, deux campagnes actives", () => {
    expect(o.temoinF9.map((l) => l.status)).toEqual(["sent"]);
    expect(o.temoinF2.map((l) => l.status)).toEqual(["sent"]);
    expect(o.passageAvant).toMatchObject({ horsFenetre: false, campagnesActives: 2 });
    expect(o.enFile).toEqual({ f9: { enqueued: true }, f2: { enqueued: true } });
  });

  test("la coupure d'une mère coupe ses filles, chacune journalisée", () => {
    expect(o.coupures).toEqual({
      dossier_en_ligne: { ok: true, message: "Coupé." },
      echange_ouvert: { ok: true, message: "Coupé." },
    });
    for (const k of [
      "formateurs.relances_auto",
      "formateurs.invitation_auto",
      "formateurs.suivi_echange",
    ]) {
      expect(o.filles[k], k).toEqual({ actif: false });
    }
    const cascade = o.journalCascade.filter((j) => j.cascade !== undefined);
    expect(cascade.map((j) => [j.cle, j.cascade]).sort()).toEqual(
      [
        ["formateurs.invitation_auto", "formateurs.echange_ouvert"],
        ["formateurs.relances_auto", "formateurs.dossier_en_ligne"],
        ["formateurs.suivi_echange", "formateurs.echange_ouvert"],
      ].sort(),
    );
  });

  test("aucun F9 ni F2 en file ne part", () => {
    expect(o.apresF9[1]).toEqual({
      template: "formateur-dossier-relance",
      status: "cancelled",
      error: "Retenu à l'envoi : dossier en ligne coupé",
    });
    expect(o.apresF2[1]).toEqual({
      template: "formateur-invitation-relance",
      status: "cancelled",
      error: "Retenu à l'envoi : invitation automatique ou suivi de l'échange coupé",
    });
  });

  test("et le passage des campagnes n'en enfile plus aucun", () => {
    expect(o.passageApres).toMatchObject({ horsFenetre: false, campagnesActives: 0, envoyes: 0 });
  });
});
