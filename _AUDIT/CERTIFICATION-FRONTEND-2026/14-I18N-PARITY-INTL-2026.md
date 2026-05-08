# 14 — i18n PARITY + Intl.\* 2026

> Audit internationalisation : FR ↔ EN parity strict, Intl.\* partout, hreflang, locale URLs.

## Audit en 5 chapitres × 10 critères = 50 points

### 1. Messages parity FR/EN

1.1 `messages/fr.json` ↔ `messages/en.json` clés strictement égales
1.2 Test automatisé (script `scripts/i18n-check.ts`)
1.3 0 string FR/EN hardcodée dans JSX
1.4 0 valeur vide / placeholder / TODO dans messages
1.5 Pluralization rules cohérentes (`{count, plural, one {...} other {...}}`)
1.6 Variables interpolées cohérentes (`{name}`, `{count}`)
1.7 Markdown / HTML cohérent dans messages
1.8 Tone consistant cross-locale
1.9 Brand naming respecté (« cabinet IA opérationnel » FR / « operational AI consultancy » EN)
1.10 Glossaire terminologie cohérent

### 2. Intl.\* APIs

2.1 `Intl.DateTimeFormat` pour dates (jamais `toLocaleDateString` direct)
2.2 `Intl.NumberFormat` pour nombres
2.3 `Intl.NumberFormat` style `currency` pour prix
2.4 `Intl.RelativeTimeFormat` pour « il y a X jours »
2.5 `Intl.ListFormat` pour listes (« A, B et C »)
2.6 `Intl.PluralRules` ou ICU MessageFormat pour pluriels
2.7 `Intl.Collator` pour sorting accent-aware
2.8 Locale passée explicitement (jamais `navigator.language` direct)
2.9 Timezone gérée (par défaut UTC sauf user setting)
2.10 Format consistent partout (helpers dans `lib/intl.ts`)

### 3. URLs localisées

3.1 `/fr/audit` vs `/en/audit` (next-intl path-based)
3.2 Slugs traduits si SEO local (`/fr/reserver` vs `/en/book`)
3.3 hreflang correct par page (FR + EN + x-default)
3.4 `x-default` = FR (canonique)
3.5 Canonical absolu cohérent
3.6 Language switcher fonctionnel (préserve path)
3.7 Sitemap inclut FR + EN
3.8 Robots.txt n'exclut pas une locale
3.9 OG locale correct (`fr_FR` vs `en_US`)
3.10 HTML `lang` attribute cohérent

### 4. Translation pipeline (à scale)

4.1 Stratégie translation FR→EN documentée (manuelle, DeepL, Claude API)
4.2 Si automatisée : post-édit humain sur sample 1 %
4.3 Cache translations (republish = pas re-translate)
4.4 Glossaire enforced (terms qui ne se traduisent pas)
4.5 Long-form content : qualité translation auditée
4.6 Short strings (CTAs, navigation) : translation parfaite
4.7 Cost translation chiffré (DeepL free 500K chars/mois OU Claude API)
4.8 Workflow nouvelle langue (préparation V3 ES, IT, etc.)
4.9 Tests vitest : missing keys = fail
4.10 Lint check : missing translations bloquent CI

### 5. UX & locale-specific

5.1 Date format `DD/MM/YYYY` FR / `MMM DD, YYYY` EN
5.2 Number format `1 234,56 €` FR / `€1,234.56` EN (à valider quel format EN)
5.3 Phone format `+33 X XX XX XX XX` FR / `+33 X XX...` ou `+1 (XXX)...` EN si US
5.4 Address format locale-specific
5.5 Currency conversion N/A (€ partout EU)
5.6 Time format 24h FR / 12h EN ?
5.7 First day of week (lundi FR / dimanche EN-US ? — EN-GB lundi)
5.8 RTL support (architecture-ready, pas utilisé V1)
5.9 Images localisées si pertinent (rare V1)
5.10 Error messages locale-aware

## Méthode

- Phase A : Diff `messages/fr.json` vs `messages/en.json`, count missing keys
- Phase A bis : `grep` strings hardcodées FR/EN dans `src/`
- Phase B : Diagnostic /50
- Phase C : Plan extraction strings + translation
- Phase D : STOP & ASK
- Phase E : Application

## STOP & ASK

1. Avant intégration DeepL ou Claude API translation
2. Avant changement structure URL localisée
3. Avant ajout nouvelle locale
4. Avant tout commit

## Cible

> 100 % parity FR↔EN clés. 0 string hardcodée. Intl.\* partout. hreflang validator clean. Translation pipeline documenté pour scale.

## Livrables

```
audit-14-i18n-SYNTHESE.md
audit-14-i18n-DIAGNOSTIC.md
audit-14-i18n-MISSING-KEYS.md  (liste exhaustive)
audit-14-i18n-HARDCODED.md  (liste strings hardcodées)
audit-14-i18n-PLAN.md
```
