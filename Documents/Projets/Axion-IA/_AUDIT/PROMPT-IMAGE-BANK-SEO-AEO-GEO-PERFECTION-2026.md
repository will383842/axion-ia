# PROMPT AUTOPILOTE — IMAGE BANK SEO/AEO/GEO PERFECTION 2026
## Axion-IA — 73 images → Domination Google Images + Bing + IA Génératives
### Version 2.0 — Post-analyse visuelle complète de toutes les images

> **DATE** : 2026-05-19  
> **AUTEUR PROMPT** : Analyse visuelle réelle de chacune des 73 images réalisée avant rédaction  
> **MODE** : AUTOPILOTE — exécute toutes les phases, STOP & ASK uniquement si bloquant P0  
> **OBJECTIF** : Chaque image apparaît dans Google Images, Bing Visual Search, Google Discover, Google Lens, AI Overviews, ChatGPT, Perplexity — et surpasse tous les concurrents

---

## 0. CONTEXTE & INVENTAIRE RÉEL

### Entité
- **Société** : Axion-IA OÜ — cabinet conseil IA B2B premium
- **Site** : https://axion-ia.com — Next.js 16 App Router, bilingue FR canonique / EN miroir
- **Stack** : Sharp (WebP+AVIF+LQIP), BullMQ workers, Prisma 5.22, Postgres
- **Licence** : CC BY 4.0 — `© 2026 Axion-IA OÜ`
- **Palette** : Terracotta/orange `#C0440A`, crème `#FAF7F2`, blanc, noir `#1A1A1A`

### Nature réelle des images (découverte par analyse visuelle)
Ces images NE SONT PAS des photos de consultants. Ce sont :
- **Visuels marketing typés** avec texte en français visible (Google OCR les lira)
- **Formats variés** : banderoles 16:9, carrés 1:1 sociaux, billboards outdoor, infographies, citations éditoriales, photos composites avec overlay Axion-IA
- **Contenu riche** : titres accrocheurs, bullets points, statistiques, CTAs, icônes

### Inventaire complet vérifié (73 images, pas 72)
```
Images Axion-IA/
├── Audit/                              16 images (dont 1 MAL CLASSIFIÉE)
├── Formations & Interventions/         15 images (dont 3 déjà nommées)
├── Automatisations et implémentations/  4 images
├── 1 TO 1/
│   ├── Dirigeant 1 TO 1/               7 images (dont 1 MAL CLASSIFIÉE → Audit)
│   └── Membre d'équipe 1 TO 1/         2 images
├── Graphiques et courbes/               5 images
├── Logos/                               7 images
├── Tous types de propositions/         11 images
├── Expression/                          0 image (vide)
└── Villes/
    ├── Paris/                           4 images
    └── Lyon/                            1 image
```

---

## PHASE 0 — PIPELINE AUTO-WEBP À L'IMPORT (NOUVEAU — CRITIQUE)

### 0.1 Problème actuel
Les images source sont des PNG lourds (1-2.5 MB chacun). Tout import futur doit être **automatiquement converti** sans intervention manuelle.

### 0.2 Worker BullMQ : `image-bank-auto-convert-worker.ts`

Créer dans `src/server/queue/workers/image-bank-auto-convert-worker.ts` :

```typescript
import sharp from 'sharp'
import path from 'path'
import fs from 'fs/promises'
import { Worker, Job } from 'bullmq'
import { prisma } from '@/server/db'

// Formats acceptés à l'import
const ACCEPTED_FORMATS = ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.heic', '.tiff', '.bmp', '.gif']

interface AutoConvertJob {
  sourcePath: string        // chemin absolu du fichier source
  targetSlugFr: string      // slug FR fourni manuellement ou auto-généré
  category: string
  overwrite?: boolean
}

// Variants à générer pour chaque image importée
const VARIANTS = [
  { suffix: '',         format: 'webp' as const, quality: 85, width: null,   height: null  },
  { suffix: '',         format: 'avif' as const, quality: 70, width: null,   height: null  },
  { suffix: '-og',      format: 'webp' as const, quality: 90, width: 1200,   height: 630   },
  { suffix: '-square',  format: 'webp' as const, quality: 90, width: 1080,   height: 1080  },
  { suffix: '-thumb',   format: 'webp' as const, quality: 80, width: 400,    height: 300   },
  { suffix: '-md',      format: 'webp' as const, quality: 85, width: 768,    height: null  },
  { suffix: '-sm',      format: 'webp' as const, quality: 80, width: 384,    height: null  },
]

async function processImage(job: Job<AutoConvertJob>) {
  const { sourcePath, targetSlugFr, overwrite = false } = job.data
  const ext = path.extname(sourcePath).toLowerCase()
  
  if (!ACCEPTED_FORMATS.includes(ext)) {
    throw new Error(`Format non supporté: ${ext}. Acceptés: ${ACCEPTED_FORMATS.join(', ')}`)
  }
  
  const sourceBuffer = await fs.readFile(sourcePath)
  const metadata = await sharp(sourceBuffer).metadata()
  
  // Garantie Google Discover : largeur ≥ 1200px
  let inputBuffer = sourceBuffer
  if (metadata.width && metadata.width < 1200) {
    inputBuffer = await sharp(sourceBuffer)
      .resize(1200, null, { kernel: 'lanczos3', withoutEnlargement: false })
      .toBuffer()
  }
  
  const outputDir = path.join(process.cwd(), 'public', 'images')
  await fs.mkdir(outputDir, { recursive: true })
  
  const results: Record<string, string> = {}
  
  for (const variant of VARIANTS) {
    const filename = `${targetSlugFr}${variant.suffix}.${variant.format}`
    const outputPath = path.join(outputDir, filename)
    
    if (!overwrite && await fs.access(outputPath).then(() => true).catch(() => false)) continue
    
    let pipeline = sharp(inputBuffer)
    
    if (variant.width && variant.height) {
      // OG et Square : smart crop via attention
      pipeline = pipeline.resize(variant.width, variant.height, {
        fit: 'cover',
        position: 'attention',
      })
    } else if (variant.width) {
      pipeline = pipeline.resize(variant.width, null, { withoutEnlargement: false })
    }
    
    if (variant.format === 'webp') {
      pipeline = pipeline.webp({ quality: variant.quality })
    } else if (variant.format === 'avif') {
      pipeline = pipeline.avif({ quality: variant.quality })
    }
    
    await pipeline.toFile(outputPath)
    results[variant.suffix || 'main_' + variant.format] = `/images/${filename}`
  }
  
  // LQIP (16px blur pour placeholder CLS)
  const lqipBuffer = await sharp(inputBuffer)
    .resize(16, null)
    .webp({ quality: 20 })
    .blur(8)
    .toBuffer()
  const lqipBase64 = `data:image/webp;base64,${lqipBuffer.toString('base64')}`
  
  // Récupérer dimensions finales
  const finalMeta = await sharp(inputBuffer).metadata()
  
  return {
    slug: targetSlugFr,
    urls: results,
    lqipBase64,
    width: finalMeta.width,
    height: finalMeta.height,
  }
}
```

### 0.3 API Route d'import : `POST /api/v1/images/import`

```typescript
// src/app/api/v1/images/import/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'
import { imageConvertQueue } from '@/server/queue/queues'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File
  const category = formData.get('category') as string
  const slugFr = formData.get('slug_fr') as string | null
  
  if (!file) return NextResponse.json({ error: 'Fichier requis' }, { status: 400 })
  
  // Vérification format
  const allowedTypes = ['image/png','image/jpeg','image/webp','image/avif','image/heic','image/tiff']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: `Format ${file.type} non accepté` }, { status: 415 })
  }
  
  // Sauvegarde temporaire
  const buffer = Buffer.from(await file.arrayBuffer())
  const tmpPath = path.join('/tmp', `axion-ia-import-${Date.now()}${path.extname(file.name)}`)
  await writeFile(tmpPath, buffer)
  
  // Auto-génération slug si non fourni
  const autoSlug = slugFr ?? `axion-ia-${category}-${Date.now()}`
  
  // Ajout queue BullMQ
  const job = await imageConvertQueue.add('auto-convert', {
    sourcePath: tmpPath,
    targetSlugFr: autoSlug,
    category,
  })
  
  return NextResponse.json({ jobId: job.id, slug: autoSlug, status: 'queued' })
}
```

### 0.4 Règles conversion automatique

```
✅ Tout format entrant (PNG, JPG, JPEG, HEIC, TIFF, BMP, GIF) → WebP + AVIF automatique
✅ Largeur < 1200px → upscale lanczos3 jusqu'à 1200px (Google Discover gate)
✅ Smart crop "attention" pour OG 1200×630 et Square 1080×1080
✅ LQIP généré automatiquement (inline base64 pour placeholder)
✅ Original PNG conservé dans /public/images/originals/ (non servi)
❌ Jamais servir le PNG original en production
❌ Jamais compresser les logos en lossy (logos → PNG transparent conservé + WebP sans perte)
```

### 0.5 Cas spécial Logos

```typescript
// Pour les logos uniquement : WebP lossless
sharp(logoBuffer)
  .webp({ lossless: true })        // Pas de dégradation sur les bords du logo
  .toFile('axion-ia-logo-xxx.webp')

// Également exporter SVG si possible (pour logos vectoriels)
// Note : si les logos PNG sont issus d'un SVG source → récupérer le SVG et le servir directement
```

---

## PHASE 1 — CATALOGUE VISUEL VÉRIFIÉ + MANIFEST DE RENOMMAGE COMPLET

> ⚠️ Ce catalogue est basé sur une **analyse visuelle réelle** de chacune des 73 images.  
> Chaque slug intègre le texte accrocheur visible dans l'image pour maximiser la cohérence Google OCR.

### 1.1 Taxonomie des formats (nouvelle)

| Code format | Description | Ratio | Crop OG |
|---|---|---|---|
| `banniere` | Bandeau horizontal 16:9 ou plus large | 16:9 à 3:1 | center |
| `carre` | Carré social media 1:1 | 1:1 | smart crop attention |
| `affiche` | Billboard outdoor / métro | variable | center focus |
| `infographie` | Schéma avec données et processus | variable | top-center |
| `editorial` | Citation typographique fond uni | 4:3 ou 1:1 | center |
| `photo` | Composite avec photo réaliste overlay | variable | attention |
| `dataviz` | Graphique/courbe de données | 16:9 | center |
| `logo` | Identité visuelle pure | variable | center exact |

### 1.2 Manifest complet — AUDIT (16 images)

> ⚠️ CORRECTION : 16 images dans ce dossier (pas 15 comme annoncé initialement)  
> ⚠️ MISCLASSIFICATION : `16_54_06.png` est dans "Dirigeant 1 TO 1" mais est une image AUDIT

| Source (timestamp) | Contenu réel visible | Slug cible FR | Type | Keywords spécifiques |
|---|---|---|---|---|
| `15_06_17` | "Votre entreprise est-elle prête pour l'IA ?" + badge AUDIT IA + Analyse processus / Identification opportunités / Feuille de route / Estimation ROI | `axion-ia-audit-ia-entreprise-prete-intelligence-artificielle-banniere` | banniere | entreprise prête IA, diagnostic IA, maturité intelligence artificielle |
| `15_07_00` | 3 versions d'accroches audit empilées : "L'IA peut transformer" / "avantage compétitif ?" / "décisions éclairées résultats concrets" | `axion-ia-audit-ia-avantage-competitif-decisions-resultats-banniere` | banniere | audit IA avantage compétitif, transformation IA décisions, stratégie IA entreprise |
| `15_08_01` | "L'IA peut transformer vos défis en opportunités." + badge AUDIT IA + Évaluation cas d'usage / Leviers de valeur / Feuille route / Impacts concrets | `axion-ia-audit-ia-transformer-defis-opportunites-leviers-valeur-banniere` | banniere | transformer défis IA, opportunités intelligence artificielle, leviers valeur IA |
| `15_09_45` | Billboard outdoor : "L'IA QUI RAPPORTE CONCRÈTEMENT." + icônes productivité/profits/charges/résultats + Axion-IA.com + FORMATIONS AUDIT IMPLÉMENTATIONS | `axion-ia-publicite-outdoor-ia-rapporte-concretement-productivite-profits-affiche` | affiche | IA rapporte concrètement, publicité IA entreprise, campagne IA rentabilité |
| `15_14_28` | Fond bleu gradient : "Faites de l'IA un levier de croissance mesurable." + Cartographie processus / Identification opportunités / Feuille route / Estimation gains ROI | `axion-ia-audit-ia-levier-croissance-mesurable-cartographie-processus-roi-banniere` | banniere | levier croissance IA, ROI intelligence artificielle, cartographie processus IA |
| `15_20_33` | "Des solutions IA adaptées à votre réalité." + 5 secteurs photos : Artisans / Commerçants / TPE / PME / ETI | `axion-ia-audit-ia-solutions-artisans-commercants-tpe-pme-eti-tous-secteurs-banniere` | banniere | IA artisans, IA commerçants, IA TPE PME ETI, solutions IA secteurs |
| `15_25_19` | Carré : "Audit en entreprise" + loupe processus à automatiser + laptop gains (temps/coûts/productivité/charges) + Axion-IA.com | `axion-ia-audit-processus-automatiser-temps-couts-productivite-charges-infographie` | infographie | processus à automatiser IA, audit gains temps coûts, automatisation entreprise |
| `15_26_25` | Billboard métro : "Audit en entreprise" + loupe puzzle + GAGNER DU TEMPS / RÉDUIRE LES COÛTS / AUTOMATISER / AUGMENTER PRODUCTIVITÉ | `axion-ia-audit-entreprise-metro-gagner-temps-reduire-couts-augmenter-productivite-affiche` | affiche | gagner temps IA entreprise, réduire coûts IA, productivité intelligence artificielle |
| `15_39_30` | "Notre méthode d'audit IA en 5 étapes clés" : Analyse → Identification → Feuille de route → Estimation ROI → Recommandations | `axion-ia-audit-ia-methode-5-etapes-analyse-identification-roi-recommandations-infographie` | infographie | méthode audit IA, 5 étapes audit intelligence artificielle, processus audit IA |
| `16_34_20` | Citation éditoriale cream : "L'avenir ne se prévoit pas, il se prépare aujourd'hui." + COMPRENDRE AUJOURD'HUI. AGIR DEMAIN. | `axion-ia-citation-avenir-prepare-aujourd-hui-comprendre-agir-editorial` | editorial | citation IA avenir, préparer transformation IA, comprendre agir intelligence artificielle |
| `16_41_54` | Citation + photo pierres zen : "La clarté aujourd'hui, la sérénité demain, les résultats toujours." + COMPRENDRE. FORMER. TRANSFORMER. | `axion-ia-citation-clarte-serenite-resultats-toujours-comprendre-former-transformer-editorial` | editorial | citation clarté IA, sérénité résultats IA, valeurs Axion-IA |
| `16_49_52` | "AUDIT IA : UN CHOIX RENTABLE, DES BÉNÉFICES IMMÉDIATS." + 5 KPIs : Gain temps / Réduction coûts / Performance / Décisions / ROI garanti | `axion-ia-audit-ia-choix-rentable-benefices-immediats-roi-garanti-5-kpi-carre` | carre | audit IA rentable, bénéfices immédiats IA, ROI garanti intelligence artificielle |
| `16_52_14` | "AUDIT IA. VOUS GAGNEZ. DU TEMPS. DE L'ARGENT." + ZÉRO PERTE 100% GAIN + profits marge décisions | `axion-ia-audit-ia-vous-gagnez-temps-argent-zero-perte-100-gain-carre` | carre | audit IA gagner temps argent, zéro perte IA, bénéfices audit intelligence artificielle |
| `16_56_47` | "AUDIT IA. PLUS DE VALEUR, MOINS DE PERTE." + Temps gagné / Performances décuplées / Décisions optimisées / Rentabilité assurée | `axion-ia-audit-ia-plus-valeur-moins-perte-performances-decuplees-rentabilite-carre` | carre | plus valeur moins perte IA, performances décuplées audit, rentabilité IA assurée |
| `17_04_41` | Carré artistique : loupe puce IA au centre, chaos → ordre → Performance / Gain de temps / Réduction coûts / Décisions éclairées | `axion-ia-audit-ia-chaos-ordre-performance-gain-temps-reduction-couts-decisions-carre` | carre | audit IA chaos vers ordre, performance décisions IA, transformation intelligent |
| `17_12_03` | "1 JOURNÉE DES MOIS GAGNÉS" + switch OFF→ON IA + courbe perf + RAPIDE/CONCRET/EFFICACE/AUTONOME + "UNE JOURNÉE POUR CHANGER VOTRE QUOTIDIEN." | `axion-ia-audit-ia-une-journee-mois-gagnes-switch-rapide-concret-efficace-carre` | carre | audit IA une journée, mois gagnés IA, rapide concret efficace autonome |
| ⚠️ `MISCLASSIFIÉ` → `Dirigeant 1 TO 1/16_54_06.png` | "AUDIT IA. VOTRE AVANCE, PAS CELLE DE VOS CONCURRENTS." + Gain temps / Performance maximisée / Décisions plus justes / Plus de valeur | `axion-ia-audit-ia-votre-avance-concurrents-benchmark-performance-carre` | carre | audit IA avance concurrents, benchmark intelligence artificielle, surpasser concurrents IA |

### 1.3 Manifest complet — FORMATIONS & INTERVENTIONS (15 images)

| Source | Contenu réel visible | Slug cible FR | Type | Keywords spécifiques |
|---|---|---|---|---|
| `14_58_25` | "Formation 1 jour." fond orange + SUR MESURE OU GÉNÉRIQUE + 1j intensif / Équipe opérationnelle / Résultats concrets + "Réservez votre session" | `axion-ia-formation-ia-1-jour-sur-mesure-generique-reserver-session-carre` | carre | formation IA 1 jour, formation sur mesure IA, réserver formation intelligence artificielle |
| `15_36_17` | "Interventions rapides, résultats concrets pour votre entreprise." fond orange + timer + "L'IA au service de vos résultats." | `axion-ia-intervention-ia-rapide-resultats-concrets-entreprise-carre` | carre | intervention IA rapide, résultats concrets IA, intervention intelligence artificielle entreprise |
| `15_40_21` | Bandeau : "Formation IA — Comprendre, créer, transformer." + carnet "L'INTELLIGENCE HUMAINE AUGMENTÉE PAR L'IA" + APPRENDRE/EXPÉRIMENTER/INNOVER + "REJOIGNEZ AXION-IA" | `axion-ia-formation-ia-comprendre-creer-transformer-intelligence-humaine-augmentee-banniere` | banniere | formation IA comprendre créer transformer, intelligence humaine augmentée, rejoindre Axion-IA |
| `15_52_33` | Photo : "Interventions rapides, résultats concrets." + carte France avec pins + duo consultant/client avec bagages + Ciblé/Réactivité/Impact | `axion-ia-intervention-ia-france-toutes-regions-consultant-client-photo-banniere` | photo | intervention IA France, consultant IA déplacement, formation IA toutes régions |
| `16_31_00` | Photo : "Acculturation IA en entreprise — Par où commencer TPE PME ETI en 2026 ?" + présentatrice écran + équipe réunion | `axion-ia-formation-acculturation-ia-entreprise-tpe-pme-eti-2026-comment-commencer-photo-banniere` | photo | acculturation IA entreprise, formation IA PME 2026, par où commencer IA |
| `16_32_32` | Citation cream : "L'intelligence artificielle n'a de valeur que par l'impact qu'elle crée." | `axion-ia-citation-intelligence-artificielle-valeur-impact-cree-editorial` | editorial | citation intelligence artificielle valeur, impact IA, valeur IA entreprise |
| `16_36_59` | Citation cream : "L'IA ne remplace pas l'humain. Elle révèle son potentiel." + COMPRENDRE. FORMER. TRANSFORMER. | `axion-ia-citation-ia-ne-remplace-pas-humain-revele-potentiel-former-editorial` | editorial | IA ne remplace pas humain, potentiel humain IA, former transformer IA |
| `16_39_44` | Bannière : "VOUS GAGNEZ. CONCRÈTEMENT." + 5 bénéfices : Gagnez temps / Meilleures décisions / Dépassez concurrents / Développez compétences / Boostez performance | `axion-ia-formation-ia-vous-gagnez-concretement-5-benefices-depasser-concurrents-banniere` | banniere | gagner concrètement formation IA, dépasser concurrents IA, compétences performance IA |
| `16_43_37` | Citation : "INVESTIR EN CONNAISSANCE AUJOURD'HUI, C'EST RÉCOLTER LA LIBERTÉ DEMAIN." + COMPRENDRE. FORMER. TRANSFORMER. | `axion-ia-citation-investir-connaissance-recolter-liberte-demain-formation-editorial` | editorial | investir connaissance IA, liberté par la formation IA, ROI formation intelligence artificielle |
| `17_06_59` | Carré photo : "Formation Axion-IA — BÉNÉFICES CONCRETS DÈS LE PREMIER JOUR" + formateur flip chart + 5 bénéfices (temps/clarté/productivité/coûts/résultats) | `axion-ia-formation-ia-benefices-concrets-premier-jour-formateur-photo-carre` | photo | formation IA bénéfices premier jour, formateur IA, résultats concrets formation intelligence artificielle |
| `17_09_51` | Carré photo avant/après : "AVANT / 1 JOUR DE FORMATION / APRÈS" désordre → clarté + "UNE JOURNÉE. DES RÉSULTATS CONCRETS." | `axion-ia-formation-ia-avant-apres-une-journee-resultats-concrets-photo-carre` | photo | avant après formation IA, une journée formation IA, transformation formation intelligence artificielle |
| `17_24_57` | Photo : "MOINS DE STRESS. PLUS DE CLARTÉ." + pierres zen (Temps/Charge mentale/Tâches inutiles/Stress) + "1 JOURNÉE POUR CHANGER VOTRE QUOTIDIEN." | `axion-ia-formation-ia-moins-stress-plus-clarte-une-journee-changer-quotidien-photo-banniere` | photo | moins stress IA, plus clarté formation IA, changer quotidien intelligence artificielle |
| `Formations_ia_entreprises.png` | "Formez votre équipe à l'IA. Maintenant." + +40% productivité / 2j délai moyen / 100% sur mesure + axion-ia.com | `axion-ia-formation-equipe-ia-40-pourcent-productivite-2-jours-100-mesure-carre` | carre | former équipe IA maintenant, +40% productivité IA, formation sur mesure équipe |
| `Formation_un_jour_ia_entreprises.png` | "Formation 1 jour." fond orange sombre + Sur mesure OU Générique + 1 jour pour progresser concrètement | `axion-ia-formation-1-jour-progresser-sur-mesure-ou-generique-carre` | carre | formation IA 1 jour progresser, formation générique IA, formation sur mesure 1 journée |
| `Intervention_un_jour_ia_entreprises.png` | "Formation 1 jour." fond orange clair + Sur mesure / Générique + Réserver votre session CTA | `axion-ia-formation-ia-1-jour-reserver-session-sur-mesure-generique-carre` | carre | réserver formation IA, session formation 1 jour, formation IA entreprise sur mesure |

### 1.4 Manifest complet — AUTOMATISATIONS & IMPLÉMENTATIONS (4 images)

| Source | Contenu réel visible | Slug cible FR | Type | Keywords spécifiques |
|---|---|---|---|---|
| `16_37_54` | "Des bénéfices concrets, mesurables, durables." + Gain temps / Meilleure décision / Innovation / Performance durable + COMPRENDRE. FORMER. TRANSFORMER. | `axion-ia-automatisation-ia-benefices-concrets-mesurables-durables-innovation-banniere` | banniere | bénéfices automatisation IA, mesurable durable IA, innovation IA entreprise |
| `17_00_31` | Avant/après : chaos papiers → tableau de bord (+45%, +32%, 98%) + MOINS DE COMPLEXITÉ PLUS DE CLARTÉ RÉSULTATS + Axion-IA.com | `axion-ia-automatisation-ia-avant-apres-tableau-bord-45-pourcent-98-pourcent-photo-carre` | photo | automatisation IA avant après, tableau de bord IA résultats, +45% performance automatisation |
| `17_01_46` | "Performance +86%" + chaos → ordre + Gain de temps / Réduction coûts / Valeur maximisée + Axion-IA.com | `axion-ia-automatisation-ia-performance-86-pourcent-gain-temps-reduction-couts-carre` | carre | performance IA +86%, automatisation gain temps réduction coûts, valeur maximisée IA |
| `17_03_26` | Triangle 3D : Gagnez du temps / Réduisez vos coûts / Maximisez vos résultats + "100% GAGNANT. MOINS DE COMPLEXITÉ, PLUS DE PERFORMANCE." | `axion-ia-automatisation-ia-triangle-temps-couts-resultats-100-gagnant-complexite-carre` | carre | triangle IA temps coûts résultats, 100% gagnant IA, moins complexité plus performance |

### 1.5 Manifest complet — 1 TO 1 DIRIGEANT (6 images — après correction misclassification)

> ⚠️ `16_54_06.png` déplacé vers Audit (voir section 1.2)

| Source | Contenu réel visible | Slug cible FR | Type | Keywords spécifiques |
|---|---|---|---|---|
| `17_16_16` | "OUVREZ CE QUI RALENTIT VOTRE ENTREPRISE." + zipper → tableau de bord : +12h/sem, 87% tâches auto, erreurs -92% | `axion-ia-dirigeant-1to1-ouvrir-ce-qui-ralentit-entreprise-12h-semaine-photo-banniere` | photo | ouvrir ce qui ralentit entreprise IA, +12h semaine libérées, 87% tâches automatisées dirigeant |
| `17_21_00` | "UNE JOURNÉE. POUR REPRENDRE LE CONTRÔLE." + VOUS + AXION-IA = temps/clarté/résultats + avant (submergé) / après (serein) | `axion-ia-dirigeant-1to1-une-journee-reprendre-controle-temps-clarte-resultats-photo-banniere` | photo | reprendre contrôle IA dirigeant, une journée clarté résultats, avant après dirigeant IA |
| `17_23_26` | "DIRIGEANT, VOTRE TEMPS EST VOTRE PLUS GRAND ATOUT." + sablier logo Axion-IA + "UNE JOURNÉE ENSEMBLE POUR LE LIBÉRER." | `axion-ia-dirigeant-1to1-temps-plus-grand-atout-liberer-journee-sablier-photo-banniere` | photo | temps atout dirigeant IA, libérer temps dirigeant, journée coaching IA CEO |
| `17_26_25` | "MOINS DE STRESS. PLUS DE CLARTÉ." + pierres zen (Urgent partout/Décisions constantes/Tâches inutiles/Stress) + CLARTÉ. SIMPLICITÉ. PERFORMANCE. | `axion-ia-dirigeant-1to1-moins-stress-clarte-simplicite-performance-pierres-photo-banniere` | photo | moins stress dirigeant IA, clarté simplicité performance CEO, coaching IA anti-stress |
| `17_29_29` | Fond sombre : "MOINS SUBIR, + PILOTER." + laptop+carnet orange + TEMPS MAÎTRISÉ/PROCESS/PRIORITÉS/CROISSANCE + "1 DIRIGEANT. 1 JOURNÉE. UN IMPACT DURABLE." | `axion-ia-dirigeant-1to1-moins-subir-plus-piloter-process-croissance-impact-durable-photo-banniere` | photo | piloter plutôt que subir IA, process clairs dirigeant IA, impact durable coaching IA |
| `17_36_51` | Infographie longue : "1 TO 1. 1 PERSONNE. 1 JOURNÉE." + expert Axion-IA + stats : +15h/sem libérées, +35% efficacité, -20% coûts, +25% productivité + CTA réserver | `axion-ia-dirigeant-1to1-une-personne-une-journee-15h-liberees-35-efficacite-25-productivite-infographie` | infographie | 1 to 1 dirigeant IA, +15h libérées semaine, +35% efficacité coaching IA dirigeant |

### 1.6 Manifest complet — 1 TO 1 MEMBRE D'ÉQUIPE (2 images)

| Source | Contenu réel visible | Slug cible FR | Type | Keywords spécifiques |
|---|---|---|---|---|
| `17_33_10` | "1 TO 1. POUR VOUS. POUR GAGNER DU TEMPS." + 6 profils : Secrétaire/Manager/RH/Directeur/Marketing/Ops + "1 DIRIGEANT. 1 JOURNÉE. DES HEURES GAGNÉES CHAQUE SEMAINE." | `axion-ia-equipe-1to1-tous-profils-metiers-manager-rh-marketing-ops-gagner-temps-photo-banniere` | photo | 1 to 1 équipe IA, coaching IA manager RH marketing, heures gagnées chaque semaine IA |
| `17_38_50` | "1 TO 1. UNE PERSONNE. POUR VOUS FAIRE GRANDIR." + Écoute/Expertise/Progrès + COMPÉTENCE/OBJECTIFS/PERFORMANCE/POTENTIEL | `axion-ia-equipe-1to1-une-personne-grandir-competence-objectifs-performance-potentiel-photo-carre` | photo | coaching individuel IA équipe, développer compétences IA, potentiel collaborateur IA |

### 1.7 Manifest complet — GRAPHIQUES & DATAVIZ (5 images)

| Source | Contenu réel visible | Slug cible FR | Type | Keywords spécifiques |
|---|---|---|---|---|
| `15_40_47` | Processus 5 étapes timeline : loupe→cible→carte→courbe→checklist + 5 icônes bénéfices en bas | `axion-ia-graphique-processus-5-etapes-timeline-audit-ia-infographie` | infographie | processus IA 5 étapes, timeline audit IA, étapes transformation intelligence artificielle |
| `15_44_05` | Barres croissantes : "L'IA au service de la performance" + 6 KPI (+20% Temps → +60% Innovation) | `axion-ia-graphique-performance-ia-entreprise-kpi-20-60-pourcent-temps-productivite-dataviz` | dataviz | graphique performance IA entreprise, KPI intelligence artificielle, +20% à +60% IA |
| `15_50_10` | Courbe adoption : "L'IA dans les entreprises — adoption en forte accélération" 2017→2025 (20%→72%) + projection 80% 2026 source McKinsey/Salesforce | `axion-ia-graphique-adoption-ia-entreprises-72-pourcent-2024-courbe-mckinsey-dataviz` | dataviz | adoption IA entreprises 72%, courbe adoption IA 2024, statistiques IA McKinsey |
| `15_54_27` | "L'IA n'est plus une option. C'est un impératif de performance." + même courbe + fossé se creuse + multi-indicateurs ROI | `axion-ia-graphique-ia-imperatif-performance-fosse-concurrentiel-courbe-adoption-dataviz` | dataviz | IA impératif performance, fossé concurrentiel IA, adoption IA urgence |
| `15_58_17` | "L'IA n'est pas le futur. C'est maintenant." + 4 niveaux : Attendre→Explorer→Intégrer→Dominer | `axion-ia-graphique-ia-maintenant-attendre-explorer-integrer-dominer-avantage-competitif-infographie` | infographie | IA c'est maintenant, explorer intégrer dominer IA, avantage compétitif intelligence artificielle |

### 1.8 Manifest complet — LOGOS (7 images)

| Source | Contenu réel visible | Slug cible FR | Type | Notes |
|---|---|---|---|---|
| `logo plat.png` | Logo horizontal Axion-IA, fond blanc, bordure pill orange, texte noir+orange | `axion-ia-logo-horizontal-fond-blanc-bordure-orange` | logo | Variante principale horizontale |
| `logo plat sans fond nulle part.png` | Logo horizontal Axion-IA, fond transparent (PNG) | `axion-ia-logo-horizontal-transparent` | logo | Pour fonds colorés |
| `logo blanc fond blanc et sans fond extérieur.png` | Logo horizontal fond blanc, sans fond extérieur (bordure pill visible) | `axion-ia-logo-horizontal-fond-blanc-sans-fond-exterieur` | logo | Usage blanc sur blanc |
| `logo blanc fond blanc et sans fond extérieur 500 pixels.png.png` | Même logo, version 500px | `axion-ia-logo-horizontal-fond-blanc-500px` | logo | Taille réduite usage web |
| `logo sans fond extérieur icone.png` | Icône carrée arrondie "Axion-IA .com" fond crème, type app icon | `axion-ia-icone-app-fond-creme-arrondie` | logo | App icon / favicon usage |
| `logo sans fond extérieur icone 500 pixels.png.png` | Même icône, version 500px | `axion-ia-icone-app-fond-creme-500px` | logo | Taille réduite |
| `logo sans fond nulle part.png` | Icône carrée arrondie fond transparent (checker) | `axion-ia-icone-app-fond-transparent` | logo | Usage tous fonds |

### 1.9 Manifest complet — TOUS TYPES DE PROPOSITIONS (11 images)

| Source | Contenu réel visible | Slug cible FR | Type | Keywords spécifiques |
|---|---|---|---|---|
| `15_14_04` | Billboard outdoor photo : Axion-IA.com + FORMATIONS AUDIT IA IMPLÉMENTATIONS RÉSULTATS + duo homme/femme réfléchi + carte monde | `axion-ia-proposition-outdoor-formations-audit-implementations-resultats-duo-affiche` | affiche | proposition IA complète, formations audit implémentations IA, cabinet conseil IA |
| `15_16_13` | Showroom mur intérieur : Axion-IA.com + mêmes 4 services + carte monde | `axion-ia-proposition-showroom-mur-formations-audit-implementations-ia-photo` | photo | showroom IA, mur Axion-IA services, cabinet IA présentation |
| `15_19_06` | Bannière : "L'IA n'est pas réservée aux grandes entreprises. Elle est faite pour vous." + 5 secteurs photos | `axion-ia-proposition-ia-pour-tous-pas-reservee-grandes-entreprises-artisans-tpe-banniere` | banniere | IA pas réservée grandes entreprises, IA pour artisans commerçants TPE, IA accessible PME |
| `15_22_29` | Carré : globe terrestre dans mains + 4 services entourant (Formations/Audit IA/Implémentations/Résultats) | `axion-ia-proposition-globe-4-services-formations-audit-implementations-resultats-carre` | carre | services IA complets, globe intelligence artificielle, Axion-IA 4 services |
| `15_27_51` | Billboard métro photo : "BOOSTEZ LA PRODUCTIVITÉ DE VOS ÉQUIPES" + fusée + équipe heureuse + "AUTOMATISONS L'INUTILE, LIBÉRONS LE POTENTIEL." | `axion-ia-proposition-booster-productivite-equipes-automatiser-inutile-liberer-potentiel-affiche` | affiche | booster productivité IA équipes, automatiser inutile IA, libérer potentiel équipes |
| `15_29_28` | Bannière large : "Des solutions IA adaptées à chaque réalité d'entreprise." + 5 secteurs avec photos | `axion-ia-proposition-solutions-ia-chaque-realite-5-secteurs-adapte-banniere` | banniere | solutions IA réalité entreprise, IA adaptée secteur, conseil IA personnalisé |
| `15_32_56` | Carré quadrant 4 messages orange/blanc : Temps précieux / Moins tâches répétitives / Processus intelligents / Réduire coûts | `axion-ia-proposition-temps-precieux-taches-repetitives-processus-intelligents-couts-quadrant-carre` | carre | temps précieux IA, tâches répétitives automatisation, processus intelligents IA |
| `15_37_25` | Carré fond orange : "Moins de tâches. Plus de valeur." + icône cible | `axion-ia-proposition-moins-taches-plus-valeur-ia-objectif-carre` | carre | moins de tâches plus de valeur IA, efficacité IA, objectif entreprise intelligence artificielle |
| `15_48_03` | Bannière photo : femme souriante casque audio + "L'IA qui simplifie vos interventions." | `axion-ia-proposition-ia-simplifie-interventions-femme-sourire-photo-banniere` | photo | IA simplifie interventions, intelligence artificielle facilitateur, IA au quotidien |
| `16_59_10` | Photo : sablier + chaos → piles pièces + courbe croissance + Axion-IA.com | `axion-ia-proposition-temps-vers-argent-croissance-sablier-pieces-photo-banniere` | photo | temps en argent IA, croissance IA entreprise, transformer temps valeur IA |
| `17_25_36` | Photo groupe : 12 personnes pull terracotta + panneau "Axion-IA — L'intelligence artificielle au service de l'humain." | `axion-ia-equipe-intelligence-artificielle-service-humain-12-personnes-photo-groupe` | photo | équipe Axion-IA, intelligence artificielle service humain, cabinet conseil IA équipe |

### 1.10 Manifest complet — VILLES (5 images)

| Source | Contenu réel visible | Slug cible FR | Type | Géo |
|---|---|---|---|---|
| `Paris/16_08_59` | "Axion-IA PARIS" + consultante café Tour Eiffel + Performance +28% / Satisfaction 4.8/5 / Temps -35% + Ciblé/Rapide/Mesurable/Fiable | `axion-ia-paris-consultante-tour-eiffel-performance-28-pourcent-satisfaction-4-8-photo-banniere` | photo | Paris, 48.8566°N 2.3522°E |
| `Paris/16_18_57` | "PARIS — L'intelligence artificielle au cœur de votre réussite." + vue Sacré-Cœur + duo clients + cas concrets e-commerce/marketing/service/gestion | `axion-ia-paris-intelligence-artificielle-reussite-sacre-coeur-cas-concrets-ecommerce-photo-banniere` | photo | Paris, 48.8566°N 2.3522°E |
| `Paris/16_20_46` | "PARIS" + Tour Eiffel photo + Axion-IA logo + icônes services + carte France localisée | `axion-ia-paris-tour-eiffel-services-ia-carte-france-localisation-photo-carre` | photo | Paris, 48.8566°N 2.3522°E |
| `Paris/16_29_13` | Vue Paris haussmannien + "Se former. Comprendre. Agir avec l'IA." + "Formations & interventions à Paris" | `axion-ia-paris-formation-ia-haussmann-se-former-comprendre-agir-photo-banniere` | photo | Paris, 48.8566°N 2.3522°E |
| `Lyon/17_38_21` | Vue Lyon (Presqu'île + Fourvière + pont) + "Se former. Comprendre. Agir avec l'IA." + "Formations & interventions à Lyon" | `axion-ia-lyon-formation-ia-presquile-fourviere-se-former-comprendre-agir-photo-banniere` | photo | Lyon, 45.7640°N 4.8357°E |

---

## PHASE 2 — CORRECTIONS DE MISCLASSIFICATION

### 2.1 Actions à effectuer

```
ACTION 1 — DÉPLACER :
Source : Images Axion-IA/1 TO 1/Dirigeant 1 TO 1/ChatGPT Image 19 mai 2026, 16_54_06.png
Destination : Images Axion-IA/Audit/
Raison : L'image dit "AUDIT IA. VOTRE AVANCE, PAS CELLE DE VOS CONCURRENTS."
         Elle n'a rien à voir avec le coaching 1-TO-1 dirigeant.
         Slug final : axion-ia-audit-ia-votre-avance-concurrents-benchmark-performance-carre

ACTION 2 — RECLASSER EN DB :
Image : axion-ia-equipe-intelligence-artificielle-service-humain-12-personnes-photo-groupe
Actuellement dans : Tous types de propositions
Ajouter tag : equipe, a-propos
Raison : Photo d'équipe → utile aussi pour page "À propos" / "Qui sommes-nous"
         Ajouter à sitemapPages : ['/fr/a-propos', '/fr/propositions']

ACTION 3 — NOTER :
Images 14_58_25 (Formation 1 jour carré) et Intervention_un_jour_ia_entreprises.png
sont quasi-identiques (même layout, légèrement différentes).
Nommer différemment pour éviter duplicate content signal.
```

---

## PHASE 3 — OCR TEXT → embeddedTextCaption (NOUVEAU — CRITIQUE)

Google Vision API lit le texte visible dans les images. Ce texte DOIT être dans les métadonnées JSON-LD sous `embeddedTextCaption`. C'est un signal de cohérence majeur entre l'image et sa page hôte.

### 3.1 Règle

Pour chaque image contenant du texte (pratiquement toutes sauf logos) :

```json
{
  "@type": "ImageObject",
  "embeddedTextCaption": "TEXTE EXACT VISIBLE DANS L'IMAGE, transcrit fidèlement. Titre principal. Sous-titres. Bullets points. CTAs. Statistiques.",
  "description": "Description narrative différente — ce que l'image montre et son contexte métier Axion-IA."
}
```

### 3.2 Exemples `embeddedTextCaption` par image

**`axion-ia-audit-ia-choix-rentable-benefices-immediats-roi-garanti-5-kpi-carre`** :
```
"AUDIT IA : UN CHOIX RENTABLE, DES BÉNÉFICES IMMÉDIATS. Moins de perte. Plus d'efficacité. Plus de croissance. Vous gagnez sur tous les plans. Gain de temps immédiat. Réduction des coûts immédiate. Performance boostée. Décisions plus justes. Retour sur investissement garanti. Un audit IA, c'est l'assurance de gagner du temps, de l'argent et d'avoir un avantage concurrentiel. Vous ne pouvez que gagner. Axion-IA."
```

**`axion-ia-graphique-adoption-ia-entreprises-72-pourcent-2024-courbe-mckinsey-dataviz`** :
```
"L'IA dans les entreprises. Une adoption en forte accélération. Adoption de l'IA par les entreprises (% d'entreprises ayant adopté l'IA dans au moins une fonction). 20% 2017. 25% 2018. 30% 2019. 35% 2020. 40% 2021. 50% 2022. 55% 2023. 72% 2024. Projection 2026 : 80% d'adoption à l'échelle mondiale. 72% des entreprises ont adopté l'IA en 2024 dans au moins une fonction. +20% à +60% de gains de productivité selon les cas d'usage. -10% à -30% de coûts opérationnels. +35% d'amélioration de la qualité des décisions. ROI en 1 à 2 ans pour les organisations les plus matures. Source : McKinsey — The State of AI 2024. Axion-IA."
```

**`axion-ia-dirigeant-1to1-une-personne-une-journee-15h-liberees-35-efficacite-25-productivite-infographie`** :
```
"1 TO 1. 1 PERSONNE. 1 JOURNÉE. Votre temps libéré. Votre performance démultipliée. Axion-IA vous apporte, le temps d'une journée, un expert dédié pour travailler sur vos priorités et générer des résultats concrets. 1 journée pour travailler sur vos priorités. Des résultats concrets dès la fin de la journée. Votre expert Axion-IA. Une journée, 100% dédiée à vos enjeux. Un impact immédiat et mesurable pour vous et votre entreprise. +15h de temps libérées par semaine. +35% d'efficacité opérationnelle. -20% de coûts indirects. +25% de productivité globale. 1 Dirigeant. 1 Journée. Un partenaire de confiance. Des résultats aujourd'hui. Un avantage demain. Réservez votre journée."
```

---

## PHASE 4 — MÉTADONNÉES COMPLÈTES (EXIF/XMP/IPTC)

### 4.1 Template par image

```typescript
// Via sharp + exiftool-vendored
const metadata: ImageMetadata = {
  // EXIF
  ImageDescription: `${nameFr} — ${descriptionFr.slice(0, 200)}`,
  Copyright: '© 2026 Axion-IA OÜ — CC BY 4.0',
  Artist: 'Axion-IA (https://axion-ia.com)',
  Software: 'Axion-IA Image Pipeline 2026 / Sharp 0.33',
  
  // XMP Dublin Core
  'dc:title': { 'fr-FR': titleFr, 'en-US': titleEn },
  'dc:description': { 'fr-FR': descriptionFr, 'en-US': descriptionEn },
  'dc:subject': [...keywordsFr, ...keywordsEn],
  'dc:creator': 'Axion-IA OÜ',
  'dc:rights': 'CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/',
  'dc:language': 'fr-FR',
  
  // XMP étendu
  'xmpRights:UsageTerms': 'CC BY 4.0',
  'xmpRights:WebStatement': 'https://creativecommons.org/licenses/by/4.0/',
  'plus:LicensorURL': 'https://axion-ia.com/licences-images',
  
  // IPTC
  Headline: titleFr.slice(0, 64),
  Caption: `${descriptionFr}\n\nTexte visible : ${embeddedTextCaption}`,
  Keywords: [...keywordsFr].join(', '),
  Credit: 'Axion-IA OÜ',
  Source: 'Axion-IA — https://axion-ia.com',
  CopyrightNotice: '© 2026 Axion-IA OÜ',
  
  // Pour images villes
  City: citySlug ? cityName : undefined,
  Country: citySlug ? 'France' : undefined,
}
```

---

## PHASE 5 — JSON-LD ImageObject 2026 COMPLET

### 5.1 Template avec tous les champs 2026

```json
{
  "@context": "https://schema.org",
  "@type": "ImageObject",
  "@id": "https://axion-ia.com/images/axion-ia-audit-ia-choix-rentable-benefices-immediats-roi-garanti-5-kpi-carre.webp",

  "name": "Audit IA : un choix rentable aux bénéfices immédiats — Axion-IA",
  "alternateName": "AI Audit: a profitable choice with immediate benefits — Axion-IA",

  "description": "Visuel carré présentant les 5 bénéfices immédiats d'un audit IA par Axion-IA : gain de temps, réduction des coûts, performance boostée, meilleures décisions et retour sur investissement garanti. Message clé : l'audit IA est un choix rentable pour toute entreprise.",
  "abstract": "L'audit IA Axion-IA identifie ce que vous pouvez automatiser pour gagner du temps et de l'argent. ROI garanti, bénéfices dès la première semaine.",

  "embeddedTextCaption": "AUDIT IA : UN CHOIX RENTABLE, DES BÉNÉFICES IMMÉDIATS. Gain de temps immédiat. Réduction des coûts immédiate. Performance boostée. Décisions plus justes. Retour sur investissement garanti. Axion-IA.",

  "contentUrl": "https://axion-ia.com/images/axion-ia-audit-ia-choix-rentable-benefices-immediats-roi-garanti-5-kpi-carre.webp",
  "thumbnailUrl": "https://axion-ia.com/images/axion-ia-audit-ia-choix-rentable-benefices-immediats-roi-garanti-5-kpi-carre-thumb.webp",
  "url": "https://axion-ia.com/images/axion-ia-audit-ia-choix-rentable-benefices-immediats-roi-garanti-5-kpi-carre.webp",

  "encodingFormat": "image/webp",
  "width": 1080,
  "height": 1080,

  "creator": {
    "@type": "Organization",
    "name": "Axion-IA",
    "url": "https://axion-ia.com"
  },
  "copyrightHolder": {
    "@type": "Organization",
    "name": "Axion-IA OÜ",
    "url": "https://axion-ia.com"
  },
  "copyrightYear": 2026,
  "license": "https://creativecommons.org/licenses/by/4.0/",
  "acquireLicensePage": "https://axion-ia.com/licences-images",
  "creditText": "© 2026 Axion-IA OÜ — CC BY 4.0",

  "aiGenerated": true,
  "generatorType": "https://schema.org/SoftwareApplication",
  "generator": {
    "@type": "SoftwareApplication",
    "name": "DALL-E (OpenAI)",
    "applicationCategory": "GenerativeAI"
  },

  "keywords": "audit IA choix rentable, bénéfices immédiats IA, ROI garanti intelligence artificielle, gain de temps audit IA, réduction coûts IA, performance boostée IA",

  "about": [
    {
      "@type": "Service",
      "name": "Audit IA",
      "description": "Audit de maturité IA — diagnostic complet des processus et opportunités d'automatisation",
      "provider": { "@type": "Organization", "name": "Axion-IA", "url": "https://axion-ia.com" },
      "url": "https://axion-ia.com/fr/audit-ia"
    }
  ],

  "subjectOf": {
    "@type": "WebPage",
    "url": "https://axion-ia.com/fr/audit-ia",
    "name": "Audit IA — Axion-IA"
  },

  "speakable": {
    "@type": "SpeakableSpecification",
    "cssSelector": [".image-caption", "figcaption", "[data-speakable='true']"]
  },

  "representativeOfPage": false,

  "accessibilityFeature": ["alternativeText", "captions", "highContrast"],
  "accessibilityHazard": "none",
  "accessibilitySummary": "Carré infographique sur fond blanc crème présentant 5 bénéfices de l'audit IA : gain de temps, coûts, performance, décisions, ROI. Texte noir et orange.",

  "additionalProperty": [
    { "@type": "PropertyValue", "name": "imageType", "value": "carre" },
    { "@type": "PropertyValue", "name": "category", "value": "audit" },
    { "@type": "PropertyValue", "name": "subcategory", "value": "audit-ia-roi" },
    { "@type": "PropertyValue", "name": "aiGenerated", "value": "true" },
    { "@type": "PropertyValue", "name": "usageContext", "value": "social,article,og" },
    { "@type": "PropertyValue", "name": "axionVertical", "value": "audit" },
    { "@type": "PropertyValue", "name": "textVisible", "value": "true" }
  ],

  "inLanguage": ["fr-FR", "en-US"],
  "dateCreated": "2026-05-19",
  "datePublished": "2026-05-19",
  "dateModified": "2026-05-19"
}
```

### 5.2 Adaptations JSON-LD par type d'image

**Villes** — ajouter obligatoirement :
```json
"contentLocation": {
  "@type": "City",
  "name": "Paris",
  "sameAs": "https://www.wikidata.org/wiki/Q90",
  "address": { "@type": "PostalAddress", "addressLocality": "Paris", "addressRegion": "Île-de-France", "addressCountry": "FR" },
  "geo": { "@type": "GeoCoordinates", "latitude": 48.8566, "longitude": 2.3522 }
},
"spatialCoverage": { "@type": "Place", "name": "Paris, Île-de-France, France" }
```

**Logos** — type différent :
```json
{ "@type": ["ImageObject", "Logo"],
  "representativeOfPage": false,
  "embeddedTextCaption": "Axion-IA .com",
  "about": {
    "@type": "Organization",
    "name": "Axion-IA",
    "url": "https://axion-ia.com",
    "sameAs": ["https://www.linkedin.com/company/axion-ia"]
  }
}
```

**Dataviz avec chiffres** — ajouter :
```json
"@type": ["ImageObject"],
"measurementTechnique": "Données agrégées — McKinsey State of AI 2024 / Salesforce / Axion-IA études internes",
"variableMeasured": "Taux d'adoption de l'IA dans les entreprises françaises",
"temporalCoverage": "2017/2026"
```

---

## PHASE 6 — ALT TEXT + SPEAKABLE PARFAITS

### 6.1 Règles alt text

```
FORMAT : [Sujet principal image] — [contexte Axion-IA] — [mot-clé 1] [mot-clé 2]
MAX : 125 caractères
OBLIGATOIRE : mentionner Axion-IA naturellement
INTERDIT : "image de", "photo de", keyword stuffing (≥ 3 répétitions)
```

### 6.2 Alt text complets pour les 73 images

**AUDIT** :
```
axion-ia-audit-ia-entreprise-prete-intelligence-artificielle-banniere
→ alt="Bandeau Axion-IA : votre entreprise est-elle prête pour l'IA ? Audit IA diagnostic maturité"

axion-ia-audit-ia-avantage-competitif-decisions-resultats-banniere
→ alt="Axion-IA audit IA : transformer l'IA en avantage compétitif avec des décisions éclairées"

axion-ia-audit-ia-transformer-defis-opportunites-leviers-valeur-banniere
→ alt="L'IA transforme vos défis en opportunités — audit Axion-IA identifie les leviers de valeur"

axion-ia-publicite-outdoor-ia-rapporte-concretement-productivite-profits-affiche
→ alt="Affiche publicitaire Axion-IA : l'IA qui rapporte concrètement — productivité profits résultats"

axion-ia-audit-ia-levier-croissance-mesurable-cartographie-processus-roi-banniere
→ alt="Audit IA Axion-IA : faire de l'intelligence artificielle un levier de croissance mesurable"

axion-ia-audit-ia-solutions-artisans-commercants-tpe-pme-eti-tous-secteurs-banniere
→ alt="Solutions IA Axion-IA adaptées à tous : artisans, commerçants, TPE, PME et ETI"

axion-ia-audit-processus-automatiser-temps-couts-productivite-charges-infographie
→ alt="Infographie audit IA : processus à automatiser pour gagner du temps et réduire les coûts"

axion-ia-audit-entreprise-metro-gagner-temps-reduire-couts-augmenter-productivite-affiche
→ alt="Affiche métro Axion-IA : audit entreprise pour gagner du temps, réduire coûts, booster productivité"

axion-ia-audit-ia-methode-5-etapes-analyse-identification-roi-recommandations-infographie
→ alt="Méthode Axion-IA en 5 étapes : analyse, identification, feuille de route, ROI, recommandations IA"

axion-ia-citation-avenir-prepare-aujourd-hui-comprendre-agir-editorial
→ alt="Citation Axion-IA : l'avenir ne se prévoit pas, il se prépare aujourd'hui — comprendre et agir"

axion-ia-citation-clarte-serenite-resultats-toujours-comprendre-former-transformer-editorial
→ alt="Citation Axion-IA : la clarté aujourd'hui, la sérénité demain, les résultats toujours"

axion-ia-audit-ia-choix-rentable-benefices-immediats-roi-garanti-5-kpi-carre
→ alt="Axion-IA audit IA rentable : 5 bénéfices immédiats — temps, coûts, performance, décisions, ROI"

axion-ia-audit-ia-vous-gagnez-temps-argent-zero-perte-100-gain-carre
→ alt="Audit IA Axion-IA : vous gagnez du temps et de l'argent — zéro perte, 100% de gains"

axion-ia-audit-ia-plus-valeur-moins-perte-performances-decuplees-rentabilite-carre
→ alt="Audit IA Axion-IA : plus de valeur, moins de perte — performances décuplées et rentabilité assurée"

axion-ia-audit-ia-chaos-ordre-performance-gain-temps-reduction-couts-decisions-carre
→ alt="Audit IA Axion-IA transforme le chaos en ordre : performance, gain de temps et meilleures décisions"

axion-ia-audit-ia-une-journee-mois-gagnes-switch-rapide-concret-efficace-carre
→ alt="Audit IA Axion-IA : une journée pour des mois gagnés — rapide, concret, efficace, autonome"

axion-ia-audit-ia-votre-avance-concurrents-benchmark-performance-carre
→ alt="Audit IA Axion-IA : prenez l'avance sur vos concurrents — benchmark performance intelligence artificielle"
```

**FORMATION** :
```
axion-ia-formation-ia-1-jour-sur-mesure-generique-reserver-session-carre
→ alt="Formation IA 1 jour Axion-IA : programme sur mesure ou générique — réservez votre session"

axion-ia-intervention-ia-rapide-resultats-concrets-entreprise-carre
→ alt="Intervention IA rapide Axion-IA : résultats concrets pour votre entreprise dès aujourd'hui"

axion-ia-formation-ia-comprendre-creer-transformer-intelligence-humaine-augmentee-banniere
→ alt="Formation IA Axion-IA : comprendre, créer, transformer — l'intelligence humaine augmentée par l'IA"

axion-ia-intervention-ia-france-toutes-regions-consultant-client-photo-banniere
→ alt="Consultant Axion-IA en intervention IA rapide partout en France — résultats concrets et mesurables"

axion-ia-formation-acculturation-ia-entreprise-tpe-pme-eti-2026-comment-commencer-photo-banniere
→ alt="Acculturation IA en entreprise Axion-IA : par où commencer pour TPE, PME et ETI en 2026"

axion-ia-citation-intelligence-artificielle-valeur-impact-cree-editorial
→ alt="Citation Axion-IA : l'intelligence artificielle n'a de valeur que par l'impact qu'elle crée"

axion-ia-citation-ia-ne-remplace-pas-humain-revele-potentiel-former-editorial
→ alt="Citation Axion-IA : l'IA ne remplace pas l'humain, elle révèle son potentiel — former et transformer"

axion-ia-formation-ia-vous-gagnez-concretement-5-benefices-depasser-concurrents-banniere
→ alt="Formation IA Axion-IA : vous gagnez concrètement — 5 bénéfices pour dépasser vos concurrents"

axion-ia-citation-investir-connaissance-recolter-liberte-demain-formation-editorial
→ alt="Citation Axion-IA : investir en connaissance aujourd'hui, c'est récolter la liberté demain"

axion-ia-formation-ia-benefices-concrets-premier-jour-formateur-photo-carre
→ alt="Formateur Axion-IA animant une formation IA avec bénéfices concrets dès le premier jour"

axion-ia-formation-ia-avant-apres-une-journee-resultats-concrets-photo-carre
→ alt="Avant / après formation IA Axion-IA : une journée pour des résultats concrets et durables"

axion-ia-formation-ia-moins-stress-plus-clarte-une-journee-changer-quotidien-photo-banniere
→ alt="Formation IA Axion-IA : moins de stress, plus de clarté — une journée pour changer votre quotidien"

axion-ia-formation-equipe-ia-40-pourcent-productivite-2-jours-100-mesure-carre
→ alt="Formez votre équipe à l'IA Axion-IA : +40% productivité en 2 jours, 100% sur mesure"

axion-ia-formation-1-jour-progresser-sur-mesure-ou-generique-carre
→ alt="Formation IA 1 jour Axion-IA pour progresser : programme sur mesure ou générique disponible"

axion-ia-formation-ia-1-jour-reserver-session-sur-mesure-generique-carre
→ alt="Réservez votre formation IA 1 jour Axion-IA : sur mesure adaptée à vos outils et processus"
```

**AUTOMATISATION** :
```
axion-ia-automatisation-ia-benefices-concrets-mesurables-durables-innovation-banniere
→ alt="Automatisation IA Axion-IA : bénéfices concrets, mesurables et durables — innovation et performance"

axion-ia-automatisation-ia-avant-apres-tableau-bord-45-pourcent-98-pourcent-photo-carre
→ alt="Avant/après automatisation IA Axion-IA : tableau de bord +45% performance, 98% décisions optimisées"

axion-ia-automatisation-ia-performance-86-pourcent-gain-temps-reduction-couts-carre
→ alt="Automatisation IA Axion-IA : performance +86%, gain de temps et réduction des coûts garantis"

axion-ia-automatisation-ia-triangle-temps-couts-resultats-100-gagnant-complexite-carre
→ alt="Triangle d'or de l'automatisation IA Axion-IA : temps, coûts, résultats — 100% gagnant"
```

**1-TO-1 DIRIGEANT** :
```
axion-ia-dirigeant-1to1-ouvrir-ce-qui-ralentit-entreprise-12h-semaine-photo-banniere
→ alt="Coaching IA Axion-IA pour dirigeants : ouvrez ce qui ralentit votre entreprise — +12h libérées"

axion-ia-dirigeant-1to1-une-journee-reprendre-controle-temps-clarte-resultats-photo-banniere
→ alt="1 journée avec Axion-IA pour reprendre le contrôle : temps, clarté et résultats pour dirigeants"

axion-ia-dirigeant-1to1-temps-plus-grand-atout-liberer-journee-sablier-photo-banniere
→ alt="Axion-IA coaching dirigeant : votre temps est votre plus grand atout — une journée pour le libérer"

axion-ia-dirigeant-1to1-moins-stress-clarte-simplicite-performance-pierres-photo-banniere
→ alt="Coaching IA dirigeant Axion-IA : moins de stress, clarté, simplicité et performance assurée"

axion-ia-dirigeant-1to1-moins-subir-plus-piloter-process-croissance-impact-durable-photo-banniere
→ alt="Axion-IA 1-to-1 dirigeant : moins subir, plus piloter — process clairs et croissance durable"

axion-ia-dirigeant-1to1-une-personne-une-journee-15h-liberees-35-efficacite-25-productivite-infographie
→ alt="1 to 1 Axion-IA : 1 personne, 1 journée — +15h libérées/semaine, +35% efficacité, +25% productivité"
```

**ÉQUIPE 1-TO-1** :
```
axion-ia-equipe-1to1-tous-profils-metiers-manager-rh-marketing-ops-gagner-temps-photo-banniere
→ alt="1 to 1 Axion-IA pour toute l'équipe : secrétaires, managers, RH, directeurs, marketing, ops"

axion-ia-equipe-1to1-une-personne-grandir-competence-objectifs-performance-potentiel-photo-carre
→ alt="1 to 1 Axion-IA : une personne dédiée pour faire grandir compétences, objectifs et performance"
```

**GRAPHIQUES** :
```
axion-ia-graphique-processus-5-etapes-timeline-audit-ia-infographie
→ alt="Infographie Axion-IA : processus en 5 étapes — de l'analyse des données au résultat mesurable"

axion-ia-graphique-performance-ia-entreprise-kpi-20-60-pourcent-temps-productivite-dataviz
→ alt="Graphique Axion-IA : l'IA booste la performance entreprise de +20% (temps) à +60% (innovation)"

axion-ia-graphique-adoption-ia-entreprises-72-pourcent-2024-courbe-mckinsey-dataviz
→ alt="Courbe adoption IA entreprises : 72% en 2024, projection 80% en 2026 — données McKinsey Axion-IA"

axion-ia-graphique-ia-imperatif-performance-fosse-concurrentiel-courbe-adoption-dataviz
→ alt="Graphique Axion-IA : l'IA n'est plus une option, c'est un impératif — fossé concurrentiel se creuse"

axion-ia-graphique-ia-maintenant-attendre-explorer-integrer-dominer-avantage-competitif-infographie
→ alt="L'IA c'est maintenant : 4 niveaux Axion-IA — attendre, explorer, intégrer, dominer le marché"
```

**LOGOS** :
```
axion-ia-logo-horizontal-fond-blanc-bordure-orange
→ alt="Logo Axion-IA horizontal fond blanc avec bordure orange — cabinet conseil IA"

axion-ia-logo-horizontal-transparent
→ alt="Logo Axion-IA horizontal fond transparent — cabinet conseil intelligence artificielle"

[Autres logos → alt="" (décoratif si en tant qu'icône, descriptif si affiché seul)]
```

**PROPOSITIONS** :
```
axion-ia-proposition-outdoor-formations-audit-implementations-resultats-duo-affiche
→ alt="Affiche Axion-IA : formations, audit IA, implémentations et résultats concrets — cabinet conseil IA"

axion-ia-proposition-showroom-mur-formations-audit-implementations-ia-photo
→ alt="Mur de showroom Axion-IA affichant les 4 services : formations, audit IA, implémentations, résultats"

axion-ia-proposition-ia-pour-tous-pas-reservee-grandes-entreprises-artisans-tpe-banniere
→ alt="L'IA n'est pas réservée aux grandes entreprises — Axion-IA accompagne artisans, commerçants et TPE"

axion-ia-proposition-globe-4-services-formations-audit-implementations-resultats-carre
→ alt="Globe Axion-IA entouré des 4 services : formations IA, audit IA, implémentations et résultats concrets"

axion-ia-proposition-booster-productivite-equipes-automatiser-inutile-liberer-potentiel-affiche
→ alt="Axion-IA booste la productivité des équipes : automatiser l'inutile pour libérer le potentiel"

axion-ia-proposition-solutions-ia-chaque-realite-5-secteurs-adapte-banniere
→ alt="Solutions IA Axion-IA adaptées à chaque réalité d'entreprise — 5 secteurs accompagnés"

axion-ia-proposition-temps-precieux-taches-repetitives-processus-intelligents-couts-quadrant-carre
→ alt="Quadrant Axion-IA : votre temps est précieux — automatiser tâches répétitives et réduire les coûts"

axion-ia-proposition-moins-taches-plus-valeur-ia-objectif-carre
→ alt="Axion-IA : moins de tâches répétitives, plus de valeur créée grâce à l'intelligence artificielle"

axion-ia-proposition-ia-simplifie-interventions-femme-sourire-photo-banniere
→ alt="L'IA Axion-IA simplifie vos interventions — femme souriante utilisant l'intelligence artificielle"

axion-ia-proposition-temps-vers-argent-croissance-sablier-pieces-photo-banniere
→ alt="Axion-IA transforme votre temps en argent et croissance — sablier et courbe de rentabilité IA"

axion-ia-equipe-intelligence-artificielle-service-humain-12-personnes-photo-groupe
→ alt="Équipe Axion-IA — l'intelligence artificielle au service de l'humain — 12 experts IA"
```

**VILLES** :
```
axion-ia-paris-consultante-tour-eiffel-performance-28-pourcent-satisfaction-4-8-photo-banniere
→ alt="Consultante Axion-IA à Paris devant la Tour Eiffel : +28% performance, satisfaction 4,8/5"

axion-ia-paris-intelligence-artificielle-reussite-sacre-coeur-cas-concrets-ecommerce-photo-banniere
→ alt="Axion-IA à Paris — intelligence artificielle au cœur de votre réussite : e-commerce, marketing, gestion"

axion-ia-paris-tour-eiffel-services-ia-carte-france-localisation-photo-carre
→ alt="Axion-IA Paris : services IA localisés en Île-de-France — Tour Eiffel et carte France"

axion-ia-paris-formation-ia-haussmann-se-former-comprendre-agir-photo-banniere
→ alt="Formation IA à Paris avec Axion-IA : se former, comprendre et agir — Paris haussmannien"

axion-ia-lyon-formation-ia-presquile-fourviere-se-former-comprendre-agir-photo-banniere
→ alt="Formation IA à Lyon avec Axion-IA : se former et comprendre l'IA — Presqu'île et Fourvière"
```

---

## PHASE 7 — VARIANTS TECHNIQUES (FORMAT-AWARE)

### 7.1 Règles par type d'image

```typescript
const getVariantConfig = (imageType: string) => {
  switch (imageType) {
    case 'banniere':
      // 16:9 ou plus large — OG crop centré, square crop avec attention
      return { ogFit: 'cover', ogPosition: 'center', squareFit: 'cover', squarePosition: 'attention' }
    
    case 'carre':
      // 1:1 — pas de crop square (c'est déjà carré), OG = letterbox avec padding blanc
      return { ogFit: 'contain', ogBackground: '#FFFFFF', squareFit: 'outside', squarePosition: 'center' }
    
    case 'affiche':
      // Billboard — OG = crop sur la moitié gauche (texte principal), square = centre
      return { ogFit: 'cover', ogPosition: 'left', squareFit: 'cover', squarePosition: 'attention' }
    
    case 'infographie':
      // Souvent horizontal long — OG crop top (titre visible), square = top
      return { ogFit: 'cover', ogPosition: 'top', squareFit: 'cover', squarePosition: 'top' }
    
    case 'editorial':
      // Citation — souvent 4:3 ou 16:9 — crop centré (texte centré)
      return { ogFit: 'cover', ogPosition: 'center', squareFit: 'cover', squarePosition: 'center' }
    
    case 'photo':
      // Composite photo — attention Smart pour sujet
      return { ogFit: 'cover', ogPosition: 'attention', squareFit: 'cover', squarePosition: 'attention' }
    
    case 'dataviz':
      // Graphique — OG = toute l'image (contain), pas de crop
      return { ogFit: 'contain', ogBackground: '#FFFFFF', squareFit: 'contain', squareBackground: '#FFFFFF' }
    
    case 'logo':
      // Logo — LOSSLESS, contain avec padding, pas de crop intelligent
      return {
        ogFit: 'contain', ogBackground: '#FFFFFF', ogPadding: 100,
        squareFit: 'contain', squareBackground: '#FFFFFF', squarePadding: 80,
        webpOptions: { lossless: true },  // Lossless pour logos !
        avifOptions: { lossless: true },
      }
    
    default:
      return { ogFit: 'cover', ogPosition: 'attention', squareFit: 'cover', squarePosition: 'attention' }
  }
}
```

### 7.2 Variants complets pour chaque image

```
[slug].webp           → Principal WebP 85% qualité, dims originales (min 1200px)
[slug].avif           → AVIF 70% qualité, dims originales
[slug]-og.webp        → 1200×630 smart crop (format-aware ci-dessus)
[slug]-square.webp    → 1080×1080 smart crop (format-aware)
[slug]-thumb.webp     → 400×300 cover attention
[slug]-md.webp        → 768px wide, hauteur proportionnelle
[slug]-sm.webp        → 384px wide, hauteur proportionnelle
[slug]-lqip.webp      → 16px wide, blur 8, base64 inline
```

---

## PHASE 8 — HTML ON-PAGE PARFAIT

### 8.1 Composant `ImageBankPicture.tsx`

```tsx
// src/components/ui/ImageBankPicture.tsx
interface ImageBankPictureProps {
  slug: string
  alt: string
  caption?: string          // speakable
  title?: string
  priority?: boolean        // above-fold = true → preload + priority
  imageType?: 'banniere' | 'carre' | 'photo' | 'logo' | 'infographie' | 'editorial' | 'affiche' | 'dataviz'
  sizes?: string
  className?: string
  width: number
  height: number
  lqipBase64: string
}

export function ImageBankPicture({
  slug, alt, caption, title, priority = false,
  imageType, sizes, className, width, height, lqipBase64
}: ImageBankPictureProps) {
  const base = `/images/${slug}`
  
  return (
    <figure
      className={`relative ${className ?? ''}`}
      itemScope
      itemType="https://schema.org/ImageObject"
    >
      <picture>
        <source
          type="image/avif"
          srcSet={`${base}.avif 1920w, ${base}-md.avif 768w, ${base}-sm.avif 384w`}
          sizes={sizes ?? "(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 1200px"}
        />
        <source
          type="image/webp"
          srcSet={`${base}.webp 1920w, ${base}-md.webp 768w, ${base}-sm.webp 384w`}
          sizes={sizes ?? "(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 1200px"}
        />
        <img
          src={`${base}.webp`}
          alt={alt}
          title={title}
          width={width}
          height={height}
          loading={priority ? 'eager' : 'lazy'}
          decoding={priority ? 'sync' : 'async'}
          fetchPriority={priority ? 'high' : 'auto'}
          style={{
            backgroundImage: `url(${lqipBase64})`,
            backgroundSize: 'cover',
            aspectRatio: `${width}/${height}`,
          }}
          itemProp="contentUrl"
        />
      </picture>

      {caption && (
        <figcaption
          itemProp="description"
          className="sr-only"
          data-speakable="true"
        >
          {caption}
        </figcaption>
      )}

      <meta itemProp="name" content={title ?? alt} />
      <meta itemProp="license" content="https://creativecommons.org/licenses/by/4.0/" />
      <link itemProp="acquireLicensePage" href="https://axion-ia.com/licences-images" />
    </figure>
  )
}
```

### 8.2 Meta head par page

```tsx
// Pour chaque page utilisant des images Axion-IA
<meta name="robots" content="max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
<meta property="og:image" content={`https://axion-ia.com/images/${primaryImageSlug}-og.webp`} />
<meta property="og:image:alt" content={primaryImageAlt} />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:type" content="image/webp" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content={`https://axion-ia.com/images/${primaryImageSlug}-og.webp`} />
<meta name="twitter:image:alt" content={primaryImageAlt} />

{/* Preload hero uniquement */}
{priority && (
  <link
    rel="preload"
    as="image"
    href={`/images/${primaryImageSlug}.webp`}
    imageSrcSet={`/images/${primaryImageSlug}.avif 1920w, /images/${primaryImageSlug}-md.avif 768w`}
    imageSizes="(max-width: 768px) 100vw, 1200px"
    fetchPriority="high"
  />
)}
```

---

## PHASE 9 — SITEMAP IMAGES XML (Google Protocol 1.1)

### 9.1 Mapping image ↔ pages (complet et précis)

```typescript
const IMAGE_PAGE_MAPPING: Record<string, string[]> = {
  // Audit
  'axion-ia-audit-ia-entreprise-prete-intelligence-artificielle-banniere':
    ['/fr/audit-ia', '/en/ia-audit'],
  'axion-ia-audit-ia-methode-5-etapes-analyse-identification-roi-recommandations-infographie':
    ['/fr/audit-ia', '/fr/blog/methode-audit-ia'],
  'axion-ia-publicite-outdoor-ia-rapporte-concretement-productivite-profits-affiche':
    ['/fr/audit-ia', '/fr/', '/en/'],
  'axion-ia-audit-ia-solutions-artisans-commercants-tpe-pme-eti-tous-secteurs-banniere':
    ['/fr/audit-ia', '/fr/solutions-ia'],
  
  // Formation
  'axion-ia-formation-acculturation-ia-entreprise-tpe-pme-eti-2026-comment-commencer-photo-banniere':
    ['/fr/formations-ia', '/fr/interventions-ia'],
  'axion-ia-formation-ia-avant-apres-une-journee-resultats-concrets-photo-carre':
    ['/fr/formations-ia', '/fr/formation-ia-1-jour'],
  'axion-ia-formation-equipe-ia-40-pourcent-productivite-2-jours-100-mesure-carre':
    ['/fr/formations-ia'],
  
  // Automatisation
  'axion-ia-automatisation-ia-avant-apres-tableau-bord-45-pourcent-98-pourcent-photo-carre':
    ['/fr/automatisation-ia', '/fr/implementations-ia'],
  
  // 1-TO-1
  'axion-ia-dirigeant-1to1-une-personne-une-journee-15h-liberees-35-efficacite-25-productivite-infographie':
    ['/fr/accompagnement-dirigeants', '/fr/1-to-1'],
  'axion-ia-equipe-1to1-tous-profils-metiers-manager-rh-marketing-ops-gagner-temps-photo-banniere':
    ['/fr/accompagnement-equipes', '/fr/1-to-1'],
  
  // Graphiques (pages blog/ressources)
  'axion-ia-graphique-adoption-ia-entreprises-72-pourcent-2024-courbe-mckinsey-dataviz':
    ['/fr/blog/adoption-ia-entreprises-2024', '/fr/ressources'],
  'axion-ia-graphique-performance-ia-entreprise-kpi-20-60-pourcent-temps-productivite-dataviz':
    ['/fr/blog/roi-ia-entreprise', '/fr/ressources'],
  
  // Propositions
  'axion-ia-equipe-intelligence-artificielle-service-humain-12-personnes-photo-groupe':
    ['/fr/a-propos', '/fr/', '/en/'],
  'axion-ia-proposition-ia-pour-tous-pas-reservee-grandes-entreprises-artisans-tpe-banniere':
    ['/fr/', '/fr/solutions-ia', '/fr/audit-ia'],
  
  // Paris
  'axion-ia-paris-consultante-tour-eiffel-performance-28-pourcent-satisfaction-4-8-photo-banniere':
    ['/fr/ia-paris', '/fr/formation-ia-paris', '/fr/audit-ia-paris'],
  'axion-ia-paris-formation-ia-haussmann-se-former-comprendre-agir-photo-banniere':
    ['/fr/formation-ia-paris', '/fr/ia-paris'],
  
  // Lyon
  'axion-ia-lyon-formation-ia-presquile-fourviere-se-former-comprendre-agir-photo-banniere':
    ['/fr/ia-lyon', '/fr/formation-ia-lyon'],
}
```

### 9.2 Génération XML

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">

  <url>
    <loc>https://axion-ia.com/fr/audit-ia</loc>
    
    <image:image>
      <image:loc>https://axion-ia.com/images/axion-ia-audit-ia-entreprise-prete-intelligence-artificielle-banniere.webp</image:loc>
      <image:title>Votre entreprise est-elle prête pour l'IA ? Audit Axion-IA</image:title>
      <image:caption>Axion-IA propose un audit de maturité IA pour identifier vos opportunités : analyse des processus métier, identification des leviers IA, feuille de route personnalisée et estimation du ROI. Diagnostic complet pour PME, ETI et grands comptes.</image:caption>
      <image:license>https://creativecommons.org/licenses/by/4.0/</image:license>
    </image:image>

    <image:image>
      <image:loc>https://axion-ia.com/images/axion-ia-audit-ia-methode-5-etapes-analyse-identification-roi-recommandations-infographie.webp</image:loc>
      <image:title>Méthode audit IA Axion-IA en 5 étapes clés</image:title>
      <image:caption>Infographie présentant la méthode d'audit IA Axion-IA en 5 étapes : analyse de l'activité, identification des opportunités, feuille de route adaptée, estimation ROI et recommandations concrètes avec plan d'action opérationnel.</image:caption>
      <image:license>https://creativecommons.org/licenses/by/4.0/</image:license>
    </image:image>

  </url>

  <!-- Pages villes — avec géolocalisation -->
  <url>
    <loc>https://axion-ia.com/fr/ia-paris</loc>
    
    <image:image>
      <image:loc>https://axion-ia.com/images/axion-ia-paris-consultante-tour-eiffel-performance-28-pourcent-satisfaction-4-8-photo-banniere.webp</image:loc>
      <image:title>Axion-IA Paris — Consultant IA avec +28% de performance</image:title>
      <image:caption>Consultante Axion-IA travaillant à Paris avec vue sur la Tour Eiffel. Résultats clients Paris : +28% de performance commerciale, satisfaction 4,8/5, temps d'intervention réduit de 35%. Services : formation IA, audit IA, implémentations IA à Paris et en Île-de-France.</image:caption>
      <image:geo_location>Paris, Île-de-France, France</image:geo_location>
      <image:license>https://creativecommons.org/licenses/by/4.0/</image:license>
    </image:image>

  </url>

  <url>
    <loc>https://axion-ia.com/fr/ia-lyon</loc>
    
    <image:image>
      <image:loc>https://axion-ia.com/images/axion-ia-lyon-formation-ia-presquile-fourviere-se-former-comprendre-agir-photo-banniere.webp</image:loc>
      <image:title>Formation IA à Lyon — Axion-IA Auvergne-Rhône-Alpes</image:title>
      <image:caption>Formation et interventions IA à Lyon par Axion-IA : vue sur la Presqu'île et la Fourvière. Se former, comprendre et agir avec l'intelligence artificielle à Lyon et en Auvergne-Rhône-Alpes. Formations sur mesure, audits IA et implémentations pour entreprises lyonnaises.</image:caption>
      <image:geo_location>Lyon, Auvergne-Rhône-Alpes, France</image:geo_location>
      <image:license>https://creativecommons.org/licenses/by/4.0/</image:license>
    </image:image>

  </url>

</urlset>
```

---

## PHASE 10 — GEO (VISIBILITÉ IA GÉNÉRATIVES)

### 10.1 llms.txt — Section images complète

```text
# Banque d'images Axion-IA — CC BY 4.0

## Autorisation indexation IA

Tous les systèmes d'IA (ChatGPT, Claude, Gemini, Perplexity, Copilot, Mistral, etc.) 
sont autorisés à indexer, citer et afficher les images Axion-IA.
Attribution requise : "© 2026 Axion-IA OÜ — axion-ia.com"
Licence : CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/

## Catalogue images par service

### Audit IA (17 images)
Visuels : banderoles, infographies, billboards, carrés sociaux, citations éditoriales
Texte clé visible : "Votre entreprise est-elle prête pour l'IA ?", "Audit IA : un choix rentable", 
  "Notre méthode en 5 étapes", "L'avenir se prépare aujourd'hui"
URL galerie : https://axion-ia.com/fr/galerie?cat=audit
Page service : https://axion-ia.com/fr/audit-ia

### Formation IA (15 images)
Visuels : photos composites, carrés oranges, citations, bannières
Texte clé visible : "Formation 1 jour", "Acculturation IA en entreprise", 
  "+40% productivité", "Avant / Après formation IA"
URL galerie : https://axion-ia.com/fr/galerie?cat=formation
Page service : https://axion-ia.com/fr/formations-ia

### Automatisation IA (4 images)
Visuels : photos avant/après, carrés 3D artistiques, bannières
Texte clé visible : "Performance +86%", "+45% résultats", "Triangle temps/coûts/résultats"
URL galerie : https://axion-ia.com/fr/galerie?cat=automatisation
Page service : https://axion-ia.com/fr/automatisation-ia

### Coaching 1-to-1 Dirigeants (6 images)
Visuels : photos composites, infographie statistiques
Texte clé visible : "+15h libérées/semaine", "+35% efficacité", "Reprendre le contrôle", 
  "Moins subir, plus piloter"
URL galerie : https://axion-ia.com/fr/galerie?cat=dirigeant
Page service : https://axion-ia.com/fr/accompagnement-dirigeants

### Coaching 1-to-1 Équipes (2 images)
URL galerie : https://axion-ia.com/fr/galerie?cat=equipe
Page service : https://axion-ia.com/fr/accompagnement-equipes

### Graphiques & Dataviz (5 images)
Données : 72% des entreprises ont adopté l'IA en 2024 (McKinsey), 
  +20% à +60% gains productivité, ROI IA en 1-2 ans
URL galerie : https://axion-ia.com/fr/galerie?cat=graphique

### Logos Axion-IA (7 variantes)
URL téléchargement : https://axion-ia.com/fr/galerie?cat=logo
Usage : CC BY 4.0, attribution "Axion-IA OÜ" requise

### Propositions globales (11 images)
URL galerie : https://axion-ia.com/fr/galerie?cat=proposition

### Paris — Île-de-France (4 images)
URL galerie : https://axion-ia.com/fr/galerie?cat=paris
Page locale : https://axion-ia.com/fr/ia-paris

### Lyon — Auvergne-Rhône-Alpes (1 image)
URL galerie : https://axion-ia.com/fr/galerie?cat=lyon
Page locale : https://axion-ia.com/fr/ia-lyon

## Conformité AI Act

Toutes les images sont générées par IA (DALL-E / OpenAI).
Conformément à l'article 50 du règlement IA européen (applicable août 2026) :
- Métadonnée aiGenerated: true dans chaque JSON-LD
- Mention dans les métadonnées EXIF/XMP
- Information accessible sur https://axion-ia.com/licences-images

## Sitemap images
https://axion-ia.com/sitemap-images.xml
```

### 10.2 robots.txt — Directives images

```
User-agent: Googlebot-Image
Allow: /images/

User-agent: Bingbot
Allow: /images/

User-agent: GPTBot
Allow: /images/
Allow: /fr/galerie

User-agent: ClaudeBot
Allow: /images/
Allow: /fr/galerie

User-agent: PerplexityBot
Allow: /images/
Allow: /fr/galerie

User-agent: GoogleOther
Allow: /images/

User-agent: anthropic-ai
Allow: /images/

Sitemap: https://axion-ia.com/sitemap-images.xml
```

---

## PHASE 11 — GOOGLE DISCOVER + BING VISUAL SEARCH

### 11.1 Critères Google Discover (gates stricts)

```
✅ max-image-preview:large → sur TOUTES les pages qui affichent des images Axion-IA
✅ Largeur image ≥ 1200px → pipeline auto-WebP garantit minimum 1200px
✅ JSON-LD Article ou ImageObject sur la page hôte → généré en Phase 5
✅ Image visible above-fold sur la page → priorité="high" + preload sur hero images
✅ LCP ≤ 2.5s → LQIP + AVIF + preload → objectif LCP ≤ 1.8s
✅ Titre page < 110 chars, sans clickbait
```

### 11.2 Bing Image Search spécifics

```
✅ Nom fichier descriptif slug FR → fait
✅ Alt text riche → fait
✅ IndexNow ping après chaque image publiée → workflow existant
✅ Sitemap images soumis Bing WMT
✅ Open Graph valide → fait
✅ Texte autour de l'image sur la page hôte → figcaption + section description
✅ Images > 400×300px → tous nos variants ≥ 400×300
```

---

## LIVRABLES ATTENDUS

```
_AUDIT/image-bank-seo-aeo-geo-2026/
├── 00-rename-manifest.json                   (73 entrées source → slug + type)
├── 01-misclassification-corrections.json     (2 corrections identifiées)
├── 02-metadata-complete.json                 (73 × EXIF/XMP/IPTC)
├── 03-jsonld-all-images.json                 (73 × ImageObject complet)
├── 04-embedded-text-captions.json            (73 × OCR text visible)
├── 05-alt-text-all-images.json               (73 × alt FR + EN)
├── 06-speakable-captions.json                (73 × caption 3 phrases)
├── 07-sitemap-images.xml                     (Google Protocol 1.1)
├── 08-db-seed-entries.ts                     (73 × Prisma create)
├── 09-llms-txt-section.md                    (section à ajouter)
├── 10-robots-txt-directives.md               (directives à ajouter)
├── 11-indexnow-urls-batch.json               (URLs à soumettre)
└── 12-IMPLEMENTATION-REPORT.md               (rapport + gates status)

src/
├── server/queue/workers/image-bank-auto-convert-worker.ts  (Phase 0 pipeline)
├── app/api/v1/images/import/route.ts                       (API import auto-WebP)
├── components/ui/ImageBankPicture.tsx                      (composant <picture>)
└── app/[locale]/galerie/page.tsx                           (page galerie SEO)
```

---

## GATES DE VALIDATION

```
□ 73/73 images ont un slug FR kebab-case (0 accent, 0 espace, 0 timestamp)
□ 2 misclassifications corrigées (16_54_06 déplacée vers Audit)
□ 73/73 embeddedTextCaption (texte visible dans l'image transcrit fidèlement)
□ 73/73 alt text FR < 125 chars, contenant le message clé de l'image
□ 73/73 JSON-LD valide schema.org (tester validator.schema.org)
□ 73/73 aiGenerated:true (AI Act compliance obligatoire août 2026)
□ 73/73 licence CC BY 4.0 dans EXIF + XMP + JSON-LD
□ Logos → WebP lossless (pas de compression lossy)
□ Format-aware OG crop : carrés → contain blanc, bannières → cover center
□ Sitemap XML valide (xmllint + Google Sitemaps validator)
□ max-image-preview:large présent sur toutes pages hôtes
□ llms.txt mis à jour avec section images complète
□ robots.txt autorisant GPTBot/ClaudeBot/PerplexityBot sur /images/
□ Pipeline auto-WebP opérationnel (tester avec 1 PNG → vérifie génération 8 variants)
□ 0 PII dans métadonnées (les "personnes" dans les images sont IA-générées — le noter)
□ IndexNow batch préparé (STOP & ASK Will avant envoi réel)
```

---

## ORDRE D'EXÉCUTION AUTOPILOTE

```
Phase 0  → Coder worker auto-convert + API import (critique pour futur)
Phase 1  → Appliquer corrections misclassification (déplacer 16_54_06)
Phase 2  → Générer rename-manifest.json (73 slugs confirmés)
Phase 3  → Extraire embedded-text-captions.json (lire OCR de chaque image)
Phase 4  → Générer metadata-complete.json (EXIF/XMP/IPTC)
Phase 5  → Générer jsonld-all-images.json (ImageObject complet par image)
Phase 6  → Générer alt-text + speakable-captions.json
Phase 7  → Générer sitemap-images.xml
Phase 8  → Générer db-seed-entries.ts (Prisma)
Phase 9  → Générer llms-txt-section.md + robots-txt-directives.md
Phase 10 → Générer indexnow-urls-batch.json
Phase 11 → IMPLEMENTATION-REPORT.md + gates check
STOP & ASK Will → valider manifest + misclassifications + gates avant scripts réels
```

> **Note finale** : Ce prompt est basé sur une analyse visuelle réelle et complète des 73 images réalisée le 2026-05-19. Chaque slug, chaque alt text, chaque embeddedTextCaption est ancré dans le contenu réel visible — pas dans des suppositions.

---

*Prompt version 2.0 — 2026-05-19 — Post-analyse visuelle complète 73/73 images*
