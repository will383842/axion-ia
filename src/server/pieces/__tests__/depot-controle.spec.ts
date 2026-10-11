// FAC-6 — Le dépôt contrôlé commun : format, taille, antivirus obligatoire, empreinte du
// clair, chiffrement au repos ; messages au caractère près ; alerte limitée au quart d'heure.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { analyserOctets } = vi.hoisted(() => ({ analyserOctets: vi.fn() }));
vi.mock("@/server/careers/clamav", () => ({
  analyserOctets: (...a: unknown[]) => analyserOctets(...a),
}));
vi.mock("@/lib/pii-crypto", () => ({
  chiffrerOctetsPii: (b: Buffer) => Buffer.concat([Buffer.from("AXB1"), b]),
}));

import { createHash } from "node:crypto";

import {
  MESSAGES_DEPOT,
  TAILLE_MAX_PIECE,
  alerteAntivirusLimitee,
  chiffrerPieceAuRepos,
  controlerPiece,
} from "../depot-controle";

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
const alerter = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  analyserOctets.mockResolvedValue({ issue: "sain" });
});

describe("controlerPiece", () => {
  it("pièce saine : empreinte du CLAIR, type déduit du format", async () => {
    const r = await controlerPiece("rib.pdf", PDF, { alerterAntivirusIndisponible: alerter });
    expect(r).toEqual({
      ok: true,
      typeMime: "application/pdf",
      taille: PDF.length,
      sha256: createHash("sha256").update(PDF).digest("hex"),
    });
    expect(analyserOctets).toHaveBeenCalledWith(PDF, 60_000);
  });
  it("format refusé par l'extension ou les premiers octets", async () => {
    expect(await controlerPiece("a.exe", PDF, { alerterAntivirusIndisponible: alerter })).toEqual({
      ok: false,
      message: "Format accepté : PDF, ou photo (JPG, PNG).",
    });
    expect(
      await controlerPiece("a.pdf", new Uint8Array([1, 2, 3, 4]), {
        alerterAntivirusIndisponible: alerter,
      }),
    ).toEqual({ ok: false, message: MESSAGES_DEPOT.format });
    expect(analyserOctets).not.toHaveBeenCalled();
  });
  it("trop lourd", async () => {
    const gros = new Uint8Array(TAILLE_MAX_PIECE + 1);
    gros.set(PDF);
    expect(await controlerPiece("a.pdf", gros, { alerterAntivirusIndisponible: alerter })).toEqual({
      ok: false,
      message: "Le fichier doit faire moins de 10 Mo.",
    });
  });
  it("infecté : refusé, sans alerte", async () => {
    analyserOctets.mockResolvedValue({ issue: "infecte", signature: "Eicar" });
    expect(await controlerPiece("a.pdf", PDF, { alerterAntivirusIndisponible: alerter })).toEqual({
      ok: false,
      message: "Ce fichier a été refusé par notre antivirus. Envoyez-en un autre.",
    });
    expect(alerter).not.toHaveBeenCalled();
  });
  it("antivirus muet ou qui lève : refusé, alerte", async () => {
    analyserOctets.mockResolvedValueOnce({ issue: "indisponible", raison: "délai" });
    analyserOctets.mockRejectedValueOnce(new Error("socket"));
    for (let i = 0; i < 2; i++) {
      expect(await controlerPiece("a.pdf", PDF, { alerterAntivirusIndisponible: alerter })).toEqual(
        {
          ok: false,
          message: "Le contrôle du fichier n'a pas pu se faire. Réessayez dans un instant.",
        },
      );
    }
    expect(alerter).toHaveBeenCalledTimes(2);
  });
});

describe("chiffrerPieceAuRepos", () => {
  it("enveloppe AXB1", () => {
    expect(chiffrerPieceAuRepos(PDF)).toEqual(
      Buffer.concat([Buffer.from("AXB1"), Buffer.from(PDF)]),
    );
  });
});

describe("alerteAntivirusLimitee", () => {
  it("une alerte par quart d'heure au plus", () => {
    const signaler = vi.fn();
    const a = alerteAntivirusLimitee(signaler);
    const t = 1_000_000_000;
    expect(a.alerter(t)).toBe(true);
    expect(a.alerter(t + 14 * 60 * 1000)).toBe(false);
    expect(a.alerter(t + 15 * 60 * 1000)).toBe(true);
    a.reinitialiser();
    expect(a.alerter(t + 15 * 60 * 1000 + 1)).toBe(true);
    expect(signaler).toHaveBeenCalledTimes(3);
  });
});
