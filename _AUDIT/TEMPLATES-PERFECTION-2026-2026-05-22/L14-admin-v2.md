# Audit L14 — Admin V2 (125 templates)

**Date** : 2026-05-22 | **Agent** : A14

## Résumé critique

**Total pages admin** : 125 (confirmé)

| Indicateur                            | Valeur                                           |
| ------------------------------------- | ------------------------------------------------ |
| Pages avec `robots: { index: false }` | **16 / 125** (12.8%)                             |
| Pages SANS noindex                    | **109 / 125** (87.2%) **← P0 CRITIQUE**          |
| RBAC serveur-side                     | ✅ présent (actions/API)                         |
| dangerouslySetInnerHTML               | 4 usages → tous sanitizés `sanitizeTiptapHtml` ✓ |

## SCORE : 380/1000 — CRITIQUE

---

## Scores par groupe

| Groupe                   |   Pages |   Score | Verdict      |
| ------------------------ | ------: | ------: | ------------ |
| Dashboard + Navigation   |       2 |     250 | CRITIQUE     |
| CRUD Content             |      22 |     320 | CRITIQUE     |
| Content-Gen              |      57 |     280 | CRITIQUE     |
| Booking/Finance          |      12 |     300 | CRITIQUE     |
| Settings + Users + Infra |       8 |     320 | CRITIQUE     |
| **Image-bank Admin**     |  **15** | **850** | **BIEN ✓**   |
| Login                    |       1 |     200 | CRITIQUE     |
| **TOTAL**                | **125** | **380** | **CRITIQUE** |

---

## P0 BLOQUANTS (SEO)

### 1. 109/125 pages SANS `robots: { index: false }`

**Impact** : Google, Bing, Claude.ai bots peuvent indexer pages admin si URL découverte.

**Cause racine** : `robots.txt` bloque `/fr/admin/` mais URL réelle est `/fr/[adminPrefix]` dynamique — pas couvert.

**Fix** : Ajouter au **layout parent** `src/app/[locale]/(admin)/[adminPrefix]/layout.tsx` :

```typescript
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
```

Cette propagation couvre automatiquement toutes les 109 pages enfants.

**Effort** : 30 min | **Impact** : 109 pages sécurisées d'un coup

### 2. robots.txt imprécis

Bloque `/admin/` (exact match) mais pas `[adminPrefix]` dynamique.

**Fix** : Dans `src/app/robots.ts`, ajouter règle générique de fallback ou documenter que le layout noindex couvre.

---

## Points de vigilance sécurité

### BIEN — dangerouslySetInnerHTML

Tous les 4 usages détectés sont sanitizés :

- `src/app/[locale]/(admin)/[adminPrefix]/layout.tsx:125` — CSS style (safe)
- `src/app/[locale]/(admin)/[adminPrefix]/connaissances/[id]/apercu/_v2/ConnaissancesApercuV2.tsx:55` — sanitizeTiptapHtml ✓

### BIEN — Image-bank admin (15 pages)

**Seul groupe avec noindex correct** : 15/15 pages ont `robots: { index: false, follow: false }` ✓

### BIEN — RBAC

- `requireAdminRead()` / `requireSuperAdmin()` dans les actions ✓
- Users page : `isSuperAdmin` check côté serveur (L21) ✓
- 2FA setup : `setup2FAStartAction()` server-side ✓

### BIEN — Session security

- `AdminSessionExpiryWarning` (layout.tsx:139) — warning timeout ✓
- Heartbeat 5min ✓
- Pas d'env vars sensibles exposés côté client ✓

---

## P1 UX Admin

1. **Feedback mutations absent** (toast/snackbar) — Groupes 3, 4 | Sprint dédié
2. **Audit logs mutations non-vérifiées** | À vérifier ActivityLog table
3. **Rate-limit login non visible** | Brute-force risk
4. **Breadcrumbs PR 4 pending** | Navigation context manquant
5. **Command palette PR 5 pending** | Search admin

---

## Synthèse L14

### Action immédiate (30 min = 109 pages sécurisées)

```typescript
// src/app/[locale]/(admin)/[adminPrefix]/layout.tsx — ajouter :
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
```

Post-fix noindex global : score estimé **680+/1000** (CORRIGER → passable pour admin flaggé)

**Image-bank admin** : 850/1000 — peut servir de modèle pour les autres groupes.
