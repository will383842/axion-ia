# Apporteurs : écran « Mes commissions » et challenges du mois

Plan de conception du 25 novembre 2026. **Aucun code produit dans cette PR** : ce fichier est le seul livrable.
Lecture du code faite sur `origin/main` au commit `3151c61a`.

> **Coordination.** La branche `docs/apporteurs-conception-espace-commissions` (plan
> `docs/plans/apporteurs-espace-commissions-2026-11-25.md`) **n'existe pas sur `origin`** au moment de
> la rédaction (`git ls-remote origin 'refs/heads/docs/apporteurs*'` ne rend rien). Ce plan conçoit
> donc l'ensemble. Si l'autre plan paraît ensuite, il fait foi pour la partie 1 là où il est plus
> précis ; la partie 2 (challenges) ne dépend de la partie 1 que par un point d'insertion dans la page
> d'accueil de l'espace (§ 4.3).

## Ce qu'il faut retenir en une page

1. **L'écran « Mes commissions » est faisable sans nouvelle table.** Tous les états d'après
   l'encaissement sont en base (`commissions_apporteur`). Les états d'avant l'encaissement (devis
   envoyé, signé, facture envoyée, en attente de paiement) ne sont reliés à l'apporteur par **aucune
   colonne** : ils se dérivent, par la même règle que celle qui crée les commissions (SIREN, SIRET,
   dates de protection). Un seul état demandé manque vraiment : « rendez-vous pris ».
2. **« Entreprise gardée 60 jours » n'existe pas dans le code ni dans le contrat.** La réservation
   dure 6 mois à compter de la déclaration (+ 3 mois une fois). Le seul « 60 jours » est le délai
   maximal avant confirmation tacite. Question 1 au dirigeant.
3. **Le challenge de décembre bute sur un manque bloquant : rien, dans un devis, une facture ou une
   commission, ne dit qu'une vente est une « Journée IA ».** Le produit n'existe que dans la grille
   publique du site (`src/content/pricing.ts:471`, 1 490 € HT), avec ce commentaire : « Aucune
   commission tant que Williams ne l'a pas tranchée ». Il faut donc décider (a) comment on reconnaît
   une Journée IA facturée, (b) quelle commission elle porte. Questions 2 et 3.
4. **La prime suit le circuit des commissions en devenant une ligne de commission d'un genre
   nouveau**, créée seulement après validation manuelle du dirigeant. Elle hérite alors, sans code
   nouveau, de l'autofacture, de la TVA selon le régime, du seuil de vigilance, du contrôle « entreprise
   radiée », de la DAS2 et de la reprise.
5. **Les garde-fous juridiques sont écrits comme des tests**, pas comme des intentions : aucun envoi
   automatique lié à un challenge en dehors de l'unique annonce, aucune lecture des chiffres d'un autre
   apporteur, aucune formule de compte à rebours dans les textes.
6. **Dix-huit lots** (dont un facultatif), chacun derrière un interrupteur éteint. Rien ne s'allume sans geste du dirigeant.

---

## 1. État des lieux du code

Abréviation : **AR/** = `src/features/apporteurs-reseau/`. **ESP/** = `src/app/apporteur/dossier/[id]/[jeton]/`.

### 1.1 L'espace de l'apporteur aujourd'hui

| Sujet                  | Où                                                                                                                                                                           | Constat                                                                                                                                                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accès                  | `AR/jeton.ts:52` (`jetonDossierValide`), `AR/donnees.ts:283` (`lireDossierParLien`)                                                                                          | Pas de session ni de cookie. L'identité vient de l'URL `/apporteur/dossier/<id>/<jeton>` ; le jeton est un HMAC de l'identifiant et de `versionLien`. Augmenter `versionLien` révoque le lien.                                                |
| Apporteur retiré       | `AR/donnees.ts:302-306`, `AR/retrait.ts:294` (`argentEnJeu`)                                                                                                                 | Lien refusé, sauf s'il reste de l'argent en jeu : mode « restreint » (dépôt des pièces seulement).                                                                                                                                            |
| Page d'accueil         | `ESP/page.tsx:59` ; bloc « signé » `:123-184`                                                                                                                                | Contrat à télécharger, déclaration d'entreprise, liste des déclarations, liens « commissions » et « outils ».                                                                                                                                 |
| Liste des entreprises  | `ESP/ListeDeclarations.tsx:36`, `AR/declaration-entreprise.ts:64` (`lireDeclarationsDe`)                                                                                     | Nom de l'entreprise, date, état, « prestation réalisée ». **Aucun montant.** La requête ne sélectionne aucune coordonnée (`:68-76`).                                                                                                          |
| Page « commissions »   | `ESP/commissions/page.tsx:44`                                                                                                                                                | Seulement la **grille de référence** (les taux). Rien de personnel.                                                                                                                                                                           |
| Montants               | —                                                                                                                                                                            | L'apporteur ne les reçoit que par e-mail : `apporteur-releve` avec le PDF de l'autofacture (`AR/facturation.ts:486-505`), `apporteur-virement-fait` (`AR/envois.ts:226`), `apporteur-commission-avoir-client` (`AR/avoir-client.ts:126-150`). |
| Textes                 | `ESP/textes.ts`, `ESP/textes-declaration.ts`                                                                                                                                 | En dur, en français. Pas de `next-intl` dans ce segment (hors `[locale]`, `src/proxy.ts:631-639`).                                                                                                                                            |
| Tests de cloisonnement | `ESP/actions-declaration.spec.ts:66`, `ESP/commissions/la-grille-est-reservee-aux-apporteurs.spec.tsx:55-69`, `ESP/le-mode-restreint-n-ouvre-que-la-vigilance.spec.ts:57-79` | Ils couvrent le jeton et le statut. **Aucun test « l'apporteur A lit les données de B »** : aucun écran n'en affichait. Aucun test Playwright sur l'espace.                                                                                   |

### 1.2 Présentations et attributions

- Modèle `PresentationEntreprise`, `prisma/schema.prisma:16592`. Statuts (`:16573`) : `reservee`,
  `confirmee`, `deja_connue`, `hors_champ`, `dementie`, `terminee`.
- Dates : `recueAt`, `contactEnvoyeAt`, `confirmeeAt`, `confirmationTacite`, `protegeeJusquAt`,
  `prolongeeAt`.
- Durées, `AR/regles.ts` : protection 6 mois (`:31`), prolongation 3 mois (`:33`), confirmation tacite
  30 jours (`:37`), prise de contact 30 jours (`:44`). Le plafond « 30 + 30 = 60 jours » est celui de
  la confirmation tacite sans contact (`AR/passage-quotidien.ts:374`).
- Ce que l'apporteur lit déjà : `etatPourApporteur`, `AR/declaration-regles.ts:124` (« À l'étude »,
  « Réservée jusqu'au », « Non disponible », « Expirée » ; une déclaration démentie ne s'affiche pas).
- Établissement (contrat 2.6) : `PresentationEtablissement` (`schema.prisma:16453`),
  `DevisEtablissement` (`:16491`), `CommandeAAttribuer` (`:16473`).

### 1.3 Devis, factures, paiements

- `Devis`, `schema.prisma:5287`. Statuts (`:5119`) : `brouillon`, `envoye`, `accepte`, `refuse`,
  `expire`, `transforme_convention`. Dates : `sentAt`, `acceptedAt`, `declinedAt`, `dateValidite`,
  `livraisonDebutAt`, `livreAt`. Lignes en JSON : `designation`, `quantite`, `prixUnitaireHtCents`,
  `offreCode?`, `offreTierId?` (`:5314`).
- `FactureFormation`, `schema.prisma:8582`. Statuts (`:8286`) : `brouillon`, `emise`,
  `partiellement_payee`, `en_retard`, `payee`, `annulee`. Dates `emiseAt` (`:8655`) et `paidAt`
  (`:8658`), **sans fuseau, stockées en UTC**. Un avoir est une `FactureFormation` avec `avoirDeId`
  (`:8650`) et des montants négatifs.
- Paiements : `Payment` (`schema.prisma:1843`), statuts `pending`, `processing`, `succeeded`,
  `failed`, `refunded`, `cancelled` (`:233`).
- **Aucune colonne ne relie un devis ou une facture à une présentation.** Le lien est calculé :
  SIREN du client (`Client.siren`, `schema.prisma:5138`), SIRET de la commande, date de commande
  (`dateDeCommande`, `AR/passage-quotidien.ts:221` : `devis.acceptedAt`, sinon `emiseAt`), protection
  (`commandeCouverte`, `AR/regles.ts:243`), établissement (`presentationPourEtablissement`,
  `AR/passage-quotidien.ts:190`).
- Commande soldée : `commandesSoldees`, `AR/commandes.ts:60` (toutes les factures du devis payées, net
  des avoirs positif) ; net : `netDeLaCommande`, `AR/commandes.ts:39`.

### 1.4 Commissions, autofactures, virements, reprises

- `CommissionApporteur`, `schema.prisma:16655`. Statuts (`:16632`) : `a_qualifier`, `due`,
  `en_attente_vigilance`, `versee`, `reprise`, `annulee`, `retenue`.
- Naissance : uniquement dans `etapeCommissions`, `AR/passage-quotidien.ts:646-841`, **quand la
  commande est payée en entier**. Avant cela, il n'existe aucune ligne pour l'apporteur.
- Calcul : `calculerCommission`, `AR/regles.ts:338`. Paliers de formation `:259-302`. Prix réduit :
  forfait au prorata du prix public, arrondi au centime inférieur (`:370-371`).
- Prestation réalisée : `prestationRealiseeAt`, `prestationRealiseePar` (`schema.prisma:16687-16688`),
  `AR/realisation.ts:75` et `:178`. Rien n'est facturé avant (`AR/facturation.ts:231-235`).
- Autofacture : `facturerApporteur`, `AR/facturation.ts:213` ; numéro `AXI-APP-AAAA-NNNN`
  (`AR/commissions.ts:575`) ; lignes tirées **des seules commissions** (`lignesAutofacture`,
  `AR/autofacture-donnees.ts:142`) ; TVA selon `regimeTva` (`AR/autofacture-donnees.ts:56`) ; PDF rangé
  sous `apporteurs/autofactures/<apporteurId>/<numero>.pdf` (`AR/commissions.ts:777`).
- **Il n'y a pas de table de virements.** Le lot, c'est l'autofacture. « Virement fait » :
  `marquerVerse`, `AR/facturation.ts:787`. Liste à virer : `lireVirementsAFaire`, `:994`.
- Vigilance : seuil de 5 000 € de cumul (`src/lib/vigilance.ts:13`), statuts comptés
  `AR/commissions.ts:44`.
- Suspension pour contestation du client : `litigeDepuis`, `AR/litige.ts:99`.
- Reprise : ligne de statut `reprise`, palier `reprise-de:<id>` (`AR/resiliation.ts:145-147`) ; après
  avoir du client : `reprendreApresAvoirsClients`, `AR/avoir-client.ts:187`, dans la limite de 24 mois
  (`:59`). Solde négatif : `AR/solde-negatif.ts:14-15`.
- **Aucun moyen d'ajouter une ligne libre** (une prime) à une autofacture : `AR/ajustement.ts` ne sait
  que réduire (`:197`) ou annuler (`:254`).
- Entreprise de l'apporteur radiée : vérifiée avant chaque autofacture (`etatAuRegistre`,
  `AR/facturation.ts:533`, cache d'une heure) ; l'autofacture attend (`:642`). Lecture du registre :
  `src/server/registre-entreprises/annuaire.ts:207` (`active` = état administratif « A », `:255`).

### 1.5 La Journée IA

- `JOURNEE_IA_TIER`, `src/content/pricing.ts:471` : identifiant `journee-ia`, 1 490 € HT, prix ferme.
- Commentaire `:463-469` : constante à part, **hors des commissions**, « Aucune commission tant que
  Williams ne l'a pas tranchée ».
- Recherche de `journee-ia`, `Journée IA`, `JOURNEE_IA` dans `AR/`, `src/server/qualiopi/` et
  `prisma/` : **aucune occurrence**. Le produit n'existe ni dans les paliers (`AR/regles.ts:259`), ni
  dans `ActiviteFacturation` (`schema.prisma:5103`), ni comme code d'offre repéré en base.

### 1.6 Console, habilitations, e-mails, conventions

- Console : `src/app/[locale]/(admin)/[adminPrefix]/apporteurs/` (`page.tsx`, `[id]/page.tsx`,
  `commissions/page.tsx`, `entreprises/page.tsx`). Menu : `src/lib/admin-nav.ts:218`.
- Gardes : `gardePage("consultation" | "ecriture")` (`src/server/auth/garde-page.ts`) ; actes
  engageants par `peutEngager(role, acte)` (`src/server/auth/habilitations.ts:352`). Les actes
  d'argent du réseau passent par `sessionArgent()` → `peutEngager(role, "facturer")`
  (`AR/actions-commissions.ts:31`), réservé à `super_admin` et `admin`. **Il n'y a pas de rôle
  « dirigeant »** : dans ce plan, « le dirigeant » = un compte habilité à `facturer`.
- Journal : écriture directe `prisma.activityLog.create` (ex. `AR/ajustement.ts:43`).
- E-mails : point unique `AR/envois.ts:189` (`envoyer`), liste fermée `:54`, file BullMQ `emails`.
  Aperçu exact avant envoi : `apercu()`, `AR/envois.ts:104`, et paires d'actions « aperçu puis envoi »
  (`AR/actions-apporteurs.ts:100` et `:126`). Texte libre contrôlé par `validerTexteLibre`
  (`src/lib/email/templates/texte-libre-reseau.ts`). Un apporteur retiré ne reçoit que les e-mails
  d'argent (`AR/envois.ts:191-195`).
- Un nouveau gabarit s'inscrit à quatre endroits (`src/lib/email/templates/index.tsx:663`,
  `src/server/queue/types.ts:193`, `src/server/email/outbox-policy.ts:171`,
  `src/server/email/apercu/catalogue.ts:604`) et porte un `gabaritRepli` (AGENTS.md, lot S3).
- Interrupteurs : **le réseau d'apporteurs n'en a aucun aujourd'hui.** Convention du dépôt :
  `process.env.X === "true"`, lu à l'exécution, posé par `.github/workflows/coolify-drapeau.yml`
  (liste fermée `:30`, cible site, worker ou les deux `:118-124`).
- Migrations : tables **séparées et sans clé étrangère vers les tables existantes** (fenêtre
  app/worker), ex. `prisma/migrations/20261007190000_apporteur_reseau_retrait/`. Retour arrière :
  `rollback.sql` dans le dossier de la migration, jamais de `DROP` (renommer en `…_archive`), cf.
  `docs/guides-reseau-retour-arriere-migrations.md:30-41`. Un test par migration :
  `tests/unit/ci/<nom>-migration-additive.spec.ts`. Annotation `/// rgpd:` obligatoire
  (`tests/unit/ci/les-tables-du-dossier-client-suivent-la-personne.spec.ts`). Contraintes et
  déclencheurs en SQL brut : `prisma/objets-sql-bruts.ts:94`.
- Dates en heure de Paris : `minuitParisUtc` et `finDeJourneeParis`
  (`src/server/qualiopi/devis/date-validite.ts:10` et `:38`), `moisParis` (`AR/commissions.ts:564`),
  `jourParis` (`AR/autofacture-donnees.ts:307`). Attention : `ajouterMois` et `ajouterJours`
  (`AR/regles.ts:73`, `:83`) calculent en UTC.

### 1.7 Inventaire des états demandés

Légende : **En base** = une colonne le dit. **À dériver** = calculable sans nouvelle donnée.
**Manque** = aucune donnée fiable.

| État demandé par le dirigeant     | Disponibilité                                    | Source exacte                                                                                     | Remarque                                                                                                                                                                                                                    |
| --------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entreprise gardée (60 jours)      | **En base, mais la durée est autre**             | `PresentationEntreprise.statut`, `protegeeJusquAt`                                                | 6 mois (+ 3). Pas de « 60 jours ». Question 1.                                                                                                                                                                              |
| Rendez-vous pris                  | **Manque**                                       | aucune colonne entre présentation et rendez-vous                                                  | Un rapprochement approximatif existe (`faitsDeLaSociete`, `AR/passage-quotidien.ts:447` : rencontres des clients de même SIREN, événements Calendly de même e-mail). Trop incertain pour être affiché tel quel. Question 4. |
| Validée                           | En base                                          | `statut = confirmee`, `confirmeeAt`                                                               | Déjà affiché sous le mot « Réservée ».                                                                                                                                                                                      |
| Devis envoyé                      | À dériver                                        | `Devis.sentAt`, statut `envoye`, client de même SIREN et établissement, `sentAt` ≥ `recueAt`      | Pas de montant affiché (voir § 4.1.5).                                                                                                                                                                                      |
| Devis signé                       | À dériver                                        | `Devis.acceptedAt` + `commandeCouverte`                                                           | L'apporteur le reçoit déjà par e-mail (`apporteur-commande-signee`).                                                                                                                                                        |
| Prestation pas encore réalisée    | En base **après** encaissement ; à dériver avant | `CommissionApporteur.prestationRealiseeAt` nul ; avant : `Devis.livreAt` ou session de la facture | Avant encaissement, la ligne de commission n'existe pas.                                                                                                                                                                    |
| Prestation réalisée               | idem                                             | `prestationRealiseeAt`                                                                            | Déjà lu par `etatPrestation`, `AR/prestation-presentation.ts:29`.                                                                                                                                                           |
| Facture envoyée au client         | À dériver                                        | `FactureFormation.emiseAt`, statut ≠ `brouillon`, `annulee`                                       |                                                                                                                                                                                                                             |
| En attente du paiement du client  | À dériver                                        | statuts `emise`, `partiellement_payee`, `en_retard`                                               | Le mot « retard » n'est pas montré à l'apporteur.                                                                                                                                                                           |
| Payée en entier                   | En base                                          | existence de la commission ; `FactureFormation.paidAt`                                            |                                                                                                                                                                                                                             |
| Commission à verser               | En base                                          | statut `due` (+ `autofactureNumero`)                                                              | Trois variantes à dire en clair : en attente de pièces (`en_attente_vigilance`), en attente d'une donnée (`autofactureAttenteMotif`), suspendue (`litigeDepuis`).                                                           |
| Commission versée                 | En base                                          | statut `versee`, `verseeAt`                                                                       |                                                                                                                                                                                                                             |
| Reprise (impayé ou remboursement) | En base                                          | statut `reprise`, palier `reprise-de:<id>`, `avoirNumero`                                         |                                                                                                                                                                                                                             |
| _Non demandés, mais présents_     | En base                                          | `a_qualifier` (montant à calculer, hors grille), `annulee`, `retenue`, commande « à attribuer »   | À nommer en mots simples, sinon l'écran ment par omission.                                                                                                                                                                  |

---

## 2. Modèle de données proposé

### 2.1 Partie 1 : aucune table

L'écran « Mes commissions » lit l'existant. Une seule réserve : si le dirigeant veut l'état
« rendez-vous pris » de façon fiable, il faut une table de lien (lot P7, facultatif, § 6).

### 2.2 Partie 2 : quatre tables, une migration additive

Nom de migration : `prisma/migrations/2026MMJJHHMMSS_apporteurs_challenges/` (`migration.sql` +
`rollback.sql`). Conventions suivies : pas de clé étrangère vers les tables existantes
(`apporteurs_reseau`, `facture_formation`, `commissions_apporteur`) ; états en `VARCHAR` + contrainte
`CHECK` plutôt qu'en énumération Postgres (une valeur d'énumération ne se retire pas) ; tout est
nullable ou porte un défaut.

#### `challenges_apporteur` (modèle `ChallengeApporteur`)

`/// rgpd: technique — règle, période, seuil et montant d'un challenge ; identifiant de l'administrateur auteur ; aucune donnée d'apporteur`

| Champ                                       | Type                                                                         | Rôle                                                                              |
| ------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `id`                                        | uuid, clé                                                                    |                                                                                   |
| `titre`                                     | varchar(120)                                                                 | « Challenge de décembre : 10 Journées IA »                                        |
| `debut_le`, `fin_le`                        | date                                                                         | Jours civils **en heure de Paris**, bornes incluses.                              |
| `encaissement_jusqu_au`                     | date, nullable                                                               | Dernier jour où un paiement client compte (Question 6).                           |
| `produit`                                   | varchar(40)                                                                  | Liste fermée ; première valeur : `journee-ia`.                                    |
| `critere`                                   | varchar(40)                                                                  | Liste fermée ; première valeur : `facturees_dans_la_periode_et_payees_en_entier`. |
| `seuil`                                     | int, `CHECK (seuil BETWEEN 1 AND 999)`                                       | 10                                                                                |
| `prime_ht_cents`                            | int, `CHECK (> 0)`                                                           | 200 000                                                                           |
| `reglement`                                 | text                                                                         | Texte du règlement, tel que publié.                                               |
| `reglement_sha256`                          | char(64), nullable                                                           | Empreinte posée à la publication : preuve du texte.                               |
| `statut`                                    | varchar(20), défaut `brouillon`, `CHECK IN ('brouillon','publie','archive')` |                                                                                   |
| `publie_at`, `publie_par`                   | timestamptz, uuid, nullables                                                 |                                                                                   |
| `annonce_texte`                             | text, nullable                                                               | Le message d'annonce relu.                                                        |
| `annonce_envoyee_at`, `annonce_envoyee_par` | timestamptz, uuid, nullables                                                 | Posés **une seule fois**.                                                         |
| `exemple`                                   | boolean, défaut `false`                                                      | Vrai pour la donnée d'exemple.                                                    |
| `cree_at`, `maj_at`, `cree_par`             |                                                                              |                                                                                   |

Index : `(statut, debut_le)`. Contraintes : `fin_le >= debut_le` ;
`encaissement_jusqu_au IS NULL OR encaissement_jusqu_au >= fin_le`.

**Déclencheur d'immutabilité** (SQL brut, déclaré dans `prisma/objets-sql-bruts.ts`) : sur
`BEFORE UPDATE`, si `OLD.publie_at IS NOT NULL`, refuser tout changement de `titre`, `debut_le`,
`fin_le`, `encaissement_jusqu_au`, `produit`, `critere`, `seuil`, `prime_ht_cents`, `reglement`,
`reglement_sha256`, `publie_at`. Restent modifiables : `statut` (vers `archive` seulement),
`annonce_*` (de nul vers une valeur, jamais l'inverse), `maj_at`. Le refus est donc tenu par la base,
pas seulement par l'écran.

#### `challenges_primes` (modèle `ChallengePrime`)

`/// rgpd: dossier-client` — une ligne rattache un apporteur à une décision d'argent ; elle doit être
lue par `src/lib/rgpd-reseau-apporteur.ts` et traitée par `rgpd-erase.ts`.

| Champ                                      | Type                                                                              | Rôle                                                                                          |
| ------------------------------------------ | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `id`                                       | uuid, clé                                                                         | Sert aussi de `factureId` de la ligne de commission (§ 3.6).                                  |
| `challenge_id`                             | uuid, clé étrangère vers `challenges_apporteur` (`ON DELETE RESTRICT`)            | Table nouvelle des deux côtés : la clé étrangère est sans risque.                             |
| `apporteur_id`                             | uuid, sans clé étrangère                                                          |                                                                                               |
| `statut`                                   | varchar(20), `CHECK IN ('a_valider','validee','refusee','a_reprendre','reprise')` |                                                                                               |
| `atteint_le`                               | timestamptz                                                                       | Date du paiement qui a fait franchir le seuil.                                                |
| `preuves`                                  | jsonb                                                                             | Photographie au moment du constat : liste `{ factureId, numero, emiseAt, paidAt, journees }`. |
| `decidee_par`, `decidee_at`, `motif_refus` | uuid, timestamptz, varchar(300), nullables                                        |                                                                                               |
| `commission_id`                            | uuid, nullable, sans clé étrangère                                                | La ligne de commission créée à la validation.                                                 |
| `cree_at`, `maj_at`                        |                                                                                   |                                                                                               |

Unicité : `(challenge_id, apporteur_id)` → une seule prime par apporteur et par challenge.
Index : `(statut)`, `(apporteur_id)`.

#### `challenges_factures_decisions` (modèle `ChallengeFactureDecision`)

`/// rgpd: technique — identifiant de facture, décision et administrateur auteur ; aucun nom, e-mail ni téléphone`

Rôle : trancher à la main, facture par facture, **quand la reconnaissance automatique du produit ne
suffit pas** (Question 2). Clé `(challenge_id, facture_id)` ; champs `journees` (int, 0 à 99 :
0 = « ne compte pas »), `motif` (varchar(300), obligatoire), `decidee_par`, `decidee_at`.
Une décision s'applique à la facture, donc à l'apporteur attributaire quel qu'il soit : elle ne peut
pas favoriser une personne plutôt qu'une autre à situation égale.

#### `challenges_annonces` (modèle `ChallengeAnnonce`)

`/// rgpd: technique — identifiants du challenge et de l'apporteur destinataire, date d'envoi ; aucun contenu`

Clé `(challenge_id, apporteur_id)`, champ `envoyee_at`. Rôle : preuve qu'**un seul** message est parti
par personne, et verrou contre un second envoi (l'insertion échoue sur la clé).

### 2.3 Retour arrière

`rollback.sql`, sans `DROP` :

```sql
-- Retirer le déclencheur et sa fonction (objets techniques, aucune donnée).
-- Puis mettre les tables de côté, données conservées :
ALTER TABLE challenges_annonces            RENAME TO challenges_annonces_archive;
ALTER TABLE challenges_factures_decisions  RENAME TO challenges_factures_decisions_archive;
ALTER TABLE challenges_primes              RENAME TO challenges_primes_archive;
ALTER TABLE challenges_apporteur           RENAME TO challenges_apporteur_archive;
```

Puis `prisma migrate resolve --rolled-back` (guide `:76-80`). Avant tout retour arrière : éteindre les
quatre interrupteurs de la partie 2 (§ 6.1), sinon le code lit des tables absentes. Les lignes de
commission de genre `prime_challenge` déjà créées **restent** : ce sont des écritures comptables.

### 2.4 La donnée d'exemple (non publiée)

Insérée par la migration, avec un identifiant fixe et `ON CONFLICT DO NOTHING` :

| Champ                   | Valeur                                          |
| ----------------------- | ----------------------------------------------- |
| `titre`                 | Challenge de décembre : 10 Journées IA          |
| `debut_le` → `fin_le`   | 2026-12-01 → 2026-12-31                         |
| `produit`               | `journee-ia`                                    |
| `critere`               | `facturees_dans_la_periode_et_payees_en_entier` |
| `seuil`                 | 10                                              |
| `prime_ht_cents`        | 200000                                          |
| `statut`                | `brouillon`                                     |
| `exemple`               | `true`                                          |
| `encaissement_jusqu_au` | nul (à fixer par le dirigeant, Question 6)      |
| `reglement`             | le projet de règlement du § 4.4, **à relire**   |

Elle n'est visible que dans la console. Rien ne la publie sans le geste du dirigeant.

---

## 3. Règles pures de calcul

Fichiers proposés : `AR/challenge-regles.ts` (challenges) et `AR/mes-commissions-regles.ts` (frise).
**Aucune lecture de base, aucune horloge implicite** : la date du jour est un paramètre. Tout le reste
du plan s'appuie sur ces deux fichiers, testés sans base.

### 3.1 La période, en heure de Paris

```
dansLaPeriode(emiseAtUtc, debutLe, finLe) =
  minuitParisUtc(debutLe) <= emiseAtUtc <= finDeJourneeParis(finLe)
```

Jamais de comparaison sur la date UTC brute, jamais `ajouterJours` (UTC).

### 3.2 Ce qu'est « une Journée IA facturée »

Entrée : les **commandes** telles que `AR/commandes.ts` les regroupe (factures d'un même devis +
avoirs). Pour chaque commande :

1. `journees` = somme des quantités des lignes reconnues « Journée IA » (reconnaissance : Question 2 ;
   recommandation : `offreTierId = "journee-ia"` sur la ligne, sinon décision manuelle de
   `challenges_factures_decisions`). Les autres lignes de la commande sont ignorées.
2. `dateDeFacturation` = date d'émission de la **première** facture non annulée de la commande qui
   porte une ligne Journée IA (un acompte du 30 décembre et un solde du 15 janvier : la commande compte
   pour décembre). Question 5.
3. `attributaire` = l'apporteur que désigne la règle des commissions (`presentationPourEtablissement`,
   ou la décision de `CommandeAAttribuer`). Aucun attributaire décidé → la commande ne compte pour
   personne tant que la décision n'est pas prise.
4. `payeeEnEntier` = la commande figure dans `commandesSoldees` (toutes ses factures `payee`, net
   positif).
5. `netHtCents` de la part Journée IA après avoirs.

### 3.3 Progression d'un apporteur

```
facturees = Σ journees des commandes de l'attributaire
            où dansLaPeriode(dateDeFacturation) ET la commande n'est ni annulée ni remboursée en entier
payees    = Σ journees des mêmes commandes où payeeEnEntier
            ET (encaissementJusquAu absent OU dernier paiement <= fin de ce jour, heure de Paris)
seuilAtteint = payees >= seuil
```

L'apporteur lit les deux nombres : « 6 Journées IA facturées en décembre, dont 4 payées en entier ».
C'est une information **d'état**, sans échéance ni manque exprimé (§ 4.3).

### 3.4 Éligibilité à la prime (toutes les conditions)

| Condition                                                 | Source                                                                                          |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Challenge `publie`                                        | `challenges_apporteur.statut`                                                                   |
| `seuilAtteint`                                            | § 3.3                                                                                           |
| Contrat de l'apporteur `signe` au jour du constat         | `ApporteurReseau.statut`                                                                        |
| Entreprise de l'apporteur **active** au registre          | `lireEntrepriseParSiren(...).active` ; registre muet → on **attend**, jamais « oui » par défaut |
| SIREN présent sur la fiche                                | `ApporteurReseau.siren`                                                                         |
| Aucune prime déjà constatée pour ce challenge             | unicité `(challenge_id, apporteur_id)`                                                          |
| **Validation manuelle** d'un compte habilité à `facturer` | `challenges_primes.statut = validee`                                                            |

Tant que la validation n'est pas faite, **aucune ligne de commission n'existe** : rien ne peut être
facturé ni viré par le circuit automatique.

### 3.5 Cas limites

| Cas                                                                              | Règle                                                                                                                                                                                                                                                                                                                    | Test à écrire                                      |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| Facture émise le 31 décembre à 23 h 59, heure de Paris (22 h 59 UTC)             | **Compte.**                                                                                                                                                                                                                                                                                                              | `emiseAt = 2026-12-31T22:59:00Z` → dans la période |
| Facture émise le 1er janvier à 0 h 00, heure de Paris (31 décembre 23 h 00 UTC)  | **Ne compte pas.** C'est le piège d'une comparaison en UTC.                                                                                                                                                                                                                                                              | `2026-12-31T23:00:00Z` → hors période              |
| Facture émise le 1er décembre à 0 h 00, heure de Paris (30 novembre 23 h 00 UTC) | Compte.                                                                                                                                                                                                                                                                                                                  | borne basse                                        |
| Facture restée en `brouillon` le 31, émise le 2 janvier                          | Ne compte pas : c'est l'émission qui date.                                                                                                                                                                                                                                                                               |                                                    |
| Avoir **total** sur une Journée                                                  | Elle ne compte plus (`netHtCents <= 0`).                                                                                                                                                                                                                                                                                 |                                                    |
| Avoir **partiel**                                                                | Elle compte toujours : c'est un prix réduit.                                                                                                                                                                                                                                                                             |                                                    |
| Journée vendue à prix réduit                                                     | **Compte pour 1**, quel que soit le prix, tant que le net est > 0 : le prix est fixé par la Société, pas par l'apporteur. Journée offerte (0 €) : ne compte pas. Question 7.                                                                                                                                             |                                                    |
| Une facture, 3 Journées                                                          | Compte pour 3 (quantité de la ligne).                                                                                                                                                                                                                                                                                    |                                                    |
| Facture mixte (1 Journée IA + un audit)                                          | Compte pour 1 ; l'audit est ignoré.                                                                                                                                                                                                                                                                                      |                                                    |
| Paiement partiel                                                                 | Facturée, pas payée en entier.                                                                                                                                                                                                                                                                                           |                                                    |
| Impayé définitif (facture `annulee` ou avoir total)                              | Ne compte plus, ni en facturées ni en payées.                                                                                                                                                                                                                                                                            |                                                    |
| Remboursement **avant** la validation de la prime                                | Le compte baisse ; si l'on repasse sous le seuil, la ligne `a_valider` est retirée de la liste (statut `refusee`, motif automatique « seuil plus atteint »), sans e-mail.                                                                                                                                                |                                                    |
| Remboursement **après** validation, **avant** virement                           | La ligne de commission de la prime est annulée par le geste existant (`annulerCommission`, `AR/ajustement.ts:254`) ; prime `reprise`.                                                                                                                                                                                    |                                                    |
| Remboursement **après** versement de la prime                                    | La prime passe `a_reprendre` : **proposition** dans la console, jamais de débit automatique. Le dirigeant confirme ; la reprise suit `enregistrerReprise` (`AR/resiliation.ts:147`) : avoir d'autofacture, imputation sur les commissions suivantes, délai de 24 mois. Reprise **en entier** (la prime est indivisible). |                                                    |
| 11 Journées payées, puis une remboursée                                          | Reste 10 : la prime reste due.                                                                                                                                                                                                                                                                                           |                                                    |
| Deux apporteurs sur la même entreprise                                           | La Journée compte pour **un seul** : l'attributaire de la commission. Jamais de partage, jamais de double compte.                                                                                                                                                                                                        |                                                    |
| Commande « à attribuer » non tranchée                                            | Ne compte pour personne en attendant ; compte rétroactivement dès la décision, à sa date de facturation d'origine.                                                                                                                                                                                                       |                                                    |
| Parrain                                                                          | Les Journées du filleul ne comptent **pas** pour le parrain. La prime ne donne lieu à **aucune** part de parrainage.                                                                                                                                                                                                     |                                                    |
| Apporteur qui signe son contrat en cours de mois                                 | Mêmes règles : seules comptent les commandes couvertes par une attribution valable. Aucun prorata.                                                                                                                                                                                                                       |                                                    |
| Apporteur résilié ou retiré avant le constat                                     | Pas de prime (contrat non actif). Question 9.                                                                                                                                                                                                                                                                            |                                                    |
| Entreprise de l'apporteur radiée après validation                                | La ligne suit le circuit existant : autofacture en attente (`AR/facturation.ts:642`).                                                                                                                                                                                                                                    |                                                    |
| Prime de 2 000 € et seuil de vigilance de 5 000 €                                | La prime **entre dans le cumul** : elle peut attendre les pièces, comme toute commission.                                                                                                                                                                                                                                |                                                    |
| Challenge modifié après publication                                              | **Interdit**, par la base (déclencheur § 2.2) et par l'action. Une erreur se corrige en archivant et en publiant un nouveau challenge ; les droits nés de l'ancien restent acquis.                                                                                                                                       |                                                    |
| Deux challenges publiés qui se chevauchent                                       | Refusé à la publication pour un même `produit`.                                                                                                                                                                                                                                                                          |                                                    |
| Seuil atteint deux fois (20 Journées)                                            | Une seule prime. Question 8.                                                                                                                                                                                                                                                                                             |                                                    |

### 3.6 Comment la prime entre dans le circuit des commissions

À la validation, **dans une seule transaction** : la prime passe `validee` et une ligne
`CommissionApporteur` est créée :

| Champ                          | Valeur                                                       | Pourquoi                                                                                                                                                                                       |
| ------------------------------ | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apporteurId`                  | l'apporteur                                                  |                                                                                                                                                                                                |
| `factureId`                    | l'`id` de la ligne `challenges_primes`                       | Champ obligatoire et unique avec `(apporteurId, parrainage)` : la prime ne peut pas être créée deux fois. Précédent : `randomUUID()` pour les lignes de reprise scindées, `AR/facturation.ts`. |
| `presentationId`               | nul                                                          |                                                                                                                                                                                                |
| `parrainage`                   | `false`                                                      |                                                                                                                                                                                                |
| `activite`                     | `prime_challenge`                                            | Genre nouveau (15 caractères, la colonne en accepte 20).                                                                                                                                       |
| `palier`                       | `challenge:<id du challenge>`                                | 46 caractères, la colonne en accepte 60.                                                                                                                                                       |
| `factureHtCents`               | 0                                                            | Aucune facture client.                                                                                                                                                                         |
| `montantCents`                 | `prime_ht_cents`                                             | Hors taxes ; la TVA s'ajoute sur l'autofacture si l'apporteur y est soumis.                                                                                                                    |
| `statut`                       | résultat de `statutApresVigilance` (`AR/commissions.ts:250`) | `due` ou `en_attente_vigilance`.                                                                                                                                                               |
| `prestationRealiseeAt`, `…Par` | date de validation, `challenge`                              | Sans cela, `facturerApporteur` ne facture pas la ligne.                                                                                                                                        |

Ce que cela oblige à vérifier dans le code existant (lot C6) : libellé de la ligne sur l'autofacture
(`lignesAutofacture`), tableau des commissions de la console (jointure sur la facture : rend déjà
« nul »), `etatPrestation`, classement d'activité (`ACTIVITES_CLASSABLES`, `AR/commissions.ts:322` :
la prime ne doit **pas** y être proposée), export DAS2 (la prime y entre, c'est voulu), part de
parrainage (aucune).

**Fenêtre app/worker.** L'autofacture est établie par le worker. Le lot qui apprend au worker à
libeller `prime_challenge` (C6) doit être **en ligne avant** le lot qui crée la première ligne (C7),
dans une PR et un créneau distincts (AGENTS.md, règle symétrique).

### 3.7 Règles de la frise (partie 1)

Une **affaire** = une présentation et, s'il y en a, une commande. Une entreprise avec deux commandes
donne deux affaires sous le même nom. Fonction pure `etapesDeLAffaire(entree, maintenant)` qui rend une
liste ordonnée d'étapes `{ cle, etat: "faite" | "en_cours" | "a_venir" | "sans_objet", le?: Date }`.

Ordre fixe, 7 étapes au plus à l'écran :

1. **Entreprise réservée** (`reservee` / `confirmee`, avec « jusqu'au »)
2. **Devis envoyé**
3. **Devis signé**
4. **Prestation réalisée**
5. **Facture envoyée au client**
6. **Payée en entier par le client**
7. **Commission versée**

Les étapes 4 et 5 peuvent se produire dans l'un ou l'autre ordre : chacune a son état propre, la frise
ne suppose pas que l'une précède l'autre. « Rendez-vous pris » s'insère entre 1 et 2 seulement si la
Question 4 reçoit un oui.

**État courant** (un seul, en toutes lettres, au-dessus de la frise), par priorité décroissante :

| Clé                                      | Condition                                     | Texte                                           |
| ---------------------------------------- | --------------------------------------------- | ----------------------------------------------- |
| `reprise`                                | une ligne `reprise` vise la commission        | Reprise après remboursement                     |
| `retenue`                                | statut `retenue`                              | Commission retenue                              |
| `annulee`                                | statut `annulee`                              | Commande annulée                                |
| `versee`                                 | statut `versee`                               | Commission versée le …                          |
| `suspendue`                              | `litigeDepuis` non nul                        | En attente : contestation du client en cours    |
| `attente_pieces`                         | `en_attente_vigilance`                        | En attente de vos pièces                        |
| `attente_donnee`                         | `autofactureAttenteMotif` non nul             | En attente d'une information de votre part      |
| `a_verser`                               | `due` et `prestationRealiseeAt` non nul       | Commission à verser                             |
| `attente_prestation`                     | commission existante, prestation non réalisée | Payée par le client, prestation à venir         |
| `a_calculer`                             | `a_qualifier`                                 | Payée par le client, montant en cours de calcul |
| `attente_paiement`                       | facture émise, commande non soldée            | En attente du paiement du client                |
| `devis_signe`                            | devis accepté, pas de facture                 | Devis signé                                     |
| `devis_envoye`                           | devis envoyé                                  | Devis envoyé                                    |
| `reservee`                               | présentation confirmée ou réservée            | Entreprise réservée jusqu'au …                  |
| `a_l_etude`, `non_disponible`, `expiree` | `etatPourApporteur` existant                  | textes existants                                |

Une présentation `dementie` n'apparaît pas (règle existante).

---

## 4. Écrans

Principes communs à tout l'espace : composants **serveur** uniquement, aucun nouveau composant
client ; le détail s'ouvre avec les éléments natifs `<details>` / `<summary>` (aucun JavaScript) ;
largeur de téléphone d'abord ; textes en dur dans des fichiers `textes-*.ts`, comme l'existant.

### 4.1 Espace : « Mes commissions »

Route proposée : `ESP/mes-commissions/page.tsx`. La page existante `ESP/commissions/` (grille des
taux) reste à son adresse (des e-mails déjà partis y renvoient) ; son lien est renommé
« Grille des commissions ».

#### 4.1.1 En-tête

> **Mes commissions**
> Ce que vos présentations vous ont rapporté, et où en est chaque affaire.

#### 4.1.2 Les quatre totaux

Quatre cartes, dans cet ordre. Un montant n'est affiché que s'il est **certain**.

| Carte                                | Contenu                                                                     | Calcul                                                                                                                                                                                              |
| ------------------------------------ | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **En cours**                         | « 3 affaires » + « devis envoyé ou signé, pas encore facturé »              | Nombre d'affaires aux états `devis_envoye`, `devis_signe`. **Pas de montant** : il n'est pas connu.                                                                                                 |
| **En attente du paiement du client** | « 2 affaires » + « la commission est calculée quand le client a tout payé » | Nombre d'affaires à l'état `attente_paiement`. Pas de montant (Question 10).                                                                                                                        |
| **À verser**                         | « 1 250 € HT » + « dont 500 € en attente de vos pièces » le cas échéant     | Somme des `montantCents` des lignes `due` et `en_attente_vigilance`, moins les reprises non encore imputées. Jamais négatif à l'écran : un solde négatif s'écrit « 0 € » avec la phrase du § 4.1.6. |
| **Versé**                            | « 4 000 € HT en 2026 » + « 6 500 € HT depuis le début »                     | Somme des lignes `versee`, par année civile (heure de Paris) et au total.                                                                                                                           |

Sous les cartes, une ligne : « Montants hors taxes. Si vous facturez la TVA, elle s'ajoute et figure
sur chaque autofacture. »

#### 4.1.3 La liste des affaires

Une carte par affaire, la plus récemment modifiée en haut. Aucun tri ni filtre interactif au premier
lot : un apporteur a au plus quelques dizaines d'affaires (la requête existante plafonne à 100).
Quatre ancres en haut de liste (« En cours », « À verser », « Versé », « Terminé ») mènent à des
sections de la même page.

Chaque carte, fermée :

- le **nom de l'entreprise** ;
- l'**état courant** en toutes lettres (§ 3.7), avec une pastille (texte + pictogramme, jamais la
  couleur seule) ;
- le **montant de la commission** s'il existe ;
- la **frise** : 7 points reliés, chacun avec son mot en dessous ; sur téléphone, la frise passe en
  liste verticale.

Chaque carte, ouverte (« Voir le détail ») :

| Bloc                | Contenu                                                                                                                                                                                                                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Les étapes datées   | « Entreprise réservée le 3 octobre 2026, jusqu'au 3 avril 2027 » ; « Devis envoyé le 12 octobre » ; « Devis signé le 20 octobre » ; « Facture envoyée le 4 novembre » ; « Payée en entier le 18 novembre » ; « Prestation réalisée le 25 novembre » ; « Commission versée le 27 novembre ». Une étape non atteinte s'écrit « Pas encore ». |
| Le calcul           | Après encaissement seulement : « Formation générale, 1 jour. Prix public : 1 900 € HT. Prix facturé : 1 900 € HT. Votre commission : 500 € HT. » Ce sont les mentions du décompte que l'apporteur reçoit déjà (contrat, art. 5.1).                                                                                                         |
| Les pièces          | « Autofacture AXI-APP-2026-0042 (PDF) » ; « Avoir AXI-APP-2026-0051 (PDF) ». Lien de téléchargement (lot P5).                                                                                                                                                                                                                              |
| La phrase d'attente | Une seule, selon l'état : voir § 4.1.6.                                                                                                                                                                                                                                                                                                    |

Les lignes de **parrainage** forment une section à part, « Parrainage », sans nom d'entreprise :
« Parrainage, novembre 2026 : 50 € HT, versé le … » (Question 11).

Les **primes de challenge** forment une section « Primes » : « Challenge de décembre 2026 :
2 000 € HT, à verser ».

#### 4.1.4 États vides

| Situation                                        | Texte                                                                                                                                                                                        |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aucune présentation                              | « Vous n'avez pas encore présenté d'entreprise. Quand vous en présenterez une, vous suivrez ici chaque étape, jusqu'au versement de votre commission. » + lien « Présenter une entreprise ». |
| Des présentations, aucune commande               | « Aucune de vos entreprises n'a encore signé de devis. Vos présentations sont listées ci-dessous. »                                                                                          |
| Rien à verser                                    | Carte « À verser » : « 0 € ». Pas de phrase d'encouragement.                                                                                                                                 |
| Lecture impossible (base indisponible)           | « Vos commissions ne peuvent pas être affichées pour le moment. Rien n'est perdu : réessayez dans quelques minutes. » Jamais un « 0 € » par défaut.                                          |
| Mode restreint (apporteur retiré, argent en jeu) | Les totaux « À verser » et « Versé » et les pièces restent visibles ; pas de liste d'entreprises en cours. Question 12.                                                                      |
| Interrupteur éteint                              | La page rend 404 et le lien n'apparaît pas.                                                                                                                                                  |

#### 4.1.5 Ce que l'apporteur ne voit jamais

- Aucune donnée d'un autre apporteur, y compris sous forme de nombre ou de moyenne.
- **Aucune marge, aucun coût, aucun prix de revient.** Le prix facturé au client n'apparaît
  qu'**après l'encaissement** (il figure sur le décompte contractuel) ; le montant d'un devis non
  signé n'apparaît pas.
- **Aucun e-mail ni téléphone** d'une entreprise ou d'une personne présentée. La règle existante de
  l'espace est de ne **pas les lire du tout** (`AR/declaration-entreprise.ts:68-76`) : elle est
  conservée telle quelle, et verrouillée par test. Le libellé de masquage de la console
  (`COORDONNEES_MASQUEES`, `AR/coordonnees-presentees.ts:7`) n'a donc pas lieu de s'afficher ici.
- Aucun nom de salarié de la Société, aucun motif de contestation rédigé par un client
  (`litigeMotif`), aucune note interne.
- Aucun numéro de facture client, aucun nom de la personne qui a signé.

#### 4.1.6 Phrases d'attente (une par état)

| État                 | Phrase                                                                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `attente_paiement`   | « Le client a reçu sa facture. Votre commission est calculée quand il a tout payé. »                                                    |
| `a_calculer`         | « Le client a payé. Nous calculons votre commission. »                                                                                  |
| `attente_prestation` | « Le client a payé. Votre commission est facturée dès que la prestation est réalisée. »                                                 |
| `attente_pieces`     | « Nous attendons votre attestation de vigilance et votre justificatif d'immatriculation. Vous pouvez les déposer depuis votre espace. » |
| `attente_donnee`     | « Il nous manque une information pour établir votre autofacture. Écrivez-nous. » (le détail technique reste dans la console)            |
| `suspendue`          | « Le client a contesté la prestation par écrit. Le versement reprend dès que le point est réglé. »                                      |
| `a_verser`           | « Votre autofacture est établie. Le virement part au plus tard à la date d'échéance qui y figure. »                                     |
| `reprise`            | « Le client a été remboursé. La commission correspondante est reprise, comme le prévoit votre contrat (article 4.5). »                  |
| solde négatif        | « Une reprise dépasse vos commissions à verser. Elle sera déduite de vos prochaines commissions. »                                      |

#### 4.1.7 Accessibilité

- Un seul `<h1>` ; une section `<h2>` par groupe ; le nom de l'entreprise en `<h3>`.
- La frise est une liste ordonnée `<ol>` ; l'étape en cours porte `aria-current="step"` ; chaque point
  a un texte visible (« fait », « en cours », « pas encore ») et pas seulement une couleur.
- Les totaux sont une liste de définitions (`<dl>`), lue « À verser : 1 250 euros hors taxes ».
- `<summary>` porte le nom de l'entreprise (« Voir le détail, Boulangerie Martin »), pas un « Voir
  plus » répété.
- Contraste AA sur les pastilles ; cibles tactiles de 44 px ; focus visible ; aucune animation
  (donc rien à couper sous `prefers-reduced-motion`).
- Dates en toutes lettres (« 3 octobre 2026 »), montants avec espace insécable.
- Contrôle : un test axe dans la suite Playwright de l'espace (lot P4).

#### 4.1.8 Budgets Web Vitals

- L'espace (`/apporteur/**`) est hors `[locale]`, non indexé, et ne fait pas partie des 15 pages
  stratégiques ni des 5 URL du `lhci` post-déploiement. Les seuils d'AGENTS.md s'y appliquent comme
  cible interne.
- **Zéro octet de JavaScript client ajouté** : pas de `"use client"`, pas de bibliothèque de
  graphiques, pas d'icônes importées (SVG en ligne). Le cliquet « public » de `pnpm bundle:check` est à
  254,36 kB pour 265 kB : il n'y a pas de place pour un composant client, et il n'en faut pas.
- CLS = 0 : tout est rendu côté serveur en une passe, pas de squelette, pas d'image, hauteurs de
  cartes déterminées par le contenu.
- INP : la seule interaction est l'ouverture d'un `<details>`, gérée par le navigateur.
- Requêtes : 4 lectures bornées (présentations de l'apporteur ; commissions de l'apporteur ; factures
  et devis des clients dont le SIREN est dans ses présentations ; avoirs). Aucune requête par carte.
  La page est `force-dynamic` comme le reste de l'espace : pas de cache partagé entre apporteurs.
- À mesurer à la main après le lot P4 (octets seulement, AGENTS.md) :
  `next build --experimental-build-mode compile`, puis lecture de `.next/static/chunks/app/apporteur/`.

### 4.2 Console : ce que la partie 1 y ajoute

Rien d'obligatoire. Un seul ajout utile : sur la fiche d'un apporteur
(`apporteurs/[id]/page.tsx`), un lien « Voir ce que l'apporteur voit » qui rend la même vue par la
même fonction de lecture, pour qu'un administrateur puisse répondre à une question au téléphone
(lot P6). C'est aussi le meilleur test de recette avant d'allumer l'interrupteur.

### 4.3 Espace : l'encart « Challenge en cours »

Emplacement : page d'accueil de l'espace, bloc « signé » (`ESP/page.tsx:123-184`), sous les liens, et
en haut de « Mes commissions ». Affiché seulement si un challenge est `publie` et que la date du jour
(heure de Paris) est entre `debut_le` et la fin d'encaissement (ou `fin_le` s'il n'y en a pas).

> **Challenge de décembre : 10 Journées IA**
>
> **La règle.** Une prime de 2 000 € HT pour 10 Journées IA facturées à des entreprises que vous avez
> présentées, entre le 1er et le 31 décembre 2026, et payées en entier par ces entreprises.
>
> **Où vous en êtes.** 6 Journées IA facturées en décembre, dont 4 payées en entier.
> _(barre de progression : 4 sur 10)_
>
> **La prime.** 2 000 € HT, versée comme une commission, après validation, quand les 10 Journées sont
> payées en entier. Une Journée remboursée ou impayée ne compte plus.
>
> Participer est libre. Vous n'avez rien à faire pour vous inscrire, et ne pas participer ne change
> rien à votre contrat ni à vos commissions.
>
> [Lire le règlement complet]

États de l'encart :

| Situation                                        | Texte de « Où vous en êtes »                                                                                                                                                                                                |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rien encore                                      | « Aucune Journée IA facturée en décembre pour le moment. »                                                                                                                                                                  |
| En cours                                         | « 6 Journées IA facturées en décembre, dont 4 payées en entier. »                                                                                                                                                           |
| Seuil atteint, prime à valider                   | « 10 Journées IA payées en entier. Nous vérifions, puis la prime vous est versée comme une commission. »                                                                                                                    |
| Prime validée                                    | « Prime de 2 000 € HT validée. Elle figure dans vos commissions. »                                                                                                                                                          |
| Période finie, paiements encore attendus         | « Le challenge est terminé. 8 Journées IA facturées en décembre, dont 5 payées en entier. Les paiements reçus jusqu'au 31 mars 2027 comptent encore. » (phrase présente seulement si une date de fin d'encaissement existe) |
| Période et encaissement finis, seuil non atteint | « Le challenge est terminé. 8 Journées IA facturées en décembre, dont 8 payées en entier. »                                                                                                                                 |
| Aucun challenge publié                           | L'encart n'existe pas. Pas de « Bientôt un nouveau challenge ».                                                                                                                                                             |

**Interdits de rédaction, verrouillés par test** (§ 5.4) : aucun « il vous reste », « plus que »,
« encore X », « derniers jours », « J-… », aucun point d'exclamation, aucun mot « objectif »,
« classement », « meilleur », « podium », « retard ». La barre montre ce qui est fait ; elle
n'affiche ni le manque ni le temps restant. Pas de couleur d'alerte.

La barre est un élément natif `<progress value="4" max="10">`, doublé du texte « 4 sur 10 ».

### 4.4 Le règlement (projet de texte, à relire par le dirigeant et son conseil)

> **Règlement du challenge de décembre 2026**
>
> 1. **Qui peut participer.** Tout apporteur d'affaires dont le contrat avec Axion-IA est en cours et
>    dont l'entreprise est immatriculée et active. Les conditions sont les mêmes pour tous.
> 2. **Participation libre.** Aucune inscription n'est demandée. Ne pas participer, ou ne pas atteindre
>    le nombre indiqué, n'a aucune conséquence sur le contrat, sur les commissions ou sur la relation
>    avec Axion-IA. Ce challenge ne fixe aucun objectif et ne crée aucune obligation.
> 3. **Ce qui compte.** Les Journées IA facturées par Axion-IA entre le 1er et le 31 décembre 2026
>    (date de la facture, heure de Paris) à des entreprises qui vous sont attribuées selon votre
>    contrat. Les autres prestations ne comptent pas.
> 4. **La prime.** 2 000 € hors taxes, une seule fois par apporteur, quand 10 de ces Journées IA ont
>    été payées en entier par les clients [au plus tard le … : à compléter].
> 5. **Ce qui ne compte plus.** Une Journée IA remboursée, annulée ou restée impayée.
> 6. **Versement.** La prime est vérifiée par Axion-IA, puis facturée et versée comme une commission :
>    autofacture, TVA selon votre régime, virement. Si une Journée IA est remboursée après le versement
>    et que le nombre retombe sous 10, la prime est reprise dans les conditions de l'article 4.5 de
>    votre contrat.
> 7. **Organisation.** Vous restez seul juge de votre activité, de vos horaires et de vos démarches.
>    Axion-IA n'envoie aucun rappel et ne publie aucun classement. Votre avancement est visible dans
>    votre espace, pour vous seul.
> 8. **Règlement fixe.** Ce règlement ne peut pas être modifié après sa publication.

### 4.5 Console : les challenges

Route : `src/app/[locale]/(admin)/[adminPrefix]/apporteurs/challenges/`. Entrée de menu dans le
groupe `apporteurs` (`src/lib/admin-nav.ts:218`) : « Challenges ». Lecture : `gardePage("consultation")`.
Toute écriture : `sessionArgent()` (habilitation `facturer`). Chaque geste écrit une ligne au journal
(`activityLog`).

#### 4.5.1 Liste (`challenges/page.tsx`)

Trois sections, dans cet ordre : **En cours**, **À venir**, **Passés** ; plus **Brouillons** en tête
s'il y en a. Colonnes : titre, période, produit, seuil, prime, état (« Brouillon », « Publié »,
« Archivé »), annonce (« Envoyée le … » ou « Non envoyée »), primes (« 2 à valider, 1 validée »).
Bouton « Nouveau challenge ». Bandeau fixe en haut de page :

> Rappel : un challenge est une information mise à disposition. Aucune relance, aucun classement,
> aucun objectif individuel. Un seul message d'annonce par challenge.

#### 4.5.2 Création et modification (`challenges/nouveau`, `challenges/[id]/modifier`)

Champs : titre ; début et fin (dates, heure de Paris) ; dernier jour d'encaissement (facultatif) ;
produit (liste fermée) ; critère (liste fermée, une valeur) ; seuil ; prime en euros HT ; texte du
règlement (zone longue, pré-remplie par le modèle du § 4.4).

Contrôles : fin ≥ début ; seuil de 1 à 999 ; prime > 0 ; règlement non vide ; **le règlement est
analysé par la même liste de formules interdites que les textes de l'espace** (§ 5.4) et refusé avec
le mot en cause.

Tant que l'état est « Brouillon », tout est modifiable. Dès la publication, la page de modification
n'existe plus : elle affiche « Ce challenge est publié. Son règlement ne peut plus être modifié. Pour
corriger une erreur, archivez-le et créez-en un nouveau. »

#### 4.5.3 Publication (`challenges/[id]`)

Bouton « Publier », suivi d'un écran de confirmation qui montre **l'encart exact** que verra un
apporteur (aperçu rendu par le même composant, avec une progression d'exemple) et le règlement, puis
trois cases à cocher obligatoires :

- « J'ai relu la règle et le règlement. »
- « Je sais qu'ils ne pourront plus être modifiés. »
- « Les conditions sont les mêmes pour tous les apporteurs. »

Refus si un autre challenge publié du même produit chevauche la période.

#### 4.5.4 Annonce (un seul message)

Sur la fiche du challenge publié : bloc « Annonce ». Zone de texte pré-remplie :

> Bonjour {prénom},
>
> Un challenge est ouvert du 1er au 31 décembre 2026 : une prime de 2 000 € HT pour 10 Journées IA
> facturées sur la période et payées en entier par les clients.
>
> La participation est libre et ne change rien à votre contrat. Le règlement complet et votre
> avancement sont dans votre espace : {lien}.
>
> Ce message est le seul que vous recevrez au sujet de ce challenge.

Parcours : « Aperçu » (rendu exact, via `apercu()`) → relecture → « Envoyer à N apporteurs ». Le texte
passe par `validerTexteLibre` et par la liste des formules interdites. Destinataires : apporteurs au
statut `signe`, non retirés. Après l'envoi, le bloc affiche « Annonce envoyée le … à N apporteurs » et
**le bouton disparaît** ; l'action refuse un second envoi (`annonce_envoyee_at` déjà posé, et une ligne
par personne dans `challenges_annonces`). Un apporteur qui signe son contrat après l'annonce ne reçoit
rien : il voit l'encart dans son espace.

#### 4.5.5 Suivi par apporteur (`challenges/[id]`, onglet « Suivi »)

Tableau : apporteur, Journées facturées dans la période, Journées payées en entier, état de la prime.
**Tri par ordre alphabétique, sans numéro de rang**, sans export « classement ». Ne sont listés que
les apporteurs ayant au moins une Journée comptée. En ouvrant une ligne : la liste des factures
comptées (numéro, date d'émission, client, nombre de Journées, payée ou non), et celles écartées avec
la raison (« hors période », « avoir total », « non attribuée », « décision manuelle : … »).

Bouton par facture, réservé à l'habilitation `facturer` : « Corriger le nombre de Journées » (motif
obligatoire), qui écrit dans `challenges_factures_decisions`.

#### 4.5.6 Validation de la prime (`challenges/[id]`, onglet « Primes »)

Une ligne apparaît quand un apporteur atteint le seuil (constat fait par le passage quotidien, **sans
aucun e-mail à l'apporteur** ; une alerte interne au dirigeant, une fois).

Chaque ligne « À valider » montre : l'apporteur ; les 10 Journées retenues avec leurs factures et
dates de paiement ; les contrôles, chacun en clair :

- « Contrat en cours : oui »
- « Entreprise active au registre : oui, vérifié à l'instant » (lecture du registre **au clic**, pas
  depuis le cache)
- « 10 Journées payées en entier : oui »
- « Aucune contestation de client en cours sur ces factures : oui »

Deux boutons :

- **« Valider la prime de 2 000 € HT »** → confirmation (« Cette prime sera facturée et versée comme
  une commission. ») → transaction du § 3.6.
- **« Ne pas valider »** → motif obligatoire, visible seulement dans la console.

Le bouton « Valider » est **désactivé** tant qu'un contrôle est à « non » ou « inconnu », avec la
raison écrite à côté. Après validation, la ligne renvoie vers la commission dans
`apporteurs/commissions`, où le circuit habituel reprend (autofacture, « Virement fait »).

Section « À reprendre » : primes versées dont le compte est retombé sous le seuil ; bouton
« Reprendre la prime » (confirmation, puis `enregistrerReprise`) ou « Laisser » (motif obligatoire).

---

## 5. Sécurité et cloisonnement

### 5.1 Règles

1. **L'identité vient du lien, jamais d'un paramètre.** Toute lecture de l'espace part de
   `lireDossierParLien(id, jeton)` ; l'`apporteurId` utilisé ensuite est celui du dossier rendu, pas
   celui de l'URL relu, ni un champ de formulaire, ni un paramètre de recherche.
2. **Une seule porte de lecture par écran** : `lireMesCommissions(apporteurId)` et
   `lireMonChallenge(apporteurId)`. Chacune pose `where: { apporteurId }` sur **chaque** requête ; les
   factures et devis ne sont lus que pour les SIREN de **ses** présentations, puis filtrés par la règle
   d'attribution : une facture d'un client présenté aussi par un autre apporteur n'apparaît que chez
   l'attributaire.
3. **Liste de champs fermée.** Les fonctions de lecture rendent un type de vue écrit à la main
   (jamais l'objet Prisma). `personneEmail`, `personneTelephone`, `personneNom`, `note`, `litigeMotif`,
   `noteInterne`, `iban` ne sont dans aucun `select`.
4. **Pièces PDF** (`ESP/mes-commissions/piece/[numero]/route.ts`) : le numéro demandé doit appartenir
   à une ligne `commissions_apporteur` de **cet** apporteur (`autofactureNumero` ou `avoirNumero`) ; la
   clé de stockage est reconstruite côté serveur à partir de l'`apporteurId` du lien, jamais lue dans
   l'URL ; réponse 404 identique pour « inconnu » et « pas à vous » ; en-têtes `no-store` ; limite de
   débit, comme `ESP/contrat/route.ts:43-47`.
5. **Aucun agrégat inter-apporteurs** dans l'espace : pas de moyenne, pas de « N apporteurs ont
   atteint », pas de rang.
6. **Mode restreint** et statuts non signés : pas d'encart challenge ; « Mes commissions » réduit
   (Question 12).
7. **Console** : lectures sous `gardePage`, écritures sous `sessionArgent()`, journal à chaque geste,
   identifiants validés (`uuid`) avant toute requête.
8. **Stub de build** (`stub.invalid`) : les pages sont `force-dynamic`, donc non rendues au build ;
   les fonctions de lecture refusent la base factice comme `lireDossierParLien` (`AR/donnees.ts:288`).

### 5.2 Tests IDOR à écrire

Unitaires (base simulée), à côté des pages et dans `AR/__tests__/` :

| Fichier proposé                                                                 | Ce qu'il prouve                                                                                                                                                  |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ESP/mes-commissions/un-apporteur-ne-lit-que-ses-commissions.spec.tsx`          | Avec le lien de A, aucune requête ne porte l'identifiant de B ; chaque `findMany` sur `commissionApporteur` et `presentationEntreprise` porte `apporteurId = A`. |
| `ESP/mes-commissions/le-lien-fait-foi-pas-l-url.spec.tsx`                       | Un paramètre `?apporteurId=B`, un identifiant B dans le chemin avec le jeton de A, un jeton d'une ancienne `versionLien` → 404, zéro lecture.                    |
| `ESP/mes-commissions/piece/la-piece-d-un-autre-est-introuvable.spec.ts`         | Numéro d'autofacture de B demandé avec le lien de A → 404, même corps et mêmes en-têtes que pour un numéro inexistant ; aucun appel au stockage.                 |
| `AR/__tests__/mes-commissions-ne-lit-aucune-coordonnee.spec.ts`                 | Analyse statique des `select` : aucun des champs interdits (§ 5.1, règle 3).                                                                                     |
| `AR/__tests__/mes-commissions-ne-montre-aucune-marge.spec.ts`                   | Le type de vue n'a aucun champ de coût ; le prix facturé est absent tant que la commande n'est pas soldée.                                                       |
| `AR/__tests__/une-facture-partagee-n-apparait-que-chez-l-attributaire.spec.ts`  | Deux apporteurs, même SIREN : la commande n'apparaît que chez l'attributaire, y compris dans la progression du challenge.                                        |
| `ESP/le-challenge-ne-montre-que-ma-progression.spec.tsx`                        | L'encart de A ne contient aucun nombre issu des données de B (jeu d'essai où B a 9 et A a 1).                                                                    |
| `ESP/le-challenge-est-reserve-aux-apporteurs-signes.spec.tsx`                   | Statuts non signés, mode restreint, lien d'exemple → pas d'encart.                                                                                               |
| `…/apporteurs/challenges/les-ecritures-exigent-l-habilitation-facturer.spec.ts` | `editor`, `reader`, `secretaire`, `responsable_qualite` → refus de créer, publier, annoncer, valider.                                                            |

Intégration (vraie base, `tests/integration/`, première suite du réseau à cet étage) :
`apporteurs-cloisonnement.spec.ts` : deux apporteurs, présentations, factures et commissions croisées ;
on appelle les deux fonctions de lecture et l'on vérifie l'absence de toute fuite, et que le
déclencheur d'immutabilité refuse réellement un `UPDATE`.

Bout en bout (Playwright, `tests/e2e/flows/espace-apporteur-commissions.spec.ts`) : ouverture avec le
lien de A ; tentative avec l'identifiant de B ; contrôle axe ; aucune requête réseau hors de la page.

### 5.3 Garde-fous juridiques transformés en tests

| Exigence                                 | Verrou                                                                                                                                                                                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Un seul message par challenge            | `AR/__tests__/un-seul-message-par-challenge.spec.ts` : le seul gabarit dont le nom contient `challenge` est `apporteur-challenge-annonce` ; un second appel de l'action d'envoi est refusé.                                           |
| Aucune relance, aucun compte à rebours   | `AR/__tests__/le-passage-quotidien-n-ecrit-pas-aux-apporteurs-sur-un-challenge.spec.ts` : `passage-quotidien.ts` et les workers n'importent aucun envoi lié à un challenge ; aucun job différé ni répété ne porte le mot.             |
| Aucune formule de pression               | `AR/__tests__/les-textes-de-challenge-ne-pressent-personne.spec.ts` : liste d'expressions interdites (§ 4.3) appliquée aux fichiers de textes, au gabarit, **et** au règlement et à l'annonce saisis (validation à l'enregistrement). |
| Aucun classement                         | Le type de vue de l'espace n'a aucun champ de rang ni de nombre de participants ; le tableau de la console est trié par nom (test sur l'ordre).                                                                                       |
| Mêmes conditions pour tous               | Le modèle n'a **aucun** champ « apporteurs concernés » ni seuil individuel ; test de schéma qui échoue si un tel champ apparaît.                                                                                                      |
| Aucun plafond ni quota de présentations  | Test : aucune règle de challenge ne lit le nombre de présentations ; `AR/declaration-regles.ts` n'importe rien des challenges.                                                                                                        |
| Aucune sanction                          | Test : aucun module de `manquement`, `resiliation`, `retrait` n'importe les challenges.                                                                                                                                               |
| Validation manuelle avant tout versement | Test : la seule fonction qui crée une ligne `prime_challenge` est l'action de validation, sous `sessionArgent()` ; le passage quotidien ne fait que constater.                                                                        |
| Pas de prime sans SIREN actif            | Test : registre « inactif » ou « inconnu » → validation refusée.                                                                                                                                                                      |
| Règlement figé                           | Test d'intégration du déclencheur ; test de l'action.                                                                                                                                                                                 |

---

## 6. Découpage en lots

### 6.1 Interrupteurs (tous éteints par défaut, valeur exacte `"true"` pour allumer)

| Clé                                       | Cible              | Ce qu'elle ouvre                                                                            |
| ----------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------- |
| `APPORTEUR_MES_COMMISSIONS_ENABLED`       | site               | Page « Mes commissions », son lien, le téléchargement des pièces.                           |
| `APPORTEUR_MES_COMMISSIONS_AMONT_ENABLED` | site               | Les états d'avant encaissement (devis, facture). Éteint : l'écran ne montre que le certain. |
| `APPORTEUR_CHALLENGES_CONSOLE_ENABLED`    | site               | Écrans de la console (liste, création, publication, suivi).                                 |
| `APPORTEUR_CHALLENGES_ESPACE_ENABLED`     | site               | Encart dans l'espace.                                                                       |
| `APPORTEUR_CHALLENGES_ANNONCE_ENABLED`    | site               | Bouton d'envoi de l'annonce.                                                                |
| `APPORTEUR_CHALLENGES_PRIME_ENABLED`      | site **et** worker | Constat du seuil, validation, création de la ligne de prime.                                |

Chaque clé est ajoutée à la liste fermée de `.github/workflows/coolify-drapeau.yml` et documentée dans
un nouveau `docs/apporteurs-interrupteurs.md` (lot 0). Ordre d'allumage conseillé : § 6.4.

### 6.2 Partie 1

| Lot                   | Contenu                                                                                                                                                                                                                                 | Fichiers autorisés                                                                                                                                                                                                                                                 | Tests                                                                                                                        | Dépend de  |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **0**                 | Déclaration des six interrupteurs (lecture seule, aucun effet) et leur documentation.                                                                                                                                                   | `AR/interrupteurs.ts` (nouveau), `.github/workflows/coolify-drapeau.yml`, `docs/apporteurs-interrupteurs.md`, tests                                                                                                                                                | Chaque clé citée est posable par le workflow ; « éteint » si la valeur n'est pas exactement `"true"`.                        | —          |
| **P1**                | Règles pures de la frise et des totaux (§ 3.7, § 4.1.2).                                                                                                                                                                                | `AR/mes-commissions-regles.ts`, `AR/__tests__/mes-commissions-regles.spec.ts`                                                                                                                                                                                      | Table de vérité de tous les états ; priorité de l'état courant ; totaux avec reprise et solde négatif.                       | —          |
| **P2**                | Lecture cloisonnée, **après encaissement seulement** (présentations + commissions).                                                                                                                                                     | `AR/mes-commissions-lecture.ts`, tests                                                                                                                                                                                                                             | Tests IDOR unitaires 1, 4, 5 du § 5.2.                                                                                       | P1         |
| **P3**                | Lecture des états d'amont (devis, factures) par la règle d'attribution. Peut demander d'extraire `presentationPourEtablissement` et `dateDeCommande` de `passage-quotidien.ts` vers un module pur, **sans en changer le comportement**. | `AR/mes-commissions-amont.ts`, `AR/attribution-regles.ts` (extraction), `AR/passage-quotidien.ts` (imports seulement), tests                                                                                                                                       | Test « facture partagée » ; test de non-régression : le passage quotidien rend le même résultat avant et après l'extraction. | P1         |
| **P4**                | La page, ses textes, le lien depuis l'accueil, l'état vide.                                                                                                                                                                             | `ESP/mes-commissions/page.tsx`, `ESP/mes-commissions/textes.ts`, `ESP/mes-commissions/*.tsx` (composants serveur), `ESP/page.tsx` (un lien), `ESP/commissions/page.tsx` (libellé du lien de retour), tests, `tests/e2e/flows/espace-apporteur-commissions.spec.ts` | Tests de page ; « le lien fait foi » ; axe ; `pnpm bundle:check` inchangé à l'octet près côté public.                        | 0, P2      |
| **P5**                | Téléchargement des autofactures et avoirs.                                                                                                                                                                                              | `ESP/mes-commissions/piece/[numero]/route.ts`, test                                                                                                                                                                                                                | « La pièce d'un autre est introuvable ».                                                                                     | P2         |
| **P6**                | Console : « Voir ce que l'apporteur voit ».                                                                                                                                                                                             | `…/apporteurs/[id]/apercu-commissions/page.tsx`, `…/apporteurs/[id]/page.tsx` (un lien), test                                                                                                                                                                      | Garde de page ; même fonction de lecture que l'espace.                                                                       | P2         |
| **P7** _(facultatif)_ | État « rendez-vous pris » : table de lien présentation ↔ rendez-vous, posée par un geste de la console.                                                                                                                                 | migration dédiée, `AR/rendez-vous-presentation.ts`, écran console, règle de frise                                                                                                                                                                                  | Migration additive ; cloisonnement.                                                                                          | Question 4 |

### 6.3 Partie 2

| Lot     | Contenu                                                                                                                                                                                                    | Fichiers autorisés                                                                                                                                                                                                                                        | Tests                                                                                                   | Dépend de                |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------ |
| **C1**  | Migration, modèles, objets SQL, donnée d'exemple, RGPD. **Aucun code ne lit ces tables.**                                                                                                                  | `prisma/schema.prisma`, `prisma/migrations/…_apporteurs_challenges/{migration,rollback}.sql`, `prisma/objets-sql-bruts.ts`, `src/lib/rgpd-reseau-apporteur.ts`, `src/lib/rgpd-erase.ts`, `tests/unit/ci/apporteurs-challenges-migration-additive.spec.ts` | Migration additive ; annotations `rgpd` ; objet SQL brut déclaré.                                       | Questions 2, 6 tranchées |
| **C2**  | Règles pures (§ 3.1 à 3.5).                                                                                                                                                                                | `AR/challenge-regles.ts`, `AR/__tests__/challenge-regles.spec.ts`                                                                                                                                                                                         | Tous les cas limites du § 3.5, un test par ligne du tableau.                                            | —                        |
| **C3**  | Lecture : commandes Journée IA par apporteur, progression. Réutilise l'extraction du lot P3.                                                                                                               | `AR/challenge-lecture.ts`, tests                                                                                                                                                                                                                          | Deux apporteurs ; commande à attribuer ; avoirs.                                                        | C1, C2, P3               |
| **C4**  | Console : liste, création, modification, publication.                                                                                                                                                      | `…/apporteurs/challenges/**`, `AR/actions-challenges.ts`, `src/lib/admin-nav.ts`, `src/lib/admin-nav.test.ts`, tests                                                                                                                                      | Habilitation ; immutabilité ; chevauchement ; formules interdites.                                      | 0, C1                    |
| **C5**  | Console : suivi par apporteur et décisions par facture.                                                                                                                                                    | `…/apporteurs/challenges/[id]/suivi/**`, `AR/actions-challenges.ts`, tests                                                                                                                                                                                | Tri alphabétique ; journal.                                                                             | C3, C4                   |
| **C6**  | **Worker d'abord** : savoir lire une ligne `prime_challenge` (libellé d'autofacture, exclusions du classement d'activité, de la part de parrainage, de `etatPrestation`). Aucune ligne n'est encore créée. | `AR/autofacture-donnees.ts`, `AR/commissions.ts`, `AR/prestation-presentation.ts`, `AR/requetes-console.ts`, `…/apporteurs/commissions/page.tsx` (libellé), tests                                                                                         | Une ligne `prime_challenge` simulée donne une autofacture correcte en franchise et en assujetti ; DAS2. | —                        |
| **C7**  | Constat du seuil (passage quotidien, alerte interne unique), validation manuelle, création de la ligne. **Créneau de mise en ligne postérieur à C6.**                                                      | `AR/challenge-prime.ts`, `AR/passage-quotidien.ts` (une étape, sous interrupteur), `AR/actions-challenges.ts`, `…/apporteurs/challenges/[id]/primes/**`, tests                                                                                            | « Seule la validation crée la ligne » ; registre inactif ou inconnu ; double clic ; vigilance.          | C3, C4, C6 en ligne      |
| **C8**  | Espace : l'encart et la page du règlement.                                                                                                                                                                 | `ESP/challenge/**`, `ESP/page.tsx` (un bloc), `ESP/mes-commissions/page.tsx` (un bloc), tests                                                                                                                                                             | Cloisonnement de l'encart ; formules interdites ; statuts.                                              | 0, C3                    |
| **C9**  | Annonce : gabarit, aperçu, envoi unique. Le gabarit porte un `gabaritRepli`, et le worker doit le connaître avant le premier envoi (PR ou créneau précédent).                                              | `src/lib/email/templates/apporteur-challenge-annonce.tsx`, les quatre registres de gabarits, `AR/envois.ts`, `AR/actions-challenges.ts`, bloc console, tests                                                                                              | « Un seul message » ; aperçu masqué ; apporteurs retirés exclus.                                        | C4                       |
| **C10** | Reprise d'une prime versée (proposition, confirmation).                                                                                                                                                    | `AR/challenge-prime.ts`, `…/challenges/[id]/primes/**`, tests                                                                                                                                                                                             | Remboursement après versement ; reprise entière ; 24 mois.                                              | C7                       |

### 6.4 Ordre et parallélisme

```
Vague 1 (en parallèle) : 0 · P1 · C2 · C6
Vague 2 (en parallèle) : P2 · P3 · C1
Vague 3 (en parallèle) : P4 · P5 · P6 · C3 · C4
Vague 4 (en parallèle) : C5 · C8 · C9
Vague 5                : C7   (après mise en ligne effective de C6)
Vague 6                : C10
```

Collisions à éviter : `AR/actions-challenges.ts` est touché par C4, C5, C7, C9 → une seule session le
tient à la fois, ou un fichier d'actions par lot (`actions-challenges-suivi.ts`, etc., recommandé).
`ESP/page.tsx` est touché par P4 et C8 → C8 après P4. `AR/passage-quotidien.ts` par P3 et C7.

Allumage conseillé : (1) `…_CONSOLE` ; le dirigeant relit le challenge d'exemple ; (2)
`…_MES_COMMISSIONS` après recette par « Voir ce que l'apporteur voit » ; (3) `…_AMONT` ; (4)
`…_ESPACE` ; (5) publication du challenge ; (6) `…_ANNONCE`, envoi ; (7) `…_PRIME` sur le worker puis
sur le site, avant qu'un apporteur puisse atteindre le seuil.

**Calendrier.** Le challenge d'exemple commence le 1er décembre 2026, dans six jours. Le minimum pour
le publier honnêtement est : 0, C1, C2, C3, C4, C8 (un apporteur voit la règle et sa progression).
C6, C7, C9, C10 peuvent suivre en décembre : aucune prime ne peut être due avant que 10 Journées
soient payées. Si ce minimum n'est pas en ligne à temps, recommandation : décaler la période plutôt que
publier un challenge dont la progression n'est pas visible (Question 13).

---

## 7. Questions ouvertes pour le dirigeant

| N°     | Question                                                                                                                                                                                                                             | Recommandation                                                                                                                                                                                                                                                                                                                        |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1**  | « Entreprise gardée 60 jours » : le contrat et le code disent **6 mois** à compter de la déclaration (+ 3 mois une fois). Faut-il changer la durée, ou seulement le mot ?                                                            | **Ne rien changer à la durée** (ce serait un avenant au contrat). Écrire « Entreprise réservée jusqu'au … » avec la date exacte, sans citer de durée.                                                                                                                                                                                 |
| **2**  | Comment reconnaît-on une Journée IA dans une facture ? Aujourd'hui, rien ne le dit.                                                                                                                                                  | Faire porter `offreTierId = "journee-ia"` par la ligne du devis (à vérifier : l'éditeur de devis le propose-t-il déjà ?), et garder la correction manuelle par facture, motivée et journalisée, pour les factures déjà émises ou saisies autrement. **Bloquant pour C1 et C3.**                                                       |
| **3**  | Quelle commission pour une Journée IA ? `pricing.ts` dit « aucune tant que Williams ne l'a pas tranchée ». Sans palier, chaque Journée IA vendue par un apporteur naît « à qualifier » puis « hors grille » (60 jours pour décider). | Trancher **avant** de publier le challenge : un challenge sur un produit dont la commission n'est pas fixée est difficile à défendre. Proposition à valider : un palier `journee-ia` dans l'annexe 1, ce qui suppose une nouvelle version de la grille acceptée par les apporteurs (contrat, art. 4).                                 |
| **4**  | « Rendez-vous pris » : aucune donnée fiable ne relie un rendez-vous à une présentation.                                                                                                                                              | **Ne pas l'afficher au premier lot.** Si l'état compte, lot P7 : le lien est posé par un geste dans la console quand le rendez-vous est fixé. Un rapprochement automatique par e-mail ou par SIREN afficherait parfois le rendez-vous d'un autre contexte.                                                                            |
| **5**  | Commande facturée en deux fois (acompte en décembre, solde en janvier) : compte-t-elle pour décembre ?                                                                                                                               | **Oui**, à la date de la première facture. La règle est simple à expliquer et ne dépend pas d'un choix d'échéancier fait par la Société.                                                                                                                                                                                              |
| **6**  | Jusqu'à quand un paiement client compte-t-il ? Sans date, un challenge de décembre reste ouvert indéfiniment.                                                                                                                        | Fixer une date dans le règlement : **31 mars 2027** (90 jours après la fin). À écrire avant publication, puisque rien ne peut changer après.                                                                                                                                                                                          |
| **7**  | Une Journée IA vendue à prix réduit compte-t-elle ?                                                                                                                                                                                  | **Oui, pour 1**, dès que le prix net est supérieur à zéro : le prix est décidé par la Société. Une Journée offerte ne compte pas.                                                                                                                                                                                                     |
| **8**  | 20 Journées : deux primes ?                                                                                                                                                                                                          | **Une seule prime par apporteur et par challenge.** Un palier répété ressemblerait à un barème d'objectifs.                                                                                                                                                                                                                           |
| **9**  | Apporteur résilié ou retiré entre l'atteinte du seuil et la validation : prime due ?                                                                                                                                                 | **Oui si le seuil a été atteint pendant que le contrat était en cours** (droit né avant la fin du contrat), versée par le circuit des commissions après la fin, comme le reste. À confirmer par le conseil ; le plan actuel exige le contrat en cours **au constat**.                                                                 |
| **10** | Carte « En attente du paiement du client » : afficher une commission estimée ?                                                                                                                                                       | **Non au premier lot** : seulement le nombre d'affaires. Une estimation deviendrait une promesse si le client obtient un avoir.                                                                                                                                                                                                       |
| **11** | Parrainage : montrer au parrain le nom de l'entreprise cliente de son filleul ?                                                                                                                                                      | **Non.** Afficher « Parrainage », le mois et le montant. Le parrain n'a pas présenté cette entreprise.                                                                                                                                                                                                                                |
| **12** | Apporteur retiré avec de l'argent en jeu : voit-il « Mes commissions » ?                                                                                                                                                             | **Oui, en version réduite** : à verser, versé, pièces. C'est son argent ; l'empêcher de le voir serait plus risqué que de le montrer.                                                                                                                                                                                                 |
| **13** | Si les lots minimaux ne sont pas en ligne le 1er décembre ?                                                                                                                                                                          | **Décaler la période** (par exemple 15 décembre – 15 janvier, ou janvier entier) plutôt que publier sans progression visible.                                                                                                                                                                                                         |
| **14** | La prime est-elle couverte par le mandat d'autofacturation (contrat, art. 5.2 et annexe 2), qui vise « les commissions » ?                                                                                                           | Faire relire par le conseil. Solution la plus sûre : le règlement dit que la prime est un **complément de commission**, facturé sous le même mandat, et l'apporteur garde la faculté d'émettre lui-même sa facture. Si le conseil exige une acceptation, une case à cocher dans l'espace suffit, et elle ne vaut **pas** inscription. |
| **15** | Les 2 000 € sont-ils HT ?                                                                                                                                                                                                            | **Oui, HT**, comme toutes les commissions (contrat, art. 4.7) : 2 400 € TTC pour un apporteur soumis à la TVA, 2 000 € en franchise.                                                                                                                                                                                                  |
| **16** | Qui peut créer, publier et valider ? Il n'existe pas de rôle « dirigeant ».                                                                                                                                                          | L'habilitation `facturer` (rôles `super_admin` et `admin`), comme pour « Virement fait ». Si le dirigeant veut être **seul**, il faut un acte `valider_prime` réservé à `super_admin` dans la matrice des habilitations (petit lot à part).                                                                                           |
| **17** | Peut-on archiver un challenge publié pendant sa période ?                                                                                                                                                                            | **Oui, mais les droits déjà nés restent** : l'archivage retire l'encart, pas les Journées déjà facturées ni une prime acquise. À écrire dans le règlement type.                                                                                                                                                                       |
| **18** | Commande « à attribuer » non encore décidée : la montrer aux apporteurs candidats ?                                                                                                                                                  | **Non** avant la décision (elle révélerait qu'un autre apporteur est candidat). Après : chez l'attributaire seulement.                                                                                                                                                                                                                |

---

## Annexe : ce que ce plan ne fait pas

- Il ne modifie ni le contrat, ni la grille de l'annexe 1, ni aucun texte publié.
- Il ne propose aucun envoi automatique à un apporteur autre que l'annonce unique.
- Il ne crée aucun classement, y compris interne.
- Il ne touche pas au calcul des commissions existantes : l'extraction du lot P3 est à comportement
  constant et prouvée par un test de non-régression.
