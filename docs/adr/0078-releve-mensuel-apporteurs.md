# ADR 0078 — Relevé mensuel d'information des apporteurs : schéma (lot 3a)

Date : 2026-11-27 · Statut : accepté

## Contexte

Décision du dirigeant (27/11) : chaque apporteur reçoit, au début du mois, un relevé récapitulatif du mois précédent. Les autofactures restent émises au fil de l'eau (contrat 5.1) ; le relevé les **récapitule**, il ne les remplace pas et n'est **pas une facture**. Plan : `docs/plans/PLAN-RELEVE-MENSUEL-APPORTEURS.md` (§ 4).

## Décision

Migration `20261127200000_apporteurs_releve_mensuel`, **additive** : un type (`statut_releve_mensuel`), deux tables neuves (`releves_mensuels_apporteur`, `lots_releve_mensuel`) et deux colonnes **nullables** sur `commissions_apporteur` (`regle_appliquee`, `version_contrat`, posées au calcul par un lot ultérieur, jamais rétroactivement). Aucun DROP, aucun UPDATE, rien de recréé de l'existant (autofacture, mandat, TVA figée).

- **Figement en base** : deux triggers SQL. L'un refuse toute modification de `numero`, `apporteur_id`, `periode`, `rang`, `coupure_at`, `contenu`, `empreinte_sha256`, `pdf_r2_key`, `pdf_sha256` dès que l'ancien statut n'est plus `prepare`, tout retour depuis `envoye`, et tout retour vers `prepare` depuis `envoi_en_cours`, `echec` ou `envoye` ; l'autre refuse la suppression d'une ligne non `prepare`. **Détour fermé** (relecture du 27/11) : `envoi_en_cours → ecarte` est refusé (seule la reprise § 6.4 tranche entre `envoye` et `echec`) ; une ligne qui porte un `pris_at` ou un `email_job_id` est figée comme un relevé non `prepare` (contenu, empreinte, PDF, numéro), ne peut plus être supprimée, ne revient jamais à `prepare` (`ecarte → prepare` n'est permis qu'à une ligne jamais prise) et ne peut pas remettre `pris_at` / `email_job_id` à NULL ; un CHECK `prise_tracee` impose `pris_at` dès `envoi_en_cours`, `echec` ou `envoye`. Vérifié en rejouant les transitions sur un Postgres 16 jetable (script SQL non versionné, sans donnée réelle), notamment `prepare → envoi_en_cours → ecarte → prepare → UPDATE → DELETE` désormais refusé dès la 1re étape. **Deuxième relecture (27/11)** : `id`, `rectifie_id` et `format_version` rejoignent les colonnes figées (même condition que `numero`) ; dès `envoye`, les totaux dénormalisés (`nb_lignes`, `*_cents`), `envoye_at` et `envoye_par` sont figés aussi ; `ecarte → envoi_en_cours` est refusé (la prise ne se fait que depuis `prepare` ou `echec`, § 6.4) ; un trigger `BEFORE TRUNCATE` lève une exception (un TRUNCATE ne déclenche pas les triggers de ligne) ; `rectifie_id` porte une clé étrangère auto-référente `RESTRICT / RESTRICT`. Restent volontairement modifiables après l'envoi : `erreur`, `lot_id`, `maj_at`, `motif_ecart`. Chaque garde est prouvée par une mutation qui fait rougir `trigger-figement.spec.ts` (10 mutations sur 10) et par rejeu sur Postgres 16 jetable avant/après. Une erreur se corrige par un rectificatif (`rang` + 1).
- **Contraintes CHECK** posées d'emblée (période `AAAA-MM`, `rang` cohérent avec `rectifie_id`, écart motivé, envoyé complet, empreinte hexadécimale).
- **Écart au § 4 du plan** : pas d'index `(apporteur_id)` seul, préfixe exact de l'unique `(apporteur_id, periode, rang)`.
- **Un seul lot vivant par période** : index unique partiel `lots_releve_mensuel_un_en_cours` (`WHERE fin_at IS NULL AND abandonne_at IS NULL`), SQL brut absent du schéma Prisma.
- **Clé étrangère** vers `apporteurs_reseau` en `RESTRICT` (conservation légale). `lot_id` et `rectifie_id` sans clé étrangère (fenêtre app/worker).
- **Conservation** : alignée sur les autofactures, 10 ans après la clôture de l'exercice (code de commerce, L.123-22), sans purge automatique ; durée inscrite au registre des traitements par l'annotation `rgpd:` des deux modèles. Le PDF est stocké sans chiffrement applicatif (comme les autofactures).

## Conséquences

- Fenêtre app/worker (AGENTS.md, « DEUX conteneurs ») : colonnes nouvelles nullables ou à défaut ; tout code qui lira ces tables tolère P2021 jusqu'à la mise en ligne de la migration, qui doit précéder d'au moins un créneau tout lot qui y écrit.
- Aucune page SSG ne lit ces tables (contrat `stub.invalid`).
- Retour arrière : les objets restent en place (jamais de DROP) ; le trigger de figement interdit de toute façon de vider un relevé envoyé.
