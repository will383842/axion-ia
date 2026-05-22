# CLEANUP LOG — Audit E2E Campaign Flows

**Date** : 2026-05-22
**HEAD** : `e7c40004`

## Statut

⚪ **AUCUNE DONNÉE TEST*E2E*\* CRÉÉE** pendant cet audit.

## Raison

L'audit a été exécuté en **mode code-level forensique uniquement**, car les pré-requis runtime ne sont pas satisfaits :

| Pré-requis                         | Statut détecté                               |
| ---------------------------------- | -------------------------------------------- |
| Docker daemon                      | ❌ npipe non disponible (`docker info` fail) |
| Postgres `localhost:5433`          | ❌ port fermé (`Test-NetConnection False`)   |
| Redis `localhost:6381`             | ❌ port fermé                                |
| Next dev server `localhost:3000`   | ❌ port fermé                                |
| `ANTHROPIC_API_KEY` (`.env.local`) | ❌ absent                                    |
| `OPENAI_API_KEY` (`.env.local`)    | ❌ absent                                    |
| `BULLMQ_DISABLED` (`.env.local`)   | `true` (workers désactivés)                  |

Aucune connexion DB ni Redis n'a été tentée, aucun INSERT n'a été effectué, aucune campagne/article TEST*E2E*\* n'existe.

## Conséquence

- **Aucun cleanup SQL nécessaire**
- **Aucune restauration `MAX_PUBLISH_PER_DAY`** (non modifié)
- **Aucune restauration cost caps** (non modifiés)
- **Aucun mock LLM injecté**
- **Zéro effet de bord** sur l'environnement (dev ou prod)

## Vérification

```sql
-- Si lancé en runtime quand DB disponible, devrait retourner 0 rows :
SELECT COUNT(*) FROM coverage_campaigns WHERE name LIKE 'TEST_E2E_%';
SELECT COUNT(*) FROM articles WHERE slug LIKE 'test-e2e-%';
SELECT COUNT(*) FROM content_gen_jobs WHERE campaign_id IN (SELECT id FROM coverage_campaigns WHERE name LIKE 'TEST_E2E_%');
```

## Si Will souhaite exécuter runtime ultérieurement

Procédure cleanup à appliquer **après** chaque session test (ordre respectant FK Restrict `GenerationProvenance.articleId` → `Article`) :

```sql
-- 1. Provenance (FK Restrict bloquerait sinon)
DELETE FROM generation_provenance
WHERE article_id IN (SELECT id FROM articles WHERE slug LIKE 'test-e2e-%');

-- 2. Articles (FactCheckClaim + ArticleSlugHistory + ArticleTagOnArticle Cascade auto)
DELETE FROM articles WHERE slug LIKE 'test-e2e-%';

-- 3. Jobs
DELETE FROM content_gen_jobs
WHERE campaign_id IN (SELECT id FROM coverage_campaigns WHERE name LIKE 'TEST_E2E_%');

-- 4. Campagnes
DELETE FROM coverage_campaigns WHERE name LIKE 'TEST_E2E_%';
```

Puis :

```bash
# Restaurer config UI (si modifiée)
UPDATE content_gen_config SET value='30' WHERE key='MAX_PUBLISH_PER_DAY';

# Cleanup BullMQ keys
redis-cli DEL "axion:pub:$(date +%Y%m%d)"
redis-cli KEYS "bull:content-gen-jobs:*" | xargs redis-cli DEL  # à utiliser avec parcimonie
```

## Confirmation

✅ **Environnement intact post-audit** — aucune action destructive n'a été réalisée.
