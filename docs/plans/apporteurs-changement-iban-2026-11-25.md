# Apporteurs d'affaires : changer son IBAN après la signature du contrat

Plan de conception et d'audit (sécurité, argent). **Aucun code dans ce document.**
Date : 25/11/2026. Base lue : `origin/main` au commit `3151c61a`.

## 0. Résumé

- Aujourd'hui, un apporteur au contrat signé ne peut plus toucher à son IBAN : la seule
  écriture (`enregistrerActivite`, `src/features/apporteurs-reseau/donnees.ts`) n'est ouverte
  que pour un dossier « en cours » ou « à compléter ».
- Le lien personnel de l'espace vaut mot de passe, n'expire pas, et se retrouve par simple
  saisie de l'adresse e-mail (« Retrouver mon espace »). **Un changement d'IBAN ne doit donc
  jamais reposer sur le lien seul.**
- Proposition : l'apporteur **demande** ; rien ne change sur sa fiche. La demande passe par
  quatre barrières, dans cet ordre : confirmation par e-mail à l'adresse connue, délai
  d'opposition de 72 heures, contrôle du RIB et rappel téléphonique par l'administrateur,
  validation dans la console. L'ancien IBAN reste celui des virements jusqu'à la validation,
  puis il est gardé dans un historique, jamais supprimé.
- Le dépôt a déjà ce circuit pour les formateurs indépendants
  (`src/server/qualiopi/formateurs-independants/changements-coordonnees.ts`, modèle
  `DemandeChangementFormateur`). Ce plan reprend ses règles et ajoute ce que le lien sans
  session rend nécessaire (confirmation par e-mail, opposition en un clic).
- Modèle de données : **quatre tables nouvelles, sans clé étrangère, aucune colonne ajoutée
  à `apporteurs_reseau`**, aucune valeur ajoutée à une énumération existante.
- Les autofactures déjà émises ne portent pas d'IBAN : elles ne changent pas.
- Six décisions sont à prendre par Will avant le premier lot de code (section 9).

## 1. Ce qui existe (lu dans le code)

| Sujet                       | Constat                                                                                                                                                                                                                                                                            | Source                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Stockage de l'IBAN          | Colonne `iban` de `apporteurs_reseau`, chiffrée par `encryptPii` (sans donnée liée à la ligne), normalisée sans espaces et en majuscules.                                                                                                                                          | `prisma/schema.prisma` (`ApporteurReseau`), `donnees.ts`     |
| Écriture de l'IBAN          | Une seule : `enregistrerActivite`, appelée par l'action de l'étape 2 du dossier, gardée par `dossierModifiableParLien` (statuts `dossier_en_cours` et `a_completer`).                                                                                                              | `src/app/apporteur/dossier/[id]/[jeton]/actions.ts`          |
| Affichage                   | Toujours masqué (`FR76 •••• •••• 1234`) : espace et console. `lireIban` (IBAN en clair) existe mais **n'a aucun appelant**.                                                                                                                                                        | `donnees.ts`, fiche console                                  |
| Lien personnel              | `jeton = HMAC(id + versionLien)`, rien n'est stocké, pas de date de fin. Coupé en augmentant `versionLien` (retrait, résiliation, refus, effacement).                                                                                                                              | `jeton.ts`                                                   |
| Retrouver son lien          | Formulaire public : l'adresse saisie reçoit le lien si elle est celle d'une fiche. **Qui lit la boîte e-mail de l'apporteur obtient donc le lien.**                                                                                                                                | `src/app/apporteur/dossier/retrouver/actions.ts`             |
| Adresse e-mail et téléphone | Plus modifiables par l'apporteur après la signature. Je n'ai trouvé aucune action de console qui change l'adresse e-mail d'une fiche.                                                                                                                                              | `donnees.ts`, `actions-identite.ts`, `correction-nom.ts`     |
| Espace « signé »            | Contrat à télécharger, déclaration d'entreprise, grille, outils, pièces de vigilance. Rien sur le compte bancaire.                                                                                                                                                                 | `page.tsx` de l'espace                                       |
| RIB                         | Pièce `rib` exigée pour signer. Un nouveau dépôt du même type **purge les octets de l'ancien**.                                                                                                                                                                                    | `deposerPiece`, `donnees.ts`                                 |
| Autofacture                 | Aucun IBAN dans les données ni dans le PDF de l'autofacture.                                                                                                                                                                                                                       | `autofacture-donnees.ts`, `commissions.ts`, `facturation.ts` |
| Virement                    | Fait à la main, hors du site. « Virement fait » (`marquerVerse`) passe les commissions à `versee`. **Rien n'enregistre sur quel compte le virement est parti.**                                                                                                                    | `facturation.ts`, `actions-commissions.ts`                   |
| Vue commune                 | `lireVirementsSortants` met côte à côte apporteurs et formateurs, en lecture seule.                                                                                                                                                                                                | `src/server/paiements-sortants/virements.ts`                 |
| Parrainage                  | Refus du rattachement si parrain et filleul ont le même IBAN ; le contrat prévoit une suspension si l'identité de compte « apparaît en cours de contrat ».                                                                                                                         | `parrainage.ts`, `contrat-v2.ts` (art. 4.6)                  |
| Contrat                     | Art. 6.3 : l'apporteur signale tout changement de coordonnées bancaires sous quinze jours et supporte les sommes versées sur des coordonnées erronées qu'il a déclarées. Art. 5.4 : pas de versement sans coordonnées bancaires à son nom. L'IBAN n'est pas écrit dans le contrat. | `contrat-v2.ts`                                              |
| Journal                     | `journaliser` (`src/server/journal/journaliser.ts`) masque les IBAN dans `changes` et sait lever si la trace échoue (`exiger: true`). Les modules apporteurs écrivent aujourd'hui dans `activityLog` par des `tracer` locaux tolérants.                                            | `journaliser.ts`, `ajustement.ts`                            |
| Empreinte d'IBAN            | `empreinteIban` (HMAC, secret `IBAN_EMPREINTE_SECRET`), utilisée par les formateurs. Sans secret : pas d'empreinte, et l'appelant doit refuser.                                                                                                                                    | `src/lib/iban-empreinte.ts`                                  |
| Effacement RGPD             | Dossier contresigné ou avec commissions : conservé (obligation légale), IBAN gardé, lien coupé. Sinon : IBAN mis à `null`.                                                                                                                                                         | `src/lib/rgpd-erase.ts`                                      |
| Export RGPD                 | L'IBAN de la fiche est rendu déchiffré à la personne.                                                                                                                                                                                                                              | `src/lib/rgpd-reseau-apporteur.ts`                           |

## 2. Menaces et garde-fous

### 2.1 Qui peut attaquer, et avec quoi

| #   | Attaquant                                                  | Ce qu'il a                                                                                     | Ce qu'il tente                                                                                  |
| --- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| M1  | Un tiers                                                   | Le lien personnel seul (e-mail transféré, historique d'un navigateur partagé, capture d'écran) | Remplacer l'IBAN par le sien                                                                    |
| M2  | Un tiers                                                   | La boîte e-mail de l'apporteur (donc le lien, et les e-mails de confirmation)                  | La même chose, en confirmant lui-même                                                           |
| M3  | Un proche ou un associé                                    | Le lien, parfois la boîte, parfois le téléphone                                                | La même chose, avec un RIB vraisemblable                                                        |
| M4  | Un tiers                                                   | Rien                                                                                           | Faire envoyer des e-mails d'alerte en masse, ou deviner si une adresse est celle d'un apporteur |
| M5  | Un compte de console compromis ou un administrateur pressé | Un accès à la console                                                                          | Valider sans contrôler                                                                          |
| M6  | L'apporteur lui-même                                       | Son espace                                                                                     | Nier après coup avoir demandé le changement                                                     |

M1 est la menace principale. M2 est la plus dure : l'e-mail ne protège plus, seul le
contrôle humain (RIB, rappel au numéro connu) arrête l'attaque.

### 2.2 Les barrières, dans l'ordre

1. **Rien ne change sur la fiche à la demande.** La demande vit dans sa propre table.
   L'ancien IBAN reste celui des virements. (Arrête M1, M2, M3 tant que personne n'a validé.)
2. **Le RIB du nouveau compte est obligatoire**, déposé avec la demande (contrôle commun du
   dépôt : format, taille, antivirus, chiffrement au repos). Il est rangé avec la demande et
   **ne remplace pas** le RIB actuel : il n'emprunte pas `deposerPiece`, qui purgerait l'ancien.
3. **Confirmation par e-mail à l'adresse connue de la fiche.** L'adresse n'est jamais lue dans
   le formulaire. Le lien de confirmation est signé (fabrique `@/lib/security/lien-signe`,
   domaine propre, rien de stocké), lié à l'identifiant de la demande, valable 24 heures, et
   ne sert qu'une fois (la demande change d'état). **La page ouverte par ce lien ne confirme
   rien à l'affichage** : elle montre un bouton, et seul l'envoi du formulaire confirme. Sinon
   un antivirus de messagerie qui ouvre les liens confirmerait à la place de la personne.
   (Arrête M1.)
4. **Alerte immédiate à la même adresse**, dans le même e-mail : « Ce n'est pas vous ? » avec
   un lien d'opposition. L'opposition annule la demande, **coupe le lien personnel**
   (`versionLien` + 1), envoie un lien neuf à l'adresse connue et alerte l'administrateur.
   S'opposer est toujours possible tant que la demande n'est pas validée. (Arrête M1 ; laisse
   une trace contre M3.)
5. **Délai d'opposition de 72 heures** à partir de la confirmation. Avant, la console refuse la
   validation, côté serveur. C'est aussi le **délai de carence** : comme l'IBAN de la fiche ne
   change qu'à la validation, aucun virement ne peut partir vers le nouveau compte moins de
   72 heures après la confirmation. (Laisse à la vraie personne le temps de voir l'alerte.)
6. **Validation manuelle dans la console**, par un rôle qui peut `facturer`. L'outil prépare
   les contrôles, l'administrateur décide (section 5.2). Deux cases obligatoires, vérifiées
   côté serveur : « J'ai comparé le RIB » et « J'ai rappelé l'apporteur au numéro de sa
   fiche ». Le rappel est la seule barrière contre M2. (Arrête M2, M3.)
7. **À la validation**, dans une seule transaction : la demande passe à « validée » ; l'ancien
   IBAN chiffré est copié dans l'historique ; le nouvel IBAN est rechiffré pour la fiche ; le
   lien personnel est renouvelé (`versionLien` + 1) ; le journal est écrit avec
   `exiger: true` (sans trace, pas de changement). Puis un e-mail de confirmation part.
8. **Premier virement sur le nouveau compte** : la console l'affiche en clair (« premier
   virement sur ce compte ») et « Virement fait » enregistre sur quel compte l'argent est
   parti (section 4.3). (Limite M5, répond à M6.)
9. **Limites d'usage.** Une seule demande ouverte par apporteur (index unique partiel). Trois
   demandes au plus par période de 30 jours. Limite de débit par IP hachée sur chaque action,
   **fermée en cas de panne de Redis** (un e-mail part : même règle que « Retrouver mon
   espace »). Les réponses de l'espace ne disent jamais si une adresse existe. (Arrête M4.)
10. **Compte déjà connu ailleurs.** À la demande puis à la validation, l'empreinte du nouvel
    IBAN est comparée aux IBAN des autres apporteurs, à ceux du parrain et des filleuls
    (art. 4.6) et aux demandes passées, y compris refusées ou contestées. Une égalité
    n'interdit rien toute seule : elle s'affiche en rouge dans la console et, pour le
    parrainage, propose la suspension prévue au contrat.
11. **Preuve.** Chaque étape est horodatée dans la demande (créée, confirmée, opposée,
    validée ou refusée, par qui), avec l'IP hachée et le navigateur résumé de la demande et
    de la confirmation, comme pour la signature du contrat. (Répond à M6.)

### 2.3 Ce que ces barrières ne couvrent pas

- **Boîte e-mail et téléphone compromis ensemble** (M3 poussé au bout) : seul l'examen du RIB
  reste. D'où la règle affichée dans la console : le titulaire du compte écrit sur le RIB
  doit être l'apporteur ou son entreprise (art. 5.4), sinon refus.
- **Un RIB falsifié au bon nom.** Aucune vérification bancaire automatique n'est prévue
  (pas de service de contrôle du titulaire dans le dépôt). C'est un risque accepté, à
  réduire par le rappel téléphonique.
- **Console compromise.** La validation par une seule personne reste possible. Une
  validation à deux personnes est hors de ce plan (décision D-6).

### 2.4 Qui peut demander

- Seulement une fiche au statut `signe`, non retirée du réseau, dont l'IBAN actuel est lisible.
- Dossier « à vérifier » : pas de demande. L'administrateur peut déjà rouvrir le dossier
  (« à compléter »), et l'IBAN se corrige alors à l'étape 2, comme aujourd'hui.
- Fiche retirée (mode restreint) ou résiliée avec de l'argent encore dû : pas de demande
  depuis l'espace dans la première version. L'administrateur ouvre la demande depuis la
  console au nom de l'apporteur (lot 8) ; elle suit **les mêmes barrières**, e-mail de
  confirmation et délai compris.

## 3. Modèle de données

### 3.1 Contraintes du déploiement à deux conteneurs

AGENTS.md, sections « DEUX conteneurs » et « D8b » : pendant une mise en ligne, l'application
et le worker ne tournent pas le même code, et l'ordre peut aller dans les deux sens. La
migration est jouée par le conteneur de l'application. Conséquences retenues :

- **Aucune colonne ajoutée à `apporteurs_reseau`.** Le worker lit cette table sans liste de
  colonnes à plusieurs endroits : un client Prisma plus récent que la base y échouerait.
  C'est la raison écrite sur `ApporteurReseauRetrait` et `ApporteurReseauSiret`.
- **Aucune valeur ajoutée à une énumération existante** (`TypePieceApporteur`,
  `ApporteurReseauStatut`, `StatutCommissionApporteur`). Un ancien conteneur qui lirait une
  valeur inconnue lèverait. Le RIB de la demande ne devient donc pas un nouveau type de pièce.
- **Tables nouvelles, sans clé étrangère**, lues seulement par du code nouveau. Tout lecteur
  tolère la table absente (erreur Prisma `P2021` : « pas de demande »), comme `retraitDe`.
- **Aucune nouvelle forme de tâche BullMQ.** Les e-mails passent par la file existante.
- **Nouveaux noms de gabarit d'e-mail** : le worker doit les connaître avant que
  l'application les émette. D'où un lot « gabarits » fusionné et mis en ligne un créneau
  avant le lot qui émet, plus `gabaritRepli` dans chaque charge (section 6.1).
- **L'expiration d'une demande se calcule à la lecture** (date de création + 24 heures), sans
  tâche planifiée. Seule la purge des RIB des demandes closes passe par le worker (lot 7),
  tolérante à la table absente.
- Le worker n'a pas besoin d'`IBAN_EMPREINTE_SECRET` : demande, confirmation, validation et
  « Virement fait » tournent dans l'application.

### 3.2 Tables proposées (additif : aucun `DROP`, aucun renommage, aucune suppression)

Noms indicatifs. Chaque modèle porte sa ligne `/// rgpd:` (garde du dépôt).

**A. `apporteur_changements_iban`** : une ligne par demande. Jamais supprimée.

| Colonne                                                           | Type                                                        | Rôle                                                                                                           |
| ----------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `id`                                                              | uuid, clé                                                   | Identifiant, aussi lié au lien de confirmation                                                                 |
| `apporteur_id`                                                    | uuid, sans clé étrangère, indexé                            | La fiche                                                                                                       |
| `statut`                                                          | énumération **nouvelle** `statut_changement_iban_apporteur` | `a_confirmer`, `confirmee`, `validee`, `refusee`, `opposee`, `annulee`, `expiree`                              |
| `iban`                                                            | texte chiffré                                               | IBAN demandé, chiffré avec donnée liée `changement-iban:<id>` et clé exigée. Gardé après la décision (preuve). |
| `iban_empreinte`                                                  | char(64)                                                    | `empreinteIban` du nouvel IBAN                                                                                 |
| `iban_fin4`                                                       | char(4)                                                     | Les quatre derniers caractères, pour l'affichage et les e-mails                                                |
| `ancien_iban_empreinte`, `ancien_iban_fin4`                       | char(64), char(4)                                           | Le compte en place au moment de la demande                                                                     |
| `origine`                                                         | varchar                                                     | `espace` ou `console`                                                                                          |
| `demandee_at`, `demande_ip_hash`, `demande_navigateur`            | horodatage, textes                                          | Preuve de la demande (IP hachée, navigateur résumé)                                                            |
| `avis_envoye_at`                                                  | horodatage, nul                                             | L'e-mail de confirmation et d'alerte est bien parti                                                            |
| `confirmee_at`, `confirmation_ip_hash`, `confirmation_navigateur` | idem                                                        | Preuve de la confirmation                                                                                      |
| `opposee_at`, `annulee_at`                                        | horodatage, nul                                             | Opposition (« ce n'est pas moi ») ou abandon par l'apporteur                                                   |
| `traitee_at`, `traitee_par`                                       | horodatage, uuid, nul                                       | Décision de l'administrateur                                                                                   |
| `motif_refus`                                                     | texte, nul                                                  | Obligatoire en cas de refus                                                                                    |
| `controles`                                                       | JSON, nul                                                   | Les cases cochées à la validation et les alertes affichées (compte déjà connu, parrainage)                     |

Objets en SQL brut dans la migration, comme pour les formateurs : index unique partiel
« une seule demande `a_confirmer` ou `confirmee` par apporteur » ; contrôle « l'IBAN commence
par le préfixe du chiffrement » (jamais en clair) ; contrôle de cohérence (validée ou
refusée exige `traitee_at` et `traitee_par` ; refusée exige un motif) ; déclencheur qui
refuse `DELETE` et `TRUNCATE`.

**B. `apporteur_changements_iban_rib`** : le RIB joint à la demande.
`demande_id` (clé, sans clé étrangère), `octets` chiffrés (même enveloppe que
`pieces-chiffrement.ts`), `sha256` du clair, `type_mime`, `taille`, `nom_fichier`,
`depose_at`, `purge_at`. Lu par une route de console réservée aux administrateurs, avec
verdict antivirus, sur le modèle de la route des pièces.

**C. `apporteur_iban_historique`** : un compte par ligne, ajout seul.
`id`, `apporteur_id`, `iban` chiffré (donnée liée `iban-historique:<id>`), `iban_empreinte`,
`iban_fin4`, `en_vigueur_de` (nul si inconnu), `en_vigueur_jusqua` (nul pour le compte
courant), `origine` (`dossier_initial`, `changement`), `demande_id` (nul). Déclencheur :
ni `DELETE`, ni `TRUNCATE` ; seule la colonne `en_vigueur_jusqua` peut passer de nul à une date.
**L'ancien IBAN y est copié à la validation, dans la même transaction : il n'est jamais perdu.**

**D. `apporteur_virements_compte`** : sur quel compte un virement est parti.
`autofacture_numero` (clé), `apporteur_id`, `iban_empreinte`, `iban_fin4`, `declare_at`,
`declare_par`, `premier_sur_ce_compte` (booléen). Écrit par « Virement fait ». Ajout seul.

### 3.3 Reprise de l'existant

Aucune reprise n'est nécessaire pour mettre en service : l'historique se remplit à la
première validation (l'IBAN en place y entre comme `dossier_initial`). Pour que la
comparaison « compte déjà connu » couvre tout le réseau dès le premier jour, le lot 8
propose un script manuel, rejouable sans risque, qui inscrit le compte courant de chaque
fiche signée dans l'historique (copie du chiffré, calcul de l'empreinte). Il ne modifie
aucune fiche.

### 3.4 Retour arrière

Les tables peuvent rester en place si le code est retiré : rien d'ancien ne les lit. Aucun
script de suppression n'est prévu, à dessein. Si une validation a déjà eu lieu, la fiche
porte le nouvel IBAN et l'historique porte l'ancien : le retour à l'ancien compte se fait
par une nouvelle demande, pas par une écriture à la main.

## 4. Effets sur l'argent

### 4.1 Autofactures et relevés déjà émis

- L'autofacture ne porte pas d'IBAN. **Aucune pièce émise n'est modifiée, annulée ni
  réémise** ; la numérotation `AXI-APP` n'est pas touchée ; aucun avoir n'est créé.
- Le changement ne touche ni le régime de TVA, ni le SIREN, ni l'identité de facturation.
- La déclaration annuelle des honoraires (`das2.ts`, `lignesDas2Apporteurs`) se fonde sur les
  sommes versées par bénéficiaire, pas sur le compte : inchangée.
- Les commissions (`commissions_apporteur`) ne sont pas modifiées par ce chantier.

### 4.2 Virement à faire pendant qu'une demande est ouverte

Le virement se fait à la main, hors du site ; le site ne sait que ce que « Virement fait »
lui déclare. Règle proposée :

- Tant qu'une demande est `a_confirmer` ou `confirmee`, la ligne de l'apporteur dans
  « Virements à faire » (console des commissions et vue commune des paiements sortants)
  porte un bandeau : « Changement de compte demandé le … Compte actuel : se terminant par 1234. Décision possible à partir du … ».
- **L'outil propose d'attendre la décision.** Le compte de la fiche reste le seul valable
  au contrat (art. 6.3), donc virer sur le compte actuel reste permis ; mais si l'apporteur a
  fermé ce compte, le virement reviendra.
- Les délais du contrat restent tenables : objectif de deux jours ouvrés (sans pénalité),
  échéance ferme à trente jours. Le circuit complet prend au moins 72 heures après la
  confirmation. **Une demande non décidée 10 jours après sa confirmation passe en rouge**
  dans la console et déclenche une alerte interne, pour qu'aucune échéance de trente jours ne
  soit dépassée à cause d'une demande oubliée.
- « Virement fait » n'est **pas bloqué** par une demande ouverte (art. 5.4 : aucun autre
  motif ne diffère un versement). Il demande seulement de confirmer le compte utilisé.

### 4.3 « Virement fait » : dire sur quel compte

- À chaque « Virement fait », le site enregistre le compte de la fiche à cet instant
  (empreinte et quatre derniers caractères) dans `apporteur_virements_compte`.
- Pendant 10 jours après une validation, le formulaire demande : « Sur quel compte ce
  virement est-il parti ? » avec deux choix (compte actuel, compte précédent). Cas visé : le
  virement est parti de la banque avant la validation, et « Virement fait » est cliqué après.
- Le premier virement déclaré sur un compte est marqué et affiché comme tel. L'e-mail
  « Votre commission est virée » existant précise alors « sur votre compte se terminant
  par … » (évolution de la charge, rétrocompatible : champ facultatif).

### 4.4 Cas limites

| Cas                                                              | Traitement proposé                                                                                                                                                                 |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Virement parti sur l'ancien compte, fermé depuis                 | Hors du site aujourd'hui (pas d'annulation de « Virement fait » trouvée). À traiter à la main ; voir section 10.                                                                   |
| Demande validée alors qu'une autofacture attend son virement     | Le virement part sur le nouveau compte. Le bandeau disparaît, la mention « premier virement sur ce compte » apparaît.                                                              |
| Opposition après validation                                      | Impossible par le lien d'opposition. La personne écrit ; l'administrateur traite (runbook, lot 7). Si l'argent est déjà parti : rappel de fonds auprès de la banque, hors du site. |
| Apporteur avec commissions suspendues, reprises ou solde négatif | Aucun effet : le changement ne touche qu'au compte.                                                                                                                                |
| Deux demandes en même temps (deux onglets)                       | L'index unique partiel n'en laisse qu'une ; la seconde reçoit « Une demande est déjà en cours ».                                                                                   |
| Validation en double clic                                        | Écriture conditionnée au statut `confirmee` : une seule passe.                                                                                                                     |
| Nouvel IBAN égal à l'actuel                                      | Refus immédiat : « Ce compte est déjà le vôtre chez nous. »                                                                                                                        |
| IBAN hors zone SEPA                                              | Refus par `ibanValide`, comme à l'inscription.                                                                                                                                     |

## 5. Écrans

### 5.1 Espace apporteur (mots simples)

Nouvelle section sur la page « signé », sous le contrat : **« Mon compte bancaire »**.
Page rendue côté serveur ; le formulaire est un petit composant client chargé seulement
sur cette page (hors des 15 pages stratégiques, sans effet sur les budgets de performance).

**État normal**

> **Mon compte bancaire**
> Nous versons vos commissions sur le compte qui se termine par **1234**.
> [Changer de compte]

**Formulaire (après « Changer de compte »)**

> **Changer de compte bancaire**
>
> 1. Votre nouvel IBAN : `[ FR76 … ]`
> 2. Le RIB de ce compte (PDF ou photo) : `[ Choisir un fichier ]`
>    Le compte doit être à votre nom ou à celui de votre entreprise.
>
> **Ce qui va se passer**
>
> - Nous vous envoyons un e-mail. Vous cliquez dessus pour confirmer.
> - Nous vérifions votre RIB et nous vous appelons. Cela prend au moins 3 jours.
> - En attendant, rien ne change : vos commissions restent versées sur votre compte actuel.
>
> [Envoyer ma demande]

**Après l'envoi**

> **Regardez vos e-mails**
> Nous venons de vous écrire à l'adresse **c•••@exemple.fr**.
> Cliquez sur le bouton de cet e-mail pour confirmer. Vous avez 24 heures.
> [Annuler ma demande]

**Demande confirmée, en attente**

> **Demande en cours**
> Vous avez demandé à changer de compte le 25 novembre 2026.
> Nous vérifions votre RIB et nous vous appelons. Réponse au plus tôt le 28 novembre.
> En attendant, vos commissions restent versées sur le compte qui se termine par **1234**.
> [Annuler ma demande]

**Après validation** : l'état normal, avec le nouveau compte, et une ligne :
« Compte changé le 29 novembre 2026. »

**Après refus**

> **Votre demande n'a pas été acceptée**
> Raison : _(texte écrit par l'administrateur)_
> Votre compte n'a pas changé. Vous pouvez faire une nouvelle demande.

**Messages d'erreur** : « Cet IBAN n'est pas valide. Vérifiez-le. » · « Ce compte est déjà
le vôtre chez nous. » · « Ajoutez le RIB du nouveau compte. » · « Une demande est déjà en
cours. » · « Vous avez fait trop de demandes. Écrivez-nous. » · « Ce service est fermé pour
le moment. Écrivez-nous. »

**Page du lien de confirmation** (`/apporteur/dossier/<id>/<jeton>/compte/confirmer/…`,
nom à fixer)

> **Confirmer le changement de compte**
> Vous demandez que vos commissions soient versées sur le compte qui se termine par **5678**.
> [Oui, je confirme]
> Ce n'est pas vous ? [Bloquer cette demande]

Lien expiré, déjà utilisé ou faux : une seule page neutre, « Ce lien ne fonctionne plus. »

**Page d'opposition**

> **Bloquer cette demande**
> Si vous n'avez pas demandé à changer de compte, cliquez ici. Nous annulons la demande et
> nous vous envoyons un nouveau lien pour votre espace.
> [Je n'ai rien demandé : bloquer]
>
> Après le clic : « C'est fait. Votre compte n'a pas changé. Regardez vos e-mails : votre
> nouveau lien y est. Nous vous appelons. »

Règles d'affichage : jamais un IBAN entier, ni l'ancien ni le nouveau ; l'adresse e-mail est
masquée ; aucune de ces pages n'est indexée ni mise en cache ; `referrer` limité, comme la
page de l'espace.

### 5.2 Console (l'outil propose, l'administrateur valide)

**Liste** : nouvelle page `apporteurs/changements-de-compte`, et un compteur sur la page des
apporteurs. Colonnes : apporteur, demandée le, état, validable à partir du, alertes.

**Fiche de l'apporteur** : nouveau bloc « Compte bancaire » avec le compte courant (masqué),
la demande ouverte s'il y en a une, et l'historique des comptes (dates, quatre derniers
caractères, origine).

**Écran de décision d'une demande**, de haut en bas :

1. Bandeau d'état : « Confirmée par e-mail le … Validable à partir du … » (bouton de
   validation grisé avant, et refus côté serveur quoi qu'il arrive).
2. Ce que l'outil a contrôlé, en vert ou en rouge :
   - l'e-mail de confirmation est parti et a été confirmé ;
   - le délai de 72 heures est écoulé ;
   - le RIB est au dossier et l'antivirus l'a jugé sain ;
   - le pays de l'IBAN (changement de pays par rapport à l'ancien compte : orange) ;
   - le compte est-il déjà connu : autre apporteur, parrain ou filleul, demande passée
     refusée ou contestée (rouge, avec le lien vers la fiche concernée) ;
   - nombre de demandes de cet apporteur sur 12 mois ;
   - sommes en attente de virement pour cet apporteur ;
   - la demande et la confirmation viennent-elles du même navigateur et de la même adresse IP
     hachée que la signature du contrat (information, jamais un blocage).
3. Le RIB, ouvert dans la page, à côté de l'IBAN demandé (décision D-3 sur l'affichage
   entier) et du nom de l'apporteur et de son entreprise.
4. Le numéro de téléphone de la fiche, avec la consigne : « Appelez ce numéro. N'appelez
   jamais un numéro reçu par e-mail. »
5. Cases à cocher obligatoires : « Le titulaire du RIB est l'apporteur ou son entreprise » ·
   « L'IBAN du RIB est celui de la demande » · « J'ai parlé à l'apporteur au numéro de sa
   fiche ».
6. Deux boutons : **Valider le changement** (confirmation à retaper : les quatre derniers
   caractères du nouvel IBAN) et **Refuser** (motif obligatoire, envoyé à l'apporteur ;
   aperçu de l'e-mail avant envoi, comme les autres envois de la console).
7. Si le compte est partagé avec le parrain ou un filleul : proposition « Suspendre les
   sommes de parrainage le temps de la vérification (art. 4.6) », décochée par défaut.

**Habilitations** : lire la liste et le RIB, comme les pièces du dossier (administrateurs) ;
valider ou refuser : `peutEngager(role, "facturer")`. Chaque ouverture du RIB ou de l'IBAN
entier est journalisée.

**Virements à faire** : bandeau et choix du compte (section 4).

## 6. E-mails

### 6.1 Règles communes

- Tous partent de `src/features/apporteurs-reseau/envois.ts`, à l'adresse connue de la fiche.
- **Jamais d'IBAN entier.** Seulement « le compte qui se termine par 1234 ».
- Jamais de pièce jointe.
- Les e-mails 1, 3, 4 et 5 **ne portent pas** le bouton « Ouvrir mon espace » ajouté
  d'office par `avecLienEspace` : un e-mail qui parle de sécurité ne doit pas redonner le
  lien. L'e-mail 2 porte le lien renouvelé, c'est son objet.
- Ils entrent dans `GABARITS_ARGENT` : un apporteur retiré du réseau les reçoit encore.
- Texte non modifiable par l'administrateur, sauf le motif du refus.
- Clé d'envoi unique par demande et par étape (pas de doublon).
- Chaque nouveau nom de gabarit porte `gabaritRepli` (AGENTS.md). **Point ouvert** : je n'ai
  pas trouvé de gabarit ancien dont le texte reste vrai pour ces messages. Un repli qui
  dirait « dossier bien reçu » à la place d'une alerte de sécurité serait trompeur. Le lot 2
  doit trancher ; la protection réelle est l'ordre de mise en ligne (gabarits en ligne sur le
  worker, vérifiés par leur contenu, avant d'allumer l'interrupteur).
- Les alertes internes utilisent le gabarit existant `qualiopi-alerte-interne` : aucun
  nouveau nom côté worker.

### 6.2 Textes proposés

**E-mail 1 : confirmer la demande** (gabarit `apporteur-compte-a-confirmer`)

> Objet : Confirmez votre changement de compte bancaire
>
> Bonjour Claire,
>
> Vous avez demandé à changer le compte sur lequel nous versons vos commissions.
> Nouveau compte : il se termine par **5678**.
>
> Pour confirmer, cliquez ici : **[Je confirme]**
> Ce bouton fonctionne pendant 24 heures.
>
> Ensuite, nous vérifions votre RIB et nous vous appelons. Cela prend au moins 3 jours.
> En attendant, rien ne change.
>
> **Ce n'est pas vous ?** Cliquez ici : **[Bloquer cette demande]**
> Votre compte ne changera pas.
>
> Nous ne vous demanderons jamais votre IBAN par e-mail ou par téléphone.

**E-mail 2 : demande bloquée** (gabarit `apporteur-compte-demande-bloquee`)

> Objet : La demande de changement de compte est bloquée
>
> Bonjour Claire,
>
> Vous nous avez dit que vous n'aviez pas demandé à changer de compte.
> Nous avons annulé cette demande. Votre compte n'a pas changé.
>
> Par sécurité, l'ancien lien de votre espace ne fonctionne plus.
> Voici le nouveau : **[Ouvrir mon espace]**
>
> Nous vous appelons dans les prochains jours pour faire le point.

**E-mail 3 : compte changé** (gabarit `apporteur-compte-change`)

> Objet : Votre compte bancaire est changé
>
> Bonjour Claire,
>
> C'est fait. À partir du 29 novembre 2026, nous versons vos commissions sur le compte qui
> se termine par **5678**.
> L'ancien compte (qui se termine par **1234**) ne sera plus utilisé.
>
> Les anciens liens de votre espace ne fonctionnent plus. Pour en recevoir un nouveau,
> allez sur axion-ia.com/apporteur/dossier/retrouver.
>
> **Vous n'êtes pas d'accord ?** Répondez tout de suite à cet e-mail ou appelez-nous.

**E-mail 4 : demande refusée** (gabarit `apporteur-compte-refuse`)

> Objet : Votre demande de changement de compte n'est pas acceptée
>
> Bonjour Claire,
>
> Nous n'avons pas pu accepter votre demande de changement de compte.
> Raison : _(texte de l'administrateur)_
>
> Votre compte n'a pas changé : il se termine toujours par **1234**.
> Vous pouvez faire une nouvelle demande depuis votre espace.

**E-mail 5 : demande non confirmée** (gabarit `apporteur-compte-expire`, facultatif, D-5)

> Objet : Votre demande de changement de compte est annulée
>
> Bonjour Claire,
>
> Vous n'avez pas confirmé votre demande dans les 24 heures. Nous l'avons annulée.
> Votre compte n'a pas changé. Vous pouvez refaire la demande depuis votre espace.

**Alertes internes** (gabarit existant, sans IBAN, sans adresse) :
« Changement de compte demandé par <nom> » · « Demande confirmée : validable à partir
du … » · « OPPOSITION : <nom> dit ne pas avoir demandé de changement de compte » (niveau
urgent) · « Demande confirmée depuis 10 jours sans décision ».

**E-mail existant** `apporteur-virement-fait` : ajout facultatif « sur votre compte qui se
termine par … » (lot 6).

## 7. RGPD

- **Finalité et base** : exécuter le contrat (verser les commissions), obligation comptable,
  et intérêt légitime pour la lutte contre le détournement de paiement (preuve des demandes,
  empreintes, IP hachée). Le contrat couvre déjà les « coordonnées bancaires » (art. 7.8).
- **Minimisation** : IBAN toujours chiffré, clé exigée ; empreinte par HMAC à secret dédié ;
  quatre derniers caractères seulement pour l'affichage ; IP hachée, navigateur résumé ;
  aucun IBAN dans le journal, les alertes, Sentry, les e-mails ou les adresses de page.
- **« Jamais supprimé » et durée** : l'historique des comptes et les lignes de demande sont
  des pièces de preuve d'un paiement. Durée proposée : celle des pièces comptables (dix ans,
  art. L.123-22 du code de commerce, déjà citée au contrat). **À confirmer par le délégué à
  la protection des données** (section 10).
- **RIB joints** : les octets d'un RIB de demande validée suivent le dossier. Ceux d'une
  demande refusée, expirée ou annulée sont purgés 90 jours après la clôture (la ligne
  reste, avec `purge_at`). Ceux d'une demande contestée (opposition) sont gardés 5 ans :
  c'est la preuve d'une tentative de fraude. La ligne de la demande n'est jamais supprimée.
- **Donnée d'un tiers** : l'IBAN d'une demande refusée ou contestée peut être celui d'une
  autre personne (le fraudeur, ou un tiers). **L'export (art. 15) ne le rend pas** : il
  liste la demande, sa date, son état et les quatre derniers caractères. L'IBAN courant et
  les anciens IBAN validés de la personne, eux, sont rendus déchiffrés, comme aujourd'hui.
- **Effacement (art. 17)** : un apporteur qui peut demander un changement a un contrat
  contresigné, donc un dossier « conservé par obligation légale ». `rgpd-erase.ts` doit en
  plus : annuler la demande ouverte, purger les RIB de demandes non validées. Historique et
  preuves de virement sont conservés.
- **Information** : ajouter le traitement à la politique de confidentialité et au registre
  (« changement de coordonnées bancaires d'un apporteur, lutte contre la fraude »).
- **Sous-traitants** : aucun nouveau (messagerie et stockage déjà utilisés).
- **Droits d'accès internes** : RIB et IBAN entier réservés aux rôles qui peuvent
  `facturer` ; chaque lecture est journalisée.

## 8. Découpage en lots

Chaque lot est une PR, ouverte en brouillon, livrée **éteinte** tant que le lot 6 n'est pas
en ligne. Interrupteur : `APPORTEUR_CHANGEMENT_IBAN_ENABLED` (lu à l'exécution, conteneur de
l'application, « éteint » sauf valeur `true`). Éteint : aucune section dans l'espace, les
actions répondent « Ce service est fermé », la console n'affiche que l'historique.

| Lot | Contenu                                                                  | Dépend de                       |
| --- | ------------------------------------------------------------------------ | ------------------------------- |
| 1   | Schéma et règles pures                                                   | —                               |
| 2   | Gabarits d'e-mail (sans émetteur)                                        | —                               |
| 3   | Cœur serveur (demander, confirmer, s'opposer, annuler, valider, refuser) | 1, 2 **en ligne sur le worker** |
| 4   | Espace apporteur                                                         | 3                               |
| 5   | Console                                                                  | 3                               |
| 6   | Virements : bandeau et compte payé                                       | 1, 3                            |
| 7   | RGPD, purge, documentation                                               | 1, 3                            |
| 8   | Demande ouverte depuis la console ; reprise de l'historique              | 3, 5                            |

### Lot 1 : schéma et règles pures

- **Fichiers** : `prisma/schema.prisma` (quatre modèles, une énumération nouvelle) ;
  `prisma/migrations/<date>_apporteur_changement_iban/migration.sql` (tables, index partiel,
  contrôles, déclencheurs) ; `src/features/apporteurs-reseau/changement-iban-regles.ts`
  (nouveau, pur : délais 24 h, 72 h, 10 jours, 30 jours ; transitions permises ; quatre
  derniers caractères ; masquage de l'adresse) ; documentation du retour arrière dans
  `docs/`.
- **Tests à écrire d'abord** (`src/features/apporteurs-reseau/__tests__/`) :
  - `le-changement-d-iban-n-ajoute-rien-aux-tables-existantes.spec.ts` : la migration ne
    contient ni `DROP`, ni `ALTER TABLE apporteurs_reseau`, ni `ALTER TYPE` d'une énumération
    existante, ni clé étrangère.
  - `changement-iban-regles.spec.ts` : chaque transition permise et interdite ; expiration à
    24 h pile ; validation impossible à 71 h 59, possible à 72 h ; trois demandes sur 30 jours.
  - test d'intégration (base réelle) : l'index partiel refuse une seconde demande ouverte ;
    le déclencheur refuse `DELETE` ; un IBAN en clair est refusé par le contrôle.
  - garde du dépôt sur les lignes `/// rgpd:` : passe avec les quatre modèles.

### Lot 2 : gabarits d'e-mail

- **Fichiers** : `src/lib/email/templates/` (nouveau fichier `apporteur-compte.tsx`),
  `src/lib/email/templates/index.tsx`, `src/server/queue/types.ts` (noms de gabarit),
  `src/server/email/outbox-policy.ts`, `src/server/email/apercu/catalogue.ts`, les cliquets
  de gabarits (`src/lib/email/templates/__tests__/cliquets/`).
- **Tests d'abord** : rendu de chaque gabarit avec une charge type ; **aucun rendu ne
  contient une suite qui a la forme d'un IBAN** (expression de `journaliser.ts`) même si la
  charge en contient un par erreur ; le catalogue des e-mails reste complet ; chaque gabarit
  est connu de `estGabaritConnu`.
- **Aucun émetteur dans ce lot.** Après fusion : attendre un créneau, puis vérifier le
  contenu du conteneur worker (commande d'AGENTS.md) avant de fusionner le lot 3.

### Lot 3 : cœur serveur

- **Fichiers** : `src/features/apporteurs-reseau/changement-iban.ts` (nouveau, sur le modèle
  de `changements-coordonnees.ts`) ; `src/features/apporteurs-reseau/jeton-changement-iban.ts`
  (nouveau, fabrique `lien-signe`, domaine propre) ; `envois.ts` (cinq gabarits, exclusion
  du lien d'espace, `GABARITS_ARGENT` dans `retrait.ts`) ; `parrainage.ts` (comparaison
  réutilisée, sans changement de règle) ; lecture de l'interrupteur.
- **Tests d'abord** :
  - `la-demande-ne-touche-jamais-la-fiche.spec.ts` : après demande et après confirmation,
    `apporteurs_reseau.iban` est identique octet pour octet.
  - `le-lien-personnel-seul-ne-change-pas-l-iban.spec.ts` : sans confirmation, la validation
    est refusée, même par un administrateur.
  - `la-validation-attend-72-heures.spec.ts` et `…-exige-l-avis-envoye.spec.ts`.
  - `l-ancien-iban-entre-dans-l-historique.spec.ts` : même transaction ; si le journal
    échoue, rien n'est écrit.
  - `la-validation-renouvelle-le-lien.spec.ts` ; `l-opposition-coupe-le-lien-et-alerte.spec.ts`.
  - `le-lien-de-confirmation-ne-sert-qu-une-fois.spec.ts` ; lien d'une autre demande, d'un
    autre apporteur, expiré : même réponse neutre.
  - `aucun-iban-ne-sort-du-serveur.spec.ts` : ni journal, ni alerte, ni charge d'e-mail, ni
    valeur de retour ne contient l'IBAN entier.
  - `sans-secret-d-empreinte-rien-ne-s-enregistre.spec.ts`.
  - `interrupteur-eteint-rien-n-est-lu-ni-ecrit.spec.ts` ; `table-absente-pas-de-demande.spec.ts`.
  - deux demandes simultanées, double validation, validation d'une fiche résiliée ou
    retirée entre-temps : refus.

### Lot 4 : espace apporteur

- **Fichiers** : `src/app/apporteur/dossier/[id]/[jeton]/page.tsx` (section) ;
  `MonCompteBancaire.tsx` et `actions-compte.ts` (nouveaux) ; sous-routes `compte/confirmer`
  et `compte/bloquer` (page avec bouton, action serveur) ; `textes.ts`.
- **Tests d'abord** : la section n'apparaît que pour un dossier `signe`, non restreint,
  interrupteur allumé ; `le-mode-restreint-n-ouvre-que-la-vigilance.spec.ts` reste vert ;
  **afficher la page de confirmation ne confirme rien** (seul l'envoi du formulaire écrit) ;
  limite de débit fermée en cas de panne ; aucun IBAN entier dans le rendu ; test de bout en
  bout du parcours complet (demande, e-mail lu dans la boîte de test, confirmation).

### Lot 5 : console

- **Fichiers** : `src/app/[locale]/(admin)/[adminPrefix]/apporteurs/changements-de-compte/`
  (liste et détail) ; route du RIB de demande (modèle : `apporteurs/[id]/pieces/[pieceId]/route.ts`) ;
  `src/components/admin/apporteurs/fiche/` (bloc « Compte bancaire ») ;
  `src/features/apporteurs-reseau/actions-changement-iban.ts` (nouveau) ;
  `requetes-console.ts` ; entrée de navigation de la console.
- **Tests d'abord** : validation refusée sans `facturer`, sans les trois cases, avant le
  délai ; refus sans motif refusé ; la route du RIB refuse hors administrateur et sans
  verdict antivirus ; l'alerte « compte déjà connu » apparaît pour le parrain, un filleul,
  un autre apporteur, une demande contestée ; gardes existantes de la console
  (`admin-gardes:check`, `admin-nav:routes-check`).

### Lot 6 : virements

- **Fichiers** : `src/features/apporteurs-reseau/facturation.ts` (`marquerVerse` écrit la
  preuve ; `lireVirementsAFaire` rend l'état de la demande) ;
  `actions-commissions.ts` ; `src/components/admin/apporteurs/commissions/FormulairesCommission.tsx` ;
  `src/server/paiements-sortants/virements.ts` (champ facultatif pour le bandeau) et la page
  des virements ; `envois.ts` (`apporteur-virement-fait`, champ facultatif).
- **Attention** : `facturation.ts` est aussi chargé par le worker. `marquerVerse` n'est
  appelé que par l'application, mais toute lecture nouvelle dans ce fichier doit tolérer la
  table absente.
- **Tests d'abord** : « Virement fait » sans demande ouverte : comportement d'aujourd'hui,
  plus une ligne de preuve ; avec demande ouverte : accepté, bandeau présent ; dans les
  10 jours après validation : le choix du compte est exigé ; table absente : « Virement
  fait » fonctionne comme aujourd'hui ; les tests existants de `facturation` restent verts
  sans modification.

### Lot 7 : RGPD, purge, documentation

- **Fichiers** : `src/lib/rgpd-reseau-apporteur.ts` (export) ; `src/lib/rgpd-erase.ts` ;
  `src/features/apporteurs-reseau/passage-quotidien.ts` (purge des RIB de demandes closes,
  alerte « 10 jours sans décision ») ; `docs/fonctionnement-reseau-apporteurs.md` ;
  un runbook « changement de compte contesté » dans `docs/runbooks/` ; politique de
  confidentialité.
- **Tests d'abord** : l'export ne rend pas l'IBAN d'une demande refusée ou contestée ;
  l'effacement annule la demande ouverte et garde l'historique ; la purge ne touche jamais
  une demande validée ni contestée de moins de 5 ans ; le passage quotidien tourne sans
  erreur quand les tables n'existent pas.

### Lot 8 : compléments

- Demande ouverte par l'administrateur pour une fiche retirée ou résiliée avec de l'argent
  dû (mêmes barrières).
- Script manuel de reprise de l'historique (section 3.3), avec essai à blanc.

### Ordre de fusion et de mise en service

1. Lot 1, puis lot 2 (indépendants, dans cet ordre ou ensemble).
2. **Un créneau de mise en ligne.** Vérifier : migration passée (`prisma migrate status`,
   AGENTS.md), gabarits présents dans le conteneur worker.
3. Lot 3. Puis lots 4, 5 et 6, dans n'importe quel ordre. Puis lot 7.
4. Mise en ligne. Vérifier sur les deux conteneurs. Poser `IBAN_EMPREINTE_SECRET` sur
   l'application si absent.
5. Essai réel sur une fiche de test, interrupteur allumé pour cet essai.
6. Allumer l'interrupteur (décision de Will).
7. Lot 8.

Retour arrière : éteindre l'interrupteur. Les demandes ouvertes restent en base, visibles
dans la console ; aucune n'est validée tant qu'il est éteint.

## 9. Décisions à prendre par Will

| #   | Question                                                  | Proposition                                                                                                                                                                                                                     |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-1 | Durée du délai d'opposition                               | 72 heures après la confirmation (48 heures chez les formateurs, mais eux ont une session ; ici le lien n'expire pas).                                                                                                           |
| D-2 | Rappel téléphonique                                       | Obligatoire à chaque validation tant que le réseau est petit.                                                                                                                                                                   |
| D-3 | L'IBAN demandé est-il affiché en entier dans la console ? | Oui, sur l'écran de décision seulement, après un clic journalisé, pour le comparer au RIB chiffre par chiffre. Aujourd'hui la console ne montre que le masque, et chez les formateurs seulement les quatre derniers caractères. |
| D-4 | Virement à faire pendant une demande ouverte              | L'outil propose d'attendre ; il ne bloque pas.                                                                                                                                                                                  |
| D-5 | E-mail « demande non confirmée »                          | Oui, mais envoyé seulement quand l'apporteur revient sur son espace (pas de tâche planifiée).                                                                                                                                   |
| D-6 | Validation par deux personnes                             | Non dans cette version.                                                                                                                                                                                                         |

## 10. Ce que je n'ai pas pu vérifier

- **Comment l'administrateur lit aujourd'hui l'IBAN pour faire le virement.** La console
  n'affiche que le masque et `lireIban` n'a pas d'appelant : je suppose qu'il le lit sur la
  pièce RIB. Si c'est le cas, c'est le RIB, et non l'IBAN saisi, qui décide où part
  l'argent ; la case « l'IBAN du RIB est celui de la demande » en devient essentielle.
- **Si `IBAN_EMPREINTE_SECRET` est posé en production** sur le conteneur de l'application.
  Aucun accès à Coolify ni au serveur depuis cette session.
- **Si une action de console permet de changer l'adresse e-mail d'un apporteur.** Je n'en ai
  pas trouvé dans `src/features/apporteurs-reseau/`, mais je n'ai pas lu toute la console.
  S'il en existe une, il faut envoyer aussi l'alerte à l'adresse remplacée depuis moins de
  30 jours (règle déjà appliquée aux formateurs).
- **S'il existe un moyen d'annuler un « Virement fait »** (virement revenu de la banque).
  Je n'en ai pas vu dans `facturation.ts` ni `actions-commissions.ts`.
- **Le texte exact de l'autofacture en PDF.** Je n'ai trouvé aucune mention d'IBAN dans
  `autofacture-donnees.ts`, `commissions.ts` ni `facturation.ts`, mais je n'ai pas rendu de
  PDF.
- **Le bon `gabaritRepli`** pour les nouveaux e-mails (section 6.1).
- **Les points de droit** : durée de conservation des anciens IBAN et des RIB ; garder
  5 ans le RIB d'une demande contestée ; attendre la décision avant de virer sans manquer à
  l'article 5.4 du contrat ; mention à ajouter ou non au contrat (une version 2.7) pour
  décrire la procédure de changement de compte. À faire relire par le juriste et le délégué
  à la protection des données.
- **Aucun test n'a été lancé** et aucune page n'a été ouverte : ce plan vient de la lecture
  du code. Les lectures du worker sur `apporteurs_reseau` sans liste de colonnes sont
  affirmées par les commentaires du schéma ; je ne les ai pas toutes recensées.
- **L'envoi de SMS** : je n'ai pas cherché si le dépôt sait en envoyer. Le plan n'en dépend
  pas.
- **Le poids du composant client** de l'espace n'est pas mesuré ; la page n'est pas dans
  les 15 pages stratégiques.
