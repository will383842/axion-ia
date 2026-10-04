# Contre-relecture A09 — correctif OPCO A7c (`f1f9cedcd`) — lentilles EXACTITUDE et SÉCURITÉ (argent)

Refus initial : `origin/relectures/opco-a7c:RELECTURE.md` (`subrogation_incompatible_regime` levait
sur des sessions de l'ancien régime). Correctif relu : `f1f9cedcd` sur `origin/opco/a7c-alertes`
(tête relue `357eb9aa`, merge de `main` sans effet sur les fichiers concernés). Aucun code modifié.

Exécuté : `pnpm install`, `prisma:generate` (stub), `pnpm vitest run src/server/qualiopi/alertes/`
→ **33 fichiers, 922 tests passés (1 todo)** (919 avant le correctif, +3 témoins). Plus un témoin
jetable de 4 tests sur la fonction pure, **non commité**, tous verts — détail ci-dessous.

## 1. Le scénario du refus ne lève plus — ✅

`regle-subrogation-incompatible-regime.ts` : avant d'appeler `regimePaiementOpco`, la règle exige
`jourParis(dateDebut) >= "2026-10-01"` **ou** `jourParis(dateAccord) >= "2026-10-01"` ; sinon
`continue`. Témoin (Atlas, 120 salariés, début 10/06/2026, `now` = 04/10/2026) :

| Cas                                                   | Avant    | Après    |
| ----------------------------------------------------- | -------- | -------- |
| aucun dossier                                         | critique | **rien** |
| dossier ouvert sans `accordAt` ni `accordEcritLe`     | critique | **rien** |
| dossier `clos` (la requête le filtre → lu comme `[]`) | critique | **rien** |
| dossier `mixte` / cofinancement, sans date            | critique | **rien** |
| Constructys, 8 salariés, juin 2026                    | critique | **rien** |

## 2. L'alerte lève toujours sur le nouveau régime — ✅

- session qui commence le 01/10/2026 (Paris), sans accord daté → 1 alerte ;
- session de juin avec `accordEcritLe` = 2026-10-01 → 1 alerte ; avec `accordAt` le 01/10 → 1 alerte ;
- Constructys, 8 salariés, début 01/11/2026 → 1 alerte (témoin du dépôt `s-2` aussi) ;
- test existant `GRANDE` (sans `dateDebut`, accord du 15/10) → toujours levée : le champ optionnel
  absent laisse la seule date d'accord décider.
- Cohérence : début ≥ 1/10 mais accord écrit du 20/09 → se tait, ce qui est l'avis de
  `regimePaiementOpco` (« accord antérieur au 1er octobre : ancien régime »). Juste.

## 3. Jour de Paris — ✅

`parisDateISO` (`presence/time.ts`, `Intl` fuseau `Europe/Paris`) sur `dateDebut` et sur la date
d'accord retenue. Témoin : début `2026-09-30T23:30Z` (= 01/10 01 h 30 Paris) → **lève** ;
`2026-09-30T21:30Z` (= 30/09 23 h 30 Paris) → **se tait**. Même bascule vérifiée sur `accordAt`.
`accordEcritLe` (`@db.Date`, minuit UTC) reste au même jour civil à Paris (UTC+2/+1) : pas de décalage.

## 4. `fonds_opco_suspendus_session` se tait si un accord existe — ✅ rien de dangereux masqué

- La suspension et la date limite d'engagement visent les **nouvelles demandes** : un accord obtenu
  n'est pas remis en cause. Se taire est le bon comportement (c'était la suggestion de la relecture).
- `accordAt` / `accordEcritLe` ne se posent **qu'à l'arrivée en `accord_recu`**
  (`dossier-financement.ts:159` refuse `accordEcritLe` hors de cette transition ; `accordAt` est le
  timestamp de ce statut). La machine à états n'autorise **pas** `accord_recu → refuse`. Donc un
  dossier portant un accord n'a jamais été refusé : l'alerte ne peut pas se taire sur un refus.
- Le `continue` est local à `candidatsFondsOpcoSuspendusSession` : `donnees_opco_incompletes` et
  `etat_fonds_perime`, qui partagent `sessionsOpcoAVenir`, n'utilisent pas ces champs (ajout de
  deux colonnes au `select`, champs optionnels dans le type — sans effet sur eux).
- **Résidu non bloquant** : le filtre est `some` sur tous les dossiers OPCO/mixte **sans filtre de
  statut**. Un dossier `accord_recu → clos` (accord abandonné) suivi d'un nouveau dossier en cours
  ferait taire l'alerte pour la nouvelle demande. Cas rare ; corrigible par
  `statut: { not: "clos" }` ou en ne lisant que le dossier ouvert le plus récent.

## 5. Sélection Prisma — ✅

`regleSubrogationIncompatibleRegime` sélectionne `dateDebut: true` (colonne non nullable,
`TrainingSession.dateDebut DateTime`), verrouillé par `expect(select.dateDebut).toBe(true)`.
`sessionsOpcoAVenir` sélectionne `accordAt` et `accordEcritLe`.

## Résidus (non bloquants)

- Le dossier `clos` reste filtré pour la date d'accord : une session commencée avant le 1/10 dont
  le seul accord daté ≥ 1/10 est sur un dossier clos se tait (faux négatif, sens sûr pour
  l'argent : aucune subrogation n'est retirée à tort). À l'inverse, une session commençant
  après le 1/10 dont l'accord ancien régime est sur un dossier clos lèverait — cas marginal et
  antérieur au correctif.
- Constante `DEBUT_REFORME` dupliquée avec `regime-paiement-opco.ts` (commentaire le signale) :
  à exporter depuis le module pur pour éviter une dérive.
- Points non bloquants de la relecture initiale (plafond muet, double lecture, panne de
  `dernierReleveEtatFonds`) inchangés par ce correctif.

## Verdicts

- **EXACTITUDE : `accepte`** — le scénario du refus se tait dans ses trois variantes, l'alerte lève
  toujours sur une session ou un accord du nouveau régime, bascule au jour de Paris vérifiée.
- **SÉCURITÉ (argent) : `accepte`** — plus aucune injonction de retirer une subrogation légitime de
  l'ancien régime ; le silence de `fonds_opco_suspendus_session` ne peut couvrir un dossier refusé.

---

_Contre-relecture A09 — Claude Code_
