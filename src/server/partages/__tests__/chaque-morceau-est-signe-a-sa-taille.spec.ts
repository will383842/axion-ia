// @vitest-environment node

/**
 * CHAQUE MORCEAU EST SIGNÉ À SA TAILLE EXACTE (relecture sécurité, 2026-10-08, ADR 0065).
 *
 * Une adresse d'envoi signée sans `content-length` laisse le navigateur pousser
 * n'importe quel volume sur un numéro de morceau : la taille annoncée ne
 * garantit plus rien avant `terminer`. La signature porte donc la longueur
 * exacte du morceau ; R2 refuse un `PUT` d'une autre longueur.
 */

import { describe, expect, it } from "vitest";

import { signerMorceauR2, type CibleR2 } from "@/lib/r2-storage";

import { TAILLE_MORCEAU_OCTETS } from "../regles";

const CIBLE: CibleR2 = {
  accountId: "compte",
  bucket: "axion-ia-partages",
  accessKeyId: "cle",
  secretAccessKey: "secret-cle",
};

function entetesSignes(url: string): string[] {
  return (new URL(url).searchParams.get("X-Amz-SignedHeaders") ?? "").split(";");
}

describe("signerMorceauR2", () => {
  it("signe la longueur exacte du morceau (content-length dans X-Amz-SignedHeaders)", async () => {
    const url = await signerMorceauR2(
      CIBLE,
      "partages/id/a.zip",
      "upload-1",
      1,
      TAILLE_MORCEAU_OCTETS,
      3600,
    );
    expect(entetesSignes(url)).toContain("content-length");
    expect(entetesSignes(url)).toContain("host");
  });

  it("refuse une taille invalide (zéro, négative, non entière, au-delà de 5 Gio)", async () => {
    for (const t of [0, -1, 1.5, Number.NaN, 5 * 1024 ** 3 + 1]) {
      await expect(
        signerMorceauR2(CIBLE, "partages/id/a.zip", "upload-1", 1, t, 3600),
        String(t),
      ).rejects.toThrow();
    }
  });
});
