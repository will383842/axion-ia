# P7 · Moteur d'opportunités (pur)

## But

Premier morceau « analyse » du pilotage SEO/GEO : un module pur qui repère, à partir de données Search Console déjà lues, les pages et requêtes où un travail rapporterait des clics. Il ne lit ni la base ni le réseau et n'est branché nulle part (lecture Prisma prévue dans P4/P8).

## Fichiers (tous nouveaux, `src/server/seo-pilotage/opportunites/`)

- `detecteurs.ts` : détecteurs a à f (quasi-gagnante, CTR anormal, requête sans page dédiée, cannibalisation, déclin, jamais affichée), seuils exportés dans `SEUILS`.
- `courbe-ctr.ts` : courbe CTR du site, marque exclue, régression isotone ; en veille sous 3 tranches valides ; aucune attente hors du domaine mesuré.
- `wilson.ts`, `intention.ts` (règles FR, texte non trié, homonymes de villes), `score.ts` (gain × confiance / effort), `garde-fous.ts` (`CHEMINS_PROTEGES`, aucune variante « changer d'URL », filtre Grenoble, interdits de publication), `analyser.ts` (point d'entrée, dédoublonnage, tri), `types.ts`, `index.ts`.
- Réutilise `construireCarte` / `normaliserUrl`, `evaluerSujetCible`, `detecterInterdits`.

## Tests

7 fichiers Vitest, 76 tests : bornes 4,9 / 5 / 10 / 10,5 / 20 / 20,1 ; Wilson 0/40 ; saisonnalité N−1 ; « tarif formation IA Lyon » transactionnelle + drapeau local ; NaN sans signal ; URL brutes ; propriété « aucune sortie avec grenoble, nouvelleUrl ou changer_url » ; verrou des chemins protégés contre les `page.tsx` qui importent pricing / legal / journee-ia-commun / positionnement. `tsc` : aucune erreur dans le module ; ESLint propre.

## Points à connaître

- **Interface locale** : `TypePage` est défini localement dans `types.ts` (P3 n'était pas disponible). À remplacer par l'import de P3 à l'intégration.
- **Pages dynamiques** : `/formations` et `/implantations` ne sont protégées qu'en exact ; `/formations/[slug]` et `/implantations/[region]/[ville]` restent optimisables. Choix provisoire, **à arbitrer par Will**, comme `blog/[slug]`.
- Le verrou ne voit que les imports directs de `page.tsx` ; `/formations/tarifs` (via le catalogue) est ajoutée à la main.
- Une requête portant un interdit de publication (OPCO, CPF, Qualiopi…) est écartée en silence, même sur une page existante : prudence légale voulue.
- Wilson à z = 1,645 (prudent), efforts hors spec (inspection = 1) et facteurs de confiance : arbitraires, à calibrer sur 8 semaines.
- Non traité : ville en fin de requête sans préposition (« formation ia nice ») classée inconnue pour les trois homonymes `nice`, `tours`, `orange`.
- **Environnement** : `node_modules` était absent malgré la consigne ; `pnpm install --frozen-lockfile --ignore-scripts` lancé en local pour vérifier. Client Prisma non généré (erreurs `tsc` hors périmètre).

## Risques

Aucun : module neuf, non importé, aucune migration, aucun frontend.

## Relecture

Deux tours Opus. Tour 1 : 4 points bloquants (URL brutes, périmètre protégé, catégorie legal, NaN) corrigés. Tour 2 : une régression (`/formations/tarifs`) et quatre points mineurs, corrigés.

VERDICT OPUS : BON
