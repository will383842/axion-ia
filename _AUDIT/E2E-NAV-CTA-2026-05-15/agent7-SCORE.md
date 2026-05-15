# Agent 7 — In-content links · SCORE & TL;DR

## Score : **58 / 100** — 🟠 ORANGE (gaps significatifs, ne bloque pas la prod mais impact SEO/AEO réel)

### Décomposition (poids dans le master prompt)

| Critère                                                  |   Poids |  Score | Note                                                                                    |
| -------------------------------------------------------- | ------: | -----: | --------------------------------------------------------------------------------------- |
| Anchor text quality (anti-patterns `cliquez ici` etc.)   |      20 | **20** | ✅ ZÉRO occurrence sur 66 anchors — discipline exemplaire                               |
| `rel="noopener"` sur liens externes                      |      10 | **10** | ✅ N/A — pas de liens externes (mais voir critère externes)                             |
| Anchors `#section` non cassées                           |      10 | **10** | ✅ Aucun ID manquant                                                                    |
| Pas de liens vers concurrents                            |       5 |  **5** | ✅ Conforme                                                                             |
| Liens externes autoritaires (INSEE, gouv.fr, EU AI Act…) |      15 |  **0** | 🔴 ZÉRO citation externe sur 14 pages — AEO/GEO penalty                                 |
| Densité in-content (tier-1 vers services)                |      15 |  **8** | 🟠 OK sur Paris pilote / FAQ / guides ; thin sur case-studies & pSEO villes non-pilotes |
| Couverture sample auditable (200 OK)                     |      15 |  **2** | 🔴 13/27 pages = 503 → seulement 52 % du sample testable                                |
| Variation anchor text cross-pages                        |       5 |  **3** | 🟡 OK mais répétitions visibles ("Voir l'Essentielle →" présent identique sur 4 pages)  |
| Listings exposent liens vers détails                     |       5 |  **0** | 🔴 `/fr/actualites` = 0 lien in-content                                                 |
|                                                          | **100** | **58** |                                                                                         |

---

## TL;DR

L'audit anchor-text in-content est **paradoxal** : sur les 14 pages parsables (52 % du sample, le reste = 503 prod), la **qualité intrinsèque des anchors est excellente** (0 anti-pattern type "cliquez ici", 0 noopener manquant, 0 anchor cassée, 0 lien vers concurrent). MAIS deux gaps structurels lourds tirent le score :

1. **Zéro lien externe autoritaire** sur tout l'échantillon → signal E-E-A-T faible 2026.
2. **48 % des URLs cibles retournent 503** en prod (route `/fr/connaissances/[slug]` non implémentée + bugs runtime sur 8 autres routes) → audit inlinks partiel.

Le maillage interne est **deux vitesses** : Paris pilote (21 liens, 13 tier-1) est gold-standard ; les autres pSEO villes et case-studies sont thin (1-2 liens). C'est consistent avec la roadmap "Paris d'abord, industrialiser après".

---

## Top 5 findings

| #   | Finding                                                                                       | Sévérité | Action                                                                                                 |
| --- | --------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| 1   | **13 / 27 URLs = HTTP 503 prod** (incl. KB V4 route absente + 8 routes runtime-cassées)       | 🔴 P0    | Corriger routes 503 (audit forensique séparé) + créer `/fr/connaissances/[slug]` ou retirer du sitemap |
| 2   | **0 lien externe sortant** sur 14 pages OK → no INSEE/gouv.fr/AI Act citation                 | 🔴 P0    | Ajouter 1-3 sources autoritaires par article/FAQ/guide                                                 |
| 3   | **`/fr/actualites` listing = 0 lien in-content** (page vide)                                  | 🔴 P0    | Fallback "voir le blog" ou noindex tant que table `Article isNews=true` vide                           |
| 4   | **Case-studies ultra-thin** : 1 lien in-content / 0 externe / densité 0.4                     | 🟠 P1    | Ajouter "Cas similaires" + "Ressources liées" + 1-2 citations                                          |
| 5   | **pSEO villes hors Paris sous-maillées** : Lyon=2 liens, Marseille=2 liens vs Paris pilote=21 | 🟠 P1    | Aligner les 2 156 villes sur le standard Paris AVANT industrialisation                                 |

---

## Faux positifs / Notes méthodo

- **`[email protected]` anchor text** : artefact Cloudflare Email Obfuscation, pas un bug code.
- **`<main>` vide à la lecture brute** : Next 16 streaming RSC ; le test utilise `JSDOM runScripts:'dangerously'` pour matérialiser les `<template id="B:N">` injectés par `$RC(…)`. Sans ça, le test aurait montré 0 lien partout.
- **/fr/connaissances/[slug]** : route publique inexistante en code. Soit (a) la KB est admin-only et NE DOIT PAS apparaître dans le master prompt, soit (b) la route publique doit être créée. À arbitrer avec Will.
