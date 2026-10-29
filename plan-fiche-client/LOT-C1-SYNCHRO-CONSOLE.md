# LOT C1 — SYNCHRO console → CRM Pro : envoyer les nouvelles clés facultatives (étape, santé, prochaine action, tâches, nombres, rôles)

Branche : `feat/crm-sync-dossier-cles-fiche-complete` · Relecture : OPUS OBLIGATOIRE + AUDITEUR SÉCURITÉ/SYNCHRO · Taille : ~1,5 j.

## Prérequis STRICTS (vérifie chacun ; un seul manque : ARRÊTE, n'ouvre pas de PR, écris pourquoi)
1. CRM : PR will383842/axion-crm-pro#379 FUSIONNÉE (`gh pr view 379 -R will383842/axion-crm-pro --json state`) ET déployée en production du CRM, avec un essai de la route `POST /api/internal/site-sync` réussi sur un dossier d'essai (la session pilote l'écrit dans la PR #379 ; cherche ce commentaire). Sinon une clé nouvelle = 422 = ligne `gave_up` = synchro arrêtée EN SILENCE.
2. Console : lots B1 (`src/features/dossier-client/fiche/sante-du-compte.ts`), B3 (tâches), B6 (archivage, `client_profils.archive_le`) et B8 (clôture prévue) FUSIONNÉS.
3. Prod console sert #1732 (`curl -sI https://axion-ia.com/fr | grep -i x-axion-build-sha` ; `git merge-base --is-ancestor e26a587c4 <sha>`). Ce lot touche du code LU PAR LE WORKER (balayage de synchro), qui atterrit ~50 min AVANT l'app : lis la section « DEUX conteneurs » de `axionia/AGENTS.md`.

## Objectif
Le dossier envoyé au CRM (`dossier_client_synchro`) porte en plus, seulement quand la valeur existe (une valeur vide est OMISE, jamais `null`) :
- `etape` : prospect | devis_envoye | client | archive (archive si `client_profils.archive_le` non nul, sinon d'après `clients.statut`) ;
- `cloture_prevue` (AAAA-MM-JJ, la plus proche des prestations en cours) ;
- `sante` : bonne | a_surveiller (via `santeDuCompte` du lot B1 ; `a_risque` n'est pas produit en V1) ;
- `prochaine_action` : `{ type, date }` de la plus proche tâche ouverte ; type = relance si `origine` vaut relance, sinon autre (JAMAIS l'intitulé) ;
- `taches_ouvertes` : `{ nb, prochaine_le }` ;
- `nb_emails_console`, `nb_notes_console` : des NOMBRES seulement ;
- `questionnaire.attendus`, `questionnaire.date_limite` (en plus des 3 clés existantes) ;
- par contact : `role_decision` (decideur, financeur, referent, utilisateur ; prescripteur et autre donnent autre ; influenceur et bloqueur seulement si le lot C3 est fusionné).

## Ce qui EXISTE (ne pas refaire)
`src/server/crm-sync/instantane-dossier.ts` (photo PURE en LISTE BLANCHE : `CLES_DOSSIER_CRM`, `CLES_CONTACT_CRM`, `CLES_QUESTIONNAIRE_CRM`, miroir de `backend/app/Crm/Ingest/DossierClient.php`), `lire-dossier.ts` (lecture), `dossier-client.ts` (empreinte, version, outbox dans la même transaction, drapeau `CRM_SYNC_DOSSIER_ENABLED`), `retour-dossier.ts` (sens CRM → console, `naf_code` seul : NE PAS l'élargir). Le contrat CRM côté #379 : clés facultatives listées ci-dessus, `CLES_INTERDITES` inchangée.

## Fichiers (ce lot SEUL y touche)
- À modifier : `src/server/crm-sync/instantane-dossier.ts` (listes blanches + construction), `src/server/crm-sync/lire-dossier.ts` (lectures en `count`/`findFirst`, chacune protégée : une panne OMET la clé, n'arrête pas l'envoi), le test qui fige la liste blanche (cherche-le dans `src/server/crm-sync/__tests__/`).
- À créer : `src/server/crm-sync/__tests__/dossier-cles-fiche-complete.spec.ts`.

## Interdits propres
Aucun montant (ni pipeline, ni chances de signer, ni montant pondéré), aucun texte de tâche, aucun texte de note, aucune étiquette, aucun responsable, aucune réponse : un test les cherche dans le message et échoue s'il les trouve. Un contact parti n'est jamais envoyé (règle existante). Ne touche à AUCUN drapeau (`CRM_SYNC_DOSSIER_CLIENT_STAGE` reste fermé côté CRM : son ouverture est une action de Will après essai sur une fiche de TEST). Pas de clé `url_console`.

## Tests
Chaque clé omise quand vide ; liste blanche figée ; aucune clé interdite (`montant`, `notes`, `texte`, `prix`, `reponse`…) même imbriquée ; `prochaine_action` sans intitulé ; archive prioritaire sur le statut ; une lecture en panne omet sa clé et l'envoi part quand même ; même contenu = même empreinte (pas de nouvelle version).

## Texte de la PR
Titre : `feat(crm-sync): le dossier envoyé au CRM porte étape, santé, prochaine action et nombres (lot C1)`. Corps : prérequis vérifiés (avec les sorties), « fusionner seulement hors des 50 minutes qui suivent un déploiement », rappel « aucun montant ».

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
