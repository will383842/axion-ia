# V-07 — SEO/AEO/GEO centralisé

**HEAD** : `8031a00` · branche `audit/p6-verdict-global-5000-2026-05-22` · **AUDIT-ONLY**
**Baseline** : 82/100 (164/200) · **Score re-évalué** : **172/200 (86/100)** · **Verdict** : 🟢

---

## 1. Scope évalué

SSOT JSON-LD `src/lib/seo.ts` (1402 LOC, 18 factories : Product/Service/FAQ/Breadcrumb/Organization/WebSite/Person/Article/FaqSpeakable/LocalBusiness/Place/ItemList/Product/HowTo/Course/Review/AggregateRating/Dataset/ImageObject/QAPage).
Extension `src/lib/seo-content-gen-factories.ts` (Manon Person + 4 variants Article aiGenerated).
Extension `src/lib/seo/ville-service-jsonld.ts` (graphe 7-schémas villes).
Disclaimer `src/components/marketing/AiContentDisclaimer.tsx` (11 sites d'appel).

---

## 2. Top 3 forces

1. **Organization JSON-LD D7 conforme + alternateName** — `src/lib/seo.ts:388-390`

   ```ts
   name: "Axion-IA",
   legalName: "Axion-IA",                  // ✅ D7 société FR pure (pas "OÜ")
   alternateName: ["AxionIA", "Axion IA", "axion-ia.com"],
   ```

   `legalName: "Axion-IA"` propagé sur **6 fichiers** (seo.ts × 5 schemas + ville-service-jsonld.ts:191 + image-jsonld-graph.service.ts:70 + brand.ts:16). Zéro mention résiduelle "OÜ" / "AxionIA OÜ" dans le code SSOT.

2. **AI Act art. 50 — `aiGenerated:true` câblé sur 4 variants Article + Person Manon** — `src/lib/seo-content-gen-factories.ts:76,169`

   ```ts
   aiGenerated: true,
   additionalType: "https://schema.org/AIGeneratedContent",
   ```

   Câblé runtime sur `blog/[slug]/page.tsx:243`, `cas-concrets/[slug]/page.tsx:90`. Tests dédiés `seo-content-gen-factories.test.ts:128/144/194` (3 specs vérifient l'émission sur 4 variants Article/BlogPosting/TechArticle/NewsArticle + Person Manon).

3. **WebSite SearchAction + Speakable FAQ + hreflang gracieux EN-disabled** — `src/lib/seo.ts:455-462`

   ```ts
   potentialAction: { "@type": "SearchAction",
     target: { urlTemplate: `${SITE_URL}/${locale}/${isFr ? "recherche" : "search"}?q={search_term_string}` },
     "query-input": "required name=search_term_string" }
   ```

   - `buildFaqSpeakableJsonLd` (l.706) + `buildFaqJsonLd` auto-Speakable opt-in (l.299).
   - `buildProductMetadata` (l.118-137) drop `hreflang="en"` quand `isEnLocaleDisabled()` → cohérent avec proxy 301 EN→FR (AGENTS.md). Pas de signal mort à Google.

---

## 3. Top 3 gaps P0/P1

1. **P0 — `aiGenerated:true` ABSENT du graphe villes 7-schémas** (`buildVilleServiceJsonLdGraph`)
   `src/lib/seo/ville-service-jsonld.ts` (no match `aiGenerated` grep). Les 39 pages villes pilotes (4 verticales × 39 = 156 pages tier-1 indexables) émettent Service + LocalBusiness + Breadcrumb + FAQPage + HowTo + Person + ItemList **sans** flag `aiGenerated`. Le component `<AiContentDisclaimer/>` est présent (l.697 `VilleServicePageTemplate.tsx`) — humain-readable ✅, mais le couple machine-readable JSON-LD est manquant pour les pages villes (alors que blog/cas-concrets l'ont).
   **Effort** : ~30 min (ajouter `aiGenerated: true` + `additionalType` sur les 2 schemas générés DB-driven : LocalBusiness l.170 + Service principal). Test : 1 spec dédiée.

2. **P1 — `LocalBusiness` régionales — couverture partielle** — `src/lib/seo.ts:771-834`
   `buildLocalBusinessJsonLd` est correctement implémentée (ProfessionalService + parentOrganization + areaServed + address + geo + openingHoursSpecification + priceRange). MAIS gap baseline P2 confirmé : aucune page `/implantations/[region]` (13 régions FR) n'instancie de LocalBusiness régional dédié — seules les pages **ville × service** (`buildVilleServiceJsonLdGraph`) l'émettent. Les 13 pages region-level n'émettent que `buildServiceJsonLd` + `buildItemListJsonLd`.
   **Effort** : ~1h30 (1 helper `buildRegionalLocalBusinessJsonLd` + wire dans `implantations/[region]/page.tsx`).

3. **P1 — adresse postale Organization vide placeholder** — `src/lib/seo.ts:408`
   ```ts
   addressLocality: "[Ville — France]",
   ```
   Placeholder littéral dans le SSOT Organization JSON-LD. Validator Google + LLM AEO citent rarement Organization sans adresse complète. Cohérent avec décision Will figée (D7 société FR pure, adresse à fournir) — bloqué côté Will (cf. baseline action Will WeWork Paris ~300€/mo encore non actionnée).
   **Effort** : ~10 min code après que Will fournit l'adresse réelle (1 ligne à patcher).

---

## 4. AI Act deadline 2026-08-02

**Couverture** : ✅ **partielle (haut niveau OK, 1 gap résiduel)**

- ✅ Disclaimer humain-readable (`AiContentDisclaimer`) câblé sur **11 templates** : centre-aide, cas-concrets, VilleServicePageTemplate, implantations/[region]/[ville], blog, guides, presse, glossaire, actualites + content/transversal.ts.
- ✅ Machine-readable JSON-LD `aiGenerated:true` sur les 4 variants Article (blog/cas-concrets/news/tech) + Person Manon avec `additionalType: AIGeneratedContent`.
- ✅ Charte éditoriale `/charte-editoriale` mentionne explicitement AI Act EU 2024/1689 art. 50 (l.196).
- ❌ **Manque** : `aiGenerated:true` sur les schemas générés du graphe villes (Service + LocalBusiness) — voir P0 §3.1.

**Risque deadline** : faible (3 mois de marge) si gap P0 fixé court terme. Wording disclaimer + couverture humaine déjà conformes.

---

## 5. Vérifications complémentaires

- **`legalName` audit** : 9 occurrences, 100% `"Axion-IA"` — D7 propre (`Grep legalName src/`).
- **`SearchAction` + `search_term_string`** : ✅ unique source `buildWebsiteJsonLd` l.455-462, branché route `/recherche` (FR) + `/search` (EN).
- **`generateMetadata` helper** : ✅ `buildProductMetadata` (l.102) — alternates canonical + hreflang fr/en + EN-disabled graceful + OG/Twitter + `metadataBase` via `SITE_URL` avec fallback prod safety net (l.20-24).
- **hreflang FR/EN proxy 301** : ✅ `isEnLocaleDisabled()` lu dans `buildProductMetadata` → omet `languages.en` quand EN désactivé (cohérent AGENTS.md). x-default = fr.
- **Tests** : `seo-content-gen-factories.test.ts` couvre `aiGenerated` (3 specs). Pas de tests dédiés `seo.ts` SSOT — gap P2 (non bloquant baseline).

---

## 6. Score détaillé /200

| Critère                          | Note        | Justif                                                  |
| -------------------------------- | ----------- | ------------------------------------------------------- |
| Org legalName D7 + alternateName | 20/20       | conforme intégral                                       |
| SearchAction search_term_string  | 18/20       | OK, mais pas testé                                      |
| Article aiGenerated AI Act       | 28/30       | 4 variants + Person Manon, manque coverage city schemas |
| LocalBusiness régional           | 22/30       | factory OK, wiring partiel (villes oui, régions non)    |
| AiContentDisclaimer 39 villes    | 18/20       | présent dans template, gap baseline P0 levé             |
| hreflang FR/EN proxy-aware       | 18/20       | graceful EN-disabled                                    |
| generateMetadata helpers         | 18/20       | buildProductMetadata SSOT                               |
| FAQ Speakable AEO                | 15/20       | opt-in propre, sélecteurs documentés                    |
| **Total**                        | **172/200** | **86/100**                                              |

**Delta vs baseline** : +8 pts (164→172). Gains : D7 100% propagé, AI Act 4 variants + Person, EN-disabled graceful. Reste : gap P0 city schemas aiGenerated + P1 LocalBusiness régional + P1 adresse Org.

---

## 7. Verdict

🟢 **GO V-07** — SSOT robuste, D7 figé, AI Act art. 50 couvert sur les contenus rédactionnels critiques (blog/cas-concrets/Manon). 1 gap P0 résiduel (`aiGenerated` city schemas, ~30 min) à intégrer Sprint Correctif. P1 LocalBusiness régional reportable Sprint S+7+ (impact AEO modéré, pages region-level moins prioritaires que ville×service).

**Action recommandée** : ajouter `aiGenerated: true` + `additionalType` dans `buildVilleServiceJsonLdGraph` (Service + LocalBusiness) avant 2026-08-02.
