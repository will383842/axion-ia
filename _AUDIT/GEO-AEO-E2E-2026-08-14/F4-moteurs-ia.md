# F4 — Moteurs IA live (le cœur GEO)

- **Date/heure** : 2026-08-14, mesures live entre 18:35:59 et 18:40:17 UTC.
- **Périmètre réellement couvert** : interrogation live du moteur de réponse IA
  accessible depuis cette session (moteur de réponse Claude + backend de
  recherche web, « Claude (web) » au sens de la mission) sur les 3 questions de
  la mission + 2 requêtes réputation/homonyme ; vérification des sources tierces
  que les moteurs ingèrent (registre SIRENE via API publique, Crunchbase, f6s,
  listicle Almera) ; état live de l'infrastructure de citation (robots.txt,
  llms.txt, llms-full.txt, ai.txt, ai-policy.json) ; preuves code associées.
- **Non couvert** (détail en § Limites) : interrogation directe de Perplexity,
  ChatGPT Search et Gemini (interfaces bloquées au fetch, outils navigateur
  réservés à la session principale, aucun crédit API mobilisable).

## Résumé exécutif

L'infrastructure de citation est **irréprochable côté site** (bots de citation
autorisés, llms.txt/ai.txt/ai-policy 200, doctrine robots conforme au code),
et le registre officiel dit désormais **Grenoble** — l'erreur « Paris » n'a
plus de racine côté SIRENE. Mais le cœur GEO est en échec mesuré : sur la
requête brand « Qui est Axion-IA ? », le moteur de réponse décrit correctement
l'entreprise **sans citer une seule fois axion-ia.com** (Crunchbase #1, f6s #2,
7 homonymes US derrière) ; sur les 2 requêtes commerciales, **0 citation**,
la place est captée par des concurrents présents dans des listicles tiers où
Axion-IA n'apparaît jamais (top-5 Grenoble d'Almera vérifié : absent). Sur
l'intent « avis », l'homonyme **Axion Formations (Saint-Quentin)** capte la
réputation. Verdict : le déficit d'existence vérifiable du 2026-07-20 est
**inchangé** ; le site parle aux IA, mais les IA répondent avec les sources
des autres.

## Findings

### [P0] Requête brand : le moteur de réponse parle d'Axion-IA sans jamais citer axion-ia.com

- **Symptôme** : « Qui est Axion-IA ? » → réponse générée correcte sur le fond
  (« cabinet de conseil spécialisé en IA, basé en France… formations, audits,
  accompagnement »), mais les 9 liens sources sont : Crunchbase (#1), f6s (#2),
  puis 7 homonymes US (iris.ai Axion, axion.com, axionai.us, Axion Voice
  Planner…). **0/9 pour axion-ia.com.** La réponse ne mentionne ni Grenoble ni
  Qualiopi.
- **Preuve code** : `src/lib/seo.ts:906-911` — le `sameAs` Organization =
  `buildOrganizationSameAs()` (Wikidata, env-gaté) + LinkedIn + about.me +
  indiehackers. **Crunchbase et f6s — les 2 profils qui captent réellement la
  requête brand — n'y figurent pas** : rien ne soude ces profils à l'entité
  `#organization`. `src/lib/brand.ts:26-28` (`legalName: "AXION IA SAS"`,
  `alternateName`) est correct et ne doit pas bouger.
- **Preuve live** (2026-08-14 18:36:10 UTC) : WebSearch « Qui est Axion-IA ? »,
  9 liens listés ci-dessus, aucun sur le domaine. Contre-épreuve 18:36:55 UTC :
  la même recherche restreinte au domaine renvoie 9 pages du site → le domaine
  EST indexé dans le backend ; c'est un problème d'entité/ranking, pas
  d'indexation.
- **Root-cause** : entité brand non consolidée hors-site — les profils tiers
  (Crunchbase, f6s) portent l'autorité de la requête brand sans lien
  bidirectionnel `sameAs` avec le site, et aucun Knowledge Panel n'arbitre.
- **Patch prescrit** : ajouter `https://www.crunchbase.com/organization/axion-ia`
  (et le profil f6s s'il est assumé) au tableau `sameAs` de
  `buildOrganizationJsonLd` (`src/lib/seo.ts:906-911`) ; vérifier en retour que
  les profils Crunchbase/f6s pointent bien vers axion-ia.com (action humaine si
  non).
- **Effort** : S (1 ligne + vérif profils). **Impact GEO/AEO** : fort (c'est la
  requête brand). **Risque de régression** : quasi nul — champ additif JSON-LD,
  aucun rendu visuel. **Do-not-touch** : `brand.ts:26` (`legalName` sans tiret,
  décision Will 30/07), doctrine robots (décision actée 2), le test
  `identite-legale-registre.spec.ts`.

### [P1] Requêtes commerciales : 0 citation, la place est captée via des listicles tiers où Axion-IA n'existe pas

- **Symptôme** : « meilleur organisme formation IA pour PME à Grenoble » →
  réponse générée cite Arkavia, Almera, Proxiformation, IAvenir, Mister IA,
  DataScientest (tous « certifiés Qualiopi » mis en avant) ; « audit IA
  entreprise France recommandations » → Jaydai, **Mookay** (bug connu 07-20 :
  capte toujours « audit IA »), Mister IA, eleven-labs, entreprise-ia.com.
  **Axion-IA : 0 mention, 0 citation dans les deux réponses.**
- **Preuve code** : le contenu citable existe pourtant — llms.txt route
  (`src/app/llms.txt/route.ts:7`, cible AEO explicite), 87 fiches FAQ, pages
  villes ; live llms.txt l.20 porte Qualiopi. Le déficit n'est pas côté code.
- **Preuve live** (18:36:40–18:36:50 UTC pour les 2 requêtes ; 18:38:33 UTC
  pour la contre-épreuve) : fetch du « TOP 5 des organismes de formation IA à
  Grenoble » d'Almera (source synthétisée par le moteur) → Almera, CCI
  Grenoble, Cegos, GEM, M2i — **Axion-IA absent de l'article**.
- **Root-cause** : les moteurs de réponse synthétisent des comparatifs/listicles
  tiers ; Axion-IA n'apparaît dans **aucun** de ceux qui ranquent (déficit
  d'existence vérifiable, verdict 07-20 confirmé, delta = 0 amélioration).
- **Patch prescrit** : chantier hors-code (RP/outreach) : obtenir l'inclusion
  dans 3-5 comparatifs qui ranquent (« formation IA Grenoble », « audit IA
  PME ») — les articles type Almera/blog-ia/Jaydai acceptent des ajouts ou ont
  des concurrents rédigeables ; alimenter `local-citations.ts`
  (`src/lib/seo/local-citations.ts:130` — V1 retourne `[]` tant que les
  listings n'existent pas) au fur et à mesure.
- **Effort** : M-L (humain, plusieurs semaines). **Impact GEO/AEO** : fort
  (c'est LE mécanisme de citation des moteurs génératifs sur les requêtes
  commerciales). **Risque de régression** : nul (hors-code). **Do-not-touch** :
  ne pas réintroduire de garanties de résultat dans les pitchs (décision 8).

### [P1] Le canal d'ingestion IA ne dit nulle part où est le siège ni le SIREN — l'erreur « Paris » reste corrigeable seulement par des tiers

- **Symptôme** : l'erreur factuelle historique (Perplexity : siège « Paris »,
  audit 07-20) n'a plus de racine côté registre (SIRENE dit Grenoble), mais le
  canal que les IA lisent en priorité (llms.txt / llms-full.txt) **ne contient
  ni « Grenoble », ni l'adresse du siège, ni le SIREN** : un moteur qui
  s'appuie sur llms.txt ne peut pas corriger sa localisation.
- **Preuve code** : `src/app/llms.txt/route.ts` et
  `src/app/llms-full.txt/route.ts` — grep `Grenoble|SIREN|108018631` : **0
  occurrence** dans les deux routes (vérifié 18:41 UTC). Le JSON-LD, lui, est
  complet (`src/lib/seo.ts:825-834` : 11 Avenue Paul Verlaine, ELITE BUREAUX -
  boîte 53, 38100 Grenoble).
- **Preuve live** (18:40:17 UTC) : `curl https://axion-ia.com/llms.txt | grep
  -i grenoble` → seule occurrence = page commerciale
  `/devenir-commercial-ia/grenoble` (l.59) ; aucune mention siège/SIREN.
  Contre-épreuve registre (18:37:22 UTC) : API recherche-entreprises → AXION IA,
  SIREN 108018631, siège ELITE BUREAUX - BOITE 53, 11 AVENUE PAUL VERLAINE,
  38100 GRENOBLE — concordant avec le JSON-LD.
- **Root-cause** : le bloc identité de llms.txt (Qualiopi, mentions légales)
  a été écrit avant le chantier Kbis du 30/07 et n'a pas récupéré l'ancrage
  géographique/légal.
- **Patch prescrit** : ajouter 1-2 lignes au bloc identité de
  `src/app/llms.txt/route.ts` (et llms-full) : raison sociale « AXION IA SAS »,
  SIREN 108 018 631, siège Grenoble (38100), RCS Grenoble — en dérivant de
  `BRAND`/`legal-identity` (pas de hardcode : gate CI `check-anti-siren.sh`,
  cf. `src/lib/seo.ts:845`).
- **Effort** : S. **Impact GEO/AEO** : fort (exactitude des réponses IA sur
  l'entité — question explicite de la mission). **Risque de régression** :
  faible ; **attention** à la gate `check-anti-siren.sh` (interdit le SIREN en
  dur → passer par `legal-identity.ts`/env comme le reste). **Do-not-touch** :
  `brand.ts:26`, la doctrine « complément ELITE BUREAUX fait partie de
  l'adresse » (`seo.ts:797-800`).

### [P1] Intent « avis » : l'homonyme Axion Formations (Saint-Quentin) capte la réputation ; les 77 avis réels sont invisibles des moteurs

- **Symptôme** : « Axion-IA avis clients formation » → #1 Indeed « Axion
  Formation », #3 Indeed « Axion Formations - Saint-Quentin (02) » (avis
  mitigés : « concerns about internship placement »), #4 Axio Formation. Les
  pages du site présentes dans les liens sont des pages pSEO périphériques
  (blog Maurepas, Carcassonne, Auxerre) — **aucune page `/fr/avis/**`** alors
  que le hub existe et répond 200, avec 77 avis réels (4,88/5) en base. Risque
  concret : une réponse IA attribue à Axion-IA les avis mitigés de l'homonyme.
- **Preuve code** : le hub avis est bien exposé au canal IA
  (`src/app/llms.txt/route.ts` — live l.25 : lien `/fr/avis` + feed RSS) ;
  `src/server/reviews/jsonld.ts` existe (lane B6). La disambiguation homonyme,
  elle, n'existe nulle part : `src/lib/brand.ts:28` (`alternateName`) désambiguïse
  vs `axionai.fr` mais **rien ne distingue Axion-IA d'« Axion Formations »**
  (aucune occurrence « Axion Formations » dans src/).
- **Preuve live** (18:38:05 UTC) : recherche ci-dessus ; 18:38:26 UTC :
  `https://axion-ia.com/fr/avis` → 200.
- **Root-cause** : (1) aucune présence d'avis sur une plateforme tierce au nom
  exact « Axion-IA » (les moteurs privilégient Indeed/Trustpilot/Google sur
  l'intent avis) ; (2) collision de nom avec un OF picard établi depuis 33 ans.
- **Patch prescrit** : (a) ajouter une Q/R de disambiguation citable (FAQ
  « Axion-IA est-il lié à Axion Formations (Saint-Quentin) ? Non — … ») dans la
  FAQ générale + llms.txt ; (b) pousser la note agrégée 4,88/5 (77 avis) dans
  le bloc identité llms.txt avec lien vers le hub. Les avis Google/GBP relèvent
  des verrous 07-20 déjà actés (non répétés ici).
- **Effort** : S (a+b). **Impact GEO/AEO** : moyen-fort (réputation = requête
  d'achat). **Risque de régression** : faible ; **attention** décision 8 (CGV
  moyens — ne pas transformer les avis en garantie de résultat) et directive
  Omnibus (la formulation « avis vérifiés » existante en llms.txt l.25 est déjà
  conforme, ne pas la durcir).

### [P2] La réponse brand générée omet Grenoble et Qualiopi

- **Symptôme** : la synthèse « Qui est Axion-IA ? » dit « basé en France » sans
  ville et ne mentionne pas Qualiopi, alors que les concurrents de la requête
  Grenoble sont tous présentés « certifiés Qualiopi ».
- **Preuve code** : Qualiopi est bien dans llms.txt (`route.ts`, live l.20) et
  le credential JSON-LD existe (`src/lib/seo.ts`, lane B1) ; les sources qui
  captent la requête (Crunchbase/f6s) ne le portent probablement pas.
- **Preuve live** : 18:36:10 UTC (texte de la réponse). Crunchbase/f6s
  invérifiables (403) → root-cause partielle `[À CONFIRMER]`.
- **Patch prescrit** : mettre à jour les descriptions des profils
  Crunchbase/f6s/LinkedIn avec « certifié Qualiopi, Grenoble » (action humaine,
  découle du P0). Effort S. Impact moyen. Risque nul.

### [P2] Aucun monitoring automatisé des citations IA

- **Symptôme** : la mesure de ce rapport est artisanale et non répétable ;
  aucun script du repo n'interroge périodiquement les moteurs pour tracer
  « Axion-IA cité ? sur quelles requêtes ? ».
- **Preuve code** : grep `perplexity|geo-monitor|ai-visibility|citation-monitor`
  dans `scripts/` → 6 fichiers, tous content-gen/enrichissement ou
  reverse-DNS (`scripts/audit-reverse-dns-bots.ts`) — aucun monitoring de
  citations. Preuve live : n/a (absence).
- **Patch prescrit** : script hebdo (API Perplexity Sonar déjà sous-processeur
  déclaré — `src/app/[locale]/transparence/page.tsx:85`) posant 5 requêtes
  canoniques et loggant citations/exactitude ; coût marginal. Effort M. Impact
  moyen (pilotage). Risque nul. **Attention** : consommation API = accord Will.

### [P2] Dilution de l'entité : la home derrière les pages pSEO périphériques [À CONFIRMER]

- **Symptôme** : sur la recherche restreinte au domaine (18:36:55 UTC), les
  résultats mettent en avant Perpignan, blog Maurepas, Melun, FAQ… la home
  n'arrive qu'en 9e position ; sur la requête « avis », seules des pages pSEO
  périphériques (Carcassonne, Auxerre) représentent le site.
- **Preuve** : classement interne d'un backend de recherche (non public) —
  root-cause invérifiable d'ici, d'où `[À CONFIRMER]`. À croiser avec F3
  (SERP Google) et D4 (pSEO villes).
- **Patch éventuel** : renforcer les liens internes vers home/à-propos/avis
  depuis les pages pSEO (lane D6/maillage). Effort M. Impact faible-moyen.

### [P2] SIRENE annonce une date de création au 2026-09-01 (future)

- **Symptôme** : l'API recherche-entreprises (18:37:22 UTC) retourne
  `date_creation: 2026-09-01`, postérieure de 2 semaines à aujourd'hui. Un
  moteur IA qui croise le registre peut conclure « société pas encore créée »
  ou « très récente » (signal de confiance faible).
- **Preuve live** : mesure API ci-dessus. Preuve code : n/a (donnée registre).
  Probablement une immatriculation à effet différé — **pas un bug site** ; à
  transmettre à F5 (entité vérifiable) pour vérification du Kbis par Will.
- **Patch** : aucun côté code. Effort/Risque : n/a.

### Constat conforme (non-finding) : Gemini ne peut pas citer — doctrine assumée

`Google-Extended` est bien `Disallow: /` en prod (mesuré 18:35:59 UTC) et dans
le code (`src/app/robots.ts:144`, doctrine l.11-14 et 94-98). Conséquence
assumée par la décision actée n°2 : pas de grounding Gemini. Constaté, non
requalifié en bug.

## Mesures brutes

### Infrastructure de citation (curl prod, 2026-08-14 18:35:59 UTC)

| Surface | Statut | Détail |
|---|---|---|
| `/robots.txt` | 200 | Allow : OAI-SearchBot, ChatGPT-User, Claude-SearchBot, PerplexityBot, Perplexity-User, Mistral-User ; Disallow : GPTBot, ClaudeBot, Google-Extended — conforme `src/app/robots.ts:116-144` |
| `/llms.txt` | 200 | 10 499 B, 0,13 s ; Qualiopi l.20, hub avis l.25 ; **0 mention siège/SIREN/Grenoble-siège** (18:40:17 UTC) |
| `/llms-full.txt` | 200 | 136 905 B, 0,17 s |
| `/ai.txt` | 200 | — |
| `/.well-known/ai-policy.json` | 200 | — |
| `/fr/avis`, `/fr/a-propos`, `/fr` | 200 | 0,42 s / 0,35 s / 0,17 s (18:38:26 UTC) |

### Requêtes moteur de réponse (WebSearch Claude, backend US — 18:36–18:38 UTC)

| Requête | Axion-IA cité ? | Qui capte | Exactitude réponse |
|---|---|---|---|
| « Qui est Axion-IA ? » (18:36:10) | **Non** (0/9 liens) | Crunchbase #1, f6s #2, 7 homonymes US | Description correcte ; ni Grenoble ni Qualiopi |
| « meilleur organisme formation IA pour PME à Grenoble » (18:36:40) | **Non** (0 mention) | Arkavia, Almera, Proxiformation, IAvenir, Mister IA, DataScientest | n/a |
| « audit IA entreprise France recommandations » (18:36:50) | **Non** (0 mention) | Jaydai, **Mookay**, Mister IA, idaos, eleven-labs, entreprise-ia.com | n/a |
| « Axion-IA avis clients formation » (18:38:05) | Partiel (pages pSEO seulement, pas `/avis`) | Indeed × homonyme Axion Formation(s) #1 et #3 | Mélange contenus du site + généralités ; aucun avis réel cité |
| « Axion formation avis organisme » (18:38:15) | Non concerné | Axion Formations Saint-Quentin (33 ans, avis mitigés) | Confusion homonyme totale |
| Recherche restreinte `axion-ia.com` (18:36:55) | 9 pages du site | home en 9e, pSEO devant | Domaine indexé : oui |

### Sources tierces ingérées par les moteurs

| Source | Accès | Constat |
|---|---|---|
| API recherche-entreprises (18:37:22) | 200 | AXION IA, SIREN 108018631, **GRENOBLE**, adresse = celle du JSON-LD ; `date_creation: 2026-09-01` (future) |
| Crunchbase `/organization/axion-ia` (18:36:59) | **403** | Existe (capte la requête brand) mais contenu invérifiable |
| f6s `/member/axion-ia` (18:37:45) | Bot-wall | Invérifiable |
| Perplexity `/search?q=…` (18:37:40) | **403** | Interrogation directe impossible |
| Almera top-5 Grenoble (18:38:33) | 200 | Almera, CCI Grenoble, Cegos, GEM, M2i — **Axion-IA absent** |

## Limites

1. **Perplexity, ChatGPT Search et Gemini n'ont pas pu être interrogés en
   direct** : Perplexity 403 au fetch, ChatGPT/Gemini sans accès non
   authentifié, outils navigateur réservés à la session principale, et pas
   d'appel API mobilisable sans accord (kill switch OpenAI à zéro, crédit
   Anthropic épuisé — mémoire projet). Le seul moteur mesuré en direct est le
   moteur de réponse Claude (WebSearch + synthèse) — représentatif du
   mécanisme, pas des index spécifiques de chaque concurrent. Le constat
   « Perplexity dit Paris » du 07-20 n'a donc **pas pu être re-mesuré** ; j'ai
   mesuré à la place que sa source probable (registre) est corrigée et que le
   canal de correction côté site (llms.txt) est incomplet.
2. **Backend de recherche US-only** : les classements FR (Google.fr, Perplexity
   localisé) peuvent différer ; le biais joue plutôt CONTRE les homonymes US
   observés sur la requête brand, pas contre le constat « 0 citation ».
3. Crunchbase/f6s inaccessibles (403/bot-wall) : impossible de vérifier la
   localisation qu'ils affichent (candidate à l'origine du « Paris » de
   Perplexity) — repris en P2 `[À CONFIRMER]`.
4. Déploiement en vol pendant les mesures (parti 17:33 UTC) : sans impact sur
   mes surfaces (llms/robots statiques, moteurs externes), noté par rigueur.
5. Les hits réels des bots IA sur llms.txt/api/markdown relèvent de F7 (logs
   serveur) ; les 6 verrous entité de F5 ; les SERP Google de F3 — non
   dupliqués ici.
