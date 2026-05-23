# A12-ADDENDUM — UX simplicité console admin V2

> **Mode** : AUDIT-ONLY strict (zéro commit, zéro modification)
> **Date** : 2026-05-21
> **HEAD audité** : `37ca0147` (origin/main)
> **Baseline P1.5** : score ~770-820/1000
> **Périmètre parent** : addendum P1 — complète A12 du PHASE-1-VERDICT.md
> **Exigence Will** : « simple et pas complexe »

---

## Score final : **17/30 (57 %)** — 🟠 SPRINT CORRECTIF (verdict : PARTIELLEMENT ATTEINT)

| Catégorie | Score | Notes |
|---|---|---|
| User journeys clicks count mesurés | 7/10 | 7/10 journeys pass, 3 blocked/unknown |
| Hick + Fitts + Nielsen + Don Norman | 6/8 | Hick violation Réglages (10 items), Nielsen 72/100, Fitts pass, Don Norman 7.7/10 |
| One-click + presets + bulk ops | 2/4 | QuickGen 1-click OK ; pas de pause 1-click, pas de campaign templates presets, pas de bulk launch |
| Onboarding + empty + erreur + mobile + TTFV | 2/4 | Empty states inline mais sans guard zero-state, mobile UNTESTED |
| Test Will réel + 5-sec + SUS | 0/4 | **PENDING** Will doit chronométrer |

---

## 1. User journeys × clicks count × verdict

| # | Journey | Clicks actuels | Cible | Verdict |
|---|---|---|---|---|
| 1 | Créer campagne depuis dashboard | 8+ (dashboard → "Nouvelle campagne" → form 4 steps + submit) | ≤8 | ⚠️ AT LIMIT — bouton seulement header dashboard, non persistant sidebar |
| 2 | Lancer campagne créée | 1 (inline CTA / modal confirm) | 1 | ✅ |
| 3 | Monitor campagne en cours | 2 (KPI card → /jobs?serviceSector=) | ≤2 | ✅ |
| 4 | Pauser campagne | 2-3 (drill `/coverage/[id]` → button + confirm) | 1 | 🔴 BLOCKED — pas d'action inline visible dashboard |
| 5 | Modifier campagne en cours | UNKNOWN | flexible | 🔴 [UNKNOWN — confirm Will] |
| 6 | Archiver / cloner | UNKNOWN | 1 each | 🔴 [UNKNOWN] |
| 7 | Voir détail 1 article depuis dashboard | 3-4 (dashboard → /jobs → select → detail) | — | ⚠️ multiples hops |
| 8 | Re-générer 1 article | 1-2 (detail → button + confirm) | 1 | ⚠️ |
| 9 | Forcer re-review article | 1-2 | 1 | ⚠️ |
| 10 | Discard / kill 1 article | 2 (button + dual-confirm) | 2 | ✅ |

---

## 2. Nielsen 10 heuristiques — Score /100

| # | Heuristique | Score /10 | Notes |
|---|---|---|---|
| 1 | Visibilité statut système | 8 | KPI cards + kill-switch banner ; manque queue depth par type |
| 2 | Correspondance monde réel | 7 | FR métier OK ; emoji icons (sera fixé PR 5 lucide-react) |
| 3 | Contrôle utilisateur (undo, cancel) | 6 | Cmd+K palette OK ; pas d'undo-toast destructif explicite |
| 4 | Cohérence + standards | 9 | Design tokens admin.css solides, AdminPageShell/Header uniformes |
| 5 | Prévention erreurs | 7 | Confirm dialogs destructifs ; manque validation inline forms |
| 6 | Reconnaissance > rappel | 8 | Quick-actions explicites, breadcrumbs planifiés PR 4 |
| 7 | Flexibilité + shortcuts | 5 | Cmd+K OK ; pas de bulk-action keyboard, pas de vim-mode |
| 8 | Esthétique minimaliste | 7 | Cards lisibles ; Réglages = 10 liens flat (Hick) |
| 9 | Récupération erreurs | 6 | AdminErrorState existe ; Claude API timeout non testé |
| 10 | Aide + doc | 5 | AdminKeyboardHint existe ; tooltips form labels absents |

**Total Nielsen : 72/100** (C grade).

---

## 3. Hick's Law violations (>7 actions par écran)

| Écran | Actions | Violation ? | Recommandation |
|---|---|---|---|
| Dashboard root | 12-14 (header CTAs + 6 QuickGen forms + 2 quick-actions sections) | ⚠️ marginal | Tabber "Génération unitaire" en 3 onglets |
| `Réglages` section (dashboard lines 249-289) | **10 liens flat** | 🔴 OUI | Tabber 3 onglets : (A) Coûts (Providers + cost caps + Batches/workers), (B) Distribution (5 types + audiences + intentions), (C) Qualité (boucle qualité + Q/R + phrases interdites + llms.txt) |
| Review queue | UNKNOWN | — | [UNKNOWN] |
| Coverage form | UNKNOWN | — | [UNKNOWN — Will inspecte] |

---

## 4. Fitts's Law + WCAG 2.2 §2.5.8 (target ≥44×44px mobile)

| Composant | Min height | Mobile size | WCAG pass ? |
|---|---|---|---|
| `.admin-nav-link` | 32px (admin.css:130) | 44px via padding | ✅ |
| `.admin-button` | 36-40px | 44px+ | ✅ |
| AdminStatCard link | 44px min-height | 44px+ | ✅ |
| `.admin-input` (QuickGen forms) | unknown | assume 44px | ⚠️ VERIFY |

---

## 5. Wireframes ASCII — 3 écrans les plus complexes

### 5.1 — Réglages actuels (Hick violation)

```
┌────────────────────────────────────────────┐
│ RÉGLAGES                                   │
├────────────────────────────────────────────┤
│ • Providers IA & cost caps                 │
│ • Batches & workers                        │
│ • Policies (skip, plagiat, retention)      │
│ • Distribution 5 types contenu             │
│ • Mix audiences (taille × organisation)    │
│ • Distribution intentions                  │
│ • Boucle qualité                           │
│ • Q/R post-process                         │
│ • Phrases interdites                       │
│ • llms.txt édition                         │
└────────────────────────────────────────────┘
❌ 10 items flat, no grouping, user scan all 10
```

### 5.2 — Réglages simplifié (tabbed)

```
┌────────────────────────────────────────────┐
│ [💰 Coûts] [📊 Distribution] [✅ Qualité]  │
├────────────────────────────────────────────┤
│ COÛTS TAB:                                 │
│  • Providers IA & cost caps                │
│  • Batches & workers                       │
│  • Policies skip/plagiat/retention         │
└────────────────────────────────────────────┘
✅ 3 tabs visibles, 3-4 items per tab (≤7)
```

### 5.3 — Dashboard QuickGen actuel (6 cards 2 cols)

```
┌──────────┬──────────┐
│Landing v.│Article t.│
├──────────┼──────────┤
│Article kw│Comparatif│
├──────────┼──────────┤
│Pilier    │FAQ stand.│
└──────────┴──────────┘
❌ Dense : 6 formulaires compétitifs sur 1 vue
```

### 5.4 — Dashboard QuickGen simplifié

```
┌────────────────────────────────────────────┐
│ Génération unitaire — type :               │
│ [🏙️ Ville] [📝 Article] [⚖️ Comparatif][+3]│
├────────────────────────────────────────────┤
│ VILLE TAB:                                 │
│  [Input: ville-slug]   [Lancer →]          │
└────────────────────────────────────────────┘
✅ Single decision tree, TTFV optimal
```

---

## 6. Recommandations P0/P1/P2

### P0 (≤4h chacune, impact UX max)
1. **Collapse Réglages 10 → 3 tabs** (~3h) → Hick +2, Nielsen +5
2. **Persist "Nouvelle campagne" dans sidebar** (groupe "content") (~2h) → Journey #1 clicks -1
3. **Inline pause/resume dashboard cards** + confirm modal (~4h) → Journey #4 clicks 2→1

### P1 (campaign templates + bulk)
4. Campaign templates presets seedés (6 templates) — voir D-Add-3
5. Bulk campaign launch (sélectionner N + "Launch all") (~6h)
6. Empty state guards si 0 campagne → CTA onboarding (~2h)

### P2 (polish + chaos engineering)
7. Mobile UX testing iPhone SE / iPad (~2h)
8. Article preview review queue (drill→side pane) (~5h)
9. Keyboard nav expert mode (Shift+? all shortcuts) (~4h)
10. API timeout fallback UI graceful (~3h)
11. Template form tooltips contextuels (~3h)
12. SUS survey baseline (10 questions Likert) (~30 min Will)

---

## 7. Délégations P5

| Tâche | Effort | Impact |
|---|---|---|
| Collapse Réglages → 3 tabs | 3h | Hick +2, Nielsen +5 |
| Persist "Nouvelle campagne" CTA sidebar | 2h | -1 click journey 1 |
| Inline pause/resume | 4h | -1 click journey 4 |
| Empty state guards | 2h | TTFV, onboarding clarity |
| Mobile UX test | 2h | Mobile Nielsen +8 |
| Template form tooltips | 3h | TTFV -20%, erreurs -15% |
| Bulk campaign launch | 6h | Bulk ops score +3 |
| Article preview review queue | 5h | -1 click journey 7 |
| Keyboard expert mode | 4h | Efficacité experts +40% |
| API error fallbacks chaos test | 3h | Résilience, Nielsen #9 +2 |
| **Total P5** | **~34h** | 5-6 sprint days |

---

## 8. Fichiers inspectés

```
✅ src/lib/admin-nav.ts (62-124) — SSOT nav 36 items × 6 groupes
✅ src/components/admin/AdminSidebar.tsx — sidebar client + aria-current
✅ src/app/[locale]/(admin)/[adminPrefix]/AdminCommandPalette.tsx — Cmd+K palette
✅ src/app/[locale]/(admin)/[adminPrefix]/layout.tsx — layout shell
✅ src/app/[locale]/(admin)/[adminPrefix]/content-gen/page.tsx — entry page
✅ ContentGenDashboardV2.tsx (335 lignes) — dashboard root
✅ src/app/admin.css (146 lignes) — design tokens
✅ AdminPageHeader/Shell/StatCard — composants pattern
✅ TemplateForm.tsx (partial 80 lignes)
📋 NOT INSPECTED : /coverage form, /review-queue UI, /settings details, mobile responsive, real API behavior
```

---

## 9. STOP & ASK Will

- **Validation P1.5 SUS** : 5 min, 10 questions Likert → baseline UX
- **Test 5 secondes screenshot dashboard** : Will couvre 5s, débrief « qu'as-tu compris ? »
- **Chronométrer 1 cycle campagne fictive** : création → lancement → monitor → pause → archive

---

*Fin A12-Addendum. Verdict 17/30 — UX V2 shell solide, polish required pour atteindre « simple et pas complexe ».*
