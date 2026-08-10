# 99-VERIFICATION / 06 — Cohérence avec l'existant (audit anti-duplication)

> **Nature du document.** Audit **adversarial** de non-duplication. Objectif unique : garantir que **chaque brique réutilisable du code Axion-IA actuel est réutilisée et non réinventée** par le LMS. Le document oppose, brique par brique, ce qui **EXISTE** (chemins de fichiers, modèles, fonctions réels, lus dans le code) à ce qui serait une **DUPLICATION à éviter**, puis liste les **extensions additives** légitimes.
>
> **Méthode.** Lecture directe du code réel : `prisma/schema.prisma`, `src/lib/r2-storage.ts`, `src/server/qualiopi/portail/*`, `src/server/actions/qualiopi/portail.ts`, `src/server/actions/knowledge/_guards.ts`, `src/lib/admin-nav.ts`, `src/server/queue/queues.ts`, `src/server/queue/types.ts`, `src/env.ts`. Tout chemin/champ/fonction cité a été vérifié à la source.
>
> **Verdict global.** Le data model socle (`03-DATA-MODEL/01`) est **sain** sur la réutilisation (FK `formationId` → `Formation`, `ownerClientId` → `Client`, R2 pour les médias). Les zones à **haut risque de duplication** sont : (1) **l'auth apprenant** (ne pas cloner NextAuth ni un 3ᵉ système de tokens), (2) **les quiz** (ne pas dupliquer `EvaluationAcquis`/`Questionnaire`), (3) **les certificats** (ne pas créer un générateur PDF parallèle à `DocumentGenere`/QR), (4) **les emails** (ne pas créer un canal d'envoi hors BullMQ/`EmailJobName`), (5) **le stockage** (ne pas réinventer un wrapper S3 à côté de `r2-storage.ts`), (6) **la nav admin** (ne pas réimplémenter une liste de liens hors `admin-nav.ts`).

---

## 1. Tableau de synthèse — décision par brique

| Brique existante                            | Statut LMS                             | Réutiliser tel quel                                                | Étendre (additif)                                                | Duplication interdite                                        |
| ------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------ |
| `Trainee` (schema:5274)                     | **Réutiliser + étendre**               | identité, PII chiffrée, consentements, handicap                    | `+ passwordHash?` (ADR-0001), relations inverses LMS             | nouveau modèle « Learner »/« Apprenant »                     |
| `Enrollment` (schema:5310)                  | **Réutiliser** (lien session)          | inscription session présentiel/live                                | relation inverse vers `ElearningEnrollment` (optionnelle)        | ne pas faire porter la progression e-learning à `Enrollment` |
| `Client` (schema:4890)                      | **Réutiliser** (CRM/tenant futur)      | SIRET/OPCO/contact                                                 | `ElearningCourse.ownerClientId` + (V2) appartenance apprenant    | nouveau modèle « Company »/« Tenant » au MVP                 |
| `PortailAcces` + service + cookie           | **Réutiliser** (socle auth apprenant)  | token 64hex, `verifierToken`, cookie `portail_session`             | nouveau cookie de session distinct si besoin, password optionnel | nouveau système de tokens magic-link                         |
| `r2-storage.ts`                             | **Réutiliser** (tous médias non-vidéo) | `uploadToR2`/`getSignedUrlR2`/`getSignedUploadUrlR2`               | clés R2 namespacées `elearning/...`                              | nouveau client S3 / wrapper R2                               |
| Infra Stripe + `STRIPE_ENABLED`             | **Réutiliser éteinte** (ADR-0004)      | `Invoice`/`Payment`/webhook                                        | `ElearningOrder` qui réutilise le pipeline                       | brancher un 2ᵉ PSP / paiement maison                         |
| Formation Engine IA (worker)                | **Réutiliser le pattern**              | pipeline structure→contenu→validation, `CacheIa`, critique adverse | générateurs quiz/leçon calqués                                   | nouveau pipeline IA parallèle                                |
| `DocumentGenere` + `qrToken`                | **Réutiliser** (certificats)           | numérotation, hash, QR public, rétention, R2                       | `DocumentType` + valeur certificat e-learning                    | générateur de certificat PDF parallèle                       |
| Emails Nodemailer + BullMQ + `EmailJobName` | **Réutiliser**                         | `enqueueEmail`, `email-worker`, React Email                        | `+ EmailJobName` `elearning-*`, templates `elearning-*.tsx`      | canal d'envoi email hors queue                               |
| RBAC `requireAdmin*` + qualiopi `_guards`   | **Réutiliser**                         | read/write/publish/delete, `logQualiopiActivity`                   | guards apprenant **séparés** (cookie)                            | ré-écrire un système de rôles admin                          |
| `admin-nav.ts` (SSOT nav)                   | **Réutiliser**                         | `AdminNavGroup`/`AdminNavItem`                                     | `+ group: "elearning"` + items                                   | liste de liens admin hors SSOT                               |
| BullMQ `queues.ts` + `worker.ts` + crons    | **Réutiliser le pattern**              | `Queue` nullable, `enqueueXxx` no-op, `bootRepeatableJobs`         | queues `elearning-*` + crons drip/relances                       | scheduler maison                                             |
| `EvaluationAcquis` / `Questionnaire`        | **Réutiliser pour la conformité**      | stockage résultat éval acquis, satisfaction                        | pont quiz LMS → `EvaluationAcquis`                               | dupliquer en « QuizResult » pour la conformité               |
| `FormateurMagicLink`                        | **Référence de pattern**               | magic-link passwordless trainer                                    | —                                                                | copier-coller pour l'apprenant (utiliser `PortailAcces`)     |
| Import Zoom/Teams/Meet → `PresenceCreneau`  | **Réutiliser la preuve présence**      | preuves synchrone                                                  | traces LMS = preuve **FOAD** distincte                           | mélanger logs LMS et `PresenceCreneau`                       |

---

## 2. Auth apprenant — la zone n°1 à risque de duplication

### EXISTANT (vérifié)

- **Modèle** `PortailAcces` (`schema.prisma:6236`) : `token @unique @db.VarChar(64)`, `expiresAt`, `revoked`, `lastUsedAt`, FK `traineeId` → `Trainee`.
- **Service** `src/server/qualiopi/portail/portail-service.ts` :
  - `creerAcces(traineeId, joursValidite=90)` — `randomBytes(32).toString("hex")` (64 hex), stub-aware.
  - `verifierToken(token)` — `findUnique({where:{token}})` + `timingSafeEqual` + check `revoked`/`expiresAt`, met à jour `lastUsedAt` en fire-and-forget. Retourne `{ traineeId }`.
  - `revoquerAcces(id)`, `getEspaceStagiaire(traineeId)`.
- **Cookie** `src/server/qualiopi/portail/cookie.ts` : `COOKIE_NAME = "portail_session"`, HttpOnly/Secure/SameSite=Lax, `maxAge` 90 j, helpers `setPortailCookie`/`getPortailToken`/`clearPortailCookie`.
- **Actions** `src/server/actions/qualiopi/portail.ts` : `accederPortailAction` (pose le cookie), `quitterPortailAction`, etc. Auth portail = `getPortailToken()` + `verifierToken()`, **jamais** `requireAdminWrite`.
- **Pattern magic-link alternatif** `FormateurMagicLink` (`schema.prisma:6601`) : `tokenHash @unique`, `expiresAt`, `usedAt`, à usage unique (formateur). Email `formateur-magic-link` dans `EmailJobName`.
- **NextAuth v5** : gère **uniquement** `AdminUser` (email + mot de passe + 2FA). RBAC via `requireAdmin*` (`_guards.ts`).

### DUPLICATIONS INTERDITES

1. ❌ **Ne pas créer un nouveau modèle de tokens** (`LearnerSession`, `ElearningMagicLink`, `LearnerToken`…) qui re-fait ce que `PortailAcces` fait déjà. ADR-0001 dit « magic-link par défaut **via PortailAcces existant** ».
2. ❌ **Ne pas brancher l'apprenant sur NextAuth**. NextAuth = monde admin (ADR-0001). L'auth apprenant reste un système séparé cookie/middleware.
3. ❌ **Ne pas réimplémenter `timingSafeEqual`/`randomBytes`** : réutiliser `creerAcces`/`verifierToken`.
4. ❌ **Ne pas copier `FormateurMagicLink`** pour l'apprenant : il est trainer-only et à usage unique ; l'apprenant a déjà `PortailAcces` (90 j, multi-accès).

### NEUF / EXTENSION (additif autorisé)

- **`Trainee.passwordHash String?`** (ADR-0001) — nullable, argon2id, activé pour comptes entreprise. **Aucun nouveau modèle d'identité.**
- **Service d'auth apprenant LMS** `src/server/elearning/auth/*` qui **enveloppe** `portail-service.ts` :
  - chemin magic-link → délègue à `creerAcces`/`verifierToken` ;
  - chemin mot de passe → vérifie `Trainee.passwordHash` (argon2) puis pose un cookie.
- **Décision de cohérence à trancher (à documenter dans `04-BACKEND/05`)** : réutiliser le cookie `portail_session` **OU** créer un cookie LMS dédié (`elearning_session`). Recommandation auditeur : **réutiliser `portail_session`** pour qu'un stagiaire connecté au portail Qualiopi voie aussi ses cours sans re-login (un seul monde « apprenant »), et n'ajouter un cookie distinct que si la durée/scope diffère. Si cookie distinct → factoriser `cookie.ts` en un helper paramétrable plutôt que dupliquer le fichier.
- **Routes** : étendre `src/app/[locale]/portail/**` (pas un nouvel arbre `/learn` parallèle au MVP) — ADR-0007 prévoit l'extension du portail existant.

---

## 3. Apprenant / identité — `Trainee`, `Enrollment`, `Client`

### EXISTANT

- **`Trainee`** (`schema.prisma:5274`) : `nom`, `prenom`, `email @unique`, `telephone`, `entreprise`, `fonction`, `situationHandicap` + `handicapDetailsChiffre` (chiffré `pii-crypto`), 4 champs consentement, `deletedAt` (soft-delete RGPD). Relations : `enrollments`, `documents`, `portailAcces`, `appreciations`, `rgpdDemandes`, `coachingSessions`, `coachingContracts`. **PAS de `passwordHash`.**
- **`Enrollment`** (`schema.prisma:5310`) : couple `(sessionId, traineeId)` unique, `statut`, `tauxPresencePct`, attestation, financement par participant (inter-entreprises). Relations : `presences`, `evaluations`, `questionnaires`, `facturesFormation`.
- **`Client`** (`schema.prisma:4890`) : CRM B2B/B2C — `raisonSociale`, `siret`, `nafCode`, `opcoIdentifie`, contact, agrégats commerciaux. **N'est pas multi-tenant** (aucune donnée cloisonnée, pas d'admin entreprise) — confirmé ADR-0002.

### DUPLICATIONS INTERDITES

1. ❌ **Aucun modèle « Apprenant »/« Learner » distinct de `Trainee`.** Un particulier qui achète un e-learning = un `Trainee` (avec `enrollments` éventuellement vides côté session présentielle). Le socle data (`03-DATA-MODEL/01`) le confirme implicitement : `ElearningEnrollment` (doc 02) rattachera l'accès au `Trainee`.
2. ❌ **Ne pas réutiliser `Enrollment` pour porter la progression e-learning.** `Enrollment` est le lien `Trainee↔TrainingSession` (présentiel/live, présence, attestation Qualiopi). La progression FOAD est un **nouveau** modèle `ElearningEnrollment` (doc 02) lié au `ElearningCourse`. Le lien entre les deux est **optionnel** (un cours peut être autonome).
3. ❌ **Ne pas créer un modèle « Company »/« Tenant » au MVP.** L'appartenance entreprise passe par `Client` (ADR-0002). Au MVP : octroi/import en masse côté admin Axion-IA. La clé multi-tenant (V2) est posée comme `ElearningCourse.ownerClientId` (déjà dans doc 01) + future clé sur l'apprenant.

### NEUF / EXTENSION

- **Relations inverses additives** (zéro colonne) déjà prévues doc 01 : `Formation.elearningCourses`, `Client.coursesProprietaires`. Ajouter de même `Trainee.elearningEnrollments ElearningEnrollment[]` (doc 02).
- **Import de masse CSV** (MVP) : `upsert` de `Trainee` par `email` (unique) puis `creerAcces` + octroi `ElearningEnrollment`. Réutiliser le pattern worker (`kit-import-worker.ts` est le modèle d'import ZIP/CSV existant à imiter).

---

## 4. Quiz / évaluations — ne pas dupliquer la conformité

### EXISTANT

- **`EvaluationAcquis`** (`schema.prisma:5653`) : **stocke un résultat** d'évaluation des acquis (`scoreObtenu`/`scoreMax`/`scorePct`, `niveauGlobal`, `reussite`, `competences` JSON, `recommandations`), lié à `Enrollment` **ou** `CoachingSession`. **Aucun moteur de quiz interactif** (pas de questions, pas de tentatives, pas de correction auto).
- **`Questionnaire`** (`schema.prisma:5704`) : satisfaction/positionnement, `token @unique`, `reponses` JSON, `noteGlobale`. Rempli via portail. **Pas un moteur de quiz noté/bloquant.**

### DUPLICATIONS INTERDITES

1. ❌ **Ne pas étendre `Questionnaire` pour en faire le moteur de quiz.** Il sert la satisfaction Qualiopi (Ind.31) ; le greffer casserait la sémantique. Le moteur de quiz est **neuf** : `Quiz`/`Question`/`QuizAttempt` (doc 03).
2. ❌ **Ne pas créer un 2ᵉ modèle de « résultat d'évaluation des acquis »** parallèle à `EvaluationAcquis` pour la conformité. Quand un quiz LMS conclut/jalonne un parcours FOAD (Ind.11), il doit **alimenter `EvaluationAcquis`** (un pont, pas une copie) pour que tout le reporting Qualiopi existant (grilles, attestations, BPF) continue de fonctionner sur une source unique.

### NEUF / EXTENSION

- **Moteur de quiz** `Quiz`/`Question`/`QuizAttempt` (doc 03) + service `src/server/elearning/quiz/*` : ~12 types, banque, tirage N parmi M, shuffle, tentatives/seuil/pondération, correction auto + manuelle (essai), temps serveur.
- **Pont conformité** : à la réussite d'un quiz « jalon/conclusion » d'un cours FOAD, créer/mettre à jour un `EvaluationAcquis` (type `evaluation_acquis`/équivalent) rattaché à l'`Enrollment` si le cours est adossé à une session, sinon documenter le rattachement FOAD autonome. **À spécifier dans `08-CONFORMITE/06-tracabilite-preuves-realisation.md`.**

---

## 5. Certificats — réutiliser `DocumentGenere` + QR

### EXISTANT

- **`DocumentGenere`** (`schema.prisma:5507`) : `type DocumentType`, `numero @unique`, FK `formationId`/`sessionId`/`traineeId`/`clientId`/`coachingSessionId`, `pdfUrl` (URL R2 signée régénérée), `hashSha256`, `qrToken @unique` (vérif publique `timingSafeEqual`), `suppressionPrevueAt` (rétention), `fichierOriginalPath` (archivage original). Index par `type,sessionId` et `traineeId,type`.
- Génération PDF via `@react-pdf/renderer` + archivage R2 + QR public — pipeline complet déjà en prod (attestations/certificats Qualiopi).

### DUPLICATIONS INTERDITES

1. ❌ **Ne pas créer un générateur de certificat e-learning parallèle** (nouvelle table « ElearningCertificate », nouveau wrapper PDF, nouveau token QR). Le **certificat de réalisation FOAD** (modèle officiel, heures réalisées, obligatoire depuis 01/06/2020) **doit** être un `DocumentGenere` pour hériter de : numérotation, hash d'intégrité, QR public, rétention, archivage R2, et apparition dans `getEspaceStagiaire`.
2. ❌ **Ne pas réinventer le QR / la vérification publique.** Réutiliser `qrToken` + la route de vérification publique existante.

### NEUF / EXTENSION

- **Ajouter une valeur à l'enum `DocumentType`** (additif) pour le certificat de réalisation e-learning si une valeur dédiée est nécessaire (à vérifier : une valeur attestation/certificat existante peut suffire). Migration additive (nouvelle valeur d'enum = pas de DROP).
- **Service de génération** `src/server/elearning/certificats/*` qui **appelle** le builder PDF + `uploadToR2` + crée le `DocumentGenere` (heures réalisées issues de la progression LMS), exactement comme le fait le pipeline Qualiopi des attestations.

---

## 6. Stockage médias — `r2-storage.ts` (et la frontière vidéo)

### EXISTANT

- `src/lib/r2-storage.ts` : `isR2Configured()`, `uploadToR2(key,buffer,contentType,metadata)`, `getSignedUrlR2(key, ttl=90j)`, **`getSignedUploadUrlR2(key,contentType,ttl=15min)`** (upload direct navigateur → R2, idéal pour gros fichiers sans transiter par Next), `existsInR2`, `deleteFromR2`, `getObjectBufferR2` (fail-soft). Singleton `S3Client`. **Pas de streaming HLS.**
- Le socle doc 01 le câble correctement : `ElearningResource.r2Key` (PDF/images/sous-titres) via R2 ; **vidéo via `videoAssetId`** (Cloudflare Stream/Bunny), **pas** via R2 (ADR-0005).

### DUPLICATIONS INTERDITES

1. ❌ **Ne pas instancier un nouveau `S3Client`** ni un wrapper R2 bis. Tout passe par `r2-storage.ts`.
2. ❌ **Ne pas streamer la vidéo depuis R2.** ADR-0005 : Cloudflare Stream (HLS + URLs signées + watermark), pas d'auto-hébergement (egress).
3. ❌ **Ne pas faire transiter les gros médias (vidéos source, .pptx) par le serveur Next** : utiliser `getSignedUploadUrlR2` (upload direct navigateur), comme l'outil auteur Qualiopi/kits existant.

### NEUF / EXTENSION

- **Namespacing des clés R2** : `elearning/courses/<courseId>/lessons/<lessonId>/<resource>.<ext>` (cohérent avec les conventions `invoices/<year>/...`, `documents/<year>/...`, `interventions/...` déjà en place). Documenter la convention dans `04-BACKEND/07`.
- **Nouveau** : `src/server/elearning/video/*` — client Cloudflare Stream (upload TUS, URLs signées, watermark, sous-titres VTT). C'est la **seule** couche médias réellement neuve.

---

## 7. E-commerce — Stripe éteint, réutiliser `Invoice`/`Payment`

### EXISTANT

- `src/env.ts` : `STRIPE_ENABLED` (transform `"true"|"1"`), `STRIPE_WEBHOOK_SECRET`, `STRIPE_LIVE_MODE`, `STRIPE_API_VERSION`. Actuellement **off** (paiement virement/manuel).
- Modèles `Invoice`/`Payment`/`Refund`/`StripeWebhookEvent` + `src/lib/stripe.ts` + webhook complets (booking). `FactureFormation` (`schema.prisma:5760`) = facture OF exonérée TVA, distincte de `Invoice`.

### DUPLICATIONS INTERDITES

1. ❌ **Ne pas brancher un 2ᵉ PSP ni un paiement maison.** ADR-0004 : infra Stripe gardée, MVP = virement + octroi manuel.
2. ❌ **Ne pas dupliquer la facturation.** Une vente e-learning B2B finançable doit pouvoir réutiliser `FactureFormation` (TVA exonérée OF) ; une vente directe B2C réutilise `Invoice`. Choisir selon le cas, pas créer un 3ᵉ système.

### NEUF / EXTENSION

- **`ElearningOrder`** (doc 05) : modèle de commande qui **sait octroyer l'accès** (`ElearningEnrollment`) à la confirmation. Au MVP : statut « payé » posé manuellement par l'admin (virement). Quand `STRIPE_ENABLED=true` : brancher le tunnel Checkout existant — **pas de refonte**.
- Réutiliser `enqueueEmail` pour les emails de commande (cf. §8).

---

## 8. Emails / notifications — BullMQ + `EmailJobName`

### EXISTANT

- `src/server/queue/types.ts` : union **`EmailJobName`** (~50 templates, dont `qualiopi-convocation`, `qualiopi-attestation-disponible`, `gdpr-export-link`, `formateur-magic-link`).
- `src/server/queue/queues.ts` : `emailsQueue` + **`enqueueEmail(template, to, locale, payload, options)`** (no-op propre si BullMQ off / build stub).
- `email-worker.ts` (consume `emails`) + templates **React Email** `src/lib/email/templates/qualiopi-*.tsx`. Crons lifecycle Qualiopi pilotés par `formation-crons` (`bootRepeatableJobs`).

### DUPLICATIONS INTERDITES

1. ❌ **Aucun envoi d'email hors `enqueueEmail`/`emailsQueue`.** Pas de `nodemailer.sendMail` direct dans le LMS.
2. ❌ **Pas de service emailing tiers** (contrainte plateforme : Nodemailer maison).
3. ❌ **Ne pas dupliquer le layout email** : réutiliser le base-layout React Email existant (bouton bulletproof, footer identité).

### NEUF / EXTENSION

- **Étendre `EmailJobName`** (additif) : `elearning-acces-octroye`, `elearning-magic-link`, `elearning-module-debloque`, `elearning-relance-inactivite` (Ind.12 anti-décrochage), `elearning-certificat-disponible`, `elearning-commande-recue`.
- **Templates** `src/lib/email/templates/elearning-*.tsx`.
- **Crons** drip/relances : ajouter une queue `elearning-crons` (ou réutiliser le pattern `formation-crons`) dans `bootRepeatableJobs` — cf. §10.

---

## 9. RBAC & navigation admin

### EXISTANT

- **Guards** `src/server/actions/knowledge/_guards.ts` : `requireAdminRead/Write/Publish/Delete` (rôles `super_admin`/`admin`/`editor`/`reader`). Variante Qualiopi `src/server/actions/qualiopi/_guards.ts` (+ `logQualiopiActivity` audit).
- **Nav** `src/lib/admin-nav.ts` : SSOT, types `AdminNavGroup` (union fermée : `main|content|content_gen|qualiopi|documents-interventions|coaching-1to1|image-bank|presse|chatbot|engagement|ops|system`), `AdminNavItem` (`href`/`label`/`icon`/`group`/`subGroup?`/`tier?`/`parent?`), `ADMIN_NAV_GROUP_LABELS`. Consommé par la sidebar **et** la command palette (anti-drift). ⚠️ Mémoire projet : le composant monté est **`AdminSidebarNav.tsx`** (pas `AdminSidebar.tsx`).
- **Shell** `AdminPageShell`/`AdminHeader`/`StatCard`/`AdminTable`/`AdminBadge`.

### DUPLICATIONS INTERDITES

1. ❌ **Ne pas réimplémenter une liste de liens admin** hors `admin-nav.ts` (drift garanti, cf. commentaire d'en-tête du fichier).
2. ❌ **Ne pas créer un nouveau système de rôles** : réutiliser `requireAdmin*`. Côté apprenant, les guards sont **séparés** (cookie portail), pas un dérivé de NextAuth.
3. ❌ **Ne pas re-styler des écrans admin from scratch** : réutiliser `AdminPageShell`/`AdminTable`/`AdminBadge`.

### NEUF / EXTENSION

- **Ajouter `"elearning"` à `AdminNavGroup`** + `ADMIN_NAV_GROUP_LABELS["elearning"]` + les items (outil auteur, apprenants, accès, banque de quiz, certificats, reporting). Migration purement TS additive.
- **Guards apprenant** `src/server/elearning/auth/_guards.ts` (cookie `portail_session` + `verifierToken`) — **wrappent** l'existant, ne le remplacent pas.
- **Actions LMS** sous `src/server/elearning/**` en Server Actions (pas REST), avec `logQualiopiActivity`/audit équivalent pour les mutations admin.

---

## 10. Files d'attente, workers & crons — BullMQ

### EXISTANT

- `src/server/queue/queues.ts` : chaque queue = `connection ? new Queue(...) : null`, `defaultJobOptions` (attempts/backoff/removeOn\*), helpers `enqueueXxx` **no-op** si `!queue` (build stub). `bootRepeatableJobs()` enregistre tous les crons (idempotent via `removeRepeatable`).
- Workers sous `src/server/queue/workers/*-worker.ts`, démarrés par `src/server/queue/worker.ts`. Patterns prêts : `kit-import-worker` (import), `image-bank-*-worker` (pipeline media), `qualiopi-formation-engine-worker` (IA), `formation-crons-worker` (lifecycle).

### DUPLICATIONS INTERDITES

1. ❌ **Pas de scheduler maison** (`setInterval`, cron node externe). Tout passe par BullMQ repeatable jobs + `bootRepeatableJobs`.
2. ❌ **Pas de queue sans le garde `connection ? ... : null`** (casse le build stub `stub.invalid` + `BULLMQ_DISABLED`).
3. ❌ **Pas d'enqueue sans variante no-op** (sinon crash au SSG build).

### NEUF / EXTENSION

- **Queues `elearning-*`** : `elearning-video-process` (poll statut Cloudflare Stream), `elearning-crons` (drip date_fixe/offset, relances inactivité Ind.12, expiration d'accès), `elearning-quiz-grade` (correction asynchrone si lourde), `elearning-certificat` (génération PDF + R2). Toutes sur le pattern nullable + `enqueueXxx` no-op.
- **Crons** ajoutés dans `bootRepeatableJobs` (idempotents) : déverrouillage par date, relance inactivité, purge logs techniques (CNIL 6 mois–1 an), expiration d'accès.

---

## 11. Pipeline IA pédagogique — réutiliser le Formation Engine

### EXISTANT

- `qualiopi-formation-engine-worker.ts` : pipeline `statutGeneration` (intention → structure → `evaluateQuality` → refine → contenu → `FileValidation` → assemblage), `GrilleQualiteConfig`, `CacheIa`, `FormationGenerationJob`, `runAdversarialCritique`. Provider `@anthropic-ai/sdk` + cost-tracker partagés avec content-gen. Queue `formation-engine` + `enqueueFormationGeneration`.
- RAG / knowledge existant (chatbot-ingest, embeddings) réutilisable pour le **tuteur RAG ancré** (Ind.19).

### DUPLICATIONS INTERDITES

1. ❌ **Ne pas créer un 2ᵉ pipeline IA** ni un 2ᵉ provider Anthropic/cost-tracker. Le quiz-gen et la génération de leçons doivent **calquer** le Formation Engine (mêmes briques : cache, critique adverse, validation humaine bloquante AI Act art. 50).
2. ❌ **Ne pas réinventer le RAG** pour le tuteur : réutiliser l'index knowledge/RAG existant (citations ancrées), comme imposé par le contexte mission.

### NEUF / EXTENSION

- `src/server/elearning/ia/*` : quiz-gen (depuis le contenu de leçon), authoring document-grounded, tuteur RAG. Réutilisent provider/cost-tracker/cache existants.

---

## 12. Preuves FOAD vs présence synchrone — frontière à ne pas mélanger

### EXISTANT

- `PresenceCreneau` (`schema.prisma:5587`) + `ReleveConnexionImport` + import Zoom/Teams/Meet : **preuve de présence synchrone** (présentiel/distanciel synchrone), source de `Enrollment.tauxPresencePct`.

### DUPLICATION / CONFUSION INTERDITE

1. ❌ **Ne pas alimenter `PresenceCreneau` avec des logs LMS asynchrones.** La preuve FOAD (R.6313-3 : faisceau de preuves — évaluations + travaux + logs LMS + traces d'accompagnement) est **distincte** de l'émargement/relevé de connexion synchrone. Les mélanger fausserait le taux de présence et la conformité Ind.12.

### NEUF / EXTENSION

- Modèles de tracking FOAD **neufs** (doc 02, grammaire xAPI verbe/objet) : `LessonProgress`, heartbeat/watch, complétion. Ils constituent la preuve FOAD, **à côté** de `PresenceCreneau`, pas dedans. Le certificat de réalisation FOAD agrège les **heures réalisées** depuis ces traces, pas depuis `tauxPresencePct`.

---

## 13. Synthèse des duplications à éviter (checklist de revue de PR)

Tout reviewer doit **refuser** une PR LMS qui :

1. introduit un modèle d'identité apprenant distinct de `Trainee` ;
2. crée un système de tokens/magic-link à côté de `PortailAcces`/`portail-service.ts` ;
3. branche l'apprenant sur NextAuth, ou recrée un système de rôles admin hors `requireAdmin*` ;
4. instancie un `S3Client`/wrapper R2 hors `src/lib/r2-storage.ts`, ou streame la vidéo depuis R2 ;
5. génère des certificats PDF hors `DocumentGenere` (+ son `qrToken`, hash, rétention) ;
6. crée un moteur de quiz qui duplique `EvaluationAcquis`/`Questionnaire` au lieu de les **alimenter** pour la conformité ;
7. envoie un email hors `enqueueEmail`/`EmailJobName`/`email-worker`, ou ajoute un service emailing tiers ;
8. ajoute des liens admin hors `admin-nav.ts`, ou re-style les écrans hors `AdminPageShell`/`AdminTable` ;
9. crée une queue sans le garde `connection ? … : null` / un enqueue sans variante no-op (casse le build `stub.invalid`) ;
10. crée un 2ᵉ pipeline IA / provider Anthropic / RAG au lieu de réutiliser le Formation Engine + knowledge RAG ;
11. branche un 2ᵉ PSP / paiement maison au lieu de réutiliser l'infra Stripe gated + `Invoice`/`FactureFormation` ;
12. écrit des logs LMS asynchrones dans `PresenceCreneau` (confusion preuve FOAD ↔ présence synchrone) ;
13. ajoute une migration non additive (DROP / colonne NOT NULL sur table existante) — viole ADR-0008.

---

## 14. Points de cohérence à trancher (remontés au lead)

| #   | Question ouverte                                                                                              | Recommandation auditeur                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Cookie de session apprenant : réutiliser `portail_session` ou créer `elearning_session` ?                     | Réutiliser `portail_session` (un seul monde apprenant) ; sinon factoriser `cookie.ts` paramétrable, **pas** dupliquer le fichier.     |
| Q2  | Le certificat de réalisation FOAD : nouvelle valeur d'enum `DocumentType` ou valeur existante ?               | Vérifier l'enum `DocumentType` actuel ; ajouter une valeur dédiée (additif) si aucune ne convient.                                    |
| Q3  | Pont quiz LMS → `EvaluationAcquis` : obligatoire pour tout cours FOAD ou seulement adossé à une `Formation` ? | Obligatoire dès qu'il y a jalon/conclusion (Ind.11) ; modéliser le rattachement FOAD autonome dans `08-CONFORMITE/06`.                |
| Q4  | Facturation e-learning : `Invoice` (B2C) vs `FactureFormation` (OPCO/OF) — règle de routage ?                 | Router par financeur/éligibilité ; **ne pas** créer un 3ᵉ système de facture.                                                         |
| Q5  | Multi-tenant V2 : clé d'appartenance apprenant (`Trainee.ownerClientId` ?) à poser dès le MVP ?               | Poser la colonne nullable dès le MVP (additif) pour éviter une migration lourde V2 ; le scoping reste inactif jusqu'en V2 (ADR-0002). |

---

## Liens

- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-0001 (auth), 0002 (multi-tenant), 0004 (Stripe), 0005 (vidéo), 0007 (cloisonnement), 0008 (migrations additives).
- `02-ARCHITECTURE/reutilisation-existant.md` — carte de réutilisation détaillée (ce document en est l'audit adversarial).
- `02-ARCHITECTURE/multi-tenant-strategie.md` — `Client` ≠ tenant ; stratégie V2.
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — `ElearningCourse/Module/Lesson/Resource` (FK `Formation`/`Client`, R2).
- `03-DATA-MODEL/02-schema-progression-tracking.md` — `ElearningEnrollment`/`LessonProgress` (preuve FOAD, distincte de `PresenceCreneau`).
- `03-DATA-MODEL/03-schema-quiz-evaluations.md` — `Quiz`/`Question`/`QuizAttempt` + pont `EvaluationAcquis`.
- `03-DATA-MODEL/04-schema-comptes-acces-auth.md` — `Trainee.passwordHash`, réutilisation `PortailAcces`.
- `03-DATA-MODEL/05-schema-ecommerce-commandes.md` — `ElearningOrder` + réutilisation Stripe/`Invoice`/`FactureFormation`.
- `04-BACKEND/05-authentification-apprenant.md` — wrapper de `portail-service.ts` (Q1).
- `04-BACKEND/06-import-masse-provisioning.md` — `upsert Trainee` + octroi (pattern `kit-import-worker`).
- `04-BACKEND/07-pipeline-video-streaming.md` — R2 (`getSignedUploadUrlR2`) + Cloudflare Stream.
- `04-BACKEND/10-emails-notifications.md` — extension `EmailJobName` + templates `elearning-*`.
- `06-CONSOLE-ADMIN/01-navigation-structure.md` — ajout `group: "elearning"` à `admin-nav.ts`.
- `08-CONFORMITE/06-tracabilite-preuves-realisation.md` — pont quiz → `EvaluationAcquis`, frontière FOAD/présence.
- `11-ROADMAP/01-phasage-mvp-v1-v2.md` — séquence MVP (data model → auth → octroi → player → quiz → certificat).
  </content>
  </invoke>
