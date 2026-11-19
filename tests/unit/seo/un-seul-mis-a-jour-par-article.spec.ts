/**
 * Une page article n'affiche qu'UN SEUL « Mis à jour le » : celui de l'en-tête.
 * Le bloc de transparence porte la date de vérification des sources, un autre
 * fait (attesté par le pipeline) : il dit « Sources vérifiées le », jamais
 * « Mis à jour le », sinon deux dates différentes portent la même étiquette.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function code(relatif: string): string {
  const src = readFileSync(path.join(process.cwd(), relatif), "utf8");
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const BLOC = "src/components/content-gen/ArticleTransparencyBlock.tsx";
const PAGES = [
  "src/app/[locale]/blog/[slug]/page.tsx",
  "src/app/[locale]/actualites/[slug]/page.tsx",
  "src/app/[locale]/guides/[slug]/page.tsx",
];
const ETIQUETTE = /Mis à jour le/g;

describe("un seul « Mis à jour le » par page article", () => {
  it("le bloc de transparence ne porte pas l'étiquette « Mis à jour »", () => {
    const bloc = code(BLOC);
    expect(bloc.match(ETIQUETTE) ?? []).toHaveLength(0);
    expect(bloc).not.toMatch(/Updated (on )?"/);
    expect(bloc).toContain("Sources vérifiées le");
    expect(bloc).toContain("Sources checked on");
  });

  it.each(PAGES)("%s : au plus une étiquette « Mis à jour » (page + bloc)", (page) => {
    const total =
      (code(page).match(ETIQUETTE) ?? []).length + (code(BLOC).match(ETIQUETTE) ?? []).length;
    expect(total).toBeLessThanOrEqual(1);
  });
});
