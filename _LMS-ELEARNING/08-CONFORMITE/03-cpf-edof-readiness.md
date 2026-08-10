# Conformité — CPF / EDOF readiness (gated `EDOF_ENABLED`)

> **Statut produit :** _certification-ready_, **désactivé par défaut**. Tout le socle technique CPF/EDOF est codé mais dormant derrière un flag (`EDOF_ENABLED=false`). Référence : **ADR-LMS-0003** (« CPF/RNCP certification-ready, activable plus tard »).
>
> **Décision figée :** le **CPF ne peut PAS être ouvert tant qu'Axion-IA n'a pas de certification RNCP ou RS active** (verrou **non-technique**, voir §1). Ce document décrit ce qu'il faut _techniquement_ pour qu'au jour de l'autorisation France Compétences, l'activation soit _un flag + un branchement EDOF_, pas une refonte.

---

## 0. TL;DR pour un dev senior

- **Ce qui bloque le CPF n'est PAS le code** : c'est l'absence d'une certification **RNCP** (Répertoire National des Certifications Professionnelles) ou **RS** (Répertoire Spécifique) enregistrée à France Compétences. Un e-learning non certifiant **n'est jamais éligible CPF**, quelle que soit sa qualité.
- **On construit quand même tout le faisceau de preuves CPF dès le MVP** (assiduité, progression, évaluations jalonnantes, certificat de réalisation, traces d'assistance) → ça nous rend **finançables OPCO + entreprise + vente directe immédiatement**, et **CPF-ready** le jour J.
- **L'intégration EDOF** (entrée effective, suivi assiduité au format CDC, service fait, FranceConnect+) est **écrite mais gated** par `EDOF_ENABLED`. Branchée sur l'API EDOF/Caisse des Dépôts seulement après obtention de l'autorisation.
- **L'existant fait déjà 70 % du travail** : le modèle `Formation` porte **déjà** `codeRncp`, `codeRs`, `numeroEnregistrementFc`, `certificateurNom`, `estCertificateur`, `numeroHabilitation`, `cpfEligible`, `edofVerifieAt`, `blocsCompetences` (schema.prisma ~5096-5116). `TrainingSession`, `Enrollment` et `CoachingContract` portent aussi `edofVerifieAt` / `cpfPayeurResteCharge`. On **réutilise** ces champs ; on ajoute le minimum côté e-learning.

---

## 1. Le verrou non-technique : RNCP / RS (à rappeler partout)

### 1.1 Règle réglementaire dure

Le Compte Personnel de Formation (CPF, art. L.6323-6 du Code du travail) **ne finance que** des actions **certifiantes** :

1. Certifications **RNCP** (diplômes, titres professionnels, certifications de branche) ;
2. Certifications du **Répertoire Spécifique (RS)** (compétences transversales / complémentaires : ex. une certification « usage professionnel de l'IA générative ») ;
3. Quelques cas particuliers (VAE, bilan de compétences, permis, création d'entreprise…) hors périmètre Axion-IA.

**Conséquence :** un parcours e-learning « Maîtriser l'IA au quotidien » **non rattaché à une certification RNCP/RS enregistrée** = **non éligible CPF**, point final. La modalité FOAD n'y change rien (la FOAD est _autorisée_ pour le passage de certification à distance, elle n'est pas le critère d'éligibilité).

### 1.2 Ce qu'il faut obtenir (hors code)

- Soit **déposer un dossier d'enregistrement RS** (le plus accessible pour une compétence ciblée IA) ou **RNCP** auprès de **France Compétences** → instruction longue (plusieurs mois à >1 an), avis de la Commission de la certification professionnelle.
- Soit **devenir partenaire habilité** d'un certificateur tiers déjà enregistré (mention `numeroHabilitation` + `estCertificateur=false` sur `Formation`).

Ce dossier est traité dans **`08-CONFORMITE/04-dossier-certification-rncp-rs.md`** (référentiel d'activités/compétences/évaluation, modalités à distance, anti-fraude, jury). **Rien de ce qui suit ne lève ce verrou.**

### 1.3 Garde-fou code (déjà partiellement présent)

Le repo applique déjà la règle « pas de CPF sans certification + EDOF vérifié » :

- `Formation.cpfEligible` est documenté comme **dérivé** : `certifiante RS/RNCP ou bloc + EDOF vérifié` (schema.prisma:5113).
- La page admin `qualiopi/financements/page.tsx` lève déjà une alerte **« CPF sans vérification EDOF »** (`edofVerifieAt: null`).

On étend ce garde-fou au LMS : **aucune commande / octroi d'accès e-learning ne peut être marqué `cpf` comme financeur tant que** `EDOF_ENABLED=false` **OU** que le cours n'est pas rattaché à une `Formation` certifiante. Voir §5.

---

## 2. Le flag `EDOF_ENABLED`

### 2.1 Déclaration (NEUF — à ajouter, pattern `STRIPE_ENABLED`)

On calque **exactement** le pattern de `STRIPE_ENABLED` (`src/env.ts:105` + `:350`), qui est le modèle de référence pour un interrupteur métier dormant.

**`src/env.ts`** — dans le bloc `server` du schéma Zod, à côté des flags existants :

```ts
/// Interrupteur CPF/EDOF. ABSENT/false par défaut → aucune intégration
/// Caisse des Dépôts, financeur CPF refusé au check-out e-learning.
/// `true` (+ certification RNCP/RS active sur la Formation liée + secrets
/// EDOF) → branchement EDOF : entrée effective, suivi assiduité, service fait.
/// NE PAS activer tant que France Compétences n'a pas enregistré la certif.
EDOF_ENABLED: z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1"),

/// Identifiant établissement EDOF (SIRET déclaré sur Mon Compte Formation).
EDOF_SIRET: z.string().optional(),
/// Base URL API EDOF / Caisse des Dépôts (sandbox vs prod selon environnement).
EDOF_API_BASE_URL: z.string().url().optional(),
/// Identifiant client OAuth2 EDOF (échange de jetons CDC).
EDOF_CLIENT_ID: z.string().optional(),
/// Secret client OAuth2 EDOF.
EDOF_CLIENT_SECRET: z.string().min(16).optional(),
/// Secret HMAC webhook EDOF (notifications service fait / paiement).
EDOF_WEBHOOK_SECRET: z.string().min(16).optional(),
```

Et dans `runtimeEnv` (`src/env.ts` ~340-369) :

```ts
EDOF_ENABLED: process.env.EDOF_ENABLED,
EDOF_SIRET: process.env.EDOF_SIRET,
EDOF_API_BASE_URL: process.env.EDOF_API_BASE_URL,
EDOF_CLIENT_ID: process.env.EDOF_CLIENT_ID,
EDOF_CLIENT_SECRET: process.env.EDOF_CLIENT_SECRET,
EDOF_WEBHOOK_SECRET: process.env.EDOF_WEBHOOK_SECRET,
```

> **Contrat build `stub.invalid` (ADR 0026) :** ces secrets sont **`.optional()`** → aucun blocage de la validation Zod au build GH Actions (où `SKIP_ENV_VALIDATION=true` de toute façon). L'intégration EDOF vit dans des **server actions / workers** derrière auth + `force-dynamic`, jamais au SSG → pas d'appel au build.

### 2.2 Cohérence (superRefine recommandé)

Comme pour DocuSeal et Stripe, ajouter un `superRefine` : **si `EDOF_ENABLED=true`, alors `EDOF_SIRET` + `EDOF_API_BASE_URL` + `EDOF_CLIENT_ID` + `EDOF_CLIENT_SECRET` deviennent requis** (sinon build/boot fail explicite plutôt qu'erreur runtime obscure). Le `EDOF_WEBHOOK_SECRET` requis seulement si on consomme les webhooks.

### 2.3 Helper centralisé (NEUF)

**`src/server/elearning/edof/edof-config.ts`** :

```ts
import { env } from "@/env";

/** Vrai uniquement si le flag est ON ET la config minimale présente. */
export function isEdofEnabled(): boolean {
  return (
    env.EDOF_ENABLED === true &&
    Boolean(env.EDOF_SIRET && env.EDOF_API_BASE_URL && env.EDOF_CLIENT_ID && env.EDOF_CLIENT_SECRET)
  );
}
```

Tout le code CPF/EDOF appelle `isEdofEnabled()` (jamais `env.EDOF_ENABLED` directement) → un seul point de vérité, comme `isStripeEnabled()` existant pour Stripe.

### 2.4 Activation en prod (procédure Will, post-autorisation)

Calquée sur la procédure `EN_LOCALE_ENABLED` / `STRIPE_ENABLED` (Coolify) :

1. Renseigner la certification sur la `Formation` cible (admin) : `codeRncp` **ou** `codeRs`, `numeroEnregistrementFc`, `certificateurNom`, `estCertificateur`/`numeroHabilitation`, `dateEnregistrementCertif`, `dateEcheanceCertif`, `blocsCompetences` — **champs déjà existants** (schema.prisma:5097-5112).
2. Coolify → Env vars : `EDOF_ENABLED=true` + `EDOF_SIRET` + `EDOF_API_BASE_URL` + `EDOF_CLIENT_ID` + `EDOF_CLIENT_SECRET` (+ `EDOF_WEBHOOK_SECRET`), scope **RUN** (web + worker).
3. **Redeploy** (pas un simple restart — comme la clé OpenAI, cf. MEMORY content-gen : un env runtime nouveau nécessite redeploy pour être pris par tous les process).
4. Vérifier : un cours e-learning rattaché à une `Formation` certifiante propose le financeur `cpf` au check-out ; un cours non certifiant le refuse toujours.

---

## 3. Les 4 exigences techniques EDOF (et où on les couvre)

EDOF (« Espace Des Organismes de Formation », plateforme CDC adossée à _Mon Compte Formation_) impose, au-delà du financement, un **suivi opposable** de la réalité de la formation. Loi anti-fraude **n°2022-1587** + conditions générales EDOF. Les 4 piliers :

| #   | Exigence EDOF                     | Définition opérationnelle                                                                                                                      | Couverture Axion-IA                                                                                                                                                 |
| --- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Entrée en formation effective** | La 1re **connexion réelle et substantielle** du titulaire (pas le simple octroi d'accès, pas un login vide). Déclenche le décompte.            | `ElearningEnrollment.entreeEffectiveAt` (NEUF, §4) — posée à la 1re leçon réellement consommée (heartbeat player).                                                  |
| 2   | **Suivi de l'assiduité**          | Traces horodatées de progression (temps passé, leçons complétées, quiz réussis), exportables.                                                  | `LessonProgress` + `LessonWatchSession` (cf. doc 02) + agrégat `EdofAssiduiteSnapshot` (NEUF).                                                                      |
| 3   | **Service fait**                  | Déclaration à la CDC que la prestation est réalisée → ~3 j d'instruction → paiement CDC ~30 j.                                                 | `edof-service-fait-worker.ts` (NEUF) + `EdofDeclaration` (NEUF). Gated.                                                                                             |
| 4   | **FranceConnect+**                | Authentification renforcée du titulaire CPF (identité certifiée, anti-fraude). **Obligatoire** côté Mon Compte Formation pour la souscription. | Hors LMS direct (souscription se fait sur moncompteformation.gouv.fr) ; côté LMS = corrélation `EdofDossier.identifiantDossier` + vérif identité à l'entrée (§4.4). |

> **Point clé :** pour les parcours **OPCO / entreprise / vente directe** (le MVP), **aucun de ces 4 piliers EDOF n'est requis pour être payé** : l'OPCO paie sur **facture + relevé de dépenses + certificat de réalisation** (cf. `02-qualiopi-indicateurs-foad.md`). Les piliers EDOF ne s'activent que pour le **canal CPF**. C'est pourquoi tout est gated : on ne pollue pas le flux OPCO/B2B avec des contraintes CPF.

---

## 4. Data model CPF/EDOF (NEUF, additif — ADR-0008)

> Toutes les tables/colonnes ci-dessous sont **gated en usage** par `isEdofEnabled()` : elles existent en base dès le MVP (pour ne pas avoir à migrer plus tard), mais **rien n'écrit dedans tant que le flag est OFF**. Migrations strictement additives (CREATE TABLE / ADD COLUMN nullable).

### 4.1 Champs ajoutés à `ElearningEnrollment` (cf. doc 02 — additif)

```prisma
// model ElearningEnrollment { ... }  (défini dans 03-DATA-MODEL/02-...)

  // ── CPF / EDOF (gated EDOF_ENABLED) ───────────────────────────────
  /// 1re connexion RÉELLE et substantielle (pas l'octroi). Pilier EDOF #1.
  entreeEffectiveAt   DateTime?  @map("entree_effective_at")
  /// Financeur de CET accès. Réutilise la sémantique FinancementType existante.
  /// `cpf` REFUSÉ à l'écriture si !isEdofEnabled() OU cours non certifiant.
  financementType     FinancementType?  @map("financement_type")
  /// Dossier CPF rattaché (1 dossier EDOF = 1 souscription titulaire).
  edofDossierId       String?    @map("edof_dossier_id") @db.Uuid
  edofDossier         EdofDossier?  @relation(fields: [edofDossierId], references: [id], onDelete: SetNull)
```

> **Réutilisation :** `FinancementType` (enum déjà en schéma, valeurs `direct | opco | cpf | france_travail` cf. schema.prisma:4951, ~5020/5046) — **on ne crée pas un nouvel enum**.

### 4.2 `EdofDossier` (NEUF) — 1 souscription CPF d'un titulaire

```prisma
/// Dossier CPF/EDOF d'un titulaire pour un parcours e-learning certifiant.
/// Gated EDOF_ENABLED : aucune ligne créée tant que le flag est OFF.
model EdofDossier {
  id                 String      @id @default(uuid()) @db.Uuid

  /// Identifiant dossier renvoyé par EDOF/CDC (clé de corrélation).
  identifiantDossier String      @unique @map("identifiant_dossier") @db.VarChar(64)

  /// Apprenant (réutilise Trainee existant — PII chiffrée déjà gérée).
  traineeId          String      @map("trainee_id") @db.Uuid
  trainee            Trainee     @relation(fields: [traineeId], references: [id], onDelete: Restrict)

  /// Cours e-learning concerné.
  courseId           String      @map("course_id") @db.Uuid
  course             ElearningCourse @relation(fields: [courseId], references: [id], onDelete: Restrict)

  /// Formation certifiante porteuse de la certif RNCP/RS (source de cpfEligible).
  formationId        String?     @map("formation_id") @db.Uuid
  formation          Formation?  @relation(fields: [formationId], references: [id], onDelete: SetNull)

  statut             EdofDossierStatut @default(valide)

  /// Identité vérifiée via FranceConnect+ côté Mon Compte Formation (pilier #4).
  /// On ne stocke PAS les données FC+ ; juste l'attestation de corrélation.
  identiteVerifieeAt DateTime?   @map("identite_verifiee_at")

  /// Montant CPF mobilisé (centimes) + reste à charge.
  montantCpfCents    Int?        @map("montant_cpf_cents")
  resteAChargeCents  Int?        @map("reste_a_charge_cents")
  /// Payeur du reste à charge (sémantique cpfPayeurResteCharge existante).
  payeurResteCharge  String?     @map("payeur_reste_charge") @db.VarChar(40)

  enrollments        ElearningEnrollment[]
  declarations       EdofDeclaration[]

  createdAt          DateTime    @default(now()) @map("created_at")
  updatedAt          DateTime    @updatedAt @map("updated_at")

  @@index([traineeId])
  @@index([courseId])
  @@index([statut])
  @@map("edof_dossiers")
}

enum EdofDossierStatut {
  valide        // souscription acceptée, en attente d'entrée effective
  en_cours      // entrée effective constatée, formation en cours
  termine       // parcours terminé, prêt pour service fait
  service_fait  // service fait déclaré à la CDC
  paye          // paiement CDC reçu
  annule        // abandon / annulation titulaire
  refuse        // refus CDC
}
```

### 4.3 `EdofDeclaration` (NEUF) — journal opposable des échanges CDC

```prisma
/// Journal horodaté des déclarations/échanges avec EDOF/CDC pour un dossier.
/// Sert de PREUVE opposable (loi anti-fraude 2022-1587) + observabilité.
model EdofDeclaration {
  id            String   @id @default(uuid()) @db.Uuid
  dossierId     String   @map("dossier_id") @db.Uuid
  dossier       EdofDossier @relation(fields: [dossierId], references: [id], onDelete: Cascade)

  type          EdofDeclarationType
  /// Payload envoyé/reçu (snapshot), pour rejeu et audit.
  payloadJson   Json     @default("{}") @map("payload_json")
  /// Réponse CDC (code + message) si applicable.
  reponseCode   String?  @map("reponse_code") @db.VarChar(40)
  reponseJson   Json?    @map("reponse_json")
  okStatut      Boolean  @default(false) @map("ok_statut")

  createdAt     DateTime @default(now()) @map("created_at")

  @@index([dossierId, type])
  @@map("edof_declarations")
}

enum EdofDeclarationType {
  entree_effective   // pilier #1 : déclaration d'entrée
  assiduite          // pilier #2 : remontée périodique d'assiduité
  service_fait       // pilier #3 : déclaration service fait
  paiement_recu      // webhook paiement CDC
  annulation
}
```

### 4.4 `EdofAssiduiteSnapshot` (NEUF) — agrégat assiduité exportable (pilier #2)

```prisma
/// Photographie périodique de l'assiduité d'un dossier CPF (pour remontée EDOF
/// ET preuve FOAD R.6313-3 si contrôle). Calculé par cron à partir de
/// LessonProgress / LessonWatchSession (doc 02). Immuable (snapshot daté).
model EdofAssiduiteSnapshot {
  id               String   @id @default(uuid()) @db.Uuid
  dossierId        String   @map("dossier_id") @db.Uuid
  dossier          EdofDossier @relation(fields: [dossierId], references: [id], onDelete: Cascade)

  /// Période couverte.
  periodeDebut     DateTime @map("periode_debut")
  periodeFin       DateTime @map("periode_fin")

  /// Temps de connexion effectif (secondes), basé sur watch sessions serveur.
  tempsConnexionSec Int     @default(0) @map("temps_connexion_sec")
  /// Leçons complétées / total à date.
  lessonsCompletees Int     @default(0) @map("lessons_completees")
  lessonsTotal      Int     @default(0) @map("lessons_total")
  /// Progression % et score moyen quiz.
  progressionPct    Int     @default(0) @map("progression_pct")
  scoreMoyenPct     Int?    @map("score_moyen_pct")

  createdAt        DateTime @default(now()) @map("created_at")

  @@index([dossierId, periodeFin])
  @@map("edof_assiduite_snapshots")
}
```

> **Relation inverse à ajouter** (additif, sans colonne) : `EdofDossier { assiduiteSnapshots EdofAssiduiteSnapshot[] }`, `Trainee { edofDossiers EdofDossier[] }`, `ElearningCourse { edofDossiers EdofDossier[] }`, `Formation { edofDossiers EdofDossier[] }`.

> **Conservation / RGPD :** ces tables tombent sous les durées du doc `05-rgpd-conservation-preuves.md` (10 ans comptable, 6 ans fiscal/OPCO, 3-5 ans preuves réalisation L.6362-6). `EdofAssiduiteSnapshot` = preuve de réalisation → conservation **≥ 3 ans** ; ne PAS purger avec les logs techniques courts (6 mois-1 an).

---

## 5. Garde-fous applicatifs (cœur du « gated »)

### 5.1 Refus du financeur `cpf` (server action octroi/commande)

Dans la server action d'octroi d'accès e-learning (`src/server/elearning/access/grant-access.ts`, NEUF — cf. `06-import-masse-provisioning`) **et** dans le check-out commande (`Order`, cf. `05-schema-ecommerce-commandes`), on insère un garde-fou unique :

```ts
import { isEdofEnabled } from "@/server/elearning/edof/edof-config";

function assertCpfAllowed(course: ElearningCourse, formation: Formation | null) {
  if (financementType !== "cpf") return; // OPCO/direct/france_travail : OK MVP
  if (!isEdofEnabled()) {
    throw new ElearningError(
      "CPF_DISABLED",
      "Financement CPF indisponible : EDOF non activé (certification requise).",
    );
  }
  if (!formation?.cpfEligible) {
    throw new ElearningError(
      "CPF_NOT_CERTIFIED",
      "Ce cours n'est pas rattaché à une certification RNCP/RS active.",
    );
  }
}
```

**Effet MVP :** `cpf` est toujours refusé (flag OFF) → aucun risque de vendre/financer en CPF illégalement. **Effet post-activation :** `cpf` autorisé uniquement sur les cours adossés à une `Formation.cpfEligible=true`.

### 5.2 Dérivation de `cpfEligible` (réutilise l'existant)

`Formation.cpfEligible` reste **dérivé** (jamais saisi à la main) : `true` ssi `(codeRncp || codeRs)` **renseigné ET** dans sa fenêtre de validité (`dateEnregistrementCertif <= now <= dateEcheanceCertif`) **ET** `edofVerifieAt != null`. Cette dérivation existe déjà côté Qualiopi (page `financements`) — on l'**extrait en helper réutilisable** `src/server/qualiopi/certification/cpf-eligibility.ts` (s'il n'existe pas déjà) consommé par les deux mondes (formation classique + e-learning), pour ne pas dupliquer la règle.

### 5.3 UI admin : badge état CPF

Dans la section admin e-learning, afficher pour chaque cours un badge `<AdminBadge>` :

- gris **« CPF non éligible »** si pas de certif ;
- orange **« CPF prêt — EDOF désactivé »** si certif OK mais `EDOF_ENABLED=false` ;
- vert **« CPF actif »** si flag ON + certif OK.

---

## 6. Workers & API EDOF (NEUF, gated, à ne brancher qu'à l'activation)

Tous sous `src/server/queue/workers/elearning-*-worker.ts` (cloisonnement ADR-0007). Chaque worker **no-op immédiat** si `!isEdofEnabled()`.

| Worker / cron                                         | Rôle                                                                                                                                                 | Déclencheur                                                                                            | Pilier EDOF |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------- |
| `elearning-edof-entree-worker.ts`                     | Détecte la 1re leçon réellement consommée → pose `ElearningEnrollment.entreeEffectiveAt` + crée `EdofDeclaration{entree_effective}` + appel API EDOF | Émis par le heartbeat player (1re `LessonWatchSession` substantielle, ex. ≥ 60 s ou 1 leçon complétée) | #1          |
| `elearning-edof-assiduite-worker.ts` (cron quotidien) | Calcule `EdofAssiduiteSnapshot` par dossier `en_cours` + remonte à EDOF                                                                              | Cron (réutilise l'infra crons BullMQ existante)                                                        | #2          |
| `elearning-edof-service-fait-worker.ts`               | À la complétion du parcours (certificat émis) → déclare le service fait à la CDC, passe `EdofDossier.statut=service_fait`                            | Émis par l'événement « certificat e-learning généré »                                                  | #3          |
| webhook `src/app/api/elearning/edof/webhook/route.ts` | Reçoit notifications CDC (paiement, refus), HMAC `EDOF_WEBHOOK_SECRET`, idempotent                                                                   | Entrant CDC                                                                                            | #3/#4       |

**Client API** : `src/server/elearning/edof/edof-client.ts` (OAuth2 client-credentials avec `EDOF_CLIENT_ID/SECRET`, base `EDOF_API_BASE_URL`). En mode flag OFF, le client n'est jamais instancié. Pattern stub-aware non nécessaire (jamais appelé au build SSG car derrière auth/worker).

> **Branchement API réel :** les endpoints/format exacts EDOF/CDC ne sont **pas figés ici** (sandbox CDC requise, obtenue à l'autorisation). Le `EdofDeclaration.payloadJson` capture le contrat réel au moment du branchement. Tant que le flag est OFF, ces workers sont du **squelette testé en unit (mock)**, jamais exécuté en prod.

---

## 7. Réutilisation de l'existant (anti-duplication)

| Besoin CPF/EDOF                                   | Brique existante réutilisée                                  | Emplacement                                                                               |
| ------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Identité apprenant + PII chiffrée + consentements | `Trainee` (handicap chiffré, `consentement*`)                | schema.prisma:5274                                                                        |
| Certif RNCP/RS, EDOF vérifié, blocs compétences   | **champs déjà présents** sur `Formation`                     | schema.prisma:5096-5116                                                                   |
| Sémantique financeur                              | enum `FinancementType` (`direct\|opco\|cpf\|france_travail`) | schema.prisma:4951                                                                        |
| Reste à charge CPF                                | `cpfPayeurResteCharge` (pattern existant)                    | schema.prisma:5187                                                                        |
| Certificat de réalisation (heures centièmes, QR)  | `DocumentGenere` + `CertificatRealisationPdf`                | schema.prisma:5507 ; `src/server/qualiopi/documents/templates/certificat-realisation.tsx` |
| Alerte « CPF sans EDOF »                          | page financements existante (à étendre au LMS)               | `.../qualiopi/financements/page.tsx`                                                      |
| Pattern flag dormant                              | `STRIPE_ENABLED` (env + `isStripeEnabled`)                   | `src/env.ts:105,350`                                                                      |
| Infra workers/crons                               | BullMQ existant                                              | `src/server/queue/**`                                                                     |
| Stockage preuves PDF                              | R2 (`uploadToR2`/`getSignedUrlR2`)                           | `src/lib/r2-storage.ts`                                                                   |

**Neuf strictement nécessaire :** flag `EDOF_ENABLED` + secrets, `edof-config.ts`, `EdofDossier`/`EdofDeclaration`/`EdofAssiduiteSnapshot` + enums, 3 workers + webhook + client EDOF, garde-fous `assertCpfAllowed`, badge admin. Tout dormant au MVP.

---

## 8. Ce qui se passe AU MVP vs APRÈS activation

**MVP (`EDOF_ENABLED=false`) — livré, conforme, finançable hors CPF :**

- Tables EDOF créées (migration additive) mais vides.
- Financeur `cpf` **refusé** au check-out / octroi → zéro risque réglementaire.
- Tout le **faisceau de preuves** est néanmoins produit (assiduité via `LessonProgress`/watch, évaluations jalonnantes via le moteur de quiz, certificat de réalisation, traces d'assistance Ind.19) → **OPCO + entreprise + vente directe** payables immédiatement.

**Après autorisation France Compétences + `EDOF_ENABLED=true` :**

- `cpf` autorisé sur les cours adossés à une `Formation.cpfEligible=true`.
- Entrée effective / assiduité / service fait remontent à la CDC via les workers.
- FranceConnect+ : souscription reste sur moncompteformation.gouv.fr ; le LMS corrèle via `EdofDossier.identifiantDossier` + `identiteVerifieeAt`.
- **Aucune refonte** : flag + secrets + renseignement certif sur la `Formation`.

---

## 9. Checklist d'activation (jour J)

1. [ ] Certification RNCP/RS enregistrée à France Compétences (hors code — doc 04).
2. [ ] `Formation` cible renseignée : `codeRncp`/`codeRs`, `numeroEnregistrementFc`, certificateur/habilitation, dates, `blocsCompetences`.
3. [ ] `edofVerifieAt` posé (compte EDOF actif côté CDC) → `cpfEligible` dérivé `true`.
4. [ ] Sandbox CDC obtenue → endpoints/format confirmés → `EdofDeclaration.payloadJson` aligné, `edof-client.ts` finalisé.
5. [ ] Secrets Coolify (scope RUN web+worker) : poser `EDOF_ENABLED` a true, puis `EDOF_SIRET`, `EDOF_API_BASE_URL`, `EDOF_CLIENT_ID`, `EDOF_CLIENT_SECRET` et la cle webhook. (Noms de variables uniquement, jamais de valeur dans un document.)
6. [ ] **Redeploy** (pas restart).
7. [ ] Smoke-test : entrée effective déclenchée à la 1re leçon ; snapshot assiduité quotidien ; service fait à la complétion ; webhook paiement reçu.
8. [ ] Vérifier conservation/RGPD des nouvelles preuves (doc 05).

---

## Liens

- `00-INDEX/DECISIONS-ARBITRAGES.md` — **ADR-LMS-0003** (CPF/RNCP certification-ready) + ADR-0004 (Stripe gated, même pattern) + ADR-0008 (migrations additives).
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — `ElearningCourse` (champ `formationId` vers la `Formation` certifiante, `estFoad`, `seuilReussitePct`).
- `03-DATA-MODEL/02-schema-progression-tracking.md` — `ElearningEnrollment`, `LessonProgress`, `LessonWatchSession` (source de l'assiduité EDOF pilier #2).
- `03-DATA-MODEL/03-schema-quiz-evaluations.md` — évaluations jalonnantes (preuve FOAD + base score certificat).
- `03-DATA-MODEL/05-schema-ecommerce-commandes.md` — `Order` + garde-fou `assertCpfAllowed` au check-out.
- `03-DATA-MODEL/06-strategie-migrations.md` — migrations additives EDOF.
- `04-BACKEND/06-import-masse-provisioning.md` — octroi d'accès (`grant-access.ts`) + garde-fou financeur.
- `08-CONFORMITE/01-foad-d6313-3-1.md` — 3 conditions FOAD (assistance, info durée, évaluations).
- `08-CONFORMITE/02-qualiopi-indicateurs-foad.md` — preuves payables OPCO/B2B (le canal qui marche sans CPF).
- `08-CONFORMITE/04-dossier-certification-rncp-rs.md` — **le vrai verrou** : dossier France Compétences (hors code).
- `08-CONFORMITE/05-rgpd-conservation-preuves.md` — durées de conservation des tables EDOF.
- `08-CONFORMITE/06-tracabilite-preuves-realisation.md` — faisceau de preuves R.6313-3.
- `11-ROADMAP/01-phasage-mvp-v1-v2.md` — CPF/EDOF positionné en **V2** (activation post-autorisation).
