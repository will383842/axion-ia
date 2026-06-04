/**
 * T-01 — Schéma chat_* + migration core (ADR-CB-03 / doc 03).
 *
 * Tests structurels (sans DB live — basés sur le DMMF Prisma + enums runtime) :
 *  - les 8 modèles chat_* existent et portent `tenant_id` (sauf idempotency, sans tenant)
 *  - relations vers Submission/Conversation correctes
 *  - colonnes pgvector/tsvector déclarées Unsupported (ajoutées en T-02 migrations_fts)
 *  - champs MVP5 (T-38) présents sur ChatConversation
 *  - D-LEAD-SOURCE : enum SubmissionSource + colonne additive `Submission.source` NULLABLE
 *    → une Submission existante sans `source` reste valide (0 régression).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { Prisma, SubmissionSource } from "../../prisma/generated/client";

// Les colonnes Unsupported (vector/tsvector) ne sont pas exposées dans le DMMF
// queryable de Prisma → on vérifie leur déclaration via le texte du schéma.
const schemaSource = readFileSync(resolve(__dirname, "../../prisma/schema.prisma"), "utf8");

const models = Prisma.dmmf.datamodel.models;
const modelByName = (name: string) => models.find((m) => m.name === name);
const fieldNames = (name: string) => (modelByName(name)?.fields ?? []).map((f) => f.name);

const CHAT_MODELS = [
  "ChatTenant",
  "ChatKbChunk",
  "ChatSemanticCache",
  "ChatPromptVersion",
  "ChatConversation",
  "ChatMessage",
  "ChatEscalation",
  "ChatActionIdempotency",
] as const;

describe("T-01 chat_* schema", () => {
  it("déclare les 8 modèles chat_*", () => {
    for (const name of CHAT_MODELS) {
      expect(modelByName(name), `${name} manquant`).toBeDefined();
    }
  });

  it("mappe chaque modèle en snake_case chat_*", () => {
    const expected: Record<string, string> = {
      ChatTenant: "chat_tenants",
      ChatKbChunk: "chat_kb_chunks",
      ChatSemanticCache: "chat_semantic_cache",
      ChatPromptVersion: "chat_prompt_versions",
      ChatConversation: "chat_conversations",
      ChatMessage: "chat_messages",
      ChatEscalation: "chat_escalations",
      ChatActionIdempotency: "chat_action_idempotency",
    };
    for (const [model, table] of Object.entries(expected)) {
      expect(modelByName(model)?.dbName).toBe(table);
    }
  });

  it("porte tenant_id sur les tables multi-tenant", () => {
    // Toutes les tables chat_* sauf message (relié via conversation) et idempotency (global).
    const tenantScoped = [
      "ChatTenant", // id == tenant
      "ChatKbChunk",
      "ChatSemanticCache",
      "ChatPromptVersion",
      "ChatConversation",
      "ChatEscalation",
    ];
    for (const name of tenantScoped) {
      const fields = fieldNames(name);
      const hasTenant = name === "ChatTenant" ? fields.includes("id") : fields.includes("tenantId");
      expect(hasTenant, `${name} sans tenantId`).toBe(true);
    }
  });

  it("déclare embedding/tsv (Unsupported) sur ChatKbChunk — colonnes ajoutées en T-02", () => {
    expect(schemaSource).toMatch(/embedding\s+Unsupported\("vector\(1024\)"\)\?/);
    expect(schemaSource).toMatch(/tsv\s+Unsupported\("tsvector"\)\?/);
  });

  it("déclare question_embedding (Unsupported) sur ChatSemanticCache", () => {
    expect(schemaSource).toMatch(
      /questionEmbedding\s+Unsupported\("vector\(1024\)"\)\?\s+@map\("question_embedding"\)/,
    );
  });

  it("inclut les champs d'état MVP5 (T-38) sur ChatConversation", () => {
    const fields = fieldNames("ChatConversation");
    expect(fields).toEqual(
      expect.arrayContaining(["searchSlots", "proposedOffers", "linkState", "sessionUuid"]),
    );
  });

  it("relie ChatMessage → ChatConversation et ChatEscalation → ChatConversation", () => {
    const msgConvField = modelByName("ChatMessage")?.fields.find((f) => f.name === "conversation");
    expect(msgConvField?.type).toBe("ChatConversation");
    const escConvField = modelByName("ChatEscalation")?.fields.find(
      (f) => f.name === "conversation",
    );
    expect(escConvField?.type).toBe("ChatConversation");
  });
});

describe("T-01 D-LEAD-SOURCE (Submission.source additif)", () => {
  it("expose l'enum SubmissionSource avec les 5 valeurs", () => {
    expect(Object.values(SubmissionSource).sort()).toEqual(
      ["api", "chatbot", "contact_page", "form", "import"].sort(),
    );
  });

  it("ajoute Submission.source de type SubmissionSource NULLABLE (0 régression)", () => {
    const source = modelByName("Submission")?.fields.find((f) => f.name === "source");
    expect(source, "champ source manquant sur Submission").toBeDefined();
    expect(source?.type).toBe("SubmissionSource");
    // Nullable ⇒ une Submission existante sans source reste valide.
    expect(source?.isRequired).toBe(false);
    expect(source?.hasDefaultValue).toBe(false);
  });

  it("type-check : une Submission sans source est un input valide", () => {
    // Si `source` était requis, cet objet ne compilerait pas (régression formulaires).
    const legacyInput: Prisma.SubmissionUncheckedCreateInput = {
      type: "contact",
      companyName: "ACME",
      contactName: "Jean",
      contactEmail: "jean@acme.fr",
      details: {},
    };
    expect(legacyInput.source).toBeUndefined();
  });
});
