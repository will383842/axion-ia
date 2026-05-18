# 02 — Plan d'escalation (Phase 2)

Généré : 2026-05-18 ~06:10 UTC
Décision : appliquer Cycle 1 immédiatement, monitor, escalader selon résultat.

## TL;DR

- **Cycle 1 (immédiat)** : S1 + S10 — `runs-on: ubuntu-latest-large` (32 GB RAM) + instrumentation memory/disk monitor en background.
- Effort : ~10 min code + ~40 min monitor.
- Proba succès combinée : **~95%**.
- Si fail → Cycle 2 = S8 (`ubuntu-latest-large-4xl` 64 GB) OU S5/D4-QW1 (réduction SSG villes).

## Stratégie Cycle 1 sélectionnée — S1 + S10

### S1 — Upgrade runner `ubuntu-latest-large` (32 GB RAM, 8 cores, $0.16/min)

**Justification** :

- D2 : peak estimé 14.8-16.2 GB sur runner 16 GB = saturation. 32 GB = marge de **~16 GB libre minimum** vs peak prévu.
- D3 : pattern OOM-killer silencieux déterministe à 38 min → runner plus large = solution directe à la cause #1.
- Coût ~$3-4/build (estimé 25 min à $0.16/min). Sur ≤ 10 builds avant succès = ≤ $40 → sous le plafond §19 ($50).
- Coût récurrent acceptable : Will peut downgrade `ubuntu-latest` plus tard si autres patches réduisent la pression mémoire.
- Réversible 1-liner (revert `runs-on:`).
- Larger runners disponibles sur tous les repos GitHub avec compte personnel (par défaut depuis 2025).

**Patch** : `.github/workflows/deploy-coolify.yml` ligne 91 :

```yaml
# Avant
runs-on: ubuntu-latest

# Après
runs-on: ubuntu-latest-large
```

### S10 — Instrumentation memory + disk monitor en background

**Justification** :

- Si S1 fail aussi à ~38 min, on n'aura PAS le log pour diagnostiquer la cause (pattern OOM silencieux).
- Le monitor écrit dans `/tmp/build-monitor.log` toutes les 30s un snapshot `free -m + df + uptime`. À la fin du job, on cat le log → on voit le peak mémoire et à quel moment.
- Si S1 réussit, le log confirme le peak réel et permet de tuner.
- Effort minimal (3 steps yaml).

**Patch** : ajouter 2 steps dans `.github/workflows/deploy-coolify.yml` :

**Avant** "Build & push image" (après `Free disk space` step 1, donc step 2) :

```yaml
- name: Background memory + disk monitor (S10 instrumentation)
  run: |
    set +e
    mkdir -p /tmp
    (while true; do
      ts=$(date -u +%H:%M:%SZ)
      mem=$(free -m | awk '/Mem:/ {printf "RAM total=%d used=%d free=%d available=%d", $2, $3, $4, $7}')
      disk=$(df -m / | awk 'NR==2 {printf "Disk used=%dMB avail=%dMB", $3, $4}')
      load=$(uptime | sed -E 's/.*load average: //')
      cpu=$(top -bn1 | grep "Cpu(s)" | head -1 | sed -E 's/.*: //')
      echo "[$ts] $mem | $disk | load=$load | $cpu"
      sleep 30
    done) > /tmp/build-monitor.log 2>&1 &
    echo "MONITOR_PID=$!" >> "$GITHUB_ENV"
    echo "Monitor started (PID $!)"
```

**Après** "Build & push image" (toujours, même si fail) :

```yaml
- name: Print monitor log (S10 always run)
  if: always()
  run: |
    if [ -n "${MONITOR_PID:-}" ]; then
      kill "$MONITOR_PID" 2>/dev/null || true
    fi
    echo "=== BUILD MONITOR LOG (tail 100) ==="
    tail -100 /tmp/build-monitor.log 2>&1 || echo "(no monitor log)"
    echo "=== FINAL STATE ==="
    free -h
    df -h /
    top -bn1 | head -15
```

## Plan d'escalation Cycles 2-N

### Si Cycle 1 SUCCESS → Phase 5

→ Verification deploy effective → Phase 6 smoke → Phase 7 verdict.

### Si Cycle 1 FAIL — analyser logs S10

**Sous-cas A** : Monitor log montre peak mémoire > 25 GB sur runner 32 GB → **Cycle 2 = S8 (`ubuntu-latest-large-4xl` 64 GB RAM, $0.64/min)**.

- Coût ~$15/build, plafond $50 = max 3 builds.
- Si succès → résoudre côté coût en parallèle (D4-QW1 réduction SSG villes pour revenir à 32 GB).

**Sous-cas B** : Monitor log montre peak mémoire < 25 GB mais build die quand même → **autre cause** :

- Si peak disk dépasse 100 GB → Cycle 2 = W5 désactivé / cleanup additional /opt.
- Si pas de signal clair → Cycle 2 = W6 (purge GHA cache) + W7 (BUILDKIT_PROGRESS=plain).

**Sous-cas C** : Cycle 1 fail "runner not available" sur `ubuntu-latest-large` → larger runners pas activés :

- Cycle 2 = D4-QW1 réduction SSG villes (le plus impactful sans paid runner).
- Cycle 3 = W3 heap 4096 + S2 disable cache-from entierement.

### Si Cycle 2 FAIL → Cycle 3

**Cycle 3** = combo réduction SSG :

- Patcher `src/components/sections/VilleServicePageTemplate.tsx` ligne ~102 :

```typescript
export function buildStaticParams(): Array<{ ville: string }> {
  // S5/D4-QW1 — réduction SSG villes (build OOM verif-fix-deploy 2026-05-18).
  // dynamicParams=true + revalidate=86400 → villes non-indexables servies ISR.
  if (process.env.BUILD_SSG_VILLES_INDEXABLE_ONLY === "true") {
    return getIndexableVilles().map((v) => ({ ville: v.slug }));
  }
  return VILLES.map((v) => ({ ville: v.slug }));
}
```

- Ajouter `BUILD_SSG_VILLES_INDEXABLE_ONLY=true` dans build-args du workflow.
- Effort 15 min, réduit ~6 449 pages SSG → peak RAM divisé par ~2.

### Cycles 4-N (worst case)

- Cycle 4 = W8 (splitter pnpm install + prisma generate hors Docker, upload .next artifact).
- Cycle 5 = W6 purge GHA cache + W3 heap 4096.
- Cycle 6 = S2 disable cache-from entirely (fresh build à chaque fois).
- Cycle 7 = S11 (`experimental.workerThreads=false, cpus=1`).
- Cycle 8 = S6 BuildKit memory limits via setup-buildx-action driver-opts.

### Plafonds

- ⏱️ Plafond Phase 4 : 6 h cumulé.
- 🔁 Plafond cycles : 12.
- 💸 Plafond coût : $50.
- Si épuisé → §28 cas 4 (pipeline irréparable cloud) → STOP & ASK Will pour décider S9 (self-hosted runner Hetzner) ou migration Vercel/Render.

## Timeline estimée

| Cycle                   | Action                 | Durée typique   |
| ----------------------- | ---------------------- | --------------- |
| 1                       | S1 + S10               | 50 min          |
| 2                       | S8 ou D4-QW1 selon log | 50 min          |
| 3                       | Combo réduction SSG    | 50 min          |
| 4                       | W8 split build         | 50 min          |
| **Worst case 4 cycles** |                        | **3h20 cumulé** |

## Décision

✅ **Lancer Cycle 1 = S1 + S10 immédiatement** (Phase 3).
