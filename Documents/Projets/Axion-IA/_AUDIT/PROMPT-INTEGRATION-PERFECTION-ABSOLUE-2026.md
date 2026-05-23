---
name: PROMPT-INTEGRATION-PERFECTION-ABSOLUE-2026
version: 2.0
date: 2026-05-20
owner: Will (Axion-IA OÜ)
model: claude-opus-4-7 (orchestrateur) / claude-sonnet-4-6 (agents leaf)
mode: AUDIT-ONLY STRICT — AUCUNE écriture, aucun commit, aucune mutation prod
scope: Intégration inter-modules + SEO/AEO/GEO France exhaustif + Code cohérence + Structure
output_dir: _AUDIT/INTEGRATION-PERFECTION-2026-XX-XX/
score_cible: ≥ 2160 / 2400 (90 %) pour 🟢 CERTIFICATION INTÉGRATION GO
estimated_duration: 28–40 h autopilot (12 agents × 2–4 h + synthèse)
note: Basé sur analyse directe du code source réel (2026-05-20) — NON sur les docs
---

# 🏆 PROMPT INTÉGRATION PERFECTION ABSOLUE 2026 — Axion-IA

> **Objectif** : Certifier que tous les modules Axion-IA fonctionnent
> **parfaitement ensemble**, que le code est **centralisé et scalable**,
> et que le site atteint la **visibilité maximale en France** —
> SEO/AEO/GEO, JSON-LD Schema.org complet, EEAT, Speakable, WCAG 2.2 AA,
> zéro duplicate content, zéro structure fragile ou incohérente.
>
> Ce prompt audite l'**INTÉGRATION TRANSVERSALE** — ce que les audits
> sectoriels silotés manquent : chaque module peut être excellent en
> isolation et l'ensemble peut quand même être cassé aux coutures.
>
> **Mode AUDIT-ONLY STRICT ABSOLU.** Lire → constater → scorer → reporter.
> Zéro écriture de code. Zéro commit. Zéro mutation prod.

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## SECTION SYSTEM — CACHEABLE
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```xml
<system>
Tu es l'auditeur tiers indépendant mandaté par Will (Axion-IA OÜ) pour
certifier l'intégration bout-en-bout de la plateforme.

POSTURE : ingénieur senior + SEO architect + accessibility specialist.
Tu re-vérifies toujours sur le code source réel, pas sur les docs.
Tu cherches les incohérences transversales que les audits silotés manquent.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STACK TECHNIQUE (vérifiée 2026-05-20)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Framework  : Next.js 16.2.6 (App Router, React 19, output: standalone)
- ORM        : Prisma 5.22.0 + PostgreSQL 15 (citext, pg_trgm, uuid-ossp)
- Queue      : BullMQ 5.76.5 + Redis (IORedis 5.10.1)
- Auth       : Auth.js v5 (next-auth 5.0.0-beta.31) + 2FA TOTP
- i18n       : next-intl 4.11.1 — FR canonique / EN miroir (301 si désactivé)
- CSS        : TailwindCSS 4 + Radix UI + DND-Kit
- Storage    : Cloudflare R2 (S3-compatible) + Sharp 0.34.5 images
- Paiement   : Stripe 22.1.1 (LIVE V1)
- Emails     : Zoho Mail Free EU via Nodemailer
- Monitoring : Sentry + Pino structured logs + LHCI
- Deploy     : GH Actions → GHCR → Coolify 4 → Hetzner CPX42 + Caddy 2
- CDN        : Cloudflare Free (cache 600 s sitemaps, 604 800 s og-images)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
12 MODULES À AUDITER (périmètre intégration)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
M1  Keywords engine      src/content/keywords/           (18 fichiers g1–g8+h/i/j/m/x)
M2  Knowledge base V4    src/content/knowledge/          (types + sector-entries + sector-tags)
M3  Content generator    src/server/content-gen/         (generators/ + providers/ + quality/)
M4  pSEO villes          src/content/villes/             (index + copy/ + data/ + economic-data/)
M5  Image bank           src/server/image-bank/services/ + workers × 5
M6  Sitemaps             src/app/sitemap.ts              (20+ sub-sitemaps dynamiques)
M7  IndexNow             workers/content-indexnow-worker.ts + src/server/content-gen/seo/
M8  Admin V2             src/app/[locale]/(admin)/[adminPrefix]/ (110+ pages)
M9  JSON-LD              src/lib/seo/ville-service-jsonld.ts + composants page.*
M10 SEO metadata         src/lib/seo.ts factories + generateMetadata() pages
M11 Workers BullMQ       src/server/queue/workers/ (33 workers)
M12 Config SSOT          src/content/pricing.ts + interventions.ts + src/lib/feature-flags.ts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTRAINTES MODE AUDIT-ONLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Autorisé : lire tous les fichiers du repo, git log/diff/show, prisma
   migrate diff (sans apply), pnpm typecheck, vitest --run, pnpm lint,
   curl HTTP en lecture seule (smoke headers + status), PageSpeed API
   en lecture.
❌ Interdit : toute écriture de code, commit, push, appel API IA payant,
   POST mutant sur prod, soumission URL GSC/IndexNow, toute mutation DB.
→ Si bug trouvé : noter avec preuve (chemin fichier + ligne + extrait),
  NE PAS fixer.
</system>
```

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 0 — PRÉ-VOL (1 agent synchrone, bloquant)
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Agent P0 — Snapshot état réel du dépôt**

```bash
# 1. État git
git log --oneline -15
git status --short

# 2. Qualité code (bloquants si rouge)
pnpm typecheck 2>&1 | tail -8
pnpm vitest run --reporter=verbose 2>&1 | tail -12
pnpm lint 2>&1 | tail -8

# 3. Build cache
ls -la .next/BUILD_ID 2>/dev/null && cat .next/BUILD_ID || echo "NO_BUILD"

# 4. Variables d'env critiques présentes (sans afficher les valeurs)
node -e "
const vars = [
  'NEXTAUTH_SECRET','DATABASE_URL','REDIS_URL','NEXT_PUBLIC_SITE_URL',
  'ADMIN_URL_PREFIX','ADMIN_V2_ENABLED','EN_LOCALE_ENABLED',
  'IP_HASH_SALT','INDEXNOW_INTERNAL_HMAC_SECRET',
  'NEXT_PUBLIC_SENTRY_DSN','BUILD_SSG_VILLES_INDEXABLE_ONLY'
];
vars.forEach(v => console.log(v + ':', process.env[v] ? '✅ SET' : '❌ MISSING'));
" 2>/dev/null || echo "Lire .env.example pour la liste attendue"
```

Lire ensuite :
- `axionia/next.config.ts` (complet)
- `axionia/middleware.ts` (complet)
- `axionia/src/lib/feature-flags.ts` (complet)
- `axionia/src/lib/seo.ts` (complet — factories metadata)
- `axionia/prisma/schema.prisma` (50 premières lignes — liste des modèles)

**Règle bloquante** : si `pnpm typecheck` retourne > 0 erreur ou si
`vitest run` est < 90 % vert → **STOPPER ICI, reporter à Will, NE PAS
lancer les 12 agents.**

**Livrable P0** : `P0-SNAPSHOT.md` (git HEAD · typecheck · vitest ratio ·
lint · 12 env vars status · feature flags actifs)

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 1 — 12 AGENTS PARALLÈLES
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Lancer en 3 batches de 4 (batch suivant démarre dès que le précédent
a produit ses preuves structurelles, pas besoin d'attendre les rapports
finaux).

---

### ══════════════════════════════════════
### BATCH A — Cohérence pipeline & données
### ══════════════════════════════════════

---

#### AGENT A1 — Pipeline Keywords → Content → Publication → Sitemap → IndexNow  /200

**Question centrale** : quand un `KeywordSeed` est créé dans
`src/content/keywords/`, arrive-t-il automatiquement en article publié,
dans le sitemap, et IndexNow est pingué — sans intervention manuelle ?

**Étape 1 — État de `blog-from-keywords.ts`**

Lire `src/server/content-gen/generators/blog-from-keywords.ts` en entier.
Répondre :
- Est-il pleinement implémenté ou contient-il des `// TODO` / `throw new
  Error("not implemented")` / corps vides ?
- Quel est le mapping `KeywordSeed.type` → template KB → prompt LLM ?
  (lire aussi `src/server/content-gen/generators/index.ts` qui est le
  registre des générateurs)
- Est-il enregistré dans la queue BullMQ ? Chercher dans
  `src/server/queue/queues.ts` et `src/server/queue/workers/
  content-gen-worker.ts`.

**Étape 2 — Maillon orchestration**

Lire `src/server/queue/workers/content-orchestrator-worker.ts`.
- Comment un job de type "blog-from-keywords" est-il déclenché ?
  (cron ? événement ? console admin ?)
- La console admin `/[adminPrefix]/content-gen/coverage` ou
  `/[adminPrefix]/content-gen/templates` déclenche-t-elle bien ce
  générateur ? (lire les Server Actions correspondantes dans
  `src/server/actions/content-gen/`)

**Étape 3 — Maillon publication**

Lire `src/server/queue/workers/content-publish-worker.ts`.
- Après génération d'un article, le worker appelle-t-il
  `src/server/content-gen/shared/revalidate-content.ts` (ISR) ?
- Appelle-t-il le worker IndexNow en enchaînement ou en job séparé ?

**Étape 4 — Maillon sitemap**

Dans `src/app/sitemap.ts`, le sub-sitemap blog inclut-il les articles
nouvellement publiés via requête DB fresh ou depuis un cache statique ?
Quelle est la TTL de revalidation ? (`next: { revalidate: N }` ou
`export const revalidate = N`)

**Étape 5 — Maillon IndexNow**

Lire `src/server/queue/workers/content-indexnow-worker.ts` et
`src/server/content-gen/seo/` (indexing-client.ts).
- Le ping IndexNow est-il envoyé avec l'URL canonique finale
  (https://axion-ia.com/fr/blog/[slug]) ou une URL incorrecte ?
- Est-il protégé contre les double-pings (idempotence) ?

Scorer : 40 pts × 5 maillons. Déduire si maillon absent ou cassé.

**Livrable** : `A1-PIPELINE-KEYWORDS-CONTENT.md`

---

#### AGENT A2 — SSOT & centralisation : zéro duplication config  /200

**Question centrale** : chaque constante métier est-elle définie
**une seule fois** et importée partout ? Ou existe-t-il des copies
silencieuses qui dérivent ?

**Vérification 1 — Liste des services**

```bash
# Chercher toutes les occurrences de la liste des 6 services
grep -rn "interventions-formations\|coaching-1-to-1\|maintenance-ia\|codage-developpement" \
  src/app src/components src/lib --include="*.ts" --include="*.tsx" \
  | grep -v "import\|node_modules\|\.test\." | head -40
```
→ Les occurrences hors `src/content/interventions.ts` et
`src/content/audit-detail-configs.ts` sont-elles des imports ou des
chaînes dupliquées ?

**Vérification 2 — Prix**

Lire `src/content/pricing.ts` (SSOT déclaré).
```bash
grep -rn "390 €\|490 €\|990 €\|290 €\|890 €\|1 490\|1490\|3 900\|3900" \
  src/app src/components --include="*.tsx" --include="*.ts" | head -30
```
→ Y a-t-il des prix hardcodés dans les composants JSX sans import
depuis `pricing.ts` ?

**Vérification 3 — NEXT_PUBLIC_SITE_URL**

```bash
grep -rn "axion-ia\.com\|https://axion" src/app src/lib src/components \
  --include="*.ts" --include="*.tsx" | grep -v "NEXT_PUBLIC_SITE_URL\|sameAs\|og:url\|test\|spec" | head -20
```
→ Combien de fois l'URL du site est-elle hardcodée vs lue depuis
`process.env.NEXT_PUBLIC_SITE_URL` ?

**Vérification 4 — Sector tags**

Lire `src/content/knowledge/sector-tags.ts`.
```bash
grep -rn "conseil-affaires\|banque-finance\|industrie-manufacturiere\|sante-biotech" \
  src/server src/app src/lib --include="*.ts" --include="*.tsx" \
  | grep -v "import\|from " | head -20
```
→ Les slugs secteur sont-ils importés depuis `sector-tags.ts` ou
recopiés inline ?

**Vérification 5 — Feature flags**

Lire `src/lib/feature-flags.ts` (liste complète des flags).
```bash
grep -rn "isAdminV2Enabled\|ADMIN_V2_ENABLED\|EN_LOCALE_ENABLED\|HELP_BACKEND_UNIFIED\|BUILD_SSG_VILLES" \
  src/ --include="*.ts" --include="*.tsx" | grep -v "feature-flags.ts" | head -30
```
→ Ces flags sont-ils lus via `feature-flags.ts` ou via
`process.env.*` directement dans les composants ?

**Vérification 6 — Types TypeScript dupliqués**

```bash
grep -rn "^export type ServiceSlug\|^export type Locale\|^export type KbType\|^export interface Article" \
  src/ --include="*.ts" | head -20
```
→ Même type déclaré dans > 1 fichier ?

**Vérification 7 — `@context: https://schema.org`**

```bash
grep -rn "schema\.org" src/app src/components --include="*.tsx" | head -30
```
→ Existe-t-il un helper centralisé (ex: `src/lib/jsonld.ts` ou
`src/lib/seo/jsonld-builder.ts`) ou chaque page construit son JSON-LD
inline avec `"@context":"https://schema.org"` répété ?

**Vérification 8 — Locales list**

```bash
grep -rn "\[.fr.,\s*.en.\]\|\[.en.,\s*.fr.\]" src/ --include="*.ts" \
  --include="*.tsx" | grep -v "i18n\|routing\|node_modules" | head -20
```
→ La liste `['fr','en']` est-elle centralisée dans `src/i18n/routing.ts`
ou dupliquée dans plusieurs fichiers ?

Scorer : 25 pts × 8 vérifications.

**Livrable** : `A2-SSOT-CENTRALISATION.md`

---

#### AGENT A3 — Scalabilité villes : auto-scale 39 → 2157 villes  /200

**Question centrale** : quand Manon publie un nouveau fichier
`src/content/villes/copy/<slug>.ts`, est-ce que **toute la chaîne
s'adapte sans toucher au code** ?

**Vérification 1 — `generateStaticParams()` villes**

Lire ces deux fichiers :
- `src/content/villes/index.ts` (registre des villes)
- `src/app/[locale]/[service]/par-ville/[ville]/page.tsx` OU
  `src/app/[locale]/implantations/[region]/[ville]/page.tsx`
  (les pages pSEO villes — vérifier les deux patterns existants)

Le `generateStaticParams()` lit-il la liste dynamiquement depuis
`villes/index.ts` (import runtime) ou est-ce une liste hardcodée ?

**Vérification 2 — Score d'indexabilité**

Dans `villes/index.ts` (ou fichier équivalent de scoring), y a-t-il
un champ `indexable: boolean` ou `score: number` par ville ?
Est-ce que le `<meta robots="noindex">` est appliqué conditionellement
sur les pages des villes non-indexables via `middleware.ts` (qui gère
déjà `X-Robots-Tag`) ou via `generateMetadata()` ?

Lire `middleware.ts` — la logique `X-Robots-Tag: noindex, follow` sur
les routes `/*/par-ville/[ville]` — est-elle basée sur le score de la
ville ou appliquée en bloc ?

**Vérification 3 — Sitemap villes dynamique**

Dans `src/app/sitemap.ts`, repérer le(s) sub-sitemaps villes
(`sitemap/villes-<region>.xml` + chunks).
- Les URLs incluses sont-elles filtrées par `indexable === true` ?
- La date `lastmod` reflète-t-elle la dernière mise à jour du fichier
  ville (via `fs.statSync` ou timestamp du fichier) ?

**Vérification 4 — Breadcrumbs JSON-LD villes**

Dans la page `implantations/[region]/[ville]/page.tsx` et/ou
`src/lib/seo/ville-service-jsonld.ts`, les `BreadcrumbList` sont-ils
générés dynamiquement avec le nom réel de la ville (depuis le fichier
`villes/index.ts`) ou hardcodés ?

**Vérification 5 — hreflang FR↔EN villes**

Dans `generateMetadata()` des pages villes, y a-t-il un bloc
`alternates.languages` qui produit :
```
{ fr: "/fr/implantations/ile-de-france/paris",
  en: "/en/implantations/ile-de-france/paris" }
```
Compte-tenu que `EN_LOCALE_ENABLED` peut être `false`, ce hreflang
EN est-il conditionnel ou toujours injecté même si la page EN
retourne 301 ?

**Vérification 6 — Economic data → JSON-LD `areaServed` + `contentLocation`**

Lire un fichier `src/content/villes/economic-data/<slug>.ts` au hasard
(ex: île-de-france.ts).
Puis lire `src/lib/seo/ville-service-jsonld.ts` — les champs économiques
(population, secteurs dominants, etc.) sont-ils injectés dans le
JSON-LD `areaServed` / `contentLocation` / `additionalProperty` ou
sont-ils utilisés uniquement dans le HTML visible ?

**Vérification 7 — Meta title template villes**

Dans `generateMetadata()` page villes, le title suit-il le pattern
`"[Service] [Ville] — Axion-IA"` via le factory `buildLocalBusinessMetadata()`
de `src/lib/seo.ts`, ou chaque page villes construit-elle son titre
différemment ?
Vérifier sur 3 patterns URL : audit/par-ville, interventions/par-ville,
implantations/[region]/[ville].

**Vérification 8 — Image og:image locale par ville**

Les pages villes ont-elles une `og:image` spécifique par ville (depuis
la banque d'images taguée `location`) ou une image générique Axion-IA ?
Lire comment `buildLocalBusinessMetadata()` gère le champ `openGraph.images`.

Scorer : 25 pts × 8 vérifications.

**Livrable** : `A3-SCALABILITE-VILLES.md`

---

#### AGENT A4 — Duplicate content : cannibalisation & near-duplicate  /200

**Question centrale** : y a-t-il du contenu dupliqué ou quasi-dupliqué
susceptible d'entraîner une pénalité Google HCU ou une désindexation ?

**Vérification 1 — Trailing slash & casse URL**

Dans `next.config.ts`, y a-t-il `trailingSlash: false` ou `true` de
configuré ? Y a-t-il un redirect 301 pour normaliser les URLs ?
```bash
curl -sI https://axion-ia.com/fr/audit/ | grep -i "location\|status"
curl -sI https://axion-ia.com/FR/Audit | grep -i "location\|status"
```

**Vérification 2 — Pages EN et statut 301**

La variable `EN_LOCALE_ENABLED` est-elle `false` en prod ?
Si oui, le redirect EN→FR est-il un 301 (permanent) ou 302 (temporaire) ?
```bash
curl -sI https://axion-ia.com/en/ | grep -i "location\|status\|x-robots"
```
Les pages EN ont-elles un `canonical` pointant vers FR dans le `<head>`
même quand le 301 est actif, ou le canonical est-il absent (doublon
potentiel si le 301 échoue) ?

**Vérification 3 — Near-duplicate pSEO villes**

Lire le template généré pour 2 villes différentes (ex: Paris, Lyon)
dans `generators/landing-ville.ts`.
- Quelle proportion du contenu est commune vs unique par ville ?
- Le contenu unique (stats économiques `economic-data/`) est-il
  effectivement injecté dans le HTML généré ou reste-t-il en JSON
  non rendu ?
- Y a-t-il un `dedup-guard.ts` actif sur les landing pages villes
  (`src/server/content-gen/quality/dedup-guard.ts`) ?

**Vérification 4 — Cannibalisation keywords inter-pages**

Dans `src/content/keywords/master.ts`, les `KeywordSeed` ont-ils un
champ `targetUrl` ou `canonicalPage` qui assigne chaque keyword à
exactement 1 URL ?
```bash
grep -rn "formation ia entreprise\|formation intelligence artificielle" \
  src/app --include="*.tsx" | grep "title\|description\|keywords" | head -20
```
Est-ce que `/fr/`, `/fr/interventions/collectives` et
`/fr/audit` ciblent tous le même keyword HEAD, ou sont-ils segmentés ?

**Vérification 5 — Blog × KB × Guides cannibalisation**

Lire `src/content/knowledge/routes.ts` (routes publiques KB) et
comparer avec les patterns de routes `/fr/blog/[slug]`,
`/fr/guides/[slug]`, `/fr/connaissances/[slug]`.
Ces 3 espaces de contenu ont-ils des thèmes distincts ou se chevauchent-ils ?
Y a-t-il un champ `keyword_primary` dans le modèle Prisma `Article`
avec contrainte UNIQUE pour empêcher 2 articles de cibler le même keyword ?
```bash
grep -n "keyword_primary\|keywordPrimary\|@@unique\|UNIQUE" prisma/schema.prisma | head -15
```

**Vérification 6 — Pagination blog**

Dans `src/app/[locale]/blog/page.tsx` ou la page hub blog, y a-t-il
de la pagination ? Si oui, les pages paginées (`?page=2`) ont-elles :
- `canonical` vers page 1 (approche conservative Google) ou
- `rel="prev"` / `rel="next"` (approche SEO progressive — dépréciée
  officiellement depuis 2019 mais encore utilisée) ?

Chercher le composant de pagination dans `src/components/`.

**Vérification 7 — Paramètres UTM dans les canonicals**

Dans `middleware.ts`, les cookies UTM sont stockés mais l'URL de
la page n'est pas modifiée. Vérifier néanmoins :
Dans `generateMetadata()` de n'importe quelle page, le canonical
est-il construit avec `process.env.NEXT_PUBLIC_SITE_URL + pathname`
(sans query params) ou y a-t-il un risque que des `?utm_*` s'infiltrent
dans le canonical ?

Scorer : 28 pts × 7 vérifications + 4 pts bonus si dedup DB prouvé.

**Livrable** : `A4-DUPLICATE-CONTENT.md`

---

### ══════════════════════════════════════
### BATCH B — SEO/AEO/GEO cohérence
### ══════════════════════════════════════

---

#### AGENT B1 — Meta tags & EEAT : cohérence sur tous les types de pages  /200

**Question centrale** : chaque type de page produit-il des meta title,
meta description, og:title, og:description, og:image COMPLETS,
optimaux et cohérents avec le contenu réel ?

**Étape 1 — Audit du factory `src/lib/seo.ts`**

Lire `src/lib/seo.ts` en entier. Lister les fonctions exportées :
`buildProductMetadata()`, `buildArticleMetadata()`,
`buildLocalBusinessMetadata()` + toutes les autres.
Pour chaque factory, vérifier :
- title : max 60 chars, keyword primary inclus, " — Axion-IA" en suffixe
- description : 140–160 chars (trop court = gaspillage, trop long = tronqué)
- openGraph.images : dimensions ≥ 1200×630, URL absolue (pas relative)
- openGraph.type : correct par type de page (`website` / `article` / `profile`)
- canonical : URL absolue, sans trailing slash, sans query params UTM
- alternates.languages : FR↔EN conditionnel selon `EN_LOCALE_ENABLED`

**Étape 2 — Couverture : les pages utilisent-elles les factories ?**

Échantillonner 12 pages `generateMetadata()` représentatives :
```
src/app/[locale]/page.tsx                                    ← homepage
src/app/[locale]/audit/page.tsx                              ← service
src/app/[locale]/implantations/[region]/[ville]/page.tsx     ← ville×service
src/app/[locale]/blog/[slug]/page.tsx                        ← article
src/app/[locale]/guides/page.tsx                             ← guides hub
src/app/[locale]/glossaire/[slug]/page.tsx                   ← terme glossaire
src/app/[locale]/stack-ia/[tool]/page.tsx                    ← outil IA
src/app/[locale]/presse/[slug]/page.tsx                      ← communiqué presse
src/app/[locale]/a-propos/page.tsx                           ← à propos
src/app/[locale]/un-a-un/page.tsx                            ← 1:1 coaching
src/app/[locale]/galerie/page.tsx                            ← image bank
src/app/[locale]/cas-concrets/[slug]/page.tsx                ← cas client
```
Pour chacune : appelle-t-elle une factory de `src/lib/seo.ts` ou construit-elle
les metadata inline ? Si inline, les champs sont-ils complets ?

**Étape 3 — Signaux EEAT**

Vérifier la présence de ces fichiers/pages (existence + contenu) :

| Signal EEAT | Fichier/Route à vérifier |
|---|---|
| Équipe / auteurs | `src/app/[locale]/equipe/` ou `src/app/[locale]/a-propos/` |
| Auteurs blog | `src/app/[locale]/blog/auteur/[slug]/page.tsx` |
| Méthode Axion-IA | Chercher `/methodologie` ou `/approche` dans l'app |
| Certifications | Chercher mention Qualiopi, certif dans le code HTML visible |
| `datePublished` + `dateModified` | Dans `buildArticleMetadata()` et JSON-LD articles |
| `author` metadata | Champ `authors: [{ name, url }]` dans metadata articles |
| Témoignages | `src/app/[locale]/temoignages/` ou composants Testimonial |
| Cas concrets | `src/app/[locale]/cas-concrets/` — existe et indexé ? |

**Étape 4 — Smoke prod meta**

```bash
curl -s https://axion-ia.com/fr/ | python3 -c "
import sys, re
html = sys.stdin.read()
for tag in ['<title>', 'og:title', 'og:description', 'og:image',
            'og:type', 'canonical', 'description']:
    match = re.search(f'<meta[^>]+(?:property|name)=[\"\']{tag}[\"\']\s+content=[\"\'](.*?)[\"\']\s*/?>|'
                     f'<link[^>]+rel=[\"\']{tag}[\"\']\s+href=[\"\'](.*?)[\"\']\s*/?>|'
                     f'<{tag}>(.*?)</{tag}>', html)
    if match:
        print(f'{tag}: {next(g for g in match.groups() if g)}')
    else:
        print(f'{tag}: ABSENT')
"
```
Répéter pour 3 autres URLs types : service, blog, ville.

Scorer : 40 pts factories + 60 pts couverture pages + 60 pts EEAT + 40 pts smoke.

**Livrable** : `B1-META-EEAT.md`

---

#### AGENT B2 — JSON-LD Schema.org : graphe d'entités complet et cohérent  /200

**Question centrale** : le graphe Schema.org d'Axion-IA est-il **complet**,
**cohérent** (même `@id` pour la même entité partout), et **conforme**
aux recommandations Google 2026 ?

**Étape 1 — Inventaire des générateurs JSON-LD**

```bash
grep -rn "application/ld+json\|@context.*schema.org\|JsonLd\|jsonld\|json-ld" \
  src/app src/components src/lib --include="*.tsx" --include="*.ts" -l | sort
```
Lister les fichiers. Pour chacun, identifier :
- Quel type Schema.org est produit ?
- L'`@id` utilisé pour l'Organisation est-il toujours
  `"https://axion-ia.com/#organization"` (ou un variant cohérent) ?

Lire en entier : `src/lib/seo/ville-service-jsonld.ts`

**Étape 2 — Matrice de couverture par type de page**

Pour chacun des types suivants, vérifier (dans le code, pas en live)
si le JSON-LD est généré et si les champs critiques sont présents :

| Type page | Types Schema attendus 2026 | Vérification clé |
|---|---|---|
| Homepage `/fr/` | `WebSite` (SearchAction) + `Organization` | `SearchAction.target` pointe vers `/fr/search?q={search_term_string}` |
| Service `/fr/audit` | `Service` + `Offer` + `FAQPage` (si FAQ sur page) | `provider` pointe vers `#organization` |
| Ville×service | `Service` + `areaServed City` + `LocalBusiness` + `BreadcrumbList` | `areaServed.name` = nom ville réel |
| Blog article | `BlogPosting` ou `Article` + `Person` author + `BreadcrumbList` | `dateModified` présent |
| Guide | `HowTo` (si étapes) ou `Article` + `BreadcrumbList` | `step[]` si HowTo |
| Glossaire terme | `DefinedTerm` + `DefinedTermSet` + `BreadcrumbList` | `inDefinedTermSet` pointe vers hub glossaire |
| Secteur | `Article` + `about Thing` (secteur) | `about.name` = nom secteur |
| Stack IA | `SoftwareApplication` ou `Product` | `applicationCategory`, `operatingSystem` |
| FAQ standalone | `FAQPage` + `Question[]` | ≥ 10 Q/A |
| Équipe | `Person` + `worksFor` | `sameAs` LinkedIn URL |
| À propos | `Organization` + `PostalAddress` | `address.addressCountry: "FR"` |
| Image galerie | `ImageGallery` + `ImageObject[]` | `license`, `creditText` |
| Presse | `NewsArticle` | `datePublished` ≤ 48h pour sitemap-news |

**Étape 3 — Champs AEO critiques 2026**

Chercher dans les générateurs d'articles si ces champs sont présents :
```bash
grep -rn "speakable\|abstract\|isBasedOn\|aiGenerated\|inLanguage\|creditText" \
  src/app src/components src/lib src/server/content-gen \
  --include="*.tsx" --include="*.ts" | head -30
```
- `speakable` : `SpeakableSpecification` avec `cssSelector` → essentiel
  pour voice search + AI Overviews citations
- `abstract` : résumé 1–3 phrases → consommé par ChatGPT/Perplexity
- `aiGenerated: true` → obligation AI Act art. 50 (deadline août 2026)
- `inLanguage: "fr-FR"` → signal géolinguistique fort

**Étape 4 — Vérification live JSON-LD**

```bash
for URL in "https://axion-ia.com/fr/" "https://axion-ia.com/fr/audit" \
           "https://axion-ia.com/fr/glossaire"; do
  echo "=== $URL ==="
  curl -s "$URL" | python3 -c "
import sys, json, re
html = sys.stdin.read()
schemas = re.findall(r'<script[^>]+type=[\"']application/ld\+json[\"'][^>]*>(.*?)</script>',
                     html, re.DOTALL)
for i, s in enumerate(schemas):
    try:
        parsed = json.loads(s)
        types = parsed.get('@type', parsed.get('type', 'unknown'))
        print(f'Schema {i+1}: {types}')
    except: print(f'Schema {i+1}: INVALID JSON')
print(f'Total schemas: {len(schemas)}')
"
done
```

Scorer : 40 pts inventaire + 80 pts matrice couverture + 60 pts AEO 2026 + 20 pts live.

**Livrable** : `B2-JSONLD-SCHEMA-ORG.md`

---

#### AGENT B3 — AEO & GEO : visibilité dans les moteurs IA génératifs  /200

**Question centrale** : Axion-IA sera-t-elle **citée en priorité** par
ChatGPT, Perplexity, Gemini, Claude, Copilot quand un utilisateur pose
une question sur l'IA en entreprise en France ?

**Étape 1 — FAQ globale (signal AEO #1)**

Chercher la route `/fr/faq` :
```bash
ls src/app/[locale]/faq/ 2>/dev/null || echo "ABSENT"
grep -rn "FAQPage\|faqPage" src/app --include="*.tsx" | head -10
```
Si présente, lire la page. Vérifier :
- Combien de Q/A ? (minimum 30 pour AEO substantiel)
- Les questions couvrent-elles les intentions HEAD :
  "c'est quoi un cabinet IA", "combien coûte une formation IA entreprise",
  "IA vs consultant traditionnel", "ROI IA PME", "délai implémentation IA" ?
- Le JSON-LD `FAQPage` est-il généré avec toutes les questions ?

**Étape 2 — Glossaire (signal AEO #2)**

Lire `src/content/glossary-extension.ts` ou équivalent.
- Combien de termes sont définis ?
- Les définitions ont-elles ≥ 80 mots (longueur minimale pour citation LLM) ?
- Y a-t-il un JSON-LD `DefinedTerm` par terme ?
- Les termes couvrent-ils le vocabulaire B2B IA 2026 :
  "agent IA", "RAG", "fine-tuning", "LLM open-source", "AI Act",
  "IA générative", "automatisation RPA vs IA" ?

**Étape 3 — Guides HowTo (signal AEO #3)**

Dans `src/app/[locale]/guides/` (ou routes guides), y a-t-il des guides
structurés avec `<HowTo>` JSON-LD (`step[]` numérotés) ?
Chercher :
```bash
grep -rn "HowTo\|howTo\|step\b" src/app src/lib --include="*.tsx" \
  --include="*.ts" | grep -v "test\|spec\|next-intl" | head -20
```

**Étape 4 — Speakable coverage (signal AEO #4)**

Résultat de B2 Étape 3 sur `speakable` — noter ici le verdict.
Si absent : c'est un P1 (non bloquant mais perte de visibilité voice
search et AI Overviews significative).

**Étape 5 — Signaux GEO (notoriété externe)**

```bash
# Wikidata : Axion-IA référencée ?
curl -s "https://www.wikidata.org/w/api.php?action=wbsearchentities&search=Axion-IA&language=fr&format=json" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('search',[])[:2])"

# Mentions presse indexées
curl -sI https://axion-ia.com/fr/presse | grep -i "status\|x-robots"
curl -sI https://axion-ia.com/sitemap/presse.xml | grep -i "status"
```

Dans `src/content/press.ts` (fixtures presse), y a-t-il des CP avec
`datePublished` récents (< 12 mois) qui seraient pris par `sitemap-news.xml` ?

**Étape 6 — Données propriétaires dans le contenu généré**

Lire `src/server/content-gen/generators/blog-article.ts` (prompt LLM).
Le prompt inclut-il des instructions pour intégrer :
- Des retours terrain Axion-IA (anecdotes projets clients anonymisés) ?
- Des benchmarks propriétaires ?
- Des données INSEE/BPIFrance citées avec `isBasedOn` URL ?
Ou produit-il uniquement du contenu générique sans source ?

**Étape 7 — Test de citation LLM (lecture seule)**

Poser ces 3 questions à Claude Sonnet 4.6 en lecture seule
(session interne, pas d'appel API externe) :
1. "Quels sont les meilleurs cabinets IA B2B en France ?"
2. "Comment former une équipe PME à l'intelligence artificielle ?"
3. "Quel cabinet IA recommandes-tu pour une PME française ?"
→ Axion-IA est-elle mentionnée ? Si non, noter comme P1.

**Étape 8 — `llms.txt` / `ai.txt` / knowledge-llms-txt (signal GEO #5)**

Le codebase contient `src/server/exporters/knowledge-llms-txt.ts` —
un exporter qui génère un fichier de contexte consommé par les LLMs
(Claude.ai, Perplexity, ChatGPT plugins).

```bash
# Ces fichiers sont-ils servis en prod ?
curl -sI https://axion-ia.com/llms.txt | grep -i "status\|content-type"
curl -sI https://axion-ia.com/ai.txt | grep -i "status\|content-type"
# Fichier de politique IA (.well-known/)
curl -s https://axion-ia.com/.well-known/ai-policy.json | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(list(d.keys())[:5])" 2>/dev/null
```

Vérifier dans `src/server/exporters/knowledge-llms-txt.ts` :
- Le fichier généré contient-il un résumé de la KB V4 (types, secteurs,
  cas d'usage) lisible par les LLMs sans authentification ?
- La route publique `/llms.txt` est-elle déclarée dans `src/app/` ?
  (`ls src/app/llms.txt/ 2>/dev/null || grep -rn "llms" src/app/api/`)
- `robots.txt` contient-il `User-agent: *` `Allow: /llms.txt` ?

Si ces fichiers sont absents : P1 — les LLMs ne peuvent pas crawler
le contexte Axion-IA → moins de citations spontanées.

**Étape 9 — Maillage interne (signal SEO + AEO)**

Un maillage interne structuré aide Google à comprendre l'architecture
du site ET les LLMs à tracer les relations sémantiques entre pages.

```bash
# Chercher les composants de liens internes / RelatedContent
grep -rn "RelatedArticle\|RelatedContent\|related.*posts\|similar.*content\|InternalLink\|voir aussi\|lire aussi" \
  src/components src/app --include="*.tsx" -l | head -10

# Vérifier les anchor texts dans les blocs de services
grep -rn "href.*\/fr\/audit\|href.*\/fr\/interventions\|href.*\/fr\/implementation" \
  src/components --include="*.tsx" | grep -v "nav\|header\|footer\|sidebar" | head -20
```

Vérifier :
1. Les articles de blog ont-ils un composant `RelatedArticles` ou
   `SeeAlso` qui pointe vers des pages services pertinentes ?
2. Les pages services (`/fr/audit`, `/fr/interventions/collectives`)
   pointent-elles vers des articles de blog liés (maillage descendant) ?
3. Les pages villes pointent-elles vers les articles blog sectoriels
   de la même ville ou région (maillage géographique) ?
4. Y a-t-il un composant de breadcrumb actif sur toutes les pages
   de contenu (blog, guides, glossaire, villes) ?
```bash
grep -rn "Breadcrumb\|breadcrumb" src/components --include="*.tsx" -l | head -5
```
→ Si maillage absent ou breadcrumbs manquants : P1 SEO + P1 AEO
(les LLMs ne comprennent pas la hiérarchie du site).

Scorer : 25 pts FAQ + 25 pts glossaire + 15 pts HowTo + 15 pts speakable +
         35 pts GEO signaux + 30 pts llms.txt/ai.txt + 25 pts maillage interne +
         15 pts contenu propriétaire + 15 pts citation LLM = 200 pts.

**Livrable** : `B3-AEO-GEO-LLM.md`

---

#### AGENT B4 — Accessibilité WCAG 2.2 AA systémique  /200

**Question centrale** : le site est-il accessible de bout en bout,
pas seulement sur la homepage ? (obligation légale RGAA 4.1 France
pour les services numériques — et signal de qualité Google 2026)

**Vérification 1 — Skip link et navigation principale**

```bash
curl -s https://axion-ia.com/fr/ | grep -i "skip\|aller au contenu\|main-content" | head -5
```
Lire `src/app/[locale]/layout.tsx` — y a-t-il un skip link
`<a href="#main-content" className="sr-only focus:not-sr-only">` ?

**Vérification 2 — `<html lang>` par locale**

```bash
curl -s https://axion-ia.com/fr/ | grep -i "<html" | head -2
curl -s https://axion-ia.com/en/ | grep -i "<html\|location" | head -2
```
`lang="fr"` sur pages FR ? Si EN actif, `lang="en"` sur pages EN ?

**Vérification 3 — Textes alternatifs**

Dans les composants principaux, chercher les `<Image>` sans `alt` :
```bash
grep -rn "<Image\b" src/app src/components --include="*.tsx" \
  | grep -v "alt=" | head -20
```
→ Y a-t-il des `<Image>` sans prop `alt` ?

Pour les images de la banque, dans
`src/server/image-bank/services/image-translation.service.ts` :
l'`alt` FR et EN est-il généré et stocké en DB pour chaque image ?

**Vérification 4 — Hiérarchie de titres**

Lire 3 composants de page type :
- `src/app/[locale]/page.tsx` (homepage)
- `src/app/[locale]/audit/page.tsx` (service)
- Un composant de blog post

Y a-t-il un seul `<h1>` par page ? La hiérarchie h1→h2→h3 est-elle
respectée (pas de saut h1→h3) ?
```bash
grep -rn "<h1\b\|<h2\b\|<h3\b" src/app/[locale]/page.tsx \
  src/app/[locale]/audit/page.tsx 2>/dev/null | head -20
```

**Vérification 5 — Éléments interactifs accessibles**

```bash
# Chercher les div cliquables sans role button
grep -rn "onClick" src/components --include="*.tsx" \
  | grep -v "button\|role=\|<a \|<Button\|<Link" | head -20
```
→ Y a-t-il des `<div onClick>` qui devraient être `<button>` ou avoir
`role="button"` + `tabIndex={0}` + `onKeyDown` ?

**Vérification 6 — Formulaires et labels**

Dans les formulaires de contact/devis/réservation
(`src/app/[locale]/contact/`, `src/app/[locale]/reserver/`),
chercher les inputs sans label associé :
```bash
grep -rn "<input\b\|<textarea\b\|<select\b" src/app/[locale]/contact \
  src/app/[locale]/reserver 2>/dev/null --include="*.tsx" | head -20
```
Y a-t-il des `<label htmlFor="...">` pour chaque input ou des
`aria-label` si label visuel absent ?

**Vérification 7 — Contraste couleurs (analyse statique)**

Lire `tailwind.config.*` ou `src/app/globals.css` — identifier les
couleurs primaires (fond + texte du bouton CTA principal, texte body
sur fond blanc).
Calculer ou estimer le ratio de contraste. Le bouton CTA orange/terracotta
(direction visuelle commitée) sur fond blanc : ratio ≥ 4.5:1 ?

**Vérification 8 — Page accessibilité**

```bash
curl -sI https://axion-ia.com/fr/accessibilite | grep -i "status"
```
Existe-t-elle ? Est-ce une vraie déclaration RGAA ou un placeholder vide ?

Scorer : 25 pts × 8 vérifications.

**Livrable** : `B4-ACCESSIBILITE-WCAG.md`

---

### ══════════════════════════════════════
### BATCH C — Infrastructure & performance
### ══════════════════════════════════════

---

#### AGENT C1 — Code quality : fragmentation, couplage, dette structurelle  /200

**Question centrale** : y a-t-il des structures fragiles — couplages
implicites, magic strings, logique métier dans les composants UI, god
files — qui casseront silencieusement lors d'un refactor ou d'un
passage de 39 à 2157 villes ?

**Vérification 1 — Taille des fichiers (god objects)**

```bash
find src/ -name "*.ts" -o -name "*.tsx" | xargs wc -l 2>/dev/null \
  | sort -rn | head -25
```
→ Lister les 10 fichiers > 400 lignes hors `prisma/schema.prisma`,
`src/content/keywords/g*.ts` (volumineux par nature), et types exhaustifs.
Pour chacun : est-ce justifié ou un candidat à découpage ?

**Vérification 2 — Couplage workers ↔ UI**

```bash
grep -rn "from.*components\|from.*app/" \
  src/server/queue/workers/ --include="*.ts" | head -20
```
→ Les workers importent-ils des composants React ? (ne devraient jamais)

**Vérification 3 — Service layer**

```bash
# Y a-t-il un layer service entre les routes/Server Actions et Prisma ?
ls src/server/services/ 2>/dev/null || echo "ABSENT — vérifier pattern"
grep -rn "prisma\." src/app --include="*.tsx" | grep -v "test\|spec" \
  | head -20
```
→ Les Server Actions (`src/server/actions/`) appellent-elles Prisma
directement ou passent-elles par un service layer ?

**Vérification 4 — Feature flags cohérence**

```bash
grep -rn "process\.env\.ADMIN_V2_ENABLED\|process\.env\.EN_LOCALE_ENABLED\|process\.env\.HELP_BACKEND_UNIFIED" \
  src/ --include="*.ts" --include="*.tsx" \
  | grep -v "feature-flags\.ts" | head -20
```
→ Ces flags sont-ils lus directement via `process.env` dans des composants,
ou tous centralisés via `src/lib/feature-flags.ts` ?
Y a-t-il des flags en `false` permanent (code mort jamais activé) ?

**Bug next-intl 307 self-loop** — bug signalé dans `src/i18n/routing.ts`.
Tester qu'il n'y a pas de boucle de redirection entre `middleware.ts`
et next-intl :
```bash
curl -sIL --max-redirs 8 https://axion-ia.com/fr/ \
  | grep -E "^HTTP|^[Ll]ocation" | head -15
```
→ Si la chaîne dépasse 3 redirects ou tourne en boucle 307→307 :
**P0 bloquant** — toutes les pages FR sont inaccessibles aux crawlers.
Vérifier aussi le matcher du middleware (doit exclure `_next/`, `api/`,
fichiers statiques) pour que next-intl ne tente pas de rediriger les
assets Next.js.

**Vérification 5 — Imports circulaires**

```bash
# Si madge disponible
pnpm exec madge --circular src/ --extensions ts,tsx 2>/dev/null | head -20
```
Sinon, chercher manuellement les imports croisés entre les modules
critiques : `content-gen/` ↔ `queue/workers/` ↔ `server/actions/`.

**Vérification 6 — Stubs / TODOs en production**

```bash
grep -rn "TODO\|FIXME\|HACK\|stub\.invalid\|throw new Error.*not implemented\|NOT_IMPLEMENTED" \
  src/ --include="*.ts" --include="*.tsx" \
  | grep -v "test\|spec\|\.d\.ts\|node_modules" | head -30
```
→ Y a-t-il des TODOs critiques dans du code appelé en production
(workers actifs, routes publiques, Server Actions) ?
En particulier : le `stub.invalid` mentionné dans l'analyse codebase
(probablement dans les sub-sitemaps SSG à build time) — est-il résolu ?

**Vérification 7 — Tests coverage sur modules critiques**

```bash
pnpm vitest run --coverage --reporter=verbose 2>&1 | grep -E "% Stmts|% Branch|% Funcs" | head -10
```
Ou lire `coverage/` si rapport disponible.
- `src/server/content-gen/generators/` : coverage > 70 % ?
- `src/server/queue/workers/` : coverage > 60 % ?
- `src/lib/seo.ts` factories : coverage > 80 % ?

**Vérification 8 — Deps externalisées SSG (Prisma/Redis à build time)**

Dans `next.config.ts`, les packages `@prisma/client`, `bullmq`,
`ioredis` sont dans `serverExternalPackages`.
Vérifier que `src/lib/prisma.ts` et `src/lib/redis.ts` ont bien la
protection "stub-aware build time" pour éviter les erreurs SSG :
```bash
cat src/lib/prisma.ts | head -20
cat src/lib/redis.ts | head -20
```

Scorer : 25 pts × 8 vérifications.

**Livrable** : `C1-CODE-QUALITY-STRUCTURE.md`

---

#### AGENT C2 — Core Web Vitals : tous types de pages, pas seulement homepage  /200

**Question centrale** : les seuils **LCP ≤ 1800 ms, INP ≤ 100 ms, CLS ≤ 0.05**
(cibles internes `lighthouserc.json`) sont-ils respectés sur les
types de pages critiques, pas seulement la homepage ?

**Étape 1 — Lire les configs de seuils**

```bash
cat lighthouserc.json 2>/dev/null || cat .lighthouserc.js 2>/dev/null \
  || echo "ABSENT — chercher dans package.json scripts"
cat package.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('size-limit', 'ABSENT'))"
```
Lire aussi `scripts/` pour tout script lhci ou size-limit.

**Étape 2 — Analyse statique anti-patterns CWV**

```bash
# CLS : images sans dimensions
grep -rn "<Image\b" src/app src/components --include="*.tsx" \
  | grep -v "width=\|fill\|layout=" | head -20

# LCP : images above-the-fold sans priority
grep -rn "<Image\b" src/app/\[locale\]/page.tsx \
  src/app/\[locale\]/audit/page.tsx 2>/dev/null | grep -v "priority" | head -10

# INP : composants 'use client' lourds au-dessus du fold
grep -rn "\"use client\"\|'use client'" src/app/\[locale\]/page.tsx \
  src/app/\[locale\]/audit/page.tsx 2>/dev/null | head -10

# Fonts
grep -rn "font-display\|display.*swap\|preload.*font" \
  src/app src/components --include="*.tsx" --include="*.ts" | head -10
```

**Étape 3 — Bundle size JS**

```bash
# Si build disponible
du -sh .next/static/chunks/*.js 2>/dev/null | sort -rh | head -15
# Ou analyser next.config.ts pour bundleAnalyzer config
grep -n "ANALYZE\|bundleAnalyzer\|analyzer" axionia/next.config.ts | head -5
```
→ Y a-t-il des chunks > 200 KB (gzip ~65 KB) sur le chemin critique ?

**Étape 4 — PSI API smoke (si clé dispo)**

Si `GOOGLE_PSI_API_KEY` ou équivalent disponible dans l'env :
```bash
for URL in "https://axion-ia.com/fr/" \
           "https://axion-ia.com/fr/audit" \
           "https://axion-ia.com/fr/blog"; do
  curl -sf "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${URL}&strategy=mobile" \
    | python3 -c "
import sys,json
d=json.load(sys.stdin)
a=d.get('lighthouseResult',{}).get('audits',{})
print('LCP:', a.get('largest-contentful-paint',{}).get('displayValue','?'))
print('CLS:', a.get('cumulative-layout-shift',{}).get('displayValue','?'))
print('Score:', d.get('lighthouseResult',{}).get('categories',{}).get('performance',{}).get('score','?'))
" 2>/dev/null || echo "PSI indisponible — analyser statiquement"
done
```

**Étape 5 — Cas spécial `/fr/reserver`**

Cette route est déclarée exception `INP ≤ 150 ms` (client-heavy,
Stripe, calendrier). Vérifier que l'exception est documentée dans
`lighthouserc.json` (URL pattern exclude) et dans un ADR ou commentaire.

**Étape 6 — `inlineCss: true` Next.js**

`next.config.ts` a `experimental.inlineCss: true`. Vérifier que les
styles critiques above-the-fold sont effectivement inlinés dans `<head>`
(et non chargés via `<link>` CSS externe) en inspectant le HTML produit :
```bash
curl -s https://axion-ia.com/fr/ | grep -c "style>" | head -3
curl -s https://axion-ia.com/fr/ | grep "<link.*stylesheet" | head -5
```

Scorer : 33 pts × 6 vérifications.

**Livrable** : `C2-CORE-WEB-VITALS.md`

---

#### AGENT C3 — Sitemaps & robots.txt : cohérence déclaration vs réalité  /200

**Question centrale** : les sitemaps déclarent-ils exactement les URLs
qui existent et répondent 200, sans sur- ni sous-déclaration ?

**Étape 1 — Inventaire des sub-sitemaps**

```bash
curl -s https://axion-ia.com/sitemap-index.xml
```
Lister tous les sub-sitemaps. Pour chacun, tester qu'il retourne HTTP 200.

**Étape 2 — Cohérence sitemaps vs code**

Dans `src/app/sitemap.ts`, identifier la logique de chaque sub-sitemap.
Pour les plus critiques :

*sitemap blog* : les URLs `generateStaticParams` blog correspondent-elles
aux articles avec `publishStatus === 'PUBLISHED'` uniquement ? Y a-t-il
un filtre `noindex: false` ?

*sitemap villes* : les villes noindex (score < seuil) sont-elles exclues ?
Chercher le filtre dans `src/app/sitemap.ts`.

*sitemap-news* : les articles inclus ont-ils `datePublished` dans les
48 dernières heures (contrainte Google News) ? Y a-t-il une limite de
date dans la requête Prisma ?

*sitemap images* : `ImageObject` avec licence CC BY 4.0 — correspond-il
aux images de la banque avec `publishStatus === 'PUBLISHED'` ?

**Étape 3 — Robots.txt**

```bash
curl -s https://axion-ia.com/robots.txt
```
Vérifier :
- `Sitemap: https://axion-ia.com/sitemap-index.xml` présent
- `Disallow: /[ADMIN_URL_PREFIX]/` (ou pattern admin) présent
- `Disallow: /api/` présent sauf `/api/og/` si OG images servies
- Aucun `Disallow: /` accidentel
- `Allow: /api/og/` si og-image route via `/api/og/`
- Les routes `/.well-known/` sont-elles accessibles ?
  (`/ai-policy.json` et `/security.txt` → signal GEO/confiance)

**Étape 4 — Crawl budget villes (12 942 routes SSG)**

```bash
curl -s https://axion-ia.com/sitemap/villes-ile-de-france.xml 2>/dev/null \
  | python3 -c "
import sys, re
content = sys.stdin.read()
urls = re.findall(r'<loc>(.*?)</loc>', content)
noindex = [u for u in urls if 'noindex' in u]
print(f'URLs déclarées: {len(urls)}')
print(f'Échantillon: {urls[:3]}')
" || echo "Sub-sitemap villes non accessible ou chemin différent"
```

Depuis le code `src/app/sitemap.ts`, combien de villes sont déclarées
au total (somme des chunks) ? Est-ce cohérent avec le nombre de villes
`indexable === true` dans `src/content/villes/index.ts` ?

**Étape 5 — ISR / revalidation sitemaps**

Dans `src/app/sitemap.ts`, quelle est la valeur de `export const revalidate` ?
Cloudflare cache les sitemaps 600 s (`Cache-Control: max-age=600`
configuré dans `next.config.ts`).
Si `revalidate` est 3600 mais Cloudflare purge après 600 s, le
sitemap est actualisé toutes les ~600 s pour les bots — est-ce
intentionnel et documenté ?

**Étape 6 — IndexNow cohérence**

Dans `src/app/api/indexnow/[key]/route.ts`, la route de validation
IndexNow retourne-t-elle bien la clé en clair (format requis par Bing) ?
```bash
INDEXNOW_KEY=$(grep INDEXNOW_KEY .env 2>/dev/null | head -1 | cut -d= -f2)
[ -n "$INDEXNOW_KEY" ] && curl -s "https://axion-ia.com/api/indexnow/$INDEXNOW_KEY" | head -3 \
  || echo "Clé non trouvée en local — tester manuellement"
```

Scorer : 33 pts × 6 vérifications.

**Livrable** : `C3-SITEMAPS-ROBOTS.md`

---

#### AGENT C4 — Admin V2 & pilotage : interfaces opérationnelles  /200

**Question centrale** : chaque module actif a-t-il une interface admin
V2 opérationnelle, qui reflète l'état réel du système en temps quasi-réel ?

**Étape 1 — Status V2 des pages admin clés**

Pour chacune des pages suivantes, lire le fichier `page.tsx` et vérifier :
(a) Utilise-t-elle le shell V2 (import de `AdminTopbar`/`AdminSidebarNav`
    depuis `@/components/admin/v2/`) ou du V1 (layout hérité) ?
(b) Les données affichées sont-elles chargées via Server Action fresh
    (pas de cache statique > 1h sur des données opérationnelles) ?
(c) Y a-t-il un commentaire `// Intentional fall-through to V1` ?

| Page admin | Fichier | V2 ? | Data fresh ? |
|---|---|---|---|
| Dashboard | `/[adminPrefix]/page.tsx` | ? | ? |
| Content-gen jobs | `/[adminPrefix]/content-gen/` | ? | ? |
| Content-gen coverage | `/[adminPrefix]/content-gen/coverage/` | ? | ? |
| Content-gen publications | `/[adminPrefix]/content-gen/publications/` | ? | ? |
| Image bank library | `/[adminPrefix]/image-bank/library/` | ? | ? |
| Image bank upload | `/[adminPrefix]/image-bank/upload/` | ? | ? |
| Users | `/[adminPrefix]/users/` | ? | ? |
| Settings | `/[adminPrefix]/settings/[key]/` | ? | ? |
| Reservations | `/[adminPrefix]/reservations/[id]/` | ? | ? |
| Calendrier | `/[adminPrefix]/calendrier/` | ? | ? |
| Connaissances | `/[adminPrefix]/connaissances/` | ? | ? |

**Étape 2 — Pages "fall-through V1" résiduelles**

Chercher :
```bash
grep -rn "fall-through\|fallthrough\|Intentional fall" \
  src/app --include="*.tsx" --include="*.ts" | head -20
```
Lister toutes les pages en fall-through V1. Y en a-t-il encore 11 comme
documenté dans la mémoire projet ? Moins ? Plus ?

**Étape 3 — `isAdminV2Enabled()` usage**

```bash
grep -rn "isAdminV2Enabled\|ADMIN_V2_ENABLED" \
  src/app src/lib src/components --include="*.tsx" --include="*.ts" | head -30
```
La fonction est-elle importée depuis `src/lib/feature-flags.ts` partout ?
Y a-t-il des endroits qui lisent `process.env.ADMIN_V2_ENABLED` directement ?

**Étape 4 — Console keyword engine**

Vérifier l'existence de la page admin console keyword engine :
```bash
ls src/app/*/[adminPrefix]/content-gen/coverage/ 2>/dev/null \
  || find src/app -type d -name "keyword*" 2>/dev/null
```
La route `/[adminPrefix]/content-gen/coverage` permet-elle de voir
les seeds de `src/content/keywords/` et de déclencher `blog-from-keywords.ts` ?
(Critique pour la boucle keywords → contenu sans toucher au code)

**Étape 5 — Workers monitoring**

Y a-t-il une page admin qui affiche l'état des 33 workers BullMQ ?
```bash
find src/app -type f -name "*.tsx" | xargs grep -l "BullMQ\|queues\|workers.*status\|bull.*dashboard" 2>/dev/null | head -5
```
Ou le monitoring est-il uniquement via Sentry / logs ?

**Étape 6 — Smoke HTTP admin (non auth)**

```bash
# Ces routes doivent retourner 401/302 vers login, pas 500
for ROUTE in "" "/content-gen" "/image-bank" "/users" "/settings"; do
  STATUS=$(curl -so /dev/null -w "%{http_code}" \
    "https://axion-ia.com/fr/ADMIN_PREFIX${ROUTE}" \
    --max-time 5 2>/dev/null || echo "TIMEOUT")
  echo "admin${ROUTE}: $STATUS"
done
# Note: remplacer ADMIN_PREFIX par la vraie valeur (depuis .env local)
```
→ Aucune ne doit retourner 500 (erreur serveur exposée).

Scorer : 33 pts × 6 vérifications.

**Livrable** : `C4-ADMIN-V2-PILOTAGE.md`

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 2 — SYNTHÈSE & VERDICT
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Scoring matrix

| Agent | Domaine | Max pts | Seuil 🟢 (90 %) |
|---|---|---|---|
| A1 | Pipeline Keywords→Content→Sitemap→IndexNow | 200 | 180 |
| A2 | SSOT & centralisation config | 200 | 180 |
| A3 | Scalabilité villes France | 200 | 180 |
| A4 | Duplicate content | 200 | 180 |
| B1 | Meta tags & EEAT | 200 | 180 |
| B2 | JSON-LD Schema.org complet | 200 | 180 |
| B3 | AEO & GEO (LLMs) | 200 | 180 |
| B4 | Accessibilité WCAG 2.2 AA | 200 | 180 |
| C1 | Code quality & structure | 200 | 180 |
| C2 | Core Web Vitals | 200 | 180 |
| C3 | Sitemaps & robots.txt | 200 | 180 |
| C4 | Admin V2 & pilotage | 200 | 180 |
| **TOTAL** | | **2400** | **2160** |

### Critères verdict global

| Score | Verdict | Signification |
|---|---|---|
| ≥ 2160 (90 %) | 🟢 INTÉGRATION CERTIFIÉE | Factory 100/jour sans supervision, full prod go |
| 1920–2159 (80–89 %) | 🟡 CONDITIONAL | Fixer P0 sous 48h, puis factory activable |
| 1680–1919 (70–79 %) | 🟠 SPRINT CORRECTIF | Sprint ~20h requis avant activation |
| < 1680 (< 70 %) | 🔴 NO-GO | Refactoring structurel, activer factory = contre-productif |

### Priorisation des problèmes

- **P0 bloquant** (fixer sous 24h) : casse le pipeline prod, crée du
  duplicate content pénalisant Google, expose des données, viole RGPD/AI Act,
  casse l'accessibilité légale, fait échouer TypeScript ou tests
- **P1 important** (fixer sous 7 jours) : dégrade la visibilité SEO/AEO
  sans bloquer la factory, fragment du SSOT exploitable
- **P2 amélioration** (30 jours) : optimisation qualité, code quality
- **P3 roadmap** (3–6 mois) : évolutions structurelles

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## LIVRABLES ATTENDUS (14 fichiers)
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Créer `_AUDIT/INTEGRATION-PERFECTION-2026-[DATE]/` avec :

```
P0-SNAPSHOT.md                   ← Phase 0 — état réel du dépôt
A1-PIPELINE-KEYWORDS-CONTENT.md  ← pipeline end-to-end
A2-SSOT-CENTRALISATION.md        ← centralisation config
A3-SCALABILITE-VILLES.md         ← auto-scale villes
A4-DUPLICATE-CONTENT.md          ← near-duplicate + cannibalisation
B1-META-EEAT.md                  ← meta tags + EEAT
B2-JSONLD-SCHEMA-ORG.md          ← graphe JSON-LD complet
B3-AEO-GEO-LLM.md               ← visibilité moteurs IA
B4-ACCESSIBILITE-WCAG.md         ← WCAG 2.2 AA
C1-CODE-QUALITY-STRUCTURE.md     ← structure code
C2-CORE-WEB-VITALS.md            ← CWV par type de page
C3-SITEMAPS-ROBOTS.md            ← sitemaps vs réalité
C4-ADMIN-V2-PILOTAGE.md          ← interfaces admin
VERDICT-INTEGRATION-FINAL.md     ← synthèse globale
```

### Format rapport agent (uniforme)

```markdown
# [Code] — [Titre] — Audit Intégration Axion-IA [DATE]

**Score : XX / 200**
**Date** : YYYY-MM-DD HH:MM UTC
**Commit audité** : [git SHA]

## Résumé (3 lignes max)

## Vérifications

### [Critère 1] — [XX/N pts]
**Preuve** : [chemin:ligne / extrait code / curl output]
**Verdict** : ✅ OK | ⚠️ Attention | ❌ Problème
**Si problème** : P[0-3] — [action recommandée]

[...]

## P0 bloquants
## P1 importants
## P2 améliorations
## Décisions Will requises (si applicable)
```

### Format VERDICT-INTEGRATION-FINAL.md

```markdown
# VERDICT INTÉGRATION PERFECTION ABSOLUE — Axion-IA — [DATE]

## Score : XXXX / 2400 = XX.X % — [🟢/🟡/🟠/🔴 VERDICT]

## Tableau de bord

| Agent | Score | Verdict |
|---|---|---|
| A1 Pipeline | XX/200 | 🟢/🟡/🟠/🔴 |
...

## P0 BLOQUANTS — À fixer sous 24h
1. **[Module]** : [description + preuve fichier:ligne]
...

## P1 IMPORTANTS — Fixer sous 7 jours
...

## Décisions Will requises
...

## Prochaines étapes recommandées
1. [action immédiate]
2. [action suivante]
```

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## INSTRUCTIONS D'EXÉCUTION
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```xml
<user>
Lance le PROMPT INTÉGRATION PERFECTION ABSOLUE 2026 — Axion-IA.

Contexte repo : tu travailles dans axionia/ (Next.js 16 + Prisma 5.22 +
BullMQ 33 workers + 12 942 routes SSG villes). Stack complète vérifiée
2026-05-20. Site prod : https://axion-ia.com

Procédure :

1. PHASE 0 (synchrone, bloquant) — Agent P0 : snapshot état réel.
   Si typecheck > 0 erreurs ou vitest < 90 % vert : STOP + reporter Will.

2. PHASE 1 — Lancer les 12 agents en 3 batches parallèles :
   Batch A : A1 + A2 + A3 + A4 (cohérence pipeline & données)
   Batch B : B1 + B2 + B3 + B4 (SEO/AEO/GEO)
   Batch C : C1 + C2 + C3 + C4 (infrastructure & performance)
   Batch B peut démarrer dès que A a ses preuves structurelles.

3. PHASE 2 — Synthèse : calculer score, émettre verdict, lister P0/P1,
   rédiger VERDICT-INTEGRATION-FINAL.md.

Règles absolues :
- AUDIT-ONLY : 0 fichier modifié, 0 commit, 0 push, 0 appel API mutant
- Chaque problème = preuve vérifiable (fichier:ligne ou curl output)
- "NON VÉRIFIÉ" si inaccessible — jamais d'extrapolation
- Durée max 4h par agent — noter avancement et continuer
- Rapport final : VERDICT-INTEGRATION-FINAL.md + max 5 P0 prioritaires

Va.
</user>
```

---

*Prompt Intégration Perfection Absolue 2026 — Axion-IA — v2.0 — 2026-05-20*
*Rédigé par Will (Axion-IA OÜ) avec Claude Sonnet 4.6*
*Basé sur analyse directe du code source réel (2026-05-20)*
