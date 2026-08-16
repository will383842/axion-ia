// @vitest-environment node
//
// Environnement `node` : lecture de fichiers du dépôt.

/**
 * Verrou GEO-094 (volet architecture) — le chemin de stockage était résolu à
 * DEUX endroits, avec DEUX défauts différents.
 *
 * Une garde de comportement ne suffit pas ici : le défaut n'était pas une
 * fonction fausse, c'était une **duplication**. `getStorageBasePath()` était
 * correcte ; la route de téléchargement ne l'appelait simplement pas, et
 * recopiait la résolution avec `/data/image-bank` au lieu de
 * `/var/data/image-bank`. Aucun test de comportement sur `getStorageBasePath`
 * n'aurait pu voir ça.
 *
 * 🔑 On surveille donc la propriété qui compte vraiment : **une seule
 * expression `IMAGE_BANK_STORAGE_PATH` dans tout `src/`**. Dès qu'un second
 * appelant réintroduit son propre repli, la divergence redevient possible.
 */

import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { readdirSync, statSync } from "node:fs";

import { describe, expect, it } from "vitest";

const RACINE = process.cwd();

function fichiersSource(dossier: string, acc: string[] = []): string[] {
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      if (entree === "node_modules" || entree === "__tests__") continue;
      fichiersSource(chemin, acc);
    } else if (/\.(ts|tsx)$/.test(entree) && !/\.spec\.tsx?$/.test(entree)) {
      acc.push(chemin);
    }
  }
  return acc;
}

describe("GEO-094 — la racine de stockage n'est résolue qu'à un seul endroit", () => {
  it("🔴 `IMAGE_BANK_STORAGE_PATH` n'est lu que dans `utils/paths.ts` et `env.ts`", () => {
    const coupables: string[] = [];
    for (const fichier of fichiersSource(join(RACINE, "src"))) {
      const contenu = readFileSync(fichier, "utf8");
      if (!contenu.includes("IMAGE_BANK_STORAGE_PATH")) continue;
      const rel = relative(RACINE, fichier).replace(/\\/g, "/");
      // `paths.ts` porte la SSOT ; `env.ts` la déclare (schéma + runtimeEnv).
      if (rel === "src/server/image-bank/utils/paths.ts" || rel === "src/env.ts") continue;
      coupables.push(rel);
    }
    expect(
      coupables,
      "un second endroit resout la racine de stockage : c'est exactement la " +
        "duplication qui a fait lire dans un dossier ou rien n'etait ecrit. " +
        "Appeler `getStorageBasePath()` au lieu de relire l'environnement.",
    ).toEqual([]);
  });

  it("🔴 la route de téléchargement passe bien par la SSOT", () => {
    const route = readFileSync(
      join(RACINE, "src/app/[locale]/galerie/[slug]/telecharger/route.ts"),
      "utf8",
    );
    expect(route).toContain("getStorageBasePath()");
  });

  it("🔴 l'upload impose l'id de la ligne = nom du dossier de stockage", () => {
    // Sans ca, la fiche pointe un dossier qui n'a jamais existe : tous les
    // consommateurs publics reconstruisent `/image-bank/{image.id}/…`.
    const action = readFileSync(
      join(RACINE, "src/server/actions/image-bank/upload.action.ts"),
      "utf8",
    );
    expect(action).toMatch(/id:\s*imported\.uuid/);
  });

  it("les deux variables sont déclarées dans le schéma d'environnement", () => {
    // Non declarees, elles etaient invisibles : chaque appelant repliait sur son
    // propre defaut sans que personne ne puisse le constater.
    const env = readFileSync(join(RACINE, "src/env.ts"), "utf8");
    expect(env).toContain("IMAGE_BANK_STORAGE_PATH");
    expect(env).toContain("IMAGE_BANK_CDN_URL");
  });
});
