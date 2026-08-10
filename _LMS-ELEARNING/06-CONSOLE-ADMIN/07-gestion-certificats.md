# Console admin — Gestion des certificats e-learning

> Spécification implémentable de la **gestion des certificats de réalisation e-learning** côté console admin :
> modèles de certificat, conditions d'émission, émission automatique / manuelle, ré-émission,
> registre & vérification QR, mentions officielles + heures réalisées.
>
> **Principe directeur : on ne réinvente rien.** Le certificat e-learning **réutilise intégralement**
> le pipeline PDF Qualiopi existant (`DocumentGenere`, `documents-service.ts`, `react-pdf`, QR `qr.ts`,
> R2, page de vérification publique `/verifier-attestation/[token]`). On ajoute **uniquement** : un template
> PDF FOAD dédié, un service/worker d'émission e-learning, un registre additif, et l'UI admin.
>
> Statut : à implémenter (MVP, lot 7 de la roadmap). Dernière mise à jour : 2026-06-27.

---

## 0. TL;DR pour le dev

| Question                                             | Réponse                                                                                                                                                                                                                                               |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quel modèle de stockage ?                            | **`DocumentGenere` existant** (`type = certificat_realisation`), **aucune nouvelle table de stockage PDF**.                                                                                                                                           |
| Comment relier un certificat à un accès e-learning ? | `ElearningEnrollment.certificatDocumentId` (déjà spécifié doc 02) → pointe le **certificat courant valide**.                                                                                                                                          |
| Comment tracer la ré-émission / l'historique ?       | **Nouvelle table additive `ElearningCertificatEmission`** (registre append-only, 1 ligne / émission).                                                                                                                                                 |
| Quel numéro / QR ?                                   | `formatDocumentNumber("certificat", year, seq)` → `AXI-CERT-YYYY-NNN` + `makeQrToken()` (64 hex). Déjà géré par `documents-service.ts`.                                                                                                               |
| Quel template PDF ?                                  | **Neuf** : `src/server/elearning/documents/templates/certificat-realisation-elearning.tsx` (variante FOAD du `certificat-realisation.tsx` Qualiopi, **réutilise** `QualiopiPage` + `LEGAL_MENTIONS.certificatRealisation` + `formatHeuresCentiemes`). |
| Quelles heures ?                                     | **Heures réalisées** dérivées de `CourseProgress` (cf. §4.2), **format centièmes obligatoire** (`formatHeuresCentiemes` → `"7,00"`).                                                                                                                  |
| Émission auto ?                                      | `completion-service.ts` (doc 02 §8) → enqueue `elearning-certificat-worker.ts` quand `reussite && completedAt`.                                                                                                                                       |
| Émission manuelle ?                                  | Server action `emettreCertificatElearning` sous `src/server/elearning/actions/certificat-actions.ts` (RBAC `requireAdminPublish`).                                                                                                                    |
| Vérification publique ?                              | **Réutilise** `/[locale]/verifier-attestation/[token]` (aucune nouvelle route — il faut juste y ajouter le rendu du contexte e-learning, cf. §7.2).                                                                                                   |

---

## 1. Objectif & périmètre

Cette page de la console permet à l'équipe Axion-IA de :

1. **Définir le modèle** de certificat (mentions légales, durée réalisée, signataire, QR) — sans toucher au code à chaque session.
2. **Piloter les conditions d'émission** (seuil de réussite, complétion obligatoire, FOAD on/off) via la config existante.
3. **Émettre** un certificat : **automatiquement** (à la complétion+réussite) ou **manuellement** (1 clic admin).
4. **Ré-émettre** : régénérer une **copie** (filigrane « COPIE ») ou émettre une **nouvelle version** (correction de données).
5. **Consulter le registre** de tous les certificats émis, filtrable / exportable (preuve OPCO / Qualiopi).
6. **Vérifier** l'authenticité d'un certificat via QR / token (page publique existante).

**Hors périmètre de ce document** (couverts ailleurs) :

- Le calcul de la progression / réussite : `02-schema-progression-tracking.md` + `completion-service.ts`.
- Le moteur de quiz qui produit le `scoreGlobalPct` : `03-schema-quiz-evaluations.md`.
- Les **certifications RNCP/RS** (≠ certificat de **réalisation**) : `08-CONFORMITE/04-dossier-certification-rncp-rs.md`. **Attention au vocabulaire** : ici on parle du **certificat de réalisation** (modèle officiel, heures réalisées, obligatoire depuis le 01/06/2020), **pas** d'un titre certifiant.

---

## 2. EXISTANT réutilisé (vérifié dans le code) vs NEUF

### 2.1 Réutilisé tel quel — aucune duplication

| Brique                                                          | Emplacement réel                                                                        | Rôle dans la gestion certificats                                                                                                                                                                                                       |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DocumentGenere`                                                | `prisma/schema.prisma:5507`                                                             | **Stockage du certificat** : `numero` unique, `hashSha256`, `pdfUrl` (URL signée R2), `qrToken`/`qrTokenCreatedAt`, `estCopie`, `suppressionPrevueAt` (+5 ans), `metadata`. `type = certificat_realisation` (`DocumentType`, `:5493`). |
| `generateDocument()`                                            | `src/server/qualiopi/documents/documents-service.ts`                                    | Workflow complet : alloc numéro séquentiel (`AXI-CERT-YYYY-NNN`, retry P2002) → rendu PDF (`buildElement(numero)`) → upload R2 + URL signée 900 s → `create DocumentGenere` → `ActivityLog`. **Stub-aware** (`stub.invalid`).          |
| Template certificat Qualiopi                                    | `src/server/qualiopi/documents/templates/certificat-realisation.tsx`                    | **Modèle de référence** à cloner pour la variante FOAD (mise en page, bloc durée centièmes, bloc QR, zone signature).                                                                                                                  |
| `qr.ts`                                                         | `src/server/qualiopi/documents/qr.ts`                                                   | `makeQrToken()` (32 bytes → 64 hex), `qrDataUrl(url)` (PNG base64 pour `<Image>`), `verifyQrToken()` (timing-safe).                                                                                                                    |
| Page de vérification publique                                   | `src/app/[locale]/verifier-attestation/[token]/page.tsx`                                | `force-dynamic`, `robots: noindex`, lookup `documentGenere.findUnique({ where: { qrToken } })`, affichage privacy-safe (prénom + initiale). **Réutilisée telle quelle** (extension §7.2).                                              |
| `formatHeuresCentiemes()`                                       | `src/server/qualiopi/legal/legal-mentions.ts`                                           | Durée réglementaire en centièmes (`7 → "7,00"`). **Obligatoire OPCO Atlas.** Ne jamais utiliser `"7h00"`.                                                                                                                              |
| `LEGAL_MENTIONS.certificatRealisation`                          | `src/server/qualiopi/legal/legal-mentions.ts`                                           | Mention exacte : _« Établi conformément à l'article R.6313-3 du Code du travail et à l'arrêté du 21 décembre 2018. »_                                                                                                                  |
| `DOCUMENT_RETENTION_YEARS`                                      | `src/server/qualiopi/legal/legal-mentions.ts`                                           | `5` — alimente `suppressionPrevueAt`.                                                                                                                                                                                                  |
| `getOrganismeIdentite()`                                        | `src/server/qualiopi/documents/organisme.ts`                                            | Identité OF (raison sociale, SIRET, NDA, Qualiopi, adresse siège, dirigeant, `site`).                                                                                                                                                  |
| `assertOrganismeComplet()`                                      | `src/server/qualiopi/documents/conformite.ts`                                           | Garde-fou : refuse l'émission si l'identité OF est incomplète.                                                                                                                                                                         |
| `formatDocumentNumber()` / `NumberingType`                      | `src/server/qualiopi/numbering/formats.ts`                                              | Numérotation `AXI-CERT-YYYY-NNN` (préfixe `CERT`).                                                                                                                                                                                     |
| `r2-storage.ts`                                                 | `src/lib/r2-storage.ts`                                                                 | `uploadToR2` / `getSignedUrlR2` (fail-soft si R2 absent). Utilisé **via** `documents-service`.                                                                                                                                         |
| Console admin                                                   | `AdminPageShell`, `AdminTable`, `AdminBadge`, `StatCard` (`src/components/admin/ui/**`) | UI de la page registre + RBAC `requireAdminRead/Write/Publish/Delete` (`src/server/actions/knowledge/_guards.ts`).                                                                                                                     |
| `ElearningEnrollment.certificatDocumentId` / `certificatEmisAt` | doc 02 §3 (à créer)                                                                     | Pointeur vers le **certificat courant** + date d'émission. Relation `@relation("ElearningCertificat")` vers `DocumentGenere`.                                                                                                          |
| `CourseProgress`                                                | doc 02 §6 (à créer)                                                                     | Source des **heures réalisées** (`tempsTotalSec`), de la **réussite** (`reussite`, `scoreGlobalPct`), de la **complétion** (`completedAt`), des jalons d'évaluation (`evaluationFinaleFaite`).                                         |

> **Modèle officiel certificat de réalisation** : depuis le 01/06/2020, le certificat de réalisation (heures **réalisées**) est obligatoire. Le template Qualiopi existant le respecte déjà ; la variante FOAD reprend la même structure en remplaçant « dates de session » par « période d'accès + heures réalisées e-learning ».

### 2.2 Neuf à construire (cloisonné sous `src/server/elearning/**`, ADR-LMS-0007)

| Élément                                | Fichier cible                                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Table registre / historique d'émission | migration additive → `ElearningCertificatEmission` (cf. §3)                                    |
| Template PDF FOAD                      | `src/server/elearning/documents/templates/certificat-realisation-elearning.tsx`                |
| Service d'émission                     | `src/server/elearning/documents/certificat-service.ts`                                         |
| Worker d'émission                      | `src/server/queue/workers/elearning-certificat-worker.ts`                                      |
| Server actions admin                   | `src/server/elearning/actions/certificat-actions.ts`                                           |
| Pages admin                            | `src/app/[locale]/(admin)/[adminPrefix]/elearning/certificats/**`                              |
| Composants admin                       | `src/components/admin/elearning/certificats/**`                                                |
| Entrée de nav                          | `src/lib/admin-nav.ts` (groupe `elearning`, cf. `06-CONSOLE-ADMIN/01-navigation-structure.md`) |

---

## 3. Data model — registre d'émission (NEUF, additif)

`DocumentGenere.certificatDocumentId` (sur l'enrollment) ne pointe que **le certificat courant**. Or la ré-émission produit plusieurs `DocumentGenere` (copies + nouvelles versions) pour un même accès. On a besoin d'un **registre append-only** qui trace **chaque** émission (audit, conformité, support). C'est une **table additive** (ADR-LMS-0008 : CREATE TABLE, aucun DROP).

```prisma
/// Motif d'une émission de certificat e-learning (traçabilité registre).
enum ElearningCertificatMotif {
  emission_auto       // émis automatiquement à la complétion+réussite (worker)
  emission_manuelle   // émis à la main par un admin (1 clic)
  copie               // ré-impression conforme (filigrane « COPIE ») — mêmes données
  nouvelle_version    // ré-émission après correction de données (nouveau numéro)
  annulation          // certificat invalidé (ex. fraude détectée) — pas de PDF
}

/// Registre append-only de TOUTES les émissions de certificat e-learning.
/// 1 ligne = 1 acte d'émission. Pointe le DocumentGenere produit (sauf annulation).
/// NE remplace PAS DocumentGenere (qui stocke le PDF) : c'est le journal métier.
model ElearningCertificatEmission {
  id            String   @id @default(uuid())

  // ── Accès e-learning concerné (réutilise ElearningEnrollment, doc 02) ──
  enrollmentId  String   @map("enrollment_id")
  enrollment    ElearningEnrollment @relation("EnrollmentCertificatEmissions", fields: [enrollmentId], references: [id], onDelete: Cascade)

  // ── Document produit (réutilise DocumentGenere ; null si motif=annulation) ──
  documentId    String?  @map("document_id") @db.Uuid
  document      DocumentGenere? @relation("DocumentCertificatEmissions", fields: [documentId], references: [id], onDelete: SetNull)

  motif         ElearningCertificatMotif
  /// Version logique du certificat (1, 2, … — incrémentée à chaque nouvelle_version).
  version       Int      @default(1)
  /// Snapshot figé des données AU MOMENT de l'émission (preuve immuable) :
  /// { heuresRealisees, scoreGlobalPct, completedAt, periodeDebut, periodeFin, seuilReussitePct }.
  snapshot      Json     @default("{}")

  /// Admin déclencheur (null si émission auto par worker/cron). @db.Uuid (AdminUser).
  emisParId     String?  @map("emis_par_id") @db.Uuid
  /// Justification libre (obligatoire pour nouvelle_version / annulation).
  raison        String?  @db.VarChar(500)

  emisAt        DateTime @default(now()) @map("emis_at")
  createdAt     DateTime @default(now()) @map("created_at")

  @@index([enrollmentId])
  @@index([documentId])
  @@index([motif])
  @@index([emisAt])
  @@map("elearning_certificat_emissions")
}
```

**Champs inverses additifs** (relations sans colonne — zéro risque) :

```prisma
// model ElearningEnrollment { ... }   (doc 02)
  certificatEmissions ElearningCertificatEmission[] @relation("EnrollmentCertificatEmissions")

// model DocumentGenere { ... }        (existant, prisma/schema.prisma:5507)
  elearningCertificatEmissions ElearningCertificatEmission[] @relation("DocumentCertificatEmissions")
```

> **Pourquoi ne pas ajouter de colonnes à `DocumentGenere` ?** `DocumentGenere` est partagé avec tout le Qualiopi (factures, conventions, attestations). On garde le cloisonnement : le métier e-learning vit dans `ElearningCertificatEmission`. Le `DocumentGenere` reste le coffre PDF neutre.

> **Pourquoi `snapshot` JSON ?** Le certificat doit refléter les chiffres **au moment de l'émission**. Si l'apprenant continue à cliquer après coup (ou si on recalcule un agrégat), le PDF déjà signé ne doit jamais « bouger ». Le snapshot est la preuve figée ; le PDF en est le rendu.

---

## 4. Conditions d'émission

### 4.1 Règle métier (gate)

Un certificat de réalisation e-learning est **émis** quand **toutes** ces conditions sont vraies :

| Condition                  | Source                                                       | Détail                                                                                        |
| -------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Accès actif/terminé        | `ElearningEnrollment.statut ∈ {actif, termine}`              | Pas de certificat pour `suspendu`/`expire`/`revoque`.                                         |
| Cours FOAD                 | `ElearningCourse.estFoad === true` (doc 01)                  | Un cours non-FOAD (support marketing) n'émet pas de certificat de réalisation.                |
| Complétion                 | `CourseProgress.completedAt != null`                         | 100 % des leçons **obligatoires** terminées (calcul `completion-service.ts`).                 |
| Réussite                   | `CourseProgress.reussite === true`                           | `scoreGlobalPct ≥ ElearningCourse.seuilReussitePct` (défaut 70, doc 01 `seuil_reussite_pct`). |
| Évaluation finale faite    | `CourseProgress.evaluationFinaleFaite === true`              | Exigence FOAD **Ind.11 (MAJEUR)** : une évaluation qui **conclut**. Bloquant.                 |
| Identité OF complète       | `assertOrganismeComplet(identite, "certificat_realisation")` | SIRET / NDA / adresse siège / Qualiopi non vides, sinon **throw** (pas de PDF muet).          |
| Pas déjà émis (sauf force) | `ElearningEnrollment.certificatEmisAt == null`               | Idempotence (cf. §5.1).                                                                       |

Cette règle est implémentée dans une fonction pure réutilisée par l'auto **et** le manuel :

```ts
// src/server/elearning/documents/certificat-service.ts
export interface CertificatGate {
  eligible: boolean;
  raisons: string[]; // raisons de NON-éligibilité (affichées à l'admin)
}
export function evaluerEligibiliteCertificat(input: {
  enrollmentStatut: ElearningEnrollmentStatut;
  estFoad: boolean;
  completedAt: Date | null;
  reussite: boolean;
  scoreGlobalPct: number | null;
  seuilReussitePct: number;
  evaluationFinaleFaite: boolean;
}): CertificatGate {
  /* … retourne la liste des blocages, jamais throw */
}
```

> L'admin voit **pourquoi** un certificat n'est pas émis (ex. « Score 62 % < seuil 70 % », « Évaluation finale non passée »). Pas de bouton grisé sans explication.

### 4.2 Calcul des heures réalisées (mention officielle)

Le certificat **doit** porter les **heures réalisées** (pas la durée théorique du cours). Règle de dérivation, par ordre de priorité, dans `certificat-service.computeHeuresRealisees()` :

1. **Temps actif réel** : `CourseProgress.tempsTotalSec` (Σ `LessonProgress.tempsPasseSec`, déjà plafonné anti-triche, doc 02 §4) → `heures = tempsTotalSec / 3600`.
2. **Garde-fou plancher / plafond** : on borne le résultat à `[0 ; ElearningCourse.dureeEstimeeMinutes/60 × 1,2]`. Le temps actif réel est la **preuve d'assiduité** ; on évite qu'un onglet laissé ouvert gonfle artificiellement les heures (le plafonnement heartbeat doc 02 §4 le fait déjà, ce borne est une ceinture+bretelles).
3. **Fallback durée pédagogique** : si `tempsTotalSec` est anormalement bas (< 10 % de la durée estimée) **mais** la complétion est atteinte (cas vidéo regardée hors heartbeat, ex. mobile background), on retient `dureeEstimeeMinutes/60` (durée pédagogique annoncée — celle communiquée au titre de D.6313-3-1 §2). Ce fallback est **tracé** dans le `snapshot` (`heuresSource: "duree_pedagogique"`).

```ts
// Toujours rendu en centièmes dans le PDF :
import { formatHeuresCentiemes } from "@/server/qualiopi/legal/legal-mentions";
const dureeFormatee = formatHeuresCentiemes(heuresRealisees); // ex. "7,50"
```

> **Décision figée** : la valeur retenue + sa source sont **gelées dans `ElearningCertificatEmission.snapshot`** au moment de l'émission. Une ré-émission **copie** réutilise ce snapshot (mêmes heures) ; une **nouvelle_version** recalcule.

### 4.3 Période d'accès (remplace « dates de session »)

Le template FOAD affiche une **période d'accès** plutôt que des dates de présentiel :

- `periodeDebut = ElearningEnrollment.premiereConnexionAt ?? accordeAt` (entrée effective FOAD).
- `periodeFin = CourseProgress.completedAt` (date de complétion = fin de réalisation).

---

## 5. Émission

### 5.1 Émission automatique

Chaîne (déjà amorcée doc 02 §8) :

```
player → recordHeartbeat / markLessonComplete
  → progress-service.recordLessonProgress()  (transaction)
  → completion-service.ts  : si CourseProgress passe à reussite && completedAt
      → enqueue "elearning-certificat" { enrollmentId }   (BullMQ)
        → elearning-certificat-worker.ts
            → certificat-service.emettreCertificat({ enrollmentId, motif: "emission_auto" })
```

**`elearning-certificat-worker.ts`** (`src/server/queue/workers/`, file `elearning-certificat` déclarée dans `src/server/queue/queues.ts`) :

- **Idempotent** : early-return si `ElearningEnrollment.certificatEmisAt != null` (re-livraison de job, double trigger).
- Stub-aware : early-exit si `DATABASE_URL` contient `stub.invalid` (contrat build).
- Re-vérifie le **gate** (`evaluerEligibiliteCertificat`) — un job en file peut être obsolète (accès révoqué entre-temps).
- Appelle `certificat-service.emettreCertificat()`.
- Best-effort : déclenche la notification apprenant (cf. §5.4) ; un échec mail ne casse pas l'émission.

### 5.2 `certificat-service.emettreCertificat()` (cœur, partagé auto+manuel)

```ts
// src/server/elearning/documents/certificat-service.ts
export interface EmettreCertificatInput {
  enrollmentId: string;
  motif: "emission_auto" | "emission_manuelle" | "nouvelle_version";
  emisParId?: string; // AdminUser (manuel) — null pour auto
  raison?: string; // obligatoire si nouvelle_version
  force?: boolean; // bypass idempotence (manuel uniquement)
}
export interface EmettreCertificatResult {
  documentId: string;
  numero: string;
  version: number;
  pdfUrl: string | null;
}
```

Étapes :

1. **Stub-aware** early-exit.
2. Charge `ElearningEnrollment` + `Trainee` + `ElearningCourse` + `CourseProgress` (+ `Client` si présent pour l'entreprise sur le PDF).
3. **Idempotence** : si `certificatEmisAt != null` et `!force` et `motif !== "nouvelle_version"` → retourne l'existant (lookup via `certificatDocumentId`).
4. **Gate** : `evaluerEligibiliteCertificat(...)` → si non éligible, **throw** `CertificatNonEligibleError(raisons)` (l'action admin la transforme en message ; le worker la log).
5. `identite = await getOrganismeIdentite()`.
6. `heures = computeHeuresRealisees(...)` (§4.2).
7. `token = makeQrToken()`, `verifyUrl = ${identite.site}/fr/verifier-attestation/${token}`, `qrUrl = await qrDataUrl(verifyUrl)`.
8. **Génère le PDF** via le service Qualiopi (réutilisation totale du numérotage/R2/DB) :

```ts
const generated = await generateDocument({
  type: "certificat_realisation",
  identite, // déclenche assertOrganismeComplet (garde-fou conformité)
  buildElement: (numero) =>
    React.createElement(CertificatRealisationElearningPdf, {
      data: {
        numero,
        dateEmission,
        identite,
        dirigeant: identite.dirigeant,
        stagiaire: { nom, prenom, fonction },
        entreprise, // depuis Client si financé entreprise
        intituleAction: course.titre,
        modalite: "Formation à distance (FOAD)",
        periodeDebut,
        periodeFin,
        dureeHeures: heures, // rendu en centièmes par le template
        scoreGlobalPct,
        qrToken: token,
        qrDataUrl: qrUrl,
        estCopie: false,
      },
    }),
  refs: { traineeId, formationId: course.formationId ?? undefined },
  qrToken: token,
});
```

9. **Transaction Prisma** : (a) `create ElearningCertificatEmission` (motif, version, snapshot figé, emisParId, raison, documentId) ; (b) `update ElearningEnrollment` → `certificatDocumentId = generated.id`, `certificatEmisAt = now`, et si `statut === actif` → `termine` (accès lecture seule maintenu).
10. `statement-emitter` : émet un `ElearningXapiStatement` (`verb: completed`, `objectType: course`) si pas déjà émis (preuve).
11. `ActivityLog` best-effort (`elearning.certificat.emis`).
12. Retourne `{ documentId, numero, version, pdfUrl }`.

### 5.3 Émission manuelle (admin)

Server action `emettreCertificatElearning` (`src/server/elearning/actions/certificat-actions.ts`), `requireAdminPublish` (rôles `super_admin`/`admin`/`editor`) :

```ts
"use server";
export async function emettreCertificatElearning(formData: FormData) {
  const ctx = await requireAdminPublish(); // RBAC + AdminSession
  const enrollmentId = z.string().uuid().parse(formData.get("enrollmentId"));
  const force = formData.get("force") === "true"; // émettre malgré non-complétion ? (cf. note)
  try {
    const res = await emettreCertificat({
      enrollmentId,
      motif: "emission_manuelle",
      emisParId: ctx.adminUser.id,
      force,
    });
    revalidatePath(`/${ctx.adminPrefix}/elearning/certificats`);
    return { ok: true, ...res };
  } catch (e) {
    if (e instanceof CertificatNonEligibleError) return { ok: false, raisons: e.raisons };
    throw e;
  }
}
```

> **`force` manuel = exception tracée.** Émettre un certificat **non éligible** (ex. l'apprenant a tout fait hors-ligne, preuve apportée autrement) est possible mais : (1) réservé `requireAdminPublish`, (2) `raison` **obligatoire**, (3) journalisé dans `ElearningCertificatEmission.raison` + `ActivityLog`. À utiliser avec parcimonie — un certificat de réalisation engage l'OF en cas de contrôle.

### 5.4 Notification apprenant

À l'émission (auto ou manuelle), best-effort via le pipeline existant (Nodemailer + React Email + `email-worker`) : un template `src/lib/email/templates/elearning-certificat-disponible.tsx` (neuf, calqué sur les `qualiopi-*.tsx`) avec lien vers le portail apprenant (`/portail/...`, doc 05-FRONTEND-APPRENANT/06) où l'URL signée R2 est régénérée à la demande. **Jamais** d'URL signée longue durée par mail (TTL court, re-signée à l'accès).

---

## 6. Ré-émission

Deux cas **distincts**, tous deux tracés dans `ElearningCertificatEmission` :

### 6.1 Copie conforme (`motif = copie`)

- **Mêmes données** que l'émission d'origine (réutilise le `snapshot` de la dernière émission valide).
- PDF rendu avec `estCopie: true` → filigrane « COPIE » (géré par `QualiopiPage` via `estCopie`, cf. template Qualiopi `certificat-realisation.tsx:137`).
- **Nouveau `DocumentGenere`** (nouveau numéro `AXI-CERT-…`, nouveau `qrToken`) mais `version` **inchangée**.
- `ElearningEnrollment.certificatDocumentId` **n'est PAS modifié** (le certificat « officiel » reste l'original ; la copie est une ré-impression).
- Usage : l'apprenant a perdu son PDF, demande une réédition.

### 6.2 Nouvelle version (`motif = nouvelle_version`)

- **Recalcule** les données (heures, score, identité OF si elle a changé) → **nouveau snapshot**.
- `version = version_max + 1`.
- Nouveau `DocumentGenere` (nouveau numéro + token).
- `ElearningEnrollment.certificatDocumentId` **est mis à jour** vers la nouvelle version (devient le certificat courant).
- `raison` **obligatoire** (ex. « Correction nom de famille », « Mise à jour identité OF après changement de SIRET »).
- L'ancien certificat **reste dans le registre** (jamais supprimé — preuve), mais n'est plus « courant ».

### 6.3 Annulation (`motif = annulation`)

- Pas de PDF. `documentId = null`.
- Invalide le certificat courant : `ElearningEnrollment.certificatDocumentId = null`, `certificatEmisAt = null`.
- Le `qrToken` de l'ancien `DocumentGenere` peut être **révoqué** : on ajoute `metadata.revoque = true` sur le `DocumentGenere` (additif, via `metadata` Json existant) ; la page de vérification (§7.2) affiche alors « document révoqué » au lieu de « authentique ».
- `raison` **obligatoire** (ex. fraude détectée, erreur d'octroi). `requireAdminDelete` (super_admin/admin).

> **Règle d'or : aucune ligne de `ElearningCertificatEmission` n'est jamais supprimée ni modifiée** (append-only). On empile copie → nouvelle_version → annulation. C'est le journal probant.

---

## 7. Registre & vérification

### 7.1 Registre admin (liste)

Page `src/app/[locale]/(admin)/[adminPrefix]/elearning/certificats/page.tsx` (`force-dynamic`, RBAC `requireAdminRead`) :

- **Source** : jointure `ElearningCertificatEmission` ⨝ `DocumentGenere` ⨝ `ElearningEnrollment` ⨝ `Trainee` ⨝ `ElearningCourse`.
- **Colonnes** (`<AdminTable>`) : Numéro (`DocumentGenere.numero`), Apprenant (Trainee), Cours, Heures réalisées (centièmes), Score, Motif (`<AdminBadge>`), Version, Émis le, Émis par, Statut (courant / copie / révoqué).
- **Filtres** : par cours, par période, par motif, par statut (courant/copie/révoqué), par entreprise (`Client`).
- **`StatCard`** en tête : nb certificats émis (30 j), taux de réussite (CourseProgress), nb copies, nb révocations.
- **Actions par ligne** : Télécharger (régénère URL signée R2 via `getSignedUrlR2`), Émettre une copie, Émettre nouvelle version, Annuler, Voir la fiche détail.
- **Export CSV / PDF de registre** (preuve OPCO / Qualiopi) : server action `exporterRegistreCertificats` → CSV (numéro, apprenant, cours, heures, score, date, hash SHA-256, motif). Le **hash** permet de prouver l'intégrité.

Page détail `certificats/[emissionId]/page.tsx` : snapshot complet, lien vers l'accès (`ElearningEnrollment`), historique des émissions de cet accès (toutes les versions + copies), QR affiché, lien de vérification publique.

### 7.2 Vérification publique (réutilise l'existant)

**Aucune nouvelle route.** On réutilise `src/app/[locale]/verifier-attestation/[token]/page.tsx` (déjà publique, `noindex`, lookup par `qrToken`). Deux **extensions additives** :

1. **Contexte e-learning** : la page sélectionne aujourd'hui `session`/`trainee`. Ajouter au `select` la résolution e-learning : si le `DocumentGenere` est référencé par un `ElearningCertificatEmission`, afficher le **titre du cours** (`ElearningCourse.titre`) et les **heures réalisées** (depuis `snapshot`) à la place de `session.titreSession`. Le `DOC_TYPE_LABELS` contient déjà `certificat_realisation`.
2. **Statut révoqué** : si `DocumentGenere.metadata.revoque === true`, remplacer le bandeau vert « Document authentique » par un bandeau rouge « Ce document a été révoqué par l'organisme » (cf. §6.3).

> Privacy : la page ne montre que prénom + initiale du nom (existant, `initialeNom()`). Le QR encode l'URL `…/fr/verifier-attestation/<token>` (64 hex non-guessable). Le token vit dans le PDF (bloc QR) **et** dans `DocumentGenere.qrToken`. Comparaison `verifyQrToken` timing-safe.

---

## 8. Mentions officielles portées par le PDF (template FOAD)

`src/server/elearning/documents/templates/certificat-realisation-elearning.tsx` — **clone** de `certificat-realisation.tsx` (réutilise `QualiopiPage`, `DocSection`, `FieldRow`, `pdfStyles`, `brandColor`). Diffs :

| Bloc                   | Contenu                                                                                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mention légale         | `LEGAL_MENTIONS.certificatRealisation` (R.6313-3 + arrêté 21/12/2018) — **identique**.                                                                           |
| Organisme de formation | raison sociale, **NDA**, **Qualiopi**, **SIRET**, adresse siège (jamais masqués — pièce d'audit).                                                                |
| Bénéficiaire           | Nom / Prénom + fonction ; entreprise (si financement entreprise via `Client`).                                                                                   |
| Action de formation    | Intitulé (`ElearningCourse.titre`) + **« Modalité : Formation à distance (FOAD) »** (au lieu de présentiel).                                                     |
| Période                | « Période d'accès : du {periodeDebut} au {periodeFin} » (§4.3).                                                                                                  |
| **Durée réalisée**     | `formatHeuresCentiemes(heures)` + « heures » + note arrêté 21/12/2018 (centièmes obligatoire OPCO Atlas). **Bloc mis en avant** (réutilise `styles.dureeBlock`). |
| Réussite               | « Évaluation finale : Réussie — score {scoreGlobalPct} % (seuil {seuil} %) ».                                                                                    |
| Vérification           | QR + token + URL `…/fr/verifier-attestation/<token>` (réutilise `styles.qrBlock`).                                                                               |
| Signature              | « Fait à {adresse}, le {dateEmission} — Le représentant légal : {dirigeant} » + cachet.                                                                          |

> **Interdits** (cohérence Qualiopi) : pas de logo Qualiopi sur ce document (réservé surfaces autorisées) ; durée **jamais** en `"7h00"` ; ne jamais laisser un champ identité OF vide (le garde-fou `assertOrganismeComplet` throw en amont).

`CertificatRealisationElearningData` (interface du template) — superset de `CertificatRealisationData` existant + `modalite`, `periodeDebut`, `periodeFin`, `scoreGlobalPct?`, `seuilReussitePct?`.

---

## 9. Config (réutilise la config Qualiopi/e-learning, pas de hardcode)

| Paramètre                           | Source                                               | Défaut |
| ----------------------------------- | ---------------------------------------------------- | ------ |
| Seuil de réussite (gate certificat) | `ElearningCourse.seuilReussitePct` (doc 01)          | 70     |
| Cours finançable FOAD               | `ElearningCourse.estFoad`                            | true   |
| Rétention document                  | `DOCUMENT_RETENTION_YEARS`                           | 5 ans  |
| Identité OF / dirigeant / `site`    | `getOrganismeIdentite()` (SiteSetting cat. qualiopi) | —      |
| Mention légale                      | `LEGAL_MENTIONS.certificatRealisation`               | figé   |

Une page admin « Réglages certificats e-learning » n'est **pas** nécessaire au MVP : tout est piloté par la config existante. (Évolution V1 : un éventuel `ElearningCertificatTemplateConfig` pour personnaliser un libellé / une signature scannée — additif, hors MVP.)

---

## 10. Navigation admin

Ajout dans `src/lib/admin-nav.ts` (cf. `06-CONSOLE-ADMIN/01-navigation-structure.md` pour la structure complète du pôle e-learning) :

- Nouveau groupe `AdminNavGroup = "elearning"` (additif à l'union de types existante).
- Item : `{ href: "/<adminPrefix>/elearning/certificats", label: "Certificats", icon: "📜", group: "elearning" }`.
- ⚠️ Le composant monté est **`AdminSidebarNav.tsx`** (pas `AdminSidebar.tsx`, obsolète) — vérifier le rendu du nouveau groupe là-bas.
- Mettre à jour `src/lib/admin-nav.test.ts` (compte d'items attendu) pour ne pas casser la Gate A.

---

## 11. Workers & files (BullMQ)

| File / worker                                             | Déclencheur                             | Rôle                                    |
| --------------------------------------------------------- | --------------------------------------- | --------------------------------------- |
| `elearning-certificat` / `elearning-certificat-worker.ts` | enqueue par `completion-service` (auto) | Émission auto idempotente (§5.1).       |
| (réutilisé) `email` / `email-worker.ts`                   | best-effort post-émission               | Notification « certificat disponible ». |

File à déclarer dans `src/server/queue/queues.ts` (même convention que `image-bank-*`, `qualiopi-formation-*`). Worker stub-aware + `BULLMQ_DISABLED` respecté (pas d'init Redis au build). ⚠️ Comme pour le content-gen, **le worker doit être (re)déployé** (process séparé) pour que l'émission auto tourne en prod.

---

## 12. Conformité, rétention & RGPD

- **FOAD (D.6313-3-1 §3 / Ind.11 majeur)** : le certificat n'est émis qu'après **évaluation finale** (`evaluationFinaleFaite`) — sinon non-conformité majeure. Le `snapshot` fige score + heures + jalons = faisceau de preuves R.6313-3 (preuve libre).
- **Modèle officiel** : certificat de réalisation (heures **réalisées**) — obligatoire depuis 01/06/2020. Réutilise la mention `R.6313-3` + arrêté 21/12/2018, centièmes.
- **Heures réalisées ≠ durée pédagogique** : on porte le **temps actif réel** (preuve d'assiduité), borné, avec fallback tracé (§4.2).
- **Rétention** : `DocumentGenere.suppressionPrevueAt = createdAt + 5 ans` (existant). `ElearningCertificatEmission` (registre) : conservé alignement preuve de réalisation **3–5 ans** (L.6362-6) ; cron de purge réutilise le pattern `elearning-xapi-purge-worker` / purge Qualiopi existante. Pièces financières liées (factures e-learning) : 6/10 ans (doc 05).
- **RGPD effacement** : suppression d'un `Trainee` (`deletedAt` + `RgpdDemande` existants) → `onDelete: Cascade` sur `ElearningEnrollment` → `ElearningCertificatEmission` cascade. Le `DocumentGenere` (obligation légale de conservation) reste, mais devient orphelin (à arbitrer dans `08-CONFORMITE/05`).
- **Audit** : chaque émission/copie/version/annulation → `ActivityLog` + `ElearningCertificatEmission` (qui, quand, pourquoi). RBAC : émettre/copier = `requireAdminPublish` ; annuler = `requireAdminDelete`.

---

## 13. Sécurité

- **Token QR** : 64 hex (`makeQrToken`), unique (`DocumentGenere.qrToken @unique`), comparaison timing-safe (`verifyQrToken`). Brute-force computationnellement irréaliste.
- **URLs PDF** : jamais publiques — `getSignedUrlR2` (TTL court, re-signée à chaque accès admin/portail). Aucune URL signée longue durée par mail.
- **Hash d'intégrité** : `DocumentGenere.hashSha256` permet de prouver qu'un PDF n'a pas été altéré (re-download + re-hash). Exporté dans le registre.
- **Idempotence** : worker + service early-return sur `certificatEmisAt` → pas de double émission sur re-livraison de job.
- **Garde-fou conformité** : `assertOrganismeComplet` empêche un certificat à identité OF incomplète (throw, jamais de ligne masquée en silence).
- **`force` manuel** : exception réservée `requireAdminPublish`, `raison` obligatoire, tracée.

---

## 14. Plan de tests (Vitest, mock Prisma — pas affecté par le stub build)

- `evaluerEligibiliteCertificat` : matrice (FOAD off, score < seuil, évaluation finale absente, accès révoqué…) → liste de raisons exacte.
- `computeHeuresRealisees` : temps réel nominal / plafonnement / fallback durée pédagogique tracé.
- `emettreCertificat` : émission auto (snapshot figé), idempotence, copie (snapshot réutilisé, estCopie), nouvelle_version (recalcul + version++), annulation (révocation token).
- Worker : idempotence sur re-livraison, gate re-vérifié, stub-aware.
- Template FOAD : présence mention R.6313-3, durée en centièmes (`formatHeuresCentiemes`), QR, identité OF complète (réutiliser le kit `collect-pdf-text` + specs `attestations-contenu.spec.tsx`).
- Page vérification : contexte e-learning rendu, bandeau révoqué si `metadata.revoque`.

---

## 15. EXISTANT vs NEUF (récap)

**Réutilisé (zéro duplication)** : `DocumentGenere` (+ `qrToken`/`hashSha256`/`estCopie`/`metadata`/`suppressionPrevueAt`), `generateDocument()`, `qr.ts`, `/verifier-attestation/[token]`, `formatHeuresCentiemes`, `LEGAL_MENTIONS.certificatRealisation`, `getOrganismeIdentite`, `assertOrganismeComplet`, `formatDocumentNumber` (`AXI-CERT`), `r2-storage.ts`, `email-worker` + React Email, console admin (`AdminPageShell`/`AdminTable`/`AdminBadge`/`StatCard`, RBAC `requireAdmin*`), `ElearningEnrollment.certificatDocumentId`/`certificatEmisAt` + `CourseProgress` (doc 02).

**Neuf** : table `ElearningCertificatEmission` + enum `ElearningCertificatMotif` (additif) ; template `certificat-realisation-elearning.tsx` ; `certificat-service.ts` (`evaluerEligibiliteCertificat`, `computeHeuresRealisees`, `emettreCertificat`) ; `elearning-certificat-worker.ts` + file `elearning-certificat` ; `certificat-actions.ts` ; pages `elearning/certificats/**` + composants ; template email ; entrée nav `elearning` ; extensions additives de la page de vérification.

---

## Liens

- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-LMS-0001 (auth), 0003 (CPF/RNCP ≠ certificat de réalisation), 0007 (cloisonnement), 0008 (migrations additives).
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — `ElearningCourse.estFoad` / `seuilReussitePct` / `dureeEstimeeMinutes`.
- `03-DATA-MODEL/02-schema-progression-tracking.md` — `ElearningEnrollment.certificatDocumentId`/`certificatEmisAt`, `CourseProgress` (heures, réussite, complétion, évaluation finale), `completion-service.ts`, `elearning-certificat-worker.ts`.
- `03-DATA-MODEL/03-schema-quiz-evaluations.md` — `scoreGlobalPct` / `QuizAttempt` qui alimentent la réussite.
- `03-DATA-MODEL/06-strategie-migrations.md` — séquence d'ajout de `ElearningCertificatEmission` (additif).
- `04-BACKEND/03-workers-bullmq-crons.md` — file `elearning-certificat` + déploiement worker.
- `04-BACKEND/10-emails-notifications.md` — template « certificat disponible ».
- `05-FRONTEND-APPRENANT/06-certificats-badges.md` — affichage / téléchargement côté apprenant (portail).
- `06-CONSOLE-ADMIN/01-navigation-structure.md` — groupe de nav `elearning`.
- `06-CONSOLE-ADMIN/08-reporting-analytics.md` — export registre / stats de réussite.
- `08-CONFORMITE/01-foad-d6313-3-1.md`, `02-qualiopi-indicateurs-foad.md`, `05-rgpd-conservation-preuves.md`, `06-tracabilite-preuves-realisation.md` — exploitation de la preuve produite par le certificat.
