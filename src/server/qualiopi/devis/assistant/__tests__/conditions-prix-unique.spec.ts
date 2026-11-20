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
import {
  controlerEcheancier,
  recalculerEcheancier,
  texteConditionsPrixUnique,
} from "../conditions-prix-unique";

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

describe("recalculerEcheancier / controlerEcheancier (l'échéancier suit le total)", () => {
  const texte1000 = () => {
    const p = payload(trio());
    p.formules.garantieJours = "90";
    const r = texteConditionsPrixUnique(p, totaux(100000), "assujetti");
    if ("erreurs" in r) throw new Error("erreurs");
    return r.texte;
  };

  it("1 000 → 1 500 € HT : 540,00 / 540,00 / 720,00 € TTC, clauses suivantes intactes", () => {
    const avant = texte1000();
    const r = recalculerEcheancier(avant, totaux(150000).totalTtcCents, "assujetti");
    if ("erreur" in r) throw new Error(r.erreur);
    expect(r.texte.match(/540,00\s€ TTC/g)).toHaveLength(2);
    expect(r.texte).toMatch(/720,00\s€ TTC/);
    expect(r.texte).not.toMatch(/360,00|480,00/);
    expect(r.texte.slice(r.texte.indexOf("\n\n"))).toBe(avant.slice(avant.indexOf("\n\n")));
    expect(controlerEcheancier(r.texte, 180000, "assujetti")).toBe(true);
  });

  it("controlerEcheancier : faux si le total a bougé, vrai sinon", () => {
    const t = texte1000();
    expect(controlerEcheancier(t, 120000, "assujetti")).toBe(true);
    expect(controlerEcheancier(t, 180000, "assujetti")).toBe(false);
  });

  it("le taux de TVA qui change est repris (1 000 € HT à 10 %)", () => {
    const t = computeTotauxFacture([{ quantite: 1, prixUnitaireHtCents: 100000 }], "assujetti", 10);
    const r = recalculerEcheancier(texte1000(), t.totalTtcCents, "assujetti");
    if ("erreur" in r) throw new Error(r.erreur);
    expect(controlerEcheancier(r.texte, t.totalTtcCents, "assujetti")).toBe(true);
    expect(r.texte).toMatch(/330,00\s€ TTC/);
  });

  it("texte retouché à la main (ligne illisible) : erreur claire, pas de texte", () => {
    const t = texte1000().replace("2. Étape intermédiaire", "Deuxième versement");
    const r = recalculerEcheancier(t, 180000, "assujetti");
    expect("erreur" in r).toBe(true);
    expect(controlerEcheancier(t, 120000, "assujetti")).toBe(false);
  });

  it("texte qui ne commence pas par l'échéancier : erreur", () => {
    expect("erreur" in recalculerEcheancier("Clause libre.", 1000, "assujetti")).toBe(true);
  });
});

describe("garde-fous de saisie", () => {
  it("un versement non final à 0,00 € est refusé sur formules.achat.phases", () => {
    const r = texteConditionsPrixUnique(
      payload(
        [
          ["Acompte", "1", "signature"],
          ["Solde", "99", "livraison"],
        ],
        "0,05",
      ),
      totaux(5),
      "assujetti",
    );
    expect("erreurs" in r).toBe(true);
    if ("erreurs" in r) expect(r.erreurs[0]!.champ).toBe("formules.achat.phases");
  });

  it("texte de délais trop long : message explicite sur le champ concerné", () => {
    const p = payload(trio());
    p.nonImprime["delais"] = { texte: "x ".repeat(2500) };
    const r = texteConditionsPrixUnique(p, totaux(100000), "assujetti");
    expect("erreurs" in r).toBe(true);
    if ("erreurs" in r) {
      expect(r.erreurs[0]!.message).toContain(
        "Les textes de délais et de garantie sont trop longs pour le devis",
      );
      expect(r.erreurs[0]!.champ).toBe("nonImprime.delais");
    }
  });

  it("plus de 80 lignes : même message, sur la garantie", () => {
    const p = payload(trio());
    p.formules.garantieJours = "90";
    p.nonImprime["phraseGarantie"] = Array.from({ length: 90 }, (_, i) => `l${i}`).join("\n");
    const r = texteConditionsPrixUnique(p, totaux(100000), "assujetti");
    expect("erreurs" in r).toBe(true);
    if ("erreurs" in r) {
      expect(r.erreurs[0]!.message).toContain("trop longs");
      expect(r.erreurs[0]!.champ).toBe("nonImprime.phraseGarantie");
    }
  });
});
