# A5-08 — UX Simplicité — Score 68/140

## Fichiers inspectés

- `src/lib/admin-nav.ts` — SSOT navigation admin (36 items, 6 groupes)
- `src/components/admin/AdminSidebar.tsx` — sidebar V1
- `src/components/admin/ui/AdminSidebarNav.tsx` — sidebar V2 (active, lucide-react, collapse Cmd+B)
- `src/app/[locale]/(admin)/[adminPrefix]/layout.tsx` — shell admin V2 permanent
- `src/app/[locale]/(admin)/[adminPrefix]/AdminCommandPalette.tsx` — palette Cmd+K (cmdk)
- `src/app/[locale]/(admin)/[adminPrefix]/content-gen/_v2/ContentGenDashboardV2.tsx` — dashboard
- `src/app/[locale]/(admin)/[adminPrefix]/content-gen/coverage/_v2/CoverageListV2.tsx` — liste campagnes
- `src/app/[locale]/(admin)/[adminPrefix]/content-gen/jobs/_v2/JobsListV2.tsx` — liste jobs
- `src/app/[locale]/(admin)/[adminPrefix]/content-gen/publications-status/_v2/PublicationsStatusV2.tsx` — kanban
- `src/app/[locale]/(admin)/[adminPrefix]/content-gen/settings/_v2/SettingsIndexV2.tsx` — settings (11 items)
- `src/app/[locale]/(admin)/[adminPrefix]/content-gen/onboarding/_v2/OnboardingV2.tsx` — onboarding 5 étapes
- `src/components/admin/ui/AdminBulkActions.tsx` — composant bulk actions générique
- `src/components/admin/ui/AdminTopbar.tsx` — topbar sticky
- `src/app/admin.css` + `src/app/globals.css` — design system tokens + utilitaires

---

## État actuel

### Navigation admin content-gen (sidebar)

La SSOT `admin-nav.ts` définit 36 items totaux en 6 groupes :
- **main** : 9 items (Tableau de bord, Calendrier, Réservations, Devis, Factures, Paiements, Échéanciers, Options 48h, Soumissions)
- **content** : 9 items dont 2 dédiés content-gen en sidebar (Générateur contenus + Couverture villes)
- **image-bank** : 10 items
- **engagement** : 1 item
- **ops** : 4 items
- **system** : 4 items

Items visibles dans la sidebar pour le groupe "content" lié à content-gen : **2 items seulement** (Générateur contenus + Couverture villes). Toutes les sous-pages (jobs, review-queue, rss, orchestrator, settings, etc.) ne sont accessibles que via le dashboard interne ou la command palette Cmd+K — elles n'apparaissent pas dans la sidebar.

### CTA "Nouvelle campagne"

Présent sur 2 pages :
1. `ContentGenDashboardV2` — AdminPageHeader.actions : `+ Nouvelle campagne` (link `admin-button`)
2. `CoverageListV2` — AdminPageHeader.actions : `+ Nouvelle campagne` (link `admin-button`)

Absent sur toutes les autres sous-pages (jobs, review-queue, publications-status, orchestrator, rss, templates, etc.).

Couleur du `admin-button` : `background-color: var(--color-primary)` = **#1a4dd9** (bleu). La terracotta `#c24a1b` n'est pas utilisée dans ce bouton — c'est la couleur éditoriale publique, pas la couleur primaire admin (qui est le bleu `--color-admin-info: #1a4dd9` volontairement).

### Actions bulk

- `AdminBulkActions` est un composant générique disponible (sticky bottom bar, selectedCount, onClear, actions slot).
- `PublicationsStatusV2` implémente des bulk actions serveur : `bulkApproveReviews` (score min) + `bulkRejectReviews` (score max) + `retryAllFailed` — mais ce sont des actions globales par seuil, **pas de checkbox multi-sélection par ligne**.
- `JobsListV2` et `CoverageListV2` : aucune checkbox, aucun bulk select. `retryAllFailed` sur jobs via form server action globale (pas de sélection individuelle).
- `AdminBulkActions` est importé dans d'autres parties de l'admin (non content-gen) mais **aucun composant content-gen ne l'importe**.

### Raccourcis clavier

- **Cmd+K / Ctrl+K** : palette de commandes globale (AdminCommandPalette, cmdk library) — inclut 14 items "Content Gen" permettant la navigation rapide vers toutes les sous-pages content-gen.
- **Cmd+B / Ctrl+B** : collapse/expand sidebar (AdminSidebarNav) — mémorisé localStorage.
- **Escape** : fermer la palette.
- Aucun raccourci spécifique content-gen : pas de N (Nouvelle campagne), P (Pause), F (Filtrer), E (Exporter).

### Responsive / mobile

- La sidebar V2 a une largeur fixe 64px (collapsed) ou 240px (expanded), sans breakpoint mobile adaptatif (pas de `sm:hidden`, pas de hamburger mobile, pas de drawer).
- Les tableaux ont `admin-table-wrapper { overflow-x: auto }` dans globals.css — scroll horizontal disponible.
- Le dashboard utilise `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5` — grilles responsives.
- PublicationsStatusV2 kanban : `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5` — responsive.
- OrchestratorV2 stats : `grid-cols-1 sm:grid-cols-2 lg:grid-cols-5` — responsive.
- **Aucun menu hamburger** ni drawer pour masquer la sidebar sur mobile (< 768px). La sidebar fixe 240px mange la majorité de la largeur d'écran mobile.

### Onboarding 0-to-first-campaign

`OnboardingV2` implémente un parcours linéaire 5 étapes :
1. Configurer 4 providers IA minimum (lien direct vers `/settings/providers`)
2. Seed profil auteur Manon (commande CLI indiquée, pas de wizard)
3. Créer profil distribution par défaut (lien direct)
4. Lancer première campagne test (lien direct `/coverage/new`)
5. Vérifier le kill switch (lien direct)

Statut visuel checkmarks ✅/⏳ en temps réel via Prisma. Accessible via Cmd+K "Content Gen — Onboarding 5 étapes". Pas de tour guidé interactif (type Shepherd.js/Intro.js), pas de presets en avant-plan. Pas de détection automatique "0 campagnes → afficher onboarding". L'utilisateur doit naviguer manuellement vers `/onboarding`.

---

## Gaps identifiés

### P0 (bloquant)

**P0-1 : Sidebar mobile non responsive (pas de hamburger/drawer)**
La `AdminSidebarNav` a largeur fixe 240px ou 64px sans aucune adaptation mobile. Sur un écran 375-767px, la sidebar consomme 64-240px et le contenu est illisible. Aucun `sm:hidden` ni composant drawer mobile n'existe. L'admin est de fait inutilisable sur mobile (tablette incluse jusqu'à ~900px selon le contenu des tableaux).

**P0-2 : CTA "Nouvelle campagne" absent sur 90 % des sous-pages**
L'action primaire disparaît dès qu'on quitte le dashboard ou la liste campagnes. Sur jobs, review-queue, orchestrator, publications-status, rss, templates, et toutes les sous-pages settings — aucun CTA permettant de créer une campagne.

### P1 (important)

**P1-1 : Pas de navigation content-gen dédiée dans la sidebar**
Seuls 2 items content-gen apparaissent dans la sidebar (groupe "content"). Les 20+ sous-pages sont accessibles uniquement via le dashboard ou Cmd+K. L'utilisateur ne peut pas naviguer directement entre review-queue, jobs, orchestrator sans revenir au dashboard ou utiliser la palette.

**P1-2 : Onboarding non déclenché automatiquement pour un utilisateur 0-campagne**
L'onboarding est une page navigable manuellement, pas un wizard contextuel. Si 0 campagnes existent, le dashboard n'affiche pas de prompt "Démarrer ici". Temps découverte estimé > 10 min pour un nouvel utilisateur.

**P1-3 : Pas de presets campagne sur page d'onboarding**
L'étape 4 renvoie vers `/coverage/new` sans aucun preset. Un nouvel utilisateur doit deviner tous les paramètres (scope, secteur, cible, distribution). Le wizard CoverageNewV2 est complet mais sans mode guidé simplifié.

**P1-4 : AdminBulkActions non intégré dans les pages content-gen**
Le composant existe et est bien conçu (sticky bar, compteur, slot actions) mais aucune page content-gen (CoverageListV2, JobsListV2, ReviewQueueListV2) ne l'utilise. Le bulk sur publications-status est limité aux actions globales par seuil, sans sélection ligne par ligne.

**P1-5 : Couleur CTA non conforme charte couleurs projet**
Le bouton `admin-button` utilise `#1a4dd9` (bleu primaire admin) — cohérent avec le design system admin. Cependant, la charte projet stipule que la terracotta `#c24a1b` est la couleur principale d'action (MEMORY.md : "terracotta #c24a1b principale"). Le bleu admin est réservé aux "pointes seulement". L'inversion de hiérarchie couleur dans l'admin peut créer une dissonance avec la charte globale.

### P2 (nice-to-have)

**P2-1 : Raccourcis clavier spécifiques content-gen absents**
Seuls Cmd+K et Cmd+B sont documentés. Pas de raccourcis N (Nouvelle campagne), P (Pause/Resume campagne active), E (Export), F (Focus filtre), ? (Aide raccourcis). L'AdminCommandPalette compense partiellement mais n'est pas documenté dans l'UI elle-même.

**P2-2 : Page onboarding non liée depuis le dashboard si non complété**
Si `onboarded === false`, le dashboard ne signale pas l'état d'onboarding incomplet. Une bannière contextuelle ou badge sur l'entrée "Onboarding" dans le CommandPalette serait utile.

**P2-3 : Groupes "Content Gen" non collapsibles dans la sidebar**
La sidebar V2 supporte les groupes collapsibles (toggleGroup) mais le groupe "content" mélange content-gen et les autres modules (Blog, FAQ, etc.). Un sous-groupe dédié content-gen aiderait.

**P2-4 : Export CSV limité à publications-status**
L'export CSV jobs est présent sur publications-status via `/api/content-gen/export?type=jobs`. Pas d'export depuis la liste campagnes (CoverageListV2) ni depuis JobsListV2 directement.

---

## Scoring détaillé

| Critère | Max | Score | Justification |
|---|---|---|---|
| C1 Loi de Hick (max 7 items) | 30 | 20 | La sidebar affiche 2 items content-gen dans le groupe "content" — conforme Loi de Hick. Mais le dashboard interne liste 22 liens flat dans 2 sections (12 "Pilotage rapide" + 10 "Réglages") sans groupement hiérarchique interactif, dépassant 15 items. Score 20 : architecture 2 niveaux avec sidebar + dashboard, labels clairs, mais overload cognitif sur le dashboard. |
| C2 CTA Nouvelle campagne persistant | 25 | 10 | Présent sur 2 pages (dashboard + liste campagnes). Absent sur 90 % des sous-pages. Couleur bleu #1a4dd9 (pas terracotta #c24a1b) — non conforme charte couleur principale. Score 10 : CTA présent mais disparaît dans la majorité des contextes de travail. |
| C3 Actions bulk | 20 | 8 | `AdminBulkActions` composant bien conçu existe mais non utilisé dans content-gen. `PublicationsStatusV2` a des bulk approve/reject par seuil de score (pas de checkbox ligne). JobsListV2 a `retryAllFailed` global. Aucun multi-select checkbox. Score 8 : présence partielle sans checkbox individuel. |
| C4 Raccourcis clavier | 15 | 8 | `Cmd+K` palette complète (14 items content-gen navigables), `Cmd+B` sidebar collapse, `Esc` fermeture palette. Soit 3 raccourcis documentés/actifs. Pas de raccourcis N/P/F/E/? spécifiques content-gen. Score 8 : 1-4 raccourcis actifs. |
| C5 Mobile responsive | 20 | 8 | Tables avec `overflow-x: auto` (scroll horizontal). Grilles responsives sur dashboard/kanban (sm:/lg:/xl: breakpoints). Mais sidebar fixe sans hamburger/drawer mobile — inutilisable sur < 768px. Score 8 : tentative responsive sur contenu mais sidebar cassée mobile. |
| C6 Onboarding 0-to-first-campaign | 30 | 14 | Page onboarding V2 existe avec 5 étapes, statuts visuels temps réel, liens directs. Mais : non déclenchée automatiquement si 0 campagnes, pas de presets, pas de tour guidé interactif, étape 2 nécessite une commande CLI. Découverte en < 10 min possible si l'utilisateur trouve la page. Score 14 : page vide avec CTA clair + wizard basique, mais intuitable > 10 min, Cmd+K facilite l'accès. |
| **TOTAL** | **140** | **68** | |

---

## Recommandations P0 urgentes

### P0-1 : Ajouter un drawer mobile pour la sidebar (effort ~4h)

Dans `AdminSidebarNav.tsx`, ajouter un breakpoint `lg:block hidden` sur la sidebar en layout permanent et un hamburger button dans `AdminTopbar.tsx` qui ouvre un drawer `<dialog>` ou state `useState(mobileOpen)`. CSS : `@media (max-width: 1023px) { .admin-sidebar-v2 { position: fixed; transform: translateX(-100%) } .admin-sidebar-v2.open { transform: translateX(0) } }`. Cela débloque l'usage tablette (~768-1023px) qui représente potentiellement 20-30 % des sessions admin.

### P0-2 : Rendre le CTA "Nouvelle campagne" persistant (effort ~2h)

Ajouter un bouton "+ Nouvelle campagne" dans AdminTopbar (zone `commandPalette`) **uniquement sur les routes `/content-gen/*`** via détection `pathname.includes('/content-gen')` dans un wrapper client. Alternative : l'injecter dans le layout content-gen dédié si un tel layout existe, ou via un composant `ContentGenFloatingCTA` positionné fixed bottom-right (FAB pattern) qui persiste sur toutes les sous-pages.

---

*Audit AUDIT-ONLY — zéro commit, zéro modification fichier source. Agent A5-08, 2026-05-21.*
