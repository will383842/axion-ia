Chaîne éditoriale : mesures C1 (blocage et coût) et audit C2b du corpus publié, en lecture seule

## Ce que fait cette PR

Deux outils de mesure, sans migration, sans écriture en base, éteints par défaut (on les lance à la main).

**C1 : taux de blocage et coût réel (30 jours)**
- Lit `ContentGenJob.outputJsonRaw` (journal d'équipe, contrôles) et `GenerationLog.metadata.causes`.
- Donne : le taux de blocage par contrôle (plagiat, intention, plan trop proche, doctrine, doublon sémantique, bénéfice, chaque barrière), le coût par article (moyenne, médiane, p90, max) et par rôle.
- Commande : `pnpm tsx scripts/content-gen/rapport-blocage-cout.ts [jours] [--json]`
- Un tier 3 posé par un générateur n'est pas compté comme un blocage ; un coût absent est signalé, pas caché.

**C2b : audit du corpus publié**
- Articles : faible valeur (mots, score), sans impressions Search Console (90 jours, un seul appel groupé), doublons de plan (titres H2 quasi identiques, en grappes).
- Pages villes : seulement « sans impressions », sur les villes indexables. Leur texte affiché vient du code (`journee-ia-locale`), pas de la base : on n'invente donc ni nombre de mots ni plan pour elles.
- Résultat : des signalements pour un humain. Aucun noindex, aucune suppression, aucune fusion : le type de signalement n'a même pas de champ « action ».
- Commande : `pnpm tsx scripts/content-gen/audit-valeur-corpus.ts [--json]`
- Si Search Console ne répond pas, « sans impressions » n'est pas calculé et le rapport le dit.

## Non fait
- Pas d'écran console : les deux rapports sortent en script. À ajouter dans une PR suivante si besoin.
- Plafond de 5000 lignes par lecture : si atteint, un avertissement est écrit.

## Vérifications
- `pnpm typecheck` : propre. 25 tests unitaires des modules purs : verts.
- Aucun fichier interdit touché, aucune migration.
- Fusion de `origin/main` (sans conflit). `pnpm typecheck` propre ; 30 tests verts (3 fichiers) sur `content-gen/mesures`.
- Relecture Opus n°1 : « à corriger » (tier 3 compté à tort, texte de page ville non affiché, plafonds muets, coûts absents) : corrigé.
- Relecture Opus n°2 : « à corriger » (villes lues depuis la table `City`) : corrigé en lisant les données du site, comme le sitemap.
- Relecture Opus n°3 (dernier correctif de villes + fusion) : « à corriger », 5 points, corrigés :
  - **Pages noindex** : un article non `tier_1_indexable` n'est plus signalé « sans impressions » (0 par construction, jamais proposé à Google). La règle est tenue par le module pur et par le chargeur.
  - **Médiane** : moyenne des deux valeurs centrales quand le nombre d'articles est pair (elle était sous-estimée).
  - **Plafond** : lecture de LIMITE + 1 ; l'avertissement « PARTIEL » n'apparaît que s'il y avait réellement plus de lignes.
  - **Libellé du coût colonne** : dit exactement quels jobs sont exclus (en file, en génération, contrôle qualité, échec, annulés). Le coût réel est donc minoré de la dépense des jobs en échec : limite connue, annoncée dans le rapport.
  - **Test** de lecture du corpus (villes = villes indexables du site, mêmes adresses que le sitemap ; noindex ; `stub.invalid`).
- Relecture Opus n°4, sur le code final (commit 143932cbb) : rien de bloquant. Deux remarques mineures non traitées : le libellé du coût ne dit pas que `quality_improving` et les quarantaines sont inclus ; si Search Console répond mais qu'aucune page n'est indexable, le rapport dit « n'a rien répondu » (cas impossible en pratique, les pages villes sont toujours indexables).
- Lecture seule, aucune migration, aucun fichier interdit.

VERDICT OPUS : BON
