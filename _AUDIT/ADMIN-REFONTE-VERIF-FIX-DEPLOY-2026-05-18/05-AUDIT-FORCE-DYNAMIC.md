# Audit A5 — `force-dynamic` + interdiction `revalidate`

## Résumé

- **Score brut** : 190 / 200
- **Verdict** : 🟢 quasi-conforme (1 route pure-redirect non-bloquante)
- **Poids** : ×3

## Méthode

```bash
find "src/app/[locale]/(admin)/[adminPrefix]" -name "page.tsx" | wc -l                  # 116
grep -rln "force-dynamic" "src/app/[locale]/(admin)/[adminPrefix]" --include="page.tsx" | wc -l   # 115
grep -rn "export const revalidate" "src/app/[locale]/(admin)/[adminPrefix]" --include="page.tsx"  # (vide)
comm -23 <(find ... | sort) <(grep -rln "force-dynamic" ... | sort)
# → src/app/[locale]/(admin)/[adminPrefix]/content-gen/geo/batches/[id]/page.tsx
```

## Résultats

| Critère                                                        | Résultat        |
| -------------------------------------------------------------- | --------------- |
| Routes admin total                                             | **116**         |
| Routes avec `force-dynamic`                                    | **115** (99.1%) |
| Routes SANS `force-dynamic`                                    | **1**           |
| Routes avec `export const dynamic` autre que `"force-dynamic"` | 0               |
| Routes avec `export const revalidate`                          | **0** ✅        |

## Findings

### P1 — Route manquant `force-dynamic` (1)

- **Fichier** : `src/app/[locale]/(admin)/[adminPrefix]/content-gen/geo/batches/[id]/page.tsx`
- **Type** : page de redirection 307 vers `/[locale]/[adminPrefix]/content-gen/coverage/[id]`.
- **Analyse** : aucun accès session/DB/auth, émet redirect immédiat. **Techniquement exempt** mais master prompt exige all routes admin → violation formelle.
- **Fix Phase 4** : ajouter `export const dynamic = "force-dynamic"` (1 ligne).

### P0 / P2 : aucun

## Scoring détaillé

```
Base                          200
- 1 route sans force-dynamic   -10
Total                          190 / 200
```

## Verdict

🟢 Quasi-conforme. Fix trivial (1 ligne) recommandé Phase 4 pour atteindre 200/200 et uniformité.
