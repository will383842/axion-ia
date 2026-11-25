/**
 * La migration `add_article_embedding_voyage` (PR4) est ADDITIVE : une colonne nullable et son
 * index. La colonne OpenAI `embedding` (1536) n'est pas touchée. L'ancien worker, qui tourne
 * encore pendant la mise en ligne (AGENTS.md, « DEUX conteneurs »), l'ignore.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SQL_BRUT = readFileSync(
  join(
    process.cwd(),
    "prisma",
    "migrations",
    "20261125140000_add_article_embedding_voyage",
    "migration.sql",
  ),
  "utf8",
);
const sql = SQL_BRUT.split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n");

describe("migration add_article_embedding_voyage : additive", () => {
  it("ajoute embedding_voyage vector(1024) NULLABLE, sans défaut ni NOT NULL", () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "embedding_voyage" vector\(1024\)\s*;/);
    expect(sql).not.toMatch(/NOT NULL/i);
    expect(sql).not.toMatch(/DEFAULT/i);
  });

  it("pose un lock_timeout de 5 s en tête", () => {
    expect(sql.trimStart()).toMatch(/^SET lock_timeout = '5s';/);
  });

  it("indexe en HNSW cosine", () => {
    expect(sql).toMatch(/USING hnsw \("embedding_voyage" vector_cosine_ops\)/);
  });

  it("n'altère, ne retire et ne remplit rien (colonne 1536 intacte)", () => {
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bRENAME\b/i);
    expect(sql).not.toMatch(/\bUPDATE\b/i);
    expect(sql).not.toMatch(/\bINSERT\b/i);
    expect(sql).not.toMatch(/\bDELETE\b/i);
    expect(sql).not.toMatch(/ALTER COLUMN/i);
    expect(sql).not.toMatch(/"embedding"\s/);
    expect(sql.match(/ALTER TABLE/gi)).toHaveLength(1);
  });

  it("porte le retour arrière en commentaire", () => {
    expect(SQL_BRUT).toMatch(
      /--\s+ALTER TABLE "articles" DROP COLUMN IF EXISTS "embedding_voyage"/,
    );
  });
});
