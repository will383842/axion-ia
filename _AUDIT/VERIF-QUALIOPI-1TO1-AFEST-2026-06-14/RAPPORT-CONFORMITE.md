# Rapport de conformité — Vérification e2e adversariale « Qualiopi 1-to-1 / AFEST »

> Date : 2026-06-14 · Worktree `.claude/worktrees/qualiopi-1to1` (branche `qualiopi-1to1`, 3 commits, **non poussée**).
> Méthode : Workflow 16 agents adversariaux (réfutation) `wf_b736595a-909` + **test end-to-end réel sur DB jetable** (migrate deploy + fixture + services réels + PDF rendu).
> ⚠️ **AUCUNE correction lourde appliquée** — ce rapport est soumis à Will AVANT correction (consigne).

## 0. Verdict global : **NON production-ready en l'état** — le cœur fonctionne, mais gaps de conformité réels

Le **cœur de la chaîne est prouvé fonctionnel** (e2e vert : heures = Σ séances, attestation en heures, facture OPCO exonérée + subrogation, indicateurs AFEST automatiques, PDF réel généré). Mais la vérification adversariale révèle **1 défaut de correctness (scope) + plusieurs gaps de complétude** qui empêchent de déclarer « prêt pour l'audit COFRAC » sans corrections.

Tally : **3 PASS · 4 PARTIAL · 9 FAIL** (16 dimensions). 28 « blockers » bruts → **~6 distincts réels** ; 87 « majors » bruts (sur-report adversarial) → ~12 thèmes distincts.

## 1. Résultat du TEST END-TO-END (preuve réelle, DB jetable)

Fixture « dossier AFEST complet » seedée (bénéficiaire + tuteur + 3 séances 300+300+240 min + cartographie 3 tâches + mises en situation + phases réflexives + évaluation finale + contrat OPCO subrogation) → chaîne exécutée. Artefacts : `e2e-results.json` + `pdf/protocole-afest.pdf` (25 645 octets, en-tête `%PDF-` valide).

| Étape | Résultat | Statut |
|---|---|---|
| Heures réelles = Σ `dureeMinutes` | **14 h** (840 min) | ✅ exact |
| Protocole AFEST généré | `AXI-FORM-2026-001` + QR + rétention 2031 (+5 ans) + hash | ✅ |
| Attestation en heures | **« complete »** (14/14 = 100 %), `AXI-ATT-2026-001` + QR + rétention | ✅ |
| Facture OPCO | `AXI-FACT-2026-001`, destinataire `opco`, `tvaExoneree=true`, subrogation + n° dossier | ✅ |
| Indicateurs off.13/14/15/28 | tous **« couvert »** automatiquement | ⚠️ voir D-01 |
| Mode auditeur (manifeste) | 4 indicateurs présents, **mais `documents: []`** (pas de lien doc) | ⚠️ voir D-06 |
| PDF réel inspectable | protocole rendu, multi-sections, valide | ✅ |

## 2. Verdicts par dimension

| # | Dimension | Verdict | Finding clé |
|---|---|---|---|
| 1 | Documents générés | FAIL | positionnement_1to1 + satisfaction_1to1 non générés (générateurs sessionId-only) |
| 2 | Calcul des heures | **PASS** | Σ dureeMinutes exact, 11 tests verts |
| 3 | Présence / émargement 1-to-1 | FAIL | pas de feuille d'émargement signée 1-to-1 (heures auto-déclarées) — **certificateur-dépendant** |
| 4 | Indicateurs AFEST | FAIL | **off.13/14/15 = apprentissage, PAS AFEST (faux positif)** + manifeste sans docs |
| 5 | AFEST réglementaire | PARTIAL | analyse/alternance/protocole OK ; signatures non tracées |
| 6 | Parité formations / non-régression | FAIL | `attestation-partielle.tsx` sans format heures FR (oubli) ; collectif non régressé sinon |
| 7 | Financement OPCO | FAIL | facture coaching = **dead code (pas d'action)** ; **BPF ignore le coaching** |
| 8 | RGPD / rétention | FAIL | effacement + export RGPD **ne couvrent pas** CoachingSession/CR/nouveaux PII |
| 9 | SSOT « jamais dupliqués » | **PASS** | agrégation cohérente, pas de duplication |
| 10 | Légal / éditorial | **PASS** | aucun numéro inventé, « Axion-IA SAS », FR only |
| 11 | UI / charte / Web Vitals | FAIL | (à re-trier — sur-report ; AfestPanel = tokens charte, use-client justifié) |
| 12 | Qualité code | FAIL | (sur-report — typecheck 0, voir détail) |
| 13 | Migration / intégrité | PARTIAL | additive OK, drift 0 (e2e migrate deploy ✅) ; invariant XOR non contraint en DB |
| 14 | Sécurité / accès | PARTIAL | actions `requireAdminWrite` + Zod ✅ ; pas de portail bénéficiaire |
| 15 | Idempotence / concurrence | FAIL | **protocole non-idempotent** (re-gen = doublons) |
| 16 | Intégrité du flux | PARTIAL | FK/cascades OK ; bénéficiaire ad-hoc géré |

## 3. Défauts triés (réel vs scope vs faux positif)

### 🔴 BLOCKER / correctness — à corriger
- **D-01 — off.13/14/15 = FAUX POSITIF (apprentissage ≠ AFEST).** Le registre (`indicateurs-registre.ts:16-17`) dit explicitement `"app" → 13,14,15 (apprentissage/CFA)` vs `"afest" → 28`. Libellés confirmés par l'e2e : off.14 = « Exercice de la citoyenneté (apprenti) », off.15 = « droits et devoirs de l'apprenti ». **L'automatisation marque 13/14/15 « couvert » depuis le coaching AFEST → faux à l'audit COFRAC.** Le chantier (et son prompt d'origine « automatiser off.13/14/15/28 ») conflait apprentissage et AFEST. **Fix : automatiser UNIQUEMENT off.28 ; ne pas rendre 13/14/15 applicables/couverts depuis l'AFEST.** ⚠️ STOP & ASK (scope/architecture — le périmètre d'indicateurs était mal posé).
- **D-02 — Protocole AFEST non-idempotent** (`protocole-1to1.ts`). Re-génération = N `DocumentGenere` doublons (numéros AXI séquentiels). L'attestation EST idempotente (attestationGenereeAt+force) ; le protocole ne l'est pas. **Fix : champs `protocoleDocumentId`/`protocoleGenereeAt` + check idempotence + `force` (migration additive).**
- **D-03 — Facture coaching = dead code** (`facturation-1to1.ts`). Service complet mais **aucune action/UI ne l'appelle**. **Fix : `genererFactureCoachingAction` + bouton AfestPanel.**
- **D-04 — RGPD incomplet** (`portail/rgpd-service.ts`). `supprimerStagiaire()` n'anonymise pas les PII coaching (beneficiaireNom/Email/Entreprise, tuteurNom/Email, CR.notesConfidentielles) ; `exporterDonneesStagiaire()` n'exporte pas les ~7 tables coaching. **Gap introduit par les nouveaux champs PII.** Fix : étendre les deux fonctions.

### 🟠 MAJOR — à corriger (complétude dossier AFEST)
- **D-05 — Générateurs positionnement_1to1 + satisfaction_1to1 manquants.** Le kit (`docs/kits/1-to-1-afest/README.md`) promet ces 5 docs générés ; seuls les générateurs collectifs (sessionId) existent. Fix : variantes coachingSessionId + boutons.
- **D-06 — Mode auditeur sans documents AFEST.** `audit-dossier.ts` `INDICATEUR_DOCUMENT_TYPES[28]=[]` → le manifeste montre off.28 couvert mais 0 document. Fix : `28: ["protocole_afest", "attestation"]` (et retirer 13/14/15, cf. D-01).
- **D-07 — `attestation-partielle.tsx` sans format heures FR** (oubli ; j'avais corrigé `attestation.tsx`+protocole). Affiche « 7.5 h » au lieu de « 7,5 h ». Fix : appliquer `hFr()`.
- **D-08 — BPF ignore le coaching** (`bpf/service.ts`). Heures + CA des parcours AFEST jamais comptés → BPF DREETS incomplet. (Déjà noté « reste » dans STATE.) Fix : agréger CoachingContract/Session dans `computeBpf` + tests.

### 🟡 SCOPE / certificateur-dépendant — décision Will (NE PAS trancher seul)
- **D-09 — Présence/émargement 1-to-1 non signée** (DIM3, 10 defects). Les heures viennent des `CompteRenduSeance` auto-déclarés ; pas de **feuille d'émargement signée par séance** (bénéficiaire/formateur/tuteur) comme le collectif (`PresenceCreneau`). **Question certificateur : l'AFEST exige-t-elle un émargement signé par séance, ou le compte-rendu + attestation formateur suffit-il ?** Si oui : nouveau modèle de présence 1-to-1 + template émargement + signatures (chantier moyen).
- **D-10 — Signatures DocuSeal 3 parties** (protocole) : déféré assumé (STATE §). Décision : workflow e-signature post-certificateur.
- **D-11 — Portail bénéficiaire 1-to-1** : non implémenté (le plan P7 le mentionnait). Décision : in/out scope V1 ?

### ⚪ Faux positifs / à écarter
- DIM4 suggère d'**ajouter** protocole_afest au mapping off.13/14/15 → **incorrect** (ce ne sont pas des indicateurs AFEST ; cf. D-01, le bon fix est l'inverse).
- « Présence frauduleuse » (heures auto-déclarées) : en AFEST le formateur atteste ; l'émargement signé est un **renforcement** (D-09), pas une fraude intrinsèque.
- DIM11/12 (UI/code FAIL) : largement sur-report — `AfestPanel` utilise les tokens charte (anti-hex vert), `use-client` justifié, typecheck 0. À re-trier finement (probables nits).
- Enforcement « gated à false » compté comme défaut par certains agents : **c'est voulu** (ADR §7).

## 4. Ce qui est PROUVÉ conforme (PASS solides)
- Calcul des heures (Σ séances) exact, testé, e2e à 14 h.
- Numérotation immuable AXI-…, QR token, hash SHA-256, rétention 5 ans (`suppressionPrevueAt` 2031) sur protocole + attestation.
- Facture exonérée TVA 261-4-4° + subrogation OPCO + n° dossier.
- Automatisation off.28 (AFEST stricto sensu) depuis données coaching réelles.
- Migration additive : `prisma migrate deploy` applique TOUTES les migrations sur DB neuve sans erreur (drift 0 vérifié).
- Aucun numéro légal inventé ; « Axion-IA SAS » ; FR only ; SSOT non dupliqué.

## 5. Checklist « prêt pour l'audit Qualiopi » (état)
- [x] Protocole AFEST généré (numéro, QR, rétention)
- [x] Attestation en heures (Σ séances), seuils 80/60/0
- [x] Facture OPCO exonérée + subrogation
- [x] off.28 (AFEST) automatique + preuve
- [ ] **off.13/14/15 NE doivent PAS être couverts par l'AFEST (D-01)** ← bloquant
- [ ] Documents AFEST visibles dans le mode auditeur (D-06)
- [ ] Émargement signé par séance — **à valider certificateur (D-09)**
- [ ] positionnement_1to1 + satisfaction_1to1 (D-05)
- [ ] BPF intègre le coaching (D-08)
- [ ] RGPD effacement + export couvrent le coaching (D-04)
- [ ] Facture déclenchable depuis l'UI (D-03)
- [ ] Protocole idempotent (D-02)

## 6. Reste à Will (hors code)
- **Numéros légaux** : NDA, n° Qualiopi, SIRET → `SiteSetting` cat. qualiopi (placeholders en place).
- **Certificateur (3 questions ADR §7 toujours ouvertes)** : périmètre AFEST · tuteur obligatoire · habilitation formateur. **+ NOUVELLE question (D-09)** : émargement signé par séance requis ?
- **Décision scope** : portail bénéficiaire 1-to-1 (D-11), DocuSeal (D-10) — in/out V1.

## 7. Recommandation
Corriger d'abord le **lot « sûr » sans STOP&ASK** (D-02 idempotence, D-03 action facture, D-04 RGPD, D-06 manifeste, D-07 format partielle) puis re-vérifier. **D-01 (off.13/14/15)** et **D-09 (émargement signé)** sont des décisions de scope/conformité à valider avec toi/le certificateur avant correction. **Verdict actuel : NON production-ready ; chemin vers OUI = lot sûr + arbitrage D-01/D-09.**
