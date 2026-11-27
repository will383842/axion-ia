import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = resolve(__dirname, "../../../../..");

function fichiers(dossier: string, sortie: string[] = []): string[] {
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) fichiers(chemin, sortie);
    else if (/\.(ts|tsx)$/.test(nom) && !/\.(spec|test)\./.test(nom)) sortie.push(chemin);
  }
  return sortie;
}

describe("le pilotage SEO ne fuit pas vers le site public", () => {
  it("aucun import de seo-pilotage ni de l'écran depuis src/components (hors console) ou les pages publiques", () => {
    const hors = (f: string) => {
      const c = f.replace(/\\/g, "/");
      return (
        !c.includes("/components/admin/") && !c.includes("/(admin)/") && !c.includes("/api/admin/")
      );
    };
    const publics = [
      ...fichiers(join(RACINE, "src/components")),
      ...fichiers(join(RACINE, "src/app")),
    ].filter(hors);
    expect(publics.length).toBeGreaterThan(100);
    const fautifs = publics.filter((f) =>
      /(from|import\s*\()\s*["'][^"']*(seo-pilotage|actions\/content-gen\/pilotage)/.test(
        readFileSync(f, "utf8"),
      ),
    );
    expect(fautifs).toEqual([]);
  });
});
