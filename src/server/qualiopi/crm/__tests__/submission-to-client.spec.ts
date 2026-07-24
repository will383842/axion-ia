/**
 * Tests — mapping Submission → pré-remplissage Client (pur, sans DB).
 */

import { describe, it, expect } from "vitest";

import {
  buildClientPrefillFromSubmission,
  mapEmployeesCountToTaille,
} from "../submission-to-client";

describe("mapEmployeesCountToTaille", () => {
  it("mappe les tailles INSEE du formulaire unifié", () => {
    expect(mapEmployeesCountToTaille("tpe")).toBe("TPE");
    expect(mapEmployeesCountToTaille("pme")).toBe("PME");
    expect(mapEmployeesCountToTaille("eti")).toBe("ETI");
    expect(mapEmployeesCountToTaille("grande_entreprise")).toBe("GRANDE_ENTREPRISE");
  });

  it("tolère casse et variantes", () => {
    expect(mapEmployeesCountToTaille(" PME ")).toBe("PME");
    expect(mapEmployeesCountToTaille("grande-entreprise")).toBe("GRANDE_ENTREPRISE");
    expect(mapEmployeesCountToTaille("GE")).toBe("GRANDE_ENTREPRISE");
  });

  it("laisse vide une valeur libre héritée ou absente", () => {
    expect(mapEmployeesCountToTaille("10-50")).toBe("");
    expect(mapEmployeesCountToTaille(null)).toBe("");
    expect(mapEmployeesCountToTaille(undefined)).toBe("");
    expect(mapEmployeesCountToTaille("")).toBe("");
  });
});

describe("buildClientPrefillFromSubmission", () => {
  it("mappe une demande entreprise complète", () => {
    const p = buildClientPrefillFromSubmission({
      id: "sub-1",
      companyName: "Innovatech SAS",
      contactName: "Marie Martin",
      contactEmail: "marie@innovatech.fr",
      contactPhone: "+33612345678",
      contactRole: "DRH",
      sector: "Édition logicielle",
      employeesCount: "pme",
      address: "12 rue de la Paix, Lyon",
      details: { ville: "Lyon", message: "Nous cherchons une formation IA." },
    });
    expect(p.type).toBe("entreprise");
    expect(p.raisonSociale).toBe("Innovatech SAS");
    expect(p.contactNom).toBe("Marie Martin");
    expect(p.contactEmail).toBe("marie@innovatech.fr");
    expect(p.contactTelephone).toBe("+33612345678");
    expect(p.contactFonction).toBe("DRH");
    expect(p.secteur).toBe("Édition logicielle");
    expect(p.adresse).toBe("12 rue de la Paix, Lyon");
    expect(p.taille).toBe("PME");
    expect(p.contexteIa).toBe("Nous cherchons une formation IA.");
    expect(p.source).toBe("submission:sub-1");
  });

  it("traite le placeholder « — » comme une société absente → particulier", () => {
    const p = buildClientPrefillFromSubmission({
      id: "sub-2",
      companyName: "—",
      contactName: "Jean Dupont",
      contactEmail: "jean@perso.fr",
    });
    expect(p.type).toBe("particulier");
    expect(p.raisonSociale).toBe("Jean Dupont");
    // Pas de taille pour un particulier, même si employeesCount était fourni.
    expect(p.taille).toBe("");
  });

  it("bascule en particulier quand la société est vide", () => {
    const p = buildClientPrefillFromSubmission({
      id: "sub-3",
      companyName: "",
      contactName: "Alice",
      employeesCount: "pme",
    });
    expect(p.type).toBe("particulier");
    expect(p.raisonSociale).toBe("Alice");
    expect(p.taille).toBe("");
  });

  it("replie sur la ville quand l'adresse manque", () => {
    const p = buildClientPrefillFromSubmission({
      id: "sub-4",
      companyName: "Acme",
      details: { ville: "Grenoble" },
    });
    expect(p.adresse).toBe("Grenoble");
  });

  it("ne laisse jamais fuiter un champ manquant (chaînes vides, pas undefined)", () => {
    const p = buildClientPrefillFromSubmission({ id: "sub-5" });
    expect(p.raisonSociale).toBe("");
    expect(p.contactEmail).toBe("");
    expect(p.contactTelephone).toBe("");
    expect(p.secteur).toBe("");
    expect(p.contexteIa).toBe("");
    expect(p.source).toBe("submission:sub-5");
  });

  it("ignore un details non-objet sans planter", () => {
    expect(() =>
      buildClientPrefillFromSubmission({ id: "s", details: "pas un objet" }),
    ).not.toThrow();
    expect(() => buildClientPrefillFromSubmission({ id: "s", details: ["array"] })).not.toThrow();
  });
});
