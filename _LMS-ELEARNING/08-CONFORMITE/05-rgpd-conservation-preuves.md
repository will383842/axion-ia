# RGPD & conservation des preuves — LMS e-learning (FOAD)

> Spécification de la **conservation des données**, de la **purge**, des **droits des personnes** et du **registre** pour le module e-learning.
> Lecteur cible : développeur·se senior. Distingue explicitement **EXISTANT (réutilisé)** et **NEUF (à construire)**.
> Décisions figées : migrations **additives** (ADR-LMS-0008), code cloisonné sous `src/server/elearning/**` (ADR-LMS-0007), FR canonique, build `stub.invalid` (early-exit obligatoire sur toute mutation).

---

## 0. TL;DR (ce qu'on construit)

1. On **réutilise** le `RgpdDemande` existant + `rgpd-service.ts` (export/anonymisation/demande) et on **étend** l'export + l'anonymisation pour couvrir les nouvelles entités e-learning.
2. On **réutilise** le `retention-purge-worker.ts` existant (cron 03:00 UTC) et on **ajoute** une étape « e-learning » + un worker dédié `elearning-retention-purge-worker.ts` pour les volumes lourds (watch logs, événements tracking).
3. On **construit** un **paramétrage par type de document** : modèle `ElearningRetentionPolicy` + écran admin sous `…/elearning/conformite/conservation`, qui pilote les durées au lieu de les coder en dur.
4. On distingue **3 familles de données** avec des durées et des finalités différentes : **logs techniques** (6 mois–1 an), **traces pédagogiques / preuves de réalisation** (3–5 ans, alignées sur la conservation comptable/OPCO 6–10 ans pour les pièces liées au financement), **données contractuelles & comptables** (6 ans fiscal, 10 ans comptable).
5. **Droit à l'effacement = anonymisation sous contrainte légale** (jamais de `DELETE` physique des preuves de réalisation tant que la durée légale court), pattern déjà en place dans `supprimerStagiaire`.

---

## 1. Cadre légal — durées de conservation par finalité

Source de vérité réglementaire (rappel du brief lead, à ne pas réinterpréter à la baisse) :

| Finalité                          | Durée                                    | Base légale                                                 | Données concernées (e-learning)                                                                                         |
| --------------------------------- | ---------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Comptabilité**                  | **10 ans**                               | C. com. **L.123-22**                                        | Factures e-learning, écritures, justificatifs comptables (réutilise `Invoice`/`Payment`)                                |
| **Fiscal / pièces OPCO**          | **6 ans**                                | LPF **L.102 B**                                             | Factures, relevés de dépenses, conventions, pièces exigibles par l'OPCO en contrôle                                     |
| **Preuves de réalisation FOAD**   | **3 à 5 ans**                            | C. trav. **L.6362-6** (contrôle administratif et financier) | Évaluations, travaux rendus, traces d'assiduité agrégées, certificats de réalisation, traces d'accompagnement (tutorat) |
| **Logs techniques**               | **6 mois à 1 an**                        | CNIL délib. **2021-122** (journalisation)                   | Logs de connexion bruts, IP, user-agent, heartbeats vidéo, événements de lecture détaillés                              |
| **Consentements**                 | durée du traitement **+ 5 ans** (preuve) | RGPD art. 7.1 (charge de la preuve)                         | `consentement*` sur `Trainee`, snapshot de version + horodatage                                                         |
| **Données contractuelles client** | 5 ans après fin de relation              | C. civ. **art. 2224**                                       | `Client` CRM, commandes e-learning (`ElearningOrder`)                                                                   |

**Règle de résolution des conflits de durée** : quand une même donnée sert plusieurs finalités, on conserve **la plus longue durée applicable**, puis on purge. Exemple : un **certificat de réalisation** est à la fois preuve de réalisation (3–5 ans) et pièce justificative d'un financement OPCO (6 ans) → conservation **6 ans** (10 ans si rattaché à une facture comptable archivée).

**Conséquence d'architecture** : la durée n'est PAS portée par la donnée elle-même mais par une **politique paramétrable par type** (cf. §5). Les preuves de réalisation et les pièces financières sont **immuables** (jamais réécrites par l'anonymisation) tant que leur durée court ; seules les **PII directement identifiantes non nécessaires à la preuve** sont anonymisées (cf. §7).

---

## 2. Taxonomie des données e-learning (la distinction qui structure tout)

On range chaque donnée e-learning dans **une** des 4 familles. La famille détermine : la durée, la purgeabilité (hard delete vs anonymisation), et l'inclusion dans l'export RGPD.

### Famille A — Logs techniques (6 mois–1 an, **hard delete**, exclus de l'export RGPD)

Données de journalisation système, non nécessaires à la preuve pédagogique une fois agrégées.

| Donnée                            | Modèle (NEUF, cf. doc 02)                                   | Contenu sensible                      | Durée défaut                  |
| --------------------------------- | ----------------------------------------------------------- | ------------------------------------- | ----------------------------- |
| Heartbeats vidéo bruts            | `ElearningWatchEvent`                                       | `positionSec`, `sessionId`, ts        | **6 mois**                    |
| Événements de lecture détaillés   | `ElearningTrackingEvent` (grammaire xAPI verbe/objet)       | verbe/objet/ts, IP tronquée           | **12 mois**                   |
| Logs d'authentification apprenant | `ElearningAuthLog` (NEUF)                                   | IP **hashée** SHA-256, user-agent, ts | **12 mois**                   |
| Sessions apprenant expirées       | `ElearningSession` (cookie/middleware dédié, cf. doc 04-05) | token hashé                           | **purge à expiration + 30 j** |

> Justification CNIL 2021-122 : les logs de connexion bruts ont une durée courte. Leur valeur probante FOAD est **dérivée** : on en extrait des **agrégats** (temps total, complétion, dates d'activité) rangés en Famille C avant purge du brut. Le relevé de connexion **seul est insuffisant** (R.6313-3) → c'est le faisceau de preuves (Famille C) qui compte, pas les logs bruts.

### Famille B — Traces pédagogiques d'apprentissage (durée alignée sur la preuve, **agrégées avant purge**)

Le « gras » de l'activité : progression fine, tentatives de quiz, reprises. Utiles à la pédagogie + à l'engagement (anti-décrochage Qualiopi Ind.12), mais on n'a pas besoin de garder le détail granulaire 5 ans.

| Donnée                | Modèle (NEUF)                    | Durée détail | Agrégat conservé                             |
| --------------------- | -------------------------------- | ------------ | -------------------------------------------- |
| Progression par leçon | `LessonProgress`                 | détail 3 ans | `% complétion` cours figé dans le certificat |
| Tentatives de quiz    | `QuizAttempt` + `QuizAnswer`     | détail 3 ans | score final, date, réussite (preuve Ind.11)  |
| Reprises / signets    | champs sur `ElearningEnrollment` | 3 ans        | —                                            |

### Famille C — Preuves de réalisation FOAD (**3–5 ans, jusqu'à 6–10 ans si financement**, anonymisation seulement)

Le **faisceau de preuves** exigé par R.6313-3 et le contrôle L.6362-6. **Jamais hard-deleted tant que la durée court.** L'effacement RGPD anonymise les PII _autour_ de la preuve mais conserve la preuve (art. 17§3-b : obligation légale de conservation prime sur le droit à l'effacement).

| Preuve                                                        | Support (EXISTANT réutilisé + NEUF)                         | Indicateur Qualiopi | Durée                              |
| ------------------------------------------------------------- | ----------------------------------------------------------- | ------------------- | ---------------------------------- |
| Information durée/activités (D.6313-3-1 §2)                   | `ElearningCourse.dureeEstimeeMinutes` + snapshot à l'octroi | Ind.1               | 6 ans                              |
| Évaluations qui jalonnent/concluent (Ind.11 — **majeure**)    | `QuizAttempt` (score), `EvaluationAcquis` (EXISTANT ~5653)  | **Ind.11**          | 5 ans                              |
| Travaux rendus (devoir FOAD)                                  | `ElearningSubmission` (NEUF) → fichier R2                   | Ind.11              | 5 ans                              |
| Traces d'assiduité agrégées                                   | `ElearningCompletionSnapshot` (NEUF)                        | Ind.1, Ind.9        | 6 ans                              |
| Traces d'assistance technique ET pédagogique (D.6313-3-1 §1)  | `ElearningTutorInteraction` (NEUF) + emails (`EmailLog`)    | **Ind.19**          | 5 ans                              |
| Certificat de réalisation (modèle officiel, heures réalisées) | `DocumentGenere` (EXISTANT ~5507) + `qrToken` + PDF R2      | Ind.11              | **6 ans** (10 si rattaché facture) |

### Famille D — Données contractuelles, comptables & identité (6–10 ans, conservation longue)

| Donnée                                                         | Modèle (EXISTANT)                                         | Durée                                        |
| -------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------- |
| Identité apprenant minimale (nom/prénom requis sur certificat) | `Trainee`                                                 | tant qu'une preuve C la référence (≤ 10 ans) |
| Facture / paiement e-learning                                  | `Invoice` / `Payment` / `Refund` (EXISTANT, Stripe gated) | **10 ans**                                   |
| Commande e-learning                                            | `ElearningOrder` (NEUF, doc 05)                           | 6 ans                                        |
| Consentements                                                  | champs `consentement*` sur `Trainee` (EXISTANT)           | traitement + 5 ans                           |

---

## 3. Logs techniques vs traces pédagogiques — la frontière opérationnelle

C'est la distinction la plus piégeuse pour l'implémentation. Règle de découpage :

- **Log technique (Famille A)** = écrit **automatiquement par l'infra** à chaque interaction, **haut volume**, valeur unitaire faible, **PII = IP/UA/token** → hash + purge courte. Jamais exporté tel quel à la personne (RGPD art. 23 / sécurité du SI). Exemple : un heartbeat toutes les 15 s pendant une vidéo de 8 min = 32 lignes `ElearningWatchEvent` — inutile de les garder 5 ans.
- **Trace pédagogique → preuve (Famille B→C)** = **résultat consolidé** d'une activité d'apprentissage qui **jalonne ou conclut** le parcours, **bas volume**, valeur probante forte → conservation longue, anonymisation seulement. Exemple : « quiz module 3 réussi à 82 % le 12/03/2026 » = 1 ligne `QuizAttempt` à garder 5 ans.

**Pipeline d'agrégation (NEUF — `elearning-aggregate-worker.ts`)** : avant que la purge ne supprime les logs bruts de Famille A, un cron nocturne **fige les agrégats** dans `ElearningCompletionSnapshot` (Famille C). Ainsi :

- la preuve d'assiduité survit à la purge des logs bruts ;
- on respecte la minimisation (art. 5.1.e) : on ne garde longtemps que ce qui a une valeur probante.

Ordre des crons (important — l'agrégation DOIT précéder la purge) :

```
02:30 UTC  elearning-aggregate-cron     → fige snapshots assiduité/complétion (Famille A→C)
03:00 UTC  retention-purge-cron         → purge Famille A + appelle l'étape e-learning
```

---

## 4. Matrice de conservation par modèle (référence d'implémentation)

Table exhaustive reliant **chaque modèle** à sa famille, sa durée, son mode de purge et sa variable d'env. Les modèles `Elearning*`/`Quiz*`/`Lesson*` sont **NEUF** (cf. docs 02/03/04) ; les autres sont **EXISTANTS réutilisés**.

| Modèle                         | Famille | Durée défaut          | Mode purge                       | Variable env                               | Inclus export RGPD |
| ------------------------------ | ------- | --------------------- | -------------------------------- | ------------------------------------------ | ------------------ |
| `ElearningWatchEvent`          | A       | 6 mois                | hard delete                      | `ELEARNING_RETENTION_WATCH_MONTHS=6`       | non                |
| `ElearningTrackingEvent`       | A       | 12 mois               | hard delete (après agrégat)      | `ELEARNING_RETENTION_TRACKING_MONTHS=12`   | non                |
| `ElearningAuthLog`             | A       | 12 mois               | hard delete                      | `ELEARNING_RETENTION_AUTHLOG_MONTHS=12`    | non (IP hashée)    |
| `ElearningSession`             | A       | exp.+1 mois           | hard delete                      | `ELEARNING_RETENTION_SESSION_MONTHS=1`     | non                |
| `LessonProgress`               | B       | 3 ans                 | hard delete (après snapshot)     | `ELEARNING_RETENTION_PROGRESS_MONTHS=36`   | oui (agrégé)       |
| `QuizAttempt` / `QuizAnswer`   | B→C     | 5 ans                 | anonymisation                    | `ELEARNING_RETENTION_QUIZ_MONTHS=60`       | oui                |
| `ElearningSubmission` (devoir) | C       | 5 ans                 | anonymisation + purge R2 à terme | `ELEARNING_RETENTION_SUBMISSION_MONTHS=60` | oui                |
| `ElearningTutorInteraction`    | C       | 5 ans                 | anonymisation                    | `ELEARNING_RETENTION_TUTOR_MONTHS=60`      | oui                |
| `ElearningCompletionSnapshot`  | C       | 6 ans                 | conservation                     | `ELEARNING_RETENTION_SNAPSHOT_MONTHS=72`   | oui                |
| `ElearningEnrollment`          | C       | 6 ans                 | anonymisation                    | `ELEARNING_RETENTION_ENROLLMENT_MONTHS=72` | oui                |
| `DocumentGenere` (certificat)  | C/D     | 6 ans (10 si facture) | conservation + purge R2 à terme  | `ELEARNING_RETENTION_CERT_MONTHS=72`       | oui (métadonnées)  |
| `ElearningOrder`               | D       | 6 ans                 | anonymisation                    | `ELEARNING_RETENTION_ORDER_MONTHS=72`      | oui                |
| `Invoice`/`Payment`            | D       | 10 ans                | conservation                     | (géré côté compta existant)                | oui                |

> Les défauts ci-dessus sont les **fallbacks code**. La **valeur effective** est lue depuis `ElearningRetentionPolicy` si une ligne existe pour le type (cf. §5), sinon depuis l'env, sinon le fallback. **Garde anti-misconfig** (héritée du worker existant) : toute valeur `< 1` est ignorée → on garde le fallback (jamais de purge à 0 mois).

---

## 5. Paramétrage par type de document (NEUF)

Aujourd'hui le `retention-purge-worker.ts` lit des **variables d'env** (`RETENTION_*_MONTHS`). C'est suffisant pour la plateforme mais l'équipe conformité doit pouvoir **ajuster les durées par type de document sans redéploiement**. On ajoute donc une table de politique + un écran admin.

### 5.1 Modèle Prisma (additif)

```prisma
/// Politique de conservation paramétrable par type de donnée/document e-learning.
/// Source de vérité pilotable par l'admin conformité. Surcharge les défauts code/env.
model ElearningRetentionPolicy {
  id              String                  @id @default(uuid()) @db.Uuid
  /// Clé stable du type (ex. "watch_event", "quiz_attempt", "certificat", "submission").
  documentType    String                  @unique @map("document_type") @db.VarChar(80)
  libelle         String                  @db.VarChar(200)
  famille         ElearningRetentionFamille
  /// Durée de conservation en mois (≥ 1). 0/absent = utilise le défaut code/env.
  dureeMois       Int                     @map("duree_mois")
  /// Mode appliqué par la purge.
  mode            ElearningRetentionMode
  /// Base légale citée dans le registre (ex. "L.6362-6", "L.123-22", "CNIL 2021-122").
  baseLegale      String                  @map("base_legale") @db.VarChar(200)
  /// Inclus dans l'export RGPD art.15 ?
  exportRgpd      Boolean                 @default(true) @map("export_rgpd")
  /// Politique active ? (permet de désactiver une purge sans supprimer la ligne)
  actif           Boolean                 @default(true)
  /// Champ de date utilisé pour calculer l'ancienneté (ex. "createdAt", "updatedAt", "completedAt").
  champDate       String                  @default("createdAt") @map("champ_date") @db.VarChar(60)
  note            String?                 @db.Text
  updatedBy       String?                 @map("updated_by") @db.Uuid    // AdminUser
  createdAt       DateTime                @default(now()) @map("created_at")
  updatedAt       DateTime                @updatedAt @map("updated_at")

  @@index([famille])
  @@map("elearning_retention_policies")
}

enum ElearningRetentionFamille {
  log_technique          // Famille A
  trace_pedagogique      // Famille B
  preuve_realisation     // Famille C
  contractuel_comptable  // Famille D
}

enum ElearningRetentionMode {
  hard_delete        // suppression physique (logs, traces agrégées)
  anonymisation      // PII effacées, enregistrement conservé (preuves)
  conservation       // pas de purge automatique (durée légale longue)
}
```

### 5.2 Résolution de la durée effective (ordre de priorité)

Helper NEUF `src/server/elearning/conformite/retention-policy.ts` :

```
resolveRetentionMonths(documentType):
  1. ElearningRetentionPolicy{documentType, actif:true}.dureeMois  (si ≥ 1)
  2. sinon process.env[ELEARNING_RETENTION_<TYPE>_MONTHS]          (si ≥ 1)
  3. sinon DEFAULTS[documentType]                                  (fallback code)
```

Stub-aware : si `DATABASE_URL` contient `stub.invalid`, on saute l'étape DB (le Proxy renvoie `null`) et on retombe sur env/fallback — aucun blocage au build.

### 5.3 Seed initial

Migration de données (seed idempotent `prisma/seed-elearning-retention.ts`, exécuté hors build) qui crée une ligne par `documentType` du tableau §4 avec les défauts et la `baseLegale`. Idempotent (`upsert` sur `documentType`).

### 5.4 Écran admin

- Route : `src/app/[locale]/(admin)/[adminPrefix]/elearning/conformite/conservation/page.tsx`
- Composant : `src/components/admin/elearning/RetentionPolicyTable.tsx` (réutilise `AdminPageShell`, `AdminTable`, `AdminBadge`, `StatCard`).
- Server actions : `src/server/elearning/conformite/retention-actions.ts`
  - `listerPolitiquesRetention()` — `requireAdminRead`
  - `mettreAJourPolitiqueRetention(input)` — `requireAdminWrite` (RBAC `super_admin`/`admin`), écrit `updatedBy`, trace dans `ActivityLog` (`action: "elearning.retention_policy.updated"`).
- Garde-fou UI : un avertissement si `dureeMois` < durée légale minimale de la famille (ex. preuve de réalisation < 36 mois) ; modification possible mais loggée comme **dérogation**.
- Nav : ajouter sous le pôle e-learning de `admin-nav.ts` (cf. doc 06-CONSOLE-ADMIN/01) un item « Conservation & RGPD » → `…/elearning/conformite/conservation`, à côté de l'entrée Qualiopi RGPD existante (`/qualiopi/rgpd`, `admin-nav.ts:553`).

---

## 6. Droits des personnes (accès / portabilité / effacement)

**Décision : on réutilise le système RGPD existant** plutôt que d'en créer un parallèle.

### 6.1 Existant réutilisé

- Modèle `RgpdDemande` (`schema.prisma:6277`) : `type ∈ {export, suppression}`, `statut ∈ {demandee, traitee, refusee}`. **Aucun nouveau modèle nécessaire.**
- Service `src/server/qualiopi/portail/rgpd-service.ts` :
  - `creerDemandeRgpd(traineeId, type)` — trace la demande (déclenchable depuis le portail apprenant).
  - `exporterDonneesStagiaire(traineeId)` — droit d'accès art. 15 (JSON complet).
  - `supprimerStagiaire(traineeId)` — droit à l'effacement art. 17 par **anonymisation + `deletedAt`** (jamais DELETE physique ; révoque les `PortailAcces`).
- Écran admin existant `/qualiopi/rgpd` (Demandes RGPD).

### 6.2 NEUF — extensions pour couvrir l'e-learning

L'apprenant e-learning **est** un `Trainee` (auth apprenant adossée à `Trainee` + `passwordHash` nullable, ADR-LMS-0001). Donc l'export et la suppression doivent inclure les entités e-learning. On **étend les deux fonctions existantes** (pas de duplication) :

**`exporterDonneesStagiaire`** — ajouter au `include` / au JSON retourné :

- `elearningEnrollments` (cours, dates octroi, progression %, complétion) ;
- `lessonProgress` (agrégé : leçons complétées / total) ;
- `quizAttempts` (score, date, réussite — Famille B/C, exportable) ;
- `elearningSubmissions` (devoirs rendus — métadonnées + lien R2 signé court TTL) ;
- `elearningTutorInteractions` (échanges tutorat) ;
- `elearningOrders` (commandes) ;
- certificats e-learning (`DocumentGenere` filtrés type certificat e-learning).
- **Exclus** (Famille A, art. 23) : `ElearningWatchEvent`, `ElearningTrackingEvent`, `ElearningAuthLog`, `ElearningSession` — non inclus dans l'export (logs techniques / sécurité du SI). Mention explicite dans la politique de confidentialité.

**`supprimerStagiaire`** — ajouter à la `$transaction` d'anonymisation :

- révoquer toutes les `ElearningSession` actives (équivalent de la révocation `PortailAcces` déjà faite) ;
- nullifier `Trainee.passwordHash` (NEUF) ;
- anonymiser les PII libres de `ElearningTutorInteraction` (champ message si nominatif) et `ElearningSubmission` (nom de fichier, commentaire) **en conservant la preuve de réalisation** (score, date, fait) ;
- **NE PAS** supprimer `QuizAttempt`/`ElearningCompletionSnapshot`/certificats tant que la durée légale court (art. 17§3-b) — seul le lien identifiant est neutralisé via l'anonymisation du `Trainee` parent.

> Conséquence : après effacement, un certificat reste vérifiable par `qrToken` mais le `Trainee` rattaché affiche `[supprime]`. C'est conforme : la preuve de réalisation est une obligation légale qui prime (L.6362-6 / contrôle OPCO).

### 6.3 Délais & traçabilité

- Réponse à une demande RGPD : **1 mois** (art. 12.3), prolongeable de 2 mois si complexe → statut `demandee` → `traitee`/`refusee` sur `RgpdDemande`, `traiteeAt` horodaté, `note` motivée si `refusee` (ex. « effacement partiel : preuves de réalisation conservées au titre de L.6362-6 jusqu'au JJ/MM/AAAA »).
- Chaque traitement loggé dans `ActivityLog` (`action: "rgpd.export"` / `"rgpd.suppression"`).

---

## 7. Effacement vs conservation légale — algorithme

Quand une demande de **suppression** arrive, on ne supprime pas tout aveuglément. Logique du service étendu :

```
pour chaque donnée rattachée au Trainee :
  famille = classifier(donnée)
  si famille == A (log technique)        → hard delete immédiat (déjà purgeable)
  si famille == B (trace pédagogique)    → snapshot agrégat (si pas déjà fait) puis hard delete détail
  si famille == C (preuve réalisation)   → anonymisation PII péri-preuve, CONSERVER la preuve
                                            jusqu'à fin de durée légale (puis purge cron)
  si famille == D (contractuel/compta)   → anonymisation PII, CONSERVER (10 ans compta / 6 ans fiscal)
puis : Trainee → [supprime] + deletedAt=now() ; révoquer accès (PortailAcces + ElearningSession) ; passwordHash=null
```

La **purge définitive** des Familles C/D anonymisées intervient **automatiquement** quand la durée légale est atteinte, via le cron (§8) — pas besoin d'action manuelle. À ce moment-là on peut aussi `deleteFromR2()` (EXISTANT, `r2-storage.ts:183`) les PDF/devoirs/sous-titres associés.

---

## 8. Crons de purge

### 8.1 Existant réutilisé

- `retention-purge-worker.ts` (cron **`0 3 * * *`**, enregistré dans `queues.ts:674-680`, jobId `retention-purge-cron`). Garde anti-misconfig `< 1` mois, `removeOnComplete/Fail` bornés, `captureWorkerError`.
- On **ajoute une étape e-learning** dans ce worker pour les volumes faibles (anonymisations C/D arrivées à échéance, sessions expirées) afin de centraliser le reporting de purge.

### 8.2 NEUF — `elearning-retention-purge-worker.ts`

Pour les **gros volumes** (watch/tracking events à haute cardinalité), un worker dédié évite de faire grossir le worker généraliste et permet un batching + une concurrence isolée.

- Fichier : `src/server/queue/workers/elearning-retention-purge-worker.ts`
- Queue : `"elearning-retention-purge"` (déclarée dans `queues.ts`, gated par `BULLMQ_DISABLED`)
- Cron : **`0 3 * * *`** (jobId `elearning-retention-purge-cron`), enregistré dans le bloc repeatable de `queues.ts` (même pattern que `retention-purge-cron`).
- Pour chaque `documentType` actif : `months = resolveRetentionMonths(type)` ; si `< 1` → skip (anti-misconfig) ; sinon `deleteMany`/`updateMany` (anonymisation) sur `champDate < monthsAgo(months)`, **en batch** (`take: 5000` en boucle) pour ne pas verrouiller la table.
- Purge R2 associée : pour les preuves arrivées à terme, énumérer les `r2Key`/PDF et `deleteFromR2()` (fail-soft).
- Log final type `[elearning-retention-purge] watch=… tracking=… quiz=… submissions=…` + écriture d'un récap dans `ActivityLog` (`action: "elearning.retention.run"`).
- **Stub-aware obligatoire** : early-exit si `DATABASE_URL.includes("stub.invalid")` (jamais de mutation au build GH Actions).

### 8.3 NEUF — `elearning-aggregate-worker.ts` (pré-purge)

- Cron **`30 2 * * *`** (avant la purge de 03:00) : fige `ElearningCompletionSnapshot` (Famille C) à partir des `LessonProgress`/`ElearningWatchEvent` avant que ceux-ci ne soient purgés. Garantit que la preuve d'assiduité survit.

### 8.4 Récap des jobs cron

| jobId                                     | pattern      | worker                             | rôle                                           |
| ----------------------------------------- | ------------ | ---------------------------------- | ---------------------------------------------- |
| `elearning-aggregate-cron`                | `30 2 * * *` | `elearning-aggregate-worker`       | fige snapshots (A→C)                           |
| `retention-purge-cron` (EXISTANT, étendu) | `0 3 * * *`  | `retention-purge-worker`           | purge globale + étape e-learning faible volume |
| `elearning-retention-purge-cron`          | `0 3 * * *`  | `elearning-retention-purge-worker` | purge gros volumes + R2                        |

---

## 9. Consentements

- **Existant réutilisé** : champs sur `Trainee` — `consentementFormation`, `consentementEmail`, `consentementVersion`, `consentementAt`. Pattern de versionnage déjà en place.
- **NEUF e-learning** : à la **première connexion** apprenant (entrée effective FOAD), recueil/horodatage d'un consentement spécifique au traitement des **traces d'apprentissage** (suivi pédagogique). Réutiliser `consentementVersion` (bumper la version, ex. `"elearning-v1"`) + `consentementAt`. Pas de nouvelle table : on étend la sémantique de version.
- Base légale du traitement des traces : **exécution du contrat de formation** (art. 6.1.b) + **obligation légale** FOAD (art. 6.1.c), pas le consentement → le consentement couvre les usages _non_ nécessaires (emails marketing). Distinguer clairement dans la politique de confidentialité.
- Preuve du consentement conservée **traitement + 5 ans** (art. 7.1). Le snapshot version+date sur `Trainee` est la preuve ; il survit à l'anonymisation (non PII).

---

## 10. Registre des traitements (RGPD art. 30)

L'ajout du LMS crée de **nouveaux traitements** à inscrire au registre interne. À documenter (hors code, mais la table `ElearningRetentionPolicy.baseLegale` alimente la colonne « durée/base légale ») :

| Traitement                   | Finalité                    | Base légale        | Données                               | Durée     | Destinataires                |
| ---------------------------- | --------------------------- | ------------------ | ------------------------------------- | --------- | ---------------------------- |
| Suivi pédagogique e-learning | Dispenser & prouver la FOAD | art. 6.1.b + 6.1.c | identité, progression, scores, traces | 3–6 ans   | OF Axion-IA, OPCO (contrôle) |
| Journalisation technique LMS | Sécurité du SI              | art. 6.1.f         | IP hashée, UA, logs                   | 6–12 mois | OF (DSI)                     |
| Tutorat / assistance         | Conformité Ind.19           | art. 6.1.c         | échanges tuteur↔apprenant             | 5 ans     | OF, formateur                |
| Certification de réalisation | Obligation légale           | art. 6.1.c         | identité, heures, score               | 6–10 ans  | OF, financeur                |
| Vidéo (Cloudflare Stream)    | Diffusion sécurisée         | art. 6.1.b         | watermark = email/ID apprenant        | session   | Sous-traitant CF (DPA)       |
| Commande/paiement            | Vente                       | art. 6.1.b + 6.1.c | identité, montant                     | 6–10 ans  | OF, compta                   |

**Sous-traitants à ajouter à la liste des sous-processeurs** (cf. page publique `/sous-processeurs` existante) : **Cloudflare Stream** (ou **Bunny**, UE) pour la vidéo. Mentionner localisation des données (Bunny = argument résidence UE, ADR-LMS-0005).

---

## 11. Sécurité, minimisation, intégrité (transversal)

- **IP** : jamais stockée en clair dans les logs e-learning → SHA-256 + sel (`IP_HASH_SALT`, déjà utilisé par image-bank). Aligne le LMS sur le pattern existant.
- **Handicap** : si un apprenant FOAD déclare une situation de handicap (adaptation), réutiliser `Trainee.handicapDetailsChiffre` (chiffré `pii-crypto`, déchiffré uniquement par le référent). Ne **jamais** créer un champ handicap en clair côté e-learning.
- **Watermark vidéo** = PII (email/ID) incrustée → durée = durée de la session de visionnage, pas de stockage de l'image watermarkée.
- **Minimisation** (art. 5.1.e) : la purge des Familles A/B est le mécanisme central. Ne logguer que ce qui est nécessaire à la preuve ou à la sécurité.
- **Intégrité des preuves** : certificats/factures hashés SHA-256 (pattern `r2-storage.ts`, hash en DB) ; vérification au re-download.
- **Stub-awareness** (ADR-LMS-0008 / contrat build) : tout service de purge/export/policy fait `if (process.env.DATABASE_URL?.includes("stub.invalid")) return <fallback>` avant toute query — calqué sur `rgpd-service.ts`.

---

## 12. Migrations (additives — ADR-LMS-0008)

- `CREATE TABLE elearning_retention_policies` + enums `ElearningRetentionFamille`, `ElearningRetentionMode`.
- `ADD COLUMN trainees.password_hash` (nullable, ADR-LMS-0001) — sert aussi à l'effacement (nullify).
- Les modèles Famille A/B/C (`ElearningWatchEvent`, `LessonProgress`, `QuizAttempt`, …) sont créés par les migrations des docs 02/03 ; ce doc ne fait qu'y **attacher une politique de rétention**.
- **Aucun DROP**, aucune colonne non-nullable ajoutée à une table existante peuplée.
- Seed `prisma/seed-elearning-retention.ts` exécuté **au runtime** (jamais au build stub) — `upsert` idempotent.

---

## 13. Checklist conformité (definition of done)

- [ ] `ElearningRetentionPolicy` + enums créés, seedés, éditables via `…/elearning/conformite/conservation`.
- [ ] `resolveRetentionMonths()` (policy → env → fallback) avec garde `< 1`.
- [ ] `exporterDonneesStagiaire` étendu (entités e-learning incluses ; logs techniques exclus).
- [ ] `supprimerStagiaire` étendu (révoque `ElearningSession`, nullify `passwordHash`, anonymise sans détruire les preuves sous durée légale).
- [ ] `elearning-aggregate-worker` (02:30) fige les snapshots avant purge.
- [ ] `elearning-retention-purge-worker` (03:00) batché + purge R2, stub-aware, `captureWorkerError`.
- [ ] Étape e-learning ajoutée au `retention-purge-worker` existant.
- [ ] Crons enregistrés dans `queues.ts` (3 jobId), gated `BULLMQ_DISABLED`.
- [ ] Registre art. 30 mis à jour ; Cloudflare Stream/Bunny ajouté aux sous-processeurs (DPA).
- [ ] Politique de confidentialité mise à jour (traces d'apprentissage, exclusion logs techniques de l'export, durées).
- [ ] Tests Vitest : résolution de durée, anti-misconfig `< 1`, anonymisation conserve les preuves, stub-awareness.

---

## Liens

- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-LMS-0001 (auth/`passwordHash`), 0005 (vidéo/sous-processeur), 0007 (cloisonnement), 0008 (migrations additives).
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — `ElearningCourse/Module/Lesson` (durées, FOAD).
- `03-DATA-MODEL/02-schema-progression-tracking.md` — `ElearningEnrollment`, `LessonProgress`, `ElearningWatchEvent`, `ElearningTrackingEvent` (Familles A/B).
- `03-DATA-MODEL/03-schema-quiz-evaluations.md` — `Quiz`, `QuizAttempt`, `QuizAnswer` (preuve Ind.11).
- `03-DATA-MODEL/04-schema-comptes-acces-auth.md` — `Trainee.passwordHash`, `ElearningSession`, `ElearningAuthLog`.
- `03-DATA-MODEL/05-schema-ecommerce-commandes.md` — `ElearningOrder`, lien `Invoice`/`Payment`.
- `04-BACKEND/03-workers-bullmq-crons.md` — enregistrement des crons.
- `04-BACKEND/05-authentification-apprenant.md` — sessions apprenant, révocation à l'effacement.
- `04-BACKEND/06-import-masse-provisioning.md` — consentement/octroi en masse (CSV entreprise).
- `08-CONFORMITE/01-foad-d6313-3-1.md` — 3 conditions FOAD, preuve d'assistance.
- `08-CONFORMITE/02-qualiopi-indicateurs-foad.md` — Ind.1/9/11/12/19.
- `08-CONFORMITE/03-cpf-edof-readiness.md` — EDOF gated, entrée effective.
- `08-CONFORMITE/06-tracabilite-preuves-realisation.md` — faisceau de preuves R.6313-3 (complément direct de ce doc).
- Code existant : `src/server/qualiopi/portail/rgpd-service.ts`, `src/server/queue/workers/retention-purge-worker.ts`, `src/lib/r2-storage.ts`, `prisma/schema.prisma` (`RgpdDemande` ~6277, `Trainee` ~5274), `src/lib/admin-nav.ts` (RGPD ~553).
  </content>
  </invoke>
