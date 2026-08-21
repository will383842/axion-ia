/**
 * `D8-1` — l'index qui empêche trois crons de lire toute la table.
 *
 * ## Le défaut
 *
 * `web_vital_samples` portait deux index, `(url, metric, createdAt)` et
 * `(pageType, metric, createdAt)`. **Aucun des deux ne commence par
 * `createdAt`** — or trois requêtes ne filtrent QUE sur cette colonne :
 *
 *   · `retention-purge-worker`            — `deleteMany({ createdAt: { lt } })`
 *   · `content-web-vitals-monitor-worker` — `findMany({ createdAt: { gte } })`, 24 h, take 50 000
 *   · `content-psi-monitor-worker`        — `findMany({ createdAt: { gte } })`,  7 j, take 100 000
 *
 * Les deux lectures prennent une TRANCHE RÉCENTE d'une table qui, elle, grossit
 * sans borne avec le trafic — un échantillon par métrique et par visite,
 * conservé six mois. C'est le cas d'école où l'absence d'index ne se voit pas au
 * lancement et devient une lecture complète de table quelques mois plus tard,
 * sur un cron qui ne se plaint jamais.
 *
 * ## Pourquoi garder un index par un test
 *
 * 🔑 Un index n'a pas de comportement observable : il change le temps, pas le
 * résultat. Rien ne rougit quand il disparaît. Et il faut DEUX déclarations —
 * le schéma décrit l'intention, la migration est ce qui s'exécute en
 * production. Un `@@index` sans migration n'existe **nulle part** :
 * `prisma migrate deploy` ne le crée pas, et `db push` n'est pas utilisé ici.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const RACINE = process.cwd();
const schema = readFileSync(join(RACINE, "prisma", "schema.prisma"), "utf-8");

/** Le bloc `model WebVitalSample { … }`, isolé du reste du schéma. */
function modele(): string {
  const debut = schema.indexOf("model WebVitalSample {");
  expect(debut, "le modèle WebVitalSample doit exister").toBeGreaterThan(-1);
  return schema.slice(debut, schema.indexOf("\n}", debut));
}

describe("`D8-1` — l'index createdAt sur web_vital_samples", () => {
  it("🔴 le schéma déclare un index sur `createdAt` SEUL", () => {
    // ⚠️ « Seul » est le fond du sujet. Les deux index composites contiennent
    // déjà `createdAt` — en TROISIÈME position, derrière deux colonnes que ces
    // trois requêtes n'interrogent jamais. Un index composite ne sert pas un
    // filtre sur sa dernière colonne.
    expect(modele(), "l'index sur createdAt seul a disparu du schéma").toMatch(
      /@@index\(\[createdAt\]\)/,
    );
  });

  it("🔴 une migration le crée réellement — sinon il n'existe qu'en intention", () => {
    const dossier = join(RACINE, "prisma", "migrations");
    const sql = readdirSync(dossier, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => {
        try {
          return readFileSync(join(dossier, e.name, "migration.sql"), "utf-8");
        } catch {
          return "";
        }
      })
      .join("\n");
    expect(sql).toMatch(/CREATE INDEX[\s\S]{0,80}"web_vital_samples"\s*\(\s*"createdAt"\s*\)/);
  });

  it("l'index ne passe PAS par CONCURRENTLY — le dépôt l'a déjà payé deux fois", () => {
    // 🔑 `prisma migrate deploy` exécute chaque migration dans une transaction,
    // et `CREATE INDEX CONCURRENTLY` y est interdit (P3018 / E25001). Une
    // migration qui échoue au déploiement bloque la sortie entière, pas
    // seulement l'index.
    const migration = readFileSync(
      join(
        RACINE,
        "prisma",
        "migrations",
        "20260820210000_web_vital_samples_created_at_index",
        "migration.sql",
      ),
      "utf-8",
    );
    const sansCommentaires = migration.replace(/^--.*$/gm, "");
    expect(sansCommentaires).not.toMatch(/CONCURRENTLY/);
    // Non-vacuité : le fichier contient bien l'ordre qu'on prétend inspecter.
    expect(sansCommentaires).toMatch(/CREATE INDEX/);
  });
});
