# Phase 0 — Discoveries (GAPs émergents 21+ et écarts spec/code)

> Toute découverte hors-spec à tracer ici (cf. instruction §"Pendant l'exécution" du prompt v1.1).

## GAP-21 — Env vars image-bank orphelines (jamais utilisées)

**Détection** : `src/env.ts` lignes 413-415 déclare 3 env vars dédiées image-bank :

- `IP_HASH_SALT` (RGPD — hash IP SHA-256)
- `IMAGE_AUTO_PUBLISH_SCORE` (seuil auto-publish worker enrich)
- `RETENTION_IMAGE_LOGS_MONTHS` (RGPD purge cron)

**Statut** : déclarées mais **jamais lues** dans le code (grep négatif).

**Implication** : les vars sont prêtes en `.env.example` (cf. memory `axionia_session_2026-05-14_audit_fixes_v1_0_3` qui mentionne IP_HASH_SALT déjà pushé Coolify). À les consommer dès Phase 2 (workers + retention-purge cron) — pas de migration env requise, juste implémentation.

**Niveau** : 🟢 Informationnel (positif — work pre-staged).

## GAP-22 — Routing.ts pathnames dead-link `/galerie`

**Détection** : `src/i18n/routing.ts` déclare les pathnames `/galerie`, `/galerie/[slug]`, `/galerie/[slug]/telecharger` (FR + EN miroir), mais les fichiers `page.tsx` correspondants n'existent pas dans `src/app/[locale]/galerie/`.

**Conséquence** : prod renvoie 404 sur ces URLs. Footer.tsx l52-56 commente explicitement `P0-10` que le lien `/galerie` a été retiré en attente skill v1.1.

**Audit E2E NAV-CTA 2026-05-15** confirme ce dead-link dans `_AUDIT/E2E-NAV-CTA-2026-05-15/agent10-image-bank-flow.md`.

**Implication** : à fixer en Phase 4 par création des pages réelles. La déclaration routing.ts peut rester (les pathnames sont corrects, juste les pages manquent).

**Niveau** : 🟡 P2 (visible publiquement — 404 SEO négatif, mais petits volumes de routes).

## GAP-23 — PressImageBank composant orphelin

**Détection** : `src/components/sections/PressImageBank.tsx` (80 lignes) existe et est consommé dans `src/app/[locale]/presse/page.tsx` lignes 309-334. Le composant contient un CTA vers `/galerie` (ligne 71) qui pointe vers une route 404.

**Implication** : à fixer dès la page index galerie publiée Phase 4. Pas besoin de modifier PressImageBank — le composant est correct, juste la cible cassée.

**Niveau** : 🟡 P2 (UX subtile).

## GAP-24 — Footer désactivation explicite `P0-10`

**Détection** : `Footer.tsx` ligne 52-56 :

```
// P0-10 audit — `/galerie` retiré, route absente.
// Sera ré-ajouté quand skill image-bank v1.1 expose hub public.
```

**Implication** : à ré-activer en Phase 4 simultanément à la création des pages. Anchor texte recommandé : « Banque d'images » (FR) / « Image bank » (EN) — anchor court navigation primaire (§2.8.4 du prompt v1.1).

**Niveau** : 🟢 Informationnel (work-tracked).

## GAP-25 — `content-gen/images/image-optimizer.ts` réutilisable

**Détection** : `src/server/content-gen/images/image-optimizer.ts` existe (scope Content-Gen articles hero, pas image-bank stock). Code Sharp éprouvé : variants WebP/AVIF/LQIP.

**Implication** : Phase 2 peut **partager du code** (helpers Sharp) entre content-gen et image-bank via `src/lib/image-utils.ts` extracté. Évite duplication.

**Recommandation** : extraire les helpers Sharp génériques (resize, convert, optimize, embed-metadata, lqip) en `src/lib/image-utils.ts` _avant_ de re-coder le pipeline image-bank. Économise ~10h dev + maintenance.

**Niveau** : 🟢 Opportunité refactor (gain DRY).

## ~~GAP-26~~ — Skill INVALIDÉ : trouvé au path projet (et non user)

**Statut révisé 2026-05-16 (post-Phase 1)** : ✅ Skill **bien présent** au path **projet** `C:/Users/willi/Documents/Projets/Axion-IA/.claude/skills/axionia-image-bank/` :

- `SKILL.md` ✅
- `FEATURES.md` ✅
- `IMPLEMENTATION-PLAN.md` ✅
- `references/` (10 fichiers dont `axionia-stack-validated.md`, `architecture-overview.md`, `prisma-schema.md`, `jsonld-imageobject.md`, `responsive-variants.md`, `caching-strategy.md`, `exif-xmp-copyright.md`, `geo-targeting.md`, `indexnow-integration.md`, `portability-other-stacks.md`)
- `prompts/`, `templates/`, `checklists/` (sous-dossiers)

**Erreur initiale Phase 0** : j'ai cherché sous `~/.claude/skills/` (path user) qui n'existe pas — alors que le skill est au path **projet** `.claude/skills/` (dans le repo Axion-IA). Path projet a la priorité pour les skills Claude Code.

**Confirmation** : ma décision défaut #6 (source images = uploads humains) répond directement au **STOP & ASK officiel #5 du SKILL v1.1** (« AI-generated images autorisées + tag `sourceType: 'ai_generated'` »). Compatibilité validée.

**Implication révisée** :

- Phase 0 reality-check **demeure valide** (mes findings 1-20 GAPs s'alignent avec le SKILL — confirmé après lecture)
- Phase 7 « skill bump v1.2 » → faisable au path projet sans clarification supplémentaire

**Niveau** : 🟢 Résolu.

## GAP-27 — Conflit Web Vitals AGENTS.md vs lighthouserc.json (≡ GAP-05 promu)

Promu de GAP-05 P2 → identifié comme ADR Will requis avant Phase 2. Détail dans `12-conflit-web-vitals-resolution.md` avec proposition Option A.

**Niveau** : 🟠 P1 (élevé depuis P2 car bloquant CI si écart non résolu).

## GAP-28 — Sub-sitemaps Knowledge + Content-Gen présents (pattern à dupliquer)

**Détection** : `src/server/exporters/knowledge-sitemap.ts` + `knowledge-rss.ts` existent — pattern stub-aware (early-exit `stub.invalid` build-time, cf. AGENTS.md §"Magic string"). Le sitemap-index racine inclut déjà sub-sitemaps Knowledge + Content-Gen.

**Implication** : Phase 5 peut **copier directement** ce pattern pour `image-bank-sitemap.ts` (Google Image Sitemap 1.1) en ajoutant 2 entrées `sitemap-images-fr.xml` + `sitemap-images-en.xml` au sitemap-index racine. Stub-aware critique pour build externalisé GH Actions (cf. ADR 0026).

**Niveau** : 🟢 Opportunité copy-paste.

---

## Sommaire GAPs émergents

| #                                        | Niveau | Action requise          |
| ---------------------------------------- | ------ | ----------------------- |
| GAP-21 Env vars orphelines               | 🟢     | Consommer Phase 2       |
| GAP-22 Routing dead-links                | 🟡 P2  | Créer pages Phase 4     |
| GAP-23 PressImageBank cible cassée       | 🟡 P2  | Idem GAP-22             |
| GAP-24 Footer désactivé P0-10            | 🟢     | Ré-activer Phase 4      |
| GAP-25 image-optimizer.ts réutilisable   | 🟢     | Refactor pré-Phase 2    |
| ~~GAP-26~~ Skill SKILL.md (résolu)       | 🟢     | Trouvé path projet — OK |
| GAP-27 Conflit Web Vitals (≡GAP-05)      | 🟠 P1  | ADR Phase 1             |
| GAP-28 Sub-sitemaps pattern réutilisable | 🟢     | Copier Phase 5          |
