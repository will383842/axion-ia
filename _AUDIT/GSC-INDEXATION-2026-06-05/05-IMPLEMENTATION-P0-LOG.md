# 05 — LOG D'IMPLÉMENTATION P0 (2026-06-05)

> Implémentation staged des correctifs P0 + E-E-A-T. **Commits LOCAUX uniquement — RIEN POUSSÉ** (push = deploy prod ; Will valide et pousse).
> Working tree partagé multi-sessions : à chaque étape, re-sync sur `origin/main` + vérif que les cibles n'ont pas dérivé. Base de départ synchronisée = `origin/main` `33a72f65` (les 107 commits entrants intégrés par rebase).

## Commits locaux (4) — `0 behind / 4 ahead` de `origin/main`

| # | SHA | Objet | Anomalie | Fichiers |
|---|---|---|---|---|
| 1 | `df7003c3` | E-E-A-T identité : Organization JSON-LD câblé sur env `COMPANY_*` + sameAs profils réels + LinkedIn `axion-ia-france` | A-14, A-16 | `src/lib/seo.ts`, `src/lib/seo/ville-service-jsonld.ts` |
| 2 | `a90f652a` | og-image 502 : import `next/og` → `@vercel/og` (2 routes file-convention) | A-02 | `src/app/opengraph-image.tsx`, `src/app/[locale]/implantations/[region]/[ville]/opengraph-image.tsx` |
| 3 | `b18951c3` | EN 301-unique : retire `Disallow:/en/` + fuites `hreflang="en"` (togglable) | A-03, A-04 | `src/app/robots.ts`, `src/app/sitemaps/images-fr.xml/route.ts` |
| 4 | `efdabc86` | Gel du drip villes (plafond cohorte `FREEZE_DAYS=12`) — cause racine famine crawl | A-01 (D-1) | `src/content/villes/index.ts` |

## Vérifications par étape

- **Toutes** : `pnpm typecheck` = **0 erreur** (après `prisma generate` — la base synchronisée avait un client Prisma périmé, sans rapport avec les changements).
- **Étape 3 (drip)** : test `src/content/villes/index.test.ts` **10/10**. Invariant ⊇ (jamais de rétraction) prouvé par construction : `min(elapsed, FREEZE_DAYS)` monotone ; aujourd'hui `elapsed=8 ≤ 12` ⇒ cohorte post == pré (identique), puis plateau. Valide pour tout deploy ≤ 2026-06-09.
- **Étapes 1-2** : pas de tests unitaires directs (routes metadata) ; couverture E2E Playwright seulement → **vérif post-deploy par Will** (curl).
- **Régression globale** : passe `pnpm test` complète lancée — résultat attendu = **exactement les 2 échecs PRÉ-EXISTANTS** (cf. ci-dessous), zéro nouveau. *(à confirmer en fin de run.)*

## Garde-fous respectés

- ✅ **Invariant EN** : EN jamais indexé ; neutralisation **togglable `EN_LOCALE_ENABLED`** (robots + images-fr conditionnés au flag) ; aucune suppression de routing/messages/pré-rendu EN.
- ✅ **Indexation ne rétracte jamais** : gel drip = `min`, monotone, post ⊇ pré.
- ✅ **Contrat stub** : `stub.invalid` / `SKIP_ENV_VALIDATION` / `BULLMQ_DISABLED` non touchés. `images-fr.xml` garde son early-exit stub ; le garde EN vit après.
- ✅ **Web Vitals** : Étapes 1-4(faite) = sitemap/robots/edge/schema-only → 0 impact frontend. (Étape 4 maillage = non faite, cf. infra.)
- ✅ **Multi-sessions** : re-sync + rebase propre à chaque incrément (commits entrants `45122b7e`, `33a72f65` intégrés sans conflit ; cibles vérifiées identiques). **Aucun push.**

## ÉTAPE 4 (P0-4 maillage Tier 0 + IndexNow) — NON FAITE, en attente décision Will (D-2)

Raisons (alignées sur ta consigne « ne rien casser avec les autres conversations ») :
1. Les pages cibles (galerie, methodologie, comparaisons, presse, glossaire) sont **déjà liées dans `src/components/nav/Footer.tsx`** = **≤2 clics** → déjà découvrables.
2. L'audit **prouve que le goulot est le crawl-budget, pas le maillage** (`/fr/tarifs` est à 1 clic dans le header et reste non crawlé). Promouvoir au header/accueil = **valeur marginale faible tant que le crawl n'est pas débloqué**.
3. Éditer `Header.tsx`/`Footer.tsx` (nav partagée, souvent modifiée par d'autres sessions) = **le risque de régression cross-session que tu as signalé**.
4. IndexNow existe (`src/app/api/indexnow/route.ts` + actions admin) mais cible Bing/Yandex (pas Google) et pinger des pages **statiques** Tier 0 = nouveau déclencheur à concevoir.
5. La **vraie réduction d'exposition** (sitemap Tier 0 ~120 URLs, cf. `03b`) nécessite ta **validation de la liste Tier 0 (D-2)**.

→ **Décision attendue (D-2)** : valider la liste Tier 0 + choisir si on (a) promeut quelques liens nav, (b) câble IndexNow Tier 0, (c) réduit le sitemap au Tier 0. À faire dans une étape dédiée avec `pnpm lhci`.

## Hors P0 — à traiter séparément

- 🔴 **31 prix € en dur (SSOT)** : le garde-fou `no-hardcoded-prices.spec.ts` échoue (31 violations dans les surfaces Phase-1) — **pré-existant sur `origin/main`**, introduit par les 107 commits, **pas par cette session** (mes 4 commits contiennent 0 €). À localiser + tokeniser (`{{price:…}}` / helper) en tâche dédiée. ⚠️ NE PAS bulk-éditer à l'aveugle.
- 🟡 `presse generateStaticParams` timeout = environnemental (machine très lente).

## Reste à faire côté Will (après validation + push)

1. **Pousser** les 4 commits (= deploy). ⚠️ **Avant 2026-06-09** (sinon augmenter `FREEZE_DAYS` d'abord — anti-rétraction drip).
2. **Set env Coolify** (scope RUN) pour activer A-14 : `COMPANY_REGISTRATION_NUMBER` (SIREN), `COMPANY_VAT_NUMBER`, `COMPANY_ADDRESS`, `COMPANY_PHONE`, `COMPANY_EMAIL`. + remplir le texte de `src/content/legal.ts` (placeholders légaux).
3. **Vérifs post-deploy** (curl) :
   - `curl -I https://axion-ia.com/opengraph-image` → **200 image/png** (A-02).
   - `curl https://axion-ia.com/robots.txt` → **plus de `Disallow: /en/`** (A-03).
   - `curl https://axion-ia.com/sitemaps/images-fr.xml | grep 'hreflang="en'` → **vide** (A-04).
   - `curl -I https://axion-ia.com/en/about` → **301 1-hop** vers FR.
   - `curl https://axion-ia.com/sitemap/villes-ile-de-france.xml | grep -c "<loc>"` → stable (drip gelé).
4. **GSC** : re-soumettre `sitemap-index.xml` ; marquer résolus `/api/og`, 5xx audit/demande + impl/documents ; **URL Inspection 10-20 URLs Tier 0/jour (D-6)** ; surveiller la courbe « Détectée non indexée ».
5. **Vérifier la page LinkedIn publique** `linkedin.com/company/axion-ia-france` (publiée, accessible déconnecté).

## P1 / P2 (sessions ultérieures)
- P1 : gate qualité auto régime-permanent, `X-Robots-Tag` Edge villes (A-11), `lastmod` réels villes (A-10), galerie accueil (A-09), Étape 4.
- P2 : backlinks/PR (cf. `05-PLAN-BACKLINKS.md`), 31 prix SSOT, copies villes uniques (**facturable — D-5 plus tard**).
