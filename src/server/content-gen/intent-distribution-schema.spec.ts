/**
 * Le module déclarait l'alias `commercial` ↔ `commercial_investigation` et
 * affirmait qu'il était « résolu dans l'orchestrateur ». Il ne l'était nulle
 * part : la clé passait la validation puis se perdait, et la part commerciale
 * de la répartition valait zéro en génération. Aucun test ne couvrait ce
 * module — d'où la dérive silencieuse.
 *
 * Ces cas sont écrits à partir de la configuration RÉELLE de production, lue
 * le 2026-08-03.
 */
import { describe, it, expect, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  validateIntentDistribution,
  toPourcentages,
  resolveIntentDistribution,
  INTENT_DISTRIBUTION_DEFAULTS,
} from "./intent-distribution-schema";

/** La ligne effectivement stockée en production. */
const CONFIG_PROD = {
  local: 0.1,
  navigational: 0.1,
  informational: 0.4,
  transactional: 0.15,
  commercial_investigation: 0.25,
};

const muet = (): void => {};

describe("validateIntentDistribution", () => {
  it("replie commercial_investigation sur l'alias que lisent les consommateurs", () => {
    const r = validateIntentDistribution(CONFIG_PROD, muet);
    expect(r["commercial"]).toBe(0.25);
    expect(r["commercial_investigation"]).toBeUndefined();
  });

  it("additionne les deux écritures de la part commerciale plutôt que d'en perdre une", () => {
    const r = validateIntentDistribution({ commercial: 10, commercial_investigation: 15 }, muet);
    expect(r["commercial"]).toBe(25);
  });

  it("conserve les autres parts inchangées", () => {
    const r = validateIntentDistribution(CONFIG_PROD, muet);
    expect(r).toEqual({
      local: 0.1,
      navigational: 0.1,
      informational: 0.4,
      transactional: 0.15,
      commercial: 0.25,
    });
  });

  it("ignore une clé inconnue en la signalant, sans jamais lever", () => {
    const warn = vi.fn();
    const r = validateIntentDistribution({ informational: 50, commercia: 50 }, warn);
    expect(r).toEqual({ informational: 50 });
    expect(warn).toHaveBeenCalledOnce();
  });

  it("renvoie un objet vide sur une entrée qui n'est pas un objet", () => {
    expect(validateIntentDistribution(null, muet)).toEqual({});
    expect(validateIntentDistribution([1, 2], muet)).toEqual({});
    expect(validateIntentDistribution("50", muet)).toEqual({});
  });
});

describe("toPourcentages", () => {
  it("ramène les fractions de production à une somme de 100", () => {
    const pct = toPourcentages(validateIntentDistribution(CONFIG_PROD, muet));
    expect(Object.values(pct).reduce((s, v) => s + v, 0)).toBeCloseTo(100, 5);
    expect(pct["informational"]).toBe(40);
    expect(pct["commercial"]).toBe(25);
  });

  it("laisse inchangée une répartition déjà en pourcentages", () => {
    const pct = toPourcentages({
      informational: 50,
      commercial: 25,
      local: 15,
      transactional: 5,
      navigational: 5,
    });
    expect(pct["informational"]).toBe(50);
    expect(pct["navigational"]).toBe(5);
  });

  it("renvoie un objet vide plutôt qu'un NaN quand la somme est nulle", () => {
    expect(toPourcentages({})).toEqual({});
    expect(toPourcentages({ informational: 0, commercial: 0 })).toEqual({});
  });
});

/**
 * 🔴 RÉGRESSION DU 2026-08-04, ATTRAPÉE EN PRODUCTION.
 *
 * En rendant `readContentGenConfig` fusionnant (le stocké par-dessus les
 * défauts), j'ai fait entrer les défauts EN POURCENTAGES dans une
 * configuration stockée EN FRACTIONS. Le validateur additionnait alors
 * `commercial: 25` (défaut) et `commercial_investigation: 0,25` (stocké), et
 * l'écran affichait **97,1 %** pour la part commerciale — pire que le zéro
 * qu'on venait de corriger.
 *
 * Le correctif est en amont (lire avec `{}` et appliquer les défauts EN BLOC),
 * mais le comportement se verrouille ici : c'est le seul endroit qui décrit ce
 * qu'une répartition doit valoir.
 */
describe("mélange d'échelles — la régression du 2026-08-04", () => {
  it("une répartition en fractions reste en fractions, sans défaut injecté", () => {
    const r = resolveIntentDistribution(CONFIG_PROD, muet);
    // Aucune valeur ne doit dépasser l'ordre de grandeur des autres.
    expect(Math.max(...Object.values(r))).toBeLessThanOrEqual(1);
    expect(toPourcentages(r)["commercial"]).toBe(25);
  });

  it("ce que produisait la fusion fautive — la forme qu'on refuse", () => {
    // Reconstitution du mélange : un défaut en pourcentage tombé au milieu de
    // fractions. Conservé comme témoin, c'est la forme exacte vue en prod.
    const melange = { ...CONFIG_PROD, commercial: 25 };
    const r = validateIntentDistribution(melange, muet);
    // 25 + 0,25 — le repli additionne les deux écritures de la part commerciale.
    expect(r["commercial"]).toBe(25.25);
    expect(toPourcentages(r)["commercial"]).toBeCloseTo(97.1, 1);
  });
});

describe("resolveIntentDistribution — les défauts s'appliquent EN BLOC", () => {
  it("rend les défauts entiers quand rien n'est stocké, jamais un hybride", () => {
    for (const vide of [{}, null, "50", [1, 2], { commercia: 50 }]) {
      expect(resolveIntentDistribution(vide, muet)).toEqual(INTENT_DISTRIBUTION_DEFAULTS);
    }
  });

  it("ne complète JAMAIS une répartition partielle avec les défauts", () => {
    // Le cœur du piège : une seule clé stockée reste seule. La compléter
    // mélangerait son échelle avec celle des défauts.
    const r = resolveIntentDistribution({ informational: 0.4 }, muet);
    expect(r).toEqual({ informational: 0.4 });
    expect(r["commercial"]).toBeUndefined();
    // Et l'écran la montre à 100 % — cohérent — au lieu d'un 97,1 % absurde.
    expect(toPourcentages(r)).toEqual({ informational: 100 });
  });

  it("les défauts sont eux-mêmes une répartition valide de somme 100", () => {
    const somme = Object.values(INTENT_DISTRIBUTION_DEFAULTS).reduce((s, v) => s + v, 0);
    expect(somme).toBe(100);
    // Déjà en pourcentages : la normalisation les laisse intacts.
    expect(toPourcentages(INTENT_DISTRIBUTION_DEFAULTS)).toEqual(INTENT_DISTRIBUTION_DEFAULTS);
  });

  it("ne renvoie jamais de vide — donc plus jamais de « Somme actuelle : NaN % »", () => {
    for (const entree of [CONFIG_PROD, {}, null, { informational: 0, commercial: 0 }]) {
      expect(
        Object.keys(toPourcentages(resolveIntentDistribution(entree, muet))).length,
      ).toBeGreaterThan(0);
    }
  });
});

/**
 * 🔴 LE GARDE-FOU QUI COMPTE VRAIMENT.
 *
 * Les cas ci-dessus valident le helper. Mais la régression n'était PAS dans le
 * helper : elle était dans l'argument passé à `readContentGenConfig` par ses
 * deux appelants. Reposer `INTENT_DISTRIBUTION_DEFAULTS` à cet endroit
 * ressusciterait le bug entier sans faire rougir un seul test de comportement
 * — les deux points de lecture ne sont couverts par aucun test unitaire
 * (l'orchestrateur lit la config au milieu d'un `processJob` de 300 lignes).
 *
 * D'où ce test statique, sur le modèle de `workers-no-guarded-actions.spec.ts` :
 * il lit les sources et impose le contrat à TOUS les appelants, présents et à
 * venir. Une répartition se lit avec `{}` ; ses défauts s'appliquent en bloc.
 */
describe("contrat de lecture — `search_intent_distribution` se lit avec `{}`", () => {
  const CLE = "search_intent_distribution";

  // `readContentGenConfig` est appelé depuis les workers, les Server Actions
  // ET des écrans admin `.tsx` — les trois racines sont balayées, sans quoi un
  // futur appelant côté UI échapperait au contrôle.
  const RACINES = ["server", "app"] as const;

  function sources(dir: string): ReadonlyArray<string> {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = join(dir, e.name);
      if (e.isDirectory()) return sources(p);
      if (!e.isFile()) return [];
      const estSource = (p.endsWith(".ts") || p.endsWith(".tsx")) && !p.endsWith(".d.ts");
      return estSource && !p.includes(".spec.") && !p.includes(".test.") ? [p] : [];
    });
  }

  /**
   * Tous les appels `readContentGenConfig(..., "<clé>", <défaut>)` du dépôt.
   * Mémoïsé : le balayage lit chaque `.ts` de `src/` (~18 s), une fois suffit.
   */
  let cache: ReadonlyArray<{ fichier: string; defaut: string }> | undefined;
  function appels(): ReadonlyArray<{ fichier: string; defaut: string }> {
    if (cache) return cache;
    const motif = new RegExp(
      `readContentGenConfig\\s*(?:<[^>]*>)?\\s*\\(\\s*"${CLE}"\\s*,\\s*([\\s\\S]*?)\\)`,
      "g",
    );
    cache = RACINES.flatMap((racine) => sources(join(process.cwd(), "src", racine))).flatMap(
      (fichier) => {
        const source = readFileSync(fichier, "utf8");
        if (!source.includes(CLE)) return [];
        return [...source.matchAll(motif)].map((m) => ({
          fichier,
          defaut: (m[1] ?? "").trim(),
        }));
      },
    );
    return cache;
  }

  it("sanity : les deux points de lecture sont bien trouvés dans les sources", () => {
    // Sans cette borne, un motif qui ne matche plus rendrait le test suivant
    // vert par vacuité — le pire des faux négatifs.
    expect(appels().length).toBeGreaterThanOrEqual(2);
  });

  it("aucun appelant ne passe de valeurs par défaut à la lecture", () => {
    for (const { fichier, defaut } of appels()) {
      expect(
        defaut,
        `${fichier} lit « ${CLE} » avec le défaut \`${defaut}\`. Une répartition ` +
          `se lit d'un bloc : des défauts ici fusionneraient clé par clé avec la ` +
          `config stockée (fractions vs pourcentages → part commerciale à 97,1 %, ` +
          `constaté en prod le 2026-08-04). Lire avec \`{}\` et passer le résultat ` +
          `à \`resolveIntentDistribution\`.`,
      ).toBe("{}");
    }
  });
});
