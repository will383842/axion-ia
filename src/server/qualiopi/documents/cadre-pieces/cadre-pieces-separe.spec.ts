import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = resolve(process.cwd(), "src");
const DOSSIER = join(RACINE, "server/qualiopi/documents/cadre-pieces");

function fichiers(dir: string): string[] {
  return readdirSync(dir).flatMap((nom) => {
    const chemin = join(dir, nom);
    return statSync(chemin).isDirectory() ? fichiers(chemin) : [chemin];
  });
}

/** Code seul : les commentaires d'historique peuvent citer les anciens noms. */
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const sources = fichiers(DOSSIER).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.spec\.tsx?$/.test(f));

describe("cadre-pieces séparé des pièces signables", () => {
  it("sentinelle : le dossier contient bien les fichiers du cadre", () => {
    const noms = sources.map((f) => f.slice(DOSSIER.length + 1));
    for (const n of ["page.tsx", "blocs.tsx", "tableau.tsx", "encadre.tsx", "index.ts"]) {
      expect(noms).toContain(n);
    }
  });

  it("aucun fichier du cadre n'importe ni n'appelle brandColor ni SignatureZone", () => {
    for (const f of sources) {
      const src = sansCommentaires(readFileSync(f, "utf8"));
      expect(src, f).not.toMatch(/\bbrandColor\b/);
      expect(src, f).not.toMatch(/\bSignatureZone\b/);
    }
  });

  it("le cadre des pièces n'est jamais importé par un fichier de devis", () => {
    const devis = fichiers(RACINE).filter(
      (f) =>
        /\.(ts|tsx)$/.test(f) &&
        !f.startsWith(DOSSIER) &&
        /(devis|quote)/i.test(f.slice(RACINE.length)),
    );
    expect(devis.length).toBeGreaterThan(0);
    for (const f of devis) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/cadre-pieces/);
    }
  });
});
