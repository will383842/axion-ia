# 🔬 PROMPT VÉRIFICATION COMPLÈTE PLATFORM — Axion-IA · Audit + Auto-fix + Re-audit

> **Version 1.0 · 2026-05-09**
> **Statut** : prompt master de fin de cycle, à lancer **une fois la plateforme complètement implémentée** (post-Sprint 23 / fin M11).
> **Working directory** : `C:\Users\willi\Documents\Projets\Axion-IA\axionia` (sous-repo Git Next 16).
> **Umbrella** : `C:\Users\willi\Documents\Projets\Axion-IA\` (audit, dossiers wireframes, skills package).
>
> Ce prompt **étend** et **remplace** `_AUDIT/PROMPT-VERIFICATION-FINALE.md` (audit-only) :
>
> - Phase 1 : audit exhaustif (frontend + backend + métier + infra + RGPD + SEO/AEO/GEO + sécurité + a11y + perf + scale).
> - Phase 2 : **auto-fix** avec garde-fous anti-régression et préservation fonctionnalités.
> - Phase 3 : **suppression obsolète** contrôlée (code mort, docs périmés, deps inutiles, routes orphelines).
> - Phase 4 : **re-audit Pass B** (vérifier que Phase 2/3 n'a rien cassé et que les findings sont fermés).
>
> À lancer dans une **fenêtre Claude Code fraîche**. Phrase d'invocation :
>
> > « Lance `_AUDIT/PROMPT-PLATFORM-VERIFICATION-COMPLETE-2026.md` »

---

## 0. RÔLE & POSTURE

Tu es **auditeur senior + ingénieur correcteur** indépendant. Tu n'as ni codé ce projet ni participé aux sprints. Ta mission :

1. **Traquer toute imperfection** (bug, régression, dette, incohérence, vulnérabilité, écart à la doctrine, oubli vs best-practices 2026).
2. **Corriger automatiquement** ce qui peut l'être sans risque, en **préservant à 100 % les fonctionnalités existantes** et en documentant chaque patch.
3. **Supprimer le code, les docs, les deps, les routes obsolètes** après vérification stricte (zéro reference, zéro impact prod).
4. **Rejouer l'audit (Pass B)** pour prouver que rien n'a régressé et que les findings P0/P1 sont effectivement fermés.

**Posture** : sceptique, exhaustif, factuel, conservateur sur les destructions, agressif sur la détection. Ne fais confiance ni aux DoD, ni aux commits, ni aux mémoires — vérifie tout par toi-même contre la source de vérité (le code à HEAD).

---

## 1. SOURCES DE VÉRITÉ (chargement obligatoire avant toute action)

### 1.A · Doctrine & décisions

1. `axionia/CLAUDE.md` → `axionia/AGENTS.md` (« This is NOT the Next.js you know » + budgets perf 15 pages stratégiques).
2. `axionia/Design.md` v3 — doctrine **Editorial Premium Light** (canon actif).
3. `axionia/docs/adr/0001-stack-initial.md` à `0009-hosting-hetzner-cpx32-cloudflare-free.md` — 9 ADRs verrouillés.
4. `Axion-IA_Dossier_FINAL_ABSOLU_v10.1/CLAUDE.md` v6 — bible projet umbrella.
5. `axionia-package/docs/_DECISIONS-FINALES.md` + `_NO-STRIPE.md` — décisions verrouillées 06/05/2026.

### 1.B · Inventaire & mapping

6. `_AUDIT/02-PLAN.md` — plan M1-M11.
7. `_AUDIT/02b-mapping-pages.md` — **toutes routes templates HEAD uniques** = inventaire de référence (à mettre à jour si la liste a évolué post-Sprint 14.10).
8. `Navigation-Complete-Axion-IA.md` — sitemap exhaustif umbrella.

### 1.C · Audits historiques (à comparer pour détecter régressions)

9. `RAPPORT_AUDIT_v10.1.md` — 404/404 v10.1 baseline.
10. `_AUDIT/AUDIT-PARITY-V14-FINAL.md` — état parity 92 % au 2026-05-08.
11. `_AUDIT/AUDIT-WEB-VITALS-2026-*.md` (5 fichiers) — baseline 1062.5/2250 + 81 patches V1-V6.
12. `_AUDIT/CERTIFICATION-FRONTEND-2026/_RUN-LOG-2026-05-08.md` — 23/28 audits cert livrés.
13. `_AUDIT/PLAN-AMENDMENTS-2026-05-08.md` — overlay cohérence plan + mapping Sprint↔Jalon.
14. `_AUDIT/00-fiches-lecture.md` — 16 contradictions Phase 0 (vérifier qu'elles restent neutralisées).

### 1.D · Skills cadenassés (18 skills `axionia-*`)

15. Skills `axionia-*` dans `axionia-package/skills/` (et leurs LOCKs sur 22 skills génériques) — règles à vérifier appliquées dans le code (échantillon ≥ 5 fichiers par skill).

### 1.E · État sprint

16. `axionia/SESSION_LOG.md` — état des sprints livrés.
17. `axionia/CHANGELOG.md` — initialisé Sprint 21.
18. `axionia/package.json` — versions stack verrouillées (Next 16.x, next-auth v5, next-intl v4, React 19, Tailwind 4).

### 1.F · Mémoire utilisateur (optionnelle, ne fait jamais foi face au code)

19. `~/.claude/projects/C--Users-willi/memory/MEMORY.md` — index. Lire seulement les pointeurs `axionia_*`. **Le code reste la SSOT** (cf. doctrine `axionia_doctrine_code_ssot.md`).

---

## 2. RÈGLES DU JEU

1. **Mode auto** — exécute, ne demande pas, sauf STOP & ASK explicites listés ci-dessous.
2. **Multi-agents en parallèle** : voir § DISPATCH. Maximiser les calls parallèles dans un seul message quand les chapitres sont indépendants.
3. **Aucune indulgence sur l'audit** : un gate rouge = un finding P0 ou P1 selon impact.
4. **Citations file:line obligatoires** pour chaque finding. Reproduction (commande/URL/test) obligatoire.
5. **Préservation fonctionnelle absolue** en Phase 2/3 :
   - Aucun patch ne supprime un comportement utilisateur observable.
   - Tout retrait de code mort doit être prouvé (dépend-grep + import-grep + tsc + tests verts).
   - Tout patch génère un **commit dédié** avec message explicite + référence finding ID.
6. **STOP-LIST destructif** (interdictions absolues sans validation Will explicite):
   - `git push --force` / `--force-with-lease` sur `main`.
   - `git reset --hard` sur des commits déjà pushés.
   - `rm -rf` hors `node_modules` / `.next` / `dist` / `coverage` / `.turbo`.
   - `DROP TABLE`, `TRUNCATE`, `DELETE FROM` sur DB prod ou staging.
   - `coolify rollback`, `docker volume prune`, `docker system prune -a`.
   - Suppression de routes prod, de migrations Prisma, ou de templates emails.
   - Modification de tokens design v3 (palette, typographie, radius) — ADR 0002/0007/etc. font foi.
   - Ré-introduction de mots/concepts bannis (« formation/formateur/formé », « SIREN/SIRET/RCS », Stripe/Paddle/Resend, hex hardcodé hors `globals.css`).
7. **Garde-fous Phase 2/3** : avant chaque suppression/refactor, exécuter la check-list § 6.B.
8. **Mémoire** : ne pas se fier aux mémoires `axionia_*` pour valider — **toujours regrep le code**. Si la mémoire dément le code, **trust le code** + corriger la mémoire en sortie.
9. **Aucune introduction** : Phase 2/3 ne **JAMAIS** introduire une nouvelle feature, dépendance, abstraction, fichier, ou route. Uniquement réparer + supprimer.
10. **Doctrine code = SSOT** : si la doctrine docs diverge du code et que Will n'a pas explicitement demandé de durcir le code, **aligner les docs sur le code**, pas l'inverse.

---

## 3. DISPATCH MULTI-AGENTS (Phase 1 — Audit exhaustif)

Lancer en parallèle (1 message, 8 Agent calls) au démarrage de Phase 1 :

| Agent            | Subagent type     | Mission                                                                                                                                          | Sortie                                 |
| ---------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| **AGT-DOCTRINE** | `Explore`         | Conformité doctrine v3 : palette, typographie 3-familles, radius, halos, anti-hex, anti-noir-pur, eyebrow dot, em.editorial.                     | `_AUDIT/VERIF-COMPLETE-doctrine.md`    |
| **AGT-COVERAGE** | `Explore`         | Routes générées (build) vs `02b-mapping-pages.md` + Navigation-Complete. Lister manquants + orphelines + métadonnées + JSON-LD.                  | `_AUDIT/VERIF-COMPLETE-coverage.md`    |
| **AGT-SKILLS**   | `Explore`         | 18 skills `axionia-*` respectés dans le code (5 fichiers par skill). LOCKs sur skills génériques actifs.                                         | `_AUDIT/VERIF-COMPLETE-skills.md`      |
| **AGT-SECURITY** | `general-purpose` | OWASP ASVS 5.0 L2 + NIST SP 800-63-4 + headers + secrets + deps + ZAP baseline + `gitleaks` + `pnpm audit` + `trivy` + `semgrep`.                | `_AUDIT/VERIF-COMPLETE-security.md`    |
| **AGT-PERF**     | `general-purpose` | Bundle analyzer + Core Web Vitals (LCP/INP/CLS/TTFB/FCP/TBT) + budgets perf + fonts + images + RUM + Lighthouse 30 URLs.                         | `_AUDIT/VERIF-COMPLETE-perf.md`        |
| **AGT-BACKEND**  | `general-purpose` | API/Server actions + Prisma schema + indexes + queues BullMQ + emails + cron jobs + auth + 2FA/WebAuthn + RGPD endpoints.                        | `_AUDIT/VERIF-COMPLETE-backend.md`     |
| **AGT-SEO-AEO**  | `Explore`         | SEO 150 critères + AEO citability test (10 questions Perplexity/ChatGPT/Claude/Google AIO) + GEO villes/régions + JSON-LD + llms.txt + IndexNow. | `_AUDIT/VERIF-COMPLETE-seo-aeo-geo.md` |
| **AGT-INFRA**    | `general-purpose` | Hetzner CPX32 + Cloudflare Free + Caddy 2 + Coolify + DNS + SSL + backups + DR drill + observabilité + uptime.                                   | `_AUDIT/VERIF-COMPLETE-infra.md`       |

Pendant que les 8 agents tournent, **l'agent principal** (toi) exécute en local les chapitres rapides : 1, 4, 5, 6, 9, 22, 24, 25 (cf. § 4).

À la fin, l'agent principal **agrège** les 8 rapports + ses propres chapitres dans `_AUDIT/VERIF-COMPLETE-A-fullstack.md` (Pass A).

---

## 4. CHAPITRES D'AUDIT (30 chapitres, exhaustifs)

> Chaque chapitre = liste de gates + commande de vérification + finding template (ID, titre, fichier:ligne, repro, impact, P0/P1/P2/P3, action proposée pour Phase 2).

### 4.01 — Audit code statique

- `pnpm typecheck` 0 erreur, 0 warning.
- `pnpm lint` 0 erreur, 0 warning (jsx-a11y + @typescript-eslint/strict-type-checked).
- `pnpm format:check` 0 diff.
- `knip` ou `ts-prune` : dead code 0.
- `eslint-plugin-sonarjs complexity` ≤ 15 par fonction.
- `madge --circular src/` : 0 cycle.
- `grep -rE "TODO|FIXME|HACK|XXX" src/` : chacun avec ticket associé sinon supprimé.
- `grep -r "console\." src/` : autorisé seulement dans `src/lib/logger.ts`.
- Imports relatifs `../../../` : 0 (alias `@/`).
- Files orphelines : `dpdm` ou équivalent → 0.

### 4.02 — Audit completeness vs `02b-mapping-pages.md`

> Délégué à **AGT-COVERAGE**. Pour **chaque** template :

- URL FR + URL EN existent (HTTP 200 sur build local).
- `generateMetadata` présent (title + description + canonical + alternates hreflang FR/EN/x-default).
- JSON-LD présent et valide via Schema.org Validator API.
- `<Breadcrumbs>` présent sauf accueil.
- Aucun `'use client'` non justifié (commentaire `// use-client: <raison>` requis).
- OG image dynamique fonctionne.
- Liste **routes orphelines** (existent mais hors mapping) → ajouter au mapping ou supprimer.
- Liste **routes manquantes** vs mapping → P0.
- pSEO villes : 2 157 routes prerendered (foundation INSEE) — vérifier sample 50 pages.

### 4.03 — Audit doctrine v3 Editorial Premium Light (ADR 0002 + 0007)

> Délégué à **AGT-DOCTRINE**. Source de vérité : `Design.md` v3 + `globals.css`.

#### 4.03.A · Palette

- **Editorial Blue `#1a4dd9`** (`--color-primary`) seul CTA primaire.
- **Terracotta `#c24a1b`** (`--color-terracotta`) seul accent éditorial (italique `em.editorial`, dot, divider, hover).
- **Mocha `#2a2520`** premium dark (Footer, CTA dark) — **jamais noir pur**. Tout `#000`/`#0a0a0a`/`#080808` détecté = **P0**.
- Surfaces : ivoire `#faf8f3`, paper `#ffffff` cards, sand `#f0e9da`/`#e6dcc4` alternance. `bg-white` natif sur section principale = **P1**.
- Sage `#7a8870` Module Cas concrets.
- Module-color mapping : Module 1 primary blue / Module 2 orange `#ff6b00` / Module 3 purple `#7a3dff` / Cas concrets sage.

#### 4.03.B · Typographie (ADR 0007 v3.2)

- 3 familles uniquement : Manrope (sans), Fraunces (serif), Inconsolata (mono). Toute autre dans le bundle = **P0**.
- Modular scale : `text-display 7rem`, `text-section 4rem`, `text-sub 2.25rem`, `text-body 1rem` lh 1.65, `text-label-up 0.8125rem` tracking 0.16em.
- Hero cap 88px appliqué.
- Eyebrow signature : pas de fond coloré, dot indicator 6×6px en couleur module.
- `em.editorial` rendue serif italique terracotta — ≥1 par page produit/home/cas.

#### 4.03.C · Radius & shadows

- Radius v3 : xs:2 / sm:4 / md:8 / lg:12 / xl:20 / 2xl:28 / full:9999.
- `pnpm radius:check` passe.
- Shadows ton chaud `rgba(42,37,32,…)` cascade 5 couches. Shadow `rgba(0,0,0,…)` hardcodé hors `globals.css` legacy = **P1**.

#### 4.03.D · Halos & animation

- `bg-halo-warm` Hero home/module défaut, `bg-halo-cool` alternance.
- `translate-x-[6px]` hover CTA primaire (test Playwright transform CSS).
- `prefers-reduced-motion: reduce` désactive toutes animations.

#### 4.03.E · Hero schema doctrine v3.3 (Sprint 14.7quater)

- `.hero-schema` carré 576×576 lg+ (width + height invariants).
- 11 components × 11 pages (home incluse) alignés.
- SVG schemas viewBox carré 560×560.

#### 4.03.F · Tokens & breakpoints

- Tokens `--color-*`, `--space-*`, `--radius-*`, `--shadow-*` consommés via Tailwind utility, jamais en valeur littérale.
- Breakpoints 479/768/992/1280, `<Container>` max-w 1280.
- 3 sections consécutives même surface = **P3** (rythme).

#### 4.03.G · Anti-patterns interdits (linter CI)

- `#000000`/`#0a0a0a`/`#080808` hardcodé = **P0**.
- `bg-white` natif sur section principale = **P1**.
- Police hors Manrope/Fraunces/Inconsolata = **P0**.
- Eyebrow avec fond coloré v1 = **P2**.
- Shadow ton-froid `rgba(0,0,0,…)` hardcodé hors `globals.css` = **P1**.
- Hero non carré `.hero-schema` = **P1**.

### 4.04 — Audit anti-banni

- `grep -ri "formation\|formateur\|former\|formé" src/ messages/ app/` → 0 (sauf intent SEO whitelisted via skill `axionia-seo-aeo`).
- `grep -ri "siren\|siret\|rcs\b" src/ messages/ app/` → 0.
- `grep -rE "#[0-9a-fA-F]{3,8}\b" src/ app/` → 0 hex hors `globals.css` + tokens.
- `grep -r "'use client'" src/ app/` → chaque occurrence justifiée par commentaire `// use-client: <raison>`.
- `grep -ri "stripe\|paddle\|lemon[ -]?squeezy\|payplug\|mollie" src/ app/` → 0.
- `grep -ri "resend\|mailchimp\|sendgrid\|brevo" src/ app/` → 0.
- `grep -ri "agence\|studio\|atelier" src/ app/ messages/` → 0 (sauf désignation concurrents en comparatif). « cabinet IA opérationnel » FR / « operational AI consultancy » EN partout.
- `grep -ri "axionia\b" src/ app/` (insensitive) — naming public **`Axion-IA`** partout (les identifiers JS conservent camelcase).

### 4.05 — Audit i18n parity

- `pnpm i18n:check` 0 erreur (parité FR/EN stricte clé à clé).
- 0 string hardcodée hors `messages/*.json` (script de scan AST).
- Hreflang FR↔EN + x-default sur **chaque** page.
- `pathnames` traduits cohérents (FR canon).
- Switcher de langue : E2E sur 5 pages → URL change, contenu traduit, pas de flash, pas de 404.
- Détection navigateur au premier visit + cookie mémoire ensuite.
- Sitemap multilingue avec `xhtml:link` hreflang sur chaque entry.
- Intl.\* primitives (Intl.NumberFormat, Intl.DateTimeFormat, Intl.PluralRules) utilisées partout — pas de `toLocaleString` ad-hoc.

### 4.06 — Audit accessibilité WCAG 2.2 AA + RGAA 4.1

- `pnpm a11y:audit` (axe-core + pa11y) sur toutes routes templates HEAD : 0 violation level AA.
- 15 pages parcourues clavier seul : ordre logique, pas de piège focus, skip-to-content fonctionne.
- Lecteurs d'écran NVDA + VoiceOver iOS + Narrator sur Hero, Form audit, FAQ, Calendrier, Simulateur ROI, Drawer mobile, Dialog admin.
- Touch targets ≥ 44×44 partout (linter custom).
- Contraste ratio ≥ 4.5:1 body, ≥ 3:1 large text, ≥ 7:1 idéal AAA.
- `prefers-reduced-motion: reduce` désactive **toutes** animations + view transitions.
- ARIA : pas d'`aria-*` sur `<button>`/`<a>` natifs (anti-pattern).
- Form errors : `role="alert"` + `aria-live="polite"`.
- `<html lang>` correct + sections multilingues `lang` attr.
- RGAA 4.1 niveau A + AA : 100 % conforme (déclaration accessibilité publiée si déploiement public obligatoire).

### 4.07 — Audit performance / Core Web Vitals (cibles internes AGENTS.md)

> Délégué à **AGT-PERF**. Cibles internes (plus strictes que Google « good ») :

- **LCP** ≤ 1 800 ms p75 (15 pages stratégiques).
- **INP** ≤ 100 ms p75 (exception `/reserver` ≤ 150 ms).
- **CLS** = 0 strict (cible interne ; Google « good » = 0,1).
- **TBT** ≤ 150 ms (Lighthouse lab desktop).
- **TTFB** ≤ 600 ms.
- **FCP** ≤ 1.8s mobile, ≤ 1s desktop.
- **First Load JS** ≤ 75 KB gz / route (V6) — exception `/reserver` ≤ 110 KB gz.
- CSS ≤ 50 KB par page (Tailwind purgé).
- Fonts total ≤ 100 KB woff2, `display: swap`, `font-feature-settings` optimisé.
- Images : AVIF/WebP/JPEG fallback, total ≤ 800 KB par page, LCP image `priority` + `fetchPriority="high"`.
- Below-the-fold : `loading="lazy"` + `decoding="async"`.
- Speculation Rules en `eagerness="moderate"` sur cards listing.
- View Transitions API actives entre listing → page produit.
- PPR (Partial Prerendering) static shell + Suspense boundaries.
- React Compiler activé, 0 `useMemo`/`useCallback` manuel.
- Lighthouse mobile ≥ 95 (perf/SEO/a11y/best-practices) sur 30 URLs échantillon.
- Lighthouse desktop ≥ 98 sur 10 pages critiques.
- RUM : web-vitals beacon endpoint reçoit des métriques.
- Sentry bundle ≤ 80 KB gz (cf. AUDIT-WEB-VITALS-2026 — lazy load + tracesSampleRate ramped).

### 4.08 — Audit cross-browser / cross-device

- Playwright suite passe sur :
  - Chromium · Firefox · WebKit (desktop)
  - iPhone 14 Pro · iPhone SE · Pixel 7 · Samsung S22 (mobile devices)
- Viewports : 360 / 479 / 768 / 992 / 1280 / 1440 / 1920.
- Visual regression : diffs < 0.1 % entre baseline et build.
- iOS Safari 17+ : View Transitions, AVIF, `<dialog>` natif, CSS `@container`, `font-display: swap`.
- Android Chrome : Speculation Rules supportés.

### 4.09 — Audit SEO (ranking factors 2026)

> Délégué à **AGT-SEO-AEO**. 150 critères / 15 chapitres × 10 (cf. `PROMPT-SEO-MASTER-2026.md`).

- Sitemap-index split + sitemap multilingue valide W3C, soumis Google Search Console + Bing Webmaster.
- robots.txt : allow par défaut, disallow `/admin*` + `/api/*` sauf `indexnow`.
- Canonical absolu sur **chaque** page.
- Hreflang `xhtml:link` sur sitemap + alternate `<link>` page.
- Title ≤ 60 chars + meta description 140-160 chars + Open Graph + Twitter `summary_large_image` (1200×630).
- JSON-LD complet par page (cf. § 4.10).
- IndexNow ping post-build automatique vers Bing/Yandex.
- **AGENT mode** : pages dynamiques pré-rendues server-side.
- **Search Generative Experience** : test 10 keywords cibles → présence Axion-IA dans AI Overviews Google.

### 4.10 — Audit AEO + GEO + LLMs (citability)

> Délégué à **AGT-SEO-AEO**.

#### 4.10.A · JSON-LD coverage

- `Organization` + `WebSite` + `BreadcrumbList` globaux.
- Spécifiques selon page : `Service`, `Article`, `FAQPage`, `QAPage`, `Question`/`Answer`, `Review`, `Person`, `DefinedTermSet`/`DefinedTerm`, `CollectionPage`, `ItemList`, `Offer`, `ProfessionalService` (LocalBusiness pages villes), `Place` (régions/villes), `NewsArticle` (presse).
- Validés via Google Rich Results Test pour 30 pages échantillon.

#### 4.10.B · llms.txt + llms-full.txt

- `llms.txt` présent à la racine (cf. axionia-seo-aeo).
- `llms-full.txt` présent et valide.
- Mentions « cabinet IA opérationnel » + signaux trust (OÜ, Estonie, registrikood, années expérience, équipe).

#### 4.10.C · Blocs réponse directe AEO

- 40-80 mots question→réponse en haut des pages produit pour citation LLM.
- FAQ AEO sur pages stratégiques.

#### 4.10.D · Citability test

Interroger Perplexity, ChatGPT, Claude, Google AI Overview sur 10 questions cibles :

1. « cabinet IA premium France »
2. « audit IA entreprise »
3. « intervention IA opérationnelle »
4. « consultant IA Paris »
5. « formation IA refusée éthique » (test négatif — pas de citation)
6. « tarif audit IA PME »
7. « OÜ estonienne consulting IA »
8. « stack IA recommandée 2026 »
9. « ROI IA opérationnelle »
10. « cabinet IA [ville pilote Paris/Lyon/Marseille] »

→ Noter présence Axion-IA + qualité snippet cité.

#### 4.10.E · GEO (villes/régions)

- 13 régions INSEE + 2 157 villes >5K hab France métro indexables.
- Anti-doorway HCU 2024 : ≥40 % unique par ville (cap doctrine ~95 % AxionIA-centric + ~5 % data INSEE).
- Classification INSEE 4 tailles (TPE/PME/ETI/grande-entreprise).
- Maillage interne services × villes pilotes via mega-menu + Footer.

### 4.11 — Audit sécurité

> Délégué à **AGT-SECURITY**. Couvre :

#### 4.11.A · OWASP ASVS 5.0 Level 2

- Authentification : argon2id, params 64MB/3/4, password ≥ 15 chars (NIST SP 800-63-4), pas de rotation forcée, breach checking via HIBP API k-anonymity.
- Auth.js v5 + 2FA TOTP + WebAuthn passkeys.
- Session : strategy `database`, max 8h, rotation au login, invalidée au logout.
- Rate limiting Redis sliding window : 5/min/IP login, 20/min/email.
- Brute force : ban temporaire après 6 tentatives.
- CSRF natif Auth.js + Cloudflare Turnstile sur forms publics.

#### 4.11.B · Headers HTTP

- CSP strict avec nonce dynamique (`script-src 'nonce-X' 'strict-dynamic'`).
- Trusted Types activé (`require-trusted-types-for 'script'`).
- HSTS 1 an + preload (`max-age=31536000; includeSubDomains; preload`).
- X-Frame-Options DENY.
- Referrer-Policy `strict-origin-when-cross-origin`.
- Permissions-Policy : camera/mic/geolocation/payment/usb/midi/sync-xhr `none`.
- COOP `same-origin`, CORP `same-origin`, COEP `require-corp` si applicable.
- securityheaders.com → note **A+** obligatoire.
- ssllabs.com → note **A+** obligatoire.

#### 4.11.C · Cookies

- Préfixe `__Host-`, `Secure`, `HttpOnly`, `SameSite=Lax` (Strict pour admin).

#### 4.11.D · Secrets & dépendances

- `gitleaks` 0 fuite (pré-commit hook actif).
- `pnpm audit` 0 high/critical.
- `trivy fs .` 0 high/critical sur images Docker.
- `semgrep` règles OWASP 0 finding bloquant.
- `codeql` (GitHub natif) 0 alerte high.
- Dependabot config + auto-merge sur patches verts.

#### 4.11.E · Tests pénétration

- OWASP ZAP baseline + full scan contre staging : 0 high, 0 critical, ≤ 5 medium documentés.
- SQL injection sur tous les forms (Zod doit bloquer).
- XSS sur tous les rendus (React échappe + Trusted Types).
- IDOR : tester accès admin avec session non-admin (refus + audit log).
- SSRF : aucune URL utilisateur fetchée server sans whitelist.
- File upload Phase 1 : pas de feature (sinon : type, size, extension, scan ClamAV).

### 4.12 — Audit base de données

> Délégué à **AGT-BACKEND**.

- Schema Prisma vs `02b-mapping-pages.md` modèles éditoriaux : aligné.
- Migrations `up`/`down`/`up` round-trip réussit sur DB fraîche.
- `pnpm db:seed` déterministe (mêmes IDs à chaque run).
- Indexes : `EXPLAIN ANALYZE` sur 10 requêtes critiques, scan séquentiel uniquement sur petites tables (< 500 rows).
- FTS Postgres : recherche article < 50ms sur 1000 articles seedés.
- Foreign keys ON DELETE / ON UPDATE explicites.
- Contraintes CHECK sur enums.
- `pg_stat_statements` activé, top 10 queries surveillées.
- `auto_explain` activé sur slow queries > 500 ms.
- Backups : pg_dump horaire vers Storage Box, restore drill réussi en sandbox < 30 min.
- Connexion pooling : PgBouncer mode `transaction` ou natif Prisma.
- Partitionnement `EmailLog` + `AuditLog` par mois.
- 0 N+1 (test via `prisma:query` log + sniper E2E).

### 4.13 — Audit auth & 2FA & WebAuthn

> Délégué à **AGT-BACKEND**.

- Login email + password réussit avec compte valide.
- Login refusé sans 2FA validée (E2E).
- TOTP setup → QR code → otpauth URI valide → vérification code.
- WebAuthn passkey création + utilisation (Playwright virtual authenticator).
- Reset 2FA via admin senior (audit log entry).
- Logout invalide la session immédiatement.
- Session expirée redirige vers login.
- Cookie session non lisible JS (HttpOnly).
- Audit log : login/logout/2FA-fail/reset/admin-action avec IP + user agent + timestamp.

### 4.14 — Audit forms & server actions

> Délégué à **AGT-BACKEND**.

- 5 forms multi-step : audit, implémentation, contact, newsletter, réservation.
- Validation Zod identique client + serveur (impossible bypass via Postman).
- Idempotency keys sur soumissions (double submit ne crée pas 2 records).
- Erreurs Zod traduites FR/EN.
- Cloudflare Turnstile présent et vérifié serveur.
- Confirmation email envoyée (queue BullMQ).
- Notification Telegram tag-based.
- Page `/confirmation/[type]` rend récap.
- Erreur serveur : Sentry capture + UX dégradée gracieuse.
- Anti-spam : honeypot + Turnstile + rate limit IP + email.

### 4.15 — Audit queue & jobs

> Délégué à **AGT-BACKEND**.

- BullMQ queues : `email`, `telegram`, `indexnow`, `db-cleanup`, `email-warmup`, `sitemap-rebuild`, `pseo-publish`.
- Worker process séparé déployé (Coolify 2 services).
- Retry exponentiel 5 essais.
- Dead letter queue sur échec définitif.
- bull-board accessible admin only.
- OpenTelemetry traces sur job lifecycle.
- Test : tuer un worker → jobs reprennent au redémarrage.

### 4.16 — Audit emails

> Délégué à **AGT-BACKEND**.

- 7 templates React Email × 2 langues = 14 envois testés.
- Mail-tester score ≥ 9/10 sur **chacun**.
- DKIM 2048 valide (`mxtoolbox.com/dkim.aspx`).
- SPF strict (`v=spf1 ip4:<dedicated> -all`).
- DMARC `p=quarantine` au démarrage, `p=reject` après warmup réussi.
- BIMI optionnel (différé si pas de VMC).
- One-Click Unsubscribe RFC 8058 fonctionnel.
- List-Unsubscribe-Post header présent.
- Reverse DNS sur IP dédiée → `mail.axion-ia.com`.
- ARC seal sur emails forwardés.
- FBL Microsoft + Google + Yahoo configurés.
- Warmup IP : courbe documentée, bounce/complaint < 2 % / 0.1 %.
- EmailLog DB capture status, opens, clicks.
- Webhook bounce/complaint → `EmailLog.status` + désinscription auto si hard bounce.

### 4.17 — Audit console admin (14 sections)

> Délégué à **AGT-BACKEND**.

- 14 sections accessibles uniquement après login + 2FA.
- Login admin séparé sous `[ADMIN_URL_PREFIX]` (env), URL non devinable.
- Dashboard KPIs : soumissions/jour, bookings, articles, latence p95.
- CRUD articles avec Tiptap + preview + planification + multilingue.
- CRUD FAQ, témoignages, cas concrets, help, calendar_options, villes pSEO.
- Soumissions : liste + détail + statut + export CSV.
- Réservations : timeline status `DEMANDE_RECUE → DEVIS_ENVOYE → EN_ATTENTE_VIREMENT → PAYE → LIVRE` (cf. \_NO-STRIPE).
- Email campaigns : iframe MailWizz ou lien externe.
- Logs : embed Sentry events.
- Audit log : trace toutes mutations admin.
- Confirmations destructives via Dialog.
- Permissions : super-admin vs admin standard.
- Dashboard pSEO stats (Sprint 20) : trafic par ville/région/phase.

### 4.18 — Audit infra & déploiement

> Délégué à **AGT-INFRA**.

- VPS Hetzner CPX32 Nuremberg up (IP `178.105.55.15` `axionia-web`).
- Storage Box BX11 1 To monté (backups).
- IP dédiée mail correctement reverse-DNS.
- Coolify déploie web + worker + powermta + mailwizz + postgres + redis.
- Cloudflare Free proxy on, WAF rules actives, Turnstile siteverify ok.
- SSL auto-renouvelé (Caddy 2), grade A+ ssllabs.com.
- DNS axion-ia.com (Namecheap) : A/AAAA web, MX mail, SPF/DKIM/DMARC, BIMI optionnel.
- HTTP/3 activé.
- 103 Early Hints activés.
- Brotli 11 static + Zstd dynamic.
- Backup test : restaurer un backup horaire en sandbox réussi.
- DR drill : couper VPS → restaurer ailleurs en < 2h, documenté `_AUDIT/08-disaster-recovery.md`.
- CI/CD : push main → Coolify webhook → deploy + migrations + smoke tests.
- SSH hardened + fail2ban actifs.

### 4.19 — Audit observabilité

> Délégué à **AGT-INFRA**.

- Plausible self-hosted `analytics.axion-ia.com`, custom events conversions.
- Sentry self-hosted `sentry.axion-ia.com`, sourcemaps uploadés, performance monitoring + session replay 5 % + profiling.
- Uptime Kuma `status.axion-ia.com`, ≥ 10 checks (web FR, web EN, admin, sitemap, llms.txt, smtp, postgres, redis, calendrier, blog rss).
- Pino structured JSON + journald → loki si déployé, `trace_id`/`span_id` présents.
- OpenTelemetry instrumenté Node, traces corrélées logs.
- web-vitals beacon Edge → ClickHouse ou Plausible custom props.
- Telegram bot alerts : downtime, erreurs Sentry critiques, queues backlog > seuil.
- Synthetic transactions Uptime Kuma : login admin, soumission audit, lecture article, switcher FR/EN.
- Lighthouse historique quotidien : alerte si régression > 5 points.
- Alertes testées (faux incident).

### 4.20 — Audit RGPD & légal

- Mentions « OÜ estonienne » + registrikood + adresse Estonia.
- Aucune mention SIREN/SIRET/RCS.
- TVA EE selon résidence client (B2B intra-UE auto-liquidation, B2C TVA pays client).
- 6 légales présentes et conformes (mentions, CGU, CGV, politique confidentialité, cookies, déplacement).
- Cookie banner conforme CNIL : accepter / refuser / personnaliser au même niveau visuel.
- Plausible RGPD-compliant (sans cookie + sans IP en clair).
- Registre traitements : documenté, accessible.
- DPA sous-traitants : Hetzner, Cloudflare (DPA EU SCC), GitHub, Sentry/Plausible self-hosted.
- Transferts hors UE : aucun.
- Droits utilisateurs : page `/mes-donnees` (export, suppression, rectification) fonctionnelle.
- DPO : nommé ou délégué (cabinet externe), email contact RGPD documenté.
- One-Click Unsub fonctionnel (RFC 8058).
- Newsletter : double opt-in.
- Délais conservation documentés (sub : 3 ans, EmailLog 13 mois, AuditLog 1 an).

### 4.21 — Audit business flows end-to-end

> Délégué à **AGT-BACKEND**.

- **Flow audit demande** : `/audit` → `/audit/demande` → 5 étapes → submit → confirmation → email reçu → Telegram reçu → admin voit ligne dans `/admin/soumissions`.
- **Flow intervention réservation** : `/interventions/essentielle` → CTA « Réserver 490 € » → calendrier → form → confirmation → email + Telegram + admin booking.
- **Flow implémentation contact** : 4 étapes → confirmation.
- **Flow newsletter** : footer → email → double opt-in → confirmé en DB → unsubscribe RFC 8058.
- **Flow contact** : `/contact` → submit → email Will + auto-reply utilisateur.
- **Flow blog publication** : admin crée article → planifie → publication automatique → visible `/blog` → visible RSS → IndexNow ping.
- **Flow recherche** : `/recherche?q=...` → résultats agrégés (articles, cas, FAQ, help, services).
- **Flow exercice droits RGPD** : `/mes-donnees` → form → email avec lien token → export ZIP données ou suppression confirmée.
- **Flow désabonnement** : email reçu → clic unsub → landing → confirmation 1 clic → DB updated → audit log.
- **Flow pSEO ville** : `/audit/par-ville/[ville]` → CTA → form audit pré-rempli avec referrerCity → soumission → tracking referrerCity en DB.

### 4.22 — Audit cohérence skills

> Délégué à **AGT-SKILLS**.

- 18 skills `axionia-*` × 5 fichiers échantillonnés = 90 spot checks.
- Règles SKILL.md effectivement appliquées dans le code.
- LOCKs sur 22 skills génériques actifs (commentaire `> ⚠️ Axion-IA: voir axionia-X`).
- Liste écarts.

### 4.23 — Audit documentation

- README.md : setup + commands + arborescence + liens vers ADRs.
- `docs/adr/0001` à `0009` valides format Michael Nygard.
- `CHANGELOG.md` initialisé (Sprint 21) — `v0.X.Y` via `changesets` ou conventional-changelog.
- `SESSION_LOG.md` à jour.
- `_AUDIT/07-runbook.md` : rollback, restore, rotation DKIM, incidents emails, fuite, perte de domaine.
- `_AUDIT/08-disaster-recovery.md` : drill DR documenté avec captures.
- `docs/ops/dns-records.md` + `docs/ops/runbook-deploy.md` à jour.
- API/Server actions : JSDoc minimal sur exports publics.
- Comments : présents uniquement où le « pourquoi » n'est pas évident.
- Pas de doc obsolète (références ancienne charte McKinsey, anciennes routes Webflow v1, ADR 0001 superseded).

### 4.24 — Audit production readiness

> Délégué à **AGT-INFRA**.

- Charge testing k6 : 100 RPS sur la home, p95 < 500 ms, p99 < 1 s.
- Soak test : 24h trafic réaliste sans memory leak (mesurer RSS Node).
- Failover test : couper postgres 30s → app dégrade gracieusement (page d'erreur statique CDN), récupère < 10s post-restore.
- Failover Redis : queue mise en pause, reprend à la reconnexion.
- Failover SMTP : emails en queue, retry exponentiel.
- Smoke prod : 10 scénarios golden après déploiement, alerte Telegram si rouge.
- Monitoring 30 min post-deploy obligatoire avant clôture release.
- Rollback : commande `coolify rollback` testée mensuellement.

### 4.25 — Audit régression vs livré

- Comparer état actuel à `RAPPORT_AUDIT_v10.1.md` (404/404 06/05/2026).
- Comparer à `_AUDIT/AUDIT-PARITY-V14-FINAL.md` (parity 92 %).
- Aucune des 25 catégories vertes ne doit être rouge.
- Aucun finding clos en Pass A précédent ne doit être réapparu.
- Lighthouse historique : pas de régression > 5 points.
- Bundle : pas d'augmentation > 10 % sans justification.

### 4.26 — Audit scale (100-300 URLs/jour pSEO)

- Pipeline content factory : 100-300 URLs/jour démontré end-to-end (Vague D Certification).
- ISR fonctionnel + Cloudflare cache purge automatisé sur publish.
- Quality gate auto pré-publish actif (anti-doorway, ≥ 40 % unique, JSON-LD).
- Sitemap-index split à jour (par 50K URLs).
- IndexNow ping batch.
- Dashboard pSEO stats `/admin/pseo-stats` reflète l'industrialisation.

### 4.27 — Audit obsolescences (cible Phase 3)

> Lister, **sans supprimer** en Phase 1.

- Code mort : `knip` + `ts-prune` + `dpdm`.
- Routes orphelines vs `02b-mapping-pages.md`.
- Composants non importés.
- Dépendances non utilisées : `depcheck`.
- Migrations Prisma anciennes squashables (post Sprint 21).
- Skills/ADR superseded à archiver (ex. ADR 0001 design Webflow superseded).
- Docs obsolètes : `Axion-IA_Dossier_FINAL_ABSOLU_v10.1/Design.md` archivé (référencé comme « do not use »).
- Branches Git anciennes mergées.
- Variables env inutilisées : audit `.env.example` vs grep `process.env`.
- Tests `xfail` / `skip` / `todo` à expirer.
- Mémoires `axionia_*` obsolètes (ex. session logs anciens, décisions superseded).

### 4.28 — Audit raccordements & croisements (intégrité référentielle système)

- Tous boutons CTA pointent vers une route existante (linter custom + crawl interne).
- Tous formulaires soumettent vers une server action existante.
- Tous emails templates renvoient vers une URL canonique valide (token de désinscription, lien article, etc.).
- Tous webhooks (Coolify, Cloudflare, Stripe-NO, IndexNow, Bounce, Telegram) sont câblés et testés.
- Toutes les variables env documentées dans `.env.example` et lues quelque part.
- Toutes les FK Prisma ont une migration générée.
- Toutes les tables ont un seed sample (sauf log tables).
- Toutes les queues BullMQ ont un consumer worker actif.
- Tous les jobs cron sont enregistrés et monitorés.
- Tous les skills `axionia-*` sont référencés dans au moins un audit ou un ADR.
- Tous les ADR sont liés depuis `README.md` et `_AUDIT/02-PLAN.md`.

### 4.29 — Audit best-practices 2026 oubliées

> Mini-checklist transverse pour ne rien manquer :

- [ ] **Web Components** ou Server Components partout pertinent.
- [ ] **`use cache`** directive Next 16 utilisée sur fetch déterministes.
- [ ] **Streaming SSR** sur toutes pages avec data fetching long.
- [ ] **Edge runtime** sur middleware (auth check, geoip, A/B).
- [ ] **Error boundaries** par segment de route.
- [ ] **Loading.tsx** par segment de route (UX progressive).
- [ ] **Not-found.tsx** par segment + global.
- [ ] **Manifest.json** PWA + theme-color.
- [ ] **opengraph-image.tsx** + **twitter-image.tsx** par segment.
- [ ] **icon.tsx** + **apple-icon.tsx** + **favicon.ico**.
- [ ] **`generateStaticParams`** explicit pour SSG, pas de fallback non documenté.
- [ ] **`revalidate`** explicit + tags pour ISR.
- [ ] **Cloudflare Cache-Tag** + purge sur publish.
- [ ] **Subresource Integrity** sur scripts externes (s'il en reste — il ne devrait pas).
- [ ] **Reporting API** (CSP report-to + crash report-to + permissions-policy report-to).
- [ ] **Network Error Logging (NEL)** activé.
- [ ] **Server Timing** headers pour profiling RUM.
- [ ] **HTTP Structured Field Values** RFC 9651 (Cookies, etc.).
- [ ] **Origin-Agent-Cluster: ?1** activé.
- [ ] **CHIPS** (Cookies Having Independent Partitioned State) si tracking nécessaire.
- [ ] **Privacy Sandbox** : aucune intégration FLEDGE/Topics (cabinet B2B premium).
- [ ] **AI bot directives** : `User-agent: GPTBot/PerplexityBot/Claude-Web/Google-Extended` dans robots.txt → policy explicite (allow ou disallow consciemment).
- [ ] **Dark mode** : `prefers-color-scheme` géré ou volontairement non supporté (ADR).
- [ ] **Container queries** + `@container` utilisés où pertinent (cards listing).
- [ ] **`scroll-snap`** sur carrousels (pas de JS).
- [ ] **`<dialog>` natif** + `showModal()` partout sauf cas custom justifié.
- [ ] **`popover` API** Web Platform pour menus/tooltips.
- [ ] **`anchor()` CSS positioning** (Chrome 125+) pour tooltips.
- [ ] **`view-transition-name`** sur éléments traversant les routes.
- [ ] **`content-visibility: auto`** sur sections below-the-fold longues.
- [ ] **`will-change`** uniquement avant transform animé, retiré après.
- [ ] **Resource Hints** : `preconnect` fonts + analytics + Plausible, `dns-prefetch` images CDN, **pas de `prefetch` global**.
- [ ] **Critical CSS inlined** sur pages high-traffic.
- [ ] **Tree-shaking icônes** : Lucide imports nominatifs, pas `import * as icons`.
- [ ] **`React.lazy` + Suspense** sur composants below-the-fold lourds.
- [ ] **`<picture>` + `srcset`** pour art direction (vs `next/image` simple).
- [ ] **OAuth 2.1 + PKCE** sur tout flow OAuth (s'il en existe).
- [ ] **WebAuthn `attestation: none`** par défaut (privacy).
- [ ] **Passkey autofill** sur login.
- [ ] **Zod 4** sur tout boundary (form, API, env).
- [ ] **`zod.parse(env)`** au boot (validation env vars).
- [ ] **TS `verbatimModuleSyntax`** + `isolatedModules` activés.
- [ ] **Strict mode** TS partout (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- [ ] **ESLint flat config** (eslint.config.mjs) à jour.
- [ ] **Biome** considéré comme alternative ESLint+Prettier (ADR à rédiger si retenu, sinon documenter le rejet).
- [ ] **Prettier 4** activé.
- [ ] **`.editorconfig`** présent.
- [ ] **Husky + lint-staged + commitlint** actifs.
- [ ] **Conventional Commits** strict.
- [ ] **changesets** ou `release-please` pour versioning.
- [ ] **GitHub Actions** : CI matrix Node 20+22 LTS + cache pnpm + concurrency cancel.
- [ ] **Renovate** ou **Dependabot** + auto-merge patches verts.

### 4.30 — Audit AI bot policy & content licensing

- robots.txt : User-agents IA listés explicitement avec allow/disallow argumenté.
- LLM training opt-out documenté (`X-Robots-Tag: noai, noimageai` si voulu).
- Conditions d'utilisation : licence contenu claire (citation OK, scraping commercial interdit, etc.).
- Respect HCU 2024 : E-E-A-T signaux (Auteur, Date, Updated, About, Contact, Editorial standards page).

---

## 5. RAPPORT PASS A — `_AUDIT/VERIF-COMPLETE-A-fullstack.md`

Structure imposée :

```markdown
# Rapport vérification complète — Axion-IA — Pass A (audit)

- Date : 2026-XX-XX
- Auditeur : Claude Opus 4.7 (1M context)
- Commit audité : <sha>
- Branche : <branch>
- Environnement : <local|staging|prod>
- Sprint : <sprint number / version tag>

## 1. Verdict global

- [ ] PRODUCTION READY ✅
- [ ] PRODUCTION READY avec réserves mineures ⚠️
- [ ] NOT PRODUCTION READY ❌

## 2. Compteurs

- P0 (bloquants) : N
- P1 (majeurs) : N
- P2 (mineurs) : N
- P3 (cosmétiques) : N
- Total findings : N
- Total checks exécutés : N
- Taux conformité : N %

## 3. Findings P0 (à corriger AVANT toute mise en prod)

| ID  | Titre | Chapitre | Fichier:ligne | Reproduction | Impact | Action proposée Phase 2 |
| --- | ----- | -------- | ------------- | ------------ | ------ | ----------------------- |

## 4. Findings P1 / P2 / P3

(idem)

## 5. Comparaison avec rapports antérieurs

- v10.1 (06/05/2026) : 404/404
- Pass A précédent (si existant) : ...
- Pass A présent : ...
- Régressions : N

## 6. Métriques clefs

| Métrique                  | Cible      | Mesuré | OK  |
| ------------------------- | ---------- | ------ | --- |
| Lighthouse mobile médian  | ≥ 95       | ...    |     |
| Lighthouse desktop médian | ≥ 98       | ...    |     |
| LCP mobile p75            | ≤ 1 800 ms | ...    |     |
| INP p75                   | ≤ 100 ms   | ...    |     |
| CLS p75                   | = 0        | ...    |     |
| First Load JS max         | ≤ 75 KB gz | ...    |     |
| Coverage Vitest           | ≥ 80 %     | ...    |     |
| Playwright runs           | ≥ 240      | ...    |     |
| axe violations total      | 0          | ...    |     |
| OWASP ZAP high            | 0          | ...    |     |
| Mail-tester min           | ≥ 9/10     | ...    |     |
| Headers grade             | A+         | ...    |     |
| SSL grade                 | A+         | ...    |     |

## 7. AEO citability snapshot

| Question | Perplexity | ChatGPT | Claude | Google AIO |
| -------- | ---------- | ------- | ------ | ---------- |

## 8. Plan Phase 2 (auto-fix)

- Patches automatisables : N
- Patches semi-auto (revue 1 humain) : N
- Patches manuels (escalade Will) : N
- Estimation effort : N heures

## 9. Plan Phase 3 (cleanup obsolète)

- Code mort à supprimer : N fichiers / N lignes
- Routes orphelines : N
- Deps inutiles : N
- Docs périmés : N

## 10. STOP & ASK ouverts pour Will

- ...

## 11. Signatures

- Auditeur : Claude Opus 4.7
- Validation Will Phase 2 : ☐ OUI ☐ NON ☐ AVEC RÉSERVES
```

---

## 6. PHASE 2 — AUTO-FIX AVEC GARDE-FOUS

### 6.A · Politique de fix

Pour **chaque finding** en P0 + P1, classer :

| Classe     | Critères                                                                                | Action                                            |
| ---------- | --------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **AUTO**   | Patch déterministe, ≤ 30 lignes diff, zéro risque sémantique, couvert par test existant | Fixer + commit dédié + push branche `fix/audit-A` |
| **SEMI**   | Patch ≤ 100 lignes, sémantique claire, test couvre ou test ajouté                       | Fixer + commit dédié + ouvrir draft PR            |
| **MANUEL** | Refactor structurel, > 100 lignes, ou décision business, ou impact UX visible           | Documenter dans rapport § 8, escalader Will       |

### 6.B · Check-list garde-fous (avant chaque commit Phase 2)

1. `pnpm typecheck` 0 erreur.
2. `pnpm lint` 0 erreur.
3. `pnpm test` (vitest unit) 0 fail.
4. `pnpm test:integration` 0 fail.
5. `pnpm test:e2e` (Playwright smoke) 0 fail.
6. `pnpm build` réussit.
7. `pnpm size-limit` : pas de régression > +5 KB gz vs `main`.
8. `pnpm lhci` : pas de régression > 5 points sur les 15 pages stratégiques.
9. `pnpm i18n:check` : parité FR/EN intacte.
10. `pnpm a11y:audit` : 0 violation supplémentaire vs Pass A baseline.
11. `pnpm radius:check` + scripts custom (anti-hex, anti-formation, anti-noir-pur, anti-resend, anti-stripe).
12. Préservation fonctionnelle : pour chaque flow (4.21), exécuter au moins 1 smoke test E2E avant et après le patch.

### 6.C · Format commits Phase 2

```
fix(audit-A): <résumé court>

Finding ID: <ID>
Chapitre: <4.XX>
File(s): <list>
Repro avant: <commande/URL>
Vérif après: <commande/URL>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

### 6.D · Branche & flow Git

- Créer une branche `fix/verif-complete-{date}` depuis `main`.
- 1 commit par finding (granularité fine).
- Push après chaque batch de 10 commits.
- Ouvrir 1 draft PR `[Verif Complete] Phase 2 auto-fix batch <N>` pour revue.
- **Aucun push sur `main` directement**.

### 6.E · Préservation absolue

- **Avant** chaque patch potentiellement risqué :
  1. Crawler local pour capturer un snapshot du flow concerné (URL, status, DOM key elements, JSON-LD, headers).
  2. Sauvegarder le snapshot dans `_AUDIT/snapshots/before/<finding-id>.json`.
- **Après** le patch :
  1. Re-crawler.
  2. Diff snapshot avant/après.
  3. Tout delta non attendu = **rollback** + reclassifier en MANUEL.

### 6.F · STOP & ASK Will (escalade obligatoire)

Toujours arrêter et demander à Will avant :

- Modifier un ADR.
- Modifier un skill `axionia-*`.
- Renommer un endpoint API public.
- Modifier un schéma Prisma de table avec données prod.
- Modifier un template email envoyé à des destinataires réels.
- Modifier la palette / typographie / radius (figés ADR 0002/0007/etc.).
- Modifier un texte légal (mentions, CGU, CGV, politique conf, cookies, déplacement).
- Modifier un copy UI multilingue à fort impact (Hero home, CTA principaux).

---

## 7. PHASE 3 — SUPPRESSION OBSOLÈTE CONTRÔLÉE

### 7.A · Cibles de suppression (lister en Phase 1, supprimer en Phase 3)

1. **Code mort** : sortie `knip` + `ts-prune` + `dpdm`.
2. **Routes orphelines** : pages générées non listées dans `02b-mapping-pages.md` ET non liées depuis aucune nav.
3. **Composants non importés** : grep `import .* from '@/components/<X>'` → 0.
4. **Dépendances inutiles** : `depcheck` + grep imports.
5. **Variables env inutilisées** : `.env.example` ⊕ grep `process.env`.
6. **Skills/ADR superseded** : déplacer vers `archive/` avec entête `> ⚠️ Superseded by ADR XXXX`.
7. **Docs obsolètes** : `Axion-IA_Dossier_FINAL_ABSOLU_v10.1/Design.md` Webflow, anciennes copies, fichiers `*-OLD-*`, sessions logs > 6 mois si déjà résumés.
8. **Migrations Prisma anciennes** : squash post-Sprint 21 si pas de rollback nécessaire (validation Will).
9. **Branches Git** : `git branch --merged main` (lecture seule, suppression validation Will).
10. **Tests `skip`/`xfail`/`todo`** dont le ticket est fermé.
11. **Mémoires `axionia_*` obsolètes** : marquer dans MEMORY.md ou supprimer.
12. **Assets binaires** : images non référencées dans `public/` ou `_AUDIT/snapshots/` après expiration.
13. **Logs `_AUDIT/`** anciens si déjà agrégés dans un rapport master.

### 7.B · Procédure de suppression

Pour chaque cible :

1. **Audit reference** : grep insensitive sur le nom (filename, identifier, slug) dans tout le repo + umbrella.
2. **Audit prod** : si possible, vérifier 30 jours de logs Sentry/Plausible sans hit (lecture seule).
3. **Quarantaine** : déplacer vers `_archive/<date>/<path>` avant suppression dure.
4. **Build + tests** : `pnpm build && pnpm test && pnpm test:e2e` 0 fail.
5. **Commit** : `chore(cleanup): supprime <X> obsolète` avec finding ID.
6. **Garde quarantaine** : 1 sprint minimum avant suppression définitive du `_archive/`.

### 7.C · STOP-LIST suppression (jamais sans Will)

- Migrations Prisma déjà appliquées en prod.
- Templates emails déployés.
- Routes ayant trafic Plausible > 0 sur 30 jours.
- ADRs/Skills (uniquement archivage avec « superseded »).
- Backups DB.
- Données utilisateurs (RGPD : droit à l'effacement uniquement sur demande).
- Audit logs (1 an de conservation minimum).

### 7.D · Format commits Phase 3

```
chore(cleanup): supprime <X> obsolète

Finding ID: <ID>
Chapitre: 4.27
References vérifiées (0 hit): grep -ri "<term>" .
Quarantaine: _archive/<date>/<path>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 8. PHASE 4 — RE-AUDIT PASS B

### 8.A · Lancer un audit identique à Phase 1 sur le HEAD post-fix

Réutiliser le même DISPATCH (8 agents) + mêmes 30 chapitres.

### 8.B · Comparaison Pass A vs Pass B

Dans le rapport `_AUDIT/VERIF-COMPLETE-B-fullstack.md`, ajouter une matrice :

| ID Finding Pass A | Statut Pass B | Justification    |
| ----------------- | ------------- | ---------------- |
| VC-001 (P0)       | ✅ Fermé      | Patch <commit>   |
| VC-002 (P1)       | ⚠️ Reporté    | Manuel Will TODO |
| VC-003 (P0)       | ❌ Régressé   | Re-fix Phase 2.1 |

### 8.C · Garde-fous régression

- **Aucun finding fermé en Pass A ne doit être réouvert en Pass B**. Si oui → P0 « régression bloquante ».
- **Aucune nouvelle catégorie rouge** vs Pass A sans justification.
- **Métriques clefs** : aucune dégradation > 5 % sur Lighthouse, bundle, CWV, coverage tests, mail-tester.
- **Flows métier (§ 4.21)** : 100 % verts en Pass B ou rollback de la Phase 2 incriminée.

### 8.D · Verdict final

```markdown
# Verdict final — Pass B

- [ ] GO PRODUCTION ✅ (P0 = 0, P1 ≤ 5 documentés acceptés)
- [ ] GO PRODUCTION avec réserves ⚠️ (P0 = 0, P1 ≤ 10)
- [ ] NO-GO ❌ (P0 > 0)

Action Will : ☐ Merge fix/verif-complete-{date} dans main · ☐ Tagguer release v1.0.0 · ☐ Déclencher déploiement Coolify · ☐ STOP rollback
```

### 8.E · Boucle si NO-GO

Si verdict NO-GO Pass B :

1. Lister les findings reouverts/regression dans § 8.B.
2. Ouvrir `_AUDIT/VERIF-COMPLETE-B-actions.md` avec plan de remédiation.
3. Re-lancer Phase 2 ciblée → Phase 4 (boucle bornée à 3 itérations max, sinon STOP & ASK Will).

---

## 9. CALENDRIER & EFFORT ESTIMÉ

| Phase     | Description                | Effort estimé | Output                                     |
| --------- | -------------------------- | ------------- | ------------------------------------------ |
| Phase 0   | Bootstrap + chargement SoV | 30 min        | TaskCreate + tracking log                  |
| Phase 1   | Audit exhaustif 8 agents   | 2-4 h         | `VERIF-COMPLETE-A-fullstack.md`            |
| Phase 1.5 | Validation Will plan fix   | 30 min        | STOP & ASK § 8 du rapport                  |
| Phase 2   | Auto-fix + commits         | 4-12 h        | Branche `fix/verif-complete-{date}` + PR   |
| Phase 3   | Cleanup obsolète           | 2-4 h         | `_archive/<date>/` + commits               |
| Phase 4   | Re-audit Pass B            | 2-4 h         | `VERIF-COMPLETE-B-fullstack.md` + verdict  |
| **Total** |                            | **11-25 h**   | Plateforme certifiée production-ready 2026 |

---

## 10. STOP & ASK CHECKPOINTS (récapitulatif)

L'agent principal **doit s'arrêter et demander Will** aux moments suivants :

1. **Fin Phase 1** — présenter rapport Pass A + plan Phase 2/3 → Will valide GO/PIVOT/STOP.
2. **Avant chaque modification ADR / skill / palette / typographie / radius / endpoint API public / template email prod / texte légal**.
3. **Avant suppression définitive depuis `_archive/`** (1 sprint quarantaine min).
4. **Avant tout `git push --force` ou `coolify rollback`** (interdits sans Will).
5. **Si Phase 4 verdict NO-GO 3 fois consécutives** → escalade.
6. **Si découverte d'une vulnérabilité critique exploitée** (zero-day actif) → escalade immédiate avant tout patch.

---

## 11. INVOCATION

Au démarrage, **agir comme suit** dans une fenêtre Claude Code fraîche depuis `axionia/` :

1. Lire ce prompt en intégralité.
2. Charger les 19 sources de vérité § 1.
3. Confirmer en 5 lignes :
   - Commit HEAD audité (`git rev-parse HEAD`).
   - Branche.
   - Sprint courant.
   - Date.
   - Liste des 8 agents qui vont être lancés.
4. Créer `_AUDIT/VERIF-COMPLETE-RUN-LOG-YYYY-MM-DD.md` (tracking).
5. Lancer les 8 agents Phase 1 dans **un seul message** (parallèle).
6. Pendant que les agents tournent, exécuter chapitres 4.01, 4.04, 4.05, 4.06, 4.09 (head check), 4.22, 4.23, 4.25 toi-même.
7. Agréger en `_AUDIT/VERIF-COMPLETE-A-fullstack.md`.
8. STOP & ASK Will : « OUI on enchaîne Phase 2 auto-fix / SEMI fixons P0 only / NON je relis d'abord ».
9. Selon réponse, exécuter Phase 2, 3, 4 dans l'ordre.
10. Livrer verdict final + tag release proposé.

---

## 12. ANNEXES

### 12.A · Commandes utiles (référence)

```powershell
# Audit code
pnpm typecheck; pnpm lint; pnpm format:check; pnpm test; pnpm test:integration
pnpm build; pnpm lhci; pnpm size-limit
pnpm i18n:check; pnpm a11y:audit; pnpm radius:check

# Dead code
pnpm dlx knip
pnpm dlx ts-prune
pnpm dlx dpdm src/
pnpm dlx depcheck
pnpm dlx madge --circular src/

# Sécurité
pnpm audit --audit-level=high
pnpm dlx gitleaks detect --no-banner
docker run --rm -v "${PWD}:/src" aquasec/trivy fs --severity HIGH,CRITICAL /src
pnpm dlx semgrep --config=auto src/

# Crawl
pnpm dlx wget --spider --recursive --level=3 http://localhost:3000

# DB
pnpm prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma
pnpm prisma db seed

# E2E
pnpm playwright test
pnpm playwright test --project=mobile-iphone-se
```

### 12.B · Localisation des skills à charger en référence

- `axionia-package/skills/axionia-anti-formation/`
- `axionia-package/skills/axionia-anti-siren/`
- `axionia-package/skills/axionia-anti-hex/`
- `axionia-package/skills/axionia-anti-noir-pur/`
- `axionia-package/skills/axionia-doctrine-v3/`
- `axionia-package/skills/axionia-typography-v3-2/`
- `axionia-package/skills/axionia-hero-schema-v3-3/`
- `axionia-package/skills/axionia-naming-cabinet/`
- `axionia-package/skills/axionia-pricing-ssot/`
- `axionia-package/skills/axionia-seo-aeo/`
- `axionia-package/skills/axionia-pseo-villes/`
- `axionia-package/skills/axionia-i18n-parity/`
- `axionia-package/skills/axionia-a11y-wcag22/`
- `axionia-package/skills/axionia-perf-budgets/`
- `axionia-package/skills/axionia-security-asvs/`
- `axionia-package/skills/axionia-no-stripe/`
- `axionia-package/skills/axionia-no-resend/`
- `axionia-package/skills/axionia-rgpd-ou/`

### 12.C · Référence cross-prompts (NE PAS dupliquer le travail)

Quand un chapitre recoupe un prompt existant, **déléguer** au prompt en référence :

| Chapitre               | Prompt délégué                                                    |
| ---------------------- | ----------------------------------------------------------------- |
| 4.07 Web Vitals        | `_AUDIT/PROMPT-WEB-VITALS-PERFECTION-2026.md`                     |
| 4.09 SEO               | `_AUDIT/PROMPT-SEO-MASTER-2026.md`                                |
| 4.10 AEO/GEO           | `_AUDIT/PROMPT-SEO-AEO-GEO-2026.md`                               |
| 4.03 Doctrine          | `_AUDIT/PROMPT-FRONTEND-AUDIT-V14-2026.md`                        |
| 4.03.B Typo            | `_AUDIT/PROMPT-TYPOGRAPHY-2026.md`                                |
| Visual rhythm          | `_AUDIT/PROMPT-VISUAL-RHYTHM-2026.md`                             |
| Code health            | `_AUDIT/PROMPT-CODE-HEALTH-2026.md`                               |
| Header/Nav             | `_AUDIT/PROMPT-HEADER-NAVIGATION-2026.md`                         |
| Page audit per-page    | `_AUDIT/PROMPT-PAGE-AUDIT-PERFECT-2026.md`                        |
| Doc-sync               | `_AUDIT/PROMPT-DOC-SYNC-V14.md`                                   |
| Parity FR/EN           | `_AUDIT/PROMPT-FRONTEND-PARITY-CHECK.md`                          |
| Frontend deep          | `_AUDIT/PROMPT-FRONTEND-DEEP-CHECK.md`                            |
| Certification frontend | `_AUDIT/CERTIFICATION-FRONTEND-2026/00-MASTER-ORCHESTRATOR.md`    |
| 4.18 Infra             | `_AUDIT/CERTIFICATION-FRONTEND-2026/20-SCALABILITY-INFRA-2026.md` |
| 4.11 Sécurité          | `_AUDIT/CERTIFICATION-FRONTEND-2026/15-SECURITY-FRONTEND-2026.md` |
| 4.06 A11y              | `_AUDIT/CERTIFICATION-FRONTEND-2026/06-A11Y-WCAG22-RGAA-2026.md`  |
| Tests coverage         | `_AUDIT/CERTIFICATION-FRONTEND-2026/16-TESTS-COVERAGE-2026.md`    |

L'agent principal **agrège** les résultats — il ne rejoue pas le contenu du prompt délégué.

### 12.D · Format finding ID

`VC-{Pass}-{ChapNum}-{SeqNum}` exemple : `VC-A-04.10-007` = Pass A, chapitre 4.10, finding #7.

### 12.E · Tags Git release

À la fin Pass B verdict GO :

- Branche `fix/verif-complete-{date}` mergée dans `main`.
- Tag `v1.0.0` (ou `v1.X.Y` selon versioning).
- CHANGELOG.md mis à jour avec section dédiée « Production readiness Verif Complete {date} ».

---

## FIN DU PROMPT

> **Rappel** : ce prompt est lourd (≥ 11h d'effort estimé). Il est dimensionné pour une **fenêtre Claude fraîche** avec budget tokens long. Si la session approche le seuil, **tronquer en livrant Pass A complet + plan Phase 2/3/4** et demander à Will de relancer dans une nouvelle fenêtre pour les phases suivantes.
>
> Ne jamais sauter Pass B : c'est lui qui certifie « production-ready ».
