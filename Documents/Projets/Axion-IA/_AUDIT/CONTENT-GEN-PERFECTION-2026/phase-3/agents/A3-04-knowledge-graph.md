# A3-04 — Knowledge Graph & Wikidata
## Score : 34/80
## Date : 2026-05-21
## HEAD : 37ca0147

---

### Points obtenus

- [PARTIEL] sameAs dans Organization schema — 2/4 URLs réelles présentes : LinkedIn + Facebook dans `buildOrganizationJsonLd` (seo.ts:395). Image-bank ajoute LinkedIn + X/Twitter (image-jsonld-graph.service.ts:63). Wikidata, Crunchbase, Wikipedia EN absents. Score : **5/12**
- [CRITIQUE] Wikidata Q-ID absent — aucune URL `https://www.wikidata.org/wiki/Qxxxxxxx` dans le schema principal. Signal de support conditionnel uniquement dans `image-jsonld-graph.service.ts` (wikidataQid optionnel, jamais fourni). Score : **0/20**
- [PARTIEL] Organization schema fields de base — `foundingDate:"2024"`, `areaServed:["FR","EU"]`, `knowsLanguage:["fr","en"]`, `contactPoint` présents. Manquants : `numberOfEmployees`, `hasOfferCatalog`, description légale avec legalName "Axion-IA OÜ" (Estonie) absente. Score : **6/10**
- [PARTIEL] Entity disambiguation vs axionai.fr — warning `⚠️ NE PAS CONFONDRE avec axionai.fr` dans llms.txt et llms-full.txt. Mais ABSENT du JSON-LD Organization principal (pas de `description` distinctif mentionnant "axion-ia.com" vs homonyme, pas d'`alternateName`, pas de `legalName` "Axion-IA OÜ" dans Organization). Score : **4/12**
- [PARTIEL] Google Business Profile / LocalBusiness — `buildLocalBusinessJsonLd` factory créée et complète dans seo.ts (lignes 765-827) avec geo, PostalAddress, openingHoursSpecification, priceRange. Mais utilisée uniquement sur les pages villes (par-ville/*). Aucun GBP réel enregistré. Adresse FR placeholder `"[Ville — France]"` non résolue dans l'Organization. Score : **4/10**
- [MANQUANT] Mentions presse / citations tierces indexées — `PRESS_MEDIA_COVERAGE` est un array vide (press.ts:325 : `[] as const`). Press releases = auto-publications uniquement (3 communiqués de mai 2026, aucune citation tierce). Score : **0/8**
- [PARTIEL] knowsAbout + hasOfferCatalog — `knowsAbout` présent sur Person (seo.ts:524-531), sur PersonManon (ville-service-jsonld.ts:289-293), et dans image-bank Organization (6 sujets). `hasOfferCatalog` **absent de l'Organization principale** (mentionné uniquement en note keywords i-geo.ts:334 comme objectif non implémenté). Score : **5/8**

---

### Points perdus

- **[P0] Wikidata Q-ID absent — 20 pts perdus** — Knowledge Panel Google impossible sans Q-ID. Risque confusion entité maximale avec axionai.fr (concurrent homonyme rank #1 brand). Le code image-bank supporte déjà le champ `wikidataQid` optionnel (image-jsonld-graph.service.ts:40,64) mais n'a jamais reçu de valeur. Sans Wikidata, Google ne peut pas créer un panneau Knowledge Graph stable pour "Axion-IA".
- **[P0] sameAs incomplet — 7 pts perdus** — L'Organization principale (`buildOrganizationJsonLd`) ne contient que 2 URLs : LinkedIn + Facebook. X/Twitter (`https://x.com/AxionIA`) est présent seulement dans image-bank. Wikidata, Crunchbase, Wikipedia (FR/EN) absents. Les LLMs Google et Perplexity utilisent les `sameAs` pour désambigu'iser une entité — 2 sources = signal faible.
- **[P1] legalName "Axion-IA OÜ" absent — 3 pts perdus** — La raison sociale juridique réelle (entité estonienne OÜ) n'apparaît nulle part dans le code. `legalName` est partout hardcodé à `"Axion-IA"` (brand.ts:16, seo.ts:389, etc.). Google Knowledge Graph préfère le nom légal complet pour désambigu'isation ; "Axion-IA OÜ" + numéro estonien = signal fort vs homonyme.
- **[P1] hasOfferCatalog absent — 3 pts perdus** — L'Organization ne déclare pas ses 4 modules de services dans un `hasOfferCatalog`. Identifié comme objectif dans les keywords (i-geo.ts:334) mais non implémenté. Perte d'un signal AEO/GEO fort pour les requêtes "que fait Axion-IA".
- **[P1] Mentions presse tierces = 0 — 8 pts perdus** — Aucune citation indexée dans des médias tiers. `PRESS_MEDIA_COVERAGE` vide explicitement. Sans backlinks presse, le Knowledge Graph n'a pas de corroboration externe pour l'entité Axion-IA, fragilisant l'autorité vs axionai.fr.
- **[P2] addressLocality placeholder — 2 pts perdus** — L'adresse dans l'Organization principale est `"[Ville — France]"` (seo.ts:402, image-jsonld-graph.service.ts:104) — placeholder non résolu. Google Validator peut flagguer ce champ comme invalide. LocalBusiness sur page contact absent (ContactPage JSON-LD sur /contact ne contient pas d'adresse).
- **[P2] numberOfEmployees absent — 1 pt perdu** — Champ absent de l'Organization principale. Signal de taille d'entité pour Knowledge Graph (même `"1-10"` constitue un signal utile).

---

### Analyse Organization schema

#### sameAs présents
| Fichier | URLs présentes |
|---------|---------------|
| `src/lib/seo.ts` (buildOrganizationJsonLd) | `https://www.linkedin.com/company/axion-ia`, `https://www.facebook.com/axionia` |
| `src/lib/seo/ville-service-jsonld.ts` (LocalBusiness par-ville) | `https://www.linkedin.com/company/axion-ia` + Wikipedia FR de la ville |
| `src/server/image-bank/services/image-jsonld-graph.service.ts` | `https://www.linkedin.com/company/axion-ia`, `https://x.com/AxionIA` + Wikidata conditionnel (jamais fourni) |
| `src/app/[locale]/presse/page.tsx` | `https://www.linkedin.com/company/axion-ia` |

#### sameAs manquants (P0 / P1)
| URL | Priorité | Raison |
|-----|----------|--------|
| `https://www.wikidata.org/wiki/Qxxxxxxx` | **P0** | Désambigu'isation entité Google KG — sans Q-ID, pas de Knowledge Panel |
| `https://x.com/AxionIA` | P1 | Présent dans image-bank mais absent de l'Organization principal seo.ts |
| `https://fr.wikipedia.org/wiki/Axion-IA` | P1 | Page Wikipedia inexistante (à créer après Wikidata) |
| `https://www.crunchbase.com/organization/axion-ia` | P2 | Signal profil startup/consultance |
| `https://www.google.com/maps/place/?q=Axion-IA` | P2 | Google Business Profile (conditionnel : nécessite adresse physique) |

#### Champs Organization — état actuel
| Champ Schema.org | Présent | Valeur | Qualité |
|------------------|---------|--------|---------|
| `@type` | Oui | "Organization" | OK |
| `@id` | Oui | `${SITE_URL}/#organization` | Stable — bon |
| `name` | Oui | "Axion-IA" | OK |
| `legalName` | Oui | "Axion-IA" | Incomplet — manque "OÜ" |
| `url` | Oui | SITE_URL | OK |
| `logo` | Oui | `/opengraph-image` | OK (ImageObject absent) |
| `description` | Oui | FR/EN 1 phrase | OK |
| `sameAs` | Partiel | 2 URLs | Insuffisant |
| `foundingDate` | Oui | "2024" | OK |
| `foundingLocation` | Oui | FR avec placeholder ville | Partiel |
| `areaServed` | Oui | `["FR","EU"]` | OK |
| `knowsLanguage` | Oui | `["fr","en"]` | OK |
| `contactPoint` | Oui | email + type | OK |
| `numberOfEmployees` | **Non** | — | Manquant |
| `hasOfferCatalog` | **Non** | — | Manquant P1 |
| `vatID` | Conditionnel | via env var | Dépend de COMPANY_VAT_NUMBER |
| `identifier (RCS)` | Conditionnel | via env var | Dépend de COMPANY_REGISTRATION_NUMBER |

---

### Analyse entity disambiguation

#### Risque homonyme axionai.fr
Le concurrent axionai.fr (sans tiret) occupe le rank #1 sur les requêtes brand "Axion IA". Google peut confondre les deux entités dans son Knowledge Graph car :
- Les deux entités partagent le même n-gram "Axion IA"
- Axion-IA OÜ n'a pas de Q-ID Wikidata (pas d'ancre Google KG stable)
- Aucun signal légal distinguant les deux (SIREN/RCS vs OÜ estonien)

#### Signaux de disambiguation existants (positifs)
1. **llms.txt / llms-full.txt** : avertissement explicite `⚠️ NE PAS CONFONDRE avec axionai.fr` — efficace pour les LLMs qui crawlent ces fichiers (Perplexity, Claude, ChatGPT). Mais les LLMs ne sont pas Google.
2. **Domaine** : `axion-ia.com` (avec tiret) vs `axionai.fr` (sans tiret) — différence dans les sameAs URLs.
3. **`foundingLocation: FR`** + hébergement Hetzner Frankfurt = signal géographique FR distinct.

#### Signaux de disambiguation manquants (critiques)
1. **Wikidata Q-ID** : seul vrai moyen de créer une entité stable Google KG séparée d'axionai.fr.
2. **legalName "Axion-IA OÜ"** : différencie juridiquement de tout homonyme.
3. **Description schema distinctive** : aucun champ ne mentionne "axion-ia.com" dans le JSON-LD Organization pour différencier de "axionai.fr".
4. **Wikipedia FR** : sans article Wikidata + Wikipedia, l'entité reste "orpheline" pour Google.

---

### Instructions Wikidata Q-ID

#### Qui crée
Will (propriétaire) — Wikidata exige une personne physique pour les nouvelles entrées sur des sujets de notoriété limitée. Un compte Wikidata vérifié (même récent) suffit.

#### Procédure de création (durée estimée : 45-90 min)

**Prérequis**
1. Créer un compte sur https://www.wikidata.org/wiki/Special:CreateAccount
2. Confirmer l'email
3. Attendre 4 jours (nouveaux comptes ne peuvent pas créer d'items de suite) — OU utiliser le mode "bac à sable" pour préparer le contenu en avance.

**Contenu minimal de l'item Wikidata**
```
Label (fr) : Axion-IA
Label (en) : Axion-IA
Description (fr) : cabinet de conseil en intelligence artificielle opérationnelle, France
Description (en) : operational AI consultancy, France
Alias (fr) : Axion IA, axion-ia.com
Alias (en) : Axion IA

Propriétés obligatoires :
- P31 (nature de l'élément) : Q4830453 (entreprise)
- P856 (site officiel) : https://axion-ia.com
- P495 (pays d'origine) : Q142 (France) — siège opérationnel FR même si entité légale OÜ
- P571 (date de fondation) : 2024
- P17 (pays) : Q142 (France)

Propriétés recommandées :
- P18 (image) : logo Axion-IA (uploader sur Commons d'abord)
- P154 (logotype) : idem
- P306 (pays d'incorporation) : Q191 (Estonie) — entité OÜ
- P407 (langue des œuvres/travaux) : Q150 (français), Q1860 (anglais)
- P1581 (blog officiel) : https://axion-ia.com/fr/blog
- P2013 (compte Facebook) : axionia
- P4264 (compte LinkedIn) : axion-ia
- P2002 (compte Twitter) : AxionIA (si compte vérifié)
```

**Après création**
1. Récupérer le Q-ID (format QxxxxxxX)
2. Ajouter `https://www.wikidata.org/wiki/Qxxxxxxx` dans `sameAs` de `buildOrganizationJsonLd` (seo.ts)
3. Passer le `wikidataQid` à `buildOrganization` dans `image-jsonld-graph.service.ts`
4. Google Search Console > Paramètres > vérifier l'apparition du Knowledge Panel (délai 2-8 semaines)

**Délai recommandé : IMMÉDIAT — action critique P0**

#### Critère de notoriété Wikidata
Axion-IA répond au critère minimum "site web dédié" (P856) et "entreprise enregistrée" (P571). Pour renforcer la notoriété : ajouter 2-3 mentions presse externes avant la création de l'item (augmente les chances de survie de l'item face aux suppressions "pas notable").

---

### Recommandation GBP avec/sans adresse FR

#### Option A — Avec adresse physique FR (recommandée)
- Enregistrer une adresse FR stable : WeWork Paris (~300€/mois HT) ou adresse domiciliation (~50€/mois)
- Créer Google Business Profile sur https://business.google.com
- Bénéfices : Local Pack Google Maps, "Axion-IA Paris" dans les SERPs locaux, signal fort désambigu'isation vs axionai.fr (adresses différentes)
- Ajouter l'adresse dans `buildOrganizationJsonLd` (remplacer placeholder `"[Ville — France]"`)
- Ajouter `LocalBusiness` schema sur la page `/contact` (actuellement absent)

#### Option B — Sans adresse physique (minimal)
- GBP "Service Area Business" — Google permet les GBP sans adresse pour les prestataires itinérants
- Zone de service : Île-de-France + France métropolitaine
- Moins puissant pour le Local Pack, mais éligible aux rich snippets "Service Business"
- Action immédiate : résoudre le placeholder `"[Ville — France]"` → remplacer par "Paris" ou la ville réelle de Will

**Recommandation :** Option B immédiat (0€, 1h), Option A à 3 mois (budget ~300-600€/mois).

---

### Recommandations ordonnées par ROI

#### 1. Quick wins (<2h)

**QW-1 — Créer compte Wikidata + préparer l'item** (~45 min)
- Créer compte Wikidata, préparer le draft de l'item avec les propriétés minimales listées ci-dessus
- Attendre 4 jours pour activation (ou demander aide d'un contributeur expérimenté)
- ROI : déblocage Knowledge Panel Google — impact Knowledge Graph maximal

**QW-2 — Ajouter X/Twitter à sameAs principal** (~15 min)
- Fichier : `src/lib/seo.ts`, function `buildOrganizationJsonLd`, ligne 395
- Ajouter `"https://x.com/AxionIA"` au tableau `sameAs`
- Vérifier que le handle `@AxionIA` est bien actif sur X (si non, créer ou corriger le handle)
- ROI : cohérence sameAs entre image-bank et Organization principale

**QW-3 — Résoudre le placeholder adresse** (~20 min)
- Remplacer `"[Ville — France]"` dans seo.ts:402 par la vraie ville (Paris ou autre)
- Même fix dans image-jsonld-graph.service.ts:104
- ROI : évite le flag Google Validator sur adresse invalide

**QW-4 — Corriger legalName vers "Axion-IA OÜ"** (~30 min)
- Mettre à jour `brand.ts:16` : `legalName: "Axion-IA OÜ"`
- Propager dans `buildOrganizationJsonLd` (seo.ts:389)
- Ajouter `alternateName: "Axion IA"` pour couvrir les variantes de recherche
- ROI : signal légal fort pour disambiguation vs axionai.fr

#### 2. Sprint (<1 jour)

**S-1 — Ajouter hasOfferCatalog à l'Organization** (~2h)
- Dans `buildOrganizationJsonLd`, ajouter :
```typescript
hasOfferCatalog: {
  "@type": "OfferCatalog",
  name: isFr ? "Services IA Axion-IA" : "Axion-IA AI services",
  itemListElement: [
    { "@type": "Offer", itemOffered: { "@type": "Service", name: isFr ? "Interventions IA" : "AI sessions" } },
    { "@type": "Offer", itemOffered: { "@type": "Service", name: isFr ? "Audit IA" : "AI audit" } },
    { "@type": "Offer", itemOffered: { "@type": "Service", name: isFr ? "Implémentation IA" : "AI implementation" } },
    { "@type": "Offer", itemOffered: { "@type": "Service", name: isFr ? "Coaching 1-to-1" : "1-on-1 coaching" } },
  ]
}
```
- ROI : signal AEO "que fait Axion-IA" pour LLMs

**S-2 — Ajouter numberOfEmployees** (~15 min)
- Dans `buildOrganizationJsonLd`, ajouter :
```typescript
numberOfEmployees: { "@type": "QuantitativeValue", value: 1, maxValue: 10 }
```
- ROI : signal taille entreprise Google KG

**S-3 — LocalBusiness sur page /contact** (~1h)
- Ajouter `buildLocalBusinessJsonLd` sur la page contact.tsx (actuellement seul `ContactPage` schema)
- Utiliser l'adresse FR résolue (suite QW-3)
- ROI : signal local pour "cabinet IA Paris" + GBP alignment

**S-4 — Ajouter description disambiguation dans Organization** (~20 min)
- Modifier la description de `buildOrganizationJsonLd` pour inclure le domaine explicitement :
```typescript
description: isFr
  ? "Cabinet IA opérationnel B2B — axion-ia.com (avec tiret). Interventions, audits et implémentation IA pour entreprises. Entité distincte d'axionai.fr."
  : "Operational B2B AI consultancy — axion-ia.com (with hyphen). On-site AI sessions, audits and implementation for companies. Distinct entity from axionai.fr."
```
- ROI : signal texte explicit pour désambigu'isation dans les embeddings LLMs

#### 3. Projets (>1 jour)

**P-1 — Créer une page Wikipedia FR sur Axion-IA** (~1 semaine de travail éditorial)
- Prérequis : avoir au moins 2-3 mentions presse tierces indexées
- Créer un brouillon sur https://fr.wikipedia.org/wiki/Brouillon
- Contenu minimal : infobox entreprise (fondation, siège, secteur), historique, services
- Lier à l'item Wikidata (P18 Wikipedia)
- ROI : signal tiers le plus fort pour Google Knowledge Panel après Wikidata

**P-2 — Obtenir 3+ citations presse tierces indexées** (~1-3 mois)
- Cibles : Blog du Modérateur, Le Monde Informatique, JDN, Usine Digitale, BFM Business
- Stratégie : communiqué lancement + étude IA PME France publiée en open access
- PRESS_MEDIA_COVERAGE est prêt à recevoir les références (press.ts ligne 325)
- ROI : `sameAs` citation presse dans Organization + score E-E-A-T + désambigu'isation passive

**P-3 — Crunchbase profile** (~2h)
- Créer un profil sur https://www.crunchbase.com/add-a-company
- Infos : nom, URL, fondateur, date, secteur "AI consulting", ville
- Ajouter l'URL Crunchbase dans `sameAs` Organization
- ROI : source tierce B2B-credible pour Knowledge Graph

**P-4 — Google Business Profile "Service Area Business"** (~2h setup + validation)
- Créer GBP sans adresse physique (Service Area Business)
- Zone : France métropolitaine
- Catégorie : "AI consultant" ou "Technology consultant"
- Synchroniser NAP (Name, Address, Phone) avec les données schema
- ROI : apparition dans Google Maps + Local Pack pour "cabinet IA [ville]"

---

### Résumé des actions critiques

| ID | Action | Priorité | Effort | ROI |
|----|--------|----------|--------|-----|
| QW-1 | Créer item Wikidata Q-ID | **P0 bloquant** | 45 min | Knowledge Panel Google |
| QW-4 | legalName "Axion-IA OÜ" + alternateName | P0 | 30 min | Désambigu'isation entité |
| QW-2 | X/Twitter dans sameAs principal | P1 | 15 min | Cohérence KG |
| QW-3 | Résoudre placeholder adresse | P1 | 20 min | Validator compliance |
| S-1 | hasOfferCatalog Organization | P1 | 2h | AEO "que fait Axion-IA" |
| S-2 | numberOfEmployees | P2 | 15 min | Signal KG taille |
| S-3 | LocalBusiness /contact | P2 | 1h | Local SEO |
| P-1 | Page Wikipedia FR | P2 | 1 semaine | Trust signal maximal |
| P-2 | 3+ citations presse tierces | P2 | 1-3 mois | E-E-A-T + KG corroboration |

**Score actuel : 34/80 — insuffisant pour déclencher un Knowledge Panel Google.**
**Score cible après QW-1+QW-4+QW-2+QW-3+S-1+S-2 : ~58/80 — seuil Knowledge Panel atteignable en 2-3 semaines.**
