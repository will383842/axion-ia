# Sub-prompt: landing ville

> **SLO** : p50 ≤ 90 s bout-en-bout, p95 ≤ 150 s. Cache hit rate Anthropic ≥ 70 % en batch.
> **Word count cible** : 4 500-5 200 mots.
> Loaded by `src/server/content-gen/generators/landing-ville.ts` at runtime. Composes with `references/doctrine-axionia.md` + `references/manon-person.md` + KB top-K chunks. Variant injection via `ContentTemplate.variant` (cf. § 6.1bis master).

## System prompt (cacheable prefix Anthropic)

```
Tu es Manon, rédactrice et responsable éditoriale chez Axion-IA, cabinet IA opérationnel basé en Estonie (OÜ). Tu écris en français pour des dirigeants de TPE, PME, ETI et grandes entreprises françaises.

DOCTRINE INTOUCHABLE :
{{include references/doctrine-axionia.md}}

CONTEXTE AXIONIA (sources internes — utiliser en priorité) :
{{kb_chunks_top_8}}

DONNÉES INSEE OFFICIELLES (≤ 5 % du contenu — contexte géographique uniquement) :
{{insee_data_ville}}
{{insee_data_region}}

CONSIGNES STYLE :
- Sobre, technique-pragmatique, orienté ROI mesurable.
- 1ʳᵉ pers du pluriel discrète (« nous accompagnons »), jamais « je ».
- ≥ 95 % AxionIA-centric (méthodologie, paliers, cas concrets anonymisés, livrables).
- ≤ 5 % données INSEE (population, PIB, secteurs, communes voisines).
- Insère 1 opinion forte, 1 prédiction datée (« d'ici fin 2026… »), 1 chiffre interne (« sur N interventions menées en 2025… »), 1 paragraphe en 1ʳᵉ pers du pluriel discrète.
- Varie longueur des phrases (écart-type ≥ 8 mots). Évite listes systématiques 3 ou 5 items.
- Mots interdits : « unique », « le meilleur », « révolutionnaire », « SIREN », « SIRET », « RCS ».
- Tarifs : toujours en référence à `formatAmount()` SSOT (placeholder `{{prix:audit-flash:tpe}}` etc.).

STRUCTURE OBLIGATOIRE (10 sections H2 minimum) :
1. H1 + lede (30-50 mots, primary KW)
2. TL;DR encadré (2-4 lignes)
3. Direct Answer 40-80 mots (`<p data-aeo="answer">`)
4. Key Facts 3-7 bullets chiffrés
5. TOC auto-générée
6. Contexte économique {{ville.name}} (200-400 mots, ≤ 5 % INSEE)
7. Paliers entreprise et tarifs Axion-IA (table avec caption + th scope, 4 paliers INSEE)
8. Audit IA à {{ville.name}} — 3 niveaux (Flash / Ciblé / Stratégique)
9. Interventions formation à {{ville.name}} (référence taxonomy)
10. Implémentation custom à {{ville.name}}
11. Cas concret anonymisé secteur dominant
12. Méthodologie Axion-IA appliquée à {{ville.name}}
13. Communes voisines accompagnées (ItemList Haversine)
14. FAQ géolocalisée 6-12 Q/R (Speakable)
15. CTA final → /fr/reserver?source=ville-{{ville.slug}}

JSON-LD attendus (sortie séparée champ par champ) :
- WebPage + Speakable (TL;DR + Direct Answer)
- BreadcrumbList (Accueil > Implantations > {{Region}} > {{Ville}})
- Place ({{ville.name}}, geo lat/lng)
- LocalBusiness (Axion-IA, areaServed = {{ville.name}})
- Service × 3 (audit, interventions, implementation)
- FAQPage + Speakable
- ItemList (communes voisines)
- Organization (publisher, @id référence)
- Person (Manon, @id référence)

CONTRAINTES SORTIE :
- HTML semantic strict (cf. checklists/seo-aeo-60-items.md).
- 1 seul `<h1>`, 3-8 `<h2>`, `<h3>` enfants directs, 0 `<h5>+`.
- Tous éléments `<img>` avec width/height/alt.
- Tableaux avec `<caption>` + `<th scope="col">`.
- FAQ items en `<details>/<summary>` (progressive enhancement).
```

## User prompt (variable, non-cacheable)

```
Génère la landing page Axion-IA pour la ville de {{ville.name}} ({{ville.codeInsee}}) en {{region.name}}, dans le département {{departement.code}} {{departement.name}}.

Données ville :
- Population : {{ville.population}}
- Catégorie INSEE entreprise : {{auto_company_size_distribution}}
- Secteurs économiques dominants : {{auto_dominant_sectors}}
- Communes voisines (Haversine ≤ 30 km, ≥ 5K hab) : {{neighbouring_communes_top_8}}

Cible client : {{focus_company_size | default: "PME et ETI"}}
Angle stratégique : {{angle | default: "audit IA opérationnel + interventions formation"}}

Word count cible : 4 800-5 200 mots.

Format de sortie : JSON strict suivant le Zod schema fourni en output_schemas/landing-ville.schema.ts (champs : `slug`, `h1`, `lede`, `tldr`, `directAnswer`, `keyFacts[]`, `sections[]`, `faq[]`, `cta`, `heroAlt`, `image2Alt`, `metaTitle`, `metaDescription`, `jsonLdBlocks[]`, `heroImagePrompt`, `image2Prompt`).
```

## Output Zod schema (sketch)

```ts
import { z } from "zod";

export const LandingVilleOutputSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  h1: z.string().min(30).max(80),
  lede: z.string().min(80).max(250),
  tldr: z.string().min(80).max(300),
  directAnswer: z.string().refine(s => s.split(/\s+/).length >= 40 && s.split(/\s+/).length <= 80, "40-80 mots"),
  keyFacts: z.array(z.string()).min(3).max(7),
  sections: z.array(z.object({
    h2: z.string().min(15).max(70),
    anchor: z.string().regex(/^[a-z0-9-]+$/),
    bodyHtml: z.string().min(200),
    h3Subsections: z.array(z.object({
      h3: z.string(),
      bodyHtml: z.string(),
    })).optional(),
  })).min(10).max(15),
  faq: z.array(z.object({
    q: z.string().min(15).max(150),
    a: z.string().refine(s => s.split(/\s+/).length >= 30 && s.split(/\s+/).length <= 120, "30-120 mots"),
  })).min(6).max(12),
  cta: z.string(),
  heroAlt: z.string().min(20).max(150),
  image2Alt: z.string().min(20).max(150),
  metaTitle: z.string().min(50).max(60),
  metaDescription: z.string().min(140).max(160),
  jsonLdBlocks: z.array(z.record(z.unknown())).min(5), // au moins 5 schemas
  heroImagePrompt: z.string(),
  image2Prompt: z.string(),
});
```

## Generation pipeline (anti-waterfall § 9.11.1)

```ts
// Parallel T0
const [kbChunks, perplexityData, ssotPricing] = await Promise.all([
  kbClient.retrieve({ query: `${ville.name} ${region.name} audit IA`, language: "fr", k: 12, filters: { isAxionIaCanonical: true, regionSlug: region.slug }, boostCanonical: 0.15 }),
  shouldUsePerplexity(job, template, providerConfig) ? perplexity.search({ query: `Tissu économique entreprises ${ville.name} 2026`, recency: "year" }) : Promise.resolve(null),
  // SSOT déjà en mémoire process (preloaded au boot worker)
  Promise.resolve(loadPricingSSOT()),
]);

// T1 — streaming text gen with early image gen hooks
const textStream = openai.chat.completions.create({
  model: "gpt-4o",
  stream: true,
  messages: [
    { role: "system", content: composeSystemPrompt({ kbChunks, doctrine, perplexityData }), cache_control: { type: "ephemeral" } },
    { role: "user", content: composeUserPrompt({ ville, region, departement, angle }) },
  ],
  response_format: { type: "json_object" },
});

// Image gens triggered mid-stream
let imageJob1: Promise<ImageAsset> | null = null;
let imageJob2: Promise<ImageAsset> | null = null;
let h1Done = false;
let halfBodyDone = false;
let buffer = "";

for await (const chunk of textStream) {
  buffer += chunk.choices[0]?.delta?.content ?? "";
  if (!h1Done && buffer.includes('"h1"')) {
    h1Done = true;
    imageJob1 = imageGen({ prompt: extractHeroPromptFromBuffer(buffer), slot: "hero" });
  }
  if (!halfBodyDone && buffer.length > 8_000) {
    halfBodyDone = true;
    imageJob2 = imageGen({ prompt: extractImage2PromptFromBuffer(buffer), slot: "section" });
  }
}

const parsed = LandingVilleOutputSchema.parse(JSON.parse(buffer));
const [img1, img2] = await Promise.all([imageJob1, imageJob2]);

// T2 — validate quality (anti-plagiarism, doctrine, SEO score)
await runQualityGates(parsed, { ville, region });

// T3 — write file + revalidate
await publishVilleCopy(ville.slug, parsed, [img1, img2]);
await revalidatePath(`/fr/implantations/${region.slug}/${ville.slug}`);
```

## SLO target

- p50 ≤ 90 s bout-en-bout
- p95 ≤ 150 s
- Cache hit rate Anthropic ≥ 70 % en batch mode (system prompt + KB chunks réutilisés)
