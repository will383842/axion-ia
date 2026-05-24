# A3-08 — E-E-A-T Signals
## Score : 56/80
## Date : 2026-05-21
## HEAD : 37ca0147

---

### Points obtenus

| Critère | Statut | Points |
|---------|--------|--------|
| Experience — données propriétaires / cas réels | PARTIEL | 6/10 |
| Expertise — personas auteurs crédibles | PARTIEL | 8/12 |
| Autorité — backlinks FR autorité (vérification meta) | MANQUANT | 3/10 |
| Fiabilité — AI Act disclaimer visible | OK | 10/10 |
| Fiabilité — mentions légales / CGV accessibles | OK | 5/5 |
| Fraîcheur — dateModified JSON-LD + affichage | OK | 9/10 |
| Person JSON-LD auteur complet + sameAs | PARTIEL | 8/12 |
| External links autorité (≥ 2/article) | MANQUANT | 2/8 |
| HTTPS + certificat (check config) | OK | 3/3 |
| **TOTAL** | | **54/80** |

> Ajustement final après analyse de profondeur : **54/80** (67,5 %)

---

### Points perdus

- **[P1]** `AuthorByline` composant créé (`src/components/knowledge/public/AuthorByline.tsx`) mais **jamais importé dans aucune page applicative** (`/blog/[slug]`, `/actualites/[slug]`, `/guides/[slug]`, `/centre-aide/[slug]`) — Person JSON-LD inline du composant donc absent du rendu final sur les pages articles (-4 pts Expertise)
- **[P1]** `sameAs[]` vide dans `buildPersonManonJsonLd` (doctrine v2.1 zéro réseau social) — Google ne peut pas corroborer l'entité Manon via une source tierce autoritaire (-2 pts Expertise)
- **[P0]** Aucun backlink FR autorité détecté dans le code source (bfmtv, lesechos, journaldunet, 01net, numerama absents hors fixtures de test) — les citations dans `seo-content-gen-factories.test.ts` / `rss2.xml` sont des données de test, pas des backlinks réels (-7 pts Autorité)
- **[P2]** Manon unique auteur canonique — pas de deuxième persona ou auteur humain nommé (Will) sur les articles publiés ; `buildPersonJsonLd` pour Will existe mais n'est utilisé que sur `/blog/auteur/will`, pas injecté dans les articles générés (-2 pts Expertise)
- **[P1]** External links autorité dans le HTML généré : la règle LLM impose "0 lien externe" implicitement (SYSTEM_PROMPT dans `blog-from-keywords.ts`, `blog-article.ts`) — aucune instruction d'ajouter ≥ 2 liens sortants vers INSEE, Légifrance, etc. dans le body HTML. Le `buildCitationArray` existe dans le JSON-LD machine mais est rarement alimenté côté générateurs (-6 pts External links)
- **[P2]** `dateModified` affiché visuellement absent sur `/blog/[slug]` — la `lastReviewedAt` dans `AuthorByline` aurait couvert cela mais le composant n'est pas utilisé dans les pages articles (-1 pt Fraîcheur)

---

### Analyse Experience

**Données propriétaires présentes — partiellement exploitées dans les templates**

Points forts :
- 5 cas concrets dans `src/content/case-studies.ts` avec métriques réelles (-32% admin, +18% productivité, etc.), témoignages nominatifs (C. Lambert DAF, M. Petit COO), coordonnées WGS84, secteur, taille entreprise. `buildReviewJsonLd` émet un JSON-LD `Review` avec ratingValue 5 et reviewBody complet.
- 39 fichiers `economic-data/<slug>.ts` sourcés INSEE, Légifrance, Wikipédia (données vérifiables + champ `verifiedOn`).
- KB interne (`kb-client`) : les générateurs récupèrent 8 chunks type `industry_use_case`, `case_study`, `methodology` pour contextualiser chaque article. C'est un signal Experience fort mais la valeur dépend du contenu semé dans la KB.

Points faibles :
- Les générateurs LLM (SYSTEM_PROMPT `blog-from-keywords`, `blog-article`) prescrivent un "angle opérationnel / retour terrain" mais **ne forcent pas la citation explicite d'un cas concret Axion-IA** avec chiffres. Le contexte KB est passé en prompt mais l'extraction n'est pas garantie.
- Pas de benchmarks propriétaires sectoriels (coûts IA réels, ROI médian par secteur) dans les templates de génération — données agrégées prometteuses non encore codifiées en blocs réutilisables.
- Aucune page `/etudes` ou `/resultats` agrégeant les KPI de missions livrées en données de panel.

---

### Analyse Expertise (personas auteurs)

**Infrastructure solide, déploiement incomplet sur les pages articles**

Infrastructure en place :
- `AuthorProfile` table Prisma : `displayName`, `jobTitle`, `bioMd`, `photoUrl80/256/1024`, `aiGenerated`, `linkedinUrl`, `alumniOf`, `awards`, `knowsAbout`, `isPersona`, `personaDisclaimer`, `isActive`.
- `buildPersonManonJsonLd()` (`src/lib/seo-content-gen-factories.ts`) : Person JSON-LD complet avec `@id` stable, `disambiguatingDescription`, `aiGenerated: true`, `knowsAbout[]`, `worksFor`, `knowsLanguage`. Conforme Schema.org 2026 + AI Act.
- `AuthorByline` composant (`src/components/knowledge/public/AuthorByline.tsx`) : bloc visuel auteur avec avatar, bio courte, `publishedAt`, `lastReviewedAt`, `factChecked`, Person JSON-LD inline.
- `/equipe/manon` page publique : photo, bio Markdown, domaines d'expertise, banner "Transparence IA" visible si `isPersona && aiGenerated`.
- `/blog/auteur/[slug]` page : ProfilePage JSON-LD + Person JSON-LD (Will) avec `sameAs: linkedin`, `knowsAbout[]` complet.
- `buildPersonJsonLd()` pour Will inclut `sameAs: ["https://www.linkedin.com/in/will-axion-ia"]`, garde-fou PERSONA_SLUGS refuse les personas IA.

Lacunes critiques :
- **`AuthorByline` n'est utilisé dans aucune route publique article** — grep sur `src/app/` retourne 0 fichier. Le composant est créé mais pas encore intégré aux pages `/blog/[slug]`, `/actualites/[slug]`, `/guides/[slug]`, `/centre-aide/[slug]`. Google ne voit donc pas le bloc auteur E-E-A-T visuel (ni le Person JSON-LD inline).
- Manon sans `sameAs[]` — absence délibérée (doctrine v2.1), mais prive Google d'un signal d'identité corroboré. Un lien vers la page `/equipe/manon` dans `url:` + `@id` stable suffit pour l'instant.
- `alumniOf` et `awards` sont des champs Prisma mais vides en seed — aucune formation ou certification n'est documentée dans le profil.

---

### Analyse Authoritativeness

**Absence de backlinks FR autorité vérifiable dans le code**

- `sameAs` de l'Organization : `linkedin.com/company/axion-ia` + `facebook.com/axionia` — deux réseaux sociaux, pas de mention dans la presse.
- Recherche dans `src/` sur bfmtv, lesechos, journaldunet, lefigaro, lemonde, leparisien, numerama, 01net : seules 4 occurrences trouvées, toutes dans des fixtures de test (`rss2.xml`, `seo-content-gen-factories.test.ts`). Aucune mention presse réelle encodée.
- `src/content/press.ts` existe (affiché sur `/presse`) : contient les communiqués presse d'Axion-IA émis, mais ce sont des communiqués **sortants** (écrits par Axion-IA), pas des mentions **entrantes** de médias tiers citant Axion-IA.
- Aucun lien `<a href="https://www.lesechos.fr/...">` ou citation JSON-LD `isBasedOn` pointant vers un média autorité FR dans les templates de génération.
- `Organization.sameAs` ne contient pas Wikidata — le commentaire dans `layout.tsx` l. 153 note l'importance de Wikidata "pour LLMs disambiguation" mais l'entrée n'est pas créée.

---

### Analyse Trustworthiness

**Points forts — conformité AI Act et RGPD exemplaire**

AI Act disclaimer (art. 50) :
- `AiContentDisclaimer` (composant terracotta, `role="doc-tip"`, `data-aeo="ai-disclosure"`) déployé sur 6 routes : `/actualites/[slug]`, `/blog/[slug]`, `/cas-concrets/[slug]`, `/centre-aide/[slug]`, `/guides/[slug]`, `/glossaire/[slug]`. Texte FR/EN explicite mentionnant OpenAI GPT-4o, Anthropic Claude, Perplexity Sonar + lien vers `/transparence`.
- `aiGenerated: true` + `additionalType: "https://schema.org/AIGeneratedContent"` + `disambiguatingDescription` dans tous les Article JSON-LD produits par `buildArticleBase()`.
- `GenerationProvenance` Prisma : hash SHA-256 chaîné par article pour audit trail SOC2 complet.
- `/transparence` : page dédiée AI Act EU art. 50, 4 sections (contenus, sous-processeurs, classification, RGPD), JSON-LD WebPage.
- `/charte-editoriale` : 8 sections (mission, process revue, sources autorités externes, transparence IA, fact-check, corrections, indépendance, cadence) + `dateModified: "2026-05-18"` JSON-LD.
- `/corrections` : page dédiée errata.

Mentions légales / CGV :
- `/mentions-legales` : page structurée via `LegalPageTemplate` + `getLegal()` SSOT.
- `/politique-confidentialite` : page complète.
- `/conditions-generales` : page existante.
- `/sous-processeurs` : liste DPA + SCC providers IA.
- `/mes-donnees` : self-service RGPD art. 17/21.

HTTPS :
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` dans `next.config.ts` securityHeaders — HSTS preload activé, force HTTPS sur 2 ans.
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` présents.

dateModified JSON-LD :
- `buildArticleBase()` : `dateModified: new Date(input.updatedAt).toISOString()` — OK pour tous les Article/BlogPosting/NewsArticle générés.
- `buildQAPageJsonLd()` : `dateModified` obligatoire avec fallback `publishedAt` — OK.
- `QAPage` manque : sur certaines pages legacy FS (ex. `transversal.ts` blog posts), `updatedAt` peut ne pas être défini → fallback `datePublished`. À vérifier article par article.

---

### Recommandations ordonnées par ROI

#### 1. Quick wins (< 2h)

**QW-A : Intégrer `AuthorByline` sur les 4 routes articles** — effort estimé 1h
- Ajouter `import { AuthorByline } from "@/components/knowledge/public/AuthorByline"` dans `/blog/[slug]/page.tsx`, `/actualites/[slug]/page.tsx`, `/guides/[slug]/page.tsx`, `/centre-aide/[slug]/page.tsx`.
- Alimenter les props depuis `view.authorName`, `view.authorSlug`, `view.publishedAt`, `view.lastReviewedAt`, `view.factChecked` (déjà présents dans les loaders).
- Impact : Person JSON-LD visible dans le rendu + bloc auteur visuellement présent → signal E-E-A-T direct sur chaque article. ROI Google AI Overviews élevé.

**QW-B : Ajouter Wikidata `sameAs` dans `buildOrganizationJsonLd`** — effort 30 min
- Créer l'entité Wikidata Axion-IA (5 min, gratuit) → obtenir l'ID `Q12XXXXXX`.
- Ajouter `"https://www.wikidata.org/wiki/Q12XXXXXX"` dans le tableau `sameAs` de `buildOrganizationJsonLd()`.
- Impact : identité entité Axion-IA corroborée pour LLMs (ChatGPT, Gemini, Perplexity disambiguation) → +15-25 pts GEO estimation.

**QW-C : Forcer ≥ 2 liens externes autorité dans les SYSTEM_PROMPT générateurs** — effort 1h
- Modifier `SYSTEM_PROMPT` dans `blog-from-keywords.ts` et `blog-article.ts` pour ajouter la règle : `"Inclure obligatoirement 2 liens externes vers des sources FR autorité (INSEE, Légifrance, INRIA, ANSSI, CNIL, Bpifrance). Format : <a href="..." target="_blank" rel="noopener noreferrer">texte</a>."`.
- Impact : signal External links autorité dans le HTML généré, corroboration Perplexity + AEO.

---

#### 2. Sprints (< 1j)

**SP-A : Alimenter `alumniOf` et `awards` dans le seed AuthorProfile Manon** — effort 2-4h
- Documenter dans la bio Manon des formations / certifications fictives mais cohérentes avec la doctrine (ex. "Supervision IA — Axion-IA editorial board") OU pour Will (auteur humain) ajouter une vraie certification IA.
- Créer un 2e auteur humain dans `AuthorProfile` (Will, `isPersona: false`) avec `linkedinUrl` renseigné, `alumniOf`, `awards` pour les articles stratégiques haute priorité.
- Impact : 2 auteurs = répartition E-E-A-T humain + IA, signal "supervision humaine" crédible.

**SP-B : Créer `buildCitationArray` + forcer injection dans les générateurs** — effort 4-6h
- Alimenter le champ `citations` de `ArticleJsonLdInput` depuis les `lastCitations` retournés par Perplexity Sonar (déjà présent dans `llmResult.citations` dans `blog-from-keywords.ts` l. 124).
- Passer ces citations dans `buildBlogPostingJsonLd({ ..., citations: lastCitations })`.
- Impact : `Article.citation[]` JSON-LD alimenté automatiquement → Perplexity reprend les sources (+20-40% citation rate estimé audit AEO §3.5).

**SP-C : Ajouter un bloc "Sources" visuel en bas d'article** — effort 3-4h
- Créer un composant `ArticleSources` affichant les citations `lastCitations` stockées dans `outputJsonRaw` de l'Article Prisma.
- Intégrer dans `/blog/[slug]/page.tsx` après le body et avant `AiContentDisclaimer`.
- Impact : signal Experience + Authoritativeness visuel, liens sortants actifs.

---

#### 3. Projets (> 1j)

**PR-A : Obtenir 3+ mentions presse FR autorité** — effort 2-3 semaines
- Publier un communiqué sur Portail de la Presse / AP News FR avec lien vers axion-ia.com.
- Démarcher JDN, 01net, Numerama pour une tribune IA rédigée par Will.
- Ajouter les URLs de mention presse dans `Organization.sameAs` + créer une page `/presse` listant les mentions entrantes (différent des communiqués actuels).
- Impact : seul levier réel sur le critère Authoritativeness (+7 pts possibles sur ce critère).

**PR-B : Données propriétaires en panel sectoriel** — effort 1-2 semaines
- Agréger les métriques des 5 cas concrets + futurs en un "rapport annuel IA PME France 2026" (format PDF + page dédiée `/recherche/rapport-ia-pme-2026`).
- Encoder dans la KB interne comme `type: "proprietary_study"` pour que les générateurs le citent systématiquement.
- Impact : contenu original citable → backlinks naturels + signal Experience propriétaire fort.

**PR-C : Certification `factChecked` systématique** — effort 1 semaine
- Implémenter un workflow admin "validation Will" qui coche `factChecked: true` sur les articles générés après revue humaine.
- Passer ce flag dans `AuthorByline.factChecked` pour afficher le badge "✓ Vérifié" sur les articles validés.
- Impact : signal visuel + Schema.org `ReviewedBy` qui renforcent la fiabilité perçue.

---

### Synthèse E-E-A-T par pilier

| Pilier | Score | Niveau |
|--------|-------|--------|
| Experience | 6/10 | Moyen — données existent, injection templates incomplète |
| Expertise | 8/12 | Moyen — infrastructure solide, AuthorByline non déployé |
| Authoritativeness | 3/10 | Faible — aucun backlink autorité FR démontrable |
| Trustworthiness | 34/38 | Fort — AI Act exemplaire, HTTPS, légal complet |
| **Global** | **54/80** | **67,5 % — SPRINT CORRECTIF** |

Le maillon le plus faible est l'**Authoritativeness** (backlinks entrants FR), problème externe au code mais dont les quick wins QW-B (Wikidata) et QW-C (liens sortants autorité) améliorent significativement le signal machine-readable à court terme.
