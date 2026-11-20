/**
 * Lot I3, étape 5 — GET /api/qualiopi/devis/[id]/scan-signe : 401, 403, 404, 302 (120 s).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const devisMock = vi.fn();
const signatureMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    devis: { findUnique: (...a: unknown[]) => devisMock(...a) },
    documentSignature: { findFirst: (...a: unknown[]) => signatureMock(...a) },
  },
}));

const urlMock = vi.fn(async (..._a: unknown[]) => "https://r2.test/signed-scan");
vi.mock("@/lib/r2-storage", () => ({ getSignedUrlR2: (...a: unknown[]) => urlMock(...a) }));

import { GET } from "./route";

const ID = "11111111-1111-4111-8111-111111111111";
const CLE = "documents/2026/devis-signes-papier/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf";

async function appeler(id = ID): Promise<Response> {
  return GET(new Request(`https://test.local/api/qualiopi/devis/${id}/scan-signe`) as never, {
    params: Promise.resolve({ id }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { id: "u1", role: "admin" } });
  devisMock.mockResolvedValue({ documentGenereId: "p1" });
  signatureMock.mockResolvedValue({ signatureKey: CLE });
});

describe("GET scan-signe", () => {
  it("401 sans session", async () => {
    authMock.mockResolvedValue(null);
    const r = await appeler();
    expect(r.status).toBe(401);
    expect(devisMock).not.toHaveBeenCalled();
  });

  it("403 pour un rôle non administrateur", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "reader" } });
    expect((await appeler()).status).toBe(403);
  });

  it("404 : identifiant invalide, devis inconnu, sans pièce, ou sans scan papier", async () => {
    expect((await appeler("pas-un-uuid")).status).toBe(404);
    devisMock.mockResolvedValue(null);
    expect((await appeler()).status).toBe(404);
    devisMock.mockResolvedValue({ documentGenereId: null });
    expect((await appeler()).status).toBe(404);
    devisMock.mockResolvedValue({ documentGenereId: "p1" });
    signatureMock.mockResolvedValue(null);
    expect((await appeler()).status).toBe(404);
    expect(urlMock).not.toHaveBeenCalled();
  });

  it("302 vers l'URL signée de 120 s", async () => {
    const r = await appeler();
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toBe("https://r2.test/signed-scan");
    expect(urlMock).toHaveBeenCalledWith(CLE, 120);
    expect(signatureMock.mock.calls[0]![0]).toMatchObject({
      where: { partie: "client", methode: "papier_scanne", revokedAt: null },
    });
  });
});
