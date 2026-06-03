# PROMPT D'AUDIT — Responsive / Mobile-first / Header / Footer (LECTURE SEULE)

> **Comment lancer cet audit** : ouvre une nouvelle conversation Claude Code à la racine du projet et colle la phrase de lancement fournie en bas de ce document (ou demande simplement « exécute `_AUDIT/AUDIT-RESPONSIVE-MOBILE-FIRST-2026-06-PROMPT.md` »).

---

## 0. RÔLE & DÉROULÉ EN 2 PHASES (audit → correction, séparées par une validation)

Tu es un **ingénieur front-end senior** spécialisé responsive / mobile-first / design system. Le travail se fait en **deux phases strictement séquentielles** :

- **PHASE 1 — AUDIT (LECTURE SEULE)** : produire le rapport d'audit (§8). **Aucune modification de code.**
- **🛑 POINT DE VALIDATION WILL** : après la Phase 1, **STOP & ASK Will** — présenter la synthèse + le plan de correction (§10) et **attendre son feu vert explicite** avant de toucher au code. **NE PAS enchaîner automatiquement.**
- **PHASE 2 — CORRECTION (après validation uniquement)** : appliquer les fixes selon le plan §10, en respectant les garde-fous §11.

> Will a demandé : « corrige tout ce qu'il faut corriger » **mais** « ne corrige pas tout de suite ». Donc : **tu prépares et planifies tout en Phase 1, tu n'exécutes la Phase 2 qu'après son OK.**

### Garde-fous PHASE 1 (lecture seule — interdictions absolues)

- ❌ **Aucune** modification de fichier (`Edit`, `Write`, `NotebookEdit`) du code applicatif.
- ❌ **Aucun** `git add` / `commit` / `push` / `checkout` / `branch` / `stash` / `reset`.
- ❌ **Aucun** `pnpm install`, modification de `package.json`, lockfile, config.
- ❌ **Ne pas** lancer de build long, ni de déploiement. **Un `git push` = un deploy prod** : interdit en toute phase sans accord explicite.
- ❌ **Ne pas** toucher la magic string `"stub.invalid"`, ni `EN_LOCALE_ENABLED`, ni l'infra (cf. `AGENTS.md`).

**Autorisé en Phase 1 (observation uniquement) :**
- ✅ Lire des fichiers, `grep`, `glob`.
- ✅ Lancer `pnpm dev` **en lecture** pour inspecter le rendu — sans rien modifier, couper à la fin.
- ✅ Playwright / Lighthouse en lecture s'ils sont déjà configurés (script jetable dans `/tmp` toléré, à supprimer).
- ✅ **Seule écriture autorisée en Phase 1** : le rapport Markdown dans `_AUDIT/` (§8).

Si tu hésites entre « observer » et « modifier » en Phase 1 → **observe et note**. Les garde-fous de la Phase 2 sont au §11.

---

## 1. CONTEXTE PROJET À INGÉRER AVANT TOUT

Lis ces fichiers **dans cet ordre** pour charger le contexte (ne pas les modifier) :

1. `C:\Users\willi\AGENTS.md` + `axionia/AGENTS.md` — contraintes infra, Web Vitals, EN désactivé, breakpoints.
2. `axionia/src/app/globals.css` — **design tokens, type scale, breakpoints custom** (§ critique, voir piège ci-dessous).
3. `axionia/src/components/layout/Container.tsx` — conteneur de largeur du contenu.
4. `axionia/src/components/layout/Section.tsx` — wrapper de section (padding vertical, hero).
5. `axionia/src/components/nav/Header.tsx` + `HeaderMegaMenu.tsx` + `MobileNav.tsx` + `NavLink.tsx`.
6. `axionia/src/components/nav/Footer.tsx`.
7. `axionia/src/app/[locale]/layout.tsx` — composition `Header` / `main` / `Footer`.

### Faits de contexte déjà établis (point de départ, à VÉRIFIER pas à recopier)

- **Stack** : Next.js 16 App Router (fork interne, conventions custom — lire `node_modules/next/dist/docs/` avant de juger une API), Tailwind **v4** (config dans `globals.css` via `@theme`, **pas** de `tailwind.config.js`), React Server Components.
- **Locale** : **FR uniquement en pratique** (EN désactivé runtime, 301→FR). **Auditer le rendu FR.** Ne pas perdre de temps sur l'anglais.
- **Échelle** : ~17 600 routes SSG/ISR. **Tu n'audites PAS route par route** — tu audites **par archétype de template** (voir §6).
- **Web Vitals (contrainte dure, cf. `AGENTS.md`)** : LCP ≤ 1800 ms, INP ≤ 100 ms, **CLS = 0 strict**, First Load JS ≤ 75 KB gz. **Tout problème responsive qui causerait un reflow/CLS est P0.**

### ⚠️ PIÈGE BREAKPOINTS — à vérifier en premier

`globals.css` redéfinit les breakpoints via `@theme` :

```
--breakpoint-xs: 479px;
--breakpoint-md: 768px;
--breakpoint-lg: 992px;   ← écrase le défaut Tailwind (1024px) !
--breakpoint-xl: 1280px;
```

Conséquences à confirmer et à garder en tête pendant **tout** l'audit :
- `sm:` n'est **pas** redéfini → reste **640 px** (défaut Tailwind v4).
- `lg:` se déclenche à **992 px** et non 1024.
- `2xl:` (1536) existe-t-il encore ? Le vérifier.
- Donc tout `lg:flex` / `hidden lg:block` bascule à **992 px**. La nav desktop du header apparaît à 992. **Audite spécifiquement la zone 992–1280 px** (souvent la plus cassée).

---

## 2. LES DEUX SYMPTÔMES SIGNALÉS PAR WILL — À CONFIRMER ET EXPLIQUER

Une hypothèse de cause racine existe déjà (incohérence de largeur Header `w-full` / Footer full-width / Contenu `max-w-[1520px]`). **Ne la prends pas pour acquise : confirme-la, quantifie-la, et cherche s'il y en a d'autres.**

### Symptôme A — « marges sur les côtés en 16″, plein écran en 14″ »
- Confirmer que `Container.tsx` plafonne à `max-w-[1520px] mx-auto`.
- Confirmer que ce seuil (1520) tombe entre la largeur CSS d'un 14″ (~1512) et d'un 16″ (~1728) → bascule de comportement.
- Vérifier sur quels écrans/breakpoints le contenu « décolle » des bords et de combien (mesure en px à 1280 / 1512 / 1728 / 1920 / 2560).

### Symptôme B — « le header n'est pas responsive »
- Confirmer que Header (`w-full`) et Footer (full-width) **n'ont pas** de `max-width`, contrairement au contenu → **désalignement** des bords gauche/droite entre header, contenu et footer sur écrans > 1520 px. Mesurer le décalage.
- Vérifier les **3 rampes de gouttières différentes** (header `px-6/8/10/14`, footer `px-6/8/12/16`, contenu `px-4/6/10/16`) → les bords gauches ne s'alignent jamais. Tabuler les valeurs effectives par breakpoint.

### Symptôme C — « en réduisant la fenêtre, le header se fait COUPER jusqu'à ce qu'il passe en mode mobile » (signalé par Will, PRIORITAIRE)
C'est le symptôme le plus concret et probablement le plus gênant. La nav desktop apparaît dès **`lg` = 992 px**, mais entre **992 px et ~1280 px** le contenu du header (logo badge + tagline + **6 items** de nav avec `gap-12`/`xl:gap-16` = 40–56 px de gap + **double CTA** « Nous écrire » + « Réserver un appel ») **dépasse la largeur disponible** → les éléments de droite (CTA) sont **rognés / coupés / poussés hors écran**, sans wrap propre, jusqu'à ce que `< 992 px` bascule enfin sur le drawer mobile.
- **Reproduire** : réduire lentement la fenêtre de 1280 → 992 px et noter la **largeur exacte** où ça commence à couper, et **quel élément** est coupé en premier (CTA primaire ? secondaire ? dernier item nav ?).
- **Causes à confirmer** dans `Header.tsx` : `flex` à une seule rangée sans `flex-wrap`, gaps fixes trop grands (`gap-12`/`gap-16`), `h-20` fixe, `shrink-0` sur logo+CTA forçant la compression de la nav, absence de breakpoint intermédiaire (`md`/un `lg` réservé à une nav condensée), `overflow` non géré.
- **Hypothèse de design cible** (à valider en Phase 2) : soit réduire le nombre d'items visibles en desktop étroit (mega-menu / « Plus »), soit réduire gaps + tagline en `xl:` only, soit avancer le breakpoint du drawer mobile à `< xl` (1280) au lieu de `< lg` (992), soit passer à un layout qui ne déborde jamais. **À chiffrer, pas à trancher en Phase 1.**

> Suspect n°1 du ressenti « header pas responsive » = **Symptôme C**. Le traiter en priorité dans le rapport et le plan.

---

## 3. DIMENSIONS D'AUDIT (checklist exhaustive)

Pour **chaque** archétype de page (§6) **et** pour Header/Footer, évaluer :

### 3.1 Système de largeur & alignement
- [ ] Header, contenu, footer partagent-ils la **même** largeur max et le **même** axe de centrage ? (cœur du bug)
- [ ] Gouttières latérales **cohérentes** entre les 3 zones, à chaque breakpoint ?
- [ ] Existe-t-il des largeurs « magiques » en dur (`max-w-[1520px]`, `max-w-3xl`, `1280px`…) divergentes entre composants ?
- [ ] Le `mx-auto` est-il appliqué partout où il faut (et pas ailleurs) ?

### 3.2 Mobile-first (≤ 640 px)
- [ ] Les classes de base (sans préfixe) ciblent-elles bien le **mobile** (mobile-first) et non l'inverse (`max-*:` desktop-down) ?
- [ ] **Aucun scroll horizontal** à 320 / 360 / 390 / 414 px. Chercher les causes : largeurs fixes en px, `w-screen`, `100vw` (qui ignore la scrollbar), tableaux, `<pre>`, images sans `max-width`, grids non réductives, `whitespace-nowrap` longs.
- [ ] **Touch targets ≥ 44×44 px** (WCAG 2.5.8) : liens nav, boutons, items footer, CTA, switcher.
- [ ] Texte lisible sans zoom (≥ 16 px sur body — ici body = 18 px, OK ; vérifier captions 15 px et `text-[12px]`/`text-[13px]` du header/footer).
- [ ] Espacement tap (pas de liens collés dans les listes footer).

### 3.3 Tablette (641–991 px) & zone de bascule (992–1280 px)
- [ ] Transition drawer mobile → nav desktop **sans état cassé** autour de 992 px.
- [ ] Grids : passage 1→2→3 colonnes fluide, pas de colonne orpheline ni de carte écrasée.
- [ ] Header dense en 992–1200 : pas de chevauchement nav/CTA.

### 3.4 Desktop & large (≥ 1280 px, et **surtout** > 1520 px)
- [ ] Alignement header/contenu/footer (symptôme B).
- [ ] Comportement ultra-wide (1920 / 2560 / 3440) : le contenu reste-t-il lisible (largeur de ligne) ou s'étire-t-il ? Header/footer collent-ils les bords pendant que le contenu est centré ?
- [ ] `clamp()` typographiques (`display-editorial`, titres `text-[clamp(...)]`) : pas de débordement, pas de titres ridiculement petits/grands aux extrêmes.

### 3.5 CLS / stabilité (contrainte CLS = 0)
- [ ] Images/vidéos/SVG avec dimensions réservées (pas de reflow au load).
- [ ] Polices (`Fraunces`/`Manrope`, `display:optional` — cf. note mémoire « hero font local≠prod » : le fallback serif en 1re visite est **voulu**, ne pas le signaler comme bug).
- [ ] Header `sticky top-0` : ne provoque pas de saut ; `scroll-margin-top: 6rem` sur `[id]` présent.
- [ ] Pas de contenu injecté client-side qui pousse le layout (LocaleSwitcher, bannières cookies).

### 3.6 Accessibilité responsive (bonus mais noter)
- [ ] Zoom 200 % (WCAG 1.4.10 reflow) sans perte de contenu ni scroll 2D.
- [ ] `prefers-reduced-motion` respecté (déjà présent dans globals.css — vérifier non régressé).
- [ ] Focus visible conservé à tous les breakpoints.
- [ ] Drawer mobile : piège focus, `aria-expanded`, fermeture clavier.

---

## 4. BREAKPOINTS DE TEST (matrice obligatoire)

Évalue chaque archétype à **ces largeurs** (× hauteur indicative), en gardant les breakpoints **custom** (479/640/768/992/1280) en tête :

| Largeur | Cible | Pourquoi |
|---|---|---|
| 320 | petit mobile | pire cas overflow |
| 360 / 390 | mobile courant | Android / iPhone |
| 414 | grand mobile | |
| 479 / 480 | bordure `xs` | bascule custom |
| 640 | bordure `sm` | bascule custom |
| 768 | bordure `md` | tablette portrait |
| 991 / 992 | **bordure `lg`** | **bascule drawer→nav desktop** |
| 1024 | piège (ancien lg) | vérifier qu'aucun code suppose lg=1024 |
| 1280 | bordure `xl` | |
| **1512** | **MacBook 14″** | **symptôme A — plein écran** |
| 1520 | seuil `max-w` | bascule exacte |
| **1728** | **MacBook 16″** | **symptôme A — marges** |
| 1920 / 2560 | desktop large / ultra-wide | symptôme B alignement |

---

## 5. MÉTHODE D'INSPECTION

1. **Analyse statique d'abord** (rapide, large couverture) : `grep`/lecture pour repérer les classes/largeurs problématiques sur l'ensemble des composants partagés et des templates. Exemples de recherches utiles :
   - largeurs en dur : `max-w-\[`, `w-\[`, `min-w-\[`, `100vw`, `w-screen`.
   - overflow : `overflow-x`, `whitespace-nowrap`, `nowrap`.
   - incohérences gouttières : comparer les chaînes `px-…` de Header/Footer/Container.
   - usages de `lg:` / `xl:` qui supposeraient les valeurs Tailwind par défaut.
2. **Inspection visuelle ensuite** (si serveur dev lançable) : ouvrir quelques URLs représentatives par archétype, redimensionner selon la matrice §4, screenshots si possible. Sinon, raisonner sur le code + tokens.
3. **Quantifier** : chaque finding doit donner la largeur exacte de déclenchement et l'ampleur (px de décalage, présence de scroll H, etc.).
4. **Faux positifs connus à NE PAS signaler** (cf. mémoire projet) :
   - Hero H1 « pas gras » en 1re visite prod = fallback serif `display:optional` **voulu** (CLS=0).
   - EN non rendu = **voulu** (301→FR).
   - Marges latérales sur grand écran *en soi* ne sont pas un bug — le bug est l'**incohérence** header/contenu/footer + le seuil mal placé. Bien distinguer « choix de design » de « incohérence ».

---

## 6. COUVERTURE PAR ARCHÉTYPE (au lieu de 17 600 routes)

Audite **un représentant par template**. Identifie le composant/template source de chaque archétype puis vérifie-le une fois (il est réutilisé partout) :

**Globaux (présents sur ~toutes les pages) :**
- `Header` (desktop nav, drawer mobile, mega-menu si présent).
- `Footer`.
- `Container` / `Section` (largeur + padding vertical).
- `layout.tsx` (`main`, skip-link, ordre header/main/footer).

**Pages éditoriales statiques (hero `Section titleAs="h1"`) :**
- `/` (home — souvent hero custom, à vérifier à part).
- `/a-propos`, `/methodologie`, `/audit`, `/tarifs`, `/contact`, `/faq`, `/stack-ia`.

**Templates programmatiques (forte volumétrie — 1 représentant chacun) :**
- `implantations/[region]/[ville]` (pages villes — `VilleServiceDetailSection`, `LocalCoverageSection`, etc.).
- `blog/[slug]`, `actualites/[slug]` (article — prose, images, largeur de lecture).
- `comparaisons/*`, `guides/*`, `glossaire/*`, `connaissances/*` (hubs + détail).
- `interventions/*`, `implementation/*`, `sites-web-augmentes/*`, `un-a-un/*`, `cas-concrets/*` (pages-intention / verticales).
- `galerie/*` (banque d'images — grids d'images, srcset, pire cas overflow/CLS).

**Pages « lourdes client » (cas particuliers) :**
- `/reserver` & `/booking` (calendrier — exception budget : INP ≤ 150, JS ≤ 110 KB ; vérifier responsive du calendrier, pire cas mobile).
- `/roi` (simulateur), `/recherche` (résultats).

**Listings / index :**
- pages hub avec grilles de cartes (`/blog`, `/cas-concrets`, `/comparaisons`, `/guides`, `/galerie`).

**Formulaires :**
- `/contact`, `/demande-devis`, `/preferences-cookies`, `/mes-donnees` (inputs full-width mobile, `[data-tone]` form-on-dark).

**Admin** (`(admin)` — design system séparé `admin-*` dans globals.css) : **audit léger/optionnel** (non public, non SEO). Noter seulement les casses majeures (`admin-shell` grid `240px 1fr` sous 768 → vérifier le `@media max-width:768`).

> Pour chaque archétype : noter le **fichier template source** (`file:line`) plutôt que les URLs individuelles, puisque le fix sera centralisé.

---

## 7. HEADER & FOOTER — AUDIT APPROFONDI DÉDIÉ

### Header (`Header.tsx`, `MobileNav.tsx`, `HeaderMegaMenu.tsx`, `NavLink.tsx`)
- Largeur : `w-full` sans `max-width` → **confirmer** + mesurer désalignement vs contenu > 1520 px.
- **Zone 992–1280 = SYMPTÔME C (priorité)** : 6 items + tagline `lg:block` + double CTA + `gap-12`/`gap-16` → mesurer la largeur exacte où ça **coupe**, quel élément est rogné en premier, pourquoi (pas de `flex-wrap`, gaps fixes, `shrink-0`, breakpoint drawer trop bas à 992). Voir §2 Symptôme C.
- `h-20` (80 px) fixe : labels `multiline` (2 lignes) tiennent-ils sans déborder verticalement ?
- Drawer mobile (< 992) : ouverture/fermeture, scroll interne si beaucoup d'items (6 principaux + 7 extras + 2 CTA), focus trap, hauteur < viewport.
- `sticky top-0 z-40` + `backdrop-blur` : perf scroll mobile, pas de CLS.
- Mega-menu (si actif) : positionnement, débordement droite sur petit desktop, fermeture.

### Footer (`Footer.tsx`)
- Largeur full-width sans `max-width` → **confirmer** désalignement vs contenu.
- `contain: layout style` présent (anti-CLS) — ne pas régresser.
- Colonnes (`lg:flex-row gap-16 xl:gap-20`, brand `lg:w-60`) : empilage mobile correct, pas de colonne écrasée en 992–1100.
- Listes de liens : touch targets, espacement vertical mobile.
- `LocaleSwitcher` : hydration sans shift (EN désactivé — vérifier qu'il ne casse rien).

---

## 8. LIVRABLE — FORMAT DU RAPPORT (seule écriture autorisée)

Écris **un seul fichier** : `axionia/_AUDIT/AUDIT-RESPONSIVE-MOBILE-FIRST-2026-06-RAPPORT.md` (ne modifie aucun autre fichier).

Structure imposée :

```markdown
# Rapport d'audit Responsive / Mobile-first — 2026-06-DD

## Synthèse exécutive
- Verdict global (1 paragraphe).
- Top 3 problèmes P0 (1 ligne chacun).
- Confirmation chiffrée des symptômes A, B **et C** de Will (largeurs exactes de déclenchement, élément coupé).

## Cause(s) racine du système de largeur
- Tableau Header vs Container vs Footer (largeur max, mx-auto, gouttières par breakpoint).
- Explication symptôme A (14″ vs 16″) avec mesures.
- Explication symptôme B (désalignement header/contenu/footer > 1520).
- Explication symptôme C (header coupé 992–1280, largeur exacte + élément rogné).
- Schéma/ASCII des bords aux largeurs clés si utile.

## Findings détaillés
Pour CHAQUE finding :
### [P0|P1|P2|P3] Titre court
- **Fichier** : `chemin:ligne`
- **Archétype/zone** : (Header / Container / template villes / ...)
- **Largeur(s) de déclenchement** : ex. « > 1520 px » / « 992–1180 px » / « ≤ 360 px »
- **Symptôme observé** : (scroll H de N px / désalignement de N px / target 32px < 44 / CLS ...)
- **Impact** : (UX / SEO / Web Vitals / a11y)
- **Piste de correction** (DESCRIPTION seulement, ne pas l'appliquer)

## Couverture
- Tableau des archétypes audités + représentant testé + statut (OK / finding).
- Largeurs testées (matrice §4) + méthode (statique / visuel / dev server).

## Faux positifs écartés
- Liste des choix de design confirmés NON-bugs (fallback serif, marges voulues, EN, ...).

## Recommandation de correctif unifié (haut niveau, NON appliqué)
- Option A : tout en max-w-[1520px] (header/footer wrappés Container).
- Option B : contenu full-width (retirer le cap).
- Trade-offs, impact Web Vitals/CLS, ampleur, risque. STOP & ASK Will pour décision.
```

**Sévérités :**
- **P0** : scroll horizontal mobile, contenu coupé/inaccessible, CLS provoqué, désalignement majeur visible, touch target bloquant.
- **P1** : incohérence d'alignement notable, zone 992–1280 serrée, target < 44 px non bloquant.
- **P2** : gouttières incohérentes mineures, largeur de ligne trop large en ultra-wide.
- **P3** : nits, suggestions d'harmonisation.

Chaque finding **doit** citer `fichier:ligne`. Pas de finding sans preuve dans le code ou capture.

---

## 9. FIN DE PHASE 1 → POINT DE VALIDATION

À la fin de la Phase 1 :
- Le rapport `_AUDIT/...RAPPORT.md` est écrit.
- Tu présentes à Will : **synthèse + symptômes A/B/C confirmés + plan de correction §10 chiffré**.
- **🛑 STOP & ASK** : « Veux-tu que je passe en Phase 2 et que j'applique ces correctifs ? » → **attendre le OK explicite.** Tant qu'il n'a pas répondu, **ne touche à aucun fichier de code.**

---

## 10. PLAN DE CORRECTION (préparé en Phase 1, exécuté en Phase 2 après validation)

> Will veut « corriger **tout** ce qu'il faut ». Le plan doit être **exhaustif** et **centralisé** (corriger les composants partagés répare des milliers de routes d'un coup). Tu le **rédiges** en Phase 1 ; tu ne l'**appliques** qu'en Phase 2.

### 10.1 Chantier prioritaire — UNIFIER LE SYSTÈME DE LARGEUR (corrige A + B)
- Décider **une** source de vérité de largeur (probable : `Container` avec `max-w-[1520px]`) et y soumettre **header, contenu ET footer** :
  - soit wrapper le contenu interne de `Header.tsx` et `Footer.tsx` dans `<Container>` (recommandé : alignement parfait, gouttières mutualisées),
  - soit, si bord-à-bord voulu pour le fond, garder le fond pleine largeur mais **contraindre le contenu interne** au même `max-w` + `mx-auto` que le body.
- **Harmoniser les 3 rampes de gouttières** sur une seule échelle (ex. aligner header/footer sur celle de `Container` : `px-4 sm:px-6 lg:px-10 xl:px-16`).
- **Réévaluer le seuil 1520** : confirmer que c'est la valeur voulue (sinon il créera toujours une bascule visible entre 14″/16″ — documenter le choix).
- Vérifier que `Container.tsx` reste la **SSOT** : ne pas réintroduire de largeurs magiques divergentes.

### 10.2 Chantier prioritaire — HEADER QUI NE COUPE PLUS (corrige C)
Choisir et appliquer **une** stratégie cohérente (à proposer à Will avec trade-offs) :
- (a) **Avancer le breakpoint du drawer** mobile de `lg` (992) vers `xl` (1280) → la nav desktop n'apparaît que quand il y a la place. Le plus simple/sûr.
- (b) **Nav condensée intermédiaire** 992–1280 : gaps réduits, tagline `xl:` only (déjà partiellement le cas), CTA secondaire masqué < xl, labels mono-ligne.
- (c) **`flex-wrap` / overflow maîtrisé** ou regroupement d'items dans un « Plus »/mega-menu.
- Dans tous les cas : **plus aucun élément rogné** ni scroll horizontal de 360 → 2560 px. Re-tester la matrice §4.

### 10.3 Autres findings
- Appliquer les correctifs P0 → P1 → P2 → P3 du rapport, **par composant partagé d'abord** (effet de levier max), templates ensuite.
- Pour chaque fix : préserver **CLS = 0** et le budget **First Load JS ≤ 75 KB gz**.

### 10.4 Ordre d'exécution recommandé (Phase 2)
1. `Container.tsx` / `Section.tsx` (SSOT largeur) → 2. `Header.tsx` (+ `MobileNav`) → 3. `Footer.tsx` → 4. templates programmatiques → 5. pages éditoriales → 6. formulaires → 7. admin (si retenu).
Après chaque étape : re-tester la matrice §4 sur l'archétype touché.

---

## 11. GARDE-FOUS PHASE 2 (correction — uniquement après OK Will)

- ✅ Modifications de code autorisées **après validation explicite** uniquement.
- ✅ Travailler **sur le working tree partagé** (`main`) avec prudence : `git fetch` d'abord, vérifier `ahead/behind` (cf. mémoire « working tree partagé multi-conversations » — d'autres sessions éditent `axionia/`).
- ❌ **NE PAS `git push`** sans accord explicite de Will (push = deploy prod immédiat).
- ❌ **NE PAS commit** sans demander (Will peut vouloir relire le diff d'abord).
- ✅ **Mobile-first** : écrire les classes base = mobile, préfixes = montée en taille.
- ✅ **Respecter Web Vitals** (`AGENTS.md`) : CLS = 0 strict, LCP ≤ 1800, INP ≤ 100, First Load JS ≤ 75 KB gz. Tout patch qui dégrade un seuil → **STOP & ASK + ADR**.
- ✅ Respecter le **design system tokens** (`globals.css`) : pas de hex en dur hors `globals.css`, utiliser les utilities (`bg-canvas`, `text-fg`, gouttières via classes existantes).
- ✅ Ne pas casser les **breakpoints custom** (479/640/768/992/1280) ni régresser `prefers-reduced-motion`, `contain: layout style` du footer, `scroll-margin-top`.
- ✅ Lancer les **vérifs locales** disponibles avant de proposer le diff : `pnpm typecheck`, `pnpm lint`, tests Vitest concernés, et si possible un check visuel dev server. (Gate A = seul bloquant CI, cf. mémoire ; Lighthouse = autorité Web Vitals.)
- ✅ Ne pas toucher infra / `stub.invalid` / EN locale / Dockerfile / workflows.
- ✅ Mettre à jour le rapport `_AUDIT/...RAPPORT.md` avec une section « Correctifs appliqués » (fichier:ligne, avant/après, breakpoint validé).

---

## 12. RAPPEL FINAL

- **2 phases.** Phase 1 = audit lecture seule → **STOP & ASK** → Phase 2 = correction.
- En Phase 1, le seul fichier écrit est `_AUDIT/...RAPPORT.md`.
- **Jamais** de `push` (= deploy prod), **jamais** de `commit` sans accord, en aucune phase, sans OK explicite.
- 3 symptômes à corriger en priorité : **A** (cap 1520 mal placé 14″/16″), **B** (désalignement header/contenu/footer), **C** (header coupé 992–1280 avant la bascule mobile).
- Corriger **par composant partagé** d'abord (levier sur ~17 600 routes), puis templates.
- Distingue **bug** (incohérence) de **choix de design** (marges voulues, fallback serif, EN désactivé).
