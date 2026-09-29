// @vitest-environment node

/**
 * Verrou — la dictée après un rendez-vous téléphonique (B5, base 6.1.f, B14)
 * n'est utilisable que si la notice PUBLIÉE l'annonce (chantier visio, PR 8).
 *
 * `DICTEE_ANNONCEE` est DÉRIVÉE de l'interrupteur de la notice
 * (`src/server/visio/visio-annonce.ts`), jamais réglée à la main : la dictée
 * s'allume le jour où la section qui la décrit est publiée, pas avant. La PR 7
 * code la dictée éteinte ; elle doit lire cette constante.
 *
 * Deux règles :
 *   1. `DICTEE_ANNONCEE` vrai ⇒ la section publiée parle de la dictée
 *      (« dicter », « 6.1.f ») ;
 *   2. la constante n'est pas un littéral `true` dans le source.
 *
 * Contre-témoin : la section d'aujourd'hui ne parle pas de dictée — la règle 1
 * discrimine. Angle mort : la garde ne voit pas un appelant qui ignorerait la
 * constante (c'est la garde de la PR 7 sur la route de dictée).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { LEGAL_PAGES } from "@/content/legal";
import { ANNONCE_VISIO_ACTIVE, DICTEE_ANNONCEE } from "@/server/visio/visio-annonce";
import { sectionRendezVousDecouverte } from "@/content/visio-annonce-textes";

const MENTIONS_DICTEE = [/dicter/, /6\.1\.f/];

function sectionPubliee(): string {
  const page = LEGAL_PAGES.find((p) => p.slug === "politique-confidentialite");
  return page?.fr.sections.find((s) => s.title === "Rendez-vous de découverte")?.body ?? "";
}

function mentionneLaDictee(texte: string): boolean {
  return MENTIONS_DICTEE.every((re) => re.test(texte));
}

describe("la dictée n'est active que si la notice la mentionne", () => {
  it("🔴 dictée annoncée ⇒ la section publiée la décrit", () => {
    if (DICTEE_ANNONCEE) expect(mentionneLaDictee(sectionPubliee())).toBe(true);
    else expect(mentionneLaDictee(sectionPubliee())).toBe(false);
  });

  it("🔴 la constante est dérivée de l'interrupteur, jamais écrite à la main", () => {
    expect(DICTEE_ANNONCEE).toBe(ANNONCE_VISIO_ACTIVE);
    const source = readFileSync(join(process.cwd(), "src/server/visio/visio-annonce.ts"), "utf8");
    expect(source).toMatch(/export const DICTEE_ANNONCEE: boolean = ANNONCE_VISIO_ACTIVE;/);
  });

  it("🔑 CONTRE-TÉMOIN : seul le texte « après » décrit la dictée", () => {
    expect(mentionneLaDictee(sectionRendezVousDecouverte("fr", true))).toBe(true);
    expect(mentionneLaDictee(sectionRendezVousDecouverte("fr", false))).toBe(false);
  });
});
