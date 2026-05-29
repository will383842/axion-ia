# Phase 2 — Livraison (Prose villes : tokens + résolveur + codemod)

> Exécutée en autopilot le 2026-05-29, suite de Phase 1. Branche `feat/pricing-ssot-propagation`. **NON mergé sur main.**

## Livré

### 2.1 — Injection du résolveur (couche données, plus robuste que le plan)
Le plan prévoyait d'injecter `resolvePriceTokensDeep` uniquement dans
`resolveVilleWithCopy`. **Mais l'exploration a montré que plusieurs consommateurs
lisent `.copy` en SYNC** sans passer par lui (pages région/implantations, sitemap,
opengraph-image, `VilleServicePageTemplate`) → des tokens auraient fui non résolus.

→ Résolution déplacée à la **couche données** : `villes/index.ts` (le `VILLES.map`,
module-init) applique `resolvePriceTokensDeep(copy, "fr")` à chaque copy. **Tous**
les consommateurs (sync + async) obtiennent une copy résolue. La branche DB
(`resolveVilleWithCopy` → `GeneratedVilleCopy`) résout aussi explicitement.

✅ Vérifié runtime : `getVille("carpentras").copy` rend « 490 € HT / 590 € HT /
990 € HT » (résolus), `UNRESOLVED TOKENS PRESENT: false`.

### 2.2 — Codemod `scripts/pricing/tokenize-ville-prices.ts`
DRY-RUN par défaut, `--apply` pour écrire, idempotent, EOL préservé (CRLF).
Map valeur→tier **dérivée de pricing.ts + assertions anti-drift**. Passe ranges
puis singles ; résolution contextuelle (mots-clés ligne + bloc-service) pour les
valeurs ambiguës (890/990) ; modes `flat`/`compact`/`entry`/subtier selon « HT ».

**Résultat (appliqué) : ~8 700 tokens** sur ~1 870 fichiers villes :
- `{{price:audit-flash|flat}}` (le gros), `intervention-4h|flat`,
  `intervention-dirigeants|flat`, `impl-poc|entry`, sous-tiers audit, compact.
- Couvre `€`, `EUR`, `euros` (un batch de villes écrivait les prix en toutes
  lettres → normalisés en « € »).

**2 bugs codemod attrapés en dry-run** :
- *Lookbehind* `(?<![\d-])` : sans lui, « accompagnement **1-à-1 990 €** » était lu
  « 1 990 » (corruption ; « 1-à-1 590 » serait devenu 1590). Critique.
- Motif « 1-à-1 » ajouté à la détection coaching (sinon 990 ambigu).

### 2.3 — Générateur villes émet des tokens
`ville-hub-copy.ts` `buildUserPrompt` : le prompt n'injecte plus de montants ; il
demande au LLM d'utiliser les tokens `{{price:…}}` (+ interdiction dure de tout
montant en chiffres/€/EUR/euros). **Bonus** : corrige le mislabel « entrée
intervention = 590 (Formation 4h) » qui était présenté comme « Intervention
Essentielle » (qui vaut 690).

## ⚠️ Surface villes du garde-fou : DÉFÉRÉE (décision)
Activer `content/villes/copy/**` dans `no-hardcoded-prices.spec.ts` ferait échouer
57 lignes :
- **~42 prix EN** dans les champs long-form `services.*.en` des ~12 villes pilotes
  (« from €990 excl. VAT »). Les tokeniser les rendrait en **FR dans un champ EN**
  (« 990 € HT excl. VAT », cassé). **Règle Will : ne jamais investir sur l'EN**
  (locale 301→FR).
- **~12 € FR légitimes non-Axion** (revenu médian INSEE, prix immobilier) →
  demanderaient des marqueurs price-exempt.
- **3 spans** « 490-990 € » + **1 hallucination** (auxerre, cf. ci-dessous).

→ Surface laissée DÉFÉRÉE avec commentaire explicatif. La régression FR est couverte
par le codemod (idempotent, re-runnable) + le générateur (émet des tokens). À
activer quand l'EN sera retiré OU que le résolveur gérera la locale par champ.

## ⚠️ Bug contenu à signaler (NON corrigé — décision Will)
`auxerre.ts:55` : « …puis **990 € HT pour un Audit Approfondi** ». **Aucun tier
audit à 990 €** n'existe (Flash 490, Ciblé 1900-3900, Strat PME 4900-9900, ETI
12000). Hallucination LLM. Laissé en l'état (ne pas tokeniser = ne pas masquer le
bug). À corriger en revue contenu : soit retirer la mention, soit pointer le vrai
tier suivant (Ciblé). Possible que d'autres villes aient des hallucinations
similaires (audit content à corriger hors-scope tokens).

## Vérifications
- `pnpm typecheck` : **0 erreur**.
- `eslint` : 0 erreur (3 warnings `console` pré-existants dans le générateur).
- `prettier` : appliqué ; fichiers villes inchangés (codemod = édits intra-string,
  formatage préservé).
- Garde-fou `no-hardcoded-prices` : **vert** (code/config ; villes déférées).
- `pricing-tokens.test` : 17/17 (mode `compact` ajouté).
- Quality gate villes (hors CI) : **12703 passed**, 0 failed (tokens n'ont pas
  cassé les word counts).
- Suite vitest complète : **1985 passed, 0 failed**.

## Reste (Phase 3 — NON livrée)
brand-voice anti-montant, generators rogues (`landing-ville-faq-extended` invente
290-1290 €, `v7-phase8` CTA 490), `price-gate.ts` post-génération, alignement KB
facts contradictoires. Puis activer la surface `server/content-gen/**` du garde-fou.
