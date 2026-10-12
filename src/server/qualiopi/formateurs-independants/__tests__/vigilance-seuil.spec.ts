/**
 * Lot G1 — l'attestation de vigilance URSSAF d'un formateur indépendant est demandée
 * À L'APPROCHE du seuil, exigée AU SEUIL, comme pour les apporteurs (décision du 12/10).
 *
 * Contre-calcul chiffré sur cinq cas : sous le seuil, à l'approche, pile au seuil,
 * au-dessus sans attestation, au-dessus avec attestation échue.
 */

import { describe, expect, it } from "vitest";

import {
  APPROCHE_VIGILANCE_CENTS as APPROCHE_APPORTEURS,
  SEUIL_VIGILANCE_CENTS as SEUIL_APPORTEURS,
  etatVigilance as etatVigilanceApporteur,
} from "@/features/apporteurs-reseau/regles";
import { APPROCHE_VIGILANCE_CENTS, SEUIL_VIGILANCE_CENTS } from "@/lib/vigilance";
import { CONFORMITE_DEFAUTS } from "@/server/qualiopi/trainers/conformite";

import { gardeVirementMission, type ContexteVirementMission } from "../paiement/virement-mission";
import {
  STATUTS_RELEVE_CUMUL,
  cumulDesReleves,
  etatVigilanceFormateur,
  phaseVigilanceFormateur,
  vigilanceExigible,
} from "../vigilance-seuil";

const r = (totalHtCents: number, statut: string = "paye") => ({ statut, totalHtCents });

describe("un seul seuil, une seule approche — ceux des apporteurs", () => {
  it("la constante commune est celle des apporteurs et de la conformité (aucun nombre recopié)", () => {
    expect(SEUIL_VIGILANCE_CENTS).toBe(500_000);
    expect(APPROCHE_VIGILANCE_CENTS).toBe(400_000);
    expect(SEUIL_APPORTEURS).toBe(SEUIL_VIGILANCE_CENTS);
    expect(APPROCHE_APPORTEURS).toBe(APPROCHE_VIGILANCE_CENTS);
    expect(CONFORMITE_DEFAUTS.seuilVigilanceCents).toBe(SEUIL_VIGILANCE_CENTS);
  });

  it("la règle des apporteurs est inchangée (mêmes réponses qu'avant)", () => {
    expect(
      etatVigilanceApporteur({ cumulCents: 399_999, nouvelleCents: 0, piecesValides: false }),
    ).toEqual({ demander: false, attendre: false });
    expect(
      etatVigilanceApporteur({ cumulCents: 300_000, nouvelleCents: 100_000, piecesValides: false }),
    ).toEqual({ demander: true, attendre: false });
    expect(
      etatVigilanceApporteur({ cumulCents: 450_000, nouvelleCents: 50_000, piecesValides: false }),
    ).toEqual({ demander: true, attendre: true });
    expect(
      etatVigilanceApporteur({ cumulCents: 900_000, nouvelleCents: 0, piecesValides: true }),
    ).toEqual({ demander: false, attendre: false });
  });
});

describe("le cumul HT des honoraires", () => {
  it("compte les relevés facturés (validé, facture reçue, payé), avoirs déduits", () => {
    expect([...STATUTS_RELEVE_CUMUL]).toEqual(["valide", "facture_recue", "paye"]);
    expect(
      cumulDesReleves([
        r(150_000, "paye"),
        r(120_000, "facture_recue"),
        r(80_000, "valide"),
        r(-30_000, "paye"), // avoir
        r(999_999, "brouillon"),
        r(999_999, "a_valider"),
        r(999_999, "annule"),
      ]),
    ).toBe(320_000);
  });

  it("une valeur illisible n'abaisse jamais le cumul", () => {
    expect(cumulDesReleves([r(Number.NaN), r(100_000)])).toBe(100_000);
  });
});

describe("la phase et l'exigence", () => {
  it("garde FERMÉE : cumul illisible = seuil atteint", () => {
    expect(phaseVigilanceFormateur(null)).toBe("seuil_atteint");
    expect(phaseVigilanceFormateur(undefined)).toBe("seuil_atteint");
    expect(phaseVigilanceFormateur(Number.NaN)).toBe("seuil_atteint");
    expect(vigilanceExigible(null)).toBe(true);
  });

  it("les bornes sont incluses (≥), comme chez les apporteurs", () => {
    expect(phaseVigilanceFormateur(399_999)).toBe("sous_le_seuil");
    expect(phaseVigilanceFormateur(400_000)).toBe("approche");
    expect(phaseVigilanceFormateur(499_999)).toBe("approche");
    expect(phaseVigilanceFormateur(500_000)).toBe("seuil_atteint");
    expect(vigilanceExigible(499_999)).toBe(false);
    expect(vigilanceExigible(500_000)).toBe(true);
  });
});

/**
 * Contre-calcul. Chaque cas : les relevés, le cumul attendu à la main, ce qui doit se passer.
 * Mission de juillet 2026 (dernière journée le 31/07), virement le 15/08.
 */
const base: ContexteVirementMission = {
  derniereJournee: "2026-07-31",
  echeance: "2026-08-30",
  aujourdhui: "2026-08-15",
  maintenant: new Date("2026-08-15T10:00:00Z"),
  totalTtcCents: 0,
  attestationsValidesJusquau: [],
  demandeIbanEnAttente: false,
  dernierChangementIban: null,
  ibanEmpreinteActuelle: "a".repeat(64),
  ibanEmpreinteAffichee: "a".repeat(64),
  finPourDeces: false,
};

const CAS = [
  {
    nom: "1. sous le seuil",
    releves: [r(120_000), r(90_000), r(60_000, "facture_recue")],
    // 1 200 + 900 + 600 = 2 700 € HT
    cumul: 270_000,
    attestations: [] as string[],
    attendu: { phase: "sous_le_seuil", demander: false, attendre: false },
  },
  {
    nom: "2. à l'approche",
    releves: [r(150_000), r(150_000), r(120_000, "facture_recue")],
    // 1 500 + 1 500 + 1 200 = 4 200 € HT
    cumul: 420_000,
    attestations: [],
    attendu: { phase: "approche", demander: true, attendre: false },
  },
  {
    nom: "3. pile au seuil",
    releves: [r(200_000), r(150_000), r(150_000, "facture_recue")],
    // 2 000 + 1 500 + 1 500 = 5 000 € HT
    cumul: 500_000,
    attestations: [],
    attendu: { phase: "seuil_atteint", demander: true, attendre: true },
  },
  {
    nom: "4. au-dessus, sans attestation",
    releves: [r(300_000), r(250_000), r(-50_000), r(180_000, "facture_recue")],
    // 3 000 + 2 500 − 500 (avoir) + 1 800 = 6 800 € HT
    cumul: 680_000,
    attestations: [],
    attendu: { phase: "seuil_atteint", demander: true, attendre: true },
  },
  {
    nom: "5. au-dessus, attestation échue à la date de la mission",
    releves: [r(400_000), r(300_000), r(150_000, "facture_recue")],
    // 4 000 + 3 000 + 1 500 = 8 500 € HT ; attestation valable jusqu'au 30/06
    cumul: 850_000,
    attestations: ["2026-06-30"],
    attendu: { phase: "seuil_atteint", demander: true, attendre: true },
  },
] as const;

describe("contre-calcul sur cinq cas", () => {
  for (const c of CAS) {
    it(c.nom, () => {
      const cumul = cumulDesReleves(c.releves);
      expect(cumul).toBe(c.cumul);
      expect(phaseVigilanceFormateur(cumul)).toBe(c.attendu.phase);
      const attestationValide = c.attestations.some((fin) => fin >= base.derniereJournee);
      const e = etatVigilanceFormateur({ cumulHtCents: cumul, attestationValide });
      expect({ demander: e.demander, attendre: e.attendre }).toEqual({
        demander: c.attendu.demander,
        attendre: c.attendu.attendre,
      });
      const v = gardeVirementMission({
        ...base,
        attestationsValidesJusquau: c.attestations,
        vigilanceExigible: vigilanceExigible(cumul),
      });
      expect(v.motifs.includes("attestation_urssaf_echue_a_la_mission")).toBe(c.attendu.attendre);
      expect(v.autorise).toBe(!c.attendu.attendre);
    });
  }

  it("au-dessus avec une attestation valable : rien n'attend", () => {
    const cumul = 850_000;
    expect(etatVigilanceFormateur({ cumulHtCents: cumul, attestationValide: true })).toEqual({
      phase: "seuil_atteint",
      exigible: true,
      demander: false,
      attendre: false,
    });
    expect(
      gardeVirementMission({
        ...base,
        attestationsValidesJusquau: ["2026-12-31"],
        vigilanceExigible: true,
      }).autorise,
    ).toBe(true);
  });

  it("sans l'information du seuil, la garde du virement reste celle d'avant (exigée)", () => {
    expect(gardeVirementMission(base).motifs).toEqual(["attestation_urssaf_echue_a_la_mission"]);
  });
});
