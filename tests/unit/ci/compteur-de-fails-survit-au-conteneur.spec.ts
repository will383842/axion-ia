/**
 * Garde — L'ALERTE « CASCADING FAIL » PEUT RÉELLEMENT SE DÉCLENCHER.
 *
 * ## Le défaut que cette garde ferme
 *
 * Mesuré le 2026-09-03, en auditant le scénario « Coolify tombe ».
 * `record_fail()` (`scripts/backup-lib.sh`) incrémente un compteur de fichiers et
 * n'escalade en 🔴🔴 qu'à partir de **deux** échecs consécutifs. Or les wrappers
 * `scripts/vps/run-*.sh` exécutent tout dans un conteneur **éphémère** : le
 * compteur naissait avec lui et mourait avec lui. Il valait donc 1 à chaque
 * exécution, pour l'éternité — **le seuil de 2 était inatteignable**.
 *
 * Une sauvegarde pouvait échouer toutes les nuits pendant des semaines sans
 * qu'aucune escalade ne parte. C'est le pire genre de panne d'alerte : celle qui
 * laisse croire que le dispositif veille.
 *
 * Le correctif tient en deux gestes, et cette garde vérifie les deux :
 *   1. monter un répertoire de l'hôte (`/var/lib/axion-backup`) dans le conteneur ;
 *   2. dire à la bibliothèque d'y écrire (`FAIL_COUNT_DIR`, ou `FAIL_COUNT_FILE`
 *      pour `run-r2-backup.sh`, qui redéfinit `record_fail` et n'honore que celui-là).
 *
 * ## Pourquoi un test et pas seulement un commentaire
 *
 * Les deux gestes sont dans un `docker run` de quinze lignes. Retirer un `-v` en
 * réorganisant un wrapper ne casse rien de visible : les sauvegardes continuent,
 * le digest reste vert, et l'escalade redevient silencieusement impossible. Rien
 * dans l'exécution normale ne signale la perte. D'où une garde statique.
 *
 * ⚠️ Le témoin de non-vacuité en fin de fichier n'est pas décoratif : sans lui,
 * un `glob` qui ne trouverait plus aucun wrapper ferait passer ce test sur zéro
 * fichier — vert, et aveugle.
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const DOSSIER = path.join("scripts", "vps");
const MONTAGE = "/var/lib/axion-backup:/state";

/** Les wrappers qui peuvent appeler `record_fail`, donc tenir un compteur. */
function wrappersDeSauvegarde(): { chemin: string; contenu: string }[] {
  return readdirSync(path.join(RACINE, DOSSIER))
    .filter((f) => f.startsWith("run-") && f.endsWith("backup.sh"))
    .map((f) => {
      const chemin = path.join(DOSSIER, f);
      return { chemin, contenu: readFileSync(path.join(RACINE, chemin), "utf8") };
    });
}

describe("🔴 sauvegardes — le compteur de fails consécutifs survit au conteneur", () => {
  it("chaque wrapper monte le répertoire d'état de l'hôte", () => {
    const sansMontage = wrappersDeSauvegarde()
      .filter(({ contenu }) => !contenu.includes(MONTAGE))
      .map(({ chemin }) => chemin);

    expect(
      sansMontage,
      `Ces wrappers n'exposent pas \`${MONTAGE}\` à leur conteneur. Le compteur ` +
        `de fails consécutifs y naîtra et y mourra, donc l'escalade « CASCADING ` +
        `FAIL » (seuil : 2 échecs) ne partira JAMAIS. La sauvegarde peut alors ` +
        `échouer toutes les nuits en silence.`,
    ).toEqual([]);
  });

  it("chaque wrapper dirige le compteur vers ce répertoire", () => {
    const sansVariable = wrappersDeSauvegarde()
      .filter(
        ({ contenu }) =>
          !contenu.includes("FAIL_COUNT_DIR=/state") &&
          !contenu.includes('FAIL_COUNT_FILE="/state/'),
      )
      .map(({ chemin }) => chemin);

    expect(
      sansVariable,
      `Ces wrappers montent le répertoire d'état mais n'y envoient rien. Il faut ` +
        `\`-e FAIL_COUNT_DIR=/state\` — ou \`-e FAIL_COUNT_FILE="/state/…"\` pour ` +
        `\`run-r2-backup.sh\`, qui redéfinit \`record_fail\` et n'honore que celui-là. ` +
        `Monter sans transmettre revient à ne rien faire, en donnant l'air d'avoir agi.`,
    ).toEqual([]);
  });

  it("la bibliothèque calcule le chemin À L'APPEL, pas au `source`", () => {
    const lib = readFileSync(path.join(RACINE, "scripts", "backup-lib.sh"), "utf8");

    // `backup-plausible.sh` bascule sur COMPONENT="plausible_clickhouse" APRÈS
    // avoir sourcé la bibliothèque. Un chemin figé au `source` ferait compter les
    // échecs ClickHouse dans le compteur de Postgres : deux composants, un seul
    // témoin, et une escalade qui parle du mauvais.
    expect(
      lib,
      "`_fail_count_file()` a disparu : le chemin du compteur est probablement " +
        "redevenu une variable figée au moment du `source`.",
    ).toMatch(/_fail_count_file\(\)\s*\{/);

    for (const fonction of ["record_fail", "record_success"]) {
      const corps = lib.split(`${fonction}() {`)[1]?.split("\n}")[0] ?? "";
      expect(
        corps,
        `\`${fonction}\` n'appelle plus \`_fail_count_file\` : il relit sans doute ` +
          `une variable figée, et le compteur de \`plausible_clickhouse\` retombera ` +
          `sur celui de \`plausible_pg\`.`,
      ).toContain("_fail_count_file");
    }
  });

  it("le recensement trouve les wrappers — sinon la garde ne garde rien", () => {
    expect(wrappersDeSauvegarde().length).toBeGreaterThanOrEqual(5);
  });
});
