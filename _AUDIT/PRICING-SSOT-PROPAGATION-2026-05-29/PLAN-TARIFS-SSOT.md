# Plan — Tarifs : une seule source de vérité (`pricing.ts`), propagation automatique partout, zéro prix obsolète

> Plan validé par Will le 2026-05-29 (session 87fbf383). Aucun code écrit encore.
> SSOT = `axionia/src/content/pricing.ts`.

## Contexte (pourquoi)

Le site Axion-IA affiche des tarifs sur des **centaines d'URL** : home, `/tarifs`, pages services (`/audit`, `/implementation`, `/un-a-un`, `/interventions`, `/sites-web-augmentes`) + leurs pages enfants, ~2 159 pages villes, FAQ de chaque page, contenu généré (blog/articles/landing), `llms.txt`, JSON-LD.

La **source de vérité unique (SSOT) = `src/content/pricing.ts`**. Décision Will : « on change le prix ICI, ça se propage partout ». **Mais** l'audit (4 explorations parallèles) montre que ce principe n'est respecté que par la couche « structurée » (~22 fichiers qui dérivent déjà via `formatPrice`/`formatAmount`/`getEntryLabel`). Partout ailleurs, des prix sont **écrits en dur** et ne se mettent PAS à jour :

- **Bugs déjà en ligne** : `CollectiveTrainingPage` affiche « Essentielle 490 € » (vrai = 690 €) ; `interventions.ts` EN affiche « €880/€1 420/€2 140 » (périmé, vrai = 1190/1590/2490) ; keyword « 489 € » (typo).
- **~13 fichiers code/config en dur** : `tarifs/page.tsx` (la vitrine prix, ~12 littéraux), `audit-detail-configs.ts` (~17), `audit-taxonomy.ts` (~12), `interventions.ts` (5), metas SEO des pages enfants services (audit/flash, cible, strategique-*, interventions/*), `llms.txt`/`llms-full.txt`, `interventions-taxonomy.ts`, `intervention-detail-configs.ts`.
- **~1 870 fichiers villes** : prix figés dans la prose (`directAnswerFr`, `servicesContext.*`, `faqGeolocalisee[].a`, `services.<svc>.fr.{hero,faq,pricing}`).
- **Génération de contenu** : `landing-ville-faq-extended.ts` **invente** « 290 €…1 290 € » (absents SSOT) ; `v7-phase8-generators.ts` a 2 CTA « 490 € » en dur ; les KB facts du RAG citent des prix qui **contredisent** la SSOT (un-à-un 3 500–5 000 €, audit PME 8 000 €, ETI 18 000 €, implémentations 8 000–80 000 €).
- **Aucun garde-fou** : rien n'empêche la réintroduction d'un prix en dur.

**Décisions Will** : (1) tout doit dériver de `pricing.ts` ; rien ne peut le contredire ; ce qui n'y est pas = « sur devis ». (2) prix fixes = nombre, variables = `onQuote`, catalogue évolutif via ce seul fichier. (3) garder les prix visibles dans la prose villes/FAQ (bon SEO/AEO) mais via **tokens auto-résolus**.

## Principe directeur

**Deux mécanismes selon la nature du fichier :**
- **Code (pages, composants, configs `.ts` importés)** → remplacer les littéraux par des **appels directs aux helpers SSOT** (`formatPrice(getTierById(...))`, `getEntryLabel(...)`). Pas de token : c'est du code.
- **Données prose stockées comme chaînes opaques (copy villes, contenu généré)** → **tokens** `{{price:<tierId>}}` résolus au rendu depuis la SSOT.

Tout prix non présent dans `pricing.ts` → « Sur devis » (le tier a déjà `onQuote: true`).

---

## Phase 1 — Cœur du mécanisme + correctifs code/config + garde-fou CI

### 1.1 Résolveur de tokens (nouveau) — `src/content/pricing-tokens.ts`
- `PRICE_TOKEN_REGEX` reconnaissant `{{price:<tierId>}}` et `{{price:<tierId>|<mode>}}`, mode ∈ `flat|onsite|range|from|entry|full` (défaut `full` = `formatPrice`).
- Map `tierId → tier` construite en aplatissant `PRICING_CATEGORIES` + `UN_A_UN_TIERS` + sub-tiers (réutilise `getTierById`).
- `resolvePriceTokens(text, locale)` : remplace chaque token via les helpers existants de `pricing.ts` (`formatPrice`, `formatAmount`, `getFromLabel`, `formatPriceWithOnsite`). Tier `onQuote` → « Sur devis ».
- `resolvePriceTokensDeep(value, locale)` : walker récursif (string/array/object) pour objets copy.
- Tokens inconnus → log + laissés tels quels (détectés par le garde-fou).

### 1.2 Garde-fou CI (nouveau) — `src/content/__tests__/no-hardcoded-prices.spec.ts` (vitest)
- Scanne les surfaces « prix Axion-IA » : `src/content/villes/copy/**`, `src/content/*.ts` (hors `pricing.ts`), `src/app/[locale]/**/page.tsx`, `src/components/**`, `src/server/content-gen/**`, `src/app/llms*.txt/route.ts`.
- Échoue si un littéral montant euro (`\d[\d  .]*\s*(€|EUR|k€)…`) apparaît, SAUF : (a) dans `pricing.ts`, (b) un token `{{price:…}}`, (c) une ligne portant le marqueur `/* price-exempt: <motif> */` (prix marché/concurrents/coûts API/seuils légaux — liste les fichiers déjà identifiés : `comparaisons.ts`, `glossary-extension.ts`, `stack-ia-details.ts`, `legal.ts`, `case-studies.ts`, `blog/posts/**`, `knowledge/sector-entries/**`, ranges marché des `keywords/**`).
- C'est l'enforcement permanent « plus jamais de prix obsolète ».

### 1.3 Corriger les bugs (P0)
- `components/sections/CollectiveTrainingPage.tsx` (l.178/179) : « 490 € » → dérivé `intervention-essentielle` (690 €).
- `content/interventions.ts` (l.807 EN périmé) ; `keywords/g4-aeo.ts` (l.69 « 489 € »).

### 1.4 Dériver tous les fichiers code/config (remplacer littéraux par helpers SSOT)
Pattern unique répété ; fichiers principaux :
- **`src/app/[locale]/tarifs/page.tsx`** : meta desc + alt image + les 8 `benefit` → dérivés des tiers (`formatPrice`/`getEntryLabel`).
- **Metas SEO pages enfants** : `audit/flash`, `audit/cible`, `audit/strategique-pme`, `audit/strategique-eti`, `interventions/atelier-ia-cible`, `interventions/demarrage-ia-express`, `interventions/dirigeant-productivite` → titres/descriptions dérivés.
- **`src/content/audit-detail-configs.ts`** (~17) + **`audit-taxonomy.ts`** (~12) : prose + `priceLabelFr` → dérivés des `AUDIT_*_SUB_TIERS`.
- **`src/content/interventions.ts`** (l.742/765/1300/1359 + commentaires obsolètes) ; **`interventions-taxonomy.ts`** (l.368-369 `690`) ; **`intervention-detail-configs.ts`** (l.598 `priceFlatEur: 990`).
- **`src/app/llms.txt/route.ts`** (l.46) + **`llms-full.txt/route.ts`** (l.79) : `990 €` → `getEntryLabel(UN_A_UN_TIERS,"fr")`.
- Prose « maintenance 290 €/mois » dans `audit/page.tsx`, `implementation/page.tsx`, `sites-web-augmentes/page.tsx`, `CollectiveDurationListing.tsx` → dérivé `maintenance-standard`.
- **Sans tier (codage-web 2 000–30 000 €, day-rate 2 200 €, formation 3 j 8 000 €)** : per Will « je ne sais pas » → afficher « Sur devis » / renvoi `/tarifs`, et marquer `/* price-exempt */` en attendant que Will fixe un tier dans `pricing.ts`. Aucune invention de prix fixe.

*(JSON-LD déjà 100 % dérivé — `service-binding.ts`, `seo.ts`, `ville-service-jsonld.ts` — rien à faire.)*

---

## Phase 2 — Prose des ~1 870 villes (tokens + résolveur)

### 2.1 Point d'injection unique
- `src/content/villes/resolve-with-copy.ts` → `resolveVilleWithCopy(slug)` est le **passage obligé** de toutes les pages villes (hub, 4× par-ville, sitemap, JSON-LD, worker). Y appliquer `resolvePriceTokensDeep(copy, locale)` avant retour → couvre fichiers manuels **+** auto-générés **+** branche DB `GeneratedVilleCopy`, sans toucher aux ~25 fichiers de rendu.

### 2.2 Codemod de migration (nouveau) — `scripts/pricing/tokenize-ville-prices.ts`
- Pour chaque `src/content/villes/copy/*.ts` : remplace les littéraux par tokens en s'ancrant sur la **valeur SSOT actuelle + le contexte du champ** (`servicesContext.audit`→`audit-flash`, `.interventions`→entrée interventions, `.implementation`→`impl-poc`, `.unAUn`→`un-a-un` ; prose libre via mots-clés audit/formation/implémentation/coaching).
- Dry-run + rapport des occurrences ambiguës/non mappées (laissées en l'état pour revue manuelle, puis rattrapées par le garde-fou).
- Idempotent.

### 2.3 Générateur villes émet des tokens
- `src/server/content-gen/generators/ville-hub-copy.ts` (`buildUserPrompt` l.537-582) : au lieu d'injecter les montants, demander au LLM d'utiliser les tokens `{{price:…}}`. Les futures générations sont nativement propres.

---

## Phase 3 — Génération de contenu (anti-prix global)

- **`src/server/content-gen/brand/brand-voice.ts`** (`VOCAB_BASE`) : règle renforcée « ne jamais écrire de montant € ; pour un prix, utiliser un token `{{price:…}}` ou renvoyer vers `/tarifs` ».
- **Générateurs rogues** : `landing-ville-faq-extended.ts` (l.130 — supprimer « 290 €…1 290 € » inventés, injecter tokens/SSOT comme `ville-hub-copy`) ; câbler les 5 `landing-ville-*` à brand-voice ; `v7-phase8-generators.ts` (l.68/113 CTA → dérivés).
- **Garde-fou post-génération (nouveau)** — `src/server/content-gen/quality/price-gate.ts` : réutilise `PATTERN_AMOUNT_EUR` de `fact-check/claims-extractor.ts` ; construit l'allowlist depuis `pricing.ts` ; **bloque** tout montant € non conforme (sauf tokens). Branché dans `quality/doctrine-check.ts` (`checkDoctrine`) pour couvrir tous les générateurs qui l'appellent déjà + ajouté aux 5 `landing-ville-*`.
- **KB facts contradictoires** (`kb/un-a-un.ts`, `interventions-formations.ts`, `implementations.ts`, `audits.ts`) : tout fait `source: "Axion-IA — Grille tarifaire…"` → aligné sur la SSOT (audit PME/ETI mappés sur tiers existants `audit-strategique-pme`/`-eti`) ou passé en « sur devis ». Les stats marché tierces (sourcées DGE/McKinsey/BPI…) sont conservées (`price-exempt`).

---

## Fichiers critiques
- SSOT : `src/content/pricing.ts` (inchangé, déjà bon).
- Nouveaux : `src/content/pricing-tokens.ts`, `src/content/__tests__/no-hardcoded-prices.spec.ts`, `scripts/pricing/tokenize-ville-prices.ts`, `src/server/content-gen/quality/price-gate.ts`.
- Injection villes : `src/content/villes/resolve-with-copy.ts`.
- Helpers réutilisés : `getTierById`, `getEntryPriceEur`, `getEntryLabel`, `formatPrice`, `formatAmount`, `formatPriceWithOnsite` (pricing.ts) ; `PATTERN_AMOUNT_EUR`/`extractClaims` (claims-extractor.ts) ; `checkDoctrine` (doctrine-check.ts).

## Vérification (end-to-end)
1. `pnpm typecheck` + `pnpm lint` → 0 erreur.
2. `pnpm vitest` incluant le nouveau garde-fou → vert (et il DOIT échouer si on réintroduit un littéral, à tester en injectant temporairement « 999 € »).
3. Codemod en **dry-run** d'abord → revoir le rapport d'ambiguïtés avant apply.
4. `pnpm dev` + contrôle visuel : `/fr/tarifs`, une page enfant (`/fr/audit/flash`), une page ville (hub + `…/un-a-un/par-ville/grenoble`) → prix corrects et cohérents prose↔grille↔JSON-LD.
5. **Test de propagation** : changer temporairement Audit Flash 490→590 dans `pricing.ts`, rebuild, vérifier que /tarifs, pages enfants, grille ville ET prose/FAQ ville affichent 590 partout. Revert.
6. Génération : lancer un generator (ex `landing-ville-faq-extended`) en test → vérifier que le `price-gate` bloque tout montant € non-SSOT.

## Ordre de livraison
Phase 1 (cœur + garde-fou + code/config) livrable et déployable seule (gros gain immédiat, ~20 fichiers). Phase 2 (villes) ensuite. Phase 3 (génération) en dernier. Commits séparés par phase.
