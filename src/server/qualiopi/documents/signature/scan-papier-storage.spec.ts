/**
 * Tests — scan-papier-storage.ts (lot I3, étape 1).
 *
 * Le scan d'un devis signé à la main est une PREUVE : il est écrit sur R2 sans
 * jamais en écraser un autre, son empreinte porte sur les octets bruts versés,
 * et la suppression ne peut viser que la forme exacte de clé produite ici.
 */

import { createHash } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

const r2 = vi.hoisted(() => ({
  isR2Configured: vi.fn(),
  uploadToR2: vi.fn(),
  deleteFromR2: vi.fn(),
  existsInR2: vi.fn(),
}));
vi.mock("@/lib/r2-storage", () => r2);
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import {
  TAILLE_MAX_SCAN_OCTETS,
  cleScanPapier,
  controlerPdf,
  stockerScanPapier,
  supprimerScanPapier,
} from "./scan-papier-storage";
import { SignatureStockageError } from "@/server/qualiopi/emargement/storage";

const ID = "11111111-1111-4111-8111-111111111111";

function pdf(taille = 2000): Buffer {
  const corps = Buffer.alloc(taille, 0x20);
  const tete = Buffer.from("%PDF-1.7\n");
  const pied = Buffer.from("\n%%EOF\n");
  return Buffer.concat([tete, corps, pied]);
}

beforeEach(() => {
  vi.clearAllMocks();
  r2.isR2Configured.mockReturnValue(true);
  r2.existsInR2.mockResolvedValue(false);
  r2.uploadToR2.mockResolvedValue({ etag: undefined });
  r2.deleteFromR2.mockResolvedValue(undefined);
});

describe("controlerPdf", () => {
  it("accepte un PDF bien formé", () => {
    expect(controlerPdf(pdf())).toEqual({ ok: true });
  });

  it("refuse un PNG renommé en .pdf", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const r = controlerPdf(png);
    expect(r.ok).toBe(false);
  });

  it("refuse un fichier vide", () => {
    expect(controlerPdf(Buffer.alloc(0)).ok).toBe(false);
  });

  it("refuse 10 Mo + 1 octet et accepte exactement 10 Mo", () => {
    expect(TAILLE_MAX_SCAN_OCTETS).toBe(10 * 1024 * 1024);
    const exact = pdf(TAILLE_MAX_SCAN_OCTETS - 9 - 7);
    expect(exact.byteLength).toBe(TAILLE_MAX_SCAN_OCTETS);
    expect(controlerPdf(exact).ok).toBe(true);
    const trop = Buffer.concat([exact, Buffer.from(" ")]);
    expect(trop.byteLength).toBe(TAILLE_MAX_SCAN_OCTETS + 1);
    expect(controlerPdf(trop).ok).toBe(false);
  });

  it("refuse un PDF sans %%EOF dans les 1 024 derniers octets", () => {
    const tronque = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(3000, 0x20)]);
    expect(controlerPdf(tronque).ok).toBe(false);
    const eofTropLoin = Buffer.concat([Buffer.from("%PDF-1.4\n%%EOF\n"), Buffer.alloc(2000, 0x20)]);
    expect(controlerPdf(eofTropLoin).ok).toBe(false);
  });
});

describe("cleScanPapier", () => {
  it("a la forme documents/{année}/devis-signes-papier/{id}.pdf", () => {
    expect(cleScanPapier(2026, ID)).toBe(`documents/2026/devis-signes-papier/${ID}.pdf`);
  });
});

describe("stockerScanPapier", () => {
  it("écrit sous la clé attendue, avec l'empreinte exacte des octets bruts", async () => {
    const octets = pdf();
    const res = await stockerScanPapier({
      octets,
      signeAt: new Date("2026-06-10T10:00:00Z"),
      id: ID,
    });
    expect(res).toEqual({
      key: `documents/2026/devis-signes-papier/${ID}.pdf`,
      sha256: createHash("sha256").update(octets).digest("hex"),
      mimeType: "application/pdf",
      sizeBytes: octets.byteLength,
    });
    expect(r2.uploadToR2).toHaveBeenCalledTimes(1);
    const [cle, corps, mime] = r2.uploadToR2.mock.calls[0]!;
    expect(cle).toBe(res.key);
    expect(Buffer.compare(corps as Buffer, octets)).toBe(0);
    expect(mime).toBe("application/pdf");
  });

  it("range l'année en calendrier de Paris (31/12 23 h 30 UTC = 2027)", async () => {
    const res = await stockerScanPapier({
      octets: pdf(),
      signeAt: new Date("2026-12-31T23:30:00Z"),
      id: ID,
    });
    expect(res.key).toBe(`documents/2027/devis-signes-papier/${ID}.pdf`);
  });

  it("refuse un id qui n'est pas un UUID, sans toucher R2", async () => {
    await expect(
      stockerScanPapier({ octets: pdf(), signeAt: new Date(), id: "../../etc" }),
    ).rejects.toBeInstanceOf(SignatureStockageError);
    expect(r2.uploadToR2).not.toHaveBeenCalled();
  });

  it("refuse d'écraser un objet existant (collision de clé)", async () => {
    r2.existsInR2.mockResolvedValue(true);
    await expect(
      stockerScanPapier({ octets: pdf(), signeAt: new Date(), id: ID }),
    ).rejects.toMatchObject({ motif: "collision_de_cle" });
    expect(r2.uploadToR2).not.toHaveBeenCalled();
  });

  it("ETag différent du MD5 : lève, puis supprime l'objet écrit", async () => {
    r2.uploadToR2.mockResolvedValue({ etag: '"' + "0".repeat(32) + '"' });
    await expect(
      stockerScanPapier({ octets: pdf(), signeAt: new Date("2026-06-10T10:00:00Z"), id: ID }),
    ).rejects.toMatchObject({ motif: "upload_echoue" });
    expect(r2.deleteFromR2).toHaveBeenCalledWith(`documents/2026/devis-signes-papier/${ID}.pdf`);
  });

  it("ETag conforme : réussit sans suppression", async () => {
    const octets = pdf();
    r2.uploadToR2.mockResolvedValue({
      etag: `"${createHash("md5").update(octets).digest("hex")}"`,
    });
    await stockerScanPapier({ octets, signeAt: new Date(), id: ID });
    expect(r2.deleteFromR2).not.toHaveBeenCalled();
  });

  it("lève r2_absent quand R2 n'est pas configuré", async () => {
    r2.isR2Configured.mockReturnValue(false);
    await expect(
      stockerScanPapier({ octets: pdf(), signeAt: new Date(), id: ID }),
    ).rejects.toMatchObject({ motif: "r2_absent" });
    expect(r2.uploadToR2).not.toHaveBeenCalled();
  });

  it("refuse un contenu qui n'est pas un PDF avant tout accès à R2", async () => {
    await expect(
      stockerScanPapier({ octets: Buffer.from("hello"), signeAt: new Date(), id: ID }),
    ).rejects.toBeInstanceOf(SignatureStockageError);
    expect(r2.existsInR2).not.toHaveBeenCalled();
  });
});

describe("supprimerScanPapier", () => {
  it("supprime une clé de la forme exacte", async () => {
    await supprimerScanPapier(`documents/2026/devis-signes-papier/${ID}.pdf`);
    expect(r2.deleteFromR2).toHaveBeenCalledWith(`documents/2026/devis-signes-papier/${ID}.pdf`);
  });

  it.each([
    `emargement/2026/signatures/${ID}.png`,
    `documents/2026/devis-signes-papier/../../invoices/x.pdf`,
    `documents/2026/devis-signes-papier/${ID}.png`,
    `documents/2026/devis/${ID}.pdf`,
    `invoices/2026/AXION-2026-0042.pdf`,
  ])("refuse la clé %s", async (cle) => {
    await expect(supprimerScanPapier(cle)).rejects.toBeInstanceOf(SignatureStockageError);
    expect(r2.deleteFromR2).not.toHaveBeenCalled();
  });
});
