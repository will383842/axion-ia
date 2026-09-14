/**
 * Tests de rendu — 6 templates email Qualiopi (T15).
 *
 * Stratégie : renderEmailTemplate → html non vide, subject non vide.
 * Aucune dépendance DB (templates React Email purs).
 */

import { describe, it, expect } from "vitest";
import { renderEmailTemplate } from "./index";

// Payloads minimaux par template
const FAKE_TOKEN = "a".repeat(64);

const PAYLOADS: Record<string, Record<string, unknown>> = {
  "qualiopi-convocation": {
    stagiairePrenomNom: "Jean Dupont",
    titreFormation: "Formation IA Opérationnelle",
    dateDebut: "01/09/2026",
    dateFin: "02/09/2026",
    lieu: "Paris",
    modalite: "presentiel",
    numeroSession: "AXI-SESS-2026-001",
    lienPortail: `https://axion-ia.com/fr/portail/acces/${FAKE_TOKEN}`,
  },
  "qualiopi-rappel-j7": {
    stagiairePrenomNom: "Marie Martin",
    titreFormation: "IA pour Managers",
    dateDebut: "15/09/2026",
    dateFin: "16/09/2026",
    lieu: "Lyon",
    modalite: "distanciel",
    numeroSession: "AXI-SESS-2026-002",
    lienPortail: `https://axion-ia.com/fr/portail/acces/${FAKE_TOKEN}`,
  },
  "qualiopi-satisfaction-j1": {
    stagiairePrenomNom: "Paul Durand",
    titreFormation: "Automatisation IA",
    dateFinFormation: "10/09/2026",
    lienQuestionnaire: `https://axion-ia.com/fr/portail/acces/${FAKE_TOKEN}`,
    numeroSession: "AXI-SESS-2026-003",
  },
  "qualiopi-suivi-j30": {
    stagiairePrenomNom: "Sophie Bernard",
    titreFormation: "IA pour RH",
    dateFinFormation: "05/08/2026",
    lienPortail: `https://axion-ia.com/fr/portail/acces/${FAKE_TOKEN}`,
    numeroSession: "AXI-SESS-2026-004",
  },
  "qualiopi-attestation-disponible": {
    stagiairePrenomNom: "Luc Moreau",
    titreFormation: "IA pour Dirigeants",
    typeDocument: "attestation de formation",
    lienPortail: `https://axion-ia.com/fr/portail/acces/${FAKE_TOKEN}`,
    numeroSession: "AXI-SESS-2026-005",
  },
  "qualiopi-alerte-interne": {
    niveau: "critique",
    code: "emargement_manquant",
    titre: "Émargement manquant",
    message: "La session AXI-SESS-2026-006 n'a pas d'émargement 48h après réalisation.",
    cibleType: "TrainingSession",
    cibleId: "00000000-0000-0000-0000-000000000001",
    createdAt: "06/06/2026",
  },
};

const TEMPLATES = [
  "qualiopi-convocation",
  "qualiopi-rappel-j7",
  "qualiopi-satisfaction-j1",
  "qualiopi-suivi-j30",
  "qualiopi-attestation-disponible",
  "qualiopi-alerte-interne",
] as const;

describe("Qualiopi email templates — rendu HTML", () => {
  for (const name of TEMPLATES) {
    it(`${name} : rendu HTML non vide + subject non vide`, async () => {
      const payload = PAYLOADS[name] ?? {};
      const result = await renderEmailTemplate(name, "fr", payload);

      expect(result.html, `html vide pour ${name}`).toBeTruthy();
      expect(result.html.length, `html trop court pour ${name}`).toBeGreaterThan(50);
      expect(result.subject, `subject vide pour ${name}`).toBeTruthy();
      expect(result.subject.length, `subject trop court pour ${name}`).toBeGreaterThan(5);
      expect(result.text, `text vide pour ${name}`).toBeTruthy();
    });
  }
});

describe("Qualiopi email templates — subject contient le nom de formation", () => {
  it("qualiopi-convocation : subject inclut le titre", async () => {
    const result = await renderEmailTemplate(
      "qualiopi-convocation",
      "fr",
      PAYLOADS["qualiopi-convocation"] ?? {},
    );
    expect(result.subject).toContain("Formation IA Opérationnelle");
  });

  it("qualiopi-alerte-interne : subject inclut le niveau [CRITIQUE]", async () => {
    const result = await renderEmailTemplate(
      "qualiopi-alerte-interne",
      "fr",
      PAYLOADS["qualiopi-alerte-interne"] ?? {},
    );
    expect(result.subject).toContain("[CRITIQUE]");
  });
});

describe("🔴 qualiopi-attestation-disponible — exclu ou abandon", () => {
  // 2e relecture A09 (audit initial 2026-09-14) : « atteste de votre
  // participation » et la demande d'avis partaient aussi à un stagiaire exclu.
  it("annonce l'attestation des heures suivies, sans « participation » ni demande d'avis", async () => {
    const result = await renderEmailTemplate("qualiopi-attestation-disponible", "fr", {
      ...PAYLOADS["qualiopi-attestation-disponible"],
      typeDocument: "attestation de formation partielle",
      heuresSuiviesSeulement: true,
      questionnaireEnAttente: true,
    });
    expect(result.html).toContain("attestation des heures suivies");
    expect(result.html).not.toContain("atteste de votre participation");
    expect(result.html).not.toContain("atteste votre participation");
    expect(result.html).not.toContain("Déposer un avis");
    expect(result.html).not.toContain("un questionnaire vous attend");
  });

  it("contre-témoin : l'e-mail ordinaire garde sa formulation", async () => {
    const result = await renderEmailTemplate(
      "qualiopi-attestation-disponible",
      "fr",
      PAYLOADS["qualiopi-attestation-disponible"] ?? {},
    );
    expect(result.html).toContain("atteste de votre participation");
  });
});

describe("Qualiopi email templates — liens portail tokenisés", () => {
  const PORTAIL_TEMPLATES = [
    "qualiopi-convocation",
    "qualiopi-rappel-j7",
    "qualiopi-suivi-j30",
    "qualiopi-attestation-disponible",
  ] as const;

  for (const name of PORTAIL_TEMPLATES) {
    it(`${name} : lien contient /portail/acces/ (pas /espace-stagiaire)`, async () => {
      const result = await renderEmailTemplate(name, "fr", PAYLOADS[name] ?? {});
      expect(result.html).toContain("/portail/acces/");
      expect(result.html).not.toContain("/espace-stagiaire");
    });
  }

  it("qualiopi-satisfaction-j1 : lienQuestionnaire contient /portail/acces/ (pas /espace-stagiaire)", async () => {
    const result = await renderEmailTemplate(
      "qualiopi-satisfaction-j1",
      "fr",
      PAYLOADS["qualiopi-satisfaction-j1"] ?? {},
    );
    expect(result.html).toContain("/portail/acces/");
    expect(result.html).not.toContain("/espace-stagiaire");
  });

  it("fallback qualiopi-convocation sans lienPortail → /portail/mon-espace (pas /espace-stagiaire)", async () => {
    const payloadSansLien = { ...PAYLOADS["qualiopi-convocation"] };
    delete payloadSansLien["lienPortail"];
    const result = await renderEmailTemplate("qualiopi-convocation", "fr", payloadSansLien);
    expect(result.html).toContain("/portail/mon-espace");
    expect(result.html).not.toContain("/espace-stagiaire");
  });
});
