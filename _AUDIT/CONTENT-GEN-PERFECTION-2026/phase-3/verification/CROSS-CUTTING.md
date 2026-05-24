# CROSS-CUTTING — Vérification Sprint P3

## Date : 2026-05-21

## HEAD audité : c553510d (Manon P4), P3 commit : 417befc2

---

## 1. CORRECTIONS D'ERREURS AGENTS

### Agent V3-01 — QW-1 speakable : FAUX NÉGATIF

Agent V3-01 a conclu "0/20 pour QW-1 speakable" en lisant buildArticleJsonLd seo.ts jusqu'à la ligne 686 seulement.
La vérification directe confirme que `speakableSelector` est bien implémenté à partir de la ligne 691 de seo.ts :

```typescript
speakableSelector?: string | false;
// ...
...(speakableSelector !== false ? {
  speakable: {
    "@type": "SpeakableSpecification",
    cssSelector: typeof speakableSelector === "string"
      ? [speakableSelector]
      : [".article-intro", "h1", "[data-aeo='tldr']"],
  },
} : {})
```

**Résultat corrigé : QW-1 = 20/20 ✅**

### Agent V3-02 — QW-7 CF WAF : 307 = OK (pas un block)

Agent V3-02 a donné 10/20 car les curls retournent HTTP 307. Le 307 est le redirect normal de next-intl (`/ → /fr/`) — les bots IA ne sont PAS bloqués, ils accèdent au contenu. HTTP 403 serait le signal de blocage.
**Résultat corrigé : QW-7 = 20/20 ✅** (bots IA accessibles)

### V3-04 — Concurrent axionai.fr : FAUX POSITIF

Will confirme : "axionai.fr" n'est pas un concurrent. **axion-ia.com** est le propre domaine Axion-IA. La mémoire `axionia_keyword_strategy_audit_2026-05-19` contenait une erreur sur ce point.
Impact : les 20 pts "brand disambiguation page" V3-04 sont moins urgents. Les seeds h-notoriete.ts restent utiles pour la notoriété générale.

---

## 2. COHÉRENCE INTER-AGENTS

### Accord multi-agents sur les vrais gaps

| Gap identifié                                     | Agents              | Sévérité       |
| ------------------------------------------------- | ------------------- | -------------- |
| blog/[slug] AuthorByline absent                   | V3-01, V3-07        | 🔴 P0          |
| blog/[slug] ArticleTOC absent                     | V3-03               | 🔴 P0          |
| Wikidata Q-ID absent                              | V3-01, V3-05, V3-10 | ⏳ Will action |
| alternateName non propagé à LocalBusiness/Dataset | V3-05               | 🟡 P1          |
| addressLocality placeholder                       | V3-05, V3-10        | ⏳ Will action |
| hasOfferCatalog absent                            | V3-05               | 🟡 P1          |
| isBasedOn non passé au callsite blog              | V3-06               | 🟡 P1          |

### Cohérences confirmées par plusieurs agents

| Item OK                                    | Agents                     | Score |
| ------------------------------------------ | -------------------------- | ----- |
| legalName "Axion-IA" partout (5 factories) | V3-01, V3-05               | ✅    |
| alternateName 4 variantes Organization     | V3-01, V3-04, V3-05        | ✅    |
| search_term_string urlTemplate             | V3-02, V3-06               | ✅    |
| speakable buildArticleJsonLd               | V3-06 (+ correction V3-01) | ✅    |
| ArticleTOC Server Component pur            | V3-03, V3-08               | ✅    |
| AuthorByline guides + cas-concrets         | V3-01, V3-07, V3-09        | ✅    |
| AiContentDisclaimer wording P4 cohérent    | V3-07, V3-09               | ✅    |
| Persona Manon sans social                  | V3-07, V3-09               | ✅    |
| CF WAF bots IA accessibles (307→200)       | V3-02, V3-10               | ✅    |
| Sécurité : 0 clé API côté client           | V3-10                      | ✅    |
| Pas de migration Prisma P3                 | V3-09                      | ✅    |
| Web Vitals : 0 régression                  | V3-08                      | ✅    |

---

## 3. TYPECHECK — ANALYSE BASELINE

**Baseline P1.5** : 0 erreurs typecheck  
**HEAD actuel (c553510d)** : 4 erreurs — TOUTES dans `src/server/content-gen/brand/glossary-context.ts`

```
glossary-context.ts(14,10): error TS2305: Module '"@/content/glossary-extension"' has no exported member 'GLOSSARY_EXTENSION'.
glossary-context.ts(30,46): error TS7006: Parameter 'term' implicitly has an 'any' type.
glossary-context.ts(39,26): error TS7006: Parameter 'a' implicitly has an 'any' type.
glossary-context.ts(45,30): error TS7006: Parameter 't' implicitly has an 'any' type.
```

Ces 4 erreurs proviennent du **commit P4 Manon c553510d** (Phase PARALLÈLE P0-6+P0-7), **pas du commit P3 417befc2**.

**Verdict** : Régression typecheck = P4, pas P3. Pas de pénalité sur le score P3.
**Action** : Manon doit corriger dans son prochain commit P4.

---

## 4. VITEST

**Résultat** : 1376/1383 (7 skipped pré-existants) ✅
**Baseline P1.5** : 1376/1383 ✅
**Verdict** : Aucune régression. Identique à la baseline.

---

## 5. PERSON JSON-LD DUPLICATION (V3-09)

Guides avec steps structurées émettent 2 Person JSON-LDs :

1. Via `buildHowToJsonLd` (seo-content-gen-factories.ts)
2. Via `AuthorByline` (P3 ajout)

Ce n'est pas bloquant (Google déduplique par name+type) mais mérite cleanup. Non bloquant.

---

## 6. SCOPE SPRINT P3 — CLARIFICATION

Le sprint P3 n'était PAS mandaté d'ajouter AuthorByline à blog/[slug] selon le prompt original. Voici ce que le prompt dit pour QW-5 :

> "Importer dans : src/app/[locale]/blog/[slug]/page.tsx, src/app/[locale]/cas-concrets/[slug]/page.tsx, src/app/[locale]/guides/[slug]/page.tsx"

Donc blog/[slug] était bien dans le scope — c'est un gap réel.

---

## 7. RECOMMANDATIONS PRIORITAIRES

### P0 — À corriger dans sprint P3 follow-up

1. **blog/[slug] AuthorByline** : ajouter import + JSX avec `authorName={view.author}`
2. **blog/[slug] ArticleTOC** : ajouter avec `wordCount > 1500` conditionnel

### P1 — Sprint suivant

3. **alternateName** dans LocalBusiness.parentOrganization et Dataset.creator
4. **hasOfferCatalog** dans buildOrganizationJsonLd
5. **isBasedOn** passer au callsite blog (view.citations → isBasedOn)

### Will action

6. **Wikidata Q-ID** → +20 pts
7. **addressLocality** FR réelle → +7 pts Local SEO
8. **GSC service account** → env Coolify `GSC_SERVICE_ACCOUNT_JSON`
