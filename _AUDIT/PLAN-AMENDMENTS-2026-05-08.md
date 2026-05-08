# Axion-IA — `02-PLAN.md` amendments officiels (2026-05-08)

> **Statut** : doctrine vivante. Ce fichier acte les corrections à appliquer mentalement à `_AUDIT/02-PLAN.md`. Le 02-PLAN reste figé pour traçabilité historique. **Sources canoniques en cas de conflit** : ADRs `docs/adr/0001-0009`, `Design.md`, `CLAUDE.md`/`AGENTS.md`, mémoires `axionia_*`.
>
> **Origine** : audit de cohérence livré en 5 forks parallèles 2026-05-08 (forks A/B/C/D/E). **Validé par Will 2026-05-08** (réponses tranchées en fin de session — voir §"Décisions tranchées" en bas).

---

## En-tête `02-PLAN.md`

| Avant (02-PLAN ligne 4)                                                                                                      | Après (canon 2026-05-08)                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Source de vérité : _DECISIONS-FINALES.md + CLAUDE.md v6 + ADR docs/adr/0001-design-direction-webflow.md + skills axionia-*` | Sources : `CLAUDE.md`+`AGENTS.md` HEAD, ADR 0001 (stack-initial), ADR 0002 (design pivot v3), ADR 0007 (typography hierarchy v3.2), ADR 0008 (vocabulary intervention coaching), ADR 0009 (hosting Hetzner+CF Free). `_DECISIONS-FINALES.md` archivé v10.1. |

---

## M1 — Setup repo + stack

| Ligne    | Avant                         | Après / canon                                                                    | ADR/source          |
| -------- | ----------------------------- | -------------------------------------------------------------------------------- | ------------------- |
| L33, L45 | « Next.js 15 App Router »     | Next.js 16.2.4 figé (React 19.2.4, Tailwind v4, TS strict)                       | ADR 0001            |
| L51, L60 | « custom rule ban-formation » | Lift levé. Convention v2 = « intervention coaching ». Pas de hook ban-formation. | ADR 0003 + ADR 0008 |

---

## M2 — Design tokens + UI atomiques

| Ligne                               | Avant                                                               | Après / canon                                                                                                    | ADR/source              |
| ----------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------- |
| L93                                 | Webflow Blue `#146ef5`, near-black `#080808`, palette 6 secondaires | `--color-primary` `#1a4dd9` densifié + mocha + terracotta + sand + ivoire `#faf8f3` (Editorial Premium Light v3) | ADR 0002 + Design.md    |
| L97                                 | Signature `translate-x-[6px]` au hover                              | `.cta-lift translateY(-2px)` (lift vertical, pas slide latéral)                                                  | ADR 0002 + Design.md §7 |
| L99                                 | Focus ring Webflow Blue 2px, error rouge `#ee1d36`                  | Focus ring `--color-primary` `#1a4dd9` 2px ; error tokens v3                                                     | ADR 0002                |
| L111                                | `prefers-reduced-motion` désactive `translate-x-[6px]`              | `prefers-reduced-motion` désactive `cta-lift translateY`                                                         | ADR 0002                |
| D7 L849                             | « Will valide direction Webflow-inspired »                          | **RÉSOLU** : pivot v3 commité 2026-05-06 (HEAD `941a8e1`+)                                                       | ADR 0002                |
| R1 L713                             | Tension « palette Webflow vs B2B premium »                          | **RÉSOLU** : neutralisé par ADR 0002 (typo serif Fraunces italique + chromatisme désaturé)                       | ADR 0002                |
| Livrable supplémentaire (hors plan) | —                                                                   | ADR 0007 typography hierarchy v3.2 (modular scale + cap hero 88px)                                               | ADR 0007                |

---

## M3 — Header/Footer + i18n

| Sujet                                   | État réel                                                                             | ADR/source                         |
| --------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------- |
| Header 5 items + CTA central            | Étendu 7 items + mega-menus Voie 2 (Interventions/Implementation/Implantations/Stack) | ADR 0005                           |
| Doctrine carrée hero schema 576×576 lg+ | Ajoutée hors plan (Sprint 14.7quater 2026-05-08)                                      | mémoire `axionia_hero_schema_v3_2` |

---

## M4 — Pages publiques

| Ligne / sujet                              | Avant                                                                                           | Après / canon                                                                                                                                                                                                                                      | Source                |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| L189                                       | « copywriting v2 corrigé du mot formation »                                                     | Vocabulaire canonique v2 = « intervention coaching » (purge + repositionnement). « Formation » non banni absolument.                                                                                                                               | ADR 0003 + ADR 0008   |
| Liste interventions (6 templates annoncés) | `essentielle`, `equipes`, `managers`, `dirigeants`, `conference`, `coaching-individuel`, parent | **Réel : 4 templates** (`essentielle`, `conference`, `dirigeants`, parent). `/interventions/equipes` et `/interventions/managers` **non livrées** — décision pendante (livrer ou retirer).                                                         | fork C                |
| L729                                       | « Will fournit copy FR v2 corrigé »                                                             | **RÉSOLU** : copy FR v2 livré + sweep ADR 0008                                                                                                                                                                                                     | ADR 0008              |
| Pages hors plan livrées (14+)              | —                                                                                               | `/methodologie`, `/comparaisons`, `/stack-ia`, `/glossaire`, `/guide-ia`, `/roi`, `/presse`, `/implantations`, `/politique-deplacement`, `/preferences-cookies`, `/mes-donnees`, `/audit/{flash,process,strategique-pme,strategique-eti,demande}`. | CHANGELOG Sprint 14.x |

---

## M5 — Forms + Calendrier + ROI

| Sujet                                                                                 | État                            | Action requise                                                              |
| ------------------------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------- |
| RHF + Zod 6 forms (Audit, AuditRequest, Booking, Contact, Implementation, Newsletter) | ✅ livré                        | —                                                                           |
| Persistance Zustand/sessionStorage entre steps                                        | 🔴 absent                       | À câbler avant prod (perte de saisie au refresh)                            |
| Honeypot + Turnstile + rate-limit IP                                                  | 🔴 env vars seulement           | À câbler en M8 (rate-limit Redis + Turnstile validation côté Server Action) |
| `<CountdownTimer>` option 48h                                                         | 🔴 absent                       | À ajouter en M8 (lié à `bookings_options`)                                  |
| Modal action dispo (Réserver / Option 48h)                                            | 🔴 absent                       | À ajouter en M8                                                             |
| Page `?error=slot_taken` race-condition                                               | 🔴 absent                       | À ajouter en M8 (verrou pessimiste Postgres)                                |
| Forms POSTent dans `setTimeout(600)` stub                                             | Acté par stub `[*:submit:stub]` | Sprint 15 (M8) câble Server Actions réels                                   |

---

## M6 — Transversales + légales

| Ligne                         | Avant                                                                  | Après / canon                                                                                                       | Source                                                                 |
| ----------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| L342                          | « Mentions légales : OÜ + registrikood + adresse Tallinn + hébergeur » | Tallinn purgée site-wide 2026-05-07 sauf `src/content/legal.ts` (RGPD art. 13(1)(d) + droit estonien obligatoires). | SESSION_LOG 2026-05-07 + mémoire `axionia_session_2026-05-07_pivot_v3` |
| L858                          | COMPANY_NAME footer = « Axion-IA OÜ · Tallinn · ... »                  | Footer affiche « Axion-IA OÜ » sans Tallinn marketing.                                                              | Idem                                                                   |
| `/temoignages/[slug]` annoncé | Pas livré (témoignages = composant `TestimonialsCarousel`)             | Décision pendante : route dédiée ou rester en composant ?                                                           | fork C                                                                 |

---

## M7 — SEO/AEO

| Ligne                      | Avant                                                                                                                                                                                                                              | Après / canon                                                                                                                    | Source      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| L403                       | `app/api/og/[locale]/[slug]/route.ts` — Edge `@vercel/og` Webflow-inspired                                                                                                                                                         | Réel : `app/api/og/route.tsx` Edge `@vercel/og` Editorial Premium v3 (palette `#1a4dd9` doctrine v3). Refactor Sprint 14.6/14.8. | code source |
| 12 factories JSON-LD       | 18 factories effectives dans `lib/seo.ts` : Organization, Service, FAQ, FaqSpeakable, Breadcrumb, Person, Article, LocalBusiness, Place, ItemList, Product, HowTo, Review, AggregateRating, Dataset, ImageObject, QAPage, Website. | code source                                                                                                                      |
| `buildProductJsonLd`       | Présente lib/seo.ts:673 mais **0 import** site-wide.                                                                                                                                                                               | Action : câbler `/stack-ia` (11 outils) + sous-pages produits AI Custom.                                                         | fork E      |
| `.well-known/indexnow.txt` | Absent (route `/api/indexnow` existe, fichier statique de validation manquant).                                                                                                                                                    | Décision pendante : créer fichier statique `public/.well-known/[INDEXNOW_KEY].txt` ou route Next servant la clé.                 | fork C      |

---

## M8 — Backend Prisma + Auth + actions + email

**Statut réel 2026-05-08** : 0 % codé. Squelette outillage uniquement.

| Composant                           | État                                                                                                           |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`              | Stub `_SetupSentinel` avec marqueur explicite « full schema lands in Sprint 15 (M8) »                          |
| Migrations Prisma                   | 0 (`prisma/migrations/` n'existe pas)                                                                          |
| `prisma/seed.ts`                    | Référencé dans `package.json` mais fichier absent                                                              |
| Server Actions                      | 0 (recherche `"use server"` dans `src/` → aucun match)                                                         |
| Schemas Zod forms                   | ✅ Présents `src/lib/schemas/forms.ts` (6 forms sur 7 attendus) — réutilisables tels quels en M8               |
| Auth.js v5                          | 0 (`lib/auth.ts` absent, pas de route `/api/auth/[...nextauth]`)                                               |
| BullMQ workers                      | 0 (deps installées, `src/server/queue/worker.ts` absent — script `worker` du package.json pointe dans le vide) |
| Templates React Email (16 attendus) | 0/16                                                                                                           |
| `lib/telegram.ts`                   | Absent                                                                                                         |
| Variables `.env.example`            | Complètes (AUTH_SECRET, ADMIN_URL_PREFIX, SMTP, PMTA, MAILWIZZ, TELEGRAM, TURNSTILE) — aucune lue dans le code |

**Ordre d'attaque suggéré Sprint 15 (M8)** : (1) schema Prisma 18 tables + 1ère migration + `prisma/seed.ts` + DATABASE_URL Hetzner. (2) Auth.js v5 + adapter Prisma + 2FA TOTP + middleware rate-limit Redis. (3) Server Actions par form (réutiliser `lib/schemas/forms.ts`). (4) BullMQ workers + 16 templates React Email + transport PMTA→MailWizz→Nodemailer fallback. (5) `lib/telegram.ts`. (6) routes admin CMS.

### Amendements livraison Sprint 15 (2026-05-08, post-audit perfection)

**Templates emails — 10 livrés au lieu de 8 doctrine §11** :

| Template                       | Origine                                                                                 |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| `booking-confirmed`            | doctrine §11 #1                                                                         |
| `option-posted`                | doctrine §11 #2                                                                         |
| `option-reminder`              | doctrine §11 #3                                                                         |
| `option-expired`               | doctrine §11 #4                                                                         |
| `option-confirmed-by-admin`    | doctrine §11 #5                                                                         |
| `option-refused-by-admin`      | doctrine §11 #6                                                                         |
| `audit-confirmed`              | doctrine §11 #7 (renommé "Confirmation demande audit")                                  |
| `implementation-confirmed`     | doctrine §11 #8 (renommé "Confirmation demande implémentation")                         |
| **`newsletter-confirm-optin`** | **AJOUT Sprint 15** — RFC 8058 double opt-in obligatoire RGPD                           |
| **`contact-confirmed`**        | **AJOUT Sprint 15** — Server Action contact (form contact non couvert par doctrine §11) |

10 templates × 2 langues (FR/EN) = 20 variantes total. Validé livraison en Sprint 15 step 4 (commit `069bd23`).

**Tags Telegram doctrine §11 — 7/9 utilisés en Sprint 15** :

| Tag                  | État                                                                 |
| -------------------- | -------------------------------------------------------------------- |
| `[INTERVENTION]`     | ✅ utilisé dans `booking/actions.ts createBookingAction`             |
| `[OPTION]`           | ✅ utilisé dans `booking/actions.ts postOption48hAction`             |
| `[OPTION EXPIRÉE]`   | ✅ utilisé dans `option-expiration-worker.ts`                        |
| `[AUDIT]`            | ✅ utilisé dans `audit/actions.ts` × 2                               |
| `[AUTO]`             | ✅ utilisé dans `implementation/actions.ts`                          |
| `[CONTACT]`          | ✅ utilisé dans `contact/actions.ts`                                 |
| `[NEWSLETTER]`       | ✅ utilisé dans `newsletter/actions.ts`                              |
| `[OPTION CONFIRMÉE]` | 🔴 **gated M9** (action admin `validateOption` non livrée Sprint 15) |
| `[ANNULATION]`       | 🔴 **gated M9** (action admin `cancelBooking` non livrée Sprint 15)  |

Tag déclarés dans `lib/telegram.ts` mais branchement Server Action en M9. Acté.

**InterventionType enum aligné slugs UI (migration `20260508193001`)** : doctrine §4 énumère 5 interventions (essentielle, équipes, managers, conférence, dirigeants), code livré aligne sur 6 slugs UI canon `src/content/interventions.ts` : `essentielle`, `approfondie`, `gagner-du-temps`, `dirigeants`, `conference`, `intervention-claude`. Renames Postgres : `equipes`→`approfondie`, `managers`→`gagner_du_temps`, `coaching_individuel`→`intervention_claude`. UI émet kebab, Server Action convertit `slug.replace('-','_')` avant insert.

---

## M9 — Console admin

**Statut réel 2026-05-08** : 0 % codé. Aucune route `/admin*`. Tiptap deps installées, inutilisées. Prérequis : M8 obligatoire avant.

Spec détaillée pour la section calendrier : `_AUDIT/SPEC-ADMIN-CALENDRIER-V2.md`.

---

## M10 — Tests E2E + Lighthouse + sécurité

| Sujet                          | État                                                                                                                                                                                    | Décision pendante                                                            |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Playwright E2E                 | 2/7 flows livrés (`smoke.spec.ts`, `i18n.spec.ts`). Manquent : booking-essentielle, option-48h, audit-request, implementation-request, aeo-faq, admin-validate-option, language-switch. | Étendre maintenant ou bundler avec M10 dédié ?                               |
| Lighthouse CI seuils           | `lighthouserc.json` : LCP ≤ 2500, INP ≤ 200, CLS ≤ 0.1.                                                                                                                                 | Plan strict : LCP < 1.8s, INP < 80ms, CLS < 0.05. Durcir maintenant ou M10 ? |
| Lighthouse URLs auditées       | `/` seul. Plan strict : 8 URLs × 2 langues.                                                                                                                                             | Étendre.                                                                     |
| Turnstile + honeypot           | Env vars présentes, pas câblé.                                                                                                                                                          | M8 (Server Actions valident Turnstile token).                                |
| `axe-core/playwright`          | Installé, jamais utilisé.                                                                                                                                                               | M10.                                                                         |
| k6 / Artillery / CodeQL / Snyk | Absents.                                                                                                                                                                                | M10.                                                                         |

---

## M11 — Déploiement

**Statut réel 2026-05-08** : 0 % codé sauf Sentry (instrumentation.ts, sentry.{edge,server}.config.ts).

| Ligne / sujet                           | Avant 02-PLAN                               | Après / canon                                                                                                   | Source   |
| --------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------- |
| Hosting                                 | « Hetzner CPX32 commandé » (vague)          | Hetzner CPX32 + Coolify + Caddy 2 + Cloudflare Free. **Total V1-V2 = €6,49/mois HT**.                           | ADR 0009 |
| L627-670 prescriptions Cloudflare       | CF Pro WAF + Bot Fight Mode + Rate Limiting | **SUPPLANTÉ** : CF Free suffit pour V1-V2. WAF Pro reporté Sprint 16+ si trafic justifie.                       | ADR 0009 |
| Sentry full                             | Préconisé                                   | **Décision pendante** : Sentry full (~150 KB gz = 53 % shell) vs RUM custom Hetzner-pure (Web Vitals V6 P-415). | fork E   |
| `docker/docker-compose.yml` (dev local) | À créer                                     | Absent. À créer pour Postgres 16 + Redis 7 + Mailhog.                                                           | fork A   |

---

## R6 / D5 (L839) — Conformité Estonia

`registrikood` + VAT EE (`EE-XXXXXXXXX`) : slots optionnels prêts dans `buildOrganizationJsonLd({ vatID, registrikood })` (lib/seo.ts). Will fournit les valeurs ; câblage layout `~30 min`.

---

## ADR 0006 — pSEO villes (volume canonique)

**Valeur figée 2026-05-08** : `2 155 villes >5 000 hab France métropolitaine + 5 DROM + 13 régions = 2 168 pages pSEO V1`. Toujours utiliser **2 168** comme total et **2 155** comme nombre de villes — éviter le raccourci « 2 150 ».

---

## STOP & ASK encore ouverts (10 — récap)

1. **HEADER-NAV Q5/Q6** — démarrer industrialisation pSEO Auvergne-Rhône-Alpes (~280 villes) ? (bloque scaling au-delà de Paris pilote)
2. **WEB-VITALS P-308** — activer PPR `incremental` + ADR 0011 ? (gain TTFB shell)
3. **WEB-VITALS P-220** — activer React Compiler 19 + ADR 0012 ? (INP −15-30 % auto)
4. **WEB-VITALS P-221** — formaliser refus View Transitions Sprint 14 + ADR 0013 ?
5. **WEB-VITALS P-411** — cleanup deps `@tiptap/*`, `next-auth`, `@tanstack/react-query`, `zustand` (zéro import) ? Garder pour Sprint 17+ ou purger maintenant ?
6. **WEB-VITALS P-415** — RUM custom Hetzner remplaçant Sentry full ?
7. **VISUAL-RHYTHM §6.2** — photo Will réelle (~$200-400) vs portrait illustré GPT-image silhouette ?
8. **PERFECTION-V2 Action 3** — câbler `<Breadcrumbs>` visuel sur 8 pages détail (V1 reportée commit `fd91518`) ?
9. **WEB-VITALS V3-V6** — appliquer 61 patches restants maintenant (avant prod M11) ou différer ?
10. **Pages annoncées non livrées** — `/interventions/equipes` + `/interventions/managers` + `/temoignages/[slug]` : livrer ou retirer du plan ?

---

## Patches recommandés non appliqués (5)

- **PERFECTION-V2 Action 4** — `priority` LCP absent sur 11+ pages (`/interventions`, `/audit`, `/implementation` + 11 sous-pages produit). Gain LCP −10-20 % mobile. Vérifié : 0 match `priority={true}` dans `[locale]/`.
- **PERFECTION-V2 Action 5** — `buildProductJsonLd` non câblée. Vérifié : 0 import. À câbler `/stack-ia` (11 outils) + sous-pages produits.
- **PERFECTION-V2 §1.9** — 5 factories JSON-LD prêtes mais non câblées : `buildAggregateRatingJsonLd`, `buildDatasetJsonLd`, `buildImageObjectJsonLd`, `buildQAPageJsonLd`, `buildHowToJsonLd`.
- **WEB-VITALS V3-V6** — 61 patches Caddy/Dockerfile/standalone/PPR/Compiler/Cloudflare/RUM (gain estimé ~+50 % score Web Vitals).
- **DOC-SYNC P3** — `registrikood` + VAT EE « à compléter » live (`legal.ts:40,72`) + 4 sites JSON-LD non câblés.

---

## Documents stale identifiés (3)

- `_AUDIT/PROMPT-MAITRE.md`, `PROMPT-PAGE-AUDIT-PERFECT-2026.md`, `PROMPT-FRONTEND-PARITY-CHECK.md` — pointer-note ajouté en tête, corps non sweepé (mentions « 75 templates » et routes audit obsolètes).
- `axionia/SESSION_LOG.md` — couverture Sprint 0 + 5b uniquement, rétro Sprints 1-4 et 6-9 manquante.
- `_AUDIT/02-PLAN.md` — annexes ajoutées, corps M2/M4 inchangé. Ce document `PLAN-AMENDMENTS-2026-05-08.md` sert d'overlay canonique.

---

## Cohérences validées (8)

✅ Stack pinning (Next 16.2.4, React 19.2.4, Tailwind v4, Auth.js 5.0.0-beta.31, Prisma 5.22, Node 22, Postgres 16, Redis) cohérent ADR 0001 + DOC-SYNC + ADR 0009.
✅ Doctrine visuelle SSOT : ADR 0002 + 0004 + 0007 + Design.md alignés 1:1.
✅ Vocabulaire « intervention coaching » : ADR 0008 + DOC-SYNC + sweep skills.
✅ Hosting €6,49/mois : ADR 0009 + mémoire `axionia_hosting_hetzner.md`.
✅ pSEO périmètre : ADR 0006 fige 2 168 pages V1.
✅ Naming brand : « Axion-IA » (sans tiret) systématique dans CLAUDE/AGENTS/Design/ADRs/02-PLAN. « Axion-IA » réservé au repo path.
✅ Politique 90 jours / Tallinn : purgée site-wide sauf `legal.ts` (exception attendue).
✅ ADR 0001 doublon nettoyé (commit `18dd599`).

---

## Décisions tranchées 2026-05-08 (fin de session audit)

### Q1 — Pages annoncées non livrées : **RETIRÉES DU PLAN**

`/interventions/equipes`, `/interventions/managers`, `/temoignages/[slug]` — annoncées dans 02-PLAN M4 §1 et M6 §3 mais jamais livrées. Will a tranché 2026-05-08 : **état actuel = état final**. Module 1 Interventions = 4 templates (`essentielle`, `conference`, `dirigeants`, parent). Témoignages restent en composant `TestimonialsCarousel` (pas de route dédiée).

**Implication** : ne plus considérer ces 3 routes comme un gap. Le 02-PLAN ligne 197-199 (« 6 pages × 2 langues = 12 routes effectives ») est rétroactivement amendé à 8 routes effectives (4 templates × 2 langues).

### Q2 — Web Vitals V3-V6 (61 patches) : **AVANT M11 DÉPLOIEMENT**

Will a tranché 2026-05-08 : appliquer V3-V6 dans la fenêtre pré-prod (juste avant M11), pas maintenant. Cohérent avec V3-V5 qui touchent Caddy/Dockerfile/standalone/Cloudflare = infra de toute façon nécessaire pour M11.

**Implication** : la mémoire `axionia_audit_web_vitals_v3_v6_pending` reste active. Score Web Vitals 47.2 % accepté en l'état jusqu'à pré-déploiement. Le rappel proactif sur trigger phrases « Hetzner / Cloudflare / prod / déploiement » reste en vigueur.

### Q3 — Fixes triviaux : **EXÉCUTÉS / RECONSIDÉRÉS**

Validation à la source des 4 fixes proposés a réduit le périmètre :

| Fix proposé                             | Statut                    | Pourquoi                                                                                                                                                                                                                                                                                               |
| --------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `buildProductJsonLd` /stack-ia          | **Annulé (déjà couvert)** | `/stack-ia/page.tsx:159-178` câble déjà un `ItemList` JSON-LD avec `SoftwareApplication` pour les 11 outils. Ajouter `Product` ferait redondance.                                                                                                                                                      |
| `priority={true}` hero images 11+ pages | **Annulé (no-op)**        | Aucune `<Image>` directe dans `[locale]/`. Seul le composant `Illustration` rend `next/image` quand `src` est fourni — mais `public/illustrations/` est vide (placeholders SVG partout). `priority` n'a aucun effet tant que les images GPT-image ne sont pas générées (Sprint Visual Rhythm Phase 2). |
| `.well-known/indexnow.txt`              | **✅ EXÉCUTÉ**            | Route `app/api/indexnow/key/route.ts` créée + `keyLocation` dans `app/api/indexnow/route.ts:46` mis à jour de `${HOST}/${key}.txt` à `${HOST}/api/indexnow/key`. Cohérent avec spec IndexNow (`keyLocation` libre). Évite catch-all racine qui aurait conflé avec `[locale]`.                          |
| Durcir Lighthouse seuils 1800/80/0.05   | **Reporté post V3-V6**    | Durcir maintenant = CI rouge en boucle sur `/reserver` (CLS 0.552 + Perf 66 mesurés baseline). À durcir après V3-V6 (cf. Q2).                                                                                                                                                                          |

### Faux positifs détectés des audits passés (à NE PAS refixer)

Validation à la source du code actuel a montré que 3 findings du fork E étaient obsolètes :

- **`/reserver` CLS 0.552** → `BookingCalendarLazy.tsx:31-37` contient déjà un skeleton `min-h-[800px]` animate-pulse qui réserve l'espace. Le commentaire P-401 du composant atteste du patch V1+V2 commit `d21f9d0`. Le score 0.552 = baseline pré-V1/V2. **Mesure à refaire post-V1/V2 avant tout re-patch.**
- **`api/og/route.tsx:13` couleur** → déjà `#1a4dd9` doctrine v3. Le commentaire `(was Webflow Blue #146ef5 v1)` est juste historique.
- **`presse/page.tsx:120,184` `inLanguage`** → utilise `loc` variable, pas hardcodé.
- **`presse/page.tsx:187` NewsArticle.image** → utilise `/api/og?title=...` dynamique, pas une URL 404.

**Leçon documentée en mémoire** : les rapports `_AUDIT/AUDIT-OBSOLESCENCES-*.md` et `AUDIT-PERFECTION-*.md` peuvent eux-mêmes être obsolètes au moment de relecture. Toujours valider à la source du code actuel avant d'appliquer un fix recommandé par un audit ancien.

### Q4 — Démarrage backend M8 : **EN ATTENTE**

Question posée mais sans réponse au moment de cette mise à jour. À trancher en fin de session ou next session :

- (a) Ouvrir conv backend M8 maintenant en parallèle (cette conv reste sur le frontend en attente)
- (b) Finir frontend en attente d'abord (V3-V6 + pSEO Auvergne-Rhône-Alpes)
- (c) Round de décisions sur les 10 STOP & ASK ouverts d'abord
- (d) Stop session ici

---

## Fichiers modifiés cette session (2026-05-08 audit)

- `_AUDIT/PLAN-AMENDMENTS-2026-05-08.md` — créé (ce fichier, overlay canonique)
- `_AUDIT/02-PLAN.md` — bandeau d'avertissement en tête + mention « figé »
- `src/app/api/indexnow/key/route.ts` — créé (Edge runtime, sert `INDEXNOW_KEY` en text/plain)
- `src/app/api/indexnow/route.ts` — `keyLocation` mis à jour
- `~/.claude/.../memory/axionia_audit_coherence_2026-05-08.md` — créé (mémoire persistante)
- `~/.claude/.../memory/MEMORY.md` — index mis à jour
