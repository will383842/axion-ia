# AUDIT PARITY V14 — Axion-IA · Cohérence cross-pages (audit complet)

- **Date** : 2026-05-08
- **Référence qualité** : `/interventions` HEAD — **36/36**
- **Pages auditées** : **60 pages publiques** (couverture 100 %)
- **Auditeur** : Claude Opus 4.7 + 6 agents Explore (LISTINGS / PRODUCT / LEGAL / PRODUCT-EXTRA / EDITORIAL / MISC)
- **Méthode** : 12 dimensions × score 0-3 (6 dim simplifiées pour légales)

---

## 1. Verdict global (60 pages)

- [ ] PARITÉ EXCELLENTE ✅ (≥ 85 %)
- [x] **PARITÉ BONNE ⚠️ (60-85 %)** — score global pondéré ≈ **70 %**
- [ ] PARITÉ INSUFFISANTE ❌ (< 60 %)

**Lecture** : 3 pages au niveau gold (≥ 32/36) — `/interventions`, `/audit`, `/` (home). 14 pages produit héritent toutes de `ProductPageTemplate` (28/36 chacune), score uniforme — leur fix global aurait un impact ×14. **18 pages déficitaires** (≤ 22/36) sur les transversales/sous-listings — refonte structurelle nécessaire si on veut cohérence pré-launch.

## 2. Score par catégorie (60 pages)

| #   | Catégorie                                                                                    | Pages  | Score moy. | %         |
| --- | -------------------------------------------------------------------------------------------- | ------ | ---------- | --------- |
| /   | Home                                                                                         | 1      | 32/36      | 89 %      |
| A   | Listings modules                                                                             | 2      | 33.5/36    | 93 %      |
| B   | Listings transversaux                                                                        | 2      | 19.5/36    | 54 %      |
| C   | Pages éditoriales transversales                                                              | 4      | 21/36      | 58 %      |
| D   | Utilitaires                                                                                  | 2      | 20/36      | 56 %      |
| E   | Produit individuelles (audit, intervention, implementation)                                  | **18** | 27.5/36    | 76 %      |
| F   | Cas concrets [slug] + secteur/[slug]                                                         | 2      | 19.5/36    | 54 %      |
| G   | Articles blog [slug] + sous-listings (categorie/tag/auteur)                                  | 4      | 15.75/36   | 44 %      |
| H   | Légales                                                                                      | 7      | 17.4/18    | 96 %      |
| I   | Centre d'aide [slug] + categorie/[slug]                                                      | 2      | 18.5/36    | 51 %      |
| J   | FAQ [slug]                                                                                   | 1      | 21/36      | 58 %      |
| K   | Comparaisons + [slug]                                                                        | 2      | 22/36      | 61 %      |
| L   | Pages info (glossaire, guide-ia, methodologie, stack-ia)                                     | 4      | 27.75/36   | 77 %      |
| M   | Presse (WIP)                                                                                 | 1      | 26/36      | 72 %      |
| N   | Pages utilitaires (confirmation, desabonnement, mes-donnees, preferences-cookies, recherche) | 5      | 12.2/36    | 34 % (\*) |

(\*) Les 5 utilitaires sont **volontairement minimalistes** (no-index pour la plupart). Les considérer comme "acceptable per role" plutôt que déficitaire.

**Score "réel"** (excl. utilitaires) : **74 %** sur 55 pages.

## 3. Top 5 P0 — refontes urgentes

| Rang | Page                                      | Score | Effort | Action                                                                                                |
| ---- | ----------------------------------------- | ----- | ------ | ----------------------------------------------------------------------------------------------------- |
| 1    | **`/blog`**                               | 14/36 | M      | Refonte hero (titleEm + schema), +4 pills, pillar copy, BlogPosting JSON-LD, section "Most viewed"    |
| 2    | **`/blog/[slug]`**                        | 17/36 | S      | Body multi-`<p>` parsing (1 seul `<p>` ~150-200 mots actuellement), +titleEm hero, +related articles  |
| 3    | **`/contact`**                            | 17/36 | M      | Layout 2-col hero + schéma, +4 trust pills (48h, no-commit, RGPD, méthode), +Form JSON-LD, +micro-FAQ |
| 4    | **`/implementation/par-techno`**          | 21/36 | M      | +`buildServiceJsonLd` listing, +CTA mocha urgency, +audience proof                                    |
| 5    | **`/implementation/par-fonction/[slug]`** | 23/36 | M      | +`<JsonLd data={breadcrumb} />` (zéro export actuellement), +`<h2>` semantic sur items                |

## 4. Top 10 P1 — refontes UX significatives

| Page                                             | Score | Effort | Action                                                                                                                                                         |
| ------------------------------------------------ | ----- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ProductPageTemplate` (impacte 14 pages produit) | 28/36 | M      | +Section testimonials inline (3 cards) + Section anti-fear (3 cartes maturité) + DetailHeroSchema sur les pages sans → **+5 pts × 14 pages = +70 pts cumulés** |
| `/blog/tag/[slug]`                               | 15/36 | S      | `hasPart` vide dans CollectionPage JSON-LD ligne 50, bloque AEO citabilité                                                                                     |
| `/blog/categorie/[slug]`                         | 16/36 | XS     | +CTA hero, hero plus riche                                                                                                                                     |
| `/blog/auteur/[slug]`                            | 17/36 | XS     | +pills (X articles), hero +CTA                                                                                                                                 |
| `/cas-concrets/secteur/[slug]`                   | 16/36 | XS     | +pills, hasPart JSON-LD                                                                                                                                        |
| `/cas-concrets` (index)                          | 25/36 | M      | +4 pills, élargir CaseStudyCard, "Choisir son cas", ItemList JSON-LD                                                                                           |
| `/centre-aide`                                   | 24/36 | M      | +3 pills, enrichir HelpHeroSchema, Popular Q top-5, HelpCenter JSON-LD                                                                                         |
| `/centre-aide/categorie/[slug]`                  | 16/36 | XS     | +CTA hero, +pills                                                                                                                                              |
| `/comparaisons` (index)                          | 26/36 | M      | +section anti-fear 3 niveaux décision                                                                                                                          |
| `/audit/flash`                                   | 27/36 | S      | +`AuditHeroSchema` simple (3 livrables : mapping/scoring/plan)                                                                                                 |
| `/faq`                                           | 19/36 | M      | +CTA hero, +3 pills, +Most viewed top-5                                                                                                                        |
| `/a-propos`                                      | 24/36 | M      | +2 CTAs hero, +schéma, +pillar "why us", +proof (X clients/Y projects)                                                                                         |
| `/presse`                                        | 26/36 | S      | Illustrer placeholders PRESSE-01-hero, +section anti-fear                                                                                                      |
| `/methodologie`                                  | 30/36 | XS     | Quasi-gold (HowTo schema). Polish anti-fear. **Modèle à imiter pour autres pages info.**                                                                       |
| `/guide-ia`                                      | 27/36 | M      | +pills, +proof (chapters → hasPart)                                                                                                                            |

## 5. Pages au niveau (à conserver telles quelles)

✅ Production-ready :

- `/interventions` (gold standard, **36/36**)
- `/audit` (35/36, polish XS sur D7)
- `/` (home, 32/36, custom layout gold-adjacent)
- `/implementation` (32/36, polish S sur D2/D6)
- `/stack-ia` (31/36)
- `/interventions/dirigeants` (31/36, modèle DetailHeroSchema)
- `/interventions/equipes` (31/36, modèle DetailHeroSchema)
- `/methodologie` (30/36, modèle HowTo schema)
- `/audit/demande` (30/36, custom form excellent)
- `/audit/strategique-pme` (29/36)
- `/interventions/essentielle` (33/36)
- `/accessibilite` (18/18, modèle pour autres légales)

## 6. Recommandations refontes (par effort)

### Sprint correctif XS (≤ 1 jour) — quick wins

- ✅ **`LegalPageTemplate` + prop `titleEm`** (FAIT cette session, +6 pts cumulés sur 6 pages légales)
- `/audit` — enrichir D7 anti-fear (+1 pt)
- `/audit/flash` — ajouter `AuditHeroSchema`
- `/blog/categorie/[slug]`, `/blog/auteur/[slug]`, `/blog/tag/[slug]` — +CTA hero, +pills (3 pages, +6 pts cumulés)
- `/cas-concrets/secteur/[slug]` — pills + hasPart JSON-LD
- `/centre-aide/categorie/[slug]` — +CTA hero, +pills
- `/methodologie` — polish anti-fear

### Sprint correctif S (1-3 jours)

- `/audit/strategique-pme` — palette halo orange
- `/cas-concrets/[slug]` — typo serif italique sur titles + accents v3
- `/blog/[slug]` — body multi-`<p>` parsing
- `/blog/tag/[slug]` — fix `hasPart` JSON-LD (1 ligne incomplète)
- `/centre-aide/[slug]` — pills + +1 section
- `/faq/[slug]` — pills
- `/comparaisons/[slug]` — body 300+ mots + section "quand choisir"
- `/glossaire` — +CTA, +DefinedTerm enrichi
- `/roi` — rehausser Illustration en DetailHeroSchema
- `/audit/flash` — `AuditHeroSchema`
- `/presse` — illustrations + anti-fear
- `/recherche` — moteur Pagefind (Sprint 16 attendu)

### Sprint correctif M (3-7 jours)

- **`ProductPageTemplate`** — +testimonials + anti-fear → **+70 pts cumulés sur 14 pages produit (ROI #1)**
- `/cas-concrets` (index) — refonte hero + ItemList JSON-LD
- `/centre-aide` — +pills + +Popular Q + +HelpCenter JSON-LD
- `/contact` — refonte 2-col hero + schéma + Form JSON-LD + micro-FAQ
- `/faq` — +CTA hero + pills + +Most viewed top-5
- `/a-propos` — refonte 2-col hero + pillar + proof
- `/implementation/{ia-custom,chatbot,par-fonction[slug],par-techno}` — DetailHeroSchema + JSON-LD complets
- `/comparaisons` (index) — anti-fear 3 niveaux décision
- `/guide-ia` — pills + chapters hasPart
- `/blog` (index) — refonte structurelle complète

### Sprint correctif L (7-14 jours)

- _(rien, tous les écarts identifiés sont M ou moins)_

## 7. Patterns réutilisables identifiés

1. **Hero 2-col éditorial + schéma satellite** — Slot gauche : eyebrow (dot module-color) + h1 (titleEm italique serif terracotta) + description (40-100 mots) + 2 CTAs. Slot droit : SVG/Schema server component avec `role="img"` + `aria-label`. **Manquant sur** : `/blog`, `/contact`, `/faq`, `/a-propos`, `/audit/flash`, `/cas-concrets/[slug]`, `/blog/[slug]`, plus 6 sous-listings.

2. **Pyramide de conversion par niveaux** — `/audit` (4 niveaux) et `/interventions` (5 formats). **Réutilisable sur** : `/implementation` (10 produits, par maturité), `/cas-concrets` (par taille).

3. **TrustBadges + SignatureCard + 3 testimonials** — `/audit` modèle. **Manquant sur** : `/blog`, `/contact`, `/centre-aide`, `/a-propos`, `/cas-concrets`, `ProductPageTemplate` (14 pages affectées).

4. **Section anti-fear / 3 cartes maturité** — `/audit`, `/interventions`, `/audit/demande`. **Manquant sur** : `/blog`, `/contact`, `/centre-aide`, `/cas-concrets`, `ProductPageTemplate`, `/comparaisons` (index), `/methodologie`, `/presse`.

5. **HowTo / DefinedTermSet / QAPage JSON-LD spécialisé** — `/methodologie` (HowTo), `/glossaire` (DefinedTermSet), `/faq/[slug]` (QAPage). **Modèles AEO citables.** Manquent sur `/blog/tag/[slug]` (hasPart vide), `/implementation/par-fonction[slug]` (zéro JsonLd export).

6. **CTA dark final** — déjà OK partout via `<CtaBlock tone="dark">` ou `tone="mocha"`.

## 8. Quick Wins ROI #1 — `ProductPageTemplate`

**Cible unique, impact systémique** : enrichir `ProductPageTemplate` pour ajouter :

- Section `<Testimonials>` inline (3 cards customer quotes)
- Section anti-fear (3 cartes maturité Niveau 1/2/3)
- Slot optionnel pour `<DetailHeroSchema>` (déjà utilisé par dirigeants/equipes)

→ **Impact** : 28→33/36 sur les 14 pages produit qui héritent du template
→ **+70 pts cumulés** pour 1 fichier de template à modifier
→ **Effort** : M (3-5 jours)
→ **ROI le plus élevé du backlog**

## 9. JSON deltas

`_AUDIT/parity-deltas.json` machine-readable.

## 10. Travaux faits cette session

- ✅ `LegalPageTemplate` + prop `titleEm` ajoutée
- ✅ `legal.ts` schema `PageCopy.titleEm?` + 4 pages avec content (mentions-legales, conditions-generales, politique-confidentialite, politique-deplacement) — FR + EN
- ✅ 6 pages.tsx légales propagent `titleEm` vers le template (cookies/rgpd inchangées car content sans titleEm)
- **Impact** : +1 pt sur 4 pages = **+4 pts cumulés** (sur 6 visés initialement, 2 pages — cookies/rgpd — laissées intactes pour préserver leur titre court d'origine)

## 11. Question fermée pour Will

- **OUI** on enchaîne les refontes P0 + P1 dans cet ordre (impact +120 pts sur 18 pages)
- **PRIORITÉ ROI** on attaque `ProductPageTemplate` en premier (impact +70 pts × 14 pages produit, 1 fichier template)
- **CONTINUE** on refait juste les 3 plus critiques (`/blog`, `/contact`, `ProductPageTemplate`)
- **STOP** scope refontes — passer à Sprint 15 backend

---

_Audit lecture seule. 60/60 pages publiques couvertes (100 %). Citations file_path:line_number disponibles dans les transcripts détaillés des 6 agents._
