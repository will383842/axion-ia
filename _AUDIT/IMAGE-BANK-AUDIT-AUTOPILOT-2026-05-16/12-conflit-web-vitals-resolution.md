# Phase 1 — Conflit Web Vitals AGENTS.md vs lighthouserc.json (GAP-05 / GAP-27)

## Constat

| Métrique       | AGENTS.md `axionia/AGENTS.md:9-23` | `axionia/lighthouserc.json:27-39` |
| -------------- | ---------------------------------- | --------------------------------- |
| LCP p75        | ≤ 1 800 ms                         | ≤ 1 800 ms ✅ aligné              |
| **INP p75**    | **≤ 100 ms**                       | **≤ 80 ms** 🔴 écart 20 ms        |
| **CLS**        | **= 0** (strict absolu)            | **≤ 0.05** 🔴 écart               |
| TBT            | ≤ 150 ms                           | ≤ 150 ms ✅ aligné                |
| FCP            | —                                  | ≤ 1 500 ms                        |
| Speed Index    | —                                  | ≤ 2 500 ms                        |
| Perf score     | —                                  | ≥ 95 %                            |
| A11y score     | —                                  | ≥ 95 %                            |
| Best Practices | —                                  | ≥ 95 %                            |
| SEO score      | —                                  | = 100 %                           |
| First Load JS  | ≤ 75 KB gz                         | —                                 |

## Conséquences du conflit non résolu

1. **Confusion ADR futurs** : un PR qui passe lighthouserc.json mais rate AGENTS.md (INP 85 ms par exemple) → quel gate doit bloquer ?
2. **CI strictement bloquant** sur lighthouserc.json (job `lhci` CI) — donc _de facto_ lighthouserc.json est le gate dur.
3. AGENTS.md décrit des cibles INTERNES (peut-être plus strictes que CI) — mais pas formalisé comme tel.

## 3 options + recommandation

### Option A (recommandée par défaut autopilote) — ALIGNER AGENTS.md sur lighthouserc.json

**Action** : éditer `axionia/AGENTS.md:14-15` :

- `INP ≤ 100 ms` → `INP ≤ 80 ms`
- `CLS = 0` → `CLS ≤ 0.05`

**Justification** :

- Google « Good » officiel 2025 : INP ≤ 200 ms, CLS ≤ 0.1 → 80/0.05 reste 2x plus strict que Google = compétitif
- CLS = 0 strict absolu = **impossible à garantir** sur des pages avec contenu dynamique (booking calendar, AOS animations, etc.) — INP 80 + CLS 0.05 est atteignable
- Lighthouse CI = gate effectif, AGENTS.md doit refléter le gate réel pour cohérence agent IA

**Coût** : édition 2 lignes AGENTS.md + commit. ~5 min.

**Réversible** : oui (re-éditer dans l'autre sens).

### Option B — DURCIR lighthouserc.json sur AGENTS.md

**Action** : éditer `axionia/lighthouserc.json` :

- INP 80 → 100 (relâche)
- CLS 0.05 → 0 (durcit)

**Justification** : préserve la doctrine « CLS = 0 strict » d'AGENTS.md.

**Risques** :

- CLS = 0 absolu → blocage PRs sur pages avec animations légitimes (CTA hover transitions, hero reveals)
- INP 100 (relâche) → perd marge sécurité

**Coût** : pareil édition 2 lignes lighthouserc.json. Mais blocage CI massif suspecté → coût downstream élevé.

**Recommandé** : ❌ Non.

### Option C — Tiering : AGENTS.md = cible interne strict, lighthouserc.json = gate CI

**Action** : reformuler AGENTS.md avec préfixe explicite « **cibles internes p75 internes** (gate CI dans lighthouserc.json = 80/0.05) ».

**Justification** : permet de tracker une excellence interne distincte du gate.

**Risques** :

- Overhead psychologique : ingénieurs/agents IA confus
- Pas de mécanisme automatisé pour mesurer la cible interne sans CI

**Recommandé** : 🟡 Acceptable mais Option A est plus simple.

## Décision autopilote

✅ **Option A appliquée** (en cohérence avec décision défaut §"À FAIRE par Will" point 5 du prompt v1.1).

→ Sera matérialisée par :

1. ADR 0028 `architecture/0028-web-vitals-alignment.md` (à créer Phase 7)
2. Patch AGENTS.md lignes 14-15
3. Note dans changelog : « INP/CLS alignés sur lighthouserc.json (gate CI = source de vérité) — Option A ADR 0028 »

## Note sur cible 15 pages stratégiques

AGENTS.md référence « les 15 pages stratégiques » sans les lister. Inventaire à confirmer :

- 8 pages déjà couvertes par lighthouserc.json (home FR/EN, interventions FR/EN, audit FR/EN, implementation FR/EN)
- - cas-concrets, blog, contact (×2 locales) = 14
- - détail image-bank `/galerie/{slug}` quand livré ? À décider Phase 4-5

**Action différée** : pourvoir la liste explicite des 15 pages dans AGENTS.md ou un fichier dédié `docs/web-vitals-strategic-pages.md` quand image-bank publié.
