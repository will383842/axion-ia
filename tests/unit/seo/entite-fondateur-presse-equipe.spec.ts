/**
 * Tests — entité du fondateur sur /fr/presse et /fr/equipe/williams (audit GEO 2026-11-11).
 *
 *  - Le JSON-LD Person de /presse utilise le `@id` canonique (`FOUNDER_PERSON_ID`) et le nom
 *    complet, comme le reste du site : plus de `…/#founder` « Williams ».
 *  - Voix « nous » : ni « lead consultant », ni « dirige les interventions ».
 *  - La meta description de la fiche fondateur : sans ville ni « agence », ≤ 155 caractères.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { FOUNDER } from "@/lib/brand";
import { PRESS_SPOKESPERSONS } from "@/content/press";
import { WILLIAMS_META_DESCRIPTION } from "@/content/equipe/williams";

const ROOT = path.resolve(__dirname, "../../..");
const lire = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const sansCommentaires = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

describe("/presse — une seule entité fondateur", () => {
  const page = sansCommentaires(lire("src/app/[locale]/presse/page.tsx"));

  it("le nœud Person cite FOUNDER_PERSON_ID et le nom complet", () => {
    expect(page).not.toContain("/#founder");
    expect(page).toMatch(/"@id": FOUNDER_PERSON_ID/);
    expect(page).toMatch(/name: FOUNDER\.fullName/);
  });

  it("le porte-parole parle en « nous », sans promesse d'intervention personnelle", () => {
    for (const p of PRESS_SPOKESPERSONS) {
      for (const loc of ["fr", "en"] as const) {
        expect(p[loc].role).not.toMatch(/lead consultant/i);
        expect(p[loc].bio).not.toMatch(
          /dirige les interventions|leads .* engagements|intervient personnellement/i,
        );
      }
      expect(p.fr.role).toBe(FOUNDER.roleLineFr);
      expect(p.en.role).toBe(FOUNDER.roleLineEn);
    }
  });
});

describe("/equipe/williams — meta description", () => {
  // La description vient du contenu de la fiche (`content/equipe/williams.ts`), pas de la route.
  const source = lire("src/app/[locale]/equipe/[slug]/page.tsx");
  const description = WILLIAMS_META_DESCRIPTION;

  it("reprend la description d'entité (Axion-IA, TPE et PME), sans ville ni « agence »", () => {
    expect(source).toContain("contenu.metaDescription");
    expect(description).toMatch(/^Williams Jullin dirige Axion-IA/);
    expect(description).toContain("TPE et PME");
    expect(description).not.toMatch(/Grenoble|agence/i);
    expect(sansCommentaires(source)).not.toMatch(/Grenoble|agence IA/i);
  });

  it("tient en 155 caractères", () => {
    expect(description.length).toBeGreaterThan(80);
    expect(description.length).toBeLessThanOrEqual(155);
  });
});
