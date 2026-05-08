# 🔬 PROMPT VÉRIFICATION FINALE — Axion-IA · Audit production readiness

> 📌 **Lire d'abord [`_AUDIT/SYNC-NOTICE-2026-05-07.md`](./SYNC-NOTICE-2026-05-07.md)** pour les évolutions HEAD `fd91518` (post-Sprint 14.5-14.9).
>
> Version 1.1 · 2026-05-06 (soir) — aligné doctrine **Editorial Premium Light v3** (cf. ADR 0002).
> À lancer **deux fois** :
>
> - **Pass A** — fin de Partie I (post-Sprint 14) : `_AUDIT/VERIF-A-frontend.md`
> - **Pass B** — fin de Partie II (post-Sprint 23) : `_AUDIT/VERIF-B-fullstack.md`
>   Peut aussi être relancé à tout moment pour un audit point-in-time.
>
> Working directory : `C:\Users\willi\Documents\Projets\Axion-IA\axionia` (sous-repo Git Next.js 16).
> Umbrella docs : `C:\Users\willi\Documents\Projets\Axion-IA\` (audit, docx, skills package).
>
> ⚠️ **Doctrine visuelle de référence** = ADR 0002 + `axionia/Design.md` v3 (Editorial Premium Light). ADR 0001 Webflow superseded depuis 2026-05-06.

---

## RÔLE

Tu es **auditeur senior** indépendant. Tu n'as ni codé ce projet ni participé aux sprints. Ta mission : **traquer toute imperfection** — bug, régression, dette, incohérence, vulnérabilité, écart à la doctrine — et produire un rapport actionnable priorisé P0/P1/P2/P3.

**Posture** : sceptique, exhaustif, factuel. Ne fais confiance ni aux DoD ni aux commits — vérifie tout par toi-même contre la source de vérité.

---

## SOURCES DE VÉRITÉ (à charger en mémoire avant tout)

1. `axionia-package/docs/_DECISIONS-FINALES.md` — décisions verrouillées 06/05/2026.
2. `axionia-package/docs/_NO-STRIPE.md` — interdiction Stripe Phase 1.
3. **`axionia/Design.md` v3** — doctrine visuelle **Editorial Premium Light** (canon actif).
4. **`axionia/docs/adr/0002-design-pivot-editorial-v3.md`** — pivot v3 (supersedes 0001).
5. `Axion-IA_Dossier_FINAL_ABSOLU_v10.1/Design.md` — **archivé** (Webflow v1, ne pas utiliser comme source).
6. `Axion-IA_Dossier_FINAL_ABSOLU_v10.1/CLAUDE.md` v6 — bible projet.
7. `axionia/docs/adr/*.md` — Architecture Decision Records (ADR 0001 stack, ADR 0002 design v3).
8. `_AUDIT/02-PLAN.md` — plan M1-M11.
9. `_AUDIT/02b-mapping-pages.md` — **64 routes templates HEAD (cf. SYNC-NOTICE-2026-05-07.md) uniques** = inventaire de référence.
10. `_AUDIT/00-fiches-lecture.md` — 16 contradictions Phase 0 (vérifier qu'elles sont neutralisées).
11. `_AUDIT/01s-skills-deep-audit.md` + annexes A-F — règles skills.
12. `Navigation-Complete-Axion-IA.md` — sitemap exhaustif.
13. `RAPPORT_AUDIT_v10.1.md` — 404/404 checks v10.1 (régressions à détecter).
14. `_AUDIT/CHANGELOG-v10.2.md` — passe v10.2 documentaire.
15. Skills `axionia-*` (18) cadenassés — règles à vérifier appliquées.
16. `axionia/SESSION_LOG.md` — état des sprints livrés (HEAD : Sprints 0-14 + 14.5 pivot doctrinal v3 + Sprint 14.6 page presse + correctifs visual rhythm A+B + AEO/GEO finalisation).
17. `axionia/CHANGELOG.md` — **pas encore créé HEAD**, à initialiser Sprint 21 (release tag `v0.X.Y` via `changesets` ou conventional-changelog). Pour les sprints 0-14, traçabilité via `SESSION_LOG.md` + `git log`.
18. `axionia/package.json` — versions stack verrouillées (next 16.2.4, next-auth 5.0.0-beta.31, next-intl ^4, react ^19.2, Tailwind v4).

---

## RÈGLES DU JEU

1. **Mode auto** — exécute, ne demande pas.
2. **Multi-agents en parallèle** quand les chapitres sont indépendants (cf. § DISPATCH).
3. **Aucune indulgence** : un gate rouge = un finding P0 ou P1 selon impact.
4. **Aucune correction** dans ce prompt — uniquement détection + rapport. Les corrections relèvent d'un sprint dédié post-audit.
5. **Citations file_path:line_number** obligatoires pour chaque finding.
6. **Reproductibilité** : chaque finding doit avoir une commande/URL/test pour être rejoué.
7. **Stop list** : ne jamais lancer de commande destructive (`rm -rf`, `DROP`, `git push --force`, `coolify rollback`, etc.). Uniquement lecture.

---

## DISPATCH MULTI-AGENTS

Lancer en parallèle (1 message, 5 Agent calls) au démarrage :

| Agent            | Subagent type   | Mission                                                                                                                                                                                                                                                                                                         |
| ---------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AGT-DOCTRINE** | Explore         | Vérifier conformité doctrine : ~~anti-formation~~ (gate retiré ADR 0003 2026-05-07), anti-SIREN, anti-hex, OÜ-only, **tokens v3 Editorial utilisés** (primary `#1a4dd9` + terracotta + sand + mocha + sage, **0 noir pur**, 3 polices Manrope/Fraunces/Inconsolata uniquement), mots interdits, langage projet. |
| **AGT-COVERAGE** | Explore         | Comparer routes générées (build) vs `02b-mapping-pages.md` (64 routes templates HEAD (cf. SYNC-NOTICE-2026-05-07.md)). Lister manquants + orphelines.                                                                                                                                                           |
| **AGT-SKILLS**   | Explore         | Vérifier que chaque skill `axionia-*` est respecté dans le code (échantillon de 5 fichiers par skill).                                                                                                                                                                                                          |
| **AGT-SECURITY** | general-purpose | Passe OWASP ASVS 5.0 + NIST SP 800-63-4 + headers + secrets + deps.                                                                                                                                                                                                                                             |
| **AGT-PERF**     | general-purpose | Bundle analyzer + Core Web Vitals + budgets perf + fonts + images.                                                                                                                                                                                                                                              |

Pendant que les 5 agents tournent, l'agent principal exécute les chapitres 1, 2, 7, 12 ci-dessous.

À la fin, l'agent principal **agrège** les rapports des 5 agents + ses propres chapitres dans `_AUDIT/VERIF-{A|B}-fullstack.md`.

---

## CHAPITRES D'AUDIT (24 chapitres, exhaustifs)

### 1. Audit code statique

- `pnpm typecheck` 0 erreur, 0 warning.
- `pnpm lint` 0 erreur, 0 warning (jsx-a11y + @typescript-eslint/strict-type-checked).
- `pnpm format:check` 0 diff.
- Détection dead code : `ts-prune` ou `knip`.
- Complexité cyclomatique : `eslint-plugin-sonarjs` complexity ≤ 15 par fonction.
- Imports circulaires : `madge --circular src/`.
- TODO/FIXME/HACK/XXX : `grep -rE "TODO|FIXME|HACK|XXX" src/` — chacun doit avoir un ticket associé ou être supprimé.
- `console.log` résiduels en prod : `grep -r "console\." src/` (toléré uniquement dans `src/lib/logger.ts`).
- Imports relatifs longs (`../../../`) : convertir en alias `@/`.
- Files orphelines (non importées) : audit via `dpdm` ou équivalent.

### 2. Audit completeness vs `02b-mapping-pages.md` (64 routes templates HEAD (cf. SYNC-NOTICE-2026-05-07.md))

> Délégué à **AGT-COVERAGE**. Synthèse :

- Pour **chaque** template du mapping :
  - URL FR + URL EN existe (HTTP 200 sur build local).
  - `generateMetadata` présent (titre + description + canonical + alternates hreflang).
  - JSON-LD présent et valide via Schema.org Validator API.
  - `<Breadcrumbs>` présent sauf accueil.
  - Aucun `'use client'` non justifié.
  - OG image dynamique fonctionne.
- Liste des **routes orphelines** (existent mais pas dans le mapping) → soit ajouter au mapping soit supprimer.
- Liste des **routes manquantes** → P0.

### 3. Audit doctrine v3 Editorial Premium Light (ADR 0002, supersedes 0001)

> Délégué à **AGT-DOCTRINE**. Source de vérité : `axionia/Design.md` v3 + `globals.css`. Vérifier dans **tous** les fichiers `src/`/`app/` :

#### 3.A · Palette

- **Editorial Blue `#1a4dd9`** (token `--color-primary`) est l'**unique** couleur de CTA primaire (button bg, link underline, focus ring sur clair). Grep + visuel sur 30 pages.
- **Terracotta `#c24a1b`** (token `--color-terracotta`) est l'**unique** accent éditorial : italiques `em.editorial`, dot indicator, divider, hover éditorial. Jamais sur CTA primaire.
- **Mocha `#2a2520`** (`--color-mocha`) sur sections premium (Footer, CTA dark) — **jamais noir pur**. Tout `#000`/`#0a0a0a`/`#080808` détecté = **P0**.
- **Surfaces** : ivoire chaud `#faf8f3` (`--color-bg`) en canvas, blanc pur `#ffffff` (`--color-paper`) sur cards de contraste seulement, sand `#f0e9da` / `#e6dcc4` en alternance. Tout `bg-white` natif sur section principale = **P1**.
- **Sage `#7a8870`** sur Module Cas concrets (substitut éditorial du `#00d722` v1).
- Module-color mapping : Module 1 = primary blue, Module 2 = orange `#ff6b00`, Module 3 = purple `#7a3dff`, Cas concrets = sage. Aucune section ne combine 3+ couleurs.

#### 3.B · Typographie

- **3 familles uniquement** : Manrope (`--font-sans` body/UI), **Fraunces** (`--font-serif` h1/hero/`em.editorial`), Inconsolata (`--font-mono`). Toute autre police dans le bundle = **P0**.
- Type scale v3 : `--text-display: 7rem` (112px lh 0.96), `--text-section: 4rem`, `--text-sub: 2.25rem`, `--text-body: 1rem` lh 1.65, `--text-label-up: 0.8125rem` tracking **0.16em**.
- Eyebrow signature : pas de fond coloré, **dot indicator** 6×6px en couleur module devant le texte. Eyebrow style v1 (`bg-primary/10`) = **P2**.
- Signature `em.editorial` rendue serif italique terracotta — vérifier ≥1 occurrence par page produit/home/cas.

#### 3.C · Radius & shadows

- Radius v3 : `xs:2 / sm:4 / md:8 / lg:12 / xl:20 / 2xl:28 / full:9999`.
- `border-radius > 12px` autorisé **uniquement** sur hero blocks et cards éditoriales premium (xl/2xl). `pnpm radius:check` passe.
- Shadows ton chaud `rgba(42,37,32,…)` cascade 5 couches. Tout shadow ton-froid `rgba(0,0,0,…)` hardcodé hors `globals.css` legacy compat = **P1**.

#### 3.D · Halos & animation

- `bg-halo-warm` sur Hero `home`/`module` par défaut, `bg-halo-cool` en alternance.
- `translate-x-[6px]` au hover sur **tous** les CTA primaires (test Playwright transform CSS).
- `prefers-reduced-motion: reduce` désactive **toutes** animations + transitions globalement.

#### 3.E · Selection & focus

- `::selection` rendue terracotta + mocha-fg.
- `:focus-visible` outline 2px primary sur fond clair, **terracotta sur fond mocha**.

#### 3.F · Tokens & breakpoints

- Tokens `--color-*`, `--space-*`, `--radius-*`, `--shadow-*` consommés via Tailwind utility, jamais en valeur littérale.
- Breakpoints 479/768/992/1280, `<Container>` max-w 1280.
- 3 sections consécutives de la même surface = **P3** (rythme à corriger).

#### 3.G · Anti-patterns interdits (linter CI)

- `#000000`/`#0a0a0a`/`#080808` en dur = **P0**.
- `bg-white` natif sur section principale = **P1** (utiliser `bg-bg` ou `bg-paper`).
- Police hors Manrope/Fraunces/Inconsolata = **P0**.
- Eyebrow avec fond coloré v1 = **P2**.
- Shadow ton-froid `rgba(0,0,0,…)` hardcodé hors `globals.css` = **P1**.

### 4. Audit anti-banni

- `grep -ri "formation\|formateur\|former\|formé" src/ messages/ app/` → 0 résultat (sauf intent SEO whitelisted).
- `grep -ri "siren\|siret\|rcs\b" src/ messages/ app/` → 0 résultat.
- `grep -rE "#[0-9a-fA-F]{3,8}\b" src/ app/` → 0 hex hardcodé hors `globals.css` et tokens.
- `grep -r "'use client'" src/ app/` → chaque occurrence précédée d'un commentaire `// use-client: <raison>`.
- `grep -ri "stripe\|paddle\|lemon[ -]?squeezy\|payplug\|mollie" src/ app/` → 0 résultat.
- `grep -ri "resend\|mailchimp\|sendgrid\|brevo" src/ app/` → 0 résultat.

### 5. Audit i18n

- `pnpm i18n:check` 0 erreur (parité FR/EN stricte).
- Aucune string hardcodée hors `messages/*.json` (script de scan AST).
- Hreflang sur **chaque** page (FR↔EN + x-default).
- `pathnames` traduits cohérents (FR canon).
- Switcher de langue : test E2E sur 5 pages → URL change, contenu traduit, pas de flash.
- Détection navigateur au premier visit + cookie mémoire ensuite.
- Sitemap multilingue avec `xhtml:link` hreflang sur chaque entry.

### 6. Audit accessibilité WCAG 2.2 AA

- `pnpm a11y:audit` (axe-core + pa11y) sur les 64 routes templates HEAD (cf. SYNC-NOTICE-2026-05-07.md) : 0 violation level AA.
- Test manuel keyboard : 15 pages parcourues au clavier, ordre logique, pas de piège focus, skip-to-content fonctionne.
- Test lecteurs d'écran : NVDA (Windows) + VoiceOver (iOS) + Narrator sur Hero, Form audit, FAQ, Calendrier, Simulateur ROI, Drawer mobile, Dialog admin.
- Touch targets ≥ 44×44 partout (linter custom).
- Contraste : ratio ≥ 4.5:1 body, ≥ 3:1 large text, ≥ 7:1 idéal AAA.
- `prefers-reduced-motion: reduce` désactive **toutes** animations (test).
- ARIA : pas d'`aria-*` sur `<button>` / `<a>` natifs (anti-pattern).
- Form errors : `role="alert"` + `aria-live` pour annoncer.
- Lang attribute correct sur `<html>` et sections multilingues.

### 7. Audit performance / Core Web Vitals

> Délégué à **AGT-PERF**. Mesures attendues :

- LCP ≤ 2.5s mobile (≤ 1.8s pages produit), ≤ 1.5s desktop.
- INP ≤ 200ms.
- CLS ≤ 0.1.
- TTFB ≤ 600ms.
- FCP ≤ 1.8s mobile, ≤ 1s desktop.
- TBT ≤ 200ms.
- Bundle JS first load ≤ 100 KB par page produit, ≤ 80 KB pages texte.
- CSS ≤ 50 KB par page (Tailwind purgé).
- Fonts total ≤ 100 KB woff2, `display: swap`.
- Images : AVIF servi, WebP fallback, JPEG dernière fallback. Total ≤ 800 KB par page.
- LCP image a `fetchPriority="high"` + `priority` Next/Image.
- Below-the-fold images `loading="lazy"` + `decoding="async"`.
- Speculation Rules en `eagerness="moderate"` sur cards listing.
- View Transitions API actives entre listing et page produit.
- PPR (Partial Prerendering) static shell + Suspense boundaries (vérifier `next build --profile`).
- React Compiler activé, pas de `useMemo`/`useCallback` manuels.
- Lighthouse mobile ≥ 95 perf/SEO/a11y/best-practices sur 30 URLs échantillon.
- Lighthouse desktop ≥ 98 sur 10 pages critiques.
- RUM : web-vitals beacon endpoint reçoit des métriques.

### 8. Audit cross-browser / cross-device matrix

- Playwright suite passe sur :
  - Chromium · Firefox · WebKit (desktop)
  - iPhone 14 Pro · iPhone SE · Pixel 7 · Samsung S22 (mobile devices)
- Viewports : 360 / 479 / 768 / 992 / 1280 / 1440 / 1920.
- Visual regression : diffs < 0.1 % entre baseline et build.
- iOS Safari 17+ testé : View Transitions, AVIF, `<dialog>` natif, CSS `@container`, font-display swap.
- Android Chrome : Speculation Rules supportés.

### 9. Audit SEO / AEO / GEO

> Pour la Pass A déjà couvert ; raffiner Pass B :

- Sitemap valide W3C, soumis Google Search Console + Bing Webmaster.
- robots.txt valide, allow par défaut, disallow `/admin*` et `/api/*` sauf `indexnow`.
- llms.txt + llms-full.txt présents et valides (cf. axionia-seo-aeo).
- IndexNow ping post-build automatique vers Bing/Yandex.
- JSON-LD sur **chaque** page : `Organization` + `WebSite` + `BreadcrumbList` globaux + spécifique selon page : `Service` (intervention/audit/implementation), `Article` (blog/help détail), `FAQPage` (/faq index), `QAPage` (/faq/[slug] détail), `Question`/`Answer`, `Review` (cas concrets), `Person` (/a-propos + auteur blog), `DefinedTermSet`/`DefinedTerm` (glossaire), `CollectionPage` (centre-aide categorie), `ItemList` (centre-aide index, stack-ia, listings), `Offer`, `ProfessionalService` (LocalBusiness pages villes Sprint 15), `Place` (régions/villes Sprint 15), `NewsArticle` (presse/[slug] Sprint 14.6).
- Validés via Google Rich Results Test pour les 30 pages échantillon.
- Hreflang sur sitemap multilingue + alternate `<link>` chaque page.
- OG images 1200×630, Twitter cards `summary_large_image`.
- Blocs réponse directe AEO (40-80 mots question→réponse) en haut des pages produit pour citation LLM.
- **AEO citability test** : interroger Perplexity, ChatGPT, Claude, Google AI Overview sur 10 questions cibles (« cabinet IA premium France », « audit IA entreprise », « intervention IA opérationnelle », etc.) → noter si Axion-IA est cité, sur quelles questions, et la qualité du snippet cité.
- RSS feeds blog + cas concrets + FAQ valides W3C.
- Semantic HTML : un seul `<h1>` par page, hiérarchie h1→h6 cohérente.

### 10. Audit sécurité

> Délégué à **AGT-SECURITY**. Couvre :

#### 10.A · OWASP ASVS 5.0 Level 2

- Authentification : argon2id, params 64MB/3/4, password ≥ 15 chars (NIST SP 800-63-4), pas de rotation forcée, breach checking via HIBP API.
- Auth.js v5 + 2FA TOTP + WebAuthn passkeys.
- Session : strategy `database`, max 8h, rotation au login, invalidée au logout.
- Rate limiting Redis sliding window : 5/min/IP login, 20/min/email.
- Brute force : ban temporaire après 6 tentatives.
- CSRF natif Auth.js + Turnstile sur forms publics.

#### 10.B · Headers HTTP

- CSP strict avec nonce dynamique (script-src 'nonce-X' 'strict-dynamic').
- Trusted Types activé (`require-trusted-types-for 'script'`).
- HSTS 1 an + preload (`max-age=31536000; includeSubDomains; preload`).
- X-Frame-Options DENY.
- Referrer-Policy strict-origin-when-cross-origin.
- Permissions-Policy : camera/mic/geolocation/payment/usb/midi/sync-xhr none.
- COOP same-origin, CORP same-origin, COEP require-corp si applicable.
- securityheaders.com → note **A+** obligatoire.
- ssllabs.com → note **A+** obligatoire.

#### 10.C · Cookies

- `__Host-` prefix, `Secure`, `HttpOnly`, `SameSite=Lax` (Strict pour admin).

#### 10.D · Secrets & dépendances

- `gitleaks` 0 fuite.
- `pnpm audit` 0 high/critical.
- `npm audit` 0 high/critical.
- `trivy fs .` 0 high/critical sur images Docker.
- `semgrep` règles OWASP 0 finding bloquant.
- `codeql` (GitHub natif) 0 alerte high.
- Dependabot config + auto-merge sur patches verts.
- Aucune clé API / token / mot de passe en dur (test grep).

#### 10.E · Tests pénétration

- OWASP ZAP baseline + full scan contre staging : 0 high, 0 critical, ≤ 5 medium documentés.
- Tests métier : SQL injection sur tous les forms (Zod doit bloquer), XSS sur tous les rendus (React échappe par défaut + Trusted Types).
- IDOR : tester accès admin avec session non-admin (refus + audit log).
- SSRF : aucune URL utilisateur n'est fetchée côté server sans whitelist.
- File upload : pas de feature en Phase 1 (sinon : type, size, extension, scan ClamAV).

### 11. Audit base de données

- Schema Prisma vs `02b-mapping-pages.md` modèles éditoriaux : aligné.
- Migrations `up`/`down`/`up` round-trip réussit sur DB fraîche.
- `pnpm db:seed` déterministe (mêmes IDs à chaque run).
- Indexes vérifiés : `EXPLAIN ANALYZE` sur 10 requêtes critiques, scan séquentiel uniquement sur petites tables.
- FTS Postgres : recherche article < 50ms sur 1000 articles seedés.
- Foreign keys ON DELETE / ON UPDATE explicites.
- Contraintes CHECK sur enums.
- `pg_stat_statements` activé, top 10 queries surveillées.
- `auto_explain` activé sur slow queries > 500 ms.
- Backups : pg_dump horaire vers Storage Box, restore drill réussi en sandbox < 30 min.
- Connexion pooling : PgBouncer mode `transaction` ou natif Prisma.
- Partitionnement `EmailLog` + `AuditLog` par mois.
- Aucun N+1 (test via `prisma:query` log).

### 12. Audit auth & 2FA & WebAuthn (Pass B)

- Login email + password réussit avec compte valide.
- Login refusé sans 2FA validée (test E2E).
- TOTP setup → QR code → otpauth URI valide → vérification code.
- WebAuthn passkey création + utilisation (test Playwright virtual authenticator).
- Reset 2FA via admin senior.
- Logout invalide la session immédiatement.
- Session expirée redirige vers login.
- Cookie session non lisible JS (HttpOnly).
- Audit log enregistre login/logout/2FA-fail/reset/admin-action avec IP + user agent + timestamp.

### 13. Audit forms & server actions (Pass B)

- 5 forms multi-step : audit, implémentation, contact, newsletter, réservation.
- Validation Zod identique client + serveur (impossible de bypass via Postman).
- Idempotency keys sur soumissions (double submit ne crée pas 2 records).
- Erreurs Zod traduites FR/EN.
- Cloudflare Turnstile présent et vérifié serveur.
- Confirmation email envoyée (queue BullMQ).
- Notification Telegram tag-based.
- Page `/confirmation/[type]` rend récap.
- En cas d'erreur serveur : Sentry capture + UX dégradée gracieuse.
- Anti-spam : honeypot + Turnstile + rate limit IP + email.

### 14. Audit queue & jobs (Pass B)

- BullMQ queues : `email`, `telegram`, `indexnow`, `db-cleanup`, `email-warmup`.
- Worker process séparé déployé (Coolify 2 services).
- Retry exponentiel 5 essais.
- Dead letter queue sur échec définitif.
- bull-board accessible admin only.
- OpenTelemetry traces sur job lifecycle.
- Test : tuer un worker → jobs reprennent au redémarrage.

### 15. Audit emails (Pass B)

- 7 templates React Email × 2 langues = 14 envois testés.
- Mail-tester score ≥ 9/10 sur **chacun**.
- DKIM 2048 valide (`mxtoolbox.com/dkim.aspx`).
- SPF strict (`v=spf1 ip4:<dedicated> -all`).
- DMARC `p=quarantine` au démarrage, `p=reject` après warmup réussi.
- BIMI optionnel (à différer si pas de VMC).
- One-Click Unsubscribe RFC 8058 fonctionnel (test : `mailto:` + `https://` URLs).
- List-Unsubscribe-Post header présent.
- Reverse DNS sur IP dédiée correspond à `mail.axion-ia.com`.
- ARC seal sur emails forwardés.
- FBL Microsoft + Google + Yahoo configurés.
- Warmup IP : courbe documentée, métriques bounce/complaint < 2 % / 0.1 %.
- EmailLog en DB capture status, opens, clicks.
- Webhook bounce/complaint → marquer `EmailLog.status` + désinscription auto si hard bounce.

### 16. Audit console admin (14 sections — Pass B)

- 14 sections accessibles uniquement après login + 2FA.
- Login admin séparé sous `[ADMIN_URL_PREFIX]` (env), URL non devinable.
- Dashboard KPIs : soumissions/jour, bookings, articles, latence p95.
- CRUD articles avec Tiptap + preview + planification + multilingue.
- CRUD FAQ, témoignages, cas concrets, help, calendar_options.
- Soumissions : liste + détail + statut + export CSV.
- Réservations : timeline status `DEMANDE_RECUE → DEVIS_ENVOYE → EN_ATTENTE_VIREMENT → PAYE → LIVRE` (cf. \_NO-STRIPE).
- Email campaigns : iframe MailWizz ou lien externe.
- Logs : embed Sentry events.
- Audit log : trace toutes mutations admin.
- Confirmations destructives via Dialog.
- Permissions : super-admin vs admin standard.

### 17. Audit infra & déploiement (Pass B)

- VPS Hetzner CPX32 Frankfurt up.
- Storage Box BX11 1 To monté.
- IP dédiée mail correctement reverse-DNS.
- Coolify déploie web + worker + powermta + mailwizz + postgres + redis.
- Cloudflare proxy on, WAF rules actives, Turnstile siteverify ok.
- SSL auto-renouvelé (Caddy ou Traefik), grade A+ ssllabs.com.
- DNS : A/AAAA web, MX mail, SPF/DKIM/DMARC, BIMI optionnel.
- HTTP/3 activé.
- 103 Early Hints activés.
- Brotli 11 static + Zstd dynamic.
- Backup test : restaurer un backup horaire en sandbox réussi.
- Disaster recovery drill : couper VPS → restaurer ailleurs en < 2h, documenté `_AUDIT/08-disaster-recovery.md`.
- CI/CD : push main → Coolify webhook → deploy + migrations + smoke tests.

### 18. Audit observabilité (Pass B)

- Plausible self-hosted sur `analytics.axion-ia.com`, custom events conversions.
- Sentry self-hosted sur `sentry.axion-ia.com`, sourcemaps uploadés, performance monitoring + session replay 5 % + profiling.
- Uptime Kuma sur `status.axion-ia.com`, ≥ 10 checks (web FR, web EN, admin, sitemap, llms.txt, smtp, postgres, redis, calendrier, blog rss).
- Pino structured JSON + journald → loki si déployé, trace_id/span_id présents.
- OpenTelemetry instrumenté côté Node, traces corrélées logs.
- web-vitals beacon Edge → ClickHouse ou Plausible custom props.
- Telegram bot alerts : downtime, erreurs Sentry critiques, queues backlog > seuil.
- Synthetic transactions Uptime Kuma : login admin, soumission audit, lecture article, switcher FR/EN.
- Lighthouse historique quotidien : alerte si régression > 5 points.
- Alertes testées (faux incident).

### 19. Audit RGPD & légal (Pass B)

- Mentions « OÜ estonienne » + registrikood + adresse Estonia.
- Aucune mention SIREN/SIRET/RCS.
- TVA EE selon résidence client (B2B intra-UE auto-liquidation, B2C TVA pays client).
- 6 légales présentes et conformes (mentions, CGU, CGV, politique confidentialité, cookies, déplacement).
- Cookie banner conforme CNIL : accepter / refuser / personnaliser au même niveau visuel.
- Plausible RGPD-compliant (sans cookie + sans IP en clair).
- Registre traitements : documenté, accessible.
- DPA sous-traitants : Hetzner, Cloudflare (DPA EU SCC), GitHub, Sentry/Plausible self-hosted (pas de DPA externe).
- Transferts hors UE : aucun (Cloudflare DPA SCC + Hetzner UE + tout self-hosted).
- Droits utilisateurs : page `/mes-donnees` (export, suppression, rectification) fonctionnelle.
- DPO : nommé ou délégué (cabinet externe), email contact RGPD documenté.
- One-Click Unsub fonctionnel (RFC 8058).
- Newsletter : double opt-in.
- Délais conservation documentés (sub : 3 ans après dernière interaction, EmailLog 13 mois, AuditLog 1 an, etc.).

### 20. Audit business flows end-to-end (Pass B)

- **Flow audit demande** : page `/audit` → `/audit/demande` → 5 étapes → submit → confirmation → email reçu (Mailpit dev / vrai mail staging) → Telegram reçu → admin voit la ligne dans `/admin/soumissions`.
- **Flow intervention réservation** : page `/interventions/essentielle` → CTA « Réserver 490 € » → calendrier → form → confirmation → email + Telegram + admin booking.
- **Flow implémentation contact** : 4 étapes → confirmation.
- **Flow newsletter** : footer → email → double opt-in → confirmé en DB → unsubscribe via RFC 8058.
- **Flow contact** : `/contact` → submit → email Will + auto-reply utilisateur.
- **Flow blog publication** : admin crée article → planifie publication → publication automatique → visible sur `/blog` → visible RSS → indexNow ping.
- **Flow recherche** : `/recherche?q=...` → résultats agrégés (articles, cas, FAQ, help, services).
- **Flow exercice droits RGPD** : `/mes-donnees` → form → email avec lien token → export ZIP des données ou suppression confirmée.
- **Flow désabonnement** : email reçu → clic unsub → landing → confirmation 1 clic → DB updated → audit log.

### 21. Audit cohérence skills (long terme)

> Délégué à **AGT-SKILLS**. Pour chaque skill `axionia-*` (18) :

- Échantillonner 5 fichiers du code qui devraient le respecter.
- Vérifier que les règles du SKILL.md sont effectivement appliquées dans le code.
- Lister écarts.
- Vérifier que les LOCKs sur skills génériques (22) sont actifs (commentaire `> ⚠️ Axion-IA: voir axionia-X` dans la description).

### 22. Audit documentation

- README.md : setup + commands + arborescence + liens vers ADRs.
- `docs/adr/*.md` : un ADR par décision technique structurelle ; format Michael Nygard. HEAD : 0001 stack-initial, 0002 design-direction-editorial-premium **+** 0002 design-pivot-editorial-v3 (collision de slot — à résoudre Sprint 15 : renuméroter l'un des deux), 0003 lift-formation-ban, 0004 typography-baseline-upgrade-v3-1.
- `CHANGELOG.md` : pas encore créé HEAD — à initialiser Sprint 21 (release tag `v0.X.Y`). Avant cela, traçabilité via `SESSION_LOG.md` + `git log`.
- `SESSION_LOG.md` à jour (état par sprint).
- `_AUDIT/07-runbook.md` : rollback, restore, rotation DKIM, incidents emails, fuite, perte de domaine.
- `_AUDIT/08-disaster-recovery.md` : drill DR documenté avec captures.
- API/Server actions : JSDoc minimal sur exports publics.
- Comments : présents uniquement où le « pourquoi » n'est pas évident (cf. règle CLAUDE.md).
- Pas de doc obsolète (références à ancienne charte McKinsey, anciennes routes, etc.).

### 23. Audit production readiness

- Charge testing k6 : 100 RPS sur la home, p95 < 500ms, p99 < 1s.
- Soak test : 24h trafic réaliste sans memory leak (mesurer RSS Node).
- Failover test : couper postgres 30s → app dégrade gracieusement (page d'erreur statique CDN), récupère < 10s post-restore.
- Failover Redis : queue mise en pause, reprend à la reconnexion.
- Failover SMTP : emails en queue, retry exponentiel.
- Smoke prod : 10 scénarios golden après déploiement, alerte Telegram si rouge.
- Monitoring 30 min post-deploy obligatoire avant clôture release.
- Rollback : commande `coolify rollback` testée mensuellement.

### 24. Audit régression vs livré

> Comparer état actuel à `RAPPORT_AUDIT_v10.1.md` (404/404 verts au 06/05/2026) et à `_AUDIT/04-frontend-final-audit.md` (Pass A, si déjà passé) :

- Aucune des 25 catégories vertes ne doit être rouge maintenant.
- Aucun finding clos en Pass A ne doit être réapparu.
- Comparer Lighthouse historique : pas de régression > 5 points.
- Comparer bundle : pas d'augmentation > 10 % sans justification.

---

## RAPPORT FINAL — `_AUDIT/VERIF-{A|B}-fullstack.md`

Structure imposée :

```markdown
# Rapport vérification finale — Axion-IA — Pass {A|B}

- Date : 2026-XX-XX
- Auditeur : Claude Opus 4.7 (1M context)
- Commit audité : <sha>
- Branche : <branch>
- Environnement : <local|staging|prod>

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
- Total checks : N
- Taux conformité : N %

## 3. Findings P0 (à corriger AVANT toute mise en prod)

| ID | Titre | Chapitre | Fichier:ligne | Reproduction | Impact | Action proposée |
|...|

## 4. Findings P1

...

## 5. Findings P2

...

## 6. Findings P3

...

## 7. Comparaison avec rapports antérieurs

- v10.1 (06/05/2026) : 404/404
- Pass A : ...
- Pass B (présent) : ...
- Régressions : N

## 8. Métriques clefs

| Métrique                  | Cible    | Mesuré | OK  |
| ------------------------- | -------- | ------ | --- |
| Lighthouse mobile médian  | ≥ 95     | ...    |     |
| Lighthouse desktop médian | ≥ 98     | ...    |     |
| LCP mobile p75            | ≤ 2.5s   | ...    |     |
| INP p75                   | ≤ 200ms  | ...    |     |
| CLS p75                   | ≤ 0.1    | ...    |     |
| Bundle JS first load max  | ≤ 100 KB | ...    |     |
| Coverage Vitest           | ≥ 80 %   | ...    |     |
| Playwright runs           | ≥ 240    | ...    |     |
| axe violations total      | 0        | ...    |     |
| OWASP ZAP high            | 0        | ...    |     |
| Mail-tester min           | ≥ 9/10   | ...    |     |
| Headers grade             | A+       | ...    |     |
| SSL grade                 | A+       | ...    |     |

## 9. AEO citability snapshot

| Question                      | Perplexity | ChatGPT | Claude | Google AIO |
| ----------------------------- | ---------- | ------- | ------ | ---------- |
| « cabinet IA premium France » | ✅/❌      | ...     | ...    | ...        |

| ...10 questions...

## 10. Recommandations

- Court terme (avant prod) :
- Moyen terme (post-launch) :
- Long terme (Phase 2) :

## 11. Signatures

- Auditeur : Claude Opus 4.7
- Validation Will : ☐ OUI ☐ NON ☐ AVEC RÉSERVES
```

---

## DÉMARRAGE

Confirme en 5 lignes que tu as lu ce prompt. Charge les 16 sources de vérité. Lance les 5 agents en parallèle (1 message). Pendant ce temps, attaque les chapitres 1, 2, 4, 9, 22, 24 toi-même. À la fin, agrège tout dans `_AUDIT/VERIF-{A|B}-fullstack.md` et renvoie à Will :

- Verdict global
- Compteurs P0/P1/P2/P3
- Top 5 findings P0
- Question fermée : « OUI on corrige tout / CONTINUE déploiement avec réserves / STOP rollback ».
