# Backend — Workers BullMQ & crons e-learning

> Spécification **implémentable** des workers asynchrones et des tâches planifiées du LMS.
> Couvre : ingest/transcodage vidéo, octroi automatique d'accès, relances anti-décrochage (Qualiopi Ind.12), génération de certificats, génération IA de contenu/quiz, indexation du tuteur RAG, et emails.
>
> **Principe directeur : on NE réinvente PAS l'infrastructure de queues.** On réutilise telle quelle l'infra BullMQ existante (`src/server/queue/*`) et le modèle de « 1 queue cron unique qui dispatche par `type` » déjà éprouvé par `qualiopi-formation-crons-worker.ts` et `booking-crons-worker.ts`. Tout le code neuf vit sous `src/server/queue/workers/elearning-*-worker.ts` (ADR-LMS-0007) + services de domaine sous `src/server/elearning/**`.
>
> Dernière mise à jour : 2026-06-27.

---

## 0. TL;DR (ce qui est livré)

| #   | Worker / queue (NEUF)                                    | Type                       | Déclencheur                                                                                              | MVP/V1 |
| --- | -------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------- | ------ |
| 1   | `elearning-video-worker` (`elearning-video`)             | event-driven + safety poll | upload média → ingest Cloudflare Stream + poll « ready »                                                 | MVP    |
| 2   | `elearning-crons-worker` (`elearning-crons`)             | cron dispatcher            | 6 jobs cron (octroi auto, relances Ind.12, certificats, preuves FOAD, expiration accès, video-reconcile) | MVP→V1 |
| 3   | `elearning-certificate-worker` (`elearning-certificate`) | event-driven               | complétion cours (score ≥ seuil) → génère certificat de réalisation                                      | MVP    |
| 4   | `elearning-ai-worker` (`elearning-ai`)                   | event-driven               | quiz-gen depuis contenu + assistance authoring document-grounded                                         | V1     |
| 5   | `elearning-tutor-index-worker` (`elearning-tutor-index`) | event-driven + cron nuit   | (re)indexation RAG du contenu de cours pour le tuteur                                                    | V1     |
| —   | **emails**                                               | _réutilisé_                | nouveaux `EmailJobName` `elearning-*` ajoutés à la queue `emails` existante                              | MVP    |

> Le **tuteur RAG conversationnel** lui-même est **synchrone** (Server Action / route streaming, cf. `09-tuteur-rag-assistant.md`) ; seul son **indexation** est asynchrone (worker #5). On ne met pas le chat dans un worker.

---

## 1. Rappel de l'infra réutilisée (EXISTANT — ne pas dupliquer)

### 1.1 Fichiers socle

| Fichier                                 | Rôle                                                                                                          | Ce qu'on y touche                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/server/queue/connection.ts`        | singleton ioredis BullMQ, `getBullConnection()`, `getBullConnectionOrThrow()`, `isBullmqDisabled()`           | **rien** (réutilisé tel quel)                                                                    |
| `src/server/queue/queues.ts`            | déclare toutes les `Queue`, `defaultJobOptions`, helpers `enqueue*`, `bootRepeatableJobs()`                   | **ajout** : 5 queues + helpers `enqueue*` + bloc de crons e-learning dans `bootRepeatableJobs()` |
| `src/server/queue/types.ts`             | types de jobs partagés + `EmailJobName`                                                                       | **ajout** : `ElearningCronJobType` + payloads vidéo/IA + nouveaux `EmailJobName`                 |
| `src/server/queue/worker.ts`            | bootstrap : `startXxxWorker()` + `bootRepeatableJobs()`                                                       | **ajout** : 5 `start*Worker()` dans le tableau `workers`                                         |
| `src/server/queue/lib/sentry-worker.ts` | `captureWorkerError(domaine, queue, job, err)`                                                                | **réutilisé** dans chaque worker                                                                 |
| `src/lib/r2-storage.ts`                 | `uploadToR2`, `getSignedUrlR2`, `getSignedUploadUrlR2`, `existsInR2`, `getObjectBufferR2`, `isR2Configured()` | **réutilisé** (médias non-vidéo : PDF, sous-titres, devoirs)                                     |
| `src/lib/prisma.ts`                     | client Prisma **stub-aware** (`stub.invalid`)                                                                 | **réutilisé** ; impose le garde-fou stub dans chaque handler DB                                  |

### 1.2 Conventions héritées (toutes obligatoires)

- **`defaultJobOptions`** (queues.ts:41) : `attempts: 5`, backoff exponentiel 5 s, `removeOnComplete {age 7j, count 1000}`, `removeOnFail {age 30j, count 5000}`. On part de cette base et on **réduit `attempts`** selon la nature du job (cf. tableau §2.2).
- **Queue nullable** : `connection ? new Queue(...) : null`. Toujours. Sinon le build GH Actions (REDIS=`stub.invalid` → `getBullConnection()` renvoie une connexion lazy mais `BULLMQ_DISABLED=true` la coupe) plante.
- **Helper `enqueueXxx()` no-op** quand la queue est `null` (pattern `enqueueEmail` / `enqueueFormationGeneration`, queues.ts:505-540).
- **Worker** : `concurrency`, `lockDuration`, handlers `worker.on("ready"|"failed")`, `captureWorkerError(...)` dans `failed`.
- **Cron** = repeatable job dans `bootRepeatableJobs()` avec **`removeRepeatable(...)` AVANT `add(...)`** (idempotence HA scaling, queues.ts:639-657).
- **Stub-aware** dans tout handler qui lit/écrit la DB :
  ```ts
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    console.log("[elearning-crons] <job>: stub DB, skip");
    return;
  }
  ```
- **Fail-soft par entité** : un `try/catch` autour de **chaque** apprenant/leçon/cours ; une erreur n'interrompt jamais la boucle. Log + `captureWorkerError` au niveau worker.
- **Idempotence** : `jobId` déterministe + colonne « déjà fait » (`*GenereeAt`, `*EnvoyeAt`) + capture de `P2002` (unique constraint) traité comme succès — exactement comme `applyTransitionInTx` (crons-worker.ts:166-172).

### 1.3 Modèles existants réutilisés (vérifiés dans `schema.prisma`)

- `Trainee` (~5274), `Enrollment` (~5310, présentiel ; `attestationGenereeAt`, `tauxPresencePct`, `emargementSigneAt`), `Client` (~4890), `TrainingSession` (~statut machine `planifiee→en_cours→realisee`), `Formation`, `PortailAcces` (token 64hex), `DocumentGenere` (~5507, `qrToken`).
- Services réutilisés : `genererAttestationPourEnrollment` (attestation-service), `envoyerConvocation/RappelJ7/SatisfactionJ1/SuiviJ30` (notifications-service), `synchroniserAlertes` (alertes-service), `invalidateIndicateursCache`.

### 1.4 Modèles LMS référencés (NEUF — cf. data model)

`ElearningCourse`, `ElearningModule`, `ElearningLesson`, `ElearningResource` (doc `03-DATA-MODEL/01`). `ElearningEnrollment`, `LessonProgress` (doc `02`). `Quiz`, `Question`, `QuizAttempt` (doc `03`). `ElearningAccount`/`ElearningGrant`/`ElearningOrder` (doc `04`/`05`).

> **Ajout additif requis par les workers** (à intégrer dans le data model doc 02) : modèle de suivi du cycle de vie vidéo `ElearningVideoAsset` (§3.5) et table de traçabilité IA `ElearningAiJob` (§6.4). Tous deux **additifs**, colonnes nullable (ADR-LMS-0008).

---

## 2. Inventaire des queues e-learning

### 2.1 Déclaration (`src/server/queue/queues.ts`)

```ts
// ============================================================
// LMS e-learning — queues (feat/lms-elearning). ADR-LMS-0007.
// Toutes nullables (build stub.invalid) + attempts adaptés par nature.
// ============================================================

import type {
  ElearningCronJobData,
  ElearningCronJobType,
  ElearningVideoJobData,
  ElearningVideoJobName,
  ElearningCertificateJobData,
  ElearningAiJobData,
  ElearningAiJobName,
  ElearningTutorIndexJobData,
} from "./types";

/** Ingest/transcodage vidéo Cloudflare Stream. attempts:3 (API tierce flaky). */
export const elearningVideoQueue: Queue<ElearningVideoJobData, void, ElearningVideoJobName> | null =
  connection
    ? new Queue<ElearningVideoJobData, void, ElearningVideoJobName>("elearning-video", {
        connection,
        defaultJobOptions: { ...defaultJobOptions, attempts: 3 },
      })
    : null;

/** Crons e-learning (octroi, relances, certificats safety net, preuves, expiration). */
export const elearningCronsQueue: Queue<ElearningCronJobData, void, ElearningCronJobType> | null =
  connection
    ? new Queue<ElearningCronJobData, void, ElearningCronJobType>("elearning-crons", {
        connection,
        defaultJobOptions: { ...defaultJobOptions, attempts: 3 },
      })
    : null;

/** Génération certificat de réalisation (event-driven, post-complétion). */
export const elearningCertificateQueue: Queue<ElearningCertificateJobData> | null = connection
  ? new Queue<ElearningCertificateJobData>("elearning-certificate", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 3 },
    })
  : null;

/** IA pédagogique : quiz-gen + assistance authoring (event-driven). attempts:2 (coût IA). */
export const elearningAiQueue: Queue<ElearningAiJobData, void, ElearningAiJobName> | null =
  connection
    ? new Queue<ElearningAiJobData, void, ElearningAiJobName>("elearning-ai", {
        connection,
        defaultJobOptions: { ...defaultJobOptions, attempts: 2 },
      })
    : null;

/** (Ré)indexation RAG du tuteur (event-driven + cron nuit). attempts:1 (re-jouable). */
export const elearningTutorIndexQueue: Queue<ElearningTutorIndexJobData> | null = connection
  ? new Queue<ElearningTutorIndexJobData>("elearning-tutor-index", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;
```

### 2.2 Politique `attempts` / backoff / nettoyage

| Queue                   | attempts | backoff  | Justification                                                    |
| ----------------------- | -------- | -------- | ---------------------------------------------------------------- |
| `elearning-video`       | 3        | expo 5 s | API Cloudflare Stream tierce ; retries utiles mais pas infinis   |
| `elearning-crons`       | 3        | expo 5 s | DB temporairement indisponible ; idempotents → re-jouables       |
| `elearning-certificate` | 3        | expo 5 s | génération PDF + R2 ; doit aboutir (preuve légale)               |
| `elearning-ai`          | 2        | expo 5 s | appels LLM coûteux ; au-delà = échec remonté admin               |
| `elearning-tutor-index` | 1        | —        | rejouable à la prochaine publication/cron, pas de valeur à retry |

`removeOnComplete`/`removeOnFail` : héritent de `defaultJobOptions` (7 j / 30 j). Pour `elearning-certificate`, **garder les échecs 90 j** (`removeOnFail: { age: 90*24*3600 }`) car un certificat non généré est un risque de conformité à tracer longtemps.

### 2.3 Helpers d'enqueue (queues.ts) — pattern no-op obligatoire

```ts
export async function enqueueElearningVideoIngest(data: ElearningVideoJobData): Promise<void> {
  if (!elearningVideoQueue) {
    if (process.env.NODE_ENV !== "production" && !isBullmqDisabled())
      console.warn(
        `[bullmq] no connection, skipping enqueueElearningVideoIngest(${data.lessonId})`,
      );
    return;
  }
  // jobId déterministe = idempotence (ré-upload de la même leçon ne crée pas 2 jobs).
  await elearningVideoQueue.add("ingest", data, { jobId: `el-video-ingest-${data.assetId}` });
}

export async function enqueueElearningCertificate(
  data: ElearningCertificateJobData,
): Promise<void> {
  if (!elearningCertificateQueue) {
    /* …no-op log… */ return;
  }
  await elearningCertificateQueue.add("generate", data, {
    jobId: `el-cert-${data.enrollmentId}`, // 1 certificat par inscription → pas de doublon
  });
}

export async function enqueueElearningAi(
  name: ElearningAiJobName,
  data: ElearningAiJobData,
): Promise<void> {
  if (!elearningAiQueue) {
    /* …no-op log… */ return;
  }
  await elearningAiQueue.add(name, data, { jobId: `el-ai-${name}-${data.aiJobId}` });
}

export async function enqueueElearningTutorIndex(data: ElearningTutorIndexJobData): Promise<void> {
  if (!elearningTutorIndexQueue) {
    /* …no-op log… */ return;
  }
  // Coalescing : 1 job par cours en attente (dernière demande écrase la précédente).
  await elearningTutorIndexQueue.add("index", data, { jobId: `el-tutor-index-${data.courseId}` });
}
```

> **Important** : ces helpers sont appelés depuis les **Server Actions** (cf. `02-server-actions.md`) et depuis d'autres workers. Jamais d'appel direct à `queue.add()` ailleurs.

---

## 3. Worker #1 — `elearning-video-worker` (ingest & transcodage vidéo)

**Fichier :** `src/server/queue/workers/elearning-video-worker.ts`
**Queue :** `elearning-video` · **Service domaine :** `src/server/elearning/video/stream-service.ts`
**ADR :** Cloudflare Stream par défaut, Bunny en alternative UE (ADR-LMS-0005).

### 3.1 Problème résolu

R2 **stocke** mais ne **streame pas** (pas de HLS adaptatif — confirmé `r2-storage.ts`). La vidéo NE passe donc PAS par `ElearningResource.r2Key` mais par `ElearningLesson.videoAssetId` (id Cloudflare Stream). Le worker pilote le cycle de vie : **upload → transcodage → prêt → URL signée**. La transcodage est faite **par Cloudflare Stream** (pas de ffmpeg maison — ADR-LMS-0005) ; le worker **orchestre et réconcilie le statut**.

### 3.2 Cycle de vie d'un asset vidéo (`ElearningVideoAsset` — NEUF, additif)

```prisma
enum ElearningVideoStatut {
  en_attente_upload   // asset créé, upload URL signée émise
  uploading           // navigateur pousse vers Stream (tus / direct upload)
  en_transcodage      // Stream encode les rendus HLS
  pret                // playbackId disponible, sous-titres demandés
  echec               // erreur upload/transcodage (admin re-déclenche)
}

model ElearningVideoAsset {
  id            String   @id @default(uuid())
  lessonId      String?  @map("lesson_id")              // null tant que non rattaché
  provider      String   @default("cloudflare_stream")  // cloudflare_stream | bunny
  providerUid   String?  @map("provider_uid")           // = ElearningLesson.videoAssetId une fois prêt
  statut        ElearningVideoStatut @default(en_attente_upload)
  dureeSec      Int?     @map("duree_sec")
  readyToStream Boolean  @default(false) @map("ready_to_stream")
  thumbnailUrl  String?  @map("thumbnail_url")
  watermarkProfileId String? @map("watermark_profile_id")
  sousTitresKey String?  @map("sous_titres_key")        // .vtt sur R2 (WCAG)
  erreurMessage String?  @map("erreur_message")
  uploadedBy    String?  @map("uploaded_by")            // AdminUser.id
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
  @@index([statut])
  @@index([lessonId])
  @@map("elearning_video_assets")
}
```

### 3.3 Jobs (discriminés par `name`)

```ts
export type ElearningVideoJobName =
  | "ingest" // confirme l'upload, déclenche les options Stream (signed URLs, watermark)
  | "poll-status" // poll Stream API jusqu'à readyToStream=true (fallback si webhook manqué)
  | "request-captions" // demande la génération auto de sous-titres (Stream) OU upload .vtt R2
  | "purge-asset"; // suppression provider (leçon supprimée / RGPD)

export interface ElearningVideoJobData {
  assetId: string; // ElearningVideoAsset.id
  lessonId?: string;
  providerUid?: string;
}
```

### 3.4 Flux nominal (webhook-first, poll en filet de sécurité)

1. **Admin** (outil auteur) crée une leçon `type=video` → Server Action `createVideoLessonAction` :
   - appelle Stream API « direct creator upload » → reçoit `uploadURL` + `uid`
   - crée `ElearningVideoAsset { statut: en_attente_upload, providerUid: uid }`
   - renvoie `uploadURL` au navigateur (upload **direct** navigateur→Stream, jamais via Next — comme `getSignedUploadUrlR2` pour R2).
2. Navigateur upload → Stream encode.
3. **Cloudflare Stream webhook** `video.ready` → route `POST /api/elearning/stream-webhook` (App Router, `force-dynamic`, vérifie la signature `Webhook-Signature`) → met `statut: pret`, `readyToStream: true`, `providerUid`, `dureeSec`, `thumbnailUrl` ; copie `providerUid` dans `ElearningLesson.videoAssetId` + `videoDureeSec` ; **enqueue** `request-captions` ; **enqueue** `elearning-tutor-index` si transcription dispo.
4. **Filet de sécurité** : le cron `video-reconcile` (§4) ré-enqueue `poll-status` pour tout asset bloqué en `en_transcodage` > 30 min (webhook perdu).

```ts
async function handleIngest(data: ElearningVideoJobData): Promise<void> {
  if (stubDb()) return;
  const asset = await prisma.elearningVideoAsset.findUnique({ where: { id: data.assetId } });
  if (!asset || !asset.providerUid) return; // fail-soft : rien à faire
  if (asset.readyToStream) return; // idempotent : déjà prêt
  // Applique les options de protection : require signed URLs + watermark profile.
  await streamService.applySecurity(asset.providerUid, { requireSignedURLs: true });
  await prisma.elearningVideoAsset.update({
    where: { id: asset.id },
    data: { statut: "en_transcodage" },
  });
  // Amorce le poll (au cas où le webhook n'arrive jamais).
  await enqueueElearningVideoIngest({ ...data }); // ou add("poll-status", …, { delay: 60_000 })
}

async function handlePollStatus(data: ElearningVideoJobData): Promise<void> {
  if (stubDb()) return;
  const asset = await prisma.elearningVideoAsset.findUnique({ where: { id: data.assetId } });
  if (!asset?.providerUid || asset.readyToStream) return; // idempotent
  const remote = await streamService.getStatus(asset.providerUid);
  if (remote.readyToStream) {
    await prisma.$transaction(async (tx) => {
      await tx.elearningVideoAsset.update({
        where: { id: asset.id },
        data: {
          statut: "pret",
          readyToStream: true,
          dureeSec: remote.duration,
          thumbnailUrl: remote.thumbnail,
        },
      });
      if (asset.lessonId)
        await tx.elearningLesson.update({
          where: { id: asset.lessonId },
          data: { videoAssetId: asset.providerUid, videoDureeSec: remote.duration },
        });
    });
    await enqueueElearningVideoIngest({ ...data, lessonId: asset.lessonId }); // request-captions
  } else if (remote.status === "error") {
    await prisma.elearningVideoAsset.update({
      where: { id: asset.id },
      data: { statut: "echec", erreurMessage: remote.errorReason },
    });
    // alerte admin (Telegram MONITORING) via captureWorkerError + creerOuDedup alerte.
  } else {
    // toujours en cours : re-enqueue avec delay (BullMQ delayed job), borne à ~40 tentatives.
    throw new Error("video not ready yet"); // → retry backoff (attempts:3) OU délégué au cron reconcile
  }
}
```

> **Lecture côté apprenant** (hors worker, rappel) : le player demande une **URL signée Stream** à durée courte (~2-4 h) via Server Action `getLessonPlaybackTokenAction`, qui vérifie l'accès (`ElearningGrant`) et applique le **watermark dynamique** (email/ID apprenant). Jamais d'URL publique.

### 3.5 Idempotence & fail-soft vidéo

- `jobId` = `el-video-ingest-${assetId}` → un ré-upload ne crée pas 2 jobs.
- Tout handler **return tôt** si `readyToStream` déjà vrai (rejouable sans effet).
- Webhook + poll peuvent arriver en concurrence → la transition `→ pret` est gardée par `if (asset.readyToStream) return` + transaction.
- Bunny (alternative UE) : même contrat via une interface `VideoProvider` dans `stream-service.ts` ; `provider` choisi par env `ELEARNING_VIDEO_PROVIDER` (`cloudflare_stream` défaut).

---

## 4. Worker #2 — `elearning-crons-worker` (dispatcher cron unique)

**Fichier :** `src/server/queue/workers/elearning-crons-worker.ts`
**Queue :** `elearning-crons` · **Pattern :** copie conforme de `qualiopi-formation-crons-worker.ts` (1 queue, dispatch par `type`, handlers idempotents, fail-soft par entité, `concurrency: 1`, `lockDuration: 120_000`).

### 4.1 Types de jobs

```ts
export type ElearningCronJobType =
  | "elearning-crons.octroi-auto" // session realisee → octroi e-learning aux participants
  | "elearning-crons.relance-decrochage" // Ind.12 : inactifs → email + alerte tuteur
  | "elearning-crons.certificats-sweep" // filet de sécurité : complétions sans certificat
  | "elearning-crons.preuves-foad" // snapshot quotidien des preuves de réalisation
  | "elearning-crons.acces-expiration" // grants expirés → révoque l'accès
  | "elearning-crons.video-reconcile"; // assets bloqués en transcodage → re-poll

export interface ElearningCronJobData {
  type: ElearningCronJobType;
  tick: string;
}
```

### 4.2 Planning (cron patterns — choisis pour éviter les collisions existantes)

> Créneaux libres autour des crons déjà occupés (01:00 discovery, 02:00 inspector, 03:00 anomaly/retention/embeddings, 04:00 brand-voice, 05:00 news, 06:00 tier, 07:00 alertes, **08:00 formation+booking**, 09:00 attestations, 18:00 thanks).

| Job                  | Pattern UTC    | Rationale                                                                             |
| -------------------- | -------------- | ------------------------------------------------------------------------------------- |
| `octroi-auto`        | `30 8 * * *`   | **après** `formation-crons.cloture-auto` (08:00) qui passe les sessions en `realisee` |
| `certificats-sweep`  | `0 10 * * *`   | après l'octroi + laisse le temps aux complétions du matin                             |
| `relance-decrochage` | `0 11 * * *`   | heure « ouvrable » FR (≈ 12-13 h CET), bon taux d'ouverture                           |
| `preuves-foad`       | `30 23 * * *`  | fin de journée : fige le faisceau de preuves du jour                                  |
| `acces-expiration`   | `15 1 * * *`   | nuit, faible charge                                                                   |
| `video-reconcile`    | `*/10 * * * *` | filet de sécurité webhook (toutes les 10 min)                                         |

### 4.3 Handler `octroi-auto` — session présentiel/live réalisée → accès e-learning

**But.** Quand une `TrainingSession` passe `realisee`, ouvrir automatiquement l'accès au cours e-learning **adossé** (`ElearningCourse.formationId`) à chaque participant (`Enrollment` présent). Réutilise la sémantique de `handleAttestationsAuto` (crons-worker.ts:299).

```ts
async function handleOctroiAuto(): Promise<void> {
  if (stubDb()) return;
  // Sessions réalisées dont la formation a un cours e-learning, enrollments éligibles
  // sans octroi e-learning existant (idempotence par champ marqueur).
  const enrollments = await prisma.enrollment.findMany({
    where: {
      statut: { in: ["planifiee", "presente"] },
      session: { statut: "realisee", formation: { elearningCourses: { some: { statut: "publie" } } } },
      elearningGrantedAt: null,           // marqueur additif sur Enrollment (nullable)
    },
    select: { id: true, traineeId: true,
      session: { select: { formation: { select: {
        elearningCourses: { where: { statut: "publie" }, select: { id: true } } } } } } },
  });

  let ok = 0, ko = 0;
  for (const e of enrollments) {
    try {
      const courseIds = e.session.formation?.elearningCourses.map((c) => c.id) ?? [];
      for (const courseId of courseIds) {
        // grantAccess = service domaine idempotent (upsert ElearningGrant + ElearningAccount + PortailAcces token).
        await grantAccess({
          traineeId: e.traineeId, courseId, source: "auto_session_realisee",
          enrollmentId: e.id,
        });
      }
      await prisma.enrollment.update({ where: { id: e.id }, data: { elearningGrantedAt: new Date() } });
      // email d'invitation magic-link (réutilise queue emails).
      await enqueueEmail("elearning-acces-octroye", /* email */ , "fr", { /* payload */ });
      ok++;
    } catch (err) {
      ko++;
      console.error(`[elearning-crons] octroi-auto: erreur enrollment ${e.id}:`,
        err instanceof Error ? err.message : String(err));
    }
  }
  console.log(`[elearning-crons] octroi-auto: ${ok} octrois, ${ko} erreurs (${enrollments.length} candidats)`);
}
```

> **Octroi manuel & import CSV** (admin) passent par le **même** `grantAccess()` (service domaine, cf. `06-import-masse-provisioning.md`) avec `source: "manuel"` / `"import_csv"`. Le cron n'est qu'un déclencheur ; la logique d'octroi est centralisée et idempotente (upsert sur `@@unique([accountId, courseId])`).

### 4.4 Handler `relance-decrochage` — Qualiopi Ind.12 (assistance / anti-décrochage)

**Conformité.** Ind.12 (« la prise en compte des appréciations et l'engagement de l'apprenant ») + Ind.19 FOAD (assistance pédagogique). La relance automatique est une **preuve d'accompagnement** (faisceau R.6313-3). On relance les inactifs, on **escalade au tuteur** si pas de reprise, on **trace** chaque relance.

**Règles de détection (paramétrables via `ElearningCourse` / config) :**

- inactivité = `LessonProgress.lastSeenAt` (ou `ElearningEnrollment.lastActivityAt`) < `now − 7 j`, cours non complété, accès non expiré.
- ne relance pas un apprenant relancé il y a < 7 j (anti-spam via `ElearningEnrollment.lastNudgeAt`, additif nullable).
- 3 niveaux : J+7 (rappel doux apprenant), J+14 (rappel + ressources), J+21 (escalade tuteur interne = email `elearning-alerte-decrochage` au référent + alerte système `creerOuDedup`).

```ts
async function handleRelanceDecrochage(): Promise<void> {
  if (stubDb()) return;
  const now = new Date();
  const seuilInactif = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const candidates = await prisma.elearningEnrollment.findMany({
    where: {
      completedAt: null,
      access: { revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      lastActivityAt: { lt: seuilInactif },
      OR: [{ lastNudgeAt: null }, { lastNudgeAt: { lt: seuilInactif } }],
    },
    select: { id: true, traineeId: true, courseId: true, startedAt: true, lastActivityAt: true,
      lastNudgeAt: true, progressPct: true },
  });

  let nudged = 0, escalated = 0;
  for (const enr of candidates) {
    try {
      const joursInactif = Math.floor((now.getTime() - enr.lastActivityAt!.getTime()) / 86_400_000);
      if (joursInactif >= 21) {
        await enqueueEmail("elearning-alerte-decrochage", REFERENT_PEDAGO_EMAIL, "fr", { enrollmentId: enr.id });
        await creerOuDedup({ code: "EL_DECROCHAGE", refId: enr.id, /* … */ });
        escalated++;
      } else {
        const tpl = joursInactif >= 14 ? "elearning-relance-j14" : "elearning-relance-j7";
        await enqueueEmail(tpl, /* email apprenant */ , "fr", { enrollmentId: enr.id, progressPct: enr.progressPct });
        nudged++;
      }
      // Trace preuve d'accompagnement + anti-spam.
      await prisma.$transaction(async (tx) => {
        await tx.elearningEnrollment.update({ where: { id: enr.id }, data: { lastNudgeAt: now } });
        await tx.elearningAccompagnementLog.create({ data: {        // NEUF (doc 02) — preuve FOAD
          enrollmentId: enr.id, type: joursInactif >= 21 ? "escalade_tuteur" : "relance_auto",
          canal: "email", message: `relance J+${joursInactif}` } });
      });
    } catch (err) {
      console.error(`[elearning-crons] relance-decrochage: erreur enrollment ${enr.id}:`,
        err instanceof Error ? err.message : String(err));
    }
  }
  console.log(`[elearning-crons] relance-decrochage: ${nudged} relances, ${escalated} escalades (${candidates.length} inactifs)`);
}
```

> **`ElearningAccompagnementLog`** (NEUF, additif) = trace horodatée de chaque interaction d'assistance (relance auto, réponse tuteur, réponse à une question apprenant). C'est une **pièce du faisceau de preuves** exigé par R.6313-3 (le relevé de connexion seul est insuffisant — cf. `08-CONFORMITE/06-tracabilite-preuves-realisation.md`).

### 4.5 Handler `certificats-sweep` — filet de sécurité certificats

Le chemin nominal de génération de certificat est **event-driven** (worker #3, déclenché à la complétion). Ce cron est un **filet** : il rattrape toute complétion (`ElearningEnrollment.completedAt != null` & `scoreGlobalPct ≥ course.seuilReussitePct`) **sans certificat** (`certificateDocumentId == null`) — par ex. si l'event a échoué 3× ou si l'apprenant a complété pendant une panne worker.

```ts
async function handleCertificatsSweep(): Promise<void> {
  if (stubDb()) return;
  const pending = await prisma.elearningEnrollment.findMany({
    where: {
      completedAt: { not: null },
      certificateDocumentId: null,
      scoreGlobalPct: { not: null },
    },
    select: {
      id: true,
      courseId: true,
      scoreGlobalPct: true,
      course: { select: { seuilReussitePct: true } },
    },
  });
  let ok = 0,
    ko = 0;
  for (const enr of pending) {
    if ((enr.scoreGlobalPct ?? 0) < (enr.course.seuilReussitePct ?? 70)) continue; // pas réussi → pas de certif
    try {
      await enqueueElearningCertificate({ enrollmentId: enr.id, reason: "sweep" });
      ok++;
    } catch (err) {
      ko++; /* log */
    }
  }
  console.log(
    `[elearning-crons] certificats-sweep: ${ok} re-enqueués, ${ko} erreurs (${pending.length} candidats)`,
  );
}
```

### 4.6 Handler `preuves-foad` — snapshot quotidien du faisceau de preuves

Conformité FOAD (R.6313-3, preuve libre). Chaque nuit, **fige** un instantané agrégé par inscription active : temps cumulé (somme `LessonProgress.watchedSeconds`), nb de leçons complétées, nb de quiz réussis, dernière activité, nb de relances/réponses tuteur. Persiste dans `ElearningPreuveRealisationSnapshot` (NEUF, additif) — utilisé pour l'export OPCO/contrôle et le **certificat de réalisation** (heures réalisées). On **n'efface jamais** les snapshots (conservation 3-6 ans, cf. RGPD doc 05).

> Le snapshot est un **cache de preuve**, pas la source : les `LessonProgress`, `QuizAttempt`, `ElearningAccompagnementLog` restent la vérité. Le snapshot accélère les exports et garantit une trace même si une donnée fine est purgée.

### 4.7 Handler `acces-expiration` — révocation des accès expirés

`ElearningGrant` avec `expiresAt < now` & `revokedAt == null` → `revokedAt = now`. Idempotent (re-scan ne re-révoque pas). Email `elearning-acces-expire` optionnel. N'affecte pas les preuves déjà figées.

### 4.8 Handler `video-reconcile`

Filet de sécurité webhook : assets `statut: en_transcodage` & `updatedAt < now − 30 min` → `enqueueElearningVideoIngest({ name: "poll-status" })`. Borne : ignore les assets `> 24 h` en transcodage (les marque `echec` + alerte).

---

## 5. Worker #3 — `elearning-certificate-worker` (certificat de réalisation)

**Fichier :** `src/server/queue/workers/elearning-certificate-worker.ts`
**Queue :** `elearning-certificate` · **Réutilise** : `DocumentGenere` (+`qrToken`), pipeline `@react-pdf/renderer`, `uploadToR2`, et la mécanique de `genererAttestationPourEnrollment` (attestation-service Qualiopi).

### 5.1 Déclencheur (event-driven)

Appelé par la Server Action / le service qui constate la **complétion + réussite** d'un cours :

- toutes les leçons obligatoires complétées **ET** `scoreGlobalPct ≥ ElearningCourse.seuilReussitePct`
- → `markEnrollmentCompleted()` (service domaine) fixe `completedAt` + `scoreGlobalPct` puis `enqueueElearningCertificate({ enrollmentId, reason: "completion" })`.

```ts
export interface ElearningCertificateJobData {
  enrollmentId: string; // ElearningEnrollment.id
  reason: "completion" | "sweep" | "manual"; // traçabilité du déclencheur
}
```

### 5.2 Handler (idempotent, conforme)

```ts
async function handleGenerate(data: ElearningCertificateJobData): Promise<void> {
  if (stubDb()) return;
  const enr = await prisma.elearningEnrollment.findUnique({
    where: { id: data.enrollmentId },
    include: { course: true, trainee: true },
  });
  if (!enr || !enr.completedAt) return; // pas prêt → fail-soft
  if (enr.certificateDocumentId) return; // IDEMPOTENT : déjà généré
  if ((enr.scoreGlobalPct ?? 0) < (enr.course.seuilReussitePct ?? 70)) return; // pas réussi

  // Heures réalisées = somme watchedSeconds (preuve) → centièmes d'heure (modèle officiel).
  const heuresRealisees = await computeHeuresRealisees(enr.id); // service preuve (snapshot/agg)

  // Génère le PDF (modèle officiel « certificat de réalisation » depuis 01/06/2020).
  const { buffer, qrToken } = await renderCertificatRealisationPdf({
    apprenant: enr.trainee,
    cours: enr.course,
    heures: heuresRealisees,
    score: enr.scoreGlobalPct,
    dateRealisation: enr.completedAt,
  });
  const key = `documents/${enr.completedAt.getUTCFullYear()}/elearning-certificat/${qrToken}.pdf`;

  await prisma.$transaction(async (tx) => {
    const r2 = await uploadToR2(key, buffer, "application/pdf", { enrollmentId: enr.id });
    const doc = await tx.documentGenere.create({
      data: {
        type: "certificat_realisation_elearning",
        qrToken,
        r2Key: r2.key,
        hashSha256: sha256(buffer) /* … champs DocumentGenere existants … */,
      },
    });
    await tx.elearningEnrollment.update({
      where: { id: enr.id },
      data: { certificateDocumentId: doc.id, certificateGeneeAt: new Date() },
    });
  });

  await enqueueEmail("elearning-certificat-disponible", enr.trainee.email, "fr", {
    enrollmentId: enr.id,
    courseTitre: enr.course.titre,
  });
}
```

### 5.3 Conformité & idempotence

- **Modèle officiel** : certificat de réalisation (heures réalisées, en **centièmes d'heure**) — obligatoire depuis 01/06/2020. Réutilise le générateur PDF Qualiopi (parité avec attestation/convention).
- **QR + hash** : `qrToken` (vérification publique anti-fraude, comme `DocumentGenere` existant) + `hashSha256` (intégrité re-download).
- **Idempotence** : `jobId = el-cert-${enrollmentId}` + garde `if (certificateDocumentId) return`. Une re-complétion n'émet jamais 2 certificats.
- **Échecs conservés 90 j** (`removeOnFail`) — un certificat non émis est un risque de conformité.

---

## 6. Worker #4 — `elearning-ai-worker` (génération IA : quiz + authoring)

**Fichier :** `src/server/queue/workers/elearning-ai-worker.ts`
**Queue :** `elearning-ai` · **Réutilise** : `anthropicProvider` (`@/server/content-gen/providers/anthropic`), `withRetry`, `assertCostCapAvailable`/`trackCost` (cost-tracker), cache IA (pattern `buildCacheKey/getCachedIa/setCachedIa` du Formation Engine), et le **RAG/knowledge existant** pour l'ancrage document-grounded.
**Gate :** `ELEARNING_AI_ENABLED=true` (sinon worker no-op au `start`, pattern conditional spread comme `gsc-hcu-monitor-worker`).

### 6.1 Jobs

```ts
export type ElearningAiJobName =
  | "quiz-gen" // génère N questions depuis le contenu d'une leçon/module
  | "authoring-draft" // ébauche de leçon (plan + texte) document-grounded
  | "quiz-review"; // critique adversariale d'un quiz (qualité, pièges, ambiguïté)

export interface ElearningAiJobData {
  aiJobId: string; // ElearningAiJob.id (traçabilité, comme FormationGenerationJob)
  scope: { lessonId?: string; moduleId?: string; courseId?: string };
  params?: { nbQuestions?: number; types?: string[]; difficulte?: string };
}
```

### 6.2 `quiz-gen` — génération de quiz ancrée

1. `assertCostCapAvailable()` (pré-call, réutilise le kill-switch coût global content-gen).
2. Récupère le **contenu source** (texte de la leçon `contenuJson`, transcription vidéo, PDF extrait) → contexte.
3. Cache : `buildCacheKey(scope + params + hash(contenu))` → `getCachedIa` (hit = skip appel).
4. `withRetry(anthropicProvider.generate(...))` avec prompt système « générateur de quiz pédagogique » imposant : ancrage **strict** au contenu fourni (anti-hallucination, réutilise `hasUnsourcedClaims`), types demandés (QCM mono/multi, vrai-faux, appariement, texte à trous…), **rationale obligatoire** par question, niveau de difficulté.
5. `trackCost(...)` (post-call).
6. Écrit des `Question` en **brouillon** rattachées à un `Quiz` (ou à la banque de questions) avec `statut: "propose_ia"` → **jamais publiées sans revue humaine** (parité avec FileValidation du Formation Engine).
7. `setCachedIa(...)` + trace `ElearningAiJob` (étape, tokens, coût, modèle, cacheHit, dureeMs).

> **Règle d'or (héritée du Formation Engine)** : l'IA **propose**, l'humain **valide**. Aucun quiz IA n'est servi à un apprenant sans passage par l'outil auteur (statut `propose_ia → valide`).

### 6.3 `authoring-draft` & `quiz-review`

- `authoring-draft` : à partir d'un document source (PDF/notes uploadés sur R2 + knowledge RAG), produit un **plan de leçon** + texte d'ébauche (blocs Tiptap/JSON) en brouillon. Document-grounded, citations conservées.
- `quiz-review` : `runAdversarialCritique`-like sur un quiz existant (détecte questions ambiguës, distracteurs implausibles, réponses multiples valides, fuite de réponse). Sort un rapport pour l'auteur.

### 6.4 `ElearningAiJob` (NEUF, additif) — traçabilité IA

Miroir de `FormationGenerationJob` : `{ id, name, scope, statut (en_cours|reussi|echec), modele, inputTokens, outputTokens, coutUsd, cacheHit, dureeMs, erreurMessage, resultRef, createdAt }`. Permet le suivi coût/qualité dans l'admin et le re-jeu.

### 6.5 Idempotence & fail-soft IA

- `jobId = el-ai-${name}-${aiJobId}` (1 job par demande tracée).
- `assertCostCapAvailable` peut throw `UnrecoverableError` → pas de retry inutile quand le cap mensuel est atteint (parité Formation Engine).
- Cache IA → re-run quasi gratuit (idempotent économiquement).
- Échec après `attempts:2` → `ElearningAiJob.statut = echec` + visible admin ; **aucun** contenu partiel publié.

---

## 7. Worker #5 — `elearning-tutor-index-worker` (indexation RAG du tuteur)

**Fichier :** `src/server/queue/workers/elearning-tutor-index-worker.ts`
**Queue :** `elearning-tutor-index` · **Gate :** `ELEARNING_TUTOR_ENABLED=true`.
**Réutilise** le pipeline d'embeddings/RAG existant (knowledge/chatbot-ingest) — on **n'invente pas** un second système vectoriel.

### 7.1 Rôle

Le **tuteur RAG** (assistance pédagogique Ind.19) répond aux questions des apprenants **ancré sur le contenu du cours** avec citations. Son **index** doit refléter le contenu publié. Ce worker (re)construit/maintient les chunks vectoriels par cours.

### 7.2 Déclencheurs

- **Event-driven** : à la **publication** d'un cours (`statut → publie`, version++) → `enqueueElearningTutorIndex({ courseId })` ; à l'arrivée d'une **transcription vidéo** (webhook Stream § 3.4).
- **Cron nuit** : `30 3 * * *` (re-sync de sécurité, capture les contenus modifiés ratés). À ajouter dans `bootRepeatableJobs()` (queue `elearning-tutor-index`, jobId `elearning-tutor-index-cron`).

### 7.3 Handler

`coalescing` par `jobId = el-tutor-index-${courseId}` (la dernière demande écrase la précédente en attente). Parcourt modules→leçons publiées, chunk le texte (réutilise le chunker knowledge), calcule les embeddings (réutilise le provider embeddings existant, gate `OPENAI_EMBEDDINGS_ENABLED`/Voyage selon config), upsert dans la table de chunks RAG e-learning (`ElearningKbChunk`, NEUF additif, ou réutilisation `chat_kb_chunks` taggé `source=elearning:courseId`). Stub-aware + fail-soft par leçon.

---

## 8. Emails — réutilisation de la queue `emails` (PAS de nouvelle queue)

Tous les emails e-learning passent par la **queue `emails` existante** via `enqueueEmail(template, to, locale, payload, options?)` (queues.ts:605). On **ajoute uniquement** des `EmailJobName` dans `src/server/queue/types.ts` et les templates React Email correspondants sous `src/lib/email/templates/elearning-*.tsx` (consommés par `email-worker.ts`, inchangé).

### 8.1 Nouveaux `EmailJobName` à ajouter

```ts
// === LMS e-learning ===
| "elearning-acces-octroye"        // invitation magic-link (octroi auto/manuel/CSV)
| "elearning-relance-j7"           // anti-décrochage doux (Ind.12)
| "elearning-relance-j14"          // anti-décrochage + ressources
| "elearning-alerte-decrochage"    // escalade tuteur interne (J+21)
| "elearning-certificat-disponible"// certificat de réalisation prêt
| "elearning-acces-expire"         // accès arrivé à échéance
| "elearning-quiz-correction-manuelle" // essai/upload corrigé → résultat dispo
| "elearning-tuteur-reponse";      // le tuteur/référent a répondu à une question
```

### 8.2 Règles

- **Transactionnel vs marketing** : tous les emails e-learning ci-dessus sont **transactionnels** (`marketing` omis → expéditeur `noreply@`, conforme CLAUDE.md §11). Une éventuelle newsletter « nouveaux cours » serait `marketing: true`.
- **Idempotence email** : passer un `options.jobId` déterministe quand le contexte l'exige (ex. `jobId: "el-cert-mail-" + enrollmentId`) pour éviter le double-envoi si un cron rejoue.
- **Délai** : `options.delayMs` pour les séquences (déjà supporté).
- **Magic-link** : l'octroi génère/réutilise un `PortailAcces` (token 64 hex, cookie HttpOnly 90 j) — **aucune création de mot de passe** par défaut (ADR-LMS-0001). Le mot de passe optionnel entreprise est un autre chemin (auth apprenant, doc 05).

---

## 9. Modifications du bootstrap

### 9.1 `src/server/queue/worker.ts` — enregistrement des workers

```ts
// LMS e-learning (feat/lms-elearning) — ADR-LMS-0007.
import { startElearningVideoWorker } from "./workers/elearning-video-worker";
import { startElearningCronsWorker } from "./workers/elearning-crons-worker";
import { startElearningCertificateWorker } from "./workers/elearning-certificate-worker";
import { startElearningAiWorker } from "./workers/elearning-ai-worker";
import { startElearningTutorIndexWorker } from "./workers/elearning-tutor-index-worker";

// … dans le tableau `workers` :
    startElearningVideoWorker(),         // ingest/transcodage Cloudflare Stream (toujours actif)
    startElearningCronsWorker(),         // octroi/relances/certif-sweep/preuves/expiration/video-reconcile
    startElearningCertificateWorker(),   // certificat de réalisation (event-driven)
    // Env-gated : conditional spread (évite le throw au start si flag absent — cf. external-links).
    ...(process.env.ELEARNING_AI_ENABLED === "true" ? [startElearningAiWorker()] : []),
    ...(process.env.ELEARNING_TUTOR_ENABLED === "true" ? [startElearningTutorIndexWorker()] : []),
```

> Les workers env-gated **throw au `start()`** si le flag est absent → on les démarre **uniquement** via spread conditionnel (sinon ils crashent tout le boot, donc tous les autres workers — leçon apprise `worker.ts:114-119`).

### 9.2 `bootRepeatableJobs()` (queues.ts) — crons e-learning

Ajouter, en fin de fonction (après le bloc Qualiopi T6), 2 blocs :

```ts
// ============================================================
// LMS e-learning — crons (feat/lms-elearning).
// ============================================================
if (elearningCronsQueue) {
  const elearningCronSchedule: Array<{
    type: ElearningCronJobType;
    pattern: string;
    jobId: string;
  }> = [
    {
      type: "elearning-crons.octroi-auto",
      pattern: "30 8 * * *",
      jobId: "elearning-octroi-auto-cron",
    },
    {
      type: "elearning-crons.certificats-sweep",
      pattern: "0 10 * * *",
      jobId: "elearning-certificats-sweep-cron",
    },
    {
      type: "elearning-crons.relance-decrochage",
      pattern: "0 11 * * *",
      jobId: "elearning-relance-decrochage-cron",
    },
    {
      type: "elearning-crons.preuves-foad",
      pattern: "30 23 * * *",
      jobId: "elearning-preuves-foad-cron",
    },
    {
      type: "elearning-crons.acces-expiration",
      pattern: "15 1 * * *",
      jobId: "elearning-acces-expiration-cron",
    },
    {
      type: "elearning-crons.video-reconcile",
      pattern: "*/10 * * * *",
      jobId: "elearning-video-reconcile-cron",
    },
  ];
  for (const { type, pattern, jobId } of elearningCronSchedule) {
    await elearningCronsQueue.removeRepeatable(type, { pattern }, jobId); // idempotence HA
    await elearningCronsQueue.add(
      type,
      { type, tick: new Date().toISOString() },
      { repeat: { pattern }, jobId },
    );
  }
}

// Tuteur RAG — re-sync nocturne de sécurité (event-driven le reste du temps).
if (elearningTutorIndexQueue) {
  await elearningTutorIndexQueue.removeRepeatable(
    "cron",
    { pattern: "30 3 * * *" },
    "elearning-tutor-index-cron",
  );
  await elearningTutorIndexQueue.add(
    "cron",
    { courseId: "__ALL__", tick: new Date().toISOString() },
    { repeat: { pattern: "30 3 * * *" }, jobId: "elearning-tutor-index-cron" },
  );
}
```

---

## 10. Idempotence — récapitulatif des garanties

| Mécanisme                      | Où                                                                                                                           | Garantie                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `jobId` déterministe           | tous les `enqueue*`                                                                                                          | un même événement n'empile pas 2 jobs (BullMQ dédoublonne sur jobId) |
| `removeRepeatable` avant `add` | `bootRepeatableJobs()`                                                                                                       | pas d'accumulation de crons en HA / re-déploiement                   |
| Marqueur « déjà fait »         | `Enrollment.elearningGrantedAt`, `ElearningEnrollment.certificateGeneeAt`/`lastNudgeAt`, `ElearningVideoAsset.readyToStream` | re-scan = no-op                                                      |
| Garde unique constraint        | `@@unique([accountId, courseId])`, capture `P2002` → succès                                                                  | double octroi impossible                                             |
| Return-tôt sur état terminal   | `if (readyToStream) return`, `if (certificateDocumentId) return`                                                             | re-jeu sans effet de bord                                            |
| Cache IA                       | `getCachedIa`                                                                                                                | re-run quasi gratuit + déterministe                                  |

---

## 11. Fail-soft & observabilité

- **Fail-soft par entité** : chaque boucle (`for (const … )`) entoure le traitement d'un `try/catch` qui log et continue. Compteurs `ok/ko/scannés` en fin de handler (parité crons Qualiopi).
- **Stub-aware** : garde `stub.invalid` en tête de chaque handler DB (build GH Actions n'a pas de DB).
- **Sentry** : `captureWorkerError("elearning", "<queue>", job, err)` dans chaque `worker.on("failed")`.
- **Alertes système** : décrochage escaladé, échec transcodage > 24 h, certificat en échec répété → `creerOuDedup` (réutilise le moteur d'alertes Qualiopi) + visibles admin.
- **Monitoring queue stuck** : le cron existant `content-monitoring` (`alertQueueStuck`) couvre déjà toute queue BullMQ en attente > 30 min — **rien à ajouter**, les queues e-learning en bénéficient automatiquement.
- **Coûts IA** : `trackCost` alimente le compteur global ; le kill-switch `cost-cap-reset` mensuel s'applique aussi à `elearning-ai`.

---

## 12. Drapeaux d'environnement (Coolify)

| Flag                                                           | Défaut              | Effet                                                                          |
| -------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------ |
| `ELEARNING_VIDEO_PROVIDER`                                     | `cloudflare_stream` | `cloudflare_stream` \| `bunny`                                                 |
| `CLOUDFLARE_STREAM_ACCOUNT_ID` / `_API_TOKEN` / `_SIGNING_KEY` | —                   | accès API + URLs signées + watermark                                           |
| `ELEARNING_STREAM_WEBHOOK_SECRET`                              | —                   | vérif signature webhook `video.ready`                                          |
| `ELEARNING_AI_ENABLED`                                         | `false`             | démarre `elearning-ai-worker` (V1)                                             |
| `ELEARNING_TUTOR_ENABLED`                                      | `false`             | démarre `elearning-tutor-index-worker` (V1)                                    |
| `ELEARNING_REFERENT_PEDAGO_EMAIL`                              | —                   | destinataire escalade décrochage (Ind.12)                                      |
| `EDOF_ENABLED`                                                 | `false`             | (V2) entrée effective / service fait CPF — **hors workers MVP** (ADR-LMS-0003) |

> Réutilise `R2_*` (médias non-vidéo), la connexion `REDIS_URL`, `BULLMQ_DISABLED`, `DATABASE_URL` (stub-aware) déjà en place.

---

## 13. Phasage des workers (aligné roadmap)

| Worker / cron                                                           | MVP | V1  | V2  |
| ----------------------------------------------------------------------- | :-: | :-: | :-: |
| `elearning-video` (ingest/transcodage)                                  | ✅  |     |     |
| `elearning-crons.octroi-auto`                                           | ✅  |     |     |
| `elearning-certificate`                                                 | ✅  |     |     |
| `elearning-crons.preuves-foad` / `acces-expiration` / `video-reconcile` | ✅  |     |     |
| emails `elearning-acces-octroye` / `certificat-disponible`              | ✅  |     |     |
| `elearning-crons.relance-decrochage` (Ind.12) + emails relance          |     | ✅  |     |
| `elearning-ai` (quiz-gen, authoring)                                    |     | ✅  |     |
| `elearning-tutor-index` (RAG)                                           |     | ✅  |     |
| EDOF cron (entrée effective / service fait)                             |     |     | ✅  |

> MVP : l'octroi auto, les certificats, les preuves FOAD et l'ingest vidéo suffisent à « un apprenant reçoit un accès, suit le cours, obtient un certificat ; toutes les preuves FOAD sont produites » (critère de sortie MVP, roadmap §MVP). Les relances Ind.12 et l'IA arrivent en V1.

---

## 14. Tests (parité `qualiopi-formation-crons-worker.spec.ts`)

- **Logique pure extraite & testée** : exporter `elearningCronsHandler(data)` + un module de décision pur (ex. `decideRelanceLevel(joursInactif)`, `isCertifiable(enr, course)`) testables en isolation (Vitest, PrismaClient mock — non affecté par le stub Proxy build-time).
- **Idempotence** : test « rejouer le même job 2× ne crée pas 2 octrois / 2 certificats » (vérifie marqueurs + capture P2002).
- **Fail-soft** : un enrollment qui throw ne bloque pas les suivants (compteurs `ok/ko`).
- **Stub-aware** : `DATABASE_URL=…stub.invalid` → handler return immédiat, 0 query.
- **Fenêtres temporelles** : relance J+7/J+14/J+21 (bornes), video-reconcile > 30 min (parité fenêtres `handleRappelJ7`).

---

## Liens

- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — `ElearningCourse/Module/Lesson/Resource`, enums (source des noms)
- `03-DATA-MODEL/02-schema-progression-tracking.md` — `ElearningEnrollment`, `LessonProgress` + **ajouts additifs requis ici** (`ElearningVideoAsset`, `ElearningAccompagnementLog`, `ElearningPreuveRealisationSnapshot`, `ElearningAiJob`, marqueurs `lastNudgeAt`/`elearningGrantedAt`/`certificateGeneeAt`)
- `03-DATA-MODEL/03-schema-quiz-evaluations.md` — `Quiz/Question/QuizAttempt` (cible de `quiz-gen`)
- `03-DATA-MODEL/04-schema-comptes-acces-auth.md` — `ElearningAccount`/`ElearningGrant` (cible de `grantAccess`)
- `04-BACKEND/02-server-actions.md` — actions qui appellent `enqueue*` (octroi manuel, upload vidéo, publication)
- `04-BACKEND/06-import-masse-provisioning.md` — `grantAccess()` partagé (auto/manuel/CSV)
- `04-BACKEND/07-pipeline-video-streaming.md` — détail Cloudflare Stream / Bunny, URLs signées, watermark, webhook
- `04-BACKEND/08-ia-pedagogique-generation.md` — prompts quiz-gen/authoring, ancrage RAG, anti-hallucination
- `04-BACKEND/09-tuteur-rag-assistant.md` — tuteur synchrone (le worker #5 n'en indexe que le corpus)
- `04-BACKEND/10-emails-notifications.md` — templates React Email `elearning-*`
- `08-CONFORMITE/01-foad-d6313-3-1.md` & `06-tracabilite-preuves-realisation.md` — pourquoi `preuves-foad` + `ElearningAccompagnementLog`
- `08-CONFORMITE/02-qualiopi-indicateurs-foad.md` — Ind.11 (évaluations), Ind.12 + Ind.19 (relances/assistance)
- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-LMS-0005 (vidéo), 0006 (xAPI grammaire), 0007 (cloisonnement), 0008 (migrations additives)
