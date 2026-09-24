# ADR 0051 — Apporteurs d'affaires : où s'arrête la console, où commence Axion Partners

- **Statut** : **ACCEPTÉ** — décision B1 de Will, 2026-09-19 (« fais tout selon tes recommandations »)
- **Date** : 2026-09-19
- **Auteur** : Claude, unité P2 du plan « tunnel apporteurs » du 2026-09-19
- **Référence** : `src/features/commercial-application/`, `src/lib/commercial-application/est-apporteur.ts`, `src/server/crm-sync/reconcile.ts`, ADR 0047, `axion-apporteurs/docs/DECISIONS.md` (HYP-E1-7), `axion-apporteurs/docs/REQUIREMENTS.md`

## Pourquoi cet ADR existe

Trois systèmes voient un candidat apporteur, et aucun document ne disait lequel fait foi
à quel moment :

- la **console** du site, où arrivent le premier contact, le dossier et l'échange ;
- le **CRM Pro**, qui recevait le dossier complet jusqu'au 2026-09-19, alors que la règle
  du 2026-09-04 est que rien n'y part sans la validation de Will ;
- **Axion Partners** (`axion-apporteurs`), l'application qui portera l'apporteur sous
  contrat, et qui n'a aucune production aujourd'hui (ni application, ni DNS).

La décision B2 du même jour coupe l'envoi au CRM. Il reste à écrire ce qui le remplace.
C'est l'objet de cet ADR. Il s'aligne sur HYP-E1-7 côté Partners (le tunnel reste dans
axionia en V1) ; Partners s'y aligne par sa propre gouvernance, et rien n'est écrit dans
son dépôt depuis celui-ci.

## La décision

> **La console porte le candidat apporteur jusqu'à l'échange. Axion Partners le porte à
> partir du contrat. Le CRM Pro ne le voit pas.**

### a) Qui fait foi, et jusqu'où

La console fait foi de « Nouveau contact » jusqu'à **« Échange fait »** ou **« Sans
suite »**. Axion Partners fait foi à partir du **contrat** : signature, vérifications
d'identité, commissions, espace apporteur. Rien de ce qui suit le contrat n'est construit
dans la console.

### b) Les tâches Partners EXT-T03, EXT-T04 et EXT-T05 sont assurées par la console en V1

| Tâche Partners | Intitulé                                                          | En V1, dans la console                                  |
| -------------- | ----------------------------------------------------------------- | ------------------------------------------------------- |
| EXT-T03        | Candidatures multi-canal : origine, canal, campagne, anti-doublon | origine et provenance portées par la `Submission`       |
| EXT-T04        | Saisie manuelle en console + pièce jointe CV                      | saisie manuelle **unitaire** (`saisie-manuelle.ts`)     |
| EXT-T05        | Import CSV de jobboard                                            | **pas d'import** : saisie unitaire, une ligne à la fois |

Les seuils qui rouvriraient la question, mesurés et non supposés (mesure R1) :

- **import** seulement si le volume entrant dépasse **10 candidatures par mois** — au
  19/09, août comptait 4 dossiers et septembre 3 dossiers et 5 écrans 1 ;
- **table dédiée** (au lieu de `Submission` + `details` JSON) seulement au-delà
  d'environ **500 lignes** apporteurs.

En deçà, un import ou une table coûtent plus qu'ils ne rapportent, et chacun ajoute un
chemin d'écriture de données personnelles à garder.

### c) L'envoi vers Partners part au clic « prêt à signer »

Jamais à la réception d'un dossier. Un candidat que personne n'a encore eu au téléphone
n'a rien à faire dans l'outil du contrat : l'envoyer à la réception reconstruirait, vers
Partners, exactement le défaut que B2 vient de corriger vers le CRM.

### d) L'adresse du candidat voyage par exception nommée ou par lecture authentifiée

Jamais par le SIREN : le SIREN désigne une entreprise, pas une personne, et ne peut pas
servir de clé pour transmettre les coordonnées d'un candidat. L'adresse passe soit dans
un envoi explicitement nommé (l'exception « prêt à signer » du point c), soit par une
lecture authentifiée côté Partners.

### e) La note est facultative

La note libre qui accompagne un candidat est facultative : son absence ne bloque ni
l'envoi ni aucune étape, et aucun classement n'est construit à partir d'elle.

### f) « Sans suite », pas « retenu / refusé »

La seule décision humaine côté console est « Sans suite ». Elle est écrite au journal et
annule les relances. On ne « refuse » pas un apporteur : il n'y a ni poste, ni
subordination, et le vocabulaire d'un recrutement salarié serait lui-même un indice de
requalification.

### g) L'échange de 15 min remplace le webinaire

Sur invitation manuelle seulement, par un événement Calendly dont le nom contient
« apporteur ». Le webinaire collectif n'est plus l'étape suivante du dossier.

### h) L'opposition suit la personne

Une opposition posée sur une ligne vaut pour **toutes** les lignes de la même personne
(même `contactEmailHash`) : premier contact, écran 1, dossier complet, saisie manuelle.
Elle l'accompagne aussi si la personne est un jour transmise à Partners.

### i) `details.candidatureRef` à la racine de `details`

La clé qui désigne la ligne de référence d'une personne vit à la **racine** de
`Submission.details`, **pas** sous `details.candidature` — ce bloc-là est la forme du
dossier, que Partners reprendra à son compte. Elle prépare la bascule sans rien fusionner
en base : la vue « une ligne par personne » est un regroupement à la lecture.

### j) Le module Partners « Support & messagerie » n'est pas reconstruit dans la console

`axion-apporteurs/docs/REQUIREMENTS.md:51` (module 20, 3 exigences) reste chez Partners.
La console envoie par ZeptoMail ; les réponses arrivent dans la boîte `contact@`, que la
console ne lit pas. **L'option D** — une adresse de réponse dédiée, lue par la console —
n'est envisagée qu'au-delà d'environ **10 réponses par jour**.

### k) Pas d'étape « Transmis pour contrat » avant la mise en production de Partners

Une étape qui dirait « transmis » vers une application qui n'existe pas mentirait à chaque
lecture de la fiche. Elle sera ajoutée le jour où Partners reçoit réellement quelque chose.

### l) Le `/contact` de type « recrutement » n'est PAS un dossier apporteur

Le formulaire de contact garde un type « recrutement » (`unified-contact/actions.ts`,
appel à `syncFormSubmissionToCrm`). Ce message produit une `Submission` avec
`details.unifiedType: "recrutement"` mais **sans** `subType: "candidature-commerciale"`.
Il est classé dans l'univers vivier par `crm-sync/enqueue.ts` (`universeOf`) et **reste
soumis aux drapeaux du vivier CRM** (ADR 0047). Décision consignée : il n'est pas concerné
par B2, et le prédicat `estApporteur` l'exclut explicitement — le rapprochement quotidien
continue donc de le réclamer s'il n'a pas été émis.

> **Mise à jour (2026-09-24, ADR 0047 § 4 ter).** Ce message ne part plus au CRM :
> `syncFormSubmissionToCrm` écarte le type « recrutement » au point d'entrée, et le
> rapprochement quotidien ne le réclame plus. Il reste distinct d'un dossier
> apporteur (`estApporteur` inchangé) ; seule son émission a changé.

## Ce qui porte la décision dans le code

- **Aucun import de `@/server/crm-sync`** dans `src/features/commercial-application/` ni
  dans `src/components/forms/commercial-application/` — gardé par
  `tests/unit/ci/le-dossier-apporteur-ne-part-pas-au-crm.spec.ts`.
- **Un seul critère « apporteur »** : `src/lib/commercial-application/est-apporteur.ts`
  (`estApporteur` en mémoire, `FILTRE_APPORTEUR_PRISMA` pour sélectionner). Jamais de
  `NOT` Prisma sur un chemin JSON pour exclure : un chemin absent rend NULL, et la ligne
  disparaît avec lui.
- **Le rapprochement CRM** (`crm-sync/reconcile.ts`, famille `submission`) écarte les
  dossiers apporteurs en mémoire : ils n'émettent plus rien, par décision, et ne sont donc
  plus des « manquants ».
- **Le consentement** : `memo-v3-2026-09-19`, l'étude de la candidature seule, enregistré
  dès l'écran 1 avec le texte affiché (`CONSENT_FORM_REFS.commercialApplication`).

## Ce que cette décision coûte

- **Les fiches déjà transmises au CRM y restent** tant que Will n'en a pas décidé
  (geste W4, hors de ce dépôt). Ce dépôt ne les touche pas, et aucune session ne les
  touche côté CRM. Le détail de ce qui reste à vérifier au moment de W4 est tenu hors
  du dépôt.
- **La console porte seule la charge jusqu'au contrat**, sans import. Si le volume dépasse
  les seuils du point b, c'est cet ADR qu'il faut rouvrir, pas un import qu'il faut
  ajouter en silence.

## Comment revenir sur cette décision

Rouvrir l'envoi au CRM exige une décision explicite de Will (ordre du 2026-09-04), puis
de retirer la garde statique **dans la même PR** que l'import — une garde qu'on
contourne sans la retirer n'est plus qu'un fichier vert.
