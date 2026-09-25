# ADR 0052 — La lettre d'Axion-IA et le futur outil MailWizz + PowerMTA : le contrat, sans rien envoyer

- **Statut** : **PROPOSÉ**, à valider par Will avant fusion (le dépôt est public).
- **Date** : 2026-09-25
- **Auteur** : Claude, lot L5 du plan « guide IA, lettre et contacts CRM » (v2, 24/09)
- **Référence** : ADR 0001 (§5), `src/lib/email/client.ts` (avertissement DMARC), `src/app/api/unsubscribe/route.ts`, `src/app/api/internal/crm-webhook/route.ts` (modèle d'entrée signée), `src/server/newsletter/exports.ts` (lot L3), `src/server/crm-sync/`, `prisma/schema.prisma` (`NewsletterSubscriber`, dont les champs de rebond arrivent avec les lots L2 et L3, `ConsentEvent`, `EmailOpposition`, `CrmInboundEvent`), `docs/newsletter/gabarit-lettre-reference.html`, `docs/ops/dns-lettre-mailwizz.md`

> ⚠️ **Numérotation** : le numéro 0050 est porté par deux ADR (`0050-rattrapage-automatique-…` et `0050-tva-le-verrou-…`). On ne renumérote pas un ADR déjà cité. Celui-ci prend 0052, le premier numéro libre.

## Pourquoi cet ADR existe

Will a décidé, le 24/09, de n'utiliser **aucun outil tiers de campagne** (ni Zoho Campaigns, ni Brevo, ni aucun autre). Il construira plus tard son propre outil d'envoi sur **MailWizz + PowerMTA**. En attendant, le site et le CRM doivent être prêts à s'y brancher, **sans rien construire, pour l'instant, de l'envoi de masse**.

Trois sources disaient des choses différentes :

- l'**ADR 0001** et les runbooks décrivent PowerMTA et MailWizz **en service** sur le serveur du site. C'est faux depuis toujours : PowerMTA n'a jamais été déployé (`client.ts`, en-tête) ;
- `docs/ops/dns-records.md` et `.env.production.example` décrivent cette fiction comme une **configuration à appliquer**. Suivie à la lettre, elle couperait la réception de `contact@` et ferait refuser toutes les factures, puisque le domaine est en `p=reject` ;
- le code garde des **vestiges utiles** : `mailwizz_list_uid` et `mailwizz_sub_uid` sur l'abonné, ainsi que `MAILWIZZ_API_URL`, `MAILWIZZ_API_KEY`, `PMTA_API_URL` et `PMTA_API_KEY`, facultatives et inertes.

Cet ADR fixe ce qui est vrai et ce qui se branchera plus tard. Il marque aussi le reste comme périmé.

## La décision

> **Le site est seul maître de l'inscription à la lettre et de sa preuve, quelle qu'en soit la base : intérêt légitime pour une adresse professionnelle, consentement pour une adresse personnelle. MailWizz ne reçoit que la projection des éligibles, calculée par le site. Ses retours reviennent au site par une entrée unique, et ne peuvent que retirer, jamais inscrire. Le site les propage au CRM. D'ici là, aucune lettre ne part, ni par ZeptoMail, ni par un autre canal.**

### a) Qui fait foi

| Donnée                                                                                   | Maître                                      | Règle                                                                                                       |
| ---------------------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Inscription, base légale, preuve (`consent_events`), jetons, désinscription, suppression | **Site**                                    | Seul porteur de la preuve. Les autres n'en gardent qu'un miroir                                             |
| Fiche contact, rattachement à une entreprise, historique, relances humaines              | **CRM Pro**                                 | Miroir du statut de la lettre, jamais la preuve. Garde en `identifiants_externes` les identifiants MailWizz |
| Membres de la liste MailWizz de la lettre                                                | **Personne : c'est une projection du site** | MailWizz ne décide jamais seul qui est inscrit                                                              |

La liste de la lettre est alimentée **par le site**, pas par le CRM. Si des campagnes de prospection B2B voient le jour à partir des audiences du CRM, elles passeront par un **autre flux** : autre liste, autre pool d'IP, autre domaine d'envoi. La lettre est réservée aux personnes qui ont demandé le guide ou choisi de la recevoir : elle ne doit pas porter la réputation d'un envoi à froid.

**Deux bases légales** (amendement de Will du 24/09) :

- une **adresse professionnelle** qui demande le guide est inscrite d'office, au titre de l'**intérêt légitime** : prospection B2B, objet en rapport avec la profession, information au moment de la collecte, opposition en un clic dans chaque lettre. Le registre garde un événement `information` avec la version et le texte de la mention ;
- une **adresse personnelle** n'est inscrite que si la case facultative, décochée par défaut, a été cochée : c'est un **consentement préalable** (art. L.34-5 du CPCE), avec un événement `optin` et le texte de la case ;
- la nature de l'adresse est décidée par le serveur. Durée de conservation : 3 ans après le dernier contact.

La base de chaque inscrit se lit dans `consent_events` (action et version), **jamais dans MailWizz**.

### b) Qui est éligible

Est **éligible** à la lettre un abonné qui remplit toutes ces conditions :

1. `status = confirmed`, c'est-à-dire une inscription effective (adresse pro inscrite d'office, ou adresse perso dont la case a été cochée), jamais `pending`, `unsubscribed` ni `bounced` ;
2. aucune `EmailOpposition` sur son empreinte ;
3. aucun rebond dur, ni sur l'abonné, ni dans `email_logs` ;
4. **moins de 3 rebonds mous** (`soft_bounce_count < 3`), le même seuil que `ListeSuppression::SEUIL_REBONDS_TEMPORAIRES` côté CRM ;
5. un jeton de désinscription présent (sans lui, la lettre ne pourrait porter aucun lien de désinscription) ;
6. un dernier contact de moins de 3 ans. Au-delà, l'abonné est purgé : c'est le lot L6 qui l'applique, l'export du lot L3 ne le filtre pas encore.

Un **demandeur du guide qui n'est pas inscrit à la lettre** n'est **jamais** éligible. C'est le cas d'une adresse personnelle dont la case n'a pas été cochée.

Le site **filtre avant d'exporter**. On ne verse jamais la liste d'opposition dans la liste noire de MailWizz : elle y serait en clair, alors que le site a choisi de ne la garder qu'en empreintes.

### c) Contrat d'import (site vers MailWizz)

Les colonnes sont celles de l'export du lot L3 (`/api/admin/newsletter/export`). Elles portent les **étiquettes des champs de la liste MailWizz** :

| Étiquette       | Source site                                      | Usage                                                         |
| --------------- | ------------------------------------------------ | ------------------------------------------------------------- |
| `EMAIL`         | `email`                                          | adresse de destination                                        |
| `LOCALE`        | `locale`                                         | segment                                                       |
| `SOURCE`        | `source`                                         | segment (page du guide, encart d'article, etc.)               |
| `OPTIN_AT`      | date d'inscription (mention lue, ou case cochée) | ancienneté                                                    |
| `OPTIN_VERSION` | version de la mention ou du texte de la case     | renvoi vers la preuve du site                                 |
| `UNSUB_URL`     | lien public `/api/unsubscribe?token=…` du site   | lien de désinscription et en-tête `List-Unsubscribe` (voir e) |
| `GUIDE`         | a demandé le guide (oui / non)                   | segment                                                       |

- **L'import réel passe par l'API** (`lists/{list_uid}/subscribers`), jamais par un CSV. C'est obligatoire : seule l'API rend le `subscriber_uid`, que le site écrit dans `mailwizz_sub_uid`, et sans lui un retour ne pourrait être rattaché qu'**par l'adresse**, ce que ce contrat interdit (d). Le fichier CSV sert à relire à la main ce qui partira.
- Une personne qui devient inéligible est **retirée** de MailWizz par son `mailwizz_sub_uid`.
- La **liste de suppression** du lot L3 (`/api/admin/newsletter/suppression`) ne contient aucune adresse : une empreinte SHA-256 de l'adresse normalisée, un motif et une date. Ce sont des **données pseudonymisées**, à protéger comme l'export (accès admin, `no-store`). La même empreinte existe côté CRM (`email_suppressions.email_hash`) : on **compare** avec elle, on ne l'échange pas. Elle sert à vérifier qu'aucune adresse supprimée ne se trouve dans une liste MailWizz, **pas** à alimenter la liste noire de MailWizz.

### d) Contrat de retour (MailWizz vers site vers CRM)

Il y a **une seule entrée : le site** (par exemple `POST /api/mailwizz/webhook`). **Elle n'est pas construite** : on la construira avec l'outil, pas avant (voir g). Deux webhooks, l'un vers le site et l'autre vers le CRM, finiraient par diverger.

| Événement MailWizz                 | Effet sur le site                                                             | Propagation vers le CRM                                               |
| ---------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| désinscription                     | même chemin que `/api/unsubscribe` : `unsubscribed`, `optout` au registre     | `newsletter_optout` (existant)                                        |
| plainte (boucle de retour)         | désinscription **et** `EmailOpposition` : une plainte est un refus plus large | opposition (existant)                                                 |
| rebond dur                         | `status = bounced`                                                            | `email_hard_bounced` vers `email_suppressions` `hard_bounce` (lot L4) |
| rebond mou                         | `soft_bounce_count + 1`, date. Exclu de l'export à 3                          | aucune                                                                |
| inscription, réinscription, import | **ignoré** : 200 sans écriture                                                | aucune                                                                |
| ouverture, clic                    | **ignoré** (voir f)                                                           | aucune                                                                |
| effacement RGPD (côté site)        | le site supprime l'abonné dans MailWizz par `mailwizz_sub_uid`                | chemin d'effacement existant                                          |

**Règles de sens** :

- **Un retour ne peut que retirer** (`unsubscribed`, `bounced`, opposition, compteur), **jamais inscrire ni rétablir**. Seul le site inscrit.
- Un événement est rattaché par `mailwizz_sub_uid` **et** le `list_uid` attendu, **jamais par l'adresse**. Un `sub_uid` inconnu reçoit un 200 sans écriture : la même réponse qu'un événement traité, pour ne pas servir d'oracle.

**Sécurité de l'entrée**, au moins aussi stricte que `crm-webhook` :

- **Secret dédié**, distinct de `MAILWIZZ_API_KEY`, avec une rotation à deux valeurs valides. Sans secret configuré, l'entrée est inerte et répond 503.
- **Le secret passe dans un en-tête.** Si MailWizz impose de le mettre dans l'URL, il faut le retirer des journaux (Traefik, Cloudflare, Sentry `beforeSend`, `console`) avant la mise en service. Si MailWizz sait signer le corps, la signature HMAC avec horodatage et fenêtre anti-rejeu de 300 s (modèle `crm-webhook`) est obligatoire.
- **Liste d'IP autorisées** : celle du serveur MailWizz, si elle est fixe.
- **Ordre des contrôles** : taille du corps plafonnée (64 Ko) avant toute analyse, limitation de débit par IP (`checkRateLimit`), secret comparé à temps constant sur des empreintes de même longueur (réponse 401 uniforme), puis analyse. Le « 200 sur un événement inconnu » ne vaut **qu'après** l'authentification.
- **Idempotence** : un journal des événements reçus, sur le modèle de `CrmInboundEvent`. Si MailWizz ne fournit pas d'identifiant d'événement, la clé est composite (`type + sub_uid + campagne + horodatage`).
- **Journaux sans donnée personnelle** : `redactEmail`, et jamais le corps brut.
- **Réconciliation périodique**, en plus du webhook, dans le **worker** (pas dans l'app web), paginée et plafonnée en appels à l'API. Un webhook perdu, c'est une personne désinscrite qu'on réécrirait : on relit donc les désinscrits et les rebonds, et le site applique ce qui manque.
- On échange des **adresses** entre systèmes, **jamais des empreintes** : le site calcule un HMAC à clé (`person_key`), le CRM un SHA-256 nu. Chacun calcule la sienne.
- ⚠️ **À vérifier sur l'instance de Will** avant de construire : quels événements sa version de MailWizz sait réellement pousser. Les rebonds et les plaintes peuvent n'être disponibles que par l'API ou par le fichier comptable de PowerMTA.

### e) Le lien de désinscription d'une lettre

**Option retenue (A)** : le lien visible **et** l'en-tête `List-Unsubscribe` pointent vers l'**URL du site** (`UNSUB_URL`). Le désabonnement en un clic du site est déjà conforme à la RFC 8058 (POST, réponse 200). Le site reste maître **sans dépendre d'un webhook**.

Conditions, **à vérifier** sur la version installée :

- MailWizz accepte un en-tête `List-Unsubscribe` personnalisé par étiquette, accompagné de `List-Unsubscribe-Post: List-Unsubscribe=One-Click` ;
- **les deux en-têtes sont couverts par la signature DKIM** (RFC 8058 §4) ;
- **le suivi des clics ne réécrit jamais `UNSUB_URL`** : une redirection casserait le POST en un clic et mettrait le jeton dans les journaux de MailWizz.

Le jeton de `UNSUB_URL` est un secret au porteur qui ne sert **qu'à se désinscrire** : il ne révèle pas l'adresse et n'est jamais réutilisé pour autre chose (espace personnel, export de données). À défaut de ces conditions, on passe à l'option B : désinscription gérée par MailWizz, avec retour par webhook et réconciliation, traitée en moins de 2 jours comme Gmail et Yahoo l'exigent.

### f) Réglages de MailWizz, avant le premier import

- Liste en **inscription simple** côté MailWizz : l'inscription est déjà décidée et prouvée par le site (mention lue pour une adresse pro, case cochée pour une adresse perso). Une confirmation MailWizz enverrait un second e-mail et ferait croire à la personne qu'elle n'est pas inscrite.
- **E-mails automatiques de MailWizz coupés** : bienvenue, confirmation, au revoir. Si l'un d'eux est réactivé, son texte se valide comme tout texte public.
- **Suivi d'ouverture coupé** (pas de pixel). Le **suivi des clics** est coupé aussi par défaut. Le rouvrir est une décision de Will, avec mise à jour de la politique de confidentialité, et il ne doit jamais toucher `UNSUB_URL` (e).
- **Coordonnées de société de la liste** = Axion-IA (raison sociale et adresse du siège). MailWizz les insère dans chaque lettre (`[COMPANY_FULL_ADDRESS]`).
- Expéditeur sur le **sous-domaine** de la lettre, avec `Reply-To` sur `contact@`.

### g) Ce qui est interdit tant que l'outil n'existe pas

- **Aucune lettre par ZeptoMail.** Son contrat l'interdit, et le même compte porte les factures et les convocations. La garde « aucune lettre par ZeptoMail » (liste fermée des gabarits `marketing: true`) reste en place.
- **Aucun connecteur, aucune file, aucun worker, aucune route MailWizz** construits d'avance. Un script présent et jamais appelé dérive sans que personne le voie. On écrit le contrat, pas le code. La garde `aucun-connecteur-mailwizz-avant-l-outil.spec.ts` le vérifie. Elle se retire dans la PR qui construit l'entrée de retour.
- **Aucun enregistrement DNS appliqué.** La fiche `docs/ops/dns-lettre-mailwizz.md` est un plan, pas une configuration.

### h) Prérequis avant le premier envoi réel (liste de contrôle pour Will)

1. **Une infrastructure dédiée à la lettre d'Axion-IA** : IP, pool VirtualMTA, client MailWizz et serveur de livraison qui ne soient **partagés avec aucune autre activité**, et surtout pas avec de la prospection à froid. Idéalement un serveur dédié. L'IP est vérifiée absente des listes noires le jour J.
2. **L'entité qui exploite MailWizz et PowerMTA est nommée.** Si c'est une autre entité qu'Axion-IA, y compris une autre société du même dirigeant, elle est **sous-traitante** : contrat art. 28, registre art. 30, liste publique des sous-traitants. Si c'est Axion-IA sur un serveur loué, l'hébergeur de ce serveur est déclaré comme sous-traitant. L'exemption « auto-hébergé » de la garde des sous-traitants ne vaut que si Axion-IA exploite elle-même l'outil.
3. **DNS dans l'ordre** de `client.ts` : sous-domaine, SPF du sous-domaine, DKIM publié et vérifié, `_dmarc` du sous-domaine avec un `rua` dédié, puis un rapport qui montre `spf=pass` et `dkim=pass` **avant** le premier envoi. Jamais l'inverse : sous `p=reject`, la première lettre serait entièrement perdue, sans trace.
4. **Réglages f)** vérifiés sur l'instance, dont les coordonnées de société de la liste, lues sur un envoi de test.
5. **En-têtes e)** vérifiés sur un envoi de test : `List-Unsubscribe` vers le site, `List-Unsubscribe-Post`, tous deux dans le `h=` de la signature DKIM.
6. **Entrée de retour d)** construite et testée : désinscription, plainte, rebonds, rejeu, secret absent (503), secret faux (401), plainte forgée refusée, inscription ignorée, `sub_uid` inconnu (200 sans écriture), corps trop gros refusé.
7. **Premier envoi** : à l'adresse de Will seulement, et lu. Puis Will valide le texte de la première lettre, comme tout texte public.

### i) Ce qu'on garde, ce qu'on marque périmé

- **Gardés** : `mailwizz_list_uid` et `mailwizz_sub_uid`, les quatre variables d'environnement facultatives, l'avertissement DMARC de `client.ts`, mot pour mot. Le site n'aura jamais à parler à PowerMTA (c'est MailWizz qui l'utilise), mais retirer ses variables n'apporte rien.
- **Marqués périmés, sans être supprimés** : `docs/ops/dns-records.md` (enregistrements MX, SPF et DKIM de la racine), le bloc e-mail de `.env.production.example`, et les passages PowerMTA de `runbook-deploy.md`, `runbook-incident.md`, `runbook-monitoring.md`, de l'ADR 0001 (§5), de l'ADR 0019, de l'ADR 0031, de R29 et du commentaire de `src/content/subprocessors.ts`.

## Conséquences

- Le jour où l'outil existe, le branchement tient en trois morceaux, tous décrits ici : l'import par l'API, l'entrée de retour et la réconciliation. Aucun ne touche à l'inscription ni à sa preuve.
- Tant qu'il n'existe pas, la lettre n'a **aucun canal d'envoi**. C'est voulu : les inscrits attendent, et rien ne part par un canal non prévu.
- Une personne peut apparaître trois fois (site, CRM, MailWizz). Le tableau a) dit laquelle fait foi, pour chaque donnée.

## Alternatives écartées

- **Alimenter MailWizz depuis le CRM** : le CRM ne porte pas la preuve de l'inscription (ni mention, ni case). Ses audiences sont conçues pour la prospection B2B, pas pour la lettre.
- **Pousser les opposants dans la liste noire de MailWizz** : cela recréerait un fichier d'adresses en clair que le site a choisi de ne pas tenir.
- **Construire le connecteur dès maintenant** : il n'aurait aucun consommateur, et son contrat reste à vérifier sur l'instance (d, e).
- **Importer par CSV** : le CSV ne rend pas le `subscriber_uid`, ce qui forcerait à rattacher les retours par l'adresse.
