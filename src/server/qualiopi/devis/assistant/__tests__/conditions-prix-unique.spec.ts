import { describe, expect, it } from "vitest";
import { computeTotauxFacture } from "@/server/qualiopi/legal/tva";
import {
  CONDITIONS_PARTICULIERES_LIGNES_MAX,
  CONDITIONS_PARTICULIERES_MAX,
  motsSensiblesTrouves,
  nombreDeLignes,
} from "@/server/qualiopi/devis/conditions-particulieres";
import { payloadVide, type PayloadAssistantV1 } from "../payload";
import { TEXTE_DELAIS, TEXTE_GARANTIE, TEXTE_PLAFOND_RESPONSABILITE } from "../textes-rubriques";
import { texteConditionsPrixUnique } from "../conditions-prix-unique";

function payload(
  phases: Array<[string, string, "signature" | "avancement" | "livraison"]>,
  prixEur = "1000",
): PayloadAssistantV1 {
  const p = payloadVide(20);
  p.typeDevis = "classique";
  p.lignesClassiques = [{ designation: "Prestation", quantite: "1", prixEur }];
  p.formules.achat.phases = phases.map(([libelle, pourcentage, declencheur]) => ({
    libelle,
    pourcentage,
    declencheur,
  }));
  return p;
}
const trio = (): Array<[string, string, "signature" | "avancement" | "livraison"]> => [
  ["Acompte", "30", "signature"],
  ["Étape intermédiaire", "30", "avancement"],
  ["Solde", "40", "livraison"],
];
const totaux = (htCents: number, regime: "assujetti" | "franchise_293b" = "assujetti") =>
  computeTotauxFacture([{ quantite: 1, prixUnitaireHtCents: htCents }], regime, 20);

describe("texteConditionsPrixUnique", () => {
  it("1 000 € HT, 20 % : 360,00 € TTC deux fois et 480,00 € TTC", () => {
    const r = texteConditionsPrixUnique(payload(trio()), totaux(100000), "assujetti");
    if ("erreurs" in r) throw new Error(JSON.stringify(r.erreurs));
    expect(r.phasesCents).toEqual([36000, 36000, 48000]);
    expect(r.texte.match(/360,00\s€ TTC/g)).toHaveLength(2);
    expect(r.texte).toMatch(/480,00\s€ TTC/);
    expect(r.texte.startsWith("Échéancier de paiement\n1. Acompte, à la signature : 30 %")).toBe(
      true,
    );
    expect(r.texte).toContain("2. Étape intermédiaire, à l'avancement : 30 %");
    expect(r.texte).toContain("3. Solde, à la livraison : 40 %");
  });

  it("la somme des versements égale le total TTC exact (1 000,01 € HT)", () => {
    const t = totaux(100001);
    const r = texteConditionsPrixUnique(payload(trio(), "1000,01"), t, "assujetti");
    if ("erreurs" in r) throw new Error("erreurs");
    expect(r.phasesCents.reduce((s, c) => s + c, 0)).toBe(t.totalTtcCents);
    // Le dernier versement absorbe le reste.
    expect(r.phasesCents[2]).toBeGreaterThanOrEqual(Math.floor((t.totalTtcCents * 40) / 100));
  });

  it("délais : texte par défaut, puis saisi + fourchette ; garantie ; plafond", () => {
    const p = payload(trio());
    p.formules.garantieJours = "90";
    const r1 = texteConditionsPrixUnique(p, totaux(100000), "assujetti");
    if ("erreurs" in r1) throw new Error("erreurs");
    expect(r1.texte).toContain(`Délais :\n${TEXTE_DELAIS}`);
    expect(r1.texte).toContain(`Garantie de 90 jours.\n${TEXTE_GARANTIE}`);
    expect(r1.texte.endsWith(TEXTE_PLAFOND_RESPONSABILITE)).toBe(true);
    expect(r1.texte).not.toContain("Délai estimé");

    p.nonImprime["delais"] = {
      texte: "Livraison sous réserve de vos retours.",
      fourchette: "6 à 8 semaines",
    };
    p.nonImprime["phraseGarantie"] = "Garantie saisie.";
    const r2 = texteConditionsPrixUnique(p, totaux(100000), "assujetti");
    if ("erreurs" in r2) throw new Error("erreurs");
    expect(r2.texte).toContain(
      "Livraison sous réserve de vos retours. Délai estimé : 6 à 8 semaines.",
    );
    expect(r2.texte).toContain("Garantie de 90 jours.\nGarantie saisie.");
    expect(r2.texte).not.toContain(TEXTE_DELAIS);
  });

  it("sans garantie : aucun paragraphe de garantie", () => {
    const p = payload(trio());
    p.formules.garantieJours = "";
    const r = texteConditionsPrixUnique(p, totaux(100000), "assujetti");
    if ("erreurs" in r) throw new Error("erreurs");
    expect(r.texte).not.toContain("Garantie de");
  });

  it.each([
    [
      [
        ["A", "30", "signature"],
        ["B", "30", "livraison"],
      ],
      "somme 60",
    ],
    [
      [
        ["A", "50,5", "signature"],
        ["B", "49,5", "livraison"],
      ],
      "non entiers",
    ],
    [
      [
        ["A", "0", "signature"],
        ["B", "100", "livraison"],
      ],
      "0 % (le modèle exige au moins 1 %)",
    ],
  ])("erreur sur formules.achat.phases : %#", (phases, _nom) => {
    const r = texteConditionsPrixUnique(
      payload(phases as Array<[string, string, "signature" | "avancement" | "livraison"]>),
      totaux(100000),
      "assujetti",
    );
    expect("erreurs" in r).toBe(true);
    if ("erreurs" in r) expect(r.erreurs[0]!.champ).toBe("formules.achat.phases");
  });

  it("aucun mot sensible, ≤ 4 000 caractères et ≤ 80 lignes", () => {
    const p = payload(trio());
    p.formules.garantieJours = "90";
    const r = texteConditionsPrixUnique(p, totaux(100000), "assujetti");
    if ("erreurs" in r) throw new Error("erreurs");
    expect(motsSensiblesTrouves(r.texte)).toEqual([]);
    expect(r.texte.length).toBeLessThanOrEqual(CONDITIONS_PARTICULIERES_MAX);
    expect(nombreDeLignes(r.texte)).toBeLessThanOrEqual(CONDITIONS_PARTICULIERES_LIGNES_MAX);
  });

  it("régime non assujetti : pas de suffixe TTC", () => {
    const r = texteConditionsPrixUnique(
      payload(trio()),
      totaux(100000, "franchise_293b"),
      "franchise_293b",
    );
    if ("erreurs" in r) throw new Error("erreurs");
    expect(r.texte).not.toContain("TTC");
    expect(r.texte).toMatch(/300,00\s€/);
  });

  it("100 % à la signature : une seule ligne d'échéancier", () => {
    const r = texteConditionsPrixUnique(
      payload([["Paiement", "100", "signature"]]),
      totaux(100000),
      "assujetti",
    );
    if ("erreurs" in r) throw new Error("erreurs");
    expect(r.phasesCents).toEqual([120000]);
    expect(r.texte.match(/^\d+\. /gm)).toHaveLength(1);
  });
});
