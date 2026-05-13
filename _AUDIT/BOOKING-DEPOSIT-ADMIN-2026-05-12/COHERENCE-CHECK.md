# COHERENCE-CHECK — Vérification cross-files audit Booking V2

> Audit de cohérence transverse 2026-05-12 sur les 6 livrables V2 (MANIFEST, SYNTHESE-FINALE, NO-GO-ALERT, STOP-AND-ASK, 03-ARCHITECTURE-CIBLE, 04-PLAN-EXECUTION) + cross-check sur 00-REALITY-CHECK, 01-INVENTAIRE-E2E, 02-BENCHMARKS et les 11 agents.
>
> Mode AUDIT-ONLY. Aucune modification des fichiers V2.

---

## 1. Résumé exécutif

- **État global** : 🚨 INCOHÉRENCES MAJEURES (sur chiffres et politique d'échéancier surtout, vocabulaire global OK)
- **Nombre d'incohérences détectées** : **22** (5 majeures, 11 mineures, 6 typographiques)
- **Sévérité Top 3** :
  1. **Total V1** divergent entre MANIFEST/SYNTHESE/NO-GO (50-55 j) et 04-PLAN §3 Section B (57-65 j, médiane 60 j) et STOP-AND-ASK (45-55 j) — référentiel : 50-55 j → 04-PLAN à reconcilier.
  2. **Politique d'échéancier** (D40) divergente entre STOP-AND-ASK (50/50, 30/30/40), 03-ARCH §5.14 (50/50, 30/30/40) et 04-PLAN X.0 D-SEUILS (30/70, 30/40/30, 30/30/30/10). Trois lectures contradictoires d'une même décision.
  3. **Sprints V2+ reportés** : MANIFEST §1.7 et NO-GO listent 6 sprints, 04-PLAN §5 liste 12 sprints V2+ (Q1/Q2/EI/VIES/MC/CR/VID/PDP/SMS/STR/MUL/BBR).

---

## 2. Incohérences vocabulaire

| Fichier                                                              | Ligne                | Problème                                                                                                                                                                                                                                                                   | Correction proposée                                                                                                    |
| -------------------------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| MANIFEST.md, NO-GO-ALERT.md, STOP-AND-ASK.md, 03-ARCH.md, 04-PLAN.md | global               | Mention `cabinet IA opérationnel` absente. Présente uniquement dans `SYNTHESE-FINALE.md:3`. Le référentiel demande ≥ 1× par fichier.                                                                                                                                       | Injecter le terme `cabinet IA opérationnel` dans l'intro de chacun des 5 fichiers V2 manquants.                        |
| STOP-AND-ASK.md                                                      | 15                   | Section titrée « D33 — Devis Yousign NON universel (REMPLACÉ PAR DOCUSEAL) ». Reformulation hybride qui peut induire en erreur (lecture rapide = « D33 acte Yousign »).                                                                                                    | Renommer « D33 — Devis NON universel (signature via DocuSeal, cf. D36) ». Aligner le wording sur MANIFEST §3 ligne 41. |
| 03-ARCH.md                                                           | 1476                 | « 5.17.4 Migration vers Yousign V2+ (option) » — propose Yousign comme évolution V2+. Pas faux mais s'oppose à la doctrine V2.PDP (E-signature qualifiée eIDAS QES upgrade) listée dans 04-PLAN §5.                                                                        | Préciser « ou autre QTSP eIDAS QES (cf. 04-PLAN V2.PDP) » pour ne pas re-citer Yousign comme cible nominale.           |
| 03-ARCH.md                                                           | 28-31, 82, 1428-1488 | Vingt-deux mentions de « Yousign » dans 03-ARCH — toutes en mode comparatif (« vs Yousign », « Yousign rejeté », « Yousign V2+ option »). C'est conforme au référentiel (traçabilité historique) mais aucune n'est explicitement balisée « REJETÉ » dans §5.17 comparatif. | OK fonctionnel. Ajouter une note d'ouverture en tête de §5.17 : « DocuSeal RETENU — Yousign REJETÉ (cf. D36) ».        |
| MANIFEST.md                                                          | 122                  | Renvoi « 25 templates » alors que la liste 03-ARCH §5.7 contient 30 entrées (cf. §3 ci-dessous). Vocabulaire OK mais chiffre incohérent.                                                                                                                                   | Voir §3.                                                                                                               |

**Constat global** : aucune occurrence résiduelle traite Yousign comme cible V1. La doctrine « DocuSeal partout » est respectée. Le mot « cabinet IA opérationnel » manque dans 5 / 6 fichiers V2.

---

## 3. Incohérences chiffres

### 3.1 Total V1 (MAJEUR)

| Fichier            | Ligne               | Valeur déclarée                                   |
| ------------------ | ------------------- | ------------------------------------------------- |
| MANIFEST.md        | 133, 75 (table), 92 | **~50-55 j** + 0,5j Will                          |
| SYNTHESE-FINALE.md | 46, 106, 180        | **~50-55 j** + 0,5j Will                          |
| 🚨-NO-GO-ALERT.md  | 75                  | **~50-55 j** + 0,5j Will                          |
| 03-ARCH.md         | —                   | (pas chiffré)                                     |
| 04-PLAN.md         | 75                  | **~50-55 j** (intro Section 1)                    |
| 04-PLAN.md         | 1338                | **~57-65 j**, médiane **~60 j** (Section B Total) |
| 04-PLAN.md         | 1461                | Chemin critique long **~46-50 j**                 |
| 04-PLAN.md         | 1468                | Chemin critique optimisé **~40-45 j**             |
| 04-PLAN.md         | 1582                | « ~57-65 j » répété                               |
| STOP-AND-ASK.md    | 220                 | **~45-55 j**                                      |

**Verdict** : 4 valeurs différentes pour le même total (45-55, 50-55, 57-65, 60). À aligner sur la valeur référentiel **50-55 j**. 04-PLAN §3 Section B est le coupable principal (somme min/max table = 57-65 mais ignore parallélisations) → soit corriger la table, soit accepter 57-65 brut + parallélisation 40-45 et propager dans les autres fichiers.

### 3.2 Nombre de tables nouvelles (MAJEUR)

| Fichier            | Ligne    | Valeur déclarée                           | Liste réelle                                                                                                                                       |
| ------------------ | -------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| MANIFEST.md        | 119, 161 | « 14 tables nouvelles »                   | —                                                                                                                                                  |
| SYNTHESE-FINALE.md | 163, 244 | « 14 tables nouvelles »                   | énumère 16 noms entre parenthèses                                                                                                                  |
| NO-GO-ALERT.md     | 120      | « 14 tables »                             | —                                                                                                                                                  |
| 03-ARCH.md         | 92       | « **14 tables nouvelles** »               | liste numérotée **1-16** (Payment ... BookingTransition)                                                                                           |
| 04-PLAN.md         | 131      | « 8 tables + extensions » (X.1 périmètre) | détaille 8 dans X.1, ajoute Quote/ContractTemplate/ContractDocument/DocusealWebhookEvent/CadrageMeeting/CapacityWindow dans X.3 + X.6 + X.7 + X.16 |

**Verdict** : la liste réelle est de **16 tables nouvelles** (Payment, Invoice, Refund, StripeWebhookEvent, DocusealWebhookEvent, ContractDocument, ContractTemplate, Quote, CadrageMeeting, OnboardingDoc, CapacityWindow, PricingConfig, PaymentScheduleProfile, BookingPaymentSchedule, SiteSetting, BookingTransition). Toutes les mentions « 14 tables » sont à corriger en « 16 tables ».

### 3.3 State machine — 22 valeurs vs 27-29 énumérées

| Fichier            | Ligne                   | Annoncé                                | Énuméré                                                               |
| ------------------ | ----------------------- | -------------------------------------- | --------------------------------------------------------------------- |
| MANIFEST.md        | 120, 161                | ~22 valeurs                            | —                                                                     |
| SYNTHESE-FINALE.md | 164, 244                | ~22 valeurs                            | —                                                                     |
| NO-GO-ALERT.md     | 37, 120                 | ~22 cibles V1                          | —                                                                     |
| 03-ARCH.md         | 70, 110, 116, 877, 1005 | ~22 valeurs / « 22 statuts effectifs » | enum BookingStatus §5.1.2 contient **29 entrées** (draft + 28 autres) |
| 04-PLAN.md         | 216, 377, 1370, 1499    | 4 → 22 valeurs                         | enum énuméré X.4 contient **27 entrées** (sans draft)                 |

**Verdict** : annoncé partout « ~22 », réalité **27 (04-PLAN) ou 29 (03-ARCH)**. À aligner — soit le périmètre est de ~22 statuts business (en excluant terminaux dérivés `refunded_partial/full`, `lost_other_won`, `expired_no_response` ?), soit le nombre annoncé est trop bas. Recommandation : adopter **~28 valeurs** comme chiffre référentiel et harmoniser 04-PLAN et 03-ARCH (qui diffèrent entre eux : 03-ARCH a `quote_required`, `expired_no_response`, `reminded_j7` etc. — 04-PLAN ajoute `disputed`, `lost_other_won`, `expired_unpaid`).

### 3.4 Server Actions — 20 vs 25

| Fichier            | Ligne                                  | Valeur                                                        |
| ------------------ | -------------------------------------- | ------------------------------------------------------------- |
| MANIFEST.md        | 121, 161                               | ~20                                                           |
| SYNTHESE-FINALE.md | 165, 244                               | ~20                                                           |
| NO-GO-ALERT.md     | 120                                    | ~20                                                           |
| 03-ARCH.md         | 70 (titre §5.2), 167 (SYNTHESE re-cit) | « ~20 actions »                                               |
| 03-ARCH.md         | 752                                    | « Total : **~25 Server Actions cible V1** » (conclusion §5.2) |

**Verdict** : 03-ARCH se contredit lui-même (titre §5.2 « ~20 » vs conclusion « ~25 »). Recommandation : adopter **~25** comme chiffre référentiel (la conclusion réfère à la somme V1+A1-A15+C1-C5+P1-P5+V3 = ~25 actions).

### 3.5 Templates emails — 25 vs 30 vs 39

| Fichier            | Ligne        | Annoncé                                                                   | Énuméré                                                                                                          |
| ------------------ | ------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| MANIFEST.md        | 122, 161     | ~25 templates                                                             | —                                                                                                                |
| SYNTHESE-FINALE.md | 23, 169, 244 | ~25 templates                                                             | —                                                                                                                |
| NO-GO-ALERT.md     | 46, 120      | ~25 templates                                                             | —                                                                                                                |
| 03-ARCH.md         | 18           | « ~25 templates »                                                         | tableau §5.7 contient **30 entrées numérotées 1-30**                                                             |
| 03-ARCH.md         | 1088         | « V1 cap fonctionnel : 25 templates strictement requis (1-25 ci-dessus) » | mais lignes 26-30 sont étiquetées « optionnelles »                                                               |
| 04-PLAN.md         | 908-954      | « ~25 templates »                                                         | tableau X.13 contient **38 entrées numérotées 1-38**, conclusion « ~25 nouveaux + ~14 existants = ~39 au total » |

**Verdict** : flou. Référentiel annoncé `~25` (templates STRICTEMENT REQUIS V1) tandis que les listes étendues vont à 30 ou 38. À aligner : soit corriger les listes à 25 lignes max, soit afficher « 25 nouveaux + ~14 existants ≈ 39 au total » partout (cf. 04-PLAN ligne 954).

### 3.6 Crons & workers — 18 vs 20 jobs

| Fichier            | Ligne             | Annoncé                             | Énuméré                                                                                                                                                                         |
| ------------------ | ----------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MANIFEST.md        | 123, 161          | ~18 jobs                            | —                                                                                                                                                                               |
| SYNTHESE-FINALE.md | 22, 168, 244      | ~18 jobs                            | —                                                                                                                                                                               |
| NO-GO-ALERT.md     | 45, 120           | ~18 jobs / « ~15 sur 18 manquants » | —                                                                                                                                                                               |
| 03-ARCH.md         | 18, 71, 169, 1018 | « ~18 jobs »                        | tableau §5.6 va jusqu'à **#20** + ligne `webhook-dlq-retry` #18 + `retention-purge-worker` #19 + `refund-trigger` #20                                                           |
| 04-PLAN.md         | 854, 896          | « 18 jobs V1 »                      | tableau X.12 va jusqu'à **#20** (`capacity-recompute` #19, `geo-conflict-alert` #20) + 3 jobs existants (option-expiration, option-reminder, retention-purge) hors numérotation |

**Verdict** : annoncé `~18`, listes vont à `#20`. Recommandation : afficher « 18 nouveaux + 2 étendus = 20 jobs cron au total V1 » et aligner. Le chiffre 18 désigne les **nouveaux** jobs.

### 3.7 Sprints V2+ — 6 vs 12

| Fichier            | Ligne        | Valeur                                                                                                         |
| ------------------ | ------------ | -------------------------------------------------------------------------------------------------------------- |
| MANIFEST.md        | 89, 135, 161 | **6 sprints V2+** (Qualiopi, OPCO, e-invoicing FR PPF/PDP, VIES API, multi-currency, réconciliation comptable) |
| SYNTHESE-FINALE.md | 183          | **6 sprints V2+** (mêmes 6)                                                                                    |
| NO-GO-ALERT.md     | 121          | « 6 sprints V2+ reportés »                                                                                     |
| 04-PLAN.md         | 1474-1487    | **12 sprints V2+** (Q1/Q2/EI/VIES/MC/CR/VID/PDP/SMS/STR/MUL/BBR), total 30-40 j ingé                           |

**Verdict** : divergence majeure. 04-PLAN ajoute 6 sprints non listés dans la SSOT (V2.VID provider visio, V2.PDP QES, V2.SMS, V2.STR Stripe Embed, V2.MUL multi-admin, V2.BBR branding PDF). Soit harmoniser MANIFEST/SYNTHESE/NO-GO à 12 sprints, soit retirer les 6 supplémentaires de 04-PLAN §5.

### 3.8 Effort V2+

| Fichier            | Ligne | Valeur            |
| ------------------ | ----- | ----------------- |
| MANIFEST.md        | 135   | « 17-25 j ingé »  |
| SYNTHESE-FINALE.md | 183   | « 17-25 j ingé »  |
| 04-PLAN.md         | 1489  | « ~30-40 j ingé » |

**Verdict** : divergence directement liée au 3.7 (6 sprints → 17-25 j ; 12 sprints → 30-40 j). À résoudre conjointement.

### 3.9 ADRs

| Fichier    | Ligne            | Valeur                            |
| ---------- | ---------------- | --------------------------------- |
| 04-PLAN.md | 116 (X.0)        | « 9 ADRs squelettes : 0011-0019 » |
| 04-PLAN.md | 1278-1289 (X.20) | « 21 ADRs : 0011-0021 »           |

**Verdict** : numérotation cohérente (0020 ajouté dans X.2 ADR Radar, 0021 ajouté dans X.17 numérotation immuable) mais le titre « 9 ADRs » de X.0 contredit le « 21 ADRs » de X.20. À aligner : X.0 squelette = 9, X.20 finalisation = 11 ADRs nouveaux (0011-0021) — pas 21. **L'écriture « 21 ADRs » au X.20 est très probablement une faute de frappe pour « 11 ADRs »**.

### 3.10 Score consolidé

| Fichier            | Ligne      | Valeur                     |
| ------------------ | ---------- | -------------------------- |
| MANIFEST.md        | 20, 113    | 37.5 / 100 (table : 37.54) |
| SYNTHESE-FINALE.md | 28, 30, 40 | 37.5 / 100 (table : 37.54) |
| NO-GO-ALERT.md     | 14         | 37.5 / 100                 |
| 03-ARCH.md         | —          | non cité                   |
| 04-PLAN.md         | —          | non cité                   |

**Verdict** : OK cohérent. 03-ARCH et 04-PLAN ne re-citent pas le score (champ de l'audit cible, pas du verdict V0) — acceptable.

### 3.11 Délai prévisionnel 10-12 semaines

Cohérent dans 5 fichiers (MANIFEST L134, SYNTHESE L46+L181, NO-GO L76, STOP-AND-ASK L220, 04-PLAN L75+L1338). ✅ OK.

### 3.12 Cap multi-options

Cohérent (3 par défaut) partout dans les 6 V2. ✅ OK.

### 3.13 Sub-tiers Approfondie 890/1390/1990

`04-PLAN.md:136` mentionne « Approfondie 890/1390/1990 ». Cohérent avec la mémoire `axionia_pricing_zero_hardcode` (« à valider »). ✅ OK.

---

## 4. Incohérences numérotation D / Q / X

### 4.1 STOP-AND-ASK intra-fichier (MAJEUR)

| Fichier         | Ligne | Problème                                                                                                                                                                         |
| --------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| STOP-AND-ASK.md | 7     | Annonce « D33→D40 » alors que le fichier décrit explicitement **D33-D43** (lignes 15, 21, 26, 31, 37, 47, 55, 64, 75, 80, 86) et conclut ligne 205 « D33-D43 (voir ci-dessus) ». |

**Correction** : remplacer L7 par « D33→D43 ».

### 4.2 D1 vs D40 — politique d'acompte par défaut (MAJEUR)

| Fichier                     | Ligne                   | Valeur D-acompte par défaut                                                                                                                |
| --------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| MANIFEST.md                 | 37 (D1)                 | « 30 % acompte par défaut (configurable par format, cf. D35) »                                                                             |
| STOP-AND-ASK.md             | 64-73 (D40)             | « ≤ 1 500 = 100 % / 1500-5000 = 50 % + 50 % / 5000-15000 = 30/30/40 / >15000 = 30/30/40 »                                                  |
| 03-ARCH.md                  | 1318-1325 (§5.14.1)     | « tiny 100 % / small 50 + 50 / medium 30+30+40 / large 30/30/40 ou mensuel »                                                               |
| 04-PLAN.md                  | 100-107 (X.0 D-DEPOSIT) | « essentielle 30 / approfondie 30 / conference 50 / dirigeants 30 / gagner_du_temps 50 / intervention_claude 30 / audit_flash_onsite 100 » |
| 04-PLAN.md                  | 109-113 (X.0 D-SEUILS)  | « <1500=100% / 1500-5000=30/70 / 5000-15000=30/40/30 / ≥15000=30/30/30/10 »                                                                |
| Q10 (STOP-AND-ASK L179-188) | —                       | « OK D40 ? » — question ouverte mais nourrie des données STOP-AND-ASK                                                                      |

**Verdict** : **trois grilles d'échéancier différentes** :

- STOP-AND-ASK + 03-ARCH (cohérents entre eux) : 100 / 50-50 / 30-30-40 / 30-30-40
- 04-PLAN X.0 D-SEUILS : 100 / 30-70 / 30-40-30 / 30-30-30-10
- 04-PLAN X.0 D-DEPOSIT (par format, pas par seuil) : 30 / 30 / 50 / 30 / 50 / 30 / 100

À trancher d'urgence : c'est une politique commerciale, pas seulement un détail typo. Référentiel proposé : aligner sur STOP-AND-ASK D40 (validé par Will) et corriger 04-PLAN X.0 D-SEUILS.

### 4.3 Q1 → Q10 cohérence

| Fichier            | Lignes            | Cohérence                                                                                                                                                                                                                                                                                                                     |
| ------------------ | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MANIFEST.md        | 53-65 (Q1-Q10)    | OK même libellés que STOP-AND-ASK                                                                                                                                                                                                                                                                                             |
| SYNTHESE-FINALE.md | 190-199 (Q1-Q10)  | OK                                                                                                                                                                                                                                                                                                                            |
| STOP-AND-ASK.md    | 94-188 (Q1-Q10)   | OK source                                                                                                                                                                                                                                                                                                                     |
| 04-PLAN.md         | X.0 lignes 96-113 | 7 décisions D-\* nommées différemment (D-PROV-VISIO, D-STORAGE, D-PDF-MOTEUR, D-LEGAL, D-DEPOSIT, D-CAP-OPTIONS, D-SEUILS-ECHEANCIER) au lieu de Q1-Q10. Cohérence sémantique partielle (Q1↔D-PROV-VISIO, Q3↔D-PDF-MOTEUR, Q4↔D-STORAGE, Q2↔D-LEGAL, Q10↔D-DEPOSIT/D-SEUILS), mais Q5, Q6, Q7, Q8, Q9 absentes de 04-PLAN X.0 |

**Verdict** : 04-PLAN X.0 utilise une numérotation parallèle (D-XXX) qui n'est pas mappée explicitement aux Q1-Q10. Recommandation : ajouter un tableau de mapping Q↔D dans 04-PLAN X.0 et compléter pour Q5-Q9 manquantes (drag-drop calendrier, refunds auto/manuel, NPS J+1, admin EN bilingue, secteurs sensibles NDA).

### 4.4 Sprints X.0 → X.20

Tous les fichiers utilisent uniformément X.0 → X.20 (vérifié : MANIFEST L132, SYNTHESE L182, NO-GO L75, STOP-AND-ASK L217-218, 03-ARCH L13-15 + DAG, 04-PLAN tableau). ✅ OK.

### 4.5 Référence à « 8 entrées validées » Sprint X.0 vs Q1-Q10

| Fichier         | Ligne               | Valeur                                      |
| --------------- | ------------------- | ------------------------------------------- |
| 04-PLAN.md      | 121 (X.0 livrables) | « 8 entrées validées dans STOP-AND-ASK.md » |
| STOP-AND-ASK.md | 94-188              | Q1-Q10 = **10 questions**                   |

**Verdict** : divergence 8 vs 10. À corriger : remplacer « 8 entrées » par « 10 entrées Q1-Q10 ».

---

## 5. Renvois croisés cassés

| Fichier source     | Ligne                 | Renvoi                                                                       | État                                                                                                                                                          |
| ------------------ | --------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MANIFEST.md        | 20                    | `SYNTHESE-FINALE.md § 2`                                                     | ✅ OK (verdict 🔴 NO-GO bien en §2 SYNTHESE L34-50)                                                                                                           |
| MANIFEST.md        | 39, 53, 159           | `STOP-AND-ASK.md § 1` et § 2                                                 | ✅ OK (§1 = décisions tranchées, §2 = restantes)                                                                                                              |
| SYNTHESE-FINALE.md | 13                    | `§ 7.1 prompt source`                                                        | ⚠️ non vérifiable depuis ce dossier (prompt source = `_AUDIT/PROMPT-BOOKING-DEPOSIT-ADMIN-2026.md`) — supposé OK                                              |
| SYNTHESE-FINALE.md | 161, 178, 244         | `03-ARCHITECTURE-CIBLE.md`                                                   | ✅ OK fichier existant                                                                                                                                        |
| SYNTHESE-FINALE.md | 30, 105, 119, 245     | `04-PLAN-EXECUTION.md`                                                       | ✅ OK                                                                                                                                                         |
| NO-GO-ALERT.md     | 14                    | `SYNTHESE-FINALE.md § 1`                                                     | ✅ OK                                                                                                                                                         |
| NO-GO-ALERT.md     | 81                    | `STOP-AND-ASK.md § 2`                                                        | ✅ OK                                                                                                                                                         |
| 03-ARCH.md         | 88, 1462              | `Agent 3 §5.2` (24 transitions)                                              | ⚠️ agent-03 décrit T1-T24 (vérifié L248-250 ci-dessus) — ✅ OK                                                                                                |
| 03-ARCH.md         | 233                   | `mémoire axionia_pricing_centralization`                                     | OK (référence externe)                                                                                                                                        |
| 04-PLAN.md         | 251 (X.1 SOURCES GAP) | `Agent 4 P0-1 à P0-5 + Agent 8 P0-2 + Agent 11 P0-1/2/3/6/7 + Agent 10 P1-1` | ⚠️ Agent 11 P0-1/2/3/6/7 référencé alors que agent 11 n'a a priori que P0-1 à P0-7 (vérifié OK), Agent 10 P1-1 vérifié OK                                     |
| 04-PLAN.md         | 303 (X.2 SOURCES GAP) | `Agent 4 P0-1 à P0-6`                                                        | ⚠️ Agent 4 a P0-1/P0-2 dans la sortie agent (vérifié L23-24 ci-dessus), mais P0-6 doit pointer vers agent 8 P0-6 (anti open-redirect) — confusion potentielle |
| 04-PLAN.md         | 791 (X.10)            | `Agent 4 P0-2 (Invoice) + Agent 11 P0-1/2/6/7`                               | OK                                                                                                                                                            |
| 04-PLAN.md         | 904 (X.12)            | `Agent 6 P0-1 (15 jobs absents)`                                             | OK SYNTHESE rapporte « ~15 jobs sur 18 manquants V1 »                                                                                                         |
| 04-PLAN.md         | 975 (X.13)            | `Agent 7 P0-1 à P0-9 (10 templates absents + admin Telegram)`                | OK                                                                                                                                                            |

**Verdict** : aucun renvoi croisé clairement cassé entre les V2. Les renvois « cf. Agent N » sont tous résolus (1-11 existent). Quelques ambiguïtés sur le découpage P0-X mais pas de pointeur cassé.

---

## 6. Contradictions de fond

### 6.1 Calendrier visiteur — « 4 états » mais 5 états listés (MINEUR mais répété 5×)

| Fichier            | Ligne         | Texte                                                                                                                                        |
| ------------------ | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| MANIFEST.md        | 42            | « 4 états visibles (multi-options simultanées, cap configurable...) » + footer §5.4 « 4 états (🟢🟠🟡🔴⚫) »                                 |
| SYNTHESE-FINALE.md | 58            | « calendrier 4 états : 🟢🟠🟡🔴⚫ »                                                                                                          |
| STOP-AND-ASK.md    | 22            | « 4 états visibles : 🟢 Libre / 🟠 Pré-réservé / 🟡 Cap atteint / 🔴 Validé / ⚫ Bloqué admin »                                              |
| 03-ARCH.md         | 37, 1247-1252 | « Calendrier visiteur 4 états (vs 3 dans version précédente) : 🟢 Libre · 🟠 Pré-réservée · 🟡 Cap atteint · 🔴 Validée · ⚫ Bloquée admin » |
| 04-PLAN.md         | 480-484       | « UI calendrier visiteur (4 états) : libre / pré-réservé N / cap atteint / validé / bloqué » (5 états listés)                                |

**Verdict** : **5 emojis / 5 statuts énumérés**, mais l'intitulé dit « 4 états ». Confusion possible. Recommandation : adopter **5 états** (libre, pré-réservée, cap atteint, validée, bloquée admin) et corriger toutes les mentions « 4 états » → « 5 états ». Ou bien retirer ⚫ Bloquée admin de la liste publique (état admin, pas visiteur) → garder réellement 4 états visiteur.

### 6.2 Politique d'acompte par tranche / refund (MAJEUR — déjà signalé §4.2)

Cf. §4.2 ci-dessus. Trois grilles d'échéancier différentes dans STOP-AND-ASK, 03-ARCH et 04-PLAN — contradiction de fond directe.

### 6.3 Mode paiement hybride — enum `Payment.provider`

| Fichier            | Ligne                      | Enum                                                                                                                                     |
| ------------------ | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------ | ------------ |
| MANIFEST.md        | 50 (D42)                   | `stripe                                                                                                                                  | manual_wire | manual_check | manual_cash` |
| SYNTHESE-FINALE.md | 84                         | « Stripe Checkout + Customer Portal + mode hybride manuel » (sans enum explicite)                                                        |
| STOP-AND-ASK.md    | 84 (D42)                   | `stripe                                                                                                                                  | manual_wire | manual_check | manual_cash` |
| 03-ARCH.md         | 171 (§5.1.2), 264 (§5.1.5) | `PaymentProvider { stripe  manual_wire  manual_check  manual_cash }`                                                                     |
| 04-PLAN.md         | 160 (X.1 Payment)          | `provider PaymentProvider` (enum : `stripe_checkout`, `stripe_portal`, `manual_transfer`, `manual_check`, `manual_card`, `manual_other`) |

**Verdict** : enum **divergent** entre 04-PLAN (6 valeurs : stripe_checkout, stripe_portal, manual_transfer, manual_check, manual_card, manual_other) et MANIFEST / STOP-AND-ASK / 03-ARCH (4 valeurs : stripe, manual_wire, manual_check, manual_cash). À aligner — le 4-valeurs est le référentiel doctrine.

### 6.4 Grille refund CGV (MAJEUR)

| Fichier            | Ligne                                | Grille                                                                                                 |
| ------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------ | ----- | --- | --- |
| 03-ARCH.md         | 998 (§5.5.1 commentaire)             | « refund selon grille CGV (>7d=100% / 7-2d=50% / <2d=0%) »                                             |
| 03-ARCH.md         | 201 (Booking.cancellationWindow)     | « `>7d` / `7-2d` / `<2d` / `fm` »                                                                      |
| 04-PLAN.md         | 422 (X.4 I8)                         | « Défaut V1 : J-15+ = 50 % acompte refund / < J-15 = acompte conservé / force majeure = 100 % refund » |
| 04-PLAN.md         | 211 (X.1 Booking.cancellationWindow) | enum `>15d                                                                                             | 15-2d | <2d | fm` |
| 04-PLAN.md         | 1043, 1136 (X.15 + X.17)             | « ≥ J-15 = 50 % refund / <J-15 = acompte conservé / fm = 100 % »                                       |
| MANIFEST.md        | 37 (D5)                              | « non-remboursable sauf force majeure » (générique)                                                    |
| SYNTHESE-FINALE.md | —                                    | non explicite                                                                                          |

**Verdict** : **deux politiques refund différentes** dans 03-ARCH (J-7 / J-2) et 04-PLAN (J-15). Le seuil métier `cancellationWindow` est `>7d` dans 03-ARCH §5.1.3 et `>15d` dans 04-PLAN X.1. À aligner — recommandation 04-PLAN J-15 (plus protecteur côté prestataire).

### 6.5 Tables nouvelles V1 — liste 03-ARCH vs SYNTHESE

| Fichier            | Liste                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SYNTHESE-FINALE.md | L163 énumère 16 noms : Payment, Invoice, Refund, StripeWebhookEvent, DocusealWebhookEvent, ContractDocument, ContractTemplate, Quote, CadrageMeeting, OnboardingDoc, CapacityWindow, PricingConfig, PaymentScheduleProfile, BookingPaymentSchedule, SiteSetting, BookingTransition                                                                                                                  |
| 03-ARCH.md         | L92-109 énumère **16 noms identiques** mais numérote 1-16 et annonce « 14 tables nouvelles » au-dessus                                                                                                                                                                                                                                                                                              |
| MANIFEST.md        | n'énumère pas, dit « 14 tables » + extensions                                                                                                                                                                                                                                                                                                                                                       |
| 04-PLAN.md         | X.1 décrit 8 tables (PricingConfig, PaymentScheduleProfile, BookingPaymentSchedule, Payment, Invoice, Refund, StripeWebhookEvent, SiteSetting) ; X.3 ajoute ContractTemplate, ContractDocument, DocusealWebhookEvent ; X.6 ajoute CadrageMeeting ; X.7 ajoute Quote ; X.10 utilise OnboardingDoc en passant ; X.16 ajoute CapacityWindow ; X.4 ajoute BookingTransition. Total 04-PLAN = 16 tables. |

**Verdict** : tous les fichiers énumèrent **16 noms** mais 4 fichiers (MANIFEST, SYNTHESE, NO-GO, 03-ARCH) affichent le chiffre **14**. Erreur de comptage homogène. À corriger en `16 tables nouvelles`.

### 6.6 TVA agnostique — `legal.ts:44` partout cohérent

| Fichier            | Ligne   | Mention                                                                |
| ------------------ | ------- | ---------------------------------------------------------------------- |
| MANIFEST.md        | 30, 150 | « default scénario EE selon legal.ts:44 »                              |
| SYNTHESE-FINALE.md | 170     | « default scénario EE selon legal.ts:44 actuel »                       |
| 03-ARCH.md         | 9, 1486 | « Doctrine: TVA-agnostique »                                           |
| 04-PLAN.md         | 99      | « scénario par défaut V1 reste OÜ EE comme aujourd'hui (legal.ts:44) » |

**Verdict** : ✅ OK aligné.

### 6.7 Skip cadrage `audit_flash_onsite`

| Fichier     | Localisation                                |
| ----------- | ------------------------------------------- |
| 03-ARCH.md  | §5.5.2 L1007-1014                           |
| 04-PLAN.md  | X.4 I3 L412 + X.6 « Skip cadrage » L552-553 |
| MANIFEST.md | D9 L37                                      |

**Verdict** : ✅ doctrine cohérente partout.

### 6.8 Total V2+ effort

Cf. §3.8 ci-dessus — divergence directe avec §3.7.

---

## 7. Recommandations (priorité décroissante)

### P0 — Corrections doctrine

1. **Aligner le total V1 sur 50-55 j** (MANIFEST/SYNTHESE/NO-GO/STOP-AND-ASK) ou bien adopter 57-65j brut + 40-45j optimisé (04-PLAN) dans **tous** les fichiers V2. Recommandation forte : 50-55 j (référentiel SSOT) et corriger la table 04-PLAN §3 Section B en intégrant les parallélisations X.2//X.3, X.9//X.10, X.15//X.16.
2. **Trancher la grille d'échéancier par tranche** (3 versions actuelles). Recommandation : adopter la grille STOP-AND-ASK D40 (validée par Will) = 100 / 50-50 / 30-30-40 / 30-30-40, et corriger 04-PLAN X.0 D-SEUILS-ECHEANCIER.
3. **Aligner la grille refund** (J-7/J-2 dans 03-ARCH vs J-15 dans 04-PLAN). Recommandation : J-15 (cf. 04-PLAN), corriger 03-ARCH §5.5.1 + §5.1.3 (`cancellationWindow`).
4. **Aligner liste sprints V2+ et effort** : choisir entre « 6 sprints / 17-25 j » (MANIFEST/SYNTHESE/NO-GO) et « 12 sprints / 30-40 j » (04-PLAN §5). Si l'extension à 12 est volontaire (visio, QES, SMS, Stripe Embed, multi-admin, branding), propager dans MANIFEST + SYNTHESE + NO-GO.
5. **Corriger « 14 tables » → « 16 tables »** dans MANIFEST L119+L161, SYNTHESE L163+L244, NO-GO L120, 03-ARCH L92 (la liste va à 16). Idem corriger le chiffre dans MANIFEST §1.4 + SYNTHESE §6 + 03-ARCH §5.1.1 introduction.

### P1 — Corrections numérotation et typo

6. **STOP-AND-ASK L7** : remplacer « D33→D40 » par « D33→D43 » (incohérence intra-fichier explicite).
7. **04-PLAN X.0 « 8 entrées »** → « 10 entrées Q1-Q10 ».
8. **04-PLAN X.20 « 21 ADRs »** → « 11 ADRs » (très probablement typo, les ADRs listées sont 0011-0021 soit 11).
9. **04-PLAN X.0** : ajouter un tableau de mapping Q1-Q10 ↔ D-XXX et compléter pour Q5, Q6, Q7, Q8, Q9 (drag-drop, refunds auto/manuel, NPS, admin EN, secteurs sensibles NDA).
10. **State machine BookingStatus** : aligner les listes 03-ARCH §5.1.2 (29 valeurs) et 04-PLAN X.4 (27 valeurs). Soit harmoniser à 22 (réduire les listes), soit afficher partout « ~28 valeurs ». Liste de référence à trancher.
11. **Enum `PaymentProvider`** : aligner entre 4 valeurs (MANIFEST/STOP-AND-ASK/03-ARCH : `stripe | manual_wire | manual_check | manual_cash`) et 6 valeurs (04-PLAN X.1 : `stripe_checkout/stripe_portal/manual_transfer/manual_check/manual_card/manual_other`). Recommandation : adopter 4 valeurs doctrine.
12. **Calendrier 4 vs 5 états** : trancher la formulation. Recommandation : « 5 états (dont ⚫ admin invisible visiteur) » ou « 4 états visibles + 1 admin ». Aligner les 5 fichiers.

### P2 — Compléments rédaction

13. **Injecter « cabinet IA opérationnel »** dans l'intro des 5 fichiers V2 manquants (MANIFEST, NO-GO, STOP-AND-ASK, 03-ARCH, 04-PLAN).
14. **STOP-AND-ASK D33** : renommer titre pour ne pas commencer par « Devis Yousign » (lecture rapide trompeuse).
15. **03-ARCH §5.17.4** : préciser « QTSP eIDAS QES (cf. V2.PDP) » plutôt que re-citer Yousign comme évolution V2+.
16. **Tableau templates 03-ARCH §5.7** : aligner avec la mention « ~25 templates V1 » en marquant clairement entrées 26-30 comme « optionnelles V1.5 ».
17. **Tableau crons 03-ARCH §5.6 et 04-PLAN X.12** : afficher « 18 nouveaux + 2 étendus = 20 jobs ».
18. **Server Actions 03-ARCH §5.2** : harmoniser titre (« ~25 » dans la conclusion vs « ~20 » dans l'intro).

### P3 — Audit-only

19. Ne pas modifier les fichiers `agent-NN-*.md` (audit V0 snapshot — gel demandé par MANIFEST L77-87).
20. Ne pas modifier `00-REALITY-CHECK.md`, `01-INVENTAIRE-E2E.md`, `02-BENCHMARKS-2026.md` (fondations Phase 0/1/3).

---

## Annexe — Méthodologie

- Lecture intégrale des 6 fichiers V2 + spot-check sur les 4 sources (00, 01, 02, agents 03 / 04 / 10 / 11) pour les renvois croisés.
- Grep cross-files sur termes normés : `Yousign`, `DocuSeal`, `multi-options`, `cabinet IA opérationnel`, `deposit-validation-gated`, `10-12 semaines`, `37.5`, `14 tables / 16 tables`, `22 valeurs`, `D33...D43`, `Q1...Q10`.
- Quantification des occurrences par fichier (cf. §3 tableau totaux).
- Aucune modification effectuée sur les fichiers audités (mode AUDIT-ONLY).

**Fin du document `COHERENCE-CHECK.md`** · Audit transverse 2026-05-12 · 22 incohérences détectées, 5 majeures à traiter d'urgence.
