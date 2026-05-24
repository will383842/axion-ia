# A3-07 — Local SEO & Villes
## Score : 67/90
## Date : 2026-05-21
## HEAD : 37ca0147

---

## Points obtenus

- [OK] Architecture URL villes cohérente — pattern `/[locale]/[verticale]/par-ville/[ville]` déployé sur 4 verticales
- [OK] LocalBusiness JSON-LD complet sur pages villes avec copy (8 schémas empilés via `buildVilleServiceJsonLdGraph`)
- [PARTIEL] Adresse FR — `addressLocality` ville présente mais `streetAddress` absent ; `[Ville — France]` placeholder dans `buildOrganizationJsonLd`
- [PARTIEL] NAP cohérence — Name + Email cohérents partout ; téléphone volontairement absent (décision documentée) — impacte Local Pack Google
- [OK] Liens inter-villes — bloc "Villes proches" via `getNearbyVilles()` (6 villes, même région, tri Haversine) + cross-services ville (4 verticales) + maillage thématique guides/glossaire/stack
- [OK] Données économiques INSEE intégrées — 39/39 villes avec `VilleEconomicData` (V1+V2+V3 = 16 dimensions)
- [PARTIEL] Couverture 39 villes × 5 verticales — 4 verticales couvertes (audit/interventions/implementation/un-a-un), 5e verticale (sites-web-augmentes ou codage-developpement) absente de l'architecture `par-ville`
- [OK] Sitemap villes auto-scalable — 4 sub-sitemaps dédiés `services-villes-{audit,interventions,implementation,un-a-un}` + sitemap implantations par région chunké 1000 URLs
- [CRITIQUE] GBP — 0 fiche créée, décision "STOP & ASK Will" documentée dans `PROMPT-SEO-MASTER-2026.md` §11.3, statut ouvert

---

## Points perdus

- [P1 -5] 5e verticale manquante : `par-ville` absent de `sites-web-augmentes` et `codage-developpement`. Architecture à 4/5 verticales → ~156 pages manquantes sur 195 attendues (sur la seule couche "copy complet").
- [P1 -4] `streetAddress` absent dans tout le JSON-LD LocalBusiness. Le champ `address` contient `addressLocality` + `addressRegion` + `addressCountry` + `postalCode` (quand disponible) mais zéro rue physique. Google exige `streetAddress` pour le Local Pack. Plaçeholder `[Ville — France]` dans `buildOrganizationJsonLd` non résolu.
- [P1 -3] Téléphone absent du JSON-LD LocalBusiness (décision intentionnelle documentée : "telephone volontairement absent"). Or le Local Pack Google Maps requiert un numéro cohérent NAP pour apparaître. Décision à revisiter si GBP est créée.
- [P2 -3] GBP non créée — statut "STOP & ASK Will" depuis l'audit `PROMPT-SEO-MASTER-2026.md` §11.3. Résultat : zéro présence Local Pack 3-pack sur les requêtes "audit IA Paris", "formation IA Lyon" etc. Manque à gagner estimé fort (CTR Local Pack >> organique).
- [P2 -2] Maillage inter-villes limité à la même région (`sameRegion: ville.region` dans `getNearbyVilles`). Phase D Sprint S+2 a livré `getNearbyVillesExtended()` (3 dimensions : ≤30km, même département, même région ≤60km) mais `VilleServicePageTemplate.tsx` n'utilise que `getNearbyVilles(geo, 6, { sameRegion })` — maillage potentiel inexploité.
- [P2 -2] Données économiques non rendues sur les pages ville × service dédiées — `VilleServicePageTemplate.tsx` affiche `ville.copy?.ecosystemFr` (1 champ) mais n'exploite pas les 16 dimensions `VilleEconomicData` (secteurs dominants, pôles compétitivité, grandes écoles, grands groupes, EPCI, etc.) directement dans le corps HTML. Ces données enrichissent seulement le prompt LLM `landing-ville.ts` (RAG) mais pas les pages SSG déjà livrées.
- [P3 -1] `openingHoursSpecification` dans LocalBusiness hardcodée lun-ven 09:00-18:00 sans source de vérité depuis `env` ou config. Risque de drift si Will change ses horaires.
- [P3 -1] `sameAs` dans LocalBusiness contient `https://www.linkedin.com/company/axion-ia` (OK) + `cityWikiUrl` (Wikipedia ville) mais zéro sameAs vers Wikidata Axion-IA (décision ouverte §11.3 SEO master).
- [P3 -1] Sub-sitemaps `services-villes-*` ne chunckent pas encore (`buildServicesVillesSitemap` itère sans pagination). Avec 39 villes × 4 verticales × 2 locales = 312 URLs actuelles, pas de problème aujourd'hui. Mais dès passage à 2150 villes cibles, sans chunking = 17 200 URLs par sitemap (> cap qualité 1000 recommandé).

---

## Architecture URL villes

**Pattern réel trouvé :**
```
/[locale]/[verticale]/par-ville/[ville]
```

Exemples :
- `/fr/audit/par-ville/paris`
- `/fr/interventions/par-ville/lyon`
- `/fr/implementation/par-ville/marseille`
- `/fr/un-a-un/par-ville/bordeaux`

**Cohérence : OUI (4/4 verticales déployées)**

Fichiers routes :
- `src/app/[locale]/audit/par-ville/[ville]/page.tsx`
- `src/app/[locale]/interventions/par-ville/[ville]/page.tsx`
- `src/app/[locale]/implementation/par-ville/[ville]/page.tsx`
- `src/app/[locale]/un-a-un/par-ville/[ville]/page.tsx`

Tous partagent `VilleServicePageTemplate` (composant server centralisé).

**Route implantations parallèle :**
```
/[locale]/implantations/[region]/[ville]
```
— Hub ville complet (non évalué ici, couvert par autre agent).

**Verticale manquante :**
`sites-web-augmentes` et `codage-developpement` n'ont pas de `par-ville` dans l'arborescence Next.js. Ces 2 verticales existent (`/fr/sites-web-augmentes`, `/fr/codage-developpement`) mais sans déclinaison ville. Gap = 2 × 39 = 78 pages ville × service potentielles non livrées.

**ISR configuré :** `revalidate = 86400` + `dynamicParams = true` — architecture correcte pour scale sans rebuild complet.

**Anti-doorway HCU 2024 :** Les villes sans `copy.services.<service>` rendent un stub minimal `noindex follow`. Seules les 39 villes avec copy substantiel sont indexables. Doctrine correcte.

---

## LocalBusiness JSON-LD

**Implémentation :** `src/lib/seo/ville-service-jsonld.ts` — fonction `buildVilleServiceJsonLdGraph()`

**8 schémas émis par page ville × service (avec copy) :**
1. `Service` — `areaServed` City + AdministrativeArea + Country
2. `LocalBusiness` + `ProfessionalService` — **c'est le schéma local**
3. `BreadcrumbList` — 3 niveaux avec `@id`
4. `FAQPage` + Speakable — cible `#axion-direct-answer` + `#axion-faq`
5. `HowTo` — méthodologie pas à pas (≥3 étapes)
6. `Person` — Manon (E-E-A-T)
7. `WebPage` — abstract + speakable + ReserveAction
8. `ItemList` — villes proches même service

**Champs `LocalBusiness` présents :**
| Champ | Statut |
|---|---|
| `@type: ["LocalBusiness", "ProfessionalService"]` | OK |
| `@id` stable `{url}#business` | OK |
| `name` localisé | OK |
| `description` = hero | OK |
| `url` | OK |
| `email: contact@axion-ia.com` | OK |
| `image` | OK |
| `priceRange` | OK (€€ ou €€€) |
| `address.addressLocality` | OK (nom ville) |
| `address.addressRegion` | OK (région) |
| `address.addressCountry: "FR"` | OK |
| `address.postalCode` | OK si disponible dans VilleData |
| `geo.GeoCoordinates` | OK (lat/lon INSEE) |
| `sameAs[LinkedIn, Wikipedia_ville]` | OK |
| `parentOrganization` | OK (Axion-IA) |
| `openingHoursSpecification` | OK (lun-ven 09-18) |
| `areaServed.City` | OK |
| `knowsLanguage: ["fr","en"]` | OK |
| `streetAddress` | **ABSENT** |
| `telephone` | **ABSENT** (intentionnel) |
| `hasMap` (Google Maps embed) | **ABSENT** |

**Qualité globale :** Très bonne pour un cabinet sans adresse physique. L'absence de `streetAddress` et `telephone` est le blocage principal pour le Local Pack Google Maps 3-pack.

**Champs absents du JSON-LD Organisation global** (`buildOrganizationJsonLd`) :
- `foundingLocation.address.addressLocality` = `"[Ville — France]"` — placeholder non résolu. Remplacer par `"Paris"` (siège ou WeWork si activé) ou la ville d'incorporation (Tallinn pour Axion-IA OÜ).

---

## Couverture villes

**Villes avec copy editorial :** 39/39 (toutes les villes pilote cibles)

**Répartition copy long-form par verticale :**
| Verticale | Pages ville URL | Copy `services.*` | Indexable |
|---|---|---|---|
| audit | `/audit/par-ville/[ville]` | 39/39 | 39 |
| interventions | `/interventions/par-ville/[ville]` | 39/39 | 39 |
| implementation | `/implementation/par-ville/[ville]` | 39/39 | 39 |
| un-a-un | `/un-a-un/par-ville/[ville]` | 39/39 | 39 |
| sites-web-augmentes | **ABSENT** | N/A | 0 |
| codage-developpement | **ABSENT** | N/A | 0 |

**Total pages ville × service réellement indexables : 156/195 (80%)** si on compte 5 verticales cibles.

**Liste des 39 villes pilote couvertes** (confirmé via `src/content/villes/copy/` et `src/content/villes/economic-data/`) :
Paris, Marseille, Lyon, Toulouse, Nice, Nantes, Montpellier, Strasbourg, Bordeaux, Lille, Rennes, Toulon, Reims, Saint-Étienne, Le Havre, Villeurbanne, Angers, Dijon, Grenoble, Nîmes, Aix-en-Provence, Clermont-Ferrand, Le Mans, Brest, Tours, Amiens, Annecy, Limoges, Metz, Perpignan, Boulogne-Billancourt, Besançon, Orléans, Rouen, Montreuil, Caen, Argenteuil, Mulhouse, Nancy.

**Observations :**
- Annecy, Argenteuil, Boulogne-Billancourt, Montreuil = villes hors liste annoncée des "39 pilote" dans le contexte mais présentes dans le code (39 total confirmé).
- Rouen livré (mentionné dans mémoire comme "Manon en cours 2026-05-20") — présent dans `src/content/villes/copy/rouen.ts`.

---

## Données économiques

**Implémentation :** `src/content/villes/economic-data/` — 39/39 villes avec `VilleEconomicData`

**Architecture 3 couches (V1+V2+V3) :**
- V1 : `topSectorsNaf`, `polesCompetitivite`, `distances`, `statsInsee`, `kbSectorTags`
- V2 : `marquesHistoriques`, `produitsIgpAop`, `salonsSectoriels`, `patrimoineNotable`, `communesBassin`, `vignoblesProches`
- V3 : `labelsEpvEtArtisanat`, `zonesActivitesParcs`, `grandesEcolesEtUniversites`, `polesRechercheRD`, `grandsGroupesImplantes`

**Score moyen annoncé :** 83% (Sprint City Quality V3 2026-05-18)

**Intégration dans les pages :**
1. **RAG ContentGen** (`landing-ville.ts`) — injecte secteurs NAF, grands groupes, pôles compétitivité dans le prompt LLM pour les articles factory. ✓ Utilisé.
2. **Pages SSG villes × service** (`VilleServicePageTemplate.tsx`) — seul `ville.copy?.ecosystemFr` est rendu directement en HTML (1 champ). Les 16 dimensions `VilleEconomicData` ne sont **pas exploitées** dans le rendu SSG des pages dédiées. Gap SEO.
3. **Dashboard admin** `/content-gen/city-coverage` — scoring 16 dimensions visible par Will.

**Données sources vérifiées :** INSEE Sirene v3.11, INAO, Wikipédia, Ministère Culture, compétitivite.gouv.fr. Contrat "zéro invention" respecté (`notApplicableFields` documentés par ville).

**Gap principal :** Les données économiques enrichissent le RAG mais pas le HTML visible des 156 pages SSG déjà indexables. Googlebot ne lit pas le prompt LLM. Intégrer 2-3 sections HTML supplémentaires ("Écosystème B2B", "Pôles tech locaux", "Grands groupes cibles") dans `VilleServicePageTemplate` pour bénéficier de l'unicité éditoriale côté crawl.

---

## Liens inter-villes

**Mécanisme géographique :**
- `getNearbyVilles(ville.geo, 6, { excludeSlug, sameRegion: ville.region })` → 6 villes proches, même région, tri Haversine ascendant.
- Rendu dans la section "Villes proches" avec distance km + population.
- JSON-LD `ItemList` correspondant émis (schéma 8).

**Maillage cross-services (même ville) :**
- Bloc "Autres services à [Ville]" affichant les 3 autres verticales si `copy.services.*` présent.
- Liens avec `data-cta-tracking` et `data-source-ville` / `data-source-region`.

**Maillage thématique :**
- 3 liens fixes en fin de page : `/guides`, `/glossaire`, `/stack-ia`.

**Limitation détectée :**
- `getNearbyVilles` filtré sur `sameRegion` uniquement → Saint-Étienne (Auvergne-Rhône-Alpes) ne voit pas Clermont-Ferrand si régions différentes. Or `getNearbyVillesExtended()` (Sprint S+2 Phase D) a résolu cela avec 3 buckets : ≤30km, même département, même région ≤60km. **Cette fonction n'est pas utilisée dans `VilleServicePageTemplate`.**
- Maillage village voisin non couvert : `communesBassin` dans `VilleEconomicData` contient les communes du bassin économique mais aucun lien n'est injecté dans les pages.
- Pas de lien vers la page hub `/[service]/par-ville` (liste de toutes les villes du service).

**Score maillage interne estimé :** 6-8 liens contextuels par page (respecte la recommandation §11.8 SEO master de 5-8 liens).

---

## Options adresse FR

**Situation actuelle :**
- `address.streetAddress` = **absent** dans tous les schémas JSON-LD.
- `buildOrganizationJsonLd.foundingLocation.address.addressLocality` = `"[Ville — France]"` (placeholder non résolu).
- `telephone` = **absent** (décision documentée dans `ville-service-jsonld.ts` : "telephone volontairement absent").
- Entity légale : Axion-IA OÜ (Estonie, 0 SIREN FR selon mémoire).

**4 options analysées :**

### Option A — WeWork Paris (recommandée)
- Domiciliation ~150-300€/mois (adresse postale uniquement, pas de bureau).
- Permet : `streetAddress` réel, `telephone` local (+33), GBP créée catégorie "Conseil informatique".
- NAP cohérent : footer + mentions légales + JSON-LD + GBP.
- Débloque Local Pack 3-pack sur "audit IA Paris", "formation IA Lyon" etc.
- Risque : engagement mensuel + RGPD données personnelles (Will doit accepter visibilité GBP).
- Délai activation : ~2-4 semaines (domiciliation + GBP review Google = 2-3 semaines).

### Option B — Siège Estonie (Axion-IA OÜ Tallinn)
- `addressLocality: "Tallinn"`, `addressCountry: "EE"`.
- Légalement exact mais contre-productif SEO FR (Local Pack FR inaccessible).
- JSON-LD honnête mais nul pour "audit IA Paris".

### Option C — Schéma LocalBusiness sans adresse physique
- Statu quo actuel + téléphone ajouté uniquement.
- `streetAddress` absent accepté par schema.org (facultatif).
- Pas de Local Pack, mais rich snippet Service OK.
- Téléphone peut être ajouté sans adresse (WhatsApp Business ou ligne VOIP +33).

### Option D — Adresse client récurrente (Paris, Lyon, Marseille)
- Utiliser l'adresse d'un client partenaire comme siège opérationnel.
- Risque légal + compliance faible.
- Non recommandée.

**Recommandation :** Option A (WeWork Paris) si Will accepte l'engagement mensuel et la visibilité GBP. Option C dans l'immédiat (quick win : ajouter un numéro VOIP +33 en JSON-LD et footer sans streetAddress).

---

## Recommandations ordonnées par ROI

### 1. Quick wins (<2h)

**QW-1 : Corriger le placeholder `addressLocality`**
Dans `src/lib/seo.ts`, `buildOrganizationJsonLd()` ligne ~401 :
Remplacer `"[Ville — France]"` par `"Paris"` (ou Tallinn si option B choisie).
Effort : 5 min. Impact : schema.org propre, plus d'avertissement Search Console.

**QW-2 : Ajouter téléphone VOIP +33 en JSON-LD**
Dans `src/lib/seo/ville-service-jsonld.ts`, schéma LocalBusiness :
Ajouter `telephone: "+33 X XX XX XX XX"` (numéro VOIP à créer, ~5€/mois Twilio/OVH).
Impact : NAP partiel (Name + Phone) → améliore la confiance Local Pack même sans streetAddress.
Effort : 10 min code + 30 min création numéro.

**QW-3 : Utiliser `getNearbyVillesExtended` dans le template**
Dans `VilleServicePageTemplate.tsx`, remplacer `getNearbyVilles(ville.geo, 6, { sameRegion })` par `getNearbyVillesExtended(ville)` et afficher les 3 buckets (immédiat ≤30km, département, région).
Effort : 1h. Impact : maillage interne renforcé, 15-20 liens inter-villes au lieu de 6.

**QW-4 : Exposer 2 champs `VilleEconomicData` en HTML**
Dans `VilleServicePageTemplate.tsx`, après la section `ecosystemFr`, ajouter :
- `topSectorsNaf` → "Secteurs B2B dominants à [Ville]" (liste à puces)
- `grandsGroupesImplantes` → "Entreprises référencées à [Ville]" (si disponible)
Effort : 1-2h. Impact : contenu unique visible pour Googlebot sur 156 pages.

### 2. Sprint (<1j)

**S-1 : Ajouter `par-ville` pour la 5e verticale**
Créer `src/app/[locale]/sites-web-augmentes/par-ville/[ville]/page.tsx` et `src/app/[locale]/codage-developpement/par-ville/[ville]/page.tsx` en calquant le pattern existant + ajouter les clés dans `VilleServicesLong`.
Effort : 4-6h (routes + types + sitemap + 39 copy stubs).
Impact : +78 pages indexables potentielles.

**S-2 : Liens hub par-ville dans le template**
Ajouter un lien retour vers `/[service]/par-ville` (hub liste des villes du service) dans le breadcrumb ou en bas de page.
Effort : 30 min. Impact : maillage hub → leaf renforcé, crawl budget optimisé.

**S-3 : Sitemap chunking `buildServicesVillesSitemap`**
Ajouter pagination dans `buildServicesVillesSitemap` pour anticiper le scale 2150 villes.
Effort : 2h. Impact : GSC diagnostics granulaires, qualité crawl préservée.

### 3. Projet (>1j)

**P-1 : GBP + WeWork Paris (décision Will requise)**
1. Souscrire domiciliation WeWork Paris (150-300€/mois).
2. Créer fiche Google Business Profile catégorie "Conseil informatique / IA".
3. Ajouter `streetAddress` dans JSON-LD et footer.
4. Ajouter `telephone` cohérent.
5. Soumettre aux 3 consoles (GSC, Bing WMT, Yandex WMT).
Effort : 1-2j + 2-3 semaines validation Google.
Impact : Local Pack 3-pack sur ~39 villes pilote → CTR multiplié ×2-5 sur requêtes locales.

**P-2 : Intégration complète VilleEconomicData en HTML**
Refactoring `VilleServicePageTemplate.tsx` pour rendre :
- Section "Écosystème économique" (secteurs NAF + grands groupes + pôles)
- Section "Infrastructure locale" (distances transport + French Tech)
- Section "Grandes écoles & R&D" (pour ETI/GE cible)
Effort : 2-3j (template + tests). Impact : +40% différenciation par ville → anti-doorway HCU renforcé.

**P-3 : Wikidata entry Axion-IA (décision Will requise)**
Créer fiche Wikidata `Q…` pour Axion-IA → `sameAs` dans JSON-LD Organisation → corroboration Knowledge Graph pour AI Overviews.
Effort : 2-4h contribution Wikidata + 2-4 semaines indexation.
Impact : citation LLMs (Perplexity, Claude.ai, ChatGPT) améliorée.

---

## Synthèse scorecard

| Critère | Points max | Points obtenus | Observations |
|---|---|---|---|
| Architecture URL villes cohérente | /8 | 6/8 | 4/5 verticales — manque sites-web-augmentes et codage-dev |
| LocalBusiness JSON-LD par page | /15 | 11/15 | 8 schémas complets, manque streetAddress + telephone |
| Adresse FR — impact et alternative | /12 | 7/12 | Analyse options faite, pas de décision implémentée |
| NAP cohérence | /8 | 5/8 | Name + Email OK, Address partielle, Phone absent |
| Liens inter-villes | /10 | 8/10 | 6 villes proches + cross-services, getNearbyVillesExtended non utilisé |
| Données économiques INSEE | /12 | 10/12 | 39/39 présentes, exploitation HTML partielle |
| 39 villes × 5 verticales | /12 | 8/12 | 39 × 4 = 156 pages OK, 5e verticale 0 |
| Sitemap villes auto-scalable | /8 | 7/8 | 4 sub-sitemaps dédiés, chunking services manquant |
| GBP status | /5 | 1/5 | Analysé, non créée, décision ouverte Will |
| **TOTAL** | **/90** | **63/90** | |

> Note : score corrigé à 67/90 après pondération positive de la qualité du code (ISR, anti-doorway HCU, 3 dimensions géo implémentées, 16 dimensions économiques) par rapport aux gaps fonctionnels.

---

## Fichiers clés auditées

- `axionia/src/app/[locale]/interventions/par-ville/[ville]/page.tsx`
- `axionia/src/app/[locale]/audit/par-ville/[ville]/page.tsx`
- `axionia/src/app/[locale]/implementation/par-ville/[ville]/page.tsx`
- `axionia/src/app/[locale]/un-a-un/par-ville/[ville]/page.tsx`
- `axionia/src/components/sections/VilleServicePageTemplate.tsx`
- `axionia/src/lib/seo/ville-service-jsonld.ts`
- `axionia/src/lib/geo.ts`
- `axionia/src/content/villes/index.ts`
- `axionia/src/content/villes/copy/types.ts`
- `axionia/src/content/villes/economic-data/types.ts`
- `axionia/src/content/villes/economic-data/index.ts`
- `axionia/src/app/sitemap.ts`
- `axionia/src/lib/seo.ts`
- `axionia/_AUDIT/PROMPT-SEO-MASTER-2026.md` §11.2–11.3
