# Sub-prompt : guide pilier

> ContentType `guide_pilier`. Long-form 3 000-5 000 mots. STOP & ASK Will sur outline avant gen finale (Q6 OUI).
>
> **Patch S0ter v2.5** : KB ingest type=`implementation_playbook` (V4 factory enum). Web Vitals gate strict (attention TBT long-form). Triple body Tiptap.
>
> **searchIntent imposé par défaut** : `informational` (cf. § 26 spec maître — guide pilier = intent éducatif par essence).
> **Post-process Q/R auto v1.7** : la FAQ générée déclenche 8-12 pages `/fr/faq/[slug]` (§ 29).
> **Éligible boucle qualité v1.7** : si score 40-74 → repassage automatique ciblé (§ 27). Particulièrement utile sur les guides longs où des sections peuvent être faibles.
> **Ancrage géographique** : `anchorVilleSlug` ou `anchorDepartementCode` requis (v1.7 systématique).

## Pipeline 2 étapes (Q6 = OUI)

### Étape 1 — Outline proposal

```
Pour le sujet : {{topic}}
Audience : {{audience}}  // debutant | intermediaire | avance
Word count cible : {{targetWordCount}}  // 3000-5000

Propose une outline de 8-15 sections H2 (avec H3 sous-sections si pertinent) en
exploitant la KB AxionIA + Perplexity data récente.

Pour chaque section :
- H2 (15-70 chars)
- 3-5 H3 sous-sections suggérées
- Word count estimé
- Sources KB top-3 (chunk IDs)
- 1 phrase de positionnement AxionIA

Format : JSON strict (Zod GuideOutlineSchema).

⚠️ STOP : envoie l'outline et ATTENDS approval Will avant Étape 2.
Auto-approve si pas de réponse sous 24 h.
```

### Étape 2 — Génération section par section

```
Outline validée :
{{outline_approved}}

Génère SECTION PAR SECTION (1 LLM call par H2, parallélisable jusqu'à 5 en //) :

Pour chaque section :
- bodyHtml ≥ 400 mots
- H3 sous-sections selon outline
- ≥ 1 lien interne vers autre section du guide
- ≥ 1 exemple concret AxionIA-centric
- 0 SIREN/SIRET/RCS, 0 mot interdit

À la fin : assemble + génère FAQ globale (8-12 items) + JSON-LD HowTo + Article.
```

## System prompt

```
{{include references/doctrine-axionia.md}}

Tu écris un GUIDE PILIER AxionIA (auteur Manon). Format complet :
- 1 H1 (60-80 chars)
- TL;DR exécutif (3-5 lignes) + Direct Answer 40-80 mots + Key Facts 5-7 + TOC 8-15 ancres
- 8-15 H2 (sections), chacune 400-800 mots
- H3 sous-sections quand justifié (jamais H4+)
- FAQ globale 8-12 items à la fin
- Byline Manon + author-card

JSON-LD attendus :
- HowTo + HowToStep × N (1 par H2)
- Article (BlogPosting variant)
- BreadcrumbList + FAQPage + Speakable
- Person Manon + Organization + WebPage

Word count total cible 3000-5000.
```

## Output Zod (Étape 1)

```ts
export const GuideOutlineSchema = z.object({
  proposedH1: z.string().min(40).max(80),
  estimatedWordCount: z.number().min(3000).max(5000),
  sections: z.array(z.object({
    h2: z.string().min(15).max(70),
    anchor: z.string(),
    estimatedWords: z.number().min(300).max(800),
    h3Subsections: z.array(z.string()).max(5).optional(),
    kbChunkIds: z.array(z.string()).max(3),
    positioningSentence: z.string(),
  })).min(8).max(15),
});
```

## Output Zod (Étape 2 — guide complet)

```ts
export const GuideOutputSchema = z.object({
  slug: z.string(),
  h1: z.string(),
  metaTitle: z.string().min(50).max(60),
  metaDescription: z.string().min(140).max(160),
  tldr: z.string(),
  directAnswer: z.string(),
  keyFacts: z.array(z.string()).min(5).max(7),
  toc: z.array(z.object({ anchor: z.string(), label: z.string() })).min(8).max(15),
  sections: z.array(z.object({
    h2: z.string(),
    anchor: z.string(),
    bodyHtml: z.string().min(400),
    h3Subsections: z.array(z.object({ h3: z.string(), bodyHtml: z.string() })).optional(),
  })),
  faq: z.array(z.object({ q: z.string(), a: z.string() })).min(8).max(12),
  jsonLdBlocks: z.array(z.record(z.unknown())).min(5),
});
```

## SLO

- p50 ≤ 180 s (avec parallélisme section), p95 ≤ 280 s
- Sans parallélisme : p50 ≤ 350 s
