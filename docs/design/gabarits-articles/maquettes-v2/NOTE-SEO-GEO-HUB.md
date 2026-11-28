# Note SEO / GEO : accueil du blog et pages de catégorie (maquettes v4)

Fichiers : `hub-blog.html` (`/fr/blog`) et `hub-categorie.html` (`/fr/blog/categorie/blog-implementations-ia`). Maquettes statiques, `noindex` : en production, les valeurs indiquées en commentaire dans le `<head>` remplacent celles de la maquette.

## 1. Intention de recherche
| Page | Intention | H1 |
|---|---|---|
| Accueil du blog | « ressources IA pour dirigeants de TPE et de PME » (informationnelle, large) | L’IA expliquée aux dirigeants de PME et de TPE |
| Catégorie | le service concerné (ici : mettre l’IA en place dans une PME) | Implémentation IA : mettre l’IA en place dans une PME |

Un seul H1 par page. Hiérarchie : H2 par bloc (À la une, Derniers articles, Les articles par prestation, Explorer…, Pour aller plus loin, Questions fréquentes), H3 par prestation / question, H4 pour les cartes imbriquées dans une prestation.

## 2. Paragraphe d’introduction citable
`<p id="axion-direct-answer" data-speakable>` juste sous le H1 : définition (ce que publie le blog), à qui il s’adresse (dirigeants de TPE et de PME, partout en France), comment il est classé (cinq prestations), ce que contient chaque article. Il est repris mot pour mot dans `CollectionPage.abstract` et dans `speakable`. Date « Mis à jour le » visible, identique à `dateModified`.

## 3. JSON-LD (un seul `@graph` par page)
- `Organization` (`https://axion-ia.com/#organization`) et `WebSite` : en production, simples références par `@id` (nœuds minimaux dans la maquette).
- `CollectionPage` : `url`, `name` = H1, `abstract`, `dateModified`, `isPartOf`, `publisher`, `breadcrumb`, `mainEntity` → `ItemList`, `speakable`.
- `ItemList` : tous les articles visibles, dans l’ordre d’affichage, chacun une seule fois (`position`, `url`, `name`). Page N : les positions continuent (décalage).
- `BreadcrumbList` : Accueil › Blog ; catégorie : Accueil › Blog › Catégories › Implémentation IA ; page N : … › Page N.
- Pas de `FAQPage` tant que les réponses ne sont pas définitives.

## 4. Crawl, pagination, doublons
- Tout est en vrais `<a href>` : filtres, cartes, secteurs, tailles, pagination. Recherche = formulaire GET `/fr/recherche?q=`. Zéro JavaScript.
- Canonical autoréférent par page : `/fr/blog`, `/fr/blog/page/N`, `/fr/blog/categorie/<slug>`, `/fr/blog/categorie/<slug>/page/N`. Jamais vers la page 1. `rel="prev"` / `rel="next"` en complément (Google ne s’en sert plus, d’autres moteurs oui).
- Pages N : fil d’Ariane, H1 « … , page N », une phrase, filtres, grille, pagination. Ni une, ni sections, ni FAQ, ni lettre : pas de contenu dupliqué.
- Hub et catégories : un article n’apparaît qu’une fois par page. Le hub montre 2 à 3 cartes par prestation puis renvoie vers la catégorie, qui porte la liste complète.
- hreflang `fr` + `x-default` (EN désactivé, `EN_LOCALE_ENABLED`). Flux RSS déclaré.

## 5. Web Vitals
- Image de la une : `fetchpriority="high"` + `<link rel="preload" as="image">`, sans lazy. Toutes les autres : `loading="lazy"`.
- `width` / `height` sur chaque image + cadre `aspect-ratio: 16/10` : CLS = 0. Aucune injection au-dessus du contenu.
- CSS d’environ 16 Ko, deux polices (Fraunces, Manrope) avec repli métrique en production, aucun JavaScript.

## 6. Ce que le code peut produire aujourd’hui, et les écarts
1. `/blog/secteur/*` et `/blog/taille/*` existent en code mais ne génèrent aucune page tant que `BLOG_POSTS = []` et `dynamicParams = false` : les liens donneraient un 404. À n’exposer qu’une fois les routes alimentées par la base.
2. `/blog/categorie/[slug]/page/[num]` **n’existe pas** : la catégorie liste tout avec un filtre côté client. À créer (404 net hors bornes). La pagination de l’accueil (`/blog/page/[num]`) existe déjà.
3. `category-mapper.ts` affiche « Audits IA », « Coaching 1-to-1 », « Sites web & SaaS IA » ; la navigation dit Audit IA, Coaching IA, Sites web IA. La maquette suit la navigation : aligner `blogCategoryLabel` sans changer les slugs.
4. Les abstracts actuels du code parlent de « ROI » et de « grands groupes » : ne pas les reprendre.
5. `/blog/service/*` doublonne les catégories : non montré.

6. Les routes `/fr/lettre` (inscription) et `/fr/prestations` n’existent pas : la maquette ouvre « Nos prestations » par un bouton (méga-menu du vrai site) et laisse l’action du formulaire à brancher sur la route d’inscription réelle.

## 7. Articles et images de la maquette
Les articles marqués en démonstration (titres, dates) ne sont pas publiés. Les visuels cassés seront réels en ligne ; seuls des visuels sans chiffre ni promesse sont référencés quand ils existent.
