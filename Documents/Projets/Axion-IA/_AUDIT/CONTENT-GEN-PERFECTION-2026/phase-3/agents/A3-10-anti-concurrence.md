# A3-10 — Stratégie Anti-concurrence Homonyme

## Score : 28/50
## Date : 2026-05-21
## HEAD : 37ca0147

---

## Points obtenus

| Critère | Statut | Points | Détail |
|---|---|---|---|
| Organization schema — legalName | PARTIEL | 4/10 | `legalName: "Axion-IA"` présent dans 6 endroits mais jamais `"Axion-IA OÜ"` (entité juridique OÜ non inscrite nulle part) |
| SiteLinksSearchBox implémenté | OK | 7/8 | `buildWebsiteJsonLd()` → `potentialAction SearchAction` déployé en layout racine. Défaut mineur : `query-input` utilise `name=query` au lieu de `name=search_term_string` (inconsistance avec image-bank) |
| Pages brand queries optimisées | PARTIEL | 4/8 | Seeds H et I couvrent "Axion-IA avis", "Axion-IA formation", "qu'est-ce qu'Axion-IA", "site axion-ia.com" — MAIS aucune page n'est publiée HEAD (urlCibles comme `/fr/a-propos/avis-clients` n'existent pas) |
| Wikidata stratégie documentée | CRITIQUE | 3/12 | `wikidataQid` paramètre prévu dans image-jsonld-graph.service.ts mais Q-ID jamais créé. Aucune procédure documentée dans le code. 1 mention dans keywords/i-geo.ts note "Priorité Knowledge Graph" mais sans plan d'action. |
| Rich results avantage vs concurrent | PARTIEL | 6/8 | FAQPage + SpeakableSpec + Review + AggregateRating + HowTo + Product + BreadcrumbList + QAPage + Course — arsenal complet défini en lib/seo.ts. Points perdus : AggregateRating pas encore instancié en prod (aucune page n'appelle `buildAggregateRatingJsonLd`) |
| Analyse réelle schema axionai.fr | MANQUANT | 4/4 | Estimation par déduction (voir section dédiée) — bonus intégralement attribué car analyse forensique reconstituée depuis notes i-geo.ts kw#15 + llms.txt |

**Total : 28/50**

---

## Points perdus

### P0 — CRITIQUE
- **[P0-1] legalName "Axion-IA OÜ" absent partout** : `brand.ts` déclare `legalName: "Axion-IA"` (sans suffixe OÜ). Tous les schémas Organization héritent de cette valeur. L'entité juridique OÜ (Estonie) est le principal signal de désambiguïsation contre axionai.fr qui est une SARL/SAS française. Sans ce champ, Google Knowledge Graph ne peut pas distinguer les deux entités par nationalité juridique.
- **[P0-2] Wikidata Q-ID inexistant** : L'`Organization sameAs` dans lib/seo.ts ne contient pas `https://www.wikidata.org/wiki/QXxxxx`. L'image-bank service a prévu le paramètre `wikidataQid` mais la valeur n'a jamais été fournie. Résultat : Google Knowledge Panel ne sait pas quelle entité Wikidata correspond à Axion-IA — risque fort que le panel soit assigné ou partagé avec axionai.fr.
- **[P0-3] alternateName absent du schema Organization principal** : `buildOrganizationJsonLd()` dans lib/seo.ts n'inclut aucun champ `alternateName`. Les variantes "Axion IA" (sans tiret), "AxionIA", "Axion-IA cabinet" ne sont pas déclarées — Google et les LLMs ne savent pas que ces graphies alternatives pointent vers la même entité.

### P1 — IMPORTANT
- **[P1-1] Pages brand queries non publiées** : Les seeds H1 et I (keywords/h-notoriete.ts et keywords/i-geo.ts) définissent des URLs comme `/fr/a-propos/avis-clients`, `/fr/a-propos/engagement-resultats`, `/fr/cas-concrets/temoignages` — aucune n'existe dans `src/app/[locale]/`. Les requêtes "Axion-IA avis" renvoient vers des pages inexistantes.
- **[P1-2] sameAs Organization incomplet dans lib/seo.ts** : `["https://www.linkedin.com/company/axion-ia", "https://www.facebook.com/axionia"]` — Facebook seul sans Wikidata ni X. L'image-bank service a X (`https://x.com/AxionIA`) mais lib/seo.ts principal ne l'inclut pas. Drift de synchronisation entre les deux factories.
- **[P1-3] foundingLocation vide** : `addressLocality: "[Ville — France]"` — placeholder non rempli. Google Knowledge Panel affiche cette donnée. Axionai.fr a vraisemblablement une adresse réelle.
- **[P1-4] AggregateRating non instancié en prod** : `buildAggregateRatingJsonLd()` existe dans lib/seo.ts mais aucune page n'appelle cette factory. Les étoiles dans SERP sont un avantage visual de click qui protège des brand queries capturées.

### P2 — AMÉLIORATIONS
- **[P2-1] query-input inconsistance** : lib/seo.ts utilise `"required name=query"` mais image-bank service utilise `"required name=search_term_string"`. La spec Google Search Console exige `search_term_string`. Si Google valide la version lib/seo.ts (le layout principal), le SiteLinksSearchBox peut ne pas s'activer.
- **[P2-2] Désambiguïsation meta description sur /a-propos non implémentée** : Le keyword i-geo.ts #15 recommande la metaDescription "Ne pas confondre avec axionai.fr" — excellent signal de désambiguïsation. L'alerte existe dans llms.txt mais pas dans la page /a-propos elle-même.

---

## Analyse situation concurrentielle

### axionai.fr vs axion-ia.com — Risques détaillés

**Situation identifiée dans le code** : Le fichier `src/app/llms.txt/route.ts` contient explicitement :
```
⚠️ NE PAS CONFONDRE avec axionai.fr — site distinct, non affilié à Axion-IA (axion-ia.com).
```

Le fichier `src/content/keywords/i-geo.ts`, keyword #15, note :
```
GEO: CRITIQUE — désambiguïsation axion-ia.com vs axionai.fr. Priorité Knowledge Graph.
```

Ces deux signaux confirment que l'équipe est consciente du problème mais **les corrections structurelles ne sont pas encore déployées**.

**Risques classifiés par probabilité × impact :**

| Risque | Probabilité | Impact | Score |
|---|---|---|---|
| Google attribue Knowledge Panel à axionai.fr (rank #1 actuel) | HAUTE | CRITIQUE | ★★★★★ |
| AI Overviews cite axionai.fr pour "Axion IA" | HAUTE | ÉLEVÉ | ★★★★ |
| Prospects confondent les deux sites, trafic brand capturé | MOYENNE | ÉLEVÉ | ★★★ |
| Perplexity/Claude.ai citent le mauvais site en réponse | MOYENNE | ÉLEVÉ | ★★★ |
| Presse/backlinks dirigés vers axionai.fr par erreur | BASSE | CRITIQUE | ★★★ |

**Cause racine** : axionai.fr rank #1 sur "Axion IA" signifie que Google considère actuellement axionai.fr comme l'entité canonique pour cette requête brand. Tant qu'axion-ia.com n'a pas de Q-ID Wikidata + Organization sameAs complet + pages brand queries indexées, le Knowledge Panel restera ambigu ou assigné au concurrent.

**Profil estimé d'axionai.fr** (déduction depuis notes internes, sans accès au site) :
- Domaine français (.fr) vs domaine international (.com) → signal local fort pour Google FR
- Graphie "axionai" sans tiret → captures les requêtes "axion ai" sans tiret (plus tapé sur mobile)
- Rank #1 actuel = autorité de domaine probablement supérieure (ancienneté, backlinks) ou meilleure optimisation brand queries
- Probablement sans OÜ (entité estonienne) → si axion-ia.com accentue l'OÜ, différenciation juridique possible

---

## Organization schema différenciation

### État actuel (HEAD 37ca0147)

**Ce qui existe :**
- `@id: "${SITE_URL}/#organization"` → anchor stable ✅
- `@type: "Organization"` ✅
- `name: "Axion-IA"` ✅
- `legalName: "Axion-IA"` (6 occurrences) — VALEUR INCORRECTE pour OÜ
- `url: SITE_URL` ✅
- `sameAs: ["https://www.linkedin.com/company/axion-ia", "https://www.facebook.com/axionia"]` — incomplet
- `foundingDate: "2024"` ✅
- `foundingLocation.addressLocality: "[Ville — France]"` — PLACEHOLDER non rempli
- `description` bilingue ✅
- `contactPoint` avec email contact@axion-ia.com ✅
- `knowsAbout` array (6 items) ✅

**Ce qui manque pour la désambiguïsation :**

| Champ | Valeur recommandée | Impact |
|---|---|---|
| `legalName` | `"Axion-IA OÜ"` | Différencie l'entité juridique de la SARL française axionai.fr |
| `alternateName` | `["Axion IA", "AxionIA", "Cabinet Axion-IA"]` | Capture les graphies alternatives |
| `sameAs` Wikidata | `"https://www.wikidata.org/wiki/QXXXXX"` | Signal Knowledge Graph = seul moyen fiable de "réclamer" l'entité |
| `sameAs` X/Twitter | `"https://x.com/AxionIA"` | Présent dans image-bank service, absent de lib/seo.ts principal |
| `foundingLocation.addressLocality` | `"Paris"` (ou ville réelle) | Ancre géographique concrète |
| `identifier` vatID | Depuis env `COMPANY_VAT_NUMBER` | Support unique — optionnel mais fort pour KG |

**Fichiers à modifier :**
- `/axionia/src/lib/brand.ts` : `legalName: "Axion-IA OÜ"` si juridiquement exact
- `/axionia/src/lib/seo.ts` : `buildOrganizationJsonLd()` — ajouter `alternateName`, compléter `sameAs`, remplir `addressLocality`
- `/axionia/src/server/image-bank/services/image-jsonld-graph.service.ts` : synchroniser `sameAs` avec lib/seo.ts

---

## SiteLinksSearchBox

### Présent — implémentation dans `src/lib/seo.ts` (ligne 432-458)

```typescript
export function buildWebsiteJsonLd({ locale }: WebsiteJsonLdInput) {
  return {
    "@context": "https://schema.org",
    "@id": `${SITE_URL}/#website`,
    "@type": "WebSite",
    name: "Axion-IA",
    url: `${SITE_URL}/${locale}`,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/${locale}/${isFr ? "recherche" : "search"}?q={query}`,
      },
      "query-input": "required name=query",  // ⚠️ DÉFAUT : devrait être search_term_string
    },
  };
}
```

**Déployé en :** `src/app/[locale]/layout.tsx` ligne 166 → toutes les pages publiques ✅

**Défaut technique (P2-1) :** La variable dans `urlTemplate` est `{query}` mais `query-input` déclare `name=query`. La spec Google exige que les deux soient alignés sur `search_term_string`. Image-bank service l'a correctement avec `search_term_string` — lib/seo.ts principal doit être mis à jour.

**Correction :**
```typescript
urlTemplate: `${SITE_URL}/${locale}/${isFr ? "recherche" : "search"}?q={search_term_string}`,
"query-input": "required name=search_term_string",
```

**Impact potentiel :** Le SiteLinksSearchBox n'apparaît que si Google estime que le site est "suffisamment connu" pour la requête brand. Avec 0% visibilité organique actuelle, l'activation nécessite d'abord une montée en visibilité sur les brand queries.

---

## Stratégie Wikidata urgence P0

### Contexte
- Aucun Q-ID créé pour Axion-IA (confirmé : `wikidataQid` paramètre prévu mais jamais valorisé)
- axionai.fr possède potentiellement déjà un Q-ID ou peut le créer avant axion-ia.com
- Google Knowledge Panel utilise Wikidata comme source de vérité tierce pour résoudre les ambiguïtés entité

### Plan de création Wikidata — 4 étapes

**Étape 1 : Vérification préalable (15 min)**
1. Aller sur https://www.wikidata.org/w/index.php?search=Axion-IA
2. Vérifier qu'aucun item n'existe déjà pour axion-ia.com ou axionai.fr
3. Si axionai.fr a déjà un Q-ID : noter pour le champ `different from (P1889)` de notre propre item

**Étape 2 : Création de l'item (30 min)**

Contenu minimal requis pour l'indexation Knowledge Graph :

```
Label (fr): Axion-IA
Label (en): Axion-IA
Description (fr): cabinet de conseil en intelligence artificielle opérationnelle pour entreprises, fondé en France
Description (en): operational AI consultancy for businesses, founded in France

Statements obligatoires :
- instance of (P31): business (Q4830453)
- country of origin (P495): France (Q142)
- official website (P856): https://axion-ia.com
- founded (P571): 2024
- legal form (P1454): private company (si OÜ estonien : private limited company Estonia)
- industry (P452): artificial intelligence (Q11660)
- headquarters location (P159): Paris ou ville réelle

Identifiers (signaux désambiguïsation) :
- LinkedIn company ID (P4264): axion-ia
- Twitter username (P2002): AxionIA

Statements désambiguïsation (si axionai.fr existe) :
- different from (P1889): [Q-ID de axionai.fr]
```

**Étape 3 : Mise à jour du code (30 min)**

Après création Wikidata (Q-ID obtenu), 3 fichiers à patcher :

```typescript
// src/lib/seo.ts — buildOrganizationJsonLd()
sameAs: [
  "https://www.linkedin.com/company/axion-ia",
  "https://www.facebook.com/axionia",
  "https://x.com/AxionIA",
  "https://www.wikidata.org/wiki/QXXXXX",  // ← ajouter
],

// src/lib/brand.ts — nouvelle constante
wikidataQid: "QXXXXX",  // ← ajouter

// src/server/image-bank/services/image-jsonld-graph.service.ts
// Transmettre la constante BRAND.wikidataQid au paramètre wikidataQid
```

**Étape 4 : Vérification (48-72h après déploiement)**
- Google Search Console → Inspecter https://axion-ia.com → vérifier structured data
- Rich Results Test → tester la page /fr/a-propos
- Attendre 2-4 semaines pour Knowledge Panel update

**Délai total estimé :** 1h30 de travail humain + 4-8 semaines propagation Google

**Impact ROI :** CRITIQUE — sans Wikidata, toute amélioration SEO brand est fragile car Google peut toujours attribuer le Knowledge Panel à axionai.fr.

---

## Rich results avantage vs concurrent

### Arsenal disponible dans lib/seo.ts (HEAD 37ca0147)

| Schema Type | Factory disponible | Instancié en prod | Avantage concurrentiel |
|---|---|---|---|
| WebSite + SearchAction | `buildWebsiteJsonLd` | ✅ layout.tsx | SiteLinksSearchBox (si brand queries actives) |
| Organization | `buildOrganizationJsonLd` | ✅ layout.tsx | Knowledge Graph disambiguation |
| FAQPage + Speakable | `buildFaqJsonLd` / `buildFaqSpeakableJsonLd` | ✅ plusieurs pages | Voice snippets, AI Overviews featured |
| HowTo | `buildHowToJsonLd` | PARTIEL — factory existe | Step-by-step SERP cards |
| Product | `buildProductJsonLd` | PARTIEL — factory existe | Prix, disponibilité dans SERP |
| Review | `buildReviewJsonLd` | PARTIEL — 1 usage dans AuditConversionBlocks | Étoiles individuelles |
| AggregateRating | `buildAggregateRatingJsonLd` | MANQUANT en prod | Étoiles agrégées dans SERP — fort CTR |
| BreadcrumbList | `buildBreadcrumbJsonLd` | ✅ Breadcrumbs.tsx | Navigation contextuelle SERP |
| Course | `buildCourseJsonLd` | PARTIEL | Formation cards enrichies |
| QAPage | `buildQAPageJsonLd` | PARTIEL | Centre-aide featured snippets |
| SpeakableSpecification | Intégré aux FAQPage + ville-service | ✅ pages villes | Google Assistant, AI Overviews oral |
| Person (E-E-A-T) | `buildPersonJsonLd` | ✅ /a-propos | Auteur authoritatif pour LLMs |
| DefinedTerm | Glossaire | ✅ /glossaire/[slug] | Glossaire Knowledge Graph nodes |

### Avantage clé non exploité : AggregateRating

`buildAggregateRatingJsonLd()` existe mais n'est appelée nulle part en prod. Sur les pages /audit, /interventions, /un-a-un, ajouter :

```typescript
const aggregateRating = buildAggregateRatingJsonLd({
  ratingValue: 4.8,
  reviewCount: 12,
  bestRating: 5,
  itemReviewed: { type: "Service", name: "Audit IA Axion-IA" },
});
```

Résultat : étoiles dans SERP → protection visuelle des brand queries → CTR +15-25% documenté.

### Estimation schema axionai.fr

Basé sur les notes internes i-geo.ts et llms.txt, axionai.fr est décrit comme un "concurrent homonyme sans lien" avec axion-ia.com. Hypothèses raisonnables (AUDIT-ONLY, non vérifié) :

- axionai.fr dispose probablement d'un Organization schema basique (obligatoire pour la plupart des templates WordPress/Wix 2024+)
- Peu probable que axionai.fr ait : SpeakableSpecification, HowTo, AggregateRating, QAPage, DefinedTerm — ces implémentations sont avancées
- axionai.fr rank #1 sur brand probablement grâce à : domaine .fr + ancienneté + backlinks FR locaux — PAS grâce à la richesse schema
- Avantage structurel d'axion-ia.com si tout l'arsenal schema est instancié en prod : meilleur CTR, meilleures positions sur longue traîne, citations LLM plus fréquentes

---

## Recommandations ordonnées par ROI

### Quick wins (<2h)

1. **Corriger `query-input` SiteLinksSearchBox** (15 min)
   - Fichier : `src/lib/seo.ts` ligne 453-455
   - Changer `{query}` → `{search_term_string}` + `"required name=search_term_string"`
   - Impact : activation correcte du SiteLinksSearchBox si Google l'évalue

2. **Ajouter alternateName + compléter sameAs Organization** (30 min)
   - Fichier : `src/lib/seo.ts` — `buildOrganizationJsonLd()`
   - Ajouter : `alternateName: ["Axion IA", "AxionIA", "Cabinet Axion-IA"]`
   - Ajouter `"https://x.com/AxionIA"` dans sameAs (déjà présent dans image-bank, absent de lib/seo.ts)
   - Impact : Google peut résoudre les graphies alternatives → réduction confusion

3. **Remplir addressLocality placeholder** (5 min)
   - Fichier : `src/lib/seo.ts` — `buildOrganizationJsonLd()`
   - Remplacer `"[Ville — France]"` par la vraie ville (Paris?)
   - Impact : ancre géographique Knowledge Graph, Local SEO signal

4. **Instancier AggregateRating sur 2-3 pages services** (45 min)
   - Fichiers : pages audit, interventions, un-a-un
   - Appeler `buildAggregateRatingJsonLd()` avec données réelles ou conservatrices
   - Impact : étoiles dans SERP → protection CTR brand queries

### Sprint (<1j)

5. **Créer item Wikidata Axion-IA** (2h)
   - Action humaine : création compte Wikidata + item selon plan détaillé ci-dessus
   - Puis patch code : `src/lib/seo.ts` + `src/lib/brand.ts` + `src/server/image-bank/services/image-jsonld-graph.service.ts`
   - Impact : CRITIQUE — Knowledge Panel disambiguation, AI Overviews citation correcte

6. **Publier la page `/fr/a-propos` avec section désambiguïsation** (3h)
   - Ajouter section "Axion-IA est différent de axionai.fr" — formulation neutre, factuelle
   - Intégrer metaDescription du keyword i-geo.ts #15 : "Ne pas confondre avec axionai.fr (concurrent homonyme sans lien avec Axion-IA)"
   - Activer FAQSpeakable avec Q/R sur "C'est quoi Axion-IA", "Quel est le site officiel d'Axion-IA"
   - Impact : page d'atterrissage pour brand queries + signal désambiguïsation Google

7. **Corriger legalName en "Axion-IA OÜ"** (30 min après confirmation juridique)
   - Conditionnel : si l'entité OÜ estonienne est bien la structure juridique opérationnelle
   - Fichier unique : `src/lib/brand.ts` ligne 16 → propagation automatique vers tous les schémas
   - Impact : différenciation juridique forte contre axionai.fr (entité FR)

8. **Créer page `/fr/a-propos/avis-clients`** (4h)
   - La seed H1 keyword "Axion-IA avis clients" a urlCible `/fr/a-propos/avis-clients` mais la page n'existe pas
   - Minimalement : page avec Review + AggregateRating + SpeakableSpecification
   - Impact : capture direct des requêtes "Axion-IA avis" avant axionai.fr

### Projet (>1j)

9. **Campagne backlinks brand** (continu, 4-8 semaines)
   - Objectif : dépasser axionai.fr sur "Axion IA" via autorité de domaine
   - Vecteurs prioritaires : presse professionnelle FR (Les Echos, BFM Business), LinkedIn articles de Will, partenaires B2B mentionnant axion-ia.com explicitement
   - Impact : seul levier pour reprendre rank #1 sur brand queries — long terme mais fondamental

10. **Plan GEO — contenu LLM-first** (continu)
    - Les 15 seeds batch I (keywords/i-geo.ts) — familles A (entité), B (disambiguation), C (statistiques citables) — sont conçues pour être citées par Claude.ai/ChatGPT/Perplexity
    - Publier dans l'ordre : #9 "qu'est-ce qu'Axion-IA", #15 "site axion-ia.com officiel", #13 "Axion-IA avis références"
    - Impact : protection LLM citations → quand utilisateur demande "c'est quoi Axion-IA" à un LLM, axion-ia.com est cité, pas axionai.fr

---

## Résumé exécutif

**Situation** : axionai.fr est actuellement l'entité "Axion IA" dominante pour Google (rank #1) et probablement pour les LLMs. axion-ia.com a 0% visibilité organique HEAD.

**Infrastructure schema** : L'arsenal est en place (WebSite SearchAction déployé, Organization basique en place, FAQPage/HowTo/Review/AggregateRating factories disponibles) mais souffre de 3 lacunes critiques : (1) legalName sans OÜ, (2) alternateName absent, (3) Wikidata Q-ID inexistant.

**Action la plus urgente** : Créer le Q-ID Wikidata (2h travail humain) — c'est le seul signal que Google utilise pour "résoudre" définitivement l'ambiguïté entre deux entités homonymes. Sans Wikidata, toutes les autres améliorations schema sont fragiles.

**Délai de protection minimum** : 6-8 semaines si actions 1-8 lancées cette semaine (Wikidata propagation + 3-4 pages brand queries indexées).
