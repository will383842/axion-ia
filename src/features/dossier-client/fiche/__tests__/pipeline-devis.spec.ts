import { describe, expect, it, vi } from "vitest";

import { normaliserLignesPourActivite } from "@/server/qualiopi/financements/facture-libre-pur";
import { computeTotauxFacture } from "@/server/qualiopi/legal/tva";

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
const calc = (d: DevisPourPipeline[], formulesActives = true) =>
  devisEnAttentePourPipeline(d, "assujetti", 20, formulesActives);

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
  it.each(["accepte", "refuse", "expire", "brouillon", "transforme_convention"])(
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
  it("devis classique hors régime assujetti : suit tauxTvaLigne comme le PDF (20 % saisi → TTC > HT)", () => {
    const r = devisEnAttentePourPipeline([devis()], "franchise_293b", 20);
    expect(r).toMatchObject({ htCents: 100_000, ttcCents: 120_000 });
  });
  it("devis classique hors régime assujetti sans taux de ligne : TTC = HT", () => {
    const l = { designation: "P", quantite: 1, prixUnitaireHtCents: 100_000 };
    const r = devisEnAttentePourPipeline([devis({ lignes: [l] })], "franchise_293b", 20);
    expect(r).toMatchObject({ htCents: 100_000, ttcCents: 100_000 });
  });
  it("devis à formules hors régime assujetti : taux de ligne ignoré", () => {
    const r = devisEnAttentePourPipeline(
      [devis({ offre: offreFictive(), lignes: [], montantTotalHtCents: 0 })],
      "franchise_293b",
      20,
      true,
    );
    expect(r).toMatchObject({ htCents: 30_000, ttcCents: 30_000 });
  });
  it("activité formation + ligne à 0 % : TTC identique au PDF (normalisation par activité)", () => {
    const l0 = { designation: "F", quantite: 1, prixUnitaireHtCents: 100_000, tauxTvaPercent: 0 };
    const attendu = computeTotauxFacture(
      normaliserLignesPourActivite([l0], "formation", "assujetti", 20),
      "assujetti",
      20,
    );
    const r = devisEnAttentePourPipeline(
      [devis({ lignes: [l0], activite: "formation" })],
      "assujetti",
      20,
    );
    expect(r).toMatchObject({ htCents: attendu.totalHtCents, ttcCents: attendu.totalTtcCents });
    expect(r!.ttcCents).toBe(120_000);
  });
  it("interrupteur formules éteint : l'offre est ignorée, lecture comme le PDF (lignes)", () => {
    const r = calc([devis({ offre: offreFictive() })], false);
    expect(r).toMatchObject({ htCents: 100_000, ttcCents: 120_000, aPartirDe: false });
  });
  it("offre illisible : ignorée, comptée, les autres devis restent comptés", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = devisEnAttentePourPipeline(
      [devis({ id: "ok" }), devis({ id: "ko", offre: { n: "importe quoi" } })],
      "assujetti",
      20,
      true,
    );
    expect(r).toMatchObject({ nb: 1, htCents: 100_000, illisibles: 1, dernierDevisId: "ok" });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("ko");
    warn.mockRestore();
  });
  it("tous illisibles : aucun total, aucun lien", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = devisEnAttentePourPipeline([devis({ offre: { n: 1 } })], "assujetti", 20, true);
    expect(r).toMatchObject({ nb: 0, htCents: 0, illisibles: 1, dernierDevisId: null });
  });
});
