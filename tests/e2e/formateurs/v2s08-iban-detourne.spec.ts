// @formateurs V2-S08 (vérification n° 2, sécurité) — Détournement d'IBAN.
//
// Le circuit prévu (demande depuis l'espace, avis F43, 48 h, accord) tient : le
// virement est suspendu tant que la demande attend, et l'accord est refusé avant
// 48 heures ; la fiche garde l'ancien compte pendant l'attente.
//
// Défaut consigné (`test.fixme`, cf. le rapport de la PR) :
//   · V2-S-1 — un indépendant ACTIF du stock reçoit son dossier de « mise à
//     niveau » : par ce lien, un NOUVEL IBAN remplace celui des virements, sans
//     demande, sans avis à l'adresse connue, sans délai — et le virement suivant
//     est jugé possible sur-le-champ.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { viderPuitsPour } from "../fixtures/formateurs/puits-smtp";
import { scenarioV2 } from "../fixtures/formateurs/v2s-commun";

interface Observations {
  allumage: { ok: boolean };
  envoi: { data?: unknown; error?: string };
  dossierStatut: string | null;
  saisie: unknown;
  ibanChange: boolean;
  ibanEstLeNouveau: boolean;
  demandes: number;
  avisF43: number;
  motifsApres: unknown;
  circuit: { ok: boolean };
  demande: { ok: boolean };
  motifsPendantAttente: unknown;
  accordTropTot: { ok: boolean; raison?: string };
  ibanInchangePendantAttente: boolean;
  adresses: string[];
}

test.describe("@formateurs V2-S08 — changement d'IBAN puis virement", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  let o: Observations;

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    o = await scenarioV2<Observations>("v2s08-iban-mise-a-niveau");
  });

  test.afterAll(async () => {
    for (const a of o?.adresses ?? []) await viderPuitsPour(a);
    await prisma.$disconnect();
  });

  test("circuit prévu : virement suspendu pendant l'attente, accord refusé avant 48 h", () => {
    expect(o.circuit.ok).toBe(true);
    expect(o.demande.ok).toBe(true);
    expect(o.motifsPendantAttente).toContain("compte_bancaire_a_valider");
    expect(o.accordTropTot).toEqual({ ok: false, raison: "trop_tot" });
    expect(o.ibanInchangePendantAttente).toBe(true);
  });

  test("témoin : le dossier de mise à niveau est bien ouvert par la console", () => {
    expect(o.allumage.ok).toBe(true);
    expect(o.envoi.error).toBeUndefined();
    expect(o.dossierStatut).toBe("en_cours");
  });

  // V2-S-1 — BLOQUANT (argent). Le compte des virements d'un indépendant actif
  // change par le lien de mise à niveau, hors du circuit de changement de compte.
  // Probable : dossier.ts `vue()` (~l. 161, `ibanFige` ne regarde que
  // `dossierEnvoyeAt`) et `enregistrerActivite` (~l. 275-298), joints à
  // mise-a-niveau.ts (~l. 105-125) qui rouvre le dossier d'une fiche active ;
  // virement-mission-base.ts (~l. 150) ne voit que les demandes acceptées.
  test("V2-S-1 — l'IBAN des virements ne change pas par le dossier de mise à niveau", () => {
    const motifs = o.motifsApres as string[];
    expect(o.ibanChange && motifs.length === 0).toBe(false);
    if (o.ibanChange) expect(o.avisF43).toBeGreaterThan(0);
  });
});
