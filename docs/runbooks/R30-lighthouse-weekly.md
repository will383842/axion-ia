# R30 — Lighthouse CI prod hebdo

- **Code** : R30
- **Version** : 1.0
- **Date dernière maj** : 2026-05-15
- **Sévérité** : 🟢 **P2 — routine** (préventif)
- **Impact si non traité** : drift Web Vitals invisible → LCP/INP/CLS dégradent jusqu'à hit du budget Web Vitals (alerte `[WEB_VITALS_DEGRADED]`).

## Trigger

- Hebdo (lundi 04:00 UTC).
- Manuel après changement majeur (pivot design, lib upgrade, refonte page top traffic).
- Alerte `[⚠️ PERF LCP]` / `[WEB_VITALS_DEGRADED]` → audit complet via ce runbook.

## Cible Web Vitals (mémoire `axionia/AGENTS.md` perf budget 2026)

- **LCP** ≤ 1 800 ms p75
- **INP** ≤ 100 ms p75
- **CLS** = 0
- **TBT** ≤ 150 ms (Lighthouse lab desktop)
- **First Load JS** ≤ 75 KB gz / route

Exception `/reserver` : INP ≤ 150 ms, First Load ≤ 110 KB gz.

## Prérequis

- `pnpm lhci` script local + `.lighthouserc.js`.
- 15 URLs stratégiques (cf. `_AUDIT/AUDIT-WEB-VITALS-2026-BUDGETS.md`).
- Accès Plausible (RUM CrUX-like données réelles).

## Étapes (hebdo lundi 04:00)

### 1. Run Lighthouse CI

```bash
cd axionia
pnpm lhci --collect.url=https://axion-ia.com/fr \
  --collect.url=https://axion-ia.com/fr/interventions \
  --collect.url=https://axion-ia.com/fr/audit \
  --collect.url=https://axion-ia.com/fr/implementation \
  --collect.url=https://axion-ia.com/fr/reserver \
  --collect.url=https://axion-ia.com/fr/blog \
  --collect.url=https://axion-ia.com/fr/stack-ia \
  --collect.url=https://axion-ia.com/fr/equipe/manon \
  --collect.url=https://axion-ia.com/fr/implantations \
  --collect.url=https://axion-ia.com/fr/methodologie \
  --upload.target=temporary-public-storage
```

### 2. Comparer résultats vs semaine N-1

Archive `lhci/reports/YYYY-WW.json` puis diff :

```bash
node scripts/lhci-diff.js lhci/reports/2026-W19.json lhci/reports/2026-W20.json
# Output : delta perf/a11y/bp/seo + LCP/INP/CLS deltas
```

### 3. Identifier régressions (delta > 5 pts)

| URL          | Métrique | W-1    | Current | Delta  | Action                             |
| ------------ | -------- | ------ | ------- | ------ | ---------------------------------- |
| /fr/reserver | INP p75  | 140 ms | 165 ms  | +25 ms | Investiguer ajout lib calendrier ? |

### 4. Si régression confirmée → investiguer

- Vérifier commits depuis W-1 (`git log --since='1 week ago' --oneline -- axionia/src/`).
- Lancer Lighthouse local en dev/prod build.
- Vérifier bundle delta (`size-limit` check).
- Patcher + re-deploy.

### 5. RUM CrUX cross-check via Plausible

```
https://plausible.axion-ia.com → Web Vitals
→ Comparer p75 LCP/INP/CLS sur 7 jours rolling
→ Vérifier cohérence avec Lighthouse lab
```

### 6. Documenter dans audit log

```markdown
# \_AUDIT/LIGHTHOUSE-WEEKLY-LOG.md

| Week | Date       | URLs tested | Avg perf | LCP p75 max | INP p75 max | CLS max | Notes |
| ---- | ---------- | ----------- | -------- | ----------- | ----------- | ------- | ----- |
| W20  | 2026-05-15 | 15          | 94       | 1 750 ms    | 92 ms       | 0.01    | OK    |
```

## Vérifications post-fix

- [ ] Tous les seuils respectés sur les 15 URLs.
- [ ] Pas de delta > 5 pts vs W-1.
- [ ] Plausible RUM cohérent avec Lighthouse lab.
- [ ] Si régression → ticket GitHub + ADR.

## Rollback

Non applicable (audit, pas modification).

Si patch performance regretté → revert commit + re-deploy.

## Escalation

| Niveau | Contact            | Quand                                     |
| ------ | ------------------ | ----------------------------------------- |
| L1     | Will               | si régression > 5 pts non explicable      |
| L2     | Cloudflare support | si CF cache headers dégradent perf (rare) |

## Liens

- `axionia/AGENTS.md` — Web Vitals 2026 budget
- `_AUDIT/AUDIT-WEB-VITALS-2026-BUDGETS.md` — source de vérité seuils
- Mémoire `axionia_audit_web_vitals_2026-05-08` — audit V1
- Mémoire `axionia_audit_web_vitals_v3_v6_pending` — V3-V6 backlog
- R20 — CF cache stale (peut faire fluctuer LCP)
