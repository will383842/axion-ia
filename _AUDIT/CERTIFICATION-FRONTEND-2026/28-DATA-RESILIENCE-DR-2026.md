# 28 — DATA RESILIENCE + DISASTER RECOVERY 2026

> Audit Prisma queries (N+1, indexes), migration runbook, DR scenarios chiffrés, backup/restore drills cadencés, subprocessor automation.
> Comble le gap critique scale 100K-300K rows DB identifié par audit indépendant 2026-05-08.
> Lancer fenêtre fraîche.

## 0. Contexte

À 100K-300K pages SSG + RUM events + bookings + audit logs, la DB devient un sujet réel :

- N+1 queries explosent
- Indexes manquants = full table scans
- Migrations atomiques (Prisma migrate deploy) doivent garantir zero-downtime
- DR scenarios (DB corruption, Hetzner région down) doivent être anticipés

Référence thresholds : `README.md` § Thresholds canoniques (RTO < 1h, RPO < 24h, restore drill trimestriel).

## 1. Audit en 7 chapitres × 10 critères = 70 points

### Chapitre 1 — Prisma queries audit

1.1 Toutes queries Prisma utilisent `select` ou `include` explicite (jamais default fetch all)
1.2 N+1 detection actif : log Prisma queries en dev (`prisma:query`) + audit
1.3 Top 10 queries via `pg_stat_statements` documentées
1.4 Aucune query > 100 ms p95 (sinon optimization required)
1.5 Pagination (cursor-based) sur listes > 100 items
1.6 `Prisma.transaction` utilisée pour mutations atomic multi-tables
1.7 Connection pool taille adaptée (`connection_limit` Prisma)
1.8 Dataloader-like pattern (Prisma already does it via `findMany` + `in`)
1.9 Tests vitest sur queries critiques (snapshot ou contract tests)
1.10 Slow query log Postgres activé (> 100 ms)

### Chapitre 2 — Indexes coverage

2.1 Index sur `slug` (lookup principal villes/régions)
2.2 Index sur `locale` (filtrage FR/EN partout)
2.3 Composite index `(locale, status)` (filtrage indexable pages)
2.4 Composite index `(region, slug)` pour villes by region
2.5 Index sur `lastmod` (sitemap génération)
2.6 Index sur `publishedAt` (blog Sprint 14.6+)
2.7 Index unique sur `email` (users Sprint 16)
2.8 Index sur `bookingDate` (calendrier queries)
2.9 Audit `EXPLAIN ANALYZE` sur top 10 queries lentes
2.10 Pas d'index inutilisé (Postgres `pg_stat_user_indexes idx_scan = 0`)

### Chapitre 3 — Migration runbook (Prisma migrate deploy)

3.1 Migration runbook documenté (`docs/runbooks/db-migration.md`)
3.2 Étapes : staging dry-run → backup pre-migration → deploy → smoke test → rollback ready
3.3 Migration zero-downtime garantie (additive only en prod)
3.4 Breaking schema changes en 2 étapes (additive deploy → cleanup deploy)
3.5 Rollback steps documentés (revert migration ou compensation)
3.6 Migration locks (Prisma advisory locks pour éviter races multi-pods)
3.7 Migration timing estimé pré-deploy (count rows × ms/row)
3.8 Backup automatique avant migration prod
3.9 Migration history archivée (Prisma `_prisma_migrations` table)
3.10 Notification Telegram succès/échec post-migration

### Chapitre 4 — Backup strategy

4.1 Backup auto Coolify daily configuré
4.2 Backup destination Backblaze B2 free tier (10 GB) ou Hetzner Storage Box (€3/mois)
4.3 Retention 30 jours minimum
4.4 Backup incrémental possible (pgBackRest ou WAL-G si volume > 10 GB)
4.5 Backup chiffré (gpg ou via Coolify)
4.6 Test integrity backup (restore weekly automatique sur staging)
4.7 Backup dump format `custom` Postgres (pg_restore parallel)
4.8 Backup metadata (schema version, timestamp, size)
4.9 Backup hors-site (B2 ou Storage Box) pour DR
4.10 Backup non sur même VPS Hetzner (geo-redundancy minimal)

### Chapitre 5 — Restore drill cadencé

5.1 Restore drill trimestriel obligatoire (cf. README thresholds)
5.2 Procédure documentée step-by-step (`docs/runbooks/db-restore.md`)
5.3 RTO mesuré ≤ 1h (Recovery Time Objective)
5.4 RPO mesuré ≤ 24h (Recovery Point Objective — daily backup)
5.5 Restore sur environnement isolé (jamais sur prod directe)
5.6 Validation post-restore (count rows, sample queries, schema integrity)
5.7 Drill log archivé (`docs/dr-drills/YYYY-MM-DD.md`)
5.8 Action items post-drill trackés
5.9 RTO/RPO trends mesurés (amélioration cumulative)
5.10 DR drill complet semestriel (full DR scenario simulation)

### Chapitre 6 — DR scenarios chiffrés

6.1 Scenario A : DB corruption full → restore from B2 backup → RTO 1h, RPO 24h
6.2 Scenario B : Hetzner Falkenstein down → bascule lecture-seule via Cloudflare cache stale → uptime 95 % maintenu jusqu'à région restored
6.3 Scenario C : Coolify down (mais VPS up) → restart Coolify → 5-10 min downtime
6.4 Scenario D : Cloudflare down → bascule DNS direct vers Hetzner IP → propagation 5 min (TTL bas pendant DR seulement)
6.5 Scenario E : Will absent + incident → runbook auto-exécutable par tiers (clé chez avocat ou famille)
6.6 Scenario F : Données client corrompues spécifiques (1 row) → restore granulaire via pg_restore `--data-only --table=...`
6.7 Scenario G : Compromission SSH → rotation immédiate clés + audit logs Coolify + Caddy
6.8 Scenario H : Compromission Cloudflare API token → revoke + nouveau token + audit Cache Rules
6.9 Scenario I : Pic traffic 10× imprévu → Cloudflare absorb + Hetzner CX42 upgrade (45 min)
6.10 Scenario J : Backups corrompus (worst case) → recovery from CSV exports manuels (data export mensuel B2)

### Chapitre 7 — Subprocessor list automation

7.1 `docs/SUBPROCESSORS.md` à jour (Hetzner, Cloudflare, Backblaze, OpenAI/Claude si AI, etc.)
7.2 CI check : si `package.json` ajoute SDK third-party non listé → block PR
7.3 GDPR : data residency par sous-traitant (Hetzner DE ✅, Cloudflare global, B2 US à clarifier)
7.4 SCC (Standard Contractual Clauses) ou DPA signés référencés
7.5 Sub-processor changes notifiés (page `/changements-sous-traitants` ou newsletter)
7.6 Audit annuel sub-processors (renouveler DPA, vérifier compliance)
7.7 Backup sub-processor (B2 alternative si compromission)
7.8 Cookie scanner CI (Puppeteer scan cookies déposés vs déclarés)
7.9 Right-to-be-forgotten workflow automatisé (Sprint 16+ : scrub user data + cascade)
7.10 Data retention auto (cron : delete users inactifs > 3 ans, etc.)

## 2. Méthode

### Phase A — Inventaire

1. Run `prisma:query` log activé sur staging, capture 1 jour de queries
2. Top 20 queries via `pg_stat_statements`
3. `EXPLAIN ANALYZE` sur top 10 queries
4. List indexes existants vs queries fréquentes (gap analysis)
5. Audit Coolify backup config
6. Lister docs/runbooks/ existants
7. Audit `docs/SUBPROCESSORS.md` complétude

### Phase B — Diagnostic /70

### Phase C — Plan

- Indexes à créer (avec migration Prisma)
- Queries à optimiser (refactor select/include)
- Runbooks à créer (db-migration, db-restore)
- DR scenarios à tester en drill
- Subprocessor automation à câbler

### Phase D — STOP & ASK

Livre :

- `audit-28-data-resilience-SYNTHESE.md`
- `audit-28-data-resilience-DIAGNOSTIC.md`
- `audit-28-data-resilience-INDEXES-PLAN.md`
- `audit-28-data-resilience-DR-SCENARIOS.md`
- `audit-28-data-resilience-RUNBOOKS.md` (templates)
- `audit-28-data-resilience-PLAN.md`

### Phase E — Application après GO

## 3. STOP & ASK

1. Avant ajout indexes prod (impact write perf, lock table)
2. Avant migration zero-downtime risquée (validation staging obligatoire)
3. Avant tout DR drill production (préférer staging)
4. Avant changement backup config (impact RPO)
5. Avant ajout sub-processor (impact GDPR)
6. Avant rotation secrets prod (planifier maintenance window)
7. Avant tout commit
8. Si query p95 > 500 ms détectée (signal majeur)
9. Si backup integrity fail (urgence)

## 4. Anti-patterns à éviter (Pitfalls)

- ❌ Backup sur même VPS que DB (single point of failure)
- ❌ Migration sans backup pré-deploy
- ❌ Migration breaking en 1 étape (toujours 2 phases)
- ❌ Index sur colonne high-cardinality + low-selectivity (waste)
- ❌ DR drill sur prod (jamais)
- ❌ Restore sans validation post-restore (silent corruption)
- ❌ Subprocessor non listé dans GDPR docs
- ❌ Secrets rotation manuelle sans procédure documentée

## 5. Cible

> 0 query > 100 ms p95. Indexes coverage ≥ 95 % queries top 20. Migration runbook testé staging. RTO < 1h restore drill trimestriel. DR scenarios A-J documentés. Subprocessor list à jour + CI check. RPO < 24h. 0 backup corrompu sur drill.

## 6. Livrables

```
audit-28-data-resilience-SYNTHESE.md
audit-28-data-resilience-DIAGNOSTIC.md
audit-28-data-resilience-INDEXES-PLAN.md
audit-28-data-resilience-DR-SCENARIOS.md
audit-28-data-resilience-RUNBOOKS.md
audit-28-data-resilience-PLAN.md
```

---

**FIN DU PROMPT 28.**
