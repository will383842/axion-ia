# 14 — i18n PARITY + Intl.\* 2026

> Audit internationalisation : FR ↔ EN parity strict, Intl.\* partout, hreflang, locale URLs, architecture multi-langues V3-ready.
> Référence thresholds : `README.md` § Thresholds canoniques.

## Audit en 6 chapitres × 10 critères = 60 points

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

### 6. Architecture multi-langues V3-ready (ES, IT, DE, etc.)

6.1 Structure `messages/{locale}.json` extensible (ajouter ES = 1 fichier + 1 ligne `routing.locales`)
6.2 Aucun assumption « 2 langues uniquement » dans le code (toujours `routing.locales` itéré)
6.3 Sitemap loop sur toutes locales (pas hardcodé `fr` + `en`)
6.4 hreflang générique : `routing.locales.map(locale => ...)` partout
6.5 OG locales loop (`fr_FR`, `en_US`, `es_ES`, `it_IT`, `de_DE` futures)
6.6 Routes localisées scalables (slugs traduisibles via dict)
6.7 Currency : architecture multi-EUR/USD/GBP ready (pas hardcodé €)
6.8 Date/time formats locale-aware (jamais `DD/MM/YYYY` hardcodé)
6.9 Translation cost projection (DeepL 500K chars free → 4 langues × 100K = OK)
6.10 ADR i18n V3 ouvert : quelles langues ? quand ? coût ?

## Méthode

- Phase A : Diff `messages/fr.json` vs `messages/en.json`, count missing keys
- Phase A bis : `grep` strings hardcodées FR/EN dans `src/`
- Phase A ter : Audit assumptions « 2 langues » dans le code (`grep "fr.*en"`, `grep "FR.*EN"`)
- Phase B : Diagnostic /60
- Phase C : Plan extraction strings + translation + V3 prep
- Phase D : STOP & ASK
- Phase E : Application

## STOP & ASK

1. Avant intégration DeepL ou Claude API translation (coût + secrets)
2. Avant changement structure URL localisée (impact SEO massif)
3. Avant ajout nouvelle locale (validation business : marché cible ?)
4. Avant changement currency model (impact business)
5. Avant tout commit

## Anti-patterns à éviter (Pitfalls)

- ❌ Hardcoder `['fr', 'en']` au lieu d'itérer `routing.locales` (casse à l'ajout d'une langue)
- ❌ Translation auto sans glossaire (« cabinet IA opérationnel » mal traduit)
- ❌ Slugs URL non traduits (anti-SEO local)
- ❌ Format date hardcodé (cassé pour utilisateur en autre locale)
- ❌ Currency hardcodée € (cassé pour V3 international)
- ❌ Ajout locale sans regression test (clés manquantes silencieuses)

## Cible

> 100 % parity FR↔EN clés. 0 string hardcodée. Intl.\* partout. hreflang validator clean. Translation pipeline documenté pour scale. Architecture extensible 4+ langues sans refactor (V3 ES/IT/DE ready).

## Livrables

```
audit-14-i18n-SYNTHESE.md
audit-14-i18n-DIAGNOSTIC.md
audit-14-i18n-MISSING-KEYS.md  (liste exhaustive)
audit-14-i18n-HARDCODED.md  (liste strings hardcodées)
audit-14-i18n-PLAN.md
```
