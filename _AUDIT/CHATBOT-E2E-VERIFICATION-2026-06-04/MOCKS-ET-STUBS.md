# MOCKS & STUBS — chemin runtime chatbot

Grep `mock|stub|fake|dummy|hardcoded|Math.random|FIXME|TODO|return []` sur le chemin runtime (`src/server/chatbot/**`, `src/app/api/chatbot/**`, `src/components/chatbot/**`, `chatbot-ingest-worker.ts`, `src/features/admin-chatbot/**`), hors `*.test.ts`/`*.spec.ts`.

## Verdict global : AUCUN mock de complaisance dans le runtime chatbot.

| Occurrence | Fichier:ligne | Nature | Verdict |
|------------|---------------|--------|---------|
| « graphe sœur = TODO refin. » | `catalog/repli.ts:17` | commentaire (amélioration future du repli ; le « jamais de non sec » est déjà couvert) | **légitime** (doc) |
| « Fonction de génération injectable (mockée en test) » | `generation/generate-stream.ts:45` | commentaire sur le seam d'injection LLM (testabilité) | **légitime** (seam) |
| détection `modelVersion.endsWith("-stub")` | `retrieval/hybrid-search.ts:108-115` | **mon fix D-1** : détecte le stub d'embedding pour basculer FTS-seul | **légitime** (fix) |
| détection `modelVersion?.endsWith("-stub")` | `semantic-cache/cache.ts` | **mon fix D-3** : cache no-op si embedding stub | **légitime** (fix) |
| « build-safe (stub.invalid) » | `security/prompt-guard.ts:8` | commentaire (pur, build-safe) | **légitime** (doc) |
| « contrat stub.invalid respecté » | `semantic-cache/cache.ts:15` | commentaire (instanciation runtime only) | **légitime** (doc) |
| « embeddings Voyage (ou stub sans clé) » | `chatbot-ingest-worker.ts:6` | commentaire (réfère le stub partagé) | **légitime** (doc) |

## Le SEUL stub réel du chemin = embeddings partagés

`src/lib/knowledge/embeddings.ts` (HORS périmètre chatbot, lib partagée KB+chatbot) : si `VOYAGE_API_KEY` absente, `generateEmbedding()` renvoie un **`stubEmbedding`** déterministe (hash) au lieu de throw. Conçu pour les tests KB sans coût API.

**Impact chatbot & traitement** :
- **Retrieval** (D-1) : le stub polluait les résultats → **corrigé** (repli FTS-seul si stub).
- **Cache** (D-3) : le stub pouvait causer un faux-hit → **corrigé** (cache no-op si stub).
- **En production** : `VOYAGE_API_KEY` présente → `embedWithVoyage` réel (dim 1024, throw si erreur HTTP) → **aucun stub dans le runtime prod**. Vérifié par lecture (`embeddings.ts:129-133`).

**Conclusion §0.3** : zéro mock/stub dans le runtime chatbot **en production** ; les deux points où le stub partagé fuyait dans la logique chatbot (retrieval, cache) sont désormais neutralisés et basculent proprement en mode sans-vecteur. Les mocks `vi.fn()`/`vi.mock` ne vivent que dans les `*.test.ts` (normaux).

## Génération & embeddings sans clé : throw, pas de réponse hardcodée

- `src/server/content-gen/providers/anthropic.ts:126` : `throw ProviderError("ANTHROPIC_API_KEY not set")` → **aucune réponse LLM hardcodée** ; l'orchestrateur bascule en mode dégradé (T-16) prouvé.
- `embeddings.ts` : stub pour embeddings uniquement (neutralisé côté chatbot), pas pour la génération.
