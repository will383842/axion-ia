# 25 — PROFESSIONAL STANDARDS 2026

> **Audit standards SaaS premium professionnels** : ADRs, runbooks, postmortems, onboarding, diagrammes, browser matrix, feature flags, versioning, changelog, tech debt, incident response.
> Lancer fenêtre fraîche.

## 0. Contexte

Pour atteindre le niveau "très professionnel" attendu d'un cabinet IA B2B premium :

- Documentation exhaustive et à jour
- Process décisionnels formalisés
- Onboarding nouveau dev en < 1 jour
- Incident response playbook
- Tech debt maîtrisé

## 1. Audit en 10 chapitres × 10 critères = 100 points

### Chapitre 1 — ADRs (Architecture Decision Records)

1.1 Tous les ADRs présents dans `docs/adr/`
1.2 Numérotation continue (0001 → N)
1.3 Format cohérent (Statut + Date + Auteur + Contexte + Décision + Conséquences + Alternatives)
1.4 Index ADR à jour (`docs/adr/README.md` ou `docs/adr/INDEX.md`)
1.5 ADR statut maintenu (Accepted, Deprecated, Superseded)
1.6 Cross-references entre ADRs liés
1.7 1 ADR par décision majeure (pas de regroupement vague)
1.8 Process ADR documenté (qui peut proposer, qui valide)
1.9 ADR linked depuis CLAUDE.md ou Design.md
1.10 ADRs reviewables par un nouveau dev

### Chapitre 2 — Runbooks ops

2.1 Runbook deploy production (étape par étape)
2.2 Runbook rollback (en < 5 min)
2.3 Runbook incident (DB down, Cloudflare down, Hetzner down)
2.4 Runbook backup + restore (test annuel)
2.5 Runbook secret rotation (env vars, DB password)
2.6 Runbook nouvelle ville pSEO publication
2.7 Runbook investigation page lente
2.8 Runbook investigation page non indexée
2.9 Runbook investigation pic traffic / DDoS
2.10 Tous runbooks dans `docs/runbooks/` à jour

### Chapitre 3 — Postmortem & incident response

3.1 Template postmortem (`docs/postmortems/_TEMPLATE.md`)
3.2 Sections : timeline, impact, root cause, what went well, what went wrong, action items
3.3 Postmortem obligatoire pour incident > 30 min downtime
3.4 Postmortem partagé (même si Will solo, archive pour soi)
3.5 Action items trackés jusqu'à closure
3.6 Blameless culture documentée
3.7 Incident severity levels définis (SEV1/2/3)
3.8 SEV1 : runbook escalation
3.9 Status page communication (si client B2B impacté)
3.10 Postmortem trimestriel review (apprentissages)

### Chapitre 4 — Onboarding nouveau dev

4.1 `docs/ONBOARDING.md` : setup en < 30 min
4.2 Stack documenté (Node 22, pnpm, etc.)
4.3 Variables d'environnement documentées (`.env.example` complet)
4.4 Dépendances système documentées
4.5 Première contribution facile listée (good first issues)
4.6 Architecture overview (1 page)
4.7 Codebase tour (composants critiques expliqués)
4.8 Doctrine projet expliquée (CLAUDE.md, Design.md, ADRs)
4.9 Gates CI expliquées
4.10 Process review PR documenté

### Chapitre 5 — Diagrammes & docs visuelles

5.1 Architecture diagram (C4 model L1 + L2 minimum)
5.2 Data flow diagram (utilisateur → CF → Caddy → Next → DB)
5.3 Sequence diagram pour flows critiques (booking, audit purchase)
5.4 Schéma DB ERD (`prisma/erd.svg` auto-généré)
5.5 Diagramme indexation pSEO (publish → ISR → CF purge → IndexNow)
5.6 Schéma Coolify topology
5.7 Schéma backup/restore
5.8 Tous diagrammes versionés (PlantUML, Mermaid, draw.io source)
5.9 Diagrammes maintenus (review trimestriel)
5.10 Embedded dans README ou docs principales

### Chapitre 6 — Browser support matrix & compat

6.1 Matrice browsers cibles documentée (`docs/BROWSER-SUPPORT.md`)
6.2 Niveaux : Tier 1 (full support), Tier 2 (graceful degrade)
6.3 Tier 1 typique 2026 : Chrome 120+, Edge 120+, Firefox 120+, Safari 17+
6.4 Mobile : iOS Safari 17+, Chrome Android 120+
6.5 Pas de polyfill IE11 (out of support)
6.6 ES2022+ ciblé (esnext)
6.7 CSS modern : `:has()`, container queries, view transitions (avec fallback)
6.8 Test cross-browser via Playwright (Chrome + Firefox + WebKit)
6.9 BrowserStack pas nécessaire V1 (Playwright suffit)
6.10 Compat issues tracker (`docs/BROWSER-ISSUES.md` si nécessaire)

### Chapitre 7 — Feature flags & rollout

7.1 Stratégie feature flags décidée (DB-driven, env vars, ou OSS comme Unleash)
7.2 ADR sur la stratégie
7.3 Helper `lib/flags.ts` simple
7.4 Flags persistés (DB ou config file)
7.5 Toggle sans redeploy (DB ou hot reload)
7.6 Audit log des toggles (qui, quand, quoi)
7.7 Cleanup des flags obsolètes (process trimestriel)
7.8 Rollout progressif (10 % → 50 % → 100 %)
7.9 A/B testing ready (cohort assignment stable)
7.10 Documentation flag utilisé/à supprimer

### Chapitre 8 — Versioning, Changelog, Tech debt

8.1 Semver respecté (MAJOR.MINOR.PATCH)
8.2 CHANGELOG.md à jour (format Keep a Changelog)
8.3 Release notes auto-générées (depuis commits conventionnels)
8.4 Tags git par release (`v1.2.3`)
8.5 Migration notes entre majeurs (breaking changes)
8.6 Tech debt log (`docs/TECH-DEBT.md`) — liste explicite avec priorité
8.7 Refactor budget (% temps allouée maintenance vs feature)
8.8 Dépréciation procedure (deprecate → warning → remove)
8.9 Dependabot weekly (déjà OK)
8.10 Audit trimestriel `pnpm outdated`

### Chapitre 9 — Code review & PR process

9.1 PR template présent (`.github/pull_request_template.md`)
9.2 PR template sections : Summary / Test plan / Screenshots / Linked issue / Breaking changes / Checklist
9.3 Issue templates présents (`.github/ISSUE_TEMPLATE/`)
9.4 Issue templates : bug report / feature request / docs / question
9.5 Conventional Commits enforcés (`commitlint` déjà ✅)
9.6 Branch naming convention documentée (`feat/`, `fix/`, `chore/`, `docs/`)
9.7 Code review checklist (`.github/CODEOWNERS` ou doc)
9.8 PR self-review obligatoire avant merge (Will solo)
9.9 Squash & merge ou rebase strategy documentée
9.10 Auto-delete branch après merge

### Chapitre 10 — Governance & evolution

10.1 RFC process pour changements majeurs (template ADR ou RFC)
10.2 Roadmap publique ou privée maintenue (Sprint 0-23 → V1 → V2)
10.3 Decision log (`docs/decisions/` ou ADRs équivalent)
10.4 Tech radar (technos en eval, en adoption, en déprécation)
10.5 Audit budget alloué (% temps maintenance technique)
10.6 Dette technique trackée + priorisée
10.7 Sprints rétrospective (Will mensuel solo)
10.8 Backlog organisé (GitHub Issues, Linear, ou markdown)
10.9 Release cadence documentée (continuous deploy ou versionned)
10.10 Communication changements (CHANGELOG + release notes utilisateur si applicable)

## 2. Méthode

### Phase A — Inventaire docs existantes

### Phase B — Diagnostic /100

### Phase C — Plan

- Identifier docs manquantes
- Templates à créer (postmortem, onboarding, runbook)
- ADRs à formaliser (rétro-actif si décisions implicites)
- Diagrammes à produire

### Phase D — STOP & ASK

Livre :

- `audit-25-pro-standards-SYNTHESE.md`
- `audit-25-pro-standards-DIAGNOSTIC.md`
- `audit-25-pro-standards-PLAN.md`
- `audit-25-pro-standards-DOCS-A-CREER.md` (liste exhaustive)

### Phase E — Application après GO

## 3. STOP & ASK

1. Avant choix outil feature flags (vendor lock-in)
2. Avant ajout dépendance docs (Docusaurus, etc.)
3. Avant tout commit
4. Si > 10 docs critiques manquantes (signal lourd)

## 3bis. Anti-patterns à éviter (Pitfalls)

- ❌ ADR rétroactif (« on documente quand ça marche ») — perte du « pourquoi »
- ❌ Runbooks théoriques jamais testés (faux sens de sécurité)
- ❌ Postmortem blame culture (perd info, intimide)
- ❌ Onboarding doc obsolète (stack changé, scripts cassés)
- ❌ Diagrammes ascii-only sans source versionable (perdus)
- ❌ Browser matrix non testée (cibles théoriques)
- ❌ Feature flags jamais nettoyés (dette compounding)
- ❌ CHANGELOG.md « auto-générer plus tard »
- ❌ Tech debt log absent (dette invisible)
- ❌ PR template sans checklist self-review
- ❌ Roadmap publique non maintenue (signal d'abandon)

## 4. Cible

> _« Documentation niveau SaaS premium : 100 % ADRs à jour, runbooks ops complets, postmortem template prêt, onboarding < 30 min, diagrammes architecture présents, browser matrix documentée, feature flags strategy claire, semver + changelog rigoureux, tech debt log maintenu. Un nouveau dev contribue en < 1 jour. »_

## 5. Livrables

```
audit-25-pro-standards-SYNTHESE.md
audit-25-pro-standards-DIAGNOSTIC.md
audit-25-pro-standards-PLAN.md
audit-25-pro-standards-DOCS-A-CREER.md
```

---

**FIN DU PROMPT 25.**
