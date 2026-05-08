# 🔄 PROMPT DOC SYNC V14 — AxionIA · Synchronisation docs ↔ code

> **Version 1.0 · 2026-05-07** · réconciliation documentation avec la réalité du code
> Working directory : `C:\Users\willi\Documents\Projets\Axion-IA`
> Sortie principale : `_AUDIT/DOC-SYNC-REPORT-V14.md` + 9+ docs mis à jour
> Durée estimée : 90-150 min (5 agents parallèles + agent principal)

---

## 🎯 SCOPE

Le code AxionIA a massivement évolué entre 2026-05-06 et 2026-05-07 (~30 commits) tandis que plusieurs documents sources sont restés sur l'état initial. Ce prompt **synchronise les docs avec le code** sans toucher au code lui-même.

### Constat à 2026-05-07 (snapshot HEAD)

- **64 routes** live dans `app/[locale]/` vs **75 templates** prévus dans `02b-mapping-pages.md` v1 (06/05).
- **Nouvelles routes** non documentées : `/presse`, `/stack-ia`, `/comparaisons` + `[slug]`, `/glossaire`, `/guide-ia`, `/methodologie`, `/accessibilite`, `/recherche`, `/implementation/par-fonction/[slug]`, `/implementation/par-techno`.
- **Audit module refactoré** : anciennes routes (`complet`/`departement`/`point-de-vente`/`cabinet`) → nouvelles (`flash`/`process`/`strategique-pme`/`strategique-eti`/`demande`).
- **5 ADRs** dans `axionia/docs/adr/` : 0001 stack, **0002 (DOUBLON : 2 fichiers)**, 0003 lift formation ban, 0004 typography v3.1.
- **2 ADRs proposés** en `_AUDIT/` non commités : 0005 mega-menu, 0006 pSEO villes V1=2150.
- **11 fichiers content/** : audit, automatisations, case-studies, comparaisons, implementation, interventions, legal, press + press.test, stack-ia, transversal.
- **5 nouvelles factories JSON-LD** (Person, Article, FaqSpeakable, LocalBusiness, Place, ItemList).
- **Sitemap-index** Next 16 (`generateSitemaps`, 6 sous-sitemaps).
- **22 commits ahead** de `origin/main` non pushés.

### Hors scope

- **Aucune modification du code** (`src/`, `public/`, `prisma/`, `tests/`, `scripts/`, `messages/`, `content/`).
- Seuls les fichiers documentation sont éditables (`_AUDIT/*.md`, `axionia/docs/`, `axionia/Design.md`, `axionia-package/docs/`, mémoire `~/.claude/projects/.../memory/*.md`).

---

## 🧠 RÔLE & POSTURE

Tu es **technical writer senior** + auditeur de cohérence documentation/code. Le code fait **foi absolue**. Toute divergence doc/code se résout en mettant à jour la doc, jamais en touchant au code.

**Posture** : exhaustif, factuel, citations obligatoires, lecture seule sur le code, écriture autorisée uniquement sur les docs identifiées.

---

## 📚 SOURCES DE VÉRITÉ

### Code (LECTURE SEULE — référence absolue)

1. `axionia/git log --oneline` — historique commits.
2. `axionia/src/app/[locale]/**/page.tsx` — routes effectives.
3. `axionia/src/content/*.ts` — content effectif.
4. `axionia/src/components/**/*.tsx` — composants effectifs.
5. `axionia/src/i18n/routing.ts` — pathnames typés FR/EN.
6. `axionia/src/lib/seo.ts` + `JsonLd.tsx` — factories JSON-LD effectives.
7. `axionia/src/app/sitemap.ts` + `robots.ts` + `llms.txt/route.ts` + `llms-full.txt/route.ts` — SEO/AEO infra.
8. `axionia/src/app/globals.css` — tokens design effectifs.
9. `axionia/package.json` — stack réelle.
10. `axionia/.github/workflows/*.yml` — gates CI réels.
11. `axionia/SESSION_LOG.md` — journal append-only des sessions.
12. `axionia/docs/adr/*.md` — ADRs effectifs.

### Docs à AUDITER (et mettre à jour si périmées)

13. `_AUDIT/02b-mapping-pages.md` — mapping templates.
14. `_AUDIT/02-PLAN.md` — jalons M1-M11.
15. `_AUDIT/PROMPT-CODAGE.md` — DoD par sprint.
16. `_AUDIT/PROMPT-MAITRE.md` — phases d'audit.
17. `_AUDIT/PROMPT-FRONTEND-AUDIT-V14-2026.md` — audit transverse.
18. `_AUDIT/PROMPT-VERIFICATION-FINALE.md` — audit production.
19. `_AUDIT/PROMPT-FRONTEND-DEEP-CHECK.md` — audit nav/UX/design.
20. `_AUDIT/PROMPT-SPRINT-AUDIT.md` — DoD croisée.
21. `_AUDIT/PROMPT-PAGE-AUDIT-PERFECT-2026.md` — audit per-page.
22. `_AUDIT/PROMPT-PAGE-PRESSE.md` — sprint presse 14.6.
23. `_AUDIT/PROMPT-FRONTEND-PARITY-CHECK.md` — cohérence cross-pages.
24. `_AUDIT/PROMPT-SEO-AEO-GEO-2026.md` — audit SEO/AEO/GEO.
25. `axionia-package/docs/_DECISIONS-FINALES.md` — décisions stack verrouillées.
26. `axionia-package/docs/_NO-STRIPE.md` — interdiction Stripe.
27. `axionia/Design.md` — doctrine visuelle racine.
28. `axionia-package/.claude/skills/axionia-*/SKILL.md` — 18 skills.
29. `axionia-package/.claude/skills/CHANGELOG-LOCKS.md` — 22 LOCKs.
30. `AxionIA_Dossier_FINAL_ABSOLU_v10.1/CLAUDE.md` v6 — bible projet (à reviewer mais probablement source historique gelée).
31. Mémoire `~/.claude/projects/C--Users-willi/memory/axionia_*.md` — 8 fichiers.

---

## ⚖️ RÈGLES DU JEU

1. **Mode auto** — exécute, ne demande pas. STOP & ASK final uniquement.
2. **Lecture seule sur code** : `axionia/src/`, `axionia/public/`, `axionia/prisma/`, `axionia/tests/`, `axionia/scripts/`, `axionia/messages/`, `axionia/content/` — INTERDITS en écriture.
3. **Écriture autorisée uniquement** : fichiers `.md` dans `_AUDIT/`, `axionia/docs/`, `axionia/Design.md`, `axionia-package/docs/`, `axionia-package/.claude/skills/`, `~/.claude/projects/.../memory/`.
4. **Citations obligatoires** : pour chaque mise à jour, indiquer file_path:line_number du code source qui justifie la modification doc.
5. **Conventional Commits** : un commit par catégorie de docs (ex: `docs(audit): sync 02b-mapping-pages with HEAD code reality`, `docs(skills): align axionia-architecture with new content/* and routes`, `docs(adr): resolve 0002 duplicate + propose 0005/0006 commits`).
6. **WebFetch autorisé** pour validators externes uniquement.

---

## 🤖 DISPATCH MULTI-AGENTS (5 agents en parallèle)

| Agent              | Subagent | Mission                                                                                                                                                                                                                                                                                                  | Sortie partielle              |
| ------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| **AGT-PAGES**      | Explore  | Cartographie exhaustive des routes : lister toutes les pages dans `app/[locale]/`, leur type (listing/produit/transversal/légal/système), `generateMetadata`, JSON-LD utilisés, `'use client'` présents, hreflang, OG                                                                                    | `_AUDIT/sync-pages.json`      |
| **AGT-CONTENT**    | Explore  | Cartographie exhaustive `src/content/*.ts` : structure de chaque fichier, champs (FR/EN), parité, types TypeScript, helpers exposés (getInterventions, getAudit, etc.)                                                                                                                                   | `_AUDIT/sync-content.json`    |
| **AGT-COMPONENTS** | Explore  | Cartographie exhaustive `src/components/` : ui/, sections/, marketing/, nav/, layout/. Pour chaque composant : exports, props, variants, server vs client, tests associés                                                                                                                                | `_AUDIT/sync-components.json` |
| **AGT-INFRA**      | Explore  | Cartographie infra SEO/AEO/GEO : sitemap (entries), robots (rules), llms.txt + llms-full.txt (sections), routing (pathnames), seo.ts factories, JsonLd helpers, package.json scripts/deps                                                                                                                | `_AUDIT/sync-infra.json`      |
| **AGT-DOCS**       | Explore  | Lecture exhaustive des 31 docs sources (cf. § Sources). Identifier mentions chiffrées potentiellement périmées : "75 templates", "61 templates", "170 routes", "anti-formation", "complet/departement/point-de-vente/cabinet" (anciennes routes audit), "5 modules implementation", liste content/, etc. | `_AUDIT/sync-docs-stale.json` |

L'agent principal pendant ce temps : matrice diff code ↔ docs + plan de mise à jour priorisé.

---

# 📋 PHASE 1 — CARTOGRAPHIE (5 agents parallèles, 30-45 min)

Sortie attendue : 5 fichiers `sync-*.json` machine-readable + 1 synthèse `_AUDIT/sync-snapshot.md`.

**Format JSON commun** :

```json
{
  "agent": "AGT-PAGES",
  "scanned_at": "2026-05-07T...",
  "items": [
    { "path": "src/app/[locale]/presse/page.tsx", "type": "transversal", "metadata": {...}, "jsonld": [...], "useClient": false }
  ],
  "summary": { "total": 64, "byType": {...}, "newSinceV1": [...] }
}
```

# 📋 PHASE 2 — DIFF MATRICE (agent principal, 15-20 min)

Pour chaque doc source, identifier les écarts avec le code réel.

### Matrice écarts attendue

| Doc                               | Mention périmée                                               | Réalité code                                                                                           | Action                           |
| --------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------- |
| `02b-mapping-pages.md`            | "75 templates"                                                | 64 routes live + 6 ajoutées récemment = 70 effectifs                                                   | Réécrire mapping complet         |
| `02b-mapping-pages.md`            | `/audit/complet`                                              | `/audit/flash`, `/audit/process`, `/audit/strategique-pme`, `/audit/strategique-eti`, `/audit/demande` | Refactor module Audit            |
| `_DECISIONS-FINALES.md`           | (ne mentionne pas ADR 0003)                                   | ADR 0003 lift formation ban accepté 2026-05-07                                                         | Ajouter section "ADRs 0003-0004" |
| `_DECISIONS-FINALES.md`           | (ne mentionne pas ADR 0004)                                   | ADR 0004 typography v3.1 (text-base 18px override)                                                     | Ajouter                          |
| `PROMPT-CODAGE.md` Sprint 6       | "audit complet/departement/..."                               | nouvelles routes flash/process/...                                                                     | Réécrire Sprint 6                |
| Skills `axionia-architecture`     | (ne liste pas /presse, /stack-ia, /comparaisons, etc.)        | 64 routes incluant ces nouvelles                                                                       | Mise à jour                      |
| Skills `axionia-content-models`   | (ne liste pas press, stack-ia, comparaisons, automatisations) | 11 content/\*.ts effectifs                                                                             | Mise à jour                      |
| ADRs `axionia/docs/adr/`          | DOUBLON 0002 (2 fichiers `0002-*.md`)                         | 1 seul ADR 0002 attendu                                                                                | Renommer ou supprimer le périmé  |
| \_AUDIT/PROMPT-\* (10 prompts)    | Mentions "75 templates", anciennes routes                     | Réalité 64+ routes refactorées                                                                         | Sweep update                     |
| Mémoire `axionia_progress.md`     | Sprint 14.5 working copy                                      | Sprint 14.5 commité + 14.6 presse + visual rhythm A+B + AEO/GEO 2026 + audit Header/Nav                | Append nouveaux sprints          |
| Mémoire `axionia_design_pivot.md` | Pivot v3 commité simple                                       | + ADR 0004 typography v3.1 affinement                                                                  | Append delta                     |
| `axionia/Design.md`               | Type scale v3 (text-body 16px)                                | ADR 0004 v3.1 (text-base 18px override)                                                                | Sync chapitre 3.2                |
| `_AUDIT/02-PLAN.md`               | Jalons M1-M11 sans Sprint 14.5/14.6                           | + Sprint 14.5 pivot + 14.6 presse + visual rhythm + AEO/GEO + audit Header/Nav                         | Append                           |

# 📋 PHASE 3 — MISES À JOUR DOCS (agent principal, 30-60 min)

**Ordre prioritaire** :

### P0 (impact maximal)

1. **`_AUDIT/02b-mapping-pages.md`** — réécriture complète :
   - Nouveau total templates (lister les 64 routes + types).
   - Module 1 Interventions : conserver 6 pages.
   - **Module 2 Audit refactor** : `/audit` listing + `/audit/flash` + `/audit/process` + `/audit/strategique-pme` + `/audit/strategique-eti` + `/audit/demande` (formulaire) = 6 pages au lieu de 5.
   - **Module 3 Implementation** : 8 pages produits + `/par-fonction/[slug]` + `/par-techno` = 10+ pages.
   - **Section nouvelle « Pages éditoriales »** : `/comparaisons` + `[slug]`, `/glossaire`, `/guide-ia`, `/methodologie`, `/stack-ia`, `/presse`, `/recherche`.
   - **Section « Système »** mise à jour : `/accessibilite` ajouté, pages dev (/components, /sections, /design) marquées dev-only.
   - JSON-LD attendus mis à jour avec les 5 nouvelles factories (Person, FaqSpeakable, LocalBusiness, Place, ItemList).
2. **Doublon ADR 0002** : lire les 2 fichiers, identifier celui qui doit rester (probablement `0002-design-pivot-editorial-v3.md`), renommer l'autre `0002b-design-direction-editorial-premium-archived.md` ou supprimer si redondant.
3. **`axionia-package/docs/_DECISIONS-FINALES.md`** : ajouter section « ADRs ratifiés depuis 2026-05-06 » avec ADR 0003 + 0004 + statut des proposés 0005/0006.

### P1 (cohérence projet)

4. **`_AUDIT/PROMPT-CODAGE.md`** v3.0 → v3.1 :
   - Sprint 6 : refactor module Audit.
   - Sprint 14.5 : pivot v3 commité (déjà appliqué) + delta ADR 0004 typography v3.1.
   - Sprint 14.6 : page presse (livré commit `38879bc`).
   - Sprint 14.7 : visual rhythm A+B (livré commit `dbc39b3`).
   - Sprint 14.8 : AEO/GEO 2026 (livré commits `eda574b`, `5d9d527`, `c884adc`).
   - Sprint 14.9 : audit Header/Nav 2026 + ADRs proposés 0005/0006.
5. **Skills `axionia-architecture`** : refléter les 64 routes effectives, nouvelles pages éditoriales, refactor audit.
6. **Skills `axionia-content-models`** : refléter les 11 content/\*.ts (ajouter press, stack-ia, comparaisons, automatisations).
7. **Skills `axionia-seo-aeo`** : référencer les 5 nouvelles factories + sitemap-index split + Person /a-propos + FaqSpeakable.

### P2 (polish + sweep)

8. **Tous les `_AUDIT/PROMPT-*.md` (10 prompts)** : sweep mention « 75 templates » → chiffre réel, anciennes routes audit → nouvelles, mention ADR 0003+0004.
9. **`axionia/Design.md`** chapitre 3.2 : sync avec ADR 0004 typography v3.1 (text-base 18px override).
10. **`_AUDIT/02-PLAN.md`** : append Sprint 14.5 → 14.9 livrés + ADRs proposés 0005/0006 dans pipeline.
11. **Mémoire `axionia_progress.md` + `axionia_audit_sequence.md` + `axionia_design_pivot.md`** : append état actuel HEAD.

### P3 (nice-to-have)

12. ADRs proposés 0005 (mega-menu) + 0006 (pSEO villes V1=2150) : commiter en `axionia/docs/adr/0005-*.md` + `0006-*.md` avec statut « proposed » s'ils ne sont pas rejected (à valider Will).
13. Initialiser `axionia/CHANGELOG.md` skeleton (sera rempli Sprint 21).

# 📋 PHASE 4 — AUDIT QUALITÉ (agent principal, 15 min)

Format : 3 sections concises **après** les mises à jour docs.

### 4.A — Points positifs (top 10)

- Vélocité (~30 commits en 36-48h).
- Architecture solide (sitemap-index Next 16, 5 factories JSON-LD, 11 content/\*).
- Doctrine v3 commitée + ADR 0004 affinement scientifique typo.
- AEO/GEO 2026 quasi parfait (Person /a-propos, FaqSpeakable, BlogPost.updatedAt).
- Refactor module Audit avec routes plus claires et orientées B2B.
- 71 tests verts maintenus malgré les refontes.
- Decision-making rigoureux (ADR + audit + benchmark + arbitrage Will).
- Correctifs UX critiques livrés (toggle FR/EN persiste page, save&resume forms, header price badge).
- Sitemap-index split avec generateSitemaps Next 16.
- llms.txt + llms-full.txt en routes Next 16 (régénérables).

### 4.B — Points négatifs / risques (top 10)

- **Documentation périmée** sur 9+ fichiers majeurs (priorité #1).
- **Doublon ADR 0002** (2 fichiers `0002-*.md` dans `axionia/docs/adr/`) — confusion.
- **22 commits ahead** de `origin/main` non pushés — risque perte sur incident local.
- **2 ADRs proposés** (0005, 0006) en `_AUDIT/` non committed dans `axionia/docs/adr/` — pas de traçabilité formelle.
- **Skills non synchronisés** avec les 11 content/\*.ts et 64 routes.
- **Pages dev** (`/components`, `/sections`, `/design`) en prod build sans gate `NODE_ENV !== 'production'`.
- **CHANGELOG.md absent** du repo (à initialiser).
- **Parité FR/EN** sur les nouveaux content/\* (press, stack-ia, comparaisons, automatisations) à vérifier exhaustivement.
- Pas de **CI gate** spécifique vérifiant que doc reflète code (sync drift facile).
- **64 routes vs 75 templates initiaux** : décalage à expliciter (mapping a évolué, certaines pages ont été abandonnées ou regroupées).

### 4.C — Recommandations priorisées

- **P0 immédiat** : exécuter ce prompt (Phase 1-3) puis push origin/main si Will valide.
- **P1 cette semaine** : push 22 commits ahead, commit ADRs 0005/0006 en proposed, sync skills.
- **P1 avant Sprint 15** : page presse manque (registrikood, VAT, bio, communiqués réels, photos).
- **P2 Sprint correctif** : conditionner pages dev à `NODE_ENV !== 'production'`, parité FR/EN exhaustive new content/\*, CI gate doc-code drift.
- **P2 plus tard** : Sprint 15 démarre confortable une fois docs sync + ADR 0006 (pSEO villes) tranché par Will.

---

# 📊 SORTIE — `_AUDIT/DOC-SYNC-REPORT-V14.md`

```markdown
# Doc Sync Report V14 — AxionIA

- Date : 2026-MM-DD
- Auditeur : Claude Opus 4.7 (1M context) + 5 agents
- HEAD audité : <sha>
- Docs scannées : 31
- Docs mises à jour : N

## 1. Verdict

- [ ] DOCS PARFAITEMENT SYNCHRONISÉES ✅
- [ ] DOCS QUASI-SYNC (P3 résiduels) ⚠️
- [ ] DOCS PARTIELLEMENT SYNC (P0/P1 résolus, P2 reportés) ⚠️

## 2. Docs mises à jour (par catégorie)

### P0

- `_AUDIT/02b-mapping-pages.md` (réécriture) : 75 → N templates, refactor Audit, +6 pages éditoriales. [diff lien]
- ADR 0002 doublon résolu : <action>.
- `_DECISIONS-FINALES.md` : section ADRs 0003+0004 ajoutée.

### P1

- `PROMPT-CODAGE.md` v3.0 → v3.1 : Sprint 6 refactor + Sprints 14.5-14.9 livrés.
- Skills `axionia-architecture` + `axionia-content-models` + `axionia-seo-aeo` sync.

### P2

- 10 prompts `_AUDIT/PROMPT-*.md` sweep mentions chiffrées.
- `axionia/Design.md` chapitre 3.2 sync ADR 0004.

### P3

- ADRs 0005 + 0006 commitement proposed (si Will valide).
- `axionia/CHANGELOG.md` skeleton.

## 3. Audit qualité (positifs/négatifs/recos) — cf. Phase 4 ci-dessus.

## 4. Diff matrice complète

[Tableau exhaustif code ↔ docs avec verdict ✅/❌ par ligne]

## 5. Annexes

- A — Cartographie complète routes (`sync-pages.json`)
- B — Cartographie content (`sync-content.json`)
- C — Cartographie composants (`sync-components.json`)
- D — Cartographie infra SEO/AEO (`sync-infra.json`)
- E — Liste docs périmées (`sync-docs-stale.json`)
- F — Snapshot consolidé (`sync-snapshot.md`)

## 6. Recommandation Will

- ☐ OUI commit + push origin/main les mises à jour docs
- ☐ CONTINUE commits locaux, push différé
- ☐ STOP review manuelle avant commit
```

---

# ▶️ DÉMARRAGE

1. **Confirme** en 5 lignes : scope, agents, durée, sortie, mode lecture-seule code.
2. **Lance les 5 agents en parallèle** (1 message).
3. Pendant : agent principal lit les 31 docs sources et prépare la matrice diff.
4. À la fin Phase 1 : agréger les 5 sortie JSON + matrice diff.
5. **STOP & ASK Will** avant Phase 3 mises à jour : présenter matrice + plan priorisé + question fermée « OUI je sync tout / CONTINUE P0+P1 seulement / STOP review manuelle ».
6. Phase 3 selon arbitrage Will.
7. Phase 4 audit qualité final.
8. Renvoie verdict global + commandes de commit Conventional Commits prêtes à exécuter.
