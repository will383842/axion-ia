/**
 * LES CAS CONCRETS SONT ÉTEINTS (2026-11-08, audit d'harmonie, retrait juridique).
 *
 * Les 5 cas de `case-studies.ts` sont inventés et présentés comme « réellement
 * livrés ». Tant que `CAS_CONCRETS_AFFICHES` est `false` :
 *  - les pages sont redirigées en 301 vers /fr/methodologie (flux RSS compris) ;
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
    // L'en-tête ne porte plus de lien « Cas concrets » depuis la refonte du
    // 2026-11-11 (« Ressources » est passé au pied de page) : seul le pied lit
    // l'interrupteur.
    "src/components/nav/Footer.tsx",
    "src/app/sitemap.ts",
    "src/app/llms.txt/route.ts",
    "src/app/llms-full.txt/route.ts",
    "src/app/api/markdown/[type]/[slug]/route.ts",
    "src/content/press.ts",
    "src/content/faq-resources.ts",
    "src/lib/email/templates/implementation-confirmed.tsx",
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
      "src/components/sections/ProductPageTemplate.tsx",
    ]) {
      const src = lire(fichier);
      const lignes = src.split("\n");
      lignes.forEach((l, i) => {
        if (!l.includes("/cas-concrets")) return;
        // une occurrence n'est tolérée que dans le même bloc (±12 lignes) qu'un `CAS_CONCRETS_AFFICHES ?`
        const bloc = lignes.slice(Math.max(0, i - 12), i + 13).join("\n");
        expect(bloc, `${fichier}:${i + 1} : ${l.trim()}`).toMatch(/CAS_CONCRETS_AFFICHES\s*\?/);
      });
    }
  });

  it("les URLs indexées redirigent en 301 vers /fr/methodologie (pas de 404 sec)", async () => {
    const config = (await import("../../../next.config")).default as {
      redirects?: () => Promise<
        { source: string; destination: string; statusCode?: number; permanent?: boolean }[]
      >;
    };
    const regles = (await config.redirects?.()) ?? [];
    for (const source of [
      "/fr/cas-concrets",
      "/fr/cas-concrets/:path+",
      "/en/case-studies/:path*",
    ]) {
      const r = regles.find((x) => x.source === source);
      expect(r, source).toBeDefined();
      expect(r?.destination).toBe("/fr/methodologie");
      expect(r?.statusCode).toBe(301);
    }
  });

  it("la bascule EN → FR ne mène plus vers /fr/cas-concrets (chaîne finissant en 404)", async () => {
    const { mapEnToFr } = await import("@/lib/i18n/en-to-fr-redirect");
    for (const chemin of [
      "/en/case-studies",
      "/en/case-studies/x",
      "/en/case-studies/industry/y",
    ]) {
      expect(mapEnToFr(chemin)).toBe("/fr/methodologie");
    }
  });
});
