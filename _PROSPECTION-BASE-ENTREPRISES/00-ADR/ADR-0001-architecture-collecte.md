# ADR-0001 — Architecture de collecte : Stock Sirene open data + delta quotidien

- **Module** : Prospection & Base Entreprises (Axion-IA)
- **Numérotation** : ADR interne du module (0001), indépendante des ADR globaux d'axionia (ex. ADR 0026).
- **Date** : 2026-07-01
- **Statut** : **Accepté** (Will 2026-07-03 — autopilot go)
- **Référence** : `PLAN-DIRECTEUR-V1.md` §6.1, §6.2, §5.12, §16, §17. Cet ADR fige la décision d'architecture, il ne réécrit pas le plan.

---

## Contexte

Le module doit constituer une base **exhaustive** des entreprises françaises, balayable par
département × activité NAF × taille (TPE/PME/ETI/GE), avec un suivi de couverture qui prouve
l'exhaustivité (matrice = work-list, cf. §4.2). Le volume cible est de l'ordre de **~10 M unités
légales actives** (et jusqu'à ~30 M établissements si tous les SIRET sont collectés, cf. §8).

Deux familles de sources gratuites INSEE coexistent :

1. **L'API de recherche** (`recherche-entreprises.api.gouv.fr`, sans clé) : paginée, plafonnée à
   **~10 000 résultats par critère** et **~7 req/s**.
2. **Les fichiers STOCK Sirene open data** (INSEE / data.gouv : `StockUniteLegale`,
   `StockEtablissement`, ~4 Go, MAJ mensuelle) + un **flux de mises à jour quotidien**.

Le choix du mécanisme de collecte de masse conditionne toute l'architecture (workers, exhaustivité,
dénombrement, rate-limit, idempotence). Il doit être tranché **avant tout connecteur** (tranche T0/T3
de la roadmap §12).

## Décision

**La collecte de masse passe par les FICHIERS STOCK Sirene open data + un delta quotidien, PAS par
l'API de recherche paginée.**

- **Source PRIMAIRE d'exhaustivité** : `sireneStockIngestor` télécharge les fichiers Stock, les
  stream-parse (CSV) et fait un **bulk-upsert par batch** (`createMany skipDuplicates` /
  `INSERT … ON CONFLICT` via table de staging). Un download + bulk-load se compte en **heures**, là
  où un balayage API de ~10 M d'unités se compterait en **semaines** de crawl fragile — **facteur
  ~×100** en faveur du Stock.
- **Fraîcheur** : `sireneDeltaWorker` ingère quotidiennement les créations / cessations /
  changements (filtre `dateDernierTraitement > lastSync`). Sans ce delta, une base « exhaustive » se
  périme en quelques semaines.
- **L'API de recherche est reléguée au CIBLAGE / UX à la demande**, pas à la collecte de masse :
  résolution d'une cellule précise, aperçu du volume dans le wizard de campagne, requêtes ad hoc,
  récupération de dirigeants et du siège. Complétée par l'API Sirene portail (`curseur=*`, sans
  plafond 10 000) pour les vérifications ponctuelles, et par INPI RNE / Annuaire administration /
  BODACC / BAN pour l'enrichissement (cf. §6.1, §16).

### Corollaires structurants (partie intégrante de la décision)

- **Dénombrement autoritatif** : le Stock fournit le **dénominateur de référence** `StockReference`
  (§5.12) = nombre exact d'entreprises attendues par (`departement`, `naf`, `taille`,
  `typeOrganisation`). `CoverageCell.attendu` = compte réel (probe count), **jamais un « estimé »**.
  Règle d'acceptation d'une cellule : `collecte ≥ attendu` (tolérance documentée pour les cessations
  concurrentes), **sinon `erreur` + alerte, jamais `fait`**. KPI de tête = **écart d'exhaustivité**
  (Σattendu − Σcollecté).
- **Cellules paresseuses** : ne créer une `CoverageCell` que pour les triplets **non vides** (probe
  count > 0) → évite ~1 M de lignes fantômes.
- **Rate-limit distribué RÉEL** (pour le résiduel API de ciblage, cf. §6.2 P0-4) : une **file BullMQ
  par source** avec `limiter:{max,duration}` + **token-bucket Redis partagé** pour tenir 7 req/s
  **global** malgré la concurrence, et respect de l'en-tête `Retry-After` sur 429. Un simple nombre
  en `SiteSetting` **ne suffit pas** (il ne coordonne pas plusieurs workers concurrents).
- **Idempotence sans piège BullMQ** (§6.2 P0-5) : **la DB est la seule source de vérité** (état
  `CoverageCell`). Les jobs sont **éphémères** (`removeOnComplete`, `removeOnFail` borné) OU portent
  un **nonce d'attempt** dans le jobId (`cell:<id>:run:<runId>`), pour éviter le **no-op silencieux
  d'un `add()` sur un jobId déjà existant** — bug de production **documenté sur content-gen** (un
  `add()` avec un jobId déjà présent dans `failed` est ignoré et le retry n'a jamais lieu). Test
  d'intégration « re-enqueue après failed » **obligatoire**.

## Alternatives considérées

### Alternative A — API de recherche paginée avec découpage adaptatif (REJETÉE comme mécanisme de masse)

Balayer toute la France via l'API de recherche, en subdivisant récursivement chaque requête qui
atteint le plafond (NAF section → division → classe → sous-classe → tranche effectif → commune →
en dernier repli fenêtrage déterministe sur SIREN/dateCreation).

**Pourquoi rejetée pour la collecte de masse :**

- **Plafond de 10 000 résultats/critère** : impose un découpage très fin et un risque permanent de
  **troncature silencieuse** à 10 000 (perte d'exhaustivité non détectée).
- **~7 req/s** : balayer ~~10 M d'unités = des **semaines** de crawl (~~×100 plus lent que le Stock).
- **Fragilité** : un crawl multi-semaines est exposé aux 429, aux changements de schéma API, aux
  coupures — reprise complexe, débit imprévisible.
- **Charge inutile** sur une API publique gratuite (loyauté/écocitoyenneté d'usage).

Le **découpage adaptatif n'est pas jeté** : il est **conservé en résiduel** pour le mode ciblage API
uniquement (résoudre une cellule précise sans jamais tronquer à 10 000), pas pour balayer la France.

### Alternative B — Source de données payante (Pappers, Dropcontact, etc.) — REJETÉE

Hors périmètre par décision Will (0 payant, cf. ADR-0003). Non retenue.

### Alternative C — Scraping d'annuaires / SERP pour l'exhaustivité — REJETÉE

Illégal/déloyal (CGU, ban), et inutile puisque le Stock Sirene est officiel, gratuit et exhaustif.
Interdit par ailleurs au titre RGPD/CGU (cf. ADR-0002 et §16).

## Conséquences

### Positives

- **Exhaustivité native** : on charge l'intégralité du Stock → pas de plafond de pagination à
  contourner ; l'exhaustivité est **prouvée par le dénombrement** (`StockReference`), pas déclarée.
- **~×100 plus rapide** : bulk-load en heures vs crawl en semaines.
- **Dénominateur autoritatif gratuit** pour tous les taux (complétion, contactabilité) à 3 niveaux
  (dép → région → France).
- **Robustesse** : la reprise sur panne s'appuie sur l'état DB des cellules, pas sur un curseur API
  fragile.
- **Charge minimale sur les API publiques** : l'API de recherche n'est plus sur le chemin critique.

### Négatives

- **Coût infra non nul** (le « 0 € » ne concerne que les API) : bulk-load de ~4 Go, staging Postgres,
  10-30 M lignes, mémoire Redis, `REFRESH` de vues matérialisées → à sizer honnêtement (§8), avec
  bench/charge avant généralisation (req/s soutenu, lignes/s en écriture, wall-clock France entière,
  soak-test 24 h).
- **Complexité d'ingestion** : stream-parse CSV + staging + `ON CONFLICT` + delta quotidien =
  pipeline à construire (workers `stock-ingestor` + `delta-worker`, cron).
- **Latence de fraîcheur** : Stock mensuel + delta quotidien → fenêtre de fraîcheur à documenter
  (`refreshAfter`, §6.5) ; les cessations/créations du jour même ne sont visibles qu'au delta suivant.
- **Dépendance au format INSEE** : un changement de schéma des fichiers Stock impose une adaptation
  (validation Zod + circuit breaker recommandés, §8).
- **Contrainte de build `stub.invalid` (ADR 0026 axionia)** : `stock-ingestor` et `delta-worker`
  doivent être **stub-aware** (early-exit si `DATABASE_URL`/`REDIS_URL` contiennent `stub.invalid`) —
  aucun download ni appel réseau au build SSG.

## Suivi

- **STOP & ASK Will** : confirmer les endpoints/quotas Sirene au T0 (migration vers `portail-api.insee.fr`).
- Cadence de re-sync du Stock, fenêtre de fraîcheur `refreshAfter`, périmètre établissements (siège
  seul en V1 ou tous, §14 Q8) → à trancher avant T3.
- Test d'intégration « re-enqueue après failed » à écrire dès T4 (garde-fou piège BullMQ).
