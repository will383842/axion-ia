/**
 * Passe « Search Console » du 28/11/2026 : titres et descriptions des pages bien placées mais
 * peu cliquées. Titre < 60 caractères, marque « Axion IA » en fin ; description de 150 à 160.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { WILLIAMS_META_DESCRIPTION, WILLIAMS_TITRE_SEO } from "@/content/equipe/williams";
import { REGIONS } from "@/content/regions";
import { titreRegion } from "@/content/villes/journee-ia-locale";
import { detecterInterdits } from "@/lib/contenu/interdits-publication";

const lire = (p: string) => readFileSync(p, "utf8");

describe("titres Search Console", () => {
  it("Williams : titre court, marque en fin, description 150-160", () => {
    expect(WILLIAMS_TITRE_SEO.length).toBeLessThan(60);
    expect(WILLIAMS_TITRE_SEO.endsWith("Axion IA")).toBe(true);
    expect(WILLIAMS_META_DESCRIPTION.length).toBeGreaterThanOrEqual(150);
    expect(WILLIAMS_META_DESCRIPTION.length).toBeLessThanOrEqual(160);
  });

  it("Auvergne-Rhône-Alpes : le titre annonce le bénéfice, pas seulement « La Journée IA »", () => {
    const r = REGIONS.find((x) => x.slug === "auvergne-rhone-alpes")!;
    const t = titreRegion(r);
    expect(t).toMatch(/audit et formation/i);
    expect(t.length).toBeLessThanOrEqual(60);
  });

  it("a-propos et devenir-commercial-ia : textes en 60 / 150-160, sans interdit", () => {
    const apropos = lire("src/app/[locale]/a-propos/page.tsx");
    const t1 = /"(À propos : équipe[^"]+)"/.exec(apropos)![1]!;
    const d1 = /"(Axion IA aide les TPE[^"]+)"/.exec(apropos)![1]!;
    const devenir = lire("src/app/[locale]/devenir-commercial-ia/page.tsx");
    const t2 = /"(Devenir apporteur d'affaires IA, sans CV[^"]+)"/.exec(devenir)![1]!;
    const d2 =
      /"(Vous connaissez des dirigeants de PME \? Présentez-leur la Journée IA :[^"]+)"/.exec(
        devenir,
      )![1]!;
    for (const t of [t1, t2]) {
      expect(t.length).toBeLessThan(60);
      expect(t.endsWith("Axion IA")).toBe(true);
    }
    for (const d of [d1, d2]) {
      expect(d.length).toBeGreaterThanOrEqual(150);
      expect(d.length).toBeLessThanOrEqual(160);
    }
    for (const x of [t1, d1, t2, d2]) {
      expect(detecterInterdits(x, { actualite: false, financementPublicAutorise: false })).toEqual(
        [],
      );
    }
  });
});
