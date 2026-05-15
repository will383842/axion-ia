# ADR 0023 — Criticité tables content-gen pour backups + restore

- **Statut** : Accepté
- **Date** : 2026-05-15
- **Auteur** : Will + Claude (Opus 4.7), suite à audit `_AUDIT/CONTENT-GEN-AUDIT-D5-D6-DR-2026-05-15.md` §2.3 + §10 P1-10
- **Référence** : ADR 0021 (content-gen V1 skeleton), R22 (restore drill), `prisma/schema.prisma`

## Contexte

L'audit D5+D6 a noté que la doctrine R22 mesure des row counts génériques
(admin_users, bookings, etc.) sans distinguer la criticité des tables
content-gen. En cas de restore partiel ou décision sur RPO acceptable,
manque un guide formel "quoi backuper en priorité, quoi est tolérable
en perte".

## Décision

Trois niveaux de criticité (P0 / P1 / P2) appliqués aux tables content-gen,
avec RPO acceptable et stratégie restore dédiée.

### 🔴 P0 — perte = perte SEO publié / KB longue à reconstituer

| Table                  | Pourquoi P0                                                                                | RPO acceptable             |
| ---------------------- | ------------------------------------------------------------------------------------------ | -------------------------- |
| `Article`              | Contenus indexés Google = SEO + revenue. Re-générer != même URL canonical, perd backlinks. | < 1 h cible V2 / ≤ 24 h V1 |
| `ArticleTranslation`   | Idem multi-langue                                                                          | idem                       |
| `KnowledgeEntry`       | KB V4 — reconstitution ~heures de retrieval RSS + génération                               | < 1 h V2 / ≤ 24 h V1       |
| `KnowledgeTranslation` | Idem                                                                                       | idem                       |

**Stratégie restore** :

- Restore daily via `backup-postgres-r2.sh --restore` → couvre RPO 24 h V1
- Si V2 : WAL streaming + PITR pour RPO 1 h
- Drill : counts vérifiés à chaque drill nightly (`restore-postgres-test-r2.sh` ligne 174)

### 🟡 P1 — perte historique / re-action manuelle

| Table                               | Pourquoi P1                                                                                           | RPO acceptable |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------- |
| `ContentGenJob`                     | Audit trail générations. Perte = perte historique mais pas de prod data                               | ≤ 24 h         |
| `CoverageCampaign`                  | Campagnes actives. Perte = relance manuelle via admin                                                 | ≤ 24 h         |
| `GenerationLog`                     | Logs détaillés génération + cost tracking                                                             | ≤ 24 h         |
| `WebVitalSample`                    | Monitoring perf — reconstituable via CrUX/Plausible                                                   | ≤ 24 h         |
| `Booking`, `BookingOption`, `Devis` | Données business critiques mais déjà couvertes par backup full DB ; mentionnées ici pour exhaustivité | ≤ 24 h         |

**Stratégie restore** :

- Couvert par même daily R2 que P0 (pas de pipeline distinct)
- Acceptable de perdre 24 h de history audit
- En cas de perte > 24 h : ouvrir incident post-mortem + relancer campagnes affectées via admin coverage UI

### 🟢 P2 — re-seedable / re-générable

| Table                        | Pourquoi P2                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------ |
| `AuthorProfile`              | Manon — re-seeder via `prisma/seed.ts` ou `import-knowledge-from-faq.ts`                         |
| `ContentGenConfig`           | Settings — re-seedable via UI admin / .env defaults                                              |
| `Template` content-gen       | Re-seedable via fixtures Git                                                                     |
| `RssSource`                  | Liste fixe — re-seedable via SQL ou fixture                                                      |
| `KbDocument` legacy obsolète | Cf. mémoire `axionia_session_2026-05-14_sprint_s0bis` — KB V4 = `KnowledgeEntry`, pas KbDocument |

**Stratégie restore** :

- Pas de check spécifique drill (couvert par full DB restore)
- En cas de perte isolée : `pnpm prisma db seed` re-seed

## Application opérationnelle

### Dans `restore-postgres-test-r2.sh`

Le check counts critique est aligné sur les tables P0 (cf. ligne 154 du
script) :

```bash
TABLES=(
  "\"Article\""           # P0
  "\"KnowledgeEntry\""    # P0
  "\"Booking\""           # P1 (déjà critique business)
  "\"AuthorProfile\""     # P2 témoin re-seed OK
)
```

### Dans `R22-pg-restore-drill.md` §9

Doc à jour : counts P0 + comparaison avec live DB.

### Dans `_AUDIT/PG-RESTORE-DRILL-LOG.md`

Chaque entrée drill doit lister au minimum les counts P0 mesurés.

### Dans la doctrine RGPD (`legal.ts`)

Les tables P0 contenant données users (Article si auteur user, Booking
P1) sont soumises rétention selon ADR 0010 (PII minimisation) — pas
d'impact sur stratégie backup mais à mémoriser pour purge automatique
post-rétention (`R26-retention-tier3-cleanup.md`).

## Conséquences

### Positives

- Critère clair pour décider RPO V2 (1 h cible WAL streaming = motivé par P0)
- Drill peut détecter régression sur tables critiques (vs counts génériques)
- Aligne doctrine restore + monitoring

### Négatives

- Liste à maintenir à chaque ajout de table content-gen → process : tout
  nouveau modèle Prisma doit être classé P0/P1/P2 dans cet ADR via PR
- Mitigation : ajouter check CI qui flag toute nouvelle table sans ADR
  associé (V2)

## Alternatives considérées

- **Backup table-level dédié pour P0** — écarté V1 (complexité pg_dump
  --table multiplie les fichiers + gestion FK croisées). À reconsidérer
  si RPO P0 < 1 h imposé par contrat client.
- **Pas de doctrine criticité** — écarté car drift garanti à mesure que
  le schéma grandit (Sprint 14+ a déjà 17 tables).
- **Niveaux 4-5 (P0/P1/P2/P3/P4)** — écarté : 3 niveaux suffisent pour
  un solo dev, plus de granularité = paperasse.

## Suivi

- `restore-postgres-test-r2.sh` aligné dès création (2026-05-15)
- `R22-pg-restore-drill.md` : section §9 à enrichir au prochain edit
- V2 : si WAL streaming activé, RPO P0 passe de 24 h à 1 h
- À chaque sprint content-gen : check ce fichier avant migration Prisma
