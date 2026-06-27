# Console admin — Dashboard de pilotage e-learning

Tableau de bord de pilotage de la plateforme e-learning, côté **console admin Axion-IA** (pas l'espace apprenant). Il répond à une question simple pour Will et l'équipe pédagogique : **« Où en sont mes apprenants, quels cours décrochent, qu'est-ce qui bloque, et qu'est-ce que je dois exporter pour l'OPCO / l'audit Qualiopi ? »**

Ce document spécifie : les **KPIs** (inscrits, accès actifs, complétion, temps moyen, quiz réussis, décrochage), les **alertes** (réutilisation de `AlerteSysteme`), les **vues croisées** (par cours / par entreprise / par apprenant), et les **exports**. Il s'appuie sur le composant existant `AdminStatCard` et sur les patterns de la page **Qualiopi → Pilotage** déjà en production.

> **Phasage (roadmap `11-ROADMAP/01`)** : le dashboard de pilotage est une brique **V1** (« industrialisation »). En **MVP**, seul un sous-ensemble « suivi basique » (liste apprenants + complétion par cours, cf. `04-gestion-apprenants.md`) est livré. Ce document décrit la **cible V1 complète** et marque ce qui est MVP vs V1.

**Conventions respectées** : Server Components + `force-dynamic` + `robots: noindex` (admin derrière auth), RBAC `requireAdminRead` (`src/server/actions/knowledge/_guards.ts`, rôles `super_admin/admin/editor/reader`), cache Redis fail-soft TTL 3600 s (pattern `pilotage-service.ts`), code cloisonné sous `src/server/elearning/**` (ADR-LMS-0007), stub-aware `stub.invalid` (ADR 0026). Aucune migration (lecture seule sur les tables des docs 01/02/03 + `AlerteSysteme` existant).

---

## 1. Périmètre & frontière avec l'existant

### 1.1 Ce que CE dashboard couvre (NEUF)

Le pilotage **e-learning / FOAD asynchrone** : engagement et progression des apprenants sur les `ElearningCourse`, réussite des `Quiz`, décrochage, preuves de réalisation.

### 1.2 Ce qu'il NE couvre PAS (existant, ne pas dupliquer)

| Déjà couvert par                                                                                        | Où                                                                                          | Ne pas réimplémenter                                                                                                   |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Pilotage **Qualiopi** (14 métriques RNQ V9 : sessions présentiel/live, satisfaction, réclamations, BPF) | `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/pilotage/page.tsx` + `pilotage-service.ts` | Les sessions présentiel/live restent pilotées là. Le dashboard e-learning **renvoie vers** Qualiopi pour ces chiffres. |
| **Alertes système** (moteur de règles, catalogue, dédup, cron)                                          | `src/server/qualiopi/alertes/*` + `prisma.alerteSysteme`                                    | On **réutilise** `AlerteSysteme` (cf. §4). On **ajoute des codes** au catalogue, pas un nouveau moteur.                |
| **Notifications admin** (dropdown, badge non-lues, SSE)                                                 | `AdminNotificationsDropdown.tsx` + `/api/qualiopi/alertes/stream`                           | On émet via le même canal.                                                                                             |
| Content-gen analytics                                                                                   | pôle `content_gen` (`admin-nav.ts`)                                                         | Hors sujet.                                                                                                            |

> **Principe** : ce dashboard est une **vue de lecture agrégée** par-dessus les agrégats déjà matérialisés du doc 02 (`CourseProgress`, `ModuleProgress`, `LessonProgress`) + le runtime quiz du doc 03 (`QuizAttempt`). Il ne **recalcule** rien de coûteux à chaud : il lit les caches d'agrégat et applique des `count`/`avg` indexés.

---

## 2. Sources de données (rappel — tout existe déjà dans les docs 01/02/03)

| KPI / vue              | Table(s) source                                                  | Champs clés lus                                                                                                            |
| ---------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Inscrits / accès       | `ElearningEnrollment` (doc 02)                                   | `statut`, `source`, `accordeAt`, `premiereConnexionAt`, `dernierAccesAt`, `expiresAt`, `courseId`, `clientId`, `traineeId` |
| Complétion             | `CourseProgress` (doc 02, 1:1 enrollment)                        | `statut`, `percentComplet`, `completedAt`, `reussite`, `scoreGlobalPct`, `courseId`                                        |
| Progression fine       | `ModuleProgress` / `LessonProgress` (doc 02)                     | `percentComplet`, `estDeverrouille`, `verrouRaison`, `statut`, `tempsPasseSec`                                             |
| Temps moyen            | `CourseProgress.tempsTotalSec` (agrégé)                          | `tempsTotalSec`                                                                                                            |
| Quiz réussis           | `QuizAttempt` (doc 03)                                           | `statut`, `scorePct`, `reussite`, `quizId`, `enrollmentId`, `submittedAt`                                                  |
| Corrections en attente | `QuizAttempt` (doc 03)                                           | `statut = a_corriger`                                                                                                      |
| Décrochage             | `ElearningEnrollment.dernierAccesAt` + `CourseProgress.statut`   | inactivité N jours, `en_cours` non terminé                                                                                 |
| Catalogue              | `ElearningCourse` (doc 01)                                       | `statut`, `titre`, `slug`, `estFoad`, `seuilReussitePct`                                                                   |
| Entreprise             | `Client` (existant `:4890`) via `ElearningEnrollment.clientId`   | `raisonSociale`, `siret`, `opco`                                                                                           |
| Apprenant              | `Trainee` (existant `:5274`) via `ElearningEnrollment.traineeId` | identité (PII chiffrée — affichage minimisé)                                                                               |
| Preuve / journal       | `ElearningXapiStatement` (doc 02)                                | `verb`, `occurredAt`, `enrollmentId` (exports conformité)                                                                  |

> ⚠️ **Rappel type de clés (doc 02 §2 / doc 03 §2)** : les PK LMS sont `text` ; `traineeId`/`clientId` sont `@db.Uuid`. Les requêtes d'agrégat respectent ce typage. Les jointures `Trainee`/`Client` se font sur `@db.Uuid`.

---

## 3. KPIs — définitions, calculs, seuils

Tous les KPIs sont **filtrables** par : période (`accordeAt`/`occurredAt`), cours (`courseId`), entreprise (`clientId`), source (`source`). Le filtre par défaut = **tous les cours `publie`, 30 derniers jours glissants** pour les KPIs « flux », **all-time** pour les KPIs « stock ».

### 3.1 Cartes KPI (12 tuiles `AdminStatCard`)

Rendues via le composant **existant** `src/components/admin/ui/AdminStatCard.tsx` (props `label`, `value`, `delta`, `meta`, `tone`, `href`). Le `tone` (`success`/`warning`/`destructive`) est dérivé par seuil, exactement comme la page Qualiopi pilotage (`toNum` + ternaire).

| #   | KPI (label)                 | Définition (calcul)                                                                                 | `tone` par seuil                                           | `href` (drill-down)                      |
| --- | --------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------- |
| K1  | **Apprenants inscrits**     | `count(distinct ElearningEnrollment.traineeId)` (stock, all-time)                                   | `default`                                                  | `…/elearning/apprenants`                 |
| K2  | **Accès actifs**            | `count(ElearningEnrollment where statut=actif AND (expiresAt is null OR expiresAt>now))`            | `default`                                                  | `…/elearning/acces?statut=actif`         |
| K3  | **Accès jamais activés**    | `count(actif AND premiereConnexionAt is null)` → entrée effective FOAD non faite                    | `≤5 %`→`success`, `≤20 %`→`warning`, sinon `destructive`   | `…/elearning/acces?filtre=jamais_active` |
| K4  | **Taux de complétion**      | `count(CourseProgress.statut=termine) / count(enrollments éligibles)` ×100                          | `≥70`→`success`, `≥40`→`warning`, sinon `destructive`      | `…/elearning/cours`                      |
| K5  | **En cours**                | `count(CourseProgress.statut=en_cours)`                                                             | `default`                                                  | `…/elearning/apprenants?statut=en_cours` |
| K6  | **Temps moyen / apprenant** | `avg(CourseProgress.tempsTotalSec)` formaté `Xh Ymin`                                               | `default` (informatif, preuve durée moyenne D.6313-3-1 §2) | —                                        |
| K7  | **Quiz réussis (taux)**     | `count(QuizAttempt where reussite=true) / count(QuizAttempt where statut in {soumis,corrige})` ×100 | `≥75`→`success`, `≥50`→`warning`, sinon `destructive`      | `…/elearning/quiz`                       |
| K8  | **Score moyen quiz**        | `avg(QuizAttempt.scorePct where statut in {soumis,corrige})`                                        | `≥seuil moyen cours`→`success`…                            | `…/elearning/quiz`                       |
| K9  | **Décrochage (à risque)**   | `count(enrollments actifs, en_cours, dernierAccesAt < now-14j)` (cf. §3.3)                          | `0`→`success`, `≤10 %`→`warning`, sinon `destructive`      | `…/elearning/apprenants?filtre=a_risque` |
| K10 | **Certificats émis**        | `count(ElearningEnrollment.certificatEmisAt is not null)` (période)                                 | `default`                                                  | `…/elearning/certificats`                |
| K11 | **Corrections en attente**  | `count(QuizAttempt.statut=a_corriger)`                                                              | `0`→`success`, `≤5`→`warning`, sinon `destructive`         | `…/elearning/quiz/corrections`           |
| K12 | **Devoirs à évaluer**       | `count(LessonProgress where devoirR2Key not null AND lesson.type=devoir AND non noté)`              | idem K11                                                   | `…/elearning/devoirs`                    |

> **`delta`** (optionnel) : pour les KPIs de flux (K1, K10), comparer à la période précédente de même durée → `delta="+12"` auto-coloré par `AdminStatCard`. Calculé côté service (`comparaisonPeriodePrecedente`), jamais côté composant.

### 3.2 Formule de complétion (K4) — alignée doc 02

La **complétion** = `CourseProgress.statut = termine` (100 % des leçons **obligatoires** terminées, doc 02 §6). À **distinguer de la réussite** = `CourseProgress.reussite` (`scoreGlobalPct ≥ ElearningCourse.seuilReussitePct`). Le dashboard affiche les **deux** :

- **Taux de complétion** (K4) = a fini le parcours.
- **Taux de réussite** (sur la vue par cours, §5.1) = a fini **et** réussi (certifiable).

Pour l'**OPCO**, c'est la **complétion + heures réalisées** (`tempsTotalSec`) qui comptent ; pour le **certificat**, c'est la **réussite**.

### 3.3 Détection du décrochage (K9) — best practice anti-abandon (Qualiopi Ind.12)

Un apprenant est **« à risque de décrochage »** ssi **toutes** ces conditions :

1. `ElearningEnrollment.statut = actif` et non expiré,
2. `CourseProgress.statut = en_cours` (commencé, pas terminé),
3. `dernierAccesAt < now − SEUIL_INACTIVITE_JOURS` (défaut **14 j**, configurable),
4. `percentComplet < 100`.

Sous-catégorie **« jamais démarré »** (K3) : `actif` + `premiereConnexionAt is null` + `accordeAt < now − SEUIL_ENTREE_JOURS` (défaut **7 j**). C'est l'**entrée effective FOAD** non faite — critère EDOF (ADR-LMS-0003) et signal de relance.

> Ces seuils alimentent à la fois le KPI **et** le worker de relance `elearning-relance-worker.ts` (doc 02 §9) **et** les alertes (§4). **Source unique des seuils** : `src/server/elearning/pilotage/seuils.ts` (constantes exportées, pas de magie dispersée).

---

## 4. Alertes — réutilisation de `AlerteSysteme` (zéro nouveau moteur)

On **réutilise intégralement** l'infra alertes Qualiopi existante. Aucune nouvelle table, aucun nouveau moteur, aucun nouveau dropdown.

### 4.1 Existant réutilisé

- Modèle **`AlerteSysteme`** (`prisma/schema.prisma:6309`) : `code`, `niveau` (`AlerteNiveau` = `info|important|critique`), `titre`, `message`, `cibleType`, `cibleId`, `lu`, `resolue`, `resolueAt`, `metadata`. Index sur `code`, `resolue`, `niveau`, `(cibleType,cibleId)`.
- Service **`src/server/qualiopi/alertes/alertes-service.ts`** : `creerOuDedup(AlerteInput)` (dédup sur `code`+`cibleId` non résolu), `resoudreAlerte`, `listAlertes`, `countNonLues`, `synchroniserAlertes`. **Stub-aware** (`stub.invalid` → no-op).
- Affichage : **`AdminNotificationsDropdown.tsx`** + flux SSE **`/api/qualiopi/alertes/stream`** + page **`…/qualiopi/alertes/page.tsx`**.

### 4.2 NEUF : codes d'alerte e-learning (ajoutés au catalogue)

On **étend** `src/server/qualiopi/alertes/catalogue.ts` (`ALERTE_CATALOGUE`) avec des codes préfixés `elearning_*`, et on ajoute un **évaluateur dédié** `src/server/elearning/pilotage/alertes-elearning.ts` branché dans `evaluerAlertes` (`src/server/qualiopi/alertes/evaluateur.ts`) **ou** appelé par le cron e-learning (cf. §4.3).

| `code`                                  | `niveau`    | Déclencheur                                                                                                                                                    | `cibleType` / `cibleId`      |
| --------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `elearning_acces_jamais_active`         | `important` | `actif` + `premiereConnexionAt is null` + `accordeAt < now-7j`                                                                                                 | `ElearningEnrollment` / id   |
| `elearning_decrochage`                  | `important` | conditions §3.3 (inactivité ≥14 j, en cours)                                                                                                                   | `ElearningEnrollment` / id   |
| `elearning_acces_expire_j7`             | `info`      | `expiresAt` dans ≤7 j et cours non terminé                                                                                                                     | `ElearningEnrollment` / id   |
| `elearning_corrections_en_attente`      | `important` | `count(QuizAttempt.statut=a_corriger) > SEUIL` (défaut 5) ou attente > 72 h                                                                                    | `Quiz` / id (le plus ancien) |
| `elearning_devoir_a_evaluer`            | `info`      | devoir rendu non noté > 72 h                                                                                                                                   | `ElearningLesson` / id       |
| `elearning_quiz_echecs_repetes`         | `important` | un apprenant a épuisé `maxTentatives` sans réussir un quiz **bloquant** (`unlockQuizId`) → reste verrouillé                                                    | `ElearningEnrollment` / id   |
| `elearning_cours_sans_evaluation`       | `critique`  | cours `publie` + `estFoad=true` **sans aucun** `Quiz` de finalité `evaluation`/`final_certificatif` → **non-conformité Ind.11 majeure** (garde-fou doc 03 §12) | `ElearningCourse` / id       |
| `elearning_certificat_echec_generation` | `critique`  | `elearning-certificat-worker` a échoué (réussite atteinte mais PDF non généré)                                                                                 | `ElearningEnrollment` / id   |
| `elearning_taux_completion_bas`         | `info`      | un cours `publie` < 30 % complétion sur 30 j glissants (signal qualité pédagogique)                                                                            | `ElearningCourse` / id       |

> **Dédup native** : `creerOuDedup` empêche les doublons tant que l'alerte n'est pas résolue (clé `code`+`cibleId`). **Auto-résolution** : les codes réversibles (`elearning_acces_jamais_active` → l'apprenant s'est connecté ; `elearning_decrochage` → reprise d'activité ; `elearning_corrections_en_attente` → file vidée) sont listés dans `codesAutoResolution` et résolus par `synchroniserAlertes` quand la condition disparaît (même mécanisme que les alertes Qualiopi).

### 4.3 Branchement worker / cron

Le cron e-learning **`elearning-access-lifecycle-worker.ts`** (doc 02 §9, BullMQ `queues.ts`) appelle, à chaque passe : (1) `passage statut → expire`, (2) **`synchroniserAlertesElearning()`** (nouveau, dans `alertes-elearning.ts`) qui évalue les conditions ci-dessus et appelle `creerOuDedup` / résout. Ainsi **un seul cron** pilote cycle de vie **et** alertes — pas de cron redondant. Le `code` `elearning_cours_sans_evaluation` est aussi vérifié **à la publication** d'un cours (doc 01 §8 / outil auteur `03-outil-auteur-course-builder.md`) pour bloquer en amont.

### 4.4 Rendu dans le dashboard

En tête du dashboard, un **bandeau alertes** (`AdminCard` + liste) lit `listAlertes({ resolue: false, limit: 8 })` filtré sur les codes `elearning_*`. Chaque ligne : `niveau` (pastille via tone), `titre`, `message`, lien vers la cible (`cibleType`+`cibleId` → route admin correspondante), bouton « Résoudre » (server action `resoudreAlerte`). Le compteur non-lues alimente le badge nav (réutilise `countNonLues`, filtrable par préfixe code).

---

## 5. Vues croisées (drill-down)

Le dashboard offre **3 axes de lecture** accessibles par onglets (`AdminTabs`) ou cartes cliquables. Chaque vue = `AdminTable` triable + filtres (`AdminFilterTabs`/`AdminFilterChip`) + export (§6).

### 5.1 Vue **par cours** (`…/elearning/pilotage?vue=cours`)

Une ligne par `ElearningCourse` (statut `publie` par défaut, filtre archivés). Colonnes :

| Colonne     | Source                                 | Calcul                                                          |
| ----------- | -------------------------------------- | --------------------------------------------------------------- |
| Cours       | `ElearningCourse.titre` (lien builder) | —                                                               |
| Inscrits    | `ElearningEnrollment`                  | `count` par `courseId`                                          |
| Actifs      | idem                                   | `count(statut=actif)`                                           |
| Complétion  | `CourseProgress`                       | `% statut=termine`                                              |
| Réussite    | `CourseProgress`                       | `% reussite=true`                                               |
| Score moyen | `CourseProgress.scoreGlobalPct`        | `avg`                                                           |
| Temps moyen | `CourseProgress.tempsTotalSec`         | `avg` formaté                                                   |
| Décrochage  | §3.3                                   | `count à risque`                                                |
| Conformité  | doc 03 §12                             | badge `AdminBadge` : ✅ a une éval finale / ⛔ Ind.11 manquante |

Drill encore : clic sur un cours → **détail cours** (répartition par module via `ModuleProgress` : taux de déverrouillage, points de blocage = modules où `% estDeverrouille` chute → identifie le **mur pédagogique**).

### 5.2 Vue **par entreprise** (`…/elearning/pilotage?vue=entreprise`)

Une ligne par `Client` ayant ≥1 `ElearningEnrollment.clientId`. Réutilise le CRM `Client` existant (`:4890`, `raisonSociale`/`siret`/`opco`). Colonnes : entreprise, sièges octroyés (`count enrollments`), actifs, complétion moyenne, temps total cumulé (pour facturation OPCO / refacturation), certificats émis, décrochage.

> **MVP** : la notion d'« entreprise » s'appuie sur `ElearningEnrollment.clientId` (octroi en masse côté Axion-IA, ADR-LMS-0002). **V2** : cette vue devient l'**espace de reporting cloisonné** délégué à l'admin entreprise (multi-tenant, `02-ARCHITECTURE/multi-tenant-strategie.md`). Le dashboard admin Axion-IA garde une vue globale cross-tenant.

### 5.3 Vue **par apprenant** (`…/elearning/pilotage?vue=apprenant`)

Une ligne par `Trainee` ayant ≥1 accès. **Minimisation PII** : on affiche le strict nécessaire (nom/email déchiffrés à la volée comme ailleurs dans l'admin, jamais le handicap chiffré). Colonnes : apprenant, entreprise (si `clientId`), nb cours, complétion moyenne, dernier accès (`dernierAccesAt`), statut décrochage, certificats. Clic → **fiche apprenant** (`04-gestion-apprenants.md`) : timeline des `ElearningXapiStatement`, progression par cours/module/leçon, tentatives quiz, devoirs rendus, accès (octroi/expiration), bouton **override déverrouillage** (doc 02 `ModuleProgress.overrideDeverrouille`, tracé).

---

## 6. Exports

Tous les exports respectent : RBAC `requireAdminRead` (export simple) / `requireAdminPublish` (export nominatif conformité), filtres courants de la vue, **CSV `;` FR** (pattern existant `facturesToCsv` / `escapeCsvField` dans `src/server/qualiopi/financements/compta-export.ts`), encodage UTF-8 BOM (Excel FR).

### 6.1 Formats

| Export                                                    | Contenu                                                                                                  | Format                                                                       | Usage                                            |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------ |
| **Synthèse pilotage**                                     | les 12 KPIs + filtres appliqués                                                                          | CSV / PDF                                                                    | reporting interne, COPIL                         |
| **Suivi par cours**                                       | tableau §5.1                                                                                             | CSV                                                                          | analyse pédagogique                              |
| **Suivi par entreprise**                                  | tableau §5.2                                                                                             | CSV                                                                          | refacturation / bilan OPCO par client            |
| **Suivi par apprenant**                                   | tableau §5.3                                                                                             | CSV                                                                          | gestion                                          |
| **Attestation d'assiduité / réalisation** (par apprenant) | heures réalisées (`tempsTotalSec`), jalons d'évaluation, complétion                                      | PDF via `DocumentGenere` (réutilise pipeline `@react-pdf/renderer` Qualiopi) | **preuve OPCO / Qualiopi**                       |
| **Faisceau de preuves FOAD** (par enrollment)             | journal `ElearningXapiStatement` + `LessonProgress` + `QuizAttempt`/`Answer` + devoirs (liens R2 signés) | CSV + bundle                                                                 | **contrôle OPCO / audit** (R.6313-3, doc 02 §10) |

### 6.2 Implémentation (chemins cibles)

- Service d'export : `src/server/elearning/pilotage/exports.ts` — fonctions pures `pilotageToCsv()`, `coursToCsv()`, `entrepriseToCsv()`, `apprenantToCsv()`, `preuvesFoadToCsv(enrollmentId)`. Réutilise `escapeCsvField` (extrait/partagé) plutôt que de le redupliquer.
- Téléchargement : **route API** `src/app/api/elearning/exports/[type]/route.ts` (`force-dynamic`, RBAC via `auth()` + rôle ; renvoie `Content-Type: text/csv; charset=utf-8` + `Content-Disposition: attachment`). Pas de server action pour le binaire (pattern download = route handler).
- Export volumineux (faisceau de preuves multi-apprenants) → **worker** `elearning-export-worker.ts` (BullMQ) qui écrit le bundle sur **R2** (`uploadToR2`) et renvoie une **URL signée** (`getSignedUrlR2`) par email/notif — évite de bloquer la requête (budget INP/timeout).
- L'attestation PDF passe par le **même** worker certificat/document que Qualiopi (`DocumentGenere` + `qrToken`), pas un nouveau pipeline.

---

## 7. Architecture technique

### 7.1 Service de pilotage (NEUF — mais calque `pilotage-service.ts`)

`src/server/elearning/pilotage/pilotage-service.ts` :

```ts
export interface ElearningKpi {
  code: string;
  libelle: string;
  valeur: number | string;
  unite?: string;
  delta?: string;
  tone?: "default" | "success" | "warning" | "destructive" | "info";
  href?: string;
}
export interface PilotageElearningFiltre {
  from?: Date;
  to?: Date;
  courseId?: string;
  clientId?: string;
  source?: ElearningEnrollmentSource;
}
export interface PilotageElearningResult {
  kpis: ElearningKpi[];
  genereLe: string;
  filtre: PilotageElearningFiltre;
}

export async function getPilotageElearning(
  filtre: PilotageElearningFiltre,
): Promise<PilotageElearningResult>;
export async function getVueParCours(filtre): Promise<CoursRow[]>;
export async function getVueParEntreprise(filtre): Promise<EntrepriseRow[]>;
export async function getVueParApprenant(filtre): Promise<ApprenantRow[]>;
```

- **Cache Redis fail-soft TTL 3600 s** (copie exacte du pattern `pilotage-service.ts` : `redis.get` / `redis.set(key, json, "EX", 3600)`, clé `elearning:pilotage:<hash(filtre)>`). Invalidation paresseuse (TTL), pas d'invalidation événementielle en V1.
- **Stub-aware** : si `DATABASE_URL.includes("stub.invalid")` → retourne des KPIs à `0`/`—` sans appel Prisma (comme `alertes-service.ts`). Garantit la compatibilité build GH Actions.
- **Requêtes** : `groupBy`/`aggregate`/`count` Prisma sur les **agrégats déjà matérialisés** (`CourseProgress`, `ModuleProgress`) + index existants (doc 02 §11). Aucune lecture de `ElearningXapiStatement` à chaud (réservé aux exports). Pas de N+1 : 1 `groupBy` par axe.

### 7.2 Page & composants

| Chemin cible                                                         | Rôle                                               | Notes                                                                                                                                               |
| -------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/[locale]/(admin)/[adminPrefix]/elearning/pilotage/page.tsx` | Server Component dashboard                         | `dynamic="force-dynamic"`, `metadata.robots={index:false}`, garde RBAC (pattern page Qualiopi pilotage : `auth()` + check rôle → `redirect(login)`) |
| `src/components/admin/elearning/PilotageKpiGrid.tsx`                 | grille de `AdminStatCard`                          | mappe `ElearningKpi[]` → tuiles ; **réutilise** `AdminStatCard`                                                                                     |
| `src/components/admin/elearning/PilotageAlertesBanner.tsx`           | bandeau alertes (§4.4)                             | `AdminCard` + `resoudreAlerte` (server action)                                                                                                      |
| `src/components/admin/elearning/PilotageVueTable.tsx`                | table d'une vue                                    | **réutilise** `AdminTable`/`AdminBadge`/`AdminPagination`/`AdminFilterTabs`                                                                         |
| `src/components/admin/elearning/PilotageFiltres.tsx`                 | barre de filtres (période/cours/entreprise/source) | persistés en searchParams (URL = source de vérité, pattern `?annee=` Qualiopi)                                                                      |
| `src/server/elearning/pilotage/seuils.ts`                            | constantes de seuils (§3.3)                        | SSOT partagé service + worker + alertes                                                                                                             |
| `src/server/elearning/pilotage/exports.ts`                           | exports CSV/PDF (§6)                               | —                                                                                                                                                   |
| `src/app/api/elearning/exports/[type]/route.ts`                      | download                                           | route handler, RBAC                                                                                                                                 |

### 7.3 Navigation admin

Dans **`src/lib/admin-nav.ts`** (SSOT nav ; ⚠️ la sidebar montée est **`AdminSidebarNav.tsx`**, pas `AdminSidebar.tsx`) : nouveau groupe `AdminNavGroup = "elearning"`, item **« Pilotage »** (`href: …/elearning/pilotage`, `group: "elearning"`, `tier: "simple"`). Items frères du pôle e-learning (cf. `01-navigation-structure.md`) : Cours, Apprenants, Accès, Quiz, Corrections (badge `a_corriger` via `countNonLues`-like), Certificats. Badge alertes e-learning sur l'item Pilotage = `count(AlerteSysteme.code LIKE 'elearning_%' AND resolue=false)`.

### 7.4 Performance & accessibilité

- Page admin **hors** budgets Web Vitals publics (derrière auth, `force-dynamic`) — mais on garde l'esprit : pas de gros client-JS, grilles en Server Components, tables paginées (`AdminPagination`), pas de graphes lourds en MVP (chiffres + tables ; graphiques sparkline V1+ en lazy/`dynamic import` si ajoutés).
- WCAG 2.2 AA admin : `AdminStatCard` a déjà focus-visible + cible ≥ `--target-admin-min-desktop` ; tables avec en-têtes scope ; tones jamais **seule** porteuse d'info (toujours doublée d'un libellé/valeur).

---

## 8. EXISTANT réutilisé vs NEUF (récap)

**Réutilisé (zéro duplication)** :

- `AdminStatCard`, `AdminPageShell`, `AdminPageHeader`, `AdminTable`, `AdminBadge`, `AdminTabs`, `AdminFilterTabs`, `AdminPagination`, `AdminCard` (`src/components/admin/ui/*`).
- `AlerteSysteme` (`schema.prisma:6309`) + `alertes-service.ts` (`creerOuDedup`/`resoudreAlerte`/`listAlertes`/`countNonLues`/`synchroniserAlertes`) + `catalogue.ts`/`evaluateur.ts` + `AdminNotificationsDropdown` + `/api/qualiopi/alertes/stream`.
- Pattern cache Redis TTL 3600 fail-soft + stub-aware (`pilotage-service.ts`, `alertes-service.ts`).
- Pattern CSV FR (`escapeCsvField`/`facturesToCsv`, `compta-export.ts`).
- RBAC `_guards.ts` (`requireAdminRead`/`requireAdminPublish`), `auth()` + check rôle (pattern page Qualiopi pilotage).
- Agrégats matérialisés doc 02 (`CourseProgress`/`ModuleProgress`/`LessonProgress`) + runtime quiz doc 03 (`QuizAttempt`) + `ElearningXapiStatement` (preuves) — **lus, jamais recalculés à chaud**.
- `DocumentGenere`+`qrToken` + pipeline PDF Qualiopi (attestations d'assiduité), `r2-storage.ts` (`uploadToR2`/`getSignedUrlR2`) pour les bundles d'export.
- CRM `Client` (`:4890`) pour la vue entreprise.

**Neuf (ce document)** :

- `src/server/elearning/pilotage/pilotage-service.ts` (KPIs + 3 vues), `seuils.ts` (SSOT seuils décrochage/entrée), `exports.ts`, `alertes-elearning.ts` (codes + `synchroniserAlertesElearning`).
- Page `…/elearning/pilotage/page.tsx` + composants `PilotageKpiGrid`/`PilotageAlertesBanner`/`PilotageVueTable`/`PilotageFiltres`.
- Route `…/api/elearning/exports/[type]/route.ts` + worker `elearning-export-worker.ts`.
- ~9 nouveaux `code` dans `ALERTE_CATALOGUE` + entrée nav `group:"elearning"` (`admin-nav.ts`).

**Aucune migration** (lecture seule + extension du catalogue d'alertes en code). Conforme ADR-LMS-0007/0008 et contrat `stub.invalid`.

---

## 9. Découpage MVP vs V1

| Élément                                                 | MVP                                                                    | V1                              |
| ------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------- |
| KPIs K1, K2, K4, K6, K11 (suivi basique)                | ✅                                                                     | ✅                              |
| KPIs complets K1–K12 + `delta` période                  |                                                                        | ✅                              |
| Bandeau alertes + codes `elearning_*` + auto-résolution | partiel (codes conformité critiques `elearning_cours_sans_evaluation`) | ✅ complet                      |
| Vue par cours                                           | ✅ basique                                                             | ✅ + drill module               |
| Vue par entreprise                                      |                                                                        | ✅ (V2 = cloisonné)             |
| Vue par apprenant + fiche timeline xAPI                 | ✅ liste                                                               | ✅ timeline complète            |
| Exports CSV                                             | ✅ par cours/apprenant                                                 | ✅ tous + faisceau preuves FOAD |
| Attestation assiduité PDF                               | ✅ (preuve OPCO indispensable)                                         | ✅                              |
| Cache Redis + worker export async                       | (synchrone)                                                            | ✅                              |

---

## Liens

- `01-navigation-structure.md` — pôle e-learning dans `admin-nav.ts` (groupe `elearning`), placement de l'item Pilotage.
- `03-outil-auteur-course-builder.md` — garde-fou Ind.11 à la publication (alerte `elearning_cours_sans_evaluation`).
- `04-gestion-apprenants.md` — fiche apprenant (drill-down §5.3), override déverrouillage.
- `05-gestion-acces-entreprises.md` — octroi/import masse (alimente vue entreprise §5.2).
- `06-gestion-banque-quiz.md` — corrections en attente (K11) & devoirs (K12).
- `07-gestion-certificats.md` — certificats émis (K10), attestation d'assiduité.
- `08-reporting-analytics.md` — analytics avancées / graphes (extension de ce dashboard).
- `../03-DATA-MODEL/02-schema-progression-tracking.md` — `ElearningEnrollment`, `CourseProgress`, `ModuleProgress`, `LessonProgress`, `ElearningXapiStatement` (sources des KPIs).
- `../03-DATA-MODEL/03-schema-quiz-evaluations.md` — `QuizAttempt` (quiz réussis, corrections), Ind.11.
- `../03-DATA-MODEL/01-schema-cours-modules-lecons.md` — `ElearningCourse` (catalogue, seuils).
- `../08-CONFORMITE/06-tracabilite-preuves-realisation.md` — faisceau de preuves FOAD (export §6).
- `../11-ROADMAP/01-phasage-mvp-v1-v2.md` — phasage MVP/V1/V2 (dashboard = V1).
