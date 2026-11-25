# R36 — Embeddings Voyage (doublons + voix de marque)

> **Quand** : le dirigeant veut quitter OpenAI pour les embeddings du contenu.
> **Principe** : colonne parallèle `articles.embedding_voyage` (1024 dim), rattrapée AVANT la bascule.
> Rien n'est allumé tant que les variables ci-dessous ne sont pas posées. En cas de panne
> Voyage, la publication d'un article n'est **jamais** bloquée (embedding laissé nul, rattrapé ensuite).

## 1. Poser la clé (par le dirigeant lui-même)

Coolify → Application → Env vars : `VOYAGE_API_KEY=<clé Voyage AI>` (déjà posée pour la base de connaissances : rien à faire dans ce cas). Ne jamais la coller dans un ticket, un chat ou un commit.

## 2. Lancer le rattrapage (fournisseur encore `openai`)

1. Variables Coolify (scope RUN) : `VOYAGE_ARTICLES_BACKFILL_ENABLED=true`, optionnel `VOYAGE_BACKFILL_MAX_PER_RUN` (500 par défaut, 2000 max). Redémarrer le worker.
2. Le cron `embeddings-backfill` (03:00 UTC) remplit `embedding_voyage` par lots de 20, du plus récent au plus ancien. Un 429 ou 3 lots en échec consécutifs arrêtent le passage ; le lendemain reprend.
3. Suivi : `ContentGenConfig` clé `embeddings_voyage_last_run` (`processed`, `errors`, `stoppedReason`). Reste à faire :
   `SELECT count(*) FROM articles WHERE status='published' AND embedding_voyage IS NULL;` → 0.

## 3. Calibrer (lecture seule)

`pnpm tsx scripts/calibrer-seuils-voyage.ts --echantillon=300` — n'écrit rien. Lire les percentiles du plus proche voisin, des paires aléatoires et de la distance à la référence.

- `CONTENT_DEDUP_DUPLICATE_THRESHOLD_VOYAGE` / `CONTENT_DEDUP_SIMILAR_THRESHOLD_VOYAGE` : juste au-dessus du p99 du bruit de fond, sous les vrais doublons connus.
- `BRAND_VOICE_DRIFT_WARN_THRESHOLD_VOYAGE` / `BRAND_VOICE_DRIFT_REVIEW_THRESHOLD_VOYAGE` : percentiles bas de la distribution à la référence.
- ⚠️ Les valeurs par défaut Voyage (0,85/0,80 et 0,70/0,80) sont **provisoires**, reprises d'OpenAI : ne pas basculer sans calibrage.

## 4. Référence de voix de marque Voyage (AVANT la bascule)

Ordre : **rattrapage → calibrage des seuils → recalibrage de la référence Voyage → bascule.**

Elle est stockée séparément (`brand_voice_reference_embedding_voyage`), la référence OpenAI n'est pas touchée. `recalibrateBrandVoice(articleIds, "voyage")` prend le fournisseur en paramètre explicite : on la recalibre **sans** poser `CONTENT_EMBEDDING_PROVIDER=voyage` (⚠️ **BLOQUANT avant la bascule, non résolu dans cette PR** : le formulaire de la console n'a pas de choix de fournisseur (il liste les articles du fournisseur actif, donc vide tant qu'OpenAI est éteint) et `recalibrateBrandVoice` exige une session admin, donc ne peut pas être appelée depuis `tsx`. Il faut ajouter un `<select name="provider">` au formulaire, ou extraire le calcul sans auth, AVANT de basculer). Même méthode : moyenne normalisée des articles choisis, qui doivent avoir `embedding_voyage` (rattrapage terminé). Tant qu'elle est absente, le moniteur de dérive saute proprement : ne pas basculer sans elle.

## 5. Basculer

À ne faire qu'une fois les étapes 2 à 4 terminées. `CONTENT_EMBEDDING_PROVIDER=voyage` (Coolify, scope RUN, app ET worker, même valeur) puis redémarrer app et worker. Vérifier : un article publié reçoit `embedding_voyage` ; le moniteur de dérive date son passage.

## Retour arrière

`CONTENT_EMBEDDING_PROVIDER=openai` (ou retirer la variable) : retour immédiat au comportement historique, colonne `embedding` intacte. La colonne `embedding_voyage` peut rester (inoffensive). Ne jamais supprimer la colonne dans la même opération.

## Pièges

- Les deux espaces vectoriels ne se comparent jamais : une similarité entre un vecteur OpenAI et un vecteur Voyage n'a aucun sens (dimensions différentes de toute façon).
- **Ordre de mise en ligne imposé.** Le worker (sources TS, ~3 min) atterrit bien avant l'app (~50 min) : n'allumer `CONTENT_EMBEDDING_PROVIDER=voyage` ou `VOYAGE_ARTICLES_BACKFILL_ENABLED` qu'**après** l'atterrissage de l'app (en-tête `x-axion-build-sha` à jour, `curl -sI https://axion-ia.com/fr | grep -i x-axion-build-sha`) ET la présence de la colonne `articles.embedding_voyage` (`prisma migrate status` ou lecture du schéma). Sinon le worker lit une colonne qui n'existe pas encore.
- **Même valeur sur l'app ET sur le worker** : ce sont deux conteneurs, chacun avec ses variables Coolify. `CONTENT_EMBEDDING_PROVIDER` et `VOYAGE_API_KEY` doivent être identiques des deux côtés, sinon la console (app : lecture et recalibrage de la référence) et le moniteur de dérive (worker) travaillent dans deux espaces différents. La publication et le rattrapage sont exécutés par le **worker**.

- **Migration qui expire** : `SET lock_timeout = '5s'` en tête. Si le délai expire, la migration est inscrite `failed` (P3009) et bloque les suivantes, alors que le déploiement reste vert (entrypoint en best-effort). Reprise : `prisma migrate resolve --rolled-back 20261126100000_add_article_embedding_voyage` puis relancer (tout est `IF NOT EXISTS`). Après l'atterrissage, vérifier `prisma migrate status` (cf. AGENTS.md).
- **Plafond quotidien** : le compteur de tokens de `VOYAGE_EMBEDDINGS_MAX_TOKENS_PER_DAY` est **en mémoire, par processus** : il repart à zéro à chaque redémarrage du worker et ne couvre pas le rattrapage (plafonné par passage, 500 par défaut, 2000 max ; un rattrapage lancé à la main N fois dépense N passages). Compteur Redis partagé : suite.
- **Article refusé par Voyage (4xx)** : il reste `NULL` et revient en tête chaque nuit (lot rejoué article par article). Au-delà de 60 fautifs consécutifs en tête, le rattrapage s'arrête sur « lots consécutifs en échec ». Mise à l'écart persistante : suite.
- **Doublons** : `findNearestArticles` et `verdictPourVoisinLePlusProche` sont préparés mais **non branchés** (aucun appelant hors tests).
- **Clé Voyage refusée (401/403)** : le rattrapage s'arrête avec `stoppedReason: "auth"`, visible seulement dans `embeddings_voyage_last_run` ; aucune alerte n'est levée.
