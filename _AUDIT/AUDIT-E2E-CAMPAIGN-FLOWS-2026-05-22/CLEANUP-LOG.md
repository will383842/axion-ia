# CLEANUP LOG — Audit E2E Campaign Flows

**Date passe 1** : 2026-05-22 — HEAD `e7c40004`
**Date passe 2 (runtime)** : 2026-05-23 — HEAD `c39f08d`

## Statut

⚪ **AUCUNE DONNÉE TEST*E2E*\* CRÉÉE** pendant **les 2 passes** (code-level passe 1 ; runtime passe 2 audit-only).

## Passe 2 runtime — Cleanup post-audit

Cette deuxième passe a démarré l'environnement local (Docker UP + Postgres + Redis + Next.js dev) pour collecter des preuves runtime, **sans déclencher de campagne TEST*E2E*** (audit-only, budget tokens non engagé).

État DB post-passe 2 (verification queries) :

```sql
-- 1. Aucune campagne test
SELECT COUNT(*) FROM coverage_campaigns WHERE name LIKE 'TEST_E2E_%';  -- 0

-- 2. Aucun article test
SELECT COUNT(*) FROM articles WHERE slug LIKE 'test-e2e-%';  -- 0

-- 3. Aucun job test
SELECT COUNT(*) FROM content_gen_jobs WHERE campaignId IN (SELECT id FROM coverage_campaigns WHERE name LIKE 'TEST_E2E_%');  -- 0
```

### Side effects passe 2 (à valider Will avant `pnpm db:down`)

1. ✅ **Migrations DB appliquées** : `pnpm prisma migrate deploy` exécuté (idempotent — no pending migrations, donc 0 application réelle).
2. ✅ **Templates seed re-exécuté** : `pnpm tsx prisma/seeds/content-gen/seed-campaign-templates-standalone.ts` → 8 templates upserted (idempotent — pas de nouveau row).
3. ⚠️ **Containers Docker UP** : Postgres + Redis + Mailhog laissés running (Will peut arrêter avec `pnpm db:down` ou `docker compose -f docker/docker-compose.yml down`).
4. ⚠️ **Dev server :3000 UP** : `next dev` Turbopack tournait en background. Si toujours running, `kill $(lsof -t -i:3000)` ou laisser tourner.
5. ✅ **`.env.local` intact** — aucune modification.
6. ✅ **0 commit, 0 push, 0 modification source** — règles AUDIT-ONLY respectées.

### Fichiers `_AUDIT/` créés / modifiés passe 2

```
_AUDIT/AUDIT-E2E-CAMPAIGN-FLOWS-2026-05-22/
├── VERDICT-E2E-CAMPAIGN-FLOWS.md          ← MAJ §RUNTIME RE-EXÉCUTION
├── SCENARIOS-MATRIX.md                     ← MAJ §RUNTIME COMPARATIF
├── BOTTLENECKS-DETECTED.md                 ← MAJ §RUNTIME OBSERVATIONS
├── CLEANUP-LOG.md                          ← (ce fichier)
├── _logs/
│   ├── RUNTIME-EVIDENCE-MASTER-2026-05-23.md  ← NOUVEAU
│   ├── dev-server.log                          ← NOUVEAU (next dev output)
│   ├── workers.log                             ← NOUVEAU (crash tsx esbuild)
│   ├── workers-fg.log + .err                   ← NOUVEAU (debug worker)
├── _tools/
│   ├── with-env.sh                             ← NOUVEAU (env loader)
│   └── append-runtime-sections.cjs             ← NOUVEAU (script append)
└── scenarios/
    └── SC-01..SC-30.md                         ← 30 fichiers MAJ §RUNTIME VERIFICATION 2026-05-23
```

### Si Will veut tear-down complet post-audit

```powershell
# Stop dev server
$port = 3000; (Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue).OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }

# Stop containers
cd axionia
pnpm db:down

# (Optionnel) supprimer les logs audit
Remove-Item _AUDIT/AUDIT-E2E-CAMPAIGN-FLOWS-2026-05-22/_logs -Recurse -Force
```

---

## ARCHIVE PASSE 1 (code-level)

⚪ **AUCUNE DONNÉE TEST*E2E*\* CRÉÉE** pendant cet audit (passe 1).

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
