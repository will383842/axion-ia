# ADR 0033 — Observatoire IA : dashboard pro (segments + courbes), synthèse LLM, auto-update

- Statut : Accepté
- Date : 2026-06-24
- Contexte de décision : Will (demande d'enrichissement de la page `/observatoire-ia`)

## Contexte

La page publique `/observatoire-ia` n'affichait que des barres SSR par question + filtres + export CSV. Demande : des visualisations plus riches (graphiques, courbes), des données téléchargeables, **des stats par région / secteur / taille**, une **analyse rédigée** professionnelle, et une **mise à jour automatique**. Deux surfaces : page publique (users) ET console admin.

Contrainte dure : budget Web Vitals (`AGENTS.md`) — First Load JS ≤ 75 KB gz/route, CLS = 0, INP ≤ 100 ms. Les libs de charting clientes (Recharts, Chart.js) sont **exclues** (poids JS + risque CLS).

## Décisions

1. **Visualisations 100 % SSR, zéro JS client.**
   - `SegmentHeatmap` (table colorée CSS) pour les croisements segment×métrique.
   - `TrendChart` (SVG inline + repli table `sr-only`) pour les courbes d'évolution.
   - On conserve `DistributionChart` (barres SSR) pour le détail par question.
   - Aucune lib de charting → aucun impact sur le bundle/CLS. Données tabulaires lisibles par LLM et lecteurs d'écran.

2. **Breakdowns par segment** calculés dans `snapshot.ts` (`aggregateAllSegments`) en SQL `COUNT … FILTER`, **stockés dans le JSON existant** `barometer_snapshots.payload.segments` (pas de nouvelle table). Seuil `MIN_SEGMENT_N = 5` (anti-bruit + anti-réidentification).

3. **Historisation** : nouvelle table `barometer_snapshot_history` (1 ligne/recompute, append-only) → alimente les courbes d'évolution.

4. **Synthèse LLM ancrée** : nouvelle table `barometer_analyses` (cache key="latest"). `analysis.ts` réutilise `provider-router` (fallback OpenAI→Claude), n'autorise QUE les chiffres du bloc « DONNÉES VÉRIFIÉES » (mêmes garde-fous que `barometer-insight`), refuse s'il n'y a aucune réponse réelle, plafond de coût `BUDGET_CAP_USD`. Affichée publiquement avec mention « généré par IA ».

5. **Auto-update** : worker BullMQ `observatoire-snapshot` (cron `0 */6 * * *`) → recompute snapshot + segments + historique, régénère l'analyse **uniquement si l'effectif a changé**, purge CF (best-effort). La page reste en ISR `revalidate=3600`.

6. **Téléchargements** : ajout d'un export JSON (`/api/observatoire/export-json`) en complément du CSV ; les deux exposés en JSON-LD `Dataset.distribution`.

## Conséquences

- Migration 100 % additive (`20260624100000_observatoire_dashboard`) : 2 tables, aucun drop.
- Web Vitals préservés (SSR, pas de JS ajouté). À confirmer par le gate LHCI post-deploy.
- Coût LLM borné et déclenché au plus toutes les 6 h, et seulement si l'effectif bouge.
- La fraîcheur publique dépend de l'ISR (≤ 1 h) + purge CF du worker.
- ⚠️ Les vues globales (segments / analyse / évolution) ne s'affichent qu'en vue **non filtrée** ; en vue filtrée, on garde le détail par question (drill-down).
- Le worker tourne dans le process `Dockerfile.worker` (app Coolify worker) — nécessite `COOLIFY_WORKER_APP_UUID` pour être déployé (cf. `deploy-coolify.yml`).
