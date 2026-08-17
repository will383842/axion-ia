# 2026-08-14 — CGV : clauses limitatives, renvoi sur le devis, verrou consommateur

## Le point de départ

Les CGV publiées sur `/conditions-generales` sont annexées à la convention de
formation, à la convention tripartite et au contrat de formation. C'est le seul
texte qui limite la responsabilité d'Axion-IA sur les prestations **hors
formation** — audit, implémentation, site web, coaching.

Or elles avaient été écrites pour un organisme de formation. Les risques propres
aux autres prestations n'y figuraient pas : intervention dans les systèmes du
Client, dépendance à des fournisseurs tiers (modèles, API, hébergeurs), contenus
produits par des systèmes probabilistes.

## Les trous comblés

Sept sections ajoutées ou réécrites dans `src/content/legal.ts`, chacune
répondant à un risque nommé (le commentaire au-dessus de chaque section dit
lequel, et pourquoi la rédaction précédente ne le couvrait pas) :

| Section                                                 | Trou comblé                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exécution et délais                                     | Un retard restait indemnisable au droit commun (art. 1231-1 C. civ.). Désormais : délais indicatifs, ni pénalité ni indemnité ni résolution, sauf retard > 60 j imputable à Axion-IA après mise en demeure restée sans effet 30 j.                                                     |
| Sauvegarde préalable et sécurité des systèmes du Client | Rien ne traitait la sauvegarde ni la sécurité des SI du Client, alors que l'offre comprend des interventions **dans** ses systèmes.                                                                                                                                                    |
| Services, technologies et fournisseurs tiers            | La force majeure ne les couvre pas : l'art. 1218 C. civ. exige l'imprévisibilité **et** l'irrésistibilité, qu'une hausse tarifaire d'API ou une dépréciation de modèle n'ont pas — alors que ce sont les événements les plus probables.                                                |
| Nature probabiliste des systèmes d'IA                   | Le Client ne reconnaissait nulle part que le résultat peut être faux. « Le résultat était faux » n'a pas la même portée selon que le contrat l'annonce ou non.                                                                                                                         |
| Propriété intellectuelle — garanties du Client          | La PI n'était traitée que dans le sens Axion → Client (cession des livrables). Rien sur le sens inverse : réclamation d'un tiers sur un contenu fourni par le Client ou généré par IA.                                                                                                 |
| Limitation de responsabilité — plafond et exclusions    | Le plafond existait **sans borne temporelle** : il grossissait indéfiniment sur une relation pluriannuelle. Borné aux 12 mois précédant le fait générateur, exclusions énumérées, renonciation réciproque.                                                                             |
| Délai de réclamation                                    | Aucune forclusion : une contestation restait recevable 5 ans (art. 2224 C. civ.), sur des prestations dont les traces techniques (logs, versions de modèles, état des systèmes du Client) ne survivent pas à cette durée. 90 j, réservé au professionnel, réservant dol et vice caché. |

Deux ajustements complémentaires : **force majeure** (sortie symétrique sans
indemnité au-delà de 60 j, au lieu du seul empêchement « définitif ») et
**garanties et responsabilité** (les chiffres commerciaux — ROI, gains, taux
d'automatisation — sont des estimations, y compris dans les supports de
présentation et les contenus du site).

## Trois décisions de rédaction

**1. Le risque est borné, pas supprimé.** Chaque clause laisse une porte : seuil
de 60 j + mise en demeure sur les délais, réserve dol / faute lourde / dommages
corporels sur le plafond, réserve dol / vice caché sur la forclusion. Entre
professionnels, une clause qui supprime tout recours est le premier angle
d'attaque au titre du déséquilibre significatif (art. L442-1 C. com.). Une
limitation qui tient vaut mieux qu'une exonération qui tombe.

**2. La renonciation est réciproque.** Sur le plafond, « chacune des parties y
renonçant réciproquement ». Une limitation unilatérale se plaide contre son
auteur ; une limitation mutuelle se constate.

**3. Le verrou consommateur énumère au lieu de renvoyer.** La section
« Particulier — clauses non opposables au consommateur » neutralise
**nommément** chaque clause limitative, plutôt que par une formule générale du
type « prévalent sur toute clause contraire ». Une exclusion implicite se
plaide, une exclusion énumérée se constate. Opposées à un consommateur, ces
clauses seraient abusives de plein droit (art. R.212-1 et R.212-2 C. conso.) —
et une clause abusive n'est pas seulement écartée : sa présence fragilise la
lecture de tout le contrat et expose à la sanction administrative de la DGCCRF.

> ⚠️ **Toute nouvelle clause limitative ajoutée aux CGV doit être ajoutée au
> verrou dans le même patch.** Le test `cgv-clauses-protectrices.spec.ts` porte
> la liste et rougit si l'une manque.

## Le devis ne renvoyait à AUCUNE CGV

Découverte de la session, et la plus coûteuse si elle était passée inaperçue :
la convention, la convention tripartite et le contrat de formation **annexent**
les CGV. Le devis, non. Le volet formation était donc couvert ; le canal des
prestations d'audit, d'implémentation, de site web et de coaching ne l'était
pas — c'est-à-dire précisément celles qui portent les risques ci-dessus.

Or des CGV n'ont d'effet que si le Client en a eu connaissance **avant** de
s'engager (art. 1119 C. civ.). Le renvoi doit donc figurer sur la pièce qu'il
**lit et signe**, pas dans un document séparé qu'on lui aurait éventuellement
transmis.

Dans `devis.tsx` :

- une ligne de renvoi dans le bloc légal, avec l'URL complète des CGV et la
  clause de primauté sur les conditions d'achat du Client ;
- le « Bon pour accord » couvre désormais les CGV **en plus** des montants :
  c'est le même geste qui accepte les deux ;
- dégradation propre si `identite.site` est vide (config Qualiopi non
  renseignée) : « communiquées sur simple demande », jamais une URL tronquée du
  type `/conditions-generales` qui ne mène nulle part sur un PDF imprimé.

**Leçon générale : vérifier chaque CANAL séparément.** Le raisonnement « les CGV
sont annexées au contrat » était vrai — et faux pour le document que le client
signe en premier.

## Le garde-fou

`src/content/__tests__/cgv-clauses-protectrices.spec.ts`, trois familles :

1. **Présence** de chaque clause protectrice — assertions sur le risque nommé,
   pas sur la formulation. Si la rédaction évolue, on adapte la regex ; on ne
   supprime pas le cas.
2. **Cohérence du verrou consommateur** — chaque clause limitative doit y être
   énumérée.
3. **Étanchéité** — 🔴 **aucun assureur nommé, aucun n° de police, dans aucun
   contenu destiné au client** : ni dans les CGV, ni dans les gabarits de
   documents contractuels. L'assureur change (appel d'offres, résiliation,
   changement de courtier) ; sur un support contractuel, une mention fausse se
   retourne contre son auteur. L'engagement tenu est « justifier sur demande ».

Une clause limitative qui disparaît d'un contenu ne casse **rien** : le site
compile, la page rend, les tests passent. Ce fichier est là pour qu'elle
rougisse. Le test d'étanchéité vérifie d'abord qu'il a bien trouvé le dossier
des gabarits (`fichiers.length > 5`) — sans quoi un chemin cassé le rendrait
vert à vide.

## Date de version

`LAST_UPDATED_ISO` passe à `2026-08-14` dans la page CGV, et l'affichage
lisible avec. 🔴 Cette date fait foi : l'intro des CGV y renvoie pour déterminer
la version applicable. La modifier sans toucher au texte antidate une version.

## Ce qui reste

- **Relecture avocat** sur les deux clauses les plus exposées : la forclusion
  90 j et le plafond 12 mois. Les réserves légales sont posées, mais l'arbitrage
  final sur les seuils est un choix de risque, pas un choix technique.
- Vérifier que les prochains canaux d'engagement (nouveau tunnel, nouveau PDF
  contractuel) portent bien le renvoi aux CGV — le devis avait été oublié.

## Incident de session

Le commit initial n'a jamais abouti : le hook `pre-commit` (lint-staged +
anti-siren + anti-hex + use-client + typecheck + gitleaks) a dépassé la limite
de 10 minutes d'avant-plan, et Claude Code s'est fermé avant la fin. Les
fichiers sont restés **stagés** sans commit — état trompeur, puisque
`git status` les affiche comme prêts.

Parade appliquée à la reprise : commit lancé en **processus détaché**, journal
dans le scratchpad, `Monitor` armé sur le fichier sentinelle de fin. Même
traitement pour le `git push`, dont le hook `pre-push` exécute la suite complète
(typecheck + i18n + zod + Vitest + pnpm audit).
