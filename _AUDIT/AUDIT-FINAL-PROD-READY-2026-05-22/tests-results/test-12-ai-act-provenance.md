# Test 12 — AI Act art. 50 traçabilité

## Date : 2026-05-22

## Model GenerationProvenance dans prisma/schema.prisma

model GenerationProvenance {
id String @id @default(cuid())
articleId String @map("article_id") @db.Uuid
article Article @relation(fields: [articleId], references: [id], onDelete: Restrict)
step String @db.VarChar(80)
provider String @db.VarChar(40)
model String @db.VarChar(80)
modelVersion String? @map("model_version") @db.VarChar(40)
promptHash String @map("prompt_hash") @db.VarChar(64)
inputTokens Int @map("input_tokens")
outputTokens Int @map("output_tokens")
cacheReadInputTokens Int @default(0) @map("cache_read_input_tokens")
cost Decimal @db.Decimal(10, 6)
regulationVersion String @default("AI-Act-2024/1689") @map("regulation_version") @db.VarChar(40)
previousHash String? @map("previous_hash") @db.VarChar(64)
hash String @db.VarChar(64)
timestamp DateTime @default(now())

@@index([articleId])
@@index([timestamp])
@@map("generation_provenance")
}

/// P4 Sprint P0-6 — Claims factuels extraits + vérifiés par fact-checker.
/// Persistance individuelle par claim pour audit trail + monitoring qualité.
/// Claim verification = stub SHA-256 V1 (Voyage AI RAG différé Sprint S+7).
model FactCheckClaim {
id String @id @default(cuid())
articleId String @map("article_id") @db.Uuid
claim String @db.Text
status String @default("unverified") @db.VarChar(30)
sourceUrl String? @map("source_url") @db.VarChar(512)
sourceTitle String? @map("source_title") @db.VarChar(255)
confidence Float @default(0)
createdAt DateTime @default(now()) @map("created_at")

article Article @relation(fields: [articleId], references: [id], onDelete: Cascade)

@@index([articleId])
@@index([status])
@@map("factcheck_claims")
}

model ArticleTranslation {
id String @id @default(uuid()) @db.Uuid
articleId String @map("article_id") @db.Uuid
article Article @relation(fields: [articleId], references: [id], onDelete: Cascade)
locale Locale
title String @db.VarChar(255)
slug String @db.VarChar(255)
excerpt String? @db.Text

## Audit log builder

src/server/content-gen/audit-log.ts

## Wording AiContentDisclaimer D4

## promptHash builder (P2 P0-3)

src/server/content-gen/generators/blog-article.ts:297: promptHash: lastPromptHash,
src/server/content-gen/generators/blog-from-keywords.ts:336: promptHash: lastPromptHash,
src/server/content-gen/generators/blog-from-rss.ts:401: promptHash: lastPromptHash,
src/server/content-gen/generators/blog-from-title.ts:320: promptHash: lastPromptHash,
src/server/content-gen/generators/comparison.ts:349: promptHash: lastPromptHash,
src/server/content-gen/generators/faq-standalone.ts:270: promptHash: lastPromptHash,
src/server/content-gen/generators/guide-pilier.ts:365: promptHash: lastPromptHash,
src/server/content-gen/generators/landing-ville.ts:269: promptHash: lastPromptHash,
src/server/content-gen/generators/qa-derived.ts:319: promptHash: lastPromptHash,
src/server/content-gen/generators/types.ts:92: readonly promptHash?: string;
src/server/content-gen/provenance/provenance-logger.ts:23: readonly promptHash: string;
src/server/content-gen/provenance/provenance-logger.ts:32: _ Input : previousHash (ou "") + promptHash + timestamp ISO.
src/server/content-gen/provenance/provenance-logger.ts:36: promptHash: string,
src/server/content-gen/provenance/provenance-logger.ts:40: .update(`${previousHash}:${promptHash}:${timestamp.toISOString()}`)
src/server/content-gen/provenance/provenance-logger.ts:69: const hash = computeProvenanceHash(previousHash, input.promptHash, timestamp);
src/server/content-gen/provenance/provenance-logger.ts:78: promptHash: input.promptHash,
src/server/content-gen/provenance/provenance-logger.ts:110: promptHash: string;
src/server/content-gen/provenance/**tests**/provenance-logger.spec.ts:6: _ 2. computeProvenanceHash chaine correctement previousHash + promptHash + timestamp.
src/server/content-gen/provenance/**tests**/provenance-logger.spec.ts:71: promptHash: hashPrompt("test:prompt"),
src/server/content-gen/provenance/**tests**/provenance-logger.spec.ts:94: promptHash: hashPrompt("test:prompt2"),
