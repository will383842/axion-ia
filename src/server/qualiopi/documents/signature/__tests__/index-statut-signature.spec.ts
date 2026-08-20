/**
 * `D5-4-04` — l'index qui empêche la pastille de scanner toute la table.
 *
 * `compterPiecesEnAttente()` lit `documents_generes` sur
 * `statutSignature IN (partielle, en_attente) AND annuleeAt = null`, **sans
 * borne**, depuis la pastille de navigation — donc sur CHAQUE page admin.
 * Aucun index ne portait `statutSignature` : Postgres n'avait d'autre choix
 * qu'un Seq Scan complet, sur une table qui grossit d'une ligne à chaque pièce
 * générée et ne se purge qu'à cinq ans.
 *
 * ## Pourquoi garder un index par un test
 *
 * Un index n'a pas de comportement observable : il change le temps, pas le
 * résultat. Rien ne rougit quand il disparaît — la page continue de rendre les
 * mêmes chiffres, un peu plus lentement chaque mois. C'est exactement le genre
 * de correctif qui se perd à la première régénération de schéma.
 *
 * 🔑 Deux déclarations, deux vérifications. Le schéma Prisma décrit l'intention ;
 * la migration est ce qui s'exécute réellement en production. Un index déclaré
 * dans `schema.prisma` sans migration correspondante n'existe **nulle part** —
 * `prisma migrate deploy` ne le crée pas, et `prisma db push` n'est pas utilisé
 * ici.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const RACINE = process.cwd();

describe("`D5-4-04` — l'index (statutSignature, annuleeAt) sur documents_generes", () => {
  const schema = readFileSync(join(RACINE, "prisma", "schema.prisma"), "utf-8");

  /** Le bloc `model DocumentGenere { … }`, isolé du reste du schéma. */
  function modeleDocumentGenere(): string {
    const debut = schema.indexOf("model DocumentGenere {");
    expect(debut, "le modèle DocumentGenere doit exister").toBeGreaterThan(-1);
    const fin = schema.indexOf("\n}", debut);
    return schema.slice(debut, fin);
  }

  it("🔴 le schéma déclare l'index composite, dans cet ordre", () => {
    // L'ORDRE compte : `statutSignature` est le prédicat d'égalité,
    // `annuleeAt` le filtre qui suit. L'index inverse ne servirait pas la
    // requête — `annuleeAt` est NULL pour presque toutes les lignes, donc peu
    // sélectif à lui seul, et un index sur cette seule colonne existait DÉJÀ
    // sans rien résoudre.
    expect(modeleDocumentGenere()).toMatch(/@@index\(\[statutSignature,\s*annuleeAt\]\)/);
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

    expect(sql).toMatch(/CREATE INDEX[\s\S]{0,80}"documents_generes"\s*\(\s*"statut_signature"/);
  });

  it("l'index ne passe PAS par CONCURRENTLY — le dépôt l'a déjà payé deux fois", () => {
    // 🔑 Témoin d'un piège connu, pas une préférence de style :
    // `prisma migrate deploy` exécute chaque migration dans une transaction, et
    // `CREATE INDEX CONCURRENTLY` y est interdit (P3018 / E25001). Deux
    // migrations du dépôt portent déjà la cicatrice (`20260521150200`,
    // `20260625120300`). Une migration qui échoue au déploiement bloque la
    // sortie entière, pas seulement l'index.
    const migration = readFileSync(
      join(
        RACINE,
        "prisma",
        "migrations",
        "20260820140000_documents_generes_statut_signature_index",
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
