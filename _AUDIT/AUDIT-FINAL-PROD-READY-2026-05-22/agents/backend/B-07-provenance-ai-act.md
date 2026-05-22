# B-07 — Provenance AI Act art. 50

**Score : 22/25**
**Verdict : GO — conformité acquise, hash chaîné, RESTRICT FK, promptHash réel**

## Schéma `GenerationProvenance` (`prisma/schema.prisma:979`)

16 colonnes (cible audit) :

1. `id` String CUID `:980`
2. `articleId` Uuid `:981`
3. `step` VarChar(80) `:983`
4. `provider` VarChar(40) `:984`
5. `model` VarChar(80) `:985`
6. `modelVersion` VarChar(40)? `:986`
7. `promptHash` VarChar(64) `:987` — **hash réel SHA-256** (cf. provenance-logger)
8. `inputTokens` Int `:988`
9. `outputTokens` Int `:989`
10. `cacheReadInputTokens` Int default 0 `:990`
11. `cost` Decimal(10,6) `:991`
12. `regulationVersion` VarChar(40) default "AI-Act-2024/1689" `:992`
13. `previousHash` VarChar(64)? `:993`
14. `hash` VarChar(64) `:994`
15. `timestamp` DateTime `:995`
16. (relation `article` `:982` — pas une colonne mais un lien)

= **15 colonnes + 1 relation** (proche cible 16, conforme matériellement).

## FK cascade : RESTRICT ✅

`schema.prisma:982` :

```prisma
article Article @relation(fields: [articleId], references: [id], onDelete: Restrict)
```

Conforme P2 P0-1 (Sprint Correctif). Articles ne peuvent être supprimés tant qu'il y a une provenance liée → audit immuable AI Act art. 50.

## Hash chaîné

`src/server/content-gen/provenance/provenance-logger.ts:34` :

```ts
computeProvenanceHash(previousHash, promptHash, timestamp) = sha256(
  `${previousHash}:${promptHash}:${timestamp.toISOString()}`,
).slice(0, 64);
```

`logProvenance():59` :

1. Recherche dernière row (`articleId`, order `timestamp desc`) → `previousHash` `:62-66`
2. Calcule nouveau `hash = sha256(previous + promptHash + ts)` `:69`
3. Insert avec `previousHash` + `hash` + `regulationVersion="AI-Act-2024/1689"` `:71-87`

→ Toute modification rétroactive invalide la chaîne ✅.

## promptHash = vrai hash

`hashPrompt(prompt)` `:49` : `sha256(prompt).digest("hex").slice(0,64)`.

Câblé dans `content-publish-worker.ts:488-494` :

```ts
const rawPromptHash = (cgJob.outputJsonRaw as Record<string, unknown> | null)?.promptHash;
const promptHash =
  typeof rawPromptHash === "string" && rawPromptHash.length === 64
    ? rawPromptHash
    : hashPrompt(`${cgJob.contentType}:${cgJob.id}:${article.id}`);
```

→ Les generators (Sprint A P0-3) posent `output.promptHash` = vrai hash du prompt LLM ; fallback technique pour articles antérieurs au fix (rétrocompat). ✅

## Fire-and-forget post-publish

`content-publish-worker.ts:478-506` invoque `logProvenance()` après l'insert Article. Échec non-bloquant (`:91-95` catch + console.warn + return null).

→ **Trade-off** : si le worker crash entre `prisma.article.create` (`:330-394` transaction) et `logProvenance` (`:495`), l'article est publié sans provenance. Risque AI Act faible (le job reste, peut être backfillé), mais pas verrouillé non plus.

## Rétention 6 ans

Pas de cron purge spécifique à GenerationProvenance dans `bootRepeatableJobs()`. Le retention-purge-worker cible RGPD (newsletter, submissions) mais pas provenance — **cohérent** (AI Act 6 ans > RGPD 36 mois ; provenance reste indéfiniment ou tant que l'article reste).

## Endpoint admin lecture

`src/app/api/admin/articles/[id]/provenance/route.ts` (présent inventaire B-02) — appelé via `getProvenanceForArticle(articleId)` `:103` qui retourne `[]` si table absente (bootstrap-safe). ✅

## Findings

### P0

Aucun.

### P1

1. **Race condition post-publish/pré-provenance** (`content-publish-worker.ts:330-394` transaction puis `:495` logProvenance hors transaction). Si crash worker entre les deux, article publié sans 1ʳᵉ entrée provenance. Mitigation possible : déplacer `logProvenance` dans la transaction Prisma (mais ça bloquerait publish sur fail provenance — trade-off à arbitrer).

### P2

2. **Pas de vérification d'intégrité de la chaîne** (script audit qui recompute tous les `hash` et vérifie cohérence `previousHash`). À ajouter pour rapport SOC2/AI Act audit externe.
3. **`cost Decimal(10, 6)`** : précision potentiellement insuffisante pour cache_read Anthropic ($0.0000003/token → cost individuel peut être < 0.000001). Borderline (somme reste OK).
4. **promptHash tronqué à 64 chars** = full SHA-256 hex déjà 64 chars donc le `.slice(0, 64)` est un no-op. Cosmétique.

## Verdict paragraphe

**Conformité AI Act art. 50 acquise** : 15+1 colonnes incluant `regulationVersion`, hash chaîné SHA-256 (`previousHash → hash`), `promptHash` réel sur les articles récents, FK `Restrict` immuable, endpoint admin de lecture. Le seul gap est la race condition post-publish/pré-provenance (P1 #1) — improbable mais théorique. **22/25**, perte 3 points sur race-condition (P1) + audit verifier script absent (P2) + précision cost Decimal (P2).
