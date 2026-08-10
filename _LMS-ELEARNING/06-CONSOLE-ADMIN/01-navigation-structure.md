# Console admin — Navigation & structure des pages e-learning

> **But du document.** Spécifier, prête à coder, l'intégration du module e-learning dans la **navigation admin existante** : nouveau pôle « E-learning » dans la SSOT `src/lib/admin-nav.ts`, arborescence des pages sous `src/app/[locale]/(admin)/[adminPrefix]/elearning/**`, rendu dans le **composant réellement monté** (`AdminSidebarNav.tsx`), usage de `AdminPageShell`, RBAC, badges, et liste **exhaustive** des items (MVP → V1 → V2).
>
> **Principe directeur (ADR-LMS-0007).** Zéro duplication, cloisonnement strict. On **étend** l'infra admin existante (SSOT nav, rail mocha, shell, RBAC) ; on n'en recrée aucune.
>
> Dernière mise à jour : 2026-06-27. Statut : spécification implémentable.

---

## 0. TL;DR pour l'implémenteur

1. **Un seul nouveau groupe de nav** : `"elearning"` ajouté à l'union `AdminNavGroup`, à `ADMIN_NAV_GROUP_LABELS`, à `ADMIN_NAV_GROUP_ORDER` (position : juste **après `qualiopi`**, avant `documents-interventions`).
2. **Une icône de groupe** dans `GROUP_ICON_MAP` (`AdminSidebarNav.tsx`) : `GraduationCap` est déjà importé/utilisé (partagé avec `qualiopi`/`coaching-1to1`) → réutiliser, ou importer `MonitorPlay` pour distinguer (recommandé).
3. **Items ajoutés à `buildAdminNav()`** : **12 items MVP** (visibles d'emblée), **+5 V1** et **+2 V2** (mêmes conventions ; `tier:"advanced"` pour le froid). Les routes d'édition profondes (course builder, éditeurs de leçon/quiz, fiches apprenant) **ne sont PAS des items de nav** : elles portent `parent` pour la résolution breadcrumbs sans encombrer le rail.
4. **Mettre à jour le snapshot count** dans `src/lib/admin-nav.test.ts` (actuellement `116`) : `116 + 12 = 128` au MVP (puis `+5`, `+2` aux phases suivantes).
5. **Ajouter les libellés au `ICON_MAP`** d'`AdminSidebarNav.tsx` (sinon fallback `FolderOpen`).
6. **Toutes les pages** utilisent `AdminPageShell` + `AdminPageHeader` + RBAC `requireAdmin*` (cf. §7).

---

## 1. Rappel de l'existant (ce qu'on réutilise tel quel)

| Brique                | Fichier réel                                        | Rôle                                                                                                      | Réutilisation e-learning                                                          |
| --------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| SSOT navigation       | `src/lib/admin-nav.ts`                              | `AdminNavGroup`, `ADMIN_NAV_GROUP_LABELS/ORDER`, `AdminNavItem`, `buildAdminNav()`, `findActiveNavHref()` | **Étendue** : +1 groupe, +N items                                                 |
| Sidebar montée        | `src/components/admin/ui/AdminSidebarNav.tsx`       | Rail mocha premium, accordéon **mono-section par groupe**, badges, recherche, collapse                    | **Étendue** : +1 entrée `GROUP_ICON_MAP`, +N entrées `ICON_MAP`, +badge optionnel |
| Sidebar V1 (obsolète) | `src/components/admin/AdminSidebar.tsx`             | **NE PAS utiliser** (remplacée 2026-05-20)                                                                | —                                                                                 |
| Layout admin          | `src/app/[locale]/(admin)/[adminPrefix]/layout.tsx` | Monte `<AdminSidebarNav items={buildNav(adminPrefix)} …>`, calcule les compteurs de badge                 | **Étendu** : +1 compteur badge optionnel (corrections en attente)                 |
| Shell de page         | `src/components/admin/ui/AdminPageShell.tsx`        | `width="full" \| "narrow" \| "wide"` (1440 / 720 / illimité)                                              | Réutilisé sur **toutes** les pages e-learning                                     |
| RBAC                  | `src/server/actions/knowledge/_guards.ts`           | `requireAdminRead/Write/Publish/Delete` (rôles `super_admin/admin/editor/reader`)                         | Réutilisé dans **toutes** les server actions e-learning                           |
| Test SSOT             | `src/lib/admin-nav.test.ts`                         | Verrou de comptage + unicité hrefs + couverture groupes                                                   | **À mettre à jour** (count + nouveau groupe)                                      |

**Mécanique de rendu importante (à respecter).** Le rail (`AdminSidebarNav`) rend **un accordéon par `AdminNavGroup`** (un seul ouvert à la fois). À l'intérieur d'un groupe, les items sont rendus **à plat**, avec une **indentation dérivée de la profondeur d'URL** (`itemLevel()` = nb de segments après `/fr/<prefix>` − 1, plafonné à 2). Le mécanisme `subGroup` (pôles) **n'est honoré que pour `group:"content_gen"`** (sous-accordéon spécifique). Donc, pour e-learning, **la hiérarchie visuelle se crée par l'imbrication des URLs**, pas par `subGroup`. On structure les libellés et l'ordre des items pour refléter des « pôles » logiques (cf. §4) sans dépendre de `subGroup`.

> Conséquence : pour éviter un rail surchargé, **toute route d'édition de niveau ≥ 3** (ex. `/elearning/courses/[id]/builder`) est **exclue du rendu** en lui donnant `parent` (cf. champ `AdminNavItem.parent`), tout en restant résolue par `findActiveNavHref()` (matching de préfixe → l'item parent reste surligné et le groupe « E-learning » reste ouvert).

---

## 2. Modifications de `src/lib/admin-nav.ts`

### 2.1 Union `AdminNavGroup`

```ts
export type AdminNavGroup =
  | "main"
  | "content"
  | "content_gen"
  | "qualiopi"
  | "elearning" // ← NOUVEAU (LMS / FOAD)
  | "documents-interventions"
  | "coaching-1to1"
  | "image-bank"
  | "presse"
  | "chatbot"
  | "engagement"
  | "ops"
  | "system";
```

### 2.2 Libellé du groupe

```ts
export const ADMIN_NAV_GROUP_LABELS: Record<AdminNavGroup, string> = {
  // …
  qualiopi: "Formation / Qualiopi",
  elearning: "E-learning", // ← NOUVEAU
  "documents-interventions": "Documents",
  // …
};
```

> **Choix du libellé.** « E-learning » (et non « FOAD » ou « LMS ») : terme grand public, distinct de « Formation / Qualiopi » (présentiel/live). La conformité FOAD est interne et exposée via une page dédiée (§4, _Preuves FOAD_).

### 2.3 Ordre des groupes

Position **juste après `qualiopi`** : l'e-learning est la modalité asynchrone qui prolonge l'offre de formation ; logiquement adjacent.

```ts
export const ADMIN_NAV_GROUP_ORDER: ReadonlyArray<AdminNavGroup> = [
  "main",
  "content",
  "content_gen",
  "qualiopi",
  "elearning", // ← NOUVEAU
  "documents-interventions",
  "coaching-1to1",
  "image-bank",
  "presse",
  "chatbot",
  "engagement",
  "ops",
  "system",
];
```

### 2.4 Items (insérés dans `buildAdminNav()`)

À insérer **après le dernier item du groupe `qualiopi`** (`/qualiopi/alertes`) et **avant** le bloc `documents-interventions`. `base` = `/fr/${adminPrefix}` (déjà défini en tête de fonction).

```ts
// ── E-learning (LMS / FOAD) — pôle ajouté juin 2026 ─────────────────────
//   Cloisonnement ADR-LMS-0007 : routes sous /elearning/**.
//   Ordre = par fréquence d'usage (chaud → froid). Hiérarchie visuelle
//   portée par l'imbrication d'URL (pas de subGroup : non honoré hors
//   content_gen par AdminSidebarNav). Les éditeurs profonds (≥ N3) portent
//   `parent` → exclus du rail mais résolus en breadcrumbs.

// ▸ PILOTER
{ href: `${base}/elearning`, label: "Tableau de bord", icon: "🎓", group: "elearning" },

// ▸ CONCEVOIR (authoring)
{ href: `${base}/elearning/courses`, label: "Cours", icon: "📦", group: "elearning" },
{ href: `${base}/elearning/media`, label: "Médiathèque vidéo", icon: "🎬", group: "elearning" },
{ href: `${base}/elearning/question-bank`, label: "Banque de questions", icon: "❓", group: "elearning" },

// ▸ DIFFUSER (accès)
{ href: `${base}/elearning/learners`, label: "Apprenants", icon: "🧑‍🎓", group: "elearning" },
{ href: `${base}/elearning/access`, label: "Accès & inscriptions", icon: "🔑", group: "elearning" },
{ href: `${base}/elearning/imports`, label: "Import en masse (CSV)", icon: "📥", group: "elearning" },

// ▸ ÉVALUER & SUIVRE
{ href: `${base}/elearning/grading`, label: "Corrections à faire", icon: "✍️", group: "elearning" },
{ href: `${base}/elearning/progress`, label: "Suivi & progression", icon: "📈", group: "elearning" },

// ▸ CERTIFIER & PROUVER
{ href: `${base}/elearning/certificates`, label: "Certificats", icon: "📜", group: "elearning" },
{ href: `${base}/elearning/foad-proofs`, label: "Preuves FOAD", icon: "🛡️", group: "elearning" },

// ▸ RÉGLER
{ href: `${base}/elearning/settings`, label: "Réglages e-learning", icon: "⚙️", group: "elearning", tier: "advanced" },
```

> **12 items MVP.** Snapshot `admin-nav.test.ts` : `116 → 128`.

#### Items V1 (à ajouter à la phase d'industrialisation — `tier:"advanced"` pour le froid)

```ts
// V1 — industrialisation
{ href: `${base}/elearning/catalog`, label: "Catalogue & vitrine", icon: "🛒", group: "elearning", tier: "advanced" },
{ href: `${base}/elearning/companies`, label: "Entreprises (packs)", icon: "🏢", group: "elearning", tier: "advanced" },
{ href: `${base}/elearning/orders`, label: "Commandes", icon: "🧾", group: "elearning", tier: "advanced" },
{ href: `${base}/elearning/tutor`, label: "Tuteur IA", icon: "🤖", group: "elearning", tier: "advanced" },
{ href: `${base}/elearning/analytics`, label: "Analytics e-learning", icon: "📊", group: "elearning", tier: "advanced" },
```

> `116 + 12 (MVP) + 5 (V1) = 133`.

#### Items V2 (multi-tenant + CPF, derrière flags)

```ts
// V2 — échelle (gated : MULTI_TENANT_ENABLED, EDOF_ENABLED)
{ href: `${base}/elearning/tenants`, label: "Espaces entreprise", icon: "🏬", group: "elearning", tier: "advanced" },
{ href: `${base}/elearning/edof`, label: "CPF / EDOF", icon: "🎟️", group: "elearning", tier: "advanced" },
```

> `133 + 2 = 135` au complet. **Note flags** : ces deux items ne sont **PAS** filtrés par `buildAdminNav()` (la SSOT reste pure et déterministe pour le test de comptage). Si Will veut les masquer tant que le flag est `false`, filtrer **côté `layout.tsx`** après `buildNav()` (comme pourrait l'être tout item gated), pas dans la SSOT — sinon le snapshot count devient non déterministe. **Recommandation MVP/V1** : ne pas livrer ces 2 items tant que la phase V2 n'est pas ouverte.

### 2.5 Champ `tier` — clarification de comportement

Le champ `AdminNavItem.tier` (`"simple" | "advanced"`) est **documenté** comme pilotant un masquage Simple/Avancé, mais ce masquage n'est **implémenté que dans le sous-système content-gen** (qui a son propre layout + toggle). Le **rail principal `AdminSidebarNav` n'applique aucun filtrage par `tier`** : il rend tous les items du groupe. Donc, au MVP, **tous les items e-learning sont visibles** dans le rail (`tier` reste une métadonnée future). Pour limiter la densité, on s'appuie sur :

- l'**ordre** (chaud → froid) ;
- l'usage de `parent` pour exclure les éditeurs profonds ;
- l'accordéon mono-section (le groupe « E-learning » n'est ouvert que quand on y est).

> Si la densité devient un problème (> ~18 items), envisager **un type `ElearningPole` analogue à `ContentGenPole`** + l'extension d'`AdminSidebarNav` pour honorer `subGroup` au-delà de content_gen. **Hors périmètre MVP** — noté comme évolution.

---

## 3. Modifications de `AdminSidebarNav.tsx`

### 3.1 Icône de groupe (`GROUP_ICON_MAP`)

```ts
import { /* … */, MonitorPlay } from "lucide-react"; // ← nouvel import

const GROUP_ICON_MAP: Record<AdminNavGroup, LucideIcon> = {
  // …
  qualiopi: GraduationCap,
  elearning: MonitorPlay,                 // ← distinct de qualiopi (GraduationCap)
  "documents-interventions": FolderOpen,
  // …
};
```

> `MonitorPlay` évoque le player vidéo / cours en ligne et distingue visuellement « E-learning » de « Formation / Qualiopi » (`GraduationCap`) et « Coaching 1-to-1 ». Alternative si l'on veut limiter les imports : réutiliser `GraduationCap` (acceptable mais moins distinct).

### 3.2 Icônes d'items (`ICON_MAP`)

Mapper chaque **libellé** d'item e-learning vers une icône lucide (sinon fallback `FolderOpen`). Imports à ajouter selon disponibilité :

```ts
import {
  // … existants …
  LayoutDashboard, // déjà importé → "Tableau de bord" (collision de label : voir note)
  Boxes, // Cours (paquet de modules)
  Film, // Médiathèque vidéo
  HelpCircle, // déjà importé → Banque de questions
  Users, // déjà importé → Apprenants (ou GraduationCap)
  KeyRound, // déjà importé → Accès & inscriptions
  Upload, // déjà importé → Import en masse (ou FileUp)
  PenLine, // déjà importé → Corrections à faire (ou SquarePen)
  LineChart, // Suivi & progression
  Award, // Certificats (ou ScrollText)
  ShieldCheck, // Preuves FOAD
  Settings, // déjà importé → Réglages
  ShoppingCart, // Catalogue & vitrine (V1)
  Building2, // Entreprises / Espaces entreprise (V1/V2)
  Receipt, // déjà importé → Commandes (V1)
  Bot, // déjà importé → Tuteur IA (V1)
  BarChart3, // déjà importé → Analytics (V1)
  Ticket, // CPF / EDOF (V2)
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  // … existants …
  // ── E-learning ──
  // ⚠️ "Tableau de bord" est DÉJÀ mappé (LayoutDashboard) — partagé, OK.
  Cours: Boxes,
  "Médiathèque vidéo": Film,
  "Banque de questions": HelpCircle,
  Apprenants: Users,
  "Accès & inscriptions": KeyRound,
  "Import en masse (CSV)": Upload,
  "Corrections à faire": PenLine,
  "Suivi & progression": LineChart,
  Certificats: Award,
  "Preuves FOAD": ShieldCheck,
  "Réglages e-learning": Settings,
  "Catalogue & vitrine": ShoppingCart,
  "Entreprises (packs)": Building2,
  Commandes: Receipt,
  "Tuteur IA": Bot,
  "Analytics e-learning": BarChart3,
  "Espaces entreprise": Building2,
  "CPF / EDOF": Ticket,
};
```

> **Collision de label `"Tableau de bord"`.** `ICON_MAP` est indexé par **libellé**, pas par href. Plusieurs groupes ont déjà un item « Tableau de bord » (main, content_gen, coaching, chatbot) → tous prennent `LayoutDashboard`. C'est **sans effet de bord** (l'icône est partagée, le href reste unique). Aucun risque pour l'unicité testée (`has unique hrefs`).

### 3.3 Badge optionnel « Corrections à faire »

`badgeFor(href)` peut afficher un compteur rouge sur l'item dont l'admin doit s'occuper. Pour l'e-learning, le candidat naturel = **tentatives de quiz en attente de correction manuelle** (questions `essai`/`upload`, cf. doc 03). Extension :

```ts
// dans AdminSidebarNav.tsx — badgeFor()
if (pendingGradingCount > 0 && href.includes("/elearning/grading")) {
  return { count: pendingGradingCount, tone: "warn", label: "corrections en attente" };
}
```

- Ajouter la prop `pendingGradingCount?: number` à `AdminSidebarNavProps` (défaut `0`).
- La **calculer dans `layout.tsx`** dans le `Promise.all` existant (bloc `if (showSidebar)`), via une server-side query (ex. `prisma.elearningQuizAttempt.count({ where: { gradingStatus: "pending" } })`, cf. doc 03), avec `.catch(() => 0)` (résilience stub `stub.invalid`).
- Le `groupBadgeTone()` remontera automatiquement une **pastille warn** sur l'onglet « E-learning » fermé.

> MVP : facultatif (peut être livré au lot « moteur de quiz »). Si non livré au lancement, ne rien ajouter — l'item reste sans badge.

---

## 4. Arborescence des pages (`src/app/[locale]/(admin)/[adminPrefix]/elearning/**`)

Légende phase : **[MVP]** · **[V1]** · **[V2]**. Les routes marquées « _hors nav_ » n'ont **pas** d'item dans `buildAdminNav()` (atteintes par lien depuis une liste) ; celles marquées `parent` portent le champ `parent` dans la SSOT pour la résolution breadcrumbs.

```
elearning/
├── layout.tsx                      [MVP] garde RBAC commune + (option) AdminTabs e-learning
├── page.tsx                        [MVP] Tableau de bord e-learning  → /elearning
│
├── courses/                        [MVP] « Cours »
│   ├── page.tsx                    [MVP] liste des cours (statut, version, nb modules/leçons, nb inscrits)
│   ├── new/page.tsx                [MVP] hors nav — création (titre/slug) → redirige vers builder
│   └── [courseId]/
│       ├── page.tsx                [MVP] hors nav (parent=/elearning/courses) — fiche cours (réglages, FOAD, seuil)
│       ├── builder/page.tsx        [MVP] OUTIL AUTEUR (drag&drop modules→leçons) — cf. doc 03 admin
│       ├── modules/[moduleId]/lessons/[lessonId]/page.tsx  [MVP] éditeur de leçon (blocs, vidéo, pdf, quiz)
│       ├── preview/page.tsx        [V1] aperçu « as-student »
│       └── learners/page.tsx       [MVP] hors nav — inscrits + progression de CE cours
│
├── media/                          [MVP] « Médiathèque vidéo »
│   ├── page.tsx                    [MVP] liste des assets (Cloudflare Stream) + statut transcodage
│   └── upload/page.tsx             [MVP] hors nav — upload + suivi d'encodage (signed upload R2 / Stream)
│
├── question-bank/                  [MVP] « Banque de questions »
│   ├── page.tsx                    [MVP] liste questions (type, tags, difficulté, usage)
│   └── [questionId]/page.tsx       [MVP] hors nav (parent) — éditeur de question (12 types, rationale)
│
├── quizzes/                        [MVP] hors nav — gestion des quiz (un quiz = ensemble de questions)
│   └── [quizId]/page.tsx           [MVP] hors nav (parent=/elearning/question-bank) — composition/tirage N/M, seuil
│
├── learners/                       [MVP] « Apprenants »
│   ├── page.tsx                    [MVP] liste apprenants (recherche, entreprise, dernière activité)
│   └── [learnerId]/page.tsx        [MVP] hors nav (parent) — fiche : accès, progression, certificats, preuves
│
├── access/                         [MVP] « Accès & inscriptions »
│   ├── page.tsx                    [MVP] octroi/révocation manuels, statut, expiration
│   └── grant/page.tsx              [MVP] hors nav — octroi guidé (apprenant × cours)
│
├── imports/                        [MVP] « Import en masse (CSV) »
│   ├── page.tsx                    [MVP] uploader CSV, mapping colonnes, historique des lots
│   └── [importId]/page.tsx         [MVP] hors nav (parent) — rapport d'import (succès/erreurs par ligne)
│
├── grading/                        [MVP] « Corrections à faire »
│   ├── page.tsx                    [MVP] file des tentatives à corriger (essai/upload)
│   └── [attemptId]/page.tsx        [MVP] hors nav (parent) — correction manuelle + feedback
│
├── progress/                       [MVP] « Suivi & progression »
│   └── page.tsx                    [MVP] vue agrégée (completion, temps, scores) — filtres cours/entreprise
│
├── certificates/                   [MVP] « Certificats »
│   ├── page.tsx                    [MVP] liste des certificats émis (QR, heures réalisées)
│   └── [certificateId]/page.tsx    [MVP] hors nav (parent) — détail + ré-émission + révocation
│
├── foad-proofs/                    [MVP] « Preuves FOAD »
│   └── page.tsx                    [MVP] export faisceau de preuves (D.6313-3-1 / Ind.11/19) par apprenant×cours
│
├── settings/                       [MVP] « Réglages e-learning »
│   └── page.tsx                    [MVP] seuils par défaut, drip, fournisseur vidéo, e-mails, rétention
│
├── catalog/                        [V1] « Catalogue & vitrine » (publication, JSON-LD Course, SEO)
│   └── page.tsx
├── companies/                      [V1] « Entreprises (packs) » (sièges, suivi par Client)
│   ├── page.tsx
│   └── [clientId]/page.tsx         [V1] hors nav (parent)
├── orders/                         [V1] « Commandes » (Order e-learning ; CB gated STRIPE_ENABLED)
│   ├── page.tsx
│   └── [orderId]/page.tsx          [V1] hors nav (parent)
├── tutor/                          [V1] « Tuteur IA » (config RAG, garde-fous, logs)
│   └── page.tsx
├── analytics/                      [V1] « Analytics e-learning » (engagement, décrochage Ind.12)
│   └── page.tsx
│
├── tenants/                        [V2] « Espaces entreprise » (multi-tenant, gated)
│   └── page.tsx
└── edof/                           [V2] « CPF / EDOF » (gated EDOF_ENABLED)
    └── page.tsx
```

> **Rappel build `stub.invalid`.** Toutes ces pages sont **derrière auth** et font des appels DB → déclarer `export const dynamic = "force-dynamic"` (et/ou `revalidate = 0`). Au build GH Actions, le Proxy Prisma stub renvoie `[]/null/0` sans planter (cf. ADR plateforme 0026). Aucune page e-learning ne doit être SSG.

### 4.1 `elearning/layout.tsx` (garde commune)

```tsx
// src/app/[locale]/(admin)/[adminPrefix]/elearning/layout.tsx
import { requireAdminRead } from "@/server/actions/knowledge/_guards";

export const dynamic = "force-dynamic";

export default async function ElearningAdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminRead(); // lecture min. pour TOUT le pôle
  return <>{children}</>; // le rail est monté par le layout admin parent
}
```

> Optionnel : ajouter un `<AdminTabs>` e-learning (sous-onglets Piloter / Concevoir / Diffuser / Évaluer / Certifier) dans ce layout pour la navigation horizontale interne, à l'image de `content-gen/layout.tsx`. **Recommandé en V1** (densité). Au MVP, l'accordéon du rail suffit.

### 4.2 Squelette type d'une page (pattern canonique)

```tsx
// src/app/[locale]/(admin)/[adminPrefix]/elearning/courses/page.tsx
import { Suspense } from "react";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { requireAdminRead } from "@/server/actions/knowledge/_guards";
import { CoursesTable } from "@/components/admin/elearning/CoursesTable";

export const dynamic = "force-dynamic";

export default async function ElearningCoursesPage() {
  await requireAdminRead();
  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Cours"
        description="Créer, éditer et publier les parcours e-learning."
      />
      <Suspense fallback={null}>
        <CoursesTable />
      </Suspense>
    </AdminPageShell>
  );
}
```

---

## 5. `AdminPageShell` — largeur recommandée par page

| Page                                  | `width`           | Justification                                     |
| ------------------------------------- | ----------------- | ------------------------------------------------- |
| `/elearning` (tableau de bord)        | `full`            | grille de KPIs/cartes                             |
| `/elearning/courses` (liste)          | `wide`            | table dense (statut, version, compteurs, actions) |
| `/elearning/courses/[id]/builder`     | `wide`            | drag&drop 2 colonnes (arbre + éditeur)            |
| `/elearning/courses/[id]` (fiche)     | `narrow`          | formulaire de réglages                            |
| `/elearning/media`                    | `wide`            | grille/table d'assets                             |
| `/elearning/media/upload`             | `narrow`          | formulaire d'upload                               |
| `/elearning/question-bank`            | `wide`            | table filtrable                                   |
| `/elearning/question-bank/[id]`       | `narrow`          | éditeur de question                               |
| `/elearning/learners`                 | `wide`            | table                                             |
| `/elearning/learners/[id]`            | `full`            | fiche multi-sections                              |
| `/elearning/access` + `/access/grant` | `wide` / `narrow` | table / formulaire                                |
| `/elearning/imports`                  | `full`            | uploader + historique                             |
| `/elearning/imports/[id]`             | `wide`            | rapport ligne-à-ligne                             |
| `/elearning/grading`                  | `wide`            | file de correction                                |
| `/elearning/grading/[id]`             | `narrow`          | correction unitaire                               |
| `/elearning/progress`                 | `wide`            | tableaux croisés                                  |
| `/elearning/certificates`             | `wide`            | table                                             |
| `/elearning/foad-proofs`              | `full`            | sélecteur + aperçu export                         |
| `/elearning/settings`                 | `narrow`          | formulaire long                                   |

---

## 6. Server actions, composants & workers par page (cartographie)

> Conventions de cloisonnement (ADR-LMS-0007) :
>
> - **Server actions** : `src/server/elearning/actions/<domaine>.ts` (`"use server"`, RBAC en tête).
> - **Services domaine** (logique pure, réutilisable) : `src/server/elearning/<domaine>/*.ts`.
> - **Composants admin** : `src/components/admin/elearning/*`.
> - **Workers BullMQ** : `src/server/queue/workers/elearning-*-worker.ts`.

| Page / item          | Server actions (`src/server/elearning/actions/…`)                          | Composants (`src/components/admin/elearning/…`)               | Worker / queue                                                                                     |
| -------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Tableau de bord      | `dashboard.getElearningStats`                                              | `ElearningDashboard`, `StatCard` (réutilisé)                  | —                                                                                                  |
| Cours (liste/CRUD)   | `courses.{list,create,update,publish,archive,duplicate}`                   | `CoursesTable`, `CourseStatusBadge`                           | —                                                                                                  |
| Course builder       | `courses.reorderModules`, `lessons.{create,update,reorder,delete}`         | `CourseBuilder`, `ModuleTree`, `LessonEditor`, `BlockPalette` | —                                                                                                  |
| Médiathèque vidéo    | `media.{createUploadUrl,registerAsset,list,delete}`                        | `MediaLibrary`, `VideoUploader`, `EncodingStatus`             | `elearning-video-worker` (poll transcodage Cloudflare Stream → maj `videoAssetId`/`videoDureeSec`) |
| Banque de questions  | `questions.{list,create,update,delete}`, `quizzes.{create,update,compose}` | `QuestionBankTable`, `QuestionEditor`, `QuizComposer`         | —                                                                                                  |
| Apprenants           | `learners.{list,get,update,anonymize}`                                     | `LearnersTable`, `LearnerProfile`                             | —                                                                                                  |
| Accès & inscriptions | `access.{grant,revoke,list,extend}`                                        | `AccessTable`, `GrantAccessForm`                              | `elearning-access-worker` (octroi auto post-session ; e-mails d'invitation)                        |
| Import en masse CSV  | `imports.{upload,validate,run,getReport}`                                  | `CsvImporter`, `ColumnMapper`, `ImportReport`                 | `elearning-import-worker` (parse + création apprenants/accès en masse, idempotent)                 |
| Corrections à faire  | `grading.{listPending,grade}`                                              | `GradingQueue`, `ManualGradeForm`                             | —                                                                                                  |
| Suivi & progression  | `progress.{aggregate,perCourse,perLearner}`                                | `ProgressDashboard`, `CompletionChart`                        | `elearning-progress-worker` (recalc completion/score à partir de `LessonProgress`/`QuizAttempt`)   |
| Certificats          | `certificates.{list,issue,reissue,revoke}`                                 | `CertificatesTable`, `CertificateDetail`                      | `elearning-certificate-worker` (génère PDF + QR via `DocumentGenere` réutilisé)                    |
| Preuves FOAD         | `foad.{buildProofBundle,export}`                                           | `FoadProofExporter`                                           | `elearning-foad-export-worker` (assemble ZIP : logs, évaluations, traces tutorat)                  |
| Réglages             | `settings.{get,update}`                                                    | `ElearningSettingsForm`                                       | —                                                                                                  |
| Catalogue (V1)       | `catalog.{publish,unpublish,reorder}`                                      | `CatalogManager`                                              | —                                                                                                  |
| Entreprises (V1)     | `companies.{list,get,allocateSeats}`                                       | `CompaniesTable`, `SeatAllocator`                             | —                                                                                                  |
| Commandes (V1)       | `orders.{list,get,fulfill}`                                                | `OrdersTable`                                                 | réutilise infra Stripe (`Invoice/Payment`, flag `STRIPE_ENABLED`)                                  |
| Tuteur IA (V1)       | `tutor.{getConfig,updateConfig,listLogs}`                                  | `TutorConfigForm`, `TutorLogs`                                | `elearning-tutor-worker` (RAG ancré, réutilise knowledge/RAG existant)                             |
| Analytics (V1)       | `analytics.{engagement,dropoff}`                                           | `ElearningAnalytics`                                          | `elearning-analytics-worker` (agrégats, détection décrochage Ind.12)                               |

> **Réutilisations explicites (anti-duplication) :** `StatCard`/`AdminTable`/`AdminBadge` (`src/components/admin/ui`), `getSignedUploadUrlR2`/`getSignedUrlR2` (`src/lib/r2-storage.ts`) pour PDF/ressources, `DocumentGenere`+`qrToken` pour les certificats, Nodemailer + email-worker pour invitations/relances, `Trainee`/`Enrollment`/`Client`/`PortailAcces` pour l'identité apprenant (cf. doc data-model 02/04).

---

## 7. RBAC par page (mapping `requireAdmin*`)

Rôles existants : `super_admin` > `admin` > `editor` > `reader`. Mapping :

| Action                                                         | Guard                 | Rôles autorisés  | Pages concernées                                          |
| -------------------------------------------------------------- | --------------------- | ---------------- | --------------------------------------------------------- |
| Lire (toutes les pages)                                        | `requireAdminRead`    | tous (`reader`+) | layout + tous les `page.tsx` (lecture)                    |
| Créer / éditer contenu                                         | `requireAdminWrite`   | `editor`+        | cours, modules, leçons, questions, quiz, médias, réglages |
| Octroyer/révoquer accès, importer CSV                          | `requireAdminWrite`   | `editor`+        | access, imports, grant                                    |
| Corriger une tentative                                         | `requireAdminWrite`   | `editor`+        | grading                                                   |
| **Publier** un cours / catalogue                               | `requireAdminPublish` | `admin`+         | `courses.publish`, `catalog.publish`                      |
| **Émettre/révoquer** un certificat                             | `requireAdminPublish` | `admin`+         | certificates (acte à valeur probante)                     |
| **Supprimer** (cours, question, apprenant, anonymisation RGPD) | `requireAdminDelete`  | `super_admin`    | suppressions définitives, `learners.anonymize`            |
| Activer flags V2 (tenants/EDOF)                                | `requireAdminDelete`  | `super_admin`    | tenants, edof                                             |

> **Règle.** La garde de **lecture** est posée dans `elearning/layout.tsx` (couvre tout le pôle) ; chaque **server action mutative** repose sa propre garde (`requireAdminWrite/Publish/Delete`) — ne jamais se fier au seul layout pour les écritures.

---

## 8. `findActiveNavHref` — comportement attendu (anti-rebascule)

`findActiveNavHref()` résout l'item actif par **matching de préfixe le plus long**. Conséquences à vérifier (à ajouter aux tests, cf. §9) :

- `/elearning` → item « Tableau de bord » (groupe `elearning`), **jamais** la racine admin.
- `/elearning/courses/<id>/builder` → item « Cours » (`/elearning/courses`) reste actif, groupe `elearning` ouvert (l'éditeur n'a pas d'item propre).
- `/elearning/question-bank/<id>` → item « Banque de questions » actif.
- `/elearning/quizzes/<id>` → résout l'item parent déclaré (`parent: /elearning/question-bank`) → « Banque de questions » actif, **pas** le tableau de bord.
- `/elearning/learners/<id>` → « Apprenants » actif.

> Comme `/elearning` est préfixe de toutes les sous-routes mais que « le plus long gagne », l'item « Tableau de bord » e-learning n'est sélectionné que sur la racine exacte du pôle — exactement comme le « Tableau de bord » admin racine vis-à-vis des sous-pages.

---

## 9. Tests à mettre à jour / ajouter (`src/lib/admin-nav.test.ts`)

1. **Comptage** : `expect(items.length).toBe(128)` au MVP (`116 + 12`). Mettre à jour le commentaire de réconciliation du snapshot (mentionner « +12 E-learning MVP »). Réincrémenter à `+5` (V1) et `+2` (V2) au fil des phases.
2. **Couverture groupes** : `ADMIN_NAV_GROUP_ORDER` passe de 12 à **13** groupes → le test « covers all groups » couvre `elearning` automatiquement (boucle sur l'ordre). Vérifier aussi `ADMIN_NAV_GROUP_LABELS["elearning"]` défini.
3. **Unicité des hrefs** : inchangé (déjà vérifié) — s'assurer qu'aucun href e-learning ne collisionne.
4. **`findActiveNavHref` e-learning** : ajouter un `describe` analogue au bloc presse :
   - liste → item exact + groupe `elearning` ;
   - éditeurs profonds (`courses/[id]/builder`, `quizzes/[id]`, `learners/[id]`) → rattachés au parent attendu, **jamais** la racine `base`, **jamais** le groupe `main`.

---

## 10. Checklist d'implémentation (ordre conseillé)

1. [ ] `admin-nav.ts` : union `+ "elearning"`, label, ordre, **12 items MVP**.
2. [ ] `admin-nav.test.ts` : count `116 → 128`, commentaire, nouveau `describe` `findActiveNavHref`.
3. [ ] `AdminSidebarNav.tsx` : import `MonitorPlay`, `GROUP_ICON_MAP.elearning`, entrées `ICON_MAP` (11 libellés MVP).
4. [ ] (Option) `AdminSidebarNav.tsx` + `layout.tsx` : prop/compteur `pendingGradingCount` (badge « Corrections à faire »).
5. [ ] Créer `elearning/layout.tsx` (garde `requireAdminRead`, `force-dynamic`).
6. [ ] Scaffolder les 12 `page.tsx` MVP avec `AdminPageShell` + `AdminPageHeader` + guard.
7. [ ] Créer les dossiers de code cloisonnés (`src/server/elearning/**`, `src/components/admin/elearning/**`).
8. [ ] Câbler server actions + workers au fil des lots MVP (cf. roadmap §MVP).
9. [ ] Vérifier build stub (`force-dynamic` partout), `pnpm typecheck`, `pnpm lint`, suite Vitest.

---

## 11. Points de vigilance (résumé)

- **Composant monté** = `AdminSidebarNav.tsx` (PAS `AdminSidebar.tsx`, obsolète). Toute icône/badge passe par lui.
- **`subGroup` non honoré hors content_gen** → ne pas compter dessus pour la hiérarchie ; utiliser l'imbrication d'URL + `parent`.
- **`tier` non filtré par le rail principal** → tous les items e-learning sont visibles ; garder le set lean.
- **Snapshot count** : tout ajout/retrait d'item casse `admin-nav.test.ts` → mettre à jour **dans le même commit**.
- **`force-dynamic`** sur toutes les pages (contrat build `stub.invalid`).
- **Migrations additives** (ADR-LMS-0008) ; aucun item de nav ne dépend d'une migration destructive.
- **Flags V2** (tenants/EDOF) : ne pas les injecter conditionnellement dans la SSOT (déterminisme du test) — filtrer côté layout si masquage requis.

---

## Liens

- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-LMS-0007 (cloisonnement), 0001 (auth), 0002 (multi-tenant V2), 0004 (Stripe gated), 0005 (vidéo), 0008 (migrations additives).
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — modèles `ElearningCourse/Module/Lesson/Resource`, enums.
- `03-DATA-MODEL/02-schema-progression-tracking.md` — `ElearningEnrollment`, `LessonProgress` (badge progression, page « Suivi »).
- `03-DATA-MODEL/03-schema-quiz-evaluations.md` — `Quiz/Question/QuizAttempt` (banque de questions, grading, badge corrections).
- `03-DATA-MODEL/04-schema-comptes-acces-auth.md` — accès apprenant (pages access/imports/learners).
- `06-CONSOLE-ADMIN/02-pilotage-dashboard.md` — détail du tableau de bord e-learning.
- `06-CONSOLE-ADMIN/03-outil-auteur-course-builder.md` — détail du course builder (route `courses/[id]/builder`).
- `06-CONSOLE-ADMIN/04-gestion-apprenants.md`, `05-gestion-acces-entreprises.md`, `06-gestion-banque-quiz.md`, `07-gestion-certificats.md`, `08-reporting-analytics.md`.
- `07-ROUTES/cartographie-routes-complete.md` — table exhaustive des routes (publiques + admin).
- `08-CONFORMITE/01-foad-d6313-3-1.md`, `06-tracabilite-preuves-realisation.md` — page « Preuves FOAD ».
- `11-ROADMAP/01-phasage-mvp-v1-v2.md` — phasage des items (MVP/V1/V2).
