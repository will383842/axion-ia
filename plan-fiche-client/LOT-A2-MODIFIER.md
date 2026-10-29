# LOT A2 — MODIFIER : formulaire de la fiche complet (champs qui existent déjà en base)

Branche : `feat/fiche-modifier-complet` · Relecture : OPUS 1 tour (écrit sur `clients` et sur les réglages de facturation) · Taille : ~1 j. · Part MAINTENANT (aucun contact avec la page fiche).

## Objectif
Écran « Modifier la fiche » (route `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/clients/[id]/edit/page.tsx`) conforme à la maquette : Entreprise (nom, SIREN, SIRET, numéro de TVA, code NAF, secteur, nombre de salariés, secteur public) ; Adresse en 3 champs (numéro et rue, code postal, ville) ; « Comment ce client est arrivé » ; Contact principal (nom et prénom, fonction, e-mail, téléphone) ; Facturation (délai de paiement, acompte en %, mode de facturation « Acompte puis solde » / « Solde unique »). Mise en page en cartes `AdminBloc` (gris = neutre), un seul bouton « Enregistrer ».
NE FAIT PAS : responsable du client, étiquettes, archivage (lot B6, qui ajoute SON bloc sous ce formulaire par un emplacement dans `edit/page.tsx`, voir plus bas). Pas de case « ce client ne paie pas » (décision de Will : retirée).

## Ce qui EXISTE (ne pas refaire)
- Formulaire `src/components/admin/qualiopi/ClientEditForm.tsx` (« use client », envoi DIFFÉRENTIEL : n'envoie que ce qui a changé ; à garder absolument, voir son commentaire sur la ré-inférence OPCO).
- Action `updateClientAction` + `updateClientSchema` dans `src/server/actions/qualiopi/clients.ts` (accepte déjà : raisonSociale, siret, siren, nafCode, secteur, taille, adresse, contact*, statut, source, effectif, penalitesRetardActives…).
- Colonnes `clients` déjà en base : `tva_intracom`, `secteur`, `source`, `adresse_rue`, `adresse_code_postal`, `adresse_ville`, `est_public`, `delai_paiement_jours`, `taux_acompte_pct`, `mode_facturation` (enum `ModeFacturationClient` : `acompte_solde`, `solde_unique`).
- L'effectif, l'IDCC, la taille et l'OPCO sont écrits par `ClientBrancheForm` / `BrancheOpcoBloc` (bloc « Branche et OPCO » de la fiche) : NE PAS créer un 2e écrivain. Dans Modifier, « Nombre de salariés » s'affiche en LECTURE avec le lien « Modifier dans Branche et OPCO » (vers la fiche, onglet Résumé).
- Garde des écrivains de `clients` : `tests/unit/ci/cliquet-ecrivains-client.spec.ts` (tu ne crées AUCUN nouvel écrivain : tout passe par `updateClientAction`).

## Fichiers à modifier (ce lot SEUL y touche)
- `src/server/actions/qualiopi/clients.ts` : ajouter à `updateClientSchema` SEULEMENT : `tvaIntracom` (max 40, nullable), `adresseRue` (max 300, nullable), `adresseCodePostal` (max 12, nullable), `adresseVille` (max 120, nullable), `delaiPaiementJours` (entier 0 à 120, nullable), `tauxAcomptePct` (entier 0 à 100, nullable ; Will : acompte de 0 à 100 % toujours possible), `modeFacturation` (`acompte_solde` | `solde_unique`, nullable). `estPublic` : AVANT de l'ajouter, `git grep -n estPublic src/server` ; s'il change la facturation (Chorus, mentions), NE l'ajoute PAS et affiche-le en lecture seule avec la mention « se change avec Will » (écris ton choix dans la PR). Garde `refuserChampsEntreprisePourParticulier` à jour si ces champs sont « entreprise ».
- `src/components/admin/qualiopi/ClientEditForm.tsx` : nouveaux champs, envoi différentiel conservé, libellés de la maquette, cartes, aide en clair sous les champs (pas en `title`).
- `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/clients/[id]/edit/page.tsx` : passer les nouvelles valeurs initiales (`getClient` doit les sélectionner : si `getClient` dans `src/server/qualiopi/crm/clients.ts` ne les rend pas, ajoute-les à SON `select` uniquement) ; et poser, sous le formulaire, la ligne `{/* EMPLACEMENT:MODIFIER-PROFIL (lot B6) */}` suivie de `{await profilDeLaFiche(id)}` importé de `src/components/admin/dossier-client/fiche/ProfilDeLaFiche.tsx` que TU crées avec `export async function profilDeLaFiche(clientId: string): Promise<React.ReactElement | null> { return null; }` et le commentaire « Emplacement du lot B6 ».

## Fichiers à créer
- `src/components/admin/dossier-client/fiche/ProfilDeLaFiche.tsx` (ci-dessus, vide).
- `src/server/actions/qualiopi/__tests__/modifier-la-fiche-champs-complets.spec.ts` : chaque nouveau champ passe le schéma ; bornes (acompte 101 refusé, délai négatif refusé) ; un envoi sans `nafCode`/`idcc` ne relance pas l'inférence OPCO ; un particulier ne peut pas recevoir `tvaIntracom`.
- Test de rendu du formulaire (les nouveaux libellés présents ; aucun mot interdit) + garde de vocabulaire du lot.

## Vérifications
`pnpm exec vitest run src/server/actions/qualiopi src/components/admin/qualiopi` (ciblé sur tes tests et ceux de `clients.ts`), `pnpm typecheck`, `pnpm bundle:check` (le formulaire est client : il ne doit pas grossir de plus de 2 Ko gz).

## Critère de fin
Tous les champs de la maquette Modifier sont présents (sauf responsable/étiquettes/archivage, lot B6) ; aucun nouvel écrivain de `clients` ; montants : aucun.

## Texte de la PR
Titre : `feat(fiche-client): formulaire Modifier complet, adresse en 3 champs, facturation (lot A2)`.

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
