# AUDIT FRONTEND V14-2026 — Axion-IA

**Working dir** : `axionia/` (sous-repo Next.js 16, branche `main`)
**HEAD** : `941a8e1` (22 commits ahead `origin/main`, range `5942d2f → 941a8e1`, 2026-05-06 → 2026-05-07)
**Working tree** : clean
**Méthode** : 5 agents parallèles, lecture seule strict, mode auto
**Doctrine** : HEAD = doctrine commitée officielle, fait foi (audit cohérence intra-repo, sans référence externe)
**Date audit** : 2026-05-07

---

## Verdict global

# ✅ **GO Sprint 15**

| Discipline                       | Verdict            | P0          | P1    | P2     | P3    |
| -------------------------------- | ------------------ | ----------- | ----- | ------ | ----- |
| A. DoD croisée Sprints 0-14      | ✅ GO              | 0           | 2     | 0      | 0     |
| B. Couverture 75 templates + nav | ✅ GO              | 0           | 1     | 3      | 0     |
| C. SEO + AEO + GEO 2026          | ⚠️ GO conditionnel | 2 (contenu) | 5     | 0      | 0     |
| D. Cohérence transverse          | ✅ GO              | 0           | 0     | 5      | 5     |
| E. A11y + Perf + Tests           | ✅ GO              | 0           | 0     | 3      | 2     |
| **TOTAL**                        | ✅ GO              | **2**       | **8** | **11** | **7** |

Les 2 P0 cumulés sont **du contenu éditorial** (`dateModified` articles + bio Will + registrikood EE) — **non bloquants pour démarrer Sprint 15 backend** (peuvent être corrigés en parallèle, effort ~3h30).

---

## Résumé exécutif

### Ce qui est solide

- **Sprints 0-14 livrés** (57+ pages, 71/71 tests verts, 5 anti-banni gates au vert)
- **Doctrine v3 Editorial Premium Light cohérente** : 256 occurrences `Axion-IA` canoniques, 27/30 hero avec pattern titleEm italique terracotta, 35 pages avec eyebrow + dot, header `bg-terracotta` figé confirmé
- **0 hex hardcodé non-justifié** hors `globals.css`, **0 `any`**, **0 `@ts-ignore`**, **0 import `../../../`**, **0 TODO/FIXME**
- **i18n parité parfaite** : 145 keys fr=en, 0 occurrence "formation/siren/payment provider/email provider"
- **Infra perf complète** : `viewTransition`, `next/font`, `WebVitals` beacon, Speculation Rules, `lighthouserc`, `size-limit`, bundle analyzer
- **JSON-LD couvert** : Organization + WebSite centralisés, BreadcrumbList helper, 20+ types Schema.org utilisés
- **AEO infra solide** : `llms.txt` + `llms-full.txt` + 3 RSS feeds + IndexNow endpoint

### Ce qui doit être corrigé (P0 contenu, ~3h30)

- **C-P0-1** : `dateModified` absent sur articles blog/cas-concrets (datePublished seul)
- **C-P0-2** : Bio Will trop courte (< 30 chars vs 150-200 attendus pour E-E-A-T)
- **C-P0-3** : `registrikood` + VAT EE = "à compléter" dans `legal.ts:40`

### Dettes acceptables (P1-P3)

- SESSION_LOG ne couvre que Sprint 0 + 5b (rétro Sprints 1-4, 6-9 manquante)
- Pivot v3 dispersé sur plusieurs commits (pas de commit atomique `feat(design): pivot v3`)
- Page `/maintenance` absente (acceptable — `error.tsx` couvre)
- Composant visuel `Breadcrumbs.tsx` jamais rendu (JSON-LD via helper OK)
- Organization JSON-LD émis 2x (layout + home) — à dédupliquer
- Dual calendar (`HouseCalendar` legacy + `BookingCalendar` nouveau) — à clarifier
- 5 forms en mode stub (`console.warn [*:submit:stub]`) — endpoints mail à câbler Sprint 16+

---

## Annexes

| Annexe                            | Contenu                                        | Lead agent      |
| --------------------------------- | ---------------------------------------------- | --------------- |
| [A](AUDIT-FRONTEND-V14-2026-A.md) | DoD croisée Sprints 0-14                       | AGT-DOD         |
| [B](AUDIT-FRONTEND-V14-2026-B.md) | Couverture 75 templates + Navigation profonde  | AGT-COVERAGE    |
| [C](AUDIT-FRONTEND-V14-2026-C.md) | SEO + AEO + GEO 2026                           | AGT-SEO-AEO-GEO |
| [D](AUDIT-FRONTEND-V14-2026-D.md) | Cohérence transverse + Doctrine interne        | AGT-COHERENCE   |
| [E](AUDIT-FRONTEND-V14-2026-E.md) | A11y WCAG 2.2 + Perf + Cross-browser + Tests   | AGT-QUALITY     |
| [F](AUDIT-FRONTEND-V14-2026-F.md) | Méthodologie tools indisponibles cette session | Synthèse        |
| [G](AUDIT-FRONTEND-V14-2026-G.md) | Plan remédiation pré-Sprint 15                 | Synthèse        |

Deltas machine-readable : [`AUDIT-FRONTEND-V14-deltas.json`](AUDIT-FRONTEND-V14-deltas.json)

---

## État Doctrine (Partie D.5 — référence interne, HEAD fait foi)

**Tokens v3 consommés** (palette éditoriale Premium Light) :

| Token                                | Occurrences | Rôle                                                 |
| ------------------------------------ | ----------- | ---------------------------------------------------- |
| `--color-terracotta`                 | 43          | Signature dominante (eyebrow dot, italic em, header) |
| `--color-primary`                    | 22          | CTA blue saillant                                    |
| `--color-sage`                       | 20          | Accent secondaire                                    |
| `--color-paper`                      | 8           | Logo badge                                           |
| `--color-mocha` / `--color-mocha-fg` | 5           | Footer dark + active nav                             |
| `--color-sand`                       | 1           | Mobile drawer active                                 |
| `--color-fg` / `--color-bg`          | 9           | Neutres                                              |

**Polices chargées** (`layout.tsx:17-39`) : Manrope (sans), Inconsolata (mono), Fraunces (serif éditorial titleEm) — toutes via `next/font/google` `display:swap`.

**Header pattern figé** (`Header.tsx:29`) : `bg-terracotta border-terracotta-deep` constant, sticky, pas de scroll-aware. Server Component. Confirmé par commit `941a8e1` "fix(header): retire scroll-aware".

**Pattern hero** : `Section titleAs="h1"` avec eyebrow → halo-warm + display-editorial + dot terracotta automatiques (`Section.tsx:265`). 27/30 pages H1 utilisent titleEm italique terracotta. 3 exceptions justifiées (centre-aide/[slug] + faq/[slug] dynamiques + sections/page.tsx showcase).

**Anti-banni gates (verify:all)** :

```
pnpm anti-formation:check    OK — 0 banned occurrence
pnpm anti-siren:check        OK — 0 occurrence
pnpm anti-hex:check          OK — 0 hardcoded hex
pnpm contrast:check          OK — 30 paires WCAG AA+
pnpm radius:check            OK — no functional > 8px
pnpm use-client:check        OK — all justified
pnpm i18n:check              OK — 145 keys in sync
pnpm test                    OK — 71/71 (15 files)
```

---

## Question fermée pour Will

Le verdict est **GO Sprint 15** avec 2 P0 contenu à compléter en parallèle (3h30 total). Les corrections P0 ne bloquent ni le démarrage du backend (Auth.js, BullMQ, email maison) ni le push des 22 commits.

**Quel est ton choix ?**

- **OUI** → Lancer Sprint 15 (backend) immédiatement. Les P0 contenu (dateModified, bio, registrikood) seront corrigés en sub-task parallèle ou différés à Sprint 16.
- **CONTINUE** → Lancer Sprint 15 ET corriger les P0 contenu maintenant (ordre : registrikood 10min, dateModified 2h, bio 1h).
- **STOP corrections** → Ne pas démarrer Sprint 15, corriger d'abord toutes les P0 + P1 listées dans l'annexe G (effort total ~7h30).
- **STOP doctrine** → Tu veux re-ouvrir la doctrine v3 commitée. Préciser ce que tu veux changer ; je rouvre la séquence design avant tout backend.

Décision attendue.
