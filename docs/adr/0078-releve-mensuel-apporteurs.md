# ADR 0078 — Relevé mensuel d'information des apporteurs : schéma (lot 3a)

Date : 2026-11-27 · Statut : accepté

## Contexte

Décision du dirigeant (27/11) : chaque apporteur reçoit, au début du mois, un relevé récapitulatif du mois précédent. Les autofactures restent émises au fil de l'eau (contrat 5.1) ; le relevé les **récapitule**, il ne les remplace pas et n'est **pas une facture**. Plan : `docs/plans/PLAN-RELEVE-MENSUEL-APPORTEURS.md` (§ 4).

## Décision

Migration `20261127200000_apporteurs_releve_mensuel`, **additive** : un type (`statut_releve_mensuel`), deux tables neuves (`releves_mensuels_apporteur`, `lots_releve_mensuel`) et deux colonnes **nullables** sur `commissions_apporteur` (`regle_appliquee`, `version_contrat`, posées au calcul par un lot ultérieur, jamais rétroactivement). Aucun DROP, aucun UPDATE, rien de recréé de l'existant (autofacture, mandat, TVA figée).

- **Figement en base** : deux triggers SQL. L'un refuse toute modification de `numero`, `apporteur_id`, `periode`, `rang`, `coupure_at`, `contenu`, `empreinte_sha256`, `pdf_r2_key`, `pdf_sha256` dès que l'ancien statut n'est plus `prepare`, et tout retour depuis `envoye` ; l'autre refuse la suppression d'une ligne non `prepare`. Une erreur se corrige par un rectificatif (`rang` + 1).
- **Un seul lot vivant par période** : index unique partiel `lots_releve_mensuel_un_en_cours` (`WHERE fin_at IS NULL AND abandonne_at IS NULL`), SQL brut absent du schéma Prisma.
- **Clé étrangère** vers `apporteurs_reseau` en `RESTRICT` (conservation légale). `lot_id` et `rectifie_id` sans clé étrangère (fenêtre app/worker).
- **Conservation** : alignée sur les autofactures, 10 ans après la clôture de l'exercice (code de commerce, L.123-22), sans purge automatique ; durée inscrite au registre des traitements par l'annotation `rgpd:` des deux modèles. Le PDF est stocké sans chiffrement applicatif (comme les autofactures).

## Conséquences

- Fenêtre app/worker (AGENTS.md, « DEUX conteneurs ») : colonnes nouvelles nullables ou à défaut ; tout code qui lira ces tables tolère P2021 jusqu'à la mise en ligne de la migration, qui doit précéder d'au moins un créneau tout lot qui y écrit.
- Aucune page SSG ne lit ces tables (contrat `stub.invalid`).
- Retour arrière : les objets restent en place (jamais de DROP) ; le trigger de figement interdit de toute façon de vider un relevé envoyé.
