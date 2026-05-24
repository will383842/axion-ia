# A4-05 : Liens Internes / Externes / Suggested Content
## Score : 34/80

---

### Liens internes — 11/30

#### Localisation du module

Il n'existe **aucun module dédié à l'injection de liens internes**. La gestion des liens internes se résume à :

1. **Comptage post-LLM** (passif, pas d'injection active) dans 4 générateurs :
   - `blog-article.ts:154` : `((parsed.bodyHtml ?? "").match(/\[.*?\]\(\/[^)]+\)/g) ?? []).length`
   - `blog-from-keywords.ts:155` : idem
   - `landing-ville.ts:162` : idem
   - `guide-pilier.ts:278` : `(assembledBody.match(/\[.*?\]\(\/[^)]+\)/g) ?? []).length`

2. **Bug critique de détection** : le regex `\[.*?\]\(\/[^)]+\)` est un pattern **Markdown** (`[texte](/chemin)`), pas un pattern HTML (`<a href="...">`). Or le `bodyHtml` retourné par le LLM est du HTML (le champ s'appelle `bodyHtml`, le system prompt demande `bodyHtml`). Le compteur retournera **systématiquement 0** pour des liens `<a href="/guides/...">` présents dans le HTML généré. Ce bug est présent dans les 4 générateurs.

3. **Le scoring SEO en souffre directement** : `computeSeoScore()` (seo-score.ts:212) utilise `scoreInternalLinks(input.internalLinkCount)` avec max=6 pts. Ce critère est basé sur des données probablement fausses (0 en pratique même si des `<a>` HTML existent dans le body).

#### Injection dans le HTML final

Aucune injection automatique de liens internes n'est implémentée. Le pipeline se comporte en **mode espoir** : on demande au LLM dans le system prompt de produire un contenu avec liens internes, mais :
- Aucun prompt ne spécifie les URLs cibles existantes du site
- Aucun module ne vérifie que les URLs générées par le LLM (`/guides/guide-ia`, `/audits/...`) existent réellement sur le site
- Aucun post-processing ne remplace des termes clés par des ancres vers des pages connues

#### Stratégie de sélection

Inexistante côté code. Entièrement déléguée au LLM sans contrainte :
- **Pas de clustering vertical** (aucun mapping secteur → pages cibles)
- **Pas de similarité sémantique** entre l'article généré et les pages existantes
- **Pas de catalogue des pages** disponibles injecté dans le prompt

#### Minima par type

Le critère SEO `scoreInternalLinks()` définit seulement **3+ liens** pour le score plein (6 pts) quel que soit le type (`contentKind` ignoré dans cette fonction). Les cibles spécifiques (blog ≥ 3, landing ≥ 5, pilier ≥ 8) ne sont **pas implémentées**.

```typescript
// seo-score.ts:119-124
function scoreInternalLinks(count: number | undefined): { got: number; reason?: string } {
  const n = count ?? 0;
  if (n >= 3) return { got: 6 };
  if (n >= 1) return { got: 3, reason: `${n} liens internes (cible 3+)` };
  return { got: 0, reason: "Pas de liens internes" };
}
```

#### Points positifs

- La table `Article` dans Prisma a un champ `mentionedCities` (array) qui permet un maillage géographique basique
- La page `/blog/[slug]` (blog article page.tsx:253-261) filtre les articles connexes par catégorie, ce qui est une forme de maillage horizontal

---

### Liens externes — 12/25

#### Présence des citations

Le pipeline dispose d'une infrastructure pour les citations externes via le provider **Perplexity Sonar** (`perplexity.ts`) :
- Le provider extrait `search_results[]` (rich : url + title + date) ou `citations[]` (urls)
- Ces citations sont propagées dans `GeneratorOutput.citations` (types.ts:63-64)
- Elles sont stockées dans les générateurs : `lastCitations = llmResult.citations ?? []`

Cependant, les citations Perplexity sont **passives** : elles ne sont pas injectées comme `<a href>` dans le `bodyHtml`. Elles sont stockées dans le champ `citations[]` du `GeneratorOutput` mais ne deviennent pas des liens HTML dans le contenu affiché. Le code de publish-worker n'a pas été vérifié pour savoir si ces citations sont ensuite persistées dans `Article` — le schema `Article` ne possède pas de champ `citations` ni de relation vers un modèle de citations.

#### DA cible / sources d'autorité

Le `citationCount` n'est jamais calculé à partir des URLs Perplexity réelles dans les générateurs blog. Dans `blog-article.ts` et `blog-from-keywords.ts`, le champ `citationCount` n'est **jamais passé** à `computeSeoScore()` :

```typescript
// blog-article.ts:214-226 — citationCount absent !
const seo = computeSeoScore({
  title: parsed.title ?? "",
  metaDescription: parsed.metaDescription ?? "",
  bodyHtml: parsed.bodyHtml,
  bodyText,
  directAnswer: parsed.directAnswer,
  faqCount: (parsed.faq ?? []).length,
  internalLinkCount: finalInternalLinkCount,
  // ← AUCUN citationCount
  primaryKeyword: input.primaryKeyword ?? topic,
  searchIntent: input.targetSearchIntent,
  contentKind: "article",
  hasPersonManonJsonLd: false,
});
```

Résultat : le critère `"Citations intent-aware"` (max 6 pts) reçoit toujours `scoreCitations(undefined, intent)` → pour intent `informational` : **0 pts**. Pour les autres : 4 pts par défaut (n >= 1 est false donc `n >= 1 ? 6 : 4` = 4).

#### rel="noopener noreferrer"

Correctement implémenté dans **deux couches** :
1. `html-sanitizer.ts:117-124` : post-traitement DOMPurify force `rel="noopener noreferrer"` sur tout `<a target="_blank">`
2. `faq-sanitizer.ts:117-122` : même logique avec marker system pour survivre au sanitize DOMPurify

Testé dans `html-sanitizer.test.ts:94-104` et `faq-sanitizer.test.ts:58-62`.

#### Vérification URLs expirées

Aucune vérification que les URLs externes existent (pas de 404-check, pas de dead-link validator). Le `kb-ingest/robots-respect.ts` vérifie les `robots.txt` lors de l'ingestion KB, mais ce n'est pas un vérificateur de liens sortants dans le contenu.

#### Nombre minimum par type

Non implémenté. La logique `scoreCitations()` ne distingue pas le type de contenu (même barème pour blog, pilier, landing).

---

### Suggested content — 11/25

#### Module de recommandation présent

Un module existe **uniquement pour le blog** (`/blog/[slug]/page.tsx:253-261`) :

```typescript
// blog/[slug]/page.tsx:253-261
const related = [...BLOG_POSTS]
  .filter((p) => p.slug !== slug)
  .sort((a, b) => {
    const aSame = a.category === view.category ? 0 : 1;
    const bSame = b.category === view.category ? 0 : 1;
    if (aSame !== bSame) return aSame - bSame;
    return b.publishedAt.localeCompare(a.publishedAt);
  })
  .slice(0, 2);
```

Pour le glossaire (`/glossaire/[slug]/page.tsx:133-134`) :
```typescript
const related = getRelatedGlossaryTerms(slug, 5);
```
Ces related viennent de `relatedSlugs[]` prédéfinis statiquement dans `glossary-extension.ts`.

#### Logique de suggestion — lacunes majeures

| Critère | Blog | Glossaire | Guides | Landings ville |
|---------|------|-----------|--------|----------------|
| Évitement article courant | ✅ | ✅ | N/A | N/A |
| Même verticale prioritaire | ✅ partiel (catégorie) | ✅ (catégorie) | ❌ absent | ❌ absent |
| Même cible client (TPE/PME/ETI) | ❌ absent | N/A | ❌ absent | ❌ absent |
| Limitation 3-4 max | ❌ (2 seulement) | ✅ (5 max) | N/A | N/A |
| Source DB articles | ❌ BLOG_POSTS FS seulement | N/A | ❌ | ❌ |

**Problème critique** : le bloc "Articles connexes" du blog est sourcé depuis `BLOG_POSTS` (3 articles hardcodés en filesystem, `content/transversal.ts`). Les articles générés par le content-gen et stockés en DB ne sont **jamais suggérés**. Il y a une note explicite dans le code : `// Reste sourcé FS V1 (les articles DB n'ont pas encore de catégorie structurée — Sprint 9+)`.

Pour les **guides pilier**, les **landings ville**, et la **page comparaison** : aucun bloc "articles suggérés" ni "voir aussi" lié au content-gen.

#### Rendu frontend

**Composant `ArticleCard`** (`components/marketing/ArticleCard.tsx`) :
- Rendu : titre + excerpt (line-clamp-3) + date + readingTime
- Pas d'image miniature (props `href`, `title`, `excerpt`, `publishedAt`, `readingTime`, `className` — aucun `image`)
- CTA implicite via le `<Link>` wrappeur, pas de "Lire la suite" explicite
- Aucun JSON-LD `ItemList` ni `isPartOf` sur le bloc suggestions

**Composant glossaire** : liste textuelle simple (terme → snippet 100 chars), pas de card visuelle.

#### Schema JSON-LD suggestions

Aucun `ItemList` ou `isPartOf` implémenté sur les sections "Articles connexes". Le JSON-LD de la page blog (`buildArticleJsonLd`) ne référence pas les articles connexes. Lacune AEO/GEO.

---

### Flux complet liens : génération → injection → rendu

```
GÉNÉRATION (LLM)
  ├─ System prompt : "produis bodyHtml + liens" (aucune URL cible fournie)
  ├─ LLM génère HTML avec éventuellement <a href="/guides/..."> ou [md](/)
  └─ Citations Perplexity → citationsArray (URLs brutes, non injectées dans HTML)
         ↓
SANITIZATION (html-sanitizer.ts)
  ├─ DOMPurify whitelist : conserve <a href> si href = https|http|mailto|tel|/#?
  ├─ Force rel="noopener noreferrer" sur target="_blank"
  └─ ⚠️ URI safe : ALLOWED_URI_REGEXP = /^(?:(?:https?|mailto|tel):|[/#?])/i
       → Les liens relatifs internes /fr/... sont AUTORISÉS ✅
       → Les liens /guides/... etc sont AUTORISÉS ✅
         ↓
COMPTAGE (générateurs)
  ├─ regex markdown /\[.*?\]\(\/[^)]+\)/g appliqué sur bodyHtml (HTML)
  ├─ → RETOURNE 0 si le LLM a généré <a href="..."> (HTML, pas Markdown)
  └─ internalLinkCount → computeSeoScore() → scoreInternalLinks()
         ↓
PERSISTANCE (DB Article)
  ├─ bodyHtml (HTML avec liens éventuels) → Article.translations.body
  ├─ citations[] → aucun champ Article pour les stocker (gap schema)
  └─ internalLinkCount → NON persisté dans Article (non présent dans schema)
         ↓
RENDU (page /blog/[slug]/page.tsx)
  ├─ view.body chargé depuis DB ou FS
  ├─ parseBody() : split en blocs p/ol — les liens HTML dans le body sont PERDUS
  │    (parseBody n'est appliqué que sur les articles FS, pas sur bodyHtml DB)
  ├─ bloc "Articles connexes" (2 articles FS BLOG_POSTS seulement)
  └─ CtaBlock /interventions/essentielle fixe (pas contextuel)
```

**Conclusion flux** : les liens internes générés par le LLM (si présents dans le HTML) **survivent à la sanitization** mais le comptage est systématiquement faux (regex Markdown sur HTML). Le rendu DB articles (`view.body`) utilise `parseBody()` qui strip les tags HTML en texte pur, ce qui **détruit** les liens `<a href>` dans les articles DB.

---

### Recommandations

#### P0 — Bloquants (correction immédiate)

**P0-1 : Bug regex internalLinkCount** (4 générateurs, impact score SEO)
```typescript
// ACTUEL (faux) — cherche Markdown dans du HTML
const internalLinkCount = ((parsed.bodyHtml ?? "").match(/\[.*?\]\(\/[^)]+\)/g) ?? []).length;

// CORRIGÉ — cherche <a href="/..."> dans HTML
const internalLinkCount = ((parsed.bodyHtml ?? "").match(/<a\s[^>]*href=["']\/[^"']+["'][^>]*>/gi) ?? []).length;
```
Fichiers : `blog-article.ts:154+211`, `blog-from-keywords.ts:155+236`, `landing-ville.ts:162`, `guide-pilier.ts:278`

**P0-2 : citationCount jamais passé à computeSeoScore()**
```typescript
// Ajouter dans tous les générateurs après calcul des citations :
citationCount: lastCitations.length,
```
Fichiers : `blog-article.ts:214`, `blog-from-keywords.ts:239`, `guide-pilier.ts:281`, `landing-ville.ts:165`

**P0-3 : parseBody() détruit les liens HTML dans articles DB**
La fonction `parseBody()` (blog/[slug]/page.tsx) convertit le body HTML en texte via split sur phrases. Pour les articles DB (source: "db"), le `bodyHtml` doit être rendu via `dangerouslySetInnerHTML` (ou un renderer Markdown→HTML), pas via `parseBody()`.
```typescript
// Condition de rendu à ajouter :
if (view.source === "db") {
  // Render bodyHtml directement
} else {
  // parseBody() pour FS legacy
}
```

#### P1 — Importants (~1 sprint)

**P1-1 : Aucune injection de liens internes post-LLM**
Créer un module `src/server/content-gen/shared/internal-link-injector.ts` qui :
1. Maintient un catalogue des pages existantes (slug → path → label)
2. Injecte des ancres contextuelles sur les termes du glossaire et les verticales Axion-IA
3. Respecte des minima par type : article ≥ 3, landing ≥ 5, guide ≥ 8

**P1-2 : Minima différenciés par contentKind dans scoreInternalLinks()**
```typescript
function scoreInternalLinks(count: number | undefined, kind?: string): { got: number; reason?: string } {
  const n = count ?? 0;
  const min = kind === "guide" ? 8 : kind === "landing" ? 5 : 3;
  if (n >= min) return { got: 6 };
  if (n >= 1) return { got: 3, reason: `${n} liens internes (cible ${min}+)` };
  return { got: 0, reason: `Pas de liens internes (cible ${min}+)` };
}
```

**P1-3 : Citations Perplexity → liens HTML dans bodyHtml**
Les citations Perplexity doivent être injectées comme références numérotées `[1]` dans le body et un bloc `<section class="sources">` en fin d'article.

**P1-4 : Articles connexes DB (pas seulement FS BLOG_POSTS)**
Le bloc "Articles connexes" dans `/blog/[slug]` doit interroger la table `Article` DB pour les articles de même catégorie/secteur, pas seulement les 3 articles hardcodés FS.

**P1-5 : Suggérer des articles dans les guides pilier et landings ville**
Actuellement aucun bloc "Voir aussi" dans ces types de contenu. Ajouter au moins :
- Guide pilier → articles blog même verticale
- Landing ville → autres services Axion-IA pour la même ville

#### P2 — Souhaitable

**P2-1 : JSON-LD ItemList sur le bloc "Articles connexes"**
```typescript
const relatedJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "Articles connexes",
  "itemListElement": related.map((p, idx) => ({
    "@type": "ListItem",
    "position": idx + 1,
    "url": `${SITE_URL}/${locale}/blog/${p.slug}`,
  })),
};
```

**P2-2 : Image miniature dans ArticleCard**
Le composant `ArticleCard` n'a pas de prop `image`. Ajouter `featuredImage?` pour enrichir le rendu des suggestions (meilleur engagement CTR).

**P2-3 : search_domain_filter Perplexity pour sources d'autorité**
Dans `perplexity.ts:139`, le commentaire indique que `search_domain_filter` est prévu "V2". L'implémenter pour cibler `insee.fr`, `bpifrance.fr`, `ademe.fr`, `gouvernement.fr`.

**P2-4 : Persistance citations dans Article**
Ajouter un champ `citationsJson Json?` dans le modèle `Article` Prisma pour stocker les citations Perplexity et les afficher en bas d'article comme sources officielles.

---

### Synthèse scoring

| Critère | Max | Obtenu | Justification |
|---------|-----|--------|---------------|
| **Liens internes** | | | |
| Module injection actif | 10 | 0 | Inexistant — comptage passif seul |
| Injection dans HTML final | 8 | 2 | Via LLM non guidé, détruites par parseBody() |
| Liens vers pages réelles | 6 | 1 | Aucune vérification d'existence |
| Stratégie de sélection | 6 | 0 | Aucune (aléatoire LLM) |
| **Sous-total liens internes** | **30** | **11** | |
| **Liens externes** | | | |
| Citations générées | 8 | 5 | Infrastructure Perplexity présente |
| rel="noopener noreferrer" | 7 | 7 | Implémenté correctement (2 couches) |
| Vérification URLs expirées | 5 | 0 | Absent |
| Minima par type | 5 | 0 | Non différencié |
| **Sous-total liens externes** | **25** | **12** | |
| **Suggested content** | | | |
| Module suggestions présent | 8 | 6 | Blog + glossaire OK, guides/landings absent |
| Logique de suggestion | 8 | 3 | Catégorie seule, articles DB exclus |
| Rendu frontend composant | 5 | 2 | ArticleCard sans image, pas d'ItemList |
| Schema JSON-LD suggestions | 4 | 0 | Absent |
| **Sous-total suggested** | **25** | **11** | |
| **TOTAL** | **80** | **34** | |

**Verdict : 34/80 — SPRINT CORRECTIF MAJEUR**

Les lacunes les plus critiques sont structurelles : pas d'injection de liens internes, compteur faux (regex Markdown sur HTML), citations non utilisées dans le score SEO, et articles DB exclus des suggestions. Les P0 peuvent être corrigés en ~4h. Le P1 complet (module injection + DB suggestions) représente ~2-3 jours de sprint.
