# Carte de réutilisation de l'existant (référence anti-duplication)

> **But.** Avant d'écrire la moindre ligne de LMS, ce document tranche, brique par brique :
> **réutiliser tel quel** / **étendre (additif)** / **ne pas toucher**.
> Il cite les fichiers et lignes réels du repo (`axionia/`) pour qu'un dev senior puisse
> aller voir la source. **Toute duplication d'une brique listée ici est un bug de conception.**
>
> Conventions de lecture :
>
> - 🟢 **Réutiliser tel quel** — on importe/appelle, on ne modifie pas.
> - 🟡 **Étendre (additif)** — on ajoute des colonnes nullable / relations inverses / variantes, **jamais** de DROP ni de changement de signature (ADR-LMS-0008).
> - 🔴 **Ne pas toucher** — zone à risque (NextAuth admin, build stub, webhook Stripe) : on cohabite à côté, on ne réécrit pas.
> - 🆕 **Neuf** — n'existe pas, à construire sous les chemins cloisonnés (ADR-LMS-0007).
>
> Dernière mise à jour : 2026-06-27. Ancré sur le code réel (schema.prisma, r2-storage.ts, portail-service.ts, queues.ts, admin-nav.ts, stripe.ts, \_guards.ts, qualiopi-formation-engine-worker.ts).

---

## 0. Tableau de synthèse (vue 1 écran)

| #   | Brique existante                      | Source (fichier:ligne)                                                                      | Verdict                               | Ce qu'on en fait pour le LMS                                                                                                                                  |
| --- | ------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `Trainee` (apprenant/PII)             | `prisma/schema.prisma:5274`                                                                 | 🟡 Étendre                            | Identité apprenant pivot. Ajout `passwordHash?` (argon2id) + relations inverses LMS. PII/handicap/consentements réutilisés tels quels.                        |
| 2   | `Enrollment` (stagiaire↔session)      | `prisma/schema.prisma:5310`                                                                 | 🟢 + 🆕 jumeau                        | NE PAS détourner pour le e-learning. On crée `ElearningEnrollment` (apprenant↔cours). Lien optionnel via `formationId`/session.                               |
| 3   | `Client` (CRM entreprise)             | `prisma/schema.prisma:4890`                                                                 | 🟡 Étendre                            | Owner multi-tenant (V2) + payeur d'octroi en masse (MVP). Relation inverse `coursesProprietaires`. PAS de scoping tenant au MVP.                              |
| 4   | `PortailAcces` + `portail-service.ts` | `prisma/schema.prisma:6236` ; `src/server/qualiopi/portail/portail-service.ts`              | 🟢 Réutiliser le pattern token        | Base de l'auth apprenant magic-link. On clone le pattern (token 64hex, timing-safe) dans un service LMS dédié plutôt que de surcharger le service Qualiopi.   |
| 5   | Cloudflare R2                         | `src/lib/r2-storage.ts:34-228`                                                              | 🟢 Réutiliser tel quel                | PDF/ressources/sous-titres/devoirs + upload direct navigateur. **PAS** pour la vidéo (→ Cloudflare Stream).                                                   |
| 6   | Stripe (infra + flag)                 | `src/lib/stripe.ts:57-88`                                                                   | 🔴 Ne pas toucher / 🟡 brancher en V1 | Reste éteint (`STRIPE_ENABLED=false`). MVP = octroi manuel. `ElearningOrder` neuf branchera Stripe en V1 sans refonte.                                        |
| 7   | Formation Engine IA                   | `src/server/queue/workers/qualiopi-formation-engine-worker.ts:1-65`                         | 🟢 Réutiliser les sous-couches        | On réutilise provider Anthropic + cost-tracker + retry + cache + grille pour l'IA quiz-gen / authoring. PAS la machine d'états `statutGeneration`.            |
| 8   | `DocumentGenere` (+ QR)               | `prisma/schema.prisma:5507`                                                                 | 🟢 Réutiliser tel quel                | Certificat de réalisation e-learning = nouveau `DocumentType`, même table, même QR public, même rétention.                                                    |
| 9   | Console admin (shell + nav + RBAC)    | `src/lib/admin-nav.ts` ; `AdminPageShell` ; `src/server/actions/knowledge/_guards.ts:20-49` | 🟡 Étendre                            | Nouveau groupe nav `elearning` + pages sous `AdminPageShell`. RBAC réutilisé (4 guards `requireAdmin*`).                                                      |
| 10  | Emails (Nodemailer + BullMQ)          | `src/server/queue/queues.ts:48-50,605-629` ; `src/lib/email/templates/*.tsx`                | 🟢 Réutiliser tel quel                | `enqueueEmail()` + nouveaux templates React Email LMS. Pas de nouvelle queue email.                                                                           |
| 11  | `pricing.ts` (SSOT prix)              | `src/content/pricing.ts`                                                                    | 🟢 Réutiliser comme SSOT              | Tout prix e-learning vient d'ici. Interdit de hardcoder un prix dans le LMS.                                                                                  |
| 12  | BullMQ (queues/connection/crons)      | `src/server/queue/queues.ts:39-46,639-1153` ; `connection.ts`                               | 🟡 Étendre                            | Nouvelles queues `elearning-*` + crons drip/relance dans `bootRepeatableJobs()`. Même `defaultJobOptions`, même garde `BULLMQ_DISABLED`.                      |
| 13  | Build stub (`stub.invalid`)           | `src/lib/prisma.ts` / `redis.ts` (ADR 0026)                                                 | 🔴 Ne pas toucher                     | Toute page LMS est derrière auth + `force-dynamic` → jamais rendue au build. Services LMS stub-aware comme `portail-service.ts`.                              |
| 14  | `EvaluationAcquis` / `Questionnaire`  | `prisma/schema.prisma:5653,5704`                                                            | 🟢 Garder séparé                      | Stockent des résultats Qualiopi (pré/post-formation), **pas** un moteur quiz. Le moteur quiz interactif est 🆕 (`ElearningQuiz`...). Pont possible plus tard. |
| 15  | `FormateurMagicLink`                  | `prisma/schema.prisma:6601`                                                                 | 🟢 Référence de design                | 2ᵉ exemple de magic-link maison (espace-formateur). Confirme le pattern à cloner pour l'auth apprenant.                                                       |
| 16  | `pii-crypto` (chiffrement PII)        | `src/lib/pii-crypto.ts` (`encryptPii`/`decryptPii`)                                         | 🟢 Réutiliser tel quel                | Tout champ sensible apprenant ajouté (ex. notes tuteur) passe par là. Déjà utilisé par `portail-service.ts:21,301`.                                           |

---

## 1. `Trainee` — identité apprenant 🟡 Étendre

**Source.** `prisma/schema.prisma:5274-5307` (table `trainees`).

**Ce qui existe et qu'on réutilise tel quel :**

- PII de base : `nom`, `prenom`, `email` (`@unique @db.Citext`), `telephone`, `entreprise`, `fonction`.
- **Accessibilité / handicap** : `situationHandicap`, `handicapDetailsChiffre` (chiffré pii-crypto, lecture référent), `handicapVerifiePar/At` → directement exploitable pour les obligations d'accessibilité FOAD/Qualiopi sans rien recréer.
- **Consentements RGPD** : `consentementFormation`, `consentementEmail`, `consentementVersion`, `consentementAt`.
- **Soft-delete RGPD** : `deletedAt` + relation `rgpdDemandes` (`RgpdDemande`, schema:6277). Le droit à l'effacement apprenant passe par ce mécanisme existant.
- Relations déjà présentes : `enrollments`, `documents`, `portailAcces`, `appreciations`, `coachingSessions`.

**Ce qu'on ajoute (additif, ADR-LMS-0008) :**

```prisma
// model Trainee { ... }  — AJOUTS NULLABLE UNIQUEMENT
  passwordHash        String?               @map("password_hash") @db.Text   // argon2id, opt-in entreprise (ADR-LMS-0001)
  // relations inverses LMS (FK portée côté tables elearning_* → zéro colonne ici sauf passwordHash)
  elearningEnrollments ElearningEnrollment[]
  lessonProgress       LessonProgress[]
  quizAttempts         ElearningQuizAttempt[]
  elearningAccess      ElearningAccess[]     // sessions d'auth apprenant (cf. doc 04)
```

**Garde-fous :**

- `Trainee` n'a **pas** de `passwordHash` aujourd'hui (vérifié) → l'ajout est sûr. Reste **nullable** : magic-link par défaut, mot de passe optionnel.
- Le hash argon2id n'est **jamais** géré par NextAuth (qui ne connaît que `AdminUser`). Auth apprenant = monde séparé (ADR-LMS-0001, §4).
- Un apprenant e-learning **autonome** (particulier qui achète un cours sans jamais venir en présentiel) est un `Trainee` créé à la volée — pas besoin d'un nouveau modèle « User apprenant ».

---

## 2. `Enrollment` — inscription à une session présentiel/live 🟢 garder + 🆕 jumeau e-learning

**Source.** `prisma/schema.prisma:5310-5354` (table `enrollments`).

**Décision clé (anti-duplication inversée) : NE PAS réutiliser `Enrollment` pour le e-learning.**
`Enrollment` est sémantiquement « stagiaire ↔ **TrainingSession** » (présentiel/live), avec `tauxPresencePct`, `emargementSigneAt`, `attestationResultat`, financement OPCO/France Travail par participant, `@@unique([sessionId, traineeId])`. Le forcer pour le e-learning asynchrone (qui n'a ni session datée ni émargement) corromprait ces invariants Qualiopi présentiel.

**À la place → 🆕 `ElearningEnrollment`** (défini dans `03-DATA-MODEL/02-schema-progression-tracking.md`) :

- relie `Trainee` ↔ `ElearningCourse` (pas `TrainingSession`) ;
- porte la **progression** (% complétion, reprise auto, statut), pas la présence ;
- `@@unique([courseId, traineeId])` (1 inscription par cours par apprenant).

**Pont optionnel (réutilisation intelligente) :**

- `ElearningCourse.formationId` (déjà au data model, schema socle §3) permet d'adosser un cours e-learning à une `Formation` présentielle.
- Quand une `TrainingSession` est réalisée, un **octroi automatique** (cf. §6) peut créer un `ElearningEnrollment` à partir des `Enrollment` de la session → le présentiel débloque le e-learning. C'est un **service de pont**, pas une fusion de modèles.

---

## 3. `Client` — CRM entreprise 🟡 Étendre (sans scoping MVP)

**Source.** `prisma/schema.prisma:4890-4937` (table `clients`).

**Ce qui existe et sert directement :**

- Identité B2B : `raisonSociale`, `siret`, `nafCode`, `idcc`, `secteur`, `taille`, contacts.
- **Financement** : `opcoIdentifie`, `opcoNumeroAdherent`, `opcoEnveloppeAnnuelleCents` → réutilisés pour facturer/financer un pack e-learning entreprise.
- Relations CRM : `devis`, `formations`, `sessions`, `documents`, `enrollmentsFinances`.

**Ce qu'il N'EST PAS (cf. ADR-LMS-0002) :** un multi-tenant. Aucune donnée n'est cloisonnée par `Client`, pas d'admin entreprise, pas de branding. **Le MVP ne change pas ça.**

**Ce qu'on ajoute (additif) :**

```prisma
// model Client { ... }
  coursesProprietaires ElearningCourse[] @relation("ClientCoursesProprietaires")  // FK portée par ElearningCourse.ownerClientId (schema socle §3)
```

- **MVP** : `ownerClientId` reste majoritairement `null` (catalogue global). Le `Client` sert seulement de **payeur** lors de l'octroi/import en masse (§6) et de cible de facturation.
- **V2 (multi-tenant)** : `ownerClientId` + futur scoping `tenantId` sur toutes les requêtes LMS. Conçu maintenant (colonne présente), livré plus tard. Détail → `02-ARCHITECTURE/multi-tenant-strategie.md`.

**Garde-fou :** ne pas introduire de filtre `WHERE ownerClientId = ?` systématique au MVP (ce serait du faux multi-tenant fragile). Le cloisonnement strict est une décision V2 explicite.

---

## 4. `PortailAcces` + `portail-service.ts` — magic-link maison 🟢 Réutiliser le pattern

**Source.**

- Modèle : `prisma/schema.prisma:6236-6248` (table `portail_acces`).
- Service : `src/server/qualiopi/portail/portail-service.ts` (`creerAcces`, `verifierToken`, `revoquerAcces`, `getEspaceStagiaire`).

**Pattern réutilisable, validé en prod :**

- Token = `randomBytes(32).toString("hex")` → 64 hex (`portail-service.ts:83-85`).
- Vérification **timing-safe** via `timingSafeEqual` (`:88-95`, `:159`).
- Cookie HttpOnly 90 j, `lastUsedAt` fire-and-forget (`:164-167`).
- **Stub-aware** : early-exit si `DATABASE_URL` contient `stub.invalid` (`:111,143,206`) → modèle exact à reproduire pour ne pas casser le build (§13).

**Décision : cloner le pattern, ne PAS surcharger le service Qualiopi.**
On ne réutilise pas littéralement `PortailAcces` (couplé au flux Qualiopi `getEspaceStagiaire`). On crée un service auth apprenant LMS dédié (cohabitation propre, ADR-LMS-0007) :

- 🆕 `ElearningAccess` (modèle, doc `04-schema-comptes-acces-auth.md`) : `traineeId`, `token` 64hex, `expiresAt`, `revoked`, `lastUsedAt`, **+ `tokenType` (`magic_link` | `session`)** pour gérer la connexion mot-de-passe entreprise.
- 🆕 `src/server/elearning/auth/learner-auth-service.ts` : copie de la grammaire (`creerAcces`/`verifierToken`/`revoquerAcces`) + `verifyPassword` (argon2id) + cookie/middleware **dédié apprenant** (séparé de NextAuth — ADR-LMS-0001).

**Pourquoi cloner plutôt qu'étendre `PortailAcces` :** éviter de coupler la sécurité de l'espace apprenant LMS au flux Qualiopi (qui a sa propre logique d'attestations). Deux surfaces, deux services, même primitive cryptographique.

**Confirmation par 2ᵉ précédent :** `FormateurMagicLink` (schema:6601) est un 3ᵉ magic-link maison (espace formateur) → le repo a déjà 2 implémentations indépendantes du même pattern. On en ajoute une 3ᵉ, cohérente, pas une abstraction prématurée.

---

## 5. Cloudflare R2 — stockage objets 🟢 Réutiliser tel quel

**Source.** `src/lib/r2-storage.ts` (API complète, lignes 34-228).

**API réutilisée directement (aucune modification) :**
| Fonction | Ligne | Usage LMS |
|---|---|---|
| `isR2Configured()` | `:34` | Garde avant tout accès (mode dégradé). |
| `uploadToR2(key, buffer, ct, meta)` | `:103` | PDF leçon, ressources, certificats. |
| `getSignedUrlR2(key, ttl)` | `:133` | Distribution de ressources `telechargeable` + PDF cours. |
| `getSignedUploadUrlR2(key, ct, ttl)` | `:156` | **Upload direct navigateur** : médias lourds de l'outil auteur + **devoirs apprenant** (`ElearningLessonType.devoir`) sans transiter par le serveur Next. |
| `existsInR2(key)` | `:170` | Idempotence upload. |
| `getObjectBufferR2(key)` | `:208` | Lecture fail-soft (ex. génération ZIP preuves FOAD). |
| `deleteFromR2(key)` | `:183` | Purge légale fin de rétention. |

**Convention de clés LMS (nouvelle, alignée sur `invoicePdfKey` :193) :**

```
elearning/courses/<courseId>/cover/<hash>.webp
elearning/lessons/<lessonId>/resources/<resourceId>.<ext>
elearning/lessons/<lessonId>/captions/<lang>.vtt        # sous-titres WCAG
elearning/devoirs/<enrollmentId>/<lessonId>/<filename>  # upload apprenant
elearning/certificats/<year>/<numero>.pdf               # via DocumentGenere (§8)
```

**Garde-fou critique (ADR-LMS-0005) :** R2 **stocke** mais ne **streame pas** (pas de HLS adaptatif). La **vidéo NE passe PAS par R2** → `ElearningLesson.videoAssetId` pointe vers **Cloudflare Stream** (ou Bunny). R2 ne sert que pour les sous-titres `.vtt`, vignettes, et médias non-vidéo. Voir `04-BACKEND/07-pipeline-video-streaming.md`.

**Prérequis plateforme :** le bucket doit autoriser le CORS PUT depuis l'origine admin **et** apprenant (pour l'upload de devoirs) — cf. note `r2-storage.ts:149-152`.

---

## 6. Stripe — e-commerce 🔴 Ne pas toucher (MVP) / 🟡 brancher en V1

**Source.** `src/lib/stripe.ts:57-88` + modèles `Invoice`/`Payment`/`Refund`/`StripeWebhookEvent` + webhook route handler.

**État réel :** Stripe est **neutralisé** : `isStripeConfigured()` = `STRIPE_ENABLED === "true" && STRIPE_SECRET_KEY` (`stripe.ts:72-74`). Aujourd'hui `false` (bascule SAS française, paiement virement/manuel). Tout le code dort mais reste en place.

**MVP (ADR-LMS-0004) — 🔴 ne touche pas à Stripe :**

- Octroi d'accès **manuel** (admin ouvre l'accès en 1 clic) + **import CSV** entreprise (§ import masse).
- Encaissement par virement, hors plateforme.
- On crée seulement 🆕 `ElearningOrder` (doc `05-schema-ecommerce-commandes.md`) : modèle de commande e-learning qui **sait octroyer l'accès** (état `payee → accès ouvert`), sans dépendre de Stripe au MVP (état basculé manuellement par l'admin).

**V1 — 🟡 brancher proprement :**

- Activer `STRIPE_ENABLED=true` + clés → tunnel d'achat CB.
- `ElearningOrder` réutilise `getStripe()` (`:57`), `STRIPE_API_VERSION` figée (`:30`), le webhook existant (`getWebhookSecret()` `:80`) et la table `StripeWebhookEvent` pour l'idempotence. **Aucune refonte** : on ajoute un `metadata.elearningOrderId` au Checkout et un handler dans le switch webhook existant.

**Garde-fou :** ne **jamais** appeler `getStripe()` sans `isStripeConfigured()` (il throw si la clé manque — `:38`). Tout chemin de paiement LMS doit dégrader vers « octroi manuel » si le flag est off.

---

## 7. Formation Engine IA — pipeline génération pédagogique 🟢 Réutiliser les sous-couches

**Source.** `src/server/queue/workers/qualiopi-formation-engine-worker.ts:1-65` + ses dépendances :

- Provider IA : `@/server/content-gen/providers/anthropic` (`anthropicProvider`).
- Robustesse : `withRetry` (`@/server/content-gen/lib/retry`), `assertCostCapAvailable` + `trackCost` (`.../cost-tracker`).
- Cache IA : `buildCacheKey`/`getCachedIa`/`setCachedIa` (`@/server/qualiopi/engine/cache`).
- Qualité : `getActiveGrille`, `evaluateFormationQuality`, `hasUnsourcedClaims`, `runAdversarialCritique`, `validateExcellence`.

**Ce qu'on réutilise (les briques transverses, pas la machine d'états) :**

- `anthropicProvider` + `withRetry` + cost-tracker + cache → **socle des features IA LMS** :
  - 🆕 **quiz-gen** (générer questions depuis le contenu d'une leçon) ;
  - 🆕 **authoring assist** (suggérer plan de cours / objectifs / reformulations) ;
  - 🆕 **tuteur RAG** (assistance pédagogique Ind.19, ancrée avec citations).
- Le **RAG knowledge existant** (chatbot-ingest / `chat_kb_chunks`, RAG content-gen) est réutilisé pour ancrer le tuteur — **pas** de nouvel index inventé. Détail → `04-BACKEND/09-tuteur-rag-assistant.md`.

**Ce qu'on NE réutilise PAS :** la machine d'états `formation.statutGeneration` (`intention → structure_generee → contenu_evalue → ...`) et la queue `formation-engine` (`queues.ts:494`). Elle est spécifique à la génération d'une **Formation Qualiopi** (structure pédagogique présentielle). Le LMS a son propre pipeline IA, plus léger, sur 🆕 queues `elearning-quizgen` / `elearning-tutor` (§12).

**Garde-fou coûts :** toute feature IA LMS doit appeler `assertCostCapAvailable` **avant** et `trackCost` **après** (même discipline que le worker Qualiopi, `:32`), pour rester sous le kill-switch global de coût.

---

## 8. `DocumentGenere` (+ QR public) — certificats 🟢 Réutiliser tel quel

**Source.** `prisma/schema.prisma:5507-5549` (table `documents_generes`).

**Pourquoi c'est parfait pour le certificat e-learning :**

- `type DocumentType` (enum) : on **ajoute une valeur** (additif) `certificat_realisation_elearning` (ou réutilise `certificat_realisation` si le modèle officiel est identique — à trancher en `08-CONFORMITE/06`).
- `numero` séquentiel unique, `hashSha256`, `pdfUrl` (URL signée R2 régénérée à la demande), `sizeBytes`, `estCopie` (filigrane COPIE).
- **QR de vérification publique** : `qrToken` (`@unique`, timingSafeEqual) + `qrTokenCreatedAt` → vérif publique d'authenticité du certificat, déjà branchée côté Qualiopi.
- **Rétention légale** : `suppressionPrevueAt` (createdAt + 5 ans) + `fichierOriginalPath` → conforme à la conservation des preuves FOAD (3-5 ans).
- Rattachements optionnels : `traineeId`, `formationId`, `sessionId`, `clientId`, `coachingSessionId` → on rattache le certificat e-learning au `traineeId` (+ `formationId` si cours adossé).

**Ce qu'on ajoute (additif) :** éventuellement une relation `elearningEnrollmentId?` sur `DocumentGenere` pour rattacher le certificat à l'inscription e-learning (sinon on stocke le lien dans `metadata Json`, déjà présent `:5538`). Le rendu PDF réutilise `@react-pdf/renderer` + le **modèle officiel de certificat de réalisation** (heures réalisées, en centièmes) déjà produit côté Qualiopi.

**Garde-fou conformité :** le certificat de réalisation suit le **modèle officiel** (heures réalisées) obligatoire depuis le 01/06/2020. Les **heures e-learning** = somme des durées des leçons complétées (cf. `dureeEstimeeMinutes` du data model socle) + traces LMS, pas une durée déclarative. Voir `08-CONFORMITE/06-tracabilite-preuves-realisation.md`.

---

## 9. Console admin — shell, navigation, RBAC 🟡 Étendre

### 9.1 Navigation — `src/lib/admin-nav.ts`

- C'est la **SSOT** de la sidebar admin (`AdminNavGroup`, `ADMIN_NAV_GROUP_LABELS`, lignes 25-95).
- **À ajouter (additif)** : un groupe `"elearning"` dans le type `AdminNavGroup` (`:25-37`) + son libellé dans `ADMIN_NAV_GROUP_LABELS` (`:82-95`) + les items de nav (cours, apprenants, accès/octroi, banque quiz, certificats, reporting).
- ⚠️ **Le composant monté est `AdminSidebarNav.tsx`** (pas `AdminSidebar.tsx`, obsolète — cf. mémoire « admin-nav-poles-clarity »). Vérifier que les items `elearning` y apparaissent réellement.

### 9.2 Shell — `AdminPageShell` / `AdminHeader` / `StatCard` / `AdminTable` / `AdminBadge`

- Toutes les pages admin LMS (`src/app/[locale]/(admin)/[adminPrefix]/elearning/**`) **doivent** utiliser `AdminPageShell` + composants `components/admin/ui` (cohérence visuelle, déjà ~172 pages). Zéro CSS admin custom.

### 9.3 RBAC — `src/server/actions/knowledge/_guards.ts:20-49`

4 guards prêts à l'emploi, réutilisés **tels quels** dans les server actions LMS :
| Guard | Ligne | Rôles autorisés | Usage LMS |
|---|---|---|---|
| `requireAdminRead()` | `:20` | tous (≥ reader) | lister cours/apprenants/reporting |
| `requireAdminWrite()` | `:27` | super_admin, admin, editor | créer/éditer cours, modules, leçons, quiz |
| `requireAdminPublish()` | `:35` | super_admin, admin | **publier** un cours, **octroyer** des accès en masse |
| `requireAdminDelete()` | `:43` | super_admin | archiver/supprimer |

- Ces guards lisent `auth()` (NextAuth `AdminUser`) — c'est l'**admin Axion-IA**, pas l'apprenant. L'auth **apprenant** est un système séparé (§4).
- **Réutiliser, ne pas redéfinir.** Si un besoin LMS spécifique apparaît (ex. rôle « auteur de cours »), l'ajouter dans ce fichier (extension), pas dans un nouveau module de guards.

---

## 10. Emails — Nodemailer + BullMQ + React Email 🟢 Réutiliser tel quel

**Source.**

- Queue `emails` : `src/server/queue/queues.ts:48-50`.
- Helper d'enqueue typé : `enqueueEmail(template, to, locale, payload, options)` — `queues.ts:605-629` (gère `delayMs`, `marketing`, `jobId`, no-op si BullMQ off).
- Worker : `src/server/queue/workers/email-worker.ts`.
- Templates React Email : `src/lib/email/templates/*.tsx` (~40 templates : booking, cadrage, contract, qualiopi-\*...).

**Décision : aucune nouvelle queue email, aucun service emailing tiers (Nodemailer maison).**
On ajoute :

- 🆕 templates React Email LMS sous `src/lib/email/templates/elearning-*.tsx` : `elearning-acces-octroye` (magic-link), `elearning-relance-decrochage` (Qualiopi Ind.12), `elearning-quiz-echoue`, `elearning-certificat-pret`, `elearning-tuteur-reponse`.
- 🆕 entrées dans `EmailJobName` (`src/server/queue/types.ts`) pour ces templates.
- 🆕 dispatch des nouveaux templates dans `email-worker.ts`.

**Garde-fou :** envoi uniquement via `enqueueEmail(...)`. Respect des consentements `Trainee.consentementEmail` pour tout email non-transactionnel (relances marketing). Les magic-links et notifications de service sont transactionnels.

---

## 11. `pricing.ts` — SSOT tarification 🟢 Réutiliser comme source unique

**Source.** `src/content/pricing.ts`.

- **Interdiction absolue** de hardcoder un prix dans le LMS (cours, pack entreprise, certificat). Tout montant vient de `pricing.ts`.
- Ajout d'entrées e-learning dans `pricing.ts` (catalogue self-paced, packs N sièges) — extension du SSOT, pas un nouveau fichier de prix.
- `ElearningOrder` (V1) et les devis e-learning lisent les montants depuis `pricing.ts` (comme `Devis`/`FactureFormation` aujourd'hui).

---

## 12. BullMQ — queues, connection, crons 🟡 Étendre

**Source.** `src/server/queue/queues.ts` (`defaultJobOptions:41-46`, `bootRepeatableJobs():639-1153`), `connection.ts` (`getBullConnection`, `isBullmqDisabled`).

**Pattern réutilisé tel quel :**

- Déclaration conditionnelle `connection ? new Queue(...) : null` (no-op si Redis absent / build stub).
- `defaultJobOptions` partagés (attempts/backoff/removeOn\*).
- Helpers d'enqueue typés avec garde `if (!queue) { warn; return; }` (modèle : `enqueueFormationGeneration:505`, `enqueueEmail:605`).

**Nouvelles queues LMS (cloisonnées, ADR-LMS-0007) — workers `src/server/queue/workers/elearning-*-worker.ts` :**
| Queue | Worker | Rôle | Type |
|---|---|---|---|
| `elearning-drip` | `elearning-drip-worker.ts` | déverrouillage par date/offset (drip 3 déclencheurs) | cron + event |
| `elearning-relance` | `elearning-relance-worker.ts` | relances anti-décrochage (Qualiopi Ind.12) | cron quotidien |
| `elearning-video-ingest` | `elearning-video-ingest-worker.ts` | poll statut transcodage Cloudflare Stream → maj `videoAssetId` | event |
| `elearning-quizgen` | `elearning-quizgen-worker.ts` | génération IA de questions (réutilise §7) | event |
| `elearning-tutor` | `elearning-tutor-worker.ts` | tuteur RAG asynchrone (réponses longues) | event |
| `elearning-certificat` | `elearning-certificat-worker.ts` | génération PDF certificat (réutilise §8 + @react-pdf) | event |

- Crons `elearning-drip` / `elearning-relance` ajoutés dans `bootRepeatableJobs()` (même structure `removeRepeatable` + `add({repeat})` que les crons existants, ex. `:899-910`).
- `startElearningXxxWorker()` appelés depuis `src/server/queue/worker.ts` au boot du process worker.

**Garde-fou :** respecter `BULLMQ_DISABLED=true` (build) → toutes les queues `null`, tous les enqueue no-op (sinon BullMQ tente une connexion Redis au SSG — cf. contrat ADR 0026).

---

## 13. Build stub `stub.invalid` 🔴 Ne pas toucher, mais s'y conformer

**Source.** `src/lib/prisma.ts` / `src/lib/redis.ts` (Proxy short-circuit si `*.invalid`) — ADR 0026.

**Impact sur le LMS :**

- Les pages apprenant et admin LMS sont **derrière auth** + doivent être `export const dynamic = "force-dynamic"` → **jamais rendues au build** → pas d'appel DB au SSG. Risque nul si on respecte ça.
- **Tout service LMS qui pourrait être importé au build** (ex. une vitrine catalogue publique `/elearning` en SSG/ISR) doit être **stub-aware**, exactement comme `portail-service.ts` :
  ```ts
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return /* fallback vide */;
  ```
- **Interdiction** de toucher à la magic string `"stub.invalid"`, à `SKIP_ENV_VALIDATION`, à `BULLMQ_DISABLED` (cf. AGENTS.md). Le LMS s'aligne, ne réécrit rien.

**Garde-fou catalogue public (V1) :** la vitrine SEO `/elearning` (JSON-LD `Course`) sera ISR `revalidate=3600` + early-exit stub (rendue vide au build, repeuplée en prod sous 1 h) — même doctrine que les sous-sitemaps knowledge.

---

## 14. `EvaluationAcquis` / `Questionnaire` — résultats Qualiopi 🟢 Garder séparé du moteur quiz

**Source.** `prisma/schema.prisma:5653` (`EvaluationAcquis`) et `:5704` (`Questionnaire`).

**Ce qu'ils sont :** des **stockages de résultats** rattachés à `Enrollment` (évaluation des acquis pré/post-formation présentielle ; questionnaires de satisfaction/positionnement avec `token`/`reponduAt`). Ils **ne contiennent aucun moteur de quiz interactif** (pas de types de questions, pas de tirage aléatoire, pas de gating par score, pas de tentatives).

**Décision : ne pas les détourner.** Le moteur quiz interactif est 🆕 (`03-DATA-MODEL/03-schema-quiz-evaluations.md`) :

- `ElearningQuiz`, `ElearningQuestion` (~12 types), `ElearningQuizAttempt`, banque de questions, tirage N parmi M, shuffle, seuil/pondération, feedback/rationale.
- Le gating par score (`ElearningUnlockType.score_quiz`, schema socle §2) s'appuie sur `ElearningQuizAttempt.scorePct`.

**Pont futur (hors MVP) :** un quiz e-learning bloquant peut, à terme, **alimenter** un `EvaluationAcquis` (preuve d'évaluation jalonnante Qualiopi Ind.11) via un service de mapping — réutilisation sans fusion. Documenté dans `08-CONFORMITE/02-qualiopi-indicateurs-foad.md`.

---

## 15. `FormateurMagicLink` — précédent de design 🟢 Référence

**Source.** `prisma/schema.prisma:6601`.

Magic-link maison pour l'espace formateur. Avec `PortailAcces` (§4), c'est le **2ᵉ précédent** confirmant la doctrine d'auth passwordless du repo. Sert de **modèle de référence** pour `ElearningAccess` (§4) ; rien à modifier.

---

## 16. `pii-crypto` — chiffrement PII 🟢 Réutiliser tel quel

**Source.** `src/lib/pii-crypto.ts` (`encryptPii` / `decryptPii`), déjà utilisé par `portail-service.ts:21,301`.

Tout champ apprenant sensible ajouté par le LMS (ex. notes de tuteur, justificatif handicap pour adaptation d'épreuve) passe par `encryptPii` au write / `decryptPii` au read serveur. Ne jamais stocker de PII sensible en clair (doctrine repo).

---

## Récapitulatif : ce qui est NEUF (🆕 à construire)

> Tout sous chemins cloisonnés (ADR-LMS-0007) : `src/server/elearning/**`,
> `src/app/[locale]/(admin)/[adminPrefix]/elearning/**`, `src/app/[locale]/portail/**` (ext.),
> `src/components/{elearning,admin/elearning}/**`, `src/server/queue/workers/elearning-*-worker.ts`.

- **Data model cœur LMS** : `ElearningCourse` / `ElearningModule` / `ElearningLesson` / `ElearningResource` (déjà spécifié, doc socle `03-DATA-MODEL/01`) + enums.
- **Progression** : `ElearningEnrollment`, `LessonProgress` (watch/reprise/completion) — doc `03-DATA-MODEL/02`.
- **Moteur quiz** : `ElearningQuiz` / `ElearningQuestion` / `ElearningQuizAttempt` + banque — doc `03-DATA-MODEL/03`.
- **Auth apprenant** : `ElearningAccess` + `learner-auth-service.ts` (clone §4) + middleware/cookie dédié.
- **Octroi & import masse** : `ElearningOrder` + service d'octroi (auto session→cours, manuel, CSV).
- **Pipeline vidéo** : intégration Cloudflare Stream (HLS, URL signée, watermark) — `videoAssetId`.
- **Outil auteur** : course-builder drag&drop (admin).
- **IA pédagogique** : quiz-gen + tuteur RAG (réutilise §7 + RAG knowledge).
- **Frontend apprenant** : dashboard, player, moteur quiz UI, déverrouillage, certificats, WCAG 2.2 AA.
- **Multi-tenant** : conçu (colonnes), livré V2.

---

## Liens

- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-LMS-0001 (auth) à 0008 (migrations additives).
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — cœur LMS (réutilise `Formation`/`Client`/R2).
- `03-DATA-MODEL/02-schema-progression-tracking.md` — `ElearningEnrollment` / `LessonProgress` (jumeau de `Enrollment`).
- `03-DATA-MODEL/03-schema-quiz-evaluations.md` — moteur quiz (distinct de `EvaluationAcquis`/`Questionnaire`).
- `03-DATA-MODEL/04-schema-comptes-acces-auth.md` — `ElearningAccess` (clone `PortailAcces`).
- `03-DATA-MODEL/05-schema-ecommerce-commandes.md` — `ElearningOrder` (branche Stripe en V1).
- `03-DATA-MODEL/06-strategie-migrations.md` — additivité (ADR-LMS-0008), ajouts à `Trainee`/`Client`/`DocumentGenere`.
- `02-ARCHITECTURE/multi-tenant-strategie.md` — pourquoi `Client` n'est pas un tenant (MVP) et l'arrivée V2.
- `04-BACKEND/05-authentification-apprenant.md` — cohabitation NextAuth (admin) vs auth apprenant.
- `04-BACKEND/07-pipeline-video-streaming.md` — R2 vs Cloudflare Stream.
- `04-BACKEND/08-ia-pedagogique-generation.md` + `09-tuteur-rag-assistant.md` — réutilisation Formation Engine / RAG.
- `06-CONSOLE-ADMIN/01-navigation-structure.md` — groupe nav `elearning` (ext. `admin-nav.ts`).
- `08-CONFORMITE/06-tracabilite-preuves-realisation.md` — certificat via `DocumentGenere`.
  </content>
  </invoke>
