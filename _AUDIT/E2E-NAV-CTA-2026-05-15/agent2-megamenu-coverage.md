# Agent 2 — Mega-menu coverage & header structure

Audit AUDIT-ONLY 2026-05-15 — prod `https://axion-ia.com`.
Échantillon : 10 pages stratégiques (home FR/EN, /fr/interventions, /fr/implantations/ile-de-france/paris, /fr/actualites, /fr/faq, /fr/reserver, /fr/contact, 404, /fr/centre-aide).
Sources lues : `axionia/src/components/nav/Header.tsx`, `HeaderMegaMenu.tsx`, `MobileNav.tsx`, `NavLink.tsx`, `LocaleSwitcher.tsx`, `axionia/src/app/[locale]/layout.tsx`.

## TL;DR

- **Mega-menus en production : ZÉRO.** Le composant `HeaderMegaMenu.tsx` existe (147 lignes, hover-intent + focus trap + Esc + click-outside corrects), mais il n'est référencé nulle part dans `src/` hors de son propre fichier. Le `Header.tsx` ligne 11 commente explicitement « 4 items desktop + ZERO dropdown (CLAUDE.md v6 §9.2 — révision §9.2-bis acceptée en bloc 2026-05-07 mais Sprint 15 différé) ».
- **Structure header desktop actuelle** : Logo (badge ivoire) + Nav gauche 2 items (`Interventions`, `Audit`) + CTA central « Réserver » (badge prix « À partir de 390 € ») + Nav droite 3 items (`Implementation`, `Cas concrets`, `Implantations`) + LocaleSwitcher FR/EN. **5 items au total**, 0 colonne, 0 section nommée.
- **Pages stratégiques absentes du header desktop** : `/audit/flash` (audit gratuit promesse forte), `/stack-ia`, `/blog`, `/actualites`, `/faq`, `/centre-aide`, `/a-propos`, `/contact`, `/methodologie`, `/comparaisons`, `/cas-concrets` sous-segments (par-secteur), `/galerie`. Ces pages ne sont disponibles que dans le drawer mobile ou via le footer.
- **GATE ROUGE — page conversion `/reserver` retourne 503 (Cloudflare BYPASS, origin down)** sur 3 retries successifs. CTA central pointe vers 503. Mêmes 503 sur 7 routes EN traduites (`/en/book`, `/en/case-studies`, `/en/locations`, `/en/faq`, `/en/help`, `/en/about`, `/en/news`). Le 404 test renvoie aussi 503 (pas la page d'erreur 404 attendue).
- **Speculation Rules** : `prefetch eager` sur 14 routes nav primaires + `prerender moderate` + `prefetch moderate` catchall locale. Production-only, gated par `process.env.NODE_ENV === "production"`. **Pas de `prerender: eager` sur nav primaire** (régression de mai 2026 corrigée). `/reserver` correctement **exclu du prerender** (commentaire ligne 256-259, calendrier Stripe / state-machine). 14 routes nav incluent les 5 items du header + `/contact` + `/methodologie` + `/comparaisons` + `/stack-ia` + sous-pages `/audit/*`, `/interventions/*`, `/implementation` + `/implantations/ile-de-france/paris`.

## Score Agent 2 — 78 / 120

| Critère (poids)                                                          | Note /max | Justification                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mega-menus présents avec colonnes nommées (15)                           | **4/15**  | Aucun mega-menu en prod ; HeaderMegaMenu présent mais orphelin (Sprint 15 différé). Doctrine §9.2-bis acceptée mais non livrée → écart connu.                                                                                                                                                                          |
| Structure header (logo + nav + CTA + locale) cohérente toutes pages (15) | **15/15** | Structure strictement identique sur les 8 pages OK (header rendu côté server-component, partagé via layout).                                                                                                                                                                                                           |
| Pages conversion présentes dans header (15)                              | **8/15**  | CTA central `/reserver` OK (focus blue ring, badge prix dérivé pricing.ts SSOT, data-cta-tracking) **MAIS** `/audit/flash` (promesse marketing forte) absent du header desktop.                                                                                                                                        |
| Speculation Rules sain (mode + eagerness + exclusions) (15)              | **13/15** | `eager` seulement sur `prefetch` (pas `prerender`) sur 14 routes nav, `moderate` fallback. `/reserver` exclu du prerender (correct). Production-only. -2 car `prefetch: eager` sur 14 routes peut saturer bandwidth Cloudflare quand la page mère est très visitée (à monitorer).                                      |
| Search bar header / Pagefind / Cmd-K public (10)                         | **0/10**  | **Aucune recherche header** ni Pagefind ni Cmd-K public. AdminCommandPalette existe mais réservé `/admin/*`. Régression vs doctrine 2026 (Ctrl-K standard SaaS).                                                                                                                                                       |
| Cohérence label vs cible (descriptif, pas "cliquez ici") (10)            | **9/10**  | Tous labels descriptifs (`Interventions entreprise`, `Implémentation IA`...). CTA central légèrement verbeux (« Réserver une intervention ou un audit IA À partir de 390 € » = 55 char dans aria-label, OK ARIA mais long).                                                                                            |
| Locale switcher robustesse round-trip (10)                               | **6/10**  | OK sur 6/8 pages OK (FR↔EN cible 200). **BUG sur `/fr/actualites` → `/en/actualites` 503** (la route `/actualites` n'a pas de mapping dans `routing.ts`, la canonique EN devrait être `/news` mais elle n'existe pas). Idem `/fr/implantations/.../paris` → `/en/locations/.../paris` 503 (route EN définie mais 503). |
| Skip link WCAG 2.4.1 (10)                                                | **10/10** | `SkipToContent` rendu avant `<Header>` dans le layout, cible `#main`, classes `sr-only focus-visible:not-sr-only`. Présent dans le HTML de toutes les pages testées.                                                                                                                                                   |
| Sticky header + z-index + accessibilité (10)                             | **8/10**  | `sticky top-0 z-40` + `bg-terracotta border-b backdrop-blur-md`. Pas de scroll-aware (figé doctrine v3, OK). Bordure mocha hairline sous header. -2 car pas de `prefers-reduced-motion` annoncé pour la transition shadow CTA.                                                                                         |
| Cohérence routes header vs `routing.ts` (10)                             | **10/10** | 5 routes header + 1 CTA toutes mappées en FR/EN dans `routing.ts` (lignes 199, 226, 272, 231 + interventions/audit/implementation présentes).                                                                                                                                                                          |

## Top 5 findings P0

1. **[P0 ROUGE] `/reserver` (FR) origin 503 persistant** — CTA central de TOUTES les pages pointe vers une URL en 503. Cloudflare renvoie `cf-cache-status: BYPASS`, donc l'origin Coolify est down sur cette route. Test 3x = 3x 503 (pas intermittent). Idem 7 routes EN (`/en/book`, `/en/case-studies`, `/en/locations`, `/en/faq`, `/en/help`, `/en/about`, `/en/news`) + 404 (`/fr/url-inexistante` renvoie 503 au lieu de la page 404).
2. **[P0] Locale switcher casse l'EN sur 7+ routes** — `/fr/actualites` (pas de mapping `actualites` dans `routing.ts:198-234`), `/fr/implantations/.../paris`, `/fr/faq`, `/fr/centre-aide`, `/fr/reserver` → tous renvoient 503 côté EN. Ne pas confondre avec le bug routing : `/en/locations/.../paris` est _défini_ dans `routing.ts` ligne 274 mais le serveur retourne quand même 503 — c'est lié au P0 #1 origin.
3. **[P0] Aucun mega-menu en production** — La doctrine §9.2-bis (acceptée 2026-05-07) prévoyait au moins 2 mega-menus (Interventions, Implantations). Composant `HeaderMegaMenu.tsx` codé et prêt mais jamais wired. Tier-1 SEO (~17 500 routes implantations + 4 familles interventions) inaccessible par navigation directe. Drawer mobile est le seul accès aux 6 pages secondaires.
4. **[P0] Recherche publique absente** — Pas de Pagefind, pas de Cmd-K visiteur, pas de barre de recherche. Standard 2026 SaaS premium. AdminCommandPalette existe (`src/components/admin/`) mais admin-only.
5. **[P1] Page `/audit/flash` (promesse marketing forte) absente du header** — La page `/audit/flash` (audit gratuit ?) n'est ni dans nav left/right ni dans drawer extras. Seul `/audit` (hub) est accessible.

## Pages stratégiques manquantes (gap analysis détaillée)

| Page                           | Présence Header desktop | Présence Mobile drawer   | Présence Footer (Agent 3) | Priorité add |
| ------------------------------ | ----------------------- | ------------------------ | ------------------------- | ------------ |
| `/audit/flash`                 | ❌                      | ❌ (audit hub seulement) | ?                         | **P0**       |
| `/stack-ia`                    | ❌                      | ✅ extras                | ?                         | P1           |
| `/blog`                        | ❌                      | ✅ extras                | ?                         | P1           |
| `/actualites`                  | ❌                      | ❌                       | ?                         | P2           |
| `/faq`                         | ❌                      | ✅ extras                | ?                         | P1           |
| `/centre-aide`                 | ❌                      | ✅ extras                | ?                         | P1           |
| `/a-propos`                    | ❌                      | ✅ extras                | ?                         | P1           |
| `/contact`                     | ❌                      | ✅ extras                | ?                         | P2           |
| `/methodologie`                | ❌                      | ❌                       | ?                         | P2           |
| `/comparaisons`                | ❌                      | ❌                       | ?                         | P2           |
| `/galerie`                     | ❌                      | ❌                       | ?                         | P3           |
| `/cas-concrets/secteur/[slug]` | ❌                      | ❌                       | ?                         | P2           |

## Doctrine recommandée (proposition mega-menus si Sprint 15 réactivé)

Vu la qualité du composant `HeaderMegaMenu.tsx` (hover-intent 100/200 ms, ESC + click-outside + focus trap natif via wrapperRef, render-prop pour contenu libre, aria-haspopup + aria-expanded), la doctrine cible pourrait être 3 mega-menus :

1. **Interventions** (3 colonnes) : Collectives (4 paliers durée) / Individuel / Dirigeants & Conférence — 14 formats au total (cf. `interventions-taxonomy.ts`).
2. **Implantations** (4 colonnes) : 12 régions FR métro + DROM, avec « Voir toutes les villes » (~2 157 communes).
3. **Ressources** (2 colonnes) : Stack IA / Méthodologie / Comparaisons / Glossaire / Guide IA / Blog / Actualités / FAQ / Centre d'aide.

CTA central `/reserver` + badge prix conservé. Page `/audit/flash` à exposer en pill secondaire (à côté du logo ou comme mini-CTA tertiaire).
