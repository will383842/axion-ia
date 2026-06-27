# Frontend apprenant — Lecteur de cours & player

> **Le cœur de l'expérience apprenant.** Ce document spécifie le **lecteur de cours** (course player) : la navigation modules/leçons avec **cadenas + raison**, le **player vidéo** (vitesse, sous-titres, **reprise automatique persistée côté serveur**, heartbeat), les leçons **texte / pdf / embed / devoir**, le **marquage de complétion**, et la stratégie de **lazy-load** pour tenir le budget **INP ≤ 100 ms**.
>
> **À lire d'abord** (sources de vérité dont ce doc est consommateur) :
>
> - `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — `ElearningCourse` / `ElearningModule` / `ElearningLesson` / `ElearningResource`, enums `ElearningLessonType` / `ElearningUnlockType`.
> - `03-DATA-MODEL/02-schema-progression-tracking.md` — `ElearningEnrollment`, `LessonProgress`, `ModuleProgress`, `CourseProgress`, `ElearningXapiStatement`, services `progress-service` / `unlock-service` / `completion-service` / `statement-emitter`, action `recordHeartbeat` et route `/api/elearning/heartbeat`.
> - `03-DATA-MODEL/04-schema-comptes-acces-auth.md` — auth apprenant (`requireLearner` / `getLearnerSession`, cookie `portail_session`).
> - `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-0005 (Cloudflare Stream, URLs signées + watermark), ADR-0006 (tracking xAPI-like), ADR-0007 (cloisonnement code).
>
> **Contraintes plateforme respectées** : FR-only ; **`force-dynamic`** sur toutes les pages apprenant (derrière auth) → **compatible build `stub.invalid`** (aucun rendu DB au SSG) ; budgets Web Vitals (LCP ≤ 1 800 ms, **INP ≤ 100 ms**, CLS = 0, First Load JS ≤ 75 KB gz/route) ; Tailwind v4 public (PAS de tokens `var(--color-admin-*)`) ; WCAG 2.2 AA (EAA UE) ; migrations additives (rien de nouveau côté schéma ici — ce doc **consomme** les tables des docs 01/02).

---

## 0. TL;DR pour un dev senior

- **Deux pages**, toutes deux Server Components `force-dynamic`, sous le namespace `portail` existant :
  - `/[locale]/portail/cours/[courseSlug]` → **sommaire du cours** (table des matières, progression, reprendre).
  - `/[locale]/portail/cours/[courseSlug]/lecon/[lessonId]` → **lecteur** (player d'une leçon).
- **Un seul service de lecture** côté serveur : `src/server/elearning/player/player-service.ts` (`getCoursePlayerData`, `getLessonForPlayer`) qui résout l'accès (`requireLearner` → `ElearningEnrollment`), assemble l'**outline** + les **états de verrou** (depuis `ModuleProgress`/`LessonProgress`, jamais recalculé à la volée dans la page → INP) et **signe** les URLs média (vidéo Cloudflare Stream + PDF R2) côté serveur uniquement.
- **Le shell est serveur, les médias sont des îlots clients** chargés en **`dynamic(() => …, { ssr:false })`** : le player vidéo (HLS) et le suivi de scroll texte ne sont **jamais** dans le First Load JS du sommaire.
- **Reprise auto = serveur, pas localStorage** : `LessonProgress.dernierePositionSec` est la source de vérité (multi-device). Le player `seek()` à l'ouverture.
- **Heartbeat** vidéo/texte : `navigator.sendBeacon` → `/api/elearning/heartbeat` (route `force-dynamic` déjà spécifiée doc 02), throttlé serveur ~1 statement/15 s/leçon. Jamais d'écriture DB à chaque `timeupdate`.
- **Cadenas TOUJOURS affiché avec sa raison** (`ModuleProgress.verrouRaison` / calcul `unlock-service`) — best practice 2026 « verrou AVEC sa raison ». Jamais une leçon grisée muette.
- **Marquage complétion** : auto (vidéo `maxPositionSec ≥ 0,95×durée` ; pdf/embed `experienced` ; texte = scroll bout) **+** bouton explicite « J'ai terminé » pour les types non auto-traçables.
- **Aucune nouvelle table.** Tout est dans docs 01/02/03. Ce doc = **UI + DTO + actions consommées**.

---

## 1. Carte EXISTANT vs NEUF

### 1.1 Réutilisé (vérifié dans le code)

| Brique                                | Emplacement                                                                                                                                                                  | Rôle dans le lecteur                                                                                                                   |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Namespace portail                     | `src/app/[locale]/portail/**` (`acces`, `acces-invalide`, `mon-espace`)                                                                                                      | On **étend** avec `cours/[courseSlug]/**`. Mêmes conventions : `force-dynamic`, `robots noindex`, Tailwind public sobre, FR.           |
| Auth apprenant                        | `getPortailToken` (`cookie.ts`) + `verifierToken` (`portail-service.ts`) → guard `requireLearner`/`getLearnerSession` (`src/server/elearning/auth/learner-guard.ts`, doc 04) | Protège les deux pages + le service de lecture. Cookie `portail_session` HttpOnly.                                                     |
| `getEspaceStagiaire`                  | `src/server/qualiopi/portail/portail-service.ts`                                                                                                                             | Modèle de service portail stub-aware (à imiter pour `player-service`).                                                                 |
| `src/lib/r2-storage.ts`               | `getSignedUrlR2`                                                                                                                                                             | Signe l'URL de téléchargement d'un PDF de leçon / d'une `ElearningResource` (TTL court). **Pas de streaming vidéo par R2** (ADR-0005). |
| Cloudflare Stream                     | (infra externe, ADR-0005)                                                                                                                                                    | Vidéo HLS adaptatif + **URLs/tokens signés** + sous-titres + watermark. `ElearningLesson.videoAssetId`.                                |
| Tables progression                    | `LessonProgress`, `ModuleProgress`, `CourseProgress` (doc 02)                                                                                                                | États lus par `player-service` (verrous, %, reprise).                                                                                  |
| Server actions progression            | `recordHeartbeat`, `markLessonComplete`, `resumePosition`, `submitDevoir` (`src/server/elearning/actions/progress-actions.ts`, doc 02)                                       | **Consommées** par les îlots clients. Ce doc n'en crée pas de nouvelles (sauf helper lecture, §6).                                     |
| Route heartbeat                       | `src/app/api/elearning/heartbeat/route.ts` (doc 02)                                                                                                                          | Cible `sendBeacon` haute fréquence.                                                                                                    |
| `unlock-service` / `progress-service` | `src/server/elearning/progress/**` (doc 02)                                                                                                                                  | Fournissent `estDeverrouille` + `verrouRaison` ; ce doc ne réimplémente PAS la logique de verrou, il l'**affiche**.                    |
| Composants portail                    | `src/components/portail/**` (`QuitterPortailButton`, etc.)                                                                                                                   | Style de référence (sobre, public).                                                                                                    |

### 1.2 Neuf à construire (cloisonné ADR-0007)

| Élément                              | Type                   | Emplacement cible                                                                                      |
| ------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------ |
| Page sommaire cours                  | RSC                    | `src/app/[locale]/portail/cours/[courseSlug]/page.tsx`                                                 |
| Page lecteur leçon                   | RSC (shell)            | `src/app/[locale]/portail/cours/[courseSlug]/lecon/[lessonId]/page.tsx`                                |
| Service de lecture                   | code serveur           | `src/server/elearning/player/player-service.ts`                                                        |
| DTO / mappers lecteur                | code                   | `src/server/elearning/player/player-dto.ts`                                                            |
| Helper signature média               | code                   | `src/server/elearning/player/media-signing.ts` (wrap Stream + R2)                                      |
| Coquille lecteur (layout 2 colonnes) | composant client léger | `src/components/elearning/player/CoursePlayerLayout.tsx`                                               |
| Navigation modules/leçons (TOC)      | composant              | `src/components/elearning/player/CourseOutline.tsx` + `ModuleAccordion.tsx` + `LessonRow.tsx`          |
| Cadenas + raison                     | composant              | `src/components/elearning/player/LockBadge.tsx` + `LockedLessonNotice.tsx`                             |
| Player vidéo (îlot client lazy)      | composant client       | `src/components/elearning/player/VideoLessonPlayer.tsx`                                                |
| Leçon texte (rendu + scroll tracker) | composant              | `src/components/elearning/player/TextLesson.tsx` + hook `useScrollCompletion.ts`                       |
| Leçon PDF                            | composant client lazy  | `src/components/elearning/player/PdfLesson.tsx`                                                        |
| Leçon embed                          | composant              | `src/components/elearning/player/EmbedLesson.tsx`                                                      |
| Leçon devoir (upload)                | composant client       | `src/components/elearning/player/DevoirLesson.tsx`                                                     |
| Barre de progression + footer nav    | composant              | `src/components/elearning/player/CourseProgressBar.tsx` + `LessonFooterNav.tsx`                        |
| Hooks de tracking                    | code client            | `src/components/elearning/player/hooks/useHeartbeat.ts`, `useResumePosition.ts`, `useLessonTracker.ts` |
| Bouton « J'ai terminé »              | composant client       | `src/components/elearning/player/MarkCompleteButton.tsx`                                               |

> La **leçon `type=quiz`** n'est PAS rendue ici : le lecteur **délègue** au moteur de quiz (`05-FRONTEND-APPRENANT/03-moteur-quiz-ui.md`). Le player monte `<QuizLessonLauncher>` qui renvoie vers/embarque le composant quiz. La **sémantique des verrous** (`unlockType`, drip, gating score) est détaillée dans `05-FRONTEND-APPRENANT/04-progression-deverrouillage.md` — ici on **affiche** le résultat.

---

## 2. Routes & arborescence

```
src/app/[locale]/portail/
├─ mon-espace/page.tsx                         (EXISTANT — ajoute une carte "Mes cours e-learning")
└─ cours/
   └─ [courseSlug]/
      ├─ page.tsx                              (NEUF — sommaire du cours = table des matières)
      └─ lecon/
         └─ [lessonId]/
            └─ page.tsx                        (NEUF — lecteur d'une leçon)
```

| Route                                                   | Type        | Auth                                        | Rendu                                                                                                                                                                                |
| ------------------------------------------------------- | ----------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/[locale]/portail/cours/[courseSlug]`                  | RSC         | `requireLearner()`                          | `force-dynamic`, `robots noindex`. Sommaire : header cours, barre de progression globale, bouton **Reprendre**, liste des modules (accordéon) avec leçons + cadenas/raison + statut. |
| `/[locale]/portail/cours/[courseSlug]/lecon/[lessonId]` | RSC (shell) | `requireLearner()` + contrôle d'accès leçon | `force-dynamic`, `robots noindex`. Layout 2 colonnes : TOC à gauche (rail), contenu de la leçon à droite (îlot client selon `type`), footer nav (préc./suiv. + « J'ai terminé »).    |

**Conventions de page (les deux)** :

```tsx
// page.tsx (extrait commun)
export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; courseSlug: string; lessonId?: string }>;
}) {
  const { courseSlug, lessonId } = await params;
  const { traineeId } = await requireLearner(); // doc 04 — redirect /portail/connexion si null
  const data = await getCoursePlayerData({ traineeId, courseSlug }); // player-service (stub-aware)
  if (!data) notFound(); // pas d'accès actif → 404 (pas de fuite d'existence)
  // ... rendu
}
```

> **Sécurité d'accès.** `getCoursePlayerData` ne renvoie un résultat que si un `ElearningEnrollment` **`statut=actif`** (ou `termine` en lecture seule) existe pour `(traineeId, course)`. Sinon → `notFound()` (on n'expose jamais l'existence d'un cours non octroyé). Idem au niveau leçon : une leçon **verrouillée** est affichée **désactivée** dans la TOC mais sa page renvoie l'**écran de verrou** (`LockedLessonNotice`), **jamais** le média (les URLs signées ne sont pas générées tant que la leçon est verrouillée).

---

## 3. Modèle de données de présentation (DTO)

Le service renvoie un **DTO plat, sérialisable, sans secret** (jamais `passwordHash`, jamais clé R2 brute, jamais token Stream non signé). Défini dans `src/server/elearning/player/player-dto.ts`.

```ts
// ── Sommaire complet d'un cours pour un apprenant donné ──────────────────────
export interface CoursePlayerData {
  enrollmentId: string; // ElearningEnrollment.id (text)
  course: {
    slug: string;
    titre: string;
    sousTitre: string | null;
    dureeEstimeeMinutes: number | null; // info durée FOAD (D.6313-3-1 §2)
    seuilReussitePct: number;
    imageCouvertureUrl: string | null; // signée si privée, sinon null
  };
  progress: {
    statut: ElearningProgressStatut; // non_commence | en_cours | termine | echoue
    percentComplet: number; // CourseProgress.percentComplet
    modulesTermines: number;
    modulesTotal: number;
    lessonsTerminees: number;
    lessonsTotal: number;
    tempsTotalSec: number;
    reussite: boolean;
    certificatDisponible: boolean; // enrollment.certificatDocumentId != null
  };
  reprendre: { moduleId: string; lessonId: string } | null; // 1re leçon non terminée déverrouillée
  modules: ModuleOutline[];
}

export interface ModuleOutline {
  id: string;
  titre: string;
  ordre: number;
  statut: ElearningProgressStatut;
  percentComplet: number; // ModuleProgress.percentComplet
  estDeverrouille: boolean; // ModuleProgress.estDeverrouille (cache)
  verrouRaison: string | null; // ModuleProgress.verrouRaison ("Réussissez le quiz (70 %)", "Disponible le 12/07"…)
  lessons: LessonOutline[];
}

export interface LessonOutline {
  id: string;
  titre: string;
  ordre: number;
  type: ElearningLessonType; // video | texte | pdf | quiz | embed | devoir
  dureeEstimeeMinutes: number | null;
  obligatoire: boolean;
  statut: ElearningProgressStatut; // LessonProgress.statut (non_commence/en_cours/termine/echoue)
  estDeverrouille: boolean; // LessonProgress.estDeverrouille
  verrouRaison: string | null;
  percentVu: number; // pour la mini-jauge par leçon
  estReprise: boolean; // dernierePositionSec > 0 && < complétion
}

// ── Charge utile spécifique au rendu d'UNE leçon (lazy, côté page lecteur) ───
export type LessonPlayerPayload =
  | { kind: "locked"; raison: string } // écran verrou
  | {
      kind: "video";
      videoSrc: VideoSource;
      resume: ResumeState;
      captions: CaptionTrack[];
      poster: string | null;
      dureeSec: number | null;
    }
  | { kind: "texte"; html: string; resume: ResumeState } // HTML assaini (server)
  | { kind: "pdf"; pdfUrl: string; downloadable: boolean }
  | { kind: "embed"; embedHtml: string } // iframe whitelistée
  | { kind: "devoir"; consigne: string; rendu: DevoirState | null; uploadUrl: SignedUpload | null }
  | { kind: "quiz"; quizId: string }; // délégué doc 03

export interface VideoSource {
  provider: "cloudflare" | "bunny";
  hlsUrl: string;
  signedToken: string;
  watermark: string;
}
export interface ResumeState {
  dernierePositionSec: number;
  maxPositionSec: number;
  percentVu: number;
}
export interface CaptionTrack {
  lang: string;
  label: string;
  url: string;
  default: boolean;
} // url signée R2 (.vtt)
```

> **Pourquoi un DTO et pas l'entité Prisma ?** (1) ne **jamais** sérialiser un secret vers le client ; (2) les **URLs sont signées au dernier moment** (TTL court) côté serveur ; (3) le sommaire lit des **agrégats** (`ModuleProgress`/`CourseProgress`) → 1 requête, pas de fan-out (budget INP). Mapping dans `player-dto.ts`.

---

## 4. Structure des composants (client / serveur)

Frontière **serveur/client** pensée pour le **First Load JS** : tout ce qui peut rester serveur reste serveur ; les médias interactifs sont des **îlots clients chargés à la demande**.

```
[RSC] page lecteur (lecon/[lessonId]/page.tsx)
 └─ <CoursePlayerLayout>                         (client léger — gère le rail responsive / drawer mobile)
     ├─ <CourseOutline>                          (SERVER — TOC rendue côté serveur, 0 JS)
     │   └─ <ModuleAccordion> (×N)               (SERVER : <details>/<summary> natif = accordéon sans JS)
     │       ├─ header module + <CourseProgressBar segment="module">
     │       └─ <LessonRow> (×N)                 (SERVER : <a> si déverrouillé, <span aria-disabled> + <LockBadge> sinon)
     ├─ <main>  (région principale, focus géré)
     │   ├─ <LessonHeader>  (titre, durée, type, fil d'Ariane)
     │   ├─ {payload.kind === "locked"}  → <LockedLessonNotice raison>          (SERVER)
     │   ├─ {payload.kind === "video"}   → <VideoLessonPlayer>  (CLIENT, lazy ssr:false)
     │   ├─ {payload.kind === "texte"}   → <TextLesson>         (SERVER html + <ScrollCompletionProbe> CLIENT)
     │   ├─ {payload.kind === "pdf"}     → <PdfLesson>          (CLIENT, lazy ssr:false)
     │   ├─ {payload.kind === "embed"}   → <EmbedLesson>        (SERVER iframe + CLIENT visibility probe)
     │   ├─ {payload.kind === "devoir"}  → <DevoirLesson>       (CLIENT — upload R2)
     │   └─ {payload.kind === "quiz"}    → <QuizLessonLauncher> (délégué doc 03)
     └─ <LessonFooterNav>                         (CLIENT léger : préc./suiv. + <MarkCompleteButton>)
```

**Règles d'or**

1. `CourseOutline` + `ModuleAccordion` + `LessonRow` + `LockBadge` + `LockedLessonNotice` + `TextLesson` sont des **Server Components** (zéro JS au First Load). L'accordéon utilise `<details>/<summary>` natif (ouverture sans JS, accessible clavier d'origine, CLS = 0).
2. `CoursePlayerLayout` est un **petit** client (gère uniquement l'ouverture du **drawer TOC mobile** + le focus). Il **n'enveloppe pas** le contenu dans un provider lourd.
3. Les médias (`VideoLessonPlayer`, `PdfLesson`) sont chargés via **`next/dynamic`** avec `ssr:false` + `loading: () => <PlayerSkeleton/>` (skeleton de **hauteur fixe** = CLS 0). Leur JS n'est téléchargé que sur la page lecteur, **jamais** sur le sommaire.
4. Les hooks de tracking (`useHeartbeat`, `useResumePosition`, `useLessonTracker`) vivent **dans** l'îlot média (pas au niveau page) → pas de hydratation globale.

---

## 5. Navigation modules / leçons (cadenas + raison)

### 5.1 Comportement

- **Accordéon par module** (`<details open>` sur le module courant, fermé sinon). Header module = titre + mini-jauge `percentComplet` + pastille statut (non commencé / en cours / terminé) + **cadenas** si `!estDeverrouille`.
- **Ligne leçon** (`LessonRow`) :
  - **Déverrouillée** → `<a href=".../lecon/[id]">` ; icône selon `type` (vidéo/texte/pdf/quiz/embed/devoir) ; durée estimée ; **mini-jauge `percentVu`** ; coche verte si `statut=termine` ; indicateur « Reprendre » si `estReprise`.
  - **Verrouillée** → `<span role="link" aria-disabled="true" tabindex="-1">` + **`<LockBadge>`** + **raison visible** (texte court de `verrouRaison`) + tooltip détaillé. **Jamais cliquable**, mais **annoncée** au lecteur d'écran (« Leçon verrouillée : Réussissez le quiz (70 %) »).
  - **Leçon courante** → `aria-current="true"`, surlignage.

### 5.2 Le cadenas affiche TOUJOURS sa raison (best practice 2026)

La raison provient de `ModuleProgress.verrouRaison` / `LessonProgress.verrouRaison` (écrits par `unlock-service`, doc 02 §8). Le composant ne **calcule rien** — il **mappe** une raison déjà résolue. Exemples de libellés (FR, fournis par `unlock-service`) :

| `unlockType`         | `verrouRaison` affichée                  | Détail                                                                        |
| -------------------- | ---------------------------------------- | ----------------------------------------------------------------------------- |
| `apres_precedent`    | « Terminez la leçon précédente »         | Lien vers la leçon bloquante (« Aller à _…_ »).                               |
| `score_quiz`         | « Réussissez le quiz : _Quiz X_ (70 %) » | Affiche `meilleurScorePct` obtenu si tentative existante (« obtenu : 55 % »). |
| `date_fixe`          | « Disponible le 12/07/2026 »             | `unlockDate` formatée `Intl.DateTimeFormat("fr-FR")`.                         |
| `offset_inscription` | « Disponible le 18/07/2026 (J+7) »       | calculé serveur = `accordeAt + unlockOffsetJours`.                            |
| `immediat`           | (jamais verrouillé)                      | —                                                                             |

```tsx
// LockBadge.tsx (SERVER) — purement présentiel
export function LockBadge({ raison }: { raison: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm text-stone-500">
      <LockIcon aria-hidden className="size-4" />
      <span className="sr-only">Leçon verrouillée : </span>
      {raison}
    </span>
  );
}
```

### 5.3 Écran de verrou plein (page leçon verrouillée)

Si l'apprenant force l'URL d'une leçon verrouillée, la page rend `<LockedLessonNotice>` (pas le média) : titre de la leçon, **grand cadenas**, **la raison**, et un **CTA contextuel** (« Aller à la leçon à terminer » / « Passer le quiz » / « Revenir le 12/07 »). Aucune URL signée n'est générée → **fuite média impossible**.

### 5.4 Override admin

Si `ModuleProgress.overrideDeverrouille = true` (admin a forcé l'accès, doc 02 §5), le verrou est ignoré et un **petit badge discret** « Accès accordé par l'équipe » s'affiche (traçabilité côté apprenant). Le calcul est déjà fait par `unlock-service` ; le front ne décide rien.

---

## 6. Service de lecture (serveur, NEUF)

`src/server/elearning/player/player-service.ts` — **stub-aware** (réplique le garde `if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return null;` comme `portail-service.ts`).

```ts
// Lecture du sommaire complet (page sommaire + rail TOC du lecteur).
export async function getCoursePlayerData(args: {
  traineeId: string;
  courseSlug: string;
}): Promise<CoursePlayerData | null>;
//  1. resolve ElearningCourse by slug (statut=publie) + ElearningEnrollment actif|termine pour (traineeId, course)
//  2. charge modules+lessons (ordre) en 1 query + ModuleProgress/LessonProgress/CourseProgress de l'enrollment
//  3. map -> DTO ; calcule `reprendre` = 1re leçon obligatoire non terminée ET déverrouillée
//  4. NE signe PAS les médias ici (sommaire = pas de lecture média)

// Lecture d'UNE leçon (page lecteur) — signe les médias au dernier moment.
export async function getLessonForPlayer(args: {
  traineeId: string;
  courseSlug: string;
  lessonId: string;
}): Promise<{ outline: CoursePlayerData; payload: LessonPlayerPayload } | null>;
//  1. getCoursePlayerData (réutilisé) — fournit l'outline du rail
//  2. vérifie estDeverrouille de la leçon -> si false: payload={kind:"locked", raison}
//  3. selon lesson.type, construit le payload + signe (media-signing.ts) :
//       video -> signCloudflareStream(videoAssetId, {watermark: traineeWatermark, ttl: 4h})
//       pdf   -> getSignedUrlR2(pdfKey, ttl: 1h)
//       texte -> sanitize(contenuJson -> html) (server, allowlist)
//       embed -> validateEmbed(contenuJson) (whitelist d'origines)
//       devoir-> getSignedUploadUrlR2(...) si pas encore rendu
//       quiz  -> {kind:"quiz", quizId}
//  4. émet (fire-and-forget) le statement `launched` via statement-emitter (doc 02) + set premiereConnexionAt si 1er accès
```

`src/server/elearning/player/media-signing.ts` :

```ts
// Vidéo — Cloudflare Stream signed URL/token + watermark par utilisateur (ADR-0005).
export async function signCloudflareStream(
  videoAssetId: string,
  opts: {
    watermark: string; // ex. "Jean D. · jean@acme.fr · 2026-06-27" (dissuasion partage)
    ttlSeconds: number; // défaut 4h (durée d'une session de visionnage)
  },
): Promise<VideoSource>;
// PDF / sous-titres / ressources — R2 (réutilise getSignedUrlR2, TTL court).
export async function signResourceUrl(r2Key: string, ttlSeconds?: number): Promise<string>;
```

> **Watermark dynamique** = nom + email (ou identifiant tronqué) de l'apprenant incrusté par Cloudflare Stream (ADR-0005). Dissuade la rediffusion sans DRM lourd. Le libellé est construit serveur (jamais d'email exposé inutilement dans le DOM ; le watermark est rendu par Stream, pas par notre HTML).

---

## 7. Player vidéo (îlot client lazy)

`src/components/elearning/player/VideoLessonPlayer.tsx` — **`"use client"`**, monté en `dynamic(..., { ssr:false })`.

### 7.1 Choix technique

- **Lecture HLS** via le **player Cloudflare Stream** (web component `<stream>` / `@cloudflare/stream-react`) OU **`hls.js` + `<video>` custom**. **Recommandation MVP** : `hls.js` + `<video>` natif custom (contrôle total des contrôles, de l'accessibilité et du heartbeat ; `hls.js` chargé dynamiquement, ~30 KB gz, **hors First Load** car page lecteur uniquement). Sur Safari/iOS, HLS est natif → on **n'embarque pas** `hls.js` (feature-detect `video.canPlayType("application/vnd.apple.mpegurl")`). Bunny = même approche (HLS), provider switché par `VideoSource.provider`.
- **URL signée** consommée telle quelle (`hlsUrl` + `signedToken`). Renouvellement : si le token expire pendant une longue session, le player capte l'erreur réseau HLS et appelle une **server action `refreshVideoToken(lessonId)`** (ré-signe, TTL relancé) — sans recharger la page.

### 7.2 Fonctionnalités obligatoires (barre MUST-HAVE 2026)

| Fonction                  | Détail                                                                                                                                                                                                                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vitesse de lecture**    | 0,75× / 1× / 1,25× / 1,5× / 1,75× / 2×. Persistée dans `Trainee.preferencesJson` (server action `savePlayerPreference`, debounce) + appliquée à toutes les leçons.                                                                                                           |
| **Sous-titres**           | `<track kind="captions">` depuis `CaptionTrack[]` (.vtt signés R2). On/off + langue ; **WCAG AA** (sous-titres = obligation contenu vidéo). Préférence persistée.                                                                                                            |
| **Reprise auto**          | À `loadedmetadata` : `video.currentTime = resume.dernierePositionSec` (si > 0 et < fin). Toast discret « Reprise à 04:12 » + bouton « Recommencer du début ». **Source serveur** (`LessonProgress.dernierePositionSec`), pas localStorage → multi-device.                    |
| **Heartbeat**             | voir §7.3.                                                                                                                                                                                                                                                                   |
| **Contrôles clavier**     | Espace/K = play/pause, ←/→ = ±5 s, ↑/↓ = volume, F = plein écran, C = sous-titres, M = mute. Focus visible, `aria-label` FR sur chaque bouton. Cibles ≥ 24×24 px (WCAG 2.5.8).                                                                                               |
| **Anti seek-to-end**      | Le seek est libre (UX), mais la **complétion** exige `maxPositionSec ≥ 0,95×dureeSec` (le service ne valide pas un saut à la fin — doc 02 §4). Le bouton « J'ai terminé » reste grisé tant que ce seuil n'est pas atteint, avec libellé « Visionnez la vidéo pour valider ». |
| **Chapitres** (option V1) | depuis `contenuJson.chapitres` → marqueurs sur la barre + liste cliquable.                                                                                                                                                                                                   |

> **PAS d'autoplay** (best practice + accessibilité). La vidéo démarre sur action utilisateur. Pas de plein écran imposé.

### 7.3 Protocole heartbeat (le cœur de la traçabilité FOAD)

Objectif : alimenter `LessonProgress` (percentVu, position, **tempsPasseSec réel**) et le journal `ElearningXapiStatement` (`progressed`) **sans marteler la DB**.

```
[client VideoLessonPlayer]
  - timer interne : tick toutes les 5 s PENDANT lecture active (pause/onglet caché → pas de tick)
  - accumule deltas locaux ; n'ENVOIE au serveur qu'au plus toutes les 15 s
  - payload : { lessonId, positionSec, maxPositionSec, deltaActiveSec, percentVu, captionsLang }
  - transport :
      * en cours de session : fetch keepalive vers action recordHeartbeat
      * sur visibilitychange=hidden / pagehide / ended : navigator.sendBeacon('/api/elearning/heartbeat', body)
        (garantit le flush même si l'onglet se ferme)
[serveur /api/elearning/heartbeat + progress-service.recordLessonProgress]
  - throttle serveur : max 1 statement progressed / 15 s / leçon (doc 02 §8)
  - tempsPasseSec += min(deltaActiveSec, intervalleAttendu*1.5)  // anti-triche : tronque les deltas aberrants
  - percentVu monotone ; maxPositionSec = max ; dernierePositionSec = positionSec (peut reculer)
  - recalcule ModuleProgress/CourseProgress (transaction) ; si module complété -> statement completed
```

Hook `useHeartbeat.ts` (extrait de contrat) :

```ts
useHeartbeat({
  lessonId,
  isActive: () => !video.paused && document.visibilityState === "visible",
  getState: () => ({
    positionSec: video.currentTime | 0,
    maxPositionSec,
    deltaActiveSec,
    percentVu,
    captionsLang,
  }),
  intervalMs: 15_000,
  flushOn: ["visibilitychange", "pagehide", "ended"], // sendBeacon
});
```

**Garde-fous** :

- **Onglet caché / pause** → `isActive=false` → pas d'accumulation de `deltaActiveSec` (le temps « onglet ouvert sans regarder » n'est pas compté → preuve d'assiduité **honnête**).
- **Idempotence** : chaque heartbeat est un upsert ciblé `LessonProgress[(enrollmentId,lessonId)]` ; un beacon dupliqué n'invente pas de temps (le serveur reborne avec son horloge).
- **Échec réseau** : `keepalive`/`sendBeacon` best-effort ; la perte d'un heartbeat est sans gravité (les agrégats sont recalculés au heartbeat suivant + filet `elearning-progress-rollup-worker`, doc 02 §9).

---

## 8. Leçons non-vidéo

### 8.1 Texte (`type=texte`)

- Contenu = `ElearningLesson.contenuJson` (blocs Tiptap/JSON) **rendu en HTML côté serveur** + **assaini** (allowlist serveur, jamais `dangerouslySetInnerHTML` de contenu non assaini). Composant `TextLesson` = **Server Component** → 0 JS pour le texte (LCP/CLS excellents, réutilise la classe typographique publique `.prose-axionia`).
- **Complétion** : sonde client minuscule `<ScrollCompletionProbe>` (`useScrollCompletion.ts`) qui détecte que l'apprenant a atteint le bas (IntersectionObserver sur une sentinelle de fin) **et** qu'un temps plancher proportionnel à la longueur s'est écoulé (anti scroll-éclair). À validation → action `markLessonComplete` + statement `progressed`/`completed`. Bouton « J'ai terminé » disponible aussi (explicite).
- **Reprise** : `dernierePositionSec` réutilisé comme **offset de scroll** (en %) → on restaure la position de lecture.

### 8.2 PDF (`type=pdf`)

- `pdfUrl` = `getSignedUrlR2(pdfKey)` (TTL 1 h). Composant `PdfLesson` **client lazy** : affiche le PDF dans un `<iframe>` (viewer natif navigateur) ou `react-pdf` si pagination requise. **Téléchargement** conditionné par `ElearningResource.telechargeable` (sinon visualisation seule, bouton download masqué).
- **Complétion** : statement `experienced` à l'ouverture + bouton « J'ai terminé » explicite (un PDF n'a pas de progression fiable → marquage manuel = best practice pour les types non auto-traçables).

### 8.3 Embed (`type=embed`)

- `embedHtml` = iframe **validée serveur contre une whitelist d'origines** (replay classe virtuelle, lecteur tiers approuvé). `EmbedLesson` rend l'iframe (`sandbox` + `allow` minimal, `loading="lazy"`). Une **sonde de visibilité** client émet `attended`/`experienced` (passerelle FOAD : présence à un replay). Complétion = bouton explicite.

### 8.4 Devoir (`type=devoir`) — preuve de travail FOAD

- `DevoirLesson` (client) : affiche la **consigne**, un **uploader** vers R2 (`getSignedUploadUrlR2`, PUT direct navigateur → ne transite pas par Next), puis appelle l'action **`submitDevoir`** (doc 02) qui écrit `LessonProgress.devoirR2Key` + `devoirRenduAt` + statement `submitted`.
- État affiché : « Aucun rendu » → « Rendu le 27/06 (fichier.pdf) » → (si correction manuelle quiz/essai liée) statut de correction. La complétion d'une leçon `devoir` = **rendu effectué** (la note éventuelle relève du moteur quiz/correction manuelle, doc 03).

### 8.5 Quiz (`type=quiz`)

- `QuizLessonLauncher` **délègue** au moteur de quiz (`03-moteur-quiz-ui.md`). Le lecteur lui passe `quizId` + `enrollmentId`. Au retour (réussite/échec), le moteur écrit `QuizAttempt` (doc 03) → `progress-service`/`unlock-service` recalculent → **le rail TOC se met à jour** (revalidation du chemin) : un module gaté par ce quiz peut **se déverrouiller** en direct.

---

## 9. Marquage de complétion & progression visible

### 9.1 Sources de complétion (par type)

| Type     | Complétion **automatique**              | Bouton « J'ai terminé »           |
| -------- | --------------------------------------- | --------------------------------- |
| `video`  | `maxPositionSec ≥ 0,95×dureeSec`        | activé une fois le seuil atteint  |
| `texte`  | scroll fin + temps plancher             | toujours dispo                    |
| `pdf`    | — (ouverture = `experienced` seulement) | **requis**                        |
| `embed`  | sonde visibilité (`attended`)           | **requis**                        |
| `devoir` | rendu effectué (`submitted`)            | implicite (le rendu = complétion) |
| `quiz`   | `passed` (seuil atteint, doc 03)        | n/a (géré par le moteur quiz)     |

`MarkCompleteButton` (client) → action `markLessonComplete(lessonId)` (doc 02) → met `LessonProgress.statut=termine` + `completedAt` + statement `completed`, recalcule les agrégats, **revalidate** la page lecteur + le sommaire. Après complétion, **focus déplacé** sur le CTA « Leçon suivante » (continuité d'apprentissage + accessibilité).

### 9.2 Barre de progression

- `CourseProgressBar` (Server Component) lit `CourseProgress.percentComplet` (sommaire) et `ModuleProgress.percentComplet` (par module dans la TOC). **Pas de calcul client.** `role="progressbar"` + `aria-valuenow/min/max` + libellé texte (« 6 leçons sur 12 — 50 % »).
- **CLS = 0** : la barre a une hauteur fixe réservée ; pas de saut quand les chiffres arrivent (rendu serveur, valeurs présentes dès le HTML).

### 9.3 Déverrouillage en cascade

Quand une leçon/quiz est complété(e), `unlock-service` (doc 02) réécrit `estDeverrouille`/`verrouRaison` des éléments suivants. Le front **revalide** (`revalidatePath` sur la page lecteur) → le rail montre le nouvel élément déverrouillé + une **micro-animation** (respecte `prefers-reduced-motion`). Le détail des règles est dans `04-progression-deverrouillage.md`.

---

## 10. Performance & lazy-load (budget INP ≤ 100 ms)

| Levier                           | Application                                                                                                                                                                                                             |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Shell serveur**                | TOC, header, barre de progression, texte = Server Components → ~0 JS au First Load du sommaire (cible ≤ 75 KB gz).                                                                                                      |
| **Îlots dynamiques**             | `VideoLessonPlayer`, `PdfLesson`, `hls.js` en `next/dynamic({ ssr:false })` → JS téléchargé **uniquement** sur la page lecteur, **uniquement** pour le type concerné (un cours 100 % texte n'embarque jamais `hls.js`). |
| **Skeletons hauteur fixe**       | `loading:` des dynamic imports = blocs de dimensions fixes → **CLS = 0**, pas de reflow à l'hydratation.                                                                                                                |
| **Accordéon natif**              | `<details>/<summary>` = ouverture/fermeture **sans JS** (pas de handler, pas de layout thrash → INP protégé).                                                                                                           |
| **Heartbeat non bloquant**       | `sendBeacon`/`keepalive` = hors thread principal, jamais sur `timeupdate` (qui fire ~4×/s) → l'INP du player n'est pas pollué par des writes.                                                                           |
| **Préférences debouncées**       | vitesse/sous-titres : action serveur debouncée (300 ms) → pas de write par clic.                                                                                                                                        |
| **Prefetch ciblé**               | `next/link` prefetch de la **prochaine leçon déverrouillée** seulement (pas tout le cours).                                                                                                                             |
| **Images**                       | poster vidéo + couverture via `next/image` (formats AVIF/WebP, dimensions fixes).                                                                                                                                       |
| **Pas de provider global lourd** | état partagé minimal ; le tracking vit dans l'îlot média, pas au niveau page.                                                                                                                                           |

> Le risque INP identifié plateforme = **player vidéo**. Mitigation : contrôles natifs + handlers légers, throttle de l'UI de progression (rAF), pas de re-render React sur chaque `timeupdate` (on stocke `currentTime` dans un `ref`, on ne `setState` que pour les éléments d'UI à 1 Hz). **Page lecteur** : si elle dépasse le budget, c'est une page derrière auth (non publique) → tolérance, mais on vise quand même INP ≤ 100 ms ; le sommaire, lui, est strict.

---

## 11. Accessibilité (WCAG 2.2 AA — obligation EAA UE)

- **Sous-titres** sur toute vidéo (`<track captions>`), activables, persistés. Transcription téléchargeable en option (V1).
- **Clavier complet** : player (§7.2), TOC (tabulation, `aria-current`, leçons verrouillées `aria-disabled` non focusables mais annoncées), footer nav.
- **Focus management** : à la navigation de leçon, focus sur `<h1>` de la leçon ; après complétion, focus sur « Suivant ».
- **Cibles ≥ 24×24 px** (WCAG 2.5.8) sur tous les contrôles du player et de la TOC.
- **Pas de drag obligatoire** dans le player (les fonctions accessibles ont une alternative non-pointer — WCAG 2.5.7).
- **Contraste AA** sur barre de progression, cadenas, états ; le cadenas n'est **jamais** signalé par la couleur seule (icône + texte de raison).
- **`prefers-reduced-motion`** respecté (animations de déverrouillage, toasts).
- **Lecteur d'écran** : verrou annoncé avec sa raison ; progression annoncée (`aria-live="polite"` sur la jauge à la complétion).
- **Auth accessible** (WCAG 3.3.8) : géré côté `/portail/connexion` (doc 04) — magic-link = pas de test cognitif.

---

## 12. Compatibilité build `stub.invalid` & sécurité

- Les deux pages sont **`force-dynamic`** + derrière `requireLearner` → **aucun rendu au SSG**, donc le build GH Actions (DB stub) ne les exécute pas. `player-service` réplique le **garde stub** (`return null`) par sécurité (comme `portail-service.ts`).
- **`robots noindex`** (espace privé) ; pas d'entrée sitemap.
- **URLs signées générées au dernier moment**, TTL court (vidéo 4 h, PDF/VTT 1 h), **jamais** de clé R2 ni de token Stream brut dans le DTO/DOM ; renouvellement via action dédiée.
- **Contrôle d'accès à deux niveaux** : (1) enrollment actif pour le cours ; (2) leçon déverrouillée pour générer le média. Une leçon verrouillée → `kind:"locked"`, **aucune** URL média.
- **AUCUNE mention Qualiopi/CPF/financement** dans l'UI apprenant (règle portail existante) — la conformité est **produite** (traces) mais **pas affichée** à l'apprenant.
- **RGPD** : IP hachée dans les statements (doc 02) ; le watermark utilise un libellé minimal ; préférences UI dans `Trainee.preferencesJson`.

---

## 13. Checklist d'implémentation (MVP)

- [ ] `player-service.ts` (`getCoursePlayerData`, `getLessonForPlayer`) + `player-dto.ts` + `media-signing.ts` (stub-aware).
- [ ] Page sommaire `cours/[courseSlug]/page.tsx` (RSC) + page lecteur `lecon/[lessonId]/page.tsx` (RSC shell).
- [ ] `CoursePlayerLayout` (drawer mobile) + `CourseOutline` / `ModuleAccordion` / `LessonRow` (SERVER, `<details>` natif).
- [ ] `LockBadge` + `LockedLessonNotice` (raison toujours visible, mapping `verrouRaison`).
- [ ] `VideoLessonPlayer` (client lazy) : hls.js feature-detect, vitesse, sous-titres, reprise serveur, contrôles clavier, anti seek-to-end + `useHeartbeat` / `useResumePosition`.
- [ ] `TextLesson` (SERVER, HTML assaini) + `useScrollCompletion`.
- [ ] `PdfLesson` (client lazy, download gated) / `EmbedLesson` (whitelist) / `DevoirLesson` (upload R2 + `submitDevoir`).
- [ ] `QuizLessonLauncher` (délégation doc 03).
- [ ] `CourseProgressBar` (SERVER, aria) + `LessonFooterNav` + `MarkCompleteButton` (`markLessonComplete`).
- [ ] Action `savePlayerPreference` (vitesse/sous-titres → `Trainee.preferencesJson`) + `refreshVideoToken`.
- [ ] Carte « Mes cours e-learning » ajoutée à `mon-espace/page.tsx`.
- [ ] Tests : reprise multi-device (position serveur), throttle heartbeat, anti seek-to-end, verrou → pas d'URL média, lazy-load (player absent du First Load sommaire), a11y clavier player, CLS = 0.

---

## Liens

- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — `ElearningCourse/Module/Lesson/Resource`, `ElearningLessonType`, `ElearningUnlockType` (structure rendue ici).
- `03-DATA-MODEL/02-schema-progression-tracking.md` — `LessonProgress/ModuleProgress/CourseProgress`, `ElearningXapiStatement`, actions `recordHeartbeat`/`markLessonComplete`/`resumePosition`/`submitDevoir`, route `/api/elearning/heartbeat`, services `progress`/`unlock`/`completion`/`statement-emitter` (consommés ici).
- `03-DATA-MODEL/03-schema-quiz-evaluations.md` — `Quiz`/`QuizAttempt` (leçon `type=quiz`, gating `score_quiz`).
- `03-DATA-MODEL/04-schema-comptes-acces-auth.md` — `requireLearner`/`getLearnerSession`, cookie `portail_session` (auth des pages).
- `05-FRONTEND-APPRENANT/01-espace-apprenant-dashboard.md` — point d'entrée « Mes cours » → ce lecteur.
- `05-FRONTEND-APPRENANT/03-moteur-quiz-ui.md` — UI quiz déléguée par `QuizLessonLauncher`.
- `05-FRONTEND-APPRENANT/04-progression-deverrouillage.md` — sémantique complète des verrous/drip affichés ici.
- `05-FRONTEND-APPRENANT/05-mobile-accessibilite-wcag.md` — détail WCAG 2.2 AA / mobile-first du player.
- `05-FRONTEND-APPRENANT/06-certificats-badges.md` — écran « certificat disponible » après complétion+réussite.
- `04-BACKEND/07-pipeline-video-streaming.md` — Cloudflare Stream : ingest, encodage HLS, signature de token, watermark (back-end de `media-signing.ts`).
- `04-BACKEND/01-services-domaine.md` & `03-workers-bullmq-crons.md` — services/worker de progression alimentés par le heartbeat.
- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-0005 (vidéo), ADR-0006 (tracking xAPI-like), ADR-0007 (cloisonnement).
  </content>
  </invoke>
