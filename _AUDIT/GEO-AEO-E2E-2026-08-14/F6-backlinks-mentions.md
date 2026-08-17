# F6 — Backlinks & mentions tierces

- **Date** : 2026-08-14. Mesures live **19:10 → 19:21 UTC** (recherches web + curl + fetch).
- **Fenêtre deploy** : un deploy a atterri à **18:26 UTC** (mes mesures sont donc à J+44 min → **dans la fenêtre post-deploy ≤ 1 h**), et un nouveau run est parti à **18:54 UTC** (atterrissage estimé 19:50–20:00 UTC). ⚠️ Conséquence : tout ce qui est DB-driven (couverture médias, communiqués) peut être temporairement vide — **je n'en tire aucun finding**. Tous mes findings portent sur des **constantes de code** (footer, JSON-LD, fichier statique `public/press/`) et sur des **pages tierces**, insensibles à l'ISR.
- **Périmètre réellement couvert** : plan `PLAN-ACTION-BACKLINKS-RP-AXION-IA.md` (racine projet) + `BLUEPRINT-RELATIONS-PRESSE-AXION-IA.md` (lu en diagonale, design sans code) ; `src/lib/seo/local-citations.ts` (catalogue + `getLocalCitationsCoverage()`) ; `src/lib/seo.ts` (`sameAs` Organization) ; `src/components/nav/Footer.tsx` (lien social sitewide) ; `src/app/[locale]/presse/page.tsx` (JSON-LD + rendu) ; `src/server/image-bank/services/image-jsonld-graph.service.ts` (`sameAs` du graphe images) ; `src/content/press.ts` (fixtures CP, kit, porte-parole, couverture) ; `src/components/sections/MediaCoverage.tsx` ; `src/components/galerie/EmbedCodeButton.tsx` + `src/app/[locale]/galerie/[slug]/page.tsx` (moteur de backlinks passif CC BY) ; `src/app/sitemap-news.xml/route.ts` (merge fixtures presse) ; `public/press/axion-ia-boilerplate-fr-en.txt`. Live : inventaire exhaustif des mentions tierces indexées, vérification une par une (existence, lien, `rel`, NAP), profils `sameAs` déclarés, kit média, chaîne de redirection des liens entrants.
- **Hors périmètre (délégué)** : couverture GSC « Liens » (F2), collisions homonymes en SERP (F3/F5), Wikidata (B1/F5), maillage **interne** (C4), hits crawler (F7), DB prod (interdite à F6).

## Résumé exécutif

Le profil de liens entrants est **quasi nul mais pas nul** : 8 mentions tierces réelles existent et sont indexées (Crunchbase, F6S, Les Pépites Tech, JaimeLesStartups, wispra, about.me, IndieHackers, LinkedIn) — soit **1 lien potentiellement dofollow sur 8**, tous vers la variante `www` ou en `nofollow`. Le problème n'est pas seulement le volume : **la surface d'amorçage est cassée**. (1) Le lien LinkedIn du **footer sitewide** — le seul lien social du site — et deux blocs `sameAs` (page presse, 289 pages galerie) pointent vers `linkedin.com/company/axion-ia`, qui est la page d'une **société homonyme québécoise** (« Les Automatisation Axion IA Inc. », axionia.ca), pendant que `seo.ts` déclare le bon slug `axion-ia-france` : le site s'auto-associe donc à une autre entité sur ~17 600 pages. (2) Le **boilerplate presse public** — l'asset que journalistes et LLM recopient — annonce « fondé en 2024 » contre `foundingDate: "2026"` du Kbis, et ne cite **ni Grenoble ni le SIREN**. (3) Les 2 fiches annuaires les plus visibles ancrent l'entité à **Paris** (Champs-Élysées / « French Tech Grand Paris ») avec le fondateur mal orthographié — ce qui explique mécaniquement l'erreur « siège Paris » relevée côté Perplexity (F4). (4) Le « moteur de backlinks passif CC BY » coché `[x] livré` dans le plan est **du code mort** : `EmbedCodeButton` n'est importé nulle part, la page galerie ne propose qu'une attribution en texte brut sans `<a>`. (5) `local-citations.ts` (0/10) n'est pas seulement inerte : il est **déconnecté du réel** — aucune des 8 citations existantes n'y figure.

## Findings

### [P0] Le lien LinkedIn sitewide (footer) et deux `sameAs` pointent vers une société HOMONYME canadienne

**Symptôme.** Le seul lien social du site, présent dans le **footer de toutes les pages**, mène à `https://www.linkedin.com/company/axion-ia` → page LinkedIn de « **Axion IA** », site déclaré **axionia.ca**, 2-10 salariés. Ce n'est pas Axion-IA France : `axionia.ca` est « **Les Automatisation Axion IA Inc.** », Québec, Canada (automatisation de documents hypothécaires pour courtiers). Le même mauvais slug est publié en `sameAs` dans le JSON-LD de `/fr/presse` et dans le graphe JSON-LD de **toutes les pages galerie**. Le bon compte (`axion-ia-france`, « Axion-IA.com », site axion-ia.com) est pourtant celui déclaré dans l'Organization du layout. Résultat : les deux URL cohabitent dans le **même HTML** (constaté sur la home), ce qui est le pire cas pour la réconciliation d'entité — Google et les LLM reçoivent deux `sameAs` LinkedIn contradictoires, dont un vers un concurrent homonyme, plus un lien sortant sitewide vers ce dernier.

**Preuve code.**
- `src/components/nav/Footer.tsx:447` — `href="https://www.linkedin.com/company/axion-ia"` (composant `SocialLinks`, rendu sur toutes les pages).
- `src/app/[locale]/presse/page.tsx:230` — `sameAs: ["https://www.linkedin.com/company/axion-ia"]` (Organization de la salle de presse).
- `src/server/image-bank/services/image-jsonld-graph.service.ts:65` — `const sameAs: string[] = ["https://www.linkedin.com/company/axion-ia", "https://x.com/AxionIA"];`, avec en `:59-60` le commentaire faux : « LinkedIn vanity URL utilise le slug officiel `axion-ia` (avec tiret) ».
- Contre-preuve interne dans le même dépôt : `src/lib/seo.ts:908` — `"https://www.linkedin.com/company/axion-ia-france"` avec le commentaire `seo.ts:904-905` « LinkedIn = vanity public réel `company/axion-ia-france` (confirmé Will 2026-06-05 ; page interne /company/123134154) ». Idem `src/lib/seo/job-posting.ts:21`, `src/lib/seo/ville-service-jsonld.ts:198`, `src/app/[locale]/implantations/[region]/[ville]/page.tsx:405`, `src/app/[locale]/memo-isere/page.tsx:376`, `src/app/[locale]/carrieres/page.tsx:590`, `src/lib/email/templates/_layout.tsx:55`. **Score : 7 occurrences correctes contre 3 fausses**, mais les 3 fausses sont sur les surfaces les plus diffusées.

**Preuve live (UTC).**
- 19:14:48 — contrôle de discrimination : `/company/axion-ia` → **200**, `/company/axion-ia-france` → **200**, `/company/zzz-nonexistent-slug-991234` → **404**. Les deux pages existent donc réellement (LinkedIn 404 correctement sur un slug inconnu).
- 19:15:00 — fetch `/company/axion-ia` : nom « **Axion IA** », secteur « IT Services and IT Consulting », **site web `axionia.ca`**, 2-10 salariés.
- 19:15:10 — fetch `/company/axion-ia-france` : « **Axion-IA.com** », « Conseil, audit & intégration IA pour dirigeants, PME, ETI et grands groupes », site `https://axion-ia.com`, **7 abonnés**.
- 19:19:49 — `https://axionia.ca` → 200 ; fetch : « **Les Automatisation Axion IA Inc.** », Québec, Canada, automatisation documentaire hypothécaire. **Aucun lien avec Axion-IA France.**
- 19:15:22 — HTML brut de `https://axion-ia.com/fr` : `linkedin.com/company/axion-ia` ×2 **et** `linkedin.com/company/axion-ia-france` ×2 dans la même page.
- 19:15:40 — `/fr/galerie` : `/company/axion-ia` ×4, `/company/axion-ia-france` ×2. `/fr/presse` : `/company/axion-ia` ×4, `axion-ia-france` ×2.
- 19:20:20 — `https://axion-ia.com/sitemaps/images-fr.xml` : **289 URLs `/fr/galerie/*`** → 289 pages porteuses du mauvais `sameAs` via le graphe images.

**Root-cause.** Trois surfaces ont été écrites avant (ou sans connaissance de) la confirmation du vanity réel du 2026-06-05, et l'URL LinkedIn n'a **pas de SSOT** : elle est recopiée en dur dans 10 fichiers au lieu d'être dérivée de `src/lib/brand.ts` (`BRAND`/`FOUNDER` existent déjà et servent exactement à ça). Le commentaire de `image-jsonld-graph.service.ts:59-60` a figé l'erreur en « doctrine ».

**Patch prescrit.**
1. **(S)** Ajouter `linkedinCompany: "https://www.linkedin.com/company/axion-ia-france"` au SSOT `src/lib/brand.ts` (à côté de `FOUNDER.linkedin`), puis remplacer les 3 occurrences fautives (`Footer.tsx:447`, `presse/page.tsx:230`, `image-jsonld-graph.service.ts:65`) par cette constante ; corriger le commentaire `:59-60` qui affirme l'inverse.
2. **(S)** Optionnel mais recommandé : migrer aussi les 7 occurrences correctes vers la constante, pour que la prochaine divergence soit impossible ; ajouter un test statique (grep sur `linkedin.com/company/` hors `brand.ts`) — même patron que les gardes SEO existantes.
3. **Reste Will (hors code)** : demander la suppression/le renommage n'est pas possible (page tierce légitime) ; en revanche, remplir la page `axion-ia-france` (voir P1-3) est ce qui tranchera la collision côté Google.

**Effort** : S. **Impact GEO/AEO : fort** (désambiguïsation d'entité — c'est précisément le mécanisme qui fait qu'un LLM confond deux « Axion IA » ; cf. F4 sur les homonymes). **Risque de régression** : faible — remplacement d'URL littérales, aucun impact runtime/Web Vitals ; vérifier que le test de rendu email (`src/lib/email/templates/templates-render.test.ts:86`, qui asserte `axion-ia-france/` avec slash final) reste vert si on touche `_layout.tsx:55` (mieux : **ne pas y toucher**, il est déjà correct et piloté par `COMPANY_LINKEDIN`). **Do-not-touch** : `src/lib/seo.ts:906-910` (déjà correct — B1 s'appuie dessus), `src/lib/email/templates/_layout.tsx`, `templates-render.test.ts`.

---

### [P0] Le boilerplate presse public annonce « fondé en 2024 » (vs Kbis/JSON-LD 2026) et n'ancre ni Grenoble ni le SIREN

**Symptôme.** `https://axion-ia.com/press/axion-ia-boilerplate-fr-en.txt` est l'asset explicitement offert aux journalistes et aux moteurs (« Usage libre pour publication (presse, articles, dépêches) », « Licence : texte libre de droits pour citation et reproduction »). C'est donc **le texte qui va être recopié tel quel dans les mentions tierces et cité par les LLM**. Or il affirme « Axion-IA est un cabinet de conseil IA opérationnel **fondé en 2024** » (et « founded in 2024 » en EN), alors que l'Organization JSON-LD déclare `foundingDate: "2026"` et que l'immatriculation RCS date du 30/07/2026. Il ne mentionne **ni la ville du siège (Grenoble), ni le SIREN, ni la certification Qualiopi, ni le nom du fondateur** — c'est-à-dire exactement les quatre ancres qui permettraient à une reprise presse de corroborer l'entité.

**Preuve code.** `public/press/axion-ia-boilerplate-fr-en.txt:6` (FR) et `:20` (EN) — « fondé en 2024 » / « founded in 2024 ». Contre `src/lib/seo.ts:917` — `foundingDate: "2026"`. Grep `fondé en|founded in|foundingDate` sur `src/lib/seo.ts`, `src/lib/brand.ts`, `src/content/press.ts`, `public/press/*.txt` : ces 3 lignes sont les seules occurrences → **contradiction binaire, aucune autre source pour arbitrer**.

**Preuve live (UTC).** 19:20:36 — `curl https://axion-ia.com/press/axion-ia-boilerplate-fr-en.txt` → 200, contenu ci-dessus servi tel quel. 19:12:09 — l'asset est bien référencé et téléchargeable depuis `/fr/presse` (`href="/press/axion-ia-boilerplate-fr-en.txt"`, 1 occurrence). **Effet mesuré en aval** : la fiche Les Pépites Tech et la fiche JaimeLesStartups reprennent une description dérivée du site avec des années divergentes (« créée en 2026 » côté Pépites, LinkedIn affiche « 2025 ») → **4 années de fondation différentes circulent** (2024 boilerplate / 2025 LinkedIn / 2026 JSON-LD / 2026 fiches).

**Root-cause.** Fichier statique dans `public/`, écrit avant l'immatriculation, non couvert par le SSOT `BRAND` ni par aucun test de cohérence (les gardes existantes portent sur les prix et l'identité légale, pas sur `public/press/`).

**Patch prescrit.**
1. **(S)** Réécrire le boilerplate : année alignée sur `foundingDate` (2026), ajout « siège social à Grenoble (Isère) », « SAS immatriculée au RCS de Grenoble, SIREN 108018631 », mention Qualiopi si la formulation validée existe déjà (réutiliser celle de `src/components/qualiopi/organization-credential.ts` — ne rien inventer), et nom du fondateur « Williams Jullin ».
2. **(S)** Ajouter une spec Vitest qui asserte que `public/press/axion-ia-boilerplate-fr-en.txt` contient l'année de `foundingDate` et la ville du siège (`buildSiegePostalAddress()`), pour que la divergence rougisse — cf. règle mémoire « une garde ne vaut que si elle rougit ».
3. ⚠️ Ne pas y introduire de garantie de résultat (décision actée n°8) ; le texte actuel dit « ROI mesurable » — formulation à conserver telle quelle, elle est déjà en obligation de moyens.

**Effort** : S. **Impact GEO/AEO : fort** (c'est le texte-source des citations tierces et un candidat direct à la reprise par les moteurs IA ; une date fausse dans un asset « libre de droits » se propage et devient irrattrapable). **Risque de régression** : très faible (fichier statique, aucune dépendance code). **Do-not-touch** : `src/lib/seo.ts:917` (c'est la référence, pas l'erreur), `src/content/press.ts` (fixtures — cf. P2-3).

---

### [P1] `sameAs` du graphe images : profil X/Twitter `x.com/AxionIA` inexistant (404) sur 289 pages galerie

**Symptôme.** Le graphe JSON-LD des pages galerie déclare un profil X qui **n'existe pas**. Un `sameAs` non résolvable est au mieux ignoré, au pire un signal de graphe d'entité non vérifiable (Google recoupe ces URL).

**Preuve code.** `src/server/image-bank/services/image-jsonld-graph.service.ts:65` — `"https://x.com/AxionIA"` ; commentaire `:61-64` : « X/Twitter ne supportant pas les tirets dans les handles, on conserve la graphie camelCase `AxionIA` — STOP & ASK si le handle X officiel devient `@axionia` ». Le commentaire suppose donc l'existence d'un compte officiel. Grep : c'est la **seule** occurrence de `x.com` dans les `sameAs` du dépôt (le layout global ne le déclare pas).

**Preuve live (UTC).** 19:15:00 — `curl -L https://x.com/AxionIA` → **404**. 19:15:40 — `/fr/galerie` contient `x.com/AxionIA` ×2 ; 19:20:20 — `sitemaps/images-fr.xml` = **289 URLs galerie**, toutes servies par `buildImageDetailGraph`/`buildGalleryHubGraph` (`galerie/[slug]/page.tsx:12`, `galerie/page.tsx:16`).

**Root-cause.** `sameAs` codé en dur sur un compte jamais créé (ou supprimé), sans vérification.

**Patch prescrit.** **(S)** Retirer l'entrée `x.com/AxionIA` de `image-jsonld-graph.service.ts:65` (et corriger le commentaire), OU la remplacer par les profils **réellement vérifiés** (cf. P1-2). Alternative propre : faire consommer à ce service le même `sameAs` que `buildOrganizationSameAs()` + la constante `brand.ts` du patch P0-1, pour n'avoir qu'une liste à maintenir. **Effort** : S. **Impact GEO/AEO : moyen**. **Risque de régression** : faible ; ⚠️ le module image-bank est cloisonné (`src/server/image-bank/**`) — respecter le cloisonnement et ne pas toucher `image-seo.service.ts` ni les workers. **Do-not-touch** : `src/server/image-bank/services/image-seo.service.ts`, workers image-bank.

---

### [P1] Les 8 citations tierces réelles ne sont déclarées nulle part : `sameAs` incomplet et `local-citations.ts` déconnecté du réel (0/10 annoncé, 8 profils existants)

**Symptôme.** Contrairement à ce que laisse croire l'état « 0 citation » du module, **8 profils tiers vivants** citent Axion-IA en août 2026 (inventaire complet en Mesures brutes). Aucun n'est déclaré en `sameAs` (seuls LinkedIn, about.me, IndieHackers le sont, dont un vers le mauvais compte) et **aucun ne figure dans le catalogue `LOCAL_CITATIONS_FR`** — dont les 10 entrées (PagesJaunes, GBP, Bing Places, Kompass, Societe.com, Infogreffe, LinkedIn, French Tech Directory, Mappy, 118000) sont toutes `listingUrl: null`. `getLocalCitationsCoverage()` renvoie donc `listed: 0` sur 10, un chiffre **faux par omission** : le catalogue ne recense pas les annuaires où l'entreprise est effectivement présente (Crunchbase, F6S, Les Pépites Tech, wispra, JaimeLesStartups), et 3 registres légaux (annuaire-entreprises.data.gouv.fr, Pappers, Societe.com) sont alimentés automatiquement par le SIREN sans action.

**Preuve code.** `src/lib/seo/local-citations.ts:39-124` (10 entrées, 10 × `listingUrl: null`), `:133-137` (`buildLocalBusinessSameAsFR()` → `[]` toujours), `:143-166` (`getLocalCitationsCoverage()`). Consommateurs : grep `buildLocalBusinessSameAsFR|LOCAL_CITATIONS_FR|getLocalCitationsCoverage` → **uniquement** `src/lib/seo/__tests__/local-citations.spec.ts:5-6,40-41`, dont le test « LC6 » **verrouille `listed=0` en V1** (recoupe B1, finding P1 « module 100 % inerte » — je ne le redécouvre pas, j'ajoute que le catalogue est aussi *à côté* de la réalité). `sameAs` Organization : `src/lib/seo.ts:906-910` (LinkedIn + about.me + IndieHackers uniquement).

**Preuve live (UTC).** Inventaire 19:10 → 19:21 (tableau détaillé en Mesures brutes) : `crunchbase.com/organization/axion-ia` (indexé, 403 pour moi), `f6s.com/member/axion-ia` (indexé, anti-bot), `lespepitestech.com/startup-de-la-french-tech/axion-ia` (200, fiche complète), `jaimelesstartups.fr/annonce-cofondateur/axion-ia/` (200), `directory.wispra.com/business/axion-ia-com` (200, Grenoble 38000), `about.me/axion-ia` (200, lien retour vérifié), `indiehackers.com/AxionIA` (200, lien retour vérifié), LinkedIn `axion-ia-france` (200). Registres légaux SIREN 108018631 : `annuaire-entreprises.data.gouv.fr` / `pappers.fr` / `societe.com` → **200** (contenu non vérifiable côté serveur, cf. Limites → `[À CONFIRMER]` sur le contenu, pas sur l'existence des URL).

**Root-cause.** Le catalogue a été conçu comme une *to-do list d'annuaires à créer* (Sprint v7 Phase 14), jamais comme un *registre des citations existantes* ; et personne n'a inventorié le réel depuis. Aucun mécanisme dans le code ne surveille les mentions (grep : `gsc-client.ts` existe mais n'appelle pas l'API Links de Search Console).

**Patch prescrit.**
1. **(S)** Ajouter au `sameAs` de l'Organization (`src/lib/seo.ts:906-910`) les profils **vérifiés et exacts** : Crunchbase, F6S, Les Pépites Tech — après contrôle par Will que chaque fiche lui appartient et affiche un NAP correct (**ne pas** ajouter une fiche encore fausse : un `sameAs` vers une fiche « Paris » aggraverait la confusion, cf. P1-3 — séquencer : corriger la fiche, puis la déclarer).
2. **(S)** Étendre `LOCAL_CITATIONS_FR` aux annuaires réellement présents + renseigner leurs `listingUrl`, pour que `getLocalCitationsCoverage()` cesse de mentir par omission ; le test LC6 (`local-citations.spec.ts:40-41`) qui verrouille `listed=0` devra être amendé **dans le même patch** (sinon rouge).
3. **(M)** Brancher `buildLocalBusinessSameAsFR()` sur `buildLocalBusinessJsonLd()` (aujourd'hui jamais appelé) — recoupe le patch prescrit par B1 ; à faire **une seule fois**, en coordination, pas deux patchs concurrents.

**Effort** : S + M. **Impact GEO/AEO : fort** (la corroboration multi-sources est le mécanisme n°1 de reconnaissance d'entité par les LLM ; 8 profils non déclarés = 8 preuves gaspillées). **Risque de régression** : faible côté code ; ⚠️ un `sameAs` vers une fiche au NAP faux est **contre-productif** — d'où le séquencement imposé. **Do-not-touch** : `src/lib/seo.ts:802-816` (adresse siège figée), la spec `identite-legale-registre.spec.ts`.

---

### [P1] Les 2 fiches tierces les plus visibles ancrent l'entité à PARIS et écorchent le nom du fondateur — source directe de l'erreur « siège Paris » des moteurs IA

**Symptôme.** La fiche Les Pépites Tech affiche « **138 Avenue des Champs-Élysées 75008 PARIS** », classe Axion-IA dans le hub « **French Tech Grand Paris** » et nomme le fondateur « **William Jullin** » (sans « s »). La page LinkedIn officielle (`axion-ia-france`) affiche « **Paris, France** » et « **Founded : 2025** ». Ce sont, avec Crunchbase, les fiches les mieux indexées de l'entité : elles contredisent frontalement le siège Grenoble figé sur pièces (Kbis 30/07/2026) et le `foundingDate: "2026"`. C'est la boucle qui explique le constat de F4 (« Perplexity disait Paris ») : les moteurs n'inventent pas Paris, **ils le lisent sur les fiches tierces**.

**Preuve code.** Rien à corriger côté code — le code est *correct* : `src/lib/seo.ts:911-918` (foundingLocation = `buildSiegePostalAddress()`, Grenoble, + `foundingDate: "2026"`), `src/lib/brand.ts` (`FOUNDER.fullName` = « Williams Jullin »). C'est un finding **hors code** (« reste Will »), mais avec double preuve : le code dit Grenoble/2026, le tiers dit Paris/2025.

**Preuve live (UTC).** 19:19:02 — `lespepitestech.com/startup-de-la-french-tech/axion-ia` → 200 ; fetch : adresse Champs-Élysées 75008 Paris, hub « French Tech Grand Paris », « William Jullin, Fondateur d'Axion-IA », ajout au 30/05/2026. 19:15:10 — LinkedIn `axion-ia-france` : « Paris, France », « Founded 2025 », 7 abonnés. 19:16 — `directory.wispra.com` est **le seul** tiers qui affiche correctement « Grenoble, 38000, France ». 19:11:30 — pour mémoire, `/fr/mentions-legales` servait encore « RCS et SIREN communiqué sur demande » (version build, cf. B1 P0 — je ne le recompte pas, mais c'est aggravant : **un journaliste ou un LLM qui veut recouper Paris vs Grenoble ne trouve pas le SIREN sur la page de corroboration**).

**Root-cause.** Fiches créées à l'époque de la domiciliation Paris (avant le Kbis Grenoble du 30/07/2026), jamais mises à jour ; aucun inventaire des citations à corriger n'existe.

**Patch prescrit (reste Will, 100 % hors code).**
1. Mettre à jour la fiche Les Pépites Tech (adresse Grenoble, hub French Tech in the Alps si possible, « **Williams** Jullin »).
2. Corriger la page LinkedIn `axion-ia-france` : localisation Grenoble, année de fondation 2026, ajout du lien site, description alignée sur le boilerplate corrigé (P0-2).
3. Vérifier/réclamer Crunchbase et F6S (fiches existantes, contenu non vérifiable depuis ici) et y poser le même NAP.
4. **Ensuite seulement**, déclarer ces URL en `sameAs` (patch P1-2).

**Effort** : S (≈ 1-2 h d'actions manuelles). **Impact GEO/AEO : fort** (cohérence NAP = condition du Knowledge Panel et de la citation correcte par les LLM). **Risque de régression** : nul (aucun code touché). **Do-not-touch** : ne pas « corriger » le code vers Paris — le siège Grenoble est acté sur pièces.

---

### [P1] Le « moteur de backlinks passif CC BY » est du code mort : `EmbedCodeButton` n'est monté nulle part, l'attribution servie est du texte sans lien

**Symptôme.** Le plan `PLAN-ACTION-BACKLINKS-RP-AXION-IA.md:31` coche `[x]` « Licence CC BY 4.0 + bloc attribution copiable (**livré**) → chaque réutilisation d'image = backlink obligatoire vers axion-ia.com ». En réalité, la page détail d'une image ne propose **qu'un bloc de texte** « © Axion-IA — « … ». Licence CC BY 4.0. Source : https://… » : une URL en texte brut, dans une balise `<code>`, sans `<a>`. Le composant qui produit le vrai snippet HTML (avec `<a href>` et l'ancre « Axion-IA ») existe, est correct… et **n'est importé par aucun fichier**. Conséquence : un réutilisateur qui suit l'attribution colle une URL non cliquable — **zéro backlink créé**, sur les 289 pages galerie.

**Preuve code.**
- `src/components/galerie/EmbedCodeButton.tsx:26-37` — le snippet correct (`<a href="${pageUrl}">` + `<small>Image: <a href="${pageUrl}">Axion-IA</a> — CC BY 4.0</small>`).
- Grep `EmbedCodeButton` sur tout `src` → **3 hits, tous dans le fichier lui-même** (`:4` commentaire, `:15` interface, `:26` export). Aucun import. Le commentaire `:11` (« Importé depuis la page Server `src/app/[locale]/galerie/[slug]/page.tsx` ») est faux.
- `src/app/[locale]/galerie/[slug]/page.tsx:240` — `const attribution = \`© … Licence CC BY 4.0. Source : ${pageUrl}\`` ; `:518-529` — rendu dans `<code … select-all>{attribution}</code>`, pas de bouton, pas de lien. Grep `clipboard` sur `src/components/galerie` + `src/app/[locale]/galerie` → uniquement `EmbedCodeButton.tsx` (mort).

**Preuve live (UTC).** 19:17:53 — `GET /fr/galerie/axion-ia-hero-ville-versailles-consultant-ia-formation-pme` (1,18 MB) : présence de « Licence CC BY 4.0. Source : https://axion-ia.com/fr/galerie/… » et de « Licence CC BY 4.0 — usage libre avec attribution. Mention recommandée : « © Axion-IA — axion-ia.c… » ; **aucun** libellé « Code intégration » / « Embed code » (les 8 occurrences de `copy`/`Copy` du HTML sont du CSS/JS de framework, pas un bouton d'attribution).

**Root-cause.** Composant livré en fin de sprint image-bank et jamais branché ; le plan a été coché sur la base du composant, pas du rendu.

**Patch prescrit.** **(S)** Importer et monter `EmbedCodeButton` dans `galerie/[slug]/page.tsx` à côté du bloc attribution (props `imageUrl` variant `lg`, `pageUrl`, `alt`, `label` localisé), et rendre l'URL du bloc attribution cliquable (`<a href={pageUrl}>`). **(S bis)** Ajouter un test de rendu qui asserte la présence d'un `<a>` vers `pageUrl` dans le bloc attribution. **Effort** : S. **Impact GEO/AEO : moyen** (c'est le seul dispositif d'acquisition de liens qui ne dépend de personne — mais il ne rapporte qu'à proportion du trafic de la galerie). **Risque de régression** : faible, mais ⚠️ `EmbedCodeButton` est un **composant client** : son montage ajoute du JS à une route soumise aux budgets (First Load ≤ 75 KB gz, `size-limit` bloque > +5 KB gz) — mesurer le delta bundle avant PR ; alternative zéro-JS : rendre le snippet dans un `<textarea readonly>`/`<code>` sélectionnable côté serveur. **Do-not-touch** : `src/server/image-bank/**` (cloisonnement), les variants/LQIP.

---

### [P2] Divers (5)

1. **Tous les liens entrants pointent vers `www` et/ou avec UTM → double redirection.** Live 19:19:02 : Les Pépites Tech lie `https://www.axion-ia.com?utm_source=LesPepitesTech.com`, wispra lie `https://www.axion-ia.com/`. Or 19:11:49 : `https://www.axion-ia.com/` → **301** → `https://axion-ia.com/` → **301** → `/fr`. Deux sauts avant la page finale sur le peu de liens existants. Patch : rien à changer côté code (la chaîne est correcte et voulue, cf. C3) — **reste Will** : demander la correction des URL sur les fiches qu'il contrôle (pointer directement `https://axion-ia.com/fr`). Impact faible, effort S.
2. **Une mention sans lien.** `jaimelesstartups.fr/annonce-cofondateur/axion-ia/` (200 le 19:18, publiée 30/06/2026) décrit Axion-IA mais **ne contient aucun lien cliquable** vers le site. Mention « nue » = signal d'entité pour les LLM, zéro pour le crawl. Reste Will : demander l'ajout du lien.
3. **`rel` du seul lien potentiellement dofollow.** Live 19:21:33 sur Les Pépites Tech : deux ancres vers le site, l'une **sans** `rel="nofollow"`, l'autre avec. wispra : `rel="nofollow noopener"` (19:21:15). about.me / IndieHackers / LinkedIn : plateformes nofollow par défaut. **Profil d'ancres réel : 100 % générique** — « Visiter leur site » ×2, « Visit my website », « axion-ia.com » (URL brute). **Zéro ancre de marque exacte « Axion-IA », zéro ancre thématique.** Ce n'est pas un sur-optimisation risk (au contraire), mais cela signifie qu'aucun lien ne transmet de contexte sémantique. Patch : sur les fiches contrôlées par Will, préférer l'ancre « Axion-IA » ou « cabinet IA Axion-IA » (formulation déjà recommandée par le boilerplate : « Attribution souhaitée : "Axion-IA" ou "cabinet IA Axion-IA" » — bon réflexe, à conserver).
4. **Bombe à retardement dans `sitemap-news.xml` : 3 slugs de communiqués qui 404.** `src/app/sitemap-news.xml/route.ts:36,119-130` fusionne les fixtures `PRESS_RELEASES` et construit `${SITE_URL}/fr/presse/${release.slug}`. Or, live 19:10:30, les 3 slugs des fixtures (`lancement-plateforme-axion-ia-2026`, `methode-axionia-quatre-etapes`, `souverainete-ue-hebergement-axionia`) renvoient **404** — la salle de presse est désormais 100 % DB (`getPublishedMediaCoverage` / `src/server/press/queries.ts`, `presse/page.tsx:153`), et `/fr/presse` ne liste que le communiqué DB (« 15 millions d'euros… », 200 le 19:12). Aujourd'hui c'est inoffensif : les fixtures sont datées 2026-05-07 et la fenêtre glissante 48 h (`:116-118`) les écarte. Mais **toute fixture ajoutée avec une date récente enverrait une URL 404 à Google News**. Patch (S) : soit vider `PRESS_RELEASES` et retirer l'import `:36`, soit filtrer sur l'existence réelle du slug. Do-not-touch : `src/app/sitemap.ts:1186` (le builder presse a déjà été basculé sur la DB en 2026-07-06 — ne pas le re-brancher sur les fixtures).
5. **Kit média incomplet : pas de dossier de presse téléchargeable.** `src/content/press.ts:210-230` — `wordmark-dark` et `brand-book` ont `fileUrl: null`. Live 19:12 : `/fr/presse` n'expose que 3 fichiers (2 logos + boilerplate `.txt`), tous 200 (19:12:09). Le plan Phase 1 Module 0 réclame un « dossier de presse téléchargeable (PDF) » — absent. Effort S (produire le PDF, hors code), impact faible-moyen sur la citabilité presse. **Reste Will**, mais lié à la vidéo/aux visuels déjà en attente : ne pas rouvrir.

**Positifs confirmés (ne rien « corriger »)** : `MediaCoverage.tsx:30-40` gère honnêtement l'état vide (« NEVER fabricate non-existent press mentions ») et `presse/page.tsx:559-582` masque entièrement la section quand `coverage.length === 0` (décision Will 2026-06-23) — conforme à l'anti-pattern E-E-A-T, **aucune fausse retombée n'est affichée** ; `PRESS_MEDIA_COVERAGE = []` (`press.ts:324`) est un choix assumé, pas un oubli. Le boilerplate recommande déjà une ancre de marque. La salle de presse est complète côté journaliste (pitch, faits, porte-parole avec LinkedIn réel `linkedin.com/in/williamsjullin/`, FAQ, formulaire, contact `presse@axion-ia.com`).

## Mesures brutes

### Inventaire des mentions tierces (relevé 19:10 → 19:21 UTC, 2026-08-14)

| # | Source | URL | HTTP | Lien vers le site | `rel` | NAP affiché | Déclaré en `sameAs` ? |
|---|--------|-----|------|-------------------|-------|-------------|------------------------|
| 1 | Les Pépites Tech | `lespepitestech.com/startup-de-la-french-tech/axion-ia` | 200 | oui ×2 (`www.axion-ia.com?utm_source=…`) | 1× **sans nofollow**, 1× nofollow | ❌ « 138 Av. des Champs-Élysées 75008 PARIS », hub French Tech Grand Paris, « William Jullin » | non |
| 2 | JaimeLesStartups | `jaimelesstartups.fr/annonce-cofondateur/axion-ia/` | 200 | **aucun lien** | — | ville absente, fondateur absent, publié 30/06/2026 | non |
| 3 | Wispra Directory | `directory.wispra.com/business/axion-ia-com` | 200 | oui (`www.axion-ia.com/`) | `nofollow noopener` | ✅ Grenoble 38000, « Technologie / IT », fondé 2026 par Williams Jullin | non |
| 4 | Crunchbase | `crunchbase.com/organization/axion-ia` | 403 (anti-bot) — **indexé** | non vérifiable | — | « AI consulting firm based in France » (snippet) | non |
| 5 | F6S | `f6s.com/member/axion-ia` | anti-bot — **indexé** | non vérifiable | — | « Founder & CEO at Axion IA » (titre indexé) | non |
| 6 | about.me | `about.me/axion-ia` | 200 | oui (bouton « Visit my website » → axion-ia.com) | plateforme (nofollow) | « Consultant, AI Consultant, and AI Trainer in France » | ✅ `seo.ts:909` |
| 7 | IndieHackers | `indiehackers.com/AxionIA` | 200 | oui (product → axion-ia.com) | plateforme (nofollow) | « Cabinet d'IA opérationnelle pour TPE/PME » | ✅ `seo.ts:910` |
| 8 | LinkedIn (officiel) | `linkedin.com/company/axion-ia-france` | 200 | oui | nofollow | ❌ « Paris, France », « Founded 2025 », **7 abonnés** | ✅ `seo.ts:908` |
| — | LinkedIn (**homonyme QC**) | `linkedin.com/company/axion-ia` | 200 | → `axionia.ca` | — | « Axion IA », Québec (Les Automatisation Axion IA Inc.) | ⚠️ **déclaré à tort** ×3 (footer, presse, galerie) |
| 9 | Annuaire Entreprises (data.gouv) | `/entreprise/108018631` | 200 | n/a (registre) | — | contenu non extractible (SPA, 841 o) `[À CONFIRMER]` | non |
| 10 | Pappers | `/entreprise/108018631` | 200 | n/a | — | `[À CONFIRMER]` | non |
| 11 | Societe.com | `/societe/axion-ia-108018631.html` | 200 | n/a | — | `[À CONFIRMER]` | non |
| ctrl | LinkedIn slug bidon | `/company/zzz-nonexistent-slug-991234` | **404** | — | — | (contrôle : LinkedIn 404 bien un slug inconnu) | — |
| ctrl | X/Twitter | `x.com/AxionIA` | **404** | — | — | profil inexistant | ⚠️ déclaré (289 pages galerie) |

**Bilan quantitatif** : 8 mentions réelles · **1 lien potentiellement dofollow** (Les Pépites Tech) · 4 liens nofollow · 1 mention sans lien · 2 fiches non vérifiables · **0 domaine média/presse** · **0 retombée presse** (`PRESS_MEDIA_COVERAGE = []`, section masquée en prod).

### Surfaces internes mesurées (live)

| URL / asset | Heure UTC | Statut | Observation |
|---|---|---|---|
| `https://axion-ia.com/fr` (HTML brut) | 19:15:22 | 200 | `company/axion-ia` ×2 **et** `company/axion-ia-france` ×2 |
| `https://axion-ia.com/fr/presse` | 19:14:17 | 200, 1 328 179 o | 1 seul communiqué lié (DB) ; `company/axion-ia` ×4 ; kit = 3 fichiers |
| `https://axion-ia.com/fr/galerie` | 19:15:40 | 200, 1 246 953 o | `company/axion-ia` ×4, `x.com/AxionIA` ×2 |
| `/fr/galerie/axion-ia-hero-ville-versailles-…` | 19:17:53 | 200, 1 184 708 o | attribution CC BY en **texte**, aucun bouton d'embed |
| `sitemaps/images-fr.xml` | 19:20:20 | 200, 310 501 o | **289** URLs `/fr/galerie/*` |
| `sitemap-presse.xml` | 19:10:00 | 200, 752 o | **1** URL (communiqué DB) |
| `/fr/presse/lancement-plateforme-axion-ia-2026` | 19:10:30 | **404** | fixture `press.ts:275` |
| `/fr/presse/methode-axionia-quatre-etapes` | 19:10:30 | **404** | fixture `press.ts:288` |
| `/fr/presse/souverainete-ue-hebergement-axionia` | 19:10:30 | **404** | fixture `press.ts:302` |
| `/fr/presse/15-millions-d-euros-…-ne-se-presente-pas` | 19:12:09 | 200 | communiqué DB, seul émis |
| `/press/axion-ia-boilerplate-fr-en.txt` | 19:20:36 | 200 | « fondé en 2024 » / « founded in 2024 » |
| 2 logos + photo fondateur (`/images/…`) | 19:12:09 | 200 ×3 | kit média opérationnel |
| `https://www.axion-ia.com/` | 19:11:49 | 301 → `https://axion-ia.com/` → 301 → `/fr` | double saut pour les liens entrants |
| `/fr/mentions-legales` (extrait) | 19:11:30 | 200 | « RCS et SIREN communiqué sur demande » (version build — cf. B1 P0, non recompté) |

### État du plan `PLAN-ACTION-BACKLINKS-RP-AXION-IA.md` (racine projet, daté 2026-06-08)

| Phase 0 — item | Coché dans le plan | Réalité mesurée 2026-08-14 |
|---|---|---|
| Google Business Profile | ☐ | non listé (`local-citations.ts:50-56`, `listingUrl: null`) — non vérifiable côté serveur |
| Societe.com / Pappers / Infogreffe | ☐ | URL SIREN répondent 200 (auto-générées) — **jamais déclarées ni exploitées** |
| Pages Jaunes | ☐ | non listé |
| LinkedIn company page | ☐ | ✅ existe (`axion-ia-france`, 7 abonnés) mais **NAP Paris/2025** + le site pointe vers le mauvais slug |
| Crunchbase | ☐ | ✅ **existe** (fiche indexée) — non déclarée en `sameAs` |
| Welcome to the Jungle | ☐ | absent (recherche 19:18 : seuls des résultats « Axionable », homonyme) |
| Annuaires agences (Sortlist, Clutch…) | ☐ | absent |
| Annuaires IA FR | ☐ | ✅ partiellement (wispra, Les Pépites Tech, JaimeLesStartups, F6S) — **hors catalogue** |
| GitHub org | ☐ | `github.com/will383842` → 200 (19:10:30), non déclaré en `sameAs` |
| Wikidata / Qid | ☐ | absent (cf. B1 P1 — non recompté) |
| **CC BY = backlink engine passif** | **☑ « livré »** | ❌ **faux** : composant d'embed non monté, attribution sans lien (P1 ci-dessus) |
| Openverse / Wikimedia | ☐ | non fait |
| Phase 1 (pilote presse Isère/Drôme) | ☐ | non démarré — 0 retombée, `PRESS_MEDIA_COVERAGE = []` |
| Phase 2 (moteur RP) | ☐ | non démarré (conforme : conditionné à la preuve du pilote) |
| Fiche porte-parole | ☐ | ✅ **fait** (`press.ts:329+`, rendu live, LinkedIn réel) |
| Dossier de presse PDF téléchargeable | ☐ | ❌ `brand-book.fileUrl: null` (`press.ts:~225`) |

⚠️ Note : le plan porte encore, en `:55`, la tension « l'entité est présentée siège **Paris** » — **caduque** depuis le Kbis Grenoble du 30/07/2026. Le plan lui-même est un document de travail hors `axionia/` : je ne prescris pas de le modifier (hors périmètre d'écriture de l'audit), mais toute reprise doit partir de Grenoble.

## Limites

- **DB prod interdite à F6** (réservée A3/B6/D1/D5/D8/F7) : je n'ai pas pu compter les lignes `MediaCoverage` ni `PressRelease` en base. J'ai déduit l'état (0 retombée, 1 communiqué) du HTML live et du `sitemap-presse.xml` — mesure prise **44 min après le deploy de 18:26 UTC**, donc théoriquement dans la fenêtre ISR ≤ 1 h : le « 1 communiqué » pourrait être un sous-comptage temporaire. Le « 0 retombée » est en revanche cohérent avec `press.ts:324` et avec l'absence de toute mention presse indexée.
- **Crunchbase (403) et F6S (anti-bot)** m'ont refusé le contenu : leur existence est prouvée par l'indexation, mais le NAP, le `rel` du lien et la propriété de la fiche restent `[À CONFIRMER]` — à vérifier par Will depuis un navigateur connecté.
- **Registres légaux** (annuaire-entreprises, Pappers, Societe.com) : HTTP 200 obtenu, mais contenu rendu côté client (841 o de coquille JS) → je ne peux pas certifier que la fiche SIREN 108018631 est bien peuplée. `[À CONFIRMER]`.
- **Google Business Profile / Bing Places / PagesJaunes** : impossible à auditer sans compte (et interdiction de toute action de soumission). Statut « non listé » repris du code, non contredit par la recherche web.
- **Profil d'ancres entrant complet** : nécessite le rapport « Liens » de Search Console (surface F2). Mon inventaire d'ancres est celui des 8 mentions que j'ai pu ouvrir — il peut exister des liens non indexés ou non trouvés par la recherche. Le chiffre « 8 » est donc un **plancher**, pas un total.
- **Pas de test de délivrabilité de `presse@axion-ia.com`** (aucun POST/envoi autorisé) : l'adresse est affichée live mais son fonctionnement n'est pas vérifié.
- **Recherches web** : moteur US-only ; les résultats FR peuvent être sous-représentés. J'ai croisé 5 requêtes (marque, marque + domaine, `-site:`, fondateur, annuaires ciblés) pour limiter le biais.
