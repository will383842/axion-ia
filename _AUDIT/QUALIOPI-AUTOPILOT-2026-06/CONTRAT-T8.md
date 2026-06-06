# CONTRAT D'INTERFACE — T8 Émargement présentiel + relevé de connexion

Schéma + migration **déjà faits** par l'orchestrateur (migration `20260606180000_qualiopi_t8_emargement_presence` appliquée ; `prisma generate` fait). Modèles Prisma disponibles : `PresenceCreneau`, `ReleveConnexionImport`, enums `DemiJournee` (`matin|apres_midi|journee`), `PresenceSource` (`emargement_presentiel|import_zoom|import_teams|import_meet|manuel`), `PlateformeDistanciel` (`zoom|teams|meet|autre`). `DocumentGenere.fichierOriginalPath` (nullable) ajouté.

## Règles NON négociables (toutes les agents)
- Import Prisma : `import { prisma } from "@/lib/prisma"` ; types Prisma depuis `../../../../prisma/generated/client` (PAS `@prisma/client`).
- Stub-aware : toute fonction qui mute la DB dans un chemin pouvant tourner au build → early-exit `if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return …`. (Les actions admin ne tournent pas au build → pas besoin, mais le service de génération de doc oui.)
- `exactOptionalPropertyTypes: true` → JAMAIS passer `where: undefined` ; spread conditionnel `...(x !== undefined ? { x } : {})`.
- Zéro valeur en dur (couleurs → tokens admin `var(--color-admin-*)`, seuils → `getQualiopiConfig`). Seuil présence = clé config `seuil_presence_pct` (défaut 80) via `getQualiopiConfig("seuil_presence_pct")`.
- Fuseau : tout calcul de date civile/heure = **Europe/Paris**. Stockage horodatages = UTC.
- Français partout (UI, commentaires, libellés).
- Tests Vitest co-localisés `*.spec.ts(x)` ; aucun mock de prod ; fixtures réalistes.
- Cloisonnement : fichiers UNIQUEMENT sous `src/server/qualiopi/presence/**`, `src/server/actions/qualiopi/presence.ts`, `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/sessions/**`, `src/components/admin/qualiopi/**`.

## Types partagés (AGENT A les définit dans `src/server/qualiopi/presence/types.ts`)
```ts
export type DemiJourneeLabel = "matin" | "apres_midi" | "journee";
export type PlateformeLabel = "zoom" | "teams" | "meet" | "autre";

export interface CreneauPlan {
  date: string;               // ISO date "2026-06-10" (Europe/Paris)
  demiJournee: DemiJourneeLabel;
  libelle: string;            // "2026-06-10 matin"
  dureePrevueMinutes: number;
}
export interface ParsedParticipant {
  nomBrut: string;
  email: string | null;
  joinAt: Date | null;        // UTC
  leaveAt: Date | null;       // UTC
  dureeMinutes: number;       // minutes de connexion effectives (somme des intervalles)
}
export interface ParsedReleve {
  plateforme: PlateformeLabel;
  idReunion: string | null;
  participants: ParsedParticipant[];
  nbLignes: number;
  meta: Record<string, string | number | null>;
}
export interface MatchInput { enrollmentId: string; email: string; nom: string; prenom: string }
export interface MatchResult {
  matched: Array<{ enrollmentId: string; participant: ParsedParticipant }>;
  unmatched: ParsedParticipant[];
}
export interface TauxResult { tauxPct: number; minutesPrevues: number; minutesRealisees: number }
```

## AGENT A — logique pure (aucun accès DB) `src/server/qualiopi/presence/`
Fichiers + tests :
- `types.ts` (ci-dessus).
- `creneaux.ts` : `genererCreneaux(input: { dateDebut: Date; dateFin: Date; heuresParJour?: number }): CreneauPlan[]`. Un jour ouvré par date entre dateDebut et dateFin inclus ; par jour 2 créneaux `matin` + `apres_midi`, chacun `heuresParJour*60/2` minutes (défaut heuresParJour=7 → 210 min/créneau). Heure de Paris. Libellé `"YYYY-MM-DD matin|après-midi"` (utilise "matin"/"apres_midi" en valeur mais libellé lisible). Si la session dure < 1 jour, 1 seul jour.
- `time.ts` : `formatMinutesToHHhMM(min: number): string` ("7h03", "0h45") ; `parisDateISO(d: Date): string` ("2026-06-10") ; `parisDateLabel(iso: string, dj: DemiJourneeLabel): string`.
- `taux.ts` : `computeTauxPresence(creneaux: Array<{ dureePrevueMinutes: number; dureeRealiseeMinutes: number }>): TauxResult` (tauxPct = round(Σréalisé/Σprévu*100), 0 si prévu=0) ; `classifierPresence(tauxPct: number, seuilCompletePct?: number): "complete" | "partielle" | "aucune"` (≥ seuilComplete(défaut 80) → complete ; 60..seuilComplete-1 → partielle ; <60 → aucune — décision Will #7).
- `parse-zoom.ts` : `parseZoomCsv(content: string): ParsedReleve`. Format rapport participants Zoom (colonnes typiques : "Name (Original Name)", "User Email", "Join Time", "Leave Time", "Duration (Minutes)"). Plusieurs lignes par participant possibles → agréger durées par email (sinon par nom). join/leave = min(join)/max(leave). Parse dates au format Zoom ("MM/DD/YYYY hh:mm:ss AM/PM", supposé Europe/Paris → convertir en UTC). Robuste aux BOM, guillemets, séparateur `,`.
- `parse-teams.ts` : `parseTeamsCsv(content: string): ParsedReleve`. Rapport de présence Teams = TSV (séparateur TAB), souvent UTF-16LE avec BOM (gérer décodage : si le caller fournit déjà une string, gérer le BOM `﻿` et les NUL). Sections "1. Summary / 2. Participants / 3. In-Meeting Activities". Extraire la section participants : colonnes "Name", "Email" (ou "UPN"), "Duration", "First Join", "Last Leave". Durée Teams souvent format "1h 5m 3s" ou secondes → convertir en minutes.
- `parse-meet.ts` : `parseMeetCsv(content: string): ParsedReleve`. Google Meet attendance CSV (colonnes "Name", "Email", "Duration", "Time joined", "Time exited"). Durée en minutes.
- `parse-releve.ts` : `parseReleveConnexion(content: string, plateforme: PlateformeLabel): ParsedReleve` dispatcher ; `autodetectPlateforme(content: string): PlateformeLabel` (heuristique sur en-têtes).
- `match.ts` : `matchParticipants(parsed: ParsedParticipant[], enrollments: MatchInput[]): MatchResult`. 1) match exact email (lower/trim). 2) sinon nom normalisé (minuscule, sans accents via `String.prototype.normalize("NFD").replace(/\p{Diacritic}/gu,"")`, tokens triés) vs `${prenom} ${nom}` et `${nom} ${prenom}`. Un enrollment matché au plus une fois (le plus long en durée gagne en cas de doublon).
- specs : `creneaux.spec.ts`, `taux.spec.ts`, `time.spec.ts`, `parse-zoom.spec.ts`, `parse-teams.spec.ts`, `parse-meet.spec.ts`, `match.spec.ts`. Fixtures CSV en chaînes inline réalistes.

## AGENT B — service + server actions (importe AGENT A)
`src/server/qualiopi/presence/presence-service.ts` :
- `recomputeTauxPresence(enrollmentId: string): Promise<number>` : lit tous les `PresenceCreneau` de l'enrollment, applique `computeTauxPresence`, met à jour `Enrollment.tauxPresencePct` (et `present` de chaque créneau = `dureeRealisee >= seuil * dureePrevue` avec seuil de config / défaut 0.5 par créneau — détail : un créneau compte présent si réalisé ≥ moitié du prévu). Retourne le tauxPct. Stub-aware.
- `upsertCreneau(...)` helper interne (unique [enrollmentId,date,demiJournee]).

`src/server/actions/qualiopi/presence.ts` (`"use server"`, pattern EXACT de `src/server/actions/qualiopi/enrollments.ts` : `requireAdminWrite()` + Zod safeParse + `ActionResult<T>` = `{data}|{error}` + `logQualiopiActivity`) :
- `generateSessionCreneauxAction(input: { sessionId: string; heuresParJour?: number }): Promise<ActionResult<{ created: number }>>` : lit la session (dateDebut/dateFin/dureeReelleHeures) + ses enrollments non abandon/exclu, `genererCreneaux`, upsert un PresenceCreneau présentiel par (enrollment×créneau) avec `source: "emargement_presentiel"`, present=false, dureeRealisee=0. Idempotent.
- `saveEmargementAction(input: { sessionId: string; entries: Array<{ enrollmentId: string; date: string; demiJournee: DemiJourneeLabel; present: boolean; dureeRealiseeMinutes?: number }> }): Promise<ActionResult<{ updated: number }>>` : upsert présentiel ; si present et dureeRealiseeMinutes absent → = dureePrevue du créneau ; recompute taux pour chaque enrollment touché ; set `Enrollment.emargementSigneAt = now` ; audit.
- `importReleveConnexionAction(input: { sessionId: string; plateforme: PlateformeLabel; fileName: string; content: string }): Promise<ActionResult<{ importId: string; nbMatched: number; nbUnmatched: number; unmatched: Array<{ nom: string; email: string | null; dureeMinutes: number }> }>>` : parse via `parseReleveConnexion` → enrollments de la session (join trainee email/nom/prenom) → `matchParticipants` → calc hash SHA-256 du contenu → archive CSV brut sur R2 (`storeAndSignCsv`, cf. ci-dessous) → crée `ReleveConnexionImport` → pour chaque matched, crée un PresenceCreneau `journee` (date = dateDebut session, source `import_<plateforme>`, heureConnexion/Deconnexion, dureeRealiseeMinutes=participant.dureeMinutes, dureePrevueMinutes = dureeReelleHeures*60 ou créneaux générés) → recompute taux des matched → audit. Tolérer R2 absent (path null).
- `setPresenceCreneauManualAction(input: { creneauId: string; present: boolean; dureeRealiseeMinutes: number; commentaire?: string }): Promise<ActionResult<{ id: string }>>` : maj manuelle + recompute taux + audit (source `manuel`).

Archivage CSV : ajouter dans `src/server/qualiopi/documents/render.ts` une fonction `storeAndSignCsv(content: string, key: string): Promise<string | null>` (miroir `storeAndSignPdf` mais contentType `text/csv`, retourne la **clé** stockée pour `fichier_original_path` ; signer optionnel). Et étendre `GenerateDocumentInput` (`documents-service.ts`) avec `fichierOriginalPath?: string` passé dans le `create` DB (additif). Génère un `DocumentGenere` type `releve_connexion` lié à la session avec `fichierOriginalPath` = clé du CSV (le PDF est généré depuis le template `ReleveConnexionPdf` existant `src/server/qualiopi/documents/templates/releve-connexion.tsx`, alimenté par les matched).
Specs : `presence-service.spec.ts`, `presence-actions.spec.ts` (mock `@/lib/prisma` + `@/server/actions/qualiopi/_guards` comme les specs qualiopi existantes — regarde `src/server/qualiopi/**/*.spec.ts` pour le pattern de mock).

## AGENT C — UI admin (importe les actions d'AGENT B, par signature ci-dessus)
- `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/sessions/page.tsx` : liste des sessions (Server Component, pattern EXACT de `qualiopi/formations/page.tsx` : auth redirect, `AdminPageShell`, `AdminPageHeader`, `AdminStatCard`, `force-dynamic`, `robots noindex`). Colonnes : numéro, titre, formation, dates, modalité, statut, nb inscrits, taux présence moyen. Lien vers émargement par session.
- `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/sessions/[id]/emargement/page.tsx` : Server Component qui charge la session + enrollments + créneaux existants, et rend :
  - un bouton "Générer les créneaux" (server action `generateSessionCreneauxAction`).
  - `EmargementGrid` (client component `src/components/admin/qualiopi/EmargementGrid.tsx`) : grille créneaux × stagiaires, cases présent/absent + minutes, submit → `saveEmargementAction`. `"use client"`.
  - `ImportReleveForm` (client `src/components/admin/qualiopi/ImportReleveForm.tsx`) : `<input type="file" accept=".csv,.tsv,.txt">` → lit le fichier en texte côté client (`file.text()`) + select plateforme → appelle `importReleveConnexionAction` → affiche rapport matched/unmatched. `"use client"`.
  - récap taux présence par stagiaire (couleur selon `classifierPresence`).
- Lire les données via un module serveur (créer `src/server/qualiopi/presence/queries.ts` si besoin, OU réutiliser prisma directement dans la page — server component). Pas de fetch DB côté client.
- Ajouter l'entrée nav "Sessions" dans le groupe `qualiopi` de `src/lib/admin-nav.ts` si absente (item href `${adminPrefix}/qualiopi/sessions`).
- Respecter budgets Web Vitals : composants client minimaux ; pas de lib lourde. Tokens admin uniquement.
Specs : un test léger de rendu n'est pas requis pour les pages serveur ; si tu ajoutes de la logique pure côté UI, teste-la.

## Definition of Done T8 (orchestrateur vérifie au GATE central)
typecheck (heap 8G) + `vitest run src/server/qualiopi` vert + `qualiopi:isolation-check --staged` + `i18n:check` + indicateur 12 couvert (feuille d'émargement OU relevé connexion produits + taux consolidé).
