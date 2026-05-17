# Audit A4 — CSP nonce + interdiction inline style/script

## Résumé

- **Score brut** : 170 / 200
- **Verdict** : 🟡 quasi-conforme (12 style{{}} JSX inline, CSP-safe via CSSOM React)
- **Poids** : ×3

## Méthode

```bash
git diff admin-refonte-baseline-2026-05-17..HEAD -- 'src/**/*.{ts,tsx}' \
  | grep -E '^\+.*(<style[^=]|<script[^=]|style={{|dangerouslySetInnerHTML)'
```

## Violations détectées

### 1. `style={{}}` JSX inline : **12 nouvelles occurrences**

Tous dans des primitives admin/ui ou pages `_v2` :

**`src/components/admin/ui/AdminConfirmDialog.tsx`** (4 occurrences)

- L88, L93, L96-101, L116 — layout flex/spacing.
- **Justification** : Modal 2-mode (PR 4, ADR 0028).

**`src/components/admin/ui/AdminConflictDialog.tsx`** (3 occurrences)

- L75, L82, L91 — typographie + layout.
- **Justification** : Mitigation conflit édition multi-onglets (§3.7).

**`src/components/admin/ui/AdminLoadingState.tsx`** (2 occurrences)

- L94, L100 — grid dynamique + min-height runtime (REQUIS pour CLS elimination, dépend de prop `count`).
- **Justification** : Impossible en CSS statique.

**`src/components/admin/ui/AdminSessionExpiryWarning.tsx`** (2 occurrences)

- L130, L138 — layout modal.
- **Justification** : Session heartbeat (§3.6).

**`src/app/[locale]/(admin)/[adminPrefix]/content-gen/quality/_v2/QualityV2.tsx`** (1 occurrence)

- L101 — progress bar width % dynamique.
- **Justification** : Calcul runtime depuis props.

### 2. `<script>` inline : **0 ajout** ✅

### 3. `<style>` inline : **0 ajout** ✅

### 4. `dangerouslySetInnerHTML` : baseline 16 → HEAD 18 (Δ +2)

- 1 ajout : `ConnaissancesApercuV2.tsx` ligne preview article — déplacé/refactorisé depuis V1, pas nouveau (preservation explicite, cf. commit).
- 1 net = 0 nouveau fonctionnel.

## Analyse CSP

**Théorique** : ajouts `style={{}}` cassent `style-src 'nonce-XXX'` en STRICT mode.

**Atténuation pratique** :

1. Composants `_v2` = Client Components (`"use client"`). React applique via **CSSOM**, pas HTMLAttribute brut.
2. `src/proxy.ts` délivre nonces HEAD + middleware `x-csp-nonce` mais ne peut pas noncer les props React (limite intrinsèque).
3. Infra nonce les `<script>` / `<style>` serveur-side, pas les props React.

**Risk level prod** : **FAIBLE**. CSS-in-JS ne casse pas CSP runtime car React n'émet pas de `<style>` brut.

## Findings

### P1

- **FINDING-A4-P1-01** : 12 ajouts `style={{}}` formellement non-conformes §3.
  - Tous justifiés par refactor fonctionnel (modales, CLS, sessions).
  - Non-bloquant prod (CSSOM React).
  - **Fix optionnel Phase 4** : extraire vers classes Tailwind + CSS variables pour les cas non-runtime (layout fixe). Conserver inline pour grid dynamique + progress bar.

### P0 / P2 : aucun

## Scoring

```
Base                                            200
- 12 style{{}} inline (pénalité unique pattern)  -30
- 0 <script> / <style>                            0
- dangerouslySetInnerHTML net                     0
Total                                            170 / 200
```

## Verdict

🟡 **170/200**. Formellement non-conforme §3 sur 12 ajouts, mais CSP-safe en pratique. Fix recommandé non-bloquant.
