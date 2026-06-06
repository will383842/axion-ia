# CONTRAT — T18 Référentiel barèmes par OPCO + certification RS/RNCP

Schéma + migration `20260606270000` **faits** (prisma generate fait). Dispo :
- modèle `OpcoBareme` (code unique, nom, intraHoraireCents, interPresentielCents, interDistancielCents, plafondAnnuelCents, actif).
- `Formation` +`codeRncp`/`codeRs`/`numeroEnregistrementFc`/`certificateurNom`/`estCertificateur`/`numeroHabilitation`/`dateEnregistrementCertif`/`dateEcheanceCertif`/`blocsCompetences`(Json)/`cpfEligible`.
- Existant : `Formation.certificationType` (`aucune|rs|rncp`), `codeCpf`, `edofVerifieAt` ; `Client.opcoIdentifie` (inféré NAF, codes : `atlas|akto|opco2i|constructys|opcommerce`) ; conformité off.3/7/16 conditionnels « cert ».

## Règles communes
Prisma `@/lib/prisma`, types `../../../../prisma/generated/client`. Stub-aware. `exactOptionalPropertyTypes`. Français. Tokens admin (zéro hex). `"use client"` → `// use-client:`. Apostrophes JSX échappées. Prettier sur fichiers touchés. Tests co-localisés. NE touche QUE les fichiers de ton cluster.

## CLUSTER A — Référentiel OPCO (service + seed + facturation)
Fichiers : `src/server/qualiopi/financements/opco-bareme.ts` (NEW), `prisma/seeds/qualiopi/index.ts`, `prisma/seeds/qualiopi/opco-baremes.ts` (NEW), `src/server/qualiopi/financements/facturation-service.ts`, `src/server/actions/qualiopi/financements.ts` (ventilation horaire de `genererFacturePdfAction`), specs.
1. `opco-bareme.ts` : `listBaremes()`, `getBaremeByCode(code)`, `upsertBareme(input)`, et surtout `tarifHoraireForOpco(opcoCode: string | null, modalite, intra: boolean): Promise<number>` — retourne le tarif (centimes) du barème de CET OPCO selon modalité (intra→intraHoraire ; distanciel→interDistanciel ; sinon interPresentiel) ; **fallback** sur `getQualiopiConfig("opco_atlas_*")` si OPCO inconnu OU barème à 0. Stub-aware.
2. `opco-baremes.ts` seed : `seedOpcoBaremes(prisma)` — upsert les 11 OPCO (codes : `atlas, akto, opco_ep, opco2i, afdas, constructys, ocapiat, uniformation, opcommerce, mobilites, cohesion_sociale`) avec noms réels + barèmes à 0 (Will remplit). Idempotent (préserve les valeurs existantes non nulles). Wire dans `index.ts` (`await seedOpcoBaremes(prisma)`).
3. `facturation-service.ts` + `financements.ts` : la ventilation horaire doit utiliser `tarifHoraireForOpco(session.client?.opcoIdentifie, modalite, estIntra)` (charger `client.opcoIdentifie`) au lieu du seul barème Atlas global. Conserver le fallback.
4. specs (opco-bareme + maj facturation).

## CLUSTER B — Certification RS/RNCP (services + conformité + CPF)
Fichiers : `src/server/qualiopi/formations/certification-service.ts` (NEW), `src/server/actions/qualiopi/formations.ts` (action `setCertificationAction`), `src/server/qualiopi/conformite/conformite-service.ts`, `src/server/qualiopi/financements/validation-service.ts`, specs.
1. `certification-service.ts` : `computeCpfEligible(f): boolean` (true si `certificationType !== "aucune"` ET (codeRncp || codeRs || blocsCompetences non vide) ET `edofVerifieAt != null`) ; `setCertification(formationId, input)` (set les champs cert + recalcule `cpfEligible`). Stub-aware.
2. action `setCertificationAction({ formationId, certificationType, codeRncp?, codeRs?, numeroEnregistrementFc?, certificateurNom?, estCertificateur?, numeroHabilitation?, dateEnregistrementCertif?, dateEcheanceCertif?, blocsCompetences? })` (requireAdminPublish + audit).
3. `conformite-service.ts` : 
   - off.1 : ajouter la mention certification dans la preuve (si formations certifiantes : code RS/RNCP présent).
   - off.3/7/16 : passer à « couvert » (au lieu de false figé) quand il existe ≥1 formation certifiante avec code RS/RNCP renseigné (sinon restent `a_completer`/`non_applicable` selon applicabilité). off.3 = taux d'obtention (couvert si certif + évaluations) ; 7/16 = adéquation/présentation certification (couvert si codeRncp/codeRs + blocs).
4. `validation-service.ts` : ajouter `validateCpfEligibilite(formation)` — si financement CPF et `cpfEligible=false` → `critique` « formation non finançable CPF (RS/RNCP/EDOF requis) ».
5. specs.

## CLUSTER C — UI (OPCO admin + certification formation + fiche publique)
Fichiers : `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/opco-baremes/page.tsx` (NEW), `src/components/admin/qualiopi/{OpcoBaremeForm,CertificationFormationForm}.tsx` (NEW), `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/formations/[id]/certification/page.tsx` (NEW), `src/app/[locale]/formations/[slug]/page.tsx` (affichage cert), `src/lib/admin-nav.ts`, specs éventuelles.
1. Page admin `opco-baremes` : tableau des barèmes (via `listBaremes`) + `OpcoBaremeForm` (édite intra/inter/distanciel/plafond par OPCO) → `upsertBaremeAction` (à exposer par CLUSTER A si besoin, sinon Server Action locale appelant le service — coordonne : mets l'action dans `financements.ts` côté A OU une action dédiée que tu crées dans un fichier C `src/server/actions/qualiopi/opco-baremes.ts`). **Choisis : crée `src/server/actions/qualiopi/opco-baremes.ts` (action `upsertOpcoBaremeAction`) côté C** pour éviter de toucher les fichiers de A.
2. Page admin `formations/[id]/certification` + `CertificationFormationForm` → `setCertificationAction` (CLUSTER B).
3. Fiche publique `formations/[slug]` : si formation certifiante, afficher **type (RS/RNCP) + code + certificateur + n° enregistrement + badge « Éligible CPF »** quand `cpfEligible`.
4. `admin-nav.ts` : item « Barèmes OPCO » + lien « Certification » depuis la liste formations.
Tokens admin, FR, force-dynamic + noindex (admin), apostrophes échappées.

## Definition of Done T18 (GATE central)
typecheck heap + `vitest run src/server/qualiopi` + isolation x3 + i18n + lint repo 0 + prettier OK + facturation utilise le barème de l'OPCO du client + RS/RNCP saisissable + cpfEligible dérivé + fiche publique affiche la certification.
