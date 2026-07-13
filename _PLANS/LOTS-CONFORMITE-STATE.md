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
- [x] **Lot 2** — Conformité documentaire (moyens pédagogiques, PDF registres, CV formateur,
      fiche adaptation, ind.29). Commit `128cfb94`. CGV + fiche EDOF EXCLUS (STOP & ASK Will).
- [x] **Lot 3** — Pont Calendly/Submission → CRM (2026-07-13, COMMITÉ `7fd2563b`)
  - Service `src/server/qualiopi/crm/entrees.ts` : fusion N derniers CalendlyEvent + Submission
    (hors corbeille), tri date desc, PII Submission déchiffrée (`decryptPii`) AVANT match,
    annotation `clientExistant` par email lowercase vs `Client.contactEmail` (citext,
    `mode: "insensitive"`). Stub-aware → [] / null. AUCUNE migration (statut « converti » dérivé).
  - Action `convertirEntreeEnClientAction` (`src/server/actions/qualiopi/entrees.ts`) :
    dédup email → `dejaExistant: true` sans doublon ; sinon délègue à `createClientAction`
    (numérotation AXI-CLI + OPCO/NAF réutilisées) avec `source` appel_calendly|formulaire_contact.
    Audit `qualiopi.crm.convertir_entree` dans les deux cas.
  - Page admin `/qualiopi/entrees` (nav « Entrées récentes » 📥 avant Clients, pôle commercial) :
    tableau unifié + `ConvertirEntreeForm` (pré-rempli, repliable) + badge Client AXI-CLI-NNN +
    lien « Créer un devis » → `/qualiopi/devis/new?clientId=…` (searchParam ajouté, validé
    contre la liste clients, pré-sélection dans `DevisForm.defaultClientId`).
  - Tests : 18 specs neufs verts ; suite qualiopi entière 142 fichiers / 2214 verts ;
    typecheck OK ; prettier + eslint OK.
- [x] **Lot 4** — Pilotage (filtres période/type, exports, incidents, revue trimestrielle,
      gouvernance_roles, synthèse questionnaires → revue de direction). Commits `3c56340c` + docs
      `84c3e0e4`. ⚠️ À RE-VÉRIFIER end-to-end à la vérif finale (committé sur rapport agent vert,
      sans re-run complet). Working tree PROPRE au moment de la pause.
- [x] **Lot 5** — Barèmes OPCO centralisés + versionnés (2026-07-13). Modèle `BaremeOpco` + enum
      `Opco` (11 OPCO, migration additive `20260713000004`, structure VIDE — valeurs saisies par
      Will). Résolveur versionné (`bareme-opco.ts` : version en vigueur à date, snapshot dossiers
      engagés conservé) + service append-only (`creerVersionBaremeOpco` clôt la précédente).
      Référentiel pur (`opco-referentiel.ts`). Wiring `estimateOpcoCoverage` opco-aware avec
      fallback Atlas CHAMP PAR CHAMP (zéro régression table vide). Alerte `bareme_opco_perime`
      (config `bareme_opco_validite_mois` défaut 12). Page admin `/qualiopi/baremes-opco`
      (relevé + en vigueur + historique + suppression), nav item (count 137→138). Tests : 89 verts
      ciblés (referentiel 13, resolver 10, service 3, devis-opco +5, evaluateur +3, nav 138) ;
      typecheck OK ; prettier OK. NOTE facturation : le barème dossier reste source de vérité ; la
      facture ne consulte PAS encore le référentiel (choix prudent, wiring devis/estimation seul).
- [x] **Lot 6.3** — Cockpit financier (dashboard MARGE) (2026-07-13). Socle commission DÉJÀ mergé
      (cockpit #287+ : SessionFormateur, TrainerCompensationRule/FeeLine/Statement, run mensuel) →
      Lot 6.1/6.2 acquis. Ajouté : `remuneration/marge.ts` (agrégation pure sur TrainerFeeLine +
      CA session, sessions RÉALISÉES) — marge par session/formation, heures & coût par formateur,
      consolidation mensuelle (bucket Paris), `coutCalcule` (drapeau run mensuel non exécuté).
      Page admin `/qualiopi/cockpit-financier` (KPIs + 4 tableaux + filtres période GET + CSV),
      action `genererMargeCsvAction`, nav item (count 138→139). Refactor : helpers de période
      extraits dans `conformite/periode.ts` (module PUR, réexporté par pilotage-service) — évite de
      traîner le graphe next-auth dans les tests. AUCUNE migration. Tests : marge 7 verts, pilotage
      19 intacts, nav 139 ; typecheck OK ; prettier OK. Note : ind.18 = coordination (pas coût) —
      non modifié (le forcer serait faux).
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
