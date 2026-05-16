# Phase 0 — Décisions défauts STOP & ASK (autopilote 2026-05-16)

> Cadre : autorisation Will d'autopilote intégral. Les 5 STOP & ASK §Phase 0 du prompt v1.1 ont été tranchés en prenant les **défauts recommandés** par le prompt lui-même. Toutes traçables ici, modifiable ultérieurement par décision explicite Will.

## STOP & ASK #1 — Naming taxonomie modules

**Question** : `interventions`, `audits`, `implementations` (slugs en anglais court) OU variantes francophones ?

**Décision défaut prise** : ✅ **`interventions` / `audits` / `implementations`** (anglais court, slugs canoniques).

**Justification** :

- Cohérent avec routing.ts actuel (`/fr/audit/*`, `/fr/implementation/*`, `/fr/interventions/*`)
- Slugs courts = URLs propres
- Mémoire `axionia_interventions_taxonomy_refonte_2026-05-11` valide « Interventions + Formations » comme un seul module

**Réversible** : oui (rename via migration + redirects 301).

## STOP & ASK #2 — Licence par défaut

**Question** : CC BY 4.0 (Creative Commons Attribution) OU autre licence ?

**Décision défaut prise** : ✅ **CC BY 4.0** pour images Axion-IA-générées + éditoriales.

**Justification** :

- Mentionnée 14× dans le prompt v1.1 + master v1.0
- Badge « Licensable » Google Images (+30% CTR observé selon prompt §2.1)
- Stratégie « citation propre, attribution obligatoire »
- Cohérent avec `llms.txt` actuel (déjà CC BY 4.0)

**Réversible** : licence stockée colonne `licenseUrl` per-image → bascule possible (CC BY-NC, CC BY-SA, all-rights-reserved) par image ou batch.

## STOP & ASK #3 — Pipeline AVIF effort 6 (V1) vs effort 9 (V1.1)

**Question** : encoding AVIF effort 6 (rapide) ou 9 (meilleure compression mais x3 CPU) ?

**Décision défaut prise** : ✅ **AVIF effort 6 en pipeline synchrone (V1)** + **basculer effort 9 en worker async V1.1** (cf. prompt §4.2).

**Justification** :

- Gain 5-10% poids vs coût CPU x3 — pas P0
- Pipeline synchrone doit rester rapide pour UX admin upload (≤ 5 MB sync)
- Worker async batch peut traiter effort 9 nuit sans bloquer UX

**Réversible** : flag config `AVIF_EFFORT_SYNC` (6 par défaut) + `AVIF_EFFORT_ASYNC` (9 par défaut).

## STOP & ASK #4 — Politique watermark

**Question** : watermark systématique ON tous variants téléchargeables OU optionnel par image ?

**Décision défaut prise** : ✅ **Optionnel par image** (colonne `watermarkEnabled: boolean @default(false)`) + watermark **on-the-fly** au download (pas en pipeline d'import).

**Justification** :

- Toutes les images ne nécessitent pas watermark (ex. schémas internes Axion-IA OK sans)
- On-the-fly = source originale propre + watermarking au moment du download (`/api/image-bank/[id]/download?variant=lg&watermark=true`)
- Pattern conforme spec maître v1.0

**Réversible** : flip flag par image via admin UI.

## STOP & ASK #5 — Activation V1 vs V1.5 features

**Question** : quelles features perfection 2026 livrer V1 vs reporter V1.5 ?

**Décision défaut prise** : Distribution suivant le prompt v1.1 §1 (tableau Gaps P0/P1/P2) :

| Feature                                                          | V1 (à livrer)                                       | V1.5 (reporter)                         |
| ---------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------- |
| GAP-01 Taxonomie métier 3 modules                                | ✅ V1                                               | —                                       |
| GAP-02 subjectOfUrl/Type                                         | ✅ V1                                               | —                                       |
| GAP-03 Variant og.webp 1200×630                                  | ✅ V1                                               | —                                       |
| GAP-04 Seed démo 30 images                                       | ✅ V1                                               | —                                       |
| GAP-04 Bulk-import CSV                                           | ✅ V1                                               | —                                       |
| GAP-09 Cross-ref content-gen↔image-bank                          | —                                                   | 🟡 V1.5 (P2)                            |
| GAP-10 Validators attributs Claude                               | ✅ V1                                               | —                                       |
| GAP-11 Console admin 15 sous-pages                               | ✅ V1                                               | —                                       |
| GAP-12 Schema.org @graph chaining                                | ✅ V1                                               | —                                       |
| GAP-13 E-E-A-T Person schema photographe                         | ✅ V1 minimal (Organization sameAs étendu)          | 🟡 V1.5 (Person équipe full)            |
| GAP-14 Wikidata Q-id reconciliation                              | 🟡 Code prêt — entrée à créer manuellement par Will | —                                       |
| GAP-15 Internal linking strategy                                 | ✅ V1                                               | —                                       |
| GAP-16 viewport-fit + max-image-preview:large + dual theme-color | ✅ V1                                               | —                                       |
| GAP-17 Hiérarchie H1/H2/H3                                       | ✅ V1                                               | —                                       |
| GAP-18 Pinterest/LinkedIn/Facebook rich tags                     | ✅ V1                                               | —                                       |
| GAP-19 pHash perceptual hash                                     | —                                                   | 🟡 V1.5 (P2)                            |
| GAP-20 Prompts Claude figés + tests régression                   | ✅ V1                                               | —                                       |
| GAP-06 security.txt                                              | ✅ V1 (trivial)                                     | —                                       |
| GAP-06 llms.txt enrichi image-bank                               | ✅ V1                                               | —                                       |
| GAP-07 JPEG XL                                                   | —                                                   | 🟡 V1.5 (browser support marginal 2026) |
| GAP-07 Cloudflare Polish/Mirage                                  | —                                                   | 🟡 V1.5 (action Will dashboard)         |
| GAP-08 Dashboard ROI AEO/GEO                                     | —                                                   | 🟡 V1.5 (P1 reportable)                 |
| AVIF effort 9 worker async                                       | —                                                   | 🟡 V1.1                                 |
| IPTC/XMP namespace custom `XMP-axionia:*`                        | —                                                   | 🟡 V1.1                                 |
| Naver crawler                                                    | —                                                   | 🟡 V1.5 si cible client Corée           |

**Justification** : tous les P0 + majorité des P1 sont V1. Les V1.5 sont (a) marginaux pour CTR/perfection (b) dépendent action humaine externe (Wikidata, CF Polish).

**Réversible** : trivial — chaque feature est un module indépendant.

## Décision #6 — Source des images = uploads humains (clarification Will 2026-05-16)

**Question implicite** : la pipeline image-bank doit-elle inclure un générateur d'images IA (GPT-image, Midjourney, DALL-E) ou exclusivement gérer des uploads humains ?

**Décision** : ✅ **V1 + V1.5 = uploads humains exclusivement** (Will fournit les images via admin UI ou bulk-import CSV).

**Justification** :

- Confirmé par Will : « les images ne seront pas à créer mais c'est moi qui donnerait les images »
- Pas d'intégration API génération (économie ~5-10h dev + ~$100-300/mois budget API)
- Pas de logique "AI-generated upload" particulière en V1 — la colonne `isAiGenerated: boolean` + `aiModel: string?` reste utile : Will marque manuellement par image si elle vient d'une IA (Midjourney/Dall-E/etc.) pour émettre `JSON-LD ImageObject.isBasedOn: SoftwareApplication`. Transparence Google 2026 préservée.

**Workflow attendu V1** :

1. Will uploade N images via `/admin/image-bank/upload` (drag&drop) ou bulk-import CSV
2. Pipeline sync génère variants Sharp (thumb/sm/md/lg/xl webp + md/lg avif + og.webp + square.webp + LQIP)
3. Worker async `image-bank-enrich` : auto-translate FR↔EN (Claude vision), auto-`aiSummary` (1 phrase AEO ≤280 char), auto-détecte module/subModule/targetCity (taxonomy detector + fallback Claude), recalcule seoScore
4. Will valide + édite manuellement (taxonomy fine, persona, secteur, techno, photographe) → publish
5. Image apparaît galerie publique + sitemap-images.xml + IndexNow ping Bing/Yandex

**Impact estimation effort** : aucun changement (255-400h restent dus). Le pipeline était déjà conçu pour uploads humains — la spec « génération AI auto » n'a jamais été dans le scope V1.

**Réversible** : oui — ajout futur d'un générateur IA possible en V2 sans toucher la pipeline existante.

**Alignement skill v1.1** : cette décision #6 répond directement au **STOP & ASK officiel #5 du SKILL v1.1** (`.claude/skills/axionia-image-bank/SKILL.md` ligne 41 : « AI-generated images autorisées + tag `sourceType: 'ai_generated'` »). Cohérence vérifiée — pas d'override nécessaire.

## Sommaire décisions

5 défauts pris en autopilote, tous **réversibles** sans coût élevé. Tracés ici pour audit ultérieur Will. Si une décision est à infirmer : éditer ce fichier + ouvrir une issue/ADR dédiée.
