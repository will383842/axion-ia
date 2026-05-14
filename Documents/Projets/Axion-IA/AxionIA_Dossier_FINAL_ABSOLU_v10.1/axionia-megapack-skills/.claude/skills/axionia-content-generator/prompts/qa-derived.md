# Sub-prompt : Q/R dérivée (post-process automatique v1.7)

> ContentType `qa_derived`. **Hook automatique post-process** (§ 29 spec maître) déclenché après complétion d'un job landing/blog/comparatif/guide/faq-standalone.
>
> **Patch S0ter v2.5** : KB ingest type=`faq` (KB V4). ≥ 300 mots anti-thin garanti. Web Vitals gate strict. Triple body Tiptap.
>
> **Décision Will révisée v1.7 (modèle hybride)** :
> - Les 8 Q/R sont d'abord **groupées en FAQ embed** dans l'article parent (Speakable JSON-LD)
> - **ET CHAQUE Q/R devient automatiquement une page indexable `/fr/faq/[slug]`** (≥ 300 mots anti-thin via enrichissement contextuel)
>
> Ce sub-prompt couvre l'extraction Q/R + l'enrichissement contextuel pour les pages individuelles. La FAQ embed est déjà générée par le sub-prompt du contenu parent — ce sub-prompt ne la re-génère pas, il la **récupère** + l'enrichit.
>
> Coût LLM quasi-nul (extraction de sortie LLM existante + 1 mini-call enrichissement).

## System prompt

```
Tu extrais 8-12 Q/R atomiques depuis le contenu source AxionIA fourni.

Contraintes :
- Question : 8-15 mots, formulée comme une vraie question utilisateur (« Comment… ? », « Combien… ? », « Pourquoi… ? », « Quel… ? »)
- Réponse : 30-100 mots, autonome (compréhensible sans contexte article)
- ≥ 1 chiffre concret par réponse quand possible (prix SSOT, durée, %, etc.)
- 0 mot interdit (cf. doctrine)
- Diversifier types question : how (3-4), what (2-3), why (1-2), when (1), how-much (1), should-i (1)

Sortie : JSON strict.
```

## User prompt

```
Source : {{sourceArticleId | sourceGuideId}}
Titre source : {{source.h1}}
Contenu source (markdown) :
{{source.bodyMd}}

Génère 8-12 Q/R atomiques pour enrichir la FAQ embed de cet article.
Les Q/R seront stockées dans `Article.faqJson` et émises en `FAQPage` Speakable JSON-LD.
```

## Output Zod

```ts
export const QaDerivedOutputSchema = z.object({
  sourceId: z.string(),
  qaItems: z.array(z.object({
    q: z.string().min(15).max(150),
    a: z.string().refine(s => s.split(/\s+/).length >= 30 && s.split(/\s+/).length <= 100),
    type: z.enum(["how","what","why","when","how-much","should-i","other"]),
  })).min(8).max(12),
});
```

## Pipeline d'enrichissement (post-process auto v1.7)

```
1. Récupère la FAQ embed du contenu parent (déjà générée — pas de nouvel appel LLM principal)
2. Pour chaque Q/R (8 items typiquement) :
   a. Génère slug stable : kebab-case(question), tronqué 80 chars
   b. Recherche 4-6 Q/R similaires (cosine embedding dans table FAQ existante)
   c. Construit bloc contextuel auto :
      - 3 phrases : « Cette question fait partie de l'article [titre parent] sur [topic] à [ville]. Profil cible : [audience]. »
      - Lien fort CTA vers article parent
      - 4-6 Q/R similaires listées en bas
   d. Assemble page Q/R complète ≥ 300 mots
   e. Insère row table FAQ étendue (slug, parentArticleId, enrichmentContext JSON, indexationTier=tier_2_noindex_follow par défaut)
   f. Émet JSON-LD QAPage + Question + Answer + Speakable + BreadcrumbList + Person Manon
3. revalidatePath('/fr/faq/[slug]') + update sitemap-faq.xml
```

## Output Zod (post-process)

```ts
export const QaPostProcessOutputSchema = z.object({
  sourceJobId: z.string(),
  qaItems: z.array(z.object({
    q: z.string().min(15).max(150),
    a: z.string().refine(s => s.split(/\s+/).length >= 30 && s.split(/\s+/).length <= 100),
    slug: z.string().regex(/^[a-z0-9-]+$/).max(80),
    enrichmentContext: z.object({
      topic: z.string(),
      villeSlug: z.string().optional(),
      audienceLabel: z.string().optional(),
      parentTitle: z.string(),
      parentSlug: z.string(),
      similarQaIds: z.array(z.string()).max(6),
    }),
    totalWordCount: z.number().min(300),  // anti-thin gate
  })).min(6).max(12),
});
```

## SLO

- Extraction + enrichissement post-process : p50 ≤ 12 s, p95 ≤ 25 s pour 8 Q/R
- Coût LLM : ~$0.01-0.02 par Q/R enrichie (mini-call enrichment seulement)
