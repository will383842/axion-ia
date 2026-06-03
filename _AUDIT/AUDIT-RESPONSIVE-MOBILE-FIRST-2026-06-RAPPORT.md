# Rapport d'audit Responsive / Mobile-first — 2026-06-03

> Phase 1 (LECTURE SEULE) terminée. Aucun fichier de code modifié. Seul ce rapport a été écrit.
> Méthode : analyse statique exhaustive du système de largeur partagé + composants nav + archétypes représentatifs.
> Les largeurs de déclenchement des symptômes B et A sont **calculées exactement** depuis le CSS (déterministes).
> Les largeurs du symptôme C sont **estimées** depuis le code (largeurs de glyphes non mesurées au pixel) et marquées `≈` — à confirmer visuellement en début de Phase 2.

---

## Synthèse exécutive

**Verdict global.** Le système de largeur du site repose sur **trois définitions divergentes** qui ne sont jamais réconciliées : le **contenu** est plafonné et centré (`Container` → `max-w-[1520px] mx-auto`), tandis que le **Header** (`w-full`, aucun cap) et le **Footer** (full-width, aucun cap) s'étendent jusqu'aux bords du viewport. À cela s'ajoutent **trois rampes de gouttières latérales différentes** (header / contenu / footer) qui ne s'alignent à AUCUN breakpoint. Le résultat est exactement ce que Will décrit : bascule visuelle 14″/16″, header/contenu/footer désalignés sur grand écran, et — le plus grave — un **header qui déborde et se fait rogner sur toute la plage ~992 → ~1450 px** parce que la nav desktop apparaît trop tôt (à `lg` = 992 px) pour la quantité de contenu (logo `shrink-0` + 6 items à `gap-12/16` non-rétractables + double CTA `shrink-0`), sans `flex-wrap` ni `overflow` géré. Les fondations (mobile-first, touch targets footer 44px, drawer Radix avec focus-trap, `contain` footer, `display:optional` Fraunces, aspect-ratios images) sont **saines** — le problème est concentré dans la **couche de largeur partagée**, donc corrigeable de façon centralisée.

**Top 3 problèmes P0**
1. **Header déborde et se fait couper de ~992 à ~1450 px** (Symptôme C) — la nav desktop s'active à `lg`=992 alors que le contenu ne rentre pas avant ~1450 px ; CTA primaire « Réserver un appel » rogné/poussé hors écran, risque de scroll horizontal. `Header.tsx:79,118,132`.
2. **Désalignement Header/Contenu/Footer au-delà de 1520 px** (Symptôme B) — contenu centré à 1520 vs header/footer pleine largeur → décalage de bord gauche de **+112 px à 1728 px**, **+208 px à 1920**, **+528 px à 2560**. `Container.tsx:22` vs `Header.tsx:79` vs `Footer.tsx:97`.
3. **Bascule « plein écran ↔ marges » exactement entre 14″ et 16″** (Symptôme A) — le seuil `max-w-[1520px]` tombe entre 1512 (14″) et 1728 (16″). `Container.tsx:22`.

**Confirmation chiffrée des symptômes**
- **A** : seuil = **1520 px**. À ≤1520 le contenu remplit la largeur (gouttières seules) ; à >1520 il se centre. 14″=1512 → plein écran ; 16″=1728 → 104 px de marge centrée par côté (168 px de blanc total avec la gouttière). **Confirmé.**
- **B** : header/footer **sans `max-width`** vs contenu plafonné 1520. Décalage bord gauche = `(W−1520)/2 + gouttière_contenu − gouttière_header`. À 1728 px = **+112 px**. **Confirmé.**
- **C** : nav desktop visible dès **992 px** (`lg:flex`) ; largeur de contenu requise estimée **≈1400–1450 px** → débordement sur **toute la plage 992–~1450 px**. Premier élément rogné : **CTA primaire « Réserver un appel »** (le plus à droite). **Confirmé structurellement** (chiffrage exact à valider visuellement).

---

## Cause(s) racine du système de largeur

### Tableau Header vs Container vs Footer

| Aspect | **Container** (contenu) | **Header** | **Footer** |
|---|---|---|---|
| Fichier | `Container.tsx:22` | `Header.tsx:79` | `Footer.tsx:97` |
| `max-width` | **`max-w-[1520px]`** | ❌ aucune (`w-full`) | ❌ aucune (full-width) |
| Centrage | **`mx-auto`** | ❌ non | ❌ non |
| Classe gouttières | `px-4 sm:px-6 lg:px-10 xl:px-16` | `px-6 sm:px-8 lg:px-10 xl:px-14` | `px-6 md:px-8 lg:px-12 xl:px-16` |

**Gouttière effective (px par côté, selon breakpoints custom 479/640/768/992/1280) :**

| Viewport | Container | Header | Footer | Alignés ? |
|---|---|---|---|---|
| < 640 (base) | **16** | 24 | 24 | ❌ contenu 8 px plus près du bord que header/footer |
| 640 (`sm`) | 24 | 32 | 24 | ❌ header +8 |
| 768 (`md`) | 24 | 32 | 32 | ❌ contenu −8 |
| 992 (`lg`) | 40 | 40 | 48 | ❌ footer +8 |
| 1280 (`xl`) | 64 | 56 | 64 | ❌ header −8 |

➡️ **Les trois zones ne partagent un bord gauche commun à AUCUN breakpoint.** Au mieux deux des trois coïncident, jamais les trois.

### Explication Symptôme A (14″ vs 16″)
`Container` : `max-w-[1520px] mx-auto`. En dessous de 1520 px de viewport, la contrainte `max-w` est inactive → le contenu occupe `100% − 2×gouttière` (≈ pleine largeur). Au-dessus de 1520, le contenu se fige à 1520 et `mx-auto` répartit l'excédent en marges latérales.
- **14″ MacBook = 1512 px CSS** → 1512 < 1520 → **plein écran** (8 px sous le seuil).
- **16″ MacBook = 1728 px CSS** → 1728 > 1520 → marge centrée = `(1728−1520)/2 = 104 px` par côté + gouttière `xl` 64 = **168 px de blanc latéral**.
La bascule de ressenti est donc **exactement** au passage 1512→1728, comme signalé. Le seuil 1520 est mal placé : il coupe la famille MacBook en deux.

### Explication Symptôme B (désalignement > 1520)
Le contenu est centré à 1520 ; header et footer collent les bords. Bord gauche du **contenu** = `(W−1520)/2 + gouttière_contenu`. Bord gauche du **header** = `gouttière_header`. Décalage :

| Viewport | Bord gauche contenu | Bord gauche header | **Décalage** |
|---|---|---|---|
| 1728 (16″) | 104 + 64 = 168 | 56 | **+112 px** |
| 1920 | 200 + 64 = 264 | 56 | **+208 px** |
| 2560 (ultra-wide) | 520 + 64 = 584 | 56 | **+528 px** |

Le logo (header) et le copyright (footer) dérivent de plus en plus à gauche du premier mot du contenu à mesure que l'écran s'élargit → impression nette de « header pas aligné ». Idem à droite (CTA header vs bord droit du contenu).

### Explication Symptôme C (header coupé 992–~1450)
La nav desktop apparaît dès `lg` = **992 px** (`Header.tsx:118` `hidden … lg:flex`). Le rang flex unique (`Header.tsx:79` `flex h-20 w-full … gap-4 … lg:gap-8 … xl:gap-10`) contient, **sans `flex-wrap` ni `overflow`** :

- **Bloc logo** `shrink-0` (`Header.tsx:84`) — badge serif + tagline « Cabinet IA pour entreprises » `lg:block` (`Header.tsx:107`).
- **Nav 6 items** `gap-12 xl:gap-16` (`Header.tsx:118`) = **48 px** de gap à `lg` (64 px à `xl`) × 5 = **240 px** rien qu'en gaps ; les items non-multiline portent `whitespace-nowrap` (`NavLink.tsx:54`) → **ne rétrécissent pas**.
- **Bloc dual-CTA** `shrink-0` `ml-auto` (`Header.tsx:132`) — « Nous écrire » (h-11, px-4) + « Réserver un appel » (h-11, px-5) + `gap-3`.

Estimation de largeur de contenu requise : logo ≈150 + gap 32 + nav (labels ≈575 + gaps 240 ≈ **815**) + dual-CTA ≈327 ≈ **~1324 px** de contenu à `lg`. Largeur intérieure disponible : à 992 px = `992 − 80` (gouttières px-10) = **912 px** → **déficit ≈ 410 px**. À `xl` (1280) les gaps **augmentent** (gap-16) et la tagline reste → le besoin monte vers **~1400 px** alors que l'intérieur n'est que `1280 − 112 = 1168 px` → **toujours en débordement**. Le contenu ne rentre que vers **~1450–1520 px**.

Comme logo et CTA sont `shrink-0` et la nav non-rétractable, l'excédent **déborde à droite** (header non `overflow-hidden`) : le **CTA primaire « Réserver un appel » (élément le plus à droite) est rogné / poussé hors viewport en premier**, puis « Nous écrire ». Risque de **scroll horizontal** de page tant que `<992` ne bascule pas enfin sur le drawer mobile. C'est le « header qui se fait couper jusqu'à passer en mode mobile » décrit par Will.

> ⚠️ Chiffres de C = estimation (glyphes non mesurés). La **cause structurelle** (breakpoint drawer à 992 trop bas + `shrink-0`/`nowrap` + gaps fixes 48/64 + absence de wrap/overflow) est **certaine dans le code**. Première action Phase 2 : confirmer la largeur exacte de coupure au dev server.

### Schéma ASCII des bords (viewport 1728 px, 16″)

```
|<-56->[LOGO ......... nav ......... Nous écrire][Réserver]   |   ← HEADER  (bord gauche @56)
|<----- 168 ----->[ Premier mot du contenu .................]|   ← CONTENU (bord gauche @168, centré 1520)
|<-64->[© 2026 …  colonnes footer …                 ]        |   ← FOOTER  (bord gauche @64)
        ^^^^^^^^ décalage header→contenu = +112 px
```

---

## Findings détaillés

### [P0] Header déborde / CTA rogné sur 992–~1450 px (Symptôme C)
- **Fichier** : `Header.tsx:79` (flex single-row, pas de wrap), `:118` (`lg:flex` + `gap-12 xl:gap-16`), `:132` (CTA `shrink-0 ml-auto`), `:84` (logo `shrink-0`), `NavLink.tsx:54` (`whitespace-nowrap`).
- **Archétype/zone** : Header (global, ~toutes les routes).
- **Largeur(s) de déclenchement** : **~992 → ~1450 px** (estimé).
- **Symptôme observé** : éléments de droite (CTA primaire puis secondaire) rognés/hors écran ; risque de scroll horizontal ; aucun `flex-wrap`/`overflow` pour absorber.
- **Impact** : UX majeure (CTA de conversion inaccessible) + risque CLS/scroll-H + Web Vitals (INP si reflow).
- **Piste (NON appliquée)** : avancer le breakpoint du drawer de `lg`→`xl` (drawer < 1280) **et/ou** nav condensée 992–1280 (gaps réduits, tagline `xl:` only, CTA secondaire masqué < xl). Cf. §10.2.

### [P0] Header & Footer sans `max-width` → désalignement > 1520 px (Symptôme B)
- **Fichier** : `Header.tsx:79` (`w-full`), `Footer.tsx:97` (full-width), vs `Container.tsx:22` (`max-w-[1520px] mx-auto`).
- **Archétype/zone** : Header + Footer (globaux).
- **Largeur(s) de déclenchement** : **> 1520 px** (s'aggrave avec la largeur).
- **Symptôme observé** : décalage bord gauche **+112 px @1728**, **+208 @1920**, **+528 @2560** entre contenu et header/footer.
- **Impact** : UX (cohérence visuelle), perçu comme « header pas aligné ».
- **Piste (NON appliquée)** : contraindre le contenu interne de Header/Footer au même `max-w-[1520px] mx-auto` que `Container` (fond bord-à-bord conservé). Cf. §10.1.

### [P1] Seuil `max-w-[1520px]` mal placé pour la famille MacBook (Symptôme A)
- **Fichier** : `Container.tsx:22`.
- **Archétype/zone** : Container (SSOT largeur contenu) → toutes pages.
- **Largeur(s) de déclenchement** : exactement **1520 px** (entre 14″=1512 et 16″=1728).
- **Symptôme observé** : bascule « plein écran ↔ marges 104 px/côté » entre deux MacBook courants.
- **Impact** : UX (incohérence ressentie selon machine). *Note : des marges sur grand écran ne sont PAS un bug en soi (cf. faux positifs) ; le problème est le placement du seuil + l'incohérence avec header/footer.*
- **Piste (NON appliquée)** : décider d'un seuil documenté (p. ex. relever légèrement au-dessus de 1728 pour que 14″ ET 16″ soient « pleins », ou assumer 1520 mais corriger surtout B). Décision = STOP & ASK Will. Cf. §10.1.

### [P1] Skeletons `loading.tsx` divergent de `Container` (largeur + gouttières) → saut au chargement
- **Fichier** : `app/[locale]/loading.tsx:27,68`, `contact/loading.tsx:8`, `implantations/[region]/[ville]/loading.tsx:10,21,27`, `audit/loading.tsx:7,17`, `reserver/loading.tsx:12,24,31`.
- **Archétype/zone** : skeletons de chargement (multiples templates).
- **Détail** : skeletons en `max-w-[1280px] … lg:px-8 xl:px-12` (et `reserver` en `max-w-[1680px]`), alors que `Container` réel = `max-w-[1520px] lg:px-10 xl:px-16`. Largeur **et** gouttières différentes.
- **Largeur(s) de déclenchement** : tout viewport ≥ 1280 px (écart de largeur) ; toute taille (écart de gouttière).
- **Symptôme observé** : saut horizontal de la mise en page skeleton → contenu réel (1280→1520) à chaque navigation montrant un état de chargement.
- **Impact** : CLS/jank perçu (contrainte CLS=0), incohérence SSOT.
- **Piste (NON appliquée)** : faire consommer `Container` (ou ses tokens de largeur/gouttière) par tous les skeletons.

### [P1] Header `h-20` fixe + labels multiline 2 lignes
- **Fichier** : `Header.tsx:79` (`h-20` = 80 px), labels multiline `Header.tsx:36,42,47` + `NavLink.tsx:54` (`leading-[1.15] whitespace-pre-line`).
- **Archétype/zone** : Header desktop.
- **Largeur(s)** : 992–1280 (zone dense).
- **Symptôme observé** : labels sur 2 lignes (« Coaching / 1 to 1 », « Implémentation / sur-mesure », « Sites web & SaaS / Native IA ») dans une barre de hauteur fixe 80 px → marge verticale faible, et largeur de nav gonflée participant au Symptôme C.
- **Impact** : couplé à C (UX). Vertical : à vérifier qu'aucun label ne déborde sous le hairline.
- **Piste (NON appliquée)** : labels mono-ligne en nav condensée 992–1280 (cf. §10.2), réserver le multiline si réellement nécessaire.

### [P2] Gouttière mobile contenu (16) ≠ header/footer (24) — bords non alignés < 640 px
- **Fichier** : `Container.tsx:22` (`px-4`) vs `Header.tsx:79` (`px-6`) vs `Footer.tsx:97` (`px-6`).
- **Largeur(s)** : < 640 px (mobile).
- **Symptôme observé** : le contenu démarre **8 px plus près du bord** que le logo header et le footer.
- **Impact** : cohérence visuelle mobile (mineur mais systématique).
- **Piste (NON appliquée)** : harmoniser la rampe de gouttières des 3 zones sur une échelle unique (§10.1).

### [P2] `2xl:` (1536) au-dessus du cap contenu 1520 → règles mortes sur contenu cappé
- **Fichier** : 17 usages `2xl:` dans 9 fichiers (`page.tsx`, `un-a-un/page.tsx`, `interventions/collectives/page.tsx`, `PricingGridVille.tsx`, `implantations/page.tsx`, `ImplementationApproachPaths.tsx`, `Footer.tsx`…). `globals.css` ne redéfinit pas `--breakpoint-2xl` → reste 1536 px (défaut Tailwind v4).
- **Symptôme observé** : à l'intérieur d'un `Container` (≤1520), un `2xl:` (≥1536) ne s'applique **jamais** ; il ne s'active que sur header/footer full-width.
- **Impact** : code mort / confusion de maintenance (pas de bug visuel direct).
- **Piste (NON appliquée)** : auditer ces `2xl:` ; soit définir `--breakpoint-2xl` cohérent avec la stratégie de largeur, soit les retirer du contenu cappé.

### [P2] `/reserver` — grille calendrier `grid-cols-7` à vérifier ≤ 360 px
- **Fichier** : `BookingCalendar.tsx:1147,1159` (`grid grid-cols-7 gap-1.5 sm:gap-2.5`).
- **Archétype/zone** : page exception `/reserver` (budget INP ≤150, JS ≤110 KB).
- **Largeur(s)** : ≤ 360 px.
- **Symptôme observé (à confirmer)** : 7 colonnes de cellules-jours + contenu (date + créneaux) sur ~320–360 px → cellules ≈ 38–44 px, risque de troncature/serrage du libellé. Le reste du composant est responsive-aware (grid 2-col qui stacke < lg, modal full-screen mobile `w-[calc(100%-0.75rem)]`, clamp titres).
- **Impact** : UX mobile sur la page de conversion principale.
- **Piste (NON appliquée)** : vérification visuelle ≤360 ; si serrage, réduire le contenu par cellule en mobile (ou layout liste). À mesurer en Phase 2.

### [P3] `GalleryGrid` utilise des gris Tailwind bruts au lieu des tokens
- **Fichier** : `GalleryGrid.tsx:44,72,88,95,99` (`text-gray-500/900`, `border-gray-100`, `bg-white`, `bg-black/60`).
- **Archétype/zone** : galerie (grids d'images). Responsive OK : `grid-cols-2 sm:3 lg:4 xl:5`, `aspect-[4/3]` (pas de CLS), `fill`+`sizes`+LQIP.
- **Symptôme observé** : écart au design system (tokens `bg-paper/border/fg-muted`), pas un bug responsive.
- **Impact** : cohérence charte (mineur).
- **Note** : `sizes="(min-width:1024px) 33vw…"` mentionne 1024 alors que le grid passe à 4 col à `lg`=992 et 5 col à `xl`=1280 → léger désaccord du hint `sizes` (n'affecte que la variante d'image chargée, pas le layout). À ajuster si on touche le fichier.

---

## Couverture

| Archétype | Représentant testé (`file`) | Méthode | Statut |
|---|---|---|---|
| Container (SSOT largeur) | `Container.tsx` | statique | ❌ findings A/B (cap+gouttières) |
| Section (wrapper) | `Section.tsx` | statique | ✅ consomme Container, OK |
| Header desktop | `Header.tsx` + `NavLink.tsx` | statique | ❌ findings P0 C, P0 B, P1 h-20 |
| Drawer mobile | `MobileNav.tsx` (Radix Sheet) | statique | ✅ focus-trap, Escape, click-outside, overflow-y-auto, trigger 44×44 |
| Footer | `Footer.tsx` | statique | ❌ finding P0 B ; ✅ touch 44px, `contain`, colonnes responsive |
| layout (main/skip/ordre) | `layout.tsx` | statique | ✅ skip-link, header/main(flex-1)/footer, viewport device-width |
| Home (hero custom) | `page.tsx:361` | statique | ✅ utilise Container ; hero grid `lg:grid-cols-[1fr_1fr]`, marquee bord-à-bord voulu |
| Template villes | (via Section/Container) | statique | ✅ pattern Container hérité |
| Article (prose) | `blog/[slug]/page.tsx:392` | statique | ✅ colonne lecture `max-w-3xl` (768px) centrée — largeur de ligne saine |
| Galerie (grids) | `GalleryGrid.tsx` | statique | ⚠️ P3 tokens ; responsive OK |
| `/reserver` (calendrier) | `BookingCalendar.tsx` | statique | ⚠️ P2 grid-cols-7 ≤360 à confirmer ; reste OK |
| Sticky CTA mobile | `StickyMobileCta.tsx` | statique | ✅ lg:hidden, safe-area, reduced-motion, rAF INP |
| Admin | `globals.css:672` (`admin-shell`) | statique | ✅ `@media max-width:768` stacke `240px 1fr`→`1fr` (`globals.css:1331`) ; audit léger comme demandé |

**Largeurs de la matrice §4 raisonnées** : 320/360/390/414/479/640/768/991/992/1024/1280/1512/1520/1728/1920/2560 — analyse statique sur breakpoints custom (479/640/768/992/1280). **Inspection visuelle dev server NON effectuée** en Phase 1 (read-only, app ~17 600 routes lourde) — recommandée comme première étape Phase 2 pour le chiffrage exact de C et la confirmation P2 `/reserver`.

---

## Faux positifs écartés (NON-bugs confirmés)

- **Hero H1 « pas gras » en 1re visite prod** = fallback serif `display:optional` (Fraunces) **voulu** pour CLS=0 (`layout.tsx:68`). Non signalé.
- **EN non rendu** = désactivé runtime (301→FR). Hors périmètre ; audit FR uniquement.
- **Marges latérales sur grand écran en soi** = choix de design légitime. Le bug n'est PAS « il y a des marges » mais l'**incohérence** header/contenu/footer (B) + le placement du seuil 1520 vis-à-vis 14″/16″ (A).
- **Section marquee/logos home bord-à-bord** (`page.tsx:571`) = volontairement hors Container (commentaire explicite) pour fond pleine largeur. Non signalé.
- **Footer `contain: layout style`** (`Footer.tsx:89`) = anti-CLS voulu. À préserver, ne pas régresser.
- **Drawer mobile** = Radix Sheet, focus-trap/Escape/overflow gérés. Aucun finding.

---

## Recommandation de correctif unifié (haut niveau, NON appliqué) — STOP & ASK Will

### Option A — Tout aligné sur `max-w-[1520px]` (recommandée)
Wrapper le contenu interne de `Header.tsx` et `Footer.tsx` dans un conteneur `max-w-[1520px] mx-auto` partageant **la même rampe de gouttières** que `Container` (`px-4 sm:px-6 lg:px-10 xl:px-16`), tout en gardant le **fond** bord-à-bord (terracotta header / mocha footer). Aligner aussi les skeletons `loading.tsx`.
- **Corrige** : B (alignement parfait), gouttières incohérentes (P2), skeletons (P1). Réduit C (l'intérieur est mieux borné).
- **Trade-offs** : aucun impact JS (CSS pur) → First Load JS inchangé. CLS=0 préservé (pas de contenu injecté). Risque faible, effet de levier maximal (composants partagés → ~17 600 routes).

### Option B — Contenu full-width (retirer le cap 1520)
Supprimer `max-w-[1520px]`, laisser le contenu s'étendre comme header/footer.
- **Corrige** : A et B mécaniquement (tout pleine largeur).
- **Trade-offs** : largeurs de ligne **trop longues** en ultra-wide (lisibilité prose dégradée) → contradiction avec la charte éditoriale ; nécessiterait des `max-w` locaux partout (régression de maintenance). **Non recommandée.**

### Header (Symptôme C) — orthogonal aux options A/B, à trancher séparément
- **(a)** Avancer le drawer de `lg`→`xl` (nav desktop seulement ≥1280) — le plus simple/sûr, supprime tout débordement 992–1280.
- **(b)** Nav condensée 992–1280 : gaps réduits, tagline `xl:` only, CTA secondaire masqué < xl, labels mono-ligne.
- **(c)** `flex-wrap`/overflow maîtrisé ou regroupement « Plus »/mega-menu.
- Recommandation : **(a) + éléments de (b)** combinés. À chiffrer après confirmation visuelle de la largeur de coupure exacte.

**Décisions requises de Will avant Phase 2 :**
1. Option **A** (aligner header/footer sur 1520, fond bord-à-bord) confirmée ?
2. Seuil **1520** : on garde, ou on relève (pour que 16″ soit aussi « plein ») — Symptôme A ?
3. Header : stratégie **(a)** drawer < xl, **(b)** nav condensée, ou combinaison ?

---

## Plan de correction préparé (exécution Phase 2 — après OK explicite)

Ordre recommandé (composants partagés d'abord = levier max) :
1. **`Container.tsx`** — confirmer SSOT ; figer la rampe de gouttières de référence.
2. **`Header.tsx`** (+ `NavLink.tsx`) — wrapper interne `max-w-[1520px]` (B) + stratégie anti-coupure (C : drawer < xl et/ou nav condensée) + labels mono-ligne (P1).
3. **`Footer.tsx`** — wrapper interne `max-w-[1520px]` + gouttières alignées (B/P2), préserver `contain`.
4. **`loading.tsx`** (toutes routes) — aligner sur Container (P1).
5. **`/reserver`** — confirmer/ajuster grid-cols-7 ≤360 (P2).
6. **`GalleryGrid.tsx`** — tokens + `sizes` (P3, si on y touche).
7. Re-tester la matrice §4 (320→2560) après chaque étape ; vérifier CLS=0, First Load JS ≤ 75 KB gz, pas de scroll-H.

> Garde-fous Phase 2 (rappel) : pas de `push`/`commit` sans OK Will ; `git fetch` + vérif ahead/behind (working tree partagé) ; mobile-first ; tokens design system ; breakpoints custom préservés ; ne pas toucher infra/`stub.invalid`/EN ; lancer `pnpm typecheck`/`pnpm lint`/tests avant de proposer le diff ; mettre à jour ce rapport (section « Correctifs appliqués »).

---

## 🛑 POINT DE VALIDATION (Phase 1)

Phase 1 terminée. Symptômes A, B, C confirmés et chiffrés ; plan de correction prêt.
Décisions Will (2026-06-03) : **Option A** (header/footer alignés) + **cap = 1366 px** + **header (a)+(b)** (drawer < xl, nav condensée) → **GO Phase 2**.

---

## Correctifs appliqués (Phase 2 — 2026-06-03)

> Vérifs locales : `pnpm typecheck` ✅ (0 erreur) · `pnpm vitest run Container.test.tsx` ✅ (3/3) · `pnpm lint` ✅ (0 erreur, 16 warnings pré-existants hors périmètre). Pas de commit/push (en attente OK Will).

### Décision SSOT largeur : cap 1520 → **1366 px**
Choix Will : 1520 laissait le 14″ (1512) quasi bord-à-bord (peu premium) et créait la bascule A. À 1366, 14″ ET 16″ ont des marges élégantes, la bascule A disparaît, la largeur de lecture s'améliore. Référence : Anthropic/Stripe/Vercel ~1200–1280.

| Fichier:ligne | Avant | Après |
|---|---|---|
| `Container.tsx:22` | `max-w-[1520px] px-4 sm:px-6 lg:px-10 xl:px-16` | `max-w-[1366px] px-4 sm:px-6 lg:px-10 xl:px-16` |
| `Container.test.tsx:9` | `toContain("max-w-[1520px]")` | `toContain("max-w-[1366px]")` |

### Symptôme B — Header & Footer alignés sur le cap (Option A)
Fond bord-à-bord conservé ; contenu interne wrappé sur `max-w-[1366px] mx-auto` + rampe de gouttières **identique** à Container (`px-4 sm:px-6 lg:px-10 xl:px-16`). Bords gauche/droit header = contenu = footer à tous les breakpoints (corrige aussi la gouttière mobile 16≠24, finding P2).

| Fichier:ligne | Avant | Après |
|---|---|---|
| `Header.tsx:86` | `flex h-20 w-full … px-6 sm:px-8 lg:gap-8 lg:px-10 xl:gap-10 xl:px-14` | `mx-auto flex h-20 w-full max-w-[1366px] … px-4 sm:px-6 lg:gap-8 lg:px-10 xl:gap-8 xl:px-16` |
| `Footer.tsx:97` | `px-6 py-10 md:px-8 lg:px-12 lg:py-14 xl:px-16` | `mx-auto w-full max-w-[1366px] px-4 py-10 sm:px-6 lg:px-10 lg:py-14 xl:px-16` |

### Symptôme C — Header qui ne coupe plus (stratégie (a)+(b))
- **(a)** Drawer mobile jusqu'à **xl=1280** (ex-`lg`=992) : `Header.tsx` trigger `lg:hidden`→`xl:hidden`, nav `lg:flex`→`xl:flex`, dual-CTA `lg:flex`→`xl:flex`, + `MobileNav.tsx:34` bouton `lg:hidden`→`xl:hidden`. La plage 992–1280 (où ça coupait) est désormais en drawer → **plus aucun débordement**.
- **(b)** Nav desktop condensée : gaps `gap-12 xl:gap-16`→`gap-6 2xl:gap-8` (24/32 px) ; tagline `lg:block`→`lg:block xl:hidden 2xl:block` (visible en drawer 992–1280 et ≥1536, masquée dans la bande serrée 1280–1536).
- **Dual-CTA conservé** (décision Will) via **raccourcissement du label nav le plus large** : nouvelle clé i18n dédiée header `nav.implementationNav` = « Intégration IA » (FR) / « AI integration » (EN), au lieu de « Intégration d'agents IA sur-mesure » (~190 px). La clé longue `implementationShort` reste utilisée comme titre dans `/tarifs` (aucun effet de bord). `Header.tsx:42` + `messages/fr.json:28` + `messages/en.json:28`.
- **CTA secondaire « Nous écrire » révélé à partir de 1400 px** (`min-[1400px]:inline-flex`, breakpoint arbitraire Tailwind v4) — pas à 1536, pour couvrir les laptops 1440. Idem tagline (`min-[1400px]:block`). Entre 1280 et 1399 px : CTA primaire seul (l'espace ne permet pas le dual-CTA dans le cap). « Nous écrire » reste en parité dans le drawer mobile (< xl). Gap nav fixe `gap-6` (pas de croissance à 2xl pour ne pas voler la place du dual-CTA).

Budget vérifié (largeurs de labels réelles `messages/fr.json`, label court, gap-6) :
- 1280–1399 (primary-only, sans tagline, inner ≥1152) : logo 127 + 32 + nav ~653 + CTA primaire ~199 = **~1011 px** → marge confortable.
- ≥1400 (full dual-CTA + tagline, inner constant ≈1238) : logo+tagline 165 + 32 + nav ~653 + dual-CTA ~349 = **~1199 px** < 1238 → tient avec ~39 px de marge.

### Skeletons `loading.tsx` alignés (finding P1 — saut au chargement)
Tous les wrappers de contenu principal passés à `max-w-[1366px] px-4 sm:px-6 lg:px-10 xl:px-16` (étaient `max-w-[1280px] … lg:px-8 xl:px-12`) : `app/[locale]/loading.tsx` (×2), `contact/loading.tsx`, `audit/loading.tsx` (×2), `implantations/[region]/[ville]/loading.tsx` (×3), `reserver/loading.tsx` (hero + breadcrumbs). **`reserver/loading.tsx` calendrier** : `max-w-[1680px]`→`max-w-7xl` pour matcher la **vraie** page (`reserver/page.tsx:464`, ≈1280 volontaire) — corrige un saut de ~400 px. Colonnes étroites de formulaire (`max-w-[640px]`) laissées intactes.

### Image `sizes` (références à l'ancien cap)
`ImplementationServices.tsx:190` + `AuditProcessFlow.tsx:85` : `(max-width: 1520px) 92vw, 1456px` → `(max-width: 1366px) 92vw, 1238px` (sélection de variante srcset uniquement, aucun impact layout).

### Préservé (non régressé)
`contain: layout style` footer · `display:optional` Fraunces · touch targets 44px footer · drawer Radix focus-trap/Escape · `scroll-margin-top: 6rem` · breakpoints custom 479/640/768/992/1280 · `prefers-reduced-motion`.

### Reste / à valider visuellement (non bloquant)
- Largeurs de labels = estimations ; **confirmation visuelle dev server** recommandée sur la matrice 320→2560, en particulier la bande 1280–1366.
- P2 `/reserver` grid-cols-7 ≤360 : non modifié (à confirmer visuellement).
- P3 `GalleryGrid` tokens + `sizes` 1024 : non modifié (cosmétique, hors décision).
- `StickyMobileCta` reste `lg:hidden` : la plage 992–1280 (désormais drawer) n'a plus de CTA persistant hors drawer — à arbitrer (passer `xl:hidden` ?).

---

## 🛑 POINT DE VALIDATION (Phase 2)

Correctifs appliqués et **vérifiés visuellement (dev server + Playwright)**.

### Vérification visuelle (Playwright, /fr home, mesures réelles)

| Largeur | Scroll-H | Nav | Burger | CTA primaire | CTA secondaire | Bord header = bord contenu |
|---|---|---|---|---|---|---|
| 320 | 1px (sous-pixel) | — | ✓ | visible | — | 16 = 16 |
| 360 / 390 / 414 | **0** | — | ✓ | visible | — | 16 = 16 |
| 768 / 992 / 1180 | 0 | drawer | ✓ | (drawer) | (drawer) | aligné |
| 1280 | 0 | ✓ | — | visible (fin @1256) | masqué (voulu) | 24 = 24 |
| 1366 | 0 | ✓ | — | visible (@1342) | masqué (voulu) | 24 = 24 |
| **1400** | 0 | ✓ | — | visible | **visible** | 41 = 41 |
| **1512** (14″) | 0 | ✓ | — | visible | visible | **97 = 97** (marges premium) |
| 1728 (16″) | 0 | ✓ | — | visible | visible | 205 = 205 |
| 1920 | 0 | ✓ | — | visible | visible | 301 = 301 |

✅ **B confirmé** : bord gauche header = bord gauche contenu à TOUTES les largeurs.
✅ **C confirmé** : aucun scroll-H, nav à 1280 (plus à 992), CTA primaire jamais rogné, secondaire à 1400.
✅ **A confirmé** : à 1512 (14″) le contenu démarre à 97 px (marges), plus de plein écran ; rendu éditorial premium.

### Bonus corrigé pendant la vérif — scroll-H mobile (pré-existant, hors système de largeur)
`LogosMarquee.tsx:57` : les `<img>` logos (`max-w-[150px]`) n'avaient pas `w-full` → dans une cellule de grille `grid-cols-4` à 360 px (~75 px), l'image débordait à 150 px → **19 px de scroll horizontal** sur la home mobile. Fix : ajout de `w-full` (l'image remplit sa cellule, `max-w` reste le plafond). Re-testé : 360/390/414 = 0 scroll. *Non causé par les changements de largeur ; surfacé par le test visuel.*
> ⚠️ Même pattern probable (logo en cellule de grille sans `w-full`) sur `ClientLogosMarqueeBand.tsx` (`max-w-[132px]`, page /audit) et `SitesWebStackAdaptee.tsx` (`max-w-[112px]`) — **non testés** (autres pages) ; à vérifier/corriger si besoin.

**Reste recommandé** : `pnpm lhci` (autorité Web Vitals) pour valider CLS=0 et First Load JS sur les pages stratégiques.
