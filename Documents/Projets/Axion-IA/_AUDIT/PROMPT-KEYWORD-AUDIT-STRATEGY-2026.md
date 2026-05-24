---
name: PROMPT-KEYWORD-AUDIT-STRATEGY-2026
version: 2.0 (AUTOPILOT COMPLET — zéro interruption humaine)
date: 2026-05-19
owner: Will (Axion-IA OÜ)
mode: AUTOPILOT STRICT — lecture + écriture _AUDIT/ uniquement — jamais de pause
target_score: /1600 (16 agents × 100) + verdict 🔴🟠🟡🟢
estimated_duration: 16-24 h autopilote parallèle
output_dir: _AUDIT/KEYWORD-STRATEGY-AUDIT-2026/
deliverables: 26 fichiers minimum
outils_autorises: Read | Glob | Grep | Bash | WebFetch | WebSearch | Write | Agent
contrainte_absolue: ZÉRO outil payant — ZÉRO pause — ZÉRO question à Will pendant l'exécution
---

# PROMPT MASTER v2.0 — KEYWORD AUDIT STRATEGY — AXION-IA NUMÉRO 1 FRANCE

---

## DIRECTIVE AUTOPILOT — LIRE EN PREMIER

**Ce prompt s'exécute du début à la fin sans aucune interruption.**

Règles absolues d'exécution :
1. Lance les 16 sous-agents **en parallèle** dans un seul message multi-tool_use dès la lecture terminée
2. Chaque agent **écrit son fichier** sans jamais poser de question
3. Si une information est manquante → noter `UNKNOWN` dans le fichier + continuer
4. Si un outil externe est inaccessible → décrire ce qui aurait été trouvé + continuer
5. Les STOP & ASK sont du **contenu écrit dans `03-STOP-AND-ASK-WILL.md`**, jamais des pauses runtime
6. L'orchestrateur attend que tous les agents finissent, puis écrit les 10 fichiers de synthèse
7. **Dernier message** : présenter le score /1600, le verdict, et lister `03-STOP-AND-ASK-WILL.md`

---

## 0. RÔLE & POSTURE

Tu es **Keyword Strategy Auditor + SEO/AEO/GEO Analyst + Competitive Intelligence Specialist** d'Axion-IA OÜ. Tu produis le diagnostic complet de la stratégie de mots-clés et la roadmap pour devenir **n°1 en France sur tous les marchés**.

Tu raisonnes en vérités vérifiables : chaque affirmation cite `fichier:ligne`, URL, ou commande Bash reproductible. Donnée impossible à obtenir en autopilote → `UNKNOWN — [méthode pour résoudre manuellement]`. Jamais d'invention.

---

## 1. CONTEXTE AXION-IA (figé)

### 1.1 Les 6 services

```
interventions-formations  390€      formation équipes sur site
coaching-1-to-1           990€      coaching individuel dirigeants
audit                     490€      diagnostic IA entreprise
implementation            990€      déploiement IA sur mesure
codage-developpement       devis     solutions techniques custom
maintenance-ia            290€/mois accompagnement continu
```

### 1.2 Les 19 audiences (clients + partenaires + spéciales)

```
CLIENTS DIRECTS (12) :
tpe | pme | eti | grand-compte | ecole-privee | organisme-formation
universite-grande-ecole | association-professionnelle | collectivite-mairie
cci-chambre-metiers | syndicat-patronal | startup-scaleup

PARTENAIRES (3) :
sous-traitant-dev (visibilité DISCRÈTE — jamais depuis nav principale)
partenaire-commercial | prescripteur

AUDIENCES SPÉCIALES (4) :
presse-medias | investisseurs (NOINDEX obligatoire) | recrutement-interne
partenaires-tech (Anthropic, Microsoft, Make, n8n)
```

### 1.3 Les 13 dimensions sémantiques

```
D1  TRANSACTIONNEL   : "devis", "tarif", "cabinet", "prestataire"
D2  BÉNÉFICE/ROI     : "gagner 5h/sem", "réduire 40% coûts" ← DIFFÉRENCIATEUR CLÉ
D3  INFORMATIONNEL   : "comment", "guide", "pourquoi"
D4  AEO/QUESTIONS    : questions naturelles + "?" → featured snippets
D5  COMPARATIF       : "vs", "alternative", "meilleur"
D6  LOCAL            : [ville] + service → pSEO 2 157 villes
D7  PARTENAIRE       : "mission", "rejoindre", "sous-traitant"
D8  SECTORIEL        : "IA pour [secteur]", 35 secteurs
D9  NOTORIÉTÉ/BRAND  : "Axion-IA avis", "meilleur cabinet IA France"
D10 THOUGHT LEADER   : stats citables, tendances, études
D11 GEO IA GÉNÉRATIF : formaté pour citations ChatGPT/Perplexity/Claude/Gemini
D12 PRESSE/MÉDIAS    : "expert IA à interviewer", "conférencier IA France"
D13 POSITIONNEMENTS  : "n°1 France", "opérationnel 4 sem", "Made in France"
```

### 1.4 Les 35 secteurs (source réelle : `src/content/knowledge/sector-tags.ts`)

```
TERTIAIRE    : conseil-affaires | banque-finance | assurance | immobilier-pro
               it-numerique | cybersecurite | communication-medias
INDUSTRIE    : industrie-manufacturiere | mecanique-precision | chimie-pharma
               aerospatial-defense | automobile-mobilite | construction-btp
               energie-cleantech | maritime-portuaire
SANTÉ        : sante-biotech | dispositifs-medicaux
AGRO         : agroalimentaire-igp | viticulture-haut-de-gamme | agriculture-elevage
COMMERCE     : retail-e-commerce | logistique-supply-chain | distribution-grande-conso
MODE & LUXE  : mode-luxe-maroquinerie | cosmetique-beaute
CULTURE      : tourisme-affaires | arts-creatif-design
PUBLIC       : enseignement-recherche | administration-publique
```

### 1.5 Infrastructure existante (vérifier avant d'auditer)

```
ACTIF :
src/lib/seo.ts                    18 factories JSON-LD
src/app/llms.txt/route.ts         export KB vers IA génératives
src/app/ai.txt/route.ts           politique crawlers IA
src/app/.well-known/ai-policy.json
src/server/queue/workers/content-keyword-sync-worker.ts   GSC monitoring hebdo
prisma/schema.prisma → KeywordTracking                    positions GSC
src/content/knowledge/sector-tags.ts                      35 secteurs
pSEO : 2 157 villes × 4 services = ~12 942 pages SSG

SQUELETTE (pas implémenté) :
src/server/content-gen/generators/blog-from-keywords.ts   délègue à landingVille

ABSENT (gaps confirmés) :
/fr/coaching-1-to-1/     routes villes
/fr/secteurs/[slug]      pages dédiées
/fr/presse/              kit médias
/fr/partenaires/         hub partenaires
/fr/carrieres/           recrutement
Page investisseurs        (doit être noindex)
```

---

## 2. RÈGLES D'EXÉCUTION AUTOPILOTE

```
✅ Lire le code avec Read/Glob/Grep
✅ Chercher sur le web avec WebSearch (concurrent analysis, SERP check)
✅ Récupérer des pages avec WebFetch (HTML concurrent, source analysis)
✅ Exécuter des commandes avec Bash (grep patterns, comptages)
✅ Écrire les rapports avec Write dans _AUDIT/KEYWORD-STRATEGY-AUDIT-2026/
✅ Lancer des sous-agents avec Agent (subagent_type: "Explore" pour lecture seule)

❌ Jamais de pause pour question
❌ Jamais d'outil payant (Ahrefs, Semrush, Moz Pro)
❌ Jamais de modification du code source
❌ Jamais d'écriture hors de _AUDIT/KEYWORD-STRATEGY-AUDIT-2026/
```

**Pour la recherche concurrentielle :** utiliser `WebSearch` avec les requêtes exactes
(ex: `WebSearch("cabinet IA France site:fr")`) puis `WebFetch` sur les URLs trouvées pour lire leur HTML.

**Pour les données GSC :** lire la structure `KeywordTracking` dans `prisma/schema.prisma` et les patterns dans `content-keyword-sync-worker.ts`. Les données réelles sont en DB — noter `REQUIRES_DB_QUERY` si besoin de requête SQL directe.

---

## 3. LES 16 SOUS-AGENTS — LANCER EN PARALLÈLE

---

### A1 — ÉTAT ACTUEL DES MOTS-CLÉS
**Fichier de sortie :** `A1-ETAT-ACTUEL-KEYWORDS.md`

Lire :
- `axionia/src/lib/seo.ts` — patterns title/description dans toutes les factories
- `axionia/src/server/content-gen/generators/landing-ville-templates.ts` — H1/H2 templates
- `axionia/src/content/villes/copy/paris.ts` — gold standard ville
- `axionia/src/content/pricing.ts` — libellés exacts offres
- `axionia/src/messages/fr.json` — libellés navigation et CTAs

Bash :
```bash
grep -r "title\|description\|keywords" axionia/src/lib/seo.ts | head -80
grep -r "h1\|H1" axionia/src/server/content-gen/generators/ --include="*.ts" | head -40
```

Produire :
- Inventaire patterns H1 actuels par service (génériques ou bénéfices ?)
- Inventaire meta titles actuels par template
- Score couverture D1-D13 actuelle (0-10 chacune)
- Score global `/100`

---

### A2 — ANALYSE CONCURRENTIELLE
**Fichier de sortie :** `A2-ANALYSE-CONCURRENTIELLE.md`

WebSearch sur ces 8 requêtes (une par une) :
```
"cabinet IA France"
"consultant IA PME"
"formation IA entreprise"
"audit IA entreprise"
"implémentation IA PME"
"expert IA B2B France"
"cabinet IA Paris"
"automatisation IA PME France"
```

Pour chaque requête : noter les 3 premiers domaines qui apparaissent.
WebFetch sur les 3 concurrents les plus récurrents → lire `<title>`, `<h1>`, `<h2>`, `<meta description>`.

Bash sur le code Axion-IA pour comparaison :
```bash
grep -r "concurrent\|competitor" axionia/src/ --include="*.ts" -l
```

Produire :
- Top 5 concurrents identifiés + leur stratégie keyword résumée
- Tableau : concurrent × mots-clés gagnés × gap Axion-IA
- Opportunités : mots où ils sont faibles (p.5-15) et nous pouvons attaquer
- Score `/100`

---

### A3 — GAPS CLIENTS DIRECTS
**Fichier de sortie :** `A3-GAPS-CLIENTS-DIRECTS.md`

Bash :
```bash
find axionia/src/app -type d -name "tpe" -o -name "pme" -o -name "eti" 2>/dev/null
grep -r "tpe\|pme\|eti\|grand.compte" axionia/src/content/ --include="*.ts" -l
grep -r "artisan\|indépendant\|TPE" axionia/src/content/ --include="*.ts" | head -20
```

Glob : `axionia/src/app/**/*tpe*` `axionia/src/app/**/*pme*` `axionia/src/app/**/*eti*`

WebSearch : `"formation IA TPE" site:axion-ia.com` → pages indexées Google

Produire :
- Matrice : cible (4 tailles) × service (6) × page existante (✅/❌)
- Top 20 mots-clés manquants priorité 1 par cible
- Score `/100`

---

### A4 — GAPS AUDIENCES SECONDAIRES
**Fichier de sortie :** `A4-GAPS-AUDIENCES-SECONDAIRES.md`

Bash :
```bash
grep -r "ecole\|école\|université\|association\|mairie\|collectivite\|cci\|chambre" \
  axionia/src/content/ --include="*.ts" -l
grep -r "ecole\|école\|université\|association\|mairie" \
  axionia/src/messages/ --include="*.json" | head -30
```

Glob : `axionia/src/app/**/ecole*` `axionia/src/app/**/association*` `axionia/src/app/**/mairie*`

WebSearch : `"formation IA association" site:axion-ia.com`

Produire :
- État par audience (absent / partiel / complet)
- Top 15 mots-clés manquants par audience
- Effort création pages dédiées (estimation jours)
- Score `/100`

---

### A5 — GAPS PARTENAIRES & AUDIENCES SPÉCIALES
**Fichier de sortie :** `A5-GAPS-PARTENAIRES-AUDIENCES-SPECIALES.md`

Bash :
```bash
find axionia/src/app -type d -name "partenaires" -o -name "presse" -o -name "carrieres" \
  -o -name "investisseurs" -o -name "missions-freelance" 2>/dev/null
grep -r "partenaire\|presse\|carrieres\|investisseur\|freelance\|sous-traitant" \
  axionia/src/messages/ --include="*.json" | head -30
grep -r "noindex" axionia/src/ --include="*.tsx" --include="*.ts" | grep -i "invest\|partenaire" | head -10
```

Produire :
- État de chaque audience partenaire (absent / partiel / complet)
- Matrice visibilité recommandée vs état actuel :

```
presse-medias        → INDEX PLEIN    (journalistes cherchent)
investisseurs        → NOINDEX        (confidentiel — jamais indexé)
recrutement-interne  → INDEX NORMAL   (candidats cherchent)
sous-traitant-dev    → INDEX DISCRET  (pas lié depuis nav principale)
partenaire-commercial → INDEX PLEIN
prescripteur         → INDEX PLEIN
```
- Score `/100`

---

### A6 — AUDIT BÉNÉFICES & ROI
**Fichier de sortie :** `A6-AUDIT-BENEFICES-ROI.md`

Bash :
```bash
grep -rn "gagner\|économiser\|réduire\|heures\|minutes\|ROI\|résultats\|%\|€" \
  axionia/src/content/ --include="*.ts" | grep -v "//\|import\|type\|interface" | head -50
grep -rn "h1\|H1" axionia/src/server/content-gen/generators/ --include="*.ts" | head -30
grep -rn "chiffre\|mesur\|concret\|prouvé" axionia/src/content/ --include="*.ts" | head -20
```

Lire `axionia/src/content/villes/copy/paris.ts` → les bénéfices chiffrés sont-ils dans les pitchs ?

WebSearch : `"gagner heures IA PME" site:axion-ia.com` → pages avec bénéfices indexées ?

Principe clé à vérifier :
```
Concurrents : "formation IA entreprise"      → générique, concurrencé
Axion-IA    : "gagner 5h/semaine avec l'IA"  → unique, convertit mieux
```

Produire :
- % pages de service avec au moins 1 chiffre bénéfice dans H1/H2
- Top 20 bénéfices chiffrés réalistes manquants (ex: "PME : 6h gagnées/sem sur facturation")
- Recommandation top 5 pages à enrichir en priorité
- Score `/100`

---

### A7 — AUDIT AEO (Featured Snippets / PAA / AI Overviews)
**Fichier de sortie :** `A7-AUDIT-AEO-FEATURED-SNIPPETS.md`

Bash :
```bash
grep -rn "buildFaqJsonLd\|buildFaqSpeakableJsonLd\|buildHowToJsonLd\|buildQAPageJsonLd\|FAQPage" \
  axionia/src/ --include="*.ts" --include="*.tsx" | head -30
grep -rn "faq\|FAQ" axionia/src/content/ --include="*.ts" -l
find axionia/src/app -name "*faq*" -type f
```

WebSearch : `"formation IA entreprise" → noter si featured snippet ou PAA visible dans les résultats`
WebSearch : `"audit IA PME" → PAA questions qui apparaissent`
WebSearch : `site:axion-ia.com faq` → pages FAQ indexées

Produire :
- Inventaire pages avec FAQPage schema actif (fichier:ligne)
- Top 30 questions AEO sans page de réponse dédiée (extraites des PAA Google via WebSearch)
- Potentiel featured snippets inexploités estimé
- Score `/100`

---

### A8 — AUDIT GEO (Citations IA Génératives)
**Fichier de sortie :** `A8-AUDIT-GEO-IA-GENERATIVES.md`

Lire :
- `axionia/src/app/llms.txt/route.ts` (complet)
- `axionia/src/app/llms-full.txt/route.ts` (complet)
- `axionia/src/app/ai.txt/route.ts` (complet)
- `axionia/src/server/exporters/knowledge-llms-txt.ts` (complet)
- `axionia/src/lib/seo.ts` → fonction `buildOrganizationJsonLd()` — champs `sameAs`, `description`

WebFetch : `https://axion-ia.com/llms.txt` → vérifier contenu réel exporté
WebFetch : `https://axion-ia.com/ai.txt` → politique crawlers

WebSearch : `"Axion-IA" cabinet IA France` → Axion-IA apparaît-elle dans les résultats de recherche classiques en position notable ?
WebSearch : `meilleur cabinet IA France` → Axion-IA apparaît-elle dans les résultats ?

Bash :
```bash
grep -n "sameAs\|wikidata\|wikipedia\|description\|legalName" axionia/src/lib/seo.ts | head -20
grep -rn "Dataset\|speakable\|isBasedOn\|mentions" axionia/src/lib/seo.ts | head -20
```

Produire :
- Contenu actuel de llms.txt : suffisant pour citations IA ? (volume, types de contenu)
- `buildOrganizationJsonLd()` : entité Axion-IA correctement définie ? `sameAs` Wikidata/LinkedIn ?
- 10 types de contenu "citable" manquants (stats, définitions, cas concrets)
- Score `/100`

---

### A9 — AUDIT LOCAL & pSEO (2 157 villes)
**Fichier de sortie :** `A9-AUDIT-LOCAL-PSEO-VILLES.md`

Bash :
```bash
find axionia/src/content/villes/copy -name "*.ts" | wc -l
find axionia/src/content/villes/copy -name "*.ts"
grep -rn "coaching\|1-to-1\|un-a-un" axionia/src/app -l --include="*.tsx" --include="*.ts" | head -10
grep -rn "par-ville\|landing-ville" axionia/src/app -l --include="*.tsx" | head -20
```

Lire `axionia/src/server/content-gen/generators/landing-ville.ts` (50 premières lignes)

WebFetch : `https://axion-ia.com/fr/par-ville/lyon/` → vérifier H1, meta, structure page ville
WebFetch : `https://axion-ia.com/fr/par-ville/paris/` → même vérification
WebSearch : `"cabinet IA Lyon" site:axion-ia.com` → pages locales indexées ?

Produire :
- N villes avec copy riche vs M villes template générique
- Gap coaching-1-to-1 : N pages manquantes × 2 157 villes
- H1 des templates villes : génériques ou bénéfices ?
- Score `/100`

---

### A10 — AUDIT SECTORIEL (35 secteurs)
**Fichier de sortie :** `A10-AUDIT-SECTORIEL-35-SECTEURS.md`

Bash :
```bash
find axionia/src/app -type d -name "secteurs"
find axionia/src/app -path "*/secteurs/*" -name "*.tsx"
grep -rn "btp\|juridique\|comptable\|sante\|industrie\|retail" \
  axionia/src/content/ --include="*.ts" -l
```

WebSearch : `site:axion-ia.com secteur` → pages sectorielles indexées ?
WebSearch : `"IA pour BTP France"` → qui rank ? Axion-IA présente ?
WebSearch : `"IA pour cabinet comptable France"` → qui rank ?
WebSearch : `"IA pour cabinet d'avocats France"` → qui rank ?

Produire :
- Matrice 35 secteurs × couverture actuelle (page dédiée ✅ / articles ⚠️ / absent ❌)
- Top 8 secteurs prioritaires par potentiel estimé
- Score `/100`

---

### A11 — AUDIT NOTORIÉTÉ & BRAND
**Fichier de sortie :** `A11-AUDIT-NOTORIETE-BRAND.md`

Bash :
```bash
grep -rn "sameAs\|wikidata\|wikipedia\|linkedin\|twitter" axionia/src/lib/seo.ts | head -20
find axionia/src/app -name "*temoignage*" -o -name "*avis*" -o -name "*cas-client*" | head -10
find axionia/src/content -name "*case-stud*" -o -name "*temoignage*" | head -10
grep -rn "cas.*client\|témoignage\|étude.*cas" axionia/src/content/ --include="*.ts" -l
```

WebSearch : `"Axion-IA" avis` → quels résultats ?
WebSearch : `"Axion-IA" presse` → mentions médias ?
WebSearch : `meilleur cabinet IA France 2026` → Axion-IA classée ?
WebFetch : `https://axion-ia.com/fr/` → Knowledge Panel dans la sidebar Google ?

Produire :
- État entité Google (Knowledge Graph reconnu ou non)
- Mentions presse trouvées
- Pages brand existantes vs manquantes
- Top 15 mots-clés brand/notoriété manquants
- Score `/100`

---

### A12 — AUDIT TECHNIQUE KEYWORDS
**Fichier de sortie :** `A12-AUDIT-TECHNIQUE-KEYWORDS.md`

Bash :
```bash
grep -n "title\|description" axionia/src/lib/seo.ts | grep "return\|=\s*['\`]" | head -40
grep -rn "generateMetadata\|metadata" axionia/src/app --include="*.tsx" -l | head -20
grep -rn "canonical\|robots\|noindex" axionia/src/app --include="*.tsx" --include="*.ts" | head -20
grep -rn "buildServiceJsonLd\|buildLocalBusinessJsonLd\|buildFaqJsonLd" \
  axionia/src/app --include="*.tsx" | head -30
```

WebFetch : `https://axion-ia.com/fr/audit/` → lire `<title>`, `<meta description>`, `<h1>`, JSON-LD
WebFetch : `https://axion-ia.com/fr/interventions-formations/` → même analyse

Checklist technique à cocher :
```
[ ] Title tags ≤60 chars avec keyword + différenciateur
[ ] Meta descriptions ≤155 chars avec bénéfice + CTA
[ ] H1 unique par page contenant keyword + bénéfice
[ ] URL patterns SEO-friendly
[ ] ServiceJsonLd sur toutes pages service
[ ] LocalBusinessJsonLd sur toutes pages villes
[ ] FAQPage schema sur pages avec FAQ
[ ] Internal linking avec anchor text keyword-rich
[ ] hreflang FR/EN cohérents
```

Produire :
- Checklist complète avec état (✅/❌/⚠️) par point
- Top 5 bugs techniques limitant le ranking
- Score `/100`

---

### A13 — POSITIONNEMENTS COMMUNICATION (6 angles)
**Fichier de sortie :** `A13-POSITIONNEMENTS-COMMUNICATION.md`

Bash :
```bash
grep -rn "4 semaines\|4 weeks\|rapide\|rapid" axionia/src/content/ --include="*.ts" | head -20
grep -rn "france\|français\|souverain\|local" axionia/src/content/ --include="*.ts" | head -20
grep -rn "Anthropic\|Claude API\|spécialiste" axionia/src/content/ --include="*.ts" | head -20
grep -rn "numéro\|n°1\|référence\|leader" axionia/src/content/ --include="*.ts" | head -20
grep -rn "accessible\|budget\|990\|abordable" axionia/src/content/ --include="*.ts" | head -20
grep -rn "ETI\|grand compte\|multi.site\|envergure" axionia/src/content/ --include="*.ts" | head -20
```

Les 6 positionnements à vérifier :
```
P1 "N°1 RÉFÉRENCE FRANCE"         → mots-clés présents dans H1/meta ?
P2 "OPÉRATIONNEL RAPIDE"          → "4 semaines", "1 mois", "rapidement" ?
P3 "ACCESSIBLE PETIT BUDGET"      → POC 990€, TPE, "premier projet IA" ?
P4 "GRANDS PROGRAMMES COMPLEXES"  → ETI, 25-80k€, multi-sites ?
P5 "MADE IN FRANCE / LOCAL"       → "cabinet français", "souverain" ?
P6 "SPÉCIALISTE ANTHROPIC/CLAUDE" → "Claude API", "Anthropic", intégrateur ?
```

Produire :
- Couverture des 6 positionnements (présent dans H1 / meta / body / absent)
- Mots-clés manquants par positionnement
- Score `/100`

---

### A14 — QUICK WINS IMMÉDIATS (P0)
**Fichier de sortie :** `A14-QUICK-WINS-P0-IMMEDIATS.md`

Bash :
```bash
grep -rn "title\|h1\|H1" axionia/src/server/content-gen/generators/landing-ville-templates.ts
grep -rn "Services IA\|Intelligence Artificielle\|IA en entreprise" \
  axionia/src/content/ --include="*.ts" | head -20
```

WebFetch sur 5 pages clés pour vérifier les H1 actuels :
```
https://axion-ia.com/fr/audit/
https://axion-ia.com/fr/interventions-formations/
https://axion-ia.com/fr/implementation/
https://axion-ia.com/fr/par-ville/paris/
https://axion-ia.com/fr/glossaire/
```

WebSearch : `"formation IA entreprise" → position actuelle Axion-IA dans les résultats`
WebSearch : `"audit IA PME" → position actuelle Axion-IA`
WebSearch : `"cabinet IA Paris" → position actuelle Axion-IA`

Produire :
- Top 20 quick wins classés par ratio impact/effort :
  - Action concrète (ex: "changer H1 /fr/audit/ de X en Y")
  - Effort estimé (ex: 30 min)
  - Gain attendu (ex: CTR +30%, position 4→1)
- Score `/100`

---

### A15 — ANALYSE KEYWORDS PAR TYPE DE CONTENU
**Fichier de sortie :** `A15-ANALYSE-KEYWORDS-TYPE-CONTENU.md`

Bash :
```bash
grep -rn "automation_recipe\|roi_calculator\|industry_use_case\|secteur_brief\|dept_brief\|metier_brief" \
  axionia/src/ --include="*.ts" | grep -v "types.ts\|import" | head -30
grep -rn "contentType\|kbType" axionia/src/server/content-gen/ --include="*.ts" | head -30
find axionia/src/content -name "*.ts" -not -name "types.ts" -not -name "index.ts" | head -30
```

Lire `axionia/src/content/knowledge/types.ts` (complet) → 28 KB types

Matrice à compléter :
```
KB Type                 | D1-D13 aligné | Contenu créé | Gap
automation_recipe       |               |              |
roi_calculator_template |               |              |
industry_use_case       |               |              |
comparison              |               |              |
secteur_brief           |               |              |
dept_brief              |               |              |
metier_brief            |               |              |
[etc. pour 28 types]
```

Produire :
- Matrice complète 28 KB types × couverture
- KB types définis mais sans contenu créé (gaps prioritaires)
- Score `/100`

---

### A16 — ROADMAP STRATÉGIQUE COMPLÈTE
**Fichier de sortie :** `A16-ROADMAP-STRATEGIQUE-COMPLETE.md`

Synthétiser A1-A15. Produire :

```
P0 — IMMÉDIAT (0-30 jours) — sans créer de nouvelles pages
  Actions identifiées dans A14 (quick wins)
  Corrections H1/meta sur pages existantes
  Ajout FAQPage schema sur 5 pages clés
  Mise à jour buildOrganizationJsonLd() (sameAs Wikidata/LinkedIn)

P1 — COURT TERME (1-3 mois) — nouvelles pages + contenu
  Pages audiences manquantes (écoles, associations, mairies)
  50 articles longue traîne Content Engine
  30 questions AEO dédiées
  Top 5 secteurs prioritaires (pages /fr/secteurs/[slug])
  Coaching-1-to-1 dans pSEO villes

P2 — MOYEN TERME (3-9 mois) — autorité thématique
  Page presse + kit médias + profil speaker
  Page partenaires + sous-traitants (discrète)
  100+ articles/guides supplémentaires
  Positionnements communication (6 angles) dans tout le contenu
  llms.txt enrichi pour citations IA

P3 — LONG TERME (9-18 mois) — domination HEAD
  Mots HEAD avec autorité accumulée
  Expansion francophone (BE/CH/LU)
  Page investisseurs (noindex)
  Knowledge Graph recognition confirmée
```

Produire aussi :
- Budget content engine (articles/mois nécessaires par phase)
- KPIs de succès par phase
- Score `/100`

---

## 4. LIVRABLES OBLIGATOIRES (26 fichiers)

Tous sous `_AUDIT/KEYWORD-STRATEGY-AUDIT-2026/` :

```
# Synthèse (10 fichiers — écrits APRÈS les 16 agents)
00-MANIFEST.md                    index tous livrables + status agents
01-EXEC-SUMMARY-WILL.md           ≤2 pages, top 10 actions, verdict 🔴🟠🟡🟢
02-VERDICT-GLOBAL.md              score /1600 + radar D1-D13 (0-10 chacune)
03-STOP-AND-ASK-WILL.md           toutes décisions consolidées (contenu only, pas de pause)
04-KEYWORD-GAP-MAP.md             carte complète des gaps par dimension D1-D13
05-COMPETITOR-MATRIX.md           top 5 concurrents × stratégie × nos gaps
06-QUICK-WINS-TOP-20.md           20 actions P0 classées impact/effort
07-CONTENT-ROADMAP-P0-P3.md       roadmap complète chiffrée
08-AUDIENCE-VISIBILITY-MATRIX.md  qui voit quoi (index/noindex par audience)
09-FREE-TOOLS-METHODOLOGY.md      comment reproduire cet audit gratuitement

# 16 agents (16 fichiers — écrits en parallèle)
A1-ETAT-ACTUEL-KEYWORDS.md
A2-ANALYSE-CONCURRENTIELLE.md
A3-GAPS-CLIENTS-DIRECTS.md
A4-GAPS-AUDIENCES-SECONDAIRES.md
A5-GAPS-PARTENAIRES-AUDIENCES-SPECIALES.md
A6-AUDIT-BENEFICES-ROI.md
A7-AUDIT-AEO-FEATURED-SNIPPETS.md
A8-AUDIT-GEO-IA-GENERATIVES.md
A9-AUDIT-LOCAL-PSEO-VILLES.md
A10-AUDIT-SECTORIEL-35-SECTEURS.md
A11-AUDIT-NOTORIETE-BRAND.md
A12-AUDIT-TECHNIQUE-KEYWORDS.md
A13-POSITIONNEMENTS-COMMUNICATION.md
A14-QUICK-WINS-P0-IMMEDIATS.md
A15-ANALYSE-KEYWORDS-TYPE-CONTENU.md
A16-ROADMAP-STRATEGIQUE-COMPLETE.md
```

---

## 5. SCORING

```
Par agent : /100 avec justification
Total     : /1600

🔴 < 800    état critique, manques graves
🟠 800-1100 sprint correctif P0+P1 urgent
🟡 1100-1350 bonne base, optimisations importantes
🟢 > 1350   stratégie solide, finitions seulement

Radar couverture (dans 02-VERDICT-GLOBAL.md) :
D1  Transactionnel    __/10
D2  Bénéfices/ROI     __/10   ← attendu faible — différenciateur non exploité
D3  Informationnel    __/10
D4  AEO/Questions     __/10
D5  Comparatif        __/10
D6  Local/pSEO        __/10
D7  Partenaire        __/10
D8  Sectoriel         __/10
D9  Notoriété/Brand   __/10
D10 Thought Leadership __/10
D11 GEO IA génératives __/10
D12 Presse/Médias     __/10
D13 Positionnements   __/10
```

---

## 6. STOP & ASK (écrire dans 03-STOP-AND-ASK-WILL.md — jamais de pause runtime)

```
1. Sous-traitants  : page /fr/missions-freelance/ à créer maintenant ou plus tard ?
2. Investisseurs   : projet levée de fonds en cours ? (oriente priorité Mode K)
3. Recrutement     : CDI ouverts maintenant ? (oriente priorité Mode L)
4. Presse          : contacts journalistes existants ? Kit médias déjà créé ?
5. Anthropic       : partenaire officiel Anthropic ? (impact positionnement P6)
6. Budget content  : N articles/mois possible avec Content Engine actuel ?
7. Secteur #1      : quel secteur génère le plus de CA aujourd'hui ?
8. Services actifs : maintenance-ia et codage-developpement actifs commercialement ?
9. Google Ads      : compte Google Ads créé ? (débloque Keyword Planner gratuit)
10. Bénéfices      : chiffres ROI publiables basés sur vrais clients ou estimatifs ?
```

---

*Fin du prompt — version 2.0 AUTOPILOT — 2026-05-19 — Axion-IA OÜ*
*Suite après l'audit :*
*→ `_AUDIT/PROMPT-KEYWORD-STRATEGY-MASTER-V1.md` — générer les seeds*
*→ `_AUDIT/PROMPT-KEYWORD-API-IMPL-V1.md` — implémenter le moteur*
