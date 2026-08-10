# Console admin — Gestion des apprenants

> **But du document.** Spécifier, prête à coder par une équipe senior, la **gestion des apprenants e-learning** dans la console admin Axion-IA : liste/recherche, fiche apprenant (progression, quiz, certificats, accès), octroi / révocation / prolongation / suspension d'accès, envoi & renvoi d'accès (magic-link), et RGPD (export / suppression).
>
> **Principe directeur (anti-duplication).** L'apprenant **EST le `Trainee` existant** (`prisma/schema.prisma:5274`). On **ne crée aucun nouvel écran « stagiaires »** : on **étend** l'existant `qualiopi/stagiaires` et on **ajoute** une vue centrée e-learning `elearning/apprenants`. Toutes les briques d'accès, de portail et de RGPD sont **déjà codées** côté Qualiopi (`portail-service.ts`, `rgpd-service.ts`, `portail.ts`, `trainees.ts`) et **réutilisées telles quelles**.
>
> **Architecture imposée.** Next.js 16.2 App Router, Server Actions (pas de REST), Prisma 5.22, RBAC NextAuth admin (`requireAdmin*`), cloisonnement `src/server/elearning/**` (ADR-LMS-0007), migrations additives (ADR-LMS-0008), stub-aware `stub.invalid`. La gestion des **accès entreprise / import CSV** est traitée dans le document frère `05-gestion-acces-entreprises.md` ; ici on couvre l'**apprenant individuel** (et le rattachement entreprise en lecture).

---

## 0. TL;DR pour un dev senior

- **Modèle pivot = `Trainee`** (`@db.Uuid`). Étendu (doc data model 04) avec `learnerStatut`, `passwordHash?`, `primaryOrganisationClientId?`, anti-bruteforce, préférences. **Aucune table apprenant neuve.**
- **Deux entrées de menu, une même entité :**
  - `qualiopi/stagiaires` (EXISTANT, présentiel/live) — on l'**enrichit** d'un onglet « E-learning ».
  - `elearning/apprenants` (NEUF) — liste filtrée sur les `Trainee` qui ont ≥ 1 `ElearningEnrollment`, avec colonnes progression/accès.
- **Accès = `ElearningEnrollment`** (doc data model 02, `@db.Uuid` côté `traineeId`/`clientId`/`certificatDocumentId`). Un apprenant a N enrollments (un par cours).
- **Octroi / révocation / prolongation / suspension** = `access.actions.ts` (NEUF, spec dans `04-BACKEND/02-server-actions.md` §6). **Envoi / renvoi d'accès** = magic-link `creerAcces` (EXISTANT `portail-service.ts`) déjà exposé par `genererPortailAccesAction` (EXISTANT `portail.ts:233`) — réutilisé, on ajoute le wrapping email e-learning.
- **RGPD** = `exporterDonneesStagiaire` / `supprimerStagiaire` / `creerDemandeRgpd` (EXISTANT `rgpd-service.ts`) — on **étend l'export** pour inclure les données e-learning et on **complète l'anonymisation/cascade** des nouvelles tables.
- **RBAC** : lecture `requireAdminRead`, mutations `requireAdminWrite`, suppression RGPD dure réservée `requireAdminDelete` (super_admin). Audit via `logQualiopiActivity` (EXISTANT, `_guards.ts:51`) avec actions préfixées `elearning.learner.*`.
- **Stub-aware** : toutes les pages sont derrière auth admin + `force-dynamic` ; les services répliquent le garde `stub.invalid`.

---

## 1. EXISTANT réutilisé vs NEUF

### 1.1 Réutilisé tel quel (vérifié dans le code)

| Brique                                                                  | Emplacement                                                                                                                                                                                                                                                         | Rôle dans la gestion des apprenants                                                                                                               |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Trainee`                                                               | `prisma/schema.prisma:5274` (`trainees`)                                                                                                                                                                                                                            | Identité apprenant (PII, handicap chiffré, consentements, `deletedAt`). Étendu (doc 04).                                                          |
| `PortailAcces`                                                          | `prisma/schema.prisma:6236`                                                                                                                                                                                                                                         | Session/token d'accès (64 hex, 90 j, `revoked`, `lastUsedAt`). Source de l'« envoi/renvoi d'accès ».                                              |
| `creerAcces` / `revoquerAcces` / `verifierToken` / `getEspaceStagiaire` | `src/server/qualiopi/portail/portail-service.ts`                                                                                                                                                                                                                    | Génération/révocation token, vue apprenant. Réutilisés.                                                                                           |
| `genererPortailAccesAction` / `revoquerPortailAccesAction`              | `src/server/actions/qualiopi/portail.ts:233` / `:270`                                                                                                                                                                                                               | Server actions admin déjà câblées (guard `requireAdminWrite`, audit, URL magic-link). Réutilisées pour « envoyer / renvoyer / révoquer l'accès ». |
| `exporterDonneesStagiaire` / `supprimerStagiaire` / `creerDemandeRgpd`  | `src/server/qualiopi/portail/rgpd-service.ts`                                                                                                                                                                                                                       | Export JSON art.15, anonymisation+`deletedAt` art.17, traçabilité demande. **Étendus** pour l'e-learning (§7).                                    |
| `RgpdDemande` (+ enums `RgpdDemandeType`/`Statut`)                      | `prisma/schema.prisma:6277` / `:6221`                                                                                                                                                                                                                               | Traçabilité des demandes RGPD. Réutilisé tel quel.                                                                                                |
| `createTraineeAction` / `updateTraineeAction`                           | `src/server/actions/qualiopi/trainees.ts:52` / `:106`                                                                                                                                                                                                               | CRUD identité apprenant. Réutilisés (création à la volée lors d'un octroi).                                                                       |
| Écrans `qualiopi/stagiaires`                                            | `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/stagiaires/{page,[id]/page,new/page}.tsx`                                                                                                                                                                          | Liste + fiche + création stagiaire. **Enrichis** d'un bloc e-learning (§4.7).                                                                     |
| RBAC admin                                                              | `src/server/actions/knowledge/_guards.ts` (`requireAdminRead/Write/Publish/Delete`)                                                                                                                                                                                 | Contrôle d'accès console. Réutilisé.                                                                                                              |
| `logQualiopiActivity`                                                   | `src/server/actions/qualiopi/_guards.ts:51`                                                                                                                                                                                                                         | Audit log centralisé. Réutilisé (actions `elearning.learner.*`).                                                                                  |
| `ActivityLog`                                                           | modèle Prisma existant                                                                                                                                                                                                                                              | Journal d'audit.                                                                                                                                  |
| Composants console                                                      | `src/components/admin/ui/*` : `AdminPageShell`, `AdminPageHeader`, `AdminTable`, `AdminBadge`, `AdminStatCard`, `AdminTabs`, `AdminPagination`, `AdminToolbar`, `AdminFilterTabs`, `AdminConfirmDialog`, `AdminEmptyState`, `AdminBulkActions`, `AdminSubmitButton` | Toute l'UI s'appuie dessus (zéro composant table maison).                                                                                         |
| `AdminSidebarNav.tsx` + `src/lib/admin-nav.ts`                          | navigation montée                                                                                                                                                                                                                                                   | On y **ajoute** le groupe e-learning (§3). ⚠️ le composant monté est `AdminSidebarNav.tsx`.                                                       |
| R2 `src/lib/r2-storage.ts`                                              | `getSignedUrlR2`                                                                                                                                                                                                                                                    | Liens signés certificats / pièces de devoir dans la fiche.                                                                                        |
| `DocumentGenere` + QR                                                   | `prisma/schema.prisma:5507` ; `src/server/qualiopi/documents/qr.ts`                                                                                                                                                                                                 | Certificats e-learning affichés/relinkés dans la fiche.                                                                                           |

### 1.2 Neuf à construire (cloisonné ADR-0007)

| Élément                                                         | Type                | Emplacement cible                                                                                |
| --------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------ |
| Liste apprenants e-learning                                     | page RSC            | `src/app/[locale]/(admin)/[adminPrefix]/elearning/apprenants/page.tsx`                           |
| Fiche apprenant e-learning                                      | page RSC            | `.../elearning/apprenants/[traineeId]/page.tsx`                                                  |
| Onglets fiche (progression / quiz / certificats / accès / RGPD) | sous-routes ou tabs | `.../[traineeId]/(tabs)` ou query `?tab=`                                                        |
| Service de lecture (read-models fiche)                          | code                | `src/server/elearning/services/learner-admin-service.ts`                                         |
| Server actions gestion accès apprenant                          | code                | `src/server/elearning/actions/access.actions.ts` (spec §6 de `04-BACKEND/02-server-actions.md`)  |
| Server action « renvoyer l'accès e-learning » (email)           | code                | `src/server/elearning/actions/access.actions.ts` (`resendLearnerAccessAction`)                   |
| Extension export RGPD e-learning                                | code                | `src/server/elearning/services/rgpd-elearning.ts` (helper appelé par `exporterDonneesStagiaire`) |
| Composants admin                                                | UI                  | `src/components/admin/elearning/learners/**`                                                     |
| Entrées nav                                                     | config              | `src/lib/admin-nav.ts` (groupe `elearning`)                                                      |
| Template email accès e-learning                                 | React Email         | `src/lib/email/templates/elearning-acces-ouvert.tsx`                                             |

> **Frontière avec `05-gestion-acces-entreprises.md`.** Ce doc traite l'apprenant **comme individu** (sa fiche, ses accès, son RGPD). L'octroi **en masse** (import CSV, pack entreprise, vue par `Client`) est dans le doc 05. Les deux partagent les mêmes server actions (`access.actions.ts`) et le même modèle `ElearningEnrollment`.

---

## 2. Modèle de données mobilisé (rappel — sources figées)

> Aucun nouveau modèle ici. On consomme ceux des docs data model. Rappel des champs **utilisés par les écrans de ce document** (noms exacts) :

- **`Trainee`** (`@db.Uuid`) : `id, nom, prenom, email (citext, unique), telephone?, entreprise?, fonction?, situationHandicap, deletedAt?, createdAt` + extensions doc 04 : `learnerStatut (LearnerAccountStatut: invite|actif|suspendu)`, `passwordHash?`, `passwordSetAt?`, `emailVerifiedAt?`, `lastLoginAt?`, `lastLoginMethod?`, `failedLoginCount`, `lockedUntil?`, `primaryOrganisationClientId? (Client @db.Uuid)`, `preferencesJson?`.
- **`ElearningEnrollment`** (doc 02 ; `traineeId/clientId/certificatDocumentId/enrollmentOrigineId` en `@db.Uuid`, `courseId` text) : `id, traineeId, courseId, source (ElearningEnrollmentSource), statut (ElearningEnrollmentStatut: actif|suspendu|expire|revoque|termine), accordeAt, premiereConnexionAt?, expiresAt?, dernierAccesAt?, suspenduRaison?, certificatDocumentId?, certificatEmisAt?, octroyeParId?, clientId?, metadata`.
- **`CourseProgress`** (doc 02) : `pourcentage, statut (ElearningProgressStatut), completedAt?` — agrégat par enrollment.
- **`ModuleProgress` / `LessonProgress`** (doc 02) : détail (% par module/leçon, `positionSec`, `derniereVueAt`, `completedAt`).
- **`QuizAttempt`** (doc 03) : `quizId, enrollmentId, startedAt, submittedAt?, scorePct?, reussi?, statut, deadlineAt?` — tentatives de quiz.
- **`ElearningXapiStatement`** (doc 02) : journal horodaté (verbe/objet) = **preuve FOAD brute** affichée en timeline.
- **`PortailAcces`** (existant) : `token, expiresAt, revoked, lastUsedAt, authMethod?, createdIp?, lastIp?` (extensions doc 04).
- **`DocumentGenere`** (existant) : certificats de réalisation (`type=certificat_realisation`, `numero`, `qrToken`, `pdfUrl`, `hashSha256`).

> **Pas de migration dans ce document** : tout est porté par les migrations additives des docs data model 02/03/04.

---

## 3. Navigation & RBAC

### 3.1 Entrées de menu (`src/lib/admin-nav.ts`)

Ajouter un **groupe `elearning`** (après `qualiopi`), dont l'item « Apprenants ». Pattern identique aux items existants (`href`, `label`, `icon`, `group`) :

```ts
// groupe "elearning"
{ href: `${base}/elearning`,            label: "E-learning — Vue d'ensemble", icon: "🎬", group: "elearning" },
{ href: `${base}/elearning/cours`,      label: "Cours",        icon: "📚", group: "elearning" },
{ href: `${base}/elearning/apprenants`, label: "Apprenants",   icon: "🧑‍💻", group: "elearning" }, // ← CE DOC
{ href: `${base}/elearning/acces`,      label: "Accès & entreprises", icon: "🔑", group: "elearning" }, // doc 05
{ href: `${base}/elearning/certificats`,label: "Certificats",  icon: "🎓", group: "elearning" }, // doc 07
```

> ⚠️ **Rendu réel** : le composant monté est `AdminSidebarNav.tsx` (pas `AdminSidebar.tsx`). Vérifier que le nouveau `group: "elearning"` apparaît dans le mapping des libellés de groupe de `AdminSidebarNav`. (Cf. mémoire chantier « admin-nav-poles-clarity ».)

### 3.2 Matrice RBAC (réutilise `_guards.ts` existant)

| Capacité                                             | Guard                                            | Rôles                              |
| ---------------------------------------------------- | ------------------------------------------------ | ---------------------------------- |
| Lister / consulter la fiche apprenant                | `requireAdminRead()`                             | super_admin, admin, editor, reader |
| Octroyer / révoquer / suspendre / prolonger un accès | `requireAdminWrite()`                            | super_admin, admin, editor         |
| Envoyer / renvoyer un accès (magic-link)             | `requireAdminWrite()`                            | super_admin, admin, editor         |
| Export RGPD (générer le JSON)                        | `requireAdminWrite()`                            | super_admin, admin, editor         |
| Suppression RGPD (anonymisation)                     | `requireAdminDelete()`                           | super_admin uniquement             |
| Émettre / révoquer un certificat                     | `requireAdminPublish()` / `requireAdminDelete()` | cf. doc 07                         |

> **Lecture handicap.** Le détail handicap (`handicapDetailsChiffre`) reste chiffré (`pii-crypto`) et n'est **jamais** affiché dans la fiche apprenant e-learning standard ; sa lecture déchiffrée demeure réservée au référent handicap (écran Qualiopi existant). La fiche e-learning affiche uniquement le **booléen** `situationHandicap` (pour proposer une adaptation d'accès).

---

## 4. Écran « Liste des apprenants » (`elearning/apprenants`)

**Route :** `src/app/[locale]/(admin)/[adminPrefix]/elearning/apprenants/page.tsx` (RSC, `export const dynamic = "force-dynamic"`).

**Guard :** `requireAdminRead()` en tête de page.

**Définition métier de « apprenant e-learning » :** un `Trainee` ayant **≥ 1 `ElearningEnrollment`** (toutes sources confondues), `deletedAt = null` par défaut (toggle « inclure supprimés » réservé super_admin pour audit).

### 4.1 Colonnes du tableau (`AdminTable`)

| Colonne          | Source                                                               | Notes                                                          |
| ---------------- | -------------------------------------------------------------------- | -------------------------------------------------------------- |
| Apprenant        | `Trainee.prenom + nom`                                               | lien → fiche                                                   |
| Email            | `Trainee.email`                                                      | citext                                                         |
| Entreprise       | `primaryOrganisation?.nom` (Client) sinon `Trainee.entreprise` texte | badge si rattaché à un `Client`                                |
| Statut compte    | `Trainee.learnerStatut`                                              | `AdminBadge` : invite (gris) / actif (vert) / suspendu (rouge) |
| Cours actifs     | `count(ElearningEnrollment where statut=actif)`                      |                                                                |
| Progression moy. | moyenne `CourseProgress.pourcentage` sur enrollments actifs          | barre compacte                                                 |
| Dernier accès    | `max(ElearningEnrollment.dernierAccesAt)`                            | « jamais connecté » si null → cible relance                    |
| Certificats      | `count(certificatDocumentId not null)`                               |                                                                |
| Actions          | menu                                                                 | Voir / Octroyer un accès / Renvoyer l'accès / Export RGPD      |

### 4.2 Recherche & filtres (`AdminToolbar` + `AdminFilterTabs`)

- **Recherche plein texte** : `nom`, `prenom`, `email` (insensible casse via citext). Implémentée côté server action / RSC avec `OR` Prisma `contains` (`mode:"insensitive"`).
- **Filtres** :
  - Statut compte (`learnerStatut`) : tous / invite / actif / suspendu.
  - Cours (`courseId`) : sélecteur des `ElearningCourse` publiés.
  - Entreprise (`clientId` / `primaryOrganisationClientId`).
  - Source d'accès (`ElearningEnrollmentSource`).
  - État accès (`ElearningEnrollmentStatut`).
  - « Jamais connecté » (`premiereConnexionAt is null`) — segment anti-décrochage (Qualiopi Ind.12).
  - « Inactifs > 14 j » (`dernierAccesAt < now-14j`) — relance.
- **Tri** : dernier accès (défaut, desc), progression, nom.
- **Pagination** : `AdminPagination` (page-size 25, cursor ou offset selon volume).

### 4.3 Read-model de la liste (service)

`src/server/elearning/services/learner-admin-service.ts` :

```ts
export interface LearnerListFilters {
  q?: string;
  learnerStatut?: LearnerAccountStatut;
  courseId?: string;
  clientId?: string;
  source?: ElearningEnrollmentSource;
  accessStatut?: ElearningEnrollmentStatut;
  neverConnected?: boolean;
  inactiveSinceDays?: number;
  includeDeleted?: boolean;
  page?: number;
  pageSize?: number;
}

export interface LearnerListRow {
  traineeId: string; // @db.Uuid
  prenom: string;
  nom: string;
  email: string;
  entrepriseLabel: string | null;
  clientId: string | null;
  learnerStatut: LearnerAccountStatut;
  coursActifs: number;
  progressionMoyennePct: number; // 0..100
  dernierAccesAt: Date | null;
  premiereConnexionAt: Date | null;
  certificats: number;
}

export async function listLearners(
  f: LearnerListFilters,
): Promise<{ rows: LearnerListRow[]; total: number }>;
```

- **Stub-aware** : `if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return { rows: [], total: 0 };`
- **Perf** : une requête `prisma.trainee.findMany` avec `where: { elearningEnrollments: { some: {} } }`, `select` projeté + agrégats via `_count` et `include` ciblé sur `courseProgress`. Éviter le N+1 : calculer `progressionMoyennePct` à partir des `CourseProgress` inclus (pas de requête par ligne). Budget : page ≤ 50 ms côté DB.

### 4.4 Actions de masse (`AdminBulkActions`)

Sélection multi-lignes → actions en lot (toutes `requireAdminWrite`, exécutées via server action, enqueue si > 50) :

- **Renvoyer l'accès** (magic-link) aux sélectionnés.
- **Octroyer un cours** aux sélectionnés (choix du `courseId`).
- **Suspendre / réactiver** les accès sélectionnés.
- **Exporter CSV** de la sélection (colonnes liste — pas de PII handicap).

> Le détail des actions en masse côté provisioning est dans `05-gestion-acces-entreprises.md` (worker `elearning-bulk-provision-worker.ts`).

### 4.5 États vides & erreurs

- Liste vide → `AdminEmptyState` « Aucun apprenant e-learning. Octroyez un premier accès. » + CTA.
- Erreur DB → `AdminErrorState`.

### 4.6 Création d'un apprenant + octroi (raccourci)

Bouton « Octroyer un accès » (header) → modale réutilisant `grantAccessAction` (`access.actions.ts` §6.1 du doc backend) : cible un `Trainee` existant (autocomplete email) **ou** crée à la volée (`email/prenom/nom` → `createTraineeAction` EXISTANT en interne). Pas de nouvel écran de création : on réutilise le flux Qualiopi.

### 4.7 Enrichissement de l'écran Qualiopi existant `qualiopi/stagiaires/[id]`

Sur la **fiche stagiaire Qualiopi existante**, ajouter un **encart « E-learning »** (composant `LearnerElearningSummary`) listant les `ElearningEnrollment` du `Trainee` avec lien profond vers `elearning/apprenants/[traineeId]`. Cela garantit qu'un admin partant du présentiel voit aussi le e-learning, sans duplication de fiche.

---

## 5. Fiche apprenant (`elearning/apprenants/[traineeId]`)

**Route :** `.../elearning/apprenants/[traineeId]/page.tsx` (RSC, `force-dynamic`). **Guard :** `requireAdminRead()`. `params.traineeId` validé UUID ; 404 si introuvable.

**Layout :** `AdminPageShell` + `AdminPageHeader` (titre = nom apprenant, sous-titre = email + badge `learnerStatut`) + bandeau de **StatCards** + **AdminTabs**.

### 5.1 Bandeau StatCards (`AdminStatCard`)

- Cours suivis (actifs / total).
- Progression globale (moyenne des `CourseProgress.pourcentage`).
- Temps total estimé passé (somme `LessonProgress` temps / heartbeats) — indicatif.
- Quiz réussis / tentés.
- Certificats émis.
- Dernier accès (`dernierAccesAt`) + « 1re connexion » (`premiereConnexionAt`, = entrée effective FOAD/EDOF).

### 5.2 Onglets

| Onglet                 | Contenu                                                                               | Section |
| ---------------------- | ------------------------------------------------------------------------------------- | ------- |
| **Aperçu**             | identité, rattachement entreprise, consentements, statut compte, accès portail actifs | §5.3    |
| **Progression**        | par cours → modules → leçons (arbre), %, complétion, reprise                          | §5.4    |
| **Quiz & évaluations** | tentatives, scores, gating, correction manuelle en attente                            | §5.5    |
| **Certificats**        | certificats émis, lien signé + QR, émission/révocation                                | §5.6    |
| **Accès**              | enrollments (octroi/révoc/prolong/suspension) + sessions portail + envoi/renvoi       | §6      |
| **RGPD & journal**     | export, suppression, demandes RGPD, timeline xAPI (preuves)                           | §7      |

> Implémentation : `AdminTabs` (client léger) avec contenu RSC par onglet, ou sous-segments `(tabs)`. Privilégier RSC + query `?tab=` pour rester sous le budget First Load JS.

### 5.3 Onglet « Aperçu »

- **Identité** : `prenom nom`, `email`, `telephone?`, `fonction?`. Édition → réutilise `updateTraineeAction` (EXISTANT).
- **Entreprise** : `primaryOrganisation` (Client) avec lien fiche client ; sinon `entreprise` texte libre. Bouton « Rattacher à une entreprise » (V2-ready : crée/active une `ElearningOrgMembership`, cf. doc 04 — en MVP set `primaryOrganisationClientId`).
- **Statut compte** : `learnerStatut` + méthode dernière connexion (`lastLoginMethod`), `emailVerifiedAt`, verrou éventuel (`lockedUntil`). Bouton « Déverrouiller le compte » (reset `failedLoginCount`/`lockedUntil`) = action `unlockLearnerAccountAction` (`requireAdminWrite`).
- **Consentements** : `consentementFormation`, `consentementEmail`, version/date (lecture seule ; modif via flux dédié).
- **Accès portail actifs** : liste des `PortailAcces` non révoqués/non expirés (`createdAt`, `expiresAt`, `lastUsedAt`, `authMethod`). Boutons « Révoquer » (par ligne) et « Révoquer toutes les sessions ».

### 5.4 Onglet « Progression »

Arbre **Cours → Module → Leçon** par `ElearningEnrollment` :

- **Cours** : `CourseProgress.pourcentage` + `statut` + `completedAt?` + badge accès (`ElearningEnrollment.statut`).
- **Module** : `ModuleProgress` (%, déverrouillé ?). Affiche la **raison de verrouillage** si verrouillé (drip date / offset / quiz gating) — best practice 2026 (verrou affiché AVEC sa raison).
- **Leçon** : `LessonProgress` (%, `positionSec`/durée pour vidéo, `derniereVueAt`, `completedAt?`).
- **Action admin** : « Débloquer manuellement » une leçon/module pour cet apprenant → `overrideAttemptUnlockAction` (`requireAdminWrite`, motif obligatoire, tracé — doc backend §8.3).
- **Reprise** : indique la dernière leçon `en_cours` + `positionSec` (point de reprise).

### 5.5 Onglet « Quiz & évaluations »

- Table des `QuizAttempt` : quiz, date (`startedAt`/`submittedAt`), `scorePct`, `reussi`, `statut`, n° de tentative / `maxTentatives`, temps (deadline serveur).
- **Réponses détaillées** (drill-down) : `QuizAnswer` immuables (réponse / correct / points) = preuve.
- **Correction manuelle en attente** (types `essai`/`upload`) : CTA → `gradeManualAnswerAction` (`requireAdminWrite`/tuteur). Badge « N réponses à corriger ».
- **Pièces de devoir rendues** (`lesson type=devoir`) : liste avec lien signé R2 (`getSignedUrlR2`), jamais supprimables avant rétention (preuve FOAD « travaux »).
- **Gating** : montre quel module/leçon est débloqué par la réussite (lien vers onglet progression).

### 5.6 Onglet « Certificats »

- Liste des certificats de réalisation liés (`ElearningEnrollment.certificatDocumentId` → `DocumentGenere`) : `numero`, `certificatEmisAt`, heures réalisées, statut.
- **Lien PDF signé frais** : régénéré à la lecture via `getSignedUrlR2(documents/<year>/certificat/<numero>.pdf, 86400)` (même pattern que `getEspaceStagiaire`).
- **QR de vérification** : `qrToken` → `/verifier-attestation/[token]` (EXISTANT).
- **Émettre un certificat** : CTA → `issueCertificateAction` (`requireAdminPublish`, vérifie l'éligibilité — doc backend §9). **Révoquer** → `revokeCertificateAction` (`requireAdminDelete`). Détail complet dans `07-gestion-certificats.md`.

### 5.7 Read-model de la fiche (service)

`learner-admin-service.ts` :

```ts
export interface LearnerDetail {
  trainee: {
    id: string;
    prenom: string;
    nom: string;
    email: string;
    telephone: string | null;
    fonction: string | null;
    learnerStatut: LearnerAccountStatut;
    emailVerifiedAt: Date | null;
    lockedUntil: Date | null;
    lastLoginAt: Date | null;
    lastLoginMethod: string | null;
    situationHandicap: boolean;
    deletedAt: Date | null;
    createdAt: Date;
    entrepriseLabel: string | null;
    clientId: string | null;
    consentement: { formation: boolean; email: boolean; version: string | null; at: Date | null };
  };
  enrollments: LearnerEnrollmentView[]; // cours + CourseProgress + statut accès + certificat
  portailSessions: PortailSessionView[]; // PortailAcces non révoqués
  rgpdDemandes: { id: string; type: RgpdDemandeType; statut: RgpdDemandeStatut; demandeAt: Date }[];
}
export async function getLearnerDetail(traineeId: string): Promise<LearnerDetail | null>;
export async function getLearnerProgressTree(enrollmentId: string): Promise<ProgressTree>; // §5.4
export async function getLearnerQuizAttempts(enrollmentId: string): Promise<QuizAttemptView[]>; // §5.5
export async function getLearnerActivityTimeline(
  traineeId: string,
  limit?: number,
): Promise<XapiTimelineItem[]>; // §7.4
```

Tous **stub-aware** (lecture → `null`/`[]`). `getLearnerDetail` : un seul `findUnique` projeté + `include` ciblé (enrollments → course.titre + courseProgress + certificatDocument). Jamais `select: "*"` (ne **jamais** sérialiser `passwordHash`/`handicapDetailsChiffre`).

---

## 6. Gestion des accès (octroi / révocation / prolongation / suspension / envoi)

> **Server actions = `src/server/elearning/actions/access.actions.ts`** (spec normative dans `04-BACKEND/02-server-actions.md` §6). Cet écran les **consomme** ; on précise ici l'UX et les actions « envoi/renvoi » spécifiques à la fiche.

### 6.1 Octroyer un accès — `grantAccessAction` (EXISTANT-spec)

UI : modale « Octroyer un cours » depuis la fiche (le `traineeId` est pré-rempli). Champs : cours (`courseId`), expiration (`accessExpiresAt?`), source (`manuel_admin` par défaut), entreprise (`clientId?`), case « envoyer l'email d'accès ».

- Effet : crée/retourne (idempotent sur `(traineeId, courseId)`) un `ElearningEnrollment` `statut=actif`, `octroyeParId=session.userId`. Si « envoyer email » → magic-link (cf. §6.5).
- Retour `{ ok:true, id }` → toast + refresh onglet Accès.

### 6.2 Révoquer un accès — `revokeAccessAction`

Par ligne d'enrollment : `statut → revoque` (jamais delete — preuves conservées). `AdminConfirmDialog` (« L'apprenant perdra l'accès ; sa progression et ses certificats sont conservés. »). N'invalide **pas** un certificat déjà émis. Motif optionnel (`suspenduRaison`).

### 6.3 Suspendre / réactiver — `updateAccessAction`

`statut → suspendu` (gel temporaire, ex. impayé/litige) puis `→ actif`. Motif `suspenduRaison` requis à la suspension. Distinct de `revoque` (définitif).

### 6.4 Prolonger un accès — `updateAccessAction`

Modale « Prolonger » : nouvelle `accessExpiresAt` (ou « illimité » = `null`). Si l'accès était `expire`, repasse `actif` quand la nouvelle date est future. Audit `elearning.learner.access_extended`.

### 6.5 Envoyer / renvoyer l'accès (magic-link)

Deux briques complémentaires :

1. **Réutilisation directe** de `genererPortailAccesAction` (EXISTANT `portail.ts:233`) : crée un `PortailAcces` (token 90 j) et renvoie l'URL `/{locale}/portail/acces/<token>`. C'est le **lien magique** universel (présentiel + e-learning, même portail).
2. **NEUF — `resendLearnerAccessAction`** (`access.actions.ts`) qui **wrappe** (1) + **enqueue un email e-learning** :
   - `requireAdminWrite()` ; input `{ traineeId, courseId?, joursValidite? }`.
   - appelle `creerAcces(traineeId, joursValidite)` (EXISTANT), construit l'URL ;
   - **enqueue** `emailsQueue` avec le template **NEUF** `elearning-acces-ouvert.tsx` (rappel du/des cours octroyés + bouton magic-link + mention assistance/tutorat — exigence FOAD Ind.19) ;
   - audit `elearning.learner.access_sent` / `..._resent`.
   - Retour `{ ok:true, data:{ url, expiresAt } }` (l'URL est aussi copiable manuellement par l'admin).

> **Anti-doublon de session** : « renvoyer » crée un **nouveau** token (l'ancien reste valide jusqu'à expiration/révocation — comportement de `creerAcces`, documenté). Proposer dans l'UI « Révoquer les anciens liens » (appelle `revoquerPortailAccesAction` sur les sessions précédentes) si l'admin veut invalider.

### 6.6 Octroi auto depuis une session présentiel/live

Bouton (sur la fiche session Qualiopi, pas ici) → `autoGrantFromSessionAction` (doc backend §6.5) : pour chaque `Enrollment` (présentiel) de la session, ouvre l'accès e-learning correspondant (`source=session_formation`). **Pont blended learning.** Mentionné ici car ces enrollments apparaissent ensuite dans la fiche apprenant avec la source `session_formation`.

### 6.7 Tableau récap des actions accès (UX → action → guard)

| UX (fiche)                 | Server action                                     | Guard      | Effet                                         |
| -------------------------- | ------------------------------------------------- | ---------- | --------------------------------------------- |
| Octroyer un cours          | `grantAccessAction`                               | AdminWrite | crée `ElearningEnrollment` actif (idempotent) |
| Révoquer l'accès           | `revokeAccessAction`                              | AdminWrite | `statut=revoque`                              |
| Suspendre / réactiver      | `updateAccessAction`                              | AdminWrite | `statut=suspendu/actif` + motif               |
| Prolonger                  | `updateAccessAction`                              | AdminWrite | `accessExpiresAt`                             |
| Envoyer / renvoyer l'accès | `resendLearnerAccessAction` (wrappe `creerAcces`) | AdminWrite | `PortailAcces` + email                        |
| Révoquer un lien portail   | `revoquerPortailAccesAction` (EXISTANT)           | AdminWrite | `PortailAcces.revoked=true`                   |
| Déverrouiller le compte    | `unlockLearnerAccountAction`                      | AdminWrite | reset `failedLoginCount`/`lockedUntil`        |
| Débloquer une leçon        | `overrideAttemptUnlockAction`                     | AdminWrite | override tracé (motif)                        |

---

## 7. RGPD — export & suppression

> **Tout est déjà codé côté Qualiopi** (`rgpd-service.ts`) : on **réutilise** et on **étend** pour couvrir les nouvelles tables e-learning. Aucune réécriture.

### 7.1 Export (droit d'accès — art. 15)

- UI : bouton « Exporter les données (RGPD) » (onglet RGPD) → action `exportLearnerRgpdAction` (`requireAdminWrite`) qui appelle `exporterDonneesStagiaire(traineeId)` (EXISTANT) **étendu** via le helper **NEUF** `rgpd-elearning.ts:collectElearningRgpd(traineeId)`.
- **Extension de l'export** (à ajouter dans `exporterDonneesStagiaire` ou via merge du helper) : `elearningEnrollments` (cours, source, statut, dates, expiration), `courseProgress` / `moduleProgress` / `lessonProgress`, `quizAttempts` + `quizAnswers`, `xapiStatements` (preuves), `certificats` (numéros/heures), `portailSessions` (métadonnées d'accès, **sans** token en clair). **Ne jamais** inclure `passwordHash`, ni le token brut, ni le détail handicap chiffré (le handicap déchiffré reste géré comme aujourd'hui par l'export Qualiopi sous contrôle référent).
- Sortie : JSON téléchargeable (réponse action → blob côté client) **ou** dépôt R2 + lien signé pour les gros volumes. Trace `creerDemandeRgpd(traineeId, "export")` + statut `traitee`. Audit `elearning.learner.rgpd_export`.

### 7.2 Suppression (droit à l'effacement — art. 17, sous réserve de conservation légale)

- UI : bouton « Supprimer (anonymiser) » réservé **`requireAdminDelete()`** (super_admin), double confirmation `AdminConfirmDialog` (saisir l'email pour confirmer).
- Action `deleteLearnerRgpdAction` → `supprimerStagiaire(traineeId)` (EXISTANT) qui : anonymise PII `Trainee`, pose `deletedAt`, **révoque tous les `PortailAcces`** (déjà fait), anonymise coaching. **À COMPLÉTER (NEUF)** dans la même transaction pour l'e-learning :
  - `prisma.elearningEnrollment.updateMany({ where:{ traineeId }, data:{ metadata: {} } })` (purge d'éventuelles PII en `metadata` import) — l'enrollment lui-même est **conservé** (preuve de réalisation OPCO/Qualiopi).
  - purge des champs nominatifs libres des `QuizAnswer` de type `essai` (texte rédigé potentiellement nominatif) si politique de rétention le permet — sinon conservés comme preuve.
  - **conservation** : `CourseProgress`/`LessonProgress`/`QuizAttempt`/`ElearningXapiStatement`/certificats = **conservés** (faisceau de preuves FOAD, 3–6 ans ; comptable 10 ans). C'est cohérent avec la doctrine existante (anonymiser les PII, conserver les agrégats légaux).
  - `Trainee.passwordHash → null`, `learnerStatut → suspendu`, `preferencesJson → null`.
- Cascade automatique (FK `onDelete: Cascade`) **non utilisée** ici (on n'efface pas physiquement). Trace `creerDemandeRgpd(traineeId, "suppression")` + statut `traitee`. Audit `elearning.learner.rgpd_delete`.

> **Règle d'or (déjà appliquée dans le repo).** Effacement RGPD = **anonymisation PII + `deletedAt`**, **jamais** de DELETE physique (intégrité comptable art. 17§3b + preuves FOAD). On étend cette règle aux tables e-learning sans la contredire.

### 7.3 Demandes RGPD entrantes (depuis le portail)

L'apprenant peut déclencher lui-même `demanderExportRgpdAction` / `demanderSuppressionRgpdAction` (EXISTANT `portail.ts:202/217`) → crée une `RgpdDemande` `statut=demandee`. L'onglet RGPD de la fiche **liste ces demandes** et permet à l'admin de les **traiter** (déclenche §7.1/§7.2, passe `statut=traitee`). Une alerte système (catalogue d'alertes existant) signale les demandes non traitées (SLA 1 mois).

### 7.4 Journal d'activité (preuve + traçabilité)

- **Timeline xAPI** (`getLearnerActivityTimeline`) : affiche les `ElearningXapiStatement` (launched/progressed/completed/passed/failed/submitted…) horodatés = **preuve de réalisation FOAD** (R.6313-3, preuve libre). Filtrable par cours. Exportable.
- **Audit admin** : toutes les mutations sur l'apprenant (`elearning.learner.*`, `elearning.access.*`, `elearning.certificate.*`) sont écrites dans `ActivityLog` via `logQualiopiActivity` (qui/quoi/quand/IP).

---

## 8. Server actions de ce document (récap normatif)

Fichier principal : `src/server/elearning/actions/access.actions.ts` (sauf mention). Toutes : validation Zod (`_schemas.ts`), `ActionResult`, garde `stub.invalid`, audit, revalidation `revalidatePath` de la fiche.

| Action                                                                | Guard           | Input (Zod)                                                                                       | Effet                                                |
| --------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `grantAccessAction`                                                   | AdminWrite      | `{ courseId, traineeId?\|email+nom+prenom, source?, clientId?, accessExpiresAt?, envoyerEmail? }` | crée `ElearningEnrollment` (idempotent) + magic-link |
| `revokeAccessAction`                                                  | AdminWrite      | `{ enrollmentId, raison? }`                                                                       | `statut=revoque`                                     |
| `updateAccessAction`                                                  | AdminWrite      | `{ enrollmentId, statut?, accessExpiresAt?, suspenduRaison? }`                                    | suspendre/réactiver/prolonger                        |
| `resendLearnerAccessAction`                                           | AdminWrite      | `{ traineeId, courseId?, joursValidite? }`                                                        | `creerAcces` + email `elearning-acces-ouvert.tsx`    |
| `unlockLearnerAccountAction`                                          | AdminWrite      | `{ traineeId }`                                                                                   | reset `failedLoginCount`/`lockedUntil`               |
| `overrideAttemptUnlockAction`                                         | AdminWrite      | `{ enrollmentId, lessonId\|moduleId, raison }`                                                    | déverrouillage tracé                                 |
| `exportLearnerRgpdAction`                                             | AdminWrite      | `{ traineeId }`                                                                                   | JSON RGPD étendu + `RgpdDemande(traitee)`            |
| `deleteLearnerRgpdAction`                                             | **AdminDelete** | `{ traineeId, confirmEmail }`                                                                     | anonymisation + cascade conservation                 |
| `updateTraineeAction` (EXISTANT)                                      | AdminWrite      | identité                                                                                          | édition apprenant                                    |
| `genererPortailAccesAction` / `revoquerPortailAccesAction` (EXISTANT) | AdminWrite      | `{ traineeId }` / `{ id }`                                                                        | accès portail bas niveau                             |

> **Doctrine d'erreur** (alignée doc backend §0.1) : actions renvoient `{ ok:false, error }` pour les cas métier ; les guards throw `unauthorized`/`forbidden` (error boundary admin). Anti-énumération sur les flux email.

---

## 9. Composants UI (cibles)

`src/components/admin/elearning/learners/` :

- `LearnerTable.tsx` — wrappe `AdminTable` (liste §4).
- `LearnerFilters.tsx` — `AdminToolbar` + `AdminFilterTabs` (§4.2).
- `LearnerBulkActions.tsx` — `AdminBulkActions` (§4.4).
- `LearnerHeader.tsx` — `AdminPageHeader` + StatCards (§5.1).
- `LearnerOverviewTab.tsx` / `LearnerProgressTab.tsx` / `LearnerQuizTab.tsx` / `LearnerCertificatesTab.tsx` / `LearnerAccessTab.tsx` / `LearnerRgpdTab.tsx` (§5.2).
- `GrantAccessDialog.tsx` / `ExtendAccessDialog.tsx` / `ResendAccessButton.tsx` — modales d'action (`AdminConfirmDialog` réutilisé).
- `LearnerProgressTree.tsx` — arbre cours/module/leçon avec raisons de verrouillage.
- `LearnerActivityTimeline.tsx` — timeline xAPI.

`src/components/admin/elearning/learners/` (Qualiopi side) :

- `LearnerElearningSummary.tsx` — encart injecté dans `qualiopi/stagiaires/[id]` (§4.7).

**Contraintes Web Vitals** : favoriser RSC ; les modales/onglets interactifs en `"use client"` ciblés ; pas de gros bundle d'arborescence côté client (rendu serveur de l'arbre progression, interactions minimales). Accessibilité WCAG 2.2 AA : tableaux avec en-têtes, focus visibles, cibles ≥ 24px, dialogues focus-trap.

---

## 10. Points de vigilance (résumé dev)

1. **L'apprenant = `Trainee`** : ne créer aucune table/écran « utilisateur apprenant ». Réutiliser `qualiopi/stagiaires` + `trainees.ts` + `portail-service.ts` + `rgpd-service.ts`.
2. **`Enrollment` (Qualiopi session) ≠ `ElearningEnrollment` (e-learning)** : la fiche apprenant agrège les deux mais ce sont deux tables ; ne pas confondre dans les requêtes.
3. **Typage FK** : `traineeId`/`clientId`/`certificatDocumentId` en `@db.Uuid` (référencent l'existant) ; `courseId` text (modèle LMS). Respecter en lecture/écriture.
4. **Jamais sérialiser** `passwordHash`, token portail brut, `handicapDetailsChiffre`. `select` projeté partout.
5. **RGPD = anonymisation + `deletedAt`**, jamais DELETE physique ; conserver les preuves FOAD (enrollments/progress/attempts/certificats).
6. **Renvoi d'accès** crée un nouveau token (ancien reste valide) ; proposer révocation explicite.
7. **Verrou affiché AVEC sa raison** dans l'onglet progression (drip/gating) — best practice 2026.
8. **Stub-aware + `force-dynamic`** sur toutes les pages ; services répliquent le garde `stub.invalid`.
9. **Audit systématique** via `logQualiopiActivity` (actions `elearning.learner.*`).
10. **Segments anti-décrochage** (jamais connecté / inactif > 14 j) = matière première des relances Qualiopi Ind.12 (worker `elearning-reminder-worker.ts`, V1).

---

## Liens

- [`03-DATA-MODEL/01-schema-cours-modules-lecons.md`](../03-DATA-MODEL/01-schema-cours-modules-lecons.md) — `ElearningCourse/Module/Lesson` (cours octroyés).
- [`03-DATA-MODEL/02-schema-progression-tracking.md`](../03-DATA-MODEL/02-schema-progression-tracking.md) — `ElearningEnrollment`, `CourseProgress`, `LessonProgress`, `ElearningXapiStatement` (cœur de la fiche).
- `03-DATA-MODEL/03-schema-quiz-evaluations.md` — `Quiz`, `QuizAttempt`, `QuizAnswer` (onglet quiz).
- [`03-DATA-MODEL/04-schema-comptes-acces-auth.md`](../03-DATA-MODEL/04-schema-comptes-acces-auth.md) — extensions `Trainee` (`learnerStatut`, anti-bruteforce), `PortailAcces`, multi-tenant.
- [`04-BACKEND/02-server-actions.md`](../04-BACKEND/02-server-actions.md) §6/§7/§9 — spec normative `access.actions.ts`, progress, certificate.
- `04-BACKEND/05-authentification-apprenant.md` — magic-link étendu, mot de passe optionnel, `creerAcces`/`verifierToken`.
- `04-BACKEND/06-import-masse-provisioning.md` — import CSV, worker bulk-provision (actions de masse §4.4).
- `04-BACKEND/10-emails-notifications.md` — template `elearning-acces-ouvert.tsx`, relances.
- [`06-CONSOLE-ADMIN/05-gestion-acces-entreprises.md`](./05-gestion-acces-entreprises.md) — octroi en masse, vue par `Client`, packs entreprise.
- [`06-CONSOLE-ADMIN/07-gestion-certificats.md`](./07-gestion-certificats.md) — émission/révocation certificats (onglet §5.6).
- `06-CONSOLE-ADMIN/08-reporting-analytics.md` — agrégats completion/temps/scores (alimente les StatCards).
- `08-CONFORMITE/05-rgpd-conservation-preuves.md` + `06-tracabilite-preuves-realisation.md` — durées de conservation, faisceau de preuves (§7).
- [`00-INDEX/DECISIONS-ARBITRAGES.md`](../00-INDEX/DECISIONS-ARBITRAGES.md) — ADR-0001 (auth), 0002 (multi-tenant V2), 0007 (cloisonnement), 0008 (migrations).

**Code EXISTANT réutilisé (ancrage repo) :** `src/server/qualiopi/portail/portail-service.ts` (`creerAcces`/`revoquerAcces`/`getEspaceStagiaire`) · `src/server/qualiopi/portail/rgpd-service.ts` (`exporterDonneesStagiaire`/`supprimerStagiaire`/`creerDemandeRgpd`) · `src/server/actions/qualiopi/portail.ts:233/270` (`genererPortailAccesAction`/`revoquerPortailAccesAction`) · `src/server/actions/qualiopi/trainees.ts:52/106` (`createTraineeAction`/`updateTraineeAction`) · `src/server/actions/qualiopi/_guards.ts:51` (`logQualiopiActivity`) · `src/server/actions/knowledge/_guards.ts` (RBAC) · `src/components/admin/ui/*` (`AdminTable`/`AdminPageShell`/`AdminTabs`/`AdminStatCard`/`AdminConfirmDialog`/`AdminBulkActions`) · `src/lib/admin-nav.ts` · `src/lib/r2-storage.ts` (`getSignedUrlR2`) · `src/server/qualiopi/documents/qr.ts` + `DocumentGenere` (`prisma/schema.prisma:5507`) · `prisma/schema.prisma:5274` (`Trainee`), `:6236` (`PortailAcces`), `:6277` (`RgpdDemande`).
