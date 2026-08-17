// @vitest-environment node
//
// Environnement `node` : le module lit `process.env` et des fichiers du dépôt.

/**
 * Verrou GEO-094 — les images téléversées depuis la console ne s'affichaient ni
 * ne se téléchargeaient en production (audit GEO/AEO du 2026-08-14, lot 18).
 *
 * ## Trois écarts qui s'empilaient
 *
 * 1. **Chemin d'écriture ≠ chemin de lecture.** Le pipeline d'import écrivait
 *    sous `/var/data/image-bank`, la route de téléchargement lisait sous
 *    `/data/image-bank`. La variable n'étant déclarée nulle part, les deux
 *    défauts s'appliquaient réellement : on lisait dans un dossier où rien n'a
 *    jamais été écrit.
 * 2. **Le nom du dossier ne correspondait pas à l'id de la ligne.** L'import
 *    créait `<base>/<randomUUID()>/` et jetait cet uuid ; Prisma en générait un
 *    autre. Or TOUS les consommateurs publics reconstruisent
 *    `{CDN}/image-bank/{image.id}/…`.
 * 3. **`publicUrlFromLocalPath` produisait `//var/data/…`** — un `//` de tête
 *    n'est pas un chemin mais une **URL protocole-relative**, que le navigateur
 *    résout en `https://var/data/…`.
 *
 * Le symptôme (3) avait déjà été contourné à la main dans `resolveAdminThumbSrc`
 * le 2026-08-02 sans que la cause soit corrigée — d'où cette garde, qui vise la
 * cause et pas le contournement.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { getStorageBasePath, publicUrlFromLocalPath } from "@/server/image-bank/utils/paths";

// `vi.stubEnv` plutot que `Object.defineProperty` : sous Vitest, `process.env`
// est un proxy qui refuse un descripteur partiel (« only accepts a configurable,
// writable, and enumerable data descriptor »). Paye en ecrivant ce test.
function forcerEnv(valeur: string): void {
  vi.stubEnv("NODE_ENV", valeur);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GEO-094 — l'URL produite est toujours servable", () => {
  it("🔴 en production, ne produit JAMAIS de `//` de tête", () => {
    // 🔑 Le coeur du defaut : `//var/data/...` est une URL protocole-relative.
    // Le navigateur la resout en `https://var/data/...`, un hote inexistant.
    const url = publicUrlFromLocalPath("/var/data/image-bank/abc-123/image-lg.webp");
    expect(url.startsWith("//"), `URL protocole-relative produite : ${url}`).toBe(false);
    expect(url).toBe("/image-bank/abc-123/image-lg.webp");
  });

  it("produit la MÊME forme en développement", () => {
    // La forme servable ne doit pas dependre de l'environnement : c'est ce que
    // reconstruisent deja tous les consommateurs publics.
    expect(publicUrlFromLocalPath("public/image-bank/abc-123/image-lg.webp")).toBe(
      "/image-bank/abc-123/image-lg.webp",
    );
  });

  it("normalise les séparateurs Windows", () => {
    expect(publicUrlFromLocalPath("public\\image-bank\\abc-123\\thumb.webp")).toBe(
      "/image-bank/abc-123/thumb.webp",
    );
  });

  it("toutes les variantes du pipeline restent dans le même dossier", () => {
    for (const f of ["image-sm.webp", "image-lg.avif", "og.webp", "thumb.webp"]) {
      expect(publicUrlFromLocalPath(`/var/data/image-bank/uuid-x/${f}`)).toBe(
        `/image-bank/uuid-x/${f}`,
      );
    }
  });

  it("un chemin trop court ne fabrique pas une URL au hasard", () => {
    // Repli explicite : mieux vaut l'ancien comportement qu'une URL inventee.
    expect(publicUrlFromLocalPath("fichier.webp")).toBe("/fichier.webp");
  });
});

describe("GEO-094 — une seule source de vérité pour la racine de stockage", () => {
  it("le défaut de production est unique et documenté", () => {
    forcerEnv("production");
    vi.stubEnv("IMAGE_BANK_STORAGE_PATH", "");
    expect(getStorageBasePath()).toBe("/var/data/image-bank");
  });

  it("la variable d'environnement prime", () => {
    forcerEnv("production");
    vi.stubEnv("IMAGE_BANK_STORAGE_PATH", "/mnt/images");
    expect(getStorageBasePath()).toBe("/mnt/images");
  });

  it("hors production, le stockage reste sous `public/`", () => {
    forcerEnv("development");
    expect(getStorageBasePath()).toBe("public/image-bank");
  });
});
