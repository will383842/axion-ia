# Relecture A09 — lot OPCO A7c (alertes) — lentilles EXACTITUDE et SÉCURITÉ (argent)

Diff relu : `origin/opco/a7a-un-seul-opco...origin/opco/a7c-alertes` (tête `88cdf903`), rapport
`rapports/opco-a7c-alertes:RAPPORT.md`. Aucun code de la PR modifié.

Exécuté : `pnpm install`, `prisma:generate` (stub), `pnpm vitest run src/server/qualiopi/alertes/`
→ **33 fichiers, 919 tests passés (1 todo)**. Plus un témoin jetable (non commité) sur la
fonction pure de la règle 1, cité ci-dessous.

## 🔴 Défaut démontré — `subrogation_incompatible_regime` lève sur des sessions de l'ANCIEN régime

`src/server/qualiopi/alertes/regle-subrogation-incompatible-regime.ts:70-101` lit sur **trois ans**
les sessions `planifiee | en_cours | realisee` subrogées et non facturées, puis
`:50-56` appelle `regimePaiementOpco` avec la seule `dateAccord` du dossier OPCO **ouvert**
(`statut: { not: "clos" }`). La session elle-même n'entre jamais dans le calcul : ni `dateDebut`,
ni `dateFin`. Or `regimePaiementOpco` (`regime-paiement-opco.ts`) ne classe « ancien régime »
que si `accord < 2026-10-01` ; **sans date d'accord**, il descend à la règle « ≥ 50 salariés →
`remboursement_entreprise` ».

Scénario reproduit (fonction pure, `now = 2026-10-04`) :

- session `S-2026-010`, **réalisée en juin 2026**, `opcoSubrogation = true`, aucune facture en base ;
- client Atlas, effectif 120 ;
- aucun dossier OPCO saisi, **ou** dossier passé à `clos`, **ou** dossier ouvert sans `accordAt`
  ni `accordEcritLe` (cas courant des sessions antérieures à la saisie des accords).

→ **une alerte `critique`** : « le régime de paiement depuis le 1er octobre 2026 est le
remboursement de l'entreprise … retirez la subrogation ». C'est faux : une formation terminée
avant le 1/10/2026 relève de l'ancien régime (son accord est nécessairement antérieur), la
subrogation y est légitime.

**Pourquoi c'est un risque d'argent et pas seulement du bruit** : l'action que l'alerte prescrit
(retirer la subrogation) fait partir la facture vers l'entreprise TTC au lieu de l'OPCO
(`destinataire-facture.ts`) — sur une session que l'OPCO devait payer. Et la fenêtre de trois ans
sur des sessions réalisées non facturées est précisément le stock historique, donc le faux positif
est **en masse** au premier passage, pas marginal (borné seulement par le plafond de 200 candidates,
qui gèlerait alors la résolution du code).

Le « même calcul que la page Financement » est exact, mais la page l'affiche comme indication ;
l'alerte en fait une injonction critique. Correction attendue (au choix de l'auteur) :
- ne lever que si la session commence (jour de Paris) au plus tôt le 2026-10-01 **ou** porte un
  accord daté ≥ 2026-10-01 ; sinon, sans date d'accord, se taire (traiter comme `inconnu`) ;
- et lire aussi le dossier `clos` pour la date d'accord (ou ne pas filtrer `clos` dans cette règle) ;
- témoin rouge : session réalisée avant le 1/10/2026, sans accord daté, effectif ≥ 50 → aucune alerte.

Le reste de la règle est juste : elle ne vise jamais une session facturée (`none { statut notIn
[brouillon, annulee] }` : un brouillon ou une annulée laissent l'alerte, une émise la referme),
`inconnu` ne lève pas, `subrogationConfirmeeParAccord` la referme, guichet `direction`.

## Points vérifiés, conformes

1. **Lever / se taire / se résoudre.** `donnees_opco_incompletes` : une alerte par client
   entreprise, particuliers et sessions sans client exclus, bornée aux sessions **planifiées à
   365 j** — le volume initial est voulu et borné par le planning, pas par l'historique.
   `fonds_opco_suspendus_session` : borné à J-60. Résolution par `(code, cibleId)` vérifiée dans
   `alertes-service.ts` (`code::null` pour la cible absente).
2. **Fonds suspendus.** `etatFondsPour` est la fonction du bandeau (`etatFondsDuClient`), mêmes
   entrées (`opcoDuClient`, `idcc`, `effectif`, `aLaDate = now`) ; seule différence : 2 000 relevés
   tous OPCO concernés confondus contre 500 par OPCO pour le bandeau, sans effet tant que le volume
   reste sous ce plafond. Début de session (`DateTime`) lu au jour civil de Paris ; `depotFaitLe` et
   `dateLimiteDepot` (`@db.Date`) lus par leur partie ISO ; même exercice exigé ; repli
   `dateLimiteDepot2026` du référentiel. Le témoin 22 h 30 / 23 h 30 UTC du 30/11 est correct.
3. **`etat_fonds_perime`.** Volet A5 inchangé (même message, même cible `EtatFondsOpco`, même
   lecture `dernierReleveEtatFonds`). Volet « aucun relevé » sans cible : clé `code::null`,
   `lienCible` rend `null` sans planter, libellé non requis, message rafraîchi quand la liste
   d'OPCO change, résolu quand chacun a un relevé.
4. **Panne.** `sessionsOpcoAVenir`, la lecture des relevés et la recherche `distinct` lèvent →
   `reglesEnEchec` → `synchroniserAlertes` suspend toute la résolution du tour (vérifié l. ~603).
5. **OPCO** lu uniquement par `opcoDuClient` / `nomOpcoDuClient` / `referenceOpcoDuClient`, avec
   `opco` ET `opcoIdentifie` sélectionnés partout.
6. **Performance.** Par passage : règle 1 = 1 `findMany` (relations chargées en lot par Prisma) ;
   règle 2 = 2 ; règle 3 = 3 ; règle 4 = 1. Soit 7 requêtes de tête, **aucun N+1**.

## Petits défauts (non bloquants)

- **Fonds suspendus alors que l'accord est déjà obtenu** (`regle-fonds-opco-suspendus-session.ts:89-98`) :
  une suspension vise les nouvelles demandes ; une session dont le dossier porte déjà `accordAt`
  reçoit pourtant une alerte critique « reportez la session ou changez son financement ». Même
  remarque pour le volet date limite quand l'accord est saisi mais pas `depotFaitLe`. Suggestion :
  sélectionner `accordAt`/`accordEcritLe` dans `sessionsOpcoAVenir` et se taire si un accord existe.
- **Plafond de lecture muet** : `take: 500` dans `sessions-opco-a-venir.ts:58` et
  `regle-subrogation-incompatible-regime.ts:79` n'est pas remonté dans `reglesTronquees` ; au-delà,
  les sessions non lues voient leurs alertes refermées. Hors d'atteinte au volume actuel ; à
  signaler par un `console.warn` si `length === take`.
- **Lecture redondante** : `sessionsOpcoAVenir(now, 365)` est exécutée deux fois par passage
  (règles 3 et 4), plus une fois à 60 j. Mémoïser par `now` diviserait par deux sans changer la
  définition partagée.
- `dernierReleveEtatFonds` avale toujours les pannes (A5, signalé par le rapport) : le volet
  « périmé » peut se refermer sur une panne isolée de cette seule lecture si les autres règles passent.

## Verdicts

- **EXACTITUDE : `refuse`** — `regle-subrogation-incompatible-regime.ts:50-56` / `:87` : alerte
  critique sur toute session subrogée réalisée avant le 1/10/2026 sans date d'accord lisible
  (dossier absent, clos ou non daté), avec un effectif ≥ 50 ou un cofinancement. Scénario reproduit
  ci-dessus. Les trois autres alertes sont acceptables.
- **SÉCURITÉ (argent) : `refuse`** — même défaut : l'alerte prescrit de retirer une subrogation
  légitime, ce qui envoie la facture à l'entreprise au lieu de l'OPCO. Aucun cas trouvé où une
  alerte se tairait à tort sur une subrogation réellement impossible.

---
_Relecture A09 — Claude Code_
