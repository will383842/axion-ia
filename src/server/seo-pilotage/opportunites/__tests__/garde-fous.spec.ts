import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CHEMINS_PROTEGES, appliquerGardeFous, estCheminProtege } from "../garde-fous";
import type { Proposition } from "../types";

function prop(p: Partial<Proposition>): Proposition {
  return {
    detecteur: "a",
    action: "titre_meta",
    url: "https://axion-ia.com/fr/blog/x",
    requete: "formation ia pme",
    gainClics: 10,
    confiance: 0.5,
    effort: 1,
    priorite: 5,
    motif: "m",
    ...p,
  };
}

describe("garde-fous", () => {
  it("transforme en signalement toute action sur une page protégée", () => {
    const r = appliquerGardeFous([prop({ url: "https://axion-ia.com/fr/tarifs" })]);
    expect(r.propositions).toHaveLength(0);
    expect(r.signalements[0]).toMatchObject({ kind: "page_protegee" });
  });
  it("laisse passer une page non protégée", () => {
    expect(appliquerGardeFous([prop({})]).propositions).toHaveLength(1);
  });
  it("écarte « grenoble » dans la requête ou l'URL", () => {
    const r = appliquerGardeFous([
      prop({ requete: "formation ia grenoble" }),
      prop({ url: "https://axion-ia.com/fr/grenoble" }),
    ]);
    expect(r.propositions).toHaveLength(0);
    expect(r.signalements).toHaveLength(0);
  });
  it("écarte une requête portant un interdit de publication", () => {
    const r = appliquerGardeFous([prop({ requete: "formation ia qualiopi" })]);
    expect(r.propositions).toHaveLength(0);
  });
  it("chemins protégés : /en/ ramené à FR, slash, query", () => {
    expect(estCheminProtege("https://axion-ia.com/en/tarifs/?x=1")).toBe(true);
    expect(estCheminProtege("https://axion-ia.com/fr/tarifs-complets-faux")).toBe(false);
  });
  it("accueil protégé, mais pas tout le site", () => {
    expect(estCheminProtege("https://axion-ia.com/fr")).toBe(true);
    expect(estCheminProtege("https://axion-ia.com/fr/blog/x")).toBe(false);
  });
});

/** Verrou : toute page statique qui importe pricing / journee-ia-commun / positionnement / legal est protégée. */
function pages(dir: string, sortie: string[] = []): string[] {
  for (const nom of readdirSync(dir)) {
    const p = join(dir, nom);
    if (statSync(p).isDirectory()) pages(p, sortie);
    else if (nom === "page.tsx") sortie.push(p);
  }
  return sortie;
}
const SOURCES = /from\s+"@\/[^"]*(?:\/pricing|journee-ia-commun|\/positionnement|\/legal)"/;
/** Pages dynamiques : le gabarit sert aussi des pages non protégées. Exclues, à arbitrer par Will. */
const DYNAMIQUES_ASSUMEES = ["[region]", "[slug]"];

describe("CHEMINS_PROTEGES dérivés des imports", () => {
  it("couvre chaque page statique qui importe une source protégée", () => {
    const racine = join(process.cwd(), "src/app/[locale]");
    const manquants: string[] = [];
    for (const f of pages(racine)) {
      if (!SOURCES.test(readFileSync(f, "utf8"))) continue;
      const rel = f.slice(racine.length).replace(/\/page\.tsx$/, "") || "/";
      if (DYNAMIQUES_ASSUMEES.some((d) => rel.includes(d))) continue;
      if (rel.includes("(admin)")) continue;
      if (!estCheminProtege(`https://axion-ia.com/fr${rel === "/" ? "" : rel}`))
        manquants.push(rel);
    }
    expect(manquants).toEqual([]);
    expect(CHEMINS_PROTEGES.length).toBeGreaterThan(5);
  });
});

describe("périmètre des protections", () => {
  it("la catégorie legal est entièrement protégée", () => {
    for (const s of [
      "accessibilite",
      "preferences-cookies",
      "mes-donnees",
      "desabonnement",
      "confirmation",
    ]) {
      expect(estCheminProtege(`https://axion-ia.com/fr/${s}`)).toBe(true);
    }
  });
  it("les gabarits dynamiques formations / implantations restent optimisables", () => {
    expect(estCheminProtege("https://axion-ia.com/fr/formations")).toBe(true);
    expect(estCheminProtege("https://axion-ia.com/fr/formations/chatgpt")).toBe(false);
    expect(
      estCheminProtege("https://axion-ia.com/fr/implantations/auvergne-rhone-alpes/lyon"),
    ).toBe(false);
  });
});

it("/formations/tarifs est protégée (prix issus de pricing.ts via le catalogue)", () => {
  expect(estCheminProtege("https://axion-ia.com/fr/formations/tarifs")).toBe(true);
});
