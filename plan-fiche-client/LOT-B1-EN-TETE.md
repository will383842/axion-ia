# LOT B1 — EN-TÊTE : carte « Prochaine action », 4 tuiles, frise du parcours, compteurs d'onglets

Branche : `feat/fiche-en-tete-prochaine-action` · Relecture : OPUS OBLIGATOIRE (montants affichés, santé du compte) · Taille : ~1,5 j.
Dépend de : lot 0 FUSIONNÉ (vérifie `src/components/admin/dossier-client/fiche/EnTeteFiche.tsx` sur `origin/main`, sinon ARRÊTE). N'écrit dans aucune table : peut partir dès le lot 0 fusionné.

## Objectif (maquette Résumé, en-tête commun à tous les onglets)
1. Frise du parcours « Prospect → Devis envoyé → Client actif » depuis `client.statut` (`client_inactif` et `perdu` : pastille grise hors parcours). Utilise `Frise` (`fiche/Frise.tsx`).
2. Carte « Prochaine action » (`AdminBloc` terracotta, titre h2 « Prochaine action ») : la plus proche tâche OUVERTE (`client_taches`, `faite_le IS NULL`, tri `echeance_le`) : intitulé · « avant le 30 oct. » · « responsable Will ». S'il existe au moins un e-mail « à valider » de la fiche (`EmailOutbox`, `statut = a_valider`, `clientId`), l'UNIQUE bouton plein de l'écran est « Relire et valider » (lien vers `${qBase}/emails`) ; sinon le bouton plein mène à la tâche (`?onglet=activite&filtre=taches` si `ONGLET_ACTIVITE_PRET`, sinon `?onglet=resume`). Lien texte « Voir toutes les tâches ». Aucune tâche et aucun e-mail : état vide vert « Rien à faire pour ce client aujourd'hui. ».
3. Bandeau de 4 tuiles (`AdminStatCard`, qui existe : `label`, `value`, `meta`, `tone`, `icon`, `href`) :
   - « Pipeline » (bleu) : somme des montants HT des prestations NON terminées et non perdues (`projet_suivis.montant_cents`), `meta` = TTC + « X % de chances de signer » (moyenne pondérée par montant de `probabilite_pct` ; « chances non estimées » si toutes NULL). Montant via `htEtTtc` (`fiche/montants.ts`).
   - « Santé du compte » : règle de Will, écrite en clair dans `meta` : « Bonne : un échange il y a moins de 14 jours, aucun paiement en retard, aucune tâche en retard. » ; sinon « À surveiller » (ambre) avec la raison (« aucun échange depuis 21 jours », « 1 facture en retard », « 2 tâches en retard »). Échange = dernier rendez-vous tenu OU dernier e-mail PARTI (`statutEmail === "sent"`) du fil.
   - « Reste à encaisser » (ambre) : `calculerEncoursDuCents(client.facturesFormation)` (EXISTE, `src/server/qualiopi/crm/clients.ts`) en TTC + « à payer avant le … » (plus proche échéance d'une facture ouverte). 0 : tuile verte « Rien à encaisser ».
   - « Questionnaire » (bleu ; vert si complet) : « 2 sur 5 » + « à rendre avant le … » depuis `lireQuestionnairesDeLaFiche` (EXISTE). Aucun questionnaire : tuile grise « Pas envoyé ».
   Grille `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.
4. Compteurs d'onglets (`compteurs-onglets.ts`) : Activité = nombre de tâches ouvertes ; Rendez-vous = nombre de rendez-vous ; Prestations = nombre de prestations ; Personnes = personnes actives ; Devis et factures = devis + factures. Une lecture en panne = pas de compteur (jamais 0).
5. Quand tout est en place : `EN_TETE_REMPLACE_LE_BANDEAU = true` (l'ancien `BandeauOuEnEst` disparaît ; ses informations sont reprises par les tuiles). Ne supprime PAS `BandeauOuEnEst.tsx` ni `bandeau-ou-en-est.ts` (réutilise `construireBandeau` si utile).

## Ce qui EXISTE (ne pas refaire)
`AdminBloc`, `AdminStatCard`, `Frise`, `htEtTtc`, `lireRencontresDuClient`, `lireQuestionnairesDeLaFiche`, `lireFilDesEchanges` (`src/features/dossier-client/fil-des-echanges.ts`), `lireProjetsDuClient`, `lireSuivisDesProjets` (`src/features/dossier-client/suivi-prestations.ts`, de #1694), `calculerEncoursDuCents`, `resteDuNetCents`, `getClient360`, `TEXTE_LECTURE_IMPOSSIBLE`.

## Fichiers (ce lot SEUL y touche)
- À modifier : `src/components/admin/dossier-client/fiche/EnTeteFiche.tsx`, `src/components/admin/dossier-client/fiche/compteurs-onglets.ts`.
- À créer : `src/features/dossier-client/fiche/sante-du-compte.ts` (PUR : `santeDuCompte({ maintenant, dernierEchangeLe, nbFacturesEnRetard, nbTachesEnRetard }) → { niveau: "bonne" | "a_surveiller", raisons: string[] }` ; « 14 jours » en constante exportée `SEUIL_ECHANGE_JOURS` ; RÉUTILISÉ par le lot C1 pour la synchro), `src/features/dossier-client/fiche/pipeline.ts` (PUR), `src/features/dossier-client/fiche/lire-en-tete.ts` (lectures, chacune protégée : panne = « Lecture impossible »), `src/components/admin/dossier-client/fiche/CarteProchaineAction.tsx`, `src/components/admin/dossier-client/fiche/TuilesFiche.tsx`.
- Lecture de `client_taches` : SEULEMENT `findFirst`/`count`/`findMany` (jamais d'écriture : la garde RGPD rougirait).

## Tests à écrire
`sante-du-compte.spec.ts` (13 j = bonne, 15 j = à surveiller, minuit Paris, facture en retard, tâche en retard, aucun échange), `pipeline.spec.ts` (terminée et perdue exclues, pondération, NULL), rendu de la carte (un seul bouton plein ; « Relire et valider » quand un e-mail attend), rendu des tuiles (HT + TTC, aucun « Probabilité »), panne de lecture = « Lecture impossible », garde de vocabulaire du lot.

## Critère de fin
Tests verts ; `pnpm typecheck` ; `pnpm bundle:check` (Server Components seulement : 0 Ko client ajouté).

## Texte de la PR
Titre : `feat(fiche-client): prochaine action, tuiles et frise du parcours en tête de fiche (lot B1)`.

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
