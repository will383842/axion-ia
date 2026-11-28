# Apporteurs — durées de conservation et purge RGPD (PR N, #2464 point 6)

> ⚠️ **Toutes les durées ci-dessous sont celles que le plan recommande. Will ne les a pas encore validées : « À CONFIRMER PAR WILL ».**
> Elles sont écrites en constantes nommées dans `src/features/apporteurs-reseau/purge-rgpd-regles.ts`.

## Ce qui est purgé, et ce qui ne l'est jamais

On ne purge **jamais une personne** : la fiche, les présentations, les commissions restent. On efface seulement les octets des
pièces d'identité et des RIB, et les IBAN chiffrés (fiche → vide ; historique et demandes → marqueur « purge », avec l'empreinte et les
quatre derniers caractères gardés comme preuve du compte payé).

| Donnée                                                                                                                     | Durée                                                                                                 | Constante                      | Fondement proposé                              |
| -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------- |
| Autofactures, avoirs, relevés, contrat signé, pièces d'autofacture, comptes de virement (empreinte, 4 derniers caractères) | 10 ans après la clôture de l'exercice. **Jamais purgés par ce module.**                               | `DUREE_COMPTABLE_ANS`          | C. com. L.123-22                               |
| Pièce d'identité, RIB (octets), IBAN chiffrés — contrat signé puis terminé                                                 | 5 ans après T0 = max(prise d'effet de la résiliation, dernier virement, dernière pièce d'autofacture) | `DUREE_CONTRAT_TERMINE_ANS`    | C. com. L.110-4, C. civ. 2224                  |
| Mêmes données — dossier refusé                                                                                             | 6 mois après le refus                                                                                 | `DUREE_REFUSE_MOIS`            | délai raisonnable de contestation              |
| Mêmes données — dossier jamais contresigné et inactif                                                                      | 24 mois sans activité                                                                                 | `DUREE_INACTIF_MOIS`           | aligné sur la règle « 2 ans » des candidatures |
| Pièce d'identité ou RIB à retransmettre (jamais remplacé(e))                                                               | 6 mois après le dépôt (jamais la dernière pièce de son type)                                          | `DUREE_PIECE_RETRANSMISE_MOIS` | minimisation                                   |
| Pièce d'identité jugée conforme                                                                                            | déjà purgée à la conformité (inchangé)                                                                | —                              | —                                              |

## Garde-fous

- **Aucune purge** si de l'argent est en jeu (commission ni versée ni annulée), si un litige est ouvert, ou si un changement de compte est en cours.
- Date absente ou doute : on garde.
- **Éteinte par défaut.** Variable du worker `APPORTEURS_PURGE_RGPD` : absente = rien ne tourne ; `essai` = rien n'est écrit, une alerte
  récapitulative (nombres par règle, aucun nom) ; `appliquer` = efface. Le 1er du mois (jour de Paris), 20 apporteurs au plus par passage.
- Chaque purge est tracée : table `apporteur_purges_rgpd` (identifiant d'apporteur, éléments effacés, règle, dates ; ajout seul).
- La réécriture de l'IBAN n'est permise par la base que dans la transaction de purge (`SET LOCAL axion.reecriture_pii = 'purge'`).

## Essai manuel sur une base locale (`psql`)

Avec les migrations `20261126150000` et `20261128120000` appliquées :

```sql
-- 1. Sans réglage local : refusé par le déclencheur.
UPDATE apporteur_iban_historique SET iban = 'purge', iban_purge_at = now() WHERE id = '<id>';  -- ERREUR attendue

-- 2. Avec le réglage local, dans la même transaction : accepté.
BEGIN;
SET LOCAL axion.reecriture_pii = 'purge';
UPDATE apporteur_iban_historique SET iban = 'purge', iban_purge_at = now() WHERE id = '<id>';  -- OK
ROLLBACK;
```

Le même scénario est rejoué en CI par `tests/sql/apporteurs-purge-rgpd-comportement.sql`.
