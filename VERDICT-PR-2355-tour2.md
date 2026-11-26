VERDICT: BON

# Audit de la PR #2355, tour 2 : avertissement avant un avoir du Hub sur une facture commissionnée

Seconde relecture d'exactitude et audit argent, en lecture seule, de `origin/feat/hub-avoir-avertissement-commission` (tête `259f6747b`), contre `origin/main`, après le premier verdict (`origin/verdict/pr-2355:VERDICT-PR-2355.md`).

## Constats du premier tour : corrigés

- **Constat 1 (argent) : corrigé.** `src/server/qualiopi/financements/avoir-commission-apporteur.ts:48` : sans ligne de commission, le helper interroge `presentationCouvreLaCommande`. Celle-ci réutilise **la même lecture que le passage quotidien** : `lirePresentationsProtegees`, filtrée par SIREN du client ; `lireEtablissements` ; `lireSiretsDevis` ; `siretDeLaCommande` (SIRET du devis, sinon fiche client) ; `dateDeCommande` (acceptation du devis, sinon émission) ; `presentationPourEtablissement`. Ce sont les mêmes appels, dans le même ordre, que `etapeCommissions` (`passage-quotidien.ts:987-1001`). « À attribuer » compte comme commissionnée : c'est le côté sûr. Une présentation couvrante sans ligne de commission est donc **refusée sans confirmation**, avec `confirmationRequise: true` (test « aucune ligne de commission mais présentation couvrante »).
  Écarts avec le passage quotidien, tous du côté sûr (avertissement en trop, jamais en moins) : factures d'essai (`FACTURE_HORS_ESSAI`), factures de plan récurrent (`planRecurrentId`) et développement web signé avant la date d'effet ne sont pas exclus. Pour les deux premiers cas, la PR ne le dit pas (voir constat 3 ci-dessous).
- **`passage-quotidien.ts` : aucun changement de comportement.** Le diff se limite à ajouter `export` devant `lirePresentationsProtegees` (l. 770) et à reformater le type de retour. Aucun import circulaire : rien sous `src/features` ni `src/server` (hors l'action) n'importe le helper ou `facturation-hub.ts`.
- **Calcul des commissions et des reprises : intact.** Le diff ne touche ni `commissions.ts`, ni `avoir-client.ts`, ni `genererAvoirFacture`. L'action appelle `genererAvoirFacture` avec les mêmes paramètres qu'avant. La TVA n'est pas touchée et aucune migration n'est ajoutée.
- **Constat 2 : corrigé.** `src/server/actions/qualiopi/facturation-hub.ts:491` : `changes.confirmerReprise` est un booléen strict (`=== true`), qui vaut aussi `false` sans confirmation. Deux tests le vérifient.
- **Constat 3 : corrigé.** L'action renvoie `{ error, confirmationRequise: true }` (`facturation-hub.ts:471-475`, type de retour mis à jour). `FactureFormationActions.tsx:187` passe alors `confirmationRequise` à vrai, `:161` affiche la case (`afficherConfirmation`), et `:182` n'envoie `confirmerReprise: true` que si la case est affichée et cochée. Il n'y a plus de blocage sans case visible.
- **Constat 5 : corrigé.** Le spec compte 16 tests : présentation couvrante, autre SIREN, « à attribuer », journal vrai et faux, facture sans devis (sœurs non lues, `in: [FACTURE_ID]`), `avoirDeId: null`, avoir partiel, facture introuvable.
- **Constat 4** : gardé volontairement (aligné sur le garde-fou des garanties). C'est le côté sûr ; aucune objection.

## Pas de contournement côté serveur

Le contrôle reste dans `genererAvoirAction`, après `requireHabilitation("facturer")` et zod. Seul `true` strict lève le refus. La page ne calcule l'indicateur que si `peutEcrire && !estAvoir` (`page.tsx:522`). Les habilitations sont inchangées.

## Les tests mordent (mutation puis restauration, fichiers vérifiés propres ensuite)

| Mutation                                                   | Tests en échec                              |
| ---------------------------------------------------------- | ------------------------------------------- |
| `presentationCouvreLaCommande` remplacé par `return false` | 2 (présentation couvrante, « à attribuer ») |
| filtre `p.siren === siren` retiré                          | 1 (autre SIREN)                             |
| `confirmerReprise` retiré du journal                       | 2                                           |
| `confirmationRequise` retiré de la réponse                 | 2                                           |
| « à attribuer » exclu                                      | 1                                           |
| `avoirDeId: null` retiré des sœurs                         | 1                                           |
| `signeeAt`/`siret` remplacés par `new Date(0)`/`null`      | **0** (voir constat 1 ci-dessous)           |

## Contrôles lancés

- `pnpm vitest run src/server/actions/qualiopi/facturation-hub src/features/apporteurs-reseau` : **111 fichiers, 1 507 tests verts** (6 todo). Ce lot inclut le verrou « le worker n'importe pas server-only ».
- `NODE_OPTIONS=--max-old-space-size=12000 pnpm typecheck` : **vert** (code de sortie 0).
- `pnpm-lock.yaml` : inchangé contre `origin/main`.

## Constats restants (aucun bloquant)

1. **`src/server/actions/qualiopi/facturation-hub-avoir-commission.spec.ts:14` et `:36` — gravité BASSE (tests).** `presentationPourEtablissement` et les lectures d'établissements sont entièrement simulées : remplacer la date de commande et le SIRET transmis (`avoir-commission-apporteur.ts:69`) par `new Date(0)` et `null` laisse les 16 tests verts. Le code est juste à la lecture (mêmes arguments que `passage-quotidien.ts:996-1001`), mais rien ne le verrouille.
   **Correctif proposé** : un test qui vérifie les arguments, par exemple `expect(mockPresentationPour).toHaveBeenCalledWith(expect.anything(), expect.anything(), new Date("2026-04-20"), …)` (acceptation du devis, pas l'émission). Mieux : ne pas simuler `presentationPourEtablissement` (fonction pure) et fournir une présentation réelle couverte ou non couverte à la date.
2. **`src/server/qualiopi/financements/avoir-commission-apporteur.ts:60` — gravité BASSE (performance).** `lirePresentationsProtegees()` lit **toutes** les présentations protégées, plus les réservations, puis filtre par SIREN en mémoire. Cela se produit à chaque affichage d'une facture par un utilisateur habilité (`page.tsx:522`) et à chaque avoir. C'est acceptable au volume actuel et c'est le prix de la « même lecture, pas une seconde ». À surveiller si le réseau grossit.
   **Correctif possible plus tard** : un paramètre SIREN facultatif à `lirePresentationsProtegees`, sans changer le comportement du passage quotidien.
3. **`avoir-commission-apporteur.ts:48-69` — gravité BASSE (ergonomie, côté sûr).** Contrairement au passage quotidien, le helper n'exclut ni les factures d'essai (`FACTURE_HORS_ESSAI`) ni les factures de plan récurrent (`planRecurrentId`, abonnements et maintenance, jamais commissionnés depuis la règle du 25/11). Un avoir sur l'abonnement d'un client présenté demandera donc toujours la confirmation, à tort. Il n'y a aucun risque d'argent.
   **Correctif proposé** (facultatif) : rendre `false` d'emblée pour ces deux cas, comme le fait `etapeCommissions`. Au minimum, le mentionner dans le corps de PR à côté de l'exclusion « développement web ».
4. **`src/app/[locale]/(admin)/[adminPrefix]/qualiopi/facturation/[id]/page.tsx:522` — gravité BASSE.** L'appel n'est pas protégé : une erreur de lecture (base indisponible, table absente non prévue) fait tomber toute la page facture, pas seulement l'avertissement. Les tables absentes sont déjà tolérées par les lectures réutilisées (`tableAbsente`) : le risque est faible.
   **Correctif possible** : `.catch(() => true)` (afficher la case par prudence). L'action serveur reste de toute façon le vrai garde-fou.

## Conclusion

Les constats 1, 2, 3 et 5 du premier tour sont corrigés, sans régression. Une présentation couvrante sans ligne de commission est refusée sans confirmation. `passage-quotidien.ts` ne change que par un `export`. Le calcul des commissions et des reprises est intact, le journal trace la confirmation, et le formulaire affiche la case quand le serveur l'exige. Les tests mordent sur chaque correction, sauf sur les arguments transmis à `presentationPourEtablissement` (constat restant 1, à ajouter sans bloquer). Bon pour fusion.
