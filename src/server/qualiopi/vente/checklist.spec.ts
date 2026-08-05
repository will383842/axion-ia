/**
 * Table de vérité — construireChecklistVente (module pur, aucun mock).
 *
 * Quatre familles de cas exigées par le plan : nominal direct, OPCO
 * subrogation (convention tripartite attendue), session annulée (certificat
 * sans objet), devis envoyé sans soumission de signature.
 */

import { describe, it, expect } from "vitest";
import {
  construireChecklistVente,
  PIECES_PAR_FINANCEMENT,
  type ChecklistVenteInput,
} from "./checklist";

const DEVIS_ACCEPTE = {
  statut: "accepte",
  fichierPdfUrl: "documents/2026/devis/AXI-DOC-2026-001.pdf",
  docusealSubmissionId: null,
  sentAt: "2026-08-01T09:00:00.000Z",
} as const;

function baseInput(overrides: Partial<ChecklistVenteInput>): ChecklistVenteInput {
  return {
    devis: { ...DEVIS_ACCEPTE },
    session: { statut: "planifiee", financementType: "direct", opcoSubrogation: false },
    documentsGeneres: [],
    enrollmentsActifs: 0,
    alertesOuvertes: [],
    ...overrides,
  };
}

function etatDe(items: ReturnType<typeof construireChecklistVente>, key: string) {
  return items.find((i) => i.key === key)?.etat;
}

describe("construireChecklistVente — cas nominal financement direct", () => {
  const items = construireChecklistVente(
    baseInput({
      documentsGeneres: [{ type: "convention" }, { type: "convocation" }],
      enrollmentsActifs: 3,
    }),
  );

  it("liste les pièces du financement direct, dans l'ordre, sans kit", () => {
    expect(items.map((i) => i.key)).toEqual([
      "devis",
      "session",
      "convention",
      "convocation",
      "emargement",
      "certificat_realisation",
      "facture",
    ]);
  });

  it("devis accepté et session existante sont faits", () => {
    expect(etatDe(items, "devis")).toBe("fait");
    expect(etatDe(items, "session")).toBe("fait");
  });

  it("une pièce générée est faite, une pièce due reste à faire", () => {
    expect(etatDe(items, "convention")).toBe("fait");
    expect(etatDe(items, "convocation")).toBe("fait");
    expect(etatDe(items, "emargement")).toBe("a_faire");
    expect(etatDe(items, "facture")).toBe("a_faire");
  });

  it("relaie une alerte ouverte de l'évaluateur sans la recalculer", () => {
    const avecAlerte = construireChecklistVente(
      baseInput({ alertesOuvertes: [{ code: "emargement_manquant" }] }),
    );
    const emargement = avecAlerte.find((i) => i.key === "emargement");
    expect(emargement?.etat).toBe("a_faire");
    expect(emargement?.detail).toContain("emargement_manquant");
  });
});

describe("construireChecklistVente — OPCO avec subrogation", () => {
  const items = construireChecklistVente(
    baseInput({
      session: { statut: "planifiee", financementType: "opco", opcoSubrogation: true },
    }),
  );

  it("attend la convention TRIPARTITE, pas la convention simple", () => {
    expect(items.some((i) => i.key === "convention_tripartite")).toBe(true);
    expect(items.some((i) => i.key === "convention")).toBe(false);
  });

  it("attend le kit OPCO", () => {
    expect(etatDe(items, "kit_opco")).toBe("a_faire");
  });

  it("une convention simple déjà générée ne suffit PAS en subrogation", () => {
    const avecConventionSimple = construireChecklistVente(
      baseInput({
        session: { statut: "planifiee", financementType: "opco", opcoSubrogation: true },
        documentsGeneres: [{ type: "convention" }],
      }),
    );
    const tripartite = avecConventionSimple.find((i) => i.key === "convention_tripartite");
    expect(tripartite?.etat).toBe("a_faire");
    expect(tripartite?.detail).toContain("TRIPARTITE");
  });

  it("sans subrogation, l'OPCO garde la convention simple", () => {
    const sansSubrogation = construireChecklistVente(
      baseInput({
        session: { statut: "planifiee", financementType: "opco", opcoSubrogation: false },
      }),
    );
    expect(sansSubrogation.some((i) => i.key === "convention")).toBe(true);
    expect(sansSubrogation.some((i) => i.key === "convention_tripartite")).toBe(false);
  });
});

describe("construireChecklistVente — session annulée / reportée", () => {
  const items = construireChecklistVente(
    baseInput({
      session: { statut: "annulee", financementType: "direct", opcoSubrogation: false },
    }),
  );

  it("certificat et facture passent sans objet", () => {
    expect(etatDe(items, "certificat_realisation")).toBe("sans_objet");
    expect(etatDe(items, "facture")).toBe("sans_objet");
  });

  it("les pièces amont gardent leur état (audit du dossier)", () => {
    expect(etatDe(items, "convention")).toBe("a_faire");
    expect(etatDe(items, "session")).toBe("fait");
  });

  it("reportée : même règle que annulée", () => {
    const reportee = construireChecklistVente(
      baseInput({
        session: { statut: "reportee", financementType: "direct", opcoSubrogation: false },
      }),
    );
    expect(etatDe(reportee, "certificat_realisation")).toBe("sans_objet");
    expect(etatDe(reportee, "facture")).toBe("sans_objet");
  });
});

describe("construireChecklistVente — sous-états du devis envoyé", () => {
  it("envoyé SANS soumission de signature : le client ne peut pas signer en ligne", () => {
    const items = construireChecklistVente(
      baseInput({
        devis: {
          statut: "envoye",
          fichierPdfUrl: "documents/2026/devis/AXI-DOC-2026-001.pdf",
          docusealSubmissionId: null,
          sentAt: "2026-08-01T09:00:00.000Z",
        },
        session: null,
      }),
    );
    const devis = items.find((i) => i.key === "devis");
    expect(devis?.etat).toBe("a_faire");
    expect(devis?.detail).toContain("ne peut pas signer en ligne");
  });

  it("envoyé SANS PDF : bloqué, le client n'a rien reçu à lire", () => {
    const items = construireChecklistVente(
      baseInput({
        devis: {
          statut: "envoye",
          fichierPdfUrl: null,
          docusealSubmissionId: "sub_123",
          sentAt: null,
        },
        session: null,
      }),
    );
    const devis = items.find((i) => i.key === "devis");
    expect(devis?.etat).toBe("bloque");
    expect(devis?.detail).toContain("PDF non généré");
  });

  it("envoyé et signable : simple attente de signature", () => {
    const items = construireChecklistVente(
      baseInput({
        devis: {
          statut: "envoye",
          fichierPdfUrl: "documents/2026/devis/AXI-DOC-2026-001.pdf",
          docusealSubmissionId: "sub_123",
          sentAt: "2026-08-01T09:00:00.000Z",
        },
        session: null,
      }),
    );
    const devis = items.find((i) => i.key === "devis");
    expect(devis?.etat).toBe("a_faire");
    expect(devis?.detail).toContain("attente de signature");
  });
});

describe("construireChecklistVente — ordre imposé devis accepté → session → convention", () => {
  it("devis non accepté : session ET pièces aval bloquées", () => {
    const items = construireChecklistVente(
      baseInput({
        devis: {
          statut: "envoye",
          fichierPdfUrl: "x.pdf",
          docusealSubmissionId: "sub_1",
          sentAt: null,
        },
        session: null,
      }),
    );
    expect(etatDe(items, "session")).toBe("bloque");
    expect(etatDe(items, "convention")).toBe("bloque");
    expect(etatDe(items, "facture")).toBe("bloque");
  });

  it("devis accepté sans session : la session est l'étape à faire, l'aval reste bloqué", () => {
    const items = construireChecklistVente(baseInput({ session: null }));
    expect(etatDe(items, "devis")).toBe("fait");
    expect(etatDe(items, "session")).toBe("a_faire");
    expect(etatDe(items, "convention")).toBe("bloque");
  });

  it("aucun devis : tout commence par le devis", () => {
    const items = construireChecklistVente(baseInput({ devis: null, session: null }));
    expect(etatDe(items, "devis")).toBe("a_faire");
    expect(etatDe(items, "session")).toBe("bloque");
  });
});

describe("PIECES_PAR_FINANCEMENT — table déclarative", () => {
  it("chaque financement commence par devis puis session", () => {
    for (const pieces of Object.values(PIECES_PAR_FINANCEMENT)) {
      expect(pieces[0]).toBe("devis");
      expect(pieces[1]).toBe("session");
    }
  });

  it("le kit correspond au financement, et lui seul", () => {
    expect(PIECES_PAR_FINANCEMENT.direct.some((p) => p.startsWith("kit_"))).toBe(false);
    expect(PIECES_PAR_FINANCEMENT.opco).toContain("kit_opco");
    expect(PIECES_PAR_FINANCEMENT.cpf).toContain("kit_cpf");
    expect(PIECES_PAR_FINANCEMENT.france_travail).toContain("kit_france_travail");
  });

  it("« mixte » est traité comme OPCO (le financement le plus exigeant)", () => {
    const items = construireChecklistVente(
      baseInput({
        session: { statut: "planifiee", financementType: "mixte", opcoSubrogation: false },
      }),
    );
    expect(items.some((i) => i.key === "kit_opco")).toBe(true);
  });
});
