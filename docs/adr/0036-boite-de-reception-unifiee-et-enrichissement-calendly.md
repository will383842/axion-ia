# ADR 0036 — Boîte de réception unifiée + enrichissement Calendly

- **Date** : 2026-07-29
- **Status** : Accepted
- **PR** : `feat/inbox-unifiee`
- **Supersède partiellement** : [ADR 0030](./0030-calendly-embed-js.md) (le
  postMessage reste le mécanisme de capture, mais son payload y était mal décrit)

## Contexte

Deux problèmes distincts, découverts en auditant la console d'administration en
production le 2026-07-29 à la demande de Will (« je n'arrive pas à comprendre la
différence entre ces onglets »).

### 1. La navigation épousait le schéma de base, pas le travail

Le groupe « Contacts » comptait 8 entrées et le groupe « Rendez-vous » 3, soit
**11 entrées de sidebar pour 4 objets réels** :

| Entrées                                                                                    | Table réelle                     |
| ------------------------------------------------------------------------------------------ | -------------------------------- |
| Tous les messages · Clients · Presse · Partenariats · Investisseurs · Messages recrutement | `Submission` (× 6 vues filtrées) |
| RV téléphonique · Calendrier RDV · Appels Calendly                                         | `calendly_events` (× 3 vues)     |
| Candidatures aux offres                                                                    | `JobApplication`                 |
| Demandes de podcast                                                                        | `PodcastRequest`                 |

Les trois entrées « Rendez-vous » étaient particulièrement trompeuses : elles
affichaient les **mêmes lignes**, et cliquer une ligne de « RV téléphonique »
renvoyait déjà vers le détail de « Appels Calendly »
(`features/admin-rendezvous/normalize.ts`). Ce n'était pas un pôle à trois
écrans, mais un écran unique éclaté en trois entrées de menu.

Les cinq vues filtrées de `Submission`, elles, avaient une vraie raison
d'exister : le sélecteur « Type » de la page « Tous les messages » porte l'enum
DB `SubmissionType`, qui n'a que 5 valeurs et écrase presse / partenariat /
recrutement / speaker / investisseur / support / autre en un seul
« contact générique ». Isoler la presse depuis la page était impossible — les
onglets figés compensaient un filtre insuffisant.

Enfin, aucun écran ne répondait à la première question qu'on se pose en ouvrant
un back-office : **« qu'est-ce qui est arrivé depuis hier ? »**. `/contacts`
redirigeait vers les messages.

### 2. Les réservations d'appel arrivaient vides — et le code se trompait de cause

`POST /api/calendly/client-event` lisait `payload.invitee.name`,
`payload.invitee.email` et `payload.event.location`. **Ces champs n'existent pas
dans le postMessage `calendly.event_scheduled`.** Calendly n'y transmet que deux
URI :

```json
{
  "event": { "uri": "https://api.calendly.com/scheduled_events/<uuid>" },
  "invitee": { "uri": "https://api.calendly.com/scheduled_events/<uuid>/invitees/<uuid>" }
}
```

Conséquence en production : les 4 réservations captées depuis la mise en service
n'avaient **ni nom, ni email, ni horaire**. La fiche détail était un formulaire
de ressaisie manuelle depuis Gmail, et la notification Telegram annonçait
« (non communiqué) ». Le commentaire du code présentait cela comme une
limitation RGPD acceptée ; c'était en réalité une lecture de champs inexistants.

Ces deux URI — seule donnée réelle disponible — **n'étaient stockées nulle
part en colonne**, seulement noyées dans `raw_payload`.

## Décision

### A. Un groupe « Boîte de réception » organisé par canal d'entrée

Les groupes `contacts` et `rendez-vous` fusionnent en un seul, **`contacts`,
relabellisé « Boîte de réception »**, avec 5 entrées — une par canal réel :

| Entrée              | Route                    | Source                       |
| ------------------- | ------------------------ | ---------------------------- |
| Tout                | `/contacts`              | les 4 canaux, en chronologie |
| Appels réservés     | `/contacts/appels`       | `calendly_events`            |
| Messages            | `/contacts/messages`     | `Submission`                 |
| Candidatures        | `/contacts/candidatures` | `JobApplication`             |
| Demandes de podcast | `/podcast`               | `PodcastRequest`             |

Le type `AdminNavGroup` perd `"rendez-vous"` : le compilateur garantit qu'il ne
peut pas revenir par inadvertance.

**Rien n'est supprimé.** Les 5 vues filtrées de `Submission` gardent leur route
et restent joignables par ⌘K et les favoris — elles portent `parent`, le
mécanisme déjà en place dans ce fichier pour retirer un item de la sidebar sans
casser breadcrumbs ni command palette. Réversible en retirant `parent`.

### B. Liste et calendrier sont des VUES, pas des rubriques

`/contacts/appels` porte un onglet Liste / Calendrier (`?vue=calendrier`). Un
mode d'affichage n'a pas à occuper une ligne de menu.

Les trois anciennes routes redirigent, en préservant les paramètres utiles
(mois, jour sélectionné) :

- `/contacts/rendez-vous` → `/contacts/appels`
- `/contacts/rendez-vous/calendrier` → `/contacts/appels?vue=calendrier&…`
- `/contacts/calendly` → `/contacts/appels`
- `/contacts/calendly/[id]` → `/contacts/appels/[id]`

Cette dernière compte : c'est l'URL que portent toutes les alertes
Telegram / WhatsApp déjà émises.

### C. Un filtre « Catégorie » qui rend les onglets figés inutiles

Un second sélecteur expose `details.unifiedType` — les 12 types fins réels, en
deux groupes (Projet IA / Autres demandes). L'export CSV reçoit le même
périmètre (paramètres `unifiedType` / `unifiedTypeIn`) : un export qui ne
correspond pas à l'écran d'où on le lance est un piège, pas une commodité.

### D. Persistance des URI + enrichissement API optionnel

`event.uri` et `invitee.uri` sont désormais stockés en colonnes.
`invitee_uri` est **UNIQUE** : c'est l'identité stable d'une réservation, donc
une clé de déduplication fiable. L'ancienne heuristique (même slug + même IP
dans les 60 s) reste en repli pour les payloads sans URI, mais n'est plus le
chemin principal — elle rejetait à tort deux réservations légitimes prises coup
sur coup depuis le même poste.

`src/server/calendly/api.ts` résout ces URI via l'API Calendly v2 et remplit
nom, email, téléphone, début, fin, fuseau, lieu, liens d'annulation et de
report. Ce module est **entièrement inerte sans `CALENDLY_API_TOKEN`** : aucune
requête n'est émise, et le produit se comporte exactement comme avant.

Règle d'écriture (`enrich.ts`), en deux moitiés :

- **l'admin est propriétaire du QUI** — nom, email, téléphone, lieu. Ces champs
  ne sont écrits que s'ils sont vides : un enrichissement tardif ne doit jamais
  effacer ce qui a été recopié à la main depuis Gmail.
- **Calendly est propriétaire du QUAND** — horaire et statut. Garder une
  ancienne heure après qu'un invité a déplacé son créneau produirait une fiche
  qui ment, ce qui est pire, pour un agenda, que pas de fiche du tout.

Seul le statut terminal posé après coup (`completed` / `no_show`) est protégé :
il décrit ce qui s'est passé pendant l'appel, ce que l'API ne peut pas savoir.

### E. Les deux catégories de notification mortes sont réveillées

`CALENDLY_INVITEE_CANCELED` et `CALENDLY_INVITEE_RESCHEDULED` existaient depuis
l'ADR 0030 — routées, formatées, testées — mais **n'avaient aucun émetteur** :
sans webhook, rien dans le produit ne pouvait constater qu'un RDV avait été
annulé ou déplacé. L'enrichissement est le premier mécanisme capable de le
détecter ; il émet donc l'alerte correspondante, avec un `dedupKey` par
évènement pour qu'un « Enrichir » relancé à la main ne re-sonne pas.

Un premier remplissage d'horaire (null → valeur) n'est pas un déplacement, et
une annulation n'est jamais annoncée deux fois ni depuis un statut terminal.

### F. Un gate CI relie la nav aux routes réelles

`buildAdminNav()` est un SSOT de **chaînes** : rien — ni le compilateur, ni les
tests d'origine — ne reliait ses `href` aux fichiers `page.tsx`. Un dossier
renommé laissait donc une entrée de menu vers un 404, en silence. C'est le
risque exact que fait courir un déplacement de routes.
`pnpm admin-nav:routes-check` résout chaque href sur le disque (segments
dynamiques `[id]` et groupes `(admin)` compris) et tourne en Gate A.

Un bouton « Enrichir depuis Calendly » sur la fiche permet le rattrapage
rétroactif : la migration recopie les URI depuis `raw_payload` pour les lignes
déjà captées, qui deviennent donc enrichissables le jour où le jeton est posé.

## Sécurité

L'URI enrichie provient d'un postMessage, donc d'une source **non fiable**, et
la requête part avec le Personal Access Token dans l'en-tête `Authorization`.
Sans filtrage, ce serait un SSRF avec fuite de jeton.

Double barrière :

1. à la capture, seules les chaînes commençant par `https://api.calendly.com/`
   sont stockées ;
2. à l'enrichissement, `isValidCalendlyUri()` re-vérifie protocole **et** hôte
   exact (`parsed.hostname === "api.calendly.com"`), ce qui rejette
   `api.calendly.com.attacker.test`, l'HTTP en clair et les IP internes.

Couvert par `src/server/calendly/__tests__/api.test.ts`.

## Incertitude assumée

Les sources publiques divergent sur la disponibilité exacte de l'API Calendly v2
au palier **gratuit** : la documentation développeur la présente comme
accessible par Personal Access Token à tous les utilisateurs, tandis que
plusieurs comparatifs la disent réservée à partir de Standard. **Cette question
n'a pas été tranchée** — la vérification demande un compte Calendly.

C'est précisément pourquoi l'échec est traité comme un cas nominal : un 401/403
donne `reason: "forbidden"`, s'affiche en clair dans l'admin (« jeton expiré,
révoqué, ou plan Calendly sans accès à l'API »), n'interrompt jamais la capture
et laisse le flux manuel intact. **Poser le jeton est le test décisif** ; si
l'API est refusée, le coût de la tentative est nul et il reste l'option A de
l'ADR 0030 (Calendly Standard, ~144 €/an, webhook signé).

## Conséquences

**Positives**

- 11 entrées de sidebar → 5 ; plus aucune entrée qui duplique une autre
- Un écran répond enfin à « qu'est-ce qui est arrivé depuis hier ? »
- La cause réelle des réservations vides est corrigée, pas contournée
- Déduplication fondée sur une identité, plus sur une heuristique temporelle
- L'alerte Telegram porte enfin un lien cliquable vers la fiche
- Le CSV respecte le filtre affiché
- Deux catégories de notification déclarées mais mortes deviennent vivantes
- Un gate CI empêche qu'une entrée de menu pointe vers un 404

**Constaté pendant l'audit, hors périmètre de cette PR** (à traiter à part) :

- `DEPLOY_SUCCESS` / `DEPLOY_FAILED` n'ont **aucun émetteur** : `deploy-prod.sh`
  appelle bien Telegram, mais le pipeline réel est `deploy-coolify.yml`, qui ne
  notifie rien. Les déploiements sont silencieux.
- `NEWSLETTER_CONFIRMED` / `NEWSLETTER_UNSUBSCRIBED` sont déclarées et routées
  mais jamais émises (seul `NEWSLETTER_PENDING` l'est).
- `BOOKING_CREATED` et `OPTION_*` sont sans émetteur depuis l'extinction du
  tunnel de réservation payante — dont deux entrées mortes dans la liste
  WhatsApp.
- `PRESS_REQUEST_SUBMITTED`, `SPEAKER_INVITATION_RECEIVED` et
  `INVESTOR_INQUIRY_RECEIVED` ne sont pas doublées sur WhatsApp. Conforme au
  commentaire de `routing.ts` (« leads humains uniquement »), mais l'investisseur
  est en severity `warn` : à confirmer avec Will.

**Négatives / à surveiller**

- La vue « Tout » lit une fenêtre bornée par canal (`PER_CHANNEL_FETCH = 200`)
  puis trie en mémoire. Tient tant que les canaux se comptent en centaines de
  lignes ; au-delà, il faudra une vue SQL `UNION` paginée. La troncature est
  **affichée à l'écran**, jamais silencieuse.
- Sans jeton API, les fiches d'appel restent à compléter à la main — l'écran le
  dit désormais explicitement au lieu de laisser chercher un bug.
- `enrichCalendlyEvent` est appelé de façon synchrone dans la route de capture
  (plafonné à 5 s par `AbortSignal`). Si la latence Calendly devenait un
  problème, le basculer en job BullMQ.
