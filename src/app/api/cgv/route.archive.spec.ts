// @vitest-environment node
/**
 * GET /api/cgv derrière l'interrupteur `signature.cgv_preuve` : éteint = rendu actuel inchangé ;
 * allumé = octets ARCHIVÉS, revérifiés (altérés : 500, jamais servis).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CGV_VERSION } from "@/content/cgv-version";

const mocks = vi.hoisted(() => ({
  allumage: vi.fn(),
  assurer: vi.fn(),
  lire: vi.fn(),
  rendre: vi.fn(),
}));

vi.mock("@/server/legal/interrupteur-cgv-preuve", () => ({ allumagePreuveCgv: mocks.allumage }));
vi.mock("@/server/legal/cgv-archive", async () => {
  class CgvArchiveAltere extends Error {}
  return {
    CgvArchiveAltere,
    assurerArchiveCgvCourante: mocks.assurer,
    lireOctetsArchives: mocks.lire,
  };
});
vi.mock("@/server/cgv-pdf", () => ({ rendreCgvPdf: mocks.rendre }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { GET } from "./route";

const ARCHIVE = Buffer.from("%PDF-archive");
const RENDU = Buffer.from("%PDF-rendu-a-la-volee");

beforeEach(() => {
  vi.resetAllMocks();
  mocks.rendre.mockResolvedValue(RENDU);
  mocks.assurer.mockResolvedValue({ version: CGV_VERSION });
});

describe("GET /api/cgv et l'interrupteur", () => {
  it("éteint : rendu à la volée, aucune lecture de l'archive", async () => {
    mocks.allumage.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/cgv"));
    expect(res.status).toBe(200);
    expect(Buffer.from(await res.arrayBuffer())).toEqual(RENDU);
    expect(mocks.assurer).not.toHaveBeenCalled();
    expect(mocks.lire).not.toHaveBeenCalled();
  });

  it("allumé : sert les octets archivés", async () => {
    mocks.allumage.mockResolvedValue(new Date());
    mocks.lire.mockResolvedValue(ARCHIVE);
    const res = await GET(new Request("http://localhost/api/cgv"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(Buffer.from(await res.arrayBuffer())).toEqual(ARCHIVE);
    expect(mocks.rendre).not.toHaveBeenCalled();
  });

  it("allumé et archive altérée : 500, jamais le PDF", async () => {
    mocks.allumage.mockResolvedValue(new Date());
    const { CgvArchiveAltere } = await import("@/server/legal/cgv-archive");
    mocks.lire.mockRejectedValue(new CgvArchiveAltere("v", "altérée"));
    const res = await GET(new Request("http://localhost/api/cgv"));
    expect(res.status).toBe(500);
    expect(mocks.rendre).not.toHaveBeenCalled();
  });
});
