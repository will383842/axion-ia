# 06 — Matrice d'acceptation (oracle du « done »)

> Chaque exigence → artefact logiciel attendu → test automatisé → critère de « done » vérifiable.
> Organisée par tranche (roadmap `PLAN-DIRECTEUR-V1.md` §12). Source de vérité = le code réel une fois
> implémenté. **Preuve V1 globale = campagne pilote sur 1 département.**

## T0 — Grounding + RGPD

| Exigence          | Artefact                    | Test / preuve  | Done               |
| ----------------- | --------------------------- | -------------- | ------------------ |
| AIPD produite     | Document AIPD (modèle CNIL) | Revue Will/DPO | AIPD validée       |
| Base légale pesée | LIA écrit                   | Revue          | LIA validé         |
| ADR actés         | ADR-0001/0002/0003          | Revue          | Statut « accepté » |

## T1 — SSOT & config

| Mapping NAF→secteur | `naf-to-secteur.ts` | Unitaire (codes connus) | 100 % codes mappés |
| Tranche effectif→taille | `taille.ts` | Unitaire (bornes TPE/PME/ETI/GE) | Bornes exactes |
| Département→région | `departement-to-region.ts` | Unitaire (101 dép) | Tous mappés |
| Fonction normalisée | `qualite-to-fonction.ts` | Unitaire | Libellés courants couverts |
| Cibles de crawl | `crawl-targets.ts` | Unitaire | Team pages listées |
| Barèmes de score | `scoring.ts` | Unitaire | Poids configurables |

## T2 — Schéma

| Modèle complet | Migration additive | `prisma migrate` + mocks | Migre sans DROP |
| Anti-doublon | Contraintes UNIQUE (siren, siret, contact, personKey) | Intégration (insert doublon rejeté) | Doublons impossibles |
| Contrat stub.invalid | Guards | Build stub | Aucun appel réseau au build |

## T3 — Ingestion Stock Sirene

| Exhaustivité native | `stock-ingestor-worker` | Intégration (échantillon) | Stock chargé, `StockReference` peuplé |
| Dénombrement par dép | `StockReference` | Compare à total connu | `attendu` = compte réel |
| Rate-limit distribué | File BullMQ limiter + token-bucket | Test charge (N workers) | Jamais > limite source (0 × 429 ban) |
| Anti-changement schéma | Validation Zod connecteurs | Unitaire (payload altéré) | Parse échoue proprement → erreur, pas `null` |
| Reprise après failed | jobId éphémère/nonce | **Test « re-enqueue après failed »** | Cellule ré-enfilée (pas de no-op) |
| Delta fraîcheur | `delta-worker` | Intégration | Créations/cessations appliquées |

## T4 — Collecte ciblée + coverage

| Reprise sur panne | État `CoverageCell` | Intégration (kill mid-run) | Reprend les `a_faire`/`erreur` seulement |
| Exhaustivité prouvée | Règle collecté ≥ attendu | Intégration | Cellule tronquée → `erreur`, jamais `fait` |
| Rollup 3 niveaux | `coverage-worker` + `GeoCoverageStat` | Intégration | dép/région/France cohérents |
| Anti-dérive compteurs | Recalcul depuis COUNT | **Test « pas de dérive »** | Dénormalisés == COUNT réel |

## T5 — Enrichissement (2 passes)

| Coordonnées (passe A) | `enrich-worker` | Intégration (site mocké) | email/tél extraits + validés (MX/E.164) |
| **Responsables (passe B)** | Crawl team pages | Intégration (page /equipe mockée) | **`CompanyPerson` responsables créés** |
| Confirmation domaine | Ownership check SIREN/dénomination | Unitaire (homonyme) | Domaine non confirmé → non retenu |
| Matching nominatif | `personId` + confidence | Unitaire (patterns email) | Email nominatif rattaché à la bonne personne |
| Anti-re-scrape | `refreshAfter`/`contentHash` | Intégration | Site récent non re-crawlé ; no-op si inchangé |

## T6 — Console admin (pilotage)

| Pôle nav | `admin-nav.ts` | E2E | Pôle visible |
| Wizard campagne | `/campagnes/nouvelle` | E2E | Cellules correctes + aperçu volume |
| Planification/priorité | `scheduler-worker` | Intégration | Campagne due activée, priorité respectée |

## T7 — Console admin (exploitation)

| Base + filtres | `/entreprises` | E2E | Filtres dép/secteur/taille/type/contactabilité |
| Contacts à onglets | `/contacts` | E2E | 3 onglets exacts + compteurs |
| Coverage + région/France | `/couverture` + carte | E2E | Bandeau France + drill-down |
| Pagination échelle | keyset | Bench | Pas d'OFFSET profond, latence bornée |

## T8 — Export & RGPD

| Export segmenté | `export-worker` | Intégration | 3 fichiers (exploitables/partiels/à compléter) + colonnes conformité |
| **Non-diffusible exclu** | Filtre | **Test** | SIREN non-diffusible absent de base/export |
| **Opt-out post-collecte** | Re-filtre à l'export | **Test** | Opt-out après collecte → absent de l'export |
| Journal d'accès | `ProspectionAccessLog` | Intégration | view/search/export journalisés |
| RBAC | Rôles | E2E | Export réservé `dpo|admin` |
| Purge rétention | `retention-purge-worker` | Intégration | `retentionUntil` respecté (entreprise + personne) |

## T9 — Durcissement

| Circuit breaker | Par source | Intégration (source down) | File pausée + alerte |
| Alertes anomalies | `coverage-worker` | Intégration (débit 0) | Alerte levée |
| Web Vitals admin | SVG/keyset/bundle | `size-limit`/lhci | Budgets respectés |
| Bench France | Estimation wall-clock | Soak-test 1–2 dép | Débit soutenu, mémoire Redis stable |

## Preuve V1 « done »

Campagne pilote sur **1 département** × 2-3 secteurs × 4 tailles → base peuplée, **responsables de
secteur capturés**, coverage 100 % des cellules, stats dép/région/France correctes, export segmenté
généré, **opt-out + non-diffusible prouvés**, **aucun envoi d'email**.
