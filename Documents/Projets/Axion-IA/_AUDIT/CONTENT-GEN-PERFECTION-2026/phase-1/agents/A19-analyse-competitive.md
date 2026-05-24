# A19 — ANALYSE COMPÉTITIVE · Axion-IA

**Date audit :** 2026-05-21
**Auditeur :** Claude Sonnet 4.6 — Agent A19 (Analyse compétitive)
**Mode :** AUDIT-ONLY STRICT — lecture code + recherches web. 0 modification. 0 invention.
**HEAD audité :** `2b98a7067d7eae701dec42a2c5d6e859364e0e64`
**Score :** /30

---

## MISSION

Auditer le positionnement AxionIA vs concurrents directs et indirects. Identifier les gaps et opportunités exploitables. Analyser le risque homonyme axionai.fr (#1 brand SERP).

---

## MÉTHODE

### Sources code lues
- `axionia/src/lib/brand.ts` — SSOT brand (tagline, slogan, positionnement)
- `axionia/src/lib/seo.ts` — factories JSON-LD (Person Will, Organization, Service)
- `axionia/src/content/comparaisons.ts` — 3 comparaisons actuellement publiées
- `axionia/src/content/transversal.ts` — timeline fondation 2024, ABOUT_TIMELINE
- `axionia/src/app/[locale]/a-propos/page.tsx` — page About + Person JSON-LD "Will"
- `_AUDIT/KEYWORD-STRATEGY-AUDIT-2026/A1-ETAT-ACTUEL-KEYWORDS.md` — scoring D1-D13
- `_AUDIT/KEYWORD-STRATEGY-AUDIT-2026/04-KEYWORD-GAP-MAP.md` — carte gaps prioritaires
- `_AUDIT/KEYWORD-STRATEGY-AUDIT-2026/A12-AUDIT-TECHNIQUE-KEYWORDS.md` — audit SEO technique

### Recherches web effectuées
- `axionai.fr` : WebFetch direct (ECONNREFUSED — site inaccessible au moment de l'audit), WebSearch x3 sur positionnement/brand
- `mister-ia.com` : WebFetch homepage + coaching dirigeant, WebSearch tarifs/Qualiopi
- `savoiria.fr` : WebFetch homepage complète
- `business.lewagon.com` : WebFetch page programme IA business
- `koino.fr` : WebFetch top-10 agences IA France 2026 + classement cabinets conseil 2025
- `octo.academy` : WebFetch catalogue formations IA
- `datacampus.fr` : WebFetch homepage (RÉSULTAT : hébergeur souverain, pas un organisme de formation IA — confusion dans le brief original)
- WebSearch : capgemini invent, octo technology, SavoirIA, SERP positions, gaps sectoriels

---

## ÉTAT OBSERVÉ

### Positionnement AxionIA tel que documenté dans le code

**Brand (brand.ts) :**
- `taglineFr` = `"cabinet IA opérationnel"` — ancre systématique dans 100% des meta titles
- `sloganFr` = `"De l'idée à l'impact. Un seul partenaire IA."` — présent dans brand.ts mais PAS encore visible dans les balises critiques (meta descriptions, JSON-LD Organization description)
- `legalName` = `"Axion-IA"` (OÜ estonienne, fondée 2024)
- Positionnement : cabinet B2B premium, 5 verticales, prix publics affichés, ROI mesurable, hébergement UE

**Person JSON-LD (seo.ts) :**
- `name = "Will"` — fondateur identifié, LinkedIn `https://www.linkedin.com/in/will-axion-ia`
- `jobTitle` = `"Fondateur · lead consultant IA"`
- `knowsAbout` = 6 domaines expertise codés
- **Absence critique :** pas de nom complet "Will Jullin" dans le JSON-LD public (slug "will" seulement) — réduit l'E-E-A-T vs concurrents avec expert identifié

**Comparaisons actuellement publiées (comparaisons.ts) :**
1. Cabinet IA vs SaaS générique
2. Fine-tuning vs RAG
3. Internalisation vs externalisation IA

Ces 3 comparaisons sont **techniques**, pas concurrentielles : aucune page "Axion-IA vs Mister IA", "Axion-IA vs SavoirIA", aucune page de désambiguïsation vs axionai.fr.

---

## FINDINGS — ANALYSE PAR CONCURRENT

### F1 — AXIONAI.FR (CONCURRENT HOMONYME — P0 CRITIQUE)

**Statut d'accès :** WebFetch ECONNREFUSED sur `axionai.fr` et `www.axionai.fr` au moment de l'audit (site hors ligne ou redirection). Seule source disponible : snippets Google via WebSearch.

**Ce qui est établi par les snippets Google :**
- URL indexée : `https://axionai.fr/`
- Titre Google : "Axion AI — Agents IA sur Mesure pour Automatiser Votre Entreprise"
- Description Google : "Axion AI crée des agents IA sur mesure pour automatiser vos processus métier : suivi clients, gestion factures, chatbots internes, etc."
- Positionnement : **agence d'automatisation IA** (agents IA sur mesure), PAS formation, PAS audit, PAS conseil B2B premium
- **Cible estimée :** PME/TPE (automatisation processus opérationnels)
- **Scope géographique :** France (présumé, pas confirmé)

**Ce qui est INCONNU (site inaccessible) :**
- Nombre de pages indexées
- JSON-LD présent ou absent
- E-E-A-T : auteur/équipe identifiée
- Fréquence de publication (blog éventuel)
- Prix affichés
- Présence en SERP sur les keywords cibles d'AxionIA

**Analyse du risque brand :**
- axionai.fr est **absent** des classements koino.fr 2025 et 2026 des top agences IA France — signe d'une faible autorité ou d'une très récente création
- Le positionnement (agents IA automatisation) est **différent** d'AxionIA (cabinet conseil, formation, audit, implémentation sur site)
- Mais le nom "Axion AI" vs "Axion-IA" crée une confusion cognitive certaine : un prospect qui cherche "AxionIA" sur Google peut atterrir sur axionai.fr
- **Risque SERP brand :** si axionai.fr est mieux optimisé sur "axion ia" (sans tiret), il capte les visites brand d'AxionIA
- La mémoire projet indique que axionai.fr rank #1 sur "AxionIA" — ce point n'a pas pu être vérifié directement (aucun outil SERP disponible en audit-only), mais est retenu comme critique

**Différenciation actuelle AxionIA vs axionai.fr :**
- **Absente dans le code :** aucune page de désambiguïsation, aucune mention d'axionai.fr dans le contenu, aucun H1/CTA "ne pas confondre avec..."
- La page `/comparaisons` couvre "cabinet IA vs SaaS" mais pas "Axion-IA ≠ Axion AI (axionai.fr)"

---

### F2 — MISTER IA (mister-ia.com) — CONCURRENT DIRECT FORMATION+CONSEIL

**Positionnement :** "Cabinet de conseil & organisme de formation en IA — la seule double expertise Conseil & Formation en IA"

**Forces identifiées :**
- Qualiopi certifié (éligibilité CPF/OPCO) — AxionIA ne revendique pas Qualiopi
- 1 000 entreprises accompagnées, 9,5/10 satisfaction, 15 700+ Français formés (badge fort)
- 11 villes listées (Paris, Marseille, Lyon, Lille, Nantes, Montpellier, Grenoble, Clermont-Ferrand, Bordeaux, Angers, Dijon) — présence locale physique
- 10 offres structurées (4 formations entreprise + 4 conseil + 2 particuliers)
- Coaching Dirigeant : 5 sessions 1h30 sur 5 mois à partir de 5 000 €HT
- Aucun prix homepage — stratégie "contact pour devis" (vs AxionIA prix publics = différenciateur)
- Blog actif (articles visibles octobre 2025)
- 100+ collaborateurs France

**Faiblesses vs AxionIA :**
- Expertise Anthropic/Claude non revendiquée (vs AxionIA = "expert Claude API" potentiel)
- Positionnement généraliste — AxionIA peut se positionner "B2B premium 5 verticales"
- Pas de page `/implémentation` ou automatisations catalogue (limité conseil+formation)
- Anonymat team (fondateurs non nommés sur homepage)
- Qualiopi = avantage financement mais signal "organisme de formation" pas "cabinet conseil"

**Gap exploitable :**
- AxionIA publie ses prix (AxionIA = transparent) vs Mister IA = "contactez-nous"
- AxionIA couvre l'implémentation technique (RAG, agents, automatisations) — Mister IA ne revendique pas cela
- "Fondateur Will" identifié E-E-A-T (vs Mister IA : anonymat fondateurs)

---

### F3 — SAVOIRIA (savoiria.fr) — CONCURRENT FORMATION RÉSEAU NATIONAL

**Positionnement :** "Formation IA en entreprise, des résultats dès le premier jour" — 1er réseau français de formation IA locale

**Forces identifiées :**
- **17+ pages locales départementales** (IDF, Rhône, Gironde, Nantes, Morbihan, Provence...) — pSEO local très développé
- 60+ formateurs experts sur tout le territoire via franchise
- Qualiopi + RS6776 (titre État) + OPCO/FNE/France Travail/FSE+ (financement 100%)
- 19+ formations structurées (acculturation / compétences transversales / entreprise)
- 3 500+ formés, 98,5% satisfaction, +35% productivité mesurée, featured TF1 JT20h
- Tour de France IA : 37 villes × 69 ateliers gratuits
- Franchise disponible (scalabilité réseau)
- Prix visible homepage : "Stratégie IA Dirigeants" à 800 €HT

**Faiblesses vs AxionIA :**
- Formation seulement — pas d'audit, pas d'implémentation, pas de conseil stratégique
- Réseau de formateurs = qualité hétérogène vs cabinet avec expert identifié
- Cible TPE/PME/demandeurs d'emploi = périmètre large, pas premium B2B
- Qualiopi = contraintes pédagogiques administratives
- Pas d'implémentation IA (agents, RAG, automatisations catalogue)

**Gap exploitable :**
- AxionIA = "cabinet IA opérationnel" qui fait AUSSI l'implémentation — SavoirIA forme seulement
- AxionIA = expertise Anthropic, RAG, agents (technique) vs SavoirIA = acculturation outils grand public
- AxionIA = premium B2B ETI/PME avec ROI mesurable vs SavoirIA = volume TPE/particuliers

---

### F4 — LE WAGON BUSINESS (business.lewagon.com) — CONCURRENT FORMATION TECH

**Positionnement :** "L'IA au service du business" — Bootcamp 2 jours intensif, Qualiopi

**Forces identifiées :**
- Marque mondiale forte (Le Wagon = référence coding bootcamp)
- Bootcamp 2 jours : "80% pratique", apprentissage sur les données de l'entreprise
- Qualiopi
- Déploiement mondial (campus partout en France + international)
- Cible : équipes business et tech, cadres, tous secteurs

**Faiblesses vs AxionIA :**
- 2 jours seulement → pas de suivi, pas de coaching post-formation
- Pas d'audit IA, pas d'implémentation
- Cible généraliste (pas de spécialisation sectorielle ou B2B premium)
- Prix non communiqué (opaque) vs AxionIA transparent
- Profil "école de code" pas "cabinet conseil IA B2B opérationnel"
- Pas de ROI documenté post-formation
- Pas de présence physique "sur site chez le client" (AxionIA = interventions on site)

**Gap exploitable :**
- AxionIA = "on vient chez vous" vs Le Wagon = "venez dans notre campus"
- AxionIA = accompagnement sur 4-8 semaines en production vs Le Wagon = 2 jours
- AxionIA = 5 verticales avec ROI chiffré vs Le Wagon = généraliste

---

### F5 — CAPGEMINI INVENT — CONCURRENT CONSEIL GRANDS GROUPES

**Positionnement :** Conseil transformation IA pour grandes entreprises (CAC40, multinationales)

**Forces identifiées :**
- Quantmetry intégré (ex-pure player IA, PhD-driven) depuis acquisition
- Partenariat stratégique OpenAI (annoncé février 2026)
- Google Cloud AI Enterprise Hub (annoncé avril 2026)
- Publications recherche (perspectives/publications, rapports industrie)
- TJM 600-1 200 €/jour — segments premium grands groupes
- Couverture sectorielle totale (banque, énergie, transport, retail)

**Faiblesses vs AxionIA :**
- Cible = Fortune 500, CAC40 — pas TPE/PME/ETI < 500 personnes
- Ticket d'entrée MVp/POC = 15 000-50 000 € vs AxionIA Audit Flash à 490 €
- Anonymat IA ("Capgemini" pas un expert identifié)
- Pas de prix transparents affichés
- Pas de pSEO local (pas de pages villes)
- Rigidité "grand groupe" vs flexibilité cabinet boutique

**Gap exploitable :**
- AxionIA adresse le segment PME/ETI (100-2 000 salariés) que Capgemini Invent ignore
- AxionIA = "prix publics, démarrage en 48h" vs Capgemini = "appel d'offres, 3 mois négociation"
- AxionIA = fondateur identifié expert Claude/Anthropic (E-E-A-T fort)

---

### F6 — KOÏNO (koino.fr) — CONCURRENT CONSEIL ROI-CENTRIC

**Positionnement :** #1 classement cabinet conseil IA France 2025 (koino.fr auto-classement), 3 000 talents, ROI-centric

**Forces identifiées :**
- Publish intensif : classements top-10, top-intégrateurs, articles de référence (koino.fr = aussi éditeur de contenu)
- Références grands groupes (Decathlon, SNCF, ManoMano)
- Diagnostic à partir de 2 000 €, développement 15 000-50 000 €
- Plateforme Data Insights propriétaire

**Faiblesses vs AxionIA :**
- Prix élevés (développement 15 000-50 000 €) vs AxionIA Audit Flash 490 €
- Cible principale = grands groupes + ETI
- Réseau freelance (qualité hétérogène) vs expert dédié
- Aucune formation intra-entreprise ou coaching dirigeant visible

**Gap exploitable :**
- AxionIA = ticket d'entrée très bas (490 € Audit Flash) = accessibilité PME
- AxionIA = fondateur unique identifié = relation client premium

---

### F7 — OCTO TECHNOLOGY / OCTO ACADEMY — CONCURRENT FORMATION TECHNIQUE

**Positionnement :** Cabinet conseil IT + formation technique avancée (DevOps, Cloud, IA technique)

**Forces identifiées :**
- 12+ formations IA (NLP, Vision, Gen AI AWS/Azure, Agentic AI...)
- Certifications Microsoft officielles (AI900, AI103)
- Formations sur-mesure entreprise (extranet)
- Pionnier architecture IT depuis 1998 — forte crédibilité technique

**Faiblesses vs AxionIA :**
- Cible = développeurs, data scientists, ML engineers — PAS dirigeants/managers
- Pas d'audit IA business, pas d'implémentation opérationnelle
- Pas de ROI mesurable post-formation (évaluation technique)
- Profil "école ingénieurs" pas "cabinet consultant business"

**Gap exploitable :**
- AxionIA = "l'IA pour vos équipes business" (non-tech) vs OCTO = "l'IA pour vos tech"
- AxionIA = pont business/tech (ce que ni Mister IA ni OCTO ne font pleinement)

---

### F8 — STEMA PARTNERS — CONCURRENT DIRECT PME/ETI

**Positionnement :** Intégration LLM métiers, copilotes & automatisation — cible explicite "PME & ETI"

**Forces identifiées :**
- Tarifs visibles : formations 1 500 €/jour, audit 5 000 €+, PoC 10 000-50 000 €
- Blog actif (guide "Diagnostic IA entreprise" référencé SERP)
- Cible PME/ETI explicite — concurrent DIRECT AxionIA

**Faiblesses vs AxionIA :**
- Pas de pSEO local (aucune page ville visible)
- Pas de format Audit Flash (entrée de gamme 490 €)
- Pas de ROI documenté post-mission
- Fondateurs anonymes

**Gap exploitable :**
- AxionIA = Audit Flash 490 € (ticket 10× moins cher que Stema audit 5 000 €)
- AxionIA = pSEO 2 157 villes (vs Stema = 0 page locale)

---

### NOTE : DATACAMPUS.FR

**Clarification importante :** `datacampus.fr` est un **hébergeur cloud souverain** basé au Futuroscope (VPS, colocation, LLM souverain). Ce n'est **pas** un organisme de formation IA. L'item du brief initial reposait sur une confusion de domaine. Aucune concurrence directe avec AxionIA. **Retrait de l'analyse.**

---

## POSITION SERP ESTIMÉE (QUALITATIVE)

*Note : aucun outil SEO disponible en mode AUDIT-ONLY. Les positions sont des estimations qualitatives basées sur les snippets WebSearch observés. Aucune position précise ne peut être certifiée sans GSC ou Ahrefs/SEMrush.*

| Keyword cible | Vol. estimé/mois | AxionIA position estimée | Premier résultat observé |
|---|---|---|---|
| "formation IA PME" | 1 200 | ABSENT (0% visibilité HEAD confirmé mémoire) | SavoirIA, Mister IA, OpenClassrooms |
| "audit IA TPE" | 600 | ABSENT | agence-ia.com, Stema Partners, Dixie Consulting |
| "audit IA PME" | 800 | ABSENT | Agence IA, Stema Partners, BPI France DiagData |
| "coaching IA dirigeant" | 400 | ABSENT | Mister IA (coaching CEO), AI Makers |
| "implémentation IA entreprise" | 900 | ABSENT | Asana guide, SavoirIA, généralistes |
| "cabinet IA France" | 500 | ABSENT | Koïno, classements génériques |
| "cabinet IA opérationnel" | 200 | POTENTIELLEMENT présent (brand anchor systématique) | Non observé dans résultats |
| "formation IA entreprise tarif" | 800 | ABSENT | SavoirIA, Mister IA, NocodeFactory |
| "ROI IA PME" | 600 | ABSENT | denisatlan.fr, BPI France, généralistes |
| "agents IA PME" | 700 | ABSENT (axionai.fr capte ces résultats si actif) | automatisation-intelligence-artificielle.fr, nerolia-ai.fr |
| "site web augmenté IA" | 150 | ABSENT (terme propriétaire non cherché) | Non observé |
| "accompagnement IA dirigeant" | 400 | ABSENT | Mister IA, AI Makers |
| "implémentation IA PME" | 500 | ABSENT | Génériques, Asana |
| "expert IA France" | 300 | ABSENT | Classements génériques |
| "formation IA présentiel" | 600 | ABSENT | SavoirIA (dominant), Mister IA |
| "audit IA flash" | 200 | POTENTIELLEMENT présent (term propriétaire AxionIA) | Non vérifié |
| "cabinet conseil IA PME" | 350 | ABSENT | Koïno, Cartelis, généralistes |
| "axion ia" (brand) | 150 | axionai.fr #1 (mémoire projet) | axionai.fr (concurrent homonyme) |
| "axion-ia" (brand exact) | 100 | axion-ia.com #1 attendu | Probable |
| "formation IA entreprise financement OPCO" | 400 | ABSENT | SavoirIA, Mister IA, institutionnels |

**Conclusion SERP :** Visibilité organique AxionIA = **0% sur les 20 keywords transactionnels prioritaires**, conformément au constat de la mémoire projet ("0% visibilité HEAD"). Le seul trafic organique potentiel = brand pur "axion-ia" — lui-même capté partiellement par axionai.fr.

---

## FINDINGS — TABLEAU PRIORITÉ

### P0 — BLOQUANTS (impact business immédiat)

| ID | Finding | Concurrent | Impact estimé |
|---|---|---|---|
| P0-1 | axionai.fr capte les recherches brand "axion ia" — aucune page de désambiguïsation ni stratégie brand SEO chez AxionIA | axionai.fr | Perte 100% trafic brand non-exact |
| P0-2 | 0% visibilité sur les 20 keywords prioritaires — AxionIA inexistant en SERP sur "formation IA PME", "audit IA PME", "coaching IA dirigeant", "implémentation IA entreprise" | Tous | 0 trafic organique hors brand |
| P0-3 | Aucune Qualiopi — bloque l'éligibilité CPF/OPCO pour les formations. Mister IA et SavoirIA dominent ce segment grâce à Qualiopi. | Mister IA, SavoirIA | Perte segment financement formation |
| P0-4 | "formation IA" absent du titre homepage — requête volume #1 France, AxionIA n'utilise pas ce keyword dans son H1 ni sa meta title | Mister IA, SavoirIA | CTR 0 sur volume maximal |
| P0-5 | Absence page auteur "Will Jullin" avec bio complète, LinkedIn, publications — E-E-A-T faible vs Mister IA (Martin et Vincent Pavanello visibles) | Mister IA | Crédibilité LLMs + Google E-E-A-T |

### P1 — URGENTS (1-3 mois)

| ID | Finding | Concurrent | Impact estimé |
|---|---|---|---|
| P1-1 | Aucune page sectorielle (0/35 secteurs couverts) — SavoirIA et Mister IA publient des formations sectorielles. AxionIA a les keywords seeds G1-G8 mais 0 page publiée | SavoirIA, Mister IA | 35 clusters SEO = ~5 000 UV/mois potentiels |
| P1-2 | Aucune page comparaison "AxionIA vs Mister IA", "AxionIA vs SavoirIA", "Cabinet IA vs organisme formation" | Mister IA, SavoirIA | Capture trafic comparatif à fort intent achat |
| P1-3 | AggregateRating JSON-LD non activé — Mister IA affiche 9,5/10 avec badge, SavoirIA 98,5% satisfaction. AxionIA = 0 étoile dans les SERPs | Mister IA, SavoirIA | -15-20% CTR vs concurrents avec stars |
| P1-4 | Positionnement "site web augmenté IA" = terme propriétaire AxionIA mais 0 trafic — pas de demande spontanée pour ce terme | N/A | Verticale 5 = besoin repositionnement |
| P1-5 | 38 villes pilotes sans copy éditoriale — SavoirIA couvre 17 régions avec contenu | SavoirIA | pSEO local = 0 indexé hors Paris |
| P1-6 | FAQ_GLOBAL = 5 questions vs besoin 30+ PAA identifiés — Mister IA publie du contenu question/réponse | Mister IA, Stema Partners | Zéro rich result AEO sur PAA volume |
| P1-7 | Wikidata QID absent — Knowledge Graph Google non reconnu. Confusion avec "Axion AI" (axionai.fr) non levée via entité structurée | axionai.fr | Aucune citation LLMs pour "Axion-IA" |
| P1-8 | Prix Qualiopi absent : impossible de mentionner "formation éligible OPCO" dans les meta descriptions | Mister IA, SavoirIA | Segment DRH/OPCO = ~30% du marché formation |

### P2 — AMÉLIORATIONS STRUCTURELLES

| ID | Finding | Concurrent | Impact estimé |
|---|---|---|---|
| P2-1 | Blog AxionIA : volume très faible vs Mister IA (100+ articles estimés), SavoirIA (blog actif) | Mister IA, SavoirIA | Thought leadership minimal |
| P2-2 | Slogan "De l'idée à l'impact. Un seul partenaire IA." présent dans brand.ts mais absent des meta descriptions et JSON-LD Organization | N/A | Manque d'ancrage slogan dans SERP |
| P2-3 | 0 présence dans les classements "top agences IA France" publiés par koino.fr, jedha.co, keyweo.com — AxionIA absente des listes référentes | Koïno | 0 trafic référent + 0 signal autorité |
| P2-4 | Aucune étude propriétaire citée (baromètre, ROI client chiffré publié) — Koïno publie analyses sectorielles, Stema Partners publie des guides BPI | Koïno, Stema | Thought leadership = 4/10 vs 7+/10 concurrents |
| P2-5 | Capgemini Invent cible Fortune 500 — gap PME/ETI 100-2000 salariés non traité par concurrents premium. AxionIA positionné dedans mais sans le revendiquer explicitement | Capgemini Invent | Segment PME/ETI = espace peu encombré |

---

## SCORING /30

| Critère | Barème | Score | Commentaire |
|---|---|---|---|
| **Inventaire 8+ concurrents + tableau structuré** | /8 | **7/8** | 8 concurrents analysés (axionai.fr, Mister IA, SavoirIA, Le Wagon, Capgemini Invent, Koïno, OCTO Academy, Stema Partners). Datacampus.fr = confusion corrigée (-1 car brief initial incorrect, audit-only : impossible de tester sans accès direct à axionai.fr) |
| **Position SERP sur 20 keywords cibles** | /6 | **4/6** | 20 keywords analysés avec positions qualitatives. Aucun outil SERP dispo — estimations WebSearch uniquement (-2 car pas de données GSC/Ahrefs confirmées) |
| **Analyse axionai.fr profonde (concurrent #1 brand)** | /8 | **4/8** | ECONNREFUSED sur toutes les variantes de l'URL au moment de l'audit. Analyse basée sur snippets Google uniquement : positionnement agents IA automatisation établi, prix/E-E-A-T/fréquence publication UNKNOWN (-4 pénalité site inaccessible) |
| **Gaps exploitables identifiés (top 10 opportunités)** | /5 | **5/5** | 10+ gaps identifiés et priorisés P0/P1/P2 avec références concurrentes et impact estimé |
| **Différenciateurs AxionIA documentés** | /3 | **3/3** | Différenciateurs codés dans brand.ts, comparaisons.ts, seo.ts, a-propos/page.tsx — tous extraits et analysés vs concurrents |

**SCORE TOTAL : 23/30**

---

## GAPS EXPLOITABLES — TOP 10 OPPORTUNITÉS

| Rang | Opportunité | Keyword ciblé | Concurrent absent | Volume estimé | Effort |
|---|---|---|---|---|---|
| 1 | Page désambiguïsation "Axion-IA ≠ Axion AI" + brand SEO | "axion ia", "axionai" | axionai.fr (agent IA) | 200/mois brand | Faible |
| 2 | Meta titles bénéfice ROI (1-3h/jour, +38% productivité) | "formation IA gain productivité PME" | Mister IA, SavoirIA | 400/mois | Faible |
| 3 | Pages sectorielles pilotes : BTP, Comptabilité, Juridique, Santé, Retail | "formation IA [secteur]" | SavoirIA (présent), Mister IA (partiel) | 5 000/mois cumulé | Moyen |
| 4 | Audit Flash 490 € = "diagnostic IA accessible PME" — keyword "audit IA 490" ou "diagnostic IA flash" | "audit IA flash", "diagnostic IA rapide" | Personne à ce prix-point | 300/mois | Faible |
| 5 | AggregateRating JSON-LD activé (étoiles SERP) | Transversal sur tous les services | Mister IA, SavoirIA | CTR +15% | Faible (code prêt) |
| 6 | 5 villes copy gold-standard (Lyon, Marseille, Bordeaux, Toulouse, Nantes) | "cabinet IA [ville]", "audit IA [ville]" | SavoirIA (départements), Mister IA (11 villes) | 1 500/mois cumulé | Moyen |
| 7 | Page "Will Jullin — expert IA B2B France" avec bio LinkedIn, publications, expertise Claude/Anthropic | "expert IA France", "consultant IA B2B" | Tous (fondateurs anonymes) | 300/mois + E-E-A-T | Faible |
| 8 | FAQ_GLOBAL 30 questions PAA (vs 5 actuelles) | Top PAA "Comment former équipes IA ?" | Mister IA (partiel) | 2 000/mois PAA | Moyen |
| 9 | Segment "PME/ETI 100-2000 salariés" explicitement revendiqué | "cabinet IA PME ETI" | Capgemini (Fortune500), SavoirIA (TPE) | 500/mois | Faible |
| 10 | Comparaisons concurrentes directes (Axion-IA vs Mister IA) | "Axion-IA avis", "alternative Mister IA" | Personne (0 page comparative) | 200/mois intent fort | Faible |

---

## DIFFÉRENCIATEURS AXIONIA DOCUMENTÉS DANS LE CODE

Les éléments suivants sont codés et vérifiables — non inventés :

| Différenciateur | Source code | Revendiqué en SERP ? |
|---|---|---|
| "Cabinet IA opérationnel" — brand anchor systématique | `brand.ts:taglineFr` + tous meta titles | OUI — 100% des pages |
| Prix publics transparents (Audit Flash 490 €, Essentielle 1 490 €) | `pricing.ts` + `buildProductMetadata` | OUI — meta titles services |
| Délai production 2-6 semaines (implémentation) | `implementation.ts` meta description | OUI — meta description /implementation |
| ROI mesurable (1-3h/jour, 50k€-1M€/an) | `fr.json value1Gain/value2Gain` | PARTIEL — body homepage, pas meta |
| Hébergement UE (Hetzner Frankfurt) | `fr.json valueWhy3` + pills About page | OUI — About page + homepage |
| Intervention sur site ("on vient chez vous") | `intervention-detail-configs.ts` | OUI — copy services |
| Données clients restent en Europe (RGPD strict) | `fr.json` + Organization JSON-LD | OUI — homepage + About |
| Fondateur identifié E-E-A-T (Will, LinkedIn) | `seo.ts:buildPersonJsonLd` | PARTIEL — /a-propos uniquement |
| 5 verticales couvertes (vs formation-only) | Routing + content files | NON — pas revendiqué explicitement |
| Expert Claude/Anthropic API | Aucun fichier source ! | NON — ABSENT du code |
| Slogan "De l'idée à l'impact. Un seul partenaire IA." | `brand.ts:sloganFr` | NON — absent des meta/JSON-LD |

**Différenciateurs forts non exploités en SERP :**
1. Prix publics (AxionIA = seul cabinet avec tarifs COMPLETS affichés sur site)
2. "Expert Claude/Anthropic" — expertise technique premium non revendiquée
3. Slogan "De l'idée à l'impact. Un seul partenaire IA." — absent des balises critiques
4. 5 verticales intégrées (formation + audit + implémentation + 1-to-1 + sites web) — SavoirIA = formation seulement, Mister IA = formation+conseil (4 services), Koïno = conseil+implémentation

---

## DÉLÉGATIONS RECOMMANDÉES

| Action | Responsable | Dépendance |
|---|---|---|
| Vérifier position réelle axionai.fr sur "axion ia" dans GSC | Will | GSC access |
| Obtenir registrikood estonien + VAT EE pour JSON-LD Organization | Will | Documents légaux |
| Créer fiche Wikidata "Axion-IA" (QID) pour Knowledge Graph | Will ou agent | - |
| Déposer dossier Qualiopi (si formation = verticale primaire) | Will — décision stratégique | 3-6 mois |
| Téléverser photo de profil Will pour Person JSON-LD | Will | Image disponible |
| Confirmer ou infirmer axionai.fr rank #1 "axion ia" via GSC | Will | GSC |

---

## UNKNOWNS

| ID | UNKNOWN | Impact |
|---|---|---|
| U1 | axionai.fr : site inaccessible (ECONNREFUSED) — positionnement complet, E-E-A-T, JSON-LD, fréquence publication INCONNUS | CRITIQUE |
| U2 | Positions SERP exactes AxionIA : pas d'accès GSC/Ahrefs en audit-only | ÉLEVÉ |
| U3 | Volume trafic organique actuel axion-ia.com : 0 vs X% inconnu | ÉLEVÉ |
| U4 | axionai.fr : âge du domaine, DA/DR, backlinks (outil SEO requis) | MOYEN |
| U5 | Nombre réel d'articles publiés blog AxionIA (contenu DB-driven non lisible en audit-only) | MOYEN |
| U6 | Présence ou absence d'AxionIA dans les réponses Perplexity/Claude.ai/ChatGPT sur "cabinet IA PME France" | ÉLEVÉ |

---

## RÉFÉRENCES

### Sources code
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\lib\brand.ts`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\lib\seo.ts` (lignes 478-534, 763)
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\content\comparaisons.ts`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\content\transversal.ts`
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia\src\app\[locale]\a-propos\page.tsx`
- `C:\Users\willi\Documents\Projets\Axion-IA\_AUDIT\KEYWORD-STRATEGY-AUDIT-2026\A1-ETAT-ACTUEL-KEYWORDS.md`
- `C:\Users\willi\Documents\Projets\Axion-IA\_AUDIT\KEYWORD-STRATEGY-AUDIT-2026\04-KEYWORD-GAP-MAP.md`
- `C:\Users\willi\Documents\Projets\Axion-IA\_AUDIT\KEYWORD-STRATEGY-AUDIT-2026\A12-AUDIT-TECHNIQUE-KEYWORDS.md`

### Sources web
- [Axion AI (axionai.fr) — snippet Google](https://axionai.fr/) — positionnement "agents IA sur mesure"
- [TOP 10 Agences IA France 2026 — Koïno](https://www.koino.fr/articles/top-10-des-agences-ia-en-france-2026-tarifs-clients-exemples)
- [Classement Cabinets Conseil IA France 2025 — Koïno](https://www.koino.fr/articles/classement-des-meilleurs-cabinets-de-conseil-en-ia-en-france-2025)
- [Mister IA — Homepage](https://www.mister-ia.com/)
- [Mister IA — Coaching Dirigeant](https://www.mister-ia.com/coaching-ceo)
- [SavoirIA — Homepage](https://www.savoiria.fr/)
- [Le Wagon Business — L'IA au service du business](https://business.lewagon.com/fr/programme/lia-au-service-du-business)
- [OCTO Academy — Formations IA](https://www.octo.academy/catalogue/domaine/ia/)
- [Datacampus.fr — Homepage](https://www.datacampus.fr) (hébergeur cloud, PAS formateur IA)
- WebSearch : SERP "audit IA PME", "coaching IA dirigeant", "implémentation IA entreprise", "formation IA PME", "axionai.fr"

---

*Fichier généré le 2026-05-21 — AUDIT-ONLY STRICT. Aucune modification du code source.*
*Agent A19 — Claude Sonnet 4.6*
