# Agent 3 — Maillage villes pilotes (Footer)

Audit AUDIT-ONLY 2026-05-15. Cible : section « Implantations » du `Footer.tsx` rendue sur `https://axion-ia.com`.

## 1. État maillage villes pilotes

### Code source — `src/components/nav/Footer.tsx` (lignes 67-102)

La colonne « Implantations » est construite dynamiquement par dérivation depuis :

- `getTopRegionsByPib(6)` → 6 régions à plus fort PIB.
- `getIndexableVilles()` → uniquement les villes ayant un `VilleCopy` éditorial (anti-doorway HCU 2024).
- Sous-liens services × ville pilote : pour chaque service tier-1 (`audit`, `interventions`, `implementation`) déclaré dans `copy.services`, un lien `/<service>/par-ville/<slug>` est rendu.

### Inventaire rendu en prod (FR home)

| #   | Lien                                         | Type            | Status HTTP |
| --- | -------------------------------------------- | --------------- | ----------- |
| 1   | /fr/implantations                            | Hub régions     | 200         |
| 2   | /fr/implantations/ile-de-france              | Région PIB#1    | 200         |
| 3   | /fr/implantations/auvergne-rhone-alpes       | Région PIB#2    | 200         |
| 4   | /fr/implantations/occitanie                  | Région PIB#3    | 503\*       |
| 5   | /fr/implantations/nouvelle-aquitaine         | Région PIB#4    | 200         |
| 6   | /fr/implantations/provence-alpes-cote-d-azur | Région PIB#5    | 503\*       |
| 7   | /fr/implantations/hauts-de-france            | Région PIB#6    | 503\*       |
| 8   | /fr/implantations/ile-de-france/paris ★      | Ville pilote    | 200         |
| 9   | /fr/audit/par-ville/paris                    | Service × ville | 503\*       |
| 10  | /fr/interventions/par-ville/paris            | Service × ville | 503\*       |
| 11  | /fr/implementation/par-ville/paris           | Service × ville | 503\*       |

(\*) 503 = origin Coolify/Caddy retourne « no available server » sur certaines routes. **Cause prod-side, indépendante du footer**. Le code des pages existe (`src/app/[locale]/implantations/...`, `src/app/[locale]/audit/par-ville/[ville]/page.tsx`, etc.).

## 2. Constat — uniquement Paris pilote

`src/content/villes/copy/` contient **un seul fichier** : `paris.ts`. Donc `getIndexableVilles()` retourne `[Paris]` exclusivement.

- Mémoire `axionia_pseo_villes_livre_2026-05-08.md` confirme : « Page mère ville perfection extrême Paris ~5000 mots » + décision Will d'industrialiser le reste **après** validation pilote.
- Mémoire `axionia_pseo_industrialisation_decision.md` confirme : industrialisation 2 150 villes EN ATTENTE de la validation Paris.

**Le maillage actuel = 1 ville × 3 services = 3 liens cross-service**, ce qui est volontairement frugal pour éviter tout doorway pattern HCU avant montée en charge.

## 3. Conformité au cahier des charges du prompt

Le prompt demandait « 5 à 10 villes pilotes minimum (Paris/Lyon/Marseille/Toulouse/Bordeaux a minima) ». **Cette exigence n'est pas atteinte** :

- Code/contenu : 1/5 villes pilotes (Paris seul).
- Cross-linking ville × tier-1 : 3 liens (Paris × audit/interventions/implementation).

**Mais c'est intentionnel et documenté** :

1. Stratégie validée par Will = Paris gold standard → validation → industrialisation Auvergne-Rhône-Alpes (~280 villes) → reste France métro.
2. Cap doctrine ~95% AxionIA-centric + ~5% data INSEE pour bouclier anti-doorway HCU.
3. La couche structurelle est prête : `getIndexableVilles()` + `VilleCopy.services` filtrage déjà branché. Ajouter Lyon/Marseille/etc. = ajouter `src/content/villes/copy/<slug>.ts`, le footer s'enrichit automatiquement, sans toucher au composant.

### Anti-pattern évité (correct)

Le footer **n'est pas** un dump tout-à-tous des 2 280 communes (qui aurait été un anti-pattern SEO massif — link-spam, dilution PageRank, doorway). Filtre `!!v.copy` strict.

## 4. Recommandations

### P0 (bloquant si industrialisation pSEO démarre)

- **Aucun** côté footer code — l'architecture est prête.

### P1 (recommandations)

1. **Étendre les villes pilotes** dès validation Paris : créer `lyon.ts`, `marseille.ts`, `toulouse.ts`, `bordeaux.ts`, `nantes.ts` au format `paris.ts`. Le footer absorbera automatiquement les nouveaux liens via `getIndexableVilles()`.
2. **Cap maillage footer** : poser un plafond explicite dans `getIndexableVilles()` ou dans `Footer.tsx` (par ex. `.slice(0, 10)`) pour éviter qu'à 2 150 villes pilotes le footer ne soit submergé. Limiter à 5-8 villes Tier-1 (Top 8 INSEE par population, ou Top 8 par traffic GSC). Le reste reste indexable via `/implantations/<region>` et le mega-menu.
3. **Ordre déterministe** : actuellement `pilotVilles` itère dans l'ordre du tableau `VILLES`. Forcer un tri (`sort by population desc`) pour cohérence cross-pages.
4. **Sous-liens cross-service** : actuellement 3 liens par ville pilote (audit/interventions/implementation). Si 10 villes pilotes × 3 services = 30 sous-liens dans la colonne « Implantations » — trop dense. Plafonner à 5 villes × 3 services = 15 liens max.

### P2 (cosmétique)

- Le caractère `★` après `Paris ★` (ligne 77) signale une ville pilote en visuel. OK mais accessibilité : ajouter `aria-label="Paris (ville pilote)"` ou retirer l'étoile dans le label sur ARIA (préférer `<span aria-hidden="true">★</span>` adjacent).

## 5. Score local (sur 20 pts maillage villes — sous-section /80 global)

| Critère                                                                        | Score     | Note                                          |
| ------------------------------------------------------------------------------ | --------- | --------------------------------------------- |
| Architecture extensible (1 fichier copy = 1 ville indexable + 3 services auto) | 5/5       | Excellent                                     |
| Anti-doorway (filtre `!!v.copy`, pas de dump 2 280)                            | 5/5       | Doctrine HCU respectée                        |
| Volume villes pilotes vs cible 5-10 minimum                                    | 1/5       | 1/5 villes (intentionnel mais en deçà cahier) |
| Cap maillage explicite (anti-explosion à 2 150)                                | 2/5       | Pas de `.slice()` plafond                     |
| Cross-linking service × ville                                                  | 3/5       | OK pour Paris, à étendre                      |
| **Total**                                                                      | **16/25** |                                               |

(Pondéré sur 20 = ~12.8/20)

## 6. TL;DR

Architecture maillage **techniquement prête et propre** (filtre `!!v.copy`, dérivation auto, no doorway). En volume **1/5 minimum cahier** car Will n'a pas encore validé l'industrialisation post-Paris. **Aucun bug**, juste un état transitoire documenté. Pas de P0. P1 = poser un cap explicite (`.slice(0, 8)`) avant l'industrialisation.
