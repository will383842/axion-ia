/**
 * Fil conducteur (L3, 30/09/2026) — chaque étape du parcours a sa PHASE et sa
 * CIBLE, l'attestation se rapproche PAR INSCRIPTION, et la checklist ne
 * déclenche jamais d'elle-même un acte habilité.
 */

import { describe, expect, it } from "vitest";

import { hrefEtape } from "./cible-etape";
import { construireParcours, type EtapeCle, type SessionParcoursInput } from "./session-parcours";
import { etatVerrouDossier } from "../sessions/verrou-dossier-pur";

const d = (iso: string): Date => new Date(iso);
const DEBUT = d("2026-09-10T09:00:00.000Z");
const FIN = d("2026-09-11T17:00:00.000Z");
const PREFIXE = "/fr/admin/qualiopi/sessions";

type Inscription = SessionParcoursInput["inscriptions"][number];

function inscription(patch: Partial<Inscription> = {}): Inscription {
  return {
    id: "e1",
    statut: "planifiee",
    financementType: null,
    emargementSigneAt: null,
    convocationEnvoyeeAt: null,
    questionnaires: [],
    evaluationFinaleAt: null,
    aUnAccesPortail: false,
    attestation: null,
    ...patch,
  };
}

function dossier(patch: Partial<SessionParcoursInput> = {}): SessionParcoursInput {
  return {
    session: {
      statut: "en_cours",
      dateDebut: DEBUT,
      dateFin: FIN,
      formateurPrincipalId: null,
      financementType: "opco",
    },
    documents: [],
    signaturesParPiece: new Map(),
    inscriptions: [inscription({ id: "e1" }), inscription({ id: "e2" })],
    liensEmargementActifs: 0,
    creneauxEmargement: 0,
    contresignature: { signees: 2, aContresigner: 1, sansDestinataire: 0, parFormateur: new Map() },
    maintenant: d("2026-09-10T12:00:00.000Z"),
    ...patch,
  };
}

describe("fil conducteur — phase et cible de chaque étape", () => {
  const p = construireParcours(dossier());
  const cible = (cle: EtapeCle) => p.etapes.find((e) => e.cle === cle)!.cible;

  it("les seize étapes ont une phase de la fiche et une cible non vide", () => {
    expect(p.etapes).toHaveLength(16);
    for (const e of p.etapes) {
      expect(["preparer", "jour_j", "apres"], e.cle).toContain(e.phase);
      expect(e.cible.fragment, e.cle).toMatch(/^[a-z0-9-]+$/);
      expect(e.cible.libelle.length, e.cle).toBeGreaterThan(5);
    }
  });

  it("🔴 plus aucune étape ne mène au bloc « Sous-pages »", () => {
    // Sept étapes y menaient : un clic pour descendre, un pour choisir la
    // sous-page, puis une recherche aux yeux. La cible nomme la section.
    for (const e of p.etapes) expect(e.cible.fragment, e.cle).not.toBe("sous-pages");
  });

  it("les étapes d'émargement et d'évaluation ciblent leur SOUS-PAGE", () => {
    expect(cible("creneaux_emargement")).toMatchObject({
      sousPage: "emargement",
      fragment: "journees",
    });
    expect(cible("liens_signature_emis")).toMatchObject({
      sousPage: "emargement",
      fragment: "liens",
    });
    expect(cible("emargement_signe")).toMatchObject({
      sousPage: "emargement",
      fragment: "feuille",
    });
    expect(cible("contresignature_formateur")).toMatchObject({
      sousPage: "emargement",
      fragment: "contresignature",
    });
    // Le PREMIER stagiaire non évalué — pas la liste.
    expect(cible("evaluation_finale")).toMatchObject({
      sousPage: "evaluations",
      fragment: "insc-e1",
    });
  });
});

describe("hrefEtape — un seul clic jusqu'au geste", () => {
  const etapes = construireParcours(dossier({ inscriptions: [inscription()] })).etapes;
  const lien = (cle: EtapeCle) =>
    hrefEtape(
      "S1",
      etapes.find((e) => e.cle === cle)!,
      PREFIXE,
    );

  it("une étape de sous-page mène DIRECTEMENT à la section de la sous-page", () => {
    expect(lien("creneaux_emargement")).toBe(`${PREFIXE}/S1/emargement#journees`);
    expect(lien("liens_signature_emis")).toBe(`${PREFIXE}/S1/emargement#liens`);
    expect(lien("emargement_signe")).toBe(`${PREFIXE}/S1/emargement#feuille`);
    expect(lien("contresignature_formateur")).toBe(`${PREFIXE}/S1/emargement#contresignature`);
    expect(lien("evaluation_finale")).toBe(`${PREFIXE}/S1/evaluations#insc-e1`);
    expect(lien("attestation")).toBe(`${PREFIXE}/S1/evaluations#insc-e1`);
  });

  it("une étape de la fiche porte sa PHASE et sa section", () => {
    expect(lien("formateur_assigne")).toBe(`${PREFIXE}/S1?phase=preparer#formateur`);
    // Aucune convention : le bloc des signatures n'est pas rendu, on mène au
    // bloc Documents (cf. « le-suivi-mene-au-geste.spec.ts »).
    expect(lien("convention_contresignee")).toBe(`${PREFIXE}/S1?phase=preparer#documents`);
    expect(lien("satisfaction_chaud")).toBe(`${PREFIXE}/S1?phase=jour_j#questionnaires`);
  });

  it("avec une convention vivante, les signatures mènent au bloc des signatures", () => {
    const avecConvention = construireParcours(
      dossier({
        documents: [
          {
            id: "conv",
            type: "convention",
            numero: "AXI-DOC-2026-020",
            createdAt: d("2026-09-01T00:00:00.000Z"),
            annuleeAt: null,
          },
        ],
      }),
    ).etapes;
    for (const cle of ["convention_signee", "convention_contresignee"] as const) {
      expect(
        hrefEtape(
          "S1",
          avecConvention.find((e) => e.cle === cle)!,
          PREFIXE,
        ),
      ).toBe(`${PREFIXE}/S1?phase=preparer#signature-pieces`);
    }
  });

  it("aucun lien ne passe par le bloc « Sous-pages »", () => {
    for (const e of etapes) expect(hrefEtape("S1", e, PREFIXE)).not.toContain("#sous-pages");
  });
});

describe("🔴 l'attestation se rapproche PAR INSCRIPTION (ADR 0060)", () => {
  const piece = (id: string, createdAt = "2026-09-12T08:00:00.000Z") => ({
    id,
    type: "attestation",
    numero: `AXI-DOC-${id}`,
    createdAt: d(createdAt),
    annuleeAt: null,
  });
  const attestation = (createdAt = "2026-09-12T08:00:00.000Z") => ({
    type: "attestation",
    annuleeAt: null,
    createdAt: d(createdAt),
  });
  const realisee = {
    statut: "realisee" as const,
    dateDebut: DEBUT,
    dateFin: FIN,
    formateurPrincipalId: "f1",
    financementType: "direct",
  };
  const maintenant = d("2026-09-20T09:00:00.000Z");

  /** Le verrou, sur les MÊMES inscriptions : aucun jeton, aucun événement. */
  function verrou(input: SessionParcoursInput) {
    return etatVerrouDossier({
      statut: "realisee",
      realiseeLe: FIN,
      evenements: [],
      maintenant,
      inscriptions: input.inscriptions.map((i) => ({
        id: i.id,
        statut: i.statut,
        stagiaire: i.id,
        sortieAt: null,
        attestation: i.attestation,
        jetonEmargementValideJusquA: null,
      })),
    });
  }
  const etapeAttestation = (input: SessionParcoursInput) =>
    construireParcours(input).etapes.find((e) => e.cle === "attestation")!;

  it("deux attestations pour A et zéro pour B : l'étape n'est PAS faite", () => {
    // Le défaut d'origine : le comptage (2 pièces ≥ 2 inscrits) cochait l'étape.
    const input = dossier({
      session: realisee,
      maintenant,
      documents: [piece("a1"), piece("a2", "2026-09-13T08:00:00.000Z")],
      inscriptions: [
        inscription({ id: "A", attestation: attestation("2026-09-13T08:00:00.000Z") }),
        inscription({ id: "B" }),
      ],
    });
    const etape = etapeAttestation(input);
    expect(etape.etat).not.toBe("fait");
    expect(etape.avancement).toEqual({ fait: 1, total: 2 });
    // Elle mène au cadre de B, celui qui manque.
    expect(etape.cible).toMatchObject({ sousPage: "evaluations", fragment: "insc-B" });
    // Test croisé : le verrou dit la même chose — le dossier n'est pas clos.
    expect(verrou(input).etat).toBe("a_recueillir");
  });

  it("chacun son attestation : l'étape est faite ET le dossier est clos", () => {
    const input = dossier({
      session: realisee,
      maintenant,
      documents: [piece("a1"), piece("b1")],
      inscriptions: [
        inscription({ id: "A", attestation: attestation(), evaluationFinaleAt: FIN }),
        inscription({ id: "B", attestation: attestation(), evaluationFinaleAt: FIN }),
      ],
    });
    expect(etapeAttestation(input).etat).toBe("fait");
    expect(verrou(input).etat).toBe("clos");
  });

  it("une attestation ANNULÉE ne compte pas — ni pour l'étape, ni pour le verrou", () => {
    const input = dossier({
      session: realisee,
      maintenant,
      inscriptions: [
        inscription({
          id: "A",
          attestation: { type: "attestation", annuleeAt: FIN, createdAt: FIN },
        }),
      ],
    });
    expect(etapeAttestation(input).etat).not.toBe("fait");
    expect(verrou(input).etat).toBe("a_recueillir");
  });
});

describe("gestes directs — jamais un acte habilité", () => {
  const p = construireParcours(
    dossier({
      session: {
        statut: "en_cours",
        dateDebut: DEBUT,
        dateFin: FIN,
        formateurPrincipalId: null,
        financementType: "direct",
      },
      documents: [
        {
          id: "conv",
          type: "convention",
          numero: "AXI-DOC-2026-020",
          createdAt: d("2026-09-01T00:00:00.000Z"),
          annuleeAt: null,
        },
      ],
      inscriptions: [
        inscription({
          id: "e1",
          traineeId: "t1",
          stagiaire: "Ada Lovelace",
          questionnaires: [
            {
              id: "q1",
              type: "positionnement",
              envoyeAt: d("2026-09-01T00:00:00.000Z"),
              reponduAt: null,
            },
          ],
        }),
      ],
    }),
  );
  const de = (cle: EtapeCle) => p.etapes.find((e) => e.cle === cle)!;

  it("relancer un questionnaire, relancer le client, générer un accès portail", () => {
    expect(de("positionnement_repondu").gesteDirect).toEqual({
      type: "relancer_questionnaire",
      cibles: [{ questionnaireId: "q1", destinataire: "Ada Lovelace" }],
    });
    expect(de("convention_signee").gesteDirect).toMatchObject({
      type: "relancer_signature",
      documentGenereId: "conv",
      partie: "client",
    });
    expect(de("acces_portail").gesteDirect).toEqual({
      type: "generer_acces_portail",
      cibles: [{ traineeId: "t1", destinataire: "Ada Lovelace" }],
    });
  });

  it("🔴 contresigner, évaluer et attester n'ont JAMAIS de geste direct", () => {
    const AUTORISES = new Set<EtapeCle>([
      "positionnement_repondu",
      "satisfaction_chaud",
      "satisfaction_froid",
      "convention_signee",
      "acces_portail",
    ]);
    for (const e of p.etapes) {
      if (!AUTORISES.has(e.cle)) expect(e.gesteDirect, e.cle).toBeUndefined();
    }
  });

  it("la convention déjà signée par le client ne propose plus de relance", () => {
    const signee = construireParcours(
      dossier({
        documents: [
          {
            id: "conv",
            type: "convention",
            numero: "AXI-DOC-2026-020",
            createdAt: d("2026-09-01T00:00:00.000Z"),
            annuleeAt: null,
          },
        ],
        signaturesParPiece: new Map([["conv", [{ partie: "client" }]]]),
      }),
    );
    expect(signee.etapes.find((e) => e.cle === "convention_signee")!.gesteDirect).toBeUndefined();
  });
});
