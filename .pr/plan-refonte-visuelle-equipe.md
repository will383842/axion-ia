# Plan de refonte visuelle des pages équipe (R1)

Chantier « Pages équipe », lot R1 : plan seul, aucun code produit. Ce plan sert de consigne aux
robots d'exécution (lots R2a à R2d). Il porte sur le gabarit unique `/fr/equipe/[slug]` (Williams
et tous les collaborateurs). Le hub `/fr/equipe` n'est pas refondu ici (voir « Hors périmètre »).

## 0. Point de départ et constat

### 0.1 Base de code

- La refonte part de la branche `origin/feat/equipe-f7-sections` (sections propres par catégorie,
  `ActionsFiche`, `SectionsCategorie`, `modeles-categorie.ts`). **Au moment du plan, elle n'est pas
  fusionnée dans `main`.** Chaque lot R2 commence donc par :
  `git fetch origin && git merge-base --is-ancestor origin/feat/equipe-f7-sections origin/main`.
  Si la commande rend 0 : brancher depuis `origin/main`. Sinon : brancher depuis
  `origin/feat/equipe-f7-sections` et l'écrire dans le corps de PR (« dépend de F7 »).
- Fichiers lus pour ce plan (version F7) :
  - route : `src/app/[locale]/equipe/[slug]/page.tsx` (métadonnées, `JsonLdGraph`, fil d'Ariane) ;
  - gabarit : `src/components/equipe/ProfilCollaborateur.tsx`, `HeroCollaborateur.tsx`,
    `FicheIdentite.tsx`, `BlocsTransformation.tsx` (`AvantApres`, `Rassurance`, `PorteEntree`),
    `MethodeCollaborateur.tsx`, `MetiersCollaborateur.tsx`, `ParcoursSection.tsx`,
    `CitationsTerrain.tsx`, `SectionsCategorie.tsx`, `ActionsFiche.tsx`, `PastilleCategorie.tsx`,
    `PortraitCollaborateur.tsx`, `couleurs-categorie.ts` ;
  - données : `src/lib/equipe/contenu.ts` (`ContenuFiche`), `types.ts`, `categories.ts`,
    `modeles-categorie.ts`, `depuis-membre.ts`, `depuis-membre-categorie.ts` ;
  - textes de Williams : `src/content/equipe/williams.ts` ;
  - JSON-LD : `src/lib/seo/collaborateur-jsonld.ts` (Person, ProfilePage, BreadcrumbList,
    FAQPage dans un seul `@graph`), `src/lib/seo/williams-person.ts` (entité de Williams) ;
  - briques réutilisables : `components/sections/TimelineBlock.tsx` (frise verticale),
    `ProcessSteps.tsx` (étapes numérotées), `MetricsRow.tsx` + `marketing/Stat.tsx` (grands
    chiffres ; attention au fond, § 1.3), `marketing/FaqAccordion.tsx`
    (`details/summary`, zéro JS), `marketing/AnswerCard.tsx` (réponse courte, `data-aeo`),
    `marketing/DarkTriadPanel.tsx` (panneau mocha), `layout/Section.tsx` (tons `canvas`, `paper`,
    `sand`, `mocha`…), `sections/CtaBlock.tsx` (tons dont `terracotta`).
- Tous ces composants sont des composants serveur (aucun `"use client"`). Le gabarit actuel n'a
  aucun JS client propre : **la refonte doit garder ce zéro.**

### 0.2 Ce qui ne va pas aujourd'hui (constat du propriétaire du site)

Tout est texte sur crème pâle ; « en bref » est un tableau gris à petits caractères ; l'avant /
après est une pile de cartes beiges identiques ; « sans chamboulement » et la Journée IA sont de
longues listes à coches ; les services sont des cartes blanches de texte ; le parcours est fait de
paragraphes. Aucun schéma, aucun chiffre mis en valeur, aucune zone de contraste, aucun rythme.

### 0.3 Objectif

Une page d'expert haut de gamme, rythmée (alternance clair / foncé), faite de petits blocs, de
schémas et de chiffres, où un dirigeant de TPE ou de PME se reconnaît en dix secondes ; et une
page parfaitement extractible par Google (extrait en position 0) et par les moteurs génératifs
(ChatGPT, Perplexity, Google AI Overviews, Claude).

## 1. Règles à respecter dans tous les lots (à recopier dans chaque PR)

### 1.1 Contenu

- Dépôt public : aucune mention interne, aucun nom d'outil interne, aucun « ordre de », aucun
  prix, aucune marge, aucun tarif, aucun montant.
- Jamais « Grenoble » : écrire « partout en France » (ou « partout en France, outre-mer compris »).
- Jamais « Aucun gain garanti ». Jamais « freelance ». Pas de « garantit » en dehors de la phrase
  de garantie de la Journée IA, injectée depuis `src/content/journee-ia-commun.ts`
  (`GARANTIE_PHRASE`, `CONDITION_GARANTIE`, `RAPPORT_COMPLET`), jamais retapée.
- Fiches apporteur : aucun montant, aucune commission, aucun taux, aucun « rémunéré ».
- **Prénom seul** pour tout collaborateur (champ `FichePublique.nom`), sauf Williams Jullin.
- Aucun chiffre inventé : un chiffre affiché vient d'une constante de `williams.ts` (faits
  vérifiés) ou d'un champ réel de la fiche. Pas de donnée : pas de bloc.
- Langue : Axion-IA est une équipe (« nous », « l'équipe d'Axion-IA ») ; mot principal
  « startup » (constante `NATURE_AXION_IA`) ; jamais « agence » ; « aide à », jamais « garantit ».
- Financement OPCO / France Travail : seulement derrière les deux drapeaux déjà en place
  (`isQualiopiPublicDisclosureEnabled() && isQualiopiCertificationObtenue()`).

### 1.2 Entités et données structurées

- Ne JAMAIS modifier l'`@id` Person ni les `sameAs` de Williams Jullin
  (`src/lib/seo/williams-person.ts`). Le fichier peut être LU, pas modifié.
- Aucune migration Prisma, aucun job BullMQ, aucun enum. Les nouveaux champs de `ContenuFiche`
  sont **optionnels** et calculés depuis des champs existants.

### 1.3 Couleurs (jetons existants de `globals.css`, aucun hex dans les composants)

- Terracotta en tête (accent principal, chiffres, flèches, numéros d'étape).
- Couleurs de catégorie existantes (`couleurs-categorie.ts`, `jetonsDe()`) : direction
  `terracotta`, apporteur `ochre` (texte `ochre-deep`), développeur `sage`, spécialiste IA `plum`
  (texte `plum-deep`), partenaire `mocha`.
- Fonds : `bg-bg` (ivoire), `bg-sand` (crème), `bg-paper` (cartes), `bg-mocha` (bandeaux
  foncés), `bg-terracotta-deep` (bandeau d'appel final). Texte : `text-fg` (mocha foncé).
- **JAMAIS de bleu** dans le gabarit : ni `text-primary`, ni `bg-primary`, ni `halo-cool`, ni
  `accent-purple`, ni variante `primary`/`purple` de `Stat`. L'en-tête du site n'est pas touché.
- ⚠️ **Deux bleus cachés dans des briques existantes, à éviter :**
  - la classe `.bg-mocha-rich` (`globals.css`) superpose un halo **bleu**
    (`rgba(26, 77, 217, 0.14)`). Elle est donc **interdite** dans le gabarit, ainsi que tout ce
    qui la pose : `Section tone="mocha"`, `CtaBlock tone="mocha"|"dark"`, `DarkTriadPanel`.
    Les fonds foncés du gabarit utilisent `bg-mocha` + un halo terracotta seul, posé en
    `style` par une constante exportée de `visuels/SectionFiche.tsx` (même procédé que le héros
    actuel) :
    `export const HALO_TERRACOTTA = { backgroundImage: "radial-gradient(at 85% 15%, rgba(194, 74, 27, 0.22) 0px, transparent 55%)" } as const;`
    `globals.css` n'est pas modifié.
  - le composant `Button` (donc `Cta`) pose `focus-visible:ring-primary` (bleu). Chaque `Cta`
    du gabarit reçoit `className="focus-visible:ring-terracotta"` (sur fond foncé ou
    terracotta : `focus-visible:ring-mocha-fg focus-visible:ring-offset-mocha`) ; `cn` fusionne
    les classes et la dernière l'emporte. Un test le vérifie.
  - `Stat` s'adapte au fond par le sélecteur `[.bg-mocha-rich_&]` : sur `bg-mocha` il ne
    s'adapte pas. Ne pas l'utiliser sur fond foncé ; `BandeauChiffres` pose ses propres
    classes.
  - Variantes de boutons, sans en créer de nouvelle : sur clair, primaire `terracotta` +
    secondaire `outline` ; sur `bg-mocha`, primaire `terracotta` + secondaire `outline` (pastille
    claire, texte `fg`) ; sur `bg-terracotta-deep`, primaire `secondary` (`bg-fg text-bg`,
    contraste ≈ 17:1) + secondaire `outline`.
- Contrastes mesurés sur les jetons (rapport WCAG, calculé pour ce plan) :

  | Texte / fond                               | Rapport | Usage permis                         |
  | ------------------------------------------ | ------- | ------------------------------------ |
  | `mocha-fg` / `mocha` (`#f7f3ea`/`#2a2520`) | 13,70   | texte courant sur foncé (AAA)        |
  | `mocha-fg-muted` / `mocha`                 | 6,64    | légendes ≥ 18 px seulement (pas AAA) |
  | `terracotta-on-mocha` / `mocha`            | 5,82    | grands chiffres ≥ 24 px (AAA grand)  |
  | `mocha-fg` / `terracotta-deep` (`#8c3010`) | 7,45    | texte courant sur terracotta (AAA)   |
  | `mocha-fg` / `terracotta` (`#b23f16`)      | 5,24    | **titres ≥ 24 px seulement**         |
  | `terracotta` / `bg`                        | 5,47    | texte d'accent, liens (AA)           |
  | `terracotta-deep` / `terracotta-soft`      | 6,62    | pastilles « après »                  |
  | `fg` / `terracotta-soft`                   | 14,22   | texte dans les cartes « après »      |
  | `fg-muted` / `sand`                        | 6,59    | légendes sur crème                   |
  | `sage` / `sage-soft`                       | 4,63    | pastille développeur (AA juste)      |

  Conséquences : sur fond foncé, le texte courant est en `text-mocha-fg` (jamais
  `mocha-fg-muted`, qui n'atteint pas 7:1) ; le bandeau d'appel final est en
  `bg-terracotta-deep` (le terracotta plein `#b23f16` ne porte que des titres de grande taille).
  Le lot R2a ajoute un test qui vérifie ces paires en lisant `globals.css` (même méthode que
  `src/components/equipe/__tests__/contraste-categories.spec.ts`).

### 1.4 Performance (AGENTS.md)

- First Load JS ≤ 75 KB gz pour la route, CLS = 0, LCP ≤ 1 800 ms, INP ≤ 100 ms.
- Composants **serveur uniquement**. Aucun `"use client"` ajouté. Aucune bibliothèque ajoutée
  (ni animation, ni graphique, ni icônes autres que `lucide-react` déjà présent). Aucune
  modification de `package.json` ni de `pnpm-lock.yaml`.
- Schémas en SVG en ligne (petits, `aria-hidden="true"`) et en CSS (grilles, bordures,
  pseudo-éléments). Icônes `lucide-react` importées une par une (imports nommés, rendues côté
  serveur : coût JS nul).
- Animations : CSS seulement, uniquement `opacity` et `transform`, toujours sous
  `motion-safe:` (Tailwind) ; rien ne bouge avec `prefers-reduced-motion: reduce`. Aucune
  animation sur l'élément LCP (le H1 et la phrase-réponse du héros). Aucune animation déclenchée
  au défilement (cela demanderait du JS) : seulement des survols (`hover:`/`focus-visible:`).
- CLS = 0 : portrait dans un conteneur à ratio fixe (`aspect-square`, déjà le cas), polices déjà
  préchargées, aucune hauteur dépendant d'un chargement, `<details>` fermés par défaut.

### 1.5 Accessibilité

- Un seul H1 (le nom). H2 = sections, H3 = éléments (cartes, étapes, questions). Pas de saut.
- Chaque schéma SVG est décoratif (`aria-hidden="true"`, `focusable="false"`) : **tout le sens
  est porté par du HTML visible** (listes `ol`/`ul`, `dl`, `table`). Aucun texte n'existe
  seulement dans un SVG.
- Focus visible sur tous les liens et boutons (`focus-visible:outline-2 outline-offset-2`,
  `outline-terracotta` sur clair, `outline-mocha-fg` sur foncé).
- Cibles tactiles ≥ 44 × 44 px (boutons, `summary` de la FAQ).

## 2. La nouvelle structure, section par section (haut en bas)

Le gabarit est unique. Chaque section n'est rendue que si ses données existent (jamais de titre
vide). Le tableau ci-dessous donne l'ordre et le rythme des fonds ; le détail suit.

| #   | Section                           | Fond                 | Hn  | Williams | Collaborateur              |
| --- | --------------------------------- | -------------------- | --- | -------- | -------------------------- |
| 1   | Héros                             | `bg-mocha` (foncé)   | H1  | oui      | oui                        |
| 2   | Chiffres clés (rangée du héros)   | (dans le héros)      | —   | oui      | si ≥ 2 chiffres réels      |
| 3   | « En bref » (cartes à icônes)     | `bg-bg` ivoire       | H2  | oui      | oui                        |
| 4   | Pour quelles entreprises          | `bg-sand` crème      | H2  | oui      | modèle de catégorie        |
| 5   | Avant / après (schéma)            | `bg-bg` ivoire       | H2  | oui      | non (sauf texte fourni)    |
| 6   | Sans chamboulement (5 tuiles)     | `bg-mocha` (foncé)   | H2  | oui      | non                        |
| 7   | La méthode (frise 3 étapes)       | `bg-bg` ivoire       | H2  | oui      | non                        |
| 8   | La Journée IA (frise 5 temps)     | `bg-sand` crème      | H2  | oui      | non                        |
| 9   | Sections propres à la catégorie   | `bg-bg` / `bg-sand`  | H2  | non      | oui (registre F7)          |
| 10  | Services (cartes à icônes)        | `bg-bg` ivoire       | H2  | oui      | métiers si renseignés      |
| 11  | Parcours (frise chronologique)    | `bg-paper`           | H2  | oui      | si faits datés             |
| 12  | Constats de terrain (citations)   | `bg-mocha` (foncé)   | H2  | oui      | si citations validées      |
| 13  | FAQ (accordéon `details/summary`) | `bg-bg` ivoire       | H2  | oui      | oui (modèle + personne)    |
| 14  | Appel final                       | `bg-terracotta-deep` | H2  | oui      | oui (boutons de catégorie) |
| 15  | Pied de fiche : « Mis à jour le » | `bg-bg`              | —   | oui      | oui                        |

Rythme : foncé (héros + chiffres) → clair → crème → clair → **foncé** →
clair → crème → clair → papier → **foncé** → clair → **terracotta**. Jamais deux sections
foncées qui se touchent. `SectionFiche` pose `data-fond="clair|fonce|terracotta"` sur chaque
`<section>` ; le test d'enchaînement lit cet attribut, jamais les classes (`bg-mocha` attraperait
`bg-mocha-soft`).

**Fiche collaborateur réelle, aujourd'hui** (constat de la relecture : `ficheDepuisMembre` ne
remplit ni `parcours`, ni `publications`, ni `metiers`, ni `citations`, et aucune migration n'est
permise) : héros, en bref, sections de catégorie, pour qui (si le registre le déclare), FAQ, appel
final. C'est ce gabarit COURT qu'il faut soigner visuellement ; les autres sections restent
prêtes pour le jour où les données existeront.

### 2.0 Brique commune : `EnteteQuestion` (H2 en question + réponse directe)

Toute section de contenu (3 à 13) commence par la même brique, conçue pour l'extrait Google :

- **Sur-titre** (`p`, 12 px, `uppercase tracking-[0.14em] font-semibold`, couleur `terracotta` sur
  clair, `mocha-fg` sur foncé : `terracotta-on-mocha` ne vaut que 4,56 à 4,75:1 à 12 px) : un mot-clé court (« En bref », « Méthode »).
- **H2 formulé comme une vraie question de dirigeant** (« Comment Axion-IA transforme une PME
  sans tout chambouler ? »). Classes : `font-serif text-[clamp(1.75rem,3.2vw,2.5rem)]
leading-tight tracking-tight text-fg` (sur foncé `text-mocha-fg`), `max-w-3xl`.
- **Réponse directe de 40 à 60 mots** juste sous le H2, dans un `<p data-reponse-section="">`
  (volontairement **absent** de `DEFAULT_SPEAKABLE_SELECTORS` : seul le héros porte
  `data-answer` et `.speakable`, sinon le `speakable` couvrirait ~1 500 mots) : `text-lg sm:text-xl leading-relaxed
text-fg-soft` (sur foncé `text-mocha-fg`), `max-w-3xl mt-4`. Phrase définitionnelle autonome
  qui nomme l'entité (« Williams Jullin… », « Axion-IA… », « {prénom}… ») et reste vraie hors de
  la page (jamais « ici », « ci-dessous », « cette page »).
- Puis le visuel de la section (cartes, schéma, frise), avec `mt-10 lg:mt-14`.
- Props : `{ surTitre: string; question: string; reponse: string; id: string; ton?: "clair" |
"fonce" }`. Le `id` sert d'ancre (`<section id={id} aria-labelledby={id + "-titre"}>`).
- Un test vérifie que chaque `reponse` de Williams compte 40 à 60 mots (voir § 4, lot R2c).
- **Collaborateur** : pas de réponse de registre identique d'une fiche à l'autre (risque de pages
  satellites, cf. l'en-tête de `page.tsx`). Sous le premier H2 (« en bref »), la réponse est
  `fiche.reponseQui` si elle fait 25 à 80 mots ; ailleurs, les réponses du registre font
  30 mots au plus et ne citent aucun domaine que la personne n'a pas renseigné ; sinon H2 seul.
  La fourchette 40-60 ne s'applique qu'à Williams.

### 2.1 Héros (H1)

- **Rôle** : en 5 secondes, qui, pour qui, quel résultat ; deux boutons.
- **Rendu** : fond `bg-mocha` + halo terracotta (`HALO_TERRACOTTA`, § 1.3), texte `text-mocha-fg`.
  Grille `lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-12`, `py-14 sm:py-18 lg:py-24`.
  - Colonne texte : pastille de catégorie (`PastilleCategorie` posée telle quelle dans une
    capsule claire `rounded-full bg-bg px-3 py-1` : les couleurs de catégorie tombent sous 3:1 sur
    `bg-mocha`, mesuré) ; **H1** `display-editorial
text-mocha-fg` (nom de famille de Williams en `text-terracotta-on-mocha italic font-serif`,
    règle actuelle conservée) ; ligne de fonction `text-mocha-fg text-lg font-semibold` ;
    **phrase-réponse** (`p.speakable[data-answer][itemprop="text"]`, `text-xl sm:text-2xl
leading-snug text-mocha-fg`, `max-w-2xl`) ; **3 à 4 preuves en pastilles** : `ul` en
    `flex flex-wrap gap-2.5`, chaque `li` = `rounded-full border border-on-mocha bg-mocha-soft/60
px-3.5 py-1.5 text-sm text-mocha-fg` avec une icône lucide 16 px `text-terracotta-on-mocha` (champ
    `pastillesDetaillees`, § 3.1 ; à défaut `pastilles` avec l'icône `Check`) ;
    **2 boutons** (`ActionsFiche emplacement="hero"`) : primaire `Cta variant="terracotta"`,
    secondaire `outline` (pastille claire). `ActionsFiche` gagne une prop `fond?: "clair" |
"fonce" | "terracotta"` qui choisit les variantes et l'anneau de focus du § 1.3 ; aucun
    nouveau variant de `Button`.
  - Colonne photo : portrait carré (`PortraitCollaborateur`, `priority`, conteneur
    `aspect-square`, `rounded-[2rem]`), anneau décoratif SVG en ligne derrière (deux arcs
    `stroke` terracotta, opacité 0,5, `aria-hidden`). `figcaption` en `text-mocha-fg text-sm`.
    Bordure du portrait : `border-border-on-mocha` (au lieu de `border-border bg-paper`).
  - Rangée de chiffres clés (§ 2.2) sous les deux colonnes.
  - « Mis à jour le » : déplacé dans le héros, sous les boutons, `text-sm text-mocha-fg`
    (avec `<time dateTime>`).
- **Mobile** : une colonne, texte d'abord (la phrase-réponse reste l'élément LCP probable), photo
  en `max-w-56` centrée après les boutons ; boutons en pleine largeur (`w-full sm:w-auto`).
- **Contenu Williams** :
  - H1 : « Williams Jullin » ;
  - fonction : `WILLIAMS_FONCTION` (inchangée, = `Person.jobTitle`) ;
  - phrase-réponse : « Williams Jullin dirige Axion-IA, la startup française qui aide
    les dirigeants de TPE et de PME à gagner du temps et en rentabilité grâce à l'IA, avec l'équipe
    qu'ils ont déjà. L'équipe chiffre d'abord ce que chaque tâche coûte, puis installe tout, de
    A à Z, partout en France. » ;
  - pastilles (sans répéter les chiffres clés) : « TPE et PME, tous secteurs » (`Building2`),
    « Chiffrer, Essayer, Trancher » (`ListChecks`), « Données hébergées dans l'UE »
    (`ShieldCheck`) ;
  - boutons : « Réserver mon Diagnostic IA » (`/appel`), « Écrire à Axion-IA » (`/contact`).
- **Collaborateur** : pastille de sa catégorie (couleur de catégorie), H1 = prénom, phrase =
  `fiche.reponseQui`, pastilles = `contenu.pastilles` (compétences, 4 maximum), boutons du
  registre de catégorie.

### 2.2 Chiffres clés (dernière rangée du héros)

- **Rôle** : la preuve en un coup d'œil, en très gros.
- **Rendu** : **pas une section** (sinon deux fonds foncés se touchent) : `ul role="list"
aria-label="Chiffres clés"` posé en dernière rangée du héros, sous les deux colonnes,
  `mt-12 border-t border-on-mocha pt-10`. Valeurs en `text-terracotta-on-mocha` (5,82:1, grande
  taille), libellés en `text-mocha-fg`. `ul role="list"` en
  `grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-8`, séparateurs verticaux `lg:divide-x
lg:divide-border-on-mocha`. Chaque `li` : valeur en `font-serif text-[clamp(2.5rem,5vw,4rem)]
leading-none tracking-tight [font-feature-settings:'tnum']`, unité en `text-xl`, libellé en
  `text-base text-mocha-fg mt-2` (pas de muet : AAA). Petite icône lucide 20 px au-dessus,
  `aria-hidden`.
- **Mobile** : 2 × 2. Les valeurs longues (« France ») restent en une ligne grâce au `clamp`.
- **Contenu Williams** (faits vérifiés de `williams.ts`, rien d'autre) :
  - « 30+ » / « ans de direction d'entreprises » ;
  - « 2023 » / « l'IA appliquée à l'entreprise, à plein temps » ;
  - « France » / « partout, outre-mer compris » ;
  - « 45 min » / « de Diagnostic IA pour commencer ».
- **Collaborateur** : aujourd'hui, seul le nombre de langues est réellement rempli : le bloc
  n'apparaît donc pas (voulu). Règle prête pour plus tard, chiffres calculés UNIQUEMENT depuis
  des champs remplis, dans cet ordre :
  `fiche.parcours?.chezAxionDepuis` (« 2025 » / « dans l'équipe Axion-IA depuis ») ;
  `fiche.publications` si ≥ 1 (« 12 » / « articles signés ») ; nombre de langues si ≥ 2
  (« 3 » / « langues de travail ») ; nombre de métiers renseignés si ≥ 2. **Section masquée s'il
  y a moins de 2 chiffres.** Jamais de chiffre inventé, jamais de nombre de clients ou de
  collaborateurs.
- Remplace l'actuel bloc « Repères » (`contenu.faits`) : le champ `faits` est renommé en
  `chiffresCles` (voir § 3.1) ; `WILLIAMS_PREUVES` est remplacé par `WILLIAMS_CHIFFRES_CLES`
  (retrait effectif en R2d).

### 2.3 « En bref » : grille de petites cartes à icônes

- **Rôle** : la fiche d'identité, lisible par un humain en 10 secondes et par une IA en une
  passe.
- **H2** : « Qui est Williams Jullin, en bref ? » (collaborateur : « Qui est {prénom}, en
  bref ? »). Réponse directe : voir § 2.16.
- **Rendu** : la liste reste une **`<dl>`** (sémantique conservée pour l'extraction), mais en
  grille : `dl.grid gap-4 sm:grid-cols-2 lg:grid-cols-3`. Chaque paire est un
  `<div class="rounded-2xl border border-border bg-paper p-5 flex gap-4">` (un `div` qui
  enveloppe `dt` + `dd` est valide en HTML) : pastille d'icône 40 × 40 `rounded-xl
bg-terracotta-soft text-terracotta-deep` (couleur de catégorie pour un collaborateur, via
  `jetonsDe`), puis `dt` en `text-xs uppercase tracking-[0.12em] font-semibold text-fg-muted` et
  `dd` en `text-base font-semibold text-fg leading-snug`. Survol : `motion-safe:transition
hover:-translate-y-0.5 hover:shadow-sm`.
- Lien LinkedIn vérifiable : dernière carte de la grille, icône `ExternalLink` (la version de
  `lucide-react` du dépôt n'a plus d'icône `Linkedin` : vérifié), `rel` actuel conservé (`me`
  pour Williams), mention « (nouvel onglet) » en `sr-only` conservée.
- **Mobile** : une colonne, cartes compactes `p-4`.
- **Icônes** : chaque ligne d'identité porte une clé d'icône (`icone`, voir § 3.1). Table de
  correspondance dans `src/components/equipe/visuels/icones.ts` (imports nommés lucide) :
  `personne → UserRound`, `fonction → BriefcaseBusiness`, `entreprise → Building2`,
  `resultat → TrendingUp`, `cible → Users`, `services → Layers`, `zone → MapPin`,
  `experience → Award`, `methode → ListChecks`, `donnees → ShieldCheck`,
  `contact → CalendarClock`, `langues → Languages`, `competences → Sparkles`,
  `lieu → MapPin`. Clé absente ou inconnue : `Circle`.
- **Contenu Williams** : les 11 lignes de `WILLIAMS_IDENTITE`, mêmes informations, valeurs
  raccourcies pour tenir en carte (§ 2.16).

### 2.4 Pour quelles entreprises (le dirigeant se reconnaît)

- **H2** : « Pour quelles entreprises travaille l'équipe de Williams Jullin ? ».
- **Rendu** : fond `bg-sand`. Deux blocs côte à côte (`lg:grid-cols-[1fr_2fr] gap-10`) :
  - **Tailles** : trois grandes cartes empilées (`ul`), chacune `rounded-2xl bg-paper border p-5`
    avec un pictogramme SVG en ligne de 1 à 3 silhouettes (taille croissante), titre H3
    (`text-xl font-serif`) et une ligne : dans cet ordre (1, 2 puis 3 silhouettes) : « Dirigeant seul ou petite équipe », « TPE — moins
    de 10 salariés », « PME — de 10 à 249 salariés ».
  - **Secteurs** : `ul` de pastilles `rounded-full bg-paper border border-border-strong px-4 py-2
text-[15px] font-medium text-fg` avec icône lucide 16 px `text-terracotta` : BTP et artisanat
    (`HardHat`), Commerce et distribution (`Store`), Industrie (`Factory`), Transport et
    logistique (`Truck`), Santé et médico-social (`Stethoscope`), Cabinets comptables et
    juridiques (`Scale`), Immobilier (`House`), Hôtellerie et restauration (`UtensilsCrossed`),
    Services aux entreprises (`Handshake`), Associations et organismes (`HeartHandshake`).
    Une phrase sous la liste : « Et tous les autres secteurs : la méthode part de vos tâches, pas
    de votre code NAF. »
  - Lien interne : « Les formations par secteur » → `/formations/secteurs`.
- **Mobile** : tailles puis secteurs, pastilles en `flex-wrap`.
- **Collaborateur** : rendu seulement si le modèle de catégorie déclare `pourQui` (§ 3.3) ;
  sinon masqué. Apporteur : « Les entreprises que {prénom} peut présenter » (secteurs génériques,
  aucun montant).

### 2.5 Avant / après (schéma)

- **H2** : « Qu'est-ce qui change dans une PME après l'arrivée de l'IA ? ».
- **Rendu** : fond `bg-bg`. Un `<table>` sémantique (lisible par Google et les IA) habillé en
  schéma : `caption` visuellement masquée (`sr-only`) « Six situations avant et après l'IA »,
  `thead` avec deux `th scope="col"` : « Avant » et « Après ». À partir de `sm`, le tableau
  garde sa mise en page native : `table-fixed w-full border-separate border-spacing-x-12 -mx-12
border-spacing-y-3` (l'espacement horizontal laisse la place de la flèche). Chaque `td` est
  une carte :
  - cellule « avant » : `relative rounded-2xl bg-sand/70 border border-dashed
border-border-strong p-5 text-fg-soft`, icône `CircleAlert` 18 px `text-fg-muted` ;
  - flèche : **pseudo-élément CSS** de la cellule « avant » (aucune colonne en plus) :
    `sm:after:content-['→'] sm:after:absolute sm:after:-right-10 sm:after:top-1/2
sm:after:-translate-y-1/2 sm:after:text-3xl sm:after:text-terracotta` ; le contenu CSS
    `→` est lu par certains lecteurs d'écran : ajouter le texte alternatif vide
    (`content-['→'/'']`, syntaxe CSS supportée) ;
  - cellule « après » : `rounded-2xl bg-terracotta-soft border border-terracotta/30 p-5 text-fg
font-medium` avec icône `CircleCheck` 18 px `text-terracotta-deep`.
  - Survol de la rangée (`group` sur `tr`) : la cellule « après » passe à `bg-terracotta-deep
text-mocha-fg`, son icône à `group-hover:text-mocha-fg` (sinon elle disparaît)
    (`motion-safe:transition-colors`), contraste 7,45:1.
- Sous le tableau, la phrase de synthèse en grand : `text-2xl font-serif text-fg max-w-3xl`.
- **Mobile** (sous `sm`) : chaque rangée empilée (avant, flèche ↓ en pseudo-élément, après)
  avec `max-sm:block` sur `tr`/`td`. Changer le `display` d'un tableau peut lui faire perdre sa
  sémantique dans certains navigateurs : poser donc les rôles explicites (`role="table"`,
  `role="row"`, `role="columnheader"`, `role="cell"`). En-tête masqué visuellement sur mobile
  (`max-sm:sr-only`) ; chaque cellule porte un libellé visible « Avant » / « Après »
  (`span aria-hidden="true" class="sm:hidden"`, pour ne pas doubler la lecture).
- **Contenu Williams** : les 6 lignes actuelles, raccourcies à 12 mots maximum chacune (§ 2.16).

### 2.6 Une transformation sans chamboulement (bandeau foncé)

- **H2** : « Comment transformer son entreprise avec l'IA sans tout chambouler ? ».
- **Rendu** : fond `bg-mocha` + halo terracotta, texte `text-mocha-fg`. Cinq tuiles (fini la liste à coches) :
  `ul grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5`, chaque `li` = `rounded-2xl border
border-on-mocha bg-mocha-soft/50 p-6`, icône lucide 28 px `text-terracotta-on-mocha` en haut
  (`Wrench` outils, `Footprints` une étape à la fois, `Gavel` vous décidez, `Users` équipes
  embarquées, `Settings2` rien à piloter), **H3** court (`text-lg font-semibold text-mocha-fg`),
  texte d'une phrase (`text-base text-mocha-fg`, 20 mots maximum).
- **Mobile** : 1 colonne, puis 2 dès `sm`.

### 2.7 La méthode : Chiffrer, Essayer, Trancher (frise)

- **H2** : « Quelle méthode Axion-IA suit-elle pour mettre l'IA dans une PME ? ».
- **Rendu** : composant générique `FriseEtapes` (aussi utilisé en 2.8). `ol` sémantique ;
  ordinateur : `lg:grid lg:grid-cols-3 lg:gap-0`, une ligne de liaison horizontale derrière les
  numéros (pseudo-élément `lg:before:absolute lg:before:top-7 lg:before:inset-x-[16%]
lg:before:h-0.5 lg:before:bg-terracotta/40` sur l'`ol` en `relative`) ; chaque étape :
  disque numéroté 56 × 56 `rounded-full bg-terracotta text-mocha-fg font-serif text-2xl
ring-8 ring-bg` (le numéro est dans le HTML : `<span aria-hidden>` + l'ordre de l'`ol` porte
  le sens), **H3** (`text-2xl font-serif text-fg`), texte (`text-base text-fg-soft`, 25 mots
  maximum), puis une ligne « Ce que vous obtenez » en gras `text-terracotta-deep`.
  Mobile : frise **verticale** (`border-l-2 border-terracotta/40 pl-8`, disques à gauche).
- Une flèche finale (SVG en ligne) vers un encart « Ce qui rapporte est installé de A à Z ; le
  reste est abandonné. » (`rounded-2xl bg-terracotta-soft p-5 text-fg font-semibold`).

### 2.8 La Journée IA (frise de la journée)

- **H2** : « Comment se déroule la Journée IA d'Axion-IA ? ».
- **Rendu** : fond `bg-sand`, même `FriseEtapes`, 5 étapes, variante `horaire` : au-dessus de
  chaque disque, une étiquette de moment (`Matin`, `Après-midi`, `Ensuite`, `Engagement`,
  `Votre choix`) en `text-xs uppercase tracking-[0.14em] text-terracotta-deep font-semibold`.
  Grille : `sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5` (`lg` vaut 992 px dans ce thème :
  5 colonnes y seraient trop étroites pour des textes de 35 à 40 mots) ; mobile vertical.
- Sous la frise, une rangée de 3 « chiffres de la journée » (petits `Stat` sobres, `text-fg`) :
  « 2 à 4 h » / « de diagnostic dans vos locaux », « 4 h » / « de formation pratique », « 15 » /
  « participants au maximum ». (Faits déjà publiés dans le texte actuel.)
- Boutons : « Réserver mon Diagnostic IA de 45 minutes » (`/appel`) + lien « Tout savoir sur la
  Journée IA » (`/journee-ia`).
- La garantie reste injectée depuis `journee-ia-commun.ts` (étape « Le risque est pour nous »).

### 2.9 Sections propres à la catégorie (collaborateurs)

- Registre F7 conservé (`modeles-categorie.ts`). Rendu revu : `EnteteQuestion` (le titre du
  registre devient une question, § 3.3), compétences en pastilles à icône `Sparkles` couleur de
  catégorie, lien de section en bouton-lien. Plus de bordure gauche seule.

### 2.10 Services (cartes à icônes)

- **H2** : « Que fait l'équipe d'Axion-IA après la Journée IA ? ».
- **Rendu** : fond `bg-bg`. Grille `grid gap-5 sm:grid-cols-2 lg:grid-cols-3`. Le service
  « Transformation de l'entreprise » est la **carte mise en avant**, placée en premier :
  `lg:col-span-full`, fond `bg-mocha text-mocha-fg` + `HALO_TERRACOTTA`, H3 plus grand. Puis les
  4 autres cartes en `sm:grid-cols-2 lg:grid-cols-4` (aucune carte orpheline). Les
  autres : `rounded-2xl bg-paper border p-6 flex flex-col`, icône 44 × 44 `rounded-xl
bg-terracotta-soft text-terracotta-deep` (`Wrench` mise en place, `Workflow` automatisation,
  `GraduationCap` formation, `Compass` coaching, `Sparkles` transformation), **H3** (nom du
  service, `text-xl font-serif`), texte de 20 mots maximum, liens en bas (`mt-auto`), flèche
  qui glisse au survol (`motion-safe:group-hover:translate-x-1`).
- Collaborateur : cartes des métiers renseignés (si présents), sans texte inventé.

### 2.11 Parcours (frise chronologique)

- **H2** : « Quel est le parcours de Williams Jullin ? ».
- **Rendu** : fond `bg-paper`. `ol` vertical, ligne `border-l-2 border-terracotta/40`, chaque
  `li` : pastille de date (`<time>` quand c'est une année : `dateTime="2023"`), `font-serif
text-3xl text-terracotta`, **H3** (`text-lg font-semibold`), texte de 35 mots maximum.
  Ordinateur : frise **horizontale** `lg:grid lg:grid-cols-3` avec trait horizontal (même
  technique que 2.7) et la date au-dessus du trait.
- **Contenu Williams** (repères sans année inventée) : « Depuis plus de 30 ans » — direction
  d'entreprises ; « 2023 » — l'IA appliquée à l'entreprise, à plein temps ; « Aujourd'hui » —
  fondateur et dirigeant d'Axion-IA. Seule « 2023 » est une `<time>`.
- **Collaborateur** : `fiche.parcours.avant` (années fournies) + `chezAxionDepuis` ; section
  masquée sans fait daté.

### 2.12 Constats de terrain (bandeau foncé)

- **H2** : « Que constate Williams Jullin chez les dirigeants de PME ? ».
- **Rendu** : fond `bg-mocha` + halo terracotta. La première citation en grand (`text-[clamp(1.5rem,3vw,
2.25rem)] font-serif italic text-mocha-fg`, guillemet décoratif SVG terracotta de 64 px
  `aria-hidden`), les autres en grille `lg:grid-cols-2`, `blockquote` avec `border-l-4
border-terracotta-on-mocha`, texte `text-mocha-fg text-lg`. Attribution visible sous chaque
  citation (`<cite>` « Williams Jullin » / prénom).

### 2.13 FAQ

- **H2** : « Questions fréquentes sur Williams Jullin » (collaborateur : « … sur {prénom} »).
  Réponse directe de 40 à 60 mots sous le H2 (résumé : qui, pour qui, comment commencer).
- **Rendu** : `FaqAccordion` existant (`details/summary`, zéro JS), `emitJsonLd={false}` (le
  `FAQPage` reste dans le `@graph` unique), ancres activées (ancre = `id` de la question, ex. `#qui-est-williams-jullin`),
  questions en H3. Habillage : `details` en `rounded-2xl border bg-paper`, `summary` ≥ 44 px,
  icône `Plus` qui tourne de 45° à l'ouverture (`group-open:rotate-45`, sous `motion-safe:`).
  Composant `FaqFiche` (nécessaire : `FaqBlock` force `id="axion-faq"` et ne transmet pas
  `ancres`), créé en R2d à partir de la structure de `FaqAccordion`.
- Le texte HTML de chaque réponse est **identique au caractère près** à `acceptedAnswer.text`
  du JSON-LD (test existant à conserver / ajouter).
- **Fermé par défaut** : Google lit le contenu des `details` fermés ; ne rien rendre en
  `hidden` ni en `display:none` hors `details`.

### 2.14 Appel final (bandeau terracotta plein)

- **Rendu** : **pas** `CtaBlock` (son ton `terracotta` est `bg-terracotta`, 5,24:1 avec le
  texte ivoire : pas AAA ; son ton `mocha` porte le halo bleu). Composant local
  `BandeauAppel` : `bg-terracotta-deep text-mocha-fg py-16 sm:py-20`,
  motif SVG en ligne discret (arcs concentriques, `stroke-mocha-fg/10`, `aria-hidden`) en coin.
  **H2** (`font-serif text-[clamp(2rem,4vw,3rem)]`), texte `text-lg text-mocha-fg`,
  boutons : primaire `Cta variant="secondary"` (`bg-fg text-bg`), secondaire `variant="outline"`
  (§ 1.3). Une ligne de réassurance avec icônes (seulement si une action pointe vers `/appel` ; les
  fiches dont les boutons vont vers `/contact` n'en ont pas) : « 45 minutes », « Sans
  engagement », « En visio ou par téléphone ».
- **Williams** : H2 « Parlons de votre entreprise » ; texte (§ 2.16).

### 2.15 Pied de fiche

- « Mis à jour le {date} » visible (déjà dans le héros) + liens internes : « Toute l'équipe »
  (`/equipe`), « La Journée IA » (`/journee-ia`), « Les implémentations IA »
  (`/implementation`), « Les formations » (`/formations`). Rendu : `nav aria-label="Pour aller
plus loin"`, liens en pastilles.

### 2.16 Textes réécrits pour Williams (à placer dans `src/content/equipe/williams.ts`)

Ton : expert qui parle à un dirigeant, phrases courtes, aucun jargon, aucune promesse chiffrée.
Les réponses directes ci-dessous font toutes entre 40 et 60 mots (comptées pour ce plan ; un test le revérifie).

- **Titre SEO** (≤ 60 caractères) : « Williams Jullin, dirigeant d'Axion-IA · IA pour TPE et PME »
  (58 caractères). Garder `title: { absolute }`.
- **Meta description** (≤ 155 caractères) : « Williams Jullin dirige Axion-IA : l'équipe aide les
  TPE et PME à gagner du temps et en rentabilité grâce à l'IA, sans recruter, partout en France. »
- **En bref — réponse** : « Williams Jullin est le fondateur et dirigeant d'Axion-IA, une
  startup française spécialisée dans l'IA pour les TPE et les PME. Dirigeant d'entreprises
  depuis plus de trente ans et consacré à l'IA depuis 2023, il pilote une équipe qui chiffre,
  teste puis installe l'IA dans les outils existants, partout en France. »
- **En bref — cartes** : Nom : Williams Jullin · Fonction : `WILLIAMS_FONCTION` · Entreprise :
  Axion-IA, startup française · Résultat visé : plus de rentabilité et de temps, même équipe · Pour
  qui : dirigeants de TPE et PME · Ce que fait l'équipe : Journée IA, mise en place,
  automatisation, formation, coaching · Zone : partout en France, outre-mer compris ·
  Expérience : plus de 30 ans de direction · Méthode : Chiffrer, Essayer, Trancher · Données :
  hébergées dans l'Union européenne · Premier contact : Diagnostic IA de 45 minutes.
- **Pour qui — réponse** : « L'équipe de Williams Jullin travaille avec des TPE et des PME de
  tous secteurs, de l'artisan du bâtiment au cabinet comptable. Le point commun n'est pas le
  métier : c'est une équipe qui perd des heures en ressaisies, devis, relances et comptes
  rendus, et un dirigeant qui veut récupérer ce temps sans recruter. »
- **Avant / après — réponse** : « Après l'arrivée de l'IA, une PME fait les mêmes métiers avec
  moins de tâches répétitives. Les devis se préparent en quelques minutes, la donnée n'est
  saisie qu'une fois, les relances partent au bon moment et le dirigeant sait ce que son équipe
  peut absorber avant de recruter. Les outils et les clients ne changent pas. »
- **Avant / après — lignes** :
  1. Les devis refaits le soir, à la main. → Devis prêts en quelques minutes ; vous relisez.
  2. Les mêmes informations ressaisies trois fois. → Saisie une fois, partagée partout.
  3. Les relances, quand quelqu'un y pense. → Relances envoyées au bon moment.
  4. Des heures d'e-mails et de comptes rendus. → Brouillons prêts ; l'équipe ajuste.
  5. Recruter pour suivre la charge. → Savoir d'abord ce que l'équipe peut absorber.
  6. L'IA partout, sans savoir par où commencer. → Un plan chiffré, des premiers gains.
  - Synthèse : « Mêmes outils, même métier, mêmes clients. Moins de temps perdu. »
- **Sans chamboulement — réponse** : « Transformer une entreprise avec l'IA ne veut pas dire
  tout casser. Axion-IA branche l'IA sur les outils déjà en place, avance une tâche à la fois
  en commençant par la plus rentable, forme les équipes sur leurs propres dossiers et laisse le
  dirigeant décider à chaque étape. Il n'a rien de technique à piloter. »
- **Sans chamboulement — tuiles** : « Vos outils restent » — l'IA se branche sur ce que vous
  utilisez déjà. · « Une étape à la fois » — la suivante démarre si la précédente rapporte. ·
  « Vous décidez » — coût et gain connus avant chaque oui. · « Équipes embarquées » — formées
  sur leurs propres dossiers. · « Zéro technique pour vous » — l'équipe d'Axion-IA s'en occupe.
- **Méthode — réponse** : « Axion-IA suit une méthode en trois temps : Chiffrer, Essayer,
  Trancher. L'équipe mesure d'abord ce que chaque tâche coûte en heures et en euros, teste
  l'IA à petite échelle sur de vrais dossiers, puis le dirigeant décide : ce qui rapporte est
  installé de A à Z, le reste est abandonné. »
- **Méthode — étapes** : Chiffrer — « Ce que chaque tâche vous coûte, et ce que l'IA peut vous
  rendre. » / obtenu : « vos gains possibles, en euros ». Essayer — « Un test sur vos vrais
  dossiers, avec vos équipes, à petite échelle. » / obtenu : « la preuve sur votre terrain ».
  Trancher — « Vous gardez ce qui rapporte, vous arrêtez le reste. » / obtenu : « une
  installation de A à Z ».
- **Journée IA — réponse** : « La Journée IA d'Axion-IA se déroule en une journée dans
  l'entreprise. Le matin, l'équipe repère service par service les trois à cinq tâches qui
  coûtent le plus. L'après-midi, jusqu'à quinze personnes sont formées sur leurs propres
  dossiers. Le dirigeant reçoit ensuite un rapport chiffré, puis choisit librement la suite. »

- **Journée IA — étapes** : Matin — « Où part votre argent » (2 à 4 h, service par service, 3 à 5
  tâches retenues). Après-midi — « Vos équipes passent à l'action » (4 h, jusqu'à 15 personnes,
  un résultat utilisable le jour même, attestation ; mention de l'article 4 du règlement
  européen sur l'IA conservée). Ensuite — « Vos chiffres » (`RAPPORT_COMPLET`). Engagement —
  « Le risque est pour nous » (`GARANTIE_PHRASE` + `CONDITION_GARANTIE`). Votre choix —
  « Vous décidez de la suite » (plan seul ou mise en place ; journée jamais obligatoire).
- **Services — réponse** : « Après la Journée IA, l'équipe d'Axion-IA met en place ce qui a été
  décidé : solutions IA sur mesure dans vos outils, automatisation des tâches répétitives,
  formation des équipes et coaching du dirigeant. Chaque service peut aussi se prendre seul.
  Ensemble, ils transforment l'entreprise tâche après tâche, avec la même équipe. »
- **Services — textes courts** : Mise en place — « Devis plus rapides, réponses clients prêtes,
  un assistant qui connaît vos documents. Installés dans vos outils. » · Automatisation —
  « Ressaisies, relances et classements tournent seuls. Le temps repart vers vos clients. » ·
  Formation — « Vos équipes produisent plus dès les premiers jours, sur leurs propres
  dossiers. » · Coaching — « Quoi automatiser, quel budget, et ce qu'il ne faut surtout pas
  acheter. » · Transformation (carte mise en avant) — « Un plan d'ensemble, appliqué tâche après
  tâche : une entreprise qui travaille mieux avec la même équipe. » (La mention « vendus en une
  fois ou avec abonnement » est retirée : elle touche à la tarification.)
- **Parcours — réponse** : « Williams Jullin dirige des entreprises depuis plus de trente ans,
  en France et à l'international, à la tête de plusieurs entités et de grandes équipes. Depuis
  2023, il se consacre entièrement à l'intelligence artificielle appliquée à l'entreprise. Il a
  fondé Axion-IA pour offrir aux TPE et PME une équipe qui chiffre, teste et installe l'IA. »

- **Constats — réponse** : « Williams Jullin constate que l'argent d'une PME se perd rarement
  dans les grandes décisions : il se perd dans les ressaisies, les relances et les devis refaits
  à la main. Pour lui, un dirigeant ne veut pas de l'IA ; il veut vendre plus sans recruter, et
  l'IA n'est qu'un moyen d'y arriver. » ; citations actuelles conservées.
- **FAQ — réponse sous le H2** : « Williams Jullin dirige Axion-IA, startup française qui aide
  les TPE et PME à gagner en rentabilité grâce à l'IA. Le premier pas est un Diagnostic IA de
  45 minutes, sans engagement, en visio ou par téléphone. Les questions les plus posées portent
  sur la méthode, la Journée IA, les équipes et la mise en place. »
- **FAQ — cohérence avec les H2** : deux réponses différentes à la même question sur une page
  se contredisent pour un moteur génératif. Règle : une question posée en H2 de section ne
  figure pas dans la FAQ, **sauf** si la réponse FAQ est la réponse de section au caractère
  près. Application : « Qui est Williams Jullin ? » reste dans la FAQ avec, pour réponse, la
  réponse « En bref » ; « Transformer son entreprise avec l'IA, est-ce que ça bouleverse
  tout ? » sort de la FAQ (couverte par le H2 « sans chamboulement ») ; « Qui s'occupe de la
  mise en place après la Journée IA ? » garde sa réponse actuelle, et le H2 des services est
  formulé autrement (« Que fait l'équipe d'Axion-IA après la Journée IA ? » : question
  différente, réponse différente, pas de contradiction).
- **FAQ — ajouts** (en plus des 8 actuelles, mêmes règles ; financement toujours derrière les
  drapeaux) :
  - « Combien de temps faut-il pour voir les premiers effets de l'IA dans une PME ? » —
    « Les premiers effets se voient dès la Journée IA : l'après-midi, chaque participant produit
    un résultat utilisable sur ses propres dossiers. Les gains plus larges dépendent des tâches
    retenues ; ils sont chiffrés avant tout achat, puis vérifiés à petite échelle avant d'être
    étendus. »
  - « Axion-IA intervient-elle dans toute la France ? » — « Oui. L'équipe d'Axion-IA intervient
    partout en France, outre-mer compris : la Journée IA se déroule dans vos locaux, le
    Diagnostic IA de 45 minutes se fait en visio ou par téléphone. »
  - « Où sont hébergées les données de mon entreprise ? » — « Dans l'Union européenne. Les
    données de votre entreprise ne servent qu'au projet qui les concerne, et le RGPD s'applique
    à chaque mission. »
- **Appel final** : H2 « Parlons de votre entreprise » ; texte « En 45 minutes, vous savez où
  votre entreprise perd du temps et de l'argent, et ce que l'équipe d'Axion-IA peut prendre en
  charge. Sans engagement, en visio ou par téléphone. »

### 2.17 Textes modèles par catégorie (registre `modeles-categorie.ts`)

Même registre, mêmes règles ; `{prenom}` = prénom seul. Chaque catégorie reçoit : une question
H2 par section, une réponse directe de 40 à 60 mots avec `{prenom}`, et un `pourQui` facultatif.

Les questions utilisent des tournures neutres (sans « il » ni « elle ») : l'accord de la
personne n'est pas connu du registre.

- **Spécialiste IA** (prune) — H2 « Quelles formations anime {prenom} ? ». Réponse : « {prenom} est spécialiste IA dans l'équipe Axion-IA. {prenom} forme et accompagne
  des équipes d'entreprise à l'usage concret de l'IA dans leur métier : rédaction, devis,
  relation client, organisation. Le contenu se construit à partir de l'activité réelle de
  l'entreprise, après un premier échange avec l'équipe d'Axion-IA. ».
  Compétences : « Quels métiers et secteurs connaît {prenom} ? ».
- **Développeur** (sauge) — « Que construit {prenom} pour les entreprises ? » ; « Avec quelles
  technologies travaille {prenom} ? » ; « Comment les données sont-elles protégées pendant un
  projet ? » (lien `/rgpd`). Réponses neutres, aucune promesse de délai.
- **Apporteur d'affaires** (ocre) — « Quel est le rôle de {prenom} auprès des entreprises ? » Réponse : mise en relation avec
  l'équipe d'Axion-IA, présentation de la Journée IA, la suite est assurée par l'équipe.
  **Aucun montant, aucune commission, aucun mot sur la rémunération.** Pas de bandeau de
  chiffres sauf faits de la fiche.
- **Partenaire** (mocha) — « Que propose {prenom} avec Axion-IA ? » ; « Comment travailler avec
  {prenom} et l'équipe d'Axion-IA ? ».
- **Direction** (terracotta, hors Williams) — registre vide aujourd'hui ; le gabarit rend
  seulement héros, en bref, FAQ et appel final.

## 3. Données et SEO / GEO

### 3.1 Évolution de `ContenuFiche` (`src/lib/equipe/contenu.ts`) — additive, optionnelle

```ts
export type CleIcone =
  | "personne" | "fonction" | "entreprise" | "resultat" | "cible" | "services" | "zone"
  | "experience" | "methode" | "donnees" | "contact" | "langues" | "competences" | "lieu";

export interface ReponseDirecte {
  surTitre: string;
  question: string; // H2
  reponse: string; // 40 à 60 mots
}

export interface ChiffreCle {
  valeur: string; // « 30+ », « 2023 », « 45 min »
  libelle: string;
  icone?: CleIcone;
}

// Nouveaux champs (tous optionnels) :
chiffresCles?: ReadonlyArray<ChiffreCle>;            // remplace `faits` (garder `faits` en alias
                                                     // déprécié le temps d'une PR, puis retirer)
identite: ReadonlyArray<{ terme: string; valeur: string; icone?: CleIcone }>;
entetes?: Partial<Record<IdSection, ReponseDirecte>>; // une par section rendue
pourQui?: {
  tailles: ReadonlyArray<{ titre: string; texte: string; silhouettes: 1 | 2 | 3 }>;
  secteurs: ReadonlyArray<{ libelle: string; icone: string }>;
  phrase?: string;
  lien?: LienFiche;
};
methode?: { titre: string; etapes: ReadonlyArray<{ numero: string; titre: string;
  texte: string; obtenu?: string }>; conclusion?: string };
porteEntree?: { /* + */ moments?: ReadonlyArray<string>; chiffres?: ReadonlyArray<ChiffreCle> };
parcours?: { titre: string; blocs: ReadonlyArray<PointTitre & { repere?: string;
  annee?: number }> };
services?: { /* items + */ icone?: string; enAvant?: boolean };
pastillesDetaillees?: ReadonlyArray<{ libelle: string; icone?: CleIcone }>;
rassurance?: { /* points + */ icone?: string };
liensInternes?: ReadonlyArray<LienFiche>;
```

`IdSection` = `"en-bref" | "pour-qui" | "avant-apres" | "rassurance" | "methode" |
"journee-ia" | "services" | "parcours" | "constats" | "faq"`. Les composants restent typés par
**leurs propres interfaces de props** (§ 4) : ce typage structurel permet aux lots de tourner
en parallèle.

### 3.2 JSON-LD (`src/lib/seo/collaborateur-jsonld.ts`)

Un seul `<script type="application/ld+json">` `@graph` (déjà le cas), contenant :

- **Person** : pour Williams, délégué à `williams-person.ts` (**`@id` et `sameAs` intouchés**) ;
  pour un collaborateur, `@id` existant (`idPersonne(slug)`), `name` = prénom, `jobTitle`,
  `worksFor: { "@id": SITE_URL + "/#organization" }`, `knowsAbout` = compétences (si
  présentes), `image` (si photo consentie), `workLocation` (existant, inchangé).
- **ProfilePage** : `@id` `…#profilepage`, `mainEntity`/`about` = Person, `dateCreated` (si
  connue), `dateModified` = `contenu.dateMiseAJour`, `breadcrumb`, `speakable` (sélecteurs par
  défaut : seul le héros porte `data-answer`, cf. § 2.0), `primaryImageOfPage`, **nouveau** : `significantLink`
  = liens internes du pied de fiche (Journée IA, implémentations, formations, hub équipe).
- **Organization** : jamais redéfinie ; référencée par `@id` uniquement.
- **FAQPage** : `@id` `…#faq`, `mainEntity` = mêmes questions et réponses que le HTML,
  `isPartOf` la ProfilePage, émis seulement si la fiche est indexable (règle existante).
- **BreadcrumbList** : Accueil › Équipe › Nom (existant).
- **Ne pas** ajouter `HowTo` (déprécié par Google pour les résultats enrichis) ni `Review` /
  `AggregateRating` (aucune donnée réelle).
- **Ajout possible et utile** : `ItemList` pour la méthode (3 étapes) — **non retenu** : pas
  de résultat enrichi associé ; le `ol` HTML suffit aux moteurs génératifs.

### 3.3 Registre de catégorie (`modeles-categorie.ts`)

`SectionModele` gagne `surTitre?`, `question?` (le H2 en question) et `reponse?` (30 mots au plus, avec
`{prenom}`, sans domaine que la personne n'a pas renseigné ; cf. § 2.0) ; `ModeleCategorie` gagne `pourQui?` et `chiffresAutorises?` (liste des
chiffres calculables pour la catégorie). Les textes de § 2.17 y sont placés.

### 3.4 Métadonnées (`page.tsx`)

- `title` absolu pour Williams (§ 2.16) ; collaborateur : « {prénom}, {fonction} · Axion-IA »
  (≤ 60 caractères, tronquer la fonction si besoin).
- Meta description ≤ 155 caractères, qui reprend la réponse du héros.
- Image de partage : inchangée (`/api/og/equipe-williams` pour Williams).
- `robots` : règle d'indexabilité existante, inchangée.

### 3.5 Points de contrôle GEO (relus par la lecture Opus)

- Un seul H1 ; chaque H2 est une question réelle ; chaque réponse directe tient seule.
- Entités nommées dans les réponses : Williams Jullin, Axion-IA, Journée IA, Diagnostic IA,
  TPE, PME, France, Union européenne, règlement européen sur l'IA.
- Date visible « Mis à jour le » + `dateModified` identiques (`WILLIAMS_REVISION_DATE`, à
  avancer à la date réelle de mise en ligne de la refonte, une seule fois).
- Listes et tableaux sémantiques (`dl`, `ol`, `ul`, `table`) ; aucun texte dans un SVG.
- Liens internes : `/journee-ia`, `/implementation`, `/implementation/processus`,
  `/formations`, `/formations/secteurs`, `/un-a-un`, `/equipe`, `/appel`, `/contact`.
  Chaque `href` doit exister dans `src/i18n/routing.ts` (test déjà présent pour les services ;
  l'étendre à tous les liens de la fiche).
- `alt` du portrait : « Portrait de Williams Jullin, fondateur et dirigeant d'Axion-IA » ;
  collaborateur : `photo.alt` existant, sinon « Portrait de {prénom}, {fonction} chez
  Axion-IA ».

## 4. Lots d'exécution

Six lots. R2a, R2b1, R2b2, R2c1 et R2c2 touchent des fichiers **disjoints** et tournent en
parallèle. R2d assemble et passe après les cinq. Durée cible : 45 minutes maximum par lot.
Chaque lot : PR en brouillon, corps de PR dans `.pr/<branche>.md`, commit en français.

**Règle de typage qui rend le parallèle possible** : aucun composant de R2a, R2b1 ou R2b2
n'importe `ContenuFiche`. Chacun déclare sa propre interface de props, nouveaux champs en
optionnel (ex. `{ titre: string; etapes: ReadonlyArray<{ numero: string; titre: string; texte:
string; obtenu?: string }>; conclusion?: string }`). Les données actuelles de `ContenuFiche`
sont compatibles avec ces interfaces (typage structurel) : `ProfilCollaborateur` compile avant
et après R2c. R2d branche les nouveaux champs.

**Vérifications communes à chaque lot** (dans cet ordre) :

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm vitest run <fichiers de test du lot>
grep -rnE "Grenoble|freelance|Aucun gain garanti|text-primary|bg-primary|halo-cool|accent-purple|mocha-rich" \
  src/components/equipe src/content/equipe src/lib/equipe   # doit ne rien rendre
grep -rn '"use client"' src/components/equipe                 # ne doit lister que questionnaire/
```

Le crochet de pré-commit lance un typecheck complet : s'il manque de mémoire, relancer le commit
avec `NODE_OPTIONS=--max-old-space-size=8192`.

**Règles communes des tests de contenu** (pour ne pas écrire de tests qui échouent d'office) :

- les recherches de mots interdits lisent le TEXTE rendu (`container.textContent` ou le
  `renderToStaticMarkup` débarrassé des balises et attributs), jamais le HTML brut : les
  attributs contiennent des `%` légitimes (`HALO_TERRACOTTA`, `inset-x-[16%]`) ;
- les phrases contractuelles de la Journée IA (`GARANTIE_PHRASE`, `CONDITION_GARANTIE`,
  `RAPPORT_COMPLET`) sont retirées du texte avant la recherche de « prix » : la phrase de
  garantie existante mentionne le prix de la journée ; elle est conservée telle quelle (texte
  contractuel injecté, jamais retapé). Point à faire confirmer par le dirigeant du site.
- les mots courts se cherchent en mot entier : « ici » par
  `/(^|[\s,;:.«»'’])ici([\s,;:.!?»]|$)/i` (sinon « artificielle » le contient).

### 4.1 Lot R2a — briques visuelles, héros, chiffres, en bref, appel final

- **Branche** : `feat/equipe-r2a-briques-heros`.
- **Fichiers à créer** :
  - `src/components/equipe/visuels/icones.ts` : `ICONES_FICHE: Record<CleIcone, LucideIcon>` et
    `iconeDe(cle?: string): LucideIcon` (repli `Circle`) ; `FOND_ICONE` (table fixe des fonds
    clairs par jeton de catégorie : `{ terracotta: "terracotta-soft", ochre: "ochre-soft",
sage: "sage-soft", plum: "plum-soft", mocha: "sand" }`, appliquée en `style` avec
    `varCss`, jamais en classe construite). R2a déclare l'union `CleIcone` localement ; R2c1 la
    déclare dans `contenu.ts` ; R2d supprime le doublon.
  - `src/components/equipe/visuels/SectionFiche.tsx` : `<section id aria-labelledby
data-fond>` + `Container` + fond (`ton: "ivoire" | "creme" | "papier" | "fonce" |
"terracotta"` → `bg-bg` / `bg-sand` / `bg-paper` / `bg-mocha text-mocha-fg` +
    `HALO_TERRACOTTA` / `bg-terracotta-deep text-mocha-fg`), espacement `py-16 sm:py-20
lg:py-24`, `EnteteQuestion` facultative. Exporte `HALO_TERRACOTTA`.
  - `src/components/equipe/visuels/EnteteQuestion.tsx` (§ 2.0). Props : `{ id: string;
surTitre: string; question: string; reponse?: string; ton?: "clair" | "fonce" }`. Réponse
    en `p[data-reponse-section]` (pas `data-answer`).
  - `src/components/equipe/visuels/ChiffresCles.tsx` (§ 2.2, rangée du héros). Props :
    `{ chiffres: ReadonlyArray<{ valeur: string; libelle: string; icone?: string }> }`. Ne rend
    rien si `chiffres.length < 2`.
  - `src/components/equipe/visuels/GrilleEnBref.tsx` (§ 2.3). Props : `{ lignes:
ReadonlyArray<{ terme: string; valeur: string; icone?: string }>; jeton: string; lien?: {
href: string; libelle: string; rel: string } }`.
  - `src/components/equipe/visuels/BandeauAppel.tsx` (§ 2.14). Props : `{ titre: string;
texte: string; reassurance?: ReadonlyArray<string>; children: ReactNode }`.
  - `src/components/equipe/__tests__/r2a-briques.spec.tsx`.
  - `src/components/equipe/__tests__/contraste-gabarit.spec.ts` : paires du § 1.3 + `plum` /
    `plum-soft` (5,55), `ochre-deep` / `ochre-soft` (6,04), `sage` / `sage-soft` (4,63),
    `mocha` / `sand` (12,55), lues dans `globals.css` comme
    `contraste-categories.spec.ts`. Seuils : 7 pour le texte courant sur foncé, 4,5 sinon,
    3 pour les grands chiffres et les éléments graphiques.
- **Fichiers à modifier** : `HeroCollaborateur.tsx` (§ 2.1 et 2.2 : fond foncé, capsule claire
  de catégorie, pastilles à icônes, rangée de chiffres, date ; prop nouvelle facultative
  `chiffres?` et `pastillesDetaillees?`), `ActionsFiche.tsx` (prop `fond?: "clair" | "fonce" |
"terracotta"`, défaut `"clair"` : variantes et anneau de focus du § 1.3).
  `PastilleCategorie.tsx` **n'est pas modifié** (capsule posée par le héros).
- **Tests** (`r2a-briques.spec.tsx`, `renderToStaticMarkup` comme `briques.spec.tsx`) :
  - `EnteteQuestion` rend un seul `h2` relié par `aria-labelledby`, la réponse en
    `data-reponse-section`, aucun `data-answer` ;
  - `ChiffresCles` ne rend rien avec 0 ou 1 chiffre ;
  - `GrilleEnBref` rend un `dl` avec autant de `dt`/`dd` que de lignes ; icône inconnue →
    repli ;
  - le héros : un seul `h1`, `data-answer` et `.speakable` sur la phrase, portrait avec
    `priority`, aucune classe bleue ni `mocha-rich` ;
  - chaque `Cta` rendu porte `focus-visible:ring-terracotta` ou `focus-visible:ring-mocha-fg` ;
  - mettre à jour (pas supprimer) les attentes touchées dans `briques.spec.tsx` et
    `profil-williams.spec.tsx`.

### 4.2 Lot R2b1 — frises (méthode, Journée IA, parcours)

- **Branche** : `feat/equipe-r2b1-frises`.
- **Fichiers à créer** : `src/components/equipe/visuels/FriseEtapes.tsx` (§ 2.7 et 2.8 ;
  props `{ etapes: ReadonlyArray<{ numero: string; titre: string; texte: string; moment?:
string; obtenu?: string }>; conclusion?: string; ton?: "ivoire" | "creme" }` ; anneau des
  disques selon le fond : `ring-bg` ou `ring-sand` ; tables fixes de classes :
  `GRILLE = { 3: "lg:grid-cols-3", 5: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" }` et
  `TRAIT = { 3: "lg:before:inset-x-[16%]", 5: "xl:before:inset-x-[10%]" }`, jamais de classe
  construite par concaténation), `src/components/equipe/visuels/FriseParcours.tsx` (§ 2.11),
  `src/components/equipe/__tests__/r2b1-frises.spec.tsx`.
- **Fichiers à modifier** : `MethodeCollaborateur.tsx`, `ParcoursSection.tsx` (utilisent les
  frises ; gardent leur `<Section>` actuelle jusqu'à R2d ; props déclarées localement).
- **Tests** : `ol` de n `li`, un `h3` par étape, classes de grille attendues pour 3 et 5 ;
  tout `svg` en `aria-hidden="true"` ; `<time dateTime="2023">` seulement si `annee` est fourni ;
  toute classe `transition`/`animate-` des éléments du lot est préfixée `motion-safe:`.

### 4.3 Lot R2b2 — avant/après, sans chamboulement, Journée IA, services, pour qui, citations

- **Branche** : `feat/equipe-r2b2-schemas`.
- **Fichiers à créer** : `src/components/equipe/visuels/PourQuiEntreprises.tsx` (§ 2.4 ;
  table locale `ICONES_SECTEURS`), `src/components/equipe/visuels/Silhouettes.tsx` (SVG en
  ligne, 1 à 3 silhouettes, `aria-hidden`, `focusable="false"`, `fill="currentColor"`),
  `src/components/equipe/__tests__/r2b2-schemas.spec.tsx`.
- **Fichiers à modifier** : `BlocsTransformation.tsx` (`AvantApres` § 2.5, `Rassurance` § 2.6,
  `PorteEntree` § 2.8 : il **importe `FriseEtapes` seulement après fusion de R2b1** ; s'il
  tourne en parallèle, il rend ses étapes en `ol` simple et R2d le bascule ; son `Cta` reçoit
  `className="focus-visible:ring-terracotta"`), `MetiersCollaborateur.tsx` (§ 2.10),
  `CitationsTerrain.tsx` (§ 2.12).
- **Tests** : `AvantApres` rend un `table` avec `caption`, deux `th scope="col"`, une `tr` par
  ligne, rôles ARIA explicites, textes dans le HTML ; `PorteEntree` contient `GARANTIE_PHRASE`
  importée ; services : la carte mise en avant est la première ; aucune classe bleue ni
  `mocha-rich` ; animations du lot sous `motion-safe:` (le `Cta`, déjà neutralisé par la règle
  `prefers-reduced-motion` de `globals.css`, et le contenu des `details` sont exclus de ce
  test : filtrer les éléments portant `data-cta`).

### 4.4 Lot R2c1 — textes de Williams et types

- **Branche** : `feat/equipe-r2c1-textes-williams`.
- **Fichiers à modifier** :
  - `src/lib/equipe/contenu.ts` : champs du § 3.1 (optionnels ; `faits` gardé en alias
    déprécié jusqu'à R2d).
  - `src/content/equipe/williams.ts` : textes du § 2.16. `WILLIAMS_LEAD` devient la phrase du
    héros (§ 2.1) et `WILLIAMS_DESCRIPTION_PERSON` est réécrite dans la même PR (même sens, à
    la 3e personne, sans « nous ») : `equipe-williams.spec.ts` exige leur cohérence avec le
    `ProfilePage`. Nouvelles constantes `WILLIAMS_CHIFFRES_CLES`, `WILLIAMS_ENTETES`,
    `WILLIAMS_POUR_QUI`, `WILLIAMS_LIENS_INTERNES`, `WILLIAMS_PASTILLES_DETAILLEES`.
    `WILLIAMS_PREUVES` **gardée** jusqu'à R2d (importée par
    `src/app/textes-publics-positionnement.spec.ts`). Ne pas toucher `WILLIAMS_FONCTION`,
    `NATURE_AXION_IA`, `WILLIAMS_REVISION_DATE`, ni les imports de `journee-ia-commun.ts`.
    Retirer la phrase « vendus en une fois ou en mise en service avec abonnement ».
  - `src/lib/equipe/adaptateurs.ts` (là où vit `ficheDepuisWilliams`, et où se pose l'`alt`
    du portrait) : passer les nouveaux champs ; `alt` du § 3.5.
- **Tests à étendre** : `src/content/__tests__/equipe-williams-textes.spec.ts` (nouveau
  titre, nombre de questions FAQ, 40-60 mots par réponse de `WILLIAMS_ENTETES`, H2 finissant
  par « ? », titre ≤ 60 caractères, meta ≤ 155, règles communes de recherche des mots
  interdits) ; `src/content/__tests__/equipe-williams.spec.ts` ;
  `src/app/textes-publics-positionnement.spec.ts` si une attente change.

### 4.5 Lot R2c2 — registre de catégorie, fiche collaborateur, JSON-LD, métadonnées

- **Branche** : `feat/equipe-r2c2-registre-seo`. Dépend de `contenu.ts` (R2c1) : si R2c1 n'est
  pas fusionné, R2c2 déclare ses nouveaux champs en type local dans `depuis-membre.ts` et R2d
  les rapatrie.
- **Fichiers à modifier** :
  - `src/lib/equipe/modeles-categorie.ts` : § 3.3 et textes du § 2.17 ;
  - `src/lib/equipe/depuis-membre.ts` : `icone` sur les lignes d'identité, `entetes` et
    `pourQui` depuis le registre, chiffres clés seulement depuis des champs réellement remplis
    (aujourd'hui : nombre de langues ≥ 2 ; donc le bloc n'apparaît pas, ce qui est voulu) ;
  - `src/lib/seo/collaborateur-jsonld.ts` : pour Williams,
    `{ ...buildProfilePageWilliamsJsonLd(), significantLink: [...] }` (sans modifier
    `williams-person.ts`) ; FAQ : `{ ...buildFaqJsonLd(...), "@id": url + "#faq", isPartOf: {
"@id": url + "#profilepage" } }` ; collaborateur : `knowsAbout` = compétences ;
  - `src/app/[locale]/equipe/[slug]/page.tsx` : seulement `generateMetadata` (titre
    collaborateur, § 3.4).
- **Tests** : `src/lib/equipe/__tests__/depuis-membre.spec.ts` (aucun chiffre sans donnée ;
  apporteur : ni « commission », ni « rémunér », ni « € », ni « % » dans le TEXTE ; prénom
  seul : nom de famille du jeu de test absent du JSON sérialisé) ;
  `src/lib/seo/__tests__/collaborateur-jsonld.spec.ts` (créer si absent : `@id` et `sameAs`
  de Williams strictement égaux à ceux de `williams-person.ts`, un seul `FAQPage`, ses textes =
  la FAQ du contenu, `Organization` jamais redéfinie) ; `categories.test.ts` (réponses du
  registre ≤ 30 mots après remplacement de `{prenom}` par « Camille »).

### 4.6 Lot R2d — assemblage, FAQ, pied de fiche, sitemap, mesure

- **Branche** : `feat/equipe-r2d-assemblage`, créée **après fusion des cinq lots**.
- **Fichiers à modifier** : `ProfilCollaborateur.tsx` (ordre et fonds du § 2, chaque section
  dans `SectionFiche` avec son `EnteteQuestion` depuis `contenu.entetes`), `SectionsCategorie.tsx`
  (§ 2.9), `BlocsTransformation.tsx` (bascule de `PorteEntree` sur `FriseEtapes` si R2b2 ne l'a
  pas fait), `FicheIdentite.tsx` (supprimé si `git grep FicheIdentite` ne montre plus d'usage,
  sinon laissé), `visuels/icones.ts` (doublon `CleIcone` retiré), `src/lib/equipe/contenu.ts`
  (retrait de `faits`), `src/content/equipe/williams.ts` (retrait de `WILLIAMS_PREUVES` et de
  ses imports de test ; `WILLIAMS_REVISION_DATE` avancée à la date de fusion), `sitemap.ts`
  (`lastModified: WILLIAMS_REVISION_DATE` pour `/fr/equipe/williams`, au lieu de `now`).
- **Fichiers à créer** : `src/components/equipe/FaqFiche.tsx` (nécessaire : `FaqBlock` force
  `id="axion-faq"` et ne transmet pas `ancres`) — structure reprise de `FaqAccordion`, garde
  `data-faq-q` / `data-faq-a` (lus par le `speakable` du `FAQPage`), **pas** de `data-answer` ;
  ancre = `id` de la question (`#qui-est-williams-jullin`) ; `src/components/equipe/PiedFiche.tsx`
  (§ 2.15) ; `src/components/equipe/__tests__/r2d-gabarit.spec.tsx`.
- **Tests** (`r2d-gabarit.spec.tsx`, rendu complet pour Williams et pour une fiche de chaque
  catégorie) : un seul `h1` ; aucun `h3` avant le premier `h2` ; aucun `h2` vide ; ordre des
  `id` conforme au § 2 ; deux `data-fond` foncés (`fonce`/`terracotta`) jamais consécutifs ;
  chaque question FAQ visible a sa réponse identique dans le `FAQPage` ; aucune question de
  H2 de section n'est reprise dans la FAQ ; texte des `svg` vide ; apporteur : ni
  « commission », ni « € », ni « % » dans le texte ; nom de famille absent ; aucune classe
  bleue ni `mocha-rich` ; aucun `"use client"` hors `questionnaire/`.
- **Mesures** (chiffres réels dans le corps de PR) :
  1. First Load JS de la route, avant (`origin/main`) et après :
     `SKIP_ENV_VALIDATION=true BULLMQ_DISABLED=true
DATABASE_URL=postgresql://stub:stub@stub.invalid:5432/stub
REDIS_URL=redis://stub.invalid:6379 pnpm exec next build --webpack
--experimental-build-mode compile`, puis lire les fichiers de `entryJSFiles` dans
     `.next/server/app/[locale]/equipe/[slug]/page_client-reference-manifest.js` et sommer
     leur taille gz (`gzip -c f | wc -c`). Écart attendu ≈ 0 (aucun JS client ajouté).
     Plafond 75 KB gz. (`app-build-manifest.json` n'existe plus dans cette version de Next.)
  2. `pnpm bundle:check` vert.
  3. CLS / LCP / INP : ne pas conclure sur une passe locale (AGENTS.md) ; noter
     `/fr/equipe/williams` comme URL à suivre au `lhci` post-déploiement.
  4. Vérification visuelle en 390 px et 1 440 px (compétence « run » si disponible), décrite
     dans le corps de PR.

### 4.7 Ordre de fusion

1. F7 (`feat/equipe-f7-sections`) si elle n'est pas encore fusionnée.
2. R2a, R2b1, R2b2, R2c1, R2c2 en parallèle, dans n'importe quel ordre. Préférer R2b1 avant
   R2b2 et R2c1 avant R2c2 quand c'est possible (moins de doublons à résorber en R2d).
3. R2d, après les cinq.
4. Mise en ligne au créneau suivant ; contrôle : `curl -sI https://axion-ia.com/fr/equipe/williams`
   (`x-axion-build-sha`), test des résultats enrichis de Google sur l'URL, lecture du `lhci`
   post-déploiement.

## 5. Hors périmètre

- Le hub `/fr/equipe` (même grammaire visuelle à appliquer dans un lot R3 si validé).
- L'en-tête et le pied de page du site.
- Toute migration, tout job, tout enum, toute nouvelle dépendance.
- La fiche persona éditoriale (branche `auteur` de la route) : inchangée.

## 6. Seconde lecture Opus (intégrée)

Une seconde lecture indépendante (sous-agent Opus, lentille « manque-t-il quelque chose pour une
page parfaite visuellement, SEO et GEO, dans les budgets ? ») a relu ce plan contre le code de
F7. Ses 25 remarques (6 bloquantes, 13 importantes, 6 mineures) sont intégrées ci-dessus ;
les principales :

1. le bandeau de chiffres sur `terracotta-deep` collait au héros foncé : il devient la dernière
   rangée du héros ; l'enchaînement des fonds se teste par `data-fond` ;
2. typage : aucun composant de lot parallèle n'importe `ContenuFiche` (interfaces locales) ;
3. tests de contenu : recherche sur le texte et non le HTML, mots courts en mot entier, phrases
   contractuelles de la Journée IA exclues de la recherche de « prix » ;
4. tests d'animation : le `Cta` (déjà neutralisé par `prefers-reduced-motion` dans
   `globals.css`) et le contenu des `details` sont exclus ;
5. mesure du First Load JS adaptée à cette version de Next (`--webpack`, manifeste de
   références client) ;
6. deux bleus cachés évités : `.bg-mocha-rich` et l'anneau de focus `ring-primary` de `Button` ;
7. `speakable` limité au héros (`data-reponse-section` pour les réponses de section) ;
8. JSON-LD de Williams enrichi par décomposition (`...buildProfilePageWilliamsJsonLd()`), sans
   toucher `williams-person.ts` ;
9. « marge » remplacé par « rentabilité » ; pastilles du héros sans répétition des chiffres ;
10. fiche collaborateur réelle = gabarit court (aucune migration, donc pas de parcours, de
    publications ni de citations aujourd'hui) ; réponses de registre courtes pour éviter des
    pages identiques d'un collaborateur à l'autre ;
11. pastille de catégorie dans une capsule claire sur fond foncé (contraste < 3:1 sinon) ;
    fonds d'icônes par table fixe ;
12. découpage en six lots (R2b et R2c scindés), fichiers exacts corrigés
    (`adaptateurs.ts`, tests `textes-publics-positionnement.spec.ts` et
    `equipe-williams*.spec.ts`) ;
13. `sitemap.ts` : `lastModified` fixe pour la fiche de Williams ; Journée IA en 5 colonnes
    seulement dès `xl` ; carte de service mise en avant en pleine largeur ; ancres FAQ
    exactes ; `FaqFiche` nécessaire.

Restent à décider hors du code, signalés aux lots concernés : la phrase contractuelle de
garantie de la Journée IA mentionne le prix de la journée (conservée telle quelle, texte
injecté) ; `llms.txt` ne cite pas encore `/fr/equipe/williams` et les fiches collaborateurs ne
sont pas dans le sitemap (à traiter avec le hub, lot R3).

VERDICT OPUS : PLAN PRÊT
