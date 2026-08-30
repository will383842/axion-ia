# 01 — Contrat de codebase `axionia` (NON NÉGOCIABLE)

> Ce module Qualiopi s'implémente **dans** le codebase `axionia` (Next.js 16). Les specs de
> `AXION_IA_COMPLET_QUALIOPI` ont été rédigées pour une stack générique/hypothétique : **leurs
> exemples SQL bruts, routes REST `/api/v1`, choix de libs et noms de rôles ne s'appliquent PAS
> littéralement.** Traduire toute intention de spec vers les conventions réelles ci-dessous. En cas
> de conflit entre une spec et ce contrat, **ce contrat gagne** (et on le signale).

Toujours re-vérifier dans le code réel en Phase 0 — les versions et chemins ci-dessous reflètent
l'état observé mais doivent être confirmés (`package.json`, `prisma/schema.prisma`, `globals.css`).

> **Lire aussi `reference/04-strategic-positioning-and-preflight.md`** : il porte le contexte
> non-déductible du code (positionnement « Intervention » vs « Formation », entité **SAS France** et non
> OÜ legacy, silence financement sur le public, facturation duale forfait↔horaire, AI Act art. 50,
> sous-traitance ind. 19, pré-vol git/migrations). Plusieurs points y sont des **STOP & ASK**.

---

## 1. Stack réelle (confirmer en Phase 0)

| Domaine         | Réalité `axionia`                                                                                                                                                                                                                         | Implication                                                                                                                                                                                                                                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework       | **Next.js 16.2.6** App Router, React 19.2.4                                                                                                                                                                                               | Server Components par défaut ; `"use client"` minimal et justifié. Build prod **`pnpm build --webpack`** — **NE JAMAIS retirer `--webpack`** (bug Turbopack + `middleware.ts`, marqué « DO NOT REMOVE »).                                                                                                           |
| Package manager | **pnpm 10.x**, Node ≥ 20.18                                                                                                                                                                                                               | Toujours `pnpm`, jamais `npm`/`yarn`.                                                                                                                                                                                                                                                                               |
| ORM / DB        | **Prisma 5.22** + PostgreSQL (citext, pg_trgm, unaccent, uuid-ossp)                                                                                                                                                                       | **Modélisation via `schema.prisma` + `prisma migrate`. Jamais de SQL `ALTER TABLE` manuel** comme dans les specs. Migrations additives uniquement.                                                                                                                                                                  |
| Singletons      | `src/lib/prisma.ts`, `src/lib/redis.ts` — **stub-aware** (ADR 0026)                                                                                                                                                                       | Réutiliser ces singletons. Ne jamais instancier un nouveau client. Respecter le short-circuit `stub.invalid`.                                                                                                                                                                                                       |
| Auth            | **NextAuth 5 (beta)** + `@auth/prisma-adapter`, 2FA TOTP (`otplib`), argon2 ; `auth()` exporté depuis `src/auth.ts`                                                                                                                       | Réutiliser. Pas de Clerk/Lucia. La protection des routes admin est dans **`src/proxy.ts`** (Next 16 — pas `middleware.ts`) via le wrapper `auth()` + `ADMIN_URL_PREFIX`.                                                                                                                                            |
| RBAC            | Rôles **`super_admin` / `admin` / `editor` / `reader`** (modèle `AdminUser`)                                                                                                                                                              | Les rôles « formateur_interne / formateur_externe / auditeur » des specs sont des **rôles métier applicatifs** à modéliser par-dessus le RBAC existant (ex. table `formateurs.user_id`, scope d'accès, token auditeur), PAS de nouveaux rôles NextAuth.                                                             |
| Queue           | **BullMQ 5.x** + ioredis (workers `src/server/queue/workers/*`)                                                                                                                                                                           | Pas de pg-boss. Suivre le pattern worker existant. `BULLMQ_DISABLED=true` au build.                                                                                                                                                                                                                                 |
| IA              | **@anthropic-ai/sdk 0.40** via `src/server/content-gen/providers/anthropic.ts` (+ interface `IProvider`), prompt caching (`cache_control: ephemeral`), `src/server/content-gen/lib/cost-tracker`, `retry.ts`                              | Réutiliser le provider, le caching et le cost-tracker existants. Le provider référence **`claude-sonnet-4-6` / `claude-opus-4-7` / `claude-haiku-4-5`** — **réutiliser sa config, ne jamais hardcoder un ID de modèle ailleurs** ; un upgrade de modèle est une décision explicite (confirmer dans `anthropic.ts`). |
| PDF             | **@react-pdf/renderer 4.5**                                                                                                                                                                                                               | Pas de puppeteer. Templates React-PDF. Les PDF ne peuvent PAS lire les CSS vars → SSOT brand TS (voir reference/03).                                                                                                                                                                                                |
| Email           | **nodemailer + @react-email/components**                                                                                                                                                                                                  | Pas de Resend/SendGrid. Réutiliser `src/lib/email/*`. File d'envoi via BullMQ, retry+backoff, idempotence.                                                                                                                                                                                                          |
| Signature       | **DocuSeal** (`src/lib/docuseal.ts`) + upload manuel + signature physique                                                                                                                                                                 | Réutiliser pour conventions/devis. Pas d'eIDAS qualifiée en v1.                                                                                                                                                                                                                                                     |
| Storage         | **AWS SDK S3 / R2** (`@aws-sdk/client-s3`, presigner)                                                                                                                                                                                     | Signed URLs (expiration courte). Réutiliser le wrapper existant.                                                                                                                                                                                                                                                    |
| i18n            | **next-intl 4.11** — FR **canonique**, EN miroir **désactivé** (301→FR, ADR EN)                                                                                                                                                           | Tout en FR. `messages/fr.json`. Routes admin/portail : FR. Parité i18n vérifiée (`pnpm i18n:check`).                                                                                                                                                                                                                |
| CSS             | **Tailwind CSS v4** — config en `@theme` dans `src/app/globals.css` (PAS de `tailwind.config.*`)                                                                                                                                          | Couleurs/typo via tokens (`bg-canvas`, `text-fg`, `font-serif`…). Voir reference/03.                                                                                                                                                                                                                                |
| Paiement        | **Stripe**                                                                                                                                                                                                                                | Réutiliser pour acomptes/soldes si pertinent ; facturation OF distincte, **avec TVA** (cf. §TVA plus bas).                                                                                                                                                                                                          |
| Validation      | **Zod** + react-hook-form                                                                                                                                                                                                                 | Zod sur chaque Server Action et chaque frontière de données.                                                                                                                                                                                                                                                        |
| State client    | **TanStack React Query 5**                                                                                                                                                                                                                | Pour les listes/dashboards admin.                                                                                                                                                                                                                                                                                   |
| Tests           | **Vitest** (unit + integration, Prisma mock) + **Playwright** (e2e, @a11y)                                                                                                                                                                | `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`.                                                                                                                                                                                                                                                              |
| Gates qualité   | `pnpm verify:all` = typecheck, lint, i18n:check, **anti-siren**, **anti-hex** (interdit hex en dur), use-client, contrast, radius, **image-bank:isolation-check**, test · + `pnpm lhci`, `pnpm bundle:check` (size-limit), husky pre-push | Une tranche n'est « done » que si ses gates passent. Le gate **anti-hex** applique mécaniquement « zéro couleur en dur » → prévoir aussi un **`qualiopi:isolation-check`** analogue.                                                                                                                                |
| Build/Deploy    | Externalisé **GitHub Actions** → GHCR → Coolify pull (ADR 0026). **push `main` = deploy prod.**                                                                                                                                           | Travailler sur branche. Jamais de push `main` sans accord explicite de Will.                                                                                                                                                                                                                                        |

---

## 2. Structure & conventions (réutiliser, ne pas réinventer)

```
src/
  app/[locale]/(admin)/[adminPrefix]/…   ← TOUT l'admin (adminPrefix = segment aléatoire, src/lib/admin-path.ts)
  app/[locale]/…                          ← public (fiches formation publiques vont ici)
  app/api/…                               ← réservé aux webhooks (Stripe, DocuSeal). PAS de CRUD REST métier.
  components/admin/…                      ← composants admin (suffixe V2 pour refontes)
  content/pricing.ts                      ← SSOT prix (NE JAMAIS hardcoder un prix)
  content/interventions.ts                ← SSOT copy interventions
  lib/{prisma,redis,admin-nav,admin-path,docuseal,stripe}.ts, lib/email/*
  server/actions/<domaine>/<action>.ts    ← Server Actions ("use server", Zod, auth, idempotence, audit, log)
  server/content-gen/providers/*          ← providers IA réutilisables
  server/lib/{cost-tracker,retry}.ts
  server/queue/workers/*                  ← jobs BullMQ
  i18n/routing.ts                         ← pathnames FR (type-safe)
  messages/fr.json                        ← dictionnaire FR
prisma/{schema.prisma, migrations/, seed.ts, seeds/}
```

> 🔴 **CORRECTION 2026-06-05 (audit) — chemins à VÉRIFIER en Phase 0, ne pas copier aveuglément :**
> l'audit a relevé que l'exemple `src/server/actions/booking/*` peut ne pas exister (réel probable :
> **`src/features/booking/*`** — coexistence des 2 conventions à confirmer) ; `server/lib/{cost-tracker,retry}.ts`
> serait en réalité **`src/server/content-gen/lib/`** ; et le client Prisma + types s'importent depuis
> **`prisma/generated/client`** (output custom), **JAMAIS** `@prisma/client`. `@auth/prisma-adapter` est
> présent mais non câblé (session JWT pure). **Confirmer chaque chemin par Grep/Glob en Phase 0 avant
> d'écrire.**

**Patterns obligatoires** (calquer sur l'existant — vérifier le chemin réel en Phase 0) :

- **Server Action** : `"use server"` → validation Zod → `auth()` + check rôle → clé d'idempotence →
  mutation Prisma (transaction si multi-tables) → effets de bord via queue → écriture `ActivityLog`/audit
  → retour typé `{ data }`/`{ error }`. Réutiliser le modèle `ActivityLog` existant pour l'audit RGPD.
- **Navigation admin** : un nouvel espace s'enregistre dans **`src/lib/admin-nav.ts`** (SSOT sidebar +
  command palette + breadcrumbs). Ajouter un groupe « Formation / Qualiopi ».
- **Cloisonnement** (comme `image-bank`) : tout le code Qualiopi sous des chemins dédiés —
  `src/server/qualiopi/**`, `src/server/actions/qualiopi/**`, `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/**`,
  `src/app/[locale]/(admin)/[adminPrefix]/formations/**`, `src/components/admin/qualiopi/**`,
  `src/server/queue/workers/qualiopi-*-worker.ts`, fiches publiques sous `src/app/[locale]/formations/**`.
- **Enums Prisma** : `snake_case` en DB, mapping kebab/camel côté UI (comme `InterventionType`).
- **Types** : exporter via `src/types/*` ; ne pas dupliquer les types Prisma.

---

## 3. Modèle de données — point de départ réel

- `prisma/schema.prisma` contient **~107 modèles**. **Lire avant tout** : `Booking`, `CalendarSlot`,
  `BookingOption`, `PricingConfig`, `PaymentScheduleProfile`, `AdminUser`, `ActivityLog`, `Payment`,
  `Invoice`, `ContractDocument`, `Quote`, `Submission`, `Article`, `KnowledgeEntry`.
- **Il n'existe PAS de modèle `Formation`/`TrainingSession` natif.** Les formations passent aujourd'hui
  par `Booking` (types `demarrage_ia_express`, `atelier_ia_cible`). Un champ stub **`trainingSessionId`**
  (FK) existe déjà sur `Booking` → point d'ancrage prévu.
- **Décision d'architecture à acter en Phase 1** : créer les modèles dédiés Qualiopi
  (`Formation`, `TrainingSession`, `Trainee`, `Trainer`, `Enrollment`, `Document`, etc., nommage à
  aligner sur la convention Prisma anglaise/PascalCase du repo) reliés à `Booking` via `trainingSessionId`,
  **sans dupliquer** la logique d'acompte/devis/contrat déjà portée par `Booking/Quote/ContractDocument`.
  Réutiliser `Invoice`/`Payment` pour la facturation, en ajoutant les mentions OF (NDA, Qualiopi) et le
  type `opco_subrogation`. **Pas de mention d'exonération** — cf. §TVA plus bas.
- **Toutes les tables des specs** (sessions, stagiaires, formateurs, inscriptions, evaluations_acquis,
  questionnaires_satisfaction, documents_generes, reclamations, veille_sectorielle, alertes_systeme,
  factures, audit_logs, cache_ia, file_validation, grille_qualite_config, referentiels,
  plan_developpement_competences, kits_financement, partenariats, sous_traitants_of,
  offres_site, clients, devis, supports_formation) → traduites en **modèles Prisma additifs**, pas en SQL.
  Exception : `config_systeme` → **réutiliser `SiteSetting` (catégorie `qualiopi`)**, pas de nouvelle table.
- La **vue `v_indicateurs_qualiopi`** des specs → soit une vue Prisma (`@@map` + migration SQL de vue dans
  un fichier de migration Prisma), soit un service de calcul caché Redis. Décider et documenter.

---

## 4. Valeurs & règles « source de vérité » (ne jamais hardcoder)

| Donnée                                                                                                                              | Source de vérité                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Couleurs, typo, radius                                                                                                              | Tokens Tailwind v4 `@theme` (reference/03) ; jamais de hex en dur.                                                                                                                                                                                                                                                                                        |
| Prix des interventions                                                                                                              | `src/content/pricing.ts` (helpers `getTierById`, `formatPrice`).                                                                                                                                                                                                                                                                                          |
| Copy interventions                                                                                                                  | `src/content/interventions.ts`.                                                                                                                                                                                                                                                                                                                           |
| Paramètres métier (SMIC 12,31 €, reste à charge CPF 103,20 €, plafonds OPCO, NDA, n° Qualiopi, SIRET, adresses, référent handicap…) | **RÉUTILISER le modèle de settings existant** (`SiteSetting`, clé/valeur JSON + catégories + audit) en ajoutant une **catégorie `qualiopi`** — **NE PAS créer une table `ConfigSysteme` parallèle** (le « ConfigSysteme » des specs = cette réutilisation). Helpers `getQualiopiConfig`/`setQualiopiConfig`. Confirmer le nom exact du modèle en Phase 0. |
| Mentions légales                                                                                                                    | Constantes centralisées (un seul module), réutilisées par PDF + UI + tests. Voir §5.                                                                                                                                                                                                                                                                      |
| Marque pour PDF/email (couleurs/fonts)                                                                                              | Module SSOT brand TS miroir de `@theme` (reference/03), parité vérifiée par un script.                                                                                                                                                                                                                                                                    |

---

## 5. Mentions légales EXACTES (centraliser, tester)

À placer dans un module unique (ex. `src/server/qualiopi/legal-mentions.ts`), réutilisé par tous les
PDF/UI, et **couvert par des tests** (« la mention X est présente dans le document Y ») :

- **Convention de formation** : « Établie conformément aux articles L.6353-1 et L.6353-2 du Code du travail ».
- **Attestation de fin de formation** : « Délivrée conformément aux articles L.6353-1 et D.6353-1 du Code du travail ».
- **Certificat de réalisation** : « Article R.6313-3 du Code du travail + arrêté du 21/12/2018 » — **durées en
  centièmes d'heure (7,00 et non 7h00 ; 1,50 pour 1h30)**.
- 🛑 **TVA — Facture** : Axion-IA **facture la TVA**. N° de TVA intracommunautaire posé en prod
  (`FR51108018631`, dans `legal_overrides`), et le hub de facturation classe `AXI-FACT-2026-001` en
  canal « PA (e-invoicing) », donc **dans le champ** — pas `hors_champ`.
  **Ne jamais écrire « Exonéré de TVA — article 261-4-4° du CGI »** sur une facture, ni coder ni
  commenter une branche d'exonération. Décision de Will du 2026-08-02 : « on doit toujours facturer
  la TVA jusqu'à preuve du contraire ». Le champ `regimeTva` porte bien trois valeurs
  (`assujetti` / `exoneration_261` / `franchise_293b`, snapshotées par facture) et `canal.ts` renvoie
  `hors_champ` pour les prestations exonérées : **ces branches existent, elles ne doivent pas être
  empruntées par défaut** — seulement sur décision explicite de Will ou de son expert-comptable.
  Mentions qui restent obligatoires : n° NDA + n° Qualiopi + SIRET.
- Numérotation séquentielle unique non modifiable : `AXI-FORM-YYYY-NNN`, `AXI-SESS-…`, `AXI-ATT-…`,
  `AXI-CERT-…`, `AXI-FACT-…`, `AXI-REC-…` (+ suffixe `-R0N` pour récurrentes).
- Conservation : `suppression_prevue_at = created_at + 5 ans` sur tout document officiel.

---

## 6. Sécurité & RGPD (réutiliser l'existant + ajouts ciblés)

- Auth/2FA/RBAC : NextAuth 5 existant. Token **auditeur** révocable + expirant (liste révocation dans
  `SiteSetting` cat. qualiopi), accès lecture seule, comparaison `timingSafeEqual`.
- QR vérification publique : token non-guessable, `timingSafeEqual`, rate-limited.
- Données sensibles (handicap) : chiffrement applicatif AES-256-GCM (clé en secret env, jamais en DB).
- Upload : validation **magic bytes** côté serveur (pas l'extension) + limites de taille.
- PDF : **signed URLs** S3/R2 à expiration courte (pas de hot-linking).
- RGPD : consentement versionné, export portabilité JSON, anonymisation irréversible (email→SHA-256,
  nom→ANONYME) avec conservation 5 ans des agrégats/documents légaux ; audit d'accès aux données perso
  via `ActivityLog`.
- Rate limiting : génération IA (ex. 3/h/user), vérification QR, portail.

---

## 7. Contrat de build `stub.invalid` (ADR 0026) — NE PAS CASSER

Si une **fiche formation publique** (SSG/ISR) fait un appel Prisma au build, garantir le fallback :
le Proxy stub de `src/lib/prisma.ts` renvoie `[] / null / 0`. Pour toute nouvelle page SSG
DB-dependent, prévoir un early-exit `if (process.env.DATABASE_URL?.includes("stub.invalid")) return <fallback>`
et compter sur l'ISR (`revalidate`) pour repeupler en prod. Ne jamais retirer `SKIP_ENV_VALIDATION`,
`BULLMQ_DISABLED`, ni la magic string. Détails : `C:\Users\willi\AGENTS.md`.

---

## 8. Performance & Web Vitals

Les **15 pages stratégiques** publiques ont des budgets stricts (LCP ≤ 1800 ms, INP ≤ 100 ms, CLS = 0,
First Load JS ≤ 75 KB gz). Les **fiches formation publiques** peuvent y entrer → soigner le poids JS
(Server Components, pas de gros client bundle). L'**admin** n'est pas dans les 15 pages mais reste
responsable (pagination cursor, virtualisation, React Query). Tout patch dégradant un budget public →
STOP & ASK + ADR. `pnpm lhci` est l'autorité réelle ; `size-limit` est un garde-fou.

---

## 9. Mapping « hypothèses des specs → réalité » (corrections systématiques)

| La spec / le V4 dit…                                             | Faire à la place                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ALTER TABLE … ADD COLUMN IF NOT EXISTS`                         | Modèle/champ Prisma + `prisma migrate` (additif).                                                                                                                                                                                                                                                |
| Routes `POST /api/v1/...`                                        | **Server Actions** `src/server/actions/qualiopi/*`. `app/api/*` seulement pour webhooks.                                                                                                                                                                                                         |
| `/admin/...`                                                     | `src/app/[locale]/(admin)/[adminPrefix]/...` + entrée `admin-nav.ts`.                                                                                                                                                                                                                            |
| Rôles `admin / formateur_interne / formateur_externe / auditeur` | RBAC NextAuth (`super_admin/admin/editor/reader`) + rôles métier applicatifs + token auditeur.                                                                                                                                                                                                   |
| puppeteer                                                        | `@react-pdf/renderer`.                                                                                                                                                                                                                                                                           |
| Resend / SendGrid / SMTP ad hoc                                  | `nodemailer` + `@react-email` existant.                                                                                                                                                                                                                                                          |
| pg-boss / Inngest                                                | **BullMQ** + worker pattern existant.                                                                                                                                                                                                                                                            |
| Couleurs `#c24a1b` en dur                                        | Tokens `@theme` (reference/03).                                                                                                                                                                                                                                                                  |
| `getConfig('smic_horaire_brut')` générique                       | `getQualiopiConfig()` lisant `SiteSetting` (cat. `qualiopi`).                                                                                                                                                                                                                                    |
| Taxonomie `dirigeants/un_a_un/collectif_4h…`                     | Taxonomie réelle (essentielle, approfondie, dirigeants, gagner_du_temps, intervention_claude, collectives 4h/1j/2j/3j+, coaching découverte/avancé, audit pyramide) — **extraire de `routing.ts` + `interventions.ts` + `pricing.ts` en Phase 0** et l'utiliser comme référentiel `offres_site`. |
| « v2 : eIDAS / API OPCO / API EDOF »                             | Hors v1 : signature DocuSeal/simple, kits PDF, vérification EDOF manuelle.                                                                                                                                                                                                                       |

Toute autre intention de spec non listée : la **traduire** vers les conventions ci-dessus, jamais la
recopier littéralement.

---

## 10. Points d'intégration VÉRIFIÉS dans le code réel (réutiliser / créer)

Faits confirmés fichier par fichier — re-confirmer en Phase 0, mais ce sont les ancrages réels.

| Besoin                                                                                                | Code réel (file:line indicatif)                                                                                                                                                                 | Décision                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Paramètres métier                                                                                     | `SiteSetting` (clé/valeur JSON + `SiteSettingCategory` + audit) ; actions settings + `revalidatePath`                                                                                           | **RÉUTILISER** + catégorie `qualiopi` + helpers `get/setQualiopiConfig`. Pas de table `ConfigSysteme`.                                                                     |
| Auth / RBAC server action                                                                             | `requireAdminRead/Write/Publish/Delete` (`src/server/actions/knowledge/_guards.ts`), `auth()` (`src/auth.ts`)                                                                                   | **RÉUTILISER** ces guards (créer `src/server/actions/qualiopi/_guards.ts` qui les ré-exporte).                                                                             |
| Audit                                                                                                 | `logKbActivity` → `prisma.activityLog.create` (action, targetType, targetId, changes, ip, ua)                                                                                                   | **RÉUTILISER** le pattern → `logQualiopiActivity`.                                                                                                                         |
| Idempotence                                                                                           | unicité (slug `findUnique` + contraintes `@@unique`) ; `getClientIp()`                                                                                                                          | **RÉUTILISER**.                                                                                                                                                            |
| Protection admin                                                                                      | `src/proxy.ts` (auth() wrapper, `ADMIN_URL_PREFIX`, CSP nonce, i18n)                                                                                                                            | **AUCUN changement** : routes `[adminPrefix]/qualiopi/**` & `/formations/**` auto-protégées.                                                                               |
| Email                                                                                                 | `sendEmail` (`src/lib/email/client.ts`) + `enqueueEmail` → `emailsQueue` (BullMQ) + templates React Email (`src/lib/email/templates/*`)                                                         | **RÉUTILISER** la queue + helper ; **CRÉER** des templates `formation-*.tsx`.                                                                                              |
| Cron / auto-transitions J-7/J-5/J+1                                                                   | **Repeatable jobs BullMQ** : `bootRepeatableJobs()` + `bookingCronsQueue` + `booking-crons-worker.ts` (map `HANDLERS`, patterns cron `"0 8 * * *"`, idempotence `removeRepeatable` avant `add`) | **CRÉER** `formation-crons` queue + `formation-crons-worker.ts` en miroir ; enregistrer dans `bootRepeatableJobs()`.                                                       |
| Documents SIGNÉS (convention, devis, lettre de mission)                                               | DocuSeal (`src/lib/docuseal.ts` : `createContractSubmission`, rôles `CLIENT`/`AXIONIA`, webhook HMAC, mode dégradé upload)                                                                      | **RÉUTILISER** DocuSeal ; créer les **templates côté UI DocuSeal**.                                                                                                        |
| Documents GÉNÉRÉS (attestation, certificat, convocation, feuille d'émargement, kits OPCO/CPF/FT, BPF) | `@react-pdf/renderer` (en deps) ; brand non centralisé                                                                                                                                          | **CRÉER** templates React-PDF + module **`brand-tokens.ts`** (reference/03) + stockage S3 + signed URL.                                                                    |
| Machine à états                                                                                       | `BookingStatus` (enum, prisma) + `BookingTransition` (`@@unique([bookingId,toStatus,trigger])`, `snapshotBefore/After`, `triggeredBy` USER/ADMIN/WEBHOOK/CRON/SYSTEM)                           | **MIROIR** : `FormationSessionStatus` + `FormationTransition`, mêmes guards/idempotence.                                                                                   |
| Fiche publique conforme (ind. 1)                                                                      | `ProductPageTemplate` + `getIntervention()` + `buildServiceJsonLd`/**`buildCourseJsonLd`** (Course schema, durée ISO `PT8H`, `priceEurHt`) — Server Component, `setRequestLocale`               | **MIROIR** : `getFormation()` + variante de template ; réutiliser les builders JSON-LD (Course existe déjà).                                                               |
| Taxonomie → `offres_site`                                                                             | `pricing.ts` (`INTERVENTION_TIERS`/`AUDIT_TIERS`/`IMPLEMENTATION_TIERS`, sous-tiers, `getTierById`, `formatPrice`) + `routing.ts` (pathnames FR)                                                | **RÉUTILISER** : `offres_site` mappe `offre → tierId → slug → prix → durée`. Zéro prix en dur.                                                                             |
| Filtre conformité public                                                                              | `checkTranslationBannedWords()` (`src/lib/knowledge/banned-words.ts:11`) — **bannit le mot « formation »** dans le contenu public (sauf transform/inform/conform…)                              | **RÉUTILISER** comme gate runtime avant publication ; son assouplissement sur les pages OF dédiées est **gouverné par `OF_PUBLIC_DISCLOSURE_ENABLED`** (cf. reference/04). |
| Flag de phase                                                                                         | `isEnLocaleDisabled()` lit `process.env.EN_LOCALE_ENABLED`                                                                                                                                      | **CRÉER** `OF_PUBLIC_DISCLOSURE_ENABLED` (env validé `src/env.ts`) + helper `isQualiopiPublicDisclosureEnabled()` pour gater tout contenu public OF.                       |
