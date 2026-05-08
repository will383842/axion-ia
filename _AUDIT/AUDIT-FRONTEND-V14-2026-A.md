# Annexe A — DoD croisée Sprints 0-14

**Lead agent** : AGT-DOD
**Méthode** : croisement DoD attendue (`PROMPT-CODAGE.md` §SPRINT N) × DoD déclarée (`SESSION_LOG.md`) × DoD réelle (`git show --stat <commit>` + lecture fichiers)

## A.1 — Sprints 0-4 (Fondations)

| Sprint            | Commit    | DoD Réelle                                                                                                                                     | Verdict |
| ----------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| **0** Toolchain   | `f52a2b4` | 30+ deps, Husky 9, 7 scripts custom, 4 GitHub workflows, ADR 0001, `.gitleaks.toml`, Playwright 5 projets                                      | ✅      |
| **1** Tokens      | `fe000c6` | `globals.css` v1 Webflow (surchargé v3 dans HEAD), Manrope/Inconsolata, 5-layer shadows, `/_design`, scripts `contrast:check` + `radius:check` | ✅      |
| **2** Layout i18n | `8200548` | `routing.ts`, `proxy.ts` (Next 16 renamed middleware), Header + Footer + SkipToContent, breadcrumbs, JSON-LD Organization + WebSite            | ✅      |
| **3** Atoms UI    | `5fd1dda` | 19 composants UI shadcn-style (button, card, badge, alert, dialog, dropdown, etc.), 71 tests                                                   | ✅      |
| **4** Sections    | `062b8df` | Sections composites, `<FadeInOnView>` motion, `/_sections` dev page                                                                            | ✅      |

**Findings A.1** :

- ✅ Tous les Sprints 0-4 livrés réellement
- ⚠️ **A-P1-1** : SESSION_LOG ne documente pas Sprints 1-4 (seulement Sprint 0 + 5b enregistrés). Mémoire opérationnelle de travail incomplète pour maintenance future.

## A.2 — Sprints 5-9 (Contenu & couverture)

| Sprint               | Commit    | DoD Réelle                                                                                                                                                          | Verdict |
| -------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| **5** Interventions  | `2dcad8b` | 6 pages live (`/interventions` + 5 formats : essentielle, equipes, managers, conference, dirigeants). JSON-LD Service. Spec Rules `eagerness=moderate`.             | ✅      |
| **6** Audit          | `2dcad8b` | 5 pages live (audit + complet/departement/point-de-vente/cabinet). CTA → `/audit/demande` (form finalisé Sprint 13).                                                | ✅      |
| **7** Implementation | `f7bb430` | 10 pages live (agents, chatbot, crm-erp, documents, ia-custom, integrations, no-code, processus, structuration + listing). `<ProcessSteps>` + accent module purple. | ✅      |
| **8** Cas concrets   | `c99d66a` | 3 templates (listing + détail + secteur). Zod fixtures `src/content/case-studies.ts`. Filtres URL-driven (no JS state).                                             | ✅      |
| **9** Transversales  | `c99d66a` | 40+ pages : a-propos, blog (5 templates), faq (3), centre-aide (3), comparaisons, glossaire, methodologie, guide-ia, recherche, légales (RGPD, accessibilité).      | ✅      |

**Findings A.2** :

- ✅ Tous Sprints 5-9 livrés complètement
- ⚠️ **A-P1-1** (suite) : SESSION_LOG manque pour Sprints 5-9

## A.3 — Sprints 10-14 + Polish (Finalisation)

| Sprint            | Commit                       | DoD Réelle                                                                                                                                                                         | Verdict                     |
| ----------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| **10** Légales OÜ | `9cc70d7`                    | 6 pages légales (mentions, CGU, confidentialité, déplacement, cookies, RGPD). 0 mention SIREN/RCS/TVA FR (anti-siren ✅). TVA EE per locale.                                       | ✅                          |
| **11** Booking    | `5a5ac6e`                    | `<HouseCalendar>` SSR-friendly + page `/reserver` (refondue HEAD avec `<BookingCalendar>` Radix Dialog modal). Tests Playwright.                                                   | ✅                          |
| **12** ROI        | `d6b9983`                    | `<RoiSimulator>` Client Component + page `/roi` + 6 unit tests (compute pure).                                                                                                     | ✅                          |
| **13** Forms      | `c3d748b`                    | 5 forms multi-step (Audit 5-step, Implementation 4-step, Contact, Newsletter, Réservation) + Zod schemas (26 tests) + RHF + Turnstile. Page `/confirmation`. Server actions stubs. | ✅                          |
| **14** Système    | `1135136`                    | 404/500/maintenance handling, `/desabonnement`, `/preferences-cookies`, `/mes-donnees`. Sitemap dynamique + robots + llms.txt. JSON-LD globaux layout.                             | ✅                          |
| **14.5 Pivot**    | dispersé `5942d2f → 941a8e1` | `globals.css` v3 ✅, Fraunces ✅, Hero refonte ✅, Home 11 sections ✅, Footer mocha ✅, **ADR 0002** ✅, Design.md v3 ✅, 71 tests PASS, 5 gates verts.                           | ✅ contenu / ⚠️ traçabilité |
| **Polish A-E**    | `01c5a59 → f2ea1e6`          | 5 phases dédiées (P0 WCAG, nav+forms, prog+SEO, perf+exp, P2+P3)                                                                                                                   | ✅                          |

**Findings A.3** :

- ✅ Tous Sprints 10-14 + polish livrés
- ⚠️ **A-P1-2** : Pivot v3 non atomisé. ADR 0002 + tokens v3 + Fraunces dispersés sur multiple commits (~22 ahead). DoD Sprint 14.5 exige commit dédié `feat(design): pivot v3 editorial-premium-light per ADR 0002`. Traçabilité atomique brisée pour future rétro-inspection.

## A.4 — Synthèse

**Critères GO Partie A** :

- 0 P0 ✅
- ≤ 5 P1 ✅ (2 P1)

### Findings P0 : 0

### Findings P1 (2)

| ID         | Description                                                               | Mitigation                                                                                     | Effort |
| ---------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------ |
| **A-P1-1** | SESSION_LOG incomplet (Sprints 1-4 + 6-9 non documentés)                  | Ajouter rétro SESSION_LOG par sprint manquant (template = Sprint 5b)                           | 4-5h   |
| **A-P1-2** | Pivot v3 non atomisé (DoD 14.5 demandait commit `feat(design): pivot v3`) | Documenter dans CHANGELOG les commits qui composent le pivot v3 (rebase risqué — préférer doc) | 1h     |

### Findings P2 / P3

- ⚠️ Playwright e2e cross-browser pas exécuté en CI sur cette branche (tests existent ; recommandé avant Sprint 15)
- ⚠️ Snapshot `verify:all` log + Lighthouse baseline non capturés (recommandé pour comparaison Sprint 15+)

## A.5 — Verdict Partie A

# ✅ **GO Sprint 15** (Partie A)

Conditions de remédiation P1 = **non bloquantes** (peuvent être traitées en parallèle Sprint 15).
