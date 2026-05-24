# SPRINT EXTERNAL LINKS DATABASE — Base ~2400 liens externes one-shot Perplexity
## AxionIA Content-Gen — Sources d'autorité vérifiées pour injection automatique dans tous les contenus

**Date création** : 2026-05-22
**Type** : Sprint one-shot (rempli 1 fois puis utilisé tel quel forever, re-run annuel optionnel)
**Mode** : IMPLEMENTATION (commits incrémentaux + push autorisés)
**Effort estimé** : 25-30h autopilot
**Coût Perplexity one-shot** : ~$12 (≈ 2400 queries × $0.005)
**Demandé par Will explicitement le 2026-05-22** : "il faudrait 2000 liens externes voir plus" + "Option C top 200 villes"

---

## 0. MISSION

Créer une **base centralisée de ~2400 liens externes vérifiés** organisés par scope (national/régional/local/international), par verticale, par topic — pour **injection automatique** dans tous les articles générés. Source d'autorité réelle, anti-hallucination IA, co-citation autorité Google E-E-A-T.

**Approche** :
1. **One-shot generation** : script Perplexity + Claude rempli `master.ts` une fois
2. **Vérification HEAD** : tous les liens vérifiés 200 OK avant commit final
3. **Utilisation continue** : helpers `selectExternalLinks()` lisent ce fichier statique (zéro appel API runtime)
4. **Maintenance ultra-légère** : worker HEAD monthly détecte les 404, alerte admin

**Repartition cible des ~2400 liens (Option C validée Will)** :

| Catégorie | Liens | Source |
|---|---|---|
| Villes top 200 (Tier 1 + Tier 2) | ~200 | 1 lien mairie OU CCI par ville |
| Régions FR (13) | ~130 | 10/région : conseil régional + agence dev éco + observatoire + CCI régionale + pôle compétitivité |
| National FR général | ~200 | INSEE, DARES, BPI, France Compétences, France Travail, France Num, CNIL, ANSSI, AFNOR, EU AI Act, EUR-Lex, ministères, ... |
| Verticale Audits | ~80 | ANSSI, CNIL, AFNOR, ISO/IEC, NIST AI, audits frameworks |
| Verticale Formations | ~80 | DARES, France Compétences, OPCO ×11, France Travail, Cnam, Cegos, Demos, OpenClassrooms, etc. |
| Verticale 1-to-1 | ~60 | McKinsey, BCG, Bain, HBR, MIT Sloan, Stanford GSB, INSEAD |
| Verticale Implementations | ~80 | Gartner, Forrester, McKinsey State of AI, IDC, Capgemini Research |
| Verticale Sites Web Augmentés | ~80 | DataReportal, HubSpot, SEMrush, BrightEdge, Google Search Central |
| Topics IA transversaux | ~150 | Stanford AI Index, MIT Tech Review, AI Index, OpenAI papers, Anthropic research, DeepMind |
| Presse FR top | ~50 | JDN, Frenchweb, Maddyness, Numerama, Les Échos Tech, BFM Business, Usine Digitale |
| International | ~50 | EU Commission, OECD AI, World Economic Forum, UNESCO AI |
| **TOTAL CIBLE** | **~2400** | |

---

## 1. CONTEXTE — À LIRE AVANT TOUT

### État repo
- **Remote** : `https://github.com/will383842/axion-ia.git`
- **Branche** : `main`
- **HEAD origin/main** : à découvrir
- **Pré-requis** : aucun sprint bloquant. Si Sprint Perfection 2026 Finalisation (cities DB 2100) livré → bénéficier de table `City` pour cityIds. Sinon utiliser slug ville en dur.

### Mémoires Claude à lire EN PREMIER
- `axionia_decisions_will_final_2026-05-21.md` (D7 société FR + exclusions Wikidata/DPA/CF)
- `axionia_p4_decisions_canoniques_2026-05-21.md` (D1-D5)
- `axionia_p5_decisions_canoniques_2026-05-21.md` (D-P5-1 à D-P5-6)

### Confirmation env vars
- ✅ `PERPLEXITY_API_KEY` documentée dans `.env.example` (commentaire "Perplexity : perplexity.ai/hub/legal/dpa")
- ⚠️ Will doit confirmer que la clé est valorisée dans Coolify prod ET dans `.env.local` dev
- Si clé absente : script seed plantera → instructions clear dans verdict

### Mode IMPLEMENTATION
- ✅ Modifications `src/data/external-links/`, `src/server/clients/`, `src/scripts/`, `src/server/queue/workers/`, `src/server/content-gen/`, `src/components/admin/content-gen/`
- ✅ Commits Conventional + push après chaque phase
- ❌ JAMAIS `--no-verify`
- ❌ JAMAIS modifier `villes/copy/*` (Manon)
- ❌ JAMAIS modifier `image-bank/seed-images.ts` (Manon)
- ❌ Décisions Will exclues : Wikidata, DPA Anthropic, CF WAF

### Gates obligatoires AVANT chaque commit
```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm content-gen:isolation-check
```

---

## 2. PHASE 0 — AUDIT RACCORDEMENT EXISTANT (~3h, OBLIGATOIRE EN PREMIER)

**Critique** : avant de créer quoi que ce soit, identifier ce qui existe déjà pour ne pas dupliquer / casser.

### 0.1 — Inventaire de l'existant

À vérifier dans le code source actuel :
- `src/server/clients/` : existe-t-il déjà un client Perplexity ? (peut-être créé pour fact-checking P3 ?)
- `src/server/content-gen/factcheck/` : utilise déjà Perplexity ? Comment ?
- `src/data/` : y a-t-il déjà un fichier liens externes / sources / `linkbase` quelque part ?
- SYSTEM_PROMPTs des 7 generators (`src/server/content-gen/generators/*.ts`) : y a-t-il déjà des URLs hardcoded à citer ?
- `src/data/kb/` : la KB sectorielle (verticale `audits` pilote) contient déjà des `sourceUrl` — réutiliser ces sources ?
- `citations[]` Perplexity dans Article model : déjà utilisé ? Câblé dans `isBasedOn` JSON-LD (P3 verif 761/1000 mentionne ce gap) ?
- Tracker existant : `KeywordTracking` (déjà existant) peut-il être étendu pour tracker l'usage des liens externes ?
- Modèles Prisma existants pouvant intégrer la dimension "external links usage" ?

### 0.2 — Stratégie de raccordement

Produire `_AUDIT/EXTERNAL-LINKS-2026-05-22/PHASE-0-RACCORDEMENT.md` qui documente :
- ✅ Composants existants RÉUTILISABLES (ex : si client Perplexity existe → l'utiliser, pas dupliquer)
- ❌ Composants ABSENTS (ex : pas de client Perplexity → en créer un)
- 🔗 Intégrations à câbler (ex : KB sourceUrl + ExternalLink → merge dans même base ?)
- ⚠️ Conflits potentiels (ex : si KB a déjà 50 URLs INSEE, ne pas dupliquer)
- 🎯 Architecture finale convergente (1 SSOT, pas 2)

### 0.3 — Décision architecture

3 options selon découvertes :

**Option A — Tout dans `src/data/external-links/`** (recommandé si pas d'existant majeur) :
- Fichier statique versionné git
- KB conserve ses `sourceUrl` mais ExternalLinks devient source de vérité pour injection generators

**Option B — Étendre KB existante** (si KB déjà mature) :
- Ajouter champs ExternalLink-like dans modèle KB
- Pas de fichier séparé
- Risque : KB devient trop hétérogène

**Option C — Hybride** (si KB partielle) :
- KB pour facts vérifiés (50-100 par verticale)
- ExternalLinks pour catalogue large (~2400) sans claim factuel précis
- Convergence via tags/topics

**Choisir l'option** selon découvertes 0.1, documenter dans 0.2.

### Commit
```
feat(external-links): perfection 2026 — Phase 0 — audit raccordement existant

- PHASE-0-RACCORDEMENT.md (inventaire + stratégie)
- Décision architecture A/B/C documentée

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 3. PHASE A — TYPES + STRUCTURE FICHIERS (~3h)

### A.1 — Modèle TypeScript

`src/data/external-links/types.ts` :
```typescript
export type ExternalLinkCategory =
  | 'gov_fr'           // .gouv.fr (autorité 5)
  | 'gov_eu'           // .europa.eu (autorité 4)
  | 'academic'         // .edu / Stanford / MIT / ESSEC / HEC (autorité 5)
  | 'research_industry' // McKinsey / Gartner / Forrester / IDC (autorité 4)
  | 'press_top'        // JDN / Frenchweb / Les Échos / Numerama (autorité 3)
  | 'industry_assoc'   // syndicats, observatoires sectoriels (autorité 3)
  | 'official_doc'     // ISO, AFNOR, IEEE, ARXIV (autorité 5)
  | 'mairie'           // mairie officielle .fr (autorité 4)
  | 'cci'              // CCI .fr (autorité 4)
  | 'opco'             // OPCO formation (autorité 4)
  | 'international';   // OECD, UNESCO, World Bank (autorité 4)

export type ExternalLinkScope = 'national' | 'regional' | 'local' | 'international';
export type ExternalLinkStatus = 'active' | '404' | 'redirect_acceptable' | 'redirect_problem' | 'deprecated';
export type ExternalLinkAuthority = 1 | 2 | 3 | 4 | 5;

export interface ExternalLink {
  id: string;                          // "fr-insee-001"
  url: string;                          // "https://www.insee.fr/fr/statistiques/..."
  title: string;                        // "Études PME et IA — INSEE 2024"
  organization: string;                 // "INSEE"
  category: ExternalLinkCategory;
  scope: ExternalLinkScope;
  regionSlug?: string;                  // "ile-de-france"
  cityIds?: string[];                   // ["paris", "boulogne-billancourt"]
  verticales: string[];                 // ["audits", "interventions_formations"]
  topics: string[];                     // ["rgpd", "ai-act", "stats-emploi", "ia-pme"]
  language: 'fr' | 'en';
  authority: ExternalLinkAuthority;
  publishedYear?: number;               // 2024
  verifiedAt: string;                   // "2026-05-22"
  lastCheckedAt: string;                // ISO timestamp
  status: ExternalLinkStatus;
  notes?: string;                       // "Étude annuelle DARES, prochaine maj oct 2026"

  // === FILTRES DURS QUALITÉ SEO/AEO 2026 ===
  isCompetitor: boolean;                // true = exclu de la sélection (axionai.fr, KPMG IA, Cegos, ...)
  paywall: boolean;                     // true = bloquant lecture humaine + bots → exclu
  indexable: boolean;                   // robots.txt destination permet l'indexation Google ?
  isHttps: boolean;                     // doit être true pour citation SEO
  hasSchemaOrg?: boolean;               // destination a au moins Organization/Article JSON-LD (optionnel)

  // === ROTATION ÉQUITABLE ===
  usageCount: number;                   // nombre d'articles ayant cité ce lien (default 0)
  lastUsedAt?: string;                  // ISO timestamp dernière utilisation (rotation)
  usageQuota?: number;                  // quota max utilisations/mois (default null = illimité)
}

export interface SelectExternalLinksOptions {
  vertical?: string;
  cityId?: string;
  regionSlug?: string;
  topic?: string;
  minAuthority?: ExternalLinkAuthority;  // default 3
  count?: number;                        // default 3
  excludeIds?: string[];                 // pour diversité cross-article même session
  language?: 'fr' | 'en';                // default 'fr'
  rotationMode?: 'round_robin' | 'weighted_authority' | 'random';  // default 'round_robin'
  maxRecentUsageHours?: number;          // refuse les liens utilisés dans les X dernières heures (default 24)
}

// Liste hardcodée concurrents à exclure (filtre dur)
export const COMPETITOR_DOMAINS = [
  'axionai.fr',          // concurrent homonyme direct
  'kpmg.fr',             // conseil IA grande marque
  'kpmg.com/fr',
  'mckinsey.com/fr',     // conseil IA
  'capgemini.com',       // conseil IA (mais Capgemini Research Institute = OK = research_industry)
  'wavestone.com',       // conseil IA
  'siapartners.com',     // conseil IA
  'onepoint.com',
  'devoteam.com',
  'cegos.fr',            // formation IA concurrent
  'demos.fr',            // formation
  'openclassrooms.com',  // formation
  'lewagon.com',         // formation
  'simplon.co',          // formation
  'datacamp.com',        // formation
  // Plateformes IA potentiellement concurrentes :
  'dust.tt',
  'crisp.chat',
  'akkodis.com',
];

// Exceptions : sous-pages spécifiques OK même si domaine concurrent
export const COMPETITOR_EXCEPTIONS = [
  // Ex : 'capgemini-research-institute.com' (research industry OK)
  // Ajouter au cas par cas si besoin
];
```

### A.2 — Structure répertoire

```
src/data/external-links/
├── types.ts
├── helpers.ts              # selectExternalLinks(), validateLink()
├── master.ts               # SSOT agrégation (importe tous les fichiers ci-dessous)
├── national-fr.ts          # ~200 liens national général
├── international.ts        # ~50 liens international
├── regions/
│   ├── ile-de-france.ts    # ~10 liens
│   ├── auvergne-rhone-alpes.ts
│   ├── nouvelle-aquitaine.ts
│   ├── occitanie.ts
│   ├── hauts-de-france.ts
│   ├── grand-est.ts
│   ├── provence-alpes-cote-azur.ts
│   ├── pays-de-la-loire.ts
│   ├── bretagne.ts
│   ├── normandie.ts
│   ├── bourgogne-franche-comte.ts
│   ├── centre-val-de-loire.ts
│   └── corse.ts            # (13 régions, ~130 liens total)
├── cities-top-200/
│   ├── paris.ts            # 1 lien (mairie ou CCI)
│   ├── marseille.ts
│   ├── lyon.ts
│   └── ... (200 fichiers, ~200 liens total)
├── verticales/
│   ├── audits.ts           # ~80 liens
│   ├── interventions-formations.ts  # ~80 liens
│   ├── un-a-un.ts          # ~60 liens
│   ├── implementations.ts  # ~80 liens
│   └── sites-web-augmentes.ts  # ~80 liens
├── topics/
│   ├── ia-research.ts      # ~50 liens (Stanford AI Index, MIT Tech Review)
│   ├── ai-act-rgpd.ts      # ~30 liens (EU AI Act, CNIL, RGPD)
│   ├── ia-securite.ts      # ~25 liens (ANSSI, NIST, OWASP)
│   ├── ia-emploi.ts        # ~25 liens (DARES, France Travail)
│   └── ia-economie.ts      # ~20 liens (Bpifrance, France Num, INSEE)
└── press-fr/
    └── tech-top.ts         # ~50 liens (JDN, Frenchweb, Maddyness, Numerama, BFM Tech)
```

### A.3 — Tests Vitest
- `types.test.ts` : 3 tests
- `helpers.test.ts` : 8 tests (sélection par scope, autorité, diversification)

### Commit
```
feat(external-links): perfection 2026 — Phase A — types + structure fichiers

- ExternalLink interface (TypeScript)
- 13 fichiers régions + 200 fichiers villes + 5 fichiers verticales + topics + press-fr
- master.ts SSOT
- helpers selectExternalLinks() + validateLink()
- 11 vitest tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 3. PHASE B — CLIENT PERPLEXITY MINIMAL (~3h)

### B.1 — Client TypeScript

`src/server/clients/perplexity-client.ts` :
```typescript
import { z } from 'zod';

const PerplexityResponseSchema = z.object({
  id: z.string(),
  model: z.string(),
  choices: z.array(z.object({
    message: z.object({
      content: z.string(),
      role: z.string(),
    }),
  })),
  citations: z.array(z.string()).optional(), // URLs sources
});

export interface PerplexitySearchOptions {
  query: string;
  model?: 'sonar-pro' | 'sonar' | 'sonar-reasoning'; // default 'sonar' (cheapest)
  searchDomainFilter?: string[]; // ex: ['gouv.fr', 'edu', 'org']
  returnCitations?: boolean;     // default true
  maxTokens?: number;            // default 1000
}

export interface PerplexitySearchResult {
  content: string;
  citations: string[];           // URLs sources extraites
  model: string;
}

export async function perplexitySearch(opts: PerplexitySearchOptions): Promise<PerplexitySearchResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY env var not set');
  }

  const model = opts.model ?? 'sonar';
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: opts.query }],
      return_citations: opts.returnCitations !== false,
      max_tokens: opts.maxTokens ?? 1000,
      ...(opts.searchDomainFilter ? { search_domain_filter: opts.searchDomainFilter } : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Perplexity API ${response.status}: ${errorText}`);
  }

  const data = PerplexityResponseSchema.parse(await response.json());
  return {
    content: data.choices[0]?.message.content ?? '',
    citations: data.citations ?? [],
    model: data.model,
  };
}

// Rate limit helper : max 10 queries/min
import pLimit from 'p-limit';
export const perplexityLimit = pLimit(10);
```

### B.2 — Tests
- `perplexity-client.test.ts` : 4 tests (success, error 401, error 429, citations parsing) — mocks `fetch`

### B.3 — Dépendances
Ajouter si pas présent : `p-limit` (rate limiting)

### Commit
```
feat(clients): perfection 2026 — Phase B — client Perplexity minimal

- src/server/clients/perplexity-client.ts (~50 lignes)
- perplexitySearch() avec citations + search_domain_filter
- Rate limit p-limit 10/min
- 4 vitest tests (mocks)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 4. PHASE C — SCRIPT SEED PERPLEXITY ONE-SHOT (~5h)

### C.1 — Script principal

`src/scripts/seed-external-links-from-perplexity.ts` :

Architecture :
```
1. Lit la spec cible : ~2400 liens à générer
2. Pour chaque combinaison (catégorie × spec) :
    - Génère query Perplexity adaptée
    - Appelle perplexitySearch()
    - Parse les URLs des citations
    - Valide structure (URL valide, organisation détectable)
3. Output : génère les fichiers TypeScript dans src/data/external-links/
4. Rapport final : count par catégorie, taux de validation
```

### C.2 — Queries Perplexity par catégorie

**Villes top 200** (200 queries × ~1 link = 200 liens) :
```
Pour chaque ville top 200 (depuis cities-france-5000plus si disponible, sinon liste hardcoded) :
Query : "Quel est le site officiel de la mairie de [VILLE] ([DEPT]) ? Donne uniquement l'URL exacte."
Search domain filter : ['gouv.fr', 'fr']
Min authority : 4
Fallback si pas de mairie clean : "Quel est le site de la CCI [VILLE] ou département [DEPT] ?"
```

**Régions** (13 régions × 10 liens = 130) :
```
Pour chaque région :
Query : "10 organismes officiels région [REGION] qui publient des données sur l'IA, transformation digitale entreprise, formation, emploi. Donne URL exacte + nom organisme. Format : 1. [Nom] - [URL]"
Search domain filter : ['gouv.fr', 'fr']
Min authority : 3
```

**National FR général** (~200 liens, 30-40 queries thématiques) :
```
Query exemples :
- "10 publications officielles INSEE sur l'IA en entreprise 2023-2026. URL exactes."
- "10 publications DARES sur formation professionnelle et IA. URL exactes."
- "10 ressources Bpifrance sur transformation digitale PME. URL exactes."
- "10 publications CNIL sur IA et RGPD. URL exactes."
- "10 publications ANSSI sur sécurité IA. URL exactes."
- ... (~30 queries thématiques)
Search domain filter : ['gouv.fr']
Min authority : 5
```

**Verticales** (5 verticales × 60-80 liens = 400 liens, ~50 queries) :
```
Query exemples (verticale audits) :
- "10 standards officiels audit IA entreprise (ISO, NIST, AFNOR). URL exactes."
- "10 cabinets conseil audit IA reconnus France (KPMG, Capgemini, Wavestone) avec URL études publiées."
- "10 publications Gartner Forrester sur audit IA 2024-2026. URL exactes."
- ... (10 queries verticale × 5 verticales)
Min authority : 3
```

**Topics IA transversaux** (~150 liens, 20 queries) :
```
- "10 publications Stanford AI Index annuel. URL exactes par année."
- "10 articles MIT Tech Review sur IA générative 2024-2026. URL."
- "10 papers OpenAI publiés. URL ArXiv ou OpenAI."
- "10 papers Anthropic publiés. URL."
- ...
Min authority : 4
```

**Presse FR top** (~50 liens, 5 queries) :
```
- "10 articles JDN sur IA entreprise France 2024-2026. URL exactes + titres."
- "10 articles Frenchweb sur formation IA. URL."
- ...
Min authority : 3
```

**International** (~50 liens, 5 queries) :
```
- "10 publications OECD AI Observatory. URL exactes."
- "10 publications EU Commission AI Act. URL."
- "10 publications UNESCO IA éthique. URL."
- ...
Min authority : 4
```

### C.3 — Total queries Perplexity

~270 queries totales (pas 2400, parce que chaque query retourne 10 résultats) :
- 200 villes × 1 query = 200 queries
- 13 régions × 1 query = 13 queries
- National FR : 30 queries
- Verticales : 50 queries
- Topics : 20 queries
- Presse FR : 5 queries
- International : 5 queries
- Total : ~323 queries × $0.005 = **~$1.62** (encore moins cher qu'estimé !)

### C.4 — Parsing + validation

Pour chaque réponse Perplexity :
1. Parse le content texte (format markdown attendu : "1. [Nom] - [URL]")
2. Extract URLs via regex
3. Pour chaque URL :
   - Valider HTTP/HTTPS
   - Valider domaine TLD (.fr, .gouv.fr, .edu, .org, etc.)
   - HEAD request (cf. Phase D)
   - Si OK → ajouter à la base
4. Enrichir métadonnées :
   - `organization` : extraire depuis URL ou content
   - `category` : déterminer depuis domaine TLD
   - `authority` : calculer depuis domaine
   - `topics` : extraire depuis content + query context

### C.5 — Output structure

Le script écrit directement dans :
- `src/data/external-links/national-fr.ts`
- `src/data/external-links/regions/*.ts`
- `src/data/external-links/cities-top-200/*.ts`
- `src/data/external-links/verticales/*.ts`
- `src/data/external-links/topics/*.ts`
- `src/data/external-links/press-fr/tech-top.ts`
- `src/data/external-links/international.ts`

Et met à jour `src/data/external-links/master.ts` agrégation.

### C.6 — Logs progression

Script affiche :
```
[Perplexity Seed] Phase 1/7: villes top 200...
  [✓] paris (Mairie de Paris) https://www.paris.fr/
  [✓] marseille (Mairie de Marseille) https://www.marseille.fr/
  ...
  [200/200] Phase 1 terminée. 198 OK / 2 404.

[Perplexity Seed] Phase 2/7: régions...
  ...

[Perplexity Seed] TOTAL : 2387 liens créés / 2400 cibles (99.5%)
[Perplexity Seed] Coût Perplexity : $1.62
[Perplexity Seed] Durée : 47 minutes
```

### C.7 — Idempotent

Si script relancé :
- Compare URLs déjà présentes en `master.ts` vs nouvelles candidates
- Skip si déjà présent (par URL exacte)
- Ajoute seulement les nouvelles

### Commit
```
feat(external-links): perfection 2026 — Phase C — script seed Perplexity one-shot

- src/scripts/seed-external-links-from-perplexity.ts
- ~270 queries Perplexity → ~2400 liens parsés
- Output direct dans src/data/external-links/
- Idempotent (skip URLs déjà présentes)
- Logs progression détaillés

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 5. PHASE D — VÉRIFICATION HEAD ALL LIENS (~2h)

### D.1 — Script HEAD validator + analyse destination

`src/scripts/verify-external-links-head.ts` :
```typescript
// Pour chaque ExternalLink dans master.ts :
//
// ÉTAPE 1 — HEAD request
//   - HEAD request via fetch
//   - Si 200 → status='active'
//   - Si 301/302 → suivre redirect, si OK status='redirect_acceptable'
//   - Si 404/410 → status='404'
//   - Si timeout / 5xx → status='deprecated' après 3 retries
//
// ÉTAPE 2 — Vérification HTTPS
//   - URL commence par https:// ? → isHttps=true sinon false
//   - Si HTTP only sans HTTPS disponible → status='deprecated' (Google pénalise HTTP citations en 2026)
//
// ÉTAPE 3 — Détection concurrent (filtre dur)
//   - Comparer hostname URL avec COMPETITOR_DOMAINS
//   - Si match (et pas dans COMPETITOR_EXCEPTIONS) → isCompetitor=true
//   - Si isCompetitor=true → REMOVE du fichier final (ne pas inclure)
//
// ÉTAPE 4 — Détection paywall
//   - Fetch GET partiel (premier 100KB) + analyse content :
//     - Mots-clés paywall : "abonnez-vous", "Subscriber Edition", "Premium Plus", "paywall", "register to read"
//     - Status 401/403 sur GET = paywall probable
//     - Présence de meta tag "subscription"
//   - Si paywall détecté → paywall=true + alerte dans rapport (mais ne pas supprimer automatiquement, Will tranche)
//
// ÉTAPE 5 — Vérification robots.txt indexabilité
//   - Fetch <domain>/robots.txt
//   - Parser pour User-agent: Googlebot
//   - Si Disallow: / ou Disallow: pour le path concerné → indexable=false
//   - Sinon → indexable=true (default)
//
// ÉTAPE 6 — Détection Schema.org sur destination (optionnel, best-effort)
//   - Fetch GET premier 50KB
//   - Regex pour <script type="application/ld+json">
//   - Si trouvé → hasSchemaOrg=true (boost qualité)
//
// Update tous les fichiers TypeScript avec lastCheckedAt + status + isCompetitor + paywall + indexable + isHttps + hasSchemaOrg
// Rate limit : 30 vérifs/min (plus lent que HEAD-only car GET partiel)
```

### D.2 — Filtrage post-verification

Le script :
- Garde TOUS les liens (même 404/concurrents, pour audit)
- Mais `selectExternalLinks()` helper filtre :
  - `status === 'active' || status === 'redirect_acceptable'`
  - `isCompetitor === false` (filtre dur)
  - `paywall === false` (filtre dur)
  - `indexable === true` (filtre dur)
  - `isHttps === true` (filtre dur)
- Rapport `verification-report.md` avec :
  - Liste 404 / problèmes status
  - Liste concurrents détectés (à valider Will)
  - Liste paywalls détectés (à valider Will)
  - Liste non-indexables (à supprimer probablement)
  - Stats agrégées (% valides, % concurrents, % paywalls, etc.)

### D.3 — Commande
```powershell
pnpm tsx src/scripts/verify-external-links-head.ts
```

Durée : ~45 min pour 2400 liens à 50/min.

### Commit
```
feat(external-links): perfection 2026 — Phase D — HEAD verification all liens

- src/scripts/verify-external-links-head.ts
- Vérifie ~2400 liens (rate limit 50/min, ~45 min total)
- Update status + lastCheckedAt
- verification-report.md avec problèmes détectés

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 6. PHASE E — CATALOGAGE WILL REVIEWABLE (~3h)

### E.1 — Format lisible

Chaque fichier `.ts` produit a en tête un comment explicatif :
```typescript
/**
 * EXTERNAL LINKS — Région Île-de-France
 * 10 sources officielles (conseils régionaux, observatoires, agences dev éco, CCI régionale)
 * Générées 2026-05-22 via Perplexity sonar
 * Vérifiées HEAD 2026-05-22
 *
 * À review par Will : virer les non-pertinents, ajouter manuels si besoin.
 */

import type { ExternalLink } from '../types';

export const LINKS_IDF: ExternalLink[] = [
  {
    id: 'fr-idf-001',
    url: 'https://www.iledefrance.fr/',
    title: 'Conseil régional Île-de-France',
    organization: 'Région Île-de-France',
    category: 'gov_fr',
    scope: 'regional',
    regionSlug: 'ile-de-france',
    verticales: ['audits', 'interventions_formations', 'implementations'],
    topics: ['economie-regionale', 'innovation', 'formation'],
    language: 'fr',
    authority: 5,
    verifiedAt: '2026-05-22',
    lastCheckedAt: '2026-05-22T14:32:00Z',
    status: 'active',
    notes: 'Site officiel conseil régional IDF',
  },
  // ...
];
```

### E.2 — Document review Will

`_AUDIT/EXTERNAL-LINKS-2026-05-22/REVIEW-WILL.md` :
```markdown
# Review Will — External Links Database 2026-05-22

## Stats globales
- Total liens : 2387
- Par catégorie :
  - gov_fr : 1850
  - academic : 120
  - research_industry : 180
  - press_top : 50
  - ...
- Authority distribution :
  - 5/5 : 1620
  - 4/5 : 600
  - 3/5 : 167

## Action Will
1. Parcourir master.ts (rapide, lisible)
2. Si tu vois un lien que tu ne veux PAS → supprimer la ligne
3. Si tu veux AJOUTER un lien manuellement → ajouter selon format

Effort estimé Will : 30-45 min pour ~2400 liens (scan visuel)

## Top 10 liens les plus utiles attendus
1. https://www.insee.fr/fr/statistiques/...
2. https://dares.travail-emploi.gouv.fr/...
...
```

### Commit
```
feat(external-links): perfection 2026 — Phase E — catalogage Will reviewable

- master.ts SSOT agrégation tous les fichiers
- REVIEW-WILL.md (stats + instructions review)
- Format lisible avec comments explicatifs

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 7. PHASE F — INTÉGRATION GENERATORS (~4h)

### F.1 — Helper selectExternalLinks() avec ROTATION ÉQUITABLE

`src/data/external-links/helpers.ts` :
```typescript
import { ALL_EXTERNAL_LINKS } from './master';
import type { ExternalLink, SelectExternalLinksOptions } from './types';

export async function selectExternalLinks(opts: SelectExternalLinksOptions): Promise<ExternalLink[]> {
  const {
    vertical,
    cityId,
    regionSlug,
    topic,
    minAuthority = 3,
    count = 3,
    excludeIds = [],
    language = 'fr',
    rotationMode = 'round_robin',
    maxRecentUsageHours = 24,
  } = opts;

  // === ÉTAGE 1 — FILTRES DURS QUALITÉ ===
  let candidates = ALL_EXTERNAL_LINKS.filter(link =>
    // Status acceptable
    (link.status === 'active' || link.status === 'redirect_acceptable') &&
    // FILTRES DURS SEO/AEO 2026
    link.isCompetitor === false &&     // 🚫 jamais de concurrent
    link.paywall === false &&           // 🚫 jamais de paywall
    link.indexable === true &&          // ✅ doit être indexable Google
    link.isHttps === true &&            // ✅ HTTPS obligatoire
    // Langue + autorité minimum
    link.language === language &&
    link.authority >= minAuthority &&
    // Exclusion session courante
    !excludeIds.includes(link.id)
  );

  // === ÉTAGE 2 — FILTRES CONTEXTE ===
  if (vertical) {
    candidates = candidates.filter(link =>
      link.verticales.includes(vertical) || link.verticales.length === 0 // links transversaux
    );
  }

  if (topic) {
    candidates = candidates.filter(link => link.topics.includes(topic));
  }

  // === ÉTAGE 3 — FILTRE ROTATION (anti-répétition récente) ===
  const nowMs = Date.now();
  const cutoffMs = nowMs - maxRecentUsageHours * 3600 * 1000;
  candidates = candidates.filter(link => {
    if (!link.lastUsedAt) return true; // jamais utilisé OK
    const lastMs = new Date(link.lastUsedAt).getTime();
    return lastMs < cutoffMs; // utilisé > X heures = OK
  });

  // Si pas assez de candidats après filtre rotation → relâcher le filtre
  if (candidates.length < count * 2) {
    candidates = ALL_EXTERNAL_LINKS.filter(link =>
      (link.status === 'active' || link.status === 'redirect_acceptable') &&
      link.isCompetitor === false &&
      link.paywall === false &&
      link.indexable === true &&
      link.isHttps === true &&
      link.language === language &&
      link.authority >= minAuthority &&
      !excludeIds.includes(link.id) &&
      (vertical ? (link.verticales.includes(vertical) || link.verticales.length === 0) : true) &&
      (topic ? link.topics.includes(topic) : true)
    );
  }

  // === ÉTAGE 4 — SCORING + ROTATION ÉQUITABLE ===
  const scored = candidates.map(link => {
    // Score base : autorité × 10
    let score = link.authority * 10;

    // Bonus contexte géo
    if (cityId && link.cityIds?.includes(cityId)) score += 50;
    if (regionSlug && link.regionSlug === regionSlug) score += 30;
    if (link.scope === 'national') score += 10;
    if (link.scope === 'international') score += 5;

    // Bonus Schema.org destination (qualité E-E-A-T)
    if (link.hasSchemaOrg) score += 8;

    // === ROTATION ÉQUITABLE ===
    if (rotationMode === 'round_robin') {
      // Privilégier les liens les MOINS utilisés
      // Plus usageCount est bas, plus le score augmente
      score += Math.max(0, 100 - link.usageCount * 2);
    } else if (rotationMode === 'weighted_authority') {
      // Pondération authority pure (pour articles premium)
      score = link.authority * 20 + (cityId && link.cityIds?.includes(cityId) ? 100 : 0);
    } else if (rotationMode === 'random') {
      score = Math.random() * 100;
    }

    return { link, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // === ÉTAGE 5 — DIVERSIFICATION ORGANISATIONS ===
  // Pas 2 liens du même organisme dans 1 article
  const selected: ExternalLink[] = [];
  const usedOrgs = new Set<string>();
  for (const { link } of scored) {
    if (usedOrgs.has(link.organization)) continue;
    selected.push(link);
    usedOrgs.add(link.organization);
    if (selected.length >= count) break;
  }

  return selected;
}

// === ROTATION : tracker d'utilisation ===
export async function trackExternalLinksUsage(linkIds: string[]): Promise<void> {
  // Incrémente usageCount + update lastUsedAt
  // Persistence : option A fichier JSON tracking, option B table Prisma ExternalLinkUsage
  // Pour simplicité : table Prisma minimaliste
  for (const id of linkIds) {
    await prisma.externalLinkUsage.upsert({
      where: { externalLinkId: id },
      create: { externalLinkId: id, usageCount: 1, lastUsedAt: new Date() },
      update: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
  }
}

// Helper : reload usage stats depuis DB et merge avec ALL_EXTERNAL_LINKS in-memory
export async function refreshUsageStats(): Promise<void> {
  const usages = await prisma.externalLinkUsage.findMany();
  const usageMap = new Map(usages.map(u => [u.externalLinkId, u]));
  for (const link of ALL_EXTERNAL_LINKS) {
    const u = usageMap.get(link.id);
    if (u) {
      link.usageCount = u.usageCount;
      link.lastUsedAt = u.lastUsedAt.toISOString();
    }
  }
}
```

### F.1.bis — Modèle Prisma `ExternalLinkUsage` pour tracking

```prisma
model ExternalLinkUsage {
  id              String   @id @default(cuid())
  externalLinkId  String   @unique  // référence par id du fichier TS (pas FK Prisma)
  usageCount      Int      @default(0)
  lastUsedAt      DateTime @default(now())
  monthUsageCount Int      @default(0)  // reset chaque 1er du mois (pour quota mensuel)
  monthResetAt    DateTime @default(now())

  @@index([externalLinkId])
  @@index([lastUsedAt])
  @@map("external_link_usage")
}
```

Migration : `20260522150000_add_external_link_usage_tracking`

### F.2 — Intégration SYSTEM_PROMPT

Modifier les 7 generators (`src/server/content-gen/generators/*.ts`) :

```typescript
import { selectExternalLinks } from '../../../data/external-links/helpers';

async function generateArticle(input: GeneratorInput) {
  const externalLinks = selectExternalLinks({
    vertical: input.verticale,
    cityId: input.anchorVilleSlug,
    regionSlug: getRegionFromCity(input.anchorVilleSlug),
    topic: input.cluster,
    minAuthority: 4,
    count: 3,
  });

  const externalLinksSection = externalLinks.length > 0
    ? `\n\n## SOURCES AUTORITÉ À CITER OBLIGATOIREMENT (≥ 2 dans l'article)\n${externalLinks
        .map(l => `- ${l.title} (${l.organization}) : ${l.url}`)
        .join('\n')}\n\nUtiliser des ancres descriptives, jamais "cliquez ici".`
    : '';

  const systemPrompt = `${BASE_SYSTEM_PROMPT}${externalLinksSection}`;
  // ... génération
}
```

### F.3 — Validation post-LLM + tracking usage

Modifier `content-publish-worker.ts` :
```typescript
import { trackExternalLinksUsage } from '@/data/external-links/helpers';

// 1. Compter liens externes injectés
const externalLinkMatches = article.bodyHtml.match(/<a [^>]*href="(https?:\/\/(?!axion-ia\.com)[^"]+)"/g) || [];
const externalLinkUrls = externalLinkMatches.map(m => m.match(/href="([^"]+)"/)?.[1]).filter(Boolean);

// 2. Validation minimum 2 liens externes
if (externalLinkUrls.length < 2) {
  logger.warn(`Article ${article.id} has only ${externalLinkUrls.length} external links`);
  article.publishStatus = 'needs_review';
  return;
}

// 3. Vérifier que les liens injectés sont bien dans notre catalogue (pas hallucinations LLM)
const catalogUrlsSet = new Set(ALL_EXTERNAL_LINKS.map(l => l.url));
const validLinkIds: string[] = [];
const halluciatedUrls: string[] = [];
for (const url of externalLinkUrls) {
  const catalogLink = ALL_EXTERNAL_LINKS.find(l => l.url === url);
  if (catalogLink) {
    validLinkIds.push(catalogLink.id);
  } else {
    halluciatedUrls.push(url);
  }
}

if (halluciatedUrls.length > 0) {
  logger.warn(`Article ${article.id} contains ${halluciatedUrls.length} hallucinated URLs not in catalog`, { halluciatedUrls });
  // Décision : si > 0 URLs hallucinations → needs_review (pour audit Will)
  article.publishStatus = 'needs_review';
}

// 4. Si validation OK → tracker l'usage des liens (rotation équitable)
if (validLinkIds.length >= 2 && halluciatedUrls.length === 0) {
  await trackExternalLinksUsage(validLinkIds);
}
```

### F.4 — Tests
- `external-links-integration.test.ts` : 12 tests (sélection, scoring, diversification, intégration generator)

### Commit
```
feat(content-gen): perfection 2026 — Phase F — intégration external links generators

- selectExternalLinks() helper avec scoring + diversification
- 7 generators étendus avec section "SOURCES AUTORITÉ À CITER"
- Validation post-LLM : ≥ 2 liens externes → sinon needs_review
- 12 vitest tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 8. PHASE G — WORKER HEAD MONTHLY + CONSOLE ADMIN (~5h)

### G.1 — Worker `external-links-monitor-worker.ts`

```typescript
// src/server/queue/workers/external-links-monitor-worker.ts
// Cron : 1er du mois 03:00 UTC
// Action :
//   - Lire ALL_EXTERNAL_LINKS depuis master.ts
//   - Pour chaque : HEAD request
//   - Si > 5% des liens cassés : alerte Telegram + email admin
//   - Update status dans fichiers .ts (write file via git automation)
//   - Note : si beaucoup de modifs → commit auto branche ops/ + PR
```

### G.2 — Page admin `/content-gen/external-links`

Server Component :
- Liste paginée 100 liens/page avec filtres (région, ville, verticale, autorité, status)
- Compteurs : 95% active / 3% redirect / 2% à vérifier
- Bouton "Lancer re-vérification manuelle"
- Bouton "Ajouter un lien manuellement" (validation HEAD instant)
- Statistiques usage (depuis logs generators : "Source la plus citée : INSEE 234 articles")
- Export CSV

### G.3 — Server Actions
- `listExternalLinks(filters)` : Server Action
- `triggerManualVerification()` : enqueue job worker immédiat
- `addManualLink(link)` : ajoute en DB ou fichier (à décider, voir G.4)

### G.4 — Stockage manual links

Question architecture : si Will ajoute un lien manuellement depuis admin → où stocker ?
- Option 1 : `src/data/external-links/manual-additions.ts` (file based, versionné git)
- Option 2 : Table Prisma `ExternalLinkAddition` (DB, plus simple à éditer mais pas versionné)

**Reco** : **Option 1** (file based) pour préserver le principe "one-shot puis versionné". Admin propose mais Will commit manuellement.

### G.5 — Tests
- `external-links-monitor-worker.test.ts` : 6 tests
- `external-links-admin-page.test.tsx` : 5 tests RTL

### Commit
```
feat(content-gen-admin): perfection 2026 — Phase G — worker monthly + console admin

- external-links-monitor-worker.ts (cron 1er mois 03:00 UTC)
- Page /content-gen/external-links (liste + filtres + stats usage)
- Server actions list/verify/add
- 11 vitest tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 9. PHASE H — TESTS + DOC (~2h)

### H.1 — Tests d'intégration end-to-end
- `external-links-e2e.test.ts` : 8 tests
  - Génération 1 article avec verticale audits + ville Paris → 3 liens injectés (mairie Paris + ANSSI + Bpifrance par exemple)
  - Validation post-LLM échec si < 2 liens
  - Sélection respecte authority minimum
  - Diversification organisations
  - Cohérence cross-articles (pas même 3 liens 100x)

### H.2 — Documentation
- `_AUDIT/EXTERNAL-LINKS-2026-05-22/DOC-USAGE.md` :
  - Comment ajouter un lien manuellement
  - Comment lancer la re-vérification HEAD
  - Comment re-générer la base annuel (instructions Perplexity)
  - Comment debugguer si articles génèrent < 2 liens

### Commit
```
feat(external-links): perfection 2026 — Phase H — tests E2E + doc usage

- 8 tests E2E intégration generator + selectExternalLinks
- DOC-USAGE.md (4 sections : ajout manuel / vérif / re-gen annuelle / debug)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 10. ZONES INTERDITES

- ❌ `prisma/seeds/villes/copy/*.ts` (Manon)
- ❌ `prisma/seeds/image-bank/seed-images.ts` (Manon)
- ❌ Décisions Will : Wikidata, DPA Anthropic, CF WAF
- ❌ Ne pas inventer de liens — toujours validés HEAD avant inclusion
- ❌ Ne pas inclure liens autorité < 3 (filtre dur)

---

## 11. LIVRABLES & FORMAT

### Verdict sprint
`_AUDIT/EXTERNAL-LINKS-2026-05-22/VERDICT-SPRINT-EXTERNAL-LINKS-DATABASE.md`

Format :
```markdown
# VERDICT SPRINT EXTERNAL LINKS DATABASE 2026-05-22
## HEAD post-sprint : <SHA>
## Effort réel : XXh (vs estimé 25-30h)

## 8 phases livrées
| Phase | Description | Statut |

## Métriques d'impact
- Total liens en base : XXXX
- Par catégorie : ...
- Par autorité : ...
- % active après HEAD verification : XX%
- Coût Perplexity réel : $X.XX
- Durée seed Perplexity : XX min

## Fichiers créés
- src/data/external-links/types.ts
- src/data/external-links/master.ts
- src/data/external-links/national-fr.ts
- src/data/external-links/international.ts
- src/data/external-links/regions/[13 fichiers]
- src/data/external-links/cities-top-200/[200 fichiers]
- src/data/external-links/verticales/[5 fichiers]
- src/data/external-links/topics/[5 fichiers]
- src/data/external-links/press-fr/tech-top.ts
- src/data/external-links/helpers.ts
- src/server/clients/perplexity-client.ts
- src/scripts/seed-external-links-from-perplexity.ts
- src/scripts/verify-external-links-head.ts
- src/server/queue/workers/external-links-monitor-worker.ts
- src/app/[locale]/(admin)/[adminPrefix]/content-gen/external-links/page.tsx
- src/server/content-gen/admin/external-links.ts (server actions)

## Generators modifiés
- 7 generators étendus avec section "SOURCES AUTORITÉ À CITER"
- content-publish-worker validation ≥ 2 liens externes

## Tests Vitest
- Phase A : 11 tests
- Phase B : 4 tests
- Phase F : 12 tests
- Phase G : 11 tests
- Phase H : 8 tests E2E
- TOTAL : 46 nouveaux tests

## Gates anti-régression
- typecheck ✅
- lint ✅
- vitest XXXX/XXXX
- isolation-check ✅

## Actions Will post-sprint
1. **Confirmer PERPLEXITY_API_KEY valorisée dans Coolify** (sinon script seed plantera)
2. **Lancer le seed one-shot** (1×) : `pnpm tsx src/scripts/seed-external-links-from-perplexity.ts` (~47 min, coût ~$1.62)
3. **Lancer verification HEAD** : `pnpm tsx src/scripts/verify-external-links-head.ts` (~45 min, gratuit)
4. **Review master.ts** (30-45 min) : virer les liens inopportuns, ajouter manuels si besoin
5. **Commit final** : git add + commit + push
6. **Activer worker monthly** : env var `EXTERNAL_LINKS_MONITOR_ENABLED=true` Coolify
```

### Mémoire
Slug : `axionia_sprint_external_links_database_livre_2026-05-22`

### MEMORY.md
```
- [🟢 AxionIA Sprint External Links Database LIVRÉ 2026-05-22 — ~2400 liens vérifiés](axionia_sprint_external_links_database_livre_2026-05-22.md) — Base centralisée 200 villes + 13 régions + 200 national FR + 400 verticales + 150 topics + 50 presse + 50 international. One-shot Perplexity ~$1.62. Worker HEAD monthly. Console admin /content-gen/external-links. Intégration 7 generators.
```

---

## 12. STOP & ASK FINAL

```
✅ Sprint External Links Database livré.

📊 Métriques d'impact :
- ~XXXX liens externes en base (cible 2400)
- 7 generators étendus avec injection automatique
- Worker HEAD monthly actif
- Console admin opérationnelle
- Coût Perplexity one-shot : $X.XX
- Durée seed : XX min

🚨 Actions Will critiques :
1. Confirmer PERPLEXITY_API_KEY valorisée Coolify
2. Review master.ts (30-45 min)
3. Activer worker monthly env var

🚀 Suite :
[A] Tester génération 1 article test avec injection liens externes
[B] Continuer pipeline content-gen perfection (P6 verdict global /5000)
[C] Lancer Sprint Perfection 2026 Finalisation
[D] Lancer Sprint Keywords Perfection
```

---

## 13. PHRASE DE LANCEMENT (AUTOPILOT TOTAL)

```
AUTOPILOT TOTAL. Ne pose AUCUNE question intermédiaire. Lance le sprint master décrit dans `_AUDIT/PROMPT-SPRINT-EXTERNAL-LINKS-DATABASE-2026-05-22.md`. Mode IMPLEMENTATION (commits incrémentaux + push autorisés). Décisions Will validées 2026-05-22 (Option C : 200 villes top + 13 régions + 200 national + 400 verticales + 150 topics + 50 presse + 50 international = ~2400 liens cible) + filtres durs (exclusion concurrents axionai.fr/KPMG/Capgemini/Wavestone/SiaPartners/Cegos/Demos/OpenClassrooms + exclusion paywalls + indexable robots.txt + HTTPS obligatoire) + rotation équitable (tracking usageCount via table Prisma ExternalLinkUsage + filtre lastUsedAt < 24h + scoring round_robin privilégie liens peu utilisés). Lire EN PREMIER axionia_decisions_will_final_2026-05-21 + axionia_p4_decisions_canoniques + axionia_p5_decisions_canoniques. Exécuter 9 phases séquentielles : **PHASE 0 audit raccordement existant** (inventaire client Perplexity existant, KB sourceUrl, citations Perplexity P3, generators SYSTEM_PROMPTs hardcoded — produire PHASE-0-RACCORDEMENT.md avec décision architecture A/B/C) → A types + structure (avec champs isCompetitor, paywall, indexable, isHttps, hasSchemaOrg, usageCount, lastUsedAt) → B client Perplexity (réutilisation si existant Phase 0) → C script seed Perplexity ~270 queries ~$1.62 avec exclusion automatique COMPETITOR_DOMAINS → D HEAD verification 30/min étendue (HTTPS + concurrent + paywall + robots.txt indexable + Schema.org destination) → E catalogage Will reviewable → F intégration 7 generators avec rotation équitable round_robin + validation post-LLM ≥ 2 liens externes + détection hallucinations LLM (URLs hors catalogue) + trackExternalLinksUsage() incrémente usageCount → G worker monthly HEAD + console admin /content-gen/external-links + page stats usage (top liens cités, distribution équitable) → H tests E2E + doc usage. Migration Prisma ExternalLinkUsage table tracking. Commits incrémentaux + push après chaque phase. Convergence Manon (git pull --rebase avant push). Gates verts obligatoires (typecheck/lint/vitest/isolation-check/prisma validate). Zones interdites strictes (villes/copy, image-bank/seed, exclusions Wikidata/DPA/CF). Si PERPLEXITY_API_KEY env var absente : skipper Phase C exécution MAIS livrer tous les fichiers code + alerter Will dans verdict. Self-troubleshoot toutes erreurs. Termine par VERDICT-SPRINT-EXTERNAL-LINKS-DATABASE.md + mémoire axionia_sprint_external_links_database_livre_2026-05-22 + MEMORY.md update. STOP & ASK Will UNIQUEMENT à la livraison finale avec métriques détaillées (% liens filtrés concurrents, % paywalls détectés, % HTTPS, % indexable robots.txt, distribution usage rotation) + 4 options [A-D]. Go.
```

---

*Sprint External Links Database one-shot — 25-30h autopilot — IMPLEMENTATION — ~2400 liens Perplexity ~$1.62 — Option C validée Will 2026-05-22*
