# Carte de France des collaborateurs (équipe F5)

## Quoi

- `CarteFrance` : composant serveur, SVG inline, zéro JavaScript, aucune bibliothèque. Il reçoit une liste de collaborateurs déjà filtrée (publiés et affichés sur la carte).
- Fond de carte : contour de la France métropolitaine et de la Corse en un seul tracé (`fond-france.ts`, 3,7 Ko brut, environ 1,4 Ko gzip). Source : IGN Admin Express, licence ouverte Etalab (indiquée dans le fichier). Le tracé est généré une fois par `tools/equipe/generer-fond-france.mjs`.
- Un lien par personne vers sa fiche : forme et couleur de sa catégorie, cible de 12 de rayon, `<title>` et `aria-label` identiques (« nom, catégorie, ville »), anneau de focus mocha, agrandissement au survol par `transform` (pas de décalage de mise en page).
- Plusieurs personnes dans la même ville : couronne de points. Au-delà de 6 : un point « +N » qui mène à la liste. Les villes très proches (Île-de-France) sont regroupées pour que les cibles ne se recouvrent pas.
- Encart outre-mer en bas à gauche, seulement si quelqu'un y est.
- Légende (forme, couleur, libellé, nombre) et liste équivalente par région puis ville, chaque nom étant un lien HTML.
- Williams Jullin n'a jamais de point (exclu même s'il est passé en entrée) ; Manon non plus. Couleurs : terracotta, ocre, sauge, prune, mocha ; pas de bleu.
- `FormeCategorie` reçoit une prop optionnelle `contour` (contour ivoire des points).

## Pourquoi

Montrer où sont les collaborateurs sans JavaScript, de façon lisible au clavier et au lecteur d'écran, avec un poids minimal.

## Reste à faire (hors de cette PR)

- **Le branchement dans le hub n'est pas fait** : `src/app/[locale]/equipe/page.tsx` n'existe pas encore sur `main`. Il faudra mettre `<CarteFrance fiches={...} idTitre="…" />` sous le H2 « Où sont les collaborateurs d'Axion-IA » (section affichée seulement s'il y a au moins un point ; le composant ne rend rien sans point) et passer le jeu de villes (`villes`) pour une position exacte ; sans lui, la position est celle du chef-lieu du département.
- **Le générateur est dans `tools/equipe/`, pas dans `scripts/equipe/`** : `scripts/` est en lecture seule dans l'environnement où cette PR a été écrite. À déplacer (`git mv`) en mettant à jour le chemin cité dans les deux fichiers.
- Limite connue : sur petit écran, une cible SVG fait moins de 24 px ; la liste équivalente, sur la même page, offre des cibles pleines.

## Comment vérifier

- `pnpm vitest run src/components/equipe` : 54 tests (projection de Brest, Strasbourg, Perpignan, Nice, Lille, Ajaccio ; couronne ; « +N » ; exclusion de Williams ; rendu HTML : titres, aria, liens ; poids du fond).
- `tsc --noEmit` et eslint passent (le typecheck demande `NODE_OPTIONS=--max-old-space-size=10240` ici).
- Régénérer le fond : `pnpm exec tsx tools/equipe/generer-fond-france.mjs`.

## Mesures

- Fond : 3 658 octets bruts, 1 435 octets gzip (cibles : 6 Ko et 2,5 Ko).
- Aucun JavaScript client ajouté ; aucune page touchée, donc `pnpm bundle:check` non lancé.
- CLS : conteneur en `aspect-ratio` réservé, `viewBox` fixe.
- Les tests de logique ont été écrits en même temps que le code (pas d'étape « rouge » d'abord).
- Branche partie de `feat/equipe-f2-briques` (F2 était absente de `main` au départ), puis `origin/main` fusionnée ; le conflit sur `FormeCategorie.tsx` est résolu en gardant la prop `contour`. `pnpm-lock.yaml` inchangé.
- Relecture Opus (accessibilité, poids, exactitude) : un problème grave (intitulé et ancre d'un point regroupant plusieurs villes), deux moyens (cibles superposées en Île-de-France, landmarks de région) et deux mineurs (code département à un chiffre, largeur de l'encart) : tous corrigés. Pas de second tour.

VERDICT OPUS : BON
