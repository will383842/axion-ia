# Phase 1 — Livraison (Tarifs SSOT : cœur + correctifs code/config + garde-fou CI)

> Exécutée en autopilot le 2026-05-29 depuis `PLAN-TARIFS-SSOT.md`.
> Branche : `feat/pricing-ssot-propagation` (basée sur `feat/kb-service-binding`, l'état contre lequel le plan a été validé).
> **NON mergé sur main** (attente OK Will).

## Ce qui a été livré

### 1.1 — Résolveur de tokens (nouveau)

`src/content/pricing-tokens.ts` : `{{price:<tierId>}}` / `{{price:<tierId>|<mode>}}`
avec modes `full|flat|onsite|range|from|entry`. Registre plat `id → tier/sous-tier`
construit depuis `PRICING_CATEGORIES + UN_A_UN_TIERS + subTiers`. `resolvePriceTokens`
+ walker récursif `resolvePriceTokensDeep`. Tier `onQuote`/id sans prix → « Sur devis ».
Token inconnu → laissé en l'état + `console.warn`.
Tests : `src/content/pricing-tokens.test.ts` (16 cas, attendus dérivés de la SSOT).

> Le résolveur sera **branché** sur la prose en Phase 2 (`resolveVilleWithCopy`) et Phase 3
> (générateurs). En Phase 1 il est livré + testé, prêt à l'emploi.

### 1.2 — Garde-fou CI (nouveau)

`src/content/__tests__/no-hardcoded-prices.spec.ts` : échoue si un montant € en dur
apparaît dans une surface « prix Axion-IA ». Trois échappatoires : `pricing.ts`,
token `{{price:…}}`, marqueur de ligne `price-exempt`. + allowlist de fichiers
non-Axion (comparatif marché, glossaire, stack, légal, études de cas, **regions.ts**
(PIB), **ImplementationComparisonMatrix** (build-vs-buy)). Les commentaires (//, JSDoc,
JSX `{/* */}`) sont ignorés (changelog/doc, pas des prix affichés).

**Surfaces activées Phase 1** : `content/*.ts` (top-level), `app/**/page.tsx` (hors `(admin)`),
`components/**`, routes `llms*.txt`. **Surfaces déférées** (commentées dans le test, à activer
quand leur phase tokenise) : `content/villes/copy/**` (Phase 2), `server/content-gen/**` (Phase 3),
`content/keywords/**` (phase ultérieure).

Résultat : **0 violation** sur les surfaces activées (207 littéraux traités).

### 1.3 — Bugs P0 corrigés

- `CollectiveTrainingPage.tsx` : « Essentielle 490 € » → dérivé `intervention-essentielle` (**690 €**).
- `interventions.ts` : bloc EN périmé « €880 / €1 420 / €2 140 » → dérivé `APPROFONDIE_SUB_TIERS`
  (**1 190 / 1 590 / 2 490**) ; idem ligne FAQ EN « €880 ». Commentaires obsolètes corrigés.
- `keywords/g4-aeo.ts` : typo « 489 € » → **490 €**.

### 1.4 — Code/config dérivés de la SSOT

Tous les littéraux € (prix Axion) remplacés par des appels helpers :
`audit-detail-configs.ts` (16 priceLabels + prose FAQ), `audit-taxonomy.ts` (badges/taglines),
`interventions.ts` (FAQ + cartes 990 Claude), `tarifs/page.tsx` (meta + alt + 8 benefits),
`BookingCalendar.tsx` (~20 labels + scheduleHints), pages enfants audit
(flash/cible/strategique-pme/strategique-eti) + interventions
(atelier/demarrage/dirigeant-productivite), `implantations/page.tsx`, `audit/page.tsx` (890 onsite),
`implementation/page.tsx` + `sites-web-augmentes/page.tsx` + `CollectiveDurationListing.tsx`
(maintenance 290), `intervention-detail-configs.ts` (990 → dérivé), routes `llms.txt`/`llms-full.txt` (990).

**Corrections de dérive détectées au passage** :
- `implantations` : « Formations dès 490 € » était faux (entrée interventions réelle = **590 €** via
  `intervention-4h`) → corrigé automatiquement par dérivation `getEntryPriceEur(INTERVENTION_TIERS)`.
- `llms-full.txt` : `iaCustomMax` rendait « NaN » (impl-ia-custom est passé `onQuote` sans `priceMax`)
  → reformulé en « (sur devis) ».

## Décisions appliquées (conformes au plan / décisions Will)

- **Ce qui n'est pas dans `pricing.ts` = « sur devis »** : formation 3 jours (ancre indicative
  « 8 000 € HT » retirée de `CollectiveDurationListing`, remplacée par renvoi /tarifs).
- **Prix non-Axion conservés + `price-exempt`** : coût agence SEO concurrente (`automatisations.ts`),
  « devis opaque 30 k€ » concurrent (`AuditConversionBlocks.tsx`), placeholder budget visiteur
  (`UnifiedContactForm.tsx`), seuil de qualification devis « > 5 000 € » (`demande-devis`), ranges
  marché ROI « 3-15 k€ / 5-50 k€ » (`cas-concrets`), PIB régionaux (`regions.ts`, fichier exempté),
  build-vs-buy (`ImplementationComparisonMatrix`, fichier exempté).
- **`guide-ia`** : badge « Gratuit · 0 € » → « 100 % gratuit » (suppression du « 0 € » redondant).

## ⚠️ Point à trancher par Will (signalé, non bloquant)

**Codage / dev web** (`codage-developpement/page.tsx` + `web-digital/page.tsx`) : les prix publics
« 2 000 € → 30 000 € » n'ont **aucun tier dans `pricing.ts`** (Will : « je ne sais pas » au 2026-05-29).
Le plan offrait deux options. J'ai choisi la **conservatrice** : prix **gardés** (ce sont des prix de
vente affichés, fermes, ≠ simple mention indicative) + marqueur `price-exempt` + `TODO(pricing SSOT)`.

→ **Décision Will attendue** : soit ajouter un tier `codage-web` à `pricing.ts` (puis je dérive),
soit confirmer le passage en « Sur devis » (suppression des montants), soit garder en l'état.

## Vérifications

- `pnpm typecheck` (tsc --noEmit) : **0 erreur**.
- `eslint` sur les 32 fichiers modifiés : **0 erreur**. `prettier --write` appliqué.
- Garde-fou `no-hardcoded-prices.spec.ts` : **vert** (2/2) — + auto-test prouvant qu'il détecte bien
  un littéral injecté (« 999 € », « €1,900 », « 120 k€ ») et qu'il ignore `currency: "EUR"`.
- `pricing-tokens.test.ts` : **16/16**.
- Suite vitest complète : voir résultat du run final.

## Reste à faire (phases suivantes — NON livrées)

- **Phase 2** : tokeniser la prose des ~1 870 villes (`scripts/pricing/tokenize-ville-prices.ts` en
  dry-run d'abord) + brancher `resolvePriceTokensDeep` dans `resolveVilleWithCopy` + générateur
  villes émet des tokens. Puis activer la surface `villes/copy/**` dans le garde-fou.
- **Phase 3** : brand-voice anti-montant, générateurs rogues, `price-gate.ts` post-génération,
  alignement KB facts. Puis activer la surface `server/content-gen/**`.
