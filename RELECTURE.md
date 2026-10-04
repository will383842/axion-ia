# RELECTURE A09 — lot A9 « fiche client : le SIRET appartient à la société »

Relecteur : A09, lentille **EXACTITUDE**. Aucun code de la PR n'a été modifié.
Branche relue : `opco/a9-fiche-client-siren` @ `16c1dc34` (5 commits sur `origin/main`, fusion sans conflit).
Rapport relu : `rapports/opco-a9-fiche-client-siren:RAPPORT.md`.

## Verdict : **refuse**

Un seul défaut bloquant : la migration de données (point 3). Elle écrit des SIREN que la règle TypeScript refuse. Une fois en base, la règle de lecture du lot les accepte comme des « SIREN saisis valides ». Les points 1, 2, 4 et 5 sont justes. La correction ne touche que le fichier SQL.

## Tests lancés

- `pnpm install` : OK.
- `prisma:generate` avec `DATABASE_URL` stub : OK.
- `pnpm vitest run src/lib/ src/server/qualiopi/crm/ src/server/actions/qualiopi/ 'src/app/[locale]/(admin)/[adminPrefix]/qualiopi/clients/' tests/unit/ci/le-siren-des-fiches-existantes-est-tire-du-siret.spec.ts` : **286 fichiers, 4 159 tests passés, 0 échec**.
- Sonde jetable (spec temporaire, supprimée ensuite) pour mesurer `sirenDuClient` sur l'état que la migration laisse en base. Résultats en 3.

## 1. `sirenDuClient` : conforme

- `src/lib/siret.ts`, `sirenDuClient` : l'ordre est bien SIREN saisi valide (format + Luhn), sinon SIRET valide, sinon `null`.
  - Le SIRET passe par `checkSiretFormat` : Luhn, repdigit, exception La Poste.
  - Le SIREN tiré du SIRET est recontrôlé (`checkSirenFormat`). Un SIRET à clé juste dont les 9 premiers chiffres sont faux donne donc `null`.
  - La Poste : `356000000` passe Luhn, l'exception fonctionne.
- Un SIREN saisi invalide retombe sur le SIRET. C'est voulu, et c'est sans risque.
- **À partir des seules entrées SIREN/SIRET, la fonction ne déduit jamais un SIREN faux.** Mais elle **fait confiance à la colonne `siren`**, et c'est la migration qui la remplit sans contrôle. Voir 3.

## 2. Édition : conforme

- `src/server/actions/qualiopi/clients.ts:471-478` : quand le SIRET est transmis sans SIREN et que le SIREN en base est **valide et contraire**, le SIREN est conservé (`sirenAEcrire = undefined`) et l'action renvoie `avertissement`.
- `exigerSirenLibre` n'est pas appelé dans ce cas, ce qui est correct.
- SIREN en base NULL, `""` ou à clé fausse : `sirenContreditLeSiret` rend faux, donc le SIREN tiré du SIRET est écrit. Le SIREN vide est bien rempli.
- `ClientEditForm.tsx` affiche l'avertissement (`role="status"`). La fiche le répète tant que la contradiction dure (`page.tsx`, `sirenContraire`).
- Le formulaire n'envoie le SIRET que s'il a changé (`change("siret")`). Enregistrer sans toucher au SIRET ne relance donc rien.

## 3. Migration `20261004220000_siren_deduit_du_siret` : **défaut bloquant**

### Ce qui est juste

- Noms exacts : `@@map("clients")`, `siren VarChar(9)`, `siret VarChar(14)`.
- Idempotente, et ne touche que les lignes où `siren IS NULL`.
- Aucun autre champ, aucun DDL.
- Horodatage postérieur à la dernière migration de `main` (`20261004190000`).
- L'index sur `clients(siren)` n'est pas unique : la migration ne peut pas échouer sur un doublon.

### Le défaut, et la réponse à la question posée

`prisma/migrations/20261004220000_siren_deduit_du_siret/migration.sql:10` : le seul filtre est `"siret" ~ '^[0-9]{14}$'`.

**Oui, un SIRET de 14 chiffres à clé fausse est recopié, alors que la règle TS le refuse. Et oui, c'est gênant**, parce que la lecture ne recontrôle pas ce qui a été écrit.

- Le rapport (section « Limites ») dit que « la lecture la recontrôle ». **C'est inexact.** `sirenDuClient` lit d'abord la colonne `siren`. Si les 9 chiffres recopiés passent Luhn à eux seuls, ils sont pris pour un « SIREN saisi valide », et le SIRET invalide n'est plus jamais consulté.
- Sur deux SIRET qui partagent leurs 9 premiers chiffres, il suffit de changer un chiffre du NIC pour fausser la clé. Le SIREN recopié est alors toujours valide. Chaque faute de frappe dans le NIC produit ce cas, pas une ligne sur dix.

Mesures (sonde jetable, sur l'état que la migration laisse en base) :

| Fiche avant migration                                 | Règle TS (`sirenDuClient`, avant)                                                                    | Après migration (`siren` recopié)              |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `siret = 00000000000000`, `siren = NULL`              | `null` (repdigit refusé ; test du lot `le-siren-d-un-client-se-lit-aussi-dans-son-siret.spec.ts:38`) | **`000000000`** : Luhn(000000000) = 0, accepté |
| `siret = 73282932000075` (clé fausse), `siren = NULL` | `null`                                                                                               | **`732829320`**                                |

Pourquoi c'est un défaut et pas une simple limite :

1. **`00000000000000` est la valeur réellement trouvée en production** (AXI-CLI-002). Elle a motivé tout le module : voir l'en-tête de `src/lib/siret.ts` et le commentaire de `src/server/actions/qualiopi/clients.ts:117`. Après la migration, cette fiche :
   - n'affiche plus le badge « SIREN à compléter » ;
   - affiche « SIREN 000000000 » sans avertissement (`sirenContreditLeSiret` rend faux, puisque le SIRET est invalide) ;
   - montre le bouton « Rafraîchir depuis l'INSEE », qui interroge l'annuaire sur `000000000` ;
   - porte une valeur que l'anti-doublon (`porte-client.ts`, `preparerCandidat` → `checkSirenFormat`) prend pour un **signal fort**. Toutes les fiches au SIRET de remplissage deviennent « la même entreprise ».
2. **Un SIRET à clé fausse dont la faute est dans les 9 premiers chiffres** donne le SIREN d'une **autre entreprise**, valide et peut-être réelle. Le bouton INSEE lit alors son effectif et l'écrit dans la fiche, avec `effectifSource = "insee"`. Le même SIREN part vers Axion Partners. Personne ne voit l'erreur, puisque la valeur passe tous les contrôles de lecture.
3. **La migration contredit l'outil existant du dépôt.** `scripts/visio/deriver-siren.ts` recontrôle le SIRET (`checkSiretFormat`) et classe `00000000000000` en `siretInvalides` sans rien écrire. Ce comportement est verrouillé par `tests/unit/visio/le-rattrapage-du-siren-est-idempotent.spec.ts:58`. La migration fait l'inverse.
4. **Le témoin CI du lot ne voit pas le problème.** `tests/unit/ci/le-siren-des-fiches-existantes-est-tire-du-siret.spec.ts` impose littéralement le motif `^[0-9]{14}$`. Il verrouille donc le défaut au lieu de le prévenir.

### Correction proposée (SQL seul, sans DDL, toujours idempotente)

Ajouter au `WHERE` :

- `"siret" !~ '^([0-9])\1{13}$'` (repdigit) ;
- la clé de Luhn du SIRET, exception La Poste comprise (préfixe `356000000`, somme des chiffres multiple de 5) ;
- la clé de Luhn des 9 premiers chiffres.

Les deux contrôles de Luhn se calculent en SQL par une sous-requête `generate_series(1, n)` sur `substr`. Sur 14 chiffres, on double les positions impaires en comptant depuis la gauche ; sur 9 chiffres, les positions paires.

Autre solution : retirer l'UPDATE et passer par `deriver-siren.ts`. Mais `tsx` est absent de l'image de prod (voir `prisma/scripts/purge-donnees-test-qualiopi.sql`), donc la voie SQL est préférable.

Dans les deux cas, ajouter au témoin CI une ligne `00000000000000` et une ligne à clé fausse qui ne doivent pas être écrites.

## 4. Page : conforme

- **Entreprise** : bloc Société avec raison sociale, SIRET, SIREN (ou badge + « Chercher le SIREN dans l'annuaire » + propositions « C'est elle »), adresse, pénalités. Bloc Contact avec nom, rôle, e-mail, téléphone.
- **Particulier** : pas de bloc Société, pas de badge (`sirenACompleter` exige `estEntreprise`). L'adresse et les pénalités passent dans le bloc Contact (`!estEntreprise ? adresseEtPenalites`).
- L'effectif et l'OPCO ne s'affichent qu'une fois : les cases de la carte sont retirées, et `BrancheOpcoBloc` rend `null` pour un particulier.
- Le bouton INSEE et `messageReleveInsee` sont passés via `complementEffectif`, que `BrancheOpcoBloc.tsx:124` rend sous la tuile « Effectif ».
- Rien n'est perdu : annuaire, « C'est elle » (`confirmerSirenFormAction`), pénalités, adresse (structurée sinon libre), fonction du contact, date du relevé (désormais dans la tuile, `formatDateFrShort(effectifReleveLe)`).

## 5. Relevé INSEE : conforme

- À la création (`clients.ts:390`) comme au bouton (`effectif-insee.ts`, `select` étendu à `siret`), on passe par `sirenDuClient`, et c'est le SIREN tiré du SIRET qui est envoyé à `rechercherTrancheEffectif`.
- Aucun appel réseau nouveau au rendu. Le seul appel au rendu reste `rechercherSiren`, comme avant : sur `?annuaire=1`, si la fiche peut écrire, et seulement si le SIREN est à compléter.
- Cela vaut tant que la colonne `siren` est saine. Voir 3 : après la migration, le bouton interroge aussi les SIREN mal recopiés.

## Petits défauts (non bloquants)

- `page.tsx`, bloc Contact : `client.contactNom ?? "—"` (et de même pour l'e-mail, le téléphone et le rôle). Une chaîne vide `""` s'affiche comme une case vide, sans tiret. L'ancien code filtrait les valeurs vides (`filter(Boolean)`). Mieux vaut `|| "—"`.
- La tuile Effectif dit « INSEE », là où la carte disait « Relevé INSEE (borne basse de la tranche) ». La précision « borne basse » se perd, alors que c'est elle qui explique un chiffre rond plus bas que la réalité.
- `checkSirenFormat` n'a pas de garde repdigit, contrairement à `checkSiretFormat`. Le cas `000000000` y passe, à la saisie manuelle comme à « C'est elle ». C'est antérieur au lot, mais c'est ce qui rend le défaut 3 invisible à la lecture. On peut l'ajouter au passage.
- Rapport, section « Limites » : la phrase « la lecture la recontrôle » est à corriger, qu'on applique ou non la correction proposée.

## Verdict

**refuse** : `prisma/migrations/20261004220000_siren_deduit_du_siret/migration.sql:10` recopie le SIREN de SIRET invalides (`00000000000000`, clé de Luhn fausse). `sirenDuClient` les accepte ensuite comme des SIREN saisis valides, d'où un faux SIREN affiché, interrogé à l'INSEE et compté par l'anti-doublon. Une fois la clause de contrôle ajoutée au `WHERE` (avec son témoin), le lot est acceptable en l'état.
