# Rotation d'un secret partagé avec Axion Partners — le récepteur d'abord

- **Tâche** : INT-T50-A (écart C-04 de la vérification transversale, audit du plan de la Phase 1 du 2026-10-01)
- **Miroir** : `docs/runbooks/secret-desynchronise.md` d'Axion Partners, section « Rotation voulue d'un secret d'axionia, sans refus »
- **Exécuté le** : — · environnement : — · SHA : — · résultat : —

## La règle

Un secret partagé se tourne **chez le récepteur d'abord** : c'est lui qui vérifie, il doit donc
accepter la nouvelle valeur AVANT que l'émetteur ne s'en serve. Inverser l'ordre fait refuser chaque
appel signé par la nouvelle valeur, jusqu'à ce que le récepteur la connaisse.

Les deux secrets n'ont pas le même récepteur :

| Secret côté axion-ia        | Même valeur côté Partners  | Qui signe                                                                                    | Qui vérifie (le récepteur) | Processus d'axion-ia qui le lisent                                                                                   |
| --------------------------- | -------------------------- | -------------------------------------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `PARTNERS_SYNC_SECRET`      | `AXIONIA_WEBHOOK_SECRET`   | axion-ia : les envois du relais, et les réponses de relecture et de réconciliation           | **Partners**               | **web** (réponses de relecture, de réconciliation, des coordonnées) **et worker** (le relais `partners-sync-worker`) |
| `PARTNERS_RELECTURE_SECRET` | `AXIONIA_RELECTURE_SECRET` | Partners : ses lectures de la file (`GET /api/partners/evenements`) et ses demandes de rejeu | **axion-ia**               | **web** seulement                                                                                                    |

Aucune valeur de secret ne s'écrit dans ce fichier, une PR, un journal ou une conversation. La pose
passe par un secret GitHub, puis par les workflows `coolify-poser-variable.yml` (web) et
`coolify-worker-aligner-variable.yml` (worker), qui n'impriment aucune valeur.

## A. `PARTNERS_SYNC_SECRET` — Partners d'abord, puis le web ET le worker d'axion-ia avant l'échéance

Partners accepte deux clés : la courante et la précédente, jusqu'à une ÉCHÉANCE posée par lui (au plus
24 h). C'est le `kid` présenté par axion-ia (`x-axionia-kid`, dérivé de la valeur) qui choisit la clé ;
un `kid` inconnu est refusé.

1. **Partners d'abord**, selon son runbook : `AXIONIA_WEBHOOK_SECRET_PRECEDENT` = la valeur ACTUELLE,
   `AXIONIA_WEBHOOK_SECRET_PRECEDENT_ECHEANCE` = un instant ISO 8601 UTC, et `AXIONIA_WEBHOOK_SECRET` =
   la NOUVELLE valeur. Redéploiement, `pnpm deploy:verify`. **Noter l'échéance E.**
2. **Le web d'axion-ia** : poser la nouvelle valeur dans le secret GitHub `PARTNERS_SYNC_SECRET`, lancer
   `coolify-poser-variable.yml`, redéployer le web. Les réponses de relecture et de réconciliation
   partent désormais sous le nouveau `kid`.
3. **Le worker d'axion-ia, AVANT E** : lancer `coolify-worker-aligner-variable.yml`, redémarrer le
   worker. Les envois du relais partent sous le nouveau `kid`.

   **Le délai entre l'étape 2 et l'étape 3 reste strictement inférieur à E.** Entre les deux, le web
   signe avec la nouvelle valeur et le worker avec l'ancienne : Partners accepte les deux grâce au
   `kid`, mais seulement jusqu'à E. Ne pas commencer l'étape 2 s'il ne reste pas le temps de finir
   l'étape 3 bien avant E ; faire les deux dans la même session de travail.

4. **Vérifier** : un envoi du relais est accepté par Partners (ligne `sent` dans
   `partners_sync_outbox`), et une relecture de Partners vérifie la signature de la réponse.
5. **Après E**, Partners retire ses deux variables `_PRECEDENT` (son runbook, étape 4).

**Si le worker n'est pas aligné avant E** : Partners refuse ses envois (clé précédente échue). Le relais
compte chaque refus comme une tentative ; à la huitième, la ligne passe `gave_up`, avec une alerte, et
reste dans la file. Aligner le worker, puis réarmer chaque ligne abandonnée par
`rejouerEvenement(eventId)` ; la réconciliation quotidienne de Partners rattrape aussi par relecture.

## B. `PARTNERS_RELECTURE_SECRET` — axion-ia d'abord, puis Partners

Ici le récepteur est **axion-ia**, et il ne connaît qu'**une** clé : il n'y a pas de clé précédente de ce
côté. La rotation ne peut donc pas être sans refus : entre l'étape 1 et l'étape 2, les lectures de
Partners sont refusées (`401 signature_refusee`).

1. **Le web d'axion-ia d'abord** : poser la nouvelle valeur dans le secret GitHub
   `PARTNERS_RELECTURE_SECRET`, lancer `coolify-poser-variable.yml`, redéployer le web. Le worker ne lit
   pas ce secret.
2. **Partners ensuite**, aussitôt : poser la même valeur dans `AXIONIA_RELECTURE_SECRET`, redéployer.
3. **Vérifier** qu'une relecture de Partners est acceptée (réponse 200, signature de réponse vérifiée).

Le refus est borné et sans perte : la relecture n'est qu'un rattrapage, et la file d'axion-ia garde
tout. Faire cette rotation HORS du passage quotidien de réconciliation de Partners ; un passage refusé
est repris au suivant.

**Limite déclarée** : sans clé précédente côté axion-ia, cette rotation laisse une fenêtre de refus.
Si une rotation sans refus est exigée, la double clé (`PARTNERS_RELECTURE_SECRET_PRECEDENT` et son
échéance, choisie par un `kid`) est un écart à inscrire, sur le modèle de Partners.

## Pendant la rotation (rattrapage 96)

- **L'alerte de secret désynchronisé est attendue.** Pendant la fenêtre de la rotation (entre l'étape
  2 et l'étape 3 du A, entre l'étape 1 et l'étape 2 du B), des appels sont refusés pour leur signature,
  et Partners lève son alerte de secret désynchronisé : elle est attendue, et ne demande aucun geste
  tant que l'étape suivante est faite dans les délais. Elle doit retomber après la dernière étape ; si
  elle persiste, la rotation n'est pas finie.
- **Vérifier qu'aucun limiteur d'axion-ia ne bloque Partners après la série de refus.** Dans le code
  d'axion-ia, le seul limiteur d'une route appelée par Partners est celui du rejeu
  (`partners:reconciliation`, `DEBIT_REJEU` : dix appels par heure, refus si le compteur est aveugle).
  Il n'est consulté qu'après la vérification de signature : une requête refusée en `401` ne le
  consomme pas. La relecture et les coordonnées n'ont pas de limiteur applicatif. Après la dernière
  étape, une relecture et un rejeu de Partners passent (`200`), et aucun `429 debit_depasse`
  n'apparaît. S'il en apparaît un, attendre la fenêtre de l'heure ; ne jamais lever le limiteur.

## Ce que ce runbook ne fait jamais

- Aucune valeur de secret écrite dans un fichier, une PR, un journal ou une conversation.
- Aucune désactivation de la vérification de signature « le temps de tourner ».
- Jamais l'émetteur avant le récepteur.
