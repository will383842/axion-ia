# LOT B2 — ACTIVITÉ (chronologie unique avec filtres) + onglet E-mails en clair

Branche : `feat/fiche-activite-chronologie` · Relecture : OPUS 1 tour (affiche des notes déchiffrées) · Taille : ~1,5 j.
Dépend de : lot 0 FUSIONNÉ (`fiche/OngletActivite.tsx` présent sur `origin/main`). Lecture seule : part dès le lot 0 fusionné.

## Objectif (maquettes Activité et E-mails)
1. Nouvel onglet « Activité » : UNE chronologie, la plus récente en haut, REGROUPÉE PAR JOUR (« 29 oct. »), filtres par lien `?onglet=activite&filtre=` : Tout · Rendez-vous · E-mails · Notes · Tâches · Argent. Icône + couleur + mot par type : rendez-vous bleu (prévu) / vert (a eu lieu) ; e-mail parti vert, à valider terracotta ; note gris ; tâche ouverte terracotta (« À faire · avant le … », « En retard »), faite vert ; argent ambre (« Devis envoyé n° … 4 500 € HT », « Facture envoyée », « Paiement reçu : 720 € TTC »). Les notes épinglées sont en tête du filtre « Notes ». Une source en panne : bandeau « Une partie de l'activité n'a pas pu être lue » (comme `sourcesEnPanne`).
2. `ONGLET_ACTIVITE_PRET = true` à la fin.
3. Onglet « E-mails » : deux tuiles « Envoyés » (vert) et « À valider » (terracotta) ; chaque ligne : objet, NOM du destinataire si connu (jamais l'adresse), date, état, lien « Voir la copie ». Jamais le corps.

## Ce qui EXISTE (ne pas refaire)
- `lireFilDesEchanges(clientId, adminPrefix)` (`src/features/dossier-client/fil-des-echanges.ts`) : rendez-vous + e-mails partis + e-mails à valider + courriers du questionnaire, avec `assemblerFil`, `sourcesEnPanne`, liens vers la copie. RÉUTILISE-LE tel quel (ne le modifie pas) et AJOUTE les sources manquantes dans un module neuf.
- `FilDesEchanges` (`src/components/admin/dossier-client/FilDesEchanges.tsx`) : rendu actuel de l'onglet E-mails (ce lot en est le seul modificateur).
- Factures et devis : `getClient360` (devis, `facturesFormation` avec `emiseAt`, statut, encaissements via `resteDuNetCents`). Montants : `htEtTtc`.
- Tâches et notes : tables `client_taches`, `client_notes` (écrites par B3 et B4 ; ce lot ne fait que LIRE ; une note se déchiffre par `dechiffrerParoleOuNull` de `src/lib/chiffrer-parole.ts`, jamais journalisée).
- Conservation des e-mails : la copie n'est plus purgée (`src/server/queue/workers/__tests__/la-copie-des-e-mails-n-est-plus-purgee.spec.ts`) ; la décision de Will « e-mails d'une fiche gardés 5 ans » est donc déjà tenue : NE TOUCHE PAS au worker de purge.

## Fichiers (ce lot SEUL y touche)
- À modifier : `src/components/admin/dossier-client/fiche/OngletActivite.tsx`, `src/components/admin/dossier-client/FilDesEchanges.tsx`.
- À créer : `src/features/dossier-client/fiche/chronologie.ts` (PUR : types d'entrée, `assemblerChronologie`, `filtrer`, `grouperParJour` en Europe/Paris), `src/features/dossier-client/fiche/lire-chronologie.ts` (lit le fil existant + tâches + notes + argent ; chaque source protégée), `src/components/admin/dossier-client/fiche/Chronologie.tsx`, `src/components/admin/dossier-client/fiche/FiltresActivite.tsx` (liens, pas de JS), `src/components/admin/dossier-client/fiche/TuilesEmails.tsx`.

## Interdits propres
Jamais d'adresse e-mail ni de corps d'e-mail à l'écran ; un texte de note n'apparaît que pour `ctx.voitEchanges` (déjà garanti par la page) ; aucune écriture.

## Tests à écrire
`chronologie.spec.ts` (tri, regroupement par jour à minuit Paris, chaque filtre, notes épinglées en tête, panne d'une source), rendu `Chronologie` (icône `aria-hidden` + mot pour chaque type ; « Paiement reçu » en TTC, devis en HT + TTC), rendu E-mails (aucune adresse, aucun corps, tuiles justes), garde de vocabulaire (« Activité » oui, « Échanges » non).

## Critère de fin
Onglet visible et filtré ; tests existants `le-fil-des-echanges-reunit-rendez-vous-e-mails-et-courriers.spec.tsx` toujours verts.

## Texte de la PR
Titre : `feat(fiche-client): onglet Activité, chronologie unique filtrée, e-mails en clair (lot B2)`.

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
