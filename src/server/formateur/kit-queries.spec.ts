/**
 * Tests — kit-queries.ts.
 *
 * L'enjeu est la GARDE D'APPARTENANCE. Le kit contient les corrigés du quiz
 * d'évaluation des acquis : un formateur qui téléchargerait celui d'une session
 * qui n'est pas la sienne n'est pas un incident mineur. Ces tests vérifient au
 * niveau du `where` Prisma que le filtre d'appartenance est bien posé, et qu'il
 * couvre les DEUX voies (formateur principal, co-animateur).
 *
 * Ils vérifient aussi qu'aucune URL n'est rendue : une URL R2 signée expire en
 * 900 secondes, et cette requête n'a pas à en fabriquer.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: { findFirst: vi.fn() },
    supportFormation: { findFirst: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { lireKitFormateur } from "./kit-queries";

const mockSession = (
  prisma as unknown as { trainingSession: { findFirst: ReturnType<typeof vi.fn> } }
).trainingSession.findFirst;
const mockSupport = (
  prisma as unknown as { supportFormation: { findFirst: ReturnType<typeof vi.fn> } }
).supportFormation.findFirst;

const TRAINER = "trainer-1";
const SESSION = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("lireKitFormateur — garde d'appartenance", () => {
  it("filtre sur les DEUX voies d'appartenance : principal et co-animateur", async () => {
    mockSession.mockResolvedValue({ formationId: "f-1" });
    mockSupport.mockResolvedValue({ version: 2, sizeBytes: 1024, generatedAt: null });

    await lireKitFormateur(SESSION, TRAINER);

    const where = mockSession.mock.calls[0]?.[0]?.where as {
      id: string;
      OR?: Array<Record<string, unknown>>;
    };
    expect(where.id).toBe(SESSION);
    expect(where.OR).toHaveLength(2);
    expect(JSON.stringify(where.OR)).toContain(TRAINER);
    // Les deux voies : FK principale ET table de liaison.
    expect(JSON.stringify(where.OR)).toContain("formateurPrincipalId");
    expect(JSON.stringify(where.OR)).toContain("sessionFormateurs");
  });

  it("rend null — sans jamais interroger les supports — si la session n'est pas au formateur", async () => {
    mockSession.mockResolvedValue(null);

    expect(await lireKitFormateur(SESSION, TRAINER)).toBeNull();
    // 🔴 Le point qui compte : on ne va pas chercher le kit « au cas où ».
    expect(mockSupport).not.toHaveBeenCalled();
  });

  it("rend null quand le kit n'est pas encore publié", async () => {
    mockSession.mockResolvedValue({ formationId: "f-1" });
    mockSupport.mockResolvedValue(null);

    expect(await lireKitFormateur(SESSION, TRAINER)).toBeNull();
  });
});

describe("lireKitFormateur — ce qu'elle demande et ce qu'elle rend", () => {
  it("ne retient qu'un kit porteur d'une clé R2, et prend la version la plus haute", async () => {
    mockSession.mockResolvedValue({ formationId: "f-1" });
    mockSupport.mockResolvedValue({ version: 3, sizeBytes: 2048, generatedAt: null });

    await lireKitFormateur(SESSION, TRAINER);

    const arg = mockSupport.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
      orderBy: Record<string, unknown>;
      select: Record<string, unknown>;
    };
    expect(arg.where.type).toBe("kit_formateur_imprime");
    expect(arg.where.pdfKey).toEqual({ not: null });
    expect(arg.orderBy).toEqual({ version: "desc" });
    // ❌ Jamais `pdfUrl` : une URL signée stockée est un lien mort au bout de
    // 900 s. Le lien passe par la route, qui re-signe.
    expect(Object.keys(arg.select)).not.toContain("pdfUrl");
  });

  it("rend la version, la taille et la date — et rien d'autre", async () => {
    mockSession.mockResolvedValue({ formationId: "f-1" });
    const publieLe = new Date("2026-08-08T10:00:00Z");
    mockSupport.mockResolvedValue({ version: 4, sizeBytes: 4096, generatedAt: publieLe });

    const kit = await lireKitFormateur(SESSION, TRAINER);

    expect(kit).toEqual({ version: 4, sizeBytes: 4096, publieLe });
  });
});
