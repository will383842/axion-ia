Mesure gratuite des visites venues des IA et des passages des robots d'IA (pilotage SEO, P10)

## Ce que fait cette PR

- **Visites venues des IA (Plausible, déjà en place)** : deux vues de plus, calculées sur les mêmes réponses (aucun appel réseau de plus) : la **page d'arrivée × IA** (top 10, détail par IA) et la **tendance sur 12 semaines, par IA**. `tracking-referer.ts` n'est pas touché.
- **Passages des robots d'IA (Cloudflare, gratuit)** : nouvelle tâche `robots-ia` dans la file `seo-pilotage`, chaque jour à 7 h 07 (Paris). Elle lit l'API GraphQL Analytics de Cloudflare et range des **agrégats** `{jour, robot, famille, famille de pages, nombre}` : ni adresse IP, ni user-agent brut (il est classé puis jeté). Familles : recherche / entraînement / utilisateur. Un passage de robot n'est pas une citation.
- **Migration additive** `20261128010064_pilotage_seo_robots_ia` : une seule table neuve `robot_ia_jours` (aucun DROP / UPDATE / DELETE / ALTER, pas de clé étrangère, pas d'énumération). Les tests « liste fermée des migrations » sont mis à jour.

## Sécurité et interrupteur

- **ÉTEINT par défaut** : seul `CONTENT_PILOTAGE_SEO="true"` allume la tâche (sinon, aucune lecture de base, aucun appel Cloudflare).
- **Sans jeton ou sans zone Cloudflare**, avec le stub de build, sur un refus (403, erreur GraphQL) ou une panne : la tâche saute (« indisponible »), sans échec et sans rien écrire. Le droit `Analytics:Read` sur le jeton est une décision de Will.
- Fenêtre app/worker : tâche inconnue ignorée par un ancien worker ; table absente (P2021/P2022) = saut. La table est nouvelle, aucune colonne n'est ajoutée à une table existante.
- Jours relus : les 3 derniers jours finis (UTC), **une requête Cloudflare par jour** ; un jour tronqué (10 000 lignes) ou vide n'est pas écrit (il n'écrase jamais un état meilleur) ; chaque jour écrit est remplacé en une transaction (rejouable) ; ménage au-delà de 400 jours.
- Un saut anormal (jeton sans droit `Analytics:Read`, erreur Cloudflare) est journalisé en avertissement avec sa raison ; « pas de jeton » est l'état normal.
- Rien de lourd côté navigateur : tout est côté serveur, budget Web Vitals intact.

## Ce qui n'est PAS dans cette PR

- L'onglet « Moteurs IA » de l'écran : l'écran (P8) n'existe pas encore. Les données (`visites-ia.ts`, table `robot_ia_jours`) sont prêtes à y être branchées.
- Le panel de questions (P11).
- À vérifier avec un vrai jeton : rétention et champs de l'API selon l'offre Cloudflare (noté dans le code).

## Base

Branche partie de `feat/seo-pilotage-p4-robot` (recalée) ; base de la PR : `main`, à ouvrir après la fusion de P4.

## Tests

- Nouveaux : classement des robots par famille, agrégat sans IP ni user-agent, collecte Cloudflare (sans jeton / stub / refus / panne / réponse), enregistrement rejouable, tâche, aiguillage du worker, page × IA et tendance, migration additive avec contre-témoins.
- `pnpm typecheck`, `pnpm lint`, prettier, `content-gen:isolation-check`, `image-bank:isolation-check` : OK. Vitest ciblé (pilotage, file, analytics, migrations) : 1 608 tests OK.

## Relecture

Deux tours Opus. Tour 1 : à corriger (types de variables GraphQL, troncature à 10 000 lignes, raison du saut perdue, tests faibles) ; tout corrigé. Tour 2 : rien de bloquant. Restent, mineurs : horodatage de migration imposé (« 64 » secondes, sans effet sur l'ordre), clé de regroupement des semaines, calcul de « saut anormal » sur le texte de la raison.

⚠️ La requête GraphQL n'a pas pu être essayée avec un vrai jeton (aucun secret ici) : à vérifier au premier essai réel (types, rétention, limites selon l'offre).

VERDICT OPUS : BON

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01E7vxGciiQ92cEKmMx83MCM
