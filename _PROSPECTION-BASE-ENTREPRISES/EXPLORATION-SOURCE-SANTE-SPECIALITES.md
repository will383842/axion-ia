# Exploration — Segmentation par spécialité médicale (cardiologue, ophtalmologue…)

> Note de faisabilité (2026-07-04). Répond à : « pouvoir cibler santé → médecin,
> ophtalmologue, cardiologue, etc. ». **Verdict : faisable, mais c'est un
> connecteur SÉPARÉ du Stock Sirene, avec sa propre AIPD.**

## 1. Pourquoi le module actuel ne suffit pas

Le module prospection segmente au **code NAF** (la nomenclature d'activité de
l'INSEE, ~732 codes). Or le NAF **ne descend pas à la spécialité médicale** :

- `86.21Z` = médecins généralistes
- `86.22A/B/C` = médecins spécialistes — **cardiologue, ophtalmologue,
  dermatologue, ORL… sont TOUS regroupés ici**, sans distinction.

Impossible, donc, de séparer « cardiologue » d'« ophtalmologue » à partir de
Sirene seul. Il faut une source qui porte la **spécialité (savoir-faire)**.

## 2. Sources publiques gratuites (classées)

| Source                                                         | Contenu                                                                                              | Spécialité ?                                    | Lien SIREN/entreprise                          | RGPD                                         |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------- | -------------------------------------------- |
| **RPPS / Annuaire Santé** (data.gouv, « Base Annuaire Santé ») | Professionnels de santé nominatifs + profession + **savoir-faire (spécialité)** + adresse d'exercice | ✅ oui                                          | via SIRET/adresse du lieu d'exercice (partiel) | ⚠️ données **nominatives** de professionnels |
| **FINESS** (data.gouv)                                         | Établissements sanitaires/médico-sociaux (hôpitaux, cliniques, EHPAD)                                | ❌ (établissement, pas spécialité du praticien) | oui (SIRET)                                    | établissement, faible                        |
| **Base Ameli / conventionnement**                              | Praticiens conventionnés + secteur                                                                   | partiel                                         | partiel                                        | nominatif                                    |

→ La seule source qui donne la **spécialité fine** est le **RPPS / Annuaire
Santé**. C'est un fichier open-data téléchargeable (comme le Stock Sirene).

## 3. Design proposé (module « Prospection Santé », V2)

Réutilise l'architecture existante, en ADDITIF (aucune régression sur le
cloisonnement) :

1. **Connecteur** `src/server/prospection/sources/annuaire-sante.ts` — stream +
   Zod du fichier RPPS (comme `sirene-stock-ingestor`), injecté/testable.
2. **Entité** `ProspectionHealthPractitioner` (ou champ `specialite` +
   `professionSante` sur une table dédiée) — nominatif, relié à `ProspectionCompany`
   par SIRET/adresse quand c'est possible (sinon praticien « libéral » autonome).
3. **SSOT** `src/lib/prospection/specialite-sante.ts` — mapping code
   savoir-faire → libellé (cardiologie, ophtalmologie…), sur le modèle de
   `naf-to-secteur.ts`.
4. **Dimension activité** : le tableau de bord « Par activité » (déjà construit)
   gagne un niveau : secteur `sante` → NAF → **spécialité** (drill-down).
5. **Enrichissement** : identique (site + coordonnées), scopable par spécialité
   via l'action « enrichir ce segment » déjà en place.

## 4. Points de vigilance RGPD (⚠️ bloquant tant que non tranché)

- Le RPPS contient des **données nominatives de professionnels de santé**. La
  prospection B2B d'un professionnel reste possible sous **intérêt légitime
  (art. 6.1.f)**, MAIS :
  - le **contexte santé** appelle une vigilance renforcée (même si la SPÉCIALITÉ
    d'un praticien n'est pas une « donnée de santé » au sens de l'art. 9 — c'est
    sa profession, pas l'état de santé d'un patient) ;
  - **AIPD dédiée** requise (nouvelle finalité + nouvelle source nominative) ;
  - respecter les **conditions de réutilisation** de l'Annuaire Santé (licence)
    et l'éventuelle opposition des praticiens.
- Ne PAS mélanger avec des données de patients (aucune ici) ni des données de
  remboursement.

## 5. Effort estimé & recommandation

- Effort : ~1 tranche (connecteur + entité + migration additive + SSOT
  spécialités + drill-down UI + tests) — comparable à T3+T5 en réduit.
- **Recommandation** : le traiter comme un **module V2 « Prospection Santé »**
  distinct, avec sa propre AIPD validée AVANT toute ingestion RPPS. La brique
  d'activité + l'enrichissement par segment (livrés ici) l'accueilleront sans
  refonte : il ne reste qu'à brancher la source + la dimension spécialité.

**Décision requise (Will)** : go/no-go sur le module Santé V2 + validation
juridique de l'usage du RPPS. En attendant, la santé reste segmentable au **NAF**
(généraliste `86.21Z` vs spécialiste `86.22`), sans distinction de spécialité.
