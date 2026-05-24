# 🗄️ PROMPT AUDIT A7 — Migration data V1 → V2 backwards-compat

> Audit dédié : vérifier que les migrations V2 préservent les données V1
> prod existantes (compatibilité 100 %, zéro perte).
>
> Mode AUDIT-ONLY strict. Production : 1 rapport `.md` unique.

---

```
Skill : axionia-content-generator (mode 🔒 AUDIT A7 — Migration data V1→V2)

Tu es l'auditeur compatibilité migrations. V1 (Sprints 1-6) + V2
(Sprints 7-12) livrés. V1 a déjà inséré data prod (campagnes, jobs,
review queue, articles publiés, etc.). V2 ajoute schema + workers
nouveaux.

Ton job : vérifier que les migrations V2 sont 100 % backwards-compatible
avec data V1 existante (zéro perte, zéro corruption, downgrade safe).

⛔ MODE AUDIT-ONLY STRICT :
- Aucune édition, aucun migrate, aucun commit
- Tu LIS : prisma/schema.prisma + prisma/migrations/* + git diff
- Tu LANCES : `prisma migrate diff` (read-only) + `pg_dump --schema-only`
  si DB locale dispo (sinon comparaison fichiers seulement)
- Si bug détecté → noter, NE PAS fix
- Seul livrable : `_AUDIT/CONTENT-GEN-AUDIT-A7-MIGRATION-2026-XX-XX.md`

╔═══════════════════════════════════════════════════════════════════════╗
║                  LECTURE OBLIGATOIRE                                  ║
╚═══════════════════════════════════════════════════════════════════════╝

1. axionia/prisma/schema.prisma (HEAD V2)
2. axionia/prisma/migrations/* (tous les fichiers)
3. _AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md § 5 modèle Prisma +
   § 5.1bis inventaire tables/enums + § 5.2 migrations + § 5.3 seeds
4. Master prompt § 3.2 V2 scope (nouvelles tables attendues :
   KeywordTracking, ContentEmbedding ?)
5. docs/adr/0021 et tous ADR Prisma-related (0006-0008 si présents)
6. axionia/_AUDIT/CONTENT-GEN-V1-AUTOPILOT-LOG.md (sprints + migrations
   appliquées en order)

╔═══════════════════════════════════════════════════════════════════════╗
║                  PHASE 0 — Setup                                      ║
╚═══════════════════════════════════════════════════════════════════════╝

```bash
git status
git log --oneline -10
git tag -l "v*-content-gen" | sort -V
ls axionia/prisma/migrations/ | sort

# Lister toutes les migrations V1 (avant tag v1.0.1) vs V2 (après)
git ls-tree -r v1.0.1-content-gen --name-only \
  | grep "prisma/migrations/" | sort > /tmp/migrations-v1.txt
ls axionia/prisma/migrations/ | sort > /tmp/migrations-current.txt
diff /tmp/migrations-v1.txt /tmp/migrations-current.txt
```

Identifier :
- Total migrations V1 baseline
- Migrations V2 ajoutées
- Nom + timestamp de chaque migration V2

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 1 — Analyse statique migrations V2                        ║
╚═══════════════════════════════════════════════════════════════════════╝

Pour CHAQUE migration V2 (fichier `prisma/migrations/<timestamp>_xxx/migration.sql`) :

```bash
cd axionia/
for m in prisma/migrations/*content_gen_v2* prisma/migrations/*v2*; do
  echo "=== $m ==="
  cat "$m/migration.sql" 2>/dev/null | head -100
done
```

Cataloguer chaque DDL statement :

### ✅ Statements SAFE (backwards-compat)
- `CREATE TABLE` (nouvelles tables V2)
- `CREATE INDEX` (perf seulement)
- `ALTER TABLE ... ADD COLUMN ... DEFAULT xxx` (default sain)
- `ALTER TABLE ... ADD COLUMN ... NULLABLE` (nullable safe)
- `CREATE TYPE` (nouveaux enums)
- `ALTER TYPE ... ADD VALUE` (nouvelles valeurs enum — Postgres safe)
- `CREATE EXTENSION` (pgvector si ajout V2)

### ⚠️ Statements RISKY (potentiellement breaking)
- `ALTER TABLE ... ADD COLUMN ... NOT NULL` SANS DEFAULT
- `ALTER COLUMN ... TYPE` (cast incompatible)
- `ALTER TYPE ... RENAME VALUE` (breaking enum)
- `CREATE UNIQUE INDEX` sur colonne avec doublons existants
- Ajout `@@unique` sur combinaison qui existe en duplicate
- `CREATE INDEX CONCURRENTLY` requis mais utilisé sans → lock long

### ❌ Statements BREAKING (CASSE V1)
- `DROP TABLE` (perte data)
- `DROP COLUMN` (perte data champ)
- `ALTER TABLE ... RENAME COLUMN` (callers cassent)
- `ALTER TABLE ... RENAME TO` (callers cassent)
- `DROP TYPE` (cascade catastrophique)
- `DROP CONSTRAINT` sur FK utilisée
- `ALTER COLUMN ... SET NOT NULL` sur colonne contenant NULLs

→ SORTIE : tableau migration × statement × catégorie × risque.

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 2 — Cross-check schema final cohérence                    ║
╚═══════════════════════════════════════════════════════════════════════╝

```bash
cd axionia/
# Diff schema V1 baseline vs HEAD V2
git diff v1.0.1-content-gen..HEAD prisma/schema.prisma > /tmp/schema-diff.txt
wc -l /tmp/schema-diff.txt
```

Analyser le diff :

- [ ] Models V1 (16+) tous TOUJOURS présents ?
  • ContentGenJob, ContentGenConfig, ContentTemplate, AuthorProfile,
    BannedPhrase, CoverageDistributionProfile, AudienceMixProfile,
    CoverageCampaign, ProviderConfig, GenerationLog, ReviewQueue,
    WebVitalSample, CostLedger, ContentMetric, ExternalReference,
    ContentCitation
- [ ] Tous les champs V1 toujours présents (pas de suppression) ?
- [ ] Tous les enum V1 toujours présents ?
- [ ] Toutes les valeurs enum V1 toujours présentes (pas de removal) ?
- [ ] FK V1 toujours présentes (Article ↔ ContentGenJob ↔ FAQ ↔
      KnowledgeEntry) ?
- [ ] Indexes V1 toujours présents (perf préservée) ?
- [ ] @@map snake_case préservés ?

Nouvelles tables V2 attendues (master § 3.2) :
- [ ] `KeywordTracking` (KeywordTracker Sprint 12)
- [ ] `ContentEmbedding` ou champ embedding ajouté à Article/Translation
      (Sprint 11 dedup cosine pgvector)
- [ ] Tables RSS dédiées (`RssSource`, `RssItem`) si migration V1
      ContentGenConfig JSON → tables Sprint 7/8
- [ ] Table `SimilarityPair` dédiée (Sprint 11)
- [ ] Table `ContentGenBatch` (suivi batch dédié Sprint 7)

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 3 — Backfill data (transition V1 storage → V2 tables)     ║
╚═══════════════════════════════════════════════════════════════════════╝

Si V1 stockait dans `ContentGenConfig.value` JSON puis V2 ajoute table
dédiée → vérifier qu'une migration data transfert les rows.

Exemples spécifiques :
- `ContentGenConfig.key="rss_sources"` (JSON array) → table `RssSource`
- `ContentGenConfig.key="rss_items_seen"` (JSON array hashes) → table
  `RssItem`
- `ContentGenConfig.key="similarity_pairs"` (JSON top-100) → table
  `SimilarityPair`

Pour chaque transition :
- [ ] Migration data script présent (SQL `INSERT INTO ... SELECT ...
      FROM ContentGenConfig WHERE key=...`) ?
- [ ] OU runtime backfill au démarrage worker (one-shot script) ?
- [ ] Vérification post-migration : ContentGenConfig.key supprimé ou
      gardé pour audit ?
- [ ] Idempotent (re-run safe) ?

Si V1 a des Articles déjà publiés en FS (`src/content/blog/posts/`)
et V2 Sprint 8 migre vers table Prisma `Article` :
- [ ] Script migration FS → DB présent ?
- [ ] Tous les `<slug>.ts` lus + insérés Article + ArticleTranslation ?
- [ ] FK author = Manon AuthorProfile préservée ?
- [ ] indexationTier correctement assigné selon politique V1 ?
- [ ] Idempotent (re-run = pas de doublons via @@unique slug) ?
- [ ] Fallback FS preservé pendant transition (gradual rollout) ?

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 4 — Rollback procedure (down migrations)                  ║
╚═══════════════════════════════════════════════════════════════════════╝

Prisma ne génère PAS automatiquement les down migrations. Vérifier :

- [ ] Documentation rollback présente pour chaque migration V2 ?
  • Soit dans `prisma/migrations/<X>/README.md`
  • Soit dans `docs/runbooks/migration-rollback.md`
- [ ] Pour chaque migration V2, le SQL `DOWN` est explicitement
      documenté (DROP TABLE, DROP COLUMN, etc.) ?
- [ ] Risque de rollback documenté (perte données nouvelles tables) ?
- [ ] Procédure backup AVANT migration documentée ?

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 5 — Tests integration migrations                          ║
╚═══════════════════════════════════════════════════════════════════════╝

Vérifier :
- [ ] Test integration `prisma migrate deploy` sur DB vide passe ?
- [ ] Test integration `prisma migrate deploy` sur DB V1 dump passe ?
  (si dump V1 disponible — sinon noter limitation)
- [ ] Tests Vitest qui touchent les nouvelles tables V2 présents ?
- [ ] CI workflow `.github/workflows/*.yml` inclut step migration ?

```bash
# Lister tests qui mentionnent nouvelles tables V2
grep -r "keywordTracking\|KeywordTracking" src/ tests/ --include="*.ts" \
  --include="*.tsx" | head -10
grep -r "contentEmbedding\|ContentEmbedding" src/ tests/ | head -10
grep -r "rssSource\|RssSource\|rssItem\|RssItem" src/ tests/ | head -10
```

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 6 — pgvector + extensions Postgres                        ║
╚═══════════════════════════════════════════════════════════════════════╝

Sprint 11 V2 ajoute embeddings dedup cosine < 0.85 via pgvector.

Vérifier :
- [ ] `CREATE EXTENSION IF NOT EXISTS vector;` dans migration V2 ?
- [ ] Type `vector(1024)` (Voyage embeddings dim) utilisé sur quel table/champ ?
- [ ] Index HNSW ou IVFFlat créé pour perf cosine ?
  ```sql
  CREATE INDEX content_embeddings_hnsw ON content_embeddings
    USING hnsw (embedding vector_cosine_ops);
  ```
- [ ] Type Prisma `Unsupported("vector(1024)")` documenté avec
      requêtes raw SQL via `$queryRaw` ?
- [ ] Worker `embeddings-dedup` (ou helper quality V2) génère embedding
      via Voyage + insert dans pgvector ?

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 7 — Synthèse + verdict                                    ║
╚═══════════════════════════════════════════════════════════════════════╝

Rapport `_AUDIT/CONTENT-GEN-AUDIT-A7-MIGRATION-2026-XX-XX.md` :

```markdown
# Audit A7 — Migration data V1 → V2 backwards-compat (YYYY-MM-DD)

## 1. Contexte
- V1 baseline : tag v1.0.1-content-gen
- V2 HEAD : commit `xxx`
- Migrations V1 : Y total
- Migrations V2 ajoutées : Z
- Tables V1 : 16+ / Tables V2 ajoutées : N

## 2. Catalogue statements DDL V2

### SAFE (X statements)
[liste CREATE TABLE / ADD COLUMN nullable / etc.]

### RISKY (Y statements)
[liste ADD COLUMN NOT NULL / ALTER TYPE / etc.]

### BREAKING (Z statements)
[liste DROP / RENAME / etc.] ❌ chaque ligne = P0

## 3. Schema diff V1 → V2
- Models V1 préservés : XX/16 (manquants : ...)
- Champs V1 préservés : XX/Y total
- Enums V1 préservés : XX/16
- Valeurs enum V1 préservées : XX/Y
- Nouvelles tables V2 : `KeywordTracking`, ...
- Nouveaux champs V2 (en majorité nullable) : Y

## 4. Backfill data
| Transition | Migration data ? | Idempotent ? | Tests ? |
|-----------|-------------------|--------------|---------|
| ContentGenConfig.rss_sources → RssSource table | ✅/❌ | | |
| ContentGenConfig.similarity_pairs → SimilarityPair table | | | |
| FS posts/*.ts → Article table | | | |

## 5. Rollback procedure
- Documentation présente : ✅/❌
- DOWN SQL pour chaque migration V2 : X/Y migrations
- Backup pré-migration documenté : ✅/❌

## 6. Tests integration
- `prisma migrate deploy` test : ✅/❌
- Tests nouvelles tables V2 : X tests présents
- CI workflow migration step : ✅/❌

## 7. pgvector + extensions
- `vector` extension installée : ✅/❌
- Index HNSW/IVFFlat créé : ✅/❌
- Type Unsupported documenté : ✅/❌
- Worker dedup embeddings wired : ✅/❌

## 8. Verdict /60

Pondération :
- Aucun statement BREAKING : 20 pt
- Schema V1 préservé 100 % : 15 pt
- Backfill data transitions OK : 10 pt
- Rollback documenté : 5 pt
- pgvector setup OK : 5 pt
- Tests migration : 5 pt

🟢 MIGRATION SAFE : ≥ 55/60
🟡 ATTENTION RISKY : 40-54/60
❌ MIGRATION BROKEN : < 40/60 OR ≥ 1 BREAKING statement

## 9. Top risques priorisés
- P0 (BREAKING) : statements DROP/RENAME à fix AVANT migrate prod
- P1 : backfill data manquant
- P2 : rollback procedure à compléter

## 10. Recommandations pré-deploy prod V2
- [ ] `pg_dump` complet AVANT `prisma migrate deploy`
- [ ] Test migration sur DB staging (clone prod) AVANT prod
- [ ] Plan rollback pré-validé
- [ ] Window de maintenance annoncée si downtime > 1 min

## 11. Métadonnées
- Durée : X h
- Migrations parcourues : Y
```

╔═══════════════════════════════════════════════════════════════════════╗
║                          DÉMARRER                                     ║
╚═══════════════════════════════════════════════════════════════════════╝

Mode : 🔒 AUDIT-ONLY STRICT. Production rapport unique. Aucun fix.
```
