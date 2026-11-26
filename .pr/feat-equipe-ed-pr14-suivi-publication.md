# Suivi après publication (équipe éditoriale, PR 14)

## But

Suivre les articles après leur mise en ligne, derrière `CONTENT_EQUIPE_EDITORIALE` (éteint par défaut, actif seulement si la valeur vaut exactement « true ») :

- inspection d'URL Search Console à J+3 et J+7, pour les articles NOUVEAUX seulement (moins de 14 jours) ;
- relevé des positions à J+28 et J+90 ;
- alerte de cannibalisation à partir de la carte des requêtes (#2351) ;
- contrôle hebdomadaire des liens cassés à partir du maillage vérifié (#2353) ;
- règles pures de mise à jour (baisse de position ≥ 3 places, preuve expirée, lien cassé, cannibalisation) qui remplacent le déclencheur fixe de 14 jours quand l'interrupteur est allumé.

## Fichiers

- `src/server/content-gen/equipe/suivi-publication.ts` : règles pures + orchestration à dépendances injectées (API Google, mémoire des jalons, quota).
- `src/server/content-gen/equipe/suivi-publication.test.ts` : tests.
- `src/server/queue/workers/content-refresh-worker.ts` : champ facultatif `tache` (`suivi-publication` | `liens-hebdo`) ; chemin de rafraîchissement par règles quand l'interrupteur est allumé.
- `src/server/queue/workers/__tests__/content-refresh-interrupteur.spec.ts` : éteint = comportement d'avant.
- Réutilisés sans modification : `gsc-client.ts` (`gscInspectUrl`, `gscPageMetricsForUrl`), `carte-requetes*.ts`, `maillage.ts`.

## Tests

Règles de déclenchement ; API Google simulées ; quota respecté (jamais plus que 200 inspections/jour, sur 2 000 permis par Google) ; jalon non refait ; réponse nulle non marquée faite ; interrupteur éteint = filtre fixe de 14 jours (même requête Prisma qu'avant). `tsc --noEmit` et eslint passent.

## Risques

- Aucune migration : l'état (jalons faits, quota du jour, relevés, nombre de liens cassés) est dans Redis avec expiration. Une purge de Redis refait simplement les relevés.
- « Preuve expirée » : aucune source de péremption n'existe en base ; la règle est écrite et testée mais l'adaptateur passe `null` pour l'instant (jamais déclenchée en production).
- Aucun cron n'existe pour la file `content-refresh` (déjà le cas avant) : les tâches `suivi-publication` et `liens-hebdo` se lancent par job manuel ; planification à ajouter dans une PR séparée.
- Le champ `tache` est facultatif : un worker plus ancien l'ignore et fait le scan d'avant.
- Interrupteur allumé : le scan lit jusqu'à 500 articles (au lieu de 10) puis filtre par les règles.
- Le dépôt n'ayant pas changé de lockfile, aucun `pnpm install` n'a été nécessaire.
