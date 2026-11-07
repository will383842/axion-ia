# ADR 0073 — Signature électronique « simple renforcée » gratuite du devis à formules

- **Statut** : **ACCEPTÉ** (décisions de Will, 2026-11-07)
- **Date** : 2026-11-07
- **Auteur** : Will + Claude
- **Lot** : 4 bis du chantier « devis à formules »
- **Prolonge** : le lot 4 (sceau V4, contresignature, CGV 6.2), ADR 0034 (signature électronique 1-to-1), ADR 0066 (code à usage unique du contrat-cadre)
- **Référence** : `src/server/qualiopi/devis/signature-renforcee.ts`, `code-signature-devis.ts`, `documents/signature/horodatage-*.ts`, migration `20261107120000_devis_signature_renforcee`

## Décision

Tous les devis à formules se signent par le canal maison, **sans prestataire payant ni SMS**, avec un palier
« simple renforcé » :

1. **Code à usage unique** (6 chiffres) envoyé par e-mail à l'adresse **figée sur le lien**, uniquement sur le
   clic « Recevoir mon code ». Valable **10 minutes**, usage unique, **5 essais**, puis **blocage de 15 minutes**
   de la pièce ; stocké haché (HMAC), comparé à temps constant ; au plus 1 envoi par minute et **5 par heure et
   par lien**. Il traverse la file d'e-mails scellé (jamais en clair dans Redis ni Sentry).
2. **Déclaration** saisie à l'écran : nom, fonction, case « Je déclare avoir le pouvoir d'engager la société ».
   Jamais préremplies. Revalidées par le serveur ; l'instant de la déclaration est celui du serveur.
3. **Sceau V4 étendu — sans V5.** Les quatre éléments (nom, fonction, instant du pouvoir, instant du code
   accepté) entrent dans la forme canonique **seulement quand ils sont présents** : une V4 antérieure garde
   exactement son empreinte. Le texte exact accepté est scellé : empreinte du PDF du devis (`document_hash`),
   du choix (qui contient l'empreinte de l'offre) et du texte des CGV (`cgv_texte_sha256`).
4. **Horodatage RFC 3161** du sceau (`selfHash`) par une autorité gratuite configurable
   (`HORODATAGE_TSA_URL`, **HTTPS obligatoire en production, aucune autorité par défaut** : horodatage coupé
   tant qu'elle n'est pas choisie). Un jeton n'est « obtenu » que si sa **signature CMS et sa chaîne de
   certificats** se vérifient (`horodatage-cms.ts`, `node:crypto` seul ; racines de Node +
   `HORODATAGE_TSA_CA_PEM`). **Limite : pas de contrôle de révocation (CRL/OCSP)**, ni de lien
   `signingCertificateV2` ; audit hors ligne possible sur le jeton brut conservé. La signature ne dépend jamais de l'autorité : la ligne
   `document_signature_horodatages` naît « en attente » dans la transaction de signature, un premier jeton est
   tenté aussitôt, le balayage du worker (5 min, backoff plafonné à 6 h, **sans plafond d'essais**) reprend le
   reste. La contresignature d'Axion-IA est horodatée aussi.

Le **contrat n'est formé qu'à la contresignature** d'Axion-IA (CGV, section « Signature électronique du devis »).

## Ce que cette signature n'est pas

Une signature électronique **simple** (eIDAS) : ni avancée, ni qualifiée. Elle ne prétend pas à la force
probante d'une signature qualifiée ; elle repose sur un faisceau (adresse prouvée par le code, déclaration,
empreintes, horodatage) et sur la clause de preuve des CGV. Le jeton est conservé tel que reçu, et il
n'est « obtenu » qu'après vérification (`node:crypto` seul) : signature CMS de l'autorité, usage étendu
`timeStamping` du certificat signataire, chaîne jusqu'à une ancre de `HORODATAGE_TSA_CA_PEM`, chaque certificat
valide à l'instant attesté ; la réponse est lue en flux avec un plafond de 64 Ko. Non contrôlé : la
révocation (CRL/OCSP) — à l'audit, hors ligne (`openssl ts -verify`).

## Conséquences

- Migration **additive** (colonnes nullables, une table neuve et vide) ; jouée par l'entrypoint de l'**app**.
  Le worker est reconstruit ~50 minutes avant : son balayage d'horodatage reste muet tant que la table
  n'existe pas (P2021/P2022). Un devis à formules signé avant la migration échoue en fermé (colonne absente).
- Nouveau gabarit d'e-mail transactionnel `devis-code-signature` (famille A), hors corbeille de validation :
  un code de 10 minutes expirerait en attendant une relecture.
- Une autorité d'horodatage figure sur `/sous-processeurs` (empreinte seule, `dpaStatus: not_required`).
- Hors périmètre, à faire ensuite : affichage du jeton et de la déclaration dans l'exemplaire signé et le
  registre, vérification offline de la signature CMS du jeton, export de la preuve.

## Addendum — suivis de l'audit argent/données (2026-11-07)

- **Texte des CGV** : la section « Signature électronique du devis » décrit désormais le **devis à formules** (seul
  à recevoir code, nom, fonction, déclaration de pouvoir et horodatage — `piece-signature.ts`, `choixOffre`).
- **RGPD — effacement et export** : `declarationNom` et `declarationFonction` rejoignent `signataireEmail`
  dans l'exception « colonne scellée » de `rgpd-erase.ts` (elles entrent dans l'empreinte du sceau V4 : les
  effacer casserait la preuve). L'export RGPD de la personne ne couvre pas les signataires de devis (aucun
  export de cette population n'existe) : c'est écrit au registre (`_AUDIT/DPA-REGISTER.md` §7septies).
- **Conservation de `document_signature_codes`** (code haché + `jeton_id`) : pas de suppression logique
  possible sans casser la preuve du code vérifié ; la durée est celle de la preuve de signature.
- **Nom et fonction** : bornes comptées en points de code Unicode (`Array.from`), comme `length()` SQL ;
  dépassement = refus propre, jamais une erreur 500.
- **Code à usage unique** : si `signerDocument` refuse (refus typé : devis expiré, pièce déjà signée, lien révoqué
  entre-temps…) APRÈS la vérification du code, le code est **restitué** (`restituerCodeSignature`) tant qu'il n'est pas
  expiré ni invalidé : le signataire déjà vérifié n'a pas à redemander un code. **Non restitué, par prudence** : une
  panne de stockage ou une erreur inattendue (on ne sait pas si la signature a été écrite) — le signataire en
  redemande un.

## Addendum — audit sécurité (2026-11-07)

- **Blocage non contournable** : le plafond de 5 essais est par code ; un compteur d'échecs **cumulé par
  (pièce, partie)** (`document_signature_echecs`) bloque 15 min au 10e échec sur 24 h, **tous codes confondus**.
  Émettre un code ne le remet pas à zéro ; seules une signature réussie ou l'écoulement des 24 h le font.
  Il bloque aussi l'émission de codes et le départ d'un e-mail déjà en file.
- **Code lié au lien** : un code émis pour le lien A ne signe pas via le lien B (`jetonId`).
- **Réponse de l'autorité lue en flux**, plafonnée à 64 Kio.
