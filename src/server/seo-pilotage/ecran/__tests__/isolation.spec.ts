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
    const publics = [
      ...fichiers(join(RACINE, "src/components")).filter(
        (f) => !f.replace(/\\/g, "/").includes("/components/admin/"),
      ),
      ...readdirSync(join(RACINE, "src/app/[locale]"), { withFileTypes: true })
        .filter((d) => d.isDirectory() && d.name !== "(admin)" && !d.name.startsWith("["))
        .flatMap((d) => fichiers(join(RACINE, "src/app/[locale]", d.name))),
    ];
    expect(publics.length).toBeGreaterThan(100);
    const fautifs = publics.filter((f) =>
      /from\s+["'][^"']*(seo-pilotage|actions\/content-gen\/pilotage)/.test(
        readFileSync(f, "utf8"),
      ),
    );
    expect(fautifs).toEqual([]);
  });
});
