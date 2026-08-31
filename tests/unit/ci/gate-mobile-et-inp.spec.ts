// @vitest-environment node
//
// Environnement `node` : lecture de fichiers du dépôt.

/**
 * Verrou GEO-114 + GEO-121 — le seul gate bloquant ne mesurait ni l'INP ni le
 * mobile (audit GEO/AEO du 2026-08-14, lot 16).
 *
 * ## Ce qui manquait
 *
 * Le contrat de performance (AGENTS.md) fixe **INP ≤ 100 ms p75**. Le gate
 * post-deploy — le seul réellement bloquant, les gates PR de budget portant tous
 * `continue-on-error: true` — n'assertait **aucune** valeur d'INP.
 *
 * Il tournait par ailleurs en `--settings.preset=desktop` **uniquement**, alors
 * que l'indexation de Google est mobile-first : la version mesurée n'était pas
 * celle qui est classée. Deux projets Playwright mobile existent dans le dépôt
 * et ne sont exécutés nulle part.
 *
 * ## Pourquoi ces assertions sont en WARN, et pourquoi c'est délibéré
 *
 * On n'a aucune ligne de base mobile. Poser des seuils bloquants à l'aveugle
 * ferait échouer tous les déploiements dès le premier run — et un gate qui
 * bloque tout se fait désactiver, donc ne garde plus rien. La bascule en ERROR
 * est une décision à prendre APRÈS 2-3 déploiements, sur des valeurs réelles.
 *
 * 🔑 Cette garde ne vérifie donc pas « le gate bloque », mais « le gate
 * MESURE ». C'est la propriété utile à ce stade, et la seule qu'on puisse
 * honnêtement affirmer.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = process.cwd();

function lire(chemin: string): string {
  return readFileSync(join(RACINE, chemin), "utf8");
}

/**
 * Ne garde que les lignes qui SONT une exception d'architecture, c'est-a-dire
 * un litteral d'expression reguliere ancre (`/^…/`).
 *
 * Pourquoi pas « retirer les commentaires » : la liste d'exceptions est faite
 * d'expressions regulieres dont plusieurs se terminent par `.*` puis leur
 * delimiteur — la sequence ferme un bloc de commentaire, et un decoupeur naif
 * avale alors toute la liste. C'est le meme piege que `*` suivi de `/` dans un
 * commentaire JSX, deja paye deux fois dans ce depot. On selectionne donc ce
 * qu'on veut lire, au lieu d'essayer de soustraire ce qu'on ne veut pas.
 */
function exceptionsDeclarees(source: string): string {
  return source
    .split("\n")
    .filter((ligne) => /^\s*\/\^/.test(ligne))
    .join("\n");
}

const WORKFLOW = ".github/workflows/deploy-coolify.yml";
const CONF_DESKTOP = "lighthouserc.postdeploy.json";
const CONF_MOBILE = "lighthouserc.postdeploy.mobile.json";

interface ConfigLhci {
  readonly ci: {
    readonly assert: {
      readonly assertions?: Record<string, unknown>;
      readonly assertMatrix?: ReadonlyArray<{
        matchingUrlPattern?: string;
        assertions: Record<string, unknown>;
      }>;
    };
  };
}

describe("GEO-114 — le gate bloquant mesure l'INP", () => {
  it("🔴 chaque entrée de la matrice desktop porte une assertion `interaction-to-next-paint`", () => {
    const conf = JSON.parse(lire(CONF_DESKTOP)) as ConfigLhci;
    const matrice = conf.ci.assert.assertMatrix ?? [];
    expect(matrice.length, "la matrice ne doit pas etre vide").toBeGreaterThan(0);
    for (const entree of matrice) {
      expect(
        entree.assertions["interaction-to-next-paint"],
        "une entree de matrice sans assertion INP redonne un gate aveugle sur l'INP",
      ).toBeDefined();
    }
  });

  it("le seuil INP reste aligné sur le contrat de performance (≤ 100 ms, sauf dérogation écrite)", () => {
    // 🔑 Les deux seuils sont DÉRIVÉS d'AGENTS.md, jamais recopiés ici. C'est
    // là qu'est écrit le contrat de performance ; un chiffre recopié dans le
    // test diverge du contrat sans que personne ne le voie — la classe de
    // défaut que ce fichier existe pour empêcher.
    const contrat = lire("AGENTS.md");
    const general = Number(/INP\*\*\s*≤\s*(\d+)\s*ms/.exec(contrat)?.[1]);
    const derogation = Number(
      /Exception\s*:\s*`\/appel`[^\n]*?INP\s*≤\s*(\d+)\s*ms/.exec(contrat)?.[1],
    );
    expect(general, "seuil INP général introuvable dans AGENTS.md").toBeGreaterThan(0);
    expect(derogation, "dérogation INP de /appel introuvable dans AGENTS.md").toBeGreaterThan(0);

    const conf = JSON.parse(lire(CONF_DESKTOP)) as ConfigLhci;
    for (const entree of conf.ci.assert.assertMatrix ?? []) {
      const regle = entree.assertions["interaction-to-next-paint"] as [
        string,
        { maxNumericValue: number },
      ];
      // `/appel` porte une exception explicite au contrat (page de réservation,
      // historiquement client-heavy). Toute autre URL reste au seuil général :
      // l'exception se lit dans AGENTS.md ou elle n'existe pas.
      const estAppel = /appel/.test(entree.matchingUrlPattern ?? "");
      const plafond = estAppel ? derogation : general;
      expect(
        regle[1].maxNumericValue,
        `${entree.matchingUrlPattern} : seuil INP hors contrat`,
      ).toBeLessThanOrEqual(plafond);
    }
  });
});

describe("GEO-121 — le gate mesure aussi le mobile", () => {
  /**
   * 🔴 CE TEST VERROUILLAIT LE DÉFAUT QU'IL CROYAIT GARDER — retourné le
   * 2026-08-31.
   *
   * Il exigeait la présence littérale de `--settings.preset=mobile`. Or cette
   * option **n'existe pas** : Lighthouse n'accepte que `perf`, `experimental`
   * et `desktop`, et le mobile est le DÉFAUT, obtenu en omettant l'option.
   * Chaque exécution mourait donc sur « Invalid values: Argument: preset,
   * Given: "mobile" », puis assertait contre 0 URL. Le test, lui, restait vert :
   * il mesurait la présence d'une chaîne de caractères, pas l'existence d'une
   * mesure. Dix-sept jours (2026-08-14 → 2026-08-31) pendant lesquels la
   * version que Google indexe n'a jamais été mesurée, sous la protection d'une
   * garde qui exigeait la cause de la panne.
   *
   * La propriété à garder n'a jamais été « la chaîne est là » mais « la passe
   * mobile produit des mesures ». On garde donc les deux versants : l'option
   * invalide est bannie, et la passe doit compter ce qu'elle a collecté.
   */
  it("🔴 le workflow ne repose PAS sur un preset `mobile` qui n'existe pas", () => {
    // 🔑 On mesure ce qui est EXÉCUTÉ, pas ce qui est écrit : les lignes de
    // commentaire sont retirées avant la recherche. Sans ce filtrage, le
    // commentaire qui EXPLIQUE la panne ferait rougir la garde qui la
    // surveille — et on serait tenté de retirer l'explication plutôt que de
    // corriger la mesure.
    const commandes = lire(WORKFLOW)
      .split("\n")
      .filter((l) => !/^\s*#/.test(l))
      .join("\n");
    expect(
      commandes,
      "`--settings.preset=mobile` est refusé par Lighthouse (choix : perf, experimental, desktop) — " +
        "le mobile s'obtient en OMETTANT l'option. Sa présence fait mourir la collecte.",
    ).not.toContain("preset=mobile");
  });

  it("🔴 la passe mobile compte ses rapports et rougit si elle n'a rien mesuré", () => {
    const wf = lire(WORKFLOW);
    // Sans ce garde-fou, « 0 rapport » et « tout va bien » sont le même job vert.
    expect(wf, "le nombre de rapports collectés doit être compté").toMatch(
      /RAPPORTS=\$\(find \.lighthouseci/,
    );
    expect(wf, "0 rapport doit produire une erreur explicite, pas un silence").toMatch(
      /if \[ "\$RAPPORTS" -eq 0 \]/,
    );
  });

  it("🔴 cette passe asserte contre la config mobile dédiée", () => {
    const wf = lire(WORKFLOW);
    expect(wf).toContain(`--config=${CONF_MOBILE}`);
  });

  it("la config mobile existe et couvre les métriques du contrat", () => {
    const conf = JSON.parse(lire(CONF_MOBILE)) as ConfigLhci;
    const a = conf.ci.assert.assertions ?? {};
    for (const metrique of [
      "largest-contentful-paint",
      "cumulative-layout-shift",
      "total-blocking-time",
      "interaction-to-next-paint",
    ]) {
      expect(a[metrique], `metrique absente de la passe mobile : ${metrique}`).toBeDefined();
    }
  });

  it("⚠️ toutes les assertions mobiles sont en WARN — état transitoire assumé", () => {
    // 🔑 Ce test documente une DECISION, il ne verrouille pas un ideal. Quand la
    // ligne de base sera etablie (2-3 deploiements), basculer les metriques
    // conformes en "error" ET mettre ce test a jour dans le meme commit. Le
    // laisser vert indefiniment reviendrait a entretenir un gate qui n'a jamais
    // la capacite de rougir.
    const conf = JSON.parse(lire(CONF_MOBILE)) as ConfigLhci;
    for (const [nom, regle] of Object.entries(conf.ci.assert.assertions ?? {})) {
      const niveau = Array.isArray(regle) ? regle[0] : regle;
      expect(niveau, `${nom} : la bascule en error est une decision, pas un effet de bord`).toBe(
        "warn",
      );
    }
  });

  it("la passe mobile ne renverse pas un déploiement sain, mais ne se tait plus", () => {
    const wf = lire(WORKFLOW);

    // Le `|| true` RESTE sur la COLLECTE : une passe mobile qui casse ne doit
    // pas renverser un déploiement par ailleurs valide, tant qu'on est en
    // phase d'observation. Ce job est post-deploy — il alerte, il ne bloque
    // pas la mise en ligne, déjà faite.
    expect(wf, "la collecte mobile reste non bloquante").toMatch(
      /lhci collect .*--settings\.throttlingMethod=devtools \|\| true/,
    );

    // 🔑 Mais il a été RETIRÉ de l'assert (2026-08-31). Le raisonnement d'origine
    // — « l'assert ne peut pas échouer puisque tout est en WARN, le `|| true`
    // est une simple ceinture » — était juste sur les seuils et faux sur tout le
    // reste : c'est lui qui a avalé, dix-sept jours durant, un assert qui
    // tournait contre 0 URL. Une ceinture qui masque aussi la panne du moteur
    // n'est pas une ceinture.
    expect(wf, "l'assert mobile ne doit plus être masqué par un `|| true`").not.toMatch(
      /--config=lighthouserc\.postdeploy\.mobile\.json \|\| true/,
    );
  });
});

describe("GEO-032 — le fichier ne promet plus ce qu'il ne mesure pas", () => {
  it("🔴 le script et son workflow ne s'annoncent plus comme des « crawl stats »", () => {
    // Le script interroge `searchAnalytics` (impressions/clics/CTR/position).
    // Ce ne sont pas des donnees d'exploration : le rapport « Statistiques
    // d'exploration » de Search Console n'a pas d'API publique.
    const script = lire("scripts/perf/export-gsc-search-analytics.mjs");
    expect(script).toContain("searchAnalytics");
    expect(script).toContain("search-analytics-${week}.csv");
    // La phrase est coupee par un retour a la ligne dans le commentaire : on
    // cherche donc un repere contigu, pas la phrase entiere.
    expect(
      script,
      "l'en-tete doit dire pourquoi la mesure promise est irrealisable, sinon quelqu'un la retentera",
    ).toContain("Statistiques d'exploration");
    expect(script).toMatch(/n'a pas d'API\s+\*?\s*publique/);
  });

  it("l'exception d'architecture pointe le nouveau nom", () => {
    // Une exception qui designe un fichier disparu ne protege plus rien.
    //
    // On regarde les EXCEPTIONS DECLAREES, pas la prose autour. Premiere
    // redaction : on cherchait l'ancien nom dans le fichier entier, et le test
    // est tombe sur le COMMENTAIRE qui explique le renommage. Un garde statique
    // qui lit tout un fichier finit toujours par trouver sa propre
    // documentation ; interdire d'ecrire « X a ete renomme en Y » pour pouvoir
    // verifier que Y est bien utilise, c'est payer la garde en effacant la
    // raison du changement.
    const check = exceptionsDeclarees(lire("scripts/content-gen/isolation-check.ts"));
    expect(check).toContain("export-gsc-search-analytics");
    expect(check).not.toContain("export-gsc-crawl-stats");
  });
});
