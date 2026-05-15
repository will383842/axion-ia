# DOWN — kb_v4_pgvector_embeddings (2026-05-14)

Partie du bundle cohérent KB V4. Active extension `pgvector` + colonne
`embedding vector(1024)` sur `KnowledgeEntry` + index HNSW pour search.

## Doctrine projet

**R22-first** OBLIGATOIRE. Voir `20260513221900_kb_01_init_schema/DOWN.md`.

## Risque

🟡 **Moyen** — drop colonne `embedding` = perte de tous les embeddings
calculés via Voyage AI. Re-build coûteux (~$$ Voyage API + temps).

## SQL inverse (si R22 indispo et embeddings sacrifiables)

```sql
BEGIN;
DROP INDEX IF EXISTS "KnowledgeEntry_embedding_hnsw_idx";
ALTER TABLE "KnowledgeEntry" DROP COLUMN IF EXISTS "embedding";
-- Ne PAS drop l'extension pgvector si d'autres tables l'utilisent.
-- DROP EXTENSION IF EXISTS vector CASCADE;
DELETE FROM "_prisma_migrations" WHERE migration_name = '20260514020000_kb_v4_pgvector_embeddings';
COMMIT;
```
