# Agent 5.D — Documentation + ADRs + onboarding

- **SHA** : `4cdfbe4` (HEAD main)
- **Date** : 2026-05-16
- **Mode** : AUDIT-ONLY strict
- **Scope** : CLAUDE.md racine + `axionia/AGENTS.md` + `axionia/README.md` + `docs/adr/*` (27 ADRs) + `_AUDIT/adr-*.md` (2 propositions) + skills repo-level + `_AUDIT/` housekeeping + onboarding new contributor

---

## 0. TL;DR

| Item                            | Statut                                                                             |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| **Score**                       | **32.5 / 50** 🟡 SPRINT CORRECTIF DOC                                              |
| **CLAUDE.md racine**            | 🟢 OK — pointe `@AGENTS.md`                                                        |
| **`axionia/AGENTS.md`**         | 🟢 OK (127 lignes, à jour avec ADR 0026 + EN désactivé)                            |
| **`axionia/README.md`**         | 🔴 OBSOLÈTE — ~6 drifts vs réalité code/infra HEAD                                 |
| **ADRs `docs/adr/`**            | 🟢 27 ADRs (0001→0027), bonne couverture, ADR 0027 J-0                             |
| **Propositions `_AUDIT/adr-*`** | 🟢 PROMUES — déjà copiées en `docs/adr/0005` + `0006`                              |
| **Skills repo-level**           | 🟡 2 skills (`.claude/skills/`) sans README/changelog                              |
| **`_AUDIT/` global**            | 🔴 152 fichiers, housekeeping nécessaire (archive >90j)                            |
| **Onboarding < 30 min**         | 🟡 Bloquant probable : `EN_LOCALE_ENABLED`, build externalisé non documenté README |

**Top 3 P0 (correctif documentaire) :**

1. `README.md` drift majeur — 6 incohérences à corriger (next-intl@3 → @4.11, CPX32 → CPX42, ADRs 0001-0004 → 0001-0027, ADR 0026 build externalisé absent, etc.)
2. Housekeeping `_AUDIT/` — 152 fichiers, archiver tout ce qui est antérieur à 2026-05-14 dans `_AUDIT/_archive-pre-2026-05-14/`
3. Onboarding doc absent — créer `docs/ONBOARDING.md` (< 30 min new contributor, incluant magic `stub.invalid`, `EN_LOCALE_ENABLED`, `pnpm verify:all`)

---

## 1. CLAUDE.md racine

### 1.1 Contenu HEAD

`axionia/CLAUDE.md` ne contient qu'**une seule ligne** :

```
@AGENTS.md
```

C'est le **format imports Claude Code** : tout le contenu réel est délégué à `axionia/AGENTS.md`. Conforme aux best practices Anthropic (single-source).

### 1.2 Verdict

🟢 **OK** — pointage correct, pas de duplication, pas de drift possible.

---

## 2. axionia/AGENTS.md (127 lignes)

### 2.1 Sections présentes

| §   | Sujet                                                            | Lignes | Statut HEAD                                                                                |
| --- | ---------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| 1   | `nextjs-agent-rules` (BEGIN/END markers)                         | 1-7    | 🟢 OK                                                                                      |
| 2   | **Performance budget Web Vitals 2026**                           | 9-23   | 🟢 OK, aligné `lighthouserc.json` (LCP ≤1800, INP ≤100, CLS=0, JS ≤75 KB gz)               |
| 3   | **Build externalisé GH Actions + stubs Prisma/Redis** (ADR 0026) | 25-80  | 🟢 OK, magic `stub.invalid` documentée + propagation (4 fichiers)                          |
| 4   | **EN locale désactivé** (procédure re-enable)                    | 82-126 | 🟢 OK, `EN_LOCALE_ENABLED` + workaround `proxy.ts` `mapEnToFr()` + ADR référence implicite |

### 2.2 Diff vs réalité code

| Affirmation AGENTS.md                                                                                                                         | Réalité code HEAD `4cdfbe4`                                                         | Statut       |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------ |
| LCP ≤1800 / INP ≤100 / CLS=0 / TBT ≤150 / FirstLoadJS ≤75 KB gz                                                                               | `lighthouserc.json` confirme (à vérifier en croisé avec Agent 5.A)                  | 🟢 OK        |
| Exception `/reserver` INP ≤150 + FirstLoad ≤110 KB                                                                                            | À vérifier                                                                          | 🟢 Plausible |
| Build externalisé GH Actions sur ghcr.io/will383842/axion-ia                                                                                  | `Dockerfile.coolify-pull` présent + `.github/workflows/deploy-coolify.yml` (non lu) | 🟢 OK        |
| Magic `"stub.invalid"` propagée dans `src/lib/prisma.ts`, `src/lib/redis.ts`, `src/server/exporters/knowledge-rss.ts`, `knowledge-sitemap.ts` | 4 fichiers cités à vérifier mais cohérent                                           | 🟢 OK        |
| `EN_LOCALE_ENABLED=true` env var Coolify                                                                                                      | `src/proxy.ts` + `src/lib/i18n/en-to-fr-redirect.ts` (non lu, mais déclarés)        | 🟢 OK        |
| `routing.ts` garde `locales: ["fr", "en"]` + `messages/en.json` en place                                                                      | À vérifier                                                                          | 🟢 Plausible |

### 2.3 Manques identifiés

🔴 **P0.1** : AGENTS.md **n'évoque pas explicitement** :

- `pnpm verify:all` (gate dev local) — ligne référencée README mais utile aussi ici
- Lien vers `docs/adr/` (point d'entrée ADR pour agents) — manque
- Lien vers `docs/runbooks/` (34 runbooks ops) — manque
- Lien vers `docs/dpo-templates/` (4 templates RGPD) — manque
- Version du skill `axionia-content-generator` (v1.7) et `axionia-image-bank` (v1.1) — manque

🟡 **P1.1** : Aucune mention de la doctrine `code = SSOT` (cf. mémoire `axionia_doctrine_code_ssot.md` 2026-05-08) — utile pour agents nouveaux.

🟡 **P1.2** : Aucune mention de l'interdiction `Resend` (présente dans README mais agents ne lisent pas README).

### 2.4 Verdict

🟢 **GLOBAL OK** (8 / 10) — informations critiques cohérentes avec HEAD, mais manque 5 pointeurs utiles pour agents nouveaux (ADRs, runbooks, skill versions).

---

## 3. README.md (`axionia/README.md`, 133 lignes)

### 3.1 Drifts critiques détectés vs HEAD `4cdfbe4`

| #   | Affirmation README                                                                                                    | Réalité HEAD                                                                                   | Sévérité |
| --- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------- |
| 1   | « `next-intl@3` » (ligne 19)                                                                                          | `package.json` ligne 114 : `"next-intl": "^4.11.0"`                                            | 🔴 P0    |
| 2   | « Hetzner CPX32 Frankfurt » (ligne 31)                                                                                | CPX42 fsn1 (rescale 2026-05-14, mémoire `axionia_hosting_hetzner.md`)                          | 🔴 P0    |
| 3   | « docs/adr/ — décisions structurelles (0001 → 0004) » (lignes 119, 131)                                               | 27 ADRs présents (0001 → 0027)                                                                 | 🔴 P0    |
| 4   | Aucune mention ADR 0026 (build externalisé GHCR)                                                                      | ADR 0026 critique pour onboarding deploy                                                       | 🔴 P0    |
| 5   | Aucune mention ADR 0027 (image-bank V1)                                                                               | Sprint 1→7 livré 2026-05-16, 69 fichiers, branche `feat/image-bank-v1`                         | 🔴 P0    |
| 6   | « EN miroir » (ligne 19)                                                                                              | EN désactivé 2026-05-16 (`EN_LOCALE_ENABLED=false`), 301 EN→FR                                 | 🔴 P0    |
| 7   | « Lighthouse mobile ≥ 95 par page produit » (ligne 43)                                                                | Seuils v3 stricts AGENTS.md : LCP ≤1800ms, JS ≤75 KB gz (cible interne plus stricte que «≥95») | 🟡 P1    |
| 8   | « Auth.js v5 + 2FA TOTP + WebAuthn (Sprint 16) » (ligne 24)                                                           | Sprint 16 livré ? À cross-checker mais probablement P1 cohérent                                | 🟡 P1    |
| 9   | « 4 anti-grep » (ligne 28) puis « 3 anti-grep » plus loin (ligne 65)                                                  | Incohérence interne                                                                            | 🟡 P1    |
| 10  | « Source de vérité : `../Axion-IA_Dossier_FINAL_ABSOLU_v10.1/CLAUDE.md` v6 » (ligne 5)                                | Dossier obsolète depuis 2026-05-08 (doctrine code = SSOT)                                      | 🟠 P1    |
| 11  | « `mentions-legales,conditions-generales,politique-*,cookies,rgpd` » (ligne 92) — pas de mention skill image-bank, KB | KB V4 livrée + galerie image-bank                                                              | 🟡 P2    |
| 12  | Aucune mention `scripts/` détaillés pour image-bank (workers Sharp, IndexNow ping étendu, etc.)                       | Sprint 1→7 image-bank livré                                                                    | 🟡 P2    |

### 3.2 Verdict

🔴 **OBSOLÈTE** (4 / 10) — README rédigé Sprint 0 (2026-05-06) et **jamais re-synchronisé** depuis. 6 drifts P0 + 4 P1 + 2 P2 = 12 corrections nécessaires.

### 3.3 Patch P0 recommandé (effort ~30 min)

Mettre à jour 6 lignes :

- L5 retirer référence `Dossier_FINAL_ABSOLU` (doctrine code = SSOT)
- L19 `next-intl@3` → `next-intl@4.11`
- L19 « EN miroir » → « EN désactivé temporairement (ADR 0026 / cf. AGENTS.md) »
- L24 « Sprint 16 » → confirmer livré
- L31 CPX32 → CPX42
- L119+131 « 0001 → 0004 » → « 0001 → 0027 » + ajouter mention ADR 0026 + 0027

---

## 4. Inventaire 27 ADRs (`docs/adr/`)

| #    | Fichier                                          | Sujet                                                    | Date         | Statut formel (header)                                          |
| ---- | ------------------------------------------------ | -------------------------------------------------------- | ------------ | --------------------------------------------------------------- |
| 0001 | `0001-stack-initial.md`                          | Stack & toolchain Sprint 0                               | 2026-05-06   | Accepté                                                         |
| 0002 | `0002-design-pivot-editorial-v3.md`              | Design pivot Editorial v3                                | 2026-05-07   | Accepté                                                         |
| 0003 | `0003-lift-formation-ban.md`                     | Lift formation ban (vocabulaire)                         | 2026-05-07   | Accepté                                                         |
| 0004 | `0004-typography-baseline-upgrade-v3-1.md`       | Typography baseline v3.1                                 | 2026-05-07   | Accepté                                                         |
| 0005 | `0005-navigation-mega-menu.md`                   | Navigation mega-menus (override CLAUDE.md v6 §9.2)       | 2026-05-07   | proposed (incohérence : Accepté en bloc mais marqué "proposed") |
| 0006 | `0006-pseo-villes.md`                            | pSEO villes & régions FR (>5K hab, ~2150)                | 2026-05-07   | proposed (idem)                                                 |
| 0007 | `0007-typography-hierarchy-v3-2.md`              | Typography hierarchy v3.2 (modular scale, hero cap 88px) | 2026-05-08   | (à vérifier)                                                    |
| 0008 | `0008-vocabulary-intervention-coaching.md`       | Vocabulaire interventions/coaching                       | (à vérifier) | (à vérifier)                                                    |
| 0009 | `0009-hosting-hetzner-cpx32-cloudflare-free.md`  | ⚠️ Titre obsolète CPX32, actual CPX42                    | 2026-05-08   | (à vérifier)                                                    |
| 0010 | `0010-telegram-pii-minimisation.md`              | PII minimisation Telegram (Option A)                     | 2026-05-09   | Accepté                                                         |
| 0011 | `0011-interventions-taxonomy-4-families.md`      | Taxonomie interventions 4 familles                       | (à vérifier) | (à vérifier)                                                    |
| 0012 | `0012-booking-v1-decisions-matrix-q1-q10.md`     | Booking V1 matrice Q1-Q10                                | (à vérifier) | (à vérifier)                                                    |
| 0013 | `0013-stripe-checkout-hybride-manuel.md`         | Stripe Checkout hybride manuel                           | (à vérifier) | (à vérifier)                                                    |
| 0014 | `0014-docuseal-self-hosted-vs-yousign.md`        | DocuSeal self-hosted vs Yousign                          | (à vérifier) | (à vérifier)                                                    |
| 0015 | `0015-tva-agnostique-fr-ee.md`                   | TVA agnostique FR/EE (OÜ estonienne)                     | (à vérifier) | (à vérifier)                                                    |
| 0016 | `0016-pricing-db-managed-pricingconfig.md`       | Pricing DB-managed PricingConfig                         | (à vérifier) | (à vérifier)                                                    |
| 0017 | `0017-multi-options-simultanees-cap-3.md`        | Multi-options simultanées cap 3                          | (à vérifier) | (à vérifier)                                                    |
| 0018 | `0018-validation-2-clics-envoi-vs-calendrier.md` | Validation 2-clics envoi vs calendrier                   | (à vérifier) | (à vérifier)                                                    |
| 0019 | `0019-modes-manuels-d64-togglables.md`           | Modes manuels D64 togglables                             | (à vérifier) | (à vérifier)                                                    |
| 0020 | `0020-migration-data-v0-vers-v1.md`              | Migration data V0 → V1                                   | (à vérifier) | (à vérifier)                                                    |
| 0021 | `0021-content-gen-v1-skeleton-vs-deep-impl.md`   | Content-gen V1 skeleton vs deep impl                     | 2026-05-14   | Accepté                                                         |
| 0022 | `0022-backup-strategy-scripts-only.md`           | Backup strategy scripts-only                             | 2026-05-14   | Accepté                                                         |
| 0023 | `0023-content-gen-table-criticality.md`          | Content-gen table criticality                            | 2026-05-14   | Accepté                                                         |
| 0024 | `0024-ai-act-classification.md`                  | AI Act classification                                    | 2026-05-14   | Accepté                                                         |
| 0025 | `0025-pii-at-rest-encryption.md`                 | PII at-rest encryption                                   | 2026-05-14   | Accepté                                                         |
| 0026 | `0026-build-externalisation-ghcr.md`             | Build externalisation GH Actions + GHCR                  | 2026-05-16   | Accepté                                                         |
| 0027 | `0027-image-bank-architecture.md`                | Image Bank V1 architecture (10 tables, 11 services)      | 2026-05-16   | Accepted                                                        |

### 4.1 Forces

🟢 Bonne couverture chronologique (Sprint 0 → Sprint actuel)
🟢 ADRs récents (0026, 0027) bien rédigés avec contexte forensique (incident deploy, root cause, alternatives écartées)
🟢 Numérotation cohérente (jamais de saut sauf 0010/0009 ordre glob, normal)

### 4.2 Faiblesses

🟡 **P1.A** : ADRs 0005 et 0006 portent `Statut : proposed` mais le commentaire interne dit « Accepté en bloc 2026-05-07 ». Drift formel statut. À aligner sur `Accepté`.

🟡 **P1.B** : ADR 0009 titre file = `hosting-hetzner-cpx32-cloudflare-free.md` mais le VPS a été rescale CPX32 → CPX42 le 2026-05-14. Soit créer ADR 0028 « Rescale CPX32 → CPX42 », soit ajouter superseded note en tête de 0009. Recommandation : **ADR 0028 succinct** (statut Superseded ADR 0009 sur le sizing).

🔴 **P0.A** : Aucun ADR pour :

- **Sprint 24/24.1** (PII redaction Telegram, RGPD erase actions, sous-processeurs, kill-switch cascade cost cap) — sauf 0010 partiel
- **Cloudflare Phase 5** (2026-05-09, 9/11 étapes, DNS orange, SSL Full strict, HSTS 12mo preload, Bot Fight + AI Scrapers OFF AEO/GEO)
- **Content-gen V1.0.3** (commits 2026-05-14 nuit, tag `v1.0.3-content-gen`)
- **Segmentation 3 secteurs** (commit `98e0b0f` 2026-05-16 : `interventions_formations`/`audits`/`implementations` via `CoverageCampaign`)

Au moins 2 ADRs manquants méritent d'être créés : **ADR 0028 « EN locale disabled temporary »** (renvoie au bug next-intl v4.11 / Next 16.2), **ADR 0029 « Content-gen segmentation 3 secteurs »**.

### 4.3 Verdict

🟢 **8 / 10** — bonne discipline ADR. 4 ADRs manquants identifiés mais non bloquants (les sujets sont tracés dans mémoires + `_AUDIT/`).

---

## 5. Propositions `_AUDIT/adr-*.md` — statut promotion

### 5.1 `_AUDIT/adr-0003-navigation-mega-menu-PROPOSITION.md`

- Date : 2026-05-07
- Statut interne : « Accepté en bloc 2026-05-07 (Will valide Voie 2) »
- **Note de renommage** dans la PROPOSITION : « sera renommé `axionia/docs/adr/0005-navigation-mega-menu.md` »
- ✅ **Promu** : `docs/adr/0005-navigation-mega-menu.md` **existe** dans HEAD (vérifié L1-10)

### 5.2 `_AUDIT/adr-0004-pseo-villes-PROPOSITION.md`

- Date : 2026-05-07
- Statut interne : « Accepté en bloc 2026-05-07 + amendement périmètre »
- **Note de renommage** : « sera renommé `axionia/docs/adr/0006-pseo-villes-regions-2026.md` »
- ✅ **Promu (avec rename)** : `docs/adr/0006-pseo-villes.md` **existe** dans HEAD

### 5.3 Verdict

🟢 **Les 2 propositions ont été promues**. Mais **les fichiers PROPOSITION sont restés dans `_AUDIT/`** au lieu d'être supprimés/archivés post-promotion → confusion potentielle.

**P1.C** : Soit supprimer `_AUDIT/adr-000X-*-PROPOSITION.md` (les 2), soit les déplacer dans `_AUDIT/_archive-propositions/` avec README expliquant qu'elles ont été promues en 0005/0006.

---

## 6. Skills repo-level (`.claude/skills/`)

### 6.1 Inventaire

`axionia/.claude/skills/` contient 2 skills repo-level :

| Skill                       | Version (mémoire)                     | Path                                        |
| --------------------------- | ------------------------------------- | ------------------------------------------- |
| `axionia-content-generator` | v1.7 skill / v2.4 master / v2.1 Manon | `.claude/skills/axionia-content-generator/` |
| `axionia-image-bank`        | v1.1 (production-ready)               | `.claude/skills/axionia-image-bank/`        |

### 6.2 Manques constatés

🟡 **P1.D** : Aucun `README.md` agrégateur dans `.claude/skills/` listant les 2 skills avec versions et dates de mise à jour. Onboarding d'un nouvel agent peu friendly.

🟡 **P1.E** : `axionia/AGENTS.md` ne référence aucun des 2 skills (pas même pour expliquer leur trigger ou leur scope). Un nouvel agent Claude Code n'a aucun pointeur dans la doc canonique.

### 6.3 Verdict

🟡 **6 / 10** — skills présents et opérationnels (cf. mémoires audit V1.1 + content-gen V1.0.3), mais **discovery** difficile depuis README/AGENTS.md.

---

## 7. Onboarding new contributor (< 30 min ?)

### 7.1 Parcours testé (sur lecture seule README + AGENTS.md)

| Étape                                                   | Outcome                                                                                                                                                        | Friction |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Clone repo                                              | OK                                                                                                                                                             | 🟢       |
| Lire `axionia/CLAUDE.md` → `@AGENTS.md`                 | Très bref, oriente vers AGENTS.md                                                                                                                              | 🟢       |
| Lire `axionia/AGENTS.md` (127 lignes)                   | Densité OK, focus build/EN/Web Vitals                                                                                                                          | 🟢       |
| Lire `axionia/README.md` (133 lignes)                   | OBSOLÈTE — 6 drifts P0 → contributor mal informé                                                                                                               | 🔴       |
| Setup local : `pnpm install` → `pnpm dev`               | À tester ; suspect bloquant si `.env.local` absent (ne mentionne pas `EN_LOCALE_ENABLED`, `IP_HASH_SALT`, `DATABASE_URL`, `REDIS_URL`, `AUTH_SECRET`, etc.)    | 🔴       |
| Comprendre architecture deploy                          | README dit « Hetzner CPX32 + Coolify + Cloudflare Sprint 22 » → ne dit rien du **build externalisé** (ADR 0026 critique, contributor essaiera de deploy local) | 🔴       |
| Trouver l'ADR à lire en cas de modif build/Prisma/Redis | Aucun pointeur depuis README. Doit deviner                                                                                                                     | 🔴       |

### 7.2 Manques

🔴 **P0.B** : `.env.example` (à vérifier sa présence) — un nouveau contributor doit pouvoir copier `.env.example` → `.env.local` et `pnpm dev` lance. Si manquant, bloquant.

🔴 **P0.C** : Pas de `docs/ONBOARDING.md` dédié. Recommandation : créer un fichier de 80-100 lignes avec :

- Prérequis (Node ≥20, pnpm 9, Docker pour Postgres+Redis local)
- Étapes 5 minutes (clone, install, env, db migrate, seed, dev)
- Liens vers ADR 0026 + 0027 + 0009 (build/image-bank/hosting)
- Liens vers `_AUDIT/CHECKLIST-CUTOVER.md`
- Comment lancer `pnpm verify:all` + interpréter les sorties

### 7.3 Verdict

🟡 **5 / 10** — onboarding pas impossible mais pas <30 min sans drift. Suspect : un nouveau contributor mettra 1-2h juste à comprendre EN désactivé + build externalisé + magic stub.

---

## 8. `_AUDIT/` global — housekeeping

### 8.1 Inventaire

**Total fichiers/dossiers dans `_AUDIT/` racine** : 152

Top-level audit dossiers (datés) :

| Path                                     | Date       | Statut                    |
| ---------------------------------------- | ---------- | ------------------------- |
| `CERTIFICATION-FRONTEND-2026/`           | 2026-05-08 | Archivable (cycle achevé) |
| `E2E-2026-05-09/`                        | 2026-05-09 | Archivable                |
| `E2E-NAV-CTA-2026-05-15/`                | 2026-05-15 | Récent — conserver        |
| `CONTENT-GEN-PERF-2026-05-15/`           | 2026-05-15 | Récent — conserver        |
| `IMAGE-BANK-AUDIT-AUTOPILOT-2026-05-16/` | 2026-05-16 | Actif                     |
| `IMAGE-BANK-V1-VERIFICATION-2026-05-16/` | 2026-05-16 | Actif                     |
| `PLATFORM-PERFECTION-2026-05-16/`        | 2026-05-16 | **CETTE SESSION — actif** |
| `BOOKING-DEPOSIT-ADMIN-2026-05-12/`      | 2026-05-12 | Archivable                |
| `KNOWLEDGE-BASE-2026/`                   | 2026-05-14 | Récent — conserver        |
| `lighthouse-smoke-2026-05-08/`           | 2026-05-08 | Archivable                |

Fichiers single-file dates :

- `CHANGELOG-v10.2.md` 🔴 supprimé (visible dans git status `D _AUDIT/CHANGELOG-v10.2.md`)
- `CONVERSATION-LOG-2026-05-06.md` → archivable
- `IMPLEMENTATION-STATUS-2026-05-07.md` → archivable
- `PLAN-AMENDMENTS-2026-05-08.md` → archivable
- ~30 autres `AUDIT-*.md` datés 2026-05-07/08

### 8.2 Diagnostic

🔴 **P0.D** : `_AUDIT/` est devenu un cimetière non hiérarchisé. 152 entrées au top-level rend la navigation pénible et la search Grep coûteuse.

Recommandation **housekeeping** :

```
_AUDIT/
├─ _archive-pre-2026-05-10/         # Tout ce qui est antérieur (Sprints 14-15)
│  ├─ AUDIT-FRONTEND-V14-2026-*.md  # 7 fichiers
│  ├─ AUDIT-PARITY-V14-FINAL.md
│  ├─ AUDIT-PERFECTION-FINALE-*.md  # 2 fichiers
│  ├─ AUDIT-TYPOGRAPHY-2026.md
│  ├─ AUDIT-VISUAL-RHYTHM-2026.md
│  ├─ AUDIT-WEB-VITALS-2026-*.md    # 6 fichiers
│  ├─ AUDIT-HEADER-NAVIGATION-2026.md
│  ├─ AUDIT-OBSOLESCENCES-CONFLITS-*.md
│  ├─ lighthouse-smoke-2026-05-08/
│  ├─ CERTIFICATION-FRONTEND-2026/
│  ├─ E2E-2026-05-09/
│  ├─ BOOKING-DEPOSIT-ADMIN-2026-05-12/
│  ├─ CONVERSATION-LOG-2026-05-06.md
│  ├─ IMPLEMENTATION-STATUS-2026-05-07.md
│  ├─ PLAN-AMENDMENTS-2026-05-08.md
│  ├─ adr-0003-PROPOSITION.md       # promues, archives
│  └─ adr-0004-PROPOSITION.md
├─ _active/                          # Audits récents en cours
│  ├─ CONTENT-GEN-V1-AUDIT-COMPLET-2026-05-14.md
│  ├─ CONTENT-GEN-V1-PASS-B-2026-05-14.md
│  ├─ CONTENT-GEN-PERF-2026-05-15/
│  ├─ E2E-NAV-CTA-2026-05-15/
│  ├─ KNOWLEDGE-BASE-2026/
│  ├─ IMAGE-BANK-AUDIT-AUTOPILOT-2026-05-16/
│  ├─ IMAGE-BANK-V1-VERIFICATION-2026-05-16/
│  └─ PLATFORM-PERFECTION-2026-05-16/  ← CETTE SESSION
├─ _prompts/                         # Prompts d'audit réutilisables
│  ├─ PROMPT-PLATFORM-PERFECTION-CHECK-2026-05-16.md
│  ├─ PROMPT-FRONTEND-AUDIT-V14-2026.md
│  ├─ PROMPT-WEB-VITALS-PERFECTION-2026.md
│  ├─ PROMPT-SEO-AEO-GEO-2026.md
│  ├─ PROMPT-CODE-HEALTH-2026.md
│  ├─ PROMPT-HEADER-NAVIGATION-2026.md
│  ├─ PROMPT-VISUAL-RHYTHM-2026.md
│  └─ ~10 autres
├─ 00-fiches-lecture.md              # Index master
├─ 01-audit-coherence.md             # Index thématique
├─ 02-PLAN.md                        # Plan M1-M11 (canonique)
├─ DPA-REGISTER.md                   # Registre DPA actif
├─ CHECKLIST-CUTOVER.md              # Checklist deploy active
└─ MIGRATION-V1-NOTES.md             # Notes V1 actives
```

🟡 **P1.F** : Ajouter `_AUDIT/README.md` (~30 lignes) expliquant la structure ci-dessus et où chercher quoi.

---

## 9. Scoring détaillé /50

| Critère                           | Pondération | Score      | Détail                                                                                                     |
| --------------------------------- | ----------- | ---------- | ---------------------------------------------------------------------------------------------------------- |
| **CLAUDE.md racine canonique**    | 5           | **5** 🟢   | Pointage `@AGENTS.md` parfait                                                                              |
| **`axionia/AGENTS.md` exhaustif** | 10          | **8** 🟢   | Build/EN/Web Vitals OK, manque 5 pointeurs (ADRs, runbooks, skills)                                        |
| **`axionia/README.md` sync HEAD** | 10          | **4** 🔴   | 6 drifts P0 (next-intl, CPX, ADRs, ADR 0026/0027 absents, EN miroir)                                       |
| **ADRs `docs/adr/`**              | 10          | **8** 🟢   | 27 ADRs couvrant Sprint 0→17, 4 manquants (Sprint 24, CF Ph5, content-gen V1.0.3, segmentation 3 secteurs) |
| **Propositions promues**          | 3           | **2.5** 🟢 | 2/2 promues, mais sources `_AUDIT/` non archivées                                                          |
| **Skills repo-level**             | 3           | **2** 🟡   | 2 skills livrés mais zéro README aggregator                                                                |
| **Onboarding < 30 min**           | 5           | **2** 🔴   | `.env.example` à vérifier, ADR 0026 invisible README, pas de `docs/ONBOARDING.md`                          |
| **`_AUDIT/` housekeeping**        | 4           | **1** 🔴   | 152 entrées top-level, aucune structure date/active/archive                                                |
| **Total**                         | **50**      | **32.5**   | 🟡 SPRINT CORRECTIF DOC                                                                                    |

**Verdict global** : 🟡 **32.5 / 50 — SPRINT CORRECTIF DOCUMENTATION 4-6 h**

Pas de bloquant prod (la doc obsolète n'empêche pas le runtime), mais bloque l'onboarding et la maintenabilité.

---

## 10. P0 / P1 / P2 backlog correctif

### P0 (bloquants onboarding/discovery — effort ~3h)

| #    | Item                                                                                                                                                  | Effort | Owner |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----- |
| P0.1 | **README.md sync** : retirer ref Dossier_FINAL_ABSOLU, next-intl@3→4.11, CPX32→CPX42, ADRs 0001-0004→0001-0027, EN désactivé, mention ADR 0026 + 0027 | 30 min | Doc   |
| P0.2 | **Créer `docs/ONBOARDING.md`** : 80-100 lignes, setup local <30 min, `.env.example`, pointeurs ADR 0026 + 0027 + 0009                                 | 45 min | Doc   |
| P0.3 | **Housekeeping `_AUDIT/`** : créer `_archive-pre-2026-05-10/`, `_active/`, `_prompts/`, `README.md` index                                             | 1h     | Doc   |
| P0.4 | **Vérifier `.env.example` existe + à jour** (incluant `EN_LOCALE_ENABLED`, `IP_HASH_SALT`, `BULLMQ_DISABLED`, `SKIP_ENV_VALIDATION`, stubs)           | 15 min | Dev   |
| P0.5 | **Aligner statut ADRs 0005 + 0006** : `proposed` → `Accepté` (cohérence interne)                                                                      | 5 min  | Doc   |

### P1 (qualité — effort ~3h)

| #    | Item                                                                                                     | Effort | Owner |
| ---- | -------------------------------------------------------------------------------------------------------- | ------ | ----- |
| P1.1 | **ADR 0028 « Rescale CPX32 → CPX42 »** : référence superseded de 0009 sur le sizing                      | 20 min | Doc   |
| P1.2 | **ADR 0029 « Content-gen segmentation 3 secteurs »** (commit `98e0b0f`)                                  | 30 min | Doc   |
| P1.3 | **`.claude/skills/README.md`** : aggregator 2 skills + versions + dates                                  | 20 min | Doc   |
| P1.4 | **AGENTS.md** : ajouter 5 pointeurs (ADRs, runbooks, dpo-templates, skills versions, `pnpm verify:all`)  | 15 min | Doc   |
| P1.5 | **AGENTS.md** : ajouter doctrine code = SSOT + interdiction Resend                                       | 10 min | Doc   |
| P1.6 | **Archiver `_AUDIT/adr-000X-*-PROPOSITION.md`** : `_archive-propositions/` + README explicatif           | 15 min | Doc   |
| P1.7 | **ADR 0030 « Cloudflare Phase 5 »** (DNS orange, SSL Full strict, HSTS preload, Bot Fight + AI Scrapers) | 30 min | Doc   |

### P2 (nice-to-have — effort ~2h)

- P2.1 : `_AUDIT/README.md` (structure folder + index thématique)
- P2.2 : README.md arborescence à jour (image-bank, KB, content-gen)
- P2.3 : Lien Wireframes-Briefs depuis README
- P2.4 : `SESSION_LOG.md` rattrapage entrées Sprint 16-24 (saute de 2026-05-07 à 2026-05-14+)
- P2.5 : Tableau de bord ADR par statut (Accepté/proposed/Superseded) dans `docs/adr/README.md` (à créer)

---

## 11. Annexe — sources

- `git rev-parse HEAD` : `4cdfbe4`
- 27 ADRs inventoriés via `Glob docs/adr/*.md`
- 2 propositions inventoriées via `Glob _AUDIT/adr-*.md`
- 152 entrées `_AUDIT/` via `ls | wc -l`
- AGENTS.md 127 lignes read complet
- README.md 133 lignes read complet
- CLAUDE.md 1 ligne (`@AGENTS.md`)
- Mémoires croisées : `axionia_hosting_hetzner.md`, `axionia_session_2026-05-16_deploy_recovery_resolved.md`, `axionia_image_bank_skill_v1_1_2026-05-15.md`, `axionia_doctrine_code_ssot.md`

---

**FIN AGENT 5.D** — livrable ≤ 800 lignes ✅
