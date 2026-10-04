# RAPPORT — Lot OPCO A7d : effectif INSEE et enveloppe annuelle consommée

Branche de code : `opco/a7d-effectif-enveloppe` (partie de `origin/main` à `7b7dd14a`).
Ce rapport est sur la branche séparée `rapports/opco-a7d-effectif-enveloppe`.
Ce lot traite les manques n°3 (effectif) et n°4 (consommation annuelle, barème de l'année) de
`CRITIQUE.md` (branche `relectures/opco-critique-finale`).

## Ce qui a été fait

### 1. Effectif relevé à l'INSEE (manque n°3)
- **Source** : le client existant de l'API Recherche d'entreprises
  (`src/features/dossier-client/recherche-entreprises.ts`). J'y ai ajouté
  `rechercherTrancheEffectif(siren)`, qui lit `tranche_effectif_salarie` de l'unité légale. La fonction
  attend 3 s au plus, ne lève jamais d'exception et exige que le SIREN de la réponse soit celui demandé.
  Elle distingue « annuaire en panne » (`ok: false`) et « pas de tranche publiée » (`tranche: null`).
  Le dépôt ne contient aucun code de prospection Sirene : seul le schéma Prisma en porte les colonnes.
- **Règle** : `src/server/qualiopi/crm/effectif-insee.ts`.
  - Table de correspondance **fermée** des 16 codes INSEE vers la borne basse de chaque tranche
    (NN→0, 00→0, 01→1, 02→3, 03→6, 11→10, 12→20, 21→50, 22→100, 31→200, 32→250, 41→500, 42→1000,
    51→2000, 52→5000, 53→10000). Source : INSEE, Sirene, variable `trancheEffectifsUniteLegale`
    (https://www.sirene.fr/sirene/public/variable/tefen). Un code hors table n'est pas deviné.
  - Pourquoi la borne basse ne trompe pas sur le seuil de 50 (expliqué en commentaire) : la tranche
    « 20-49 » donne 20, donc moins de 50, même pour une entreprise de 49 salariés. La tranche « 50-99 »
    donne 50, donc au moins 50. **Seule la tranche « 10-19 » (→ 10) est à cheval sur un seuil OPCO, celui
    de 11** : elle classe en « moins de 11 » une entreprise de 11 à 19 salariés, c'est-à-dire du côté le
    plus favorable au client. Une saisie corrige.
  - L'effectif n'est écrit que s'il est **vide ou déjà de source `insee`**. Une saisie n'est jamais
    écrasée, pas plus qu'un effectif ancien sans source (présumé saisi). La garde est vérifiée **deux
    fois** : une fois avant l'appel, une fois dans l'écriture (`updateMany` filtré). Une saisie posée
    pendant les 3 s de l'appel est donc protégée.
  - `effectifReleveLe` reçoit le jour civil de Paris.
- **Branchements** (`src/server/actions/qualiopi/clients.ts`) :
  - `createClientAction` lance le relevé **après** la création, si la fiche a un SIREN. Il est enveloppé
    dans un `.catch` : une panne ou une exception ne bloque jamais la création. Un relevé posé est tracé
    dans le journal (`qualiopi.client.effectif_insee`).
  - Nouvelle action `rafraichirEffectifInseeAction` et son formulaire serveur
    `rafraichirEffectifInseeFormAction` (bouton « Rafraîchir depuis l'INSEE » sur la fiche). Le message
    de retour est scellé.
  - Aucun fait Partners n'est émis : les trois champs d'effectif ne font pas partie de la charge
    `client.mis_a_jour`.

### 2. Consommation annuelle (manque n°4)
- `src/server/qualiopi/financements/consommation-opco.ts` :
  - `consommationOpcoAnnee(clientId, opco, annee)` renvoie `{ annee, accordeCents, enCoursCents }`.
    `consommationOpcoParAnnee` fait la même chose pour plusieurs années en une seule requête.
  - **Accordé** : somme de `montantAccordeCents` des dossiers `accord_recu|facture|paiement_recu|clos`.
    **En cours** : somme de `montantDemandeCents` des dossiers `envoye`. Les deux sont rendus séparément.
    Seuls les dossiers de type `opco` et `mixte` comptent.
  - **Année civile (Paris)** : celle du début de la session liée. À défaut : la date de l'accord écrit,
    puis celle du clic d'accord, puis du dépôt, puis de l'envoi, puis de la création du dossier.
  - **OPCO du dossier** : `financeurNom` s'il désigne un OPCO sans ambiguïté (`suggererOpco`), sinon
    `opcoDuClient` du client.
  - La lecture résiste à l'absence de base : en cas d'échec elle renvoie `null` (« inconnue »), jamais
    zéro ni une exception.
- **Estimation** (`src/server/qualiopi/crm/devis.ts` `estimateOpcoCoverage`). L'enveloppe restante est,
  par ordre de priorité :
  1. celle saisie sur le devis ;
  2. sinon, la base annuelle moins le consommé, **bornée à 0**. La base annuelle est l'enveloppe de la
     fiche client, à défaut le plafond du barème applicable ;
  3. si la consommation est inconnue, le comportement antérieur.
  - Quand une consommation a été déduite, une phrase s'ajoute à l'avertissement : « Enveloppe annuelle
    AAAA diminuée de X € déjà pris en charge par l'OPCO pour ce client (Y € accordés, Z € demandés en
    cours) : il reste W €. »
  - Nouvelle sortie `consommationDeduiteCents`.
- `createDevisAction` lit l'OPCO par `opcoDuClient`, et non plus `client.opcoIdentifie`.

### 3. Barème de l'année
- `dateDeReferenceDevis` : date de début **prévue** de la session, à défaut date de validité du devis,
  à défaut date du jour. Cette date sert d'`asOf` pour `estimateOpcoCoverage`, et son année (Paris) est
  celle de la consommation lue.
- À la création d'un devis, aucune session n'existe encore. J'ai donc ajouté un champ facultatif
  `dateDebutSessionPrevue` (AAAA-MM-JJ) au schéma, et le champ « Début prévu de la session
  (optionnel) » au formulaire `DevisForm` dans les champs OPCO.

### 4. Fiche client (`qualiopi/clients/[id]`)
- Un bloc en lecture seule « Déjà pris en charge par l'OPCO (nom) » affiche l'année en cours et la
  précédente, avec l'accordé et l'en cours (composant serveur `DejaPrisEnChargeOpco`, aucun JavaScript).
  Si l'OPCO n'est pas déterminé, le bloc le dit.
- Une case « Effectif » affiche la valeur, sa provenance (relevé INSEE ou saisie) et sa date. Le bouton
  « Rafraîchir depuis l'INSEE » apparaît seulement pour les utilisateurs qui ont le droit d'écrire, si
  la fiche a un SIREN et que l'effectif n'a pas été saisi.
- L'annuaire n'est **jamais** interrogé à l'affichage de la page. Rien n'est affiché pour un particulier.

## Fichiers
Nouveaux :
- `src/server/qualiopi/crm/effectif-insee.ts`, test `src/server/qualiopi/crm/__tests__/effectif-insee.spec.ts`
- `src/server/qualiopi/financements/consommation-opco.ts`, test `src/server/qualiopi/financements/__tests__/consommation-opco.spec.ts`
- `src/components/admin/qualiopi/DejaPrisEnChargeOpco.tsx`
- `src/server/actions/qualiopi/__tests__/l-estimation-du-devis-deduit-ce-que-l-opco-a-deja-pris.spec.ts`
- `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/clients/[id]/__tests__/la-fiche-dit-ce-que-l-opco-a-deja-pris-en-charge.spec.tsx`

Modifiés :
- `src/features/dossier-client/recherche-entreprises.ts` (ajout de `rechercherTrancheEffectif`)
- `src/server/actions/qualiopi/clients.ts` (+ `clients.spec.ts`)
- `src/server/qualiopi/crm/devis.ts` (+ `devis-opco.spec.ts`)
- `src/server/actions/qualiopi/devis.ts`, `src/components/admin/qualiopi/DevisForm.tsx`
- `src/app/[locale]/(admin)/[adminPrefix]/qualiopi/clients/[id]/page.tsx`
- Les trois tests de rendu de la fiche reçoivent `rafraichirEffectifInseeFormAction` dans leur doublure
  de `@/server/actions/qualiopi/clients`. Sans cela ils échouent sur un export absent : la page importe
  cette action.

Aucune migration : les colonnes `effectif`, `effectifSource` et `effectifReleveLe` existent déjà (A1).

## ROUGE / VERT (mesurés)
| Témoin | ROUGE | VERT |
|---|---|---|
| `effectif-insee.spec.ts` (tranche → borne basse, saisie jamais écrasée, garde pendant l'appel, annuaire en panne, jour de Paris) | module absent, le fichier ne se charge pas | 19/19 |
| `clients.spec.ts` (création OK si l'annuaire lève une exception, traçage, pas d'appel sans SIREN, action de rafraîchissement) | 4 échecs sur l'ancien `clients.ts` | 39/39 |
| `consommation-opco.spec.ts` (décembre et janvier dans deux années différentes, 31/12 23h30 UTC compté en N+1, refusé, CPF et autre OPCO ignorés, centimes entiers, échec de lecture → `null`) | module absent | 12/12 |
| `devis-opco.spec.ts` (plafond − consommé, jamais négatif, enveloppe saisie prioritaire, enveloppe de la fiche, phrase ajoutée, `dateDeReferenceDevis`) | 5 puis 3 échecs | 29/29 |
| `l-estimation-du-devis-deduit…spec.ts` (`asOf` = début de session, année 2027, OPCO typé avant l'ancien champ) | 3 échecs sur l'ancien `devis.ts` | 5/5 |
| `la-fiche-dit…spec.tsx` (bloc, deux années, euros, bouton INSEE, saisie sans bouton, particulier) | 4 échecs sur l'ancienne page | 5/5 |

- `pnpm tsc --noEmit -p .` : propre.
- eslint et prettier lancés à la main sur tous les fichiers touchés.
- Suites demandées (`src/server/qualiopi/ src/server/actions/qualiopi/ tests/unit/ci/
  src/components/admin/qualiopi/__tests__/`, plus la fiche client et `src/features/dossier-client/`) :
  711 fichiers, 9 248 tests verts (+1 todo). Le premier passage avait 1 rouge : `tests/unit/ci/cliquet-ecrivains-client.spec.ts`. Ce cliquet liste chaque écrivain de `Client` par identité, et le nouvel écrivain `effectif-insee.ts (rafraichirEffectifInsee)` y est bien classé « aucun champ transmis ». Ligne ajoutée à la liste attendue, cliquet relancé : 18/18 avec `aucun-ecrivain-de-client-hors-de-la-porte-unique`.

## Limites et choix à valider
- **Ce qui est déduit** : le consommé déduit de l'enveloppe = accordé **+ en cours**. C'est un choix de
  prudence : une demande déposée consommera l'enveloppe si elle est accordée. L'écran les affiche
  séparément.
- **Montant manquant** : un dossier accordé sans `montantAccordeCents` saisi compte pour son montant
  demandé, toujours par prudence. La consigne disait « somme des montantAccordeCents » ; c'est un écart
  assumé, réversible en une ligne.
- **Base annuelle** : si la fiche porte `opcoEnveloppeAnnuelleCents`, c'est elle qui sert de plafond, pas
  celui du barème, comme avant ce lot. Cela suppose que cette valeur est bien le plafond ANNUEL, et non
  un reste déjà diminué. Aujourd'hui aucun formulaire ne la saisit (critique, manque n°4).
- **Dossiers mixtes** : `montantAccordeCents` y est compté entièrement pour l'OPCO.
- **Date de session** : la « session liée au devis » n'existe pas à la création du devis. C'est donc la
  date prévue saisie qui fait foi. L'estimation n'est pas recalculée plus tard, quand une session réelle
  est rattachée (aucun recalcul n'existe aujourd'hui).
- **Création du client** : le relevé INSEE ajoute jusqu'à 3 s au délai de réponse de la création quand
  la fiche a un SIREN. Il n'est pas lancé pour les autres portes de création (porte Partners, rencontre
  Calendly) ni lors de « C'est elle » (SIREN confirmé après coup) : le bouton de la fiche couvre ces cas.
- **Code NN** (unité non employeuse) → 0, selon la définition INSEE.
- **Conflit attendu** avec `opco/a7a-un-seul-opco` sur `src/server/actions/qualiopi/devis.ts` : les deux
  branches remplacent `client.opcoIdentifie` par `opcoDuClient(client)`. La résolution est triviale.
- **Fenêtre app/worker** : aucune énumération, migration ou forme de tâche n'est touchée.
- Les phrases « jusqu'à 0 € de reste à charge » et « à 100 % » n'ont pas été touchées (vérifié par grep
  sur le diff).

## Corps de PR proposé

**Titre** : feat(opco): effectif relevé à l'INSEE et enveloppe OPCO diminuée de ce qui a déjà été pris en charge (A7d)

**Résumé**
- Effectif du client = borne basse de la tranche INSEE. Il est relevé à la création de la fiche et par
  le bouton « Rafraîchir depuis l'INSEE ». Une saisie n'est jamais écrasée, et une panne de l'annuaire
  ne bloque rien.
- `consommationOpcoAnnee` : ce que l'OPCO a accordé ou a en cours pour un client, par année civile de
  la session.
- Estimation du devis : barème de l'année de la session (`asOf`), enveloppe = plafond − consommé (jamais
  négative). Une phrase d'avertissement le signale.
- Fiche client : bloc en lecture seule « Déjà pris en charge par l'OPCO » (année en cours et précédente),
  effectif avec sa provenance.

**Tests** : 6 fichiers de témoins, ROUGE puis VERT mesurés ; `tsc` propre ; suites qualiopi et CI vertes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01HvuTnAusxjWN9Cnq8PEYS9

## Sha de tête
Branche `opco/a7d-effectif-enveloppe` : `65ec98fd9fcabd9b63b51cc7e941c4aba0396233`
