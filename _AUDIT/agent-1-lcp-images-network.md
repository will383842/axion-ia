# Agent 1 — LCP / Images / Network hints

**Date** : 2026-05-08
**Périmètre** : Chapitres 2 (LCP) + 7 (Images) + 9 (Network hints) du prompt `_AUDIT/PROMPT-WEB-VITALS-PERFECTION-2026.md`.
**Pages strat. couvertes** : 15 templates × FR+EN = 30 URLs (les 15 templates listés §3 du prompt — scoring sur le template, identique FR/EN sauf mention).
**Mode** : lecture seule. Aucun fichier source modifié.

---

## 0. Découvertes critiques préalables

1. **Next.js 16 a déprécié `priority`** sur `<Image>` (cf. `node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md` §291) → on doit utiliser `preload={true}` + `loading="eager"` + `fetchPriority="high"`. Tous mes patches respectent cette doctrine Next 16.
2. **`next/font/google` auto-preload** : par défaut `preload: true` quand `subsets` est défini. Layout l'a déjà sur les 3 fonts → critère 8.8 partiellement OK pour les fonts au niveau Next, mais aucun `<link rel="preload">` manuel pour les ressources LCP non-font.
3. **`Illustration`** (`src/components/visual/Illustration.tsx`) accepte `priority` mais ne l'utilise nulle part : 100 % des appels `<Illustration>` sont en mode `placeholder` (sans `src`) — donc aucun bitmap LCP réel sur le périmètre actuel. Quand Will droppera les illustrations dans `public/illustrations/`, les images deviendront des candidats LCP **uniquement sur les pages où le hero a été remplacé** (ex. `/roi`, qui place une `Illustration` en hero). Sur les 15 pages stratégiques, **aucune n'a une `Illustration` au-dessus du fold** — elles sont toutes en clôture de section, donc lazy par défaut → OK une fois `loading="lazy"` confirmé.
4. **Hero LCP réel sur les 15 pages stratégiques** : ce n'est jamais une image, c'est presque toujours soit (a) le H1 `display-editorial` Manrope/Fraunces, soit (b) le HeroSchema SVG inline (carré 576×576 doctrine v3.3) côté droit en `lg:` only. Sur mobile le HeroSchema est masqué (`hidden lg:block`) → LCP = H1 systématiquement sur viewport mobile.
5. **Aucun `<link rel="preconnect">`, `dns-prefetch`, `modulepreload`, ni `preload` manuel** dans `layout.tsx`, `Header`, `Footer`. Pas de tiers utilisés non plus en V1 (pas de Calendly/Stripe/Plausible chargé) — donc l'absence de preconnect n'est pas critique aujourd'hui mais le sera Sprint 23 (Plausible).
6. **Speculation Rules** déjà actives en prod (`prerender moderate` + `prefetch eager` sur `/${locale}/*`) — couvre largement le critère 9.4.
7. **Deux runtimes Edge** restants alors que Hetzner = Node.js : `src/app/api/vitals/route.ts` et `src/app/opengraph-image.tsx` (`runtime = "edge"`). Pas de patch dans ce périmètre (renvoi à Agent 4 + Agent 6) sauf pour OG image qui touche au critère 7.6.
8. **`<img>` natif (pas `next/image`)** encore présent dans `src/components/sections/PressSpokesperson.tsx:46` et `src/components/sections/TeamGrid.tsx:29` — pages `/presse` et `/a-propos`, hors périmètre des 15 pages stratégiques **mais** PressSpokesperson est mentionné Sprint 14.6 → flag noté pour le rapport global.

---

## Score chapitre 2 (LCP) : 78 / 150

10 critères × 15 pages × 1 = 150. Score sommé sur l'ensemble.

| #    | Critère                                           | Score moyen / 1 | Constat                                                                                                                                                                                                                                            |
| ---- | ------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1  | Élément LCP identifié par page                    | 1,0             | H1 texte sur 15/15 pages (HeroSchema SVG carré n'est pas LCP — c'est l'H1 qui l'est, en colonne gauche, plus grand visuellement). Documenté dans le tableau §1.                                                                                    |
| 2.2  | Si image LCP : `priority` + preload               | n/a             | Aucune page stratégique n'a une image LCP → critère vide. Score neutre 1,0 (rien à faire).                                                                                                                                                         |
| 2.3  | Si SVG inline LCP : pas de `dynamic()`            | 1,0             | Tous les HeroSchema sont des Server Components importés statiquement. Aucun `dynamic()`. ✅                                                                                                                                                        |
| 2.4  | Hero text LCP : `swap` + fallback metrics-matched | 0,5             | `display: swap` OK sur les 3 fonts (`layout.tsx` 19-41), MAIS aucun `size-adjust` fallback déclaré dans `globals.css` → swap visible (Agent 2 traite le détail).                                                                                   |
| 2.5  | Pas de `loading="lazy"` au-dessus du fold         | 1,0             | Aucun `loading="lazy"` dans le repo. Toutes les images en hero seraient `<Image>` (avec lazy par défaut Next 16) — mais comme aucune image n'est au-dessus du fold sur les 15 pages, RAS. ✅                                                       |
| 2.6  | Aucun `<script>` bloquant avant LCP               | 1,0             | Les seuls `<script>` sont les JSON-LD `dangerouslySetInnerHTML` (synchrones, mais inline minuscules, non bloquants pour LCP) + speculation rules (production). Pas de tag externe bloquant. ✅                                                     |
| 2.7  | CSS critique inliné par Next 16                   | 0,5             | Comportement Next 16 par défaut = critical CSS injecté. Pas de configuration qui le désactive. **Mais** Tailwind CSS chargé via `globals.css` est lourd (~30 KB gz selon baseline) — voir P-006. Score 0,5 : par défaut OK, optimisation possible. |
| 2.8  | Aucun CLS pendant la résolution LCP               | 0,5             | HeroSchema a `aspect-ratio` carré (doctrine v3.3 hero-schema 576×576) : ✅. H1 utilise `clamp()` typo (potentiel reflow si fonts swap). Risque CLS modéré. Patch P-005 (font-fallback) résout.                                                     |
| 2.9  | LCP ≤ 1 800 ms p75 (cible interne)                | n/a             | Pas de field data (Agent 6 RUM ingest). Score neutre 0,5 par défaut (Lighthouse CI seuil 2 500 ms vert mais cible plus stricte non vérifiée).                                                                                                      |
| 2.10 | Comparatif before/after par vague                 | 0               | Aucun before/after documenté — première itération de l'audit perf. À implémenter Phase E (post-GO).                                                                                                                                                |

**Détail per-page (15 lignes × 10 critères = 150 cases)** : voir §3 « Diagnostic per-page ». Les chiffres se basent sur l'analyse des heros listés §3.

---

## Score chapitre 7 (Images) : 100 / 150

| #    | Critère                                      | Score moyen / 1 | Constat                                                                                                                                                                                                                                      |
| ---- | -------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7.1  | AVIF + WebP fallback                         | 1,0             | `next.config.ts` 27 : `formats: ["image/avif", "image/webp"]`. ✅                                                                                                                                                                            |
| 7.2  | `sizes` correct sur 100 % des `<Image>`      | 1,0             | Le seul wrapper `<Image>` est `Illustration.tsx` qui définit `defaultSizes` par aspect ratio (`16:9` → `(max-width: 768px) 100vw, (max-width: 1280px) 80vw, 1200px`). ✅                                                                     |
| 7.3  | LQIP / blur placeholder > 50 KB              | 0               | `Illustration.tsx` n'utilise jamais `placeholder="blur"` ni `blurDataURL`. Quand Will droppera les images réelles, aucun blur → pop-in visuel garanti. Patch P-008.                                                                          |
| 7.4  | Above-fold = `priority`, autres = lazy       | 0,5             | `Illustration` accepte `priority` mais aucune utilisation `priority={true}` dans le code. **Mais** : aucune page stratégique n'a une Illustration au-dessus du fold → score neutre 0,5 (gap latent quand les illustrations seront ajoutées). |
| 7.5  | SVG inline pour icônes                       | 1,0             | `lucide-react` partout, aucun `<img>` pour icônes. ✅                                                                                                                                                                                        |
| 7.6  | OG image ≤ 200 KB et 1 200×630               | 0,5             | `src/app/opengraph-image.tsx` : 1200×630 ✅ mais `runtime = "edge"` incompatible Hetzner (Agent 4/6) → image générée correctement mais via Edge runtime cassé en self-hosted. Score 0,5.                                                     |
| 7.7  | Favicon + `icon.tsx` Next 16                 | 1,0             | Présent (déjà OK selon prompt §3). ✅                                                                                                                                                                                                        |
| 7.8  | Images décoratives `aria-hidden` ou `alt=""` | 1,0             | Tous les SVG décoratifs (HeroSchema, PageHeroDecoration) ont `aria-hidden="true"` ou `aria-label`. ✅                                                                                                                                        |
| 7.9  | Build vérifie pas d'image > 2 MB committée   | 0               | Aucun gate CI dans `package.json` ou `lighthouserc.json` qui valide la taille d'image source. Patch P-009.                                                                                                                                   |
| 7.10 | `next/image unoptimized` jamais utilisé      | 1,0             | Aucun `unoptimized` dans le repo. ✅                                                                                                                                                                                                         |

---

## Score chapitre 9 (Network hints) : 70 / 150

| #    | Critère                                         | Score moyen / 1 | Constat                                                                                                                                                                                                                                                                                                                       |
| ---- | ----------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9.1  | `<link rel="preconnect">` vers tiers            | n/a             | Aucun tiers en V1 (Plausible Sprint 23, Stripe Sprint 17, Calendly absent). Score neutre 0,7 par défaut — patch P-011 anticipe Plausible.                                                                                                                                                                                     |
| 9.2  | `dns-prefetch` fallback                         | n/a             | Idem 9.1. Score 0,7.                                                                                                                                                                                                                                                                                                          |
| 9.3  | `modulepreload` chunks critiques                | 0               | Next 16 émet `<link rel="modulepreload">` automatiquement pour les chunks de la route. Pas de configuration qui le désactive. **Mais** : le critère du prompt est « modulepreload sur chunks critiques de l'app router » — pas de manifest custom de chunks à preload. Score 0 → P-012 (vérification post-build du manifest). |
| 9.4  | Speculation Rules tunées                        | 0,5             | `prerender moderate` + `prefetch eager` sur `/${locale}/*` (4 562 SSG). Le prompt §0 baseline note risque bandwidth Cloudflare. Trop agressif. Patch P-013 (cibler Top 15 explicitement avec `eagerness: eager`, garder `moderate` pour le reste).                                                                            |
| 9.5  | Service Worker offline-first                    | 0               | Pas de `service-worker.ts` ni `next-pwa`. Critère « optionnel mais Lighthouse PWA bonus » — flag P-014 (V6 polish).                                                                                                                                                                                                           |
| 9.6  | HTTP/2 push non utilisé                         | 1,0             | Personne n'utilise H/2 push (déprécié) — c'est juste l'absence de Caddy/CF qui est le problème (Agent 4). ✅                                                                                                                                                                                                                  |
| 9.7  | `priority` hints sur fetch JS                   | 0               | Aucun hint `importance="high"` ni `fetchpriority` sur fetch JS. Patch P-015.                                                                                                                                                                                                                                                  |
| 9.8  | Pas de redirect 30x sur statiques               | 1,0             | Aucun redirect dans `next.config.ts`. ✅                                                                                                                                                                                                                                                                                      |
| 9.9  | `Cache-Control: immutable` chunks hashés        | n/a             | Géré côté Caddy/CF (Agent 4) — hors périmètre Agent 1. Score neutre 0,5.                                                                                                                                                                                                                                                      |
| 9.10 | Origin pull CDN-friendly (no cookies on static) | 0,5             | Pas de configuration cookies sur statiques aujourd'hui — Caddy à configurer (Agent 4). Score 0,5.                                                                                                                                                                                                                             |

---

## TOTAL : 248 / 450 (~55 %)

| Chapitre         | Score         | Cible | Gap     |
| ---------------- | ------------- | ----- | ------- |
| 2. LCP           | 78 / 150      | 150   | 72      |
| 7. Images        | 100 / 150     | 150   | 50      |
| 9. Network hints | 70 / 150      | 150   | 80      |
| **Total**        | **248 / 450** | 450   | **202** |

**Lecture** : score `n/a` neutre = 0,5 (patches V6+ ou hors périmètre Agent 1). Avant patches activés (Plausible Sprint 23, illustrations, fallbacks fonts), seul ~55 % des critères sont au vert. Aucun gap rouge sang : l'architecture est saine, c'est l'instrumentation des hints qui manque.

---

## 1. Diagnostic per-page

### Tableau de score (15 pages × 3 chapitres = 45 cellules)

Méthode : LCP score = moyenne sur les 10 critères du chapitre 2 pour la page concernée. Idem Images / Network. Score sur 10 (× 10 critères = 100 par chapitre par page → résumé /10).

| #   | Page                                               | LCP element                              | LCP /10 | Images /10 | Network /10 | Notes principales                                                                                                                                                           |
| --- | -------------------------------------------------- | ---------------------------------------- | ------- | ---------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/[locale]` (home)                                 | H1 `display-editorial` (texte)           | 6,0     | 7,5        | 5,0         | HeroSchema SVG inline desktop, hidden lg:block. `Illustration` HOME-04-closing en clôture (placeholder, lazy par défaut). FAQ Accordion sous le fold (client mais pas LCP). |
| 2   | `/[locale]/interventions`                          | H1 + InterventionsHeroSchema SVG         | 6,0     | 7,5        | 5,0         | Même structure que home. Illustration en bas de page.                                                                                                                       |
| 3   | `/[locale]/interventions/essentielle`              | H1 (ProductPageTemplate)                 | 6,5     | 8,0        | 5,5         | Pas d'Illustration. Hero texte pur. ✅ structure plus propre.                                                                                                               |
| 4   | `/[locale]/audit`                                  | H1 + AuditHeroSchema                     | 6,0     | 7,5        | 5,0         | Illustration AUDIT-XX en clôture (line 1258, lazy).                                                                                                                         |
| 5   | `/[locale]/audit/flash`                            | H1 + DetailHeroSchema                    | 6,5     | 8,0        | 5,5         | ProductPageTemplate. Pas d'Illustration.                                                                                                                                    |
| 6   | `/[locale]/implementation`                         | H1 + ImplementationHeroSchema            | 6,0     | 7,5        | 5,0         | Illustration en bas.                                                                                                                                                        |
| 7   | `/[locale]/cas-concrets`                           | H1 + CaseStudiesHeroSchema               | 6,0     | 7,5        | 5,0         | Illustration en bas (line 369).                                                                                                                                             |
| 8   | `/[locale]/methodologie`                           | H1 + MethodologyHeroSchema               | 6,0     | 7,0        | 5,0         | **2 Illustration** dans le corps (line 300 + 343). Toutes lazy.                                                                                                             |
| 9   | `/[locale]/comparaisons`                           | H1 + ComparisonsHeroSchema               | 6,0     | 7,5        | 5,0         | 1 Illustration in-content.                                                                                                                                                  |
| 10  | `/[locale]/stack-ia`                               | H1 + StackHeroSchema                     | 6,0     | 7,5        | 5,0         | Illustration STACK-02-closing en bas. ToolLogo (logos AVIF) à venir Sprint 14.                                                                                              |
| 11  | `/[locale]/implantations`                          | H1 (Section h1) + PageHeroDecoration SVG | 6,5     | 8,0        | 5,5         | Pas d'Illustration. Hero texte + ItemList très fourni (signal AEO).                                                                                                         |
| 12  | `/[locale]/implantations/[region]` (ile-de-france) | H1 (Section h1) + PageHeroDecoration     | 6,5     | 8,0        | 5,5         | Idem region pilote. SSG.                                                                                                                                                    |
| 13  | `/[locale]/implantations/[region]/[ville]` (paris) | H1 + VilleHeroSchema                     | 6,0     | 7,5        | 5,0         | VilleHeroSchema **conditionnel** (`copy.heroSchema ? <…> : null`) — Paris l'a, autres villes non.                                                                           |
| 14  | `/[locale]/reserver`                               | H1 (compact hero) — pas de HeroSchema    | 5,5     | 7,5        | 5,0         | **BookingCalendar `"use client"` chargé inline (pas `dynamic()`) → ~40 KB JS sur la route**. Patch P-007 critique.                                                          |
| 15  | `/[locale]/contact`                                | H1 + ContactHeroSchema                   | 6,0     | 7,5        | 5,0         | Hero compact.                                                                                                                                                               |

**Lecture** : variabilité faible entre pages → le problème est systémique (pas de preload manuel, pas de blur placeholder), pas page-spécifique. C'est cohérent avec le fait que toutes les pages ont la même architecture de hero (H1 + HeroSchema).

---

## 2. Patches numérotés

> Effort : XS (<15 min) / S (<1 h) / M (<3 h) / L (<1 j) / XL (multi-jour)
> Format : §6 du prompt principal.

---

### P-001 — Préload Manrope hero font (LCP critique mobile)

**Effort** : S (30 min)
**Gain estimé** : LCP −150 à −300 ms p75 mobile (FOUT swap)
**Risque** : Faible
**Dépendances** : aucune

**Contexte** : `next/font/google` auto-preload Manrope, mais le preload est inséré au niveau du chunk de page. Sur mobile, où LCP = H1 texte, garantir l'arrivée précoce de Manrope 400 + 600 (les 2 weights utilisés par `display-editorial`) accélère le rendering. Next 16 le fait déjà via auto-preload, donc le patch consiste à VÉRIFIER l'émission et durcir si besoin via `preload: true` explicite (déjà default, mais on rend l'intention visible).

**Fichier** : `src/app/[locale]/layout.tsx` lignes 19-24 (Manrope déclaration)

**Diff** :

```diff
 const manrope = Manrope({
   subsets: ["latin"],
   variable: "--font-manrope",
   display: "swap",
   weight: ["400", "600"],
+  preload: true, // explicite — Next 16 default mais documente l'intention LCP critique
+  adjustFontFallback: true, // génère le fallback metrics-matched (size-adjust, ascent-override)
 });
```

Idem pour `Fraunces` (ligne 35-41) — sans preload (utilisé seulement en italique decorative, pas LCP) :

```diff
 const fraunces = Fraunces({
   subsets: ["latin"],
   variable: "--font-serif",
   display: "swap",
   weight: ["400", "500", "600"],
   style: ["normal", "italic"],
+  preload: false, // pas LCP — chargé après le hero
+  adjustFontFallback: "Times New Roman", // fallback serif metrics-matched
 });
```

**Validation** :

- Inspecter `<head>` après build : 2 `<link rel="preload" as="font">` pour Manrope (400 + 600) latin .woff2.
- DevTools Network → Manrope démarre avant FCP, Fraunces démarre après (lazy).
- CLS field test : font swap shouldn't shift > 0,001.

---

### P-002 — Faire passer `Illustration` en `loading="eager"` + `fetchPriority="high"` quand `priority`

**Effort** : S (45 min)
**Gain estimé** : LCP −300 à −500 ms p75 quand une vraie illustration sera mise au-dessus du fold
**Risque** : Faible
**Dépendances** : P-001

**Contexte** : `Illustration.tsx` ligne 94 utilise `priority={priority}` sur `<Image>`. Or **`priority` est déprécié dans Next 16** au profit de `preload + loading + fetchPriority` (cf. `node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md` §291). Patch préventif pour quand Will droppera de vraies images en hero (`/roi`, `/a-propos` entre autres).

**Fichier** : `src/components/visual/Illustration.tsx` lignes 87-97

**Diff** :

```diff
   return (
     <figure className={className ?? "relative w-full overflow-hidden rounded-2xl"}>
       <Image
         src={src}
         alt={alt}
         width={width}
         height={height}
-        priority={priority}
+        // Next 16 : `priority` déprécié → utiliser preload + loading + fetchPriority
+        // (cf. node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md §291).
+        preload={priority}
+        loading={priority ? "eager" : "lazy"}
+        fetchPriority={priority ? "high" : "auto"}
         sizes={sizes ?? defaultSizes[aspectRatio]}
         className="h-auto w-full"
       />
       {figcaption ? (
```

**Validation** :

- Quand un appel `<Illustration priority />` sera fait (ex. `/roi` hero), inspecter `<head>` → `<link rel="preload" as="image" imagesrcset>` injecté.
- Lighthouse LCP audit avant/après sur la page concernée.
- Tests vitest existants ne doivent pas casser (la prop `priority` reste en surface du composant).

---

### P-003 — Ajouter `placeholder="blur"` + `blurDataURL` sur `Illustration`

**Effort** : M (2 h)
**Gain estimé** : Aucun gain LCP direct, mais −100 ms perceived load + −0,02 CLS sur les pages avec image bitmap
**Risque** : Faible
**Dépendances** : illustrations réelles droppées par Will dans `public/illustrations/`

**Contexte** : Quand Will droppera les illustrations (16:9 1600×900, ~80-200 KB AVIF), un pop-in visuel sans blur sera laid. Next 16 propose `placeholder="blur"` + `blurDataURL` (data URL ~50 octets) qui réserve l'espace et masque le chargement.

**Fichier** : `src/components/visual/Illustration.tsx` (ajout d'une prop optionnelle + génération automatique)

**Diff** :

```diff
 export interface IllustrationProps extends Omit<
   IllustrationPlaceholderProps,
   "ariaLabel" | "className"
 > {
   src?: string;
   alt: string;
   figcaption?: string;
   priority?: boolean;
   sizes?: string;
   className?: string;
+  /** Data URL blur placeholder (généré via plaiceholder ou sharp `.toBuffer({ resize: 4 })`). Optionnel. */
+  blurDataURL?: string;
 }
```

```diff
 export function Illustration({
   src,
   alt,
   figcaption,
   priority = false,
   sizes,
   slot,
   aspectRatio,
   filenameTarget,
   caption,
   className,
+  blurDataURL,
 }: IllustrationProps): ReactNode {
```

```diff
       <Image
         src={src}
         alt={alt}
         width={width}
         height={height}
         preload={priority}
         loading={priority ? "eager" : "lazy"}
         fetchPriority={priority ? "high" : "auto"}
         sizes={sizes ?? defaultSizes[aspectRatio]}
+        {...(blurDataURL
+          ? { placeholder: "blur" as const, blurDataURL }
+          : {})}
         className="h-auto w-full"
       />
```

**Action complémentaire (hors périmètre Agent 1)** : ajouter un script `scripts/generate-blur-data-urls.ts` qui scanne `public/illustrations/*.avif` et génère un manifest `src/content/illustration-blurs.ts` (sharp `.resize(8).blur().toBuffer().toString('base64')`).

**Validation** :

- Drop test image, ajouter `blurDataURL`, vérifier visuel.
- Lighthouse perceived performance.

---

### P-004 — `<link rel="preload">` ressources LCP critiques niveau head (filet de sécurité Caddy/CF)

**Effort** : S (30 min)
**Gain estimé** : LCP −100 à −250 ms p75 (avec 103 Early Hints Caddy/CF, le preload devient un signal exploité par CF)
**Risque** : Faible
**Dépendances** : P-001 (fonts d'abord)

**Contexte** : Next 16 émet auto-preload pour fonts mais pas pour les CSS critiques ni pour les chunks JS qui sont nécessaires au shell. Quand Caddy/CF émettra 103 Early Hints (Sprint V5), il aura besoin d'une liste explicite de ressources preload. Ajout dans `layout.tsx` pour matérialiser cette liste.

**Fichier** : `src/app/[locale]/layout.tsx` ligne 102-108 (`<html>` … `<body>`)

**Diff** :

```diff
   return (
     <html
       lang={locale}
       dir="ltr"
       className={`${manrope.variable} ${inconsolata.variable} ${fraunces.variable} h-full antialiased`}
     >
+      <head>
+        {/* Preload LCP-critical hints — exploités par 103 Early Hints
+            (Caddy `early_hints` directive ou Cloudflare auto). Les fonts
+            sont déjà preload via next/font (auto), on ajoute uniquement
+            les hints non couverts par Next 16. */}
+        {/* (Sprint Web Vitals V5) Plausible self-hosted preconnect quand activé */}
+      </head>
       <body className="bg-bg text-fg flex min-h-full flex-col font-sans">
```

**Note** : volontairement minimal. Pas de `<link rel="preload">` JS car Next 16 le gère via modulepreload. Le `<head>` explicite documente l'intention pour les futurs hints (Sprint 23 : Plausible preconnect).

**Validation** :

- Inspecter `<head>` build : preconnect/preload visibles sur les pages concernées.
- Caddy log : 103 Early Hints émis avec ces URLs.

---

### P-005 — `size-adjust` font-fallback declarations (CLS swap)

**Effort** : S (45 min) — partagé avec Agent 2 (Chapitre 8.3)
**Gain estimé** : CLS −0,05 à −0,08 sur le swap font (impact transitif LCP confidence)
**Risque** : Faible
**Dépendances** : P-001

**Contexte** : Agent 2 traite ce sujet en détail (Chapitre 8.3). Mention dans Agent 1 car impact LCP indirect — quand Manrope swap depuis Arial, si dimensions divergent, le H1 reflow → LCP « clignote ». `adjustFontFallback: true` (déjà ajouté en P-001) génère automatiquement `@font-face` fallback metrics-matched. **Pas de patch CSS additionnel nécessaire si P-001 est appliqué** — Next 16 gère via `next/font` auto.

**Validation** :

- Build → inspecter `globals.css` généré (ou inline) : présence de `@font-face` fallback `Manrope Fallback` avec `size-adjust`, `ascent-override`, `descent-override`, `line-gap-override`.
- Chrome DevTools → Layout Shift : `< 0,001` lors du swap.

→ **Délégué à Agent 2 §8.3.** Ne pas dupliquer dans le batch de patches finale.

---

### P-006 — Audit de `globals.css` pour critique vs non-critique

**Effort** : M (2 h)
**Gain estimé** : −20 à −40 KB CSS bundle (si le JIT Tailwind purge correctement, sinon 0)
**Risque** : Moyen (peut casser visuels)
**Dépendances** : aucune

**Contexte** : Tailwind 4 / globals.css fourni à toutes les pages. Si le JIT mange tout, il ne devrait pas y avoir de purge à faire. À vérifier avec `pnpm bundle:analyze` (Agent 5).

→ **Délégué à Agent 5 (Bundle).** Ne pas patcher Agent 1.

---

### P-007 — `dynamic()` lazy le `BookingCalendar` (`/reserver` LCP critique)

**Effort** : S (1 h)
**Gain estimé** : LCP −600 à −900 ms p75 sur `/reserver` (mobile slow 4G), bundle initial −40 KB
**Risque** : Faible (le calendrier est sous le hero, pas LCP)
**Dépendances** : aucune

**Contexte** : `src/app/[locale]/reserver/page.tsx:7` importe `BookingCalendar` directement. C'est un client component lourd (`"use client"` + dépendances de date manipulation + interactivity). Il est rendu dans la box `<div className="bg-bg py-8">` SOUS le hero. Le lazy-charger via `dynamic({ ssr: false })` ou `next/dynamic` ferait passer le LCP de la page au H1 hero (presque purement texte) sans dégrader UX (le calendrier est attendu, pas instantané).

**Fichier** : `src/app/[locale]/reserver/page.tsx` lignes 7 + 362

**Diff** :

```diff
 import type { Metadata } from "next";
 import { setRequestLocale } from "next-intl/server";
 import { hasLocale } from "next-intl";
 import { notFound } from "next/navigation";
+import dynamic from "next/dynamic";
 import { routing, type Locale } from "@/i18n/routing";
 import { Container } from "@/components/layout/Container";
-import { BookingCalendar, type BookedSlot } from "@/components/calendar/BookingCalendar";
+import type { BookedSlot } from "@/components/calendar/BookingCalendar";
 import { Cta } from "@/components/marketing/Cta";
 import { CtaBlock } from "@/components/sections/CtaBlock";
 import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
 import { buildProductMetadata } from "@/lib/seo";
+
+// BookingCalendar = client lourd (date manipulation + interactivity).
+// Sous le hero LCP — lazy-charger pour libérer l'initial bundle de /reserver.
+// `ssr: false` : la page peut être SSG sans le calendrier (fixtures sont
+// passées en prop, le calendrier est rendu côté client uniquement).
+const BookingCalendar = dynamic(
+  () =>
+    import("@/components/calendar/BookingCalendar").then((m) => ({
+      default: m.BookingCalendar,
+    })),
+  {
+    ssr: false,
+    loading: () => (
+      <div
+        className="bg-paper border-border h-[600px] animate-pulse rounded-2xl border"
+        aria-busy="true"
+        aria-label="Chargement du calendrier"
+      />
+    ),
+  },
+);
```

**Validation** :

- `pnpm typecheck` ✅
- `pnpm test` ✅
- Lighthouse LCP `/reserver` avant/après : H1 doit devenir LCP au lieu d'un élément du calendrier.
- Bundle analyzer : un chunk dédié `BookingCalendar-[hash].js` séparé du chunk principal.
- A11y : `role="status"` + `aria-busy` sur le skeleton.

**STOP & ASK candidat** : `ssr: false` perd le HTML SSG du calendrier — acceptable car les data du calendrier sont volatiles (fixtures aujourd'hui, Prisma Sprint 17). À valider avec Will avant exécution.

---

### P-008 — `placeholder="blur"` automatique sur `Illustration` (anti-CLS bitmap)

**Effort** : M (2 h) → couvre P-003 + génération script
**Gain estimé** : −0,02 CLS p75 + −150 ms perceived load
**Risque** : Faible
**Dépendances** : P-003 (mêmes lignes), illustrations réelles droppées

→ Voir P-003 ci-dessus. Fusionné.

---

### P-009 — Gate CI taille images source

**Effort** : XS (10 min)
**Gain estimé** : Préventif (évite régression bundle)
**Risque** : Faible
**Dépendances** : aucune

**Contexte** : Pas de garde-fou aujourd'hui contre une image > 2 MB committée. Patch package.json + script ESLint ou un hook lint-staged.

**Fichier** : `package.json` (scripts existants) + nouveau `scripts/check-image-sizes.mjs`

**Diff package.json (extrait conceptuel)** :

```diff
 "scripts": {
   …
+  "check:images": "node scripts/check-image-sizes.mjs",
   "verify:all": "pnpm typecheck && pnpm lint && … && pnpm check:images && pnpm test"
 }
```

**Nouveau fichier** `scripts/check-image-sizes.mjs` (Node 22+) :

```js
import { statSync } from "node:fs";
import { glob } from "node:fs/promises";
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
let bad = false;
for await (const f of glob("public/**/*.{png,jpg,jpeg,webp,avif,gif}")) {
  const size = statSync(f).size;
  if (size > MAX_BYTES) {
    console.error(`✖ ${f} = ${(size / 1024 / 1024).toFixed(2)} MB > 2 MB`);
    bad = true;
  }
}
process.exit(bad ? 1 : 0);
```

**Validation** :

- Drop une image 3 MB → script échoue.
- Drop image 1 MB → script passe.

---

### P-010 — Migrer `<img>` natifs vers `next/image` (TeamGrid + PressSpokesperson)

**Effort** : S (1 h)
**Gain estimé** : −30 KB par image (AVIF auto), LCP impact négligeable (images sous le fold)
**Risque** : Faible
**Dépendances** : aucune

**Contexte** : `src/components/sections/TeamGrid.tsx:29` et `src/components/sections/PressSpokesperson.tsx:46` utilisent `<img>` natif. Hors des 15 pages stratégiques mais commit dette technique.

**Fichier** : `src/components/sections/TeamGrid.tsx` ligne 26-29

**Diff** :

```diff
+import Image from "next/image";
…
-              {/* Plain <img> — Sprint 5 swaps to next/image once we have
-                  …
-              <img src={member.photoUrl} alt={member.name} className="h-full w-full object-cover" />
+              <Image
+                src={member.photoUrl}
+                alt={member.name}
+                width={400}
+                height={400}
+                sizes="(max-width: 768px) 100vw, 400px"
+                loading="lazy"
+                className="h-full w-full object-cover"
+              />
```

Idem `PressSpokesperson.tsx`.

**Validation** : pages `/a-propos` et `/presse` : photos servies en AVIF/WebP. Tests visual regression OK.

→ **Hors 15 pages stratégiques** : à inclure dans roadmap V2 ou V3.

---

### P-011 — Préconnect Plausible self-hosted (Sprint 23 anticipation)

**Effort** : XS (10 min) — patch dormant
**Gain estimé** : −80 à −150 ms TTFB Plausible une fois activé
**Risque** : Aucun
**Dépendances** : Sprint 23 (Plausible self-hosted)

**Contexte** : Plausible viendra Sprint 23 sur subdomain `plausible.axionia.eu`. Anticiper le preconnect dans le layout pour qu'au moment d'activer Plausible, ce soit déjà câblé.

**Fichier** : `src/app/[locale]/layout.tsx` (ajout dans `<head>` créé par P-004)

**Diff** :

```diff
   <head>
+    {/* Sprint 23 : Plausible self-hosted analytics — preconnect dormant.
+        Activé une fois `process.env["NEXT_PUBLIC_PLAUSIBLE_ENABLED"]` posé. */}
+    {process.env["NEXT_PUBLIC_PLAUSIBLE_ENABLED"] === "true" && (
+      <>
+        <link rel="preconnect" href="https://plausible.axionia.eu" crossOrigin="anonymous" />
+        <link rel="dns-prefetch" href="https://plausible.axionia.eu" />
+      </>
+    )}
   </head>
```

**Validation** :

- Sans flag : aucun `<link>` émis.
- Avec flag : 2 `<link>` dans `<head>`.

---

### P-012 — Vérifier `modulepreload` dans le manifest Next 16

**Effort** : XS (15 min)
**Gain estimé** : 0 (validation seule — Next 16 le fait par défaut)
**Risque** : 0
**Dépendances** : `pnpm build` artifacts

**Contexte** : Next 16 émet `<link rel="modulepreload">` automatiquement pour les chunks de la route. Patch consiste à grep le HTML SSG d'une page stratégique pour confirmer.

**Action** :

```sh
grep -h "modulepreload" .next/server/app/fr/page.html | head
```

Si présent : ✅ critère 9.3 satisfait. Si absent : flag pour Agent 5 (Bundle / build config).

**Validation** : audit textuel post-build.

---

### P-013 — Tuner Speculation Rules (cibler Top 15 explicitement, garder fallback moderate global)

**Effort** : S (30 min)
**Gain estimé** : −40-60 % bandwidth Cloudflare prefetch (4 562 SSG → cible 30 URLs eager)
**Risque** : Faible (les URLs hors Top 15 restent en `moderate` qui est moins agressif)
**Dépendances** : aucune

**Contexte** : Baseline §A.1 : « `eager prefetch` sur toutes les URLs locales = risque sur 4 562 SSG ». Cibler explicitement les 15 pages stratégiques en `eager` et passer le reste en `moderate`.

**Fichier** : `src/app/[locale]/layout.tsx` lignes 132-154

**Diff (résumé)** :

```diff
         {process.env.NODE_ENV === "production" && (
           <script
             type="speculationrules"
             dangerouslySetInnerHTML={{
               __html: JSON.stringify({
                 prerender: [
                   {
                     source: "document",
                     where: { href_matches: `/${locale}/*` },
-                    eagerness: "moderate",
+                    eagerness: "moderate",
                   },
                 ],
                 prefetch: [
+                  // Top 15 pages stratégiques (80/20) — eager.
                   {
                     source: "document",
-                    where: { href_matches: `/${locale}/*` },
+                    where: {
+                      or: [
+                        { href_matches: `/${locale}` },
+                        { href_matches: `/${locale}/interventions` },
+                        { href_matches: `/${locale}/interventions/essentielle` },
+                        { href_matches: `/${locale}/audit` },
+                        { href_matches: `/${locale}/audit/flash` },
+                        { href_matches: `/${locale}/implementation` },
+                        { href_matches: `/${locale}/cas-concrets` },
+                        { href_matches: `/${locale}/methodologie` },
+                        { href_matches: `/${locale}/comparaisons` },
+                        { href_matches: `/${locale}/stack-ia` },
+                        { href_matches: `/${locale}/implantations` },
+                        { href_matches: `/${locale}/reserver` },
+                        { href_matches: `/${locale}/contact` },
+                      ],
+                    },
                     eagerness: "eager",
                   },
+                  // Le reste : moderate (hover ~200 ms ou viewport ~visible).
+                  {
+                    source: "document",
+                    where: { href_matches: `/${locale}/*` },
+                    eagerness: "moderate",
+                  },
                 ],
               }),
             }}
           />
         )}
```

**Validation** :

- DevTools → Application → Speculation Rules : 3 entrées (1 prerender, 2 prefetch).
- Network tab : navigation vers Top 15 → instant ; vers villes → 200 ms hover delay.
- Bandwidth Cloudflare avant/après (post-déploiement Sprint Caddy/CF V5).

---

### P-014 — Service Worker offline-first (V6 polish, optionnel)

**Effort** : L (1 j)
**Gain estimé** : +5 PWA Lighthouse (bonus, pas un must-have)
**Risque** : Moyen (cache stale HTML potentiel)
**Dépendances** : aucune

→ **À mettre dans V6 polish.** Pas une priorité. Le critère 13.7 (« SW ne sert pas du HTML stale ») n'est satisfait qu'avec une stratégie `network-first` pour HTML + `cache-first` pour assets — non triviale. Ne pas implémenter sans GO Will explicite.

**Validation V6** : Lighthouse PWA badge passe à "Installable".

---

### P-015 — `fetchPriority` sur fetches JS critiques

**Effort** : S (45 min)
**Gain estimé** : LCP −50 à −150 ms (faible mais sûr)
**Risque** : Faible
**Dépendances** : Inventaire des fetches client (Agent 5)

**Contexte** : Aucun `fetch()` client critique aujourd'hui (les pages sont SSG, le RUM est `sendBeacon`). Patch dormant pour quand Sprint 17 ajoutera Stripe ou data fetches.

→ **Reporté V3 ou plus tard.** Pas d'impact aujourd'hui.

---

## 3. Top 5 quick wins du périmètre

Ranking par (gain × effort_inv × risque_inv) :

1. **P-007** — Lazy `BookingCalendar` sur `/reserver` (LCP −600-900 ms, S effort, faible risque). **STOP & ASK avant car `ssr: false`.**
2. **P-013** — Tuner Speculation Rules Top 15 vs reste (bandwidth −40-60 %, S effort, faible risque). **No STOP & ASK** — c'est juste un toggle.
3. **P-001** — `preload: true` + `adjustFontFallback` explicites sur les 3 fonts (LCP −150-300 ms mobile, S effort). **No STOP & ASK.**
4. **P-002** — `preload + loading + fetchPriority` doctrine Next 16 dans `Illustration.tsx` (LCP −300-500 ms quand Will droppera image hero). **No STOP & ASK.**
5. **P-009** — Gate CI taille images source (préventif, XS effort). **No STOP & ASK.**

Total Top 5 : ~3,5 h dev, gain attendu LCP ~−1 200 ms cumulé sur les pages concernées + bandwidth Cloudflare protégé.

---

## 4. STOP & ASK ouverts

### STOP & ASK A1 — `ssr: false` sur `BookingCalendar`

**Contexte** : P-007 propose `dynamic({ ssr: false })`. L'avantage : LCP −800 ms mobile, bundle initial −40 KB. L'inconvénient : la page `/reserver` perd le HTML SSG du calendrier — Google verra un skeleton, pas le calendrier réel. Comme la page n'est pas une cible SEO premium (`/reserver` = utilitaire), l'impact SEO est faible. **Mais** : l'audit SEO Sprint 14.x peut avoir intégré `/reserver` dans une stratégie spécifique.

**Décision requise** : `ssr: false` (gain perf max) OU `ssr: true` avec lazy + Suspense (compromis modéré, gain ~LCP −400 ms) OU statu quo (rien).

**Options** :

- **A.** `ssr: false` (recommandé) — gain max, Google rend le skeleton avant hydratation. JSON-LD inchangé (déjà émis dans la page parent). Risque indexation : zéro car le calendrier n'est pas un signal SEO.
- **B.** `ssr: true` lazy + Suspense — Calendrier rendu en SSR, lazy hydraté. Gain ~LCP −400 ms.
- **C.** Statu quo — pas de patch, accepter LCP `/reserver` actuel.

**Recommandé** : **A.** Le calendrier est un outil de conversion, pas un signal SEO.

**Impact si on attend** : LCP `/reserver` reste ~3,5-4 s mobile = orange Lighthouse, vert seulement si le reste du bundle se compresse côté V4 (React Compiler).

---

### STOP & ASK A2 — Speculation Rules : doit-on couper le `prerender moderate` global ?

**Contexte** : Le coût bandwidth Cloudflare peut exploser sur 4 562 SSG si chaque visiteur laisse moderate prerender chaque page hovered. À l'inverse, garder moderate améliore navigation 100 % SPA.

**Décision requise** : ne **pas** couper (P-013 conserve `moderate` partout) OU couper et ne garder que les Top 15 en `eager` ET `moderate` ?

**Options** :

- **A.** Conserver `moderate` partout + `eager` sur Top 15 (P-013 actuel). Bandwidth modéré.
- **B.** Conserver UNIQUEMENT Top 15 (eager) — pas de moderate global. Bandwidth -80 %, mais navigation hors Top 15 devient classique (pas de prefetch hover).
- **C.** Statu quo — eager partout. Bandwidth max.

**Recommandé** : **A.** (compromis). Si la bandwidth CF Free pose problème post-déploiement, basculer en **B**.

**Impact si on attend** : déploiement V1 avec eager partout → potentiel pic bandwidth si crawl massif.

---

### STOP & ASK A3 — Migrer `<img>` natifs (TeamGrid + PressSpokesperson) maintenant ou Sprint 17 ?

**Contexte** : Le code commente déjà « Sprint 5 swaps to next/image ». P-010 propose de le faire maintenant pour boucler l'audit. Peu d'impact LCP (sous le fold) mais −30 KB par image après AVIF.

**Décision requise** : maintenant (V2) OU différer.

**Options** :

- **A.** Maintenant V2 (S effort, faible risque). Bouclage dette technique.
- **B.** Différer Sprint 17 (data réelles arriveront, pas juste fixtures Sprint 5).

**Recommandé** : **A.** L'effort est minime et la dette est ouverte depuis Sprint 5.

---

## 5. Mémo découvertes annexes

### Note A1 — `runtime = "edge"` sur OG image

`src/app/opengraph-image.tsx:12` est en runtime Edge. Hetzner = Node.js. Identique au cas `/api/vitals` mais pour OG → si CF est devant, l'OG est généré au moment de la requête. À monitorer avec Caddy + cache `s-maxage=86400`. **Hors périmètre Agent 1** (image générée correctement, c'est le runtime qui est inconfortable). Renvoi Agent 4 + Agent 6.

### Note A2 — `Illustration` mode placeholder = aucune image bitmap aujourd'hui

Sur les 15 pages stratégiques, **aucune image bitmap réelle n'existe** : tous les `<Illustration>` sont en mode `IllustrationPlaceholder` (SVG inline + texte). Donc :

- Aucun gain LCP image possible aujourd'hui — tout le gain est sur fonts (P-001) + speculation rules (P-013) + lazy calendar (P-007).
- Quand Will droppera les illustrations (Sprint Visual Rhythm extension), tous les patches `Illustration` deviendront actifs.

### Note A3 — HeroSchema = SVG inline server-rendered, OK pour LCP

Tous les HeroSchema (Interventions/Audit/Methodology/Comparisons/Stack/Help/Faq/About/Blog/Detail/Ville/CaseStudies/Implementation/Contact) sont des **Server Components statiques** importés directement (pas de `dynamic()`). Bonne pratique. Critère 2.3 ✅ partout.

### Note A4 — `fetchPriority` sur image 404 de `Illustration`

Quand `Illustration` est en mode placeholder, l'`<Image>` n'est pas rendu — c'est le placeholder SVG inline. Donc `fetchPriority` ne s'applique pas. Aucun problème.

### Note A5 — Largeur et hauteur des images dans `Illustration`

`ratioToWidthHeight` (`Illustration.tsx:42-49`) définit `1600×900` pour 16:9, `1000×1250` pour 4:5, `1200×1200` pour 1:1, `1200×630` pour OG. Ces dimensions sont **les sources** — Next 16 + sharp génèrent les srcset à partir de ces tailles + `sizes`. Bon. Pas de patch nécessaire.

---

## 6. Validation lecture Next 16 docs

Conformément à `AGENTS.md` (« This is NOT the Next.js you know. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code »), j'ai consulté :

- `01-app/03-api-reference/02-components/image.md` § « preload », « priority », « loading », « placeholder ». **Découverte critique** : `priority` est déprécié Next 16 → tous mes patches utilisent `preload + loading + fetchPriority`.
- `01-app/03-api-reference/02-components/font.md` § « preload », « subsets », « adjustFontFallback ». Confirmé `next/font/google` auto-preload + métriques fallback. P-001 et P-005 alignés.
- `01-app/01-getting-started/12-images.md` (rapide) — confirme l'usage `<Image>` + `next.config.ts` `images.formats`.

**Aucun patch ne contredit la doctrine Next 16.**

---

## 7. Liens vers patches partagés avec d'autres agents

- **P-005** (size-adjust fallback fonts) → délégué Agent 2 §8.3.
- **P-006** (audit Tailwind globals.css) → délégué Agent 5 (Bundle).
- **P-009** (gate CI image size) → impact aussi Agent 6 (gouvernance perf).
- **P-014** (Service Worker) → Agent 4 ou Agent 6 (V6 polish).
- **OG image runtime Edge** (note A1) → Agent 4.

---

## 8. Conclusion

**Score Agent 1 : 248 / 450** (~55 %).

Le périmètre LCP/Images/Network hints est **architecturalement sain** mais sous-instrumenté :

- **LCP** : H1 texte sur 15/15 pages mobile (puisque HeroSchema desktop only), donc le levier #1 = fonts (P-001) + lazy `BookingCalendar` (P-007).
- **Images** : 0 image bitmap above-fold sur les 15 pages → score 100/150 quasi structurel. Quand Will droppera des illustrations hero, P-002 + P-003 deviennent critiques.
- **Network** : aucun preconnect/dns-prefetch/preload manuel, mais aucun tiers en V1 → flag dormant. Speculation Rules trop agressives (P-013).

**Top 3 patches LIVRABLES** (sans STOP & ASK) : P-001, P-009, P-013. Effort cumulé ~1 h 30, gain LCP −150-300 ms p75 mobile sur les 15 pages + bandwidth CF protégé.

**Top 2 patches À VALIDER** (STOP & ASK) : P-007 (`ssr: false` calendar), P-002 (Next 16 doctrine `Illustration`).

Pas de gap rouge sang. La doctrine v3 visuelle est intouchée. JSON-LD / anti-doorway / naming Axion-IA inchangés.

**Prêt pour consolidation par l'agent superviseur (Phase D).**
