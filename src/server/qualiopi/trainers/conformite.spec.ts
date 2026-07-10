/**
 * Tests — conformite.ts (conformité documentaire d'un formateur).
 *
 * Enjeux réels : responsabilité solidaire URSSAF (art. L.8222-1), Qualiopi
 * off.21/27. On vérifie surtout qu'on ne déclare JAMAIS « conforme » à tort,
 * et qu'une règle non tranchée par un juriste alerte au lieu de bloquer.
 */

import { describe, it, expect } from "vitest";
import {
  addMonths,
  estPerime,
  estValide,
  evaluerConformiteFormateur,
  vigilancePerimee,
  vigilanceRequise,
  CONFORMITE_DEFAUTS,
  type DocumentConformite,
  type TrainerDocumentTypeValue,
} from "./conformite";

const NOW = new Date("2026-07-09T12:00:00Z");

function doc(
  type: TrainerDocumentTypeValue,
  over: Partial<DocumentConformite> = {},
): DocumentConformite {
  return {
    type,
    statutValidation: "valide",
    dateEmission: new Date("2026-06-01T00:00:00Z"),
    dateExpiration: null,
    ...over,
  };
}

/** Dossier complet d'un indépendant, sans aucun manquement bloquant. */
function dossierSousTraitantComplet(): DocumentConformite[] {
  return [
    doc("nda_sous_traitant"),
    doc("kbis_avis_sirene"),
    doc("contrat_sous_traitance"),
    doc("assurance_rc_pro", { dateExpiration: new Date("2027-01-01T00:00:00Z") }),
    doc("attestation_vigilance_urssaf"),
    doc("cv"),
  ];
}

describe("addMonths", () => {
  it("ajoute des mois en arithmétique calendaire", () => {
    expect(addMonths(new Date("2026-01-31T00:00:00Z"), 1).toISOString()).toBe(
      "2026-03-03T00:00:00.000Z", // 31 janv + 1 mois → 31 févr → 3 mars (2026 non bissextile)
    );
    expect(addMonths(new Date("2026-06-01T00:00:00Z"), 6).toISOString()).toBe(
      "2026-12-01T00:00:00.000Z",
    );
  });
});

describe("estValide / estPerime", () => {
  it("une pièce non validée n'est jamais valide", () => {
    expect(estValide(doc("cv", { statutValidation: "en_attente" }), NOW)).toBe(false);
    expect(estValide(doc("cv", { statutValidation: "rejete" }), NOW)).toBe(false);
  });

  it("une pièce validée sans date d'expiration n'expire pas", () => {
    expect(estValide(doc("diplome"), NOW)).toBe(true);
    expect(estPerime(doc("diplome"), NOW)).toBe(false);
  });

  it("une pièce validée dont la date d'expiration est passée est périmée", () => {
    const perime = doc("assurance_rc_pro", { dateExpiration: new Date("2026-01-01T00:00:00Z") });
    expect(estValide(perime, NOW)).toBe(false);
    expect(estPerime(perime, NOW)).toBe(true);
  });

  it("une pièce rejetée n'est pas « périmée », elle est invalide", () => {
    const rejete = doc("assurance_rc_pro", {
      statutValidation: "rejete",
      dateExpiration: new Date("2026-01-01T00:00:00Z"),
    });
    expect(estPerime(rejete, NOW)).toBe(false);
  });
});

describe("vigilanceRequise — le seuil des 5 000 €", () => {
  it("jamais requise pour un salarié, même à 100 000 €", () => {
    expect(vigilanceRequise("salarie", 10_000_000)).toBe(false);
  });

  it("requise pour un indépendant AU seuil exact", () => {
    expect(vigilanceRequise("sous_traitant", 500_000)).toBe(true);
  });

  it("non requise juste en dessous du seuil", () => {
    expect(vigilanceRequise("sous_traitant", 499_999)).toBe(false);
  });

  it("le seuil est paramétrable (lecture juriste alternative)", () => {
    const config = { ...CONFORMITE_DEFAUTS, seuilVigilanceCents: 100_000 };
    expect(vigilanceRequise("sous_traitant", 150_000, config)).toBe(true);
  });
});

describe("vigilancePerimee — validité de 6 mois", () => {
  it("absente → traitée comme périmée", () => {
    expect(vigilancePerimee(null, NOW)).toBe(true);
  });

  it("sans date d'émission → non probante", () => {
    expect(vigilancePerimee(doc("attestation_vigilance_urssaf", { dateEmission: null }), NOW)).toBe(
      true,
    );
  });

  it("émise il y a 1 mois → valable", () => {
    const d = doc("attestation_vigilance_urssaf", {
      dateEmission: new Date("2026-06-09T12:00:00Z"),
    });
    expect(vigilancePerimee(d, NOW)).toBe(false);
  });

  it("émise il y a exactement 6 mois → périmée (borne incluse)", () => {
    const d = doc("attestation_vigilance_urssaf", {
      dateEmission: new Date("2026-01-09T12:00:00Z"),
    });
    expect(vigilancePerimee(d, NOW)).toBe(true);
  });

  it("émise il y a 7 mois → périmée", () => {
    const d = doc("attestation_vigilance_urssaf", {
      dateEmission: new Date("2025-12-09T12:00:00Z"),
    });
    expect(vigilancePerimee(d, NOW)).toBe(true);
  });
});

describe("evaluerConformiteFormateur — salarié", () => {
  it("contrat de travail valide + CV récent → conforme, aucun manquement", () => {
    const r = evaluerConformiteFormateur(
      { statut: "salarie", documents: [doc("contrat_travail"), doc("cv")], montantRetenuCents: 0 },
      NOW,
    );
    expect(r.conforme).toBe(true);
    expect(r.manquements).toEqual([]);
  });

  it("sans contrat de travail → BLOQUANT", () => {
    const r = evaluerConformiteFormateur(
      { statut: "salarie", documents: [doc("cv")], montantRetenuCents: 0 },
      NOW,
    );
    expect(r.conforme).toBe(false);
    expect(r.manquements[0]?.code).toBe("contrat_travail_absent");
    expect(r.manquements[0]?.gravite).toBe("bloquant");
  });

  it("n'exige JAMAIS de vigilance URSSAF ni de RC pro à un salarié", () => {
    const r = evaluerConformiteFormateur(
      {
        statut: "salarie",
        documents: [doc("contrat_travail"), doc("cv")],
        montantRetenuCents: 10_000_000,
      },
      NOW,
    );
    expect(r.manquements.map((m) => m.type)).not.toContain("attestation_vigilance_urssaf");
    expect(r.manquements.map((m) => m.type)).not.toContain("assurance_rc_pro");
  });

  it("contrat périmé → message « périmé », pas « absent »", () => {
    const r = evaluerConformiteFormateur(
      {
        statut: "salarie",
        documents: [
          doc("contrat_travail", { dateExpiration: new Date("2026-01-01T00:00:00Z") }),
          doc("cv"),
        ],
        montantRetenuCents: 0,
      },
      NOW,
    );
    expect(r.manquements[0]?.code).toBe("contrat_travail_perime");
  });
});

describe("evaluerConformiteFormateur — indépendant", () => {
  it("dossier complet sous le seuil → conforme, aucun manquement", () => {
    const r = evaluerConformiteFormateur(
      { statut: "sous_traitant", documents: dossierSousTraitantComplet(), montantRetenuCents: 0 },
      NOW,
    );
    expect(r.conforme).toBe(true);
    expect(r.manquements).toEqual([]);
  });

  it("NDA, Kbis et contrat de sous-traitance sont BLOQUANTS", () => {
    const r = evaluerConformiteFormateur(
      { statut: "sous_traitant", documents: [doc("cv")], montantRetenuCents: 0 },
      NOW,
    );
    expect(r.conforme).toBe(false);
    const bloquants = r.manquements.filter((m) => m.gravite === "bloquant").map((m) => m.type);
    expect(bloquants).toEqual(["nda_sous_traitant", "kbis_avis_sirene", "contrat_sous_traitance"]);
  });

  it("au-dessus du seuil sans vigilance → ALERTE (pas bloquant) par défaut", () => {
    const docs = dossierSousTraitantComplet().filter(
      (d) => d.type !== "attestation_vigilance_urssaf",
    );
    const r = evaluerConformiteFormateur(
      { statut: "sous_traitant", documents: docs, montantRetenuCents: 600_000 },
      NOW,
    );
    const m = r.manquements.find((x) => x.code === "vigilance_urssaf_absente");
    expect(m?.gravite).toBe("alerte");
    expect(m?.message).toContain("solidairement responsable");
    // Une règle non tranchée par un juriste n'empêche pas d'affecter.
    expect(r.conforme).toBe(true);
  });

  it("au-dessus du seuil sans vigilance, en mode bloquant → non conforme", () => {
    const docs = dossierSousTraitantComplet().filter(
      (d) => d.type !== "attestation_vigilance_urssaf",
    );
    const r = evaluerConformiteFormateur(
      {
        statut: "sous_traitant",
        documents: docs,
        montantRetenuCents: 600_000,
        config: { ...CONFORMITE_DEFAUTS, vigilanceBloquante: true },
      },
      NOW,
    );
    expect(r.conforme).toBe(false);
  });

  it("SOUS le seuil, l'absence de vigilance n'est même pas signalée", () => {
    const docs = dossierSousTraitantComplet().filter(
      (d) => d.type !== "attestation_vigilance_urssaf",
    );
    const r = evaluerConformiteFormateur(
      { statut: "sous_traitant", documents: docs, montantRetenuCents: 100_000 },
      NOW,
    );
    expect(r.manquements.map((m) => m.type)).not.toContain("attestation_vigilance_urssaf");
  });

  it("vigilance de plus de 6 mois au-dessus du seuil → alerte « à renouveler »", () => {
    const docs = dossierSousTraitantComplet().map((d) =>
      d.type === "attestation_vigilance_urssaf"
        ? { ...d, dateEmission: new Date("2025-12-01T00:00:00Z") }
        : d,
    );
    const r = evaluerConformiteFormateur(
      { statut: "sous_traitant", documents: docs, montantRetenuCents: 600_000 },
      NOW,
    );
    const m = r.manquements.find((x) => x.code === "vigilance_urssaf_perimee");
    expect(m?.message).toContain("à renouveler");
  });

  it("RC pro absente → alerte par défaut, bloquante si configuré", () => {
    const docs = dossierSousTraitantComplet().filter((d) => d.type !== "assurance_rc_pro");
    const parDefaut = evaluerConformiteFormateur(
      { statut: "sous_traitant", documents: docs, montantRetenuCents: 0 },
      NOW,
    );
    expect(parDefaut.manquements.find((m) => m.code === "rc_pro_absente")?.gravite).toBe("alerte");
    expect(parDefaut.conforme).toBe(true);

    const strict = evaluerConformiteFormateur(
      {
        statut: "sous_traitant",
        documents: docs,
        montantRetenuCents: 0,
        config: { ...CONFORMITE_DEFAUTS, rcProBloquante: true },
      },
      NOW,
    );
    expect(strict.conforme).toBe(false);
  });
});

describe("evaluerConformiteFormateur — CV (Qualiopi off.21)", () => {
  it("CV de plus de 12 mois → alerte, jamais bloquant", () => {
    const r = evaluerConformiteFormateur(
      {
        statut: "salarie",
        documents: [doc("contrat_travail"), doc("cv", { dateEmission: new Date("2025-01-01") })],
        montantRetenuCents: 0,
      },
      NOW,
    );
    const m = r.manquements.find((x) => x.code === "cv_obsolete");
    expect(m?.gravite).toBe("alerte");
    expect(r.conforme).toBe(true);
  });

  it("CV absent → alerte", () => {
    const r = evaluerConformiteFormateur(
      { statut: "salarie", documents: [doc("contrat_travail")], montantRetenuCents: 0 },
      NOW,
    );
    expect(r.manquements.find((x) => x.code === "cv_absent")?.gravite).toBe("alerte");
  });
});
