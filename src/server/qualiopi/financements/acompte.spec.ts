/**
 * Tests — calcul de l'acompte (F61).
 *
 * Chaque cas correspond à une règle de droit ou à une conséquence financière
 * réelle. Ce ne sont pas des tests de couverture : ce sont les quatre situations
 * dans lesquelles se tromper coûte de l'argent ou expose à une irrégularité.
 */

import { describe, it, expect } from "vitest";
import {
  calculerAcompte,
  PLAFOND_ACOMPTE_PARTICULIER_PCT,
  DELAI_RETRACTATION_PARTICULIER_JOURS,
  type ContexteAcompte,
} from "./acompte";

const base: ContexteAcompte = {
  montantTotalHtCents: 200_000, // 2 000 €
  priseEnChargeCents: 0,
  subrogation: false,
  cpf: false,
  nature: "entreprise",
  tauxAcomptePct: 30,
};

describe("CPF", () => {
  it("n'appelle AUCUN acompte — c'est la Caisse des Dépôts qui règle", () => {
    const r = calculerAcompte({ ...base, cpf: true });
    expect(r.acompteCents).toBe(0);
    expect(r.motif).toContain("Caisse des Dépôts");
  });
});

describe("Subrogation", () => {
  it("prise en charge à 100 % avec subrogation → aucun acompte", () => {
    const r = calculerAcompte({ ...base, priseEnChargeCents: 200_000, subrogation: true });
    expect(r.acompteCents).toBe(0);
    expect(r.resteAChargeCents).toBe(0);
    expect(r.motif).toContain("directement l'organisme");
  });

  // 🔴 Le cas qui compte : une prise en charge PARTIELLE laisse un reste à
  // charge, et l'acompte doit porter sur CE montant — pas sur le total. S'en
  // remettre au total reviendrait à réclamer à l'entreprise une part que son
  // OPCO va payer.
  it("prise en charge partielle → l'acompte porte sur le RESTE À CHARGE", () => {
    const r = calculerAcompte({
      ...base,
      montantTotalHtCents: 200_000,
      priseEnChargeCents: 120_000, // OPCO couvre 1 200 €
      subrogation: true,
      tauxAcomptePct: 30,
    });
    expect(r.resteAChargeCents).toBe(80_000); // 800 €
    expect(r.acompteCents).toBe(24_000); // 30 % de 800 €, pas de 2 000 €
    expect(r.soldeCents).toBe(56_000);
  });

  it("permet de demander la TOTALITÉ du reste à charge en acompte", () => {
    const r = calculerAcompte({
      ...base,
      priseEnChargeCents: 120_000,
      tauxAcomptePct: 100,
    });
    expect(r.acompteCents).toBe(80_000);
    expect(r.soldeCents).toBe(0);
    expect(r.echeancier).toHaveLength(1);
  });
});

describe("Particulier — art. L6353-6", () => {
  it("plafonne à 30 % même si un taux supérieur est demandé", () => {
    const r = calculerAcompte({ ...base, nature: "particulier", tauxAcomptePct: 50 });
    expect(r.plafonne).toBe(true);
    expect(r.acompteCents).toBe(60_000); // 30 % de 2 000 €
    expect(r.motif).toContain("L6353-6");
  });

  it("accepte un taux INFÉRIEUR au plafond — on peut demander moins", () => {
    const r = calculerAcompte({ ...base, nature: "particulier", tauxAcomptePct: 10 });
    expect(r.plafonne).toBe(false);
    expect(r.acompteCents).toBe(20_000);
  });

  // 🔴 Aucune somme ne peut être encaissée avant le 10e jour.
  it("repousse l'encaissement de 10 jours après la signature", () => {
    const signature = new Date("2026-03-01T00:00:00.000Z");
    const r = calculerAcompte({ ...base, nature: "particulier", dateSignature: signature });
    expect(r.encaissableAPartirDu).not.toBeNull();
    const attendu = new Date(
      signature.getTime() + DELAI_RETRACTATION_PARTICULIER_JOURS * 24 * 60 * 60 * 1000,
    );
    expect(r.encaissableAPartirDu?.toISOString()).toBe(attendu.toISOString());
  });

  // 🔴 L'échelonnement est une OBLIGATION, pas une facilité commerciale.
  it("échelonne toujours le solde, jamais un règlement unique", () => {
    const r = calculerAcompte({ ...base, nature: "particulier" });
    const solde = r.echeancier.find((e) => e.libelle.includes("Solde"));
    expect(solde?.libelle).toContain("échelonné");
    expect(solde?.libelle).toContain("L6353-6");
  });

  it("le plafond est bien celui du code du travail", () => {
    expect(PLAFOND_ACOMPTE_PARTICULIER_PCT).toBe(30);
  });
});

describe("Entreprise — aucune limite légale", () => {
  it("applique le taux au montant total quand il n'y a pas de financeur", () => {
    const r = calculerAcompte(base);
    expect(r.acompteCents).toBe(60_000);
    expect(r.soldeCents).toBe(140_000);
    expect(r.echeancier).toHaveLength(2);
  });

  it("accepte un acompte de 50 %, interdit à un particulier", () => {
    const r = calculerAcompte({ ...base, tauxAcomptePct: 50 });
    expect(r.acompteCents).toBe(100_000);
    expect(r.plafonne).toBe(false);
  });

  it("taux à 0 → aucun acompte, le solde vaut le total", () => {
    const r = calculerAcompte({ ...base, tauxAcomptePct: 0 });
    expect(r.acompteCents).toBe(0);
    expect(r.soldeCents).toBe(200_000);
  });
});

describe("Robustesse — ne lève jamais", () => {
  it("borne une prise en charge supérieure au total", () => {
    const r = calculerAcompte({ ...base, priseEnChargeCents: 999_999 });
    expect(r.resteAChargeCents).toBe(0);
    expect(r.acompteCents).toBe(0);
  });

  it("borne un taux aberrant", () => {
    expect(calculerAcompte({ ...base, tauxAcomptePct: -20 }).acompteCents).toBe(0);
    expect(calculerAcompte({ ...base, tauxAcomptePct: 500 }).acompteCents).toBe(200_000);
  });

  it("arrondit à l'euro INFÉRIEUR — on ne réclame jamais plus que le taux prévu", () => {
    // 33 % de 1 001,00 € = 330,33 € → ramené à 330,00 €.
    // Le montant est choisi pour PRODUIRE des centimes : avec 1 000 € le calcul
    // tombe juste et ne testerait pas l'arrondi.
    const r = calculerAcompte({ ...base, montantTotalHtCents: 100_100, tauxAcomptePct: 33 });
    expect(r.acompteCents).toBe(33_000);
    expect(r.acompteCents % 100).toBe(0);
    // Et le solde absorbe la différence : rien ne se perd.
    expect(r.acompteCents + r.soldeCents).toBe(100_100);
  });

  it("montant total nul → tout à zéro, aucune échéance", () => {
    const r = calculerAcompte({ ...base, montantTotalHtCents: 0 });
    expect(r.acompteCents).toBe(0);
    expect(r.echeancier).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Vérification E2E 2026-07-26 — deux défauts trouvés par contre-vérification.
// ─────────────────────────────────────────────────────────────────────────────

describe("CPF avec un titulaire particulier", () => {
  // 🔴 La branche CPF s'exécutait avant le test sur `nature`. Le reste à charge
  // CPF est un cas métier DÉCLARÉ (`qualiopi.cpf_reste_a_charge = 103,20 €` en
  // production) : il ressortait en règlement unique, sans rétractation, sans
  // échelonnement, sans mention L6353-6. Le CPF retire l'acompte, pas les
  // protections du particulier sur ce qu'il paie lui-même.
  const ctx = {
    montantTotalHtCents: 200_000,
    priseEnChargeCents: 189_680,
    nature: "particulier" as const,
    tauxAcomptePct: 30,
    cpf: true,
    subrogation: false,
    dateSignature: new Date("2026-09-01T00:00:00Z"),
  };

  it("ne demande aucun acompte", () => {
    expect(calculerAcompte(ctx).acompteCents).toBe(0);
  });

  it("échelonne le reste à charge et cite L6353-6", () => {
    const r = calculerAcompte(ctx);
    expect(r.echeancier).toHaveLength(1);
    expect(r.echeancier[0]!.libelle).toContain("L6353-6");
    expect(r.echeancier[0]!.montantCents).toBe(10_320);
  });

  it("ouvre l'encaissement après le délai de rétractation", () => {
    const r = calculerAcompte(ctx);
    expect(r.encaissableAPartirDu).toBeInstanceOf(Date);
    expect(r.encaissableAPartirDu!.getTime()).toBeGreaterThan(ctx.dateSignature.getTime());
  });

  it("sans reste à charge, revient au cas CPF pur", () => {
    const r = calculerAcompte({ ...ctx, priseEnChargeCents: 200_000 });
    expect(r.echeancier).toHaveLength(0);
    expect(r.motif).toContain("Caisse des Dépôts");
  });
});

describe("Entrées non numériques", () => {
  // 🔴 Le JSDoc promettait des bornes sûres ; `Math.trunc(NaN)` vaut `NaN`, qui
  // traversait tout le calcul. `if (acompte > 0)` étant faux pour NaN,
  // l'échéancier ressortait VIDE et l'invariante « somme = reste à charge » ne
  // détectait rien.
  const base = {
    montantTotalHtCents: 200_000,
    priseEnChargeCents: 0,
    nature: "entreprise" as const,
    tauxAcomptePct: 30,
    cpf: false,
    subrogation: false,
  };

  for (const [nom, ctx] of [
    ["montant NaN", { ...base, montantTotalHtCents: NaN }],
    ["montant Infinity", { ...base, montantTotalHtCents: Infinity }],
    ["prise en charge NaN", { ...base, priseEnChargeCents: NaN }],
    ["taux NaN", { ...base, tauxAcomptePct: NaN }],
  ] as const) {
    it(`${nom} → aucun montant NaN en sortie`, () => {
      const r = calculerAcompte(ctx);
      for (const v of [r.acompteCents, r.soldeCents, r.resteAChargeCents]) {
        expect(Number.isFinite(v)).toBe(true);
      }
      expect(r.motif).not.toContain("NaN");
      for (const e of r.echeancier) expect(Number.isFinite(e.montantCents)).toBe(true);
    });
  }

  it("un taux NaN vaut 0, et l'objet reste cohérent avec lui-même", () => {
    const r = calculerAcompte({ ...base, tauxAcomptePct: NaN });
    expect(r.acompteCents).toBe(0);
    expect(r.soldeCents).toBe(r.resteAChargeCents);
    expect(r.echeancier.reduce((t, e) => t + e.montantCents, 0)).toBe(r.resteAChargeCents);
  });
});

describe("Message de plafonnement", () => {
  // Annonçait « le taux de 100 % a été ramené à 30 % » quand on avait demandé
  // 500 : il lisait la valeur déjà bornée à 100.
  it("cite le taux réellement saisi", () => {
    const r = calculerAcompte({
      montantTotalHtCents: 100_000,
      priseEnChargeCents: 0,
      nature: "particulier",
      tauxAcomptePct: 500,
      cpf: false,
      subrogation: false,
    });
    expect(r.plafonne).toBe(true);
    expect(r.motif).toContain("500 %");
    expect(r.motif).toContain("ramené à 30 %");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Réconciliation des quatre sources de l'acompte — 2026-07-27.
//
// Quatre endroits calculaient un acompte, et deux répondaient à des questions
// DIFFÉRENTES sans le dire :
//
//   · `calculerAcompte()`        PROPOSE  — assiette = reste à charge
//   · garde L6353-6 (facturation) REFUSE   — assiette = prix convenu
//   · `contrat-formation.tsx`     IMPRIME  — B2C, plafonné
//   · `convention.tsx`            IMPRIME  — B2B, aucun plafond légal
//
// L'invariant qui les rend compatibles, et que ce test verrouille :
// **la proposition ne peut jamais franchir le plafond légal.**
// 30 % du reste à charge est toujours ≤ 30 % du prix convenu, puisque le reste
// à charge est toujours ≤ au total. Ce sont deux étages, pas deux règles
// rivales — ce qui avait été pris pour une contradiction.
// ─────────────────────────────────────────────────────────────────────────────

describe("Invariant : la proposition reste sous le plafond légal", () => {
  const CAS = [
    { total: 200_000, priseEnCharge: 0, libelle: "sans financement" },
    { total: 200_000, priseEnCharge: 120_000, libelle: "OPCO 60 %" },
    { total: 200_000, priseEnCharge: 189_680, libelle: "CPF, reste 103,20 €" },
    { total: 350_000, priseEnCharge: 100_000, libelle: "financement partiel" },
    { total: 99_900, priseEnCharge: 0, libelle: "petit montant" },
  ] as const;

  for (const c of CAS) {
    it(`${c.libelle} : l'acompte proposé ne dépasse pas 30 % du prix convenu`, () => {
      const r = calculerAcompte({
        montantTotalHtCents: c.total,
        priseEnChargeCents: c.priseEnCharge,
        nature: "particulier",
        tauxAcomptePct: 30,
        cpf: false,
        subrogation: false,
      });
      const plafondLegal = Math.floor((c.total * PLAFOND_ACOMPTE_PARTICULIER_PCT) / 100);
      expect(r.acompteCents).toBeLessThanOrEqual(plafondLegal);
    });
  }

  // Le sens de la protection : ce que le particulier avance de sa poche, jamais
  // un pourcentage de ce qu'un tiers paie à sa place.
  it("l'assiette est bien le reste à charge, pas le total", () => {
    const r = calculerAcompte({
      montantTotalHtCents: 200_000,
      priseEnChargeCents: 120_000,
      nature: "particulier",
      tauxAcomptePct: 30,
      cpf: false,
      subrogation: false,
    });
    // 30 % de 80 000 = 24 000, et non 30 % de 200 000 = 60 000.
    expect(r.acompteCents).toBe(24_000);
  });
});
