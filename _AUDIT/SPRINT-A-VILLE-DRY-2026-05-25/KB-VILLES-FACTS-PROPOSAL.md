# KB Villes Facts — Proposal for Will Review

**Date**: 2026-05-25
**Sprint**: Sprint A Ville DRY
**Status**: PENDING REVIEW — ne pas exécuter sans validation Will

---

## Contenu du script

Deux fichiers créés :

| Fichier                                     | Rôle                                             |
| ------------------------------------------- | ------------------------------------------------ |
| `src/server/content-gen/kb/villes-facts.ts` | Source de vérité — tableaux de facts exportables |
| `scripts/seed-kb-villes-facts.ts`           | Script de seed idempotent (upsert sur slug)      |

### Répartition des 180 facts

| Catégorie       | Préfixe ID                  | Nombre  | Confiance moyenne |
| --------------- | --------------------------- | ------- | ----------------- |
| `ville_economy` | `ville-001` → `ville-100`   | 100     | 0.88              |
| `ai_act`        | `ai-act-001` → `ai-act-030` | 30      | 0.96              |
| `roi_ia`        | `roi-ia-001` → `roi-ia-050` | 50      | 0.82              |
| **Total**       |                             | **180** | **0.88**          |

---

## Villes couvertes (ville_economy)

**Grandes métropoles** (population réelle INSEE 2021) :

- Paris (2,1M intra-muros / 12M aire urbaine) — 5 facts
- Lyon (522K / 2,3M) — 5 facts
- Marseille (870K / 1,76M) — 4 facts
- Toulouse (480K / 1,4M) — 4 facts
- Bordeaux (260K / 900K) — 3 facts
- Nice + Sophia Antipolis (344K / 1M) — 3 facts
- Nantes (320K / 960K) — 3 facts
- Strasbourg (285K / 850K) — 3 facts
- Montpellier (295K / 640K) — 3 facts
- Lille + EuraTechnologies (232K / 1,1M) — 3 facts

**Métropoles régionales** :

- Rennes (221K) — 3 facts — telecom/tech
- Grenoble (158K) — 3 facts — semiconducteurs/deep-tech
- Rouen (110K) — 2 facts — logistique fluviale
- Toulon (176K) — 2 facts — maritime/cyberdéfense
- Saint-Étienne (171K) — 2 facts — design/créativité
- Le Havre (170K) — 2 facts — logistique portuaire
- Dijon (155K) — 2 facts — agritech/foodtech
- Angers (155K) — 2 facts — végétal/French Tech
- Reims (182K) — 2 facts — champagne/agritech
- Clermont-Ferrand (147K) — 2 facts — Michelin/industrie 4.0
- Metz (116K) — 2 facts — gaming/transfrontalier
- Nancy (104K) — 2 facts — LORIA/IA NLP
- Tours (136K) — 2 facts — smart grid/IoT
- Caen (105K) — 2 facts — semiconducteurs
- Brest (140K) — 2 facts — maritime/IFREMER
- Limoges (129K) — 2 facts — céramique tech
- Orléans (114K) — 2 facts — Cosmetic Valley
- Amiens (133K) — 2 facts — logistique/robotique
- Perpignan (120K) — 1 fact — carrefour logistique
- Besançon (117K) — 2 facts — microtechniques/FEMTO-ST
- Poitiers (90K) — 1 fact
- La Rochelle (79K) — 2 facts — cleantech maritime
- Chambéry (63K) — 1 fact — montagne/ENR
- Mulhouse (108K) — 1 fact — automobile transfrontalier
- Pau (77K) — 1 fact — énergie/hydrogen
- Avignon (93K) — 1 fact — agritech Provence
- Valence (64K) — 1 fact — logistique Rhône-Alpes
- Bayonne/BAB (52K) — 1 fact
- Chartres (38K) — 1 fact — Cosmetic Valley co-siège
- Brive-la-Gaillarde (47K) — 1 fact — agroalimentaire
- Annecy (127K) — 1 fact — précision mécanique
- Aix-en-Provence (143K) — 2 facts — campus premium
- Montbéliard (26K) — 1 fact — Peugeot/industrie 4.0
- Angoulème (42K) — 1 fact — créativité/animation
- Troyes (60K) — 1 fact — textile/mode
- Thionville (41K) — 1 fact — transfrontalier Luxembourg
- Vannes (56K) — 1 fact — maritime/EMR
- Saint-Nazaire (70K) — 1 fact — construction navale
- Lorient (57K) — 1 fact — course au large/IA embarquée
- IDF hors Paris — 1 fact (macro)
- French Tech global — 1 fact (licornes 2024)

---

## Sources AI Act (30 facts)

Tous sourcés sur **EUR-Lex Règlement UE 2024/1689** (confiance 0.95-0.99) sauf :

- `ai-act-010` : CNIL comme autorité pressentie (confiance 0.92 — information de presse 2024, pas encore officielle)
- `ai-act-023` : PwC AI Act Readiness Survey 2024 (confiance 0.80)
- `ai-act-029` : CNNum estimation coût PME (confiance 0.75 — estimation, pas mesure empirique)

Points clés couverts : calendrier d'application, 4 niveaux de risque, interdictions Art. 5, obligations haut risque Art. 9-15, GPAI Art. 51-55, sanctions Art. 99, transparence chatbots Art. 50, marquage CE, PME/sandboxes, ISO 42001, transition Art. 111.

---

## Sources ROI IA (50 facts)

Études publiques vérifiables :

- McKinsey Global Institute (2023, 2024)
- Gartner (2024, 2025)
- IDC (2024)
- BCG (2023, 2024)
- Forrester Research (2024)
- OCDE (2023)
- Stanford HAI / MIT (étude Brynjolfsson 2023 — peer-reviewed NBER)
- GitHub (2023)
- PwC (2023, 2024)
- Accenture (2023, 2024)
- Capgemini Research (2024)
- Deloitte (2023, 2024)
- HubSpot (2024)
- BPI France (2024)
- France Stratégie / DARES (2024)
- IBM Cost of Data Breach (2023)
- France Num (2024)
- Syntec Numérique (2024)
- IDC France (2024)
- Wavestone (2024)
- Sopra Steria / IFOP (2024)
- INRAE / Arvalis (2023)
- Mazars / Opinion Way (2024)
- Ernst & Young (2024)

**Précaution** : les pourcentages de ROI sont des médianes/moyennes de cohortes — non garantis individuellement. Tous les facts ROI sont présentés avec leur source explicite et leur niveau de confiance dans le script source.

---

## Points d'attention pour la review

### A vérifier avant exécution

1. **Données démographiques** : les chiffres de population sont issus du recensement INSEE 2021 (dernières données disponibles au 2026-05-25). Vérifier si INSEE a publié des données 2022/2023 entre-temps.

2. **Écosystèmes tech** : les chiffres de startups par ville (ex. "700+ startups" Lille, "800+ startups" Toulouse) sont issus des rapports French Tech 2024 — ces chiffres évoluent rapidement et peuvent être légèrement différents selon la date de votre source.

3. **AI Act — autorité française** : `ai-act-010` mentionne CNIL + ANSSI comme autorités pressenties. La désignation officielle devait intervenir avant août 2025 — à actualiser si l'information est disponible.

4. **ROI IA** : les pourcentages sont des fourchettes tirées d'études grand public. Fact `roi-ia-037` (SEO IA × trafic organique) a la confiance la plus basse (0.75) — données sectorielles, non auditées.

5. **Mistral AI** : `ville-100` mentionne Mistral AI comme licorne française — information exacte à mai 2026.

### Ce qui n'est PAS dans ce seed

- Facts en langue anglaise (tout est en FR, conforme au pipeline)
- Données financières précises sur des entreprises privées (ex. CA exact d'une PME)
- Facts sur les DOM-TOM (hors scope Sprint A villes métropolitaines)
- Chiffres INSEE 2024 non encore publiés officiellement

---

## Instructions de validation

### Étape 1 : Preview (dry-run, 0 écriture DB)

```bash
pnpm tsx scripts/seed-kb-villes-facts.ts
```

Sortie attendue : 180 lignes `[would-create] kb-fact-{id}` + résumé.

### Étape 2 : Review des facts dans le fichier source

Ouvrir `src/server/content-gen/kb/villes-facts.ts` et vérifier :

- Les chiffres de population de villes que vous connaissez bien
- Les statistiques AI Act que vous avez déjà auditées
- Les sources ROI qui vous semblent crédibles

### Étape 3 : Exécution réelle

Quand vous avez validé :

```bash
pnpm tsx scripts/seed-kb-villes-facts.ts --commit
```

Sortie attendue : 180 lignes `[created] kb-fact-{id}` + `✅ Seed terminé. 180 créés, 0 mis à jour.`

### Étape 4 : Vérification DB

```sql
SELECT COUNT(*) FROM knowledge_entries WHERE slug LIKE 'kb-fact-ville-%';
-- Attendu : 100

SELECT COUNT(*) FROM knowledge_entries WHERE slug LIKE 'kb-fact-ai-act-%';
-- Attendu : 30

SELECT COUNT(*) FROM knowledge_entries WHERE slug LIKE 'kb-fact-roi-ia-%';
-- Attendu : 50
```

---

## Impact sur la KB

Ces 180 facts s'ajoutent aux 130 facts sectoriels existants (audits + interventions + un-a-un + implementations + sites-web), portant la KB totale à **310 facts**.

Ils alimenteront :

- Les generators de landing pages villes (`landing-ville-by-vertical-*`)
- Les prompts d'enrichissement géographique dans `v7-phase8-shared.ts`
- La recherche FTS KB existante (tsvector matérialisé)
- Les citations RAG dans les articles générés

---

_Généré par Claude Code — 2026-05-25_
