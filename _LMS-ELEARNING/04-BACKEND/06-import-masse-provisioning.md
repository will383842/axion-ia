# Backend — Provisioning en masse : import CSV → octroi d'accès e-learning

> Comment Axion-IA ouvre des accès e-learning **à une liste entière** (équipe d'entreprise, promotion, cohorte) en **un seul import CSV** : création / rattachement des apprenants, octroi de l'`ElearningEnrollment`, envoi de l'accès, **gestion des doublons**, **validation stricte**, **dry-run**, **rapport** et **conformité RGPD / consentement**.
>
> Statut : **NEUF** (n'existe pas aujourd'hui). MVP de la roadmap, lot 3 (`11-ROADMAP/01-phasage-mvp-v1-v2.md` → « Octroi d'accès … import CSV d'une liste entreprise »). Cible du multi-tenant V2 (ADR-0002) : tant que l'entreprise ne gère pas elle-même ses équipes, **c'est Axion-IA qui provisionne en masse**.
>
> Périmètre exact de ce doc : la **chaîne d'import** (fichier → apprenants → accès → email). Le modèle de progression (`ElearningEnrollment`, `LessonProgress`) est défini dans `03-DATA-MODEL/02-schema-progression-tracking.md` ; la commande/facturation (`ElearningOrder`, `ElearningSeat`) dans `01-VISION-PERIMETRE/modele-economique-tarification.md` ; l'auth apprenant dans `04-BACKEND/05-authentification-apprenant.md`. Ce doc **consomme** ces briques, il ne les redéfinit pas.

---

## 1. Pourquoi (cas d'usage réels)

1. **« On a vendu 40 sièges à une PME. »** Le service RH envoie un fichier Excel des 40 collaborateurs. On veut tout ouvrir d'un coup, sans recopier 40 fois le formulaire admin.
2. **« Une session présentielle est terminée, on offre l'e-learning de consolidation aux 12 participants. »** (Mode A « offert », octroi par l'employeur Axion-IA.)
3. **« Promotion de particuliers payée par virement groupé. »**
4. **Re-provisioning / correction** : ré-importer un fichier corrigé sans créer de doublons ni renvoyer 40 emails à ceux déjà servis.

Contrainte produit : **idempotent** (ré-importer le même fichier ne casse rien), **traçable** (qui a importé quoi, quand, avec quel résultat), **sûr** (un fichier sale ne doit jamais créer 200 apprenants à moitié corrects), **conforme** (consentement + base légale documentés).

---

## 2. Vue d'ensemble du flux

```
Admin (RBAC requireAdminWrite)
  │
  │  ÉTAPE 1 — Upload + mapping
  ▼
[Fichier CSV/XLSX]  ──► parse + détection délimiteur/encodage ──► lignes brutes
  │
  │  ÉTAPE 2 — DRY-RUN (aucune écriture métier)
  ▼
Validation Zod par ligne + dédup intra-fichier + résolution doublons DB
  │   classe chaque ligne : CREATE_TRAINEE | LINK_EXISTING | ALREADY_ENROLLED
  │                          | INVALID | SKIPPED
  ▼
[Rapport de prévisualisation]  ◄── l'admin lit, corrige, recommence si besoin
  │
  │  ÉTAPE 3 — COMMIT (transaction par ligne, idempotent)
  ▼
upsert Trainee  ──►  ElearningEnrollment (octroi)  ──►  consomme ElearningSeat (Mode C)
                                                    └──►  enqueue email d'accès (magic-link)
  │
  ▼
[ElearningImportBatch + ElearningImportRow]  = rapport persistant + export CSV
```

- **Petits fichiers (≤ `IMPORT_SYNC_MAX_ROWS`, défaut 50)** : commit **synchrone** dans la server action (UX immédiate).
- **Gros fichiers (> 50 lignes)** : commit **asynchrone** via worker BullMQ `elearning-import-worker.ts` (pas de timeout de requête, progress incrémental), comme le pattern 🟢 `image-bank-import-worker.ts`.

---

## 3. EXISTANT réutilisé (anti-duplication)

| Brique                                              | Chemin réel                                                                                       | Rôle dans l'import                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🟢 `Trainee`                                        | `prisma/schema.prisma` (~5274, table `trainees`)                                                  | Identité apprenant. `email` **unique citext** = clé de dédup naturelle. Champs consentement (`consentementFormation`, `consentementEmail`, `consentementVersion`, `consentementAt`), PII handicap chiffrée (`situationHandicap`, `handicapDetailsChiffre`), `deletedAt` (soft delete RGPD). **PAS de `passwordHash`** (auth apprenant = magic-link par défaut, ADR-0001). |
| 🟢 `Client` (CRM)                                   | `schema.prisma` (~4890)                                                                           | Employeur / payeur (SIRET, OPCO). Rattaché via `ElearningOrder.clientId` (Mode C). **Pas** multi-tenant (ADR-0002).                                                                                                                                                                                                                                                       |
| 🟢 `PortailAcces` + `creerAcces()`                  | `src/server/qualiopi/portail/portail-service.ts`                                                  | Génère le **token magic-link 64 hex / 90 j** (`randomBytes(32)`, `timingSafeEqual`). Réutilisé **tel quel** pour le lien d'accès envoyé à chaque apprenant importé.                                                                                                                                                                                                       |
| 🟢 `enqueueEmail()` + `EmailJobData`/`EmailJobName` | `src/server/queue/queues.ts:605`, `src/server/queue/types.ts:12`                                  | Envoi transactionnel via Nodemailer + BullMQ. On **ajoute un template** (union additive, §10).                                                                                                                                                                                                                                                                            |
| 🟢 `encryptPii()` / `decryptPii()`                  | `src/lib/pii-crypto.ts`                                                                           | Chiffrement AES-256-GCM des détails handicap si fournis dans le CSV. **Jamais en clair en DB.**                                                                                                                                                                                                                                                                           |
| 🟢 `uploadToR2` / `getSignedUrlR2`                  | `src/lib/r2-storage.ts`                                                                           | Archive du **fichier source** importé (preuve + rejeu) + du **rapport CSV** généré. Mode dégradé no-op si R2 non configuré.                                                                                                                                                                                                                                               |
| 🟢 Pattern worker import                            | `src/server/queue/workers/image-bank-import-worker.ts` + registre `queues.ts`                     | Modèle exact pour `elearning-import-worker.ts` (tmp file, `batchId`, increment compteurs, Sentry `captureWorkerError`, stub-aware).                                                                                                                                                                                                                                       |
| 🟢 RBAC                                             | `requireAdminWrite` (`src/server/actions/qualiopi/_guards.ts` ; cf. aussi `knowledge/_guards.ts`) | Garde des server actions admin + `logQualiopiActivity` pour l'audit. Rôles `super_admin`/`admin`/`editor`.                                                                                                                                                                                                                                                                |
| 🟢 `admin-nav.ts`                                   | `src/lib/admin-nav.ts`                                                                            | SSOT navigation. On **ajoute un groupe** `elearning` (§9). Sidebar montée = `AdminSidebarNav.tsx`.                                                                                                                                                                                                                                                                        |
| 🟢 Stub `stub.invalid`                              | `src/lib/prisma.ts`, AGENTS.md (ADR 0026)                                                         | Toute la chaîne est derrière auth + force-dynamic → jamais exécutée au build SSG. Services **stub-aware** (early-return).                                                                                                                                                                                                                                                 |

### NEUF à construire

| Élément                                                   | Chemin cible                                                                                                                 |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Service de provisioning (parse, valider, classer, commit) | `src/server/elearning/provisioning/import-service.ts`                                                                        |
| Parsing CSV/XLSX + détection délimiteur/encodage          | `src/server/elearning/provisioning/csv-parser.ts`                                                                            |
| Schéma de ligne + Zod + normalisation                     | `src/server/elearning/provisioning/row-schema.ts`                                                                            |
| Server actions admin                                      | `src/server/actions/elearning/provisioning.ts`                                                                               |
| Worker async (gros fichiers)                              | `src/server/queue/workers/elearning-import-worker.ts`                                                                        |
| Queue + enqueue helper                                    | `src/server/queue/queues.ts` (ajout `elearningImportQueue` + `enqueueElearningImport`)                                       |
| Modèles rapport                                           | `ElearningImportBatch`, `ElearningImportRow` (§7, migration additive)                                                        |
| Template email d'accès                                    | `src/lib/email/templates/elearning-acces-octroye.tsx` + `EmailJobName`                                                       |
| UI wizard admin                                           | `src/app/[locale]/(admin)/[adminPrefix]/elearning/acces/import/page.tsx` + `src/components/admin/elearning/ImportWizard.tsx` |
| Modèle de fichier CSV téléchargeable                      | `public/modeles/elearning-import-modele.csv` + route de génération dynamique                                                 |

---

## 4. Format du fichier d'import

### 4.1 Colonnes

Encodage **UTF-8** (BOM toléré et retiré). Délimiteur **auto-détecté** (`,` ou `;` — Excel FR exporte en `;`). Première ligne = **en-têtes** (insensibles à la casse/accents, normalisées via slug). Formats acceptés : `.csv`, `.xlsx` (1ʳᵉ feuille).

| En-tête CSV          | Obligatoire  | Type / valeurs                     | Mappe vers                                 | Notes                                                                                                                                               |
| -------------------- | ------------ | ---------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `email`              | **Oui**      | email RFC 5322, lowerc\*           | `Trainee.email`                            | **Clé de dédup**. Normalisé (trim + lowercase ; citext gère déjà l'insensibilité).                                                                  |
| `prenom`             | Oui          | texte ≤ 200                        | `Trainee.prenom`                           |                                                                                                                                                     |
| `nom`                | Oui          | texte ≤ 200                        | `Trainee.nom`                              |                                                                                                                                                     |
| `telephone`          | Non          | texte ≤ 40                         | `Trainee.telephone`                        | Normalisé E.164 best-effort, sinon stocké tel quel.                                                                                                 |
| `entreprise`         | Non          | texte ≤ 250                        | `Trainee.entreprise`                       | Pré-rempli par le nom du `Client` si import lié à une commande.                                                                                     |
| `fonction`           | Non          | texte ≤ 200                        | `Trainee.fonction`                         |                                                                                                                                                     |
| `cours`              | Non\*        | slug de `ElearningCourse`          | cours à octroyer                           | Optionnel **si** un `courseId` global est choisi dans le wizard (s'applique à toutes les lignes). Une valeur par ligne permet des cours différents. |
| `consentement`       | Conditionnel | `oui`/`non`/`1`/`0`/`true`/`false` | `Trainee.consentementFormation`            | **Voir §8** : requis pour la vente directe à un particulier ; en provisioning employeur (base = contrat), peut être collecté à la 1ʳᵉ connexion.    |
| `consentement_email` | Non          | idem                               | `Trainee.consentementEmail`                | Marketing distinct du transactionnel. Défaut `non`.                                                                                                 |
| `situation_handicap` | Non          | `oui`/`non`                        | `Trainee.situationHandicap`                | Donnée sensible → **§8.3**. Par défaut on n'importe **pas** ce champ sauf opt-in explicite du wizard.                                               |
| `handicap_details`   | Non          | texte                              | `Trainee.handicapDetailsChiffre` (chiffré) | Ignoré sauf opt-in ; chiffré via `encryptPii`. Fortement déconseillé en CSV (préférer la collecte par l'apprenant).                                 |
| `langue`             | Non          | `fr`                               | `Trainee` (futur) / locale email           | FR canonique (EN désactivé).                                                                                                                        |
| `cohorte`            | Non          | texte ≤ 60                         | `ElearningEnrollment.cohorteTag`           | Étiquette de regroupement (suivi par promo).                                                                                                        |
| `acces_expire_le`    | Non          | date ISO `AAAA-MM-JJ`              | `ElearningEnrollment.accessExpiresAt`      | Sinon hérité de la commande/abonnement.                                                                                                             |

\* `email` toujours requis ; `cours` requis **au niveau ligne OU au niveau wizard** (au moins une source).

### 4.2 Exemple de fichier (`elearning-import-modele.csv`)

```csv
email;prenom;nom;telephone;entreprise;fonction;cours;consentement;cohorte
marie.durand@exemple.fr;Marie;Durand;+33611223344;Exemple SAS;Responsable RH;maitriser-ia-quotidien;oui;promo-2026-09
karim.benali@exemple.fr;Karim;Benali;;Exemple SAS;Chef de projet;maitriser-ia-quotidien;oui;promo-2026-09
lea.martin@exemple.fr;Léa;Martin;0612345678;Exemple SAS;Analyste;maitriser-ia-quotidien;oui;promo-2026-09
```

Le modèle est servi par une route dynamique (`/[locale]/api/elearning/import/modele.csv`, force-dynamic, derrière auth admin) **et** déposé en statique `public/modeles/`. Le wizard affiche aussi un **dictionnaire de colonnes** inline.

### 4.3 Limites & garde-fous fichier

- Taille max upload : **5 Mo** (≈ plusieurs milliers de lignes) ; au-delà refus avec message clair.
- Lignes max par batch : `IMPORT_MAX_ROWS` (défaut **5000**). Au-delà : refus + invitation à scinder.
- Lignes vides ignorées ; colonnes inconnues ignorées (avec un warning listant les en-têtes non reconnus).
- BOM, CRLF/LF, guillemets RFC 4180 gérés par le parser (`csv-parse` côté serveur, jamais côté client).

---

## 5. Validation (étape 2 — dry-run)

### 5.1 Schéma de ligne (`row-schema.ts`)

```ts
// src/server/elearning/provisioning/row-schema.ts  (NEUF)
import { z } from "zod";

export const importRowSchema = z.object({
  email: z.string().trim().toLowerCase().email("email invalide").max(254),
  prenom: z.string().trim().min(1, "prénom requis").max(200),
  nom: z.string().trim().min(1, "nom requis").max(200),
  telephone: z.string().trim().max(40).optional(),
  entreprise: z.string().trim().max(250).optional(),
  fonction: z.string().trim().max(200).optional(),
  coursSlug: z.string().trim().max(120).optional(), // résolu en courseId
  consentement: z.boolean().optional(), // parsé depuis oui/non/1/0
  consentementEmail: z.boolean().optional(),
  situationHandicap: z.boolean().optional(),
  handicapDetails: z.string().trim().max(2000).optional(),
  cohorte: z.string().trim().max(60).optional(),
  accesExpireLe: z.coerce.date().optional(),
});
export type ImportRow = z.infer<typeof importRowSchema>;
```

Parsing des booléens FR : helper `parseBoolFr("oui"|"non"|"1"|"0"|"true"|"false"|"x"|"")`.

### 5.2 Règles de validation

1. **Format** : Zod par ligne. Une ligne invalide → `outcome = INVALID` + liste des erreurs de champ (jamais de throw global : on collecte tout pour un rapport exhaustif).
2. **Email unique intra-fichier** : si le même email apparaît N fois → on **garde la 1ʳᵉ occurrence valide**, les suivantes → `outcome = SKIPPED` (`raison = "doublon dans le fichier"`).
3. **Résolution du cours** : `coursSlug` (ligne) **ou** `courseId` (wizard) doit résoudre vers un `ElearningCourse` existant et `statut = publie` (refus si `brouillon`/`archive`, sauf override admin explicite « autoriser cours non publié »). Sinon `INVALID`.
4. **Cohérence sièges (Mode C)** : si l'import est rattaché à un `ElearningOrder` (pack entreprise), le nombre de lignes valides **à octroyer** ≤ sièges disponibles (`order.seats` − enrollments déjà octroyés). Dépassement → les lignes excédentaires passent en `INVALID` (`raison = "plus de sièges disponibles"`) **sans** rien créer (jamais d'octroi partiel silencieux).
5. **Consentement** : selon la base légale choisie au niveau du batch (§8.2). Si base = `consentement` et `consentement != true` → `INVALID`.
6. **Handicap** : ignoré sauf opt-in du wizard (`importerSituationHandicap`). Voir §8.3.

### 5.3 Classification des doublons (résolution DB)

Pour chaque ligne valide, lookup `Trainee` par `email` (citext, en incluant `deletedAt`) :

| Cas DB                                                                           | `outcome` (dry-run) | Action au commit                                                                                                                                               |
| -------------------------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aucun `Trainee`                                                                  | `CREATE_TRAINEE`    | crée `Trainee` (consentements + PII selon §8) puis octroie.                                                                                                    |
| `Trainee` actif existe, **pas** d'`ElearningEnrollment` sur ce cours             | `LINK_EXISTING`     | **ne recrée pas** le Trainee ; **met à jour les champs vides uniquement** (politique « ne jamais écraser des données existantes par un CSV », §6.4) ; octroie. |
| `Trainee` existe **et** `ElearningEnrollment` (courseId, traineeId) déjà présent | `ALREADY_ENROLLED`  | **no-op** (idempotence) ; **pas** de second email sauf option « renvoyer le lien d'accès ».                                                                    |
| `Trainee.deletedAt != null` (soft-deleted RGPD)                                  | `INVALID`           | **refus** : ne pas « ressusciter » un compte effacé via un CSV (§8.4). Message : « apprenant supprimé (RGPD) — réinscription explicite requise ».              |

`ElearningEnrollment` portera une **contrainte d'unicité** `@@unique([courseId, traineeId])` (cf. doc 02) qui rend le commit **idempotent au niveau base** même en cas de course condition / double-clic.

### 5.4 Sortie du dry-run

Objet `ImportPreview` retourné à l'UI (rien n'est écrit en base métier) :

```ts
interface ImportPreview {
  batchDraftId: string; // id du batch en statut "preview" (persisté, §7)
  totalRows: number;
  counts: {
    createTrainee: number;
    linkExisting: number;
    alreadyEnrolled: number;
    invalid: number;
    skipped: number;
  };
  willConsumeSeats: number; // Mode C
  seatsAvailable: number | null;
  sample: ImportRowResult[]; // 20 premières lignes pour aperçu
  errors: { line: number; email: string | null; messages: string[] }[];
  warnings: string[]; // en-têtes inconnus, encodage corrigé, etc.
}
```

Le dry-run **persiste** un `ElearningImportBatch` en `statut = preview` + ses `ElearningImportRow` (avec `outcome` calculé), pour que le commit rejoue **exactement** la même classification (pas de re-parse divergent) et pour l'auditabilité.

---

## 6. Commit (étape 3 — écriture)

### 6.1 Algorithme par ligne (idempotent, transactionnel)

```ts
// pseudo — src/server/elearning/provisioning/import-service.ts
for (const row of rows.where(outcome ∈ {CREATE_TRAINEE, LINK_EXISTING})) {
  await prisma.$transaction(async (tx) => {
    // 1. upsert Trainee par email (citext) — ne JAMAIS écraser un champ déjà rempli
    const trainee = await tx.trainee.upsert({
      where: { email: row.email },
      create: buildTraineeCreate(row, consentPolicy),   // §8
      update: buildTraineeFillBlanks(row),              // §6.4
    });

    // 2. octroi idempotent (unique [courseId, traineeId])
    const enrollment = await tx.elearningEnrollment.upsert({
      where: { courseId_traineeId: { courseId, traineeId: trainee.id } },
      create: {
        courseId, traineeId: trainee.id,
        orderId, source: "import_csv", cohorteTag: row.cohorte ?? null,
        accessExpiresAt: row.accesExpireLe ?? orderAccessExpiresAt ?? null,
        grantedByAdminId: adminUserId, grantedAt: new Date(),
        statut: "actif",
      },
      update: {},   // déjà présent → no-op (ALREADY_ENROLLED)
    });

    // 3. Mode C : consommer un siège du pool si dispo
    if (orderId) await consumeSeat(tx, orderId, trainee.id);

    // 4. row result
    await tx.elearningImportRow.update({ where: { id: row.id }, data: { outcome, traineeId: trainee.id, enrollmentId: enrollment.id } });
  });

  // 5. HORS transaction : créer le magic-link + enqueue email (effet de bord réseau)
  await sendAccessEmail(trainee, course, batchId);
}
```

Règles :

- **Transaction par ligne** (pas une transaction géante) : une ligne qui échoue n'annule pas les 199 autres ; elle passe en `outcome = FAILED` avec le message d'erreur. Robustesse > atomicité globale (un import est une opération de masse tolérante).
- **Effets réseau hors transaction** : la création `PortailAcces` (token) et l'`enqueueEmail` se font **après** commit DB, pour ne pas garder une transaction ouverte pendant un appel réseau, et pour ne pas envoyer d'email si la transaction a rollback.
- **Idempotence email** : on n'envoie l'email que si l'enrollment vient d'être **créé** (pas sur `ALREADY_ENROLLED`), sauf option explicite « renvoyer le lien ». Anti double-envoi : `ElearningImportRow.emailSentAt` + dédoublonnage par `jobId` BullMQ (`elearning-acces-${enrollmentId}`).

### 6.2 Octroi de l'accès (magic-link)

```ts
async function sendAccessEmail(trainee, course, batchId) {
  // 🟢 réutilise creerAcces (PortailAcces : token 64 hex, 90 j)
  const { token } = await creerAcces(trainee.id, 90);
  const url = `${SITE_URL}/portail/mon-espace?token=${token}`; // pose le cookie HttpOnly puis redirige vers l'espace e-learning
  await enqueueEmail(
    "elearning-acces-octroye", // 🔵 nouveau template (§10)
    trainee.email,
    "fr",
    { prenom: trainee.prenom, coursTitre: course.titre, url },
    { jobId: `elearning-acces-${trainee.id}-${course.id}` }, // anti double-envoi
  );
}
```

> **Auth** : le MVP ouvre l'accès par **magic-link** (zéro friction, ADR-0001). Le **mot de passe optionnel** (comptes entreprise) est posé par l'apprenant lui-même depuis son espace ; l'import **ne** crée **jamais** de mot de passe (pas de `passwordHash` envoyé en CSV — interdit). Détail dans `04-BACKEND/05-authentification-apprenant.md`.

### 6.3 Sync vs async

- **Sync** (≤ `IMPORT_SYNC_MAX_ROWS=50`) : `commitImportElearningAction` exécute la boucle et renvoie le `ImportResult` final.
- **Async** (> 50) : l'action enqueue `enqueueElearningImport({ batchId })` → `elearning-import-worker.ts` exécute la boucle, incrémente `ElearningImportBatch.{processedCount,successCount,failedCount}` au fil de l'eau (UI polle/SSE), passe le batch `en_cours → termine`. Pattern strictement calqué sur 🟢 `image-bank-import-worker.ts` (lecture tmp file, increment compteurs, `captureWorkerError`, `await fs.unlink(tmp)`).

### 6.4 Politique « ne jamais écraser » (anti-corruption)

Sur un `Trainee` existant (`LINK_EXISTING`), `buildTraineeFillBlanks` **ne remplit que les champs actuellement vides** (`telephone`, `entreprise`, `fonction` null) et **ne touche jamais** : `email`, `nom`, `prenom` déjà renseignés, ni les consentements déjà donnés, ni les données handicap. Un CSV ne doit pas dégrader une fiche déjà qualifiée. Toute « mise à jour de masse » des fiches est un autre chantier (hors import-provisioning).

---

## 7. Modèle de données du rapport (NEUF — additif, ADR-0008)

Migration **additive** (`CREATE TABLE`, aucun DROP). Code sous `src/server/elearning/**`.

```prisma
enum ElearningImportStatut {
  preview        // dry-run calculé, rien d'octroyé
  en_cours       // commit en cours (worker)
  termine        // commit terminé
  annule         // batch abandonné avant commit
  echec          // erreur fatale (fichier illisible)
}

enum ElearningImportRowOutcome {
  CREATE_TRAINEE
  LINK_EXISTING
  ALREADY_ENROLLED
  INVALID
  SKIPPED            // doublon intra-fichier
  FAILED             // erreur au commit (ligne)
  DONE               // octroyé + email enqueué
}

/// Lot d'import e-learning (provisioning de masse). Preuve + rejeu + audit.
model ElearningImportBatch {
  id              String   @id @default(uuid()) @db.Uuid
  statut          ElearningImportStatut @default(preview)

  // Source
  fileName        String   @map("file_name") @db.VarChar(260)
  fileR2Key       String?  @map("file_r2_key")                 // 🟢 archive R2 du CSV source
  reportR2Key     String?  @map("report_r2_key")              // 🟢 rapport CSV généré
  rowsTotal       Int      @default(0) @map("rows_total")

  // Cible
  courseId        String?  @map("course_id") @db.Uuid          // cours global (si pas par ligne)
  course          ElearningCourse? @relation(fields: [courseId], references: [id], onDelete: SetNull)
  orderId         String?  @map("order_id") @db.Uuid           // ElearningOrder (Mode C pack)
  order           ElearningOrder?  @relation(fields: [orderId], references: [id], onDelete: SetNull)
  clientId        String?  @map("client_id") @db.Uuid          // 🟢 Client CRM (employeur)
  client          Client?  @relation(fields: [clientId], references: [id], onDelete: SetNull)

  // Conformité (§8)
  baseLegale      String   @map("base_legale") @db.VarChar(30)  // consentement | contrat | interet_legitime
  consentementVersion String? @map("consentement_version") @db.VarChar(20)
  importerHandicap Boolean @default(false) @map("importer_handicap")
  renvoyerLien    Boolean  @default(false) @map("renvoyer_lien")

  // Compteurs (mis à jour par le worker)
  processedCount  Int      @default(0) @map("processed_count")
  successCount    Int      @default(0) @map("success_count")
  failedCount     Int      @default(0) @map("failed_count")
  invalidCount    Int      @default(0) @map("invalid_count")
  skippedCount    Int      @default(0) @map("skipped_count")

  // Audit
  createdByAdminId String  @map("created_by_admin_id") @db.Uuid
  committedAt     DateTime? @map("committed_at")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  rows            ElearningImportRow[]

  @@index([statut])
  @@index([clientId])
  @@index([orderId])
  @@index([createdByAdminId])
  @@map("elearning_import_batches")
}

/// Une ligne du fichier importé + son résultat (rapport ligne à ligne).
model ElearningImportRow {
  id            String   @id @default(uuid()) @db.Uuid
  batchId       String   @map("batch_id") @db.Uuid
  batch         ElearningImportBatch @relation(fields: [batchId], references: [id], onDelete: Cascade)

  lineNumber    Int      @map("line_number")                  // n° ligne fichier (1-based, hors entête)
  email         String?  @db.Citext                            // normalisé (peut être null si ligne illisible)
  rawJson       Json     @map("raw_json")                      // ligne brute (debug/rejeu)
  outcome       ElearningImportRowOutcome
  errorMessages Json     @default("[]") @map("error_messages") // string[]

  // Résolus au commit
  traineeId     String?  @map("trainee_id") @db.Uuid
  enrollmentId  String?  @map("enrollment_id") @db.Uuid
  emailSentAt   DateTime? @map("email_sent_at")

  createdAt     DateTime @default(now()) @map("created_at")

  @@index([batchId])
  @@index([outcome])
  @@map("elearning_import_rows")
}
```

> **Champs inverses additifs** à ajouter (sans colonne, FK portée ici) : `ElearningCourse.importBatches`, `ElearningOrder.importBatches`, `Client.elearningImportBatches`.
>
> **Rétention** : le `rawJson` peut contenir de la PII (noms, emails, éventuellement handicap). Il est **purgé / anonymisé** par un cron de rétention (réutiliser `retention-purge`) après le délai de preuve (§8.5). Le `reportR2Key` (rapport agrégé) suit la même politique.

---

## 8. RGPD & consentement (non négociable)

### 8.1 Données concernées

Emails, nom/prénom, téléphone, employeur, fonction = **données personnelles** ; `situation_handicap`/`handicap_details` = **données sensibles** (art. 9 RGPD). L'import en masse est un **traitement** : il faut une **base légale**, de la **minimisation**, de la **traçabilité** et le respect des **droits**.

### 8.2 Base légale — choisie au niveau du batch (`baseLegale`)

Le wizard **oblige** l'admin à déclarer la base légale, qui pilote la validation du consentement :

- **`contrat`** (cas employeur le plus courant) : l'entreprise inscrit ses salariés dans le cadre de la formation professionnelle (exécution du contrat de formation B2B). Le **consentement individuel n'est pas la base** ; on **n'exige pas** la colonne `consentement` (mais on **informe** l'apprenant — voir 8.6). On enregistre `Trainee.consentementFormation = false` tant que non recueilli, et on collecte le consentement **email marketing** séparément (opt-in, jamais présumé).
- **`consentement`** (vente directe à des particuliers) : la colonne `consentement = oui` est **obligatoire** par ligne ; sinon `INVALID`. On enregistre `consentementFormation = true`, `consentementVersion = <version active>`, `consentementAt = now()`.
- **`interet_legitime`** (rare, ex. réinscription de participants d'une session déjà réalisée) : documenté dans `baseLegale`, balance d'intérêts à justifier hors code.

Dans **tous** les cas, le **consentement email marketing** (`consentementEmail`) reste un **opt-in explicite** distinct (les emails d'accès/relances pédagogiques sont **transactionnels**, pas marketing — ils partent même sans opt-in marketing).

### 8.3 Données sensibles (handicap) — minimisation forte

Par défaut, l'import **ignore** `situation_handicap`/`handicap_details` (case **décochée**). L'admin doit cocher explicitement « importer la situation de handicap » (`importerHandicap=true`) **et** confirmer une base légale adaptée. Si importé : `handicap_details` est **chiffré via `encryptPii`** (jamais en clair), `situationHandicap=true`. **Recommandation produit forte** : ne **pas** collecter le handicap par CSV ; laisser l'apprenant le déclarer lui-même dans son espace (action 🟢 `declarerHandicapAction` existante) → meilleure conformité + exactitude.

### 8.4 Soft-delete / droit à l'effacement

Un `Trainee` avec `deletedAt != null` **ne peut pas** être réinscrit par import (ligne → `INVALID`). Effacer signifie effacer ; un CSV ne ressuscite pas un compte. La réinscription d'une personne ayant exercé son droit à l'effacement est une **action manuelle explicite** tracée. L'import respecte aussi les `RgpdDemande` en cours.

### 8.5 Conservation

- **Fichier source CSV (R2)** + `rawJson` : conservés le temps de l'audit d'import puis **purgés** (cron rétention). Cible : ≤ 1 an (logs/traces), aligné CNIL.
- **Preuves de réalisation FOAD** (issues du tracking, pas de l'import) : 3–5 ans (`L.6362-6`).
- **Comptable/OPCO** (factures, liées à `ElearningOrder`) : 6–10 ans (hors périmètre import).
- Politique détaillée : `08-CONFORMITE/05-rgpd-conservation-preuves.md`.

### 8.6 Information des personnes (transparence)

L'email d'accès (`elearning-acces-octroye`) **informe** chaque apprenant : qui est responsable de traitement (Axion-IA), pourquoi il reçoit cet accès (inscrit par son employeur le cas échéant), comment exercer ses droits (lien vers la procédure RGPD existante du portail : `demanderExportRgpdAction` / `demanderSuppressionRgpdAction`). Cela couvre l'obligation d'information art. 13/14 quand les données viennent de l'employeur.

### 8.7 Audit & sécurité

- Chaque batch : `createdByAdminId`, horodatages, `baseLegale`, `consentementVersion` → traçabilité complète.
- `logQualiopiActivity` (ou équivalent audit admin) appelé sur preview/commit/annulation.
- Le fichier transite **uniquement** côté serveur (parsing serveur), stocké chiffré au repos (R2). Jamais de PII loggée en clair (Sentry : scrub).
- Accès réservé `requireAdminWrite` (rôles `super_admin`/`admin`/`editor`). La suppression d'un batch (et de son `rawJson`) → `requireAdminDelete` (super_admin).

---

## 9. Server actions & navigation admin

### 9.1 Server actions (`src/server/actions/elearning/provisioning.ts`)

```ts
"use server";
// Toutes gardées par requireAdminWrite + audit. exactOptionalPropertyTypes. stub-aware.

// 1) Upload + parse + DRY-RUN. N'écrit que ElearningImportBatch(preview)+rows. Archive le CSV sur R2.
export async function previewImportElearningAction(input: {
  fileBase64: string;
  fileName: string;
  courseId?: string;
  orderId?: string;
  clientId?: string;
  baseLegale: "consentement" | "contrat" | "interet_legitime";
  importerHandicap?: boolean;
}): Promise<ActionResult<ImportPreview>>;

// 2) COMMIT du batch précédemment prévisualisé (sync si ≤50 lignes, sinon enqueue worker).
export async function commitImportElearningAction(input: {
  batchId: string;
  renvoyerLien?: boolean;
}): Promise<ActionResult<{ mode: "sync" | "async"; result?: ImportResult }>>;

// 3) Annuler un batch en preview (purge rows + fichier R2).
export async function annulerImportElearningAction(input: {
  batchId: string;
}): Promise<ActionResult<null>>;

// 4) Statut live (polling/SSE) d'un batch async.
export async function getImportBatchStatusAction(input: {
  batchId: string;
}): Promise<ActionResult<BatchStatus>>;

// 5) Télécharger le rapport CSV (URL signée R2 ou génération à la volée).
export async function getImportReportUrlAction(input: {
  batchId: string;
}): Promise<ActionResult<{ url: string }>>;
```

`ActionResult<T> = { data: T } | { error: string }` (pattern repo). Validation des inputs par Zod ; jamais de throw non géré côté UI.

### 9.2 Worker (`src/server/queue/workers/elearning-import-worker.ts`)

```ts
export type ElearningImportJobData = {
  batchId: string;
  renvoyerLien: boolean;
  adminUserId: string;
};

export function startElearningImportWorker(): Worker<ElearningImportJobData, void, string> {
  return new Worker(
    "elearning-import",
    async (job) => {
      const svc = await import("@/server/elearning/provisioning/import-service");
      await svc.commitBatch(job.data.batchId, {
        renvoyerLien: job.data.renvoyerLien,
        adminUserId: job.data.adminUserId,
        onProgress: (n) => job.updateProgress(n), // + increment compteurs DB
      });
    },
    { connection: getBullConnectionOrThrow() },
  );
}
```

À enregistrer dans `src/server/queue/queues.ts` (queue `elearningImportQueue` + helper `enqueueElearningImport`) et démarré dans `src/server/queue/worker.ts` (boot des workers), gardé par `BULLMQ_DISABLED`/stub comme les autres.

### 9.3 Navigation (`src/lib/admin-nav.ts` — additif)

Ajouter un groupe `"elearning"` à `AdminNavGroup`, avec items :

- `${base}/elearning/cours` — Cours (outil auteur)
- `${base}/elearning/apprenants` — Apprenants
- `${base}/elearning/acces` — Accès & inscriptions
- **`${base}/elearning/acces/import` — Import en masse (CSV)** ← ce doc
- `${base}/elearning/acces/import/[batchId]` — détail d'un lot (rendu via breadcrumbs, `parent` = liste import)

> Sidebar réellement montée = `AdminSidebarNav.tsx` (cf. mémoire projet « 2 composants sidebar »). Déclarer le groupe dans `admin-nav.ts` (SSOT) **et** vérifier son rendu dans `AdminSidebarNav.tsx`.

### 9.4 UI wizard (`ImportWizard.tsx`)

4 étapes (Server Components + minimal client pour drag&drop fichier — attention budget INP/JS) :

1. **Cibler** : choisir cours (ou « par ligne »), rattacher à un `ElearningOrder`/`Client` (optionnel), déclarer `baseLegale`, options (handicap, langue).
2. **Déposer** : upload CSV/XLSX + lien « télécharger le modèle » + dictionnaire de colonnes.
3. **Vérifier (dry-run)** : tableau récap (`counts`), aperçu des 20 1ʳᵉˢ lignes (badges couleur par `outcome`), liste des erreurs ligne par ligne, alerte sièges. Bouton « Corriger et recharger » / « Confirmer l'octroi ».
4. **Octroyer** : barre de progression (sync = immédiat, async = polling/SSE), puis **rapport** téléchargeable (CSV) + bouton « Renvoyer le lien aux non-connectés » (réutilise §6.2 avec `renvoyerLien`).

Accessibilité (WCAG 2.2 AA, cf. `09-QUALITE/04`) : la zone de dépôt offre une **alternative au glisser-déposer** (bouton « Parcourir », critère 2.5.7), cibles ≥ 24px (2.5.8), focus visible, messages d'erreur reliés aux lignes.

---

## 10. Email d'octroi d'accès (NEUF)

- **`EmailJobName`** : ajouter `"elearning-acces-octroye"` à l'union (`src/server/queue/types.ts`) — additif, ne casse rien.
- **Template** : `src/lib/email/templates/elearning-acces-octroye.tsx` (React Email, layout bulletproof + footer identité existant). Transactionnel (`marketing: false`) → part de `noreply@`. Payload Zod : `{ prenom, coursTitre, url }`.
- **Contenu** : salutation, « Vous avez accès à la formation en ligne _{coursTitre}_ », bouton « Accéder à ma formation » → `url` (magic-link `PortailAcces`), mention employeur/base légale (§8.6), liens RGPD + assistance (tuteur/contact — Qualiopi Ind.19), expiration du lien (90 j, renouvelable).
- **Relances** (V1, hors MVP) : « pas encore connecté J+3/J+7 » via le pattern crons existant (`email-worker` + `EmailJobName` dédiés) — anti-décrochage Qualiopi Ind.12.

---

## 11. Cas limites & décisions

| Cas                               | Décision                                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| Même email 2× dans le fichier     | 1ʳᵉ gardée, suivantes `SKIPPED`.                                                         |
| Email déjà inscrit au cours       | `ALREADY_ENROLLED`, no-op, **pas** de 2ᵉ email (sauf `renvoyerLien`).                    |
| Trainee soft-deleted              | `INVALID` (pas de résurrection par CSV).                                                 |
| Plus de sièges que le pack        | lignes excédentaires `INVALID`, **aucun** octroi partiel silencieux.                     |
| Cours en brouillon                | refus sauf override admin explicite.                                                     |
| Fichier Excel `;` + BOM + accents | géré (détection délimiteur + dé-BOM + UTF-8).                                            |
| Ré-import du même fichier         | idempotent (unique `[courseId, traineeId]`) → tout `ALREADY_ENROLLED`.                   |
| Worker tombe en cours             | reprise : compteurs en DB + unicité ⇒ rejeu sûr ; lignes déjà `DONE` non re-traitées.    |
| Build SSG (`stub.invalid`)        | services early-return ; pages derrière auth + force-dynamic ⇒ jamais exécutées au build. |
| R2 non configuré                  | archive fichier/rapport en no-op (mode dégradé), l'import fonctionne quand même.         |

---

## 12. Tests (cf. `09-QUALITE/01-plan-tests.md`)

- **Parser** : `;`/`,`, BOM, CRLF, guillemets, colonnes manquantes/inconnues, XLSX.
- **Validation** : email invalide, doublon intra-fichier, cours inexistant, sièges dépassés, consentement manquant selon `baseLegale`.
- **Classification doublons DB** : create/link/already/soft-deleted (Trainee mock).
- **Idempotence** : double commit ⇒ pas de doublon, pas de 2ᵉ email.
- **RGPD** : handicap non importé par défaut ; chiffrement si opt-in ; soft-deleted refusé.
- **Worker** : progress, reprise, `captureWorkerError`, stub-aware.
- Vitest avec PrismaClient mock (non affecté par le stub Proxy build-time).

---

## Liens

- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-0001 (auth hybride), ADR-0002 (multi-tenant V2), ADR-0004 (Stripe éteint), ADR-0007 (cloisonnement code), ADR-0008 (migrations additives).
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — `ElearningCourse` (cible de l'octroi).
- `03-DATA-MODEL/02-schema-progression-tracking.md` — `ElearningEnrollment` (objet d'octroi), `LessonProgress` (preuves de réalisation).
- `01-VISION-PERIMETRE/modele-economique-tarification.md` — `ElearningOrder`, `ElearningSeat` (Mode C pack entreprise), `genererFactureElearning`.
- `04-BACKEND/05-authentification-apprenant.md` — magic-link `PortailAcces` + mot de passe optionnel.
- `04-BACKEND/03-workers-bullmq-crons.md` — enregistrement de `elearning-import-worker`.
- `04-BACKEND/10-emails-notifications.md` — template `elearning-acces-octroye` + relances anti-décrochage.
- `06-CONSOLE-ADMIN/05-gestion-acces-entreprises.md` — UX wizard, packs entreprise, pool de sièges.
- `08-CONFORMITE/05-rgpd-conservation-preuves.md` — base légale, minimisation, rétention, droits.
- `02-ARCHITECTURE/reutilisation-existant.md` — carte de réutilisation (`Trainee`, `PortailAcces`, R2, email, RBAC).
