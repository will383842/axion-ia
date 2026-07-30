# ADR 0037 — Canal A : signature d'une pièce par lien public, et bascule du devis hors DocuSeal

- **Statut** : Accepté
- **Date** : 2026-07-30
- **Auteur** : Will + Claude (Opus 5), d'après `_PLANS/PLAN-SIGNATURE-ELECTRONIQUE-UNIFIE-2026-07-28.md` §III.3
- **Référence** : ADR 0014 (DocuSeal self-hosted vs Yousign), ADR 0034 (signature AFEST), migration `20260729100000_document_signature_socle`, art. 1366 et 1367 C. civ., art. L.6353-1 C. trav.
- **Ne supersède pas l'ADR 0014** : DocuSeal reste l'instance retenue pour les circuits qui exigeront un certificat opposable. Le présent ADR retire le **devis** de ce canal, et lui seul.

## Contexte

Le circuit de signature du devis présentait un défaut de fond : **le client lisait un document et
en signait un autre.**

|                      | Contenu                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------- |
| PDF joint à l'e-mail | Détaillé : lignes, désignations, quantités, prix unitaires, TVA par ligne, totaux, mentions |
| Signé dans DocuSeal  | **3 champs** : `devis_number`, `amount_ht`, `valid_until`                                   |

Un bon pour accord qui ne désigne pas son objet est juridiquement fragile. Le plan unifié avait
identifié le problème et tranché la correction (§III.3) : **template éphémère par pièce** —
`POST /api/templates/pdf` avec le PDF généré, champs placés par _text tags_, puis
`POST /api/submissions`. Il écartait explicitement la voie du template permanent dupliquant la mise
en page react-pdf, au motif de « deux sources de vérité qui divergeront » — ce que le circuit
faisait pourtant déjà, faute de mieux.

Le plan imposait une vérification préalable : « L'existence et le comportement exact de
`POST /api/templates/pdf` et des text tags **se vérifient contre le conteneur RÉEL (DocuSeal 2.5.3),
pas contre la documentation.** »

## Le constat (2026-07-29, vérifié trois fois)

**`POST /api/templates/pdf` n'existe pas sur l'instance de production.**

1. **`config/routes.rb` du conteneur** (`docuseal/docuseal:latest`, v2.5.3, fichier unique de
   220 lignes, aucun `draw` conditionnel) : le namespace `api` déclare
   `resources :templates, only: %i[update show index destroy]` — **aucune route de création**.
2. **Appel HTTP réel** : `POST /api/templates/pdf` → **404**, `POST /api/templates` → **404**,
   alors que `GET /api/templates/2` → **200** avec le même jeton. Ce n'est donc pas un défaut
   d'authentification.
3. **`PUT /api/templates/:id`** ne permet ni `schema` ni `documents` (`template_params` :
   `name`, `external_id`, `shared_link`, `submitters`, `fields`) : on ne peut pas davantage greffer
   un PDF sur un template existant.
4. **Repli web** `POST /templates_upload` → **422** (CSRF). `TemplatesUploadsController` hérite
   d'`ApplicationController`, donc session Devise ; `X-Auth-Token` n'est lu que par
   `Api::ApiBaseController`.

La documentation DocuSeal corrobore le motif : `/templates/pdf`, `/templates/docx` et
`/templates/html` sont badgés **Pro**. Ils sont absents de l'image open-source — pas désactivés par
un drapeau.

**La voie 1 du plan est donc fermée, et la voie 2 est interdite par le plan lui-même.**

## Décision

Le devis bascule sur le **canal A — maison, par lien public à jeton**. Trois options ont été
présentées et écartées : `manual_upload` (le repli prévu, mais entièrement manuel), l'ajout d'une
empreinte SHA-256 au bon pour accord DocuSeal (incorporation par référence, moins cher mais le
client ne voit toujours pas le détail au moment de signer), et l'abonnement DocuSeal Pro (coût
récurrent et dépendance payante pour un circuit à 4 devis).

### Ce que le canal A change

- La signature porte sur **le PDF RÉEL**, celui dont l'empreinte est scellée dans
  `document_signatures.document_hash_sha256`. Une seule source de vérité, donc aucune divergence
  possible entre ce qui est lu et ce qui est signé.
- La zone « Bon pour accord » du devis — qui existait déjà, vide, **en bas de page sous les
  totaux** — reçoit le tracé réel, l'horodatage et l'empreinte, via la `SignatureZone` déjà
  utilisée par la convention, le contrat et le protocole.
- L'écran de signature affiche le détail (lignes, quantités, PU, totaux) : le signataire a sous les
  yeux ce qu'il signe.

### Le point technique central : l'identité

Le socle exige que, sur le canal maison, l'identité du signataire soit **lue de la base, jamais de
l'entrée** — « sceller un nom fourni par l'appelant produirait une signature dont l'identité serait
exactement ce que l'appelant a bien voulu déclarer ».

Or le porteur d'un lien public n'est, par construction, pas authentifié : on ne peut pas résoudre
son identité au moment de signer.

➡️ **Elle est résolue à l'ÉMISSION**, depuis la fiche client, par une action d'administration
authentifiée, et **figée** dans `document_signature_tokens`. Au moment de signer, le service la
relit dans cette ligne — donc en base. La doctrine est respectée ; c'est le _moment_ de la
résolution qui se déplace, et ce déplacement est explicite plutôt que subi.

⚠️ Conséquence assumée : corriger la fiche client après émission ne change pas le lien déjà envoyé.
Pour corriger, on révoque et on réémet. C'est la même exigence de snapshot que partout ailleurs.

### Gardes d'autorisation

| Garde                                                    | Ce qu'elle empêche                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------------------ |
| Le jeton vise CETTE pièce                                | Rejouer sur un autre devis un lien légitime                              |
| Le jeton vise CETTE partie                               | Écrire une ligne au titre demandé par l'appelant                         |
| `axionia` / `responsable_pedagogique` interdits au jeton | Qu'un lien public engage l'organisme, et fasse paraître la pièce conclue |
| Révocation et expiration revérifiées                     | Signer la version périmée d'un devis révisé                              |
| Un seul jeton vivant par (pièce, partie)                 | Qu'en révoquer un donne une fausse impression de sécurité                |

Toutes sont revérifiées **dans `signerDocument`**, pas seulement dans la couche action : le service
ne fait confiance à aucun appelant, celui-ci compris.

## Conséquences

### Positives

- Le document signé **est** la pièce numérotée. Le défaut de fond disparaît, il n'est pas atténué.
- Plus aucune dépendance tierce sur le circuit commercial vivant.
- La console **ne détient plus le lien personnel du client** : on ne stocke que le hash. Le
  composant `DevisSignatureLinkCopy` — supprimé — documentait lui-même le risque qu'il atténuait
  (« un admin qui l'ouvre peut signer à sa place, et l'audit trail enregistrerait l'IP d'Axion-IA
  sous la signature du client »). Le risque est désormais supprimé, pas encadré.
- Le canal A est **générique** : convention, tripartite, contrat particulier, protocole AFEST et
  sous-traitance le réutiliseront sans nouvelle infrastructure (chantier « phases 4-6 »).

### Négatives, assumées

- 🔴 **La preuve est produite par l'organisme, non attestée par un tiers indépendant.** En signature
  simple (SES), la présomption de fiabilité de l'art. 1367 C. civ. n'est de toute façon acquise
  qu'à la signature **qualifiée**, hors périmètre (ADR 0014). Ce qui protège est la qualité du
  faisceau — identification, horodatage, intégrité du document signé, traçabilité du consentement,
  chaînage — que la brique émargement sait déjà produire. La mention `MENTION_PLAFOND_CANAL_MAISON`
  le dit au signataire, noir sur blanc, plutôt que de le laisser croire.
- Le jour où un grand compte exigera un certificat opposable, le devis repassera `fournisseur` :
  c'est **une ligne** dans `parties-requises.ts`, et le socle porte déjà les deux canaux.
- Renvoyer l'e-mail d'un devis **réémet** le lien et invalide le précédent — conséquence directe de
  la règle « un seul jeton vivant ». Le message de retour le dit à l'admin.

### Ce qui n'est PAS touché

- `docusealSubmissionId` / `docusealEmbedUrl` restent en base : le devis signé par cette voie avant
  la bascule garde sa trace. Effacer l'historique d'un circuit qu'on remplace, c'est perdre la
  capacité de répondre plus tard à « comment cette pièce-là a-t-elle été signée ? ».
- `src/lib/docuseal.ts`, la route de webhook et les appels de `features/booking/` et
  `features/contract/` sont **inchangés** (code mort du tunnel Booking : `STRIPE_LIVE_MODE=false`,
  `bookings=0`).
- `MENTION_VERSION` et `versCanonicalV1`, partagées avec le flux collectif vivant : **intouchées**.

## Impact mesuré avant bascule

`devis=4`, dont `1` avec soumission DocuSeal ; `document_signatures=0` ; `clients=3`. Aucun
historique de signature à invalider. La fenêtre pour ce changement était maintenant ; elle ne le
serait plus dans six mois.
