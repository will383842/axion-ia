// @vitest-environment node

/**
 * LES PORTES DU DÉPÔT D'UN CANDIDAT (L5b) — au plus juste, et seulement allumées.
 *
 *  - CSP de la console : le lecteur vidéo lit l'origine EXACTE du compartiment
 *    de la bibliothèque (`media-src`), et rien quand la bibliothèque est éteinte ;
 *  - la page de dépôt est la SEULE page du lien qui charge un script (`'self'`)
 *    et parle au stockage (`connect-src`) ; la page de téléchargement reste sans script ;
 *  - le composeur : le dépôt n'est autorisé que si Will le coche ; le message le dit ;
 *  - la notice de confidentialité FR + EN dit le dépôt d'un fichier, sans durée
 *    de suppression ni purge.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { buildCspHeader } from "@/lib/csp";
import { origineStockagePartages } from "../config";
import { paragrapheFichiers } from "../liens";

const ENV = {
  R2_ACCOUNT_ID: "abc123",
  R2_PARTAGES_BUCKET_NAME: "axion-ia-partages",
  R2_PARTAGES_ACCESS_KEY_ID: "cle",
  R2_PARTAGES_SECRET_ACCESS_KEY: "secret-cle",
  PARTAGES_SECRET: "s".repeat(40),
};

const CLES = Object.keys(ENV);
const avant = Object.fromEntries(CLES.map((k) => [k, process.env[k]]));
afterEach(() => {
  for (const k of CLES) {
    if (avant[k] === undefined) delete process.env[k];
    else process.env[k] = avant[k];
  }
});

describe("CSP de la console : media-src", () => {
  it("bibliothèque allumée → l'origine exacte du compartiment, pas un joker", () => {
    expect(origineStockagePartages(ENV)).toBe(
      "https://axion-ia-partages.abc123.r2.cloudflarestorage.com",
    );
    Object.assign(process.env, ENV);
    const csp = buildCspHeader({ nonce: "n", strict: true });
    expect(csp).toContain(
      "media-src 'self' https://axion-ia-partages.abc123.r2.cloudflarestorage.com",
    );
    expect(csp).not.toMatch(/media-src[^;]*\*/);
  });

  it("bibliothèque éteinte → aucune directive media-src ajoutée", () => {
    for (const k of CLES) delete process.env[k];
    expect(origineStockagePartages({})).toBeNull();
    expect(buildCspHeader({ nonce: "n", strict: true })).not.toContain("media-src");
  });

  it("un compte de forme inattendue ne fabrique aucune origine", () => {
    expect(origineStockagePartages({ ...ENV, R2_ACCOUNT_ID: "abc.evil.com/x" })).toBeNull();
  });
});

describe("en-têtes de la page de dépôt (next.config.ts)", () => {
  const cfg = readFileSync(path.join(process.cwd(), "next.config.ts"), "utf8");

  it("une règle propre à /deposer, APRÈS celle de /api/partage, autorise le script 'self' et le stockage", () => {
    const general = cfg.indexOf('source: "/api/partage/:path*"');
    const depot = cfg.indexOf('source: "/api/partage/:id/:jeton/deposer"');
    expect(general).toBeGreaterThan(0);
    expect(depot).toBeGreaterThan(general);
    const bloc = cfg.slice(depot, cfg.indexOf("]", cfg.indexOf("].join", depot) + 6));
    expect(bloc).toContain(`"script-src 'self'"`);
    expect(bloc).toContain(`"connect-src 'self' https://*.r2.cloudflarestorage.com"`);
    expect(bloc).toContain(`"default-src 'none'"`);
    expect(bloc).not.toContain("unsafe-eval");
  });
});

describe("le message envoyé au candidat", () => {
  const fin = new Date("2026-10-15T10:00:00Z");

  it("sans dépôt autorisé : rien sur le dépôt", () => {
    expect(paragrapheFichiers("https://x/y", fin)).not.toContain("déposer");
  });

  it("avec dépôt autorisé : il sait qu'il peut renvoyer sa version", () => {
    expect(paragrapheFichiers("https://x/y", fin, { depotAutorise: true })).toContain(
      "déposer votre version",
    );
  });
});

describe("notice de confidentialité", () => {
  const legal = readFileSync(path.join(process.cwd(), "src/content/legal.ts"), "utf8");

  it("FR et EN disent le dépôt d'un fichier par le lien, sans durée ni purge", () => {
    const fr = /vous pouvez aussi déposer un fichier par ce même lien[^"]*"/.exec(legal)?.[0];
    const en = /you can also upload a file through that same link[^"]*"/.exec(legal)?.[0];
    expect(fr).toBeTruthy();
    expect(en).toBeTruthy();
    for (const phrase of [fr!, en!]) {
      expect(phrase).not.toMatch(/supprim|effac|purg|delet|erase|\bjours\b|\bmois\b|days|months/i);
    }
  });
});
