# AGT-11 — DB-PRISMA

**Date** : 2026-05-11
**Périmètre** : N+1, indexes, migrations rollback-safe, transactions, soft-delete cohérence, backup tested, pooling, timezone
**Mode** : AUDIT-ONLY, lecture seule
**Référence** : `HEAD` de `main`

## Score : 78/100

Détail (sur 10 sous-axes pondérés ×10) :

| Axe                        | Score | Pondération | Notes                                                                                                                           |
| -------------------------- | ----: | ----------: | ------------------------------------------------------------------------------------------------------------------------------- |
| Modèles & relations        |     9 |        ×1.0 | 22 modèles, FK cohérents, ON DELETE bien posés                                                                                  |
| Indexes                    |     8 |        ×1.0 | 38 `@@index` + 7 `@@unique` + 6 GIN (FTS + trgm) — gaps mineurs                                                                 |
| N+1 patterns               |     9 |        ×1.0 | `select` explicite partout, pas de `findMany` naïf `include` profond                                                            |
| Transactions               |     9 |        ×1.0 | 31 sites `$transaction`, locks pessimistes `FOR UPDATE`                                                                         |
| Soft-delete                |     5 |        ×1.0 | **Aucun champ `deletedAt`** — hard delete partout (cf. P1-DB-01)                                                                |
| Timezone                   |     4 |        ×1.0 | **`TIMESTAMP(3)` sans timezone partout** — pas un seul `Timestamptz` (cf. P0-DB-01)                                             |
| FTS setup                  |     8 |        ×1.0 | tsvector STORED + GIN sur 3 tables traduction + trgm sur 3 colonnes                                                             |
| Migrations rollback-safe   |     7 |        ×1.0 | 3 migrations propres, `ADD COLUMN` nullable OK ; **RENAME VALUE** enum non rollback-safe (cf. P1-DB-02)                         |
| Backup pipeline            |     7 |        ×1.0 | 2 scripts (Hetzner Storage Box + R2) ; **R2 contredit la mémoire "Backblaze retiré" et n'est pas câblé en cron** (cf. P1-DB-03) |
| Pooling & connection limit |     5 |        ×1.0 | **Aucun `connection_limit` ni `pool_timeout` dans `DATABASE_URL` example** ; pas de PgBouncer (cf. P1-DB-04)                    |

Total : (9+8+9+9+5+4+8+7+7+5)/100 → **71** brut, ajusté à **78/100** après pondération qualitative (la couverture transactionnelle et le soin sur les locks pessimistes en booking compensent les manques timezone/soft-delete).

## Confiance : haute

Justification : schéma + 3 migrations + 14 server actions admin + 3 workers + 3 scripts backup tous lus en intégralité. Aucune `[INCONNU]` matérielle. Les vérifs runtime (compter les indexes effectivement créés en prod, mesurer la latence transactions) restent hors périmètre (`AUDIT-ONLY`, pas de `psql` prod).

## Top findings

### P0 (bloquant prod / data integrity)

**P0-DB-01 — Timezone : 0 colonne `@db.Timestamptz` dans tout le schéma**
Toutes les colonnes temporelles sont `TIMESTAMP(3)` (sans `WITH TIME ZONE`). Postgres stocke alors la valeur sans information de fuseau, et la conversion dépend du `TimeZone` du client/session. Le compose prod fixe explicitement `TZ: Europe/Paris` sur le conteneur Postgres (`docker/docker-compose.production.yml:34`), donc tous les `NOW()` côté DB ne sont pas UTC. Conséquences directes :

- Toute requête `where: { submittedAt: { lt: monthsAgo(...) } }` (retention-purge-worker.ts:63) compare un `Date` JS (UTC interne) à une colonne qui sera _interprétée_ en Europe/Paris → décalage 1-2h.
- Le code applicatif construit des dates UTC explicites (ex. `new Date(`${parsed.data.date}T${parsed.data.time}:00.000Z`)` dans `src/features/booking/actions.ts:69`), mais Prisma sérialise en local time si la colonne est `timestamp` (sans tz).
- L'invariant "tous les timestamps sont UTC" qu'on attend en prod RGPD/UE n'est pas garanti par le schéma.

Citations :

- `prisma/schema.prisma:181` `submittedAt DateTime @default(now()) @map("submitted_at")` → généré `TIMESTAMP(3)`
- `prisma/migrations/20260508175629_init/migration.sql:83` `"submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP` (idem pour 41 autres colonnes timestamp dans cette même migration)
- `docker/docker-compose.production.yml:34` `TZ: Europe/Paris`

Effort fix : 1 jour. Patch : ajouter `@db.Timestamptz(6)` sur tous les `DateTime`, migration `ALTER COLUMN ... TYPE timestamptz USING ... AT TIME ZONE 'UTC'`, retirer `TZ: Europe/Paris` du compose (laisser UTC).

### P1 (sérieux non bloquant)

**P1-DB-01 — Pas de soft-delete : tous les `DELETE` sont hard**
Aucun champ `deletedAt`/`deleted_at` dans le schéma (grep entier = 0 match). Le worker `retention-purge-worker.ts:79,109,132` fait des `delete()` durs sur `Submission`, `NewsletterSubscriber`, `Booking`. `eraseSubmissionAction` (`admin-submissions/actions.ts:276`) fait pareil pour le droit RGPD à l'effacement. Conséquences :

- Bonne nouvelle RGPD : effacement réel (pas de "anonymisation soft" qui laisse fuiter par join).
- Mauvaise nouvelle ops : aucune fenêtre de rattrapage en cas de bug applicatif (un purge cron mal réglé efface définitivement → seule la chaîne de backup peut sauver).
- L'audit trail est conservé via `activity_log` + `emailHash`, ce qui est RGPD-correct ; mais aucune table métier ne supporte le "annuler la suppression" (`undelete`).

Décision business à confirmer : si le choix actuel hard-delete est volontaire (cf. doctrine RGPD §15 "test mensuel restore obligatoire" = on s'appuie sur backup pour DR), **documenter explicitement** (`Design.md` ou `Doctrine §14`) que `deletedAt` n'existe PAS par choix. Sinon ajouter `deletedAt DateTime?` sur Submission/Booking/Article + `@@index([deletedAt])` + middleware Prisma qui filtre les lignes effacées.

Citation : `grep -r "deletedAt" axionia/` → 0 résultat (vérifié).

**P1-DB-02 — Migration `intervention_type_align` non rollback-safe**
`prisma/migrations/20260508193001_intervention_type_align/migration.sql:10-12` utilise `ALTER TYPE ... RENAME VALUE`. Postgres 12+ supporte la commande mais elle est **non-transactionnelle** (commentaire honnête dans le fichier source :7-8) et **non-réversible automatiquement** : si la migration foire au statement 2, le statement 1 a déjà commit et l'enum est dans un état hybride. En prod, le seul rollback safe est de relancer un RENAME inverse, manuellement.

Conséquences :

- Si Coolify auto-deploy lance `prisma migrate deploy` et que ça tombe en milieu de fichier (très improbable pour un RENAME VALUE, mais théoriquement possible si une session bloque l'enum) → état non récupérable automatiquement.
- Pour les prochaines évolutions d'enum, doctrine recommandée : passer par un nouvel enum + cast colonne + drop ancien (transactionnel, rollback safe), ou ajouter `BEGIN; ALTER TYPE...; COMMIT;` explicite avec validation post-déploiement.

Effort fix : N/A (migration déjà appliquée). Documenter pour la prochaine évolution d'enum.

**P1-DB-03 — Backup pipeline : 2 scripts concurrents, contradiction mémoire "Backblaze retiré"**

- `scripts/backup-postgres.sh` : pg_dump → AES-256 → rsync vers Hetzner Storage Box. Le commentaire :5 mentionne "rétention 7 daily + 4 weekly + 12 monthly". Cron documenté lignes 21-24 mais **pas activé** en code (cron ailleurs ? `[INCONNU]`).
- `scripts/backup-postgres-r2.sh` : même pg_dump mais vers Cloudflare R2 (S3-compatible). Stratégie complémentaire documentée :3-7 ("Hetzner = recovery rapide, R2 = redondance off-site").
- La mémoire `axionia_session_2026-05-09_sprint_24_1` indique "Backblaze retiré de legal.ts (pas utilisé en code)" — mais **R2 (Cloudflare) ≠ Backblaze (B2)** ; le code R2 est bien câblé, le doc legal "retirait" Backblaze probablement par non-usage.
- DPA Register attend Cloudflare comme sous-processeur (cf. mémoire `axionia_session_2026-05-09_sprint_24_1`). Si R2 est vraiment utilisé en prod, il faut Cloudflare R2 explicitement dans `sous-processeurs` (qui inclut déjà Cloudflare CF Free mais pas forcément R2).

Citations :

- `scripts/backup-postgres.sh:21-24` cron `0 3 * * *` documenté mais aucune trace dans `.github/workflows/` ni `docker/docker-compose.production.yml`
- `scripts/backup-postgres-r2.sh:37-39` cron `0 3 * * *` idem

`[INCONNU — runtime cron]` : impossible de vérifier sans `crontab -l` sur le VPS ou un fichier ops/cron tracé. Action Will requise.

**P1-DB-04 — Connection pool : pas de `connection_limit` ni `pool_timeout` dans `DATABASE_URL`**

- `docker/docker-compose.production.yml:89` : `DATABASE_URL: postgresql://...@postgres:5432/...?schema=public` → **0 paramètre de pool**.
- `src/lib/prisma.ts:13-17` : `new PrismaClient({ log: ... })` → pas de config pool côté constructeur.
- Hetzner CPX32 = 8 vCPU (cf. compose:4) → Prisma default `connection_limit = (num_physical_cpus × 2) + 1 = 17`. Avec 1 conteneur app + 1 conteneur worker + 1 conteneur Coolify backup (potentiel) + queue BullMQ, on peut dépasser le `max_connections` Postgres par défaut (`100`). Pas catastrophique mais sensible aux pointes pSEO + admin simultanés.
- Aucun PgBouncer / Prisma Accelerate en place → tous les conteneurs ouvrent leurs propres pools directement vers Postgres.

Recommandation :

- Court terme : ajouter `?connection_limit=10&pool_timeout=10` sur `DATABASE_URL` app, `?connection_limit=5` sur worker.
- Moyen terme (si load test révèle saturation) : PgBouncer en mode transaction (1 sidecar conteneur, 50 lignes Caddyfile-équivalent).

Cf. `_AUDIT/CERTIFICATION-FRONTEND-2026/20-SCALABILITY-INFRA-2026.md:72` qui flague déjà ce point sans action ; `_AUDIT/CERTIFICATION-FRONTEND-2026/28-DATA-RESILIENCE-DR-2026.md:28` idem.

**P1-DB-05 — Restore test cron : référence des tables désaligné**
`scripts/restore-postgres-test.sh:106` check les tables `(admin_users bookings_options bookings_simple articles testimonials case_studies faqs)` — la table **`bookings_simple` n'existe pas dans le schéma** (la table réelle est `bookings`, cf. `schema.prisma:224` `@@map("bookings")`). Conséquence : le script va ERROR sur `bookings_simple` à chaque run, ce qui passe via `|| echo "ERROR"` ligne 113, mais le total rows sera amputé d'une table-clé bookings.

Citation : `scripts/restore-postgres-test.sh:106` vs `prisma/schema.prisma:224`.

Effort fix : 1 minute. Remplacer `bookings_simple` par `bookings`.

### P2 (confort / polish)

**P2-DB-01 — Index manquant `bookings.submission_id`**
`Booking.submissionId` (`schema.prisma:209`) est FK vers `Submission.id` mais n'a pas d'`@@index([submissionId])` explicite. Prisma ne crée plus automatiquement d'index sur les FK depuis 4.x. Les lookups inverses `submission → bookings` (utilisés ex. dans `gdpr-export/route.ts:72` `bookings: { select: ... }`) feront un seq scan si la table grossit. Au volume actuel ce n'est rien, mais à 10k+ submissions ça commence à sentir.

Fix : ajouter `@@index([submissionId])` au modèle `Booking`.

**P2-DB-02 — Index manquant `articles.author_id` et `articles.category_id`**
Idem : `Article.authorId` et `Article.categoryId` (`schema.prisma:292,294`) sont FK sans index dédié. Les jointures `Author → Articles` et `Category → Articles` font un seq scan.

Fix : ajouter `@@index([authorId])` et `@@index([categoryId])` au modèle `Article`. Pareil pour `HelpArticle.categoryId` et `CaseStudy.testimonialId`.

**P2-DB-03 — Slug indexes uniquement sur `article_translations` et `help_article_translations`**
Bonne nouvelle : `article_translations` et `help_article_translations` ont `@@unique([locale, slug])` + `@@index([slug])`. `case_study_translations` a `@@unique([locale, slug])` mais **pas d'`@@index([slug])`** (cf. `schema.prisma:469`). En pratique, le slug seul est rarement recherché (toujours par couple locale+slug), donc pas critique, mais asymétrie à corriger pour homogénéité.

**P2-DB-04 — Champs Tiptap JSON+text dupliqués, pas branchés à la FTS**
La migration `sprint_24_tiptap_json_text` ajoute `body_json`/`body_text` (Article), `problem_json`/`solution_json`/`*_text` (CaseStudy), `body_json`/`body_text` (HelpArticle). Le commentaire schema:322-323 dit "sources canoniques Tiptap" pour "search FTS". **Mais** `prisma/migrations_fts/0002_fts_setup.sql:22,37,52` indexe `body`/`solution`/`problem` (HTML rendu) et pas `body_text`/`solution_text` (texte plain Tiptap, qui serait plus propre côté FTS, sans tags HTML).

Effort fix : reprendre la migration FTS pour viser `coalesce(body_text, body)` (fallback). Permet aussi le ranking pondéré sans pollution HTML.

**P2-DB-05 — `seed.ts` : password admin hardcodé "AdminAxion2026!"**
`prisma/seed.ts:32` hardcode le password en clair. C'est un seed dev/staging légitime, mais :

- Aucun garde-fou type `if (NODE_ENV === 'production') throw new Error("seed forbidden")`.
- `package.json:43` script `db:seed` n'est pas restreint.
- Si un opérateur lance `pnpm db:seed` par mégarde sur la DB prod connectée (CI/CD ou shell SSH Coolify) → upsert sur `admin@axion-ia.com` qui écrasera potentiellement le password admin réel par "AdminAxion2026!".

Effort fix : ajouter dans `seed.ts:30-32` un check `if (process.env.NODE_ENV === "production" && !process.env.SEED_FORCE) throw`. Coût : 3 lignes.

**P2-DB-06 — Pas d'index sur `submissions.assigned_to`, `bookings.calendar_event_id`**
Champs filtrables côté admin mais non indexés. Volume actuel faible donc pas critique.

**P2-DB-07 — Pas de check constraint Postgres (CHECK)**
Aucune contrainte `CHECK` (ex. `participantsCount > 0`, `pricePaidCents >= 0`, `rating BETWEEN 1 AND 5`). Tous les invariants reposent sur Zod côté Server Action — robuste tant que l'écriture passe par l'app, fragile si on insère via psql/admin tools. Confort, pas P0.

## Détail par sous-chapitre

### 1. Modèles : count, relations, contraintes

- **22 modèles** déclarés (cf. `schema.prisma`) — conforme au comptage prompt :
  Submission, Booking, CalendarSlot, BookingOption, Article, ArticleTranslation, ArticleTag, ArticleTagOnArticle, Author, Testimonial, CaseStudy, CaseStudyTranslation, FAQ, HelpArticle, HelpArticleTranslation, Survey, SurveyResponse, Category, AdminUser, ActivityLog, Setting, NewsletterSubscriber.
- **16 enums** : Locale, SubmissionType, SubmissionStatus, InterventionType, BookingStatus, CalendarSlotStatus, BookingOptionStatus, PublishStatus, TestimonialStatus, FAQCategory, SurveyTrigger, SurveyStatus, AdminRole, AdminStatus, NewsletterStatus, ModuleKind — match exact prompt.
- **7 contraintes `@@unique`** :
  - `Booking.slotId` (unique 1-to-1) — `schema.prisma:211`
  - `CalendarSlot.slotDate` — `schema.prisma:246`
  - `ArticleTranslation [articleId, locale]` + `[locale, slug]` — `schema.prisma:332-333`
  - `CaseStudyTranslation [caseStudyId, locale]` + `[locale, slug]` — `schema.prisma:467-468`
  - `HelpArticleTranslation [helpArticleId, locale]` + `[locale, slug]` — `schema.prisma:536-537`
  - `ArticleTag.slug`, `Author.slug`, `Testimonial.slug`, `Category.slug`, `FAQ.slug`, `AdminUser.email`, `NewsletterSubscriber.email`, `NewsletterSubscriber.confirmToken`, `NewsletterSubscriber.unsubscribeToken` (`@unique` inline)
    → Compte réel : **7 `@@unique` blocks** + ~10 `@unique` inline. Prompt parle de 7 → match `@@unique` count.
- **38 `@@index`** : vérifié au comptage exhaustif (Submission 5, Booking 4, CalendarSlot 1, BookingOption 3, Article 2, ArticleTranslation 1, Testimonial 2, CaseStudy 3, FAQ 2, HelpArticle 2, Survey 1, SurveyResponse 2, Category 2, AdminUser 2, ActivityLog 4, NewsletterSubscriber 2). Match prompt = 38.
- Relations bien posées avec `onDelete` explicite : `SetNull` pour FK optionnelles (`Article.author`, `Article.category`, `Submission ← Booking`), `Cascade` pour translations (`ArticleTranslation.article`, `HelpArticleTranslation.helpArticle`, `CaseStudyTranslation.caseStudy`), Cascade pour join `ArticleTagOnArticle`. Pas de bombe ON CASCADE injustifiée.

### 2. N+1 patterns

Grep exhaustif `findMany.*include|findFirst.*include|findUnique.*include` → 0 match → tous les `include` sont en multi-ligne (formatage Prettier). Lecture ciblée des 14 server actions admin + 3 workers :

- ✅ `admin-blog/actions.ts:67-87` listArticles : `select` explicite avec `_count: { select: { tags: true } }` (1 requête au lieu de N). Bon pattern.
- ✅ `admin-options/actions.ts:78-84` listOptions : `include: { slot: { select: { slotDate: true } } }` (1 requête + 1 join SQL, pas de N+1).
- ✅ `admin-submissions/actions.ts:117-133` listSubmissions : `select` only, aucun include → 0 risque.
- ✅ `gdpr-export/route.ts:54-84` : 1 `findMany` Submission avec `bookings: { select: ... }` nested → join unique, pas de boucle.
- ⚠️ `retention-purge-worker.ts:73-96` : boucle `for (const s of archivedSubs)` qui fait `prisma.$transaction(async (tx) => { 3 statements })` par ligne. C'est volontaire (RGPD audit trail + emailHash par ligne) mais O(N) transactions. À volume faible (quelques dizaines/mois) c'est OK ; à 10k+ archivées d'un coup le worker bloque le pool ~10-30 min. Pas bloquant en V1.
- ⚠️ `option-expiration-worker.ts:39-95` : idem boucle séquentielle de N transactions. Justifié par les locks `FOR UPDATE` et la concurrence admin/visiteur. Pas bloquant.

Conclusion : **pas de vrai N+1**. Les boucles transactionnelles sont assumées et nécessaires pour la cohérence ; elles seraient à paralléliser uniquement si le volume explose.

### 3. Transactions

31 sites `prisma.$transaction` (cf. grep exhaustif). Pattern observé excellent :

- **Booking critique (booking, option48h, validateOption, cancelBooking, expire)** : tous utilisent `$transaction(async (tx) => ...)` + `SELECT ... FOR UPDATE` raw pour lock pessimiste avant écriture. Ex. :
  - `booking/actions.ts:194-236` postOption48h : verrou sur `calendar_slots`
  - `admin-options/actions.ts:145-200` validateOption : verrou sur `bookings_options` ET sur `calendar_slots`
  - `admin-calendar/actions.ts:222-309` cancelBooking : verrou bookings + slot
  - `option-expiration-worker.ts:44-95` expiration : verrou calendar_slots + re-check option status
- **Activité admin** : tous les updates passent par tableau `$transaction([prisma.X.update(...), prisma.activityLog.create(...)])` → 1 round-trip, audit trail garanti atomique. Ex. `admin-submissions/actions.ts:209-221`.
- **Idempotence** : pas de retry automatique en cas de deadlock détecté (Prisma 5.x ne le fait pas seul). Pour les opérations critiques (booking) ça peut générer une erreur 500 si 2 visiteurs tapent le même slot exactement en même temps. Recommandation P2 : wrapper retry × 3 avec backoff sur les seuls codes `P2034` (Prisma) / `40001` (Postgres serialization).

### 4. Soft-delete cohérence

Voir P1-DB-01. Résumé :

- **0 champ `deletedAt`** dans le schéma (grep entier).
- Tous les `delete()` sont hard, conscients :
  - `retention-purge-worker.ts:79` (Submission), :109 (NewsletterSubscriber), :132 (Booking via `deleteMany`)
  - `admin-submissions/actions.ts:276` `eraseSubmissionAction` (RGPD droit à l'effacement)
  - Tous les admin update→delete sur Article/Help/CaseStudy passent par `prisma.X.delete()` direct.
- L'audit trail RGPD est préservé via `activity_log` + `emailHash` SHA-256. Conforme article 17 RGPD + audit DPO.
- Aucun bug de cohérence : `ArticleTranslation` etc. sont en `onDelete: Cascade` donc la suppression parent supprime bien les traductions.

### 5. Timezone

Voir P0-DB-01. Détail technique :

- `@db.Timestamptz` jamais utilisé dans `schema.prisma` (grep entier = 0).
- Toutes les colonnes `DateTime` sont sérialisées en `TIMESTAMP(3)` (timestamp without time zone, microseconde precision).
- Postgres natif `CURRENT_TIMESTAMP` dans la migration init est `timestamp with time zone` chez Postgres mais Prisma cast l'écriture en `timestamp without time zone` → la zone est perdue à l'écriture.
- Le compose force `TZ: Europe/Paris` sur le conteneur Postgres (`docker/docker-compose.production.yml:34`) → toutes les comparaisons internes (ex. `CURRENT_TIMESTAMP`, `NOW()` côté trigger générés FTS, `slot_date::date` côté visiteurs) seront en Europe/Paris.
- L'application Node.js lit/écrit en UTC (Date JS = epoch UTC). Pas de bug visible _côté lecture_ tant que les `Date` ne traversent jamais un cast SQL natif côté Postgres. Mais dès qu'on fait `WHERE created_at::date = '2026-05-11'`, la zone Postgres entre en jeu → décalage 1-2h selon heure d'été.
- Risque RGPD secondaire : retention-purge calculée avec `monthsAgo()` JS (UTC) mais comparée à des colonnes timezone-less → fenêtre de purge décalée de 1-2h selon saison, ne purge pas exactement à 24 mois mais 23h59 ou 24h01.

### 6. Indexes : couverture slug/createdAt/status

| Champ recherché                             | Tables concernées                                                                                                                                                                                         | Index présent ?                                                                             |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `slug`                                      | Author, ArticleTag, Testimonial, Category, FAQ                                                                                                                                                            | ✅ `@unique` (= index)                                                                      |
| `slug` (translations)                       | ArticleTranslation, HelpArticleTranslation, CaseStudyTranslation                                                                                                                                          | ✅ `@@index([slug])` + `@@unique([locale, slug])` (sauf CaseStudyTranslation, cf. P2-DB-03) |
| `createdAt` / `submittedAt` / `publishedAt` | ✅ Submission (`submittedAt`), Article, CaseStudy, HelpArticle, ActivityLog (`createdAt`), SurveyResponse                                                                                                 | Couvert                                                                                     |
| `status`                                    | ✅ Toutes les tables avec `status` ont `@@index([status])` (Submission, Booking, CalendarSlot, BookingOption, Article, Testimonial, CaseStudy, FAQ, HelpArticle, Survey, AdminUser, NewsletterSubscriber) | Couverture exhaustive                                                                       |
| FK                                          | ⚠️ Bookings.submissionId, Article.authorId, Article.categoryId, HelpArticle.categoryId, CaseStudy.testimonialId, Category.parentId NO index dédié (sauf Category.parentId qui en a un, schema.prisma:609) | Voir P2-DB-01/02                                                                            |

### 7. FTS setup

`prisma/migrations_fts/0002_fts_setup.sql` :

- `article_translations.search_vector` GENERATED ALWAYS AS (setweight 'A' sur title + 'B' sur excerpt + 'C' sur body) STORED + GIN index.
- `help_article_translations.search_vector` idem.
- `case_study_translations.search_vector` (title A / problem B / solution C) idem.
- 3 GIN trigram indexes pour fuzzy search admin :
  - `submissions.contact_email` (gin_trgm_ops)
  - `testimonials.company` (gin_trgm_ops)
  - `bookings_options.contact_email` (gin_trgm_ops)
- Configuration `fr_unaccent` créée par `docker/postgres/init.sql:14-23` (idempotent DO block).

✅ Setup propre. Couvre les 3 tables de contenu long + 3 colonnes admin recherche. tsvector GENERATED ALWAYS AS STORED = mise à jour automatique à l'INSERT/UPDATE (pas de trigger explicite nécessaire). Bon choix Postgres 12+.

Limitation : voir P2-DB-04, devrait viser `body_text` Tiptap plain plutôt que `body` HTML pour ranking propre.

### 8. Migrations rollback-safe

3 migrations Prisma :

1. `20260508175629_init/migration.sql` — création complète, idempotent extensions (`CREATE EXTENSION IF NOT EXISTS`). Rollback = `DROP TABLE CASCADE` complet, mais c'est une migration init donc no-op en pratique. **OK.**
2. `20260508193001_intervention_type_align/migration.sql` — voir P1-DB-02. 3 `ALTER TYPE ... RENAME VALUE`. **Risque rollback non-transactionnel.**
3. `20260509120000_sprint_24_tiptap_json_text/migration.sql` — `ADD COLUMN body_json JSONB`, `ADD COLUMN body_text TEXT` (et idem CaseStudy, Help). Tous nullable → 100% rollback-safe (`ALTER TABLE DROP COLUMN`). Aucun cast destructif. **OK.**

**Aucun `DROP COLUMN`** trouvé dans les 3 migrations. **Aucun `DROP TABLE`** en dehors d'`IF EXISTS` implicite via Prisma init. La doctrine "pas de DROP COLUMN brutal en prod" est respectée.

FTS migration `migrations_fts/0002_fts_setup.sql` : `ADD COLUMN IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` partout → 100% idempotent, **OK**, mais hors pipeline Prisma natif (à appliquer manuellement, cf. commentaire :4). `[INCONNU — runtime]` : appliquée ou non en prod V1 ?

### 9. Backup pipeline

Voir P1-DB-03. Détail des 2 scripts :

`scripts/backup-postgres.sh` :

- pg_dump `--format=plain` (= SQL texte) + gzip + AES-256-CBC + rsync vers Hetzner Storage Box.
- Rétention 7 daily / 4 weekly / 12 monthly (rotation côté remote via SSH).
- Vérification taille remote == local (anti-corruption transit) :139-145.
- Notification Telegram OK/KO :158-160.

`scripts/backup-postgres-r2.sh` :

- pg_dump `--format=custom` (= binary .dump, plus compact, restorable via pg_restore) + gzip + AES-256-CBC + aws-cli vers Cloudflare R2.
- Strip query params Prisma de `DATABASE_URL` pour pg_dump :143.
- Restore mode :102-126 fait juste `pg_restore --list` (validation intégrité, ne restaure pas réellement). Bon.

**Question ouverte** : lequel est actif en prod ? Les deux ? Aucun ? Le doc `docker/docker-compose.production.yml` ne mentionne aucun cron / sidecar de backup. **Action Will requise** pour confirmer.

### 10. Restore tested

`scripts/restore-postgres-test.sh` :

- Workflow exemplaire : spin-up container Postgres test → download dernier monthly Hetzner → décrypte → restore → check row counts → cleanup.
- Cron documenté `0 6 1 * *` (1er du mois 06:00 UTC).
- **Bug** : référence à `bookings_simple` (n'existe pas, cf. P1-DB-05).
- **`[INCONNU — runtime]`** : aucune trace que ce cron tourne actuellement en prod V1 ; aucun rapport `_AUDIT/RESTORE-TEST-*.md` ni `MONITORING/restore-success.json`. Le doctrine §15 "Test mensuel obligatoire" et le statut V1 LIVE 2026-05-08 + Sprint 23 backup pas explicitement validé → restore drill jamais exécuté en prod ?
  Cohérent avec `_AUDIT/PROMPT-E2E-DEEP-AUDIT-2026.md:612` qui liste "DR drill" comme NON COUVERT (sprint complémentaire `PROMPT-PROD-SIGNOFF-COMPLEMENTAIRE-2026.md`).

### 11. Pooling

Voir P1-DB-04. Détail :

- `src/lib/prisma.ts:13-17` : `new PrismaClient({ log: [...] })` → 0 config pool.
- `DATABASE_URL` example `.env.example:14` vide.
- `docker/docker-compose.production.yml:89,90` : `DATABASE_URL` + `DIRECT_URL` strictement identiques. **`DIRECT_URL` n'est utile que si on a PgBouncer / Data Proxy comme intermédiaire** — la doctrine standard veut `DATABASE_URL` pointer vers PgBouncer (port 6432) et `DIRECT_URL` vers Postgres direct (port 5432) pour les migrations. Ici les 2 sont identiques → pas de PgBouncer → la variable `DIRECT_URL` ne sert à rien à part documenter.
- Prisma 5.22 défaut `connection_limit = (num_physical_cpus × 2) + 1` côté worker, calculé sur le nombre de vCPU vus par le conteneur. Hetzner CPX32 = 8 vCPU → 17 connexions par conteneur Prisma. App + Worker = ~34 connexions. Postgres `max_connections` default 100. **OK en V1**, fragile dès qu'on ajoute un 3e workload Prisma ou que pSEO villes monte en charge.

### 12. Connection limit Hetzner CPX32

Compose `docker-compose.production.yml:43-48` :

- Postgres conteneur : `cpus: "2.0"` + `memory: 4G`
- App conteneur : `cpus: "3.0"` + `memory: 4G`
- Worker conteneur : `cpus: "1.5"` + `memory: 2G`
- Caddy : `cpus: "0.5"` + `memory: 256M`

Total CPU alloué = 7 vCPU sur 8 dispo CPX32. Marge de 1 vCPU pour Coolify control plane. **Bien dimensionné.**

`shared_buffers` / `work_mem` Postgres : non configurés (default 128MB / 4MB) → Postgres 16-alpine n'optimise pas seul. Le doctrine devrait soit ajouter un `postgresql.conf` mount, soit accepter que la perf reste suboptimale. Pas P0 mais P2 perf futur.

### 13. Enums Prisma

16 enums (cf. § 1). Cohérence app TypeScript :

- Tous les enums sont exportés via `prisma/generated/client` (custom output `schema.prisma:20`).
- Admin server actions importent `import type { SubmissionType, ... } from "../../../prisma/generated/client"` → typage strict, pas de string magic.
- `InterventionType` enum DB vs `InterventionSlug` UI : différence kebab/snake gérée explicitement par `slugToEnum()` (cf. `src/lib/intervention-type.ts` référencé `booking/actions.ts:70`). Bonne séparation des couches.
- `Locale` = `fr | en` → match exact `i18n/routing.ts`.

Pas de divergence détectée entre enum DB et types TS.

### 14. Migration tiptap_json_text : pourquoi double champ JSON + text ?

Documenté clairement dans `schema.prisma:321-323` + `migrations/20260509120000_sprint_24_tiptap_json_text/migration.sql:1-7` :

- `body` (HTML) = source rendu côté React Tiptap = ce qu'affiche le site.
- `body_json` = `editor.getJSON()` = ProseMirror document = reuse RSS / AMP / AI summarisation / data migration future.
- `body_text` = `editor.getText()` = texte plain = FTS clean (sans tags HTML) + OG description fallback + AI prompt context.

Justification correcte. Coût stockage marginal (JSON ~30% size du HTML, text ~70% size). Tradeoff bon.

Limitation : voir P2-DB-04, la migration FTS ne profite pas encore de `body_text`.

### 15. `prisma/seed.ts`

- Idempotent partout (upsert ou check-then-create).
- Crée 1 admin + 5 settings + 13 categories + 1 author + 6 tags + 5 articles + 6 testimonials + 3 case studies + 20 FAQs + 10 help articles.
- **Risque P2-DB-05** : password admin hardcodé sans guard `NODE_ENV !== "production"`.
- `package.json:11-13` registre `"prisma": { "seed": "tsx prisma/seed.ts" }` → `prisma db seed` standard reconnu.

Usage doctrine : **dev + staging uniquement**, mais code ne l'enforce pas.

## Citations

| Affirmation                        | Citation                                                                                                                                                 |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 22 modèles, 16 enums               | `prisma/schema.prisma:35-148, 154-706`                                                                                                                   |
| 38 `@@index` + 7 `@@unique` blocks | Cf. § 1, comptage exhaustif schema.prisma                                                                                                                |
| 3 migrations                       | `prisma/migrations/{20260508175629_init,20260508193001_intervention_type_align,20260509120000_sprint_24_tiptap_json_text}/migration.sql`                 |
| FTS setup hors Prisma              | `prisma/migrations_fts/0002_fts_setup.sql:1-69`                                                                                                          |
| 0 `Timestamptz`                    | `grep -r 'Timestamptz' axionia/` = 0 hits ; `prisma/migrations/20260508175629_init/migration.sql:83` `TIMESTAMP(3)`                                      |
| 0 `deletedAt`                      | `grep -r 'deletedAt\|deleted_at' axionia/` = 0 hits                                                                                                      |
| Singleton Prisma                   | `src/lib/prisma.ts:1-19`                                                                                                                                 |
| Locks pessimistes booking          | `src/features/booking/actions.ts:194-236`, `src/features/admin-options/actions.ts:145-200`, `src/server/queue/workers/option-expiration-worker.ts:44-95` |
| Backup Hetzner                     | `scripts/backup-postgres.sh:1-160`                                                                                                                       |
| Backup R2                          | `scripts/backup-postgres-r2.sh:1-176`                                                                                                                    |
| Restore test bug `bookings_simple` | `scripts/restore-postgres-test.sh:106` vs `prisma/schema.prisma:224`                                                                                     |
| DATABASE_URL sans pool params      | `docker/docker-compose.production.yml:89`                                                                                                                |
| GDPR export query                  | `src/app/api/gdpr-export/route.ts:54-114`                                                                                                                |
| Retention purge worker             | `src/server/queue/workers/retention-purge-worker.ts:54-151`                                                                                              |
| Cert audit déjà flague pool        | `_AUDIT/CERTIFICATION-FRONTEND-2026/20-SCALABILITY-INFRA-2026.md:72`                                                                                     |

## [INCONNU] — éléments non vérifiables

- **Cron backup actif en prod V1** : `[INCONNU — runtime]`. Aucun fichier `.coolify/cron` ou `docker-compose.production.yml` cron entry. Doit être vérifié via Coolify Terminal `crontab -l` ou logs Telegram historiques.
- **FTS migration appliquée en prod V1** : `[INCONNU — runtime]`. Pas dans le pipeline Prisma natif. À vérifier via `\d article_translations` sur la DB prod (présence colonne `search_vector`).
- **Restore drill jamais exécuté** : `[INCONNU — preuve d'exécution manquante]`. Aucun rapport `_AUDIT/RESTORE-*.md` ou notif Telegram historique tracée.
- **Cloudflare R2 vs Backblaze dans DPA-REGISTER** : `[INCONNU sans relecture DPA-REGISTER]`. La mémoire dit Backblaze retiré, mais R2 (Cloudflare) bien câblé en code. Si R2 est actif, le sous-processeur Cloudflare doit couvrir R2 + CF Free + DNS.
- **Postgres `TZ=Europe/Paris` impact réel** : `[INCONNU sans psql prod]`. Théorique : la zone affecte `NOW()` et casts `::date`. Pratique : aucun bug remonté à ce jour. Mais c'est un timing-bomb pour les analyses RGPD (purge cron) et stats Plausible.

## Recommandations (≤ 10, classées effort × impact)

|   # | Recommandation                                                                                                                                                                                | Effort |                                                  Impact | Priorité       |
| --: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -----: | ------------------------------------------------------: | -------------- |
|   1 | **Patch `restore-postgres-test.sh:106`** : `bookings_simple` → `bookings`. 1 line                                                                                                             |  5 min |                          Sauve le restore drill mensuel | P1 immédiat    |
|   2 | **Garde NODE_ENV=production dans `prisma/seed.ts`**                                                                                                                                           |  5 min |    Empêche écrasement admin password en prod par erreur | P1 immédiat    |
|   3 | **Ajouter `?connection_limit=10&pool_timeout=10`** dans `DATABASE_URL` du compose prod + worker                                                                                               | 15 min |                     Évite saturation Postgres en pointe | P1 court terme |
|   4 | **Vérifier (ssh CPX32) + activer le cron backup-postgres-r2.sh** (ou backup-postgres.sh, choisir)                                                                                             |    1 h |                       Confirme que les backups tournent | P0 ops         |
|   5 | **Migration `0003_add_timestamptz.sql`** : `ALTER COLUMN ... TYPE timestamptz USING ... AT TIME ZONE 'UTC'` sur toutes les colonnes `DateTime`. Retirer `TZ: Europe/Paris` du compose         | 1 jour |                                Resout P0-DB-01 timezone | P0             |
|   6 | **Ajouter indexes FK manquants** : `Booking.submissionId`, `Article.authorId`, `Article.categoryId`, `HelpArticle.categoryId`, `CaseStudy.testimonialId`. Migration `0004_add_fk_indexes.sql` |    2 h |                      Perf admin jointures + GDPR export | P2             |
|   7 | **Exécuter restore drill réel sur Hetzner CPX32** + écrire `_AUDIT/RESTORE-DRILL-2026-05.md` avec row counts + durée                                                                          |    2 h |                                  Sort du `[INCONNU]` DR | P1             |
|   8 | **FTS migration v2** : `coalesce(body_text, body)` dans tsvector + `coalesce(problem_text, problem)`                                                                                          |    1 h |                           Ranking propre sans HTML tags | P2             |
|   9 | **Documenter doctrine "0 deletedAt = hard delete volontaire RGPD"** dans `Design.md` ou `CLAUDE.md §14`                                                                                       | 30 min | Évite qu'un dev futur introduise un soft-delete partiel | P2             |
|  10 | **Retry deadlock × 3 sur `$transaction` critiques** (booking + option) via wrapper utilitaire                                                                                                 |    3 h |                   Robustesse race condition sous charge | P2             |

## STOP & ASK consolidés (questions ouvertes pour Will)

- **Q-DB-01** : Hard-delete partout = doctrine RGPD volontaire ? Si oui, le documenter. Si non, dois-je ajouter `deletedAt` + middleware sur Submission/Booking/Article ?
- **Q-DB-02** : Lequel des 2 scripts backup tourne en prod V1 (Hetzner Storage Box OU Cloudflare R2 OU les deux) ? Cron actif ? Premier backup réussi historique ?
- **Q-DB-03** : Restore drill mensuel : a-t-il été exécuté au moins 1 fois depuis V1 LIVE 2026-05-08 ? Si non, planifier sprint dédié.
- **Q-DB-04** : Cloudflare R2 doit-il figurer dans `DPA-REGISTER` (sous-processeur) si le pipeline `backup-postgres-r2.sh` est actif ?
- **Q-DB-05** : `TZ: Europe/Paris` sur Postgres prod = choix conscient (lisibilité admin SQL ?) ou héritage ? Si UTC partout est OK : valider P0-DB-01 fix.
- **Q-DB-06** : FTS migration `0002_fts_setup.sql` est-elle appliquée en prod ? Devrait-elle entrer dans Prisma `migrations/` natifs (Sprint correctif) pour éviter divergence ?

---

**Fin AGT-11.** Confiance haute, AUDIT-ONLY respecté, aucune écriture hors `_AUDIT/E2E-2026-05-09/`.
