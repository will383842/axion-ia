# Système de design de la console d'administration

> Mesuré le **2026-09-06** sur `main`. Les chiffres de ce document sont vérifiables
> par les commandes données en annexe — s'ils ne tombent plus juste, c'est le
> document qu'il faut corriger, pas la commande.
>
> ADR : [`docs/adr/0028-admin-design-system-v1.md`](./adr/0028-admin-design-system-v1.md).
> Audits / décisions : [`_AUDIT/ADMIN-REFONTE-2026-05-17/`](../_AUDIT/ADMIN-REFONTE-2026-05-17/).

## ⚠️ Ce que la version précédente de ce document disait de faux

Jusqu'au 2026-09-06, cette page annonçait **116 routes admin**, **28 primitives**
et un feature flag `ADMIN_V2_ENABLED` permettant de basculer entre V1 et V2.

Les trois étaient faux :

- la console porte **311 fichiers `page.tsx`**, pas 116 — un facteur 2,7 ;
- `src/components/admin/ui/` contient **42 fichiers de composant** ;
- `isAdminV2Enabled()` a été **supprimé le 2026-05-20** (`src/lib/feature-flags.ts:1`).
  V2 est le seul chemin, il n'y a plus rien à basculer.

C'est le genre d'écart qui coûte cher sans jamais rien casser : quelqu'un
dimensionne un lot sur « 116 pages » et découvre le reste en cours de route.

---

## 1. Il y a UN système, avec DEUX écritures

C'est le point que ce document n'expliquait pas, et l'incompréhension la plus
fréquente en revue.

La console se style à **deux niveaux qui ne se concurrencent pas** :

| Écriture            | Où                         | Exemple                             |
| ------------------- | -------------------------- | ----------------------------------- |
| **Classe CSS**      | `src/app/admin.css`        | `<button className="admin-button">` |
| **Primitive React** | `src/components/admin/ui/` | `<AdminButton>`                     |

**La primitive compose la classe.** `AdminButton` mappe ses variantes sur
`.admin-button`, `.admin-button-secondary`, `.admin-button-ghost`… ; il n'invente
aucun style. Les deux écritures rendent donc **exactement pareil à l'écran**, et
une page peut migrer progressivement sans rupture visuelle.

Ce que la primitive apporte en plus : le typage des variantes, l'état
« en cours » (`loading`), les attributs ARIA, et l'impossibilité de poser un
utilitaire Tailwind inerte (cf. §3).

👉 **Préférer la primitive dans le code neuf.** Ne pas migrer en masse du code
qui marche : le gain est ergonomique, pas visuel.

## 2. La troisième couche, invisible : `@layer base`

`admin.css` normalise **les éléments HTML eux-mêmes** à l'intérieur des shells
`.admin-layout-v2` / `.admin-layout` (`admin.css` §`@layer base`) :

```
select · textarea · input[type=text|email|url|tel|number|password|search|date|…]
button (sauf .admin-button*, .bg-*, .absolute, .fixed, .unstyled)
input[type=checkbox] · input[type=radio]
```

Conséquence pratique, souvent ignorée : **un `<select>` nu, sans aucune classe,
est déjà au gabarit de la console** — même hauteur, même bordure, même anneau de
focus. Il n'y a rien à ajouter, et compter ces éléments comme « non stylés » est
une erreur de lecture du système.

Pourquoi `@layer base` et pas une couche maison : une couche déclarée après
`utilities` écraserait les classes Tailwind posées par les pages. En réinjectant
dans la couche `base` existante, ces règles fournissent un défaut soigné que
n'importe quelle page peut encore surcharger.

**`table` n'est PAS normalisé — et c'est le seul trou du système.** Un `<table>`
nu tombe sur le rendu navigateur. Pire : les trois écritures ne s'accordent pas.
Mesuré en production le 2026-09-06 sur deux écrans de liste voisins :

|                 | `<AdminTable>` (51 fichiers) | `.admin-table` (32 fichiers) | à la main (51 fichiers) |
| --------------- | ---------------------------- | ---------------------------- | ----------------------- |
| police du corps | 13 px _(était 16 px)_        | 13 px                        | 13 px mesuré            |
| chiffres        | `tabular-nums` _(ajouté)_    | `tabular-nums`               | `normal`                |
| fond d'en-tête  | `surface-sunken`             | `surface-sunken`             | transparent             |
| padding cellule | 12 px                        | 12/16 px                     | 6/8 px mesuré           |

⚠️ **`AdminTable` ne compose PAS `.admin-table`.** Contrairement à `AdminButton`
qui compose `.admin-button`, il réimplémente son rendu avec des utilitaires. Il
portait même le commentaire « Aligné sur `.admin-table` » sur UNE propriété
recopiée à la main, les autres oubliées. Conséquence mesurée : 23 % d'écart de
taille de texte entre deux listes de la même console, et aucune des deux
n'alignait ses colonnes de nombres.

Les deux propriétés qui divergeaient sont alignées depuis le 2026-09-06, et
`admin-table-ne-diverge-pas-de-sa-classe.spec.ts` les **dérive d'`admin.css`**
au lieu de les recopier. **La fusion complète reste à faire** : poser
`class="admin-table"` sur le composant et retirer ses utilitaires écraserait
d'un coup les paddings des 51 écrans concernés, en laissant des utilitaires
morts que la garde des jetons ne voit pas — elle compare classe et utilitaire
sur le MÊME élément, or la classe serait sur `<table>` et les utilitaires sur
`<th>`/`<td>`. Cette bascule se fait en la regardant à l'écran.

## 3. Le piège de cascade — à lire avant de poser une classe

Les classes `.admin-*` sont **hors couche CSS**. En cascade, une règle hors
couche l'emporte sur _toutes_ les couches, `utilities` comprise.

```tsx
// ❌ le `font-mono` ne fait RIEN : `.admin-input` fixe déjà font-family
<input className="admin-input font-mono" />

// ✅ modificateur déclaré au même niveau de cascade
<input className="admin-input admin-input-mono" />
```

Ce piège a produit des défauts réels et silencieux : des éditeurs de JSON qui
n'étaient pas en chasse fixe, des boutons de suppression rendus en noir au lieu
de rouge, un kill-switch indiscernable d'une action banale.

`admin-design-tokens.test.ts` **fait échouer la suite** si le motif réapparaît.
Le remède est toujours un modificateur dans `admin.css`, jamais une entrée
d'exception.

Modificateurs disponibles : `.admin-button-sm`, `.admin-button-xs`,
`.admin-button-block`, `.admin-button-ghost-danger`, `.admin-input-sm`,
`.admin-input-mono`, `.admin-input-right`, `.admin-input-w-sm`,
`.admin-input-w-md`.

## 4. Jetons

**138 jetons** déclarés dans `@layer admin-tokens` (`src/app/admin.css`), tous
préfixés `--*-admin-*`, et **219 classes** `.admin-*`.

| Catégorie           | Préfixe                                            | Étendue                                                                                  |
| ------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Surfaces / bordures | `--color-admin-*`                                  | `bg`, `paper`, `paper-alt`, `surface-hover`, `surface-sunken`, `border`, `border-strong` |
| Texte               | `--color-admin-fg*`                                | `fg`, `fg-soft`, `fg-muted`, `fg-disabled`                                               |
| États               | `--color-admin-*`                                  | `success` / `warning` / `destructive` / `info` / `neutral` (+ `-soft` / `-fg`)           |
| Marque              | `--color-admin-terracotta`, `--color-admin-accent` | une seule couleur d'action : terracotta                                                  |
| Rail                | `--color-admin-rail-*`                             | fond mocha, encres ivoire, badges                                                        |
| Espacement          | `--space-admin-1..9`                               | 2 px → 48 px                                                                             |
| Typo                | `--text-admin-xs..2xl` + `--lh-admin-*`            | 12 px → 26 px                                                                            |
| Polices             | `--font-admin`, `--font-admin-mono`                | Inter, Inconsolata                                                                       |
| Contrôles           | `--control-admin-h-sm/md/lg`, `--control-admin-px` | grille de hauteurs unique                                                                |
| Rayons / ombres     | `--radius-admin-*`, `--shadow-admin-*`             |                                                                                          |

**Étendre :** ajouter dans `@layer admin-tokens`. **Ne jamais modifier** un jeton
existant (compatibilité ascendante).

### Cloisonnement — vérifié, et gardé

- aucun import de `@/components/ui` (design system public) dans la console ;
- aucun import de `@/components/admin` hors de la console ;
- le layout admin n'importe que `admin.css` et `print.css`.

⚠️ **Dette connue : 38 règles se stylent encore avec la palette PUBLIQUE**
(`--color-bg`, `--color-terracotta`, `--color-sage`, `--color-error`…). Le
2026-09-06, les 81 références dont la valeur était identique octet pour octet
ont été migrées ; les 38 restantes portent des jetons dont la valeur _diffère_ —
les basculer change le rendu, ça se décide en le regardant.

`la-console-ne-porte-pas-la-palette-publique.spec.ts` gèle cette liste : elle ne
peut que diminuer, et **aucune règle nouvelle** ne peut s'y ajouter. Les polices,
elles, sont à tolérance zéro depuis que Manrope — la police du site public —
a été retirée de `.admin-textarea`, `.admin-tab` et de la barre de l'éditeur riche.

C'est le prérequis d'un futur mode sombre : une règle sur la palette publique
n'est pas atteignable depuis un bloc sombre de la console.

## 5. Primitives

`import { … } from "@/components/admin/ui"` — **42 fichiers**.

### Structure de page

`AdminPageShell` (largeur `full` 1440 / `narrow` 720 / `wide`) ·
`AdminPageHeader` · `AdminTopbar` · `AdminSidebarNav` · `AdminBreadcrumbs` ·
`AdminToolbar` · `AdminCard`

### Données

`AdminTable<T>` (générique, triable, `aria-sort`) · `AdminPagination` ·
`AdminBulkActions` · `AdminFilterTabs` · `AdminFilterChip` · `AdminStatCard`

### Formulaires

`AdminFormField` · `AdminFormSection` · `AdminSubmitButton` · `AdminFormError` ·
`AdminFormDirtyGuard` · `AdminInlineEdit` · `AdminAutosaveIndicator`

### Présentation et états

`AdminBadge` · `AdminStatusBadge` · `AdminEtatBooleen` · `AdminEmptyState` ·
`AdminLoadingState` · `AdminErrorState` · `AdminKeyboardHint`

### Interaction

`AdminConfirmDialog` · `useConfirmation` · `AdminUndoToast` ·
`AdminConflictDialog` · `AdminSessionExpiryWarning` · `AdminShortcutListener` ·
`AdminNotificationsDropdown` · `AdminUserMenu`

### ⚠️ Primitives écrites mais jamais branchées

Sept primitives ont **zéro appelant** dans la console :

```
AdminAutosaveIndicator   AdminConflictDialog   AdminFilterChip   AdminInlineEdit
AdminKeyboardHint        AdminShortcutListener AdminUndoToast
```

Elles viennent des PR 4 et 12 de l'ADR 0028 (« polish UX »), livrées d'avance et
jamais câblées. `AdminConflictDialog` en particulier est la mitigation §3.7 du
master prompt — le scénario « Will ouvre la même fiche dans deux onglets et
édite dans les deux » n'est donc **pas** couvert en pratique.

Ne pas les compter comme des capacités disponibles. Les brancher ou les
supprimer est un arbitrage ouvert.

## 6. Le rapport de masse

```
primitives partagées (components/admin/ui)        5 511 lignes
UI de fonctionnalité (routes _v2 + components)   74 002 lignes
```

**7 %.** Le kit est mince par rapport à la surface qu'il couvre — c'est pourquoi
chaque écran dense finit par écrire sa propre barre de filtres et son propre
tableau. Étendre le kit vaut mieux que discipliner 106 dossiers `_v2`.

## 7. Conventions de route

- `page.tsx` = authentification + récupération des données, puis délégation.
- `_v2/<Écran>V2.tsx` = tout le rendu (**106 dossiers** `_v2` / `_v3`).
- Trio `error.tsx` / `loading.tsx` / `not-found.tsx` hérité depuis
  `[locale]/(admin)/[adminPrefix]/` ; surcharger par section dense si besoin.
- Une section peut poser son `AdminPageShell` dans son `layout.tsx` plutôt que
  dans chaque page (`contacts`, `societe`, `tunnels`, `documents-interventions`).

## 8. Ce que la console n'a pas

À dire explicitement, pour que personne ne le cherche :

- **pas de mode sombre** (aucun `prefers-color-scheme` dans `admin.css`) ;
- **quasi pas de responsive** — la console est un outil de bureau assumé ;
- **pas de bibliothèque de graphiques** ;
- **pas de Storybook ni de test visuel** ;
- **couverture a11y automatisée : 18 écrans** (`tests/e2e/a11y-admin.spec.ts`),
  et la suite se **saute** en CI faute d'identifiants de seed.

## Annexe — vérifier les chiffres

```bash
find "src/app/[locale]/(admin)" -name page.tsx | wc -l          # 311
ls src/components/admin/ui/*.tsx | grep -v '\.test\.' | wc -l   # 42
grep -cE '^\s*--[a-z0-9-]+\s*:' src/app/admin.css               # 138
grep -oE '\.admin-[a-z0-9-]+' src/app/admin.css | sort -u | wc -l  # 219
find "src/app/[locale]/(admin)" -type d \( -name _v2 -o -name _v3 \) | wc -l  # 106
```
