# ADR 0039 — Notifications par thème, et Calendly en quasi temps réel

- **Statut** : Accepted (2026-08-09)
- **Complète** : ADR 0029 (hub de notifications), ADR 0036 (enrichissement
  Calendly), ADR 0038 (créneaux rendus côté serveur). Ne supersède rien.

## Contexte

Deux constats faits en production le 2026-08-09, sur demande de Will
(« lorsque quelqu'un réserve sur Calendly, on reçoit un message sur Telegram et
sur WhatsApp normalement, non ? »).

### 1. Les réservations n'arrivaient plus en temps réel

Depuis ADR 0038, `/appel` rend les créneaux en HTML statique et le clic ouvre
`calendly.com` **dans un nouvel onglet**. La capture instantanée par
`postMessage` (`CalendlyEventCapture` → `POST /api/calendly/client-event`) n'a
donc plus rien à capter : dernière ligne `source = 'embed_js'` en base le 23/07,
alors que trois réservations sont arrivées depuis.

Le seul chemin vivant était le sondage GitHub Actions horaire. Or GitHub ne
garantit pas l'heure de déclenchement. Relevé sur les 8 passages précédant
l'audit :

| Passage       | Écart au précédent |
| ------------- | ------------------ |
| 23:45 → 02:29 | **2 h 44**         |
| autres        | 58 min à 1 h 04    |

Conséquence mesurable en base : le rendez-vous du **06/08 à 16:30** a été
découvert à **15:29** — une heure avant. Une réservation prise 30 minutes avant
son créneau pouvait être signalée _après_ le début du rendez-vous.

### 2. Tout arrivait mélangé, et WhatsApp était troué

Telegram n'avait que 3 groupes (RDV / Messages / Système). Le groupe « Messages »
recevait 12 catégories — une candidature, un investisseur et une demande de devis
dans le même fil. Le groupe « RDV » mélangeait Calendly avec 6 catégories du
tunnel de réservation payante, éteint depuis l'audit 2026-07-09.

Côté WhatsApp, 6 catégories manquaient — dont, surtout, **l'annulation et le
déplacement d'un rendez-vous Calendly**. Un client qui annulait une heure avant
ne produisait aucune alerte sur le téléphone : précisément le cas où il faut
réagir vite. `REVIEW_SUBMITTED`, lui, n'était dans aucun `Set` de routage et
tombait donc dans le `return "system"` par défaut, au milieu des alertes
techniques — personne ne l'avait décidé.

## Décision

### Latence : sondage BullMQ à la minute, webhook prêt mais éteint

Le vrai temps réel passe par les webhooks Calendly, qui **exigent un plan
Standard** (~12 €/mois) ; le plan gratuit n'y a pas droit. Plutôt que de faire
dépendre la correction d'un abonnement, on livre les deux :

- **Maintenant, gratuitement** : le sondage quitte GitHub Actions pour le worker
  BullMQ, qui déclenche à la minute. Latence : **≤ 60 s** au lieu de ≥ 2 h.
- **Le jour venu** : `POST /api/calendly/webhook` existe déjà, signature HMAC
  vérifiée, et reste **inerte** tant que `CALENDLY_WEBHOOK_SIGNING_KEY` est
  absent. L'activer ne demande qu'un `pnpm calendly:webhook:subscribe` et une
  variable. Latence : ~2 s.

Deux cadences, imposées par le quota de **60 requêtes/minute** de l'API Calendly :
`discover` toutes les minutes (2 requêtes), `refresh` toutes les 10 minutes
(jusqu'à ~50 requêtes). Accélérer `refresh` saturerait le quota et ferait rejeter
`discover` — c'est-à-dire la passe qui porte la promesse.

Le cron GitHub n'est **pas supprimé** : rétrogradé à 6 h, il reste le seul chemin
qui ne dépend ni de Redis, ni de BullMQ, ni du conteneur worker.

**Le webhook ne persiste rien lui-même** : il appelle `discoverNewCalendlyEvents()`
/ `refreshUpcomingCalendlyEvents()`, exactement comme le worker. Un second chemin
d'écriture aurait signifié deux façons de créer un `CalendlyEvent`, deux formats
de clé de déduplication, et la certitude qu'ils divergent. Ici, une réservation
vue par les deux chemins produit une ligne (contrainte `UNIQUE` sur
`invitee_uri`) et une alerte (même clé de dédup, même émetteur).

### Routage : 8 groupes Telegram, 2 bots, 1 table exhaustive

| Groupe                    | Contenu                                                   | WhatsApp |
| ------------------------- | --------------------------------------------------------- | -------- |
| 📅 Calendly _(bot dédié)_ | les 3 événements Calendly, et rien d'autre                | ✅       |
| 💼 Candidatures           | offre d'emploi + spontanée/commerciale                    | ❌       |
| 📰 Presse                 | demandes journalistes                                     | ✅       |
| 💰 Investisseurs          | sollicitations investisseurs                              | ✅       |
| 🛠️ Interventions          | formation, 1-to-1, audit, implémentation, devis           | ✅       |
| ⭐ Avis clients           | avis à modérer                                            | ✅       |
| 💬 Messages               | contact, support, podcast, invitation conférence          | ❌       |
| 🔔 Système                | newsletter, ops, + les 6 dormantes `BOOKING_*`/`OPTION_*` | ❌       |

Les `Set` de catégories sont remplacés par une table
`Record<NotificationCategory, TelegramGroup>` **exhaustive par construction** :
ajouter une catégorie sans lui donner de groupe ne compile plus. Vérifié en
retirant `PRESS_REQUEST_SUBMITTED` — `TS2741: Property 'PRESS_REQUEST_SUBMITTED'
is missing`. C'est ce qui empêchera un futur `REVIEW_SUBMITTED` de se retrouver
au mauvais endroit sans que personne ne le voie.

### Le couple (bot, salon) ne se résout jamais séparément

`resolveTelegramTarget(group)` rend les deux ensemble. Un bot Telegram ne peut
écrire que dans les salons dont il est **membre** : résoudre le jeton et le
`chat_id` indépendamment permettrait de fabriquer un couple impossible — le bot
historique visant le salon Calendly, où seul le bot Calendly a été ajouté.
Telegram répondrait `400 chat not found`, `sendTelegramRaw` renverrait `false`,
et l'alerte de rendez-vous disparaîtrait sans bruit. Si le bot dédié manque, on
replie donc sur un couple dont on sait qu'il fonctionne.

**Corollaire voulu : le déploiement seul ne change rien.** Chaque groupe non
encore créé retombe sur son salon d'avant le 2026-08-09 (Calendly → RDV,
candidatures/presse/investisseurs/interventions → Messages, avis → Système).
Aucune notification ne peut se perdre entre le déploiement et la création des
groupes.

### WhatsApp : un seul fil, donc un en-tête

CallMeBot n'écrit que dans **une conversation** — une clé = un destinataire, pas
de groupes (vérifié le 2026-08-09 ; leur documentation renvoie vers TextMeBot ou
Twilio, payants, pour les groupes). La séparation par thème ne peut donc pas
passer par le destinataire. Elle passe par un en-tête normalisé en **première
ligne** (`📅 CALENDLY · `, `🛠️ INTERVENTION · `…) : ce sont les ~20 caractères
que l'écran verrouillé affiche, donc le seul endroit où la distinction se joue.

Le fil unique étant un budget et non une préférence, son périmètre a été
resserré par Will : les candidatures (pic de 17 en une journée le 05/08), le
contact générique, le support et le podcast en sortent. Ils restent
intégralement sur Telegram, dans leur groupe.

## Conséquences

- La latence d'une réservation passe de « jusqu'à 2 h 44 » à « moins de 60 s »,
  sans abonnement.
- **Point de panne n°1** : `CALENDLY_API_TOKEN`, `WHATSAPP_CALLMEBOT_APIKEY` et
  `WHATSAPP_NOTIFY_PHONE` étaient absents de l'application **worker** (deux
  applications Coolify distinctes). Sans elles, le sondage tourne à vide et
  WhatsApp reste muet — en silence. À poser avant tout.
- Le compteur « à traiter » de la console peut retarder de 30 s quand la
  découverte vient du worker : un worker ne peut pas invalider le cache d'un
  autre conteneur, et `getInboxActionCounts` porte déjà `{ revalidate: 30 }`.
- Volume Redis : la file `calendly-poll` tourne 1 440 fois/jour, d'où une
  rétention resserrée (100 complétés / 200 échoués) et `attempts: 1`.
- Une réservation prise à plus de 60 jours n'est pas découverte (horizon de
  `discover`). Calendly borne de toute façon l'horizon de réservation.
- Une réservation créée **et** annulée entre deux passages reste invisible :
  `discover` n'interroge que `status=active`. Le webhook supprime ce cas.

## Alternatives écartées

- **Ne prendre que le webhook** : rien ne s'améliorait tant que l'abonnement
  n'était pas souscrit, et l'abonnement est la décision de Will, pas la nôtre.
- **Remettre l'iframe Calendly sur `/appel`** pour retrouver le `postMessage` :
  réintroduirait le problème d'article 82 réglé par ADR 0034/0038, et ne
  couvrirait toujours pas les réservations faites hors du site — c'est-à-dire la
  quasi-totalité d'entre elles.
- **Un bot Telegram par thème** (8 bots) : le résultat visible est identique — ce
  qui sépare les conversations est le groupe, pas le bot — pour 8 jetons à
  maintenir sur deux applications. Seul Calendly a son bot, à la demande de Will.
- **Un second numéro WhatsApp** pour isoler Calendly : possible (WhatsApp
  Business + seconde clé CallMeBot), écarté au profit du resserrement du
  périmètre, qui ne demande aucun setup.
