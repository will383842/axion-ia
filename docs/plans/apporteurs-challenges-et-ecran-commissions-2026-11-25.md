# Apporteurs : challenges facultatifs (prime exceptionnelle de décembre 2026)

Plan de conception du 25 novembre 2026, **corrigé le même jour** après la relecture « À CORRIGER »
de la PR #2261. **Aucun code produit dans cette PR** : ce fichier est le seul livrable.
Lecture du code faite sur `origin/main` au commit `ef5cc10d`.

> **Coordination (arbitrage pris).** L'écran « Mes commissions » est décrit **une seule fois**, dans
> le plan de la PR #2259 (`docs/plans/apporteurs-espace-commissions-2026-11-25.md`, lots EC). Ce plan
> ne garde **que les challenges**. Tout ce que la première version disait de l'écran (totaux, frise,
> états, pièces PDF, textes, accessibilité) est retiré d'ici ; ce qui y était utile a été repris dans
> #2259. Une prime validée devient une ligne de commission comme les autres : elle s'affiche dans
> « Mes commissions » par les règles de #2259, **sans section, encart ni compteur « challenge »** sur
> cette page.
>
> Le nom du fichier est conservé pour ne pas casser les renvois déjà écrits.

## Ce qu'il faut retenir en une page

1. **Les règles du dirigeant priment sur tout le reste du plan.** Un challenge est facultatif. Il n'a
   ni classement, ni relance, ni compte à rebours, ni compteur de progression. L'espace de
   l'apporteur montre **la règle et le règlement**, rien d'autre. Un seul message d'annonce, relu
   mot pour mot par le dirigeant.
2. **Le challenge de décembre 2026** : une prime de **2 000 € HT** pour **10 Journées IA facturées**
   entre le **1er et le 31 décembre 2026** (jours civils de Paris) à des entreprises attribuées à
   l'apporteur. **Aucun chiffre d'affaires n'est exigé.**
3. **Aucune prime sans SIREN actif**, contrôlé au clic de validation, hors cache. Registre muet ou
   « introuvable » = refus, jamais prime par défaut. Validation **réservée à `super_admin`** (nouvel
   acte `valider_prime`).
4. **La prime suit le circuit des commissions** une fois validée : autofacture `AXI-APP`, TVA selon le
   régime de l'apporteur (jamais d'exonération inventée), vigilance, reprise par avoir.
5. **Manque bloquant corrigé** : rien ne dit aujourd'hui qu'une vente est une « Journée IA ». Le plan
   la reconnaît sur les **lignes du devis** (`offreTierId = "journee-ia"`), crée l'offre dans un lot
   dédié, et garde une décision manuelle motivée pour les factures sans devis.
6. **Écart signalé avec la règle de commission du dirigeant** : la Journée IA doit rapporter 500 € au
   prorata du prix payé (sur 1 490 € HT). Le code n'a aucun palier Journée IA : selon l'activité
   saisie, elle rapporte 30 % (`audit`) ou reste « à qualifier » (`formation`). Lot d'alignement
   « argent » prévu (lot 2).

---

## 1. État des lieux du code (vérifié sur `ef5cc10d`)

Abréviation : **AR/** = `src/features/apporteurs-reseau/`. **ESP/** = `src/app/apporteur/dossier/[id]/[jeton]/`.

### 1.1 La Journée IA

- `JOURNEE_IA_TIER`, `src/content/pricing.ts` (~l. 463-480) : identifiant `journee-ia`, 1 490 € HT,
  prix ferme. Commentaire : « Aucune commission tant que Williams ne l'a pas tranchée ».
- **Aucune offre** de `prisma/seeds/qualiopi/offres.ts` ne porte `tierId = "journee-ia"` (les seules
  valeurs sont `intervention-*`).
- Une facture d'acompte n'a qu'une ligne « Acompte de N % — devis … », **sans `offreTierId`**
  (`src/server/qualiopi/financements/facture-libre-pur.ts:233-240`). Une facture sans devis n'a que
  des lignes libres.
- Conséquence : la Journée IA **ne se reconnaît que sur les lignes du devis** de la commande, et
  seulement si le devis porte l'offre.

### 1.2 La commission de la Journée IA aujourd'hui

- `calculerCommission`, `AR/regles.ts:338-390`. Paliers de formation (`:259-302`) : aucun
  `journee-ia`. `TAUX_BPS` (`:306`) : `audit` 30 %.
- Dans `etapeCommissions`, la commission est calculée avec `palier: null`
  (`AR/passage-quotidien.ts:762-765`) à partir de `FactureFormation.activite`, saisie à la main :
  - `audit` → 30 % du HT, soit 447 € pour une Journée à 1 490 € ;
  - `formation` → « à qualifier » ;
  - non renseignée → « à qualifier ».
- **Règle du dirigeant** : 500 € par Journée IA à 1 490 € HT, au prorata du prix payé, reprise si la
  Journée est remboursée en argent. **Le code ne l'applique pas.** Lot 2.

### 1.3 Ce que le challenge réutilise

| Sujet                | Où                                                                                                                                          | Ce qui est réutilisé                                                                                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Commande soldée      | `AR/commandes.ts:60-100` (`commandesSoldees`)                                                                                               | « Payée en entier ». ⚠️ Sans `totauxDevis`, un acompte payé seul compte comme soldé : le passer **toujours**.                                                                                                                                                |
| Net d'une commande   | `AR/commandes.ts:39` (`netDeLaCommande`)                                                                                                    | Avoirs déduits.                                                                                                                                                                                                                                              |
| Attributaire         | `AR/passage-quotidien.ts:190` (`presentationPourEtablissement`) puis `AR/etablissement-presentation.ts:84-105` (`attributaireDeLaCommande`) | **Lit les présentations de tous les apporteurs** sur le SIREN. Utilisable côté serveur et console seulement, jamais dans l'espace.                                                                                                                           |
| Jour civil de Paris  | `AR/autofacture-donnees.ts:307` (`jourParis`)                                                                                               | Rend `AAAA-MM-JJ`. ⚠️ **Ne pas utiliser** `minuitParisUtc` (`src/server/qualiopi/devis/date-validite.ts:10-19`) : il rend minuit **UTC** du jour de Paris, pas l'instant de minuit à Paris. Ni `finDeJourneeParis` (`:38`) : il s'arrête à 23 h 59 min 59 s. |
| Vigilance            | `AR/commissions.ts:250` (`statutApresVigilance`), `demanderVigilance`                                                                       | Même enchaînement que `AR/passage-quotidien.ts:777-789`.                                                                                                                                                                                                     |
| Registre             | `AR/verification.ts:187-195`                                                                                                                | SIRET de l'établissement s'il existe, sinon SIREN ; « indisponible » et « introuvable » bloquent. La facturation (`AR/facturation.ts:533-541`, `:637-642`) ne lit que le SIREN et met en cache une heure : **ne pas la recopier**.                           |
| Annulation           | `AR/ajustement.ts:254-266` (`annulerCommission`)                                                                                            | Refuse une ligne déjà facturée (`autofactureNumero`). L'autofacture part au passage horaire suivant (`AR/facturation.ts:742`) : la voie normale d'une reprise est donc `enregistrerReprise` (`AR/resiliation.ts:147`), avec avoir.                           |
| TVA de l'autofacture | `AR/autofacture-donnees.ts:56-62` (`regimeHonorairesApporteur`), `:383-393` (`donneesManquantesAutofacture`)                                | Assujetti → TVA 20 % ; franchise → « TVA non applicable, art. 293 B du CGI ». Régime inconnu → l'autofacture **attend** (manque « régime de TVA »). Aucune exonération n'est produite par défaut.                                                            |
| Habilitations        | `src/server/auth/habilitations.ts:291`                                                                                                      | `facturer: ["super_admin", "admin"]`. Il n'existe aucun acte réservé à `super_admin` seul pour l'argent du réseau.                                                                                                                                           |
| E-mails              | `AR/envois.ts:156` (`envoyer`), `AR/apercu-envoi.ts` (`apercu`, `server-only`, jamais chargé par le worker, depuis #2250)                   | Un nouveau gabarit s'inscrit à quatre endroits et porte un `gabaritRepli` (AGENTS.md, lot S3).                                                                                                                                                               |
| Poids                | `package.json:271`                                                                                                                          | Compartiment « Routes /apporteur/dossier … — 25 KB cumulé ».                                                                                                                                                                                                 |
| Ligne de commission  | `prisma/schema.prisma:16655` (`CommissionApporteur`), unicité `@@unique([factureId, apporteurId, parrainage])`                              | La prime y entre comme une ligne de genre nouveau.                                                                                                                                                                                                           |

### 1.4 Une entreprise, un seul apporteur commissionné ; le parrainage à part

- Chaque Journée compte pour **un seul** apporteur : l'attributaire de la commande. Jamais de partage.
- Le parrainage (10 % des commissions du filleul sur les commandes signées dans les 6 mois après la
  signature du contrat du filleul, un seul niveau, payé par Axion IA en plus) **n'est pas une seconde
  commission sur l'entreprise** : c'est une part payée au parrain sur la commission de son filleul.
  La base le distingue par la colonne `parrainage` (`true`) de `commissions_apporteur`, qui fait
  partie de la clé d'unicité. Détail et affichage : plan #2259.
- La prime de challenge **ne donne lieu à aucune part de parrainage**, et les Journées du filleul ne
  comptent pas pour le parrain.
- ⚠️ Le code attribue par **établissement** (contrat art. 2.6) : deux SIRET d'un même SIREN peuvent
  revenir à deux apporteurs. Cela heurte la règle « une entreprise, un seul apporteur ». Décision D-1.

---

## 2. Modèle de données

Une migration additive : `prisma/migrations/2026MMJJHHMMSS_apporteurs_challenges/`
(`migration.sql` + `rollback.sql`).

Conventions :

- aucune clé étrangère vers les tables existantes ;
- aucune valeur ajoutée à une énumération existante ;
- états en `VARCHAR` + `CHECK` ;
- tout est nullable ou porte un défaut ;
- **aucune donnée d'exemple** dans la migration de production : le challenge de décembre est créé
  depuis la console.

### 2.1 `challenges_apporteur` (modèle `ChallengeApporteur`)

`/// rgpd: technique — règle, période, seuil et montant d'un challenge ; identifiant de l'administrateur auteur ; aucune donnée d'apporteur`

| Champ                                                      | Type                                                                         | Rôle                                                                                             |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `id`                                                       | uuid, clé                                                                    |                                                                                                  |
| `titre`                                                    | varchar(120)                                                                 | « Prime exceptionnelle de décembre 2026 » (D-5)                                                  |
| `debut_le`, `fin_le`                                       | date                                                                         | Jours civils **de Paris**, bornes incluses.                                                      |
| `paiement_jusqu_au`                                        | date, nullable                                                               | Dernier jour où un paiement client permet le versement (D-3). Écrit dans le règlement seulement. |
| `produit`                                                  | varchar(40), `CHECK IN ('journee-ia')`                                       | Liste fermée.                                                                                    |
| `critere`                                                  | varchar(40), `CHECK IN ('facturees_dans_la_periode')`                        | La condition d'obtention : **facturées** dans la période.                                        |
| `seuil`                                                    | int, `CHECK (seuil BETWEEN 1 AND 999)`                                       | 10                                                                                               |
| `prime_ht_cents`                                           | int, `CHECK (> 0)`                                                           | 200 000                                                                                          |
| `reglement`                                                | text                                                                         | Texte du règlement publié.                                                                       |
| `reglement_sha256`                                         | char(64), nullable                                                           | Empreinte posée à la publication.                                                                |
| `annonce_texte`                                            | text, nullable                                                               | Texte du message unique, relu.                                                                   |
| `annonce_envoyee_at`, `annonce_envoyee_par`                | timestamptz, uuid, nullables                                                 | Posés une seule fois.                                                                            |
| `statut`                                                   | varchar(20), défaut `brouillon`, `CHECK IN ('brouillon','publie','archive')` |                                                                                                  |
| `publie_at`, `publie_par`, `cree_at`, `maj_at`, `cree_par` |                                                                              |                                                                                                  |

Contraintes : `fin_le >= debut_le` ; `paiement_jusqu_au IS NULL OR paiement_jusqu_au >= fin_le`.

**Déclencheur d'immutabilité** (SQL brut, `prisma/objets-sql-bruts.ts`) : après publication, refus de
toute modification de `titre`, `debut_le`, `fin_le`, `paiement_jusqu_au`, `produit`, `critere`,
`seuil`, `prime_ht_cents`, `reglement`, `reglement_sha256`, `publie_at`. Restent modifiables :
`statut` (vers `archive`), `annonce_*` (de nul vers une valeur, jamais l'inverse), `maj_at`.

Aucune colonne « apporteurs concernés » ni seuil individuel : mêmes conditions pour tous.

### 2.2 `challenges_primes` (modèle `ChallengePrime`)

`/// rgpd: dossier-client` — lue par `src/lib/rgpd-reseau-apporteur.ts`, traitée par `rgpd-erase.ts`.

| Champ                                | Type                                                                                           | Rôle                                                                                        |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `id`                                 | uuid, clé                                                                                      | Sert de `factureId` à la ligne de commission.                                               |
| `challenge_id`                       | uuid, clé étrangère vers `challenges_apporteur` (`ON DELETE RESTRICT`)                         | Deux tables nouvelles : sans risque.                                                        |
| `apporteur_id`                       | uuid, sans clé étrangère                                                                       |                                                                                             |
| `statut`                             | varchar(20), `CHECK IN ('a_valider','en_suspens','validee','refusee','a_reprendre','reprise')` | `en_suspens` est **réversible** (correction I7).                                            |
| `atteint_le`                         | date, nullable                                                                                 | Jour de Paris de la 10e Journée facturée.                                                   |
| `preuves`                            | jsonb                                                                                          | Photographie au constat : `{ factureId, numero, jourEmission, journees, payeeEnEntier }[]`. |
| `decidee_par`, `decidee_at`, `motif` | uuid, timestamptz, varchar(300), nullables                                                     |                                                                                             |
| `commission_id`                      | uuid, nullable, sans clé étrangère                                                             |                                                                                             |
| `cree_at`, `maj_at`                  |                                                                                                |                                                                                             |

Unicité `(challenge_id, apporteur_id)`. Le constat **met à jour** la ligne existante (`upsert`), il
n'en insère jamais une seconde. Transitions :

- `a_valider` ↔ `en_suspens` : le compte passe sous le seuil (avoir, annulation), puis le retrouve
  (une commande « à attribuer » tranchée plus tard). Jamais d'e-mail.
- `a_valider` → `validee` ou `refusee` : geste de `super_admin` seulement.
- `validee` → `a_reprendre` → `reprise` : remboursement d'une Journée qui fait retomber le compte sous
  10, confirmé à la main.
- `refusee` est final, sauf nouveau geste motivé de `super_admin` (retour `a_valider`, journalisé).

### 2.3 `challenges_factures_decisions` (modèle `ChallengeFactureDecision`)

`/// rgpd: technique — identifiant de facture, décision et administrateur auteur ; aucun nom, e-mail ni téléphone`

Clé `(challenge_id, facture_id)`. Champs : `journees` (int, 0 à 99 ; 0 = ne compte pas), `motif`
(obligatoire), `decidee_par`, `decidee_at`. Sert aux factures sans devis ou sans offre reconnue (D-4).
Une décision vise la facture, pas une personne.

### 2.4 `challenges_annonces` (modèle `ChallengeAnnonce`)

`/// rgpd: dossier-client` — corrigé : la table porte `apporteur_id`, elle suit la personne.

Clé `(challenge_id, apporteur_id)`, champ `envoyee_at`. Preuve et verrou : l'insertion échoue sur la
clé si un second envoi est tenté.

### 2.5 Retour arrière

`rollback.sql` sans `DROP` : retrait du déclencheur, puis `ALTER TABLE … RENAME TO …_archive` pour les
quatre tables. Avant : éteindre les interrupteurs du § 6. Les lignes de commission
`prime_challenge` déjà créées restent : ce sont des écritures comptables.

---

## 3. Règles pures

Fichier : `AR/challenge-regles.ts`. Aucune lecture de base, aucune horloge implicite.

### 3.1 La période, en jours civils de Paris

```
dansLaPeriode(emiseAt, debutLe, finLe) =
  debutLe <= jourParis(emiseAt) <= finLe      // chaînes « AAAA-MM-JJ »
```

Comparaison de **jours civils**, jamais d'instants. Ni `minuitParisUtc`, ni `finDeJourneeParis`, ni
`ajouterJours`.

### 3.2 Ce qu'est « une Journée IA facturée »

Entrée : les commandes telles que `AR/commandes.ts` les regroupe (factures d'un devis + avoirs).

1. **Reconnaissance sur le devis** : `journees` = somme des `quantite` des lignes du devis dont
   `offreTierId = "journee-ia"`. Les lignes de facture ne sont pas lues pour reconnaître le produit
   (un acompte n'en porte pas).
2. **Sans devis, ou devis sans offre reconnue** : seule une décision de
   `challenges_factures_decisions` fait compter la facture (D-4). Sans décision : ne compte pas.
3. **Date de facturation** = `jourParis(emiseAt)` de la **première facture non annulée** (ni
   brouillon) de la commande. Un acompte du 30 décembre et un solde du 15 janvier : la commande compte
   pour décembre.
4. **Net** : si le net de la commande (`netDeLaCommande`) est ≤ 0, elle ne compte plus. Un avoir
   partiel ne retire pas de Journée ; un avoir qui annule une ligne Journée IA en retire la quantité.
5. **Attributaire** : `presentationPourEtablissement` à la date de commande. « À attribuer » non
   tranché → ne compte pour personne ; compte dès la décision, à sa date d'origine.
6. **Payée en entier** (pour le versement, D-2) : la commande figure dans `commandesSoldees` **avec**
   `totauxDevis` ; et aucun `Payment` de ses factures n'est `refunded` sans avoir correspondant.

### 3.3 Le constat (côté serveur seulement)

```
facturees(apporteur) = Σ journees des commandes de l'attributaire, dansLaPeriode, net > 0
seuilAtteint         = facturees >= seuil
payeesEnEntier       = Σ journees des mêmes commandes payées en entier
                       (et dernier paiement <= paiement_jusqu_au s'il existe)
pretAVerser          = seuilAtteint ET payeesEnEntier >= seuil     // recommandation D-2
```

Ces nombres ne sortent **jamais** vers l'espace de l'apporteur. Ils servent au constat et à la
console (§ 4.3).

### 3.4 Conditions de validation (toutes)

| Condition                                                                                                                             | Source                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Challenge `publie`                                                                                                                    | `challenges_apporteur.statut`                              |
| `seuilAtteint` (et `pretAVerser` si D-2 est accepté)                                                                                  | § 3.3                                                      |
| Contrat en cours à la date de la 10e Journée facturée (D-6)                                                                           | `ApporteurReseau.statut` et dates                          |
| SIREN présent et valide sur la fiche                                                                                                  | `ApporteurReseau.siren`                                    |
| Entreprise **active** au registre, lu **au clic**, hors cache, règle de `AR/verification.ts:187-195` (SIRET s'il existe, sinon SIREN) | registre ; « indisponible » ou « introuvable » = **refus** |
| Aucune contestation de client en cours sur les commandes retenues                                                                     | `litigeDepuis` des commissions liées                       |
| Geste de `super_admin`                                                                                                                | acte `valider_prime`                                       |

### 3.5 Cas limites (un test par ligne)

| Cas                                                                                              | Règle                                                                                                         |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Facture émise le 1er décembre à 0 h 30, heure de Paris (30/11 23 h 30 UTC)                       | **Compte.**                                                                                                   |
| Facture émise le 31 décembre à 23 h 59 min 59,9 s, heure de Paris (31/12 22 h 59 min 59,9 s UTC) | **Compte.**                                                                                                   |
| Facture émise le 1er janvier à 0 h 00, heure de Paris (31/12 23 h 00 UTC)                        | **Ne compte pas.**                                                                                            |
| Brouillon le 31, émise le 2 janvier                                                              | Ne compte pas : c'est l'émission qui date.                                                                    |
| Acompte en décembre, solde en janvier                                                            | Compte pour décembre (première facture).                                                                      |
| Acompte seul payé, solde non facturé                                                             | Facturée ; **pas** payée en entier (`totauxDevis`).                                                           |
| Facture sans devis                                                                               | Ne compte que sur décision manuelle motivée.                                                                  |
| Une commande, 3 Journées                                                                         | Compte pour 3.                                                                                                |
| Commande mixte (Journée IA + autre prestation)                                                   | Seule la quantité Journée IA compte.                                                                          |
| Journée à prix réduit, net > 0                                                                   | Compte pour 1 (D-7). Journée offerte (0 €) : ne compte pas.                                                   |
| Avoir total ou facture annulée                                                                   | Ne compte plus.                                                                                               |
| `Payment` `refunded` sans avoir                                                                  | Ne compte pas comme payée.                                                                                    |
| Repasse sous le seuil avant validation                                                           | `en_suspens`, sans e-mail ; retour `a_valider` si le seuil revient.                                           |
| Remboursement après validation, ligne **non** encore facturée                                    | `annulerCommission` ; prime `reprise`.                                                                        |
| Remboursement après autofacture (cas normal : l'autofacture part dans l'heure)                   | Prime `a_reprendre` ; le dirigeant confirme ; `enregistrerReprise` avec avoir d'autofacture. Reprise entière. |
| 11 Journées, une remboursée                                                                      | Reste 10 : prime maintenue.                                                                                   |
| Deux apporteurs sur un même SIREN                                                                | Chaque commande compte pour son seul attributaire. Voir D-1.                                                  |
| Parrain                                                                                          | Les Journées du filleul ne comptent pas pour lui ; aucune part de parrainage sur la prime.                    |
| 20 Journées                                                                                      | Une seule prime (D-8).                                                                                        |
| 10 Journées chez un seul client                                                                  | Comptent (D-9).                                                                                               |
| Apporteur résilié après la 10e Journée                                                           | Prime due si le contrat était en cours à cette date (D-6).                                                    |
| Entreprise de l'apporteur radiée                                                                 | Validation refusée. Après validation : le circuit existant bloque l'autofacture.                              |
| Régime de TVA inconnu                                                                            | Validation possible, mais l'autofacture attend la donnée (manque existant). Jamais « sans TVA ».              |
| Seuil de vigilance de 5 000 €                                                                    | La prime entre dans le cumul ; `demanderVigilance` si `statutApresVigilance` rend `demander`.                 |
| Challenge modifié après publication                                                              | Interdit par la base et par l'action.                                                                         |
| Deux challenges publiés du même produit qui se chevauchent                                       | Refusé à la publication.                                                                                      |

### 3.6 Entrée de la prime dans le circuit des commissions

À la validation, **dans une transaction** : la prime passe `validee` et une ligne
`CommissionApporteur` est créée.

| Champ                          | Valeur                                                                    |
| ------------------------------ | ------------------------------------------------------------------------- |
| `factureId`                    | `challenges_primes.id` (l'unicité empêche un doublon)                     |
| `presentationId`               | nul                                                                       |
| `parrainage`                   | `false`                                                                   |
| `activite`                     | `prime_challenge` (15 caractères sur 20)                                  |
| `palier`                       | `challenge:<id>` (46 sur 60) — jamais affiché à l'apporteur               |
| `factureHtCents`               | 0                                                                         |
| `montantCents`                 | `prime_ht_cents` (HT ; la TVA s'ajoute selon le régime sur l'autofacture) |
| `statut`                       | `statutApresVigilance` ; puis `demanderVigilance` si besoin               |
| `prestationRealiseeAt`, `…Par` | date de validation, `challenge`                                           |

**Fenêtre app/worker (AGENTS.md, règle symétrique).** Le worker doit savoir libeller
`prime_challenge` (lot 4) **avant** que la console puisse créer la première ligne (lot 7) : PR et
créneau distincts.

---

## 4. Écrans

### 4.1 Espace de l'apporteur : la règle, et rien d'autre

- **Encart** sur la page d'accueil (bloc « signé », `ESP/page.tsx`), visible seulement si un challenge
  est publié et que le jour de Paris est entre `debut_le` et `fin_le`. Texte intégral au § 9.2.
  **Aucun nombre personnel, aucune barre, aucun « où vous en êtes ».**
- **Page du règlement** : `ESP/challenge/reglement/page.tsx`. Texte publié, tel quel.
- La prime, **une fois validée**, apparaît comme une ligne de commission dans « Mes commissions »
  (plan #2259), libellée « Prime exceptionnelle de décembre 2026 ». Avant validation : rien.
- Composants serveur uniquement, zéro JavaScript client.
- Mêmes protections que #2259 § 2.5 : `force-dynamic`, `Cache-Control: no-store`,
  `Referrer-Policy: no-referrer`, `noindex`. Jeton faux, ancien jeton, statut non `signe`, mode
  restreint : écran neutre (pas d'encart, page du règlement en 404).
- Poids : compartiment « Routes /apporteur/dossier — 25 KB cumulé » (`package.json:271`) ; mesurer
  en octets après le lot 8.

**Supprimé de la première version** : la barre `<progress>` « 4 sur 10 », la phrase « 6 Journées IA
facturées en décembre, dont 4 payées en entier », tous les états de progression de l'encart, la
phrase sur les paiements reçus jusqu'au 31 mars 2027 (la date reste dans le règlement seulement), et
l'encart en haut de « Mes commissions ». Aucun interrupteur ne les ouvre plus.

### 4.2 Console : créer et publier

Route : `src/app/[locale]/(admin)/[adminPrefix]/apporteurs/challenges/`. Menu : groupe `apporteurs`
de `src/lib/admin-nav.ts`. Lecture : `gardePage("consultation")`. Création, modification,
publication, annonce : `sessionArgent()` (`facturer`). Chaque geste écrit au journal.

- **Liste** : Brouillons, En cours, À venir, Passés. Bandeau fixe (texte § 9.5).
- **Création** : titre, début, fin, dernier jour de paiement (facultatif), produit, critère (une
  valeur), seuil, prime HT, règlement (pré-rempli par le § 9.1). Contrôles : fin ≥ début ; seuil 1 à
  999 ; prime > 0 ; règlement non vide ; **filtre de formules de pression** (§ 5.3).
- **Publication** : écran de confirmation qui montre l'encart exact et le règlement, trois cases
  obligatoires (« J'ai relu la règle et le règlement. » ; « Je sais qu'ils ne pourront plus être
  modifiés. » ; « Les conditions sont les mêmes pour tous les apporteurs. »). Après publication, la
  page de modification n'existe plus.

### 4.3 Console : suivi et validation

- **Suivi** (onglet du challenge) : apporteurs qui ont au moins une Journée retenue, **par ordre
  alphabétique, sans rang ni export**. Pour chacun : factures retenues (numéro, jour d'émission,
  Journées, payée en entier ou non) et écartées avec la raison. Bouton « Corriger le nombre de
  Journées » (motif obligatoire, `facturer`).
- **Constat** : le passage quotidien met à jour `challenges_primes` (`a_valider` / `en_suspens`). Une
  seule alerte interne au dirigeant quand une ligne passe `a_valider` pour la première fois. **Aucun
  e-mail à l'apporteur.**
- **Validation** (onglet « Primes ») : les Journées retenues, puis chaque contrôle du § 3.4 en clair
  (« oui », « non », « inconnu »). Bouton « Valider la prime de 2 000 € HT » **désactivé** tant qu'un
  contrôle n'est pas « oui », raison écrite à côté. Visible et utilisable par `super_admin` seulement
  (acte `valider_prime`). Bouton « Ne pas valider » (motif obligatoire).
- **À reprendre** : primes versées dont le compte est retombé sous 10. « Reprendre la prime »
  (confirmation, `enregistrerReprise`) ou « Laisser » (motif). `super_admin` seulement.

### 4.4 Le message d'annonce, unique

Sur la fiche d'un challenge publié : bloc « Annonce ».

- Texte pré-rempli par le § 9.3, **relu mot pour mot** par le dirigeant. Il passe par
  `validerTexteLibre` et par le filtre de formules de pression.
- Parcours : « Aperçu » (`apercu()`, `AR/apercu-envoi.ts`) → « Envoyer à N apporteurs ».
- Destinataires : statut `signe`, non retirés.
- **Une fois par challenge, une fois par personne** : `annonce_envoyee_at` posé une fois ; une ligne
  par personne dans `challenges_annonces` (l'insertion échoue sur la clé). Le bouton disparaît après
  l'envoi.
- **Jamais renvoyé, aucune relance** : un apporteur qui signe après l'annonce ne reçoit rien ; il voit
  l'encart.
- Gabarit `apporteur-challenge-annonce`, inscrit aux quatre registres, avec `gabaritRepli` (§ 6,
  lot 6).

---

## 5. Sécurité, cloisonnement, garde-fous

### 5.1 Cloisonnement

1. L'espace **ne lit aucune donnée de challenge propre à l'apporteur** : seulement le challenge publié
   et son règlement. Il n'y a donc plus de `lireMonChallenge`. Plus de fuite possible par
   l'attribution.
2. L'attribution, qui lit les présentations d'autres apporteurs, ne tourne que dans le passage
   quotidien et la console, avec un `select` minimal (identifiant, `recueAt`, établissement).
3. Le type de vue de l'espace pour le challenge ne contient **aucun champ d'apporteur** (ni compte, ni
   statut de prime) : test de type.
4. La prime validée est lue par « Mes commissions » (#2259), qui filtre `apporteurId` du lien.

### 5.2 Tests

| Test                                                                    | Ce qu'il prouve                                                                                                                |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `ESP/challenge/l-espace-ne-montre-que-la-regle.spec.tsx`                | Jeu d'essai où A a 9 Journées et B 1 : le rendu de A ne contient aucun chiffre autre que ceux du règlement (10, 2 000, dates). |
| `ESP/challenge/le-challenge-est-reserve-aux-apporteurs-signes.spec.tsx` | Statuts non signés, mode restreint, jeton faux → pas d'encart, règlement en 404.                                               |
| `AR/__tests__/challenge-vue-espace-sans-donnee-apporteur.spec.ts`       | Le type de vue n'a aucun champ d'apporteur.                                                                                    |
| `AR/__tests__/une-journee-ne-compte-que-pour-l-attributaire.spec.ts`    | Deux apporteurs, même SIREN : la commande ne compte que pour l'attributaire.                                                   |
| `…/apporteurs/challenges/valider-prime-reserve-super-admin.spec.ts`     | `admin`, `editor`, `reader`… → refus de valider et de reprendre.                                                               |
| `…/apporteurs/challenges/les-ecritures-exigent-facturer.spec.ts`        | Création, publication, annonce : refus sans `facturer`.                                                                        |
| `tests/integration/apporteurs-challenges.spec.ts`                       | Déclencheur d'immutabilité ; unicité des annonces ; `upsert` du constat.                                                       |

### 5.3 Garde-fous du dirigeant, verrouillés par test

| Exigence                             | Verrou                                                                                                                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Facultatif                           | Le règlement le dit (§ 9.1, art. 2) ; aucun module de `manquement`, `resiliation`, `retrait`, `declaration-regles` n'importe les challenges.                           |
| Sans classement                      | Aucun champ de rang ni de nombre de participants ; suivi console trié par nom (test sur l'ordre) ; aucun export.                                                       |
| Sans relance                         | `passage-quotidien.ts` et les workers n'importent aucun envoi lié à un challenge ; le seul gabarit dont le nom contient `challenge` est `apporteur-challenge-annonce`. |
| Sans compte à rebours                | Aucune date de fin dans l'encart ; filtre de formules (ci-dessous).                                                                                                    |
| Sans compteur de progression         | Aucun `<progress>`, aucun « N sur M » dans `ESP/` (garde statique) ; type de vue sans compte.                                                                          |
| Un seul message                      | Second envoi refusé (base et action).                                                                                                                                  |
| Aucune prime sans SIREN actif        | Registre « inactif », « introuvable » ou « indisponible » → validation refusée.                                                                                        |
| Validation par le rôle le plus élevé | Acte `valider_prime` = `["super_admin"]`.                                                                                                                              |
| Mêmes conditions pour tous           | Test de schéma : aucun champ « apporteurs concernés » ni seuil individuel.                                                                                             |

**Filtre de formules de pression** (correction I1) : il vise des **formules**, pas des mots isolés,
pour ne pas rejeter le règlement lui-même (« aucun objectif », « aucun classement »). Liste :
« il vous reste », « plus que », « encore \d+ », « derniers jours », « dernière chance », « J-\d »,
« ne manquez pas », « dépêchez », « vous êtes à \d+ », « \d+ sur \d+ », « point d'exclamation ». Testé
sur les textes du § 9 (ils doivent passer) et sur des contre-exemples (ils doivent échouer).

---

## 6. Interrupteurs

Tous éteints par défaut, valeur exacte `"true"`, ajoutés à la liste fermée de
`.github/workflows/coolify-drapeau.yml`. Si le plan #2259 a déjà créé `AR/interrupteurs.ts`, on y
ajoute ces clés ; sinon le lot 3 le crée.

| Clé                                       | Cible              | Ce qu'elle ouvre                                      |
| ----------------------------------------- | ------------------ | ----------------------------------------------------- |
| `APPORTEUR_COMMISSION_JOURNEE_IA_ENABLED` | site **et** worker | Palier Journée IA dans `calculerCommission` (lot 2).  |
| `APPORTEUR_CHALLENGES_CONSOLE_ENABLED`    | site               | Écrans console : liste, création, publication, suivi. |
| `APPORTEUR_CHALLENGES_ESPACE_ENABLED`     | site               | Encart « la règle » et page du règlement.             |
| `APPORTEUR_CHALLENGES_ANNONCE_ENABLED`    | site               | Bouton d'envoi du message unique.                     |
| `APPORTEUR_CHALLENGES_PRIME_ENABLED`      | site **et** worker | Constat, validation, création de la ligne.            |

**Retiré** : la barre de progression et tout interrupteur qui l'ouvrait. Les interrupteurs de
« Mes commissions » sont dans le plan #2259.

---

## 7. Calendrier

Le challenge commence le 1er décembre 2026, dans six jours. La condition est « facturées en
décembre » : **le constat peut venir après**, rien n'est perdu si les lots 6 et 7 arrivent en
janvier. Ce qui doit être en ligne **avant** le 1er décembre pour que des Journées soient
reconnues automatiquement : le lot 1 (offre `journee-ia` dans les devis). Sans lui, chaque
facture de décembre passera par une décision manuelle (lot 7, toujours possible a posteriori).

Minimum pour publier honnêtement : lots 3, 5, 8 (règle visible, règlement figé). L'annonce (lot 6)
peut partir après la publication. Si ce minimum n'est pas en ligne le 1er décembre : D-10.

---

## 7 bis. Ce que ce plan ne fait pas

- Il ne décrit pas l'écran « Mes commissions » (plan #2259).
- Il ne modifie ni le contrat, ni l'annexe 1, ni aucun texte publié : il les liste en décisions.
- Il n'envoie aucun e-mail à un apporteur en dehors de l'annonce unique.
- Il ne crée aucun classement, aucun décompte, aucune barre de progression, même interne à
  l'espace.
- Il ne touche pas aux factures des clients ni à leur TVA.

---

## 8. Découpage en lots de code

Chaque lot : tests rouges d'abord, une PR, en brouillon pendant le travail (AGENTS.md, CI-LOT1).

| Lot   | Nature   | Contenu                                                                                                                                                                                 | Fichiers                                                                                                                                                                                                                                                                                                                  | Tests rouges d'abord                                                                                                                                                                                                                                                                           | Interrupteur                              | Dépend de                                                        |
| ----- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------- |
| **1** | données  | Offre « Journée IA » reconnaissable dans les devis                                                                                                                                      | `prisma/seeds/qualiopi/offres.ts` (offre `tierId: "journee-ia"`, prix lu dans `pricing.ts`), assistant de devis (propose l'offre, pose `offreTierId`)                                                                                                                                                                     | le devis créé depuis l'offre porte `offreTierId = "journee-ia"` ; le seed reste idempotent ; aucun prix en dur                                                                                                                                                                                 | aucun (une offre de plus au catalogue)    | —                                                                |
| **2** | argent   | Commission de la Journée IA alignée sur la règle : 500 € par Journée à 1 490 € HT, au prorata du prix payé, plafonnée au forfait, reprise par la voie existante si remboursée en argent | `AR/regles.ts` (palier `journee-ia`, forfait 50 000, prix 149 000), `AR/passage-quotidien.ts` (reconnaissance sur les lignes du devis), `AR/__tests__/regles.spec.ts`                                                                                                                                                     | 1 490 € → 500 € ; 745 € → 250 € ; 2 Journées → 1 000 € ; avoir total → reprise ; ancien comportement intact interrupteur éteint                                                                                                                                                                | `APPORTEUR_COMMISSION_JOURNEE_IA_ENABLED` | 1 ; allumage après D-11 (version de l'annexe 1)                  |
| **3** | données  | Migration des challenges (§ 2), RGPD, déclaration des interrupteurs                                                                                                                     | `prisma/schema.prisma`, `prisma/migrations/…_apporteurs_challenges/{migration,rollback}.sql`, `prisma/objets-sql-bruts.ts`, `src/lib/rgpd-reseau-apporteur.ts`, `src/lib/rgpd-erase.ts`, `AR/interrupteurs.ts`, `.github/workflows/coolify-drapeau.yml`, `tests/unit/ci/apporteurs-challenges-migration-additive.spec.ts` | migration additive, sans clé étrangère vers l'existant, sans `ALTER TYPE` ; `rgpd` des quatre tables (dont `challenges_annonces` = `dossier-client`) ; aucune donnée d'exemple                                                                                                                 | tables lues par aucun code                | —                                                                |
| **4** | argent   | Le worker sait libeller une prime (en ligne **avant** le lot 7)                                                                                                                         | `AR/autofacture-donnees.ts` (libellé « Prime exceptionnelle … »), `AR/commissions.ts` (hors `ACTIVITES_CLASSABLES`), `AR/prestation-presentation.ts`, `AR/requetes-console.ts`, `…/apporteurs/commissions/page.tsx` (libellé)                                                                                             | ligne `prime_challenge` simulée : autofacture assujetti (TVA 20 %), franchise (mention 293 B), régime inconnu (attente) ; DAS2 ; aucune part de parrainage ; palier jamais rendu                                                                                                               | aucun (aucune ligne n'existe encore)      | —                                                                |
| **5** | écran    | Console : liste, création, publication, filtre de formules                                                                                                                              | `…/apporteurs/challenges/{page,nouveau,[id]}/**`, `AR/actions-challenges-console.ts`, `AR/challenge-textes-interdits.ts`, `src/lib/admin-nav.ts`, `src/lib/admin-nav.test.ts`                                                                                                                                             | habilitation `facturer` ; immutabilité ; chevauchement ; formules de pression ; textes du § 9 acceptés                                                                                                                                                                                         | `APPORTEUR_CHALLENGES_CONSOLE_ENABLED`    | 3                                                                |
| **6** | sécurité | Message d'annonce unique                                                                                                                                                                | `src/lib/email/templates/apporteur-challenge-annonce.tsx`, `index.tsx`, `src/server/queue/types.ts`, `src/server/email/outbox-policy.ts`, `src/server/email/apercu/catalogue.ts`, `AR/envois.ts`, `AR/actions-challenges-annonce.ts`, bloc console                                                                        | second envoi refusé (action et clé) ; retirés exclus ; aperçu exact ; aucun job différé ni répété ; `gabaritRepli`                                                                                                                                                                             | `APPORTEUR_CHALLENGES_ANNONCE_ENABLED`    | 3, 5 ; gabarit en ligne sur le worker **avant** le premier envoi |
| **7** | argent   | Règles pures, constat, suivi, validation, reprise                                                                                                                                       | `AR/challenge-regles.ts`, `AR/challenge-prime.ts`, `AR/passage-quotidien.ts` (une étape), `AR/actions-challenges-prime.ts`, `src/server/auth/habilitations.ts` (`valider_prime: ["super_admin"]`), `…/apporteurs/challenges/[id]/{suivi,primes}/**`                                                                       | tous les cas du § 3.5 ; jours civils de Paris aux bornes ; `totauxDevis` ; `refunded` sans avoir ; statut réversible ; registre muet = refus ; SIRET puis SIREN au clic hors cache ; `demanderVigilance` ; reprise par avoir ; seule l'action de validation crée la ligne ; `super_admin` seul | `APPORTEUR_CHALLENGES_PRIME_ENABLED`      | 3, 4 **en ligne**, 5                                             |
| **8** | écran    | Espace : encart « la règle » et page du règlement                                                                                                                                       | `ESP/challenge/reglement/page.tsx`, `ESP/challenge/textes.ts`, `ESP/page.tsx` (un bloc), tests                                                                                                                                                                                                                            | aucun nombre personnel ; aucun `<progress>` ni « N sur M » ; `noindex`, `no-store`, `Referrer-Policy` ; jeton faux / restreint = neutre ; poids du compartiment 25 KB                                                                                                                          | `APPORTEUR_CHALLENGES_ESPACE_ENABLED`     | 3 ; après le lot qui touche `ESP/page.tsx` dans #2259            |

Le lot 7 peut se scinder en 7a (règles pures, sans base, sans dépendance) et 7b (constat et
console). **7a est lançable tout de suite.**

« Mes commissions » : lots EC du plan #2259. La ligne de prime y est rendue comme une commission ;
aucune section « challenge ».

Collisions : `AR/passage-quotidien.ts` est touché par les lots 2 et 7 → 7 après 2. `ESP/page.tsx` par
le lot 8 et #2259. Un fichier d'actions par lot.

Allumage conseillé : (1) `…_CONSOLE` ; le dirigeant crée le challenge de décembre ; (2) `…_ESPACE` ;
(3) publication ; (4) `…_ANNONCE`, envoi unique ; (5) `…_PRIME` sur le worker puis sur le site ;
(6) `…_COMMISSION_JOURNEE_IA` après D-11.

---

## 9. Textes à faire relire par le dirigeant (mot pour mot)

### 9.1 Règlement (aussi par le conseil)

> **Prime exceptionnelle de décembre 2026 — règlement**
>
> 1. **Qui est concerné.** Tout apporteur d'affaires dont le contrat avec Axion IA est en cours et
>    dont l'entreprise est immatriculée et active au registre public. Les conditions sont les mêmes
>    pour tous.
> 2. **Rien n'est attendu de vous.** Aucune inscription n'est demandée et aucun chiffre n'est exigé.
>    Ne pas obtenir cette prime n'a aucune conséquence sur votre contrat, vos commissions ou votre
>    relation avec Axion IA. Cette prime ne fixe aucun objectif et ne crée aucune obligation.
> 3. **Ce qui ouvre droit à la prime.** Dix Journées IA facturées par Axion IA entre le 1er et le
>    31 décembre 2026 inclus (date de la facture, heure de Paris), à des entreprises qui vous sont
>    attribuées selon votre contrat. Les autres prestations ne comptent pas. Une Journée remboursée,
>    annulée ou restée impayée ne compte plus.
> 4. **Montant.** 2 000 € hors taxes, une seule fois par apporteur.
> 5. **Versement.** La prime est un complément de commission. Elle est vérifiée par Axion IA, puis
>    facturée par autofacture et versée comme une commission, avec la TVA selon votre régime. Elle est
>    versée quand les dix Journées ont été payées en entier par les clients, au plus tard le
>    [date, D-3]. Aucune prime n'est versée si votre entreprise n'est pas active au registre public au
>    moment de la vérification.
> 6. **Reprise.** Si une Journée est remboursée après le versement et que le nombre retombe sous dix,
>    la prime est reprise dans les conditions de l'article 4.5 de votre contrat.
> 7. **Fin de contrat.** La prime reste due si votre contrat était en cours le jour où la dixième
>    Journée a été facturée [D-6].
> 8. **Organisation.** Vous restez seul juge de votre activité, de vos horaires et de vos démarches.
>    Axion IA n'envoie aucun rappel, ne publie aucun classement et n'affiche aucun décompte.
> 9. **Règlement fixe.** Ce règlement ne peut pas être modifié après sa publication.

### 9.2 Encart de l'espace

> **Prime exceptionnelle de décembre 2026**
>
> Une prime de 2 000 € HT est versée à tout apporteur pour qui dix Journées IA ont été facturées
> entre le 1er et le 31 décembre 2026, à des entreprises qu'il a présentées. Rien n'est attendu de
> vous : ne pas l'obtenir ne change rien à votre contrat ni à vos commissions.
>
> [Lire le règlement]

### 9.3 Message d'annonce unique

Objet : « Prime exceptionnelle de décembre 2026 »

> Bonjour <Prénom>,
>
> Axion IA verse une prime exceptionnelle de 2 000 € HT à tout apporteur pour qui dix Journées IA
> auront été facturées entre le 1er et le 31 décembre 2026, à des entreprises qu'il a présentées.
>
> Rien n'est attendu de vous. Ne pas obtenir cette prime ne change rien à votre contrat ni à vos
> commissions.
>
> Le règlement est dans votre espace : <lien>.
>
> Ce message est le seul que vous recevrez à ce sujet.
>
> L'équipe Axion IA

### 9.4 Libellés d'argent

- Ligne d'autofacture `AXI-APP` : « Prime exceptionnelle de décembre 2026 (complément de
  commission) ».
- Ligne dans « Mes commissions » (#2259) : « Prime exceptionnelle de décembre 2026 ».
- Bouton console : « Valider la prime de 2 000 € HT » ; confirmation : « Cette prime sera facturée
  et versée comme une commission. »

### 9.5 Console

- Bandeau de la liste : « Un challenge est une information mise à disposition. Aucune relance,
  aucun classement, aucun décompte, aucun objectif individuel. Un seul message d'annonce. »
- Après publication : « Ce challenge est publié. Son règlement ne peut plus être modifié. Pour
  corriger une erreur, archivez-le et créez-en un nouveau. »
- Cases de publication : les trois du § 4.2.

---

## 10. Décisions attendues du dirigeant

| N°       | Question fermée                                                                                                                                                                              | Recommandation                                                                                                                                                                                                     |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **D-1**  | « Entreprise » veut-il dire **SIREN** (une société = un seul apporteur commissionné) ou **établissement** (deux SIRET d'un même SIREN peuvent revenir à deux apporteurs, contrat art. 2.6) ? | **SIREN**, lecture stricte de votre règle. Cela demande de changer `attributaireDeLaCommande` et l'article 2.6 (plan #2259). Pour le challenge, rien ne change : chaque Journée compte pour son seul attributaire. |
| **D-2**  | La prime est-elle versée quand les dix Journées sont **payées à 100 %**, et reprise si l'une est remboursée ? (La condition d'obtention reste « facturées en décembre ».)                    | **Oui.** C'est la règle de toutes les commissions.                                                                                                                                                                 |
| **D-3**  | Faut-il une date limite de paiement client (par exemple **31 mars 2027**) au-delà de laquelle une Journée impayée ne permet plus le versement ?                                              | **Oui, 31 mars 2027**, écrite dans le règlement seulement, jamais dans l'encart.                                                                                                                                   |
| **D-4**  | Une facture de décembre sans devis, ou sur un devis sans l'offre Journée IA, peut-elle compter par décision manuelle motivée et journalisée dans la console ?                                | **Oui**, la décision vise la facture et s'applique quel que soit l'apporteur.                                                                                                                                      |
| **D-5**  | Nommer le dispositif « **Prime exceptionnelle de décembre 2026** » plutôt que « challenge » dans tout ce que voit l'apporteur ?                                                              | **Oui.** « Challenge » se lit comme un objectif. Le mot reste interne (console, code).                                                                                                                             |
| **D-6**  | Apporteur résilié ou retiré après la dixième Journée facturée : prime due ?                                                                                                                  | **Oui**, si le contrat était en cours le jour de la dixième facture ; versée par le circuit habituel.                                                                                                              |
| **D-7**  | Une Journée vendue à prix réduit (net > 0) compte-t-elle pour une ?                                                                                                                          | **Oui.** Le prix est fixé par Axion IA, pas par l'apporteur.                                                                                                                                                       |
| **D-8**  | Vingt Journées : deux primes ?                                                                                                                                                               | **Non**, une seule prime par apporteur et par challenge.                                                                                                                                                           |
| **D-9**  | Dix Journées vendues à **un seul** client comptent-elles ?                                                                                                                                   | **Oui** : votre règle ne distingue pas.                                                                                                                                                                            |
| **D-10** | Si les lots 3, 5 et 8 ne sont pas en ligne le 1er décembre : publier quand même dès qu'ils le sont (la période reste décembre, la condition est la facturation), ou décaler la période ?     | **Publier dès qu'ils sont en ligne, sans décaler** : rien n'est compté en temps réel, le constat se fait après.                                                                                                    |
| **D-11** | La commission de 500 € par Journée IA (lot 2) demande-t-elle une nouvelle version de l'annexe 1 acceptée par les apporteurs avant d'allumer `APPORTEUR_COMMISSION_JOURNEE_IA_ENABLED` ?      | **Oui**, faire relire par le conseil ; coder maintenant, allumer après.                                                                                                                                            |
| **D-12** | La prime est-elle couverte par le mandat d'autofacturation (contrat art. 5.2, annexe 2), en la qualifiant de « complément de commission » ?                                                  | **Oui**, sous réserve du conseil. Sinon, une case d'acceptation dans l'espace, qui ne vaut pas inscription.                                                                                                        |
| **D-13** | Peut-on archiver un challenge publié pendant sa période, les droits déjà nés restant acquis ?                                                                                                | **Oui.**                                                                                                                                                                                                           |
