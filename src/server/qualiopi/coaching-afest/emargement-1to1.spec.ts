/**
 * Tests — genererEmargement1to1 : l'idempotence bornée au RÉGIME DE PREUVE.
 *
 * ## Le défaut que ce fichier ferme (H.3)
 *
 * La feuille d'émargement AFEST est une pièce OPPOSABLE, et ses heures dépendent
 * du régime de preuve du parcours : sous `legacy_boolean` elles viennent des
 * booléens de présence, sous `signature_reelle` des lignes de signature non
 * révoquées. Ce ne sont pas les mêmes chiffres.
 *
 * La génération étant IDEMPOTENTE, une feuille figée sous l'ancien régime
 * continuait d'être servie après bascule — pendant que la facture, le BPF et le
 * certificat du même parcours étaient recalculés sous le nouveau. C'est
 * exactement la divergence « facture ≠ certificat ≠ BPF » que ce chantier
 * existe pour empêcher.
 *
 * 🔴 Et le défaut était INERTE tant que tout est en `legacy_boolean` : il se
 * serait déclenché AU MOMENT EXACT de la bascule, quand plus personne ne
 * l'aurait relié à ce chantier.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    coachingSession: { findUnique: vi.fn(), update: vi.fn() },
    documentGenere: { findUnique: vi.fn() },
  },
}));
vi.mock("@/server/qualiopi/documents/documents-service", () => ({
  generateDocument: vi.fn(),
}));
vi.mock("@/server/qualiopi/documents/organisme", () => ({ getOrganismeIdentite: vi.fn() }));
vi.mock("./coaching-snapshot", async (importOriginal) => {
  const reel = await importOriginal<Record<string, unknown>>();
  return { ...reel, ensureCoachingSnapshot: vi.fn() };
});

import { prisma } from "@/lib/prisma";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { ensureCoachingSnapshot } from "./coaching-snapshot";
import { genererEmargement1to1, regimeDeLaPiece } from "./emargement-1to1";

type Mock = ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
  coachingSession: { findUnique: Mock; update: Mock };
  documentGenere: { findUnique: Mock };
};
const mockGenerate = generateDocument as unknown as Mock;
const mockIdentite = getOrganismeIdentite as unknown as Mock;
const mockSnapshot = ensureCoachingSnapshot as unknown as Mock;

const COACHING = "11111111-1111-4111-8111-111111111111";
const DOC_EXISTANT = "22222222-2222-4222-8222-222222222222";

function parcours(over: Record<string, unknown> = {}) {
  return {
    id: COACHING,
    coachingSnapshot: null,
    beneficiaireNom: "Camille Durand",
    beneficiaireEntreprise: "ACME",
    tuteurEntrepriseNom: "Jean Tuteur",
    emargementDocumentId: DOC_EXISTANT,
    emargementGenereeAt: new Date("2026-06-01T10:00:00.000Z"),
    trainer: { nom: "Jullin", prenom: "Williams" },
    trainee: null,
    regimePreuve: "legacy_boolean",
    comptesRendus: [],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env["DATABASE_URL"] = "postgresql://test:test@localhost:5432/test";
  mockPrisma.coachingSession.findUnique.mockResolvedValue(parcours());
  mockPrisma.coachingSession.update.mockResolvedValue({ id: COACHING });
  mockIdentite.mockResolvedValue({ raisonSociale: "Axion-IA" });
  mockSnapshot.mockResolvedValue({ intitule: "Accompagnement IA individuel" });
  mockGenerate.mockResolvedValue({ id: "doc-neuf", numero: "AXI-DOC-2026-002" });
});

describe("regimeDeLaPiece", () => {
  it("🔴 une pièce SANS marquage est réputée `legacy_boolean`", () => {
    // Ce n'est pas un repli arbitraire : le régime réel n'existe que depuis ce
    // chantier, donc toute pièce antérieure a NÉCESSAIREMENT été produite sous
    // l'ancien régime. Rendre `null` ou le régime courant ferait passer une
    // feuille périmée pour à jour — l'inverse exact du but.
    expect(regimeDeLaPiece(null)).toBe("legacy_boolean");
    expect(regimeDeLaPiece({})).toBe("legacy_boolean");
    expect(regimeDeLaPiece(undefined)).toBe("legacy_boolean");
  });

  it("ne se laisse pas berner par un `metadata` qui n'est pas un objet", () => {
    // Colonne `Json` : le type n'est PAS garanti côté application.
    expect(regimeDeLaPiece(["signature_reelle"])).toBe("legacy_boolean");
    expect(regimeDeLaPiece("signature_reelle")).toBe("legacy_boolean");
    expect(regimeDeLaPiece({ regimePreuve: 42 })).toBe("legacy_boolean");
  });

  it("lit le régime quand il est marqué", () => {
    expect(regimeDeLaPiece({ regimePreuve: "signature_reelle" })).toBe("signature_reelle");
  });
});

describe("🔴 idempotence bornée au régime", () => {
  it("ressert la pièce figée quand le régime n'a PAS changé", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue({
      id: DOC_EXISTANT,
      numero: "AXI-DOC-2026-001",
      metadata: { regimePreuve: "legacy_boolean" },
    });

    const res = await genererEmargement1to1(COACHING);

    expect(res).toStrictEqual({ documentId: DOC_EXISTANT, numero: "AXI-DOC-2026-001" });
    // L'idempotence doit RESTER une idempotence : régénérer à chaque appel
    // ferait exploser la numérotation documentaire.
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("🔴 RE-GÉNÈRE après bascule en `signature_reelle`", async () => {
    // Le cœur du défaut H.3. Sans cela, la feuille continuerait d'afficher des
    // heures issues des booléens pendant que la facture compte les signatures.
    mockPrisma.coachingSession.findUnique.mockResolvedValue(
      parcours({ regimePreuve: "signature_reelle" }),
    );
    mockPrisma.documentGenere.findUnique.mockResolvedValue({
      id: DOC_EXISTANT,
      numero: "AXI-DOC-2026-001",
      metadata: { regimePreuve: "legacy_boolean" },
    });

    const res = await genererEmargement1to1(COACHING);

    expect(res).toStrictEqual({ documentId: "doc-neuf", numero: "AXI-DOC-2026-002" });
    expect(mockGenerate).toHaveBeenCalledOnce();
  });

  it("🔴 RE-GÉNÈRE une pièce ancienne SANS marquage sur un parcours basculé", async () => {
    // Cas réel de la bascule : toutes les feuilles existantes sont antérieures
    // au marquage. Les traiter comme à jour les figerait définitivement.
    mockPrisma.coachingSession.findUnique.mockResolvedValue(
      parcours({ regimePreuve: "signature_reelle" }),
    );
    mockPrisma.documentGenere.findUnique.mockResolvedValue({
      id: DOC_EXISTANT,
      numero: "AXI-DOC-2026-001",
      metadata: {},
    });

    await genererEmargement1to1(COACHING);
    expect(mockGenerate).toHaveBeenCalledOnce();
  });

  it("ne régénère PAS une pièce ancienne sur un parcours resté en `legacy_boolean`", async () => {
    // Zéro delta à la livraison : c'est la condition pour que ce correctif ne
    // change rien tant que personne n'a basculé.
    mockPrisma.documentGenere.findUnique.mockResolvedValue({
      id: DOC_EXISTANT,
      numero: "AXI-DOC-2026-001",
      metadata: {},
    });

    await genererEmargement1to1(COACHING);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("régénère quand la pièce référencée a disparu", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue(null);
    await genererEmargement1to1(COACHING);
    expect(mockGenerate).toHaveBeenCalledOnce();
  });
});

describe("🔴 le régime est FIGÉ sur la pièce produite", () => {
  it("écrit `regimePreuve` dans les métadonnées", async () => {
    // C'est ce marquage, et lui seul, qui permet à l'idempotence de savoir
    // qu'une pièce est devenue obsolète. Le retirer rouvrirait H.3 en silence.
    mockPrisma.coachingSession.findUnique.mockResolvedValue(
      parcours({
        emargementGenereeAt: null,
        emargementDocumentId: null,
        regimePreuve: "signature_reelle",
      }),
    );

    await genererEmargement1to1(COACHING);

    const arg = mockGenerate.mock.calls[0]?.[0] as { metadata?: Record<string, unknown> };
    expect(arg.metadata).toStrictEqual({ regimePreuve: "signature_reelle" });
  });
});
