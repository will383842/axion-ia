/**
 * 🔴 UN `@default` CORRIGÉ DANS LE SCHÉMA NE CORRIGE PAS LA COLONNE.
 *
 * Prisma n'aligne une colonne existante que si une MIGRATION le lui demande.
 * Changer `@default(...)` dans `schema.prisma` ne produit rien tout seul : la
 * base garde l'ancienne valeur, et chaque insertion sans valeur explicite en
 * hérite.
 *
 * ## Le cas qui a fait écrire ce fichier
 *
 * `image_assets.copyright_holder` :
 *
 *   schema.prisma        @default("Axion-IA")        ← corrigé depuis longtemps
 *   production           DEFAULT 'Axion-IA OÜ'       ← jamais migré
 *   lignes en base       215 « Axion-IA » · 73 « Axion-IA OÜ »
 *
 * L'entité est une SAS française ; « OÜ » est une modélisation estonienne
 * historique. Elle n'a jamais disparu de la base.
 *
 * 🔑 CE QUI L'A RENDU INVISIBLE, et c'est le vrai enseignement :
 * `resolveCopyrightHolder()` retire « OÜ » À LA LECTURE. Aucun écran n'a jamais
 * montré de faux — donc aucun test n'a jamais rougi. **Le nettoyage protégeait
 * l'affichage et masquait la donnée.** Un correctif au point de lecture ferme
 * le symptôme et éteint le signal : c'est le pire des deux, parce qu'il rend
 * l'écart indétectable au lieu de le rendre bénin.
 *
 * ## Ce que ce fichier garde
 *
 * L'ACCORD entre les deux endroits, pas la valeur. Une garde qui vérifierait
 * seulement « le défaut vaut Axion-IA » raterait exactement ce défaut-ci : les
 * deux endroits disaient chacun quelque chose de cohérent — c'est leur écart
 * qui était faux.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const RACINE = process.cwd();
const SCHEMA = readFileSync(join(RACINE, "prisma/schema.prisma"), "utf8");
const DOSSIER_MIGRATIONS = join(RACINE, "prisma/migrations");

/** Toutes les migrations, dans l'ordre chronologique (leur nom porte l'horodatage). */
function migrationsOrdonnees(): { nom: string; sql: string }[] {
  return readdirSync(DOSSIER_MIGRATIONS, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .map((nom) => ({
      nom,
      sql: readFileSync(join(DOSSIER_MIGRATIONS, nom, "migration.sql"), "utf8"),
    }))
    .filter((m) => m.sql.length > 0);
}

/** Le dernier défaut posé par une migration sur cette colonne, ou null. */
function dernierDefautMigre(
  table: string,
  colonne: string,
): { valeur: string; migration: string } | null {
  let trouve: { valeur: string; migration: string } | null = null;
  for (const m of migrationsOrdonnees()) {
    const sql = m.sql.replace(/\s+/g, " ");
    // Deux formes : la création de table, et un ALTER ... SET DEFAULT.
    const alter = new RegExp(
      `ALTER TABLE "?${table}"? ALTER COLUMN "?${colonne}"? SET DEFAULT '([^']*)'`,
      "i",
    ).exec(sql);
    if (alter?.[1] !== undefined) trouve = { valeur: alter[1], migration: m.nom };
    const creation = new RegExp(`"${colonne}" [A-Z][^,]*DEFAULT '([^']*)'`, "i").exec(sql);
    if (creation?.[1] !== undefined && sql.includes(`CREATE TABLE "${table}"`)) {
      trouve = { valeur: creation[1], migration: m.nom };
    }
  }
  return trouve;
}

/** Le défaut déclaré par Prisma pour ce champ, ou null. */
function defautDeclare(champ: string): string | null {
  const ligne = SCHEMA.split("\n").find((l) => l.trim().startsWith(champ + " "));
  return /@default\("([^"]*)"\)/.exec(ligne ?? "")?.[1] ?? null;
}

describe("le défaut déclaré et celui de la base ne divergent pas", () => {
  it("`image_assets.copyright_holder` : Prisma et la dernière migration disent la MÊME chose", () => {
    const declare = defautDeclare("copyrightHolder");
    const migre = dernierDefautMigre("image_assets", "copyright_holder");

    expect(
      declare,
      "`copyrightHolder` n'a plus de `@default` lisible dans schema.prisma",
    ).not.toBeNull();
    expect(
      migre,
      "aucune migration ne pose de défaut sur `image_assets.copyright_holder`",
    ).not.toBeNull();

    expect(
      migre?.valeur,
      "ÉCART DE DÉFAUT. `schema.prisma` déclare « " +
        String(declare) +
        " » ; la dernière migration qui touche cette colonne (" +
        String(migre?.migration) +
        ") pose « " +
        String(migre?.valeur) +
        " ». Prisma n'aligne PAS une colonne existante sur un `@default` modifié : " +
        "il faut une migration. Sans elle, chaque insertion sans valeur explicite " +
        "hérite de l'ancienne — c'est ce qui a produit 73 lignes « Axion-IA OÜ » " +
        "en production, invisibles parce qu'un nettoyage à la lecture les masquait.",
    ).toBe(declare);
  });

  it("aucune migration ne laisse l'entité estonienne comme défaut", () => {
    // Témoin de FAMILLE, pas de valeur : l'entité est une SAS française, et ce
    // suffixe ne doit plus pouvoir être posé par une migration future.
    const fautives = migrationsOrdonnees()
      .filter((m) => /SET DEFAULT '[^']*OÜ/i.test(m.sql.replace(/\s+/g, " ")))
      .map((m) => m.nom);
    expect(
      fautives,
      "une migration pose une entité estonienne comme défaut. L'entité est " +
        "AXION IA SAS (RCS Grenoble) — cf. site_settings.legal_overrides.",
    ).toEqual([]);
  });

  it("le témoin SAIT rougir — il lit de vraies valeurs, pas des absences", () => {
    // 🔑 Sans ceci, un `defautDeclare` qui rendrait toujours null ferait passer
    // le premier test par égalité de deux `null`. Une garde qui compare deux
    // absences est verte sur un dépôt vide.
    expect(defautDeclare("copyrightHolder")).toBe("Axion-IA");
    expect(dernierDefautMigre("image_assets", "copyright_holder")?.valeur).toBeTruthy();
  });
});
