/**
 * Ordre de Will (25/10/2026) : le menu latéral NE CHANGE PAS (ni couleur, ni
 * structure, ni largeur). La « peau dossier » `.admin-ton-dossier` ne doit
 * s'appliquer qu'au CONTENU des pages (layouts de `qualiopi/clients` et
 * `rendez-vous`), jamais au menu.
 *
 * Trois verrous :
 *  1. la classe n'est posée que par les deux layouts de contenu prévus ;
 *  2. aucune règle de la peau ne cible le menu (rail, barre du haut, coque) ;
 *  3. la peau ne redéfinit aucune variable du menu (`--color-admin-rail-*`,
 *     largeur, hauteur de barre).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, it, expect } from "vitest";

const RACINE = process.cwd();
const ADMIN = join(RACINE, "src", "app", "[locale]", "(admin)", "[adminPrefix]");
const CSS = readFileSync(join(RACINE, "src", "app", "admin.css"), "utf8");

function fichiers(dossier: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dossier)) {
    if (e === "__tests__" || e === "node_modules") continue;
    const c = join(dossier, e);
    if (statSync(c).isDirectory()) fichiers(c, acc);
    else if (/\.tsx?$/.test(e) && !/\.(test|spec)\.tsx?$/.test(e)) acc.push(c);
  }
  return acc;
}

/** Corps de chaque règle dont le sélecteur nomme `.admin-ton-dossier`. */
function reglesDeLaPeau(): { selecteur: string; corps: string }[] {
  const sans = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: { selecteur: string; corps: string }[] = [];
  const re = /([^{}]*\.admin-ton-dossier[^{}]*)\{([^{}]*)\}/g;
  for (const m of sans.matchAll(re)) {
    out.push({ selecteur: (m[1] as string).trim().replace(/\s+/g, " "), corps: m[2] as string });
  }
  return out;
}

describe("la peau dossier ne touche pas au menu latéral", () => {
  it("CONTRE-TÉMOIN : l'analyse voit les règles de la peau", () => {
    expect(reglesDeLaPeau().length).toBeGreaterThan(10);
  });

  it("n'est posée que par les layouts de contenu des clients et des rendez-vous", () => {
    const poseurs = fichiers(join(RACINE, "src"))
      .filter((f) => /layout\.tsx$/.test(f))
      .filter((f) => readFileSync(f, "utf8").includes("admin-ton-dossier"))
      .map((f) =>
        f
          .slice(RACINE.length + 1)
          .split(sep)
          .join("/"),
      )
      .sort();
    expect(poseurs).toEqual([
      "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/clients/layout.tsx",
      "src/app/[locale]/(admin)/[adminPrefix]/rendez-vous/layout.tsx",
    ]);
  });

  it("ni la coque de la console ni le menu ne portent la classe", () => {
    const coque = [
      join(ADMIN, "layout.tsx"),
      ...fichiers(join(RACINE, "src", "components", "admin")).filter((f) =>
        /(Sidebar|Topbar|Rail|UserMenu|Notifications)/.test(f),
      ),
    ];
    for (const f of coque) {
      expect(readFileSync(f, "utf8"), f).not.toContain("admin-ton-dossier");
    }
  });

  it("aucune règle de la peau ne cible le menu", () => {
    const fautives = reglesDeLaPeau()
      .filter((r) => /rail|sidebar|topbar|nav\b|aside|admin-layout/i.test(r.selecteur))
      .map((r) => r.selecteur);
    expect(fautives).toEqual([]);
  });

  it("la peau ne redéfinit aucune variable du menu", () => {
    const fautives = reglesDeLaPeau()
      .flatMap((r) => [...r.corps.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1] as string))
      .filter((v) => /rail|sidebar|topbar|nav|width|-w$/.test(v));
    expect(fautives).toEqual([]);
  });
});
