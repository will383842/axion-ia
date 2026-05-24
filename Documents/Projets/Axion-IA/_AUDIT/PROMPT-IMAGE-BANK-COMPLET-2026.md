# PROMPT AUTOPILOTE — IMAGE BANK COMPLET 2026
## Axion-IA — 73 images existantes + 2 157 villes → #1 France
### Google Images · Bing · Google Discover · IA Génératives · Toutes les villes françaises

> **DATE** : 2026-05-19  
> **MODE** : AUTOPILOTE — exécute tout dans l'ordre, STOP & ASK uniquement si bloquant P0  
> **BASE** : Analyse visuelle réelle des 73 images réalisée avant rédaction de ce prompt  
> **OBJECTIF FINAL** : Axion-IA #1 en France sur "formation IA", "audit IA", "consultant IA" + visible dans chaque ville française > 5 000 habitants + apparaître dans ChatGPT, Perplexity, Google AI Overviews

---

## CONTEXTE COMPLET

**Société** : Axion-IA OÜ — cabinet conseil IA B2B premium  
**Site** : https://axion-ia.com — Next.js 16 App Router, bilingue FR/EN  
**Stack** : Sharp, BullMQ workers, Prisma 5.22, Postgres  
**Palette** : Terracotta `#C0440A`, crème `#FAF7F2`, blanc, noir `#1A1A1A`  
**Licence** : CC BY 4.0 — `© 2026 Axion-IA OÜ`  
**Concurrent principal** : axionai.fr (homonyme, rank #1 brand actuellement)

### Ce que sont réellement les 73 images (analyse visuelle réelle)
Ces images **ne sont pas** des photos de consultants. Ce sont :
- Des **visuels marketing** avec texte français visible (Google lit ce texte via OCR)
- Des **formats variés** : banderoles 16:9, carrés 1:1, billboards, infographies, citations, photos composites
- Toutes **générées par IA** (DALL-E) — mention obligatoire AI Act art. 50 (août 2026)

### Inventaire source (73 images confirmées)
```
C:\Users\willi\Documents\Projets\Axion-IA\Images Axion-IA\
├── Audit/                              16 images (1 mal classifiée → voir Phase 2)
├── Formations & Interventions/         15 images (3 déjà nommées)
├── Automatisations et implémentations/  4 images
├── 1 TO 1/
│   ├── Dirigeant 1 TO 1/               7 images (1 mal classifiée → voir Phase 2)
│   └── Membre d'équipe 1 TO 1/         2 images
├── Graphiques et courbes/               5 images
├── Logos/                               7 images
├── Tous types de propositions/         11 images
└── Villes/
    ├── Paris/                           4 images
    └── Lyon/                            1 image
```

### Données villes disponibles dans le projet
```
axionia/src/content/villes/data/*.ts → 2 157 communes > 5 000 hab
├── > 100 000 hab  : 40 villes  (Tier 1 — photos dédiées)
├── 50K – 100K    : 83 villes  (Tier 2 — template auto)
├── 20K – 50K     : 332 villes (Tier 3 — métadonnées auto)
└── 5K – 20K      : 1 702 villes (Tier 4 — métadonnées auto)
```

> **Tiers = ordre de priorité par taille de ville.** Une ville de 500 000 hab mérite une photo sur mesure avec son landmark. Une ville de 6 000 hab mérite juste que les métadonnées de l'image mentionnent son nom. Même objectif pour toutes : apparaître quand quelqu'un cherche "formation IA [nom de la ville]".

---

## PHASE 1 — PIPELINE AUTO-WEBP (tout import futur converti automatiquement)

### 1.1 Règle absolue
Tout fichier importé (PNG, JPG, JPEG, HEIC, TIFF) → converti automatiquement en WebP + AVIF.  
**Jamais servir un PNG original en production.**

### 1.2 Worker BullMQ : `image-bank-auto-convert-worker.ts`

```typescript
// src/server/queue/workers/image-bank-auto-convert-worker.ts
import sharp from 'sharp'
import path from 'path'
import fs from 'fs/promises'

const ACCEPTED_FORMATS = ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.heic', '.tiff', '.bmp']

const VARIANTS = [
  { suffix: '',        format: 'webp' as const, quality: 85, width: null,  height: null  },
  { suffix: '',        format: 'avif' as const, quality: 70, width: null,  height: null  },
  { suffix: '-og',     format: 'webp' as const, quality: 90, width: 1200,  height: 630   },
  { suffix: '-square', format: 'webp' as const, quality: 90, width: 1080,  height: 1080  },
  { suffix: '-thumb',  format: 'webp' as const, quality: 80, width: 400,   height: 300   },
  { suffix: '-md',     format: 'webp' as const, quality: 85, width: 768,   height: null  },
  { suffix: '-sm',     format: 'webp' as const, quality: 80, width: 384,   height: null  },
]

async function processImage(sourcePath: string, targetSlug: string) {
  const sourceBuffer = await fs.readFile(sourcePath)
  const meta = await sharp(sourceBuffer).metadata()

  // Gate Google Discover : largeur minimum 1200px
  let input = sourceBuffer
  if (meta.width && meta.width < 1200) {
    input = await sharp(sourceBuffer)
      .resize(1200, null, { kernel: 'lanczos3', withoutEnlargement: false })
      .toBuffer()
  }

  const outputDir = path.join(process.cwd(), 'public', 'images')
  await fs.mkdir(outputDir, { recursive: true })

  for (const v of VARIANTS) {
    let pipe = sharp(input)
    if (v.width && v.height) {
      pipe = pipe.resize(v.width, v.height, { fit: 'cover', position: 'attention' })
    } else if (v.width) {
      pipe = pipe.resize(v.width, null)
    }
    pipe = v.format === 'avif' ? pipe.avif({ quality: v.quality }) : pipe.webp({ quality: v.quality })
    await pipe.toFile(path.join(outputDir, `${targetSlug}${v.suffix}.${v.format}`))
  }

  // LQIP inline base64
  const lqip = await sharp(input).resize(16).webp({ quality: 20 }).blur(8).toBuffer()
  return `data:image/webp;base64,${lqip.toString('base64')}`
}
```

### 1.3 Cas spécial Logos → WebP LOSSLESS
```typescript
// Logos uniquement : pas de compression lossy
sharp(logoBuffer).webp({ lossless: true }).toFile('axion-ia-logo-xxx.webp')
```

### 1.4 API import : `POST /api/v1/images/import`
```typescript
// Accepte PNG/JPG/HEIC etc. → queue BullMQ → auto-convert → 8 variants générés
export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File
  const category = formData.get('category') as string
  const slugFr = formData.get('slug_fr') as string | null
  // → writeFile tmp → imageConvertQueue.add('auto-convert', { sourcePath, targetSlugFr, category })
  return NextResponse.json({ jobId, slug: slugFr ?? autoSlug, status: 'queued' })
}
```

---

## PHASE 2 — CORRECTIONS AVANT TOUT (misclassifications détectées)

```
ACTION 1 — DÉPLACER IMMÉDIATEMENT :
Fichier : Images Axion-IA/1 TO 1/Dirigeant 1 TO 1/ChatGPT Image 19 mai 2026, 16_54_06.png
→ Déplacer vers : Images Axion-IA/Audit/
→ Raison : L'image dit "AUDIT IA. VOTRE AVANCE, PAS CELLE DE VOS CONCURRENTS."
            Elle n'a rien à voir avec le coaching 1-TO-1.

ACTION 2 — NOTER EN DB :
Image équipe 12 personnes (17_25_36.png dans Propositions)
→ Ajouter tags : equipe, a-propos
→ Ajouter à sitemapPages : ['/fr/a-propos', '/fr/']
```

---

## PHASE 3 — MANIFEST DE RENOMMAGE COMPLET (73 images)

> Slugs basés sur le **texte réellement visible** dans chaque image (analyse visuelle réelle).  
> Format : `axion-ia-{catégorie}-{message-clé-visible}-{type}`  
> Types : `banniere` / `carre` / `affiche` / `infographie` / `editorial` / `photo` / `dataviz` / `logo`

### AUDIT (17 images après correction)

| Fichier source | Slug cible | Type | Texte visible clé |
|---|---|---|---|
| Audit/15_06_17.png | `axion-ia-audit-ia-entreprise-prete-intelligence-artificielle-banniere` | banniere | "Votre entreprise est-elle prête pour l'IA ?" |
| Audit/15_07_00.png | `axion-ia-audit-ia-avantage-competitif-decisions-resultats-banniere` | banniere | "avantage compétitif / décisions éclairées" |
| Audit/15_08_01.png | `axion-ia-audit-ia-transformer-defis-opportunites-leviers-valeur-banniere` | banniere | "L'IA peut transformer vos défis en opportunités" |
| Audit/15_09_45.png | `axion-ia-publicite-outdoor-ia-rapporte-concretement-productivite-affiche` | affiche | "L'IA QUI RAPPORTE CONCRÈTEMENT" |
| Audit/15_14_28.png | `axion-ia-audit-ia-levier-croissance-mesurable-cartographie-roi-banniere` | banniere | "Faites de l'IA un levier de croissance mesurable" |
| Audit/15_20_33.png | `axion-ia-audit-ia-solutions-artisans-commercants-tpe-pme-eti-banniere` | banniere | "Des solutions IA adaptées à votre réalité" |
| Audit/15_25_19.png | `axion-ia-audit-processus-automatiser-temps-couts-productivite-infographie` | infographie | "Audit en entreprise / processus à automatiser" |
| Audit/15_26_25.png | `axion-ia-audit-entreprise-metro-gagner-temps-reduire-couts-affiche` | affiche | "Audit en entreprise / GAGNER DU TEMPS" (billboard métro) |
| Audit/15_39_30.png | `axion-ia-audit-ia-methode-5-etapes-analyse-roi-recommandations-infographie` | infographie | "Notre méthode d'audit IA en 5 étapes clés" |
| Audit/16_34_20.png | `axion-ia-citation-avenir-prepare-aujourd-hui-comprendre-agir-editorial` | editorial | "L'avenir ne se prévoit pas, il se prépare aujourd'hui" |
| Audit/16_41_54.png | `axion-ia-citation-clarte-serenite-resultats-toujours-editorial` | editorial | "La clarté aujourd'hui, la sérénité demain, les résultats toujours" |
| Audit/16_49_52.png | `axion-ia-audit-ia-choix-rentable-benefices-immediats-roi-garanti-carre` | carre | "AUDIT IA : UN CHOIX RENTABLE, DES BÉNÉFICES IMMÉDIATS" |
| Audit/16_52_14.png | `axion-ia-audit-ia-vous-gagnez-temps-argent-zero-perte-100-gain-carre` | carre | "AUDIT IA. VOUS GAGNEZ. DU TEMPS. DE L'ARGENT." |
| Audit/16_56_47.png | `axion-ia-audit-ia-plus-valeur-moins-perte-performances-decuplees-carre` | carre | "AUDIT IA. PLUS DE VALEUR, MOINS DE PERTE" |
| Audit/17_04_41.png | `axion-ia-audit-ia-chaos-ordre-performance-gain-temps-couts-carre` | carre | puce IA centre / chaos → ordre |
| Audit/17_12_03.png | `axion-ia-audit-ia-une-journee-mois-gagnes-switch-on-carre` | carre | "1 JOURNÉE DES MOIS GAGNÉS" |
| ⚠️ Dirigeant/16_54_06.png | `axion-ia-audit-ia-votre-avance-concurrents-benchmark-carre` | carre | "AUDIT IA. VOTRE AVANCE, PAS CELLE DE VOS CONCURRENTS" |

### FORMATIONS & INTERVENTIONS (15 images)

| Fichier source | Slug cible | Type | Texte visible clé |
|---|---|---|---|
| 14_58_25.png | `axion-ia-formation-ia-1-jour-sur-mesure-generique-reserver-carre` | carre | "Formation 1 jour. Sur mesure ou Générique." |
| 15_36_17.png | `axion-ia-intervention-ia-rapide-resultats-concrets-entreprise-carre` | carre | "Interventions rapides, résultats concrets" |
| 15_40_21.png | `axion-ia-formation-ia-comprendre-creer-transformer-humaine-augmentee-banniere` | banniere | "Comprendre, créer, transformer / INTELLIGENCE HUMAINE AUGMENTÉE" |
| 15_52_33.png | `axion-ia-intervention-ia-france-toutes-regions-photo-banniere` | photo | "Interventions rapides" + carte France |
| 16_31_00.png | `axion-ia-formation-acculturation-ia-tpe-pme-eti-2026-photo-banniere` | photo | "Acculturation IA en entreprise / TPE PME ETI en 2026" |
| 16_32_32.png | `axion-ia-citation-intelligence-artificielle-valeur-impact-editorial` | editorial | "L'IA n'a de valeur que par l'impact qu'elle crée" |
| 16_36_59.png | `axion-ia-citation-ia-ne-remplace-pas-humain-revele-potentiel-editorial` | editorial | "L'IA ne remplace pas l'humain. Elle révèle son potentiel." |
| 16_39_44.png | `axion-ia-formation-ia-vous-gagnez-concretement-5-benefices-banniere` | banniere | "VOUS GAGNEZ. CONCRÈTEMENT." + 5 bénéfices |
| 16_43_37.png | `axion-ia-citation-investir-connaissance-liberte-demain-editorial` | editorial | "Investir en connaissance aujourd'hui, c'est récolter la liberté demain" |
| 17_06_59.png | `axion-ia-formation-ia-benefices-premier-jour-formateur-photo-carre` | photo | "Formation Axion-IA / BÉNÉFICES CONCRETS DÈS LE PREMIER JOUR" |
| 17_09_51.png | `axion-ia-formation-ia-avant-apres-une-journee-resultats-photo-carre` | photo | "AVANT / 1 JOUR DE FORMATION / APRÈS" |
| 17_24_57.png | `axion-ia-formation-ia-moins-stress-clarte-une-journee-photo-banniere` | photo | "MOINS DE STRESS. PLUS DE CLARTÉ." + pierres zen |
| Formations_ia_entreprises.png | `axion-ia-formation-equipe-ia-40-pourcent-productivite-100-mesure-carre` | carre | "Formez votre équipe à l'IA / +40% productivité / 100% sur mesure" |
| Formation_un_jour_ia_entreprises.png | `axion-ia-formation-1-jour-progresser-sur-mesure-generique-carre` | carre | "Formation 1 jour / progresser concrètement" |
| Intervention_un_jour_ia_entreprises.png | `axion-ia-formation-ia-1-jour-reserver-session-carre` | carre | "Formation 1 jour / Réservez votre session" |

### AUTOMATISATIONS & IMPLÉMENTATIONS (4 images)

| Fichier source | Slug cible | Type | Texte visible clé |
|---|---|---|---|
| 16_37_54.png | `axion-ia-automatisation-ia-benefices-concrets-mesurables-durables-banniere` | banniere | "Des bénéfices concrets, mesurables, durables" |
| 17_00_31.png | `axion-ia-automatisation-ia-avant-apres-tableau-bord-45-pourcent-photo-carre` | photo | avant (chaos) → après (tableau bord +45%) |
| 17_01_46.png | `axion-ia-automatisation-ia-performance-86-pourcent-gain-temps-couts-carre` | carre | "Performance +86%" |
| 17_03_26.png | `axion-ia-automatisation-ia-triangle-temps-couts-resultats-100-gagnant-carre` | carre | triangle + "100% GAGNANT. MOINS DE COMPLEXITÉ." |

### 1-TO-1 DIRIGEANT (6 images après correction)

| Fichier source | Slug cible | Type | Texte visible clé |
|---|---|---|---|
| 17_16_16.png | `axion-ia-dirigeant-1to1-ouvrir-ralentit-entreprise-12h-semaine-photo-banniere` | photo | "OUVREZ CE QUI RALENTIT VOTRE ENTREPRISE / +12h/sem" |
| 17_21_00.png | `axion-ia-dirigeant-1to1-reprendre-controle-journee-avant-apres-photo-banniere` | photo | "UNE JOURNÉE. POUR REPRENDRE LE CONTRÔLE." |
| 17_23_26.png | `axion-ia-dirigeant-1to1-temps-plus-grand-atout-liberer-sablier-photo-banniere` | photo | "DIRIGEANT, VOTRE TEMPS EST VOTRE PLUS GRAND ATOUT" |
| 17_26_25.png | `axion-ia-dirigeant-1to1-moins-stress-clarte-performance-photo-banniere` | photo | "MOINS DE STRESS. PLUS DE CLARTÉ." (dirigeant) |
| 17_29_29.png | `axion-ia-dirigeant-1to1-moins-subir-plus-piloter-impact-durable-photo-banniere` | photo | "MOINS SUBIR, + PILOTER." |
| 17_36_51.png | `axion-ia-dirigeant-1to1-15h-liberees-35-efficacite-25-productivite-infographie` | infographie | "+15h libérées / +35% efficacité / +25% productivité" |

### 1-TO-1 MEMBRE D'ÉQUIPE (2 images)

| Fichier source | Slug cible | Type | Texte visible clé |
|---|---|---|---|
| 17_33_10.png | `axion-ia-equipe-1to1-tous-profils-manager-rh-marketing-ops-photo-banniere` | photo | "1 TO 1. POUR VOUS. POUR GAGNER DU TEMPS." + 6 profils |
| 17_38_50.png | `axion-ia-equipe-1to1-une-personne-grandir-competence-performance-photo-carre` | photo | "1 TO 1. UNE PERSONNE. POUR VOUS FAIRE GRANDIR." |

### GRAPHIQUES & DATAVIZ (5 images)

| Fichier source | Slug cible | Type | Texte visible clé |
|---|---|---|---|
| 15_40_47.png | `axion-ia-graphique-processus-5-etapes-timeline-infographie` | infographie | processus 5 étapes timeline |
| 15_44_05.png | `axion-ia-graphique-performance-ia-kpi-20-60-pourcent-dataviz` | dataviz | "+20% à +60% performance IA" |
| 15_50_10.png | `axion-ia-graphique-adoption-ia-72-pourcent-2024-mckinsey-dataviz` | dataviz | "72% entreprises ont adopté l'IA en 2024" |
| 15_54_27.png | `axion-ia-graphique-ia-imperatif-performance-fosse-concurrentiel-dataviz` | dataviz | "L'IA n'est plus une option. C'est un impératif." |
| 15_58_17.png | `axion-ia-graphique-ia-maintenant-attendre-explorer-integrer-dominer-infographie` | infographie | "L'IA n'est pas le futur. C'est maintenant." |

### LOGOS (7 images)

| Fichier source | Slug cible | Notes |
|---|---|---|
| logo plat.png | `axion-ia-logo-horizontal-fond-blanc-bordure-orange` | WebP lossless |
| logo plat sans fond nulle part.png | `axion-ia-logo-horizontal-transparent` | WebP lossless |
| logo blanc fond blanc et sans fond extérieur.png | `axion-ia-logo-horizontal-fond-blanc` | WebP lossless |
| logo blanc fond blanc... 500 pixels.png | `axion-ia-logo-horizontal-fond-blanc-500px` | WebP lossless |
| logo sans fond extérieur icone.png | `axion-ia-icone-app-fond-creme` | WebP lossless |
| logo sans fond extérieur icone 500 pixels.png | `axion-ia-icone-app-fond-creme-500px` | WebP lossless |
| logo sans fond nulle part.png | `axion-ia-icone-app-transparent` | WebP lossless |

### PROPOSITIONS (11 images)

| Fichier source | Slug cible | Type | Texte visible clé |
|---|---|---|---|
| 15_14_04.png | `axion-ia-proposition-outdoor-formations-audit-implementations-affiche` | affiche | billboard outdoor tous services |
| 15_16_13.png | `axion-ia-proposition-showroom-mur-services-formations-audit-photo` | photo | mur showroom 4 services |
| 15_19_06.png | `axion-ia-proposition-ia-pour-tous-artisans-tpe-pme-banniere` | banniere | "L'IA n'est pas réservée aux grandes entreprises" |
| 15_22_29.png | `axion-ia-proposition-globe-4-services-formations-audit-implementations-carre` | carre | globe + 4 services |
| 15_27_51.png | `axion-ia-proposition-booster-productivite-equipes-automatiser-affiche` | affiche | "BOOSTEZ LA PRODUCTIVITÉ DE VOS ÉQUIPES" |
| 15_29_28.png | `axion-ia-proposition-solutions-ia-chaque-realite-5-secteurs-banniere` | banniere | "Des solutions IA adaptées à chaque réalité" |
| 15_32_56.png | `axion-ia-proposition-temps-precieux-taches-processus-intelligents-carre` | carre | quadrant 4 messages orange |
| 15_37_25.png | `axion-ia-proposition-moins-taches-plus-valeur-carre` | carre | "Moins de tâches. Plus de valeur." |
| 15_48_03.png | `axion-ia-proposition-ia-simplifie-interventions-photo-banniere` | photo | "L'IA qui simplifie vos interventions" |
| 16_59_10.png | `axion-ia-proposition-temps-vers-argent-croissance-photo-banniere` | photo | sablier + pièces + courbe |
| 17_25_36.png | `axion-ia-equipe-ia-service-humain-12-personnes-photo-groupe` | photo | équipe 12 personnes pulls terracotta |

### VILLES (5 images existantes)

| Fichier source | Slug cible | Type | Géo |
|---|---|---|---|
| Paris/16_08_59.png | `axion-ia-paris-consultante-tour-eiffel-performance-28-pourcent-banniere` | photo | Paris 48.8566°N 2.3522°E |
| Paris/16_18_57.png | `axion-ia-paris-ia-reussite-entreprise-sacre-coeur-banniere` | photo | Paris 48.8566°N 2.3522°E |
| Paris/16_20_46.png | `axion-ia-paris-tour-eiffel-services-ia-carte-france-carre` | photo | Paris 48.8566°N 2.3522°E |
| Paris/16_29_13.png | `axion-ia-paris-formation-ia-haussmann-se-former-comprendre-agir-banniere` | photo | Paris 48.8566°N 2.3522°E |
| Lyon/17_38_21.png | `axion-ia-lyon-formation-ia-presquile-fourviere-se-former-banniere` | photo | Lyon 45.7640°N 4.8357°E |

---

## PHASE 4 — OCR TEXT → embeddedTextCaption (signal Google critique)

Google Vision API lit le texte visible dans chaque image. Ce texte doit figurer dans `embeddedTextCaption` du JSON-LD. C'est le signal de cohérence image/page le plus sous-estimé du SEO image 2026.

**Exemples :**

```json
// axion-ia-graphique-adoption-ia-72-pourcent-2024-mckinsey-dataviz
"embeddedTextCaption": "L'IA dans les entreprises. Une adoption en forte accélération. 20% 2017. 25% 2018. 30% 2019. 35% 2020. 40% 2021. 50% 2022. 55% 2023. 72% 2024. Projection 2026 : 80%. 72% des entreprises ont adopté l'IA en 2024. ROI en 1 à 2 ans. Source : McKinsey — The State of AI 2024. Axion-IA."

// axion-ia-dirigeant-1to1-15h-liberees-35-efficacite-25-productivite-infographie
"embeddedTextCaption": "1 TO 1. 1 PERSONNE. 1 JOURNÉE. +15h de temps libérées par semaine. +35% d'efficacité opérationnelle. -20% de coûts indirects. +25% de productivité globale. Réservez votre journée. Axion-IA."

// axion-ia-audit-ia-choix-rentable-benefices-immediats-roi-garanti-carre
"embeddedTextCaption": "AUDIT IA : UN CHOIX RENTABLE, DES BÉNÉFICES IMMÉDIATS. Gain de temps immédiat. Réduction des coûts immédiate. Performance boostée. Décisions plus justes. Retour sur investissement garanti. ZÉRO PERTE. 100% GAIN. Axion-IA."
```

**Règle** : transcrire fidèlement tout le texte visible — titres, sous-titres, bullets, stats, CTAs, URL.

---

## PHASE 5 — JSON-LD ImageObject 2026 COMPLET

### Template par image

```json
{
  "@context": "https://schema.org",
  "@type": "ImageObject",
  "@id": "https://axion-ia.com/images/[SLUG].webp",

  "name": "[Titre FR descriptif — 60 chars]",
  "alternateName": "[Titre EN]",
  "description": "[Description narrative 150-200 chars — ce que montre l'image et son contexte métier]",
  "abstract": "[Résumé 1 phrase — pour les IA génératives]",
  "embeddedTextCaption": "[TEXTE EXACT VISIBLE DANS L'IMAGE]",

  "contentUrl": "https://axion-ia.com/images/[SLUG].webp",
  "thumbnailUrl": "https://axion-ia.com/images/[SLUG]-thumb.webp",
  "encodingFormat": "image/webp",
  "width": [largeur réelle],
  "height": [hauteur réelle],

  "creator": { "@type": "Organization", "name": "Axion-IA", "url": "https://axion-ia.com" },
  "copyrightHolder": { "@type": "Organization", "name": "Axion-IA OÜ" },
  "copyrightYear": 2026,
  "license": "https://creativecommons.org/licenses/by/4.0/",
  "acquireLicensePage": "https://axion-ia.com/licences-images",
  "creditText": "© 2026 Axion-IA OÜ — CC BY 4.0",

  "aiGenerated": true,
  "generator": { "@type": "SoftwareApplication", "name": "DALL-E (OpenAI)" },

  "keywords": "[12-15 mots-clés FR ciblés, séparés par virgules]",
  "about": [{ "@type": "Service", "name": "[service Axion-IA]", "url": "[page service]" }],
  "subjectOf": { "@type": "WebPage", "url": "[page hôte principale]" },

  "speakable": { "@type": "SpeakableSpecification", "cssSelector": ["figcaption", "[data-speakable='true']"] },

  "additionalProperty": [
    { "@type": "PropertyValue", "name": "imageType", "value": "[banniere|carre|affiche|infographie|editorial|photo|dataviz|logo]" },
    { "@type": "PropertyValue", "name": "category", "value": "[audit|formation|automatisation|dirigeant|equipe|graphique|logo|proposition|ville]" },
    { "@type": "PropertyValue", "name": "aiGenerated", "value": "true" }
  ],

  "inLanguage": ["fr-FR", "en-US"],
  "datePublished": "2026-05-19"
}
```

### Adaptations spéciales

**Images villes** — ajouter :
```json
"contentLocation": {
  "@type": "City",
  "name": "[VILLE]",
  "sameAs": "https://www.wikidata.org/wiki/[ID_WIKIDATA]",
  "address": { "@type": "PostalAddress", "addressLocality": "[VILLE]", "addressCountry": "FR" },
  "geo": { "@type": "GeoCoordinates", "latitude": [lat], "longitude": [lon] }
}
```

**Logos** — ajouter :
```json
"@type": ["ImageObject", "Logo"],
"about": { "@type": "Organization", "name": "Axion-IA", "url": "https://axion-ia.com" }
```

**Dataviz avec chiffres** — ajouter :
```json
"measurementTechnique": "McKinsey State of AI 2024 / Axion-IA études internes",
"variableMeasured": "Taux adoption IA entreprises / ROI IA",
"temporalCoverage": "2017/2026"
```

---

## PHASE 6 — ALT TEXT COMPLET (73 images)

> Règle : 8-20 mots, < 125 chars, texte clé de l'image mentionné, Axion-IA naturellement présent.

**AUDIT :**
```
prete-ia-banniere         → "Axion-IA audit IA : votre entreprise est-elle prête pour l'intelligence artificielle ?"
avantage-competitif       → "Audit IA Axion-IA : faire de l'IA votre avantage compétitif avec des décisions éclairées"
transformer-defis         → "L'IA Axion-IA transforme vos défis en opportunités — leviers de valeur identifiés"
outdoor-rapporte          → "Affiche Axion-IA : l'IA qui rapporte concrètement — productivité, profits, résultats"
levier-croissance         → "Audit IA Axion-IA : faire de l'intelligence artificielle un levier de croissance mesurable"
solutions-secteurs        → "Solutions IA Axion-IA pour tous : artisans, commerçants, TPE, PME et ETI"
processus-automatiser     → "Infographie audit IA Axion-IA : identifier les processus à automatiser pour gagner temps et coûts"
metro-gagner-temps        → "Billboard métro Axion-IA : audit entreprise pour gagner du temps et réduire les coûts"
methode-5-etapes          → "Méthode audit IA Axion-IA en 5 étapes : analyse, identification, ROI, recommandations"
citation-avenir           → "Citation Axion-IA : l'avenir ne se prévoit pas, il se prépare aujourd'hui"
citation-clarte           → "Citation Axion-IA : la clarté aujourd'hui, la sérénité demain, les résultats toujours"
choix-rentable-roi        → "Axion-IA audit IA rentable : 5 bénéfices immédiats — temps, coûts, performance, décisions, ROI"
vous-gagnez-temps-argent  → "Audit IA Axion-IA : vous gagnez du temps et de l'argent — zéro perte, 100% de gains"
plus-valeur-moins-perte   → "Audit IA Axion-IA : plus de valeur, moins de perte — performances décuplées"
chaos-ordre               → "Axion-IA transforme le chaos en ordre grâce à l'audit IA — performance et décisions"
une-journee-mois-gagnes   → "Audit IA Axion-IA : une journée pour des mois gagnés — rapide, concret, efficace"
votre-avance-concurrents  → "Audit IA Axion-IA : prenez l'avance sur vos concurrents — benchmark et performance"
```

**FORMATION :**
```
1-jour-sur-mesure         → "Formation IA 1 jour Axion-IA : sur mesure ou générique — réservez votre session"
intervention-rapide       → "Intervention IA rapide Axion-IA : résultats concrets pour votre entreprise"
comprendre-creer          → "Formation IA Axion-IA : comprendre, créer, transformer — intelligence humaine augmentée"
france-regions            → "Consultant Axion-IA en intervention IA partout en France — résultats mesurables"
acculturation-2026        → "Acculturation IA Axion-IA : par où commencer pour TPE, PME et ETI en 2026"
citation-valeur-impact    → "Citation Axion-IA : l'intelligence artificielle n'a de valeur que par l'impact créé"
citation-ne-remplace      → "Citation Axion-IA : l'IA ne remplace pas l'humain, elle révèle son potentiel"
vous-gagnez-5-benefices   → "Formation IA Axion-IA : vous gagnez concrètement — 5 bénéfices pour dépasser vos concurrents"
citation-connaissance     → "Citation Axion-IA : investir en connaissance aujourd'hui, récolter la liberté demain"
premier-jour              → "Formateur Axion-IA avec résultats concrets dès le premier jour de formation IA"
avant-apres               → "Avant/après formation IA Axion-IA : une journée pour des résultats concrets et durables"
moins-stress              → "Formation IA Axion-IA : moins de stress, plus de clarté — changer votre quotidien"
40-pourcent-productivite  → "Formez votre équipe à l'IA avec Axion-IA : +40% productivité, 100% sur mesure"
1-jour-progresser         → "Formation IA 1 jour Axion-IA pour progresser : sur mesure ou générique"
reserver-session          → "Réservez votre formation IA 1 jour Axion-IA — sur mesure adaptée à vos outils"
```

**AUTOMATISATION :**
```
benefices-durables        → "Automatisation IA Axion-IA : bénéfices concrets, mesurables et durables"
avant-apres-45pct         → "Avant/après automatisation IA Axion-IA : tableau de bord +45% performance"
performance-86pct         → "Automatisation IA Axion-IA : performance +86%, gain de temps et réduction des coûts"
triangle-100-gagnant      → "Triangle d'or Axion-IA : automatisation IA — temps, coûts, résultats, 100% gagnant"
```

**1-TO-1 DIRIGEANT :**
```
12h-semaine               → "Coaching IA Axion-IA dirigeants : ouvrez ce qui ralentit votre entreprise — +12h libérées"
reprendre-controle        → "1 journée Axion-IA pour reprendre le contrôle : temps, clarté et résultats dirigeants"
temps-atout               → "Axion-IA coaching dirigeant : votre temps est votre plus grand atout — une journée pour le libérer"
moins-stress-dirigeant    → "Coaching IA dirigeant Axion-IA : moins de stress, clarté, simplicité et performance"
moins-subir               → "Axion-IA 1-to-1 dirigeant : moins subir, plus piloter — process clairs et croissance"
15h-35pct-25pct           → "1 to 1 Axion-IA dirigeant : +15h libérées/semaine, +35% efficacité, +25% productivité"
```

**ÉQUIPE :**
```
tous-profils              → "1 to 1 Axion-IA pour toute l'équipe : managers, RH, directeurs, marketing, ops"
grandir-competence        → "1 to 1 Axion-IA : une personne dédiée pour développer compétences et performance"
```

**GRAPHIQUES :**
```
5-etapes-timeline         → "Infographie Axion-IA : processus IA en 5 étapes de l'analyse au résultat mesurable"
kpi-20-60-pct             → "Graphique Axion-IA : l'IA booste la performance de +20% à +60% selon les KPIs"
72-pourcent-2024          → "Courbe adoption IA : 72% des entreprises en 2024, projection 80% en 2026 — McKinsey"
imperatif-performance     → "Graphique Axion-IA : l'IA est un impératif de performance — fossé concurrentiel se creuse"
maintenant-dominer        → "L'IA c'est maintenant : 4 niveaux Axion-IA — attendre, explorer, intégrer, dominer"
```

**PROPOSITIONS :**
```
outdoor-billboard         → "Affiche Axion-IA : formations, audit IA, implémentations et résultats concrets"
showroom-mur              → "Mur showroom Axion-IA : 4 services — formations IA, audit, implémentations, résultats"
ia-pour-tous              → "L'IA n'est pas réservée aux grandes entreprises — Axion-IA accompagne artisans et TPE"
globe-4-services          → "Globe Axion-IA entouré des 4 services : formations, audit IA, implémentations, résultats"
booster-productivite      → "Axion-IA booste la productivité des équipes — automatiser l'inutile, libérer le potentiel"
solutions-5-secteurs      → "Solutions IA Axion-IA adaptées à chaque réalité d'entreprise — 5 secteurs"
quadrant-temps-precieux   → "Quadrant Axion-IA : temps précieux, tâches répétitives, processus intelligents, coûts réduits"
moins-taches-valeur       → "Axion-IA : moins de tâches répétitives, plus de valeur grâce à l'intelligence artificielle"
ia-simplifie              → "L'IA Axion-IA simplifie vos interventions au quotidien"
temps-argent              → "Axion-IA transforme votre temps en argent et croissance — courbe de rentabilité IA"
equipe-service-humain     → "Équipe Axion-IA — l'intelligence artificielle au service de l'humain — 12 experts"
```

**VILLES :**
```
paris-28pct               → "Consultante Axion-IA à Paris devant la Tour Eiffel : +28% performance, 4,8/5 satisfaction"
paris-reussite            → "Axion-IA Paris — intelligence artificielle au cœur de la réussite des entreprises"
paris-carre               → "Axion-IA Paris : services IA localisés en Île-de-France avec la Tour Eiffel"
paris-formation           → "Formation IA à Paris avec Axion-IA : se former, comprendre et agir — Paris haussmannien"
lyon-formation            → "Formation IA à Lyon avec Axion-IA : se former et agir — Presqu'île et Fourvière"
```

---

## PHASE 7 — VARIANTS TECHNIQUES (format-aware)

### Crop intelligent selon le type d'image

```typescript
const cropConfig = {
  'banniere':    { ogFit: 'cover',   ogPosition: 'center',    squareFit: 'cover',   squarePosition: 'attention' },
  'carre':       { ogFit: 'contain', ogBackground: '#FFFFFF',  squareFit: 'outside', squarePosition: 'center'    },
  'affiche':     { ogFit: 'cover',   ogPosition: 'left',       squareFit: 'cover',   squarePosition: 'attention' },
  'infographie': { ogFit: 'cover',   ogPosition: 'top',        squareFit: 'cover',   squarePosition: 'top'       },
  'editorial':   { ogFit: 'cover',   ogPosition: 'center',     squareFit: 'cover',   squarePosition: 'center'    },
  'photo':       { ogFit: 'cover',   ogPosition: 'attention',  squareFit: 'cover',   squarePosition: 'attention' },
  'dataviz':     { ogFit: 'contain', ogBackground: '#FFFFFF',  squareFit: 'contain', squareBackground: '#FFFFFF' },
  'logo':        { ogFit: 'contain', ogBackground: '#FFFFFF',  squarePadding: 80,    webpLossless: true          },
}
```

### 8 variants générés par image
```
[slug].webp         → Principal WebP q85, dims originales (min 1200px)
[slug].avif         → AVIF q70, dims originales
[slug]-og.webp      → 1200×630 smart crop (format-aware)
[slug]-square.webp  → 1080×1080 smart crop (format-aware)
[slug]-thumb.webp   → 400×300 cover
[slug]-md.webp      → 768px wide
[slug]-sm.webp      → 384px wide
[slug]-lqip.b64     → 16px blur base64 pour placeholder
```

---

## PHASE 8 — COMPOSANT HTML NEXT.JS

```tsx
// src/components/ui/ImageBankPicture.tsx
export function ImageBankPicture({ slug, alt, caption, priority = false, width, height, lqipBase64 }) {
  const base = `/images/${slug}`
  return (
    <figure itemScope itemType="https://schema.org/ImageObject">
      <picture>
        <source type="image/avif" srcSet={`${base}.avif 1920w, ${base}-md.avif 768w, ${base}-sm.avif 384w`}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 1200px" />
        <source type="image/webp" srcSet={`${base}.webp 1920w, ${base}-md.webp 768w, ${base}-sm.webp 384w`}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 1200px" />
        <img src={`${base}.webp`} alt={alt} width={width} height={height}
          loading={priority ? 'eager' : 'lazy'} decoding={priority ? 'sync' : 'async'}
          fetchPriority={priority ? 'high' : 'auto'}
          style={{ backgroundImage: `url(${lqipBase64})`, backgroundSize: 'cover' }}
          itemProp="contentUrl" />
      </picture>
      {caption && <figcaption itemProp="description" className="sr-only" data-speakable="true">{caption}</figcaption>}
      <meta name="robots" content="max-image-preview:large" />
    </figure>
  )
}
```

### Meta head obligatoire sur chaque page avec images
```html
<meta name="robots" content="max-image-preview:large, max-snippet:-1" />
<meta property="og:image" content="https://axion-ia.com/images/[slug]-og.webp" />
<meta property="og:image:alt" content="[alt text]" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:type" content="image/webp" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="https://axion-ia.com/images/[slug]-og.webp" />
```

---

## PHASE 9 — MATRIX MOTS-CLÉS (73 images → 0 cannibalisation)

Chaque image cible un mot-clé différent. Aucune duplication.

| Image (abrégé) | Mot-clé cible #1 | Page hôte |
|---|---|---|
| audit-methode-5-etapes | "méthode audit IA 5 étapes" | /fr/audit-ia |
| audit-choix-rentable-roi | "audit IA rentable ROI garanti" | /fr/audit-ia |
| audit-processus-automatiser | "processus à automatiser IA" | /fr/audit-ia |
| audit-votre-avance-concurrents | "audit IA surpasser concurrents" | /fr/audit-ia |
| audit-outdoor-rapporte | "l'IA qui rapporte concrètement" | /fr/ |
| audit-solutions-secteurs | "audit IA artisans commerçants PME ETI" | /fr/solutions-ia |
| audit-metro-gagner-temps | "audit entreprise gagner temps réduire coûts" | /fr/audit-ia |
| audit-levier-croissance | "audit IA levier croissance mesurable" | /fr/audit-ia |
| audit-une-journee-mois-gagnes | "audit IA une journée mois gagnés" | /fr/audit-ia |
| audit-vous-gagnez | "audit IA gagner temps argent" | /fr/audit-ia |
| audit-plus-valeur | "audit IA performances décuplées" | /fr/audit-ia |
| audit-chaos-ordre | "audit IA chaos vers performance" | /fr/audit-ia |
| audit-entreprise-prete | "votre entreprise prête IA" | /fr/audit-ia |
| audit-avantage-competitif | "audit IA avantage compétitif" | /fr/audit-ia |
| audit-transformer-defis | "transformer défis en opportunités IA" | /fr/audit-ia |
| citation-avenir | "L'avenir se prépare IA" | /fr/blog |
| citation-clarte | "clarté sérénité résultats IA" | /fr/blog |
| formation-acculturation | "acculturation IA entreprise PME 2026" | /fr/formations-ia |
| formation-avant-apres | "formation IA avant après résultats" | /fr/formations-ia |
| formation-40pct-productivite | "former équipe IA +40% productivité" | /fr/formations-ia |
| formation-premier-jour | "formation IA bénéfices dès le premier jour" | /fr/formations-ia |
| formation-1-jour | "formation IA 1 jour sur mesure" | /fr/formation-ia-1-jour |
| formation-reserver | "réserver formation IA 1 jour" | /fr/formation-ia-1-jour |
| formation-comprendre-creer | "formation IA comprendre créer transformer" | /fr/formations-ia |
| formation-france | "intervention IA France toutes régions" | /fr/interventions-ia |
| formation-intervention-rapide | "intervention IA rapide résultats" | /fr/interventions-ia |
| formation-vous-gagnez | "formation IA bénéfices concrets" | /fr/formations-ia |
| formation-moins-stress | "formation IA moins stress clarté" | /fr/formations-ia |
| citation-valeur-impact | "IA valeur par l'impact créé" | /fr/blog |
| citation-ne-remplace | "IA ne remplace pas l'humain" | /fr/blog |
| citation-connaissance | "investir connaissance IA liberté" | /fr/blog |
| automatisation-avant-apres | "automatisation IA +45% performance" | /fr/automatisation-ia |
| automatisation-86pct | "automatisation IA performance +86%" | /fr/automatisation-ia |
| automatisation-triangle | "automatisation IA 100% gagnant" | /fr/automatisation-ia |
| automatisation-benefices | "bénéfices automatisation IA durables" | /fr/automatisation-ia |
| dirigeant-12h | "ce qui ralentit entreprise IA +12h" | /fr/accompagnement-dirigeants |
| dirigeant-reprendre | "reprendre contrôle IA dirigeant" | /fr/accompagnement-dirigeants |
| dirigeant-temps-atout | "temps atout dirigeant libérer IA" | /fr/accompagnement-dirigeants |
| dirigeant-stress | "moins stress clarté performance dirigeant IA" | /fr/accompagnement-dirigeants |
| dirigeant-piloter | "moins subir plus piloter IA" | /fr/accompagnement-dirigeants |
| dirigeant-15h-35pct | "1 to 1 IA +15h +35% efficacité" | /fr/accompagnement-dirigeants |
| equipe-tous-profils | "1 to 1 IA tous profils équipe" | /fr/accompagnement-equipes |
| equipe-grandir | "coaching IA individuel compétences" | /fr/accompagnement-equipes |
| graphique-72pct | "72% entreprises adoptent IA 2024" | /fr/blog/adoption-ia |
| graphique-kpi | "KPI IA +20% à +60% performance" | /fr/blog/roi-ia |
| graphique-imperatif | "IA impératif performance fossé concurrentiel" | /fr/blog/ia-imperatif |
| graphique-maintenant | "IA maintenant attendre explorer dominer" | /fr/blog/ia-maintenant |
| graphique-5-etapes | "processus IA 5 étapes timeline" | /fr/ressources |
| proposition-globe | "4 services IA Axion-IA" | /fr/ |
| proposition-ia-pour-tous | "IA pas réservée grandes entreprises" | /fr/solutions-ia |
| equipe-12-personnes | "équipe Axion-IA IA service humain" | /fr/a-propos |
| proposition-outdoor | "cabinet IA formations audit implémentations" | /fr/ |
| proposition-booster | "booster productivité équipes IA" | /fr/solutions-ia |
| proposition-solutions | "solutions IA chaque secteur entreprise" | /fr/solutions-ia |
| proposition-temps-argent | "temps vers argent croissance IA" | /fr/solutions-ia |
| proposition-moins-taches | "moins tâches plus valeur IA" | /fr/solutions-ia |
| proposition-ia-simplifie | "IA simplifie interventions" | /fr/interventions-ia |
| proposition-showroom | "showroom Axion-IA 4 services" | /fr/a-propos |
| proposition-quadrant | "temps précieux tâches répétitives IA" | /fr/solutions-ia |
| paris-tour-eiffel | "formation IA Paris +28% performance" | /fr/ia-paris |
| paris-reussite | "IA Paris réussite entreprise" | /fr/ia-paris |
| paris-carre | "Axion-IA Paris services IA" | /fr/ia-paris |
| paris-formation | "se former IA Paris" | /fr/formation-ia-paris |
| lyon-formation | "formation IA Lyon comprendre agir" | /fr/ia-lyon |

---

## PHASE 10 — VILLES : STRATÉGIE COMPLÈTE 2 157 COMMUNES

### Tier 1 — 40 villes > 100 000 hab → images dédiées

**Paris ✅ (4 images) — Lyon ✅ (1 image) — 38 villes restantes à générer :**

```
PRIORITÉ 1 (métropoles majeures) :
Marseille  : "historic Vieux-Port with Notre-Dame de la Garde basilica on hill, golden hour"
Toulouse   : "Place du Capitole with pink brick architecture Toulouse, evening warm light"
Nice       : "Promenade des Anglais with Mediterranean blue sea, Belle Époque hotels Nice"
Nantes     : "Château des Ducs de Bretagne with modern city skyline, Loire river Nantes"
Montpellier: "Place de la Comédie with Opéra Comédie and modern tramway Montpellier"
Strasbourg : "Petite France with half-timbered houses and Cathedral spire Strasbourg"
Bordeaux   : "Place de la Bourse reflected in Miroir d'eau, Garonne river Bordeaux"
Lille      : "Grand'Place with Vieille Bourse Flemish architecture Lille"
Rennes     : "Parlement de Bretagne with medieval half-timbered buildings Rennes"
Grenoble   : "Grenoble city aerial with Vercors and Chartreuse massifs, cable car"

PRIORITÉ 2 (grandes villes) :
Reims, Le Havre, Saint-Étienne, Toulon, Dijon, Angers, Nîmes, Villeurbanne,
Le Mans, Aix-en-Provence, Brest, Clermont-Ferrand, Tours, Amiens, Limoges

PRIORITÉ 3 (villes importantes) :
Metz, Besançon, Perpignan, Orléans, Mulhouse, Rouen, Caen, Nancy,
Saint-Denis, Boulogne-Billancourt, Montreuil, Argenteuil, Roubaix, Avignon, Versailles
```

**Prompt DALL-E standard pour chaque ville T1 :**
```
Bannière 1920×1080 :
"Professional marketing banner 1920x1080, photorealistic style.
Background: [LANDMARK_DESCRIPTION] of [VILLE], France, golden hour lighting.
Left side overlay: Axion-IA logo, text 'Axion-IA [VILLE]' (large headline),
'Se former. Comprendre. Agir avec l'IA.' (subtitle),
'Formations & interventions à [VILLE]' (caption), location pin icon.
Axion-IA.com URL bottom left. Terracotta #C0440A accents, cream #FAF7F2 overlay.
Premium B2B corporate. No identifiable faces."

Carré 1200×1200 :
"Square 1200x1200 premium business. Right half: aerial view [VILLE] ([LANDMARK]).
Left half: cream background, Axion-IA logo, 'AXION-IA [VILLE]', orange rule,
service icons Formation IA / Audit IA / Implémentations, France map dot on [VILLE].
Terracotta #C0440A accent. Minimal B2B."
```

**Slugs cibles T1 :**
```
axion-ia-marseille-vieux-port-notre-dame-garde-formation-ia-banniere
axion-ia-toulouse-capitole-formation-ia-occitanie-banniere
axion-ia-nice-promenade-anglais-formation-ia-cote-azur-banniere
axion-ia-nantes-chateau-ducs-bretagne-formation-ia-banniere
axion-ia-montpellier-comedie-formation-ia-banniere
axion-ia-strasbourg-cathedrale-petite-france-formation-ia-banniere
axion-ia-bordeaux-bourse-miroir-eau-formation-ia-banniere
axion-ia-lille-grand-place-vieille-bourse-formation-ia-banniere
axion-ia-rennes-parlement-bretagne-formation-ia-banniere
axion-ia-grenoble-belledonne-vercors-formation-ia-banniere
... (+ 1 carré par ville)
```

### Tier 2 — 83 villes 50K-100K → template auto Sharp

```typescript
// src/scripts/generate-city-images-tier2.ts
// Prend la bannière template "Se former. Comprendre. Agir avec l'IA."
// Ajoute en overlay : nom de la ville + département en terracotta
async function generateTier2Banner(ville: VilleData): Promise<void> {
  const template = await fs.readFile('templates/city-banner-template.webp')
  const svg = `<svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
    <text x="80" y="220" font-family="Georgia,serif" font-size="72" fill="#C0440A" font-weight="bold">
      ${ville.nameFr}
    </text>
    <text x="80" y="280" font-family="Arial,sans-serif" font-size="28" fill="#1A1A1A">
      Formations &amp; interventions à ${ville.nameFr} (${ville.departementLabel})
    </text>
  </svg>`
  await sharp(template)
    .composite([{ input: Buffer.from(svg), gravity: 'northwest' }])
    .webp({ quality: 85 })
    .toFile(`public/images/axion-ia-${ville.slug}-formation-ia-banniere.webp`)
}
```

### Tier 3 & 4 — 2 034 villes → métadonnées auto-générées

```typescript
// src/scripts/generate-city-image-metadata.ts
// Pour chaque ville T3/T4 : pas de nouvelle image, mais des métadonnées uniques
function getCityImageMeta(ville: VilleData) {
  // Image générique assignée selon taille
  const genericSlug = ville.population >= 20000
    ? 'axion-ia-formation-acculturation-ia-tpe-pme-eti-2026-photo-banniere'
    : 'axion-ia-formation-ia-comprendre-creer-transformer-humaine-augmentee-banniere'

  return {
    slug: genericSlug,
    altFr: `Formation IA et audit IA à ${ville.nameFr} — Axion-IA intervient en ${ville.departementLabel}`,
    captionFr: `Axion-IA propose des formations IA et des audits IA à ${ville.nameFr} (${ville.departementLabel}), en ${getRegionLabel(ville.region)}. Cabinet conseil IA, nous accompagnons les PME et ETI de ${ville.nameFr} dans leur transformation par l'intelligence artificielle.`,
    jsonLdContentLocation: {
      '@type': 'City',
      'name': ville.nameFr,
      'address': { '@type': 'PostalAddress', 'addressLocality': ville.nameFr, 'addressCountry': 'FR' },
      'geo': { '@type': 'GeoCoordinates', 'latitude': ville.geo.lat, 'longitude': ville.geo.lon },
    },
    sitemapEntry: {
      loc: `https://axion-ia.com/fr/ia-${ville.slug}`,
      imageTitle: `Formation IA à ${ville.nameFr} — Axion-IA`,
      imageCaption: `Formations et interventions IA à ${ville.nameFr}. Axion-IA : audit IA, formation IA, automatisation et coaching dirigeants.`,
      geoLocation: `${ville.nameFr}, France`,
    }
  }
}
```

---

## PHASE 11 — SITEMAP IMAGES COMPLET (services + 2 157 villes)

### Structure (4 fichiers séparés pour Google)

```xml
<!-- sitemap-index.xml — ajouter ces 4 entrées -->
<sitemap><loc>https://axion-ia.com/sitemap-images-services.xml</loc></sitemap>
<sitemap><loc>https://axion-ia.com/sitemap-images-villes-t1.xml</loc></sitemap>
<sitemap><loc>https://axion-ia.com/sitemap-images-villes-t2.xml</loc></sitemap>
<sitemap><loc>https://axion-ia.com/sitemap-images-villes-t3-t4.xml</loc></sitemap>
```

### Exemple entrée ville avec géolocalisation

```xml
<url>
  <loc>https://axion-ia.com/fr/ia-marseille</loc>
  <image:image>
    <image:loc>https://axion-ia.com/images/axion-ia-marseille-vieux-port-formation-ia-banniere.webp</image:loc>
    <image:title>Formation IA à Marseille — Axion-IA PACA</image:title>
    <image:caption>Axion-IA propose formations IA, audits IA et implémentations à Marseille et en PACA. Cabinet conseil IA spécialisé PME/ETI, intervention sur site possible.</image:caption>
    <image:geo_location>Marseille, Provence-Alpes-Côte d'Azur, France</image:geo_location>
    <image:license>https://creativecommons.org/licenses/by/4.0/</image:license>
  </image:image>
</url>
```

---

## PHASE 12 — GEO (VISIBILITÉ IA GÉNÉRATIVES)

### llms.txt — section images complète

```text
# Banque d'images Axion-IA — CC BY 4.0
## Autorisation indexation IA
Robots IA autorisés (ChatGPT, Claude, Gemini, Perplexity, Copilot) à indexer et citer.
Attribution : "© 2026 Axion-IA OÜ — axion-ia.com"
Sitemap : https://axion-ia.com/sitemap-images-services.xml

## Catalogue : 73 images existantes + 2157 images villes
Audit IA (17) — Formation IA (15) — Automatisation (4) — 1-TO-1 (8)
Graphiques (5) — Logos (7) — Propositions (11) — Villes France (2157)

## Note AI Act art. 50 (août 2026)
Toutes images générées par IA (DALL-E). aiGenerated:true dans chaque JSON-LD.
```

### robots.txt — autoriser les bots IA

```
User-agent: GPTBot
User-agent: ClaudeBot
User-agent: PerplexityBot
User-agent: GoogleOther
User-agent: Googlebot-Image
User-agent: Bingbot
Allow: /images/
Sitemap: https://axion-ia.com/sitemap-images-services.xml
Sitemap: https://axion-ia.com/sitemap-images-villes-t1.xml
```

---

## PHASE 13 — GOOGLE BUSINESS PROFILE (domination locale)

Pour chaque ville Tier 1 (40 villes) :
```
□ Fiche GBP : "Axion-IA — Formation IA & Conseil IA [VILLE]"
□ Upload bannière ville 1920×1080 (avec géotag GPS EXIF)
□ Upload carré ville 1200×1200
□ Upload 3 images services génériques (Audit, Formation, Automatisation)
□ Upload photo équipe 12 personnes
□ Zone de service : [ville] + rayon 50km
□ Catégorie : "Consultants en gestion des affaires" + "École de formation"
```

**Géotagging EXIF obligatoire pour GBP :**
```typescript
await sharp(imageBuffer)
  .withMetadata({ exif: { IFD0: {
    GPSLatitude: ville.geo.lat.toString(),
    GPSLongitude: ville.geo.lon.toString(),
  }}})
  .webp().toFile(outputPath)
```

---

## LIVRABLES ATTENDUS

```
_AUDIT/image-bank-complet-2026/
├── 00-rename-manifest.json              (73 slugs confirmés)
├── 01-misclassifications.json           (2 corrections)
├── 02-embedded-text-captions.json       (73 × OCR text)
├── 03-jsonld-all-images.json            (73 × ImageObject)
├── 04-alt-text-all.json                 (73 × alt FR + EN)
├── 05-speakable-captions.json           (73 × caption speakable)
├── 06-sitemap-images-services.xml       (73 images × pages)
├── 07-tier1-dall-e-prompts.json         (38 prompts villes T1)
├── 08-sitemap-images-villes-t1.xml      (40 villes)
├── 09-sitemap-images-villes-t2.xml      (83 villes)
├── 10-sitemap-images-villes-t3-t4.xml   (2034 villes)
├── 11-db-seed-entries.ts                (73 × Prisma create)
├── 12-indexnow-batch.json               (URLs prioritaires)
└── 13-RAPPORT-FINAL.md                  (gates + roadmap)

src/
├── server/queue/workers/image-bank-auto-convert-worker.ts
├── app/api/v1/images/import/route.ts
├── scripts/generate-city-images-tier2.ts
├── scripts/generate-city-image-metadata.ts
├── scripts/generate-sitemap-images-cities.ts
└── components/ui/ImageBankPicture.tsx
```

---

## GATES DE VALIDATION

```
□ 73/73 slugs sans accent, sans espace, sans timestamp
□ 2 misclassifications corrigées
□ 73/73 embeddedTextCaption (texte OCR transcrit fidèlement)
□ 73/73 alt text < 125 chars
□ 73/73 aiGenerated:true (AI Act compliance)
□ 73/73 licence CC BY 4.0
□ Logos → WebP lossless uniquement
□ Crop OG format-aware (carré → contain blanc, bannière → cover center)
□ max-image-preview:large sur toutes les pages hôtes
□ llms.txt + robots.txt mis à jour
□ Sitemaps valides XML (4 fichiers)
□ Pipeline auto-WebP opérationnel (tester : 1 PNG → 8 variants)
□ IndexNow batch prêt (STOP & ASK Will avant envoi)
```

---

## ORDRE D'EXÉCUTION AUTOPILOTE

```
Étape 1  → Corriger les 2 misclassifications (déplacer 16_54_06.png)
Étape 2  → Pipeline auto-WebP : coder worker + API import
Étape 3  → Générer rename-manifest.json (73 slugs)
Étape 4  → Extraire embedded-text-captions.json
Étape 5  → Générer jsonld-all-images.json
Étape 6  → Générer alt-text-all.json + speakable-captions.json
Étape 7  → Générer sitemap-images-services.xml
Étape 8  → Générer tier1-dall-e-prompts.json (38 villes)
Étape 9  → Générer scripts villes T2/T3/T4 (metadata auto)
Étape 10 → Générer sitemaps villes (3 fichiers XML)
Étape 11 → Générer db-seed-entries.ts
Étape 12 → Générer llms.txt + robots.txt sections
Étape 13 → Rapport final + gates check
STOP & ASK Will → valider avant exécution scripts réels + envoi IndexNow
```

---

*Prompt unique v3.0 — 2026-05-19*  
*Fusion des deux prompts précédents en un seul fichier complet*  
*Basé sur : analyse visuelle réelle 73/73 images + 2 157 communes DB confirmées*
