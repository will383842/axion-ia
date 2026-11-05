// @vitest-environment node
/**
 * Archive immuable des versions de CGV : idempotence, cohérence texte/version, PDF figé UNE fois.
 */
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CGV_VERSION, CGV_VERSION_LIBELLE } from "@/content/cgv-version";
import { empreinteTexteCgv, texteCanoniqueCgv } from "@/content/cgv-empreinte";

const PDF = Buffer.from("%PDF-1.4 fige");
const PDF_SHA = createHash("sha256").update(PDF).digest("hex");

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  createMany: vi.fn(),
  upload: vi.fn(),
  getBuffer: vi.fn(),
  configured: vi.fn(),
  rendre: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { cgvArchive: { findUnique: mocks.findUnique, createMany: mocks.createMany } },
}));
vi.mock("@/lib/r2-storage", () => ({
  isR2Configured: mocks.configured,
  uploadToR2: mocks.upload,
  getObjectBufferR2: mocks.getBuffer,
}));
vi.mock("@/server/cgv-pdf", () => ({ rendreCgvPdf: mocks.rendre }));

import {
  CgvArchiveAltere,
  CgvArchiveIncoherente,
  CgvArchiveIndisponible,
  assurerArchiveCgvCourante,
  lireOctetsArchives,
} from "./cgv-archive";

function ligne(sur: Partial<{ texteSha256: string; pdfSha256: string; pdfTaille: number }> = {}) {
  return {
    version: CGV_VERSION,
    libelle: CGV_VERSION_LIBELLE,
    texteSha256: empreinteTexteCgv(),
    pdfR2Key: `legal/cgv/${CGV_VERSION}/${PDF_SHA}.pdf`,
    pdfSha256: PDF_SHA,
    pdfTaille: PDF.length,
    archiveeAt: new Date("2026-11-05T10:00:00Z"),
    ...sur,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.configured.mockReturnValue(true);
  mocks.rendre.mockResolvedValue(PDF);
  mocks.upload.mockResolvedValue({ key: "k", etag: null, sizeBytes: PDF.length });
  mocks.createMany.mockResolvedValue({ count: 1 });
});

describe("empreinte du texte canonique", () => {
  it("est le SHA-256 du JSON du texte FR (même calcul que le cliquet)", () => {
    expect(empreinteTexteCgv()).toBe(
      createHash("sha256").update(texteCanoniqueCgv(), "utf8").digest("hex"),
    );
  });
});

describe("assurerArchiveCgvCourante", () => {
  it("version déjà archivée et cohérente : ne rend, ne téléverse et n'écrit rien", async () => {
    mocks.findUnique.mockResolvedValue(ligne());
    const a = await assurerArchiveCgvCourante();
    expect(a.pdfSha256).toBe(PDF_SHA);
    expect(mocks.rendre).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.createMany).not.toHaveBeenCalled();
  });

  it("texte changé sans changement de version : CgvArchiveIncoherente, aucune écriture", async () => {
    mocks.findUnique.mockResolvedValue(ligne({ texteSha256: "0".repeat(64) }));
    await expect(assurerArchiveCgvCourante()).rejects.toBeInstanceOf(CgvArchiveIncoherente);
    expect(mocks.createMany).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("absente : fige le PDF UNE fois sous une clé tirée de son empreinte, puis insère sans écraser", async () => {
    mocks.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(ligne());
    const a = await assurerArchiveCgvCourante();
    expect(mocks.rendre).toHaveBeenCalledTimes(1);
    const [cle, octets, type] = mocks.upload.mock.calls[0] as [string, Buffer, string];
    expect(cle).toBe(`legal/cgv/${CGV_VERSION}/${PDF_SHA}.pdf`);
    expect(octets).toBe(PDF);
    expect(type).toBe("application/pdf");
    const arg = mocks.createMany.mock.calls[0]?.[0] as {
      data: Array<Record<string, unknown>>;
      skipDuplicates: boolean;
    };
    expect(arg.skipDuplicates).toBe(true);
    expect(arg.data[0]).toMatchObject({
      version: CGV_VERSION,
      texteCanonique: texteCanoniqueCgv(),
      texteSha256: empreinteTexteCgv(),
      pdfR2Key: cle,
      pdfSha256: PDF_SHA,
      pdfTaille: PDF.length,
    });
    expect(a.version).toBe(CGV_VERSION);
  });

  it("deux conteneurs en même temps : relit la ligne gagnante et l'utilise", async () => {
    const gagnante = ligne({ pdfSha256: "b".repeat(64) });
    mocks.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(gagnante);
    mocks.createMany.mockResolvedValue({ count: 0 });
    const a = await assurerArchiveCgvCourante();
    expect(a.pdfSha256).toBe("b".repeat(64));
  });

  it("R2 non configuré : CgvArchiveIndisponible, rien n'est écrit en base", async () => {
    mocks.findUnique.mockResolvedValue(null);
    mocks.configured.mockReturnValue(false);
    await expect(assurerArchiveCgvCourante()).rejects.toBeInstanceOf(CgvArchiveIndisponible);
    expect(mocks.createMany).not.toHaveBeenCalled();
  });
});

describe("lireOctetsArchives", () => {
  it("rend les octets quand leur SHA-256 et leur taille correspondent", async () => {
    mocks.getBuffer.mockResolvedValue(PDF);
    await expect(lireOctetsArchives(ligne())).resolves.toEqual(PDF);
  });

  it("octets altérés : CgvArchiveAltere, jamais servis", async () => {
    mocks.getBuffer.mockResolvedValue(Buffer.from("%PDF-1.4 altere"));
    await expect(lireOctetsArchives(ligne())).rejects.toBeInstanceOf(CgvArchiveAltere);
  });

  it("objet absent de R2 : CgvArchiveAltere", async () => {
    mocks.getBuffer.mockResolvedValue(null);
    await expect(lireOctetsArchives(ligne())).rejects.toBeInstanceOf(CgvArchiveAltere);
  });
});
