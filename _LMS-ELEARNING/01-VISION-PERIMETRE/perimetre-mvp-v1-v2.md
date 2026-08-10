# Périmètre fonctionnel détaillé — MVP / V1 / V2

> Spécification **feature par feature** de la plateforme LMS e-learning Axion-IA, avec pour chaque capacité : son **statut** (EXISTANT réutilisé / ÉTENDU / NEUF), sa **phase cible** (MVP / V1 / V2) et son **ancrage code réel** (modèles Prisma, chemins de fichiers, routes, server actions, workers/queues).
>
> Cohérent avec `11-ROADMAP/01-phasage-mvp-v1-v2.md`, les 8 ADR (`00-INDEX/DECISIONS-ARBITRAGES.md`) et le data model cœur (`03-DATA-MODEL/01-schema-cours-modules-lecons.md`).
>
> Dernière mise à jour : 2026-06-27.

---

## 0. Conventions de lecture

**Légende statut :**

| Code            | Sens                                                                                                           |
| --------------- | -------------------------------------------------------------------------------------------------------------- |
| 🟢 **EXISTANT** | Brique déjà présente en prod, réutilisée **telle quelle** (zéro nouveau code de fond).                         |
| 🟡 **ÉTENDU**   | Brique existante à laquelle on **ajoute** des champs/relations/comportements (migrations additives, ADR-0008). |
| 🔴 **NEUF**     | À construire entièrement, sous les chemins cloisonnés (ADR-0007).                                              |

**Légende phase :** **MVP** (un cours finançable OPCO/entreprise/vente directe) · **V1** (industrialisation) · **V2** (échelle, multi-tenant, CPF/EDOF).

**Rappels figés (ADR) :** auth apprenant hybride séparée de NextAuth (ADR-0001) · multi-tenant conçu maintenant / livré V2 (ADR-0002) · CPF/RNCP certification-ready, EDOF derrière flag (ADR-0003) · Stripe gardé éteint `STRIPE_ENABLED=false` (ADR-0004) · vidéo Cloudflare Stream + URLs signées (ADR-0005) · pas de SCORM/xAPI au lancement, tracking modélisé xAPI (ADR-0006) · code cloisonné `src/server/elearning/**` (ADR-0007) · migrations strictement additives (ADR-0008).

**Cloisonnement code (ADR-0007) — chemins cibles :**

- Domaine : `src/server/elearning/**`
- Admin (outil auteur, gestion) : `src/app/[locale]/(admin)/[adminPrefix]/elearning/**`
- Apprenant (extension portail) : `src/app/[locale]/portail/**` (existant : `acces`, `acces-invalide`, `mon-espace`) + nouvelles routes `src/app/[locale]/(apprenant)/apprendre/**`
- Composants : `src/components/elearning/**` (apprenant), `src/components/admin/elearning/**` (auteur)
- Workers : `src/server/queue/workers/elearning-*-worker.ts` + enregistrement dans `src/server/queue/queues.ts`

---

## 1. Domaine « Cœur LMS » (cours / modules / leçons)

| Feature                                                                                           | Statut                     | Phase                                  | Ancrage code                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------- | -------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modèle de contenu `ElearningCourse` → `ElearningModule` → `ElearningLesson` → `ElearningResource` | 🔴 NEUF                    | MVP                                    | `prisma/schema.prisma` (cf. `03-DATA-MODEL/01`). Enums `ElearningCourseStatut`, `ElearningLessonType`, `ElearningUnlockType`. Service `src/server/elearning/courses/course-service.ts` |
| Lien optionnel cours ↔ `Formation` Qualiopi existante (`ElearningCourse.formationId`)             | 🟡 ÉTENDU                  | MVP                                    | Champ inverse additif `Formation.elearningCourses` (sans colonne, FK portée par `ElearningCourse`)                                                                                     |
| Cours autonome (vendable seul) vs adossé à une formation présentielle                             | 🔴 NEUF                    | MVP                                    | `ElearningCourse.vendableSeul`, `ElearningCourse.estFoad`, `ElearningCourse.seuilReussitePct`                                                                                          |
| Types de leçon : `video`, `texte`, `pdf`, `quiz`, `embed`, `devoir`                               | 🔴 NEUF                    | MVP                                    | enum `ElearningLessonType`. `devoir` = preuve FOAD (upload apprenant)                                                                                                                  |
| Microlearning (durées par leçon, agrégat cours)                                                   | 🔴 NEUF                    | MVP                                    | `ElearningLesson.dureeEstimeeMinutes`, `ElearningCourse.dureeEstimeeMinutes` (cache) — sert l'« information de durée » D.6313-3-1 §2                                                   |
| Médias rattachés (PDF, images, audio, sous-titres) sur R2                                         | 🟡 ÉTENDU                  | MVP                                    | `ElearningResource.r2Key` via `src/lib/r2-storage.ts` (`uploadToR2`, `getSignedUrlR2`, `getSignedUploadUrlR2`)                                                                         |
| Versionnage + publication (`brouillon`→`publie`→`archive`, `version`, `publishedAt`)              | 🔴 NEUF                    | MVP                                    | `ElearningCourse.statut/version/publishedAt`. Workflow dans `06-CONSOLE-ADMIN/03`                                                                                                      |
| Ordonnancement stable + réécriture transactionnelle au drag&drop                                  | 🔴 NEUF                    | MVP (ré-ordre simple) / V1 (drag&drop) | `@@unique([courseId, ordre])`, `@@unique([moduleId, ordre])`                                                                                                                           |
| Réservation d'un cours à un `Client` (multi-tenant data-ready)                                    | 🔴 NEUF (champ) / livré V2 | MVP (schéma) → V2 (usage)              | `ElearningCourse.ownerClientId`, relation `Client."ClientCoursesProprietaires"` (ADR-0002)                                                                                             |
| Catalogue multi-cours (plusieurs cours gérés)                                                     | 🔴 NEUF                    | V1                                     | Liste admin + filtres statut                                                                                                                                                           |

---

## 2. Progression & tracking

| Feature                                                                          | Statut  | Phase                     | Ancrage code                                                                                                                              |
| -------------------------------------------------------------------------------- | ------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Inscription apprenant ↔ cours (`ElearningEnrollment`)                            | 🔴 NEUF | MVP                       | `03-DATA-MODEL/02`. Distinct du `Enrollment` (participant↔session présentiel) existant                                                    |
| Progression par leçon (`LessonProgress` : statut, %, position vidéo, complétion) | 🔴 NEUF | MVP                       | `LessonProgress.lessonId/enrollmentId`, `watchedSeconds`, `completedAt`. Reprise auto persistée serveur                                   |
| Reprise automatique (« reprendre où je me suis arrêté »)                         | 🔴 NEUF | MVP                       | Server action `resumeCourse()` lisant le dernier `LessonProgress`                                                                         |
| Heartbeat de lecture (temps réel passé, anti-fraude léger)                       | 🔴 NEUF | MVP                       | Route handler `POST /api/elearning/heartbeat` (force-dynamic, auth apprenant) → upsert `LessonProgress.watchedSeconds`, temps **serveur** |
| Barre de progression cours/module                                                | 🔴 NEUF | MVP                       | Composant `src/components/elearning/ProgressBar.tsx`, agrégation server-side                                                              |
| Complétion de cours + déclenchement certificat                                   | 🔴 NEUF | MVP                       | Worker `elearning-completion-worker.ts` → génère certificat (cf. §9)                                                                      |
| Journal d'événements façon xAPI (verbe/objet) — future-proof                     | 🔴 NEUF | MVP (modèle)              | `ElearningActivityLog` (`verbe`, `objetType`, `objetId`, `payloadJson`) — ADR-0006, base preuves FOAD                                     |
| Détection de décrochage / inactivité                                             | 🔴 NEUF | V1                        | Worker `elearning-relance-worker.ts` (Qualiopi Ind.12)                                                                                    |
| Émetteur xAPI / LRS + import SCORM/cmi5                                          | 🔴 NEUF | V2 (si besoin commercial) | ADR-0006 — non requis pour lancer                                                                                                         |
| Parcours adaptatifs (recommandations, ré-ordonnancement IA)                      | 🔴 NEUF | V2                        | —                                                                                                                                         |

---

## 3. Moteur de quiz & évaluations interactives

| Feature                                                                                         | Statut  | Phase | Ancrage code                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------- | ------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modèle quiz interactif `Quiz` / `Question` / `QuizOption` / `QuizAttempt` / `QuizAnswer`        | 🔴 NEUF | MVP   | `03-DATA-MODEL/03`. ⚠️ `EvaluationAcquis` + `Questionnaire` **existants stockent des résultats mais n'ont AUCUN moteur interactif** → on construit le moteur, on **n'écrase pas** ces tables (résultats agrégés y restent miroir pour la conformité) |
| Types essentiels : QCM mono, QCM multi, vrai/faux, réponse courte (correction auto)             | 🔴 NEUF | MVP   | enum `ElearningQuestionType`, correction `src/server/elearning/quiz/grading.ts`                                                                                                                                                                      |
| Types avancés : appariement, texte à trous, ordonnancement, essai (correction manuelle), upload | 🔴 NEUF | V1    | enum étendu ; essai/upload → revue admin                                                                                                                                                                                                             |
| Seuil de réussite + pondération par question + tentatives max                                   | 🔴 NEUF | MVP   | `Quiz.seuilReussitePct`, `Question.points`, `Quiz.tentativesMax`                                                                                                                                                                                     |
| Correction serveur + score réel (jamais en client)                                              | 🔴 NEUF | MVP   | Server action `submitQuizAttempt()` ; temps serveur ; aucun barème exposé client                                                                                                                                                                     |
| Feedback configurable + rationale par option                                                    | 🔴 NEUF | MVP   | `QuizOption.feedback`, `Question.rationale`, `Quiz.feedbackMode`                                                                                                                                                                                     |
| Anti-triche léger : shuffle questions **et** réponses                                           | 🔴 NEUF | MVP   | `Quiz.shuffleQuestions`, `Quiz.shuffleOptions`                                                                                                                                                                                                       |
| Banque de questions réutilisable                                                                | 🔴 NEUF | V1    | `QuestionBank` + rattachement `Question.bankId`                                                                                                                                                                                                      |
| Tirage aléatoire N parmi M                                                                      | 🔴 NEUF | V1    | `Quiz.tirageN`, pool via banque                                                                                                                                                                                                                      |
| Proctoring high-stakes (optionnel, CNIL-proportionné)                                           | 🔴 NEUF | V2    | Activé seulement RNCP/RS ; alternative non-proctorée garantie (ADR-0003)                                                                                                                                                                             |

---

## 4. Déverrouillage (drip + gating par score)

| Feature                                                           | Statut  | Phase | Ancrage code                                                                                                                           |
| ----------------------------------------------------------------- | ------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Déverrouillage `immediat` / `apres_precedent`                     | 🔴 NEUF | MVP   | enum `ElearningUnlockType` sur `ElearningModule` **et** `ElearningLesson`                                                              |
| Drip par date fixe / offset J+N depuis l'octroi                   | 🔴 NEUF | MVP   | `unlockDate`, `unlockOffsetJours` ; offset calculé depuis `ElearningEnrollment.grantedAt`                                              |
| **Gating par score réel** (pas attempt-only)                      | 🔴 NEUF | MVP   | `unlockType = score_quiz`, `unlockQuizId`, `unlockScorePct` ; évalue le **meilleur `QuizAttempt.scorePct`**                            |
| Verrou affiché **avec sa raison** (« réussir le quiz X à 70 % »)  | 🔴 NEUF | MVP   | Service `src/server/elearning/progression/unlock-engine.ts` retournant `{locked, reason}`. UI `src/components/elearning/LockBadge.tsx` |
| Override admin (déblocage manuel d'un apprenant)                  | 🔴 NEUF | MVP   | `ElearningUnlockOverride` + server action `overrideUnlock()` (RBAC `requireAdminWrite`)                                                |
| Moteur d'unlock centralisé (source unique évaluée à chaque rendu) | 🔴 NEUF | MVP   | `unlock-engine.ts` consommé par player + dashboard apprenant                                                                           |

---

## 5. Authentification & accès apprenant

| Feature                                                                            | Statut      | Phase | Ancrage code                                                                                                                                                              |
| ---------------------------------------------------------------------------------- | ----------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Magic-link par défaut (token 64 hex, cookie HttpOnly 90j)                          | 🟢 EXISTANT | MVP   | `PortailAcces` (`token`, `expiresAt`, `revoked`, `lastUsedAt`), portail `/portail/acces`, service `src/server/qualiopi/portail/portail-service.ts` (`getEspaceStagiaire`) |
| `passwordHash` **optionnel** (argon2id) pour comptes entreprise                    | 🟡 ÉTENDU   | MVP   | Ajout nullable sur l'identité apprenant. ⚠️ `Trainee` n'a **pas** de `passwordHash` aujourd'hui → champ additif `Trainee.passwordHash String?` (ADR-0001, ADR-0008)       |
| Système auth apprenant **séparé de NextAuth** (cookie/middleware dédiés)           | 🔴 NEUF     | MVP   | `src/server/elearning/auth/learner-session.ts` ; ne touche pas `auth()` NextAuth (réservé `AdminUser`). Cohabitation stricte (ADR-0001)                                   |
| Login email + mot de passe (entreprises)                                           | 🔴 NEUF     | MVP   | Route `/portail/connexion`, server action `loginLearnerPassword()`                                                                                                        |
| Identité apprenant unifiée (réutilise `Trainee`, PII chiffrée handicap déjà gérée) | 🟢 EXISTANT | MVP   | `Trainee` (email citext unique, consentements, `handicap_details_chiffre` AES-256-GCM)                                                                                    |
| Pages e-learning derrière auth + `force-dynamic` (compatible build stub)           | 🔴 NEUF     | MVP   | Layout `(apprenant)` avec `export const dynamic = "force-dynamic"` → aucun appel DB au SSG `stub.invalid`                                                                 |
| 2FA apprenant                                                                      | 🔴 NEUF     | V2    | Optionnel comptes entreprise sensibles                                                                                                                                    |
| SSO / SCIM entreprise                                                              | 🔴 NEUF     | V2    | Multi-tenant (cf. §11)                                                                                                                                                    |

---

## 6. Octroi d'accès & provisioning

| Feature                                                                      | Statut                                   | Phase | Ancrage code                                                                                                                                   |
| ---------------------------------------------------------------------------- | ---------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Octroi **automatique** : session présentiel/live réalisée → accès e-learning | 🟡 ÉTENDU                                | MVP   | Hook sur transition `Enrollment`/`TrainingSession` (event sourcing `FormationTransition` existant) → crée `ElearningEnrollment`                |
| Octroi **manuel** admin (ouvrir un accès en 1 clic)                          | 🔴 NEUF                                  | MVP   | `src/app/[locale]/(admin)/[adminPrefix]/elearning/acces/`, server action `grantAccess()` (RBAC `requireAdminWrite`)                            |
| **Import CSV en masse** d'une liste entreprise (création apprenants + accès) | 🔴 NEUF                                  | MVP   | Worker `elearning-import-worker.ts` + queue `elearning-import` (registre `queues.ts`) ; upsert `Trainee` par email, crée `ElearningEnrollment` |
| Email d'invitation (magic-link ou identifiants)                              | 🟢 EXISTANT (infra) / 🔴 NEUF (template) | MVP   | Nodemailer + BullMQ `emailsQueue` + `email-worker.ts` ; nouveau React Email template `elearning-invitation.tsx`                                |
| Révocation / expiration d'accès                                              | 🟡 ÉTENDU                                | MVP   | `PortailAcces.revoked` + `ElearningEnrollment.statut`                                                                                          |
| Octroi par **commande** (virement + octroi manuel)                           | 🔴 NEUF                                  | MVP   | `Order` e-learning (cf. §10), pas de CB                                                                                                        |
| Pack entreprise (N sièges, suivi côté admin Axion-IA)                        | 🔴 NEUF                                  | V1    | `ElearningSeatPack` (sièges consommés/restants)                                                                                                |
| Auto-provisioning délégué (l'entreprise gère ses équipes)                    | 🔴 NEUF                                  | V2    | Multi-tenant (cf. §11)                                                                                                                         |

---

## 7. Vidéo & streaming

| Feature                                                        | Statut      | Phase       | Ancrage code                                                                                                                              |
| -------------------------------------------------------------- | ----------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Upload média (PDF, images, sous-titres) sur R2                 | 🟢 EXISTANT | MVP         | `src/lib/r2-storage.ts` (upload direct navigateur via `getSignedUploadUrlR2`, CORS PUT à configurer côté bucket)                          |
| Streaming vidéo HLS adaptatif via **Cloudflare Stream**        | 🔴 NEUF     | MVP         | `src/server/elearning/video/stream-provider.ts` ; `ElearningLesson.videoAssetId` (id Stream, **PAS** `r2Key`), `videoDureeSec` (ADR-0005) |
| URLs signées vidéo (accès contrôlé)                            | 🔴 NEUF     | MVP         | Token signé Stream, TTL court, vérif auth apprenant + droit d'accès                                                                       |
| Watermark dynamique par utilisateur                            | 🔴 NEUF     | MVP         | Overlay signé (email/id apprenant) — anti-fuite léger                                                                                     |
| Player standard : vitesse, sous-titres WCAG AA, clavier, focus | 🔴 NEUF     | MVP         | `src/components/elearning/VideoPlayer.tsx` (lazy/dynamic import — risque INP ; budget exception type `/appel`)                            |
| Transcodage auto à l'upload                                    | 🔴 NEUF     | MVP         | Délégué à Cloudflare Stream (encodage inclus) ; webhook `POST /api/elearning/stream-webhook` → met à jour `videoAssetId` prêt             |
| Alternative **Bunny Stream** (résidence UE)                    | 🔴 NEUF     | V1 (option) | Abstraction `stream-provider.ts` (interface commune)                                                                                      |
| DRM lourd                                                      | ❌ écarté   | —           | Non justifié (sur-DRM), URLs signées + watermark suffisent (ADR-0005)                                                                     |

---

## 8. Outil auteur (course builder)

| Feature                                                                          | Statut  | Phase                              | Ancrage code                                                                                                                                                                            |
| -------------------------------------------------------------------------------- | ------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Création cours / modules / leçons + upload + quiz + publication (auteur minimal) | 🔴 NEUF | MVP                                | `src/app/[locale]/(admin)/[adminPrefix]/elearning/cours/[id]/`, server actions CRUD (RBAC `requireAdminWrite`/`requireAdminPublish`)                                                    |
| Brouillon → aperçu → publication (incrémente `version`)                          | 🔴 NEUF | MVP                                | `publishCourse()` ; `requireAdminPublish`                                                                                                                                               |
| Drag&drop sections → leçons, ré-ordonnancement transactionnel                    | 🔴 NEUF | V1                                 | Réécrit `ordre` en transaction ; WCAG 2.5.7 (alternative au drag obligatoire)                                                                                                           |
| Blocs riches mixés dans une leçon (Tiptap/JSON)                                  | 🔴 NEUF | V1                                 | `ElearningLesson.contenuJson`                                                                                                                                                           |
| Upload média transcodé auto + aperçu                                             | 🔴 NEUF | MVP (upload) / V1 (aperçu intégré) | R2 + Stream                                                                                                                                                                             |
| Aperçu « as-student »                                                            | 🔴 NEUF | V1                                 | Route admin réutilisant le player apprenant                                                                                                                                             |
| Templates de cours + clonage                                                     | 🔴 NEUF | V1                                 | `cloneCourse()`                                                                                                                                                                         |
| **IA quiz-gen** depuis le contenu de la leçon                                    | 🔴 NEUF | V1                                 | Worker `elearning-quizgen-worker.ts` ; réutilise le pipeline IA (`@anthropic-ai/sdk`, cache `CacheIa`, critique adversariale du Formation Engine `qualiopi-formation-engine-worker.ts`) |
| **Authoring document-grounded** (générer une leçon depuis un doc)                | 🔴 NEUF | V1/V2                              | Réutilise knowledge/RAG existant                                                                                                                                                        |

---

## 9. Certificats & preuves

| Feature                                                           | Statut      | Phase | Ancrage code                                                                                                                                                        |
| ----------------------------------------------------------------- | ----------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Certificat de réalisation** (modèle officiel, heures réalisées) | 🟡 ÉTENDU   | MVP   | Réutilise `DocumentGenere` (numéro unique, `hashSha256`, `pdfUrl` R2, rétention `suppression_prevue_at`) + `@react-pdf/renderer`. Nouveau `DocumentType` e-learning |
| QR de vérification publique                                       | 🟢 EXISTANT | MVP   | `DocumentGenere.qrToken` (timingSafeEqual) + route vérif publique existante                                                                                         |
| Calcul des heures réalisées (FOAD = preuve libre)                 | 🔴 NEUF     | MVP   | Agrégation `LessonProgress.watchedSeconds` + complétions + `QuizAttempt` → faisceau de preuves (R.6313-3)                                                           |
| Attestation de fin / résultats acquis (miroir)                    | 🟡 ÉTENDU   | MVP   | Écrit dans `EvaluationAcquis` (existant) pour cohérence Qualiopi/BPF                                                                                                |
| Badges / open badges                                              | 🔴 NEUF     | V2    | Gamification opt-in                                                                                                                                                 |
| Diplôme certifiant RNCP/RS                                        | 🔴 NEUF     | V2    | Conditionné certification France Compétences (ADR-0003)                                                                                                             |

---

## 10. E-commerce & commandes

| Feature                                                                   | Statut                | Phase | Ancrage code                                                                                     |
| ------------------------------------------------------------------------- | --------------------- | ----- | ------------------------------------------------------------------------------------------------ |
| Infra Stripe (`Invoice`/`Payment`/`Refund`/`StripeWebhookEvent`, webhook) | 🟢 EXISTANT (éteinte) | —     | `src/lib/stripe.ts`, flag `STRIPE_ENABLED` (`src/env.ts` ~105) = **false** (ADR-0004)            |
| SSOT tarification                                                         | 🟢 EXISTANT           | MVP   | `pricing.ts` (réutilisé, jamais dupliqué)                                                        |
| Modèle de commande e-learning `Order` (octroie l'accès)                   | 🔴 NEUF               | MVP   | `03-DATA-MODEL/05` ; MVP = **virement + octroi manuel** (pas de CB)                              |
| Tunnel d'achat CB en ligne                                                | 🔴 NEUF               | V1    | Activation `STRIPE_ENABLED=true` + clés → CB sans refonte (ADR-0004)                             |
| Vitrine publique cours + JSON-LD `Course`                                 | 🔴 NEUF               | V1    | `src/app/[locale]/formations-en-ligne/**` (SEO, budgets Web Vitals stricts, FR-only)             |
| Coupons / codes promo                                                     | 🔴 NEUF               | V2    | —                                                                                                |
| **CPF / EDOF** (entrée effective, service fait, FranceConnect+)           | 🔴 NEUF               | V2    | Derrière flag `EDOF_ENABLED=false` ; **bloqué tant que pas de certification RNCP/RS** (ADR-0003) |

---

## 11. Multi-tenant entreprise

| Feature                                                                     | Statut           | Phase | Ancrage code                                                         |
| --------------------------------------------------------------------------- | ---------------- | ----- | -------------------------------------------------------------------- |
| `Client` CRM (SIRET, OPCO) — **pas** multi-tenant                           | 🟢 EXISTANT      | —     | `Client` (CRM : prospect/devis/OPCO, aucun cloisonnement de données) |
| Clé d'appartenance entreprise data-ready dès le départ                      | 🔴 NEUF (schéma) | MVP   | `ElearningCourse.ownerClientId` + scoping prévu (ADR-0002)           |
| Accès individuels + import masse côté admin Axion-IA                        | 🔴 NEUF          | MVP   | cf. §6 (l'entreprise commande, Axion-IA ouvre les accès)             |
| Suivi par entreprise côté admin Axion-IA (pack sièges)                      | 🔴 NEUF          | V1    | `ElearningSeatPack`, reporting par `Client`                          |
| **Espaces cloisonnés** (filtrage de toutes les requêtes par tenant)         | 🔴 NEUF          | V2    | `02-ARCHITECTURE/multi-tenant-strategie.md`                          |
| Admin entreprise délégué + branding par client + reporting par organisation | 🔴 NEUF          | V2    | —                                                                    |
| SSO / SCIM                                                                  | 🔴 NEUF          | V2    | —                                                                    |

---

## 12. Frontend apprenant (UX)

| Feature                                                              | Statut    | Phase | Ancrage code                                                                                                                                                           |
| -------------------------------------------------------------------- | --------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard apprenant (mes cours, progression, reprise)                | 🔴 NEUF   | MVP   | `src/app/[locale]/(apprenant)/apprendre/` ; étend l'esprit `/portail/mon-espace`                                                                                       |
| Lecteur de cours (player + barre progression + heartbeat)            | 🔴 NEUF   | MVP   | `src/components/elearning/CoursePlayer.tsx`                                                                                                                            |
| Moteur quiz UI (rendu, soumission, feedback)                         | 🔴 NEUF   | MVP   | `src/components/elearning/QuizRunner.tsx`                                                                                                                              |
| Mobile-first                                                         | 🔴 NEUF   | MVP   | Tailwind v4, layout responsive                                                                                                                                         |
| **Accessibilité WCAG 2.2 AA** (EAA, obligation UE depuis 28/06/2025) | 🔴 NEUF   | MVP   | Critères 2.4.11 (focus non masqué), 2.5.7 (alternative au drag), 2.5.8 (cible ≥ 24px), 3.3.8 (auth accessible) + sous-titres/clavier/contraste. Détail `09-QUALITE/04` |
| Budgets Web Vitals (LCP ≤ 1800, INP ≤ 100, CLS = 0)                  | 🟡 ÉTENDU | MVP   | Pages publiques sous budget ; player/quiz = risque INP → lazy/dynamic, exception type `/appel` documentée                                                              |
| Téléchargement de ressources (si autorisé)                           | 🔴 NEUF   | MVP   | `ElearningResource.telechargeable` + URL signée R2                                                                                                                     |
| Notifications in-app / relances                                      | 🔴 NEUF   | V1    | cf. §13                                                                                                                                                                |
| **Tuteur RAG** ancré avec citations (assistance pédagogique Ind.19)  | 🔴 NEUF   | V1    | Réutilise knowledge/RAG existant ; `04-BACKEND/09`                                                                                                                     |

---

## 13. Console admin (gestion & pilotage)

| Feature                                                       | Statut      | Phase  | Ancrage code                                                                                                                                 |
| ------------------------------------------------------------- | ----------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Section nav admin « E-learning »                              | 🟡 ÉTENDU   | MVP    | `src/lib/admin-nav.ts` : nouveau `AdminNavGroup` ou items. ⚠️ Le composant monté est `AdminSidebarNav.tsx` (pas `AdminSidebar.tsx` obsolète) |
| Coquille de page admin (shell, header, tableaux, badges)      | 🟢 EXISTANT | MVP    | `AdminPageShell`, `AdminHeader`, `StatCard`, `AdminTable`, `AdminBadge`                                                                      |
| RBAC (lecture/écriture/publication/suppression)               | 🟢 EXISTANT | MVP    | `requireAdminRead/Write/Publish/Delete` (`src/server/actions/knowledge/_guards.ts`), rôles `super_admin/admin/editor/reader`                 |
| Liste apprenants + octroi + suivi basique                     | 🔴 NEUF     | MVP    | `.../elearning/apprenants/`, `.../elearning/acces/`                                                                                          |
| Outil auteur (cf. §8)                                         | 🔴 NEUF     | MVP→V1 | `.../elearning/cours/**`                                                                                                                     |
| Dashboard de pilotage (KPI engagement)                        | 🔴 NEUF     | V1     | `.../elearning/dashboard/`                                                                                                                   |
| Gestion banque de quiz                                        | 🔴 NEUF     | V1     | `.../elearning/quiz/`                                                                                                                        |
| Gestion certificats                                           | 🟡 ÉTENDU   | MVP    | Réutilise pipeline `DocumentGenere`                                                                                                          |
| Reporting / analytics + **exports conformité** (preuves FOAD) | 🔴 NEUF     | V1     | `.../elearning/reporting/` ; export CSV/PDF des faisceaux de preuves                                                                         |
| Gestion accès entreprises (packs, sièges)                     | 🔴 NEUF     | V1     | `.../elearning/entreprises/`                                                                                                                 |

---

## 14. Emails & notifications

| Feature                                       | Statut              | Phase | Ancrage code                                                              |
| --------------------------------------------- | ------------------- | ----- | ------------------------------------------------------------------------- |
| Envoi email (Nodemailer maison, pas de tiers) | 🟢 EXISTANT         | MVP   | `emailsQueue` (`src/server/queue/queues.ts`) + `email-worker.ts`          |
| Templates React Email                         | 🟢 EXISTANT (infra) | MVP   | Pattern `qualiopi-*.tsx` ; nouveaux `elearning-*.tsx`                     |
| Email invitation / accès accordé              | 🔴 NEUF             | MVP   | `elearning-invitation.tsx`                                                |
| Email obtention certificat                    | 🔴 NEUF             | MVP   | `elearning-certificat.tsx`                                                |
| **Relances auto anti-décrochage** (Ind.12)    | 🔴 NEUF             | V1    | Worker `elearning-relance-worker.ts` + cron (pattern `*-crons-worker.ts`) |
| Rappels de drip (module bientôt débloqué)     | 🔴 NEUF             | V1    | Cron e-learning                                                           |

---

## 15. Conformité FOAD / Qualiopi / réglementaire

| Feature                                                                                                                       | Statut      | Phase                           | Ancrage code / référence                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Assistance technique **ET** pédagogique (tutorat, délais formalisés)                                                          | 🔴 NEUF     | MVP (basique) / V1 (tuteur RAG) | D.6313-3-1 §1 = Qualiopi **Ind.19** (seule obligation FOAD nommée). `08-CONFORMITE/01,02`                                                                            |
| Information activités + **durée moyenne**                                                                                     | 🟡 ÉTENDU   | MVP                             | D.6313-3-1 §2 ; `ElearningCourse.dureeEstimeeMinutes`                                                                                                                |
| **Évaluations qui jalonnent/concluent** (sinon non-conformité MAJEURE)                                                        | 🔴 NEUF     | MVP                             | D.6313-3-1 §3 = Qualiopi **Ind.11** ; quiz/devoirs jalons (§3)                                                                                                       |
| Faisceau de preuves de réalisation (évaluations + travaux + logs LMS + traces accompagnement)                                 | 🔴 NEUF     | MVP                             | R.6313-3 : preuve **libre**, émargement **non** obligatoire mais relevé de connexion **seul insuffisant**. `ElearningActivityLog` + `LessonProgress` + `QuizAttempt` |
| Certificat de réalisation modèle officiel (heures)                                                                            | 🟡 ÉTENDU   | MVP                             | Obligatoire depuis 01/06/2020 ; cf. §9                                                                                                                               |
| Indicateurs Qualiopi V8 FOAD (1, 6, 9, 10, 11-majeur, 12, 17, 19)                                                             | 🟡 ÉTENDU   | MVP→V1                          | Articulé avec le Qualiopi Manager existant (skill `axionia-qualiopi`)                                                                                                |
| Conservation légale (10 ans comptable / 6 ans fiscal-OPCO / 3-5 ans preuves / 6 mois-1 an logs)                               | 🟡 ÉTENDU   | MVP                             | Réutilise `DocumentGenere.suppression_prevue_at` + crons `retentionPurgeQueue` ; durées par type                                                                     |
| **CPF éligible** (RNCP ou RS uniquement)                                                                                      | 🔴 NEUF     | V2                              | Hors code : dossier France Compétences. `08-CONFORMITE/04`                                                                                                           |
| EDOF (entrée effective = 1re connexion substantielle, assiduité, service fait ~3j, FranceConnect+, loi anti-fraude 2022-1587) | 🔴 NEUF     | V2                              | Flag `EDOF_ENABLED` ; `08-CONFORMITE/03`                                                                                                                             |
| Évaluation à distance RNCP/RS (identité + anti-fraude, proctoring **non** obligatoire, alternative CNIL)                      | 🔴 NEUF     | V2                              | `08-CONFORMITE/04`                                                                                                                                                   |
| RGPD : PII chiffrée, consentements, droit à l'effacement                                                                      | 🟢 EXISTANT | MVP                             | `Trainee` (handicap chiffré AES-256-GCM, consentements, `RgpdDemande`) ; logs techniques hashés/anonymisés                                                           |

---

## 16. IA pédagogique

| Feature                                                      | Statut      | Phase | Ancrage code                                                                                                                               |
| ------------------------------------------------------------ | ----------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Infra IA (SDK, cache, critique adversariale, grille qualité) | 🟢 EXISTANT | —     | `@anthropic-ai/sdk`, `qualiopi-formation-engine-worker.ts` (`evaluateQuality`, `runAdversarialCritique`, `CacheIa`, `GrilleQualiteConfig`) |
| Génération de quiz depuis contenu                            | 🔴 NEUF     | V1    | `elearning-quizgen-worker.ts` (réutilise pipeline ci-dessus)                                                                               |
| Tuteur RAG ancré + citations                                 | 🔴 NEUF     | V1    | Réutilise knowledge/RAG ; ancrage document-grounded                                                                                        |
| Génération de leçon document-grounded                        | 🔴 NEUF     | V1/V2 | —                                                                                                                                          |
| Parcours adaptatifs / détection d'abandon                    | 🔴 NEUF     | V2    | —                                                                                                                                          |

---

## 17. Synthèse par phase

| Phase   | Livrables clés                                                                                                                                                                                                                                                                                                          | Critère de sortie                                                                                                                                                                                                             |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MVP** | Data model + migrations additives · auth apprenant hybride · octroi auto/manuel/CSV · vidéo Cloudflare Stream · player + reprise + progression + heartbeat · quiz essentiels + gating par score + override · certificat de réalisation · outil auteur minimal · conformité FOAD transversale · section admin e-learning | Un apprenant reçoit un accès, suit le cours, est **bloqué tant qu'il n'a pas réussi le quiz au seuil**, obtient un certificat ; l'admin ouvre des accès en masse ; **toutes les preuves FOAD sont produites et exportables**. |
| **V1**  | Catalogue multi-cours + vitrine SEO · outil auteur abouti (drag&drop, blocs riches, IA quiz-gen, aperçu as-student) · banque de questions + tirage aléatoire + tous types · dashboard + reporting/exports conformité · relances auto (Ind.12) · tuteur RAG (Ind.19) · paiement CB (Stripe ON) · packs entreprise        | Catalogue réel, création de cours sans dev, vente en ligne, pilotage de l'engagement, relances automatiques.                                                                                                                  |
| **V2**  | Multi-tenant complet (cloisonnement, admin délégué, branding, SSO/SCIM) · CPF/EDOF activé (si certification) · IA avancée (adaptatif, détection abandon) · standards SCORM/cmi5/xAPI si besoin · badges/gamification opt-in                                                                                             | Échelle entreprise, financement CPF, différenciation IA.                                                                                                                                                                      |

---

## 18. Tableau récapitulatif EXISTANT vs NEUF

**🟢 Réutilisé tel quel :** `PortailAcces`, `Trainee` (PII/handicap/consentements), `Client` (CRM), `Enrollment`, `DocumentGenere`+QR, R2 (`src/lib/r2-storage.ts`), Stripe (`Invoice`/`Payment`/`Refund`, flag `STRIPE_ENABLED`), `pricing.ts`, Nodemailer + `emailsQueue` + `email-worker.ts`, console admin (`AdminPageShell`, `admin-nav.ts`, RBAC `requireAdmin*`), Formation Engine IA + `CacheIa` + critique adversariale, RGPD (`RgpdDemande`).

**🟡 Étendu (additif, ADR-0008) :** `Trainee.passwordHash` (nullable) · champs inverses `Formation.elearningCourses` / `Client."ClientCoursesProprietaires"` · nouveaux `DocumentType` e-learning · miroir résultats dans `EvaluationAcquis` · durées de conservation par type.

**🔴 Neuf (cloisonné, ADR-0007) :** cœur LMS (`ElearningCourse/Module/Lesson/Resource`) · progression (`ElearningEnrollment`, `LessonProgress`, `ElearningActivityLog`) · moteur quiz (`Quiz/Question/QuizOption/QuizAttempt/QuizAnswer`, banque) · moteur d'unlock + overrides · auth apprenant séparée · import masse · pipeline vidéo HLS · outil auteur · IA quiz-gen + tuteur RAG · certificats e-learning · `Order` · packs sièges · multi-tenant (V2).

---

## Liens

- `00-INDEX/README.md` — index maître
- `00-INDEX/DECISIONS-ARBITRAGES.md` — les 8 ADR (auth, multi-tenant, CPF, Stripe, vidéo, standards, cloisonnement, migrations)
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — cœur LMS (modèles/enums référencés ici)
- `03-DATA-MODEL/02-schema-progression-tracking.md` — `ElearningEnrollment`, `LessonProgress`, activity log
- `03-DATA-MODEL/03-schema-quiz-evaluations.md` — moteur de quiz
- `03-DATA-MODEL/04-schema-comptes-acces-auth.md` — auth apprenant
- `03-DATA-MODEL/05-schema-ecommerce-commandes.md` — `Order`
- `02-ARCHITECTURE/reutilisation-existant.md` — carte de réutilisation détaillée
- `02-ARCHITECTURE/multi-tenant-strategie.md` — stratégie V2
- `08-CONFORMITE/*` — FOAD, Qualiopi, CPF/EDOF, RNCP/RS, RGPD, preuves
- `11-ROADMAP/01-phasage-mvp-v1-v2.md` — séquence d'implémentation (référence de phasage)
