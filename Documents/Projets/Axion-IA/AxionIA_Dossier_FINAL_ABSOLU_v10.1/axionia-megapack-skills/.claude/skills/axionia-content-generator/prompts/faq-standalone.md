# Sub-prompt : FAQ standalone

> ContentType `faq_standalone`. Insère 10-25 entrées Q/R thématiques en table `FAQ` (CRUD admin), regroupées par catégorie.
>
> **Patch S0ter v2.5** : KB ingest type=`faq` (legacy enum, conservé V4). Web Vitals gate strict. `<details>`/`<summary>` natifs (pas de JS accordion). Triple body Tiptap.
>
> **searchIntent imposé par défaut** : `informational` (cf. § 26 spec maître).
> **Post-process Q/R auto v1.7** : chaque Q/R créée par ce générateur déclenche aussi sa page indexable `/fr/faq/[slug]` (§ 29) avec enrichissement contextuel ≥ 300 mots.
> **Éligible boucle qualité v1.7** : si score 40-74 → repassage automatique ciblé (§ 27).
> **Ancrage géographique** : `anchorVilleSlug` ou `anchorDepartementCode` requis pour contextualiser les réponses (v1.7 systématique).

## System prompt

```
Tu génères 10-25 entrées FAQ pour la table FAQ AxionIA, regroupées par catégorie.

Catégorie : {{category}}  // general | interventions | implementation | audit | pricing | process
Topic : {{topic}}

Contraintes par entrée :
- question : 15-150 chars
- answer : 50-200 mots, autonome
- ≥ 1 chiffre concret par réponse quand pertinent (prix SSOT)
- 0 mot interdit

KB retrieve filtré par catégorie. Perplexity data si toggle ON pour chiffres récents.

Les entrées générées sont insérées en DB Prisma `FAQ` (status=draft) → Will review/publish via /admin/faq.
```

## User prompt

```
Génère 10-25 entrées FAQ AxionIA sur le topic : {{topic}}
Catégorie : {{category}}

Évite les doublons avec la FAQ existante (la liste te sera fournie en input pour dedup) :
{{existing_faq_questions}}
```

## Output Zod

```ts
export const FaqStandaloneOutputSchema = z.object({
  category: z.enum(["general","interventions","implementation","audit","pricing","process"]),
  topic: z.string(),
  entries: z.array(z.object({
    question_fr: z.string().min(15).max(150),
    answer_fr: z.string().refine(s => s.split(/\s+/).length >= 50 && s.split(/\s+/).length <= 200),
  })).min(10).max(25),
});
```

## SLO

- p50 ≤ 15 s, p95 ≤ 30 s
