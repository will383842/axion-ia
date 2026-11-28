Pilotage SEO : collecte quotidienne des statistiques Bing Webmaster (P17), éteinte par défaut

## Ce que fait la PR

- Nouveau client de l'API Bing Webmaster (`src/server/seo-pilotage/bing/client.ts`) : lecture seule (pages, requêtes, exploration). La clé vient de `BING_WMT_API_KEY` ; absente ou vide, le module est inactif, sans erreur ni appel réseau. L'URL (qui porte la clé) n'est jamais journalisée ni recopiée dans une erreur.
- Nouvelle tâche `ingestion-bing` sur le robot P4 (file `seo-pilotage`, 07 h 47 Paris). Au plus 3 appels par passage, aucune nouvelle tentative ; un 429 (quota) arrête le passage.
- Agrégats hebdomadaires (lundi) pour les pages et les requêtes, recalculés par `upsert` (rejouable sans doublon). Première semaine de la fenêtre, probablement tronquée, écartée. Requêtes : filtre de données personnelles AVANT stockage (réutilise celui de P4).
- Migration additive `20261128010078_pilotage_seo_bing` : trois tables neuves (`bing_page_semaines`, `bing_requete_semaines`, `bing_exploration_jours`), sans clé étrangère, sans énumération. Le test « liste fermée des migrations » est mis à jour.
- **Interrupteur éteint par défaut** : la tâche exige `CONTENT_PILOTAGE_SEO="true"` ET `CONTENT_PILOTAGE_BING="true"` (valeur exacte) ET la clé. Sinon : saut avant toute lecture de base et tout appel réseau (la clé absente est aussi testée dans le worker avant de charger Prisma).
- Le code mort `content-gen/seo/bing-wmt-client.ts` n'est pas touché (hors périmètre).
- Pas de soumission de sitemap : la conception (DECOUPAGE P17) ne la prévoit pas.

## Clé Bing : point pour la session pilote

`git grep BING_WMT_API_KEY` : le secret est transmis par `deploy-coolify.yml` (l. 1296) **seulement à l'étape de ping IndexNow, sur le runner GitHub** ; il n'est PAS transmis au conteneur du worker par le workflow. `src/env.ts` ne la déclarait pas : elle est maintenant déclarée **optionnelle** (`BING_WMT_API_KEY`). Reste à faire par la session pilote / le propriétaire : poser la variable en scope RUN sur le worker dans Coolify (le workflow n'écrit pas les variables du serveur), puis `CONTENT_PILOTAGE_BING=true` quand on veut allumer. `ci.yml` et `deploy-coolify.yml` n'ont pas été modifiés.

## Fenêtre app/worker

Le cron est posé au démarrage du worker (`bootRepeatableJobs`) ; un worker plus ancien qui recevrait la tâche l'ignore (tâche inconnue journalisée). Tables absentes (P2021/P2022) : saut sans échec.

## Base de la PR

`main`.

## Tests

- `bing/__tests__/client.spec.ts` : clé absente, dates `/Date(ms)/`, endpoints, 429 / erreur / réseau / corps invalide, clé jamais dans les journaux. Fausse API : aucun appel réseau réel.
- `bing/__tests__/collecte.spec.ts` : agrégation, semaine tronquée, filtre des données personnelles, hôte étranger isolé, rejeu sans doublon, quota, plafond de 3 appels, erreur partielle.
- Worker : double interrupteur, propagation des sauts. Interrupteur et cadence. Migration additive (+ liste fermée).
- Contrôles : typecheck, vitest ciblé, `content-gen:isolation-check`, `image-bank:isolation-check`, lint, prettier.

## Après relecture (tour 1)

- Conservation : 25 mois ; requêtes rares (< 3 impressions) jamais stockées ; texte retiré par le filtre ou devenu rare effacé de la base à chaque passage.
- Sentry : `beforeBreadcrumb` écarte tout fil d'Ariane vers `bing.com` / `apikey=` (la clé est dans l'URL), test dédié.
- Lignes sans position valide (≤ 0) écartées ; corps JSON illisible classé `reponse_invalide`.
- À vérifier dans la documentation Microsoft avant d'allumer : granularité exacte des dates (jour ou semaine) et échelle de `AvgImpressionPosition`.

VERDICT OPUS : BON (tour 2, aucun point bloquant ; remarques non bloquantes : un nom ajouté après coup n'est refiltré que si la requête revient dans la réponse Bing du jour)
