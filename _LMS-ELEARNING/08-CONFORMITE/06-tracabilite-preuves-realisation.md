# Traçabilité & preuves de réalisation (FOAD)

> **Objet.** Définir, de bout en bout, **ce que la plateforme e-learning enregistre** comme preuves de réalisation d'une action de formation à distance (FOAD), **comment ces preuves se produisent en contrôle** (exports OPCO / Qualiopi / France Compétences / juge), et **pourquoi le relevé de connexion seul ne suffit jamais**.
>
> Ce document est le **mode d'emploi conformité** des tables de tracking définies en `03-DATA-MODEL/02-schema-progression-tracking.md`. Il ne réinvente pas le data model : il cartographie chaque exigence réglementaire vers une donnée probante **précise** (modèle / champ Prisma) et vers le **code** qui la produit et l'exporte.
>
> Référence ADR : **ADR-LMS-0006** (tracking grammaire xAPI, sans LRS), **ADR-LMS-0003** (certification-ready / EDOF gated), **ADR-LMS-0007** (cloisonnement code), **ADR-LMS-0008** (migrations additives).
>
> Public : dev senior + référent Qualiopi. **FR canonique** (EN désactivé).

---

## 0. TL;DR pour un dev senior

- La preuve de réalisation FOAD est un **faisceau** (R.6313-3 : preuve **libre**), pas un document unique. **Cinq familles de preuves** : (1) **logs de connexion/activité horodatés**, (2) **progression & complétion** par leçon/module, (3) **résultats d'évaluations + travaux rendus**, (4) **traces d'assistance/tutorat**, (5) **certificat de réalisation** (modèle officiel, heures réalisées).
- **Le relevé de connexion seul est juridiquement insuffisant** (R.6313-3 + jurisprudence/contrôle OPCO) : il prouve une présence technique, **pas** une activité pédagogique ni l'atteinte des objectifs. Il doit être **corroboré** par activité réelle (`tempsPasseSec`, `progressed`), évaluations (`QuizAttempt`, Ind.11 **majeur**) et traces d'accompagnement (Ind.19).
- **Tout est déjà modélisé** : `ElearningXapiStatement` (journal append-only), `LessonProgress` / `ModuleProgress` / `CourseProgress` (agrégats datés), `QuizAttempt` (doc 03), `LessonProgress.devoirR2Key` (travaux), assistance (doc 04/09), `ElearningEnrollment.certificatDocumentId → DocumentGenere` (certificat). **Ce doc ne crée qu'une seule chose neuve : la couche d'export** (`src/server/elearning/conformite/**` + worker `elearning-preuve-export-worker.ts` + page admin).
- **Réutilisation forte de l'existant Qualiopi** : `DocumentGenere` + `qrToken` + `hashSha256` + `suppressionPrevueAt` (`schema.prisma:5507`) pour le certificat ; `formatHeuresCentiemes` (déjà utilisé par `certificat-realisation.tsx`) pour les heures ; pipeline R2 (`getSignedUrlR2`, `getObjectBufferR2`) pour les pièces ; doctrine **« archiver l'original, pas que le PDF »** (`DocumentGenere.fichierOriginalPath`).
- **Intégrité** : chaque export de preuve est **scellé** (SHA-256 + horodatage serveur) et **figé** (snapshot daté) → un agrégat exporté ne change plus même si l'apprenant continue.
- **Migrations additives** : ce doc n'ajoute que `ElearningPreuveExport` (+ enum) ; le reste consomme l'existant.

---

## 1. Cadre réglementaire (ce qu'il faut prouver)

| Texte                                                                                      | Exigence                                                                                                                                             | Conséquence traçabilité                                                                                                |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Art. D.6313-3-1** (FOAD, 3 conditions cumulatives)                                       | (1) assistance technique **ET** pédagogique ; (2) information sur les activités + **durée moyenne** ; (3) **évaluations qui jalonnent et concluent** | Il faut tracer l'accompagnement, la durée d'activité réelle, et les évaluations à plusieurs jalons                     |
| **Art. R.6313-3**                                                                          | Réalisation prouvée par **tout moyen** (preuve **libre**)                                                                                            | On constitue un **faisceau** ; aucune preuve unique imposée, mais le relevé de connexion seul est jugé **insuffisant** |
| **Art. L.6362-6 / L.6362-7**                                                               | Le prestataire doit pouvoir **justifier** la réalité de l'action en contrôle                                                                         | Données exportables, datées, intègres, conservées                                                                      |
| **Certificat de réalisation** (modèle officiel, obligatoire depuis 01/06/2020)             | Atteste les **heures réalisées** (modalité, intitulé, dates)                                                                                         | `DocumentGenere type=certificat_realisation`, heures en **centièmes**                                                  |
| **Qualiopi V8** (23/11/2023) — indicateurs FOAD : **1, 6, 9, 10, 11 (majeur), 12, 17, 19** | Critères audités spécifiquement en FOAD                                                                                                              | Mapping détaillé §6                                                                                                    |
| **CNIL** (proportionnalité, délib. 2021-122 logs)                                          | Minimisation : IP hachée, logs techniques **6–12 mois**                                                                                              | `ipHash` SHA-256, purge logs `elearning-xapi-purge-worker`                                                             |
| **EDOF / loi anti-fraude 2022-1587** (gated `EDOF_ENABLED`)                                | Entrée effective = 1re connexion réelle substantielle ; service fait                                                                                 | `ElearningEnrollment.premiereConnexionAt` (cf. `08-CONFORMITE/03-cpf-edof-readiness.md`)                               |

> Détail des indicateurs : `08-CONFORMITE/02-qualiopi-indicateurs-foad.md`. Conditions D.6313-3-1 : `08-CONFORMITE/01-foad-d6313-3-1.md`.

---

## 2. Les 5 familles de preuves — quoi enregistrer

Vue d'ensemble du **faisceau** produit par la plateforme. Colonne « État » = EXISTANT (réutilisé) vs NEUF (doc 02/03/04 déjà spécifiés, ou ce doc).

| #   | Famille de preuve                                                 | Source de vérité (modèle.champ)                                                                                          | État                | Doc d'origine         |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------- | --------------------- |
| 1   | **Logs de connexion & d'activité horodatés**                      | `ElearningXapiStatement` (verbe/objet, `occurredAt` serveur, `ipHash`)                                                   | NEUF                | doc 02 §7             |
| 2   | **Progression & complétion** par leçon/module/cours               | `LessonProgress` (`percentVu`, `tempsPasseSec`, `maxPositionSec`, `completedAt`), `ModuleProgress`, `CourseProgress`     | NEUF                | doc 02 §4–6           |
| 3a  | **Résultats d'évaluations** (quiz jalonnants + final)             | `QuizAttempt` (`scorePct`, `passed`, `submittedAt`) + `CourseProgress.evaluationsJalonsCount` / `evaluationFinaleFaite`  | NEUF                | doc 03 + doc 02 §6    |
| 3b  | **Travaux rendus** (devoirs)                                      | `LessonProgress.devoirR2Key` / `devoirRenduAt` (lesson `type=devoir`) + statement `submitted`                            | NEUF                | doc 02 §4             |
| 4   | **Traces d'assistance / tutorat** (Ind.19)                        | messages tuteur RAG + tickets (`04-BACKEND/09`) + statements `experienced` ; horodatage des réponses (délais formalisés) | NEUF                | doc 04/09             |
| 5   | **Certificat de réalisation** (heures réalisées, modèle officiel) | `ElearningEnrollment.certificatDocumentId → DocumentGenere(type=certificat_realisation)` + `qrToken` + `hashSha256`      | EXISTANT (pipeline) | doc 02 §3 + ce doc §5 |

**Preuves transverses indispensables au dossier (existant Qualiopi/CRM, à agréger dans l'export)** :

- **Identité de l'apprenant & consentements** : `Trainee` (`schema.prisma:5274`, PII chiffrée, consentements).
- **Octroi d'accès & financeur** : `ElearningEnrollment.source` / `accordeAt` / `clientId` (entreprise) / `orderId` (achat) — prouve **qui a ouvert l'accès et pourquoi**.
- **Information préalable sur le parcours & la durée** (D.6313-3-1 §2) : `ElearningCourse.dureeEstimeeMinutes` + `objectifs` + `prerequis` (doc 01) — capture **snapshot** dans l'export (le contenu vu, pas la version actuelle).
- **Programme / convention / financement OPCO** : modèles Qualiopi existants (`Formation`, `Convention`, `DocumentGenere type=convention`).

---

## 3. Détail par famille — ce que chaque preuve démontre

### 3.1 Logs de connexion & d'activité (`ElearningXapiStatement`)

Journal **append-only** (jamais d'UPDATE/DELETE hors purge de rétention), horodaté **temps serveur** (`occurredAt @default(now())`, anti-triche), IP **hachée SHA-256** (`ipHash`, jamais en clair, salt `IP_HASH_SALT` réutilisé de la banque d'images). Grammaire xAPI (`verb` / `objectType` / `objectId`) sans dépendance LRS.

**Ce que ça prouve** :

- **Entrée effective** (FOAD/EDOF) : 1er statement `launched` → écrit `ElearningEnrollment.premiereConnexionAt` (≠ `accordeAt`, qui n'est que l'octroi). C'est l'événement EDOF clé.
- **Assiduité réelle** : séquence `launched → initialized → progressed (×N, avec `resultPercent`) → paused/resumed → completed`. Le **rythme** et la **densité** des events distinguent une vraie activité d'une simple ouverture d'onglet.
- **Corroboration forensique légère** : `ipHash` + `userAgent` + `positionSec` recoupent `LessonProgress` (détection d'incohérences : ex. `completed` sans `progressed` antérieurs = suspect).

**Anti-fraude intégré au tracking** (côté `progress-service`, doc 02 §4/§8) :

- `tempsPasseSec` accumule des **deltas plafonnés** (un delta heartbeat > intervalle × 1,5 est tronqué : onglet laissé ouvert ≠ temps actif).
- Complétion vidéo exigée : `maxPositionSec ≥ 0,95 × videoDureeSec` (anti seek-to-end).
- Heartbeat **throttlé serveur** (~1 statement / 15 s / leçon) via `src/app/api/elearning/heartbeat/route.ts`.

### 3.2 Progression & complétion (`LessonProgress` / `ModuleProgress` / `CourseProgress`)

Agrégats **matérialisés et datés** (un agrégat = un instantané, recalculé transactionnellement par `progress-service.ts`). Ils transforment le flux brut de statements en preuve lisible par un auditeur.

**Ce que ça prouve** :

- **Activité par leçon** : `LessonProgress.tempsPasseSec` (temps **actif réel**, pas la durée de la vidéo) + `nbVues` + `percentVu` (monotone, ne décroît jamais).
- **Durée réalisée totale** (D.6313-3-1 §2 « durée moyenne ») : `CourseProgress.tempsTotalSec` = Σ des `tempsPasseSec`. C'est la base de l'estimation d'heures du **certificat** (cf. §5, arbitrage durée).
- **Progression / complétion** : `ModuleProgress.percentComplet` + `CourseProgress.percentComplet` + `completedAt` (100 % des leçons obligatoires).
- **Jalons d'évaluation** (Ind.11) : `CourseProgress.evaluationsJalonsCount` + `evaluationFinaleFaite`.

> Pourquoi 3 niveaux ? Perf (budget INP ≤ 100 ms : on lit 1 ligne `ModuleProgress` pour décider un verrou au lieu d'agréger N `LessonProgress`) **et** preuve (figer un instantané daté). Cf. doc 02 §1.

### 3.3 Résultats d'évaluations & travaux

- **Quiz** (`QuizAttempt`, doc 03) : `scorePct`, `passed`, `submittedAt`, réponses détaillées (`answered` statements). Les évaluations **jalonnent** (quiz de gating par module, `unlockType=score_quiz`) **et concluent** (quiz/évaluation finale) → satisfait l'**indicateur 11 (majeur)** : son absence est une **non-conformité majeure**.
- **Travaux rendus** (devoir) : `LessonProgress.devoirR2Key` (fichier sur R2 via `getSignedUploadUrlR2`) + `devoirRenduAt` + statement `submitted`. Preuve tangible de production de l'apprenant (réutilisable pour une correction manuelle, doc 03 « essai + correction manuelle »).

### 3.4 Traces d'assistance / tutorat (Ind.19 — seule obligation FOAD nommée)

L'**assistance technique ET pédagogique** doit être **accessible** avec des **délais formalisés**. À enregistrer (détail dans `04-BACKEND/09-tuteur-rag-assistant.md` et `04-BACKEND/10-emails-notifications.md`) :

- **Échanges tuteur** : horodatage de la question apprenant et de la réponse (mesure du **délai de réponse** = preuve de l'accessibilité formalisée). Statements `experienced` pour la consultation des ressources d'aide.
- **Relances anti-décrochage** (Ind.12, V1) : `elearning-relance-worker.ts` (cron) détecte l'inactivité (`ElearningEnrollment.dernierAccesAt`) → email tracé. La trace d'**envoi** est elle-même une preuve d'accompagnement.
- **Tuteur RAG ancré** (citations vérifiables) : journaliser les interactions comme statements (objet = ressource/leçon) pour prouver l'assistance pédagogique réelle, pas un chatbot générique.

> Le **squelette horodaté** (qui a demandé quoi, quand, réponse en combien de temps) est ce qui prouve l'Ind.19 ; le contenu pédagogique est secondaire en contrôle.

### 3.5 Certificat de réalisation (cf. §5)

Document **officiel** de clôture, attestant les **heures réalisées**. C'est la **synthèse** opposable du faisceau, pas sa seule preuve.

---

## 4. Pourquoi le relevé de connexion seul ne suffit PAS

Section à conserver telle quelle dans le dossier de conformité (argumentaire opposable).

1. **R.6313-3 = preuve libre, mais exigeante.** Le texte n'impose pas l'émargement en FOAD, **mais** la réalité de l'action se prouve par un **faisceau**. Un relevé de connexion isolé établit une **présence technique** (l'apprenant était connecté), **pas** :
   - une **activité pédagogique** (a-t-il réellement travaillé, ou laissé l'onglet ouvert ?),
   - l'**atteinte des objectifs** (Ind.11 : évaluations),
   - l'**accompagnement** (Ind.19 : assistance),
   - la **durée réelle d'activité** (≠ durée de connexion).
2. **Le contrôle OPCO/DREETS peut requalifier** une action en « non réalisée » si la seule pièce est un relevé de temps de connexion sans corroboration. Conséquence : **remboursement du financement** + risque Qualiopi (NC majeure Ind.11).
3. **Faille technique du relevé seul** : une connexion ouverte ne prouve pas l'attention ; un script peut maintenir une session. D'où l'**anti-fraude au niveau activité** (§3.1) : deltas plafonnés, anti seek-to-end, événements `progressed` réguliers.
4. **Doctrine de la plateforme** : le relevé de connexion (statements `launched`/`progressed` + `tempsPasseSec`) est **une** des cinq familles, **toujours** présenté **avec** : évaluations (3a), travaux (3b), assistance (4), certificat (5). L'export de preuve (§7) **refuse de produire un dossier** réduit au seul log de connexion (garde-fou `assertFaisceauComplet`, §7.3).

> Parallèle existant : côté présentiel/distanciel synchrone, le code Qualiopi applique déjà cette doctrine — `PresenceCreneau` (relevé) **plus** `EvaluationAcquis` (Ind.11) **plus** `Questionnaire`. La FOAD asynchrone applique la **même rigueur** avec ses propres tables.

---

## 5. Certificat de réalisation e-learning (réutilisation pipeline Qualiopi)

**Aucune nouvelle infra PDF.** On réutilise le pipeline `DocumentGenere` existant.

- **Modèle** : `DocumentGenere` (`schema.prisma:5507`), `type = certificat_realisation` (enum `DocumentType` existant, `schema.prisma:5481`).
- **Template** : `src/server/qualiopi/documents/templates/certificat-realisation.tsx` (existant). Les **heures sont rendues en centièmes** via `formatHeuresCentiemes(dureeHeures)` (ex. `7 → "7,00 heures"`) — obligation déjà câblée (`certificat-realisation.tsx:7,124,180`).
- **Génération** : `generateDocument(...)` (`src/server/qualiopi/documents/documents-service.ts:111`) → rend le PDF, calcule `hashSha256`, upload R2, pose `suppressionPrevueAt = +5 ans` (`DOCUMENT_RETENTION_YEARS`), et `qrToken` (vérification publique timing-safe).
- **Déclencheur** : `elearning-certificat-worker.ts` (doc 02 §9), enqueue par `completion-service.ts` quand `CourseProgress.reussite = true` (score global ≥ `ElearningCourse.seuilReussitePct`) **et** complétion 100 % obligatoires.
- **Liaison** : écrit `ElearningEnrollment.certificatDocumentId` + `certificatEmisAt` (doc 02 §3).

**Arbitrage « heures réalisées » pour un parcours asynchrone** (à figer avec le référent Qualiopi, documenté dans le certificat) :

- **Option A (recommandée FOAD)** : heures = **durée estimée du parcours** (`ElearningCourse.dureeEstimeeMinutes`, conforme à l'« information sur la durée moyenne » D.6313-3-1 §2), conditionnée à la **complétion + réussite**. C'est la pratique FOAD courante (on certifie la durée pédagogique du parcours réalisé, pas le chrono individuel).
- **Option B (chrono réel)** : heures = `CourseProgress.tempsTotalSec` arrondi. Plus défendable techniquement mais pénalise l'apprenant rapide ; à éviter sauf exigence financeur.
- **Décision** : Option A par défaut ; `tempsTotalSec` reste **archivé** comme preuve corroborante (jamais perdu). Le worker stocke les deux valeurs dans `DocumentGenere.metadata` (`{ dureeCertifiee, tempsActifSec, mode: "estimee|chrono" }`).

> Modalité à mentionner sur le certificat : **« à distance (FOAD) »** (le template doit recevoir la modalité ; aligner sur `ModaliteFormation`/`estFoad`).

---

## 6. Mapping Qualiopi V8 (FOAD) → donnée probante

| Indicateur        | Exigence                                                               | Donnée / champ probant                                                                             | Producteur (code)                                     |
| ----------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **1**             | Information publique sur prestations (objectifs, durée, modalités)     | `ElearningCourse.objectifs` / `dureeEstimeeMinutes` / `estFoad` (snapshot export)                  | doc 01 + catalogue (`05-FRONTEND/07`)                 |
| **6**             | Conditions d'accueil / accompagnement portées à connaissance           | Info parcours + tuteur (doc 04/09) ; capture snapshot                                              | export §7                                             |
| **9**             | Conditions de déroulement (情報 activités + durée) D.6313-3-1 §2       | `ElearningCourse.dureeEstimeeMinutes` + structure modules/leçons                                   | doc 01                                                |
| **10**            | Adaptation / individualisation                                         | Drip + gating (`ElearningUnlockType`), `ModuleProgress.overrideDeverrouille` (override tracé)      | `unlock-service.ts`                                   |
| **11 ★ (majeur)** | **Évaluations qui jalonnent ET concluent**                             | `QuizAttempt` (jalons + final) + `CourseProgress.evaluationsJalonsCount` / `evaluationFinaleFaite` | doc 03 + `completion-service.ts`                      |
| **12**            | Suivi de l'assiduité / engagement, relance                             | `LessonProgress.tempsPasseSec` + `ElearningEnrollment.dernierAccesAt` + relances tracées           | `progress-service.ts` + `elearning-relance-worker.ts` |
| **17**            | Moyens techniques & pédagogiques de la FOAD                            | Pipeline vidéo (HLS signé), ressources, tuteur ; trace d'accès aux ressources (`experienced`)      | doc 04/07/09                                          |
| **19**            | **Assistance technique ET pédagogique** (seule obligation FOAD nommée) | Échanges tuteur horodatés + délais de réponse + relances                                           | doc 04/09/10                                          |

> ⚠️ **Ind.11 = NC majeure si absente.** L'export de preuve (§7) **bloque** la production d'un dossier FOAD si `evaluationFinaleFaite = false` sur les enrollments `termine` (garde-fou §7.3) — pour ne jamais sortir un dossier non conforme en contrôle.

---

## 7. Production en contrôle — la couche d'export (NEUF)

C'est le **seul code réellement nouveau** de ce document. Tout le reste consomme des tables déjà spécifiées (doc 02/03/04).

### 7.1 Modèle Prisma `ElearningPreuveExport` (NEUF — additif)

Trace **chaque génération de dossier de preuve** (qui, quand, périmètre, scellé). Un export = un **instantané figé** (immuable) : on ne régénère pas, on en crée un nouveau.

```prisma
/// Statut de génération d'un dossier de preuves de réalisation.
enum ElearningPreuveExportStatut {
  en_attente   // job enqueue
  en_cours     // worker en train d'agréger + rendre
  pret         // dossier disponible (ZIP/PDF sur R2)
  echoue       // échec (faisceau incomplet, R2, rendu)
}

/// Portée d'un export de preuve.
enum ElearningPreuveExportPortee {
  enrollment   // 1 apprenant × 1 cours (dossier individuel — contrôle OPCO ciblé)
  course       // tous les apprenants d'un cours (audit Qualiopi)
  client       // tous les apprenants d'une entreprise (contrôle financeur pack)
  periode      // tous les enrollments d'une période (BPF, audit global)
}

model ElearningPreuveExport {
  id            String                       @id @default(uuid()) @db.Uuid

  portee        ElearningPreuveExportPortee
  /// Cibles selon la portée (null si non pertinent). FK souples (objets archivables).
  enrollmentId  String?                      @map("enrollment_id")            // portee=enrollment
  courseId      String?                      @map("course_id")                // portee=course
  clientId      String?                      @map("client_id") @db.Uuid       // portee=client
  client        Client?                      @relation("ClientPreuveExports", fields: [clientId], references: [id], onDelete: SetNull)
  periodeDebut  DateTime?                    @map("periode_debut")            // portee=periode
  periodeFin    DateTime?                    @map("periode_fin")

  statut        ElearningPreuveExportStatut  @default(en_attente)
  format        String                       @default("zip") @db.VarChar(10)  // zip | pdf

  /// Clé R2 du dossier scellé (ZIP : PDF synthèse + pièces + manifest.json).
  r2Key         String?                      @map("r2_key") @db.VarChar(300)
  /// SHA-256 du dossier produit (intégrité opposable).
  hashSha256    String?                      @map("hash_sha256") @db.VarChar(64)
  sizeBytes     Int                          @default(0) @map("size_bytes")
  /// Compteurs de complétude du faisceau (audit rapide).
  nbEnrollments Int                          @default(0) @map("nb_enrollments")
  nbStatements  Int                          @default(0) @map("nb_statements")
  nbEvaluations Int                          @default(0) @map("nb_evaluations")
  nbCertificats Int                          @default(0) @map("nb_certificats")
  /// Anomalies de faisceau détectées (ex. Ind.11 manquant) — JSON [{code,message,enrollmentId}].
  anomaliesJson Json                         @default("[]") @map("anomalies_json")
  errorMessage  String?                      @map("error_message") @db.Text

  /// Admin Axion-IA déclencheur (RBAC) + horodatage.
  createdByAdminId String?                   @map("created_by_admin_id") @db.Uuid
  createdByAdmin   AdminUser?                @relation("AdminPreuveExports", fields: [createdByAdminId], references: [id], onDelete: SetNull)

  /// = createdAt + 5 ans (aligné DocumentGenere). Purge par cron.
  suppressionPrevueAt DateTime               @map("suppression_prevue_at")
  startedAt     DateTime?                    @map("started_at")
  finishedAt    DateTime?                    @map("finished_at")
  createdAt     DateTime                     @default(now()) @map("created_at")

  @@index([portee, statut])
  @@index([clientId])
  @@index([courseId])
  @@index([suppressionPrevueAt])
  @@map("elearning_preuve_exports")
}
```

**Champs inverses additifs** (aucune colonne côté tables existantes) :

```prisma
// model Client { ... }
  elearningPreuveExports ElearningPreuveExport[] @relation("ClientPreuveExports")

// model AdminUser { ... }
  elearningPreuveExportsLances ElearningPreuveExport[] @relation("AdminPreuveExports")
```

> Migration `prisma/migrations/<ts>_elearning_preuve_export/migration.sql` : `CREATE TYPE` (2 enums) + `CREATE TABLE elearning_preuve_exports` + `CREATE INDEX` + champs inverses (sans colonne). **Strictement additif** (ADR-0008).

### 7.2 Contenu d'un dossier de preuve exporté (le ZIP scellé)

Pour une portée `enrollment` (dossier individuel = unité de contrôle OPCO) :

```
preuve-<numeroExport>.zip
├─ 00-synthese.pdf            ← PDF récapitulatif (identité, cours, dates, heures, scores, statut faisceau)
├─ 01-attestation-acces.pdf   ← octroi : source, accordeAt, premiereConnexionAt, financeur (client/order)
├─ 02-releve-activite.csv     ← export ElearningXapiStatement (occurredAt, verb, objectType, objectId, resultPercent, positionSec, ipHash)
├─ 03-progression.csv         ← LessonProgress + ModuleProgress + CourseProgress (percent, tempsPasseSec, completedAt)
├─ 04-evaluations.csv         ← QuizAttempt (scorePct, passed, submittedAt) + jalons + finale (Ind.11)
├─ 05-travaux/                ← devoirs rendus (LessonProgress.devoirR2Key) — copies des fichiers R2
├─ 06-assistance.csv          ← échanges tuteur + délais de réponse + relances envoyées (Ind.19/12)
├─ 07-certificat.pdf          ← DocumentGenere(certificat_realisation), heures en centièmes
└─ manifest.json              ← hashs SHA-256 de chaque pièce + horodatage + version schéma + signature export
```

`manifest.json` scelle l'intégrité : chaque pièce a son `sha256`, le dossier entier a son `hashSha256` (stocké dans `ElearningPreuveExport.hashSha256`). **Opposabilité** : un dossier modifié a un hash différent.

### 7.3 Services & garde-fous (NEUF, `src/server/elearning/conformite/**`)

| Fichier cible                                              | Rôle                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/server/elearning/conformite/preuve-collector.ts`      | Agrège le faisceau pour un `enrollmentId` : lit `ElearningEnrollment` + `CourseProgress` + `ModuleProgress` + `LessonProgress` + `ElearningXapiStatement` + `QuizAttempt` (doc 03) + traces assistance. Retourne un objet `DossierPreuve` typé.                                                                          |
| `src/server/elearning/conformite/faisceau-guard.ts`        | `assertFaisceauComplet(dossier)` : **refuse** un dossier réduit au seul relevé de connexion. Règles : (a) au moins 1 évaluation **finale** si `statut=termine` (Ind.11) ; (b) `tempsPasseSec > 0` corroborant les statements ; (c) certificat présent si `reussite`. Sinon → `anomaliesJson` (warn) ou throw selon mode. |
| `src/server/elearning/conformite/preuve-export-service.ts` | Orchestration : crée `ElearningPreuveExport`, enqueue le worker. Rendu PDF synthèse via le pipeline `@react-pdf/renderer` (réutilise `renderPdfToBuffer` de `documents-service`).                                                                                                                                        |
| `src/server/elearning/conformite/manifest.ts`              | Construit `manifest.json` + calcule les hashs (réutilise l'utilitaire SHA-256 de `documents-service`).                                                                                                                                                                                                                   |

**Worker** : `src/server/queue/workers/elearning-preuve-export-worker.ts` (convention `elearning-*-worker.ts`, file déclarée dans `src/server/queue/queues.ts`).

1. `statut → en_cours`, `startedAt`.
2. Résout les `enrollmentId` selon la portée.
3. Pour chaque : `preuve-collector` → `faisceau-guard` (collecte anomalies).
4. Rend `00-synthese.pdf` + `07-certificat.pdf` (régénère URL signée du `DocumentGenere`), exporte les CSV, copie les fichiers de devoirs depuis R2 (`getObjectBufferR2`).
5. Zippe, calcule `hashSha256`, upload R2 (`uploadToR2`, clé `exports/elearning/preuves/<id>.zip`).
6. `statut → pret`, `finishedAt`, compteurs + `anomaliesJson`. (Échec → `echoue` + `errorMessage`.)

**Server action** : `src/server/elearning/conformite/preuve-export.actions.ts` (`"use server"`) — `lancerExportPreuve({ portee, ... })`, gardée par `requireAdminWrite()` (RBAC existant `src/server/actions/knowledge/_guards.ts`). Download via route handler `src/app/[locale]/(admin)/[adminPrefix]/elearning/conformite/preuves/[id]/download/route.ts` (`force-dynamic`, URL signée R2 courte).

### 7.4 UI admin (NEUF)

- Page : `src/app/[locale]/(admin)/[adminPrefix]/elearning/conformite/preuves/page.tsx` — liste des exports (`AdminPageShell` + `AdminTable` + `AdminBadge`), bouton « Générer un dossier de preuves » (modale portée), colonne statut + complétude faisceau + anomalies.
- Entrée nav : ajouter dans `src/lib/admin-nav.ts` un item du pôle e-learning, ex. `{ href: \`${base}/elearning/conformite/preuves\`, label: "Preuves de réalisation", icon: "🧾", group: "elearning" }`(cf.`06-CONSOLE-ADMIN/01-navigation-structure.md`). **Rappel** : le composant monté est `AdminSidebarNav.tsx`.
- Vue détail apprenant (`.../elearning/apprenants/[traineeId]`) : encart « Faisceau de preuves » résumant les 5 familles + bouton export individuel.

### 7.5 Compatibilité build `stub.invalid`

Toutes les routes/pages de conformité sont **derrière auth admin + `force-dynamic`** → aucun appel DB au SSG. Le worker ne tourne qu'au runtime (BullMQ désactivé au build, `BULLMQ_DISABLED=true`). Les services répliquent le garde `if (process.env["DATABASE_URL"]?.includes("stub.invalid"))` (lecture → vide, mutation → throw), comme `portail-service.ts` / `documents-service.ts:121`.

---

## 8. Intégrité, horodatage & non-répudiation

- **Horodatage serveur** partout (`occurredAt`/`createdAt` `@default(now())`) — jamais l'horloge client (anti-triche). Stockage UTC, affichage Europe/Paris (cohérent `PresenceCreneau`).
- **Scellement SHA-256** : statements bruts → CSV → pièces → `manifest.json` → `ElearningPreuveExport.hashSha256`. Même doctrine que `DocumentGenere.hashSha256` (`schema.prisma:5525`) et `ReleveConnexionImport.hashSha256` (`:6384`).
- **Archiver l'original, pas que le PDF** : pour tout import externe (ex. relevé de classe virtuelle replay/embed comptant comme `attended`), conserver le fichier source via `fichierOriginalPath` (doctrine CDC déjà inscrite dans `DocumentGenere`/`ReleveConnexionImport`).
- **Immuabilité de l'export** : un `ElearningPreuveExport` `pret` n'est jamais ré-écrit ; un nouveau contrôle = un nouvel export daté (l'historique des dossiers produits est lui-même une preuve).
- **Vérification publique** : `qrToken` du certificat (timing-safe) permet à un tiers (OPCO, employeur) de vérifier l'authenticité sans accès admin.

---

## 9. Conservation & purge (rétention différenciée)

Appliquée par crons, **migrations additives**. Aligne sur `08-CONFORMITE/05-rgpd-conservation-preuves.md`.

| Donnée                                                                               | Durée                           | Base légale                         | Mécanisme                                          |
| ------------------------------------------------------------------------------------ | ------------------------------- | ----------------------------------- | -------------------------------------------------- |
| **Logs techniques** (`ElearningXapiStatement`)                                       | **6 mois – 1 an**               | CNIL délib. 2021-122                | `elearning-xapi-purge-worker.ts` (cron, doc 02 §9) |
| **Agrégats de réalisation** (`CourseProgress` / `ModuleProgress` / `LessonProgress`) | **3–5 ans**                     | preuve de réalisation L.6362-6      | conservés ; purge alignée `suppressionPrevueAt`    |
| **Évaluations / travaux** (`QuizAttempt`, devoirs R2)                                | **3–5 ans**                     | preuve pédagogique                  | R2 lifecycle + DB                                  |
| **Certificat** (`DocumentGenere`)                                                    | **5 ans**                       | `DOCUMENT_RETENTION_YEARS` existant | `suppression_prevue_at` (`:5534`)                  |
| **Dossiers de preuve** (`ElearningPreuveExport` + ZIP R2)                            | **5 ans**                       | preuve de contrôle                  | `suppressionPrevueAt` + cron purge                 |
| Données comptables/financières (factures e-learning)                                 | 6 ans fiscal / 10 ans comptable | L.102B LPF / L.123-22               | doc 05 (e-commerce), pas ici                       |

> ⚠️ **Tension RGPD/preuve** : la purge des **logs techniques** (6–12 mois) est **plus courte** que la conservation des **agrégats/preuves** (3–5 ans). C'est volontaire et conforme : on **minimise** les données forensiques (IP, UA) tout en **conservant** la preuve de réalisation agrégée. L'`ipHash` (jamais en clair) réduit encore l'empreinte. La purge des statements **n'efface pas** la preuve de réalisation (portée par les agrégats datés, déjà figés dans les exports antérieurs).
>
> **RGPD effacement** : suppression `Trainee` (`deletedAt` + `RgpdDemande` existants) → cascade `ElearningEnrollment` → progression/statements supprimés. Les **dossiers de preuve déjà exportés** (obligation légale de justification) sont conservés selon arbitrage `08-CONFORMITE/05` (conservation au titre d'une obligation légale prime le droit à l'effacement, anonymisation si possible).

---

## 10. EXISTANT réutilisé vs NEUF (récap)

**Réutilisé (zéro duplication)** :

- `DocumentGenere` + `qrToken` + `hashSha256` + `suppressionPrevueAt` + `fichierOriginalPath` (`schema.prisma:5507`) ; `generateDocument` / `renderPdfToBuffer` (`documents-service.ts:111`) ; `certificat-realisation.tsx` + `formatHeuresCentiemes`.
- R2 : `uploadToR2`, `getSignedUrlR2`, `getSignedUploadUrlR2`, `getObjectBufferR2` (`src/lib/r2-storage.ts`).
- Doctrine Qualiopi : faisceau de preuves (`PresenceCreneau` + `EvaluationAcquis` + `Questionnaire`), « archiver l'original », heures en centièmes, rétention 5 ans.
- RBAC admin (`requireAdminWrite`), `AdminPageShell`/`AdminTable`/`AdminBadge`, `admin-nav.ts` (`AdminSidebarNav.tsx`), BullMQ `queues.ts`.
- Tables tracking déjà spécifiées : `ElearningXapiStatement`, `LessonProgress`, `ModuleProgress`, `CourseProgress`, `ElearningEnrollment`, `QuizAttempt`.

**Neuf (ce document)** :

- Modèle `ElearningPreuveExport` + enums `ElearningPreuveExportStatut` / `ElearningPreuveExportPortee` (+ champs inverses `Client`/`AdminUser`).
- Couche conformité : `preuve-collector.ts`, `faisceau-guard.ts` (`assertFaisceauComplet`), `preuve-export-service.ts`, `manifest.ts` sous `src/server/elearning/conformite/**`.
- Worker `elearning-preuve-export-worker.ts` + cron de purge des exports.
- Server action `preuve-export.actions.ts` + route download + page admin + item nav.

---

## 11. Checklist d'implémentation

- [ ] Migration additive `elearning_preuve_export` (2 enums + table + index + inverses) ; `pnpm prisma:generate` ; build `stub.invalid` OK.
- [ ] `preuve-collector.ts` (agrège les 5 familles pour un enrollment).
- [ ] `faisceau-guard.ts` (`assertFaisceauComplet` : bloque relevé-seul, contrôle Ind.11).
- [ ] `preuve-export-service.ts` + `manifest.ts` (scellé SHA-256).
- [ ] `elearning-preuve-export-worker.ts` (ZIP + R2 + hash) + déclaration `queues.ts`.
- [ ] `preuve-export.actions.ts` (`requireAdminWrite`) + route download `force-dynamic`.
- [ ] Page admin `elearning/conformite/preuves` + item `admin-nav.ts` (pôle e-learning).
- [ ] Brancher `elearning-certificat-worker` sur `completion-service` (certificat à la réussite, heures Option A).
- [ ] Cron purge logs (`elearning-xapi-purge-worker`) + cron purge exports (`suppressionPrevueAt`).
- [ ] Tests Vitest : `assertFaisceauComplet` (refuse relevé-seul), intégrité manifest (hash reproductible), idempotence export, garde `stub.invalid`, RBAC.
- [ ] Revue référent Qualiopi : arbitrage heures certificat (A/B) + libellé modalité FOAD.

---

## Liens

- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-0003 (certification-ready/EDOF), ADR-0006 (tracking xAPI), ADR-0007 (cloisonnement), ADR-0008 (migrations additives).
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — `ElearningCourse.dureeEstimeeMinutes` / `estFoad` / `seuilReussitePct`.
- `03-DATA-MODEL/02-schema-progression-tracking.md` — **source des preuves** : `ElearningXapiStatement`, `LessonProgress`, `ModuleProgress`, `CourseProgress`, `ElearningEnrollment`, workers `elearning-*`.
- `03-DATA-MODEL/03-schema-quiz-evaluations.md` — `Quiz` / `QuizAttempt` (Ind.11 : jalons + final).
- `03-DATA-MODEL/04-schema-comptes-acces-auth.md` — identité apprenant (`Trainee`), octroi (`ElearningEnrollment.source`).
- `03-DATA-MODEL/06-strategie-migrations.md` — séquence migrations additives.
- `04-BACKEND/09-tuteur-rag-assistant.md` & `04-BACKEND/10-emails-notifications.md` — traces d'assistance (Ind.19) & relances (Ind.12).
- `05-FRONTEND-APPRENANT/06-certificats-badges.md` — certificat côté apprenant.
- `06-CONSOLE-ADMIN/01-navigation-structure.md` & `08-reporting-analytics.md` — UI export & reporting conformité.
- `08-CONFORMITE/01-foad-d6313-3-1.md`, `02-qualiopi-indicateurs-foad.md`, `03-cpf-edof-readiness.md`, `05-rgpd-conservation-preuves.md` — cadre dont ce doc est la mise en œuvre traçabilité.
