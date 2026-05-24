# A3-05 — AEO Answer Engine Optimization

## Score : 57/80

## Date : 2026-05-21

## HEAD : 37ca0147

---

## Points obtenus

- [OK] FAQ 30Q globale — présente, 30 entrées exactement dans `FAQ_GLOBAL` (transversal.ts), bilingue FR/EN, sourcée SSOT pricing, réponses 3-6 phrases
- [OK] FAQPage JSON-LD sur `/faq` — `buildFaqSpeakableJsonLd` appelé avec `SpeakableSpecification` CSS selector `[itemprop='text']`
- [OK] QAPage JSON-LD sur `/faq/[slug]` — `buildQAPageJsonLd` avec Speakable `cssSelector [".faq-answer", "[data-aeo=\"answer\"]"]` + datePublished/dateModified stables (BUILD_DATE)
- [OK] Sub-sitemap FAQ dédié — `sitemap-faq.xml` séparé (split depuis `help.xml` audit P1-12), `/faq/:slug` × locales, priority 0.7
- [OK] Q/R auto worker opérationnel — `content-qa-extract-worker.ts` (§ 29 master prompt v1.7), upsert DB, slug dérivé article, sanitization DOMPurify
- [OK] Q/R auto listées sur `/faq` — `listFaqs()` fusionne FAQ_GLOBAL + table `faqs` DB (tier_1 + tier_2), merge par slug
- [OK] Generator `faq-standalone` registré — 10-15 Q/A, intent PAA, quality loop ×2, doctrine check
- [OK] Generator `qa-derived` registré — pipeline post-process squelette V1
- [OK] Search intent validator — couverture informational / commercial_investigation / transactional / local
- [OK] 65 seeds AEO g4-aeo.ts — 5 modules (audit 12, formations 15, implémentation 12, AI Act 8, transversal 18), formulation naturelle vocale
- [OK] Seeds GEO i-geo.ts — 38 seeds famille A-E GEO (réponse directe 2-3 phrases, Dataset, comparaisons factuelles)
- [OK] Voice search signal présent — `LocalGeoFaqSection` + note "présent dans recherches vocales" (g2-interventions.ts)
- [OK] LocalGeoFaqSection déployé — 4 services (audit, interventions, implementation, codage-developpement), FAQPage Speakable distincte
- [OK] `directAnswer` champ dans tous les generators — blog-article, blog-from-keywords, faq-standalone (≤60 mots)
- [PARTIEL] Hreflang sur /faq — présent via `buildProductMetadata` (languages: {fr, x-default}), mais hreflang EN omis car `EN_LOCALE_ENABLED` désactivé (301 redirect) — perte de signal EN

---

## Points perdus

### P1 — Coverage intent transactionnel sur verticale un_a_un et sites_web_augmentes absent dans g4-aeo.ts (-5 pts)

Les seeds AEO g4-aeo.ts ne couvrent **pas** les verticales :
- `un_a_un` : manquent "coaching IA prix", "prendre RDV coach IA individuel", "coaching 1-to-1 IA dirigeant tarif"
- `sites_web_augmentes` : manquent "créer site web IA devis", "développeur site IA prix", "intégrateur site IA sur mesure"

Seule 1 seed transversale "site web augmenté par l'IA" existe dans FAQ_GLOBAL (id: site-web-augmente-ia). Aucun seed AEO dédié `/fr/faq/site-web-ia-devis`, `/fr/faq/coaching-ia-prix`.

### P1 — Q/R auto tier_2 non promues tier_1 = invisibles Google (-4 pts)

Toutes les Q/R auto générées par `content-qa-extract-worker` sont insérées en `tier_2_noindex_follow` par défaut (anti-doorway HCU strict V1). Sans promotion manuelle, ces Q/R ne sont **pas indexables** directement. Le volume potentiel (6-8 Q/A par article) est perdu pour l'indexation primaire. Aucun mécanisme automatique de promotion tier-2 → tier-1 après enrichissement.

### P1 — Hreflang EN absent sur /faq (EN locale désactivé) (-4 pts)

`buildProductMetadata` omet `hreflang="en"` quand `EN_LOCALE_ENABLED !== "true"`. La page `/fr/faq` n'a donc que `fr` + `x-default = /fr/faq`. Les moteurs de réponse anglophone (Bing Copilot, Perplexity EN, ChatGPT browse EN) ne voient aucune alternate EN déclarée. Le contenu FAQ est bilingue FR/EN dans le code mais non signalé EN aux crawlers.

### P2 — Voice search : absence de formulation directe dans les réponses courtes (-3 pts)

Les réponses FAQ_GLOBAL ont une moyenne de 60-90 mots (bien pour AEO web) mais les formulations ne commencent **pas** systématiquement par une réponse directe en 1 phrase (pattern "Oui/Non + raison courte"). Exemple : la réponse `ia-remplace-salaries` commence par "Non." (bon) mais `data-security` commence par "Non. Hébergement UE par défaut..." sans séquence question → réponse directe → détail. Pattern voice-first non systématisé dans le SSOT.

### P2 — Longtail sémantique villes × verticales : manque de seeds AEO locaux (-4 pts)

Dans g4-aeo.ts, 0 seed combine ville + verticale + question AEO. Exemple manquant : "comment former ses équipes à l'IA à Lyon ?", "audit IA PME à Bordeaux", "coaching IA Paris tarif". Le fichier i-geo.ts est GEO pur (entité/citation LLM) mais pas AEO local (Q/R indexables People-Also-Ask par ville). La `LocalGeoFaqSection` comble partiellement mais avec seulement 4 Q génériques par service (non géo-spécifiques par ville).

### P2 — Chunk-proof : sections `faq-standalone` generator manquent de `isBasedOn` + `about` JSON-LD (-3 pts)

`buildQAPageJsonLd` émet QAPage + Speakable mais n'inclut pas `isBasedOn` (source citable), `about` (entity mention), ni `mention` (linked entity). Ces propriétés renforcent la citabilité décontextualisée par les LLMs (Perplexity, Claude, Gemini). Le master prompt v1.7 §9bis.11B mentionne `isBasedOn` + `speakable` mais la factory `seo-content-gen-factories.ts` ne l'émet pas encore.

---

## Analyse FAQ 30Q globale

**Présence** : 30 entrées exactes dans `FAQ_GLOBAL` (`src/content/transversal.ts` l.125-516). Objectif "30Q" livré P1 (audit opérationnel 2026-05-14).

**Structure** : Bilingue FR/EN inline (questionFr/questionEn + answerFr/answerEn). Reader unifié `listFaqs()` merge FAQ_GLOBAL legacy + table `faqs` DB (Q/R auto + KB unified si flag actif).

**Intent mix** :
- Informatif : 18/30 (60 %) — "Qu'est-ce qu'Axion-IA ?", "Comment mesurer le ROI ?", "Quelle différence IA vs automatisation ?"
- Commercial : 8/30 (27 %) — "Comment choisir un cabinet IA ?", "Combien coûte un projet IA ?", "L'IA est-elle adaptée aux TPE ?"
- Transactionnel : 4/30 (13 %) — "Axion-IA intervient à distance ?", "Propose-t-il un accompagnement post-implémentation ?" (CTAs implicites)

**Qualité des réponses** :
- Longueur moyenne : ~70 mots (dans la cible AEO 40-100 mots)
- Ancrage Axion-IA : présent dans 26/30 réponses (bon)
- Prix dynamiques depuis pricing.ts SSOT : présent (id: modules, cout-projet-ia-pme)
- Réponses directes (oui/non en 1ère phrase) : 12/30 (40 %) — amélioration voice search recommandée
- Couverture verticales : formation ✓, audit ✓, implémentation ✓, coaching 1-to-1 ✓ (id: coaching-1-to-1-dirigeant), site web augmenté ✓ (id: site-web-augmente-ia)

**GAP identifié** : La verticale `un-a-un` n'a qu'1 entrée (coaching-1-to-1-dirigeant) sans price intent ni CTA réservation. La verticale `sites_web_augmentes` a 1 entrée générique sans intent transactionnel ("devis", "tarif").

---

## Analyse Q/R auto

**Infrastructure** : `content-qa-extract-worker.ts` pleinement opérationnel — BullMQ queue `content-qa-extract`, déclenchement depuis `content-publish-worker` post-insert Article, upsert idempotent par `${articleSlug}-${slugifyQuestion}`.

**Pipeline** :
1. Article publié → content-publish-worker enqueue job `content-qa-extract`
2. Worker parse `faqJson` de l'article (6-8 Q/A par article content-gen)
3. Sanitization DOMPurify whitelist stricte (8 tags) + détection placeholders
4. Upsert `prisma.fAQ` : `status=published`, `indexationTier=tier_2_noindex_follow`
5. revalidatePath `/fr/faq` best-effort

**Sitemap** : Les Q/R tier_1 + tier_2 sont listées sur `/fr/faq` (reader `listFaqs()` inclut `indexationTier: { in: ["tier_1_indexable", "tier_2_noindex_follow"] }`). Le sub-sitemap `sitemap-faq.xml` sert uniquement les `getAllFaqIds()` legacy (FAQ_GLOBAL SSOT). Les Q/R DB auto-générées ne sont exposées dans le sitemap que si elles atteignent tier_1 via le sub-sitemap `knowledge-N` (KnowledgeEntry path via `buildKnowledgeSitemapChunk`).

**GAP critique** : Les Q/R auto sont systématiquement en `tier_2_noindex_follow` = méta-noindex. Elles sont accessibles via lien direct mais **non indexables** par Google/Bing. L'objectif AEO (PAA, AI Overviews) nécessite que ces pages soient indexables. Pas de logique de promotion automatique basée sur word count ou quality score. La factory `qa-derived` est un simple wrapper `landingVilleGenerator` (squelette V1, pipeline enrichissement ≥300 mots non implémenté).

**Volume estimé** : Si 500 articles générés × 6-8 Q/A = 3 000-4 000 Q/R potentielles en DB, toutes en tier_2.

---

## Analyse intent coverage

### interventions_formations
- Informatif : ✓ "qu'est-ce que la formation IA" (g4 #13-27, FAQ_GLOBAL: competences-techniques, formation-ia-difference)
- Commercial : ✓ "formation IA pour PME" (g4 #27, FAQ_GLOBAL: equipes-operationnelles)
- Transactionnel : PARTIEL — "réserver formation IA Paris" absent dans FAQ_GLOBAL ; seed AEO g4 pointe `/fr/faq/heures-formation-ia-equipe` pas `/reserver`

### un_a_un
- Informatif : ✓ FAQ_GLOBAL: coaching-1-to-1-dirigeant
- Commercial : ABSENT — "coaching IA prix", "coaching individuel tarif" pas dans FAQ_GLOBAL ni g4-aeo.ts
- Transactionnel : ABSENT — "prendre RDV coach IA" pas couvert

### audits
- Informatif : ✓ g4 modules #1-12, FAQ_GLOBAL: audit-ia-definition
- Commercial : ✓ "audit IA PME avantages" (g4 #10, FAQ_GLOBAL: ai-act-2026)
- Transactionnel : PARTIEL — "demander audit IA gratuit" absent ; g4 pointe `/fr/faq/roi-audit-ia-pme` pas `/demande-devis`

### implementations
- Informatif : ✓ g4 #28-39, FAQ_GLOBAL: ia-vs-automatisation
- Commercial : ✓ "intégrateur IA prix" via g4 #34 (/fr/faq/budget-premier-projet-ia-pme)
- Transactionnel : PARTIEL — "devis implémentation IA" absent dans FAQ ; g4 note "lier vers /fr/roi" mais pas CTA devis directement

### sites_web_augmentes
- Informatif : ✓ FAQ_GLOBAL: site-web-augmente-ia
- Commercial : ABSENT — "site web IA développement prix" pas couvert
- Transactionnel : ABSENT — "créer site web IA devis" pas couvert ; aucune seed g4-aeo.ts pour ce module

---

## Analyse voice search

**Signaux positifs** :
- Seeds g4-aeo.ts formulation 100 % orale : questions commencent par "comment", "combien", "faut-il", "quelle différence", "par où", "en combien", "est-ce que" — conformes au guide vocal (5-12 mots, naturel)
- `SpeakableSpecification` déployé sur FAQPage (`/faq`) + QAPage (`/faq/[slug]`) avec CSS selectors `[data-aeo="answer"]` + `.faq-answer`
- `LocalGeoFaqSection` note "intent présent dans recherches vocales" (g2-interventions.ts l.567)
- Pills "AEO speakable" + "Mic" icône sur la page `/faq` (signal UX + confiance LLM)

**Faiblesses** :
- FAQ_GLOBAL : seulement 40 % des réponses commencent par une réponse directe en 1 phrase (Oui/Non/X est/X fait). Les 60 % restants démarrent par une description contextuelle (moins lisible par voice assistant).
- Absence de champ `directAnswer` sur les entrées FAQ_GLOBAL (format `{id, fr: {question, answer}}`). Le `directAnswer` (≤60 mots) n'existe que dans les outputs des generators content-gen, pas dans le SSOT legacy.
- Speakable `cssSelector: ["[itemprop='text']"]` sur FAQPage aggregate — sélecteur peu précis (peut capter des éléments non-réponse sur la page).

---

## Recommandations ordonnées par ROI

### 1. Quick wins (<2h)

**QW-1 — Ajouter 4 seeds AEO un_a_un dans g4-aeo.ts** (~1h)
- "quel est le tarif du coaching IA individuel ?" → `/fr/faq/tarif-coaching-ia-individuel`
- "comment se déroule un coaching IA 1-to-1 ?" → `/fr/faq/coaching-ia-1-to-1-deroulement`
- "prendre RDV pour un coaching IA dirigeant" → `/fr/faq/prendre-rdv-coaching-ia-dirigeant`
- "quelle différence coaching IA et formation IA ?" → `/fr/faq/coaching-ia-vs-formation-ia`
ROI : couvre verticale un_a_un à 0 % AEO → 4 QAPages citables PAA.

**QW-2 — Ajouter 3 seeds AEO sites_web_augmentes dans g4-aeo.ts** (~45 min)
- "combien coûte un site web augmenté par l'IA ?" → `/fr/faq/cout-site-web-augmente-ia`
- "comment créer un site web avec l'IA ?" → `/fr/faq/creer-site-web-ia`
- "quelle différence site web IA et site web classique ?" → `/fr/faq/site-web-ia-vs-classique`
ROI : verticale sites_web_augmentes absente de g4-aeo.ts → 3 QAPages.

**QW-3 — Améliorer Speakable cssSelector FAQPage** (~30 min)
Passer `speakableSelector` de `[itemprop='text']` à `[data-faq-a]` (sélecteur précis déjà utilisé dans `buildFaqJsonLd`). Modifier `buildFaqSpeakableJsonLd` dans `seo.ts` pour utiliser le même sélecteur.
ROI : Google Assistant / Alexa lisent la bonne section réponse, pas du contenu parasite.

**QW-4 — Reformuler les 18 réponses FAQ_GLOBAL qui ne commencent pas par réponse directe**
Passer les réponses à pattern "Oui/Non + raison" ou "X est [définition courte en 1 phrase]" pour les ids : definition, modules, tools, billing, comment-commencer, delai-implementation, competences-techniques, roi-mesurer, pme-ia, chatgpt-vs-claude, secteurs, choisir-cabinet-ia, ia-vs-automatisation, presentiel-distance, heures-semaine-pme, tpe-ia, rgpd-ia, formation-ia-difference.
ROI : voice search readiness 40 % → 90 %.

### 2. Sprint (<1j)

**S-1 — Mécanisme de promotion automatique tier_2 → tier_1 pour Q/R auto** (~4h)
Ajouter dans `content-qa-extract-worker.ts` une logique de promotion :
- Si `cleanAnswer.split(' ').length >= 150` + `!containsPlaceholder(cleanAnswer)` → `indexationTier: "tier_1_indexable"`
- Sinon garder tier_2
Alternative : créer un job `content-qa-enrich-worker.ts` qui ré-enrichit les Q/R tier_2 avec 2-3 phrases de contexte depuis la KB (appel LLM léger) puis promeut tier_1.
ROI : 3 000-4 000 Q/R auto potentiellement indexables → impact PAA massif.

**S-2 — Enrichir `buildQAPageJsonLd` avec `isBasedOn` + `about`** (~2h)
Dans `src/lib/seo-content-gen-factories.ts`, ajouter à la factory QAPage :
- `isBasedOn: { "@type": "WebSite", "url": "https://axion-ia.com", "name": "Axion-IA" }`
- `about: { "@type": "Thing", "name": primaryKeyword }`
- `author: { "@type": "Organization", "name": "Axion-IA" }`
ROI : citabilité Perplexity / Bing AI améliorée (entité source explicite).

**S-3 — Ajouter `directAnswer` champ dans FAQ_GLOBAL** (~3h)
Étendre l'interface `FaqEntry` avec `fr: { question, answer, directAnswer?: string }`. Ajouter un `directAnswer` ≤60 mots pour les 30 entrées. Utiliser ce champ dans `buildFaqSpeakableJsonLd` pour le corps Speakable.
ROI : Featured snippet potentiel sur les 30 questions FAQ_GLOBAL.

**S-4 — Ajouter 15 seeds AEO géo-localisés dans g4-aeo.ts ou nouveau fichier g4b-aeo-geo.ts** (~2h)
Pattern : "[question] à [ville]" → `/fr/faq/[question-slug]-[ville]`.
Exemples : "comment former ses équipes à l'IA à Paris ?", "audit IA PME Lyon tarif", "coaching IA Bordeaux".
Croiser avec les 39 villes du sprint City Quality (Paris, Lyon, Marseille, Toulouse, Bordeaux, Lille, Nantes, Strasbourg, Nancy...).
ROI : longtail PAA local absent → 15+ QAPages géo-localisées.

### 3. Projet (>1j)

**P-1 — Ré-activer EN locale + hreflang /faq EN** (~sprint dédié)
Le locale EN est désactivé depuis 2026-05-16 (bug next-intl 307 loop). Pour que Bing Copilot, Perplexity EN, ChatGPT browse indexent les FAQ EN, il faut :
1. Corriger le bug next-intl 307 self-redirect (upgrade next-intl ou patch custom middleware)
2. Set `EN_LOCALE_ENABLED=true` Coolify
3. Vérifier GSC EN URLs (hreflang `en` et `x-default` /en/faq)
ROI : audience anglophone non couverte AEO → accès marchés internationaux.

**P-2 — Pipeline Q/R auto V1.5 : enrichissement ≥300 mots + cosine similarity** (~2-3 jours)
Implémenter le pipeline enrichi décrit dans `qa-derived.ts` commentaire V1 :
1. 3 phrases contextuelles auto depuis KB (kbRetrieve cosine similarity)
2. 4-6 Q/R similaires liées (`similarQaIds[]`)
3. Promotion automatique tier-2 → tier-1 post-enrichissement
4. `isBasedOn` + `about` JSON-LD complet
ROI : pipeline AEO P2P (People-Also-Ask to People) industrialisé.

**P-3 — FAQ transactionnelle par verticale × intent × CTA** (~1 jour)
Créer 5 FAQ pages spécialisées avec CTA transactionnel fort :
- `/fr/faq/demander-audit-ia-gratuit` — intent transactionnel audit
- `/fr/faq/reserver-formation-ia-equipe` — intent transactionnel formation
- `/fr/faq/devis-implementation-ia` — intent transactionnel implémentation
- `/fr/faq/prendre-rdv-coaching-ia` — intent transactionnel un-a-un
- `/fr/faq/devis-site-web-augmente-ia` — intent transactionnel sites_web

Ces pages Q/R transactionnelles combinent QAPage + LocalBusiness + CTA `/reserver` ou `/demande-devis`. Potentiel conversion élevé (bas de funnel).
