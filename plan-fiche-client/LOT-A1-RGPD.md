# LOT A1 — RGPD : export art. 15 et effacement art. 17 des tables tâches, notes, profil, étiquettes

Branche : `feat/fiche-rgpd-taches-notes-profil-etiquettes` · Relecture : OPUS OBLIGATOIRE + auditeur RGPD (données personnelles) · Taille : ~0,5 j. · Part MAINTENANT.

## Objectif
La migration #1732 (`prisma/migrations/20261029120000_fiche_client_taches_notes_profil_etiquettes`) a créé `client_taches`, `client_notes` (contenu CHIFFRÉ), `client_profils`, `client_etiquettes` SANS écrivain. Elles sont déclarées en « exclusion sans écrivain » dans l'export et l'effacement. Les lots B3 (tâches), B4 (notes), B6 (profil, étiquettes) vont les écrire. CE lot branche, AVANT eux et en UNE seule PR, l'export art. 15 et l'effacement art. 17 réels, pour qu'aucun lot écrivain n'ait à toucher ces fichiers partagés.

## Ce qui EXISTE (ne pas refaire)
- Modèles `ClientTache`, `ClientNote`, `ClientProfil`, `ClientEtiquette` dans `prisma/schema.prisma` (annotés `rgpd: dossier-client`).
- Export : `src/lib/rgpd-dossier-client.ts` (`exporterDossierClientPour(email)`, déchiffrement par `dechiffrerParole` / `dechiffrerParoleOuNull` de `src/lib/chiffrer-parole.ts`), route `src/app/api/gdpr-export/route.ts`. Les 4 tables y sont dans la liste d'exclusions (entrées `modele: "ClientTache"` … « fonction pas encore en service »).
- Effacement : `src/lib/rgpd-erase.ts` (entrées d'exclusion « table encore sans écrivain », vers la ligne 1800).
- Garde : `tests/unit/ci/les-tables-du-dossier-client-suivent-la-personne.spec.ts` (test « une exception "sans écrivain" n'a pas d'écrivain » qui attend ces 4 modèles dans les exclusions, et rougit si du code écrit dedans).
- Chiffrement des paroles : `chiffrerParole` (seul module autorisé, garde `tests/unit/ci/le-circuit-ne-chiffre-qu-avec-chiffrer-parole.spec.ts`).

## Règle de fond (Will)
AUCUNE donnée client supprimée : une demande d'effacement d'une PERSONNE met la personne à l'écart, et on n'efface que ce qui la concerne en propre. Ici : ces tables appartiennent à la FICHE d'une entreprise, pas à une personne. Lis comment `rgpd-erase.ts` traite déjà `Fait`, `Projet.titre`, `ClientContact` pour une personne citée, et applique LA MÊME règle :
- `ClientTache` : une tâche liée à la personne (`contactId` = un contact de la personne effacée) : `contactId` mis à NULL et `intitule` remplacé par un texte neutre (« Tâche d'une personne effacée ») ; la tâche (date, état) reste. `responsableLabel` est un libellé interne (« Will »), on n'y touche pas.
- `ClientNote` : une note n'est pas rattachée à une personne (pas de colonne) : angle mort DÉCLARÉ comme pour `Projet.titre` (Will la corrige à la main) ; export : les notes de la fiche dont la personne est un contact, DÉCHIFFRÉES, sont rendues dans l'export de cette personne SEULEMENT si c'est déjà la règle pour les faits de fiche ; sinon motif d'exclusion explicite et lisible (« notes internes de la fiche d'entreprise : réponse manuelle sous un mois »). Choisis la règle EXISTANTE la plus proche et écris-la dans le commentaire.
- `ClientProfil`, `ClientEtiquette` : données de l'entreprise (responsable interne, archivage, étiquettes) : déclarer `rgpd: technique — …` N'EST PAS permis (le schéma est interdit à ce lot) ; garder une exclusion DÉCLARÉE dont le motif ne dit plus « sans écrivain » mais la vraie raison (« donnée de la fiche d'entreprise, aucune donnée de la personne »).
- Les mutations utilisent `updateMany` (jamais `delete`/`deleteMany`).

## Fichiers à modifier (ce lot SEUL y touche)
- `src/lib/rgpd-erase.ts` : remplacer les 4 exclusions « sans écrivain » par l'effacement réel (`ClientTache`) ou des exclusions motivées (`ClientNote`, `ClientProfil`, `ClientEtiquette`).
- `src/lib/rgpd-dossier-client.ts` : remplacer les 4 exclusions « pas encore en service » par la lecture réelle (`ClientTache` liées aux contacts de la personne ; `ClientNote` selon la règle choisie) ou un motif lisible.
- `tests/unit/ci/les-tables-du-dossier-client-suivent-la-personne.spec.ts` : le test « une exception sans écrivain n'a pas d'écrivain » ne doit plus attendre ces 4 modèles (retire-les de `arrayContaining` ; si la liste devient vide, garde le test sur une liste vide et laisse la regex des écrivains en place pour les futures tables).

## Fichiers à créer
- `src/lib/__tests__/rgpd-taches-notes-fiche.spec.ts` (ou à côté des tests existants de `rgpd-erase`, même style, prisma simulé) : (1) l'effacement d'une personne neutralise l'intitulé et le `contactId` de SES tâches, pas celles d'une autre personne ni d'une autre fiche ; (2) aucune ligne n'est supprimée ; (3) l'export d'une personne contient ses tâches (intitulé, date, faite ou non) et rien d'une autre fiche ; (4) une note n'apparaît jamais en clair dans un journal.

## Interdits propres
Pas d'écrivain métier (aucun `create`/`upsert` hors effacement). Pas de migration. Ne touche à aucun autre modèle.

## Vérifications
`pnpm exec vitest run tests/unit/ci/les-tables-du-dossier-client-suivent-la-personne.spec.ts src/lib` puis `pnpm typecheck`.

## Critère de fin
Garde ADR 0053/0056 verte ; plus aucune entrée « sans écrivain » pour ces 4 modèles ; tests du lot verts.

## Texte de la PR
Titre : `feat(rgpd): export et effacement des tâches, notes, profil et étiquettes de fiche (lot A1)`. Corps : « à fusionner AVANT les lots B3, B4, B6 » ; règle choisie pour les notes, citée.

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
