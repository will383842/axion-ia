/**
 * Câblage du gate d'accessibilité — garde-fous d'infrastructure (constat X5).
 *
 * `tests/e2e/a11y.spec.ts` était CORRECT et n'a pourtant jamais mesuré la
 * production pendant 76 nuits. Aucun test fonctionnel ne pouvait le voir : le
 * défaut n'était pas dans le code testé, il était dans son CÂBLAGE.
 *
 *   1. Le job nocturne exportait un nom d'environnement que rien ne lit —
 *      `playwright.config.ts` lit `E2E_BASE_URL`. Playwright retombait sur
 *      localhost, y démarrait un serveur alors qu'aucun build n'avait eu lieu, et
 *      les 15 tests échouaient en ERR_CONNECTION_REFUSED. Le job s'appelait
 *      « vs prod » sans jamais atteindre la prod.
 *   2. Une fois le nom corrigé, le job est devenu DANGEREUX : la suite complète
 *      pointée sur la prod soumet le formulaire de contact et tente des
 *      connexions admin. Le périmètre doit rester borné au fichier a11y.
 *   3. `scripts/check-contrast.ts` gardait un miroir MANUEL de la palette qui
 *      avait divergé de `globals.css` : il validait des couleurs mortes.
 *   4. Les surfaces publiques revendiquaient « WCAG 2.2 AA » pendant que la
 *      déclaration légale disait « non audité à ce jour ».
 *
 * Un défaut de câblage se teste comme tel : en lisant les fichiers de
 * configuration. Ce fichier n'exécute rien — il vérifie que les branchements sont
 * bien ceux qu'on croit.
 *
 * ⚠️ RÈGLE DE RÉDACTION DE CE FICHIER — chaque assertion négative est ancrée sur
 * de la SYNTAXE (une clé `run:`, une clé d'environnement, un champ `text: "`),
 * jamais sur une chaîne nue. La première version de ce gate interdisait des
 * chaînes brutes et tombait sur les commentaires qui EXPLIQUENT le correctif :
 * un contrôle qui confond une explication avec le fait qu'elle explique est un
 * contrôle faux — c'était déjà le vice de X5. Ne pas régresser là-dessus.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// Vitest s'exécute depuis la racine du dépôt (`pnpm test`). On évite
// `import.meta.dirname` : la transformation SSR de Vitest ne le garantit pas.
const RACINE = process.cwd();

function lire(relatif: string): string {
  return readFileSync(path.join(RACINE, ...relatif.split("/")), "utf8");
}

/** Lignes YAML effectives : on retire les commentaires (`#` en tête de ligne). */
function effectif(yaml: string): string {
  return yaml
    .split(/\r?\n/)
    .filter((l) => !/^\s*#/.test(l))
    .join("\n");
}

const WORKFLOWS = readdirSync(path.join(RACINE, ".github", "workflows")).filter((f) =>
  f.endsWith(".yml"),
);

/** Une valeur `E2E_BASE_URL:` qui ne pointe pas sur la machine du runner. */
const E2E_BASE_URL_DISTANT = /E2E_BASE_URL:\s*(?!.*(?:localhost|127\.0\.0\.1))\S+/;

describe("Câblage du gate a11y — workflows", () => {
  it("aucun workflow ne DÉFINIT PLAYWRIGHT_BASE_URL (nom mort, jamais lu)", () => {
    for (const fichier of WORKFLOWS) {
      expect(
        effectif(lire(`.github/workflows/${fichier}`)),
        `${fichier} : seul E2E_BASE_URL est lu par playwright.config.ts`,
      ).not.toMatch(/PLAYWRIGHT_BASE_URL\s*:/);
    }
  });

  it("playwright.config.ts lit bien E2E_BASE_URL — c'est le contrat", () => {
    expect(lire("playwright.config.ts")).toContain('process.env["E2E_BASE_URL"]');
  });

  it("aucun workflow ne braque la suite E2E complète sur une URL distante", () => {
    for (const fichier of WORKFLOWS) {
      const source = effectif(lire(`.github/workflows/${fichier}`));
      if (!E2E_BASE_URL_DISTANT.test(source)) continue;
      expect(
        source,
        `${fichier} : pointé sur une URL distante, il ne doit pas lancer la suite complète — ` +
          "elle soumet le formulaire de contact et tente des connexions admin",
      ).not.toMatch(/run:.*pnpm\s+test:e2e/);
      expect(
        source,
        `${fichier} : le filtre --grep @a11y est OUVERT (sprint-a-user-journeys.spec.ts le ` +
          "porte aussi) ; un job pointé sur la prod doit cibler le FICHIER",
      ).not.toMatch(/run:.*a11y:audit/);
    }
  });

  it("le job nocturne mesure la prod et ne lance QUE tests/e2e/a11y.spec.ts", () => {
    const nightly = lire(".github/workflows/nightly.yml");
    expect(nightly).toContain("E2E_BASE_URL: https://axion-ia.com");
    expect(nightly).toContain("playwright test tests/e2e/a11y.spec.ts");
    // ⚠️ 2026-08-21 — cette assertion cherchait littéralement `needs: [a11y-prod,`.
    // Ajouter un job à la liste et la passer sur plusieurs lignes suffisait à la
    // faire rougir, alors que l'invariant qu'elle protège — `a11y-prod` DOIT
    // figurer dans les `needs` de l'alerte — était toujours tenu. Une garde qui
    // rougit sur une MISE EN FORME finit par être « corrigée » en l'affaiblissant,
    // et celle-ci existe parce qu'un job nocturne a un jour soumis le formulaire
    // de contact en production. On lit donc la liste, pas sa typographie.
    const alerte = effectif(nightly).slice(effectif(nightly).indexOf("notify-failure:"));
    const besoins = alerte.match(/needs:\s*\[([^\]]*)\]/);
    expect(besoins, "`notify-failure` n'a plus de liste `needs`").not.toBeNull();
    expect(
      besoins![1]!.split(",").map((s) => s.trim()),
      "l'échec du gate a11y doit rester visible dans l'alerte nocturne",
    ).toContain("a11y-prod");
  });
});

describe("Câblage du gate a11y — canari anti-faux-vert", () => {
  const spec = lire("tests/e2e/a11y.spec.ts");

  it("la spec contrôle le statut HTTP avant de mesurer", () => {
    expect(spec, "sans contrôle de statut, axe mesurerait une page d'erreur").toContain("status()");
  });

  it("la spec vérifie qu'elle est bien sur une page du site public", () => {
    expect(
      spec,
      "une interstitielle Cloudflare répond 200 : seule la présence du header le prouve",
    ).toContain("header[data-tone]");
  });

  it("le header public porte l'attribut qui sert de sentinelle", () => {
    expect(lire("src/components/nav/Header.tsx")).toContain('data-tone="terracotta"');
  });
});

describe("Contraste — le miroir ne peut plus mentir", () => {
  const checkContrast = lire("scripts/check-contrast.ts");

  it("le miroir de palette est confronté à globals.css", () => {
    expect(checkContrast, "le miroir doit être confronté à sa source").toContain("globals.css");
    expect(checkContrast).toContain("--color-");
  });

  it("les deux valeurs qui avaient dérivé sont resynchronisées", () => {
    // Ancré sur la paire clé/valeur : #c24a1b reste légitime ailleurs dans le
    // dépôt (globals.css le porte sous --color-warning), ce n'est pas une dérive.
    expect(
      checkContrast,
      "--color-terracotta vaut #b23f16 depuis l'assombrissement AA",
    ).not.toMatch(/terracotta:\s*"#c24a1b"/);
    expect(checkContrast, "--color-fg-muted vaut #5a4f44 depuis le Sprint A11y").not.toMatch(
      /fgMuted:\s*"#6b6155"/,
    );
  });
});

describe("Cohérence déclarative — accessibilité", () => {
  it("tant que la déclaration dit « non audité », aucune surface ne revendique la conformité", () => {
    const declaration = lire("src/app/[locale]/accessibilite/page.tsx");
    // Test volontairement CONDITIONNEL : le jour où un audit réel est mené et la
    // déclaration réécrite, cet invariant se lève de lui-même. Ce qu'il interdit,
    // c'est l'ÉCART entre deux surfaces publiques — pas la conformité.
    if (!declaration.includes("non audité à ce jour")) return;

    expect(lire("src/app/llms.txt/route.ts")).not.toMatch(/accessible WCAG/);
    expect(lire("src/app/llms-full.txt/route.ts")).not.toMatch(/accessible WCAG/);
    expect(
      lire("src/server/content-gen/kb/interventions-formations.ts"),
      "ce fait alimente la RAG et ressort en pages publiques — et il porte sur les SUPPORTS " +
        "DE FORMATION, terrain direct de l'audit Qualiopi",
    ).not.toMatch(/text: "[^"]*format accessible \(WCAG/);
    expect(lire("src/server/content-gen/kb/sites-web-augmentes.ts")).not.toMatch(
      /text: "[^"]*respectent les normes WCAG/,
    );
  });
});
