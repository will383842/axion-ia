import { describe, expect, it } from "vitest";

import { offreFictive } from "@/server/qualiopi/devis/offre-fixtures.spec-util";

import { devisEnAttentePourPipeline, type DevisPourPipeline } from "../pipeline-devis";

const ligne = (prixHt: number, q = 1) => ({
  designation: "Prestation",
  quantite: q,
  prixUnitaireHtCents: prixHt,
  tauxTvaPercent: 20,
});
const devis = (surcharge: Partial<DevisPourPipeline> = {}): DevisPourPipeline => ({
  id: "d1",
  statut: "envoye",
  offre: null,
  lignes: [ligne(100_000)],
  montantTotalHtCents: 100_000,
  sentAt: new Date("2026-11-01T10:00:00Z"),
  createdAt: new Date("2026-10-30T10:00:00Z"),
  ...surcharge,
});
const calc = (d: DevisPourPipeline[]) => devisEnAttentePourPipeline(d, "assujetti", 20);

describe("devisEnAttentePourPipeline", () => {
  it("aucun devis : null (affichage d'avant)", () => {
    expect(calc([])).toBeNull();
  });
  it("1 devis envoyé 1 000 € HT : 1 200 € TTC", () => {
    expect(calc([devis()])).toMatchObject({
      nb: 1,
      htCents: 100_000,
      ttcCents: 120_000,
      aPartirDe: false,
      dernierDevisId: "d1",
    });
  });
  it("2 devis envoyés : somme et nombre ; lien vers le dernier envoyé", () => {
    const r = calc([
      devis({ id: "a", sentAt: new Date("2026-11-01T10:00:00Z") }),
      devis({
        id: "b",
        lignes: [ligne(50_000)],
        montantTotalHtCents: 50_000,
        sentAt: new Date("2026-11-05T10:00:00Z"),
      }),
    ]);
    expect(r).toMatchObject({ nb: 2, htCents: 150_000, ttcCents: 180_000, dernierDevisId: "b" });
  });
  it.each(["accepte", "signe", "refuse", "decline", "expire", "annule", "brouillon"])(
    "statut %s : non compté",
    (statut) => {
      expect(calc([devis({ statut })])).toBeNull();
    },
  );
  it("un devis envoyé et un signé : seul l'envoyé compte", () => {
    const r = calc([devis({ id: "a" }), devis({ id: "b", statut: "accepte" })]);
    expect(r).toMatchObject({ nb: 1, htCents: 100_000, dernierDevisId: "a" });
  });
  it("devis à deux formules : la plus basse, « à partir de »", () => {
    const r = calc([devis({ offre: offreFictive(), lignes: [], montantTotalHtCents: 0 })]);
    expect(r).toMatchObject({ nb: 1, htCents: 30_000, ttcCents: 36_000, aPartirDe: true });
  });
  it("centimes impairs : TTC calculé comme le PDF (TVA par groupe de taux, arrondie)", () => {
    const r = calc([devis({ lignes: [ligne(33_333), ligne(1, 3)], montantTotalHtCents: 33_336 })]);
    // base 33 336 × 20 % = 6 667,2 → 6 667
    expect(r).toMatchObject({ htCents: 33_336, ttcCents: 40_003 });
  });
  it("sans TVA hors régime assujetti : TTC = HT", () => {
    const r = devisEnAttentePourPipeline([devis()], "franchise_293b", 20);
    expect(r).toMatchObject({ htCents: 100_000, ttcCents: 100_000 });
  });
});
