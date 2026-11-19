# Données par ville : sources fiables à brancher (plan, rien n'est branché)

> Chantier 4, vague 3 (2026-11-11, accord de Williams). Ce document est un **plan**. Il ne
> branche aucune source, n'écrit rien en base et ne change aucune page. Chaque étape ci-dessous
> sera une PR séparée, derrière un interrupteur d'environnement **éteint par défaut**.

## 1. État actuel (vérifié sur `main` le 2026-11-11)

| Fait                                                                                                                                                                                                                                          | Où                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Les faits locaux d'environ 2 000 villes sont produits par le modèle à partir de sa **mémoire d'entraînement** (`source = "claude-knowledge:wikipedia-pretraining"`), sans vérification une à une.                                             | `src/server/content-gen/generators/landing-ville-economic-data.ts` l.3-9 |
| Le prompt demande pour `statsInsee.etablissementsActifs` un **« ordre de grandeur plausible »** : c'est donc un chiffre estimé, pas un chiffre INSEE.                                                                                         | même fichier, l.253 et l.297                                             |
| 42 villes ont des données écrites à la main.                                                                                                                                                                                                  | `src/content/villes/economic-data/*.ts`                                  |
| Le RAG (`kbRetrieve`) n'alimente que le **ton et la doctrine** du texte de ville, pas les faits locaux.                                                                                                                                       | `src/server/content-gen/generators/ville-hub-copy.ts` l.~616-633         |
| 2 160 fichiers `src/content/villes/copy/*.ts` sont servis **avant** la base (`GeneratedVilleCopy`) : un fait faux écrit là s'affiche tel quel.                                                                                                | `src/content/villes/resolve-with-copy.ts`, priorité 1 puis 2             |
| Des phrases fausses de présence physique et d'anciens prix y ont été trouvées. Elles sont en cours de retrait, avec un verrouillage par tests : #1862 (présence physique), #1909 (prix 990), #1911 (lot 1 « Nos consultants viennent de X »). | `tests/unit/content/villes-*.spec.ts`                                    |

**Risque principal** : un nom d'entreprise, d'école, de zone d'activité ou un chiffre inventé
par le modèle, publié sur une page indexée. Le prompt « anti-invention » réduit ce risque mais
ne le supprime pas.

## 2. Principe

Remplacer la mémoire du modèle par des **données ouvertes publiques, datées et citées**, champ
par champ. Le modèle ne sert plus qu'à **rédiger** à partir de faits fournis. Il ne doit plus
**fournir** les faits. Tout fait affiché porte sa source et sa date. Un champ sans source
fiable reste **vide** plutôt qu'estimé.

## 3. Sources gratuites, champ par champ

Les sources ci-dessous sont des services publics ou des jeux de données ouverts (Licence
Ouverte Etalab, sauf mention). Les adresses exactes et les limites d'appel sont **à revérifier
au moment du branchement**, car elles changent.

| Champ `VilleEconomicData`                          | Source fiable                                                                                                                                                | Remarque                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Code INSEE, population, département, région        | API Découpage administratif (`geo.api.gouv.fr`) + populations légales INSEE                                                                                  | Remplace aussi les populations saisies à la main                                    |
| `statsInsee.etablissementsActifs`, `topSectorsNaf` | **Stock Sirene** (fichier open data mensuel, établissements actifs), agrégé par commune et par division NAF ; à défaut, l'API Sirene de l'INSEE              | Comptage exact, daté au mois du fichier ; on n'utilise plus d'« ordre de grandeur » |
| `grandsGroupesImplantes`                           | Stock Sirene : établissements de la commune dont l'unité légale est de catégorie **GE/ETI** (variable `categorieEntreprise`) et de tranche d'effectif élevée | Aucun nom qui ne figure pas dans Sirene                                             |
| `zonesActivitesParcs`                              | Données ouvertes des collectivités et du Cerema (inventaire des zones d'activité économique, loi Climat et résilience), quand elles sont publiées            | Couverture inégale : vide si absent                                                 |
| `grandesEcolesEtUniversites`                       | Annuaire des établissements de l'enseignement supérieur (`data.enseignementsup-recherche.gouv.fr`)                                                           | Filtrer sur la commune de l'implantation                                            |
| `polesRechercheRD`                                 | Même portail (structures de recherche, répertoire national des structures de recherche)                                                                      |                                                                                     |
| `polesCompetitivite`                               | Liste officielle des pôles de compétitivité (phase V), publiée par l'État                                                                                    | Rattachement par région, pas par commune                                            |
| IGP / AOP / AOC, vignobles                         | Données ouvertes de l'INAO (aires géographiques par commune)                                                                                                 |                                                                                     |
| Labels EPV                                         | Liste publique des Entreprises du Patrimoine Vivant                                                                                                          | Recouper le SIREN avec Sirene                                                       |
| Gare TGV, aéroport, distances                      | Open data SNCF (gares de voyageurs) + Base Adresse Nationale (coordonnées) ; distance calculée, jamais devinée                                               | Distance à vol d'oiseau, affichée comme telle                                       |
| Communes du bassin                                 | Zonages INSEE (zone d'emploi, bassin de vie) par code commune                                                                                                | Remplace « rayonnement local » estimé                                               |

**Sources exclues** : toute source payante, le scraping de moteurs de recherche, LinkedIn, les
annuaires privés. Ce sont les mêmes règles que le module Prospection, qui consomme déjà
`recherche-entreprises.api.gouv.fr` (`src/server/registre-entreprises/annuaire.ts`).

## 4. Architecture proposée (à faire valider avant tout code)

1. **Collecte hors ligne, jamais au rendu.** Un script `scripts/villes/donnees-ouvertes/*.ts`
   télécharge les fichiers ouverts, agrège par code INSEE et écrit un fichier versionné
   `src/content/villes/open-data/<slug>.json`. Ce fichier contient, pour chaque fait :
   `{ valeur, source, url, dateMillesime }`. Rien n'est écrit en base de production.
2. **Interrupteur `VILLES_DONNEES_OUVERTES`** (`true` / `essai` / absent = éteint), sur le modèle
   de `DOSSIER_BALAYAGE_ENABLED` dans `src/env.ts`. Sur `essai`, la génération lit les deux
   sources et journalise les **écarts** entre la mémoire du modèle et les données ouvertes, sans
   rien changer. Sur `true`, les données ouvertes remplacent les champs couverts. Le retour en
   arrière se fait en éteignant l'interrupteur.
3. **Générateur** : `landing-ville-economic-data.ts` reçoit les faits ouverts en entrée. Le
   prompt passe de « produis » à « rédige à partir de ces faits seulement ». Un champ absent
   reste vide.
4. **Précédence inchangée pour les 2 160 fichiers `copy/`.** Ils restent prioritaires. Une PR
   par lot les recalera sur les faits ouverts, avec un test qui compare chaque nom d'entreprise
   cité à la liste Sirene de la commune.
5. **Affichage** : une mention de source discrète sous le bloc « économie locale » (« Source :
   INSEE, fichier Sirene, octobre 2026 »). À arbitrer par Williams.

## 5. Ordre des PR (une PR = un sujet, chacune < 600 lignes)

1. Script de collecte Sirene (comptages par commune et par NAF) + test sur un extrait
   d'échantillon versionné. Aucun branchement.
2. Interrupteur éteint + mode `essai` (rapport d'écarts), sans effet sur les pages.
3. Lecture du rapport d'écarts par Williams, puis décision d'allumer champ par champ.
4. Sources secondaires (enseignement supérieur, INAO, SNCF/BAN, zonages INSEE), une par PR.
5. Recalage des fichiers `copy/` par lots, avec un test « aucun nom hors Sirene ».

## 6. Garde-fous

- Aucun import ni écriture en base de production depuis une routine ou une PR. La collecte
  produit des fichiers versionnés, relus en PR.
- Le budget de bundle n'est pas concerné : les données sont lues côté serveur au rendu statique.
- Contrat de build `stub.invalid` (ADR 0026) : la collecte ne s'exécute jamais pendant `next build`.
- Aucun fait estimé n'est affiché comme un chiffre officiel. Un comptage Sirene porte son mois.
- Les textes générés restent soumis aux règles éditoriales : aucune présence locale fictive,
  Journée IA 1 490 € HT comme seul prix affiché, aucun autre montant.
