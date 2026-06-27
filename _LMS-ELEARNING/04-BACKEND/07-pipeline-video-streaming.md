# Backend — Pipeline vidéo & streaming (Cloudflare Stream)

> Spécification implémentable du pipeline vidéo du LMS : choix du fournisseur, ingestion (upload auteur), encodage HLS adaptatif, lecture protégée (URLs signées + watermark dynamique), sous-titres (auto + relus), lecture mobile, intégration R2, coûts et fallback.
>
> Ancrée sur le code réel d'Axion-IA. Respecte les ADR du dossier (notamment **ADR-LMS-0005** vidéo, **ADR-LMS-0007** cloisonnement, **ADR-LMS-0008** migrations additives) et le contrat de build `stub.invalid` (ADR plateforme 0026).
>
> Statut : rédigé. Cible : MVP (lot 4 de la roadmap, `11-ROADMAP/01-phasage-mvp-v1-v2.md`).

---

## 0. TL;DR — la décision

| Question                                                        | Réponse                                                                                                                                                                                                                        |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Fournisseur**                                                 | **Cloudflare Stream** par défaut. **Bunny Stream** = plan B documenté (bascule sans refonte grâce à l'abstraction `VideoProvider`).                                                                                            |
| **Pourquoi pas R2 seul ?**                                      | R2 **stocke** mais ne **transcode ni ne streame** (pas de HLS adaptatif, pas de ladder de qualité, pas de protection token native). Servir du MP4 brut depuis R2 = mauvaise UX mobile + egress non maîtrisé + zéro protection. |
| **Pourquoi pas l'auto-hébergement (ffmpeg + HLS sur R2/VPS) ?** | Coût/complexité prohibitifs : transcodage CPU sur le CPX42 déjà saturé au build SSG, packaging HLS maison, signature de segments, pas de player managé. **Hors budget, hors valeur métier.**                                   |
| **Pourquoi pas Mux ?**                                          | Stream coûte **~6× moins cher** à bande passante équivalente, et on est **déjà sous Cloudflare** (R2, CDN, WAF, purge) → un seul fournisseur, une seule facture, un seul support.                                              |
| **Protection**                                                  | **URLs signées** (JWT court TTL) + **watermark dynamique par apprenant** (e-mail/ID incrusté). **Pas de DRM Widevine/FairPlay au lancement** (réservé au premium haute valeur, V2+).                                           |
| **Sous-titres**                                                 | Génération **auto** par Stream (`/captions/<lang>/generate`), **relus/corrigés** par l'auteur, stockés aussi sur R2 (`.vtt`) comme `ElearningResource type=sous_titres` (preuve + accessibilité WCAG).                         |
| **Stockage**                                                    | Vidéos → **Cloudflare Stream** (`videoAssetId`). PDF / slides / `.vtt` / pièces jointes → **R2** (`src/lib/r2-storage.ts`, existant). Les deux mondes coexistent, ne se mélangent pas.                                         |

> Cette décision matérialise **ADR-LMS-0005**. Réversible : tout passe par une interface `VideoProvider` (cf. §4) ; changer de fournisseur = écrire un second adaptateur, pas réécrire le LMS.

---

## 1. Pourquoi Cloudflare Stream (analyse comparative)

### 1.1 Critères

| Critère                         | Cloudflare Stream                                                        | Bunny Stream                       | Mux                 | Auto-hébergé (R2 + ffmpeg)              |
| ------------------------------- | ------------------------------------------------------------------------ | ---------------------------------- | ------------------- | --------------------------------------- |
| HLS/DASH adaptatif managé       | ✅ natif                                                                 | ✅ natif                           | ✅ natif            | ❌ à construire                         |
| Encodage inclus                 | ✅ (au stockage minute)                                                  | ✅                                 | ✅                  | ❌ (CPU à payer)                        |
| Bande passante incluse          | ✅ (compteur « minutes livrées »)                                        | ⚠️ facturée au Go (très bas)       | ⚠️ facturée         | ⚠️ egress R2 (mais R2 egress = 0) + CPU |
| URLs signées natives            | ✅ (signed tokens)                                                       | ✅ (token auth)                    | ✅                  | ❌ à construire (présigner segments)    |
| Watermark dynamique par user    | ⚠️ pas natif par-user → **overlay client** (cf. §5.3)                    | ⚠️ idem                            | ⚠️ idem             | ⚠️ idem                                 |
| Sous-titres auto (STT)          | ✅ `generate` (beta GA 2025)                                             | ✅ (AI transcribe)                 | ✅ (auto-generated) | ❌                                      |
| Player managé + signed playback | ✅ (`<stream>` / SDK + HLS.js)                                           | ✅                                 | ✅                  | ❌                                      |
| Résidence données UE            | ⚠️ réseau global (option « Regional Services »/jurisdiction EU possible) | ✅ **UE pur** (storage zone EU)    | ⚠️ US-centric       | ✅ (R2 EU)                              |
| Déjà dans la stack              | ✅ **R2 + CDN + WAF + purge déjà Cloudflare**                            | ❌ nouveau fournisseur             | ❌                  | ➖                                      |
| Coût relatif                    | **bas**                                                                  | **très bas** (mais 2 fournisseurs) | élevé               | « gratuit » en € mais cher en temps/ops |

### 1.2 Verdict

**Cloudflare Stream gagne** sur l'intégration (un seul fournisseur déjà en place : R2, CDN Cloudflare, purge, WAF), le modèle de prix simple et prévisible, les signed URLs natives, et la génération de sous-titres. Bunny est légèrement moins cher au Go et **100 % UE** : on le garde comme **plan B activable** si la résidence des données UE devient une exigence contractuelle (RGPD entreprise/OPCO). L'abstraction `VideoProvider` (§4) rend ce switch peu coûteux.

> ⚠️ **Point de vigilance RGPD à tracer dans `08-CONFORMITE/05-rgpd-conservation-preuves.md`** : Cloudflare Stream sert depuis un réseau mondial. Pour un OF français manipulant des données apprenants, documenter la base légale + DPA Cloudflare, et envisager Bunny EU si un client entreprise l'exige par contrat. C'est précisément pourquoi l'abstraction provider existe.

---

## 2. Place dans le data model existant (EXISTANT vs NEUF)

### 2.1 Ce qui existe déjà et est réutilisé

- **`ElearningLesson.videoAssetId`** (`String?`) et **`ElearningLesson.videoDureeSec`** (`Int?`) — déjà définis dans `03-DATA-MODEL/01-schema-cours-modules-lecons.md` §5. **C'est le seul pont entre le LMS et le fournisseur vidéo.** `videoAssetId` = l'UID Cloudflare Stream (ou GUID Bunny). On ne stocke **jamais** d'URL de lecture en base (elle est signée à la volée, TTL court).
- **`ElearningResource`** (`03-DATA-MODEL/01` §6) — porte les médias R2 : on l'utilise pour **les fichiers `.vtt` de sous-titres relus** (`type = "sous_titres"`, `r2Key`), les transcriptions téléchargeables, et un éventuel **MP4 de secours** (fallback download, cf. §10).
- **`src/lib/r2-storage.ts`** (EXISTANT) — `uploadToR2`, `getSignedUrlR2`, `getSignedUploadUrlR2`, `existsInR2`, `getObjectBufferR2`. Réutilisé tel quel pour tout ce qui n'est pas la vidéo elle-même (sous-titres, posters, transcripts).
- **BullMQ** (`src/server/queue/queues.ts`, `worker.ts`, `connection.ts`) — pattern de queue + worker + cron déjà rôdé (38 workers en prod). On ajoute **2 queues** et **1 worker** (cf. §6).
- **`PortailAcces`** (`schema.prisma:6236`) — modèle d'accès apprenant (token 64 hex, cookie HttpOnly 90 j). L'auth apprenant LMS (cf. `04-BACKEND/05-authentification-apprenant.md`) s'appuie dessus ; **le watermark et la signature vidéo lisent l'identité apprenant depuis cette session** (pas depuis NextAuth admin).
- **Route handler de streaming/SSE** : pattern déjà présent (`src/app/api/content-gen/jobs/[id]/stream/route.ts`, `src/app/api/admin/invoices/[id]/pdf/route.ts`, `src/app/api/presse/media/[id]/route.ts`) → on calque la route de tokenisation vidéo dessus.

### 2.2 Ce qui est NEUF (à construire)

1. **Modèle `ElearningVideoAsset`** (registre interne des vidéos, miroir de l'état Stream) — cf. §3. Migration **additive**.
2. **Enum `ElearningVideoStatut`** — cycle de vie d'ingestion.
3. **Champs additifs** sur `ElearningResource` pour distinguer le rôle « poster / transcript / sous-titres » (déjà couvert par `type`, pas de migration supplémentaire requise).
4. **Abstraction `VideoProvider`** (`src/server/elearning/video/provider.ts`) + adaptateurs Stream / Bunny — cf. §4.
5. **Workers** `elearning-video-ingest-worker.ts` + queue de polling d'état, `elearning-video-captions-worker.ts` (sous-titres) — cf. §6.
6. **Routes** de upload (tus/direct), de webhook Stream, et de **playback token signé** — cf. §7.
7. **Composant lecteur** `src/components/elearning/VideoPlayer.tsx` (HLS.js + overlay watermark) — cf. §5/§9 (détail UX dans `05-FRONTEND-APPRENANT/02-lecteur-cours-player.md`).
8. **Variables d'environnement** `STREAM_*` / `BUNNY_*` + flag — cf. §8.

---

## 3. Modèle Prisma `ElearningVideoAsset` (NEUF, additif)

`ElearningLesson.videoAssetId` suffit pour _lire_, mais on a besoin d'un **registre interne** pour : suivre l'état d'ingestion (uploading → encoding → ready), stocker la durée/résolution/poster, lier l'asset à l'auteur qui l'a uploadé, archiver les preuves (hash, taille), et savoir quels sous-titres sont prêts. On ne veut **pas** dépendre d'un aller-retour API Stream à chaque rendu de page.

```prisma
/// Statut d'ingestion d'une vidéo chez le fournisseur (Cloudflare Stream/Bunny).
/// Modélisé sur les états renvoyés par l'API Stream (pendingupload/queued/
/// inprogress/ready/error) en les normalisant.
enum ElearningVideoStatut {
  en_attente_upload   // asset créé, upload pas terminé (tus/direct)
  en_transcodage      // upload reçu, encodage HLS en cours côté fournisseur
  pret                // ready : lecture HLS disponible
  erreur              // échec encodage / fichier invalide
}

/// Registre interne d'une vidéo hébergée chez le fournisseur de streaming.
/// 1 asset = 1 vidéo source. Une ElearningLesson(type=video) référence
/// `providerUid` via `ElearningLesson.videoAssetId`.
/// NB : aucune URL de lecture n'est stockée — elle est signée à la volée.
model ElearningVideoAsset {
  id            String               @id @default(uuid()) @db.Uuid

  /// "cloudflare_stream" | "bunny" — quel adaptateur a créé l'asset (ADR-0005).
  provider      String               @default("cloudflare_stream") @db.VarChar(40)
  /// UID/GUID chez le fournisseur. = ElearningLesson.videoAssetId.
  providerUid   String               @unique @map("provider_uid") @db.VarChar(120)

  statut        ElearningVideoStatut @default(en_attente_upload)
  titre         String?              @db.VarChar(250)

  // Métadonnées remplies au webhook "ready" (cf. §7.3)
  dureeSec      Int?                 @map("duree_sec")
  largeurPx     Int?                 @map("largeur_px")
  hauteurPx     Int?                 @map("hauteur_px")
  /// % d'avancement encodage (0-100), pour l'UI auteur.
  progressPct   Int                  @default(0) @map("progress_pct")
  /// Poster/thumbnail : clé R2 (on copie le thumbnail Stream sur R2 pour
  /// servir un poster stable, cache-friendly, sans signed URL).
  posterR2Key   String?              @map("poster_r2_key")

  // Intégrité / preuves
  sourceSizeBytes BigInt?            @map("source_size_bytes")
  sourceSha256    String?            @map("source_sha256") @db.VarChar(64)
  /// Clé R2 d'un MP4 de secours (download/fallback) — optionnel (cf. §10).
  fallbackMp4R2Key String?           @map("fallback_mp4_r2_key")

  // Sous-titres : état de génération auto + relecture (cf. §5.4)
  /// ["fr"] par défaut. Langues pour lesquelles un .vtt RELU existe.
  captionsLangues Json               @default("[]") @map("captions_langues")
  captionsAutoGenerees Boolean       @default(false) @map("captions_auto_generees")
  captionsRelues  Boolean            @default(false) @map("captions_relues")

  /// Auteur (AdminUser) ayant uploadé — traçabilité authoring.
  uploadedById  String?              @map("uploaded_by_id") @db.Uuid

  /// Erreur fournisseur (raison du statut=erreur), pour debug auteur.
  erreurMessage String?              @map("erreur_message") @db.Text

  createdAt     DateTime             @default(now()) @map("created_at")
  updatedAt     DateTime             @updatedAt @map("updated_at")

  @@index([statut])
  @@index([provider])
  @@map("elearning_video_assets")
}
```

**Lien avec `ElearningLesson`** : la leçon référence `providerUid` via son champ existant `videoAssetId`. On garde ce couplage « souple » (string, pas de FK) pour rester cohérent avec le doc 01 déjà écrit et éviter une migration sur `ElearningLesson`. Une requête `findUnique({ where: { providerUid }})` fait le join applicatif quand on a besoin des métadonnées.

> **Migration** (additive, ADR-LMS-0008) : `CREATE TYPE elearning_video_statut` + `CREATE TABLE elearning_video_assets`. Aucun DROP, aucune colonne non-nullable ajoutée à une table existante. Détail dans `03-DATA-MODEL/06-strategie-migrations.md`.

---

## 4. Abstraction fournisseur `VideoProvider` (NEUF)

Cœur de la réversibilité ADR-0005. Toute la logique LMS parle à cette interface, jamais directement à l'API Cloudflare.

**Fichier** : `src/server/elearning/video/provider.ts`

```ts
// src/server/elearning/video/provider.ts
export interface VideoUploadTicket {
  /** URL d'upload direct (tus ou one-time) à donner au navigateur de l'auteur. */
  uploadUrl: string;
  /** UID/GUID provider — à stocker dans ElearningVideoAsset.providerUid. */
  providerUid: string;
  /** Headers/champs additionnels requis par le provider (tus). */
  extra?: Record<string, string>;
}

export interface SignedPlayback {
  /** Manifest HLS signé (TTL court). */
  hlsUrl: string;
  /** Manifest DASH (optionnel — fallback navigateurs sans HLS natif). */
  dashUrl?: string;
  /** Poster signé OU URL R2 stable. */
  posterUrl: string;
  /** Pistes de sous-titres (label + srclang + url .vtt). */
  captions: Array<{ srclang: string; label: string; url: string }>;
  /** Expiration absolue (epoch ms) — pour que le client re-signe avant. */
  expiresAt: number;
}

export interface VideoProvider {
  readonly name: "cloudflare_stream" | "bunny";

  /** Crée un asset vide + ticket d'upload direct navigateur (gros fichiers). */
  createDirectUpload(input: {
    maxDurationSec?: number;
    requireSignedURLs: boolean; // true en prod (protection)
    meta?: Record<string, string>;
  }): Promise<VideoUploadTicket>;

  /** État courant de l'asset (mappé sur ElearningVideoStatut). */
  getAsset(providerUid: string): Promise<{
    statut: "en_attente_upload" | "en_transcodage" | "pret" | "erreur";
    dureeSec?: number;
    largeurPx?: number;
    hauteurPx?: number;
    progressPct: number;
    thumbnailUrl?: string;
    erreurMessage?: string;
  }>;

  /** Génère un playback signé pour CET apprenant (TTL court). */
  getSignedPlayback(input: {
    providerUid: string;
    ttlSeconds: number; // ex. 4h (durée d'une session de cours)
    /** Données injectées dans le watermark (cf. §5.3). */
    watermark?: { text: string };
  }): Promise<SignedPlayback>;

  /** Déclenche la génération auto de sous-titres pour une langue. */
  generateCaptions(input: { providerUid: string; lang: string }): Promise<void>;

  /** Récupère le .vtt généré (pour relecture + archivage R2). */
  fetchCaptionsVtt(input: { providerUid: string; lang: string }): Promise<string | null>;

  /** Pousse un .vtt relu/corrigé (remplace l'auto). */
  putCaptionsVtt(input: { providerUid: string; lang: string; vtt: string }): Promise<void>;

  /** Supprime l'asset chez le fournisseur (archivage/RGPD). */
  deleteAsset(providerUid: string): Promise<void>;
}
```

**Sélection runtime** : `src/server/elearning/video/index.ts`

```ts
export function getVideoProvider(): VideoProvider {
  const p = process.env.ELEARNING_VIDEO_PROVIDER ?? "cloudflare_stream";
  return p === "bunny" ? bunnyProvider : cloudflareStreamProvider;
}
```

**Adaptateurs** :

- `src/server/elearning/video/cloudflare-stream.ts` — implémente l'interface via l'API Stream (`https://api.cloudflare.com/client/v4/accounts/<acct>/stream`).
- `src/server/elearning/video/bunny.ts` — plan B (API Bunny Stream), stub conforme à l'interface jusqu'à activation.

> **Contrat build `stub.invalid`** : ces adaptateurs ne sont **jamais appelés au build SSG** (toutes les pages vidéo sont derrière auth apprenant + `force-dynamic`). Si une fonction provider est néanmoins importée dans un chemin SSG, ajouter un garde `if (!process.env.STREAM_API_TOKEN) return <fallback>` pour ne pas throw au build. Aligné sur le pattern `isR2Configured()` de `r2-storage.ts`.

---

## 5. Ingestion → encodage → protection (le pipeline)

```
[Auteur admin] --(1 ticket upload)--> Stream
       |  (2 upload direct tus, navigateur → Stream, ne transite PAS par Next)
       v
   Stream encode (HLS ladder auto: 240p→1080p)
       |  (3 webhook "ready")
       v
[elearning-video-ingest-worker] --> maj ElearningVideoAsset (durée, poster→R2, statut=pret)
       |  (4 enqueue captions)
       v
[elearning-video-captions-worker] --> generate .vtt --> relecture auteur --> R2 (ElearningResource)
       ...
[Apprenant] --(5 GET playback token)--> route signée --> HLS signé + watermark --> VideoPlayer
```

### 5.1 (1)(2) Upload auteur — direct, jamais par le serveur Next

Les vidéos de cours pèsent des centaines de Mo à plusieurs Go : elles **ne doivent pas** transiter par le serveur Next (limite `bodySizeLimit`, mémoire). On réutilise **exactement** la philosophie de `getSignedUploadUrlR2` (upload direct navigateur → bucket), mais côté Stream :

1. L'auteur, dans l'outil auteur (`06-CONSOLE-ADMIN/03-outil-auteur-course-builder.md`), choisit un fichier vidéo pour une leçon `type=video`.
2. Server Action `createVideoUploadTicketAction` (cf. §7.1) → `provider.createDirectUpload({ requireSignedURLs: true })` → crée la ligne `ElearningVideoAsset(statut=en_attente_upload)` et renvoie `{ uploadUrl, providerUid }`.
3. Le navigateur uploade en **tus** (resumable) directement vers Stream (gros fichiers, reprise sur coupure réseau). Le `providerUid` est immédiatement écrit sur `ElearningLesson.videoAssetId` (la leçon affiche « transcodage en cours »).

### 5.2 (3) Webhook « ready » → réconciliation

Stream appelle notre webhook quand l'encodage est terminé (ou en erreur). La route `POST /api/elearning/video/webhook` (cf. §7.3) **vérifie la signature** (`Webhook-Signature` HMAC), puis **enqueue** un job `elearning-video-ingest` (on ne fait pas le travail lourd dans le handler HTTP — pattern BullMQ habituel). Le worker met à jour `ElearningVideoAsset` (durée, dimensions, statut=`pret`), copie le **thumbnail → R2** (`posterR2Key`, poster stable non signé), recopie `videoDureeSec` sur la `ElearningLesson` liée, et **enqueue la génération de sous-titres FR**.

> **Polling de secours** : si le webhook est manqué (Stream best-effort), un cron `elearning-video-poll` (toutes les 5 min) reprend les assets `en_attente_upload`/`en_transcodage` créés depuis > 2 min et appelle `provider.getAsset()`. Idempotent. (Cf. §6.)

### 5.3 (5) Protection : URLs signées + watermark dynamique

**URLs signées (obligatoire en prod).** Tout asset est créé avec `requireSignedURLs: true`. Le manifest HLS n'est accessible qu'avec un **token JWT signé** à durée courte, émis **par apprenant** et **par session de visionnage** :

- Le token Stream est signé avec une **clé de signature** (`STREAM_SIGNING_KEY_ID` + clé privée `STREAM_SIGNING_KEY_PEM`, jamais exposées au client).
- TTL court : **4 h** (couvre une session de cours ; le client re-signe via la route si expiré — cf. §7.2 + §9.3).
- Le token peut porter des **restrictions** : `exp`, et idéalement une contrainte d'usage. On ne met **pas** l'IP en contrainte (mobile = IP changeante → faux blocages ; CNIL : proportionnalité).

**Watermark dynamique par apprenant (dissuasion fuite).** Cloudflare Stream **n'incruste pas** de watermark _par utilisateur_ côté serveur (le watermark Stream natif est _statique_, défini à l'upload). La solution retenue, standard 2026 et peu coûteuse :

- **Overlay client dynamique** : le `VideoPlayer` superpose en DOM/Canvas un texte semi-transparent — `prénom nom · e-mail · ID portail · horodatage` — **qui se déplace** lentement à l'écran (anti-crop, anti-capture statique). Le texte vient de la **session apprenant** (`PortailAcces` → `Trainee`), pas du client.
- En complément, on peut activer le **watermark statique Stream** (logo Axion-IA) à l'upload pour le branding.
- Le texte d'overlay est **aussi** passé dans `getSignedPlayback({ watermark: { text } })` et **journalisé** côté serveur (table d'événements de visionnage, cf. `02-schema-progression-tracking.md`) → en cas de fuite, on relie la copie à l'apprenant (traçabilité dissuasive, mentionnée dans les CGU/consentement).

> **Pas de DRM lourd au lancement** (Widevine/PlayReady/FairPlay). Justification ADR-0005 : le DRM multi-plateforme exige des licences, alourdit le player et l'UX mobile, pour un contenu de formation B2B/B2C dont la valeur ne le justifie pas. URLs signées + watermark traçable = niveau de protection proportionné. Le DRM reste activable en V2 pour un éventuel catalogue premium (Stream le supporte).

### 5.4 Sous-titres (WCAG AA + conformité)

Les sous-titres sont **obligatoires** : accessibilité WCAG 2.2 AA (critère 1.2.2 sous-titres pré-enregistrés ; obligation légale UE EAA 28/06/2025) **et** pièce de qualité pédagogique.

Flux :

1. À `ready`, `elearning-video-captions-worker` appelle `provider.generateCaptions({ lang: "fr" })` (STT auto Stream).
2. Quand le `.vtt` auto est dispo, le worker le **récupère** (`fetchCaptionsVtt`) et le stocke sur R2 comme `ElearningResource(type="sous_titres", r2Key=".../captions/fr.auto.vtt")` lié à la leçon ; `ElearningVideoAsset.captionsAutoGenerees=true`.
3. **Relecture humaine** dans l'outil auteur (l'auto-STT n'est jamais parfait, surtout sur le jargon IA) : l'auteur édite le `.vtt`, l'enregistre → `provider.putCaptionsVtt()` + nouvel `ElearningResource(.../captions/fr.vtt)` + `captionsRelues=true`, `captionsLangues=["fr"]`.
4. Le player charge **en priorité** la piste relue ; l'auto sert de brouillon.

> Pourquoi aussi stocker le `.vtt` sur R2 et pas seulement chez Stream ? (a) preuve/portabilité (changement de provider) ; (b) le `.vtt` relu est une **donnée pédagogique** versionnée par l'auteur ; (c) téléchargement transcript pour l'apprenant.

---

## 6. Queues & workers BullMQ (NEUF)

On suit **exactement** le pattern de `src/server/queue/queues.ts` / `worker.ts` / `connection.ts` (queue `null`-safe quand `BULLMQ_DISABLED`, helper `enqueueXxx` no-op, `startXxxWorker()` appelé dans `worker.ts`, cron via `bootRepeatableJobs`).

**Queues à ajouter dans `src/server/queue/queues.ts`** :

```ts
// E-learning — pipeline vidéo (cf. _LMS-ELEARNING/04-BACKEND/07).
export const elearningVideoIngestQueue: Queue | null = connection
  ? new Queue("elearning-video-ingest", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 5 },
    })
  : null;

export const elearningVideoCaptionsQueue: Queue | null = connection
  ? new Queue("elearning-video-captions", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 3 },
    })
  : null;

export async function enqueueElearningVideoIngest(providerUid: string): Promise<void> {
  if (!elearningVideoIngestQueue) {
    /* no-op + warn dev, cf. enqueueEmail */ return;
  }
  await elearningVideoIngestQueue.add(
    "ingest",
    { providerUid },
    { jobId: `ev-ingest-${providerUid}` },
  );
}

export async function enqueueElearningVideoCaptions(
  providerUid: string,
  lang = "fr",
): Promise<void> {
  if (!elearningVideoCaptionsQueue) {
    return;
  }
  await elearningVideoCaptionsQueue.add(
    "captions",
    { providerUid, lang },
    { jobId: `ev-cap-${providerUid}-${lang}` },
  );
}
```

**Workers** (sous `src/server/queue/workers/`, conformes ADR-0007 nommage `elearning-*-worker.ts`) :

| Worker                               | Rôle                                                                                                                                                                   | Déclencheur                                    |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `elearning-video-ingest-worker.ts`   | Réconcilie `ElearningVideoAsset` après upload : `provider.getAsset()`, maj statut/durée/poster→R2, recopie `videoDureeSec` sur la leçon, enqueue captions. Idempotent. | event (webhook) **et** cron de poll de secours |
| `elearning-video-captions-worker.ts` | `generateCaptions` → `fetchCaptionsVtt` → upload R2 (`ElearningResource type=sous_titres`) → maj flags asset.                                                          | event (post-ready)                             |

**Cron de poll de secours** — dans `bootRepeatableJobs()` (queue `elearning-video-ingest`, pattern `*/5 * * * *`) : ré-enqueue les assets bloqués `en_transcodage` depuis > 2 min (filet si webhook manqué). Aligné sur le style des crons existants (`option-expiration` toutes les 5 min).

**Bootstrap** : ajouter `startElearningVideoIngestWorker()` + `startElearningVideoCaptionsWorker()` dans `src/server/queue/worker.ts` (à côté des `startImageBank*Worker()` / `startFormation*Worker()`).

> **Pas de transcodage local.** Aucune charge CPU vidéo sur le VPS : tout l'encodage est chez Stream. Les workers ne font que des appels API + petits fichiers `.vtt`/poster. Cohérent avec la contrainte « build externalisé car CPX42 saturé » (ADR plateforme 0026).

---

## 7. Server Actions & Routes (NEUF)

Convention repo : **Server Actions par défaut**, **Route Handlers** seulement pour ce qui ne peut pas être une action (upload binaire externe, webhook entrant, réponse non-React comme un token JSON streamé au player). Cloisonnement ADR-0007.

### 7.1 Server Actions (outil auteur — RBAC admin)

`src/server/elearning/actions/video-actions.ts` — protégées par les guards existants `requireAdminWrite` / `requireAdminPublish` (`src/server/actions/knowledge/_guards.ts`, rôles `super_admin`/`admin`/`editor`).

- `createVideoUploadTicketAction(lessonId)` → `provider.createDirectUpload()` + crée `ElearningVideoAsset` + lie `lesson.videoAssetId`. Renvoie `{ uploadUrl, providerUid }`.
- `refreshVideoAssetAction(providerUid)` → force `enqueueElearningVideoIngest` (bouton « rafraîchir l'état » côté auteur).
- `saveReviewedCaptionsAction(providerUid, lang, vtt)` → `provider.putCaptionsVtt` + upload R2 + maj flags.
- `deleteVideoAssetAction(providerUid)` → `requireAdminDelete` ; `provider.deleteAsset` + soft-clean DB (archive, pas de DROP).

### 7.2 Route — token de lecture signé (apprenant)

**`GET /api/elearning/video/[providerUid]/playback`** — Route Handler `force-dynamic`, **auth APPRENANT** (session `PortailAcces`, **pas** NextAuth).

Logique :

1. Résoudre la session apprenant (cookie portail HttpOnly → `PortailAcces` non révoqué/non expiré → `Trainee`).
2. **Vérifier le droit d'accès** : l'apprenant a-t-il un `ElearningEnrollment` actif sur un cours contenant cette leçon, et la leçon est-elle **déverrouillée** (drip/gating, cf. `05-FRONTEND-APPRENANT/04-progression-deverrouillage.md`) ? Sinon `403`.
3. Construire le **texte de watermark** depuis l'identité apprenant.
4. `provider.getSignedPlayback({ providerUid, ttlSeconds: 14400, watermark })`.
5. **Journaliser** l'ouverture (événement de visionnage pour les preuves FOAD + traçabilité watermark).
6. Renvoyer le JSON `SignedPlayback` (le player consomme `hlsUrl` + `captions` + `posterUrl`).

> **Jamais** d'URL de lecture rendue dans le HTML serveur : elle est toujours obtenue par cet appel runtime → pas de fuite de lien signé dans les caches/SSR, et compatible `stub.invalid` (route derrière auth, jamais SSG).

### 7.3 Route — webhook Stream

**`POST /api/elearning/video/webhook`** — Route Handler `force-dynamic` (public mais authentifié par signature) :

1. Lire le corps brut + header `Webhook-Signature`, vérifier le HMAC avec `STREAM_WEBHOOK_SECRET` (rejeter `401` sinon). Même rigueur que le webhook Stripe existant (`constructEvent`) et DocuSeal.
2. Si event `video.ready` / `video.error` → `enqueueElearningVideoIngest(providerUid)`.
3. Répondre `200` immédiatement (traitement async en worker).

### 7.4 Route — upload tus (proxy de création éventuel)

L'upload direct tus se fait **navigateur → Stream**. Si le `Upload-Length`/tus-creation exige un en-tête signé par notre serveur, on l'émet dans `createVideoUploadTicketAction` (pas de binaire côté Next). Pas de route binaire entrante côté Next pour la vidéo.

---

## 8. Configuration & variables d'environnement (NEUF)

À ajouter dans `src/env.ts` (mêmes conventions Zod que `STRIPE_*`, `R2_*`, `DOCUSEAL_*` : tout **optionnel**, gate par helper `isStreamConfigured()`). **Respecter `SKIP_ENV_VALIDATION`** : ne pas rendre ces clés `required` (sinon build GH Actions casse).

```
# Sélecteur de fournisseur (réversible — ADR-0005)
ELEARNING_VIDEO_PROVIDER=cloudflare_stream      # | bunny

# Cloudflare Stream
STREAM_ACCOUNT_ID=...                # = R2_ACCOUNT_ID (même compte CF)
STREAM_API_TOKEN=...                 # token API scope Stream:Edit (serveur only)
STREAM_SIGNING_KEY_ID=...            # id de la clé de signature des tokens de lecture
STREAM_SIGNING_KEY_PEM=...           # clé privée PEM (jamais exposée client)
STREAM_WEBHOOK_SECRET=...            # HMAC vérif webhook
STREAM_CUSTOMER_SUBDOMAIN=...        # ex. customer-xxxx.cloudflarestream.com

# Bunny (plan B — vide tant qu'inactif)
BUNNY_STREAM_LIBRARY_ID=...
BUNNY_STREAM_API_KEY=...
BUNNY_STREAM_CDN_HOSTNAME=...
BUNNY_TOKEN_AUTH_KEY=...
```

Helper (calqué sur `isR2Configured()`):

```ts
export function isStreamConfigured(): boolean {
  return Boolean(
    process.env.STREAM_ACCOUNT_ID &&
    process.env.STREAM_API_TOKEN &&
    process.env.STREAM_SIGNING_KEY_ID &&
    process.env.STREAM_SIGNING_KEY_PEM,
  );
}
```

**Mode dégradé** (R2-style) : si `!isStreamConfigured()`, l'upload auteur affiche « vidéo non configurée », le player tombe sur le **fallback** (§10) si présent, et rien ne throw. Permet de développer/tester le LMS sans compte Stream.

---

## 9. Lecture mobile & player (NEUF — détail UX dans doc 05/02)

### 9.1 Techno player

- **HLS adaptatif** (Stream produit le ladder 240p→1080p automatiquement). iOS/Safari lisent le HLS nativement ; ailleurs on utilise **HLS.js** (déjà la reco Stream). Composant `src/components/elearning/VideoPlayer.tsx` (client component, chargé en `dynamic(() => ..., { ssr:false })` pour ne pas peser sur le First Load JS des pages).
- **Contrôles standard** : play/pause, **vitesse 0.5×–2×**, volume, plein écran, sélecteur de **sous-titres**, sélecteur de qualité (auto par défaut).
- **Mobile-first** : tap targets ≥ 24×24 px (WCAG 2.5.8), gestes natifs, pas d'autoplay (ADR best practices : autoplay interdit).

### 9.2 Reprise auto & heartbeat (lien progression)

- Le player émet un **heartbeat** (toutes ~15 s + sur pause/seek/fin) → Server Action `recordWatchProgressAction` → met à jour `LessonProgress.watchSeconds` / `lastPositionSec` (modèle dans `02-schema-progression-tracking.md`). À la réouverture, on **reprend** à `lastPositionSec` (best practice 2026 : reprise persistée serveur, pas localStorage).
- La **complétion vidéo** (ex. ≥ 90 % visionné) marque la leçon comme vue → débloque la suivante si `unlockType=apres_precedent`.

### 9.3 Re-signature transparente

- Le player demande le token (§7.2) au montage. Avant `expiresAt`, il **re-signe** silencieusement (refetch) pour éviter une coupure en milieu de visionnage.

### 9.4 Budget Web Vitals

- Les pages cours sont **derrière auth** (hors 15 pages stratégiques publiques) mais on respecte l'esprit des budgets : player **lazy** (pas dans le First Load), poster R2 servi en `<img>`/`next/image` (LCP), pas de layout shift (réserver le ratio 16:9 → CLS=0), HLS.js code-splitté. Le **catalogue public** (vitrine, `05-FRONTEND-APPRENANT/07`) n'embarque **jamais** le player (juste poster + bouton) → reste sous budget.

---

## 10. Fallback & résilience

| Scénario                                     | Comportement                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stream non configuré** (dev / clé absente) | `isStreamConfigured()=false` → upload désactivé proprement, player affiche le **MP4 de secours** si `fallbackMp4R2Key` présent (servi par URL signée R2 `getSignedUrlR2`), sinon message « vidéo indisponible ». Aucun throw, aucun blocage du reste du cours.                                                                                                   |
| **Encodage en cours** (`en_transcodage`)     | La leçon affiche « vidéo en préparation » + poll ; l'auteur voit `progressPct`. La leçon reste accessible (texte/PDF de la leçon visibles).                                                                                                                                                                                                                      |
| **Encodage en erreur** (`erreur`)            | Alerte côté auteur (`erreurMessage`), badge rouge dans l'outil auteur ; possibilité de ré-uploader (nouveau `providerUid`).                                                                                                                                                                                                                                      |
| **Webhook manqué**                           | Cron de poll (§6) réconcilie sous 5 min.                                                                                                                                                                                                                                                                                                                         |
| **Token de lecture expiré**                  | Re-signature transparente (§9.3) ; si l'apprenant a perdu son droit (enrollment révoqué) → `403`, message clair.                                                                                                                                                                                                                                                 |
| **Bascule fournisseur** (Stream → Bunny)     | Changer `ELEARNING_VIDEO_PROVIDER=bunny` + clés. Les **nouveaux** uploads vont chez Bunny ; les assets existants restent lisibles via leur `provider` stocké sur la ligne `ElearningVideoAsset` (l'adaptateur est choisi **par asset**, pas seulement par env — prévoir `getProviderFor(asset.provider)`). Migration de catalogue = ré-upload (rare, documenté). |
| **Indisponibilité Stream**                   | Le CDN Cloudflare sert le HLS depuis le edge (haute dispo). Si panne API (signature), les tokens déjà émis (TTL 4 h) continuent de jouer ; nouvelles ouvertures dégradent vers fallback MP4 si configuré.                                                                                                                                                        |
| **Conservation / RGPD**                      | Suppression apprenant (`Trainee.deletedAt`, `RgpdDemande`) : les assets vidéo ne contiennent pas de PII (le watermark est rendu _client_, pas incrusté serveur) → rien à purger côté Stream pour le droit à l'effacement, sauf logs de visionnage (purgés par `retention-purge-worker` selon la politique de `08-CONFORMITE/05`).                                |

---

## 11. Coûts (ordre de grandeur, à valider au contrat)

Modèle Cloudflare Stream (2 compteurs) :

- **Stockage** : facturé par **minute de vidéo stockée** (toutes résolutions confondues, le ladder est inclus).
- **Diffusion** : facturé par **minute de vidéo livrée** (visionnée), pas au Go → **prévisible** et indépendant de la résolution choisie par l'apprenant.

Implications pour Axion-IA :

- Un catalogue de formation est **petit en heures** (microlearning : leçons 2–10 min) → coût de **stockage négligeable**.
- Le coût suit l'**engagement réel** (minutes vues), ce qui s'aligne sur le modèle finançable (on facture la formation, le coût vidéo est marginal par apprenant).
- **Pas d'egress surprise** (contrairement à un MP4 brut sur stockage facturé au Go).
- Bunny est légèrement moins cher au Go livré mais ajoute **un second fournisseur** (facture, support, DPA) → l'économie ne justifie le switch que si la **résidence UE** l'impose.

> Mettre un **garde-fou de coût** simple (compteur minutes livrées/mois exposé dans le dashboard admin `06-CONSOLE-ADMIN/08-reporting-analytics.md`) pour éviter toute dérive. Pas de kill-switch nécessaire au volume LMS prévu.

---

## 12. Sécurité — checklist

- ✅ `requireSignedURLs: true` sur **tous** les assets en prod (jamais de HLS public).
- ✅ Clés de signature + token API **serveur uniquement** (`STREAM_*` jamais préfixées `NEXT_PUBLIC_`).
- ✅ Token de lecture **par apprenant**, TTL court (4 h), émis seulement après vérif `ElearningEnrollment` + déverrouillage.
- ✅ Webhook **HMAC-vérifié** (rejet `401`).
- ✅ Watermark dynamique traçable (dissuasion + preuve), identité issue de la session serveur.
- ✅ Auth apprenant **séparée de NextAuth** (cookie `PortailAcces`) — pas de mélange admin/apprenant (ADR-0001).
- ✅ Upload auteur sous RBAC admin (`requireAdminWrite`).
- ✅ Aucune URL signée dans le HTML SSR / caches CDN (toujours obtenue runtime).
- ✅ Mode dégradé sans throw (compat `stub.invalid` + dev sans Stream).

---

## 13. Récapitulatif des artefacts à créer

| Type                          | Chemin                                                                 | Statut                    |
| ----------------------------- | ---------------------------------------------------------------------- | ------------------------- |
| Enum + modèle Prisma          | `prisma/schema.prisma` → `ElearningVideoStatut`, `ElearningVideoAsset` | NEUF (migration additive) |
| Interface provider            | `src/server/elearning/video/provider.ts`                               | NEUF                      |
| Sélecteur                     | `src/server/elearning/video/index.ts`                                  | NEUF                      |
| Adaptateur Stream             | `src/server/elearning/video/cloudflare-stream.ts`                      | NEUF                      |
| Adaptateur Bunny (plan B)     | `src/server/elearning/video/bunny.ts`                                  | NEUF (stub)               |
| Server Actions auteur         | `src/server/elearning/actions/video-actions.ts`                        | NEUF                      |
| Route token lecture           | `src/app/api/elearning/video/[providerUid]/playback/route.ts`          | NEUF                      |
| Route webhook                 | `src/app/api/elearning/video/webhook/route.ts`                         | NEUF                      |
| Queues + helpers enqueue      | `src/server/queue/queues.ts` (ajout)                                   | EXTENSION                 |
| Worker ingest                 | `src/server/queue/workers/elearning-video-ingest-worker.ts`            | NEUF                      |
| Worker captions               | `src/server/queue/workers/elearning-video-captions-worker.ts`          | NEUF                      |
| Bootstrap workers + cron poll | `src/server/queue/worker.ts` + `bootRepeatableJobs()` (ajout)          | EXTENSION                 |
| Player                        | `src/components/elearning/VideoPlayer.tsx`                             | NEUF                      |
| Env + gate                    | `src/env.ts` (ajout `STREAM_*`/`BUNNY_*` + `isStreamConfigured()`)     | EXTENSION                 |
| Stockage médias annexes       | `src/lib/r2-storage.ts`                                                | EXISTANT (réutilisé)      |

---

## Liens

- `00-INDEX/DECISIONS-ARBITRAGES.md` — **ADR-LMS-0005** (vidéo), 0007 (cloisonnement), 0008 (migrations).
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — `ElearningLesson.videoAssetId` / `videoDureeSec`, `ElearningResource` (sous-titres/poster).
- `03-DATA-MODEL/02-schema-progression-tracking.md` — `LessonProgress` (heartbeat, reprise), événements de visionnage (preuves FOAD + traçabilité watermark).
- `03-DATA-MODEL/06-strategie-migrations.md` — migration additive `ElearningVideoAsset`.
- `04-BACKEND/03-workers-bullmq-crons.md` — recensement des queues/workers/crons LMS (dont vidéo).
- `04-BACKEND/04-api-routes.md` — routes (playback token, webhook).
- `04-BACKEND/05-authentification-apprenant.md` — session `PortailAcces` consommée par la route playback + le watermark.
- `05-FRONTEND-APPRENANT/02-lecteur-cours-player.md` — UX player, heartbeat, reprise auto, re-signature.
- `05-FRONTEND-APPRENANT/04-progression-deverrouillage.md` — vérif déverrouillage avant émission du token.
- `05-FRONTEND-APPRENANT/05-mobile-accessibilite-wcag.md` — sous-titres, tap targets, contraste, clavier.
- `06-CONSOLE-ADMIN/03-outil-auteur-course-builder.md` — upload auteur, relecture sous-titres, état d'encodage.
- `06-CONSOLE-ADMIN/08-reporting-analytics.md` — compteur minutes livrées (garde-fou coût).
- `08-CONFORMITE/05-rgpd-conservation-preuves.md` — DPA fournisseur, résidence UE (Bunh​y), purge logs de visionnage.
- `08-CONFORMITE/06-tracabilite-preuves-realisation.md` — logs de visionnage comme faisceau de preuves FOAD (R.6313-3).
