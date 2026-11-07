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
   (`HORODATAGE_TSA_URL`, défaut Certum, Pologne). La signature ne dépend jamais de l'autorité : la ligne
   `document_signature_horodatages` naît « en attente » dans la transaction de signature, un premier jeton est
   tenté aussitôt, le balayage du worker (5 min, backoff plafonné à 6 h, **sans plafond d'essais**) reprend le
   reste. La contresignature d'Axion-IA est horodatée aussi.

Le **contrat n'est formé qu'à la contresignature** d'Axion-IA (CGV, section « Signature électronique du devis »).

## Ce que cette signature n'est pas

Une signature électronique **simple** (eIDAS) : ni avancée, ni qualifiée. Elle ne prétend pas à la force
probante d'une signature qualifiée ; elle repose sur un faisceau (adresse prouvée par le code, déclaration,
empreintes, horodatage) et sur la clause de preuve des CGV. Le jeton est conservé tel que reçu : la signature de
l'autorité se vérifie hors ligne (`openssl ts -verify`). Le code ne valide **pas** cette signature à la
réception : il vérifie l'empreinte, le nonce, le statut et l'instant, pas la chaîne de certificats.

## Conséquences

- Migration **additive** (colonnes nullables, une table neuve et vide) ; jouée par l'entrypoint de l'**app**.
  Le worker est reconstruit ~50 minutes avant : son balayage d'horodatage reste muet tant que la table
  n'existe pas (P2021/P2022). Un devis à formules signé avant la migration échoue en fermé (colonne absente).
- Nouveau gabarit d'e-mail transactionnel `devis-code-signature` (famille A), hors corbeille de validation :
  un code de 10 minutes expirerait en attendant une relecture.
- Une autorité d'horodatage figure sur `/sous-processeurs` (empreinte seule, `dpaStatus: not_required`).
- Hors périmètre, à faire ensuite : affichage du jeton et de la déclaration dans l'exemplaire signé et le
  registre, vérification offline de la signature CMS du jeton, export de la preuve.
