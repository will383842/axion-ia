# Plan correctif Sprint S0 — Pré-implémentation

**Verdict** : 🟡 NEAR-GO score 173/200
**Sprint correctif** : **S0 — 1 journée dev (~6-7 h)**
**Cible post-S0** : ≥ 180/200 (🟢 GO PROD-READY)

---

## P0 (bloqueurs Sprint 1 — corroborés ≥ 2 sources)

### P0-1 — Bugs SEO pré-existants /sitemap.xml 404 + og:image localhost

- **Description** : Le sitemap principal renvoie une 404 HTML (17 500+ routes SSG non crawlables) et `og:image` pointe sur `localhost:3000` (previews sociales cassées). Ces bugs sont **antérieurs au Sprint 1** mais le plan `SPRINT-1-DAY-BY-DAY.md` ne les adresse pas. Day 6 `pnpm verify:all` les détectera → fail silencieux.
- **Sources** :
  - VC4 → `_AUDIT/VERIFICATION-FINALE-AVANT-CODAGE/agents/agt-vc4-seo.json` VC4-001 + VC4-002
  - VC6 → `_AUDIT/VERIFICATION-FINALE-AVANT-CODAGE/agents/agt-vc6-plan.json` VC6-002
  - Mémoire `[[axionia_bugs_seo_preexistants_2026-05-09]]`
- **Impact si non corrigé** : Day 6 gate `pnpm verify:all` ÉCHOUE, blocage Sprint 1, retard publication contenus tier-1, pertes SEO continues.
- **Fix proposé** :
  1. Vérifier `app/sitemap.xml/route.ts` existe et renvoie XML valide (Content-Type `application/xml`) référençant `sitemap-blog.xml`, `sitemap-villes.xml`, `sitemap-faq.xml`, etc.
  2. Si absent : créer la route à partir de `sitemap-index.xml` existant (cf. mémoire `[[axionia_aeo_geo_perfection_2026-05-07]]`).
  3. Vérifier `buildOgImage()` ou helper équivalent utilise `NEXT_PUBLIC_SITE_URL` (env Coolify prod) au lieu de `localhost:3000`.
  4. Test curl prod : `curl -I https://axion-ia.com/sitemap.xml` → 200 + XML, et `curl https://axion-ia.com/api/og?title=Test` → 200 + PNG.
- **Effort estimé** : **3 h**
- **Validation** : `pnpm sitemap:validate` (XSD) + Search Console submit + test manuel preview sociale Facebook/LinkedIn

### P0-2 — Manon Q13 gate humain (option visuelle + bio validée)

- **Description** : Le seul gate humain bloquant de l'autopilote § 24.4 est Q13 (Manon profile). Will doit fournir : (1) option visuelle (1 = Unsplash workspace recommandée, 2 = avatar SVG, 3 = silhouette) et (2) validation de la bio rédigée dans `_AUDIT/seeds-templates/manon-profile.md`.
- **Sources** :
  - VC2 → seed `manon-profile.md` Q13 gate accepté
  - VC5 → § 24.2 Q13 unique gate humain
  - VC7 → `_AUDIT/seeds-templates/manon-profile.md` 3 options non remplies
  - VC4 → JSON-LD Person + AuthorByline + photo variants generation bloqués
- **Impact si non corrigé** : Autopilote ne peut pas démarrer Sprint 1 Day 1. Person JSON-LD vide. Byline + AuthorCard sans photo.
- **Fix proposé** : Will choisit l'option visuelle et valide/édite la bio dans `_AUDIT/seeds-templates/manon-profile.md`. Coût Will = 10-15 minutes.
- **Effort estimé** : **15 min (Will)**
- **Validation** : `_AUDIT/seeds-templates/manon-profile.md` ne contient plus de placeholder `<TODO>` ; option visuelle choisie ; bio relue/validée.

---

## P1 importants à fixer pendant le Sprint S0 (cosmétiques rapides)

| # | ID | Item | Effort | Source |
|---|---|---|---|---|
| P1-1 | VC6-003 | Renommer commit #22 dans `SPRINT-1-DAY-BY-DAY.md:230` : `feat(content-gen): image system unsplash + placeholder fallback + sharp AVIF/WebP` (retirer `gpt-image-1`) | 5 min | VC6 |
| P1-2 | VC2-002 | Ajouter explicitement `quality_improving` à l'enum `ContentGenJobStatus` § 5.1 master prompt | 5 min | VC2 |
| P1-3 | VC1-004 | Uniformiser titre § 20 master prompt : « 13 STOP & ASK + 1 obsolète » (au lieu de « 12 questions ») | 5 min | VC1 |
| P1-4 | VC7-001 | Harmoniser SKILL.md frontmatter description et titre H1 → v1.7 ou v2.4 partout | 5 min | VC7 |
| P1-5 | VC6-005 | Documenter explicitement dans `CONTENT-GEN-V1-AUTOPILOT-LOG.md` pré-requis Day 1 : 4 clés API présentes (`$OPENAI_API_KEY`, `$ANTHROPIC_API_KEY`, `$PERPLEXITY_API_KEY`, `$UNSPLASH_ACCESS_KEY`) | 10 min | VC6 |
| P1-6 | VC4-003 | Décision Q13bis : confirmer ou retirer `twitter:creator` Manon. Si retiré → Zod schema `twitterCreatorHandle.optional()` + omit balise | 15 min | VC4 |
| P1-7 | VC2-001 | Ajouter section § 5.1bis dans master prompt avec listing exhaustif des 21 tables (CoverageCampaign, CoverageDistributionProfile, AudienceMixProfile, AuthorProfile, BannedPhrase ré-listées) | 30 min | VC2 |
| P1-8 | VC1-002 | Réordonner physiquement la section § 24 (autopilote) **avant** § 25 dans le master prompt + revérifier liens internes | 1 h | VC1 |

**Sous-total P1 cosmétiques** : ~2 h

---

## P1 à intégrer pendant Sprint 1 (pas Sprint S0)

Ces P1 sont des **fonctionnalités à coder Sprint 1** et sont déjà tracés dans le plan Day-by-Day :

- VC4-005 : `doctrine-check.ts` anti-AI-detection 6 signaux → Sprint 1 Day 3 (3 h)
- VC4-004 : Google Indexing API V1 grey-area logging + monitoring → Sprint 5 (3 h)
- VC8-001 : DOMPurify wrapper `html-sanitizer.ts` → Sprint 1 Day 2 (2 h)
- VC8-002 : Anti-SIREN `doctrine-check.ts` → Sprint 1 Day 3 (2 h)
- VC8-003 : Cost cap + kill switch `CostLedger` → Sprint 1 Day 2 (3 h)
- VC8-004 : 13 alertes Telegram structurées → Sprint 1 Day 5 (3 h)
- VC8-005 : Logger centralisé JSON + Redis pub/sub SSE → Sprint 1 Day 1 (2 h)

---

## P2 cosmétiques (Sprint 6.1 ou V2)

- VC2-003 : OrganisationType 12 valeurs partiellement listées (10 min)
- VC4-006 : Canonical double-signal HTML + HTTP header → monitorer Search Console uniquement
- VC7-002 : Supprimer `_AUDIT/seeds-templates/keywords.csv.OBSOLETE-v2.1.bak` (1 min)
- VC7-003 : Documenter `image-prompts.json` dans `SEEDS-PREPARATION-GUIDE.md` § 0.4 (5 min)
- VC8-006 : RBAC feature checks → V2 (2 h)
- VC8-007 : Conservation retention durée à définir → V2 (1 h)

---

## Budget Sprint S0

| Bloc | Effort |
|---|---|
| P0-1 Bugs SEO pré-existants | 3 h |
| P0-2 Manon Q13 (Will) | 15 min |
| P1 cosmétiques (1→8) | ~2 h |
| Re-validation `pnpm verify:all` smoke | 30 min |
| **Total Sprint S0** | **~6-7 h** |

---

## Re-lancement de la vérification

Après application Sprint S0 :

1. Re-lancer **uniquement** AGT-VC1 + AGT-VC4 + AGT-VC6 (les 3 agents impactés) avec idempotence skip pour les 5 autres.
2. Recalculer Pass B + scoring → cible **≥ 180/200**.
3. Si OK → lancer Sprint 1 autopilote via :
   ```
   Skill : axionia-content-generator (mode AUTOPILOTE)
   [Lis SKILL.md auto-pilot.md master prompt et déclenche Sprint 1 Day 1.]
   ```

Si score reste < 180 → investiguer les findings résiduels au cas par cas.
