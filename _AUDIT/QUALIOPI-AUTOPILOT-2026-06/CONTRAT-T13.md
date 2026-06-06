# CONTRAT D'INTERFACE — T13 Supports de formation à la charte

Schéma + migration **déjà faits** (`20260606230000`, `prisma generate` fait). Modèle `SupportFormation` (formationId, type, titre, contenu Json, pdfKey/pdfUrl/hashSha256/sizeBytes, version, aiGenerated, statut, generatedAt) + enums `SupportType` (`slides_formateur|slides_stagiaire|livret_stagiaire|memo|guide_animation|exercices|grille_eval`), `SupportStatut` (`brouillon|genere|archive`). `Formation.supports`.

Supports = PDF pédagogiques **stockés en propre** (R2), DISTINCTS des `DocumentGenere` légaux (pas de QR, pas de DocumentType).

## Règles NON négociables
- Prisma via `@/lib/prisma`, types via `../../../../prisma/generated/client`. Stub-aware. `exactOptionalPropertyTypes`.
- PDF à la **charte** : réutiliser `src/server/qualiopi/documents/base-layout.tsx` (`QualiopiPage`, `pdfStyles`, `DocSection`, `FieldRow`) + `brand-tokens.ts` (`brandColor`). ZÉRO couleur en dur (tokens uniquement). Rendu serveur exclusif (PAS de "use client" dans les templates).
- Stockage : réutiliser `renderPdfToBuffer` + `storeAndSignPdf` de `src/server/qualiopi/documents/render.ts` (fail-soft R2).
- Français. Tests Vitest co-localisés, aucun mock de prod, fixtures réalistes (chaque template render → buffer commence par `%PDF`).
- Cloisonnement : `src/server/qualiopi/supports/**`, `src/server/actions/qualiopi/supports.ts`, UI `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/formations/[id]/supports/**` + `src/components/admin/qualiopi/**`, modif additive `src/lib/admin-nav.ts`.

## Source pédagogie
Kit excellence : `C:\Users\willi\Documents\Projets\Axion-IA\AXION_IA_COMPLET_QUALIOPI\07_KIT_FORMATION_EXCELLENCE\*.md` (guides — t'en inspirer pour la structure des supports, ne pas copier verbatim). Contenu assemblé depuis `Formation.programmeDetaille` (Json [{moduleId,titre,dureeMin,sequences}]) + `objectifsPedagogiques` + `methodesPedagogiques` + `moyensTechniques`/`ressourcesPedagogiques`.

## AGENT A — builder pur + templates PDF `src/server/qualiopi/supports/`
- `types.ts` : `SupportContenu` = `{ sections: Array<{ titre: string; blocs: Array<{ type: "paragraphe"|"liste"|"objectif"|"exercice"|"note"; texte?: string; items?: string[] }> }>; meta?: Record<string, string> }`.
- `support-builder.ts` (PUR) : `construireSupport(type: SupportType, formation: FormationInput): SupportContenu` où `FormationInput = { titre, objectifsPedagogiques, programmeDetaille, methodesPedagogiques, moyensTechniques, ressourcesPedagogiques, dureeHeures }`. Une structure adaptée par type (slides = 1 section/séquence ; livret = accueil+objectifs+programme+moyens ; mémo = points clés ; guide_animation = timing+consignes formateur ; exercices = énoncés ; grille_eval = critères depuis objectifs). + `titreSupport(type, formationTitre): string`. + `support-builder.spec.ts`.
- `templates/support-pdf.tsx` : `SupportPdf({ data, identite })` où `data = { type, titre, contenu: SupportContenu, version }` — rend à la charte via base-layout. Un seul template paramétrique (rendu adapté par `type`) OU un par famille. + `support-pdf.spec.tsx` (render %PDF pour chaque type).
- `render-support.ts` : `renderSupportToStored(input: { type, titre, contenu, version, identite }): Promise<{ pdfKey: string | null; pdfUrl: string | null; hashSha256: string; sizeBytes: number }>` (renderPdfToBuffer + storeAndSignPdf clé `supports/{year}/{type}/{hash}.pdf`). + spec.

## AGENT B — service + actions (importe AGENT A)
- `src/server/qualiopi/supports/supports-service.ts` :
  - `genererSupport(input: { formationId: string; type: SupportType; enrichirIA?: boolean }): Promise<{ id: string; pdfUrl: string | null }>` : lit la formation, `construireSupport`, (si `enrichirIA` et pas stub : enrichit via provider Anthropic `src/server/content-gen/providers/anthropic.ts` + cost-tracker — sinon contenu builder pur), `renderSupportToStored`, upsert `SupportFormation` (version incrémentée), `aiGenerated`, `generatedAt`, statut `genere`. Stub-aware.
  - `listSupports(formationId)`, `supprimerSupport(id)`.
  - `+ supports-service.spec.ts` (mock prisma + render + provider).
- `src/server/actions/qualiopi/supports.ts` (`"use server"`, pattern enrollments.ts) : `genererSupportAction({ formationId, type, enrichirIA? })`, `regenererSupportAction({ id })`, `supprimerSupportAction({ id })`. + audit. + `supports-actions.spec.ts`.

## AGENT C — UI (importe actions AGENT B)
- `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/formations/[id]/supports/page.tsx` (Server Component, pattern formations/page.tsx) : liste des supports de la formation (type, version, statut, lien PDF) + boutons de génération par type.
- `src/components/admin/qualiopi/GenererSupportButton.tsx` (`"use client"` + `// use-client:`) : sélection type + case « enrichir IA » → `genererSupportAction`.
- lien « Supports » depuis la liste formations (`formations/page.tsx`) vers `formations/[id]/supports`.
- modif additive `src/lib/admin-nav.ts` si pertinent (sinon accès via formations).
- Tokens admin, français, force-dynamic + noindex, zéro hex.

## Definition of Done T13 (GATE central)
typecheck heap + `vitest run src/server/qualiopi` vert + isolation 0 + i18n + lint 0 + anti-hex 0 + les 7 types de supports rendent un PDF %PDF à la charte + génération persistée (SupportFormation). [off.17, off.19]
