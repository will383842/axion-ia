# Backend — Route Handlers (API routes) du LMS

> Spécification **implémentable** des Route Handlers Next.js (App Router) du LMS e-learning.
>
> Périmètre : **uniquement les endpoints où une Server Action ne suffit pas**. Tout le reste (mutations admin, CRUD outil auteur, octroi d'accès, soumission de quiz, etc.) passe par des **Server Actions** (cf. `02-server-actions.md`) — c'est la doctrine du repo (`AGENTS.md` : « Server Actions (pas REST par défaut) »).
>
> Statut : rédigé · Dernière mise à jour : 2026-06-27 · Cible : MVP (les endpoints V1/V2 sont signalés).

---

## 0. Pourquoi des Route Handlers (et pas tout en Server Actions)

Les Server Actions couvrent 90 % des besoins (formulaires, mutations, navigations avec `revalidatePath`). On **descend au niveau Route Handler** seulement quand on a besoin d'une de ces capacités qu'une Server Action ne peut pas offrir proprement :

| Besoin                                                                                         | Pourquoi une Server Action ne suffit pas                                                                                                | Endpoint LMS                                                              |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Beacon haute fréquence** (`navigator.sendBeacon`, `keepalive: true`) au déchargement de page | Une Server Action est liée au cycle React/RSC ; un beacon doit être un POST HTTP brut, idempotent, ultra-léger, qui survit à `pagehide` | `POST /api/elearning/progress/heartbeat`                                  |
| **Webhook entrant tiers** (Cloudflare Stream)                                                  | Appelé par un serveur externe sans session, vérif **HMAC sur body RAW**                                                                 | `POST /api/elearning/video/webhook`                                       |
| **Réponse binaire / redirection signée** (download fichier, PDF certificat)                    | Une Server Action retourne du JSON sérialisable, pas un `Content-Disposition: attachment` ni un `302` vers une URL R2 signée            | `GET /api/elearning/resource/[id]`, `GET /api/elearning/certificate/[id]` |
| **Pose de cookie hors formulaire** + redirection sans token dans l'URL                         | Set-cookie autorisé seulement en Route Handler / Server Action ; ici on veut un GET sur un lien email                                   | `GET /[locale]/apprendre/acces/[token]`                                   |
| **Négociation d'URL signée d'upload** consommée par `fetch(PUT)` côté navigateur               | Possible en action, mais on garde la symétrie avec l'usage admin Qualiopi existant + headers de rate-limit                              | `POST /api/elearning/upload/sign`                                         |

Tout ce qui n'est pas dans ce tableau **reste une Server Action**.

---

## 1. Conventions transverses (à respecter par TOUS les handlers LMS)

Ces conventions sont **alignées sur le code réel existant** (cf. `src/app/api/qualiopi/documents/[id]/route.ts`, `src/app/api/stripe/webhook/route.ts`, `src/app/api/vitals/route.ts`, `src/app/[locale]/portail/acces/[token]/route.ts`).

### 1.1 Emplacement & cloisonnement (ADR-LMS-0007)

```
src/app/api/elearning/**                 ← endpoints techniques (JSON/binaire/webhook)
src/app/[locale]/apprendre/acces/[token]/route.ts   ← entrée apprenant par lien (pose cookie)
```

> `apprendre` est le segment public apprenant du LMS (équivalent de `portail` pour les stagiaires Qualiopi). On ne réutilise PAS `/portail/*` : ce sont deux mondes d'auth (cf. §2 et ADR-LMS-0001).

La **logique métier** ne vit jamais dans le handler : elle est importée depuis `src/server/elearning/**` (services de domaine, cf. `01-services-domaine.md`). Le handler ne fait que : auth → rate-limit → validation Zod → appel service → réponse.

### 1.2 Runtime & build (contrat `stub.invalid`)

```ts
export const dynamic = "force-dynamic"; // jamais pré-rendu au SSG
export const runtime = "nodejs"; // Edge non supporté (cf. vitals route, Hetzner/Coolify)
```

- **Aucun** handler LMS n'est appelé au build SSG (tous derrière auth ou POST). Le contrat `stub.invalid` est donc respecté « gratuitement » : ces routes ne s'exécutent qu'au runtime, avec la vraie `DATABASE_URL`/`REDIS_URL`.
- Par sécurité, les **services** appelés restent stub-aware comme `portail-service.ts` (lecture → valeur neutre, mutation → throw) si jamais ils étaient importés dans un chemin SSG.

### 1.3 Validation des entrées

- **Zod systématique** sur tout body / query (cf. `VitalsSchema`). Bornes max sur chaque string (anti-DoS). `safeParse` → `400 { error: "invalid_payload" }` (jamais throw brut).

### 1.4 Enveloppe d'erreur & codes HTTP

JSON stable, jamais de stack en clair :

```jsonc
// succès
{ "ok": true, "data": { /* ... */ } }
// erreur
{ "error": "code_machine", "detail": "message court optionnel" }
```

| Code                                     | Quand                                                                            |
| ---------------------------------------- | -------------------------------------------------------------------------------- |
| `200` / `204`                            | succès (204 pour beacon/heartbeat sans corps)                                    |
| `302`                                    | redirection vers URL R2 signée ou page (download, accès token)                   |
| `400` `invalid_payload` / `invalid_body` | Zod / JSON KO                                                                    |
| `401` `unauthorized`                     | pas de session apprenant/admin                                                   |
| `403` `forbidden`                        | session OK mais pas le droit sur CETTE ressource (ownership)                     |
| `404` `not_found`                        | ressource inexistante OU non visible (on **ne distingue pas**, anti-énumération) |
| `409` `conflict`                         | idempotence webhook (event déjà traité) → on renvoie `200` en réalité (cf. §6)   |
| `429`                                    | rate-limit dépassé                                                               |
| `503` `not_configured`                   | dépendance absente (R2/Stream non configuré, flag off)                           |

### 1.5 Rate-limit (réutilise `src/lib/rate-limit.ts`)

`checkRateLimit(key, { limit, windowSec })` — sliding window Redis, **fail-open** si Redis down. Clé toujours préfixée par domaine. IP extraite via le helper standard (Cloudflare-aware) :

```ts
function clientIp(req: NextRequest): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}
```

Barème par endpoint (récapitulé §8). On rate-limit **par identité apprenant** quand on en a une (clé = `learnerId`), sinon par IP.

### 1.6 Observabilité

- Erreurs internes → `console.error` + (si configuré) Sentry, **sans** payload PII (cf. docuseal webhook : « pas de log du body en clair »).
- Heartbeat et beacons : **aucun** log par requête (volume), seulement métriques agrégées.

---

## 2. Modèle d'authentification apprenant (rappel — base des handlers)

Détaillé dans `05-authentification-apprenant.md` ; ici le minimum pour comprendre l'auth des routes.

**ADR-LMS-0001** : auth apprenant **séparée de NextAuth**. Deux mondes :

- **Admin** (`AdminUser`) → `auth()` de `@/auth` (NextAuth v5 + 2FA). Utilisé par les handlers d'admin (ex. upload auteur).
- **Apprenant** → **système dédié**, calqué sur le portail stagiaire existant :
  - Modèle `ElearningAccess` (cf. `04-schema-comptes-acces-auth.md`) : `token` 64 hex (`randomBytes(32)`), `learnerId`, `expiresAt`, `revoked`, `lastUsedAt` — **même primitives que `PortailAcces`**.
  - Cookie dédié `elearning_session` (HttpOnly, Secure, SameSite=Lax, 90 j) — module `src/server/elearning/auth/cookie.ts` (copie adaptée de `src/server/qualiopi/portail/cookie.ts`, **nom de cookie distinct** pour ne pas collisionner avec `portail_session`).
  - Helper serveur `getLearnerSession()` dans `src/server/elearning/auth/session.ts` :

```ts
// src/server/elearning/auth/session.ts  (NEUF)
import { getElearningToken } from "./cookie";
import { verifyLearnerToken } from "./access-service"; // timing-safe, comme verifierToken

export interface LearnerSession {
  learnerId: string;
  accessId: string;
  /** null en MVP ; rempli en V2 multi-tenant pour scoping. */
  ownerClientId: string | null;
}

/** Lit le cookie elearning_session → vérifie le token → renvoie la session ou null. */
export async function getLearnerSession(): Promise<LearnerSession | null> {
  const token = await getElearningToken();
  if (!token) return null;
  return verifyLearnerToken(token); // findUnique + timingSafeEqual + checks revoked/expiry + maj lastUsedAt
}
```

> `verifyLearnerToken` est le **clone** de `verifierToken` (portail-service) : `findUnique({ where: { token } })` → `timingSafeEqual` → rejets `revoked` / `expiresAt < now` → `lastUsedAt` fire-and-forget. Stub-aware (retourne `null` sous `stub.invalid`).

Le **mot de passe optionnel** entreprise (ADR-0001) ouvre une session via une **Server Action** de login (`loginLearnerWithPassword`) qui pose le même cookie `elearning_session` — donc **tous les handlers ci-dessous restent identiques** quelle que soit la méthode d'entrée (magic-link ou mot de passe).

---

## 3. `GET /[locale]/apprendre/acces/[token]` — entrée apprenant par lien (NEUF)

**Rôle.** Point d'entrée d'un lien magique envoyé par email (octroi d'accès, relance anti-décrochage). Pose le cookie de session apprenant et redirige vers le tableau de bord, **sans laisser le token dans l'URL** (anti-fuite via historique/Referer).

**Réutilise** : le pattern exact de `src/app/[locale]/portail/acces/[token]/route.ts` (vérifié dans le code).

- **Fichier** : `src/app/[locale]/apprendre/acces/[token]/route.ts`
- **Méthode** : `GET`
- **Auth** : aucune (c'est l'entrée) — la sécurité vient du token 64 hex + rate-limit + timing-safe.
- **Rate-limit** : `elearning:acces:{ip}` → **10 / 60 s** (identique portail).

**Flux :**

1. `params` → `{ locale, token }`.
2. `clientIp(req)` → si `≠ "unknown"`, `checkRateLimit` ; si bloqué → `302` vers `/{locale}/apprendre/acces-invalide`.
3. `verifyLearnerToken(token)` (timing-safe). Si `null` (inconnu/expiré/révoqué) → `302` `/{locale}/apprendre/acces-invalide`.
4. `setElearningCookie(token)` (HttpOnly).
5. **(Conformité FOAD — entrée effective)** : appel **fire-and-forget** `recordFirstAccess(learnerId)` → si c'est la 1re connexion substantielle, écrit `ElearningEnrollment.firstAccessAt` (preuve « entrée en formation », base EDOF V2 ; cf. `08-CONFORMITE/03-cpf-edof-readiness.md`).
6. `NextResponse.redirect("/{locale}/apprendre", 302)`.

```ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ locale: string; token: string }>;
  },
): Promise<NextResponse> {
  const { locale, token } = await params;
  const base = process.env["NEXT_PUBLIC_APP_URL"] ?? "https://axion-ia.com";
  const fail = NextResponse.redirect(`${base}/${locale}/apprendre/acces-invalide`, { status: 302 });

  const ip = clientIp(request);
  if (ip !== "unknown") {
    const rl = await checkRateLimit(`elearning:acces:${ip}`, { limit: 10, windowSec: 60 });
    if (!rl.allowed) return fail;
  }
  const session = await verifyLearnerToken(token);
  if (!session) return fail;

  await setElearningCookie(token);
  void recordFirstAccess(session.learnerId); // FOAD : entrée effective
  return NextResponse.redirect(`${base}/${locale}/apprendre`, { status: 302 });
}
```

> Page d'erreur dédiée : `src/app/[locale]/apprendre/acces-invalide/page.tsx` (clone de `portail/acces-invalide`).

---

## 4. `POST /api/elearning/progress/heartbeat` — battement de progression vidéo/lecture (NEUF)

**Rôle.** Persister côté **serveur** la progression de lecture (position vidéo, % vu, temps actif) toutes les ~15 s et au déchargement de page (`navigator.sendBeacon`). C'est le cœur de la **reprise auto** (best-practice MUST-HAVE 2026) ET une **preuve d'assiduité FOAD** (traces LMS, R.6313-3 « faisceau de preuves »).

**Pourquoi un Route Handler** : doit fonctionner avec `sendBeacon` / `fetch(keepalive:true)` au `pagehide`, ce qu'une Server Action ne peut pas garantir. Doit être **idempotent**, **ultra-rapide** (réponse `204` avant persistance, comme `/api/vitals`).

- **Fichier** : `src/app/api/elearning/progress/heartbeat/route.ts`
- **Méthode** : `POST`
- **Auth** : `getLearnerSession()` obligatoire → `401` si absent.
- **Rate-limit** : `elearning:hb:{learnerId}` → **240 / 60 s** (1 toutes les 15 s × plusieurs onglets + pings de fin de lecture ; au-delà = bot → `429`). Fail-open si Redis down.
- **Budget perf** : viser **< 50 ms** serveur, réponse `204 No Content`. La persistance est `void` (fire-and-forget) si la charge l'exige ; sinon `await` court (un seul upsert).

**Payload (Zod) :**

```ts
const HeartbeatSchema = z.object({
  lessonId: z.string().uuid(),
  // grammaire xAPI-like (ADR-0006) : verbe implicite = "progressed"
  positionSec: z.number().finite().min(0).max(86400), // position de lecture vidéo
  durationSec: z.number().finite().min(0).max(86400).optional(), // durée totale média
  watchedDeltaSec: z.number().finite().min(0).max(120), // temps RÉELLEMENT actif depuis le dernier hb (anti-triche : borné à 2× l'intervalle)
  progressPct: z.number().finite().min(0).max(100), // % vu (calcul client, recalculé/borné serveur)
  completed: z.boolean().optional(), // le client pense avoir fini (serveur tranche)
  clientTs: z.number().int().positive(), // horodatage client (diagnostic only)
});
```

**Flux & règles serveur (anti-triche léger, cf. cahier des charges) :**

1. `session = getLearnerSession()` → `401` sinon.
2. Rate-limit `elearning:hb:{learnerId}`.
3. `safeParse` → `400` sinon.
4. **Ownership** : vérifier que `lessonId` appartient à un cours auquel l'apprenant a un `ElearningEnrollment` actif (sinon `403`/`404`). Mise en cache courte (LRU mémoire) du mapping `lesson→course→enrollment` pour tenir le budget perf.
5. **Temps serveur fait foi** : on ignore `watchedDeltaSec` s'il dépasse l'intervalle écoulé réel (`now - LessonProgress.lastHeartbeatAt`) × 1,5. → empêche le gonflage artificiel du temps passé (preuve d'assiduité fiable).
6. **Upsert** `LessonProgress` (cf. `02-schema-progression-tracking.md`) :
   - `lastPositionSec = positionSec` (reprise auto)
   - `watchedSec += clamp(watchedDeltaSec)`
   - `progressPct = max(progressPct stocké, borné)` (monotone croissant)
   - `lastHeartbeatAt = now`
   - si `completed` **et** `progressPct ≥ seuil de complétion` (ex. 90 % pour une vidéo) → `status = "completed"`, `completedAt = now` → déclenche l'évaluation du **déverrouillage** de la leçon/module suivants (service `recomputeUnlocks`, cf. `05-FRONTEND-APPRENANT/04-*`).
7. **Trace xAPI-like** (append-only) : insert `LearningEvent { verb: "progressed"|"completed", objectId: lessonId, learnerId, raw }` — **preuve FOAD** + futur émetteur xAPI (ADR-0006).
8. Réponse `204` (pas de corps). En cas de besoin client (reprise multi-device), variante `200 { ok, data: { lastPositionSec } }`.

```ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<Response> {
  const session = await getLearnerSession();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(`elearning:hb:${session.learnerId}`, {
    limit: 240,
    windowSec: 60,
  });
  if (!rl.allowed) return new Response(null, { status: 429 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = HeartbeatSchema.safeParse(raw);
  if (!parsed.success) return new Response(null, { status: 400 });

  // service de domaine : ownership + clamp temps serveur + upsert + unlock + trace
  const res = await recordHeartbeat(session.learnerId, parsed.data);
  if (res === "forbidden") return new Response(null, { status: 403 });

  return new Response(null, { status: 204 });
}
```

> **Client** : un hook `useHeartbeat(lessonId)` (cf. `05-FRONTEND-APPRENANT/02-lecteur-cours-player.md`) émet toutes les 15 s via `fetch(..., { keepalive: true })` et **une dernière fois** via `navigator.sendBeacon` sur `visibilitychange === "hidden"` / `pagehide`. Le beacon envoie `Content-Type: text/plain` (limite sendBeacon) → le handler tente `req.json()` puis fallback `req.text()` + `JSON.parse`.

---

## 5. Upload média direct R2 (NEUF — admin/auteur)

Deux endpoints pour l'**outil auteur** (upload de PDF, sous-titres `.vtt`, images, fichiers téléchargeables) **sans faire transiter** les gros fichiers par le serveur Next (limite `bodySizeLimit`). **La vidéo ne passe PAS par là** → elle va sur Cloudflare Stream (§7). Réutilise `getSignedUploadUrlR2` / `uploadToR2` de `src/lib/r2-storage.ts` (vérifié).

### 5.1 `POST /api/elearning/upload/sign` — négocier une URL d'upload signée

- **Fichier** : `src/app/api/elearning/upload/sign/route.ts`
- **Méthode** : `POST`
- **Auth** : **admin** via `auth()` + rôle (réutilise le RBAC `requireAdminWrite` / rôles `super_admin|admin|editor`, cf. `src/server/actions/knowledge/_guards.ts`). → `401`/`403`.
- **Rate-limit** : `elearning:upload-sign:{adminUserId}` → **60 / 60 s**.
- **Pré-requis** : `isR2Configured()` → sinon `503 not_configured`.

**Payload (Zod) :**

```ts
const SignUploadSchema = z.object({
  scope: z.enum([
    "lesson_pdf",
    "lesson_subtitles",
    "resource_file",
    "course_cover",
    "lesson_image",
  ]),
  lessonId: z.string().uuid().optional(), // requis sauf course_cover
  courseId: z.string().uuid().optional(),
  filename: z.string().min(1).max(200),
  contentType: z.string().min(3).max(120), // doit matcher le PUT navigateur
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(200 * 1024 * 1024), // garde-fou 200 Mo
});
```

**Flux :**

1. Auth admin + rôle write.
2. Zod + **whitelist MIME** par `scope` (ex. `lesson_subtitles` ⇒ `text/vtt` ; `lesson_pdf` ⇒ `application/pdf` ; images ⇒ `image/png|jpeg|webp|avif`). MIME hors whitelist → `400`.
3. **Clé R2 déterministe & cloisonnée** (jamais de chemin fourni par le client) :
   ```
   elearning/courses/{courseId}/lessons/{lessonId}/{scope}/{uuid}.{ext}
   elearning/courses/{courseId}/cover/{uuid}.{ext}
   ```
4. `url = await getSignedUploadUrlR2(key, contentType, 15 * 60)` (TTL 15 min, défaut du helper).
5. Réponse :
   ```jsonc
   {
     "ok": true,
     "data": { "uploadUrl": "...", "r2Key": "elearning/courses/.../x.pdf", "expiresInSec": 900 },
   }
   ```
6. Le navigateur fait `fetch(uploadUrl, { method:"PUT", headers:{ "content-type": contentType }, body: file })`.
7. **Finalisation** : une **Server Action** `attachUploadedResource({ r2Key, scope, lessonId, titre, telechargeable })` (pas un handler) crée le `ElearningResource` / met à jour `ElearningLesson.pdfKey` après vérif `existsInR2(r2Key)` + `HeadObject` (taille/MIME réels). → garde la création DB transactionnelle côté action.

> ⚠️ **CORS R2** requis (comme noté dans `r2-storage.ts`) : le bucket doit autoriser `PUT` + header `content-type` depuis l'origine admin.

### 5.2 Alternative petits fichiers : Server Action directe

Pour les fichiers **< 4 Mo** (sous-titres `.vtt`, petites images), pas besoin de l'URL signée : une Server Action `uploadSmallResource(formData)` lit le `File`, appelle `uploadToR2(key, buffer, contentType)` et crée le `ElearningResource`. **Pas de Route Handler.** On documente ici pour cadrer le choix : _signed PUT uniquement au-delà du seuil bodySizeLimit_.

---

## 6. `POST /api/elearning/video/webhook` — webhook fournisseur vidéo (NEUF — Cloudflare Stream)

**Rôle.** Recevoir les notifications de Cloudflare Stream quand l'**encodage HLS** d'une vidéo uploadée est terminé (`ready`) ou en erreur, et mettre à jour la leçon (`ElearningLesson.videoAssetId`, `videoDureeSec`, statut prêt). **ADR-LMS-0005**.

**Pourquoi un Route Handler** : appelé par un serveur tiers, sans session, signature **HMAC sur body RAW**. Pattern **copié** sur `src/app/api/stripe/webhook/route.ts` et `docuseal/webhook/route.ts` (vérifiés) : raw body → vérif signature → **outbox idempotente** → dispatch → `200` même en cas d'erreur de dispatch (sinon retry infini).

- **Fichier** : `src/app/api/elearning/video/webhook/route.ts`
- **Méthode** : `POST`
- **Auth** : **signature HMAC** Cloudflare Stream (header `Webhook-Signature`, format `time=<ts>,sig1=<hmacSHA256(time + "." + body)>`), secret `CLOUDFLARE_STREAM_WEBHOOK_SECRET`. Helper `verifyStreamSignature(rawBody, header, secret)` dans `src/server/elearning/video/cloudflare-stream.ts` (NEUF). Tolérance d'horloge 5 min (anti-replay).
- **Rate-limit** : non (source tierce de confiance authentifiée par HMAC) ; mais `503` si webhook non configuré.
- **Idempotence** : table `ElearningVideoWebhookEvent { providerEventId @unique, type, payload, processedAt, retryCount, error }` (calquée sur `StripeWebhookEvent` / `DocusealWebhookEvent`). `P2002` sur insert → `200 { received: true, idempotent: true }`.

**Flux :**

1. `if (!isStreamWebhookConfigured()) return 503`.
2. `rawBody = await req.text()` (RAW obligatoire pour HMAC).
3. `verifyStreamSignature(...)` → `401 invalid_signature` sinon (+ `sendTelegram` alerte signature KO, comme Stripe).
4. Parse JSON (Zod léger : `uid`, `status.state`, `duration`, `meta.lessonId`). `400` si KO.
5. **Outbox insert** idempotent (`providerEventId = uid + ":" + status.state`). `P2002` → `200` idempotent.
6. Dispatch :
   - `status.state === "ready"` → `update ElearningLesson where { id: meta.lessonId } data { videoAssetId: uid, videoDureeSec: round(duration), videoReady: true }` ; enqueue email/notif auteur « vidéo prête » (optionnel) ; trace.
   - `status.state === "error"` → `videoReady = false` + `sendTelegram` alerte auteur (réencoder).
7. `update event processedAt`. En cas d'erreur de dispatch → log + `retryCount++` + `sendTelegram`, **mais renvoyer `200`** (évite le replay infini ; l'event reste reprocessable).

```ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isStreamWebhookConfigured())
    return NextResponse.json({ error: "not_configured" }, { status: 503 });

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const sig = req.headers.get("webhook-signature");
  if (!verifyStreamSignature(rawBody, sig, getStreamWebhookSecret())) {
    void sendTelegram({ tag: "ELEARNING_VIDEO", body: "Webhook Stream signature KO" });
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }
  // … parse Zod → outbox idempotente (P2002 → 200) → dispatch ready/error → 200
}
```

> **Note résidence UE (ADR-0005)** : si bascule vers **Bunny Stream**, ce même handler reçoit le webhook Bunny (payload + schéma de signature différents) — on isole la vérif derrière l'interface `VideoProvider` (`src/server/elearning/video/provider.ts`) ; le handler ne change pas de chemin.

---

## 7. Lecture vidéo protégée — pas de handler de proxy, mais une Server Action de signature

> **Important** : on **ne streame pas** la vidéo à travers Next (coût egress + INP, à éviter). Le navigateur lit le HLS **directement chez Cloudflare Stream** via une **URL signée + token** générés côté serveur.

- La génération du token de lecture signé (avec **watermark dynamique par utilisateur**, ADR-0005 : email/ID incrusté) se fait dans une **Server Action** `getSignedPlaybackToken(lessonId)` appelée par le player — **pas un Route Handler** (retour JSON simple, court, lié au rendu du composant).
- Vérifs de la Server Action : `getLearnerSession()` + ownership (`ElearningEnrollment` actif sur le cours) + leçon **déverrouillée** (`recomputeUnlocks` → la leçon doit être `unlocked`, sinon `403` avec la **raison du verrou** affichée). TTL token court (ex. 4 h).
- On documente ici pour acter qu'**aucun** `GET /api/elearning/video/[id]/playback` n'existe : ce serait un proxy inutile. Si un jour un besoin de **manifest signé HLS** côté serveur apparaît (ex. Bunny token URL), il deviendra `GET /api/elearning/video/[id]/manifest` → `302` vers l'URL signée provider (même pattern que §8).

---

## 8. Téléchargements protégés (NEUF)

Deux ressources téléchargeables : les **fichiers de leçon** (`ElearningResource` marqués `telechargeable = true`) et les **certificats** e-learning. Pattern **identique** à `src/app/api/qualiopi/documents/[id]/route.ts` (vérifié) : auth → ownership → re-signature R2 à la demande → `302` redirect.

### 8.1 `GET /api/elearning/resource/[id]` — fichier de ressource

- **Fichier** : `src/app/api/elearning/resource/[id]/route.ts`
- **Méthode** : `GET`
- **Auth** : `getLearnerSession()` → `401`.
- **Rate-limit** : `elearning:dl:{learnerId}` → **120 / 60 s**.

**Flux :**

1. Session apprenant.
2. `findUnique ElearningResource { id } select { r2Key, mimeType, telechargeable, lesson: { module: { course: { id } } } }`.
3. Si introuvable **ou** `telechargeable === false` → `404` (on ne distingue pas « interdit » de « inexistant »).
4. **Ownership** : `ElearningEnrollment` actif de `learnerId` sur `course.id` **et** leçon déverrouillée → sinon `404`.
5. `isR2Configured()` → `getSignedUrlR2(r2Key, 900)` (15 min) → `NextResponse.redirect(signed, 302)`. Fail-soft `404 pdf_unavailable` si re-signature impossible.
6. **Trace** : `LearningEvent { verb: "downloaded", objectId: resourceId }` (preuve d'usage FOAD), fire-and-forget.

> Variante : si on veut forcer le `Content-Disposition: attachment; filename="…"`, signer l'URL R2 avec `ResponseContentDisposition` (param `GetObjectCommand`). En MVP, le simple `302` suffit.

### 8.2 `GET /api/elearning/certificate/[id]` — certificat de réalisation

Le **certificat de réalisation FOAD** (modèle officiel, heures réalisées, QR) **réutilise `DocumentGenere` + qrToken** (comme les attestations Qualiopi). On ne réinvente pas le stockage PDF.

- **Fichier** : `src/app/api/elearning/certificate/[id]/route.ts`
- **Méthode** : `GET`
- **Auth** : `getLearnerSession()` (l'apprenant télécharge le SIEN) **OU** `auth()` admin (RBAC read) pour le back-office. → `401`/`403`.
- **Rate-limit** : `elearning:cert:{learnerId|adminUserId}` → **60 / 60 s**.

**Flux :**

1. `findUnique DocumentGenere { id } select { type, numero, pdfUrl, createdAt, ... }` (lien vers l'`ElearningEnrollment`/`learnerId` via la FK posée à la génération).
2. **Ownership** : doc rattaché à `learnerId` de la session, sinon (admin) rôle read OK. Sinon `404`.
3. Re-signature R2 : clé `documents/{year}/{type}/{numero}.pdf` (identique à `generateDocument`) → `existsInR2` → `getSignedUrlR2(key, 900)` → `302`. Fallback `pdfUrl` stocké, sinon `404 pdf_unavailable`.

> **Vérification publique du certificat** : le QR pointe vers la route **existante** de vérification par `qrToken` (réutilise le mécanisme `DocumentGenere.qrToken` déjà en place) — pas de nouveau handler LMS.

---

## 9. Endpoints différés (V1 / V2) — listés pour cohérence

| Endpoint                                                                  | Phase | Note                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /api/elearning/tutor/stream` (SSE)                                  | V1    | Tuteur RAG ancré (Ind.19). Pattern SSE **existant** : `src/app/api/qualiopi/alertes/stream/route.ts` + `src/app/api/content-gen/jobs/[id]/stream/route.ts`. Réutilise le RAG knowledge existant. Auth apprenant + rate-limit strict. |
| `POST /api/elearning/order/webhook` (Stripe)                              | V1    | **N'EST PAS un nouveau webhook** : on étend `src/app/api/stripe/webhook/route.ts` (un seul endpoint Stripe) avec un dispatch `metadata.kind === "elearning_order"`. Reste **éteint** tant que `STRIPE_ENABLED=false` (ADR-0004).     |
| `GET /api/elearning/scorm/*`, `POST /api/elearning/xapi/statements` (LRS) | V2    | Standards (ADR-0006) : seulement si besoin commercial. L'outbox `LearningEvent` (déjà en grammaire verbe/objet) alimentera l'émetteur xAPI sans refonte.                                                                             |
| Endpoints **multi-tenant** (`/api/elearning/org/*`)                       | V2    | Scoping par `ownerClientId` (ADR-0002). Le champ `LearnerSession.ownerClientId` est **déjà prévu** pour que les handlers ci-dessus filtrent sans réécriture.                                                                         |
| `POST /api/elearning/edof/*`                                              | V2    | EDOF / service fait, derrière `EDOF_ENABLED` (ADR-0003 ; pattern de flag identique à `STRIPE_ENABLED` dans `src/env.ts`).                                                                                                            |

---

## 10. Récapitulatif (table de référence)

| Méthode + Route                                    | Fichier                                         | Auth               | Rate-limit (clé → limite/fenêtre)          | Réponse                 | Phase      |
| -------------------------------------------------- | ----------------------------------------------- | ------------------ | ------------------------------------------ | ----------------------- | ---------- |
| `GET /[locale]/apprendre/acces/[token]`            | `app/[locale]/apprendre/acces/[token]/route.ts` | token magique      | `elearning:acces:{ip}` → 10/60s            | `302` + cookie          | MVP        |
| `POST /api/elearning/progress/heartbeat`           | `app/api/elearning/progress/heartbeat/route.ts` | session apprenant  | `elearning:hb:{learnerId}` → 240/60s       | `204`                   | MVP        |
| `POST /api/elearning/upload/sign`                  | `app/api/elearning/upload/sign/route.ts`        | admin (write)      | `elearning:upload-sign:{adminId}` → 60/60s | `200` JSON (URL signée) | MVP        |
| `POST /api/elearning/video/webhook`                | `app/api/elearning/video/webhook/route.ts`      | HMAC Stream        | — (HMAC)                                   | `200` (idempotent)      | MVP        |
| `GET /api/elearning/resource/[id]`                 | `app/api/elearning/resource/[id]/route.ts`      | session apprenant  | `elearning:dl:{learnerId}` → 120/60s       | `302` R2 signé          | MVP        |
| `GET /api/elearning/certificate/[id]`              | `app/api/elearning/certificate/[id]/route.ts`   | apprenant ou admin | `elearning:cert:{id}` → 60/60s             | `302` R2 signé          | MVP        |
| `POST /api/elearning/tutor/stream`                 | `app/api/elearning/tutor/stream/route.ts`       | session apprenant  | strict (ex. 30/60s)                        | SSE                     | V1         |
| (extension) Stripe `metadata.kind=elearning_order` | `app/api/stripe/webhook/route.ts`               | HMAC Stripe        | —                                          | `200`                   | V1 (gated) |

---

## 11. Checklist sécurité par handler (à cocher en revue)

- [ ] `export const dynamic = "force-dynamic"` + `runtime = "nodejs"`.
- [ ] Auth vérifiée **avant** toute lecture DB (apprenant via `getLearnerSession`, admin via `auth()`+RBAC).
- [ ] **Ownership** vérifiée sur l'objet visé (jamais se fier à un ID seul) ; `404` indistinct (anti-énumération).
- [ ] Zod sur 100 % des entrées, bornes max sur strings/nombres.
- [ ] Rate-limit posé (clé par identité si dispo, sinon IP) ; fail-open documenté.
- [ ] Aucune PII en logs ; erreurs internes → `console.error`/Sentry sans payload.
- [ ] Webhook : body RAW + HMAC + outbox idempotente + `200` même si dispatch KO.
- [ ] R2 : clé **déterministe serveur**, jamais chemin client ; URL signée TTL court (≤ 15 min pour download).
- [ ] Stub-safe : services appelés gèrent `stub.invalid` (lecture neutre / mutation throw).
- [ ] Trace `LearningEvent` (verbe/objet) émise pour les actions à valeur de **preuve FOAD**.

---

## Liens

- `02-server-actions.md` — toutes les mutations (CRUD auteur, octroi d'accès, soumission quiz, login mot de passe, signature playback token) ; frontière action vs route.
- `05-authentification-apprenant.md` — `ElearningAccess`, cookie `elearning_session`, `getLearnerSession`, mot de passe optionnel entreprise (ADR-0001).
- `06-import-masse-provisioning.md` — génération en masse des liens magiques `/apprendre/acces/[token]` (import CSV).
- `07-pipeline-video-streaming.md` — Cloudflare Stream (upload, encodage, webhook §6, URL signée + watermark §7, ADR-0005).
- `09-tuteur-rag-assistant.md` — endpoint SSE tuteur (V1) ancré sur le RAG knowledge existant.
- `03-DATA-MODEL/02-schema-progression-tracking.md` — `ElearningEnrollment`, `LessonProgress`, `LearningEvent` (cibles du heartbeat §4).
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — `ElearningLesson.videoAssetId/pdfKey`, `ElearningResource.r2Key/telechargeable` (cibles upload §5 et download §8).
- `03-DATA-MODEL/04-schema-comptes-acces-auth.md` — `ElearningAccess`, webhook outbox `ElearningVideoWebhookEvent`.
- `08-CONFORMITE/06-tracabilite-preuves-realisation.md` — heartbeat + traces = faisceau de preuves R.6313-3 ; entrée effective.
- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-0001 (auth), 0004 (Stripe gated), 0005 (vidéo), 0006 (xAPI), 0007 (cloisonnement), 0008 (migrations additives).
  </content>
  </invoke>
