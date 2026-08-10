# Audit adversarial — Complétude & cohérence du dossier LMS e-learning

> **Rôle de ce document.** Revue adversariale de **complétude** du dossier `_LMS-ELEARNING/` (61 fichiers, ~1,3 Mo de specs) contre la mission produit (LMS/FOAD propriétaire, niveau pro juin 2026) **et** contre le code réel d'Axion-IA (`prisma/schema.prisma`, `src/lib/r2-storage.ts`, `src/server/qualiopi/portail/*`, `src/lib/admin-nav.ts`, `src/env.ts`, `src/auth.ts`). Objectif : lister **tout ce qui manque ou est sous-spécifié** — feature oubliée, modalité, route, cas limite, persona, contrat applicatif divergent — de façon **actionnable**, classée par gravité, avec le **doc cible** à corriger.
>
> **Méthode.** Lecture des docs socle (00-INDEX, 03-DATA-MODEL/01-06, 07-ROUTES, 01-VISION/personas) + sondage ciblé des autres docs (04-BACKEND, 05-FRONTEND, 06-CONSOLE, 08-CONFORMITE, 09-QUALITE) + vérification ligne-à-ligne sur le code. Les numéros de ligne `schema.prisma` cités dans les docs ont été **vérifiés exacts** (Trainee:5274, Enrollment:5310, Client:4890, PortailAcces:6236, DocumentGenere:5507, EvaluationAcquis:5653, Invoice:1695, Payment:1644, Refund:1761, Booking:799, AdminUser:1526, Formation:5061, FactureFormation:5760, FormateurMagicLink:6601).
>
> **Verdict global.** Le dossier est **remarquablement complet et bien ancré** : les 5 docs data-model, les routes, les personas, la conformité FOAD et l'accessibilité sont d'un niveau « équipe senior ». La majorité des « trous » qu'on pourrait soupçonner (satisfaction e-learning, déclaration d'accessibilité, attestation partielle pour apprenant non-réussi, contrat de blocs `contenuJson`, badges, versionnage de cours) sont **déjà traités** (cf. §6 « Fausses alertes vérifiées »). **Le risque dominant n'est PAS l'absence de specs — c'est l'INCOHÉRENCE INTER-DOCUMENTS** : plusieurs docs nomment différemment le **même** modèle, worker, enum ou fichier. Un dev qui copie depuis le « mauvais » doc casse la migration ou le build. C'est l'objet des sections P0/P1.
>
> Dernière mise à jour : 2026-06-27.

---

## 0. Tableau de synthèse (gravité × action)

| #   | Gravité         | Sujet                                                     | Symptôme                                                                                                                                                                                   | Doc(s) cible à corriger                            |
| --- | --------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| C1  | **P0 BLOQUANT** | Type de PK `text` vs `@db.Uuid`                           | Docs 01/02/03 montrent des snippets `String @id @default(uuid())` (=`text`) ; doc 06 **tranche `@db.Uuid` partout**. Les snippets canoniques restent faux.                                 | 01, 02, 03 (bannière + correction)                 |
| C2  | **P0 BLOQUANT** | Deux modèles concurrents d'appartenance entreprise        | `ElearningOrgMembership` (doc 04) **vs** `ElearningCompanyMembership` (personas) — enums de rôles différents + `Trainee.elearningRole` qui n'existe que dans personas                      | 04 (SSOT) + personas (aligner)                     |
| C3  | **P0 BLOQUANT** | Registre des workers non canonique                        | Le même worker porte 2-4 noms : `certificat`/`certificate`, `relance`/`reminders`, `provisioning`/`import`/`access`, `grant`/`order-expiry`                                                | 04-BACKEND/03 (devenir SSOT)                       |
| C4  | **P1 majeur**   | Enum `QuestionType` divergent                             | Doc 03 = 12 types (dont `texte_a_trous`, `menu_deroulant`, `numerique`, `zone_cliquable`) ; doc 06 = 9 types, renomme `texte_trous`, **droppe 3 types**                                    | 06 (corriger la liste)                             |
| C5  | **P1 majeur**   | Enum statut commande divergent                            | `en_attente_virement` (routes P4) **vs** `en_attente_paiement` (doc 05 = SSOT)                                                                                                             | 07-ROUTES                                          |
| C6  | **P1 majeur**   | Table de rattachement tuteur↔apprenant manquante          | Référencée (personas §9.4 « à modéliser doc 02 », doc 06 cite `elearning_tutor_rag`) mais **absente de tout data-model** ; bloque le scoping formateur externe (P3)                        | 02 (ajouter le modèle)                             |
| C7  | **P1 majeur**   | Arborescence des Server Actions incohérente               | `src/server/elearning/actions/*.ts` (routes) vs `.../orders/actions.ts` (doc 05) vs co-located `quiz/actions.ts` (doc 03) vs `progress-actions.ts` (doc 02)                                | 04-BACKEND/02 (fixer la convention)                |
| C8  | **P1 majeur**   | Noms des guards/fichiers auth apprenant divergents        | `learner-auth-service.ts`+`learner-guard.ts` (04) vs `learner-session.ts` (routes) vs `auth/guards.ts`+`admin-guards.ts` (personas)                                                        | 04-BACKEND/05 (SSOT)                               |
| G1  | **P1 gap**      | Variables d'env vidéo absentes de `src/env.ts`            | `STRIPE_ENABLED`/`IP_HASH_SALT` existent ; **aucune** clé Cloudflare Stream/Bunny, `EDOF_ENABLED`, `LEARNER_PASSWORD_ENABLED`, `LMS_TUTOR_ENABLED`                                         | 04-BACKEND/07 + 06-strategie-migr. (checklist env) |
| G2  | **P2 gap**      | Re-octroi d'un accès expiré/révoqué non spécifié          | `@@unique([courseId,traineeId])` empêche un 2e `ElearningEnrollment` ; le re-grant d'un accès `expire`/`revoque` (nouvel `expiresAt`) n'est pas décrit (import = `ALREADY_ENROLLED` no-op) | 02 + 04-BACKEND/06                                 |
| G3  | **P2 gap**      | Politique de re-validation après republication d'un cours | Doc auteur dit « apprenant en cours garde l'accès ; politique de re-validation = doc 05-04 » mais doc 05-04 ne la formalise pas                                                            | 05-FRONTEND/04                                     |
| G4  | **P2 gap**      | Progression multi-appareils (conflit de reprise)          | `dernierePositionSec`/`percentVu` écrits par 2 sessions simultanées du même `Trainee` — règle de fusion non spécifiée                                                                      | 02 + 05-FRONTEND/02                                |
| G5  | **P2 gap**      | Leçons « aperçu gratuit » (preview marketing)             | Pas de flag de prévisualisation publique d'1-2 leçons sur la fiche catalogue (levier de conversion standard 2026)                                                                          | 01 + 05-FRONTEND/07                                |
| G6  | **P2 gap**      | Observabilité des nouveaux workers/routes                 | Aucune mention Sentry/monitoring pour les workers `elearning-*` ni le heartbeat (le repo utilise déjà Sentry)                                                                              | 04-BACKEND/03 + 09-QUALITE/02                      |
| G7  | **P2 gap**      | Accessibilité de l'outil auteur (admin)                   | WCAG 2.5.7 (alternative au drag) est spécifié côté apprenant ; le **drag&drop du course-builder admin** n'a pas d'alternative clavier documentée                                           | 06-CONSOLE/03 + 09-QUALITE/04                      |
| G8  | **P3 gap**      | Sous-titres : workflow d'authoring VTT                    | B4 « captions » en lecture (V1) mais **qui produit le `.vtt`** (upload auteur ? auto-transcription Stream ?) non décrit ; or sous-titres = obligation WCAG                                 | 04-BACKEND/07 + 06-CONSOLE/03                      |
| G9  | **P3 gap**      | Accessibilité intrinsèque `zone_cliquable`                | Question hotspot = 100 % visuelle ; alternative non-visuelle (2.1.1/1.1.1) non spécifiée → risque non-conformité                                                                           | 03 + 05-FRONTEND/03                                |
| G10 | **P3 gap**      | Recherche & notifications in-app                          | « recherche » (catalogue/mes cours) et un **centre de notifications** in-app évoqués mais non spécifiés (notifications = email only)                                                       | 05-FRONTEND/01                                     |
| G11 | **P3 gap**      | Délivrabilité email transactionnel apprenant              | Volume d'emails d'accès/relance via Nodemailer maison ; SPF/DKIM/bounce/throttle non traités                                                                                               | 04-BACKEND/10                                      |

---

## 1. P0 — Incohérences bloquantes (à trancher AVANT toute écriture de code)

### C1 — Type des PK LMS : `text` vs `@db.Uuid` (snippets canoniques faux)

**Constat.** Trois docs data-model présentent leurs modèles avec une PK **`String @id @default(uuid())`** (colonne Postgres `text`) :

- `03-DATA-MODEL/01` (ElearningCourse/Module/Lesson/Resource) ;
- `03-DATA-MODEL/02` qui **insiste** : « réutilise ElearningCourse, doc 01 — **PK text** » et FK-vers-LMS en `text` ;
- `03-DATA-MODEL/03` §2 qui en fait une **« convention critique à respecter à la lettre »** (PK LMS `text`).

Or `03-DATA-MODEL/06-strategie-migrations.md` §1.3 **tranche l'inverse** :

> « **Tout le domaine e-learning utilise `@db.Uuid`** — PK _et_ FK […]. C'est l'arbitrage de ce doc — il corrige les snippets `text` des docs 01/02/03 et débloque la FK `Invoice.orderId @db.Uuid → ElearningOrder.id`. »

**Pourquoi c'est P0.** Les docs 01/02/03 sont les **sources de copie** d'un dev qui écrit `schema.prisma`. S'il copie tel quel, il crée des colonnes `text`, puis :

- la FK `Invoice.orderId @db.Uuid → ElearningOrder.id (text)` **échoue** (mismatch de type Prisma/Postgres) ;
- l'index `@db.Uuid` (16 o B-tree) attendu par doc 06 n'est pas créé.
  La décision est correcte (homogénéité avec les ~7 300 lignes existantes toutes en `@db.Uuid`) **mais elle n'est pas répercutée** dans les fichiers que le dev lit en premier. Pire : les §2 de doc 03 et la note de typage de doc 02 contiennent désormais des **avertissements faux** (« ne pas mettre `@db.Uuid` sur les FK intra-LMS ») qui contredisent frontalement l'arbitrage.

**Action.**

1. Ajouter en **tête** des docs 01, 02, 03 un encadré : « ⚠️ PK/FK : voir l'arbitrage `06-strategie-migrations.md` §1.3 — **tout le domaine e-learning est en `@db.Uuid`** ; les snippets ci-dessous en `String @id @default(uuid())` doivent être lus avec `@db.Uuid` ajouté sur la PK et toutes les FK intra-LMS. »
2. Idéalement, **corriger mécaniquement** les snippets (ajout du token `@db.Uuid`) pour éliminer le risque de copie. Supprimer/réécrire les §2 (doc 03) et la note de typage (doc 02) qui prescrivent le `text`.

### C2 — Deux modèles concurrents pour l'appartenance entreprise

Le **même concept** (lien apprenant ↔ entreprise, base du multi-tenant V2) est modélisé **deux fois, différemment** :

| Aspect           | `03-DATA-MODEL/04` (auth)                                     | `01-VISION/personas-roles.md` §8.2                                     |
| ---------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Modèle           | `ElearningOrgMembership`                                      | `ElearningCompanyMembership`                                           |
| Table            | `elearning_org_memberships`                                   | `elearning_company_memberships`                                        |
| Enum rôle        | `ElearningOrgRole { membre, manager, org_admin }`             | `ElearningCompanyRole { member, client_manager, client_admin }`        |
| Statut siège     | `ElearningOrgMembershipStatut { active, suspended, revoked }` | _(absent)_                                                             |
| Rôle sur Trainee | _(absent — rôle porté par l'appartenance)_                    | `Trainee.elearningRole : ElearningLearnerRole { learner }` **en plus** |
| Champs           | `invitedByAdminId`, `accesDebut/accesFin`                     | `teamId` (ElearningTeam V2)                                            |

**Pourquoi c'est P0.** Deux migrations contradictoires, deux noms de table, deux enums de rôles avec des **valeurs littérales différentes** (`membre` vs `member`, `manager` vs `client_manager`, `org_admin` vs `client_admin`). Les guards (`requireClientAdmin`) et le scoping V2 ne peuvent pas être écrits tant que ce n'est pas unifié. De plus, `Trainee.elearningRole` (personas) est un champ supplémentaire que doc 04 **n'ajoute pas** — un dev suivant doc 04 oubliera ce champ, un dev suivant personas créera une colonne non prévue par la migration de doc 04.

**Action.** Désigner **doc 04 comme SSOT** (il est le plus détaillé : statut de siège, invitations, import). Réécrire personas §8.2 pour pointer `ElearningOrgMembership`/`ElearningOrgRole`. Trancher la question `Trainee.elearningRole` : recommandé **de NE PAS l'ajouter** (rôle apprenant mono-valeur inutile ; le rôle entreprise vit sur l'appartenance) → supprimer de personas, ou l'ajouter explicitement à doc 04 si on veut un futur rôle « mentor ».

### C3 — Pas de registre canonique des workers/queues

Le **même worker** est nommé différemment selon le doc qui le cite :

| Fonction                          | Doc 02 (progression)               | Doc 04 (auth)                                         | Doc 05 (e-commerce)                                        | Doc 07 (routes)                | Personas                        |
| --------------------------------- | ---------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------- | ------------------------------ | ------------------------------- |
| Provisioning / octroi de masse    | —                                  | `elearning-import-worker` + `elearning-invite-worker` | —                                                          | `elearning-access-worker`      | `elearning-provisioning-worker` |
| Émission certificat               | `elearning-certificat-worker`      | —                                                     | —                                                          | `elearning-certificate-worker` | `elearning-certificat-worker`   |
| Relance anti-décrochage           | `elearning-relance-worker`         | —                                                     | —                                                          | `elearning-reminders-worker`   | `elearning-relance-worker`      |
| Expiration commande / octroi auto | —                                  | —                                                     | `elearning-order-expiry-worker` + `elearning-grant-worker` | (octroi via access-worker)     | —                               |
| Rollup progression                | `elearning-progress-rollup-worker` | —                                                     | —                                                          | —                              | `elearning-progress-worker`     |
| Purge xAPI                        | `elearning-xapi-purge-worker`      | —                                                     | —                                                          | —                              | —                               |

Vérifié par grep : `certificat-worker` apparaît dans 12 fichiers, `certificate-worker` dans 9 ; `relance-worker` dans 13, `reminders-worker` dans 2. **Les deux orthographes coexistent dans le dossier.**

**Pourquoi c'est P0.** La convention impose `src/server/queue/workers/elearning-*-worker.ts` + déclaration unique dans `queues.ts`/`worker.ts`. Deux noms = deux fichiers = double traitement (double email de certificat, double octroi). Le mix FR (`certificat`, `relance`) / EN (`certificate`, `reminders`) doit être tranché.

**Action.** Faire de **`04-BACKEND/03-workers-bullmq-crons.md` le SSOT** : un tableau unique `{ nom de worker, queue, déclencheur, idempotence, gating }`. Recommandation de nommage (FR cohérent avec le repo `qualiopi-*`) : `elearning-provisioning-worker` (octroi/import/invite fusionnés), `elearning-progress-rollup-worker`, `elearning-certificat-worker`, `elearning-relance-worker`, `elearning-video-worker`, `elearning-order-worker` (expiry+grant), `elearning-xapi-purge-worker`, `elearning-ai-worker`. Tous les autres docs **référencent** ce tableau, n'inventent plus de nom.

---

## 2. P1 — Incohérences majeures & gaps structurants

### C4 — Enum `QuestionType` : 12 valeurs (doc 03) vs 9 (doc 06)

`03-DATA-MODEL/03` §3 définit **12 types** : `qcm_mono, qcm_multi, vrai_faux, appariement, texte_a_trous, menu_deroulant, ordonnancement, reponse_courte, numerique, essai, upload, zone_cliquable`.
`03-DATA-MODEL/06` (ligne ~115, récap des enums) liste **9 types** : `qcm_mono qcm_multi vrai_faux appariement texte_trous ordonnancement reponse_courte essai upload` — il **renomme** `texte_a_trous → texte_trous` et **droppe** `menu_deroulant`, `numerique`, `zone_cliquable`.

**Impact.** La mission exige « ~12 types ». Si la migration suit doc 06, on perd 3 types (dont `numerique`, pourtant courant pour de l'IA/data) et le scoring de doc 03 (`question-payloads.ts` shapes §5) référence des valeurs inexistantes dans l'enum. **Action.** Aligner doc 06 sur les **12 valeurs de doc 03** (doc 03 fait foi pour le moteur quiz) ; garder l'orthographe `texte_a_trous`.

### C5 — Statut de commande : `en_attente_virement` vs `en_attente_paiement`

`07-ROUTES` (note P4) : « crée une commande `ElearningOrder` […] statut `en_attente_virement` ». Or l'enum `ElearningOrderStatut` (doc 05, SSOT e-commerce) **ne contient pas** `en_attente_virement` ; il a `en_attente_paiement`. **Action.** Corriger doc 07 → `en_attente_paiement` (+ `paymentMode = virement`).

### C6 — Table de rattachement tuteur ↔ apprenant : référencée, jamais modélisée

Le formateur externe (persona P3) doit voir **ses** apprenants tutorés ; le guard `requireFormateurElearning()` (personas §8.3) « scope les apprenants à ceux qui lui sont assignés (**table de rattachement tuteur↔enrollment [NEUF, V1]**) ». Cette table est **listée comme décision ouverte** (personas §9.4 : « modéliser dans `03-DATA-MODEL/02` ») mais **doc 02 ne la contient pas**. Doc 06 mentionne un `elearning_tutor_rag` (tuteur IA, autre chose).

**Impact.** Sans ce modèle, le tutorat humain FOAD (Qualiopi **Ind.19** — _seule obligation FOAD nommée_) n'a pas de support de données : impossible d'attribuer un tuteur, de tracer les délais d'assistance formalisés, de scoper la correction manuelle des `essai`/`devoir`. **Action.** Ajouter à doc 02 un modèle `ElearningTutorAssignment { tutorId(Trainer @db.Uuid), enrollmentId, slaHeures?, createdAt }` (V1) + les traces d'échange (ou réutiliser un fil de messages). À articuler avec `04-BACKEND/09` (tuteur RAG) et `08-CONFORMITE/02` (Ind.19).

### C7 — Arborescence des Server Actions non unifiée

Quatre conventions coexistent :

- `07-ROUTES` : `src/server/elearning/actions/*.ts` (plat : `progress.ts`, `quiz.ts`, `auth.ts`, `order.ts`, `admin-course.ts`…).
- `03-DATA-MODEL/02` : `src/server/elearning/actions/progress-actions.ts` (suffixe `-actions`).
- `03-DATA-MODEL/03` : actions **co-localisées** `src/app/[locale]/(admin)/[adminPrefix]/elearning/quiz/actions.ts` + services `src/server/elearning/quiz/*`.
- `03-DATA-MODEL/05` : `src/server/elearning/orders/actions.ts` (par sous-domaine).

**Impact.** Un dev ne sait pas où déposer une action. **Action.** Trancher dans `04-BACKEND/02-server-actions.md` (probable SSOT) : recommandé **par sous-domaine** `src/server/elearning/<domaine>/actions.ts` (cohérent avec doc 05) + interdiction des actions co-localisées sous `app/**` (contraire au cloisonnement ADR-0007). Mettre à jour 02/03/07.

### C8 — Noms des fichiers/guards d'auth apprenant divergents

| Élément         | Doc 04                                                    | Doc 07               | Personas                                                             |
| --------------- | --------------------------------------------------------- | -------------------- | -------------------------------------------------------------------- |
| Service session | `learner-auth-service.ts`                                 | `learner-session.ts` | —                                                                    |
| Guard           | `learner-guard.ts` (`requireLearner`/`getLearnerSession`) | —                    | `auth/guards.ts` (`requireLearner`) + `admin-guards.ts`              |
| Wrappers admin  | —                                                         | —                    | `auth/admin-guards.ts` (`requireElearningRead/Author/Publish/Admin`) |

**Action.** Geler dans `04-BACKEND/05-authentification-apprenant.md` : `src/server/elearning/auth/learner-auth-service.ts`, `learner-guard.ts`, `admin-guards.ts`. Corriger doc 07 (`learner-session.ts`) et personas (`auth/guards.ts`).

### G1 — Variables d'environnement neuves non déclarées dans `src/env.ts`

Vérifié dans le code : `src/env.ts` contient **`STRIPE_ENABLED`** (~105) et **`IP_HASH_SALT`** (~249) mais **AUCUNE** des nouvelles clés exigées par les docs :

- vidéo (ADR-0005) : `CLOUDFLARE_STREAM_*` (account id, API token, signing key, webhook secret) **/** Bunny — **aucune trace dans `src/`** (grep vide), confirmant que le pipeline vidéo est 100 % neuf ;
- flags référencés par doc 07 §8 : `EDOF_ENABLED`, `LEARNER_PASSWORD_ENABLED`, `LMS_TUTOR_ENABLED` — **inexistants**.

**Contrainte build `stub.invalid` (ADR-0026).** Toute clé ajoutée doit respecter le contrat : `SKIP_ENV_VALIDATION=true` en GH Actions ne doit pas casser ; les secrets prod absents au build doivent être **optionnels au build** (les pages vidéo sont derrière auth + `force-dynamic`, donc jamais appelées au SSG → OK, mais la validation Zod de `env.ts` ne doit pas les rendre `required` inconditionnellement).

**Action.** Ajouter à `06-strategie-migrations.md` (ou `04-BACKEND/07`) une **checklist env.ts** : clés Stream/Bunny + 3 flags, avec leur statut Zod (optionnelles au build, requises au runtime si la feature est activée), et la note stub-aware. Préciser le **provider vidéo retenu par défaut** (ADR-0005 dit « Cloudflare Stream par défaut, Bunny si résidence UE ») et **figer un seul** pour le MVP afin de ne pas coder deux intégrations.

---

## 3. P2 — Gaps fonctionnels & cas limites

### G2 — Re-octroi d'un accès expiré/révoqué

`ElearningEnrollment` porte `@@unique([courseId, traineeId])`. L'import (doc 06) traite un email déjà inscrit comme `ALREADY_ENROLLED` (no-op). **Non spécifié** : que se passe-t-il si l'enrollment existant est `expire`/`revoque` et qu'on veut **rouvrir** l'accès (nouvelle `expiresAt`, nouveau pack entreprise) ? Création impossible (unique) → il faut une **réactivation** explicite (`statut → actif`, reset `expiresAt`, trace). **Action.** Spécifier dans doc 02 (`grant-access`/`access-lifecycle`) + doc 06 (cas import `REACTIVATE` distinct de `ALREADY_ENROLLED`).

### G3 — Re-validation après republication d'un cours

Doc auteur (06-CONSOLE/03 §12.3) : « `version++` à chaque publication ; un apprenant en cours garde l'accès ; **politique de re-validation des modules impactés = doc `05-FRONTEND/04`** ». Mais doc 05-04 ne formalise pas cette politique. Cas réels non tranchés : une leçon obligatoire **ajoutée** après complétion (le cours redevient-il incomplet ? le certificat émis reste-t-il valide ?) ; une question de quiz de gating **modifiée** (faut-il re-tester ?) ; une leçon **supprimée** dont un `LessonProgress` existe. **Action.** Ajouter à `05-FRONTEND/04` une matrice « type de changement × effet sur progression/certificat existants » (recommandé : les certificats déjà émis sont **immuables** = preuve figée ; les apprenants en cours suivent la nouvelle structure mais leur complétion acquise n'est jamais régressée).

### G4 — Progression multi-appareils (conflit de reprise)

`LessonProgress.dernierePositionSec`/`percentVu`/`tempsPasseSec` peuvent être écrits par **deux sessions `PortailAcces` du même `Trainee`** (mobile + desktop). Doc 02 dit `percentVu` monotone et `tempsPasseSec` plafonné, mais ne décrit pas la **résolution de concurrence** (last-write-wins sur `dernierePositionSec` ? max sur `maxPositionSec` ?). **Action.** Préciser dans doc 02 §4 (règles de service) le comportement concurrent (recommandé : `max()` sur les monotones, last-write sur `dernierePositionSec`, upsert atomique).

### G5 — Leçons « aperçu gratuit » (preview catalogue)

Levier de conversion standard 2026 : exposer 1-2 leçons d'un cours `vendableSeul` **sans achat** sur la fiche publique `/formations-en-ligne/[slug]`. Le modèle a `ElearningLesson.obligatoire` mais **pas** de flag `apercuGratuit/preview`. **Action.** Ajouter un booléen `apercuPublic` (défaut false) sur `ElearningLesson` (doc 01) + rendu sur la fiche catalogue (doc 05-07), en `force-dynamic`/ISR stub-safe. Bonus SEO/AEO (contenu indexable).

### G6 — Observabilité des workers & du heartbeat

Le repo utilise Sentry (cf. MEMORY `sentry-transformstream`). **Aucun** doc LMS ne décrit l'instrumentation des nouveaux workers `elearning-*` ni du handler heartbeat `/api/elearning/progress` (chemin chaud, haute fréquence). **Action.** Ajouter à `04-BACKEND/03` + `09-QUALITE/02` : capture Sentry par worker (avec idempotency key), métriques de file (backlog octroi/certificat), alerte sur échec de génération certificat (preuve FOAD critique), et budget de latence du heartbeat.

### G7 — Accessibilité de l'outil auteur (drag&drop admin)

WCAG 2.5.7 (alternative au glisser) est correctement spécifié **côté apprenant** (appariement/ordonnancement). Mais le **course-builder admin** (réordonnancement modules/leçons par drag&drop, doc 06-03) n'a **pas** d'alternative clavier documentée. L'EAA vise le B2C, mais un OF Qualiopi (Ind.26 + référent handicap) doit garantir qu'un auteur en situation de handicap peut utiliser la console. **Action.** Ajouter à `06-CONSOLE/03` + `09-QUALITE/04` : alternative clavier au drag (boutons « monter/descendre », saisie d'ordre) sur le builder admin.

---

## 4. P3 — Améliorations & angles morts mineurs

- **G8 — Workflow d'authoring des sous-titres VTT.** B4 (`captions`) sert le `.vtt` en lecture (V1) mais **aucun doc ne dit qui le produit** : upload manuel par l'auteur ? auto-transcription Cloudflare Stream → relecture humaine ? Les sous-titres sont une **obligation WCAG** (1.2.2). À spécifier dans `04-BACKEND/07` + `06-CONSOLE/03` (champ upload VTT par leçon vidéo, ou pipeline transcription).
- **G9 — `zone_cliquable` intrinsèquement inaccessible.** Question hotspot = 100 % visuelle/pointeur ; il faut une **alternative non-visuelle** (texte/QCM équivalent) pour 1.1.1/2.1.1, sinon ce type est non-conforme. À documenter dans `03` (payload : champ `alternativeAccessible`) + `05-FRONTEND/03`. Envisager de marquer ce type « usage restreint, fournir une alternative ».
- **G10 — Recherche & notifications in-app.** « recherche » apparaît 7× mais aucun doc ne spécifie une **recherche catalogue/mes-cours** ni un **centre de notifications** in-app (tout est email). Acceptable au MVP ; à cadrer V1 dans `05-FRONTEND/01`.
- **G11 — Délivrabilité email transactionnel.** Octrois + relances en masse via **Nodemailer maison** (pas de service tiers). Risque spam/bounce non traité (SPF/DKIM/DMARC du domaine, throttle d'envoi, gestion des bounces, pas de désinscription sur transactionnel). À ajouter à `04-BACKEND/10`.
- **Cohérence chemins de schémas Zod.** `question-payloads.ts` (sous `quiz/`) vs `lesson-content.ts` (sous `schemas/`) — deux dossiers pour des contrats Zod du même domaine. Mineur ; harmoniser sous `src/server/elearning/<domaine>/`.
- **DocumentType certificat.** Doc 06-05 réutilise `DocumentType { certificat_realisation, attestation, attestation_partielle }` « tels quels » — **vérifier en code** que ces 3 valeurs existent bien dans l'enum `DocumentType` (`schema.prisma:5481`) avant de s'y fier (non re-vérifié ici ; doc l'affirme).

---

## 5. Couverture vérifiée du périmètre « MUST-HAVE » de la mission

Pour situer les gaps : le **cœur exigé est couvert**. Synthèse de conformité aux barres de la mission.

| Exigence mission                                                                                  | Couverture dossier                                                                           | Verdict                  |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------ |
| Cœur LMS Course/Module/Lesson/Resource                                                            | doc 01 (complet, enums unlock)                                                               | ✅                       |
| Progression serveur + reprise auto + heartbeat                                                    | doc 02 (`LessonProgress.dernierePositionSec`, agrégats 3 niveaux)                            | ✅                       |
| Déverrouillage 3 déclencheurs + **gating par score réel** + verrou avec raison + override         | doc 01 (`ElearningUnlockType`) + doc 02 (`verrouRaison`, `overrideDeverrouille`) + doc 03 §9 | ✅                       |
| Moteur quiz ~12 types + banque + tirage N/M + shuffle + pondération + feedback + rationale        | doc 03 (sous réserve C4)                                                                     | ✅ (corriger C4)         |
| Anti-triche léger (randomisation + temps serveur) + proctoring optionnel CNIL                     | doc 03 §12                                                                                   | ✅                       |
| Auth apprenant hybride magic-link + mot de passe optionnel, séparée de NextAuth                   | doc 04 + personas §8.4                                                                       | ✅                       |
| Import masse CSV + provisioning idempotent                                                        | doc 04 §7 + doc 06-BACKEND                                                                   | ✅                       |
| Multi-tenant conçu maintenant / livré V2                                                          | doc 04 (`ElearningOrgMembership`) — **sous réserve C2**                                      | ⚠️                       |
| Vidéo HLS signée + watermark (Cloudflare Stream/Bunny)                                            | ADR-0005 + doc 07 §4 (B1-B4) — **env à ajouter (G1)**                                        | ⚠️                       |
| Outil auteur drag&drop, blocs mixtes, aperçu as-student, brouillon→publication                    | doc 06-03 (`lessonContentSchema`, versionnage)                                               | ✅                       |
| IA quiz-gen document-grounded + tuteur RAG ancré citations                                        | doc 03 §11 + 04-BACKEND/08-09                                                                | ✅                       |
| Certificat de réalisation (heures centièmes, QR) + attestation + attestation partielle            | doc 06-05 (réutilise `DocumentGenere`/`qrToken`, banned-phrases)                             | ✅                       |
| Conformité FOAD D.6313-3-1 (3 conditions) + Ind.11 majeur + Ind.19 + faisceau de preuves R.6313-3 | doc 08 (01-06) + doc 02 §10 + doc 03 §10                                                     | ✅ (Ind.19 dépend de C6) |
| WCAG 2.2 AA / EAA + déclaration accessibilité + RGAA + schéma pluriannuel                         | doc 09-04 + doc 05-05                                                                        | ✅ (sauf G7/G9)          |
| Web Vitals (LCP/INP/CLS) sur player + catalogue                                                   | doc 09-03                                                                                    | ✅                       |
| E-commerce Stripe gated + virement/octroi manuel MVP + coupons/sièges                             | doc 05 (`STRIPE_ENABLED`)                                                                    | ✅                       |
| CPF/RNCP « ready » derrière `EDOF_ENABLED`, bloqué sans certification                             | ADR-0003 + doc 08-03/04                                                                      | ✅ (flag à déclarer G1)  |

---

## 6. Fausses alertes vérifiées (NE SONT PAS des gaps)

Pour éviter du travail inutile, ces points **soupçonnés manquants** sont en réalité **traités** :

- **Satisfaction e-learning (chaud/froid) + positionnement** : `Questionnaire` (`:5704`) réutilisé via la même FK `elearningEnrollmentId`, `SatisfactionPortailForm` conservé (doc 08-01 lignes 225/239, doc 05-01). ✅
- **Déclaration d'accessibilité / page `/accessibilite` / RGAA 4.1 / schéma pluriannuel** : doc 09-04 (lignes 16, 54, 304-305, 330). ✅
- **Attestation pour apprenant NON réussi** : doc 06-05 distingue explicitement certificat de réalisation (toujours, heures) vs attestation vs **attestation partielle** (complétion sans réussite) ; règle « jamais de certificat de réussite pour un cours non certifiant » + test banned-phrases. ✅
- **Contrat des blocs de contenu riche `contenuJson`** : doc 06-03 définit `schemaVersion` + `lessonContentSchema` Zod (`src/server/elearning/schemas/lesson-content.ts`). ✅
- **Badges** : modélisés (doc 06-05, opt-in, vérifiables via QR). ✅
- **Versionnage de cours + concurrence d'édition** : doc 06-03 §12 (`version++`, optimistic concurrency `expectedUpdatedAt`, `AdminConflictDialog`, clonage deep-copy). ✅ (l'effet sur les apprenants reste G3).
- **Réinscription d'un compte RGPD-effacé** : interdite par import (doc 06-BACKEND lignes 176/401), action manuelle tracée. ✅
- **Idempotence import / ré-import** : `@@unique([courseId, traineeId])` + statuts ligne (doc 06-BACKEND 178/508/513). ✅
- **Cohabitation NextAuth ↔ auth apprenant** : doc 04 §8.1 (tables/cookies/guards disjoints, `declare module` admin-only inchangé). ✅
- **Réutilisation Invoice/Payment** : doc 05 §7 documente précisément le relâchement `bookingId → nullable` + `CHECK (booking_id OR order_id)` ; **vérifié en code** que `Invoice.bookingId` est aujourd'hui `NOT NULL @db.Uuid onDelete:Restrict` (`:1699-1700`) → le changement est bien nécessaire et non destructif. ✅

---

## 7. Recommandations d'ordonnancement (avant code)

1. **Trancher C1, C2, C3** (P0) — ce sont des décisions de 30 min chacune qui débloquent toute la migration et l'arbo. Sans elles, le lot 1 de la roadmap (« Data model + migrations ») produit du code contradictoire.
2. **Corriger C4, C5, C7, C8 + ajouter C6** (P1) — alignement des enums, statuts, chemins, + le modèle tuteur (sinon Ind.19 non outillé).
3. **Compléter G1** (checklist env.ts + provider vidéo figé) avant le lot 4 (« Pipeline vidéo »).
4. Les **P2/P3** peuvent être intégrés en cours de lot (G2/G4 au lot 3 octroi/progression ; G3 au lot 8 auteur ; G7/G9 au lot accessibilité).

---

## Liens

- `00-INDEX/README.md` — index maître & TOC du dossier
- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-0001→0008 (auth, multi-tenant, Stripe, vidéo, standards, cloisonnement, migrations)
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — **C1** (PK), **G5** (apercuPublic)
- `03-DATA-MODEL/02-schema-progression-tracking.md` — **C1**, **C6** (tuteur), **G2** (re-octroi), **G4** (concurrence)
- `03-DATA-MODEL/03-schema-quiz-evaluations.md` — **C1**, **C4** (QuestionType), **G9** (zone_cliquable)
- `03-DATA-MODEL/04-schema-comptes-acces-auth.md` — **C2** (SSOT membership), **C8** (guards), **G1** (flags)
- `03-DATA-MODEL/05-schema-ecommerce-commandes.md` — **C5** (statut commande), réutilisation Invoice/Payment
- `03-DATA-MODEL/06-strategie-migrations.md` — **C1 arbitrage** (§1.3), **C4** (corriger l'enum), **G1** (checklist env)
- `04-BACKEND/02-server-actions.md` — **C7** (arbo actions, SSOT)
- `04-BACKEND/03-workers-bullmq-crons.md` — **C3** (registre workers, SSOT), **G6** (observabilité)
- `04-BACKEND/05-authentification-apprenant.md` — **C8** (noms fichiers/guards)
- `04-BACKEND/07-pipeline-video-streaming.md` — **G1** (provider + env), **G8** (VTT)
- `04-BACKEND/09-tuteur-rag-assistant.md` & `08-CONFORMITE/02-qualiopi-indicateurs-foad.md` — **C6** (Ind.19, tutorat)
- `04-BACKEND/10-emails-notifications.md` — **G11** (délivrabilité)
- `05-FRONTEND-APPRENANT/03-moteur-quiz-ui.md` — **C4**, **G9**
- `05-FRONTEND-APPRENANT/04-progression-deverrouillage.md` — **G3** (re-validation republication)
- `06-CONSOLE-ADMIN/03-outil-auteur-course-builder.md` — **G7** (a11y builder), **G8** (VTT)
- `09-QUALITE/04-accessibilite-wcag22.md` — **G7**, **G9**
- `01-VISION-PERIMETRE/personas-roles.md` — **C2**, **C6**, **C8** (à réaligner sur les SSOT)
- `07-ROUTES/cartographie-routes-complete.md` — **C5**, **C7**, **C8** (à réaligner)
- `99-VERIFICATION/02-coherence-data-model.md` — approfondit C1/C2/C4 (cohérence schéma)
- `99-VERIFICATION/06-coherence-existant.md` — vérifie la réutilisation EXISTANT vs code réel
