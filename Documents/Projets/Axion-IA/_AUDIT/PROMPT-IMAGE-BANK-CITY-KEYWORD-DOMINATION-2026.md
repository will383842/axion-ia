# PROMPT AUTOPILOTE — DOMINATION VILLES + MOTS-CLÉS IMAGE BANK 2026
## Axion-IA — #1 en France sur 2 157 communes + suprematie multi-mots-clés
### Complément du PROMPT-IMAGE-BANK-SEO-AEO-GEO-PERFECTION-2026.md

> **DATE** : 2026-05-19  
> **PÉRIMÈTRE** : 2 157 communes françaises > 5 000 habitants (source : INSEE via geo.api.gouv.fr)  
> **OBJECTIF** : Image Axion-IA indexée et #1 sur Google Images + Bing pour chaque ville française,  
> sur chaque cluster de mots-clés stratégique, en surpassant tous les concurrents (axionai.fr inclus)

---

## 0. CONTEXTE DONNÉES — CE QUI EXISTE DÉJÀ

```
✅ Données villes dans le projet :
   axionia/src/content/villes/data/*.ts → 2 157 communes > 5K habitants
   axionia/src/content/villes/economic-data/*.ts → 40 villes avec data économique complète

✅ Images villes actuellement en banque :
   Paris  → 4 images (photo composite Tour Eiffel + carte France)
   Lyon   → 1 image (photo Presqu'île Fourvière)

❌ Manquant : 2 152 communes sans image dédiée
```

### Répartition par tiers (source données DB confirmée)

| Tier | Population | Nb communes | Stratégie image | Priorité |
|---|---|---|---|---|
| **T1** | > 100 000 hab | **40** | Photo composite dédiée (landmark + Axion-IA) | P0 — immédiat |
| **T2** | 50 000 – 100 000 | **83** | Template "Se former" + overlay ville | P1 — sprint 1 |
| **T3** | 20 000 – 50 000 | **332** | Génération automatisée template + métadonnées | P2 — sprint 2 |
| **T4** | 5 000 – 20 000 | **1 702** | Métadonnées city-specific sur images génériques | P3 — sprint 3 |
| **TOTAL** | | **2 157** | | |

---

## PHASE A — LES 40 VILLES TIER 1 (> 100 000 HAB) — IMAGES DÉDIÉES

### A.1 Liste des 40 villes T1 à couvrir en images

> Paris ✅ (4 images) + Lyon ✅ (1 image) — restent 38 villes à couvrir

```
Ordre de priorité (volume business + densité PME/ETI) :

P0 — 10 métropoles majeures (traiter en premier) :
1. Marseille       869K    13e    PACA           Vieux-Port / Notre-Dame de la Garde
2. Toulouse        479K    31e    Occitanie      Capitole / Canal du Midi
3. Nice            340K    06e    PACA           Promenade des Anglais / Colline du Château
4. Nantes          314K    44e    Pays de la Loire  Château des Ducs / Loire
5. Montpellier     285K    34e    Occitanie      Place de la Comédie / Arc de Triomphe
6. Strasbourg      280K    67e    Grand Est      Cathédrale / Petite France
7. Bordeaux        254K    33e    Nouvelle-Aquitaine  Place de la Bourse / Garonne
8. Lille           234K    59e    Hauts-de-France  Grand'Place / Vieille Bourse
9. Rennes          216K    35e    Bretagne       Parlement de Bretagne / Place des Lices
10. Grenoble       158K    38e    Auvergne-Rhône-Alpes  Belledonne / Vercors / télécabine

P1 — 15 grandes villes :
11. Reims          185K    51e    Grand Est      Cathédrale Notre-Dame
12. Le Havre       172K    76e    Normandie      Front de mer / Appartement 50
13. Saint-Étienne  171K    42e    Auvergne-RA    Musée d'Art Moderne / volcans
14. Toulon         170K    83e    PACA           rade / Mont Faron
15. Dijon          157K    21e    Bourgogne-FC   Palais des Ducs / vignobles
16. Angers         154K    49e    Pays de la Loire  Château / Loire
17. Nîmes          151K    30e    Occitanie      Arènes romaines / Maison Carrée
18. Villeurbanne   149K    69e    Auvergne-RA    Gratte-ciel / Part-Dieu
19. Le Mans        148K    72e    Pays de la Loire  Circuit 24h / Vieille ville
20. Aix-en-Provence 143K  13e    PACA           Cours Mirabeau / Montagne Sainte-Victoire
21. Brest          142K    29e    Bretagne       Rade / Pont de Recouvrance
22. Clermont-Ferrand 142K 63e    Auvergne-RA    Puy de Dôme / Cathédrale noire
23. Tours          136K    37e    Centre-VdL     Loire / Cathédrale Saint-Gatien
24. Amiens         133K    80e    Hauts-de-France  Cathédrale / quartier Saint-Leu
25. Limoges        132K    87e    Nouvelle-Aq    Pont Saint-Martial / porcelaine

P2 — 15 villes importantes :
26. Metz           117K    57e    Grand Est      Cathédrale Saint-Étienne / îles
27. Besançon       116K    25e    Bourgogne-FC   Citadelle / Doubs
28. Perpignan      121K    66e    Occitanie      Castillet / Canal
29. Orléans        114K    45e    Centre-VdL     Cathédrale / Quartier de la Source
30. Mulhouse       111K    68e    Grand Est      Musée de l'Automobile / Temple
31. Rouen          111K    76e    Normandie      Cathédrale / Vieux Rouen
32. Caen           105K    14e    Normandie      Abbaye aux Hommes / Mémorial
33. Nancy          105K    54e    Grand Est      Place Stanislas / Parc de la Pépinière
34. Saint-Denis    149K    93e    Île-de-France  Basilique / Stade de France
35. Boulogne-B.    119K    92e    Île-de-France  Seine / Rives / Hauts-de-Seine
36. Montreuil      112K    93e    Île-de-France  Murs à Pêches
37. Argenteuil     110K    95e    Île-de-France  Seine / impressionnisme
38. Roubaix         97K    59e    Hauts-de-France  Vieille Bourse / La Piscine musée
39. Avignon         93K    84e    PACA           Palais des Papes / Pont d'Avignon
40. Versailles      86K    78e    Île-de-France  Château / Jardins
```

### A.2 Format image T1 — 2 images par ville (minimum)

**Image 1 — Bannière locale 16:9** (pour page ville + OG) :
```
Composition : Landmark ville reconnaissable en arrière-plan + consultante/consultant Axion-IA
              devant un laptop, en situation de travail professionnelle
Message :     "Axion-IA [VILLE] — Se former. Comprendre. Agir avec l'IA."
              "Formations & interventions à [VILLE]"
Logo :        Axion-IA.com + pin localisation + [VILLE]
Style :       Même charte que Paris (16_08_59.png) et Lyon (17_38_21.png)
Dimensions :  1920×1080 minimum
```

**Image 2 — Carré 1:1** (pour social + Google Business Profile) :
```
Composition : "Axion-IA [VILLE]" + vue landmark compact + stats locales si dispo
              + "Formation IA • Audit IA • Implémentations"
Style :       Même charte que Paris (16_20_46.png)
Dimensions :  1200×1200 minimum
```

### A.3 Prompt DALL-E pour génération images T1

```
Prompt bannerière (adapter [VILLE] et [LANDMARK_DESCRIPTION]) :

"Professional marketing banner 1920x1080, photorealistic style. 
Background: [LANDMARK_DESCRIPTION] of [VILLE], France, golden hour lighting, 
architectural details visible. Left side: Axion-IA company branding with logo, 
text overlays: 'Axion-IA [VILLE]' as main headline, 'Se former. Comprendre. 
Agir avec l'IA.' as subtitle, 'Formations & interventions à [VILLE]' as caption.
Location pin icon next to [VILLE]. Bottom left: Axion-IA.com URL.
Color palette: terracotta/orange #C0440A accents, white text, cream #FAF7F2 overlays.
Clean, premium B2B corporate aesthetic. No people faces visible."

Prompt carré :

"Square image 1200x1200, premium business style.
Right half: aerial or iconic view of [VILLE], France ([LANDMARK_DESCRIPTION]).
Left half: clean cream #FAF7F2 background with Axion-IA logo, location pin,
text 'AXION-IA [VILLE]', orange horizontal rule, service icons for:
'Formation IA', 'Audit IA', 'Implémentations IA'.
Small France map outline with location dot on [VILLE] position.
Terracotta/orange #C0440A accent color. Professional, minimal, B2B."
```

### A.4 Prompts DALL-E spécifiques par ville (Tier 1 top 10)

```
Marseille : "historic Vieux-Port de Marseille with Notre-Dame de la Garde basilica on hill"
Toulouse  : "Place du Capitole de Toulouse with pink brick architecture, evening light"
Nice      : "Promenade des Anglais Nice with Mediterranean blue sea and Belle Époque hotels"
Nantes    : "Château des Ducs de Bretagne Nantes with modern city skyline, Loire river"
Montpellier : "Place de la Comédie Montpellier with Opéra Comédie and tramway"
Strasbourg : "Petite France Strasbourg with half-timbered houses and Cathedral spire"
Bordeaux  : "Place de la Bourse Bordeaux reflected in Miroir d'eau, Garonne river"
Lille     : "Grand Place de Lille with Vieille Bourse and historic Flemish architecture"
Rennes    : "Parlement de Bretagne Rennes with half-timbered medieval buildings"
Grenoble  : "Grenoble city from above with Vercors and Chartreuse massifs, cable car"
```

---

## PHASE B — LES 83 VILLES TIER 2 (50K–100K) — TEMPLATE AUTOMATISÉ

### B.1 Principe

Pour 83 villes, générer les images programmatiquement avec Sharp :

```typescript
// src/scripts/generate-city-images-tier2.ts
import sharp from 'sharp'
import { createCanvas, loadImage } from 'canvas'

interface CityImageConfig {
  slug: string
  nameFr: string
  population: number
  region: string
  departement: string
  geo: { lat: number; lon: number }
}

async function generateCityBanner(city: CityImageConfig): Promise<Buffer> {
  // Base template : bannière "Se former. Comprendre. Agir avec l'IA."
  // (copie de la structure des images Paris/Lyon existantes)
  // Overlay le nom de la ville + département
  
  const baseTemplate = await sharp('templates/city-banner-template.webp').toBuffer()
  
  // SVG overlay avec le nom de la ville
  const svgOverlay = `
    <svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
      <text x="80" y="240" font-family="Georgia, serif" font-size="64" fill="#C0440A" font-weight="bold">
        ${city.nameFr}
      </text>
      <text x="80" y="300" font-family="Georgia, serif" font-size="28" fill="#1A1A1A">
        Formations &amp; interventions à ${city.nameFr}
      </text>
    </svg>
  `
  
  return sharp(baseTemplate)
    .composite([{ input: Buffer.from(svgOverlay), gravity: 'northwest' }])
    .webp({ quality: 85 })
    .toBuffer()
}
```

### B.2 Liste des 83 villes T2 (à couvrir avec template)

Les 83 villes entre 50 000 et 100 000 habitants extraites de la DB :

**Hauts-de-France** : Dunkerque, Lens, Calais, Amiens (si < 100K), Tourcoing, Valenciennes, Maubeuge
**Île-de-France** : Nanterre, Créteil, Vitry-sur-Seine, Aulnay-sous-Bois, Rueil-Malmaison, Champigny-sur-Marne, Aubervilliers, Asnières-sur-Seine, Colombes, Versailles (si < 100K)
**Grand Est** : Colmar, Troyes, Charleville-Mézières
**Normandie** : Caen (si < 100K)
**Bretagne** : Quimper, Vannes, Saint-Brieuc
**Pays de la Loire** : Saint-Nazaire, Laval, La Roche-sur-Yon
**Centre-Val de Loire** : Tours (si < 100K), Chartres, Blois
**Bourgogne-FC** : Besançon (si < 100K), Belfort
**Auvergne-RA** : Villefranche-sur-Saône, Chambéry, Annecy, Valence
**PACA** : Antibes, Cannes, Toulon (si < 100K)
**Occitanie** : Albi, Montauban, Narbonne, Béziers
**Nouvelle-Aquitaine** : Pau, Poitiers, Bayonne, Angoulême, Périgueux
**Corse** : Ajaccio

> ⚠️ Générer la liste exhaustive depuis les fichiers data/*.ts en filtrant population BETWEEN 50000 AND 100000

---

## PHASE C — 332 VILLES TIER 3 + 1 702 VILLES TIER 4 — MÉTADONNÉES PROGRAMMATIQUES

### C.1 Principe pour T3/T4

Pour ces 2 034 villes, on ne génère PAS d'image unique. On fait du **pSEO image** :

1. **1 image générique** de la bonne catégorie assignée à la page ville
2. **Métadonnées 100% spécifiques** à chaque ville (JSON-LD contentLocation, alt text, sitemap)
3. **Généré programmatiquement** depuis la DB

```typescript
// src/scripts/generate-city-image-metadata.ts
import { VILLES_ILE_DE_FRANCE } from '@/content/villes/data/ile-de-france'
// ... autres régions

// Pour chaque ville T3/T4, générer ses métadonnées d'image
function getCityImageMetadata(ville: VilleData) {
  // Sélection de l'image générique la plus appropriée selon la taille
  const genericImage = ville.population >= 20000
    ? 'axion-ia-proposition-ia-pour-tous-pas-reservee-grandes-entreprises-artisans-tpe-banniere'
    : 'axion-ia-formation-ia-comprendre-creer-transformer-intelligence-humaine-augmentee-banniere'
  
  return {
    slug: genericImage,
    altFr: `Formation IA et audit IA à ${ville.nameFr} — Axion-IA intervient en ${ville.departementLabel}`,
    altEn: `AI training and AI audit in ${ville.nameEn} — Axion-IA serves ${ville.departementLabel}`,
    captionFr: `Axion-IA propose des formations en intelligence artificielle et des audits IA à ${ville.nameFr} (${ville.departementLabel}). Cabinet de conseil IA, nous accompagnons les entreprises de ${ville.nameFr} et de la région ${getRegionLabel(ville.region)} dans leur transformation par l'intelligence artificielle. Formation IA sur mesure, diagnostic IA et implémentations pour TPE, PME et ETI.`,
    jsonLd: {
      '@type': 'ImageObject',
      contentLocation: {
        '@type': 'City',
        name: ville.nameFr,
        sameAs: `https://www.wikidata.org/wiki/${getWikidataId(ville.slug)}`,
        address: {
          '@type': 'PostalAddress',
          addressLocality: ville.nameFr,
          postalCode: ville.postalCode,
          addressCountry: 'FR',
          addressRegion: getRegionLabel(ville.region),
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: ville.geo.lat,
          longitude: ville.geo.lon,
        },
      },
      spatialCoverage: {
        '@type': 'Place',
        name: `${ville.nameFr}, ${getRegionLabel(ville.region)}, France`,
      },
    },
    sitemapEntry: {
      loc: `https://axion-ia.com/fr/ia-${ville.slug}`,
      imageTitle: `Formation IA à ${ville.nameFr} — Axion-IA`,
      imageCaption: `Formations et interventions IA à ${ville.nameFr} par Axion-IA. Cabinet conseil IA spécialisé dans la transformation des entreprises par l'intelligence artificielle. Services : formation IA, audit IA, automatisation, coaching dirigeants.`,
      geoLocation: `${ville.nameFr}, France`,
    },
  }
}
```

### C.2 Script de génération en masse du sitemap-images

```typescript
// src/scripts/generate-sitemap-images-cities.ts
import { getAllVilles } from '@/content/villes'
import { getCityImageMetadata } from './generate-city-image-metadata'
import { create } from 'xmlbuilder2'

export async function generateCitySitemapImages() {
  const villes = getAllVilles()  // toutes les 2157 communes
  
  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('urlset', {
      xmlns: 'http://www.sitemaps.org/schemas/sitemap/0.9',
      'xmlns:image': 'http://www.google.com/schemas/sitemap-image/1.1',
    })
  
  for (const ville of villes) {
    const meta = getCityImageMetadata(ville)
    
    root.ele('url')
      .ele('loc').txt(`https://axion-ia.com/fr/ia-${ville.slug}`).up()
      .ele('image:image')
        .ele('image:loc').txt(`https://axion-ia.com/images/${meta.slug}.webp`).up()
        .ele('image:title').txt(meta.sitemapEntry.imageTitle).up()
        .ele('image:caption').txt(meta.sitemapEntry.imageCaption).up()
        .ele('image:geo_location').txt(meta.sitemapEntry.geoLocation).up()
        .ele('image:license').txt('https://creativecommons.org/licenses/by/4.0/').up()
      .up()
    .up()
  }
  
  return root.end({ prettyPrint: true })
}
```

---

## PHASE D — STRATÉGIE MULTI-MOTS-CLÉS : DEVENIR #1 EN FRANCE

### D.1 Les 8 clusters de mots-clés cibles (national)

> Chaque cluster = un ensemble de requêtes connexes sur lequel Axion-IA doit dominer.  
> Pour chaque cluster : une ou plusieurs images assignées avec les bons mots-clés.

---

**CLUSTER 1 — AUDIT IA (volume national le plus fort)**

```
Mots-clés primaires :
✦ "audit IA entreprise"            → CPC ~8€ | Intention : commerciale forte
✦ "audit intelligence artificielle" → CPC ~7€
✦ "diagnostic IA entreprise"
✦ "maturité IA"
✦ "audit IA PME"
✦ "cabinet audit IA"

Mots-clés long-tail :
✦ "comment faire un audit IA dans mon entreprise"
✦ "audit IA entreprise artisan commerçant"
✦ "quel est le coût d'un audit IA"
✦ "audit IA gratuit"  
✦ "audit IA en 1 journée"
✦ "résultats audit IA entreprise"

Images assignées (parmi les 73) :
→ axion-ia-audit-ia-methode-5-etapes-*-infographie          [informationnel]
→ axion-ia-audit-ia-choix-rentable-benefices-immediats-*    [commercial]
→ axion-ia-audit-processus-automatiser-*-infographie        [commercial fort]
→ axion-ia-audit-ia-votre-avance-concurrents-*              [concurrentiel]
→ axion-ia-publicite-outdoor-ia-rapporte-concretement-*     [brand awareness]

Page cible : /fr/audit-ia
```

---

**CLUSTER 2 — FORMATION IA (volume fort, CPC élevé)**

```
Mots-clés primaires :
✦ "formation IA entreprise"         → CPC ~12€ | Intention : commerciale très forte
✦ "formation intelligence artificielle" 
✦ "formation IA équipe"
✦ "atelier IA entreprise"
✦ "formation IA 1 jour"
✦ "formation IA sur mesure"
✦ "formation ChatGPT entreprise"

Mots-clés long-tail :
✦ "meilleure formation IA pour entreprise 2026"
✦ "formation IA pour non-techniciens"
✦ "formation IA managers dirigeants"
✦ "prix formation IA entreprise"
✦ "formation IA certification"
✦ "résultats formation IA avant après"

Images assignées :
→ axion-ia-formation-ia-avant-apres-*-photo-carre           [avant/après]
→ axion-ia-formation-equipe-ia-40-pourcent-*-carre          [résultats chiffrés]
→ axion-ia-formation-acculturation-ia-*-photo-banniere      [informationnel]
→ axion-ia-formation-ia-benefices-concrets-*-photo-carre    [commercial]
→ axion-ia-formation-ia-1-jour-*-carre                      [commercial 1 jour]
→ axion-ia-intervention-ia-france-*-photo-banniere          [local France]

Page cible : /fr/formations-ia + /fr/formation-ia-1-jour
```

---

**CLUSTER 3 — AUTOMATISATION IA**

```
Mots-clés primaires :
✦ "automatisation IA entreprise"
✦ "implémentation IA entreprise"
✦ "automatiser processus IA"
✦ "agent IA entreprise"
✦ "workflow IA"
✦ "RPA intelligence artificielle"

Mots-clés long-tail :
✦ "quels processus automatiser avec l'IA"
✦ "automatisation IA PME sans technique"
✦ "implémentation IA dans les processus métier"
✦ "ROI automatisation IA"
✦ "automatisation IA +86% performance"

Images assignées :
→ axion-ia-automatisation-ia-avant-apres-*-photo-carre      [avant/après fort]
→ axion-ia-automatisation-ia-performance-86-pourcent-*      [chiffre accrocheur]
→ axion-ia-automatisation-ia-triangle-*-100-gagnant-carre   [visuel mémorable]
→ axion-ia-automatisation-ia-benefices-concrets-*-banniere

Page cible : /fr/automatisation-ia
```

---

**CLUSTER 4 — COACHING DIRIGEANT IA**

```
Mots-clés primaires :
✦ "coaching IA dirigeant"
✦ "accompagnement IA CEO directeur"
✦ "consultant IA stratégie dirigeant"
✦ "IA pour dirigeants d'entreprise"
✦ "1 to 1 IA dirigeant"

Mots-clés long-tail :
✦ "comment intégrer l'IA dans ma stratégie dirigeant"
✦ "gagner du temps avec l'IA en tant que dirigeant"
✦ "coaching IA personnalisé pour CEO PME"
✦ "+15h libérées par semaine grâce IA"

Images assignées :
→ axion-ia-dirigeant-1to1-une-personne-une-journee-*        [impact chiffré]
→ axion-ia-dirigeant-1to1-reprendre-controle-*              [tension émotionnelle]
→ axion-ia-dirigeant-1to1-moins-subir-plus-piloter-*        [message fort]
→ axion-ia-dirigeant-1to1-temps-plus-grand-atout-*          [sablier mémorable]

Page cible : /fr/accompagnement-dirigeants
```

---

**CLUSTER 5 — STATISTIQUES & DATA IA (AEO + GEO fort)**

```
Mots-clés primaires :
✦ "statistiques IA entreprise 2024"
✦ "adoption IA entreprises France 2024"
✦ "ROI intelligence artificielle entreprise"
✦ "taux adoption IA PME"
✦ "chiffres IA entreprise 2026"

Questions AEO (answer engine) :
✦ "quel pourcentage d'entreprises utilisent l'IA ?"
✦ "quel est le ROI moyen de l'IA en entreprise ?"
✦ "combien d'entreprises ont adopté l'IA en France ?"
✦ "quelle productivité gagne-t-on avec l'IA ?"

Images assignées :
→ axion-ia-graphique-adoption-ia-entreprises-72-pourcent-*  [chiffre 72% mémorable]
→ axion-ia-graphique-performance-ia-entreprise-kpi-*        [barres progression]
→ axion-ia-graphique-ia-imperatif-performance-*             [urgence]
→ axion-ia-graphique-ia-maintenant-attendre-explorer-*      [roadmap]

Page cible : /fr/blog/* + /fr/ressources
```

---

**CLUSTER 6 — PROPOSITIONS GLOBALES & BRAND**

```
Mots-clés primaires :
✦ "cabinet conseil IA France"
✦ "consultant IA France"
✦ "prestataire IA B2B France"
✦ "Axion-IA"
✦ "intelligence artificielle au service des entreprises"
✦ "IA tous secteurs artisans commerçants TPE PME ETI"

Images assignées :
→ axion-ia-equipe-intelligence-artificielle-service-humain-* [photo équipe brand]
→ axion-ia-proposition-globe-4-services-*                   [vision globale]
→ axion-ia-proposition-outdoor-formations-audit-*           [billboard brand]
→ axion-ia-proposition-ia-pour-tous-pas-reservee-*          [inclusion tous secteurs]

Page cible : /fr/ (homepage) + /en/ + /fr/a-propos
```

---

**CLUSTER 7 — CITATIONS ÉDITORIALES (GEO / LLMs)**

```
Usage : Ces images apparaissent dans les chatbots IA quand ils discutent d'IA en entreprise.
        Elles véhiculent la philosophie Axion-IA et créent de la mémorabilité.

Mots-clés ciblés :
✦ "citation IA entreprise"
✦ "philosophie IA humaniste"
✦ "IA ne remplace pas l'humain"
✦ "intelligence artificielle valeur impact"
✦ "investir en IA connaissance"

Images assignées (6 citations) :
→ axion-ia-citation-avenir-prepare-*                        "L'avenir se prépare"
→ axion-ia-citation-clarte-serenite-*                       "Clarté → sérénité"
→ axion-ia-citation-intelligence-artificielle-valeur-*      "Valeur par impact"
→ axion-ia-citation-ia-ne-remplace-pas-humain-*             "IA ≠ remplacer"
→ axion-ia-citation-investir-connaissance-*                 "Connaissance → liberté"

Page cible : /fr/blog/philosophie-ia + réseaux sociaux + llms.txt
```

---

**CLUSTER 8 — LOCAL VILLES (× 2 157 déclinaisons)**

```
Pattern pour chaque ville :
✦ "formation IA [VILLE]"           → bannière photo ville T1/T2
✦ "audit IA [VILLE]"               → bannière photo ville T1/T2  
✦ "consultant IA [VILLE]"          → image générique avec métadonnées
✦ "intelligence artificielle [VILLE]" → image générique
✦ "IA [VILLE] entreprise"          → image générique
✦ "formation IA [DÉPARTEMENT]"     → image générique département
✦ "IA [RÉGION]"                    → image générique région

Exemple complet pour Toulouse :
→ "formation IA Toulouse"         → axion-ia-toulouse-formation-ia-capitole-*
→ "audit IA Toulouse"             → axion-ia-toulouse-audit-ia-*
→ "consultant IA Toulouse"        → axion-ia-toulouse-consultant-ia-*
→ "IA Occitanie"                  → axion-ia-occitanie-ia-entreprise-*
→ "formation IA Haute-Garonne"    → axion-ia-haute-garonne-formation-ia-*
```

---

### D.2 Matrice complète : 73 images → mots-clés cibles

> Cette matrice garantit que chaque image cible un mot-clé DIFFÉRENT.  
> Zéro cannibalisation entre images.

| Image (slug abrégé) | Cluster | Mot-clé cible principal | Page hôte |
|---|---|---|---|
| audit-entreprise-prete-ia-banniere | C1 | "votre entreprise prête IA" | /fr/audit-ia |
| audit-avantage-competitif-banniere | C1 | "audit IA avantage compétitif" | /fr/audit-ia |
| audit-transformer-defis-opportunites | C1 | "transformer défis en opportunités IA" | /fr/audit-ia |
| publicite-outdoor-ia-rapporte | C6 | "IA qui rapporte concrètement" | /fr/ |
| audit-levier-croissance-mesurable | C1 | "audit IA levier croissance mesurable" | /fr/audit-ia |
| audit-solutions-tous-secteurs | C1 | "audit IA artisans commerçants PME ETI" | /fr/solutions-ia |
| audit-processus-automatiser | C1 | "processus à automatiser IA" | /fr/audit-ia |
| audit-metro-gagner-temps | C1 | "audit entreprise gagner temps réduire coûts" | /fr/audit-ia |
| audit-methode-5-etapes | C1 | "méthode audit IA 5 étapes" | /fr/audit-ia |
| citation-avenir-prepare | C7 | "L'avenir se prépare aujourd'hui IA" | /fr/blog |
| citation-clarte-serenite | C7 | "clarté sérénité résultats IA" | /fr/blog |
| audit-choix-rentable-roi | C1 | "audit IA rentable ROI garanti" | /fr/audit-ia |
| audit-vous-gagnez-temps-argent | C1 | "audit IA gagner temps argent" | /fr/audit-ia |
| audit-plus-valeur-moins-perte | C1 | "audit IA valeur performances décuplées" | /fr/audit-ia |
| audit-chaos-ordre-performance | C1 | "audit IA chaos vers ordre performance" | /fr/audit-ia |
| audit-une-journee-mois-gagnes | C1 | "audit IA une journée mois gagnés" | /fr/audit-ia |
| audit-votre-avance-concurrents | C1 | "audit IA surpasser concurrents" | /fr/audit-ia |
| formation-1-jour-sur-mesure | C2 | "formation IA 1 jour sur mesure" | /fr/formation-ia-1-jour |
| intervention-rapide-resultats | C2 | "intervention IA rapide résultats" | /fr/interventions-ia |
| formation-comprendre-creer-transformer | C2 | "formation IA comprendre créer transformer" | /fr/formations-ia |
| intervention-france-regions | C2 | "intervention IA France toutes régions" | /fr/interventions-ia |
| formation-acculturation-tpe-pme-2026 | C2 | "acculturation IA entreprise PME 2026" | /fr/formations-ia |
| citation-ia-valeur-impact | C7 | "IA valeur par impact" | /fr/blog |
| citation-ia-ne-remplace-humain | C7 | "IA ne remplace pas l'humain" | /fr/blog |
| formation-vous-gagnez-concretement | C2 | "formation IA bénéfices concrets" | /fr/formations-ia |
| citation-investir-connaissance | C7 | "investir connaissance IA liberté" | /fr/blog |
| formation-benefices-premier-jour | C2 | "formation IA bénéfices dès le premier jour" | /fr/formations-ia |
| formation-avant-apres-journee | C2 | "formation IA avant après résultats" | /fr/formations-ia |
| formation-moins-stress-clarte | C2 | "formation IA moins stress plus clarté" | /fr/formations-ia |
| formation-equipe-40-productivite | C2 | "former équipe IA +40% productivité" | /fr/formations-ia |
| formation-1-jour-progresser | C2 | "formation IA 1 jour progresser" | /fr/formation-ia-1-jour |
| formation-1-jour-reserver | C2 | "réserver formation IA 1 jour" | /fr/formation-ia-1-jour |
| automatisation-benefices-concrets | C3 | "bénéfices automatisation IA" | /fr/automatisation-ia |
| automatisation-avant-apres-45pct | C3 | "automatisation IA +45% performance" | /fr/automatisation-ia |
| automatisation-performance-86pct | C3 | "automatisation IA performance +86%" | /fr/automatisation-ia |
| automatisation-triangle-100-gagnant | C3 | "automatisation IA 100% gagnant" | /fr/automatisation-ia |
| dirigeant-ouvrir-ralentit-12h | C4 | "ce qui ralentit entreprise IA +12h" | /fr/accompagnement-dirigeants |
| dirigeant-reprendre-controle | C4 | "reprendre contrôle IA dirigeant" | /fr/accompagnement-dirigeants |
| dirigeant-temps-atout | C4 | "temps atout dirigeant libérer IA" | /fr/accompagnement-dirigeants |
| dirigeant-moins-stress-clarte | C4 | "moins stress clarté performance dirigeant IA" | /fr/accompagnement-dirigeants |
| dirigeant-moins-subir-piloter | C4 | "moins subir plus piloter IA" | /fr/accompagnement-dirigeants |
| dirigeant-1to1-infographie | C4 | "1 to 1 IA +15h +35% efficacité" | /fr/accompagnement-dirigeants |
| equipe-tous-profils-metiers | C4 | "1 to 1 IA tous profils équipe" | /fr/accompagnement-equipes |
| equipe-grandir-competence | C4 | "coaching IA individuel compétences" | /fr/accompagnement-equipes |
| graphique-processus-5-etapes | C5 | "processus IA 5 étapes timeline" | /fr/ressources |
| graphique-kpi-20-60-pct | C5 | "KPI IA +20% à +60% performance" | /fr/blog/roi-ia |
| graphique-adoption-72pct-2024 | C5 | "72% entreprises adoptent IA 2024" | /fr/blog/adoption-ia |
| graphique-imperatif-performance | C5 | "IA impératif performance fossé concurrentiel" | /fr/blog/ia-imperatif |
| graphique-maintenant-dominer | C5 | "IA maintenant attendre explorer dominer" | /fr/blog/ia-maintenant |
| logo-horizontal-blanc | C6 | "logo Axion-IA" | TOUTES pages |
| logo-horizontal-transparent | C6 | "Axion-IA logo transparent" | TOUTES pages |
| [autres logos] | C6 | "logo Axion-IA variante" | TOUTES pages |
| proposition-outdoor-billboard | C6 | "cabinet IA formations audit" | /fr/ |
| proposition-showroom | C6 | "showroom Axion-IA services" | /fr/a-propos |
| proposition-ia-pour-tous | C6 | "IA pas réservée grandes entreprises" | /fr/solutions-ia |
| proposition-globe-4-services | C6 | "4 services IA Axion-IA" | /fr/ |
| proposition-booster-productivite | C6 | "booster productivité équipes IA" | /fr/solutions-ia |
| proposition-solutions-5-secteurs | C6 | "solutions IA chaque secteur" | /fr/solutions-ia |
| proposition-temps-precieux-quadrant | C6 | "temps précieux tâches répétitives IA" | /fr/solutions-ia |
| proposition-moins-taches-valeur | C6 | "moins tâches plus valeur IA" | /fr/solutions-ia |
| proposition-ia-simplifie | C6 | "IA simplifie interventions" | /fr/interventions-ia |
| proposition-temps-vers-argent | C6 | "temps vers argent croissance IA" | /fr/solutions-ia |
| equipe-service-humain-groupe | C6 | "équipe Axion-IA IA service humain" | /fr/a-propos |
| paris-tour-eiffel-performance | C8 | "formation IA Paris +28% performance" | /fr/ia-paris |
| paris-sacre-coeur-reussite | C8 | "IA Paris réussite entreprise" | /fr/ia-paris |
| paris-tour-eiffel-carre | C8 | "Axion-IA Paris services IA" | /fr/ia-paris |
| paris-haussmann-formation | C8 | "se former IA Paris" | /fr/formation-ia-paris |
| lyon-fourviere-formation | C8 | "formation IA Lyon comprendre agir" | /fr/ia-lyon |

---

### D.3 Extension villes : mots-clés par département et région

En plus des mots-clés par ville, cibler les déclinaisons département/région :

```typescript
// Mots-clés générés automatiquement par image de ville
const CITY_KEYWORD_EXPANSIONS = {
  // Île-de-France
  'paris': {
    ville: ['formation IA Paris', 'audit IA Paris', 'consultant IA Paris', 'IA Paris entreprise'],
    departement: ['formation IA 75', 'formation IA Seine', 'cabinet IA Paris 75'],
    region: ['formation IA Île-de-France', 'cabinet IA Île-de-France', 'consultant IA Île-de-France'],
  },
  // Auvergne-Rhône-Alpes
  'lyon': {
    ville: ['formation IA Lyon', 'audit IA Lyon', 'consultant IA Lyon', 'IA Lyon entreprise'],
    departement: ['formation IA Rhône 69', 'cabinet IA Rhône'],
    region: ['formation IA Auvergne-Rhône-Alpes', 'IA AURA entreprise'],
  },
  // Génération automatique pour toutes les villes :
  // ville.slug → ville.nameFr + ville.departementLabel + getRegionLabel(ville.region)
}
```

---

## PHASE E — GOOGLE BUSINESS PROFILE (GBP) — DOMINATION LOCALE

### E.1 Stratégie images GBP

Google Business Profile est le **levier n°1** pour apparaître dans les recherches locales.

```
Pour chaque ville Tier 1 (40 villes) :
□ Créer/compléter une fiche GBP Axion-IA pour la ville
□ Uploader l'image bannière de la ville (1920×1080)
□ Uploader l'image carrée de la ville (1200×1200)
□ Ajouter 3-5 images génériques de services
□ Titre fiche : "Axion-IA — Formation IA & Conseil IA [VILLE]"
□ Catégorie : "Consultants en gestion des affaires" + "École de formation"
□ Zone de service : [ville] + rayon 50km

Pour chaque ville Tier 2/3 :
□ Utiliser une fiche GBP "zone de service" depuis Paris
□ Ajouter la ville dans les zones desservies
□ Photo générique avec nom de la ville

Images GBP recommandées par fiche :
1. Logo Axion-IA (carré 1080×1080)
2. Photo couverture ville (bannière 1920×1080)
3. Image service "Formation IA" 
4. Image service "Audit IA"
5. Image service "Automatisation"
6. Photo équipe (groupe 12 personnes)
```

### E.2 Géotagging des images GBP

```
Chaque image uploadée sur GBP doit avoir des coordonnées GPS dans les métadonnées EXIF :
GPSLatitude : [ville.geo.lat]
GPSLongitude : [ville.geo.lon]
GPSLatitudeRef : N
GPSLongitudeRef : E

// Via Sharp + exif-tool
await sharp(imageBuffer)
  .withMetadata({
    exif: {
      IFD0: {
        GPSLatitude: ville.geo.lat.toString(),
        GPSLongitude: ville.geo.lon.toString(),
      }
    }
  })
  .webp()
  .toFile(outputPath)
```

---

## PHASE F — SCHEMA.ORG LocalBusiness × Image (CONNEXION CRITIQUE)

### F.1 Lier les images à l'entité LocalBusiness

Pour dominer les recherches locales, les images Axion-IA doivent être **liées** à l'entité Organisation/LocalBusiness dans les données structurées :

```json
{
  "@context": "https://schema.org",
  "@type": ["LocalBusiness", "EducationalOrganization", "ProfessionalService"],
  "@id": "https://axion-ia.com/#organization",
  "name": "Axion-IA",
  "url": "https://axion-ia.com",
  "logo": {
    "@type": "ImageObject",
    "@id": "https://axion-ia.com/images/axion-ia-logo-horizontal-fond-blanc-bordure-orange.webp",
    "url": "https://axion-ia.com/images/axion-ia-logo-horizontal-fond-blanc-bordure-orange.webp",
    "width": 1200,
    "height": 400
  },
  "image": [
    "https://axion-ia.com/images/axion-ia-equipe-intelligence-artificielle-service-humain-12-personnes-photo-groupe.webp",
    "https://axion-ia.com/images/axion-ia-proposition-globe-4-services-formations-audit-implementations-resultats-carre.webp"
  ],
  "hasOfferCatalog": {
    "@type": "OfferCatalog",
    "name": "Services IA Axion-IA",
    "itemListElement": [
      {
        "@type": "Offer",
        "name": "Audit IA",
        "image": "https://axion-ia.com/images/axion-ia-audit-ia-methode-5-etapes-analyse-identification-roi-recommandations-infographie.webp"
      },
      {
        "@type": "Offer",
        "name": "Formation IA",
        "image": "https://axion-ia.com/images/axion-ia-formation-acculturation-ia-entreprise-tpe-pme-eti-2026-comment-commencer-photo-banniere.webp"
      },
      {
        "@type": "Offer",
        "name": "Automatisation IA",
        "image": "https://axion-ia.com/images/axion-ia-automatisation-ia-avant-apres-tableau-bord-45-pourcent-98-pourcent-photo-carre.webp"
      }
    ]
  },
  "areaServed": {
    "@type": "Country",
    "name": "France",
    "sameAs": "https://www.wikidata.org/wiki/Q142"
  },
  "sameAs": [
    "https://www.linkedin.com/company/axion-ia",
    "https://www.wikidata.org/wiki/[WIKIDATA-AXION-IA]"
  ]
}
```

### F.2 JSON-LD ville × service × image (triplet de domination)

Pour chaque page ville, combiner Service + Place + ImageObject :

```json
{
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "Formation IA à Toulouse",
  "serviceType": "Formation IA",
  "provider": { "@id": "https://axion-ia.com/#organization" },
  "areaServed": {
    "@type": "City",
    "name": "Toulouse",
    "sameAs": "https://www.wikidata.org/wiki/Q844"
  },
  "image": {
    "@type": "ImageObject",
    "@id": "https://axion-ia.com/images/axion-ia-toulouse-formation-ia-capitole-banniere.webp",
    "contentLocation": {
      "@type": "City",
      "name": "Toulouse",
      "geo": { "@type": "GeoCoordinates", "latitude": 43.6047, "longitude": 1.4442 }
    }
  },
  "url": "https://axion-ia.com/fr/ia-toulouse"
}
```

---

## PHASE G — SITEMAP IMAGES COMPLET (2 157 VILLES)

### G.1 Structure sitemaps

```xml
<!-- sitemap-index.xml — ajouter ces entrées -->
<sitemap>
  <loc>https://axion-ia.com/sitemap-images-services.xml</loc>
  <lastmod>2026-05-19</lastmod>
</sitemap>
<sitemap>
  <loc>https://axion-ia.com/sitemap-images-villes-tier1.xml</loc>
  <lastmod>2026-05-19</lastmod>
</sitemap>
<sitemap>
  <loc>https://axion-ia.com/sitemap-images-villes-tier2.xml</loc>
  <lastmod>2026-05-19</lastmod>
</sitemap>
<sitemap>
  <loc>https://axion-ia.com/sitemap-images-villes-tier3-4.xml</loc>
  <lastmod>2026-05-19</lastmod>
</sitemap>
```

### G.2 Volume attendu

```
sitemap-images-services.xml      → ~73 images × ~3 pages chacune = ~220 entrées
sitemap-images-villes-tier1.xml  → 40 villes × 2 images = 80 entrées
sitemap-images-villes-tier2.xml  → 83 villes × 1 image = 83 entrées
sitemap-images-villes-tier3-4.xml → 2034 villes × 1 image = 2034 entrées
TOTAL                             → ~2 417 entrées image dans les sitemaps
```

---

## PHASE H — IndexNow BATCH COMPLET

```typescript
// Soumission IndexNow après génération de tous les sitemaps
const urlsToSubmit = [
  // Pages services (nationales)
  'https://axion-ia.com/fr/audit-ia',
  'https://axion-ia.com/fr/formations-ia',
  'https://axion-ia.com/fr/automatisation-ia',
  'https://axion-ia.com/fr/accompagnement-dirigeants',
  'https://axion-ia.com/fr/solutions-ia',
  'https://axion-ia.com/fr/galerie',
  // Pages villes T1 (40)
  ...VILLES_T1.map(v => `https://axion-ia.com/fr/ia-${v.slug}`),
  // Pages villes T2 (83)
  ...VILLES_T2.map(v => `https://axion-ia.com/fr/ia-${v.slug}`),
  // Sitemaps images (Google + Bing lisent les pings)
  'https://axion-ia.com/sitemap-images-services.xml',
  'https://axion-ia.com/sitemap-images-villes-tier1.xml',
]

// Batch de max 10 000 URLs par requête IndexNow
// Envoyer vers Bing + Google
```

---

## LIVRABLES DE CE PROMPT

```
_AUDIT/image-bank-city-domination-2026/
├── 00-city-tiers-list.json           (2157 villes classées T1/T2/T3/T4)
├── 01-tier1-image-prompts.json       (40 × prompts DALL-E pour bannières villes)
├── 02-tier1-metadata.json            (40 × JSON-LD + alt + sitemap)
├── 03-tier2-template-config.json     (83 × config overlay Sharp)
├── 04-tier3-4-metadata-batch.json    (2034 × métadonnées programmatiques)
├── 05-keyword-matrix.json            (73 images × cluster × mot-clé cible)
├── 06-sitemap-images-villes.xml      (2157 entrées)
├── 07-gbp-strategy.md                (stratégie GBP par ville)
├── 08-localBusiness-jsonld.json      (schema.org organisation + services + images)
├── 09-indexnow-batch-full.json       (~200 URLs prioritaires)
└── 10-DOMINATION-REPORT.md           (rapport + roadmap chiffrée)

src/
├── scripts/generate-city-images-tier2.ts    (overlay Sharp automatisé)
├── scripts/generate-city-image-metadata.ts  (métadonnées 2157 villes)
├── scripts/generate-sitemap-images-cities.ts (sitemap XML complet)
└── app/api/v1/images/city/[slug]/route.ts   (API métadonnées ville)
```

---

## ROADMAP CHIFFRÉE — DEVENIR #1 EN FRANCE

```
SEMAINE 1 (maintenant) :
□ Renommer + traiter les 73 images existantes (Phase 0-6 prompt principal)
□ Générer images T1 pour les 10 métropoles majeures (Marseille, Toulouse, Nice...)
□ Deployer sitemap-images-services.xml
□ IndexNow ping pages services + galerie

SEMAINE 2 :
□ Générer images T1 pour les 30 autres villes > 100K
□ Générer images T2 (83 villes, overlay automatisé Sharp)
□ Deployer sitemap-images-villes-tier1.xml + tier2.xml
□ Créer/optimiser fiches GBP 10 métropoles majeures

SEMAINE 3 :
□ Générer métadonnées T3/T4 (332 + 1702 villes)
□ Deployer sitemap-images-villes-tier3-4.xml  
□ GBP 30 autres villes T1

SEMAINE 4 :
□ Soumettre sitemaps Google Search Console
□ Soumettre sitemaps Bing Webmaster Tools
□ IndexNow batch complet (2157 URLs)
□ Mesurer positions Google Images sur mots-clés pilotes

RÉSULTAT ATTENDU À 30 JOURS :
→ Google Images : #1-3 sur les principales requêtes "IA [ville]" pour T1
→ Google Images : Top 10 sur requêtes nationales "audit IA", "formation IA"
→ Bing Visual Search : indexation de 100% des 2157 images villes
→ AI Overviews : apparition dans les réponses sur "formation IA France"

RÉSULTAT ATTENDU À 90 JOURS :
→ #1 France sur "cabinet conseil IA" + "formation IA entreprise"
→ Top 3 sur "IA [ville]" pour 40 villes T1
→ Top 10 sur "IA [ville]" pour 80% des 2157 communes
→ Axion-IA cité par ChatGPT/Perplexity sur requêtes IA France
```

---

*Prompt version 1.0 — 2026-05-19 — Domination villes + mots-clés France entière*  
*Basé sur 2 157 communes > 5 000 habitants déjà dans la DB Axion-IA*
