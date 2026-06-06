# CONTRAT D'INTERFACE — T11 Financements (OPCO/CPF/France Travail) + facturation duale

Schéma + migration **déjà faits** (`20260606210000`, `prisma generate` fait). Disponible :
- enums `FranceTravailDispositif` (`aif|poei|csp`), `FactureFormationDestinataire` (`entreprise|opco|stagiaire|france_travail`), `FactureFormationStatut` (`brouillon|emise|payee|annulee`).
- `TrainingSession` : champs financement T3 déjà là (`financementType`, `opcoStatut`, `opcoSubrogation`, `conventionTripartiteSigneeAt`, `edofVerifieAt`, `ftPoei*`, `ftAifPrescriptionDate`) + nouveaux T11 (`ftDispositif`, `numeroDossierOpco`, `cpfPayeurResteCharge`, `montantHtCents`, `nbParticipantsReels`/`Prevus`, `dureeReelleHeures`).
- `Formation` : +`moyensTechniques` (Text), +`ressourcesPedagogiques` (Json). `Trainer` : +`sousTraitantNda`, +`sousTraitantVerifieAt`.
- modèle `FactureFormation` (numero, sessionId, destinataire, destinataireNom/Siret/Adresse, montantHtCents, tvaExoneree, lignes Json, subrogation, numeroDossierOpco, statut, documentId, emiseAt, echeanceAt). `TrainingSession.facturesFormation`.

## Règles NON négociables
- Prisma via `@/lib/prisma`, types via `../../../../prisma/generated/client`. Stub-aware sur génération de doc.
- `exactOptionalPropertyTypes`. Zéro valeur en dur. Français. Tokens admin UI.
- **Mentions légales/financement = exactes** (subrogation, exonération TVA 261-4-4° CGI). Ne jamais inventer d'identifiant.
- Tests Vitest co-localisés, aucun mock de prod.
- Cloisonnement : `src/server/qualiopi/financements/**`, `src/server/actions/qualiopi/financements.ts`, UI sous `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/financements/**` + `sessions/[id]/financement/**`, `src/components/admin/qualiopi/**`, modif additive `src/lib/admin-nav.ts`.

## Règles métier (specs §5.3–5.5 — décisions Will B8)
- **OPCO accord BLOQUANT** : `financementType=opco` + session non démarrée → si `opcoStatut != accord_recu` → **alerte CRITIQUE** « Accord OPCO non reçu » et la validation de démarrage doit échouer (fonction `validateOpcoAccord` → `{ ok:false, alerte }`). « JAMAIS commencer avant accord écrit ».
- **Subrogation** : si `opcoSubrogation=true` → facture libellée à l'**OPCO** + mention « En application de la subrogation de paiement » + `numeroDossierOpco` obligatoire (bloquant si absent). Sinon → facture à l'entreprise.
- **CPF/EDOF** : reste à charge = `getQualiopiConfig("cpf_reste_a_charge")` (103,20€). Si `financementType=cpf` et `edofVerifieAt` (session ou formation) null → **alerte bloquante** « CPF sans vérification EDOF ». `cpfPayeurResteCharge` ∈ {stagiaire, employeur, opco, france_travail, exonere}.
- **France Travail** : `ftDispositif` aif/poei/csp ; AIF requiert `ftAifPrescriptionDate` ; POEI requiert `ftPoeiAccordFinancementAt` + `ftPoeiEngagementSigneAt`. Validation `validateFranceTravail`.
- **Plafonds OPCO Atlas** (config) : `opco_atlas_intra_horaire`, `opco_atlas_inter_presentiel`, `opco_atlas_inter_distanciel`, `opco_atlas_plafond_annuel`.
- **Facturation duale** : forfait = `session.montantHtCents` (issu pricing.ts via offre). Ventilation horaire OPCO = `dureeReelleHeures × tarifHoraire(modalité) × nbParticipants`, plafonnée. Le service expose les DEUX ; la facture utilise la ventilation pertinente selon destinataire.
- **TVA exonérée** 261-4-4° CGI (formation pro) : `tvaExoneree=true` par défaut.
- **Sous-traitant (off.19/27)** : un Trainer `sous_traitant` ne peut être assigné formateur principal que si `sousTraitantVerifieAt != null` (vérif data.gouv.fr manuelle → champ horodaté). `validateSousTraitant`.

## AGENT A — services `src/server/qualiopi/financements/`
- `opco-calcul.ts` (PUR) : `tarifHoraireOpco(modalite, intra, { intraHoraire, interPresentiel, interDistanciel }): number` ; `computeVentilationHoraire(input: { dureeHeures: number; nbParticipants: number; tarifHoraireCents: number }): { lignes: Array<{ designation; quantite; prixUnitaireHtCents }>; totalHtCents }` ; `computeForfait(montantHtCents): { lignes; totalHtCents }`. + spec.
- `validation-service.ts` : `validateOpcoAccord(session)`, `validateCpfEdof(session, formation)`, `validateFranceTravail(session)`, `validateSousTraitant(trainer)` → chacun `{ ok: boolean; alerte?: string; gravite?: "critique"|"warning" }`. Lit la DB au besoin (ou prend les entités en paramètre — préférer paramètres purs + un wrapper DB `getFinancementValidations(sessionId)`). + spec.
- `facturation-service.ts` : `genererFactureFormation(input: { sessionId: string; destinataire: FactureFormationDestinataire; ventilation: "forfait"|"horaire" }): Promise<{ factureId: string; numero: string; documentId: string | null }>` — calcule lignes (opco-calcul), crée `FactureFormation` (numéro séquentiel AXI-FACT-YYYY-NNN via `formatDocumentNumber`), construit `FactureData` (template `facture.tsx`), `generateDocument(type:"facture", refs:{sessionId}, ...)`, met à jour `documentId`+`emiseAt`. Subrogation→destinataire opco+mention+numeroDossier (bloquant si absent). Stub-aware. + spec.
- `compta-export.ts` (PUR) : `facturesToCsv(factures: Array<...>): string` (CSV `;` FR : numero, date, destinataire, montant HT, TVA, statut, session). + spec.

## AGENT B — server actions `src/server/actions/qualiopi/financements.ts` (importe AGENT A)
- `setFinancementSessionAction({ sessionId, financementType?, opcoStatut?, opcoSubrogation?, numeroDossierOpco?, ftDispositif?, cpfPayeurResteCharge?, conventionTripartiteSigneeAt? })` → update + audit.
- `validerAccordOpcoAction({ sessionId })` → set opcoStatut=accord_recu + audit.
- `genererFactureFormationAction({ sessionId, destinataire, ventilation })` → `genererFactureFormation` + audit (refuse si validations bloquantes échouent).
- `setMoyensFormationAction({ formationId, moyensTechniques?, ressourcesPedagogiques? })` → update + audit.
- `verifierSousTraitantAction({ trainerId, sousTraitantNda })` → set sousTraitantVerifieAt=now + audit.
- `exportComptaCsvAction({ annee })` → query factures année + `facturesToCsv` → `{ csv, filename }`.
- pattern enrollments.ts. + spec sous `src/server/qualiopi/financements/financements-actions.spec.ts`.

## AGENT C — UI `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/`
- `financements/page.tsx` (Server Component) : liste factures + alertes de validation (sessions à risque : OPCO sans accord, CPF sans EDOF) + bouton export compta CSV.
- `sessions/[id]/financement/page.tsx` (Server Component) : panneau financement de la session (type, OPCO statut/subrogation/dossier, CPF payeur/EDOF, FT dispositif) + boutons (`SetFinancementForm`, `GenererFactureButton`) + affichage des validations bloquantes (badge critique).
- composants clients (`"use client"` + `// use-client:`) : `SetFinancementForm.tsx`, `GenererFactureButton.tsx`, `ExportComptaButton.tsx`.
- modif additive `src/lib/admin-nav.ts` (item « Financements / Facturation »).
- lien « Financement » depuis la liste sessions vers `sessions/[id]/financement`.
- Tokens admin, français, force-dynamic + noindex. Actions appelées = signatures AGENT B ci-dessus.

## Definition of Done T11 (GATE central)
typecheck heap + `vitest run src/server/qualiopi` vert + isolation 0 + i18n + lint 0 + anti-hex 0 + validations bloquantes (OPCO accord, CPF EDOF, subrogation dossier) testées + facture duale générée (forfait/horaire) + export compta CSV. [off.17/19/21/22, financeurs]
