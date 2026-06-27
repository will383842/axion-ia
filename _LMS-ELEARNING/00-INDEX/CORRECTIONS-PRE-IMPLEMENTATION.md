# Corrections pré-implémentation — SSOT faisant autorité

> **Statut : FAIT FOI.** Ce document tranche définitivement les findings **P0 (cohérence inter-documents)** et les **4 non-conformités FOAD** relevés par les audits `99-VERIFICATION/01→06`. En cas de divergence entre un autre document du dossier et celui-ci, **CE DOCUMENT L'EMPORTE**. À lire en premier avant d'écrire la moindre ligne de `schema.prisma` ou de code.
>
> Périmètre : **TOUS les findings des 6 audits** — P0, conformité FOAD, P1/P2/P3, sécurité & RGPD, UX best-practices (décision de Will « corrige tout », 2026-06-27).
>
> Dernière mise à jour : 2026-06-27.

---

## A. CORRECTIONS P0 — cohérence (à acter avant `schema.prisma`)

### A1 — Type des clés primaires/étrangères : `@db.Uuid` PARTOUT (résout C1)

**Décision.** **Tout le domaine e-learning utilise `@db.Uuid`** — clés primaires **et** étrangères — pour rester homogène avec les ~7 300 lignes existantes du `schema.prisma` (toutes en `@db.Uuid`) et débloquer les FK vers `Invoice`/`Trainee`/`Client`/`Formation`.

**Forme canonique** de toute PK LMS :

```prisma
id  String  @id @default(uuid()) @db.Uuid
```

**Forme canonique** de toute FK LMS (intra-LMS ET vers l'existant) :

```prisma
courseId  String  @map("course_id") @db.Uuid
```

**Portée.** Les snippets des docs `03-DATA-MODEL/01`, `/02`, `/03`, `/05` qui montrent `String @id @default(uuid())` **sans** `@db.Uuid` sont à lire **avec `@db.Uuid` ajouté**. Les éventuelles notes de ces docs disant « ne pas mettre `@db.Uuid` sur les FK intra-LMS » sont **annulées** par le présent document. Référence d'arbitrage : `03-DATA-MODEL/06-strategie-migrations.md` §1.3.

### A2 — Modèle d'appartenance entreprise UNIQUE (résout C2)

**Décision.** Un seul modèle : **`ElearningOrgMembership`** (table `elearning_org_memberships`), tel que défini dans `03-DATA-MODEL/04-schema-comptes-acces-auth.md` (SSOT). Le modèle `ElearningCompanyMembership` cité dans `01-VISION-PERIMETRE/personas-roles.md` est **abandonné**.

- Enum de rôle retenu : **`ElearningOrgRole { membre, manager, org_admin }`**.
- Enum de statut de siège : **`ElearningOrgMembershipStatut { active, suspended, revoked }`**.
- **`Trainee.elearningRole` n'est PAS ajouté** (le rôle entreprise est porté par l'appartenance, pas par le Trainee). Toute mention de `Trainee.elearningRole` / `ElearningLearnerRole` dans personas est annulée.

`01-VISION-PERIMETRE/personas-roles.md` doit être lu en remplaçant `ElearningCompanyMembership`/`ElearningCompanyRole`/`client_*` par `ElearningOrgMembership`/`ElearningOrgRole`/`{membre, manager, org_admin}`.

### A3 — Registre canonique des workers BullMQ (résout C3)

**Décision.** `04-BACKEND/03-workers-bullmq-crons.md` est le **registre SSOT**. Noms officiels (FR, cohérents avec les workers `qualiopi-*` existants) — **aucun autre nom n'est autorisé** :

| Worker (nom officiel)              | Queue                       | Rôle                                                                      | Idempotence                 |
| ---------------------------------- | --------------------------- | ------------------------------------------------------------------------- | --------------------------- |
| `elearning-provisioning-worker`    | `elearning-provisioning`    | import CSV + création accès + invitation (fusion de import/invite/access) | clé `(batchId, rowEmail)`   |
| `elearning-progress-rollup-worker` | `elearning-progress-rollup` | recalcul agrégats Module/Course depuis LessonProgress                     | clé `(enrollmentId)`        |
| `elearning-certificat-worker`      | `elearning-certificat`      | émission certificat de réalisation (DocumentGenere)                       | clé `(enrollmentId, type)`  |
| `elearning-relance-worker`         | `elearning-relance`         | relances anti-décrochage (Ind.12)                                         | clé `(enrollmentId, jalon)` |
| `elearning-video-worker`           | `elearning-video`           | ingestion/transcodage/webhook vidéo                                       | clé `(videoAssetId, event)` |
| `elearning-order-worker`           | `elearning-order`           | octroi à la commande + expiration commande                                | clé `(orderId, action)`     |
| `elearning-xapi-purge-worker`      | `elearning-xapi-purge`      | purge des traces xAPI selon rétention                                     | cron                        |
| `elearning-ai-worker`              | `elearning-ai`              | génération IA (leçons/quiz) + indexation tuteur RAG                       | clé `(jobId)`               |

Toute autre orthographe rencontrée dans les docs (`certificate`, `reminders`, `import`, `grant`, `provisioning-worker` ≠ ci-dessus, etc.) est **invalide** : utiliser exclusivement ce tableau. Déclaration unique dans `src/server/queue/queues.ts` + `worker.ts`.

### A4 — Corrections de cohérence data model complémentaires

- **Enum `QuestionType` = 12 valeurs** (résout C4) : `qcm_mono, qcm_multi, vrai_faux, appariement, texte_a_trous, menu_deroulant, ordonnancement, reponse_courte, numerique, essai, upload, zone_cliquable`. La liste à 9 valeurs de `03-DATA-MODEL/06` est annulée ; orthographe officielle `texte_a_trous` (pas `texte_trous`). Source de design : `03-DATA-MODEL/03`.
- **Statut commande** (résout C5) : utiliser **`en_attente_paiement`** (+ `paymentMode = virement`). `en_attente_virement` de `07-ROUTES` est annulé. Enum SSOT : `ElearningOrderStatut` (`03-DATA-MODEL/05`).
- **Arborescence des Server Actions** (résout C7) : **par sous-domaine** → `src/server/elearning/<domaine>/actions.ts` (ex. `orders/actions.ts`, `quiz/actions.ts`, `progress/actions.ts`, `auth/actions.ts`). **Interdiction** des actions co-localisées sous `app/**` (contraire à ADR-0007). SSOT : `04-BACKEND/02`.
- **Auth apprenant — fichiers/guards** (résout C8) : `src/server/elearning/auth/learner-auth-service.ts`, `learner-guard.ts` (`requireLearner`/`getLearnerSession`), `admin-guards.ts` (`requireElearningRead/Author/Publish/Admin`). Les noms `learner-session.ts` (07-ROUTES) et `auth/guards.ts` (personas) sont annulés. SSOT : `04-BACKEND/05`.
- **`onDelete` de `QuizAttempt.enrollmentId`** (résout data-model audit C2) : la FK doit être **`onDelete: Cascade`** (un attempt n'a pas de sens sans son enrollment) **et** `enrollmentId` est **obligatoire** (non nullable). Ne pas utiliser `SetNull` sur une colonne non-nullable.
- **Variables d'environnement** (résout G1) : déclarer dans `src/env.ts`, **optionnelles au build** (contrat `stub.invalid`, `SKIP_ENV_VALIDATION`), requises au runtime si la feature est active :
  - Vidéo (provider retenu par défaut = **Cloudflare Stream**, ADR-0005) : `CLOUDFLARE_STREAM_ACCOUNT_ID`, `CLOUDFLARE_STREAM_API_TOKEN`, `CLOUDFLARE_STREAM_SIGNING_KEY`, `CLOUDFLARE_STREAM_WEBHOOK_SECRET`.
  - Flags : `EDOF_ENABLED` (défaut false), `LEARNER_PASSWORD_ENABLED` (défaut false), `LMS_TUTOR_ENABLED` (défaut false).

---

## B. CORRECTIONS CONFORMITÉ FOAD — les 4 non-conformités

> Objectif : rendre le **MVP finançable OPCO/entreprise** dès la première vente (le CPF reste gaté, ADR-0003). Sans ces corrections, l'audit `99-VERIFICATION/03` conclut « non finançable en l'état ».

### NC-1 — Assistance technique ET pédagogique dès le MVP (Ind.19 / D.6313-3-1 §1)

**Problème.** L'assistance n'était outillée qu'en V1 (tuteur RAG). Or l'**Ind.19 est la seule obligation FOAD nommée** : sans elle, action non finançable.

**Décision — séparer 2 niveaux :**

- **MVP = assistance HUMAINE de base, suffisante pour Ind.19** : canal de contact (email/formulaire depuis l'espace apprenant), **délais de réponse formalisés et affichés** (ex. « réponse sous 1 jour ouvré »), **traçabilité** des demandes et réponses (preuve d'accompagnement). Pas besoin d'IA pour être conforme.
- **V1 = tuteur RAG** (`04-BACKEND/09`) en **amélioration**, pas en prérequis de conformité.

**Modèle de données NEUF à ajouter (`03-DATA-MODEL/02`)** — résout aussi C6 (table tuteur manquante) :

```prisma
enum ElearningAssistanceStatut { ouverte, en_cours, repondue, cloturee }
enum ElearningAssistanceCanal  { email, formulaire, tuteur_ia }

model ElearningTutorAssignment {              // rattachement tuteur humain <-> apprenant (Ind.19)
  id            String   @id @default(uuid()) @db.Uuid
  enrollmentId  String   @map("enrollment_id") @db.Uuid
  enrollment    ElearningEnrollment @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)
  tuteurId      String   @map("tuteur_id") @db.Uuid          // Trainer existant
  tuteur        Trainer  @relation(fields: [tuteurId], references: [id], onDelete: Restrict)
  slaHeures     Int      @default(24) @map("sla_heures")     // délai de réponse formalisé
  createdAt     DateTime @default(now()) @map("created_at")
  @@unique([enrollmentId, tuteurId])
  @@index([tuteurId])
  @@map("elearning_tutor_assignments")
}

model ElearningAssistanceRequest {            // demandes d'assistance = PREUVE d'accompagnement FOAD
  id            String   @id @default(uuid()) @db.Uuid
  enrollmentId  String   @map("enrollment_id") @db.Uuid
  enrollment    ElearningEnrollment @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)
  canal         ElearningAssistanceCanal
  statut        ElearningAssistanceStatut @default(ouverte)
  sujet         String   @db.VarChar(300)
  message       String
  reponse       String?
  reponduParId  String?  @map("repondu_par_id") @db.Uuid     // AdminUser ou Trainer
  createdAt     DateTime @default(now()) @map("created_at")
  reponduAt     DateTime? @map("repondu_at")
  @@index([enrollmentId])
  @@index([statut])
  @@map("elearning_assistance_requests")
}
```

**À répercuter :** `11-ROADMAP/01` (assistance humaine = lot MVP), `08-CONFORMITE/02` (Ind.19 = couvert au MVP par `ElearningAssistanceRequest` + délais affichés), `05-FRONTEND-APPRENANT/01` (bloc « Besoin d'aide ? » avec délai affiché), `06-CONSOLE-ADMIN` (file des demandes d'assistance + alerte si dépassement SLA, réutiliser `AlerteSysteme`).

### NC-2 — Relier les résultats de quiz à la preuve légale (Ind.11 / D.6313-3-1 §3)

**Problème.** Le moteur de quiz stocke ses propres `QuizAttempt`, mais l'**évaluation des acquis** légale vit dans `EvaluationAcquis` (existant, réceptacle Qualiopi). Sans pont, l'Ind.11 (non-conformité **majeure**) n'est pas probant.

**Décision — pont obligatoire à la complétion d'une évaluation jalonnante/finale :**

- Quand un `QuizAttempt` correspond à un quiz **marqué « évaluation des acquis »** (jalon ou final), le système **crée/maj un `EvaluationAcquis`** lié à l'`Enrollment`/`ElearningEnrollment` avec `scoreObtenu/scoreMax/scorePct`, `reussite` (vs `seuilReussitePct`), `type` (`intermediaire`/`finale`), et `niveauGlobal`.
- Le **certificat** (NC-3) s'appuie sur l'`EvaluationAcquis` **finale**, pas sur le `QuizAttempt` brut.
- Champ à ajouter sur `Quiz` (`03-DATA-MODEL/03`) : `estEvaluationAcquis Boolean @default(false)` + `evaluationType ElearningEvaluationType?` (`positionnement`/`jalon`/`finale`).

**À répercuter :** `03-DATA-MODEL/03` (champs + relation `Quiz`↔`EvaluationAcquis`), `04-BACKEND/01` (service `bridgeQuizToEvaluationAcquis()` appelé à la soumission), `08-CONFORMITE/02` (Ind.11 = couvert).

### NC-3 — Règle de calcul des « heures réalisées » du certificat

**Problème.** Le certificat de réalisation exige des **heures réalisées**, mais « temps de visionnage » ≠ « heures de formation ». Aucune règle définie.

**Décision — base déclarative + preuve d'assiduité, pas le chronomètre :**

- Chaque cours porte une **durée pédagogique de référence** (`ElearningCourse.dureeEstimeeMinutes`, déjà au modèle) = la durée officielle annoncée (= base des « heures réalisées » au certificat).
- Les **heures réalisées portées au certificat = durée de référence** des modules **effectivement complétés** (complétion validée par progression + réussite des évaluations jalonnantes), **converties en heures centièmes** (ex. 7 h 30 → 7,50 ; format attendu EDOF/OPCO).
- Le **temps de connexion/visionnage** (`tempsPasseSec`) sert de **preuve d'assiduité** au faisceau (NC-4), **pas** de base de facturation des heures.
- Si complétion partielle → **attestation partielle** (réutiliser `AttestationResultat` : ≥80 % complète / 60-79 % partielle / <60 % aucune), jamais de certificat de réussite pour un cours non certifiant.

**À répercuter :** `05-FRONTEND-APPRENANT/06-certificats-badges.md` (règle de calcul + format centièmes), `08-CONFORMITE/06` (heures réalisées = preuve), `06-CONSOLE-ADMIN/07` (paramètre durée de référence par cours).

### NC-4 — Politique de conservation différenciée des preuves LMS natives

**Problème.** `DocumentGenere.suppressionPrevueAt = +5 ans` couvre les PDF, mais les preuves natives (progression, tentatives, logs, traces d'assistance, traces xAPI) n'ont **aucune** politique de rétention.

**Décision — rétention par nature de donnée, codée en cron (`elearning-xapi-purge-worker` + extension) :**

| Donnée                                                                                                | Durée                                  | Fondement                    |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------- |
| Pièces comptables (factures, conventions)                                                             | **10 ans**                             | L.123-22 c. com.             |
| Justificatifs OPCO / dépenses                                                                         | **6 ans**                              | L.102 B LPF                  |
| Preuves de réalisation (progression, tentatives quiz, résultats, **traces d'assistance**, certificat) | **5 ans** (retenu, borne haute du 3-5) | L.6362-6 + pratique Qualiopi |
| Traces xAPI / logs d'apprentissage techniques (heartbeat)                                             | **12 mois**                            | CNIL délib. 2021-122         |
| Logs techniques de sécurité (accès, auth)                                                             | **6 mois** (→ 12 si incident)          | CNIL délib. 2021-122         |

- Chaque modèle de progression/trace porte un champ **`suppressionPrevueAt`** (calculé à la création selon sa nature), purgé par cron.
- Les preuves liées à un contrôle/contentieux en cours sont **gelées** (pas de purge tant que le litige est ouvert).

**À répercuter :** `03-DATA-MODEL/02` (champ `suppressionPrevueAt` sur LessonProgress/QuizAttempt/xAPI/AssistanceRequest), `08-CONFORMITE/05-rgpd-conservation-preuves.md` (tableau ci-dessus = SSOT), `04-BACKEND/03` (`elearning-xapi-purge-worker` étendu aux 5 natures).

---

## D. CORRECTIONS P1 / P2 / P3 — gaps fonctionnels

### D1 — Re-octroi d'un accès expiré/révoqué (G2)

`@@unique([courseId, traineeId])` conservé. Ajouter un chemin de **réactivation** : service `reactivateAccess(enrollmentId)` qui repasse `statut → actif`, fixe une nouvelle `expiresAt`, et **trace** l'opération. L'import (provisioning) distingue **`REACTIVATE`** (enrollment existant `expire`/`revoque`) de `ALREADY_ENROLLED` (déjà actif, no-op). → `03-DATA-MODEL/02`, `04-BACKEND/06`.

### D2 — Re-validation après republication d'un cours (G3)

Matrice « type de changement × effet », à poser dans `05-FRONTEND-APPRENANT/04` :

- **Certificats déjà émis = immuables** (preuve figée), jamais invalidés par une republication.
- **Complétion acquise jamais régressée** : un apprenant en cours garde ses leçons validées.
- **Leçon obligatoire ajoutée** après complétion → le cours repasse « en cours » pour cette leçon (le certificat déjà émis reste valide ; un nouveau certificat n'est ré-émis que sur demande/nouvelle complétion).
- **Question de gating modifiée** → **pas** de re-test rétroactif des apprenants déjà passés.
- **Leçon supprimée** avec `LessonProgress` existant → progression conservée en historique (soft, pas de DROP).

### D3 — Progression multi-appareils / concurrence (G4)

Règle de fusion (`03-DATA-MODEL/02` §service + `05-FRONTEND/02`) : `max()` sur les champs **monotones** (`percentVu`, `maxPositionSec`, `tempsPasseSec` plafonné), **last-write-wins** sur `dernierePositionSec`, **upsert atomique** `(enrollmentId, lessonId)`. Pas de localStorage comme source de vérité.

### D4 — Aperçu gratuit (preview catalogue) (G5)

Ajouter `ElearningLesson.apercuPublic Boolean @default(false)` (`03-DATA-MODEL/01`). 1-2 leçons consultables **sans achat** sur la fiche `/formations-en-ligne/[slug]` (`05-FRONTEND/07`), rendu `force-dynamic`/ISR stub-safe. Levier de conversion + bonus SEO/AEO.

### D5 — Observabilité des workers & du heartbeat (G6)

`04-BACKEND/03` + `09-QUALITE/02` : capture **Sentry par worker** (avec idempotency key), **métriques de file** (backlog octroi/certificat/relance), **alerte sur échec de génération certificat** (preuve FOAD critique → réutiliser `AlerteSysteme`), **budget de latence** sur le handler heartbeat `/api/elearning/progress` (chemin chaud).

### D6 — Accessibilité de l'outil auteur admin (G7)

Le course-builder (réordonnancement drag&drop) doit fournir une **alternative clavier** (boutons « monter/descendre » + saisie directe de l'ordre) — WCAG 2.5.7. → `06-CONSOLE-ADMIN/03` + `09-QUALITE/04`.

### D7 — Workflow des sous-titres VTT (G8) — BLOQUANT publication

Pipeline : **auto-transcription Cloudflare Stream → relecture humaine OBLIGATOIRE → `.vtt` rattaché à la leçon**. Les **sous-titres sont une dépendance bloquante de publication** d'une leçon vidéo (WCAG 1.2.2, EAA). Champ d'upload/édition VTT par leçon vidéo. → `04-BACKEND/07` + `06-CONSOLE-ADMIN/03`.

### D8 — `zone_cliquable` intrinsèquement accessible (G9)

Toute question `zone_cliquable` (hotspot visuel) **exige** un champ `alternativeAccessible` (équivalent texte/QCM) — **sinon publication bloquée** (WCAG 1.1.1/2.1.1). Type marqué « usage restreint ». → `03-DATA-MODEL/03` (payload) + `05-FRONTEND/03`.

### D9 — Recherche & notifications in-app (G10)

MVP : **recherche** simple (catalogue + « mes cours »). V1 : **centre de notifications in-app** (l'email reste le canal principal). → `05-FRONTEND/01`.

### D10 — Délivrabilité email transactionnel (G11)

`04-BACKEND/10` : **SPF/DKIM/DMARC** du domaine, **throttle** d'envoi (octrois/relances en masse), **gestion des bounces**, séparation stricte du flux transactionnel (pas de désinscription sur transactionnel, mais en-têtes RFC 8058 conservés).

### D11 — Divers (mineurs)

- Schémas Zod harmonisés sous `src/server/elearning/<domaine>/` (pas deux dossiers `quiz/` vs `schemas/`).
- **Vérifier en code** que l'enum `DocumentType` (`schema.prisma:5481`) contient bien `certificat_realisation`, `attestation`, `attestation_partielle` avant usage (sinon migration `ADD VALUE` additive). `certificat_realisation` confirmé présent par l'audit conformité ; vérifier les deux autres.

---

## E. CORRECTIONS SÉCURITÉ & RGPD (audit 04)

### E1 — Scoping d'autorisation anti-IDOR (SEC-01, Critique)

Fonction unique **`assertLearnerCanAccessCourse(traineeId, courseId)`** (et `assertLearnerCanAccessLesson/Quiz/Resource/Certificat`) appelée dans **CHAQUE** point d'accès : player, quiz, vidéo (génération d'URL signée), ressources, certificat, heartbeat. Vérifie un `ElearningEnrollment` **actif et non expiré**. **Tests d'accès obligatoires** (un apprenant ne peut pas lire le cours d'un autre en changeant un id). → `04-BACKEND/01` + `09-QUALITE/01`.

### E2 — Protection vidéo non contournable (SEC-02, Critique)

URL **signée par utilisateur**, **courte durée** (2-4 h), **token non rejouable** ; **watermark dynamique** (email/id apprenant incrusté) ; pas de DRM lourd (ADR-0005). Le lien ne doit pas être partageable en clair. → `04-BACKEND/07`.

### E3 — Token d'accès apprenant haché + session raccourcie (SEC-03, Critique)

Pour un LMS ouvert large : **stocker le token haché** (extension additive `PortailAcces.tokenHash`, sur le modèle de `FormateurMagicLink.tokenHash`), comparer par hash, et **raccourcir la session LMS** (ex. 30 j avec refresh sur usage au lieu de 90 j). Le token clair existant reste pour la compat ; **les nouveaux accès LMS utilisent le hash**. Migration additive (pas de DROP). → `04-BACKEND/05` + `03-DATA-MODEL/04`.

### E4 — Auth mot de passe entreprise durcie (SEC-04, Élevé)

argon2id **+** : **rate-limit fail-closed** sur le login mot de passe (cf. E7), **anti-énumération** (réponses uniformes succès/échec), **verrouillage** après N échecs, **2FA optionnel**, **reset password** par token à usage unique court. → `04-BACKEND/05` + `09-QUALITE/02`.

### E5 — Anti-triche quiz côté serveur (SEC-05, Élevé)

Le **barème et les bonnes réponses ne sont JAMAIS envoyés au client** avant soumission. **Scoring 100 % serveur**, **timing mesuré serveur**, randomisation par pool, shuffle questions+réponses. → `03-DATA-MODEL/03` + `04-BACKEND/01` + `05-FRONTEND/03`.

### E6 — Conservation/purge RGPD (RGPD-01) → voir **NC-4** (section B). Cron `elearning-xapi-purge-worker` étendu aux 5 natures de données.

### E7 — `rate-limit` fail-CLOSED sur les chemins sensibles

Le `rate-limit.ts` existant est **fail-open** (si Redis tombe, plus de protection). Pour les chemins sensibles LMS — **login mot de passe, génération d'URL signée vidéo, soumission de quiz** — basculer en **fail-closed** (refuser plutôt qu'ouvrir si Redis indisponible). → `09-QUALITE/02`.

### E8 — Risques résiduels (~20, audit 04)

Traités via la **checklist sécurité du lot d'implémentation correspondant** (référence : `99-VERIFICATION/04-audit-securite-rgpd.md`). Aucun n'est bloquant pour démarrer le lot 1, mais chaque PR de feature porte sa checklist sécurité.

---

## F. CORRECTIONS UX & BEST-PRACTICES 2026 (audit 05)

> ⚠️ L'audit UX `99-VERIFICATION/05` a été produit **en jugeant sur le socle seul** (il croyait `05-FRONTEND-APPRENANT/*` non écrits, alors qu'ils l'étaient). Plusieurs de ses « 🔴 » (reprise auto, sous-titres, WCAG) sont **déjà traités** dans les docs frontend. Les points ci-dessous **confirment et verrouillent** ce qui doit l'être.

### F1 — Reprise auto modélisée serveur (F-01)

Confirmer dans `03-DATA-MODEL/02` (dès le MVP, pas de migration tardive) : position de reprise serveur (`dernierePositionSec` + `maxPositionSec` + scroll pour les leçons texte). Persistance **serveur**, pas localStorage.

### F2 — `unlockReason` structuré (F-02)

La raison du verrou est un **objet structuré** calculé serveur (`{ type, critereManquant, scoreCible?, dateCible? }`), exposé à l'UI (pas un texte libre), + **override admin tracé**. → `03-DATA-MODEL/02` + `05-FRONTEND/04`.

### F3 — Sous-titres bloquants à la publication (A-01/F-04) → voir **D7**.

### F4 — WCAG 2.2 AA opérationnalisé (A-02)

`09-QUALITE/04` : checklist **par composant** (player / quiz / builder / dashboard) couvrant les 4 critères 2.2 (2.4.11 focus non masqué, 2.5.7 alternative au drag, 2.5.8 cible ≥24 px, 3.3.8 auth accessible) ; l'accessibilité d'une leçon est **liée au gating de publication**.

### F5 — Sémantique `QuizAttempt` figée (Q-01)

Politique de note retenue pour le **gating et le certificat** = **meilleure note** par défaut (configurable best/last/avg), **timing serveur**, tentatives bornées. À figer dans `03-DATA-MODEL/03` avant écriture du moteur.

### F6 — Anti-patterns explicitement bannis

Specs `05-FRONTEND/02` + `/04` : **pas d'autoplay vidéo**, **pas de classement imposé** (gamification opt-in), **pas de pacing rigide en self-paced** (le drip est réservé aux cohortes/compliance ; en accès libre, séquencement souple).

---

## C. Checklist « prêt à coder » (après ces corrections)

- [ ] `schema.prisma` : tous modèles LMS en `@db.Uuid` (A1)
- [ ] Un seul `ElearningOrgMembership` (A2), `Trainee.elearningRole` non ajouté
- [ ] Registre workers conforme au tableau A3 (noms gelés)
- [ ] `QuestionType` à 12 valeurs (A4), statut commande `en_attente_paiement` (A4)
- [ ] `QuizAttempt.enrollmentId` `@db.Uuid` non-nullable `onDelete: Cascade` (A4)
- [ ] `src/env.ts` : clés Cloudflare Stream + 3 flags, optionnelles au build (A4)
- [ ] Modèles `ElearningTutorAssignment` + `ElearningAssistanceRequest` (NC-1)
- [ ] Pont `Quiz` → `EvaluationAcquis` (`estEvaluationAcquis`, service bridge) (NC-2)
- [ ] Règle heures réalisées (durée de référence × modules complétés, centièmes) (NC-3)
- [ ] `suppressionPrevueAt` sur les preuves natives + cron de purge 5 natures (NC-4)
- [ ] Réactivation accès expiré + import `REACTIVATE` (D1) ; matrice re-validation republication (D2) ; fusion progression multi-appareils (D3)
- [ ] `ElearningLesson.apercuPublic` (D4) ; observabilité Sentry workers + heartbeat (D5) ; alternative clavier builder (D6)
- [ ] Sous-titres VTT bloquants publication (D7) ; `alternativeAccessible` sur `zone_cliquable` (D8) ; recherche/notifications (D9) ; délivrabilité email (D10) ; Zod harmonisé + check DocumentType (D11)
- [ ] `assertLearnerCanAccessCourse/...` partout + tests IDOR (E1) ; vidéo signée/watermark non contournable (E2)
- [ ] `PortailAcces.tokenHash` + session LMS raccourcie (E3) ; login mot de passe durci + anti-énumération + 2FA (E4)
- [ ] Scoring quiz 100 % serveur, barème jamais exposé (E5) ; `rate-limit` fail-closed sur chemins sensibles (E7)
- [ ] Reprise auto serveur (F1) ; `unlockReason` structuré + override tracé (F2) ; WCAG 2.2 par composant lié au gating (F4) ; politique note `QuizAttempt` = meilleure note (F5) ; anti-patterns bannis (F6)

> **Tous les findings des 6 audits sont désormais tranchés dans ce document** (P0 §A, conformité FOAD §B, gaps P1/P2/P3 §D, sécurité/RGPD §E, UX §F). Les ~20 risques sécurité résiduels (E8) portent une checklist par PR de feature. Le dossier est **« prêt à coder »** une fois cette checklist intégrée aux docs sources lors du lot 1.

## Liens

- `99-VERIFICATION/01-critique-completude.md` — C1→C8, G1→G11
- `99-VERIFICATION/02-coherence-data-model.md` — C1, onDelete, dérive enums
- `99-VERIFICATION/03-audit-conformite.md` — NC-1→NC-4
- `99-VERIFICATION/04-audit-securite-rgpd.md` — SEC-01→06, RGPD-01 (lots suivants)
- `03-DATA-MODEL/02`, `/03`, `/04`, `/05`, `/06` — docs impactés
- `08-CONFORMITE/02`, `/05`, `/06` — Ind.11, Ind.19, conservation, preuves
- `11-ROADMAP/01-phasage-mvp-v1-v2.md` — assistance humaine remontée au MVP
