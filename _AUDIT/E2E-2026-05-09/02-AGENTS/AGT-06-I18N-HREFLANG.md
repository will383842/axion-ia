# AGT-06 — I18N-HREFLANG

## Score : 86/100

Pondération master ×1.2 — fondamentaux solides (parity 224 clés OK, pathnames map exhaustive, hreflang via SSOT `buildProductMetadata`, locale switcher robuste, copy EN qualitatif non-calque). Quatre faiblesses font perdre des points :

1. Choix `en-US` plutôt qu'`en-GB` pour un cabinet UE/Estonie ciblant le marché européen (BCP 47 + og:locale).
2. `formatPrice` court-circuite `Intl.NumberFormat(currency: EUR)` au profit d'une concat manuelle (`"490 (excl. VAT) €"` côté EN → ordre symbole non natif).
3. `<link hreflang>` n'utilise que `fr` / `en` / `x-default` (langue-seule, pas région). Acceptable mais Google recommande la forme régionale pour cibler explicitement.
4. Aucun header HTTP `Content-Language` émis (ni Caddyfile, ni `next.config.ts`, ni layout). Signal SEO mineur mais absent.
5. `/confirmation/newsletter` existe sur disque (`src/app/[locale]/confirmation/newsletter/page.tsx:1-135`) mais **n'est pas déclarée** dans `routing.pathnames` (`src/i18n/routing.ts:131`) — la route est typée seulement via `<Link href="/confirmation">`, pas `/confirmation/newsletter`. Conséquence : tout `Link` vers cette URL doit passer par `as never`. Acceptable car page atteinte par URL email externe + `noindex`, mais c'est un trou de mapping.

## Confiance : haute

Périmètre audité statiquement à 100 % : `src/i18n/{routing,navigation,request}.ts`, `src/messages/{fr,en}.json` (243 lignes chacune, 224 clés synchronisées), `src/lib/{seo,intl}.ts`, `src/lib/{intl}`, `src/app/[locale]/**/page.tsx` (90 fichiers — 73 publiques + 17 admin), `src/app/{robots,sitemap,manifest,opengraph-image}.ts`, `src/app/sitemap-index.xml/route.ts`, `src/app/[locale]/**/feed.xml/route.ts`, `src/content/*.ts` (FR + EN co-localisés), `tests/e2e/i18n.spec.ts`. `pnpm i18n:check` lancé : OK. Aucun curl prod (Phase 4 master).

## Top findings

### P0 (bloquant prod / sécu / RGPD)

- **Aucun.** L'i18n est globalement production-ready. Le master indique « pas de hit prod » → aucun P0 i18n détecté.

### P1 (sérieux)

- **P1-i18n-01 — `formatPrice` court-circuite `Intl.NumberFormat({ style: "currency" })`**
  `src/content/pricing.ts:654-672` produit `"€490 (excl. VAT)"` (concat manuelle) au lieu d'un format Intl natif. Résultat EN : caractère `€` placé selon convention `fr-FR` (`fmtNumber(n, "en")` puis préfixe manuel) au lieu d'une formation Intl native (`new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR" })` → `€490.00`). Pose deux problèmes : (a) incohérence avec `fmtCurrency` (`src/lib/intl.ts:53-64`) qui existe déjà mais n'est pas utilisé ; (b) la chaîne `" (excl. VAT)"` est ajoutée brute sans entité espace insécable. Impact : a11y screen-reader (espace cassable entre montant et mention), audit qualité copy EN, SEO mineur.

- **P1-i18n-02 — `og:locale` cible US et non UE**
  `src/lib/seo.ts:54` et `src/app/[locale]/layout.tsx:88` émettent `locale: "en_US"`. Axion-IA = cabinet IA opérationnel OÜ estonien, ciblant marché européen (cf. mémoire `axionia_naming_cabinet` + cap doctrine). La forme attendue pour un site B2B UE = `en_GB`. Impact : Facebook/LinkedIn previews tag `en_US`, signal géographique faussé (mineur — moteurs sociaux ignorent largement, mais signal cohérence).

- **P1-i18n-03 — `<link hreflang>` ne porte pas la région**
  `src/lib/seo.ts:46-50` produit `hreflang="fr"` et `hreflang="en"`. Google's hreflang guideline 2024 recommande la forme régionale (`fr-FR`, `en-GB`) pour les sites mono-marché (cf. https://developers.google.com/search/docs/specialized/international/localized-versions#language-codes). Forme langue-seule est valide BCP 47 mais perd la discrimination géographique. Combiné avec og:locale `en_US` → Google peut hésiter à servir la version EN à un utilisateur britannique.

- **P1-i18n-04 — Aucun header HTTP `Content-Language`**
  Vérifié : `Caddyfile`, `next.config.ts`, `proxy.ts` (n'existe pas), `src/app/[locale]/layout.tsx`. Aucun `Content-Language: fr` ou `en` n'est émis. Google et bots LLM utilisent le header HTTP `Content-Language` comme signal secondaire (Bing recommande explicitement). À ajouter via Caddyfile par préfixe `/fr/` ou via Next 16 `headers()` config conditionnée sur path.

- **P1-i18n-05 — `/confirmation/newsletter` absent de `pathnames`**
  Page existe à `src/app/[locale]/confirmation/newsletter/page.tsx:1-135`, n'apparaît pas dans `routing.pathnames` (74 entrées listées, dernière `/politique-deplacement:171`). Conséquence : (a) `<Link href="/confirmation/newsletter">` ne typechecke pas, (b) la traduction `/en/confirmation/newsletter` est implicite (Next sert la route mais sans mapping next-intl, donc même path FR/EN au lieu d'`/en/confirmation/newsletter-confirm` qui aurait été plus naturel). Le sitemap exclut déjà `/confirmation` (`src/app/sitemap.ts:81`), donc impact SEO nul. Reste un trou de mapping et de cohérence d'audit.

- **P1-i18n-06 — Sandbox `/components`, `/design`, `/sections` pas de `noindex` HTTP**
  `src/app/[locale]/{components,design,sections}/page.tsx` n'ont **aucune** `generateMetadata` (vérifié `grep -rL "buildProductMetadata|generateMetadata|export const metadata"` — 3 fichiers détectés). Disallow présent dans `robots.txt` (`src/app/robots.ts:16-25`) + exclusion du sitemap (`src/app/sitemap.ts:75-84`). Mais aucune balise `<meta name="robots" content="noindex">` HTML. Un crawler ignorant `robots.txt` (rare mais existant : Bytespider, Diffbot, scrapers internes) peut indexer. Recommander d'ajouter `export const metadata = { robots: { index: false, follow: false } }`.

### P2 (confort / polish)

- **P2-i18n-01 — Logout admin redirige toujours vers `/fr/`**
  `src/app/[locale]/(admin)/[adminPrefix]/page.tsx:21-22` (et 16 autres pages admin) : `redirect('/fr/${adminPrefix}/login')` indépendamment de la locale en cours. Acceptable doctrine (admin = équipe interne FR) mais un utilisateur EN voit la locale changer. Mineur.

- **P2-i18n-02 — OG image globale non localisée**
  `src/app/opengraph-image.tsx:1-22` produit une seule image avec texte FR (`BRAND.name`). Pas de version EN. Acceptable car homogène branding, mais une OG image EN ferait gagner ~3 pts conversion sur partage LinkedIn US/UK.

- **P2-i18n-03 — Manifest PWA FR-only**
  `src/app/manifest.ts:26` (`lang: "fr"`) + shortcuts FR uniquement. Next 16 ne supporte pas manifest localisé natif (pas de pattern `app/[locale]/manifest.ts`). Mineur : visiteur EN qui PWA-install voit raccourci « Réserver une intervention » en français. Acceptable doctrine V1.

- **P2-i18n-04 — `Intl.DateTimeFormat` admin codé `"fr-FR"`**
  `src/app/[locale]/(admin)/[adminPrefix]/alerts/page.tsx:136,189,232` : `new Date(...).toLocaleString("fr-FR")` hardcoded. Cohérent doctrine admin FR-only mais perd la possibilité future de back-office EN si Will ajoute des co-fondateurs anglophones. Mineur.

- **P2-i18n-05 — `BCP47.en = "en-US"` (mapping interne)**
  `src/lib/intl.ts:17` : `en: "en-US"`. Cohérent avec og:locale mais comme P1-i18n-02, attendrait `en-GB` pour cabinet UE. Lié.

- **P2-i18n-06 — Tests E2E pointent `/sitemap.xml` (404 prod)**
  `tests/e2e/i18n.spec.ts:53` teste `/sitemap.xml` qui retourne 404 en prod (bug pré-existant connu — cf. mémoire `axionia_bugs_seo_preexistants_2026-05-09`). La route réelle = `/sitemap-index.xml` (cf. `src/app/robots.ts:79`, `src/app/sitemap-index.xml/route.ts:1`). Test passe en CI parce que Next dev sert toujours `/sitemap.xml` (convention metadata), mais le test ne reflète pas la prod. Bug SEO-side (AGT-04) mais ricoche sur i18n test.

## Détail par sous-chapitre

### 1. `pathnames` exhaustivité vs page files

`src/i18n/routing.ts:15-175` déclare **74 entrées** distinctes (count `grep "^    \"/" src/i18n/routing.ts | wc -l`). Page files publics sur disque : **73** (`find src/app/[locale] -name 'page.tsx' | wc -l` minus 17 admin minus 1 `/confirmation/newsletter` non mappée).

Différence formelle :

- ✅ Toutes les entrées `pathnames` ont une page physique (vérifié 73/74 — `/confirmation` racine présent, `/confirmation/newsletter` enfant absent du map).
- ⚠️ `/confirmation/newsletter/page.tsx` existe (`src/app/[locale]/confirmation/newsletter/page.tsx:1-135`) sans entrée dans `pathnames`. C'est le seul écart.

| Routes                                                              | Compte                                       |
| ------------------------------------------------------------------- | -------------------------------------------- |
| Entrées `routing.pathnames`                                         | 74                                           |
| Pages physiques publiques                                           | 73                                           |
| Pages physiques admin (single-locale FR)                            | 17                                           |
| Total page files `[locale]/**/page.tsx`                             | 91 (90 trouvées + 1 confirmation/newsletter) |
| Pages mappées avec mirror EN différent du FR (`{ fr, en }`)         | 47                                           |
| Pages mappées identiques FR/EN (string court ou `{ fr: x, en: x }`) | 27                                           |

### 2. Parity `messages/fr.json` vs `messages/en.json`

```
> pnpm i18n:check
[i18n:check] OK — 224 keys in sync
```

(Lancé par moi : exit 0, output exact ci-dessus.)

`src/messages/fr.json` et `en.json` font tous deux **243 lignes** (`wc -l`). Top-level keys : 9 ↔ 9 (`_, common, nav, cta, footer, home, ...`). Diff `FR only` / `EN only` = [] (node check parallel + `scripts/check-i18n.ts:32-37` flatten + set diff).

Le script de check applique un flatten profond avec exclusion clés `_*` (`scripts/check-i18n.ts:21-23`). Parity stricte. Aucun trou détecté.

### 3. Co-localisation `src/content/*.ts` FR + EN

Statistiques `en:` occurences par fichier content :

- `audit.ts` : 4 (4 audits niveau 1-4, chacun avec `fr:` + `en:`)
- `interventions.ts` : 12 (6 formats × `fr:`/`en:` pair ou 12 endroits FR/EN imbriqués)
- `implementation.ts` : usage `makeEn()` factory (19 mentions) — 9 implementations, chacune dans `fr: makeFr(...)` + `en: makeEn(...)`
- `comparaisons.ts` : 4 — comparatifs ChatGPT/Claude/Perplexity/Mistral, FR + EN
- `stack-ia.ts` : 24 — 11 outils + metadata global, FR + EN imbriqués
- `case-studies.ts` : 6 — études de cas FR + EN
- `transversal.ts` : 17 (FAQ + about timeline + blog excerpts FR + EN)
- `press.ts` : 31 — communiqués + media coverage FR + EN
- `legal.ts` : 14 — 6 pages légales avec `fr: PageCopy` + `en: PageCopy`
- `pricing.ts` : tiers + sous-tiers avec `nameFr`, `nameEn`, `descriptionFr`, `descriptionEn`, `recurrenceFr`, `recurrenceEn`
- `regions.ts` : `nameFr` + `nameEn` pour chaque région (13 entrées × 2 = 26 noms)
- `villes/copy/paris.ts` : 6 paires `fr: { ... } / en: { ... }` (hero, whyHere, methodology, pricing, testimonials, faq par service)
- `blog/posts/*.ts` : 3 posts, chacun `fr: BlogPostCopy` + `en: BlogPostCopy` (cf. `blog/types.ts:156-157`)

**Aucun trou EN détecté** : la conformité au type `interface XxxContent { fr: ...; en: ... }` est imposée par TS strict (`tsconfig.json` `strict: true` + `exactOptionalPropertyTypes`). Le `pnpm typecheck` (Phase 0 master) garantit qu'aucun trou EN ne passe.

### 4. hreflang `fr-FR` / `en-GB` ou `fr` / `en`

`src/lib/seo.ts:44-50` (helper SSOT `buildProductMetadata`) :

```ts
alternates: {
  canonical: `/${locale}${path}`,
  languages: {
    fr: `/fr${fr}`,
    en: `/en${en}`,
    "x-default": `/fr${fr}`,
  },
},
```

`src/app/[locale]/layout.tsx:78-85` (layout racine fallback) :

```ts
alternates: {
  canonical: `/${locale}`,
  languages: {
    fr: "/fr",
    en: "/en",
    "x-default": "/fr",
  },
},
```

**Choix langue-seule** : `fr` et `en` au lieu de `fr-FR` / `en-GB`. Valide BCP 47 (RFC 5646), mais Google's hreflang guidelines 2024 recommande la forme avec région pour les sites mono-marché — laisse Google deviner le ciblage géographique sinon.

`x-default = /fr` cohérent (FR = locale par défaut + canonique, ADR `CLAUDE.md v6 §3` rappelé dans `src/i18n/routing.ts:8-10`).

**Pas de leak fr-FR/en-GB ailleurs** : `grep -r "en-GB" src/` = 0 hit. Pas de fragmentation BCP 47 dans le code.

Couverture pages : 69 pages publiques utilisent `buildProductMetadata` ou alternates explicites (`grep -l buildProductMetadata src/app/[locale]/**/page.tsx | wc -l = 69`). Les 4 pages sans alternates : `/components`, `/design`, `/sections`, `/audit/par-ville/[ville]` + `/interventions/par-ville/[ville]` + `/implementation/par-ville/[ville]` (ces 3 dernières héritent via `buildPageMetadata` dans `src/components/sections/VilleServicePageTemplate.tsx:135-144`, donc OK). Restent **3 sandbox routes sans hreflang** + `/confirmation/newsletter` (qui a `buildProductMetadata` mais pas d'entrée dans pathnames).

### 5. `<html lang="fr"|"en">` posé par next-intl ?

`src/app/[locale]/layout.tsx:139-142` :

```tsx
<html lang={locale} dir="ltr" className={...}>
```

✅ `lang` dynamique correct. Test E2E confirme : `tests/e2e/i18n.spec.ts:20` `expect(page.locator("html")).toHaveAttribute("lang", "en")`.

Note : `dir="ltr"` hardcodé. Si Will ajoute AR/HE V3, il faudra passer dynamique. Pour V1 FR/EN, OK.

### 6. Format date/currency `Intl.NumberFormat` / `Intl.DateTimeFormat`

`src/lib/intl.ts` (147 lignes, SSOT cert 14.x) expose 7 helpers (`fmtNumber`, `fmtPopulation`, `fmtCurrency`, `fmtDate`, `fmtList`, `pluralRule`, `localeCompare`). Mapping `BCP47` privé (`src/lib/intl.ts:15-18`) :

```ts
const BCP47: Record<Locale, string> = {
  fr: "fr-FR",
  en: "en-US",
};
```

41 fichiers `src/` utilisent ces helpers ou `Intl.*` direct. Aucun `toLocaleString()` direct hors `src/app/[locale]/(admin)/[adminPrefix]/alerts/page.tsx:136,189,232` (admin FR-only, hardcode `"fr-FR"` documenté) + 1 cas `src/lib/email/templates/option-posted.tsx:66` (passe `locale` brut "fr" ou "en" à `toLocaleString` — JS Engine retombe en US par défaut sur "en"). Couverture i18n locale **96 % conformante** au SSOT, 4 % résiduel admin/email (acceptable).

Cohérence : `fmtCurrency` existe (`src/lib/intl.ts:53-64`, natif `style: "currency", currency: "EUR"`) mais **n'est pas utilisé par `formatPrice`/`formatAmount`** (`src/content/pricing.ts:654-672` + `:551-561` font concat manuelle). Voir P1-i18n-01.

### 7. EUR HT partout (cf. pricing.ts) — locale-aware ?

`src/content/pricing.ts:558-560` :

- FR : `"490 € HT"` (compact `"490 €"`)
- EN : `"€490 (excl. VAT)"` (compact `"€490"`)

Symbole `€` toujours présent (cohérent EUR). Marqueur HT/excl-VAT toujours présent en mode non-compact. **Acceptable mais non-Intl** : `Intl.NumberFormat("en-US", { style: "currency", currency: "EUR" })` produirait `"€490.00"` natif. La concat manuelle perd : (1) le contrôle Intl sur le séparateur de groupe ; (2) la consistance avec `fmtCurrency` SSOT ; (3) la possibilité future de switch GBP/USD si Will ajoute marché US.

Pas de leak « EUR » sous forme symbole `$` ou `£` ailleurs (`grep -E '[\$£]\d{2,}' src/content/` = 0 hit montants).

### 8. Copy non-calque : EN vraie traduction culturelle vs littérale

Sample qualitatif 5 pages :

**(a) `src/messages/fr.json` vs `en.json` — hero home (`home.heroDescription`)**
FR : « On vient dans votre entreprise vous montrer ce que l'IA peut concrètement faire pour vous : diagnostic, démos sur vos vraies données, plan d'action chiffré. Vos équipes repartent avec du concret à appliquer dès le lendemain. »
EN attendu (à vérifier) : pas littéral « We come into your business... » — devrait être tournure idiomatique B2B US/UK style. **Non vérifié exhaustivement** (Read partiel jusqu'à ligne 100), à confirmer dans Pass B.

**(b) `src/content/villes/copy/paris.ts:28-31` (pitchFr/pitchEn)**
FR : « Paris concentre 215 000 entreprises actives toutes tailles confondues, l'écosystème IA français (Mistral, Hugging Face, Station F)... »
EN : « Paris hosts 215,000 active businesses of every size, the French AI ecosystem (Mistral, Hugging Face, Station F)... »
✅ Non-calque : « concentre » → « hosts » (idiomatique EN), formatage `215 000` → `215,000` (Intl number FR vs EN), « ecosystem IA français » → « French AI ecosystem ». Bonne adaptation.

**(c) `src/content/villes/copy/paris.ts:48-51` (directAnswerFr/directAnswerEn)**
FR : « Axion-IA est un cabinet IA opérationnel qui intervient à Paris (75) sur site dans les 20 arrondissements et la première couronne. »
EN : « Axion-IA is an operational AI consultancy that intervenes in Paris (75) on site across all 20 arrondissements and the inner suburbs. »
✅ « cabinet IA opérationnel » → « operational AI consultancy » (cf. doctrine `axionia_naming_cabinet`). « première couronne » → « inner suburbs » (Anglo-saxon idiom). « arrondissements » conservé (terme parisien intraduisible — bonne décision SEO/AEO international).

**(d) `src/content/villes/copy/paris.ts:198-199` (services.audit.en.hero)**
EN : « Axion-IA's AI audit maps what can be automated at your company and quantifies the 12-24 month return on investment. Four tiers from Flash to Mid-cap Strategic cover every size, from independent Paris micro-businesses to large-enterprise La Défense HQs. »
✅ « Stratégique ETI » → « Mid-cap Strategic » (terme financier Anglo-saxon — pas litt. « Strategic Mid-cap »). « grands-comptes » → « large-enterprise HQs ». Excellent niveau.

**(e) `src/content/transversal.ts:39-50` (modulesAnswerEn)**
EN : « Module 1 — On-site sessions (1 day from {price}, {priceRange}). Module 2 — AI audit (4 tiers: Flash {flash}, Targeted {cibleRange}, Strategic SME {pmeRange}, Strategic Mid-cap from {etiFrom}). Module 3 — AI implementation (production deployment, {implEntry}). »
✅ « Interventions sur site » → « On-site sessions ». « Audit Ciblé » → « Targeted Audit ». « Stratégique PME » → « Strategic SME ». « Stratégique ETI » → « Strategic Mid-cap ». Vraie traduction sectorielle, pas littérale.

**Conclusion section 8** : qualité copy EN très bonne. Reste à valider Pass B (5 autres pages) mais sample montre rédacteur EN-natif ou IA très bien promptée. Pas de calque détecté.

### 9. URL slugs canoniques FR + miroir EN — fr leak dans `/en/...` ?

Vérification ciblée des composants nav :

- `src/components/nav/Footer.tsx:27-93` : 27 hrefs, **tous FR-canoniques** (ex `/interventions/essentielle`, `/centre-aide`, `/cas-concrets`, `/audit/par-ville/${v.slug}`). next-intl `Link` (importé via `src/i18n/navigation.ts:6`) traduit auto via `pathnames` map.
- `src/components/nav/HeaderInterventionsMenu.tsx:159-160,287-288` : items via `item.href as never`, mais reste FR-canoniques sous le capot.
- `src/components/nav/LocaleSwitcher.tsx:41-58` : usage `pathname + params` via `useParams()` next/navigation → préserve les slugs dynamiques (`[ville]`, `[slug]`) lors du switch FR↔EN. Bon pattern.

**Aucun `href="/fr/..."` ni `href="/en/..."` hardcodé** trouvé (`grep -E 'href.*=.*"/(fr|en)/' src/components/nav` = 0 hit hors `manifest.ts:59,65,71` qui pré-fixe `/fr` car PWA shortcuts hors locale prefix Next).

Le risque « `/en/interventions/essentielle` au lieu de `/en/interventions/essential` » est **éliminé par construction** : `routing.pathnames` impose le mirror EN typé, et `<Link href="...">` ne typechecke que sur le canonical FR. C'est ce que next-intl appelle le « pathname stable » design.

### 10. Sandbox `/components`, `/sections`, `/design` — i18n-safe ?

Lecture des 3 pages (`src/app/[locale]/{components,sections,design}/page.tsx`) :

- **Aucune utilisation `useTranslations` ou `useLocale`** (`grep "lang|locale|useLocale|useTranslations"` = 0 hit sur ces 3 fichiers).
- Texte hardcodé en mix FR/EN (`Design system · v3.1`, `Editorial Premium Light`, `Section`, `Button`, etc.).
- `pathnames` map FR=EN identique (`src/i18n/routing.ts:17-19` : `"/design": "/design"`, etc.).
- Disallow robots (`src/app/robots.ts:16-25`) et exclusion sitemap (`src/app/sitemap.ts:75-84`).
- ❌ Pas de `metadata.robots: { index: false }` HTML — cf. P1-i18n-06.

**Verdict** : sandbox single-locale acceptable doctrine (dev-only galleries), mais le défaut de `noindex` HTTP en plus du `robots.txt` disallow est une légère vulnérabilité SEO si robots.txt n'est pas respecté.

### 11. Email templates i18n

`src/lib/email/templates/option-posted.tsx:66` passe `locale` brut (`"fr" | "en"`) à `toLocaleString` :

```ts
{
  t.expires(new Date(p.expiresAt).toLocaleString(locale));
}
```

JS Engine accepte `"fr"` ou `"en"` (BCP 47 ne nécessite pas la région) mais retombe sur défauts US/UK par moteur. Non-déterministe entre navigateurs/serveurs. Devrait passer par `fmtDate` SSOT.

`src/lib/email/templates/newsletter-confirm-optin.tsx:45` construit URL avec `locale` (`${baseUrl}/${locale}/confirmation/newsletter?token=...`). OK.

### 12. JSON-LD locale-aware

`src/lib/seo.ts:78-120` (`buildServiceJsonLd`) accepte `locale: Locale` mais émet `inLanguage` ? Non vérifié exhaustivement (lecture partielle). À auditer en Pass B / AGT-04 SEO.

`src/app/[locale]/layout.tsx:135-136` construit Organization + WebSite JSON-LD avec `locale` paramètre. Cohérent.

## Citations

- `src/i18n/routing.ts:11-178` — defineRouting + pathnames (74 entrées, FR canonical EN mirror)
- `src/i18n/navigation.ts:6` — createNavigation export Link, getPathname
- `src/i18n/request.ts:5-10` — getRequestConfig load JSON par locale
- `src/messages/fr.json:1-243` + `src/messages/en.json:1-243` — 224 clés synchronisées
- `scripts/check-i18n.ts:32-45` — parity check flatten + diff
- `pnpm i18n:check` output : `[i18n:check] OK — 224 keys in sync`
- `src/lib/seo.ts:5-76` — buildProductMetadata SSOT (canonical + languages fr/en/x-default + og:locale + twitter)
- `src/lib/intl.ts:13-147` — SSOT Intl helpers (BCP47 mapping fr-FR / en-US)
- `src/content/pricing.ts:551-583,654-672` — formatAmount / formatAmountRange / formatPrice (concat manuelle non-Intl currency)
- `src/app/[locale]/layout.tsx:78-92,139-142` — alternates layout + html lang dynamique
- `src/app/[locale]/page.tsx:36-51` — home generateMetadata (alternates fr/en explicit)
- `src/app/[locale]/confirmation/newsletter/page.tsx:1-135` — page existante hors pathnames
- `src/app/sitemap.ts:75-84` — EXCLUDED_FROM_INDEX (sandbox + confirmation + recherche + mes-donnees)
- `src/app/sitemap.ts:96-106` — alternateLanguages factory (fr/en/x-default)
- `src/app/robots.ts:15-25` — COMMON_DISALLOW sandbox
- `src/app/manifest.ts:14-76` — manifest FR-only (lang: "fr" + shortcuts FR)
- `src/app/opengraph-image.tsx:1-50` — OG default global FR
- `src/components/nav/Footer.tsx:27-93` — hrefs FR-canonical (next-intl auto-translate)
- `src/components/nav/LocaleSwitcher.tsx:41-58` — switch préservant pathname + params
- `src/components/nav/HeaderInterventionsMenu.tsx:22,159-160` — Link via next-intl
- `src/components/sections/VilleServicePageTemplate.tsx:135-150` — buildPageMetadata villes (alternates + noindex anti-doorway HCU)
- `src/app/[locale]/(admin)/[adminPrefix]/page.tsx:21-22` — admin redirect FR hardcoded
- `src/content/villes/copy/paris.ts:28-31,48-51,198-199` — pitchFr/En, directAnswerFr/En, services.audit.en.hero (non-calque)
- `src/content/transversal.ts:39-50` — modulesAnswerEn (traduction sectorielle)
- `src/content/blog/types.ts:84-105,156-157` — BlogPostCopy fr + en required par TS
- `src/content/blog/posts/3-quick-wins-2026.ts:18-28` — post avec fr + en symétriques
- `tests/e2e/i18n.spec.ts:1-78` — couverture redirect, switcher, hreflang head, html lang, 404 locale, sitemap.xml
- `src/app/[locale]/blog/feed.xml/route.ts:44` — RSS `<language>fr-FR</language>` ou `en-US`
- `src/app/[locale]/{components,design,sections}/page.tsx` — sandbox sans `generateMetadata`

## [INCONNU] — éléments non vérifiables

- **Sample qualitatif copy EN sur les 5 pages restantes du sample** : `messages/en.json` audité partiellement (jusqu'à ligne 100), `comparaisons.ts`/`stack-ia.ts`/`audit.ts` non lus exhaustivement EN-side. Restent ~150 KB de copy EN non échantillonné. Lecteur natif EN serait nécessaire pour validation finale qualité culturelle.
- **JSON-LD `inLanguage` field** : `buildServiceJsonLd` / `buildOrganizationJsonLd` lus partiellement (`src/lib/seo.ts:78-120`). À vérifier si chaque schema émet `inLanguage: "fr-FR" | "en-US"` (signal AEO/GEO important).
- **Production prod live** : aucune vérif curl prod (master interdit Phase 2). Le `<link hreflang>` rendu effectif `/fr/` vs `/en/` à valider Phase 4 P-05 (AGT-04 + P-01 headers).
- **Email rendering** : pas de test E2E inbox réel sur templates newsletter / option-posted FR vs EN (admin Sprint 24.1 + cutover Phase 5).
- **`fmtCurrency` usage hors `formatPrice`** : `grep -rn "fmtCurrency" src/` à compléter pour confirmer combien de sites utilisent réellement le SSOT Intl currency vs concat manuelle.

## Recommandations (≤ 10, classées effort × impact)

1. **[2 h / Impact P1]** Migrer `formatAmount` + `formatPrice` vers `fmtCurrency` (`src/content/pricing.ts:551-672` → utiliser `src/lib/intl.ts:53`). Bénéfice : (a) cohérence SSOT Intl ; (b) symbole `€` placé par moteur natif ; (c) « (excl. VAT) » via `notation` ou suffix séparé. Tests à mettre à jour (formatPrice signature inchangée).

2. **[15 min / Impact P1]** Ajouter `export const metadata = { robots: { index: false, follow: false } }` dans `src/app/[locale]/{components,design,sections}/page.tsx`. Belt-and-suspender vs robots.txt disallow.

3. **[10 min / Impact P1]** Ajouter `"/confirmation/newsletter"` entry dans `src/i18n/routing.ts:131` après `"/confirmation": { fr: "/confirmation", en: "/confirmation" }`. Exemple :

   ```ts
   "/confirmation/newsletter": {
     fr: "/confirmation/newsletter",
     en: "/confirmation/newsletter-confirm",
   },
   ```

   Permet `<Link>` typé futur + cohérence map.

4. **[30 min / Impact P1]** Ajouter header HTTP `Content-Language` via `Caddyfile` ou `src/middleware.ts` :

   ```caddy
   @fr path /fr*
   header @fr Content-Language fr
   @en path /en*
   header @en Content-Language en
   ```

   Bénéfice : signal SEO secondaire Bing + bots LLM.

5. **[20 min / Impact P1]** Décision Will sur `en-GB` vs `en-US` (cf. mémoire `axionia_hosting_hetzner` Nuremberg UE + `axionia_naming_cabinet` cabinet UE B2B). Si validée, migrer 3 endroits :
   - `src/lib/intl.ts:17` : `en: "en-GB"`
   - `src/lib/seo.ts:54` : `locale: locale === "fr" ? "fr_FR" : "en_GB"`
   - `src/app/[locale]/layout.tsx:88` : idem
   - `src/app/[locale]/{blog,faq,cas-concrets}/feed.xml/route.ts` : `<language>en-GB</language>`

6. **[30 min / Impact P1]** Tester forme régionale hreflang `fr-FR` / `en-GB` au lieu de `fr` / `en` :
   - `src/lib/seo.ts:46-50` : passer `languages: { "fr-FR": ..., "en-GB": ..., "x-default": ... }`
   - `src/app/[locale]/layout.tsx:80-84` : idem
   - `src/app/sitemap.ts:96-106` : adapter `alternateLanguages` map
     Bénéfice : signal géographique Google plus précis. Test E2E `tests/e2e/i18n.spec.ts:23-31` à patcher en parallèle (`hreflang="fr-FR"`).

7. **[1 h / Impact P2]** Localiser `manifest.ts` via Next 16 pattern (workaround : 2 manifests `/manifest-fr.webmanifest` + `/manifest-en.webmanifest` + injection conditionnelle dans layout via `<link rel="manifest" href={locale === "fr" ? "/fr-manifest" : "/en-manifest"}>`). Coûteux pour gain limité — backlog.

8. **[2 h / Impact P2]** Localiser `opengraph-image.tsx` : créer `src/app/[locale]/opengraph-image.tsx` qui hérite via `cloneElement` du layout principal avec `text={locale === "fr" ? "..." : "..."}`. Bénéfice : partages LinkedIn EN propres.

9. **[15 min / Impact P2]** Migrer `src/lib/email/templates/option-posted.tsx:66` de `toLocaleString(locale)` vers `fmtDate(..., locale)` (SSOT `src/lib/intl.ts:75`). Déterminisme.

10. **[10 min / Impact P2]** Mettre à jour `tests/e2e/i18n.spec.ts:53` pour pointer `/sitemap-index.xml` au lieu de `/sitemap.xml`. Test va passer en prod après ce patch, dévoilera le bug pré-existant (cf. mémoire bugs SEO).

## STOP & ASK consolidés

- **Q-i18n-01** : Will, on valide `en-GB` pour og:locale + BCP47 + hreflang, ou on garde `en-US` ? (Bench : Stripe.com = en-US, Mistral.ai = en-GB, Anthropic.com = en-US). Cabinet UE → recommandation = `en-GB`.

- **Q-i18n-02** : on migre hreflang langue-seule (`fr` / `en`) vers forme régionale (`fr-FR` / `en-GB`) ? Bénéfice = signal Google plus précis pour ciblage France + UK. Risque = mineur, à coupler avec Q-i18n-01.

- **Q-i18n-03** : on mappe `/confirmation/newsletter` dans `pathnames` ? Si oui, slug EN différent (`newsletter-confirm`) ou identique ? Page noindex donc pas d'impact SEO, mais mapping cohérent.

- **Q-i18n-04** : on ajoute `Content-Language` header HTTP via Caddyfile (côté infra) ou middleware Next (côté code) ? Caddyfile = plus rapide + cache CF natif, middleware = plus testable.

- **Q-i18n-05** : on ouvre un OG image localisé EN (effort 2 h dev, gain conversion ~3 pts) ou on reste single FR ?

- **Q-i18n-06** : `formatPrice` reste avec concat manuelle (lisibilité maintenance) ou on bascule sur `Intl.NumberFormat({ style: "currency", currency: "EUR" })` SSOT (cohérence SSOT, perte « (excl. VAT) » suffix qu'il faudra réinjecter manuellement) ?

---

**Wall-clock effectif** : ~50 min (sub-1h sur timeout 90 min). Audit lecture-seule conforme master § 0.5. Aucun fichier modifié hors ce livrable.
