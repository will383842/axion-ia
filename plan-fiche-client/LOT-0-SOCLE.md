# LOT 0 — SOCLE : emplacements nommés dans la fiche client (aucun changement visible)

Branche : `feat/fiche-socle-emplacements` · Relecture : Opus, 1 tour (garde de rôle A2 à préserver) · Taille : ~0,5 j.

## Prérequis (vérifie AVANT de commencer, sinon ARRÊTE et dis-le)
`gh pr view 1695 --json state` et `gh pr view 1694 --json state` doivent rendre `MERGED`. Ces deux PR modifient la même page ; tu pars d'un main qui les contient. Vérifie aussi que `src/components/admin/dossier-client/SuiviPrestations.tsx` et `src/components/admin/dossier-client/FactureHorsConsole.tsx` existent sur `origin/main`.

## Objectif
La page `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/clients/[id]/page.tsx` est touchée par toutes les PR de la refonte. Ce lot y pose UNE FOIS des EMPLACEMENTS nommés, chacun délégué à un fichier neuf qui rend `null` (ou le rendu actuel, déplacé tel quel). Ensuite, plus aucun lot ne touche `page.tsx` : chacun remplace le corps de SON fichier. Le rendu HTML de la fiche doit rester IDENTIQUE, sauf deux détails d'en-tête : « Éditer » devient « Modifier la fiche », et « Envoyer le questionnaire » passe en `variant="secondary"` (le seul bouton plein viendra de la carte « Prochaine action », lot B1).

## Ce qui EXISTE (ne pas refaire)
- Page fiche : `getClient360`, garde `gardePage("consultation")`, `peutVoirLesEchanges(acces.role)` donne `voitEchanges` (régime A2 : rien du dossier n'est requêté hors de ce rôle).
- Onglets : `ONGLETS_DOSSIER`, `LIBELLE_ONGLET`, `ANCIENS_ONGLETS`, `ongletAffiche`, `AdminFilterTabs` (option `count?: number` déjà prise en charge).
- Bloc « devis-factures » (le fragment rendu quand `onglet === "devis-factures"`, avec `FactureHorsConsole` ajouté par #1695), ses helpers `eur`, `StatutBadge`, `SectionTitre`, `SectionVide` et les tables `PRESTATION_STATUT`, `DEVIS_STATUT`, `FACTURE_STATUT`, `DOSSIER_STATUT`, `DOSSIER_TYPE`, `DOC_LABELS`.
- Tests de la page : `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/clients/[id]/__tests__/*.spec.tsx` (6 fichiers ; les `vi.mock` sont dans chaque fichier) et l'aide `_fiche-client-rendu.tsx`.

## Fichiers à créer (dossier `src/components/admin/dossier-client/fiche/`)
1. `contexte.ts` : `export interface ContexteFiche` avec, tout en `readonly` : `clientId`, `locale: "fr" | "en"`, `adminPrefix`, `qBase`, `ficheHref`, `role` (type de `acces.role`), `peutEcrire: boolean`, `voitEchanges: boolean`, `maintenant: Date`, `sp: Readonly<Record<string, string | undefined>>`, `erreur: string | null`, `message: string | null`.
2. Un fichier par emplacement, chacun avec un commentaire d'en-tête « Emplacement du lot X : seul ce lot modifie ce fichier ». Type de retour des fonctions async : `Promise<React.ReactElement | null>`.

| Fichier | Signature exacte | Corps au lot 0 | Lot propriétaire |
|---|---|---|---|
| `EnTeteFiche.tsx` | `export async function enTeteFiche(ctx: ContexteFiche)` et `export const EN_TETE_REMPLACE_LE_BANDEAU = false;` | `return null` | B1 |
| `compteurs-onglets.ts` | `export interface CompteurOnglet { readonly count?: number }` et `export async function compteursOnglets(ctx: ContexteFiche): Promise<Readonly<Record<string, CompteurOnglet>>>` | `return {}` | B1 |
| `OngletActivite.tsx` | `export async function ongletActivite(ctx: ContexteFiche)` et `export const ONGLET_ACTIVITE_PRET = false;` | `return null` | B2 |
| `ResumeTaches.tsx` | `export async function resumeTaches(ctx: ContexteFiche)` | `return null` | B3 |
| `ResumeNotes.tsx` | `export async function resumeNotes(ctx: ContexteFiche)` | `return null` | B4 |
| `ResumePrestations.tsx` | `export async function resumePrestations(ctx: ContexteFiche)` | `return null` | B8 |
| `PersonnesDecision.tsx` | `export async function personnesDecision(ctx: ContexteFiche)` | `return null` | B5 |
| `ActionsDeLaPersonne.tsx` | `export function ActionsDeLaPersonne(props: { ctx: ContexteFiche; personneId: string }): React.ReactElement` (SYNCHRONE) | le `RetraitPersonne` actuel de la page, DÉPLACÉ tel quel (mêmes props, calculées depuis `ctx`) | B5 |
| `QuestionnaireEnBref.tsx` | `export async function questionnaireEnBref(ctx: ContexteFiche)` | `return null` | B10 |
| `ArchivageFiche.tsx` | `export async function archivageFiche(ctx: ContexteFiche)` | `return null` | B6 |
| `OngletDevisFactures.tsx` | `export function OngletDevisFactures(props)` (SYNCHRONE ; props = tout ce que le bloc lit aujourd'hui, plus `ctx`) | le bloc devis-factures DÉPLACÉ tel quel, avec ses helpers et tables ; dans la section « Devis », juste après `BandeauAttributionPartners`, le commentaire `EMPLACEMENT:RELANCE-DEVIS (lot B9)` suivi de l'élément `RelanceDevis` avec `ctx={ctx}` et `devis={client.devis}` | B7 |
| `RelanceDevis.tsx` | `export function RelanceDevis(props: { ctx: ContexteFiche; devis: ReadonlyArray<{ id: string; numero: string; statut: string; montantTotalHtCents: number; createdAt: Date }> })` (SYNCHRONE, AUCUNE lecture en base, retour `React.ReactElement | null`) | `return null` | B9 |

3. `emplacements.ts` : ré-exporte TOUS les symboles ci-dessus (une ligne par fichier). La page n'importe QUE ce module : `import * as E from "@/components/admin/dossier-client/fiche/emplacements";`.
4. `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/clients/[id]/__tests__/_emplacements-vides.ts` : exporte `emplacementsVides`, objet avec toutes les fonctions async qui rendent `null`, `compteursOnglets` qui rend `{}`, les deux constantes à `false`, et les VRAIS `ActionsDeLaPersonne`, `OngletDevisFactures`, `RelanceDevis` (import direct de leurs fichiers), pour que les tests actuels voient toujours le rendu déplacé.
5. `montants.ts` : `export function htEtTtc(htCents: number): { ht: string; ttc: string }` (« 4 500 € HT » / « 5 400 € TTC », taux `TAUX_TVA_STANDARD` de `src/server/qualiopi/legal/tva.ts`, arrondi au centime, `Intl.NumberFormat("fr-FR")`). Test `fiche/__tests__/montants.spec.ts` : 120000 donne « 1 200 € HT » et « 1 440 € TTC » (espaces insécables), 0, centimes.
6. `Frise.tsx` : `export function Frise(props: { etiquette: string; etapes: ReadonlyArray<{ libelle: string; etat: "fait" | "courant" | "a_venir" | "hors_parcours" }> })` : liste `ol` avec `aria-label={etiquette}`, pastille + mot, « (fait) » en `sr-only`, `aria-current="step"` sur l'étape courante ; vert = fait, bleu = courant, gris = à venir ou hors parcours. Test `fiche/__tests__/frise.spec.tsx` (`renderToStaticMarkup`). Utilisée par B1 (parcours du client) et B8 (étapes d'une prestation).

## Fichier à modifier : `page.tsx` (plus les 6 tests de la page)
Pose chaque appel avec, sur la ligne au-dessus, le commentaire JSX exact `EMPLACEMENT:<NOM> (lot <X>)` :
- Construire `ctx` une seule fois, juste après `const maintenant = new Date();`.
- `EMPLACEMENT:EN-TETE (lot B1)` : juste après `AdminPageHeader`, AVANT `BandeauEtatFonds`. Valeur calculée avant le `return` : `const enTete = voitEchanges ? await E.enTeteFiche(ctx) : null;`.
- Le `BandeauOuEnEst` existant ne s'affiche plus que si `lignesBandeau !== null && !E.EN_TETE_REMPLACE_LE_BANDEAU`.
- `EMPLACEMENT:ARCHIVAGE (lot B6)` : juste après `SuppressionManuelle`, le résultat de `await E.archivageFiche(ctx)` (calculé seulement si `voitEchanges`).
- Onglets : `"activite"` s'insère juste après `"resume"`, seulement si `E.ONGLET_ACTIVITE_PRET` ; `LIBELLE_ONGLET.activite = "Activité"` ; `ongletAffiche` retombe sur « resume » si l'onglet n'est pas prêt. `EMPLACEMENT:COMPTEURS (lot B1)` : `const compteurs = voitEchanges ? await E.compteursOnglets(ctx) : {};` puis `count: compteurs[o]?.count` dans les options de `AdminFilterTabs`.
- `EMPLACEMENT:ONGLET-ACTIVITE (lot B2)` : nouvelle branche `else if (voitEchanges && onglet === "activite")` qui pose `contenuDossier = await E.ongletActivite(ctx);`.
- Branche `resume` : AVANT `OngletSynthese`, trois lignes séparées, dans cet ordre : `EMPLACEMENT:RESUME-TACHES (lot B3)`, `EMPLACEMENT:RESUME-PRESTATIONS (lot B8)`, `EMPLACEMENT:RESUME-NOTES (lot B4)` (valeurs calculées avant, dans le `Promise.all` existant de la branche).
- Branche `questionnaire` : AVANT `BlocQuestionnaireFiche` et avant le message « Aucun questionnaire… » : `EMPLACEMENT:QUESTIONNAIRE-EN-BREF (lot B10)`.
- Branche `personnes` : AVANT `OngletPersonnes` : `EMPLACEMENT:PERSONNES-DECISION (lot B5)` ; la prop `retrait` rend désormais `E.ActionsDeLaPersonne` avec `ctx` et `personneId`.
- `EMPLACEMENT:DEVIS-FACTURES (lot B7)` : le fragment rendu quand `onglet === "devis-factures"` est remplacé par l'élément `E.OngletDevisFactures`. Les lectures (`encoursDuCents`, `factures`, `factureHorsConsoleLe`, `bandeauPartners`, `nbEmailsAValider`, `client`) restent faites dans la page et passent en props : AUCUN changement de comportement, y compris pour les rôles qui ne voient pas le dossier.
- En-tête : « Éditer » devient « Modifier la fiche » ; « Envoyer le questionnaire » reçoit `variant="secondary"`.
- Retire de la page les imports devenus inutiles. Aucun autre changement.

Dans les 6 fichiers `__tests__/*.spec.tsx` de la page : ajoute le `vi.mock` de `@/components/admin/dossier-client/fiche/emplacements` qui rend `emplacementsVides`, et adapte UNIQUEMENT ce qui casse à cause du libellé « Modifier la fiche ».

## Tests à écrire
- `fiche/__tests__/montants.spec.ts`, `fiche/__tests__/frise.spec.tsx`.
- `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/clients/[id]/__tests__/les-emplacements-sont-poses.spec.ts` : lit `page.tsx` en texte ; chaque ancre `EMPLACEMENT:<NOM>` (EN-TETE, ARCHIVAGE, COMPTEURS, ONGLET-ACTIVITE, RESUME-TACHES, RESUME-PRESTATIONS, RESUME-NOTES, QUESTIONNAIRE-EN-BREF, PERSONNES-DECISION, DEVIS-FACTURES) apparaît UNE fois ; la page n'importe aucun fichier de `fiche/` sauf `emplacements` ; `OngletDevisFactures.tsx` contient `EMPLACEMENT:RELANCE-DEVIS` une fois. Cette garde protège tous les lots suivants.
- Un test de rendu : avec les emplacements vides, l'onglet `devis-factures` rend toujours les sections « Sessions de formation », « Contrats de coaching », « Missions d'audit », « Devis », « Factures », « Documents générés », « Dossiers de financement », « E-mails en attente ».

## Critère de fin
Tests verts, `pnpm typecheck` vert. `git diff --name-only origin/main` ne liste QUE : `page.tsx`, ses tests et `_emplacements-vides.ts`, `les-emplacements-sont-poses.spec.ts`, et `src/components/admin/dossier-client/fiche/**`.

## Texte de la PR
Titre : `refactor(fiche-client): emplacements nommés pour la refonte (lot 0, aucun changement visible)`. Corps : la page ne sera plus modifiée par les lots suivants ; tableau emplacement → lot ; « à fusionner AVANT tous les lots B ».

---
## RÈGLES COMMUNES (console, dépôt will383842/axion-ia) — à respecter à la lettre

### Démarrage et fin
1. `git fetch origin && git switch -c <branche du lot> origin/main`. Lis `AGENTS.md` (racine) et `node_modules/next/dist/docs/` si tu touches une API Next.js.
2. `pnpm install --frozen-lockfile && pnpm prisma:generate`.
3. Code, tests, puis vérifications (section « Vérifications » du lot).
4. Avant de pousser : `git fetch origin && git rebase origin/main`. Un conflit dans UN DE TES fichiers : résous-le. Un conflit dans un fichier qui n'est PAS dans ta liste « Fichiers à créer / à modifier » : ARRÊTE, `git rebase --abort`, pousse quand même ta branche telle quelle et écris le conflit en tête de la description de PR (« CONFLIT : … »). Ne résous jamais un conflit dans le fichier d'un autre lot.
5. `git push -u origin <branche>` puis `gh pr create --base main --title "<titre>" --body-file <fichier>` (vérifie `[ -s fichier ]` avant). UNE seule PR. Ne fusionne pas, ne déploie pas, ne touche à aucun drapeau Coolify.
6. Commit en français, terminé par la ligne `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Description de PR terminée par `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

### Périmètre de fichiers (anti-conflit)
- Tu ne modifies QUE les fichiers listés dans ton lot. Tout le reste : lecture seule.
- `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/clients/[id]/page.tsx` : INTERDIT à tous les lots sauf le lot 0 (SOCLE). Les autres lots se branchent par LEUR fichier d'emplacement dans `src/components/admin/dossier-client/fiche/` (créé par le lot 0, il rend `null` au départ ; tu remplaces son corps).
- `src/components/admin/dossier-client/fiche/emplacements.ts` et `src/app/.../clients/[id]/__tests__/_emplacements-vides.ts` : INTERDITS (lot 0 seul).
- Partagés INTERDITS : `src/lib/rgpd-erase.ts`, `src/lib/rgpd-dossier-client.ts`, `tests/unit/ci/les-tables-du-dossier-client-suivent-la-personne.spec.ts` (lot A1 seul), `src/components/admin/dossier-client/__tests__/vocabulaire-des-fiches-clients.spec.ts` (personne : chaque lot écrit SA propre garde de vocabulaire, voir plus bas), `prisma/schema.prisma` et `prisma/migrations/` (aucun lot sauf C3), `package.json`, `pnpm-lock.yaml` (aucune nouvelle dépendance).
- Chaque nouveau composant ou fonction va dans un NOUVEAU fichier.

### Interdits de fond (ordres de Will)
- AUCUNE suppression de données client ni de personne (pas de `delete`/`deleteMany` sur une donnée client ; « archiver », « marquer faite », « noter le départ » = poser une date, jamais effacer).
- AUCUN e-mail envoyé par le code de ton lot. Un message à envoyer = un BROUILLON garé « à valider » par `garerPourValidation` (`src/server/email/outbox-service.ts`) ; si elle rend `null`, tu AFFICHES une erreur, tu n'envoies JAMAIS « normalement » (contrairement à son commentaire).
- AUCUN montant, aucun texte de note, aucune réponse de questionnaire vers le CRM Pro.
- Vocabulaire à l'écran : jamais « projet » (dire « prestation »), jamais « Synthèse » (« Résumé »), jamais « Échanges » (« Rendez-vous » ou « Activité »), jamais « Rencontre » ; bannis aussi « Gérer », « Engagements », « Pénalités » (dans les NOUVEAUX textes), « Échéance » (dire « avant le … »), « Probabilité » (dire « Chances de signer »), « Jamais ouvert » (dire « Pas encore ouvert »). Jamais « certifié », « certification », « Qualiopi » dans un texte affiché nouveau. Jamais « Grenoble ». Jamais « Aucun gain garanti ».
- Argent : tout montant s'écrit « X € HT » avec le TTC en petit dessous ; TVA = `TAUX_TVA_STANDARD` (20, `src/server/qualiopi/legal/tva.ts`), jamais d'exonération. Espaces insécables (`Intl.NumberFormat("fr-FR")`). Dates : `timeZone: "Europe/Paris"` toujours.
- Console en mode CLAIR seulement (pas de `dark:`). Couleurs = teintes d'`AdminBloc` (`src/components/admin/ui/AdminBloc.tsx`) avec UN SEUL sens : terracotta = à faire / action de Will / échec ; bleu = en cours / prévu ; vert = fait / en règle ; ambre = argent ou attention ; violet = découverte ; gris = neutre. Toujours icône (lucide-react, `aria-hidden`) ET mot, jamais la couleur seule.
- UN SEUL bouton plein (primary) par écran : il appartient à la carte « Prochaine action » (lot B1). Tes boutons sont `variant="secondary"`.
- Rôles : rien du dossier n'est lu ni rendu hors `ctx.voitEchanges` (déjà jugé par la page). Une action serveur REVÉRIFIE le rôle elle-même (`gardePage`/`requireAdminWrite`, voir les actions voisines dans `src/features/dossier-client/actions.ts`) : masquer un bouton n'est pas interdire.
- Une lecture en panne ne s'affiche jamais comme « rien » : écrire « Lecture impossible » (voir `TEXTE_LECTURE_IMPOSSIBLE`, `src/features/dossier-client/bandeau-ou-en-est.ts`).
- Poids : Server Components par défaut. `"use client"` seulement si indispensable (le cliquet `pnpm bundle:check` BLOQUE la PR). Filtres et onglets par paramètre d'URL (`?filtre=`), pas par état JavaScript.
- Accessibilité : cibles ≥ 44 px, texte ≥ 13 px, titres h2 puis h3, `<ol>` pour une frise, actions = `<button>`/`<form action>`, navigations = `<Link>`. Mise en page lisible sur téléphone (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`).

### Garde de vocabulaire du lot
Crée `src/components/admin/dossier-client/__tests__/vocabulaire-<nom-du-lot>.spec.ts` : lit tes nouveaux fichiers d'affichage (commentaires retirés, comme `vocabulaire-des-fiches-clients.spec.ts` qu'il faut imiter SANS le modifier) et échoue si un mot interdit ci-dessus apparaît dans un texte.

### Vérifications légères (dans la routine)
- `pnpm exec vitest run <tes fichiers de test> "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/clients/[id]/__tests__" src/components/admin/dossier-client/__tests__`
- `pnpm typecheck` ; `pnpm exec eslint <tes fichiers>` ; `pnpm exec prettier --check <tes fichiers>`
- Si tu touches à l'affichage : `pnpm bundle:check` seulement si la routine en a le temps ; sinon dis-le dans la PR (la CI le fait).
- Ne lance PAS la suite complète ni le build Next (`next build`) : la CI le fait.

### Description de PR (gabarit)
Titre et corps en français : Quoi (3 lignes) · Ce qui EXISTAIT et a été réutilisé (chemins) · Fichiers créés / modifiés · Interdits respectés (cocher chaque ligne ci-dessus) · Tests ajoutés · Ce qui n'est PAS fait · Dépendances (« à fusionner après … ») · Niveau de relecture demandé.
