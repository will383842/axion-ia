# 08 — Stratégie de test & vérification (autopilot)

> Comment prouver chaque tranche pendant l'implémentation. Complète `06-MATRICE-ACCEPTATION.md` (le
> « quoi ») par le « comment ». Objectif : **des vérifications, croisements et tests EN CONTINU**, pas
> seulement à la fin.

## 1. Pyramide de tests

- **Unitaires (majorité)** — fonctions pures : `naf-to-secteur`, `taille` (bornes TPE/PME/ETI/GE),
  `departement-to-region`, `qualite-to-fonction`, `scoring`, normalisation email/tél, `personKey`,
  découpage adaptatif, calcul des taux (§03). Rapides, exécutés à chaque commit.
- **Intégration (mocks)** — connecteurs + workers avec réponses API **mockées** (fixtures) + Prisma test.
- **E2E ciblés** — parcours admin critiques (wizard → campagne, contacts à onglets, export, opt-out).
- **Charge / soak** — rate-limit soutenu, mémoire Redis, débit d'écriture, temps `REFRESH MV` (T9).

## 2. Fixtures & mocks (aucun appel réseau réel en test ; contrat stub.invalid)

| Source                                                         | Mock de test                                                                                                                              |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Stock Sirene                                                   | **échantillon CSV réduit** (quelques centaines de lignes) + un cas non-diffusible + un cas cessé                                          |
| recherche-entreprises / Sirene / RNE / BODACC / Annuaire / BAN | réponses JSON figées (fixtures), + variantes d'erreur (429, 500, timeout, **schéma altéré**)                                              |
| Site public entreprise                                         | pages HTML de fixtures : mentions légales (email+tél+SIREN), page `/equipe` (responsables), page sans contact, page robots.txt `Disallow` |
| DNS/MX                                                         | resolver mocké (domaine valide / MX absent / domaine mort)                                                                                |

**Tester le bulk-ingest sans 4 Go** : injecter l'échantillon CSV via l'ingestor (le download est
abstrait derrière une interface `StockSource` → en test = fichier local).

## 3. Tests de NON-RÉGRESSION critiques (obligatoires, tirés de l'audit)

1. **Re-enqueue après `failed`** (piège BullMQ jobId) : une cellule repassée en `erreur` DOIT être
   ré-enfilée et re-traitée (pas de no-op silencieux).
2. **Pas de dérive de compteurs** : après collecte, `Campaign.entreprisesCollectees` == COUNT réel ==
   Σ `CoverageCell.collecte` ; le worker logue tout écart.
3. **Exhaustivité** : une cellule dont `collecte < attendu` finit en `erreur`, jamais `fait`.
4. **Non-diffusible exclu** : un SIREN `statutDiffusion=non_diffusible` n'est ni stocké visible ni exporté.
5. **Opt-out post-collecte** : un opt-out arrivé APRÈS la collecte → l'entreprise est **absente de
   l'export** (re-filtre à la génération).
6. **Anti-doublon** : ré-ingérer le même SIREN/SIRET/email/tél/personne → **aucune** nouvelle ligne
   (upsert) ; une succursale (SIRET) → `Establishment`, pas un doublon de `Company`.
7. **Responsables captés** : une page `/equipe` de fixture → `CompanyPerson` avec rôle/seniorité
   (prouve que la passe B fonctionne malgré l'early-exit de la passe A).
8. **Rate-limit** : sous N workers concurrents, le nombre de requêtes/s à une source ne dépasse jamais
   la limite (compteur mocké) ; respect `Retry-After`.
9. **Confirmation domaine** : un domaine homonyme sans SIREN/dénomination sur la page → **non retenu**.
10. **Stub.invalid** : au build (URLs stub), aucun connecteur ne fait d'appel réseau ; agrégats ne
    divisent pas par 0.

## 4. Vérification ADVERSARIALE par tranche (au-delà des gates verts)

Après les gates d'une tranche, lancer une **passe de vérification indépendante** (idéalement un agent
distinct qui n'a pas écrit le code) qui tente de **réfuter** que la tranche est correcte :

- Relire le diff contre `06-MATRICE-ACCEPTATION.md` (chaque critère de la tranche a-t-il une preuve ?).
- Chercher les cas limites non testés (données manquantes, encodage, doublons partiels, pagination).
- Vérifier la conformité RGPD de la tranche (aucune donnée perso écrite hors cadre, opt-out respecté).
- Croiser avec le contrat de codebase (pas de REST/Fastify, stub-aware, cloisonnement, SiteSetting).
  Une tranche n'est « faite » que si la vérification adversariale **ne trouve rien** (ou après réconciliation).

## 5. Données de vérité pour le pilote

Pour l'Isère (38) : comparer `StockReference` (nombre attendu par NAF×taille) à des totaux connus
(compteurs de l'API recherche-entreprises) → prouve le dénombrement. La campagne pilote sert de
**test d'acceptation grandeur nature** (échelle réduite, réelle).

## 6. Cadence

- **À chaque commit** : unitaires + typecheck + eslint.
- **À chaque fin de tranche** : intégration + gates complets + **vérification adversariale** + croisement matrice.
- **T9** : E2E + charge/soak + bench France (estimation wall-clock, mémoire Redis, temps REFRESH MV).
