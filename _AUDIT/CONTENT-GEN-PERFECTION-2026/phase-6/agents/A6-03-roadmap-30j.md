# ROADMAP 30J — Sprint A-suite (J0-J30)

## Date : 2026-05-22 | Score entrant : ~3715/5000 | Score sortant estimé : ~3840-3865/5000

---

### Objectif sprint

Consolider les fondations opérationnelles (D-Ops = point faible à 593/1000), livrer les quick wins
déjà identifiés, et lancer les sprints structurants KB verticales + CampaignTemplate qui débloquent
la rampe de génération 30→100 art/j.

Gain cible : **+125 à +150 pts** pour atteindre ~3840-3865/5000.

---

### Items inclus

| #   | Item                                                 | Dimension | Effort Claude | Effort Will   | Gain pts                | Coût $         | Dépendances                       |
| --- | ---------------------------------------------------- | --------- | ------------- | ------------- | ----------------------- | -------------- | --------------------------------- |
| A   | captureWorkerError quality-improver                  | D-Archi   | 30 min        | 0             | +5                      | ~$0            | Aucune                            |
| B   | seed-kb-facts.ts (4 verticales seed V1)              | D-Qual    | 2h            | 30 min review | +5                      | ~$0            | Aucune                            |
| C   | Alert badge sidebar (jobs échoués)                   | D-Ops     | 2h            | 0             | +8                      | ~$0            | Aucune                            |
| D   | Mobile hamburger admin                               | D-Ops     | 1h            | 0             | +8                      | ~$0            | Aucune                            |
| E   | Onboarding 0 campagnes (état vide guidé)             | D-Ops     | 2h            | 0             | +10                     | ~$0            | Aucune                            |
| F   | GSC service account JSON                             | D-Visi    | 0             | 30 min        | +7                      | ~$0            | Compte Google Search Console Will |
| G   | P0-10 saga post-publish (retry + dead-letter)        | D-Archi   | 3h            | 15 min        | +15                     | ~$0            | Aucune                            |
| H   | Dashboard SSE temps réel (jobs live)                 | D-Ops     | 6h            | 30 min        | +20                     | ~$0            | Aucune                            |
| I   | Tableau croisé ville × articles (coverage UI)        | D-Ops     | 3h            | 0             | +15                     | ~$0            | Aucune                            |
| J   | KB 4 verticales (interventions/audits/implem/1-to-1) | D-Qual    | 16h           | 2h review     | +46                     | ~$0            | seed-kb-facts.ts (item B)         |
| K   | CampaignTemplate 6 presets (D-P5-6)                  | D-Ops     | 8-10h         | 1h review     | +40                     | ~$0            | KB verticales (item J)            |
| L   | Rampe génération : passer à 30 art/j actifs          | D-Etat    | 0 (config)    | 30 min        | +0 (compte dans D-Etat) | $270/trimestre | CampaignTemplate OK               |

---

### Planning semaines

#### Semaine 1 (J1-J7) — Quick wins D-Ops + Archi fondations

- **J1** : captureWorkerError (A) + seed-kb-facts V1 (B) → gates
- **J2** : Alert badge sidebar (C) + Mobile hamburger (D)
- **J3** : Onboarding 0 campagnes (E) + P0-10 saga post-publish (G)
- **J4-J5** : Dashboard SSE temps réel (H) — livrable le plus impactant D-Ops
- **J6** : Tableau croisé ville × articles (I)
- **J7** : Will — GSC service account JSON (F) + review items A-I

Sous-total S1 : **+88 pts** (D-Archi +20, D-Ops +61, D-Visi +7)

#### Semaine 2-3 (J8-J21) — KB verticales

- **J8-J10** : KB verticale 1 — Interventions & Formations (4h Claude)
- **J11-J13** : KB verticale 2 — Audits (4h Claude)
- **J14-J16** : KB verticale 3 — Implémentations (4h Claude)
- **J17-J19** : KB verticale 4 — 1-to-1 (4h Claude)
- **J20** : Intégration + tests vitest KB (3h Claude)
- **J21** : Will review KB complète (2h)

Sous-total S2-S3 : **+46 pts** D-Qual

#### Semaine 4 (J22-J30) — CampaignTemplate 6 presets

- **J22-J24** : Scaffold CampaignTemplate model + migrations
- **J25-J27** : 6 presets (blog pilier × 2 verticales / landing ville / FAQ sectorielle / comparison / cas concret)
- **J28** : UI wizard step "Choisir un preset"
- **J29** : Tests vitest CampaignTemplate + typecheck
- **J30** : Will review + activation rampe 30 art/j

Sous-total S4 : **+40 pts** D-Ops

---

### Coût total sprint

| Poste                                             | Montant                     |
| ------------------------------------------------- | --------------------------- |
| Tokens Claude (dev)                               | ~$5-10 (estimé)             |
| Génération articles 30 art/j × 30j = 900 articles | ~$90 (si rampe activée J30) |
| Infra (VPS existant)                              | $0 incrémental              |
| **Total sprint J0-J30**                           | **~$95-100**                |

---

### Score estimé post-sprint

| Dimension | Avant     | Après     | Delta                |
| --------- | --------- | --------- | -------------------- |
| D-Etat    | ~803      | ~803      | +0 (rampe compte Q3) |
| D-Archi   | ~796      | ~816      | +20                  |
| D-Visi    | ~775      | ~782      | +7                   |
| D-Qual    | ~748      | ~799      | +51                  |
| D-Ops     | ~593      | ~640      | +47                  |
| **TOTAL** | **~3715** | **~3840** | **+125**             |

> Fourchette optimiste (items A-K tous verts, GSC activé J7) : **~3865/5000**
> Fourchette conservatrice (KB J21 + CampaignTemplate partiel) : **~3820/5000**

---

### Risques

| Risque                                  | Probabilité | Mitigation                                                  |
| --------------------------------------- | ----------- | ----------------------------------------------------------- |
| KB verticales trop longues (16h → 20h+) | Moyenne     | Couper à 3 verticales J21, reporter 1-to-1 en J31-J60       |
| SSE Dashboard instabilité Next.js 16.2  | Faible      | Fallback polling toutes les 5s si EventSource problématique |
| GSC service account Will non fourni     | Faible      | Item F non bloquant, reportable J31                         |
| Rampe 30 art/j tokens dépassent budget  | Faible      | Cap BullMQ MAX_PUBLISH=30 déjà en place                     |
