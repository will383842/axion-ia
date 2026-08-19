/**
 * Gardes — « habilitation DÉCLARABLE » : ce qu'une pièce imprimée a le droit
 * d'annoncer au titre de l'indicateur 21.
 *
 * 🔴 Vérification du plan Qualiopi (2026-08-19, défaut A). Le 2026-08-17, la
 * dé-habilitation est passée d'un `deleteMany` à un horodatage
 * (`TrainerHabilitation.retireAt`) : la ligne SUBSISTE en base. Le lot A5 avait
 * par ailleurs ajouté un filtre `formation.statut != archive` — mais sur UN SEUL
 * des générateurs de la fiche formateur.
 *
 * Résultat mesuré avant ce spec :
 *   - `verserFicheFormateurAction` (documents.ts, pièce VERSÉE au registre) :
 *     filtre `archive`, PAS `retireAt` → déclare des habilitations RETIRÉES ;
 *   - `genererCvFormateurAction` (exports-pdf.ts, export direct) : AUCUN filtre
 *     → c'est le défaut initial d'A5, resté ouvert sur l'autre bouton du même écran ;
 *   - `genererListeFormateursAction` (documents.ts, liste des intervenants) :
 *     compte `retireAt: null` mais résout les intitulés SANS filtre `archive`.
 *
 * Deux pièces du même dossier pouvaient donc se contredire, dans les deux sens —
 * littéralement le défaut F11 que le commentaire de `documents.ts` dit avoir soldé.
 *
 * Ces tests assertent le `where` EXACT : une simple recopie du filtre dans trois
 * fichiers reproduirait le défaut à la première divergence, c'est la duplication
 * qui est la cause. Le `where` doit venir d'UNE définition partagée.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks (hoistés par Vitest — déclarés avant les imports sous test)
// ─────────────────────────────────────────────────────────────────────────────

const mockTrainerFindUnique = vi.fn();
const mockTrainerFindMany = vi.fn();
const mockTrainerUpdate = vi.fn();
const mockHabilitationFindMany = vi.fn();
const mockDevelopmentActionFindMany = vi.fn();
const mockTrainerDocumentCount = vi.fn();
const mockTrainerDocumentGroupBy = vi.fn();
const mockFormationFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainer: {
      findUnique: (...a: unknown[]) => mockTrainerFindUnique(...a),
      findMany: (...a: unknown[]) => mockTrainerFindMany(...a),
      update: (...a: unknown[]) => mockTrainerUpdate(...a),
    },
    trainerHabilitation: {
      findMany: (...a: unknown[]) => mockHabilitationFindMany(...a),
    },
    trainerDevelopmentAction: {
      findMany: (...a: unknown[]) => mockDevelopmentActionFindMany(...a),
    },
    trainerDocument: {
      count: (...a: unknown[]) => mockTrainerDocumentCount(...a),
      groupBy: (...a: unknown[]) => mockTrainerDocumentGroupBy(...a),
    },
    formation: {
      findMany: (...a: unknown[]) => mockFormationFindMany(...a),
    },
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  // La fiche versée est un acte ENGAGEANT : elle passe par `requireHabilitation`,
  // pas par `requireAdminWrite`. Mocker les deux évite un spec qui rougirait sur
  // l'authentification au lieu de rougir sur le `where`.
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  requireAdminDelete: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

const mockGenerateDocument = vi.fn();
vi.mock("@/server/qualiopi/documents/documents-service", () => ({
  generateDocument: (...a: unknown[]) => mockGenerateDocument(...a),
}));

const mockRenderPdfToBuffer = vi.fn();
vi.mock("@/server/qualiopi/documents/render", () => ({
  renderPdfToBuffer: (...a: unknown[]) => mockRenderPdfToBuffer(...a),
}));

const mockGetOrganismeIdentite = vi.fn();
vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: () => mockGetOrganismeIdentite(),
}));

vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn().mockResolvedValue(""),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Modules sous test
// ─────────────────────────────────────────────────────────────────────────────

import { verserFicheFormateurAction, genererListeFormateursAction } from "./documents";
import { genererCvFormateurAction } from "./exports-pdf";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const TRAINER_ID = "d1234567-89ab-cdef-0123-456789abcdef";

const IDENTITE = {
  raisonSociale: "Axion-IA SAS",
  nda: "84381100438",
  qualiopi: null,
  siret: "12345678900011",
  adresseSiege: "1 rue de la Paix, 75001 Paris",
  adresseExercice: "1 rue de la Paix, 75001 Paris",
  email: "contact@axion-ia.com",
  telephone: "+33 1 23 45 67 89",
  site: "https://axion-ia.com",
};

function makeTrainer(overrides: Record<string, unknown> = {}) {
  return {
    id: TRAINER_ID,
    actif: true,
    nom: "Durand",
    prenom: "Claire",
    email: "claire@axion-ia.com",
    telephone: "+33 6 00 00 00 00",
    statut: "salarie",
    cvUrl: null,
    domainesCompetences: ["IA générative"],
    formationsHabilitees: [],
    dateEmbauche: new Date("2024-01-01T00:00:00Z"),
    sousTraitantNda: null,
    adresseProfessionnelle: null,
    sousTraitantVerifieAt: null,
    ...overrides,
  };
}

/**
 * Le `where` que TOUTE pièce imprimée doit poser : ni habilitation retirée
 * (`retireAt`), ni formation retirée du catalogue (`archive`).
 * Écrit ici en dur, VOLONTAIREMENT : un test qui importerait la constante du
 * code sous test ne vérifierait plus que le code est d'accord avec lui-même.
 */
const WHERE_DECLARABLE_ATTENDU = {
  trainerId: TRAINER_ID,
  retireAt: null,
  formation: { statut: { not: "archive" } },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetOrganismeIdentite.mockResolvedValue(IDENTITE);
  mockGenerateDocument.mockResolvedValue({ id: "doc-uuid", numero: "AXI-FORM-2026-001" });
  mockRenderPdfToBuffer.mockResolvedValue({ buffer: Buffer.from("pdf") });
  mockTrainerFindUnique.mockResolvedValue(makeTrainer());
  mockHabilitationFindMany.mockResolvedValue([{ formation: { titre: "IA opérationnelle" } }]);
  mockDevelopmentActionFindMany.mockResolvedValue([]);
  mockTrainerDocumentCount.mockResolvedValue(1);
  mockTrainerDocumentGroupBy.mockResolvedValue([]);
  mockTrainerUpdate.mockResolvedValue({});
  mockFormationFindMany.mockResolvedValue([]);
  mockTrainerFindMany.mockResolvedValue([]);
});

// ─────────────────────────────────────────────────────────────────────────────
// Producteur 1 — la fiche VERSÉE au registre (documents.ts)
// ─────────────────────────────────────────────────────────────────────────────

describe("verserFicheFormateurAction — habilitations déclarables", () => {
  it("n'interroge QUE les habilitations actives sur une formation au catalogue", async () => {
    await verserFicheFormateurAction({ trainerId: TRAINER_ID });

    expect(mockHabilitationFindMany).toHaveBeenCalledTimes(1);
    expect(mockHabilitationFindMany.mock.calls[0]?.[0]).toMatchObject({
      where: WHERE_DECLARABLE_ATTENDU,
    });
  });

  it("ne franchit pas la garde « fiche vide » si TOUTES les habilitations sont retirées et qu'il n'y a ni compétence ni CV source", async () => {
    // Une habilitation retirée n'est plus déclarable : la requête filtrée ne
    // remonte rien. La fiche ne documenterait alors AUCUNE maîtrise.
    mockHabilitationFindMany.mockResolvedValue([]);
    mockTrainerFindUnique.mockResolvedValue(makeTrainer({ domainesCompetences: [] }));
    mockTrainerDocumentCount.mockResolvedValue(0);

    const r = await verserFicheFormateurAction({ trainerId: TRAINER_ID });

    expect(r).toHaveProperty("error");
    expect(mockGenerateDocument).not.toHaveBeenCalled();
  });

  it("dégrade proprement : habilitations toutes retirées mais compétences saisies → la fiche sort", async () => {
    mockHabilitationFindMany.mockResolvedValue([]);
    mockTrainerDocumentCount.mockResolvedValue(0);

    const r = await verserFicheFormateurAction({ trainerId: TRAINER_ID });

    expect(r).toHaveProperty("data");
    expect(mockGenerateDocument).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Producteur 2 — l'export DIRECT (exports-pdf.ts)
// ─────────────────────────────────────────────────────────────────────────────

describe("genererCvFormateurAction — habilitations déclarables", () => {
  it("porte EXACTEMENT le même filtre que la fiche versée", async () => {
    await genererCvFormateurAction({ trainerId: TRAINER_ID });

    expect(mockHabilitationFindMany).toHaveBeenCalledTimes(1);
    expect(mockHabilitationFindMany.mock.calls[0]?.[0]).toMatchObject({
      where: WHERE_DECLARABLE_ATTENDU,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Producteur 3 — la LISTE des intervenants (documents.ts)
// ─────────────────────────────────────────────────────────────────────────────

describe("genererListeFormateursAction — habilitations déclarables", () => {
  it("ne résout QUE les intitulés de formations au catalogue en vigueur", async () => {
    mockTrainerFindMany.mockResolvedValue([
      {
        id: TRAINER_ID,
        nom: "Durand",
        prenom: "Claire",
        statut: "salarie",
        domainesCompetences: ["IA générative"],
        dateEmbauche: new Date("2024-01-01T00:00:00Z"),
        sousTraitantNda: null,
        habilitations: [{ formationId: "f-active" }, { formationId: "f-archivee" }],
      },
    ]);
    // Le catalogue ne rend que la formation encore à l'offre.
    mockFormationFindMany.mockResolvedValue([{ id: "f-active", titre: "IA opérationnelle" }]);

    await genererListeFormateursAction();

    expect(mockFormationFindMany).toHaveBeenCalledTimes(1);
    expect(mockFormationFindMany.mock.calls[0]?.[0]).toMatchObject({
      where: { id: { in: ["f-active", "f-archivee"] }, statut: { not: "archive" } },
    });
  });

  it("le NOMBRE imprimé ne compte que les habilitations déclarables", async () => {
    // 🔴 C'est l'incohérence F11 : la liste annonçait « 2 habilitations » et
    // n'en citait qu'une, parce que le compte venait de `listTrainers` (filtré
    // `retireAt` seul) et les intitulés d'une autre requête. L'auditrice
    // confronte les deux.
    mockTrainerFindMany.mockResolvedValue([
      {
        id: TRAINER_ID,
        nom: "Durand",
        prenom: "Claire",
        statut: "salarie",
        domainesCompetences: [],
        dateEmbauche: null,
        sousTraitantNda: null,
        habilitations: [{ formationId: "f-active" }, { formationId: "f-archivee" }],
      },
    ]);
    mockFormationFindMany.mockResolvedValue([{ id: "f-active", titre: "IA opérationnelle" }]);

    await genererListeFormateursAction();

    const buildElement = mockGenerateDocument.mock.calls[0]?.[0]?.buildElement as (
      numero: string,
    ) => { props: { data: { formateurs: Array<{ nbHabilitations: number }> } } };
    const element = buildElement("AXI-FORM-2026-001");
    expect(element.props.data.formateurs[0]?.nbHabilitations).toBe(1);
  });
});
