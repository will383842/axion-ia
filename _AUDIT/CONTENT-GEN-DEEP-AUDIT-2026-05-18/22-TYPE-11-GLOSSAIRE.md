# 22 — TYPE 11 : Glossaire IA

> Score : 55/100 — Status : 🟠 PARTIEL (index OK, manque pages termes individuels)

---

## 1. Description simple (Will-readable)

Glossaire des termes IA opérationnels (LLM, RAG, fine-tuning, agents, MCP,
vectorisation, hallucination, prompt engineering, etc.). Cible AEO :
définitions courtes, citables par Perplexity / ChatGPT / Google AI Overviews.

**Constat au HEAD `9c1adaa`** :

- Page index `/fr/glossaire` (et `/en/glossary`) **existe** et affiche tous
  les termes sur une seule page, avec JSON-LD `DefinedTermSet`.
- Pages détail `/fr/glossaire/[slug]` **inexistantes** : impossible de
  partager une URL pointant un terme spécifique, impossible d'être l'URL
  cible d'une citation LLM granulaire.
- Data source : `getGlossaryTerms()` dans `src/lib/knowledge/readers.ts:54`
  → bascule DB (`KnowledgeEntry type=glossary_term`) si flag actif, sinon
  hardcode SSOT `GLOSSARY_TERMS_HARDCODE` (~12 termes).
- Pas de générateur LLM dédié, pas d'admin UI dédiée glossaire (admin
  passe par CRUD `KnowledgeEntry` générique si flag DB activé).

Verticale partiellement implémentée : l'index est propre, mais le maillage
SEO/AEO granulaire manque.

---

## 2. Diagramme Mermaid (flow complet)

```mermaid
flowchart TD
    A[Source 1 hardcode<br/>GLOSSARY_TERMS_HARDCODE<br/>src/lib/knowledge/legacy-mapping-glossary-hardcode.ts] --> R
    B[Source 2 DB<br/>KnowledgeEntry type=glossary_term] --> R{getGlossaryTerms reader}
    F[Feature flag<br/>KB_BACKEND_UNIFIED_GLOSSARY] --> R
    R --> P[Page /fr/glossaire/page.tsx<br/>Liste dl/dt/dd 12 termes]
    P --> JL[JSON-LD DefinedTermSet<br/>hasDefinedTerm array]
    P --> SM[Sitemap principal /sitemap.xml<br/>uniquement /glossaire index]

    GAP1[[GAP : page [slug] individuelle]] -.->|missing| P
    GAP2[[GAP : sub-sitemap knowledge-glossary.xml]] -.->|partial| SM
    GAP3[[GAP : admin UI dédiée]] -.->|missing| B
    GAP4[[GAP : mesh blog/KB/cas vers terme]] -.->|missing| P

    style GAP1 fill:#ff9999
    style GAP2 fill:#ffcc99
    style GAP3 fill:#ffcc99
    style GAP4 fill:#ff9999
```

---

## 3. Inputs / Outputs (fichier:ligne)

### Pages

| Route                                 | Statut                        | Fichier                                                                                        |
| ------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------- |
| `/fr/glossaire` (index)               | ✅ Existe                     | `src/app/[locale]/glossaire/page.tsx:40`                                                       |
| `/en/glossary` (index)                | ✅ Mapping configuré          | `src/app/[locale]/glossaire/page.tsx:33` (`alternates: { fr: "/glossaire", en: "/glossary" }`) |
| `/fr/glossaire/[slug]` (détail terme) | ❌ Inexistant — gap identifié | aucun                                                                                          |
| `/en/glossary/[slug]` (détail terme)  | ❌ Inexistant — gap identifié | aucun                                                                                          |

### Data sources

| Source                                        | Statut                                                                                                       | Fichier                                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Hardcode SSOT                                 | ✅ Existe                                                                                                    | `src/lib/knowledge/legacy-mapping-glossary-hardcode.ts` (exporte `GLOSSARY_TERMS_HARDCODE`) |
| DB Prisma `KnowledgeEntry type=glossary_term` | ✅ Modèle existe                                                                                             | `prisma/schema.prisma:486` (enum `KbType.glossary_term`)                                    |
| Feature flag bascule                          | ✅ Existe                                                                                                    | `src/lib/knowledge/feature-flag.ts` (`isKbBackendUnifiedFor("glossary_term")`)              |
| Reader unifié                                 | ✅ Existe                                                                                                    | `src/lib/knowledge/readers.ts:54` (`getGlossaryTerms()`)                                    |
| Hypothèse prompt `src/content/glossary.ts`    | ❌ Inexistant — déplacé vers `legacy-mapping-glossary-hardcode.ts` (cf. commentaire `glossaire/page.tsx:37`) |

### JSON-LD

| Élément                                  | Statut                           | Fichier:ligne                               |
| ---------------------------------------- | -------------------------------- | ------------------------------------------- |
| `DefinedTermSet` index                   | ✅ Implémenté                    | `src/app/[locale]/glossaire/page.tsx:52-64` |
| `hasDefinedTerm` items                   | ✅ Map sur `terms`               | `src/app/[locale]/glossaire/page.tsx:58`    |
| `inDefinedTermSet` back-ref              | ✅ Présent                       | `src/app/[locale]/glossaire/page.tsx:62`    |
| `DefinedTerm` standalone sur page détail | ❌ N/A (page détail inexistante) |

### Mesh

| Lien                           | Statut                                          |
| ------------------------------ | ----------------------------------------------- |
| CTA `/guide-ia`                | ✅ `src/app/[locale]/glossaire/page.tsx:107`    |
| CTA `/audit`                   | ✅ `src/app/[locale]/glossaire/page.tsx:111`    |
| Blog → terme glossaire         | ❌ Aucun lien interne automatique               |
| KB → terme glossaire           | ❌ Aucun lien interne automatique               |
| Cas concrets → terme glossaire | ❌ Aucun lien interne automatique               |
| Anchor `#term-slug` sur index  | ❌ Pas d'`id` sur `<dt>` → impossible deep-link |

---

## 4. Quality gates

| Gate                                     | Statut                              | Détail                                                             |
| ---------------------------------------- | ----------------------------------- | ------------------------------------------------------------------ |
| Lecture via reader (pas hardcode direct) | ✅                                  | `getGlossaryTerms()` abstrait DB vs hardcode                       |
| Hreflang FR↔EN                           | ✅                                  | `alternates: { fr, en }` ligne 33                                  |
| JSON-LD validation                       | ✅ partiel                          | `DefinedTermSet` structure OK, mais pas testé                      |
| Doctrine-check banned phrases            | `**UNKNOWN — requires fact-check**` | `Grep "glossary" src/server/content-gen/quality/doctrine-check.ts` |
| Isolation-check                          | `**UNKNOWN — requires fact-check**` | `Grep "glossaire" scripts/content-gen/isolation-check.ts`          |

---

## 5. Tests existants

| Test                                                  | Statut                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------- |
| `src/lib/knowledge/legacy-mapping-additional.test.ts` | ✅ Couvre mapping glossary hardcode (cf. Grep hit)                  |
| Test page `/glossaire` rendu                          | ❌ Inexistant                                                       |
| Test JSON-LD `DefinedTermSet` schema-valid            | ❌ Inexistant                                                       |
| Test `getGlossaryTerms()` reader (DB + hardcode)      | `**UNKNOWN — requires fact-check**` `Grep "getGlossaryTerms" test/` |
| Snapshot index FR + EN                                | ❌ Inexistant                                                       |

---

## 6. Tests manquants

- Snapshot DOM `/fr/glossaire` (12 termes minimum visibles)
- Snapshot JSON-LD `DefinedTermSet` valid schema.org
- Test E2E click sur terme → ouvre détail (à activer après page `[slug]`)
- Test bascule flag `KB_BACKEND_UNIFIED_GLOSSARY` retourne identique structure
- Test `dynamicParams = false` sur futur `[slug]/page.tsx` (anti-soft 404)
- Test mesh : `blog/[slug]` body contient `<a>` vers `/glossaire/llm` quand
  body mentionne "LLM" (futur middleware enrichissement)

Effort : ~3-4h pour la couverture complète.

---

## 7. Erreurs / edge cases

- **Pas de page détail** : un partage social du lien `/glossaire#llm` ne
  fonctionne pas (pas d'`id`). Une citation Perplexity vers terme spécifique
  n'a aucune URL cible granulaire. **Impact AEO/GEO : -30% citabilité** (estimation).
- **12 termes seulement** (`GLOSSARY_TERMS_HARDCODE` len ≈12) : très peu vs
  glossaires concurrents (DeepLearning.AI = 80+, Hugging Face = 100+).
  Cible recommandée : 60-80 termes IA opérationnels.
- **Pas de générateur LLM** : tout ajout = manuel (édition hardcode +
  commit), ou via admin générique `KnowledgeEntry` (si flag DB activé).
  Pas d'industrialisation possible.
- **`DefinedTerm.inDefinedTermSet`** valide mais incomplet : manque
  `subjectOf` (lien vers blog/KB), `sameAs` (Wikidata QID), `url`
  (deep-link). Cf. memory `axionia_image_bank_audit_autopilot_2026-05-16`
  pour pattern JSON-LD 2026 plafond.
- **Fallback `t.bodyText ?? stripHtml(t.body)`** dans
  `readers.ts:78` : peut produire descriptions vides si body HTML
  malformé. Pas de guard, pas de log Sentry.

---

## 8. Status global

**Score : 55/100 — 🟠 PARTIEL**

| Critère                          | Note  | Justification                                         |
| -------------------------------- | ----- | ----------------------------------------------------- |
| Page index existe                | 10/10 | `/glossaire` rendu correct + JSON-LD `DefinedTermSet` |
| Pages détail `[slug]`            | 0/20  | Inexistantes — gap principal                          |
| Volume termes                    | 4/15  | 12 termes vs cible 60+                                |
| Data source dual (DB + hardcode) | 10/10 | Reader unifié propre                                  |
| Hreflang FR↔EN                   | 5/5   | Configuré                                             |
| Sub-sitemap dédié                | 2/10  | Index dans sitemap principal, pas sub-sitemap dédié   |
| Mesh interne (entrant + sortant) | 4/10  | CTA OK, mais aucun lien entrant blog/KB/cas           |
| Tests                            | 5/10  | 1 test mapping hardcode, manque rendu + JSON-LD       |
| Admin UI dédiée                  | 5/5   | KnowledgeEntry générique couvre (si flag DB)          |
| Générateur LLM                   | 0/5   | Aucun, 100% manuel                                    |

**Verdict** : type viable en l'état pour visiteurs humains, mais
**handicap AEO/GEO majeur** par absence de pages détail individuelles
indexables. Sprint « Glossaire V2 » recommandé :

1. Créer `src/app/[locale]/glossaire/[slug]/page.tsx` (effort ~4h —
   pattern `centre-aide/[slug]` à dupliquer).
2. Étendre `GLOSSARY_TERMS_HARDCODE` à 60 termes (effort ~8h éditorial).
3. Ajouter `JSON-LD DefinedTerm` standalone par page détail + `subjectOf`
   liens blog/KB.
4. Middleware enrichissement body : remplace mention "LLM" → `<a href="/glossaire/llm">LLM</a>`
   (effort ~6h).
5. Sub-sitemap `knowledge-glossary.xml` dédié (effort ~2h).
6. Wikidata QID mapping pour `sameAs` (effort ~4h).

Total estimé : ~24h de dev + ~8h éditorial = ~32h pour glossaire 🟢 GREEN.

P1 (pas P0). Pas de bloquant business immédiat, mais ROI AEO/GEO élevé.

---

_Audit AUDIT-ONLY au HEAD `9c1adaa`. Aucune modification de code._
