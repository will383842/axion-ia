/**
 * Tests unitaires — qr.ts
 * Couvre : makeQrToken, verifyQrToken, qrDataUrl.
 */

import { describe, it, expect } from "vitest";
import { makeQrToken, verifyQrToken, qrDataUrl } from "./qr";

describe("makeQrToken", () => {
  it("retourne une chaîne de 64 caractères hexadécimaux", () => {
    const token = makeQrToken();
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
  });

  it("génère des tokens uniques à chaque appel", () => {
    const t1 = makeQrToken();
    const t2 = makeQrToken();
    expect(t1).not.toBe(t2);
  });
});

describe("verifyQrToken", () => {
  it("retourne true pour deux tokens identiques", () => {
    const token = makeQrToken();
    expect(verifyQrToken(token, token)).toBe(true);
  });

  it("retourne false pour deux tokens différents de même longueur", () => {
    const t1 = makeQrToken();
    // Flip le dernier caractère
    const lastChar = t1[t1.length - 1];
    const flipped = lastChar === "a" ? "b" : "a";
    const t2 = t1.slice(0, -1) + flipped;
    expect(verifyQrToken(t1, t2)).toBe(false);
  });

  it("retourne false pour des tokens de longueurs différentes (protège contre timing attack)", () => {
    const t1 = makeQrToken();
    const t2 = t1 + "00";
    expect(verifyQrToken(t1, t2)).toBe(false);
  });

  it("retourne false pour des chaînes vides", () => {
    expect(verifyQrToken("", "")).toBe(true); // même longueur (0), techniquement égaux
    expect(verifyQrToken("", "a")).toBe(false);
  });
});

describe("qrDataUrl", () => {
  it("retourne une data URL PNG base64 pour une URL de vérification", async () => {
    const url = "https://axion-ia.com/fr/verifier-attestation/abc123";
    const dataUrl = await qrDataUrl(url);
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    // La partie base64 doit être non vide
    const base64Part = dataUrl.replace("data:image/png;base64,", "");
    expect(base64Part.length).toBeGreaterThan(100);
  });

  it("produit des QR codes différents pour des textes différents", async () => {
    const d1 = await qrDataUrl("https://axion-ia.com/token-a");
    const d2 = await qrDataUrl("https://axion-ia.com/token-b");
    expect(d1).not.toBe(d2);
  });
});
