# RAPPORT — INT-T65-A, préparation (témoins rouges et migration)

Session planifiée du 2026-10-04. Branche de travail : `opco/int-t65-a-condition-suspensive`,
partie de `origin/main` à jour (`11017d43`). **Aucune PR n'a été ouverte.** Comme l'autorise la
coordination Partners (issue axion-apporteurs#656, message du 2026-10-04 à 09:07 UTC), seuls
les témoins rouges et la migration sont livrés. L'implémentation attend le signal de la fusion
du rattrapage 105.

## 1. Le porteur retenu : `DocumentGenere` (table `documents_generes`)

Les colonnes sont portées par la **pièce générée** de type `convention` ou
`convention_tripartite`, c'est-à-dire la ligne qui porte le numéro immuable, l'empreinte
SHA-256 et le statut de signature de la convention.

Pourquoi ce porteur plutôt qu'un autre :

- **C'est l'objet signé.** La clause imprimée et ses paramètres (`{seuil}`, `{dateLimite}`)
  doivent être ceux de la pièce que le client a signée, et non ceux d'un objet qui évolue
  ensuite. Une régénération produit une nouvelle pièce, avec un nouveau numéro et ses propres
  colonnes. Une pièce déjà signée garde donc ses paramètres.
- **`DossierFinancement` est plus loin.** Il décrit le financement (dépôt, accord écrit), pas
  la convention. Il peut exister sans convention, ou survivre à plusieurs conventions
  successives. Or la clause dit qu'un accord obtenu après la défaillance donne lieu à une
  **nouvelle** convention, avec son propre état. L'état `en_attente | active | caduque` est
  donc propre à chaque convention, pas au dossier.
- **`TrainingSession` est plus loin encore.** Une session inter-entreprises porte plusieurs
  conventions, une par client, et chacune a sa propre condition.
- A02 demandait « une colonne par dossier, stockée sur la convention ». C'est ce que fait ce
  choix, sans créer de modèle neuf. Aucune annotation `/// rgpd:` n'est donc requise.

Limite assumée : `documents_generes` sert à tous les types de pièces. Les colonnes restent à
`false` ou `NULL` partout ailleurs. **À trancher à l'implémentation** : faut-il un second CHECK
qui réserve `condition_suspensive_opco = true` aux types `convention` et
`convention_tripartite` ? Il n'a pas été posé, parce qu'il sort de la forme imposée par A02.

## 2. La migration

Fichier : `prisma/migrations/20261004210000_convention_condition_suspensive_opco/migration.sql`.
Son horodatage, 20261004210000, est bien postérieur à 20261004200000.

- **Ajouts seuls**, sans DROP, sans RENAME et sans recopie. La migration est idempotente :
  `CREATE TYPE` dans un bloc `DO … EXCEPTION WHEN duplicate_object`, `ADD COLUMN IF NOT EXISTS`,
  et une contrainte créée seulement si elle est absente de `pg_constraint`.
- Deux énumérations : `SeuilConditionSuspensiveType {pourcentage, montant}` et
  `EtatConditionSuspensive {en_attente, active, caduque}`.
- Six colonnes :
  - `condition_suspensive_opco BOOLEAN NOT NULL DEFAULT false` ;
  - `seuil_type`, nullable ;
  - `seuil_bps INTEGER`, nullable ;
  - `seuil_cents INTEGER`, nullable ;
  - `date_limite DATE`, nullable ;
  - `etat_condition_suspensive`, nullable.

  Aucune n'est un flottant.
- **CHECK `documents_generes_condition_suspensive_seuil_check`** :
  - condition non posée : aucun seuil ni type ;
  - condition posée en `pourcentage` : `seuil_bps` entre 1 et 10 000, et `seuil_cents` NULL ;
  - condition posée en `montant` : `seuil_cents` > 0, et `seuil_bps` NULL.

  La contrainte est ajoutée en `NOT VALID`, puis validée par `VALIDATE`. La table n'est pas
  vide, mais les colonnes neuves le sont (`false` ou `NULL` sur chaque ligne existante), donc la
  validation passe sans rien réécrire.
- Le fichier `schema.prisma` est mis à jour en conséquence. Le diff s'allonge parce que
  `prisma format` a réaligné les colonnes du modèle. `prisma migrate diff` (ancien schéma →
  nouveau) produit exactement les mêmes types et les mêmes colonnes.
- **Vérifiée sur un PostgreSQL 16 local**, sur une table qui contenait déjà des lignes :
  - deux passes de suite sans erreur (idempotence) ;
  - la contrainte est validée (`convalidated = t`) ;
  - les deux cas valides (pourcentage, montant) sont acceptés ;
  - cinq cas invalides sont refusés : les deux seuils posés ensemble, un type sans seuil, un
    seuil sans condition, 10 001 points de base, une condition sans type.
- **Fenêtre app/worker** : le worker ne lit aucune de ces colonnes, et aucune valeur des
  énumérations n'est employée dans la migration.

SSOT, dans le même commit : `SEUIL_CONDITION_SUSPENSIVE_OPCO_BPS = 5000` dans
`src/server/qualiopi/config/financing.ts`, avec pour source « décision de Williams du
2026-10-04 ». Une constante seule n'est pas de l'implémentation, et le témoin des champs la lit.

## 3. Les témoins et le ROUGE constaté

Commande : `pnpm exec vitest run <les trois fichiers>`. Bilan : **3 fichiers en échec**, 6 cas en
échec et 2 cas verts.

| Témoin | Rouge constaté | Raison |
| --- | --- | --- |
| `src/server/qualiopi/financements/__tests__/condition-suspensive.spec.ts` | `Error: Failed to resolve import "../condition-suspensive" … Does the file exist?` | module absent |
| `src/components/admin/qualiopi/__tests__/condition-suspensive-opco-champs.spec.tsx` | `Error: Failed to resolve import "../ConditionSuspensiveOpcoChamps" … Does the file exist?` | composant absent |
| `src/server/qualiopi/documents/templates/__tests__/condition-suspensive-opco-clause.spec.tsx` | 6 × `AssertionError: expected 'OrganismedeformationAxion-IASAS1ruede…' to contain 'Conditionsuspensivedepriseenchargepar…'` et `expected +0 to be 1` | aucun des deux gabarits n'imprime la clause |

Ce que chaque témoin fixe :

- **Machine d'états.** Une convention passe de `en_attente` à `active` si l'accord écrit est au
  moins égal au seuil et obtenu au plus tard à la date limite. Ses effets partent alors de la
  date de signature. Elle devient `caduque` en cas de refus, d'accord inférieur au seuil ou de
  date limite dépassée.

  Le témoin fixe aussi les cas suivants :
  - **Renonciation :**
    - avant que la condition soit accomplie ou défaillie, la convention devient `active` à la
      date de signature ;
    - après la défaillance, elle reste `caduque`.
  - **Accord tardif :** un accord arrivé après un refus ou après la date limite ne fait pas
    revivre la convention.
  - **Ordre des événements :** ils sont traités dans l'ordre chronologique.
  - **Seuil :**
    - en pourcentage, il se compare au prix TTC de la convention ;
    - en euros, il se compare au montant accordé ;
    - le calcul est entier : un seuil de 3 333 points de base sur 100,01 € est atteint à
      33,34 € et pas à 33,33 €.
  - **Valeurs refusées :** un montant qui n'est pas un nombre entier de centimes, et un seuil
    hors de l'intervalle 1 à 10 000 points de base, lèvent une `RangeError`.
  - **Date limite :** elle se lit en heure de Paris. En hiver, elle tombe à 23:00 UTC ; en été,
    à 22:00 UTC. Un accord reçu à 23:30, heure de Paris, le dernier jour est dans le délai ; un
    accord reçu à 00:30 le lendemain ne l'est plus.
  - **Rappel :** il est dû à partir du septième jour avant la date limite (J-7), heure de
    Paris, tant que la condition est en attente, et jamais ensuite.
  - **API attendue :** `evaluerConditionSuspensive`, `seuilAtteint`, `dateLimiteDepassee`,
    `dateDuRappel`, `rappelDu`, ainsi que les types `ConditionSuspensive` et
    `EvenementConditionSuspensive`.
- **Champs de la console.**
  - La case est **non cochée** par défaut, et aucun champ de seuil ni de date n'est alors
    affiché.
  - Une fois cochée, le seuil est prérempli à 50, valeur **lue dans la SSOT**. La date limite,
    de type `date`, est requise.
  - Le seuil en pourcentage est modifiable : la saisie « 62,5 » donne 6 250 points de base.
  - On peut basculer entre pourcentage et montant : la saisie « 1 500,50 » donne
    150 050 centimes, et `seuilBps` passe à `null`.
  - Une fois décochée, tout repasse à `null`.
  - La micro-copie vouvoie le lecteur.

  Contrat attendu : une prop `onChange` qui reçoit
  `{conditionSuspensiveOpco, seuilType, seuilBps, seuilCents, dateLimite}`.
- **Gabarits.** `convention.tsx` et `convention-tripartite.tsx` impriment la clause de la
  juriste **mot pour mot**, telle que Williams l'a validée le 2026-10-04 à 09:19 UTC
  (commentaire 5978462914). Le témoin la contrôle avec un seuil en pourcentage puis avec un
  seuil en montant, et vérifie qu'elle n'apparaît **qu'une seule fois**. Les espaces sont
  retirés des deux côtés avant comparaison ; chaque lettre et chaque signe restent comparés
  dans l'ordre.

  Les 2 cas verts sont « condition absente ou null : rien n'est imprimé ». Ils sont verts par
  construction et servent de garde de non-régression.

  Contrat attendu : une prop
  `data.conditionSuspensiveOpco = { opco, dateLimite, seuil: {type:"pourcentage", bps} | {type:"montant", cents} }`.

Contrôles faits avant de pousser :
- **eslint et prettier** : propres sur les fichiers TypeScript.
- **`tsc`** : il ne signale que les deux modules absents (`TS2307`), ce qui est attendu pour des
  témoins rouges.
- **Gardes `tests/unit/ci`, `config` et le socle commun des deux conventions** : 94 fichiers
  sur 95 passent. Le seul échec,
  `les-octets-d-un-document-ne-sortent-que-par-le-telechargement`, échoue **à l'identique sur
  `main`**. Ce n'est pas un défaut du code : le client Prisma n'est pas généré dans ce
  conteneur, car l'installation s'est faite avec `--ignore-scripts`.

## 4. Ce qu'il restera à coder au signal

1. `src/server/qualiopi/financements/condition-suspensive.ts` : le module pur décrit par le
   témoin.
2. `src/components/admin/qualiopi/ConditionSuspensiveOpcoChamps.tsx` (client), à monter dans
   `DocumentsSection.tsx`, près du bouton « Générer la convention ».
3. `genererConventionAction` (`src/server/actions/qualiopi/documents.ts`) : valider la saisie
   avec Zod (entiers, un seul seuil, date limite requise), écrire les colonnes sur la
   `DocumentGenere` créée avec `etat = en_attente`, et transmettre `conditionSuspensiveOpco` aux
   données du gabarit. **Lentille sécurité** : c'est une server action d'administration qui
   change.
4. Les deux gabarits :
   - ajouter une section numérotée **identique** dans les deux, sans quoi la garde
     `les-deux-conventions-portent-le-meme-socle` rougit ;
   - placer le texte de la clause dans **une seule source** partagée ;
   - passer `gabarit-versions.ts` en v5 et archiver la v4 sous `templates/archives/`.
5. **À faire confirmer par A07 avant la fusion**, en deux points :
   - **le rendu de `{seuil}`.** En pourcentage, le témoin attend « 50 % du prix toutes taxes
     comprises de la présente convention », que la juriste n'a pas écrit elle-même. En montant,
     il attend « 3 000,00 € ».
   - **l'article 5 « Obligations des parties », imprimé aujourd'hui.** Il dit qu'« en cas de
     refus, de réduction, de caducité de l'accord […] les sommes demeurent dues par le client ».
     Le point 7 de la clause règle la hiérarchie, mais la juriste devrait dire si cet alinéa
     doit être neutralisé quand la condition est posée.
6. **Transitions d'état.** La saisie de l'accord écrit, du refus et de la renonciation doit
   faire avancer `etat_condition_suspensive`. Le rappel à J-7 doit être planifié par une
   alerte. Ces deux points touchent une forme de job ou le worker : appliquer la règle de la
   fenêtre app/worker, qui veut qu'on ajoute avant de lire.
7. **Partners** : l'effet de la condition ne part qu'avec la v4 (`financement.etape`). Rien
   n'est à émettre dans cette tâche.

Sha de tête de `opco/int-t65-a-condition-suspensive` : `adc182ed40d15ec15c5937e46a7eb61d212c8326`
