# Cartographie complète des routes — LMS e-learning Axion-IA

> Document de référence **exhaustif** : toutes les routes (pages + route handlers) à **créer** ou **modifier** pour la plateforme e-learning, ancré sur le code réel d'Axion-IA (Next.js 16.2 App Router, next-intl FR canonique, Prisma 5.22, NextAuth v5, BullMQ, R2, Cloudflare Stream).
>
> Dernière mise à jour : 2026-06-27.
> Statut socle : `03-DATA-MODEL/01-schema-cours-modules-lecons.md` (✅), ADR `00-INDEX/DECISIONS-ARBITRAGES.md` (✅), roadmap `11-ROADMAP/01-phasage-mvp-v1-v2.md` (✅).

---

## 0. Conventions, légende et règles transverses

### 0.1 Légende des colonnes

| Colonne          | Valeurs possibles                                                                                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Méthode**      | `Page` (Server/Client Component) · `GET/POST/PUT` (Route Handler) · `SA` (Server Action — pas une route HTTP mais listée pour complétude du flux)                             |
| **Auth / Guard** | `public` · `portail` (cookie apprenant HttpOnly) · `admin:read/write/publish/delete` (RBAC NextAuth) · `signed` (URL signée HMAC/R2/Stream) · `webhook` (signature provider)  |
| **Statut**       | `EXISTANT` (réutilisé tel quel) · `ÉTENDU` (fichier existant modifié) · `NEUF` (à créer)                                                                                      |
| **Rendu**        | `force-dynamic` · `ISR(n)` (revalidate n s) · `SSG` · `route` (handler, pas de rendu HTML)                                                                                    |
| **i18n**         | `pathnames` (déclaré dans `src/i18n/routing.ts`, indexable FR, EN→301) · `hors-pathnames` (segment `[locale]` direct, jamais indexé) · `n/a` (sous `/api`, pas de `[locale]`) |
| **Phase**        | `MVP` · `V1` · `V2` (cf. `11-ROADMAP/01-*`)                                                                                                                                   |

### 0.2 Deux mondes d'authentification (ne JAMAIS mélanger — ADR-LMS-0001)

- **Monde ADMIN** = NextAuth v5 (`src/auth.ts`, `auth()`), rôles `super_admin / admin / editor / reader`. Guards `requireAdminRead/Write/Publish/Delete` (`src/server/actions/knowledge/_guards.ts`). Toutes les routes admin e-learning sous `(admin)/[adminPrefix]/elearning/**`.
- **Monde APPRENANT** = système **séparé**, cookie HttpOnly dédié. MVP réutilise l'infra portail Qualiopi existante :
  - cookie via `src/server/qualiopi/portail/cookie.ts` (`getPortailToken` / `setPortailCookie`, `HttpOnly, Secure, SameSite=Lax, maxAge 90 j`) ;
  - vérification via `src/server/qualiopi/portail/portail-service.ts` (`verifierToken` timing-safe, `getEspaceStagiaire`) ;
  - modèle `PortailAcces` (token 64 hex), entité `Trainee`.
  - **Extension NEUVE** (ADR-0001) : `Trainee.passwordHash` (argon2id, **nullable**) pour le login email/mot de passe **optionnel** des comptes entreprise. Helper neuf `src/server/elearning/auth/learner-session.ts` (réutilise le même cookie/format de token que le portail Qualiopi pour ne pas fragmenter la session).

> **Conséquence routes** : les pages apprenant **étendent l'arbre `/[locale]/portail/**`** (déjà hors `pathnames`, déjà `noindex`+`force-dynamic`). On hérite gratuitement du `noindex`, du cookie et du rate-limit.

### 0.3 Règles i18n (FR-only effectif)

- `routing.locales = ["fr","en"]` mais EN **désactivé** : `src/proxy.ts` émet un **301 `/en/*` → `/fr/*`** (`mapEnToFr`). `STATIC_LOCALES = ["fr"]` (EN non pré-rendu).
- **Routes publiques** (catalogue, fiche) → **DOIVENT** être ajoutées au `pathnames` de `routing.ts`. Règle anti-bug 307 next-intl : déclarer `fr === en` (ex. `"/formations-en-ligne": { fr: "/formations-en-ligne", en: "/formations-en-ligne" }`) — **jamais** de mapping `fr ≠ en` tant que le bug next-intl v4.11/Next 16.2 n'est pas corrigé.
- **Routes portail & admin** → **hors `pathnames`** (segment `[locale]` direct, comme l'existant `/portail/mon-espace` et `(admin)/[adminPrefix]/*`). Jamais indexées.
- **Routes `/api/elearning/*`** → **hors `[locale]`** (pas de segment locale, pattern identique à `/api/qualiopi/*`, `/api/image-bank/*`).

### 0.4 Server Actions par défaut, Route Handlers seulement quand nécessaire

Convention repo : **Server Actions** pour toute mutation pilotée par un formulaire/bouton (CRUD authoring, octroi d'accès, soumission de quiz, complétion de leçon, déclaration handicap…). On crée un **Route Handler `/api/elearning/*`** UNIQUEMENT pour :

1. les **URLs signées** (upload/playback vidéo Stream, download R2) — un navigateur a besoin d'une URL HTTP ;
2. les **webhooks** providers (Cloudflare Stream transcode, Stripe) ;
3. le **heartbeat de progression** (appelé par `navigator.sendBeacon` / `fetch keepalive` — incompatible avec une Server Action) ;
4. les **téléchargements** (PDF certificat, ressources) qui doivent retourner un `redirect 302` vers une URL signée.

### 0.5 Build `stub.invalid` (ADR-0026)

Toutes les pages apprenant/admin sont **`force-dynamic` + derrière auth** → jamais exécutées au build SSG → **compatibles stub** sans précaution. Les pages **publiques** (catalogue/fiche, en `ISR`) font des appels Prisma au build : elles **doivent** tolérer le stub (`prisma` renvoie `[] / null / 0`) en affichant un fallback vide repeuplé par l'ISR sous 1 h (pattern identique à `/ressources`, `/connaissances`).

### 0.6 Cloisonnement du code (ADR-0007)

| Couche               | Emplacement                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------- |
| Pages publiques      | `src/app/[locale]/formations-en-ligne/**`                                                   |
| Pages apprenant      | `src/app/[locale]/portail/**` (extension)                                                   |
| Pages admin          | `src/app/[locale]/(admin)/[adminPrefix]/elearning/**`                                       |
| Route handlers API   | `src/app/api/elearning/**`                                                                  |
| Domaine / services   | `src/server/elearning/**` (auth, progression, quiz, video, octroi, certificats, conformité) |
| Server Actions       | `src/server/elearning/actions/**`                                                           |
| Composants apprenant | `src/components/elearning/**`                                                               |
| Composants admin     | `src/components/admin/elearning/**`                                                         |
| Workers              | `src/server/queue/workers/elearning-*-worker.ts` + queues dans `src/server/queue/queues.ts` |

---

## 1. Routes PUBLIQUES (catalogue / fiche / achat)

> Indexables, SEO/AEO. **À ajouter dans `src/i18n/routing.ts` `pathnames`** (mapping `fr === en`). JSON-LD `Course` (réutiliser `src/lib/seo.ts`). Budgets Web Vitals stricts (LCP ≤ 1800, INP ≤ 100, CLS = 0). E-commerce **gated** `STRIPE_ENABLED=false` → MVP = formulaire de demande + virement + octroi manuel.

| #   | Route (FR canonique)                                 | Fichier cible                                                       | Méthode | Auth    | Params                                      | Statut               | Rendu           | i18n              | Phase                   |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------- | ------- | ------- | ------------------------------------------- | -------------------- | --------------- | ----------------- | ----------------------- |
| P1  | `/formations-en-ligne`                               | `src/app/[locale]/formations-en-ligne/page.tsx`                     | Page    | public  | —                                           | NEUF                 | `ISR(3600)`     | pathnames `fr=en` | V1 (catalogue)          |
| P2  | `/formations-en-ligne/[slug]`                        | `src/app/[locale]/formations-en-ligne/[slug]/page.tsx`              | Page    | public  | `slug` (`ElearningCourse.slug`)             | NEUF                 | `ISR(3600)`     | pathnames `fr=en` | **MVP** (1 cours)       |
| P3  | `/formations-en-ligne/[slug]/commander`              | `src/app/[locale]/formations-en-ligne/[slug]/commander/page.tsx`    | Page    | public  | `slug`                                      | NEUF                 | `force-dynamic` | pathnames `fr=en` | **MVP** (lead/virement) |
| P4  | `/formations-en-ligne/[slug]/commander` (soumission) | `src/server/elearning/actions/order.ts` → `creerDemandeAccesAction` | SA      | public  | `slug`, form (email, identité, entreprise?) | NEUF                 | n/a             | n/a               | **MVP**                 |
| P5  | `/formations-en-ligne/confirmation`                  | `src/app/[locale]/formations-en-ligne/confirmation/page.tsx`        | Page    | public  | `?ref=`                                     | NEUF                 | `force-dynamic` | pathnames `fr=en` | MVP                     |
| P6  | `/api/stripe/webhook` (CB, quand activé)             | `src/app/api/stripe/webhook/route.ts`                               | POST    | webhook | —                                           | **EXISTANT** (gated) | route           | n/a               | V1                      |

**Notes P1–P6**

- **Réutilisation `Formation` (présentiel)** : un cours e-learning peut être **autonome** (`ElearningCourse.formationId = null`, vendu seul) OU **adossé** à une `Formation` Qualiopi. Le hub présentiel existant `/formations` reste distinct ; lier les deux via un encart « version e-learning disponible » (lien interne, maillage SEO).
- **Achat MVP** (ADR-0004) : `creerDemandeAccesAction` crée une commande `ElearningOrder` (cf. `03-DATA-MODEL/05-schema-ecommerce-commandes.md`, statut `en_attente_virement`), notifie l'admin (email Nodemailer), **n'octroie rien automatiquement**. L'admin octroie ensuite (cf. §3, octroi manuel).
- **Achat V1 CB** : quand `STRIPE_ENABLED=true`, le bouton « Commander » bascule sur le tunnel Stripe (réutilise `src/lib/stripe.ts`, `Invoice/Payment`, webhook existant). Le `payment_intent.succeeded` déclenche l'octroi auto via `elearning-access-worker`.
- **JSON-LD** : `Course` + `Offer` (prix depuis `pricing.ts` SSOT — **jamais** de prix en dur) + `Provider` (Org Axion-IA via `src/lib/seo.ts`).
- **Stub** : P1/P2 (ISR) doivent renvoyer une page vide gracieuse si `prisma` short-circuite au build (slug introuvable → `notFound()` géré par `dynamicParams`).

---

## 2. Routes APPRENANT (`/[locale]/portail/**` étendu)

> **Hors `pathnames`**, `noindex`, `force-dynamic`, cookie apprenant. Tous les fichiers sous `src/app/[locale]/portail/**`. Charte sobre (Tailwind public, **PAS** de tokens admin). WCAG 2.2 AA obligatoire (EAA 28/06/2025) : critères 2.4.11, 2.5.7 (alternative au drag pour appariement/ordonnancement), 2.5.8 (cibles ≥ 24px), 3.3.8 (auth accessible). **Aucune** mention Qualiopi/CPF/financement côté apprenant.

### 2.1 Authentification apprenant

| #   | Route                                   | Fichier cible                                                          | Méthode | Auth                 | Params                 | Statut                                                 | Rendu           | i18n           | Phase |
| --- | --------------------------------------- | ---------------------------------------------------------------------- | ------- | -------------------- | ---------------------- | ------------------------------------------------------ | --------------- | -------------- | ----- |
| A1  | `/portail/acces/[token]`                | `src/app/[locale]/portail/acces/[token]/route.ts`                      | GET     | signed (token 64hex) | `token`                | **EXISTANT**                                           | route           | hors-pathnames | MVP   |
| A2  | `/portail/mon-espace`                   | `src/app/[locale]/portail/mon-espace/page.tsx`                         | Page    | portail              | —                      | **ÉTENDU** (ajout section « Mes formations en ligne ») | `force-dynamic` | hors-pathnames | MVP   |
| A3  | `/portail/acces-invalide`               | `src/app/[locale]/portail/acces-invalide/page.tsx`                     | Page    | public               | —                      | **EXISTANT**                                           | static          | hors-pathnames | MVP   |
| A4  | `/portail/connexion`                    | `src/app/[locale]/portail/connexion/page.tsx`                          | Page    | public               | `?next=`               | NEUF                                                   | `force-dynamic` | hors-pathnames | MVP   |
| A5  | demande magic-link                      | `src/server/elearning/actions/auth.ts` → `demanderLienConnexionAction` | SA      | public               | form (email)           | NEUF                                                   | n/a             | n/a            | MVP   |
| A6  | login mot de passe (entreprise)         | `src/server/elearning/actions/auth.ts` → `connexionMotDePasseAction`   | SA      | public               | form (email, password) | NEUF (gated `LEARNER_PASSWORD_ENABLED`)                | n/a             | n/a            | V1    |
| A7  | `/portail/definir-mot-de-passe/[token]` | `src/app/[locale]/portail/definir-mot-de-passe/[token]/page.tsx`       | Page    | signed               | `token` (set/reset)    | NEUF                                                   | `force-dynamic` | hors-pathnames | V1    |
| A8  | set/reset password                      | `src/server/elearning/actions/auth.ts` → `definirMotDePasseAction`     | SA      | signed               | form (token, password) | NEUF                                                   | n/a             | n/a            | V1    |
| A9  | `/portail/deconnexion`                  | (réutilise `quitterPortailAction` existant)                            | SA      | portail              | —                      | **EXISTANT**                                           | n/a             | n/a            | MVP   |

**Notes auth**

- A1 : magic-link existant — **chemin par défaut MVP**, zéro friction. Rate-limit IP (10/60s, `checkRateLimit`) déjà en place.
- A4/A5 : page de connexion unifiée = (1) saisie email → envoi magic-link (réutilise A1) ; (2) onglet « mot de passe » visible seulement si le compte a un `passwordHash` (entreprise).
- A6 : argon2id, comparaison timing-safe. **Gated** `LEARNER_PASSWORD_ENABLED=false` au MVP (magic-link suffit). `passwordHash` posé via import entreprise (§3) ou A7/A8.
- **Aucune régression NextAuth** : zéro import de `src/auth.ts` dans le monde apprenant.

### 2.2 Espace de cours, lecteur, quiz, certificat

| #   | Route                                                                         | Fichier cible                                                            | Méthode | Auth                                   | Params                              | Statut | Rendu           | i18n           | Phase |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------- | -------------------------------------- | ----------------------------------- | ------ | --------------- | -------------- | ----- |
| A10 | `/portail/cours` (tableau de bord apprenant)                                  | `src/app/[locale]/portail/cours/page.tsx`                                | Page    | portail                                | —                                   | NEUF   | `force-dynamic` | hors-pathnames | MVP   |
| A11 | `/portail/cours/[courseSlug]` (sommaire + progression)                        | `src/app/[locale]/portail/cours/[courseSlug]/page.tsx`                   | Page    | portail + `ElearningEnrollment`        | `courseSlug`                        | NEUF   | `force-dynamic` | hors-pathnames | MVP   |
| A12 | `/portail/cours/[courseSlug]/lecons/[lessonId]` (lecteur)                     | `src/app/[locale]/portail/cours/[courseSlug]/lecons/[lessonId]/page.tsx` | Page    | portail + accès leçon (déverrouillage) | `courseSlug`, `lessonId`            | NEUF   | `force-dynamic` | hors-pathnames | MVP   |
| A13 | `/portail/cours/[courseSlug]/quiz/[quizId]` (passage quiz)                    | `src/app/[locale]/portail/cours/[courseSlug]/quiz/[quizId]/page.tsx`     | Page    | portail + accès quiz                   | `courseSlug`, `quizId`              | NEUF   | `force-dynamic` | hors-pathnames | MVP   |
| A14 | `/portail/cours/[courseSlug]/quiz/[quizId]/resultat/[attemptId]` (correction) | `.../resultat/[attemptId]/page.tsx`                                      | Page    | portail + ownership `attemptId`        | `courseSlug`, `quizId`, `attemptId` | NEUF   | `force-dynamic` | hors-pathnames | MVP   |
| A15 | `/portail/cours/[courseSlug]/certificat` (certificat de réalisation)          | `.../certificat/page.tsx`                                                | Page    | portail + cours complété ≥ seuil       | `courseSlug`                        | NEUF   | `force-dynamic` | hors-pathnames | MVP   |
| A16 | `/portail/cours/[courseSlug]/devoirs/[lessonId]` (rendu travail FOAD)         | `.../devoirs/[lessonId]/page.tsx`                                        | Page    | portail                                | `courseSlug`, `lessonId`            | NEUF   | `force-dynamic` | hors-pathnames | V1    |

**Server Actions associées (mutations apprenant)** — `src/server/elearning/actions/*`

| #   | Action                         | Fichier               | Auth    | Effet                                                                              | Phase |
| --- | ------------------------------ | --------------------- | ------- | ---------------------------------------------------------------------------------- | ----- |
| A17 | `marquerLeconCompleteAction`   | `actions/progress.ts` | portail | upsert `LessonProgress.completed`, recalcul déverrouillage suivant                 | MVP   |
| A18 | `demarrerTentativeQuizAction`  | `actions/quiz.ts`     | portail | crée `QuizAttempt` (timestamp **serveur** = anti-triche), tire N parmi M + shuffle | MVP   |
| A19 | `soumettreTentativeQuizAction` | `actions/quiz.ts`     | portail | correction auto, calcul score pondéré, gating `unlock_score_pct`, feedback         | MVP   |
| A20 | `rendreDevoirAction`           | `actions/devoir.ts`   | portail | upload R2 (`getSignedUploadUrlR2`) + trace preuve FOAD                             | V1    |
| A21 | `poserQuestionTuteurAction`    | `actions/tuteur.ts`   | portail | tuteur RAG ancré (réutilise knowledge/RAG), citations                              | V1    |

**Notes apprenant**

- **Déverrouillage** (`ElearningUnlockType`) évalué **côté serveur** dans le loader de A11/A12/A13 : `immediat / apres_precedent / date_fixe / offset_inscription / score_quiz`. Un élément verrouillé est affiché **avec sa raison** (best practice 2026) — jamais masqué silencieusement. **Override admin** possible (cf. §3).
- **Reprise auto** : A12 lit `LessonProgress.lastPositionSec` (vidéo) pour reprendre où l'apprenant s'est arrêté ; heartbeat via API B5 (§4).
- **Player vidéo** : composant client `src/components/elearning/VideoPlayer.tsx` (HLS.js, vitesse, sous-titres WCAG, clavier). Risque **INP** → lazy-load, pas d'autoplay. URL HLS signée obtenue via API B4.
- **Moteur quiz** : composant client `src/components/elearning/QuizRunner.tsx` ; ~12 types (QCM mono/multi, vrai-faux, appariement, texte à trous, ordonnancement, réponse courte, essai+correction manuelle, upload). Correction des types objectifs **côté serveur** (A19) — jamais de bonne réponse exposée au client avant soumission.
- **Certificat** A15 : réutilise `DocumentGenere` + `qrToken` ; vérification publique via la route **existante** `/[locale]/verifier-attestation/[token]` (aucune route neuve). Génération PDF via worker (§5) + `@react-pdf/renderer`, modèle officiel « certificat de réalisation » (heures réalisées, centièmes) — cf. `08-CONFORMITE`.

---

## 3. Routes ADMIN (`(admin)/[adminPrefix]/elearning/**`)

> **Hors `pathnames`**, `adminPrefix` = segment aléatoire role-gated. Tous sous `src/app/[locale]/(admin)/[adminPrefix]/elearning/**`. UI = `AdminPageShell` / `AdminHeader` / `AdminTable` / `AdminBadge` / `StatCard`. RBAC via guards `requireAdmin*`. `force-dynamic` (données live admin). **Nav** : ajouter un groupe `elearning` dans `src/lib/admin-nav.ts` (`AdminNavGroup`, `ADMIN_NAV_GROUP_LABELS`, `ADMIN_NAV_GROUP_ORDER`, items dans `buildAdminNav()` avec `base = /fr/${adminPrefix}`).

### 3.1 Pilotage & catalogue

| #   | Route                                                              | Fichier cible                                | Méthode | Guard         | Params                      | Statut | Rendu           | Phase |
| --- | ------------------------------------------------------------------ | -------------------------------------------- | ------- | ------------- | --------------------------- | ------ | --------------- | ----- |
| AD1 | `/elearning` (tableau de bord LMS)                                 | `(admin)/[adminPrefix]/elearning/page.tsx`   | Page    | `admin:read`  | —                           | NEUF   | `force-dynamic` | MVP   |
| AD2 | `/elearning/cours` (liste cours)                                   | `.../elearning/cours/page.tsx`               | Page    | `admin:read`  | `?statut=&q=`               | NEUF   | `force-dynamic` | MVP   |
| AD3 | `/elearning/cours/nouveau`                                         | `.../elearning/cours/nouveau/page.tsx`       | Page    | `admin:write` | —                           | NEUF   | `force-dynamic` | MVP   |
| AD4 | `/elearning/cours/[id]` (éditeur — outil auteur)                   | `.../elearning/cours/[id]/page.tsx`          | Page    | `admin:write` | `id` (`ElearningCourse.id`) | NEUF   | `force-dynamic` | MVP   |
| AD5 | `/elearning/cours/[id]/modules/[moduleId]` (édition module/leçons) | `.../cours/[id]/modules/[moduleId]/page.tsx` | Page    | `admin:write` | `id`, `moduleId`            | NEUF   | `force-dynamic` | V1    |
| AD6 | `/elearning/cours/[id]/apercu` (aperçu « as student »)             | `.../cours/[id]/apercu/page.tsx`             | Page    | `admin:read`  | `id`                        | NEUF   | `force-dynamic` | V1    |
| AD7 | `/elearning/cours/[id]/parametres` (FOAD, seuil, drip)             | `.../cours/[id]/parametres/page.tsx`         | Page    | `admin:write` | `id`                        | NEUF   | `force-dynamic` | MVP   |

### 3.2 Apprenants, accès, entreprises

| #    | Route                                                        | Fichier cible                         | Méthode | Guard         | Params                   | Statut | Rendu           | Phase                    |
| ---- | ------------------------------------------------------------ | ------------------------------------- | ------- | ------------- | ------------------------ | ------ | --------------- | ------------------------ |
| AD8  | `/elearning/apprenants` (liste)                              | `.../elearning/apprenants/page.tsx`   | Page    | `admin:read`  | `?q=&entreprise=`        | NEUF   | `force-dynamic` | MVP                      |
| AD9  | `/elearning/apprenants/[id]` (fiche + progression + preuves) | `.../apprenants/[id]/page.tsx`        | Page    | `admin:read`  | `id` (`Trainee.id`)      | NEUF   | `force-dynamic` | MVP                      |
| AD10 | `/elearning/acces` (octroi manuel + liste octrois)           | `.../elearning/acces/page.tsx`        | Page    | `admin:write` | `?cours=`                | NEUF   | `force-dynamic` | MVP                      |
| AD11 | `/elearning/acces/import` (import CSV masse)                 | `.../elearning/acces/import/page.tsx` | Page    | `admin:write` | —                        | NEUF   | `force-dynamic` | MVP                      |
| AD12 | `/elearning/entreprises` (packs sièges — pré-multi-tenant)   | `.../elearning/entreprises/page.tsx`  | Page    | `admin:read`  | —                        | NEUF   | `force-dynamic` | V1                       |
| AD13 | `/elearning/entreprises/[clientId]` (suivi par `Client`)     | `.../entreprises/[clientId]/page.tsx` | Page    | `admin:read`  | `clientId` (`Client.id`) | NEUF   | `force-dynamic` | V1 / V2 (espace délégué) |

### 3.3 Banque de quiz, certificats, médias, reporting, conformité

| #    | Route                                                      | Fichier cible                        | Méthode | Guard           | Params               | Statut | Rendu           | Phase                             |
| ---- | ---------------------------------------------------------- | ------------------------------------ | ------- | --------------- | -------------------- | ------ | --------------- | --------------------------------- |
| AD14 | `/elearning/quiz` (banque de questions)                    | `.../elearning/quiz/page.tsx`        | Page    | `admin:read`    | `?q=&type=`          | NEUF   | `force-dynamic` | V1                                |
| AD15 | `/elearning/quiz/[id]` (édition quiz/questions)            | `.../quiz/[id]/page.tsx`             | Page    | `admin:write`   | `id` (`Quiz.id`)     | NEUF   | `force-dynamic` | V1 (MVP : quiz édités depuis AD4) |
| AD16 | `/elearning/certificats` (registre certificats e-learning) | `.../elearning/certificats/page.tsx` | Page    | `admin:read`    | `?q=`                | NEUF   | `force-dynamic` | MVP                               |
| AD17 | `/elearning/medias` (bibliothèque vidéo/ressources)        | `.../elearning/medias/page.tsx`      | Page    | `admin:write`   | —                    | NEUF   | `force-dynamic` | V1                                |
| AD18 | `/elearning/reporting` (completion, temps, scores)         | `.../elearning/reporting/page.tsx`   | Page    | `admin:read`    | `?cours=&periode=`   | NEUF   | `force-dynamic` | V1                                |
| AD19 | `/elearning/conformite` (export preuves FOAD)              | `.../elearning/conformite/page.tsx`  | Page    | `admin:read`    | `?cours=&apprenant=` | NEUF   | `force-dynamic` | MVP                               |
| AD20 | `/elearning/settings` (réglages LMS, flags)                | `.../elearning/settings/page.tsx`    | Page    | `admin:publish` | —                    | NEUF   | `force-dynamic` | V1                                |

### 3.4 Server Actions admin (CRUD authoring + octroi) — `src/server/elearning/actions/*`

| #    | Action                                                                 | Fichier                       | Guard                          | Effet                                                                                  | Phase |
| ---- | ---------------------------------------------------------------------- | ----------------------------- | ------------------------------ | -------------------------------------------------------------------------------------- | ----- |
| AD21 | `creerCoursAction` / `mettreAJourCoursAction`                          | `actions/admin-course.ts`     | `admin:write`                  | CRUD `ElearningCourse`                                                                 | MVP   |
| AD22 | `publierCoursAction`                                                   | `actions/admin-course.ts`     | `admin:publish`                | `statut=publie`, incrément `version`, `publishedAt`                                    | MVP   |
| AD23 | `reordonnerModulesAction` / `reordonnerLeconsAction`                   | `actions/admin-structure.ts`  | `admin:write`                  | drag&drop → réécrit `ordre` en transaction (`@@unique`)                                | MVP   |
| AD24 | `creerLeconAction` / `mettreAJourLeconAction` / `supprimerLeconAction` | `actions/admin-structure.ts`  | `admin:write` / `admin:delete` | CRUD `ElearningModule`/`ElearningLesson`/`ElearningResource`                           | MVP   |
| AD25 | `octroyerAccesAction` (manuel, 1 apprenant)                            | `actions/admin-access.ts`     | `admin:write`                  | crée `Trainee` (si besoin) + `ElearningEnrollment` + `PortailAcces` + email magic-link | MVP   |
| AD26 | `importerAccesCsvAction`                                               | `actions/admin-access.ts`     | `admin:write`                  | parse CSV → enqueue `elearning-access-worker` (provisioning masse)                     | MVP   |
| AD27 | `revoquerAccesAction`                                                  | `actions/admin-access.ts`     | `admin:write`                  | révoque `ElearningEnrollment` + `PortailAcces`                                         | MVP   |
| AD28 | `overrideDeverrouillageAction`                                         | `actions/admin-access.ts`     | `admin:write`                  | force déverrouillage module/leçon pour un apprenant (best practice)                    | V1    |
| AD29 | `corrigerEssaiAction` (correction manuelle quiz/devoir)                | `actions/admin-grading.ts`    | `admin:write`                  | note questions `essai`/`upload`, recalcul score                                        | V1    |
| AD30 | `genererQuizIaAction`                                                  | `actions/admin-ai.ts`         | `admin:write`                  | quiz-gen depuis contenu leçon (réutilise SDK Anthropic, document-grounded)             | V1    |
| AD31 | `exporterPreuvesFoadAction`                                            | `actions/admin-compliance.ts` | `admin:read`                   | ZIP preuves (logs LMS + évaluations + traces tuteur) — faisceau R.6313-3               | MVP   |

> **Réutilisation forte** : `octroyerAccesAction` (AD25) s'appuie sur `Trainee`, `PortailAcces`, `setPortailCookie` n/a (côté apprenant), et l'email Nodemailer + queue `emails` existants. L'octroi auto « session réalisée → e-learning » est branché dans `qualiopi-formation-crons-worker.ts` (hook `cloture-auto`) — extension, pas de route neuve.

---

## 4. Routes API (`/api/elearning/*`) — Route Handlers

> Hors `[locale]`, `export const dynamic = "force-dynamic"`, jamais appelées au build (stub-safe). Pattern auth identique à `/api/qualiopi/documents/[id]/route.ts` (apprenant : cookie portail ; admin : `auth()` + rôle ; signed : vérif token).

| #   | Route                                     | Fichier cible                                     | Méthode | Auth                                | Params / Body                                                                        | Statut                           | Rendu | Phase                                |
| --- | ----------------------------------------- | ------------------------------------------------- | ------- | ----------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------- | ----- | ------------------------------------ |
| B1  | `/api/elearning/video/upload-url`         | `src/app/api/elearning/video/upload-url/route.ts` | POST    | `admin:write`                       | `{ filename, sizeBytes }` → URL d'upload directe Cloudflare Stream                   | NEUF                             | route | V1 (MVP : upload manuel back-office) |
| B2  | `/api/elearning/video/webhook`            | `src/app/api/elearning/video/webhook/route.ts`    | POST    | webhook (signature Stream)          | event transcode → maj `ElearningLesson.videoAssetId/videoDureeSec`                   | NEUF                             | route | V1                                   |
| B3  | `/api/elearning/video/[assetId]/playback` | `.../video/[assetId]/playback/route.ts`           | GET     | portail + accès leçon               | `assetId` → URL HLS **signée** + token watermark utilisateur                         | NEUF                             | route | MVP                                  |
| B4  | `/api/elearning/video/[assetId]/captions` | `.../video/[assetId]/captions/route.ts`           | GET     | portail                             | `assetId` → WebVTT sous-titres (WCAG)                                                | NEUF                             | route | V1                                   |
| B5  | `/api/elearning/progress`                 | `src/app/api/elearning/progress/route.ts`         | POST    | portail                             | `{ lessonId, positionSec, watchedSec }` (sendBeacon) → upsert `LessonProgress`       | NEUF                             | route | MVP                                  |
| B6  | `/api/elearning/resources/[id]/download`  | `.../resources/[id]/download/route.ts`            | GET     | portail + `telechargeable`          | `id` (`ElearningResource.id`) → `redirect 302` URL R2 signée                         | NEUF                             | route | MVP                                  |
| B7  | `/api/elearning/certificate/[id]/pdf`     | `.../certificate/[id]/pdf/route.ts`               | GET     | portail (ownership) OU `admin:read` | `id` (`DocumentGenere.id`) → re-signe R2, `redirect 302` (clone du pattern qualiopi) | NEUF                             | route | MVP                                  |
| B8  | `/api/elearning/access/import/upload-url` | `.../access/import/upload-url/route.ts`           | POST    | `admin:write`                       | CSV upload direct R2 (gros fichiers)                                                 | NEUF                             | route | MVP                                  |
| B9  | `/api/elearning/tuteur/stream`            | `.../tuteur/stream/route.ts`                      | POST    | portail                             | `{ courseId, question }` → réponse RAG **streamée** (SSE), citations                 | NEUF (gated `LMS_TUTOR_ENABLED`) | route | V1                                   |
| B10 | `/api/stripe/webhook` (octroi auto CB)    | `src/app/api/stripe/webhook/route.ts`             | POST    | webhook                             | `payment_intent.succeeded` → enqueue octroi e-learning                               | **ÉTENDU** (gated)               | route | V1                                   |

**Notes API**

- **B3 (playback)** = cœur sécurité vidéo (ADR-0005) : vérifie le cookie portail + l'`ElearningEnrollment` + le déverrouillage, **puis** demande à Cloudflare Stream une URL HLS signée courte (TTL ~ quelques minutes) avec **watermark dynamique** = identité apprenant. Jamais d'URL Stream brute exposée.
- **B5 (heartbeat)** : doit accepter `navigator.sendBeacon` (content-type `text/plain` toléré) ; throttling serveur ; écrit `lastPositionSec` (reprise auto) + cumul `watchedSec` (preuve d'assiduité FOAD / EDOF). Idempotent.
- **B2/B10 webhooks** : vérification de signature obligatoire ; `force-dynamic` ; jamais d'auth cookie.
- **Pas de route API pour la soumission de quiz** : c'est une **Server Action** (A18/A19) — la bonne réponse ne transite jamais via une API publique.

---

## 5. Workers BullMQ & queues (rappel — pas des routes, mais déclencheurs de flux)

> À déclarer dans `src/server/queue/queues.ts` (pattern `connection ? new Queue(...) : null`) + `bootRepeatableJobs()` pour les crons + `startXxxWorker()` dans `src/server/queue/worker.ts`. Fichiers `src/server/queue/workers/elearning-*-worker.ts`. **Gated** côté worker (no-op si flag off), no-op propre si `BULLMQ_DISABLED`.

| Worker                            | Queue                   | Déclencheur                          | Rôle                                                                            | Phase |
| --------------------------------- | ----------------------- | ------------------------------------ | ------------------------------------------------------------------------------- | ----- |
| `elearning-access-worker.ts`      | `elearning-access`      | event (AD26) + hook session réalisée | provisioning masse CSV : `Trainee`+`Enrollment`+`PortailAcces`+email            | MVP   |
| `elearning-certificate-worker.ts` | `elearning-certificate` | event (cours complété ≥ seuil)       | génère PDF certificat (`@react-pdf/renderer`) → R2 → `DocumentGenere`+`qrToken` | MVP   |
| `elearning-video-worker.ts`       | `elearning-video`       | webhook B2                           | post-transcode : maj durée/asset, extraction sous-titres                        | V1    |
| `elearning-reminders-worker.ts`   | `elearning-crons`       | cron quotidien                       | relances anti-décrochage (Qualiopi Ind.12) + délais tutorat (Ind.19)            | V1    |
| `elearning-ai-worker.ts`          | `elearning-ai`          | event (AD30)                         | quiz-gen + authoring document-grounded (SDK Anthropic)                          | V1    |

> **Réutilisation** : queue `emails` existante pour tous les envois ; `formationEngineQueue` non réutilisée (responsabilités distinctes) ; certificats réutilisent `DocumentGenere` + route de vérification publique existante.

---

## 6. Modifications de fichiers EXISTANTS (récapitulatif)

| Fichier                                          | Modification                                                                                                                                                                   | Section       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| `src/i18n/routing.ts`                            | Ajouter `pathnames` : `/formations-en-ligne`, `/formations-en-ligne/[slug]`, `/formations-en-ligne/[slug]/commander`, `/formations-en-ligne/confirmation` (toutes `fr === en`) | §1            |
| `src/app/[locale]/portail/mon-espace/page.tsx`   | Ajouter section « Mes formations en ligne » (lien vers A10)                                                                                                                    | A2            |
| `src/lib/admin-nav.ts`                           | Nouveau groupe `elearning` : `AdminNavGroup`, `ADMIN_NAV_GROUP_LABELS`, `ADMIN_NAV_GROUP_ORDER`, items dans `buildAdminNav()`                                                  | §3            |
| `prisma/schema.prisma`                           | Modèles cœur LMS (doc 03-01) + `Trainee.passwordHash` (nullable) + relations inverses `Formation.elearningCourses`, `Client.coursesProprietaires`                              | ADR-0001/0008 |
| `src/server/queue/queues.ts`                     | Déclaration des 5 queues e-learning + crons dans `bootRepeatableJobs()`                                                                                                        | §5            |
| `src/server/queue/worker.ts`                     | `startElearning*Worker()` au démarrage                                                                                                                                         | §5            |
| `src/server/qualiopi/portail/portail-service.ts` | Étendre `getEspaceStagiaire` (ou nouveau service `learner-service.ts`) pour exposer les cours e-learning                                                                       | A2/A10        |
| `qualiopi-formation-crons-worker.ts`             | Hook `cloture-auto` → octroi e-learning auto si formation adossée                                                                                                              | AD25          |
| `src/app/api/stripe/webhook/route.ts`            | Brancher octroi e-learning sur `payment_intent.succeeded` (gated `STRIPE_ENABLED`)                                                                                             | B10           |
| `src/lib/seo.ts`                                 | Helper JSON-LD `Course`/`Offer` pour le catalogue public                                                                                                                       | §1            |
| `next.config.ts`                                 | (si renommage futur) `redirects()` 301 — pas nécessaire au MVP                                                                                                                 | §1            |

---

## 7. Récapitulatif par phase

- **MVP** : P2, P3, P4, P5 · A1(existant), A2(étendu), A3, A4, A5, A9, A10–A15, A17–A19 · AD1–AD4, AD7, AD8–AD11, AD16, AD19, AD21–AD27, AD31 · B3, B5, B6, B7, B8 · workers `access` + `certificate`.
- **V1** : P1, P6 · A6, A7, A8, A16, A20, A21 · AD5, AD6, AD12, AD13, AD14, AD15, AD17, AD18, AD20, AD28, AD29, AD30 · B1, B2, B4, B9, B10 · workers `video` + `reminders` + `ai`.
- **V2** : multi-tenant entreprise (espace délégué AD13, branding, SSO/SCIM), CPF/EDOF (`EDOF_ENABLED`), SCORM/xAPI — **aucune** route MVP/V1 à refondre (flags + extensions).

---

## 8. Flags d'activation référencés

| Flag                       | Défaut  | Portée                        | Routes/§ concernées |
| -------------------------- | ------- | ----------------------------- | ------------------- |
| `STRIPE_ENABLED`           | `false` | e-commerce CB                 | P3/P6/B10           |
| `EDOF_ENABLED`             | `false` | CPF/EDOF (V2)                 | hors code MVP       |
| `LEARNER_PASSWORD_ENABLED` | `false` | login mot de passe entreprise | A6/A7/A8            |
| `LMS_TUTOR_ENABLED`        | `false` | tuteur RAG                    | A21/B9              |
| `EN_LOCALE_ENABLED`        | `false` | i18n EN (global)              | §1 (pathnames)      |
| `BULLMQ_DISABLED`          | (build) | workers                       | §5                  |

---

## Liens

- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-0001 (auth hybride), 0002 (multi-tenant V2), 0004 (Stripe gated), 0005 (vidéo Stream), 0007 (cloisonnement), 0008 (migrations additives)
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — `ElearningCourse/Module/Lesson/Resource`, enums (référencés §1–§4)
- `03-DATA-MODEL/02-schema-progression-tracking.md` (à rédiger) — `ElearningEnrollment`, `LessonProgress` (A11/A12/A17/B5)
- `03-DATA-MODEL/03-schema-quiz-evaluations.md` (à rédiger) — `Quiz`, `Question`, `QuizAttempt` (A13/A18/A19/AD14/AD15)
- `03-DATA-MODEL/04-schema-comptes-acces-auth.md` (à rédiger) — `Trainee.passwordHash`, sessions apprenant (§2.1)
- `03-DATA-MODEL/05-schema-ecommerce-commandes.md` (à rédiger) — `ElearningOrder` (P3/P4)
- `04-BACKEND/04-api-routes.md` (à rédiger) — détail des handlers `/api/elearning/*` (§4)
- `04-BACKEND/05-authentification-apprenant.md` (à rédiger) — détail monde apprenant (§2.1)
- `04-BACKEND/07-pipeline-video-streaming.md` (à rédiger) — Cloudflare Stream, signature, watermark (B1–B4)
- `05-FRONTEND-APPRENANT/02-lecteur-cours-player.md` & `04-progression-deverrouillage.md` (à rédiger) — A12/A11
- `06-CONSOLE-ADMIN/01-navigation-structure.md` & `03-outil-auteur-course-builder.md` (à rédiger) — §3, admin-nav
- `08-CONFORMITE/06-tracabilite-preuves-realisation.md` (à rédiger) — preuves FOAD (AD19/AD31/B5)
- `11-ROADMAP/01-phasage-mvp-v1-v2.md` — phasage (§7)
