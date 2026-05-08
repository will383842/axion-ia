# État d'implémentation Visual Rhythm Sprint A + B — 2026-05-07

> **Statut** : ✅ Livré · build production clean · zéro régression
> **Date** : 2026-05-07
> **Périmètre** : Sprint A (P0 critique) + Sprint B (P1 important) selon `AUDIT-VISUAL-RHYTHM-2026.md` v1.1

---

## ✅ Vérifications de bout en bout (toutes passées)

| Check             | Commande                | Résultat                                                                                                                        |
| ----------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript        | `pnpm typecheck`        | ✅ 0 erreur                                                                                                                     |
| ESLint            | `pnpm lint`             | ⚠️ 5 warnings **préexistants** (forms React Hook Form `watch()`) — non touchés par Sprint A/B, **aucune régression introduite** |
| Prettier          | `pnpm format:check`     | ✅ All matched files use Prettier code style                                                                                    |
| Vitest unit tests | `pnpm test`             | ✅ **96/96 tests passent** (16 test files)                                                                                      |
| Anti-hex linter   | `pnpm anti-hex:check`   | ✅ 0 hex hardcodé hors `globals.css`                                                                                            |
| WCAG contrast     | `pnpm contrast:check`   | ✅ 30 paires ≥ AA                                                                                                               |
| i18n              | `pnpm i18n:check`       | ✅ 223 keys in sync FR/EN                                                                                                       |
| use-client        | `pnpm use-client:check` | ✅ Every directive justified                                                                                                    |
| Radius tokens     | `pnpm radius:check`     | ✅ No functional radius > 8px                                                                                                   |
| Next.js build     | `pnpm build`            | ✅ **Build production complet réussi** — toutes les routes SSG générées (FR + EN)                                               |

**Aucune erreur, aucune régression. Le code est prêt à merger.**

---

## 📦 Composants créés (6 nouveaux)

| Fichier                                             | Type             | Rôle                                                                                                                                                  |
| --------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/visual/IllustrationPlaceholder.tsx` | Server Component | Placeholder éditorial palette terracotta soft + grille subtile + label slot ID + filename target. SSR pur.                                            |
| `src/components/visual/Illustration.tsx`            | Server Component | Wrapper auto : si `src` fourni → `next/image` AVIF/WebP. Sinon → `IllustrationPlaceholder`. Gère figure/figcaption.                                   |
| `src/components/sections/MethodologyHeroSchema.tsx` | Server Component | Flow vertical 4 étapes (Identifier → Auditer → Implémenter → Mesurer). Pattern doctrine `AuditHeroSchema`.                                            |
| `src/components/sections/DetailHeroSchema.tsx`      | Server Component | **Paramétrable** : props `accent` + `blocks[]` + `eyebrow` + `title`. Réutilisable sur sous-pages produit (`/interventions/{slug}`, `/audit/{slug}`). |
| `src/components/sections/ComparisonsHeroSchema.tsx` | Server Component | Triangle 3 pôles : Axion-IA centre + 2 alternatives (SaaS générique, internalisation). Doctrine comparaison neutre, pas de FUD.                       |
| `src/components/sections/HelpHeroSchema.tsx`        | Server Component | Constellation 6 thématiques d'aide (Démarrer · Souveraineté · Coûts & ROI · Cas d'usage · Formation · Intégration).                                   |

---

## 🔧 Patches infrastructure templates

| Fichier                                           | Patch                                                                                                                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/sections/ProductHero.tsx`         | Nouveau prop `heroSchema?: ReactNode` → layout 2-col automatique en lg+ quand fourni. Comportement 1-col historique préservé sinon.                                             |
| `src/components/sections/ProductPageTemplate.tsx` | Nouveau prop `heroSchema?: ReactNode` passé à `ProductHero`. **1 patch = 15 sous-pages améliorables** (interventions/{slug}, audit/{slug}, implementation/par-fonction/{slug}). |

---

## 📄 Pages patchées — 17 au total (Top 20 + sous-pages produit)

### Pages plain hero transformées en hero 2-col

| Page                  | Transformation                                                                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/methodologie` 🔴→🟢 | Layout 2-col + `MethodologyHeroSchema` à droite + nouvelle section « Pourquoi cette méthode » +300 mots avec mid placeholder + closing placeholder |
| `/comparaisons`       | Layout 2-col + `ComparisonsHeroSchema` (triangle 3 pôles) + mid placeholder `COMP-02-matrix` + CtaBlock final ajouté (manquait)                    |
| `/centre-aide`        | Layout 2-col + `HelpHeroSchema` (constellation 6) + mid placeholder `AIDE-01-hero`                                                                 |

### Pages plain hero avec placeholders ajoutés

| Page        | Placeholders                                          | Slot IDs                                |
| ----------- | ----------------------------------------------------- | --------------------------------------- |
| `/blog`     | hero                                                  | `BLOG-01-hero`                          |
| `/guide-ia` | hero + closing                                        | `GUIDE-01-hero` + `GUIDE-03-closing`    |
| `/a-propos` | mid (à côté valeurs lg:grid-cols-[3fr_2fr]) + closing | `APROPOS-02-mid` + `APROPOS-03-closing` |
| `/roi`      | hero + closing                                        | `ROI-01-sankey` + `ROI-02-closing`      |
| `/presse`   | hero                                                  | `PRESSE-01-hero`                        |

### Pages saines avec closing illustration ajouté (avant CtaBlock final)

| Page              | Slot ID                                     |
| ----------------- | ------------------------------------------- |
| `/` (home)        | `HOME-04-closing`                           |
| `/interventions`  | `INTERV-02-closing`                         |
| `/audit`          | `AUDIT-03-closing` (après BeyondAuditBlock) |
| `/stack-ia`       | `STACK-02-closing`                          |
| `/implementation` | `IMPL-03-closing`                           |
| `/cas-concrets`   | `CAS-02-mid`                                |

### Sous-pages produit (DetailHeroSchema injecté via slot heroSchema)

| Page                        | Accent  | Blocks                                                                                                                                                |
| --------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/interventions/dirigeants` | primary | Sunrise (matin · vision business) → Compass (midi · démos sur vos données) → ClipboardCheck (après-midi · plan d'action 90 jours)                     |
| `/interventions/equipes`    | primary | Users (matin · diagnostic métier) → Wrench (midi · atelier outils) → Sparkles (après-midi · plan d'autonomie)                                         |
| `/audit/strategique-pme`    | orange  | MapIcon (livrable A · cartographie complète) → TrendingUp (livrable B · scoring ROI/complexité) → ClipboardCheck (livrable C · plan chiffré priorisé) |

### Diversification iconographique

| Page             | Patch                                                                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `/audit` matcher | `Building2` ×3 → `Briefcase` (TPE) + `Building` (PME 10-49) + `Building2` (PME 50-249) + `Network` (ETI). Différenciation visuelle restaurée. |

---

## 🎨 Convention naming images (workflow Will)

Toutes les illustrations à générer via ChatGPT/OpenAI doivent être nommées selon :

```
public/illustrations/[page]-[slot].avif
public/portraits/[name].avif       (ex: portrait Will)
public/og/[page]-og.png             (1200×630 OG images)
```

**Workflow** :

1. Ouvrir `_AUDIT/gpt-image-prompts.md` → identifier prompt par slot ID (ex `METHO-01-hero`).
2. Copier préfixe brand Axion-IA + sujet du prompt → coller dans ChatGPT Plus (DALL-E 3) ou OpenAI playground (`gpt-image-1` API seed=42).
3. Drop l'image AVIF dans le bon dossier `public/illustrations/`.
4. Sur la page concernée, ajouter `src="/illustrations/[page]-[slot].avif"` à l'`<Illustration>` correspondante. Le placeholder disparaît automatiquement, layout préservé (paddingTop calculé selon aspectRatio).
5. Coût indicatif : ~$0.19/image en `gpt-image-1` high quality, ou $0 marginal sur ChatGPT Plus inclus.

**Recommandation** : commencer par `METHO-01-hero` comme **référence absolue**, valider le style avec Will, puis utiliser `gpt-image-1` mode `edit`/`variations` à partir de cette référence pour les 7 autres prompts P0.

---

## 📋 Reste à faire (Sprint C, optionnel)

Sprint C n'est PAS bloquant. Tout le Sprint A + B est livré et utilisable en l'état.

### Composants HeroSchema P2 (optionnel, peuvent réutiliser DetailHeroSchema)

- `BlogHeroSchema` (stack 3 articles récents) — peut réutiliser `DetailHeroSchema` paramétré
- `AboutHeroSchema` (timeline `ABOUT_TIMELINE` data déjà en place) — peut réutiliser `DetailHeroSchema`
- `PressHeroSchema` (stack 3 facts `PRESS_FACTS`) — peut réutiliser `DetailHeroSchema`
- `RoiHeroSchema` (2 curseurs miniatures) — composant dédié

### Sous-pages produit restantes (~6 pages, copier pattern dirigeants/equipes/strategique-pme)

- `/interventions/conference`, `/interventions/essentielle`, `/interventions/managers`
- `/audit/flash`, `/audit/process`, `/audit/strategique-eti`

### SEO image infrastructure (P2)

- Créer `buildImageObjectJsonLd` dans `src/lib/seo.ts` (signature `{ url, caption, width, height, locale, representativeOfPage }`)
- Créer `opengraph-image.tsx` per-page Top 5 via Next 16 `ImageResponse` SVG-rendered (réutilise les HeroSchema existants en background)
- Émettre `ImageObject` JSON-LD sur les pages avec HeroSchema

### Cleanup mineur

- Extraction `HomeHeroSchema.tsx` du SVG inline 400 LOC dans `src/app/[locale]/page.tsx`
- Supprimer 5 SVG démo Next.js (`file.svg`/`globe.svg`/`next.svg`/`vercel.svg`/`window.svg`) de `public/`
- Documenter convention stroke-width Lucide (default 2 / 2.25 module / 3 Check pill) dans `Design.md`

---

## 🧪 Comment vérifier soi-même

```powershell
cd C:\Users\willi\Documents\Projets\Axion-IA\axionia

# Tests rapides (< 1 min total)
pnpm typecheck
pnpm anti-hex:check
pnpm format:check
pnpm i18n:check
pnpm radius:check
pnpm contrast:check
pnpm use-client:check

# Tests longs (~1-2 min chacun)
pnpm test          # 96 unit tests vitest
pnpm build         # build Next.js production complet

# Visual check (lance dev server)
pnpm dev
# Visiter ensuite :
# http://localhost:3000/fr/methodologie  (transformation la plus visible 🔴→🟢)
# http://localhost:3000/fr/comparaisons   (HeroSchema triangle + CtaBlock final ajouté)
# http://localhost:3000/fr/centre-aide    (HeroSchema constellation 6)
# http://localhost:3000/fr/audit          (matcher diversifié + closing)
# http://localhost:3000/fr/interventions/dirigeants  (DetailHeroSchema timeline)
# http://localhost:3000/fr/blog · /guide-ia · /a-propos · /presse · /roi  (placeholders visibles)
```

---

## 📚 Documents associés

| Document                                                       | Rôle                                                                           |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `_AUDIT/PROMPT-VISUAL-RHYTHM-2026.md` v1.1                     | Spec d'audit source (Will)                                                     |
| `_AUDIT/AUDIT-VISUAL-RHYTHM-2026.md`                           | Rapport principal d'audit (synthèse + fiches prescriptives Top 20 + scénarios) |
| `_AUDIT/visual-inventory.md`                                   | Inventaire visuel détaillé (Agent A)                                           |
| `_AUDIT/heroschema-pattern-analysis.md`                        | Spec pattern HeroSchema gold standard + skeleton TS                            |
| `_AUDIT/benchmarks-visual-2026.md`                             | Benchmarks 10 sites externes (Agent B)                                         |
| `_AUDIT/visual-style-guide.md`                                 | Style guide imagerie unifié (Agent C)                                          |
| `_AUDIT/gpt-image-prompts.md`                                  | **53 prompts copy-paste** avec hex v3.1 EXACTS (Agent C)                       |
| `_AUDIT/visual-gaps-by-page.csv`                               | Matrice page × gap × priorité × prompt ID × effort                             |
| **`_AUDIT/IMPLEMENTATION-STATUS-2026-05-07.md`** (ce document) | **État d'implémentation Sprint A + B post-livraison**                          |

---

**Fin du document — implementation status 2026-05-07.**
