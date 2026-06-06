# CONTRAT D'INTERFACE — T12 Conformité (registres + indicateurs + pilotage + mode auditeur)

Schéma + migration **déjà faits** (`20260606220000`, `prisma generate` fait). Modèles dispo : `Reclamation`, `Veille`, `Partenariat`, `SousTraitant`, `RevueDirection` + enums `ReclamationSource`/`ReclamationStatut`/`VeilleType`. Indicateurs/pilotage/mode-auditeur = **calculés** (aucune table). Pas de lib ZIP → mode auditeur = **manifeste** (JSON + Markdown), pas de binaire.

## Règles NON négociables
- Prisma via `@/lib/prisma`, types via `../../../../prisma/generated/client`. Stub-aware. `exactOptionalPropertyTypes`.
- Zéro valeur en dur (seuils config). Français. Tokens admin `var(--color-admin-*)` UNIQUEMENT, **ZÉRO hex même en fallback**. Tests co-localisés, aucun mock de prod.
- `"use client"` → commentaire `// use-client: <raison>` juste après la directive (gate use-client:check).
- Cloisonnement : `src/server/qualiopi/conformite/**`, `src/server/qualiopi/registres/**`, `src/server/actions/qualiopi/{reclamations,veille,partenariats,sous-traitants,revue-direction,conformite}.ts`, UI sous `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/{conformite,pilotage,reclamations,veille,partenariats,sous-traitants,revue-direction,mode-auditeur}/**`, `src/components/admin/qualiopi/**`, modif additive `src/lib/admin-nav.ts`.

## Source officielle indicateurs
`C:\Users\willi\Documents\Projets\Axion-IA\AXION_IA_COMPLET_QUALIOPI\03_CONFORMITE_QUALIOPI\INDICATEURS_OFFICIELS_V9_VERBATIM.md` FAIT FOI pour les 32 libellés exacts. Répartition critères : C1:1-3 / C2:4-8 / C3:9-16 / C4:17-20 / C5:21-22 / C6:23-29 / C7:30-32. Super (NC majeure) : 1,2,4,5,9,11,12,21,23,26,27,30,31,32 (+7,16 si certifiant). Conditionnels : 3,7,16 (CERT) · 13,14,15 (APP/CFA) · 28 (AFEST).

## 14 métriques de pilotage (REFERENCE_RNQ_V9_PILOTAGE_GLOBAL.md)
1 prestations ouvertes/terminées · 2 taux d'entrée dans le délai · 3 taux complétion · 4 taux abandon · 5 taux atteinte objectifs (réussite) · 6 satisfaction · 7 incidents · 8 réclamations + délai · 9 actions correctives ouvertes/closes · 10 mise à jour documentaire · 11 formateurs à jour preuves · 12 adaptations handicap · 13 sous-traitances évaluées · 14 conformité dossiers audités interne.

## AGENT A — services registres `src/server/qualiopi/registres/`
- `reclamations-service.ts` : `creerReclamation` (numéro AXI-REC-YYYY-NNN via formatDocumentNumber("reclamation")), `repondreReclamation`, `setStatutReclamation`, `listReclamations`, `reclamationsEnRetard()` (sans réponse > J+15 via `getQualiopiConfig` ou défaut 15). Stub-aware.
- `veille-service.ts` : CRUD veille + `listVeille(type?)`.
- `partenariats-service.ts` : CRUD partenariats.
- `sous-traitants-service.ts` : CRUD + `verifierDataGouv(id)` (set verifieDataGouvAt).
- `revue-direction-service.ts` : `creerRevue(annee)` (snapshot indicateurs via import `getIndicateurs`), `updateRevue`, `listRevues`.
- specs pour chacun.

## AGENT B — conformité/pilotage/audit `src/server/qualiopi/conformite/`
- `indicateurs-registre.ts` (PUR) : tableau des 32 indicateurs `{ numero, critere, libelleOfficiel, super, conditionnel?: "cert"|"app"|"afest" }` (libellés depuis le doc verbatim). + helper `indicateursApplicables(typesAction: string[]): number[]`.
- `conformite-service.ts` : `evaluerConformite(): Promise<{ indicateurs: Array<{ numero, libelle, critere, statut: "couvert"|"a_completer"|"non_applicable", preuves: string[] }>, scorePct, nbCouverts, nbApplicables }>` — statut déduit de la présence de données (ex. ind.31 couvert si table reclamations existe/exploitée, ind.11 si EvaluationAcquis finale existe, etc.). Score = couverts/applicables (JAMAIS /22). Stub-aware.
- `pilotage-service.ts` : `getPilotage(annee): Promise<PilotageResult>` — les 14 métriques (réutilise `getIndicateurs`/`computeBpf` de T10 + counts réclamations/veille/sous-traitants/handicap). Cache Redis optionnel TTL 3600.
- `audit-dossier.ts` : `genererManifesteAudit(): Promise<{ json: object; markdown: string }>` — par indicateur → liste des preuves (types de DocumentGenere présents, comptes) + état. PAS de binaire ZIP.
- specs.

## AGENT C — server actions (importe A + B)
- `src/server/actions/qualiopi/reclamations.ts` : `creerReclamationAction`, `repondreReclamationAction`, `setStatutReclamationAction`.
- `src/server/actions/qualiopi/veille.ts` : `creerVeilleAction`, `updateVeilleAction`, `supprimerVeilleAction`.
- `src/server/actions/qualiopi/partenariats.ts` : `creerPartenariatAction`, `updatePartenariatAction`.
- `src/server/actions/qualiopi/sous-traitants.ts` : `creerSousTraitantAction`, `verifierSousTraitantOfAction`.
- `src/server/actions/qualiopi/revue-direction.ts` : `creerRevueDirectionAction`, `updateRevueDirectionAction`.
- `src/server/actions/qualiopi/conformite.ts` : `exporterManifesteAuditAction()` → `{ json, markdown, filename }`.
- pattern enrollments.ts. specs sous `src/server/qualiopi/registres/*-actions.spec.ts` ou `conformite/*.spec.ts`.

## AGENT D — UI dashboards `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/`
- `conformite/page.tsx` : matrice des 32 indicateurs (numéro, critère, libellé, super★, statut coloré, preuves) + score global. Server Component, `evaluerConformite()`.
- `pilotage/page.tsx` : les 14 métriques en AdminStatCard (sélecteur année). `getPilotage(annee)`.
- `mode-auditeur/page.tsx` : vue auditeur (manifeste par indicateur) + bouton export manifeste (`ExportManifesteButton.tsx` client). `genererManifesteAudit()`.
- composants clients nécessaires (`"use client"` + `// use-client:`). NE PAS toucher admin-nav (réservé Agent E).

## AGENT E — UI registres CRUD + nav `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/`
- `reclamations/page.tsx` (+ form client création/réponse), `veille/page.tsx`, `partenariats/page.tsx`, `sous-traitants/page.tsx`, `revue-direction/page.tsx`. Server Components + composants clients minimaux.
- modif additive `src/lib/admin-nav.ts` : items « Conformité », « Pilotage », « Réclamations », « Veille », « Partenariats », « Sous-traitants », « Revue de direction », « Mode auditeur » (groupe qualiopi).
- Actions appelées = AGENT C. Tokens admin, français, force-dynamic + noindex, zéro hex.

## Definition of Done T12 (GATE central)
typecheck heap + `vitest run src/server/qualiopi` vert + isolation 0 + i18n + lint 0 + anti-hex 0 + matrice 32 indicateurs (score /applicables) + 5 registres CRUD + 14 métriques pilotage + manifeste audit exportable. [off.23-32, pilotage §9]
