# LOT B8 — PRESTATIONS : chances de signer, clôture prévue, montant pondéré, frise des 4 étapes

Branche : `feat/fiche-prestations-pipeline` · Relecture : OPUS OBLIGATOIRE (montants) · Taille : ~1 j.
Dépend de : PR #1694 FUSIONNÉE (fichiers `SuiviPrestations.tsx`, `prestations.ts`, `suivi-prestations.ts`, `actions-prestations.ts`) et lot 0 FUSIONNÉ (`fiche/ResumePrestations.tsx`). Fusion seulement quand la prod sert #1732 (colonnes `probabilite_pct`, `cloture_prevue_le` : `x-axion-build-sha` ancêtre de `e26a587c4`).

## Objectif (maquettes Prestations et Résumé « 2. Où on en est »)
1. Dans l'onglet Prestations, pour chaque prestation : frise des 4 étapes « Besoin · Devis envoyé · Accepté · Terminée » (composant `Frise`), « En pause » / « Perdue » en pastille grise hors parcours + petite légende ; montant « 4 500 € HT » + TTC ; « Chances de signer : 60 % » ; « Clôture prévue le 15 déc. » ; « Montant pondéré : 2 700 € HT » ; champs modifiables dans le formulaire EXISTANT de la prestation : chances (0 à 100, ou vide = non estimées) et date de clôture prévue.
2. Emplacement Résumé (`ResumePrestations`) : carte compacte « Prestations » : une ligne par prestation en cours (type, frise, montant HT, chances, clôture), lien « Voir les prestations ».

## Ce qui EXISTE (ne pas refaire, apporté par #1694)
`ETAPES_PRESTATION`, `LIBELLE_ETAPE_PRESTATION`, `etapeCalculee`, `etapeAffichee`, `eurosEnCentimes`, `centimesEnEuros` (`src/features/dossier-client/prestations.ts`) ; `lireSuivisDesProjets`, `assemblerPrestations` (`suivi-prestations.ts`) ; action d'enregistrement (`actions-prestations.ts`) ; rendu `SuiviPrestations.tsx`. Table `projet_suivis` (`rgpd: technique`, aucun branchement RGPD nécessaire). `Frise`, `htEtTtc` (lot 0).

## Fichiers (ce lot SEUL y touche)
- À modifier : `src/components/admin/dossier-client/SuiviPrestations.tsx`, `src/features/dossier-client/actions-prestations.ts` (accepter `probabilitePct` entier 0-100 ou vide, `cloturePrevueLe` date AAAA-MM-JJ ou vide ; écrire comme l'existant), `src/features/dossier-client/suivi-prestations.ts` (lire les 2 colonnes), `src/components/admin/dossier-client/fiche/ResumePrestations.tsx`.
- À créer : `src/features/dossier-client/fiche/pondere.ts` (PUR : montant pondéré, arrondi au centime), `src/components/admin/dossier-client/fiche/CartePrestationsResume.tsx`.

## Interdits propres
Montant et chances restent DANS la console (jamais vers le CRM ; le lot C1 n'enverra que l'étape et la date de clôture). La frise affiche l'étape forcée existante, elle ne la remplace pas.

## Tests
Bornes (101 refusé, -1 refusé, vide = NULL), date invalide refusée, pondéré (4 500 × 60 % = 2 700), En pause hors frise, rendu HT + TTC, « Chances de signer » (jamais « Probabilité »), tests de #1694 toujours verts, garde de vocabulaire.

## Texte de la PR
Titre : `feat(fiche-client): chances de signer, clôture prévue et frise des étapes (lot B8)`.

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
