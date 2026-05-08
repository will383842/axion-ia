# 20 — SCALABILITY INFRA 2026 (cible 300K+ URLs)

> **Audit infrastructure scaling** : Hetzner CX32 + Coolify + Caddy + Cloudflare Free doit absorber 300K+ pages, 100-300 nouvelles/jour, 100K visites/mois sans saturer.
> Lancer fenêtre fraîche depuis `Axion-IA/axionia/`.

## 0. Contexte

Cible 3 ans : **300K+ URLs**. Charge prévisible :

- 50K-150K pages SSG persistantes en année 1
- ISR pour les nouvelles (100-300/jour)
- 10K-100K visites/mois (estimation V1-V2)
- Build cible < 10 min même à 100K pages

Constat : Hetzner CX32 (4 vCPU x86 / 8 GB RAM / 80 GB NVMe / 20 TB) a des **limites mesurables** qu'il faut anticiper.

## 1. Mission

Auditer scalability bout-en-bout et identifier les **points de saturation futurs** avec :

1. Plan upgrade chiffré et conditionnel (à activer SI seuil X dépassé)
2. Optimisations gratuites à appliquer maintenant pour repousser ces seuils
3. Monitoring des seuils en continu
4. Plan B si saturation imprévue

## 2. Audit en 8 chapitres × 10 critères = 80 points

### Chapitre 1 — Build time

1.1 Build SSG actuel mesuré (`pnpm build` time wall-clock)
1.2 Build time projection à 50K, 100K, 300K pages (extrapolation linéaire ou pire)
1.3 ISR activé sur les routes pSEO (au lieu de full SSG si > 50K pages)
1.4 `dynamicIO` Next 16 considéré pour streaming generation
1.5 Build chunked possible (build par batch de N pages)
1.6 Build cache Next 16 (`.next/cache`) persistant entre builds (Coolify volume)
1.7 GitHub Actions free tier (2000 min/mois) suffisant ou self-hosted runner
1.8 Build parallèle (multi-process) si CPU permet
1.9 Skip prebuild des pages non modifiées (lastmod-based)
1.10 Build artifact upload < 200 MB (sinon Coolify ralenti)

### Chapitre 2 — Runtime CPU/RAM

2.1 Next.js Node runtime mesuré (RSS RAM stable < 1.5 GB)
2.2 Postgres container stable < 1.5 GB RAM (avec shared_buffers tuné)
2.3 Redis container stable < 256 MB
2.4 Coolify orchestrator < 512 MB
2.5 Caddy 2 < 50 MB
2.6 Total runtime < 4 GB (50 % marge sur 8 GB CX32)
2.7 Pas de swap pendant runtime régulier
2.8 CPU steady < 50 % (marge pour pics)
2.9 Memory leak detection (process restart auto si RSS > seuil)
2.10 Healthcheck Coolify expose RAM/CPU pour monitoring

### Chapitre 3 — Disque

3.1 Disk usage actuel mesuré (`df -h`)
3.2 Croissance projetée (DB + .next/cache + logs + Docker images)
3.3 Postgres autovacuum tuné (évite bloat)
3.4 Logs rotatifs configurés (logrotate ou Docker driver)
3.5 Docker images cleanup (`docker system prune` cron)
3.6 .next/cache cleanup périodique
3.7 Backup local rotation (max N versions sur disque)
3.8 Alerting si disque > 80 %
3.9 Plan upgrade SSD : CX42 (160 GB) +€6,61/mois HT si saturation
3.10 Volume Hetzner attachable (€0,04/GB/mois) si besoin séparer DB

### Chapitre 4 — DB scaling

4.1 Indexes Prisma : sur slug, locale, region, lastmod, status
4.2 Composite indexes sur queries fréquentes (locale + status par exemple)
4.3 Query perf p95 < 50 ms via `pg_stat_statements`
4.4 Connection pooling (PgBouncer container ou Prisma `connection_limit`)
4.5 Slow query log activé (> 100 ms)
4.6 Read replica considéré (utile si > 1000 req/s lecture)
4.7 Vacuum + analyze planifiés (autovacuum + cron weekly full)
4.8 Schema migrations atomiques (pas de blocage prod)
4.9 Backup auto Coolify (daily, retention 30j minimum)
4.10 Restore drill testé (RTO < 1h, RPO < 24h)

### Chapitre 5 — Cache & CDN

5.1 Cloudflare Free cache hit rate > 90 % sur HTML statique (mesuré)
5.2 Cloudflare Cache Rules configurées (immutable assets, HTML SWR)
5.3 Stale-while-revalidate actif (utilisateur jamais en attente)
5.4 Origin pull rate < 10 % du traffic (90 % servi par Cloudflare)
5.5 Bandwidth Hetzner usage < 50 % de 20 TB/mois (alerting si dépassé)
5.6 Bandwidth Cloudflare illimité (pas de limit free tier)
5.7 Cache purge per URL automatisé (Cloudflare API)
5.8 304 Not Modified servies correctement (Cloudflare + Caddy ETag)
5.9 Brotli compression actif (gain ~15 % vs gzip)
5.10 Plan B : si CF Free saturé en API calls (gratuit illimité bandwidth mais 1000 purges/jour) → upgrade $5 add-on

### Chapitre 6 — Réseau

6.1 HTTP/3 (QUIC) actif Caddy + Cloudflare
6.2 Keep-alive cohérent
6.3 TCP fast open (sysctl Hetzner tuned)
6.4 Pas de redirect chain (curl test)
6.5 IPv6 actif (Hetzner inclus)
6.6 DDoS protection : Cloudflare Free illimité
6.7 Rate limiting Caddy ou Cloudflare (anti-scraping)
6.8 Bot management (Cloudflare Free Bot Fight Mode)
6.9 SSL handshake < 100 ms (TLS 1.3)
6.10 Latence Hetzner Falkenstein → utilisateur EU < 30 ms

### Chapitre 7 — Sitemap & indexation scale

7.1 Sitemap split actif (sitemap-index pour > 50K URLs)
7.2 Sitemap auto-régénéré sur publish (pas batch nightly)
7.3 lastmod accurate (timestamp publish réel)
7.4 robots.txt sitemap pointer correct
7.5 Sitemap < 10 MB par fichier (limite Google)
7.6 Sitemap gzippé (`/sitemap.xml.gz`) si > 1 MB
7.7 Crawl budget : noindex sur thin pages (anti-doorway HCU)
7.8 IndexNow ping automatisé sur publish (Bing/Yandex)
7.9 Search Console URL Inspection API : monitoring 600 URL/jour quota
7.10 Plan : si > 100K URL, considérer URL Inspection bulk via Search Console API ou outil tiers

### Chapitre 8 — CI/CD scaling

8.1 GitHub Actions free tier 2000 min/mois (cible build < 10 min × 30/mois = 300 min OK)
8.2 Self-hosted runner Hetzner si > 2000 min (gratuit)
8.3 Cache GitHub Actions (`actions/cache`) pour `.next/cache` + `node_modules`
8.4 Build matrix locale (FR + EN en parallèle)
8.5 Tests parallèles vitest (`--threads`)
8.6 Playwright tests parallèles (`workers`)
8.7 Lighthouse CI sur subset (15 pages stratégiques + sample 5 random pSEO)
8.8 Deploy artifact léger (`output: "standalone"`)
8.9 Rollback rapide via Coolify (1 click previous version)
8.10 Smoke tests post-deploy (curl 200 OK sur 10 routes critiques)

## 3. Méthode

### Phase A — Mesure baseline

1. `pnpm build` actuel : durée + RAM peak + bundle size
2. Hetzner CX32 actuel : `df -h`, `free -h`, `top`, `docker stats`
3. Cloudflare analytics : cache hit rate, bandwidth, requests
4. Postgres : `pg_stat_statements`, top 10 slow queries
5. Search Console : indexation rate, crawl errors

### Phase B — Diagnostic + projections

Pour chaque chapitre, scoring + projection croissance.

Tableau projections :

| Métrique       | Actuel | À 50K pages | À 100K pages | À 300K pages | Action si dépassé |
| -------------- | ------ | ----------- | ------------ | ------------ | ----------------- |
| Build time     | X min  | ?           | ?            | ?            | ISR + chunk       |
| RAM peak build | X GB   | ?           | ?            | ?            | CX42              |
| Disk usage     | X GB   | ?           | ?            | ?            | CX42 ou volume    |
| Bandwidth/mois | X GB   | ?           | ?            | ?            | CF cache tuning   |

### Phase C — Plan optimisations + upgrades conditionnels

Optimisations gratuites prioritaires :

- ISR au lieu de full SSG sur pSEO
- Build cache persistant Coolify volume
- Postgres autovacuum + indexes optimaux
- Cloudflare Cache Rules optimales
- Sitemap split + IndexNow

Upgrades conditionnels chiffrés :

- CX42 (€13,10/mois HT) → +160 GB SSD + 8 vCPU si CX32 saturé
- Volume Hetzner (€0,04/GB/mois) → si DB > 40 GB
- Read replica → si lectures DB > 1000 req/s
- Cloudflare Pro $20/mois → si besoin WAF Managed (Sprint 16) ou SLA

### Phase D — STOP & ASK

Livre :

- `audit-20-scalability-SYNTHESE.md`
- `audit-20-scalability-DIAGNOSTIC.md`
- `audit-20-scalability-PROJECTIONS.md`
- `audit-20-scalability-PLAN.md`

### Phase E — Application après GO

Patches gratuits d'abord (ISR, cache, indexes), puis upgrades conditionnels après mesure réelle.

## 4. STOP & ASK obligatoires

1. Avant tout upgrade VPS Hetzner (chiffrer +€/mois)
2. Avant ajout volume disque Hetzner
3. Avant activation read replica DB
4. Avant changement Cache Rules Cloudflare
5. Avant migration full SSG → ISR
6. Avant changement plan Cloudflare
7. Avant ajout dépendance npm
8. Avant tout commit
9. Si build time > 15 min (signal urgence)
10. Si bandwidth > 80 % du quota Hetzner

## 4bis. Anti-patterns à éviter (Pitfalls)

- ❌ Full SSG à 100K pages (build time explose linéairement)
- ❌ ISR sans `revalidatePath` après mutation (cache stale)
- ❌ Postgres sans indexes composites (full table scans à 100K rows)
- ❌ Pas d'autovacuum tuné (table bloat invisible)
- ❌ Backup uniquement sur même VPS (single point of failure)
- ❌ Cloudflare Cache Rules par défaut (HTML non caché en edge)
- ❌ HTTP/3 désactivé (perte 10-20 % perf mobile)
- ❌ Logs Coolify sans rotation (disk plein silencieux)
- ❌ Upgrade VPS sans baseline metrics avant/après (impossible justifier)

## 5. Cible chiffrée

> _« Le frontend AxionIA absorbe 100K URLs SSG + ISR pour les nouvelles, build < 10 min, runtime stable < 4 GB RAM, disk < 60 GB, bandwidth < 10 TB/mois sur CX32 + CF Free, sans dégradation Lighthouse / Web Vitals. »_

## 6. Livrables

```
_AUDIT/CERTIFICATION-FRONTEND-2026/
├── audit-20-scalability-SYNTHESE.md
├── audit-20-scalability-DIAGNOSTIC.md
├── audit-20-scalability-PROJECTIONS.md
└── audit-20-scalability-PLAN.md
```

## 7. Mémoire

`axionia_audit_scalability_YYYY-MM-DD.md` + ajout `MEMORY.md`.

---

**FIN DU PROMPT 20.**
