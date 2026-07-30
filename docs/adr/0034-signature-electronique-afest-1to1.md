# ADR 0034 — Signature électronique réelle AFEST 1-to-1 (table dédiée, régime par parcours)

- **Statut** : Accepté
- **Date** : 2026-07-24
- **Auteur** : Will + Claude (Opus 5), d'après `_PLANS/PLAN-SIGNATURE-AFEST-1TO1-2026-07-24.md`
- **Référence** : chantier T13 émargement collectif (migration `20260721120000_qualiopi_emargement_signe`), art. 1366/1367 C. civ., R.6313-3 et D.6313-3-1 C. trav., CAA Nantes 20/04/2021 et 19NT01974.
- **Supersède** : le mécanisme de « signature » AFEST par booléens (`CompteRenduSeance.beneficiaireSigneAt` / `formateurSigneAt` / `tuteurSigneAt` / `presenceSigneeAt`).

## Contexte

L'émargement AFEST 1-to-1 était un **faux positif de preuve**. `signerSeance1to1Action` posait
quatre booléens horodatés sur simple clic administrateur — sans acte signataire, sans image, sans
empreinte, sans chaînage — et le PDF les rendait « signé ». Une signature électronique dont aucun
signataire n'est identifié ne satisfait pas l'art. 1366 C. civ. : elle ne prouve rien.

Le chemin **collectif** dispose depuis T13 d'une signature réelle (image rasterisée, SHA-256 de
l'image, chaînage `prevHash → selfHash`, tuple canonique versionné, index anti-fork). Le 1-to-1
n'en avait aucun.

Le PDF a été rendu **honnête** en attendant (PR #391 : « présences déclarées par l'organisme »,
avertissement explicite, colonnes « signé » retirées). Le présent ADR construit la fondation
manquante.

## Décision

### 1. Table DÉDIÉE `coaching_seance_signatures`, pas une extension d'`emargement_signatures`

Trois motifs :

1. **Guardrail « aucun DROP ».** Étendre `emargement_signatures` imposerait de DROP/recréer l'index
   `emargement_signature_coaching_active` **et** le CHECK `ck_emargement_signature_contexte`, tous
   deux partagés avec le chemin collectif vivant en production. La migration livrée est **100 %
   additive**.
2. **Mismatch de grain.** Collectif = 1 signataire / créneau. AFEST = 3 rôles × N séances, avec une
   chaîne par rôle et un signataire externe (le tuteur). Précédent maison exact : la contresignature
   formateur a reçu sa propre table pour ce motif.
3. **Zéro duplication de vérification.** `verifierChaine` (`hash.ts`) est générique sur
   `MaillonChaine` : la table dédiée le réutilise **tel quel**. Seule la sérialisation du tuple est
   isolée par contexte (`HASH_VERSION_SEANCE`, `MENTION_VERSION_AFEST`, `seance-reconstruction.ts`).

Le cœur collectif (`versCanonicalV1`, `HASH_VERSION_COURANTE`, `MENTION_VERSION`, `LigneSignature`,
`COLONNES_SCELLEES`) reste **strictement intact** — un test de non-régression échoue si quelqu'un le
mute pour les besoins de l'AFEST.

**Vestiges assumés, non supprimés** : l'enum `EmargementContexte.afest_1to1`, la FK
`emargement_signatures.coaching_id`, l'index `emargement_signature_coaching_active`. Aucune ligne
AFEST réelle n'y existe.

### 2. Anti-réattribution de chaîne par FK COMPOSITE

La table porte `compte_rendu_seance_id` (le grain) **et** `coaching_id` (la portée de chaîne,
dénormalisée). Sans garantie DB que les deux concordent, un `coaching_id` erroné placerait la chaîne
d'un parcours sur un autre : aucun `selfHash` ne bouge et `verifierChaine` déclarerait les **deux**
chaînes valides. On crée donc une clé candidate `coaching_comptes_rendus (id, coaching_session_id)`
et une FK composite `css_cr_coaching_coherent_fkey`.

**Conséquence assumée du `ON DELETE RESTRICT`** : `coaching_sessions → coaching_comptes_rendus` est
en `CASCADE`. Un parcours portant au moins une signature devient donc **non supprimable** — la
cascade bute sur le RESTRICT. C'est voulu (« une preuve légale ne disparaît jamais en cascade »),
c'est un écart explicite vis-à-vis des tables voisines, et la suppression d'un parcours suppose
désormais de révoquer puis d'archiver.

### 3. Régime de preuve PAR PARCOURS, jamais par flag global

`afest_perimetre_certifie` est un SiteSetting **global**. Le basculer appliquerait le filtre
« heures réellement signées » à **tous** les parcours, y compris ceux déjà attestés et déjà facturés
à un OPCO : une attestation « complète » rétrogradée en « aucune » après coup est un incident.
D'où `coaching_sessions.regime_preuve` (`legacy_boolean` par défaut).

**À l'issue du déploiement, le comportement de production est inchangé sur l'intégralité de
l'existant.** Le passage en `signature_reelle` est une décision explicite, parcours par parcours,
et suppose une validation chiffrée de l'impact OPCO / France Travail (STOP & ASK).

### 4. Chaîne scopée (parcours × rôle), triée sur `createdAt`

`prevHash` scelle le `selfHash` de la signature précédente **du même rôle sur le même parcours** :
trois chaînes indépendantes, qui ne se sérialisent pas les unes derrière les autres. L'index
`coaching_seance_signature_chaine_lineaire` est `NULLS NOT DISTINCT` (PG ≥ 15) — sans quoi deux
« premières » signatures (`prev_hash IS NULL`) d'un même couple forkeraient silencieusement.

Le tri est **`createdAt`, jamais `signeAt`** : ce dernier est figé avant l'écriture de l'image sur R2
(sharp + réseau, 100–500 ms), deux signatures peuvent donc commiter dans l'ordre inverse de leurs
`signeAt`, et un lecteur triant dessus conclurait « chaîne corrompue » à tort, définitivement.

**Révocation d'un maillon interne INTERDITE** (refus typé `revocation_maillon_interne_interdite`) :
la filtrer par `WHERE revoked_at IS NULL` laisserait son successeur pointer dans le vide, et
`verifierChaine` rendrait un faux `rupture_chainage`. Corriger une séance ancienne = révoquer en
cascade depuis la queue, puis re-signer dans l'ordre.

### 5. Garde temporelle PAR SÉANCE

Le collectif interdit la signature à l'avance / à la chaîne (`creneaux-signables.ts`). L'AFEST n'avait
aucun équivalent : sa seule borne était l'expiration du jeton (fin de session + 48 h) — or un
parcours dure 6, 12 ou 24 mois. Sans garde, **douze séances étaient back-signables d'un coup en fin
de parcours**, avec de vraies images et de vraies empreintes, à des dates de séance vieilles de
plusieurs mois. Afficher l'écart `signeAt ↔ seanceDate` sur le PDF ne guérit pas le vice.

`seances-signables.ts` n'autorise donc que les séances **commencées**, dans une fenêtre de
rattrapage **par séance** (séance + 48 h), et la garde vit dans le **service** — donc pour les trois
porteurs, pas seulement dans l'UI.

### 6. Trois signataires, deux canaux, plafond probant écrit

- **Bénéficiaire** : méthode A (poste du formateur) dominante, canal B optionnel.
- **Formateur** : méthode A, authentifié espace-formateur, aucun jeton.
- **Tuteur** : **hybride** — A par défaut (signe en séance, `recueilliParTrainerId` = le formateur),
  B en repli pour la mise en situation asynchrone.

**Plafond probant assumé** : en méthode A, les trois lignes portent le même
`recueilliParTrainerId`. La chaîne prouve l'**intégrité**, pas l'**indépendance**. On revendique donc
« émargement à 3 rôles, recueil attesté par l'OF », **jamais** « 3 signataires indépendants ». La
distinction **signature-présence** (bénéficiaire, formateur) vs **co-attestation-réalité** (tuteur,
tiers) est à porter dans toute communication commerciale et tout dossier de contrôle.

**Canal B : binding e-mail réellement implémenté.** `verifyMagicToken` ne lie pas le porteur à un
destinataire (il ne contrôle que `scope` + `resourceId`, et se contente d'un « @ » dans l'e-mail du
payload) : un lien transféré signait au nom du destinataire initial. On stocke désormais
`destinataire_email_sha256` à l'émission et on le compare au moment de signer.

### 7. Harmonisation des quatre surfaces de calcul d'heures

Introduire de vraies signatures sans toucher au calcul déplacerait simplement le faux positif des
booléens vers `dureeMinutes` non filtré. Les **quatre** consommateurs passent donc par la même
fonction `heuresReellesSignees(comptesRendus, regime)`, avec des critères identiques :

1. `coaching-afest/heures.ts` (attestation) ;
2. `coaching-afest/facturation-1to1.ts` (facture) ;
3. `qualiopi/bpf/service.ts` → `aggregateCoaching` (BPF) ;
4. `coaching-afest/kits-1to1.ts` (certificat R.6313-3 + kits OPCO/CPF/France Travail).

En régime `signature_reelle`, la **ligne de signature EST la source de présence** —
`beneficiairePresent` redevient un pur cache d'affichage et n'est jamais un co-critère (sinon un
cache tardif ou échoué zéro-erait des heures réellement signées). En `legacy_boolean`, comportement
historique strictement préservé.

`dureeReelleHeures` a désormais un **écrivain unique** : le chemin de clôture. La transaction de
signature ne l'écrit pas.

### 8. Bascule action / gate — livrée d'un seul tenant

Ajouter un vrai système de signature sans **retirer** le mensonge n'aurait rien corrigé. Les deux
moitiés partent donc dans le même changement :

- **L'action admin ne signe plus.** `signerSeance1to1Action` posait `beneficiaireSigneAt`,
  `formateurSigneAt` et `tuteurSigneAt` au clic d'un administrateur — quatre horodatages de
  signature sans signataire, sans image, sans empreinte. Elle devient
  `acterPresenceSeance1to1Action` et n'écrit plus que la présence **déclarée par l'organisme**
  (`beneficiairePresent`, `presenceSigneeAt`), dont `legacy_boolean` dépend pour exclure les
  absences actées. Le renommage fait partie du correctif : le nom affirmait ce que le code
  prétendait faire. Sous `signature_reelle`, l'action **refuse** — ces colonnes n'y sont plus qu'un
  cache dérivé, écrit par la seule transaction de signature.
- **Le gate lit une preuve.** `checkAfestEnforcement` autorisait l'émission d'une attestation sur la
  foi de la colonne que l'action venait de poser. Il passe par `presenceProuvee(seance, regime)` :
  ligne `CoachingSeanceSignature` `role='beneficiaire'` non révoquée en `signature_reelle`, critère
  historique inchangé en `legacy_boolean`.

Séparés, ces deux gestes donnent soit un gate qui lit une colonne que plus personne n'écrit, soit
une attestation adossée à un booléen que personne n'a signé. Un test de propriété sur la source
(`presence-gate.spec.ts`) échoue si l'un des deux est rétabli seul — les tests de comportement ne
voient pas cette classe de défaut, chaque moitié se comportant parfaitement isolément.

**Neutralisation appliquée à TOUS les critères du gate**, pas seulement à la présence : le critère
d'alternance est un `some()`, si bien qu'une séance annulée dont le compte-rendu avait été rempli
avant l'annulation suffisait à attester l'alternance d'un parcours où elle n'avait jamais eu lieu.

## Conséquences

**Positives** — l'émargement AFEST devient opposable ; les quatre surfaces cessent de diverger ; une
absence légitime ne bloque plus l'attestation à vie (`CoachingSeanceStatut`) ; la back-signature de
fin de parcours devient impossible ; le lien tuteur ne se transfère plus.

**Négatives / à surveiller** :

- un parcours porteur de preuve n'est plus supprimable (§ 2) ;
- l'activation du régime `signature_reelle` peut **baisser** des montants OPCO/France Travail et
  **rétrograder** des attestations : gate STOP & ASK explicite, plus refus de dégrader une
  attestation déjà remise sans validation humaine ;
- les parcours legacy restent sous `legacy_boolean`, avec leurs artefacts de booléens : un volet de
  remédiation (inventaire, décision sur les documents factices déjà émis, re-collecte avant clôture
  pour les parcours en cours) reste ouvert et relève d'une décision produit + juriste.

## Reste ouvert (bloque l'ACTIVATION, pas le code)

1. Grain de la signature tuteur : par séance ou 1×/parcours (aucun texte cité n'impose le par-séance ;
   le rôle `tuteur` est optionnel dans le schéma, qui supporte les deux sans changement).
2. Valeur probante du canal B : possession d'e-mail ≠ identité juridique, même avec le binding réel.
3. Impact chiffré du filtre « heures signées » avant toute bascule.
4. Note écrite **validité (art. 1366) vs présomption (art. 1367)** : le qualifié eIDAS n'est pas visé.
