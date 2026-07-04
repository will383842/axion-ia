# 01 — Modèle de données détaillé

> Spec descriptive (pas de migration exécutable). Source de vérité : `PLAN-DIRECTEUR-V1.md` §5.
> Toutes les tables sont **additives**, `@@map` snake_case, index composites, dédup forte.

## Vue d'ensemble (relations)

```
Company (1 SIREN) ─┬─< Establishment (SIRET, dont siège)
                   ├─< CompanyPerson ─< CompanyPersonRole
                   ├─< CompanyContact (email|tel, →personId?, →establishmentId?)
                   ├─< CompanyTag >─ Tag
                   └─< ProspectionEvent
ProspectingCampaign ─< CoverageCell ─< CollectRun
StockReference (dénominateur)   GeoCoverageStat (rollup dép→région→France)   StatsSnapshot (temporel)
SuppressionEntry (opt-out multi-clé)   ProspectionAccessLog (accès données perso)
```

## Enums

- **Taille** : `TPE | PME | ETI | GE`. Dérivée de la tranche d'effectif INSEE : TPE < 10 · PME 10–249 ·
  ETI 250–4999 · GE ≥ 5000. `tailleSource` (`effectif | categorie_insee`) trace la provenance.
- **typeOrganisation** : `privee | publique | parapublique | association | collectivite | epic`
  (dérivé de la nature juridique INSEE).
- **contactabilite** : `exploitable | partiel | non_contactable` ; sous-nuance `exploitable_nominatif`
  vs `exploitable_generique`.
- **seniorite** (rôle) : `dirigeant | directeur | responsable | manager | cadre | autre`.
- **departementFonctionnel** : `direction | commercial | rh | achats | finance | technique | dsi |
marketing | juridique | production | qhse | autre`.
- **enrichmentStatus** : `pending | enriching | enriched | failed | no_data`.
- **statut campagne** : `brouillon | active | en_pause | en_pause_quota | terminee`.
- **statut cellule** : `a_faire | en_cours | fait | erreur`.
- **statutDiffusion** (INSEE) : `diffusible | non_diffusible | partiel`.
- **verifStatus** (contact) : `verified_syntax | mx_ok | role | invalid` (email) ; `e164_ok | invalide`
  (téléphone).

## Entités

### Company (unité légale — 1 SIREN = 1 ligne)

| Champ                                                                                              | Type              | Null | Description                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------- | ----------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                                                                                                 | uuid              | non  | PK                                                                                                                                                                               |
| siren                                                                                              | string(9)         | non  | **UNIQUE** — clé anti-doublon n°1                                                                                                                                                |
| denomination / nomComplet / sigle                                                                  | string            | oui  | Identité                                                                                                                                                                         |
| formeJuridique / natureJuridique                                                                   | code+libellé      | oui  | INSEE                                                                                                                                                                            |
| dateCreation / etatAdministratif                                                                   | date / enum       | oui  | actif/cessé                                                                                                                                                                      |
| naf / nafLibelle / sectionNaf                                                                      | string            | oui  | Code APE + section                                                                                                                                                               |
| secteur                                                                                            | enum interne      | oui  | Regroupement métier (BTP, Santé, Droit…) — **énuméré exhaustivement en T1** (`naf-to-secteur.ts`, test « 100 % des codes NAF mappés ») ; pilote V1 garantit au moins BTP + Santé |
| trancheEffectif / effectifEstime                                                                   | code / int        | oui  | Effectif                                                                                                                                                                         |
| taille                                                                                             | enum              | oui  | TPE/PME/ETI/GE (dérivée) ; `tailleSource`                                                                                                                                        |
| categorieEntreprise                                                                                | enum              | oui  | PME/ETI/GE (INSEE brut)                                                                                                                                                          |
| typeOrganisation                                                                                   | enum              | oui  | privé/public/…                                                                                                                                                                   |
| departement / codePostal / commune / communeCode / region                                          | string            | oui  | Géo siège (region via SSOT dép→région)                                                                                                                                           |
| adresse / latitude / longitude                                                                     | string/float      | oui  | lat/lng via BAN                                                                                                                                                                  |
| siteWeb / siteWebStatus / domainMatchMethod / domainConfidence                                     | string/enum/float | oui  | Domaine + preuve d'appartenance                                                                                                                                                  |
| emailPublic / telephonePublic                                                                      | string            | oui  | Meilleur contact (voir CompanyContact)                                                                                                                                           |
| contactFormUrl / linkedinUrl / socials / langueSite / tvaIntracom / capitalSocial / rcs / horaires | mixte             | oui  | Champs prospection (site public)                                                                                                                                                 |
| contactabilite / hasEmail / hasTelephone / leadScore                                               | enum/bool/int     | oui  | Exploitabilité (voir 03)                                                                                                                                                         |
| enrichmentStatus / lastEnrichedAt / dataQuality                                                    | enum/date/int     | oui  | Suivi enrichissement                                                                                                                                                             |
| firstSeenAt / lastCollectedAt / lastCheckedAt / contentHash / refreshAfter                         | date/string       | oui  | Anti-re-scrape / fraîcheur                                                                                                                                                       |
| statutDiffusion / oppositionProspectionRNE / optOut / optOutAt / retentionUntil                    | enum/bool/date    | oui  | **RGPD**                                                                                                                                                                         |
| fieldProvenance                                                                                    | json              | oui  | Provenance par champ (réconciliation multi-sources)                                                                                                                              |
| source / collectRunId                                                                              | enum/uuid         | oui  | Origine                                                                                                                                                                          |

Index : `(departement, taille)`, `(secteur, departement)`, `(naf, taille)`, `(enrichmentStatus)`,
`(contactabilite)`, `(region)`, `(statutDiffusion)`.

### Establishment (SIRET)

`id`, `siret` **UNIQUE** (anti-doublon n°2), `companyId` FK, `estSiege` bool, `naf`, `trancheEffectif`,
adresse complète, `departement`, `codePostal`, `commune`, `latitude`, `longitude`, `etatAdministratif`,
`statutDiffusion`. → **les succursales/agences sont ici, PAS des doublons de Company.**

### CompanyPerson (dirigeants légaux + responsables secteur/équipe — DONNÉE PERSO)

`id`, `companyId` FK, `establishmentId?` FK, `nom`, `prenoms`, `titreVerbatim`, `photoUrl?`,
`linkedinUrl?` (si publié sur le site), **`personKey`** = hash(nom+prenoms normalisés, **sans fonction**),
`optOut`, `optOutAt`, `retentionUntil`, `source`, `sourceUrl`, `collectedAt`.
Contrainte : **UNIQUE(companyId, personKey)**. Même personne sur 2 entreprises = 2 lignes reliées par
`personKey` (jamais fusionnées).

### CompanyPersonRole (rôles multiples d'une personne)

`id`, `personId` FK, `qualiteRaw`, `fonctionNormalisee` (enum via SSOT `qualite-to-fonction.ts` —
**énuméré exhaustivement en T1** avec test des libellés courants ; valeur de repli `autre` obligatoire
pour ne jamais perdre un rôle non mappé), `seniorite` (enum), `departementFonctionnel` (enum),
`estDirigeantLegal` bool, `source`, `sourceUrl`, `collectedAt`.

### CompanyContact (multi-emails / multi-téléphones)

`id`, `companyId` FK, `establishmentId?`, `personId?` (si nominatif), `type` (`email|telephone`),
`value`, **`valueNormalized`** (email minuscules / tél E.164), `isNominatif`/`isGenerique`,
`personMatchConfidence`, `label`/`role`, `isPrimary`, `sharedAcrossCompanies`, `sourceUrl`, `confidence`,
`verifStatus`, `collectedAt`.
Contrainte : **UNIQUE(companyId, type, valueNormalized)** → anti-doublon email/tél.

### ProspectingCampaign

`id`, `nom`, `statut` (enum), `departements[]`, `nafCodes[]`/`secteurs[]`, `tailles[]`,
`typesOrganisation[]`, `enrichirContacts` bool, `enrichirPersonnes` bool, `quotaMax`, `rythme`,
`priorite` int, `scheduledAt`, `recurrence` (cron), `nextRunAt`, compteurs (`cellulesTotal`,
`cellulesFaites`, `entreprisesCollectees`, `entreprisesEnrichies`), `debitParHeure`, `etaCompletion`,
`createdBy`, timestamps.

### CoverageCell (matrice = work-list)

`id`, `campaignId` FK, `departement`, `region` (dérivé), `naf`, `secteur` (dérivé du NAF via
`naf-to-secteur.ts`, pour l'agrégation), `taille`, `typeOrganisation?`, `statut` (enum), `attendu`
(compte réel), `collecte`, `enrichi`, `pageCursor`, `lastError`, `errorCode`, `updatedAt`.
**UNIQUE(campaignId, departement, naf, taille)**. **Identité de cellule toujours au niveau NAF** : une
campagne ciblant des `secteurs[]` est **détendue en codes NAF** à la création (expansion
`secteur → naf[]` via `naf-to-secteur.ts`) ; `secteur` n'est qu'une colonne dérivée de rollup, jamais la
clé. Cellules créées **paresseusement** (si `attendu` > 0).

### CollectRun (exécution / audit / idempotence)

`id`, `cellId` FK, `startedAt`, `finishedAt`, `nbResultats`, `nbNouveaux`, `nbDoublons`, `apiCalls`,
`status`, `errorCode`.

### ProspectionEvent (append-only)

`id`, `type` (`company_collected|person_added|contact_scraped|opt_out|export|campaign_started|paused|
resumed|completed|refresh`), `actorId?`, `reason?`, `companyId?`, `campaignId?`, `data` json, `createdAt`.
Index `(type, createdAt)`. Politique de rétention/rollup (les snapshots remplacent les vieux events).

### ProspectionAccessLog (RGPD — accès aux données perso)

`id`, `userId`, `action` (`view_person|search|export`), `cible`, `createdAt`. Purge ~6-12 mois.

### Tag / CompanyTag

Hiérarchie `SECTEUR | TAILLE | DEPARTEMENT | SOURCE | QUALITE`, `assignedBy` (`auto|user`).

### SuppressionEntry (opt-out multi-clé — RGPD)

`id`, `type` (`siren|email|domaine|personKey`), `value`, `raison`, `createdAt`. **Filtre systématique**
avant collecte, avant enrichissement, et à la génération d'export.

### StockReference / GeoCoverageStat / StatsSnapshot

Détaillés dans `03-SPEC-STATS-REPORTING.md` (dénominateur, rollup 3 niveaux, série temporelle).

## Anti-doublon (récap)

1. **Company** = SIREN UNIQUE (upsert, jamais d'insert aveugle). 2. **Establishment** = SIRET UNIQUE
   (succursales ≠ doublons). 3. **Contact** = UNIQUE(companyId, type, valueNormalized). 4. **Personne** =
   UNIQUE(companyId, personKey) — fonction hors clé. 5. **Inter-sources** = réconciliation non destructive
   (meilleure valeur par confiance/source, `fieldProvenance`). 6. **Fuzzy sans SIREN** → revue manuelle.

## Volumétrie & perf

~10 M Company (actives), ~30 M Establishment (si tous établissements). ⇒ index composites, **pagination
keyset** (pas OFFSET), counts approximatifs, **partitionnement** envisagé (par `departement`/
`etatAdministratif`), agrégats **précalculés dans la table `GeoCoverageStat`** (rollup incrémental +
recalcul depuis COUNT ; vue matérialisée = optimisation optionnelle — voir 03). Bulk-upsert par batch.

## Migration

Additive uniquement, aucun `DROP`, naming `YYYYMMDDHHMMSS_prospection_*`. Contrat build `stub.invalid`
respecté (aucun appel réseau au build ; le Proxy stub renvoie `[]/0/null`).
