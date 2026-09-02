# ADR 0046 — L'adaptateur MCP fédéré d'Axion-IA (lots 4a et 4b du socle `axion-ops`)

**Date :** 2026-09-02 · **Statut :** accepté · **Portée :** `src/app/api/mcp/`, `src/server/mcp/`

## Contexte

Le poste de pilotage vocal est un socle générique, dans un dépôt séparé (`axion-ops`),
qui ne connaît aucun métier. Axion-IA lui est branché **en mode fédéré** : l'adaptateur
vit ici, chez son produit, et le socle ne consomme qu'un **manifeste JSON** épinglé par
empreinte, puis appelle une route en JSON-RPC. Le cahier des charges v6 (§ 09, § 13,
§ 28, § 32) fixe le contrat ; l'audit de 21 agents a mesuré que « la couche service
réutilisable » de la v5 était vraie pour **un agrégateur sur six**, d'où un lot 4a de
travaux préalables dans ce dépôt.

## Décisions

1. **La porte est `POST /api/mcp`, jamais `/mcp`.** Le proxy redirige `/mcp` en 301
   vers `/fr/mcp`, qui n'existe pas. Et comme le proxy exclut `api/`, `authorized()` ne
   s'exécute jamais sur cette route : **la serrure est dans le handler** — secret partagé
   en en-tête `x-mcp-secret`, comparé à temps constant, **après** le limiteur de débit
   (sinon la route est un oracle à force brute). Sans variable de secret : 503, jamais
   « ouvert ». Au build hors-ligne (`stub.invalid`, ADR 0026) : 503 en tête de handler.
2. **Le contrat du socle est porté ici, à l'identique, pas importé.** `axion-ops` n'a pas
   de paquet publié et le build tourne sur GitHub Actions sans accès à ce dépôt. Les
   énumérations, les noms réservés au contexte d'autorisation et le sceau des profils
   sont lus dans le code du socle (commit `041970c`) — le sceau a été **exécuté** depuis
   ce code, pas recopié d'une spécification — et une garde les confronte.
3. **Le manifeste est versionné (`src/server/mcp/manifeste.json`) avec son SHA canonique.**
   C'est le document que le socle inscrit dans `adapters.lock.json`. Une garde recalcule
   l'empreinte depuis le code : un outil modifié sans `pnpm mcp:manifeste` rougit en CI,
   au lieu d'être refusé en production pour « empreinte divergente ».
4. **Sept outils de lecture : cinq agrégateurs du produit, plus l'API GitHub.** `inbox.recent` (admin-inbox, rendu sans
   session au lot 4a), `agenda.jour` et `agenda.semaine` (admin-agenda),
   `rendezvous.list` (admin-rendezvous), `pilotage.alertes` (admin-planning/hub),
   `qualiopi.conformite` (**`listAlertes()`, jamais l'évaluateur** — 47 règles, 31
   `findMany` sans `take`, coût non mesuré). `unified-contact` n'est pas branchable
   (Turnstile, IP, cookies UTM). `agenda.poser` et `message.repondre` sont des effets —
   lot 7.
   **`deploiement.etat` applique le défaut écrit de W-9 : « GitHub seul ».** Sa couche
   service (`src/server/deploiement/etat.ts`) lit le dernier run du workflow de
   déploiement, épinglé **par le nom du fichier de workflow** et non par « le dernier run
   du dépôt », puis le confronte au commit que le processus courant exécute (`BUILD_SHA`).
   C'est cette confrontation qui répond à la question réelle — « ma modification est-elle
   en ligne ? » : un run vert dit qu'une image a été poussée, jamais qu'elle est servie.
   Six états, dont trois existent pour empêcher un « tout va bien » non vérifié :
   `non-configure` (aucun jeton — et alors **aucun appel réseau n'est tenté**, un 404 de
   dépôt privé se lirait comme une absence de déploiement), `indisponible` (l'API n'a pas
   répondu, ou a répondu illisible), et `en-retard` (run vert, mais autre commit servi).
   Coolify reste hors périmètre : la décision W-9 ne l'a pas ouvert, et l'état du
   conteneur ne s'invente pas.
5. **Aucun outil ne rend de lien de console.** Le préfixe d'administration est un segment
   de sécurité ; un lien dans une réponse vocale finit dans une transcription. Les
   identifiants sont opaques et la console les résout. La garde
   `admin-nav:routes-check` lit `src/app/api/mcp` **et** `src/server/mcp` et refuse
   quatre motifs, prouvés par des témoins fabriqués.
6. **Pont d'identité — W-6 non décidée, le défaut s'applique.** L'adaptateur agit au nom
   du rôle le plus faible (`reader`) : `peutVoirAppels: false`, dérivé de la fonction
   que la console utilise elle-même. Aucune coordonnée (e-mail, téléphone) n'est dans
   les schémas de sortie ; noms de contact et notes des rendez-vous sont masqués.
   **Rien ne lit une habilitation dans la charge utile** : les onze noms réservés au
   contexte sont refusés dans tout schéma d'entrée (contrôle 7), chacun par un témoin.
7. **La sortie standard du § 13.2, avec les deux étages de vérité sur la source.**
   `sourceIncomplete` (la source a coupé : fenêtre de 100 par canal, plafond de 2 000
   rendez-vous, Google tronqué) est distinct de `truncated` (le socle a compacté) ;
   `failedSources` porte les canaux en **panne**, jamais confondus avec des canaux vides.
8. **L'adaptateur ne compacte pas — mais il borne le fil.** Au-delà de 3 × `maxBytes`
   (le dernier palier de la cascade du socle), la réponse est refusée en
   `result_too_large` avec une indication de filtrage. Les plafonds visent ~20 k
   caractères par liste (§ 14) ; chaque outil a un jeu maximal versionné, validé contre
   son schéma et son plafond (contrôle 4).
9. **Le journal n'a aucun contenu.** Une ligne par terminaison, refus compris — outil,
   identifiants opaques, code, durée, compte, octets — et rien d'autre. Garde dérivée
   de `detectPii` sur des sources simulées saturées de coordonnées, qui annonce combien
   de lignes elle a scannées.

## Conséquences

- Toute modification d'un outil impose `pnpm mcp:manifeste` (et `pnpm mcp:fixtures` si
  la forme de sortie change), puis un **redéploiement de production** pour que le socle
  puisse ré-épingler. Le lot 4b est, par construction, le plus exposé au coût de la CI.
- Le fichier `src/server/mcp/outils/qualiopi-conformite.ts` est inscrit nominativement
  dans `CONSOMMATEURS_ASSUMES` du contrôle d'isolation Qualiopi.
- Le socle ne possède pas encore le chemin d'exécution vers un adaptateur fédéré
  (étape 14 de sa chaîne) : la forme de `tools/call` suivie ici est celle de la révision
  MCP 2025-06-18 (`params.name`, `params.arguments`, `params._meta`), que le socle
  lit déjà de ses hôtes.

## Ce qui reste à décider (Will)

- **W-6** : le rôle au nom duquel l'adaptateur agit. Tant que non décidé : `reader`.
- **W-9** : confirmer « GitHub seul » (le défaut, appliqué), ou ouvrir Coolify. En
  attendant, poser `GITHUB_READ_TOKEN` (portée `actions: read`) dans Coolify : sans lui
  l'outil rend « non-configure », ce qui est honnête mais inutile.
- Le critère « POST /api/mcp sans secret rend 401/503, vérifié depuis un autre réseau »
  est une mesure d'exploitation, après déploiement.
