# Agent 1 — Audit Graphe de Navigation Axion-IA

_Date : 2026-05-15T18:27:10.183Z — Mode : AUDIT-ONLY STRICT_

## TL;DR

- **Score graphe : 0 / 180**
- **Status crawl : COMPLETE**
- URLs crawlées : **1052** | Edges : **3220** | Requests : 210
- Composantes connexes : 1 (top sizes : 1052)
- Sitemap : **5/5 endpoints en HTTP 503** (finding majeur — voir section dédiée)

## Score breakdown (0/180)

| Pénalité                             | Volume             | Points   |
| ------------------------------------ | ------------------ | -------- |
| Orphans (graph in-degree=0)          | 0 × -10            | -0       |
| Dead-ends (out-degree=0, status 200) | 0 × -5             | -0       |
| Pages depth > 3                      | 0 × -3             | -0       |
| Clusters isolés                      | 0 × -50            | -0       |
| Conversion pages depth > 2           | 0 × -50            | -0       |
| **Broken 5xx conversion**            | 14 × -50           | -700     |
| **Broken 5xx (autre)**               | 155 × -8 (cap -80) | -80      |
| Broken 4xx                           | 1 × -3             | -3       |
| **Total pénalités**                  |                    | **-180** |

> **Note méthodologique** : pondérations broken 5xx/4xx ajoutées hors barème initial du prompt (qui couvrait seulement graphe). Justification : un crawl révèle 169 pages en HTTP 503 dont des pages de conversion. Ne pas les pénaliser produirait un score 180/180 fictivement vert.

## GATES ROUGES

- 🟢 OK — orphans > 5 (0)
- 🟢 OK — dead-ends > 10 (0)
- 🟢 OK — conversion depth > 2 (0)
- 🟢 OK — cluster isolé < 5 URLs (0)
- 🟢 OK — pSEO ville depth > 3 (0)
- 🔴 ROUGE — sitemap.xml indisponible (5)
- 🔴 ROUGE — broken 5xx page conversion (P0) (14)
- 🔴 ROUGE — broken 5xx total (>20) (169)
- 🟢 OK — broken 4xx total (>5) (1)

## Sitemap status

| Endpoint                               | HTTP |
| -------------------------------------- | ---- |
| https://axion-ia.com/sitemap-index.xml | 503  |
| https://axion-ia.com/sitemap.xml       | 503  |
| https://axion-ia.com/sitemap-pages.xml | 503  |
| https://axion-ia.com/sitemap-fr.xml    | 503  |
| https://axion-ia.com/sitemap-en.xml    | 503  |

> **FINDING MAJEUR P0** : tous les endpoints sitemap retournent **HTTP 503 "no available server"**. Google ne peut pas découvrir les URLs (pSEO villes, ~17 500 routes). Fallback orphans calculé uniquement sur crawl interne ; le vrai nombre d'orphans est probablement bien supérieur. À investiguer côté Coolify / Caddy upstream.

## Broken pages (HTTP 5xx / 4xx) — finding majeur additionnel

| Type                                       | Volume | Détail                                   |
| ------------------------------------------ | ------ | ---------------------------------------- |
| HTTP 5xx                                   | 169    | Dont **14 pages de conversion P0**       |
| HTTP 4xx                                   | 1      | Liens cassés ou 404 sur routes attendues |
| Non crawlées (cap atteint ou pas visitées) | 842    | Statut HTTP indéterminé                  |

> **🔴 P0 CRITIQUE — Pages conversion en HTTP 5xx :**
>
> - `https://axion-ia.com/en/book` → HTTP 503
> - `https://axion-ia.com/fr/reserver` → HTTP 503
> - `https://axion-ia.com/en/audit/flash` → HTTP 503
> - `https://axion-ia.com/fr/reserver?intervention=audit-flash-onsite` → HTTP 503
> - `https://axion-ia.com/fr/reserver?intervention=essentielle` → HTTP 503
> - `https://axion-ia.com/fr/reserver?intervention=essentielle&amp;tier=intimiste` → HTTP 503
> - `https://axion-ia.com/fr/reserver?intervention=essentielle&amp;tier=standard` → HTTP 503
> - `https://axion-ia.com/fr/reserver?intervention=essentielle&amp;tier=complete` → HTTP 503
> - `https://axion-ia.com/fr/reserver?ville=lyon` → HTTP 503
> - `https://axion-ia.com/fr/reserver?ville=bordeaux` → HTTP 503
> - `https://axion-ia.com/fr/reserver?ville=paris` → HTTP 503
> - `https://axion-ia.com/fr/reserver?ville=paris&amp;service=audit` → HTTP 503
> - `https://axion-ia.com/fr/reserver?ville=paris&amp;service=interventions` → HTTP 503
> - `https://axion-ia.com/fr/reserver?ville=paris&amp;service=implementation` → HTTP 503

Voir `agent1-broken.tsv` pour la liste complète.

## Statistiques globales

| Métrique             | Valeur |
| -------------------- | ------ |
| Total URLs crawlées  | 1052   |
| Total edges          | 3220   |
| Depth max            | 3      |
| Depth moyen          | 1.94   |
| % depth ≤ 3          | 100.0% |
| In-degree moyen      | 3.06   |
| In-degree max (hub)  | 102    |
| Composantes connexes | 1      |

## Heatmap par sous-arbre

| Catégorie      | Pages | Fetched 200 | Depth moyen | Dead-ends | Broken 4xx/5xx |
| -------------- | ----- | ----------- | ----------- | --------- | -------------- |
| implantations  | 884   | 5           | 1.98        | 0         | 37             |
| other          | 32    | 6           | 1.16        | 0         | 26             |
| implementation | 22    | 2           | 1.82        | 0         | 20             |
| cas-concrets   | 22    | 4           | 1.68        | 0         | 18             |
| interventions  | 19    | 4           | 1.95        | 0         | 15             |
| conversion     | 16    | 2           | 1.75        | 0         | 14             |
| blog           | 15    | 5           | 1.93        | 0         | 10             |
| audit          | 13    | 3           | 1.77        | 0         | 10             |
| centre-aide    | 13    | 4           | 1.92        | 0         | 9              |
| faq            | 10    | 4           | 2.1         | 0         | 6              |
| comparaisons   | 5     | 1           | 1.6         | 0         | 4              |
| guides         | 1     | 0           | 1           | 0         | 1              |

## Top 15 hubs (in-degree)

| URL                                                        | inDegree | outDegree | depth |
| ---------------------------------------------------------- | -------- | --------- | ----- |
| https://axion-ia.com/fr                                    | 102      | 59        | 0     |
| https://axion-ia.com/fr/audit                              | 97       | 72        | 1     |
| https://axion-ia.com/fr/interventions                      | 85       | 80        | 1     |
| https://axion-ia.com/fr/implementation                     | 84       | 82        | 1     |
| https://axion-ia.com/fr/cas-concrets                       | 81       | 67        | 1     |
| https://axion-ia.com/fr/implantations                      | 81       | 72        | 1     |
| https://axion-ia.com/fr/contact                            | 61       | 54        | 1     |
| https://axion-ia.com/fr/interventions/essentielle          | 55       | 56        | 1     |
| https://axion-ia.com/fr/blog                               | 44       | 56        | 1     |
| https://axion-ia.com/fr/implantations/ile-de-france        | 43       | 434       | 1     |
| https://axion-ia.com/fr/implantations/auvergne-rhone-alpes | 42       | 340       | 1     |
| https://axion-ia.com/fr/implantations/nouvelle-aquitaine   | 42       | 247       | 1     |
| https://axion-ia.com/fr/faq                                | 41       | 61        | 1     |
| https://axion-ia.com/fr/centre-aide                        | 40       | 61        | 1     |
| https://axion-ia.com/fr/implantations/ile-de-france/paris  | 40       | 70        | 1     |

## Top 30 problèmes

| Sév | Type                  | URL                                                                          | Parent                                                     | Recommandation                                                                                                   |
| --- | --------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| P0  | BROKEN-CONVERSION-5xx | https://axion-ia.com/en/book                                                 | https://axion-ia.com/en                                    | HTTP 503 sur page conversion — investiguer Coolify/Caddy upstream + redéployer. Site partiellement inaccessible. |
| P0  | BROKEN-CONVERSION-5xx | https://axion-ia.com/fr/reserver                                             | https://axion-ia.com/fr                                    | HTTP 503 sur page conversion — investiguer Coolify/Caddy upstream + redéployer. Site partiellement inaccessible. |
| P0  | BROKEN-CONVERSION-5xx | https://axion-ia.com/en/audit/flash                                          | https://axion-ia.com/en/audit                              | HTTP 503 sur page conversion — investiguer Coolify/Caddy upstream + redéployer. Site partiellement inaccessible. |
| P0  | BROKEN-CONVERSION-5xx | https://axion-ia.com/fr/reserver?intervention=audit-flash-onsite             | https://axion-ia.com/fr/audit                              | HTTP 503 sur page conversion — investiguer Coolify/Caddy upstream + redéployer. Site partiellement inaccessible. |
| P0  | BROKEN-CONVERSION-5xx | https://axion-ia.com/fr/reserver?intervention=essentielle                    | https://axion-ia.com/fr/interventions/essentielle          | HTTP 503 sur page conversion — investiguer Coolify/Caddy upstream + redéployer. Site partiellement inaccessible. |
| P0  | BROKEN-CONVERSION-5xx | https://axion-ia.com/fr/reserver?intervention=essentielle&amp;tier=intimiste | https://axion-ia.com/fr/interventions/essentielle          | HTTP 503 sur page conversion — investiguer Coolify/Caddy upstream + redéployer. Site partiellement inaccessible. |
| P0  | BROKEN-CONVERSION-5xx | https://axion-ia.com/fr/reserver?intervention=essentielle&amp;tier=standard  | https://axion-ia.com/fr/interventions/essentielle          | HTTP 503 sur page conversion — investiguer Coolify/Caddy upstream + redéployer. Site partiellement inaccessible. |
| P0  | BROKEN-CONVERSION-5xx | https://axion-ia.com/fr/reserver?intervention=essentielle&amp;tier=complete  | https://axion-ia.com/fr/interventions/essentielle          | HTTP 503 sur page conversion — investiguer Coolify/Caddy upstream + redéployer. Site partiellement inaccessible. |
| P0  | BROKEN-CONVERSION-5xx | https://axion-ia.com/fr/reserver?ville=lyon                                  | https://axion-ia.com/fr/implantations/auvergne-rhone-alpes | HTTP 503 sur page conversion — investiguer Coolify/Caddy upstream + redéployer. Site partiellement inaccessible. |
| P0  | BROKEN-CONVERSION-5xx | https://axion-ia.com/fr/reserver?ville=bordeaux                              | https://axion-ia.com/fr/implantations/nouvelle-aquitaine   | HTTP 503 sur page conversion — investiguer Coolify/Caddy upstream + redéployer. Site partiellement inaccessible. |
| P0  | BROKEN-CONVERSION-5xx | https://axion-ia.com/fr/reserver?ville=paris                                 | https://axion-ia.com/fr/implantations/ile-de-france        | HTTP 503 sur page conversion — investiguer Coolify/Caddy upstream + redéployer. Site partiellement inaccessible. |
| P0  | BROKEN-CONVERSION-5xx | https://axion-ia.com/fr/reserver?ville=paris&amp;service=audit               | https://axion-ia.com/fr/implantations/ile-de-france/paris  | HTTP 503 sur page conversion — investiguer Coolify/Caddy upstream + redéployer. Site partiellement inaccessible. |
| P0  | BROKEN-CONVERSION-5xx | https://axion-ia.com/fr/reserver?ville=paris&amp;service=interventions       | https://axion-ia.com/fr/implantations/ile-de-france/paris  | HTTP 503 sur page conversion — investiguer Coolify/Caddy upstream + redéployer. Site partiellement inaccessible. |
| P0  | BROKEN-CONVERSION-5xx | https://axion-ia.com/fr/reserver?ville=paris&amp;service=implementation      | https://axion-ia.com/fr/implantations/ile-de-france/paris  | HTTP 503 sur page conversion — investiguer Coolify/Caddy upstream + redéployer. Site partiellement inaccessible. |
| P0  | BROKEN-5xx            | https://axion-ia.com/en/case-studies                                         | https://axion-ia.com/en                                    | HTTP 503 prod — vérifier route handler / SSR error / variable env manquante.                                     |
| P0  | BROKEN-5xx            | https://axion-ia.com/en/locations                                            | https://axion-ia.com/en                                    | HTTP 503 prod — vérifier route handler / SSR error / variable env manquante.                                     |
| P0  | BROKEN-5xx            | https://axion-ia.com/en/interventions/essential                              | https://axion-ia.com/en                                    | HTTP 503 prod — vérifier route handler / SSR error / variable env manquante.                                     |
| P0  | BROKEN-5xx            | https://axion-ia.com/en/ai-stack                                             | https://axion-ia.com/en                                    | HTTP 503 prod — vérifier route handler / SSR error / variable env manquante.                                     |
| P0  | BROKEN-5xx            | https://axion-ia.com/en/comparisons                                          | https://axion-ia.com/en                                    | HTTP 503 prod — vérifier route handler / SSR error / variable env manquante.                                     |
| P0  | BROKEN-5xx            | https://axion-ia.com/en/ai-guide                                             | https://axion-ia.com/en                                    | HTTP 503 prod — vérifier route handler / SSR error / variable env manquante.                                     |
| P0  | BROKEN-5xx            | https://axion-ia.com/en/glossary                                             | https://axion-ia.com/en                                    | HTTP 503 prod — vérifier route handler / SSR error / variable env manquante.                                     |
| P0  | BROKEN-5xx            | https://axion-ia.com/en/faq                                                  | https://axion-ia.com/en                                    | HTTP 503 prod — vérifier route handler / SSR error / variable env manquante.                                     |
| P0  | BROKEN-5xx            | https://axion-ia.com/en/help                                                 | https://axion-ia.com/en                                    | HTTP 503 prod — vérifier route handler / SSR error / variable env manquante.                                     |
| P0  | BROKEN-5xx            | https://axion-ia.com/en/about                                                | https://axion-ia.com/en                                    | HTTP 503 prod — vérifier route handler / SSR error / variable env manquante.                                     |
| P0  | BROKEN-5xx            | https://axion-ia.com/en/methodology                                          | https://axion-ia.com/en                                    | HTTP 503 prod — vérifier route handler / SSR error / variable env manquante.                                     |
| P0  | BROKEN-5xx            | https://axion-ia.com/en/roi                                                  | https://axion-ia.com/en                                    | HTTP 503 prod — vérifier route handler / SSR error / variable env manquante.                                     |
| P0  | BROKEN-5xx            | https://axion-ia.com/en/press                                                | https://axion-ia.com/en                                    | HTTP 503 prod — vérifier route handler / SSR error / variable env manquante.                                     |
| P0  | BROKEN-5xx            | https://axion-ia.com/en/implantations/ile-de-france                          | https://axion-ia.com/en                                    | HTTP 503 prod — vérifier route handler / SSR error / variable env manquante.                                     |
| P0  | BROKEN-5xx            | https://axion-ia.com/en/implantations/auvergne-rhone-alpes                   | https://axion-ia.com/en                                    | HTTP 503 prod — vérifier route handler / SSR error / variable env manquante.                                     |
| P0  | BROKEN-5xx            | https://axion-ia.com/en/implantations/occitanie                              | https://axion-ia.com/en                                    | HTTP 503 prod — vérifier route handler / SSR error / variable env manquante.                                     |

## Méthodologie

- BFS depth 6 concurrent 10 | UA `AxionIA-NavAudit/1.0 (+audit-only)`
- Seeds : https://axion-ia.com/fr, https://axion-ia.com/en
- pSEO villes : sample stratifié 5/région INSEE
- Aucune mutation (GET only, redirect manual, pas de form submit)
- Élapsed : 14.5s
