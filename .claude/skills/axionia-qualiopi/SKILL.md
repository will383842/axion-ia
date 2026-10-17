---
name: axionia-qualiopi
description: >-
  Implémenter, étendre, vérifier ou auditer le back-office "Formation Engine + Qualiopi Manager"
  d'Axion-IA — organisme de formation IA (SAS, NDA DREETS AURA, certification Qualiopi). Couvre la
  génération pédagogique IA (Backward Design, critique adversariale, grille qualité, supports), la
  gestion des sessions/stagiaires/formateurs, l'émargement présentiel & relevé de connexion distanciel,
  les documents légaux (convention L.6353-1, attestation D.6353-1, certificat de réalisation R.6313-3
  heures en centièmes, facture **avec TVA** — jamais d'exonération sans décision de Will), les financements (OPCO + subrogation
  convention tripartite, CPF/EDOF reste à charge, France Travail AIF/POEI/CSP), le BPF, les 22
  indicateurs Qualiopi, le registre des réclamations, le référent handicap, le portail stagiaire, le
  mode auditeur, le CRM/devis/offres_site et la conformité RGPD. Stack RÉELLE imposée : Next.js 16.2
  App Router + Prisma 5.22 + Postgres + NextAuth 5 (2FA) + BullMQ + @react-pdf/renderer + nodemailer +
  @anthropic-ai/sdk + next-intl (FR canonique) + Tailwind v4 tokens @theme. Server Actions (pas REST),
  admin sous src/app/[locale]/(admin)/[adminPrefix]/**, charte Editorial Premium Light (terracotta
  #c24a1b, bleu #1a4dd9, ivoire #faf8f3, mocha #2a2520, Manrope/Fraunces/Inconsolata). Respecte le
  contrat de build stub.invalid (ADR 0026), les budgets Web Vitals, et le SSOT pricing.ts. Déclencheurs :
  « Qualiopi », « Formation Engine », « organisme de formation », « NDA / DREETS », « OPCO / subrogation »,
  « CPF / EDOF », « France Travail / POEI », « certificat de réalisation », « émargement / relevé de
  connexion », « BPF », « 22 indicateurs », « registre réclamations », « référent handicap », « attestation
  de formation », « convention de formation », « portail stagiaire », « mode auditeur », « devis / CRM
  formation », « génération de supports de formation ». Formulations de lancement de Will à reconnaître :
  « lance/lancer le système Qualiopi », « le système Qualiopi et organismes », « démarrer le module
  Formation/Qualiopi », « le système OF / organisme de formation ». → activer ce skill puis ouvrir
  `AXION_IA_COMPLET_QUALIOPI/02_PROMPTS_CLAUDE_CODE/PROMPT_PRINCIPAL_QUALIOPI.md`.
---

# Axion-IA — Formation Engine + Qualiopi Manager

Ce skill pilote l'implémentation, l'extension et la vérification du back-office d'organisme de
formation d'Axion-IA, **à l'intérieur du codebase `axionia`** (Next.js 16). Il est conçu pour un
fonctionnement **autopilot de bout en bout** : exploration → plan → tranches verticales →
vérifications croisées → réconciliation → conformité prouvée, sans jamais casser l'existant.

## Quand l'utiliser

Active ce skill dès que la tâche touche : le moteur de génération de formations IA, la gestion
Qualiopi (sessions, stagiaires, formateurs, émargement, évaluations, satisfaction), les documents
réglementaires, les financements (OPCO/CPF/France Travail), le BPF, les 22 indicateurs, le portail
stagiaire, le mode auditeur, le CRM/devis, ou la conformité d'un organisme de formation français.

Ne l'utilise PAS pour : le site marketing public hors formation, la banque d'images (→ skill
`axionia-image-bank`), le booking générique non-formation, ou des tâches conversationnelles simples.

## Documents de référence (charger à la demande — progressive disclosure)

| Fichier                                               | Charger quand                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reference/01-codebase-contract.md`                   | **Toujours, en premier.** Stack réelle, conventions, cloisonnement, valeurs interdites, mapping « hypothèses V4 → réalité axionia ». C'est le contrat non négociable.                                                                                                                                                                           |
| `reference/02-autopilot-workflow.md`                  | Avant de planifier ou de coder. Phases, boucle par tranche, harnais de vérification, croisements, règles STOP & ASK, reprise/idempotence, sécurité git/deploy.                                                                                                                                                                                  |
| `reference/03-design-charte.md`                       | Dès qu'on produit de l'UI, un PDF, un email ou un support de formation. Tokens exacts, typographie, règles de fidélité de marque, SSOT brand pour PDF/email.                                                                                                                                                                                    |
| `reference/04-strategic-positioning-and-preflight.md` | **Avant la Phase 1.** Contexte non-déductible du code : positionnement « Intervention » vs « Formation », entité **SAS France** (pas OÜ legacy), silence financement public, facturation duale forfait↔horaire, AI Act art. 50, sous-traitance ind. 27/19, pré-vol git/migrations (backup-DR non commité). Contient les **STOP & ASK** majeurs. |

Spécifications fonctionnelles & oracle de conformité (hors repo, lecture obligatoire en Phase 0) :

- Specs : `C:\Users\willi\Documents\Projets\Axion-IA\AXION_IA_COMPLET_QUALIOPI\01_SPEC_FONCTIONNELLE\SPEC_PART1..5*.md`
- Conformité : `…\03_CONFORMITE_QUALIOPI\MATRICE_CONFORMITE_22_INDICATEURS.md`, `CHECKLIST_CONFORMITE_ORGANISMES.md`, `WORKFLOWS_AUTOMATIQUES.md`
- **Oracle d'acceptation** (vérité de « done ») : `…\03_CONFORMITE_QUALIOPI\MATRICE_ACCEPTATION_AUTOPILOT.md`
- Documents Word modèles : `…\04_DOSSIER_OF_DOCUMENTS\A_Documents_Qualiopi\A1..A18`, `B_Conventions_DREETS\B1..B5`
- Site & organismes : `…\05_SITE_ET_ORGANISMES\*`
- Kit pédagogie excellence : `…\07_KIT_FORMATION_EXCELLENCE\*`

## Les 5 lois (résumé du contrat — détail dans reference/01)

1. **Le code réel fait foi, en permanence.** Zéro hypothèse : toute décision est vérifiée dans le code
   actuel d'`axionia` avant chaque tranche (pas seulement en Phase 0). Ordre d'autorité : **code vivant >
   contrat/skill > documents/specs**. Toute divergence → suivre le code, corriger le contrat, noter `STATE.md`.
2. **Stack imposée.** Prisma (pas SQL brut), Server Actions (pas REST `/api/v1`), NextAuth 5 + 2FA,
   BullMQ, @react-pdf/renderer, nodemailer, next-intl FR canonique, Tailwind v4 `@theme`. Réutiliser
   les briques existantes (`src/lib/prisma.ts`, `redis.ts`, providers IA `src/server/content-gen/`,
   `cost-tracker.ts`, email, `admin-nav.ts`, `pricing.ts`). Jamais de second système parallèle.
3. **Non destructif & resumable.** Migrations Prisma additives uniquement ; aucun `DROP`. Respect du
   contrat de build `stub.invalid` (ADR 0026). Travail sur branche ; jamais de push `main` sans accord
   explicite (push = deploy).
4. **Zéro valeur en dur, zéro TODO/stub.** Couleurs via tokens, paramètres métier via **`SiteSetting`
   (catégorie `qualiopi`)** — ⚠️ **PAS** de table `config_systeme` (alias historique des specs : à
   implémenter via `SiteSetting`, voir SPEC_PART4 §4.3 corrigé), prix via `pricing.ts`, mentions légales
   exactes et centralisées. Chaque fonction livrée est réelle.
5. **Conformité prouvée, pas affirmée.** Chaque indicateur Qualiopi et chaque obligation organisme est
   relié à un artefact logiciel ET à un test automatisé via la matrice d'acceptation. Vérification
   croisée à chaque tranche.

## Boucle de fonctionnement (détail dans reference/02)

```
Phase 0  Grounding : lire code réel + 5 specs + matrice → RAPPORT D'EXPLORATION (aucun code)
Phase 0.5 Lock de l'oracle : chaque ligne de la matrice d'acceptation a une preuve + un test planifiés
Phase 1  Plan : tranches verticales ordonnées par dépendance (SSOT/config d'abord)
Phase 2..N Pour chaque tranche : schéma → action → UI → doc/PDF → test
           → GATE de vérification (typecheck, lint, i18n, anti-siren, contrast, radius, vitest…)
           → CROISEMENT (spec ✕ matrice ✕ contrat codebase ✕ charte)
           → RÉCONCILIATION (corriger toute dérive avant d'avancer) → commit sur branche
Final    Récapitulatif + couverture matrice 100% + dossier d'audit générable
```

## STOP & ASK (ne jamais deviner)

Interromps et demande à Will pour : migration destructive, régression Web Vitals sur les 15 pages
stratégiques, doute sur une mention légale, modification du contrat `stub.invalid`, écart de charte
imposé, et les **8 ambiguïtés de spec** listées dans `reference/02-autopilot-workflow.md` (modification
de programme, données conservées après rejet, formation sur mesure, expiration Qualiopi en cours
d'année, etc.). Tout le reste : décider selon le contrat, documenter, continuer.

## Démarrage rapide

1. Lire `reference/01-codebase-contract.md` puis `reference/02-autopilot-workflow.md`.
2. Lancer Phase 0 (exploration) et produire le RAPPORT D'EXPLORATION.
3. Charger l'oracle (`MATRICE_ACCEPTATION_AUTOPILOT.md`) et verrouiller la couverture.
4. Dérouler les tranches verticales avec gate + croisement + réconciliation à chacune.

Le prompt maître prêt à lancer (qui orchestre tout ceci) :
`C:\Users\willi\Documents\Projets\Axion-IA\AXION_IA_COMPLET_QUALIOPI\02_PROMPTS_CLAUDE_CODE\PROMPT_PRINCIPAL_QUALIOPI.md`.
