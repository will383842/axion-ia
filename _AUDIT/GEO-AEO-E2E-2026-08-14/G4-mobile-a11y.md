# G4 — mobile & signaux d'accessibilité

**Date d'exécution** : 2026-08-14, 22:41 → 23:05 UTC
**Mode** : AUDIT-ONLY STRICT — aucune écriture hors `_AUDIT/GEO-AEO-E2E-2026-08-14/`,
aucun build, aucun `next dev`, aucun Lighthouse local, aucune suite de tests, aucun
POST/PUT/DELETE, aucune soumission d'URL.

**Fenêtre de mesure** : derniers déploiements atterris à 14:57, 18:26 et ~19:50 UTC.
Toutes mes mesures live sont postérieures à 22:41 UTC, soit **> 2 h 40 après le dernier
atterrissage** → hors fenêtre ISR post-deploy. Aucun constat ci-dessous n'est imputable à
un cache froid ou à un stub `stub.invalid`.

## Périmètre réellement couvert

| Item de mission | Couvert | Méthode |
|---|---|---|
| `viewport` | ✅ | lecture code + `<meta>` servi en prod |
| Cibles tactiles (tap targets) | ✅ | mesure DOM réelle (Pixel 7, 412 px) sur 5 pages |
| a11y axe sur ≥ 5 pages | ✅ | artefact CI nightly (15 pages, desktop) **+** exécution axe-core en **viewport mobile** sur 4 surfaces jamais auditées (menu mobile ouvert, article blog, galerie, /fr) |
| Poids images servies / AVIF négocié | ✅ | négociation `Accept`, poids réels transférés après défilement complet |
| Lazy-loading du LCP (anti-pattern) | ✅ | LCP mesuré (PerformanceObserver) sur 5 pages mobiles + audit des `preload`/`priority` |
| Lighthouse mobile en lab | ❌ | interdit (machine partagée, nuit) — voir « Limites » |

Sondes écrites pour cet audit (lecture seule, GET uniquement) :
`_g4-probe5.mjs` (cibles tactiles / débordement / CLS / DOM),
`_g4-probe6.mjs` (CLS + LCP articles),
`_g4-probe7.mjs` (gaspillage du preload hero). `_g4-probe3.mjs` et `_g4-probe4.mjs`
(poids transféré, axe mobile) provenaient d'une exécution G4 antérieure interrompue et ont
été ré-exécutés tels quels. Ces fichiers `_g4-*.mjs` sont **jetables** : ils peuvent être
supprimés après lecture du rapport.

---

## Résumé exécutif

Le socle mobile est **sain là où on l'a instrumenté** et **aveugle partout ailleurs** :
CLS = 0 sur 8 pages mesurées, LCP 756–792 ms, aucun débordement horizontal, aucune
violation axe *serious/critical* — y compris menu mobile ouvert, article et galerie.
Mais **aucune gate ne mesure le mobile** : le seul Lighthouse bloquant tourne en
`--settings.preset=desktop`, et la gate axe nocturne en `--project=chromium` (desktop).
Le preset mobile n'existe que dans la config du gate PR, non bloquant et cassé depuis
juillet. Google indexe mobile-first : on gate ce que Google ne regarde pas.
Dans cet angle mort, deux PNG bruts financent 100 % des pages : le logo Qualiopi
(1,27 Mo, affiché en 210 px) et l'avatar auteur (1,44 Mo, affiché en 64 px) — soit
**2,7 Mo décoratifs sur chaque page d'article** (4,5 Mo transférés au total). Trois
défauts sémantiques abîment l'extraction par les moteurs de réponse : deux `<main>` sur
~291 pages publiques, un `aria-label` qui masque le texte visible sur la home et les
~4 300 pages villes (WCAG 2.5.3, niveau A), et un saut `h1 → h3` qui casse l'outline.

---

## Findings

### [P0] Le logo Qualiopi est un PNG de 1,27 Mo servi brut sur 100 % des pages

**Symptôme.** Le pied de page affiche le lockup Qualiopi en 210 × 140 px. Le fichier servi
fait **1 304 554 octets** (1,27 Mo) — soit ~44× le nécessaire à cette taille d'affichage.
Il est servi tel quel, sans redimensionnement ni format moderne, sur toutes les pages
publiques (footer global), et une seconde fois en 180 px sur la home.

**Preuve code.**
- `src/components/qualiopi/QualiopiBadge.tsx:94-105` — `<img src={identity.logoPath}
  width={210} height={140} loading="lazy">`, avec un `eslint-disable
  @next/next/no-img-element` motivé ligne 94 : « aucune modification graphique ni
  ré-encodage autorisés (règle d'usage de la marque), donc `<img>` brut et non
  next/image ».
- `src/components/qualiopi/QualiopiBadge.tsx:126-139` — deuxième occurrence (variante
  carte, 180 px), même fichier source.
- Asset : `public/qualiopi/axion-ia-qualiopi.png` (lockup 1536 × 1024, cf. commentaire
  `QualiopiBadge.tsx:82-88`).

**Preuve live (2026-08-14 22:44:05 UTC).**
```
curl -o /dev/null https://axion-ia.com/qualiopi/axion-ia-qualiopi.png
  → 1 304 554 octets, content-type: image/png, Cache-Control: public, max-age=14400
```
Poids transféré réel après défilement complet en émulation Pixel 7 (22:47:54 UTC) :
- `/fr` : **1 274 Ko** sur 1 988 Ko d'images = **64 % du poids images de la home**
- `/fr/blog/mentor-ia-dirigeant-auvergne-rhone-alpes-grenoble` : idem 1 274 Ko
Cohérent avec l'échec Lighthouse nightly du 2026-08-14 04:55 UTC sur `/fr/appel` :
`image-delivery-insight` score 0 (**échec dur**), `uses-responsive-images` 1 image,
`modern-image-formats` 1 image.

**Root-cause.** L'interdiction de ré-encodage (règle d'usage de la marque Qualiopi) a été
appliquée au **pipeline d'optimisation** (`next/image`) *et*, par effet de bord, au
**dimensionnement de l'asset source**. Or livrer un fichier 1536 px pour un affichage
210 px n'est pas exigé par la règle de marque : c'est un choix par défaut jamais rediscuté.
`Cache-Control: max-age=14400` (4 h, hérité du défaut `public/`) fait re-télécharger
l'octet lourd toutes les 4 h par visiteur.

**Patch prescrit.**
1. Déposer une variante **redimensionnée sans recomposition** (même lockup, même
   proportions, simple downscale) `public/qualiopi/axion-ia-qualiopi-420.png` (420 × 280,
   = 2× la taille d'affichage max 210 px) + passer l'optimiseur **lossless**
   (`oxipng -o max --strip safe`, sortie pixel-identique) sur les deux fichiers.
   Attendu : 1,27 Mo → ~40-70 Ko.
2. `QualiopiBadge.tsx` : pointer les variantes `logo` (210 px) et carte (180 px) sur le
   fichier 420 px ; **conserver** le fichier 1536 px pour l'usage documentaire /
   JSON-LD éventuel.
3. Ajouter une règle `headers()` dans `next.config.ts` pour `/qualiopi/:path*` :
   `public, max-age=31536000, immutable` (le nom de fichier porte la version).
4. ⚠️ **STOP & ASK Will** avant application : le commentaire `QualiopiBadge.tsx:94` est
   une décision explicite de conformité de marque. Un downscale n'est pas une
   recomposition, mais c'est Will (et non l'audit) qui arbitre la règle Qualiopi.

**Effort** : S (≈ 1 h, dont l'export de l'asset).
**Impact GEO/AEO** : **fort** — 1,27 Mo sur 100 % des pages pèse sur le LCP/INP terrain
(signal de classement mobile-first) et sur le budget de rendu de Googlebot smartphone.
**Risque de régression** : faible, mais **non nul sur la conformité Qualiopi** (visuel du
logo). Vérifier après patch que le lockup reste net sur écran Retina.
**Do-not-touch** : `src/server/qualiopi/config/registry.ts:132-146` (clé
`qualiopi_logo_path`, la valeur vient de la console admin) ; ne pas convertir en WebP/AVIF
ni recadrer sans arbitrage de Will.

---

### [P0] L'avatar auteur est un PNG de 1,44 Mo affiché en 64 × 64 sur toutes les pages éditoriales

**Symptôme.** Le bloc auteur E-E-A-T des articles (blog, actualités, cas concrets, guides)
affiche un portrait de 64 × 64 px. Le fichier servi fait **1 513 427 octets** (1,44 Mo),
en `<img>` brut, sans passer par l'optimiseur.

**Preuve code.**
- `src/components/knowledge/public/AuthorByline.tsx:62-70` — `<img src={authorAvatarUrl}
  width={64} height={64} loading="lazy">`.
- Justification en commentaire, `AuthorByline.tsx:55-60` : « `<img>` conservé car
  `authorAvatarUrl` est une URL remote arbitraire (DB) et `next.config.ts`
  `images.remotePatterns: []` n'autorise pas l'optimizer next/image dessus ».
  **Cette justification est périmée sur les deux points** : (a) `next.config.ts:144-147`
  déclare désormais `remotePatterns: [{ hostname: "images.unsplash.com" }]` ; (b) surtout,
  la valeur réellement servie est un **chemin local** (`/auteurs/manon.png`), que
  `next/image` optimise sans aucun `remotePatterns` — cf. `src/lib/seo/manon-person.ts:29`
  et `public/auteurs/manon.png` (1 513 427 octets sur disque).
- Consommateurs : `src/app/[locale]/blog/[slug]/page.tsx:630`,
  `src/app/[locale]/actualites/[slug]/page.tsx:551`,
  `src/app/[locale]/cas-concrets/[slug]/page.tsx:176`,
  `src/app/[locale]/guides/[slug]/page.tsx:294`.

**Preuve live (2026-08-14 22:48:51 UTC).** HTML servi de
`/fr/blog/mentor-ia-dirigeant-auvergne-rhone-alpes-grenoble` :
```html
<img src="/auteurs/manon.png" alt="Portrait de Manon" width="64" height="64" loading="lazy" ...>
```
Poids transféré (Pixel 7, défilement complet, 22:47:54 UTC) : **1 459 Ko**, première
ressource de la page, devant le logo Qualiopi (1 274 Ko). Total transféré de l'article :
**4 497 Ko**, dont 3 165 Ko d'images → **87 % du poids images de la page est décoratif**.

**Root-cause.** Un commentaire de contournement écrit pour un cas (URL distante
arbitraire) appliqué à un cas qui n'en relève pas (chemin local), jamais re-testé quand
`remotePatterns` a changé. Le fichier source est en 1024 px parce qu'il sert aussi de
`photoUrl1024` au nœud `Person` JSON-LD (`src/lib/seo/manon-person.ts`) — la même URL
sert donc deux usages aux besoins opposés.

**Patch prescrit.**
1. `AuthorByline.tsx` : brancher `next/image` quand l'URL est **locale**
   (`authorAvatarUrl.startsWith("/")`), conserver le `<img>` brut sinon.
   ```tsx
   authorAvatarUrl.startsWith("/")
     ? <Image src={authorAvatarUrl} alt={...} width={64} height={64} sizes="64px" className="..." />
     : <img ... />   // URL distante non whitelistée : inchangé
   ```
   Attendu : 1 459 Ko → ~3-5 Ko (AVIF 128 px).
2. **Ne pas** redimensionner `public/auteurs/manon.png` : le JSON-LD `Person.image`
   attend une image ≥ 1024 px (recommandation Google pour l'entité auteur).

**Effort** : S (≈ 30 min avec test).
**Impact GEO/AEO** : **fort** — ce sont exactement les pages destinées à capter le trafic
GEO/AEO (articles, cas concrets, guides) qui portent la charge.
**Risque de régression** : faible. Vérifier que le rendu reste rond/net (`object-cover`
conservé). `next/image` avec `width/height` explicites ne réintroduit pas de CLS
(CLS mesuré = 0, à re-vérifier après patch).
**Do-not-touch** : `src/lib/seo/manon-person.ts` (`photoUrl1024`), `public/auteurs/manon.png`,
et le nœud `Person` JSON-LD émis par `AuthorByline.tsx:42-50`.

---

### [P1] Aucune gate ne mesure le mobile — ni performance, ni accessibilité

**Symptôme.** Le dépôt affiche trois dispositifs de contrôle mobile ; aucun n'en est un.

| Dispositif | Ce qu'il exécute réellement | Bloquant ? |
|---|---|---|
| `lighthouserc.json:20` | `settings: [{preset:desktop},{preset:mobile}]` — **la seule config mobile du dépôt** | consommée par `pnpm lhci:autorun`, step **`continue-on-error: true`** (`ci.yml:296-317`), cassé depuis 2026-07-01 |
| Gate Lighthouse post-deploy | `LH_SETTINGS=(--settings.preset=desktop ...)` — `deploy-coolify.yml:620` | **oui, mais desktop seulement** |
| Gate axe nocturne | `playwright test tests/e2e/a11y.spec.ts --project=chromium` — `nightly.yml:94` | oui, mais `chromium` = **Desktop Chrome 1280×720** |

`playwright.config.ts:20-25` déclare pourtant les projets `mobile-chrome` (Pixel 7) et
`mobile-safari` (iPhone 14 Pro) : ils ne sont **jamais** invoqués par un job CI.
Idem pour `lighthouserc.json:56` `"target-size": ["warn", {minScore:1}]` — audit de taille
des cibles tactiles, qui n'a de sens qu'en mobile, câblé uniquement sur la config non
bloquante.

**Preuve live (2026-08-14, artefacts CI lus à 22:45 UTC).**
- Run nightly `31770966460` (2026-08-14 04:47 UTC) : job « A11y axe-core WCAG 2.2 AA vs
  prod (15 pages) » → **15 passed** en 2 min 7 s, `--project=chromium`.
- Job « Lighthouse history » du même run → `--settings.preset=desktop`
  (`nightly.yml:275`), assertions en mode « log, on ne fait pas échouer ».
- Le workflow nightly est **rouge tous les soirs depuis au moins le 2026-08-09**
  (6 runs consultés, tous `failure`) — causes : `pnpm audit` (CVE) et `zap-baseline`
  (timeout 30 min). La gate a11y, elle, est verte : son signal est donc **noyé** dans un
  workflow chroniquement rouge (piège « une garde ne vaut que si elle rougit » — ici elle
  rougit pour d'autres raisons, ce qui revient au même).

**Root-cause.** Le gate mobile n'a jamais été déplacé du gate PR (cassé, non bloquant) vers
le gate post-deploy (réel). La décision documentée `ci.yml:297-307` — « le VRAI contrôle
Web Vitals reste le lhci POST-DEPLOY » — a transféré la responsabilité **sans transférer
le preset mobile**.

**Patch prescrit.**
1. `deploy-coolify.yml` : dupliquer le bloc `collect` en deux passes, `--settings.preset=
   desktop` puis `--settings.preset=mobile`, et asserter les deux (le warm-up
   anti-cold-start ligne 619 reste mutualisé). Budget attendu : commencer en **WARN** sur
   la passe mobile pendant 2-3 deploys pour établir la ligne de base, puis ratcheter.
2. `nightly.yml:94` : ajouter `--project=mobile-chrome` (l'exécution mesurée coûte
   ~2 min de plus ; le job plafonne à 30 min, il en consomme 2).
3. Documenter dans `AGENTS.md` que les budgets Web Vitals de la section « Performance
   budget » sont, à ce jour, gardés **en desktop uniquement**.

**Effort** : S (workflows uniquement).
**Impact GEO/AEO** : **fort** (indirect) — c'est la gate qui aurait dû attraper les deux
P0 ci-dessus dès leur introduction.
**Risque de régression** : la passe mobile **échouera probablement au premier run**
(preset mobile = CPU ×4, réseau lent 4G). D'où l'exigence de démarrer en WARN : passer
directement en ERROR bloquerait tous les déploiements.
**Do-not-touch** : `lighthouserc.postdeploy.json` (dérogation CLS 0,1 sur `/fr/audit`,
motivée par un artefact cold-start documenté) ; le step warm-up
`deploy-coolify.yml:619-621` ; le bloc `_assert_doctrine` de `lighthouserc.json`.

---

### [P1] `aria-label` plus court que le texte visible : WCAG 2.5.3 (niveau A) échoué sur la home et ~4 300 pages villes

**Symptôme.** Les 5 cartes de services portent un `aria-label` court (« Audit IA ») alors
que leur contenu visible est bien plus long (« Audit IA / Diagnostic & roadmap /
Cartographie complète de vos gains potentiels… / à partir de X € / Découvrir »).
`aria-label` **écrase** le nom accessible : le nom calculé ne **contient plus** le texte
visible. Conséquence directe : un utilisateur de commande vocale qui dit « Diagnostic et
roadmap » n'active rien. C'est le critère WCAG 2.5.3 *Label in Name*, **niveau A**.

**Preuve code.** `src/components/services/ServicesGrid.tsx:196-205` :
```tsx
// aria-label textuel : titre s'il est une string, sinon nom officiel.
const ariaName = typeof displayName === "string" ? displayName : official;
...
<Link href={href} aria-label={cardAriaLabel?.(ctx) ?? ariaName} ...>
```
Appelé depuis `src/app/[locale]/page.tsx:497` (home, variante `showcase`) et depuis les
pages villes (`src/app/[locale]/implantations/[region]/[ville]/page.tsx:636`, section
« Nos 5 services »).

**Preuve live (2026-08-14 22:52 UTC).** Analyse du HTML servi :
- `/fr` : 14 couples `aria-label` / texte visible non contenus, dont les 5 cartes services
  (`label="Formations IA"` vs texte visible « Formations IA · IA en entreprise · Ateliers
  pratiques animés dans votre entreprise… »).
- `/fr/implantations/ile-de-france/paris` : **5 occurrences**, les 5 cartes services
  (`label="Audit IA"` vs « Audit IA · Diagnostic IA de vos processus à Paris — 3 chantiers
  prioritaires… »).
Corroboré par le gate Lighthouse nightly (2026-08-14 04:55 UTC) :
`label-content-name-mismatch` **score 0** sur `/fr` **et** sur
`/fr/implantations/ile-de-france/paris` (« all values: 0, 0, 0 » sur 3 runs).

**Pourquoi la gate axe ne le voit pas.** La règle `label-content-name-mismatch` est
**expérimentale** dans axe-core, donc `enabled: false` par défaut : un filtrage par tags
(`tests/e2e/a11y.spec.ts:74-76`, `.withTags(["wcag2a", ...])`) ne réactive pas une règle
désactivée. Lighthouse, lui, l'active. La gate nocturne est donc verte sur un défaut de
niveau A que Lighthouse signale trois fois par nuit — divergence de jeu de règles entre
deux contrôles qu'on croit redondants.

**Patch prescrit.**
1. `ServicesGrid.tsx` : remplacer `aria-label` par `aria-labelledby` pointant l'élément de
   titre visible de la carte (`id` dérivé de `useId()`/`serviceId`). Le nom accessible
   redevient le titre visible → contenu, donc conforme.
   Repli acceptable : supprimer purement `aria-label` (le nom se calcule alors depuis tout
   le contenu de la carte — verbeux mais conforme).
2. `tests/e2e/a11y.spec.ts` : activer explicitement les règles concernées —
   `.options({ rules: { "label-content-name-mismatch": { enabled: true } } })` — pour que
   la gate cesse d'être structurellement aveugle à cette classe.

**Effort** : S (composant unique + spec).
**Impact GEO/AEO** : **moyen** — pas d'effet direct sur le classement, mais le nom
accessible est la chaîne que consomment les agents (commande vocale, navigation assistée,
agents de type Operator/Computer-Use). Sur les 5 CTA commerciaux du site et sur ~4 300
pages villes, c'est la surface d'entrée du tunnel.
**Risque de régression** : faible ; vérifier qu'aucun test de snapshot n'assert
`aria-label` sur ces cartes.
**Do-not-touch** : `src/components/services/services-visual.ts` (SSOT icône/accent),
la SSOT `SERVICE_BY_ID`, et l'ordre des services (il alimente le JSON-LD `Service`, cf.
`page.tsx:494` « ordre = SERVICES … ne pas retirer »).

---

### [P1] Deux `<main>` sur ~291 pages publiques : le contenu principal n'est plus identifiable

**Symptôme.** Le layout racine émet `<main id="main">` ; plusieurs pages en émettent un
**second** à l'intérieur. axe le signale trois fois (`landmark-no-duplicate-main`,
`landmark-unique`, `landmark-main-is-top-level`). Pour un extracteur (Readability, pipeline
de chunking d'un moteur de réponse, lecteur d'écran), « le contenu principal » devient
ambigu — et l'algorithme retient souvent le premier, c'est-à-dire le conteneur qui inclut
aussi le fil d'Ariane et les blocs périphériques.

**Preuve code.**
- Layout : `src/app/[locale]/layout.tsx:305` — `<main id="main" className="flex-1">`.
- Doublons publics : `src/app/[locale]/appel/page.tsx:135` (`<main id="main-content">`),
  `src/app/[locale]/galerie/page.tsx:183`, `src/app/[locale]/galerie/[slug]/page.tsx:243`.
- Doublons hors périmètre d'indexation (à corriger par cohérence, sans enjeu GEO) :
  `src/app/[locale]/espace-ressources/layout.tsx:66`,
  `src/components/espace/EspaceShell.tsx:273`,
  `src/app/[locale]/(admin)/[adminPrefix]/layout.tsx:386,398`.

**Preuve live (2026-08-14 22:47:06 → 22:53:34 UTC, émulation Pixel 7).**
- `/fr/appel` → `document.querySelectorAll("main").length === 2`
- `/fr/galerie` → `2`
- axe-core sur `/fr/galerie` : `landmark-no-duplicate-main` (moderate, nœud
  `<main id="main" class="flex-1">`), `landmark-unique`, `landmark-main-is-top-level`
  (nœud `<main class="container mx-auto px-4 py-12">`).
- Corroboré par la gate nocturne du 2026-08-14 04:48:56 UTC : `/fr/appel` — 3 violations
  *moderate* exactement identiques.
**Volume** : `/fr/appel` + `/fr/galerie` + les fiches `/fr/galerie/<slug>` —
**289 URLs** déclarées dans `/sitemaps/images-fr.xml` (mesuré 22:57 UTC) → **~291 pages
publiques**.

**Root-cause.** Les pages concernées ont été écrites comme des pages autonomes (chacune
pose son propre `<main>`), sans que la revue remarque que le layout en pose déjà un.
Le seuil de la gate (`serious|critical` seulement, `a11y.spec.ts:78-89`) classe ces
violations en *moderate* → jamais bloquantes, jamais traitées.

**Patch prescrit.**
1. Remplacer les `<main>` internes par `<div>` ou `<section aria-labelledby=…>` dans les
   3 fichiers publics. Le `<main id="main">` du layout reste l'unique repère (et reste la
   cible du lien d'évitement, `src/components/a11y/SkipToContent.tsx:9`).
2. Ajouter une garde statique (test unitaire ou règle ESLint maison) : « aucun `<main>`
   sous `src/app/[locale]/**/page.tsx` ». Sans elle, le défaut reviendra.
3. Optionnel : abaisser le seuil de `a11y.spec.ts` à `moderate` pour la seule famille
   `landmark-*` (les *moderate* restants — `heading-order` — sont traités au finding
   suivant).

**Effort** : S.
**Impact GEO/AEO** : **moyen à fort sur la galerie** — 289 fiches images dont l'extraction
du contenu principal est ambiguë, alors que ces pages existent précisément pour être
comprises et citées.
**Risque de régression** : faible (aucun style attaché à `main` sur ces pages, vérifié :
classes utilitaires uniquement). Attention à ne pas casser `#main-content` s'il est cible
d'une ancre — vérifié : aucune référence à `#main-content` ailleurs dans le dépôt.
**Do-not-touch** : `src/app/[locale]/layout.tsx:305` (le `<main id="main">` canonique) et
`SkipToContent.tsx`.

---

### [P1] Outline de titres cassé (`h1 → h3`) sur des hubs stratégiques

**Symptôme.** Deux causes distinctes produisent le même défaut `heading-order` :
1. **Dans le contenu** : `/fr/cas-concrets` et `/fr/comparaisons` passent directement du
   `<h1>` à un `<h3>`.
2. **Dans le pied de page** : les titres de colonnes sont des `<h3>` (et des `<h4>`) sans
   `<h2>` parent — sur toute page à structure peu profonde, le premier titre après le
   contenu est donc un `h3` qui suit un `h1`/`h2`.

**Preuve code.**
- `src/app/[locale]/cas-concrets/page.tsx:286` — `{isFr ? "Par taille" : "By size"}` en `h3`.
- `src/app/[locale]/comparaisons/page.tsx:209` — `{isFr ? "1. Découverte" : "1. Discovery"}` en `h3`.
- `src/components/nav/Footer.tsx:325` — `<h3 …text-[11px]…>` (titre de colonne) ;
  `Footer.tsx:331` — `<h4 …text-[10px]…>`.

**Preuve live (2026-08-14 22:51-22:53 UTC).** Séquences de titres extraites du HTML servi :
- `/fr/cas-concrets` : `1 3 3 3 3 3 3 3 3 2 3 3 3 4 3 3` → saut `h1 "Ce qu'ils ont
  concrètement gagné"` → `h3 "Par taille"`.
- `/fr/comparaisons` : `1 3 3 3 3 3 3 2 3 3 3 4 3 3` → saut `h1 "Comparaisons IA
  honnêtes"` → `h3 "1. Découverte"`.
- `/fr` : séquence saine (`1 2 3 3 3 …`).
- axe-core mobile sur `/fr/galerie` (22:53:34 UTC) : `heading-order` *moderate*, nœud
  incriminé = `<h3 class="text-mocha-fg/50 …">Services</h3>` → **le footer**.
- Gate nocturne 2026-08-14 04:48-04:49 UTC : `heading-order` *moderate* sur
  `/fr/comparaisons`, `/fr/cas-concrets`, `/fr/connaissances`.

**Root-cause.** Le niveau de titre a été choisi pour sa **taille visuelle** et non pour sa
position dans l'arbre — classique quand la typographie est pilotée par des classes
utilitaires (ici `text-[11px]`, `text-[10px]` : un `h3` qui « fait petit »).

**Patch prescrit.**
1. `Footer.tsx:325` → `h2` ; `Footer.tsx:331` → `h3` (aucun changement visuel : les
   tailles sont imposées par les classes, pas par la balise).
2. `cas-concrets/page.tsx:286` et `comparaisons/page.tsx:209` → `h2` (ou insérer le `h2`
   de section manquant si le `h3` est bien un sous-niveau).
3. Optionnel mais recommandé : ajouter `/fr/comparaisons` et `/fr/cas-concrets` sont déjà
   dans la liste des 15 pages de `a11y.spec.ts:23,25` — il suffit d'abaisser le seuil à
   *moderate* pour `heading-order` afin que le correctif ne régresse pas.

**Effort** : S.
**Impact GEO/AEO** : **moyen** — la hiérarchie de titres est le squelette sur lequel les
moteurs de réponse découpent une page en passages citables. Un `h3` orphelin sous un `h1`
fait de tout le bloc un passage de niveau indéterminé.
**Risque de régression** : nul visuellement (les classes portent la taille). Vérifier
qu'aucun sélecteur CSS/test ne cible `footer h3`.
**Do-not-touch** : la structure du `h1` unique par page (règle SEO du dépôt, cf.
`html-sanitizer.ts:113-115` qui interdit déjà `h1` dans le corps généré).

---

### [P1] La home mobile télécharge 62 Ko d'image hero… jamais affichée

**Symptôme.** Le hero photo de la home est masqué sous 1024 px (`hidden lg:block`). Mais
`next/image priority` émet un `<link rel="preload" as="image">` **non conditionné au
media**, avec `imageSizes="(max-width: 1024px) 100vw, 600px"`. Sur mobile, le navigateur
choisit donc un candidat **plein écran** et le télécharge en priorité haute — pour un
élément qui ne sera jamais peint.

**Preuve live (2026-08-14 22:56:50 UTC, Pixel 7, viewport 412 px, DPR 2,625).**
```json
{"path":"/fr","lcp":{"t":792,"el":"H1"},
 "hero":[{"n":"…home-hero-equipe.avif&w=1200&q=75","kb":62,"t":146}],
 "heroVisible":false,"vw":412}
```
→ **62 Ko téléchargés à t = 146 ms**, soit en plein dans la fenêtre critique du LCP
(mesuré à 792 ms), pour une image dont `getBoundingClientRect().width === 0`.
HTML servi (22:44:05 UTC) :
```html
<link rel="preload" as="image" imageSrcSet="/_next/image?url=%2Fillustrations%2Fhome-hero-equipe.avif&w=640… "
      imageSizes="(max-width: 1024px) 100vw, 600px"/>
…<div class="hidden lg:block"><figure …><img … sizes="(max-width: 1024px) 100vw, 600px" …>
```

**Preuve code.** `src/app/[locale]/page.tsx:425` — `<div className="hidden lg:block">`
enveloppe la `<figure>` du hero (confirmé aussi dans le HTML servi, juste avant la
`<figure>`).
Le comportement est d'ailleurs **déjà documenté** ailleurs : `lighthouserc.json`,
bloc `_assert_doctrine` — « faux positif sur la home /fr en mobile où l'image hero
`home-hero-equipe.avif` est `hidden lg:block` (design assumé, pas de hero photo mobile).
L'élément LCP en mobile est le H1 ». L'audit `lcp-discovery-insight` a été **désactivé**
pour cette raison — mais personne n'a remarqué que l'image continuait d'être *téléchargée*.

**Root-cause.** `priority` (preload) et `hidden lg:block` (rendu conditionnel CSS) sont
décidés à deux endroits différents et ne se parlent pas. Le `sizes` déclare un cas mobile
(`100vw`) qui n'existe pas.

**Patch prescrit** (trois options, par risque croissant) :
1. **Le plus sûr** : corriger `sizes` en `sizes="600px"` — le préchargeur retombe sur le
   candidat 640w (26 Ko mesurés) au lieu de 1200w (62 Ko). Gain : ~36 Ko, 1 ligne.
2. **Le plus propre** : ne rendre le `<figure>` que côté desktop de manière **réelle**
   (pas seulement en CSS) — mais le rendu conditionnel par viewport est impossible en RSC
   sans JS ; une alternative est `<picture>` + `<source media="(min-width:1024px)">`, ce
   qui suppose de sortir de `next/image`.
3. Retirer `priority` du hero home : le LCP mobile (H1) n'en dépend pas, mais le LCP
   **desktop**, lui, en dépend → **à ne faire que si la passe mobile ET desktop du gate
   Lighthouse est en place** (cf. finding gate ci-dessus).
Recommandation : option 1 maintenant, option 3 seulement après remise en place du gate.

**Effort** : S (option 1).
**Impact GEO/AEO** : **moyen** — 36-62 Ko sur le chemin critique de la page la plus
importante du site, en mobile-first.
**Risque de régression** : option 1 = risque sur le LCP **desktop** si l'image y est
affichée plus large que 600 px — vérifié : `sizes` déclare déjà `600px` au-delà de 1024 px,
donc le candidat desktop est inchangé.
**Do-not-touch** : la doctrine `lcp-discovery-insight: "off"` de `lighthouserc.json`
(elle documente précisément ce design) ; ne pas « corriger » le design en ajoutant un hero
photo mobile — c'est un choix assumé.

---

### [P1] `/fr/faq` : 13 174 nœuds DOM et 1 646 éléments interactifs hydratés sur mobile

**Symptôme.** Le hub FAQ rend et hydrate **la totalité** du corpus (1 550 entrées selon le
compteur « Tout 1550 » servi en prod), dans un composant client.

**Preuve code.**
- `src/app/[locale]/faq/page.tsx:100-107` — `explorerItems = faqs.map(...)` : **aucun cap**,
  contrairement au JSON-LD qui est plafonné à 50 (`page.tsx:139-145`, `SCHEMA_MAX = 50`,
  avec le commentaire « le corpus prod peut dépasser 1000 Q/R »).
- `src/components/sections/FaqHubExplorer.tsx:1-8` — `"use client"` et, en commentaire :
  « recherche temps réel + filtres par thème sur **~88 FAQ** […] payload léger, conforme au
  budget Web Vitals ». Le dimensionnement du composant raisonne sur **88** items ; la prod
  en sert **1 550** (×17,6).
- `lighthouserc.json:44-45` : `"dom-size-insight": "off"` et `"dom-size": "off"` → aucun
  garde-fou sur la taille du DOM.

**Preuve live (2026-08-14 22:47:06 UTC, Pixel 7).**
| Mesure | `/fr/faq` | `/fr` (repère) |
|---|---|---|
| Nœuds DOM | **13 174** | 2 377 |
| Éléments interactifs | **1 646** | 140 |
| HTML brut | 3 428 342 o | 1 750 762 o |
| HTML compressé (br) | 305 931 o | 131 389 o |
| CLS mobile | 0 | 0 |
Dont ~1,42 Mo de charge utile RSC (`self.__next_f`) : les 1 550 questions + extraits sont
sérialisés **une seconde fois** pour l'hydratation du composant client.

**Root-cause.** Le cap de volume a été posé sur le JSON-LD (là où on l'a cherché) et pas
sur la liste rendue. Le corpus a été multiplié par ~17 par le content-gen sans que la
supposition d'origine du composant (« ~88 ») soit rejouée.

**Patch prescrit.**
1. Plafonner l'affichage initial (p. ex. 60 items + « Afficher plus », ou pagination
   serveur), en conservant **toutes** les questions accessibles par la recherche via une
   route serveur (`/api` ou Server Action) plutôt qu'un tableau embarqué.
   ⚠️ Contrainte : la liste complète est actuellement dans le HTML initial **pour le SEO/AEO**
   (`FaqHubExplorer.tsx:5`). Un cap naïf retirerait 1 490 questions du HTML → **perte de
   contenu indexable**. La forme sûre : garder les Q/R dans le HTML **en rendu serveur pur**
   (liste `<details>`/liens, non hydratée) et ne passer au client que l'index de recherche
   (`{id, question, category}` sans extrait) — ce qui divise la charge par ~3 sans rien
   retirer aux moteurs.
2. Ré-activer `dom-size` en WARN dans `lighthouserc.json` une fois la passe mobile en place.
3. Mettre à jour le commentaire `FaqHubExplorer.tsx:2-8` (« ~88 FAQ ») : il documente une
   hypothèse fausse, ce qui est pire qu'une absence de commentaire.

**Effort** : M.
**Impact GEO/AEO** : **moyen** — le contenu est bien dans le HTML (bon pour l'AEO), mais
13 k nœuds sur un téléphone d'entrée de gamme se paient en INP et en budget de rendu
Googlebot. À arbitrer avec C5/D5 (qui couvrent la duplication et le corpus KB).
**Risque de régression** : **élevé sur le SEO/AEO si le patch est mal fait** — toute
solution qui sort les Q/R du HTML initial est une régression nette. Interdire les
solutions « virtualisées » côté client.
**Do-not-touch** : `page.tsx:139-145` (cap JSON-LD à 50 + doctrine « rich results FAQ
dépréciés »), `buildFaqSpeakableJsonLd` et les sélecteurs `[data-faq-q]`/`[data-faq-a]`
(Speakable), `resolvePriceTokensDeep` (`page.tsx:90`).

---

### [P2] Images inline des articles : hotlink Unsplash 261 Ko, sans `loading`, ni dimensions

**Symptôme.** Les figures insérées dans le corps des articles pointent directement sur
`images.unsplash.com` (JPEG 1080w), sans `loading="lazy"`, sans `width`/`height`, avec un
`alt` anglais générique.

**Preuve live (2026-08-14 22:48:51 UTC).** Dans
`/fr/blog/mentor-ia-dirigeant-auvergne-rhone-alpes-grenoble` :
```html
<figure><img src="https://images.unsplash.com/photo-1575350555350-…&fm=jpg&q=80&w=1080"
 alt="a person standing on a sidewalk next to a yellow sign"><figcaption>Photo de …
```
Poids transféré : **261 Ko**. Sondage mobile (22:55:55 UTC) : `nbSansDim: 6`,
`nbSansLazy: 2` sur 10 images de la page. **CLS mesuré = 0** (aucun décalage constaté) et
**LCP = 756 ms** — donc pas de dégât mesurable aujourd'hui, mais 261 Ko chargés en
« eager » sur une image située très bas dans l'article.

**Preuve code.** `src/server/content-gen/images/inject-body-images.ts:127-133`
(`buildFigure`) émet **pourtant** `loading="lazy" width="${w}" height="${h}"`, et
`src/server/content-gen/shared/html-sanitizer.ts:78-92` autorise bien ces attributs.
→ Le stock d'articles en base a donc été **généré avant** l'ajout de ces attributs, et la
production de contenu est arrêtée depuis le 2026-07-20 (fait acté) : **rien ne le
rattrapera tout seul**.

**Patch prescrit.**
1. Backfill ciblé (script de lecture/écriture DB, hors périmètre de cet audit) :
   ajouter `loading="lazy" decoding="async"` aux `<img>` de `<figure>` dans le HTML stocké.
2. Ou, sans toucher aux données : post-traitement au rendu (regex sur `bodyHtml` avant
   `dangerouslySetInnerHTML`) — plus sûr, réversible, et couvre le stock comme le futur.
3. Filet CSS : `article figure img { aspect-ratio: 3/2; width: 100%; height: auto; }` pour
   garantir la réservation d'espace même sans attributs (CLS = 0 aujourd'hui, mais par
   chance de séquencement).
Le point `alt` anglais générique relève de **E2 (sémantique image)** — signalé ici pour
recoupement, non compté comme finding G4.

**Effort** : S (option 2).
**Impact GEO/AEO** : **faible à moyen**.
**Risque de régression** : faible ; ne pas ré-écrire l'URL Unsplash (les conditions de
licence Unsplash imposent le hotlink + l'attribution, cf. `buildFigure` lignes 130-131).
**Do-not-touch** : `UNSPLASH_LINK`, la `<figcaption>` d'attribution, `html-sanitizer.ts`
(allowlist).

---

### [P2] Cibles tactiles : conformes WCAG 2.2 AA, sous la recommandation sur le tunnel de conversion

**Symptôme.** Aucune violation du critère **2.5.8 Target Size (Minimum)** — tous les
contrôles autonomes mesurés font ≥ 24 × 24 px. En revanche, beaucoup se situent **entre 24
et 44 px**, dont les créneaux de réservation, sur la page où un mis-clic coûte le plus.

**Preuve live (2026-08-14 22:47:06 UTC, Pixel 7 / 412 px).**
| Page | Contrôles visibles | < 24 px | 24-44 px | Débordement horizontal |
|---|---|---|---|---|
| `/fr` | 140 | 44 (tous des **liens en ligne dans du texte** → exemptés par 2.5.8) | 51 | non (412 = 412) |
| `/fr/appel` | 96 | 5 (liens en ligne) | **71** (créneaux 40 × 40) | non |
| `/fr/implantations/…/paris` | 82 | 9 (liens en ligne) | 47 | non |
| `/fr/faq` | 1 646 | 14 (liens en ligne) | 56 | non |
| `/fr/galerie` | 106 | 3 (liens en ligne) | 67 (pagination **24 × 36**) | non |

La pagination galerie (24 × 36 px) est **exactement à la limite** du critère : toute
réduction future la fait basculer en non-conformité.

**Patch prescrit** : porter les créneaux de `/fr/appel` et la pagination galerie à
44 × 44 px minimum (padding, pas de changement de police). Non bloquant.
**Effort** : S. **Impact GEO/AEO** : **faible** (impact conversion, pas classement).
**[À CONFIRMER]** : l'audit Lighthouse `target-size` en **preset mobile** n'a pas pu être
exécuté (voir « Limites ») ; le verdict ci-dessus repose sur mes mesures de boîtes
englobantes, pas sur l'algorithme de Lighthouse (qui pondère aussi l'espacement entre
cibles voisines).

---

### [P2] Texte sous le seuil de lisibilité mobile (10-11 px)

**Preuve live (2026-08-14 22:47-22:53 UTC).**
- `/fr/galerie` : **48 éléments** à **10 px** (« CC BY 4.0 », « ville » — les métadonnées de
  chaque vignette).
- `/fr` : 14 éléments à 11 px (« La certification qualité a été… », « à partir de »,
  libellés de secteurs).
- Pied de page : `Footer.tsx:325` `text-[11px]`, `Footer.tsx:331` `text-[10px]`.

Le seuil usuel de Lighthouse / des recommandations mobiles est **12 px**. À 10 px, la
mention de licence CC BY 4.0 — qui est précisément le signal de réutilisabilité destiné
aux moteurs et aux humains (cf. E1/E3) — est illisible sur téléphone.
**Patch** : plancher à 12 px sur les libellés de vignette et le footer.
**Effort** : S. **Impact** : faible. **Risque** : impact visuel (densité du footer).

---

### [P2] `/_next/image` n'est jamais mis en cache par Cloudflare

**Preuve live (2026-08-14 22:44:05 puis 22:45:29 UTC).**
```
HEAD /_next/image?url=…&w=128&q=75  (Accept: image/avif)
→ content-type: image/avif · vary: Accept · cache-control: public, max-age=31536000, must-revalidate
→ 1er appel : x-nextjs-cache: MISS · cf-cache-status: DYNAMIC
→ 2e appel  : x-nextjs-cache: HIT   · cf-cache-status: DYNAMIC
```
La négociation AVIF/WebP fonctionne parfaitement (2 123 o en AVIF vs 2 714 o en WebP pour
la même variante — **aucun finding sur ce point**, `next.config.ts:142-153` est correct,
`minimumCacheTTL` à 1 an inclus). Mais `cf-cache-status: DYNAMIC` sur les deux appels :
Cloudflare ne met **jamais** en cache `/_next/image` (URL sans extension de fichier).
Chaque variante d'image repart donc jusqu'à l'origine Hetzner à chaque visiteur — latence
mobile inutile, charge origine inutile.
**Patch** : règle de cache Cloudflare (Cache Rule) sur `/_next/image*` → *Eligible for
cache*, Edge TTL 1 an, **en respectant `vary: Accept`** (sinon un visiteur sans support
AVIF reçoit de l'AVIF — régression réelle). Sur plan Free, `vary` n'est pas honoré pour
autre chose que `Accept-Encoding` : **ne pas appliquer** sans validation, ou passer par une
Cache Rule avec *Custom Cache Key* incluant l'en-tête `Accept`.
**Effort** : S (config Cloudflare, action Will).
**Impact GEO/AEO** : faible à moyen. **Risque** : **réel** (servir un format non supporté) —
d'où la réserve ci-dessus.

---

### [P2] Divers, recoupés avec d'autres agents (non développés ici)

- `la-poste.svg` = **99 672 octets** (`public/logos/clients/la-poste.svg`), chargé sur les
  pages villes (67 Ko transférés mesurés sur `/fr/implantations/auvergne-rhone-alpes/grenoble`
  à 22:47:54 UTC) : un SVG de 97 Ko est un SVG mal exporté (chemins non simplifiés).
  → recoupe E3 (qualité visuelle).
- `errors-in-console` **score 0** sur les 4 URLs du nightly (2026-08-14 04:55 UTC), et
  `categories.best-practices` = **0,74** partout. La cause connue et documentée
  (`lighthouserc.json` `_assert_doctrine`) est le script Cloudflare *JavaScript Detections*
  — mais `errors-in-console` signale des **erreurs**, pas des dépréciations. → à trancher
  par **G1/G2**, hors de ma surface.
- Sur `/fr/appel`, l'élément LCP mobile mesuré est un `<p>` du bandeau de consentement
  (« Plausible (anonyme, EU, sans cookie) est… », LCP 772 ms) : le bandeau domine le premier
  écran mobile de la page de conversion. → recoupe **G2** (consentement/cloaking).
- Le prefetch RSC de Next représente **1 043 Ko** sur une page ville et **1 162 Ko** sur la
  home (transféré, après défilement complet) : c'est le comportement normal de
  `next/link`, mais sur 4G c'est le deuxième poste de trafic après les images.
  → à arbitrer avec **G1** (bundles), pas un défaut en soi.

---

## Points vérifiés et **conformes** (aucun finding — ne pas re-signaler)

| Vérification | Résultat | Preuve |
|---|---|---|
| `viewport` | `width=device-width, initial-scale=1`, **aucun** `maximum-scale`/`user-scalable=no` (zoom non bridé) | `src/app/[locale]/layout.tsx:112-117` ; HTML servi 22:44:05 UTC |
| `theme-color` | présent (`#c24a1b`) | `layout.tsx:115` |
| Négociation AVIF | ✅ `image/avif` servi, `vary: Accept`, repli WebP correct | 22:44:05 UTC |
| Formats `next/image` | `["image/avif","image/webp"]`, `minimumCacheTTL` 1 an | `next.config.ts:142-153` |
| CLS mobile | **0** sur `/fr`, `/fr/appel`, `/fr/paris`, `/fr/faq`, `/fr/galerie`, article blog, `/fr/connaissances`, `/fr/cas-concrets` | 22:47 et 22:55 UTC |
| LCP mobile | 792 ms (`/fr`, H1) · 772 ms (`/fr/appel`) · 756 ms (article, image préchargée) · 328 ms · 484 ms | 22:55:55 et 22:56:50 UTC |
| Anti-pattern « LCP en lazy » | **absent** : aucun élément LCP mesuré ne porte `loading="lazy"` ; les héros villes et articles sont bien `priority` + `preload` | 22:48-22:56 UTC |
| Débordement horizontal mobile | aucun (`scrollWidth == clientWidth == 412`) sur 6 pages | 22:47:06 UTC |
| axe *serious/critical* | **0** sur 15 pages desktop (nightly 04:48 UTC) **et 0** en viewport mobile sur `/fr` menu ouvert, article blog, galerie | 22:53:34 UTC |
| Lien d'évitement | présent, premier focusable, cible `#main` existante | `SkipToContent.tsx:8-14` |
| `prefers-reduced-motion` | pris en charge (3 blocs `@media` dans `globals.css:591,598,1162`) | lecture code |
| Menu mobile | 0 violation axe, 1 bouton + 33 liens exposés, pas de piège au clavier détecté | 22:53:34 UTC |

---

## Mesures brutes

### Poids transféré, émulation Pixel 7, après défilement complet (2026-08-14 22:47:54 UTC)

| URL | Total | HTML | Images | Scripts | Prefetch RSC | Plus grosse ressource |
|---|---|---|---|---|---|---|
| `/fr` | **3 772 Ko** | 131 Ko | 1 988 Ko | 320 Ko | 1 162 Ko | `qualiopi/axion-ia-qualiopi.png` **1 274 Ko** |
| `/fr/blog/mentor-ia-dirigeant-…-grenoble` | **4 497 Ko** | 110 Ko | 3 165 Ko | 309 Ko | 749 Ko | `auteurs/manon.png` **1 459 Ko** |
| `/fr/implantations/auvergne-rhone-alpes/grenoble` | **1 841 Ko** | 103 Ko | 138 Ko | 316 Ko | 1 043 Ko | hero ville AVIF 134 Ko |

### Poids du document HTML (2026-08-14 22:43:40 UTC)

| URL | HTTP | Brut | Compressé (br/gzip) | Temps |
|---|---|---|---|---|
| `/fr` | 200 | 1 750 762 o | 131 389 o | 0,114 s |
| `/fr/appel` | 200 | 2 087 230 o | 157 210 o | 0,281 s |
| `/fr/galerie` | 200 | 1 246 996 o | 90 975 o | 0,204 s |
| `/fr/implantations/ile-de-france/paris` | 200 | 1 267 000 o | 100 527 o | 0,106 s |
| `/fr/audit` | 200 | 2 165 966 o | 189 715 o | 0,121 s |
| `/fr/faq` | 200 | 3 453 028 o | 305 931 o | 0,166 s |

### Sonde mobile — structure & interaction (2026-08-14 22:47:06 UTC)

| URL | Nœuds DOM | Interactifs | `<main>` | `<h1>` | CLS | < 24 px | 24-44 px | Texte < 12 px |
|---|---|---|---|---|---|---|---|---|
| `/fr` | 2 377 | 140 | 1 | 1 | 0 | 44 | 51 | 14 |
| `/fr/appel` | 1 416 | 96 | **2** | 1 | 0 | 5 | 71 | 4 |
| `/fr/implantations/ile-de-france/paris` | 1 021 | 82 | 1 | 1 | 0 | 9 | 47 | 6 |
| `/fr/faq` | **13 174** | **1 646** | 1 | 1 | 0 | 14 | 56 | 3 |
| `/fr/galerie` | 680 | 106 | **2** | 1 | 0 | 3 | 67 | **48** |

### axe-core en viewport mobile (Pixel 7) — surfaces hors gate (2026-08-14 22:53:34 UTC)

| Surface | serious/critical | moderate/minor |
|---|---|---|
| `/fr`, menu mobile **ouvert** | **0** | 0 |
| Article `/fr/blog/mentor-ia-dirigeant-…` | **0** | 0 |
| `/fr/galerie` | **0** | `heading-order`, `landmark-main-is-top-level`, `landmark-no-duplicate-main`, `landmark-unique` |

### Artefacts CI exploités (lecture seule, `gh run view`)

| Run | Job | Date UTC | Verdict |
|---|---|---|---|
| `31770966460` | A11y axe-core vs prod (15 pages) | 2026-08-14 04:48 | **15 passed** (chromium desktop) |
| `31770966460` | Lighthouse history (5 URLs, preset **desktop**) | 2026-08-14 04:55 | assertions en échec : `image-delivery-insight` 0 et `uses-responsive-images` sur `/fr/appel`, `label-content-name-mismatch` 0 sur `/fr` et `/paris`, `best-practices` 0,74 partout |
| 6 runs `nightly.yml` (08-09 → 08-14) | workflow global | — | **failure** chaque nuit (causes : `pnpm audit`, `zap-baseline` timeout) |

---

## Limites

1. **Aucun Lighthouse en lab** (contrainte machine : audit nocturne sur le poste de Will).
   Je n'ai donc **pas** de score Performance/Accessibilité mobile, pas de TBT, pas d'INP
   simulé, pas de verdict `target-size` au sens de l'algorithme Lighthouse. Tout ce qui en
   dépend est marqué `[À CONFIRMER]`.
2. **Aucune donnée terrain (CrUX / Web Vitals réels)** : je n'ai pas interrogé l'API CrUX
   ni GSC (Core Web Vitals). Mes LCP/CLS sont des mesures **lab non throttlées**, en
   émulation Pixel 7 depuis une connexion fibre — elles **sous-estiment** structurellement
   le coût réel des 2,7 Mo d'images sur 4G. C'est la vérification la plus utile à faire
   ensuite (F2 a l'accès GSC).
3. **iOS / WebKit non testé** : le projet Playwright `mobile-safari` (iPhone 14 Pro) existe
   mais je ne l'ai pas exécuté (budget machine). Les comportements spécifiques Safari
   (`-webkit-` sur `aspect-ratio`, gestion de `loading="lazy"`, AVIF sur iOS < 16) restent
   non vérifiés.
4. **axe mobile sur 4 surfaces seulement** (menu ouvert, article, galerie, `/fr`) et non
   sur les 15 pages de la spec : je n'ai pas voulu faire tourner 15 × 2 contextes navigateur
   la nuit. Les 11 autres pages ne sont couvertes qu'en **desktop** (artefact nightly).
5. **Contraste des couleurs non audité en propre** : l'audit `color-contrast` est en WARN
   dans `lighthouserc.json:59` et axe ne l'a pas signalé, mais je n'ai pas vérifié les
   textes sur images/dégradés en mobile (où le recadrage change les fonds).
6. **Le volume « ~4 300 pages villes »** utilisé pour chiffrer l'impact du finding
   `label-content-name-mismatch` est repris du digest commun (D4), pas re-mesuré par moi.
   Idem pour « 1 550 FAQ » (lu sur le compteur servi en prod, non vérifié en base — je n'ai
   pas les droits DB dans mon périmètre).
7. **Le poids réel du logo Qualiopi après optimisation** (annoncé « ~40-70 Ko ») est une
   estimation : je n'ai pas exécuté d'optimiseur (interdiction d'écrire hors du dossier
   d'audit).
8. **Cloudflare** : je n'ai pas accès au tableau de bord CF — le constat `cf-cache-status:
   DYNAMIC` est déduit des en-têtes, la règle de cache existante (ou non) sur
   `/_next/image` n'a pas été lue à la source.
