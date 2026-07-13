# STATE — Chantier conformité Qualiopi + pilotage (6 lots)

Branche : `feat/qualiopi-conformite-pilotage` (worktree `../axionia-wt-lots`, base `bce5be83` main).
Plan de référence : `_PLANS/PLAN-CONFORMITE-PILOTAGE-2026-07-13.md`.
Machine : 8 Go — vitest `--maxWorkers=2`, typecheck heap 6G, PAS de build local.

## Avancement

- [x] **Lot 1** — Questionnaires auto + alerte session sans formateur (2026-07-13)
  - `enrollTraineeAction` crée les 3 questionnaires (idempotent, fail-soft) à l'inscription.
  - `envoyerSatisfactionJ1`/`envoyerSuiviJ30` garantissent le questionnaire AVANT l'email
    (throw si échec → pas d'email orphelin, le cron fail-soft re-tente).
  - Alerte `session_sans_formateur` (important, resolutionAuto) : sessions planifiee/en_cours
    démarrant sous 7 j sans `formateurPrincipalId`. Catalogue + règle + specs.
  - Tests : 167/167 verts (notifications, alertes, satisfaction). Typecheck OK.
- [ ] **Lot 2** — Conformité documentaire (moyens pédagogiques, PDF registres, CV formateur,
      fiche adaptation, ind.29 non_applicable). CGV + fiche EDOF EXCLUS (STOP & ASK Will).
- [ ] **Lot 3** — Pont Calendly/Submission → CRM.
- [ ] **Lot 4** — Pilotage (filtres période/type, exports, incidents, revue trimestrielle,
      gouvernance_roles, synthèse questionnaires → revue de direction).
- [ ] **Lot 5** — Barèmes OPCO versionnés (structure vide, valeurs saisies par Will).
- [ ] **Lot 6** — SessionFormateur + commissions (cf. mémoire cockpit-pilotage-formateurs-plan).
- [ ] Vérification finale end-to-end + revue adversariale + PR.

## Décisions prises

- Questionnaires créés à l'inscription (et pas seulement à la création de session) : couvre
  les inscrits tardifs ; l'action manuelle `genererQuestionnairesSessionAction` reste utile
  pour les enrollments antérieurs au fix.
- Échec de création questionnaire dans J+1/J+30 → throw (pas de fail-soft local) : le cron
  loggue et re-scanne le lendemain ; on préfère un email en retard à un email vers un portail vide.

## En attente Will (hors code)

- Données légales Config Qualiopi (« je les mettrai plus tard » — 2026-07-13).
- Décisions : CGV (SIREN/legal_overrides), EDOF oui/non, ind.29 auprès du certificateur,
  valeurs barèmes OPCO, barèmes commissions formateurs.
