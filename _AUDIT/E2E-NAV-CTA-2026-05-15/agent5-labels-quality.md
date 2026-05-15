# Agent 5 — Qualité labels CTAs (2026-05-15)

Mode AUDIT-ONLY. Grep code + inspection HTML rendu prod.

## Anti-patterns SEO/UX

| Anti-pattern                               | Occurrences code           | Occurrences prod observées |
| ------------------------------------------ | -------------------------- | -------------------------- |
| `cliquez ici` / `cliquer ici`              | **0**                      | 0                          |
| `click here` / `here` (en bouton)          | **0**                      | 0                          |
| Labels vides / aria-label manquant sur Cta | non auditable côté agent   | À vérifier Playwright      |
| "En savoir plus" générique                 | non détecté                | non détecté                |
| "Voir plus"                                | non détecté                | non détecté                |
| "Découvrir" générique sans complément      | non détecté en prod sample | OK                         |

**Verdict catégorie anti-patterns : VERT**. Le code respecte les guidelines SEO.

## Variation cross-pages

Inventaire des labels de CTA primary `→ /fr/reserver` observés sur 16 pages :

| Label                                                        | Pages                                                     | Cohérence                        |
| ------------------------------------------------------------ | --------------------------------------------------------- | -------------------------------- |
| **Réserver une intervention ou un audit IA**                 | header global sur **toutes** les pages                    | Très cohérent (canonical header) |
| Réserver une intervention ou un audit IA · À partir de 390 € | versions avec prix injecté (mobile sans doute)            | OK                               |
| Pré-réservez sur le calendrier                               | /fr/interventions, /fr/interventions/collectives          | Spécifique funnel                |
| Ouvrir le calendrier                                         | /fr/interventions                                         | Variation interne page           |
| Réserver une intervention                                    | /fr/interventions/essentielle (hero + booking section ×2) | OK                               |
| Réserver à ce tarif                                          | Sub-tiers grille tarifaire essentielle                    | OK contextuel                    |
| Réserver un Flash terrain · 890 €                            | /fr/audit                                                 | Spécifique format + prix injecté |
| Réserver sur le calendrier                                   | /fr/audit/flash                                           | Variation acceptable             |
| Pré-réserver cette mission                                   | /fr/audit/flash                                           | OK                               |
| Choisir un format Flash                                      | /fr/audit/flash                                           | OK pédagogique                   |
| Démarrer · 390 €                                             | Home FR hero                                              | Variant unique acceptable        |
| Demander un audit Flash · 490 €                              | Paris pSEO                                                | OK                               |
| Voir le calendrier · 490 €                                   | Paris pSEO                                                | OK                               |
| Discuter d'un projet                                         | Paris pSEO                                                | OK                               |
| Réserver à Paris · 490 €                                     | Paris pSEO                                                | OK                               |

**Cohérence cross-pages : BON** — chaque variation est contextualisée (format/prix/ville) sans devenir générique. Pas de variation aléatoire.

## Cohérence sémantique label ↔ destination

| Label                                        | Destination                                    | Cohérent ?                                                 |
| -------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------- |
| Démarrer · 390 €                             | /fr/interventions/essentielle (≥490 €)         | **NON — drift prix** (cf agent5-pricing-ssot-drift §1)     |
| Essentielle · 390 € (sur /fr/audit/flash)    | /fr/interventions/essentielle (≥490 €)         | **NON — drift prix** (cf §4)                               |
| Réserver une intervention ou un audit IA     | /fr/reserver                                   | OK sémantique (mais 503 actuellement)                      |
| Voir l'Essentielle 490 €                     | /fr/interventions/essentielle                  | OK                                                         |
| Voir l'Essentielle 390 € (si encore présent) | /fr/interventions/essentielle                  | NON — à vérifier (sample showed 390 et 490 sur diff pages) |
| Lancer le simulateur                         | /fr/roi                                        | OK sémantique (mais 503 actuellement)                      |
| Voir le calendrier · 490 € (Paris)           | /fr/reserver?ville=paris&service=interventions | OK label, drift catégoriel léger (390 € existe)            |

## Labels secondaires "Voir tout sur X"

Pattern observé sur Paris pSEO : **"Voir tout sur Audit IA / Interventions IA / Implémentation IA"**. Acceptable, mais répétitif (3 fois sur même page). Pourrait varier (`Explorer les audits IA` / `Découvrir les formats équipes` / `Lire le détail des implémentations`).

## CTAs primary count above-the-fold

GATE ROUGE = > 3 CTAs primary concurrents above-the-fold.

| Page                                  | Primary above-the-fold                                                                                                    | Verdict                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| /fr                                   | 2 ("Démarrer · 390 €" + header "Réserver…")                                                                               | OK                                                 |
| /fr/interventions                     | 3 (header + "Pré-réservez calendrier" + secondary peut compter selon style)                                               | LIMITE                                             |
| /fr/interventions/collectives         | 2                                                                                                                         | OK                                                 |
| /fr/interventions/essentielle         | 3+ (header + hero × 2 + booking section) → above-the-fold = 2-3                                                           | LIMITE                                             |
| /fr/audit                             | 3 (header + "Réserver Flash terrain 890 €" + "Demander cadrage")                                                          | LIMITE OK                                          |
| /fr/audit/flash                       | 4+ → above-the-fold probablement 2-3 visibles                                                                             | LIMITE                                             |
| /fr/implementation                    | 2 ("Décrire mon besoin" + "Commencer par un audit")                                                                       | OK                                                 |
| /fr/implantations/ile-de-france/paris | **4 primary above-the-fold** ("Audit Flash 490 €" + "Voir calendrier 490 €" + "Discuter projet" + "Réserver Paris 490 €") | **ROUGE** — 4 CTAs concurrents diluent l'attention |

**Page rouge identifiée : `/fr/implantations/ile-de-france/paris`** — 4 CTAs primary above-the-fold visent presque tous la même URL (`/fr/reserver?ville=paris…`) avec variations service. Hiérarchie de conversion non claire.

## Tracking analytics

Le composant `Cta` (`src/components/marketing/Cta.tsx`) accepte une prop `track` émise comme `data-cta="…"` sur le DOM. **MAIS** aucune occurrence de `track="…"` dans les pages auditées : `grep "data-cta"` retourne 10 fichiers seulement (composants infra + Header/Footer/StickyMobileCta + 2 templates ville/implantations). Les pages produit (interventions/essentielle, audit/flash, etc.) **ne passent PAS de prop `track`** à leurs Ctas → aucun tracking analytics sur les conversions principales.

**Sévérité : ORANGE** — pas de gate rouge mais bloque le tracking funnel data-driven. Plausible/Clarity captureront page-views mais pas l'attribution CTA.

## Synthèse labels

| Critère                              | Verdict                                                 |
| ------------------------------------ | ------------------------------------------------------- |
| Anti-patterns "cliquez ici"          | VERT (0)                                                |
| Variation cross-pages                | VERT                                                    |
| Cohérence label ↔ destination prix   | **ROUGE (2 drifts)**                                    |
| Above-the-fold ≤ 3 primary           | **ROUGE 1 page** (`/implantations/ile-de-france/paris`) |
| Tracking `data-cta` sur CTAs primary | **ORANGE (manque sur pages produit core)**              |
