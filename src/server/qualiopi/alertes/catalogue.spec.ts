/**
 * Tests — alertes/catalogue.ts (T15 AGENT A).
 *
 * Vérifie : exhaustivité du catalogue (27 codes), cohérence niveau/resolutionAuto,
 * niveauFromSpec (mapping spec→enum), types corrects.
 * Module PUR : aucun mock requis.
 */

import { describe, it, expect } from "vitest";
import { ALERTE_CATALOGUE, niveauFromSpec } from "./catalogue";
import type { AlerteNiveau } from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Codes attendus (SPEC_PART2 §6.5 + CONTRAT-T15.md)
// ─────────────────────────────────────────────────────────────────────────────

const CODES_ATTENDUS: string[] = [
  "referent_handicap_absent",
  "responsable_qualite_absent",
  "emargement_manquant",
  "session_sans_formateur",
  "satisfaction_manquante",
  "evaluation_acquis_manquante",
  "attestation_non_envoyee",
  "satisfaction_sous_seuil",
  "reclamation_sans_reponse_j15",
  "qualiopi_expire_j90",
  "qualiopi_expire_j30",
  "qualiopi_expire",
  "bpf_a_deposer_j60",
  "bpf_a_deposer_j30",
  "bpf_a_deposer_j7",
  "bpf_en_retard",
  "veille_inactive_j45",
  "cv_formateur_perime",
  "sous_traitant_qualiopi_expire_j60",
  "sous_traitant_qualiopi_expire",
  "opco_sans_accord",
  "opco_formation_demarree_sans_accord",
  "convention_tripartite_manquante",
  "convention_formation_manquante",
  "facture_impayee_j30",
  "facture_impayee_j60",
  "job_ia_echoue",
  "suppression_rgpd_j30",
];

const NIVEAUX_VALIDES: AlerteNiveau[] = ["info", "important", "critique"];

// ─────────────────────────────────────────────────────────────────────────────
// Tests catalogue
// ─────────────────────────────────────────────────────────────────────────────

describe("ALERTE_CATALOGUE", () => {
  it("contient exactement les 27 codes attendus", () => {
    const codesPresents = Object.keys(ALERTE_CATALOGUE).sort();
    const codesAttendus = [...CODES_ATTENDUS].sort();
    expect(codesPresents).toEqual(codesAttendus);
  });

  it("chaque entrée a un niveau valide", () => {
    for (const [code, entry] of Object.entries(ALERTE_CATALOGUE)) {
      expect(NIVEAUX_VALIDES, `${code} niveau invalide`).toContain(entry.niveau);
    }
  });

  it("chaque entrée a un titre non-vide", () => {
    for (const [code, entry] of Object.entries(ALERTE_CATALOGUE)) {
      expect(entry.titre, `${code} titre vide`).toBeTruthy();
      expect(entry.titre.length, `${code} titre trop court`).toBeGreaterThan(3);
    }
  });

  it("resolutionAuto est un booléen pour chaque entrée", () => {
    for (const [code, entry] of Object.entries(ALERTE_CATALOGUE)) {
      expect(typeof entry.resolutionAuto, `${code} resolutionAuto n'est pas un booléen`).toBe(
        "boolean",
      );
    }
  });

  // Vérifications niveau SPEC §6.5
  it("referent_handicap_absent est critique", () => {
    expect(ALERTE_CATALOGUE["referent_handicap_absent"]?.niveau).toBe("critique");
  });

  it("emargement_manquant est critique", () => {
    expect(ALERTE_CATALOGUE["emargement_manquant"]?.niveau).toBe("critique");
  });

  it("evaluation_acquis_manquante est critique", () => {
    expect(ALERTE_CATALOGUE["evaluation_acquis_manquante"]?.niveau).toBe("critique");
  });

  it("satisfaction_manquante est important", () => {
    expect(ALERTE_CATALOGUE["satisfaction_manquante"]?.niveau).toBe("important");
  });

  it("attestation_non_envoyee est important", () => {
    expect(ALERTE_CATALOGUE["attestation_non_envoyee"]?.niveau).toBe("important");
  });

  it("reclamation_sans_reponse_j15 est critique", () => {
    expect(ALERTE_CATALOGUE["reclamation_sans_reponse_j15"]?.niveau).toBe("critique");
  });

  it("qualiopi_expire est critique", () => {
    expect(ALERTE_CATALOGUE["qualiopi_expire"]?.niveau).toBe("critique");
  });

  it("qualiopi_expire_j30 est critique", () => {
    expect(ALERTE_CATALOGUE["qualiopi_expire_j30"]?.niveau).toBe("critique");
  });

  it("qualiopi_expire_j90 est important", () => {
    expect(ALERTE_CATALOGUE["qualiopi_expire_j90"]?.niveau).toBe("important");
  });

  it("bpf_en_retard est critique", () => {
    expect(ALERTE_CATALOGUE["bpf_en_retard"]?.niveau).toBe("critique");
  });

  it("bpf_a_deposer_j60 est info", () => {
    expect(ALERTE_CATALOGUE["bpf_a_deposer_j60"]?.niveau).toBe("info");
  });

  it("suppression_rgpd_j30 est info", () => {
    expect(ALERTE_CATALOGUE["suppression_rgpd_j30"]?.niveau).toBe("info");
  });

  // Vérifications resolutionAuto SPEC §6.5
  it("referent_handicap_absent a resolutionAuto=true", () => {
    expect(ALERTE_CATALOGUE["referent_handicap_absent"]?.resolutionAuto).toBe(true);
  });

  it("emargement_manquant a resolutionAuto=true", () => {
    expect(ALERTE_CATALOGUE["emargement_manquant"]?.resolutionAuto).toBe(true);
  });

  it("reclamation_sans_reponse_j15 a resolutionAuto=true", () => {
    expect(ALERTE_CATALOGUE["reclamation_sans_reponse_j15"]?.resolutionAuto).toBe(true);
  });

  it("satisfaction_manquante a resolutionAuto=false", () => {
    expect(ALERTE_CATALOGUE["satisfaction_manquante"]?.resolutionAuto).toBe(false);
  });

  it("evaluation_acquis_manquante a resolutionAuto=false", () => {
    expect(ALERTE_CATALOGUE["evaluation_acquis_manquante"]?.resolutionAuto).toBe(false);
  });

  it("qualiopi_expire a resolutionAuto=false", () => {
    expect(ALERTE_CATALOGUE["qualiopi_expire"]?.resolutionAuto).toBe(false);
  });

  it("qualiopi_expire_j30 a resolutionAuto=true", () => {
    expect(ALERTE_CATALOGUE["qualiopi_expire_j30"]?.resolutionAuto).toBe(true);
  });

  it("bpf_a_deposer_j60 a resolutionAuto=true", () => {
    expect(ALERTE_CATALOGUE["bpf_a_deposer_j60"]?.resolutionAuto).toBe(true);
  });

  it("suppression_rgpd_j30 a resolutionAuto=false", () => {
    expect(ALERTE_CATALOGUE["suppression_rgpd_j30"]?.resolutionAuto).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests niveauFromSpec
// ─────────────────────────────────────────────────────────────────────────────

describe("niveauFromSpec", () => {
  it("CRITIQUE → critique", () => {
    expect(niveauFromSpec("CRITIQUE")).toBe("critique");
  });

  it("IMPORTANT → important", () => {
    expect(niveauFromSpec("IMPORTANT")).toBe("important");
  });

  it("INFO → info", () => {
    expect(niveauFromSpec("INFO")).toBe("info");
  });

  it("insensible à la casse", () => {
    expect(niveauFromSpec("critique")).toBe("critique");
    expect(niveauFromSpec("Critique")).toBe("critique");
    expect(niveauFromSpec("important")).toBe("important");
    expect(niveauFromSpec("Important")).toBe("important");
    expect(niveauFromSpec("info")).toBe("info");
  });

  it("valeur inconnue → info (fallback)", () => {
    expect(niveauFromSpec("INCONNU")).toBe("info");
    expect(niveauFromSpec("")).toBe("info");
    expect(niveauFromSpec("URGENT")).toBe("info");
  });
});
