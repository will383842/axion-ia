/**
 * T-02 — Migration FTS chatbot (vector/HNSW/tsvector).
 *
 * L'application réelle (`psql -f`) + `\d chat_kb_chunks` est un smoke runtime
 * (DB requise, différé tant que Docker est down). Ici on vérifie de façon
 * déterministe et DB-indépendante que le SQL migrations_fts est correct et
 * ALIGNÉ : extension vector, dimension 1024 == EMBEDDING_DIMENSION, tsv généré
 * en fr_unaccent (identique kb_fts_setup), index HNSW cosine + GIN, et que la
 * migration core (T-01) n'a PAS ces colonnes (cloisonnement du split).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { EMBEDDING_DIMENSION } from "@/lib/knowledge/embeddings";

const ftsSql = readFileSync(
  resolve(__dirname, "../../prisma/migrations_fts/20260603220500_chatbot_fts.sql"),
  "utf8",
);
const coreSql = readFileSync(
  resolve(__dirname, "../../prisma/migrations/20260603220000_chatbot_core/migration.sql"),
  "utf8",
);

describe("T-02 chatbot FTS migration", () => {
  it("active l'extension vector", () => {
    expect(ftsSql).toMatch(/CREATE EXTENSION IF NOT EXISTS vector/i);
  });

  it("ajoute embedding vector(1024) sur chat_kb_chunks — dimension alignée embeddings.ts", () => {
    expect(EMBEDDING_DIMENSION).toBe(1024);
    expect(ftsSql).toMatch(
      new RegExp(`"chat_kb_chunks"[\\s\\S]*?"embedding"\\s+vector\\(${EMBEDDING_DIMENSION}\\)`),
    );
  });

  it("ajoute question_embedding vector(1024) sur chat_semantic_cache", () => {
    expect(ftsSql).toMatch(/"question_embedding"\s+vector\(1024\)/);
  });

  it("génère tsv en fr_unaccent (config identique kb_fts_setup)", () => {
    expect(ftsSql).toMatch(/"tsv"\s+tsvector\s+GENERATED ALWAYS AS/);
    expect(ftsSql).toMatch(/to_tsvector\('fr_unaccent'/);
    // ne doit pas utiliser 'french' / 'simple' (cohérence FR-only).
    expect(ftsSql).not.toMatch(/to_tsvector\('(french|simple|english)'/);
  });

  it("crée des index HNSW cosine + GIN", () => {
    expect(ftsSql).toMatch(/USING hnsw \("embedding" vector_cosine_ops\)/);
    expect(ftsSql).toMatch(/USING hnsw \("question_embedding" vector_cosine_ops\)/);
    expect(ftsSql).toMatch(/USING GIN \("tsv"\)/);
  });

  it("cloisonnement du split : la migration core (T-01) ne contient AUCUNE colonne vector/tsvector", () => {
    // On ignore les lignes de commentaire (-- …) : seul le DDL réel compte.
    const coreDdl = coreSql
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    expect(coreDdl).not.toMatch(/vector\(1024\)/);
    expect(coreDdl).not.toMatch(/tsvector/);
    expect(coreDdl).not.toMatch(/hnsw/i);
  });
});
