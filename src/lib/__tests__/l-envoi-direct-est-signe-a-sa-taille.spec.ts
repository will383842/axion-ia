// @vitest-environment node

/**
 * L'URL d'envoi DIRECT d'une pièce jointe du contact (2026-10-15) — vrai SDK,
 * signature hors ligne, aucun appel réseau.
 *
 * Verrouillé : la longueur EXACTE et le type sont signés (R2 refuse un `PUT`
 * d'une autre longueur ou d'un autre type), la durée de vie est celle
 * demandée, et l'URL n'embarque AUCUNE somme de contrôle calculée sur un corps
 * vide — défaut du SDK qui ferait refuser tout envoi réel.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { signerEnvoiDirectR2 } from "@/lib/r2-storage";

const AVANT = { ...process.env };

beforeAll(() => {
  process.env["R2_ACCOUNT_ID"] = "compte";
  process.env["R2_ACCESS_KEY_ID"] = "cle";
  process.env["R2_SECRET_ACCESS_KEY"] = "secret-cle";
  process.env["R2_BUCKET_NAME"] = "axion-ia-test";
});
afterAll(() => {
  process.env = AVANT;
});

describe("signerEnvoiDirectR2", () => {
  it("signe content-length et content-type, pour la durée demandée, sans checksum", async () => {
    const url = new URL(
      await signerEnvoiDirectR2(
        "contact/pieces-temporaires/2026-10-15/abc",
        25 * 1024 * 1024,
        "application/octet-stream",
        600,
      ),
    );
    const signes = (url.searchParams.get("X-Amz-SignedHeaders") ?? "").split(";");
    expect(signes).toEqual(expect.arrayContaining(["content-length", "content-type", "host"]));
    expect(url.searchParams.get("X-Amz-Expires")).toBe("600");
    expect([...url.searchParams.keys()].some((k) => /checksum/i.test(k))).toBe(false);
    expect(url.pathname).toContain("contact/pieces-temporaires/2026-10-15/abc");
  });

  it("refuse une taille invalide", async () => {
    for (const t of [0, -1, 1.5, Number.NaN]) {
      await expect(signerEnvoiDirectR2("k", t, "application/octet-stream", 600)).rejects.toThrow();
    }
  });
});
