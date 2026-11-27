# Rendu visuel des liens dans les articles — LIENS (conception)

Statut : conception uniquement. Aucun code applicatif. Maquette : [`maquette.html`](./maquette.html) (autonome, zéro JavaScript, ordinateur et téléphone).
Périmètre : pages d'articles (blog, actualités, guides). Ce document complète `../PLAN.md` et `../DECOUPAGE.md` sans les modifier.

## 1. L'idée en une phrase

Le propriétaire a demandé que les liens ne fassent ni « textuel » ni « bloc de texte », qu'ils donnent envie de lire et servent la prospection et la visibilité. Réponse retenue : **une signature visuelle par intention**, reconnaissable d'un coup d'œil.

| Intention                       | Signature                                                           | Élément                                                         |
| ------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------- |
| **Lire la suite** (sur le site) | bleu, soulignement épais adouci, petite flèche →                    | lien interne, cartes « À lire aussi », « Pour aller plus loin » |
| **Vérifier** (hors du site)     | bleu, icône « sortie » ↗ et pastille du domaine (`insee.fr`)        | lien externe, appels de note, bloc « Sources » (sauge)          |
| **Comprendre un mot**           | couleur du texte, pointillé terracotta, définition en note de marge | lien de glossaire                                               |
| **Passer à l'action**           | terracotta : lien dans le texte, puis carte mocha et vrais boutons  | liens vers `/appel`, `/journee-ia`, `/contact`                  |
| **Se repérer**                  | discret, chevrons sable                                             | fil d'Ariane                                                    |

Le texte courant reste calme (soulignement à 45 % d'opacité, pas de pastille partout). Ce calme fait ressortir les cartes, le bloc sable numéroté et la carte mocha, qui cassent l'effet « bloc de texte ».

## 2. Tableau de synthèse

« Produit par » indique qui écrit le HTML : le **générateur** (`bodyHtml`, passé par `sanitizeContentGenHtml`) ou un **composant** serveur du modèle de page (S2).

| #   | Élément                       | Quand l'utiliser                                                          | Maximum par article                                                         | Produit par                                                      |
| --- | ----------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | Fil d'Ariane                  | toujours, au-dessus du titre                                              | 1                                                                           | composant `Breadcrumbs` (existant)                               |
| 2   | Lien interne dans le texte    | quand un passage renvoie naturellement à une page qui approfondit         | **6** (4 pages du site + 2 articles), 1 par paragraphe, aucun dans le chapô | générateur + `internal-link-catalog.ts` / `inject-deep-links.ts` |
| 3   | Lien externe dans le texte    | pour une donnée, une règle ou une étude : la source se nomme dans l'ancre | **4**                                                                       | générateur + `external-links-injector.ts`                        |
| 3b  | Appel de note `[n]`           | après chaque affirmation chiffrée ou réglementaire sourcée                | 1 par source citée                                                          | générateur (ou post-traitement)                                  |
| 4   | Lien de glossaire             | 1er emploi d'un terme technique qui a une fiche dans `/glossaire`         | **3** termes, 1re occurrence seulement                                      | générateur (marque) + composant (définition)                     |
| 5   | Cartes « À lire aussi »       | au milieu, après le 2e H2 (entre 35 et 50 % de l'article)                 | **1 bloc, 3 cartes**                                                        | composant `SuggestedContent` (jamais dans `bodyHtml`)            |
| 6   | Carte de service (milieu)     | juste après le passage le plus concret, jamais avant le premier tiers     | **1**, 1 seul bouton                                                        | composant `CtaGabarit` (S2)                                      |
| 7   | Lien de service dans le texte | une fois, après l'introduction (15 à 25 % du texte)                       | **1**                                                                       | générateur                                                       |
| 8   | « Pour aller plus loin »      | fin d'article, avant le bloc d'action                                     | **3 liens**, internes                                                       | composant (S2), alimenté par le maillage                         |
| 9   | Bloc d'action de fin          | toujours en fin d'article                                                 | **1** : 1 bouton primaire, 1 secondaire, `/contact` en lien                 | composant `CtaGabarit` (S2)                                      |
| 10  | Bloc « Sources »              | dès qu'une source est citée ; seulement les sources réellement citées     | **8** sources                                                               | composant `ArticleSources` (existant, à restyler)                |

**Appels à l'action** : 3 emplacements au maximum par article (7 + 6 + 9), jamais deux boutons primaires vers deux pages différentes à moins de deux écrans d'écart, jamais de carte de service collée aux cartes « À lire aussi ».

## 3. Élément par élément

Toutes les règles CSS sont bornées à `[data-gabarit]` (contrainte du PLAN §1.3) : la V1 ne change pas. Couleurs = jetons de `src/app/globals.css` uniquement (`anti-hex:check`).

### 3.1 Fil d'Ariane

- Rendu : 0,9375 rem, `--color-fg-muted` ; séparateur chevron en masque CSS `--color-border-strong` ; liens sans soulignement au repos, soulignés + fond `--color-primary-soft` au survol ; page courante en `--color-fg` 600, tronquée par `…` (22 ch ordinateur, 14 ch téléphone).
- Cible : `min-height: 1.5rem` + padding (≥ 24 px, WCAG 2.5.8).
- Hiérarchie = celle que produit déjà `Breadcrumbs` pour la route (blog, guides ou actualités) ; dernier élément = le H1 exact.
- Balisage (composant `Breadcrumbs`, déjà émetteur du `BreadcrumbList` — **ne pas en émettre un second**) :

```html
<nav class="ariane" aria-label="Fil d'Ariane">
  <ol>
    <li><a href="/fr">Accueil</a></li>
    <li><a href="/fr/guides">Guides</a></li>
    <li><span aria-current="page">Titre exact du H1</span></li>
  </ol>
</nav>
```

### 3.2 Lien interne dans le texte

- Rendu : `--color-primary`, graisse 600 (déjà chargée) ; `text-decoration: underline 2px` en bleu à 45 % (`color-mix`), décalé de 0,22 em ; petite flèche → en masque CSS (0,72 em, opacité 0,75). Survol : couleur `--color-primary-hover`, soulignement plein, surligneur `--color-primary-soft` (transition de `background-size`), flèche +2 px.
- Le **soulignement est obligatoire** : bleu et texte n'ont que 2,6:1 entre eux, la couleur seule ne suffit pas (RGAA 10.6, WCAG 1.4.1).
- Ancre : 2 à 6 mots qui décrivent la page cible, prise dans une phrase du texte. Interdits : « cliquez ici », « ici », « en savoir plus », « ce lien », une URL brute, le même mot-clé exact sur plusieurs liens, un lien dans un H2/H3. Une ancre donnée → une seule URL.
- Pas de `rel`, pas de `target`.

```html
<a href="/fr/blog/cartographier-taches-repetitives-pme" data-lien="article"
  >cartographier les tâches répétitives de votre équipe</a
>
<a href="/fr/securite-donnees" data-lien="page">sécurité et hébergement des données</a>
```

`data-lien` : `article` (autre article), `page` (page du site : hub, guide pilier, sécurité, méthode), `service`, `source`, `glossaire`.

### 3.3 Lien externe dans le texte

- Rendu : même base que le lien interne, mais icône « sortie » ↗ (masque CSS, se décale en diagonale au survol) et **pastille du domaine** en Inconsolata sur fond `--color-sand` (`insee.fr`). La pastille est **dans** le lien : elle fait partie du nom accessible (« enquête de l'Insee sur les TIC dans les entreprises insee.fr »).
- Ancre : l'organisme + l'objet (« rapport de la CNIL sur l'IA générative »).
- **Même onglet, pas de `target="_blank"`** (arbitrage §6). Si un cas impose un nouvel onglet (document PDF officiel, par exemple), le lien porte `target="_blank"`, `rel` contenant `noopener`, et `<span class="sr-only"> (nouvelle fenêtre)</span>` à la fin de l'ancre ; l'icône reste la même.
- `rel` posé par le sanitizer selon `trustTier` (rien à écrire côté générateur) :

| Cas                                                  | `rel`                                        |
| ---------------------------------------------------- | -------------------------------------------- |
| interne                                              | aucun                                        |
| externe `official` / `high`                          | `noopener noreferrer` (suivi)                |
| externe `standard` / `low` / inconnu                 | `nofollow noopener noreferrer`               |
| sponsorisé, affilié, partenaire rémunéré             | `sponsored nofollow noopener noreferrer`     |
| domaine exclu (forums, plateformes de blog ouvertes) | pas de lien : le texte reste, le `<a>` saute |

```html
<a href="https://www.insee.fr/…" data-lien="source" data-source-id="ext_123"
  >enquête de l'Insee sur les TIC dans les entreprises <span class="lien-domaine">insee.fr</span></a
><sup class="appel-note"><a href="#source-1" id="appel-1" aria-label="Source 1">1</a></sup>
```

### 3.4 Appels de note et bloc « Sources »

- **Appel** : pastille sauge `--color-sage` sur `--color-sage-soft`, chiffre en Inconsolata, cible ≥ 24 px par padding (marge négative pour ne pas écarter les lignes). Libellé « Source 1 », pas d'`aria-describedby` (qui ferait relire toute la source).
- **Bloc** : carte blanche à filet gauche sauge de 4 px ; titre « SOURCES » en Inconsolata avec picto livre ; chaque source = pastille numérotée, titre du document en `<cite>` souligné sable, icône sortie, puis ligne de méta : **éditeur · domaine · date du document** · badge « Source officielle » (si `trustTier = official`) · lien retour ↩ (« Retour au texte, appel 1 »). `li:target` surligné en sauge doux, `scroll-margin-top: 6rem`.
- **Date affichée = `ExternalReference.publishedAt`, jamais une date de vérification** tant qu'aucun processus ne la produit vraiment (GEO-071, commentaire de `ArticleSources.tsx`). Pas de date connue → pas de date.
- Données déjà en base, **aucune migration** : `ExternalReference.{title, publisher, publisherDomain, trustTier, publishedAt}` via `ContentCitation`.
- JSON-LD : `isBasedOn` pour 1 à 3 sources de fond, `citation` pour les autres, **jamais la même URL dans les deux** (PLAN §8, J1).

```html
<section class="sources" aria-labelledby="titre-sources">
  <h2 id="titre-sources">Sources</h2>
  <ol>
    <li id="source-1">
      <span class="src-titre"
        ><a href="https://www.insee.fr/…" rel="noopener noreferrer"
          ><cite>Titre du document</cite></a
        ></span
      >
      <span class="src-meta"
        >Insee · insee.fr · <time datetime="2024">2024</time>
        <span class="src-badge">Source officielle</span>
        <a class="src-retour" href="#appel-1" aria-label="Retour au texte, appel 1">↩</a></span
      >
    </li>
  </ol>
</section>
```

### 3.5 Lien de glossaire

- Rendu : couleur du texte, graisse 600, **soulignement pointillé terracotta** de 2 px (plein au survol). La définition courte est **toujours visible** : note de marge à droite de la colonne de lecture sur ordinateur (≥ 72 rem, filet terracotta), encart compact sous le paragraphe sur téléphone. Picto « Aa », terme en Inconsolata capitales, définition en 1 phrase, lien « Voir la fiche du glossaire ».
- Pourquoi pas une infobulle : sans JavaScript, elle ne se ferme pas à la touche Échap (WCAG 1.4.13) et ne s'ouvre pas au toucher. Pourquoi pas `<details>` : c'est un bloc, interdit dans un `<p>` (le navigateur coupe le paragraphe).
- **La définition vient de la fiche du glossaire, jamais du modèle de langage** : le générateur marque le terme ; le modèle de page (ou un post-traitement serveur) insère l'`aside` à partir de la fiche `/glossaire/[slug]`. Terme sans fiche → pas de lien.

```html
<!-- généré -->
<a href="/fr/glossaire/rag" data-lien="glossaire" aria-describedby="def-rag">RAG</a>
<!-- inséré après le paragraphe, depuis la fiche ; aria-describedby vise le SEUL <p> de définition -->
<aside class="note-glossaire" id="note-rag" aria-label="Définition : RAG">
  <dfn>RAG</dfn>
  <p id="def-rag">
    Génération augmentée par recherche : l'IA consulte d'abord vos documents, puis rédige à partir
    de ce qu'elle y a trouvé.
  </p>
  <a href="/fr/glossaire/rag">Voir la fiche du glossaire</a>
</aside>
```

Placement en marge : `.corps` devient une grille à deux colonnes (42 rem + 15 rem) au-delà de 72 rem ; l'`aside` va en colonne 2 avec `grid-row: span 3` ; les blocs larges portent la classe `pleine` (`grid-column: 1 / -1`). Ne jamais placer une note juste avant un bloc `pleine`.

### 3.6 Cartes « À lire aussi »

- Rendu : bandeau « — À LIRE AUSSI » terracotta ; grille `auto-fit, minmax(14rem, 1fr)` (3 colonnes sur ordinateur) ; carte blanche, bord `--color-border`, rayon 14 px. Vignette **3:2 réservée** : l'image Unsplash **déjà attribuée** à l'article cible si elle existe, sinon dégradé doux + pictogramme selon le type (guide : terracotta ; analyse : bleu ; actualité : sauge). Type en capitales Inconsolata + temps de lecture ; titre Fraunces 600, 3 lignes max ; pied « Lire le guide → ». Survol : carte −3 px, ombre, flèche +4 px. **Téléphone** : carte horizontale (vignette 6,5 rem à gauche) pour ne pas empiler trois grands blocs.
- Un seul lien par carte (le titre), étendu par `h3 a::after { inset: 0 }`. Nom accessible = le titre. Focus sur la carte entière (`.carte:has(a:focus-visible)`). Image `alt=""`, picto `aria-hidden`. Hauteur ≥ 44 px largement tenue.
- Choix des 3 articles : `findRelatedArticles` avec `limit: 3` (4 par défaut aujourd'hui). Pas d'`ItemList` JSON-LD pour ce bloc (PLAN §8).
- Image : `next/image`, `width`/`height` explicites, `loading="lazy"`, `decoding="async"`, pas de `priority` ni de `placeholder="blur"`, `sizes="(min-width: 1024px) 300px, (min-width: 640px) 45vw, calc(100vw - 2rem)"`, ≤ 25 Ko AVIF. **Aucune nouvelle sélection d'image** (PLAN §1.1).
- `<Link prefetch={false}>` (sinon Next précharge chaque carte visible).

```html
<aside class="lire-aussi" aria-labelledby="titre-lire-aussi">
  <h2 class="bloc-titre" id="titre-lire-aussi">À lire aussi</h2>
  <ul class="cartes">
    <li class="carte">
      <figure class="vignette v-guide"><!-- img alt="" ou svg.picto aria-hidden --></figure>
      <div class="carte-corps">
        <p class="carte-type"><b>Guide</b><span>· 7 min</span></p>
        <h3>
          <a href="/fr/guides/…">Mettre en place votre premier assistant IA en quatre semaines</a>
        </h3>
        <span class="carte-lire" aria-hidden="true">Lire le guide</span>
      </div>
    </li>
  </ul>
</aside>
```

### 3.7 Liens vers les pages de service

Libellés repris du site : « Diagnostic IA, 45 min » (`src/messages/fr.json`, `method1Title`), « Diagnostic IA gratuit pour qualifier votre besoin et choisir le bon module » (`method1Description`), « Gratuit · 45 minutes · Sans engagement » (page `/appel`, **propre au Diagnostic IA**), « audit IA le matin, équipes formées l'après-midi » et « dans vos locaux » (`/journee-ia`), « Parlons de vous » (`/contact`). Aucun prix, aucun frais de déplacement, aucune ville, aucun chiffre de gain, aucune promesse de résultat.

- **Dans le texte (1 fois)** : `data-lien="service"`, même forme que le lien interne mais en **terracotta** (`--color-terracotta-deep`, soulignement terracotta, surligneur `--color-terracotta-soft`) : « passer à l'action » se distingue de « lire la suite ».
- **Carte du milieu (1 fois)** : son titre est un `<p class="cs-titre">`, pas un `<h2>`, pour ne pas entrer dans le sommaire ni casser la hiérarchie des H2 ; le bloc de fin garde son `<h2>` (c'est une vraie section). S2 ne doit pas « harmoniser ». Fond mocha en dégradé radial, sur-titre `--color-terracotta-on-mocha` avec picto calendrier, titre Fraunces, une ligne de bénéfice, réassurance en Inconsolata, **un** bouton terracotta. Focus `--color-terracotta-on-mocha` (le bleu échoue sur mocha : 2,25:1).
- **Réassurance** : toujours écrite « Diagnostic IA : gratuit · 45 minutes · sans engagement » et placée sous le bouton du Diagnostic, dans le même conteneur (`div.fin-primaire`) : ordre du DOM bouton primaire → réassurance → bouton secondaire. Jamais sous un bouton `/journee-ia` ni sous deux boutons à la fois : le lecteur croirait la Journée IA gratuite.
- **Bloc de fin** : titre en question (« Par où commencer chez vous ? »), bouton primaire terracotta + bouton secondaire à contour bleu, réassurance, `/contact` en lien de repli (« Une autre question ? Parlons de vous »). `/contact` n'est **jamais** un bouton primaire.
- Boutons : de vrais `<a>` (ils mènent à une page), hauteur ≥ 48 px, rayon 10 px, flèche qui avance au survol ; pleine largeur sur téléphone.
- Cible selon le sujet :

| Sujet de l'article                                              | Primaire      | Secondaire               |
| --------------------------------------------------------------- | ------------- | ------------------------ |
| acculturation, formation des équipes, usages dispersés          | `/journee-ia` | `/appel`                 |
| stratégie, choix d'outil, retour sur investissement, cas métier | `/appel`      | `/journee-ia`            |
| actualité, réglementation                                       | `/appel`      | `/contact` en lien texte |

- Microcopie validée (aucun prix) :
  - stratégie : carte « Vos priorités IA, en 45 minutes » → « Réserver mon Diagnostic IA » ; fin : « Réserver mon Diagnostic IA » / « Découvrir la Journée IA » ;
  - guide pratique : carte « Vos équipes, formées sur vos cas réels » / « Audit IA le matin, formation l'après-midi, dans vos locaux. » → « Découvrir la Journée IA » ; fin : « Découvrir la Journée IA » / « Pas sûr ? Réserver un appel » ;
  - actualité : carte « Et pour votre PME, ça change quoi ? » / « On en parle en 45 minutes, en visio ou par téléphone. » → « Réserver un appel ».
- Textes visibles des composants : via `next-intl` (`src/messages/gabarits/commun.{fr,en}.json`, prévu par S2), jamais en dur.

```html
<!-- dans le texte, généré -->
<a href="/fr/appel" data-lien="service">faire le point en 45 minutes avec un Diagnostic IA</a>
<!-- bouton, composant -->
<a class="btn btn-primaire" href="/fr/appel" data-lien="service"
  >Réserver mon Diagnostic IA<span class="fl" aria-hidden="true"></span
></a>
```

### 3.8 « Pour aller plus loin »

- Rendu : panneau `--color-sand`, rayon 18 px ; titre Fraunces ; une ligne d'accroche ; liste de 3 lignes séparées par un filet `--color-sand-deep`, chacune = numéro « 01 » en Inconsolata terracotta, titre 600, type + durée en capitales, flèche à droite. Survol : fond blanc, titre bleu souligné, flèche +3 px. Ligne ≥ 56 px.
- Contenu : guide pilier du thème, un article complémentaire ou le glossaire (pas de page ville : la marque n'affiche aucune ville dans les articles). **Jamais une page déjà ciblée par le bloc de fin ou la carte de service** (sinon le plafond de 3 emplacements d'action est contourné).
- `nav aria-labelledby` (c'est une liste de navigation), `<Link prefetch={false}>`.

```html
<nav class="plus-loin" aria-labelledby="apl-titre">
  <h2 id="apl-titre">Pour aller plus loin</h2>
  <ol>
    <li>
      <a href="/fr/guides/ia-pme-guide-complet"
        ><span
          ><span class="apl-titre">L'IA dans une PME : le guide complet</span
          ><span class="apl-type">Guide pilier · 15 min</span></span
        ></a
      >
    </li>
  </ol>
</nav>
```

## 4. Ce que le générateur doit produire, et ce qu'il faut changer pour qu'il le puisse

Le générateur n'écrit **que** dans `bodyHtml` : liens internes (`data-lien="article" | "page" | "service"`), liens externes (`data-lien="source"` + `span.lien-domaine` + `data-source-id`), appels de note (`sup.appel-note`), marques de glossaire (`data-lien="glossaire"`). Tout le reste (fil d'Ariane, cartes, carte de service, « Pour aller plus loin », bloc de fin, Sources, notes de glossaire) est rendu par des composants serveur à partir de données en base : **jamais** de schema.org ni de bloc de cartes dans `bodyHtml`.

Changements nécessaires dans `src/server/content-gen/shared/html-sanitizer.ts` (lot générateur, pas S2) :

- `ALLOWED_ATTR` **et** `ADD_ATTR` : `data-lien` (valeurs filtrées : `article`, `page`, `service`, `source`, `glossaire`), `data-source-id` ;
- `ALLOWED_ATTR` : `aria-label`, `aria-describedby` (vers un `id` du même document) ;
- `ALLOWED_TAGS` : `sup`, `cite`, `time` ;
- classes conservées : `lien-domaine`, `appel-note` ;
- poser `sponsored` quand le lien du catalogue est marqué comme tel (n'existe pas aujourd'hui) ;
- retirer le `<a>` (garder le texte) pour un domaine exclu ;
- appeler `sanitizeContentGenHtml` **après** `inject-deep-links` et `external-links-injector`, pour que le `rel` soit posé sur le HTML final ;
- un **seul classement** des sources : aujourd'hui `persist-citations.ts` dérive le niveau de la note du catalogue alors que le sanitizer se fie à une liste de domaines codée en dur ; une source bien notée mais absente de la liste sort en `nofollow`. Le commentaire d'en-tête de `trust-tier.ts` (« standard : dofollow », l. 16) contredit le code (`standard` → `nofollow`) : à corriger.

Liens déjà en base (articles publiés avant ce lot) : ils n'ont pas de `data-lien`. Les feuilles de style ciblent donc aussi `[data-gabarit] .corps > p a[href^="/"]:not([data-lien])` (interne) et `a[href^="http"]:not([data-lien])` (externe, sans pastille de domaine) pour un rendu correct sans régénération.

## 5. Accessibilité, performance, budget

- **Contrastes vérifiés** : texte sur ivoire 16,7:1 ; bleu sur ivoire 6,4:1 ; terracotta `#b23f16` sur ivoire 5,5:1 ; `fg-muted` 7,5:1 ; ivoire sur mocha 13,7:1 ; `terracotta-on-mocha` sur mocha 5,8:1. **Interdits** : bleu, terracotta ou `fg-muted` sur mocha ; `terracotta-on-mocha` sur fond clair.
- **Focus** : `outline: 3px solid var(--focus-ring); outline-offset: 2px` ; `--focus-ring` = bleu sur clair, `--color-terracotta-on-mocha` dans la carte mocha. Jamais de focus par `box-shadow` seul (invisible en couleurs forcées).
- **Cibles** : boutons ≥ 48 px, lignes « Pour aller plus loin » ≥ 56 px, cartes > 44 px ; fil d'Ariane, appels de note, titres et liens retour du bloc Sources ≥ 24 px (ce ne sont pas des liens « en ligne ») ; liens dans le texte exemptés (WCAG 2.5.8, exception « en ligne »).
- **Survol = clavier** : chaque effet de survol (surligneur, flèche qui avance, carte qui se soulève, ligne qui blanchit) a son équivalent `:focus-visible` (ou `:focus-within` pour la carte).
- **Pictos** : masques CSS sur pseudo-éléments (non lus) ; SVG inline `aria-hidden="true" focusable="false"`.
- **`forced-colors`** : pictos en `LinkText`, bordures `CanvasText`, focus `Highlight`. **`prefers-reduced-motion`** : aucune transition, pas de translation de carte.
- **Zéro JavaScript client**, aucun `"use client"`, aucun aperçu au survol, aucun `preconnect`/`dns-prefetch` vers les domaines sources, pas de favicon des sources, pas de nouvelle police ni graisse (Manrope 400/600, Fraunces droite, Inconsolata).
- **CLS = 0** : vignettes à cadre réservé (`aspect-ratio`), survol limité à `color`, `background-*`, `text-decoration-*`, `opacity`, `transform`, `box-shadow` ; jamais de `font-weight`, `padding`, `border-width` au survol.
- **Budget CSS — mesuré sur la maquette** (gzip -9, commentaires et `-webkit-mask` retirés) :
  - styles du corps (liens interne, externe, service, glossaire, appels de note, notes de marge) : **1,33 Ko gz**, dont environ 0,3 Ko pour les trois icônes en data-URI ;
  - styles de tous les liens et blocs : **3,6 Ko gz** — **au-delà** des + 2 Ko accordés à toute la refonte (PLAN §7).
  - Donc : seule la partie « corps » va dans `src/styles/article-v2/base.css` (cible **≤ 1 Ko gz** après factorisation : une règle `[data-lien]::after { mask: var(--ico) }` et une variable par type) ; les blocs rendus par composants (cartes, carte de service, boutons, « Pour aller plus loin », Sources, fil d'Ariane) sont écrits en **utilitaires Tailwind** autant que possible. Attention : masques, `:has()`, compteurs et `line-clamp` sur pseudo-éléments créent quand même du CSS nouveau dans la feuille globale, inlinée sur toutes les pages. **S2 mesure le delta de la feuille globale ET de `base.css`** ; total ≤ + 2 Ko gz pour toute la refonte, sinon STOP & ASK Will.

## 6. Arbitrages entre spécialistes

| Désaccord                                                                             | Décision                                                                                          |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Designer : pas de picto sur le lien interne ; demande du propriétaire : petite flèche | flèche → discrète (0,72 em, opacité 0,75), en plus du soulignement                                |
| Designer : externe en pointillé ; glossaire aussi en pointillé                        | pointillé réservé au glossaire ; externe = icône + pastille du domaine                            |
| `target="_blank"` sur les externes                                                    | **non** (accessibilité RGAA 13.2, SEO, mobile) ; exception documentée avec « (nouvelle fenêtre) » |
| Glossaire en `<details>` ou infobulle                                                 | **ni l'un ni l'autre** : lien vers la fiche + note de marge toujours visible                      |
| Conversion : barre collante sur téléphone après 60 % de lecture                       | **refusée** : elle demande du JavaScript (défilement) ; le bloc de fin suffit                     |
| SEO : 2 liens de service ; conversion : 3 emplacements                                | 3 emplacements, dont un seul lien dans le texte et un seul bouton au milieu                       |
| Sources : « date »                                                                    | date de publication du document (`publishedAt`), jamais une date de vérification non produite     |

## 7. Avis des spécialistes (2 lignes chacun)

- **Design éditorial** : une couleur par intention (bleu lire, sauge vérifier, pointillé terracotta comprendre, terracotta agir) rend chaque lien lisible d'un coup d'œil. Les cartes à vignette, le bloc sable numéroté et la carte mocha cassent l'effet « bloc de texte ».
- **SEO** : 6 liens internes descriptifs valent mieux que 8 posés mécaniquement ; le risque principal est le double classement des sources, qui retire le suivi à des sources fiables. Pour les moteurs d'IA, compte surtout une source nommée dans le texte et reprise en `citation`.
- **Conversion** : le Diagnostic IA (45 min, sans engagement) est la porte la plus basse et doit être le primaire par défaut ; la Journée IA ne l'est que si l'article a déjà convaincu de former les équipes. Mesurer chaque emplacement séparément (événement ou UTM) avant d'en ajouter.
- **Accessibilité** : la palette tient sur fond clair ; sur mocha, seuls l'ivoire et `terracotta-on-mocha` sont utilisables, y compris pour le focus. Les points critiques sont le soulignement obligatoire, un seul lien par carte et l'abandon de `_blank`.
- **Performance** : aucun JavaScript et aucun décalage si les vignettes sont réservées et si le survol ne touche jamais la géométrie. Le vrai risque est la CSS inlinée sur toutes les pages : mesurer, ne pas supposer.

## 8. Ce que reprennent les autres lots

**S2 — composants communs** (`feat/gabarits-articles-s2-composants`)

- dans `src/styles/article-v2/base.css` : jetons `--lien-souligne`, `--focus-ring`, `--ico-fleche`, `--ico-sortie`, `--ico-chevron` et règles du §3.2 à §3.5, bornées à `[data-gabarit]`, ≤ 1 Ko gz ;
- `CtaGabarit` : carte de service (§3.7) et bloc de fin, avec la table « sujet → page cible » et la microcopie dans `src/messages/gabarits/commun.{fr,en}.json` ;
- restyler `SuggestedContent` (variante V2, `limit: 3`, carte horizontale sur téléphone, `prefetch={false}`), `ArticleSources` (numéros, méta, badge, liens retour, `li:target`) et `Breadcrumbs` (variante V2), **V1 inchangée** ;
- nouveau composant « Pour aller plus loin » et insertion serveur des notes de glossaire depuis les fiches ;
- grille `.corps` à colonne de marge ≥ 72 rem et classe `pleine` ;
- tests : aucun `"use client"`, un seul `<a>` par carte, `aria-current` sur le fil, `aria-label` des appels et des retours, CSS ≤ budget.

**G1 à G8 — gabarits**

- placer les blocs aux positions du §2 (cartes après le 2e H2, carte de service après le passage le plus concret, fin : « Pour aller plus loin » → bloc d'action → Sources) ;
- choisir la page de service primaire selon la table du §3.7 : G2 Guide → `/journee-ia` si le sujet est la formation ; G1 Analyse, G3 Comparatif, G4 Sélection, G5 Cas → `/appel` ; G6 Définition et G7 FAQ → `/appel` et glossaire mis en avant ; G8 Chiffres → appels de note et bloc Sources en avant ;
- ne rien styler de nouveau pour les liens dans leur feuille propre : tout vient de `base.css`.

**Tâche `feat/contenu-lisibilite-valeur` (générateur de contenu)**

- produire le balisage du §4 (`data-lien`, `lien-domaine`, `appel-note`, marques de glossaire) et respecter les plafonds du §2 ;
- règles d'ancres du §3.2 dans les consignes du modèle ;
- élargir la liste blanche du sanitizer, ordre sanitizer après injections, classement unique des sources, `sponsored`, domaines exclus (§4) ;
- tests : un article d'exemple passe le sanitizer avec tous les attributs conservés ; aucun `target="_blank"` émis par défaut.

## 9. Ce qui n'est pas tranché ici

- Mesure des clics par emplacement : à concevoir avec la tâche analytique (aucun script ajouté côté client).
- Version anglaise : les libellés EN seront écrits avec les fichiers de messages ; la locale reste désactivée.
