import { describe, expect, it } from "vitest";
import {
  eurosEnCentimes,
  PLAFOND_AVOIR_HT_CENTS,
  plafondRemboursementCents,
  refusDecision,
  refusDemande,
  refusVirement,
  repartirRemboursement,
  verifierMontantAvoir,
} from "../regles";

const d = { dateJournee: "2026-12-01", rapportRemisLe: "2026-12-03", demandeRecueLe: "2026-12-10" };

describe("refusDecision", () => {
  it("accepte un remboursement après la demande", () => {
    expect(refusDecision(d, { decision: "remboursement", decisionLe: "2026-12-12" })).toBeNull();
  });
  it("refuse sans demande reçue, pour les trois décisions", () => {
    for (const decision of ["remboursement", "refus", "avoir"] as const) {
      expect(
        refusDecision(
          { ...d, demandeRecueLe: null },
          { decision, decisionLe: "2026-12-12", motif: "Motif suffisamment long" },
        ),
      ).toMatch(/demande/);
    }
  });
  it("accepte un avoir sans note, et les trois décisions sur une demande hors délai", () => {
    const horsDelai = { ...d, demandeRecueLe: "2027-02-20" };
    expect(refusDecision(horsDelai, { decision: "avoir", decisionLe: "2027-02-22" })).toBeNull();
    expect(
      refusDecision(horsDelai, { decision: "remboursement", decisionLe: "2027-02-22" }),
    ).toBeNull();
    expect(
      refusDecision(horsDelai, {
        decision: "refus",
        decisionLe: "2027-02-22",
        motif: "Demande hors délai, refusée",
      }),
    ).toBeNull();
  });
  it("refuse une décision antérieure à la demande", () => {
    expect(refusDecision(d, { decision: "remboursement", decisionLe: "2026-12-09" })).toMatch(
      /précéder/,
    );
  });
  it("exige un motif pour un refus", () => {
    expect(
      refusDecision(d, { decision: "refus", decisionLe: "2026-12-12", motif: "court" }),
    ).toMatch(/motif/);
    expect(
      refusDecision(d, {
        decision: "refus",
        decisionLe: "2026-12-12",
        motif: "Seuil atteint, total constaté 6 000 €",
      }),
    ).toBeNull();
  });
  it("verrouille après le virement", () => {
    expect(
      refusDecision(
        { ...d, virementLe: "2026-12-20" },
        { decision: "refus", decisionLe: "2026-12-12", motif: "Seuil atteint ici" },
      ),
    ).toMatch(/virement/);
  });
});

describe("refusVirement", () => {
  it("dû après une décision de remboursement", () => {
    expect(
      refusVirement(
        { ...d, decision: "remboursement", decisionLe: "2026-12-12" },
        "2026-12-20",
        "2026-12-21",
      ),
    ).toBeNull();
  });
  it("dû si la demande est réputée acceptée (aucune décision, 15 j dépassés)", () => {
    expect(refusVirement(d, "2027-01-05", "2027-01-05")).toBeNull();
  });
  it("jamais dû sans décision ni acceptation tacite, ni après un refus", () => {
    expect(refusVirement(d, "2026-12-15", "2026-12-15")).toMatch(/Aucun remboursement/);
    expect(
      refusVirement(
        { ...d, decision: "refus", decisionLe: "2026-12-12" },
        "2026-12-15",
        "2026-12-15",
      ),
    ).toMatch(/Aucun remboursement/);
  });
  it("refuse un virement antérieur à la décision", () => {
    expect(
      refusVirement(
        { ...d, decision: "remboursement", decisionLe: "2026-12-12" },
        "2026-12-11",
        "2026-12-21",
      ),
    ).toMatch(/précéder/);
  });
});

describe("refusDemande / eurosEnCentimes", () => {
  it("la demande suppose le rapport remis, et ne le précède pas", () => {
    expect(refusDemande({ dateJournee: "2026-12-01" }, "2026-12-10")).toMatch(/rapport/);
    expect(refusDemande(d, "2026-12-02")).toMatch(/précéder/);
    expect(refusDemande(d, "2026-12-10")).toBeNull();
    expect(refusDemande(d, null)).toBeNull();
  });
  it("convertit les euros en centimes entiers", () => {
    expect(eurosEnCentimes("1 234,50")).toBe(123450);
    expect(eurosEnCentimes("0.1")).toBe(10);
    expect(eurosEnCentimes("19.999")).toBeNull();
    expect(eurosEnCentimes("abc")).toBeNull();
    expect(eurosEnCentimes("-5")).toBeNull();
  });
});

describe("avoir et demande hors délai", () => {
  it("plafonne l'avoir à 4 470 € HT", () => {
    expect(PLAFOND_AVOIR_HT_CENTS).toBe(447_000);
    expect(verifierMontantAvoir(447_000)).toEqual({ ok: true, cents: 447_000 });
    expect(verifierMontantAvoir(447_001).ok).toBe(false);
    expect(verifierMontantAvoir(0).ok).toBe(false);
    expect(verifierMontantAvoir(null).ok).toBe(false);
  });
  it("hors délai : jamais de virement dû sans décision de remboursement", () => {
    const h = {
      dateJournee: "2026-12-01",
      rapportRemisLe: "2026-12-03",
      demandeRecueLe: "2027-02-20",
    };
    expect(refusVirement(h, "2027-04-01", "2027-04-01")).toMatch(/Aucun remboursement/);
    expect(
      refusVirement(
        { ...h, decision: "avoir", decisionLe: "2027-02-22" },
        "2027-03-01",
        "2027-03-01",
      ),
    ).toMatch(/Aucun remboursement/);
    expect(
      refusVirement(
        { ...h, decision: "remboursement", decisionLe: "2027-02-22" },
        "2027-03-01",
        "2027-03-01",
      ),
    ).toBeNull();
  });
});

describe("réponse tardive et plafonds", () => {
  it("un refus tardif ne bloque pas le virement dû par acceptation tacite (47.10 f)", () => {
    const tard = {
      dateJournee: "2026-12-01",
      rapportRemisLe: "2026-12-03",
      demandeRecueLe: "2026-12-10",
      decision: "refus" as const,
      decisionLe: "2026-12-30",
    };
    expect(refusVirement(tard, "2027-01-20", "2027-01-20")).toBeNull();
  });
  it("plafonne le remboursement au prix HT + 20 %, et refuse un montant hors Int32", () => {
    expect(plafondRemboursementCents(447_000)).toBe(536_400);
    expect(eurosEnCentimes("9999999999")).toBeNull();
    expect(eurosEnCentimes("1234,56")).toBe(123456);
  });
});

describe("repartirRemboursement : le solde d'abord, puis l'acompte", () => {
  // Devis 1 490 € HT : acompte 447 € HT (536,40 € TTC), solde 1 043 € HT (1 251,60 € TTC).
  const f = [
    { id: "AC", numero: "ACOMPTE", capaciteTtcCents: 53_640 },
    { id: "SO", numero: "SOLDE", capaciteTtcCents: 125_160 },
  ];
  const parts = (m: number) => {
    const r = repartirRemboursement(f, m);
    if (!r.ok) throw new Error(r.message);
    return r.parts.map((p) => [p.id, p.ttcCents]);
  };
  it("remboursement TOTAL : un avoir par facture, somme exacte", () => {
    expect(parts(178_800)).toEqual([
      ["SO", 125_160],
      ["AC", 53_640],
    ]);
  });
  it("partiel qui tient dans le solde : ne touche que le solde", () => {
    expect(parts(100_000)).toEqual([["SO", 100_000]]);
    expect(parts(125_160)).toEqual([["SO", 125_160]]);
  });
  it("partiel qui déborde : solde soldé, le reste sur l'acompte", () => {
    expect(parts(125_161)).toEqual([
      ["SO", 125_160],
      ["AC", 1],
    ]);
    expect(parts(150_000)).toEqual([
      ["SO", 125_160],
      ["AC", 24_840],
    ]);
  });
  it("montant > total payé : refus (jamais écrêté), montant nul ou non entier : refus", () => {
    expect(repartirRemboursement(f, 178_801)).toMatchObject({ ok: false });
    expect(repartirRemboursement(f, 0)).toMatchObject({ ok: false });
    expect(repartirRemboursement(f, 10.5)).toMatchObject({ ok: false });
  });
  it("facture sans capacité (acompte non payé ou déjà avoirée) : sautée", () => {
    const sansAcompte = [{ ...f[0]!, capaciteTtcCents: 0 }, f[1]!];
    const r = repartirRemboursement(sansAcompte, 125_160);
    expect(r.ok && r.parts.map((p) => p.id)).toEqual(["SO"]);
    expect(repartirRemboursement(sansAcompte, 125_161)).toMatchObject({ ok: false });
  });
  it("centimes : la somme des parts égale TOUJOURS le montant (aucun arrondi, 10 000 montants)", () => {
    for (let i = 0; i < 10_000; i++) {
      const m = 1 + ((i * 7919) % 178_800);
      const r = repartirRemboursement(f, m);
      expect(r.ok && r.parts.reduce((n, p) => n + p.ttcCents, 0)).toBe(m);
    }
  });
});

describe("repartirRemboursement : parts inatteignables au centime (TVA 20 %)", () => {
  // TTC atteignable à 20 % ⇔ pas ≡ 3 (mod 6) (sauf négation intégrale du reste).
  const ok20 = (c: number) => c % 6 !== 3;
  const f = [
    {
      id: "AC",
      numero: "AC",
      capaciteTtcCents: 36_000,
      atteignable: (c: number) => c === 36_000 || ok20(c),
    },
    {
      id: "SO",
      numero: "SO",
      capaciteTtcCents: 84_000,
      atteignable: (c: number) => c === 84_000 || ok20(c),
    },
  ];
  it("900,03 € : la part de l'acompte (60,03) est impossible → on recule le solde de 1 centime, somme exacte", () => {
    const r = repartirRemboursement(f, 90_003);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.parts.reduce((n, p) => n + p.ttcCents, 0)).toBe(90_003);
      expect(
        r.parts.every((p) => ok20(p.ttcCents) || p.ttcCents === 36_000 || p.ttcCents === 84_000),
      ).toBe(true);
    }
  });
  it("toutes les valeurs de 1 à total : somme exacte et chaque part atteignable", () => {
    for (let m = 1; m <= 120_000; m += 7) {
      const r = repartirRemboursement(f, m);
      if (!r.ok) continue;
      expect(r.parts.reduce((n, p) => n + p.ttcCents, 0)).toBe(m);
      for (const p of r.parts)
        expect(f.find((x) => x.id === p.id)!.atteignable(p.ttcCents)).toBe(true);
    }
  });
  it("aucune répartition possible : le message propose des TOTAUX voisins, pas la part d'une facture", () => {
    const seule = [{ id: "SO", numero: "SO", capaciteTtcCents: 40_000, atteignable: ok20 }];
    const r = repartirRemboursement(seule, 10_005);
    expect(r).toMatchObject({ ok: false });
    expect(!r.ok && r.message).toMatch(/total TTC/);
    expect(!r.ok && r.message).toMatch(/100,04|100,06/);
  });
});
