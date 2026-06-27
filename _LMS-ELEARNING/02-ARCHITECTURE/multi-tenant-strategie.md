# Architecture multi-tenant — Stratégie LMS e-learning

> **Statut décisionnel :** conçu maintenant (data model + scoping prévus dès le MVP), **livré en V2** (cloisonnement strict + espace entreprise autonome). Cf. [ADR-LMS-0002](../00-INDEX/DECISIONS-ARBITRAGES.md).
>
> **But du document :** donner à une équipe de dev senior une spec implémentable du multi-tenant entreprise : modèle d'isolation, résolution du contexte tenant par requête, **filtrage forcé au niveau Prisma** (anti-fuite cross-tenant), admin entreprise délégué, branding par client, reporting deux niveaux, provisioning (CSV → SSO/SCIM), et la **trajectoire MVP → V2** sans dette bloquante.
>
> Dernière mise à jour : 2026-06-27.

---

## 0. TL;DR

| Sujet               | MVP (V1)                                                                                                       | V2 (multi-tenant livré)                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Modèle d'isolation  | Shared-DB, **pas** de cloisonnement applicatif strict ; `ownerClientId`/`tenantId` posés mais **non enforced** | Shared-DB **+ `tenant_id` enforced** par extension Prisma (deny-by-default)     |
| Qui ouvre les accès | Axion-IA (admin) en 1 clic + import CSV                                                                        | + **admin entreprise délégué** s'auto-gère                                      |
| Contexte requête    | `AdminSession` (NextAuth) OU `LearnerSession` (portail)                                                        | + `TenantContext` résolu par requête, propagé via `AsyncLocalStorage`           |
| Filtrage requêtes   | manuel (`where: { ownerClientId }`) côté admin Axion-IA                                                        | **automatique** via `prisma.$extends` (`tenant-guard`)                          |
| Branding            | logo/charte Axion-IA                                                                                           | branding par `Client` (logo, couleurs, sous-domaine/segment d'URL)              |
| Reporting           | global Axion-IA                                                                                                | **2 niveaux** : Axion-IA (tous tenants) + entreprise (son périmètre uniquement) |
| Provisioning        | CSV masse (worker)                                                                                             | + **SSO OIDC/SAML** + **SCIM 2.0** (auto-provision/déprovision)                 |

**Principe d'or :** le `tenant_id` est posé **dès le MVP** sur toutes les nouvelles tables LMS (nullable au départ), et l'**enforcement** (extension Prisma deny-by-default) est ajouté en V2 **sans migration de schéma** — uniquement du code applicatif derrière le flag `LMS_TENANT_ENFORCEMENT`. Aucune dette de migration, aucun backfill destructif.

---

## 1. Le tenant = `Client` existant (réutilisation, pas de doublon)

### EXISTANT réutilisé

Le modèle racine du tenant est le **`Client` CRM existant** (`prisma/schema.prisma` ~ ligne 4889), **pas** un nouveau modèle `Tenant`/`Organization`. Raison : `Client` porte déjà l'identité entreprise B2B nécessaire (raison sociale, SIRET, NAF→OPCO, IDCC, convention collective, taille, contact, enveloppe OPCO). Créer un `Tenant` parallèle dupliquerait cette identité et fracturerait le CRM.

Champs `Client` déjà présents et directement utiles au multi-tenant :

```
Client.id              (uuid)         → devient le tenant_id de référence
Client.type            (entreprise|particulier)
Client.raisonSociale   (nom affiché du tenant)
Client.siret / nafCode / idcc / opcoIdentifie
Client.contactEmail / contactNom      (point de contact → futur admin délégué)
Client.taille          (CompanySize)
```

Relation inverse **déjà conçue** côté LMS (doc 03-DATA-MODEL/01) :

- `ElearningCourse.ownerClientId` → `Client` (`@relation("ClientCoursesProprietaires")`). `null` = catalogue global Axion-IA ; renseigné = cours réservé/privé à ce tenant.
- À ajouter côté `Client` (additif, relation inverse sans colonne) : `coursesProprietaires ElearningCourse[]`.

> **Décision de nommage.** Dans le code LMS on parle de **« tenant »** comme concept transverse, mais la **clé physique** s'appelle **`clientId` / `client_id`** (cohérent avec `Enrollment.clientId`, `Appreciation.clientId`, `Devis.clientId`). On n'introduit **pas** de colonne `tenant_id` distincte : `tenant_id ≡ client_id`. Cela évite une seconde source de vérité. Les helpers TypeScript exposent quand même un alias sémantique `tenantId` (= `clientId`) pour la lisibilité.

### NEUF : `Client` enrichi pour le rôle de tenant

Migration **additive** (colonnes nullable) sur `Client` — `prisma/migrations/XXXX_lms_tenant_fields/migration.sql` :

```prisma
// model Client { ... ajouts LMS multi-tenant (tous nullable / défaut) ... }

  /// Active le mode « espace e-learning autonome » pour ce client (V2).
  /// false = Axion-IA gère tout pour lui (mode MVP). true = admin délégué + branding.
  lmsTenantActif        Boolean   @default(false) @map("lms_tenant_actif")

  /// Segment d'URL de l'espace tenant : /espace/{slug}. Unique. Null tant que non activé.
  lmsTenantSlug         String?   @unique @map("lms_tenant_slug") @db.Citext

  /// Branding (cf. §6). JSON : { logoR2Key, couleurPrimaire, couleurAccent, nomAffiche, supportEmail }.
  lmsBranding           Json?     @map("lms_branding")

  /// Nombre de sièges e-learning achetés (pack entreprise). Null = illimité interne.
  lmsSiegesAchetes      Int?      @map("lms_sieges_achetes")

  /// Politique d'auth des apprenants de ce tenant : "magic_link" | "password" | "sso".
  lmsAuthMode           String?   @map("lms_auth_mode") @db.VarChar(20)

  /// Config SSO/SCIM (V2). JSON chiffré (pii-crypto) : { provider, issuer, clientId, secretChiffre, scimTokenHashed, ... }.
  lmsSsoConfigChiffre   String?   @map("lms_sso_config_chiffre") @db.Text

  // Relations inverses LMS (additives, FK portée côté tables LMS) :
  coursesProprietaires  ElearningCourse[]     @relation("ClientCoursesProprietaires")
  membres               TenantMembership[]
  adminsDelegues        TenantAdmin[]
  elearningEnrollments  ElearningEnrollment[] @relation("ElearningEnrollmentTenant")
```

---

## 2. Modèle d'isolation : **shared-DB + tenant_id discriminator**

### Choix : shared database, shared schema, colonne discriminante

Trois patterns standards :

1. **Database-per-tenant** : isolation forte, mais ingérable ici (migrations × N bases, build `stub.invalid` impossible à stubber, coût opérationnel sur CPX42).
2. **Schema-per-tenant** (Postgres `search_path`) : meilleure isolation, mais Prisma 5.22 ne gère pas le `search_path` dynamique par requête proprement, et casse le client généré unique.
3. **Shared-DB + colonne `client_id`** (discriminator). ✅ **Retenu.**

**Justification :** aligné sur l'architecture existante (toutes les tables Qualiopi sont déjà shared-DB), compatible avec le build externalisé + stub `stub.invalid`, compatible Prisma client unique, compatible migrations additives (ADR-LMS-0008). L'isolation forte est obtenue **en applicatif** par l'extension Prisma `tenant-guard` (§4), pas par l'infra.

### Règle de portée des données (data residency logique)

Chaque table LMS appartient à l'une de ces 3 catégories :

| Catégorie                              | Tables                                                                                                    | `client_id`                                                 | Visibilité                               |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------- |
| **A. Catalogue partageable**           | `ElearningCourse`, `ElearningModule`, `ElearningLesson`, `ElearningResource`, `Quiz`, `Question` (banque) | **nullable** : `null` = global Axion-IA, sinon privé tenant | un tenant voit le global **+** son privé |
| **B. Données apprenant tenant-scoped** | `ElearningEnrollment`, `LessonProgress`, `QuizAttempt`, certificats e-learning, traces FOAD, logs xAPI    | **NOT NULL en V2** (dérivé de l'apprenant/octroi)           | strictement le tenant propriétaire       |
| **C. Données globales Axion-IA**       | `GrilleQualiteConfig`, `ContentTemplate`, config moteur IA, `SiteSetting`                                 | **pas de `client_id`**                                      | jamais exposées aux tenants              |

> Catégorie A est la subtilité : un cours global (`ownerClientId = null`) est lisible par **tous** les tenants ; un cours privé n'est lisible que par son owner + Axion-IA. L'extension `tenant-guard` traduit ça en `WHERE (owner_client_id IS NULL OR owner_client_id = :ctx)` pour les modèles de catégorie A, et `WHERE client_id = :ctx` pour la catégorie B (cf. §4.3).

### `client_id` sur les données apprenant : d'où vient-il ?

L'apprenant (`Trainee`) **n'est pas** intrinsèquement mono-tenant : un même particulier peut être salarié de l'entreprise X et acheter un cours à titre perso. Le tenant n'est donc **pas** porté par `Trainee` mais par le **lien d'appartenance** et par l'**inscription** :

- `TenantMembership` (NEUF, §3) : lie un `Trainee` à un `Client` (rôle apprenant/manager). Un trainee peut avoir 0..N memberships.
- `ElearningEnrollment.tenantClientId` (NEUF) : fige le tenant **au moment de l'octroi** de l'accès. C'est la source de vérité du `client_id` pour toutes les données dérivées (progress, attempts, certificats). Un octroi « à titre perso » a `tenantClientId = null` (espace personnel, hors tenant entreprise).

> **Pourquoi figer sur l'enrollment et non sur le trainee :** un salarié qui quitte l'entreprise ne doit pas faire disparaître les preuves FOAD déjà produites pour le compte de l'entreprise (conservation 3-10 ans, cf. 08-CONFORMITE/05). Le tenant de l'inscription reste immuable même si le `TenantMembership` est révoqué.

---

## 3. Nouveaux modèles d'appartenance et d'administration déléguée (NEUF)

Fichier de schéma : ces modèles vivent dans `prisma/schema.prisma` (un seul fichier dans ce repo), section LMS. Code d'accès sous `src/server/elearning/tenant/**`.

```prisma
/// Appartenance d'un apprenant à un tenant (entreprise). Un trainee peut être
/// rattaché à plusieurs entreprises ; chaque rattachement a son rôle et son cycle de vie.
model TenantMembership {
  id          String   @id @default(uuid()) @db.Uuid
  clientId    String   @map("client_id") @db.Uuid
  client      Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)
  traineeId   String   @map("trainee_id") @db.Uuid
  trainee     Trainee  @relation(fields: [traineeId], references: [id], onDelete: Cascade)

  /// "apprenant" | "manager" (manager = voit le reporting de son équipe, ne configure rien).
  role        String   @default("apprenant") @db.VarChar(20)
  /// Identifiant RH côté entreprise (matricule), utile au reporting + SCIM externalId.
  externalId  String?  @map("external_id") @db.VarChar(120)
  /// Équipe/service interne au tenant (regroupement reporting). Optionnel.
  equipe      String?  @db.VarChar(150)

  statut      String   @default("actif") @db.VarChar(20)  // actif | suspendu | revoque (déprovision SCIM)
  invitedAt   DateTime @default(now()) @map("invited_at")
  revokedAt   DateTime? @map("revoked_at")

  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@unique([clientId, traineeId])
  @@index([clientId])
  @@index([traineeId])
  @@index([clientId, statut])
  @@map("tenant_memberships")
}

/// Admin entreprise délégué (V2). Compte habilité à gérer SON tenant uniquement :
/// inviter/retirer des apprenants, octroyer des accès cours, voir le reporting tenant.
/// SÉPARÉ de AdminUser (NextAuth) ET de l'auth apprenant : c'est un rôle élevé
/// porté par un Trainee/contact du tenant, gated par scope tenant.
model TenantAdmin {
  id          String   @id @default(uuid()) @db.Uuid
  clientId    String   @map("client_id") @db.Uuid
  client      Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)

  /// Le compte sous-jacent est un LearnerAccount (cf. doc 04-DATA-MODEL/04). On lie par email citext.
  email       String   @db.Citext
  nom         String?  @db.VarChar(200)
  /// "tenant_owner" (tous droits tenant) | "tenant_manager" (reporting + invitations) | "tenant_reader".
  role        String   @default("tenant_owner") @db.VarChar(20)

  statut      String   @default("actif") @db.VarChar(20)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@unique([clientId, email])
  @@index([clientId])
  @@map("tenant_admins")
}
```

> **Note auth.** `TenantAdmin` ne crée **pas** un 3ᵉ système d'auth. Il référence le compte apprenant (`LearnerAccount`, défini en doc `04-DATA-MODEL/04-schema-comptes-acces-auth.md`) via l'email et ajoute un **scope d'autorisation** « admin de tel tenant ». L'auth physique reste celle de l'ADR-LMS-0001 (magic-link + password optionnel). En V2 SSO, l'attribut de groupe SSO peut mapper automatiquement vers le rôle `tenant_owner`/`tenant_manager`.

Champs à ajouter sur `ElearningEnrollment` (modèle défini en doc 02-DATA-MODEL/02, on documente ici la **dimension tenant**) :

```prisma
// model ElearningEnrollment { ... dimension multi-tenant ... }
  /// Tenant figé à l'octroi. null = accès personnel (B2C hors entreprise).
  tenantClientId String?  @map("tenant_client_id") @db.Uuid
  tenantClient   Client?  @relation("ElearningEnrollmentTenant", fields: [tenantClientId], references: [id], onDelete: SetNull)
  /// Origine de l'octroi (audit) : "admin_axionia" | "import_csv" | "tenant_admin" | "scim" | "achat".
  octroiOrigine  String?  @map("octroi_origine") @db.VarChar(30)

  @@index([tenantClientId])
```

---

## 4. Filtrage forcé au niveau Prisma — **anti-fuite cross-tenant** (cœur V2)

C'est la pièce maîtresse. On veut une garantie **deny-by-default** : aucune requête tenant ne peut, par oubli d'un `where`, lire les données d'un autre tenant.

### 4.1 Pourquoi une extension Prisma et non un middleware

Prisma 5.22 supporte les **Client Extensions** (`prisma.$extends`, `query.$allModels.$allOperations`). C'est l'API recommandée (le `$use` middleware est déprécié). On crée un **client dérivé scoped par tenant** par requête, qui injecte le filtre `client_id` dans tout `where` avant exécution.

> ⚠️ **Compatibilité build `stub.invalid`.** L'extension ne s'applique **jamais** au client stub de build (`src/lib/prisma.ts` retourne un Proxy si `DATABASE_URL.includes("stub.invalid")`). Le `tenant-guard` est instancié **au runtime**, à l'intérieur des requêtes authentifiées (pages e-learning `force-dynamic` derrière auth). Au build, aucune page tenant n'est pré-rendue → aucune interaction avec le stub. ✅ Conforme ADR 0026.

### 4.2 Résolution du contexte tenant par requête (`AsyncLocalStorage`)

Fichier : `src/server/elearning/tenant/tenant-context.ts` (NEUF).

```ts
import { AsyncLocalStorage } from "node:async_hooks";

export interface TenantContext {
  /** clientId du tenant courant, ou null = espace personnel / Axion-IA global. */
  readonly tenantClientId: string | null;
  /** "axionia_admin" = console Axion-IA (bypass scoping) ; "tenant" = scoping strict ; "learner" = scoping strict + sous-filtre apprenant. */
  readonly mode: "axionia_admin" | "tenant" | "learner";
  /** Pour mode learner : le traineeId, pour sous-filtrer ses propres données. */
  readonly traineeId?: string;
  /** Rôle tenant (tenant_owner / manager / reader) si mode tenant. */
  readonly tenantRole?: string;
}

const als = new AsyncLocalStorage<TenantContext>();

export function runWithTenant<T>(ctx: TenantContext, fn: () => Promise<T>): Promise<T> {
  return als.run(ctx, fn);
}

export function getTenantContext(): TenantContext | undefined {
  return als.getStore();
}

/** Lève si aucun contexte (fail-closed). Utilisé par l'extension. */
export function requireTenantContext(): TenantContext {
  const ctx = als.getStore();
  if (!ctx) throw new Error("tenant-context-missing"); // deny-by-default
  return ctx;
}
```

**Où le contexte est posé :**

- **Server Actions apprenant** (`src/server/elearning/actions/**`) : un wrapper `withLearnerTenant(action)` résout le `LearnerSession` (depuis le cookie `learner_session`, cf. doc 04-DATA-MODEL/04 — système séparé de NextAuth) → calcule `tenantClientId` (depuis le `TenantMembership` ou `ElearningEnrollment` ciblé) → `runWithTenant({ mode: "learner", traineeId, tenantClientId }, ...)`.
- **Server Actions admin entreprise délégué** (`src/server/elearning/tenant/actions/**`) : wrapper `withTenantAdmin(action)` résout le `TenantAdmin` → `runWithTenant({ mode: "tenant", tenantClientId, tenantRole }, ...)`.
- **Console Axion-IA** (`src/app/[locale]/(admin)/[adminPrefix]/elearning/**`) : wrapper `withAxioniaAdmin(action)` (RBAC NextAuth via `requireAdminRead/Write`, cf. `_guards.ts`) → `runWithTenant({ mode: "axionia_admin", tenantClientId: null }, ...)`. Mode **bypass** (Axion-IA voit tout) — mais peut **simuler** un tenant (impersonation auditée) en passant `tenantClientId` explicite + `mode: "tenant"`.

### 4.3 L'extension `tenant-guard`

Fichier : `src/server/elearning/tenant/prisma-tenant-guard.ts` (NEUF).

```ts
import { prisma } from "@/lib/prisma";
import { getTenantContext } from "./tenant-context";

// Modèles LMS soumis au scoping. Catégorie B (data apprenant) = filtre strict client_id.
const TENANT_SCOPED_MODELS = new Set([
  "ElearningEnrollment",
  "LessonProgress",
  "QuizAttempt",
  "ElearningCertificate",
  "FoadEvidence",
  "ElearningXapiStatement",
  "TenantMembership",
  "TenantAdmin",
]);
// Catégorie A (catalogue) = filtre "global OU tenant".
const CATALOG_MODELS = new Set([
  "ElearningCourse",
  "ElearningModule",
  "ElearningLesson",
  "ElearningResource",
  "Quiz",
  "Question",
]);

export function tenantScopedPrisma() {
  return prisma.$extends({
    name: "tenant-guard",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const ctx = getTenantContext();
          // Aucun contexte → fail-closed sauf si flag d'enforcement off (MVP).
          if (!ctx) {
            if (process.env.LMS_TENANT_ENFORCEMENT !== "true") return query(args);
            throw new Error("tenant-context-missing");
          }
          // Console Axion-IA : bypass total (voit tous les tenants).
          if (ctx.mode === "axionia_admin") return query(args);

          const isRead = /^(find|count|aggregate|groupBy)/.test(operation);
          const isWrite = /^(create|update|upsert|delete)/.test(operation);

          if (model && TENANT_SCOPED_MODELS.has(model)) {
            // Lecture : injecter client_id = ctx (AND avec le where existant).
            if (isRead) {
              args.where = andClientId(args.where, ctx.tenantClientId);
              // mode learner : sous-filtre supplémentaire sur ses propres données.
              if (ctx.mode === "learner" && ctx.traineeId) {
                args.where = andTraineeOwn(model, args.where, ctx.traineeId);
              }
            }
            // Écriture : forcer client_id à la valeur du contexte (anti-spoof).
            if (isWrite) forceClientIdOnWrite(operation, args, ctx.tenantClientId);
          }

          if (model && CATALOG_MODELS.has(model) && isRead) {
            // Catalogue : global (owner null) OU privé tenant.
            args.where = andCatalogScope(args.where, ctx.tenantClientId);
          }
          return query(args);
        },
      },
    },
  });
}
```

Points clés de l'implémentation (à respecter par l'équipe) :

- **`andClientId(where, ctx)`** combine en `AND` (`{ AND: [originalWhere, { client_id: ctx }] }`) — ne jamais écraser le `where` de l'appelant.
- **`forceClientIdOnWrite`** : sur `create`, force `data.client_id = ctx` ; sur `update/delete/upsert`, ajoute `where.client_id = ctx` pour qu'une mutation ne puisse pas toucher un autre tenant (même si l'`id` est deviné).
- **`andTraineeOwn`** : pour le mode `learner`, mappe le modèle vers sa colonne propriétaire (`LessonProgress.traineeId`, `QuizAttempt.traineeId`, etc.) et l'ajoute en `AND`. Un apprenant ne voit que **ses** données, même au sein de son tenant.
- **`andCatalogScope`** : `{ AND: [where, { OR: [{ owner_client_id: null }, { owner_client_id: ctx }] }] }`.
- **`$queryRaw` non couvert** : interdiction d'utiliser `$queryRaw`/`$executeRaw` sur des tables tenant-scoped sans filtre explicite. Lint custom (cf. §10) + revue. Le rapport de reporting brut (§7) passe par des vues SQL **paramétrées par `client_id`**, jamais par raw non filtré.

### 4.4 Usage dans une server action apprenant

```ts
// src/server/elearning/actions/get-ma-progression.ts
"use server";
import { withLearnerTenant } from "@/server/elearning/tenant/with-learner-tenant";
import { tenantScopedPrisma } from "@/server/elearning/tenant/prisma-tenant-guard";

export const getMaProgression = withLearnerTenant(async (courseId: string) => {
  const db = tenantScopedPrisma(); // hérite du AsyncLocalStorage
  // PAS besoin de where client_id : injecté automatiquement.
  return db.lessonProgress.findMany({ where: { courseId } });
});
```

### 4.5 Backstop base de données — Postgres Row-Level Security (optionnel V2+)

L'extension `tenant-guard` (§4.3) est une garantie **applicative** : robuste, mais elle vit dans le code Node. Pour une isolation **défense-en-profondeur réellement vendable** (DPA entreprise, audit sécurité), on peut activer un **backstop au niveau Postgres** : la **Row-Level Security (RLS)** refuse au moteur SQL lui-même toute ligne hors tenant, même si une requête applicative oubliait le filtre.

```sql
-- Migration additive (NE crée aucune contrainte destructive) :
ALTER TABLE elearning_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON elearning_enrollments
  USING (tenant_client_id = current_setting('app.current_tenant', true)::uuid
         OR current_setting('app.tenant_bypass', true) = 'on');
-- idem pour lesson_progress, quiz_attempts, elearning_certificates, foad_evidence, …
```

**Câblage avec Prisma (le point délicat).** La RLS exige que chaque transaction positionne `SET LOCAL app.current_tenant = '<uuid>'`. Comme Prisma mutualise les connexions du pool, ce `SET` doit être posé **par transaction** (`prisma.$transaction`) via un `$executeRaw` initial, sinon une connexion réutilisée garderait le tenant précédent. Le wrapper `tenantScopedPrisma()` encapsule donc, en mode RLS, chaque opération dans une transaction qui fait d'abord `SET LOCAL app.current_tenant`. Le mode `axionia_admin` pose `SET LOCAL app.tenant_bypass = 'on'`.

**Décision.** RLS = **optionnel, V2+**, derrière le flag `LMS_TENANT_RLS`. On **ne** l'active **pas** au MVP (surcoût transactionnel + complexité pooling). L'extension applicative `tenant-guard` reste la ligne de défense principale ; RLS est le filet de sécurité « ceinture + bretelles » à activer si un client entreprise l'exige contractuellement. ⚠️ Au build `stub.invalid` : aucune connexion réelle → RLS jamais sollicitée (les pages tenant sont `force-dynamic` runtime). ✅ Conforme ADR 0026 + ADR-LMS-0008 (`ENABLE RLS` + `CREATE POLICY` = additif, aucun DROP).

### 4.6 Défense en profondeur (couches)

1. **Couche réseau/route** : middleware/layout résout le tenant depuis l'URL (`/espace/{slug}/…`) ou le cookie et le compare au tenant du compte → 403 si mismatch (cf. §5).
2. **Couche données applicative** : extension `tenant-guard` (deny-by-default, fail-closed) — ligne de défense principale.
3. **Couche données SQL** (optionnelle, V2+) : Postgres RLS (`LMS_TENANT_RLS`, §4.5) — backstop moteur.
4. **Couche audit** : tout accès cross-tenant tenté (mismatch détecté) émet une alerte système (réutilise le mécanisme d'**alertes Qualiopi T15** — `AlerteSysteme` — + Sentry) et est journalisé dans `TenantAccessLog` (NEUF, conservation 6 mois–1 an, CNIL 2021-122).

---

## 5. Résolution du contexte tenant par requête (routing + middleware)

### Schéma d'URL (V2)

| Acteur                   | URL                                                      | Résolution tenant             |
| ------------------------ | -------------------------------------------------------- | ----------------------------- |
| Apprenant B2C (perso)    | `/portail/elearning/...` (extension du portail existant) | `tenantClientId = null`       |
| Apprenant entreprise     | `/espace/{slug}/...`                                     | `slug → Client.lmsTenantSlug` |
| Admin entreprise délégué | `/espace/{slug}/admin/...`                               | idem + rôle `TenantAdmin`     |
| Console Axion-IA         | `/[locale]/(admin)/[adminPrefix]/elearning/...`          | NextAuth `AdminUser` (bypass) |

> **Sous-domaine vs segment d'URL.** On retient le **segment d'URL `/espace/{slug}`** (pas le wildcard sous-domaine `{slug}.axion-ia.fr`) pour le MVP du multi-tenant : zéro config DNS/cert par tenant, compatible Cloudflare + Coolify actuels, et le `force-dynamic` derrière auth suffit. Le wildcard sous-domaine reste une évolution V2+ (branding fort), sans changement du data model — juste un mapping `host → slug` ajouté au middleware.

### Middleware (extension de l'existant)

Le projet a déjà `src/proxy.ts` (intercept EN→FR) + middleware next-intl. On **n'ajoute pas** de logique tenant dans NextAuth middleware (réservé admin). On ajoute un segment de résolution dans le **layout serveur** `/espace/[slug]/layout.tsx` (NEUF) :

```ts
// src/app/[locale]/espace/[slug]/layout.tsx (Server Component)
// 1. learnerSession = readLearnerSession()  (cookie learner_session, système séparé NextAuth)
// 2. client = prisma.client.findUnique({ where: { lmsTenantSlug: slug, lmsTenantActif: true } })
// 3. membership = vérifie TenantMembership(client.id, learner.traineeId) actif
//    OU TenantAdmin(client.id, learner.email) → sinon notFound()/403
// 4. fournit <TenantProvider value={{ tenantClientId: client.id, branding, role }}>
// 5. toutes les server actions enfants tournent via withLearnerTenant/withTenantAdmin
```

Le `tenantClientId` n'est **jamais** lu depuis un paramètre client de confiance (query/body). Il est **toujours** re-dérivé serveur depuis (cookie de session × slug d'URL × membership en base). Le slug d'URL sert seulement à router/valider, pas à autoriser.

---

## 6. Branding par client

### Données

`Client.lmsBranding` (JSON, §1) :

```jsonc
{
  "nomAffiche": "ACME Formation",
  "logoR2Key": "tenant-branding/{clientId}/logo.svg", // upload via getSignedUploadUrlR2
  "couleurPrimaire": "#0b5", // validée (contraste WCAG AA, cf. §9)
  "couleurAccent": "#073",
  "supportEmail": "rh@acme.fr", // affiché comme contact pédagogique tenant
  "masquerMarqueAxionIA": false, // white-label léger (option commerciale V2+)
}
```

### Rendu

- **Logo / couleurs** : le `TenantProvider` (layout `/espace/[slug]`) injecte des **CSS custom properties** (`--tenant-primary`, `--tenant-accent`) sur un wrapper. Tailwind v4 (`@theme`) lit ces variables → **zéro CSS par tenant**, **zéro impact bundle**, compatible budgets Web Vitals (pas de JS supplémentaire). Le logo est servi via `getSignedUrlR2` (R2 existant) ou Image Bank.
- **Emails** : les templates React Email LMS (`src/lib/email/templates/elearning-*.tsx`) acceptent une prop `branding` (logo + couleur + supportEmail). Le worker email résout le branding depuis le `tenantClientId` de l'enrollment. Footer **conserve** l'identité légale Axion-IA (OF responsable + SIRET + NDA) — exigence Qualiopi/légale, le white-label ne supprime jamais la mention de l'organisme certifié.
- **Certificats e-learning** : le certificat de réalisation (modèle officiel, réutilise `DocumentGenere` + QR) reste **émis au nom d'Axion-IA** (organisme certificateur). Le logo tenant peut apparaître en co-branding **secondaire** uniquement (interdit sur les pièces réglementaires officielles, cf. règle Qualiopi déjà appliquée aux attestations).

### Garde-fou contraste

Les couleurs tenant passent une validation `ensureContrastAA(couleur, fond)` (réutilise le check `radius/contrast` existant du design system admin) **à l'enregistrement** côté server action. Une couleur non conforme WCAG 2.2 AA est refusée → branding accessible garanti (EAA 28/06/2025).

---

## 7. Reporting deux niveaux

### Niveau 1 — Axion-IA (console admin, vue globale)

Sous `src/app/[locale]/(admin)/[adminPrefix]/elearning/reporting/**`, mode `axionia_admin` (bypass scoping) :

- KPIs tous tenants confondus + **ventilation par `Client`** (taux de complétion, temps moyen, scores, certificats émis, sièges consommés / `lmsSiegesAchetes`).
- Exports conformité FOAD (faisceau de preuves, cf. 08-CONFORMITE/06) **par tenant** pour répondre à un contrôle OPCO.
- RBAC : `requireAdminRead` (lecture), `requireAdminWrite` pour configurer.

### Niveau 2 — Entreprise (admin/manager délégué)

Sous `/espace/{slug}/admin/reporting`, mode `tenant` (scoping strict) :

- L'admin tenant voit **uniquement son périmètre** : ses apprenants (via `TenantMembership`), leur progression, leurs scores, leurs certificats, l'avancement vs sièges achetés.
- Le rôle `tenant_manager` voit le reporting de **son équipe** (filtre additionnel `TenantMembership.equipe`).
- **Aucune** donnée d'un autre tenant n'est atteignable — garanti par l'extension `tenant-guard` (le reporting tenant utilise `tenantScopedPrisma()`), pas par des `where` manuels.

### Implémentation des agrégats

- Lectures temps réel : `tenantScopedPrisma().elearningEnrollment.groupBy(...)` etc. (scoping auto).
- Agrégats lourds (cohortes, séries temporelles) : **vues SQL matérialisées paramétrées** rafraîchies par un worker `elearning-reporting-worker.ts` (BullMQ + cron), **toujours filtrées par `client_id`** dans la définition de la vue. Jamais de `$queryRaw` non scopé exposé à un tenant.
- Anti-fuite reporting : les exports CSV/PDF tenant passent par les mêmes server actions scoping-aware ; un test e2e adversarial (§10) vérifie qu'un `TenantAdmin` du tenant A ne peut récupérer aucune ligne du tenant B même en forgeant les paramètres.

---

## 8. Provisioning : CSV (MVP) → SSO/SCIM (V2)

### MVP — Import CSV en masse (déjà prévu roadmap MVP §3)

- Fichier service : `src/server/elearning/provisioning/import-csv.ts` (NEUF).
- Worker : `src/server/queue/workers/elearning-provisioning-worker.ts` (BullMQ).
- Flux : admin Axion-IA (ou, en V2, admin tenant) upload un CSV `email,nom,prenom,equipe,externalId,coursSlug` → validation (Zod) → pour chaque ligne :
  1. `upsert Trainee` par email (réutilise `Trainee` existant, dédoublonnage citext).
  2. `upsert TenantMembership(clientId, traineeId)`.
  3. `create ElearningEnrollment` avec `tenantClientId = clientId`, `octroiOrigine = "import_csv"`.
  4. décrément du compteur de sièges (`lmsSiegesAchetes`), refus si dépassement.
  5. envoi du magic-link d'invitation (Nodemailer + template `elearning-invitation.tsx`, branding tenant).
- Idempotent (rejouable), rapport d'erreurs par ligne, conforme consentements `Trainee.consentement*`.

### V2 — SSO (OIDC/SAML) + SCIM 2.0

**SSO** (authentification fédérée des apprenants du tenant) :

- Stocké dans `Client.lmsSsoConfigChiffre` (chiffré pii-crypto) : provider (Azure AD / Google Workspace / Okta), issuer, clientId, secret, mapping d'attributs (group → rôle tenant).
- Endpoint : `src/app/[locale]/espace/[slug]/auth/sso/callback/route.ts` (NEUF) — flux OIDC Authorization Code. À la 1ère connexion SSO, **auto-provision** d'un `Trainee` + `TenantMembership` (JIT provisioning) si l'email du domaine est autorisé.
- **Système séparé de NextAuth** (qui reste réservé aux `AdminUser`) : on n'ajoute pas de provider NextAuth ; on implémente le flux OIDC dans le monde « apprenant » pour préserver l'isolation des deux mondes (ADR-LMS-0001).
- Flag : `LMS_SSO_ENABLED` (off par défaut, comme `STRIPE_ENABLED`).

**SCIM 2.0** (provisioning/déprovisioning automatique depuis l'IdP RH) :

- Endpoint : `src/app/[locale]/api/elearning/scim/v2/[...scim]/route.ts` (NEUF) — implémente `/Users` (POST/PATCH/DELETE) et `/Groups`.
- Auth : **bearer token par tenant** (`scimTokenHashed` dans `lmsSsoConfigChiffre`, comparé en `timingSafeEqual`).
- Mapping : SCIM `userName`/`externalId` → `Trainee.email` + `TenantMembership.externalId`. `active:false` → `TenantMembership.statut = "revoque"` + révocation des accès (déprovision). Les **preuves FOAD restent conservées** (déprovision ≠ suppression, cf. §2).
- Flag : `LMS_SCIM_ENABLED`.

> Tous les endpoints provisioning sont eux-mêmes **scoping-aware** : un token SCIM du tenant A ne peut créer/modifier que des memberships du tenant A (le `tenantClientId` est dérivé du token, jamais du payload).

---

## 9. Sécurité, RGPD & accessibilité (transverse multi-tenant)

- **Isolation = obligation contractuelle** : l'extension `tenant-guard` fail-closed est la garantie technique vendable aux entreprises. Documenter dans le DPA tenant.
- **RGPD** : `Trainee` partagé entre tenants → un droit à l'effacement B2C ne doit pas effacer les preuves FOAD dues à un employeur. Stratégie : suppression = `Trainee.deletedAt` (soft) + anonymisation des champs PII non requis légalement ; les enregistrements de preuve (catégorie B) restent rattachés au `tenantClientId` avec PII minimisée. Réutilise `RgpdDemande` + `pii-crypto` existants.
- **Logs d'accès** : `TenantAccessLog` (NEUF) journalise les tentatives cross-tenant (deny). Conservation 6 mois–1 an (CNIL 2021-122). Purge par cron `elearning-logs-purge`.
- **Données handicap** (`Trainee.handicapDetailsChiffre`, AES-256-GCM) : **jamais** exposées dans le reporting tenant (un employeur n'a pas à voir le détail handicap). Le `tenant-guard` + la sélection de champs explicite l'excluent ; seul le référent handicap Axion-IA y accède (règle existante préservée).
- **Branding accessible** : contraste AA validé à l'enregistrement (§6), cibles ≥24px, alternative au drag (critères EAA 2.4.11 / 2.5.7 / 2.5.8 / 3.3.8) — hérités du socle accessibilité (09-QUALITE/04).

---

## 10. Tests & garde-fous anti-régression

- **Test e2e adversarial cross-tenant** (`src/server/elearning/tenant/__tests__/tenant-isolation.e2e.spec.ts`) : créer tenant A + B, données dans chacun, puis vérifier qu'un contexte `tenant=A` ne lit/écrit **jamais** une ligne de B sur **chaque** opération (`findMany/findUnique/update/delete/count/aggregate/groupBy`). Inclut tentative de forge d'`id` connu de B.
- **Test fail-closed** : contexte absent + `LMS_TENANT_ENFORCEMENT=true` → toute requête tenant-scoped lève.
- **Test catalogue** : un cours `ownerClientId=null` est visible des deux tenants ; un cours privé A est invisible de B.
- **Lint custom** : règle ESLint interdisant `$queryRaw`/`$executeRaw` dans `src/server/elearning/**` sans annotation `// tenant-safe: <raison>` (revue obligatoire).
- **Reporting** : test que l'export tenant B ne contient aucune ligne A même en forgeant les filtres.
- **RLS (si `LMS_TENANT_RLS=true`)** : test qu'une requête volontairement non scopée (sans `SET LOCAL app.current_tenant`) renvoie **zéro ligne** sur les tables sous policy (le moteur SQL refuse), prouvant le backstop indépendamment du code applicatif.

---

## 11. Trajectoire MVP → V2 (incrémentale, zéro refonte)

| Étape    | Quand                     | Contenu                                                                                                                                   | Migration                                                | Flag                                  |
| -------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------- |
| **M0**   | MVP                       | Colonnes tenant posées **nullable** sur `Client` + `ElearningEnrollment.tenantClientId` ; `TenantMembership` créé                         | Additive                                                 | —                                     |
| **M1**   | MVP                       | Octroi par Axion-IA + **import CSV** (memberships + enrollments, `tenantClientId` renseigné dès maintenant pour les commandes entreprise) | —                                                        | —                                     |
| **M2**   | MVP                       | Reporting niveau 1 (Axion-IA, ventilation par `Client`) — pas encore d'accès tenant                                                       | —                                                        | —                                     |
| **V2-a** | V2                        | Activation `tenant-guard` (extension Prisma) + `TenantContext` ; back-fill `tenantClientId` des enrollments entreprise existants          | Code only (+ data script)                                | `LMS_TENANT_ENFORCEMENT=true`         |
| **V2-b** | V2                        | Espace tenant `/espace/{slug}` + `TenantAdmin` délégué + branding                                                                         | Additive (`TenantAdmin`, `lmsBranding`, `lmsTenantSlug`) | `lmsTenantActif` par client           |
| **V2-c** | V2                        | Reporting niveau 2 (tenant)                                                                                                               | —                                                        | —                                     |
| **V2-d** | V2                        | SSO OIDC + SCIM                                                                                                                           | Additive (`lmsSsoConfigChiffre`)                         | `LMS_SSO_ENABLED`, `LMS_SCIM_ENABLED` |
| **V2-e** | V2+ (sur exigence client) | Backstop Postgres RLS (`ENABLE ROW LEVEL SECURITY` + policies + `SET LOCAL` par transaction)                                              | Additive (RLS/policies)                                  | `LMS_TENANT_RLS`                      |

**Pourquoi pas de dette :** en posant `tenantClientId` dès le MVP (même non enforced) et en figeant le tenant à l'octroi, le passage à l'enforcement V2 est un **back-fill trivial** (les enrollments entreprise ont déjà leur `tenantClientId`) + l'activation d'un flag. Aucune table à reconstruire, aucune donnée à re-router, aucune migration destructive (ADR-LMS-0008).

**Risque MVP assumé (documenté ADR-LMS-0002) :** tant que `LMS_TENANT_ENFORCEMENT=false`, l'isolation repose sur la discipline des `where` côté admin Axion-IA (un seul opérateur de confiance, pas d'accès tenant externe) — acceptable car **aucun tiers** n'accède aux données en MVP. L'enforcement strict devient **obligatoire** dès que le premier `TenantAdmin` externe est activé.

---

## Liens

- [`00-INDEX/DECISIONS-ARBITRAGES.md`](../00-INDEX/DECISIONS-ARBITRAGES.md) — ADR-LMS-0001 (auth hybride), ADR-LMS-0002 (multi-tenant V2), ADR-LMS-0007 (cloisonnement code), ADR-LMS-0008 (migrations additives)
- [`02-ARCHITECTURE/architecture-globale.md`](./architecture-globale.md) — vue d'ensemble (à rédiger)
- [`02-ARCHITECTURE/reutilisation-existant.md`](./reutilisation-existant.md) — carte de réutilisation `Client`/`Trainee`/`PortailAcces`/R2 (à rédiger)
- [`03-DATA-MODEL/01-schema-cours-modules-lecons.md`](../03-DATA-MODEL/01-schema-cours-modules-lecons.md) — `ElearningCourse.ownerClientId` (catégorie A)
- [`03-DATA-MODEL/02-schema-progression-tracking.md`](../03-DATA-MODEL/02-schema-progression-tracking.md) — `ElearningEnrollment.tenantClientId`, `LessonProgress` (catégorie B) — à rédiger
- [`03-DATA-MODEL/04-schema-comptes-acces-auth.md`](../03-DATA-MODEL/04-schema-comptes-acces-auth.md) — `LearnerAccount`, cookie `learner_session` (système séparé NextAuth) — à rédiger
- [`03-DATA-MODEL/06-strategie-migrations.md`](../03-DATA-MODEL/06-strategie-migrations.md) — migrations additives — à rédiger
- [`04-BACKEND/05-authentification-apprenant.md`](../04-BACKEND/05-authentification-apprenant.md) — magic-link + password (ADR-0001) — à rédiger
- [`04-BACKEND/06-import-masse-provisioning.md`](../04-BACKEND/06-import-masse-provisioning.md) — CSV + SCIM — à rédiger
- [`06-CONSOLE-ADMIN/05-gestion-acces-entreprises.md`](../06-CONSOLE-ADMIN/05-gestion-acces-entreprises.md) — UI octroi/packs entreprise — à rédiger
- [`06-CONSOLE-ADMIN/08-reporting-analytics.md`](../06-CONSOLE-ADMIN/08-reporting-analytics.md) — reporting 2 niveaux — à rédiger
- [`08-CONFORMITE/05-rgpd-conservation-preuves.md`](../08-CONFORMITE/05-rgpd-conservation-preuves.md) — RGPD partage `Trainee`, conservation preuves — à rédiger
- [`09-QUALITE/02-securite.md`](../09-QUALITE/02-securite.md) — tests isolation, fail-closed — à rédiger
- [`11-ROADMAP/01-phasage-mvp-v1-v2.md`](../11-ROADMAP/01-phasage-mvp-v1-v2.md) — phasage
