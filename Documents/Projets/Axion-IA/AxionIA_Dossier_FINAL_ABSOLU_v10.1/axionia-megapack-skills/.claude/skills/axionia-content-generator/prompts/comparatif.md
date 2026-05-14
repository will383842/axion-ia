# Sub-prompt : comparatif

> ContentType `comparison`. 2-6 items à comparer.
>
> **Patch S0ter v2.5** : KB ingest type=`comparison` (V4 factory enum). Web Vitals gate strict (LCP/INP/CLS). Tableaux non-virtuels (pas de lib JS lourde). Triple body Tiptap.
>
> **searchIntent imposé par défaut** : `commercial_investigation` (cf. § 26 spec maître — comparatifs = intent commercial par essence). Override possible mais argumenté.
> **Post-process Q/R auto v1.7** : la FAQ générée déclenche 8 pages `/fr/faq/[slug]` (§ 29).
> **Éligible boucle qualité v1.7** : si score 40-74 → repassage automatique ciblé (§ 27).
> **Ancrage géographique** : `anchorVilleSlug` ou `anchorDepartementCode` requis (v1.7 systématique).

## System prompt

```
{{include references/doctrine-axionia.md}}

Tu rédiges un COMPARATIF AxionIA (auteur Manon). Format strict :
- 1 H1 « Comparatif : {ItemA} vs {ItemB} (vs {ItemC}) — Quel choix pour {audience} en 2026 ? »
- TL;DR (recommandation 1 ligne) + Direct Answer 40-80 mots
- Table de comparaison avec `<caption>` + `<th scope="col">` + 5-10 critères atomic
- 1 H2 par item (1 paragraphe Pros / 1 paragraphe Cons)
- 1 H2 final : « Verdict Axion-IA » (notre recommandation argumentée)
- FAQ 4-8 items
- Byline Manon + author-card

Data récente OBLIGATOIRE via Perplexity Sonar (pricing, features 2026).
Citations sources Perplexity en `Article.citation[]`.

CONTRAINTES :
- Ne JAMAIS dire « le meilleur » — toujours « selon {critère X} ».
- Si AxionIA est dans la comparaison : verdict honnête mais explicite. Pas auto-favoritisme caché.
- Pricing : utiliser `formatAmount()` SSOT — JAMAIS hardcoder.

JSON-LD attendus :
- Article + BreadcrumbList + FAQPage
- Items × N en `Product` ou `Service` (selon nature)
- Person Manon (@id) + Organization (@id) + WebPage
```

## User prompt

```
Génère un comparatif AxionIA.

Items à comparer (2-6) :
{{items}}  // [{ name, vendor, url?, pricing?, knownPros?, knownCons? }]

Type de comparatif : {{type}}  // outils-ia | service-axion | alternative-saas | build-vs-buy
Audience : {{audience}}
Taille entreprise cible : {{companySizes}}
Secteurs : {{sectors}}
Word count cible : {{targetWordCount | default: 2000}}

Note : Perplexity Sonar `search_recency_filter=year` pour pricing/features actualisés.
```

## Output Zod (sketch)

```ts
export const ComparisonOutputSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  type: z.enum(["outils-ia","service-axion","alternative-saas","build-vs-buy"]),
  h1: z.string().min(40).max(90),
  metaTitle: z.string().min(50).max(60),
  metaDescription: z.string().min(140).max(160),
  tldr: z.string(),
  directAnswer: z.string(),
  comparisonTable: z.object({
    caption: z.string(),
    criteria: z.array(z.string()).min(5).max(10),
    rows: z.array(z.object({
      itemName: z.string(),
      values: z.array(z.string()),
    })),
  }),
  items: z.array(z.object({
    name: z.string(),
    vendor: z.string(),
    url: z.string().url().optional(),
    pricing: z.string().optional(),
    pros: z.array(z.string()).min(2).max(6),
    cons: z.array(z.string()).min(2).max(6),
  })),
  verdict: z.string().min(200),
  faq: z.array(z.object({ q: z.string(), a: z.string() })).min(4).max(8),
  citations: z.array(z.object({ url: z.string().url(), title: z.string() })),
  jsonLdBlocks: z.array(z.record(z.unknown())).min(4),
});
```

## SLO

- p50 ≤ 60 s, p95 ≤ 100 s
