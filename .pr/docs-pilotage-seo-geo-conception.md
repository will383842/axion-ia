# Conception : pilotage SEO et GEO en continu (tout le site)

## But

Concevoir, sans écrire de code, un chantier qui :

- maximise la présence de **tout le site** dans Google : articles, actualités, guides, pages villes, offres, FAQ, pages institutionnelles ;
- le fait citer par les moteurs IA (ChatGPT, Perplexity, Gemini, AI Overviews / AI Mode, Copilot, Claude), sur les bonnes requêtes et les bonnes intentions ;
- l'améliore en continu, avec des garde-fous.

**Phase de conception uniquement** : aucun fichier sous `src/` ni `prisma/` n'est modifié.

## Livrables (`docs/pilotage-seo-geo/`)

- **`AUDIT.md`** : l'existant lu dans le code. Ce qui marche, ce qui est un squelette, ce qui manque.
- **`PLAN.md`** :
  - architecture en quatre couches (mesure, analyse, action, restitution) ;
  - ingestion Search Console par lot et historique ;
  - moteur d'opportunités ;
  - mesure GEO honnête ;
  - boucle d'amélioration avec journal et retour arrière ;
  - coûts, interrupteurs, arbitrages entre experts, questions pour Will, conditions de démarrage.
- **`DECOUPAGE.md`** : 20 PR (P0 à P18, avec P0b, P6a et P6b), en vagues, avec dépendances, parallélisme, fichiers et tests, et les recouvrements avec les branches en cours.

## Méthode

1. Audit fait directement dans le code de `origin/main`. Aucune valeur de clé ni de secret n'a été lue.
2. Cinq sous-agents Opus en lecture seule, en parallèle : données Search Console, intentions et mots-clés, GEO / citations IA, boucle d'amélioration, critique. Leurs désaccords sont tranchés dans PLAN § 9. Deux affirmations du critique, vérifiées puis rejetées :
   - « Les branches equipe-ed ne sont pas fusionnées » : faux, les PR #2351, #2359, #2389 et #2379 sont fusionnées.
   - « Le panel coûterait 10 à 40 $ par semaine » : faux, le calcul s'appuyait sur le mauvais `claude-search.ts`, celui qui n'a pas de recherche web.
3. Trois passes de relecture par un sous-agent Opus en lecture seule :
   - passe 1 : 19 affirmations confirmées, mais Haiku est refusé par la porte de coût, d'où un chiffrage faux, plus des incohérences internes. **À CORRIGER.**
   - passe 2 : réservation du panel sous-estimée, et un seuil de stockage journalier qui aurait vidé les détecteurs. **À CORRIGER.**
   - passe 3, après corrections : **BON**.

## Constats principaux de l'audit

- **La Search Console fonctionne, mais une URL à la fois, sans historique.**
  - Cinq consommateurs indépendants appellent l'API.
  - `site-route-gsc` additionne les 25 premières requêtes, ce qui sous-compte. Ses fenêtres sont décalées d'une URL à l'autre.
  - `KeywordTracking` écrase son historique à chaque passage.
- **L'alerte « indexation stagnante » est coupée** depuis le 11/07, car ses CTR et impressions étaient codés en dur à 0.
- **Le client Bing Webmaster est du code mort.**
- **L'API Google Indexing est utilisée pour des articles**, alors qu'elle est réservée à `JobPosting` et `BroadcastEvent`.
- **GEO.** Les visites venues des IA (Plausible) existent. Il n'y a aucune collecte des passages des robots d'IA ni aucune mesure de citations. `llms.txt` est une **route**, pas un fichier de `public/`.
- **Quatre défauts sur `main`, dans l'équipe éditoriale, à corriger avant de bâtir dessus :**
  1. L'éditeur SEO envoie un type `blog_edition_seo` absent de l'énumération : la porte Claude le refuse. Il n'est branché nulle part.
  2. Le mode mise à jour utilise un `jobId` fictif (`maj-<id>`), probablement refusé par `reserverCout`. **À confirmer dans les journaux de production.**
  3. `dateModified` bouge sur une simple écriture de méta (`@updatedAt`). Le mode mise à jour écrit `Article.updatedAt` alors que le blog lit `ArticleTranslation.updatedAt`, et il ne garde aucune copie de l'« avant ».
  4. Le worker `content-refresh` exécute toute tâche inconnue comme `liens-hebdo`, une tâche payante.

## Principales décisions de conception

- **Mode observation seul pendant au moins 8 semaines.** Planchers statistiques : 30 impressions sur 28 j par requête, 300 pour attribuer un effet. Le site fait environ 428 impressions par semaine.
- **Une file `seo-pilotage` nouvelle, qui remplace `site-route-gsc` et `content-keyword-sync`.** Elle ignore toute tâche inconnue.
- **Une migration additive « mesure »** (tables nouvelles seulement), puis deux petites tables GEO et le journal `SeoModification`. Ce sont des tables nouvelles, rien n'est modifié ni supprimé.
- **Coût Claude** : il passe par la porte existante, donc il est compté dans 10 $/jour et 200 $/mois. Sous-plafonds du pilotage : 2 $/jour et 30 $/mois. Estimation : 10 à 17 $/mois. Modèle Sonnet 5.5 (Haiku est refusé par la porte).
- **Aucune URL ne change.** Offres et pages légales : **interdit**. Pages villes et institutionnelles : **recommandation seulement** (elles sont dans le code). `pricing.ts`, `legal.ts`, `positionnement.ts` et `journee-ia-commun.ts` sont **lus**, jamais écrits, et un test le verrouille.
- **Écran** « Pilotage SEO & IA » (`content-gen/pilotage`, et non « geo », nom déjà pris par les villes). Une **section** est ajoutée au rapport hebdomadaire existant. Aucun JS sur les pages publiques.

## Recouvrements signalés

- **`feat/equipe-ed-pr12-orchestration`** (ouverte) touche `blog-claude-ledger.ts` et branche `editerSeo`. **P0 attend sa fusion.**
- Les autres `feat/equipe-ed-*` sont fusionnées. Leurs branches distantes sont périmées.
- **`feat/images-blog-qualite`** : aucun fichier commun.
- **`feat/gabarits-articles-conception`** : le format FAQ et les critères du score de citabilité devront s'aligner sur ses gabarits.

## Ce qui reste ambigu ou impossible à trancher ici

- **Présence des identifiants Search Console en production** : non vérifiée, puisqu'aucun secret n'a été lu. C'est la condition n° 1, que tranchera la sonde de P1.
- **Quotas exacts de Search Analytics** (charge, ~50 000 lignes par jour), **séparation d'AI Overviews / AI Mode dans la Search Console**, **rapport de citations IA de Bing**, **rétention de l'API Analytics de Cloudflare** : à revérifier dans les documentations officielles au moment de coder. Ces points sont marqués comme incertains dans le plan.
- **ChatGPT, Perplexity, Gemini et Copilot** ne sont mesurables qu'indirectement (visites référées, passages des robots) sans outil payant. Le panel Claude ne les représente pas, et l'écran devra le dire.
- **Décisions de Will** (PLAN § 10) : jeton Cloudflare en lecture, clé Bing, moteurs payants hors plafond, coefficient de valeur métier, liste des 30 questions du panel, persona d'auteur.
- `pnpm exec prettier` a exigé un `pnpm install` préalable (dépendances absentes dans l'environnement). Il est passé ensuite sans erreur.
- Je ne peux pas ouvrir de PR depuis cette session : la branche est poussée, il reste à ouvrir la PR.

VERDICT OPUS : BON
