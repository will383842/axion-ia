# 99 — ROADMAP REMEDIATION (2026-05-16)

> Plan d'attaque chiffré pour ramener la plateforme de 78.4 % 🟠 à ≥ 92 % 🟢 PROD-READY.
> Découpé Sprint S+1 (P0 critiques) → S+2 (P1) → S+3 (P2 + dette tech) → M+1 (production hardening).

---

## 0. Vue d'ensemble effort

| Sprint    | Durée               | Items                                       | Effort autopilote | Effort humain | Cible score                     |
| --------- | ------------------- | ------------------------------------------- | ----------------- | ------------- | ------------------------------- |
| **S+1**   | 1 semaine intensive | 6 P0 sécurité/RGPD                          | 12-15 h           | 4 h           | 78.4 → ~85 % 🟡                 |
| **S+2**   | 2-3 semaines        | 16 P0 restants + 12 P1 critiques            | 50-60 h           | 4 h           | 85 → ~91 % 🟡                   |
| **S+3**   | 1 mois              | 23 P1 restants + 25 P2 + dette tech         | 40-50 h           | 2 h           | 91 → ~95 % 🟢                   |
| **M+1**   | 1 mois              | Production hardening + observability tuning | 20-25 h           | 4 h           | 95 → 97-98 % 🟢                 |
| **TOTAL** | ~2 mois calendrier  | 22 P0 + 35 P1 + 25 P2                       | ~125-150 h        | ~14 h         | **~97 % 🟢 EXTREME PERFECTION** |

---

## 1. Sprint S+1 — P0 critiques sécurité/RGPD (semaine 1, 12-15 h)

> Objectif : fermer les 6 P0 qui ont un impact direct sur compliance / sécurité utilisateur.
> **Ordre** important — P0-S1-1 bloque P0-S1-2.

### P0-S1-1 : RBAC sur 6 mutations Sprint KB-18 (3 h)

**Refs** : audit 04-securite-rgpd.md (P0-RBAC-01/02/03) + 07-server-actions.md.

**Fichiers à patcher** :

```
src/server/actions/knowledge/annotations.ts  → 2 mutations (create, resolve)
src/server/actions/knowledge/collections.ts  → 5 mutations (create/update/delete/publish/addEntry)
src/server/actions/knowledge/ingest.ts       → 1 mutation (ingestEntry)
```

**Pattern** : importer `requireAdminWrite` depuis `src/server/actions/knowledge/_guards.ts:20-43` (existe déjà, V4-grade) ; remplacer `authorId` / `ownerId` venant du form data par le `session.user.id` extrait du guard. Test : ajouter 1 vitest par mutation qui appelle sans session → expect 401.

**Définition of done** : `pnpm vitest run knowledge` vert + grep `requireAdminWrite` 8 nouveaux sites.

### P0-S1-2 : `/api/gdpr-export` complet + `/api/gdpr-erase` (4 h)

**Refs** : audit 18-flow-kb.md (P0-02/03) + 15-flow-booking.md (P0-2).

**Patch** :

1. `src/app/api/gdpr-export/route.ts` :
   - Étendre `select` sur `bookings` pour inclure full record (pas seulement `bookingDate`)
   - Appeler `exportKbDataForEmail(email)` de `src/lib/knowledge/rgpd-export.ts` et merger dans le JSON exporté
2. **Créer** `src/app/api/gdpr-erase/route.ts` :
   - POST `{ email, confirmToken }` → vérif `confirmToken` (TTL 24h, signed)
   - Appeler `eraseKbDataForEmail(email)` (déjà existant `:104`) + `eraseSubmissionsForEmail(email)` + `eraseBookingsForEmail(email)` (à créer)
   - Logger dans `KbAuditLog` + Telegram alert canal Will
3. Page admin `/admin/rgpd/erase-requests` (existante ? sinon créer) : générer `confirmToken` + envoyer email.

**Test** : Playwright e2e simulant Will déclenchant export + erase → verif Submission/Booking/KB rows disparus.

### P0-S1-3 : IP hashing sur Submission + NewsletterSubscriber (2 h)

**Refs** : audit 20-flow-contact-presse.md (P0-2).

**Patch** :

1. Migration Prisma : renommer `Submission.ipAddress` → `Submission.ipHash` (string) et idem `NewsletterSubscriber.ipAddress` → `ipHash`. Drop ancienne colonne après backfill.
2. Backfill : script `prisma/scripts/backfill-ip-hash-2026-05-XX.ts` qui SELECT old rows + hashIp(ip) + UPDATE.
3. Tous les `prisma.submission.create` / `prisma.newsletterSubscriber.create` : remplacer `ipAddress: ip` par `ipHash: hashIp(ip)` (helper `src/lib/security/ip-hash.ts`).
4. Rotation `IP_HASH_SALT` documentée dans `_AUDIT/SECRETS-ROTATION-CALENDAR.md` (créé S+2).

**Test** : grep `\.ipAddress` source = 0 hit après patch.

### P0-S1-4 : Honeypot UI rendu sur 6 forms publics (2 h)

**Refs** : audit 13-forms-a11y-i18n.md (P0-1) + 20-flow-contact-presse.md (P0-1).

**Pattern** : copier le pattern `QuoteRequestForm.tsx` (`<input name="website" tabIndex={-1} aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }} />`) dans :

```
src/components/forms/ContactForm.tsx
src/components/forms/NewsletterForm.tsx
src/components/booking/BookingForm.tsx
src/components/forms/AuditRequestForm.tsx
src/components/forms/ImplementationForm.tsx
src/components/forms/AuditForm.tsx
```

Vérifier que tous les server handlers font déjà le check `formData.get("website")` (audit a confirmé) → si non, ajouter.

### P0-S1-5 : Endpoints publics non protégés (2 h)

**Refs** : audit 09-api-webhooks-sitemaps.md (P0-1/2/3).

**Patch** :

1. `src/app/api/internal/kb/search/route.ts` : ajouter `checkRateLimit(ip, 30, '1m')` + retourner 429 si dépassé.
2. `src/app/api/indexnow/route.ts` : ajouter HMAC `x-axion-indexnow-signature` (secret env `INDEXNOW_INTERNAL_HMAC_SECRET`) ou IP-allow-list workers Coolify.
3. `src/lib/docuseal.ts:436-474` : retirer le fallback plaintext `x-docuseal-secret` (laisser uniquement HMAC v2) OU ajouter IP-allow-list DocuSeal.com.
4. `src/app/api/vitals/route.ts` : ajouter `checkRateLimit(ip, 60, '1m')`.

### P0-S1-6 : PG restore drill + crontab archivé (30 min ops + 1 h drill)

**Refs** : audit 23-monitoring-alerting.md (P0-1/3).

**Actions humaines (Will + ops)** :

1. SSH Hetzner CPX42 → `crontab -l > _AUDIT/CRONTAB-PROD-2026-05-XX.txt` + commit.
2. Exécuter un drill restore PG : `pg_restore --create --clean --dbname=postgres /backups/latest.dump` dans un DB temporaire `axionia_drill`. Mesurer RTO (< 15 min cible) et RPO (delta entre last backup et now < 24 h cible).
3. Logger résultat dans `_AUDIT/PG-RESTORE-DRILL-LOG.md` avec date, durée, RTO/RPO mesurés, anomalies.
4. Documenter procédure rollback prod dans `_AUDIT/RUNBOOK-DR-RESTORE-2026.md`.

### Bilan S+1

- **Score attendu post-S+1** : 2156.7 → ~2330 / 2750 = **~84.7 % 🟡 CONDITIONAL**.
- **Releases** : 6 commits sur main + 1 tag `v1.0.4-s-correctif-s1`.
- **Communication Will** : message clear S+1 done + 5 P0 résiduels qui passent en S+2.

---

## 2. Sprint S+2 — P0 restants + P1 critiques (2-3 semaines, 50-60 h)

> Objectif : fermer les 16 P0 restants (architectural drift + SEO + business flows) + 12 P1 critiques.

### 2.A — P0 architectural drift (12-15 h)

| Ticket                                                                                                                                                                     | Refs     | Effort |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| **P0-S2-A1** Unification RBAC : créer SSOT `src/lib/auth/rbac.ts` avec `requireAdminWrite`/`requireAdminRead`/`requireAuthor` + déprécier les 4 implémentations dupliquées | 1.A, 4.G | 4-6 h  |
| **P0-S2-A2** Migration des 17 sites `requireAdmin*` dupliqués vers le SSOT                                                                                                 | 1.A      | 3-4 h  |
| **P0-S2-A3** Migration des 15 sites `formatDate` vers `fmtDate` SSOT `src/lib/intl.ts:75`                                                                                  | 1.A      | 1-2 h  |
| **P0-S2-A4** Fusion `middleware.ts` + `proxy.ts` en un seul fichier Next 16 conforme + tests cookies pSEO `axion_ref_city`                                                 | 1.A      | 3-4 h  |
| **P0-S2-A5** Prisma `pnpm prisma:generate` + fix 2 JSX namespace `ForgetIpHashForm.tsx` + `usage-logs/page.tsx`                                                            | 1.C      | 30 min |
| **P0-S2-A6** N+1 fix `content-keyword-sync-worker.ts:86-126` (batch loadDB findMany IN + Map.get au lieu de findUnique × 28K)                                              | 1.B      | 1-2 h  |

### 2.B — P0 SEO/business (15-20 h)

| Ticket                                                                                                                                                                            | Refs     | Effort |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| **P0-S2-B1** Créer `/guides` hub + lier `/guides/[slug]` dans `routing.ts` pathnames + sitemap + breadcrumb                                                                       | 3.A      | 2-3 h  |
| **P0-S2-B2** `/equipe/[slug]` : lier dans routing.ts + Header/Footer/AI Act art.50 disclosure Manon discoverable                                                                  | 3.A, 3.B | 2 h    |
| **P0-S2-B3** 3 landings galerie thématiques + `/ressources` + `/transparence` orphelins → ajout sitemap + Header/Footer                                                           | 3.A, 3.B | 3-4 h  |
| **P0-S2-B4** `<Link href="/galerie">` PressImageBank.tsx:71 → soit créer route `/galerie` (préféré), soit pointer vers `/galerie/[ville]` index avec fallback Paris               | 3.B      | 1 h    |
| **P0-S2-B5** Consolider `<JsonLdGraph>` sur top 12 templates (home, interventions, audits, implementations, formations, methodologie, blog, presse, contact, ressources, ville×4) | 3.E      | 3-4 h  |
| **P0-S2-B6** Speakable DOM : injecter `data-faq-q`/`data-faq-a` dans `FaqBlock`/`Accordion` (matche le sélecteur déjà émis JSON-LD)                                               | 3.E      | 1 h    |
| **P0-S2-B7** GEO : ajouter `additionalProperty` INSEE (`codeCommune`/`codeRegion`) dans `buildLocalBusinessJsonLd` + `buildPlaceJsonLd`                                           | 3.E, 4.E | 1-2 h  |
| **P0-S2-B8** content-gen `targetKnowledgeEntryId` câblé post-publish (helper `publishToKB` dans `content-publish-worker.ts`)                                                      | 4.B      | 2 h    |
| **P0-S2-B9** Manon `aiGenerated/personaDisclaimer` rendu dans `AuthorByline.tsx` (blog/actualites/connaissances)                                                                  | 4.B      | 1 h    |

### 2.C — P0 infra (10-12 h)

| Ticket                                                                                                                                                                                                                 | Refs     | Effort |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| **P0-S2-C1** FTS raw SQL auto-applied : ajouter script `scripts/apply-fts-migrations.sh` exécuté par Dockerfile entrypoint après `prisma migrate deploy`                                                               | 2.A, 5.C | 2 h    |
| **P0-S2-C2** `.env.example` aligné avec `env.ts` (14 vars manquantes : `IP_HASH_SALT`, `PII_ENCRYPTION_KEY`, `BACKUP_ENCRYPTION_PASSPHRASE`, `REVALIDATE_SECRET`, etc.) + `REVALIDATE_SECRET` ajouté schema Zod env.ts | 5.A      | 1-2 h  |
| **P0-S2-C3** Workflow `deploy-coolify.yml` ajout 4 `TELEGRAM_*` notifications (success/fail build, success/fail deploy, lhci fail) — pattern `disk-cleanup-prod.yml:130-140`                                           | 5.B      | 2 h    |
| **P0-S2-C4** Versionner `Dockerfile.coolify-pull` location dans `coolify.json` ou équivalent (éviter régression UI Coolify)                                                                                            | 5.C      | 1-2 h  |
| **P0-S2-C5** generateEmbedding réel Voyage AI (`src/lib/knowledge/embeddings.ts:55-80`) + flag `KB_EMBEDDING_PROVIDER=voyage` env + tests integration                                                                  | 4.D      | 3-4 h  |
| **P0-S2-C6** README.md refonte (6 incohérences : CPX42, ADRs 0001-0027, EN désactivé, build externalisé, stub.invalid, `EN_LOCALE_ENABLED`)                                                                            | 5.D      | 1-2 h  |
| **P0-S2-C7** Créer `docs/ONBOARDING.md` step-by-step `pnpm install` → `pnpm dev` < 30 min                                                                                                                              | 5.D      | 2 h    |
| **P0-S2-C8** Kill-switches manquants : ajouter sur image-bank workers + booking workers + global maintenance switch admin                                                                                              | 4.G, 2.C | 4-6 h  |

### 2.D — P1 critiques

12 tickets effort moyen 1-3 h. Voir détail par audit livrable.

### Bilan S+2

- **Score attendu post-S+2** : ~84.7 → ~91 % 🟡.
- **Releases** : ~25 commits sur main + tag `v1.0.5-s-correctif-s2`.
- **Sprint Review** : Will valide image-bank V1 push main (P0 RGPD art.17 fermé en image-bank V1 → push autorisé).

---

## 3. Sprint S+3 — P1 restants + P2 + dette tech (1 mois, 40-50 h)

### 3.A — Tests coverage (20-25 h)

| Ticket                                                                                                                        | Effort  |
| ----------------------------------------------------------------------------------------------------------------------------- | ------- |
| Image-bank Sprints 1-7 tests (unit + integration + e2e) — combler 0/8044 LOC                                                  | 12-16 h |
| 4 squelettes E2E content-gen S6.3 (blog-article, news-rss, coverage-campaign, quality-loop) — env vars `E2E_*_SLUG` set en CI | 4-6 h   |
| booking-submit + contact-submission E2E core un-skip + adapt                                                                  | 3-4 h   |

### 3.B — Indexes DB + N+1 (5-8 h)

| Ticket                                                                                                                                                                                                           | Effort |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Top 5 indexes manquants : `web_vital_samples.createdAt`, `submissions(createdAt, status)`, `cost_ledger.timestamp`, `content_gen_jobs(campaignId, status, createdAt)`, `knowledge_audit_log(entryId, createdAt)` | 1-2 h  |
| 3 FK `onDelete` explicites : `ContentGenJob.template/campaign`, `ContentCitation.externalReference`                                                                                                              | 1 h    |
| Worker concurrency env-configurable (5 hot-path : content-gen, content-publish, content-orchestrator, content-keyword-sync, content-rss-fetch)                                                                   | 2-3 h  |
| Back-pressure check content-orchestrator-worker.ts:152                                                                                                                                                           | 1 h    |

### 3.C — Design system housekeeping (3-5 h)

| Ticket                                                                                                           | Effort  |
| ---------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------- | --- |
| Wirer token `--shadow-cta-terracotta` sur 6 sites dupliqués + créer `--shadow-cta-primary` Header.tsx + stack-ia | 1-2 h   |
| Durcir `check-anti-hex.sh` pour matcher `rgba?\(                                                                 | hsla?\( | shadow-\[.\*rgba` (17 fuites détectables) | 1 h |
| 4 pages admin orphelines image-bank (licensing/seo-audit/sitemap-status/taxonomy) → sidebar + cmdk               | 1-2 h   |
| LocaleSwitcher : si EN désactivé runtime, ne plus afficher le toggle EN (P1 confort UX)                          | 1 h     |

### 3.D — Misc P2 (10-15 h)

- Drift naming `serviceSector` schema.prisma → snake_case
- pgvector `ef_search=80` runtime worker dedup
- EXIF/XMP/IPTC Copyright embed image-bank
- Variante OG `og.webp` 1200×630 image-bank pipeline
- 2FA QR code rendu admin
- Rotation calendar 18 tokens prod
- \_AUDIT/ housekeeping (152 entrées → `_archive-pre-2026-05-10/`, `_active/`, `_prompts/`)
- 4 ADRs manquants à promouvoir (rescale CPX42, content-gen segmentation 3 secteurs, CF Phase 5, Sprint 24 RGPD)
- Helpers orphans cleanup : `alertOps`/`alertIncident` → wirer ou supprimer
- Dead V1 KB (Feedback, Bookmark write, ImportBatch) → décision keep/drop

### Bilan S+3

- **Score attendu post-S+3** : ~91 → ~95 % 🟢 PROD-READY.
- **Tag** : `v1.1.0-perfection-extreme`.

---

## 4. Sprint M+1 — Production hardening (1 mois, 20-25 h)

### 4.A — Observability tuning

- Sentry sample rate ajustement (actuellement par défaut, optimiser à 10% prod / 100% dev)
- Helper `alertOps()` / `alertIncident()` wirer sur 8 sites critiques (cost-cap-cascade, kb-ingest-fail, deploy-fail, web-vitals-degrade p95, OOM worker, restore-fail, KB embedding stub fallback, …)
- Web Vitals dashboard `/admin/web-vitals` enrichi : per-route p75 + alert thresholds par-route
- Dashboard `/admin/system-health` consolidant cost ledger + worker queue depth + DB connection pool + Redis info

### 4.B — Hetzner snapshot policy

- Snapshot automatisé Hetzner CPX42 chaque 6h (rotation 24 snapshots × 6h = 6 jours)
- Cron archive snapshot dans S3 / B2 backup off-site mensuel (chiffré GPG)
- Procédure restore documentée `_AUDIT/RUNBOOK-DR-HETZNER-SNAPSHOT.md`

### 4.C — Cloudflare Page Rules tuning

- Cache rules granulaires : statique `/_next/static/*` 1 an, `/api/*` no-cache, `/fr/*` SWR 1h, `/fr/ressources/*` SWR 24h
- Rate limiting rules : `/api/*` 100 req/min/IP, `/api/internal/*` 30 req/min/IP, `/api/vitals` 60 req/min/IP, `/api/indexnow` HMAC-only
- WAF rules custom : block scrapers AEO/GEO sauf allow-list (Common Crawl, Mozilla 4768, Sourcegraph, Anthropic, OpenAI, Perplexity)

### 4.D — Lighthouse budgets per-route stricts

- Étendre `lighthouserc.json` 5 URLs → 12 URLs (incl. `/reserver` avec budget exception 110 KB)
- INP global 80 ms cible interne, exception `/reserver` à 150 ms documentée dans `lighthouserc.json` (cf. AGENTS.md doctrine, audit 1.E P1)
- LHCI gates en hard-fail (retirer `continue-on-error:true` sur gate-b / gate-c-docker)

### 4.E — Routine remote agent

- `claude routine` cron quotidien `babysit-pr` + scheduled "audit-perfection-check-monthly"
- Slack/Telegram digest hebdo : "cette semaine en prod" (deploys, costs, KB ingest, top errors)

### Bilan M+1

- **Score attendu post-M+1** : ~95 → ~97-98 % 🟢 EXTREME PERFECTION.
- **Sortie certification** : eligible re-audit avec verdict 🟢 PROD-READY définitif.

---

## 5. Dépendances entre tickets

```
S+1:
  P0-S1-1 (RBAC KB-18) ──┬──► P0-S1-2 (gdpr-export/erase) — nécessite RBAC propre pour appeler erase
                         └──► P0-S2-A1 (SSOT RBAC unifié)
  P0-S1-3 (IP hash) ─────────► migration schema.prisma + backfill = bloque P1-S2 indexes

S+2:
  P0-S2-A1 (SSOT RBAC) ──► P0-S2-A2 (migrate 17 sites) ──► P1-S2 reuses cleanup
  P0-S2-C1 (FTS auto-apply) ──► dégagement P1-S3 indexes
  P0-S2-C5 (Voyage AI réel) ──► nécessite KB embedding factory NOT shipped V1 (Will valide)

S+3:
  3.A tests image-bank ──► dépend image-bank push main (S+2)
  3.D ADRs manquants ──► dépend décisions Will sur 4 sujets

M+1:
  Tout dépend du score post-S+3. Si score < 92 %, re-run S+3 avant M+1.
```

---

## 6. Risques résiduels après remediation complète

| Risque                                                                                             | Mitigation                                                            | Priorité |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------- |
| EN locale réactivation un jour : bug next-intl 307 self-loop reste pré-existant                    | Sprint dédié quand re-activation prioritaire (cf. AGENTS.md doctrine) | P3       |
| pSEO 17K routes : Google peut classifier en doorway si <40 % unique sur la queue (villes < pilote) | A/B test tier-2 vs tier-1 + monitor GSC keyword sync                  | P2       |
| Image-bank pipeline IA translation (Sonnet 4.6 vision) : coût mensuel inconnu en charge réelle     | Cost ledger image-bank ajout + cost cap auto                          | P1 (S+3) |
| Booking V1 sub-tiers Approfondie 2j (890/1390/1990) à valider Will                                 | Décision Will (ADR à promouvoir)                                      | P3       |
| AI Act art. 50 disclosure Manon : à durcir avec timestamp + provider model name dans byline        | Phase compliance UE 2027                                              | P3       |

---

## 7. Communication Will

### Format proposé par Sprint

**Fin S+1** (date cible : 2026-05-23) :

> Sprint Correctif S+1 livré ✅. 6 P0 sécurité/RGPD fermés (RBAC KB-18 + GDPR full + IP hash + honeypot UI + 4 endpoints rate-limit + PG drill). Score 78.4 → 84.7 % 🟡. Tag `v1.0.4-s-correctif-s1`. Action humaine : valider drill RTO/RPO + signer DPA papier Hetzner. Prochaine étape : Sprint S+2 (architectural drift + SEO + business flows).

**Fin S+2** (date cible : 2026-06-13) :

> Sprint Correctif S+2 livré ✅. 16 P0 restants fermés. Score 84.7 → ~91 % 🟡. Image-bank V1 prêt à push main (P0 RGPD art.17 fermé). Tag `v1.0.5-s-correctif-s2`. Prochaine étape : Sprint S+3 (tests + dette tech + hardening).

**Fin S+3 + M+1** (date cible : 2026-07-31) :

> Plateforme certifiée 🟢 PROD-READY ~97 %. Tests image-bank coverage 80 %+, observability granulaire, snapshot policy Hetzner, CF Page Rules tuning, LHCI hard-fail. Tag `v1.1.0-perfection-extreme`.

---

**Fin Roadmap. Total : 22 P0 + 35 P1 + 25 P2 = 82 tickets en ~2 mois pour atteindre 97 % 🟢.**
