# Data model — Comptes & accès apprenant (authentification)

> Schéma Prisma **complet et additif** pour l'**identité apprenant**, l'**authentification hybride** (magic-link + mot de passe optionnel), l'**appartenance entreprise**, les **rôles apprenant**, et le **provisioning** (invitations + import en masse).
>
> Référence ADR : **ADR-LMS-0001** (auth apprenant hybride, système séparé de NextAuth), **ADR-LMS-0002** (multi-tenant conçu maintenant / livré V2), **ADR-LMS-0007** (cloisonnement code), **ADR-LMS-0008** (migrations strictement additives).
>
> **Conventions du repo respectées :** `id` UUID `@db.Uuid`, `@map` snake_case, `email`/textes en `@db.Citext`, enums Prisma, index sur FK + colonnes filtrées, timestamps `createdAt`/`updatedAt`, `@@map` table snake_case pluriel. Tous les ajouts à des modèles existants sont **nullable** (zéro DROP, zéro NOT NULL sur table peuplée).

---

## 0. TL;DR pour un dev senior

- **On ne crée PAS un nouveau modèle « utilisateur apprenant ».** L'apprenant **EST** le `Trainee` existant (`prisma/schema.prisma:5274`). On l'**étend** : `passwordHash` nullable (argon2id), vérification email, anti-bruteforce, lien entreprise renforcé.
- **L'auth apprenant est un monde séparé de NextAuth.** NextAuth v5 (`src/auth.ts`) ne gère QUE les `AdminUser` (cookie `authjs.session-token`, provider Credentials + TOTP). L'apprenant utilise un **cookie opaque dédié** (`portail_session`, déjà en place via `PortailAcces`) + un middleware/guard dédié. **Aucune** régression possible sur l'admin : les deux ne partagent ni table, ni cookie, ni provider, ni callback.
- **Magic-link reste le chemin par défaut** (réutilise `PortailAcces` + `creerAcces`/`verifierToken` existants). On **ajoute** un chemin **email + mot de passe optionnel** (pour les équipes entreprise qui le réclament).
- **Le lien Trainee↔Client devient une vraie appartenance** via une table d'adhésion `ElearningOrgMembership` (conçue multi-tenant pour la V2) + un FK dénormalisé `Trainee.primaryOrganisationClientId` pour le scoping rapide MVP.
- **Provisioning** = `ElearningInvitation` (un par email) + `ElearningImportBatch`/`ElearningImportRow` (import CSV en masse, traité par worker BullMQ).
- Migration **100 % additive** : `CREATE TABLE` pour le neuf, `ADD COLUMN ... NULL` pour `Trainee` et `PortailAcces`.

---

## 1. Carte EXISTANT vs NEUF

### 1.1 Réutilisé tel quel (vérifié dans le code)

| Brique                                                                  | Emplacement                                       | Rôle dans l'auth apprenant                                                                                                                                                                      |
| ----------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Trainee`                                                               | `schema.prisma:5274` (`trainees`)                 | **Identité apprenant** — PII, handicap chiffré, consentements. **PAS de `passwordHash`** aujourd'hui → on l'ajoute.                                                                             |
| `PortailAcces`                                                          | `schema.prisma:6236` (`portail_acces`)            | **Session opaque** : token 64 hex, cookie HttpOnly 90 j, `revoked`, `lastUsedAt`. Réutilisé comme **session apprenant unique** (magic-link ET password aboutissent à une ligne `PortailAcces`). |
| `creerAcces` / `verifierToken` / `revoquerAcces` / `getEspaceStagiaire` | `src/server/qualiopi/portail/portail-service.ts`  | Génération/vérif timing-safe (`timingSafeEqual`) du token, stub-aware `stub.invalid`. Réutilisé tel quel.                                                                                       |
| `setPortailCookie` / `getPortailToken` / `clearPortailCookie`           | `src/server/qualiopi/portail/cookie.ts`           | Cookie `portail_session` (HttpOnly, Secure, SameSite=Lax, 90 j). Réutilisé tel quel.                                                                                                            |
| Route handler accès token                                               | `src/app/[locale]/portail/acces/[token]/route.ts` | Rate-limit IP (`checkRateLimit` 10/60 s) → `verifierToken` → cookie → 302. Étendu (pas réécrit).                                                                                                |
| `hashPassword` / `verifyPasswordSafe`                                   | `src/lib/auth-password.ts`                        | **SSOT argon2id** (memoryCost 19456, timeCost 2, parallelism 1, dummy-hash anti-oracle). Réutilisé pour le mot de passe apprenant — **ne pas redéclarer argon2**.                               |
| `signMagicToken` / `verifyMagicToken`                                   | `src/lib/magic-token.ts`                          | Tokens HMAC-SHA256 signés, scopés + TTL. On **ajoute un scope** `learner_*` (cf. §6).                                                                                                           |
| `checkRateLimit`                                                        | `src/lib/rate-limit.ts`                           | Sliding-window Redis, fail-open si stub. Réutilisé pour login/reset apprenant.                                                                                                                  |
| `Client` (CRM)                                                          | `schema.prisma:4890` (`clients`)                  | **Entreprise** : SIRET, NAF→OPCO, contact. Devient le « tenant » d'appartenance (FK additive).                                                                                                  |
| `Enrollment`                                                            | `schema.prisma:5310`                              | Inscription session présentiel/live. Déjà porteur de `clientId` (inter-entreprises). **Inchangé** ; l'octroi e-learning a sa propre table `ElearningEnrollment` (doc 02).                       |
| R2 (`src/lib/r2-storage.ts`)                                            | —                                                 | Stockage CSV d'import + justificatifs (clé `imports/elearning/<batchId>.csv`).                                                                                                                  |
| Emails Nodemailer + React Email + `email-worker`                        | `src/lib/email/**`                                | Envoi invitation / lien magique / reset mot de passe (templates neufs, infra réutilisée).                                                                                                       |

### 1.2 Neuf à construire (cloisonné ADR-0007)

| Élément                                                                                                                                                             | Type                      | Emplacement cible                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Extension `Trainee` (auth + entreprise)                                                                                                                             | colonnes Prisma additives | `prisma/schema.prisma` (bloc `Trainee`)                                                                               |
| Extension `PortailAcces` (métadonnées session)                                                                                                                      | colonnes Prisma additives | `prisma/schema.prisma` (bloc `PortailAcces`)                                                                          |
| `ElearningOrgMembership`                                                                                                                                            | modèle Prisma             | `prisma/schema.prisma`                                                                                                |
| `ElearningAuthToken`                                                                                                                                                | modèle Prisma             | `prisma/schema.prisma`                                                                                                |
| `ElearningInvitation`                                                                                                                                               | modèle Prisma             | `prisma/schema.prisma`                                                                                                |
| `ElearningImportBatch` / `ElearningImportRow`                                                                                                                       | modèles Prisma            | `prisma/schema.prisma`                                                                                                |
| Enums `LearnerAccountStatut`, `ElearningOrgRole`, `ElearningOrgMembershipStatut`, `ElearningAuthTokenPurpose`, `ElearningInvitationStatut`, `ElearningImportStatut` | enums Prisma              | `prisma/schema.prisma`                                                                                                |
| Service auth apprenant (login/reset/verify/session)                                                                                                                 | code                      | `src/server/elearning/auth/learner-auth-service.ts`                                                                   |
| Guard `requireLearner` / `getLearnerSession`                                                                                                                        | code                      | `src/server/elearning/auth/learner-guard.ts`                                                                          |
| Server actions (set/reset password, logout)                                                                                                                         | code                      | `src/server/elearning/auth/learner-account.actions.ts`                                                                |
| Provisioning (octroi, invitation, import)                                                                                                                           | code + worker             | `src/server/elearning/access/**`, `src/server/queue/workers/elearning-import-worker.ts`, `elearning-invite-worker.ts` |
| Routes login/reset apprenant                                                                                                                                        | route handlers + pages    | `src/app/[locale]/portail/**` (extension)                                                                             |
| Composants formulaires apprenant                                                                                                                                    | UI                        | `src/components/elearning/auth/**`, `src/components/admin/elearning/access/**`                                        |

---

## 2. Enums (neufs)

```prisma
/// Statut du COMPTE apprenant (≠ statut d'inscription/session).
/// MVP : pré-rempli `invite` à l'octroi ; passe `actif` à la 1re connexion.
enum LearnerAccountStatut {
  invite        // compte créé/pré-provisionné, jamais connecté (invitation en attente)
  actif         // a déjà ouvert une session (magic-link ou mot de passe)
  suspendu      // accès gelé (décision admin / fin de contrat entreprise)
  // pas de "supprime" : on réutilise Trainee.deletedAt (soft-delete RGPD existant)
}

/// Rôle d'un apprenant AU SEIN d'une entreprise (Client). Pensé multi-tenant V2.
/// MVP : seul `membre` est exploité ; les rôles d'admin entreprise sont stockés
/// mais l'UI déléguée n'arrive qu'en V2 (ADR-0002).
enum ElearningOrgRole {
  membre        // apprenant standard de l'organisation
  manager       // (V2) peut voir la progression de son équipe, relancer
  org_admin     // (V2) gère les sièges/accès de l'organisation, branding
}

/// Statut d'une adhésion apprenant ↔ entreprise.
enum ElearningOrgMembershipStatut {
  active
  suspended     // siège suspendu (ex. départ salarié) sans supprimer l'historique
  revoked       // siège retiré (preuve conservée pour audit OPCO/Qualiopi)
}

/// Finalité d'un token d'authentification apprenant à usage unique (haché).
enum ElearningAuthTokenPurpose {
  email_verification   // confirmer l'adresse (comptes mot de passe)
  password_reset       // réinitialisation mot de passe
  magic_login          // connexion sans mot de passe (lien à usage unique)
  password_setup       // 1re définition du mot de passe (invitation entreprise)
}

/// Statut d'une invitation apprenant.
enum ElearningInvitationStatut {
  envoyee
  acceptee
  expiree
  revoquee
}

/// Statut d'un lot d'import CSV en masse.
enum ElearningImportStatut {
  recu          // CSV uploadé, en attente de traitement
  en_cours      // worker en train de traiter les lignes
  termine       // toutes les lignes traitées (succès et/ou erreurs)
  echoue        // échec global (CSV illisible, colonnes manquantes…)
}
```

---

## 3. Extension de `Trainee` (additive — colonnes nullable)

> **Bloc à insérer dans le modèle `Trainee` existant** (`schema.prisma:5274`). Toutes les colonnes sont nullable ou ont un défaut → migration `ADD COLUMN` sans réécriture. Le `Trainee` reste l'identité unique : un même humain a UNE ligne, qu'il vienne d'une session présentielle ou d'un achat e-learning direct.

```prisma
model Trainee {
  // ... champs existants inchangés (nom, prenom, email @unique @db.Citext, telephone,
  //     entreprise, fonction, situationHandicap, handicap*, consentement*, deletedAt, ...) ...

  // ── Compte apprenant e-learning (ADR-0001) ───────────────────────────────
  /// Hash argon2id (SSOT src/lib/auth-password.ts). NULL = compte passwordless
  /// (magic-link uniquement). Renseigné seulement si l'apprenant définit un mot
  /// de passe (chemin entreprise optionnel). JAMAIS exposé côté client.
  passwordHash            String?               @map("password_hash") @db.VarChar(255)
  passwordSetAt           DateTime?             @map("password_set_at")
  /// Statut du compte (≠ statut d'inscription). Défaut `invite` à l'octroi.
  learnerStatut           LearnerAccountStatut  @default(invite) @map("learner_statut")
  /// Vérification d'email : NULL tant que l'apprenant n'a pas confirmé via lien.
  /// Le magic-link vaut preuve de possession de la boîte → set automatiquement.
  emailVerifiedAt         DateTime?             @map("email_verified_at")

  // ── Anti-bruteforce / sécurité connexion (en plus du rate-limit Redis) ────
  failedLoginCount        Int                   @default(0) @map("failed_login_count")
  lockedUntil             DateTime?             @map("locked_until")   // verrou temporaire après N échecs
  lastLoginAt             DateTime?             @map("last_login_at")
  lastLoginIp             String?               @map("last_login_ip") @db.VarChar(64)
  /// Méthode utilisée à la dernière connexion (audit) : "magic" | "password".
  lastLoginMethod         String?               @map("last_login_method") @db.VarChar(20)

  // ── Appartenance entreprise (lien renforcé — ADR-0002) ───────────────────
  /// FK dénormalisée vers l'organisation principale (scoping rapide MVP).
  /// Source de vérité fine = ElearningOrgMembership (multi-org possible V2).
  /// NULL = apprenant particulier (B2C) sans entreprise.
  primaryOrganisationClientId String?           @map("primary_organisation_client_id") @db.Uuid
  primaryOrganisation         Client?           @relation("TraineeOrganisationPrincipale", fields: [primaryOrganisationClientId], references: [id], onDelete: SetNull)

  // ── Préférences apprenant (UX / accessibilité WCAG) ──────────────────────
  /// Préférences UI persistées (vitesse lecture, sous-titres on/off, reduce-motion…).
  preferencesJson         Json?                 @map("preferences_json")

  // ── Relations e-learning (inverses) ──────────────────────────────────────
  orgMemberships          ElearningOrgMembership[] @relation("TraineeOrgMemberships")
  authTokens              ElearningAuthToken[]
  invitationsRecues       ElearningInvitation[]    @relation("InvitationTrainee")
  // elearningEnrollments ElearningEnrollment[]   // défini en doc 02 (progression)

  @@index([learnerStatut])
  @@index([primaryOrganisationClientId])
  // ... index existants conservés (@@index([email]), [entreprise], [situationHandicap]) ...
  @@map("trainees")
}
```

**Notes de conception**

- **Email = identifiant de connexion.** `Trainee.email` est déjà `@unique @db.Citext` → parfait pour un login email/mot de passe insensible à la casse. Pas de second identifiant.
- **`passwordHash` nullable est le cœur d'ADR-0001** : un apprenant peut vivre toute sa vie en magic-link (`passwordHash = NULL`). Le mot de passe est un **opt-in**.
- **`emailVerifiedAt`** : poser automatiquement à la 1re consommation d'un magic-link (la possession de la boîte est prouvée). Pour le chemin mot de passe pur (auto-inscription B2C V1), exiger une vérification explicite.
- **Anti-bruteforce à deux couches** : `failedLoginCount`/`lockedUntil` (verrou compte, persistant) **en plus** du `checkRateLimit` Redis par IP (volatile). Les deux sont complémentaires (compte vs IP).
- **`entreprise` (texte libre existant)** reste pour l'affichage/legacy ; **la vérité relationnelle** passe désormais par `primaryOrganisationClientId` + `ElearningOrgMembership`. Un job de réconciliation pourra rapprocher le texte libre d'un `Client` (hors périmètre de ce doc).

---

## 4. Extension de `PortailAcces` (session apprenant unifiée — additive)

> `PortailAcces` est **déjà** notre table de session opaque (token 64 hex, cookie 90 j, révocable). On la **réutilise pour les deux chemins** (magic-link ET mot de passe) : après une authentification réussie par mot de passe, on **crée une ligne `PortailAcces`** exactement comme le fait `creerAcces`. Cela évite un second système de session et garantit une **révocation centralisée**.
>
> On ajoute uniquement des **métadonnées d'audit/sécurité** (nullable).

```prisma
model PortailAcces {
  // ... champs existants : id, traineeId, trainee, token @unique @db.VarChar(64),
  //     expiresAt, revoked @default(false), lastUsedAt, createdAt ...

  /// Comment cette session a été ouverte : "magic" | "password" | "import" | "admin".
  authMethod   String?   @map("auth_method") @db.VarChar(20)
  /// IP/agent au moment de la création (traçabilité, conformité logs CNIL 6-12 mois).
  createdIp    String?   @map("created_ip") @db.VarChar(64)
  userAgent    String?   @map("user_agent") @db.Text
  /// Dernière IP vue (mise à jour fire-and-forget avec lastUsedAt).
  lastIp       String?   @map("last_ip") @db.VarChar(64)
  /// Libellé device choisi par l'utilisateur (V1, gestion des appareils).
  deviceLabel  String?   @map("device_label") @db.VarChar(120)

  @@index([expiresAt])   // purge des sessions expirées par cron
  // ... @@index([traineeId]) existant conservé ...
  @@map("portail_acces")
}
```

**Conséquences**

- **Magic-link** : inchangé fonctionnellement — `creerAcces` continue de créer la ligne ; on enrichit juste `authMethod="magic"`, `createdIp`, `userAgent`.
- **Mot de passe** : nouveau service `learner-auth-service.ts` appelle une variante `creerSession({ traineeId, authMethod: "password", ip, userAgent })` qui réutilise `genererTokenPortail()` (32 bytes → 64 hex) puis pose le cookie via `setPortailCookie`.
- **Révocation** : `revoquerAcces(id)` existe déjà ; on ajoute `revoquerToutesSessions(traineeId)` (utile après reset mot de passe ou suspension).
- **Pas de nouvelle table de session** : décision explicite — `PortailAcces` suffit (token opaque, expirable, révocable, multi-device). On **ne crée PAS** de `LearnerSession` séparée.

---

## 5. `ElearningOrgMembership` — appartenance entreprise + rôles (neuf)

> Table d'adhésion **Trainee × Client**, conçue **multi-tenant dès maintenant** (ADR-0002) mais exploitée a minima au MVP (un membre = un siège). Elle porte le **rôle apprenant dans l'entreprise** et le **statut du siège** (pour la preuve OPCO/Qualiopi). En V2, l'admin entreprise délégué gère ces lignes lui-même.

```prisma
model ElearningOrgMembership {
  id            String                        @id @default(uuid()) @db.Uuid

  traineeId     String                        @map("trainee_id") @db.Uuid
  trainee       Trainee                       @relation("TraineeOrgMemberships", fields: [traineeId], references: [id], onDelete: Cascade)

  /// L'entreprise (tenant). Réutilise le CRM Client existant.
  clientId      String                        @map("client_id") @db.Uuid
  client        Client                        @relation("ClientElearningMemberships", fields: [clientId], references: [id], onDelete: Cascade)

  role          ElearningOrgRole              @default(membre)
  statut        ElearningOrgMembershipStatut  @default(active)

  /// Qui a ouvert ce siège (admin Axion-IA au MVP ; admin entreprise en V2).
  invitedByAdminId String?                    @map("invited_by_admin_id") @db.Uuid
  invitedByAdmin   AdminUser?                 @relation("AdminElearningMemberships", fields: [invitedByAdminId], references: [id], onDelete: SetNull)

  /// Borne de validité du siège (ex. durée du marché entreprise). NULL = illimité.
  accesDebut    DateTime?                     @map("acces_debut")
  accesFin      DateTime?                     @map("acces_fin")

  createdAt     DateTime                      @default(now()) @map("created_at")
  updatedAt     DateTime                      @updatedAt @map("updated_at")

  @@unique([traineeId, clientId], map: "elearning_org_membership_unique")
  @@index([clientId, statut])
  @@index([traineeId])
  @@map("elearning_org_memberships")
}
```

**Champs inverses additifs à poser sur les modèles existants**

```prisma
// model Client { ... }
  elearningMemberships ElearningOrgMembership[] @relation("ClientElearningMemberships")
  traineesPrincipaux   Trainee[]               @relation("TraineeOrganisationPrincipale")

// model AdminUser { ... }
  elearningMembershipsCrees ElearningOrgMembership[] @relation("AdminElearningMemberships")
```

> Ces inverses n'ajoutent **aucune colonne** côté `Client`/`AdminUser` (FK portée par `ElearningOrgMembership`) → migration purement additive.

**Pourquoi une table d'adhésion + un FK dénormalisé ?**

- Le **FK dénormalisé** `Trainee.primaryOrganisationClientId` permet un scoping `WHERE primary_organisation_client_id = :tenant` ultra-rapide au MVP (cas mono-entreprise).
- La **table d'adhésion** est la _source de vérité multi-tenant V2_ : un salarié peut appartenir à plusieurs entités, avec des rôles différents, sans casser le modèle. Quand la V2 arrive, le scoping passe par un JOIN sur `ElearningOrgMembership` (déjà prêt), zéro migration de refonte.

---

## 6. `ElearningAuthToken` — tokens à usage unique hachés (neuf)

> Pour les flux **mot de passe** (vérification email, reset, 1re définition) et le **magic-login à usage unique**, on ne peut pas réutiliser `PortailAcces` (qui est une _session longue_, pas un _one-shot court_). On crée une table de tokens **hachés** (jamais en clair en base — même doctrine que `FormateurMagicLink.tokenHash`, `schema.prisma:6601`).

```prisma
model ElearningAuthToken {
  id         String                     @id @default(uuid()) @db.Uuid

  traineeId  String                     @map("trainee_id") @db.Uuid
  trainee    Trainee                    @relation(fields: [traineeId], references: [id], onDelete: Cascade)

  purpose    ElearningAuthTokenPurpose
  /// SHA-256 du token envoyé par email (le secret n'est JAMAIS stocké en clair).
  tokenHash  String                     @unique @map("token_hash") @db.VarChar(64)
  expiresAt  DateTime                   @map("expires_at")
  usedAt     DateTime?                  @map("used_at")     // one-shot : rejet si déjà utilisé
  createdIp  String?                    @map("created_ip") @db.VarChar(64)
  createdAt  DateTime                   @default(now()) @map("created_at")

  @@index([traineeId, purpose])
  @@index([expiresAt])
  @@map("elearning_auth_tokens")
}
```

**Stratégie token (deux familles, complémentaires)**

| Flux                             | Mécanisme                                                                                          | TTL           | Stockage                                               | Pourquoi                                           |
| -------------------------------- | -------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------ | -------------------------------------------------- |
| **Session** (après login réussi) | `PortailAcces.token` opaque 64 hex                                                                 | 90 j          | clair en base (déjà le cas), comparé `timingSafeEqual` | session longue révocable, statu quo                |
| **Magic-login one-shot**         | `ElearningAuthToken` (purpose `magic_login`), token aléatoire envoyé par mail, **SHA-256** en base | 15–30 min     | **haché**                                              | usage unique (`usedAt`), pas de session avant clic |
| **Reset / setup / verify**       | `ElearningAuthToken` (purpose correspondant)                                                       | 30 min – 24 h | **haché**                                              | flux sensibles, one-shot                           |

> **Pourquoi pas seulement `signMagicToken` (HMAC `src/lib/magic-token.ts`) ?** Les tokens HMAC sont _stateless_ (réutilisables jusqu'à expiration, cf. commentaire « Replay attack » du fichier). Pour les flux **sensibles à usage unique** (reset mot de passe, 1re activation), on veut une **révocation/consommation traçable en base** → `ElearningAuthToken.usedAt`. On peut combiner les deux : un magic-link peut être un token HMAC signé (scope `learner_login`) **dont le `jti` est tracé** dans `ElearningAuthToken` pour garantir l'usage unique. **Décision MVP** : tokens hachés en base (`ElearningAuthToken`) pour tous les flux email-sensibles ; HMAC `signMagicToken` réservé aux liens non-sensibles. Ajouter le scope `learner_login` à `MagicScope` (`src/lib/magic-token.ts:29`) si on veut la voie HMAC.

---

## 7. Provisioning — invitations & import en masse (neuf)

### 7.1 `ElearningInvitation`

> Une invitation individuelle (octroi d'accès à un apprenant nommé). Peut précéder l'existence d'un `Trainee` (on stocke alors l'email cible ; le `Trainee` est créé/lié à l'acceptation).

```prisma
model ElearningInvitation {
  id          String                     @id @default(uuid()) @db.Uuid

  /// Email cible (citext, insensible à la casse). Source de vérité de l'invitation.
  email       String                     @db.Citext
  /// Lien vers le Trainee si déjà existant/créé (sinon résolu à l'acceptation).
  traineeId   String?                    @map("trainee_id") @db.Uuid
  trainee     Trainee?                   @relation("InvitationTrainee", fields: [traineeId], references: [id], onDelete: SetNull)

  /// Entreprise rattachée (octroi "pack entreprise"). NULL = invitation B2C directe.
  clientId    String?                    @map("client_id") @db.Uuid
  client      Client?                    @relation("ClientElearningInvitations", fields: [clientId], references: [id], onDelete: SetNull)

  /// Cours à octroyer à l'acceptation (optionnel : invitation "compte seul").
  /// FK définie en doc 01 (ElearningCourse). Nullable, onDelete: SetNull.
  courseId    String?                    @map("course_id") @db.Uuid

  /// Rôle à attribuer dans l'entreprise à l'acceptation.
  orgRole     ElearningOrgRole           @default(membre) @map("org_role")
  /// Le compte créé devra-t-il définir un mot de passe ? (sinon magic-link only)
  requireMotDePasse Boolean              @default(false) @map("require_mot_de_passe")

  statut      ElearningInvitationStatut  @default(envoyee)
  /// Hash SHA-256 du token d'invitation (envoyé par email). Jamais en clair.
  tokenHash   String                     @unique @map("token_hash") @db.VarChar(64)
  expiresAt   DateTime                   @map("expires_at")
  acceptedAt  DateTime?                  @map("accepted_at")

  /// Admin Axion-IA émetteur (MVP) ; admin entreprise (V2).
  invitedByAdminId String?               @map("invited_by_admin_id") @db.Uuid
  invitedByAdmin   AdminUser?            @relation("AdminElearningInvitations", fields: [invitedByAdminId], references: [id], onDelete: SetNull)

  /// Lot d'import d'origine (NULL si invitation unitaire).
  importBatchId String?                  @map("import_batch_id") @db.Uuid
  importBatch   ElearningImportBatch?    @relation(fields: [importBatchId], references: [id], onDelete: SetNull)

  createdAt   DateTime                   @default(now()) @map("created_at")
  updatedAt   DateTime                   @updatedAt @map("updated_at")

  @@index([email])
  @@index([statut])
  @@index([clientId])
  @@index([importBatchId])
  @@map("elearning_invitations")
}
```

### 7.2 `ElearningImportBatch` / `ElearningImportRow`

> Import CSV en masse (« une entreprise commande 40 sièges → on ouvre 40 accès »). Le CSV est uploadé sur R2, puis traité **de façon asynchrone** par un worker BullMQ (idempotent, reprenable, traçable ligne par ligne).

```prisma
model ElearningImportBatch {
  id            String                @id @default(uuid()) @db.Uuid

  /// Entreprise destinataire des accès (octroi pack). NULL = import B2C mixte.
  clientId      String?               @map("client_id") @db.Uuid
  client        Client?               @relation("ClientElearningImports", fields: [clientId], references: [id], onDelete: SetNull)

  /// Cours octroyé à toutes les lignes (peut être surchargé par ligne).
  courseId      String?               @map("course_id") @db.Uuid

  /// Clé R2 du CSV source (src/lib/r2-storage.ts) : imports/elearning/<id>.csv
  csvR2Key      String                @map("csv_r2_key") @db.VarChar(300)
  filename      String?               @db.VarChar(255)
  statut        ElearningImportStatut @default(recu)

  totalRows     Int                   @default(0) @map("total_rows")
  successRows   Int                   @default(0) @map("success_rows")
  errorRows     Int                   @default(0) @map("error_rows")
  /// Erreur globale éventuelle (CSV illisible, colonnes manquantes).
  errorMessage  String?               @map("error_message") @db.Text

  /// Admin Axion-IA déclencheur.
  createdByAdminId String?            @map("created_by_admin_id") @db.Uuid
  createdByAdmin   AdminUser?         @relation("AdminElearningImports", fields: [createdByAdminId], references: [id], onDelete: SetNull)

  startedAt     DateTime?             @map("started_at")
  finishedAt    DateTime?             @map("finished_at")
  createdAt     DateTime              @default(now()) @map("created_at")

  rows          ElearningImportRow[]
  invitations   ElearningInvitation[]

  @@index([clientId])
  @@index([statut])
  @@map("elearning_import_batches")
}

model ElearningImportRow {
  id          String                @id @default(uuid()) @db.Uuid
  batchId     String                @map("batch_id") @db.Uuid
  batch       ElearningImportBatch  @relation(fields: [batchId], references: [id], onDelete: Cascade)

  ligne       Int                                          // n° de ligne CSV (1-based)
  /// Données brutes de la ligne (email, nom, prenom, courseSlug?, ...).
  rawJson     Json                  @map("raw_json")
  /// Statut de traitement de la ligne.
  statut      ElearningImportStatut @default(recu)
  /// Trainee résolu/créé pour cette ligne (renseigné en succès).
  traineeId   String?               @map("trainee_id") @db.Uuid
  /// Invitation émise pour cette ligne (renseignée en succès).
  invitationId String?              @map("invitation_id") @db.Uuid
  errorMessage String?              @map("error_message") @db.Text

  createdAt   DateTime              @default(now()) @map("created_at")

  @@unique([batchId, ligne], map: "elearning_import_row_unique")
  @@index([batchId, statut])
  @@map("elearning_import_rows")
}
```

**Champs inverses additifs (Client / AdminUser)**

```prisma
// model Client { ... }
  elearningInvitations ElearningInvitation[]  @relation("ClientElearningInvitations")
  elearningImports     ElearningImportBatch[] @relation("ClientElearningImports")

// model AdminUser { ... }
  elearningInvitationsEmises ElearningInvitation[]  @relation("AdminElearningInvitations")
  elearningImportsLances     ElearningImportBatch[] @relation("AdminElearningImports")
```

**Pipeline d'import (résumé — détaillé en `04-BACKEND/06-import-masse-provisioning.md`)**

1. Admin uploade le CSV → `getSignedUploadUrlR2` (`src/lib/r2-storage.ts`) → `ElearningImportBatch` (`recu`).
2. Server action `lancerImport(batchId)` (`src/server/elearning/access/import.actions.ts`) enqueue le job BullMQ.
3. Worker `src/server/queue/workers/elearning-import-worker.ts` :
   - lit le CSV (R2), parse, crée une `ElearningImportRow` par ligne ;
   - par ligne : upsert `Trainee` (clé `email` citext), upsert `ElearningOrgMembership` (si `clientId`), crée `ElearningInvitation` (`tokenHash`), enqueue l'email d'invitation ;
   - **idempotent** : `@@unique([batchId, ligne])` + upsert email évitent les doublons sur re-run ;
   - met à jour `successRows`/`errorRows`/`statut`.
4. Worker `elearning-invite-worker.ts` (ou réutilisation `email-worker`) envoie le mail (template React Email neuf `elearning-invitation.tsx`).

---

## 8. Authentification apprenant — flux & cohabitation NextAuth

### 8.1 Deux mondes étanches (ADR-0001)

| Dimension         | **Admin** (existant)                                                                           | **Apprenant** (neuf)                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Identité          | `AdminUser` (`schema.prisma:1526`)                                                             | `Trainee` (étendu)                                                                        |
| Lib auth          | NextAuth v5 (`src/auth.ts`, `src/auth.config.ts`), provider Credentials + TOTP                 | service maison `src/server/elearning/auth/learner-auth-service.ts`                        |
| Session           | JWT NextAuth, cookie `authjs.session-token` (par défaut)                                       | cookie opaque `portail_session` + table `PortailAcces`                                    |
| Hash mot de passe | `src/lib/auth-password.ts` (argon2id)                                                          | **même** `src/lib/auth-password.ts` (réutilisé)                                           |
| 2FA               | TOTP obligatoire super_admin/admin                                                             | **non** (hors périmètre MVP ; magic-link déjà fort)                                       |
| Guard             | `auth()` + `requireAdminRead/Write/Publish/Delete` (`src/server/actions/knowledge/_guards.ts`) | `getLearnerSession()` + `requireLearner()` (`src/server/elearning/auth/learner-guard.ts`) |
| Rôles             | `AdminRole { super_admin, admin, editor, reader }`                                             | `ElearningOrgRole { membre, manager, org_admin }` (entreprise)                            |
| Middleware        | matcher admin (`src/app/[locale]/(admin)/**`)                                                  | matcher portail (`/portail/**`)                                                           |

**Garanties anti-régression**

- **Aucun partage de table** : NextAuth n'écrit ni ne lit jamais `Trainee`/`PortailAcces`. Le provider Credentials de `src/auth.ts` interroge uniquement `prisma.adminUser`.
- **Cookies disjoints** : `authjs.session-token` (admin) vs `portail_session` (apprenant) — noms différents, jamais collision.
- **`declare module "next-auth"`** (`src/auth.ts:48`) reste **strictement admin** (`Session.user.role: AdminRole`). On n'y touche pas. L'apprenant n'apparaît jamais dans `session.user`.
- **Guards séparés** : un Server Action e-learning **ne doit jamais** appeler `auth()` pour authentifier un apprenant — il appelle `requireLearner()`. Inversement, l'admin e-learning (outil auteur, octroi) appelle `requireAdminWrite()` comme le reste de la console.
- **Pas de NextAuth adapter Prisma** (le code le note : « JWT pur, pas de tables Account/Session ») → ajouter des tables apprenant ne perturbe rien.

### 8.2 Service auth apprenant (à construire)

`src/server/elearning/auth/learner-auth-service.ts` — fonctions :

```text
creerSession({ traineeId, authMethod, ip, userAgent }) → { token, expiresAt }
   // réutilise genererTokenPortail() + prisma.portailAcces.create(); pose authMethod/createdIp.
getLearnerByEmail(email)                  // findUnique citext
loginAvecMotDePasse({ email, password, ip, userAgent })
   // 1. checkRateLimit(`learner:login:${ip}`, {limit:5, windowSec:900})
   // 2. trainee = getLearnerByEmail (ou dummy pour timing)
   // 3. si lockedUntil > now → refus
   // 4. verifyPasswordSafe(trainee?.passwordHash, password)  // SSOT auth-password.ts
   // 5. succès → reset failedLoginCount, set lastLogin*, creerSession, setPortailCookie
   //    échec → incr failedLoginCount, set lockedUntil si seuil atteint
demanderMagicLink(email)                  // crée ElearningAuthToken(magic_login) + email
consommerMagicLogin(token)                // verify hash + usedAt + emailVerifiedAt + creerSession
definirMotDePasse({ traineeId, password }) // hashPassword + passwordSetAt + revoquerToutesSessions
demanderReset(email) / consommerReset(token, newPassword)
verifierEmail(token)                      // ElearningAuthToken(email_verification) → emailVerifiedAt
logout()                                  // revoquerAcces(sessionId) + clearPortailCookie
```

`src/server/elearning/auth/learner-guard.ts` :

```text
getLearnerSession() : Promise<{ traineeId } | null>
   // getPortailToken() → verifierToken() (réutilise portail-service.ts)
requireLearner() : Promise<{ traineeId }>
   // throw "unauthorized" si null (à mapper en redirect /portail/connexion côté page)
```

### 8.3 Routes & pages (extension du namespace `portail`)

| Route                                            | Type                       | Rôle                                                                   |
| ------------------------------------------------ | -------------------------- | ---------------------------------------------------------------------- |
| `/[locale]/portail/connexion`                    | page                       | Choix : « recevoir un lien » (magic) OU « email + mot de passe »       |
| `/[locale]/portail/acces/[token]`                | route handler **existant** | Magic-link → cookie → `mon-espace` (inchangé, enrichi `authMethod`)    |
| `/[locale]/portail/connexion/lien`               | route handler              | `consommerMagicLogin` (token `ElearningAuthToken`)                     |
| `/[locale]/portail/mot-de-passe/definir/[token]` | page + action              | 1re définition (invitation/setup)                                      |
| `/[locale]/portail/mot-de-passe/reset`           | page + action              | demande + consommation reset                                           |
| `/[locale]/portail/deconnexion`                  | route handler              | `logout()`                                                             |
| `/[locale]/portail/invitation/[token]`           | page + action              | acceptation `ElearningInvitation` → création/lien Trainee + membership |

> Toutes ces routes sont **derrière auth ou one-shot token** et **`force-dynamic`** → compatibles avec le build `stub.invalid` (aucun rendu DB au SSG ; les services sont déjà stub-aware et retournent `null`).

### 8.4 Server actions apprenant

`src/server/elearning/auth/learner-account.actions.ts` (`"use server"`) :
`demanderMagicLinkAction`, `loginMotDePasseAction`, `definirMotDePasseAction`, `demanderResetAction`, `consommerResetAction`, `logoutAction`. Chaque action : validation Zod (`src/lib/schemas/`), rate-limit, **jamais** d'exposition de `passwordHash`, messages d'erreur **non-énumérants** (« si un compte existe, un email a été envoyé »).

---

## 9. Sécurité, RGPD & conservation

- **Hash mot de passe** : argon2id via `src/lib/auth-password.ts` (SSOT, ne pas redéclarer argon2). `passwordHash` jamais sérialisé vers le client (sélectionner explicitement les champs, jamais `select: *`).
- **Tokens email** : toujours **hachés** en base (`ElearningAuthToken.tokenHash`, `ElearningInvitation.tokenHash` = SHA-256), one-shot (`usedAt`), TTL court. Le secret n'existe qu'en transit (mail).
- **Anti-énumération** : login et reset renvoient des réponses constantes ; `verifyPasswordSafe` égalise le timing via dummy-hash même si le compte n'existe pas.
- **Rate-limit double** : Redis par IP (`checkRateLimit`) + verrou compte (`failedLoginCount`/`lockedUntil`).
- **Logs techniques** : `PortailAcces.createdIp/lastIp/userAgent`, `ElearningAuthToken.createdIp` → conservation **6–12 mois** (CNIL 2021-122) ; cron de purge à prévoir (`elearning-*-cleanup`).
- **Soft-delete RGPD** : on réutilise `Trainee.deletedAt` (existant) + `RgpdDemande`. La suppression d'un `Trainee` casse en cascade `ElearningOrgMembership`, `ElearningAuthToken` (onDelete Cascade) ; `PortailAcces` déjà en Cascade. Les invitations passent `SetNull` (preuve d'octroi conservée anonymisée).
- **Conservation preuves d'octroi/accès** (OPCO/Qualiopi) : `ElearningOrgMembership` (statut `revoked` plutôt que delete) + `ElearningImportBatch`/`Row` conservés 3–6 ans (cf. `08-CONFORMITE/05-rgpd-conservation-preuves.md`).
- **Build stub** : tous les services auth apprenant doivent répliquer le garde `if (process.env["DATABASE_URL"]?.includes("stub.invalid"))` (lecture → `null`, mutation → throw) comme `portail-service.ts`.

---

## 10. Migration (additive — ADR-0008)

Une seule migration `prisma/migrations/<timestamp>_elearning_comptes_acces/migration.sql` :

1. `CREATE TYPE` pour les 6 enums du §2.
2. `ALTER TABLE trainees ADD COLUMN ... NULL` (toutes les colonnes du §3) + `CREATE INDEX`.
3. `ALTER TABLE portail_acces ADD COLUMN ... NULL` (§4) + `CREATE INDEX idx ... (expires_at)`.
4. `CREATE TABLE elearning_org_memberships`, `elearning_auth_tokens`, `elearning_invitations`, `elearning_import_batches`, `elearning_import_rows` + index/uniques.
5. **Aucun** `DROP`, **aucun** `NOT NULL` sur colonne ajoutée à une table peuplée, **aucune** valeur par défaut coûteuse en rewrite (les `@default` enum/bool sont sûrs).

> Détail SQL + stratégie de déploiement (entrypoint `prisma migrate deploy`) dans `06-strategie-migrations.md`.

---

## 11. Checklist d'implémentation (MVP)

- [ ] Étendre `Trainee` + `PortailAcces` (colonnes §3/§4) — additif.
- [ ] Créer les 5 modèles + 6 enums (§2, §5–§7) + champs inverses `Client`/`AdminUser`.
- [ ] `pnpm prisma:generate` + migration additive ; vérifier build `stub.invalid` OK.
- [ ] `src/server/elearning/auth/learner-auth-service.ts` (réutilise `auth-password.ts`, `portail-service.ts`, `cookie.ts`, `rate-limit.ts`).
- [ ] `src/server/elearning/auth/learner-guard.ts` (`requireLearner`/`getLearnerSession`).
- [ ] Server actions `learner-account.actions.ts` + Zod schemas.
- [ ] Routes/pages portail (§8.3) — `force-dynamic`.
- [ ] Provisioning : `import.actions.ts` + workers `elearning-import-worker.ts` / `elearning-invite-worker.ts`.
- [ ] Templates email React (`elearning-invitation.tsx`, `elearning-magic-login.tsx`, `elearning-password-reset.tsx`).
- [ ] Composants UI `src/components/elearning/auth/**` + admin `src/components/admin/elearning/access/**`.
- [ ] Cron purge sessions/tokens expirés.
- [ ] Tests Vitest : timing-safe, anti-énumération, one-shot tokens, idempotence import, cohabitation NextAuth (aucun cross-read).

---

## Liens

- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-0001 (auth hybride), ADR-0002 (multi-tenant V2), ADR-0007 (cloisonnement), ADR-0008 (migrations additives).
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — `ElearningCourse` (référencé par `courseId` des invitations/imports), `Client`/`Formation` réutilisés.
- `03-DATA-MODEL/02-schema-progression-tracking.md` — `ElearningEnrollment`/`LessonProgress` (octroi d'accès matérialisé à l'acceptation d'invitation).
- `03-DATA-MODEL/06-strategie-migrations.md` — SQL additif détaillé.
- `04-BACKEND/05-authentification-apprenant.md` — implémentation du service auth, middleware, cohabitation NextAuth (détail).
- `04-BACKEND/06-import-masse-provisioning.md` — pipeline CSV, workers, idempotence.
- `06-CONSOLE-ADMIN/05-gestion-acces-entreprises.md` — UI admin d'octroi/invitation/import.
- `08-CONFORMITE/05-rgpd-conservation-preuves.md` — durées de conservation (logs, octrois, preuves OPCO).
- `02-ARCHITECTURE/multi-tenant-strategie.md` — exploitation de `ElearningOrgMembership` en V2.
