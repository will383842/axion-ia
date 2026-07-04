# 03 — Suivi, statistiques & reporting

> Spec de conception. Source de vérité : `PLAN-DIRECTEUR-V1.md` §4.2, §5.5, §5.12, §6.3, §10.
> Objectif clé : **vrai suivi par département de ce qui a été scrapé** + **% de contacts utilisables VS
> toutes les entreprises**, décliné **département → région → France**.

## 1. Principe : la matrice de couverture EST la work-list

La collecte est découpée en `CoverageCell` (dép × NAF/secteur × taille × typeOrganisation). Chaque
cellule a un état (`a_faire | en_cours | fait | erreur`) + compteurs (`attendu`, `collecte`, `enrichi`).
L'orchestrateur ne traite que `a_faire`/`erreur` → collecte **reprise-sur-panne, mesurable, exhaustive**.

## 2. Couche de stats agrégées (indépendante des campagnes)

### StockReference — dénominateur autoritatif

Totaux **attendus** par (`departement`, `naf`, `taille`, `typeOrganisation`), issus du **Stock Sirene**.
Champs : `stockAttendu`, `stockRefreshedAt`. Re-sync périodique. C'est le dénominateur commun de tous
les taux (répond à « ai-je récupéré TOUTES les entreprises ? »).

### GeoCoverageStat — rollup 3 niveaux (**table rollup Prisma — décision verrouillée**)

> **Décision (levée de l'ambiguïté MV vs table)** : `GeoCoverageStat` est une **table Prisma** (modèle
> normal, migration additive), maintenue **incrémentalement par `coverage-worker`** et **recalculable
> depuis `COUNT` réel** (anti-dérive, test T4 `06-MATRICE`). Choix Prisma-natif → pas de migration SQL
> brute. Une **vue matérialisée** reste un _optimisation optionnelle_ documentée si un scope lourd le
> justifie (mesuré, pas par défaut). L'implémenteur ne re-tranche pas ce point.
> Clé : (`scope` ∈ `departement | region | france`, `scopeId`, + optionnel `secteur`/`taille`/`typeOrganisation`).
> Champs : `stockAttendu`, `collectees`, `enrichies`, `exploitables`, `partiels`, `nonContactables`,
> `pctCompletion`, `pctExploitableSurCollectees`, `pctExploitableSurStock`, `pctPerime`, `refreshedAt`.
> Rafraîchie par `coverage-worker` en **rollup** (mapping `departement-to-region.ts` SSOT). Alimente carte

- KPI France + coverage-map.

### StatsSnapshot — série temporelle

(`date`, `scope`, `scopeId`, compteurs). Écrit **quotidiennement**. Source des **courbes de progression**,
du débit historisé, de l'ETA et de la détection d'anomalie. Évite de scanner des millions d'events.

## 3. Formules (explicites)

| Métrique                            | Formule                       | Question métier                                           |
| ----------------------------------- | ----------------------------- | --------------------------------------------------------- |
| **Complétion collecte**             | `collectees / stockAttendu`   | « toutes les entreprises du dép sont-elles récupérées ? » |
| **Contactabilité (sur collectées)** | `exploitables / collectees`   | qualité de ce qu'on a                                     |
| **Contactabilité (sur stock)**      | `exploitables / stockAttendu` | **% de contacts utilisables VS toutes les entreprises**   |
| **Écart d'exhaustivité**            | `Σattendu − Σcollecté`        | KPI de tête (reste à collecter)                           |
| **Fraîcheur**                       | `pctPerime`, `dueForRefresh`  | dette de mise à jour                                      |
| **Débit / ETA**                     | entreprises/h ; temps restant | pilotage (dép + France)                                   |

Déclinaison par **secteur** et **taille** en plus du géo. Nuance **`exploitable_nominatif`** (email d'un
responsable nommé) vs **`exploitable_generique`** (contact@ seul) → pèse dans `leadScore`
(barèmes SSOT `scoring.ts`, poids configurables SiteSetting).

## 4. Tableaux de bord & visualisations

- **Dashboard** (`/prospection`) : collecté aujourd'hui/total, enrichis, erreurs, campagnes actives,
  bandeau France (complétion %, contactabilité %), âge des chiffres (« à jour il y a X min ») + bouton rafraîchir.
- **Coverage-map** (`/prospection/couverture`) : matrice dép × secteur × taille (cellules colorées) +
  **bandeau France** + **bascule/roll-up Région** + drill-down France→région→dép→cellule + **export du
  rapport de stats** (CSV/PDF).
- **Carte choroplèthe** (`/prospection/carte`) : France par dép/région, 2 modes (complétion % /
  contactabilité %). **SVG statique + GeoJSON léger — PAS Leaflet/Mapbox** (Web Vitals).
- **Courbes** : progression et débit dans le temps (depuis `StatsSnapshot`).

## 5. Détection d'anomalies & alertes

`coverage-worker` compare le snapshot du jour aux précédents → alertes (in-console + email) sur seuils
SiteSetting : débit −X %, taux 0 anormal (source renvoie vide — incident type stub documenté),
cellule `en_cours` stale > N h, quota atteint, source down. Ces alertes sont surfacées sur le
**Dashboard** (`/prospection`, bandeau santé) et tracées dans le **Journal** (`/prospection/journal`) —
pas de route dédiée séparée.

## 6. Performance

Agrégats **précalculés** dans la table `GeoCoverageStat` (compteurs incrémentaux maintenus par
`coverage-worker`, recalcul périodique depuis `COUNT`) — **jamais** `COUNT GROUP BY` live sur 10–30 M
lignes à chaque rendu (INP/lhci admin). Vue matérialisée = optimisation optionnelle si mesurée nécessaire.
**Keyset pagination** partout. Cache Redis pour le dashboard (TTL court + âge affiché).

## 7. Anti-dérive des compteurs

Le `coverage-worker` **recalcule depuis la source de vérité** (COUNT indexé), ne fait pas qu'incrémenter
les dénormalisés, et **logue tout écart** (incident récurrent documenté sur content-gen). Test
d'intégration « pas de dérive » (voir `06-MATRICE-ACCEPTATION.md`).
