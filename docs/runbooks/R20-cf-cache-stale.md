# R20 — Cloudflare cache stale (article modifié pas visible)

- **Code** : R20
- **Version** : 1.0
- **Date dernière maj** : 2026-05-15
- **Sévérité** : 🟡 **P1 — important** (UX + SEO)
- **Impact si non traité** : utilisateurs voient version périmée d'un Article modifié (correction doctrine, fix XSS, dépublication). Google peut indexer l'ancienne version.

## Trigger

- User report : "j'ai modifié l'article mais le contenu n'a pas changé".
- Vérification post-fix R08/R09 montre encore l'ancien contenu.
- Comparaison sitemap.xml (`lastmod`) vs HTML servi diverge.

## Prérequis

- Token Cloudflare API (env Coolify ou `.secrets/api-tokens.env` : `CF_API_TOKEN`, `CF_ZONE_ID`).
- Zone ID Cloudflare `axion-ia.com` (cf. memoire `axionia_session_2026-05-09_cloudflare_phase5`).

## Étapes

### 1. Identifier l'URL exacte

Lister toutes les variantes (avec / sans trailing slash, locale, alias) :

```
https://axion-ia.com/fr/blog/<slug>
https://axion-ia.com/fr/blog/<slug>/
https://axion-ia.com/blog/<slug>     ← redirect 301 vers /fr/
```

Vérifier `cf-cache-status` :

```bash
curl -sI "https://axion-ia.com/fr/blog/<slug>" | grep -i "cf-cache-status\|age"
# HIT = en cache (à purger), MISS / BYPASS = pas en cache
```

### 2. Purge ciblée par URL (recommandé)

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "files":[
      "https://axion-ia.com/fr/blog/<slug>",
      "https://axion-ia.com/fr/blog/<slug>/"
    ]
  }'
```

Limit : 30 URLs par appel, 1000 par jour Free plan.

### 3. Purge par tag (si article référencé multi-pages)

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"tags":["article-<slug>","blog-index"]}'
```

⚠️ Tags = feature payante (Pro+). En Free plan, fallback files.

### 4. Purge full (urgence absolue uniquement)

⚠️ Coût SEO temporaire (re-warmup cache) — réserver aux incidents massifs.

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -d '{"purge_everything":true}'
```

### 5. Vérifier purge effective

```bash
curl -sI "https://axion-ia.com/fr/blog/<slug>" | grep -i "cf-cache-status"
# Attendu : MISS (premier hit après purge) ou EXPIRED
```

Recharger en navigateur privé (hard refresh) — doit afficher contenu modifié.

### 6. Si problème persiste — revalidatePath Next.js

```bash
docker exec axion-ia-app-prod node -e "
  const { revalidatePath } = require('next/cache');
  revalidatePath('/fr/blog/<slug>');
  revalidatePath('/fr/blog');
"
```

Ou Server Action via admin (`/content-gen/jobs/<id>` → "Republier").

### 7. Vérifier Cache Rules CF n'aggressivise pas

Cloudflare dashboard → Rules → Cache Rules :

- Articles `/fr/blog/*` doivent avoir `Edge Cache TTL` ≤ 1h pour éviter staleness prolongée post-update.
- Vérifier que la Cache Rule respecte `Cache-Control` headers Next.js si présents.

## Vérifications post-fix

- [ ] `cf-cache-status: MISS` ou `EXPIRED` au premier hit après purge.
- [ ] Contenu modifié visible navigateur privé + curl.
- [ ] `sitemap.xml` cohérent (`<lastmod>` à jour).
- [ ] Pas de re-cache HIT version stale dans les minutes suivantes.

## Rollback

- Pas de rollback nécessaire (purge cache = action idempotente).
- Si `purge_everything` regretté : re-warmup naturel sous 24h (visiteurs re-peuplent le cache).

## Escalation

| Niveau | Contact            | Quand                                   |
| ------ | ------------------ | --------------------------------------- |
| L1     | Will               | si cache toujours stale > 1h post-purge |
| L2     | Cloudflare support | si CF API renvoie 5xx persistants       |

## Liens

- Mémoire `axionia_session_2026-05-09_cloudflare_phase5` — Cloudflare Phase 5 livrée
- Mémoire `axionia_domain_hosting` — zone ID + token CF
- R08 / R09 — souvent déclenchent R20 en cascade post-fix
- Cloudflare docs : https://developers.cloudflare.com/cache/how-to/purge-cache/
