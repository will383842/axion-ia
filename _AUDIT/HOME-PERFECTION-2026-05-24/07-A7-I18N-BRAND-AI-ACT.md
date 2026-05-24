# A7 — i18n + Brand voice + AI Act | Score 82/100

## Scoring

| #   | Sous-dim                   | Score | Verdict                                                                                            | path:line                                                                                                                            |
| --- | -------------------------- | ----- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | i18n keys coverage         | 95    | FR 210 clés, EN 210 clés. Parité parfaite ✓                                                        | messages/fr.json:43-253, messages/en.json:43-253                                                                                     |
| 2   | i18n keys organization     | 88    | Namespace home.\* cohérent, ~50 clés orphelines, sub-namespace absent                              | fr.json (vs page.tsx)                                                                                                                |
| 3   | Strings hardcodées         | 75    | **30 ternaires `isFr ? "..." : "..."` inline** au lieu de `t()` — anti-pattern                     | page.tsx:395,402,666,669,674,760,797,901-913,933-942,1126-1134,1235,1285-1290,1442,1449,1602,1614,1727,1730,1735,1839,1850,1857,1864 |
| 4   | Brand voice Manon          | 85    | Ton personnel cohérent "On intervient", "Vous choisissez", direct ; hardcodées sans persona claire | page.tsx hero/founder/método                                                                                                         |
| 5   | 5 verticales canoniques    | 100   | ✓ Toutes 5 présentes (Formations/Audit/Coaching/Implémentation/Plateforme)                         | page.tsx:133-189, fr.json:60,67,74,157,164                                                                                           |
| 6   | Couleurs hiérarchie        | 92    | Terracotta dominante CTAs primaires ✓, bleu en accent 1/5 cartes seulement, pas d'inversion        | page.tsx:204-212,1301                                                                                                                |
| 7   | No `<table>` rule          | 100   | ✓ Zéro `<table>` HTML détecté                                                                      | page.tsx (grep `<table>`)                                                                                                            |
| 8   | AI Act dateModified        | 100   | ✓ BUILD_DATE injecté via env NEXT_PUBLIC_BUILD_TIME fallback                                       | seo.ts:27-47                                                                                                                         |
| 9   | AI Act aiGenerated markers | 100   | ✓ Home = éditorial humain, pas marquée. Cohérent                                                   | AiContentDisclaimer.tsx, page.tsx (aucun marqueur)                                                                                   |
| 10  | AI Act disclaimer          | 100   | ✓ ABSENT sur home (correct, contenu éditorial). Présent /blog /actualites /centre-aide /guides     | AiContentDisclaimer.tsx (routes)                                                                                                     |

## i18n inventory

**Total clés home.\*** : FR 210 / EN 210 (parité 100%)

**Orphelines (~50 clés définies non utilisées)** :

- comparisonCol* (4) + comparisonRow1-6* (18)
- casesDescription/TitlePart\*/TitleEm
- modulesDescription/TitlePart\*, module1-3Description/Cta
- methodTitlePart\*/Description, method1-4Title/Description
- roiTitlePart\*/Description/Cta
- videosEyebrow/TitlePart\*/Description
- ctaBlockMicroProofs/Eyebrow/TitlePart\*/Description/Primary/Secondary

Ces clés ont été pré-localisées (Manon persona) mais les sections sont masquées ou pas intégrées au JSX de la version 2026-05-23.

**Hardcodées FR-only inline (30 ternaires `isFr ? "FR" : "EN"`)** — sections critiques non-i18n :

- L395, 402 : CTAs hero ("Réserver un appel", "Nous contacter")
- L666, 669-674 : "Tarifs transparents", "Trois niveaux..."
- L760, 797 : "Sur devis", "Le plus choisi"
- L901-913 : FAQ pas sûr (bloc pricing)
- L933-942 : "Ce qui nous distingue / Six raisons concrètes"
- L1126-1134 : "Modulaire par design"
- L1235 : "votre réussite"
- L1285-1290 : "Des implémentations sur mesure"
- L1442-1449 : CTAs finals
- L1602, 1614 : "Note 5 étoiles / Vérifié"
- L1727-1735 : "Démarrer / Choisissez..."
- L1839 : "Découvrir"
- L1850-1864 : "Vous hésitez ? / Réserver / Contacter"

## Brand voice analysis

**Manifesto** :

> "On intervient", "Vous choisissez", "Sans intermédiaire, sans compromis"

**Hero proof** :

> "100 % seniors — aucun junior · Résultats mesurables"

**Founder tagline** :

> "Transparence totale. Du premier échange au déploiement."

✓ Persona Manon cohérente — voix agentive, directe, concrète. **MAIS** asymétrie entre FR éditorialisé et EN hardcodé simple → risque refactor/erreur futur.

## 5 verticales check

| #   | Verticale                     | Présence | Ordre page.tsx              |
| --- | ----------------------------- | -------- | --------------------------- |
| 1   | Formations & interventions IA | ✓        | value1Action                |
| 2   | Coaching IA 1 to 1            | ✓        | value4Action (réordonné #2) |
| 3   | Audits IA                     | ✓        | value2Action (#3)           |
| 4   | Implémentations IA            | ✓        | value3Action (#4)           |
| 5   | Sites web augmentés IA        | ✓        | value5Action (#5)           |

**Manquantes** : Aucune ✓

## Couleurs hiérarchie

**CTAs primaires** : Hero `bg-terracotta` ✓ + Pricing `bg-terracotta`/`bg-fg` ✓ + Final CTA `bg-terracotta` ✓

**Bleu `#1a4dd9`** strictement limité à pointes :

- Value card #2 Coaching : accent terracotta
- Value card #5 Web : accent primary
- Why card #3 Partout en France : `bandClass: "bg-primary"`
- CTA footer : `text-primary` (lien découvrir)

**Verdict** : Hiérarchie terracotta > sage > primary respectée. Pas d'inversion. ✓

## Forces (top 3)

1. **Parité i18n parfaite** (210 FR = 210 EN) — zéro manquantes EN, SSOT pricing injecté dynamique
2. **5 verticales canoniques** réaffirmées + ordre cohérent (Blueprint 2026)
3. **Couleurs hiérarchie strictement appliquée** — terracotta dominante, bleu pointes

## P0

**Conformité AI Act 2026-08-02** : `dateModified` ✓ via BUILD_DATE, MAIS `aiGenerated: false` non émis explicitement dans JSON-LD. Recommandé pour transparence LLM-facing — 1h

## P1

1. **30 ternaires `isFr ? "..." : "..."` inline** → migrer vers `t()` — bloquant si réactivation EN_LOCALE_ENABLED=true — 3-4h
2. **~50 clés orphelines** (comparison/modules/videos/ROI) — audit décisions Will : intégrer OU supprimer — 2h
3. AI Act `aiGenerated: false` explicite JSON-LD — 1h

## P2

1. Sub-namespaces i18n manquants (`home.hero.*`, `home.manifesto.*` au lieu de flat) — restructure 2-3h, non urgent si stable
2. EN locale 301 redirect — re-tester si EN réactivé

## Résumé conformité AI Act

| Marqueur             | Présent            | Conforme     | Note                         |
| -------------------- | ------------------ | ------------ | ---------------------------- |
| dateModified         | ✓ (BUILD_DATE)     | ✓ 2026-05-24 | seo.ts:47                    |
| aiGenerated          | ✗ (home éditorial) | ~ acceptable | Recommandé `false` explicite |
| Disclaimer visuel    | ✗ (intentionnel)   | ✓            | Home ≠ contenu IA            |
| Transparence persona | ✓ (Manon)          | ✓            | Charte éditoriale alignée    |

**Verdict AI Act** : Conforme spirit (transparence + contenu humain-first), recommandation : ajouter `"aiGenerated": false` explicite en JSON-LD pour lever ambiguïté LLMs/SGE.

## Tone check

**Hero** :

> "On intervient dans votre entreprise. On vous fait gagner du temps et de l'argent avec l'IA. On identifie tout ce que l'IA peut faire pour vous — automatiser, accélérer, rentabiliser. Puis on l'implémente avec nos experts seniors."

✓ Manon voice (agentive "On", concret, sans jargon, action-first)

**Founder** :

> "On ne promet pas l'excellence. On la livre. Sans intermédiaire, sans compromis — nos experts déploient l'IA dans vos process avec la même rigueur, que vous soyez une TPE artisanale ou une ETI cotée. Transparence totale. Du premier échange au déploiement."

✓ Persona cohérente, crédibilité renforcée chiffres (Top 1% / 0 intermédiaires / TPE → CAC40)
