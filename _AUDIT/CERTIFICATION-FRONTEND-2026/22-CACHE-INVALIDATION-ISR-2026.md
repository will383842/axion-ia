# 22 — CACHE INVALIDATION + ISR 2026

> **Audit cache stratégie** : à 100K+ pages avec 100-300 publications/jour, full SSG impossible. ISR Next 16 + Cloudflare cache purge atomique = la combo gagnante.
> Lancer fenêtre fraîche.

## 0. Contexte

Pour 100-300 nouvelles URLs/jour :

- Full SSG = build complet à chaque change = 30+ min = inacceptable
- ISR (Incremental Static Regeneration) Next 16 = on-demand revalidation = la solution
- Cloudflare Cache Rules + purge per URL via API = invalidation rapide
- Stale-while-revalidate = utilisateur jamais en attente

## 1. Audit en 5 chapitres × 10 critères = 50 points

### Chapitre 1 — Stratégie ISR Next 16

1.1 Décision documentée : full SSG vs ISR vs hybride par route
1.2 Routes pSEO villes/régions : ISR avec `revalidate` (60-3600 sec)
1.3 Routes statiques (home, /audit, /interventions) : SSG full
1.4 Routes dynamiques user-driven (calendrier, recherche) : SSR ou client
1.5 `revalidatePath('/implantations/[region]/[ville]')` câblé sur publish
1.6 `revalidateTag('cities')` utilisé pour invalidation groupée
1.7 ISR fallback : `dynamicParams: true` pour générer à la demande
1.8 ISR cache size monitoring (`.next/cache/fetch-cache`)
1.9 Cache TTL cohérent (page courante 60s, archive 86400s)
1.10 Test ISR : modifier contenu, vérifier que la prochaine visite déclenche regen

### Chapitre 2 — Cloudflare Cache Rules

2.1 Cache Rule HTML : `s-maxage=600, stale-while-revalidate=86400`
2.2 Cache Rule assets immutables : `Cache-Control: public, max-age=31536000, immutable` sur `/_next/static/*`
2.3 Cache Rule images Next : `s-maxage=31536000` sur `/_next/image*`
2.4 Cache Rule sitemap : `s-maxage=300` (rapide invalidation sur publish)
2.5 Cache Rule robots.txt : `s-maxage=86400`
2.6 Cache Rule 404 : `s-maxage=300` (court pour permettre nouvelle page)
2.7 Cache Rule API `/api/vitals` : `no-cache, no-store`
2.8 Vary headers cohérents (`Accept-Encoding`)
2.9 Brotli compression actif Cloudflare (auto)
2.10 Cache hit rate mesuré ≥ 90 % (Cloudflare Analytics)

### Chapitre 3 — Cache purge automation

3.1 Cloudflare API token créé (scope : Cache Purge sur zone uniquement)
3.2 Token stocké en env var (jamais commit)
3.3 Helper `lib/cloudflare/purge.ts` qui purge par URL ou liste d'URLs
3.4 Quota free tier respecté : 1000 purges per file / 24h, 30 purges per tag (free tier)
3.5 Batch purge (max 30 URLs par call free tier)
3.6 Purge sur publish atomique (transaction publish + purge atomique)
3.7 Purge sur depublish (URL devient 410)
3.8 Purge sur archive (URL devient 301 vers ailleurs)
3.9 Purge tout (`purge_everything`) jamais utilisé en runtime (uniquement migrations majeures)
3.10 Logs purges (qui, quoi, quand, success/fail)

### Chapitre 4 — Stale-while-revalidate UX

4.1 SWR actif côté Cloudflare (pas seulement Next ISR)
4.2 User n'attend jamais une regen (stale servi pendant background regen)
4.3 Indicateur visuel régénération : non visible (transparent UX)
4.4 Cache freshness header (`X-Cache: HIT/MISS/REVALIDATED`) pour debug
4.5 Page time-to-fresh < 60 sec après publish
4.6 Edge cache global : utilisateur Hong Kong voit fresh < 5 min après publish Hetzner
4.7 Cache key correct (path + locale + query si pertinent)
4.8 Pas de cache poisoning (validation user-input dans cache key)
4.9 Tests automatisés : after publish, fresh visible < 60 sec via Cloudflare
4.10 Monitoring : freshness lag par route

### Chapitre 5 — Edge cases

5.1 ISR fail : si regen échoue (API down, erreur), serve last good version
5.2 ISR timeout : config Next 16 timeout (default 60s)
5.3 Concurrent regen : pas de thundering herd (mutex / dedup)
5.4 Cache miss → origin pull : Hetzner doit gérer ~100 req/s peak
5.5 Cloudflare 524 (origin timeout) : Caddy timeout > Cloudflare timeout
5.6 Page très grosse (> 1 MB HTML) : streaming SSR considéré
5.7 Image cache : 1000 transforms quota Vercel N/A (Hetzner sharp illimité)
5.8 Sitemap cache : revalidate sur publish (ne pas servir stale > 5 min)
5.9 robots.txt cache : revalidate sur changement policy
5.10 404 cache : pas de cache long (5 min max)

## 2. Méthode

### Phase A — Mesure

1. Cache Rules Cloudflare actuelles (dashboard ou API)
2. Cache hit rate actuel (Cloudflare Analytics)
3. ISR config actuelle (`next.config.ts` + chaque route)
4. Test : modifier contenu, mesurer time-to-fresh

### Phase B — Diagnostic /50

### Phase C — Plan

1. Cache Rules Cloudflare optimales (template à copier-coller dans dashboard)
2. ISR strategy par route (table décisionnelle)
3. Helper purge.ts (Cloudflare API integration)
4. Workflow publish → revalidate + purge atomique

### Phase D — STOP & ASK

Livre :

- `audit-22-cache-isr-SYNTHESE.md`
- `audit-22-cache-isr-DIAGNOSTIC.md`
- `audit-22-cache-isr-PLAN.md`
- `audit-22-cache-isr-CLOUDFLARE-RULES.md` (template Cache Rules à coller)

### Phase E — Application après GO

1. Configurer Cloudflare Cache Rules (manuel dashboard)
2. Activer ISR par route
3. Implémenter `lib/cloudflare/purge.ts`
4. Câbler sur workflow publish
5. Tests end-to-end

## 3. STOP & ASK

1. Avant création Cloudflare API token (scope minimal)
2. Avant changement Cache Rules (impact massif possible)
3. Avant migration full SSG → ISR
4. Avant ajout dépendance Cloudflare SDK (si besoin)
5. Avant tout commit
6. Si cache hit rate drop > 20 % post-changement

## 4. Cible

> _« Cache hit rate Cloudflare ≥ 90 %. Time-to-fresh post-publish ≤ 60 sec. ISR fonctionnel sur toutes routes pSEO. Cloudflare cache purge atomique sur publish + depublish. 0 régression LCP/INP/CLS. »_

## 5. Livrables

```
audit-22-cache-isr-SYNTHESE.md
audit-22-cache-isr-DIAGNOSTIC.md
audit-22-cache-isr-PLAN.md
audit-22-cache-isr-CLOUDFLARE-RULES.md  (template)
```

---

**FIN DU PROMPT 22.**
