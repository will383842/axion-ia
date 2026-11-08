/**
 * LES CAS CONCRETS SONT ÉTEINTS (2026-11-08, audit d'harmonie, retrait juridique).
 *
 * Les 5 cas de `case-studies.ts` sont inventés et présentés comme « réellement
 * livrés ». Tant que `CAS_CONCRETS_AFFICHES` est `false` :
 *  - les pages et le flux RSS répondent 404 ;
 *  - plus aucun lien (en-tête, pied, menu Ressources) ;
 *  - ni sitemap `cas-concrets` ni ligne dans `llms.txt` / `llms-full.txt`.
 * Le contenu n'est pas effacé.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CAS_CONCRETS_AFFICHES } from "@/content/preuves-sociales";
import { CASE_STUDIES } from "@/content/case-studies";

const RACINE = path.resolve(__dirname, "../../..");
const lire = (p: string) => readFileSync(path.join(RACINE, p), "utf8");

describe("cas concrets éteints", () => {
  it("l'interrupteur est à false", () => {
    expect(CAS_CONCRETS_AFFICHES).toBe(false);
  });

  it("le contenu n'est PAS effacé", () => {
    expect(CASE_STUDIES.length).toBeGreaterThan(0);
  });

  it.each([
    "src/app/[locale]/cas-concrets/page.tsx",
    "src/app/[locale]/cas-concrets/[slug]/page.tsx",
    "src/app/[locale]/cas-concrets/secteur/[slug]/page.tsx",
    "src/app/[locale]/cas-concrets/feed.xml/route.ts",
  ])("%s est gardé par l'interrupteur", (fichier) => {
    const src = lire(fichier);
    expect(src).toContain("CAS_CONCRETS_AFFICHES");
    expect(src).toMatch(/if \(!CAS_CONCRETS_AFFICHES\)/);
  });

  it.each([
    "src/components/nav/Header.tsx",
    "src/components/nav/Footer.tsx",
    "src/components/nav/HeaderResourcesMenu.tsx",
    "src/app/sitemap.ts",
    "src/app/llms.txt/route.ts",
    "src/app/llms-full.txt/route.ts",
  ])("%s lit l'interrupteur", (fichier) => {
    expect(lire(fichier)).toContain("CAS_CONCRETS_AFFICHES");
  });

  it("aucun lien /cas-concrets ne reste en dur dans les pages publiques hors garde", () => {
    // Les pages d'implémentation, l'accueil, 404/erreur, méthodologie, confirmation
    // et le profil fondateur ne doivent plus mener vers une page en 404.
    for (const fichier of [
      "src/app/[locale]/page.tsx",
      "src/app/[locale]/not-found.tsx",
      "src/app/[locale]/error.tsx",
      "src/app/[locale]/methodologie/page.tsx",
      "src/app/[locale]/confirmation/page.tsx",
      "src/components/sections/FounderProfile.tsx",
    ]) {
      const src = lire(fichier);
      const lignes = src.split("\n").filter((l) => l.includes("/cas-concrets"));
      for (const l of lignes) {
        // une occurrence n'est tolérée que si l'interrupteur est dans le fichier
        expect(src, `${fichier} : ${l.trim()}`).toContain("CAS_CONCRETS_AFFICHES");
      }
    }
  });
});
