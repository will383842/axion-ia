# Rapport — Lot OPCO A7b · écran « Branche et OPCO » et page Financement

Branche : `opco/a7b-ecran-branche-opco`, partie de `origin/opco/a7a-un-seul-opco` (PR #1282, pas encore fusionnée au départ).
Tête : `4d59e0a58bc95679cce983d522de757126574389`.
Manques traités (CRITIQUE.md, branche `relectures/opco-critique-finale`) : n°4 (champs absents du formulaire), n°7, n°9, n°10.

## Ce qui a été fait

### 1. Fiche client `qualiopi/clients/[id]` : bloc « Branche et OPCO »
- Nouveau bloc, **visible en haut de la fiche**, en tuiles : IDCC (+ convention), effectif (+ source « Saisi » / « INSEE » et date), OPCO (badge « suggéré » quand l'OPCO typé n'est pas posé), enveloppe annuelle, n° d'adhérent, versement volontaire, offre Mobilités (seulement si l'OPCO est Mobilités).
- « Modifier » sur place (formulaire replié) : **un seul sélecteur d'OPCO**, le champ typé `opco`, avec la suggestion existante (`suggererOpco`) et un bouton « Retenir ». Saisie de l'IDCC, de la taille, de l'effectif, de l'enveloppe **en euros** (« 3 000 », « 2 500,50 ») convertie en **centimes entiers**, du n° d'adhérent, de l'offre Mobilités et du versement volontaire (Non renseigné / Oui / Non).
- Réutilise `updateClientAction` (mêmes gardes `requireAdminWrite`, même journal `qualiopi.client.update`) : aucune nouvelle route, aucune nouvelle action client. L'effectif saisi pose `effectifSource = saisie` (comportement serveur existant).
- Lecture seule (`acces.peutEcrire` faux) → bloc affiché, badge « Lecture seule », aucun formulaire. Client particulier → pas de bloc.
- Place laissée à la PR #1283 : le composant accepte `complementEffectif` (ex. bouton « Rafraîchir depuis l'INSEE ») sous la tuile Effectif. Le bloc est inséré **avant** la section Identité, loin des lignes que #1283 modifie (case OPCO de l'identité, section « Déjà pris en charge »). La case OPCO de l'identité n'a pas été touchée.
- Liste `qualiopi/clients` : le second sélecteur (texte libre `opcoIdentifie`, « — (inféré) ») est **retiré**. Sans perte de fonction : l'option « — » du sélecteur unique envoie `opco: null` **et** `opcoIdentifie: null`, donc le serveur efface et ré-infère, exactement comme l'ancien « remettre en inféré ». La liste ne lit plus `.opcoIdentifie` : son exception dans `tests/unit/ci/un-seul-opco-par-client.spec.ts` est retirée (la liste fermée rétrécit).
- `clients/[id]/edit` : la phrase « la branche se modifie depuis la liste » renvoie maintenant au bloc de la fiche.

### 2. Manque n°10 — offre Mobilités, versement volontaire
- Migration **ajout seul** `20261004160000_opco_client_mobilites_versement_volontaire` : `clients.opco_adhesion_offre_mobilites BOOLEAN NULL`, `clients.opco_versement_volontaire BOOLEAN NULL`, `clients.opco_adhesions_renseignees_le DATE NULL` (date de dernière saisie, posée par le serveur, jour civil de Paris). `NULL` = non renseigné, jamais « non ».
- `regime-paiement-session.ts` lit enfin ces deux faits (ils étaient codés en dur) : Mobilités + adhésion → `subrogation_possible` ; versement volontaire → `remboursement_entreprise`.
- `updateClientAction` : `opcoEnveloppeAnnuelleCents` et `opcoNumeroAdherent` deviennent effaçables (`null`) ; enveloppe non entière refusée ; ces champs et les deux booléens sont refusés sur une fiche particulier (garde serveur, pas seulement masquage).

### 3. Page Financement de la session (`sessions/[id]/financement`)
- Encart de dépôt (`DepotOpcoPanel`) : bouton **« Ouvrir le dossier OPCO ↗ »** vers `OPCO_FICHES[opco].portailEntrepriseUrl` (nouvel onglet, `rel="noopener noreferrer"`) ; absent si le portail n'est pas relevé (aucun lien inventé). `encartDepot` expose `portailUrl`.
- **Saisie de la date de l'accord écrit** à côté du dépôt (`enregistrerAccordEcritAction`, habilitation `deposer_demande_financeur`, journal `facturation.dossier.accord_ecrit_saisi`, date future refusée). Selon le statut (`planAccordEcrit`, pur) : accord déjà acté → la date seule (verrou optimiste) ; demande envoyée → l'accord est acté avec sa date (`transitionnerDossier`, donc même reventilation) ; à monter **avec dépôt saisi** → envoi constaté puis accord ; sinon refus qui dit quoi faire.
- `BandeauEtatFonds` de l'OPCO du client en tête de la section Dépôt (la ligne « État des fonds » de l'encart est retirée pour ne pas doubler).
- **Estimation au barème** en lecture seule (`EstimationBaremeOpco`) : réutilise `estimateOpcoCoverage`, barème résolu à la **date de début** de la session, enveloppe de la fiche, OPCO lu par la règle unique ; mention « Estimation indicative » et avertissement de l'estimation repris tel quel.
- Lecture seule → lien visible, ni dépôt ni accord saisissables.

## Fichiers
Nouveaux : `src/components/admin/qualiopi/BrancheOpcoBloc.tsx`, `EstimationBaremeOpco.tsx`, `src/server/qualiopi/financements/branche-opco-saisie.ts`, `accord-ecrit.ts`, `estimation-opco-session.ts`, migration `20261004160000_…`.
Modifiés : `ClientBrancheForm.tsx`, `DepotOpcoPanel.tsx`, `clients/page.tsx`, `clients/[id]/page.tsx` (+5 lignes), `clients/[id]/edit/page.tsx`, `sessions/[id]/financement/page.tsx`, `actions/qualiopi/clients.ts`, `actions/qualiopi/facturation-hub.ts`, `financements/dossier-financement.ts`, `dossier-pret-a-deposer.ts`, `dossier-pret-a-deposer-lecture.ts`, `regime-paiement-session.ts`, `prisma/schema.prisma`, `tests/unit/ci/un-seul-opco-par-client.spec.ts`.
Tests : `branche-opco-saisie.spec.ts`, `client-branche-effectif-opco.spec.tsx` (réécrit : un seul sélecteur), `branche-opco-bloc.spec.tsx`, `le-bloc-branche-et-opco.spec.tsx` (vraie page, vraie garde), `clients-branche-opco.spec.ts`, `regime-mobilites-versement-volontaire.spec.ts`, `depot-opco-geste-suivant.spec.ts` / `.spec.tsx`, `facturation-hub-accord-ecrit.spec.ts`.

## ROUGE / VERT
- ROUGE (commit `88c24160`) : 12 tests en échec + 4 fichiers sans module (deux sélecteurs d'OPCO comptés, « Retenir » absent, enveloppe absente, `opco` non envoyé, régime Mobilités toujours `inconnu`, versement ignoré, enveloppe/adhérent non effaçables…).
- VERT : `pnpm vitest run src/server/qualiopi/ src/server/actions/qualiopi/ tests/unit/ci/ src/components/admin/qualiopi/__tests__/ src/lib/admin-nav.test.ts` (+ `clients/` de la page) → **627 fichiers, 8 991 réussis, 1 todo, 0 échec**. `pnpm qualiopi:isolation-check` → OK, 0 violation. `pnpm typecheck` → 0 erreur. ESLint et Prettier passés à la main sur tous les fichiers touchés. Jamais `next build`.

Témoins demandés, tous couverts : un seul sélecteur d'OPCO sur la fiche (rendu de la vraie page) ; effectif saisi → `effectifSource = saisie` ; enveloppe en euros → centimes entiers ; lien du portail = celui de `OPCO_FICHES` (les 11 OPCO) ; lecture seule → bloc sans formulaire ; particulier → pas de bloc.

## Limites
- **Poids du bundle admin non mesuré** (pas de `next build`). Ajouts côté client : quelques champs dans `ClientBrancheForm`, la saisie de l'accord dans `DepotOpcoPanel`, un petit module pur (~150 lignes). Estimation < 2 kB gz ; le cliquet `size-limit` (console admin 487 KB) **n'a pas été relevé** : la CI de la PR le dira.
- Conflit probable mais petit avec #1283 sur `clients/[id]/page.tsx` (imports seulement, hunks éloignés) et sur `actions/qualiopi/clients.ts` (zones différentes du fichier). Après fusion, l'effectif apparaîtra deux fois (case Identité de #1283 + tuile du bloc) : déplacer le bouton INSEE dans `complementEffectif` et retirer la case Identité est recommandé.
- Accord saisi sur un dossier « à monter » avec dépôt : `envoyeAt` est posé à l'heure de la saisie, pas à la date du dépôt.
- Sans dossier OPCO ouvert, l'encart dit toujours de passer par le Hub facturation (création du dossier depuis la session hors périmètre de ce lot).
- Le formulaire de création (`ClientForm`) ne propose toujours ni OPCO ni effectif (hors périmètre).
- E2E Playwright non lancés en local ; le parcours 05 utilise `#opco-<id>` et `#taille-<id>`, identifiants conservés.

## Corps de PR proposé

**Titre :** feat(opco): bloc « Branche et OPCO » sur la fiche client, un seul sélecteur d'OPCO, page Financement qui mène au geste suivant (chantier OPCO A7b)

> Base : `opco/a7a-un-seul-opco` (#1282) — à rebaser sur `main` une fois #1282 fusionnée.

### Pourquoi
Critique de complétude, manques n°4, 7, 9, 10 : l'IDCC, l'OPCO et l'effectif ne se saisissaient que dans la liste, avec deux sélecteurs d'OPCO ; l'enveloppe et le n° d'adhérent n'avaient aucun champ ; la page Financement ne menait ni au portail, ni à la saisie de l'accord ; le régime ne pouvait jamais trancher pour OPCO Mobilités ni voir un versement volontaire.

### Ce qui change
- Fiche client : bloc « Branche et OPCO » (lecture en tuiles + « Modifier » sur place), **un seul** sélecteur d'OPCO (le typé), suggestion « Retenir », enveloppe saisie en euros → centimes entiers, n° d'adhérent, offre Mobilités, versement volontaire. Lecture seule pour qui ne peut pas écrire ; rien pour un particulier.
- Liste des clients : second sélecteur retiré ; « — » remet toujours l'OPCO en inféré.
- Migration ajout seul : deux booléens nullables + date de saisie ; le régime de paiement les lit.
- Page Financement : « Ouvrir le dossier OPCO » (portail de `OPCO_FICHES`, nouvel onglet), date de l'accord écrit à côté du dépôt, `BandeauEtatFonds`, estimation au barème en lecture seule.
- Aucune nouvelle route publique ; mêmes gardes et journaux.

### Tests
ROUGE puis VERT ; 627 fichiers / 8 991 tests verts sur les suites qualiopi + CI ; isolation-check OK ; typecheck OK.

### À surveiller
Poids du bundle admin non mesuré localement (cliquet non relevé). Petit conflit attendu avec #1283 sur la fiche client.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01VJZ36DBAooVmzCWhoHxAeq
