/**
 * Choix imprimable sur l'exemplaire signé — mêmes vérifications que l'acceptation : tout choix
 * qui ne passerait pas `preparer` ne s'imprime pas.
 */
import { describe, expect, it } from "vitest";

import { choixImprimable } from "./choix-exemplaire";
import { choixCanonique, sha256Choix, sha256Offre } from "./offre-calculs";
import { offreFictive } from "./offre-fixtures.spec-util";

const NUMERO = "AXI-DEV-2026-001";

function cas() {
  const offre = offreFictive();
  const offreSha256 = sha256Offre(offre);
  const choix = choixCanonique({
    devisNumero: NUMERO,
    offreSha256,
    formule: "abonnement",
    automatisationsRetenues: ["auto1"],
    maintenanceRetenue: false,
    periodiciteMois: 1,
  });
  return {
    devis: { offre, offreSha256, numero: NUMERO },
    ligne: { hashVersion: 4, choixOffre: choix as unknown, choixOffreSha256: sha256Choix(choix) },
    choix,
  };
}

describe("choixImprimable", () => {
  it("choix scellé cohérent : récapitulatif + empreinte", () => {
    const c = cas();
    const r = choixImprimable(c.devis, c.ligne);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.choix.empreinteChoix).toBe(sha256Choix(c.choix));
    expect(r.choix.formuleLibelle).toContain("Formule B");
    expect(r.choix.recurrent.length).toBeGreaterThan(0);
    expect(r.choix.totalPonctuelTtcLisible).toBeTruthy();
  });

  it("choix altéré (empreinte ne correspond plus) : rien n'est imprimé", () => {
    const c = cas();
    const altere = { ...c.choix, automatisationsRetenues: [] };
    expect(choixImprimable(c.devis, { ...c.ligne, choixOffre: altere })).toEqual({
      ok: false,
      motif: "choix_altere",
    });
  });

  it("choix scellé pour un autre numéro de devis : refus", () => {
    const c = cas();
    const autre = choixCanonique({ ...c.choix, devisNumero: "AXI-DEV-2026-999" });
    const r = choixImprimable(c.devis, {
      hashVersion: 4,
      choixOffre: autre,
      choixOffreSha256: sha256Choix(autre),
    });
    expect(r).toEqual({ ok: false, motif: "choix_autre_devis" });
  });

  it("offre altérée depuis l'envoi : refus", () => {
    const c = cas();
    const offre = { ...c.devis.offre, garantie: { ...c.devis.offre.garantie, jours: 999 } };
    const r = choixImprimable({ ...c.devis, offre }, c.ligne);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motif).toBe("offre_alteree");
  });

  it("sceau V3 : refus, le choix n'existe qu'à partir de la V4", () => {
    const c = cas();
    expect(choixImprimable(c.devis, { ...c.ligne, hashVersion: 3 })).toEqual({
      ok: false,
      motif: "sceau_non_v4",
    });
  });

  it("choix sans empreinte scellée : refus", () => {
    const c = cas();
    expect(choixImprimable(c.devis, { ...c.ligne, choixOffreSha256: null })).toEqual({
      ok: false,
      motif: "choix_absent",
    });
  });

  it("choix non canonique (automatisation dupliquée, même empreinte recalculée) : refus", () => {
    const c = cas();
    const brut = { ...c.choix, automatisationsRetenues: ["auto1", "auto1"] };
    const r = choixImprimable(c.devis, {
      hashVersion: 4,
      choixOffre: brut,
      choixOffreSha256: sha256Choix(brut),
    });
    expect(r.ok).toBe(false);
  });
});
