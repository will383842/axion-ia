# 26 — FINAL CERTIFICATION GATE 2026

> **Verdict GO / NO-GO production**. À lancer en dernier, après tous les audits 01-25 du dossier.
> Lancer fenêtre fraîche.

## 0. Mission

Synthétiser les résultats des **25 audits précédents** + appliquer une checklist exécutable finale → produire un **verdict GO/NO-GO** pour la mise en production.

## 1. Pré-requis

- Tous les fichiers `audit-XX-*-SYNTHESE.md` présents dans `_AUDIT/CERTIFICATION-FRONTEND-2026/`
- `_RUN-LOG-YYYY-MM-DD.md` à jour
- Tous les STOP & ASK des audits 01-25 résolus

## 2. Checklist exécutable finale (300 critères)

### A. Performance (50 points)

- [ ] Lighthouse Performance ≥ 95 sur 15 pages × FR+EN × desktop+mobile (60 tests)
- [ ] Lighthouse Performance ≥ 90 sur sample 5 pages pSEO random
- [ ] LCP p75 ≤ 1 800 ms (CrUX ou RUM interne)
- [ ] INP p75 ≤ 100 ms
- [ ] CLS p75 ≤ 0,05
- [ ] Bundle initial route home ≤ 70 KB gzip
- [ ] Bundle initial route lourde (/reserver) ≤ 100 KB gzip
- [ ] Build prod < 10 min sur Hetzner CX32
- [ ] Cache hit rate Cloudflare ≥ 90 %
- [ ] HTTP/3 actif Caddy + Cloudflare (vérif `curl --http3`)
- [ ] Brotli actif (vérif headers)
- [ ] 103 Early Hints actif
- [ ] React Compiler 19 activé
- [ ] PPR `incremental` activé
- [ ] Speculation Rules tunées prod-only
- [ ] Image optim AVIF/WebP via sharp
- [ ] LCP preload + fetchpriority sur heroes
- [ ] Font fallback `size-adjust` (CLS = 0)

### B. Code quality (40 points)

- [ ] `pnpm typecheck` 0 erreur
- [ ] `pnpm lint` 0 warning
- [ ] `pnpm test` 100 % vert
- [ ] `pnpm test:e2e` 100 % vert
- [ ] Coverage vitest ≥ 80 % sur `lib/`
- [ ] `pnpm audit` 0 critical/high
- [ ] 0 `any`, 0 `@ts-ignore` non justifié
- [ ] 0 `console.log` en prod
- [ ] 0 source map en prod
- [ ] Husky pre-commit + pre-push verts
- [ ] Bundle delta gate actif sur PR
- [ ] LHCI gate actif sur PR
- [ ] Dependabot weekly actif

### C. Architecture & DRY (30 points)

- [ ] Atomic design respecté (atoms/molecules/organisms/sections/templates)
- [ ] Naming convention cohérent (kebab fichiers, PascalCase composants)
- [ ] 0 logique dans `page.tsx` (déléguer)
- [ ] 0 string hardcodée FR/EN dans JSX (tout dans `messages/`)
- [ ] 0 prix hardcodé hors `data/pricing.ts`
- [ ] 0 route hardcodée hors `lib/routes.ts`
- [ ] 0 hex color hors `globals.css`
- [ ] Brand naming centralisé (`lib/brand.ts`)
- [ ] JSON-LD factories centralisées (`lib/seo.ts`)
- [ ] Zod schemas centralisés (`lib/schemas/`)

### D. Design system (20 points)

- [ ] Doctrine v3 visuelle figée respectée (titleEm Fraunces italique partout)
- [ ] Header terracotta cohérent
- [ ] Hero schema 576×576 sur lg+
- [ ] Modular typography scale v3.2 (cap 88px hero)
- [ ] Palette terracotta + paper + sand + sage figée
- [ ] Component variants documentés
- [ ] Empty states designés
- [ ] Error states designés
- [ ] Loading states (skeletons dimensionnés)
- [ ] Form states 5 (default/focus/error/disabled/success)
- [ ] Mobile-first breakpoints cohérents
- [ ] Focus rings cohérents
- [ ] Reduced-motion respecté

### E. A11y (20 points)

- [ ] Lighthouse A11y 100/100 sur 15 pages
- [ ] Axe-core 0 violation sur 15 pages
- [ ] Hiérarchie h1→h6 stricte (1 h1/page)
- [ ] Skip-to-content présent
- [ ] Contraste 4.5:1 texte / 3:1 large / 3:1 UI
- [ ] Focus visible partout
- [ ] Keyboard nav 100 % parcours
- [ ] Screen reader test OK sur 5 parcours critiques (manuel)
- [ ] `prefers-reduced-motion` respecté
- [ ] Form labels + `aria-describedby`
- [ ] Image alt ou `aria-hidden` partout
- [ ] Tap target ≥ 44×44 px

### F. SEO (30 points)

- [ ] Lighthouse SEO 100/100 sur 15 pages
- [ ] Sitemap-index actif + soumis Search Console
- [ ] robots.txt valide
- [ ] Meta `<title>` + `<description>` + `<canonical>` unique par page
- [ ] OpenGraph complet
- [ ] hreflang FR/EN par page + `x-default`
- [ ] Structured data validator (Google Rich Results) OK
- [ ] BreadcrumbList partout
- [ ] Organization + WebSite globalement
- [ ] LocalBusiness + Place sur villes/régions
- [ ] FAQ schemas sur Top 15
- [ ] noindex sur thin/duplicate (anti-doorway HCU)
- [ ] 0 lien interne cassé
- [ ] 0 page orpheline
- [ ] Click depth ≤ 3 depuis home
- [ ] Anchor diversity OK
- [ ] llms.txt + llms-full.txt à jour

### G. Scale & Pipeline (40 points)

- [ ] ISR Next 16 actif sur routes pSEO
- [ ] Cloudflare Cache Rules optimales
- [ ] Cloudflare cache purge per URL automatisé
- [ ] Sitemap split actif (sitemap-index < 50K URLs/sitemap)
- [ ] IndexNow API ping sur publish
- [ ] Search Console API monitoring quotidien
- [ ] Quality gate Zod + uniqueness pré-publish actif
- [ ] Lighthouse sampling automatisé quotidien
- [ ] RUM aggregation per route
- [ ] Anomaly detection actif
- [ ] Rollback procédure documentée + testée
- [ ] Pipeline 100-300 URLs/jour démontré end-to-end
- [ ] Hetzner CX32 RAM/CPU/disk monitoring actif
- [ ] Postgres indexes optimaux + autovacuum tuné
- [ ] Backup auto Coolify + restore drill testé
- [ ] Page lifecycle (publish/depublish/archived) géré

### H. Sécurité (20 points)

- [ ] HSTS preload
- [ ] X-Frame-Options DENY
- [ ] X-Content-Type-Options nosniff
- [ ] Permissions-Policy strict
- [ ] Referrer-Policy
- [ ] CSP nonce dynamique (Sprint 16 si déjà fait)
- [ ] 0 secret exposé client
- [ ] HTTPS partout
- [ ] Caddy auto-HTTPS Let's Encrypt
- [ ] Cloudflare Universal SSL
- [ ] Form validation Zod (Sprint 16)
- [ ] Cookies httpOnly + secure + samesite (Sprint 16)
- [ ] DDoS Cloudflare Free actif
- [ ] WAF basic actif

### I. Content & i18n (20 points)

- [ ] FR + EN clés strictement égales (`messages/`)
- [ ] 0 string hardcodée
- [ ] Dates/numbers via `Intl.*`
- [ ] hreflang validator OK
- [ ] Spell check FR clean (LanguageTool)
- [ ] Spell check EN clean
- [ ] Tone consistent (cabinet IA opérationnel partout)
- [ ] Pricing cross-pages cohérent
- [ ] CTA labels cohérents
- [ ] 0 lorem / placeholder / TODO visible
- [ ] Editorial calendar blog actif (si Sprint 14.6)

### J. Légal & RGPD (15 points)

- [ ] Mentions légales complètes (OÜ EE registrikood + VAT)
- [ ] Politique confidentialité RGPD à jour
- [ ] CGV à jour
- [ ] Cookies banner conforme
- [ ] Cookies preferences page fonctionnelle
- [ ] RGPD page (droits utilisateur)
- [ ] Désabonnement page
- [ ] Mes données page (export/delete)
- [ ] Politique déplacement
- [ ] Accessibilité statement RGAA
- [ ] ADR 0009 hosting commit
- [ ] Adresse siège social visible

### K. Monitoring & Observability (15 points)

- [ ] RUM `/api/vitals` opérationnel
- [ ] Search Console connecté + sitemap soumis
- [ ] Microsoft Clarity (optionnel free)
- [ ] Plausible self-hosted (selon décision)
- [ ] CrUX query mensuelle planifiée
- [ ] Dashboard `/admin/pseo-stats` (Sprint 20)
- [ ] Coolify health checks actifs
- [ ] Alerting uptime configuré
- [ ] Logs aggregés
- [ ] Conversion tracking (form submits, calendar bookings)

### L. Standards pro (15 points)

- [ ] ADRs 0001-N à jour, index présent
- [ ] Runbooks deploy/rollback/incident
- [ ] Postmortem template prêt
- [ ] `docs/ONBOARDING.md` < 30 min setup
- [ ] Architecture diagram (C4 L1+L2)
- [ ] Data flow diagram
- [ ] Browser support matrix
- [ ] Feature flags strategy ADR
- [ ] Semver + CHANGELOG à jour
- [ ] Tech debt log maintenu

## 3. Calcul du score final

Score total max = 315 (somme des cases ci-dessus).

Pondération :

- Performance + Code (90 pts) × 1
- Architecture + Design + A11y (70 pts) × 1
- SEO + Scale (70 pts) × **2** (critique scale)
- Sécurité + Légal + Content + Monitoring + Standards (85 pts) × 1

Total pondéré max = 245 + 140 = 385.

### Seuils GO/NO-GO

| Score normalisé /100 | Verdict                                               |
| -------------------- | ----------------------------------------------------- |
| ≥ 95                 | **GO PROD** — best-in-class certifié 2026             |
| 85-94                | **GO conditionnel** — patches identifiés sous 7 jours |
| 70-84                | **NO-GO** — bloquant identifié, vague à reprendre     |
| < 70                 | **NO-GO STRICT** — refonte majeure requise            |

## 4. Synthèse à produire

Génère `_AUDIT/CERTIFICATION-FRONTEND-2026/_VERDICT-FINAL-YYYY-MM-DD.md` :

```markdown
# Verdict Certification Frontend YYYY-MM-DD

## Score

- A. Performance : X/50
- B. Code quality : X/40
- C. Architecture DRY : X/30
- D. Design : X/20
- E. A11y : X/20
- F. SEO : X/30
- G. Scale & Pipeline : X/40
- H. Sécurité : X/20
- I. Content i18n : X/20
- J. Légal RGPD : X/15
- K. Monitoring : X/15
- L. Standards pro : X/15
- **Total brut** : X/315
- **Total pondéré** : X/385
- **Score normalisé** : X/100

## Verdict : [GO / GO-CONDITIONNEL / NO-GO / NO-GO-STRICT]

## Top 5 forces

1. ...

## Top 5 faiblesses (blockers)

1. ...

## Action items prioritaires

| #   | Action | Effort | Owner | Deadline   |
| --- | ------ | ------ | ----- | ---------- |
| 1   | ...    | S      | Will  | YYYY-MM-DD |

## Justification verdict

(2-3 paragraphes)

## Re-certification recommandée

- Trimestriel : VAGUE D + F (scale)
- Mensuel : 23 (quality auto) + 21 (indexation)
- Après gros rollout : 12, 13, 21, 23
```

## 5. Cible

> _« Verdict GO PROD avec score ≥ 95/100, Axion-IA est certifié best-in-class frontend 2026, scale-ready 300K+ URLs, professionnel SaaS premium, 100 % free-tier, prêt pour rampe 100-300 URLs/jour sans risque. »_

## 6. STOP & ASK

1. Avant verdict final (montrer score brut + ventilation à Will)
2. Si score < 70 (refonte majeure)
3. Avant publication du verdict (validation Will)

## 7. Mémoire

Crée `axionia_certification_frontend_YYYY-MM-DD.md` (memory) avec verdict + score + top 5 faiblesses + cadence prochaine certification.

Ajoute ligne dans `MEMORY.md`.

---

**FIN DU PROMPT 26 — GATE FINAL.**
