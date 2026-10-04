# Relecture A09 — Lot OPCO A7b · écran « Branche et OPCO » et page Financement

Diff relu : `origin/opco/a7a-un-seul-opco...origin/opco/a7b-ecran-branche-opco` (tête `4d59e0a5`, 30 fichiers).
Lentilles : **EXACTITUDE** et **SÉCURITÉ**. Aucun code de la PR modifié.

Tests lancés : `pnpm vitest run src/server/qualiopi/financements/ src/server/actions/qualiopi/ src/components/admin/qualiopi/__tests__/`
→ **146 fichiers, 1 938 tests, 0 échec** (après `pnpm install` + `prisma:generate` en stub).

## 1. Régime de paiement (`regime-paiement-session.ts`)
- Mobilités : `adhesionOffreMobilites: s.client?.opcoAdhesionOffreMobilites ?? null` → `true` donne `subrogation_possible` (`regime-paiement-opco.ts:128-133`), `null`/`false` restent `inconnu`. `NULL` ne devient jamais « non » : **conforme**.
- Versement volontaire : `=== true` → `remboursement_entreprise` (`regime-paiement-opco.ts:112`). **Conforme à la règle**, dont le type est `boolean`.
- Le `select` de `regimePaiementDeSession` lit bien les deux colonnes ; le seul autre appelant (`entreeRegimeDepuisSession`) tolère leur absence (`?:`).

## 2. Accord écrit (`enregistrerAccordEcritAction` / `planAccordEcrit` / `enregistrerAccordEcrit`)
- Habilitation `deposer_demande_financeur` (la même que `transitionnerDossierAction`), garde `stub.invalid`, zod UUID + `AAAA-MM-JJ`, aller-retour exact de la date (`jourSaisiVersDate`), **date future refusée** (`facturation-hub.ts:713`), journal `facturation.dossier.accord_ecrit_saisi`. ✅
- Transitions : tout passe par `transitionnerDossier`, qui revalide contre `DOSSIER_TRANSITIONS` et pose un verrou optimiste. `refuse` et `clos` → refus explicite ; `a_monter` sans `depotFaitLe` → refus (« jamais un accord sans dépôt »). Le chemin « date seule » garde un `updateMany` conditionné au statut lu. ✅
- « Envoyé puis accord » sur un dossier à monter avec dépôt saisi : **acceptable**. `envoyeAt = maintenant` est un horodatage de console ; le régime lit `depotFaitLe` et `accordEcritLe`, jamais `envoyeAt` → aucun effet sur l'argent. Les deux transitions ne sont pas atomiques : si la seconde échoue (concurrence), le dossier reste `envoye` avec un message d'erreur, état légal et rattrapable.

## 3. Saisie de la fiche client
- Un seul sélecteur d'OPCO (les 4 `<select>` de `ClientBrancheForm` = taille, OPCO, Mobilités, versement). « — » envoie `opco: null` + `opcoIdentifie: null` → le serveur efface et ré-infère. ✅ (cf. petit défaut a).
- `eurosVersCentimes` : calcul sur les chiffres, sans flottant ; « 2 500,50 » → 250050, espaces fines et « € » acceptés, négatif / 3 décimales / « 1.500,50 » → `invalide`, au-delà de `MAX_SAFE_INTEGER` → `invalide`. Côté serveur `int().min(0)`. ✅ (cf. petit défaut b).
- Particulier : les quatre nouveaux champs entrent dans `CHAMPS_ENTREPRISE` et dans `identifiantEntreprise` → refus **serveur**, pas seulement masquage ; `null` (effacement) reste permis, ce qui est sans risque. ✅
- Lecture seule : `BrancheOpcoBloc` ne monte `ClientBrancheForm` que si `peutEcrire` ; badge « Lecture seule » ; rien pour un particulier (`return null`). ✅

## 4. Lien portail
- `portailUrl` = `fiche.portailEntrepriseUrl.valeur` (`dossier-pret-a-deposer.ts`), `null` hors OPCO reconnu ; `target="_blank" rel="noopener noreferrer"` ; aucune URL issue d'une saisie n'atteint un `href` (`BrancheOpcoBloc`, `ClientBrancheForm`, `EstimationBaremeOpco` n'en portent aucun). ✅

## 5. Migration `20261004160000_opco_client_mobilites_versement_volontaire`
- Trois `ADD COLUMN IF NOT EXISTS`, nullables, sans défaut, aucune donnée touchée. ✅
- `/// rgpd:` : la garde du dépôt (`les-tables-du-dossier-client-suivent-la-personne.spec.ts`) porte sur les **modèles** de la section dossier client, pas sur les champs de `Client` ; aucune annotation exigée ici.

## 6. Fenêtre app/worker
- Le worker n'**écrit** pas ces colonnes et ne les lit pas **nommément**.
- ⚠️ Mais il les lit **implicitement** : `src/server/qualiopi/alertes/evaluateur.ts:3170` (`regleAucunBaremeOpco`, exécutée par le cron `formation-crons.alertes` à 07:00 UTC dans le worker) fait `select: { …, client: true }`, qui sélectionne **toutes** les colonnes scalaires de `clients`. Le worker atterrit ~50 min avant que l'app n'applique la migration. Une fusion entre ~06:10 et 07:00 UTC ferait échouer **cette seule règle** (colonne inexistante). L'évaluateur l'attrape (`evaluateur.ts:5253` → `reglesEnEchec`) ; elle se rétablit au passage suivant. Préexistant dans sa forme (tout ajout de colonne à `clients` le déclenche), donc **pas un motif de refus** ; à noter dans le créneau de fusion ou à corriger en restreignant ce `select`.

## Petits défauts (non bloquants)
a. **Texte libre orphelin.** Un client avec `opco = null` et un `opcoIdentifie` libre affiche « — » au départ ; choisir « — » ne produit aucun changement, donc rien n'est envoyé et le texte libre reste, alors qu'il nourrit encore `opcoDuClient` (donc le régime). L'effacer demande deux enregistrements (choisir un OPCO, puis « — »). Ancien geste à un clic perdu, sans effet monétaire faux. Piste : envoyer `REMETTRE_EN_INFERE` quand « — » est choisi et qu'une suggestion issue du texte libre existe.
b. **Enveloppe au-delà de `Int` 32 bits.** « 30 000 000 » € → 3 000 000 000 centimes : sûr pour JS, passe zod, dépasse `Int` Postgres (`opco_enveloppe_annuelle_cents`) → erreur Prisma brute au lieu d'un message. Aucun montant faux écrit. Piste : `.max(2_147_483_647)`.
c. **Date de l'accord réécrivable après facturation.** Le chemin « date seule » s'ouvre sur `facture` et `paiement_recu`, sans contrôle `accordEcritLe ≥ depotFaitLe`. Le régime ne gouverne que le choix de subrogation au moment où il est fait (`actions/qualiopi/financements.ts:270`) : rien de déjà facturé n'est recalculé, mais l'affichage peut changer après coup. Tracé au journal.
d. Effectif : `Number("1e3")` est accepté (1000). Inoffensif.

## Verdicts
- **EXACTITUDE : accepte**
- **SÉCURITÉ : accepte**
