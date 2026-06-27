# Certificats & badges apprenant (e-learning / FOAD)

Spécification de bout en bout pour **ce que l'apprenant obtient à la fin** d'un cours e-learning : le **certificat de réalisation** (modèle officiel, heures réalisées, QR de vérification), l'**attestation de suivi/fin de formation** (et sa variante partielle), des **badges optionnels** (motivation, opt-in), et la **page de vérification publique**.

Le principe directeur est la **réutilisation maximale** du pipeline Qualiopi existant (`DocumentGenere` + `qrToken` + `generateDocument` + React-PDF + R2 + page `/verifier-attestation/[token]`). On n'invente **aucun** nouveau système de génération de PDF, de numérotation ou de vérification : on **branche le LMS dessus**.

> ⚠️ **Distinction réglementaire majeure, à marteler dans tout le produit** (voir §1) : un **certificat de réalisation** n'est **pas** une **certification RNCP/RS**. Le premier prouve qu'une action de formation a eu lieu (heures réalisées) ; le second atteste d'une compétence reconnue par France Compétences et conditionne l'éligibilité CPF. **Le MVP ne produit que des certificats de réalisation et attestations.** La certification RNCP/RS est hors code (ADR-LMS-0003).

**Conventions respectées** : code sous `src/server/elearning/**`, `src/components/elearning/**`, worker `elearning-certificat-worker.ts` (ADR-LMS-0007) ; migrations **strictement additives** (ADR-LMS-0008) ; FK vers l'existant en `@db.Uuid`, FK vers les modèles LMS en `String` text (cf. doc 03-DATA-MODEL/02 §0) ; FR canonique (EN désactivé) ; `force-dynamic` sur tout ce qui touche la DB (contrat build `stub.invalid`).

---

## 1. Les trois objets — distinction stricte (à afficher à l'apprenant ET à l'admin)

| Objet                                          | Ce qu'il prouve                                                                                                                                                       | Base légale                       | Statut MVP                  | Délivré par                                |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | --------------------------- | ------------------------------------------ |
| **Certificat de réalisation**                  | Que l'action de formation a été **réalisée** : intitulé, dates, **durée réalisée en heures (centièmes)**. Obligatoire depuis le 01/06/2020 (modèle officiel).         | `R.6313-3` + arrêté du 21/12/2018 | ✅ **Produit**              | Axion-IA (OF)                              |
| **Attestation de fin de formation / de suivi** | Que l'apprenant a **suivi** la formation et **acquis** (ou partiellement) les objectifs pédagogiques.                                                                 | `L.6353-1` + `D.6353-1`           | ✅ **Produit**              | Axion-IA (OF)                              |
| **Badge** (optionnel)                          | Reconnaissance **non réglementaire** de motivation / micro-accomplissement (« Module 1 terminé », « Score parfait au quiz »). Aucune valeur légale ni de financement. | — (interne)                       | ✅ **Produit**, opt-in      | Axion-IA (interne)                         |
| **Certification RNCP/RS**                      | Une **compétence professionnelle reconnue** par France Compétences (condition CPF).                                                                                   | RNCP/RS, France Compétences       | ❌ **Hors MVP / hors code** | Certificateur (dossier France Compétences) |

**Règle produit non négociable** : nulle part dans l'UI apprenant, dans un PDF, dans un email ou un badge, on n'emploie les mots « certification », « diplôme », « titre », « CPF éligible » ou « RNCP » pour un cours non certifiant. Le wording autorisé est : « certificat de réalisation », « attestation de fin de formation », « badge ». Cette contrainte est vérifiée par un test (cf. §11) qui scanne les libellés contre une liste de termes interdits — réutilise l'esprit du garde-fou `banned-phrases` déjà en place côté content-gen.

**Conditions d'obtention (qui débloque quoi)** — récapitulatif, détail en §3 :

```
Complétion (100 % des leçons obligatoires terminées)        ─┐
        + réussite (CourseProgress.scoreGlobalPct ≥           ├─► Certificat de réalisation
          ElearningCourse.seuilReussitePct, défaut 70 %)     ─┘   + Attestation (complète)

Complétion sans réussite (score < seuil)                     ──► Attestation partielle (option)
                                                                 (PAS de certificat de réussite ;
                                                                  un certificat de réalisation
                                                                  « heures réalisées » reste
                                                                  émissible si l'OF le décide)

Jalon configuré (module terminé, quiz parfait, série…)       ──► Badge (si activé sur le cours)
```

---

## 2. EXISTANT réutilisé (ne rien réécrire)

| Brique                                                                                                                                                                           | Emplacement réel                                                                       | Réutilisation e-learning                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DocumentGenere` (PK `@db.Uuid`, `numero` immuable, `hashSha256`, `pdfUrl` signé, `qrToken` unique, `suppressionPrevueAt` = +5 ans)                                              | `prisma/schema.prisma:5507`                                                            | **Le** modèle de stockage des certificats/attestations e-learning. Aucune nouvelle table de document.                                                                            |
| `DocumentType` enum (`certificat_realisation`, `attestation`, `attestation_partielle`, …)                                                                                        | `prisma/schema.prisma:5481`                                                            | Réutilisés **tels quels** pour l'e-learning (pas de nouvelle valeur d'enum nécessaire). Le contexte FOAD est porté par `DocumentGenere.metadata` (§4).                           |
| `generateDocument(input)` — alloue le numéro séquentiel (`AXI-CERT-YYYY-NNN` / `AXI-ATT-…`), rend le PDF, upload R2, crée la ligne DB, audit log, retry P2002 ; **stub-aware**   | `src/server/qualiopi/documents/documents-service.ts`                                   | Point d'entrée unique pour produire le PDF + la ligne DB. On l'appelle depuis le service e-learning.                                                                             |
| `makeQrToken()` (32 bytes → 64 hex), `qrDataUrl(text)` (PNG base64), `verifyQrToken(a,b)` (timing-safe)                                                                          | `src/server/qualiopi/documents/qr.ts`                                                  | Génération + vérif du token QR, **identiques** aux certificats Qualiopi.                                                                                                         |
| `CertificatRealisationPdf` (template React-PDF, durée en **centièmes** via `formatHeuresCentiemes`, bloc QR, signature)                                                          | `src/server/qualiopi/documents/templates/certificat-realisation.tsx`                   | **Base** du certificat e-learning. On crée une variante FOAD qui réutilise `QualiopiPage`/`DocSection`/`FieldRow`/`pdfStyles` + ajoute les mentions FOAD (§5).                   |
| `AttestationPdf` / `AttestationPartiellePdf`                                                                                                                                     | `src/server/qualiopi/documents/templates/attestation.tsx`, `attestation-partielle.tsx` | Réutilisées pour l'attestation e-learning (objectifs pédagogiques acquis).                                                                                                       |
| `LEGAL_MENTIONS.certificatRealisation` / `.attestation`, `formatHeuresCentiemes`, `DOCUMENT_RETENTION_YEARS = 5`                                                                 | `src/server/qualiopi/legal/legal-mentions.ts`                                          | Mentions légales **exactes** réutilisées (jamais réécrites).                                                                                                                     |
| Page de vérification publique `/{locale}/verifier-attestation/[token]` (server component, `force-dynamic`, `robots: noindex`, masque le nom → « Prénom + initiale », stub-aware) | `src/app/[locale]/verifier-attestation/[token]/page.tsx`                               | **Réutilisée telle quelle** pour les certificats e-learning (même `qrToken` → même page). Étendue marginalement pour afficher le cours e-learning + les badges vérifiables (§7). |
| R2 (`uploadToR2`, `getSignedUrlR2`, `getObjectBufferR2`)                                                                                                                         | `src/lib/r2-storage.ts`                                                                | Stockage PDF (via `generateDocument`) + génération de l'image de badge si on en stocke une (§6).                                                                                 |
| `ElearningEnrollment.certificatDocumentId` / `certificatEmisAt` + relation `"ElearningCertificat"` vers `DocumentGenere`                                                         | doc `03-DATA-MODEL/02` §3                                                              | **Déjà prévu** : le certificat e-learning se rattache ici.                                                                                                                       |
| `elearning-certificat-worker.ts` (mentionné doc 02 §9)                                                                                                                           | `src/server/queue/workers/` (à créer)                                                  | Worker d'émission asynchrone du certificat à la complétion+réussite.                                                                                                             |
| `completion-service.ts` (décide complétion + réussite, déclenche l'émission)                                                                                                     | `src/server/elearning/progress/completion-service.ts` (doc 02 §8)                      | Déclencheur amont.                                                                                                                                                               |
| Emails Nodemailer + React Email + `email-worker`                                                                                                                                 | `src/lib/email/**`, `src/server/queue/workers/email-worker.ts`                         | Email « votre certificat est disponible » (§8), sur le modèle de `qualiopi-attestation-disponible.tsx`.                                                                          |
| Portail apprenant `/portail/mon-espace` (cookie `PortailAcces` HttpOnly 90j)                                                                                                     | `src/app/[locale]/portail/mon-espace/page.tsx`                                         | Endroit où l'apprenant **télécharge** son certificat / voit ses badges (§9).                                                                                                     |

**Conséquence directe** : le « cœur » certificat de réalisation existe déjà et est rodé (utilisé par les sessions présentielles/live et le 1-to-1 AFEST). Le travail e-learning = (a) un **service d'orchestration** qui calcule les bonnes données FOAD et appelle `generateDocument`, (b) un **template PDF FOAD**, (c) le **système de badges** (neuf), (d) le **branchement UI** (portail + page de vérif).

---

## 3. Conditions d'émission (logique métier) — NEUF

Le déclencheur vient de `completion-service.ts` (doc 02 §8) : à chaque recalcul d'agrégat, quand un cours bascule complété **et** réussi, on enfile un job d'émission.

```
recordLessonProgress / submitQuizAttempt
        └─► completion-service.evaluateCourseCompletion(enrollmentId)
                 ├─ complétion = (CourseProgress.lecconsTerminees == lecconsTotal des leçons obligatoires)
                 ├─ réussite   = (CourseProgress.scoreGlobalPct >= ElearningCourse.seuilReussitePct)
                 ├─ jalons FOAD = CourseProgress.evaluationFinaleFaite == true   (Ind.11 majeur)
                 └─ si (complétion && réussite && jalons) && certificatDocumentId == null :
                        enqueue("elearning-certificat", { enrollmentId, kind: "certificat_realisation" })
```

**Idempotence (critique)** : le job ne ré-émet jamais si `ElearningEnrollment.certificatDocumentId` est déjà renseigné. La garde se fait **dans une transaction** : `SELECT … FOR UPDATE`-équivalent via un `update` conditionnel (`where: { id, certificatDocumentId: null }`) avant de lancer `generateDocument`, pour éviter une double émission en cas de double déclenchement (heartbeat + rollup nocturne).

**Conditions, par objet** :

- **Certificat de réalisation** : complétion 100 % des leçons **obligatoires** (`ElearningLesson.obligatoire = true`) **+** réussite (`scoreGlobalPct ≥ seuilReussitePct`) **+** `evaluationFinaleFaite` (jalon Ind.11). C'est l'objet « finançable » de référence.
- **Attestation de fin de formation** : émise **avec** le certificat de réalisation (cas « complète », objectifs acquis). Réutilise `AttestationPdf`.
- **Attestation partielle** : si l'OF active le mode « émission partielle » et que l'apprenant a complété sans atteindre le seuil de réussite → `AttestationPartiellePdf`. Décision configurable par cours (champ `ElearningCourse` `certificatAttestationPartielleActive`, §4).
- **Badge** : évalué par `badge-service` à chaque mutation de progression/quiz, indépendamment du certificat (un badge « Module 1 terminé » s'octroie bien avant la fin du cours).

**Override admin** : depuis la console (`06-CONSOLE-ADMIN/07-gestion-certificats.md`), un admin `requireAdminPublish` peut **forcer l'émission** d'un certificat (cas litigieux, complétion manuelle), ou **révoquer** un certificat émis par erreur (cf. §10). Toute action est tracée (`ActivityLog`, comme `generateDocument` le fait déjà).

---

## 4. Données — additifs (migrations purement additives)

Aucun nouveau modèle de **document** (on réutilise `DocumentGenere`). On ajoute : (a) quelques colonnes nullable au cours pour configurer la délivrance, (b) deux tables pour les **badges**, (c) un usage de `DocumentGenere.metadata` pour le contexte FOAD.

### 4.1 Colonnes additives sur `ElearningCourse` (doc 01)

```prisma
// model ElearningCourse { ... }  (AJOUTS nullable — additif)

  /// Active l'émission d'une attestation partielle si complétion sans réussite.
  certificatAttestationPartielleActive Boolean @default(false) @map("certif_attestation_partielle_active")
  /// Texte libre additionnel imprimé sur le certificat (ex. compétences clés, mention promo).
  certificatMentionLibre   String?  @map("certif_mention_libre") @db.VarChar(500)
  /// Active le système de badges sur ce cours (opt-in, best practice anti-gamification subie).
  badgesActives            Boolean  @default(false) @map("badges_actives")
```

> `seuilReussitePct` existe déjà sur `ElearningCourse` (doc 01, défaut 70). `estFoad` existe déjà (défaut true). On ne les redéclare pas.

### 4.2 `DocumentGenere.metadata` — contexte FOAD du certificat e-learning

Pas de colonne neuve : on stocke le contexte FOAD dans le JSON `metadata` existant (déjà `@default("{}")`), ce qui évite toute migration sur la table critique des documents.

```jsonc
// DocumentGenere.metadata pour un certificat de réalisation e-learning :
{
  "source": "elearning",
  "courseId": "…",
  "courseSlug": "…",
  "elearningEnrollmentId": "…",
  "modalite": "foad", // distanciel asynchrone (FOAD)
  "dureeEstimeeMinutes": 480, // durée moyenne de l'action (D.6313-3-1 §2)
  "tempsReelActifSec": 401520, // Σ tempsPasseSec (preuve d'assiduité réelle)
  "scoreGlobalPct": 86, // score de réussite (≥ seuil)
  "premiereConnexionAt": "…", // entrée effective FOAD/EDOF
  "completedAt": "…",
  "evaluationFinaleFaite": true, // jalon Ind.11
}
```

### 4.3 Tables de badges (NEUF)

`ElearningBadge` = **définition** (catalogue de badges réutilisables) ; `ElearningBadgeAward` = **attribution** à un apprenant (le « gagné le … »).

```prisma
/// Critère d'octroi d'un badge (déterministe, calculé serveur).
enum ElearningBadgeCritere {
  module_termine        // un module précis terminé (cf. moduleId du critère)
  cours_termine         // cours complété (sans condition de score)
  cours_reussi          // cours complété + réussite (≥ seuil)
  quiz_parfait          // 100 % à un quiz précis
  score_min             // score global ≥ seuil paramétré
  premiere_lecon        // a démarré (onboarding / engagement)
  assiduite             // N leçons terminées dans une fenêtre (anti-décrochage)
}

/// Définition d'un badge (catalogue). Visuel = emoji/icône + couleur OU image R2.
model ElearningBadge {
  id           String                @id @default(uuid())
  slug         String                @unique @db.Citext
  libelle      String                @db.VarChar(120)
  description  String?               @db.VarChar(300)
  critere      ElearningBadgeCritere
  /// Cours concerné (null = badge transverse, ex. "Premier pas"). PK LMS = text.
  courseId     String?               @map("course_id")
  course       ElearningCourse?      @relation(fields: [courseId], references: [id], onDelete: Cascade)
  /// Paramètres du critère (moduleId, quizId, scoreMin, fenêtre jours…). Souple.
  critereParams Json                 @default("{}") @map("critere_params")
  /// Visuel : icône (nom lucide/emoji) + couleur token, OU image R2 (badge "open badge-like").
  icone        String?               @db.VarChar(60)
  couleur      String?               @db.VarChar(20)
  imageR2Key   String?               @map("image_r2_key")
  actif        Boolean               @default(true)
  ordre        Int                   @default(0)
  createdAt    DateTime              @default(now()) @map("created_at")
  updatedAt    DateTime              @updatedAt @map("updated_at")

  awards       ElearningBadgeAward[]

  @@index([courseId])
  @@index([critere])
  @@map("elearning_badges")
}

/// Attribution d'un badge à un apprenant (Trainee). Vérifiable publiquement.
model ElearningBadgeAward {
  id           String              @id @default(uuid())
  badgeId      String              @map("badge_id")
  badge        ElearningBadge      @relation(fields: [badgeId], references: [id], onDelete: Cascade)
  /// Apprenant — réutilise Trainee (PAS de nouvelle table apprenant). @db.Uuid.
  traineeId    String              @map("trainee_id") @db.Uuid
  trainee      Trainee             @relation("TraineeBadgeAwards", fields: [traineeId], references: [id], onDelete: Cascade)
  /// Accès e-learning d'origine (contexte). PK LMS = text.
  enrollmentId String?             @map("enrollment_id")
  /// Token de vérification publique (même esprit que qrToken — 64 hex, non-guessable).
  verifToken   String              @unique @map("verif_token") @db.VarChar(64)
  awardedAt    DateTime            @default(now()) @map("awarded_at")
  /// Révocation (ex. octroi par erreur). On NE supprime PAS (traçabilité), on marque.
  revokedAt    DateTime?           @map("revoked_at")
  revokedRaison String?            @map("revoked_raison") @db.VarChar(300)
  metadata     Json                @default("{}")
  createdAt    DateTime            @default(now()) @map("created_at")

  @@unique([badgeId, traineeId], map: "badge_award_unique")  // un badge donné une seule fois par apprenant
  @@index([traineeId])
  @@index([badgeId])
  @@map("elearning_badge_awards")
}
```

**Champs inverses additifs** (relations sans colonne — zéro risque) :

```prisma
// model Trainee { ... }
  badgeAwards ElearningBadgeAward[] @relation("TraineeBadgeAwards")

// model ElearningCourse { ... }
  badges ElearningBadge[]
```

> **Open Badges (future-proof, pas MVP)** : le couple `ElearningBadge`/`ElearningBadgeAward` + `verifToken` est compatible avec une **émission Open Badges v3** ultérieure (un endpoint d'assertion JSON-LD signé). On ne l'implémente pas au MVP, mais le modèle ne nous bloque pas (aligné sur l'esprit ADR-LMS-0006 « modéliser future-proof, livrer minimal »).

---

## 5. Le certificat de réalisation FOAD — calcul des données

Le point délicat du FOAD : **quelle « durée réalisée » imprimer** ? Le certificat officiel exige les **heures réalisées** de l'action. En asynchrone, on retient :

- **Durée de l'action = `ElearningCourse.dureeEstimeeMinutes`** (la « durée moyenne » communiquée et exigée par D.6313-3-1 §2), convertie en heures décimales → **affichée en centièmes** via `formatHeuresCentiemes` (ex. 480 min = 8 h → `"8,00 heures"`). **C'est la valeur portée par le certificat de réalisation** (cohérent avec le devis/convention).
- **Temps réel actif = `CourseProgress.tempsTotalSec`** (Σ `LessonProgress.tempsPasseSec`) → **non imprimé comme « durée légale »** mais conservé dans `metadata.tempsReelActifSec` et exploitable en **annexe / preuve d'assiduité** (R.6313-3 : faisceau de preuves). On peut l'afficher en mention secondaire (« temps d'activité enregistré : … »), jamais en remplacement de la durée de l'action.

> **Pourquoi pas le temps réel comme durée légale ?** Parce que la durée de l'action FOAD est celle **prévue/annoncée** (durée moyenne), pas le chrono individuel ; sinon deux apprenants suivant le même parcours auraient deux certificats avec des heures différentes, ce qui fâche les OPCO. Le temps réel sert de **preuve d'assiduité** (le LMS prouve que l'apprenant a bien été actif), pas de mesure de la durée de l'action. Ce choix est documenté en `08-CONFORMITE/06-tracabilite-preuves-realisation.md`.

### 5.1 Données collectées par le service avant rendu

```ts
// src/server/elearning/certificats/certificat-data.ts (NEUF)
interface CertificatFoadData {
  // Organisme (réutilise getOrganismeIdentite() Qualiopi — SSOT identité OF)
  identite: OrganismeIdentite;
  dirigeant?: string;
  // Bénéficiaire (réutilise Trainee — PII déchiffrée côté serveur uniquement)
  stagiaire: { nom: string; prenom: string; fonction?: string };
  entreprise: { raisonSociale: string; siret?: string; adresse?: string }; // via Client si pro
  // Action FOAD
  intituleAction: string; // ElearningCourse.titre
  modalite: "FOAD (formation ouverte et à distance — asynchrone)";
  dateDebut: string; // = ElearningEnrollment.premiereConnexionAt (entrée effective)
  dateFin: string; // = CourseProgress.completedAt
  dureeHeures: number; // = dureeEstimeeMinutes / 60  → centièmes
  tempsReelActifHeures: number; // = tempsTotalSec / 3600 (mention preuve, secondaire)
  scoreGlobalPct: number;
  mentionLibre?: string; // ElearningCourse.certificatMentionLibre
  // Vérification
  qrToken: string; // makeQrToken()
  qrDataUrl: string; // qrDataUrl(verifyUrl)
}
```

### 5.2 Template PDF FOAD (NEUF, dérivé du modèle officiel)

Fichier cible : `src/server/elearning/certificats/templates/certificat-realisation-foad.tsx`.

Il **réutilise** `QualiopiPage`, `DocSection`, `FieldRow`, `pdfStyles`, `formatHeuresCentiemes`, `LEGAL_MENTIONS.certificatRealisation`, le bloc QR et le bloc signature **à l'identique** de `certificat-realisation.tsx`. Différences FOAD :

- **Modalité explicite** : `FieldRow label="Modalité" value="Formation ouverte et à distance (FOAD — asynchrone)"`.
- **Dates** : « date de début » = **entrée effective** (1re connexion réelle, `premiereConnexionAt`) ; « date de fin » = `completedAt`. (Distinct du présentiel où ce sont les dates de session.)
- **Durée** : bloc `dureeBlock` identique (centièmes), libellé « Durée de l'action (format réglementaire en centièmes) ».
- **Mention d'assiduité secondaire** (petit texte, pas la durée légale) : « Temps d'activité enregistré sur la plateforme : X h Y (à titre indicatif, preuve d'assiduité — art. R.6313-3) ».
- **Mention FOAD conformité** : phrase rappelant l'assistance technique et pédagogique (Ind.19) et les évaluations qui jalonnent (Ind.11) — sans wording marketing.
- **Mention libre** optionnelle (`certificatMentionLibre`).

> On **ne duplique pas** la logique de durée/centièmes : on importe `formatHeuresCentiemes` depuis `legal-mentions.ts`. La seule nouveauté est l'agencement FOAD des champs.

---

## 6. Badges — génération & visuel

- **Octroi** : `badge-service.evaluateBadges(enrollmentId)` (NEUF, `src/server/elearning/badges/badge-service.ts`) est appelé par `progress-service` / `completion-service` après chaque recalcul. Il lit les `ElearningBadge` actifs du cours (+ transverses), évalue chaque `critere` contre `CourseProgress`/`ModuleProgress`/`QuizAttempt`, et crée un `ElearningBadgeAward` **idempotent** (la contrainte `@@unique([badgeId, traineeId])` empêche le doublon ; `createMany … skipDuplicates`).
- **Token de vérif** : `verifToken = makeQrToken()` (réutilise le générateur 64 hex). Permet une page de vérification publique du badge (§7).
- **Visuel** : deux modes, par ordre de simplicité :
  1. **Icône + couleur** (MVP par défaut) : rendu **CSS** côté front (composant `<BadgeChip>`), zéro asset, zéro coût R2, zéro impact Web Vitals (pas d'image réseau).
  2. **Image PNG** (optionnel) : si `imageR2Key` est défini, l'image (1:1, ≤ 50 KB) est servie via `getSignedUrlR2`. Réservé aux badges « partageables socialement » (LinkedIn). Pas au MVP par défaut.
- **Pas de PDF pour les badges** : un badge n'est pas un document légal. Il vit dans le portail + une page de vérif HTML. (Si un jour on veut un « certificat de badge » imprimable, on passera par `generateDocument` avec un nouveau template — pas prévu.)

**Anti-pattern évité** (cf. brief best-practices) : badges **opt-in par cours** (`badgesActives`), **jamais** de classement public imposé, pas de notification intrusive, pas d'autoplay de confettis bloquant. Le badge est une **récompense discrète et optionnelle**, pas un système de pression sociale.

---

## 7. Page de vérification publique — réutilisation + extension

### 7.1 Certificats / attestations → page existante, **inchangée fonctionnellement**

`/{locale}/verifier-attestation/[token]` (`src/app/[locale]/verifier-attestation/[token]/page.tsx`) résout déjà n'importe quel `DocumentGenere.qrToken`. Un certificat e-learning a un `qrToken` → **il fonctionne déjà**. Extensions marginales :

- Ajouter au `select` Prisma la lecture de `metadata` (pour afficher « Cours e-learning : <titre> » quand `metadata.source === "elearning"` et qu'il n'y a pas de `session` rattachée — un cours e-learning autonome n'a pas de `TrainingSession`).
- Le label `certificat_realisation` est **déjà** dans `DOC_TYPE_LABELS` (« Certificat de réalisation »). Rien à ajouter.
- Conserver le **masquage du nom** (« Prénom + D. ») et `robots: noindex` : RGPD + pas d'indexation des pages de preuve.

> ⚠️ Ne pas casser le contrat de cette page : elle doit marcher **sans flag** (le titulaire a reçu le doc), rester **stub-aware** (`notFound()` si `stub.invalid`), et ne **jamais** exposer de PII complète ni de mention financement.

### 7.2 Badges → petite page neuve

Fichier cible : `src/app/[locale]/verifier-badge/[token]/page.tsx` (server component, `force-dynamic`, `robots: noindex`, stub-aware — **copié** sur le pattern de `verifier-attestation`).

- Résout `ElearningBadgeAward.verifToken` (unique).
- Affiche : libellé du badge, description, cours associé, date d'octroi, titulaire **masqué** (Prénom + initiale), statut (« valide » / « révoqué » si `revokedAt`).
- Aucune valeur réglementaire affichée (un bandeau neutre « Badge de réussite délivré par Axion-IA » — pas « certifié »).

---

## 8. Emails de notification — réutilisation Nodemailer

À l'émission (worker, §10), on enfile un email via la queue `email` (`email-worker`). Templates React Email (NEUF, calqués sur `qualiopi-attestation-disponible.tsx`) :

- `src/lib/email/templates/elearning-certificat-disponible.tsx` — « Votre certificat de réalisation est disponible » + CTA vers le portail (`/portail/mon-espace`) + lien de vérification. **PJ optionnelle** : on privilégie le **lien portail** (URL signée courte) plutôt qu'une PJ lourde ; PJ PDF possible si l'OF le souhaite (le buffer existe déjà côté worker).
- `src/lib/email/templates/elearning-badge-obtenu.tsx` (V1, opt-in) — « Vous avez obtenu un badge ». Discret, lien portail. **Throttlé** : pas un email par micro-badge ; regroupement quotidien possible (anti-spam).

Réutilise le layout email maison (bouton bulletproof + footer identité OF centralisé). FR uniquement.

---

## 9. UI apprenant — portail (réutilise `/portail/mon-espace`)

L'apprenant retrouve ses documents dans son espace (cookie `PortailAcces`). On ajoute une section e-learning (composants sous `src/components/elearning/`).

- **`<CertificatCard>`** : pour chaque `ElearningEnrollment` avec `certificatDocumentId` non nul → carte « Certificat de réalisation — <cours> », date, bouton **Télécharger** (régénère une URL R2 signée 900 s via une server action `getCertificatDownloadUrl(enrollmentId)` sous `src/server/elearning/actions/`), bouton **Vérifier** (ouvre `/verifier-attestation/<qrToken>`).
- **`<AttestationCard>`** : idem pour l'attestation de fin de formation (si émise).
- **`<BadgesGrid>`** : grille de `<BadgeChip>` (icône + couleur, rendu CSS) listant les `ElearningBadgeAward` de l'apprenant ; chaque badge a un lien « Vérifier / Partager » (page §7.2). Affichée seulement si le cours a `badgesActives`.
- **État vide / en cours** : si le cours n'est pas terminé, afficher **la condition restante** (« Certificat disponible après réussite du quiz final — score requis 70 % ») — cohérent avec le principe « verrou affiché avec sa raison » (doc 04 progression).

**Accessibilité (WCAG 2.2 AA, EAA)** : boutons ≥ 24×24 px (2.5.8), focus visible, libellés explicites (pas « Télécharger » seul → « Télécharger le certificat de réalisation (PDF) »), contraste AA sur les `<BadgeChip>`. **Web Vitals** : badges en CSS (pas d'images réseau au-dessus de la ligne de flottaison), download via server action (pas de JS lourd), section certificats rendue serveur.

---

## 10. Backend — services & worker (NEUF)

| Fichier cible                                                                | Rôle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/server/elearning/certificats/certificat-service.ts`                     | `emettreCertificatRealisation(enrollmentId)` : (1) garde idempotente transactionnelle (`update where certificatDocumentId: null`), (2) collecte `CertificatFoadData` (org via `getOrganismeIdentite`, trainee déchiffré, agrégats), (3) `makeQrToken` + `qrDataUrl`, (4) `generateDocument({ type: "certificat_realisation", buildElement, refs:{ traineeId, formationId? }, qrToken, identite, ... metadata FOAD })`, (5) écrit `certificatDocumentId` + `certificatEmisAt` sur l'`ElearningEnrollment`, (6) enfile l'email. Émet aussi l'attestation (`emettreAttestation`) selon le cas (complète/partielle). |
| `src/server/elearning/certificats/certificat-data.ts`                        | Construction de `CertificatFoadData` (calcul durée centièmes, dates entrée effective/fin, score).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `src/server/elearning/certificats/templates/certificat-realisation-foad.tsx` | Template React-PDF FOAD (§5.2).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `src/server/elearning/badges/badge-service.ts`                               | `evaluateBadges(enrollmentId)` (octroi idempotent), `revokeBadge`, helpers de critères.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `src/server/queue/workers/elearning-certificat-worker.ts`                    | Consomme la queue `elearning-certificat` ; appelle `certificat-service`. Réutilise le pattern des workers existants (BullMQ, `BULLMQ_DISABLED` aware).                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `src/server/elearning/actions/certificat-actions.ts`                         | Server actions : `getCertificatDownloadUrl` (apprenant, vérifie l'ownership via session portail), admin `forcerEmissionCertificat` / `revoquerCertificat` (RBAC `requireAdminPublish`).                                                                                                                                                                                                                                                                                                                                                                                                                          |

**Queue** : déclarer `elearning-certificat` dans `src/server/queue/queues.ts` (à côté des queues image-bank/qualiopi). Le déclencheur (`completion-service`) **enfile** ; le worker **exécute** (découplage = résilience, retries BullMQ).

**Révocation d'un certificat** (cas erreur) : on **ne supprime pas** le `DocumentGenere` (immuabilité + rétention 5 ans). On ajoute (additif) un champ `DocumentGenere.revoquePourErreurAt DateTime? @map("revoque_pour_erreur_at")` + on remet `ElearningEnrollment.certificatDocumentId = null` (ré-émission possible). La page de vérif affichera « Document révoqué » si `revoquePourErreurAt` non nul. _(Alternative sans toucher `DocumentGenere` : stocker la révocation dans `metadata.revoked = true` — préférable pour zéro migration sur la table critique. Décision recommandée : `metadata`.)_

**Stub-aware** : `certificat-service` hérite du comportement stub de `generateDocument` (retourne un objet minimal). Toutes les routes/pages associées sont `force-dynamic` derrière auth → jamais appelées au SSG build.

---

## 11. Conformité, sécurité, tests

**Conformité FOAD (rappel du « pourquoi »)** :

- Le **certificat de réalisation** (modèle officiel, heures, depuis 01/06/2020) est **obligatoire** pour le financement OPCO/entreprise → produit dès le MVP.
- Il s'appuie sur le **faisceau de preuves** (doc 02 : `tempsPasseSec`, `XapiStatement`, `evaluationFinaleFaite`) — le certificat **synthétise** ces preuves, il ne les remplace pas.
- Mention **Ind.11** (évaluations qui jalonnent — condition d'émission) et **Ind.19** (assistance) référencées sur le PDF FOAD.
- **CPF/RNCP** : aucun wording de certification (test garde-fou) ; activation EDOF = autre chantier (flag, ADR-LMS-0003).

**Sécurité** :

- `qrToken` / `verifToken` : 64 hex non-guessables, comparaison **timing-safe** (`verifyQrToken`).
- Téléchargement certificat : URL R2 signée **courte** (900 s) + **vérification d'ownership** (la server action recoupe `enrollment.trainee` avec la session portail).
- Pages de vérif publiques : `robots: noindex`, masquage PII (Prénom + initiale), stub-aware, pas de mention financement.
- `hashSha256` du PDF conservé (intégrité — déjà fait par `generateDocument`).

**Rétention** : `suppressionPrevueAt = +5 ans` (déjà appliqué par `generateDocument`, `DOCUMENT_RETENTION_YEARS`). Badges : pas de PII sensible, conservés tant que l'apprenant existe (cascade `onDelete` au `Trainee`).

**Tests (Vitest, mock Prisma)** :

- `certificat-service.spec.ts` : émission idempotente (double déclenchement → 1 seul doc), garde `certificatDocumentId`, mapping durée→centièmes, contenu metadata FOAD.
- `certificat-realisation-foad.spec.tsx` : snapshot du texte PDF (kit `collect-pdf-text` existant) — présence durée centièmes, modalité FOAD, mentions Ind.11/19, **absence** de termes interdits (« certification », « diplôme », « RNCP », « CPF éligible »).
- `badge-service.spec.ts` : octroi par critère, idempotence (`@@unique`), révocation (marquage, pas suppression).
- `verifier-badge` page : token valide / invalide / révoqué / stub.

---

## 12. EXISTANT vs NEUF (récap)

**Réutilisé (zéro duplication)** : `DocumentGenere` + `DocumentType` + numérotation + `hashSha256` + `qrToken` + `suppressionPrevueAt` ; `generateDocument` ; `makeQrToken`/`qrDataUrl`/`verifyQrToken` ; `CertificatRealisationPdf`/`AttestationPdf`/`AttestationPartiellePdf` + `QualiopiPage`/`DocSection`/`FieldRow`/`pdfStyles` ; `formatHeuresCentiemes` + `LEGAL_MENTIONS` ; page `/verifier-attestation/[token]` ; R2 ; `ElearningEnrollment.certificatDocumentId`/`certificatEmisAt` (doc 02) ; emails Nodemailer + `email-worker` ; portail `/portail/mon-espace`.

**Neuf (ce document)** :

- Colonnes additives `ElearningCourse` : `certificatAttestationPartielleActive`, `certificatMentionLibre`, `badgesActives`.
- Tables : `elearning_badges`, `elearning_badge_awards` + enum `ElearningBadgeCritere` + champs inverses sur `Trainee`/`ElearningCourse`.
- Services : `certificat-service.ts`, `certificat-data.ts`, `badge-service.ts` ; template `certificat-realisation-foad.tsx` ; worker `elearning-certificat-worker.ts` + queue `elearning-certificat` ; server actions `certificat-actions.ts`.
- UI : `<CertificatCard>`, `<AttestationCard>`, `<BadgesGrid>`/`<BadgeChip>` (portail) ; page `/verifier-badge/[token]`.
- Emails : `elearning-certificat-disponible.tsx`, `elearning-badge-obtenu.tsx`.
- Usage `DocumentGenere.metadata` pour le contexte FOAD (pas de colonne neuve sur la table critique).

---

## Liens

- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-0003 (CPF/RNCP certification-ready), ADR-0007 (cloisonnement), ADR-0008 (migrations additives).
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — `ElearningCourse` (`seuilReussitePct`, `estFoad`, `dureeEstimeeMinutes`), `ElearningLesson.obligatoire`.
- `03-DATA-MODEL/02-schema-progression-tracking.md` — `ElearningEnrollment.certificatDocumentId`/`certificatEmisAt`/`premiereConnexionAt`, `CourseProgress` (`scoreGlobalPct`, `tempsTotalSec`, `evaluationFinaleFaite`), `completion-service`, worker `elearning-certificat-worker`.
- `03-DATA-MODEL/03-schema-quiz-evaluations.md` — `QuizAttempt` (alimente `scoreGlobalPct`, critère badge `quiz_parfait`).
- `04-BACKEND/03-workers-bullmq-crons.md` — queue `elearning-certificat`, workers.
- `04-BACKEND/10-emails-notifications.md` — templates email certificat/badge.
- `05-FRONTEND-APPRENANT/01-espace-apprenant-dashboard.md` & `04-progression-deverrouillage.md` — où s'affichent certificats/badges, « condition restante » affichée.
- `06-CONSOLE-ADMIN/07-gestion-certificats.md` — émission forcée / révocation côté admin (RBAC).
- `08-CONFORMITE/01-foad-d6313-3-1.md`, `02-qualiopi-indicateurs-foad.md` (Ind.11/19), `06-tracabilite-preuves-realisation.md` (durée action vs temps réel), `03-cpf-edof-readiness.md` (pourquoi pas de certification au MVP).
- `09-QUALITE/04-accessibilite-wcag22.md` — critères 2.5.8/2.4.11 appliqués aux cartes/badges.
  </content>
  </invoke>
