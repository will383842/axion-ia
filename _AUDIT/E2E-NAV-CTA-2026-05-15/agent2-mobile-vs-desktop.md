# Agent 2 — Mobile drawer vs Desktop parity + Speculation Rules

Audit AUDIT-ONLY 2026-05-15 — prod `https://axion-ia.com`.
Sources : `axionia/src/components/nav/Header.tsx`, `MobileNav.tsx`, `axionia/src/components/ui/sheet.tsx` (Radix Dialog wrapper), `axionia/src/app/[locale]/layout.tsx`, `axionia/src/components/a11y/SkipToContent.tsx`.

## TL;DR

- **Mobile drawer = Radix Sheet (Dialog)** → focus trap + ESC + click-outside + reduced-motion **hérités de Radix UI** (not custom). Hamburger button `h-11 w-11` = 44×44 px → touch target WCAG 2.5.5 OK. Trigger `aria-label="Ouvrir le menu"` (i18n FR/EN via `common.openMenu`).
- **Parité contenu drawer mobile vs desktop** : drawer mobile expose **10 items** (5 nav primaires + 6 extras `stack-ia`, `blog`, `faq`, `centre-aide`, `a-propos`, `contact`) + CTA réserver + LocaleSwitcher. Desktop n'expose que **5 items + CTA + Locale**. Drawer mobile est strictement plus riche.
- **Speculation Rules production-only** (`NODE_ENV === "production"`) : `prefetch eager` sur 14 routes + `prerender moderate` sur 14 routes (Top stratégiques 80/20). Catchall `prefetch moderate` sur `*` locale. **`/reserver` exclu du `prerender`** (commentaire ligne 256-259 explicite : « page lourde côté client calendar Stripe + state-machine ») mais **inclus dans `prefetch eager`** (ligne 302). Décision raisonnée.
- **Skip link** présent (SkipToContent component) avant Header dans le layout, cible `<main id="main">`, classes `sr-only z-50 ... focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3`. WCAG 2.4.1 OK.
- **0 mega-menu desktop** : drawer mobile est de facto le « vrai menu » du site. Sur grand écran, l'utilisateur perd l'accès direct à `/stack-ia`, `/blog`, `/faq`, `/centre-aide`, `/a-propos`, `/contact` (footer-only).

## Score Agent 2 (rappel) — 78 / 120

(Voir détail dans `agent2-megamenu-coverage.md`.) Le sous-score « mobile vs desktop » contribue ~22/30 ; ce document approfondit les détails.

## Mobile drawer — Détails techniques

| Critère WCAG / a11y         | Implémentation Axion-IA                                                            | Verdict                                                |
| --------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Focus trap                  | Radix `<Sheet>` (Dialog primitive) — focus trap natif via `@radix-ui/react-dialog` | ✅                                                     |
| ESC ferme drawer            | `onOpenChange(false)` natif Radix sur ESC                                          | ✅                                                     |
| Backdrop click ferme drawer | Radix Dialog overlay click natif                                                   | ✅                                                     |
| Touch target hamburger      | `h-11 w-11` = 44×44 px                                                             | ✅ WCAG 2.5.5 (target 24×24 minimum, recommandé 44×44) |
| `aria-label` hamburger      | `t("openMenu")` traduit FR/EN                                                      | ✅                                                     |
| `aria-expanded` hamburger   | Géré par `SheetTrigger` Radix                                                      | ✅ implicite                                           |
| SR-only title + description | `<SheetTitle className="sr-only">` + `<SheetDescription className="sr-only">`      | ✅                                                     |
| `prefers-reduced-motion`    | Hérité de Radix (animations gated)                                                 | ✅                                                     |
| Items mobile touch target   | NavLink mobile `-mx-3 rounded-md px-3 py-3` = ~44 px haut                          | ✅                                                     |
| CTA mobile touch target     | `px-5 py-3 text-base` + `mt-4 flex` = ~48 px                                       | ✅                                                     |
| LocaleSwitcher dans drawer  | OK séparé par border-t                                                             | ✅                                                     |

## Parité contenu mobile vs desktop

| Élément                   | Desktop                  | Mobile drawer                                                                | Notes                                                                                         |
| ------------------------- | ------------------------ | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Logo                      | ✅ badge ivoire          | ✅ texte `BRAND.name` en `text-sm font-semibold` (pas le badge)              | divergence visuelle mineure                                                                   |
| Nav primaire              | 5 items split (2+CTA+3)  | 5 items en liste verticale (`navAll`)                                        | ✅ parité contenu                                                                             |
| CTA Réserver + badge prix | ✅ pill blue h-12        | ✅ pill terracotta px-5 py-3 + badge prix                                    | ✅ parité fonctionnelle, divergence couleur (terracotta sur mobile, blue primary sur desktop) |
| Pages secondaires         | ❌ aucune                | ✅ 6 items (`stack-ia`, `blog`, `faq`, `centre-aide`, `a-propos`, `contact`) | **Desktop manque 6 entrées**                                                                  |
| LocaleSwitcher            | ✅ pill droite           | ✅ en bas drawer avec label « Changer de langue »                            | ✅                                                                                            |
| Skip link                 | ✅ avant Header (commun) | ✅ avant Header (commun)                                                     | ✅                                                                                            |

## Speculation Rules — analyse

Source : `src/app/[locale]/layout.tsx:251-317`.

```json
{
  "prerender": [
    {
      "source": "document",
      "where": { "href_matches": [
        "/{locale}", "/{locale}/interventions", "/{locale}/interventions/*",
        "/{locale}/audit", "/{locale}/audit/*", "/{locale}/implementation",
        "/{locale}/cas-concrets", "/{locale}/methodologie", "/{locale}/comparaisons",
        "/{locale}/stack-ia", "/{locale}/implantations",
        "/{locale}/implantations/ile-de-france",
        "/{locale}/implantations/ile-de-france/paris",
        "/{locale}/contact"
      ]},
      "eagerness": "moderate"
    }
  ],
  "prefetch": [
    { "source": "document", "where": { "href_matches": [
        ...mêmes 14 routes que prerender PLUS /reserver...
    ]}, "eagerness": "eager" },
    { "source": "document", "where": { "href_matches": "/{locale}/*" },
      "eagerness": "moderate" }
  ]
}
```

### Analyse

- **OK** : `prerender` est `moderate` (déclenché au hover/viewport), pas `eager`. C'est la correction du bug perf 2026-05-07 (mémoire `axionia_perf_audit_2026-05-07.md` mentionnait « Speculation Rules eager »).
- **OK** : `/reserver` correctement exclu du `prerender` (commentaire ligne 256-259 explicite).
- **ATTENTION** : `prefetch: eager` sur 15 routes (Top + `/reserver`) charge HTML+JS de ces pages dès le load. Sur un visiteur landing `/fr` qui ne va pas naviguer, c'est ~15 × ~70 KB gz = ~1 MB de prefetch potentiel. La doctrine `_AUDIT/AGENTS.md` impose ≤ 75 KB gz First Load JS → le prefetch eager peut surcharger en mobile 4G.
- **OK** : Production-only via `NODE_ENV === "production"` (sinon Turbopack sature).
- **OK** : Catchall `prefetch moderate` sur `/{locale}/*` = comportement raisonnable pour le reste.

### Recommandations (non-actionnées, AUDIT-ONLY)

1. Envisager `prefetch: moderate` au lieu de `eager` sur les 15 routes prefetch eager → laisser le browser décider via hover/viewport. Le gain UX est faible (~50-100 ms d'avance sur hover→click) face au coût bandwidth Cloudflare et CPU mobile.
2. Si maintien de `eager`, capper à 5-7 routes vraiment Top (home + 2-3 hubs interventions + reserver + contact), pas 15.
3. Vérifier que `/audit/*` wildcard ne capture pas accidentellement `/audit/par-ville/*` (~2 157 routes pSEO) — risque de prefetch eager de villes random si l'utilisateur survole une carte de ville.

## A11y findings agrégés

| ID       | Sévérité | Constat                                                                                                                                                                                                                                                        | Source                                            |
| -------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| A11Y-001 | OK       | Skip link présent et fonctionnel                                                                                                                                                                                                                               | `SkipToContent.tsx:8-13`                          |
| A11Y-002 | OK       | Focus trap mobile drawer (Radix)                                                                                                                                                                                                                               | `MobileNav.tsx:29`                                |
| A11Y-003 | OK       | Touch targets ≥ 44×44                                                                                                                                                                                                                                          | `h-11 w-11`, `py-3`                               |
| A11Y-004 | OK       | `aria-current="page"` sur item actif                                                                                                                                                                                                                           | `NavLink.tsx:26, 40`                              |
| A11Y-005 | OK       | `aria-haspopup` + `aria-expanded` sur trigger mega-menu **si activé**                                                                                                                                                                                          | `HeaderMegaMenu.tsx:119-120` (composant orphelin) |
| A11Y-006 | OK       | `aria-label` distinct sur 2 `<nav>` desktop (`Accueil` et `Accueil 2`)                                                                                                                                                                                         | `Header.tsx:97, 127`                              |
| A11Y-007 | P2       | Le focus-visible ring du CTA central a `ring-mocha-fg/30 ... ring-2 ring-offset-0` — combo `ring-offset-terracotta` + `ring-2` sur fond terracotta peut manquer de contraste si l'utilisateur navigue clavier sur fond terracotta. À vérifier en contrast lab. | `Header.tsx:112`                                  |
| A11Y-008 | P2       | LocaleSwitcher dans drawer mobile : pas de `aria-current` séparé du switch desktop (les 2 instances coexistent dans le DOM même quand drawer fermé via `Sheet`)                                                                                                | `LocaleSwitcher.tsx:48`                           |
| A11Y-009 | OK       | `prefers-reduced-motion` hérité de Radix Sheet pour drawer                                                                                                                                                                                                     | `MobileNav.tsx:29`                                |
| A11Y-010 | P3       | Tooltip ou title absent sur la flèche `▾` mega-menu (composant orphelin de toute façon)                                                                                                                                                                        | `HeaderMegaMenu.tsx:127-130`                      |

## Top 5 findings P0/P1

1. **[P0] Origin 503 sur `/reserver` casse le CTA central** — TOUTES les pages prod ont leur CTA principal qui pointe vers un 503. Impact conversion direct.
2. **[P0] Desktop vs Mobile parity inversée** — Drawer mobile expose 11 entrées, desktop seulement 5. C'est l'inverse de la doctrine SaaS premium 2026 (le desktop devrait au moins matcher le mobile via mega-menus ou dropdown Ressources).
3. **[P1] `prefetch: eager` sur 15 routes** — Peut consommer ~1 MB bandwidth mobile inutile. À reconsidérer vs cible First Load JS ≤ 75 KB gz.
4. **[P1] LocaleSwitcher casse FR↔EN sur routes sans mapping** — `/actualites` n'a pas de mapping FR/EN → bascule vers `/en/actualites` (route non canonique) qui renvoie 503. Idem `/fr/contact` → `/en/contact` OK (mapping identité). À auditer route-par-route.
5. **[P2] HeaderMegaMenu orphelin** — Composant prêt et propre (focus trap, hover-intent, ESC, click-outside) mais 0 utilisation. Soit le wire dans Header.tsx, soit le supprimer (dead code).

## Comparaison avec doctrine 2026 (Linear, Vercel, Stripe, Anthropic)

| Composant doctrine 2026 | Linear | Vercel | Stripe | Anthropic | Axion-IA  |
| ----------------------- | ------ | ------ | ------ | --------- | --------- |
| Mega-menus 3-4 colonnes | ✅     | ✅     | ✅     | ✅        | ❌        |
| Cmd-K search public     | ✅     | ✅     | ❌     | ❌        | ❌        |
| CTA central sticky      | ❌     | ❌     | ❌     | ❌        | ✅ unique |
| Badge prix dans CTA     | ❌     | ❌     | ❌     | ❌        | ✅ unique |
| Locale switcher         | ❌     | ❌     | ✅     | ❌        | ✅        |
| Skip link               | ✅     | ✅     | ✅     | ✅        | ✅        |
| Drawer mobile Radix     | ✅     | ✅     | ✅     | ✅        | ✅        |
| Speculation Rules       | ❓     | ✅     | ❓     | ❓        | ✅        |

**Diff** : Axion-IA gagne sur CTA central + badge prix (signature unique) mais perd sur mega-menus + recherche publique. Le drawer mobile est aux standards 2026.
