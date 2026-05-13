# 12 — A11Y WCAG 2.2 AA + E-E-A-T — Knowledge Base 2026 — Phase A

> Prompt : `_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md` (§ Agent 12, ~ligne 333)
> Agent : 12 — Accessibility WCAG 2.2 AA + E-E-A-T
> Date : 2026-05-13
> Statut : DRAFT (Phase A — AUDIT-ONLY, ZÉRO code écrit / zéro migration)
> Référence HEAD : `main` (commit `95bba36`, post-merge Booking V1 `fa093e5`)
> Doctrine code = SSOT (mémoire `axionia_doctrine_code_ssot`)
> Lié à : `00-REALITY-CHECK.md`, `04-ADMIN-UI.md` (Tiptap), `06-PUBLIC-SURFACE.md`, `07-CLIENT-SURFACE.md`, `13-MEDIA-PIPELINE.md` (alt text), `14-EDITORIAL-PIPELINE.md` (quality score), `10-AI-V15.md` (suggestion IA alt).

---

## 0. TL;DR

- **Acquis** : un `SkipToContent` existe (`src/components/a11y/SkipToContent.tsx`, async server component, `aria-label` via `getTranslations("common").skipToContent`, focus-visible ring primary, classe `sr-only`). Le `TiptapEditor` legacy a déjà `aria-label` sur chaque toolbar btn + `aria-label` sur le `EditorContent` lui-même. Palette terracotta confirmée OK contraste sur fond clair (mémoire `axionia_design_pivot`).
- **Gaps WCAG 2.2 bloquants V1** :
  1. Tiptap legacy **pas d'`role="toolbar"`** ni `aria-controls` ni `aria-live` autosave (autosave absent tout court — Sprint KB-3).
  2. Tiptap legacy **pas de gestion Escape** pour menus déroulants (pas de menu déroulant non plus, mais slash menu KB le requiert — Sprint KB-16).
  3. Alt text image **pas bloquant publication** aujourd'hui (le `TiptapEditor` n'intègre pas Image — Sprint KB-3 ajoute, doit verrouiller V1).
  4. `lastReviewedAt` / `publishedAt` **pas standardisés** dans les blocs auteur publics actuels (Article + HelpArticle exposent `publishedAt` ; pas de `reviewedBy` / `lastReviewedAt` dans le schéma).
- **Gaps E-E-A-T bloquants V1** :
  1. **Pas de page auteur publique** dédiée pour les autres types (Article a `/blog/auteur/[slug]/page.tsx`, mais une KB unifiée doit exposer **un** path canonique `/ressources/auteur/[slug]` accessible cross-type — décision Will Phase B).
  2. **Pas de schema Person** JSON-LD émis sur les pages auteur ni sur les détails entry (à confirmer Agent 6 SEO/AEO, mais Person SSOT manque côté code).
  3. **Pas de bloc `reviewedBy`** distinct de l'auteur.
  4. **Pas de bouton « citer cette page »** (BibTeX / APA / permalink / copy-to-clipboard).
- **Cap doctrine** : éditeur + listes publiques restent **SSR pur** (renderTiptapToReact côté public, mémoire Agent 11 perf), zéro hydration éditeur sur surface client. ARIA et keyboard traps relèvent du composant client admin uniquement.

---

## 1. SCOPE — 5 surfaces auditées

| #   | Surface                     | Route                                                        | Statut V1 KB                               | Sprint KB                                        |
| --- | --------------------------- | ------------------------------------------------------------ | ------------------------------------------ | ------------------------------------------------ |
| (a) | Éditeur admin Tiptap étendu | `/fr/<adminPrefix>/connaissances/[id]/edit`                  | À étendre depuis `TiptapEditor.tsx` legacy | KB-3 (Tiptap+++), KB-16 (templates/snippets/TOC) |
| (b) | Liste admin filtrable       | `/fr/<adminPrefix>/connaissances/?type=&domain=&status=`     | À créer                                    | KB-4                                             |
| (c) | Page publique détail        | `/fr/ressources/[type]/[slug]` (ou legacy `/blog/[slug]`...) | Migration KB-2 backfill                    | KB-6                                             |
| (d) | Hub publique                | `/fr/ressources/` (cible)                                    | À créer                                    | KB-6                                             |
| (e) | Surface client              | `/fr/mes-ressources/`                                        | À créer (post-login NextAuth)              | KB-7                                             |

---

## 2. CHECKLIST WCAG 2.2 AA — par surface

> Référentiel : WCAG 2.2 AA, RGAA 4.1.2 (équivalent FR), pratique Axion-IA mémoires `axionia_design_pivot` (contrast OK fond clair) et `axionia_typography_v3_2` (modular scale 88/64/48/32/24/18/16/14, lh respect).
> Méthode : pour chaque critère, statut (✅ acquis HEAD, ⚠️ partiel, ❌ à faire V1, 🔵 V1.5+).

### 2.1 — (a) Éditeur admin Tiptap

| Critère WCAG / pratique                                          | Détail                                                                                                                                                                        | Statut HEAD                                                   | Cible V1 KB                                                                                                    |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **1.3.1 Info & relationships**                                   | `role="toolbar"` sur barre d'outils + `aria-orientation="horizontal"` + groupage logique (format / structure / inserts / undo).                                               | ❌ pas de role                                                | Sprint KB-3 : ajouter `role="toolbar"` + `aria-label="Mise en forme du contenu"` + sous-groupes `role="group"` |
| **1.3.1 + 4.1.2** `aria-label` sur chaque toolbar btn            | Acquis (Gras / Italique / Barré / Titre H2 / Titre H3 / Liste à puces / Liste numérotée / Citation / Code inline / Séparateur horizontal / Annuler / Refaire).                | ✅ acquis                                                     | Étendre pour btns nouveaux Image / Link / Table / Callout / Code-language / Slash                              |
| **2.1.1 Keyboard**                                               | Toolbar btns navigables Tab/Shift-Tab. Toolbar **roving tabindex** (Arrow-Right/Left déplace focus, Tab sort de la toolbar) — pattern ARIA APG `Toolbar`.                     | ❌ tabindex non géré                                          | Sprint KB-3 : implémenter roving tabindex                                                                      |
| **2.1.2 No keyboard trap**                                       | Pas de trap dans l'éditeur — `Tab` doit sortir de la toolbar et entrer dans la zone d'édition Tiptap (Tab indente une liste à l'intérieur, sort sinon).                       | ⚠️ par défaut Tiptap intercepte Tab pour listes — à confirmer | Sprint KB-3 : vérifier que Tab hors liste sort du composant                                                    |
| **2.1.4 Character key shortcuts**                                | Raccourcis Ctrl+B/I/U doivent être désactivables ou ne pas se déclencher sans focus dans l'éditeur.                                                                           | ✅ Tiptap respecte par défaut                                 | À documenter (raccourcis listés dans une popover « ? »)                                                        |
| **2.4.3 Focus order**                                            | Order : toolbar (roving) → editor body → footer (autosave indicator / word count / save btn).                                                                                 | ❌ à implémenter                                              | Sprint KB-3                                                                                                    |
| **2.4.7 Focus visible**                                          | Anneau visible (utility `focus-visible:ring-primary`, déjà sur SkipToContent).                                                                                                | ⚠️ pas explicite sur toolbar btns                             | Sprint KB-3 : classe focus-visible:ring-primary sur chaque btn + style `tiptap-btn-active` distinct            |
| **2.4.11 Focus not obscured (mini)** WCAG 2.2 nouveau            | Focus ne doit pas être caché par sticky header/footer/sidebar admin.                                                                                                          | ❌ à vérifier                                                 | Sprint KB-3 : test scroll + focus                                                                              |
| **2.5.7 Dragging movements** WCAG 2.2 nouveau                    | Drag asset dans éditeur → fournir alternative click ou menu.                                                                                                                  | ❌ à prévoir                                                  | Sprint KB-3 : btn « Insérer image » menu modal + DnD = alternative non-bloquante                               |
| **2.5.8 Target size (minimum)** WCAG 2.2 nouveau                 | Btns toolbar ≥ 24×24px (cible AA = 24, AAA = 44).                                                                                                                             | ⚠️ taille toolbar Tiptap actuelle ~22px                       | Sprint KB-3 : padding min 6px = 28px+                                                                          |
| **3.2.6 Consistent help** WCAG 2.2 nouveau                       | Lien « aide rédaction » constant en haut à droite.                                                                                                                            | ❌ absent                                                     | Sprint KB-16                                                                                                   |
| **3.3.7 Redundant entry** WCAG 2.2 nouveau                       | Title / slug / excerpt déjà saisis ne se redemandent pas sur autosave (formulaire conserve l'état).                                                                           | ⚠️ à vérifier server action upsert                            | Sprint KB-4                                                                                                    |
| **3.3.8 Accessible authentication (mini)** WCAG 2.2 nouveau      | Pas concerné par l'éditeur (auth admin = NextAuth + 2FA TOTP existant).                                                                                                       | N/A                                                           | —                                                                                                              |
| **4.1.2 Name, role, value** Slash menu                           | Slash menu (`/`) ouvert depuis l'éditeur : `role="listbox"`, items `role="option"`, `aria-activedescendant` pour highlight, Escape ferme, Enter sélectionne, Up/Down navigue. | ❌ slash menu inexistant                                      | Sprint KB-16 (extension Tiptap `@tiptap/extension-mention` ou `@tiptap/suggestion` officiel)                   |
| **4.1.3 Status messages**                                        | Autosave : indicateur `aria-live="polite"` + `aria-atomic="true"` qui annonce « Brouillon enregistré à 14:32 ». Erreur autosave : `aria-live="assertive"`.                    | ❌ autosave inexistant                                        | Sprint KB-3                                                                                                    |
| **Contraste toolbar btns ≥ 3:1** (WCAG 1.4.11 Non-text contrast) | Toolbar btn vs fond panel admin doit être ≥ 3:1. Btn `tiptap-btn-active` doit être distinguable du non-actif au-delà de la couleur (icône + bg).                              | ⚠️ à mesurer                                                  | Sprint KB-3 : `pnpm contrast:check` étendu aux nouveaux composants admin                                       |
| **Escape closes**                                                | Modal d'insertion (lien, image, table, callout) : Escape ferme + retour focus au btn d'origine.                                                                               | ❌ pas de modal aujourd'hui                                   | Sprint KB-3 + KB-16 : `<Dialog>` Radix ou composant maison avec gestion focus trap intra-dialog uniquement     |
| **Annonce mode édition vs lecture**                              | Si readOnly toggle (Sprint KB-8 versioning) : annonce `aria-live` du changement.                                                                                              | ❌ pas de mode lecture                                        | Sprint KB-8                                                                                                    |
| **Localized labels**                                             | `aria-label` doit être traduit (FR/EN) — actuellement hardcodés en FR dans `TiptapEditor.tsx` (« Gras », « Italique »...).                                                    | ❌ FR hardcodé                                                | Sprint KB-3 : passer par `useTranslations("admin.knowledge.editor")`                                           |

### 2.2 — (b) Liste admin filtrable

| Critère WCAG / pratique                   | Détail                                                                                                                                                                                                 | Statut HEAD   | Cible V1 KB                                                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | --------------------------------------------------------------------------------------------------------------------------------- | --- | ----------- |
| **1.3.1 Info & relationships**            | Facettes (`type`, `domain`, `audience`, `confidentiality`, `status`, `author`) regroupées dans `<aside role="region" aria-labelledby="filters-heading">` avec `<h2 id="filters-heading">Filtres</h2>`. | ❌ à créer    | Sprint KB-4                                                                                                                       |
| **4.1.2 aria-current sur facette active** | Lien/btn facette actif a `aria-current="true"` (clear via croix).                                                                                                                                      | ❌            | Sprint KB-4                                                                                                                       |
| **3.3.2 Labels or instructions**          | Search input `<label for="kb-search">` visible ou `aria-label`. Placeholder ≠ label.                                                                                                                   | ❌            | Sprint KB-4 : `<label className="sr-only" htmlFor="kb-search">Rechercher dans la base de connaissances</label>` + visible heading |
| **2.4.4 Link purpose (in context)**       | Lien « Voir » sur chaque card de liste : `aria-label="Voir l'entrée: {title}"` ou contexte suffisant via texte.                                                                                        | ❌            | Sprint KB-4                                                                                                                       |
| **2.4.5 Multiple ways**                   | Recherche FTS + facettes + tri = 3 voies, conformité AA atteinte.                                                                                                                                      | ✅ via design | Sprint KB-4                                                                                                                       |
| **1.4.13 Content on hover or focus**      | Tooltips status `draft`/`review`/`published` : focusable, dismissable (Escape), persistent (hover off ≠ disparait sans délai).                                                                         | ❌            | Sprint KB-4                                                                                                                       |
| **Pagination accessible**                 | `<nav aria-label="Pagination">`, `aria-current="page"` sur la page active, btns « Précédent »/« Suivant » avec aria-label si icône seule.                                                              | ❌            | Sprint KB-4                                                                                                                       |
| **Annonce résultats**                     | `<div role="status" aria-live="polite">{count} entrées trouvées</div>` annoncé à chaque filtre.                                                                                                        | ❌            | Sprint KB-4                                                                                                                       |
| **Tri**                                   | `<button aria-sort="ascending                                                                                                                                                                          | descending    | none">` sur en-têtes colonnes triables.                                                                                           | ❌  | Sprint KB-4 |
| **Empty state**                           | « Aucune entrée ne correspond » avec heading h2 + CTA reset facettes.                                                                                                                                  | ❌            | Sprint KB-4                                                                                                                       |
| **Sélection bulk**                        | Si actions bulk V1.5 : `aria-multiselectable="true"`, annonce nb sélectionné, raccourci Shift+Click documenté.                                                                                         | 🔵 V1.5       | KB-V1.5                                                                                                                           |

### 2.3 — (c) Page publique détail (entrée)

| Critère WCAG / pratique              | Détail                                                                                                                                                                                                         | Statut HEAD                                                                                       | Cible V1 KB                                                                                                                                                       |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **2.4.1 Skip-link to main**          | `SkipToContent` existant déjà rendu dans le layout root. `<main id="main">` cible.                                                                                                                             | ✅ acquis (vérifier `id="main"` présent dans `layout.tsx` public)                                 | Sprint KB-6 : confirmer `<main id="main">`                                                                                                                        |
| **1.3.1 Headings sans saut**         | h1 = titre entrée → h2 = sections → h3 = sous-sections. Pas de h4 sans h3 parent.                                                                                                                              | ⚠️ dépend du contenu Tiptap                                                                       | Sprint KB-3 : `quality-score` Agent 14 inclut « no heading skip » (parse Tiptap JSON) bloquant publication                                                        |
| **1.1.1 Non-text content (alt)**     | Toute image dans body + cover : `alt` non vide obligatoire. Si décoratif : `alt=""` explicite ET marqué décoratif dans Tiptap (extension `image` étendue avec attribut `data-decorative`).                     | ❌ Tiptap legacy pas d'image                                                                      | Sprint KB-3 + KB-13 : extension Image custom force `alt` ou `decorative=true` avant insertion ; **publication bloquée si quality-score < seuil** (§ 4 ci-dessous) |
| **2.4.3 Focus order**                | Skip-link → header → breadcrumb → h1 → article body → bloc auteur → bloc reviewedBy → citations → CTA helpful → footer.                                                                                        | ❌ à vérifier                                                                                     | Sprint KB-6                                                                                                                                                       |
| **2.4.7 Focus visible**              | Liens internes article (citations footnotes, ancres TOC) ont focus visible.                                                                                                                                    | ⚠️ par défaut Tailwind                                                                            | Sprint KB-6 + `pnpm a11y:audit`                                                                                                                                   |
| **1.4.3 Contrast minimum**           | Texte body ≥ 4.5:1 (cible AA), titres ≥ 3:1 (AA large). Palette terracotta `--primary` sur fond `--bg` clair : confirmer 4.5:1 sur **liens** dans body (souvent piège — terracotta sur lait peut être limite). | ⚠️ mémoire `axionia_design_pivot` confirme OK fond clair, mais cas spécifique des liens à mesurer | Sprint KB-6 + `pnpm contrast:check`                                                                                                                               |
| **1.4.3 Contrast — cas fond sombre** | Si dark mode V1.5+ : palette terracotta sur fond noir charbon — risque AA non atteint sur certaines variantes.                                                                                                 | 🔵 V1.5+                                                                                          | KB-V1.5 (dark mode hors scope V1)                                                                                                                                 |
| **1.4.5 Images of text**             | Pas d'images textuelles dans le body (sauf cover OG dérivée). Cover OG : texte rendu en SVG/HTML, pas raster.                                                                                                  | ✅ HeroSchema doctrine (mémoire `axionia_hero_schema_v3_2`)                                       | Sprint KB-6 + KB-13                                                                                                                                               |
| **1.4.10 Reflow**                    | Pas de scroll horizontal ≤ 320px viewport.                                                                                                                                                                     | ⚠️ à vérifier sur tableaux Tiptap (extension table V1.5)                                          | KB-6                                                                                                                                                              |
| **1.4.11 Non-text contrast**         | Boutons CTA (« cette page vous a-t-elle aidé ? »), focus rings, séparateurs : ≥ 3:1.                                                                                                                           | ⚠️                                                                                                | Sprint KB-6                                                                                                                                                       |
| **1.4.12 Text spacing**              | Letter-spacing 0.12em / word-spacing 0.16em / line-height 1.5 / paragraph 2× line-height ne casse pas la mise en page.                                                                                         | ⚠️ typography v3.2 a `lh` propres (mémoire `axionia_typography_v3_2`)                             | Sprint KB-6 visual regression test                                                                                                                                |
| **1.4.13 Content on hover/focus**    | Tooltips « cite this », badges fact-checked : focusable, dismissable.                                                                                                                                          | ❌                                                                                                | Sprint KB-6                                                                                                                                                       |
| **2.4.6 Headings and labels**        | h1 = titre entrée FR canonique, h2 sections descriptives.                                                                                                                                                      | ⚠️ dépend rédacteur                                                                               | Sprint KB-3 quality-score                                                                                                                                         |
| **2.5.5 Target size (enhanced AAA)** | Btn « Helpful » 44×44px minimum (au-delà de la cible AA 24×24).                                                                                                                                                | 🔵 viser AAA                                                                                      | KB-6                                                                                                                                                              |
| **3.1.2 Language of parts**          | `lang="en"` sur les citations EN dans un article FR (extension Tiptap `language` ou wrapper `<span lang="en">`).                                                                                               | ❌                                                                                                | KB-16                                                                                                                                                             |
| **Speakable Schema**                 | `speakable` JSON-LD sur 1ère section intro pour AEO (mémoire `axionia_session_2026-05-12_interventions_hubs`).                                                                                                 | ⚠️ existe sur interventions, à reproduire                                                         | Sprint KB-6 SEO crossover                                                                                                                                         |

### 2.4 — (d) Hub publique `/ressources/`

| Critère WCAG / pratique               | Détail                                                                                                               | Statut HEAD   | Cible V1 KB |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------- | ----------- |
| **2.4.5 Multiple ways**               | Recherche + facettes (type, domain, audience) + sitemap + breadcrumb.                                                | ❌ à créer    | Sprint KB-6 |
| **1.3.1 Facettes accessibles**        | Facette = `<fieldset><legend>Type de contenu</legend><ul><li><a aria-current={active}>...</a></li></ul></fieldset>`. | ❌            | Sprint KB-6 |
| **2.4.4 Pagination accessible**       | Identique au § 2.2 admin.                                                                                            | ❌            | Sprint KB-6 |
| **1.4.4 Resize text 200%**            | Le hub doit rester lisible à zoom 200% (Tailwind responsive).                                                        | ⚠️ à vérifier | Sprint KB-6 |
| **4.1.3 Status messages**             | « 142 résultats » annoncés `aria-live` lors de filtre.                                                               | ❌            | Sprint KB-6 |
| **2.5.7 Dragging movements** WCAG 2.2 | Aucun drag attendu sur hub.                                                                                          | ✅ N/A        | —           |

### 2.5 — (e) Surface client `/mes-ressources/`

| Critère WCAG / pratique                                             | Détail                                                                                                                                                                                         | Statut HEAD                        | Cible V1 KB               |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------- |
| **3.3.8 Accessible authentication (minimum)** WCAG 2.2 nouveau      | Login client (NextAuth Booking V1, mémoire `axionia_booking_v1_session_2026-05-13`) : pas de CAPTCHA cognitive uniquement, magic-link OK (X.15 self-service magic-link existe — mémoire idem). | ✅ acquis via magic-link           | KB-7 réutilise            |
| **3.3.9 Accessible authentication (enhanced AAA)** WCAG 2.2 nouveau | Pas de saisie de mot de passe forcée — magic-link couvre.                                                                                                                                      | ✅ acquis                          | —                         |
| **2.4.11 Focus not obscured**                                       | Drawer profil client ne masque pas le focus actuel.                                                                                                                                            | ⚠️ à vérifier                      | Sprint KB-7               |
| **3.3.3 Error suggestion**                                          | Magic-link expiré : message clair + CTA renvoyer.                                                                                                                                              | ⚠️ existant Booking V1 à confirmer | Sprint KB-7 réutilise     |
| **1.3.1 Region landmarks**                                          | `<aside role="complementary" aria-label="Vos recommandations">` pour le bloc tag-matching.                                                                                                     | ❌                                 | Sprint KB-7               |
| **2.4.4 Link purpose**                                              | « Voir » sur card entrée : `aria-label="Voir: {title} (recommandé car {raison})"`.                                                                                                             | ❌                                 | Sprint KB-7               |
| **4.1.3 Status messages**                                           | Annonce « 5 nouvelles ressources cette semaine ».                                                                                                                                              | ❌                                 | Sprint KB-7               |
| **Consent**                                                         | Si tracking matchmaking → opt-out RGPD distinct du consent global cookies.                                                                                                                     | ⚠️ à confirmer Agent 9 RGPD        | Sprint KB-7 + Sprint KB-9 |

---

## 3. PALETTE TERRACOTTA — analyse contraste contextuelle

> Source : mémoire `axionia_design_pivot` (HEAD `941a8e1`+) — direction terracotta titleEm serif italique + Header terracotta figé.
> Mémoire `axionia_typography_v3_2` — modular scale 16/14 baseline, hero cap 88px.
> Scripts existants : `pnpm contrast:check` (mémoire `00-REALITY-CHECK` §5.2).

### 3.1 Cas conformes (vérifiés / présumés OK)

- Texte body `--fg` (charbon foncé) sur `--bg` (lait crème) ≥ 12:1 : ✅ AA + AAA.
- Header `--primary` (terracotta) avec texte blanc cassé : à mesurer (cible AA = 4.5:1) — présumé OK selon mémoire mais à confirmer scripté.
- Lien `--primary` underline sur body `--bg` lait : à mesurer (terracotta sur lait peut friser 4.5:1, pratique safe = forcer `text-fg + underline-primary-2` sur les liens body).
- Focus ring `focus-visible:ring-primary` : ring 2px primary + offset 2px → distinguable à ≥ 3:1.

### 3.2 Cas à vérifier (potentiellement non conformes)

- **Lien `--primary` inline body** : si fg = primary direct sur bg lait, peut être < 4.5:1. **Recommandation Sprint KB-6** : adopter le pattern `decoration-2 underline-offset-2 text-primary hover:text-fg` mais avec un primary darkening variant si contrast.check fail.
- **Badge `fact-checked` vert** sur fond terracotta clair (si jamais positionné dans le bloc auteur header) : risque AA.
- **`text-muted-foreground` (gris) sur `bg-muted`** dans facettes : généralement ~3:1, AA texte fail. À vérifier sur listes filtrables admin + public.
- **Couleur status `draft`/`review`/`published`** dans liste admin : si utilise uniquement la couleur → fail WCAG 1.4.1 (« colour alone ») → **toujours doubler avec icône + texte explicite**.

### 3.3 Cas non-conformes confirmés (rejeu CI)

- **Aucun confirmé HEAD à ce jour** sur les surfaces KB (les surfaces KB n'existent pas encore). Le risque est nouveau (créé par Sprint KB-3 à KB-7).
- **À planifier** : `pnpm contrast:check` étendu pour scanner les nouveaux components `src/components/knowledge/**` en pre-commit + CI.

### 3.4 Mode sombre V1.5+

- **Hors scope V1**. Mémoire `axionia_design_pivot` ne fige pas une variante sombre. Quand viendra : refaire un audit contrast complet, terracotta sur charbon est connu pour passer juste, certaines nuances chamois pour facettes peuvent échouer.

---

## 4. E-E-A-T — Architecture trust 2026

> Référentiel : Google Search Quality Rater Guidelines 2024-12 (E-E-A-T : Experience, Expertise, Authoritativeness, Trustworthiness).
> Modèle Prisma `Author` existant (lignes 791-806) : `id`, `slug`, `name`, `email`, `avatarUrl`, `bioFr`, `bioEn`, `linkedinUrl`, `articles[]`. **Réutilisable, à étendre.**

### 4.1 Bloc auteur public (sur chaque page entrée publique)

**Position** : juste après le body, avant la section citations.

**Composant** : `KnowledgeAuthorCard.tsx` (SSR pur, pas client).

**Contenu minimum V1** :

- **Avatar** : `<Image>` Next, `width={64}` `height={64}` (densité 2x = 128px source), `priority={false}` (pas LCP), `loading="lazy"`, `alt="{author.name}"` (PAS alt vide), `quality={75}`, AVIF/WebP via pipeline KB-13.
- **Nom** : `<a href="/fr/ressources/auteur/{slug}">{name}</a>` lien interne canonique (slug EN parallèle si publié EN).
- **Bio courte** : `bioFr` (≤ 280 caractères affichés, troncature CSS `line-clamp-2`), traduit `bioEn` si locale EN.
- **JobTitle** : ❌ pas dans le modèle actuel `Author` → **extension Phase B** : ajouter colonnes `jobTitleFr`, `jobTitleEn` (varchar 120).
- **sameAs LinkedIn** : `linkedinUrl` existant.
- **Date publication** : `publishedAt` (existant sur Article/HelpArticle, étendre à `KnowledgeEntry.publishedAt`). Format : `<time datetime="{iso}">{format relative + absolu}</time>`.
- **Date dernière revue** : `lastReviewedAt` (à créer sur `KnowledgeEntry`, **doit être PUBLIC, jamais caché derrière toggle**). Doctrine anti-pattern § 6.
- **Lien profil auteur** : `/fr/ressources/auteur/{slug}` (cible unifiée KB) OU `/fr/equipe/{slug}` si Will tranche page équipe consolidée. STOP & ASK § 7.

**Schema Person JSON-LD** (émis SSR dans `<head>` de la page entrée + page auteur) :

```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "{author.name}",
  "url": "{canonical_author_page}",
  "image": "{avatar_url_absolute}",
  "jobTitle": "{author.jobTitleFr}",
  "sameAs": ["{author.linkedinUrl}"],
  "worksFor": {
    "@type": "Organization",
    "name": "Axion-IA",
    "url": "https://axion-ia.com"
  },
  "description": "{author.bioFr}",
  "knowsAbout": ["IA générative", "automatisation PME", ...]
}
```

**Helper factory** : `buildPersonJsonLd(author: Author, locale: Locale): WithContext<Person>` dans `src/lib/seo/jsonld/person.ts` (pattern mémoire `axionia_aeo_geo_perfection_2026-05-07` factories JSON-LD).

### 4.2 Bloc `reviewedBy` distinct de `author`

> **Doctrine** : un fact-check pair-review valide une entrée. L'auteur écrit, le reviewer atteste.

**Modèle Prisma cible** (Agent 1 data model — proposition pour cohérence) :

```prisma
model KnowledgeEntry {
  // ...
  authorId        String?  @db.Uuid
  author          Author?  @relation(fields: [authorId], references: [id])
  reviewedById    String?  @db.Uuid  // nullable (V1 review optionnelle, V1.5 obligatoire par type)
  reviewedBy      Author?  @relation("KnowledgeEntryReviewedBy", fields: [reviewedById], references: [id])
  lastReviewedAt  DateTime? @map("last_reviewed_at")
  factChecked     Boolean   @default(false) @map("fact_checked")
  factCheckedById String?   @map("fact_checked_by_id") @db.Uuid
  factCheckedBy   Author?   @relation("KnowledgeEntryFactCheckedBy", fields: [factCheckedById], references: [id])
  // ...
}
```

(Note Agent 1 : 3 relations Author + KnowledgeEntry — clarifier alias relations.)

**Affichage public** (sous bloc auteur ou collapsed) :

- Si `reviewedBy != null` : « Relu par {reviewedBy.name} le {lastReviewedAt} ».
- Si `factChecked == true` : badge « Fait-vérifié par {factCheckedBy.name} » + tooltip explicatif.
- **Jamais** afficher des badges fact-checked sans `factCheckedBy != null` (anti-pattern § 6).

### 4.3 Badge `fact-checked`

- Boolean entry-level (`factChecked`) + relation reviewer (`factCheckedBy`).
- Affiché publiquement : badge avec icône (checkmark) + texte « Fait-vérifié » + datetime tooltip + lien `mailto:{reviewer.email}` ou lien profil interne.
- Bloque le badge si pas de `factCheckedAt` (datetime ajouté) ou pas de `factCheckedBy` (qui).
- Workflow admin : seul un AdminRole ≥ `REVIEWER` peut cocher `factChecked=true`, et il devient automatiquement le `factCheckedBy`.
- Schema markup JSON-LD : `Claim` ou `ClaimReview` schema (cas fact-checking) — V1.5+ pour les entrées de type `glossary_term` ou `faq` factuelles. V1 = juste badge visible.

### 4.4 Citations sources visibles en bas de page

**Modèle cible** (Agent 1) :

```prisma
model KnowledgeEntry {
  // ...
  cites KnowledgeCitation[]
}

model KnowledgeCitation {
  id              String   @id @default(uuid()) @db.Uuid
  entryId         String   @db.Uuid
  entry           KnowledgeEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)
  order           Int      // ordre d'affichage
  title           String   @db.VarChar(500)
  url             String?  @db.VarChar(1024)
  authorName      String?  @map("author_name") @db.VarChar(255)
  publisherName   String?  @map("publisher_name") @db.VarChar(255)
  publishedYear   Int?     @map("published_year")
  accessedAt      DateTime? @map("accessed_at")
  citationType    KnowledgeCitationType  // article, book, report, blog, official, dataset
  isbn            String?  @db.VarChar(20)
  doi             String?  @db.VarChar(120)

  @@index([entryId, order])
  @@map("knowledge_citations")
}
```

**Affichage public** :

- Section `<section aria-labelledby="citations-heading"><h2 id="citations-heading">Sources</h2><ol>...</ol></section>`.
- Items numérotés `<li id="cite-{order}">` avec URL `<a href="{url}" rel="nofollow noopener" target="_blank">{title}</a>` + `<span lang="en">` si source EN dans page FR.
- Footnotes : ancre dans le body via `<sup><a href="#cite-1">[1]</a></sup>` (extension Tiptap `Footnote` ou pattern Markdown préservé).

**JSON-LD `citation`** : ajouter `citation: ["{url1}", "{url2}", ...]` dans le schema `Article` / `TechArticle` de l'entrée.

### 4.5 Bouton « citer cette page »

**Composant** : `CiteThisPageButton.tsx` (client component, mais minimal — pas plus de 5 KB gz).

**Position** : juste après le titre h1 (icône quote) OU dans la section citations en pied.

**Comportement** :

1. Click → ouvre un `<dialog>` (HTMLDialogElement natif, accessible) ou popover Radix UI.
2. 3 onglets : `BibTeX`, `APA`, `Permalink`.
3. Chaque onglet : `<textarea readonly>` avec la citation formatée + btn « Copier » (utilise `navigator.clipboard.writeText` + fallback execCommand).
4. Confirmation copie : `aria-live="polite"` annonce « Citation copiée ».

**Formats** :

- **BibTeX** :
  ```bibtex
  @online{axionia2026_{slug},
    author = "{author.name}",
    title  = "{entry.title}",
    year   = "{publishedAt.year}",
    url    = "{canonical_url}",
    urldate = "{nowISO}",
    organization = "Axion-IA"
  }
  ```
- **APA 7e édition** :
  ```
  {Author Surname}, {A.}. ({YYYY}, {Mon DD}). {Title}. Axion-IA. {canonical_url}
  ```
- **Permalink** : URL canonique absolue + ancre version (`?v={KnowledgeVersion.id}` si on permalinke une version archivée — Sprint KB-8 versioning).

**A11y** :

- Dialog : `role="dialog"` `aria-modal="true"` `aria-labelledby="cite-dialog-title"`.
- Focus trap intra-dialog (utilisation de `<dialog>` natif OU `@radix-ui/react-dialog`).
- Escape ferme + retour focus au btn d'origine.
- Tabs : `role="tablist"` `role="tab"` `aria-selected="true"` `role="tabpanel"` `aria-labelledby`.
- Btn « Copier » : `aria-label="Copier la citation au format {format}"`.

**Recommandation provider** : `@radix-ui/react-dialog` est déjà candidat pour modal Tiptap Insert. Mutualiser.

### 4.6 Trust signals globaux — pages auteur dédiées

**Décision Phase B (Will trancher)** :

- Option A : `/fr/ressources/auteur/{slug}` + `/en/library/author/{slug}` — pattern KB unifié, propre.
- Option B : `/fr/equipe/{slug}` — pattern « équipe » corporate, plus B2B.
- Recommandation reality check : **Option A V1**, redirigée vers `/fr/equipe/{slug}` si V1.5+ ajoute page corporate (cohérence pSEO villes pattern).

**Contenu page auteur** :

- h1 = nom auteur.
- Avatar 256×256.
- Bio longue (champ `bioFr` actuel suffit V1, étendre à `bioLongFr` Markdown si besoin V1.5).
- jobTitle + sameAs LinkedIn (+ Twitter/X V1.5).
- Schema Person enrichi (cf § 4.1) + Schema CollectionPage listant les entrées.
- Liste paginée des entrées (filtrables par type + domain).
- Stats agrégées : nb entrées publiées, dernier publié, domaines de spécialité.

**Doctrine Axion-IA** :

- **Manon** = author canonical existant (mémoire `axionia_project`). Bio à enrichir pour atteindre niveau E-E-A-T 2026 (parcours pro, certifications, projets concrets, contact).
- Pas d'auteur fictif/composite (anti-pattern § 6).

---

## 5. ALT TEXT BLOQUANT PUBLICATION V1

> Cap doctrine : **aucune entrée ne se publie sans alt text valide pour chaque image**. Hard gate code-side, pas option configurable.

### 5.1 Quality-score scrute body + cover

**Algorithme** (Sprint KB-14 `qualityScore.ts`) :

```ts
function checkAltText(entry: KnowledgeEntryDraft): QualityCheck {
  const issues: string[] = [];

  // Cover
  if (entry.coverImageId && !entry.coverImageAlt?.trim()) {
    issues.push("Cover image sans texte alternatif");
  }

  // Body Tiptap : parse JSON, walk nodes
  const images = extractImageNodes(entry.bodyJson);
  for (const img of images) {
    const isDecorative = img.attrs?.decorative === true;
    const alt = img.attrs?.alt?.trim();
    if (!isDecorative && !alt) {
      issues.push(`Image sans alt: ${img.attrs?.src ?? "(unknown)"}`);
    }
    if (alt && alt.length > 250) {
      issues.push(`Alt trop long (>250): ${img.attrs?.src}`);
    }
  }

  return {
    name: "alt-text",
    passed: issues.length === 0,
    weight: 15, // sur 100 quality-score
    issues,
  };
}
```

**Intégration server action `publishEntryAction`** :

```ts
// Sprint KB-4 / KB-14
const score = await computeQualityScore(entry);
if (score.altText.passed === false) {
  return {
    ok: false,
    error:
      "Publication impossible : images sans texte alternatif (" +
      score.altText.issues.join(", ") +
      ")",
  };
}
```

**Bloquant** : pas un warning, pas un toggle admin. Si l'auteur veut un alt vide intentionnel, il doit explicitement marquer l'image `decorative=true` dans l'éditeur (UI = checkbox dans la modal Insert Image).

**Seuil quality-score global** (Agent 14) : SSOT dans `KnowledgeBaseConfig.qualityScoreThresholds[type]`. Pour `type='glossary_term'` : seuil bas (60). Pour `type='blog_article'` : seuil 75. Bloquant publication si en dessous.

### 5.2 Suggestion IA alt V1.5 (Claude vision)

**Stack V1.5** : Claude Haiku 4.5 vision (mémoire `axionia_prompt_doc_sync`).

**Workflow** :

1. Upload image dans asset library → background job `suggestAltText.worker.ts` BullMQ.
2. Worker appelle Claude vision avec l'image + prompt « Décris cette image en 1-2 phrases factuelles, FR, < 150 caractères, pas de jugement, pas de "image montrant" ».
3. Stockage suggestion dans `KnowledgeAsset.altSuggestion` (column nullable).
4. Dans l'éditeur, à l'insertion : préfille champ `alt` avec la suggestion + label « Suggestion IA — éditer obligatoire ».
5. **Jamais publié automatiquement** : la suggestion IA est un brouillon, le rédacteur doit la valider/éditer avant submit.
6. **Logging** : event `alt.ai_suggested` + `alt.ai_accepted` / `alt.ai_edited` dans ActivityLog pour mesurer le taux d'acceptation et calibrer le modèle.

**Cost cap** : `KnowledgeBaseConfig.aiAltMaxPerMonth = 500` (~$0.50/mois Haiku). Si dépassé → suggestion désactivée, alt manuel pur.

**Confidentialité** : refus dur si image marquée `confidentiality IN ('confidential', 'secret')` (mémoire `axionia_session_2026-05-09_sprint_24_1` PII minimisation).

### 5.3 Anti-spam alt (V1.5+)

- Détection alt « image », « photo », « graphique » seuls → warning quality-score (pas bloquant, mais score –5).
- Détection alt qui répète le titre h1 → warning.
- Détection alt copie de la légende `figcaption` → warning (cf. WCAG H67 Using `null` alt text and no title attribute on img elements for images that AT should ignore).

---

## 6. ANTI-PATTERNS — interdictions explicites V1

Doctrine durcie, à inscrire en commentaire dans les fichiers concernés + bloqués CI où possible.

| #   | Anti-pattern                                                                                     | Pourquoi                                                                                                          | Mécanisme de blocage V1                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----- | ---------- |
| 1   | **Alt text auto-publié sans review humaine**                                                     | E-E-A-T fail, RGAA fail, Google Quality Guidelines fail (« generated content without human curation »).           | Server action `publishEntryAction` refuse si `altSuggestion === alt && entry.qualityFlags.altReviewed !== true`. Toggle UI explicite « J'ai relu cet alt » obligatoire si suggestion IA. |
| 2   | **Cacher `lastReviewedAt` derrière un toggle admin**                                             | Trust signal violé. La date de dernière revue est publique par construction.                                      | Pas de champ `hideReviewedAt` dans le modèle. Composant React `KnowledgeAuthorCard` ne supporte pas cette prop.                                                                          |
| 3   | **Auteur fictif / composite / "L'équipe Axion-IA"**                                              | E-E-A-T fail. Manon Smets est l'author canonical (mémoire `axionia_project`). Personne fictive = pénalité Google. | Seed Prisma n'autorise que des `Author` réels nommés. Server action `upsertEntryAction` valide `authorId` existe et `author.name !~ /équipe                                              | team | admin | system/i`. |
| 4   | **Faux badges fact-checked**                                                                     | E-E-A-T fail. Si pas de `factCheckedBy` (qui), pas de badge. Si pas de `factCheckedAt` (quand), pas de badge.     | DB constraint `CHECK (factChecked = false OR (factCheckedById IS NOT NULL AND factCheckedAt IS NOT NULL))`.                                                                              |
| 5   | **`role="toolbar"` sans `aria-label` + roving tabindex**                                         | WCAG 4.1.2 fail. Pattern ARIA APG Toolbar non respecté.                                                           | Test unitaire `tiptap-editor.test.tsx` checks `getByRole("toolbar").getAttribute("aria-label")` non vide + simule Tab → focus sort, ArrowRight → focus btn suivant.                      |
| 6   | **Skip-link sans cible `<main id="main">`**                                                      | WCAG 2.4.1 fail.                                                                                                  | Test Playwright `@a11y` cross-page checks `#main` existe et est `<main>` ou `[role=main]`.                                                                                               |
| 7   | **Liens avec `aria-label` redondant ou différent du texte**                                      | WCAG 2.5.3 Label in Name fail.                                                                                    | Lint custom `next-axion-ia/aria-label-match-text` (Sprint KB-22 stretch). V1 : code review.                                                                                              |
| 8   | **Pages auteur sans schema Person JSON-LD**                                                      | E-E-A-T trust signal manquant.                                                                                    | Test Playwright `@seo` checks `script[type="application/ld+json"]` contient `@type: Person` sur `/fr/ressources/auteur/*`.                                                               |
| 9   | **Citations affichées dans body mais pas dans schema citation**                                  | E-E-A-T trust signal partiel.                                                                                     | Helper factory `buildArticleJsonLd` lit toujours `entry.cites` et émet `citation: [...]`. Test integration.                                                                              |
| 10  | **Image insérée dans Tiptap sans modal Insert**                                                  | Pas de validation alt côté UI.                                                                                    | Extension Tiptap Image custom **désactive** le DnD raw → force passage par modal qui exige alt OU decorative.                                                                            |
| 11  | **Color-only state indicator (status draft/review/published colored badge sans texte ou icône)** | WCAG 1.4.1 fail.                                                                                                  | Component `<KnowledgeStatusBadge>` toujours texte + icône, pas couleur seule.                                                                                                            |
| 12  | **`aria-live` sur toute la page ou region trop large**                                           | Annonces intrusives, mauvaise UX écran-lecteur.                                                                   | Code review : seul autosave indicator + result count + clipboard confirm doivent être `aria-live`.                                                                                       |
| 13  | **`<button>` clickable sans `type="button"` dans formulaire**                                    | Submit accidentel. Existant dans `TiptapEditor.tsx` legacy ✅ — préserver.                                        | Lint `react/button-has-type`.                                                                                                                                                            |
| 14  | **`<img>` natif au lieu de `<Image>` Next dans surfaces publiques KB**                           | Web Vitals fail + alt enforcement par-passable.                                                                   | `next/image` partout, ESLint `@next/next/no-img-element` errored. Asset library KB-13 fournit width/height.                                                                              |
| 15  | **Localized strings hardcodés FR/EN dans composants admin a11y**                                 | i18n parity fail. Cf TiptapEditor legacy (hardcode FR).                                                           | `useTranslations("admin.knowledge.editor")` partout. Test `pnpm i18n:check` étendu.                                                                                                      |

---

## 7. STOP & ASK — Décisions ouvertes Phase B

> Toutes ces questions doivent être tranchées par Will avant Sprint KB-3 (éditeur) / KB-6 (public) / KB-7 (client).

### 7.1 Chemin canonique page auteur

**Question** : `/fr/ressources/auteur/{slug}` (option A, KB-unifié) OU `/fr/equipe/{slug}` (option B, page corporate) ?
**Impact** : Slug history, sitemap, schema Person URL canonique, redirection si pivot.
**Recommandation reality check** : **Option A V1**, avec redirection 301 vers option B si V1.5 produit une page équipe corporate.

### 7.2 Extension modèle `Author`

**Question** : ajouter `jobTitleFr`, `jobTitleEn`, `expertiseAreasJson` (knowsAbout), `xUrl`, `mastodonUrl`, `orcidId` (académique V1.5+) ?
**Impact** : Migration Prisma Sprint KB-1, schema Person JSON-LD enrichi.
**Recommandation reality check** : **V1 ajouter `jobTitleFr` + `jobTitleEn` seuls**. Reste V1.5.

### 7.3 reviewedBy vs factCheckedBy — 1 ou 2 rôles ?

**Question** : faut-il distinguer (a) un reviewer éditorial (relecture style/cohérence) et (b) un fact-checker (vérification factuelle) ?
**Impact** : 2 relations Author au lieu d'1, 2 badges distincts vs 1 badge agrégé.
**Recommandation reality check** : **V1 = 1 relation `reviewedBy` + boolean `factChecked` + relation `factCheckedBy` distincte** (un seul reviewer peut être les deux). V1.5 split si volume justifie.

### 7.4 BibTeX / APA — autre format ?

**Question** : besoin de **MLA**, **Chicago**, **Vancouver**, **ISO 690** en plus de BibTeX et APA ?
**Impact** : taille du dialog « citer cette page », maintenance des formatters.
**Recommandation reality check** : **V1 = BibTeX + APA seulement**. Si demande utilisateur, ajouter Chicago en V1.5.

### 7.5 Schema ClaimReview / FactCheck

**Question** : émettre `ClaimReview` JSON-LD sur entrées avec `factChecked=true` (Google FactCheck Tools utilise ce schema) ?
**Impact** : surface AEO / Google FactCheck listing, mais nécessite review formelle (claim reviewed, claimReviewed, reviewRating).
**Recommandation reality check** : **V1.5+** (V1 = badge visuel + boolean DB sans schema).

### 7.6 Quality-score : valeur du seuil alt par défaut

**Question** : `qualityScoreThresholds.altText` doit-il être un weight (15/100 dans le score global) **ou** un hard gate séparé (boolean) ?
**Impact** : si weight, un score 85/100 avec alt manquant peut passer ; si hard gate, alt obligatoire indépendamment du reste.
**Recommandation reality check** : **hard gate séparé + weight 0** dans le quality score. L'alt est non négociable, pas un compromis.

### 7.7 SkipLink — localized

**Question** : `SkipToContent` existant utilise `getTranslations("common").skipToContent`. Confirmer que les deux locales FR/EN ont la clé.
**Recommandation reality check** : **vérifier en KB-2** (audit i18n parity script `pnpm i18n:check`).

### 7.8 Bouton « citer cette page » : position

**Question** : (a) sticky right-bar (style Wikipedia) (b) après h1 inline (c) en bas dans la section sources (d) plusieurs ?
**Impact** : Web Vitals (sticky = layout shift risk), UX, discoverability.
**Recommandation reality check** : **(c) en bas section sources + (a) sticky right-bar sur viewport lg+** seulement, avec `position: sticky` (pas fixed) pour pas casser CLS.

### 7.9 Suggestion IA alt V1.5 — modèle

**Question** : Claude Haiku 4.5 vision (mémoire `axionia_prompt_doc_sync` skill `claude-api`) ou GPT-4o-mini vision (autre provider, coût similaire) ?
**Impact** : DPA, sous-processeurs (mémoire `axionia_session_2026-05-09_sprint_24_1`).
**Recommandation reality check** : **Claude Haiku 4.5** (cohérence stack, prompt caching activable, déjà DPA Anthropic en cours).

### 7.10 Bloc citation — externalisation cite-by-DOI ?

**Question** : si `citation.doi != null`, auto-fetch metadata depuis crossref.org API V1.5+ ?
**Impact** : worker BullMQ + cache, mais réduit la saisie manuelle.
**Recommandation reality check** : **V1.5+**.

### 7.11 Schema Person — image alt sur avatar

**Question** : avatar auteur — alt = `{author.name}` est correct OU faut-il `alt=""` (décoratif puisque le nom est juste à côté en texte) ?
**Référentiel** : WCAG H67 dit que si une image est juste un complément visuel d'un texte adjacent, `alt=""` est OK. Mais pour E-E-A-T + cas où le bloc est resorti dans un excerpt RSS sans texte, `alt={name}` est plus safe.
**Recommandation reality check** : **`alt={author.name}` toujours** (E-E-A-T > redondance WCAG, et l'alt sert aussi à l'OG/RSS).

### 7.12 Surface client `/mes-ressources` — droit à l'oubli

**Question** : si client supprime son compte (RGPD erase Sprint 24), les recommandations matchmaking et le tracking « entries vues » doivent être purgées en cascade. Confirmation Agent 9 RGPD.
**Recommandation reality check** : **Agent 9 doit étendre la liste cascade-delete au tracking KB**.

---

## 8. Couverture WCAG 2.2 AA — synthèse score Phase A

| Niveau                     | Critères AA total | Couverts par design V1                                                                                                           | Partiels                                                                                  | À traiter                                                                    |
| -------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| WCAG 2.0 AA (38 critères)  | 38                | 32 par design (layout / Tailwind / next/image / textes)                                                                          | 4 partiels (palette contrast à mesurer, headings dans body Tiptap dépendant rédacteur)    | 2 nouveaux blocs (citations + cite button)                                   |
| WCAG 2.1 AA (+12 nouveaux) | 12                | 9 couverts (orientation / character key shortcuts / text spacing)                                                                | 2 partiels (1.4.10 reflow sur tableau Tiptap, 1.4.11 non-text contrast sur badges status) | 1 à traiter (2.5.3 label in name sur boutons icône-only Tiptap)              |
| WCAG 2.2 AA (+6 nouveaux)  | 6                 | 4 par design (2.4.11 focus not obscured min, 3.2.6 consistent help, 3.3.7 redundant entry, 3.3.8 accessible auth via magic-link) | 1 partiel (2.5.7 dragging movements — DnD asset library doit fournir alternative)         | 1 à traiter (2.5.8 target size minimum 24×24 — toolbar Tiptap actuelle 22px) |

**Verdict V1 cible** : **WCAG 2.2 AA conforme** réalisable, à condition de respecter les 15 anti-patterns § 6 et de traiter les ~12 gaps spécifiques identifiés en § 2.

---

## 9. RECOMMANDATIONS POUR LES SPRINTS KB

### 9.1 Sprint KB-3 (Tiptap+++) — checklist a11y obligatoire

- [ ] `role="toolbar" aria-label="..." aria-orientation="horizontal"` sur `.tiptap-toolbar`.
- [ ] Roving tabindex sur les btns toolbar (lib `@react-aria/focus` ou pattern maison léger).
- [ ] `useTranslations("admin.knowledge.editor")` au lieu de strings hardcodés.
- [ ] Autosave indicator `role="status" aria-live="polite" aria-atomic="true"`.
- [ ] Modales Insert Image / Link : `@radix-ui/react-dialog`, focus trap, Escape closes, return focus.
- [ ] Slash menu : `role="listbox"` + `role="option"` + `aria-activedescendant`.
- [ ] Cible 28×28px minimum sur tous btns toolbar.
- [ ] `pnpm contrast:check` étendu pour scanner toolbar btns vs panel admin bg.
- [ ] Test Playwright `@a11y` sur `/fr/<adminPrefix>/connaissances/new` : axe-core 0 violations critical/serious.

### 9.2 Sprint KB-4 (Admin liste) — checklist a11y obligatoire

- [ ] `<aside role="region" aria-labelledby="filters-heading">`.
- [ ] Facette active `aria-current="true"`.
- [ ] Annonce `role="status" aria-live="polite"` à chaque filtre `{count} résultats`.
- [ ] `<nav aria-label="Pagination">` + `aria-current="page"`.
- [ ] Status badge avec icône + texte + aria-label (jamais color-only).
- [ ] `<label htmlFor="kb-search">` (sr-only ok).
- [ ] Test Playwright `@a11y` axe-core 0 violations sur liste filtrée.

### 9.3 Sprint KB-6 (Public surface entrée + hub) — checklist a11y obligatoire

- [ ] `<main id="main">` confirmé.
- [ ] `<KnowledgeAuthorCard>` SSR avec avatar `<Image width=64 height=64 alt={author.name}>`, lien profil interne, schema Person JSON-LD.
- [ ] `<KnowledgeReviewedByCard>` distinct (si `reviewedBy`).
- [ ] Badge fact-checked si `factChecked && factCheckedBy`.
- [ ] Section `<section aria-labelledby="citations-heading">` listant `entry.cites` numéroté.
- [ ] Bouton « Citer cette page » → dialog accessible (BibTeX + APA + permalink).
- [ ] `lastReviewedAt` toujours visible si non null.
- [ ] `pnpm contrast:check` sur liens body terracotta + facettes hub.
- [ ] Test Playwright `@a11y` sur `/fr/ressources` + `/fr/ressources/[type]/[slug]` exemple.

### 9.4 Sprint KB-7 (Client surface) — checklist a11y obligatoire

- [ ] Réutilise magic-link auth Booking V1 (déjà conforme WCAG 2.2 3.3.8).
- [ ] Annonce recommandations `aria-live="polite"`.
- [ ] Recommandations card : `aria-label` complet (titre + raison match).
- [ ] Test Playwright `@a11y` sur `/fr/mes-ressources` post-login.

### 9.5 Sprint KB-14 (Quality score) — checklist E-E-A-T

- [ ] `checkAltText` hard gate intégré dans `publishEntryAction`.
- [ ] `checkHeadingHierarchy` (no skip h2 → h4).
- [ ] `checkAuthorPresent` (entry.authorId not null pour `type IN (...)` configurable).
- [ ] `checkCitationsCount` (warning si type='blog_article' et 0 citations, seuil bas pour glossaire/FAQ).
- [ ] `checkReviewedAtFreshness` (warning si > 365 jours sans revue, alert si > 730 jours pour `type='guide'` ou `type='glossary_term'`).

### 9.6 Sprint KB-18 (Tests / observabilité) — couverture a11y

- [ ] Tag Playwright `@a11y` exhaustif sur 6 routes pivot KB.
- [ ] `@axe-core/playwright` 0 critical/serious sur chacune.
- [ ] Test integration `kb.publish` refuse si quality.altText fail.
- [ ] Test unitaire formatters BibTeX/APA snapshot.
- [ ] Test unitaire `buildPersonJsonLd` produit shape attendu.

---

## 10. DEPENDENCIES À AJOUTER (chiffrage Phase B)

| Dependency                     | Sprint | Justification                                               | Estim. KB gz |
| ------------------------------ | ------ | ----------------------------------------------------------- | ------------ |
| `@radix-ui/react-dialog`       | KB-3   | Modal Insert Image/Link + cite-this-page dialog accessible. | ~6 KB gz     |
| `@radix-ui/react-tabs`         | KB-3   | Tabs BibTeX/APA/Permalink + onglets templates.              | ~3 KB gz     |
| `@react-aria/focus` (optional) | KB-3   | Focus trap + roving tabindex helpers.                       | ~4 KB gz     |
| `@axe-core/playwright`         | KB-18  | Audit a11y E2E.                                             | dev only     |

**Budget gz total V1 KB pages publiques** : ≤ 75 KB gz (AGENTS.md). Le bouton cite + dialog Radix doivent rester sous 10 KB gz cumulés. `@react-aria/focus` est admin-only (pas dans le bundle public). ✅ tenable.

---

## 11. RÉCAPITULATIF E-E-A-T cible 2026 (cohérence Search Quality Rater Guidelines)

| Pilier                    | Mécanisme V1 KB                                                                                                                                                                                  | Statut HEAD                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| **Experience** (1st-hand) | Bloc auteur + bio + lien LinkedIn (preuve d'expérience).                                                                                                                                         | ❌ à construire                                      |
| **Expertise**             | Pages auteur dédiées + schema Person + jobTitle + knowsAbout.                                                                                                                                    | ❌ à construire                                      |
| **Authoritativeness**     | Citations sources externes visibles + DOI/ISBN si applicable + lien Wikipedia/officiel.                                                                                                          | ❌ à construire                                      |
| **Trustworthiness**       | `lastReviewedAt` toujours visible + badge fact-checked traçable + sources + bouton citer + permalink versionné + mentions légales liées.                                                         | ❌ à construire                                      |
| **Bonus 2026**            | Speakable schema (mémoire interventions hubs), JSON-LD `Article` + `Person` + `citation` array, `dateModified` distinct de `datePublished`, hreflang FR/EN, llms.txt enrichi (mémoire IndexNow). | ⚠️ partiellement existant ailleurs, à généraliser KB |

---

## 12. CONFORMITÉ DOCTRINE AXION-IA

| Doctrine                                                                        | Statut                                                                                                                                                                  |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code = SSOT (mémoire `axionia_doctrine_code_ssot`)                              | ✅ — audit ne modifie pas le code, recommandations alignées sur les patterns Tiptap legacy + SkipToContent existants.                                                   |
| Naming Axion-IA (mémoire `axionia_naming_brand_vs_project`)                     | ✅ — composants nommés `KnowledgeAuthorCard`, `CiteThisPageButton`, etc. en camelCase / PascalCase.                                                                     |
| Zero-hardcode i18n (mémoire `axionia_pricing_zero_hardcode_2026-05-08`)         | ✅ — toutes strings via `useTranslations` ou `getTranslations`, mono-fichier `fr.json`/`en.json` namespacés `admin.knowledge.editor.*`, `kb.authorCard.*`, `kb.cite.*`. |
| Web Vitals budget AGENTS.md                                                     | ✅ — ajouts Radix Dialog + Tabs ≤ 10 KB gz, SSR pour bloc auteur + citations, client-only pour cite dialog uniquement.                                                  |
| Cabinet IA opérationnel (mémoire `axionia_naming_cabinet`)                      | ✅ — bio Manon = « cabinet IA opérationnel » consistant.                                                                                                                |
| Hetzner CPX32 + CF Free (mémoire `axionia_hosting_hetzner`)                     | ✅ — aucun SaaS payant introduit. Claude Haiku V1.5 alt suggestion = cost cap configuré.                                                                                |
| RGPD + ADR 0010 Telegram PII (mémoire `axionia_session_2026-05-09_sprint_24_1`) | ✅ — refus dur images `confidentiality` IN ('confidential', 'secret') sur API IA.                                                                                       |
| Doctrine éditoriale design pivot (mémoire `axionia_design_pivot`)               | ✅ — palette terracotta préservée, contrast measure `pnpm contrast:check` étendu, jamais texte sur photo.                                                               |

---

**Fin Agent 12 — A11y WCAG 2.2 AA + E-E-A-T.** AUDIT-ONLY. Zéro code écrit. Lancement Phase B contingent sur résolution des 12 STOP & ASK § 7 (en particulier 7.1 chemin page auteur, 7.3 reviewedBy vs factCheckedBy split, 7.6 seuil quality alt).
