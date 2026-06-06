# CONTRAT D'INTERFACE — T16 Raccordements + durcissement + dossier d'audit démo + récap

Dernière tranche. AUCUNE migration (intégration + seed + nav + doc). DoD §E = `MATRICE_ACCEPTATION_AUTOPILOT.md` (preuve + test par exigence).

## Règles NON négociables
- Prisma `@/lib/prisma`, types `../../../../prisma/generated/client`. Stub-aware. `exactOptionalPropertyTypes`. Français. Tokens admin, ZÉRO hex. `"use client"` → `// use-client:`. Tests co-localisés, aucun mock de prod.
- Cloisonnement (cf. isolation-check) : `prisma/seeds/qualiopi/**`, `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/**`, `src/components/admin/qualiopi/**`, `package.json` (script seed). Migration ADDITIVE interdite ici (aucune nouvelle table).

## AGENT A — dossier d'audit de démonstration (seed) `prisma/seeds/qualiopi/demo.ts`
Objectif : un jeu de fixtures réaliste prouvant, de bout en bout, qu'un auditeur Qualiopi trouverait chaque preuve. Idempotent (upsert par identifiants stables ; ré-exécutable). Stub-aware (no-op si stub.invalid).
- Crée un **cycle complet** : 1 Client + 1 Devis accepté → 1 Formation (publiée, objectifs + programme + moyens) rattachée à une OffreSite existante → 1 TrainingSession `realisee` (dates passées, modalité présentiel) → 2 Trainee inscrits (Enrollment `presente`) → PresenceCreneau (matin+aprem, présents, taux 100 %) → EvaluationAcquis finale (niveau `acquis`) par stagiaire → Questionnaire `satisfaction_chaud` rempli (noteGlobale 5 & 4) + `positionnement` → DocumentGenere attestation (qrToken) → FactureFormation `emise` → 1 Reclamation `resolue` (avec réponse + actions correctives) → 3 Veille (legale/metiers/pedagogique, avec actionDecidee) → 1 Partenariat actif → 1 SousTraitant vérifié (data.gouv) → 1 RevueDirection (statut validé) → Appreciation (stagiaire+entreprise).
- Numérotation : réutiliser les services (`creerReclamation`, etc.) OU insertion directe avec numéros stables `AXI-*-DEMO-NNN`. Pas de doublon à la ré-exécution.
- Script `package.json` : `"qualiopi:seed-demo": "tsx prisma/seeds/qualiopi/demo.ts"`.
- Test `prisma/seeds/qualiopi/demo.spec.ts` OU `src/server/qualiopi/conformite/demo-coverage.spec.ts` : vérifie (mock prisma OU logique) que le jeu démo couvre les indicateurs clés (présence, éval, satisfaction, attestation, réclamation, veille, revue) — au minimum un test unitaire de la fonction de construction des fixtures (pure si possible : sépare `buildDemoData()` pur du `persistDemo()` DB).
- ⚠️ Données de démo identifiables comme telles (préfixe "DEMO" / email `@demo.axion-ia.invalid`) pour ne jamais polluer la prod réelle.

## AGENT B — home hub + raccordements + reconcile facture PDF
- `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/page.tsx` (MODIF du hub T0) : ajouter une **grille de navigation** vers TOUS les modules livrés (Formations, Sessions, Clients, Devis, Offres, Formation Engine, Indicateurs/BPF, Financements, Conformité, Pilotage, Réclamations, Veille, Partenariats, Sous-traitants, Revue de direction, Appréciations, Alertes, Mode auditeur, Supports via formations) avec compteurs (counts Prisma) + `AlertesLiveBadge`. Conserver le bloc statut divulgation/config légale existant. Tokens admin, zéro hex.
- **Reconcile dette T11** : modifier `src/server/actions/qualiopi/financements.ts` `genererFactureFormationAction` pour qu'après création de la `FactureFormation`, il génère AUSSI le PDF via le service `genererFactureFormation` de `@/server/qualiopi/financements/facturation-service` OU appelle `generateDocument` (type "facture") et stocke `documentId`. SANS casser les tests existants : si les tests mockent `prisma.factureFormation.create`, ajoute le PDF derrière un try/catch fail-soft et adapte/complète les tests (mock generateDocument). Si trop risqué pour les tests, expose plutôt une action séparée `genererFacturePdfAction({ factureId })` qui rend le PDF et set `documentId` (+ test). Documente le choix.
- breadcrumbs : si un composant breadcrumb admin existe, l'ajouter aux pages qualiopi clés ; sinon, ne pas inventer (noter dans la réponse).

## Definition of Done T16 (GATE central)
typecheck heap + `vitest run src/server/qualiopi` vert + isolation 0 + i18n + lint 0 + anti-hex 0 + `pnpm qualiopi:seed-demo` documenté (idempotent, stub-aware) + hub de navigation complet. L'orchestrateur écrit le RÉCAP FINAL + lance la suite complète `vitest run` en filet.
