# CONTRAT D'INTERFACE — T14 Portail stagiaire + appréciations multi-parties (off.30) + RGPD

Schéma + migration **déjà faits** (`20260606240000`, `prisma generate` fait). Modèles : `PortailAcces` (traineeId, token unique 64, expiresAt, revoked, lastUsedAt), `Appreciation` (source, enrollmentId?, traineeId?, clientId?, note?, commentaire?, dateAppreciation), `RgpdDemande` (traineeId, type, statut, demandeAt, traiteeAt?) + enums `AppreciationSource` (`stagiaire|entreprise|financeur|formateur`), `RgpdDemandeType` (`export|suppression`), `RgpdDemandeStatut` (`demandee|traitee|refusee`). `Trainee.portailAcces/appreciations/rgpdDemandes`.

## Décisions Will (cf. STATE §3)
- **#6 token portail** : 90 jours, révocable, renouvelable. Flux : token URL → vérif `timingSafeEqual` → cookie HttpOnly → redirect `/portail/mon-espace` SANS token. Cookie : `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`. lastUsedAt mis à jour.
- **#7/#8** : déjà couverts (attestations/présence).
- Le portail fonctionne **sans** le flag OF_PUBLIC_DISCLOSURE (comme `/verifier-attestation`) — accès réservé au stagiaire via token. AUCUNE mention marketing Qualiopi/CPF/financement dans le portail.

## Règles NON négociables
- Prisma via `@/lib/prisma`, types via `../../../../prisma/generated/client`. Stub-aware. `exactOptionalPropertyTypes`.
- Cookies : `cookies()` de `next/headers` (set uniquement dans Server Action / Route Handler). Token via `makeQrToken()` (`@/server/qualiopi/documents/qr`) ou `crypto.randomBytes`. Comparaison `timingSafeEqual`.
- Handicap (PII) : chiffrer via `encryptPii`/`decryptPii` de `@/lib/pii-crypto` (stocké `Trainee.handicapDetailsChiffre`). JAMAIS de PII handicap en clair.
- RGPD suppression = soft-delete (`Trainee.deletedAt`) + anonymisation des champs PII (nom/prénom/email/téléphone → valeurs anonymes), PAS de DELETE physique (intégrité comptable/légale). Export = JSON de toutes les données du stagiaire.
- Français. Tokens admin pour l'UI admin ; le portail public reste sobre (charte publique, pas de tokens admin). Tests co-localisés, aucun mock de prod.
- Cloisonnement : `src/server/qualiopi/portail/**`, `src/server/actions/qualiopi/portail.ts` + `appreciations.ts` (NB : `appreciations` distinct de T12 `reclamations`), UI `src/app/[locale]/portail/**` (public) + `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/{portail,appreciations}/**`, `src/components/admin/qualiopi/**` + `src/components/portail/**`, modif additive `src/lib/admin-nav.ts`.

## AGENT A — services `src/server/qualiopi/portail/`
- `portail-service.ts` :
  - `creerAcces(traineeId: string, joursValidite?: number): Promise<{ id: string; token: string; expiresAt: Date }>` (défaut 90 j ; révoque les accès actifs précédents optionnel). Stub-aware.
  - `verifierToken(token: string): Promise<{ traineeId: string } | null>` (non révoqué, non expiré, timingSafe ; met à jour lastUsedAt).
  - `revoquerAcces(id: string): Promise<void>`.
  - `getEspaceStagiaire(traineeId: string): Promise<EspaceStagiaire>` — { trainee(prenom/nom), formations: [{titre, dates, statut}], attestations: [{type, numero, pdfUrl, qrToken}], questionnaires: [{type, token, reponduAt}], situationHandicap }.
  - `+ portail-service.spec.ts`.
- `cookie.ts` : `setPortailCookie(token: string): void` (cookies().set httpOnly/secure/sameSite=lax/maxAge=90j), `getPortailToken(): string | null`, `clearPortailCookie(): void`. (Appelables depuis action/route uniquement.)
- `rgpd-service.ts` : `exporterDonneesStagiaire(traineeId): Promise<object>` (JSON complet : trainee + enrollments + evaluations + questionnaires + documents + appreciations, handicap déchiffré via decryptPii), `supprimerStagiaire(traineeId): Promise<void>` (anonymise PII + deletedAt=now), `creerDemandeRgpd(traineeId, type)`. + spec.
- `appreciation-service.ts` : `creerAppreciation(input)`, `listAppreciations(options?)`, `statsAppreciations()` (moyenne note par source). + spec.

## AGENT B — actions + route `src/server/actions/qualiopi/`
- `portail.ts` (`"use server"`) :
  - `accederPortailAction({ token })` : `verifierToken` → si ok `setPortailCookie` + retourne `{ ok: true }` (la redirection est faite côté page) ; sinon `{ error }`.
  - `quitterPortailAction()` : `clearPortailCookie`.
  - `genererPortailAccesAction({ traineeId })` (ADMIN, requireAdminWrite) → `creerAcces` + audit + retourne token+url.
  - `revoquerPortailAccesAction({ id })` (ADMIN).
  - `soumettreSatisfactionPortailAction({ token: questionnaireToken, reponses, noteGlobale? })` : réutilise `soumettreReponses` de T10 (satisfaction-service) — accessible via cookie portail.
  - `declarerHandicapAction({ besoin })` : lit le cookie portail → trainee, set situationHandicap=true + handicapDetailsChiffre=encryptPii(besoin).
  - `demanderExportRgpdAction()` / `demanderSuppressionRgpdAction()` : via cookie portail → `creerDemandeRgpd`.
- `appreciations.ts` (`"use server"`) : `creerAppreciationAction` (ADMIN ou portail), `traiterDemandeRgpdAction` (ADMIN → export/suppression effective).
- specs sous `src/server/qualiopi/portail/*-actions.spec.ts`.

## AGENT C — UI publique + admin
- Public `src/app/[locale]/portail/` :
  - `acces/[token]/page.tsx` : Server Component qui appelle (via une petite action ou route) la vérif + set cookie puis `redirect("/[locale]/portail/mon-espace")`. (Pour set cookie : utiliser un Route Handler `acces/[token]/route.ts` OU un Server Component qui rend un client component appelant `accederPortailAction` puis redirige. Choisis la voie la plus simple et sûre.)
  - `mon-espace/page.tsx` : lit cookie → `getEspaceStagiaire` → affiche attestations (liens), questionnaires satisfaction à remplir, déclaration handicap, RGPD (export/suppression), bouton quitter. Si pas de cookie valide → message d'accès refusé.
  - composants clients `src/components/portail/*` (`"use client"` + `// use-client:`) : SatisfactionPortailForm, HandicapDeclarationForm, RgpdActions.
  - Sobre, charte publique (PAS de tokens admin ici ; styles publics simples Tailwind), français, `robots noindex`, force-dynamic. AUCUNE mention financement.
- Admin :
  - `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/appreciations/page.tsx` (liste + stats + form création) + `appreciations/...`.
  - bouton « Générer accès portail » sur la fiche stagiaire/enrollment (composant client) → `genererPortailAccesAction` (affiche l'URL token à transmettre).
  - modif additive `src/lib/admin-nav.ts` : item « Appréciations ».
- Actions = AGENT B.

## Definition of Done T14 (GATE central)
typecheck heap + `vitest run src/server/qualiopi` vert + isolation 0 + i18n + lint 0 + anti-hex 0 + flux token→cookie testé + export/suppression RGPD + handicap chiffré (encryptPii) + appréciations off.30. [off.30, RGPD §D]
