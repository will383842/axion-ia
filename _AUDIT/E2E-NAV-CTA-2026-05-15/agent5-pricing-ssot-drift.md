# Agent 5 — Drift pricing.ts SSOT ↔ CTAs prod (2026-05-15)

SSOT : `axionia/src/content/pricing.ts` (Sprint 14.10.5+).

## Rappel SSOT canonique (extrait)

| Catégorie      | Tier                                             | Prix                           |
| -------------- | ------------------------------------------------ | ------------------------------ |
| Audit          | Flash distance                                   | **490 € HT**                   |
| Audit          | Flash terrain (sur site)                         | **890 € HT**                   |
| Audit          | Ciblé Solo / Standard / Avancé                   | **1 900 / 2 900 / 3 900 € HT** |
| Audit          | Stratégique PME 20-50 / 50-250                   | **4 900 / 9 900 € HT**         |
| Audit          | Stratégique ETI base                             | **12 000 € HT**                |
| Intervention   | 4h (Démarrage Express / Atelier ciblé)           | **390 € HT**                   |
| Intervention   | Essentielle 1j (Intimiste / Standard / Complète) | **490 / 790 / 1 190 € HT**     |
| Intervention   | Gagner du temps 1j                               | **990 € HT**                   |
| Intervention   | Approfondie 2j (×3 sous-tiers)                   | **880 / 1 420 / 2 140 € HT**   |
| Intervention   | Dirigeants 1j                                    | **990 € HT**                   |
| Intervention   | Conférence                                       | Sur devis                      |
| Intervention   | Claude (2-8 pers)                                | **690 € HT**                   |
| Implementation | POC                                              | **990 – 4 900 €**              |
| Implementation | Mission PME                                      | **8 000 – 25 000 €**           |
| Implementation | Mission ETI                                      | **25 000 – 80 000 €**          |
| Implementation | IA custom                                        | **8 000 – 50 000 €**           |
| Maintenance    | Standard                                         | **290 € HT/mois**              |

## Drifts constatés en prod

### DRIFT 1 — HOME "Démarrer · 390 €" → `/fr/interventions/essentielle`

**Sévérité : ROUGE (HCU + cohérence)**

- **CTA hero home FR** affiche label `Démarrer · 390 €` (correct vs SSOT : 390 € = tier `intervention-4h` qui EST bien le tier d'entrée du catalogue `INTERVENTION_TIERS`).
- **MAIS** le `href` pointe vers `/fr/interventions/essentielle` qui démarre à **490 € HT** (tier Essentielle Intimiste).
- **Origine code** : `src/app/[locale]/page.tsx:241` `<Link href="/interventions/essentielle">`. Le label dérive correctement via `getEntryPriceEur(INTERVENTION_TIERS)` (= 390), mais l'URL ne suit pas (devrait pointer vers `/fr/interventions/demarrage-ia-express` ou `/fr/interventions/atelier-ia-cible` qui sont à 390 € ; OU vers le hub `/fr/interventions/collectives/4h`).
- **Impact** : utilisateur attiré par 390 € arrive sur page à partir de 490 €, sans aucune mention du 390 € dans le hero d'arrivée → friction + risque rebond.
- **Fix** : changer href en `/fr/interventions/collectives/4h` (palier 4h listing) ; conserver label `Démarrer · 390 €`.

### DRIFT 2 — Header global "Réserver…· À partir de 390 €"

**Sévérité : ORANGE**

- Le header affiche `À partir de 390 €` (entry catalogue intervention OK), mais lie vers `/fr/reserver` qui aujourd'hui est **503** ET, s'il était UP, mène au calendrier global sans intervention=demarrage-ia-express présélectionnée. Le visiteur ne retrouvera pas le 390 € en tête du booking flow.
- **Fix** : préfixer le href par `?intervention=demarrage-ia-express` OU créer un step "choix format" en tête de `/reserver`.

### DRIFT 3 — `/fr/implantations/ile-de-france/paris` CTA "Voir le calendrier · 490 €" pour Interventions IA

**Sévérité : ORANGE**

- Label `490 €` pour Interventions IA est techniquement le prix Essentielle, mais le catalogue intervention démarre à **390 €** (4h). Le copy promet donc plus cher que le prix d'entrée réel.
- **Fix** : harmoniser sur `À partir de 390 €` OU `Essentielle 490 €` (cohérent format-by-format), pas le mix.

### DRIFT 4 — `/fr/audit/flash` CTA secondaire "Essentielle · 390 €"

**Sévérité : ROUGE**

- Le CTA cross-sell pointe vers `/fr/interventions/essentielle` avec label `390 €` MAIS Essentielle = **490 €** (pas 390 €). 390 € = le format 4h, pas Essentielle 1j.
- **Origine probable** : copy hardcodé qui n'a pas suivi le refactor SSOT.
- **Fix** : mettre `Essentielle · ${getEntryPriceEur([essentielleTier])} = 490 €` OU rediriger label sur tier 4h.

### DRIFT 5 — `/fr/comparaisons` mention "390-490 €"

**Sévérité : VERT (acceptable mais ambigu)**

- Range correct (390 = 4h, 490 = essentielle entry) mais peu lisible. Cohérent avec SSOT.

### DRIFT 6 — Page `/fr/audit` CTA "Réserver un Flash terrain · 890 €"

**Sévérité : VERT (cohérent SSOT)**

- 890 € = `priceFlatOnsite` de Audit Flash. Correct.

### DRIFT 7 — Pages villes pSEO `/fr/audit/par-ville/{lyon,marseille}`

**Sévérité : ORANGE**

- Header annonce `À partir de 390 €` (intervention entry) sur des pages **AUDIT**. Drift catégoriel : sur une page audit, le prix d'entrée à afficher est **490 €** (Audit Flash distance), pas 390 €.
- **Fix** : le header global devrait être catégorie-aware (afficher 490 € sur sous-arbre audit, 390 € sur sous-arbre intervention).

### DRIFT 8 — Mention "490 €" pour Audit Flash sur Paris vs 490 € catalog Essentielle

**Sévérité : VERT**

- `/fr/implantations/ile-de-france/paris` affiche `Audit Flash · 490 €` (correct vs SSOT) et `Interventions IA · 490 €` (cf. DRIFT 3). Le 490 € est ambigu car partagé par 2 tiers différents — pas une erreur stricte.

## Synthèse drifts

| #   | Sévérité | Localisation              | Type                   |
| --- | -------- | ------------------------- | ---------------------- |
| 1   | ROUGE    | Home hero CTA primary     | label/href mismatch    |
| 2   | ORANGE   | Header global → /reserver | déstabilisation funnel |
| 3   | ORANGE   | Paris pSEO                | catégorie ambiguë      |
| 4   | ROUGE    | /audit/flash cross-sell   | prix faux              |
| 5   | VERT     | /comparaisons             | range cohérent         |
| 6   | VERT     | /audit Flash terrain      | correct                |
| 7   | ORANGE   | villes audit pSEO         | drift catégoriel       |
| 8   | VERT     | Paris Audit Flash         | correct                |

**Total ROUGE = 2, ORANGE = 3, VERT = 3.** Le code dérive correctement de pricing.ts dans les composants core ; les drifts sont concentrés sur les liens hardcodés vers Essentielle dans la home et les cross-sells.
