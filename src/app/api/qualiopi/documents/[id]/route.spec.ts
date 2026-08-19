/**
 * Garde — le nom du fichier téléchargé DIT que la pièce est annulée.
 *
 * Le PDF, lui, ne le dit pas : il n'existe aucun filigrane « ANNULÉ » dans le
 * dépôt (`base-layout.tsx` ne connaît que COPIE et SPÉCIMEN). Le fichier d'une
 * pièce annulée est donc byte-identique à celui d'une pièce en vigueur. Le nom
 * du fichier est le SEUL signal disponible ici, et c'est ce qui rend son absence
 * coûteuse : une convention annulée rangée dans un dossier client s'y confond
 * définitivement avec celle qui fait foi.
 *
 * ⚠️ Le téléchargement lui-même n'est PAS bloqué, et ne doit pas l'être : un
 * auditeur doit pouvoir lire la pièce qu'on lui dit annulée.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const findUniqueMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { documentGenere: { findUnique: (...args: unknown[]) => findUniqueMock(...args) } },
}));

// `documentPdfKey` reste RÉEL : la clé R2 n'est pas l'objet de ce test, et la
// doubler ferait passer une clé fausse pour une clé juste.
const getSignedUrlMock = vi.fn(async (..._args: unknown[]) => "https://r2.test/signed");
vi.mock("@/lib/r2-storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/r2-storage")>()),
  isR2Configured: () => true,
  existsInR2: async () => true,
  getSignedUrlR2: (...args: unknown[]) => getSignedUrlMock(...(args as [])),
}));

import { GET } from "./route";

const DOC = "11111111-1111-4111-8111-111111111111";

function doc(over: Record<string, unknown> = {}) {
  return {
    id: DOC,
    type: "convention",
    numero: "AXI-DOC-2026-003",
    pdfUrl: null,
    createdAt: new Date("2026-08-01T09:00:00Z"),
    estCopie: false,
    annuleeAt: null as Date | null,
    client: { raisonSociale: "INVEST SUN" },
    session: null,
    ...over,
  };
}

async function appeler(): Promise<Response> {
  return GET(new Request(`https://test.local/api/qualiopi/documents/${DOC}`) as never, {
    params: Promise.resolve({ id: DOC }),
  });
}

/** Nom réellement demandé à R2 pour le `Content-Disposition`. */
function nomDemande(): string {
  const opts = getSignedUrlMock.mock.calls[0]?.[2] as { fichier?: { nom?: string } } | undefined;
  return opts?.fichier?.nom ?? "";
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { id: "admin-1", role: "super_admin" } });
  findUniqueMock.mockResolvedValue(doc());
});

describe("🔴 GET document — le nom du fichier annonce l'annulation", () => {
  it("le `select` demande `annuleeAt` — sans lui, rien ne peut le dire", async () => {
    await appeler();
    const select = (findUniqueMock.mock.calls[0]?.[0] as { select: Record<string, unknown> })
      .select;
    expect(select["annuleeAt"]).toBe(true);
  });

  it("une pièce annulée porte le suffixe ANNULEE", async () => {
    findUniqueMock.mockResolvedValue(doc({ annuleeAt: new Date("2026-08-12T09:00:00Z") }));
    await appeler();
    expect(nomDemande()).toContain("ANNULEE");
  });

  it("le suffixe se CUMULE avec COPIE — les deux états sont indépendants", async () => {
    // Une copie d'une pièce annulée est les deux à la fois ; n'en dire qu'un
    // reviendrait à taire l'autre.
    findUniqueMock.mockResolvedValue(
      doc({ estCopie: true, annuleeAt: new Date("2026-08-12T09:00:00Z") }),
    );
    await appeler();
    expect(nomDemande()).toContain("COPIE");
    expect(nomDemande()).toContain("ANNULEE");
  });

  it("le téléchargement n'est PAS bloqué : l'auditeur doit pouvoir lire la pièce", async () => {
    findUniqueMock.mockResolvedValue(doc({ annuleeAt: new Date("2026-08-12T09:00:00Z") }));
    const res = await appeler();
    expect(res.status).toBe(302);
  });

  it("une pièce en vigueur ne porte AUCUN des deux suffixes", async () => {
    await appeler();
    expect(nomDemande()).not.toContain("ANNULEE");
    expect(nomDemande()).not.toContain("COPIE");
  });
});
