docs(seo-geo): conception de l'encart vidéo automatique « Regardez cette vidéo »

## Ce que fait cette PR

Elle ajoute un seul document, `docs/pilotage-seo-geo/CONCEPTION-ENCART-VIDEO.md`. Aucun code.
C'est le plan pour que le site choisisse, répartisse et retire tout seul une vidéo du Studio
dans nos contenus.

## Ce qu'il faut savoir

- Le chantier existe déjà des deux côtés (lots W1-W4 sur le site, S1-S4 dans le Studio). Il s'agit
  de refaire le **choix** de la vidéo, pas de tout reconstruire.
- **Blocage** : les deux contrats ne se parlent pas. Le Studio et le site n'utilisent pas les mêmes
  noms de champs, ni les mêmes longueurs, ni la même disposition des fichiers. Chaque envoi
  recevrait une erreur 422. Le plan recommande de suivre le contrat du site.
- « Validée » dans le Studio veut dire « validée pour les réseaux ». Une vidéo ne sert à
  l'encart que si elle a été envoyée au site (état « en ligne »).
- Aucune adresse publique stable n'existe encore pour les vidéos : geste de Will (seau R2 public).
- « Lecture au clic » contredit la règle écrite du composant (« jamais de lecteur dans l'article »).
  Trois options sont chiffrées ; la recommandée (A) mène au clic vers la page vidéo, sans JavaScript.
- Le plan dit honnêtement qu'un VideoObject sur une vidéo secondaire apporte peu et peut nuire.
- Deux chiffres du brief étaient périmés (cliquet public 294 KB, terracotta public #b23f16).
- Le mot « session f4 » n'existe pas dans le dépôt du Studio : la classe « à annoncer » suit la
  règle écrite du Studio (fichiers partagés), à confirmer par Will.

## Découpage proposé

Studio : S-0 à S-5 (contrat, vignettes, archivage qui retire, stockage public, branchement).
Site : E0 à E8 (bug « implémentations », répartiteur pur, migration, embeddings, file de travail,
console, rendu, villes, lecture sur place facultative).

## Non fait

Aucun code, aucune migration, rien allumé, rien envoyé au Studio.

## Relecture

Un sous-agent opus a relu le plan : un bloquant (écart de contrat sous-estimé) et sept points
importants (bande de pertinence, concurrence, revalidation du worker, ordre migration/worker,
drapeau côté worker, faux témoignage, délais de retrait). Tout a été reporté dans le document.
La version corrigée n'a pas été relue une seconde fois.

VERDICT OPUS : À CORRIGER

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01E7vxGczccpwnW4UEaNpAtD
