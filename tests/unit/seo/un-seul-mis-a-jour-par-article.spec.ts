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

  // Le libellé s'affiche à deux endroits : l'en-tête de la page, et AuthorByline (bas de page) SI la
  // page lui passe `lastReviewedAt`. blog et actualites portent l'en-tête dans la page, sans date dans
  // AuthorByline ; guides n'a pas d'en-tête daté : sa seule date est celle d'AuthorByline.
  const BYLINE = "src/components/knowledge/public/AuthorByline.tsx";

  it.each(PAGES)("%s : exactement une étiquette « Mis à jour » visible", (page) => {
    const src = code(page);
    const dansPage = (src.match(ETIQUETTE) ?? []).length;
    const dansBloc = (code(BLOC).match(ETIQUETTE) ?? []).length;
    const dansByline = /lastReviewedAt=/.test(src)
      ? (code(BYLINE).match(ETIQUETTE) ?? []).length
      : 0;
    expect(dansPage + dansBloc + dansByline).toBe(1);
  });
});
