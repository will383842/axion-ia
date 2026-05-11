# R-03 — i18n CHAIN

## Diagramme ASCII

```
┌─────────────────────────┐        ┌─────────────────────────┐
│ src/messages/fr.json    │  sync  │ src/messages/en.json    │
│ 224 keys                │ ←────→ │ 224 keys                │
└──────────┬──────────────┘        └──────────┬──────────────┘
           │                                  │
           └──────────────┬───────────────────┘
                          ▼
           ┌──────────────────────────────┐
           │ next-intl 4.11 plugin        │
           │ src/i18n/{routing,request}.ts│
           │ defineRouting() pathnames    │
           │   FR canonique → EN miroir   │
           │ localePrefix: "always"       │
           └──────────────┬───────────────┘
                          ▼
           ┌──────────────────────────────┐
           │ src/proxy.ts (Next 16)       │
           │ 1. Auth.js wrapper           │
           │ 2. handleI18nRouting()       │
           │ 3. CSP nonce + COEP          │
           └──────────────┬───────────────┘
                          ▼
       ┌──────────────────┴────────────────────┐
       ▼                                       ▼
┌──────────────────┐                ┌────────────────────────┐
│ Server Components│                │ Header MegaMenu        │
│ getTranslations()│                │ Footer Sitemap LocaleSw│
│ getPathname()    │                │ Link from next-intl    │
└──────────────────┘                └────────────────────────┘
                          ▼
           ┌──────────────────────────────┐
           │ <html lang={locale}>         │
           │ <link rel="alternate"        │
           │   hreflang="fr|en|x-default">│
           │ sitemap-index.xml            │
           └──────────────────────────────┘
```

## Findings clés (AGT-06)

1. **AGT-06 P1** `formatPrice` court-circuite `fmtCurrency` SSOT (concat manuelle EN).
2. **AGT-06 P1** `og:locale=en_US` pour cabinet UE — devrait être `en_GB`.
3. **AGT-06 P1** hreflang langue-seule `fr`/`en` au lieu de `fr-FR`/`en-GB` (cohérence BCP47).
4. **AGT-06 P1** Pas de header HTTP `Content-Language`.
5. **AGT-06 P1** `/confirmation/newsletter` hors `pathnames` map.
6. **AGT-06 P1** Sandbox `/components|/design|/sections` sans `noindex` HTTP (disallow robots.txt seulement — AGT-04 confirm).

## Cohérence chaîne

✅ 224 keys synchronisées (`pnpm i18n:check`).
✅ `<html lang={locale}>` dynamique correct (`src/app/[locale]/layout.tsx:139-142`).
✅ LocaleSwitcher préserve params dynamiques (`src/components/nav/LocaleSwitcher.tsx:41-58`).
✅ Footer + mega-menus 100 % FR-canonical hrefs, next-intl auto-translate.
✅ Copy EN qualitatif (pas calque) sur sample 5 pages.
