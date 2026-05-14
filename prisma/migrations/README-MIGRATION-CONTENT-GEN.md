# Migration manquante : `add_content_gen_core` (Pass B P0-1)

> **Statut** : 🔴 **À GÉNÉRER PAR WILL** — bloqueur P0-1 du Pass B audit
> (2026-05-14). Sans cette migration, les 16 modèles content-gen + 14+ enums
> déclarés dans `schema.prisma` n'existent pas en base de données. Le code
> compile, les tests verts, mais **`pnpm prisma migrate deploy` ne crée rien
> en prod** car aucune migration SQL CREATE TABLE n'a été générée.

---

## Pourquoi cette migration est manquante

L'audit interne du 14-mai 2026 listait l'application de la migration
`add_content_gen_core` comme « action Will » (bloqueur infra prod). Le Pass B
indépendant a constaté que **la migration n'existe même pas en code** —
seule la migration `20260508175629_init` (legacy) existe et elle ne contient
aucune table `content_gen_*`.

Le ContentGenJob, ContentGenConfig, ContentTemplate, AuthorProfile,
BannedPhrase, CoverageDistributionProfile, AudienceMixProfile,
CoverageCampaign, ProviderConfig, GenerationLog, ReviewQueue, WebVitalSample,
CostLedger, ContentMetric, ExternalReference, ContentCitation + 14+ enums
(ContentType, ContentGenJobStatus, IndexationTier, ReviewStatus, etc.) sont
définis dans `schema.prisma:2547-2941` mais aucun CREATE TABLE / CREATE TYPE
correspondant.

## Procédure de génération (Will, 5 min)

### Prérequis

- Postgres local (Docker recommandé) avec une base `axion_ia_dev` vide ou
  contenant l'init legacy seulement
- Variables d'environnement `.env.local` :
  - `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/axion_ia_dev?schema=public"`
  - `DIRECT_URL="postgresql://postgres:postgres@localhost:5432/axion_ia_dev?schema=public"`
- Vérifier que `prisma generate` passe : `pnpm prisma generate`

### Étapes

```bash
# 1. Vérifier que les migrations précédentes sont appliquées en dev
pnpm prisma migrate status

# 2. Générer la migration SQL pour add_content_gen_core (sans appliquer)
# Note : --create-only évite d'appliquer et permet de relire le SQL avant
pnpm prisma migrate dev --create-only --name add_content_gen_core

# 3. Inspecter le SQL généré dans prisma/migrations/<timestamp>_add_content_gen_core/migration.sql
# Vérifier qu'il contient :
#   - CREATE TYPE pour 14+ enums content-gen
#   - CREATE TABLE pour 16 modèles content-gen
#   - CREATE INDEX sur status/createdAt/campaignId/anchorVilleSlug
#   - ALTER TABLE articles ADD COLUMN pour les champs content-gen V1.7

# 4. Si OK, appliquer en dev local
pnpm prisma migrate dev

# 5. Vérifier en SQL que les tables existent
psql -h localhost -U postgres -d axion_ia_dev -c "\dt content_gen_*"
psql -h localhost -U postgres -d axion_ia_dev -c "\dT+ content_type"

# 6. Lancer les seeds idempotents content-gen
pnpm content-gen:seed

# 7. Commit la migration
git add prisma/migrations/<timestamp>_add_content_gen_core
git commit -m "feat(content-gen): p0-1 migration add_content_gen_core générée"
git push origin <ta-branche>

# 8. En prod (Coolify) : la migration s'applique automatiquement via
#    `pnpm prisma migrate deploy` au boot du worker / pendant deploy.
#    Vérifier les logs Coolify pour confirmer "Applied N migrations".
```

### Sanity check post-migration

Après application en dev, ces requêtes doivent retourner sans erreur :

```bash
# Compte les tables content-gen créées
psql -d axion_ia_dev -c "
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema='public' AND table_name LIKE 'content_gen%' OR
        table_name IN ('provider_configs', 'author_profiles', 'banned_phrases',
                       'coverage_campaigns', 'coverage_distribution_profiles',
                       'audience_mix_profiles', 'review_queue', 'cost_ledger',
                       'content_metrics', 'web_vital_samples', 'external_references',
                       'content_citations', 'generation_logs');"
# → doit être ≥ 16

# Compte les enums content-gen créés
psql -d axion_ia_dev -c "
  SELECT COUNT(*) FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid
  WHERE n.nspname='public' AND typtype='e' AND typname IN
    ('content_type', 'content_gen_job_status', 'log_level', 'indexation_tier',
     'expansion_mode', 'provider_key', 'provider_role', 'review_status',
     'coverage_status', 'coverage_scope', 'organisation_type', 'search_intent',
     'trust_tier', 'web_vital_metric', 'web_vital_rating');"
# → doit être ≥ 14
```

## Action de fallback (si pas de DB locale Postgres)

Si Will ne peut pas faire tourner Postgres en local :

1. **Option A** : Démarrer un Postgres Docker éphémère :

   ```bash
   docker run --rm -d --name pg-migrate \
     -e POSTGRES_PASSWORD=postgres \
     -e POSTGRES_DB=axion_ia_dev \
     -p 5432:5432 postgres:16
   # → puis lancer prisma migrate dev comme ci-dessus
   ```

2. **Option B** : Utiliser un Postgres staging Coolify temporaire (Hetzner)
   en pointant DIRECT_URL dessus. Plus risqué (l'envoi sur prod réelle est
   à proscrire avant validation manuelle du SQL).

3. **Option C (déconseillée)** : Générer manuellement le SQL `CREATE TABLE`
   - `CREATE TYPE` en lisant `schema.prisma` et le placer dans
     `prisma/migrations/20260514999999_add_content_gen_core/migration.sql`.
     Risque haut de divergence schema.prisma ↔ SQL.

## Lien Pass B

Détails complets : `_AUDIT/CONTENT-GEN-V1-PASS-B-2026-05-14.md` (au niveau
repo parent Axion-IA) § 2 finding P0-1 + § 6 plan S6.1 Jour 1.
