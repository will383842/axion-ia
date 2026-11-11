# C3 Pôle UX & Design, architecture de l'information : header, structure de l'accueil, design

Rôle : responsable du pôle UX & design (Krug, NN/g, Baymard, WCAG 2.2, Core Web Vitals). Cadre : décisions de Williams (`accueil\CONSIGNES-WILLIAMS-ACCUEIL.md`, y compris le complément du 08/11), palette [d1], police [d2], analyses E2, E8, A1 et synthèse §5-6.1. Tout ce qui n'est pas constaté est marqué « hypothèse ». Aucun chiffre hors `DONNEES-TRAFIC.md`.

**En bref.** Le header passe à 4 onglets : `Accueil · La Journée IA · Nos prestations ▾ · Tarifs`, plus deux boutons. Il tient dès 1 280 px, au lieu de 1 440 px aujourd'hui. Sur l'accueil, l'unique bloc sombre est **la carte « La Journée IA » de la section 2**. On retire la photo d'équipe générée, qui est présentée comme réelle. La page compte 9 sections et environ 1 000 mots. Il faut produire 8 visuels, dont 4 vraies photos.

---

## 1. Header cible

### 1.1 Ordre des onglets retenu (version précisée de Williams)

```
[Logo Axion-IA]   Accueil   La Journée IA   Nos prestations ▾   Tarifs        (loupe)  [Nous écrire]  [Réserver un appel]
 Partenaire IA
 des TPE et PME
```

| # | Libellé exact | Destination | Type | Raison de la position |
|---|---|---|---|---|
| 1 | **Accueil** | `/fr` | lien | Décision de Williams. C'est le repère « vous êtes ici » pour un public peu habitué au web (voir 1.2). |
| 2 | **La Journée IA** | `/fr/journee-ia` | lien direct, sans menu | C'est la porte n°1 ([deux_offres], will). L'effet de position en série fait que le premier et le dernier élément sont les mieux retenus : on met donc en premier, juste après « Accueil », ce que le site veut vendre (Krug). Aujourd'hui, aucun lien ordinateur ne mène à cette page, qui est absente du top 40 Plausible. |
| 3 | **Nos prestations ▾** | méga-menu (bouton, pas de page) | disclosure | Il regroupe les deux pages de service les plus visitées : Audit (376 visites) et Formations (359). Elles restent à deux gestes, et la barre perd 4 onglets. |
| 4 | **Tarifs** | `/fr/tarifs` | lien | Optionnel : voir la recommandation en 1.3. C'est la dernière position, au contact des boutons, là où un acheteur B2B cherche le prix (Baymard). |

À droite, dans cet ordre : la loupe (`/recherche`), **« Nous écrire »** (bouton secondaire, contour) et **« Réserver un appel »** (bouton principal terracotta). Williams a décidé de garder les deux boutons.

Écart signalé, sans le rediscuter : [regle_cta] (statut « propose ») prévoit « Prendre rendez-vous » et proscrit « Réserver ». La décision de Williams du 08/11 prime : on garde **« Réserver un appel »**. Le pictogramme Téléphone est remplacé par **CalendarDays** (Lucide), parce que le rendez-vous se fait en visio ou par téléphone ([d5]) et que l'icône de téléphone laisse attendre un appel immédiat (E8 3.3).

### 1.2 Pourquoi garder « Accueil » alors que le logo y mène déjà

Selon NN/g, le logo cliquable suffit sur un site grand public, et un onglet « Accueil » est redondant. Je le garde pour trois raisons, en plus de la décision de Williams :
1. **Le public** : des dirigeants de TPE et PME, souvent peu à l'aise sur le web. Une partie d'entre eux ne sait pas que le logo est cliquable (NN/g le constate aussi : la convention n'est pas universelle).
2. **Il ne coûte presque rien** : 7 caractères, environ 63 px. La barre tient largement (1.4).
3. **On peut le rendre utile** : sur l'accueil, il porte `aria-current="page"` et le soulignement terracotta. Il dit donc « vous êtes ici », et sur les pages profondes il ramène à l'accueil sans obliger à chercher le logo.

Contrôle : si, après 60 jours, il pèse moins de 1 % des clics du header (1.9), on reposera la question à Williams avec ce chiffre.

### 1.3 « Tarifs » : recommandation argumentée (deux variantes)

**Variante A, recommandée** : `Accueil · La Journée IA · Nos prestations ▾ · Tarifs`.
**Variante B** : `Accueil · La Journée IA · Nos prestations ▾`, avec « Tarifs » au footer.

Je recommande **A, à une condition** : que `/tarifs` soit réécrite avant la mise en ligne et alignée sur le Company Brain. La page doit montrer la Journée IA à 1 490 € HT ([d4]), le Diagnostic IA gratuit de 45 min ([d5]) et le reste « sur devis, après diagnostic », sans prix de formation ([d13] et [r18] : en attente de Williams). Les arguments :
- les acheteurs B2B cherchent tôt le prix d'entrée (Baymard), et un onglet « Tarifs » visible est un signal de transparence, même pour ceux qui ne cliquent pas ;
- ses 25 visites mesurent surtout un onglet invisible sous 1 440 px et absent du tiroir mobile (Header.tsx : `filter(item.href !== "/tarifs")`), pas un manque d'intérêt ;
- avec 4 onglets, la place n'est plus un problème (1.4).

**Si la page n'est pas alignée à la mise en ligne, on part en B**, puis on bascule en A quand elle l'est : un onglet qui mène à des prix contradictoires (1 900 € et 1 490 € pour « une journée », E8) détruit la confiance. Le libellé reste « Tarifs » plutôt que « Prix et devis », parce que c'est le mot attendu, le plus court et le plus reconnu (NN/g).

### 1.4 Largeur estimée (hypothèse, à mesurer en navigateur)

Base : la mesure réelle du code, soit 1 397 px pour la rangée actuelle (7 onglets en 17 px, globals.css). On en déduit environ 9 px par caractère en Manrope 600 16 px, et 6,3 px à 12 px.

| Élément | Caractères | Largeur estimée |
|---|---|---|
| Logo SVG (32 px de haut) + tagline « Partenaire IA des TPE et PME » (12 px) | 28 (tagline) | 180 |
| Espace logo / navigation | | 40 |
| Accueil · La Journée IA · Nos prestations ▾ · Tarifs | 7 + 13 + 15 + 6 = 41 | 389 + chevron 20 + 3 × 28 d'écart = **473** |
| Espace flexible minimum | | 24 |
| Loupe + écart | | 52 |
| « Nous écrire » (icône, 11 car., marge 16) + écart | 11 | 166 |
| « Réserver un appel » (icône, 17 car., marge 20) | 17 | 215 |
| **Total de la rangée, variante A** | | **≈ 1 150 px** |
| Variante B (sans Tarifs) | | ≈ 1 068 px |

| Écran | Marge latérale | Place utile (barre de défilement de 17 px déduite) | Marge restante en A | En B |
|---|---|---|---|---|
| 1 280 | 40 + 40 | 1 163 | **+13 px** (trop juste) | +95 |
| 1 366 | 48 + 48 | 1 253 | +103 | +185 |
| 1 440 | 64 + 64 | 1 295 | +145 | +227 |

**Conséquence.** On abaisse `--breakpoint-nav` de 1 440 à **1 280 px**. Entre 1 280 et 1 365 px, on masque la tagline (−50 px, soit environ +63 px de marge) ou on passe l'écart entre onglets à 24 px. On supprime `--breakpoint-navcta` et `--breakpoint-navair`, parce que « Nous écrire » est visible dès que la barre l'est. Il faut aussi découpler la liste des onglets de `SERVICES` (`HEADER_TABS` explicite), poser `ONGLETS_MESURES = 4` (A) ou `3` (B) dans `Header.budget.spec.ts`, et refaire la mesure par dichotomie (1 280, 1 366, 1 440, 1 600, 1 920) avec `header-tient-dans-sa-boite.spec.ts`. Sous 1 280 px, le header affiche logo, « Réserver un appel » et ☰.

### 1.5 Méga-menu « Nos prestations »

Panneau d'environ 640 px de large, fond blanc, rayon 16, ombre `--shadow-pop`, filet `#E8E6DC`. Une colonne de 5 lignes, chacune faite d'une icône Lucide de 20 px en `#5E5D59`, d'un titre en Manrope 600 16 px `#141413` et d'une description en 400 14 px `#5E5D59`. Pas de prix, pas de compteur. L'ordre suit le chemin « on chiffre, on forme, on met en place » ([slogan]) et le volume de visites :

1. **Audit IA** : « Où l'IA vous fait gagner du temps et de l'argent, chiffré avec vos équipes. »
2. **Formations IA** : « Vos équipes apprennent sur leurs vrais dossiers, dans vos locaux, attestation pour chacun. »
3. **Implémentation IA** : « Devis, relances, e-mails, saisies : la tâche se fait toute seule, vous gardez la main. »
4. **Coaching IA** : « Des rendez-vous réguliers pour avancer vite, sans rester seul face aux choix. »
5. **Sites web & SaaS IA** : « Votre site ou votre outil métier, avec l'IA prévue dès la conception. »

Les descriptions viennent de [n_quatre_familles] ; la cinquième est une hypothèse, à faire valider par A6. Les libellés restent les noms officiels de `services.ts` (« Implémentation IA » est le mot employé par Williams).

**Page AI Act** (« une page dédiée sera créée… et sera aussi dans le header ») : elle devient une **6ᵉ ligne du méga-menu, séparée par un filet**, plutôt qu'un 5ᵉ onglet, qui coûterait environ 200 px et ferait repasser la barre au-dessus de 1 280. Libellé proposé : **« Former vos équipes à l'IA (AI Act) »**, avec la description « Ce que demande le règlement européen, et comment la Journée IA y répond. » On n'écrit ni « conforme », ni « certifié », ni « obligatoire sous peine d'amende » ([mots interdits], ligne 1041 du Company Brain). Question 3 à Williams.

**Pied du panneau** (fond `#FAF9F5`, 56 px de haut) : « **Pas sûr de ce qu'il vous faut ?** Commencez par la Journée IA → », avec à droite le lien texte « ou réservez un appel ». Ce n'est pas un deuxième bouton plein.

**Comportement** : modèle « disclosure » (`<button aria-expanded aria-controls>`), pas `role="menu"`. Le menu s'ouvre au clic, et au survol avec 150 ms d'intention. Il se ferme avec Échap (le focus revient sur le bouton), au clic extérieur et à la sortie du focus. Le chevron pivote de 180°, sans animation si `prefers-reduced-motion`.

### 1.6 Habillage et accessibilité

Fond ivoire `#FAF9F5`, filet bas 1 px `#E8E6DC`, hauteur 72 px sur ordinateur et 64 px sur téléphone. Le header est collant, **sans `backdrop-blur`**, qui coûte cher sur mobile (E8). On remplace le fond terracotta plein, contraire à [d1] (« pas des coupes noir / blanc / orange »). Onglets en Manrope 600 16 px `#141413`. Survol en `#B23F16` (5,51:1). Onglet actif souligné de 2 px en terracotta, avec `aria-current`. **Logo** : le fichier `axion-ia-logo-vectoriel-couleur.svg` existe (17 Ko) et remplace le logo actuel, qui est composé en Fraunces. Celui-ci est contraire à [d2] et dépend d'une police qu'on retire. Le SVG est servi en `<img>` mis en cache, pas en ligne. La version définitive attend le fichier d'origine ([d12]). **Focus** : `outline: 2px solid #B23F16; outline-offset: 2px` plus un halo ivoire. On remplace le bleu actuel, qui ne donne que 1,16:1 sur terracotta (E8). Aucun bleu, aucun emoji, aucun texte en orange sur le clair.

### 1.7 Menu mobile (tiroir Radix conservé)

À côté du ☰ : bouton **« Réserver »** (icône calendrier, `aria-label="Réserver un appel"`), 40 px de haut, parce que le libellé complet ne tient pas à 360 px avec le logo et le ☰. Le tiroir présente, de haut en bas, sans emoji :
1. Le bouton **Réserver un appel** en pleine largeur (48 px, terracotta).
2. **Accueil**.
3. **La Journée IA**, avec une sous-ligne `#5E5D59` : « 1 journée chez vous · 1 490 € HT ».
4. **Nos prestations** en accordéon fermé par défaut : les 5 lignes du méga-menu avec leurs descriptions, puis la page AI Act.
5. **Tarifs** (variante A). Il revient dans le tiroir, d'où il a été retiré à tort.
6. Un filet, puis **Nous écrire** (bouton contour, pleine largeur) et le lien « Rechercher sur le site ».

On a ainsi la même carte sur téléphone et sur ordinateur (NN/g), et environ 9 rangées au lieu de plus de 20.

### 1.8 Footer en 4 colonnes (accueille « Ressources »)

Fond **gris chaud `#E8E6DC`**, et non plus sombre : le footer `bg-mocha-rich` actuel serait un deuxième bloc sombre ([d1]). Texte `#141413` (14,7:1), texte secondaire `#5E5D59` (5,27:1), survol terracotta (4,64:1).

| Nos prestations | Ressources | Axion-IA | Informations légales |
|---|---|---|---|
| La Journée IA | Guide IA entreprise | À propos | Mentions légales |
| Audit IA | Simulateur de gains | Williams Jullin, fondateur | CGV |
| Formations IA | FAQ | Méthodologie | Confidentialité |
| Implémentation IA | Blog | Presse | Cookies |
| Coaching IA 1-to-1 | L'IA par secteur | Carrières | Accessibilité |
| Sites web & SaaS IA | Comparatifs | Devenir apporteur d'affaires | Réclamations |
| Former vos équipes à l'IA (AI Act) | Glossaire | Nous écrire | Règlement intérieur |
| Tarifs | Observatoire IA | Réserver un appel | Sous-traitants · Plan du site |

Les 18 régions sortent des colonnes. Sous les colonnes, on garde une ligne : « Partout en France, dans vos locaux ou à distance : **toutes nos régions** → `/implantations` ». Le bas de page porte le logo, la catégorie, la déclaration d'activité n° 84381100438 avec sa phrase obligatoire, et LinkedIn et Facebook. Le lien « Qualiopi » du footer actuel est à vérifier par E5 au regard des mots interdits (« certifié »).

### 1.9 Mesure (Plausible, événements personnalisés)

- `header_tab_click` avec la propriété `onglet` = accueil | journee_ia | tarifs, et `mode` = barre | tiroir.
- `header_prestations_open`, puis `header_prestation_click` avec `id` = audit | formations | implementation | coaching | sites_web | ai_act.
- `header_megamenu_pied_click` (Journée IA ou appel).
- `cta_header_book_call_click` et `cta_header_contact_click` (existants), avec `?depuis=entete`.
- **Lecture à 30 jours** : la part des clics du header par onglet, les visites de `/journee-ia` (aujourd'hui hors du top 40), et le tunnel `/appel` → `/appel/reserver` → `/appel/confirme`, qui part de 392 → 18 → 16.

---

## 2. Structure de la page d'accueil

### 2.1 Ordre des sections et logique

Fil narratif (StoryBrand et module HOME) : **problème et promesse** (héros), **le choix simple** (section 2), **le guide** (qui), **la vision du résultat** (implémentations), **pourquoi nous**, **le reste de l'offre**, **pour qui et où**, **les objections**, **l'appel final**.

| # | Section | Rôle | Fond | Hauteur ordinateur / téléphone | Mots max |
|---|---|---|---|---|---|
| 1 | Héros (h1 conservé, nouveau hook) | Problème, promesse, catégorie | ivoire | 440 / 480 px | 45 |
| 2 | **Deux façons de commencer** (Journée IA, Appel) + bande « 3 étapes » | Offre et plan | gris chaud, **carte Journée IA noire** | 640 / 1 500 px | 170 |
| 3 | « On ne promet pas l'excellence. On la livre. » | Le guide : Williams, autorité vérifiable, 3 engagements | ivoire | 560 / 900 px | 110 |
| 4 | « Des implémentations sur mesure » | Vision du succès, 4 **exemples types** étiquetés | gris chaud | 620 / 1 300 px | 140 |
| 5 | « Six raisons concrètes de nous choisir » | Différenciation | ivoire | 520 / 1 100 px | 130 |
| 6 | Nos prestations (bande compacte, sans prix) | Le reste de l'offre, maillage | gris chaud | 300 / 620 px | 80 |
| 7 | « Nous accompagnons les PME, les TPE » · « Tous les secteurs » · « Partout en France » | Identification, GEO/SEO : trois h2 dans un même chapitre | ivoire | 760 / 1 400 px | 170 |
| 8 | Questions fréquentes (6 à 7) | Objections | gris chaud | 560 / 900 px | 200 (fermé) |
| 9 | Appel final : rappel des deux choix | Action | ivoire | 360 / 560 px | 40 |

Soit environ **1 000 à 1 100 mots**, contre environ 1 700 aujourd'hui, et 9 sections au lieu de 11. **Retirés** : « Un prix de départ pour chaque service » (prix non alignés sur [d4] et [d13], et prix « Sites web 990 € » recopié de l'implémentation, `webEntryPrice = implEntryPrice`) ; le bandeau terracotta « Votre projet mérite une réponse concrète » (remplacé par la section 9) ; le bandeau photo « équipe » ; les 3 promesses génériques. La section « Ce que nous faisons. Concrètement. » n'est citée ni pour être gardée ni pour être retirée : elle devient la bande compacte n°6, sans prix.

### 2.2 Spécifications par section

**1. Héros.** Grille 12 colonnes : texte sur 8, photo sur 4.
- Sur-titre : 14 px 600 `#5E5D59`, « Partenaire IA des TPE et PME, partout en France » (sous réserve de [d7]).
- **h1** conservé (décision de Williams), en Manrope 800, 52 px sur ordinateur et 34 px sur téléphone, interligne 1,08. Il est composé en trois lignes, pour que chacune se lise en un coup d'œil : « On vous parle d'IA partout. / Vous ne savez plus par où commencer. / **Nous, si.** ». Le troisième fragment est en terracotta (5,51:1).
- Hook : 20 px, 30 mots au plus, 2 lignes. Le texte relève de E7 et A1 ; la base proposée est la promesse officielle ([n_offre_phare], mot pour mot).
- Réassurance : 15 px `#5E5D59`, « Diagnostic IA gratuit de 45 min · Dans vos locaux ou à distance · Sans engagement ».
- **Pas de bouton dans le héros** : les deux choix arrivent immédiatement en dessous, sur le même premier écran (2.3). Dupliquer les boutons ici créerait un troisième choix.
- Image : **photo réelle de Williams** dans une carte de rayon 24, 4:5, environ 300 × 375 px à l'affichage. Provisoirement, on prend le portrait existant `home-founder-william.avif` (2 048 × 2 048, recadré en 4:5), avec la légende « Williams Jullin, fondateur d'Axion-IA ». La photo cible est V1. Sur téléphone, on n'affiche pas la grande photo mais un avatar rond de 48 px dans la ligne du sur-titre. Il faut un fichier distinct de 96 × 96 px : le préchargement `priority` d'une image masquée sur mobile a déjà coûté 62 Ko (GEO-125, page.tsx).
- **On retire `home-hero-equipe`** (« équipe » de 12 personnes en pulls terracotta) : voir §4.

**2. Deux façons de commencer.** Détail au §3.

**3. « On ne promet pas l'excellence. On la livre. »** (titre gardé tel quel). Deux colonnes : grande photo de Williams à gauche (V1 ou V2, 4:5, 440 px de large, rayon 24), texte à droite.
- Nom complet « Williams Jullin », fonction « fondateur ».
- L'autorité vérifiable : « 32 ans de direction, de 0 à 236 collaborateurs » [PREUVE À FOURNIR : entreprises et dates] et « Organisme de formation déclaré sous le n° 84381100438 auprès du préfet de région Auvergne-Rhône-Alpes. Cet enregistrement ne vaut pas agrément de l'État. »
- 3 engagements, chacun avec une icône Lucide : un seul interlocuteur ; rien à installer ; aucun chiffre que nous n'avons pas calculé avec vous ([on_ne_fait_pas]).
- Lien texte « Qui est derrière Axion-IA » → `/a-propos`.
- Sur téléphone : photo 4:3 au-dessus, puis le texte.

**4. « Des implémentations sur mesure »** (titre gardé). **Grille statique de 4 cartes blanches**, 2 × 2 sur ordinateur, empilées sur téléphone. **Le carrousel automatique est supprimé** (WCAG 2.2.2, « erreur fatale » du module HOME).
- Chaque carte : illustration schématique avant / après (V6, 4:3, SVG ou AVIF ≤ 40 Ko), puis une étiquette visible « **Exemple type** » en 13 px 600, fond `#E8E6DC` et texte `#141413`. Suivent le titre de la tâche (devis, relances, tri des e-mails, comptes rendus : [cas_concrets]) et 2 phrases.
- **Aucun chiffre de résultat** (A1 BLOQUANT 1 ; [cas_concrets] dit « exemples types, pas des clients réels »).
- Un seul lien en bas : « Voir d'autres exemples » → `/cas-concrets`, seulement si la page est réétiquetée.

**5. « Six raisons concrètes de nous choisir »** (titre gardé). Grille de 3 × 2 cartes blanches sur ordinateur, une colonne sur téléphone. Chaque carte : une icône Lucide de 24 px en terracotta, un titre de 5 mots au plus, 20 mots au plus. **On retire les 6 photos Unsplash** : elles n'apportent aucune preuve et leurs crédits trahissent la banque d'images (A1 n°14). Chaque raison doit être vérifiable : à trier avec E5 (« Tous seniors » [PREUVE À FOURNIR]).

**6. Nos prestations.** 5 cartes compactes sur une rangée (une colonne sur téléphone). Chaque carte : icône, nom officiel, description d'une ligne (les mêmes que le méga-menu) et un lien descriptif (« Voir l'audit »), jamais « Découvrir ». **Aucun prix.**

**7. Chapitre « Pour qui, où »** : trois h2 gardés, sur un même fond, pour qu'ils se lisent comme un seul bloc.
- (a) « Nous accompagnons les PME et les TPE » : 2 cartes (TPE, PME). Photos Unsplash gardées provisoirement avec un alt honnête, sans « Axion-IA » et sans le chiffre non sourcé « 1 à 3 h libérées par jour ».
- (b) « Axion-IA intervient dans tous les secteurs d'activité » : une phrase et 16 secteurs en **liens texte** séparés par des points médians (pas de tuiles), vers `/secteurs/...`.
- (c) « Axion-IA disponible partout en France » : carte SVG épurée (V7, un trait `#5E5D59`, Grenoble marquée en terracotta), une phrase et le lien `/implantations`. **On supprime les 18 tuiles « hab. / PIB ».**

**8. Questions fréquentes.** 6 à 7 questions de décision (A1 §6), en accordéon fermé. Le JSON-LD FAQPage reprend exactement le texte visible.

**9. Appel final.** Titre en une ligne, puis **les deux choix en version courte**, côte à côte : une carte « La Journée IA · 1 490 € HT » en contour noir → `/journee-ia`, et une carte « Réserver un appel » avec le bouton terracotta → `/appel?depuis=accueil-final`. Lien texte « Vous préférez écrire ? Nous écrire ». Pas de bande terracotta et pas de second bloc sombre.

**Barre collante mobile** (déjà dans le code, à renommer) : elle apparaît **quand la section 2 a quitté l'écran** et disparaît quand la section 9 est visible (IntersectionObserver). Hauteur 64 px plus `env(safe-area-inset-bottom)`, fond ivoire, filet en haut. Deux boutons à moitié de largeur : « La Journée IA » (contour noir) et « Réserver un appel » (terracotta).

### 2.3 Wireframes

**Ordinateur, 1 440 × 900 : héros et section 2 (premier écran ≈ jusqu'à la ligne ═══)**

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ [Axion-IA]   Accueil  La Journée IA  Nos prestations ▾  Tarifs     (⌕) [Nous écrire] [▣ Réserver un appel] │ 72
│  Partenaire IA des TPE et PME                                                                 │
├──────────────────────────────────────────────────────────────────────────────────────────────┤ ivoire
│  PARTENAIRE IA DES TPE ET PME, PARTOUT EN FRANCE                         ┌──────────────┐     │
│                                                                          │              │     │
│  On vous parle d'IA partout.                                             │  PHOTO RÉELLE │     │
│  Vous ne savez plus par où commencer.                                    │  Williams     │     │
│  Nous, si.  (terracotta)                                                 │  4:5, r=24    │     │
│                                                                          │              │     │
│  Hook : 2 lignes, 30 mots max.                                           └──────────────┘     │
│  ✓ Diagnostic gratuit 45 min · ✓ Chez vous ou à distance · ✓ Sans engagement   légende 13 px │ ≈440
├──────────────────────────────────────────────────────────────────────────────────────────────┤ gris chaud
│  Deux façons de commencer                     (h2 32 px)                                      │
│ ┌───────────────────── 7 colonnes · NOIR #141413 · r=24 ──────┐ ┌──── 5 col · BLANC · r=24 ──┐ │
│ │ EN UNE JOURNÉE, CHEZ VOUS  (orange)          ┌───────────┐ │ │ (▶ visio) (☏ téléphone)    │ │
│ │ La Journée IA            (h3 36 px ivoire)   │ PHOTO     │ │ │ Réserver un appel  (h3 28)  │ │
│ │ Promesse officielle, 2 lignes                │ atelier   │ │ │ Un besoin précis, une       │ │
│ │ ─────────────────────────────────           │ réel 3:4  │ │ │ question ? Parlons-en.      │ │
│ │ MATIN · 2 à 4 h   Audit : 3 à 5 tâches…      │           │ │ │ ✓ Diagnostic IA gratuit     │ │
═│═APRÈS-MIDI · 4 h  Formation des équipes ═════│═══════════│═│═│═✓ 45 min · visio ou tél.═══│═│══
│ │   ▸ Volet AI Act : formation art. 4 ·        └───────────┘ │ │ ✓ Sans engagement           │ │
│ │     attestation par personne                               │ │ (◯ 56 px) Avec Williams…    │ │
│ │ ENSUITE           Plan d'action chiffré 90 j               │ │                             │ │
│ │ 1 490 € HT  (orange, 48 px)   la journée, dans vos locaux  │ │ [ Réserver un appel ]  (T)  │ │
│ │ ┃ Garantie : si les gains < 3 × le prix… remboursé 30 j    │ │ ou nous écrire →            │ │
│ │ [ Voir la Journée IA en détail → ]  (bouton orange)        │ └─────────────────────────────┘ │
│ └────────────────────────────────────────────────────────────┘                                 │
│  ① Appel ou diagnostic gratuit  →  ② La Journée IA  →  ③ Nous mettons en place ce qui rapporte │ ≈640
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Téléphone, 390 × 844 : héros et section 2**

```
┌──────────────────────────────┐
│ [Axion-IA]   [▣ Réserver] [☰] │ 64
├──────────────────────────────┤ ivoire
│ (◯) Partenaire IA des TPE…   │
│ On vous parle d'IA           │
│ partout. Vous ne savez       │  h1 34 px
│ plus par où commencer.       │
│ Nous, si.                    │
│ Hook : 3 à 4 lignes, 17 px   │
│ ✓ 45 min gratuit · ✓ Sans    │
│   engagement                 │ ≈480
├──────────────────────────────┤ gris chaud
│ Deux façons de commencer     │
│┌────────── NOIR ────────────┐│ ← le haut de la carte et le prix
││ La Journée IA              ││   visibles dès le 1er écran
││ Promesse (3 lignes)        ││
││ 1 490 € HT  (orange 40 px) ││
═││═══════════════════════════││═ 844
││ Matin · Après-midi · Après ││
││ ▸ Volet AI Act (1 ligne)   ││
││ ┃ Garantie (encadré)       ││
││ [Voir la Journée IA ...]   ││ 48 px, pleine largeur
││ photo atelier 16:9 (lazy)  ││
│└────────────────────────────┘│
│┌───────── BLANC ────────────┐│
││ Réserver un appel          ││
││ ✓ 45 min ✓ visio/tél ✓ …   ││
││ [ Réserver un appel ]      ││
│└────────────────────────────┘│
│ ① → ② → ③ (liste verticale)  │
└──────────────────────────────┘
 [La Journée IA][Réserver un appel] ← barre collante après la section 2
```

**Section type, « Des implémentations sur mesure » (ordinateur | téléphone)**

```
┌──────────────────────── gris chaud ──────────────────────┐   ┌──────────────────────┐
│ Des implémentations sur mesure             (h2 40 px)     │   │ Des implémentations  │
│ Ce qui se fait tout seul ensuite. (1 ligne)               │   │ sur mesure (h2 28)   │
│ ┌──────────────────────┐  ┌──────────────────────┐        │   │┌────────────────────┐│
│ │ [schéma avant/après] │  │ [schéma avant/après] │ 4:3    │   ││ [schéma 4:3]       ││
│ │ EXEMPLE TYPE         │  │ EXEMPLE TYPE         │        │   ││ EXEMPLE TYPE       ││
│ │ Vos devis            │  │ Vos relances         │        │   ││ Vos devis          ││
│ │ 2 phrases, sans      │  │ 2 phrases            │        │   ││ 2 phrases          ││
│ │ chiffre inventé      │  │                      │        │   │└────────────────────┘│
│ └──────────────────────┘  └──────────────────────┘        │   │ … 3 autres cartes    │
│ ┌──────────────────────┐  ┌──────────────────────┐        │   │ Voir d'autres        │
│ │ Tri des e-mails      │  │ Comptes rendus       │        │   │ exemples →           │
│ └──────────────────────┘  └──────────────────────┘        │   └──────────────────────┘
│ Voir d'autres exemples →                                  │
└───────────────────────────────────────────────────────────┘
```

---

## 3. La section 2 à deux blocs, en détail

### 3.1 Le bloc sombre unique : pourquoi lui

**Choix : la carte « La Journée IA » de la section 2, en noir `#141413` avec l'accent orange `#D97757`.** Elle n'occupe pas toute la largeur : c'est une carte arrondie insérée sur une bande gris chaud, conformément à [d1]. Les raisons :
1. Williams demande le contraste « peut-être dans les blocs de la section 2 ». C'est donc l'endroit où il l'attend.
2. Le contraste doit servir la **décision** : c'est l'offre que le site veut vendre (porte n°1). L'œil va d'abord à la zone la plus contrastée (hiérarchie visuelle), puis lit le prix.
3. Le bandeau « On ne promet pas l'excellence » est une section de confiance. En sombre, il volerait l'attention à l'offre, et la photo de Williams y gagne davantage sur un fond clair.
4. Conséquence : **le footer passe en gris chaud** (question 4) et la bande terracotta disparaît.

### 3.2 Hiérarchie entre les deux blocs

| | Bloc 1 · La Journée IA (dominant) | Bloc 2 · Réserver un appel (léger) |
|---|---|---|
| Largeur ordinateur | 7 colonnes sur 12 (≈ 700 px) | 5 colonnes (≈ 480 px), même hauteur |
| Fond | noir `#141413`, rayon 24, marge intérieure 48 px | blanc `#FFFFFF`, rayon 24, filet `#E8E6DC`, marge 40 px |
| Titre (h3) | « La Journée IA », 36 px 800, ivoire (17,5:1) | « Réserver un appel », 28 px 700, `#141413` |
| Corps | ivoire pour la promesse, `#B0AEA5` pour les détails (8,29:1) | `#141413` et `#5E5D59` (6,59:1 sur blanc) |
| Prix | **1 490 € HT**, 48 px 800 orange `#D97757` (5,90:1), sous-ligne « la journée, dans vos locaux, partout en France » | « Gratuit · 45 minutes » en 20 px 700 `#141413` |
| Bouton | **orange `#D97757`, texte noir** (5,90:1), 52 px, rayon 12 | **terracotta, texte blanc** (5,81:1), 52 px |
| Image | photo réelle d'atelier (V1 ou V3), 3:4, à droite dans la carte | avatar de Williams de 56 px + icônes Video et Phone (Lucide, 24 px, terracotta) |

**Pourquoi un bouton orange sur le noir.** Le terracotta sur noir ne se détache qu'à 3,17:1, à la limite du minimum de 3:1 pour un composant. L'orange atteint 5,90:1, et [d1] le réserve précisément au fond noir. Chaque carte n'a ainsi qu'un seul bouton plein, de couleur différente : on évite deux boutons terracotta côte à côte, qui se feraient concurrence. C'est un écart volontaire avec [regle_cta] (« propose ») : à valider par le pôle.

### 3.3 Contenu du bloc 1 (structure, le texte final relève de E1, E7 et A9)

1. Sur-titre en orange, 13 px 700, espacé : « En une journée, chez vous ».
2. h3 « La Journée IA », puis la promesse mot pour mot ([n_offre_phare]).
3. **Déroulé en 3 lignes**, avec un repère horaire à gauche (14 px 700 orange) :
   - Matin · 2 à 4 h : audit avec vos équipes, « les 3, 4 ou 5 choses à automatiser, avec le gain » (complément de Williams).
   - Après-midi · 4 h : formation de vos équipes sur leurs propres tâches.
   - Ensuite : votre plan d'action chiffré sur 90 jours ([d6]).
4. **Repère AI Act, sobre** : sous la ligne « Après-midi », une ligne en retrait de 16 px, avec un filet vertical de 2 px `#B0AEA5`, l'icône `FileText` de 16 px et un texte de 14 px `#B0AEA5` : « Volet AI Act : cette formation répond à l'obligation de former vos équipes à l'IA (règlement européen, art. 4, depuis février 2025). Une attestation pour chaque personne formée. » **Pas de pastille, pas de sceau, pas de « conforme » ni de « certifié »**. La référence exacte de l'article est à confirmer avant publication (Company Brain, l. 334).
5. Prix (voir 3.2). Pas de prix barré ni de « valeur » inventée.
6. **Encadré garantie** : fond `rgba(250,249,245,0.06)`, filet gauche de 3 px orange, rayon 12, marge 16 / 20. Titre de 15 px 700 ivoire « Garantie », puis la phrase de [d6] (« Si les gains identifiés ne dépassent pas 3 fois le prix de la journée, nous vous remboursons, sans discussion, sous 30 jours. »). La condition est en 13 px `#B0AEA5` : « À condition que votre équipe soit disponible pendant la journée et fournisse les chiffres demandés. » Elle est toujours visible, pas cachée derrière un clic.
7. Bouton « Voir la Journée IA en détail » (variante de Williams : « Qu'est-ce que la Journée IA ? ») → `/journee-ia?depuis=accueil-bloc`.

### 3.4 Contenu du bloc 2

Les icônes visio et téléphone, le h3, une phrase (« Un besoin précis, une question sur nos prestations ? Parlons-en. »), puis 3 coches : « Diagnostic IA gratuit · 45 minutes » ([d5]), « En visio ou par téléphone », « Sans engagement ». Viennent ensuite l'avatar et « Vous échangez directement avec Williams Jullin » [PREUVE À FOURNIR : confirmer qui mène les appels], le bouton « Réserver un appel » → `/appel?depuis=accueil-bloc`, et dessous, en micro-réassurance de 13 px `#5E5D59`, « Vous choisissez un créneau, la confirmation arrive par e-mail. ». Enfin, le lien texte « ou nous écrire ».

### 3.5 Bande « 3 étapes » (sous les deux blocs)

C'est le plan de StoryBrand, absent aujourd'hui. Une ligne sur ordinateur, une liste verticale sur téléphone. Les numéros sont dans des pastilles de 28 px au contour terracotta : ① Un appel ou le Diagnostic IA gratuit → ② La Journée IA → ③ Nous mettons en place ce qui rapporte le plus ([n_plan_3_etapes]).

### 3.6 Mobile

Les blocs sont empilés, **Journée IA en premier**. Dans la carte noire, l'ordre est : titre, promesse, **prix (avant le déroulé, pour qu'il apparaisse dans le premier écran)**, déroulé, AI Act, garantie, bouton, puis la photo 16:9 en bas, chargée en différé. Marges latérales de 16 px, carte non collée aux bords. La barre collante prend le relais (2.2).

---

## 4. Images

### 4.1 Inventaire de ce qui existe (807 fichiers dans `public\images`, plus `public\illustrations`)

| Fichier(s) | Nature (constat ou hypothèse) | Usage honnête sur l'accueil |
|---|---|---|
| `illustrations/home-founder-william.{jpg,avif}` (2 048², 154 Ko en AVIF) | Portrait de Williams, extérieur, aspect photographique (**hypothèse : photo réelle**) | **Oui** : héros provisoire, section 3, avatar. À redécouper en 4:5, 600 px de large, ≤ 60 Ko. |
| `illustrations/william-fondateur-formateur-ia-axion-ia.*` | Williams assis, rendu très lisse (**origine à confirmer : retouche ou génération**) | Seulement si Williams confirme que c'est une vraie photo. |
| `illustrations/home-hero-equipe.*`, `home-bandeau-team.*` | « Équipe » de 12 personnes en pulls terracotta sous l'enseigne Axion-IA : **hypothèse forte d'image générée** (E5), présentée comme une « Photo de l'équipe Axion-IA » | **Non, à retirer.** Une mention « image générée » ne suffit pas sur une image qui représente « l'équipe » (E5). |
| `illustrations/home/why-*`, `audience-*` (10 photos Unsplash) | Banque d'images, crédits affichés | Seulement en 7(a), provisoirement, avec un alt sans « Axion-IA ». |
| `images/axion-ia-*-carre`, `-affiche`, `-banniere`, `-infographie` (la grande majorité) | Visuels marketing **avec des chiffres incrustés** (« 45 pourcent », « 3 200 euros », « 86 pourcent ») ; des scènes `photo-*` ont l'aspect d'images générées (hypothèse) | **Non** sur l'accueil : chiffres non calculés avec un client ([on_ne_fait_pas]), et anciens styles (bleu, Fraunces). |
| `images/axion-ia-logo-vectoriel-couleur.svg`, `…-blanc-fond-sombre.svg` | Logo vectoriel | **Oui** : header, footer, image Open Graph. |

### 4.2 Visuels à produire (8)

| # | Titre | Sujet et cadrage | Ratio, format, poids | Usage |
|---|---|---|---|---|
| V1 | **Williams en atelier** | Photo réelle chez une PME (accord écrit des personnes) : Williams debout, une équipe de dos ou de trois quarts, écran ou tableau lisible. Lumière naturelle. | 4:5 et 3:4, AVIF, ≤ 60 Ko à 600 px | Héros, carte Journée IA |
| V2 | **Portrait de travail** | Williams, buste, fond neutre clair, regard caméra | 1:1 et 4:5, ≤ 40 Ko | Avatar du bloc 2, section 3 |
| V3 | **Le plan d'action chiffré (exemple)** | Capture réelle du modèle de rapport, rempli de données fictives, tamponné « EXEMPLE » | 4:3, AVIF ≤ 50 Ko | Section 3 ou carte Journée IA (rend le livrable tangible, Hormozi) |
| V4 | **L'attestation (exemple)** | Modèle réel d'attestation de fin de formation, nom « Prénom Nom », n° de déclaration visible | 4:3, ≤ 40 Ko | Page AI Act, FAQ ; option dans la carte Journée IA |
| V5 | **Le matin de l'audit** | Photo réelle : post-it et chronométrage des tâches au mur, mains, sans visage identifiable | 3:2, ≤ 60 Ko | Section 4 (ouverture) ou page Journée IA |
| V6 | **4 schémas avant / après** | Devis, relances, tri des e-mails, comptes rendus : flux de 3 étapes, palette [d1], sans chiffre | 4:3, SVG ≤ 8 Ko chacun | Section 4 |
| V7 | **Carte de France au trait** | Contour seul, Grenoble en terracotta | SVG ≤ 10 Ko | Section 7(c) |
| V8 | **Williams en visio** | Vraie capture d'un appel (accord) ou photo de son poste avec casque | 4:3, ≤ 40 Ko | Page `/appel` et carte 2 en option |

Tous les fichiers sont servis avec `width` et `height`, `sizes` exact, en AVIF avec repli WebP. Ils sont chargés en différé hors du premier écran. Le texte alternatif **décrit** l'image, par exemple « Williams Jullin anime un atelier IA devant l'équipe d'une PME » (ne l'écrire que si c'est vrai).

### 4.3 Règle « image générée avec l'IA » ([d11], statut « propose »)

1. **Zones de preuve** (héros, carte Journée IA, section 3, bloc 2) : **photos réelles uniquement**. Si la photo manque, on n'en met pas : la carte noire tient sans image.
2. Une image générée **ne représente jamais** « notre équipe », « nos clients », « nos séances », ni une personne réelle.
3. Si une image générée photoréaliste est utilisée ailleurs, la mention **« Image générée avec l'IA »** figure dans un `<figcaption>` visible, en 12 px `#5E5D59`, sous l'image, et pas seulement dans l'alt. Elle est aussi dans les métadonnées IPTC du fichier (AI Act, art. 50).
4. Les schémas vectoriels dessinés (V6, V7) ne portent pas de mention, sauf s'ils sont sortis d'un générateur.

---

## 5. Performance et accessibilité

### 5.1 Budget de l'accueil

| Indicateur | Aujourd'hui (E8) | Cible |
|---|---|---|
| HTML brut | 1,66 Mo | **< 300 Ko** (Brotli < 60 Ko) |
| LCP mobile | non mesuré sur l'accueil ; /appel de 6,7 à 9,7 s | **< 2,5 s** (cible interne 1,8 s, AGENTS.md) |
| CLS | 0,15 à 0,22 sur d'autres gabarits (Fraunces) | **0** |
| Polices | 4 woff2 (≈ 136 Ko) | **1 fichier variable Manrope latin** (déjà dans `manrope-latin-var.woff2`), déclaré en `weight: "400 800"` ; usages 400, 600 et 800 ; Fraunces et Inconsolata retirées |
| Image héros | 185 Ko (PNG d'équipe généré) | **AVIF ≤ 60 Ko** au format affiché, ≤ 120 Ko au plus pour le 2x |

**Conséquences, par ordre de gain** :
1. Retirer `experimental.inlineCss` (`next.config.ts`, l. 225), environ 1,08 Mo de CSS recopié dans chaque page, et sortir le CSS d'administration.
2. Réduire le JSON-LD : `areaServed` = France, aucune description de Service avec des gains non sourcés (A1 MAJEUR 4), FAQPage identique au texte visible.
3. Supprimer les 18 tuiles de régions et le carrousel, avec ses copies en double dans le DOM.
4. Remplacer les 111 SVG en ligne par des icônes Lucide importées une à une.
5. Pas de `priority` sur une image masquée sur mobile. Préchargement en `media="(min-width:1024px)"` ou via `getImageProps` dans un `<picture>`.
6. Ajouter `/fr` et `/fr/journee-ia` aux garde-fous LHCI après mise en ligne, en médiane sur 3 passages.

### 5.2 Contrastes calculés (WCAG 2.x)

| Paire | Rapport | Usage autorisé |
|---|---|---|
| Terracotta `#B23F16` sur ivoire `#FAF9F5` | **5,51:1** | Texte, liens, mot du h1, focus |
| Ivoire `#FAF9F5` sur noir `#141413` | **17,50:1** | Texte de la carte noire |
| Orange `#D97757` sur noir `#141413` | **5,90:1** | Prix, repères, bouton (texte noir sur orange : 5,90) |
| Texte secondaire `#5E5D59` sur ivoire | **6,26:1** | Texte secondaire (6,59 sur blanc, 5,27 sur gris chaud) |
| Blanc sur terracotta | 5,81:1 | Texte des boutons |
| Blanc sur survol `#8F3412` | 7,87:1 | Bouton au survol |
| `#B0AEA5` sur noir | 8,29:1 | Détails dans la carte noire |
| Terracotta sur gris chaud `#E8E6DC` | 4,64:1 | Liens du footer (limite : pas en dessous de 14 px) |
| Terracotta sur noir | 3,17:1 | **Interdit en texte** ; tolérable pour un contour seulement |
| Orange sur ivoire | 2,96:1 | **Interdit** |
| `#B0AEA5` sur ivoire | 2,11:1 | **Interdit** |
| Gris chaud sur ivoire | 1,19:1 | Séparation de sections seulement : les cartes portent leur contenu, pas une bordure informative |

### 5.3 Règles

- **Focus** : visible partout, en `:focus-visible`. Anneau de 2 px terracotta avec un écart ivoire de 2 px sur le clair ; orange `#D97757` dans la carte noire. Jamais d'`outline: none` sans remplacement (WCAG 2.4.7, 2.4.11).
- **Mouvement** : `prefers-reduced-motion` respecté (déjà dans globals.css). Aucune animation d'entrée qui masque le contenu. **Aucun carrousel automatique.**
- **Titres** : **un seul h1** (le slogan). Une h2 par section (« Deux façons de commencer », les titres gardés, le chapitre 7 avec ses 3 h2). Les noms des cartes sont des h3.
- **Cibles tactiles** ≥ 44 × 44 px ; espaces insécables dans « 1 490 € » (E7).

---

## 6. Jetons de design et composants (à remettre au développeur)

### 6.1 Variables CSS (remplacent Design.md v3 : bleu, Fraunces et halos à supprimer)

```css
:root {
  /* Couleurs [d1] */
  --c-ivoire: #FAF9F5;   --c-gris-chaud: #E8E6DC;  --c-blanc: #FFFFFF;
  --c-noir: #141413;     --c-texte-2: #5E5D59;     --c-gris-sur-noir: #B0AEA5;
  --c-terracotta: #B23F16; --c-terracotta-survol: #8F3412; --c-orange: #D97757;
  --c-erreur: #B8341C;   --c-reussite: #5E7050;    --c-champ-bord: #5E5D59;
  /* Police [d2] */
  --font: "Manrope", "Manrope Fallback", system-ui, sans-serif;
  /* Rayons */
  --r-bouton: 12px; --r-carte: 16px; --r-bloc: 24px; --r-pastille: 999px;
  /* Ombres (teinte chaude, jamais bleue) */
  --shadow-carte: 0 1px 2px rgba(20,20,19,.06), 0 4px 16px rgba(20,20,19,.06);
  --shadow-pop:   0 8px 32px rgba(20,20,19,.12);
  --shadow-bouton: 0 1px 2px rgba(20,20,19,.08), 0 4px 12px rgba(178,63,22,.18);
  /* Espacements (base 4) */
  --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-5: 24px;
  --s-6: 32px; --s-7: 48px; --s-8: 64px; --s-9: 96px;
  --section-y: clamp(56px, 8vw, 96px);
  --conteneur: 1200px; --gouttiere: clamp(16px, 4vw, 40px);
  /* Titres : ordinateur → téléphone */
  --fs-h1: clamp(34px, 4.2vw, 56px);   /* 800, interligne 1.08, -0.03em */
  --fs-h2: clamp(28px, 3vw, 40px);     /* 800, 1.12 */
  --fs-h3: clamp(20px, 2vw, 28px);     /* 700, 1.25 ; carte Journée IA : 36 */
  --fs-lead: clamp(17px, 1.5vw, 20px); /* 400, 1.55 */
  --fs-corps: 17px;                    /* 18 px au-dessus de 1 024 px ; 1.65 */
  --fs-petit: 14px; --fs-mention: 12px;
  --fs-prix: clamp(40px, 4vw, 48px);   /* 800, chiffres tabulaires */
}
```

### 6.2 Composants

- **Bouton principal** : fond terracotta, texte blanc Manrope 600 17 px, 52 px de haut (48 px en pleine largeur sur téléphone), marge 28 px, rayon 12, `--shadow-bouton`, survol `#8F3412` en 150 ms.
- **Variante sur noir** : fond orange, texte noir, focus orange avec un écart noir.
- **Bouton secondaire (contour)** : transparent, texte `#141413`, bordure 1,5 px `#5E5D59` (6,26:1 ≥ 3), même gabarit. Survol en fond `#E8E6DC`. C'est « Nous écrire » dans le header, en 44 px.
- **Carte** : blanc, rayon 16, marge 24 / 32, `--shadow-carte`, sans bordure colorée. Si toute la carte est cliquable, un seul lien étendu (`::after`), pas de liens imbriqués.
- **Bloc sombre** : **une seule instance par page**, en carte insérée de rayon 24, jamais en pleine largeur. Marge 48 px (24 px sur téléphone). Contenu ivoire / `#B0AEA5` / orange. Interdits à l'intérieur : terracotta en texte, blanc pur en grand aplat.
- **Encadré garantie** : décrit au 3.3, réutilisable sur `/journee-ia`, sur le clair (fond blanc, filet gauche terracotta).
- **Étiquette « Exemple type »** : pastille fond `#E8E6DC`, texte `#141413` 13 px 600, rayon 999. C'est la seule pastille de la page, et jamais pour l'AI Act.
- **FAQ en accordéon** : `<details>` / `<summary>` natifs (zéro JavaScript, accessible au clavier). Résumé en 17 px 600, icône `ChevronDown` de 20 px avec rotation (coupée en mouvement réduit), séparateur 1 px `#E8E6DC`, cible de 56 px. Tout est fermé par défaut ; les ancres `#faq-...` ouvrent la bonne question. Le JSON-LD est identique au texte.
- **Onglet du header** : 16 px 600, cible de 44 px de haut, soulignement de 2 px au survol, au focus et en état actif.
- **Barre collante mobile** : décrite au 2.2 ; `role="region"` et `aria-label="Commencer"`.

**Design.md** : à réécrire en v4 (ivoire et terracotta, Manrope seule, un seul bloc sombre) **avant** la PR des composants. Sinon le linter continuera d'imposer « `#1a4dd9` seule couleur de CTA primaire » (§2.3, E8).

---

## 7. Questions à Williams (bloquantes seulement)

1. **Photos** : le portrait `home-founder-william` (veste beige, fond de verdure) et la photo assise (chemise verte, olivier) sont-ils de **vraies photos** de vous ? Disposez-vous d'une **photo réelle en atelier**, avec l'accord des personnes (V1), avant la mise en ligne ? Sans elle, le héros garde votre portrait et la carte Journée IA reste sans photo.
2. **Qui** : menez-vous vous-même chaque Journée IA et chaque appel ? De la réponse dépendent les phrases « Vous échangez directement avec Williams Jullin » et la légende du héros.
3. **Page AI Act dans le header** : acceptez-vous qu'elle soit **une ligne du menu « Nos prestations »** (recommandé : la barre reste à 4 onglets et tient dès 1 280 px) plutôt qu'un 5ᵉ onglet ?
4. **Footer** : peut-il passer du sombre au **gris chaud**, pour que la carte Journée IA reste le seul bloc sombre de la page ([d1]) ?
5. **Tarifs** : validez-vous la variante A (onglet « Tarifs ») **à la condition** que `/tarifs` soit d'abord alignée (Journée IA 1 490 € HT, Diagnostic gratuit, le reste sur devis, sans prix de formation tant que [d13] n'est pas tranché), et la variante B en attendant ?
