# DOWN — sprint_24_tiptap_json_text (2026-05-09)

Sprint 24 — ajout colonnes Tiptap JSON + text dérivé pour articles éditoriaux.

## Doctrine projet (méta-cert 2026-05-15 AGENT 14 P1)

**R22-first** : `pnpm restore-postgres-test-r2`. Le contenu Tiptap JSON
est dérivable du text dérivé via re-parse, donc data loss limitée.

## Risque

🟡 **Moyen** — perte du JSON structuré Tiptap (toolbar formatting riche)
si rollback manuel. Le `text` dérivé reste mais perd les annotations.

## SQL inverse (si R22 indispo)

```sql
BEGIN;
ALTER TABLE "Article" DROP COLUMN IF EXISTS "bodyTiptap";
ALTER TABLE "ArticleTranslation" DROP COLUMN IF EXISTS "bodyTiptap";
DELETE FROM "_prisma_migrations" WHERE migration_name = '20260509120000_sprint_24_tiptap_json_text';
COMMIT;
```

Adapter selon le diff réel de `migration.sql` (vérifier les colonnes ajoutées).
