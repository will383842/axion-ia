# R08 — XSS détecté dans Article publié

- **Code** : R08
- **Version** : 1.0
- **Date dernière maj** : 2026-05-15
- **Sévérité** : 🔴 **P0 — critique** (sécurité)
- **Impact si non traité** : execution JS arbitraire chez visiteurs → vol session, défacement, propagation. Sentry CSP report en cascade. Réputation domaine impactée Google Safe Browsing.

## Trigger

- Sentry alert `[SECURITY]` Content-Security-Policy violation report.
- User report direct (email, formulaire contact).
- Audit manuel régulier (`pnpm content-gen:xss-scan` — à câbler V1.5).
- Cloudflare WAF detect `<script>` payload.

## Prérequis

- Accès admin `/fr/{ADMIN_URL_PREFIX}/content-gen/jobs` + `/fr/{ADMIN_URL_PREFIX}/content-gen/publications-status`.
- Accès Postgres pour scan rétroactif.
- Compréhension du pipeline `isomorphic-dompurify` (Sprint 1 D3 quality module).

## Étapes

### 1. Isoler l'Article incriminé

```sql
-- Si on connaît l'URL impactée
SELECT id, slug, title, "indexationTier", "createdAt", "generatedByJobId"
FROM "Article"
WHERE slug = '<slug-suspect>' OR id = '<id>';

-- Sinon, recherche full-text payload suspect
SELECT id, slug, title, "createdAt"
FROM "Article"
WHERE body ILIKE '%<script%' OR body ILIKE '%javascript:%' OR body ILIKE '%onerror=%'
ORDER BY "createdAt" DESC;
```

### 2. Dépublier immédiatement (5 secondes)

```sql
UPDATE "Article"
SET "indexationTier" = 'noindex_nofollow',
    "publishedAt" = NULL,
    "updatedAt" = NOW()
WHERE id = '<id>';
```

Ou via admin :

```
/fr/{ADMIN_URL_PREFIX}/content-gen/publications-status
→ filtre id ou slug → drag colonne "Refusé" (kanban Sprint 3 F14)
```

### 3. Purge cache Cloudflare (URL ciblée)

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"files":["https://axion-ia.com/fr/blog/<slug>","https://axion-ia.com/fr/blog/<slug>/"]}'
```

Vérifier que page renvoie 404 / redirect :

```bash
curl -sI https://axion-ia.com/fr/blog/<slug> | head -1
# Attendu : HTTP/2 404 OU HTTP/2 301 vers blog index
```

### 4. Identifier source XSS (root cause)

```sql
-- Job qui a généré l'article
SELECT j.id, j."contentType", j."providerSlug", j.payload, j."createdAt"
FROM "ContentGenJob" j
JOIN "Article" a ON a."generatedByJobId" = j.id
WHERE a.id = '<id>';

-- Logs détaillés (steps generation)
SELECT step, "outputSnippet", "createdAt"
FROM "GenerationLog"
WHERE "jobId" = '<job-id>'
ORDER BY "createdAt";
```

Causes typiques :

- Provider IA a généré payload non sanitized (échec `isomorphic-dompurify`).
- Prompt injection via RSS source malicieuse.
- Bug dans sanitization pipeline (`src/server/content-gen/quality/sanitize.ts`).

### 5. Scan rétroactif tous les articles générés depuis la même version pipeline

```sql
-- Articles potentiellement vulnérables (même provider + période)
SELECT a.id, a.slug, a."createdAt"
FROM "Article" a
JOIN "ContentGenJob" j ON a."generatedByJobId" = j.id
WHERE j."providerSlug" = '<provider-suspect>'
  AND j."createdAt" >= '<premiere-occurrence>'
  AND (a.body ILIKE '%<script%' OR a.body ILIKE '%javascript:%' OR a.body ILIKE '%onerror=%'
       OR a.body ILIKE '%onload=%' OR a.body ILIKE '%onclick=%');
```

Dépublier tous les hits.

### 6. Patch sanitization si bug pipeline

- Ouvrir `src/server/content-gen/quality/sanitize.ts` (helper `sanitizeHtml`).
- Vérifier whitelist tags `DOMPurify.sanitize(html, { ALLOWED_TAGS: [...] })`.
- Ajouter test de régression dans `tests/content-gen/sanitize.spec.ts`.
- Commit fix + push → Coolify auto-deploy.

### 7. Bloquer phrase / pattern via BannedPhrase

```sql
INSERT INTO "BannedPhrase" (phrase, severity, reason, "createdAt", "updatedAt")
VALUES ('<script', 'critical', 'R08-xss-pattern-detected', NOW(), NOW())
ON CONFLICT (phrase) DO NOTHING;
```

Effet immédiat : `doctrine-check.ts` rejette tout contenu contenant la phrase.

## Vérifications post-fix

- [ ] Article incriminé renvoie 404 ou redirect.
- [ ] Sitemap n'inclut plus l'URL (`/sitemap.xml`).
- [ ] Sentry CSP report compteur stagne (pas de nouveau hit).
- [ ] Scan SQL retourne 0 articles avec payload suspect.
- [ ] Test régression sanitize.spec.ts passe.
- [ ] Cloudflare cache purgé (vérif via `curl -I` headers `cf-cache-status: BYPASS` ou `MISS`).

## Rollback

- Si dépublication erronée (faux positif) → remettre `indexationTier = 'tier_1_index'` + `publishedAt = NOW()` + revalidatePath.
- BannedPhrase ajoutée à tort → DELETE row + rebuild check cache.

## Escalation

| Niveau | Contact                               | Quand                                                      |
| ------ | ------------------------------------- | ---------------------------------------------------------- |
| L1     | Will                                  | immédiat (P0 sécurité)                                     |
| L2     | DPO `contact@axion-ia.com`            | si données utilisateurs touchées (session vol) → CNIL 72h  |
| L3     | Cloudflare support                    | si WAF doit bloquer pattern en upstream                    |
| L4     | Provider IA (si root cause = LLM bug) | OpenAI trust@openai.com / Anthropic security@anthropic.com |

## Post-mortem obligatoire

P0 sécurité → écrire `docs/post-mortems/2026-XX-XX-xss-content-gen.md` avec :

1. Timeline (détection → dépublication → fix → vérif)
2. Root cause (pipeline sanitize / prompt injection / RSS source)
3. Articles impactés (count + slugs)
4. Users impactés (Sentry session IDs si disponibles)
5. Prevention actions (test régression, BannedPhrase, audit régulier)

## Liens

- ADR 0010 — Telegram PII minimisation (pattern sécurité)
- Code : `src/server/content-gen/quality/sanitize.ts` (helper sanitize)
- Code : `src/server/content-gen/quality/doctrine-check.ts` (BannedPhrase check)
- Mémoire `axionia_session_2026-05-09_sprint_24` — Sprint 24 CSP/COEP/JWT
- Master prompt § 9.7 — checklist SEO/AEO 60+ items (anti-XSS dans pipeline quality)
