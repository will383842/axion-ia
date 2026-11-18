/**
 * V1-18 — garde : l'auteur IA n'est jamais un `Person` ni « Expert(e) IA ».
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AuthorByline } from "@/components/knowledge/public/AuthorByline";
import { buildPersonManonJsonLd } from "@/lib/seo-content-gen-factories";
import { LIBELLE_PLUME_IA } from "@/lib/seo/plume-ia";

const LIGNE_ANCIENNE = {
  slug: "manon",
  displayName: "Manon",
  jobTitle: "Experte IA chez Axion-IA", // ancienne valeur en base : ne doit plus sortir
  photoUrl1024: "/auteurs/manon.png",
  photoAlt: null,
  knowsAbout: ["Intelligence artificielle opérationnelle"],
  personaDisclaimer: null,
};

describe("V1-18 — la plume IA n'est pas une personne experte", () => {
  it("le JSON-LD est une Organization, sans jobTitle, même si la base dit « Experte IA »", () => {
    const ld = buildPersonManonJsonLd(LIGNE_ANCIENNE);
    expect(ld["@type"]).toBe("Organization");
    expect(ld["name"]).toBe(LIBELLE_PLUME_IA);
    expect(ld["jobTitle"]).toBeUndefined();
    expect(ld["givenName"]).toBeUndefined();
    expect(JSON.stringify(ld)).not.toMatch(/expert(e)?\s+(en\s+)?ia/i);
  });

  it.each([
    "src/components/knowledge/public/AuthorByline.tsx",
    "src/lib/seo-content-gen-factories.ts",
    "src/lib/seo/manon-person.ts",
  ])("%s n'affiche jamais « Expert(e) IA » comme titre d'auteur", (f) => {
    const src = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    expect(src).not.toMatch(/Expert(e)?\s+(en\s+)?IA/);
  });

  it('AuthorByline (authorSlug="manon") émet une Organization avec @id, url FR, jamais Person', () => {
    for (const locale of ["fr", "en"] as const) {
      const html = renderToStaticMarkup(
        AuthorByline({
          authorName: "Manon",
          authorSlug: "manon",
          publishedAt: new Date("2026-01-15T00:00:00.000Z"),
          locale,
        }),
      );
      const m = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/.exec(html);
      expect(m, "JSON-LD absent").not.toBeNull();
      const ld = JSON.parse(m![1]!.replace(/\\u003c/g, "<")) as Record<string, unknown>;
      expect(ld["@type"]).toBe("Organization");
      expect(String(ld["@id"])).toMatch(/\/fr\/equipe\/manon#person$/);
      expect(String(ld["url"])).toMatch(/\/fr\/equipe\/manon$/);
      expect(html).not.toContain('"@type":"Person"');
    }
  });

  it("aucun fichier de src/ ne type Manon / manon#person en Person", () => {
    const fautifs: string[] = [];
    const parcourir = (dir: string): void => {
      for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (statSync(p).isDirectory()) {
          parcourir(p);
        } else if (/\.(ts|tsx)$/.test(e) && !/\.(spec|test)\.tsx?$/.test(e)) {
          const src = readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
          // un littéral `"@type": "Person"` à moins de 200 caractères de Manon / manon#person
          for (const mt of src.matchAll(/"@type":\s*"Person"/g)) {
            const fenetre = src.slice(Math.max(0, mt.index - 200), mt.index + 200);
            if (/manon/i.test(fenetre)) fautifs.push(`${p}:${mt.index}`);
          }
        }
      }
    };
    parcourir("src");
    expect(fautifs).toEqual([]);
  });
});
