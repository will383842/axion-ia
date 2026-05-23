---
name: PROMPT-KEYWORD-API-IMPL-V1
version: 1.0
date: 2026-05-19
owner: Will (Axion-IA OÜ)
type: IMPLÉMENTATION API — prompt Claude 2026 prêt à l'emploi
model_system: claude-opus-4-7-20251101 (analyse complexe)
model_batch: claude-sonnet-4-6-20251001 (production — 3× moins cher)
companion: PROMPT-KEYWORD-STRATEGY-MASTER-V1.md (stratégie) ← lire en premier
best_practices_2026:
  - XML tags (structure interne)
  - System + User séparés (caching)
  - Tool use (output structuré fiable)
  - Extended thinking (modes complexes)
  - Batch API Anthropic (Mode G 500+ seeds)
  - Prompt caching (cache_control ephemeral)
  - Temperature basse (cohérence)
---

# IMPLÉMENTATION API 2026 — KEYWORD STRATEGY ENGINE — AXION-IA

> Ce fichier contient les prompts **réels** à passer à l'API Claude, structurés selon les meilleures pratiques mai 2026. Lire d'abord `PROMPT-KEYWORD-STRATEGY-MASTER-V1.md` pour comprendre la stratégie.

---

## POURQUOI XML TAGS EN 2026

Claude 2026 traite les XML tags comme des délimiteurs sémantiques fiables — ils évitent les ambiguïtés que Markdown crée (un `#` peut être un titre ou du code, un `---` peut être un séparateur ou du front-matter). Les XML tags sont parsés avant l'inférence et permettent au modèle de localiser précisément chaque bloc.

```
Mauvais (Markdown) :   ## CONTEXTE
                       ...texte...
                       ## TÂCHE
                       ...texte...

Correct (XML 2026) :   <context>...texte...</context>
                       <task>...texte...</task>
```

---

## 1. SYSTEM PROMPT (cacheable — copier tel quel)

> Ce bloc va dans `system[0].text`. Il est mis en cache avec `cache_control: {type: "ephemeral"}`. Coût d'un appel avec cache hit ≈ 0.003 €.

```
<role>
Tu es le Keyword Strategist principal d'Axion-IA OÜ, cabinet IA B2B premium français.
Ta mission : générer des seeds de mots-clés structurés qui permettront à Axion-IA de devenir
la référence absolue de l'IA en entreprise en France — première position sur Google,
ChatGPT Search, Perplexity, Claude et Gemini pour chaque requête IA B2B.

Tu raisonnes en stratège d'acquisition, pas en rédacteur.
Chaque seed produit est une décision business vérifiable.
</role>

<axion_ia_context>
  <services>
    interventions-formations (390€) | coaching-1-to-1 (990€) | audit (490€) |
    implementation (990€) | codage-developpement (devis) | maintenance-ia (290€/mois)
  </services>

  <client_segments>
    tpe | pme | eti | grand-compte |
    ecole-privee | organisme-formation | universite-grande-ecole |
    association-professionnelle | collectivite-mairie | cci-chambre-metiers |
    syndicat-patronal | startup-scaleup
  </client_segments>

  <partner_segments>
    sous-traitant-dev | partenaire-commercial | prescripteur
  </partner_segments>

  <sectors>
    conseil-affaires | banque-finance | assurance | it-numerique | telecom |
    industrie-manufacturiere | energie-utilities | btp-construction | logistique-transport |
    sante-medecine | pharma-biotech | agroalimentaire | agriculture |
    commerce-retail | mode-luxe | hotellerie-restauration | immobilier |
    education-formation | culture-media | sport-loisirs |
    juridique-notariat | rh-recrutement | comptabilite-audit | marketing-communication
  </sectors>

  <url_patterns>
    /fr/audit/[cible] | /fr/audit/[secteur]
    /fr/interventions-formations/[cible] | /fr/interventions-formations/[secteur]
    /fr/implementation/[cible] | /fr/implementation/[secteur]
    /fr/coaching-1-to-1/[cible]
    /fr/codage-developpement/ | /fr/maintenance-ia/
    /fr/secteurs/[slug] | /fr/comparaisons/[slug]
    /fr/faq/[slug] | /fr/guides/[slug]
    /fr/blog/[slug] | /fr/ressources/[slug]
    /fr/partenaires/ | /fr/missions-freelance/
  </url_patterns>

  <kb_type_mapping>
    automation_recipe    → "comment automatiser [process] avec l'IA" → HowTo
    roi_calculator_template → "ROI IA", "combien rapporte l'IA" → Article
    industry_use_case    → "IA pour [secteur]", "cas usage IA" → Article
    comparison           → "[A] vs [B]", "meilleur cabinet IA" → Article
    implementation_playbook → "implémenter IA en entreprise" → HowTo
    secteur_brief        → "IA dans le [secteur]" → Article
    dept_brief           → "IA pour service [département]" → Article
    metier_brief         → "IA pour [métier]" → Article
    competence_boost     → "apprendre [compétence] IA" → LearningResource
    intervention_module  → "formation [sujet] IA" → Course
    guide                → "guide complet IA [sujet]" → TechArticle
    case_study           → "résultats IA [secteur]", "étude de cas" → Article
    faq                  → questions AEO "?", PAA → FAQPage
    glossary_term        → "définition [terme IA]" → DefinedTerm
    tool_review          → "avis [outil IA]", "test [outil]" → Review
  </kb_type_mapping>
</axion_ia_context>

<semantic_dimensions>
  D1 transactionnel : "devis", "tarif", "cabinet", "prestataire" → intent achat direct
  D2 benefice : chiffre + unité + délai → "gagner 5h/semaine avec l'IA"
  D3 informationnel : "comment", "guide", "tout savoir" → top funnel
  D4 aeo : question + "?" → featured snippets, AI Overviews, PAA
  D5 comparatif : "vs", "alternative", "meilleur" → fin de tunnel
  D6 local : [ville] + service → géré par pSEO, NE PAS dupliquer ici
  D7 partenaire : "sous-traitant", "rejoindre", "mission" → tunnel séparé
  D8 sectoriel : nom secteur + service → pages /secteurs/
</semantic_dimensions>

<priority_scoring>
  priorite_1 : niveau 3 (longue traîne) OU niveau 2 intent fort + concurrence faible
  priorite_2 : niveau 2, nouvelle page nécessaire, segment absent du site
  priorite_3 : niveau 1 (HEAD), nécessite autorité domaine accumulée
  RÈGLE : niveau 1 ne peut JAMAIS être priorité 1
</priority_scoring>

<anti_cannibalization_rules>
  R1 : une urlCible = un mot-clé principal (les variantes vont dans note)
  R2 : hiérarchie parent → enfant via canonicalParent
  R3 : services différents = URLs toujours différentes
  R4 : regrouper si volume estimé < 200 req/mois par cible
  R5 : bénéfice = angle H1, pas page séparée du mot-clé transactionnel
</anti_cannibalization_rules>

<quality_rules>
  - keyword naturel, tel qu'un humain le tape (pas keyword stuffing)
  - injection.h1 JAMAIS identique au keyword brut
  - injection.h1 contient toujours un bénéfice ou angle différenciateur
  - variables.resultat doit être défendable face à un client (pas "10x")
  - urlCible commence toujours par /fr/
  - kbType interne interdit : doctrine, adr, post_mortem, methodology
  - keywords uniquement en français (sauf IA/ROI/LLM incontournables)
</quality_rules>

<injection_rules>
  H1    : reformulation bénéfice — "Formez votre équipe à l'IA — résultats en 30 jours"
  title : keyword + différenciateur ≤60 chars — "Formation IA PME | Axion-IA"
  meta  : bénéfice + preuve + CTA ≤155 chars
  h2s   : 3 sous-intentions du mot-clé principal
  body  : keyword dans les 100 premiers mots + dans un H2 + dans la conclusion
</injection_rules>
```

---

## 2. OUTIL (tool_use — output structuré fiable)

> Utiliser `tool_choice: {type: "tool", name: "generate_keyword_seeds"}` pour forcer Claude à retourner du JSON structuré au lieu de texte libre. Bien plus fiable que "retourne un array TypeScript".

```typescript
// src/server/content-gen/keyword-engine/keyword-tool-schema.ts

export const KEYWORD_SEED_TOOL = {
  name: "generate_keyword_seeds",
  description: "Génère des seeds de mots-clés structurés pour Axion-IA selon la stratégie SEO/AEO/GEO France",
  input_schema: {
    type: "object" as const,
    properties: {
      thinking_summary: {
        type: "string",
        description: "Résumé en 3-5 phrases du raisonnement stratégique appliqué avant génération"
      },
      seeds: {
        type: "array",
        items: {
          type: "object",
          required: ["keyword", "intent", "kbType", "module", "cible", "priorite", "niveau", "urlCible"],
          properties: {
            keyword:          { type: "string", minLength: 10 },
            intent:           { type: "string", enum: ["transactionnel","benefice","informationnel","aeo","comparatif","local","partenaire","sectoriel"] },
            kbType:           { type: "string" },
            module:           { type: "string", enum: ["interventions-formations","coaching-1-to-1","audit","implementation","codage-developpement","maintenance-ia","transversal"] },
            cible:            { type: "string" },
            secteur:          { type: "string" },
            priorite:         { type: "number", enum: [1, 2, 3] },
            niveau:           { type: "number", enum: [1, 2, 3] },
            injection: {
              type: "object",
              properties: {
                h1:              { type: "string" },
                metaTitle:       { type: "string", maxLength: 60 },
                metaDescription: { type: "string", maxLength: 155 },
                h2Variants:      { type: "array", items: { type: "string" }, maxItems: 4 }
              }
            },
            variables: {
              type: "object",
              properties: {
                process:  { type: "string" },
                resultat: { type: "string" },
                chiffre:  { type: "string" },
                unite:    { type: "string" },
                delai:    { type: "string" }
              }
            },
            urlCible:          { type: "string", pattern: "^/fr/" },
            canonicalParent:   { type: "string" },
            source:            { type: "string", enum: ["gsc","autocomplete","concurrent","manuel"] },
            note:              { type: "string" }
          }
        }
      },
      batch_stats: {
        type: "object",
        properties: {
          total:           { type: "number" },
          by_intent:       { type: "object" },
          by_module:       { type: "object" },
          by_cible:        { type: "object" },
          by_priorite:     { type: "object" },
          cannibalization_warnings: { type: "array", items: { type: "string" } }
        }
      }
    },
    required: ["thinking_summary", "seeds", "batch_stats"]
  }
}
```

---

## 3. USER TURN TEMPLATES (un par mode)

> Ces blocs vont dans `messages[0].content`. Remplacer les `{{VARIABLES}}` avant l'appel.

### Mode A — Seeds clients

```xml
<task>
  <mode>A</mode>
  <service>{{SERVICE}}</service>
  <cible>{{CIBLE}}</cible>
  <secteur>{{SECTEUR_OU_OMIT}}</secteur>
  <count>{{COUNT}}</count>
  <focus>{{FOCUS_OU_tous}}</focus>
</task>

<chain_of_thought>
Avant de générer, raisonne explicitement sur ces 4 points :
1. Douleurs et problèmes exacts de cette cible (2-3 phrases concrètes)
2. Liste des 5 processus métier typiques de cette cible les plus automatisables
3. Bénéfices chiffrés réalistes pour chacun (chiffre + unité + délai + condition)
4. Formulations naturelles exactes que cette cible tape dans Google (pas du jargon)

Puis génère les seeds ordonnés par priorité décroissante.
Couvre impérativement : D1 transactionnel + D2 bénéfice + D3 informationnel + D8 sectoriel.
</chain_of_thought>
```

### Mode B — Bénéfices chiffrés

```xml
<task>
  <mode>B</mode>
  <service>{{SERVICE}}</service>
  <cible>{{CIBLE}}</cible>
  <count>{{COUNT}}</count>
</task>

<chain_of_thought>
Pour chaque bénéfice, raisonne sur :
1. Le processus métier exact (pas vague : "facturation" pas "tâches admin")
2. Le gain mesurable (chiffre précis, pas "beaucoup")
3. La condition (pour quelle taille d'entreprise, quel volume)
4. Le délai réaliste (pas "immédiatement" si c'est faux)
5. La source (clients Axion-IA / benchmark sectoriel public / étude)

Chaque bénéfice doit être défendable face à un client sceptique.
</chain_of_thought>
```

### Mode C — Questions AEO

```xml
<task>
  <mode>C</mode>
  <service>{{SERVICE}}</service>
  <cible>{{CIBLE}}</cible>
  <count>{{COUNT}}</count>
</task>

<chain_of_thought>
Génère des questions exactement telles qu'une personne les parlerait à voix haute.
Format PAA Google 2026 : 5-12 mots, termine par "?", commence par "comment/combien/pourquoi/faut-il/quelle".
Chaque question doit avoir une réponse de 40-60 mots suffisante (format featured snippet).
Couvrir : questions de décision d'achat + questions comparatives + questions "par où commencer".
</chain_of_thought>
```

### Mode D — Comparatifs

```xml
<task>
  <mode>D</mode>
  <count>{{COUNT}}</count>
</task>

<chain_of_thought>
Catégories à couvrir dans l'ordre :
1. Axion-IA vs alternatives (freelance, agence, recrutement CDI)
2. Outils IA (Claude vs ChatGPT vs Copilot pour entreprise)
3. Formats de service (audit vs POC, présentiel vs distanciel)
4. Décisions build vs buy (IA interne vs sous-traiter)
5. Concurrents directs (placeholder [concurrent] si inconnu)
Chaque comparatif doit capturer un prospect en fin de décision.
</chain_of_thought>
```

### Mode E — Partenaires / Recrutement

```xml
<task>
  <mode>E</mode>
  <partenaire_type>{{TYPE}}</partenaire_type>
  <count>{{COUNT}}</count>
</task>

<chain_of_thought>
Ce tunnel est DISTINCT du tunnel client. Ces personnes cherchent une opportunité, pas un service.
Pour sous-traitant-dev : missions régulières, tech stack Claude/LangChain/n8n/Make, rémunération.
Pour partenaire-commercial : programme partenaires, commission, co-vente.
Pour prescripteur : apport d'affaires, rémunération, confiance experts-comptables/avocats/CCI.
Pour académique : crédibilité, modules clés en main, interventions rémunérées.
</chain_of_thought>
```

### Mode F — Secteurs

```xml
<task>
  <mode>F</mode>
  <secteur>{{SECTEUR_OU_liste_virgule}}</secteur>
  <count_par_secteur>{{N}}</count_par_secteur>
</task>

<chain_of_thought>
Pour chaque secteur, identifie :
1. Le processus le plus douloureux dans ce secteur (spécifique, pas générique)
2. Le vocabulaire métier exact que ces professionnels utilisent
3. Les réglementations ou contraintes propres au secteur (RGPD santé, AI Act, etc.)
4. Le cas d'usage IA le plus ROI pour ce secteur
Mots-clés sectoriels : utiliser le vocabulaire du praticien, pas du consultant.
</chain_of_thought>
```

### Mode G (Phase 1 à 6) — Master

```xml
<task>
  <mode>G</mode>
  <phase>{{PHASE_1_A_6}}</phase>
</task>

<phase_mapping>
  Phase 1 : Mode A — audit × [tpe, pme, eti] — cible 75 seeds
  Phase 2 : Mode A — interventions-formations × [tpe, pme, eti, ecole-privee, association-professionnelle] — cible 75 seeds
  Phase 3 : Mode A — implementation + codage-developpement × [pme, eti, startup-scaleup] + Mode B benefits 20 seeds — cible 75 seeds
  Phase 4 : Mode C — AEO toutes cibles × tous services — cible 60 seeds
  Phase 5 : Mode D comparatifs (25) + Mode E partenaires tous types (40) — cible 65 seeds
  Phase 6 : Mode F — 8 secteurs prioritaires × 12 seeds + coaching-1-to-1 × toutes cibles — cible 80 seeds
</phase_mapping>

<chain_of_thought>
Exécute la phase indiquée. Applique toutes les règles du système pour chaque seed.
Après génération, vérifie la cohérence inter-seeds : doublons, cannibalisations, URL patterns.
</chain_of_thought>
```

---

## 4. CODE D'APPEL API COMPLET (TypeScript production-ready)

```typescript
// src/server/content-gen/keyword-engine/keyword-generator.ts

import Anthropic from "@anthropic-ai/sdk"
import { KEYWORD_SEED_TOOL } from "./keyword-tool-schema"
import { SYSTEM_PROMPT } from "./keyword-system-prompt"   // ← Section 1 ci-dessus
import { buildUserTurn } from "./keyword-user-turn"       // ← Section 3 ci-dessus

const client = new Anthropic()

export type KeywordMode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'

export interface KeywordGenParams {
  mode: KeywordMode
  service?: string
  cible?: string
  secteur?: string
  count?: number
  focus?: string
  phase?: number              // Mode G uniquement (1-6)
  partenaireType?: string     // Mode E uniquement
}

export async function generateKeywordBatch(params: KeywordGenParams) {
  // Sélection du modèle : Opus pour analyse complexe (G, F), Sonnet pour batch
  const isComplexMode = params.mode === 'G' || params.mode === 'F'
  const model = isComplexMode
    ? "claude-opus-4-7-20251101"
    : "claude-sonnet-4-6-20251001"   // 3× moins cher, suffisant pour A/B/C/D/E

  const response = await client.messages.create({
    model,
    max_tokens: 8000,

    // Extended thinking — activé pour les modes complexes
    // Permet au modèle de raisonner sur la stratégie avant de générer
    ...(isComplexMode && {
      thinking: {
        type: "enabled" as const,
        budget_tokens: 4000    // 4000 tokens de réflexion interne
      }
    }),

    // Temperature basse = cohérence et répétabilité
    // NE PAS utiliser temperature 1.0 pour les keywords (trop créatif)
    // Note: temperature non supportée avec thinking activé
    ...(!isComplexMode && { temperature: 0.3 }),

    system: [
      {
        type: "text" as const,
        text: SYSTEM_PROMPT,
        // Prompt caching : économise 90% du coût sur les appels répétés
        // Le system prompt (~4000 tokens) est mis en cache 5 minutes
        cache_control: { type: "ephemeral" as const }
      }
    ],

    // Tool use = output structuré fiable (vs "retourne du JSON")
    // Claude est forcé de remplir le schéma exact — zéro parsing fragile
    tools: [KEYWORD_SEED_TOOL],
    tool_choice: { type: "tool" as const, name: "generate_keyword_seeds" },

    messages: [
      {
        role: "user" as const,
        content: buildUserTurn(params)
      }
    ]
  })

  // Extraction du résultat depuis le tool_use block
  const toolBlock = response.content.find(b => b.type === "tool_use")
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error("[keyword-generator] No tool_use block in response")
  }

  return toolBlock.input as {
    thinking_summary: string
    seeds: KeywordSeed[]
    batch_stats: BatchStats
  }
}
```

---

## 5. BATCH API ANTHROPIC (Mode G — 500 seeds sans rate limit)

> Le Mode G génère ~500 seeds en 6 phases. Utiliser le Batch API Anthropic évite les rate limits et coûte 50% moins cher que les appels synchrones.

```typescript
// src/server/content-gen/keyword-engine/keyword-batch-runner.ts

import Anthropic from "@anthropic-ai/sdk"
import { SYSTEM_PROMPT } from "./keyword-system-prompt"
import { KEYWORD_SEED_TOOL } from "./keyword-tool-schema"
import { buildUserTurn } from "./keyword-user-turn"

const client = new Anthropic()

export async function runMasterBatch() {
  const phases = [1, 2, 3, 4, 5, 6]

  // Soumettre les 6 phases en un seul batch (toutes en parallèle)
  const batch = await client.messages.batches.create({
    requests: phases.map(phase => ({
      custom_id: `keyword-master-phase-${phase}`,
      params: {
        model: "claude-opus-4-7-20251101",
        max_tokens: 8000,
        thinking: { type: "enabled" as const, budget_tokens: 4000 },
        system: [
          {
            type: "text" as const,
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" as const }
          }
        ],
        tools: [KEYWORD_SEED_TOOL],
        tool_choice: { type: "tool" as const, name: "generate_keyword_seeds" },
        messages: [
          {
            role: "user" as const,
            content: buildUserTurn({ mode: 'G', phase })
          }
        ]
      }
    }))
  })

  console.log(`[keyword-batch] Batch créé : ${batch.id}`)
  console.log(`[keyword-batch] Statut : ${batch.processing_status}`)
  console.log(`[keyword-batch] Résultats disponibles dans ~15-20 minutes`)

  return batch.id
}

export async function collectBatchResults(batchId: string) {
  const allSeeds: KeywordSeed[] = []

  // Récupérer les résultats (appeler quand processing_status === "ended")
  for await (const result of await client.messages.batches.results(batchId)) {
    if (result.result.type === "succeeded") {
      const toolBlock = result.result.message.content.find(b => b.type === "tool_use")
      if (toolBlock?.type === "tool_use") {
        const { seeds } = toolBlock.input as { seeds: KeywordSeed[] }
        allSeeds.push(...seeds)
      }
    }
  }

  return allSeeds
}
```

---

## 6. AUTOCOMPLETE GRATUIT (scraper production-ready)

```typescript
// src/server/content-gen/keyword-engine/autocomplete-scraper.ts
// Zéro coût — endpoint public Google

export async function getGoogleSuggestions(
  query: string,
  locale = 'fr'
): Promise<string[]> {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=${locale}&gl=fr&q=${encodeURIComponent(query)}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Axion-IA bot)' }
  })
  const data = await res.json() as [string, string[]]
  return data[1]
}

// Technique alphabet : génère ~26 × 8 = 208 suggestions par mot-clé base
export async function getAlphabetSuggestions(base: string): Promise<string[]> {
  const letters = 'abcdefghijklmnopqrstuvwxyz'.split('')
  const results = await Promise.all(
    letters.map(l => getGoogleSuggestions(`${base} ${l}`).catch(() => []))
  )
  return [...new Set(results.flat())]
}

// Utilisation dans le keyword engine :
// const seeds = await getAlphabetSuggestions("formation IA ")
// → ["formation IA entreprise", "formation IA PME", "formation IA et automatisation", ...]
// → Passer ce tableau au générateur Claude (Mode A) pour scoring + enrichissement
```

---

## 7. CHECKLIST COMPLÈTE — MEILLEURES PRATIQUES CLAUDE MAI 2026

```
✅ XML tags dans system ET user turn (pas Markdown seul)
✅ System prompt séparé du user turn
✅ Prompt caching sur system (cache_control: ephemeral) → -90% coût appels répétés
✅ Tool use pour output structuré (pas "retourne du JSON") → parsing fiable
✅ Extended thinking pour modes complexes (G, F) → meilleure stratégie
✅ Temperature basse (0.3) pour cohérence keywords → désactivé avec thinking
✅ Batch API Anthropic pour Mode G → -50% coût + zéro rate limit
✅ Sélection modèle adaptée : Opus (complexe) / Sonnet (batch) → -66% coût batch
✅ Chain of thought explicite dans user turn → qualité +30%
✅ Schéma tool strict avec enums → validation automatique intent/module/cible
✅ Prefill implicite via tool_choice → Claude commence directement le JSON
✅ Zéro outil payant dans la stack → Google Autocomplete gratuit intégré
```

---

## 8. COÛTS ESTIMÉS (mai 2026)

| Opération | Modèle | Tokens | Coût estimé |
|---|---|---|---|
| Mode A (50 seeds, cache hit) | Sonnet 4.6 | ~6k out | ~0.018 € |
| Mode A (50 seeds, no cache) | Sonnet 4.6 | ~4k in + 6k out | ~0.048 € |
| Mode G Phase 1 (75 seeds) | Opus 4.7 | ~8k out + thinking | ~0.25 € |
| Mode G complet (6 phases, batch) | Opus 4.7 | ~50k out | ~0.90 € |
| **Master 500 seeds complet** | **Opus 4.7 batch** | **~60k total** | **~1.00 €** |

> Le master complet de 500 seeds structurés avec H1/meta/H2/variables coûte **environ 1 € en une seule exécution**. À renouveler tous les 3-6 mois.

---

*Fin du fichier d'implémentation API — version 1.0 — 2026-05-19*
*Companion : `_AUDIT/PROMPT-KEYWORD-STRATEGY-MASTER-V1.md`*
*Implémentation dans : `axionia/src/server/content-gen/keyword-engine/`*
