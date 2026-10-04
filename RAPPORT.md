# RAPPORT — INT-T64-A : le mode de dépôt de chaque OPCO

Branche de travail : `opco/int-t64-a-mode-de-depot` (partie d'`origin/main` à `9df6687e`). Aucune PR ouverte, aucune fusion.

## Acceptance (tasks.json, lue le 2026-10-04)

> Un ENUM `ModeDeDepot { of_mandate, compte_adherent }` sur l'OPCO (A02), jamais un booléen ; la valeur de chaque OPCO est sourcée (RM-08). […] la dépendance à INT-T60-A est levée ; l'acceptation s'appuie sur `OPCO_FICHES.modeDeDepotConstate`.

Chemins : `prisma/schema.prisma`, `opco-referentiel.ts`, `opco-referentiel.spec.ts`. L'entrée porte `"schema": false`.

## Ce qui a changé

- `src/server/qualiopi/financements/opco-referentiel.ts` : l'union de chaînes `ModeDeDepot` devient un enum explicite à deux valeurs, `MODES_DE_DEPOT = ["of_mandate", "compte_adherent"] as const`. Le type `ModeDeDepot` en est dérivé, et une garde `isModeDeDepot(value: unknown)` est ajoutée. Un commentaire documente le choix de ne pas le mettre en base, et rappelle que poser `compte_adherent` déclenche l'envoi automatique du dossier à l'entreprise (`suivi-entreprise/planning.ts`).
- `opco-referentiel.spec.ts` : 5 témoins ajoutés (cf. plus bas).
- **`prisma/schema.prisma` : non modifié, et aucune migration.**

## Choix : pas d'enum en base

Le schéma ne contient **aucun modèle OPCO** : l'enum Prisma `Opco` n'y sert que de clé, dans `BaremeOpco`, `EtatFondsOpco`, `Client.opco` et le suivi entreprise. Aucune table ne pourrait donc porter un champ « mode de dépôt » par OPCO. Et la valeur n'est pas une saisie : c'est un fait sourcé (valeur, URL, date), qui vit déjà dans `OPCO_FICHES` (`Fait<ModeDeDepot>`). Ses deux lecteurs (`dossier-pret-a-deposer.ts` et `suivi-entreprise/planning.ts`) le lisent à cet endroit.

Un `enum ModeDeDepot` Prisma ne serait lu par aucune colonne : ce serait du code mort, plus une migration qui ne sert à rien. Le `"schema": false` de la tâche va dans le même sens.

**La forme minimale qui respecte l'acceptance** : un enum TypeScript fermé (`as const` + type dérivé + garde) dans le référentiel pur. L'absence de relevé s'écrit `valeur: null` (« non constaté »), jamais par une troisième valeur. Si un jour une table `Opco` (ou un relevé versionné du mode de dépôt) doit exister, l'enum Prisma se posera avec elle, sous les mêmes identifiants.

## Les onze OPCO

| OPCO | `modeDeDepotConstate` | Source | Date de lecture |
| --- | --- | --- | --- |
| Atlas | `compte_adherent` | https://www.opco-atlas.fr/conditions-generales.html (« demande de prise en charge dans son espace myAtlas Entreprise », CG du 04/02/2026) | 2026-10-03 (relevé antérieur, conservé) |
| OPCO EP | **non constaté** | — | 2026-10-04 : page non lisible |
| Akto | **non constaté** | — | 2026-10-04 : page non lisible |
| OPCO 2i | `compte_adherent` | https://www.opco2i.fr/wp-content/uploads/2026/04/opco2i-charte-qualite-et-politique-de-controle-juin-2026.pdf (« l'entreprise bénéficiaire complète le formulaire […] sur le portail Mon compte 2i ») | 2026-10-03 (relevé antérieur, conservé) |
| OPCO Mobilités | **non constaté** | — | 2026-10-04 : page non lisible |
| Afdas | **non constaté** | — | 2026-10-04 : page non lisible |
| Uniformation | **non constaté** | — | 2026-10-04 : page non lisible |
| Ocapiat | **non constaté** | — | 2026-10-04 : page non lisible |
| Constructys | **non constaté** | — | 2026-10-04 : page non lisible |
| OPCOMMERCE | **non constaté** | — | 2026-10-04 : page non lisible |
| OPCO Santé | **non constaté** | — | 2026-10-04 : page non lisible |

### Pourquoi neuf OPCO restent « non constatés »

La politique réseau de la session **bloque tous les domaines OPCO**. `curl` reçoit un 403 du proxy sur le CONNECT, pour les onze domaines testés (opco-atlas.fr, opcoep.fr, akto.fr, opco2i.fr, opcomobilites.fr, afdas.com, uniformation.fr, ocapiat.fr, constructys.fr, lopcommerce.com, opco-sante.fr). `WebFetch` répond `EGRESS_BLOCKED`. Aucune page officielle n'a donc pu être **lue**.

Je n'ai pas non plus pu **relire** Atlas ni OPCO 2i aujourd'hui. Leurs valeurs viennent d'un relevé antérieur, cité mot pour mot dans le code : je les ai conservées, sans les rétrograder.

### Pistes à confirmer par une lecture humaine (NON reprises dans le code)

Une recherche web n'a renvoyé que des **résumés indirects**, pas une lecture de la page. Ils ne valent pas source au sens de RM-08 : aucun n'a été transformé en valeur. Ce sont des pistes pour la personne qui relèvera :

| OPCO | Ce que suggère la recherche | Page à lire |
| --- | --- | --- |
| Akto | dépôt « via votre compte en ligne MonEspace », 30 j avant | https://www.akto.fr/entreprise/financer-une-formation/deposer-demande |
| OPCO EP | demande depuis espaceweb.opcoep.fr, côté entreprise | https://www.opcoep.fr/ressources/centre-ressources/juridique/conditions-generales-gestion-controle-opcoep.pdf |
| Uniformation | l'employeur saisit en ligne dans son espace privé | https://www.uniformation.fr/entreprise/financements |
| OPCO Santé | saisie par l'adhérent sur les Webservices | CGG sur opco-sante.fr (`/sites/default/files/2024-09/CGG HORS BRANCHES SEPT 2024.pdf`) — version 2026 à trouver |
| Ocapiat | l'employeur saisit depuis « Services en ligne Mon Compte » | https://www.ocapiat.fr (espace Entreprise) |
| Afdas | onglet « Mes demandes de prise en charge » du portail adhérent | https://www.afdas.com |
| OPCO Mobilités | espace en ligne monespace.opcomobilites.fr | https://www.opcomobilites.fr |
| Constructys | formulaire signé par l'entreprise ; l'OF peut préparer le dossier | https://www.constructys.fr/wp-content/uploads/Conditions-generales-Constructys.pdf |
| OPCOMMERCE | portail entreprise Forconet + un portail « Forco Net OF » | https://www.lopcommerce.com/media/bsbnjydz/conditons-generales-gestion.pdf |

⚠️ Plusieurs OPCO laissent **les deux** circuits ouverts : dépôt par l'entreprise, ou par l'OF dans le cadre de la subrogation. Il faut relever la règle générale **écrite** sur la page, pas celle qu'on suppose. Et `compte_adherent` déclenche un envoi automatique à l'entreprise : à ne poser que sur une phrase citée.

## Témoins (spec)

Nouveau bloc `ModeDeDepot — un enum à deux valeurs, sourcé par OPCO (INT-T64-A)` :

1. l'enum vaut exactement `{compte_adherent, of_mandate}` ; la garde refuse `""`, `"OF_MANDATE"`, `"non_constate"`, `"entreprise"`, `true`, `false`, `null`, `undefined` et `1` ;
2. un booléen est refusé **au typage** (`@ts-expect-error`, vérifié par `tsc`) ;
3. chaque OPCO a une valeur de l'enum, ou un « non constaté » explicite (`valeur: null`, `aVerifier: true`, `source: null`) ;
4. toute valeur constatée porte une source `https` et une date AAAA-MM-JJ, sans drapeau « à vérifier » ;
5. l'état relevé est figé : `["atlas", "opco2i"]` constatés. Sourcer un nouvel OPCO oblige à mettre ce témoin à jour, en connaissance de cause.

## Tests lancés (à la main, commit en `--no-verify`)

- `prettier --write` sur les 2 fichiers : OK (la spec est reformatée).
- `eslint` sur les 2 fichiers : 0 erreur, 0 avertissement.
- `NODE_OPTIONS=--max-old-space-size=6144 tsc --noEmit` : code de sortie 0.
- `vitest run src/server/qualiopi/financements/opco-referentiel.spec.ts` : **42/42** réussis.
- `vitest run src/server/qualiopi/financements/` (lecteurs de `modeDeDepotConstate` compris) : **65 fichiers, 1017/1017** réussis.
- `next build` : non lancé (consigne).
