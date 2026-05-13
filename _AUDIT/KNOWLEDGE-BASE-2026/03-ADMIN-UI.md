# 03 — ADMIN UI ARCHITECTURE — Knowledge Base 2026 — Phase A

> Prompt : `_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md`
> Agent : 3 — Admin UI architecture
> Date : 2026-05-13
> Statut : DRAFT (Phase A audit-only)
> Référence : HEAD `main` (commit `95bba36`), reality check `00-REALITY-CHECK.md`

---

## 0. TL;DR

- Arborescence admin FR cohérente sous `/fr/<adminPrefix>/connaissances/` confirmée (§12.5 prompt). Aucun écran nouveau ne casse de route legacy ; les anciens admins `/blog`, `/case-studies`, `/faq`, `/help`, `/categories` restent disponibles côté V1 (strangler).
- Maquettes ASCII détaillées fournies pour les **12 écrans cibles** : liste, création, édition tabbed, calendrier, santé, médias, imports, étiquettes, auteurs, files-attente-revue, paramètres, plus l'aperçu `/[id]/apercu`.
- Décision **forte** : **étendre** `src/components/admin/TiptapEditor.tsx` via wrapper `EntryEditor.tsx` plutôt que créer un éditeur parallèle (cohérence, DRY, refactor mineur des hidden inputs `${name}_html|_json|_text` déjà éprouvés Sprint 24 C4).
- Décision **forte** : convention dossier = `src/components/knowledge/{admin,public,client,shared}` (module cross-cutting, recommandation prompt §11.1) plutôt que `src/features/admin-knowledge/` (feature admin-only, pattern legacy `admin-blog`/`admin-faq`).
- Décision **forte** : **page dédiée** pour chaque détail / sous-section (URLs partageables, breadcrumb propre, état préservé sur reload), **jamais drawer**. Loading overlay via `loading.tsx` + suspense boundaries autour des panneaux.
- Pattern preview : route admin SSR `/fr/<adminPrefix>/connaissances/[id]/apercu` qui rend `EntryRenderer.tsx` (composant public) avec un wrapper "mode brouillon" — pas d'iframe, pas de pop-up.
- Tiptap étendu V1 : `Link`, `Image`, `Placeholder`, `CodeBlockLowlight` (language picker), callout custom (extension node) ; autosave debounce 2 s + indicator triple état (`Saved · Saving · Error`) ; slash menu `/` ; raccourcis `⌘S` / `⌘P` / `⌘⇧P`.
- 8 STOP & ASK ouverts pour Will en fin de doc (§14).

---

## 1. ARCHITECTURE GLOBALE — POSITION DANS L'ARBORESCENCE

### 1.1 Routes admin cibles (FR cohérent, §12.5 prompt)

```
/fr/<adminPrefix>/connaissances                       ← liste filtrable (page hub admin KB)
/fr/<adminPrefix>/connaissances/nouvelle              ← création (type picker → skeleton)
/fr/<adminPrefix>/connaissances/[id]                  ← édition tabbed (7 onglets)
/fr/<adminPrefix>/connaissances/[id]/apercu           ← preview SSR mode brouillon
/fr/<adminPrefix>/connaissances/calendrier            ← vue éditoriale planifiée
/fr/<adminPrefix>/connaissances/sante                 ← health dashboard contenu
/fr/<adminPrefix>/connaissances/medias                ← asset library
/fr/<adminPrefix>/connaissances/medias/[assetId]      ← détail asset
/fr/<adminPrefix>/connaissances/imports               ← wizard import (MD/Notion/_AUDIT)
/fr/<adminPrefix>/connaissances/imports/[batchId]     ← détail batch + rollback
/fr/<adminPrefix>/connaissances/etiquettes            ← CRUD tags + merge
/fr/<adminPrefix>/connaissances/auteurs               ← E-E-A-T (extension Author existant)
/fr/<adminPrefix>/connaissances/auteurs/[authorId]    ← profil auteur
/fr/<adminPrefix>/connaissances/files-attente-revue   ← queue reviewer
/fr/<adminPrefix>/connaissances/parametres            ← seuils quality, review windows, flags
```

Note : ces URLs n'écrasent **aucun** admin legacy. `/blog`, `/case-studies`, `/faq`, `/help`, `/categories` continuent de fonctionner en parallèle V1 (déco progressive en V2+ après validation Will).

### 1.2 Convention dossier — DÉCISION : module cross-cutting

| Option                                                                                                                        | Description                                                                                | Verdict                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| **A — `src/features/admin-knowledge/`**                                                                                       | Pattern legacy (`admin-blog`, `admin-faq`...). 1 god-file `actions.ts` + form colocalisés. | **Rejeté** : KB est cross-cutting (admin + public + client + RAG). Coller au pattern feature admin-only la verrouille en silo. |
| **B — `src/components/knowledge/{admin,public,client,shared}` + `src/server/actions/knowledge/*.ts` + `src/lib/knowledge/*`** | Recommandation prompt §11.1. Module cross-cutting. Server actions 1 fichier / opération.   | **Recommandé** ✅                                                                                                              |

**Justification** : la même base de composants (`EntryRenderer`, `tiptap-render`, `json-ld`, `slug`...) sert l'admin, le public et le client. Le pattern feature-based ne le permet pas sans cross-imports inverses.

### 1.3 Convention sous-pages — DÉCISION : pages dédiées, jamais drawer

| Option                     | Argument pro                                                                                                                              | Argument contra                                                                                                    | Verdict           |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------- |
| **Drawer / modal latéral** | Garde le contexte (liste visible derrière).                                                                                               | URL non partageable, CLS sur ouverture, état perdu sur reload, focus trap fragile, problème accessibilité clavier. | **Rejeté**.       |
| **Page dédiée**            | URL `/[id]` partageable, breadcrumb propre, état préservé sur navigation, suspense boundaries propres. Loading overlay via `loading.tsx`. | Petit cold start sur première nav.                                                                                 | **Recommandé** ✅ |

**Pattern Next 16** : chaque sous-route a son `loading.tsx` (skeleton ≤ 5 KB gz). Transition fluide via `<Link>` prefetch + view-transitions désactivées (cf. reality check perf nav 2026-05-07 — view-transitions = lenteur clics constatée).

### 1.4 Convention preview — DÉCISION : route SSR dédiée + composant public partagé

```
/fr/<adminPrefix>/connaissances/[id]/apercu
   │
   ├── auth() obligatoire (rôle ≥ EDITOR)
   ├── SSR rend EntryRenderer.tsx (composant public) avec `previewMode=true`
   ├── Headers `Cache-Control: no-store` + `X-Robots-Tag: noindex`
   ├── Banner top : "🔍 Aperçu brouillon · auteur: Manon · v.12 · 14:32" + bouton "Retour édition"
   └── Affiche le JSON Tiptap pas-encore-publié (state = draft du WIP user)
```

**Anti-pattern explicitement écarté** : iframe preview. Causes CLS, problèmes a11y, hydration mismatch. La route admin SSR rend le **même** composant `EntryRenderer.tsx` que `/blog/[slug]`, garantissant fidélité 1:1 sans iframe.

Pour partage externe stakeholder (sans login admin) : route publique `/api/kb-preview/[token]/route.ts` avec JWT court-vivant (24-72h configurable §11.1 + §0.0/34 du prompt), inflight Sprint KB-17.

---

## 2. MAQUETTE ASCII — `/connaissances/` (LISTE FILTRABLE)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ☰  Axion-IA admin · /fr/<prefix>/connaissances                       Manon · OWNER · 🔔 3 · ▼ │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 📚 Connaissances                                                       [+ Nouvelle entrée]      │
│ 1 248 entrées · 12 en revue · 47 à publier · 89 hors review window               page 1/63     │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ 🔍 Recherche  [────────────────────── ia, rag, pme...        ──────────────────] (FTS FR+EN)│ │
│ └─────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                                 │
│ Facettes (cliquables — chips actifs en terracotta, aria-current="true")                         │
│ Type:        [Tous ✕] [Article 412] [Cas concret 38] [FAQ 156] [Help 67] [Glossaire 89]        │
│              [Guide 12] [Méthodologie 24] [Doctrine 18] [ADR 21] [Prompt 9] [SOP 14] [+5]      │
│ Domaine:     [Commercial 218] [Technique 412] [Juridique 67] [RH 23] [Produit 156] [+4]        │
│ Audience:    [Public 887] [Client 178] [Team 156] [Will only 27]                                │
│ Statut:      [Brouillon 67] [Revue 12] [Publié 1 124] [Archivé 28] [Programmé 17]              │
│ Auteur:      [Manon 612] [Will 234] [Équipe Axion-IA 312] [+ filtre …]                          │
│ Tags:        [ia-pour-pme 87] [rag 54] [automatisation 178] [+ filtre tags...]                 │
│ Période:     [< 7 j] [< 30 j] [< 90 j] [tout]   Review:  [⚠️ overdue 89] [< 30 j]               │
│                                                                                                 │
│ Tri ▼ : [Date publication ↓] [Date modification] [Quality score ↓] [Vues 30j ↓] [A→Z]          │
│ Bulk : ☐ tout · 0 sélectionné(s)   [Publier] [Archiver] [Tagger] [Exporter] [Supprimer]        │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────────────────────────────┐    │
│ │ ☐ │ Titre                                          │ Type     │ Sta. │ Score │ Modif.   │    │
│ ├───┼────────────────────────────────────────────────┼──────────┼──────┼───────┼──────────┤    │
│ │ ☐ │ ▣ IA pour PME — bilan 12 mois                   │ Article  │ ●Pub │ 92/100│ il y a 2h│    │
│ │   │ FR ✓ EN ✓ · Manon · 4 relations · 8 tags        │          │      │ 🟢    │ Manon    │    │
│ ├───┼────────────────────────────────────────────────┼──────────┼──────┼───────┼──────────┤    │
│ │ ☐ │ ▣ Comparatif RAG vs fine-tuning                 │ Article  │ ◐Rev │ 78/100│ hier     │    │
│ │   │ FR ✓ EN ⚠ · Will · 2 relations · 5 tags         │          │      │ 🟡    │ Will     │    │
│ ├───┼────────────────────────────────────────────────┼──────────┼──────┼───────┼──────────┤    │
│ │ ☐ │ ▣ Onboarding client — étape 3 (cadrage)         │ Onbrd.   │ ●Pub │ 88/100│ 12/05    │    │
│ │   │ FR ✓ · audience=client · 1 relation             │          │      │ 🟢    │ Manon    │    │
│ ├───┼────────────────────────────────────────────────┼──────────┼──────┼───────┼──────────┤    │
│ │ ☐ │ ⚠ ADR 0021 — Knowledge Base unifiée             │ ADR      │ ○Drf │ 64/100│ 14:02    │    │
│ │   │ FR ✓ · audience=team · review overdue 38 j      │          │      │ 🔴    │ Will     │    │
│ └───┴────────────────────────────────────────────────┴──────────┴──────┴───────┴──────────┘    │
│                                                                                                 │
│ ◀ Précédent  [1] [2] [3] … [63]  Suivant ▶          Affichage 1-20 sur 1 248                   │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Notes UX liste

- **Search bar** : FTS Postgres (français + english config), debounce 250 ms côté client, server action `searchEntries(query, facets)`. Pas de fuzzy V1 (V1.5 = pgvector cosine).
- **Facettes** : chips cliquables, état rendu via URL searchParams (`?type=article&audience=public&tags=rag`), partageable. Compteurs par facette = count distinct sur résultat courant (autres facettes appliquées).
- **Bulk actions** : checkbox row + master. État géré via `useState` client + visible compteur. Action côté serveur via `bulkArchiveAction`, `bulkTagAction` (Zod, transaction Prisma, audit log).
- **Status badges** : couleurs SSOT `src/content/knowledge/statuses.ts` (cohérent avec convention badges existants `.admin-badge-${status}`).
- **Quality score** : pastille colorée 🟢 ≥ 80 / 🟡 50-79 / 🔴 < 50 (seuils SSOT `quality-thresholds.ts`).
- **EN parity indicator** : `FR ✓ EN ✓` vert, `FR ✓ EN ⚠` jaune (brouillon EN), `FR ✓` neutre (pas de traduction EN).
- **Review overdue indicator** : `⚠ review overdue 38 j` rouge si `reviewDueAt < now`.
- **Pagination** : 20 par page (cohérent avec listes admin existantes).
- **Vide state** : "Aucune entrée. [Créer la première →]".
- **A11y** : table avec `<caption>` invisible, headers `<th scope="col">`, sort buttons avec `aria-sort`, facettes avec `aria-pressed`, `aria-current="true"` sur chip actif.

---

## 3. MAQUETTE ASCII — `/connaissances/nouvelle` (CRÉATION)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ← /fr/<prefix>/connaissances  ›  Nouvelle entrée                                                │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Type de connaissance                                                                         │
│ ┌────────────────────────────────────────────────────────────────────────────────────────────┐  │
│ │ ◉ Article (blog SEO)            ○ Cas concret (case study)                                 │  │
│ │ ○ Centre d'aide                  ○ FAQ                                                     │  │
│ │ ○ Glossaire                      ○ Guide IA long-form                                      │  │
│ │ ○ Méthodologie                   ○ Doctrine Axion-IA (interne)                            │  │
│ │ ○ ADR (Architecture Decision)    ○ Template de prompt                                      │  │
│ │ ○ SOP                             ○ Post-mortem                                            │  │
│ │ ○ Fiche outil                     ○ Fiche concurrent                                       │  │
│ │ ○ Document commercial             ○ Étape onboarding client                                │  │
│ └────────────────────────────────────────────────────────────────────────────────────────────┘  │
│ Helper : « Le type fige l'URL publique et le template de démarrage. Modifiable plus tard.»     │
│                                                                                                 │
│ 2. Métadonnées initiales (modifiables après création)                                           │
│ ┌─────────────────┬─────────────────────────┬─────────────────────────────────────────────┐    │
│ │ Domaine *       │ [Technique          ▼ ] │ Audience *  [Team           ▼] (défaut)      │    │
│ │ Auteur *        │ [Manon              ▼ ] │ Confidentialité [Internal   ▼] (défaut)      │    │
│ │ Locale racine * │ ⊙ FR  ○ EN              │ Statut initial  [Brouillon ▼]                │    │
│ └─────────────────┴─────────────────────────┴─────────────────────────────────────────────┘    │
│ ⓘ Audience + Confidentialité par défaut = team + internal (cf. doctrine §0.1/10 prompt).       │
│                                                                                                 │
│ 3. Aperçu du template (lecture seule, généré depuis SSOT)                                       │
│ ┌────────────────────────────────────────────────────────────────────────────────────────────┐  │
│ │ Template "Article" — squelette (sera injecté dans l'éditeur Tiptap) :                      │  │
│ │                                                                                            │  │
│ │ # [Titre H1 — sera tiré du champ Titre]                                                    │  │
│ │ > Chapeau (excerpt) — pourquoi ce contenu, pour qui                                        │  │
│ │ ## Problème                                                                                │  │
│ │ ## Approche Axion-IA                                                                        │  │
│ │ ## Résultats / mesures                                                                     │  │
│ │ ## Étapes pratiques                                                                        │  │
│ │ > Callout : « Réservez 30 min avec Manon → /reserver »                                     │  │
│ │ ## FAQ                                                                                     │  │
│ │ ## Pour aller plus loin (related entries)                                                  │  │
│ └────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                 │
│ [Annuler]                                                              [Créer → ouvrir éditeur] │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Notes UX création

- **Step 1 type picker** : radio group `role="radiogroup"`, label clair, count d'entrées existantes par type entre parenthèses pour donner contexte. Sélection contrôlée via `useState`.
- **Step 2 métadonnées initiales** : tous required, valeurs par défaut sûres (team + internal). Le placement « Audience par défaut = team » est **non négociable** (§0.1/10 doctrine). Si Will veut un audience picker plus permissif → STOP & ASK.
- **Step 3 preview template** : lecture seule. Template Tiptap JSON depuis `src/content/knowledge/templates/<type>.ts` (SSOT). Permet à Manon de comprendre ce qui va s'injecter avant clic [Créer].
- **Action [Créer]** : server action `createEntryAction({type, domain, audience, confidentiality, authorId, locale})` → crée `KnowledgeEntry` + 1 `KnowledgeTranslation` racine pré-remplie avec le template JSON + `KnowledgeVersion` v1 + redirige vers `/[id]` édition.
- **Anti-pattern écarté** : pas de wizard 5 étapes. Création = 1 écran (3 sections logiques), l'enrichissement détaillé se fait dans l'éditeur.

---

## 4. MAQUETTE ASCII — `/connaissances/[id]` (ÉDITION TABBED)

````
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ← /connaissances  ›  Article  ›  "IA pour PME — bilan 12 mois"                                  │
│ ID kbe_8x3p · v.14 · créé 14/04 · modif. il y a 2 min · 🟢 Quality 92/100 · ⚠ EN brouillon      │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│  [💾 Sauvegardé · 14:32:18]   [👁 Aperçu]   [⤴ Soumettre revue]   [▶ Publier]   [⋯]            │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌─[ Contenu ]─[ Métadonnées ]─[ Relations ]─[ Versions ]─[ Publication ]─[ RGPD ]─[ Médias ]──┐ │
│ │                                                                                              │ │
│ │  Onglet 1 — CONTENU (par défaut)                                                            │ │
│ │  ┌────────────────────────────────────────────────────────────────────────────────────────┐ │ │
│ │  │ Locale  ◉ FR    ○ EN   [+ ajouter EN]                                                  │ │ │
│ │  │ Titre * [ IA pour PME — bilan 12 mois                                              ]  │ │ │
│ │  │ Slug *  [ ia-pour-pme-bilan-12-mois          ] (auto-généré, éditable)               │ │ │
│ │  │ Chapeau [ Retour d'expérience après 14 missions Axion-IA en 2025 ...              ]  │ │ │
│ │  └────────────────────────────────────────────────────────────────────────────────────────┘ │ │
│ │                                                                                              │ │
│ │  ┌─ Éditeur Tiptap étendu ────────────────────────────────────────────────────────────────┐│ │
│ │  │ B I S | H2 H3 H4 | • ≡ ❝ < / > ─ | 🔗 🖼 📋 💡 | ⌘+Z ⌘+⇧+Z  | / slash menu          ││ │
│ │  │────────────────────────────────────────────────────────────────────────────────────────││ │
│ │  │                                                                                        ││ │
│ │  │ # IA pour PME — bilan 12 mois                                                          ││ │
│ │  │                                                                                        ││ │
│ │  │ Retour d'expérience après 14 missions...                                              ││ │
│ │  │                                                                                        ││ │
│ │  │ ## Problème                                                                            ││ │
│ │  │ Les PME françaises rencontrent typiquement trois obstacles...                          ││ │
│ │  │                                                                                        ││ │
│ │  │ 💡 Callout : « Réservez 30 minutes avec Manon → /reserver »  [éditer · supprimer]      ││ │
│ │  │                                                                                        ││ │
│ │  │ ## Résultats                                                                           ││ │
│ │  │ Sur 14 missions, le ROI médian observé est de 4,2 mois.                                ││ │
│ │  │                                                                                        ││ │
│ │  │ ```python                                                                              ││ │
│ │  │ # Calcul ROI moyen (langue: python ▼)                                                  ││ │
│ │  │ roi = sum(gains) / cost                                                                ││ │
│ │  │ ```                                                                                    ││ │
│ │  │                                                                                        ││ │
│ │  │ [insertion image — drop ici ou cliquer 🖼 — alt text obligatoire avant publication]    ││ │
│ │  │                                                                                        ││ │
│ │  └────────────────────────────────────────────────────────────────────────────────────────┘│ │
│ │                                                                                              │ │
│ │  Footer éditeur : 1 247 mots · ~5 min de lecture · readability 62/100 (FK adapté FR)         │ │
│ │                  TOC auto : ▸ Problème · Approche · Résultats · Étapes · FAQ                 │ │
│ │                                                                                              │ │
│ └──────────────────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
````

### 4.1 Onglet 2 — MÉTADONNÉES

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ [ Contenu ]【 Métadonnées 】[ Relations ] [ Versions ] [ Publication ] [ RGPD ] [ Médias] │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ Type *           [Article                ▼]                                              │
│ Domaine *        [Commercial             ▼]                                              │
│ Audience *       [Public                 ▼]   Confidentialité * [Public         ▼]       │
│ Auteur *         [Manon                  ▼]   Reviewer         [Will            ▼]       │
│ Locale racine *  ⊙ FR  ○ EN                                                              │
│                                                                                          │
│ Tags             [ia-pour-pme] [rag] [automatisation] [+ ajouter tag ...]                │
│                  (recherche/création inline, fusion via /etiquettes)                     │
│                                                                                          │
│ Cover image      ┌─[ thumbnail 200x110 ]─┐  [Changer] [Supprimer]                        │
│                  │  hero-pme-bilan.jpg    │  Alt: « Tableau de bord IA, PME française »  │
│                  └────────────────────────┘  Hero layout: [Photo ▼] (schema/photo/illus.)│
│                                                                                          │
│ Dates                                                                                    │
│   publishedAt    [14/04/2026  ┃ 10:00]   (lecture seule si statut=published)             │
│   lastReviewedAt [14/04/2026  ┃ 10:00]   [Marquer comme revu]                            │
│   reviewDueAt    [14/04/2027  ┃ 10:00]   (auto +12 mois, override possible)              │
│   expiresAt      [          ┃     ]   (laisser vide = sans expiration)                   │
│                                                                                          │
│ SEO + AEO                                                                                │
│   metaTitle      [IA pour PME — Bilan 12 mois | Axion-IA]              max 70   ✓ 58    │
│   metaDescript.  [Retour d'exp. 14 missions...                ]        max 160  ✓ 142   │
│   ogImage URL    [https://axion-ia.com/og/ia-pour-pme.png]                              │
│   canonicalUrl   [(auto: /fr/blog/ia-pour-pme-bilan-12-mois)]                            │
│                                                                                          │
│ Localisation géo (optionnelle GEO)                                                       │
│   areasServed    [Lyon] [Paris] [+ ajouter ville INSEE ...]                              │
│                                                                                          │
│ Quality score   ┌──────────────────────────────────────┐                                 │
│                 │ ████████████████░░░  92/100  🟢 OK   │  [Voir détail critères]         │
│                 └──────────────────────────────────────┘                                 │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Onglet 3 — RELATIONS

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ [Contenu] [Métadonnées]【 Relations 】[Versions] [Publication] [RGPD] [Médias]            │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ Graphe sortant (cette entrée → autres)                                                    │
│  ▸ cites              → "Étude OCDE 2025 — IA dans PME" (entry kbe_4ml9)    [✕]          │
│  ▸ depends_on         → "Méthodologie audit Axion-IA" (entry kbe_2kx7)      [✕]          │
│  ▸ related_to         → "Comparatif RAG vs fine-tuning" (entry kbe_9pp1)    [✕]          │
│  ▸ replaces           → (aucune)                                                          │
│  [+ Ajouter relation ▼]   Type [related_to ▼]  Cible [recherche entrée ...]              │
│                                                                                           │
│ Graphe entrant (autres → cette entrée)                                                    │
│  ◂ "Onboarding étape 4"          → references (lecture seule, non éditable d'ici)        │
│  ◂ "Newsletter mensuelle 04/26"  → references                                            │
│                                                                                           │
│ Sources externes (URLs)                                                                   │
│  • https://www.ocde.org/...        ✓ vérifié 12/05 · [Re-vérifier]  [Éditer]  [✕]        │
│  • https://anthropic.com/news/...  ✓ vérifié 12/05                                       │
│  [+ Ajouter source externe]                                                               │
│                                                                                           │
│ Auto-suggestions (V1.5)                                                                   │
│  ⓘ « Relations probables non encore créées »                                              │
│  → "Plans 'Essentielle' vs 'Approfondie'" (entry kbe_6nh3) [related_to ?]  [Ajouter]     │
│  → "Méthodologie cadrage 30 min" (entry kbe_1az5)          [depends_on ?]  [Ajouter]     │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Onglet 4 — VERSIONS

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ [Contenu] [Métadonnées] [Relations]【 Versions 】[Publication] [RGPD] [Médias]           │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ Historique des versions (immutable, append-only)                                          │
│                                                                                           │
│  v.14 ● actuelle   14/05  14:32  Manon       +124 / -8 mots     [Diff vs v.13]           │
│  v.13              14/05  10:18  Manon       +56  / -12 mots    [Diff vs v.12] [Restaurer]│
│  v.12              13/05  17:04  Will        +8   / -3 mots     [Diff vs v.11] [Restaurer]│
│  v.11              12/05  16:30  Manon       +312 / -45 mots    [Diff vs v.10] [Restaurer]│
│  v.10              10/05  09:00  Manon       brouillon initial  [Voir]                    │
│  […]                                                                                      │
│                                                                                           │
│  ▸ Cliquer une version ouvre le drawer diff (split view côté droit, sans iframe)         │
│                                                                                           │
│  ┌─ Diff v.13 → v.14 ──────────────────────────────────────────────────────────────────┐│
│  │ ## Résultats                                                                          ││
│  │ - Sur 14 missions, le ROI médian observé est de 4,2 mois.                            ││
│  │ + Sur 14 missions, le ROI médian observé est de 4,2 mois. 92 % livrés dans budget.   ││
│  │                                                                                       ││
│  │ ## Étapes pratiques                                                                  ││
│  │ - 1. Audit cadre                                                                     ││
│  │ + 1. Cadrage 30 min                                                                  ││
│  │ + 2. Audit cadre (Essentielle ou Approfondie)                                        ││
│  └───────────────────────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.4 Onglet 5 — PUBLICATION

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ [Contenu] [Métadonnées] [Relations] [Versions]【 Publication 】[RGPD] [Médias]           │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ État actuel : ●  Publié                                                                   │
│                                                                                           │
│ Workflow                                                                                  │
│  draft ──► review ──► published ──► archived                                              │
│            (Will)     (Manon)        ─                                                    │
│                                                                                           │
│ Actions disponibles selon rôle (OWNER)                                                    │
│  [▶ Publier maintenant]   [⏰ Programmer publication ▼]   [⛔ Dépublier]                  │
│  [📦 Archiver]            [⚠ Marquer deprecated → entrée remplaçante: ...]                │
│                                                                                           │
│ Programmation                                                                             │
│  scheduledFor   [          ┃     ]    Embargo until [          ┃     ]                   │
│                                                                                           │
│ Visibilité par canal                                                                      │
│   ☑ Site public (/fr/blog/[slug])           ☑ Hub /ressources                            │
│   ☑ Sitemap + IndexNow                       ☐ Newsletter mensuelle                      │
│   ☑ RSS /blog/feed.xml                       ☐ Carrousel LinkedIn (V2+)                  │
│                                                                                           │
│ Preview shareable (24-72h)                                                                │
│   [Générer lien preview tokenisé]                                                         │
│   ⚠ Aucun lien actif. Génère un JWT court-vivant accessible sans login.                  │
│                                                                                           │
│ Side effects sur publication                                                              │
│   • revalidatePath('/fr/blog', '/fr/blog/[slug]', '/fr/ressources')                       │
│   • Sitemap regen (kb segment)                                                            │
│   • IndexNow ping helper centralisé                                                       │
│   • ActivityLog event 'kb.published'                                                      │
│   • Embedding reindex (V1.5)                                                              │
│   • Newsletter digest enqueue (BullMQ)                                                    │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.5 Onglet 6 — RGPD

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ [Contenu] [Métadonnées] [Relations] [Versions] [Publication]【 RGPD 】[Médias]           │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ PII scan — résultats du dernier check (auto à chaque save)                                │
│   ✓ Aucun email détecté                                                                   │
│   ✓ Aucun téléphone détecté                                                               │
│   ✓ Aucun IBAN détecté                                                                    │
│   ⚠ 1 nom propre non-Axion-IA détecté : « Jean Dupont »                                  │
│     [Whitelist (consentement signé)] [Pseudonymiser] [Ignorer (sera bloqué à publish)]   │
│                                                                                           │
│ Snapshot doctrine (legal-snapshot.ts)                                                    │
│   Version CGV : 2026-03-12     Version mentions légales : 2026-04-01                     │
│   [Re-snapshot]                                                                           │
│                                                                                           │
│ Retention                                                                                 │
│   expiresAt : (vide — pas d'expiration) [Définir]                                         │
│                                                                                           │
│ Cookies / tracking embedés                                                                │
│   Aucun iframe externe détecté.                                                           │
│                                                                                           │
│ Embeddings (V1.5)                                                                         │
│   ⚠ Bloquant : confidentiality='public' = OK pour embedding.                              │
│   Si vous passez confidentiality='secret', l'embedding sera révoqué automatiquement.     │
│                                                                                           │
│ Export GDPR de cette entrée                                                               │
│   [Exporter JSON]   (rate-limited 1/jour/OWNER)                                           │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.6 Onglet 7 — MÉDIAS

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ [Contenu] [Métadonnées] [Relations] [Versions] [Publication] [RGPD]【 Médias 】          │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ Assets utilisés dans cette entrée                                                         │
│                                                                                           │
│  ┌────────────┐  hero-pme-bilan.jpg                                                       │
│  │ thumb 200  │  1920×1080 · 245 KB AVIF · 5 variantes générées                           │
│  │            │  Alt : « Tableau de bord IA, PME française »  [Éditer alt]                │
│  └────────────┘  Utilisé : cover · 1 occurrence inline                                    │
│                                                                                           │
│  ┌────────────┐  graph-roi-pme.png                                                        │
│  │ thumb 200  │  1200×800 · 87 KB AVIF · 4 variantes                                      │
│  │            │  Alt : « Graphique ROI moyen 4,2 mois »                                   │
│  └────────────┘  Utilisé : 1 occurrence inline                                            │
│                                                                                           │
│  [+ Ajouter média depuis la bibliothèque]   [+ Upload nouveau (drag-drop OK)]            │
│                                                                                           │
│ Health médias entrée                                                                      │
│   ✓ Tous les médias ont un alt text                                                       │
│   ✓ Cover image définie                                                                   │
│   ✓ Toutes les variantes générées (AVIF + WebP + JPEG fallback)                          │
│   ✓ EXIF/GPS strippés                                                                     │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.7 Notes UX édition

- **Sticky toolbar** top : sauvegardé indicator (état triple), boutons aperçu / soumettre revue / publier, kebab menu `⋯` (Archive, Dépublier, Dupliquer, Exporter PDF, Supprimer + confirm).
- **Tabs** : `role="tablist"` + `aria-controls`, tab order clavier complet (Tab → onglet, flèches gauche/droite → switch onglet, `Home`/`End`).
- **State partagé** entre onglets : l'éditeur Tiptap est monté **une seule fois**, les autres onglets sont rendus en `display:none` (pattern existant BlogForm `admin-tab-content-hidden`) pour ne pas perdre le state. Coût acceptable (1 instance Tiptap ~ 60 KB gz mais réutilisé en édition admin seulement).
- **EN parity dans onglet Contenu** : switcher `◉ FR ○ EN` réutilise le pattern BlogForm/HelpForm/CaseStudyForm existant. `[+ ajouter EN]` initialise une `KnowledgeTranslation` EN avec template skeleton.
- **Anti-pattern écarté** : pas de drawer latéral pour les onglets. Tabs en haut, panneau plein écran. URL `/[id]?tab=metadata` pour deep-link (optionnel V1.1).

---

## 5. MAQUETTES ASCII — SOUS-ÉCRANS

### 5.1 `/connaissances/calendrier`

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ← Connaissances › Calendrier éditorial                                                          │
│ Filtres : Type [Tous ▼] Domaine [Tous ▼] Auteur [Tous ▼] Reviewer [Tous ▼]   [< Mai 2026 >]    │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│   Lun       Mar       Mer       Jeu       Ven       Sam       Dim                              │
│ ┌────────┬────────┬────────┬────────┬────────┬────────┬────────┐                                │
│ │ 11     │ 12     │ 13     │ 14 ●●  │ 15 ●●● │ 16     │ 17     │                                │
│ │        │        │ ▣ Art. │ ▣ Art. │ ▣ Case │        │        │                                │
│ │        │        │  draft │  publi.│  publi.│        │        │                                │
│ │        │        │  Manon │  10:00 │  10:00 │        │        │                                │
│ ├────────┼────────┼────────┼────────┼────────┼────────┼────────┤                                │
│ │ 18 ●   │ 19     │ 20 ●●  │ 21 ●●● │ 22 ●●●●│ 23     │ 24     │                                │
│ │ ▣ Help │        │ ▣ FAQ  │ ▣ Glos.│ ▣ Guide│        │        │                                │
│ │  Manon │        │  Manon │  Will  │  Manon │        │        │                                │
│ │  draft │        │  rev.  │  sched.│  sched.│        │        │                                │
│ └────────┴────────┴────────┴────────┴────────┴────────┴────────┘                                │
│ Glisser-déposer pour replanifier (drag handle sur card)                                         │
│                                                                                                 │
│ Code couleur :  ◆ Article  ◆ Cas concret  ◆ FAQ  ◆ Glossaire  ◆ Guide  ◆ Help                  │
│ État :          ○ Draft  ◐ Review  ● Published  ◑ Scheduled  □ Archived                        │
│                                                                                                 │
│ Légende KPIs (sidebar droite, ratio 70/30)                                                      │
│   Publications mai 2026 : 14                Médiane time-to-publish : 8 j                       │
│   EN parity : 86 %                          Review overdue : 12 entrées                         │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 `/connaissances/sante`

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ← Connaissances › Santé du contenu                                                              │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ KPI cards (4 colonnes responsive)                                                               │
│ ┌───────────────┬───────────────┬───────────────┬───────────────┐                                │
│ │ 1 248         │ 89            │ 86 %          │ 7 j           │                                │
│ │ Entrées total │ Review overdue│ EN parity     │ Time-to-publi.│                                │
│ │ +14 ce mois   │ ⚠ -5 vs mois  │ +2 % vs mois  │ -1 j vs mois  │                                │
│ └───────────────┴───────────────┴───────────────┴───────────────┘                                │
│                                                                                                 │
│ Content gap matrix (type × domain)                                                              │
│ ┌─────────────────┬──────┬───────┬───────┬─────┬───────┬───────┬───────┐                        │
│ │                 │ Comm.│Techn. │ Légal │ RH  │Produit│Client │Veille │                        │
│ ├─────────────────┼──────┼───────┼───────┼─────┼───────┼───────┼───────┤                        │
│ │ Article         │ 47 ● │ 124 ● │  8 ○  │ 3 ⚠ │ 89 ●  │ 56 ●  │ 18 ◐  │                        │
│ │ Cas concret     │ 12 ● │  18 ● │  -    │ -   │ 23 ●  │  4 ⚠  │  -    │                        │
│ │ FAQ             │ 47 ● │  78 ● │ 12 ●  │ 6 ◐ │ 34 ●  │  -    │  -    │                        │
│ │ Glossaire       │  -   │  56 ● │ 14 ●  │ -   │ 21 ●  │  -    │  -    │                        │
│ │ Guide           │  3 ⚠ │   8 ◐ │  -    │ -   │  4 ◐  │  -    │  -    │                        │
│ │ Méthodologie    │  6 ● │  12 ● │  -    │ -   │  4 ◐  │  -    │  -    │                        │
│ └─────────────────┴──────┴───────┴───────┴─────┴───────┴───────┴───────┘                        │
│ Code :  ● ≥ 10  ◐ 3-9  ⚠ 1-2  ○ 0 (gap critique)                                                │
│                                                                                                 │
│ Listes actionnables                                                                             │
│  ⚠ Review overdue (89)                                  ⚠ Entrées sans cover image (34)        │
│    → "ADR 0007 typo v3-2"     overdue 142 j  [Réviser]    → "FAQ tarifs"          [Ajouter]    │
│    → "Cas concret Lyon PME"   overdue 78 j   [Réviser]    → "Glossaire RAG"       [Ajouter]    │
│    [Voir les 89]                                          [Voir les 34]                         │
│                                                                                                 │
│  ⚠ Entrées sans traduction EN (175)                    ⚠ Liens cassés détectés (7)             │
│    → "Article RAG vs fine-tuning" [Traduire]              → cassé dans "Guide IA PME" [Voir]    │
│    [Voir les 175]                                         [Voir les 7]                         │
│                                                                                                 │
│  Top 10 entrées (vues 30 j)                            Tags orphelins (12)                      │
│    1. IA pour PME — bilan 12 mois     12 487            → "vendor-lock-in" (0 entrées)         │
│    2. Comparatif RAG vs fine-tuning    8 234            → "kanban" (0 entrées)                 │
│    [...]                                                [Fusionner / supprimer]                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 `/connaissances/medias`

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ← Connaissances › Bibliothèque médias                            [+ Upload (drag-drop OK)]      │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 🔍 [recherche fichier, alt, caption ...]      Tri ▼ [Date upload ↓]                            │
│ Filtres : Type [Tous ▼ image|doc|svg] Auteur upload [Tous ▼] Usage [Utilisé / Orphelin >30j]   │
│                                                                                                 │
│ Grid responsive (5 cols desktop, 2 mobile)                                                      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                                   │
│  │ thumb   │ │ thumb   │ │ thumb   │ │ thumb   │ │ thumb   │                                   │
│  │ 320×180 │ │ 320×180 │ │ 320×180 │ │ 320×180 │ │ 320×180 │                                   │
│  │  AVIF   │ │  AVIF   │ │ doc PDF │ │  AVIF   │ │ orphan! │                                   │
│  ├─────────┤ ├─────────┤ ├─────────┤ ├─────────┤ ├─────────┤                                   │
│  │hero-pme.│ │graph-roi│ │guide.pdf│ │photo-mn │ │stale.jpg│                                   │
│  │245 KB   │ │ 87 KB   │ │ 3.2 MB  │ │ 124 KB  │ │ ⚠ 31 j  │                                   │
│  │alt ✓   │ │alt ✓   │ │ —       │ │alt ✓   │ │alt ⚠    │                                   │
│  │usage:14 │ │usage:8  │ │usage:2  │ │usage:6  │ │usage:0  │                                   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘                                   │
│                                                                                                 │
│ Footer info bar                                                                                 │
│   1 247 assets · 12.4 GB total · 23 orphelins > 30 j  [Garbage collect en attente confirmation]│
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.4 `/connaissances/imports`

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ← Connaissances › Imports                                                                       │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Wizard nouvel import (3 étapes)                                                                 │
│                                                                                                 │
│ Étape 1 — Source                                                                                │
│   ○ Markdown — `_AUDIT/*.md` (parse frontmatter YAML)                                          │
│   ○ Markdown Git (dossier local + commit ref)                                                  │
│   ○ Notion (API officielle, OAuth requis)                                                      │
│   ○ Google Docs (V1.5)                                                                          │
│   ○ Fichier JSON / CSV (export précédent)                                                       │
│                                                                                                 │
│ Étape 2 — Mapping fields                                                                        │
│   ┌─ Champs source détectés ───────┬─ Champ cible KB ────────────┬─ Préview ───┐               │
│   │ frontmatter.title              │ translation.title ▼          │ "IA et PME" │               │
│   │ frontmatter.date               │ publishedAt ▼                │ 2025-12-14  │               │
│   │ frontmatter.tags               │ tags[] ▼                     │ [rag, pme]  │               │
│   │ frontmatter.author             │ author ▼ (mapping table)     │ Manon       │               │
│   │ body                           │ translation.bodyJson ▼ (auto-conv MD → TT)│ <preview>   │  │
│   │ frontmatter.status             │ status ▼ (default: draft)    │ draft       │               │
│   └────────────────────────────────┴──────────────────────────────┴─────────────┘               │
│                                                                                                 │
│ Étape 3 — Dry run + commit                                                                      │
│   Lot de 47 fichiers détectés.                                                                  │
│   ✓ 42 nouvelles entrées                                                                        │
│   ⚠ 5 collisions de slug (suffixe -2/-3 auto)                                                   │
│   ⓘ Tous en status='draft' (jamais publié direct).                                              │
│   [Lancer dry-run]                                                                              │
│   [Importer (47) →]                                                                             │
│                                                                                                 │
│ Historique des batches                                                                          │
│   Batch kbib_9x3 · 47 entrées · Manon · 12/05 14:32 · ✓ done    [Voir détails] [Rollback]      │
│   Batch kbib_8m1 · 12 entrées · Will  · 10/05 09:17 · ⚠ partial [Voir détails]                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.5 `/connaissances/etiquettes`

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ← Connaissances › Étiquettes (tags)                                  [+ Nouveau tag]            │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 🔍 [recherche tag ...]                          Tri ▼ [Usage ↓] [A→Z] [Récents]                 │
│ Filtres : Statut [Tous] [Approuvé] [En attente] [Orphelin]                                      │
│                                                                                                 │
│ ┌─────────────────────────┬────────┬──────────┬──────────┬─────────────────┐                    │
│ │ Tag (slug + label FR/EN)│ Usage  │ Domaine  │ Statut   │ Actions          │                    │
│ ├─────────────────────────┼────────┼──────────┼──────────┼─────────────────┤                    │
│ │ ia-pour-pme / AI for SMB│ 87     │ Commerc. │ Approuvé │ [✎] [Fusionner] │                    │
│ │ rag / RAG               │ 54     │ Technique│ Approuvé │ [✎] [Fusionner] │                    │
│ │ automatisation / auto.  │ 178    │ Technique│ Approuvé │ [✎] [Fusionner] │                    │
│ │ vendor-lock-in          │ 0      │ -        │ Orphelin │ [✎] [Supprimer] │                    │
│ │ kanban                  │ 0      │ -        │ Orphelin │ [✎] [Supprimer] │                    │
│ └─────────────────────────┴────────┴──────────┴──────────┴─────────────────┘                    │
│                                                                                                 │
│ Fusion (mass-action)                                                                            │
│   Sélectionner 2+ tags → bouton [Fusionner...] → choisir tag canonique → confirm                │
│   Effet : toutes les entrées re-pointées sur le canonique, slug history créé, audit log.        │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.6 `/connaissances/auteurs`

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ← Connaissances › Auteurs                                            [+ Nouvel auteur]          │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Liste (4 cards par ligne, responsive)                                                           │
│                                                                                                 │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐                         │
│  │  ◯ avatar 96       │  │  ◯ avatar 96       │  │  ◯ avatar 96       │                         │
│  │  Manon             │  │  Will              │  │  Équipe Axion-IA   │                         │
│  │  Consultante IA    │  │  Fondateur Axion-IA│  │  (multi-author)    │                         │
│  │  612 entrées       │  │  234 entrées       │  │  312 entrées       │                         │
│  │  EN parity 94 %    │  │  EN parity 78 %    │  │  EN parity 92 %    │                         │
│  │  [Éditer profil →] │  │  [Éditer profil →] │  │  [Éditer profil →] │                         │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘                         │
│                                                                                                 │
│ Note doctrine : auteur canonique public = Manon (cf. master content-gen). Will = auteur ADR/   │
│ doctrine interne. Pas d'auteur fictif (anti-pattern E-E-A-T §0.0/22).                          │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Édition auteur (`/connaissances/auteurs/[authorId]`) :

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ← Auteurs › Manon                                                                               │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Avatar [upload AVIF/WebP, 512×512 min]   Nom * [Manon]   Slug [manon]                          │
│ Rôle public * [Consultante IA opérationnelle ▼]                                                 │
│ Bio FR (200 mots max, markdown léger autorisé)                                                  │
│   ┌──────────────────────────────────────────────────────────────────────────────────────────┐ │
│   │ Consultante IA chez Axion-IA depuis 2024. Spécialisée dans l'intégration de l'IA dans... │ │
│   └──────────────────────────────────────────────────────────────────────────────────────────┘ │
│ Bio EN (parity)                                                                                 │
│ Liens (E-E-A-T) :                                                                               │
│   LinkedIn [https://www.linkedin.com/in/...]                                                    │
│   Site perso [https://...]                                                                      │
│ Schema.org Person — preview JSON-LD                                                             │
│ [Sauvegarder]   [Voir page publique /fr/equipe/manon]                                           │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.7 `/connaissances/files-attente-revue`

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ← Connaissances › File d'attente de revue                                                       │
│ 12 entrées à réviser · Tri par urgence (overdue d'abord)                                        │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ ⚠ Overdue 142 j  │ ADR 0007 typography hierarchy v3-2                                       │ │
│ │ Reviewer: Will   │ Type: ADR · Audience: team · Domain: editorial                          │ │
│ │ Soumis: 2025-12-22 par Manon                                       [Réviser] [Réassigner]  │ │
│ ├────────────────────────────────────────────────────────────────────────────────────────────┤ │
│ │ ⚠ Overdue 78 j   │ Cas concret PME Lyon — gain RH automatisation                            │ │
│ │ Reviewer: Will   │ Type: case_study · Audience: public · Domain: commercial                │ │
│ │ Soumis: 2026-02-25 par Manon                                       [Réviser] [Réassigner]  │ │
│ ├────────────────────────────────────────────────────────────────────────────────────────────┤ │
│ │ 🟡 Due 3 j       │ Article : Le mythe du « no-code IA »                                     │ │
│ │ Reviewer: Manon  │ Type: article · Audience: public · Domain: technical                    │ │
│ │ Soumis: 2026-05-08 par Will                                        [Réviser] [Réassigner]  │ │
│ └────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                                 │
│ Bulk actions                                                                                    │
│   ☐ tout · 0 sélectionné · [Réassigner reviewer] [Escalader Will]                              │
│                                                                                                 │
│ Notifications                                                                                   │
│   Email + Telegram (PII redacted) + badge in-app envoyés à T+0 et T+48h overdue.               │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.8 `/connaissances/parametres`

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ← Connaissances › Paramètres KB                                                                 │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ⚠ Ces paramètres surchargent les valeurs SSOT `src/content/knowledge/*.ts` à l'exécution.       │
│ Cible : ajustement opérationnel sans deploy. Stockage : table `Setting` (existante).           │
│                                                                                                 │
│ Seuils Quality Score (par type)                                                                 │
│   Article         min publish [60 ▼/100]   Méthodologie   [70 ▼/100]                            │
│   Case study      [70 ▼/100]                Doctrine       [75 ▼/100]                            │
│   FAQ             [50 ▼/100]                ADR            [70 ▼/100]                            │
│   Glossaire       [40 ▼/100]                Guide          [80 ▼/100]                            │
│                                                                                                 │
│ Review windows (durée avant `reviewDueAt`)                                                      │
│   Article         [365 j ▼]    Méthodologie   [180 j ▼]                                         │
│   Case study      [365 j ▼]    Doctrine       [180 j ▼]                                         │
│   FAQ             [180 j ▼]    ADR            [365 j ▼]                                         │
│   Glossaire       [730 j ▼]    Guide          [365 j ▼]                                         │
│                                                                                                 │
│ Autosave debounce                                                                               │
│   Délai (ms) [2000 ▼]   Indicator visible [✓ Oui]   Aria-live polite [✓ Oui]                   │
│                                                                                                 │
│ Feature flags                                                                                   │
│   ☐ Embeddings V1.5 actifs (pgvector requis)                                                    │
│   ☐ Auto-suggestions admin (related/tags)                                                       │
│   ☑ Slash menu Tiptap                                                                           │
│   ☑ Newsletter auto-pickup sur publish                                                          │
│   ☑ IndexNow ping sur publish                                                                   │
│   ☐ Preview tokens partageables                                                                 │
│                                                                                                 │
│ Audit log destination                                                                           │
│   ◉ ActivityLog (table existante)                                                               │
│   ☐ Sentry breadcrumb additionnel                                                               │
│                                                                                                 │
│ [Sauvegarder] (audit log + revalidate config)                                                   │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. ÉDITEUR TIPTAP — CONFIG ÉTENDUE V1

### 6.1 État actuel (`src/components/admin/TiptapEditor.tsx`)

| Capability                                                     | Status | Notes                          |
| -------------------------------------------------------------- | ------ | ------------------------------ | ----- | ---------------------------------- |
| StarterKit (bold/italic/h1-h6/lists/blockquote/code/strike/hr) | ✅ V0  | Présent.                       |
| Triple-persistance `${name}\_html                              | \_json | \_text`                        | ✅ V0 | Sprint 24 / C4. Conservé tel quel. |
| `immediatelyRender: false` SSR-safe                            | ✅ V0  | OK Tiptap v3.                  |
| Image inline                                                   | ❌     | À ajouter.                     |
| Link mark                                                      | ❌     | À ajouter.                     |
| Placeholder                                                    | ❌     | À ajouter.                     |
| Callout custom                                                 | ❌     | À créer (extension node).      |
| CodeBlockLowlight + language picker                            | ❌     | À ajouter.                     |
| Slash menu `/`                                                 | ❌     | À créer (extension).           |
| Autosave debounce                                              | ❌     | À ajouter (state + indicator). |
| Raccourcis clavier (Cmd+S, Cmd+P, Cmd+Shift+P)                 | ❌     | À ajouter (keymap).            |
| Tables                                                         | ❌     | V2+.                           |
| Mentions / @auteur                                             | ❌     | V2+.                           |
| Collaboration (Y.js)                                           | ❌     | V2+.                           |

### 6.2 Extensions à installer (Sprint KB-3)

À instruire au Sprint KB-3 via `pnpm add` (jamais en Phase A) :

```
@tiptap/extension-link@^3
@tiptap/extension-image@^3
@tiptap/extension-placeholder@^3
@tiptap/extension-code-block-lowlight@^3
@tiptap/suggestion@^3                # slash menu base
lowlight@^3                           # syntax highlighting (déjà transitive ?)
```

Dépendances natives possibles : `dompurify` (V2+, pour sanitization client si jamais utilisée — V1 = SSR sanitization uniquement, voir `src/lib/knowledge/tiptap-sanitize.ts`).

### 6.3 Extensions custom à créer

| Extension            | Type                         | But                                                                                                              | Fichier proposé                                       |
| -------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `CalloutNode`        | Block node                   | Encadré contenu (info / warning / cta). Variant `kind` enum.                                                     | `src/lib/knowledge/tiptap-extensions/callout-node.ts` |
| `SlashMenuExtension` | Extension `Suggestion`-based | `/` ouvre menu commandes (h2, h3, image, callout, code, FAQ-item, glossary-ref, related-link, citation, divider) | `src/lib/knowledge/tiptap-extensions/slash-menu.ts`   |
| `AutosaveExtension`  | Extension event-listener     | Debounce 2 s + invoque `saveDraftAction`                                                                         | `src/lib/knowledge/tiptap-extensions/autosave.ts`     |
| `KeymapKbExtension`  | Keymap                       | `⌘S` save, `⌘P` preview, `⌘⇧P` publish, `⌘K` open link dialog                                                    | `src/lib/knowledge/tiptap-extensions/keymap.ts`       |

Toutes whitelistées côté SSR sanitize (`src/components/knowledge/shared/tiptap-extensions.ts`).

### 6.4 Wrapper `EntryEditor.tsx` (décision étendre vs dupliquer)

**Décision** : étendre via wrapper. Le `TiptapEditor.tsx` existant garde sa signature minimaliste (utilisé par `BlogForm`, `CaseStudyForm`, `HelpForm` — legacy). Le wrapper `EntryEditor.tsx` (sous `src/components/knowledge/admin/`) compose l'éditeur avec :

```
EntryEditor
  ├── TiptapEditor (réutilisé, signature inchangée)
  ├── EntryEditorToolbar (top sticky, status + actions principales)
  ├── EntryEditorAutosave (state machine triple)
  ├── EntryEditorSlashMenu (overlay)
  ├── MediaPicker (modal interne, ouvert depuis toolbar)
  └── extensions augmentées passées via props à TiptapEditor
```

Refactor mineur de `TiptapEditor.tsx` requis Sprint KB-3 :

- Accepter `extensions: Extension[]` en prop (additif sur StarterKit).
- Accepter `onUpdate(payload)` callback externe (en plus du bind hidden inputs).
- Conserver `immediatelyRender: false`, conserver les 3 hidden inputs (cohérence form existant).

Aucun changement de signature pour `BlogForm`/`HelpForm`/`CaseStudyForm` legacy.

---

## 7. PATTERN AUTOSAVE — DÉTAIL

### 7.1 État machine

```
                ┌─────────┐  user édite   ┌──────────┐  debounce 2s   ┌──────────┐
                │  Idle   │ ────────────► │  Dirty   │ ─────────────► │  Saving  │
                └─────────┘               └──────────┘                └──────────┘
                     ▲                          │                          │
                     │                          │ user édite encore        │ success
                     │ success                  ▼                          │
                     │                     ┌──────────┐                    │
                     │                     │  Dirty   │ ◄──────────────────┘
                     │                     │ (queued) │                    │ fail
                     │                     └──────────┘                    ▼
                     │                                                ┌──────────┐
                     └─────────────── retry success ─────────────────│   Error  │
                                                                      └──────────┘
                                                                            │
                                                                            │ retry / manual
                                                                            ▼
                                                                       (back to Saving)
```

### 7.2 Indicator UI (top right de l'éditeur)

| État                        | Affichage                                                    | Couleur    | ARIA                    |
| --------------------------- | ------------------------------------------------------------ | ---------- | ----------------------- |
| Idle (initial / loaded)     | `Sauvegardé · 14:32:18`                                      | gris clair | `aria-live="polite"`    |
| Dirty (en attente debounce) | `Modifié · sauvegarde dans 1 s…`                             | gris       | idem                    |
| Saving                      | `💾 Sauvegarde…` + spinner discret                           | terracotta | idem                    |
| Saved (transition)          | `✓ Sauvegardé · à l'instant` (puis fade vers Idle après 3 s) | vert       | idem                    |
| Error                       | `⚠ Échec sauvegarde — réessayer` + bouton [Retry]            | rouge      | `aria-live="assertive"` |

ARIA détails :

- L'indicator est dans un `<span role="status" aria-live="polite">` (sauf Error qui passe en `assertive`).
- Ne pas crier à chaque save (Idle reste silencieux après transition de Saved).
- `prefers-reduced-motion` respecté : pas de pulse spinner si activé.

### 7.3 Action serveur

```
saveDraftAction(formData) — `'use server'`
  ├── Zod parse {entryId, locale, bodyJson, bodyText, bodyHtml, titleFr?, slugFr?}
  ├── auth() session require role >= EDITOR + ownership check
  ├── Prisma transaction :
  │     - Update KnowledgeTranslation latest WIP (status WIP, pas review)
  │     - Insert KnowledgeVersion immutable (numéro auto-incrément)
  │     - ActivityLog event 'kb.draft_saved' (granularité haute, throttle batch ?)
  └── return {ok: true, savedAt: Date, version: number}
```

Note throttle : à 2 s de debounce, un éditeur actif peut générer 1 800 saves / heure / utilisateur. Sprint KB-4 doit décider si chaque save = 1 version immutable (coût stockage) OU bundling toutes les N minutes (perte granularité). **STOP & ASK Will** §14.

---

## 8. RACCOURCIS CLAVIER

| Raccourci              | Action                                                              | Scope                          |
| ---------------------- | ------------------------------------------------------------------- | ------------------------------ |
| `⌘S` / `Ctrl+S`        | Force save now (cancel debounce + flush)                            | Éditeur Tiptap focus           |
| `⌘P` / `Ctrl+P`        | Ouvre l'aperçu (`/[id]/apercu` dans nouvel onglet, target `_blank`) | Page édition                   |
| `⌘⇧P` / `Ctrl+Shift+P` | Publier (déclenche workflow → confirm modal)                        | Page édition, role >= OWNER    |
| `⌘K` / `Ctrl+K`        | Insère ou édite un lien sur la sélection                            | Éditeur Tiptap                 |
| `/`                    | Ouvre le slash menu                                                 | Éditeur Tiptap, début de ligne |
| `⌘B` `⌘I` `⌘U`         | Bold / Italic / Underline (StarterKit, déjà OK)                     | Éditeur Tiptap                 |
| `Tab` / `Shift+Tab`    | Indent / outdent dans listes                                        | Éditeur Tiptap                 |
| `Esc`                  | Ferme slash menu, MediaPicker, ou drawer diff version               | Tout overlay                   |
| `←` / `→` (entre tabs) | Switch onglet précédent / suivant                                   | Tabs header                    |
| `?`                    | Ouvre une cheat-sheet des raccourcis (modal)                        | Page édition                   |

Implémentation : `KeymapKbExtension` Tiptap pour les raccourcis intra-éditeur. `useEffect` listener page-level pour `⌘S`/`⌘P`/`⌘⇧P` (cancellés sur platform browser default print/save uniquement quand focus dans la zone édition Tiptap).

**A11y note** : tous raccourcis documentés dans `?` modal accessible par bouton visible UI + keyboard `?`. Pas de raccourci à 1-key non-modifier en dehors de l'éditeur (évite collision avec lecteur d'écran).

---

## 9. SLASH MENU — CATALOGUE DE COMMANDES

```
/   →  ┌──────────────────────────────────────────┐
       │ Insérer...                               │
       ├──────────────────────────────────────────┤
       │ 📄 Titre H2                              │
       │ 📄 Titre H3                              │
       │ 📄 Titre H4                              │
       │ 📋 Liste à puces                         │
       │ 📋 Liste numérotée                       │
       │ ❝  Citation                              │
       │ 💡 Callout — info                        │
       │ ⚠ Callout — avertissement                │
       │ 🎯 Callout — CTA (réserver / contact)    │
       │ < > Bloc code (langue: …)                │
       │ 🖼 Image (bibliothèque ou upload)         │
       │ 🔗 Lien                                  │
       │ ❓ FAQ block (Q+R)                        │
       │ 📖 Référence glossaire                    │
       │ 🔁 Entrée liée (related entry)            │
       │ 📚 Citation source                        │
       │ ─  Séparateur                            │
       │ ▶ Embed YouTube/Vimeo (whitelist)         │
       └──────────────────────────────────────────┘

Filtre dynamique : `/cal` → "Callout info, Callout cta, Callout warning"
Sélection : ↑/↓ navigation, Enter confirm, Esc close, click souris OK.
```

---

## 10. CONVENTIONS A11Y SPÉCIFIQUES

| Zone               | Convention                                                                      | Source          |
| ------------------ | ------------------------------------------------------------------------------- | --------------- | ---- |
| Tabs édition       | `role="tablist"` + `role="tab"` + `aria-controls` + `aria-selected`             | WCAG 2.2 AA     |
| Indicator autosave | `role="status"` + `aria-live="polite"` (assertive sur Error)                    | §7.2            |
| Bouton publier     | Confirm modal (jamais publish 1-clic sans guard, doctrine §0.1/10)              | Doctrine prompt |
| Editor Tiptap      | `aria-label="Éditeur de contenu : [titre entrée]"` (déjà partiellement présent) | Existant        |
| Slash menu         | `role="listbox"` + `aria-activedescendant`                                      | WCAG            |
| Diff versions      | Split view sémantique `<ins>` / `<del>` (pas couleur seule)                     | A11y            |
| Bulk select        | Master checkbox `aria-controls` + indeterminate state                           | A11y            |
| Facettes liste     | Chips = `<button aria-pressed="true                                             | false">`        | A11y |

Audit Axe automatisé via Playwright tag `@a11y` (Sprint KB-10 + KB-18).

---

## 11. DÉCISIONS TRANCHÉES PAR CET AGENT (RECOMMANDATIONS)

| #   | Décision                                                                           | Verdict                                                                                | Justification                                                                       |
| --- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| D1  | Étendre `TiptapEditor.tsx` vs créer parallel `KnowledgeEditor.tsx`                 | **Étendre via wrapper** `EntryEditor.tsx` (refactor minor : extensions prop additive)  | Cohérence, DRY, signature legacy préservée.                                         |
| D2  | Convention dossier `admin-knowledge/` feature vs `knowledge/` module cross-cutting | **Module cross-cutting** `src/components/knowledge/{admin,public,client,shared}`       | KB sert 4 surfaces. Recommandation prompt §11.1.                                    |
| D3  | Drawer overlay vs page dédiée pour détail entrée + sous-pages                      | **Page dédiée systématique**                                                           | URL partageable, breadcrumb, state preserved, a11y mieux maîtrisée.                 |
| D4  | Preview mode iframe vs route SSR dédiée                                            | **Route SSR `/[id]/apercu`** + `EntryRenderer` partagé                                 | Anti-pattern iframe (CLS), fidélité 1:1 garantie.                                   |
| D5  | Edit tabs : rendre tous montés + display:none vs lazy mount par tab                | **Tous montés, display:none non-actif** (pattern existant `BlogForm`)                  | Préserve state form, pas de re-mount Tiptap, coût acceptable côté admin uniquement. |
| D6  | Autosave granularité (1 version / save vs bundling)                                | **STOP & ASK Will** (§14 Q3)                                                           | Trade-off coût DB vs traçabilité fine.                                              |
| D7  | i18n admin = FR uniquement                                                         | **FR only** (§9.1 doctrine)                                                            | Doctrine prompt. Pas de switcher locale admin.                                      |
| D8  | Slash menu position                                                                | **Inline anchor** (popover relatif au caret) avec fallback bottom-left si manque place | UX standard Notion/Linear.                                                          |
| D9  | Sticky toolbar top édition                                                         | **Oui**, scrollable au-delà du viewport                                                | Accès rapide save + actions principales.                                            |

---

## 12. ANTI-PATTERNS — RAPPELS POUR PHASE B

1. **Iframe preview** — CLS / hydration mismatch / focus trap fragile. Banni. Utiliser route SSR + `EntryRenderer.tsx` partagé.
2. **Éditeur sans autosave** — perte de contenu au moindre crash navigateur / nav inopinée. Bloquant V1.
3. **Perte de contenu sur navigation** — `beforeunload` guard si state dirty (`hasUnsavedChanges`) + modale "Voulez-vous quitter ?". Override possible via flag user.
4. **Drawer pour détail entrée** — URL non partageable, focus trap fragile. Banni.
5. **Wizard 5 étapes pour création** — un seul écran suffit (type + métadonnées + preview template).
6. **God-file `actions.ts`** — un fichier par action (`create-entry.ts`, `publish.ts`, …) dans `src/server/actions/knowledge/`.
7. **Dupliquer `TiptapEditor.tsx`** — DRY-cost trop élevé. Étendre via wrapper.
8. **Mélanger UX admin et UX public dans le même composant** — `EntryEditor` (admin client) ≠ `EntryRenderer` (public/admin preview SSR).
9. **String magique dans composants** — labels statuts, types, domaines, etc. via SSOT `src/content/knowledge/*.ts` uniquement.
10. **Tabs édition lazy-mount** — re-mount Tiptap = perte state intra-session. Préférer display:none.
11. **Bulk publish 1-clic sans confirm** — pour `>5` entrées, modale de confirmation obligatoire.
12. **Slash menu qui couvre le contenu** — popover positionné au-dessus de la ligne quand pas de place en dessous.
13. **Indicator autosave avec animation perpétuelle** — `prefers-reduced-motion` respecté, indicator se calme après transition Saved.
14. **Raccourci clavier non documenté** — `?` modal cheat-sheet obligatoire.
15. **Indicator d'erreur en `aria-live="polite"`** — erreurs critiques (save failed) doivent être `assertive` pour être annoncées immédiatement.

---

## 13. INVENTAIRE LIVRABLES FICHIERS (récap pour Sprint KB-3)

```
src/components/knowledge/admin/
  EntryListTable.tsx          # Table liste avec sort
  EntryListFilters.tsx        # Chips facettes + URL searchParams
  EntryListSearchBar.tsx      # FTS search + debounce
  EntryListBulkActions.tsx    # Bulk toolbar
  EntryListPagination.tsx     # Pagination
  EntryCreatePicker.tsx       # Wizard /nouvelle (type + métadonnées)
  EntryEditor.tsx             # Wrapper Tiptap + tabs
  EntryEditorToolbar.tsx      # Sticky top (status + actions)
  EntryEditorAutosave.tsx     # State machine + indicator
  EntryEditorSlashMenu.tsx    # Overlay slash commands
  EntryEditorKeymapHint.tsx   # Modal `?` cheat-sheet
  TabPanelContent.tsx         # Onglet Contenu
  TabPanelMetadata.tsx        # Onglet Métadonnées
  TabPanelRelations.tsx       # Onglet Relations
  TabPanelVersions.tsx        # Onglet Versions (+ diff drawer interne)
  TabPanelPublication.tsx     # Onglet Publication
  TabPanelRgpd.tsx            # Onglet RGPD
  TabPanelMedias.tsx          # Onglet Médias
  MediaPickerModal.tsx        # Modal asset library
  CalendarBoard.tsx           # /calendrier
  HealthDashboard.tsx         # /sante (cards + matrix + listes)
  AssetGrid.tsx               # /medias
  AssetUploader.tsx           # Upload drag-drop
  ImportWizard.tsx            # /imports (3 steps)
  TagsTable.tsx               # /etiquettes
  TagsMerger.tsx              # Action fusion
  AuthorsGrid.tsx             # /auteurs
  AuthorForm.tsx              # /auteurs/[id]
  ReviewerQueue.tsx           # /files-attente-revue
  KbSettingsForm.tsx          # /parametres

src/lib/knowledge/tiptap-extensions/
  callout-node.ts
  slash-menu.ts
  autosave.ts
  keymap.ts

src/app/[locale]/(admin)/[adminPrefix]/connaissances/
  page.tsx                          # liste
  loading.tsx                       # skeleton liste
  ConnaissancesListClient.tsx       # client wrapper
  nouvelle/page.tsx
  [id]/page.tsx                     # édition tabbed
  [id]/loading.tsx
  [id]/apercu/page.tsx              # preview SSR
  calendrier/page.tsx
  sante/page.tsx
  medias/page.tsx
  medias/[assetId]/page.tsx
  imports/page.tsx
  imports/[batchId]/page.tsx
  etiquettes/page.tsx
  auteurs/page.tsx
  auteurs/[authorId]/page.tsx
  files-attente-revue/page.tsx
  parametres/page.tsx
```

Effort estimé Sprint KB-3 (admin CRUD core, sans calendar/medias/imports/etiquettes/auteurs/review-queue/parametres déférés à KB-13/KB-11/KB-15/etc.) : **6-8 dj** = liste + create + édition tabbed + autosave + slash menu + raccourcis + preview.

---

## 14. STOP & ASK OUVERTS POUR WILL

1. **Q1 — Convention admin FR systématique ?** La doctrine prompt §9.1 dit "FR cohérent". On lance `/connaissances/` et les sous-routes en FR (`/calendrier`, `/sante`, `/medias`, `/imports`, `/etiquettes`, `/auteurs`, `/files-attente-revue`, `/parametres`). Confirmes-tu **strictement** ces noms FR (et pas un mix EN type `/categories/` legacy) ?

2. **Q2 — Strangler legacy admins** : on garde `/blog`, `/case-studies`, `/faq`, `/help`, `/categories` opérationnels en V1 (badge "legacy" UI). Coexistence stable jusqu'à V1.5 ou V2+ avant suppression. Confirmation ?

3. **Q3 — Autosave granularité versions** : à 2 s debounce, une heure d'édition active peut générer ~1 800 saves. Préfères-tu :
   - **(a) 1 version immutable par save** = traçabilité fine, coût DB élevé (à chiffrer Sprint KB-4)
   - **(b) Save WIP overwrite + version checkpoint toutes les 10 min** = bundling, moins de granularité
   - **(c) Save WIP overwrite + version checkpoint sur transition d'état (`draft→review`, `review→published`)** = très peu de versions, basique
     Recommandation reality check : **(b)** comme compromis.

4. **Q4 — Tab "Médias" intra-édition vs `/medias` global** : on garde **les deux** ? Le tab montre les assets de **cette** entrée (uploadés et inline). La page globale `/connaissances/medias` montre **tous** les assets. Confirmes-tu ce split ?

5. **Q5 — Preview tokens partageables 24-72h** : implementation Sprint KB-17 (`/api/kb-preview/[token]`). Quel canal de partage par défaut ? Email mailto: pré-rempli ? Copie de lien manuelle uniquement ? Aucun preview shareable V1 ?

6. **Q6 — Cheat-sheet `?` modal** : un bouton visible `(?)` icon dans le toolbar éditeur en plus du raccourci `?` ? Recommandation oui (a11y).

7. **Q7 — Slash menu vs toolbar buttons** : on garde les **deux** (toolbar buttons pour H2/H3/B/I/etc. + slash menu pour insertions avancées comme callout/FAQ/glossary-ref) ? Ou on bascule toolbar minimaliste + slash menu pour tout ? Recommandation reality check : **les deux** (toolbar pour la base, slash menu pour le riche).

8. **Q8 — Confirm modal sur publish** : doit-on demander **toujours** une confirmation modale avant publish (anti 1-clic accidentel), ou seulement si quality score < seuil OU EN parity incomplete OU PII flag actif ? Recommandation reality check : **toujours**, doctrine §0.1/10 ("publication = acte explicite").

---

## 15. RÉFÉRENCES

- Prompt master : `_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md` §11 (structure dossiers), §12.5 (routes admin FR), §0.0/3-13 (critères perfection admin), §0.1 (doctrine).
- Reality check : `_AUDIT/KNOWLEDGE-BASE-2026/00-REALITY-CHECK.md` §2 (admin existant), §9.3 (gaps Tiptap), §10.7 (Q7 namespace), §10.8 (Q8 pattern actions), §10.9 (Q9 pattern module).
- Code source inspiré : `src/components/admin/TiptapEditor.tsx` (StarterKit + triple persistance), `src/app/[locale]/(admin)/[adminPrefix]/blog/BlogForm.tsx` (tabs FR/EN + form pattern), `src/app/[locale]/(admin)/[adminPrefix]/help/HelpForm.tsx`, `src/app/[locale]/(admin)/[adminPrefix]/case-studies/CaseStudyForm.tsx`, `src/app/[locale]/(admin)/[adminPrefix]/faq/FAQForm.tsx`.
- Doctrine mémoires Will-équivalent : `axionia_naming_brand_vs_project` (FR-only admin), `axionia_doctrine_code_ssot` (code prime), `axionia_design_pivot` (terracotta), `axionia_hero_schema_v3_2` (hero layout enum), `axionia_perf_audit_2026-05-07` (view-transitions désactivées).

---

**Fin Agent 3 — Admin UI architecture.** Phase A audit-only. Aucune écriture de code applicatif. STOP & ASK Will sur les 8 questions §14 avant Sprint KB-3 (Phase B).
