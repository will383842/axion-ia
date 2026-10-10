# ADR 0066 — Parcours du formateur indépendant : de la candidature au virement

- **Statut** : **ACCEPTÉ** (v2)
- **Date** : 2026-10-10
- **Auteur** : Will + Claude
- **Lot** : S0 du chantier « formateurs freelance » (socle documentaire, sans code)
- **Prolonge** : ADR 0051 (frontière console / espace des apporteurs), ADR 0053 (dossier client), ADR 0059 (registre des numéros émis), ADR 0060 (verrou et réouverture motivée)
- **Complété par** : ADR 0067 (une fiche formateur par relation)
- **Référence** : `prisma/schema.prisma` (`Trainer`, `TrainerStatut.sous_traitant`, `JobApplication`, `JobApplicationStatus`, `RendezVousSuivi` / `rendez_vous_suivis`, `RendezVousDecisionApporteur`) ; parcours apporteur existant (candidature, échange Calendly, point d'après appel, dossier à jeton, contrat signé avec code par e-mail)

## Contexte

Axion-IA confie une partie de ses interventions à des **formateurs IA indépendants**
(fiche `Trainer` au statut `sous_traitant`) et à des **organismes sous-traitants**.
Aujourd'hui, leur entrée dans la relation se fait à la main : pas de contrôle registre
tracé, pas de contrat-cadre unique, pas de lien automatique entre une convention client
signée et l'engagement du formateur, et un paiement qui dépend de relevés mensuels
recalculés.

Le parcours des **apporteurs d'affaires** a déjà résolu les mêmes questions —
candidature, échange visio, issue de l'échange, dossier en ligne à jeton, contrôle du
registre, contrat signé avec code par e-mail, contresignature, activation, autofacture.
Ce qui manque est un parcours équivalent pour les formateurs indépendants, avec les
contraintes propres à la sous-traitance de formation : obligation de vigilance
(art. L8222-1 C. trav.), numéro de déclaration d'activité, émargements, délais de
paiement (art. L441-10 C. com.) et facture électronique.

Cet ADR fixe le parcours de bout en bout et les règles qui ne se renégocient pas lot par
lot. Il ne contient aucun code : chaque lot du chantier s'y réfère.

## Décision

### (a) Périmètre

- **Concernés** : les formateurs IA **indépendants** (fiche `Trainer` au statut
  `sous_traitant`) et les **organismes sous-traitants** (personne morale qui met un
  intervenant à disposition).
- **Jamais concernés** : les salariés (`TrainerStatut.salarie`) et le dirigeant-formateur
  (`TrainerStatut.dirigeant`). Aucune brique de ce parcours (contrôle registre, contrat de
  sous-traitance, lettre de mission, autofacture, garde de mission) ne s'applique à eux,
  et aucune ne doit pouvoir être déclenchée sur leur fiche.
- **Vocabulaire** : celui d'une relation entre entreprises — **mission**,
  **rémunération de la mission** (ou « tarif à la journée »), **contrat-cadre de
  sous-traitance**. Jamais le vocabulaire du contrat de travail, ni celui du mandat
  d'agence commerciale.

### (b) Le parcours, calqué sur celui des apporteurs

| #   | Étape                  | Règle                                                                                                                                                                                                                                                                                                                       |
| --- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Candidature**        | Enregistrée comme `JobApplication`, **jamais** comme `Submission` (une `Submission` est un prospect client).                                                                                                                                                                                                                |
| 2   | **Échange visio**      | Rendez-vous Calendly de type **« Échange formateur indépendant »**, distinct des types client et apporteur. Voir (c).                                                                                                                                                                                                       |
| 3   | **Issue de l'échange** | Portée par `rendez_vous_suivis`, avec les **cinq issues** déjà connues des apporteurs : retenu, à revoir, non retenu (échange tenu, champ `decision`), absent, reporté. **Aucun statut `JobApplicationStatus` n'est écrit pour un indépendant** : l'issue de l'échange est la seule source de vérité de son avancement.     |
| 4   | **« Retenu »**         | Crée une fiche `Trainer` **inactive** (statut `sous_traitant`). Elle n'est proposable à aucune mission tant que l'étape 8 n'est pas franchie.                                                                                                                                                                               |
| 5   | **Dossier en ligne**   | Lien à jeton, sans compte : identité, SIREN, numéro de déclaration d'activité, attestation de vigilance URSSAF, attestation d'assurance, IBAN, CV et justificatifs de compétences.                                                                                                                                          |
| 6   | **Contrôle registre**  | Quatre vérifications : SIREN **actif**, établissement **ouvert**, activité cohérente, et numéro de déclaration d'activité **présent sur la liste publique des organismes de formation au même SIREN**. Résultat **vert / orange / rouge**, avec une **preuve horodatée** (réponse source, date, sens du verdict). Voir (i). |
| 7   | **Contrat-cadre**      | **Un seul** contrat-cadre de sous-traitance, **version 3**, pour les indépendants **et** les organismes ; seules des clauses variables changent (forme juridique, intervenant mis à disposition). Signé par le formateur avec un **code reçu par e-mail**, puis **contresigné** par Axion-IA.                               |
| 8   | **Activation**         | Par **un seul écrivain** (un seul module a le droit d'activer une fiche formateur indépendant), à l'initiative d'un administrateur identifié — **jamais par `system`**, jamais par une tâche de fond.                                                                                                                       |
| 9   | **Missions proposées** | Le formateur est **libre d'accepter ou de refuser** chaque mission. Aucune exclusivité, aucun volume minimal, aucun planning imposé.                                                                                                                                                                                        |
| 10  | **Lettre de mission**  | **Une page**, générée **automatiquement** quand deux conditions sont réunies : la convention client est **signée par toutes les parties** ET le formateur a cliqué **« J'accepte »**. **Une lettre vivante par mission** : elle se met à jour (dates, lieu) par versions, elle ne se duplique pas.                          |
| 11  | **Réalisation**        | Les journées sont prouvées par les **émargements signés** (et leurs contresignatures).                                                                                                                                                                                                                                      |
| 12  | **Autofacture**        | **Une autofacture par mission**, émise par Axion-IA pour le compte du formateur, dans le cadre du mandat prévu au contrat-cadre.                                                                                                                                                                                            |
| 13  | **Virement**           | À l'échéance fixée en (e).                                                                                                                                                                                                                                                                                                  |

### (c) L'échange formateur est « hors clients »

Un échange formateur indépendant n'est **jamais** traité comme un rendez-vous client :

- **jamais d'e-mail client** (ni confirmation commerciale, ni relance de devis, ni
  questionnaire de cadrage) ;
- **jamais dans le CRM** (aucune `Submission`, aucun prospect, aucune opportunité) ;
- **jamais de dossier client** (aucune entreprise, personne, projet ni fait rattachés —
  ADR 0053) ;
- **jamais de visio enregistrée** (le circuit d'enregistrement et de compte rendu des
  ADR 0054 à 0056 ne s'y applique pas).

Le type Calendly « Échange formateur indépendant » est la clé de ce routage : tout
traitement qui ne reconnaît pas le type ne doit rien écrire côté client.

### (d) La garde de mission

Avant **toute écriture d'affectation** d'un formateur indépendant à une session ou une
mission, une garde unique vérifie, **dans cet ordre et sans exception** :

1. le contrat-cadre est **contresigné dans la version en vigueur** (une signature d'une
   version antérieure ne suffit pas) ;
2. le **SIRET est actif**, d'après un contrôle registre **relu il y a un mois au plus** ;
3. le **numéro de déclaration d'activité** est renseigné et contrôlé ;
4. l'**attestation de vigilance URSSAF** est **valide** à la date de l'affectation.

La garde s'applique **à toutes les portes** : écran de session, proposition de mission,
acceptation par le formateur, import, duplication de session, remplacement d'un
intervenant. Une porte qui écrit une affectation sans passer par la garde est un défaut,
pas une exception.

### (e) L'argent

- **Propriétaire unique du paiement.** Une session a **un seul** mode de paiement du
  formateur :
  - une session **commencée avant la date de bascule** reste **entièrement** au relevé
    mensuel existant ;
  - une session commencée **à partir de la date de bascule** relève **entièrement** du
    paiement par mission.

  Aucune session n'est partagée entre les deux. L'attribution est inscrite dans une
  **table de revendication inaltérable** (insertion seule) : le premier propriétaire
  inscrit est le seul, et il ne se réécrit pas.

- **Journées payées** : lues dans les **contresignatures d'émargement**, jamais saisies
  à la main ni déduites du planning.
- **Échéance fixe** = **dernière journée réalisée + 30 jours**, sur **tous** les chemins
  (relevé mensuel compris), conformément à l'article L441-10 du Code de commerce.
  Le paiement **ne dépend jamais** de l'encaissement du client : « payé quand le client
  paie » est interdit.
- **Attestation de vigilance périmée** : elle **bloque les nouvelles missions et le
  virement**, mais **pas l'autofacture** (la dette existe, elle est constatée ; seul le
  décaissement attend une attestation valide).
- **Aucune suppression dans les relevés.** Un brouillon recalculé n'est pas effacé : il
  est **marqué annulé** et remplacé, et l'historique reste lisible.
- **IBAN** : stocké **chiffré**, **lié à la fiche** formateur. Tout changement d'IBAN est
  **validé par un administrateur avant tout virement** ; tant qu'il ne l'est pas, le
  virement attend.

### (f) Les drapeaux et interrupteurs

- Une **garde qui échoue reste FERMÉE** : en cas d'erreur, de donnée manquante ou de
  tiers injoignable, la garde refuse ; elle ne laisse jamais passer « faute de mieux ».
- Un **envoi qui échoue est ARRÊTÉ** : il n'est pas rejoué en boucle ; il est signalé
  et attend une action.
- Les **interrupteurs** du chantier (allumage du parcours, des campagnes, du paiement par
  mission) sont **lus par un seul module**. Aucun autre fichier ne lit directement la
  variable d'environnement correspondante.

### (g) Les campagnes d'e-mails

- **Un seul moteur** de campagnes (relances de dossier, de signature, d'attestation),
  partagé avec les autres parcours ; pas de moteur propre aux formateurs.
- **Arrêt automatique dès que la personne agit** (dossier envoyé, contrat signé,
  attestation déposée).
- **État relu juste avant l'envoi** : un message préparé n'est envoyé que si la
  condition qui l'a déclenché est toujours vraie.
- **Une relance par jour au plus** et par personne, **entre 8 h et 19 h** (heure de
  Paris).

### (h) Essais et facture électronique

- **Essais** sur un **banc dédié** aux formateurs, isolé des données des autres
  parcours.
- **Facture électronique** : la **réception** passe par la **plateforme agréée Tiime** ;
  l'**émission des autofactures** au format électronique est en place **avant le
  1er septembre 2027**.

### (i) Les replis par tiers

| Tiers indisponible                        | Repli                                                                                                                                                                              |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Registre public** (SIREN, liste des OF) | Verdict **« à contrôler »** (orange), jamais une conclusion. On ne conclut **jamais** « numéro caduc » ou « entreprise fermée » sur une absence de réponse. La garde reste fermée. |
| **E-mail transactionnel**                 | Envoi **arrêté** et signalé dans la console (f) ; le code de signature n'est pas considéré comme parti.                                                                            |
| **Calendly**                              | L'échange se planifie à la main depuis la console ; l'issue s'écrit au même endroit (`rendez_vous_suivis`).                                                                        |
| **Zoho**                                  | Aucun traitement du parcours n'en dépend pour avancer ; l'écriture comptable attend et se rejoue sans doublon.                                                                     |
| **Tiime**                                 | Les autofactures restent émises et conservées ; leur transmission attend et se rejoue sans doublon.                                                                                |
| **Antivirus**                             | **Dépôt refusé**, avec un message clair invitant à réessayer plus tard. Aucun fichier non analysé n'est accepté.                                                                   |

## Alternatives écartées

- **Une lettre de mission complète à chaque mission** (reprenant toutes les clauses).
  Écartée : les clauses durables vivent dans le contrat-cadre ; les répéter à chaque
  mission multiplie les versions à tenir à jour et les risques de contradiction. La
  lettre d'une page ne porte que ce qui varie (objet, dates, lieu, journées,
  rémunération de la mission) et renvoie au contrat-cadre.
- **Copier le code du parcours apporteur** pour le décliner aux formateurs. Écartée :
  deux copies divergent dès la première correction. Les briques communes (dossier à
  jeton, contrôle registre, signature avec code par e-mail, contresignature, moteur de
  campagnes, autofacture) sont **extraites et partagées** ; seul ce qui est propre aux
  formateurs (garde de mission, lettre de mission, émargements) est écrit à part.
- **Deux contrats distincts, l'un pour les indépendants, l'autre pour les organismes.**
  Écartée : deux textes à tenir alignés pour des obligations identiques. Un contrat-cadre
  unique avec des clauses variables.
- **Statuts `JobApplicationStatus` pour suivre un indépendant.** Écartée : deux sources
  de vérité pour la même avancée ; l'issue de l'échange suffit.

## Conséquences

**Positives**

- Un seul chemin, tracé, de la candidature au virement ; chaque étape a une preuve.
- La vigilance du donneur d'ordre (registre, déclaration d'activité, URSSAF) est
  vérifiée **avant** l'affectation, à toutes les portes, et non découverte après.
- Le délai de paiement est le même partout et conforme au Code de commerce.
- Les briques partagées avec les apporteurs réduisent le code à maintenir.

**Négatives**

- La garde fermée bloquera des affectations quand un registre public est lent ou
  indisponible : c'est voulu, mais cela demande un geste manuel (« à contrôler »).
- L'extraction des briques communes touche le parcours apporteur : chaque extraction
  doit garder ses tests verts.
- La période de bascule fait coexister deux modes de paiement ; la table de
  revendication en garantit l'exclusivité, mais la console doit afficher clairement le
  mode de chaque session.

**Atténuations**

- Verdict orange explicite et action « relancer le contrôle » dans la console.
- Banc d'essai dédié et non-régressions sur le parcours apporteur avant chaque extraction.

## Suivi

- ADR 0067 : une fiche formateur par relation (unicité de l'e-mail limitée aux fiches
  ouvertes).
- Lots suivants du chantier : banc d'essai, garde de mission, contrat-cadre v3, lettre
  de mission, paiement par mission et table de revendication, campagnes.
