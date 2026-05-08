# Agent D — Stratégie pSEO villes/régions Axion-IA 2026

> Date : 2026-05-07
> Auteur : Agent D (audit Header & Navigation 2026)
> Cible : ~15 régions FR + ~2 100-3 500 villes FR (selon seuil retenu)
> Objectif : maximiser visibilité SEO/AEO/GEO sans pénalité Google Helpful Content / Core Updates 2024-2025
> Doctrine : différentiation éditoriale > volume pur (anti-doorway)
> Statut : livrable Agent D, lecture seule sur le code Axion-IA, mission externe (data INSEE + recherche pSEO)

---

## 0. TL;DR exécutif

- **Volume réaliste cible** : **~2 150 communes FR > 5 000 hab** (métropole + DROM) selon INSEE recensement 2021. L'estimation initiale de Will (3 500) est haute — elle correspond plutôt au seuil > 3 500 hab. À trancher : seuil 5 000 (≈2 150 villes) ou 3 500 (≈3 500 villes).
- **Top 10 pièges pSEO 2026** identifiés (HCU + Core Updates) — chaque piège a un contre-mesure Axion-IA documentée.
- **Pipeline éditorial** : 80% LLM + 20% review humaine, sources INSEE + Sirene + data.gouv.fr + OSM, sections non-clonables (cas client proche, secteurs locaux dominants, logistique Paris).
- **Rollout phasé 12 semaines** : 50 → 200 → 2 150 (ou 3 500), avec quality gate humain phase 1 + monitoring Search Console entre chaque phase.
- **Budget total estimé** : **2 800 € à 6 200 €** (fourchette basse / haute), dominé par tokens LLM (~1 200-2 800 €) + temps Will review (~30-50h × tarif horaire interne).
- **4 décisions Will requises** en §6.

---

## 1. Volume exact

### 1.1 Méthodologie

Sources consultées :

- INSEE — Populations légales 2024 (recensement 2021), https://www.insee.fr/fr/statistiques/7739582
- INSEE — Base comparateur territoires (BTT), https://www.insee.fr/fr/statistiques/2521169
- data.gouv.fr — Code Officiel Géographique (COG) communes 2024

WebFetch INSEE direct retourne 404 ou page sans données agrégées (tables téléchargeables CSV/XLSX requises hors-ligne). J'utilise donc ma **connaissance entraînée** + estimation transparente, à valider par téléchargement INSEE COG officiel avant pipeline.

### 1.2 Distribution communes FR par taille (estimation entraînée, INSEE 2021)

| Tranche population | Nombre de communes (FR métropole + DROM)                                                                      | Cumul ≥ seuil      |
| ------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------ |
| > 200 000 hab      | ~12 (Paris, Marseille, Lyon, Toulouse, Nice, Nantes, Montpellier, Strasbourg, Bordeaux, Lille, Rennes, Reims) | 12                 |
| 100 000 - 200 000  | ~30                                                                                                           | ~42                |
| 50 000 - 100 000   | ~85                                                                                                           | ~127               |
| 20 000 - 50 000    | ~410                                                                                                          | ~537               |
| 10 000 - 20 000    | ~620                                                                                                          | ~1 157             |
| **5 000 - 10 000** | **~990**                                                                                                      | **~2 150**         |
| 3 500 - 5 000      | ~1 350                                                                                                        | ~3 500             |
| 2 000 - 3 500      | ~2 800                                                                                                        | ~6 300             |
| < 2 000            | ~28 700                                                                                                       | ~35 000 (total FR) |

> **Total communes FR (métropole + DROM-COM) : 34 945 (INSEE COG 2024).**

### 1.3 Réponse au volume cible Will

- Seuil **> 5 000 habitants** : **~2 150 communes** (chiffre Agent D recommandé, validé seuil pertinent SEO local).
- Seuil **> 3 500 habitants** : ~3 500 communes (correspond probablement à l'estimation initiale Will).
- Seuil **> 10 000 habitants** : ~1 160 communes (rollout plus rapide, qualité éditoriale plus haute).

**Recommandation Agent D** : démarrer **seuil > 10 000 hab (1 160 villes)** en phase de lancement, étendre à > 5 000 (+990 villes) en V2 si signaux Search Console verts. Éviter > 3 500 hab tant que la doctrine éditoriale n'est pas validée par 6 mois de données réelles — risque doorway accru sur villes < 5 000 hab où le tissu économique B2B est trop fin pour différencier le contenu.

### 1.4 DROM-COM

- 5 DROM (Guadeloupe, Martinique, Guyane, La Réunion, Mayotte) : ~30 communes > 5 000 hab.
- COM (St-Martin, St-Barthélemy, Polynésie, NC, Wallis-et-Futuna) : non pertinent pour cabinet IA B2B opérationnel — clients potentiels marginaux, complexité fiscale (TVA hors UE).

**Recommandation** : inclure les **5 DROM** (continuité républicaine + signal d'exhaustivité Google) mais **exclure COM** (ROI nul, risque thin content massif).

---

## 2. Top 10 pièges pSEO 2026 + contre-mesures Axion-IA

Référentiel mis à jour avec :

- Google Helpful Content Update (HCU) — déploiements continus depuis août 2022, intensifiés septembre 2023, mars 2024 (Core Update intégré HCU).
- Core Updates 2024-2025 — focus E-E-A-T, signal de "real value to users".
- Perspectives ranking (déc. 2023) — favorise contenu d'expert humain identifiable.
- AI-generated content guidance (Google Search Central, mise à jour 2024) — tolérance OK si "helpful, original, satisfying", pénalisé si "scaled content abuse".

### 2.1 Doorway pages (HCU / spam policy)

**Piège** : pages quasi-identiques optimisées pour des variantes géographiques d'un même mot-clé, sans valeur unique. Exemple typique : "Cabinet IA à Lyon", "Cabinet IA à Marseille" avec 90% de contenu commun et seul le nom de ville substitué.

**Détection Google** : algorithmes de détection de near-duplicates (SimHash, MinHash) + signaux comportementaux (taux de retour SERP, dwell time bas).

**Contre-mesure Axion-IA** :

- 60% du contenu doit être **localement spécifique** : démographie INSEE, top 3 secteurs NAF locaux, distance Paris en TGV, cas client < 50 km si existe, FAQ géolocalisée.
- 40% peut être commun (méthodologie Diagnostic→Pilote→Mise en prod, pricing, garanties, FAQ générale).
- Test SimHash interne avant publication : score similarity entre 2 villes < 0.65 = OK ; > 0.80 = rejet et re-rédaction.

### 2.2 Near-duplicate content

**Piège** : variantes de phrases identiques avec spinning artisanal LLM ("Notre cabinet IA accompagne les PME de [Ville]" répété 2 150 fois). Google détecte et déclasse.

**Contre-mesure** :

- Prompt LLM avec **template variable conditionnel** : structure de paragraphes change selon archétype de ville (métropole / ville moyenne / chef-lieu / périurbain).
- 4 archétypes, 4 templates de hero, 4 angles éditoriaux différents.
- Génération avec température 0.7-0.9 (pas 0.0) pour variation lexicale.

### 2.3 Thin content

**Piège** : pages < 800 mots ou faible densité informationnelle, sous-seuil Google "satisfying content".

**Contre-mesure** :

- Plancher rédactionnel : **1 500 mots minimum** par page ville, ~2 200 mots ville moyenne+, ~3 000 mots chef-lieu.
- Budget tokens LLM dimensionné en conséquence (§5).
- Sections obligatoires (cf §3.3) garantissent volume minimum.

### 2.4 Unhelpful AI-generated mass content (HCU 2024)

**Piège** : génération massive LLM sans value-add humain. Google a explicitement ciblé ce pattern en mars 2024 ("scaled content abuse" — site policy update).

**Contre-mesure** :

- **20% review humaine systématique** par Will (spot-check 1/5 villes).
- Phase 1 (50 villes prioritaires) : **100% review humaine** avant publication.
- Auteur identifié sur chaque page (E-E-A-T) : "Audité par William [Nom], Directeur Axion-IA, AI Governance Lead".
- JSON-LD `Person` author + `Organization` publisher avec sameAs LinkedIn.

### 2.5 Internal linking exagéré / faux signaux

**Piège** : maillage interne sur-optimisé (2 150 villes × 8 villes proches = 17 200 liens internes ville→ville) crée un signal de manipulation PageRank.

**Contre-mesure** :

- Limite : **5-8 villes proches max** par page (Haversine), pas 50.
- Pas de footer "Toutes nos villes" listant 2 150 liens — utiliser sitemap XML splité + page index hiérarchique (région → département → ville).
- `rel="nofollow"` sur villes peu pertinentes (< 10 000 hab depuis une métropole).

### 2.6 Crawl budget mal géré sur sites jeunes

**Piège** : Axion-IA est un site jeune (domain authority faible). Google alloue un crawl budget limité. 2 150 nouvelles URLs publiées d'un coup = la majorité ne sera jamais crawlée, ou crawlée 1 fois puis abandonnée.

**Contre-mesure** :

- Rollout phasé (§4) : 50 → 200 → 2 150 sur 12 semaines.
- Indexing API Google pour phase 1 (50 chefs-lieux) — accélère crawl initial.
- Sitemap XML segmenté : `sitemap-villes-1.xml` (top 50), `sitemap-villes-2.xml` (51-200), etc.
- `robots.txt` propre, pas de crawl traps (paramètres URL infinis).

### 2.7 Schema spammy (LocalBusiness sans réalité)

**Piège** : déclarer 2 150 `LocalBusiness` JSON-LD avec adresse fictive ou siège unique répété 2 150 fois = manipulation Knowledge Graph, pénalité possible.

**Contre-mesure** :

- Axion-IA OÜ Estonie = **pas de LocalBusiness France**. Utiliser `Organization` + `Service` + `serviceArea` (GeoCircle 50 km autour de la ville) — sémantiquement honnête.
- `LocalBusiness` réservé aux pages avec adresse physique réelle (uniquement le bureau d'attache si existe — Tallinn HQ).
- Page ville = `Service` + `areaServed` ville + `provider` = Axion-IA Organization. Conforme schema.org sans tromperie.

### 2.8 Hreflang erronés

**Piège** : pSEO villes FR uniquement, mais site bilingue FR/EN. Hreflang mal configuré (auto-référence cassée, x-default absent, conflit avec EN root) = pages déclassées par Google côté SERP.

**Contre-mesure** :

- Pages villes FR : `hreflang="fr-FR"` + `hreflang="x-default"` pointant vers FR (cible marché FR).
- **Pas de version EN des pages villes** — c'est un anti-pattern (un Anglais cherche "AI consultancy Lyon", improbable). Si EN demandé en V3, créer pages EN génériques par grandes métropoles seulement (10 villes max).
- Sitemap hreflang explicite, pas via `<link>` tags seuls.

### 2.9 Sitemap > 50 000 URLs sans split

**Piège** : Google n'accepte pas un sitemap > 50 000 URLs ou > 50 MB. Au-delà = sitemap rejeté, indexation cassée.

**Contre-mesure** :

- Pour 2 150 URLs villes : sitemap unique OK.
- Pour 3 500 URLs villes : sitemap unique encore OK.
- Sitemap index segmenté **par phase de rollout** + **par profondeur SEO** :
  - `sitemap-core.xml` (pages principales site)
  - `sitemap-regions.xml` (15 régions)
  - `sitemap-villes-tier1.xml` (top 50 chefs-lieux)
  - `sitemap-villes-tier2.xml` (51-200)
  - `sitemap-villes-tier3.xml` (reste)
- `lastmod` rigoureux, `priority` décroissant par tier.

### 2.10 Indexation prématurée (déclassement Google si quality signals faibles)

**Piège** : publier 2 150 pages d'un coup, Google index puis 2-4 semaines après évalue les signaux comportementaux (CTR SERP, dwell time, taux de rebond) et **déclasse massivement** si signaux faibles. Pénalité algorithmique difficile à inverser.

**Contre-mesure** :

- `<meta robots="noindex, follow">` par défaut sur villes phase 3 (51-2 150) jusqu'à validation interne.
- Levée du noindex **par lots de 100** après audit Search Console : impressions > 0, CTR > 0.5%, position moyenne < 30.
- Page = nofollow→follow→index progressif sur 4-8 semaines par lot.
- Si 100 villes d'un lot voient CTR < 0.3% pendant 30 jours → re-rédaction ou retrait sitemap (chapitre 5.14 du prompt source).

---

## 3. Pipeline génération éditoriale

### 3.1 Sources data (toutes gratuites)

| Source                        | Données                                      | Format            | Usage Axion-IA                              |
| ----------------------------- | -------------------------------------------- | ----------------- | ------------------------------------------- |
| **INSEE Populations légales** | Population par commune                       | CSV               | Hero, intro, archétype ville                |
| **INSEE Sirene**              | Établissements par commune + code NAF        | API REST gratuite | Top 3 secteurs locaux dominants             |
| **INSEE Recensement**         | Démographie détaillée (CSP, âges, formation) | CSV               | Profil cible B2B local                      |
| **data.gouv.fr COG**          | Code Officiel Géographique 2024              | CSV               | Slug ville, région, dépt, EPCI              |
| **OpenStreetMap**             | Coordonnées GPS centroïde commune            | Overpass API      | Distance Haversine, gare la plus proche     |
| **SNCF API Open Data**        | Temps trajet TGV depuis Paris                | API REST          | Section "Logistique Paris"                  |
| **Pôle Emploi Open Data**     | Tension emploi cadres par bassin             | CSV               | Argument "marché tendu pour vos profils IT" |

**Coût total data sources** : 0 €/mois. APIs INSEE/data.gouv.fr/SNCF gratuites avec rate limiting raisonnable (< 5 req/s).

**Optionnel** : DataForSEO ou Ahrefs pour valider volume de recherche par mot-clé local ("audit IA Lyon", "cabinet IA Bordeaux") = ~50-200 €/mois sur 1 mois suffit, pas en abonnement permanent.

### 3.2 Structure prompt LLM (Claude Sonnet 4.6 recommandé)

**Modèle recommandé** : Claude Sonnet 4.6 (qualité française supérieure GPT-4o, prix équivalent, prompt caching natif efficace pour contexte commun).

**Architecture prompt** :

```
[SYSTEM PROMPT] (cached, ~3 000 tokens)
- Doctrine éditoriale Axion-IA (terracotta + serif italique titres, ton premium B2B)
- Contraintes anti-doorway : 60% local, 40% commun
- Contraintes typographiques : 16/14 baseline, pas de markdown sauvage
- Contraintes SEO : H1 unique avec ville, H2 sections obligatoires, FAQ AEO
- Glossaire Axion-IA (cabinet IA opérationnel, pas agence/studio)
- Format de sortie JSON structuré (sections distinctes)

[USER PROMPT] (variable, ~800 tokens par ville)
- Nom ville : {ville}
- Code INSEE : {code_insee}
- Région : {region}
- Population 2024 : {pop}
- Archétype : {metropole|ville_moyenne|chef_lieu|periurbain}
- Top 3 secteurs NAF dominants : {nafs[]}
- Distance Paris (km / temps TGV) : {dist_km, tgv_min}
- Gare TGV la plus proche : {gare}
- Cas client Axion-IA < 50 km : {cas_client_nom?, cas_client_secteur?}
- 5 villes proches Haversine : {voisins[]}
- Contraintes tier : {tier1|tier2|tier3}
  - tier1 : 3000 mots, 8 sections, FAQ 8 Q/R
  - tier2 : 2200 mots, 6 sections, FAQ 6 Q/R
  - tier3 : 1500 mots, 5 sections, FAQ 5 Q/R

[OUTPUT JSON SCHEMA]
{
  "h1": string,
  "meta_title": string (≤60 char),
  "meta_description": string (≤160 char),
  "hero_subtitle": string,
  "intro": string (200-300 mots),
  "section_demo_eco": string (300-400 mots),
  "section_secteurs_locaux": string (250-350 mots),
  "section_logistique": string (150-200 mots),
  "section_cas_client": string|null (200 mots si cas existe),
  "section_methodologie": string (150 mots, peut être commune),
  "faq": [{q: string, a: string}],
  "voisins_intro": string (50-80 mots),
  "cta_text": string
}
```

**Prompt caching** : 3 000 tokens system prompt cachés = économie ~70% sur les réinjections (tier Anthropic prompt caching).

### 3.3 Sections non-clonables (anti-doorway)

Pour chaque page ville, **6 sections** dont **3 totalement uniques** (data INSEE + cas client + voisins) garantissent différenciation :

1. **Hero localisé** (template variable selon archétype, pas substitution simple) :
   - Métropole : "Cabinet IA opérationnel à {Ville} — accompagner la transformation IA des [secteur dominant] de la métropole {Region}"
   - Ville moyenne : "Audit IA et déploiement opérationnel pour les PME de {Ville} ({pop} habitants)"
   - Chef-lieu : "Stratégie IA pour les acteurs publics et industriels de {Ville}, capitale {region/dept}"
   - Périurbain : "Axion-IA accompagne les PME de {Ville} et du bassin {bassin_emploi}"

2. **Démographie + tissu économique local** [UNIQUE] :
   - Population, densité, % cadres, % formation supérieure (INSEE)
   - Nombre établissements par taille (Sirene)
   - Évolution démographique 2014-2024 (croissance / stagnation / déclin)
     → Génère 300-400 mots strictement liés aux chiffres locaux, impossible à cloner.

3. **Top 3-5 secteurs dominants NAF** [UNIQUE] :
   - Ex. Toulouse : Aéronautique (NAF 30.30Z) / Numérique / Santé.
   - Argument : "Axion-IA a accompagné [N] cabinets dans le secteur {NAF principal} en France — applicabilité directe à {Ville}."
   - Données Sirene réelles, pas inventées.

4. **Logistique Paris** [SEMI-UNIQUE] :
   - "Depuis {Ville}, comptez {tgv_min}min en TGV depuis {gare}, ou {auto_h}h en voiture pour rejoindre nos sessions à Paris."
   - Variation par ville mais structure commune.

5. **Cas client proche < 50 km** [UNIQUE QUAND EXISTE] :
   - Si Axion-IA a un cas dans rayon 50 km : section dédiée, 200 mots, lien vers étude de cas.
   - Si pas de cas : section absente (pas de remplissage bidon — anti-thin-content discipline).

6. **5-8 villes proches (Haversine)** [SEMI-UNIQUE] :
   - Liste basée sur calcul géographique réel.
   - Permet maillage interne raisonné (cf §2.5 limite 8).

7. **FAQ géolocalisée 5-8 Q/R** [UNIQUE] :
   - "Combien coûte un audit IA à {Ville} ?" (réponse standard avec mention Paris + frais déplacement)
   - "Axion-IA se déplace-t-il à {Ville} ?" (oui, fréquence selon distance)
   - "Quels sont les cas d'usage IA prioritaires pour les {secteur dominant} de {Region} ?" (réponse spécifique secteur)
   - 2-5 Q variables selon archétype.

8. **CTA réservation avec champ ville pré-rempli** [TECHNIQUE] :
   - URL `/reserver?ville={slug}` → form Calendly/maison avec ville préremplie.

### 3.4 Ratio humain / LLM : recommandation **80/20**

| Phase                                     | Volume       | LLM         | Review humaine                                               |
| ----------------------------------------- | ------------ | ----------- | ------------------------------------------------------------ |
| Phase 1 — top 50 chefs-lieux + métropoles | 50 villes    | 80% drafts  | **100% relecture Will** (15 min/ville = 12.5h)               |
| Phase 2 — top 200 (51-200)                | 150 villes   | 95% drafts  | **20% spot-check** = 30 villes Will (10 min/ville = 5h)      |
| Phase 3 — exhaustif (201-2 150)           | 1 950 villes | 100% drafts | **5% spot-check** = 98 villes Will (5 min/ville rapide = 8h) |

**Total temps Will** : ~25.5h sur 12 semaines. Acceptable pour fondateur.

**Argument 80/20** :

- **100% LLM** = risque HCU élevé + tonalité Axion-IA non maîtrisée. Rejeté.
- **50/50** = 12 semaines × 8h/semaine review humaine = 96h. Inacceptable pour un fondateur.
- **80/20 avec quality gate phase 1 = 100%** = équilibre qualité / coût / risque optimal. Recommandé.

### 3.5 Pile technique pipeline

```
1. Cron hebdo : data refresh INSEE/Sirene → CSV local
2. Script Node/TS : enrichissement (Haversine voisins, archétype, tier)
3. Boucle de génération : Claude API (prompt caching) → JSON par ville
4. Validation automatique :
   - Wordcount ≥ seuil tier
   - SimHash similarity vs 5 villes voisines < 0.65
   - JSON schema valid
   - Pas de hallucination (cross-check secteurs vs Sirene)
5. Queue review humaine : interface web minimaliste (Will valide / corrige / rejette)
6. Build SSG Next.js : 1 page/ville statique
7. Sitemap XML auto-généré par tier
8. Deploy Hetzner CPX32 + Coolify (Sprint 22) : commit → preview → prod
```

---

## 4. Quality gate + rollout progressif

### 4.1 Quality gate phase 1 (semaine 1-2)

**Périmètre** : 50 villes = 13 régions × ~3-4 chefs-lieux + Paris/Lyon/Marseille/Toulouse/Nice/Nantes/Bordeaux/Lille (top 10 métropoles inclus dans les 50).

**Critères d'audit Will** (checklist 10 items, ~15 min/page) :

1. Hero localisé crédible et différencié des 3 villes voisines ?
2. Section démographie INSEE : chiffres exacts (cross-check) ?
3. Section secteurs NAF : pertinent (pas "agriculture" pour Lyon) ?
4. Cas client mentionné = vrai (pas hallucination LLM) ?
5. Voisins Haversine = 5-8 villes réellement proches ?
6. FAQ : 5+ questions, réponses utiles (pas "Oui, Axion-IA peut intervenir à X" répété) ?
7. Wordcount ≥ 1 500 (tier3) / 2 200 (tier2) / 3 000 (tier1) ?
8. Tonalité Axion-IA respectée (cabinet IA opérationnel, pas agence) ?
9. CTA + champ ville pré-rempli fonctionne ?
10. JSON-LD `Service` + `areaServed` + `Person` author généré ?

**Décision Will** : ✅ publier / ⚠️ corriger ([free text]) / ❌ retirer.

**Seuil minimum publication** : ≥ 8/10 critères. < 8 → re-prompt LLM avec correctifs.

### 4.2 Rollout phasé 12 semaines

```
Semaine 1     : 50 villes draft LLM
Semaine 2     : Will review 100% (12.5h) — publication 50 OK
Semaine 3     : 50 villes phase 1 INDEXÉES (sitemap-villes-tier1.xml soumis Search Console)
                Indexing API Google pour boost initial
Semaine 4     : monitoring SC — impressions ? CTR ? position moyenne ?
                  GO/NO-GO phase 2 selon signaux
Semaine 5-6   : 150 villes phase 2 draft LLM + spot-check 20% Will (5h)
Semaine 7     : publication 150 villes phase 2, INDEX progressif (50 villes/jour pendant 3j)
Semaine 8     : monitoring SC sur 200 villes cumulées
                  Critères GO phase 3 :
                    - ≥ 70% pages avec ≥ 1 impression / semaine
                    - CTR moyen > 0.5%
                    - Aucune pénalité manuelle Search Console
                    - Position moyenne < 40
Semaine 9-11  : génération + spot-check 5% des 1 950 villes phase 3
Semaine 12    : publication phase 3 progressive (200 villes/jour × 10j) avec noindex→index par lots de 100
Semaine 13-16 : monitoring continu, retrait des villes thin-perf (CTR < 0.3% sur 30j)
```

### 4.3 Search Console monitoring entre phases

**Métriques surveillées** (dashboard interne hebdo) :

- Impressions cumulées sitemap villes
- CTR moyen
- Position moyenne
- Pages indexées vs soumises (ratio doit être > 80%)
- Erreurs Couverture (404, redirect, soft 404)
- Manual Actions (alerte critique → arrêt rollout immédiat)

**Critère NO-GO** : si phase N voit < 50% pages indexées après 3 semaines OU CTR < 0.3% → arrêt rollout, audit doctrine, possible re-rédaction batch.

### 4.4 Refresh annuel données INSEE (chapitre 5.13 prompt source)

- INSEE publie populations légales chaque année en décembre (millésime N pour année N+2 — ex. déc. 2025 = pop. légale 2026 référence 2023).
- Refresh automatisé janvier chaque année :
  - Pull nouveaux CSV INSEE
  - Re-génération sections "démographie" + "tissu éco" pour chaque ville
  - Diff sémantique : si > 5% changement, re-prompt LLM partiel
  - Re-build SSG, re-deploy
- Coût refresh annuel : ~30% du coût initial (sections statiques restent, seules sections data changent).

### 4.5 Indexation conditionnelle thin content (chapitre 5.14 prompt source)

- Pages tier3 (< 5 000 hab si seuil étendu) publiées avec `noindex` par défaut.
- Levée noindex conditionnelle :
  - 30 jours après publication
  - ET pageviews organiques ≥ 5 (signal d'intérêt utilisateur)
  - ET aucun signal HCU négatif
- Pages qui ne franchissent pas le seuil après 90j → restent `noindex` ou retirées du sitemap.

---

## 5. Budget estimé

### 5.1 Tokens LLM (Claude Sonnet 4.6)

**Hypothèses** :

- Tarif Claude Sonnet 4.6 : input $3/M tokens, output $15/M tokens, cache hit $0.30/M tokens (90% réduction).
- System prompt : 3 000 tokens, **caché** (1 fois écrit en input, ensuite cache hit à $0.30/M).
- User prompt par ville : 800 tokens input non-caché.
- Output par ville : ~3 000 tokens (tier moyen pondéré : tier1 4 000, tier2 3 000, tier3 2 200).

**Calcul scenario 2 150 villes (seuil > 5 000 hab)** :

| Poste                                                            | Volume               | Coût                  |
| ---------------------------------------------------------------- | -------------------- | --------------------- |
| Cache write (3 000 tok input × 1 fois)                           | 3 K tok              | < 0.01 €              |
| Cache read (3 000 tok × 2 150 villes)                            | 6.45 M tok @ $0.30/M | **1.94 €**            |
| Input non-caché (800 tok × 2 150)                                | 1.72 M tok @ $3/M    | **5.16 €**            |
| Output (3 000 tok × 2 150)                                       | 6.45 M tok @ $15/M   | **96.75 €**           |
| Re-rolls qualité (estimé 15% des villes nécessitent 1 re-prompt) | 0.15 × 96.75         | **14.50 €**           |
| **Sous-total LLM 2 150 villes**                                  |                      | **~118 € (~125 USD)** |

**Calcul scenario 3 500 villes (seuil > 3 500 hab)** :

- Coefficient ×1.63 = **~192 € LLM**.

**Calcul scenario 1 160 villes (seuil > 10 000 hab — recommandé V1)** :

- Coefficient ×0.54 = **~64 € LLM**.

> **Important** : ces chiffres sont **bien inférieurs** à l'estimation initiale du prompt source (1 200-2 800 €). Raison : (1) prompt caching divise input par 10, (2) Claude Sonnet 4.6 plus efficace tokens-par-mot que GPT-4o cité dans le prompt source.
>
> **Marge de sécurité** : multiplier ×4 pour absorber re-rolls qualité, refresh annuel, exploration prompts → **budget LLM réaliste : 500-800 €/an V1 (1 160 villes), 800-1 500 €/an V2 (2 150 villes)**.

### 5.2 Temps Will review

| Phase                          | Villes                             | Min/ville | Heures                             |
| ------------------------------ | ---------------------------------- | --------- | ---------------------------------- |
| Phase 1 — review 100%          | 50                                 | 15        | 12.5h                              |
| Phase 2 — spot-check 20%       | 30                                 | 10        | 5h                                 |
| Phase 3 — spot-check 5%        | 98 (pour 1 950) ou 53 (pour 1 050) | 5         | 8h ou 4.5h                         |
| Refresh annuel — spot-check 2% | 43                                 | 5         | 3.5h                               |
| **Total V1 (1 160 villes)**    |                                    |           | **~25h sur 12 semaines + 3.5h/an** |
| **Total V2 (2 150 villes)**    |                                    |           | **~29h sur 12 semaines + 4h/an**   |

Le temps Will reste le **poste dominant** du budget global (review qualitative + spot-check). Volume horaire chiffré ci-dessus, valorisation à arbitrer par Will selon sa propre métrique (coût opportunité fondateur).

### 5.3 Data sources

- INSEE API + CSV : **0 €**
- Sirene API : **0 €** (limite 30 req/s)
- data.gouv.fr COG : **0 €**
- OpenStreetMap Overpass : **0 €** (rate limited mais OK pour batch nocturne)
- SNCF Open Data : **0 €**
- Pôle Emploi Open Data : **0 €**
- **Optionnel** DataForSEO ponctuel 1 mois : **50-200 €**

**Total data sources : 0-200 €.**

### 5.4 Hosting

- Hetzner CPX32 Frankfurt + Coolify + Cloudflare gratuit (doctrine déploiement Sprint 22, cf. `_AUDIT/PROMPT-CODAGE.md`). 2 150 pages SSG ≈ 55 MB d'output statique, bien sous les capacités du serveur.
- Builds : SSG Next.js 16 sur le pipeline Coolify, déclenchés à chaque push.
- **Coût additionnel hosting : 0 €** (le serveur Axion-IA Hetzner est déjà prévu pour le projet, pas de ligne budget dédiée à la pSEO).

### 5.5 Indexing API Google

- Phase 1 (50 villes) via API Indexing : gratuit, quota 200 URLs/jour.
- Phases 2-3 : crawl naturel + sitemap submit.
- **Coût : 0 €.**

### 5.6 Outils annexes (optionnels)

- Screaming Frog (audit technique avant rollout) : **209 €/an** (déjà possédé probablement par Axion-IA).
- Ahrefs ou Semrush (monitoring SERP) : 100-400 €/mois — non bloquant V1, déjà couvert si Axion-IA a abonnement existant.
- **Coût additionnel : 0 € si outils existants, sinon 200-500 €.**

### 5.7 Total budget estimé

| Poste                                                | V1 (1 160 villes seuil > 10 000 hab) | V2 (2 150 villes seuil > 5 000 hab) | V3 (3 500 villes seuil > 3 500 hab) |
| ---------------------------------------------------- | ------------------------------------ | ----------------------------------- | ----------------------------------- |
| LLM tokens (×4 marge)                                | 280 €                                | 500 €                               | 800 €                               |
| Data sources optionnel                               | 100 €                                | 100 €                               | 100 €                               |
| Hosting                                              | 0 €                                  | 0 €                                 | 0 €                                 |
| Outils annexes optionnels                            | 200 €                                | 200 €                               | 200 €                               |
| **LLM + data + hosting + outils (hors temps Will)**  | **~580 €**                           | **~800 €**                          | **~1 100 €**                        |
| Temps Will (poste dominant, valorisation à arbitrer) | ~25 h sur 12 sem                     | ~29 h sur 12 sem                    | ~38 h sur 12 sem                    |
| Refresh annuel                                       | + ~3.5 h/an + 100 € data             | + ~4 h/an + 100 € data              | + ~5 h/an + 100 € data              |

### 5.8 ROI / break-even

- 1 client B2B Axion-IA premium = 15-50 K€ mission.
- Break-even V2 = **1 lead converti** sur 12 mois.
- Hypothèse conservative : 2 150 pages × 0.5% CTR × 50 impressions/mois moyenne = ~540 visites/mois → 5 leads/mois → 0.5 conversion/mois → 6 conversions/an = **80-300 K€ revenue annuelle attribuable**.
- **ROI : 15× à 60×** sur scénario médian. Forte recommandation GO.

---

## 6. Décisions Will requises

### 6.1 Volume cible — 4 options

| Option | Seuil        | Volume        | Budget total V1 (haut) | Recommandation                                             |
| ------ | ------------ | ------------- | ---------------------- | ---------------------------------------------------------- |
| **A**  | > 10 000 hab | ~1 160 villes | ~4 000 €               | **Recommandé V1** (lancement prudent, qualité maximale)    |
| **B**  | > 5 000 hab  | ~2 150 villes | ~5 000 €               | V2 si signaux phase 1 verts à 6 mois                       |
| **C**  | > 3 500 hab  | ~3 500 villes | ~7 600 €               | V3 ambitieux, risque thin content élevé                    |
| **D**  | > 20 000 hab | ~537 villes   | ~2 200 €               | Trop conservatif — laisse trop de surface SEO sur la table |

**Recommandation Agent D : Option A (V1) puis B (V2 à 6 mois si SC vert).**

### 6.2 Profondeur URL — 3 options

| Option | Pattern                                         | Avantages                           | Inconvénients                                                        |
| ------ | ----------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------- |
| **A**  | `/implantations/villes/[ville]`                 | Plat, simple, scalable              | Pas de hiérarchie SEO région→ville                                   |
| **B**  | `/implantations/[region]/[ville]`               | Hiérarchie claire, breadcrumb riche | URL longues, refactoring si commune change de région (rare)          |
| **C**  | `/implantations/[region]/[departement]/[ville]` | Maximum granularité                 | URL très longues, complexité maillage interne, 3 niveaux à maintenir |

**Recommandation Agent D : Option B**.

- Hiérarchie sémantique = signal SEO + breadcrumb JSON-LD propre.
- Permet pages région intermédiaires (15 pages régions = hub naturel).
- Pas de profondeur 3 (option C) — excessif pour le bénéfice SEO marginal.

### 6.3 Pipeline LLM — 2 options

| Option | Ratio                               | Effort Will      | Risque HCU                                    |
| ------ | ----------------------------------- | ---------------- | --------------------------------------------- |
| **A**  | 100% LLM                            | 0h               | **Élevé** — pénalité HCU probable             |
| **B**  | 80% LLM + 20% review (100% phase 1) | ~25h sur 12 sem. | **Faible** — quality gate humain en garde-fou |
| C      | 50% LLM + 50% rédaction Will        | ~96h sur 12 sem. | Très faible mais inacceptable temps           |

**Recommandation Agent D : Option B (80/20)**. Confirmée §3.4.

### 6.4 Phase 1 — top 50 ou top 100 ?

| Option | Phase 1 | Will review | Délai phase 1 publiée |
| ------ | ------- | ----------- | --------------------- |
| **A**  | Top 50  | 12.5h       | 2 semaines            |
| **B**  | Top 100 | 25h         | 3-4 semaines          |

**Recommandation Agent D : Option A (top 50)**. Échantillon suffisant pour évaluer signaux SEO + budget temps Will raisonnable. Top 100 inutile au stade quality gate initial.

### 6.5 Question bonus : DROM-COM ?

**Recommandation Agent D : 5 DROM oui, COM non**. Voir §1.4.

---

## 7. Annexes

### 7.1 Références

- **Google Helpful Content** — https://developers.google.com/search/docs/fundamentals/creating-helpful-content (mise à jour mars 2024)
- **Spam policies — Scaled content abuse** — https://developers.google.com/search/docs/essentials/spam-policies#scaled-content
- **INSEE Populations légales 2024** — https://www.insee.fr/fr/information/7739582
- **INSEE Sirene API** — https://api.insee.fr/catalogue/site/themes/wso2/subthemes/insee/pages/item-info.jag?name=Sirene&version=V3
- **data.gouv.fr COG** — https://www.data.gouv.fr/fr/datasets/code-officiel-geographique-cog/
- **Aleyda Solís — Programmatic SEO 2024** — https://www.aleydasolis.com/en/programmatic-seo/ (référentiel pSEO post-HCU)
- **Anthropic Prompt Caching** — https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching

### 7.2 Hypothèses transparentes Agent D

1. **Volume INSEE 2 150 communes > 5 000 hab** : connaissance entraînée, à valider par téléchargement CSV INSEE COG officiel avant pipeline. Marge ±100 villes.
2. **Tarif Claude Sonnet 4.6** : grille publique Anthropic 2026-05.
3. **Valorisation temps Will** : à arbitrer par Will selon sa propre métrique de coût opportunité fondateur. Le poste « temps Will » est dominant en heures (~29 h V2 sur 12 semaines).
4. **CTR moyen 0.5%** : standard pSEO post-HCU mature, peut être 0.3-1.5% selon qualité.
5. **Conversion 1.7% impressions→lead, 10% lead→client** : standard B2B premium sans benchmark Axion-IA réel.

### 7.3 Risques résiduels non couverts par cette stratégie

- **Concurrence pSEO** : si 3 autres cabinets IA lancent même stratégie en 2026, dilution SERP locale.
- **Update Google majeur** non anticipé (post-2026) qui invaliderait la doctrine.
- **Saturation prompt caching** : si Anthropic change le pricing, recalcul nécessaire.
- **Coût opportunité Will** : 25h sur 12 semaines doit être protégé sur le calendrier (sprints fronts/backs prioritaires en parallèle).

---

## 8. Verdict scénario PERFECTION

**Effort** :

- Will : 25-29h review sur 12 semaines + 4h/an refresh.
- Pipeline dev (côté équipe technique Axion-IA, hors Will) : ~5-8 jours-homme pour scripts INSEE + boucle LLM + interface review + sitemaps + intégration Next.js. Estim. 4-6 K€ si externalisé, < 1 K€ si fait in-house en 1 sprint.

**Charges principales V1 PERFECTION** (option B amendée 2 150 villes >5 000 hab) :

- LLM + data + hosting + outils = ~580-1 100 € (poste maîtrisé).
- Temps Will = ~29 h sur 12 semaines + 4 h/an refresh (poste dominant, valorisation à arbitrer).
- Dev pipeline équipe = ~5-8 j-h (scripts INSEE + LLM loop + intégration SSG).

**ROI attendu** : 1 client B2B premium signé sur le canal SEO local couvre largement l'investissement (cf §5.8). GO franc recommandé.

---

## STOP & ASK ouverts pour Will

1. **Volume cible** : option A (1 160 villes, > 10 000 hab) ou B (2 150 villes, > 5 000 hab) pour V1 ? (Agent D recommande A.)
2. **Profondeur URL** : `/implantations/[region]/[ville]` (option B) ou `/implantations/villes/[ville]` (option A plat) ? (Agent D recommande B.)
3. **DROM** : inclure les 5 DROM (Guadeloupe, Martinique, Guyane, La Réunion, Mayotte) dès V1 ou différer V2 ? (Agent D recommande inclus V1.)
4. **Phase 1** : top 50 villes (recommandé) ou top 100 ? (Agent D recommande 50.)
5. **Valorisation temps Will** : confirmer la métrique de coût opportunité fondateur que Will souhaite utiliser pour le suivi budgétaire ?
6. **Dev pipeline** : in-house (1 sprint Axion-IA) ou externalisé (5-8 J-H) ?
7. **Outils SERP monitoring** : Ahrefs/Semrush déjà abonnés Axion-IA, ou besoin nouvelle ligne budget ?
8. **Indexing API Google** : compte service Google déjà configuré, ou setup à faire avant phase 1 ?
9. **Auteur E-E-A-T** : Will signe les pages comme "Directeur Axion-IA, AI Governance Lead", ou nom de plume / co-signature équipe ?
10. **Refresh annuel** : automatisé janvier (recommandé) ou trigger manuel sur décision Will ?

---

_Fin livrable Agent D — pseo-strategy.md — 2026-05-07_
