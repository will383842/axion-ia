# ADR 0052 — La lettre d'Axion-IA et le futur outil MailWizz + PowerMTA : le contrat, sans rien envoyer

- **Statut** : **PROPOSÉ**. Il reste à valider par Will, puisque le dépôt est public.
- **Date** : 2026-09-25
- **Auteur** : Claude, lot L5 du plan « guide IA, lettre et contacts CRM » (v2, 24/09)
- **Référence** : ADR 0001 (§5), `src/lib/email/client.ts` (avertissement DMARC), `src/app/api/unsubscribe/route.ts`, `src/server/newsletter/exports.ts` (lot L3), `src/server/crm-sync/`, `prisma/schema.prisma` (`NewsletterSubscriber`, `ConsentEvent`, `EmailOpposition`, `CrmInboundEvent`), `docs/newsletter/gabarit-lettre-reference.html`, `docs/ops/dns-lettre-mailwizz.md`

> ⚠️ **Numérotation** : le numéro 0050 est porté par deux ADR (`0050-rattrapage-automatique-…` et `0050-tva-le-verrou-…`). On ne renumérote pas un ADR déjà cité. Celui-ci prend donc 0052, le premier numéro libre.

## Pourquoi cet ADR existe

Will a décidé, le 24/09, de n'utiliser **aucun outil tiers de campagne** (ni Zoho Campaigns, ni Brevo, ni un autre). Il construira plus tard son propre outil d'envoi sur **MailWizz + PowerMTA**. En attendant, le site et le CRM doivent être prêts à s'y brancher, **sans que rien d'envoi de masse soit construit maintenant**.

Trois sources disaient des choses différentes :

- l'**ADR 0001** et les runbooks décrivent PowerMTA et MailWizz **en service** sur le serveur du site. C'est faux depuis toujours : PowerMTA n'a jamais été déployé (`client.ts`, en-tête) ;
- `docs/ops/dns-records.md` et `.env.production.example` décrivent cette fiction comme une **configuration à appliquer**. Suivie à la lettre, elle couperait la réception de `contact@` et ferait refuser toutes les factures, puisque le domaine est en `p=reject` ;
- le code garde des **vestiges utiles** : `mailwizz_list_uid` et `mailwizz_sub_uid` sur l'abonné, ainsi que `MAILWIZZ_API_URL`, `MAILWIZZ_API_KEY`, `PMTA_API_URL` et `PMTA_API_KEY`, qui sont facultatives et inertes.

Cet ADR fixe ce qui est vrai et ce qui se branchera plus tard. Il marque aussi le reste comme périmé.

## La décision

> **Le site est seul maître du consentement à la lettre. MailWizz ne reçoit que la projection des éligibles, calculée par le site. Ses retours reviennent au site par une entrée unique, et le site les propage au CRM. D'ici là, aucune lettre ne part, ni par ZeptoMail, ni par un autre canal.**

### a) Qui fait foi

| Donnée                                                                       | Maître                                      | Règle                                                                                                       |
| ---------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Consentement, preuve (`consent_events`), jetons, désinscription, suppression | **Site**                                    | Seul porteur de la preuve. Les autres n'en gardent qu'un miroir                                             |
| Fiche contact, rattachement à une entreprise, historique, relances humaines  | **CRM Pro**                                 | Miroir du statut de la lettre, jamais la preuve. Garde en `identifiants_externes` les identifiants MailWizz |
| Membres de la liste MailWizz de la lettre                                    | **Personne : c'est une projection du site** | MailWizz ne décide jamais seul qui est inscrit                                                              |

La liste de la lettre est alimentée **par le site**, pas par le CRM. Si des campagnes de prospection B2B depuis les audiences du CRM voient un jour le jour, elles passeront par un **autre flux** : autre liste, autre pool d'IP, autre domaine d'envoi. La lettre, qui repose sur l'accord des personnes, ne doit pas porter la réputation d'un envoi à froid.

### b) Qui est éligible

Est **éligible** à la lettre un abonné qui remplit toutes ces conditions :

1. `status = confirmed` (jamais `pending`, `unsubscribed` ni `bounced`) ;
2. aucune `EmailOpposition` sur son empreinte ;
3. aucun rebond dur, ni sur l'abonné, ni dans `email_logs` ;
4. **moins de 3 rebonds mous** (`soft_bounce_count < 3`), le même seuil que `ListeSuppression::SEUIL_REBONDS_TEMPORAIRES` côté CRM ;
5. un jeton de désinscription présent (sans lui, la lettre ne pourrait porter aucun lien de désinscription).

Un **demandeur du guide qui n'est pas inscrit à la lettre** n'est **jamais** éligible. C'est le cas d'une adresse personnelle dont la case n'a pas été cochée (amendement du 24/09).

Le site **filtre avant d'exporter**. On ne verse jamais la liste d'opposition dans la liste noire de MailWizz : elle y serait en clair, alors que le site a choisi de ne la garder qu'en empreintes.

### c) Contrat d'import (site vers MailWizz)

Le fichier est celui du lot L3 (`/api/admin/newsletter/export`). Ses colonnes portent les **étiquettes des champs de la liste MailWizz** :

| Étiquette       | Source site                                    | Usage                                                         |
| --------------- | ---------------------------------------------- | ------------------------------------------------------------- |
| `EMAIL`         | `email`                                        | clé                                                           |
| `LOCALE`        | `locale`                                       | segment                                                       |
| `SOURCE`        | `source`                                       | segment (page du guide, encart d'article, etc.)               |
| `OPTIN_AT`      | date de confirmation                           | preuve, ancienneté                                            |
| `OPTIN_VERSION` | version du texte d'accord ou de la mention     | preuve                                                        |
| `UNSUB_URL`     | lien public `/api/unsubscribe?token=…` du site | lien de désinscription et en-tête `List-Unsubscribe` (voir e) |
| `GUIDE`         | a demandé le guide (oui / non)                 | segment                                                       |

Plus tard, l'import passera **de préférence par l'API** (`lists/{list_uid}/subscribers`) plutôt que par un CSV manuel. On récupérera ainsi le `subscriber_uid`, que le site écrira dans `mailwizz_sub_uid`. La **liste de suppression** du lot L3 (`/api/admin/newsletter/suppression`) ne contient aucune adresse, seulement une empreinte SHA-256 de l'adresse normalisée, un motif et une date. C'est la même empreinte que `email_suppressions.email_hash` côté CRM. Elle sert à vérifier qu'aucune adresse supprimée ne se trouve dans une liste MailWizz, **pas** à alimenter la liste noire de MailWizz.

Une personne qui devient inéligible est **retirée** de MailWizz par son `mailwizz_sub_uid`. Il n'y a pas de recherche par adresse.

### d) Contrat de retour (MailWizz vers site vers CRM)

Il y a **une seule entrée : le site** (par exemple `POST /api/mailwizz/webhook`). **Elle n'est pas construite** : on la construira avec l'outil, pas avant (voir g). Deux webhooks, l'un vers le site et l'autre vers le CRM, finiraient par diverger.

| Événement MailWizz          | Effet sur le site                                                             | Propagation vers le CRM                                               |
| --------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| désinscription              | même chemin que `/api/unsubscribe` : `unsubscribed`, `optout` au registre     | `newsletter_optout` (existant)                                        |
| plainte (boucle de retour)  | désinscription **et** `EmailOpposition` : une plainte est un refus plus large | opposition (existant)                                                 |
| rebond dur                  | `status = bounced`                                                            | `email_hard_bounced` vers `email_suppressions` `hard_bounce` (lot L4) |
| rebond mou                  | `soft_bounce_count + 1`, date. Exclu de l'export à 3                          | aucune                                                                |
| effacement RGPD (côté site) | suppression de l'abonné dans MailWizz par `mailwizz_sub_uid`                  | chemin d'effacement existant                                          |
| ouverture, clic             | **rien** (voir f)                                                             | aucune                                                                |

Les exigences reprennent les modèles déjà en place :

- **Authentification** : un secret partagé, comparé à temps constant. Sans secret configuré, l'entrée est inerte et répond 503.
- **Idempotence** : un journal des événements reçus, avec un identifiant unique, sur le modèle de `CrmInboundEvent`.
- **200 sur un corps sans événement reconnu**, pour que l'expéditeur ne rejoue pas indéfiniment.
- **Réconciliation périodique** en plus du webhook. Un webhook perdu, c'est une personne désinscrite qu'on réécrirait. On relit donc par l'API les désinscrits et les rebonds, et le site applique ce qui manque.
- On échange des **adresses** entre systèmes, **jamais des empreintes** : le site calcule un HMAC à clé (`person_key`), le CRM un SHA-256 nu. Chacun calcule la sienne.
- ⚠️ **À vérifier sur l'instance de Will** avant de construire : quels événements sa version de MailWizz sait réellement pousser. Les rebonds et les plaintes peuvent n'être disponibles que par l'API ou par le fichier comptable de PowerMTA.

### e) Le lien de désinscription d'une lettre

**Option retenue (A)** : le lien visible **et** l'en-tête `List-Unsubscribe` pointent vers l'**URL du site** (`UNSUB_URL`). Le désabonnement en un clic du site est déjà conforme à la RFC 8058 (POST, réponse 200). Le site reste maître **sans dépendre d'un webhook**. Condition : que MailWizz accepte un en-tête `List-Unsubscribe` personnalisé par étiquette. **À vérifier** sur la version installée. À défaut, on passe à l'option B : désinscription gérée par MailWizz, avec retour par webhook et réconciliation, traitée en moins de 2 jours comme Gmail l'exige.

### f) Réglages de MailWizz, avant le premier import

- Liste en **inscription simple** côté MailWizz : l'accord est déjà recueilli et prouvé par le site. Une confirmation MailWizz enverrait un second e-mail et ferait croire à la personne qu'elle n'est pas inscrite.
- **E-mails automatiques de MailWizz coupés** : bienvenue, confirmation, au revoir. Si l'un d'eux est réactivé, son texte se valide comme tout texte public.
- **Suivi d'ouverture coupé** (pas de pixel). Le **suivi des clics** est coupé aussi par défaut. Le rouvrir est une décision de Will, avec mise à jour de la politique de confidentialité.
- Expéditeur sur le **sous-domaine** de la lettre, avec `Reply-To` sur `contact@`.

### g) Ce qui est interdit tant que l'outil n'existe pas

- **Aucune lettre par ZeptoMail.** Son contrat l'interdit, et le même compte porte les factures et les convocations. La garde « aucune lettre par ZeptoMail » (liste fermée des gabarits `marketing: true`) reste en place.
- **Aucun connecteur, aucune file, aucun worker, aucune route MailWizz** construits d'avance. Un script présent et jamais appelé dérive sans que personne le voie. On écrit le contrat, pas le code.
- **Aucun enregistrement DNS appliqué.** La fiche `docs/ops/dns-lettre-mailwizz.md` est un plan, pas une configuration.

### h) Prérequis avant le premier envoi réel (liste de contrôle pour Will)

1. **Une infrastructure dédiée à la lettre d'Axion-IA** : IP, pool VirtualMTA, client MailWizz et serveur de livraison qui ne soient **partagés avec aucune autre activité**, et surtout pas avec de la prospection à froid. Idéalement un serveur dédié. L'IP doit être vérifiée absente des listes noires le jour J.
2. **L'entité qui exploite MailWizz et PowerMTA est nommée.** Si le serveur n'appartient pas à Axion-IA, son exploitant est un **sous-traitant** : contrat (art. 28), registre art. 30 et liste publique des sous-traitants à mettre à jour. L'exemption « auto-hébergé » de la garde des sous-traitants n'est vraie que sur un serveur d'Axion-IA.
3. **DNS dans l'ordre** de `client.ts` : sous-domaine, SPF du sous-domaine, DKIM publié et vérifié, puis un rapport `rua` qui montre `spf=pass` et `dkim=pass` **avant** le premier envoi. Jamais l'inverse : sous `p=reject`, la première lettre serait entièrement perdue, sans trace.
4. **Réglages f)** vérifiés sur l'instance.
5. **Entrée de retour d)** construite et testée (désinscription, plainte, rebonds, rejeu, secret absent).
6. **Premier envoi** : à l'adresse de Will seulement, et lu. Puis Will valide le texte de la première lettre, comme tout texte public.

### i) Ce qu'on garde, ce qu'on marque périmé

- **Gardés** : `mailwizz_list_uid` et `mailwizz_sub_uid`, les quatre variables d'environnement facultatives, l'avertissement DMARC de `client.ts`, mot pour mot. Le site n'aura jamais à parler à PowerMTA (c'est MailWizz qui l'utilise), mais retirer ses variables n'apporte rien.
- **Marqués périmés, sans être supprimés** : `docs/ops/dns-records.md` (enregistrements MX, SPF et DKIM de la racine), le bloc e-mail de `.env.production.example`, et les passages PowerMTA de `runbook-deploy.md`, `runbook-incident.md`, `runbook-monitoring.md`, de l'ADR 0001 (§5), de l'ADR 0019, de l'ADR 0031 et de R29.

## Conséquences

- Le jour où l'outil existe, le branchement tient en trois morceaux, tous décrits ici : l'import par l'API, l'entrée de retour et la réconciliation. Aucun ne touche au consentement.
- Tant qu'il n'existe pas, la lettre n'a **aucun canal d'envoi**. C'est voulu : les inscrits attendent, et rien ne part par un canal non prévu.
- Une personne peut apparaître trois fois (site, CRM, MailWizz). Le tableau a) dit laquelle fait foi, pour chaque donnée.

## Alternatives écartées

- **Alimenter MailWizz depuis le CRM** : le CRM ne porte pas la preuve du consentement. Ses audiences sont conçues pour la prospection B2B, pas pour une lettre fondée sur l'accord.
- **Pousser les opposants dans la liste noire de MailWizz** : cela recréerait un fichier d'adresses en clair que le site a choisi de ne pas tenir.
- **Construire le connecteur dès maintenant** : il n'aurait aucun consommateur, et son contrat reste à vérifier sur l'instance (d, e).
