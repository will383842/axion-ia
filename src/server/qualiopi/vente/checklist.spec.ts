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
      baseInput({
        alertesOuvertes: [{ code: "emargement_manquant" }],
        certificationObtenue: true,
      }),
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

  it("🔴 envoyé par le canal MAISON (lien de signature émis, aucune soumission DocuSeal) : simple attente", () => {
    const items = construireChecklistVente(
      baseInput({
        devis: {
          statut: "envoye",
          fichierPdfUrl: "documents/2026/devis/AXI-DOC-2026-001.pdf",
          docusealSubmissionId: null,
          signatureMaison: true,
          sentAt: "2026-08-01T09:00:00.000Z",
        },
        session: null,
      }),
    );
    const devis = items.find((i) => i.key === "devis");
    expect(devis?.etat).toBe("a_faire");
    expect(devis?.detail).toContain("attente de signature");
    expect(devis?.detail).not.toContain("aucune soumission");
    expect(devis?.detail).not.toContain("ne peut pas signer en ligne");
  });

  it("envoyé sans aucun canal (ni maison ni DocuSeal) : message sans parler de « soumission »", () => {
    const items = construireChecklistVente(
      baseInput({
        devis: {
          statut: "envoye",
          fichierPdfUrl: "x.pdf",
          docusealSubmissionId: null,
          signatureMaison: false,
          sentAt: null,
        },
        session: null,
      }),
    );
    const devis = items.find((i) => i.key === "devis");
    expect(devis?.detail).toContain("ne peut pas signer en ligne");
    expect(devis?.detail).not.toContain("soumission");
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

describe("🔴 B6b-2 — libellés neutres avant certification", () => {
  const INTERDITS = /OPCO|prise en charge|financ|Qualiopi/i;
  const complet = (certificationObtenue?: boolean): ChecklistVenteInput =>
    baseInput({
      session: { statut: "planifiee", financementType: "opco", opcoSubrogation: true },
      alertesOuvertes: [],
      ...(certificationObtenue !== undefined ? { certificationObtenue } : {}),
    });

  it.each([undefined, false])("sans certification (%s) : kit présent, libellés neutres", (c) => {
    const items = construireChecklistVente(complet(c));
    const kit = items.find((i) => i.key === "kit_opco");
    expect(kit).toBeDefined();
    expect(kit?.libelle).toBe("Dossier administratif complémentaire");
    expect(kit?.detail).toBe(
      "Pièces administratives complémentaires (demande, accord, justificatifs).",
    );
    const texte = items.map((i) => `${i.libelle} ${i.detail}`).join("\n");
    expect(texte).not.toMatch(INTERDITS);
    expect(items.find((i) => i.key === "convention_tripartite")?.libelle).toBe(
      "Convention tripartite",
    );
  });

  it("la table des pièces dues ne change pas", () => {
    expect(PIECES_PAR_FINANCEMENT.opco).toContain("kit_opco");
  });

  it("avec certification : libellés actuels inchangés", () => {
    const items = construireChecklistVente(complet(true));
    expect(items.find((i) => i.key === "kit_opco")?.libelle).toBe("Kit OPCO");
    expect(items.find((i) => i.key === "kit_opco")?.detail).toBe(
      "Dossier de prise en charge OPCO (demande, accord, justificatifs).",
    );
    expect(items.find((i) => i.key === "convention_tripartite")?.libelle).toBe(
      "Convention tripartite (OPCO)",
    );
  });

  it("détails de la tripartite neutres sans certification", () => {
    const a = construireChecklistVente(complet(false)).find(
      (i) => i.key === "convention_tripartite",
    );
    expect(a?.detail).not.toMatch(INTERDITS);
    const b = construireChecklistVente({
      ...complet(false),
      documentsGeneres: [{ type: "convention" }],
    }).find((i) => i.key === "convention_tripartite");
    expect(b?.detail).not.toMatch(INTERDITS);
  });
});

describe("🔴 B6b-2 (correctif) — aucune mention interdite sans certification", () => {
  const MOTS_INTERDITS = [
    "opco",
    "cpf",
    "edof",
    "france travail",
    "france_travail",
    "financ",
    "prise en charge",
    "qualiopi",
  ];
  const CODES_ALERTE = [
    "convention_formation_manquante",
    "convention_tripartite_manquante",
    "emargement_manquant",
    "opco_sans_accord",
    "opco_formation_demarree_sans_accord",
    "depot_opco_a_faire",
    "qualiopi_expire",
    "code_inconnu_xyz",
  ];
  const MODES = ["direct", "opco", "mixte", "cpf", "france_travail"] as const;

  const entree = (
    mode: (typeof MODES)[number],
    alertes: boolean,
    certificationObtenue?: boolean,
  ): ChecklistVenteInput =>
    baseInput({
      session: { statut: "planifiee", financementType: mode, opcoSubrogation: mode === "opco" },
      alertesOuvertes: alertes ? CODES_ALERTE.map((code) => ({ code })) : [],
      ...(certificationObtenue !== undefined ? { certificationObtenue } : {}),
    });

  describe.each(MODES)("mode %s", (mode) => {
    it.each([false, true])("alertes ouvertes : %s — aucun mot interdit", (alertes) => {
      for (const c of [undefined, false]) {
        const texte = JSON.stringify(
          construireChecklistVente(entree(mode, alertes, c)).map((i) => [
            i.libelle,
            i.etat,
            i.detail,
          ]),
        ).toLowerCase();
        for (const mot of MOTS_INTERDITS) expect(texte, `« ${mot} »`).not.toContain(mot);
      }
    });

    it("même nombre d'éléments et mêmes identifiants avec et sans certification", () => {
      const sans = construireChecklistVente(entree(mode, true, false));
      const avec = construireChecklistVente(entree(mode, true, true));
      expect(sans.map((i) => i.key)).toEqual(avec.map((i) => i.key));
    });
  });

  it("devis accepté sans session : aucun mot interdit", () => {
    const texte = JSON.stringify(
      construireChecklistVente(baseInput({ session: null })).map((i) => [
        i.libelle,
        i.etat,
        i.detail,
      ]),
    ).toLowerCase();
    for (const mot of MOTS_INTERDITS) expect(texte, `« ${mot} »`).not.toContain(mot);
  });

  it("texte d'alerte neutre : code connu → table, code inconnu → « à vérifier »", () => {
    const items = construireChecklistVente(entree("opco", true, false));
    expect(items.find((i) => i.key === "kit_opco")?.detail).toContain(
      "Alerte ouverte : accord du tiers en attente.",
    );
    const inconnu = construireChecklistVente({
      ...entree("opco", false, false),
      alertesOuvertes: [{ code: "emargement_manquant" }],
    });
    expect(inconnu.find((i) => i.key === "emargement")?.detail).toMatch(/Alerte ouverte : .+\./);
  });

  it("avec certification : quelques textes figés inchangés", () => {
    const opco = construireChecklistVente(entree("opco", true, true));
    expect(opco.find((i) => i.key === "kit_opco")?.detail).toBe(
      "Dossier de prise en charge OPCO (demande, accord, justificatifs). Alerte ouverte : opco_sans_accord.",
    );
    const cpf = construireChecklistVente(entree("cpf", false, true));
    expect(cpf.find((i) => i.key === "kit_cpf")?.libelle).toBe("Kit CPF");
    expect(cpf.find((i) => i.key === "kit_cpf")?.detail).toBe(
      "Dossier CPF/EDOF (inscription, conditions, reste à charge).",
    );
    const ft = construireChecklistVente(entree("france_travail", false, true));
    expect(ft.find((i) => i.key === "kit_france_travail")?.libelle).toBe("Kit France Travail");
    expect(ft.find((i) => i.key === "kit_france_travail")?.detail).toBe(
      "Dossier France Travail (AIF/POEI : prescription, accord de financement).",
    );
    const sansSession = construireChecklistVente(
      baseInput({ session: null, certificationObtenue: true }),
    );
    expect(sansSession.find((i) => i.key === "session")?.detail).toBe(
      "Devis accepté : créez la session (dates, participants, financement).",
    );
  });
});
