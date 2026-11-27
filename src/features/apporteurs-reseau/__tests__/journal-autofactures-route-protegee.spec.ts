import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => vi.fn());
const lireJournal = vi.hoisted(() => vi.fn());
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("../journal-autofactures", () => ({ lireJournal }));
vi.mock("@/server/auth/garde-route-console", () => ({
  refuserSiHorsConsole: vi.fn(async () => null),
}));

import { NextRequest } from "next/server";
import { GET } from "../../../app/[locale]/(admin)/[adminPrefix]/apporteurs/commissions/journal/export/route";

const params = Promise.resolve({ locale: "fr", adminPrefix: "x" });
const appeler = (qs = "format=csv&du=2026-01-01&au=2026-12-31") =>
  GET(new NextRequest(`http://localhost/export?${qs}`), { params });

beforeEach(() => {
  vi.clearAllMocks();
  lireJournal.mockResolvedValue({ lignes: [], trous: [] });
});

describe("export du journal des autofactures : accès", () => {
  it("refuse sans session (401), sans rien lire", async () => {
    auth.mockResolvedValue(null);
    expect((await appeler()).status).toBe(401);
    expect(lireJournal).not.toHaveBeenCalled();
  });

  it("refuse un rôle sans droit de facturation (403)", async () => {
    auth.mockResolvedValue({ user: { id: "u1", role: "lecteur" } });
    expect((await appeler()).status).toBe(403);
    expect(lireJournal).not.toHaveBeenCalled();
  });

  it("refuse un format ou des dates invalides (400) pour un rôle autorisé", async () => {
    auth.mockResolvedValue({ user: { id: "u1", role: "super_admin" } });
    expect((await appeler("format=xml&du=2026-01-01&au=2026-12-31")).status).toBe(400);
    expect((await appeler("format=csv&du=hier&au=2026-12-31")).status).toBe(400);
  });

  it("sert le CSV à un rôle autorisé", async () => {
    auth.mockResolvedValue({ user: { id: "u1", role: "super_admin" } });
    const r = await appeler();
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("text/csv");
  });
});
