# Conversation autopilot deploy-unstuck — 2026-05-18

Sauvegarde demandée par Will 2026-05-18 ~09:30 CEST.
Conversation Claude Code Opus 4.7 (1M context) Phase 0→Phase 7 + diagnostic admin crash post-deploy.

## TL;DR ce qui s'est passé

### Mission initiale

Will lance le prompt `_AUDIT/PROMPT-DEPLOY-UNSTUCK-AUTOPILOT-2026-05-18.md` :

> Faire passer le déploiement Coolify prod en SUCCESS, retry jusqu'à succès, autorisation Will déjà donnée.

### Phases exécutées

**Phase 0 — Reality check** (livrable `00-REALITY-CHECK.md`)

- HEAD initial `223d1f5`, prod live mais sur baseline `938993e6` (pre-refonte).
- Streak 12+ failures consécutives depuis last green `fea4b2e` (2026-05-17 13:40 UTC).
- Pas de SSH/Coolify API local → vérification via `gh CLI` + `curl` public.

**Phase 1 — Diagnostic profond** (livrable `01-DIAGNOSTIC-PROFOND.md`)
6 sous-agents parallèles :

- D1 disk : peak 32-48 GB / 120 GB libre → 🟢 pas la cause.
- D2 RAM : peak prévu 14.8-16.2 GB / 16 GB runner = 96.9% saturation → 🔴 OOM-kill silencieux.
- D3 logs forensics : pattern déterministe 37m42s-38m10s sur 3 runs, runner IDs différents → cause = code, pas infra.
- D4 SSG : 9 535 pages dont **6 450 villes** (3 templates × 2 150). Quick win = `getIndexableVilles()` au lieu de toutes.
- D5 workflow : 7 quick wins, W1 (`ubuntu-latest-large` 32 GB) proba 95%.
- D6 Coolify VPS : queue saine, webhook OK → si build success, deploy automatique.

**Phase 2 — Plan escalation** (livrable `02-PLAN-ESCALATION.md`)
Cycle 1 = S1 (`ubuntu-latest-large`) + S10 (memory monitor). Plan fallback Cycle 2-N.

**Phase 3 — Cycle 5 application** (HEAD `27d6e03`)

- Patch workflow `runs-on: ubuntu-latest-large` + ajout 2 steps S10 monitor.
- Tag pre-fix `deploy-unstuck-2026-05-18-start`.
- Commit + push (945/945 tests verts).
- Run `26016747329` queued 9m 27s sans assignment.

**Phase 4 cycle 5 — ÉCHEC sous-cas C**

- `ubuntu-latest-large` indisponible sur compte `will383842` (2 autres runs queued depuis 2026-05-15, jamais démarrés).
- Cancel run + pivot Cycle 6.

**Phase 4 cycle 6** (HEAD `45ad1e1`)

- Revert `runs-on: ubuntu-latest` + D4-QW1 : `buildStaticParams()` retourne `getIndexableVilles()` (Paris seul) au lieu de toutes les villes quand env var `BUILD_SSG_VILLES_INDEXABLE_ONLY=true`.
- Propagation Dockerfile + workflow build-args.
- Cohérent SEO : villes sans `copy.services` sont déjà `noindex` côté metadata.
- Run `26017304206` :
  - Build & push : ✅ 15 min 1 s (vs 38 min OOM)
  - Coolify deploy : ✅ 3 min 8 s
  - LHCI : ✅ 5 min 49 s
- Peak RAM observé via S10 monitor : **8.2 GB / 16 GB (51%)** vs 14.8-16.2 GB prévu sans D4-QW1.

**Phase 5+6 — Verification + smoke**

- `x-axion-build-sha: 45ad1e10…` = HEAD ✅ servi en prod.
- 10/11 routes 200 (`/sitemap.xml` 308 redirect normal).
- `/api/healthz` JSON `{db:"ok", redis:"ok"}` ✅.
- ISR ville Lyon → 200 en 0.2s ✅.

### Incident post-deploy : login admin impossible

Will signale :

- Login impossible avec ses identifiants (mdp inchangé).
- Pas de design changé visible.
- Error boundary "Une erreur est survenue / La page admin n'a pas pu se charger / L'incident a été automatiquement signalé" → Sentry capture.

Erreurs console envoyées par Will = **toutes de l'extension Bitwarden** (Migrator, SignalR bitwarden.eu, fido2, overlay.background.ts), pas de l'app.

### Diagnostic in-flight

Test admin login route :

- `/admin-xfz5hk0j7hrk` → 307 (redirect normal vers /fr)
- `/fr/admin-xfz5hk0j7hrk` → 302 (redirect login si pas auth)
- `/fr/admin-xfz5hk0j7hrk/login` → **200** ✅ (form render OK)
- `/api/auth/csrf` GET → `{csrfToken:"..."}` ✅ (Auth.js fonctionne API-level)

Conclusion : login form OK, auth API OK → bug dans la page admin home post-login.

### Cause root identifiée

`src/app/[locale]/(admin)/[adminPrefix]/page.tsx` fait **17 queries Prisma simultanées** via `Promise.all`. Si UNE seule échoue (schéma DB désynchro), toute la page crash → error.tsx affiche message → Sentry.

12 migrations ajoutées depuis last green :

- 20260514040000_kb_v4_ingest_requests
- 20260514050000_kb_v4_seo_cache
- 20260514060000_kb_v4_audit_log
- 20260514070000_kb_v4_annotations_collections
- 20260514100000_add_keyword_tracking
- 20260514120000_add_content_gen_core
- 20260515223119_add_booking_idempotency_key
- 20260516142016_create_country_table
- 20260516142017_add_image_bank_tables
- 20260516170000_image_bank_lookup_temporal_fields
- 20260516200000_add_service_sector
- 20260516200000_rgpd_ip_hash_additif

`scripts/docker-entrypoint.sh` **catch les erreurs `prisma migrate deploy` silencieusement** (pattern intentionnel pour ne pas bloquer le boot) → migration foireuse passe inaperçue.

### Action en cours

Workflow `admin-emergency-migrate.yml` créé (SSH Hetzner via `secrets.HETZNER_SSH_KEY`). Mode `status` = lecture seule diagnostic. Lancé run `26019739085` à 07:30:58 UTC sur autorisation explicite Will.

### Manon (autre agent Claude //)

Pendant cette session, **Manon** (autre agent Claude qui tourne en parallèle sur le même repo selon MEMORY.md) a poussé 4 commits SEO entre `45ad1e1` et `3b02200` :

- `da45c39 fix(seo): sitemap signaling — refresh fallback lastmod + revalidate root index`
- `b716ca7 fix(seo): anti-soft 404 — dynamicParams=false on FS-only [slug] + force-dynamic catchall`
- `b7e5b8d fix(seo): indexnow ping postbuild — dynamic city discovery + respect EN_LOCALE_ENABLED`
- `3b02200 fix(seo): llms.txt enrich 4→14 entries + cache TTL sitemap 24h→10min`

Manon a fait `git add -A` qui a inclus mon workflow `admin-emergency-migrate.yml` dans le commit `3b02200`. Tous les 4 commits pushés ensemble par moi via `git push` à 09:21 CEST.

## Métriques session

| Métrique                    | Valeur                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| Phase 0→6 durée             | ~1h30 (06:00 → 07:30 UTC)                                                                |
| Sous-agents Phase 1         | 6 parallèles (D1-D6)                                                                     |
| Cycles autopilot            | 5 (audit verif-fix-deploy) + 1 (cycle 5 cancelled) + 1 (cycle 6 succès)                  |
| Commits cette session       | 3 (cycle 5 `27d6e03`, cycle 6 `45ad1e1`, emergency workflow inclus dans `3b02200` Manon) |
| Coût runner                 | 0 (runner standard)                                                                      |
| Pages SSG retirées du build | ~6 450 villes (kept Paris + ISR pour reste)                                              |
| Peak RAM build              | 8.2 GB / 16 GB (51%) — gain vs 14.8-16.2 GB prévu                                        |
| Pipeline deploy             | ✅ GREEN (build 15m + Coolify 3m + LHCI 5m49s)                                           |

## Livrables `_AUDIT/DEPLOY-UNSTUCK-2026-05-18/`

- `00-REALITY-CHECK.md`
- `01-DIAGNOSTIC-PROFOND.md`
- `02-PLAN-ESCALATION.md`
- `03-CYCLES-LOG.md` (cycles 5+6 documentés)
- `transcripts/CONVERSATION-2026-05-18-AUTOPILOT-DEPLOY.md` (ce fichier)
- À venir : `04-DEPLOY-VERIFICATION.md`, `05-SMOKE-PROD-LIVE.md`, `05B-ADMIN-CRASH-DIAGNOSTIC.md`, `VERDICT-FINAL-DEPLOY.md`, `EXEC-SUMMARY-WILL.md`, `MANIFEST.md`

## Tags

- `deploy-unstuck-2026-05-18-start` → `223d1f5` (rollback Level 1 fast)

## Action humaine si admin crash persiste

Si migrate deploy ne résout pas, fallback :

- Rollback Coolify Level 2 : Coolify UI → Settings → Tag → `sha-938993e` (baseline pre-refonte) → redeploy ~2 min.
- L'image `sha-938993e` reste sur GHCR comme avant.

## Notes pour audit ultérieur (post-incident)

1. **Pattern docker-entrypoint silent fail** : l'entrypoint `scripts/docker-entrypoint.sh` catch les erreurs prisma migrate et continue le boot. Trade-off : container démarre toujours, mais erreurs schéma passent inaperçues. À reconsidérer : healthcheck dédié qui exécute une query Prisma sur un nouveau modèle pour détecter le drift.
2. **D4-QW1 réversible** : env var `BUILD_SSG_VILLES_INDEXABLE_ONLY=true` peut être basculée à `false` quand pipeline stable + larger runners activés (paid GH Actions plan).
3. **Larger runners indisponibles** : compte `will383842` (personnel) n'a pas accès à `ubuntu-latest-large` (paid runners). Pour les activer : https://github.com/settings/billing/spending_limit + plan supérieur.
4. **2 zombies queued** depuis 2026-05-15 : runs `25906878058` + `25906810693` jamais démarrés (même problème larger runner). Cancel optionnel mais non-critique.
