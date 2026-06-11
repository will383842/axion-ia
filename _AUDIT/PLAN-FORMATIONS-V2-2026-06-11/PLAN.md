# PLAN COMPLET (BLINDÉ) — Refonte catalogue formations V2

> Plan + journal anti-reset. Reprendre à la 1re case non cochée de « Progression ».
> Branche : `worktree-formations-ssot-skeleton`. Source contenu : `C:\Users\willi\Downloads\formations-axion-ia` (racine).
> Audit de complétude fait via 3 explorations (admin, routes/SEO, consommateurs/villes/secteurs).

## Décisions Will FIGÉES (2026-06-11)
1. Noms descriptifs (slugs : ia-express, art-du-prompt, ia-securite, ia-conformite, ia-fondamentaux, ia-commercial, ia-au-bureau, ia-sur-le-terrain, automatisations-decouverte, ia-integration-metier, ia-commercial-avance, ia-transformation-equipe, agents-automatisations, agents-automatisations-avance, claude-decouverte, claude-createur, claude-architecte).
2. Remplace l'offre /interventions, voix « formation ».
3. Tout derrière le flag `OF_PUBLIC_DISCLOSURE_ENABLED` (OFF) — site public actuel INCHANGÉ jusqu'à l'agrément.
4. Prix = matrice (gamme × durée × effectif), pas par formation.
5. Phasé : catalogue (P1-P6) d'abord ; kit pédagogique Qualiopi DB = PHASE B séparée.
6. 1-to-1 (Dirigeants/Coaching) NON touché maintenant.

## Faits techniques confirmés (audit)
- **Flag déjà existant** : `isQualiopiPublicDisclosureEnabled()` (`src/server/qualiopi/config/flag.ts`) + `/formations/[slug]` déjà gated. → RÉUTILISER, ne pas recréer.
- **Pricing ADDITIF obligatoire** : `INTERVENTION_TIERS` est consommé par 445 villes (`PricingGridVille`) + `/reserver` + offers-catalog + chatbot, tous LIVE/non-gated. ⚠️ NE PAS le modifier → créer une matrice neuve `FORMATION_PRICE_MATRIX` consommée uniquement par les nouvelles pages gated. Ancien intact jusqu'au flip.
- **OffreSite n'a pas de `gamme`** (`categorie` enum = `intervention` seul) → migration Prisma additive + colonnes admin.
- **Booking** : `InterventionType` (enum Prisma) + `lib/intervention-type.ts` (`INTERVENTION_SLUGS`, `SLUG_TO_TIER_ID`) + booking-catalog couplent /reserver. DÉCISION Q-B : 3 CTA dont calendrier → intégration ADDITIVE des 17 (ajout enum + slugs + mapping + booking-catalog). Migration Prisma additive (jamais de retrait), tests booking-catalog/intervention-type verrouillent les oublis.
- **Builders JSON-LD déjà présents** : Course, FaqPage (+ Speakable), HowTo, Breadcrumb, Organization → réutiliser.
- **Système mots-clés** : `src/content/keywords/**` (`KeywordSeed` + `master.ts` anti-cannibalisation) → ajouter un fichier de seeds des 17.
- **Secteurs** : pas de pages secteur (juste keywords + blog/secteur) → à créer pour le maillage (Phase 3).
- **Villes** : auto-dérivées de pricing → aucune modif tant qu'on ne touche pas `INTERVENTION_TIERS`.

## Décisions Q-A, Q-B — TRANCHÉES (Will 2026-06-11)
- **Q-A URL = `/formations/*` (UNIFIÉ)** : un seul catalogue (squelette SSOT) = une source, deux vues (public + Qualiopi back-office). `/formations/[slug]` rendu par le SQUELETTE (toujours) + overlay DB Qualiopi (quand publié). Anciens `/interventions/*` → 301 vers `/formations` au flip. « Remplace /interventions » = l'offre /interventions est remplacée par /formations (avec redirections, zéro lien mort).
- **Q-B Booking = LES 3 CTA** : « Nous écrire » + « Réserver un appel » + **réservation calendrier**. → intégration booking des 17 = ADDITIVE (ajout valeurs `InterventionType` enum Prisma + `INTERVENTION_SLUGS` + `SLUG_TO_TIER_ID` + booking-catalog). Non destructif (on n'enlève rien), pas de régression /reserver.
- **Mots-clés sémantiques** : PAS dans la KB. (1) sur le SQUELETTE par formation (`metaTitleFr`, `h1Fr`, `metaDescriptionFr`, `termesSemantiquesFr[]`, `faqs[]`) → la page dérive son SEO ; (2) seeds de stratégie dans `src/content/keywords/` (fichier groupe des 17) validés par `master.ts` (anti-cannibalisation).

---

## MATRICE DE COMPLÉTUDE (rien d'oublié)
| Dimension | Couvert en | Statut |
|---|---|---|
| **Backend — prix** | P1 (matrice additive `FORMATION_PRICE_MATRIX`) | planifié |
| **Backend — SSOT squelette** | P1 (gamme, brackets, objectifs, pré-requis, bénéfice, équation, featured, 17 formations, archétype 3j) | planifié |
| **Backend — Qualiopi offres** | P4 (17 OffreSite dérivées + reconcile) | planifié |
| **Backend — Prisma `gamme`** | P4 (champ additif OffreSite + migration) | planifié |
| **Console admin** | P5 (colonnes gamme/durée listes offres+formations ; le `new`/edit gèrent déjà l'offre) | planifié |
| **Qualiopi interne vs public** | transverse (flag gate public seulement ; admin ouvert hors agrément — confirmé) | acquis |
| **Frontend — flag** | P2 (réutilise `isQualiopiPublicDisclosureEnabled`) | planifié |
| **Frontend — listings par durée** | P2 | planifié |
| **Frontend — blocs gammes (Claude, Agents)** | P2 | planifié |
| **Frontend — 17 pages détail + sur-mesure** | P3 | planifié |
| **Routes (routing.ts pathnames)** | P3 (hub + 17 + gammes + tarifs) | planifié |
| **Redirects 301 (next.config.ts)** | P3 (anciens slugs → nouveaux, actifs au flip) | planifié |
| **Sitemap** | P3 (sub-sitemap `formations` via buildDynamic + slugs) | planifié |
| **JSON-LD** | P3 (Course + FaqPage + HowTo + Breadcrumb par page) | planifié |
| **Métadonnées (title/H1/meta)** | P3 (buildProductMetadata, H1 = bénéfice pas keyword) | planifié |
| **Mots-clés sémantiques** | P6 (fichier `KeywordSeed` des 17 : injection h1/metaTitle/metaDescription/h2/FAQ + champ sémantique ; validation `master.ts`) | planifié |
| **Page tarifs** | P3 (1 page tarifs dérivée de la matrice) | planifié |
| **FAQ AEO (FAQPage)** | P3 (longue traîne en FAQ balisée par page + hub) | planifié |
| **llms.txt / llms-full** | P3 (ajouter les formations aux exports) | planifié |
| **Booking /reserver (3 CTA + calendrier)** | P4 (enum additif + slugs + booking-catalog) | planifié |
| **SEO par formation (title/H1/meta/FAQ/sémantique) sur le squelette** | P1 + P6 | planifié |
| **Villes (445)** | aucune modif (pricing additif préserve l'existant) | acquis |
| **Tests anti-drift + E2E + Gate A** | P5 | planifié |
| **Bascule (flip) prête + doc** | P5 | planifié |
| **Pages piliers (financement OPCO, AI Act, comparatif, prix, persona, FAQ)** | PHASE 3 (Couche 2 SEO, après catalogue) | nommé |
| **10 pages secteurs + maillage formation↔secteur↔villes** | PHASE 3 (Couche 3) | nommé |
| **Kit pédagogique Qualiopi DB (programmes/supports/évals des 17)** | PHASE B (séparée) | nommé |
| **1-to-1 (Dirigeants/Coaching)** | hors périmètre (plus tard, même principe) | nommé |

---

## PHASES (chaque phase = 1 commit checkpoint + maj « Progression »)

### P1 — BACKEND : matrice prix additive + squelette V2 (0 page, 0 risque public)
- `pricing.ts` : AJOUTER `FORMATION_GAMME`/`FORMATION_DUREE`/`FORMATION_BRACKET` + `FORMATION_PRICE_MATRIX` + `getFormationPrice(gamme,duree,bracket)`. NE PAS toucher `INTERVENTION_TIERS`.
- `src/content/formations/` : archétype durée `3j` réel ; étendre `FormationSkeleton` (`gamme`, `brackets`, `prerequisFr`, `objectifsFr[]`, `beneficeDirigeantFr`, `equationTempsFr`, `featured`, `surMesure`, + **SEO par formation** : `metaTitleFr`, `h1Fr`, `metaDescriptionFr`, `termesSemantiquesFr[]`, `faqs[]`) ; **17 formations V2** (set distinct des anciens squelettes, qui restent pour l'existant jusqu'au flip) ; helpers `getFormationsByGamme/ByDuree`, `formationPrice(skeleton,bracket)`.
- Tests cohérence + matrice prix figée.

### P2 — FRONTEND : flag + listings durée + blocs gammes (réutilise composants)
- Réutiliser `isQualiopiPublicDisclosureEnabled()`.
- Listings par durée (4h/1j/2j/3j) + blocs Claude & Agents (bloc propre + rappel dans la durée) + hub 2 axes. Tous gated flag OFF.

### P3 — FRONTEND : 17 pages détail + routes + SEO + JSON-LD + tarifs
- 17 pages détail (réutilise ProductPageTemplate) dérivant du squelette (public, pré-requis, objectifs, programme matin/après-midi, bénéfice, équation, prix matrice). Pages sur-mesure + page tarifs.
- `routing.ts` (hub + 17 + gammes + tarifs), `next.config.ts` redirects (anciens → nouveaux, au flip), `sitemap.ts` (sub-sitemap formations), JSON-LD (Course+FaqPage+HowTo+Breadcrumb), `llms.txt`.

### P4 — BACKEND : Qualiopi offres + gamme + booking (Prisma additif)
- Migration additive `OffreSite.gamme` (+ valeurs enum) ; seed 17 OffreSite dérivées du squelette V2 (durée, public, prix matrice, gamme) + `reconcileOffresFromSkeleton`.
- **Booking** : ajout additif des 17 à `InterventionType` (enum Prisma) + `INTERVENTION_SLUGS` + `SLUG_TO_TIER_ID` + entrées booking-catalog (bookable) → 3 CTA (écrire / appel / calendrier). Jamais de retrait ; tests verrouillent.

### P5 — Console admin + tests + Gate A + bascule
- Admin : colonnes gamme/durée dans listes `/qualiopi/offres` et `/qualiopi/formations` ; vérif cohérence 17.
- Tests anti-drift transverses (matrice == pages == offres), E2E, Gate A, bundle check, snapshot « flag OFF = public inchangé », doc de bascule (flag ON + 301).

### P6 — Mots-clés sémantiques (SEO/AEO Couche 1) — PAS dans la KB
- Le SEO de chaque page (title/H1/meta/FAQ/termes sémantiques) vit sur le SQUELETTE (P1) → la page dérive. (1 source par formation.)
- Fichier de groupe `src/content/keywords/g…-formations-v2.ts` : seeds de STRATÉGIE des 17 (requête principale/secondaires/longue traîne/champ sémantique du fichier mots-clés) → validés par `master.ts` (anti-cannibalisation, 1 HEAD/URL). FAQPage par page + hub.

### PHASE 3 (après catalogue) — Couches SEO 2 & 3
Pages piliers (guide financement OPCO 11 OPCO, guide AI Act art.4, comparatif honnête, page prix/simulateur, personas dirigeant/DRH/DSI, FAQ générale) + 10 pages secteurs + maillage formation↔secteur↔villes.

### PHASE B (séparée) — Kit pédagogique Qualiopi DB
Programmes détaillés, supports participant, évaluations, fiches prompts, guides formateur des 17 en DB + génération Formation Engine. Sources = dossiers `01-17/*` + `00-fondations`.

### Hors périmètre — 1-to-1 (plus tard, même principe).

---

## Progression (sauvegarde anti-reset)
- [x] Exploration catalogue + contenu/tarifs + mots-clés
- [x] Audit complétude (admin / routes-SEO / consommateurs-villes-secteurs)
- [x] PLAN blindé + matrice complétude (ce doc)
- [x] Décisions Q-A (URL = /formations) & Q-B (booking 3 CTA additif) confirmées
- [x] **P1 backend FAIT** : matrice prix (`pricing.ts` FORMATION_PRICE_MATRIX, additif) + `src/content/formations/catalog-v2.ts` = 17 formations (IA 12 · Agents 2 · Claude 3 ; durées 4h:4/1j:6/2j:4/3j:3), contenu FR complet (public, objectifs, programme, bénéfice, équation, SEO h1/metaTitle/metaDescription/termes/faqs), prix dérivés matrice (0 hardcode), 2-axes testé. Commits P1.1→P1.4. 20 tests + hook typecheck verts.
  - RESTE mineur (à faire en P2/P3) : 7 variantes « Sur mesure » (cartes CTA devis, pas de prix/programme) ; helper durée→ISO 8601 (4h→PT4H, 1j→PT7H, 2j→P2D, 3j→P3D) pour le JSON-LD Course.
- [x] **P2 frontend FAIT** : flag réutilisé + meta layer (catalog-v2-meta) + pages `/formations` (hub 2 axes), `/formations/duree/[duree]`, `/formations/gamme/[gamme]` (Claude/Agents), `/formations/tarifs` (matrice dérivée) + `FormationCardV2`. Toutes gated Phase A. Commits P2.1-P2.2. typecheck+eslint+tests verts.
- [x] **P3.1 FAIT** : `FormationDetailV2` (fiche complète SSOT : objectifs, déroulé, bénéfice, équation, tarifs/effectif, FAQ→FAQPage, Course JSON-LD, 3 CTA) + dispatch `/formations/[slug]` (catalogue prioritaire, fiche DB legacy fallback) + generateStaticParams catalogue. Commit P3.1. **Catalogue navigable de bout en bout.**
- [x] **Audit adversarial (6 agents) FAIT** : 4 dims parfaites (fidélité source, FR-only, flag-gating, 0 hex) ; corrections appliquées : de-drift prix M1/M2 (test reverdi), locale-prefix M3 (307 hops), metaTitle #6. Commit `fix(formations) audit`.
- [x] **Finisher (3 agents //) FAIT** : SEO polish catalog-v2 (metaTitles, 13 descriptions ≤160, 4 h1≠accroche, termes, +1 FAQ/formation, catalog-v2-seo.test) + sitemap `/formations` flag-gated (sitemap.ts) + seeds mots-clés `g2n-formations-v2.ts` (72 seeds, KEYWORDS_FORMATIONS_V2). typecheck global 0.
- [x] **P3.2 (sitemap) FAIT** via finisher. routing.ts entries = optionnel (pages marchent sans). Redirects 301 /interventions→/formations = AU FLIP seulement.
- [x] **P6 (mots-clés) FAIT** (fichier seeds). ⚠️ Registration dans `master.ts` = DIFFÉRÉE AU FLIP (sinon cannibalisation avec les anciens keywords /interventions ; même principe additif). Le fichier est le SSOT prêt, non activé.
- [ ] **P4 backend — ⚠️ STOP & ASK (le seul restant)** : offres Qualiopi 17 + champ `gamme` (migration Prisma) + booking enum. Migration DB = coordination Will (numérotation, dev DB, worktree partage prisma/generated avec repo principal). NE PAS lancer `prisma migrate` sans accord.
- [ ] P5 admin (colonnes gamme) — dépend de P4 (champ gamme en DB). + bascule (flip) documentée.
