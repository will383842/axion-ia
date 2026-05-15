# DOWN — kb_01_init_schema (2026-05-13)

Init schema KB V4 — création des 7 tables Knowledge Base (KnowledgeEntry,
KbChunk obsolète, etc.). Fondation des 7 migrations `kb_v4_*` suivantes.

## Doctrine projet

**R22-first** OBLIGATOIRE. KB V4 forme un ensemble logique de 8 migrations
(`20260513221900_kb_01_init_schema` + 7 `kb_v4_*` suivantes). Rollback
partiel = data inconsistente + références orphelines.

## Risque

🔴 **Critique** — la KB V4 alimente la factory content-gen. Drop = perte
de tout le knowledge base (articles editorial publiés, FAQ, glossaire).

## Procédure

1. Identifier le backup PG le plus récent ANTÉRIEUR à `20260513221900`
2. Si rollback global KB V4 requis → restore aussi les 7 migrations
   `kb_v4_*` suivantes (toutes appliquées ensemble dans la même fenêtre)
3. Coder ce rollback en cas réel — pas en speculative.

## Order de rollback si manuel (DERNIER RECOURS)

```
20260514070000_kb_v4_annotations_collections  →  drop first (dépend des autres)
20260514060000_kb_v4_audit_log
20260514050000_kb_v4_seo_cache
20260514040000_kb_v4_ingest_requests
20260514030000_kb_v4_source_tracking
20260514020000_kb_v4_pgvector_embeddings
20260514010000_kb_v4_add_factory_types
20260513221900_kb_01_init_schema              →  drop last
```
