# Backlog — Epics → User Stories (critères d'acceptation)

> Backlog **directement exploitable** par une équipe de dev senior pour livrer la plateforme LMS e-learning propriétaire d'Axion-IA.
>
> Source de vérité produit : `00-INDEX/DECISIONS-ARBITRAGES.md` (ADR-0001 à 0008), `03-DATA-MODEL/01-schema-cours-modules-lecons.md`, `11-ROADMAP/01-phasage-mvp-v1-v2.md`.
> Dernière mise à jour : 2026-06-27.

---

## Comment lire ce backlog

- **Numérotation** : `EPIC-NN` puis `US-NN-MM` (story MM de l'epic NN). Stable, ne pas renuméroter (référencé par les autres docs + commits + PRs).
- **MoSCoW** : **M** (Must, bloquant pour la phase) · **S** (Should, fort) · **C** (Could, si temps) · **W** (Won't now, plus tard).
- **Phase** : `MVP` · `V1` · `V2` (alignée `01-phasage-mvp-v1-v2.md`).
- **Critères d'acceptation** : format checklist vérifiable. Un critère = un test (manuel ou automatisé).
- **EXISTANT** = brique réelle du repo à réutiliser (jamais dupliquer). **NEUF** = à construire.
- **Cloisonnement** (ADR-0007) : tout le code neuf vit sous `src/server/elearning/**`, `src/app/[locale]/(admin)/[adminPrefix]/elearning/**`, `src/app/[locale]/apprendre/**` (espace apprenant public) + extension `src/app/[locale]/portail/**`, `src/components/elearning/**`, `src/components/admin/elearning/**`, workers `src/server/queue/workers/elearning-*-worker.ts`.
- **Migrations** (ADR-0008) : strictement additives (CREATE TABLE / ADD COLUMN nullable). Jamais de DROP.

### Vue d'ensemble des epics

| Epic    | Titre                                                | Phase pivot        | Dépend de      |
| ------- | ---------------------------------------------------- | ------------------ | -------------- |
| EPIC-01 | Data model & migrations LMS                          | MVP                | —              |
| EPIC-02 | Authentification apprenant hybride                   | MVP                | 01             |
| EPIC-03 | Octroi d'accès, inscription & import en masse        | MVP                | 01, 02         |
| EPIC-04 | Pipeline vidéo (Cloudflare Stream)                   | MVP                | 01             |
| EPIC-05 | Lecteur de cours, progression & reprise              | MVP                | 01, 02, 04     |
| EPIC-06 | Déverrouillage (drip + gating par score)             | MVP                | 01, 05         |
| EPIC-07 | Moteur de quiz interactif                            | MVP                | 01, 05         |
| EPIC-08 | Certificats de réalisation e-learning                | MVP                | 01, 05, 07     |
| EPIC-09 | Outil auteur (course builder)                        | MVP→V1             | 01, 04, 07     |
| EPIC-10 | Console admin e-learning (nav, pilotage, apprenants) | MVP→V1             | 01, 03         |
| EPIC-11 | Conformité FOAD & traçabilité des preuves            | MVP                | 01, 05, 07, 08 |
| EPIC-12 | Emails apprenant & relances anti-décrochage          | MVP→V1             | 02, 05         |
| EPIC-13 | Catalogue public & vitrine SEO                       | V1                 | 01             |
| EPIC-14 | IA pédagogique (quiz-gen + tuteur RAG)               | V1                 | 07, 09         |
| EPIC-15 | E-commerce (commandes + Stripe gated)                | V1                 | 01, 03         |
| EPIC-16 | Banque de questions & tirage aléatoire               | V1                 | 07             |
| EPIC-17 | Reporting, analytics & exports conformité            | V1                 | 05, 07, 11     |
| EPIC-18 | Accessibilité WCAG 2.2 AA & Web Vitals               | transversal MVP→V1 | 05, 07         |
| EPIC-19 | Multi-tenant entreprise (espaces cloisonnés)         | V2                 | 01, 02, 03     |
| EPIC-20 | CPF / EDOF activable + standards (SCORM/xAPI)        | V2                 | 11, 17         |

---

# EPIC-01 — Data model & migrations LMS

**Objectif** : poser la colonne vertébrale Prisma (cœur LMS, progression, quiz, accès, ecommerce, conformité) en une vague de migrations **additives**, dès le MVP, pour ne pas créer de dette bloquante (le multi-tenant et l'ecommerce sont _modélisés_ maintenant même si livrés plus tard — ADR-0002/0004).

**EXISTANT réutilisé** : `Formation` (schema.prisma:5061), `Client` (4890), `Trainee` (5274), `Enrollment` (5310), `TrainingSession` (5148), `DocumentGenere` (5507), `EvaluationAcquis` (5653), `Questionnaire` (5704), `PortailAcces` (6236). **NEUF** : tous les modèles `Elearning*`, `Quiz*`, `Learner*`.

### US-01-01 — Schéma cœur cours/modules/leçons/ressources `[M][MVP]`

**En tant que** dev, **je veux** les modèles `ElearningCourse`, `ElearningModule`, `ElearningLesson`, `ElearningResource` + enums (`ElearningCourseStatut`, `ElearningLessonType`, `ElearningUnlockType`) **afin de** structurer le contenu.

- [ ] Modèles conformes **mot pour mot** à `03-DATA-MODEL/01-schema-cours-modules-lecons.md` (noms champs, `@map`, `@@unique`, `@@index`).
- [ ] Relations inverses additives ajoutées sur `Formation` (`elearningCourses ElearningCourse[]`) et `Client` (`coursesProprietaires ElearningCourse[] @relation("ClientCoursesProprietaires")`) — **sans colonne** côté existant (FK portée par `ElearningCourse`).
- [ ] `@@unique([courseId, ordre])` sur module et `@@unique([moduleId, ordre])` sur leçon garantissent l'ordonnancement.
- [ ] Migration `prisma/migrations/<ts>_elearning_core/` = uniquement `CREATE TABLE` / `CREATE TYPE`. `prisma migrate diff` ne contient aucun `DROP`.
- [ ] `pnpm prisma:generate` OK ; `pnpm typecheck` vert.

### US-01-02 — Schéma progression/tracking `[M][MVP]`

**En tant que** dev, **je veux** `ElearningEnrollment` (apprenant↔cours, distinct du `Enrollment` session↔stagiaire existant) + `LessonProgress` **afin de** suivre l'avancement.

- [ ] `ElearningEnrollment` : FK `courseId`, `learnerId` (cf. EPIC-02), `octroiSource` (enum `auto_session | manuel | import_csv | commande`), `accesOuvertAt`, `accesExpireAt?`, `progressionPct` (cache), `statut` (enum `actif | termine | suspendu | expire`), `derniereActiviteAt`, `entreeEffectiveAt?` (1re activité substantielle — préparé EDOF/FOAD), `clientId?` (entreprise rattachée, préparé multi-tenant). `@@unique([courseId, learnerId])`.
- [ ] `LessonProgress` : FK `lessonId`, `elearningEnrollmentId` ; `statut` (enum `non_commence | en_cours | termine`), `positionSec?` (reprise vidéo), `watchedSec?`, `completionPct`, `premierAccesAt?`, `termineAt?`, `tempsTotalSec` (cumul heartbeats). `@@unique([elearningEnrollmentId, lessonId])`, `@@index([elearningEnrollmentId])`.
- [ ] Grammaire xAPI-like (ADR-0006) : un modèle `LearningEvent` (verbe ∈ `launched|played|paused|seeked|completed|answered|passed|failed|downloaded`, objet=lessonId/quizId, `payloadJson`, `occurredAt`, `learnerId`, `courseId`) pour la traçabilité fine + future export xAPI.
- [ ] Migration additive ; index sur toutes les FK et colonnes filtrées (`statut`, `derniereActiviteAt`).

### US-01-03 — Schéma quiz/évaluations `[M][MVP]`

**En tant que** dev, **je veux** `Quiz`, `QuizQuestion`, `QuizChoice`, `QuizAttempt`, `QuizAnswer` **afin de** porter le moteur de quiz (EPIC-07).

- [ ] `Quiz` : `titre`, `lessonId?` (si quiz=leçon), `seuilReussitePct` (def 70), `nbTentativesMax?` (null=illimité), `tirageAleatoireN?` (N parmi M de la banque), `shuffleQuestions Boolean`, `shuffleReponses Boolean`, `tempsLimiteSec?`, `feedbackMode` (enum `immediat | fin | jamais`), `correctionManuelleRequise Boolean`.
- [ ] `QuizQuestion` : `type` (enum `qcm_mono | qcm_multi | vrai_faux | appariement | texte_trous | ordonnancement | reponse_courte | essai | upload`), `enonceJson`, `ponderation Int @default(1)`, `rationale?` (explication affichée après), `ordre`, `banqueQuestionId?` (lien banque, EPIC-16).
- [ ] `QuizChoice` : `questionId`, `texte`, `estCorrect Boolean`, `ordre`, `appariementCible?` (pour appariement).
- [ ] `QuizAttempt` : `quizId`, `elearningEnrollmentId`, `numeroTentative`, `scorePct?`, `reussi Boolean?`, `demarreAt`, `termineAt?`, `tempsPasseSec?`, `statut` (enum `en_cours | soumis | corrige`), `corrigePar?` (admin si manuel), `seedAleatoire` (pour rejouer le tirage/shuffle serveur).
- [ ] `QuizAnswer` : `attemptId`, `questionId`, `reponseJson` (choix/texte/ordre/r2Key upload), `correcte Boolean?`, `pointsObtenus?`, `feedbackManuel?`.
- [ ] **EXISTANT** : `EvaluationAcquis` (5653) et `Questionnaire` (5704) stockent des résultats Qualiopi mais **n'ont aucun moteur interactif** ; le nouveau moteur produit un `EvaluationAcquis` à la complétion (réutilisation, pas duplication) — cf. US-11-03.

### US-01-04 — Schéma comptes/accès apprenant `[M][MVP]`

**En tant que** dev, **je veux** `Learner` + `LearnerSession` + `LearnerMagicLink` **afin de** porter l'auth hybride (ADR-0001, EPIC-02).

- [ ] `Learner` : `email @unique @db.Citext`, `nom?`, `prenom?`, `passwordHash?` (argon2id, **nullable** — magic-link par défaut), `traineeId?` (lien optionnel vers `Trainee` existant pour réconcilier les participants de sessions), `clientId?` (entreprise, préparé multi-tenant V2), `emailVerifieAt?`, `dernierLoginAt?`, `actif Boolean`, `deletedAt?`. `@@index([email])`, `@@index([clientId])`, `@@index([traineeId])`.
- [ ] `LearnerSession` : `learnerId`, `token @unique @db.VarChar(64)` (même doctrine que `PortailAcces` : 64 hex, cookie HttpOnly), `expiresAt`, `revoked`, `ip?`, `userAgent?`, `lastUsedAt?`. Cookie **distinct** de NextAuth (ADR-0001).
- [ ] `LearnerMagicLink` : `learnerId`, `tokenHash`, `expiresAt` (court, 30 min), `consumedAt?`, `purpose` (enum `login | set_password | invite`).
- [ ] `Trainee` reçoit **uniquement** une relation inverse `learner Learner?` (additive, FK portée par `Learner`). `Trainee.passwordHash` **n'est PAS ajouté** (l'auth apprenant vit sur `Learner`, séparée).

### US-01-05 — Schéma ecommerce/commandes (modélisé, paiement gated) `[S][MVP]`

**En tant que** dev, **je veux** `ElearningOrder` + `ElearningOrderItem` **afin de** tracer un achat/octroi e-learning (CB éteinte ADR-0004).

- [ ] `ElearningOrder` : `learnerId?`, `clientId?` (entreprise), `email`, `statut` (enum `brouillon | en_attente_paiement | payee | octroyee | annulee | remboursee`), `montantHtCents`, `tvaCents`, `montantTtcCents`, `modePaiement` (enum `virement | manuel | stripe`), `invoiceId?` (FK vers `Invoice` existant), `octroyeeAt?`, `octroyeePar?`.
- [ ] `ElearningOrderItem` : `orderId`, `courseId`, `quantite` (sièges entreprise), `prixUnitaireHtCents`.
- [ ] **EXISTANT** : `Invoice`/`Payment`/`Refund` réutilisés ; flag `STRIPE_ENABLED` (src/env.ts ~103-115) reste `false`. Le modèle existe mais aucun appel CB n'est branché au MVP.
- [ ] Prix lus via **`pricing.ts` SSOT** (jamais de prix en dur).

### US-01-06 — Schéma conformité/preuves FOAD `[M][MVP]`

**En tant que** dev, **je veux** `FoadProof` + `FoadAssistanceLog` **afin de** constituer le faisceau de preuves R.6313-3 (EPIC-11).

- [ ] `FoadProof` : `elearningEnrollmentId`, `type` (enum `connexion_log | evaluation | travail_rendu | progression_snapshot | assistance | certificat`), `r2Key?`, `payloadJson`, `dateProuvee`, `conserveJusquA` (calculé selon durée légale — cf. US-11-05).
- [ ] `FoadAssistanceLog` : `elearningEnrollmentId`, `canal` (enum `email | tuteur_ia | visio | telephone`), `demandeAt`, `repondoAt?`, `delaiReponseHeures?` (SLA Qualiopi Ind.19), `contenuResume?`.
- [ ] Migration additive ; rétention via worker `elearning-retention-worker` (réutilise pattern `retention-purge-worker.ts`).

### US-01-07 — Stratégie migration & compat build stub `[M][MVP]`

**En tant que** dev, **je veux** que les migrations passent le build GH Actions sous `stub.invalid` **afin de** ne pas casser le déploiement.

- [ ] Aucune page SSG e-learning n'est rendue au build : toutes les routes apprenant/admin sont `force-dynamic` + derrière auth → le stub Proxy `prisma.ts` ne les touche pas (cf. contrat ADR 0026 dans `AGENTS.md`).
- [ ] Toute page e-learning **publique** (catalogue EPIC-13) ajoute un early-exit `if (process.env.DATABASE_URL?.includes("stub.invalid")) return <fallback vide>` OU s'appuie sur l'ISR.
- [ ] `prisma migrate deploy` (entrypoint conteneur) applique les migrations au runtime avec la vraie DB.

---

# EPIC-02 — Authentification apprenant hybride

**Objectif** : ADR-0001. Magic-link par défaut (zéro friction, réutilise la doctrine `PortailAcces`) + mot de passe **optionnel** pour les comptes entreprise. Système **totalement séparé de NextAuth** (qui ne gère que `AdminUser`).

**EXISTANT** : `PortailAcces` (token 64hex, cookie HttpOnly 90j), `verifierToken()`/`creerAcces()`/`setPortailCookie` (`src/server/qualiopi/portail/portail-service.ts` + `cookie.ts`), `checkRateLimit` (`src/lib/rate-limit.ts`), route `[locale]/portail/acces/[token]/route.ts`. **NEUF** : `Learner` auth, middleware apprenant, argon2id.

### US-02-01 — Connexion par magic-link `[M][MVP]`

**En tant qu'**apprenant, **je veux** recevoir un lien de connexion par email **afin d'**accéder à mes cours sans mot de passe.

- [ ] `requestMagicLink(email)` (server action `src/server/elearning/auth/actions.ts`) : crée un `LearnerMagicLink` (TTL 30 min, `tokenHash`), enfile un email via `emailsQueue` (EXISTANT).
- [ ] Route `GET [locale]/apprendre/connexion/[token]/route.ts` : rate-limit IP (réutilise `checkRateLimit`, 10/60s), vérification timing-safe, consomme le lien (`consumedAt`), crée `LearnerSession`, pose cookie HttpOnly `el_session` (distinct de `portail_*` et NextAuth), redirige vers `/apprendre/mon-espace` **sans token dans l'URL**.
- [ ] Lien réutilisé/expiré/consommé → redirection page d'erreur `apprendre/connexion-invalide`.
- [ ] Réponse anti-énumération : `requestMagicLink` répond identiquement que l'email existe ou non.

### US-02-02 — Mot de passe optionnel (comptes entreprise) `[S][MVP]`

**En tant qu'**apprenant entreprise, **je veux** définir un mot de passe **afin de** me reconnecter sans email à chaque fois.

- [ ] `setPassword(token)` via `LearnerMagicLink.purpose=set_password` ; hash **argon2id** (lib `argon2`), stocké dans `Learner.passwordHash`.
- [ ] `loginWithPassword(email, password)` : vérif argon2id, rate-limit, crée `LearnerSession`. Politique mot de passe (≥12 car., zxcvbn score ≥3).
- [ ] Le magic-link reste toujours disponible même si un mot de passe existe (fallback).
- [ ] WCAG 2.2 — critère 3.3.8 « Authentification accessible » : pas de test cognitif ; copier-coller du mot de passe autorisé ; champ password `autocomplete="current-password"`.

### US-02-03 — Middleware & garde de session apprenant `[M][MVP]`

**En tant que** dev, **je veux** un garde `requireLearner()` **afin de** protéger les routes apprenant sans interférer avec NextAuth.

- [ ] `requireLearner()` (`src/server/elearning/auth/guard.ts`) : lit cookie `el_session`, valide `LearnerSession` (non révoquée, non expirée), retourne `{ learnerId, clientId? }` ; throw `unauthorized` sinon.
- [ ] La logique vit **hors** du middleware NextAuth admin (pas de modif de `src/auth.ts` / `proxy.ts` pour l'admin). Vérification dans les Server Components/Actions (pattern guards KB existant).
- [ ] Déconnexion `logout()` : révoque `LearnerSession`, supprime le cookie.
- [ ] Test : un cookie admin NextAuth ne donne **aucun** accès apprenant et inversement (cloisonnement strict ADR-0001).

### US-02-04 — Réconciliation Learner ↔ Trainee `[S][MVP]`

**En tant qu'**admin, **je veux** qu'un participant de session (`Trainee`) devienne automatiquement un `Learner` lors d'un octroi e-learning **afin d'**éviter les doublons d'identité.

- [ ] À l'octroi (EPIC-03), si un `Trainee.email` correspond, le `Learner` créé porte `traineeId` ; sinon `Learner` autonome.
- [ ] Idempotent : ré-octroyer ne crée pas de second `Learner` (clé `email citext`).

---

# EPIC-03 — Octroi d'accès, inscription & import en masse

**Objectif** : ouvrir l'accès à un cours « à qui on veut » : (a) automatique session réalisée → e-learning, (b) manuel admin 1 clic, (c) import CSV liste entreprise. MVP = octroi piloté côté Axion-IA (le self-service entreprise = V2, EPIC-19).

**EXISTANT** : `Enrollment` (session↔stagiaire), `Client` (CRM), pattern import (`ReleveConnexionImport`, `kit-import-worker.ts`). **NEUF** : octroi e-learning, parser CSV, provisioning de masse.

### US-03-01 — Octroi manuel d'un accès `[M][MVP]`

**En tant qu'**admin, **je veux** ouvrir l'accès d'un cours à un email **afin de** servir une vente directe/virement.

- [ ] Server action `grantAccess({ courseId, email, accesExpireAt?, clientId? })` : crée/retrouve `Learner`, crée `ElearningEnrollment` (`octroiSource=manuel`, `statut=actif`), envoie email d'invitation (magic-link).
- [ ] RBAC `requireAdminWrite` (EXISTANT `_guards.ts` : roles `super_admin|admin|editor`).
- [ ] Idempotent : ré-octroi → met à jour la date d'expiration, ne duplique pas l'enrollment.
- [ ] Trace : `LearningEvent` `granted` + `FoadProof` (octroi).

### US-03-02 — Octroi automatique session → e-learning `[S][MVP]`

**En tant qu'**admin, **je veux** qu'à la réalisation d'une `TrainingSession` adossée à un `ElearningCourse` (via `formationId`), les participants reçoivent l'accès e-learning **afin d'**automatiser le blended.

- [ ] Hook dans le cycle de vie session (réutilise `FormationTransition` / `qualiopi-formation-crons-worker`) : `TrainingSession.statut → realisee` ⇒ pour chaque `Enrollment` confirmé, `grantAccess(octroiSource=auto_session)` sur les cours liés à la `Formation`.
- [ ] Configurable par cours (`ElearningCourse` flag « octroi auto à la réalisation »).

### US-03-03 — Import CSV de masse (liste entreprise) `[M][MVP]`

**En tant qu'**admin, **je veux** importer un CSV (nom, prénom, email) **afin d'**ouvrir N accès d'un coup pour une entreprise.

- [ ] UI upload CSV sous `[adminPrefix]/elearning/acces/import` → worker `elearning-provisioning-worker.ts` (queue `elearning-provisioning`).
- [ ] Parsing tolérant (UTF-8/BOM, `;` ou `,`), validation par ligne (email valide, dédup), rapport ligne-par-ligne (créés / déjà existants / erreurs).
- [ ] Rattachement `clientId` (entreprise) sur chaque `Learner`/`ElearningEnrollment` (préparé multi-tenant).
- [ ] Envoi groupé d'invitations throttlé via `emailsQueue` (anti-spam Nodemailer maison).
- [ ] Idempotent : relancer le même CSV ne crée pas de doublons.

### US-03-04 — Gestion expiration / révocation d'accès `[S][V1]`

**En tant qu'**admin, **je veux** suspendre/révoquer ou prolonger un accès **afin de** gérer les fins de droits.

- [ ] Actions `revokeAccess`, `extendAccess(date)` ; `ElearningEnrollment.statut` passe `suspendu`/`expire`.
- [ ] Worker cron `elearning-access-lifecycle` : passe à `expire` les accès dont `accesExpireAt < now` (réutilise pattern `option-expiration-worker.ts`).
- [ ] Un accès expiré conserve les **preuves** (jamais de suppression — conservation légale EPIC-11).

---

# EPIC-04 — Pipeline vidéo (Cloudflare Stream)

**Objectif** : ADR-0005. HLS adaptatif + URLs signées + sous-titres + watermark dynamique. Pas d'auto-hébergement, R2 ne streame pas.

**EXISTANT** : R2 (`getSignedUploadUrlR2` pour upload direct navigateur). **NEUF** : intégration Cloudflare Stream, `videoAssetId`, signature playback.

### US-04-01 — Upload vidéo (TUS / direct upload) `[M][MVP]`

**En tant qu'**auteur, **je veux** uploader une vidéo depuis l'outil auteur **afin de** créer une leçon vidéo.

- [ ] `src/server/elearning/video/stream-client.ts` : `createDirectUpload()` → renvoie une URL d'upload Cloudflare Stream signée ; le navigateur PUT directement (pas de transit serveur, comme `getSignedUploadUrlR2`).
- [ ] Au callback/poll, `ElearningLesson.videoAssetId` + `videoDureeSec` renseignés.
- [ ] Flag `VIDEO_PROVIDER` (`cloudflare_stream` | `bunny`) pour basculer fournisseur sans refonte (ADR-0005 alternative UE).
- [ ] Mode dégradé : si provider non configuré, l'upload est désactivé avec message clair (pas de crash).

### US-04-02 — Lecture HLS avec URL signée + watermark `[M][MVP]`

**En tant qu'**apprenant, **je veux** lire la vidéo en streaming protégé **afin d'**avoir une UX fluide mobile.

- [ ] `getSignedPlaybackToken(lessonId, learnerId)` : JWT signé Cloudflare Stream, TTL court (ex. 2h), lié au `learnerId`.
- [ ] Watermark dynamique = overlay client (email/initiales apprenant) rendu par le player (dissuasion légère ; pas de DRM lourd — ADR-0005).
- [ ] L'URL signée n'est jamais exposée côté HTML statique (route `force-dynamic`, derrière `requireLearner`).

### US-04-03 — Sous-titres & accessibilité vidéo `[M][MVP]`

**En tant qu'**apprenant, **je veux** des sous-titres **afin de** suivre la vidéo (WCAG + EAA).

- [ ] Upload de pistes WebVTT (stockées via `ElearningResource type=sous_titres` sur R2 OU pistes Stream).
- [ ] Le player expose : sous-titres on/off, vitesse de lecture (0.5–2×), volume clavier-accessible — cf. EPIC-18.

---

# EPIC-05 — Lecteur de cours, progression & reprise

**Objectif** : barre MUST-HAVE 2026 — reprise auto persistée serveur, barre de progression, player standard, mobile-first.

**EXISTANT** : R2 (PDF), `getEspaceStagiaire` (pattern espace). **NEUF** : player, heartbeat, calcul de progression.

### US-05-01 — Espace apprenant (dashboard « Mes cours ») `[M][MVP]`

**En tant qu'**apprenant, **je veux** voir mes cours et leur progression **afin de** reprendre où je me suis arrêté.

- [ ] Route `[locale]/apprendre/mon-espace/page.tsx` (`force-dynamic`, `requireLearner`).
- [ ] Liste des `ElearningEnrollment` actifs : titre cours, `progressionPct`, bouton « Continuer » (deep-link vers la dernière leçon en cours).
- [ ] Affiche le statut (en cours / terminé / expiré) + certificat téléchargeable si obtenu.

### US-05-02 — Lecteur de leçon (player universel) `[M][MVP]`

**En tant qu'**apprenant, **je veux** lire chaque type de leçon (vidéo/texte/pdf/quiz/embed/devoir) **afin de** suivre le cours.

- [ ] Route `[locale]/apprendre/cours/[slug]/[lessonId]/page.tsx` ; sidebar arborescence modules/leçons avec état (verrouillé/en cours/terminé).
- [ ] Rendu selon `ElearningLessonType` : `video` (EPIC-04), `texte` (blocs `contenuJson` Tiptap rendus serveur), `pdf` (viewer via URL signée R2), `quiz` (EPIC-07), `embed`, `devoir` (upload).
- [ ] Composants sous `src/components/elearning/player/*`. Client-JS minimal (budget INP, EPIC-18).

### US-05-03 — Reprise automatique persistée serveur `[M][MVP]`

**En tant qu'**apprenant, **je veux** que ma position vidéo soit sauvegardée **afin de** reprendre exactement où j'étais, sur n'importe quel appareil.

- [ ] Heartbeat client → server action `recordHeartbeat({ lessonId, positionSec, watchedSec })` toutes ~15 s + sur `pause`/`beforeunload` (sendBeacon).
- [ ] `LessonProgress.positionSec`/`watchedSec`/`tempsTotalSec` mis à jour ; debounce serveur pour éviter le flood.
- [ ] À la réouverture, le player seek à `positionSec`.
- [ ] Émet `LearningEvent` (`played`/`paused`/`seeked`) — base du faisceau de preuves FOAD (EPIC-11).

### US-05-04 — Complétion de leçon & calcul de progression `[M][MVP]`

**En tant qu'**apprenant, **je veux** qu'une leçon soit marquée terminée **afin de** débloquer la suite.

- [ ] Règle de complétion par type : vidéo = `watchedSec ≥ X%` (configurable, def 90%) ; texte/pdf = scroll bas + temps min OU bouton « marquer comme terminé » ; quiz = réussite (EPIC-07) ; devoir = fichier rendu.
- [ ] `markLessonComplete` met `LessonProgress.statut=termine`, recalcule `ElearningEnrollment.progressionPct` (leçons `obligatoire=true` uniquement).
- [ ] Barre de progression cours + module à jour en temps réel.
- [ ] À 100% des obligatoires + seuil global atteint → déclenche certificat (EPIC-08).

### US-05-05 — Leçon « devoir » (travail à rendre) `[S][MVP]`

**En tant qu'**apprenant, **je veux** déposer un travail **afin de** produire une preuve FOAD (R.6313-3).

- [ ] Upload via `getSignedUploadUrlR2` → `ElearningResource` + `FoadProof type=travail_rendu`.
- [ ] L'admin/tuteur peut consulter et donner un retour (feedback) — corrélé EPIC-12.

---

# EPIC-06 — Déverrouillage (drip + gating par score)

**Objectif** : 3 déclencheurs de drip (date fixe / offset J+N / complétion précédent) + **gating par vraie note de quiz** (pas attempt-only) + verrou affiché AVEC sa raison + override admin.

**NEUF** : moteur `unlock`. S'appuie sur les champs `unlock*` déjà au schéma (US-01-01).

### US-06-01 — Moteur de déverrouillage serveur `[M][MVP]`

**En tant que** dev, **je veux** une fonction `computeUnlockState(learner, course)` **afin de** dire pour chaque module/leçon : ouvert / verrouillé + raison.

- [ ] Évalue `ElearningUnlockType` : `immediat`, `apres_precedent` (complétion de l'élément `ordre-1`), `date_fixe` (`unlockDate`), `offset_inscription` (`accesOuvertAt + unlockOffsetJours`), `score_quiz` (`QuizAttempt.scorePct ≥ unlockScorePct` sur `unlockQuizId`).
- [ ] Calcul **côté serveur** (jamais de gating purement client) ; le frontend ne reçoit que l'état + raison.
- [ ] Retourne pour chaque nœud : `{ unlocked: bool, reason: 'date'|'score'|'precedent'|'offset', detail }`.

### US-06-02 — Gating par score (vraie note bloquante) `[M][MVP]`

**En tant qu'**apprenant, **je veux** ne déverrouiller le module suivant qu'après avoir **réussi** le quiz au seuil **afin de** valider mes compétences.

- [ ] Le module suivant reste verrouillé tant que `meilleur QuizAttempt.scorePct < unlockScorePct` (note réelle, pondérée — pas « a tenté »).
- [ ] Si `nbTentativesMax` atteint sans réussite → état « bloqué, contacter le formateur » (preuve d'assistance possible).

### US-06-03 — Affichage du verrou avec sa raison `[M][MVP]`

**En tant qu'**apprenant, **je veux** comprendre pourquoi un contenu est verrouillé **afin de** savoir quoi faire.

- [ ] Chaque nœud verrouillé affiche un libellé clair : « Disponible le JJ/MM », « Terminez la leçon précédente », « Réussissez le quiz (≥70%) », « Disponible J+3 après le début ».
- [ ] Accessible (texte, pas seulement icône — WCAG 1.4.1).

### US-06-04 — Override admin (forcer le déverrouillage) `[S][V1]`

**En tant qu'**admin, **je veux** débloquer manuellement un apprenant **afin de** gérer un cas particulier.

- [ ] `forceUnlock({ enrollmentId, lessonId, raison })` (RBAC `requireAdminWrite`) ; trace `LearningEvent` + raison conservée (audit).

---

# EPIC-07 — Moteur de quiz interactif

**Objectif** : ~12 types de questions, correction auto + manuelle, seuil/pondération, feedback configurable, rationale, shuffle questions ET réponses, tirage N parmi M, anti-triche léger (randomisation + temps serveur). Proctoring **hors scope** (CNIL proportionné — V2 optionnel high-stakes).

**EXISTANT** : `EvaluationAcquis`/`Questionnaire` (stockage résultats, pas de moteur). **NEUF** : tout le moteur interactif.

### US-07-01 — Rendu & passation d'un quiz `[M][MVP]`

**En tant qu'**apprenant, **je veux** répondre à un quiz **afin de** valider le module.

- [ ] `startAttempt(quizId)` : crée `QuizAttempt` (vérifie `nbTentativesMax`), tire l'ordre des questions/choix avec un `seedAleatoire` **persisté serveur** (rejouable, anti-triche), démarre le timer serveur si `tempsLimiteSec`.
- [ ] `submitAttempt(attemptId, answers)` : correction serveur (jamais côté client), calcule `scorePct` pondéré, `reussi = scorePct ≥ seuilReussitePct`.
- [ ] Types MVP : `qcm_mono`, `qcm_multi`, `vrai_faux`, `reponse_courte` (match normalisé). Autres types → V1 (EPIC-16/banque).

### US-07-02 — Correction auto + feedback + rationale `[M][MVP]`

**En tant qu'**apprenant, **je veux** un retour après le quiz **afin de** progresser.

- [ ] `feedbackMode` respecté : `immediat` (après chaque question), `fin` (récap global), `jamais` (note seule).
- [ ] Affiche le `rationale` de chaque question + bonne réponse selon le mode.
- [ ] Le détail des bonnes réponses n'est **jamais** envoyé au client avant soumission (anti-triche réseau).

### US-07-03 — Tentatives, seuil, pondération `[M][MVP]`

**En tant qu'**auteur, **je veux** configurer tentatives/seuil/pondération **afin d'**adapter la difficulté.

- [ ] `nbTentativesMax`, `seuilReussitePct`, `ponderation` par question appliqués au calcul.
- [ ] Le **meilleur** score parmi les tentatives compte pour le gating (EPIC-06).

### US-07-04 — Shuffle questions & réponses `[S][MVP]`

- [ ] `shuffleQuestions`/`shuffleReponses` appliqués via `seedAleatoire` (déterministe par tentative, anti-triche).

### US-07-05 — Tirage aléatoire N parmi M (banque) `[S][V1]`

- [ ] Si `tirageAleatoireN` défini, le quiz tire N questions de la banque liée (EPIC-16) ; chaque tentative = un sous-ensemble différent.

### US-07-06 — Types avancés de questions `[C][V1]`

- [ ] `appariement`, `texte_trous`, `ordonnancement`, `essai` (correction manuelle), `upload` (R2) — chacun avec UI dédiée accessible (drag avec alternative clavier — WCAG 2.5.7).

### US-07-07 — Correction manuelle (essai / upload) `[C][V1]`

**En tant qu'**admin/tuteur, **je veux** corriger les questions ouvertes **afin de** noter les essais.

- [ ] File « à corriger » ; saisie de `pointsObtenus` + `feedbackManuel` ; recalcule `scorePct` et déclenche le gating une fois corrigé.

### US-07-08 — Anti-triche léger & intégrité `[S][MVP]`

- [ ] Timer + seed côté serveur ; aucune logique de note côté client ; rate-limit sur `submitAttempt`.
- [ ] Pas de proctoring (CNIL : proportionné, optionnel, alternative requise — documenté `08-CONFORMITE/04`). Marqué `[W][V2]` si jamais requis pour RNCP high-stakes.

---

# EPIC-08 — Certificats de réalisation e-learning

**Objectif** : certificat de réalisation au **modèle officiel** (heures réalisées, obligatoire depuis 01/06/2020), QR de vérification. Réutilise `DocumentGenere` + `@react-pdf/renderer`.

**EXISTANT** : `DocumentGenere` (5507) + `qrToken`, pipeline `@react-pdf/renderer`, templates `qualiopi-*`. **NEUF** : template e-learning, calcul heures FOAD.

### US-08-01 — Génération du certificat de réalisation `[M][MVP]`

**En tant qu'**apprenant, **je veux** obtenir mon certificat à la fin **afin de** prouver ma réalisation (OPCO/employeur).

- [ ] Déclenché quand `progressionPct=100%` (obligatoires) ET seuil global `ElearningCourse.seuilReussitePct` atteint.
- [ ] PDF via `@react-pdf/renderer` (nouveau template `src/components/elearning/pdf/CertificatRealisationFoad.tsx`), persiste un `DocumentGenere` + `qrToken` + archive R2.
- [ ] Contenu modèle officiel : intitulé action, **nombre d'heures réalisées** (heures en centièmes — aligné doctrine Qualiopi existante), dates, modalité FOAD, organisme (identité SSOT `lib/brand.ts`/legal-identity).
- [ ] **Logo Qualiopi INTERDIT** sur le certificat (règle existante attestations/PDF).

### US-08-02 — Vérification publique du certificat (QR) `[S][V1]`

- [ ] Route publique `[locale]/verifier-certificat/[qrToken]` confirme l'authenticité (réutilise le mécanisme QR existant). Aucune PII exposée au-delà du minimum.

### US-08-03 — Calcul des heures réalisées (FOAD) `[M][MVP]`

**En tant que** système, **je veux** calculer une durée réalisée défendable **afin de** remplir le certificat.

- [ ] Heures = `dureeEstimeeMinutes` du cours (information D.6313-3-1 §2) recoupée avec `LessonProgress.tempsTotalSec` (traces réelles) ; règle documentée dans `08-CONFORMITE/06`.
- [ ] Jamais le seul relevé de connexion (R.6313-3 : preuve par faisceau).

---

# EPIC-09 — Outil auteur (course builder)

**Objectif** : authoring **facile** — drag&drop sections→leçons, blocs mixés dans une leçon, upload média transcodé auto, aperçu as-student, brouillon→publication. MVP = CRUD fonctionnel ; V1 = drag&drop abouti + templates + clonage.

**EXISTANT** : `AdminPageShell`/`Header`/`StatCard`/`Table`/`Badge`, RBAC `requireAdmin*`, R2 upload, Formation Engine (modèle d'inspiration). **NEUF** : éditeur de structure + éditeur de blocs Tiptap.

### US-09-01 — CRUD cours/modules/leçons `[M][MVP]`

**En tant qu'**auteur, **je veux** créer/éditer la structure d'un cours **afin de** produire du contenu.

- [ ] Pages sous `[adminPrefix]/elearning/cours/*` (liste, création, édition). Server actions `src/server/elearning/authoring/actions.ts`, RBAC `requireAdminWrite`.
- [ ] Réordonnancement par drag&drop réécrit les `ordre` en **transaction** (respect `@@unique([courseId, ordre])` — décaler en bloc).
- [ ] Édition de tous les champs `ElearningCourse`/`Module`/`Lesson` (objectifs, prérequis, public visé, durées, unlock).

### US-09-02 — Éditeur de blocs riches (leçon texte) `[M][MVP]`

- [ ] Éditeur Tiptap (JSON dans `contenuJson`) : titres, paragraphes, listes, callouts, images (R2), embeds. Rendu serveur côté apprenant (sécurisé, sanitize).
- [ ] Blocs **mixés** dans une même leçon (best practice : pas un-type-par-leçon).

### US-09-03 — Upload média intégré `[M][MVP]`

- [ ] Upload vidéo (EPIC-04), PDF/images (R2 direct via `getSignedUploadUrlR2`), sous-titres. Barre de progression upload + état transcodage vidéo.

### US-09-04 — Aperçu « as-student » `[S][V1]`

- [ ] Prévisualisation du cours dans la peau de l'apprenant, y compris états de verrou (mode preview qui ignore le gating réel).

### US-09-05 — Brouillon → publication versionnée `[M][MVP]`

**En tant qu'**auteur, **je veux** publier quand c'est prêt **afin de** ne pas exposer un cours inachevé.

- [ ] `publishCourse(courseId)` : passe `statut=publie`, incrémente `version`, set `publishedAt` ; RBAC `requireAdminPublish`.
- [ ] Validations avant publication : ≥1 module, ≥1 leçon, durées renseignées (info FOAD), seuil cohérent.
- [ ] `archiveCourse` → `statut=archive` (conservé pour preuves, jamais supprimé — ADR-0008).

### US-09-06 — Clonage & templates de cours `[C][V1]`

- [ ] Dupliquer un cours/module comme point de départ ; bibliothèque de gabarits.

---

# EPIC-10 — Console admin e-learning (navigation, pilotage, apprenants)

**Objectif** : intégrer l'e-learning dans la console admin existante (nav, dashboard, gestion apprenants/accès/suivi).

**EXISTANT** : `src/lib/admin-nav.ts` (sidebar montée = **`AdminSidebarNav.tsx`** — pas `AdminSidebar.tsx`), `AdminPageShell`, RBAC. **NEUF** : section nav e-learning, pages de pilotage.

### US-10-01 — Pôle de navigation « E-learning » `[M][MVP]`

**En tant qu'**admin, **je veux** un pôle e-learning dans la sidebar **afin d'**accéder à toutes les fonctions.

- [ ] Ajout dans `admin-nav.ts` d'un pôle/section « E-learning » avec items : Cours, Apprenants, Accès & octrois, Import CSV, Banque de questions (V1), Certificats, Reporting (V1).
- [ ] Rendu via `AdminSidebarNav.tsx` (le composant réellement monté — leçon mémoire admin-nav).
- [ ] Visibilité par rôle (reader voit, editor édite, etc.).

### US-10-02 — Tableau de bord e-learning `[S][V1]`

- [ ] KPIs (`StatCard`) : cours publiés, apprenants actifs, taux de complétion moyen, certificats émis, alertes décrochage.

### US-10-03 — Gestion des apprenants `[M][MVP]`

- [ ] Liste `Learner` (`AdminTable`/`AdminBadge`) : email, entreprise, cours suivis, progression, dernier accès. Recherche/filtre.
- [ ] Fiche apprenant : enrollments, progression par cours, tentatives quiz, preuves FOAD, certificat.
- [ ] Actions RGPD (export/suppression) réutilisant `RgpdDemande`/`Trainee.deletedAt` quand `Learner.traineeId` existe.

### US-10-04 — Gestion des accès / octrois `[M][MVP]`

- [ ] Page octroi (manuel US-03-01, import US-03-03, révocation/prolongation US-03-04) avec journal des octrois.

---

# EPIC-11 — Conformité FOAD & traçabilité des preuves

**Objectif** : respecter Art. D.6313-3-1 (3 conditions cumulatives) + R.6313-3 (faisceau de preuves) + Qualiopi V8 indicateurs FOAD (1,6,9,10,**11-majeur**,12,17,19). **Non négociable** pour le financement OPCO.

**EXISTANT** : `EvaluationAcquis`, `Questionnaire`, `DocumentGenere`, mode auditeur Qualiopi, registre réclamations, référent handicap. **NEUF** : agrégation preuves FOAD, SLA assistance.

### US-11-01 — Assistance technique ET pédagogique (Ind.19) `[M][MVP]`

**En tant qu'**apprenant, **je veux** un canal d'aide avec délai annoncé **afin d'**être accompagné (condition D.6313-3-1 §1).

- [ ] Canal d'assistance (email/formulaire) accessible depuis le player ; **délais de réponse formalisés** affichés.
- [ ] Chaque sollicitation → `FoadAssistanceLog` (demande, réponse, `delaiReponseHeures`).
- [ ] SLA suivi côté admin (alerte si délai dépassé).

### US-11-02 — Information activités + durée moyenne (D.6313-3-1 §2) `[M][MVP]`

- [ ] Chaque cours affiche la **liste des activités** et la **durée moyenne** estimée (agrégée `dureeEstimeeMinutes`) avant et pendant le parcours.

### US-11-03 — Évaluations jalonnantes & concluantes (Ind.11 — MAJEUR) `[M][MVP]`

**En tant que** système, **je veux** des évaluations qui jalonnent ET concluent le parcours **afin d'**éviter la non-conformité majeure.

- [ ] Au moins une évaluation intermédiaire (quiz module) + une évaluation finale obligatoires sur un cours FOAD (`estFoad=true`).
- [ ] Validation à la publication (US-09-05) : refuse de publier un cours FOAD sans évaluation jalon + finale.
- [ ] Chaque évaluation produit un `EvaluationAcquis` (réutilisation existant) + `FoadProof type=evaluation`.

### US-11-04 — Faisceau de preuves de réalisation (R.6313-3) `[M][MVP]`

**En tant qu'**admin, **je veux** un dossier de preuves par apprenant **afin de** répondre à un contrôle OPCO/Qualiopi.

- [ ] Agrège : logs LMS (`LearningEvent`), évaluations, travaux rendus, snapshots progression, traces d'assistance, certificat.
- [ ] Le relevé de connexion **seul** n'est jamais présenté comme preuve suffisante (faisceau exigé).
- [ ] Export par enrollment (ZIP : PDF récap + pièces R2) — réutilise pattern ZIP `getObjectBufferR2`.

### US-11-05 — Conservation légale & rétention `[M][MVP]`

**En tant que** DPO, **je veux** conserver les preuves selon les durées légales **afin d'**être conforme RGPD.

- [ ] Calcul `FoadProof.conserveJusquA` selon nature : 10 ans comptable (L.123-22), 6 ans fiscal/OPCO (L.102B LPF), 3-5 ans preuves réalisation (L.6362-6), 6 mois–1 an logs techniques (CNIL 2021-122).
- [ ] Worker `elearning-retention-worker` (pattern `retention-purge-worker.ts`) purge à échéance ; aucune purge avant terme.

### US-11-06 — Certificat de réalisation conforme `[M][MVP]`

- [ ] Couvert par EPIC-08 (modèle officiel + heures réalisées). Listé ici pour la traçabilité conformité.

### US-11-07 — Export mode auditeur e-learning `[S][V1]`

- [ ] Extension du mode auditeur Qualiopi existant : vue read-only des cours/preuves/évaluations FOAD pour un auditeur.

---

# EPIC-12 — Emails apprenant & relances anti-décrochage

**Objectif** : emails de cycle de vie + relances automatiques (Qualiopi Ind.12 « engagement des bénéficiaires »).

**EXISTANT** : Nodemailer + React Email templates + `email-worker.ts` + `emailsQueue` + crons. **NEUF** : templates e-learning, scheduler relances.

### US-12-01 — Emails transactionnels apprenant `[M][MVP]`

- [ ] Templates React Email : invitation/octroi (magic-link), bienvenue, certificat obtenu, réponse d'assistance. Footer identité SSOT (SIREN/identité legal). Envoi via `emailsQueue`.
- [ ] Bouton bulletproof (compat Outlook), dark mode — aligné plan email existant.

### US-12-02 — Relances anti-décrochage `[S][V1]`

**En tant que** système, **je veux** relancer un apprenant inactif **afin de** soutenir l'engagement (Ind.12).

- [ ] Worker `elearning-engagement-worker` (cron) : détecte `derniereActiviteAt > N jours` sur enrollment actif non terminé → email de relance gradué (J+3, J+7, J+14).
- [ ] Chaque relance loggée comme trace d'accompagnement (`FoadAssistanceLog`/`LearningEvent`).
- [ ] Respecte `consentementEmail` (RGPD) ; lien désinscription.

### US-12-03 — Notifications de déverrouillage (drip date) `[C][V1]`

- [ ] Email « un nouveau module est disponible » quand un drip `date_fixe`/`offset_inscription` ouvre du contenu.

---

# EPIC-13 — Catalogue public & vitrine SEO

**Objectif** : V1 — vitrine publique des cours vendables, JSON-LD `Course`, respect strict des budgets Web Vitals (page publique).

**EXISTANT** : `lib/seo.ts` (factory JSON-LD), pricing.ts, patterns SSG/ISR. **NEUF** : pages catalogue.

### US-13-01 — Page catalogue & fiche cours publique `[S][V1]`

- [ ] `[locale]/formations-en-ligne/page.tsx` (liste) + `/[slug]/page.tsx` (fiche) ; ISR `revalidate`, early-exit stub.invalid (US-01-07).
- [ ] Affiche objectifs, prérequis, public visé, durée, prix (`pricing.ts`), modalité FOAD.
- [ ] First Load JS ≤ 75 KB gz ; LCP ≤ 1800 ms ; CLS = 0 (budgets stricts AGENTS.md).

### US-13-02 — JSON-LD `Course` + SEO/AEO `[S][V1]`

- [ ] Factory JSON-LD `Course`/`CourseInstance` via `lib/seo.ts` (pas hand-rollé) ; hreflang FR uniquement (EN désactivé) ; sitemap des cours publiés.

---

# EPIC-14 — IA pédagogique (quiz-gen + tuteur RAG)

**Objectif** : V1 — génération de quiz depuis le contenu + tuteur RAG **ancré avec citations** (réutilise knowledge/RAG existant). Provider = `@anthropic-ai/sdk` (Claude) déjà en place.

**EXISTANT** : Formation Engine (`qualiopi-formation-engine-worker.ts` : intention→structure→`evaluateQuality`→refine→`runAdversarialCritique`), `CacheIa`, knowledge/RAG, `@anthropic-ai/sdk`. **NEUF** : quiz-gen, tuteur ancré e-learning.

### US-14-01 — Génération de quiz assistée par IA `[C][V1]`

**En tant qu'**auteur, **je veux** générer un brouillon de quiz depuis une leçon **afin de** gagner du temps.

- [ ] Worker `elearning-quiz-gen-worker` (Claude via `@anthropic-ai/sdk`) : à partir de `contenuJson`/transcript, propose questions + rationale ; **brouillon validé par l'auteur** avant publication (jamais auto-publié).
- [ ] Anti-hallucination : questions ancrées sur le contenu source ; critique adversariale réutilisée du Formation Engine.

### US-14-02 — Tuteur RAG ancré avec citations (Ind.19) `[C][V1]`

**En tant qu'**apprenant, **je veux** poser une question et obtenir une réponse sourcée **afin d'**être aidé pédagogiquement.

- [ ] Réponses **ancrées** sur le contenu du cours + base knowledge existante, avec **citations** (jamais un wrapper ChatGPT nu — anti-pattern interdit).
- [ ] Chaque échange logué `FoadAssistanceLog canal=tuteur_ia` (compte comme assistance Ind.19).
- [ ] Garde-fous : refuse hors-sujet ; escalade vers humain si non résolu.

---

# EPIC-15 — E-commerce (commandes + Stripe gated)

**Objectif** : ADR-0004. MVP = virement + octroi manuel (modèle `ElearningOrder` posé). V1 = activation CB Stripe (`STRIPE_ENABLED=true`) sans refonte.

**EXISTANT** : `Invoice`/`Payment`/`Refund`/webhook Stripe, flag `STRIPE_ENABLED` (env.ts ~103-115), `src/lib/stripe.ts`, pricing.ts. **NEUF** : tunnel d'achat, octroi post-paiement.

### US-15-01 — Commande virement + octroi manuel `[M][MVP]`

- [ ] Création `ElearningOrder` (`modePaiement=virement`, `statut=en_attente_paiement`) ; à réception du virement, admin clique « marquer payée » → octroi automatique des accès (US-03-01) + `statut=octroyee`.
- [ ] Génère `Invoice` (existant) exonérée TVA si applicable (réutilise logique facturation formation).

### US-15-02 — Tunnel d'achat CB (activable) `[S][V1]`

- [ ] Tunnel `[locale]/formations-en-ligne/[slug]/commander` ; quand `STRIPE_ENABLED=true`, paiement CB via `stripe.ts` + webhook → `ElearningOrder.statut=payee` → octroi auto.
- [ ] Quand `STRIPE_ENABLED=false` (défaut) : CB masquée, seul le virement est proposé. Aucune refonte pour basculer.

### US-15-03 — Packs entreprise (N sièges) `[S][V1]`

- [ ] `ElearningOrderItem.quantite` = sièges ; à l'octroi, l'admin importe N apprenants (US-03-03) rattachés au `clientId`.

---

# EPIC-16 — Banque de questions & tirage aléatoire

**Objectif** : V1 — banque réutilisable + tirage N parmi M + tous types de questions.

### US-16-01 — Banque de questions `[S][V1]`

- [ ] Modèle `QuizQuestionBank` (catégorie, tags) ; `QuizQuestion.banqueQuestionId` lie une question à la banque. Réutilisation dans plusieurs quiz.
- [ ] CRUD admin sous `[adminPrefix]/elearning/banque-questions`.

### US-16-02 — Tirage aléatoire & variabilité `[S][V1]`

- [ ] Couvert par US-07-05 (tirage N) + US-07-04 (shuffle). Chaque tentative tire un sous-ensemble distinct, reproductible via `seedAleatoire`.

---

# EPIC-17 — Reporting, analytics & exports conformité

**Objectif** : V1 — completion, temps, scores, engagement + exports conformité OPCO/Qualiopi.

### US-17-01 — Analytics d'engagement `[S][V1]`

- [ ] Vues admin : taux de complétion par cours/module, temps moyen, distribution des scores, courbe d'abandon (depuis `LearningEvent`/`LessonProgress`).

### US-17-02 — Exports conformité `[M][V1]`

- [ ] Export CSV/PDF par session/cours/entreprise : assiduité, évaluations, certificats, preuves — directement utilisable pour un dossier OPCO ou un audit Qualiopi.

### US-17-03 — Reporting par entreprise (avant multi-tenant) `[S][V1]`

- [ ] Filtre par `clientId` : progression des apprenants d'une entreprise (côté admin Axion-IA — l'auto-service entreprise = V2).

---

# EPIC-18 — Accessibilité WCAG 2.2 AA & Web Vitals

**Objectif** : transversal. Obligation légale UE (EAA depuis 28/06/2025) + budgets Web Vitals internes (LCP ≤ 1800, INP ≤ 100, CLS = 0). Risque INP fort sur le player + le calendrier.

### US-18-01 — Conformité WCAG 2.2 AA `[M][MVP]`

- [ ] Critères ciblés : 2.4.11 (focus non masqué), 2.5.7 (alternative au drag pour appariement/ordonnancement), 2.5.8 (cibles ≥ 24px), 3.3.8 (auth accessible — déjà US-02-02).
- [ ] Sous-titres, navigation clavier complète (player + quiz), focus visibles, contrastes AA, libellés (pas d'info par couleur seule).
- [ ] Audit axe-core intégré aux tests sur les pages apprenant clés.

### US-18-02 — Budgets Web Vitals respectés `[M][MVP]`

- [ ] Player et quiz en client-JS minimal (lazy, code-split) ; INP ≤ 100 ms sur la passation de quiz et la lecture vidéo.
- [ ] Pages publiques catalogue : First Load ≤ 75 KB gz, CLS = 0. Lighthouse CI (`pnpm lhci`) vert ; `size-limit` < +5 KB gz vs main (gate PR).
- [ ] Tout dépassement = STOP & ASK Will + ADR (règle AGENTS.md).

### US-18-03 — Mobile-first & anti-patterns évités `[M][MVP]`

- [ ] Pas d'autoplay, pas de classement imposé, pas de pacing rigide self-paced, pas de gating attempt-only, pas un-type-par-leçon, pas d'auto-hébergement vidéo, pas de sur-DRM.

---

# EPIC-19 — Multi-tenant entreprise (espaces cloisonnés) `[V2]`

**Objectif** : ADR-0002. Conçu maintenant (clés `clientId` déjà au schéma), **livré en V2** : espaces cloisonnés, admin entreprise délégué, branding, reporting par organisation, SSO/SCIM.

### US-19-01 — Scoping par tenant `[M][V2]`

- [ ] Toutes les requêtes apprenant/reporting filtrées par `clientId` (tenant) ; garde `requireLearner` enrichi du tenant ; tests d'isolation (un tenant ne voit jamais les données d'un autre).

### US-19-02 — Admin entreprise délégué `[S][V2]`

- [ ] Rôle `tenant_admin` (distinct des `AdminUser` Axion-IA) : gère ses équipes, ouvre/retire des accès sur ses sièges, voit son reporting.

### US-19-03 — Branding & reporting par organisation `[C][V2]`

- [ ] Logo/couleurs par `Client` ; tableau de bord cloisonné.

### US-19-04 — SSO / SCIM entreprise `[W][V2]`

- [ ] Provisioning automatique (SCIM) + SSO (SAML/OIDC) — uniquement si demande commerciale concrète.

---

# EPIC-20 — CPF / EDOF activable + standards (SCORM/xAPI) `[V2]`

**Objectif** : ADR-0003/0006. Tout est « certification-ready » dès le MVP ; l'activation CPF/EDOF est un **flag** (`EDOF_ENABLED`), conditionnée à une certification RNCP/RS (hors code, France Compétences). Standards seulement si besoin commercial.

### US-20-01 — Activation EDOF derrière flag `[S][V2]`

- [ ] `EDOF_ENABLED=false` par défaut ; quand activé : entrée effective (1re connexion substantielle = `ElearningEnrollment.entreeEffectiveAt`), suivi assiduité, service fait, FranceConnect+ obligatoire, conformité loi anti-fraude 2022-1587.
- [ ] **Bloqué** tant qu'aucune certification RNCP/RS (garde explicite + message admin).

### US-20-02 — Évaluation à distance certifiante `[C][V2]`

- [ ] Pour RNCP/RS : garantir identité + anti-fraude + absence d'assistance pendant l'épreuve (proctoring **optionnel**, alternative requise — CNIL).

### US-20-03 — Import SCORM/cmi5 + émetteur xAPI `[W][V2]`

- [ ] Si appel d'offres entreprise : import SCORM/cmi5 + émission xAPI vers un LRS. La grammaire `LearningEvent` (US-01-02) rend cet ajout non-bloquant.

---

## Récapitulatif priorisation MVP (chemin critique)

Ordre d'implémentation MVP (chaque lot dépend du précédent — cf. `01-phasage-mvp-v1-v2.md`) :

1. EPIC-01 (data model) → 2. EPIC-02 (auth) → 3. EPIC-03 (octroi/import) → 4. EPIC-04 (vidéo) → 5. EPIC-05 (player/progression) → 6. EPIC-06 (déverrouillage) → 7. EPIC-07 (quiz) → 8. EPIC-08 (certificat) → 9. EPIC-09 (outil auteur min) → 10. EPIC-10 (console admin) → 11. EPIC-11 (FOAD, transversal câblé dès le data model) + EPIC-12/18 transversaux.

**Critère de sortie MVP** : un apprenant reçoit un accès, suit le cours, est bloqué tant qu'il n'a pas réussi le quiz au seuil, obtient un certificat de réalisation ; l'admin ouvre des accès en masse ; toutes les preuves FOAD sont produites et exportables (Ind.11 + Ind.19 satisfaits).

---

## Liens

- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-0001 à 0008 (décisions figées référencées par chaque epic)
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — modèles `ElearningCourse/Module/Lesson/Resource` (EPIC-01)
- `03-DATA-MODEL/02-schema-progression-tracking.md` — `ElearningEnrollment`, `LessonProgress`, `LearningEvent` (EPIC-01/05)
- `03-DATA-MODEL/03-schema-quiz-evaluations.md` — `Quiz`, `QuizQuestion`, `QuizAttempt` (EPIC-01/07)
- `03-DATA-MODEL/04-schema-comptes-acces-auth.md` — `Learner`, `LearnerSession` (EPIC-02)
- `03-DATA-MODEL/05-schema-ecommerce-commandes.md` — `ElearningOrder` (EPIC-15)
- `03-DATA-MODEL/06-strategie-migrations.md` — migrations additives (EPIC-01)
- `04-BACKEND/05-authentification-apprenant.md` — détail auth (EPIC-02)
- `04-BACKEND/06-import-masse-provisioning.md` — import CSV (EPIC-03)
- `04-BACKEND/07-pipeline-video-streaming.md` — Cloudflare Stream (EPIC-04)
- `04-BACKEND/08-ia-pedagogique-generation.md` / `09-tuteur-rag-assistant.md` — IA (EPIC-14)
- `05-FRONTEND-APPRENANT/02-lecteur-cours-player.md` / `03-moteur-quiz-ui.md` / `04-progression-deverrouillage.md` — UI (EPIC-05/06/07)
- `06-CONSOLE-ADMIN/03-outil-auteur-course-builder.md` — authoring (EPIC-09)
- `08-CONFORMITE/01-foad-d6313-3-1.md` … `06-tracabilite-preuves-realisation.md` — conformité (EPIC-11/20)
- `11-ROADMAP/01-phasage-mvp-v1-v2.md` — phasage (source du tagging MVP/V1/V2)
- `11-ROADMAP/03-estimation-charges.md` — charges par epic (à rédiger)
- `11-ROADMAP/04-risques-mitigations.md` — risques (à rédiger)
  </content>
  </invoke>
