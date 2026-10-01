/**
 * Les liens du mode auditeur vers le SITE PUBLIC mènent à des pages réelles.
 * Un lien vers une page supprimée mènerait l'auditrice sur une 404.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  liensSitePublic,
  originePublique,
  PAGES_PUBLIQUES_PAR_INDICATEUR,
} from "./liens-site-public";

const ORIGINE_INITIALE = process.env["NEXT_PUBLIC_SITE_URL"];

afterEach(() => {
  if (ORIGINE_INITIALE === undefined) delete process.env["NEXT_PUBLIC_SITE_URL"];
  else process.env["NEXT_PUBLIC_SITE_URL"] = ORIGINE_INITIALE;
});

describe("liens vers le site public", () => {
  it("chaque chemin correspond à une page du dépôt (src/app/[locale]/<chemin>/page.tsx)", () => {
    for (const pages of Object.values(PAGES_PUBLIQUES_PAR_INDICATEUR)) {
      for (const page of pages) {
        expect(page.chemin).toMatch(/^\/fr\/[a-z-]+$/);
        const segment = page.chemin.replace(/^\/fr\//, "");
        const fichier = join(process.cwd(), "src", "app", "[locale]", segment, "page.tsx");
        expect(existsSync(fichier), `${page.chemin} → ${fichier}`).toBe(true);
      }
    }
  });

  it("indicateurs 1 / 9 / 26 / 31, et eux seuls", () => {
    expect(Object.keys(PAGES_PUBLIQUES_PAR_INDICATEUR).map(Number)).toEqual([1, 9, 26, 31]);
    expect(liensSitePublic(1, "https://axion-ia.com").map((l) => l.url)).toEqual([
      "https://axion-ia.com/fr/formations",
      "https://axion-ia.com/fr/conditions-generales",
    ]);
    expect(liensSitePublic(9, "https://axion-ia.com")[0]?.url).toBe(
      "https://axion-ia.com/fr/reglement-interieur",
    );
    expect(liensSitePublic(26, "https://axion-ia.com")[0]?.url).toBe(
      "https://axion-ia.com/fr/accessibilite",
    );
    expect(liensSitePublic(31, "https://axion-ia.com")[0]?.url).toBe(
      "https://axion-ia.com/fr/reclamations",
    );
    expect(liensSitePublic(4)).toEqual([]);
  });

  it("l'origine est celle configurée, sans barre finale ; repli sur axion-ia.com", () => {
    process.env["NEXT_PUBLIC_SITE_URL"] = "https://recette.axion-ia.com/";
    expect(originePublique()).toBe("https://recette.axion-ia.com");
    delete process.env["NEXT_PUBLIC_SITE_URL"];
    expect(originePublique()).toBe("https://axion-ia.com");
  });
});
