/**
 * Tests de rendu — 6 templates email Qualiopi (T15).
 *
 * Stratégie : renderEmailTemplate → html non vide, subject non vide.
 * Aucune dépendance DB (templates React Email purs).
 */

import { describe, it, expect } from "vitest";
import { OBJET_MAX } from "@/lib/email/objet-email";
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

// ─────────────────────────────────────────────────────────────────────────────
// L4c — chaîne des stagiaires : lieu, objet du rappel, suivi J+30, positionnement
// ─────────────────────────────────────────────────────────────────────────────

const SANS_LIEU = ["qualiopi-convocation", "qualiopi-rappel-j7", "qualiopi-rappel-j1"] as const;

const BASE_STAGIAIRE = {
  stagiairePrenomNom: "Jean Dupont",
  titreFormation: "Formation IA Opérationnelle",
  dateDebut: "01/09/2026",
  dateFin: "02/09/2026",
  modalite: "présentiel",
  numeroSession: "AXI-SESS-2026-001",
};

describe("L4c — lieu inconnu : plus de « Voir convocation »", () => {
  for (const name of SANS_LIEU) {
    it(`${name} : clé lieu omise → aucun « Voir convocation » ni « undefined »`, async () => {
      const r = await renderEmailTemplate(name, "fr", { ...BASE_STAGIAIRE });
      expect(r.html + r.text + r.subject).not.toContain("Voir convocation");
      expect(r.html + r.text).not.toContain("undefined");
    });

    it(`${name} : ancienne charge « Voir convocation » → ligne absente`, async () => {
      const r = await renderEmailTemplate(name, "fr", {
        ...BASE_STAGIAIRE,
        lieu: "Voir convocation",
      });
      expect(r.html + r.text + r.subject).not.toContain("Voir convocation");
    });
  }

  it("qualiopi-rappel-j1 : lieu inconnu, sans visio → ni lieu ni convocation comme source du lieu", async () => {
    const r = await renderEmailTemplate("qualiopi-rappel-j1", "fr", { ...BASE_STAGIAIRE });
    const txt = r.html + r.text;
    expect(txt).not.toMatch(/convocation/i);
    expect(txt).not.toMatch(/le lieu/i);
    expect(txt).toContain("Présentez-vous quelques minutes avant l");
  });

  it("qualiopi-convocation : un vrai lieu est toujours rendu", async () => {
    const r = await renderEmailTemplate("qualiopi-convocation", "fr", {
      ...BASE_STAGIAIRE,
      lieu: "Lyon",
    });
    expect(r.text).toContain("Lyon");
  });
});

describe("L4c — rappel avant la formation : objet sans « J-7 »", () => {
  it("avec date : « Rappel : formation le <date> — <titre> », ≤ 45 caractères", async () => {
    const r = await renderEmailTemplate("qualiopi-rappel-j7", "fr", { ...BASE_STAGIAIRE });
    expect(r.subject).toContain("Rappel : formation le 01/09/2026");
    expect(r.subject.length).toBeLessThanOrEqual(45);
    expect(r.subject).not.toContain("J-7");
  });

  it("sans date : « Rappel avant votre formation — », sans « J-7 »", async () => {
    const r = await renderEmailTemplate("qualiopi-rappel-j7", "fr", {
      ...BASE_STAGIAIRE,
      dateDebut: undefined,
    });
    expect(r.subject).toContain("Rappel avant votre formation —");
    expect(r.subject).not.toContain("J-7");
  });
});

describe("L4c — suivi J+30 : bouton vers le questionnaire", () => {
  const J30 = {
    stagiairePrenomNom: "Sophie Bernard",
    titreFormation: "IA pour RH",
    dateFinFormation: "05/08/2026",
    lienPortail: `https://axion-ia.com/fr/portail/acces/${FAKE_TOKEN}`,
    numeroSession: "AXI-SESS-2026-004",
  };

  it("avec lienQuestionnaire : bouton « Répondre au questionnaire » vers ce lien", async () => {
    const lien = `https://axion-ia.com/fr/portail/acces/${"d".repeat(64)}`;
    const r = await renderEmailTemplate("qualiopi-suivi-j30", "fr", {
      ...J30,
      lienQuestionnaire: lien,
    });
    expect(r.html).toContain("Répondre au questionnaire");
    expect(r.html).toContain(lien);
  });

  it("sans lienQuestionnaire : le portail, bouton inchangé", async () => {
    const r = await renderEmailTemplate("qualiopi-suivi-j30", "fr", J30);
    expect(r.html).toContain("Accéder à mon espace");
    expect(r.html).not.toContain("Répondre au questionnaire");
  });
});

describe("L4c — positionnement : relances distinctes du premier envoi", () => {
  const POS = {
    stagiairePrenomNom: "Jean Dupont",
    titreFormation: "Formation IA",
    dateDebutFormation: "16 août 2026",
    lienQuestionnaire: `https://axion-ia.com/fr/portail/acces/${FAKE_TOKEN}`,
    numeroSession: "AXI-SESS-2026-001",
  };

  it("rang 1 (ou absent) : pas de « Petit rappel », « la formation » et non « la journée »", async () => {
    const r1 = await renderEmailTemplate("qualiopi-positionnement", "fr", { ...POS, rang: 1 });
    const r0 = await renderEmailTemplate("qualiopi-positionnement", "fr", POS);
    for (const r of [r1, r0]) {
      expect(r.subject + r.text).not.toContain("Petit rappel");
      expect(r.text).not.toContain("la journée");
      expect(r.text).toContain("contenu de la formation");
    }
  });

  it("rang 2 : l'objet fait au plus OBJET_MAX caractères, en fr et en", async () => {
    for (const locale of ["fr", "en"] as const) {
      for (const titreFormation of ["", POS.titreFormation]) {
        const r = await renderEmailTemplate("qualiopi-positionnement", locale, {
          ...POS,
          titreFormation,
          rang: 2,
        });
        expect(r.subject.length).toBeLessThanOrEqual(OBJET_MAX);
      }
    }
  });

  it("rang 2 : objet « Rappel : » et corps commencent par « Petit rappel : »", async () => {
    const r1 = await renderEmailTemplate("qualiopi-positionnement", "fr", { ...POS, rang: 1 });
    const r2 = await renderEmailTemplate("qualiopi-positionnement", "fr", { ...POS, rang: 2 });
    expect(r2.subject).toContain("Rappel :");
    expect(r2.text).toContain("Petit rappel :");
    expect(r2.subject).not.toBe(r1.subject);
    expect(r2.text).not.toBe(r1.text);
  });
});
