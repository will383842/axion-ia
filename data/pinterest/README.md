# Épingles Pinterest : lot à importer dans le Studio

Toute publication passe par le calendrier du Studio (import en lot, puis « Valider ce lot »). Aucun envoi direct à Pinterest.

## Fichier à importer

`lot-studio-60.json` : 60 épingles (30 du lot 1, 30 du lot 2) au format v1 du Studio (`{ "version": 1, "epingles": [...] }`, voir `src/domaine/epingles/format-lot.ts`, branche `feat/pinterest-pr6`).

- Clés : `titre`, `description`, `url`, `tableau` (un seul), `texteAlternatif`, `contenuIA` (`false`), `image` (nom du fichier).
- Images : les 30 premières épingles sont dans `images/` (.jpg), les 30 suivantes dans `images-lot2/` (.png). Toutes sont en 1000 x 1500 (ratio 2:3).
- Contrôle : `node data/pinterest/outils/valider-lot-studio.mjs` doit afficher `60/60 valides`. Le script reprend les règles du Studio (schéma strict, titre 100, description, texte alternatif 500, lien sur le domaine exact, mots interdits sur titre, description, texte alternatif et lien).

## Ce qui a changé par rapport aux premières versions

- `epingles-30.json` et `epingles-lot2.json` sont conservés comme archives de travail : ne pas les importer (format refusé, textes alternatifs décrivant d'anciennes photos, 9 liens par lot contenant un mot interdit).
- `import-pinterest-lot2.csv` est retiré : il contournait le Studio (heures différentes de la cadence, pas de texte alternatif ni de mention IA, images servies depuis une autre branche).
- 9 épingles par lot ont été remplacées parce que le lien contenait un mot interdit à l'envoi. Elles pointent vers d'autres articles du blog (2 épingles par article, comme le reste). Les images de ces 18 épingles reprennent la même photo libre, avec un nouveau titre ; `credits-photos.csv` suit les nouveaux noms de fichiers.
- Les textes alternatifs décrivent la photo réelle de l'image verticale et reprennent le titre inscrit dessus.

## Corrections du 2e tour (relecture du contenu)

- 4 épingles (2 articles) retirées parce que les articles figurent dans `SLUGS_EXCLUS_TEMOIGNAGE` (`src/server/crible-stock/exclusions.ts`) : remplacées par `3-quick-wins-ia-operationnels-2026` et `definition-prompt-engineering-audit-entreprise-sarcelles` (2 épingles chacun, même photo, nouveau titre). Aucune des 60 épingles ne pointe plus vers un slug de cette liste.
- Liens : le site n'était pas joignable depuis la session (proxy 403, `curl` renvoie 000). Les 30 slugs ont donc été confirmés dans le dépôt (manifeste `src/content/og-blog-manifest.ts`, audit GEO du 14/08, `public/og/blog/`). 19 articles non confirmés par ce moyen ont été remplacés par des articles confirmés (38 épingles, tableau « Former ses équipes à l'IA », même photo, nouveau titre). Le code HTTP réel (200, sans redirection) reste à contrôler avant « Valider ce lot ».
- Lot 1 n°18 : la photo montrait une étiquette « 5.99 » ; remplacée par une photo de convoyeur déjà présente sur la branche (lot 2, ancien n°7), texte alternatif réécrit.
- Titres et descriptions des épingles remplacées s'appuient sur l'adresse et le sujet des articles (non relus).

## Tableaux et sections

Le format du Studio n'accepte qu'un nom de tableau et refuse toute autre clé : il n'y a pas de champ « section ». Les épingles prévues pour une section sont donc placées sur le tableau parent. Les sections visées, à rattacher à la main sur Pinterest si on le souhaite :

| Lot.n° | Tableau (importé) | Section visée |
| --- | --- | --- |
| 1.8, 2.8 | L'IA par métier et par secteur | IA en ressources humaines |
| 1.12, 1.26, 2.12, 2.26 | L'IA par fonction | RH |
| 1.18, 2.18 | L'IA par fonction | service achats |
| 1.22, 2.22 | L'IA par fonction | commerciaux et vente |

Les autres épingles gardent le premier tableau de leur liste d'origine ; les seconds tableaux ne sont pas repris (la même image sur un second tableau est refusée comme doublon par le Studio).

## À vérifier avant l'import

- Les noms de tableaux doivent être exactement ceux des tableaux publics relevés au dernier « Tester » du Studio.
- Les 18 épingles remplacées visent des articles dont le texte n'a pas pu être relu depuis cette session (le site n'était pas joignable) : titres et descriptions s'appuient sur l'adresse et le sujet de l'article. Une relecture rapide est prudente avant « Valider ce lot ».
