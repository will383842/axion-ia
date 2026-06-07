# MATRICE DE SCÉNARIOS S1→S12 par flow

Légende : ✅ prouvé · ☑️ TESTÉ/CODE · ➖ N/A justifié · 🔴 défaut (corrigé sauf mention).

| Flow | S1 nominal | S2 alternatifs | S3 erreurs | S4 bornes | S5 gardes | S6 RBAC | S7 DB vide | S8 concurrence | S9 idempotence | S10 cycle | S11 RGPD | S12 doc légal |
|------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| **Seed référentiel** | ✅ | ✅ stub/kill | ✅ fail-soft | ➖ | ✅ verrou | ➖ | ✅ clean-room | ✅ probe02 | ✅ probe01 | ➖ | ➖ | ➖ |
| **Engine génération** | ☑️ | ☑️ certif/non | ☑️ fail-loud grille | ☑️ | 🟡 score≥80 décision-Will | ☑️ | ✅ grille seedée | ☑️ | ☑️ | ☑️ statutGeneration | ➖ | ☑️ aiGenerated |
| **Cycle session** | ✅ | ✅ annulee/reportee | ☑️ fail-soft | ☑️ | ✅ émargement+financement (C2) | ☑️ | ☑️ | ☑️ P2002 | ✅ unique trigger | ✅ probe04 | ➖ | ➖ |
| **Émargement/présence** | ☑️ | ☑️ Zoom/manuel | ☑️ | ☑️ | ✅ clôture bloquée (C2) | ☑️ | ☑️ | ➖ | ☑️ | ➖ | ➖ | ☑️ relevé |
| **Évaluations/attestation** | ☑️ | ☑️ positionnement/chaud/froid | ☑️ | ☑️ | ✅ refus abandon/exclu (C4) | ☑️ | ☑️ | ➖ | ☑️ | ➖ | ➖ | ☑️ D.6353-1 |
| **Devis→convention** | ☑️ | ☑️ OPCO tripartite | ☑️ | ☑️ | ☑️ accepté requis | ☑️ | ☑️ | ☑️ withNumberRetry | ☑️ transforme | ☑️ statut devis | ➖ | ☑️ |
| **Financement OPCO** | ✅ | ✅ subrog/non | ☑️ | ☑️ plafond | ✅ tripartite/dossier (probe04) | ☑️ | ☑️ | ☑️ | ☑️ | ➖ | ➖ | ☑️ tripartite PDF |
| **Financement CPF** | ✅ | ☑️ | ☑️ | ☑️ RAC anti-0 | ✅ EDOF (probe04) | ☑️ | ☑️ | ➖ | ☑️ | ➖ | ➖ | ☑️ kit CPF |
| **Financement FT** | ✅ | ✅ AIF/POEI/CSP | ☑️ | ☑️ | ✅ POEI 3 preuves (probe04) | ☑️ | ☑️ | ➖ | ☑️ | ➖ | ➖ | ☑️ kit FT |
| **Facturation** | ☑️ | ✅ intra/inter/B2C | ☑️ | ☑️ | ☑️ subrogation n° | ☑️ | ☑️ | ✅ atomique (C3) | ✅ P2002 retry | ➖ | ➖ | ✅ TVA 261-4-4° |
| **Documents PDF (19)** | ✅ %PDF | ✅ tous types | ☑️ | ☑️ | ➖ | ☑️ | ☑️ | ☑️ numéro | ☑️ | ➖ | ➖ | ✅ mentions |
| **Portail stagiaire** | ☑️ | ☑️ | ☑️ | ☑️ | ✅ token/expire/révoque | ✅ non-énum | ☑️ acces-invalide | ➖ | ☑️ | ☑️ | ✅ anonym+révoc (C5) | ➖ |
| **Pages admin (40)** | ☑️ | ☑️ | ☑️ | ☑️ | ➖ | ✅ auth+rôle | ✅ notFound | ➖ | ➖ | ➖ | ➖ | ➖ |
| **Indicateurs/conformité** | ☑️ | ☑️ | ☑️ | ☑️ <5 obs « — » | ☑️ off.32 validée | ☑️ | ☑️ | ➖ | ☑️ cache | ➖ | ➖ | ☑️ |
| **BPF** | ☑️ | ☑️ par financeur | ☑️ stub vide | ☑️ | ☑️ marqueur année | ☑️ | ☑️ | ➖ | ☑️ | ➖ | ➖ | ☑️ DREETS |

Notes : les cases ☑️ (TESTÉ/CODE) sur les server actions tiennent à l'auth `requireAdminWrite` qui
empêche l'appel direct depuis un probe ; leurs **gardes pures** sont prouvées RUNTIME (probe04). Le seul
🟡 résiduel applicatif est le **gate score≥80 à la publication** (décision-Will : validation humaine =
garde actuelle), tracé dans QUESTIONS-WILL.
