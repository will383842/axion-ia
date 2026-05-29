# Phase 3 — Livraison (Génération de contenu : anti-prix global)

> Exécutée en autopilot le 2026-05-29 (feu vert Will « LANCE LA PHASE 3 »). Branche `feat/pricing-ssot-propagation`. **NON mergé sur main.**

## Livré

### 3.1 — Price-gate post-génération (nouveau)
`src/server/content-gen/quality/price-gate.ts` : `findNonSsotPrices(text)` /
`passesPriceGate(text)`. Réutilise `PATTERN_AMOUNT_EUR` (exporté de
`fact-check/claims-extractor.ts`). Allowlist = tous les montants de `pricing.ts`
(priceFlat/Onsite/Min/Max + sous-tiers). Tout montant € **hors SSOT** → violation
`block` ; les tokens `{{price:…}}` n'ont pas de « € » → jamais flaggés ; `$`/`USD`
ignorés. **Branché dans `quality/doctrine-check.ts::checkDoctrine`** (appelé par
les workers quality-gate) → le contenu généré avec un prix non-SSOT est rejeté/
régénéré. Tests : `price-gate.test.ts` (6 cas).

### 3.2 — Brand-voice anti-montant
`brand/brand-voice.ts` `VOCAB_BASE` : règle ABSOLUE renforcée — jamais de montant
en chiffres/€/EUR/euros ; utiliser EXCLUSIVEMENT un token `{{price:<tierId>}}` (liste
fournie) ou renvoyer vers /tarifs. Hérité par les 5 personas.

### 3.3 — Generators « rogues »
- `landing-ville-faq-extended.ts` : supprimé l'exemple inventé « 290 €…1 290 € »,
  remplacé par instruction d'utiliser les tokens `{{price:…}}`.
- `v7-phase8-generators.ts` : 2 CTA « 490 € » → dérivés de la SSOT
  (`intervention-essentielle` = vrai prix, corrige le mislabel 490).
- `ville-hub-copy.ts` : exemple de prompt « 490 € HT » → `{{price:audit-flash|flat}}`.
- `landing-ville-cas-usage.ts` : exemple d'interdiction « économise 1M€ » → « 1 million »
  (retrait du € dans un template de prompt).

### 3.4 — KB facts alignés SSOT (décision Will : déterministe)
Les KB facts (RAG) citaient un **catalogue de prix entièrement différent** de la
SSOT (coaching 3/6 mois 3 500–9 000 €, chatbot 8 000–15 000 €, projets 25 000–80 000 €,
formations CPF 2 500–3 500 €, audit PME/ETI 8 000/18 000 €) avec des `sourceUrl`
prétendant que c'était sur le site — alors que le site/SSOT affiche 990 €,
4 900–12 000 €, onQuote. **Faits faux/périmés.**
- Faits prix Axion (`source: "… Grille tarifaire …"`) → reformulés en « sur devis
  selon le périmètre » (un-à-un, interventions-formations, implementations).
- `audit-054` (audit PME/ETI — produit existant en SSOT) → **tokenisé**
  (`{{price:audit-strategique-pme|range}}` / `{{price:audit-strategique-eti|from}}`).
- « garantie de résultats » (mot banni) → « objectifs de résultat définis
  contractuellement ».
- Stats marché tierces (DGE, CNNum, Deloitte, Syntec, BPI, IDC…) + cas client +
  économies réalisées → **conservées + `price-exempt`** (ce ne sont pas des tarifs Axion).

### 3.5 — Surface content-gen du garde-fou ACTIVÉE
`no-hardcoded-prices.spec.ts` scanne désormais aussi `src/server/content-gen/**`
(hors tests). 0 violation. C'est l'enforcement permanent côté génération, doublé
par le price-gate au runtime.

## Vérifications
- `pnpm typecheck` : **0 erreur**.
- `eslint` : 0 erreur (3 warnings `console` pré-existants dans ville-hub-copy).
- Garde-fou : **vert** sur TOUTES les surfaces (code/config + villes + content-gen).
- `price-gate.test` : 6/6 ; `pricing-tokens.test` : 20/20.
- Suite vitest complète : voir run final.

## ⚠️ À signaler à Will (qualité KB, hors-scope prix)
Les KB facts avaient des problèmes au-delà des prix : « garantie de résultats »
(corrigé), « éligible CPF » / « déductible taxe d'apprentissage » (claims à vérifier
— Axion est-il OF certifié ?), `sourceUrl` pointant des prix absents du site. Une
**revue/re-seed des KB facts** serait utile (faits `impl-025` « Résultat ou
Remboursement » CGV, mentions CPF, etc.). Le price-gate protège la sortie quoi qu'il arrive.

## État global du sprint Pricing SSOT
Phases 1 + 2 + 3 livrées sur `feat/pricing-ssot-propagation`. `pricing.ts` est la
seule source de vérité : un changement de prix s'y propage partout (code via
helpers, prose via tokens), avec garde-fou CI (3 surfaces) + price-gate runtime.
**NON mergé sur main** (merge = déploiement prod, attend OK Will).
