# Performance & Web Vitals — LMS e-learning

> Spécification de performance pour la plateforme e-learning. Objectif : tenir les **budgets internes Axion-IA** (LCP ≤ 1 800 ms, INP ≤ 100 ms, CLS = 0) sur les surfaces publiques, **sans dégrader** les 15 pages stratégiques existantes, tout en absorbant deux surfaces intrinsèquement « client-heavy » : le **lecteur de cours** (player vidéo + heartbeat + quiz) et l'**outil auteur** (course-builder drag&drop).
>
> Document exploitable par une équipe de dev senior. Distingue **EXISTANT (réutilisé)** de **NEUF (à construire)**. Dernière mise à jour : 2026-06-27.

---

## 0. TL;DR (ce qui est non négociable)

1. **Aucune route LMS publique ne doit faire baisser un budget existant.** Le gate `pnpm lhci` (12 URLs FR × desktop+mobile × 3 runs) et `pnpm bundle:check` (`size-limit`) restent l'autorité finale et **bloquent la PR**.
2. **Les surfaces sous auth (player, builder, dashboard apprenant) ne sont PAS dans le scope LCP public** mais ont leur **propre budget interactif** (INP ≤ 100 ms hors player, voir §3) — auditées manuellement + via assertions ciblées, pas via le gate `categories:performance ≥ 0.9` qui vise les pages marketing.
3. **Le course-builder et le player sont des exceptions documentées**, sur le modèle de l'exception existante `/reserver` (calendrier) / `/appel` (Calendly) : nouvelles entrées `size-limit` dédiées + ADR si dépassement.
4. **CLS = 0 strict** sur tout ce qui est public (catalogue, fiche cours). Sur les surfaces sous auth, CLS ≤ 0,05.
5. **Vidéo = Cloudflare Stream** (ADR-LMS-0005) : HLS adaptatif, `poster` obligatoire, **pas** d'auto-hébergement R2 brut (egress + zéro ABR = INP/LCP catastrophiques sur mobile).

---

## 1. Rappel des budgets plateforme (source de vérité)

Source : `axionia/AGENTS.md` + `_AUDIT/AUDIT-WEB-VITALS-2026-BUDGETS.md` + `lighthouserc.json`.

| Métrique          | Cible interne      | Google « good » | Gate                                                     |
| ----------------- | ------------------ | --------------- | -------------------------------------------------------- |
| **LCP**           | ≤ 1 800 ms p75     | 2 500 ms        | `largest-contentful-paint` ERROR @ 1800 (lab) + CrUX p75 |
| **INP**           | ≤ 100 ms p75       | 200 ms          | `interaction-to-next-paint` WARN @ 80 (lab) + CrUX p75   |
| **CLS**           | = 0 (strict)       | 0,1             | `cumulative-layout-shift` ERROR @ 0,05 (lab)             |
| **TBT**           | ≤ 150 ms           | —               | `total-blocking-time` ERROR @ 150 (lab desktop)          |
| **FCP**           | ≤ 1 500 ms         | —               | `first-contentful-paint` ERROR @ 1500                    |
| **Speed Index**   | ≤ 2 500 ms         | —               | `speed-index` ERROR @ 2500                               |
| **First Load JS** | ≤ 75 KB gz / route | —               | `size-limit` (gate Bundle delta `> +5 KB gz vs main`)    |

**Exception existante** (`lighthouserc.json` doctrine + `package.json` size-limit) : `/reserver` (calendrier) et `/appel` (iframe Calendly) → INP ≤ 150 ms, First Load ≤ 110 KB gz, chunks dynamiques ≤ 150 KB.

> **Note importante.** Le gate Lighthouse `collect.url` (lignes 4-17 de `lighthouserc.json`) ne teste **que des pages publiques FR** : home, interventions, audit, blog, contact, galerie, implantations. **Les pages LMS sous auth ne sont pas auditables par ce gate** (elles exigent un cookie de session apprenant). Le LMS doit donc :
>
> - ajouter ses **pages publiques** (catalogue `/formations-en-ligne`, fiche cours) au `collect.url` → soumises au gate standard `≥ 0.9` ;
> - se doter d'un **budget interactif autonome** pour les pages sous auth (player/builder), mesuré via le RUM existant (`WebVitals.tsx`) + tests Playwright perf ciblés (voir §9).

---

## 2. Cartographie des surfaces LMS et de leur budget

On classe chaque route par criticité Web Vitals.

### 2.1 Surfaces PUBLIQUES (budget strict, soumises au gate Lighthouse)

| Route (NEUF)                                                      | Rendu                       | Budget                        | LCP candidat                     | Risques                         |
| ----------------------------------------------------------------- | --------------------------- | ----------------------------- | -------------------------------- | ------------------------------- |
| `/[locale]/formations-en-ligne` (catalogue, V1)                   | SSG + ISR `revalidate=3600` | 75 KB gz, LCP ≤ 1800, CLS = 0 | image couverture du 1er cours    | grille de cartes images         |
| `/[locale]/formations-en-ligne/[slug]` (fiche cours publique, V1) | SSG + ISR                   | 75 KB gz, LCP ≤ 1800, CLS = 0 | image `imageCouvertureKey` ou H1 | trailer vidéo, JSON-LD `Course` |

> **MVP** : pas de vitrine publique (octroi d'accès manuel). Le catalogue public arrive en **V1** (`05-FRONTEND-APPRENANT/07-catalogue-public-seo.md`). Dès qu'il existe, **il rentre dans `collect.url`** et est tenu aux 75 KB gz.

### 2.2 Surfaces SOUS AUTH apprenant (budget interactif, exception player)

| Route (NEUF)                                                                     | Rendu                              | Budget                                               | Notes                                      |
| -------------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------- | ------------------------------------------ |
| `/[locale]/portail/apprentissage` (dashboard apprenant)                          | `force-dynamic` (cookie apprenant) | First Load ≤ 90 KB gz, INP ≤ 100 ms, CLS ≤ 0,05      | liste cours + progression ; pas de player  |
| `/[locale]/portail/apprentissage/[courseSlug]` (sommaire cours + déverrouillage) | `force-dynamic`                    | ≤ 90 KB gz, INP ≤ 100 ms                             | arbre modules/leçons, badges verrou        |
| `/[locale]/portail/apprentissage/[courseSlug]/[lessonId]` (**player**)           | `force-dynamic`                    | **exception : First Load ≤ 130 KB gz, INP ≤ 150 ms** | player HLS + heartbeat + sidebar ; voir §4 |
| Leçon de type `quiz` (moteur quiz)                                               | `force-dynamic`                    | INP ≤ 100 ms par interaction                         | une question rendue à la fois ; voir §5    |

> **Réutilisation** : l'espace apprenant **étend** l'arborescence portail existante (`src/app/[locale]/portail/{acces,acces-invalide,mon-espace}` → ajout `apprentissage/`). Auth via `PortailAcces` (cookie HttpOnly 90j) + extension password optionnel (ADR-LMS-0001). `force-dynamic` impose un cookie → ces routes ne sont **jamais** cachées par Cloudflare et **jamais** SSG au build (compatible contrat `stub.invalid` : aucune query DB au build).

### 2.3 Surfaces ADMIN (course-builder — exception, hors gate public)

| Route (NEUF)                                                                                  | Rendu                       | Budget                                    | Notes                                                |
| --------------------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------- | ---------------------------------------------------- |
| `/[locale]/(admin)/[adminPrefix]/elearning/...` (liste cours, apprenants, octroi)             | admin shell                 | First Load ≤ 100 KB gz, INP ≤ 100 ms      | réutilise `AdminPageShell`/`AdminTable`/`AdminBadge` |
| `/[locale]/(admin)/[adminPrefix]/elearning/builder/[courseId]` (**course-builder drag&drop**) | admin shell, **îlots lazy** | **exception : ≤ 160 KB gz, INP ≤ 200 ms** | éditeur Tiptap + dnd-kit + uploader ; voir §6        |

> Les routes admin ne sont **pas** dans `collect.url` (déjà le cas pour toute la console). Elles ne plombent donc pas le gate public. Mais elles **doivent** rester sous leur budget interactif propre (mesuré manuellement + Playwright) pour ne pas créer une console inutilisable. Le course-builder reçoit une **entrée `size-limit` dédiée** (voir §7).

---

## 3. Doctrine d'exception (modèle `/reserver`)

Le repo a déjà institué une **exception calendrier** : `/reserver` et `/appel` ont des budgets relâchés (INP ≤ 150, First Load ≤ 110 KB) parce qu'ils embarquent un composant tiers lourd inévitable. Le LMS applique **exactement la même grammaire** à deux surfaces :

1. **Player de cours** (`/portail/apprentissage/.../[lessonId]`) — exception INP ≤ 150 / First Load ≤ 130 KB gz.
2. **Course-builder** (`/elearning/builder/...`) — exception INP ≤ 200 / First Load ≤ 160 KB gz, route admin uniquement.

**Règle.** Toute exception est :

- documentée dans un **ADR** (`_LMS-ELEARNING/00-INDEX/DECISIONS-ARBITRAGES.md`, futur ADR-LMS-0009 « budgets perf surfaces client-heavy ») ;
- matérialisée par une **entrée `size-limit` séparée** (sinon size-limit somme tous les `page-*.js` du glob et fausse le verdict — voir `_size_limit_doctrine` dans `package.json`) ;
- bornée : l'exception **ne s'applique qu'aux routes du glob concerné**, jamais aux pages standard.

Tout dépassement **au-delà** de l'exception = STOP & ASK Will + nouvel ADR (doctrine AGENTS.md inchangée).

---

## 4. Player de cours — stratégie performance (NEUF)

Le player est la surface la plus risquée pour **INP** (heartbeat + contrôles vidéo) et **LCP** (poster vidéo).

### 4.1 Vidéo = Cloudflare Stream, jamais R2 brut

- **EXISTANT** : `src/lib/r2-storage.ts` sait `uploadToR2` / `getSignedUrlR2` / `getSignedUploadUrlR2` mais **ne fait pas de streaming** (commentaire explicite l.63 ADR + en-tête fichier « PAS de streaming »). Servir un MP4 R2 signé = un seul bitrate, pas d'ABR → buffering mobile, LCP/INP explosés.
- **NEUF** : `ElearningLesson.videoAssetId` (cf. `03-DATA-MODEL/01-...`) pointe vers un asset **Cloudflare Stream**. Lecture via **HLS** (`.m3u8`) avec **URLs signées** (token court) + watermark dynamique (ADR-LMS-0005).
- Pipeline : `src/server/elearning/video/cloudflare-stream.ts` (NEUF) + worker `elearning-video-worker.ts` (transcodage/poll de l'état d'encodage). R2 reste pour les **ressources** non-vidéo (`ElearningResource.r2Key` : PDF, sous-titres `.vtt`, audio).

### 4.2 Player = îlot client lazy, jamais dans le First Load

```tsx
// src/components/elearning/player/CoursePlayer.tsx — client component
// Importé en dynamic ssr:false depuis la page serveur :
const CoursePlayer = dynamic(() => import("@/components/elearning/player/CoursePlayer"), {
  ssr: false,
  loading: () => <PlayerSkeleton ratio={16 / 9} />,
});
```

- **Moteur HLS** : ne PAS bundler hls.js dans le First Load. Le charger **on-demand** (`await import("hls.js")`) **uniquement** si `!video.canPlayType("application/vnd.apple.mpegurl")` (Safari lit le HLS nativement → 0 KB JS sur iOS/macOS). Cible : hls.js (~120 KB gz) chargé **après** le premier paint, hors First Load.
- **Contrôles** : utiliser l'élément `<video>` natif + une fine couche custom (vitesse, sous-titres) plutôt qu'un player monolithique. Vitesse / sous-titres / chapitres = best practice 2026 ; accessibilité WCAG (voir `09-QUALITE/04-accessibilite-wcag22.md`).

### 4.3 LCP du player : poster d'abord

- **Poster obligatoire** : `<video poster={posterUrl}>` où `posterUrl` = thumbnail Cloudflare Stream (image AVIF/WebP servie par CF, pas de JS requis). Le poster devient le **LCP** et s'affiche avant l'init HLS → LCP découplé du JS player.
- **`aspect-ratio` figé** sur le conteneur vidéo (`aspect-video` Tailwind / `aspect-ratio: 16 / 9`) → **CLS = 0** même avant chargement du poster (pas de reflow quand la vidéo monte).
- **`preload="none"`** sur `<video>` : pas de fetch du flux tant que l'utilisateur ne lance pas (économie data + n'entre pas en compétition réseau avec le LCP).
- **PAS d'autoplay** (doctrine LMS « EVITER : autoplay » + coût INP/CPU + WCAG).

### 4.4 INP du player : heartbeat = tâche courte, hors thread de l'interaction

La reprise auto persistée serveur (best practice MUST-HAVE) écrit la position de lecture. Risque INP : un `fetch` synchrone sur chaque `timeupdate` (4×/s) tuerait l'INP.

- **Throttle** : capturer la position toutes les **10–15 s** (et sur `pause`/`beforeunload`/`visibilitychange`), pas sur `timeupdate` brut.
- **Découplage** : l'envoi utilise `navigator.sendBeacon()` (ou `fetch(..., { keepalive: true })`) → ne bloque jamais le thread principal, survit à la navigation. **Pas** de Server Action bloquante sur le heartbeat.
- **Endpoint dédié léger** : `POST /api/elearning/progress/heartbeat` (Route Handler `force-dynamic`, NEUF) qui upsert `LessonProgress` (cf. `02-schema-progression-tracking.md` : `positionSec`, `watchedSec`, `lastSeenAt`). Validation rapide (zod), pas de RAG ni de calcul de complétion synchrone.
- **Calcul de complétion / déverrouillage** : déporté côté serveur, **idempotent**, déclenché par le heartbeat mais sans bloquer la réponse (recalcul du gating lu au prochain rendu de page, ou via worker `elearning-progress-worker.ts` pour les agrégats lourds : taux de complétion cours, preuves FOAD).
- **`useTransition` / `startTransition`** pour toute mise à jour d'état React déclenchée par une interaction (changer de leçon, marquer terminé) → garde l'INP sous le seuil en marquant le rendu comme non-urgent.

### 4.5 Découpage des tâches longues

- La **sidebar de navigation du cours** (arbre modules/leçons + état verrou) est rendue **côté serveur** (RSC) et hydratée a minima ; seuls les boutons (toggle, « marquer terminé ») sont des îlots client.
- Le **transcript / chapitres** (potentiellement long) est rendu en RSC ou chargé en `dynamic` au clic sur l'onglet, jamais dans le First Load du player.

---

## 5. Moteur de quiz — performance (NEUF)

Le quiz interactif (`Quiz`/`Question`/`QuizAttempt`, cf. `03-schema-quiz-evaluations.md`) est risqué pour INP (validation, feedback, randomisation).

- **Une question à la fois** dans le DOM (ou virtualisation si quiz long) → DOM réduit, INP stable.
- **Randomisation côté serveur** (shuffle questions ET réponses, tirage N parmi M) à l'ouverture de la tentative → le client reçoit l'ordre déjà mélangé, pas de calcul lourd au runtime.
- **Correction** : auto-corrigeables (QCM, vrai/faux, appariement, ordonnancement) corrigées **côté serveur** via Server Action `submitQuizAttempt` (`src/server/elearning/quiz/actions.ts`, NEUF) → le client ne porte aucune logique de scoring (anti-triche + INP). Le **temps serveur** fait foi (anti-triche léger, doctrine).
- **Feedback** : rendu après réponse, pas d'animation coûteuse (pas de confetti JS lourd ; si feedback visuel, CSS transform/opacity uniquement → composités GPU, 0 layout).
- **`aspect-ratio` / hauteur min** sur le conteneur de question pour éviter le CLS quand le feedback (rationale) s'affiche sous la réponse.
- **Pas de timer client autoritaire** : si un quiz est chronométré, le serveur valide la fenêtre (`startedAt` + durée) ; le compte à rebours client est purement indicatif (un `requestAnimationFrame` léger, throttlé à 1 Hz).

---

## 6. Course-builder (outil auteur) — performance (NEUF, admin)

Le builder est le composant le plus client-heavy du projet (drag&drop + éditeur riche + uploads). Il est **admin-only**, donc hors du gate public, mais doit rester utilisable.

### 6.1 Lazy-loading agressif par capacité

```tsx
// Aucune de ces libs ne doit être dans le First Load de la route admin.
const TiptapEditor = dynamic(() => import("@/components/admin/elearning/builder/TiptapEditor"), {
  ssr: false,
});
const DndCanvas = dynamic(() => import("@/components/admin/elearning/builder/DndCanvas"), {
  ssr: false,
});
const MediaUploader = dynamic(() => import("@/components/admin/elearning/builder/MediaUploader"), {
  ssr: false,
});
```

- **Éditeur riche** (Tiptap, blocs `contenuJson`) : chargé au montage du panneau d'édition d'une leçon, pas avant.
- **Drag&drop** (`@dnd-kit`, réordonner modules/leçons → réécrit `ordre` en transaction, cf. `03-DATA-MODEL/01` §8) : îlot client séparé. Alternative clavier obligatoire (WCAG 2.5.7, voir `04-accessibilite-wcag22.md`).
- **Aperçu « as-student »** : ne charge le player qu'au clic (réutilise le même `dynamic` que §4).

### 6.2 Upload média = direct navigateur → R2 / Stream (zéro charge serveur)

- **EXISTANT réutilisé** : `getSignedUploadUrlR2(key, contentType)` (`r2-storage.ts` l.156) → le navigateur `PUT` directement le fichier sur R2 (PDF, sous-titres, audio, images). Évite la limite `bodySizeLimit` Next et ne bloque pas le thread serveur.
- **Vidéo** : upload direct vers **Cloudflare Stream** (URL d'upload tus/`one-time upload URL`, NEUF dans `cloudflare-stream.ts`) — jamais via R2.
- **Transcodage / variants images** : déporté en worker (`elearning-video-worker.ts` pour l'encodage Stream ; les images de couverture passent par la pipeline image-bank existante si réutilisée). L'UI affiche une progression non-bloquante.
- Le builder **n'envoie jamais** un gros binaire au serveur Next → INP du builder protégé.

### 6.3 Autosave découplé

- Sauvegarde brouillon (`statut = brouillon`, cf. enum `ElearningCourseStatut`) en `useTransition` + debounce (~2 s), via Server Action `saveLessonDraft`. Pas de save sur chaque frappe.

---

## 7. Gating : Lighthouse CI + size-limit (config concrète)

### 7.1 `lighthouserc.json` — ajouts

**Ajouter au `collect.url`** (quand le catalogue public V1 existe) :

```jsonc
"http://localhost:3000/fr/formations-en-ligne",
"http://localhost:3000/fr/formations-en-ligne/maitriser-l-ia-au-quotidien"
```

→ ces URLs héritent automatiquement des assertions strictes existantes (LCP 1800 ERROR, CLS 0,05 ERROR, TBT 150 ERROR, perf ≥ 0,9). **Ne pas** y ajouter d'URL sous auth (cookie requis → le runner Lighthouse ne peut pas s'authentifier sans setup dédié ; et `force-dynamic` + cookie = non représentatif du gate public).

> Le player/builder ne passent **pas** par `lighthouserc.json`. Leur perf interactive est mesurée par les **tests Playwright perf** (§9) + le **RUM CrUX** via `WebVitals.tsx` (EXISTANT, `src/components/analytics/WebVitals.tsx`), source de vérité p75 terrain.

### 7.2 `package.json` → `size-limit` — nouvelles entrées

Sur le modèle des entrées `/reserver` et `/galerie` existantes, ajouter (chemins indicatifs, à ajuster au nom réel du segment de route) :

```jsonc
{
  "name": "Routes /formations-en-ligne (catalogue + fiche, public) — page chunks ≤ 75 KB gz",
  "path": [".next/static/chunks/app/**/formations-en-ligne/**/page-*.js"],
  "limit": "75 KB",
  "running": false
},
{
  "name": "Espace apprenant /portail/apprentissage (hors player) — ≤ 90 KB gz",
  "path": [".next/static/chunks/app/**/portail/apprentissage/**/page-*.js"],
  "limit": "90 KB",
  "running": false
},
{
  "name": "Player de cours (exception client-heavy, ADR-LMS-0009) — First Load ≤ 130 KB gz",
  "path": [".next/static/chunks/app/**/apprentissage/**/[lessonId]/**/page-*.js"],
  "limit": "130 KB",
  "running": false
},
{
  "name": "Player — chunks dynamiques (hls.js, ssr:false) — ≤ 200 KB gz",
  "path": [".next/static/chunks/elearning-player*.js", ".next/static/chunks/**/hls*.js"],
  "limit": "200 KB",
  "running": false
},
{
  "name": "Course-builder (admin, exception ADR-LMS-0009) — First Load ≤ 160 KB gz",
  "path": [".next/static/chunks/app/**/elearning/builder/**/page-*.js"],
  "limit": "160 KB",
  "running": false
},
{
  "name": "Course-builder — chunks dynamiques (Tiptap, dnd-kit, uploader) — ≤ 250 KB gz",
  "path": [".next/static/chunks/elearning-builder*.js"],
  "limit": "250 KB",
  "running": false
}
```

> **Pièges connus** (cf. `_size_limit_doctrine` / `_size_limit_running_note` dans `package.json`) :
>
> - `running: false` **partout** (on ne mesure que la taille gz ; size-limit lançant Chrome headless bloquait Gate B). Lighthouse CI reste l'autorité INP/LCP/CLS.
> - Le path-matching strict par route n'existe pas : isoler chaque surface dans une **entrée + glob séparés**, sinon les `page-*.js` sont sommés et le verdict est faux.
> - Pour que les chunks dynamiques soient nommés (`elearning-player*.js`, `elearning-builder*.js`), utiliser `import(/* webpackChunkName: "elearning-player" */ ...)` au montage des îlots.

### 7.3 Bundle delta gate

Le gate existant bloque toute PR avec **> +5 KB gz vs `main`**. Conséquence pratique : **chaque PR LMS doit justifier son delta**. Stratégie pour rester sous la barre : tout ce qui est lourd (hls.js, Tiptap, dnd-kit) est en `dynamic`/`import()` → n'entre pas dans le First Load → ne compte pas dans le delta des routes standard.

---

## 8. Images & médias — règles transverses

- **`next/image` partout** (`next.config` : `formats: ["image/avif","image/webp"]`, `minimumCacheTTL: 31536000`). Images de couverture cours = AVIF/WebP servis depuis R2/CDN.
- **`width`/`height` (ou `aspect-ratio`) obligatoires** sur toute image et tout conteneur vidéo → **CLS = 0** (réservation de l'espace avant chargement).
- **`priority`** uniquement sur l'image LCP de la fiche cours publique (couverture above-the-fold) ; tout le reste en `loading="lazy"` (défaut `next/image`).
- **Vidéo** : `poster` (thumbnail Stream) + `aspect-ratio` figé + `preload="none"` (voir §4.3).
- **Sous-titres** : fichiers `.vtt` stockés dans `ElearningResource.r2Key`, servis via URL signée — légers, chargés à la demande (`<track>` avec `kind="captions"`).
- **Polices** : réutiliser le pipeline `next/font` existant (Manrope/Fraunces/Inconsolata, `display: optional` côté hero pour éviter le CLS de swap — déjà appliqué, cf. doctrine `lcp-discovery-insight` dans `lighthouserc.json`). **Aucune nouvelle police** pour le LMS.

---

## 9. Mesure & vérification

### 9.1 RUM terrain (source de vérité p75) — EXISTANT

`src/components/analytics/WebVitals.tsx` collecte déjà LCP/INP/CLS terrain. **Étendre** la dimension route pour distinguer les pages LMS (catalogue, player, quiz) → suivi p75 par surface dans le temps. C'est la **vérité finale** (le lab Lighthouse n'a pas d'INP fiable sur les pages sans interaction simulable — cf. doctrine INP WARN).

### 9.2 Lab CI — Lighthouse (pages publiques) + Playwright perf (pages auth)

- **Public** : `pnpm lhci` (gate PR, voir §7.1).
- **Sous auth** : tests Playwright dédiés (NEUF, `tests/perf/elearning-player.spec.ts`) qui :
  - se connectent avec un cookie `PortailAcces` de test,
  - mesurent l'INP via `PerformanceObserver` (`event`/`first-input`) sur des interactions réelles (play, changement de leçon, soumission de quiz),
  - assertent INP player ≤ 150 ms, INP quiz ≤ 100 ms, CLS ≤ 0,05.
- **`pnpm bundle:check`** (size-limit) sur chaque PR.

### 9.3 Checklist de revue PR « touche au LMS frontend »

- [ ] `pnpm bundle:check` vert (entrées LMS dédiées + delta ≤ +5 KB gz vs main).
- [ ] `pnpm lhci` vert (si la PR touche une page publique LMS).
- [ ] Tout composant lourd (player, hls.js, Tiptap, dnd-kit) est en `dynamic`/`import()` → confirmé absent du First Load.
- [ ] `aspect-ratio`/`width`+`height` sur toute image et tout `<video>` → CLS = 0.
- [ ] Heartbeat throttlé + `sendBeacon`/`keepalive` (pas de `fetch` bloquant sur `timeupdate`).
- [ ] Mises à jour d'état liées à une interaction en `useTransition`/`startTransition`.
- [ ] `poster` + `preload="none"` sur la vidéo ; aucun autoplay.
- [ ] Pages sous auth en `force-dynamic` (cookie apprenant) → pas de SSG, compatible `stub.invalid`.

---

## 10. Compatibilité contrat de build `stub.invalid` (ADR 0026)

- Les pages LMS sous auth sont **`force-dynamic`** (cookie `PortailAcces` requis) → **aucune query Prisma au build SSG** → rien à stub. Conforme.
- Les pages **publiques** (catalogue/fiche cours) en SSG+ISR feront des reads Prisma au build : sous `stub.invalid`, le Proxy renvoie `[] / null` → **rendu vide au build, repeuplé par l'ISR `revalidate=3600`** en prod (même pattern que `/ressources`). **Ne jamais** bloquer le build sur un read ; prévoir un fallback `if (process.env.DATABASE_URL?.includes("stub.invalid")) return <SkeletonCatalogue/>` si une page publique LMS lit la DB directement (cf. AGENTS.md, contrat build).
- Aucune connexion **Cloudflare Stream / R2** au build (uploads = runtime/admin uniquement). Conforme.

---

## 11. Anti-patterns à proscrire (résumé)

- ❌ MP4 R2 brut servi au player (pas d'ABR) → utiliser **Cloudflare Stream HLS**.
- ❌ hls.js / Tiptap / dnd-kit dans le First Load → **`dynamic`/`import()`** exclusivement.
- ❌ `fetch` de progression sur `timeupdate` → **throttle + `sendBeacon`**.
- ❌ Autoplay vidéo, animations JS lourdes de feedback quiz, confetti.
- ❌ Image/vidéo sans dimensions → **CLS**.
- ❌ Ajouter une page LMS sous auth au `collect.url` Lighthouse (non auth-able + non représentatif).
- ❌ Mutualiser les chunks LMS dans une seule entrée `size-limit` (verdict faussé).
- ❌ Relâcher un budget existant pour faire passer le LMS → **STOP & ASK Will + ADR**.

---

## Liens

- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-LMS-0005 (vidéo Cloudflare Stream), ADR-LMS-0007 (cloisonnement code), ADR-LMS-0008 (migrations additives) ; **futur ADR-LMS-0009** (budgets perf surfaces client-heavy, à créer).
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — `videoAssetId`, `imageCouvertureKey`, `dureeEstimeeMinutes`, enums.
- `03-DATA-MODEL/02-schema-progression-tracking.md` — `LessonProgress` (positionSec/watchedSec) pour le heartbeat.
- `03-DATA-MODEL/03-schema-quiz-evaluations.md` — `Quiz`/`Question`/`QuizAttempt` (correction serveur).
- `04-BACKEND/07-pipeline-video-streaming.md` — pipeline Cloudflare Stream + URLs signées + worker.
- `05-FRONTEND-APPRENANT/02-lecteur-cours-player.md` — spec UX player (réservation visuelle, contrôles).
- `05-FRONTEND-APPRENANT/03-moteur-quiz-ui.md` — UX quiz.
- `05-FRONTEND-APPRENANT/07-catalogue-public-seo.md` — vitrine publique (entre dans le gate Lighthouse).
- `06-CONSOLE-ADMIN/03-outil-auteur-course-builder.md` — UX builder + lazy-loading.
- `09-QUALITE/01-plan-tests.md` — tests Playwright perf.
- `09-QUALITE/04-accessibilite-wcag22.md` — WCAG (player, drag&drop, target-size) ; complète CLS/INP.
- Source de vérité plateforme : `axionia/AGENTS.md`, `axionia/lighthouserc.json`, `axionia/package.json` (bloc `size-limit`), `_AUDIT/AUDIT-WEB-VITALS-2026-BUDGETS.md`.
