# Unification des deux bases du chatbot (KB-03)

Le chatbot dispose de deux sources : sa copie `chat_kb_chunks` (lue par `hybridSearch`) et les
fiches publiées `knowledge_entries` (lues par `chercherDansKnowledgeEntry`). Il ne lit les fiches
que si `CHATBOT_KB_UNIFIED` vaut exactement `"true"` (éteint par défaut ; « 1 », « TRUE », « oui »
ou l'absence de la variable ne l'allument pas).

**Aucun code, aucun déploiement ni aucune routine ne pose cette variable : l'allumage est un geste
du fondateur.**

## Écarts trouvés par la mise à jour de l'essai (16/11) et correctifs

| Écart                                                                                                                                                   | Correctif                                                                                                                                                                   | Test                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Le lecteur de fiches écarte les fiches citant un montant autre que 1 490 €, donc le rapport ne pouvait **jamais** les signaler (compteur toujours à 0). | Option `conserverHorsGrille` (essai seulement) : l'essai reçoit ces fiches, les signale, et les exclut des passages et de la confiance. Le lecteur du chatbot est inchangé. | `essai-kb-unifiee.test.ts` (fiche piégée), `knowledge-entry-search.test.ts` |
| Le compte « Fiches retenues » ignorait le filtre des doublons de la recherche réelle.                                                                   | Filtre extrait en `sansDoublons`, utilisé par la recherche et par l'essai.                                                                                                  | idem                                                                        |

La branche `feat/v3-chatbot-kb-unifie` n'a pas été rouverte : son contenu est déjà dans `main`
(essai, script, lecteur, interrupteur) ; elle peut être tenue pour close.

## Lancer l'essai (lecture seule)

Sur une base de préproduction :

```bash
DATABASE_URL=<base de préproduction> pnpm tsx scripts/chatbot-kb-unifier-essai.ts --fts-seul
```

- `--fts-seul` : aucun appel au service d'embarquement. Sans cette option, l'essai fait 30 appels
  d'embarquement (à décider par le fondateur).
- Le script refuse de démarrer si `NODE_ENV=production` ou si l'hôte de `DATABASE_URL` n'est pas
  autorisé, sauf `--autoriser-prod` (décision du fondateur).
- Aucune écriture, aucun appel au modèle de langage. Le rapport contient des extraits de la base :
  il reste sur le disque local et n'est jamais commité (dépôt public).

## Lire le rapport

- Par question : passages des deux sources (`chat_kb_chunks`, fiches), confiance, « Fiches retenues ».
- « escalade » signifie « aucun résultat » (le premier passage d'une liste vaut 0,5 > seuil 0,35).
- « Fiches retenues » vient d'un classement interne ; en production, le reclassement externe peut différer.
- Questions sans fiche : repli automatique sur `chat_kb_chunks`.
- ⚠️ « Montants hors Journée IA » : fiche citant un montant autre que 1 490 €. Elle est écartée du
  prompt, mais il faut corriger la fiche à la source avant d'allumer.

## Allumer et éteindre (fondateur)

1. Lire le rapport, corriger les fiches signalées.
2. Poser `CHATBOT_KB_UNIFIED=true` dans l'environnement de l'application, puis redémarrer.
3. Retour arrière : retirer la variable (ou la mettre à autre chose que `true`) et redémarrer.
   Le cache sémantique est clé sur l'interrupteur : aucune réponse « fiches » ne reste servie.

`chat_kb_chunks` n'est ni supprimée ni modifiée ; sa suppression est une décision séparée.
