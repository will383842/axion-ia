/**
 * L'écran des aperçus ne doit rien AFFIRMER qu'il n'a pas constaté.
 *
 * 🔴 DEUX DÉFAUTS VUS EN PRODUCTION LE 2026-08-19, sur le même écran.
 *
 * 1. `orderBy: [{ pathPattern: "asc" }, { ogInspectedAt: "desc" }]` — en
 *    PostgreSQL, `DESC` place les NULL en PREMIER. L'exemple retenu pour chaque
 *    modèle était donc une route JAMAIS relevée : exactement celle qui n'a rien
 *    à montrer. `/fr/implantations/[region]/[ville]` annonçait « 385 relevées »
 *    et affichait « Pas encore relevée ».
 *
 * 2. `natureDe()` ne regardait que `ogImage`. Une route non relevée a
 *    `ogImage = null`, d'où un badge « Aucune image » sur des modèles dont on
 *    ne savait RIEN — pendant que le compteur « Aucune image » affichait 0,
 *    lui qui exclut les non-relevées. L'écran se contredisait à deux endroits.
 *
 * 🔑 « Jamais mesuré » et « mesuré à zéro » sont deux états différents. Les
 * confondre fait afficher un défaut qui n'a pas été constaté — et pousse à
 * corriger une page qui n'a peut-être aucun problème.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE = readFileSync(
  join(process.cwd(), "src/server/actions/site-explorer/og-apercus.ts"),
  "utf8",
);

describe("aperçus — l'exemple montré doit être une route RELEVÉE", () => {
  it("le tri sur `ogInspectedAt` place explicitement les NULL en dernier", () => {
    // Sans `nulls: "last"`, PostgreSQL remonte les non-relevées en tête et
    // l'exemple de chaque modèle redevient muet. Le défaut est invisible en
    // développement (peu de lignes) et systématique en production.
    expect(
      /ogInspectedAt:\s*\{[^}]*sort:\s*"desc"[^}]*nulls:\s*"last"/s.test(SOURCE),
      'Le tri des exemples doit porter `nulls: "last"` — sinon PostgreSQL ' +
        "ramène une route jamais relevée comme exemple de chaque modèle.",
    ).toBe(true);
  });

  it('aucun tri nu `{ ogInspectedAt: "desc" }` ne subsiste', () => {
    expect(
      /\{\s*ogInspectedAt:\s*"desc"\s*\}/.test(SOURCE),
      'Un tri nu `{ ogInspectedAt: "desc" }` remet le défaut : NULL d\'abord.',
    ).toBe(false);
  });
});

describe("aperçus — « pas encore relevée » n'est pas « aucune image »", () => {
  it("`natureDe` reçoit la date de relevé, pas seulement l'image", () => {
    expect(
      /function natureDe\(\s*ogImage: string \| null,\s*ogInspectedAt: Date \| null\s*\)/s.test(
        SOURCE,
      ),
      "`natureDe` doit voir `ogInspectedAt` : sans elle, elle ne peut pas " +
        "distinguer « non mesuré » de « mesuré sans image ».",
    ).toBe(true);
  });

  it("une route non relevée sort en `non_relevee`, jamais en `aucune`", () => {
    // La garde porte sur l'ORDRE des deux tests : le contrôle du relevé doit
    // précéder celui de l'image, sinon `ogImage === null` gagne et le badge
    // ment à nouveau.
    const corps = SOURCE.slice(SOURCE.indexOf("function natureDe("));
    const posRelevé = corps.indexOf('if (!ogInspectedAt) return "non_relevee"');
    const posImage = corps.indexOf('if (!ogImage) return "aucune"');
    expect(
      posRelevé,
      "`natureDe` doit rendre `non_relevee` quand rien n'a été relevé.",
    ).toBeGreaterThan(-1);
    expect(posImage).toBeGreaterThan(-1);
    expect(
      posRelevé < posImage,
      "Le contrôle du relevé doit venir AVANT celui de l'image : sinon une " +
        "route non relevée retombe sur « Aucune image ».",
    ).toBe(true);
  });

  it("`non_relevee` fait partie des natures déclarées", () => {
    expect(/"non_relevee"/.test(SOURCE)).toBe(true);
  });
});
