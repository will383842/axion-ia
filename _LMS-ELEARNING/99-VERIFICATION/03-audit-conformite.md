# Audit adversarial de conformité — LMS e-learning (FOAD) Axion-IA

> **Posture.** Ce document se met dans la peau d'un contrôleur **DREETS** (ex-DIRECCTE), d'un **financeur OPCO** en contrôle de service fait, et d'un **auditeur de surveillance Qualiopi V8** sur le périmètre **FOAD**. Question unique : _en l'état du dossier de conception, la plateforme produirait-elle un faisceau de preuves opposable et survivrait-elle à un contrôle ?_
>
> **Méthode.** On confronte les décisions du dossier (`00-INDEX/DECISIONS-ARBITRAGES.md`, `03-DATA-MODEL/01-schema-cours-modules-lecons.md`, `11-ROADMAP/01-phasage-mvp-v1-v2.md`) **et le code réel** (`prisma/schema.prisma`, `src/server/qualiopi/**`, `src/lib/r2-storage.ts`) au droit applicable. On distingue **EXISTANT** (déjà codé, réutilisable) de **NEUF** (à construire). Chaque constat porte un **verdict** : ✅ CONFORME · 🟡 CONFORME SOUS CONDITION · 🔴 NON-CONFORME (MAJEUR/MINEUR) · ⚠️ RISQUE.
>
> Dernière mise à jour : 2026-06-27.

---

## 0. Synthèse exécutive (pour Will)

**Le socle Qualiopi présentiel/synchrone d'Axion-IA est mature et largement réutilisable.** Le dossier LMS s'appuie correctement dessus (DocumentGenere, EvaluationAcquis, Questionnaire, PortailAcces, ReleveConnexionImport, certificat de réalisation déjà modélisé). **Mais en l'état le dossier ne passerait PAS un contrôle FOAD**, à cause de **4 non-conformités structurelles** dont **2 majeures** :

| #    | Constat                                                                                                                                                                                                                                                                                                                    | Gravité                                                   | Bloque le financement ?                                       |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------- |
| NC-1 | **Assistance technique ET pédagogique (Ind.19 / D.6313-3-1 §1)** prévue seulement en V1 (tuteur RAG) ; **aucun modèle de données ni délai formalisé** au MVP.                                                                                                                                                              | 🔴 MAJEUR                                                 | OUI (FOAD non finançable sans Ind.19)                         |
| NC-2 | **Évaluations qui jalonnent ET concluent (Ind.11 / D.6313-3-1 §3)** : le moteur de quiz existe mais **les résultats ne sont pas reliés au faisceau de preuves légal** (`EvaluationAcquis`) ni à un calcul d'heures réalisées défendable.                                                                                   | 🔴 MAJEUR                                                 | OUI (Ind.11 = non-conformité majeure si absente/non probante) |
| NC-3 | **Certificat de réalisation FOAD** : `DocumentType.certificat_realisation` existe, mais **aucune règle de calcul des « heures réalisées »** à partir de la complétion (le temps de visionnage ≠ heures de formation) ni de template e-learning.                                                                            | 🔴 MINEUR (devient MAJEUR si non corrigé avant 1re vente) | OUI au moment du contrôle de service fait                     |
| NC-4 | **Conservation différenciée** : `DocumentGenere.suppressionPrevueAt = +5 ans` couvre les PDF, mais **les preuves LMS natives** (progression, tentatives, logs, traces d'assistance) **n'ont aucune politique de rétention** (ni purge logs techniques 6-12 mois CNIL, ni conservation preuves 3-5 ans / comptable 10 ans). | 🔴 MINEUR                                                 | OUI en contrôle a posteriori                                  |

**Points CONFORMES ou bien orientés** : CPF/RNCP correctement gaté (ADR-0003), pas d'émargement imposé (R.6313-3 respecté), modélisation tracking sur grammaire xAPI (future-proof), migrations additives (pas de risque prod), certificat officiel déjà dans le DocumentType enum.

**Verdict global : 🔴 NON FINANÇABLE EN L'ÉTAT.** Correction des 4 NC = condition d'ouverture commerciale. Détail et specs ci-dessous.

---

## 1. Rappel du droit applicable (cadre du contrôle)

| Source                                                                           | Exigence                                                                                                                                                                                      | Impact LMS                                                                                  |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Art. D.6313-3-1 CT**                                                           | FOAD = **3 conditions cumulatives** : (1) assistance **technique ET pédagogique** + délais ; (2) information sur **activités + durée moyenne** ; (3) **évaluations** qui jalonnent/concluent. | Cœur de l'audit. Une seule manquante = action non éligible.                                 |
| **Art. R.6313-3 CT**                                                             | **Preuve libre** : pas d'émargement obligatoire en FOAD, MAIS **faisceau de preuves** ; le relevé de connexion **seul** est insuffisant.                                                      | Faisceau = évaluations + travaux + logs LMS + traces d'accompagnement.                      |
| **Qualiopi V8 (RNQ 23/11/2023)**                                                 | Indicateurs FOAD spécifiques : **1, 6, 9, 10, 11 (majeur), 12, 17, 19**.                                                                                                                      | Ind.19 = seule obligation FOAD **nommée** ; Ind.11 = non-conformité **majeure** si absente. |
| **Certificat de réalisation (arrêté 21/12/2020, obligatoire depuis 01/06/2020)** | Modèle officiel, **heures réalisées**.                                                                                                                                                        | À générer pour chaque parcours FOAD clôturé.                                                |
| **CPF — L.6323-6**                                                               | Éligible **uniquement** si certification **RNCP ou RS**.                                                                                                                                      | E-learning non certifiant = **non éligible CPF** (ce n'est pas la modalité qui bloque).     |
| **EDOF / loi anti-fraude 2022-1587**                                             | Entrée effective = **1re connexion réelle substantielle** ; FranceConnect+ ; service fait → paiement CDC.                                                                                     | Gaté par `EDOF_ENABLED` (ADR-0003).                                                         |
| **Conservation**                                                                 | **10 ans** comptable (L.123-22 c.com.) · **6 ans** fiscal/OPCO (L.102 B LPF) · **3-5 ans** preuves réalisation (L.6362-6) · **6 mois–1 an** logs techniques (CNIL délib. 2021-122).           | Politique de rétention **différenciée par nature de donnée**.                               |

---

## 2. EXISTANT réutilisable — état des lieux (ce qui joue en notre faveur)

Vérifié dans `prisma/schema.prisma` et `src/server/qualiopi/**` :

| Brique existante                                                                                                                                         | Emplacement                                                                                                                         | Usage FOAD                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `DocumentType.certificat_realisation` (+ `attestation`, `attestation_partielle`)                                                                         | `schema.prisma` enum `DocumentType`                                                                                                 | Le **type de document légal existe déjà** — pas à recréer.                                                                          |
| `DocumentGenere` (numero unique, `hashSha256`, `qrToken` vérif. publique, `suppressionPrevueAt`, `fichierOriginalPath`)                                  | `schema.prisma:5507`                                                                                                                | Conteneur de preuve PDF + QR + archivage original. Réutiliser pour le certificat FOAD.                                              |
| `EvaluationAcquis` (`scoreObtenu/Max/Pct`, `reussite`, `niveauGlobal`, `competences` Json, lien `enrollmentId`/`coachingSessionId`)                      | `schema.prisma:5653`                                                                                                                | **Réceptacle légal des évaluations** — c'est ICI que les résultats de quiz e-learning doivent atterrir (cf. NC-2).                  |
| `Questionnaire` (`positionnement`, `satisfaction_chaud/froid`, token portail)                                                                            | `schema.prisma:5704`                                                                                                                | Positionnement à l'entrée + satisfaction (Ind.31/off.8). Réutilisable pour FOAD.                                                    |
| `PortailAcces` (token 64 hex, cookie HttpOnly 90 j, `lastUsedAt`, `revoked`)                                                                             | `schema.prisma:6236` ; service `src/server/qualiopi/portail/portail-service.ts` (`creerAcces`/`verifierToken`/`getEspaceStagiaire`) | Base de l'auth apprenant magic-link (ADR-0001). `lastUsedAt` = brique « entrée effective ».                                         |
| `ReleveConnexionImport` → `PresenceCreneau` (import Zoom/Teams/Meet)                                                                                     | `schema.prisma:6374` / `5587`                                                                                                       | Modèle de **faisceau de preuves de connexion** déjà éprouvé pour le distanciel synchrone — pattern à dupliquer pour les traces LMS. |
| `Formation` : `codeRncp`, `codeRs`, `numeroEnregistrementFc`, `certificateurNom`, `estCertificateur`, `cpfEligible`, `edofVerifieAt`, `blocsCompetences` | `schema.prisma:5096-5116`                                                                                                           | **Toute la plomberie certification/CPF existe déjà** — l'`ElearningCourse.formationId` (optionnel) hérite de cette finançabilité.   |
| `AttestationResultat` (classification ≥80 complète / 60-79 partielle / <60 aucune)                                                                       | `schema.prisma:5320`                                                                                                                | Règle de décision réutilisable pour le certificat e-learning.                                                                       |
| `DocumentGenere.suppressionPrevueAt` = `createdAt + 5 ans`                                                                                               | `schema.prisma:5533`                                                                                                                | Rétention PDF déjà en place — **mais incomplète pour le LMS** (cf. NC-4).                                                           |
| `r2-storage.ts` : `uploadToR2` / `getSignedUrlR2` / `getObjectBufferR2`                                                                                  | `src/lib/r2-storage.ts`                                                                                                             | Stockage preuves (devoirs, exports, PDF).                                                                                           |
| Templates PDF `qualiopi-*.tsx` (@react-pdf/renderer) + `email-worker` + crons                                                                            | `src/lib/email/templates/`, workers                                                                                                 | Réutiliser pour certificat FOAD + relances Ind.12.                                                                                  |

> **Conclusion section 2 :** ~70 % de la conformité documentaire est portée par l'existant. Le risque n'est pas dans les _documents finaux_ mais dans le **chaînage preuve LMS → document légal** (NC-1 à NC-3) et la **rétention des preuves natives** (NC-4).

---

## 3. Audit des 3 conditions cumulatives (D.6313-3-1)

### 3.1 Condition §1 — Assistance technique ET pédagogique + délais ⇒ Ind.19

**Constat NC-1 — 🔴 NON-CONFORMITÉ MAJEURE.**

- Le dossier place le **tuteur RAG** en **V1** (`11-ROADMAP/01` : « Tuteur RAG (assistance pédagogique ancrée, Ind.19) ») et ne prévoit au MVP qu'une « assistance/tuteur **basique** » (step 9), **sans modèle de données ni délais formalisés**.
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` ne contient **aucune entité** pour : (a) demander de l'aide, (b) tracer la réponse, (c) prouver le **délai** de réponse.
- Or **Ind.19 est la SEULE obligation FOAD nommée** dans le RNQ et exige une assistance **technique ET pédagogique accessible**, avec **modalités et délais formalisés** + **preuve d'activation**.

> ⚠️ Un tuteur RAG IA ne suffit pas, à lui seul, à cocher Ind.19 : l'auditeur attend (1) l'**information préalable** de l'apprenant sur les modalités/délais, (2) un **canal humain** atteignable, (3) la **traçabilité** des sollicitations et des réponses dans les délais annoncés.

**À CONSTRUIRE (NEUF) — spec minimale MVP :**

```prisma
// 03-DATA-MODEL/ (à ajouter — additif, ADR-0008)
enum ElearningAssistanceType { technique pedagogique }
enum ElearningAssistanceStatut { ouverte en_cours repondue cloturee }

model ElearningAssistanceRequest {
  id           String   @id @default(uuid()) @db.Uuid
  enrollmentId String   @map("enrollment_id") @db.Uuid   // cf. ElearningEnrollment (doc 02)
  lessonId     String?  @map("lesson_id") @db.Uuid
  type         ElearningAssistanceType
  statut       ElearningAssistanceStatut @default(ouverte)
  message      String   @db.Text
  canal        String   @db.VarChar(40)   // portail | email | tuteur_ia
  // Preuve de DÉLAI (Ind.19) : SLA annoncé vs réalisé
  slaHeures    Int      @map("sla_heures")            // ex. 48h ouvrées (valeur affichée à l'apprenant)
  reponduAt    DateTime? @map("repondu_at")
  reponduParId String?  @map("repondu_par_id") @db.Uuid // AdminUser/formateur (réponse HUMAINE traçable)
  reponse      String?  @db.Text
  createdAt    DateTime @default(now()) @map("created_at")
  @@index([enrollmentId]) @@index([statut]) @@map("elearning_assistance_requests")
}
```

- **Information préalable** (modalités + délais) : champ `ElearningCourse.modalitesAssistance` (Json) ou bloc dédié, **affiché dans le programme FOAD et la convention**.
- **Canal** : route portail `/[locale]/portail/elearning/[courseSlug]/aide` (server action `creerDemandeAssistance` sous `src/server/elearning/assistance/`).
- **Worker** : `elearning-assistance-sla-worker.ts` (cron BullMQ) → alerte admin si `slaHeures` proche d'expiration (preuve d'activation + respect du délai).
- **Tuteur RAG (V1)** : réutilise le RAG knowledge existant ; **ses échanges DOIVENT être loggés** dans `ElearningAssistanceRequest` (canal `tuteur_ia`) pour faire preuve — un wrapper ChatGPT nu non tracé ne vaut rien en audit.

**Verdict §1 : 🔴 MAJEUR. À corriger AVANT toute vente FOAD.** L'assistance ne peut pas être « V1 » si on vend dès le MVP.

---

### 3.2 Condition §2 — Information sur les activités + durée moyenne ⇒ Ind.1/6

**Constat — 🟡 CONFORME SOUS CONDITION.**

- ✅ Le data model porte la durée : `ElearningCourse.dureeEstimeeMinutes` (cache de la somme), `ElearningLesson.dureeEstimeeMinutes` (microlearning 2-10 min), agrégée pour l'affichage (`doc 01 §8` cite explicitement « information de durée exigée par D.6313-3-1 §2 »).
- ✅ La structure activités est descriptible : `ElearningModule` ordonné + `ElearningLesson.type` (video/texte/pdf/quiz/embed/devoir).
- 🟡 **MAIS** rien ne prouve que cette information est **portée contractuellement** (programme FOAD + convention) ni qu'on distingue **durée estimée** (annoncée a priori) de **durée moyenne de réalisation** (observée a posteriori). D.6313-3-1 §2 parle d'**information sur la durée** : la durée estimée suffit pour l'information préalable, mais le **certificat** doit refléter les **heures réalisées** (cf. NC-3).
- 🟡 **`estFoad` (`ElearningCourse.estFoad = true` par défaut)** : risque de marquer FOAD un cours qui n'a pas les 3 conditions. **À gater** : ne pas pouvoir publier `estFoad=true` tant que (assistance configurée) + (≥1 évaluation jalonnante) + (durée renseignée) ne sont pas réunies (garde applicative côté `publishCourse`).

**À CONSTRUIRE :**

- Garde de publication `assertFoadCompliant(course)` dans `src/server/elearning/courses/publish.ts` — bloque la publication d'un cours `estFoad` non conforme (miroir de `conformite.ts` côté Qualiopi PDF). Reprend l'esprit du garde-fou existant qui bloque facture/convention si identité OF vide.
- Champ `ElearningCourse.programmeFoadJson` (ou réutiliser `Formation.programmeDetaille` quand `formationId` présent) → injecté dans la **convention** et le **certificat**.

**Verdict §2 : 🟡 OK si la garde de publication FOAD + l'injection contractuelle sont livrées au MVP.**

---

### 3.3 Condition §3 — Évaluations qui jalonnent ET concluent ⇒ Ind.11 (MAJEUR)

**Constat NC-2 — 🔴 NON-CONFORMITÉ MAJEURE.**

- ✅ Le **gating par score** est correctement modélisé : `ElearningUnlockType.score_quiz` + `ElearningModule.unlock_quiz_id`/`unlock_score_pct` + `ElearningCourse.seuilReussitePct` (doc 01). C'est la **brique « évaluations qui jalonnent »**.
- ✅ Le moteur de quiz interactif (doc 03, référencé) doit produire `QuizAttempt`/score → c'est la **brique « évaluation qui conclut »** (quiz final + `seuilReussitePct`).
- 🔴 **LE TROU :** rien dans le dossier ne **relie le résultat de quiz au réceptacle légal `EvaluationAcquis`** (existant, `schema.prisma:5653`). Or `EvaluationAcquis` est la table où le reste de la plateforme (présentiel, AFEST) range ses preuves d'évaluation, et c'est ce qui alimente l'attestation/certificat. **Sans ce pont, les scores de quiz vivent dans une table parallèle invisible du faisceau de preuves Qualiopi** → en audit, l'évaluation FOAD apparaît « non documentée » = non-conformité **majeure** Ind.11.
- 🔴 **Évaluation à l'entrée** : Ind.8/positionnement. Le dossier ne prévoit pas de **quiz/positionnement de début** FOAD (le `Questionnaire.positionnement` existe mais n'est pas câblé au parcours e-learning).
- ⚠️ **Gating attempt-only interdit** : la best-practice 2026 (et l'auditeur) exigent un **vrai score** (note réelle, pondérée), pas un simple « a tenté le quiz ». Vérifier que `unlock_score_pct` est un **seuil de note** et non un drapeau de tentative. (Décision déjà prise dans le brief — à faire respecter dans le moteur.)

**À CONSTRUIRE (NEUF) — pont preuve obligatoire :**

```
quiz terminé (ElearningQuizAttempt, doc 03)
   └─> à la complétion d'une lesson type=quiz OU d'un quiz final :
        upsert EvaluationAcquis {
          enrollmentId  : <ElearningEnrollment relié à un Enrollment OU nouveau lien>,
          type          : EvaluationType.<formative|sommative>,
          scoreObtenu/Max/Pct, reussite (= scorePct >= seuil),
          niveauGlobal, competences (mapping vers objectifs pédagogiques),
          dateEvaluation, documentId? (grille PDF si high-stakes)
        }
```

- **Difficulté de rattachement** : `EvaluationAcquis.enrollmentId` pointe vers `Enrollment` (session synchrone) OU `coachingSessionId`. Pour un cours e-learning **autonome** (vendu seul, sans session), il faut **ajouter une 3e voie** : `EvaluationAcquis.elearningEnrollmentId` (nullable, additif) + faire respecter l'invariant « exactement un de (enrollmentId, coachingSessionId, elearningEnrollmentId) ». **C'est une modification additive du modèle existant** — conforme ADR-0008.
- **Worker** : `elearning-evaluation-bridge-worker.ts` (ou inline dans la server action de soumission de quiz) écrit `EvaluationAcquis` de façon idempotente (upsert sur clé `[elearningEnrollmentId, quizId]`).
- **Jalonnement** : chaque module verrouillé par `score_quiz` produit une `EvaluationAcquis` formative ; le quiz final produit la **sommative** qui conditionne le certificat.
- **Positionnement** : au 1er accès, proposer un `Questionnaire.positionnement` (ou un quiz diagnostic non bloquant) → preuve Ind.8.

**Verdict §3 : 🔴 MAJEUR.** Le moteur de quiz seul ne suffit pas : **sans le pont vers `EvaluationAcquis`, l'évaluation FOAD n'est pas opposable.** À livrer au MVP.

---

## 4. Faisceau de preuves de réalisation (R.6313-3)

**Constat NC-3 (heures réalisées) — 🔴 MINEUR (→ MAJEUR si non corrigé avant 1re facturation).**

### 4.1 Composantes du faisceau — couverture

| Composante de preuve                   | Statut              | Source                                                                                                                          |
| -------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Évaluations** (jalonnantes + finale) | 🔴 à câbler         | `EvaluationAcquis` via pont NC-2                                                                                                |
| **Travaux rendus** (devoirs)           | 🟡 modélisé         | `ElearningLessonType.devoir` (doc 01) + upload R2 → mais **modèle de soumission `ElearningSubmission` à spécifier** (doc 02/03) |
| **Logs LMS / progression**             | 🟡 modélisé         | `LessonProgress` (doc 02), heartbeat video, `PortailAcces.lastUsedAt`                                                           |
| **Traces d'accompagnement**            | 🔴 manquant         | NC-1 (`ElearningAssistanceRequest`)                                                                                             |
| **Relevé de connexion**                | ✅ pattern existant | mais **insuffisant seul** (R.6313-3) — OK car combiné                                                                           |

> ✅ Le **faisceau est correct dans son principe** (plusieurs sources indépendantes). 🔴 Mais deux de ses cinq composantes (évaluations câblées, traces d'assistance) sont absentes → en l'état le faisceau **repose trop sur les logs de connexion**, ce que R.6313-3 interdit explicitement comme preuve unique.

### 4.2 Calcul des « heures réalisées » pour le certificat — LE point sensible

- 🔴 **Problème de fond non traité par le dossier** : le **certificat de réalisation officiel** exige des **heures réalisées**. En FOAD, **le temps de visionnage vidéo ≠ heures de formation** (D.6313-3-1 retient la **durée estimée des activités**, pas le temps de connexion). Brancher le certificat sur le watch-time serait **juridiquement faux** et attaquable.
- **Règle défendable à spécifier** (NEUF) : `heuresRealisees = Σ dureeEstimeeMinutes des lessons COMPLÉTÉES (completion réelle : vidéo vue ≥ seuil + quiz réussi + devoir rendu)`, plafonnée à la durée du parcours, avec **override admin justifié** (`metadata` du `DocumentGenere`). C'est l'équivalent FOAD du `tauxPresencePct` synchrone.
- **Classification** : réutiliser `AttestationResultat` (≥80 % complétion → certificat complet ; 60-79 → partiel ; <60 → aucun) appliquée à la complétion pondérée.

**À CONSTRUIRE :**

- `src/server/elearning/certificats/compute-heures-realisees.ts` (règle ci-dessus, testée).
- `elearning-certificat-worker.ts` : génère le `DocumentGenere` (type `certificat_realisation`), réutilise template PDF + `qrToken` + `hashSha256` + `suppressionPrevueAt`. **Mentions FOAD obligatoires** : modalité « à distance », heures réalisées, période, modalités d'évaluation, nom du certificateur si certifiant.
- **Template e-learning manquant** : créer `qualiopi-certificat-foad.tsx` (variante FOAD du certificat) — l'existant cible le présentiel.

**Verdict §4 : 🟡/🔴.** Faisceau correct en principe ; **bloquant tant que (a) le pont évaluations, (b) la règle d'heures réalisées, (c) le template FOAD** ne sont pas livrés.

---

## 5. Conservation & RGPD (rétention différenciée)

**Constat NC-4 — 🔴 NON-CONFORMITÉ MINEURE (mais relevée en contrôle a posteriori).**

- ✅ Les **PDF** (`DocumentGenere.suppressionPrevueAt = +5 ans`) sont couverts. ⚠️ Mais **5 ans < 10 ans comptable** (L.123-22) et **< 6 ans fiscal/OPCO** (L.102 B LPF) : pour les **factures et certificats liés à un financement**, 5 ans peut être **insuffisant**. À arbitrer : aligner `suppressionPrevueAt` sur **6 ans** (fiscal/OPCO) voire **10 ans** pour les pièces comptables, par **type de document**.
- 🔴 **Les preuves LMS natives n'ont AUCUNE politique de rétention** dans le data model : `LessonProgress`, `ElearningQuizAttempt`, `ElearningSubmission`, et les **logs techniques** (heartbeat, IP de connexion). Or :
  - **Preuves pédagogiques** (progression, tentatives, devoirs, évaluations) → **3 à 5 ans** (L.6362-6), voire 6 ans si OPCO.
  - **Logs techniques** (connexion, IP, user-agent) → **6 mois à 1 an** (CNIL délib. 2021-122). Les garder 5 ans = **sur-rétention = non-conformité RGPD**.
- ⚠️ **Auth apprenant + PII** : ADR-0001 ajoute `Trainee.passwordHash` (argon2id, nullable). RAS sur le principe, mais : (a) le hash doit suivre le **droit à l'effacement** existant (`Trainee.deletedAt` + `RgpdDemande`) ; (b) les **logs LMS contenant l'`enrollmentId`** doivent être purgés/anonymisés lors d'une demande RGPD.

**À CONSTRUIRE :**

- Champ `purgePrevueAt` (ou réutilisation du pattern `suppressionPrevueAt`) sur **chaque table de preuve LMS**, avec **durée par nature** :
  - `LessonProgress`, `EvaluationAcquis` (e-learning), `ElearningSubmission` → +5 ans (preuve réalisation).
  - logs techniques (nouvelle table `ElearningAccessLog` si on journalise IP) → **+12 mois** puis anonymisation.
- `elearning-retention-purge-worker.ts` (cron) — miroir du cron de purge `DocumentGenere` existant, **avec durées différenciées**.
- Étendre `RgpdDemande` (export/effacement) pour **inclure les données LMS** (cf. `04-audit-securite-rgpd.md`).

**Verdict §5 : 🔴 MINEUR.** Pas bloquant pour la 1re vente mais **non-conformité certaine en contrôle CNIL/OPCO** si non traité avant mise à l'échelle.

---

## 6. Indicateurs Qualiopi V8 FOAD — revue ligne à ligne

Périmètre FOAD V8 : **1, 6, 9, 10, 11, 12, 17, 19**.

| Ind.   | Exigence FOAD                                                          | Couverture dossier                                                                                                                        | Verdict                                                                              |
| ------ | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **1**  | Information publique chiffrée (durée, modalités, accessibilité).       | `ElearningCourse` (durée, objectifs, prérequis, publicVise) + vitrine SEO (V1). Modalité FOAD à afficher.                                 | 🟡 OK au MVP si la fiche cours publie durée + modalités d'éval + assistance.         |
| **6**  | Information sur prérequis, objectifs, modalités, délais d'accès.       | `prerequis`/`objectifs` (Json) ✅ ; **délais d'accès** (J+N octroi) non explicités côté info.                                             | 🟡 Ajouter l'affichage du délai d'accès.                                             |
| **9**  | Accueil / information / prise en main.                                 | **Aucun « livret d'accueil FOAD » / guide de prise en main plateforme** modélisé.                                                         | 🔴 MINEUR — créer un onboarding + livret (réutiliser `livret_accueil` DocumentType). |
| **10** | Adaptation aux publics (handicap inclus).                              | `Trainee.situationHandicap` + référent handicap **existants** ✅ ; accessibilité player = WCAG 2.2 AA (cf. `04-accessibilite-wcag22.md`). | 🟡 OK si player accessible + adaptation tracée.                                      |
| **11** | **Évaluations** (atteinte des objectifs). **MAJEUR.**                  | Voir **NC-2** : moteur quiz OK, **pont `EvaluationAcquis` manquant**.                                                                     | 🔴 MAJEUR.                                                                           |
| **12** | Suivi / engagement / anti-décrochage.                                  | **Relances auto = V1** ; au MVP, suivi = progression + alerte admin.                                                                      | 🟡 MINEUR au MVP (un suivi minimal suffit), 🔴 si zéro relance et décrochage massif. |
| **17** | Moyens pédagogiques/techniques adaptés.                                | `Formation.moyensTechniques`/`ressourcesPedagogiques` ✅ ; décrire la **plateforme LMS elle-même** comme moyen.                           | 🟡 OK si la plateforme est décrite.                                                  |
| **19** | **Assistance technique ET pédagogique.** Seule obligation FOAD nommée. | Voir **NC-1** : prévu en V1, **rien au MVP**.                                                                                             | 🔴 MAJEUR.                                                                           |

> **Deux indicateurs majeurs FOAD (11 et 19) ne sont pas tenus au MVP en l'état.** C'est rédhibitoire : un seul écart majeur en surveillance peut suspendre la certification.

---

## 7. CPF / RNCP / EDOF — readiness

**Constat — ✅ CONFORME (non-conformité CPF _assumée_ et correctement gérée).**

- ✅ ADR-0003 est juste : **e-learning non certifiant ⇒ non éligible CPF**. Le dossier ne prétend pas le contraire et gate EDOF (`EDOF_ENABLED=false`).
- ✅ La plomberie certification **existe déjà** côté `Formation` (`codeRncp`, `codeRs`, `cpfEligible` dérivé, `edofVerifieAt`, `blocsCompetences`). Un `ElearningCourse.formationId` adossé hérite de cette finançabilité.
- ⚠️ **RISQUE marketing/juridique** : ne **jamais** afficher « éligible CPF » / « finançable CPF » tant que `cpfEligible=false`. Une mention CPF prématurée = **fraude** (loi 2022-1587). À verrouiller dans le rendu vitrine (garde sur `cpfEligible`).
- 🟡 **RNCP évaluation à distance (V2)** : autorisée, mais exige **vérification d'identité + anti-fraude + absence d'assistance** pendant l'épreuve certifiante. L'auth magic-link (ADR-0001) prouve l'**accès**, pas l'**identité** de la personne qui compose. Proctoring **non obligatoire** (CNIL : proportionné, optionnel, alternative requise) mais **un contrôle d'identité minimal** sera nécessaire le jour de la certification. **Bien documenté comme V2** — pas un défaut MVP, mais à ne pas oublier dans `04-dossier-certification-rncp-rs.md`.
- 🟡 **EDOF « entrée effective »** : le brief exige une « 1re connexion réelle **substantielle** ». `PortailAcces.lastUsedAt` ne suffit pas (login ≠ activité substantielle). Définir le **déclencheur** : ex. 1re `LessonProgress` avec progression > X % OU 1re soumission. À coder derrière `EDOF_ENABLED`.

**Verdict §7 : ✅** pour le périmètre MVP (OPCO + entreprise + vente directe). CPF/EDOF correctement reportés ; seules vigilances = garde anti-mention-CPF + définition « entrée effective ».

---

## 8. Émargement / preuve de présence — piège classique

**Constat — ✅ CONFORME (le dossier évite le piège).**

- ✅ R.6313-3 : **pas d'émargement obligatoire en FOAD**. Le dossier ne tente pas d'imposer un émargement e-learning artificiel — correct.
- ✅ Le pattern `ReleveConnexionImport → PresenceCreneau` (synchrone) montre que l'équipe sait construire un faisceau de connexion. Pour l'asynchrone, l'équivalent = `LessonProgress` + heartbeat + quiz + devoirs.
- ⚠️ **Ne pas sur-interpréter le watch-time** comme « temps de présence » (cf. NC-3). La preuve d'assiduité FOAD = **complétion d'activités**, pas durée de connexion.

---

## 9. Liste consolidée des non-conformités résiduelles (backlog conformité)

| ID       | Constat                                                                                   | Gravité          | Lot                     | Livrable                                                                                                                             |
| -------- | ----------------------------------------------------------------------------------------- | ---------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **NC-1** | Assistance technique+pédagogique + délais (Ind.19) absente du MVP.                        | 🔴 MAJEUR        | MVP step 9 (remonter)   | `ElearningAssistanceRequest` + route portail aide + `elearning-assistance-sla-worker.ts` + info préalable dans programme/convention. |
| **NC-2** | Évaluations quiz non reliées à `EvaluationAcquis` (Ind.11).                               | 🔴 MAJEUR        | MVP step 6              | Champ `EvaluationAcquis.elearningEnrollmentId` (additif) + pont upsert + positionnement d'entrée.                                    |
| **NC-3** | Heures réalisées non calculées ; template certificat FOAD absent.                         | 🔴 MINEUR→MAJEUR | MVP step 7              | `compute-heures-realisees.ts` + `qualiopi-certificat-foad.tsx` + `elearning-certificat-worker.ts`.                                   |
| **NC-4** | Rétention LMS native non définie (preuves 3-5 ans ; logs 6-12 mois ; PDF align 6/10 ans). | 🔴 MINEUR        | MVP step 1 (data model) | `purgePrevueAt` par table + `elearning-retention-purge-worker.ts` + extension `RgpdDemande`.                                         |
| **NC-5** | `estFoad=true` publiable sans les 3 conditions réunies.                                   | 🟡 MINEUR        | MVP step 8              | Garde `assertFoadCompliant()` dans `publishCourse`.                                                                                  |
| **NC-6** | Livret d'accueil / prise en main plateforme (Ind.9) absent.                               | 🟡 MINEUR        | MVP step 10             | Onboarding + `livret_accueil` FOAD.                                                                                                  |
| **NC-7** | Délai d'accès (Ind.6) et modalité « à distance » non affichés sur la fiche.               | 🟡 MINEUR        | V1 vitrine              | Affichage durée + délai + modalités d'éval + assistance.                                                                             |
| **NC-8** | Garde anti-mention « CPF » tant que `cpfEligible=false`.                                  | ⚠️ RISQUE        | MVP vitrine             | Verrou de rendu sur `cpfEligible`.                                                                                                   |
| **NC-9** | Définition EDOF « entrée effective substantielle » + identité RNCP.                       | 🟡 V2            | V2 (gaté)               | Déclencheur entrée effective ; contrôle identité épreuve certifiante.                                                                |

**Condition d'ouverture commerciale FOAD (gate) : NC-1, NC-2, NC-3, NC-4, NC-5 corrigés.** Les autres peuvent suivre en V1/V2 sans bloquer la finançabilité OPCO de base, **mais NC-6/NC-7 sont attendus à la 1re surveillance Qualiopi**.

---

## 10. Ce qui est CONFORME / bien orienté (à préserver)

- ✅ **Réutilisation maximale de l'existant** Qualiopi (DocumentGenere, EvaluationAcquis, Questionnaire, PortailAcces, AttestationResultat, certificat dans DocumentType) — pas de duplication, pas de second système de preuve divergent.
- ✅ **Migrations additives** (ADR-0008) — zéro risque sur la prod live ; tous les ajouts ci-dessus respectent ce contrat (colonnes nullable, nouvelles tables).
- ✅ **CPF correctement reporté** derrière certification + flag (ADR-0003) — pas de fausse promesse.
- ✅ **Pas d'émargement imposé** — bonne lecture de R.6313-3.
- ✅ **Tracking modélisé sur grammaire xAPI** (ADR-0006) — future-proof sans surcoût.
- ✅ **Vidéo externalisée** (Cloudflare Stream, URLs signées) — pas d'auto-hébergement, conforme à la best-practice et au budget.
- ✅ **Cloisonnement du code** (`src/server/elearning/**`) — auditable, isolé du noyau Qualiopi.

---

## 11. Recommandations de séquencement (impact roadmap)

Le `11-ROADMAP/01-phasage-mvp-v1-v2.md` place tuteur RAG (Ind.19) et relances (Ind.12) en **V1**. **Au minimum, NC-1 (assistance + délais formalisés, version humaine + traçable) doit remonter au MVP** — sinon le MVP n'est **pas finançable** et ne devrait **pas être vendu en FOAD**. Proposition :

- **MVP step 1** : ajouter au data model — `ElearningAssistanceRequest`, `EvaluationAcquis.elearningEnrollmentId`, `purgePrevueAt`/rétention. (Tout additif.)
- **MVP step 6** : pont quiz → `EvaluationAcquis` (NC-2) **dans la même PR que le moteur de quiz**.
- **MVP step 7** : `compute-heures-realisees` + template + worker certificat FOAD (NC-3).
- **MVP step 9** : assistance humaine traçable + SLA (NC-1) — **le tuteur RAG reste en V1**, mais le canal humain + délais + log existent dès le MVP.
- **MVP step 8** : garde `assertFoadCompliant` (NC-5).

---

## Liens

- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-0001 (auth), 0003 (CPF/RNCP), 0006 (xAPI), 0008 (migrations additives).
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — `ElearningCourse.estFoad`/`seuilReussitePct`/`dureeEstimeeMinutes`, `ElearningUnlockType.score_quiz` (base du gating Ind.11).
- `03-DATA-MODEL/02-schema-progression-tracking.md` _(à rédiger)_ — `LessonProgress`, heartbeat, traces de réalisation, `purgePrevueAt` (NC-4).
- `03-DATA-MODEL/03-schema-quiz-evaluations.md` _(à rédiger)_ — `Quiz`/`QuizAttempt` + **pont vers `EvaluationAcquis`** (NC-2).
- `08-CONFORMITE/01-foad-d6313-3-1.md` _(à rédiger)_ — détail des 3 conditions + spec assistance (NC-1).
- `08-CONFORMITE/02-qualiopi-indicateurs-foad.md` _(à rédiger)_ — preuves par indicateur (1/6/9/10/11/12/17/19).
- `08-CONFORMITE/03-cpf-edof-readiness.md` _(à rédiger)_ — entrée effective, garde anti-mention CPF (NC-8/NC-9).
- `08-CONFORMITE/05-rgpd-conservation-preuves.md` _(à rédiger)_ — rétention différenciée (NC-4).
- `08-CONFORMITE/06-tracabilite-preuves-realisation.md` _(à rédiger)_ — faisceau de preuves, heures réalisées (NC-3).
- `99-VERIFICATION/04-audit-securite-rgpd.md` _(à rédiger)_ — `Trainee.passwordHash`, purge LMS, droit à l'effacement.
- `11-ROADMAP/01-phasage-mvp-v1-v2.md` — remontée de NC-1 au MVP (section 11).
- Code réel : `prisma/schema.prisma` (Trainee:5274, Enrollment:5310, Formation:5061, DocumentGenere:5507, EvaluationAcquis:5653, Questionnaire:5704, PortailAcces:6236, DocumentType enum), `src/server/qualiopi/portail/portail-service.ts`, `src/lib/r2-storage.ts`.
