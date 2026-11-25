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

## 4. Référence de voix de marque Voyage

Elle est stockée séparément (`brand_voice_reference_embedding_voyage`), la référence OpenAI n'est pas touchée. Avec `CONTENT_EMBEDDING_PROVIDER=voyage` déjà posé, recalibrer depuis la console (même méthode : moyenne normalisée des articles choisis). Tant qu'elle est absente, le moniteur de dérive saute proprement.

## 5. Basculer

`CONTENT_EMBEDDING_PROVIDER=voyage` (Coolify, scope RUN) puis redémarrer app et worker. Vérifier : un article publié reçoit `embedding_voyage` ; le moniteur de dérive date son passage.

## Retour arrière

`CONTENT_EMBEDDING_PROVIDER=openai` (ou retirer la variable) : retour immédiat au comportement historique, colonne `embedding` intacte. La colonne `embedding_voyage` peut rester (inoffensive). Ne jamais supprimer la colonne dans la même opération.

## Pièges

- Les deux espaces vectoriels ne se comparent jamais : une similarité entre un vecteur OpenAI et un vecteur Voyage n'a aucun sens (dimensions différentes de toute façon).
- **Ordre de mise en ligne imposé.** Le worker (sources TS, ~3 min) atterrit bien avant l'app (~50 min) : n'allumer `CONTENT_EMBEDDING_PROVIDER=voyage` ou `VOYAGE_ARTICLES_BACKFILL_ENABLED` qu'**après** l'atterrissage de l'app (en-tête `x-axion-build-sha` à jour, `curl -sI https://axion-ia.com/fr | grep -i x-axion-build-sha`) ET la présence de la colonne `articles.embedding_voyage` (`prisma migrate status` ou lecture du schéma). Sinon le worker lit une colonne qui n'existe pas encore.
- **Même valeur sur l'app ET sur le worker** : ce sont deux conteneurs, chacun avec ses variables Coolify. `CONTENT_EMBEDDING_PROVIDER` et `VOYAGE_API_KEY` doivent être identiques des deux côtés, sinon la publication (app) et le rattrapage (worker) écrivent dans deux espaces différents.
