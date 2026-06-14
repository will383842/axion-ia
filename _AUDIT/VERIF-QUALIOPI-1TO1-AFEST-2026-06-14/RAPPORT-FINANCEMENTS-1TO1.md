# Rapport de conformité — Parité financement coaching 1-to-1 (2026-06-14)

> Phase complémentaire à la livraison AFEST 1-to-1 (PR #76). Objet : porter le
> coaching individuel à la **parité complète des dispositifs de financement** avec
> les formations collectives — OPCO (ventilation horaire + subrogation + convention
> tripartite), CPF/EDOF, France Travail (AIF/POEI/CSP), France Compétences (RNCP/RS),
> BPF et harmonisation off.30/31. Jusqu'ici le 1-to-1 ne gérait que le forfait OPCO.

## 1. Périmètre livré (commit `633d0745`)

| Dispositif | Formations (avant) | 1-to-1 (avant) | 1-to-1 (après) |
|---|---|---|---|
| OPCO forfait + subrogation | ✅ | ✅ | ✅ |
| OPCO **ventilation horaire** (barème €/h, €/j, plafonds) | ✅ | ❌ | ✅ |
| OPCO **convention tripartite** (L.6353-2) | ✅ | ❌ | ✅ |
| **CPF / EDOF** (vérif EDOF, reste à charge, kit) | ✅ | ❌ | ✅ |
| **France Travail** (AIF/POEI/CSP, pièces, kit, facture) | ✅ | ❌ | ✅ |
| **France Compétences** RNCP/RS + CPF-éligible | partiel | ❌ | ✅ |
| **Certificat de réalisation** (R.6313-3, centièmes) | ✅ | ❌ | ✅ |
| **BPF** ventilation collectif vs coaching | partiel | ❌ | ✅ |
| **off.30/31** appréciations & réclamations coaching | ✅ | partiel | ✅ |

## 2. Architecture (réutilisation, zéro duplication)

- `financement-1to1.ts` (pur, 16 tests) — `validateCoachingFinancement` (pré-requis
  bloquants par dispositif) + `computeCoachingFacturation` (ventilation horaire via
  `computeVentilationDossier` ou forfait via `computeForfait`, destinataire, reste à
  charge, aide France Travail). 1 bénéficiaire → `nbParticipants = 1`.
- `facturation-1to1.ts` — facture financement-aware : heures réelles = Σ
  `CompteRenduSeance.dureeMinutes / 60`, destinataire `opco|france_travail|entreprise`,
  `montantAideFranceTravailCents`. Réutilise `FacturePdf`.
- `kits-1to1.ts` — kit OPCO / kit CPF / kit France Travail / convention tripartite /
  certificat de réalisation. **Réutilisent les templates formation existants**
  (`KitOpcoPdf`, `KitCpfPdf`, `KitFranceTravailPdf`, `ConventionTripartitePdf`,
  `CertificatRealisationPdf`). Certificat idempotent.
- Actions : `setFinancementCoachingAction` (+ alerte non bloquante des pré-requis),
  `setCertificationCoachingAction`, `genererKitCoachingAction`. RBAC `requireAdminWrite`.
- UI `AfestPanel` : section financement dispositif-aware (OPCO/CPF/FT), certification
  France Compétences, boutons kits/convention/certificat/facture.
- BPF `service.ts` : `aggregateCoaching` expose désormais
  `nbHeuresStagiairesCoaching` + `nbCoachingParcours` ; CSV ventile « dont sessions
  collectives / dont coaching AFEST 1-to-1 ».
- Harmonisation : `coachingSessionId` câblé dans `reclamations-service`,
  `appreciation-service` (création + filtres).

## 3. Migration

`prisma/migrations/20260614150000_qualiopi_financements_1to1` — **100 % additive**
(ALTER TABLE ADD COLUMN, CREATE INDEX, ADD FK `coaching_session_id` SET NULL).
Aucun DROP. `migrate deploy`-safe.

## 4. Preuves (conformité prouvée, pas affirmée)

- **Typecheck** : `tsc --noEmit` → 0 erreur (heap 3 Go).
- **ESLint** : 0 sur tous les fichiers touchés.
- **Tests unitaires financement** : `financement-1to1.spec.ts` → 16/16 (validation
  par dispositif + ventilation horaire + plafond + aide France Travail).
- **Tests BPF** : 36/36 (dont agrégation coaching).
- **Suite Qualiopi** : 1476/1476.
- **Suite repo complète** : **16881 passed / 7 skipped / 0 failed** (373 fichiers).
- **Hooks pre-commit** : anti-siren / anti-hex / use-client / typecheck → OK.

## 5. Test end-to-end (DB jetable)

Script étendu : `scripts/qualiopi/e2e-afest-verif.ts` enchaîne désormais, sur un
parcours réel : barème OPCO horaire + convention + EDOF + RS → `validateCoachingFinancement`
(null) → kit OPCO / kit CPF / kit France Travail / convention tripartite / certificat
(idempotent) → facture ventilation horaire → `computeBpf` (heures + CA coaching + ligne
CSV). Rejouable via le RUNBOOK (DB pgvector jetable). Résultats : `e2e-results.json`.

**Statut d'exécution en session (2026-06-14)** : le replay sur DB live n'a pas pu
être exécuté dans cette session — Docker Desktop refusait de démarrer son moteur
Linux (distro WSL `docker-desktop` à l'état *Stopped*, backend absent) et la base de
dev (port 5433) en dépend ; aucune base pgvector à identifiants connus disponible.
Le script est néanmoins **étendu, typé (tsc 0) et rejouable en une commande** dès
qu'une base est disponible (cf. RUNBOOK). À noter : la **machinerie de génération
documentaire identique** (`generateDocument` + les 5 templates réutilisés ici) a
**déjà été prouvée en rendu PDF réel sur DB jetable** lors de la phase précédente
(PR #76, `e2e-results.json` + `pdf/`). La logique financement nouvelle est, elle,
couverte par 16 tests unitaires à assertions arithmétiques réelles.

## 6. Reste à Will (inchangé)

Numéros légaux (NDA/Qualiopi/SIRET dans `SiteSetting`), barèmes OPCO / codes RS-RNCP
par dossier, flags `afest_*` (false par défaut), agrément certificateur.
