/**
 * Tests — génération du document officiel « relevé de connexion » (T8).
 *
 * Vérifie que `genererReleveConnexionDocumentAction` :
 *   - lit l'import + ses présences + la session,
 *   - construit les participants (durée HHhMM, présence validée),
 *   - propage `fichierOriginalPath` (lien CSV original — obligation CDC),
 *   - appelle `generateDocument` avec type `releve_connexion` + ref session,
 *   - trace l'activité.
 *
 * Mocks déclarés AVANT import du module testé.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    releveConnexionImport: { findUnique: vi.fn() },
    trainer: { findUnique: vi.fn() },
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-test-id" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/qualiopi/documents/documents-service", () => ({
  generateDocument: vi
    .fn()
    .mockResolvedValue({ id: "doc-1", numero: "AXI-SESS-2026-001", pdfUrl: null, hashSha256: "x" }),
}));

vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: vi.fn().mockResolvedValue({
    raisonSociale: "Axion-IA SAS",
    nda: "00000000000",
    qualiopi: "",
    siret: "",
    adresseSiege: "",
    adresseExercice: "",
    email: "",
    telephone: "",
    site: "",
  }),
}));

vi.mock("@/server/qualiopi/documents/templates/releve-connexion", () => ({
  ReleveConnexionPdf: vi.fn(() => null),
}));

vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn().mockResolvedValue(80),
}));

import { prisma } from "@/lib/prisma";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import { logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { genererReleveConnexionDocumentAction } from "@/server/actions/qualiopi/presence";

const mockPrisma = prisma as unknown as {
  releveConnexionImport: { findUnique: ReturnType<typeof vi.fn> };
  trainer: { findUnique: ReturnType<typeof vi.fn> };
};

const UUID = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("genererReleveConnexionDocumentAction", () => {
  it("rejette un importId non-uuid", async () => {
    const res = await genererReleveConnexionDocumentAction({ importId: "pas-un-uuid" });
    expect(res).toEqual({ error: "Données invalides" });
  });

  it("retourne une erreur si l'import est introuvable", async () => {
    mockPrisma.releveConnexionImport.findUnique.mockResolvedValue(null);
    const res = await genererReleveConnexionDocumentAction({ importId: UUID });
    expect(res).toEqual({ error: "Import introuvable" });
  });

  it("génère le document, propage le CSV original et trace l'activité", async () => {
    mockPrisma.releveConnexionImport.findUnique.mockResolvedValue({
      id: UUID,
      plateforme: "zoom",
      fichierOriginalPath: "presence/2026/sess/abc-zoom.csv",
      meta: { idReunion: "987 6543 2100" },
      session: {
        id: "sess-1",
        dateDebut: new Date("2026-06-10T07:00:00.000Z"),
        dateFin: new Date("2026-06-10T15:00:00.000Z"),
        coFormateurs: [{ trainerId: "trainer-1", role: "principal" }],
        formation: { titre: "Maîtriser l'IA générative" },
      },
      presences: [
        {
          dureeRealiseeMinutes: 423,
          present: true,
          heureConnexion: new Date("2026-06-10T07:02:00.000Z"),
          heureDeconnexion: new Date("2026-06-10T15:05:00.000Z"),
          enrollment: { trainee: { nom: "Dupont", prenom: "Marie" } },
        },
        {
          dureeRealiseeMinutes: 90,
          present: false,
          heureConnexion: null,
          heureDeconnexion: null,
          enrollment: { trainee: { nom: "Martin", prenom: "Paul" } },
        },
      ],
    });
    mockPrisma.trainer.findUnique.mockResolvedValue({ nom: "Bernard", prenom: "Luc" });

    const res = await genererReleveConnexionDocumentAction({ importId: UUID });
    expect(res).toEqual({ data: { documentId: "doc-1", numero: "AXI-SESS-2026-001" } });

    // generateDocument appelé avec le bon type + ref session + CSV original lié.
    const genCall = (generateDocument as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(genCall.type).toBe("releve_connexion");
    expect(genCall.refs).toEqual({ sessionId: "sess-1" });
    expect(genCall.fichierOriginalPath).toBe("presence/2026/sess/abc-zoom.csv");

    // Données passées au template (via les props de l'élément React construit).
    const pdfProps = genCall.element.props;
    expect(pdfProps.data.intituleFormation).toBe("Maîtriser l'IA générative");
    expect(pdfProps.data.idReunion).toBe("987 6543 2100");
    expect(pdfProps.data.nomFormateur).toBe("Luc Bernard");
    expect(pdfProps.data.dureeMinimaleRequisePercent).toBe(80);
    expect(pdfProps.data.participants).toHaveLength(2);
    expect(pdfProps.data.participants[0]).toMatchObject({
      nomPrenom: "Marie Dupont",
      dureeEffective: "7h03",
      presenceValidee: true,
    });
    expect(pdfProps.data.participants[1]).toMatchObject({
      nomPrenom: "Paul Martin",
      heureConnexion: "—",
      presenceValidee: false,
    });

    expect(logQualiopiActivity).toHaveBeenCalledOnce();
  });

  it("ne casse pas si aucun co-formateur n'est déclaré (nomFormateur = —)", async () => {
    mockPrisma.releveConnexionImport.findUnique.mockResolvedValue({
      id: UUID,
      plateforme: "teams",
      fichierOriginalPath: null,
      meta: {},
      session: {
        id: "sess-2",
        dateDebut: new Date("2026-06-10T07:00:00.000Z"),
        dateFin: new Date("2026-06-10T15:00:00.000Z"),
        coFormateurs: [],
        formation: { titre: "Atelier data" },
      },
      presences: [],
    });

    const res = await genererReleveConnexionDocumentAction({ importId: UUID });
    expect("data" in res).toBe(true);
    const genCall = (generateDocument as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    const pdfProps = genCall.element.props;
    expect(pdfProps.data.nomFormateur).toBe("—");
    expect(pdfProps.data.idReunion).toBe("—");
    // Pas de fichierOriginalPath transmis quand null.
    expect(genCall.fichierOriginalPath).toBeUndefined();
  });
});
