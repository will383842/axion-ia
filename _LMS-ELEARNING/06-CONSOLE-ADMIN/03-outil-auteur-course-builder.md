# Console admin — Outil auteur (Course Builder)

> **Point critique du projet : « facile à remplir ».** Un cours mal outillé = du contenu jamais créé. Ce document spécifie l'éditeur de cours de bout en bout : structure drag&drop, éditeur de leçon unifié multi-blocs, upload média direct R2, templates, clonage, aperçu _as-student_, workflow brouillon→publication, et assistance IA.
>
> Statut : **spécification implémentable** (V1 — l'« outil auteur abouti » de la roadmap). Le MVP livre un sous-ensemble explicitement marqué `MVP` ci-dessous ; le reste est `V1`.
> Dernière mise à jour : 2026-06-27.

**Ancrages (sources de vérité) :**

- Data model : [`03-DATA-MODEL/01-schema-cours-modules-lecons.md`](../03-DATA-MODEL/01-schema-cours-modules-lecons.md) — `ElearningCourse` / `ElearningModule` / `ElearningLesson` / `ElearningResource`, enums `ElearningCourseStatut` / `ElearningLessonType` / `ElearningUnlockType`.
- ADR : [`00-INDEX/DECISIONS-ARBITRAGES.md`](../00-INDEX/DECISIONS-ARBITRAGES.md) — notamment ADR-0005 (vidéo Cloudflare Stream), ADR-0007 (cloisonnement code), ADR-0008 (migrations additives).
- Roadmap : [`11-ROADMAP/01-phasage-mvp-v1-v2.md`](../11-ROADMAP/01-phasage-mvp-v1-v2.md) — lot 8 (MVP : outil auteur minimal), V1 (outil auteur abouti).

---

## 0. EXISTANT réutilisé vs NEUF (carte anti-duplication)

| Brique                                                                   | Statut                                      | Référence réelle dans le code                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Upload média direct navigateur → R2                                      | ♻️ **EXISTANT**                             | `src/lib/r2-storage.ts` → `getSignedUploadUrlR2(key, contentType, ttl)` ; pattern de référence : `src/server/actions/intervention-documents/kit-import.actions.ts` (`prepareKitUploadAction` rend `{uploadUrl, tempKey}`, le navigateur fait `fetch(url,{method:"PUT",body:file})`).                                                                                     |
| Téléchargement / lecture média                                           | ♻️ **EXISTANT**                             | `getSignedUrlR2(key, ttl)` + `getObjectBufferR2(key)` (fail-soft).                                                                                                                                                                                                                                                                                                       |
| Wrapper page admin                                                       | ♻️ **EXISTANT**                             | `src/components/admin/ui/AdminPageShell.tsx` (`width="full"                                                                                                                                                                                                                                                                                                              | "narrow"                                                                                                                           | "wide"`), `AdminPageHeader`, `AdminToolbar`, `AdminCard`, `AdminTabs`, `AdminBadge`, `AdminTable`, `AdminConfirmDialog`, `AdminAutosaveIndicator`, `AdminConflictDialog`, `AdminFormDirtyGuard`, `AdminUndoToast`, `AdminEmptyState`, `AdminLoadingState`. Inventaire complet : `src/components/admin/ui/index.ts`. |
| RBAC server actions                                                      | ♻️ **EXISTANT**                             | `requireAdminRead/Write/Publish/Delete` (rôles `super_admin`/`admin`/`editor`/`reader`). Pattern dans `src/server/actions/knowledge/_guards.ts`. **NEUF** : `src/server/elearning/_guards.ts` (re-export local cloisonné, voir §10).                                                                                                                                     |
| Navigation admin (SSOT)                                                  | ♻️ **EXISTANT**                             | `src/lib/admin-nav.ts` (`AdminNavItem`, `AdminNavGroup`, `tier: "simple"                                                                                                                                                                                                                                                                                                 | "advanced"`). Sidebar montée = `src/components/admin/ui/AdminSidebarNav.tsx`. **NEUF** : ajout d'un groupe `elearning` (voir §11). |
| Drag & drop                                                              | ♻️ **EXISTANT (dépendance déjà installée)** | `@dnd-kit/core` ^6.3.1, `@dnd-kit/sortable` ^10, `@dnd-kit/utilities` ^3.2.2 (cf. `package.json`). **Aucune nouvelle dépendance.**                                                                                                                                                                                                                                       |
| Éditeur de texte riche                                                   | ♻️ **EXISTANT (dépendance déjà installée)** | `@tiptap/react` ^3.22.5, `@tiptap/starter-kit` ^3.22.5, `@tiptap/pm` ^3.22.5 (cf. `package.json`). Sérialisation **JSON Tiptap** dans `ElearningLesson.contenuJson`. **Aucune nouvelle dépendance.**                                                                                                                                                                     |
| File d'attente / workers                                                 | ♻️ **EXISTANT**                             | `src/server/queue/queues.ts` (`enqueue*`) + workers `src/server/queue/workers/*-worker.ts`. **NEUF** : `elearning-media-worker.ts`, `elearning-ai-authoring-worker.ts` (voir §8, §9).                                                                                                                                                                                    |
| IA (LLM provider, cache, coût)                                           | ♻️ **EXISTANT**                             | `src/server/content-gen/providers/anthropic.ts` (`anthropicProvider.generate`), `src/server/content-gen/lib/retry.ts` (`withRetry`), `src/server/content-gen/lib/cost-tracker.ts` (`assertCostCapAvailable`, `trackCost`). Pattern complet : `qualiopi-formation-engine-worker.ts`. RAG : réutiliser la base knowledge existante (cf. doc `09-tuteur-rag-assistant.md`). |
| Coeur LMS (cours/modules/leçons/ressources)                              | 🆕 **NEUF**                                 | Modèles Prisma du doc data-model 01. Code sous `src/server/elearning/**` (ADR-0007).                                                                                                                                                                                                                                                                                     |
| Course Builder UI (shell, arbre, éditeur leçon, blocs, uploader, aperçu) | 🆕 **NEUF**                                 | `src/components/admin/elearning/builder/**` (voir §3-§6).                                                                                                                                                                                                                                                                                                                |
| Server actions builder                                                   | 🆕 **NEUF**                                 | `src/server/elearning/actions/course-builder.actions.ts` etc. (voir §10).                                                                                                                                                                                                                                                                                                |

> **Règle de cloisonnement (ADR-0007) :** tout code neuf vit sous `src/server/elearning/**`, `src/app/[locale]/(admin)/[adminPrefix]/elearning/**`, `src/components/admin/elearning/**`, workers `src/server/queue/workers/elearning-*-worker.ts`. **Jamais** de duplication d'une brique existante.

---

## 1. Principes d'UX (la barre « facile à remplir »)

1. **Une seule page, trois zones, zéro rechargement.** Le builder est un layout 3-colonnes persistant (arbre structurel ← → éditeur ← → inspecteur), pas une cascade de pages CRUD. L'auteur garde toujours le contexte du cours.
2. **Autosave par défaut, jamais de « bouton Enregistrer » anxiogène.** Sauvegarde optimiste débouncée (800 ms) via server action, indicateur `AdminAutosaveIndicator` (« Enregistré il y a 3 s »). Publication = action explicite séparée.
3. **Brouillon = bac à sable.** Tant que `statut = brouillon`, rien n'est visible des apprenants (filtre `statut` côté requêtes apprenant). On peut tout casser sans risque.
4. **Drag & drop partout où il y a un ordre** : modules dans le cours, leçons dans un module, blocs dans une leçon, questions dans un quiz. Réécriture transactionnelle des `ordre`.
5. **Démarrer d'un template, pas d'une page blanche.** Au « Nouveau cours », proposer 4-5 squelettes pré-remplis (voir §7).
6. **Aperçu _as-student_ à un clic**, dans l'état exact que verra l'apprenant (déverrouillages simulés, quiz jouables en mode bac à sable).
7. **L'IA propose, l'humain dispose.** Toute génération IA atterrit en **brouillon éditable** avec bandeau « Généré par IA — à relire » ; jamais d'auto-publication (cohérent avec le Formation Engine qui exige une validation humaine).
8. **Accessibilité auteur ET apprenant (WCAG 2.2 AA, EAA 28/06/2025).** Le drag&drop a **toujours** une alternative clavier (critère 2.5.7) : menu « Déplacer ↑ / ↓ / vers module… » sur chaque élément. Cibles ≥ 24×24 px (2.5.8). Focus visible, annonces ARIA live des réordonnancements.

---

## 2. Architecture des écrans & routes (NEUF)

Toutes les routes sous `src/app/[locale]/(admin)/[adminPrefix]/elearning/`. `[adminPrefix]` = segment admin secret existant. Toutes en **`force-dynamic`** (derrière auth → compatibles avec le contrat de build `stub.invalid` : pas de SSG, donc pas d'appel Prisma au build).

| Écran                                    | Route (fichier)                                        | Composant racine                   | Phase |
| ---------------------------------------- | ------------------------------------------------------ | ---------------------------------- | ----- |
| Liste des cours                          | `elearning/cours/page.tsx`                             | `<CourseListView>`                 | MVP   |
| Création (choix template)                | `elearning/cours/nouveau/page.tsx`                     | `<CourseCreateWizard>`             | MVP   |
| **Course Builder** (structure + édition) | `elearning/cours/[courseId]/page.tsx`                  | `<CourseBuilderShell>`             | MVP   |
| Édition d'une leçon (deep-link)          | `elearning/cours/[courseId]/lecon/[lessonId]/page.tsx` | `<CourseBuilderShell focusLesson>` | MVP   |
| Réglages du cours                        | `elearning/cours/[courseId]/reglages/page.tsx`         | `<CourseSettingsForm>`             | MVP   |
| Aperçu as-student                        | `elearning/cours/[courseId]/apercu/page.tsx`           | `<CoursePreviewFrame>`             | MVP   |
| Banque de quiz (cf. doc 06)              | `elearning/banque-quiz/**`                             | —                                  | V1    |

```
elearning/cours/[courseId]/page.tsx   (Server Component)
  └─ charge le cours + modules + leçons (sans le détail des blocs lourds)
  └─ <CourseBuilderShell course={...} />   (Client Component, layout 3-col)
       ├─ <CourseStructureTree>     (colonne gauche — drag&drop modules/leçons)
       ├─ <LessonEditorPane>        (colonne centre — éditeur multi-blocs)
       └─ <BuilderInspector>        (colonne droite — propriétés contextuelles)
```

**Stratégie données :** la page server charge l'**arborescence légère** (titres, types, ordres, flags `unlock*`, durées) — pas les `contenuJson` volumineux. L'éditeur charge le `contenuJson` d'une leçon **à la demande** (server action `getLessonContentAction(lessonId)`) quand on la sélectionne → premier rendu rapide, mémoire maîtrisée même sur un cours à 80 leçons.

---

## 3. Colonne GAUCHE — `<CourseStructureTree>` (drag & drop structure)

### 3.1 Rôle

Représentation arborescente **Cours → Modules → Leçons**, manipulable au drag&drop, qui pilote la sélection de l'éditeur central.

### 3.2 Composants (NEUF)

```
src/components/admin/elearning/builder/
  CourseBuilderShell.tsx        // layout 3-col + state machine sélection + provider autosave
  CourseStructureTree.tsx       // <DndContext> racine (un seul, partagé)
  ModuleRow.tsx                 // useSortable() — poignée + titre inline + menu
  LessonRow.tsx                 // useSortable() — icône type + titre + badges (durée, obligatoire, verrou)
  TreeItemMenu.tsx              // menu kebab : dupliquer / supprimer / déplacer (clavier) / verrou
  AddItemButton.tsx            // "+ Module" / "+ Leçon" (avec sous-menu type de leçon)
```

### 3.3 Mécanique drag & drop (`@dnd-kit`, EXISTANT)

- Un seul `<DndContext>` (`@dnd-kit/core`) au niveau `CourseStructureTree`, deux `SortableContext` (`@dnd-kit/sortable`) imbriqués : un par liste de modules, un par liste de leçons d'un module.
- **Cross-container** : une leçon peut être glissée d'un module à un autre (gestion des collisions `closestCenter` + détection du conteneur de drop via `data.containerId`).
- `onDragEnd` → calcul du nouvel ordre côté client (réordonnancement optimiste) → server action `reorderAction` (voir §10) qui **réécrit les `ordre` en une transaction** (respecte `@@unique([courseId, ordre])` et `@@unique([moduleId, ordre])` du data-model — réécriture full-liste pour éviter les collisions d'unicité).
- **Annonces ARIA** : `announcements` de dnd-kit branchées sur un `aria-live="assertive"` (« Leçon "Intro" déplacée en position 2 du module "Bases" »).

### 3.4 Alternative clavier obligatoire (WCAG 2.5.7)

Sur chaque `ModuleRow` / `LessonRow`, `TreeItemMenu` propose :

- **Monter / Descendre** (Alt+↑ / Alt+↓) → même `reorderAction`.
- **Déplacer vers le module…** (sélecteur) pour les leçons.
  dnd-kit fournit aussi un `KeyboardSensor` (Espace pour saisir, flèches pour déplacer, Espace pour déposer) — activé en plus du menu, pas à la place.

### 3.5 Indicateurs visuels dans l'arbre

- Icône par `ElearningLessonType` (vidéo ▶, texte ¶, pdf 📄, quiz ✓, embed ⧉, devoir ✎).
- Badge **durée** (`dureeEstimeeMinutes`), badge **verrou** si `unlockType ≠ immediat` (avec tooltip lisible : « Déverrouillé après réussite du quiz "X" ≥ 70 % »).
- Badge **brouillon de bloc** si une leçon contient un bloc IA non relu.
- État `obligatoire=false` grisé (« optionnel »).

---

## 4. Colonne CENTRE — `<LessonEditorPane>` (éditeur de leçon unifié multi-blocs)

> **Décision de conception clé :** on **NE fait PAS** « un type de leçon = un éditeur ». On évite l'anti-pattern « un type par leçon » cité dans les best practices. Une leçon est un **canevas de blocs ordonnés** ; `ElearningLesson.type` devient un **type _dominant_** (sert au routage UX apprenant et aux pictos), mais le corps réel est une **liste de blocs hétérogènes** stockée dans `ElearningLesson.contenuJson`.

### 4.1 Format de `contenuJson` (NEUF — schéma documenté ici, source de vérité)

`ElearningLesson.contenuJson` (champ `Json?` du data-model) contient un document de blocs :

```jsonc
{
  "schemaVersion": 1,
  "blocks": [
    {
      "id": "blk_aa1",
      "type": "richtext",
      "data": {
        "tiptap": {
          /* doc Tiptap JSON */
        },
      },
    },
    {
      "id": "blk_aa2",
      "type": "video",
      "data": { "videoAssetId": "cf_abc123", "dureeSec": 412, "captionsResourceId": "res_x" },
    },
    {
      "id": "blk_aa3",
      "type": "image",
      "data": {
        "r2Key": "elearning/courses/<id>/img/uuid.webp",
        "alt": "Schéma RAG",
        "caption": "...",
      },
    },
    {
      "id": "blk_aa4",
      "type": "pdf",
      "data": {
        "r2Key": "elearning/courses/<id>/pdf/uuid.pdf",
        "telechargeable": true,
        "titre": "Fiche mémo",
      },
    },
    {
      "id": "blk_aa5",
      "type": "callout",
      "data": {
        "variant": "info|astuce|attention",
        "tiptap": {
          /* ... */
        },
      },
    },
    { "id": "blk_aa6", "type": "quiz", "data": { "quizId": "qz_123", "mode": "inline" } },
    {
      "id": "blk_aa7",
      "type": "embed",
      "data": { "provider": "replay|iframe", "url": "https://...", "titre": "..." },
    },
    { "id": "blk_aa8", "type": "fichier", "data": { "resourceId": "res_y" } },
    {
      "id": "blk_aa9",
      "type": "devoir",
      "data": {
        "consigne": {
          /* tiptap */
        },
        "formatsAcceptes": ["pdf", "docx"],
        "tailleMaxMo": 20,
      },
    },
  ],
}
```

Règles :

- **`schemaVersion`** versionne le format (migration douce future). Validé par un schéma **Zod** `lessonContentSchema` dans `src/server/elearning/schemas/lesson-content.ts` (NEUF) — appelé côté server action avant toute écriture.
- **Cohérence avec les colonnes scalaires :** quand une leçon a un bloc `video`/`pdf`/`quiz` _dominant_, on **dénormalise** aussi vers les colonnes existantes `ElearningLesson.videoAssetId` / `pdfKey` / `quizId` (le data-model 01 les prévoit) pour permettre des requêtes simples côté apprenant et la rétro-compat. La dénormalisation est faite par la server action de sauvegarde, jamais à la main.
- Les médias référencés par `r2Key` correspondent à des `ElearningResource` (relation `lesson.resources`) **ou** à des clés directes (images inline). Les vidéos passent par `videoAssetId` (Cloudflare Stream, ADR-0005), **jamais** par R2 brut.

### 4.2 Catalogue des blocs (palette « + Ajouter un bloc »)

| Bloc              | `type`     | Éditeur                                                                  | Stockage                                | Phase |
| ----------------- | ---------- | ------------------------------------------------------------------------ | --------------------------------------- | ----- |
| Texte riche       | `richtext` | Tiptap (`@tiptap/react` + StarterKit + extensions maison liens/tableaux) | `data.tiptap` (JSON)                    | MVP   |
| Encadré (callout) | `callout`  | Tiptap + sélecteur variante                                              | `data.variant`, `data.tiptap`           | V1    |
| Vidéo             | `video`    | `<VideoBlockEditor>` (upload → Stream, choix asset, sous-titres)         | `data.videoAssetId` + `videoDureeSec`   | MVP   |
| Image             | `image`    | `<ImageBlockEditor>` (upload R2 direct, **alt obligatoire**)             | `data.r2Key`, `data.alt`                | MVP   |
| PDF               | `pdf`      | `<PdfBlockEditor>` (upload R2, toggle téléchargeable)                    | `data.r2Key`                            | MVP   |
| Quiz              | `quiz`     | sélecteur de `Quiz` (banque) ou « créer un quiz »                        | `data.quizId`                           | MVP   |
| Embed / replay    | `embed`    | URL + validation allow-list domaines                                     | `data.url`, `data.provider`             | V1    |
| Fichier joint     | `fichier`  | upload R2 (toute extension allow-listée)                                 | `data.resourceId`                       | V1    |
| Devoir (rendu)    | `devoir`   | consigne Tiptap + formats acceptés                                       | `data.consigne`, `data.formatsAcceptes` | V1    |

Chaque bloc dans le canevas est lui-même **sortable** (`@dnd-kit/sortable`) → drag&drop des blocs **dans** la leçon, plus alternative clavier (même pattern qu'au §3.4).

### 4.3 Édition de texte (Tiptap, EXISTANT en dépendance)

- Composant `<RichTextBlock>` (NEUF) : `useEditor` avec `StarterKit` + extensions retenues (gras/italique/listes/titres H2-H4/lien/code/citation/tableau). **Pas de H1** dans le corps (le H1 = titre de la leçon, géré par le shell — cohérent avec la règle FORBID h1 du content-gen).
- Sortie = **JSON Tiptap** (`editor.getJSON()`), jamais du HTML brut → stocké dans `data.tiptap`. Le rendu apprenant utilise `generateHTML()` côté serveur ou un renderer React (cf. doc `05-FRONTEND-APPRENANT/02-lecteur-cours-player.md`), pas de `dangerouslySetInnerHTML` non assaini.
- **Sanitisation** : à la sauvegarde, le JSON est re-validé contre une allow-list de marks/nodes (schéma Zod) → on n'accepte pas de node inconnu (anti-XSS stocké).
- Barre d'outils flottante (bubble menu) + insertion via `/` (slash-menu) pour appeler la palette de blocs sans quitter le clavier.

### 4.4 Barre d'en-tête de leçon (toujours visible)

- Titre éditable inline (`AdminInlineEdit`), type dominant (sélecteur), `dureeEstimeeMinutes` (auto-suggérée : somme durées vidéos + estimation lecture texte ; éditable), toggle **`obligatoire`**, accès rapide au panneau **déverrouillage** (ouvre l'inspecteur §5).
- `AdminAutosaveIndicator` à droite (état de sauvegarde du bloc/leçon courant).

---

## 5. Colonne DROITE — `<BuilderInspector>` (propriétés contextuelles)

Panneau contextuel selon la sélection (cours / module / leçon / bloc). Évite d'ouvrir des modales.

### 5.1 Inspecteur de **module**

- Titre, description.
- **Déverrouillage du module** — édite `ElearningModule.unlockType` + champs liés du data-model :
  - `immediat`
  - `apres_precedent`
  - `date_fixe` → date-picker → `unlockDate`
  - `offset_inscription` → nombre de jours → `unlockOffsetJours` (« J+N après l'octroi d'accès »)
  - `score_quiz` → sélecteur de quiz (`unlockQuizId`) + seuil `unlockScorePct` (slider 0-100). **Gating par score réel**, pas attempt-only.
- Aperçu humain de la règle (« Ce module s'ouvrira le 2026-09-01 » / « après réussite du quiz "Bases" ≥ 70 % »).

### 5.2 Inspecteur de **leçon**

- Mêmes champs `unlock*` que le module (granularité leçon — le data-model les porte aussi sur `ElearningLesson`).
- `obligatoire`, durée, ressources rattachées (`ElearningResource`) avec gestion sous-titres (`type = "sous_titres"`).

### 5.3 Inspecteur de **bloc**

- Propriétés spécifiques au type (alt d'image, variante de callout, toggle téléchargeable du PDF, mode quiz inline/page, formats acceptés du devoir).

### 5.4 Inspecteur de **cours** (raccourci vers Réglages)

- Édite les champs `ElearningCourse` : `titre`, `sousTitre`, `description`, `objectifs[]`, `prerequis[]`, `publicVise`, `seuilReussitePct`, `estFoad`, `imageCouvertureKey`, `formationId` (lien optionnel Qualiopi), `vendableSeul`, `ownerClientId` (réservé V2).
- **Note conformité FOAD :** `description` + `objectifs` + `dureeEstimeeMinutes` agrégée alimentent l'« information sur les activités et la durée moyenne » exigée par l'art. D.6313-3-1 §2 (cf. doc `08-CONFORMITE/01-foad-d6313-3-1.md`). Un module « validation/évaluation » est recommandé par le builder (nudge Ind.11).

---

## 6. Upload média (simple, direct R2 — réutilise l'EXISTANT)

### 6.1 Images / PDF / fichiers → R2 direct (pattern `kit-import`)

Flux (zéro transit par le serveur Next, contourne la limite des server actions) :

1. **Client** sélectionne un fichier dans `<ImageBlockEditor>` / `<PdfBlockEditor>`.
2. **Server action** `prepareMediaUploadAction({ courseId, kind, fileName, contentType, sizeBytes })` (NEUF) :
   - `requireAdminWrite()` ;
   - valide `contentType` contre une **allow-list** par `kind` (image → `image/webp|png|jpeg`, pdf → `application/pdf`, fichier → allow-list élargie) et `sizeBytes` < plafond (ex. image 10 Mo, pdf 50 Mo) ;
   - construit une clé canonique : `elearning/courses/<courseId>/<kind>/<uuid>.<ext>` ;
   - retourne `getSignedUploadUrlR2(key, contentType, 15*60)` → `{ uploadUrl, r2Key }`.
3. **Client** : `fetch(uploadUrl, { method: "PUT", headers: {"content-type": contentType}, body: file })` avec barre de progression (`XMLHttpRequest`/`ReadableStream`).
4. **Client** appelle `attachResourceAction({ lessonId, r2Key, type, mimeType, sizeBytes, titre })` (NEUF) qui crée l'`ElearningResource` et insère/maj le bloc dans `contenuJson`.

> ⚠️ **Pré-requis plateforme (déjà documenté dans `r2-storage.ts`) :** le bucket R2 doit autoriser le CORS `PUT` depuis l'origine admin (AllowedMethods PUT, AllowedHeaders content-type, AllowedOrigins). À vérifier au déploiement (action côté Will/Cloudflare, hors code).
>
> **Mode dégradé :** si `isR2Configured()` est faux, `prepareMediaUploadAction` retourne `{ ok:false, error:"Stockage indisponible (R2 non configuré ?)" }` et l'UI affiche un état clair (jamais de crash).

### 6.2 Vidéo → Cloudflare Stream (ADR-0005, NEUF)

La vidéo **ne passe pas par R2** :

1. `prepareVideoUploadAction({ courseId, lessonId })` → demande à Cloudflare Stream une **URL d'upload directe (tus/one-time)** et crée un enregistrement « asset en cours » → retourne `{ uploadUrl, videoAssetId }`.
2. Le navigateur téléverse vers Stream (résumable upload tus, gère les gros fichiers).
3. Stream transcode (HLS adaptatif) en asynchrone. Un **worker `elearning-media-worker.ts`** (NEUF, voir §8) poll/reçoit le webhook « ready », récupère `videoDureeSec`, génère le thumbnail, marque l'asset prêt et met à jour `ElearningLesson.videoDureeSec` + le bloc.
4. **Sous-titres (WCAG AA, obligatoires)** : upload d'un fichier `.vtt` → soit attaché comme `ElearningResource type="sous_titres"`, soit poussé comme track Stream. Le builder **bloque la publication d'une leçon vidéo sans piste de sous-titres** (warning non bloquant en brouillon, bloquant à la publication — voir §12 checklist).

Détail complet du pipeline : doc `04-BACKEND/07-pipeline-video-streaming.md`.

### 6.3 Bibliothèque média du cours

Onglet « Médias » du builder : liste des `ElearningResource` + assets Stream du cours, réutilisables entre leçons (évite les ré-uploads). Filtre par type, recherche, prévisualisation. (V1.)

---

## 7. Templates de cours (démarrer ≠ page blanche)

### 7.1 Stratégie

**Pas de nouveau modèle Prisma.** Un template = un **objet TypeScript** (factory côté serveur) qui décrit une arborescence pré-remplie de modules/leçons/blocs. Source : `src/server/elearning/templates/course-templates.ts` (NEUF).

```ts
export interface CourseTemplate {
  id: string; // "foad-standard"
  label: string; // "Parcours FOAD standard (conforme)"
  description: string;
  build(): CourseSkeleton; // modules[] + lessons[] + blocs minimaux + unlock par défaut
}
```

À la création (`CourseCreateWizard`), choisir un template → `createCourseAction({ templateId, titre })` instancie le cours en `brouillon` avec sa structure (transaction).

### 7.2 Templates fournis (V1)

| Template                                | Contenu pré-câblé                                                                                                                                                                                                                                                                  |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vierge**                              | 1 module, 1 leçon texte.                                                                                                                                                                                                                                                           |
| **FOAD standard (conforme)**            | Module « Bienvenue & objectifs » (info durée/activités — D.6313-3-1 §2), 2-3 modules de contenu, **module « Évaluation finale » avec quiz** (Ind.11), leçon « Accompagnement & contact tuteur » (Ind.19). `seuilReussitePct=70`, `estFoad=true`, déverrouillage `apres_precedent`. |
| **Microlearning**                       | 6-8 leçons courtes (2-10 min), 1 quiz tous les 3 modules.                                                                                                                                                                                                                          |
| **Adossé à une formation présentielle** | Pré-rempli depuis une `Formation` Qualiopi existante (`formationId`) : reprend objectifs/prérequis ; complément asynchrone.                                                                                                                                                        |
| **Onboarding équipe entreprise**        | Structure orientée import masse (V2 multi-tenant) : modules courts + quiz de validation.                                                                                                                                                                                           |

### 7.3 Pré-remplissage depuis une `Formation` (réutilisation Formation Engine)

Si l'auteur choisit « Adossé à une formation », le wizard charge la `Formation` (objectifs pédagogiques, prérequis, public visé déjà rédigés par le Formation Engine IA) et **mappe** ces champs vers `ElearningCourse.objectifs/prerequis/publicVise`. **Réutilisation directe**, pas de re-saisie.

---

## 8. Clonage (cours / module / leçon)

### 8.1 Cas d'usage

Dupliquer un cours pour décliner une variante, cloner un module type, copier une leçon bien conçue.

### 8.2 Server action `cloneAction({ scope, id, options })` (NEUF)

- `scope: "course" | "module" | "lesson"`.
- **Deep copy transactionnel** : nouveaux UUID pour toutes les entités, `ordre` recalculés, `slug` du cours rendu unique (`<slug>-copie`, suffixe incrémental contrôlé contre `@unique`), `statut="brouillon"`, `version=1`, `publishedAt=null`.
- **Médias** : par défaut **référence partagée** des `r2Key`/`videoAssetId` (copie par pointeur — pas de duplication du binaire, économise R2/Stream). Option `deepCopyMedia` (V1) qui re-copie les objets R2 (`getObjectBufferR2` + `uploadToR2` sous une nouvelle clé) ; les assets Stream sont **toujours référencés** (la copie d'asset Stream se fait via API Stream, V2).
- **Quiz** : par défaut le clone **référence** le même `Quiz` (banque partagée) ; option « cloner aussi les quiz » crée des copies (cf. doc 06).
- Re-numérotation des `unlock*` qui pointaient vers un quiz cloné (remap des `unlockQuizId`).

---

## 9. Aperçu _as-student_ (`<CoursePreviewFrame>`)

### 9.1 Objectif

Voir le cours **exactement comme un apprenant**, sans créer de faux compte ni polluer les données de progression.

### 9.2 Mécanique (NEUF)

- Route `elearning/cours/[courseId]/apercu/page.tsx` → rend le **vrai player apprenant** (`src/components/elearning/player/**`, cf. doc `05-FRONTEND-APPRENANT/02-*`) en **mode preview** : flag `previewMode` passé au player.
- En `previewMode` :
  - la progression et les tentatives de quiz sont **éphémères** (state client / table `*_preview` jamais persistée, ou simplement non écrites) → zéro `LessonProgress`/`QuizAttempt` réel ;
  - un **sélecteur d'état de simulation** permet de tester les déverrouillages : « Voir comme : début / après module 1 / tout débloqué », et de **forcer le déblocage** d'un module verrouillé (override visuel) pour le relire ;
  - les quiz sont **jouables** (feedback affiché) sans impact ;
  - bandeau permanent « MODE APERÇU — aucune donnée enregistrée » + bouton « Quitter l'aperçu ».
- Accès : `requireAdminRead` suffit (lecture). Les médias sont servis via URL signées (mêmes helpers que l'apprenant).

> **Pourquoi réutiliser le vrai player ?** Garantit que l'aperçu = la réalité (pas de divergence d'un « faux » preview). C'est la meilleure pratique « preview as student ».

---

## 10. Server actions & services (NEUF — `src/server/elearning/**`)

> **Convention repo (vérifiée) :** Server Actions (pas REST par défaut), `"use server"`, validation **Zod**, RBAC en première ligne, retour `{ ok: boolean; error?: string; ... }`, `revalidatePath` ciblé. Pas de `try/catch` qui avale silencieusement (logguer). Cloisonnement ADR-0007.

### 10.1 Guards locaux

`src/server/elearning/_guards.ts` — ré-exporte/wrappe `requireAdminRead/Write/Publish/Delete` (mêmes rôles : `editor+` pour écrire, `admin+` pour publier, `super_admin` pour supprimer). Pattern identique à `knowledge/_guards.ts`.

### 10.2 Actions du builder

Fichier `src/server/elearning/actions/course-builder.actions.ts` :

| Action                                                                                                             | RBAC                                                    | Rôle                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `createCourseAction({ templateId, titre })`                                                                        | write                                                   | Instancie cours + structure depuis template (transaction).                                                                                                                          |
| `updateCourseMetaAction({ courseId, ...champs })`                                                                  | write                                                   | Met à jour les champs `ElearningCourse` (debounced autosave).                                                                                                                       |
| `getLessonContentAction({ lessonId })`                                                                             | read                                                    | Charge `contenuJson` à la demande (lazy).                                                                                                                                           |
| `saveLessonContentAction({ lessonId, blocks, dominantType, dureeEstimeeMinutes, obligatoire, expectedUpdatedAt })` | write                                                   | Valide via `lessonContentSchema` (Zod) + **dénormalise** vers `videoAssetId/pdfKey/quizId` + **optimistic concurrency** (compare `expectedUpdatedAt`, sinon `AdminConflictDialog`). |
| `addModuleAction` / `addLessonAction({ moduleId, type })`                                                          | write                                                   | Ajoute en fin de liste (`ordre = max+1`).                                                                                                                                           |
| `reorderModulesAction({ courseId, orderedIds })`                                                                   | write                                                   | Réécrit tous les `ordre` en transaction.                                                                                                                                            |
| `reorderLessonsAction({ moduleId, orderedIds })` / `moveLessonAction({ lessonId, toModuleId, toIndex })`           | write                                                   | Idem + cross-module.                                                                                                                                                                |
| `setUnlockAction({ scope, id, unlockType, unlockDate?, unlockOffsetJours?, unlockQuizId?, unlockScorePct? })`      | write                                                   | Édite les `unlock*` (module **ou** leçon).                                                                                                                                          |
| `cloneAction({ scope, id, options })`                                                                              | write                                                   | Deep copy (§8).                                                                                                                                                                     |
| `deleteModuleAction` / `deleteLessonAction`                                                                        | delete (`super_admin`) ou write avec confirmation forte | Suppression (cascade Prisma `onDelete: Cascade`). `AdminConfirmDialog` + `AdminUndoToast` (soft-undo : `archive` plutôt que delete dur si possible).                                |
| `prepareMediaUploadAction` / `attachResourceAction`                                                                | write                                                   | Upload R2 (§6.1).                                                                                                                                                                   |
| `prepareVideoUploadAction`                                                                                         | write                                                   | Upload Stream (§6.2).                                                                                                                                                               |
| `publishCourseAction({ courseId })`                                                                                | **publish** (`admin+`)                                  | Voir §12.                                                                                                                                                                           |
| `unpublishCourseAction` / `archiveCourseAction`                                                                    | publish                                                 | `statut = brouillon                                                                                                                                                                 | archive`. |

### 10.3 Services domaine

`src/server/elearning/builder/` :

- `course-tree.ts` — chargement arborescence légère, helpers d'ordre.
- `reorder.ts` — algorithme de réécriture d'ordre transactionnel (gère `@@unique`).
- `clone.ts` — deep copy.
- `publish.ts` — checklist de publication + incrément `version`.
- `lesson-content.ts` (+ `schemas/lesson-content.ts`) — validation/sanitisation des blocs.

### 10.4 Concurrence & autosave

- **Optimistic concurrency** : chaque entité expose `updatedAt`. Les actions de sauvegarde reçoivent `expectedUpdatedAt`. Mismatch → retour `{ ok:false, conflict:true }` → `AdminConflictDialog` (« Une version plus récente existe »). Empêche l'écrasement quand deux auteurs éditent (V1).
- **Autosave** : hook `useElearningAutosave` (NEUF, `src/components/admin/elearning/builder/useElearningAutosave.ts`) — debounce 800 ms, file d'attente sérielle par leçon, statut piloté vers `AdminAutosaveIndicator`. `AdminFormDirtyGuard` empêche la navigation avec des changements non sauvés.

---

## 11. Workers & files BullMQ (NEUF — cloisonnés)

| Worker                                                      | File                     | Rôle                                                                                                                                                                                                            |
| ----------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/server/queue/workers/elearning-media-worker.ts`        | `elearning-media`        | Post-traitement vidéo Stream (webhook/poll « ready » → durée, thumbnail, statut asset), validation antivirus/format des uploads R2, transcodage audio si besoin.                                                |
| `src/server/queue/workers/elearning-ai-authoring-worker.ts` | `elearning-ai-authoring` | Génération IA asynchrone (§13) : quiz-gen depuis contenu, brouillon de leçon document-grounded, résumés/objectifs. Suit le pattern `qualiopi-formation-engine-worker.ts` (cost cap, cache, retry, traçabilité). |

Enqueue via `src/server/queue/queues.ts` (ajout des `enqueueElearningMedia` / `enqueueElearningAiAuthoring`). **Respecter le contrat build** : `BULLMQ_DISABLED=true` au build → les workers ne s'initialisent pas (déjà géré par l'infra queue existante).

---

## 12. Workflow brouillon → publication

### 12.1 États (`ElearningCourseStatut`, EXISTANT dans data-model)

`brouillon` → `publie` → (`archive`). Réversible : `publie` → `brouillon` (`unpublishCourseAction`).

### 12.2 `publishCourseAction` — checklist bloquante (NEUF, service `publish.ts`)

La publication exécute une **checklist de qualité/conformité** ; chaque item est `bloquant` ou `avertissement`. Bloquant non satisfait → publication refusée avec liste claire des correctifs (UI : panneau « Prêt à publier ? »).

| Vérification                                                                               | Niveau        | Justification                                                            |
| ------------------------------------------------------------------------------------------ | ------------- | ------------------------------------------------------------------------ |
| Titre + description + au moins 1 objectif                                                  | bloquant      | Vitrine + info FOAD D.6313-3-1 §2.                                       |
| ≥ 1 module avec ≥ 1 leçon obligatoire                                                      | bloquant      | Cours non vide.                                                          |
| Au moins une **évaluation** (leçon `quiz` ou module gating `score_quiz`) si `estFoad=true` | bloquant      | **Ind.11 Qualiopi (non-conformité majeure si absente)** + D.6313-3-1 §3. |
| `seuilReussitePct` cohérent (1-100)                                                        | bloquant      | Certificat.                                                              |
| Chaque leçon vidéo a une piste **sous-titres**                                             | bloquant      | WCAG AA / EAA.                                                           |
| Chaque image a un **`alt`** non vide                                                       | bloquant      | WCAG 1.1.1.                                                              |
| `unlockQuizId` pointant vers un quiz existant et publié                                    | bloquant      | Évite un déverrouillage cassé.                                           |
| Information « accompagnement / contact tuteur » présente                                   | avertissement | Ind.19 (assistance FOAD).                                                |
| Aucune leçon contenant un bloc IA « non relu »                                             | avertissement | Gouvernance IA.                                                          |
| Durée totale renseignée                                                                    | avertissement | Info durée moyenne FOAD.                                                 |

Si OK : `statut="publie"`, `version += 1`, `publishedAt=now()`, `revalidatePath` (catalogue + espace apprenant). Trace d'audit (qui/quand/version) — réutiliser le mécanisme de journalisation admin existant.

### 12.3 Versionnage

`version` s'incrémente à chaque publication (traçabilité — un apprenant en cours garde l'accès ; politique de re-validation des modules impactés = doc `05-FRONTEND-APPRENANT/04-*`). Les apprenants ne voient jamais un `brouillon`.

---

## 13. Assistance IA à l'authoring (réutilise l'infra content-gen)

> **Principe (cohérent Formation Engine) :** l'IA **propose** un brouillon, jamais ne publie. Toute sortie atterrit éditable, marquée « Généré par IA — à relire », et ne passe la checklist de publication (§12) qu'après revue humaine.

### 13.1 Capacités (V1)

| Capacité                                  | Entrée                             | Sortie                                                                               | Worker                        |
| ----------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------- |
| **Quiz-gen depuis le contenu**            | blocs `richtext`/`pdf` d'un module | brouillon de `Quiz` + `Question[]` (QCM/V-F) avec **rationale**, en brouillon banque | `elearning-ai-authoring`      |
| **Brouillon de leçon document-grounded**  | doc R2 (PDF source) + consigne     | blocs `richtext` structurés (H2/H3, listes)                                          | idem                          |
| **Objectifs / résumé / public visé**      | structure du cours                 | suggestions pour `objectifs[]`, `description`, `publicVise`                          | inline (server action courte) |
| **Suggestion de découpage microlearning** | une longue leçon                   | proposition de scission en leçons 2-10 min                                           | idem                          |

### 13.2 Implémentation (réutilisation stricte)

- Provider : `anthropicProvider.generate` (`src/server/content-gen/providers/anthropic.ts`).
- Garde-fous : `assertCostCapAvailable` **avant**, `trackCost` **après**, `withRetry`, cache (`buildCacheKey`/`getCachedIa`/`setCachedIa`) — exactement le pattern du `qualiopi-formation-engine-worker.ts`.
- **RAG ancré (tuteur d'authoring)** : ancrer les générations sur la base knowledge existante avec **citations** (cf. doc `04-BACKEND/09-tuteur-rag-assistant.md`) → éviter le « wrapper ChatGPT nu » et les hallucinations (réutiliser `hasUnsourcedClaims`/anti-hallucination si pertinent).
- Toute génération est tracée (modèle, tokens, coût, cacheHit) comme les `FormationGenerationJob`.

### 13.3 UI

- Bouton « ✨ Assister » dans la barre de leçon et sur le module → ouvre un panneau (drawer) : prompt court + aperçu diff → « Insérer en brouillon ». Jamais d'insertion directe sans validation.

---

## 14. Accessibilité de l'outil auteur (WCAG 2.2 AA — obligation EAA)

- **2.5.7 (alternative au drag)** : tout réordonnancement drag&drop a un équivalent menu/clavier (§3.4, §4.2).
- **2.5.8 (taille de cible)** : poignées de drag, kebab, toggles ≥ 24×24 px.
- **2.4.11 (focus non masqué)** : panneaux/drawers ne masquent pas le focus.
- **3.3.8 (auth accessible)** : hérité de l'admin NextAuth existant.
- **Annonces ARIA live** des réordonnancements et des autosaves.
- **Focus management** : à la sélection d'une leçon, focus déplacé sur l'éditeur ; après suppression, focus sur l'élément voisin.
- Contraste tokens admin (système `admin.css` existant), respect du mode clair.

---

## 15. Performance & contrat de build

- **Pages builder en `force-dynamic`** (auth) → pas de SSG → **compatibles `stub.invalid`** (aucun appel Prisma au build). Aucune page publique impactée par les budgets Web Vitals stricts (le builder est admin-only).
- **Chargement progressif** : arborescence légère d'abord, `contenuJson` à la demande (§2). Tiptap et `@dnd-kit` chargés en **lazy/`dynamic()`** côté client pour ne pas alourdir le bundle admin initial.
- **Migrations additives** (ADR-0008) : les modèles du data-model 01 sont neufs ; les seuls ajouts aux tables existantes sont des relations inverses **sans colonne** (`Formation.elearningCourses`, `Client.coursesProprietaires`) → zéro risque prod.

---

## 16. Découpage MVP vs V1 (résumé)

**MVP (lot 8 roadmap) :** `CourseBuilderShell` 3-col, arbre drag&drop modules/leçons (+ clavier), éditeur multi-blocs avec blocs `richtext`/`video`/`image`/`pdf`/`quiz`, upload R2 direct + upload Stream, déverrouillage (`unlock*` complet, gating par score), autosave, template « Vierge » + « FOAD standard », aperçu as-student, publication avec checklist conformité (Ind.11 + sous-titres + alt).

**V1 :** blocs `callout`/`embed`/`fichier`/`devoir`, bibliothèque média réutilisable, tous les templates, clonage (cours/module/leçon), optimistic concurrency multi-auteurs, assist IA (quiz-gen + brouillon document-grounded), banque de quiz reliée.

**V2 :** scoping multi-tenant des cours (`ownerClientId`), copie profonde des assets Stream, import SCORM (si besoin commercial).

---

## Liens

- [`03-DATA-MODEL/01-schema-cours-modules-lecons.md`](../03-DATA-MODEL/01-schema-cours-modules-lecons.md) — modèles & enums édités par ce builder (source de vérité).
- [`03-DATA-MODEL/03-schema-quiz-evaluations.md`](../03-DATA-MODEL/03-schema-quiz-evaluations.md) — `Quiz`/`Question` référencés par les blocs `quiz` et les `unlock*`.
- [`04-BACKEND/02-server-actions.md`](../04-BACKEND/02-server-actions.md) — conventions server actions communes.
- [`04-BACKEND/03-workers-bullmq-crons.md`](../04-BACKEND/03-workers-bullmq-crons.md) — `elearning-media-worker`, `elearning-ai-authoring-worker`.
- [`04-BACKEND/07-pipeline-video-streaming.md`](../04-BACKEND/07-pipeline-video-streaming.md) — pipeline Cloudflare Stream (upload, HLS, URLs signées, sous-titres).
- [`04-BACKEND/08-ia-pedagogique-generation.md`](../04-BACKEND/08-ia-pedagogique-generation.md) & [`09-tuteur-rag-assistant.md`](../04-BACKEND/09-tuteur-rag-assistant.md) — IA d'authoring & RAG ancré.
- [`05-FRONTEND-APPRENANT/02-lecteur-cours-player.md`](../05-FRONTEND-APPRENANT/02-lecteur-cours-player.md) — player réutilisé par l'aperçu as-student.
- [`05-FRONTEND-APPRENANT/04-progression-deverrouillage.md`](../05-FRONTEND-APPRENANT/04-progression-deverrouillage.md) — sémantique des `unlock*` édités ici.
- [`06-CONSOLE-ADMIN/01-navigation-structure.md`](./01-navigation-structure.md) — ajout du groupe `elearning` dans `admin-nav.ts`.
- [`06-CONSOLE-ADMIN/06-gestion-banque-quiz.md`](./06-gestion-banque-quiz.md) — banque de quiz & types de questions.
- [`08-CONFORMITE/01-foad-d6313-3-1.md`](../08-CONFORMITE/01-foad-d6313-3-1.md) & [`02-qualiopi-indicateurs-foad.md`](../08-CONFORMITE/02-qualiopi-indicateurs-foad.md) — checklist de publication (Ind.11, Ind.19).
- [`09-QUALITE/04-accessibilite-wcag22.md`](../09-QUALITE/04-accessibilite-wcag22.md) — exigences WCAG/EAA de l'authoring.
- [`00-INDEX/DECISIONS-ARBITRAGES.md`](../00-INDEX/DECISIONS-ARBITRAGES.md) — ADR-0005/0007/0008 appliqués ici.
