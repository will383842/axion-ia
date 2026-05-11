# AGT-15 — CONTENT-CRO

**Audit E2E Axion-IA 2026-05-11 · Pondération ×1.3 · Mode AUDIT-ONLY**
**Périmètre** : copy ton premium FR/EN, anti-jargon, H1/H2/H3, ratio Axion-IA-centric, mots utiles parents, CTA hierarchy, micro-copy, ratio villes, pricing affichage, E-E-A-T.
**Méthode** : grep ciblé sur 14 angles + comptage mots via helper Node + lecture ciblée Top 10 pages + cross-check doctrine `_AUDIT/PROMPT-E2E-DEEP-AUDIT-2026.md` § 0.1.

---

## Score : **88/100**

Bon niveau global : doctrine naming respectée à 99 %, phrases interdites éradiquées (sauf rares cas commentés), ton premium homogène, CTA `Réserver` cohérent, micro-copy formulaires calme et factuel. Trois points fragilisent le score : (1) drift factuel **Hetzner Frankfurt vs Nuremberg** présent dans 14 occurrences dont legal + presse + llms-full.txt (P1 RGPD/factuel) ; (2) `/methodologie` à **~850 mots FR**, sous le plancher 1500-3000 doctrine prompt master § 4.15 ; (3) `cabinet de conseil IA opérationnel` dans `press.ts:121` au lieu de `cabinet IA opérationnel` (P2 cohérence).

## Confiance : **haute**

Justifications :

- SSOT brand confirmé `src/lib/brand.ts:18-20` + 15 fichiers FR + 13 EN ré-utilisant les taglines.
- Comptage mots via script Node sur 26 fichiers (page + content) — chiffres reproductibles.
- Grep exhaustif sur les 4 phrases interdites doctrine (≥ 95 % AxionIA, ½ journée, basé en UE, sur-mesure-interdit) — toutes en commentaires uniquement sauf cas tagués.
- 32 pages utilisent `titleAs="h1"` via composant `Section` (Grep) — pas de double-h1 réel détecté (le seul candidat `comparaisons/[slug]/page.tsx:105+116` est en branches ternary disjoints).
- 118 invocations de `formatPrice()` / `formatAmount()` sur 23 routes confirment l'adoption SSOT pricing.

Limites : pas d'inspection humaine ligne-à-ligne des 1899 lignes `interventions.ts` (échantillonnage), pas de lecture des EN equivalents pour chaque FR string (parity assumée — voir AGT-06 i18n).

---

## Top findings

### P0 (bloquant prod / sécu / RGPD / SEO critique)

- **Aucun P0** détecté côté Content/CRO. Le drift Hetzner Frankfurt vs Nuremberg est P1 (factuel, à vérifier par Will via console Hetzner — la phrase « hébergement UE » reste vraie quel que soit le DC).

### P1 (sérieux)

| ID      | Titre                                                                                                                                                                                                                                                                                                                                                               | Citation                                                                                                                                                                                     | Impact                                                                                                                                                                                                                                               |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1-15.1 | **Drift Hetzner Frankfurt vs Nuremberg** — 14 mentions « Hetzner Frankfurt » dans copy publique (legal, presse, llms-full.txt, BookingCalendar, README, docker-compose, runbooks) alors que mémoire Will + `_AUDIT/PROMPT-PLATFORM-VERIFICATION-COMPLETE-2026.md:482` indiquent **Nuremberg** (IP `178.105.55.15`). Si la vraie DC est Nuremberg, la copy RGPD ment | `src/content/legal.ts:52,85,226,271` + `src/content/press.ts:152-153,310,315-316,416,421` + `src/app/llms-full.txt/route.ts:57,98` + `src/components/calendar/BookingCalendar.tsx:1934-1935` | RGPD : déclaration sous-processeur fausse, risque sanction CNIL si audit. Sinon : mineur. **STOP & ASK Will : confirmer DC réelle Hetzner CPX32.**                                                                                                   |
| P1-15.2 | **`/methodologie` ~850 mots FR**, sous plancher doctrine 1500-3000 mots (prompt master § 4.15)                                                                                                                                                                                                                                                                      | helper node count : `methodologie/page.tsx`=829 + transversal partagé=902 (FR≈450 chacun), total FR ≈ **850**                                                                                | SEO/AEO : pas assez de matière pour positionner une page parent stratégique. Plan suggéré : ajouter section « 4 étapes détaillées » (200 mots × 4 = 800), section « ce qu'on ne fait pas » (200 mots), FAQ méthodo (300 mots). Cible ≥ 1700 mots FR. |
| P1-15.3 | **`/comparaisons` parent ~400 mots FR uniquement** ; les 3 slugs ont ~130 mots de body chacun (sous SEO standard 800-1500 pour comparison articles)                                                                                                                                                                                                                 | `src/app/[locale]/comparaisons/page.tsx`=403 + `src/content/comparaisons.ts`=449 (3 fixtures × ~130 mots FR body)                                                                            | SEO : peu de chance de ranker sur « cabinet IA vs SaaS », « fine-tuning vs RAG » sans étoffage. Sprint 15 doit remplacer fixtures par Prisma + étoffer (commentaire `comparaisons.ts:1`)                                                             |
| P1-15.4 | **`press.ts:121` dévie naming doctrine** : « cabinet de conseil IA opérationnel » au lieu de « cabinet IA opérationnel » (SSOT `src/lib/brand.ts:18`)                                                                                                                                                                                                               | `src/content/press.ts:121`                                                                                                                                                                   | Cohérence presse / risque qu'un journaliste reprenne la formulation hybride. Correctif 1 mot.                                                                                                                                                        |
| P1-15.5 | **`automatisations.ts:309,370` utilise « 10x plus vite »** — slogan jargon proche de « boostez » interdit par doctrine ton premium                                                                                                                                                                                                                                  | `src/content/automatisations.ts:309` (FR) + `:370` (EN)                                                                                                                                      | Ton premium : aligner avec voix factuelle. Préférer « plusieurs fois plus vite » ou un chiffre vérifié.                                                                                                                                              |

### P2 (confort / polish)

| ID      | Titre                                                                                                                                                                                                                                                                                                                 | Citation                                                                       |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| P2-15.1 | `audit.ts:486` (`hint: "Artisan, freelance, small team"`) et `automatisations.ts:142` (`audience: "Small business / freelance professionals"`) — terme `freelance` utilisé pour décrire la cible client. Doctrine bannit le mot pour Axion-IA mais OK pour cibles. Ambigu pour le lecteur. Re-tagger « indépendant ». | `src/content/audit.ts:486` + `src/content/automatisations.ts:142`              |
| P2-15.2 | Page d'accueil `[locale]/page.tsx` ~365 mots FR (731/2) — la home étant route racine, on attend volontiers ≥ 600 mots FR pour signal SEO/AEO                                                                                                                                                                          | helper count `731` mixte FR+EN                                                 |
| P2-15.3 | `/presse` page rend 68 mots côté `presse/page.tsx` (les 1156 mots `press.ts` sont chargés en runtime via i18n + le composant `PressFaqAccordion`). Vérifier que TOUT le contenu `press.ts` est rendu côté HTML statique (et non lazy/client-only) — risque SEO si `noscript` body vide                                | `src/app/[locale]/presse/page.tsx` mots=68 vs `src/content/press.ts` mots=1156 |
| P2-15.4 | E-E-A-T case studies : `testimonialAuthor: "C. Lambert"` (initiale + nom seul) — pas de date, pas de LinkedIn, pas de nom entreprise complet                                                                                                                                                                          | `src/content/case-studies.ts:55,68-69,90,127-128,161-162,194-195`              |
| P2-15.5 | `interventions.ts:1072,1525,1618` utilisent jargon EN « unlocks », « state of the art », « cutting-edge » — léger drift ton premium (versions FR sont plus sobres)                                                                                                                                                    | `src/content/interventions.ts:1072,428,1069,1525,1618`                         |
| P2-15.6 | Pas de lint script `anti-doctrine-phrases:check` — protection naming/jargon non automatisée (seuls `anti-siren:check` + `anti-hex:check` existent dans `package.json`)                                                                                                                                                | `package.json` lines `anti-siren:check` + `anti-hex:check`                     |
| P2-15.7 | `transversal.ts:221` utilise « atelier de restitution » — OK contextuel (sous-composant d'audit), mais doctrine veut éviter « atelier » seul pour Axion-IA. Surcharger « restitution » suffit                                                                                                                         | `src/content/transversal.ts:221`                                               |
| P2-15.8 | `press.ts:344-345,349-350` titre Will « lead consultant » — doctrine ne bannit pas mais « lead intervenant » ou « lead operator » serait plus cohérent avec positionnement « operational »                                                                                                                            | `src/content/press.ts:344-345,349-350`                                         |

---

## Détail par sous-chapitre

### 1. Naming compliance — `agence / studio / atelier / freelance / AI agency / cabinet de conseil`

**Grep `\bagence\b`** :

- 3 occurrences dans `automatisations.ts:309,315,333` → toutes en référence concurrents (« sans agence », « coûts d'agence ») ✅ DOCTRINE OK.
- `AuditConversionBlocks.tsx:176-177` → comparatif Big4/freelance/agence digitale ✅ OK.
- `implementation/page.tsx:201,208,241,979` → bloc comparatif Make/Agence/Axion-IA ✅ OK.

**Grep `\bstudio\b`** : 2 occurrences `press.ts:403,408` → « studio ou visio HD » (référence physique tournage podcast) ✅ contextuel OK.

**Grep `\bfreelance\b`** :

- `automatisations.ts:142` (`audience: "Small business / freelance professionals"`) → ambigu, freelance comme cible client ⚠️ P2-15.1.
- `AuditConversionBlocks.tsx:176-177` → comparatif concurrent ✅.
- `audit/page.tsx:486` (`hint: "Artisan, freelance, small team"`) → cible client TPE ⚠️ P2-15.1.

**Grep `\batelier\b`** (résultats Grep initial) :

- `interventions.ts:391,397,403,601,607,613,1401` → "Atelier 1/2/3" sous-composants Essentielle / Approfondie ✅ OK (atelier = sous-livrable, pas le format).
- `audit.ts:339` → "1 atelier direction + 3-6 ateliers métiers" ✅ OK (sous-livrable audit).
- `paris.ts:124,184,531` → "Atelier de restitution Paris" ✅ OK contextuel.
- `transversal.ts:221` → « atelier de restitution 2 h » ⚠️ P2-15.7 (peut être renommé « restitution »).
- `stack-ia.ts:128` → "L'atelier" comme titre de section ⚠️ vérifier contexte mais probable OK.

**Grep `AI agency` / `ai agency`** : 0 occurrence ✅ DOCTRINE OK.

**Grep `cabinet de conseil`** :

- `press.ts:121` (`cabinet de conseil IA opérationnel`) ⚠️ **P1-15.4 — dévie doctrine** « cabinet IA opérationnel » (sans « de conseil »).
- `villes/copy/paris.ts:187,291` → "cabinet de conseil traditionnel" en référence concurrent ✅ OK.
- `cas-concrets/[slug]/page.tsx:74` → JSON-LD `name: "Conseil IA opérationnel Axion-IA"` ⚠️ P2 — schema.org `Service.provider.name` should match `BRAND.name` = `Axion-IA` strict. Currently mixes.
- `interventions/essentielle/page.tsx:52` (`serviceType: "AI consulting"`) ✅ acceptable pour JSON-LD service classification.
- `implantations/[region]/[ville]/page.tsx:496-497` → "Un cabinet IA opérationnel n'est pas […] ni un cabinet de conseil traditionnel" ✅ OK différenciation.

**Verdict** : 99 % conforme. 1 dérive P1 (press.ts:121) + 2 cas borderline P2.

### 2. Phrases interdites doctrine

**Grep `½ journée | demi-journée`** :

- `automatisations.ts:439,857` → « gagner une demi-journée par jour » / « 15 min au lieu d'une demi-journée » ✅ — décrit gain client, pas format Axion-IA.
- `paris.ts:8` + `interventions.ts:85,88` + `pricing.ts:240,242` + `interventions/page.tsx:368` → **commentaires de doctrine** (notes Sprint 14.10.4 actant suppression) ✅ OK.

**Grep `basé en UE`** : 0 occurrence en string actif. 2 occurrences en commentaires `paris.ts:4,87` ✅.

**Grep `pas de plan sur-mesure`** : 0 occurrence active.

**Grep `sur-mesure`** : 1 occurrence active `paris.ts:364` (`Combinaisons sur-mesure pour les sièges parisiens`) ⚠️ — selon doctrine, « pas de plan sur-mesure » est interdit, mais l'emploi positif « combinaisons sur-mesure » est ambigu. À clarifier avec Will (peut être OK ou P2).

**Grep sizes hors INSEE** (`indépendant`, `auto-entrepreneur`, `très petite entreprise` hors TPE/PME/ETI/GE) : pas exhaustivement testé, mais `pricing.ts:254-306` + page templates utilisent strictement les 4 classifications INSEE ✅.

### 3. `cabinet IA opérationnel` (FR) usage

**Présence dans `src/`** (Grep) :

- `src/lib/brand.ts:18` ✅ **SSOT**.
- `src/content/press.ts` (mais variant `cabinet de conseil IA opérationnel` ligne 121 ⚠️ P1-15.4).
- `src/content/transversal.ts` ✅.
- `src/lib/email/templates/_layout.tsx` ✅.
- `src/content/villes/copy/paris.ts:49` ✅ (« Axion-IA est un cabinet IA opérationnel »).
- `src/content/comparaisons.ts:17` ✅ (« Le cabinet IA opérationnel comme Axion-IA »).
- `src/app/[locale]/sections/page.tsx`, `page.tsx`, `implantations/.../page.tsx`, `contact/page.tsx`, `comparaisons/page.tsx`, `a-propos/page.tsx` ✅.
- `src/app/llms-full.txt/route.ts:54,62` ✅.

**Couverture surfaces premium** : home + interventions + audit + implementation + a-propos + villes pilotes + presse + llms.txt + JSON-LD = couverture exhaustive ✅.

**Absence remarquable** : `src/messages/fr.json` ne contient PAS la tagline (centralisée dans `brand.ts` à la place). C'est cohérent doctrine SSOT mais demande vigilance i18n : si un dev ajoute une page sans importer `BRAND.taglineFr`, le naming peut dévier.

### 4. `operational AI consultancy` (EN) usage

**Présence dans `src/`** (13 fichiers EN miroir) : même répartition que FR, miroir 1:1.

- `src/lib/brand.ts:20` ✅ SSOT.
- `src/content/press.ts:127` (« Axion-IA OÜ is an operational AI consultancy ») ✅.
- `src/content/villes/copy/paris.ts:51` ✅.
- `src/content/comparaisons.ts:23` (« An operational AI consultancy like Axion-IA ») ✅.
- `src/app/llms-full.txt/route.ts` ✅.
- Pas dans `messages/en.json` — même remarque doctrine SSOT.

**Verdict** : parity EN/FR ✅.

### 5. H1 unique par page (sample : audit, interventions, /reserver, /comparaisons, /presse)

Grep `<h1\b` + `titleAs="h1"` :

| Page                              | h1 source                                                       | Unique ?                                                                              |
| --------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `/audit`                          | `audit/page.tsx:355` direct `<h1>`                              | ✅ unique                                                                             |
| `/interventions`                  | `interventions/page.tsx:608` direct `<h1>`                      | ✅ unique                                                                             |
| `/reserver`                       | `reserver/page.tsx:428` direct `<h1>`                           | ✅ unique                                                                             |
| `/comparaisons` parent            | `comparaisons/page.tsx:101` direct `<h1>`                       | ✅ unique                                                                             |
| `/comparaisons/[slug]`            | `comparaisons/[slug]/page.tsx:105` ET `:116` via `titleAs="h1"` | ✅ — c'est un ternary `vsMatch ? :` (branches mutuellement exclusives, un seul rendu) |
| `/presse`                         | `presse/page.tsx:202` via `Section titleAs="h1"`                | ✅ unique                                                                             |
| `/methodologie`                   | `methodologie/page.tsx:221` `<h1>`                              | ✅ unique                                                                             |
| `/implementation`                 | `implementation/page.tsx:701` `<h1>`                            | ✅ unique                                                                             |
| Home `/`                          | `page.tsx:229` `<h1>`                                           | ✅ unique                                                                             |
| `/implantations/[region]/[ville]` | template:225 `<h1>` ou stub:857 `titleAs="h1"`                  | ✅ branches exclusives selon `ville.copy`                                             |
| `/sections` (sandbox)             | `<h1>` ✅ + bloqué robots.txt ✅                                |

52 fichiers `page.tsx` ont 1 occurrence `h1` chacun (incluant 30+ admin) — pas de page sans h1 détectée dans la liste publique parcourue.

**Verdict** : conformité h1 ✅.

### 6. Mots utiles parents (1500-3000 mots FR cible doctrine)

Comptage helper Node (FR+EN mixé, divisé /2 pour estimation FR seule) :

| Parent page (route)                              | Page TSX mots (mixte) | Content TS mots (mixte) | **Total FR estimé**                   | Verdict cible 1500-3000                     |
| ------------------------------------------------ | --------------------- | ----------------------- | ------------------------------------- | ------------------------------------------- |
| `/audit`                                         | 2284                  | 1366 (audit.ts)         | ≈ **1825**                            | ✅                                          |
| `/interventions`                                 | 1795                  | 4359 (interventions.ts) | ≈ **3077**                            | ✅ borderline haut                          |
| `/implementation`                                | 2847                  | 781 (implementation.ts) | ≈ **1814**                            | ✅                                          |
| `/methodologie`                                  | 829                   | 902 partagé transversal | ≈ **865**                             | ⚠️ **P1-15.2**                              |
| `/comparaisons` parent                           | 403                   | 449 (3 fixtures totaux) | ≈ **426**                             | ⚠️ P1-15.3 (parent landing + slugs faibles) |
| `/stack-ia`                                      | 1395                  | 2186                    | ≈ **1790**                            | ✅                                          |
| `/contact`                                       | 911                   | —                       | ≈ **456**                             | OK (formulaire ≠ longform)                  |
| `/cas-concrets`                                  | 550                   | 673 (5 fixtures)        | ≈ **612**                             | OK (listing)                                |
| `/blog`                                          | 356                   | —                       | ≈ **178**                             | OK (listing)                                |
| Home `/`                                         | 731                   | (mixte content)         | ≈ **365**                             | ⚠️ P2-15.2 (home mérite plus de texte)      |
| `/a-propos`                                      | 521                   | —                       | ≈ **260**                             | ⚠️ P2 — page autorité E-E-A-T sous-équipée  |
| `/presse`                                        | 68 (page)             | 1156 (press.ts)         | ≈ **612** content rendu via composant | ⚠️ P2-15.3 — vérifier SSR vs lazy           |
| `/reserver`                                      | 153 + BookingCalendar | —                       | ≈ **76 + calendrier**                 | OK (interactive ≠ longform)                 |
| `/implantations/[region]/[ville]` (Paris pilote) | 1096 page             | 4081 paris.ts           | ≈ **2588**                            | ✅ gold standard                            |

**Verdict** : 4/14 parents publics auditables en dessous ou borderline (methodologie + comparaisons + home + a-propos). 9 ✅. 1 cas à investiguer SSR (presse).

### 7. Ton premium (pas de "🚀", "boostez", "explosez")

**Grep emojis 🚀💥** : 0 occurrence dans `src/content`. Quelques `Rocket` icon Lucide React (`gagner-du-temps/page.tsx:5,81`, `MethodologyHeroSchema.tsx:22,71,93`) mais c'est une **icône SVG**, pas un emoji. ✅ OK.

**Grep `boost / boostez / décolle / cartonne / super / génial / awesome / amazing / magique`** : 0 occurrence dans `src/content` ✅.

**Grep `10x / 100x / skyrocket / growth hack`** :

- `automatisations.ts:309` (« 10x plus vite, sans agence ») + `:370` (« 10x faster, no agency needed ») ⚠️ **P1-15.5** — jargon proche « boostez ».
- `case-studies.ts:185` (« Agent IA de prospection LinkedIn et qualification de leads entrants ») — `leads` ✅ usage métier B2B standard.

**Verdict** : 1 P1 (10x), reste conforme ton premium ✅.

### 8. CTA hierarchy

**CTA primaire global** : header `nav/Header.tsx:136,142` + `:191,197` → `href="/reserver"` + label `t("cta.bookInterventionLong")` = « Réserver une intervention en entreprise » ✅ unifié desktop + mobile.

**Pricing badge dans CTA header** : `Header.tsx:147` injecte `ctaPriceBadge` (prix Essentielle dérivé `pricing.ts`) ✅ adopté SSOT.

**CTA primaires par page** (Grep `ctaPrimary`) :

- Audit : 4 variants (« Réserver mon diagnostic flash », « Demander un audit ciblé », « Demander un audit stratégique PME », « Demander un audit stratégique ETI ») — **hiérarchie par tier** ✅ cohérent.
- Interventions : « Réserver une intervention », « Réserver l'Approfondie », « Demander un devis conférence », « Réserver votre journée Direction », « Réserver Gagner du temps », « Demander un devis Claude » — pattern « Réserver » pour formats fixes + « Demander un devis » pour custom ✅.
- Implementation : « Demander un devis » (toutes prestations sur devis car gamme 5-50 k€) ✅.

**CTA secondaire** : 5 pages utilisent « Voir les cas concrets » / « See case studies » (`interventions/page.tsx:635`, `methodologie/page.tsx:241`, `audit/page.tsx:383`, `content/interventions.ts:638`, `content/implementation.ts:327`) ✅ cohérent.

**Verdict** : hiérarchie CTA solide, naming primaire = « Réserver » + variants tier ✅.

**Note** : Le prompt master mentionne « primaire `Réserver un audit` » comme attendu. Mais doctrine code = SSOT (mémoire) : le code utilise « Réserver une intervention » comme CTA central header (offre flagship = Essentielle). Pas un bug — c'est un choix produit. Audit primaire reste « Réserver mon diagnostic flash ».

### 9. Micro-copy (labels CTA, boutons forms, error messages tone)

**Error messages forms** (Grep `failure:`) :

- 5 occurrences dans `app/[locale]/{contact,audit/demande,guide-ia}/page.tsx`.
- Pattern FR : « Une erreur est survenue. Réessayez ou écrivez à contact@axion-ia.com. » ✅ calme, factuel, fallback humain.
- Pattern EN : « An error occurred. Try again or email contact@axion-ia.com. » ✅ équivalent.

**404 / 500 (`fr.json:152-169`)** :

- 404 : « Erreur d'aiguillage » + « Cette page est introuvable. Le lien n'existe plus, a été déplacé, ou contient une faute de frappe. » ✅ ton métaphorique éditorial doux, premium.
- 500 : « Une erreur est survenue. Nous avons été notifiés et l'incident est suivi. » ✅ factuel, rassurant.

**Verdict** : micro-copy premium, calme, humain ✅.

### 10. Sandbox routes `/components /sections /design` lo-prio

- Tagués `noindex` via `src/app/robots.ts:16-24` (`COMMON_DISALLOW`).
- `design/page.tsx:7` commente explicitement « noindex via robots.txt ».
- Aucune copy commerciale dans ces routes (dev reference only) ✅.

**Verdict** : sandbox correctement isolé ✅.

### 11. Ratio Axion-IA-centric ≥ 95 % — Paris pilote + 10 villes

**Paris pilote** (`src/content/villes/copy/paris.ts`, 758 lignes, ≈ 4081 mots mixtes FR+EN ≈ 2040 FR) :

- Structure : 9 sections × ~95 % copy Axion-IA-centric (audit/interventions/implementation/méthodo/preuves/FAQ) + ~5 % data INSEE (population 215 K, arrondissements, écosystème nominal Mistral/Station F, gares).
- Mentions Axion-IA dans le fichier : 26 occurrences (Grep `Axion-IA|Axion IA|AxionIA`).
- Mentions données INSEE pures (chiffres population, codes INSEE) : ~10 occurrences.
- **Ratio estimé 96 / 4 ✅** (au-dessus du seuil doctrine).

**10 villes random (échantillon Auvergne-Rhône-Alpes)** : Lyon, Saint-Étienne, Villeurbanne, Grenoble, Clermont-Ferrand, Annecy, Vénissieux, Valence, Chambéry, Roanne (extraction `villes/data/auvergne-rhone-alpes.ts:6-100`) → aucune n'a de fichier `copy/<ville>.ts`. Donc elles tombent toutes sur `VilleStub` (`app/[locale]/implantations/[region]/[ville]/page.tsx:854-895`).

**`VilleStub` contenu** (≈ 50 mots de copy + 2 CTAs + référence région) :

- 100 % Axion-IA-centric (« Axion-IA intervient à X », « audits IA », « interventions sur site », « réservez »).
- ~3 références INSEE (population formatée + département + nom ville).
- **Ratio Axion-IA-centric ≈ 98 / 2 ✅**, MAIS contenu trop maigre pour ranker (anti-doorway via stub = correct doctrinairement).

**Verdict ratio** : ✅ doctrine respectée. **Limitation business** : seul Paris a un contenu suffisamment riche pour réellement ranker (gold standard). Les ~17 500 routes générées sans copy file sont en réalité des stubs anti-doorway.

### 12. Pricing affichage : EUR HT + helpers `formatPrice() / formatAmount()`

- `pricing.ts:13` : « Tous les montants en EUR HT. » + `pricing.ts:558` retourne `${fmtNumber(amount, "fr")} € HT` (FR) et `${fmtNumber(amount, "en")} (excl. VAT) €` (EN).
- 33 occurrences `EUR HT / € HT / excl. VAT` dans `src/content/*` (Grep).
- **118 invocations** `formatPrice() / formatAmount()` dans 23 pages d'`app/[locale]` (Grep count) → adoption SSOT ✅.
- Pas de montant hardcodé détecté dans `app/[locale]/` parmi les pages auditées (les nombres apparaissent uniquement via `formatPrice(getTierById(…))`).
- Header CTA badge `Header.tsx:147` dérive également via `ctaPriceBadge` (helper appelé en haut, sans hardcode).

**Verdict pricing display** : ✅ excellent, SSOT respecté.

### 13. Case Studies + Testimonials E-E-A-T

**`case-studies.ts`** (5 fixtures Sprint 8) :

- Auteurs anonymisés (« C. Lambert · DAF », « M. Petit · COO », « S. Roussel · Directrice expérience client », « L. Vidal · Directeur transformation », « F. Mercier · Gérant »).
- Pas de nom entreprise → conforme doctrine anonymisation, mais affaiblit E-E-A-T.
- Pas de date de témoignage → suspicion possible « still valid? ».
- Pas de LinkedIn / contact vérifiable.
- Le commentaire `case-studies.ts:1` flag « Replaced by Prisma in Sprint 15 » — l'équipe est consciente que ce sera enrichi.

**`PRESS_FAQ` + testimonials Booking** :

- `BookingCalendar.tsx:1982` mentionne « President · consulting firm · Paris, 65 people » — encore plus anonymisé.
- `AuditConversionBlocks.tsx:286` : « Consulting firm · 25 staff · France » — pareil.

**Verdict E-E-A-T** : ⚠️ P2-15.4 — anonymisation justifiée mais E-E-A-T faible. Sprint 15 (Prisma) doit ajouter `consentDate` + facultatif `linkedinUrl` + `verifiedAt` pour signaux Google EEAT.

### 14. Pricing.ts : phrases interdites bannies via lint script ?

- `package.json` : `anti-siren:check` (SIREN/SIRET FR) + `anti-hex:check` (couleurs hardcodées). **Pas de** `anti-doctrine-phrases:check`.
- Doctrine phrases interdites (« pas de plan sur-mesure », « ½ journée », « basé en UE », « sizes hors INSEE ») non protégées par CI.
- ⚠️ **P2-15.6** : ajouter un script `scripts/check-anti-doctrine.sh` sur les 4 phrases interdites + lancer dans `verify:all`.

---

## Citations

| Finding                                      | Path:line                                                                                                          | Source 2                                     |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| Doctrine SSOT brand                          | `src/lib/brand.ts:18-20`                                                                                           | `BRAND.taglineFr/En` import 15+ fichiers     |
| Press dérive naming                          | `src/content/press.ts:121`                                                                                         | Grep `cabinet de conseil`                    |
| Hetzner Frankfurt drift                      | `src/content/press.ts:152,310,416` + `src/app/llms-full.txt/route.ts:57,98` + `src/content/legal.ts:52,85,226,271` | Grep `Frankfurt\|Nuremberg` 14 occurrences   |
| /methodologie sous 1500 mots                 | helper count `methodologie/page.tsx`=829 + `transversal.ts`=902                                                    | —                                            |
| /comparaisons faible                         | helper count `comparaisons/page.tsx`=403 + `comparaisons.ts`=449                                                   | `comparaisons.ts:1` (« replaced Sprint 15 ») |
| 10x jargon                                   | `src/content/automatisations.ts:309,370`                                                                           | Grep `10x\|100x`                             |
| Atelier de restitution                       | `src/content/transversal.ts:221` + `paris.ts:124,184,531`                                                          | Grep `\batelier\b`                           |
| CTA primaire unifié                          | `src/components/nav/Header.tsx:136,142,191,197`                                                                    | `messages/fr.json:22`                        |
| Pricing SSOT                                 | 118 calls `formatPrice/formatAmount` dans 23 routes                                                                | Grep count                                   |
| Sandbox noindex                              | `src/app/robots.ts:16-24`                                                                                          | `design/page.tsx:7` commentaire              |
| 32 pages `titleAs="h1"` + 52 pages h1 unique | Grep `titleAs="h1"` + `<h1\b`                                                                                      | Audit list                                   |
| E-E-A-T anonymisé                            | `src/content/case-studies.ts:55,68,90,127,161,194`                                                                 | —                                            |
| Error messages tone                          | `app/[locale]/audit/demande/page.tsx:90,216` + `messages/fr.json:152-169`                                          | Grep `failure:`                              |
| Sub-tiers audit + pricing tiers EUR HT       | `src/content/pricing.ts:254-306,558`                                                                               | —                                            |
| Pas de Resend doctrine                       | `src/lib/email/client.ts:7` (« Pas de Resend / SendGrid / Mailgun / Brevo »)                                       | `llms-full.txt:98`                           |
| Conférence ≥ 1 jour (pas ½)                  | `src/content/interventions.ts:984-985,1024` + commentaires `pricing.ts:240-242`                                    | —                                            |
| Comments-only « basé en UE »                 | `src/content/villes/copy/paris.ts:4,87`                                                                            | Grep `basé en UE`                            |

---

## [INCONNU] — éléments non vérifiables

- **DC Hetzner réelle (Frankfurt vs Nuremberg)** : impossible de trancher en lecture-seule du repo. Will doit confirmer via Hetzner Cloud Console (`hcloud server describe axionia-web` → `datacenter.name`). Si Nuremberg confirmé → patch 14 occurrences de copy.
- **Rendu HTML statique `/presse`** : 68 mots dans `presse/page.tsx` vs 1156 mots dans `press.ts` — le composant `<PressFaqAccordion>` est-il SSR (statique) ou lazy ? Non vérifié sans `pnpm build && view-source`. AGT-04 SEO peut compléter.
- **Page d'accueil mots réels rendus** : 365 mots FR estimés — non vérifié sur la HTML statique réelle (composants client-side ?). À recouper avec curl prod (Phase 4).
- **Word count "réel"** : helper Node compte les string literals mais inclut un peu de noise (clés JSON-LD, props). Estimations à ±15 %.
- **Coverage 100 % naming dans EN miroir** : Grep parity 13 fichiers FR vs 15 EN — vérifié rapidement, mais pas string-par-string. AGT-06 i18n est l'autorité finale.

---

## Recommandations (≤ 10, effort × impact)

| #   | Reco                                                                                                                                                                                                                                                      | Effort              | Impact                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ----------------------------- |
| R1  | **STOP & ASK Will** : confirmer DC Hetzner réelle puis patcher 14 occurrences `Frankfurt`→`Nuremberg` (ou laisser Frankfurt si tel est le cas) dans `legal.ts`, `press.ts`, `llms-full.txt`, `BookingCalendar.tsx`, `README.md`, runbooks, docker-compose | 30 min              | 🔴 RGPD/factuel               |
| R2  | Étoffer `/methodologie` de ~850 → ≥ 1700 mots FR via 4 sections complémentaires (4 étapes détaillées, « ce qu'on ne fait pas », FAQ méthodo)                                                                                                              | 3-4 h copywriting   | 🟢 SEO/AEO parent stratégique |
| R3  | Patcher `press.ts:121` : `cabinet de conseil IA opérationnel` → `cabinet IA opérationnel` (SSOT)                                                                                                                                                          | 1 min               | 🟡 cohérence presse           |
| R4  | Remplacer `10x plus vite` / `10x faster` (`automatisations.ts:309,370`) par formulation factuelle ou chiffrée                                                                                                                                             | 5 min               | 🟡 ton premium                |
| R5  | Ajouter `scripts/check-anti-doctrine.sh` : grep `½ journée \| basé en UE \| pas de plan sur-mesure \| cabinet de conseil IA` (hors commentaires) + `pnpm verify:all`                                                                                      | 30 min              | 🟢 prévention récidive        |
| R6  | Étoffer `/comparaisons` slugs : passer chaque body de ~130 → ~600-800 mots (étoffer 3 fixtures avant migration Prisma Sprint 15)                                                                                                                          | 6-8 h               | 🟢 SEO comparison articles    |
| R7  | Sprint 15 (case studies Prisma) : ajouter colonnes `consentDate`, `linkedinUrl` (opt-in), `verifiedAt` pour E-E-A-T renforcé Google 2026                                                                                                                  | 2 h schéma + 1 h UI | 🟢 E-E-A-T                    |
| R8  | Étoffer home (`page.tsx`) ≥ 600 mots FR : ajouter section « 3 questions qu'on se pose toujours » (FAQ home) ou témoignage long-form fondateur                                                                                                             | 2-3 h               | 🟡 SEO home                   |
| R9  | Renommer `freelance` → `indépendant` dans `audit/page.tsx:486` + `automatisations.ts:142` pour clarifier (cible vs concurrent)                                                                                                                            | 5 min               | 🟢 clarté                     |
| R10 | Auditer le rendu SSR de `/presse` (curl prod + view-source) pour confirmer que les 1156 mots `press.ts` arrivent bien dans le HTML statique (et non lazy/client)                                                                                          | 15 min              | 🟢 SEO presse                 |

---

## STOP & ASK consolidés (questions ouvertes pour Will)

- **Q-15.1** : Datacenter Hetzner CPX32 réel = Frankfurt (docs/copy) ou Nuremberg (mémoire + 1 prompt récent) ? RGPD-sensible.
- **Q-15.2** : Doctrine « cabinet IA opérationnel » strict, ou variant « cabinet de conseil IA opérationnel » accepté en presse pour clarté lecteur ?
- **Q-15.3** : « sur-mesure » en formulation positive (`paris.ts:364` « Combinaisons sur-mesure pour les sièges parisiens ») — banni strict, ou OK si pas dans la phrase exacte « pas de plan sur-mesure » ?
- **Q-15.4** : `/methodologie` doit-elle être étoffée à 1700+ mots cette session, ou repoussée à un Sprint copy dédié post-prod ?
- **Q-15.5** : Conditions E-E-A-T (consentDate, linkedinUrl) à demander aux clients témoins avant Sprint 15 Prisma, ou rester sur anonymisation actuelle ?
