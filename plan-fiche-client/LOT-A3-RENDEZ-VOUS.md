# LOT A3 — RENDEZ-VOUS : type, objet en titre, compte rendu « à relire »

Branche : `feat/fiche-rendez-vous-type-objet` · Relecture : Opus allégée (1 tour) · Taille : ~0,5 j. · Part MAINTENANT.

## Objectif (maquette Rendez-vous)
Chaque rendez-vous de l'onglet Rendez-vous montre : son TYPE (Visio / Téléphone / Sur place, depuis `Rencontre.type`) avec icône ; un OBJET en titre (`Rencontre.objet`, sinon `titre`) ; le lieu (`Rencontre.lieu`) s'il existe ; la liste rangée « du prochain au plus ancien ». L'extrait du compte rendu n'apparaît QUE pour un compte rendu VALIDÉ ; sinon, pour un rendez-vous passé : pastille terracotta « Compte rendu à relire » et lien « Relire le compte rendu ». Cohérence : un compte rendu non relu n'est jamais dit « envoyé ». Teintes : prévu = bleu, a eu lieu = vert, à relire = terracotta.

## Ce qui EXISTE (ne pas refaire)
- `OngletEchanges` dans `src/components/admin/dossier-client/Onglets.tsx` (lignes ~395-477 : rendez-vous à venir / passés, badge « sans compte rendu validé », lien « Compte rendu → », `compteRenduValide.enBref`).
- `lireRencontresDuClient` dans `src/features/dossier-client/queries.ts` (sélectionne déjà `type`, pas `lieu` ni `objet`). Colonnes `lieu`, `objet` en base depuis #1659.
- `NouveauRendezVous` (formulaire « Enregistrer le rendez-vous ») : inchangé.
- Libellés : `src/features/dossier-client/libelles.ts` (`LIBELLE_STATUT_RENCONTRE`…) — lis-le ; s'il manque un libellé de TYPE, crée-le dans TON nouveau fichier `src/features/dossier-client/libelles-type-rendez-vous.ts` (ne modifie pas `libelles.ts`, la garde `les-libelles-de-role-ont-une-seule-source` le surveille).

## Fichiers à modifier (ce lot SEUL y touche)
- `src/features/dossier-client/queries.ts` : UNIQUEMENT la fonction `lireRencontresDuClient` et son type `RencontreDuDossier` (ajouter `lieu`, `objet`).
- `src/components/admin/dossier-client/Onglets.tsx` : UNIQUEMENT la fonction `OngletEchanges` ; si tu as besoin d'un import, ajoute-le À LA FIN du bloc d'imports (aucun autre lot n'importe dans ce fichier). Mieux : crée `src/components/admin/dossier-client/fiche/CarteRendezVous.tsx` (une carte par rendez-vous) et appelle-la depuis `OngletEchanges`.

## Fichiers à créer
- `src/components/admin/dossier-client/fiche/CarteRendezVous.tsx`, `src/features/dossier-client/libelles-type-rendez-vous.ts` (si besoin).
- Tests : `src/components/admin/dossier-client/__tests__/la-carte-rendez-vous-dit-type-objet-et-compte-rendu.spec.tsx` (objet en titre ; repli sur `titre` ; pas d'extrait si non validé ; « Compte rendu à relire » pour un passé non validé ; ordre du prochain au plus ancien ; heure en Europe/Paris) + garde de vocabulaire du lot (ni « Rencontre » ni « Échanges » affichés).

## Vérifications
`pnpm exec vitest run src/components/admin/dossier-client/__tests__ src/features/dossier-client/__tests__`, `pnpm typecheck`.

## Critère de fin
Les tests existants de l'onglet (`l-email-de-suivi-est-trace-sur-l-onglet-echanges.spec.tsx`, etc.) restent verts ; nouveaux tests verts.

## Texte de la PR
Titre : `feat(fiche-client): rendez-vous avec type, objet et compte rendu à relire (lot A3)`.

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
