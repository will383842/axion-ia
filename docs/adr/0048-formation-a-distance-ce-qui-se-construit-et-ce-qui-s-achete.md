# ADR 0048 — Formation à distance : ce qui se construit maintenant, et ce qui s'achète plus tard

- **Statut** : **ACCEPTÉ** — tranché en session le 2026-09-05, sous mandat explicite de Will (« tranche entre Zoom et Teams selon tes recommandations »)
- **Date** : 2026-09-05
- **Auteur** : Claude, en ouvrant le lot C du chantier Qualiopi
- **Référence** : `src/server/qualiopi/lieu/format-lieu.ts`, `src/server/qualiopi/notifications/notifications-service.ts`, `src/server/qualiopi/emargement/token-service.ts`, `src/server/qualiopi/presence/parse-{zoom,teams,meet}.ts`, `src/lib/docuseal.ts`, `prisma/schema.prisma` (`PlateformeDistanciel`, `TrainingSession.lieuVisioUrl`)

## Pourquoi cet ADR existe

Le produit sait DÉCRIRE une session à distance depuis l'origine : la modalité existe,
le champ `lieuVisioUrl` existe, l'énumération `PlateformeDistanciel { zoom teams meet
autre }` existe, et trois analyseurs de relevés de connexion existent
(`parse-zoom.ts`, `parse-teams.ts`, `parse-meet.ts`).

Il ne sait pas la **TENIR**. Et le trou n'est pas celui qu'on croit.

L'énoncé qui circulait — « il faut choisir entre Zoom et Teams » — pose la question
comme un achat. Or l'audit du terrain (§7 de l'état vivant du 2026-09-05) montre que
le défaut bloquant ne coûte **rien** et n'attend **aucun abonnement** :

> **Le stagiaire ne reçoit JAMAIS le lien de connexion.**

Vérifié dans le code, pas déduit. La convocation du stagiaire passe le lieu par
`formatLieu(session)` (`notifications-service.ts:218`), et `formatLieu` réduit
délibérément l'URL à son seul nom d'hôte via `new URL(u).hostname`
(`format-lieu.ts:54`). Le stagiaire reçoit donc la chaîne « meet.google.com ».

Cette réduction est **juste** — un lien de visioconférence vaut souvent clé d'accès et
n'a rien à faire sur une pièce contractuelle archivée. Elle a simplement été appliquée
au **seul canal qui devait faire exception**. Résultat : une session à distance est
aujourd'hui décrivable, facturable, conventionnable — et **personne ne peut s'y
connecter**.

Cet ADR sépare donc deux questions qu'on confondait, et n'en tranche qu'une par achat.

## 1. Les deux couches, et pourquoi elles ne se paient pas au même moment

| Couche | Ce qu'elle résout | Ce qu'elle coûte | Quand |
| --- | --- | --- | --- |
| **A — la porte d'entrée** | le participant reçoit de quoi entrer, en sécurité, et l'organisateur sait avant la séance qu'il manque quelque chose | **rien** | maintenant |
| **B — la preuve d'assiduité** | le relevé de connexion horodaté, par personne, récupéré automatiquement | un abonnement | au premier client à distance |

La couche A ne dépend d'aucun tiers : elle ne fait que **cesser de retenir** une
information qu'on possède déjà, et la remettre par le bon canal. Elle est donc
construite tout de suite.

La couche B est la seule qui justifie un abonnement, parce qu'elle seule demande une
API : récupérer qui s'est connecté, quand, et pendant combien de temps. C'est
l'exigence Qualiopi réelle du distanciel — la preuve de réalisation.

⚠️ **Sans la couche B, le distanciel reste tenable** : les trois analyseurs de relevés
CSV existent déjà. On exporte le relevé à la main depuis l'interface de la plateforme
et on l'importe. C'est fastidieux, ce n'est pas bloquant. C'est précisément ce qui
autorise à différer l'achat.

## 2. L'arbitrage de la plateforme : **Zoom**

### Ce que la décision doit satisfaire

Une seule chose, en réalité : **rendre le relevé de présence par participant,
horodaté, via une API**. Tout le reste (créer la réunion, envoyer une invitation) se
fait déjà sans elle.

### Pourquoi pas Google Meet, alors que tout le reste de la pile est Google

C'est le candidat que le code lui-même suggère : le champ de saisie porte le
substitut d'exemple `https://meet.google.com/…` (`LieuFieldset.tsx`), Calendly pousse
déjà vers Google Agenda, et Will y travaille au quotidien.

Il est pourtant **écarté, et pour un motif dur** : le relevé de présence de Meet passe
par les API d'administration de **Google Workspace**. Le compte utilisé est
`williamsjullin@gmail.com` — un compte Google **personnel**, sans domaine Workspace et
sans console d'administration. La couche B est donc inatteignable sans acheter
Workspace *en plus*, c'est-à-dire sans changer d'adresse de travail. Le candidat qui
paraissait gratuit est en fait le plus coûteux : il se paie en migration.

### Pourquoi pas Microsoft Teams

Teams sait le faire, mais l'accès au relevé exige un locataire Azure AD, une
inscription d'application, et un **consentement administrateur** sur des permissions
applicatives. C'est une infrastructure d'entreprise pour un organisme qui compte une
personne. Le coût n'est pas l'abonnement : c'est l'administration permanente d'un
locataire, et une dépendance de plus dont personne ici ne tient les clés.

### Pourquoi Zoom

- l'authentification est un **OAuth serveur-à-serveur** : un identifiant, un secret,
  aucun locataire à administrer — exactement la forme que `src/lib/docuseal.ts` sait
  déjà porter ;
- le relevé de présence est **un seul appel** (`/report/meetings/{id}/participants`),
  qui rend directement les heures d'entrée et de sortie par participant ;
- l'abonnement est **unitaire et résiliable**, sans engagement d'écosystème ;
- `parse-zoom.ts` existe déjà : le format de sortie est **déjà compris** par le
  produit, ce qui rend la couche B incrémentale plutôt que fondatrice.

### Ce que la décision n'interdit surtout PAS

L'énumération `PlateformeDistanciel { zoom teams meet autre }` **reste inchangée**, et
`autre` reste un chemin de plein droit. Un client qui impose son propre Teams doit
continuer à fonctionner : on colle son lien, la couche A le transmet, et le relevé
s'importe en CSV. **Zoom est le chemin OUTILLÉ, jamais le chemin OBLIGATOIRE.** Coder
l'inverse — refuser une session parce que son lien n'est pas un lien Zoom — remplacerait
un manque par une impasse.

## 3. La règle de dégradation : l'absence de licence ne casse rien

L'abonnement ne sera pris qu'au premier client à distance. D'ici là, et si un jour il
est résilié, **le produit doit se comporter exactement comme aujourd'hui**.

Le patron est déjà écrit dans ce dépôt et il est repris tel quel :

- la variable d'environnement est **optionnelle** dans `src/env.ts`
  (`z.string().optional()`), et remappée dans `runtimeEnv` ;
- ⚠️ **le refus dur vit dans le MODULE, jamais dans `env.ts`.** Le motif est écrit
  `src/env.ts:50-56` : une exigence bloquante y ferait échouer le **démarrage du
  conteneur**. Un organisme qui n'a pas encore de client à distance ne doit pas voir
  son site refuser de démarrer pour une licence de visioconférence ;
- un prédicat `estZoomConfigure()` sur le modèle de `isDocusealConfigured()`
  (`docuseal.ts:41`) ;
- tout appel sortant borné par `AbortSignal.timeout(...)` (`docuseal.ts:227`), et une
  classe d'erreur qui porte son `statusCode` (`docuseal.ts:240`).

**Conséquence à tenir : `estZoomConfigure() === false` n'est pas une panne.** C'est un
état nominal, et l'écran doit le dire ainsi — « relevé de présence à importer à la
main », jamais « erreur ».

## 4. Ce que la couche A construit, et les trois défauts qu'elle ferme

### 4.1 Le lien atteint le participant — mais pas par n'importe quel chemin

Le remettre en clair dans la convocation reproduirait exactement le défaut que
`formatLieu` évitait : la convocation est une **pièce archivée**, souvent réexpédiée,
parfois versée au dossier de contrôle. Un lien de réunion qui vaut clé d'accès n'y a
pas sa place.

La brique existe déjà, et elle est bonne : `creerTokenCoaching`
(`token-service.ts:314`) lie un jeton à l'**empreinte SHA-256 de l'adresse du
destinataire**, stockée dans `EmargementToken.destinataireEmailSha256`
(`schema.prisma:7991`). Le lien transféré à un tiers cesse de fonctionner.

🔴 **Mais ce liage n'existe QUE sur le chemin AFEST individuel.** Le chemin COLLECTIF
(`creerTokenInscription`, `token-service.ts:138`) **ne l'écrit pas**. C'est-à-dire que
la protection existe précisément là où il y a un seul participant, et manque là où il
y en a douze. Étendre le liage au chemin collectif est donc un préalable, pas une
option.

### 4.2 Le refus se produit devant l'ADMIN, pas devant le participant

Une session à distance sans lien de connexion ne doit pas être découverte à l'heure
de la séance.

Le patron existe, et sa doctrine est déjà écrite `token-service.ts:41-50` :

> le refus se produit à la CRÉATION DU LIEN, devant l'admin qui peut corriger, et non
> devant le stagiaire en salle qui ne le peut pas.

C'est mot pour mot le cas du distanciel. On ajoute donc au contrôle avant vol existant
(`TokenEmargementError("journees_non_declarees" | "horaires_non_confirmes")`) le cas
« session à distance sans lien », levé **au même endroit**, dans la même forme.

### 4.3 Le rappel de la veille n'existe pas pour le participant

`formateur-rappel-j1` existe. `qualiopi-rappel-j7` existe. **Il n'y a aucun
`qualiopi-rappel-j1`** — vérifié dans `src/server/email/outbox-policy.ts`, qui liste
les envois automatiques.

En présentiel, l'oubli se rattrape : la personne est attendue quelque part, on
l'appelle. À distance, un participant qui oublie **ne manque à personne** jusqu'à ce
que la séance soit finie — et l'absence devient un trou dans la preuve d'assiduité.
Le rappel de la veille est donc une exigence du distanciel, pas un confort.

L'envoi doit suivre `envoyerRappelJ7` (`notifications-service.ts:311`), qui boucle sur
les inscrits avec un `continue` en cas d'échec — **jamais un `return false`**. Le
correctif du 2026-08-24 avait constaté qu'un premier échec privait les neuf autres.

## 5. Ce que cet ADR ne tranche pas

- **la création automatique de la réunion** (couche B, second temps). Créer la réunion
  par l'API évite le copier-coller, mais ne prouve rien ; le relevé, lui, prouve. La
  valeur est dans le relevé, donc l'ordre est : relevé d'abord.
- **`nbParticipantsPrevus` n'est opposé à rien** — aucune règle ne le lit, une session
  prévue pour 8 accepte 40 inscrits sans un mot. Traité comme trou d'alerte
  (`effectif_depasse`), pas ici.
- **`prisma.trainee.findMany` sans `take`** charge toute la table
  (`sessions/[id]/page.tsx:387`). Défaut réel, sans rapport avec le distanciel.
- **la révocation de `lieuVisioUrl`** : le champ est une URL nue, `@db.Text`, sans
  expiration. Une fois la couche B en place, la réunion est créée par l'API et le
  champ devient dérivé — la question se reposera dans d'autres termes. La rouvrir
  maintenant coûterait une migration qu'on referait.

## 6. Ce qui reste à Will

**Rien avant le premier client à distance.** C'est le point de cet ADR.

Le jour venu : un abonnement **Zoom Pro** (le relevé de présence n'existe pas sur
l'offre gratuite), puis deux secrets à poser en variables d'environnement. La couche A
sera déjà en service et n'aura pas attendu.
