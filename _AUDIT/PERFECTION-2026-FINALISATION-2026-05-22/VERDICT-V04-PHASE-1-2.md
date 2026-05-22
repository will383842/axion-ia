# VERDICT V-04 Sprint Correctif Phase 1 + Phase 2 — 2026-05-22

**Mode** : IMPLEMENTATION autopilot (Will demande [B] sprint V-04 P1+P2 enchaînées).
**Base** : HEAD `fa567190` (sprint perfection finalisation 4 items précédent).
**Effort réel** : ~6 h pour 8 patches V-04 (P1 → P8 logique).

## Patches livrés

| #   | Description                                                                            | Commit     | Statut      |
| --- | -------------------------------------------------------------------------------------- | ---------- | ----------- |
| P1  | JsonLd defer afterInteractive sur 7 pages stratégiques                                 | `dc16306d` | ✅          |
| P2  | Hero image priority sur /equipe/[slug] portrait                                        | `dc16306d` | ✅          |
| P3  | Speculation Rules client-side + gating /admin/\*                                       | `da0bef32` | ✅          |
| P4  | Critical CSS — verified no-op (Next 16 `inlineCss: true` déjà actif)                   | —          | ✅ verified |
| P5  | Root layout JsonLd Organization + WebSite → JsonLdGraph @graph                         | `2eb7f7e9` | ✅          |
| P6  | Sentry server tracesSampleRate prod 0.1 → 0.02 (-80 % overhead)                        | `2eb7f7e9` | ✅          |
| P7  | Font preload — verified no-op (Manrope/Fraunces déjà `display: swap` + preload défaut) | —          | ✅ verified |
| P8  | Verdict + push                                                                         | (ce doc)   | ✅          |

## Gains LCP/TBT cumulés attendus

| Patch                                             | Gain LCP/TBT                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------ |
| P1 — 7 pages JsonLd afterInteractive              | -200 à -350 ms par page lourde (codage-developpement ×2 → -250 ms) |
| P2 — Manon portrait priority                      | -100 à -300 ms LCP (/equipe/manon)                                 |
| P3 — Speculation Rules prerender moderate 14 URLs | -800 à -1200 ms soft-nav                                           |
| P5 — Root layout @graph consolidation             | -300 à -500 ms doc parse sur 100 % routes                          |
| P6 — Sentry traces 0.02 prod                      | -30 à -80 ms TTFB server-side                                      |

**Total cumulé** : LCP mobile attendu **5441 → ~3500-4000 ms** (gain -1500/-2000 ms, vers seuil "Needs Improvement" orange 2500-4000 ms Google).

Pour passer en "Good" (vert ≤ 2500 ms), il reste à traiter :

- LHCI gate tightening (P7-substitute différé — multi-jour refactor assertMatrix per route)
- Sentry shell 136 KB bundle réduction (audit prod build chunk fragmentation nécessaire)
- Font preload Manrope si LCP element est text-based hero (vérification CrUX field data requise)
- LCP image preload `<link rel="preload" as="image">` per-template hub
- Image-bank LQIP audit + lazy strict sur images below-fold

## Fichiers modifiés

```
P1 — JsonLd defer afterInteractive
  src/components/marketing/JsonLd.tsx                                  (+strategy + scriptId)
  src/components/marketing/JsonLd.test.tsx                             (+2 tests)
  src/app/[locale]/audit/page.tsx                                      (ItemList → afterInteractive)
  src/app/[locale]/codage-developpement/page.tsx                       (3 schemas → afterInteractive)
  src/app/[locale]/codage-developpement/web-digital/page.tsx           (3 schemas → afterInteractive)
  src/app/[locale]/implantations/[region]/page.tsx                     (Place + ItemList villes → afterInteractive)
  src/app/[locale]/stack-ia/page.tsx                                   (FAQ → afterInteractive)
  src/app/[locale]/stack-ia/[tool]/page.tsx                            (FAQ → afterInteractive ×11 SSG)
  src/app/[locale]/centre-aide/[slug]/page.tsx                         (QAPage → afterInteractive)
  src/app/[locale]/cas-concrets/[slug]/page.tsx                        (Review → afterInteractive)

P2 — Hero image priority
  src/app/[locale]/equipe/[slug]/page.tsx                              (+priority + commentaire)

P3 — Speculation Rules client
  src/components/perf/SpeculationRules.tsx                             (nouveau, ~160 LOC)
  src/app/[locale]/layout.tsx                                          (+import + render, suppression bloc disabled)

P5 — Root layout @graph
  src/app/[locale]/layout.tsx                                          (2 scripts inline → JsonLdGraph)

P6 — Sentry traces
  src/sentry.server.config.ts                                          (0.1 → 0.02 prod + commentaire)
```

## Gates anti-régression

- `pnpm typecheck` : ✅ 0 erreur
- `pnpm test` : ✅ **1593 passed | 7 skipped (1600)** — baseline 1591 + 2 nouveaux tests JsonLd
- Pre-commit hooks (anti-hex + use-client + commitlint) : ✅
- Pre-push hook (vitest) : ✅

## Convergence Manon

Détection collision pendant Phase 2 : Manon a poussé en parallèle son sprint V-10
KB redirect wire (slug-history.ts + guides/[slug]/page.tsx avec `permanentRedirect`).
Initialement bloqué par `RedirectType.permanent` invalide (Next 16 RedirectType ne
contient pas `permanent`), résolu côté Manon en cours de session via `permanentRedirect`
direct import. Mon `git stash push --keep-index` a isolé sa WIP le temps des
commits, puis convergé naturellement (typecheck vert).

Mes commits préservent intégralement le travail Manon. Aucune ligne supprimée
hors de mes diffs explicitement listés ci-dessus.

## Score V-04 audit projeté

- Pré-sprint Phase 1+2 : 53/100 (baseline audit 2026-05-22)
- Sprint finalisation 4 items : 53 → 58 (gain +5, marginal Brotli + RSC doc)
- **Phase 1+2 livrée ici** : 58 → **~70-75/100** (gain +12-17 pts via fix structurels)

Reste pour atteindre 80/100 (cible 🟢) : ~4-5 jours sur Phase 3 (Lighthouse CI
gate tightening + Sentry chunk fragmentation + font preload validation CrUX +
LCP image preload per-template + image-bank LQIP audit).

## Actions Will recommandées

1. **Mesurer impact réel** : `pnpm lhci` après deploy pour comparer LCP mobile
   pré-sprint vs post-sprint sur les 9 URLs stratégiques (`lighthouserc.json`).
2. **Vérifier SpeculationRules** : ouvrir `/fr` en Chrome 121+ devtools → onglet
   Application → Speculation Rules → vérifier 14 URLs prerender `moderate`.
3. **Vérifier /admin SAFE** : naviguer console admin (Coolify deploy après
   merge) → vérifier 0 crash error boundary RSC stream.
4. **Sentry quota** : la réduction tracesSampleRate 0.1 → 0.02 réduit la
   consommation Sentry traces de 80 %. Surveiller quota mensuel 1 semaine.

## UNKNOWNs résiduels

- Manon poursuit sprint V-10 KB redirect en parallèle (fichiers non-commités ce
  push). Si elle commit après mon push, son commit s'appliquera proprement par-dessus.
- Pas de re-run Lighthouse mobile prod post-sprint : la mesure réelle de gain
  LCP nécessite `pnpm lhci` post-deploy (action Will n°1).
- `/admin/*` gating dans SpeculationRules.tsx présume `/admin/*` ou
  `/<adminPrefix>/*` patterns. Si Will change `ADMIN_URL_PREFIX` env var, le
  composant continue à matcher `/admin/*` direct par défaut. Le prefix est
  optionnel — passer `adminPrefix={env.ADMIN_URL_PREFIX}` au composant pour
  gating runtime-rotated complet (future amélioration P3.1).
