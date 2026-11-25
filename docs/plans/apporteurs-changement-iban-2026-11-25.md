# Apporteurs d'affaires : changer son IBAN après la signature du contrat

Plan de conception et d'audit (sécurité, argent). **Aucun code dans ce document.**
Date : 25/11/2026. Base lue : `origin/main` au commit `3151c61a`, revérifiée sur `ef5cc10d`
après la relecture (verdict « À CORRIGER » du 25/11/2026, PR #2256).

## 0. Résumé

- Aujourd'hui, un apporteur au contrat signé ne peut plus toucher à son IBAN : la seule
  écriture (`enregistrerActivite`, `src/features/apporteurs-reseau/donnees.ts:371`) n'est
  ouverte que pour un dossier « en cours » ou « à compléter » (`dossierModifiableParLien`,
  `src/app/apporteur/dossier/[id]/[jeton]/actions.ts:113`).
- Le lien personnel de l'espace vaut mot de passe, n'expire pas, et se retrouve par simple
  saisie de l'adresse e-mail (« Retrouver mon espace »). **Un changement d'IBAN ne doit donc
  jamais reposer sur le lien seul.**
- Proposition : l'apporteur **demande** ; rien ne change sur sa fiche. La demande passe par
  quatre barrières, dans cet ordre : confirmation par e-mail à l'adresse connue, délai
  d'opposition de 72 heures, contrôle du RIB et rappel téléphonique, validation dans la
  console **par le rôle le plus élevé (`super_admin`) seulement**. L'ancien IBAN reste celui
  des virements jusqu'à la validation, puis il est gardé dans un historique, jamais supprimé.
- **Après la validation, le compte présenté pour virer est le nouveau, et lui seul**
  (section 4.3) : l'IBAN de la fiche devient la source affichée dans « Virements à faire »,
  et le RIB de la demande devient la pièce `rib` courante du dossier. Aujourd'hui le virement
  se fait à partir de la pièce RIB ; sans ce point, l'argent partirait encore sur l'ancien
  compte.
- Les liens de confirmation et d'opposition vivent **hors du chemin à jeton** :
  `/apporteur/dossier/compte/<idDemande>/<signature>`. Un e-mail de sécurité ne redonne
  jamais le lien personnel de l'espace.
- **Jamais d'IBAN en clair** dans un journal, un e-mail, une alerte, Sentry ou une adresse de
  page. Seulement « le compte qui se termine par 1234 ».
- Le dépôt a déjà ce circuit pour les formateurs indépendants
  (`src/server/qualiopi/formateurs-independants/changements-coordonnees.ts`, modèle
  `DemandeChangementFormateur`). Ce plan reprend ses règles et ajoute ce que le lien sans
  session rend nécessaire (confirmation par e-mail, opposition en un clic).
- Modèle de données : **quatre tables nouvelles, sans clé étrangère, aucune colonne ajoutée
  à `apporteurs_reseau`**, aucune valeur ajoutée à une énumération existante.
- **L'argent n'est pas touché** : ni les commissions, ni leur calcul, ni la TVA (toujours
  selon le régime de l'apporteur), ni l'autofacture (déjà en place, sans IBAN), ni la
  numérotation `AXI-APP`, ni le moment du versement (client payé à 100 %), ni la règle
  « une entreprise, un seul apporteur commissionné ». Seul change le compte sur lequel le
  virement part.
- Neuf lots de code (section 11). Deux sont lançables tout de suite. Les décisions du
  dirigeant sont en section 13.

## 1. Ce qui existe (lu dans le code)

| Sujet                         | Constat                                                                                                                                                                                                                                                                                                                 | Source                                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Stockage de l'IBAN            | Colonne `iban` de `apporteurs_reseau`, chiffrée par `encryptPii` (sans donnée liée à la ligne), normalisée sans espaces et en majuscules.                                                                                                                                                                               | `prisma/schema.prisma` (`ApporteurReseau`), `donnees.ts`                                           |
| Écriture de l'IBAN            | Une seule : `enregistrerActivite` (`donnees.ts:371`), appelée par l'action de l'étape 2 du dossier, gardée par `dossierModifiableParLien` (`actions.ts:113` : statuts `dossier_en_cours` et `a_completer`, jamais en mode restreint).                                                                                   | `src/app/apporteur/dossier/[id]/[jeton]/actions.ts`                                                |
| Affichage                     | Toujours masqué (`FR76 •••• •••• 1234`) : espace et console (`apporteurs/[id]/page.tsx:208-209`, `ibanMasque`). `lireIban` (`donnees.ts:543`, IBAN en clair, commentaire « pour le relevé et le virement ») **n'a aucun appelant**.                                                                                     | `donnees.ts`, fiche console                                                                        |
| **Source réelle du virement** | Rien sous `apporteurs/commissions`, ni `facturation.ts`, ni `paiements-sortants/virements.ts` ne lit l'IBAN. **Le virement est donc fait à partir de la pièce RIB du dossier.**                                                                                                                                         | lecture du code (aucun appel à `lireIban`, aucune lecture d'`iban` dans ces fichiers)              |
| Lien personnel                | `jeton = HMAC(id + versionLien)`, rien n'est stocké, pas de date de fin. Coupé en augmentant `versionLien` (retrait, résiliation, refus, effacement).                                                                                                                                                                   | `jeton.ts:37-60`                                                                                   |
| Liens signés                  | Fabrique commune `fabriqueLienSigne` : domaine et version propres, échéance facultative **signée**, comparaison à temps constant, rien de stocké.                                                                                                                                                                       | `src/lib/security/lien-signe.ts`                                                                   |
| Retrouver son lien            | Formulaire public : l'adresse saisie reçoit le lien si elle est celle d'une fiche. Limite par IP et par adresse, **fermé si la limite est indisponible**. Qui lit la boîte e-mail de l'apporteur obtient donc le lien.                                                                                                  | `src/app/apporteur/dossier/retrouver/actions.ts`                                                   |
| Adresse e-mail et téléphone   | Plus modifiables par l'apporteur après la signature. **Aucune action de console ne modifie l'adresse e-mail d'une fiche** (vérifié : `actions-apporteurs.ts` ne la pose qu'à la création, `ouvrirDossierManuelAction` ; `correction-nom.ts` et `actions-identite.ts` n'y touchent pas ; seul `rgpd-erase.ts` l'écrase). | `donnees.ts`, `actions-apporteurs.ts`, `actions-identite.ts`, `correction-nom.ts`, `rgpd-erase.ts` |
| Espace « signé »              | Contrat à télécharger, déclaration d'entreprise, grille, outils, pièces de vigilance. Rien sur le compte bancaire.                                                                                                                                                                                                      | `page.tsx` de l'espace                                                                             |
| RIB                           | Pièce `rib` exigée pour signer. Un nouveau dépôt du même type par `deposerPiece` **purge les octets de l'ancien** (`purgerContenuPieces`, `courantesSeulement`). Contrôle commun : `controlerPiece` (format, `TAILLE_MAX_PIECE` = 10 Mo, antivirus obligatoire), chiffrement `chiffrerContenuPiece`.                    | `donnees.ts:435`, `src/server/pieces/depot-controle.ts`, `pieces-chiffrement.ts`                   |
| Autofacture                   | Aucun IBAN dans les données ni dans le PDF de l'autofacture.                                                                                                                                                                                                                                                            | `autofacture-donnees.ts`, `commissions.ts`, `facturation.ts`                                       |
| Virement                      | Fait à la main, hors du site. « Virement fait » (`marquerVerse`, `facturation.ts:787`) passe les commissions à `versee`. **Rien n'enregistre sur quel compte le virement est parti.**                                                                                                                                   | `facturation.ts`, `actions-commissions.ts`                                                         |
| Vue commune                   | `lireVirementsSortants` met côte à côte apporteurs et formateurs, en lecture seule.                                                                                                                                                                                                                                     | `src/server/paiements-sortants/virements.ts`                                                       |
| Parrainage                    | Refus du rattachement si parrain et filleul ont le même IBAN ; le contrat prévoit une suspension si l'identité de compte « apparaît en cours de contrat ».                                                                                                                                                              | `parrainage.ts`, `actions-apporteurs.ts` (`rattacherParrainAction`), `contrat-v2.ts` (art. 4.6)    |
| Contrat                       | Art. 6.3 : l'apporteur signale tout changement de coordonnées bancaires sous quinze jours et supporte les sommes versées sur des coordonnées erronées qu'il a déclarées. Art. 5.4 : pas de versement sans coordonnées bancaires à son nom. L'IBAN n'est pas écrit dans le contrat.                                      | `contrat-v2.ts`                                                                                    |
| Habilitations                 | `facturer` = `super_admin` **et** `admin`. **Aucun acte n'est aujourd'hui réservé à `super_admin` seul.**                                                                                                                                                                                                               | `src/server/auth/habilitations.ts:287-301`                                                         |
| Journal                       | `journaliser` masque les IBAN (`journaliser.ts:135-150`, motif `IBAN_RE`) et sait lever si la trace échoue (`exiger: true`). Les modules apporteurs écrivent aujourd'hui dans `activityLog` par des `tracer` locaux tolérants.                                                                                          | `src/server/journal/journaliser.ts`, `ajustement.ts`                                               |
| Sentry                        | Toute requête sous `/apporteur/dossier/…` voit son corps, ses cookies et ses en-têtes sensibles **supprimés** avant envoi (`ROUTE_A_REQUETE_SECRETE`). Le motif exige le préfixe `apporteur/dossier`.                                                                                                                   | `src/lib/observability/sentry-pii-scrub.ts`                                                        |
| Routes hors `[locale]`        | `/apporteur/dossier/…` est exclu du proxy (`src/proxy.ts:639`) et reçoit `noindex`, `Referrer-Policy: same-origin` et une CSP stricte (`next.config.ts:1138`). **Une route placée sous ce préfixe hérite de tout cela sans rien ajouter.**                                                                              | `src/proxy.ts`, `next.config.ts`                                                                   |
| Empreinte d'IBAN              | `empreinteIban` (`iban-empreinte.ts:25`, HMAC, secret `IBAN_EMPREINTE_SECRET`), utilisée par les formateurs. Sans secret : pas d'empreinte, et l'appelant doit refuser. Aucune vérification au démarrage aujourd'hui.                                                                                                   | `src/lib/iban-empreinte.ts`                                                                        |
| Navigateur résumé             | `resumerNavigateur` rend « famille · système » (ex. « Chrome · Windows »), jamais la chaîne entière. Déjà utilisé pour la signature du contrat.                                                                                                                                                                         | `src/lib/navigateur.ts`                                                                            |
| Passage quotidien             | `passage-quotidien.ts` tourne **dans le worker** (file `apporteur-crons`). Aucun `server-only`.                                                                                                                                                                                                                         | `src/server/queue/workers/apporteur-crons-worker.ts:134`                                           |
| Gabarit inconnu du worker     | Report 10 min, 9 fois au plus, puis rendu par `gabaritRepli` s'il est connu, **sinon échec franc** (`UnrecoverableError`, journal « gabarit inconnu de ce worker », Sentry). Jamais de rendu d'un nom inconnu.                                                                                                          | `src/server/queue/workers/email-worker.ts:320-356`                                                 |
| Effacement RGPD               | Dossier contresigné ou avec commissions : conservé (obligation légale), IBAN gardé, lien coupé. Sinon : IBAN mis à `null`.                                                                                                                                                                                              | `src/lib/rgpd-erase.ts`                                                                            |
| Export RGPD                   | L'IBAN de la fiche est rendu déchiffré à la personne.                                                                                                                                                                                                                                                                   | `src/lib/rgpd-reseau-apporteur.ts`                                                                 |

## 2. Menaces et garde-fous

### 2.1 Qui peut attaquer, et avec quoi

| #   | Attaquant                                                  | Ce qu'il a                                                                                     | Ce qu'il tente                                                                                                                                     |
| --- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | Un tiers                                                   | Le lien personnel seul (e-mail transféré, historique d'un navigateur partagé, capture d'écran) | Remplacer l'IBAN par le sien                                                                                                                       |
| M2  | Un tiers                                                   | La boîte e-mail de l'apporteur (donc le lien, et les e-mails de confirmation)                  | La même chose, en confirmant lui-même                                                                                                              |
| M3  | Un proche ou un associé                                    | Le lien, parfois la boîte, parfois le téléphone                                                | La même chose, avec un RIB vraisemblable                                                                                                           |
| M4  | Un tiers                                                   | Rien, ou un e-mail de confirmation transféré                                                   | Faire envoyer des e-mails en masse, deviner si une adresse est celle d'un apporteur, ou couper l'accès de l'apporteur par des oppositions répétées |
| M5  | Un compte de console compromis ou un administrateur pressé | Un accès à la console                                                                          | Valider sans contrôler                                                                                                                             |
| M6  | L'apporteur lui-même                                       | Son espace                                                                                     | Nier après coup avoir demandé le changement                                                                                                        |

M1 est la menace principale. M2 est la plus dure : l'e-mail ne protège plus, seul le
contrôle humain (RIB, rappel au numéro connu) arrête l'attaque.

### 2.2 Les barrières, dans l'ordre

1. **Rien ne change sur la fiche à la demande.** La demande vit dans sa propre table.
   L'ancien IBAN reste celui des virements, et l'ancienne pièce RIB reste la pièce courante.
   (Arrête M1, M2, M3 tant que personne n'a validé.)
2. **Le RIB du nouveau compte est obligatoire**, déposé avec la demande. Il passe par le
   **même contrôle** que les pièces du dossier (`controlerPiece` : format par extension et
   premiers octets, plafond `TAILLE_MAX_PIECE` de 10 Mo, antivirus obligatoire, refus si
   l'antivirus ne répond pas) et la **même enveloppe** de chiffrement
   (`chiffrerContenuPiece`). Aucune nouvelle dépendance. Il est rangé avec la demande et
   n'emprunte pas `deposerPiece`, qui purgerait l'ancien RIB. Il ne devient la pièce `rib`
   courante qu'à la validation (point 7).
3. **Confirmation par e-mail à l'adresse connue de la fiche.** L'adresse n'est **jamais** lue
   dans le formulaire (test). Le lien de confirmation est signé par une fabrique
   `lien-signe` à **domaine propre** (`apporteur-compte`), sur la charge
   `<idDemande>:<apporteurId>:confirmer`, avec une échéance signée à 24 heures. Il **ne
   dépend pas de `versionLien`** et **ne contient pas le jeton personnel**. Il vit sur une
   route hors du chemin à jeton : `/apporteur/dossier/compte/<idDemande>/<signature>`
   (section 5.1). Il ne sert qu'une fois : la demande change d'état. **La page ouverte par ce
   lien ne confirme rien à l'affichage** : elle montre un bouton, et seul l'envoi du
   formulaire confirme. Sinon un antivirus de messagerie qui ouvre les liens confirmerait à
   la place de la personne. (Arrête M1.)
4. **Alerte immédiate à la même adresse**, dans le même e-mail : « Ce n'est pas vous ? » avec
   un lien d'opposition, signé de la même façon sur la charge
   `<idDemande>:<apporteurId>:bloquer`, **sans échéance** tant que la demande n'est pas
   validée, refusée ou close. Il reste donc valable après une validation ou une opposition
   qui renouvelle le lien personnel. L'opposition annule la demande, **coupe le lien
   personnel** (`versionLien` + 1), envoie un lien neuf à l'adresse connue de la fiche (et
   seulement à elle), et alerte l'administrateur en urgent. S'opposer est possible tant que
   la demande n'est pas validée. L'opposition a sa propre limite de débit (par IP hachée et
   par demande ; fermée si la limite est indisponible) : un tiers qui a l'e-mail ne peut pas
   couper l'accès de l'apporteur en boucle. Une demande déjà opposée ne recoupe pas le lien.
   (Arrête M1 ; limite M4 ; laisse une trace contre M3.)
5. **Délai d'opposition de 72 heures** à partir de la confirmation. Avant, la console refuse la
   validation, côté serveur. C'est aussi le **délai de carence** : comme l'IBAN de la fiche ne
   change qu'à la validation, aucun virement ne peut partir vers le nouveau compte moins de
   72 heures après la confirmation.
6. **Validation manuelle dans la console, réservée à `super_admin`** (règle du dirigeant :
   rôle le plus élevé). Nouvel acte `valider_changement_iban` dans `HABILITATIONS`, avec
   `["super_admin"]` seul ; un `admin` voit la demande mais ne peut ni valider ni refuser.
   L'outil prépare les contrôles, la personne décide (section 5.2). **Trois cases
   obligatoires**, vérifiées côté serveur : « Le titulaire du RIB est l'apporteur ou son
   entreprise », « L'IBAN du RIB est celui de la demande », « J'ai parlé à l'apporteur au
   numéro de sa fiche ». Le rappel est la seule barrière contre M2. (Arrête M2, M3, limite M5.)
7. **À la validation**, dans une seule transaction :
   - la demande passe à « validée » (écriture conditionnée au statut `confirmee`) ;
   - l'ancien IBAN chiffré est copié dans l'historique ;
   - le nouvel IBAN est rechiffré pour la fiche ;
   - **le RIB de la demande devient la pièce `rib` courante** : une nouvelle ligne de pièce
     de type `rib` (valeur existante de l'énumération) est créée avec ses octets rechiffrés ;
     l'ancienne pièce `rib` reçoit `remplaceeAt` **sans purge de ses octets** (preuve du
     compte payé jusque-là). Pas d'appel à `deposerPiece` ;
   - le lien personnel est renouvelé (`versionLien` + 1) ;
   - le journal est écrit avec `exiger: true` (sans trace, pas de changement).

   Puis deux e-mails **séparés** partent : l'e-mail 3 « Votre compte bancaire est changé »
   (sans lien), et le gabarit **existant** `apporteur-lien-espace` avec le lien neuf, pour
   que l'apporteur ne perde pas son espace sans comprendre.

8. **Premier virement sur le nouveau compte** : la console l'affiche en clair (« premier
   virement sur ce compte ») et « Virement fait » enregistre sur quel compte l'argent est
   parti (section 4.3). (Limite M5, répond à M6.)
9. **Limites d'usage.** Une seule demande ouverte par apporteur (index unique partiel). Trois
   demandes au plus par période de 30 jours. Limite de débit par IP hachée sur chaque action
   (demande, confirmation, opposition, annulation), **fermée en cas de panne de Redis** (un
   e-mail part : même règle que « Retrouver mon espace »). Les réponses ne disent jamais si
   une adresse existe. (Arrête M4.)
10. **Compte déjà connu ailleurs.** À la demande puis à la validation, l'empreinte du nouvel
    IBAN est comparée aux IBAN des autres apporteurs, à ceux du parrain et des filleuls
    (art. 4.6) et aux demandes passées, y compris refusées ou contestées. Une égalité
    n'interdit rien toute seule : elle s'affiche en rouge dans la console et, pour le
    parrainage, propose la suspension prévue au contrat.
11. **Preuve.** Chaque étape est horodatée dans la demande (créée, confirmée, opposée,
    validée ou refusée, par qui), avec l'IP hachée et le **navigateur résumé** de la demande
    et de la confirmation. « Navigateur résumé » = la sortie de `resumerNavigateur`
    (`src/lib/navigateur.ts`) : famille et système, par exemple « Chrome · Windows ».
    **Jamais la chaîne `User-Agent` entière.** (Répond à M6.)
12. **Aucun IBAN en clair hors du chiffré.** Ni dans le journal (le masquage de `journaliser`
    reste un filet, pas la règle : on n'y passe jamais l'IBAN), ni dans une alerte interne,
    ni dans une charge ou un rendu d'e-mail, ni dans Sentry (aucun `captureException` ni
    `signalerErreurReseau` ne reçoit l'IBAN ; les routes publiques sont sous
    `/apporteur/dossier/`, dont Sentry supprime le corps), ni dans une adresse de page, ni
    dans une valeur de retour d'action. Un test le verrouille par lot.

### 2.3 Ce que ces barrières ne couvrent pas

- **Boîte e-mail et téléphone compromis ensemble** (M3 poussé au bout) : seul l'examen du RIB
  reste. D'où la règle affichée dans la console : le titulaire du compte écrit sur le RIB
  doit être l'apporteur ou son entreprise (art. 5.4), sinon refus.
- **Un RIB falsifié au bon nom.** Aucune vérification bancaire automatique n'est prévue
  (pas de service de contrôle du titulaire dans le dépôt). C'est un risque accepté, à
  réduire par le rappel téléphonique.
- **Compte `super_admin` compromis.** La validation reste l'acte d'une seule personne, mais
  c'est désormais le rôle le plus élevé, et non tout compte qui peut `facturer`.

### 2.4 Qui peut demander

- Seulement une fiche au statut `signe`, non retirée du réseau, dont l'IBAN actuel est lisible.
- Dossier « à vérifier » : pas de demande. L'administrateur peut déjà rouvrir le dossier
  (« à compléter »), et l'IBAN se corrige alors à l'étape 2, comme aujourd'hui.
- Fiche retirée (mode restreint) ou résiliée avec de l'argent encore dû : pas de demande
  depuis l'espace dans la première version. L'administrateur ouvre la demande depuis la
  console au nom de l'apporteur (lot 9) ; elle suit **les mêmes barrières**, e-mail de
  confirmation, délai et validation par `super_admin` compris.

### 2.5 Règle dure : l'adresse e-mail de la fiche

Toute la sécurité repose sur l'adresse e-mail connue. Aujourd'hui, aucune action ne la
modifie après la création (section 1). Règle à graver :

- **Si une action de modification de l'adresse e-mail d'un apporteur apparaît un jour**, elle
  doit, dans la même transaction, **annuler toute demande de changement d'IBAN ouverte**, et
  envoyer pendant 30 jours toute alerte de sécurité **aussi à l'ancienne adresse** (règle
  déjà appliquée aux formateurs).
- Verrou : un test de garde statique (lot 3) échoue si une écriture du champ `email` de
  `apporteurReseau` apparaît ailleurs que dans la création (`ouvrirDossierManuel`, le dépôt
  du formulaire) et l'effacement RGPD, sans appeler la fonction de fermeture des demandes.

## 3. Modèle de données

### 3.1 Contraintes du déploiement à deux conteneurs

AGENTS.md, sections « DEUX conteneurs » et « D8b » : pendant une mise en ligne, l'application
et le worker ne tournent pas le même code, et l'ordre peut aller dans les deux sens. La
migration est jouée par le conteneur de l'application. Conséquences retenues :

- **Aucune colonne ajoutée à `apporteurs_reseau`.** Le worker lit cette table sans liste de
  colonnes à plusieurs endroits : un client Prisma plus récent que la base y échouerait.
  C'est la raison écrite sur `ApporteurReseauRetrait` et `ApporteurReseauSiret`.
- **Aucune valeur ajoutée à une énumération existante** (`TypePieceApporteur`,
  `ApporteurReseauStatut`, `StatutCommissionApporteur`). Le RIB validé devient une pièce de
  type `rib`, valeur qui existe déjà.
- **Tables nouvelles, sans clé étrangère**, lues seulement par du code nouveau. Tout lecteur
  tolère la table absente (erreur Prisma `P2021` : « pas de demande »), comme `retraitDe`.
- **Aucune nouvelle forme de tâche BullMQ.** Les e-mails passent par la file existante.
- **Nouveaux noms de gabarit d'e-mail** : le worker doit les connaître avant que
  l'application les émette. D'où un lot « gabarits » mis en ligne un créneau avant le lot qui
  émet (section 6.1, choix sur `gabaritRepli`).
- **Expiration : écrite, pas seulement calculée.** Une demande `a_confirmer` de plus de
  24 heures est « expirée » à la lecture (affichage). Mais l'index unique partiel ne connaît
  que le statut en base. Donc **la création d'une demande commence, dans la même
  transaction, par passer à `expiree` les demandes `a_confirmer` de cet apporteur créées il
  y a plus de 24 heures** (écriture conditionnelle : `where statut = 'a_confirmer' and
demandee_at < maintenant - 24 h`), puis insère. Sinon une demande jamais confirmée
  bloquerait l'apporteur pour toujours. Même écriture conditionnelle à l'ouverture de
  l'espace (pour afficher l'état juste et déclencher l'e-mail 5, décision D-5). Aucune tâche
  planifiée n'est nécessaire.
- Le worker n'a pas besoin d'`IBAN_EMPREINTE_SECRET` : demande, confirmation, validation et
  « Virement fait » tournent dans l'application. Seules la purge des RIB et l'alerte
  « 10 jours sans décision » passent par le passage quotidien du worker, **tolérantes à la
  table absente** (section 4.2 et lot 8).

### 3.2 Tables proposées (additif : aucun `DROP`, aucun renommage, aucune suppression)

Noms indicatifs. Chaque modèle porte sa ligne `/// rgpd:` (garde du dépôt).

**A. `apporteur_changements_iban`** : une ligne par demande. Jamais supprimée.

| Colonne                                                           | Type                                                        | Rôle                                                                                                           |
| ----------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `id`                                                              | uuid, clé                                                   | Identifiant, aussi dans la charge du lien de confirmation                                                      |
| `apporteur_id`                                                    | uuid, sans clé étrangère, indexé                            | La fiche                                                                                                       |
| `statut`                                                          | énumération **nouvelle** `statut_changement_iban_apporteur` | `a_confirmer`, `confirmee`, `validee`, `refusee`, `opposee`, `annulee`, `expiree`                              |
| `iban`                                                            | texte chiffré                                               | IBAN demandé, chiffré avec donnée liée `changement-iban:<id>` et clé exigée. Gardé après la décision (preuve). |
| `iban_empreinte`                                                  | char(64)                                                    | `empreinteIban` du nouvel IBAN                                                                                 |
| `iban_fin4`                                                       | char(4)                                                     | Les quatre derniers caractères, pour l'affichage et les e-mails                                                |
| `ancien_iban_empreinte`, `ancien_iban_fin4`                       | char(64), char(4)                                           | Le compte en place au moment de la demande                                                                     |
| `origine`                                                         | varchar                                                     | `espace` ou `console`                                                                                          |
| `demandee_at`, `demande_ip_hash`, `demande_navigateur`            | horodatage, textes                                          | Preuve de la demande (IP hachée, `resumerNavigateur`)                                                          |
| `avis_envoye_at`                                                  | horodatage, nul                                             | L'e-mail de confirmation et d'alerte est bien parti (posé par le journal d'envoi, pas à la mise en file)       |
| `confirmee_at`, `confirmation_ip_hash`, `confirmation_navigateur` | idem                                                        | Preuve de la confirmation                                                                                      |
| `opposee_at`, `annulee_at`, `expiree_at`                          | horodatage, nul                                             | Opposition, abandon par l'apporteur, expiration écrite                                                         |
| `traitee_at`, `traitee_par`                                       | horodatage, uuid, nul                                       | Décision du `super_admin`                                                                                      |
| `motif_refus`                                                     | texte, nul                                                  | Obligatoire en cas de refus                                                                                    |
| `controles`                                                       | JSON, nul                                                   | Les trois cases cochées et les alertes affichées (compte déjà connu, parrainage). Jamais d'IBAN.               |

Objets en SQL brut dans la migration, comme pour les formateurs : index unique partiel
« une seule demande `a_confirmer` ou `confirmee` par apporteur » ; contrôle « l'IBAN commence
par le préfixe du chiffrement » (jamais en clair) ; contrôle de cohérence (validée ou
refusée exige `traitee_at` et `traitee_par` ; refusée exige un motif ; expirée exige
`expiree_at`) ; déclencheur qui refuse `DELETE` et `TRUNCATE`.

**B. `apporteur_changements_iban_rib`** : le RIB joint à la demande.
`demande_id` (clé, sans clé étrangère), `octets` chiffrés (enveloppe de
`pieces-chiffrement.ts`), `sha256` du clair, `type_mime`, `taille` (≤ `TAILLE_MAX_PIECE`,
contrôle SQL), `nom_fichier`, `depose_at`, `purge_at`. Lu par une route de console réservée
aux administrateurs, avec verdict antivirus, sur le modèle de la route des pièces.

**C. `apporteur_iban_historique`** : un compte par ligne, ajout seul.
`id`, `apporteur_id`, `iban` chiffré (donnée liée `iban-historique:<id>`), `iban_empreinte`,
`iban_fin4`, `en_vigueur_de` (nul si inconnu), `en_vigueur_jusqua` (nul pour le compte
courant), `origine` (`dossier_initial`, `changement`), `demande_id` (nul),
`piece_rib_id` (nul : la pièce `rib` qui prouvait ce compte). Déclencheur : ni `DELETE`, ni
`TRUNCATE` ; seule la colonne `en_vigueur_jusqua` peut passer de nul à une date.
**L'ancien IBAN y est copié à la validation, dans la même transaction : il n'est jamais perdu.**

**D. `apporteur_virements_compte`** : sur quel compte un virement est parti.
`autofacture_numero` (clé), `apporteur_id`, `iban_empreinte`, `iban_fin4`, `declare_at`,
`declare_par`, `premier_sur_ce_compte` (booléen). Écrit par « Virement fait ». Ajout seul.

### 3.3 Reprise de l'existant

Aucune reprise n'est nécessaire pour mettre en service : l'historique se remplit à la
première validation (l'IBAN en place y entre comme `dossier_initial`). Pour que la
comparaison « compte déjà connu » couvre tout le réseau dès le premier jour, le lot 9
propose un script manuel, rejouable sans risque, avec essai à blanc, qui inscrit le compte
courant de chaque fiche signée dans l'historique (copie du chiffré, calcul de l'empreinte).
Il ne modifie aucune fiche.

### 3.4 Retour arrière

Les tables peuvent rester en place si le code est retiré : rien d'ancien ne les lit. Aucun
script de suppression n'est prévu, à dessein. Si une validation a déjà eu lieu, la fiche
porte le nouvel IBAN, la pièce `rib` courante est le nouveau RIB, et l'historique porte
l'ancien : le retour à l'ancien compte se fait par une nouvelle demande, pas par une
écriture à la main.

## 4. Effets sur l'argent

### 4.1 Ce qui ne change pas

- L'autofacture (déjà en place) ne porte pas d'IBAN. **Aucune pièce émise n'est modifiée,
  annulée ni réémise** ; la numérotation `AXI-APP` n'est pas touchée ; aucun avoir n'est créé.
- Le changement ne touche ni le régime de TVA (toujours facturée selon le régime de
  l'apporteur, jamais d'exonération inventée), ni le SIREN, ni l'identité de facturation.
- Les commissions (`commissions_apporteur`), leur calcul, leurs taux, leur moment de
  versement (client payé à 100 %) et leurs reprises ne sont pas modifiés par ce chantier.
- La déclaration annuelle des honoraires (`das2.ts`, `lignesDas2Apporteurs`) se fonde sur les
  sommes versées par bénéficiaire, pas sur le compte : inchangée.

### 4.2 Virement à faire pendant qu'une demande est ouverte

Le virement se fait à la main, hors du site ; le site ne sait que ce que « Virement fait »
lui déclare. Règle :

- **Tant que le nouveau compte n'est pas validé, l'ancien est le seul utilisé** (règle du
  dirigeant). « Virements à faire » ne montre que le compte de la fiche, c'est-à-dire
  l'ancien.
- Tant qu'une demande est `a_confirmer` ou `confirmee`, la ligne de l'apporteur dans
  « Virements à faire » (console des commissions et vue commune des paiements sortants)
  porte un bandeau (texte en section 12).
- **L'outil propose d'attendre la décision** ; il ne bloque pas. Virer sur le compte actuel
  reste permis (art. 5.4 et 6.3) ; mais si l'apporteur a fermé ce compte, le virement
  reviendra.
- Les délais du contrat restent tenables : objectif de deux jours ouvrés, échéance ferme à
  trente jours. **Une demande non décidée 10 jours après sa confirmation passe en rouge**
  dans la console et déclenche une alerte interne. Cette alerte passe par le passage
  quotidien **du worker**, qui tolère la table absente (`P2021` : rien à signaler) ; le
  passage quotidien de l'application n'existe pas, il n'en est pas créé un.
- « Virement fait » n'est **pas bloqué** par une demande ouverte (art. 5.4). Il enregistre
  seulement le compte utilisé.

### 4.3 D'où l'administrateur lit le compte à virer (correction du bloquant 1)

Constat : aujourd'hui, l'IBAN n'est lu en entier nulle part ; le virement est donc fait à
partir de la **pièce RIB** du dossier. Si la validation changeait seulement l'IBAN de la
fiche, la pièce ouverte pour virer resterait l'ancien RIB, et l'argent partirait sur
l'ancien compte. Solution retenue, en deux parties qui se tiennent :

1. **Une seule source affichée : l'IBAN de la fiche.** Dans « Virements à faire », chaque
   ligne porte un bouton « Afficher l'IBAN à virer ». Il affiche l'IBAN courant de la fiche en
   entier (lu par `lireIban`, qui trouve enfin son appelant), avec le nom du titulaire
   attendu. Réservé à `peutEngager(role, "facturer")` (le geste de virer, décision D-6).
   **Chaque affichage est journalisé** (qui, quand, quel apporteur, quatre derniers
   caractères : jamais l'IBAN). Rien n'est mis en cache, rien n'est rendu dans le HTML
   initial : l'IBAN n'arrive qu'à la demande, par une action serveur.
2. **La pièce RIB suit.** À la validation, le RIB de la demande devient la pièce `rib`
   courante (section 2.2, point 7). L'ancienne pièce porte « Remplacée le … — ne plus
   utiliser pour virer » dans la fiche. Ainsi, quiconque vire encore depuis la pièce tombe
   aussi sur le nouveau compte.

Pendant 10 jours après une validation, le formulaire « Virement fait » demande : « Sur quel
compte ce virement est-il parti ? » avec deux choix (compte actuel, compte précédent). Cas
visé : le virement est parti de la banque avant la validation, et « Virement fait » est
cliqué après. À chaque « Virement fait », le site enregistre le compte choisi (empreinte et
quatre derniers caractères) dans `apporteur_virements_compte`. Le premier virement déclaré
sur un compte est marqué et affiché comme tel. L'e-mail existant `apporteur-virement-fait`
précise alors « sur votre compte qui se termine par … » (champ facultatif de la charge,
rétrocompatible : un ancien worker l'ignore).

Test bloquant (lot 7) : **après validation, l'IBAN présenté pour virer et la pièce `rib`
courante sont ceux du nouveau compte ; avant validation, ce sont ceux de l'ancien.**

### 4.4 Cas limites

| Cas                                                              | Traitement                                                                                                                                                                         |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Virement parti sur l'ancien compte, fermé depuis                 | Hors du site aujourd'hui (pas d'annulation de « Virement fait » trouvée). À traiter à la main ; voir section 10.                                                                   |
| Demande validée alors qu'une autofacture attend son virement     | Le virement part sur le nouveau compte. Le bandeau disparaît, la mention « premier virement sur ce compte » apparaît.                                                              |
| Opposition après validation                                      | Impossible par le lien d'opposition. La personne écrit ; l'administrateur traite (runbook, lot 8). Si l'argent est déjà parti : rappel de fonds auprès de la banque, hors du site. |
| Apporteur avec commissions suspendues, reprises ou solde négatif | Aucun effet : le changement ne touche qu'au compte.                                                                                                                                |
| Deux demandes en même temps (deux onglets)                       | L'index unique partiel n'en laisse qu'une ; la seconde reçoit « Une demande est déjà en cours ».                                                                                   |
| Demande jamais confirmée, nouvelle demande à J + 25 h            | La création passe d'abord l'ancienne à `expiree`, puis insère : acceptée.                                                                                                          |
| Validation en double clic                                        | Écriture conditionnée au statut `confirmee` : une seule passe.                                                                                                                     |
| Nouvel IBAN égal à l'actuel                                      | Refus immédiat : « Ce compte est déjà le vôtre chez nous. »                                                                                                                        |
| IBAN hors zone SEPA                                              | Refus par `ibanValide`, comme à l'inscription.                                                                                                                                     |
| Oppositions répétées par un tiers                                | Limite de débit sur l'opposition ; une demande déjà opposée ne recoupe pas le lien.                                                                                                |

## 5. Écrans

### 5.1 Espace apporteur (mots simples)

Nouvelle section sur la page « signé », sous le contrat : **« Mon compte bancaire »**.
Page rendue côté serveur ; le formulaire est un petit composant client chargé seulement
sur cette page (hors des 15 pages stratégiques, sous le cliquet « Routes /apporteur/dossier »
de 25 KB, à mesurer).

Les textes complets de chaque état sont en section 12 (« Textes à faire relire »). Six états :
normal, formulaire, après l'envoi, demande confirmée en attente, après validation, après
refus. Plus les messages d'erreur, et l'état « service fermé » (interrupteur éteint ou secret
d'empreinte absent : le bouton « Changer de compte » n'apparaît pas).

**Pages des liens de l'e-mail** : une seule route, **hors du chemin à jeton** :
`/apporteur/dossier/compte/[demande]/[signature]` (segment statique `compte`, frère de
`retrouver`, prioritaire sur `[id]` dans le routage). Placée sous `/apporteur/dossier/`, elle
hérite sans rien ajouter de l'exclusion du proxy, de `noindex`, de `Referrer-Policy:
same-origin`, de la CSP stricte et de la purge Sentry du corps de requête. L'action
(`confirmer` ou `bloquer`) fait partie de la charge signée, pas d'un paramètre libre. Lien
expiré, déjà utilisé, faux ou d'une autre demande : une seule page neutre.

Règles d'affichage : jamais un IBAN entier, ni l'ancien ni le nouveau ; l'adresse e-mail est
masquée ; aucune de ces pages n'est indexée ni mise en cache (`no-store`) ; aucune ne contient
le lien personnel de l'espace.

### 5.2 Console (l'outil propose, le `super_admin` valide)

**Liste** : nouvelle page `apporteurs/changements-de-compte`, et un compteur sur la page des
apporteurs. Colonnes : apporteur, demandée le, état (expiration calculée), validable à partir
du, alertes. Bandeau rouge si `IBAN_EMPREINTE_SECRET` est absent : « Le secret d'empreinte
n'est pas posé : aucune demande ne peut être enregistrée. »

**Fiche de l'apporteur** : nouveau bloc « Compte bancaire » avec le compte courant (masqué),
la demande ouverte s'il y en a une, et l'historique des comptes (dates, quatre derniers
caractères, origine). La pièce `rib` remplacée porte la mention « ne plus utiliser pour
virer ».

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
   - la demande et la confirmation viennent-elles du même navigateur résumé et de la même
     adresse IP hachée que la signature du contrat (information, jamais un blocage).
3. Le RIB, ouvert dans la page, à côté de l'IBAN demandé (affiché en entier après un clic
   journalisé, décision D-3) et du nom de l'apporteur et de son entreprise.
4. Le numéro de téléphone de la fiche, avec la consigne (texte en section 12).
5. **Trois cases à cocher obligatoires** (les mêmes qu'en section 2.2, point 6).
6. Deux boutons : **Valider le changement** (confirmation à retaper : les quatre derniers
   caractères du nouvel IBAN) et **Refuser** (motif obligatoire, envoyé à l'apporteur ;
   aperçu de l'e-mail avant envoi, comme les autres envois de la console). Pour un rôle
   autre que `super_admin`, les deux boutons sont remplacés par « Seul le super
   administrateur peut décider », et l'action serveur refuse de toute façon.
7. Si le compte est partagé avec le parrain ou un filleul : proposition « Suspendre les
   sommes de parrainage le temps de la vérification (art. 4.6) », décochée par défaut.

**Habilitations** :

- lire la liste : administrateurs ;
- ouvrir le RIB d'une demande et afficher l'IBAN demandé en entier : `super_admin` (c'est
  l'écran de la décision) ;
- valider ou refuser : `peutEngager(role, "valider_changement_iban")` = `super_admin` seul ;
- afficher l'IBAN à virer dans « Virements à faire » : `facturer` (décision D-6).
  Chaque ouverture du RIB ou affichage d'un IBAN entier est journalisé, sans l'IBAN.

**Virements à faire** : bandeau, bouton « Afficher l'IBAN à virer » et choix du compte
(section 4).

## 6. E-mails

### 6.1 Règles communes

- Tous partent de `src/features/apporteurs-reseau/envois.ts`, à l'adresse connue de la fiche.
- **Jamais d'IBAN entier.** Seulement « le compte qui se termine par 1234 ».
- Jamais de pièce jointe.
- **Aucun e-mail de sécurité ne porte le lien personnel de l'espace.** Les e-mails 1 à 5
  sont exclus du bouton « Ouvrir mon espace » ajouté d'office par `avecLienEspace`. Quand un
  lien neuf doit partir (après opposition ou validation), il part dans un **e-mail séparé**,
  par le gabarit **existant** `apporteur-lien-espace` (aucun nouveau nom côté worker).
- Les liens « Je confirme » et « Bloquer cette demande » de l'e-mail 1 pointent vers
  `/apporteur/dossier/compte/<idDemande>/<signature>` : ils ne contiennent pas le jeton
  personnel (test : le corps rendu de l'e-mail 1 ne contient pas `jetonDossier(...)`).
- Ils entrent dans `GABARITS_ARGENT` : un apporteur retiré du réseau les reçoit encore.
- Texte non modifiable par l'administrateur, sauf le motif du refus.
- Clé d'envoi unique par demande et par étape (pas de doublon).
- Les alertes internes utilisent le gabarit existant `qualiopi-alerte-interne` : aucun
  nouveau nom côté worker. Elles ne portent ni IBAN ni adresse e-mail.

**Choix sur `gabaritRepli` : aucun repli, et c'est verrouillé.** AGENTS.md demande un
`gabaritRepli` pour tout nouveau nom de gabarit. Ce plan s'en écarte, et voici pourquoi :

- Un repli ne sert qu'à un worker **plus ancien** que le lot des gabarits. Il doit donc être
  un gabarit **déjà connu** de ce worker. Un gabarit « neutre » créé dans le lot 2 lui serait
  inconnu aussi : il ne protégerait rien.
- Parmi les gabarits existants, aucun ne dit vrai à la place d'une alerte de sécurité. Le
  seul neutre, `apporteur-lien-espace`, **redonne le lien personnel** : exactement ce qu'un
  e-mail de sécurité ne doit pas faire. « Dossier bien reçu » à la place de « Confirmez votre
  changement de compte » serait trompeur.
- Sans repli, le pire cas est sûr : le worker reporte 90 minutes puis échoue franchement
  (`UnrecoverableError`, journal, Sentry). `avis_envoye_at` reste vide, donc **la demande ne
  peut pas être validée** ; elle expire à 24 heures. Personne ne reçoit un texte faux, et
  l'argent ne bouge pas.

Protections qui remplacent le repli : (1) ordre de mise en ligne : lot 2 en ligne sur le
worker, **vérifié par son contenu** (commande d'AGENTS.md), un créneau avant le lot 4 ;
(2) l'émetteur refuse d'émettre si l'interrupteur est éteint ; (3) un test
(`les-e-mails-de-compte-n-ont-pas-de-repli.spec.ts`) verrouille l'absence de
`gabaritRepli` dans ces charges et cite cette section, pour qu'une session future ne
« corrige » pas le choix en posant un repli trompeur.

### 6.2 Les e-mails

Cinq gabarits nouveaux, plus le gabarit existant `apporteur-lien-espace` :

| #   | Gabarit                            | Quand                                                           | Lien porté                      |
| --- | ---------------------------------- | --------------------------------------------------------------- | ------------------------------- |
| 1   | `apporteur-compte-a-confirmer`     | à la demande                                                    | confirmer, bloquer (hors jeton) |
| 2   | `apporteur-compte-demande-bloquee` | après une opposition                                            | aucun                           |
| 3   | `apporteur-compte-change`          | après la validation                                             | aucun                           |
| 4   | `apporteur-compte-refuse`          | après un refus                                                  | aucun                           |
| 5   | `apporteur-compte-expire`          | demande expirée, au retour sur l'espace (D-5)                   | aucun                           |
| —   | `apporteur-lien-espace` (existant) | après une opposition et après une validation, e-mail **séparé** | lien personnel neuf             |

Textes intégraux : section 12.

L'e-mail existant `apporteur-virement-fait` reçoit un ajout facultatif « sur votre compte
qui se termine par … » (lot 7).

## 7. RGPD

- **Finalité et base** : exécuter le contrat (verser les commissions), obligation comptable,
  et intérêt légitime pour la lutte contre le détournement de paiement (preuve des demandes,
  empreintes, IP hachée). Le contrat couvre déjà les « coordonnées bancaires » (art. 7.8).
- **Minimisation** : IBAN toujours chiffré, clé exigée ; empreinte par HMAC à secret dédié ;
  quatre derniers caractères seulement pour l'affichage ; IP hachée ; navigateur résumé
  (`resumerNavigateur`, famille et système, jamais la chaîne entière) ; aucun IBAN dans le
  journal, les alertes, Sentry, les e-mails ou les adresses de page.
- **« Jamais supprimé » et durée** : l'historique des comptes et les lignes de demande sont
  des pièces de preuve d'un paiement. Durée proposée : celle des pièces comptables (dix ans,
  art. L.123-22 du code de commerce, déjà citée au contrat). À confirmer (décision D-7).
- **RIB joints** : les octets d'un RIB de demande validée deviennent la pièce `rib` du dossier
  et en suivent la durée. Ceux d'une demande refusée, expirée ou annulée sont purgés 90 jours
  après la clôture (la ligne reste, avec `purge_at`). Ceux d'une demande contestée
  (opposition) sont gardés 5 ans : c'est la preuve d'une tentative de fraude. La ligne de la
  demande n'est jamais supprimée.
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
- **Droits d'accès internes** : RIB de demande et IBAN demandé entier réservés au
  `super_admin` ; IBAN à virer entier réservé à `facturer` ; chaque lecture est journalisée.

## 8. Interrupteur et secret

- Interrupteur unique : `APPORTEUR_CHANGEMENT_IBAN_ENABLED` (lu à l'exécution, conteneur de
  l'application, « éteint » sauf valeur `true`). Éteint : aucune section dans l'espace, les
  actions répondent « Ce service est fermé », la route des liens rend la page neutre,
  l'émetteur refuse d'émettre, la console n'affiche que l'historique et les demandes
  existantes (aucune validation possible), le bouton « Afficher l'IBAN à virer » n'apparaît
  pas.
- `IBAN_EMPREINTE_SECRET` absent : toute demande est refusée (« Ce service est fermé pour le
  moment »), le bouton « Changer de compte » n'apparaît pas, et la console affiche un bandeau
  rouge en permanence sur la page des demandes et sur la page des apporteurs (pas seulement
  le jour de la première demande). Vérification ajoutée à l'ordre de mise en service.

## 9. Ordre de fusion et de mise en service

1. Lots 1 et 3 (indépendants). Lot 2 dès que ses textes sont relus.
2. **Un créneau de mise en ligne.** Vérifier : migration passée (`prisma migrate status`,
   AGENTS.md), gabarits présents **dans le contenu** du conteneur worker.
3. Lot 4. Puis lots 5, 6 et 7, dans n'importe quel ordre. Puis lot 8.
4. Mise en ligne. Vérifier sur les deux conteneurs. Vérifier que `IBAN_EMPREINTE_SECRET` est
   posé sur l'application (le bandeau de la console ne doit pas s'afficher).
5. Essai réel sur une fiche de test, interrupteur allumé pour cet essai.
6. Allumer l'interrupteur (décision du dirigeant, D-9).
7. Lot 9.

Retour arrière : éteindre l'interrupteur. Les demandes ouvertes restent en base, visibles
dans la console ; aucune n'est validée tant qu'il est éteint.

## 10. Ce que je n'ai pas pu vérifier

- **Si `IBAN_EMPREINTE_SECRET` est posé en production** sur le conteneur de l'application.
  Aucun accès à Coolify ni au serveur depuis cette session.
- **S'il existe un moyen d'annuler un « Virement fait »** (virement revenu de la banque).
  Je n'en ai pas vu dans `facturation.ts` ni `actions-commissions.ts`.
- **Le texte exact de l'autofacture en PDF.** Aucune mention d'IBAN dans
  `autofacture-donnees.ts`, `commissions.ts` ni `facturation.ts`, mais aucun PDF rendu.
- **Les points de droit** : durées de conservation ; garder 5 ans le RIB d'une demande
  contestée ; attendre la décision avant de virer sans manquer à l'article 5.4 ; mention à
  ajouter ou non au contrat (version 2.7). À faire relire par le juriste et le délégué à la
  protection des données (décisions D-7 et D-8).
- **Aucun test n'a été lancé** et aucune page n'a été ouverte : ce plan vient de la lecture
  du code. Les lectures du worker sur `apporteurs_reseau` sans liste de colonnes sont
  affirmées par les commentaires du schéma ; je ne les ai pas toutes recensées.
- **Le poids du composant client** de l'espace n'est pas mesuré.

## 11. Découpage en lots de code

Chaque lot est une PR ouverte en brouillon. Règle commune : **les tests sont écrits d'abord
et doivent être rouges** avant le code. Tout ce qui est visible ou agit est sous
l'interrupteur `APPORTEUR_CHANGEMENT_IBAN_ENABLED` (section 8).

| Lot | Titre                                                            | Nature            | Sous interrupteur                  | Dépend de                          |
| --- | ---------------------------------------------------------------- | ----------------- | ---------------------------------- | ---------------------------------- |
| 1   | Schéma et règles pures                                           | données           | non (rien ne lit les tables)       | —                                  |
| 2   | Gabarits d'e-mail, sans émetteur                                 | sécurité          | non (aucun émetteur)               | textes relus (section 12)          |
| 3   | Habilitation `super_admin` et gardes                             | sécurité          | non (acte sans appelant)           | —                                  |
| 4   | Cœur serveur                                                     | sécurité, argent  | oui                                | 1, 2 **en ligne sur le worker**, 3 |
| 5   | Espace apporteur et route des liens                              | écran, sécurité   | oui                                | 4                                  |
| 6   | Console : décision                                               | écran, sécurité   | oui (validation)                   | 4                                  |
| 7   | Virements : le compte réellement payé                            | argent            | oui (affichage de l'IBAN à virer)  | 1, 4 ; D-6                         |
| 8   | RGPD, purge, alerte 10 jours                                     | données           | non (tolère tables vides/absentes) | 1, 4 ; D-7                         |
| 9   | Compléments (demande depuis la console, reprise de l'historique) | données, sécurité | oui                                | 4, 6                               |

### Lot 1 : schéma et règles pures (données)

- **Fichiers** : `prisma/schema.prisma` (quatre modèles, une énumération nouvelle) ;
  `prisma/migrations/<date>_apporteur_changement_iban/migration.sql` (tables, index partiel,
  contrôles, déclencheurs anti-`DELETE`) ; `src/features/apporteurs-reseau/changement-iban-regles.ts`
  (nouveau, pur : délais 24 h, 72 h, 10 jours, 30 jours en constantes isolées ; transitions
  permises ; « expirer avant d'insérer » ; quatre derniers caractères ; masquage de
  l'adresse) ; documentation du retour arrière dans `docs/`.
- **Tests rouges d'abord** (`src/features/apporteurs-reseau/__tests__/`) :
  - `le-changement-d-iban-n-ajoute-rien-aux-tables-existantes.spec.ts` : la migration ne
    contient ni `DROP`, ni `ALTER TABLE apporteurs_reseau`, ni `ALTER TYPE` d'une énumération
    existante, ni clé étrangère.
  - `changement-iban-regles.spec.ts` : chaque transition permise et interdite ; expiration à
    24 h pile ; validation impossible à 71 h 59, possible à 72 h ; 10 jours aux bornes ;
    trois demandes sur 30 jours.
  - intégration (base réelle) : l'index partiel refuse une seconde demande ouverte ;
    **demande à J non confirmée, nouvelle demande à J + 25 h acceptée** (expiration écrite
    puis insertion, même transaction) ; le déclencheur refuse `DELETE` ; un IBAN en clair
    est refusé par le contrôle ; un RIB au-delà de 10 Mo est refusé par le contrôle.
  - garde du dépôt sur les lignes `/// rgpd:` : passe avec les quatre modèles.

### Lot 2 : gabarits d'e-mail, sans émetteur (sécurité)

- **Fichiers** : `src/lib/email/templates/apporteur-compte.tsx` (nouveau),
  `src/lib/email/templates/index.tsx`, `src/server/queue/types.ts` (noms de gabarit),
  `src/server/email/outbox-policy.ts`, `src/server/email/apercu/catalogue.ts`, les cliquets
  de gabarits (`src/lib/email/templates/__tests__/cliquets/`).
- **Tests rouges d'abord** : rendu de chaque gabarit avec une charge type ; **aucun rendu ne
  contient une suite qui a la forme d'un IBAN** (motif `IBAN_RE` de `journaliser.ts`) même si
  la charge en contient un par erreur ; aucun rendu ne contient un lien `/apporteur/dossier/<uuid>/` ;
  le catalogue reste complet ; chaque gabarit est connu de `estGabaritConnu` ;
  `les-e-mails-de-compte-n-ont-pas-de-repli.spec.ts` (section 6.1).
- **Aucun émetteur dans ce lot.** Après fusion : attendre un créneau, puis vérifier le
  contenu du conteneur worker avant de fusionner le lot 4.

### Lot 3 : habilitation `super_admin` et gardes (sécurité)

- **Fichiers** : `src/server/auth/habilitations.ts` (nouvel acte
  `valider_changement_iban: ["super_admin"]`, commentaire « règle du dirigeant : rôle le plus
  élevé ») et ses tests existants ; `src/features/apporteurs-reseau/__tests__/l-adresse-e-mail-ne-change-pas-sans-fermer-les-demandes.spec.ts`
  (garde statique, section 2.5) ; `src/lib/observability/sentry-pii-scrub.token.spec.ts`
  (cas `/apporteur/dossier/compte/<uuid>/<signature>`).
- **Tests rouges d'abord** : `peutEngager("admin", "valider_changement_iban") === false`,
  `peutEngager("super_admin", …) === true` ; la matrice reste cohérente avec
  `ROLES_ECRITURE` ; la garde statique échoue sur une écriture fictive d'`email` ; la purge
  Sentry s'applique à la nouvelle route (vert dès l'écriture si le préfixe couvre bien : le
  test fixe le contrat).
- Indépendant de tout : l'acte n'a pas d'appelant avant le lot 4.

### Lot 4 : cœur serveur (sécurité, argent)

- **Fichiers** : `src/features/apporteurs-reseau/changement-iban.ts` (nouveau : demander,
  confirmer, s'opposer, annuler, valider, refuser) ;
  `src/features/apporteurs-reseau/jeton-changement-iban.ts` (nouveau, `fabriqueLienSigne`,
  domaine `apporteur-compte`, charge `<idDemande>:<apporteurId>:<action>`, **sans
  `versionLien`**) ; `envois.ts` (cinq gabarits, exclusion de `avecLienEspace`, envoi séparé
  d'`apporteur-lien-espace`) ; `retrait.ts` (`GABARITS_ARGENT`) ; `parrainage.ts`
  (comparaison réutilisée, sans changement de règle) ; lecture de l'interrupteur et du secret.
- **Tests rouges d'abord** :
  - `la-demande-ne-touche-jamais-la-fiche.spec.ts` : après demande et après confirmation,
    `apporteurs_reseau.iban` et la pièce `rib` courante sont identiques octet pour octet.
  - `le-lien-personnel-seul-ne-change-pas-l-iban.spec.ts` : sans confirmation, la validation
    est refusée, même par un `super_admin`.
  - `seul-le-super-admin-valide.spec.ts` : `admin` refusé côté serveur, même avec les trois cases.
  - `la-validation-attend-72-heures.spec.ts` et `…-exige-l-avis-envoye.spec.ts`.
  - `la-validation-exige-les-trois-cases.spec.ts`.
  - `l-ancien-iban-entre-dans-l-historique.spec.ts` : même transaction ; si le journal
    échoue, rien n'est écrit (ni fiche, ni pièce, ni historique).
  - `le-rib-de-la-demande-devient-la-piece-courante.spec.ts` : l'ancienne pièce est marquée
    remplacée, **ses octets sont gardés**.
  - `la-validation-renouvelle-le-lien-et-l-envoie-a-part.spec.ts` : l'e-mail 3 ne contient
    aucun lien d'espace ; un `apporteur-lien-espace` part séparément.
  - `l-opposition-coupe-le-lien-et-alerte.spec.ts` : le lien neuf part à l'adresse de la
    fiche, **jamais** à une adresse lue dans la requête ; une seconde opposition sur la même
    demande ne recoupe pas le lien ; limite de débit de l'opposition, fermée en cas de panne.
  - `l-e-mail-de-confirmation-ne-contient-pas-le-jeton-personnel.spec.ts` : le corps de
    l'e-mail 1 ne contient pas `jetonDossier(...)` ; le lien « Bloquer » reste valable après
    un `versionLien` + 1.
  - `le-lien-de-confirmation-ne-sert-qu-une-fois.spec.ts` ; lien d'une autre demande, d'un
    autre apporteur, d'une autre action, expiré : même réponse neutre.
  - `aucun-iban-ne-sort-du-serveur.spec.ts` : ni journal, ni alerte, ni charge d'e-mail, ni
    appel Sentry, ni valeur de retour ne contient l'IBAN entier.
  - `sans-secret-d-empreinte-rien-ne-s-enregistre.spec.ts`.
  - `interrupteur-eteint-rien-n-est-lu-ni-ecrit-ni-emis.spec.ts` ; `table-absente-pas-de-demande.spec.ts`.
  - deux demandes simultanées, double validation, validation d'une fiche résiliée ou
    retirée entre-temps : refus.

### Lot 5 : espace apporteur et route des liens (écran, sécurité)

- **Fichiers** : `src/app/apporteur/dossier/[id]/[jeton]/page.tsx` (section) ;
  `MonCompteBancaire.tsx` et `actions-compte.ts` (nouveaux) ; route publique
  `src/app/apporteur/dossier/compte/[demande]/[signature]/page.tsx` et son action (confirmer,
  bloquer : page avec bouton, action serveur) ; `textes.ts`.
- **Tests rouges d'abord** : la section n'apparaît que pour un dossier `signe`, non restreint,
  interrupteur allumé, secret posé ; `le-mode-restreint-n-ouvre-que-la-vigilance.spec.ts`
  reste vert ; **afficher la page de confirmation ne confirme rien** (seul l'envoi du
  formulaire écrit) ; la route `compte/…` n'est pas capturée par `[id]/[jeton]` ; elle répond
  `no-store` ; limite de débit fermée en cas de panne ; aucun IBAN entier ni lien personnel
  dans le rendu ; mesure du cliquet « Routes /apporteur/dossier » ; bout en bout (demande,
  e-mail lu dans la boîte de test, confirmation).

### Lot 6 : console, décision (écran, sécurité)

- **Fichiers** : `src/app/[locale]/(admin)/[adminPrefix]/apporteurs/changements-de-compte/`
  (liste et détail) ; route du RIB de demande (modèle : `apporteurs/[id]/pieces/[pieceId]/route.ts`) ;
  `src/components/admin/apporteurs/fiche/` (bloc « Compte bancaire », mention sur la pièce
  remplacée) ; `src/features/apporteurs-reseau/actions-changement-iban.ts` (nouveau) ;
  `requetes-console.ts` ; entrée de navigation de la console.
- **Tests rouges d'abord** : validation et refus refusés hors `super_admin`, sans les trois
  cases, avant le délai ; refus sans motif refusé ; la route du RIB refuse hors `super_admin`
  et sans verdict antivirus ; l'affichage de l'IBAN demandé est journalisé sans l'IBAN ;
  l'alerte « compte déjà connu » apparaît pour le parrain, un filleul, un autre apporteur,
  une demande contestée ; bandeau « secret absent » ; gardes existantes
  (`admin-gardes:check`, `admin-nav:routes-check`).

### Lot 7 : virements, le compte réellement payé (argent)

- **Fichiers** : `src/features/apporteurs-reseau/facturation.ts` (`marquerVerse` écrit la
  preuve de compte ; `lireVirementsAFaire` rend l'état de la demande) ;
  `actions-commissions.ts` (action « Afficher l'IBAN à virer », `facturer`, journalisée) ;
  `src/components/admin/apporteurs/commissions/FormulairesCommission.tsx` ;
  `src/server/paiements-sortants/virements.ts` (champ facultatif pour le bandeau) et la page
  des virements ; `envois.ts` (`apporteur-virement-fait`, champ facultatif).
- **Attention** : `facturation.ts` est aussi chargé par le worker. `marquerVerse` n'est
  appelé que par l'application, mais toute lecture nouvelle dans ce fichier doit tolérer la
  table absente ; l'action qui lit l'IBAN vit dans `actions-commissions.ts` (application
  seulement).
- **Tests rouges d'abord** :
  - **`apres-validation-on-vire-sur-le-nouveau-compte.spec.ts`** : après validation, l'IBAN
    présenté pour virer et la pièce `rib` courante sont ceux du nouveau compte ; avant
    validation (demande `confirmee`), ceux de l'ancien.
  - l'IBAN à virer n'est pas dans le HTML initial ; son affichage est refusé hors
    `facturer` et journalisé sans l'IBAN.
  - « Virement fait » sans demande ouverte : comportement d'aujourd'hui, plus une ligne de
    preuve ; avec demande ouverte : accepté, bandeau présent ; dans les 10 jours après
    validation : le choix du compte est exigé ; table absente : « Virement fait » fonctionne
    comme aujourd'hui ; les tests existants de `facturation` restent verts sans modification.

### Lot 8 : RGPD, purge, alerte 10 jours (données)

- **Fichiers** : `src/lib/rgpd-reseau-apporteur.ts` (export) ; `src/lib/rgpd-erase.ts` ;
  `src/features/apporteurs-reseau/passage-quotidien.ts` (worker : purge des RIB de demandes
  closes, alerte « 10 jours sans décision », les deux tolérantes à la table absente) ;
  `docs/fonctionnement-reseau-apporteurs.md` ; runbook « changement de compte contesté »
  dans `docs/runbooks/` ; politique de confidentialité ; registre.
- **Tests rouges d'abord** : l'export ne rend pas l'IBAN d'une demande refusée ou contestée ;
  l'effacement annule la demande ouverte et garde l'historique ; la purge ne touche jamais
  une demande validée ni contestée de moins de 5 ans ; le passage quotidien tourne sans
  erreur quand les tables n'existent pas ; l'alerte « 10 jours » part une seule fois par
  demande et sans IBAN ; `le-worker-n-importe-pas-server-only.spec.ts` reste vert.

### Lot 9 : compléments (données, sécurité)

- Demande ouverte par l'administrateur pour une fiche retirée ou résiliée avec de l'argent
  dû (mêmes barrières, validation par `super_admin`).
- Script manuel de reprise de l'historique (section 3.3), avec essai à blanc et rejeu sans
  effet.
- **Tests rouges d'abord** : mêmes barrières que le lot 4 pour une demande d'origine
  `console` ; le script ne modifie aucune fiche et ne crée pas deux lignes au rejeu.

## 12. Textes à faire relire par le dirigeant (mot pour mot)

Les montants, dates et quatre derniers caractères sont des exemples. `<Prénom>` est remplacé
par le prénom de la fiche.

### 12.1 Espace apporteur, section « Mon compte bancaire »

**État normal**

> **Mon compte bancaire**
> Nous versons vos commissions sur le compte qui se termine par **1234**.
> [Changer de compte]

**Formulaire (après « Changer de compte »)**

> **Changer de compte bancaire**
>
> 1. Votre nouvel IBAN : `[ FR76 … ]`
> 2. Le RIB de ce compte (PDF ou photo, 10 Mo au plus) : `[ Choisir un fichier ]`
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

> Compte changé le 29 novembre 2026.

**Après refus**

> **Votre demande n'a pas été acceptée**
> Raison : _(texte écrit par l'administrateur)_
> Votre compte n'a pas changé. Vous pouvez faire une nouvelle demande.

**Service fermé**

> **Mon compte bancaire**
> Nous versons vos commissions sur le compte qui se termine par **1234**.
> Pour changer de compte, écrivez-nous.

**Messages d'erreur**

> Cet IBAN n'est pas valide. Vérifiez-le.
> Ce compte est déjà le vôtre chez nous.
> Ajoutez le RIB du nouveau compte.
> Ce fichier n'est pas accepté. Envoyez un PDF, un PNG ou un JPG de 10 Mo au plus.
> Une demande est déjà en cours.
> Vous avez fait trop de demandes. Écrivez-nous.
> Ce service est fermé pour le moment. Écrivez-nous.

### 12.2 Pages des liens de l'e-mail

**Confirmer**

> **Confirmer le changement de compte**
> Vous demandez que vos commissions soient versées sur le compte qui se termine par **5678**.
> [Oui, je confirme]
> Ce n'est pas vous ? [Bloquer cette demande]

Après le clic :

> **C'est noté.**
> Nous vérifions votre RIB et nous vous appelons. Réponse au plus tôt le 28 novembre.
> En attendant, rien ne change.

**Bloquer**

> **Bloquer cette demande**
> Si vous n'avez pas demandé à changer de compte, cliquez ici. Nous annulons la demande et
> nous vous envoyons un nouveau lien pour votre espace.
> [Je n'ai rien demandé : bloquer]

Après le clic :

> C'est fait. Votre compte n'a pas changé. Regardez vos e-mails : votre nouveau lien y est.
> Nous vous appelons.

**Lien expiré, déjà utilisé ou faux** (une seule page)

> Ce lien ne fonctionne plus.

### 12.3 E-mails à l'apporteur

**E-mail 1 : confirmer la demande** (`apporteur-compte-a-confirmer`)

> Objet : Confirmez votre changement de compte bancaire
>
> Bonjour `<Prénom>`,
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

**E-mail 2 : demande bloquée** (`apporteur-compte-demande-bloquee`)

> Objet : La demande de changement de compte est bloquée
>
> Bonjour `<Prénom>`,
>
> Vous nous avez dit que vous n'aviez pas demandé à changer de compte.
> Nous avons annulé cette demande. Votre compte n'a pas changé.
>
> Par sécurité, l'ancien lien de votre espace ne fonctionne plus.
> Nous vous envoyons le nouveau dans un e-mail séparé.
>
> Nous vous appelons dans les prochains jours pour faire le point.

**E-mail 3 : compte changé** (`apporteur-compte-change`)

> Objet : Votre compte bancaire est changé
>
> Bonjour `<Prénom>`,
>
> C'est fait. À partir du 29 novembre 2026, nous versons vos commissions sur le compte qui
> se termine par **5678**.
> L'ancien compte (qui se termine par **1234**) ne sera plus utilisé.
>
> Par sécurité, l'ancien lien de votre espace ne fonctionne plus.
> Nous vous envoyons le nouveau dans un e-mail séparé.
>
> **Vous n'êtes pas d'accord ?** Répondez tout de suite à cet e-mail ou appelez-nous.

**E-mail 4 : demande refusée** (`apporteur-compte-refuse`)

> Objet : Votre demande de changement de compte n'est pas acceptée
>
> Bonjour `<Prénom>`,
>
> Nous n'avons pas pu accepter votre demande de changement de compte.
> Raison : _(texte de l'administrateur)_
>
> Votre compte n'a pas changé : il se termine toujours par **1234**.
> Vous pouvez faire une nouvelle demande depuis votre espace.

**E-mail 5 : demande non confirmée** (`apporteur-compte-expire`, si D-5 = oui)

> Objet : Votre demande de changement de compte est annulée
>
> Bonjour `<Prénom>`,
>
> Vous n'avez pas confirmé votre demande dans les 24 heures. Nous l'avons annulée.
> Votre compte n'a pas changé. Vous pouvez refaire la demande depuis votre espace.

**Lien neuf** : gabarit existant `apporteur-lien-espace`, texte inchangé (déjà en
production). À relire seulement pour vérifier qu'il se lit bien juste après les e-mails 2
et 3.

**Ajout à l'e-mail existant `apporteur-virement-fait`** (lot 7) :

> … sur votre compte qui se termine par **5678**.

### 12.4 Alertes internes (gabarit `qualiopi-alerte-interne`, sans IBAN ni adresse)

> Changement de compte demandé par `<Prénom> <Nom>`.
> Demande de changement de compte confirmée par `<Prénom> <Nom>` : décision possible à partir du 28 novembre 2026.
> OPPOSITION : `<Prénom> <Nom>` dit ne pas avoir demandé de changement de compte. Le lien de son espace a été coupé. Appelez-le au numéro de sa fiche.
> Demande de changement de compte de `<Prénom> <Nom>` confirmée depuis 10 jours, sans décision.

### 12.5 Console

**Consigne près du téléphone**

> Appelez ce numéro. N'appelez jamais un numéro reçu par e-mail.

**Les trois cases**

> ☐ Le titulaire du RIB est l'apporteur ou son entreprise.
> ☐ L'IBAN du RIB est celui de la demande.
> ☐ J'ai parlé à l'apporteur au numéro de sa fiche.

**Confirmation de validation**

> Tapez les quatre derniers caractères du nouvel IBAN pour valider.

**Rôle insuffisant**

> Seul le super administrateur peut décider.

**Bandeau dans « Virements à faire »**

> Changement de compte demandé le 25 novembre 2026. Compte actuel : se terminant par 1234. Décision possible à partir du 28 novembre 2026. Tant qu'il n'est pas validé, seul le compte actuel est valable.

**Bouton et avertissement**

> [Afficher l'IBAN à virer]
> Cet affichage est enregistré.

**Choix du compte (10 jours après une validation)**

> Sur quel compte ce virement est-il parti ?
> ○ Compte actuel (se termine par 5678)
> ○ Compte précédent (se termine par 1234)

**Pièce RIB remplacée**

> Remplacée le 29 novembre 2026 — ne plus utiliser pour virer.

**Secret absent**

> Le secret d'empreinte n'est pas posé : aucune demande ne peut être enregistrée.

## 13. Décisions attendues du dirigeant

Déjà tranché par le dirigeant, donc **hors décisions** : validation réservée au rôle le plus
élevé (`super_admin`) ; jamais d'IBAN en clair dans un journal, un e-mail ou Sentry ; l'ancien
IBAN reste utilisé tant que le nouveau n'est pas validé.

| #    | Question fermée                                                                                                                                              | Recommandation                                                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| D-1  | Le délai d'opposition est-il de 72 heures après la confirmation ? (oui / non, 48 heures)                                                                     | **Oui, 72 heures.** Le lien n'expire pas et il n'y a pas de session : plus long que les 48 heures des formateurs.                              |
| D-2  | Le rappel téléphonique au numéro de la fiche est-il obligatoire à chaque validation ? (oui / non)                                                            | **Oui.** C'est la seule barrière contre une boîte e-mail volée.                                                                                |
| D-3  | Sur l'écran de décision, l'IBAN demandé s'affiche-t-il en entier après un clic journalisé ? (oui / non, quatre derniers caractères seulement)                | **Oui.** Il faut le comparer au RIB chiffre par chiffre.                                                                                       |
| D-4  | Pendant une demande ouverte, l'outil propose-t-il d'attendre sans bloquer le virement sur le compte actuel ? (oui / non, il bloque)                          | **Oui, sans bloquer.** L'art. 5.4 ne permet pas de différer un versement pour ce motif.                                                        |
| D-5  | Envoie-t-on l'e-mail « demande non confirmée », seulement quand l'apporteur revient sur son espace ? (oui / non)                                             | **Oui.** Aucune tâche planifiée ; l'apporteur comprend pourquoi sa demande a disparu.                                                          |
| D-6  | Qui peut afficher l'IBAN à virer en entier dans « Virements à faire » ? (A : `super_admin` et `admin`, ceux qui peuvent `facturer` / B : `super_admin` seul) | **A.** C'est le geste de virer, déjà réservé à `facturer` ; chaque affichage est journalisé. La validation, elle, reste `super_admin` seul.    |
| D-7  | Garde-t-on l'historique des comptes et les demandes 10 ans, les RIB de demandes contestées 5 ans, et purge-t-on les autres RIB à 90 jours ? (oui / non)      | **Oui**, sous réserve de l'avis du délégué à la protection des données avant le lot 8.                                                         |
| D-8  | Ajoute-t-on la procédure de changement de compte au contrat (version 2.7) ? (oui, à la prochaine révision / non)                                             | **Oui, à la prochaine révision**, sans bloquer la mise en service : l'art. 6.3 couvre déjà l'obligation de signaler. Relecture par le juriste. |
| D-9  | Allume-t-on l'interrupteur après l'essai réel sur une fiche de test ? (oui / non)                                                                            | **Oui**, après l'essai, et après vérification que le secret d'empreinte est posé.                                                              |
| D-10 | Valide-t-on les textes de la section 12 tels quels ? (oui / non, avec corrections)                                                                           | **Oui.** Le lot 2 (gabarits) et le lot 5 (espace) en dépendent.                                                                                |
