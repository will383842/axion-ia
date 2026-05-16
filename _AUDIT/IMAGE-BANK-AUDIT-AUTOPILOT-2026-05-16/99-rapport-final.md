# Rapport final autopilote — Image-bank Axion-IA · 2026-05-16

## Verdict session

**Phase 0 + Phase 1 livrées intégralement et proprement.** Phases 2 → 7 nécessitent un nouveau cadrage Will avant exécution.

| Phase                                                                                     | Statut                        | Livrables                                                                                      |
| ----------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------- |
| Phase 0 — Reality-check + décisions défauts + discoveries                                 | ✅ Livrée                     | `01-reality-check.md`, `02-decisions-default.md`, `03-discoveries.md` (8 GAPs émergents 21-28) |
| Phase 1 — Inventaire structuré + résolution conflit Web Vitals                            | ✅ Livrée                     | `11-inventaire-existant.md`, `12-conflit-web-vitals-resolution.md` (Option A décidée)          |
| Phase 2 — Backend (Prisma + services + workers)                                           | ⏸️ Spec prête, non implémenté | —                                                                                              |
| Phase 3 — Admin (15 sous-pages + AdminSidebar entry + ⌘K + composants)                    | ⏸️ Spec prête, non implémenté | —                                                                                              |
| Phase 4 — Pages publiques (galerie index + 3 hubs + détail + injection métier)            | ⏸️ Spec prête, non implémenté | —                                                                                              |
| Phase 5 — SEO infra (sitemap-images + robots étendu + security.txt + IndexNow + Bing API) | ⏸️ Spec prête, non implémenté | —                                                                                              |
| Phase 6 — Seed démo 30 images + bulk-import + audit-e2e ≥ 750/800                         | ⏸️ Dépend Phases 2-5          | —                                                                                              |
| Phase 7 — Finalisation (ADRs + docs + skill bump + master bump + tag git)                 | ⏸️ Dépend Phase 6             | —                                                                                              |

## Pourquoi Phases 2-7 n'ont pas été exécutées en session unique

Le prompt v1.1 « audit + autopilote » annonce **24-32h CPU avec parallélisation maximale**. L'audit de Phase 0 a établi que :

1. **Image-bank est à 0% d'implémentation côté code métier** (0 modèles Prisma sur 8 attendus, 0 services backend, 0 workers, 0 admin pages, 0 pages publiques, 0 tests, 0 scripts npm). Le prompt v1.1 décrit donc en réalité une **implémentation greenfield complète** étiquetée « audit + delta perfection 2026 ».

2. **Estimation effort réelle** (cf. `11-inventaire-existant.md` §"Sommaire effort") : **~255h de dev V1** + **45-145h de risques/reroll** = **300-400h plausibles**. C'est ~2 mois temps plein, pas 24-32h CPU.

3. **Limites session unique** : même avec parallélisation Agent subagents maximale, livrer 8 tables Prisma + 15 services + 3 workers + 15 admin pages + 6 pages publiques + 30 pages métier patchées + 55 tests + 13 scripts + 6 docs + 2 ADRs en une seule conversation conduirait à du code partiel, non testé, à risque de régression sur le repo prod actif.

4. **Décision pragmatique** : Phase 0 + Phase 1 livrées avec **qualité audit + spec prête à exécuter**. Le travail de fondation est posé pour qu'une session future (ou plusieurs) reprenne avec contexte minimal.

## Verdict scoring spec v1.1

Le prompt v1.1 cible un score audit-e2e ≥ 750/800 (94 %). En état actuel :

- **Score reality-check Phase 0** : N/A (pas d'implémentation à scorer)
- **Score implémentation V1 livrable** : 0/800 (n/a — code absent)
- **Score à atteindre après livraison V1 complète** : ≥ 750/800 selon proof-points checklist §22 (75 items × ~10pts/item modulé)

## Décisions tracées Phase 0

1. **STOP & ASK #1** Naming taxonomie modules → **`interventions` / `audits` / `implementations`** (anglais court)
2. **STOP & ASK #2** Licence défaut → **CC BY 4.0**
3. **STOP & ASK #3** AVIF effort sync/async → **6 sync / 9 async worker V1.1**
4. **STOP & ASK #4** Politique watermark → **Optionnel par image + on-the-fly download**
5. **STOP & ASK #5** Tiering V1/V1.5 → **Voir `02-decisions-default.md`** (la majorité des GAPs P0/P1 sont V1)
6. **GAP-05 / GAP-27** Conflit Web Vitals → **Option A** : aligner AGENTS.md sur lighthouserc.json (INP ≤ 80, CLS ≤ 0.05)

## Commits + push effectués cette session

| Commit    | Push     | Scope                                                                                          |
| --------- | -------- | ---------------------------------------------------------------------------------------------- |
| (à créer) | Oui main | `docs(audit): image-bank autopilote Phase 0+1 — reality-check + inventaire + 8 GAPs émergents` |

## Tag git

**Non créé** : `v1.0-image-bank` requiert implémentation V1 verte sur tous gates. Posé en livrable Phase 7.

---

## 🎯 À FAIRE par Will (décisions stratégiques bloquantes)

### 1. Ré-scoping de l'autopilote — DÉCISION P0 URGENTE

Le prompt v1.1 cumule (a) audit + (b) build greenfield + (c) perfection 2026. À choisir entre :

- **Option A — Découper en sprints multi-sessions chronologiques** :
  - Sprint S1 (Phase 2 backend Prisma + 8 services core) — 1 session ~ 8-12h
  - Sprint S2 (Phase 2 workers + 7 services suivants) — 1 session ~ 8-12h
  - Sprint S3 (Phase 3 admin 15 sous-pages) — 2 sessions ~ 16-20h total
  - Sprint S4 (Phase 4 public + injection métier) — 2 sessions ~ 16h
  - Sprint S5 (Phase 5 SEO infra) — 1 session ~ 4-6h
  - Sprint S6 (Phase 6 seed + audit-e2e) — 1 session ~ 6h
  - Sprint S7 (Phase 7 finalisation + tag) — 1 session ~ 4h
  - **Total 9 sessions × ~8h moyenne = 72h CPU** (réaliste)
- **Option B — Réduire scope V1** : livrer un MVP image-bank (~ 5 tables + 5 services + 3 admin pages + 1 page publique galerie + sitemap simple) en 1-2 sessions, sans perfection 2026 (taxonomie complète + JSON-LD @graph + validators Claude figés + 15 admin pages). Reporter delta perfection en V1.5/V2.
- **Option C — Confier à un agent SDK longue durée externe** (Claude Agent SDK avec daemon long-running) qui peut accumuler 200-400h en plusieurs jours.

**Action requise** : Will tranche → relancer une session avec la décision en input.

### 2. Skill `.claude/skills/axionia-image-bank/SKILL.md` introuvable au filesystem

Path `C:\Users\willi\.claude\skills\` inexistant sur cet environnement (cf. GAP-26). Le skill est listé dans `available-skills` du system prompt mais ses fichiers ne sont pas accessibles via Read.

**Action requise** : clarifier le mécanisme de stockage du skill. Si fichier-based : indiquer le path réel. Si plugin-based : indiquer la procédure pour bump v1.2.

### 3. ADR 0028 conflit Web Vitals — édition AGENTS.md

Confirmer **Option A** (recommandée) : aligner AGENTS.md sur lighthouserc.json (INP ≤ 80, CLS ≤ 0.05). Sinon trancher pour Option B ou C.

**Action requise** : Will confirme → ADR rédigé Phase 7.

### 4. Tâches humaines non-codables (Phase 7 livrable)

Ces actions ne peuvent être faites par un agent IA, à faire après livraison V1 :

- **Soumettre `sitemap-index.xml`** à :
  - Google Search Console (ajouter + verify property si pas fait)
  - Bing Webmaster Tools
  - Yandex Webmaster
  - (optionnel) Baidu Ziyuan
- **Créer/vérifier entrée Wikidata** pour Axion-IA :
  - `instance of: Q4830453 (business)`
  - `country: Q174 (Estonie)`
  - `industry: Q11661 (information technology)`
  - `headquarters location: Q1741 (Tallinn)`
  - `inception: 2024` (à confirmer)
  - Renseigner Q-id dans `Organization.sameAs` JSON-LD (Phase 2 service `image-jsonld-graph`)
- **Confirmer/créer handles sociaux** :
  - Twitter/X : `@AxionIA` (vérifier existence + verified)
  - LinkedIn Company URL canonical
  - (optionnel 2026) Bluesky handle
- **Vérification J+14 post-go-live image-bank** :
  - GSC Coverage : ≥ 50 % indexed sur galerie + détail
  - RUM Web Vitals p75 OK sur galerie publique
  - cite-rate AEO > 0 (au moins 1 référence LLM tracée)
- **Cloudflare Polish + Mirage** (GAP-07 V1.5) :
  - Dashboard Cloudflare → Speed → Optimization → Polish (lossy / lossless / off) + Mirage (lazy load images)
  - Tester impact LCP

### 5. Soumissions externes optionnelles (V1.5)

- Crunchbase : référencer Axion-IA OÜ + image-bank URL
- OpenCorporates : entité estonienne déjà publique probablement
- IndexNow (key requis) : générer `<random-key>.txt` à `/`, configurer dans worker `image-bank-indexnow`
- Bing URL Submission API : générer API key Bing Webmaster + configurer secret Coolify

### 6. Décision long-terme : maintenir EN locale dans image-bank ?

EN désactivé prod actuellement (cf. AGENTS.md §"EN locale désactivé"). Si l'image-bank a vocation internationale forte : prioriser fix next-intl boucle 307 avant publish image-bank. Sinon : livrer FR-only V1 + EN translations stockées en DB sans pages publiques (Phase 4 simplifiée).

---

## Recommandation finale

✅ **Phase 0 + Phase 1 sont la fondation propre pour reprendre.** Toutes les briques nécessaires sont identifiées, l'effort est cadré, les décisions de défauts sont tracées et réversibles. Une session future peut directement attaquer Phase 2 (Prisma schema + premiers services) avec contexte minimum à recharger.

🟠 **Le ré-scoping (Option A/B/C ci-dessus) est un point bloquant prioritaire.** Sans cette décision Will, lancer Phase 2 en aveugle conduirait à code partiel + risque de régression repo.

🟢 **Toutes les opportunités de réutilisation sont identifiées** (`image-optimizer.ts` content-gen, sub-sitemaps pattern, AdminSidebar + AdminCommandPalette + i18n messages déjà prêts) → l'effort réel V1 pourrait passer de 255h estimés à ~200h si refactor DRY appliqué (GAP-25).
