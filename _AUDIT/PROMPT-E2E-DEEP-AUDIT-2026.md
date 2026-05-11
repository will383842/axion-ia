# PROMPT — AUDIT END-TO-END EXTREME DEPTH 2026 — V2 AUTO-PILOT

**Cible** : Axion-IA (`https://axion-ia.com`) — _cabinet IA opérationnel B2B premium_, OÜ estonienne
**Date prompt** : 2026-05-09 (V2)
**Statut prod** : V1 LIVE Hetzner CPX32 + Cloudflare Free + Coolify (auto-deploy GitHub Actions)
**Référence code** : `HEAD` de `main` (origin), worktree `Axion-IA/axionia/`
**Mode** : **AUDIT-ONLY + AUTO-PILOT 1-GATE** — strictement lecture, **aucune écriture** sauf dans `_AUDIT/E2E-2026-05-09/`
**Profondeur** : _extrême_ — chaque fichier, chaque route, chaque flux, chaque raccordement
**Output racine** : `_AUDIT/E2E-2026-05-09/` (créer si absent)

---

## 0. CONTRAT D'EXÉCUTION

Tu es **l'auditeur senior de référence** mandaté par le fondateur (Will, `williamsjullin@gmail.com`). Le site est en production publique. Toute hallucination ou approximation est rejetée.

### 0.1 Doctrine non négociable (intouchables)

- **Naming** : _Axion-IA_ partout (FR + EN), _cabinet IA opérationnel_ (FR) / _operational AI consultancy_ (EN). **Jamais** : agence, studio, atelier, freelance, _AI agency_ (sauf en référence aux concurrents).
- **Couleurs** : Header terracotta figé, logo blanc `m_horizontal_white_2.png`. Anti-hex : aucune couleur hardcodée hors `globals.css` / tokens.
- **Typo** : `titleEm` serif italique, hero cap **88px** (ADR 0007), modular scale 2026.
- **Hero schema** : carré **576×576** lg+ (`.hero-schema`), viewBox SVG **560×560**.
- **Tarifs** : SSOT **`src/content/pricing.ts`**. Aucun montant hardcodé hors ce fichier. Phrases interdites : « pas de plan sur-mesure », « ½ journée », « basé en UE », sizes hors INSEE.
- **pSEO villes** : URL canonique `/fr/implantations/<region>/<ville>` — **jamais** `par-region`. Cap doctrine ≥ 95 % AxionIA-centric / ≤ 5 % data INSEE.
- **Doctrine code = SSOT** : si divergence code-vs-docs, le **code fait foi**, sauf dérive non décidée (à flagger).
- **Pas de Webflow / pas d'IA agency** dans le copy interne.

### 0.2 Anti-hallucination (durci V2)

- Interdiction d'inventer un fichier, route, endpoint, test, commit, sprint.
- Toute affirmation est **citée** : `path/file.ext:LINE` ou `commit <sha>` ou `URL` ou `cmd <commande>` (avec sortie).
- Toute mesure perf provient d'une commande **réellement lancée** ou d'un fichier existant. Sinon : `[NON MESURÉ — raison]`.
- Toute affirmation prod provient d'une réponse HTTP réelle (curl/fetch) ou d'un log file. Sinon : `[NON VÉRIFIÉ EN PROD]`.
- Si tu ne sais pas : `[INCONNU — raison]`. Jamais combler par supposition.
- **Pass B obligatoire** : chaque P0 doit être confirmé par ≥ 2 sources indépendantes (2 agents OU 1 agent + 1 grep code OU 1 agent + 1 curl prod). Sinon dégradé en P1.

### 0.3 Mode AUTO-PILOT 1-GATE (V2)

**Décision Will 2026-05-09** : exécution automatique de bout en bout, **un seul gate final**.

Règles :

- Phases 0 → 4 enchaînées **sans pause** quoi qu'il arrive.
- Décisions par défaut documentées en § 0.6 ci-dessous (aucune ne nécessite Will).
- Phase 5 : verdict calculé.
  - Si verdict 🟢 ou 🟡 → finaliser audit, écrire `WHAT-TO-DO-NOW.md`, terminer.
  - Si verdict 🔴 → **STOP unique** : écrire `🚨-NO-GO-ALERT.md` à la racine `_AUDIT/E2E-2026-05-09/` et attendre Will avant toute action complémentaire.
- En cas de crash agent : marquer l'agent `FAILED` dans `MANIFEST.md`, continuer les autres, rejouer en fin de Phase 2 une seule fois max.

### 0.4 Périmètre

- **TOUT le code source** sous `axionia/` : `src/`, `prisma/`, `scripts/`, `tests/`, `public/`, `docker/`, `Caddyfile`, `Dockerfile*`, `next.config.ts`, `proxy.ts`, `eslint.config.mjs`, `playwright.config.ts`, `lighthouserc.json`, `tsconfig.json`, `.github/`, `package.json`, `pnpm-workspace.yaml`. **Lecture seule de `.env*`** (jamais transcrire en clair).
- **TOUTES les routes** : `app/[locale]/**` + `app/api/**` + fichiers de routage dynamique (`generateStaticParams`, `generateMetadata`, `sitemap.ts`, `robots.ts`, `manifest.ts`, `opengraph-image.tsx`, `apple-icon.tsx`, `icon.tsx`, `llms.txt`, `llms-full.txt`).
- **TOUTE la prod live** (lecture HEAD/sample uniquement) : DNS, headers HTTP, TLS, HTTP/3, CSP, sitemap réel, robots réel, `/api/healthz`.
- **TOUTE la chaîne CI/CD** : `.github/workflows/`, build Docker, déploiement Coolify, snapshots Hetzner, sauvegardes Postgres.
- **TOUS les artefacts SEO/AEO/GEO** : sitemap-index, sitemaps split, hreflang, alternates, canonical, JSON-LD, `llms.txt`, `llms-full.txt`, IndexNow.
- **TOUTE la legal/RGPD** : politique-confidentialite, cookies, mentions-legales, mes-donnees, CGV/CGU, sous-processeurs, DPA register, retention purge cron, GDPR export endpoint, PII redaction Telegram.
- **TOUS les flux fonctionnels** : booking `/reserver`, contact, newsletter, désabonnement, recherche, admin (M9), GDPR-export, healthz, vitals, OG, IndexNow.

### 0.5 Garde-fous robustesse (V2 — durcis)

**Interdits absolus** :

- ❌ Modifier le code applicatif, les configs, les `.env`, les `.github/workflows/`.
- ❌ `git commit`, `git push`, `git tag`, `git stash`, `git clean`, `git reset`.
- ❌ Modifier état distant Cloudflare/Coolify/Hetzner (lecture seule API).
- ❌ Recopier secrets en clair dans les rapports (DSN Sentry, AUTH_SECRET, tokens API, mots de passe).
- ❌ `pnpm dev` (rappel : bug prerender-manifest 500 Windows).
- ❌ Utiliser `--project=firefox` ou `--project=webkit` sur Playwright (chromium uniquement).
- ❌ Lancer Lighthouse direct sur axion-ia.com prod (cf. § 0.6 ci-dessous).

**Scripts à NE JAMAIS lancer pendant l'audit (effets externes / DB)** :

- ❌ `pnpm build` **standard** — déclenche `postbuild` IndexNow + sourcemaps Sentry. Cf. § 0.5bis pour la commande safe.
- ❌ `pnpm villes:import` (`scripts/import-insee-villes.ts`) — réécrit la table villes.
- ❌ `pnpm db:seed`, `pnpm db:reset`, `pnpm db:up`, `pnpm db:down` — touchent la DB.
- ❌ `pnpm prisma:migrate`, `pnpm prisma:generate` (sauf si nécessaire pour typecheck — alors `prisma:generate` OK car non destructif).
- ❌ `scripts/indexnow-ping.ts` direct — ping Bing/Yandex.
- ❌ `scripts/test-email-e2e.ts` — envoie un vrai email Resend.
- ❌ `scripts/seo-audit.ts` si écrit du fichier hors `_AUDIT/E2E-2026-05-09/` (à vérifier avant lancement, sinon skip).
- ❌ `scripts/deploy-prod.sh`, `scripts/generate-prod-secrets.sh`, `scripts/backup-postgres.sh`, `scripts/restore-postgres-test.sh` — opérations infra.

### 0.5bis Build safe (V2.1 — patch postbuild & Sentry)

Pour Phase 4 P-06 LIGHTHOUSE LOCAL, **ne pas lancer** `pnpm build` brut. Utiliser :

```bash
# 1. Désactiver postbuild IndexNow + Sentry release pour ce build d'audit
SENTRY_DISABLE_AUTO_UPLOAD=true \
NEXT_PUBLIC_SENTRY_RELEASE_DISABLE=true \
INDEXNOW_DISABLED=true \
npx --yes next build
# OU si les env vars ci-dessus ne sont pas câblées dans next.config.ts :
# npm_config_ignore_scripts=true pnpm build  ← skip postbuild garanti
```

Si aucune des deux options n'est câblée dans le repo :

- Lire `next.config.ts` pour voir comment Sentry est intégré (`withSentryConfig`).
- Si `withSentryConfig` est conditionnel sur `NODE_ENV` ou flag : utiliser ce flag.
- Sinon : exécuter manuellement `node node_modules/next/dist/bin/next build` avec `--no-postbuild` n'existe pas — basculer sur `npm_config_ignore_scripts=true pnpm build` qui skip strictement le `postbuild`.
- En dernier recours : `[NON MESURÉ — postbuild risk]` et skip P-06 LHCI.

**Tests DB locale** :

- Vérifier dans `vitest.integration.config.ts` et `playwright.config.ts` que `DATABASE_URL` pointe vers une DB de test (`*_test`, `*_e2e`) **avant** de lancer.
- Si `DATABASE_URL` pointe vers la DB dev principale → `[SKIP — DB risk]`, ne pas exécuter `pnpm test:integration` ni `pnpm test:e2e`.

**Port 3000 conflict** :

- Avant `pnpm start` Phase 4 : `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` → si 200/3xx, port pris → `pnpm start --port 3010` ou skip P-06.

**Pré-flight obligatoire (Phase 0)** :

1. Vérifier que chaque `pnpm <script>` cité existe dans `package.json`. Sinon `[SCRIPT MANQUANT]` et fallback équivalent.
2. Vérifier que `node`, `pnpm`, `git`, `curl`, `dig` sont disponibles. Sinon dégrader.
3. Lire `.env.example` pour mapper les variables attendues, **sans lire `.env`**.

**Anti-leak secrets dans rapports** :

- Avant chaque écriture de `.md`, scrubber pour patterns : `sk_live_`, `sk_test_`, `dsn=https://`, `AUTH_SECRET=`, `Bearer eyJ`, `_TOKEN=`, `password=`, `_KEY=`, IP privées RFC1918.
- Si match : remplacer par `[REDACTED-SECRET-<TYPE>]`.

**Timeout & kill-switch** :

- Chaque agent Phase 2 : timeout **90 min** wall-clock. Au-delà : kill, marquer `TIMEOUT`, ne pas bloquer la suite.
- Chaque commande Bash : timeout **10 min** par défaut, **20 min** pour `pnpm build` ou `pnpm test:e2e`.
- En cas de tuile globale (>3 agents `FAILED` ou `TIMEOUT`) : écrire `🚨-AUDIT-DEGRADED.md` et continuer en mode best-effort.

**Idempotence reprise** :

- Avant chaque phase, vérifier si livrable existe déjà. Si oui ET non vide → skip + log dans `MANIFEST.md`.
- `MANIFEST.md` à la racine `_AUDIT/E2E-2026-05-09/` est mis à jour après chaque livrable (timestamp + status).

### 0.6 Décisions par défaut (zéro arbitrage Will requis)

Décidé pour V2 :

| Décision                       | Choix retenu                                                                                                                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Lighthouse**                 | **Local** : `pnpm build && pnpm start` puis `lhci collect` sur `http://localhost:3000` (5 URLs). Pas de hit prod.                                                             |
| **Playwright E2E**             | **Chromium uniquement**, headless, flows : booking, contact, recherche, mega-menu, /reserver, /audit.                                                                         |
| **Curl prod**                  | **HEAD-only** sur **15 routes critiques max**, intervalle 200 ms entre requêtes, User-Agent `AxionIA-Audit/1.0` identifié.                                                    |
| **Auth admin**                 | **Skip avec mention** : routes `(admin)` auditées en code statique uniquement, runtime testé via mocks Playwright. Logger `[ACTION WILL]` pour test live admin si nécessaire. |
| **Search Console / Plausible** | Skip live API, marquer `[ACTION WILL]` dans la checklist.                                                                                                                     |
| **`pnpm test:e2e` flakiness**  | 2 retries autorisés. Si toujours fail → marquer `[FLAKY]` sans bloquer.                                                                                                       |
| **Sitemap volumineux**         | Si > 50 000 URLs : sample 200 random + 50 critiques + 50 villes (FR+EN).                                                                                                      |
| **Reprise crash**              | Reprise depuis `MANIFEST.md` à la phase la plus récente non `DONE`.                                                                                                           |
| **Conflits doctrine vs code**  | Doctrine intouchable § 0.1 prime. Si code dévie : flagger `🚨 DRIFT DOCTRINE` mais **continuer** l'audit jusqu'au bout. Décision Will arrive en synthèse.                     |

---

## 1. ARBORESCENCE LIVRABLES (à créer en début de Phase 0)

```
_AUDIT/E2E-2026-05-09/
├── MANIFEST.md                          ← état d'avancement (updated après chaque livrable)
├── 00-REALITY-CHECK.md
├── 01-INVENTAIRE/
│   ├── CODE.md         + CODE.csv
│   ├── ROUTES.md       + ROUTES.csv
│   ├── APIS.md
│   ├── I18N.md
│   ├── ASSETS.md
│   ├── DB.md
│   ├── TESTS.md
│   └── DOCS.md
├── 02-AGENTS/
│   ├── AGT-01-ARCHITECTURE-DRY.md
│   ├── AGT-02-ROUTES-MAILLAGE.md
│   ├── AGT-03-PERFORMANCE.md
│   ├── AGT-04-SEO.md
│   ├── AGT-05-AEO-GEO.md
│   ├── AGT-06-I18N-HREFLANG.md
│   ├── AGT-07-A11Y.md
│   ├── AGT-08-SECURITE.md
│   ├── AGT-09-RGPD.md
│   ├── AGT-10-API-FORMS.md
│   ├── AGT-11-DB-PRISMA.md
│   ├── AGT-12-INFRA-CICD.md
│   ├── AGT-13-TESTS.md
│   ├── AGT-14-MONITORING-DR.md
│   └── AGT-15-CONTENT-CRO.md
├── 03-RACCORDEMENTS/
│   ├── R-01-PRICING-FLOW.md
│   ├── R-02-SEO-CHAIN.md
│   ├── R-03-I18N-CHAIN.md
│   ├── R-04-AUTH-ADMIN.md
│   ├── R-05-FORMS-CHAIN.md
│   ├── R-06-CACHE-CHAIN.md
│   ├── R-07-RGPD-CHAIN.md
│   ├── R-08-DEPLOY-CHAIN.md
│   ├── R-09-MONITORING-CHAIN.md
│   └── R-10-PSEO-VILLES-CHAIN.md
├── 04-PROD-LIVE/
│   ├── P-01-HEADERS.md
│   ├── P-02-TLS.md
│   ├── P-03-DNS.md
│   ├── P-04-ROBOTS-SITEMAP.md
│   ├── P-05-SEO-LIVE.md
│   ├── P-06-LIGHTHOUSE-LOCAL.md      ← local, pas prod
│   ├── P-07-INDEXATION.md
│   └── P-08-CLOUDFLARE-LIVE.md
├── 05-PASS-B/
│   ├── PASS-B-CROISEMENT-P0.md       ← matrice : chaque P0 doit avoir ≥ 2 sources
│   ├── PASS-B-FAUX-POSITIFS.md       ← findings dégradés/retirés
│   └── PASS-B-COVERAGE.md            ← % de routes / fichiers / endpoints couverts
├── SYNTHESE-FINALE.md                  ← score, verdict, top P0/P1/P2
├── WHAT-TO-DO-NOW.md                   ← actionnable court (≤ 5 p) — fichier autonome
└── 🚨-NO-GO-ALERT.md (conditionnel)    ← uniquement si verdict 🔴
```

`MANIFEST.md` format :

```
| Phase | Livrable | Status | Started | Finished | Notes |
| 0 | 00-REALITY-CHECK.md | DONE | … | … | drift count = 0 |
| 1 | 01-INVENTAIRE/CODE.md | DONE | … | … | 412 fichiers |
| 2 | 02-AGENTS/AGT-03-PERFORMANCE.md | TIMEOUT | … | … | dépassé 90 min, retried OK |
| … |
```

---

## 2. PHASE 0 — REALITY CHECK (~30 min)

Livrable : `_AUDIT/E2E-2026-05-09/00-REALITY-CHECK.md`

1. **Pré-flight** :
   - `node --version`, `pnpm --version`, `git --version`, `curl --version`, `dig` ou `nslookup` dispo ?
   - Liste des `pnpm` scripts présents dans `package.json` vs ceux référencés dans ce prompt → flagger manquants.
   - `git status --short` (pas de fichiers modifiés inattendus).
2. **Git state** : branche, HEAD sha, tag récent, écart `origin/main`, fichiers staged/unstaged/untracked.
3. **Build sanity** : `pnpm typecheck` puis `pnpm lint`. Erreurs/warnings count.
4. **Tests rapide** : `pnpm test` (vitest unit). Count + fails.
5. **Inventaire racine** : count fichiers par dossier-clé.
6. **Inventaire routes brut** : count `page.tsx`, `route.ts`, params dynamiques.
7. **Doctrine snapshots** : extraire valeurs réelles (couleur header, hero cap, hero schema dim, pricing keys, naming dans `messages/{fr,en}.json`).
8. **Prod check rapide** (HEAD only) :
   - `curl -sI https://axion-ia.com/` (status, headers)
   - `curl -s https://axion-ia.com/api/healthz`
   - `curl -sI https://axion-ia.com/sitemap.xml` (status, content-type)
   - `curl -s https://axion-ia.com/robots.txt`
   - `curl -sI https://axion-ia.com/fr/` puis `/en/`
9. **Drift detection** : si divergence sur intouchable (§ 0.1), tag `🚨 DRIFT` en tête, continuer audit (V2 ne stoppe plus ici).
10. **Mise à jour `MANIFEST.md`**.

**Volume** : ≤ 12 pages, factuel, chiffré, cité.

---

## 3. PHASE 1 — INVENTAIRE EXHAUSTIF (~2 h)

Livrable : `_AUDIT/E2E-2026-05-09/01-INVENTAIRE/`

### 3.1 `CODE.md` + `CODE.csv`

Pour **chaque fichier** sous `axionia/src/`, `axionia/prisma/`, `axionia/scripts/`, `axionia/tests/`, `axionia/public/`, racine `axionia/` :

- chemin relatif, LOC, type, `'use client'`, exports clés (default, metadata, generateStaticParams), imports critiques, date dernier touch, auteur, count TODO/FIXME/HACK.

CSV pour permettre tri/filtre downstream.

### 3.2 `ROUTES.md` + `ROUTES.csv`

Chaque route : pathname FR + EN, file path, type rendu (SSG/ISR/SSR/RSC/dynamic/Edge/Node), `dynamic`/`revalidate`/`runtime` exports, `generateStaticParams` cardinalité, `generateMetadata` présent (title/description/hreflang ?), canonical, breadcrumb, JSON-LD attendus, statut prod (HEAD), Speculation Rules `priority`, présence `loading.tsx`/`error.tsx`/`not-found.tsx`.

### 3.3 `APIS.md`

Chaque endpoint `app/api/**` + chaque server action : méthode(s), auth, validation Zod, rate-limit, side-effects, idempotence, errors, exposition publique.

### 3.4 `I18N.md`

- `pnpm i18n:check` output.
- diff complet clés FR vs EN.
- `pathnames` mapping FR ↔ EN dans `i18n/routing.ts`.
- count clés, profondeur max, clés non utilisées.

### 3.5 `ASSETS.md`

`public/` : poids par fichier, format, dimensions image, total weight. Fonts (`next/font` self-hosted vs Google ?). Favicons. OG default + per-page. `manifest.ts`.

### 3.6 `DB.md`

Modèles Prisma : count, relations, indexes, enums, contraintes uniques, migrations history.

### 3.7 `TESTS.md`

Count par type (unit/integration/e2e/schema), coverage si dispo, mocks utilisés.

### 3.8 `DOCS.md`

`_AUDIT/`, `docs/`, `CLAUDE.md`, `AGENTS.md`, `Design.md`, `README.md`, `CHANGELOG.md`, `SESSION_LOG.md`.

---

## 4. PHASE 2 — 15 AGENTS PARALLÈLES (~6-10 h)

**Lance les 15 agents en parallèle** : un seul message tool-call avec 15 invocations `Agent`. Chacun produit **UN seul fichier** sous `02-AGENTS/AGT-XX-<NOM>.md`.

Format obligatoire de chaque rapport :

```markdown
# AGT-XX — <NOM>

## Score : NN/100

## Confiance : haute / moyenne / basse (justifier)

## Top findings

- P0 (bloquant prod / sécu / RGPD)
- P1 (sérieux)
- P2 (confort)

## Détail par sous-chapitre

## Citations (path:line | URL | cmd output)

## [INCONNU] — éléments non vérifiables

## Recommandations (≤ 10, classées effort × impact)

## STOP & ASK consolidés (questions ouvertes pour Will)
```

**Prompt-type d'invocation** (à donner à chaque sous-agent) :

> Tu es l'agent `AGT-XX <NOM>` dans l'audit E2E Axion-IA 2026-05-09. Lis `axionia/_AUDIT/PROMPT-E2E-DEEP-AUDIT-2026.md` § 0 (Doctrine) + § 4 (ton agent). Audite **uniquement** ton périmètre. Écris **uniquement** dans `axionia/_AUDIT/E2E-2026-05-09/02-AGENTS/AGT-XX-<NOM>.md`. Utilise le template ci-dessus. Cite chaque affirmation. Score sur 100. Mode AUDIT-ONLY. Timeout 90 min. Si bloqué, écris `[INCONNU — raison]` et continue. Ne lance ni Lighthouse, ni Playwright, ni curl prod (ce sont les Phases 4 du master). Restitue le fichier final puis termine.

### Liste des 15 agents

| #   | Nom              | Périmètre                                                                                                                                                                          |
| --- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01  | ARCHITECTURE-DRY | SSOT, duplications, abstraction prematurée, couches, RSC vs `'use client'`, `cache()`, server actions                                                                              |
| 02  | ROUTES-MAILLAGE  | nav exhaustivité, breadcrumbs, liens orphelins, prefetch, Speculation Rules, ancrages, 404 internes                                                                                |
| 03  | PERFORMANCE      | LCP/INP/CLS budgets, bundle gz par route, code splitting, images, fonts, Sentry weight, third-parties, Compiler React 19, View Transitions, `next.config.ts`                       |
| 04  | SEO              | titles, descriptions, canonicals, OG, Twitter Card, JSON-LD, robots, sitemaps, hreflang, ratios statuts                                                                            |
| 05  | AEO-GEO          | answer-first patterns, FAQPage, llms.txt/llms-full.txt qualité, E-E-A-T, Place/LocalBusiness pour villes, Bot Fight ON / AI Scrapers OFF (cf. Phase 5 CF)                          |
| 06  | I18N-HREFLANG    | parity FR↔EN, alternates, lang HTML, pathnames mapping, copy non-calque, formats locale, currency                                                                                  |
| 07  | A11Y             | WCAG 2.2 + RGAA 4.1 : contrastes, focus, tab order, ARIA, formulaires, modales, mega-menus, alt, prefers-reduced-motion, tap targets ≥ 24px (SC 2.5.8), focus apparent (SC 2.4.13) |
| 08  | SECURITE         | CSP nonce, HSTS preload, COOP/COEP/CORP, Permissions-Policy, CSRF, rate-limit, secrets, deps audit, JWT revocation, redirects ouverts, dangerouslySetInnerHTML                     |
| 09  | RGPD             | sous-processeurs (Backblaze retiré ?), bannière cookies, mentions légales, GDPR export, retention purge cron, PII Telegram redaction, DPA register, double opt-in, DMA/DSA         |
| 10  | API-FORMS        | Zod input/output, errors typées, next-safe-action, form states, optimistic, HTTP method, CORS, versioning                                                                          |
| 11  | DB-PRISMA        | N+1, indexes, migrations rollback-safe, transactions, soft-delete cohérence, backup tested, pooling, timezone                                                                      |
| 12  | INFRA-CICD       | Caddyfile, Dockerfiles, docker-compose, Coolify healthcheck, GitHub Actions, Cloudflare settings (lecture API), DNSSEC, snapshots Hetzner, monitoring stack                        |
| 13  | TESTS            | coverage par dossier, pages critiques couvertes, E2E flows, mocks vs real DB, snapshots, flakiness                                                                                 |
| 14  | MONITORING-DR    | Sentry config + sourcemaps + PII scrub, /api/vitals, alertes, runbook, backup restore, RTO/RPO, log retention                                                                      |
| 15  | CONTENT-CRO      | copy ton premium FR/EN, anti-jargon, H1/H2/H3, ratio AxionIA-centric ≥ 95% sur 10 villes random + Paris, mots utiles 1500-3000 sur parents, CTA hierarchy, micro-copy              |

---

## 5. PHASE 3 — RACCORDEMENTS CROSS-CUTTING (~3 h)

Livrable : `_AUDIT/E2E-2026-05-09/03-RACCORDEMENTS/`

10 fichiers `R-XX-*.md` ≤ 4 pages chacun, **diagrammes ASCII** pour les flux, citations obligatoires.

| #   | Chaîne            | Trace                                                                                                                                                                       |
| --- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01  | PRICING-FLOW      | `pricing.ts` → helpers → composants → pages `/interventions/*` → CTA `/reserver` → server action → email Resend → DB                                                        |
| 02  | SEO-CHAIN         | `lib/seo/*` → `generateMetadata` → `<head>` rendu prod → `sitemap.ts` → IndexNow postbuild → couverture Search Console                                                      |
| 03  | I18N-CHAIN        | `messages/*.json` → `i18n/routing.ts` `pathnames` → `getPathname` → mega-menu → Footer → sitemap → hreflang                                                                 |
| 04  | AUTH-ADMIN        | `auth.ts` → middleware → routes `(admin)` → `ADMIN_URL_PREFIX` → leak-check sitemap/robots/JSON-LD/llms.txt                                                                 |
| 05  | FORMS-CHAIN       | `/reserver`, `/contact`, newsletter : input → Zod → server action → Prisma → Resend → Telegram (PII redacted Sprint 24.1) → return UI ; rate-limit + idempotence            |
| 06  | CACHE-CHAIN       | `revalidate` per route → `Cache-Control` headers → CF Cache Rules (5 règles Phase 5) → invalidation post-deploy → purge auto GH Actions                                     |
| 07  | RGPD-CHAIN        | consent banner → cookie storage → analytics conditionnel → server tracking → DB user → export endpoint → erase endpoint → retention cron → DPA                              |
| 08  | DEPLOY-CHAIN      | push main → GH Actions `deploy-coolify.yml` → Coolify API → Docker build → swap → healthcheck → smoke → rollback path ; lint/test fail bloque                               |
| 09  | MONITORING-CHAIN  | erreur → Sentry → règle alerte → notif Telegram/email → runbook référencé → résolution → post-mortem                                                                        |
| 10  | PSEO-VILLES-CHAIN | INSEE import → 2157 villes → templates → ratio 95/5 → tier classification → maillage interne → sitemap split → indexation ; vérif ratio sur 10 villes random + Paris pilote |

---

## 6. PHASE 4 — VÉRIFICATIONS RUNTIME (~2 h, sécurisées)

Livrable : `_AUDIT/E2E-2026-05-09/04-PROD-LIVE/`

### P-01 HEADERS (15 routes critiques, HEAD only)

Routes : `/`, `/audit`, `/interventions`, `/interventions/essentielle`, `/reserver`, `/contact`, `/blog`, `/comparaisons`, `/methodologie`, `/cas-concrets`, `/centre-aide`, `/faq`, `/glossaire`, `/presse`, `/stack-ia`, `/implantations/ile-de-france/paris`, `/api/healthz`, `/sitemap.xml`, `/robots.txt`, `/llms.txt`, `/llms-full.txt`, `/manifest.webmanifest` (FR + EN où applicable).

Pour chacune : status, content-type, cache-control, cf-cache-status, content-encoding (br ?), content-language, link rel="alternate", x-frame-options/frame-ancestors, HSTS, CSP raw, referrer-policy, permissions-policy, x-content-type-options, COOP/COEP/CORP.

Tableau Markdown. Intervalle **200 ms** entre requêtes. UA `AxionIA-Audit/1.0`.

### P-02 TLS

TLS 1.2 min / 1.3 préférée. Ciphers. HSTS preload status (`hstspreload.org`). Cert issuer + expiration. Via `openssl s_client -connect axion-ia.com:443 -servername axion-ia.com` (lecture seule).

### P-03 DNS

A/AAAA, CNAME `www`, MX (Resend ?), TXT SPF/DKIM/DMARC (policy ?), TXT verification, DNSSEC status (rappel : à activer ~16 mai), TTL.

### P-04 ROBOTS-SITEMAP

`robots.txt` content. Sitemap-index split. Count URLs. Leak admin/drafts. `lastmod` cohérent. `<xhtml:link rel="alternate" hreflang>` dans sitemap.

### P-05 SEO-LIVE (10 pages clés)

`view-source` extrait → `<title>`, `<meta description>`, canonical, hreflang, JSON-LD parsé. Comparer avec ce que `generateMetadata` était censé produire.

### P-06 LIGHTHOUSE LOCAL (V2 — pas prod)

1. `pnpm build` (timeout 20 min).
2. `pnpm start` en background.
3. `lhci collect --url=http://localhost:3000/fr` (et 4 autres URLs : `/en`, `/fr/audit`, `/fr/reserver`, `/fr/implantations/ile-de-france/paris`).
4. Récupérer scores Performance/A11y/BP/SEO. Comparer aux budgets `lighthouserc.json`.
5. Tuer le serveur en fin.

Si `pnpm build` échoue : `[BUILD FAIL]` + log, continuer audit sans LHCI.

### P-07 INDEXATION

Vérifier que postbuild ping IndexNow OK (script `indexnow-ping.ts`). Search Console = `[ACTION WILL]` (pas d'API auth ici).

### P-08 CLOUDFLARE LIVE (lecture API seule)

Via API CF (token dans `.secrets/api-tokens.env`) : Bot Fight ON, AI Scrapers OFF, Cache Rules count = 5, SSL Full strict, HSTS 12mo preload, HTTP/3, Brotli, WAF rules count, DNSSEC status. **Aucune écriture API**.

---

## 7. PHASE 4.5 — PASS B CROISEMENT & DÉ-DUPLICATION (~1 h, V2 nouveau)

Livrable : `_AUDIT/E2E-2026-05-09/05-PASS-B/`

### `PASS-B-CROISEMENT-P0.md`

Matrice : pour chaque P0 remonté par les 15 agents + 10 raccordements, exiger ≥ 2 sources indépendantes :

- Source A : agent / raccordement / phase prod-live
- Source B : grep code OU curl prod OU 2e agent
- Verdict : `CONFIRMÉ` / `DÉGRADÉ EN P1` / `RETIRÉ (faux positif)`

Format :

```
| ID | Title | Source A | Source B | Verdict | Citation |
| P0-01 | CSP nonce manquante /reserver | AGT-08 §3.2 | curl /fr/reserver header CSP | CONFIRMÉ | … |
| P0-02 | Sitemap leak admin route | AGT-04 §1.4 | sitemap parse, no admin found | RETIRÉ | … |
```

### `PASS-B-FAUX-POSITIFS.md`

Liste tous findings (P0/P1/P2) **retirés** ou **dégradés**, avec raison. Permet d'apprendre les patterns d'erreur agents.

### `PASS-B-COVERAGE.md`

Quel % du code est réellement audité ?

- routes auditées / routes existantes
- endpoints API auditées / existants
- composants critiques auditées / existants
- fichiers `_AUDIT/` lus / disponibles

Si coverage < 80 % sur un domaine : flag.

---

## 8. PHASE 5 — SYNTHÈSE & VERDICT (~1.5 h)

### 8.1 `SYNTHESE-FINALE.md`

**Score consolidé** (pondération inchangée) :
| Agent | Poids |
|---|---|
| AGT-01 Architecture | ×1.0 |
| AGT-02 Routes/Maillage | ×1.2 |
| AGT-03 Performance | ×1.5 |
| AGT-04 SEO | ×1.5 |
| AGT-05 AEO/GEO | ×1.3 |
| AGT-06 i18n | ×1.2 |
| AGT-07 A11y | ×1.3 |
| AGT-08 Sécurité | ×1.5 |
| AGT-09 RGPD | ×1.5 |
| AGT-10 API/Forms | ×1.0 |
| AGT-11 DB | ×1.0 |
| AGT-12 Infra/CI-CD | ×1.2 |
| AGT-13 Tests | ×1.0 |
| AGT-14 Monitoring/DR | ×1.2 |
| AGT-15 Content/CRO | ×1.3 |

**Score `/100` final** = moyenne pondérée arrondie 0.5 (après Pass B).

**Top 20 P0** (post Pass B uniquement) — bloquant prod / sécu / RGPD / SEO critique.
**Top 30 P1** — sérieux non bloquant.
**Top 30 P2** — confort/polish.

**Roadmap** :

- Sprint correctif **immédiat** (≤ 1 semaine) : P0 uniquement
- Sprint **court** (≤ 2 semaines) : P1 critiques
- Backlog **trimestriel** : P2 + P1 résiduels

**Verdict** :

- 🟢 GO PRODUCTION : score ≥ 92 ET 0 P0
- 🟡 CONDITIONAL GO : score ≥ 85 ET P0 ≤ 3 avec mitigation
- 🔴 NO-GO : score < 85 OU P0 > 3 (sécu/RGPD)

**Comparaison historique** : tableau vs Web Vitals 2026-05-08 (47.2 %) et Final Verdict 2026-05-09 (~92/100 CONDITIONAL GO).

**STOP & ASK consolidés** : tous les Q-XX dédupliqués, classés par criticité.

### 8.2 `WHAT-TO-DO-NOW.md` (V2 — fichier autonome ≤ 5 p)

Format ultra-actionnable pour Will :

```markdown
# Axion-IA — À faire maintenant (état 2026-05-09)

## Verdict : 🟢 / 🟡 / 🔴 (score NN/100)

## ⚡ Cette semaine (P0 — bloquant)

1. [ ] **<titre P0>** — `path:line` — effort Xh — pourquoi : …
2. …

## 🎯 Sprint suivant (P1 critique)

1. [ ] …

## 🔍 Action Will (hors code)

- [ ] DNSSEC à activer Cloudflare
- [ ] Search Console : vérifier coverage post-fix sitemap
- [ ] DPA Hetzner papier
- [ ] …

## 📁 Pour aller plus loin

- Synthèse complète : `_AUDIT/E2E-2026-05-09/SYNTHESE-FINALE.md`
- Détail Pass B : `_AUDIT/E2E-2026-05-09/05-PASS-B/`
- Rapport agent X : `_AUDIT/E2E-2026-05-09/02-AGENTS/AGT-XX-…md`
```

C'est ce fichier que Will lit en premier le matin.

### 8.3 `🚨-NO-GO-ALERT.md` (conditionnel verdict 🔴)

Si verdict 🔴 :

- Top 3 raisons NO-GO en tête.
- Risque immédiat (data leak, sécu, RGPD, prod down).
- Actions 24-48 h max.
- Stop : attendre arbitrage Will avant tout `WHAT-TO-DO-NOW.md` publication.

---

## 9. CONTRAINTES TRANSVERSES

- Markdown GitHub-flavored, emoji uniquement statut (🟢🟡🔴🚨✅⚠️🔐).
- Tableaux pour toute donnée comparative.
- Citations obligatoires.
- `[INCONNU — raison]` ou `[NON MESURÉ — raison]` jamais combler.
- Sections vides → `RAS` + 1 ligne preuve.
- Volume cible total : ~300 p max.
- Effort wall-clock : 12-18 h en parallélisant ; 30-40 h en série.

### 9.1 Règle Pass B forte (V2)

Aucun **P0** dans `WHAT-TO-DO-NOW.md` qui n'a pas survécu Pass B. Si un P0 n'a qu'**une** source → `PASS-B-CROISEMENT-P0.md` doit le dégrader en P1 ou demander une 2e vérif explicite.

### 9.2 Phrase d'invocation finale (pour relancer un nouveau Claude)

> Lis `axionia/_AUDIT/PROMPT-E2E-DEEP-AUDIT-2026.md` (V2 AUTO-PILOT) et exécute-le **intégralement** Phase 0 → Phase 5 sans pause. Mode AUDIT-ONLY strict. Lance les 15 agents Phase 2 en **parallèle** (un seul message tool-call, 15 invocations). Respecte timeouts, anti-leak secrets, kill-switch. Pass B obligatoire avant la synthèse. Termine par `WHAT-TO-DO-NOW.md`. Stop unique : si verdict 🔴, écris `🚨-NO-GO-ALERT.md` et attends moi. Sinon, pas de pause.

---

## 10. ANNEXES

### 10.1 Checklist 50 critères de surface (rapide)

- [ ] `<title>` unique ≤ 60c partout
- [ ] `<meta description>` 140-160c partout
- [ ] `canonical` absolu HTTPS partout
- [ ] `og:image` ≠ localhost (rappel ⚠️ bug pré-existant)
- [ ] `hreflang` fr/en/x-default partout (bilingues)
- [ ] `lang` HTML correct
- [ ] H1 unique et présent
- [ ] Hero respecte cap 88px desktop
- [ ] `.hero-schema` carré 576×576 lg+
- [ ] Header terracotta + logo blanc
- [ ] 0 montant hardcodé hors `pricing.ts`
- [ ] 0 phrase interdite (« ½ journée », etc.)
- [ ] URL pSEO villes : `/fr/implantations/<region>/<ville>`
- [ ] Ratio AxionIA-centric ≥ 95 % pages villes
- [ ] `llms.txt` + `llms-full.txt` présents et à jour
- [ ] CSP nonce-based, pas de `unsafe-inline` script
- [ ] HSTS preload 12 mois
- [ ] HTTP/3 ON
- [ ] Brotli ON
- [ ] Bot Fight ON, AI Scrapers OFF
- [ ] 5 Cache Rules CF actives
- [ ] DNSSEC status documenté
- [ ] Sentry sourcemaps OK
- [ ] PII redaction Telegram (14 sites Sprint 24.1)
- [ ] GDPR export endpoint OK
- [ ] Retention purge cron actif
- [ ] DPA register à jour
- [ ] Sous-processeurs Backblaze retiré confirmé
- [ ] Coolify healthcheck ON
- [ ] Snapshots Hetzner réguliers
- [ ] Backup Postgres + restore CI testé
- [ ] Tests vitest verts
- [ ] Tests Playwright chromium verts
- [ ] Bundle first-load gz dans budgets
- [ ] Lighthouse local ≥ 90/95/95/100 sur top 5
- [ ] Sitemap-index résout 200 (rappel ⚠️ bug)
- [ ] OG image ne pointe pas localhost
- [ ] IndexNow ping postbuild OK
- [ ] Auto-deploy GH Actions OK
- [ ] CSP propre console prod
- [ ] Webhook Coolify legacy disabled
- [ ] `.env` prod aligné `env.ts` Zod
- [ ] 0 route admin dans sitemap/robots/llms.txt
- [ ] 0 secret leak dans rapports audit
- [ ] Pass B : 100% des P0 ont ≥ 2 sources
- [ ] `WHAT-TO-DO-NOW.md` ≤ 5 pages
- [ ] `MANIFEST.md` à jour
- [ ] Aucun fichier modifié hors `_AUDIT/E2E-2026-05-09/`
- [ ] `SYNTHESE-FINALE.md` cite Pass B
- [ ] Verdict 🟢/🟡/🔴 chiffré
- [ ] Comparaison vs audits précédents incluse

### 10.2 Référentiels externes

WCAG 2.2 W3C 2023 — RGAA 4.1 DINUM — Core Web Vitals Google (INP 2024) — HCU Google 2024 — LLMs.txt Answer.AI — IndexNow — DSA/DMA EU 2022 — RGPD 2018 + EDPB — Cloudflare best-practices 2026 — Next.js 16 docs.

### 10.3 Glossaire

- **AxionIA-centric** : copy unique cabinet (≥ 95 % ratio)
- **Bouclier HCU** : protection anti-doorway via cap 95/5
- **Tier-1 ville** : `copy.services.<svc>` substantiel (déclenche indexation)
- **SSOT** : Single Source of Truth
- **Phase 5 CF** : 9/11 étapes Cloudflare 2026-05-09
- **Pass B** : re-vérification croisée des findings (V2)

### 10.4 Fichiers référence à consulter

`axionia/CLAUDE.md`, `axionia/AGENTS.md`, `axionia/Design.md`, `axionia/_AUDIT/PLAN-AMENDMENTS-2026-05-08.md`, `axionia/_AUDIT/CERTIFICATION-FRONTEND-2026/00-MASTER-ORCHESTRATOR.md`, `axionia/_AUDIT/CHECKLIST-CUTOVER.md`, `axionia/_AUDIT/DPA-REGISTER.md`, `axionia/src/content/pricing.ts`, `axionia/src/lib/seo/*`, `axionia/src/i18n/routing.ts`, `axionia/next.config.ts`, `axionia/Caddyfile`, `axionia/Dockerfile`.

### 10.5 Tokens (lecture API distantes)

Source : `Axion-IA/.secrets/api-tokens.env` (gitignored). Sourcer en début de session :

```
set -a && source .secrets/api-tokens.env && set +a
```

Tokens utilisables en lecture seule : Hetzner, Cloudflare, Coolify (cf. mémoire `axionia_coolify_api_authorization`).

---

## 11. SUCCÈS DE L'AUDIT (V2 critères)

Audit considéré **réussi** ssi :

1. 5 phases livrées dans `_AUDIT/E2E-2026-05-09/`.
2. `MANIFEST.md` à jour, tous livrables `DONE` ou justifiés `FAILED/TIMEOUT`.
3. Pass B exécuté ; aucun P0 publié sans ≥ 2 sources.
4. `WHAT-TO-DO-NOW.md` ≤ 5 p, autonome, actionnable.
5. `SYNTHESE-FINALE.md` chiffre score + verdict.
6. Aucun fichier modifié hors `_AUDIT/E2E-2026-05-09/`.
7. Aucun secret leak dans aucun rapport (`grep` final regex § 0.5).
8. Lisibilité : un nouveau dev comprend l'état Axion-IA en 1 h via `WHAT-TO-DO-NOW.md` + `SYNTHESE-FINALE.md` seuls.

---

**FIN DU PROMPT — VERSION 2.1 AUTO-PILOT — patch postbuild/Sentry/DB-safety — 2026-05-10**

---

## 12. CE QUE L'AUDIT NE COUVRE PAS (transparence)

L'audit V2.1 valide ~92-95 % du chemin "production-ready". Il **ne** garantit **pas** :

| Domaine                                               | Status                                         | Pour aller plus loin                                       |
| ----------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------- |
| Load testing (RPS supportés CPX32)                    | NON COUVERT                                    | Sprint dédié `k6` ou `artillery`                           |
| Disaster recovery drill (restore réel testé)          | NON COUVERT                                    | Exécuter `restore-postgres-test.sh` en environnement isolé |
| Pentest réel (XSS payloads, SQLi, IDOR)               | NON COUVERT (audit OWASP statique seulement)   | Prestation externe ou bug bounty                           |
| Email deliverability (inbox placement)                | NON COUVERT (structure SPF/DKIM/DMARC validée) | Mail-tester.com + sondes Gmail/Outlook                     |
| CrUX p75 RUM réel                                     | NON COUVERT (Lighthouse local = labo)          | Search Console + `/api/vitals` cumul ≥ 28 j                |
| Cross-browser (Firefox/Safari)                        | NON COUVERT (chromium only)                    | Sprint dédié BrowserStack ou Playwright multi              |
| Mobile real-device                                    | NON COUVERT (viewport simulation)              | Prestation BrowserStack/SauceLabs                          |
| Search Console / Plausible API live                   | `[ACTION WILL]`                                | Will fournit screenshots ou tokens                         |
| Stripe / paiement (si présent)                        | À vérifier dans périmètre                      | Test mode + webhook signature audit                        |
| Routes admin runtime                                  | `[ACTION WILL]`                                | Will fournit creds en sandbox                              |
| Chaos engineering                                     | NON COUVERT                                    | Prestation externe                                         |
| Conformité juridique signée (DPA papier, mentions OÜ) | `[ACTION WILL]`                                | Avocat / DPO                                               |

Si tu as besoin d'un sign-off prod **absolu**, prévois un sprint complémentaire couvrant load + DR + pentest + email + RUM 28 j. L'audit V2.1 est suffisant pour : **valider que le code est solide et que la prod ne casse pas en usage normal**. Il n'est **pas** suffisant pour : **certifier la résilience sous charge ou face à un attaquant déterminé**.
