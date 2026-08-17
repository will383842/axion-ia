# F5 — Entité vérifiable (re-mesure des 6 verrous de l'audit 2026-07-20)

- **Date** : 2026-08-14. Mesures live **19:09:38 → 19:23:29 UTC**.
- **Fenêtre deploy** : un deploy a atterri à **18:26 UTC** (run `31824504716`, parti 17:33, terminé 18:36) ; le run `31829452492` (18:36) a été **annulé** ; le run `31830868520` est parti **18:54 UTC** et était encore `in_progress` à 19:23 (atterrissage estimé 19:50–20:00 UTC). **Toutes mes mesures tombent 43 min à 57 min après l'atterrissage de 18:26**, donc **dans la fenêtre post-deploy ≤ 1 h** : un contenu DB-driven vide y est *a priori* normal — sauf que je démontre ci-dessous (P0-2) que dans ce cas précis il ne se répare pas tout seul, mesure à l'appui.
- **Périmètre réellement couvert** : les 6 verrous de la note mémoire `audit-geo-aeo-2026-07-20` — (1) mentions légales en clair SIREN/RCS/TVA, (2) Liste publique des OF / NDA, (3) Google Business Profile, (4) LinkedIn entreprise, (5) Wikidata, (6) `sameAs` — plus les **collisions d'homonymes** et l'**ancrage registre du fondateur**. Sources : registre public (API `recherche-entreprises.api.gouv.fr`, pappers.fr, societe.com, annuaire-entreprises), Wikidata API, LinkedIn, about.me, Indie Hackers, SERP Bing, prod `axion-ia.com` (GET only), code du dépôt.
- **Recoupé avant de mesurer** : `B1-graphe-identite.md` (JSON-LD identité), `F4-moteurs-ia.md` (citations IA), `A2/A3` (sitemaps), `F2` (GSC/Bing). **Aucun autre rapport du dossier ne traite la Liste publique des OF, le NDA, Wikidata live, LinkedIn ni les registres** (grep `liste publique|est_organisme_formation|NDA|monactiviteformation` sur les 26 rapports : 0 occurrence) — cette surface est exclusive à F5.

## Résumé exécutif

Deux verrous sur six ont bougé depuis le 20/07, quatre sont **inchangés**. ✅ L'entité **est désormais résolvable au registre** : `AXION IA`, SIREN 108018631, siège Grenoble exact-match, dirigeant Jullin Williams — la requête « axion ia » ne renvoie qu'**une** structure en France (contre « aucune structure trouvée » le 20/07), et les mentions légales publient enfin SIREN/SIRET/TVA/capital/RCS en clair. ✅ La page LinkedIn entreprise existe et vit. ❌ Mais le **verrou décisif reste fermé** : les registres publics disent `est_organisme_formation = false` **et** `est_qualiopi = false`, aucun NDA n'est publié nulle part sur le site, alors que la prod affirme partout « organisme de formation certifié Qualiopi » — le seul « Axion » vérifiablement Qualiopi reste l'homonyme **AXION FORMATIONS** (Saint-Quentin, NDA 22020045002). ❌ **Wikidata : toujours 0 item.** ❌ **`sameAs` : toujours 3 entrées**, zéro nœud registre, alors que trois pages miroir (annuaire-entreprises, societe.com, pappers) répondent 200. ❌ **Aucun GBP, aucun téléphone public** — le NAP n'a pas de « P ». Et le seul profil tiers à autorité, **LinkedIn, contredit le registre sur trois attributs** (siège « Paris », nom « Axion-IA.com », « Founded 2025 ») : c'est la racine, jamais identifiée jusqu'ici, du « siège à Paris » que Perplexity affirmait le 20/07. Enfin, la page d'ancrage d'identité (`/fr/mentions-legales`) sert la version stub « communiqué sur demande » après chaque deploy, et le sweep de chauffe **fige cette version chez Cloudflare pour une heure** — je l'ai reproduit et mesuré.

---

## Findings

### [P0] Le statut « organisme de formation certifié Qualiopi » n'est corroboré par AUCUN registre public — verrou n°2 inchangé, et le claim est plus exposé qu'en juillet

**Symptôme.** Le site affirme publiquement, dans la formulation officielle réservée aux organismes certifiés, « Axion-IA est un organisme de formation certifié Qualiopi. La certification qualité a été délivrée au titre de la ou des catégories d'actions suivantes : Actions de formation. » — en §12 des mentions légales, dans le `hasCredential` JSON-LD de **toutes** les pages, et dans `llms.txt` (canal d'ingestion LLM) où il est en plus adossé à « finançables (OPCO, France Travail) ». Or **aucun registre public ne le confirme**, et **aucun identifiant vérifiable n'accompagne le claim** : ni numéro de déclaration d'activité (NDA), ni n° de certificat, ni date de validité, ni organisme certificateur.

**Preuve live (UTC, 2026-08-14).**

| Heure | Source | Résultat |
|---|---|---|
| 19:11:24 | `GET recherche-entreprises.api.gouv.fr/search?q=108018631` | `complements.est_organisme_formation = **false**`, `est_qualiopi = **false**`, `liste_id_organisme_formation = **null**` (champs dérivés de la Liste publique des OF, MAJ quotidienne, et de la liste Qualiopi) |
| 19:14:08 | même API, `q=395041809` (l'homonyme) | **AXION FORMATIONS**, Saint-Quentin : `est_organisme_formation = **true**`, `est_qualiopi = **true**`, NDA `22020045002` |
| 19:15 | `pappers.fr/entreprise/axion-ia-108018631` (200) | fiche complète AXION IA / Grenoble — **aucune** mention OF ni Qualiopi |
| 19:10:05 | `GET /fr/mentions-legales` (version fraîche) | §12 rendu **sans** ligne NDA, **sans** n° de certificat, **sans** date de validité, **sans** certificateur |
| 19:16 | recherche « "Axion-IA" Qualiopi organisme de formation déclaration d'activité » | remonte **AXION FORMATIONS** (fiche Carif-Oref C2RP + PagesJaunes) et la Liste publique data.gouv — **jamais** axion-ia.com |
| 19:18 | `GET /llms.txt` (l. 20) | « organisme de formation certifié Qualiopi … finançables (OPCO, France Travail) » — 0 SIREN, 0 NDA, 0 n° de certificat dans tout le fichier |

**Preuve code.**
- `src/server/qualiopi/config/flag.ts:1-10` : doctrine explicite — « Afficher "Qualiopi / éligible CPF / finançable OPCO" avant la certification est **ILLÉGAL** ».
- `src/server/qualiopi/config/flag.ts:36-60` : `isQualiopiCertificationObtenue()` — « À passer à `"true"` **le jour où le certificat est délivré, pas avant**, et renseigner alors le numéro, la date et le certificateur dans la configuration. » Le rendu live prouve que le drapeau `QUALIOPI_CERTIFICATION_OBTENUE` **est à `true` en prod** (sinon §12 ne s'afficherait pas — `public-identity.ts:72`), **et** que ni numéro, ni date, ni certificateur ne sont renseignés.
- `src/components/qualiopi/certifications-section.ts:53-61` : la ligne NDA (et la mention légale « ne vaut pas agrément de l'État ») n'est émise que `if (id.nda)` → le champ `nda` est **vide** en configuration.
- `src/server/qualiopi/conformite/audit-dossier.ts:210` : le module de conformité interne dit lui-même « NDA DREETS : non renseigné — off.1 ne peut pas être couvert sans numéro de déclaration d'activité ».

**Root-cause.** Deux états possibles, tous deux à trancher par Will : (a) la certification/le NDA sont obtenus mais ni saisis en configuration, ni encore reflétés dans la Liste publique des OF ; (b) le drapeau a été passé à `true` en avance de phase. Dans les deux cas, **du point de vue GEO/AEO le résultat est identique** : un moteur ou un LLM qui cherche à corroborer le claim ne trouve rien, tombe sur l'homonyme certifié, et attribue l'autorité « formation IA Qualiopi » à Saint-Quentin. C'est le mécanisme de captation par homonyme vérifiable identifié le 20/07 — **mesuré inchangé**.

**Patch prescrit.** ⚠️ **STOP & ASK Will** (question factuelle, une ligne : le certificat Qualiopi et le NDA sont-ils délivrés, oui/non, à quelle date ?).
1. Si **oui** : renseigner en console admin `nda`, `qualiopi_organisme` (certificateur COFRAC), `qualiopi_date_obtention`, `qualiopi_validite` → §12, le badge et le `hasCredential` JSON-LD s'enrichissent seuls sous ISR ≤ 1 h ; **et** vérifier sous 15 j que `est_organisme_formation` bascule à `true` dans l'API (c'est le signal que Google/LLM recouperont). Effort **S** (saisie).
2. Si **non** : repasser `QUALIOPI_CERTIFICATION_OBTENUE` à autre chose que `"true"` côté Coolify (le code retombe seul sur « aucune mention ») — c'est exactement le comportement prévu par `flag.ts:36-60`. Effort **S** (env var + restart).

**Effort** : S. **Impact GEO/AEO : fort** (c'est LE différenciateur revendiqué face aux concurrents ; non corroboré, il ne peut ni être cité ni sourcé par un LLM, et il expose au risque DGCCRF déjà signalé le 20/07). **Risque de régression du patch** : nul côté code (aucune ligne à modifier — saisie de configuration ou variable d'environnement). **Do-not-touch** : `flag.ts` (les deux drapeaux découplés le 2026-07-25 sont la garde, ne pas les refusionner), `public-identity.ts:84-91` (décision Will : le n° de certificat n'est pas affiché côté composants — mais noter que `organization-credential.ts:31` le publierait en JSON-LD ; à trancher par Will avant saisie du numéro).

---

### [P0] La page d'ancrage d'identité sert la version stub après chaque deploy — et le sweep de chauffe FIGE cette version chez Cloudflare pour une heure (correction du root-cause de B1)

**Symptôme.** `/fr/mentions-legales` — la page que Google et les LLM recoupent avec SIRENE/INPI pour la réconciliation d'entité — sert « Siège social : **communiqué sur demande**… Immatriculation RCS et SIREN **communiqué sur demande**… TVA **communiqué sur demande** » (×6) après chaque déploiement, avec un nœud `#organization` amputé de `vatID` et de `identifier` (SIRET). B1 a documenté le symptôme ; **son root-cause est faux sur un point qui change le patch**, et le mécanisme réel est pire que décrit.

**Preuve live (UTC) — séquence reproductible.**

| Heure | Requête | `cf-cache-status` | `x-nextjs-cache` | Contenu servi |
|---|---|---|---|---|
| 19:09:38 | `/fr/mentions-legales` (sans query) | MISS | STALE | **stub** : « communiqué sur demande » ×6, 0 SIREN, org sans `vatID`/`identifier` |
| 19:10:05 | `/fr/mentions-legales?f5audit=2` | MISS | HIT | **complet** : SIREN 108018631 ×2, SIRET 10801863100011 ×4, TVA FR51108018631 ×4, capital 1 000 €, RCS Grenoble |
| 19:23:29 | `/fr/mentions-legales` (sans query, à nouveau) | **HIT** | HIT | **stub à nouveau** — 0 SIREN. L'edge sert la version amputée, l'origine est fraîche |

Interprétation : mon premier GET (MISS) a reçu la version stub **et l'a fait mettre en cache par Cloudflare** pour `s-maxage=3600` (en-tête relevé : `Cache-Control: s-maxage=3600, stale-while-revalidate=31532400`). C'est **exactement** ce que le workflow décrit pour `/fr/diagnostic` (`.github/workflows/deploy-coolify.yml:762-766` : « tout visiteur (ou le LHCI) qui passe dans l'intervalle refige la version STUB chez Cloudflare pour s-maxage=3600 »). Or **le job `warm` fait précisément ce GET unique** sur toutes les URLs du sitemap.

**Preuve code.**
- `.github/workflows/deploy-coolify.yml:748` : la liste `PATHS` du POST `/api/internal/revalidate` = 5 chemins (`/fr/actualites`, `/fr/connaissances`, `/fr/ressources`, `/fr/galerie`, `/fr/diagnostic`) — **`/fr/mentions-legales` absent**.
- `.github/workflows/deploy-coolify.yml:779` : la liste de purge CF ciblée = les **mêmes** 5 URLs — absent aussi.
- `.github/workflows/deploy-coolify.yml:827-866` : le sweep « Warm full indexable surface from sitemap » fait **un seul `curl -o /dev/null`** par URL. Un GET unique sur une page ISR ne publie jamais la version fraîche : il reçoit le rendu figé et le fait cacher par l'edge.
- **Correction de B1** : B1 (`B1-graphe-identite.md`, finding P0) affirme « La page est aussi absente de `src/app/sitemap.ts` (grep `mentions-legales` → 0) ⇒ le sweep ne la touche jamais ». **C'est inexact.** `src/app/sitemap.ts:694-698` énumère **toutes** les clés de `routing.pathnames`, et `src/i18n/routing.ts:404` déclare `"/mentions-legales"`. Preuve live 19:19:21 : `GET /sitemap/pages.xml` → 200, 86 `<loc>`, dont `mentions-legales` (3 occurrences fr/en/x-default). Réplication complète du sweep à 19:20:42–19:20:58 : 32 sous-sitemaps, **1 641 URLs**, `/fr/mentions-legales` au **rang 1 540** — très en-dessous du `cap=4000` (`deploy-coolify.yml:852`). La page **est** balayée : c'est le mécanisme du GET unique qui échoue, pas la couverture du sitemap.

**Root-cause.** `/fr/mentions-legales` (`revalidate = 3600`) lit `legal_overrides` en base via `resolveLegalIdentity()` → rendue vide sous le stub de build. Seul un `revalidatePath` (le POST à 5 chemins) régénère réellement l'artefact ; le GET du warmer, lui, **grave la version stub à l'edge**. Conséquence entité : le premier Googlebot / OAI-SearchBot / PerplexityBot qui passe dans l'heure suivant un deploy lit une page de mentions légales **sans SIREN, sans RCS, sans TVA** — l'exact contraire du signal de corroboration recherché, et une non-conformité LCEN visible.

**Patch prescrit.** Ajouter `/fr/mentions-legales` (et `/fr/conditions-generales`, même mécanisme) aux **DEUX** listes : `deploy-coolify.yml:748` (revalidate) **et** `:779` (purge CF ciblée). ⚠️ **Ne pas** « corriger » en ajoutant la page au sitemap (elle y est déjà) ni en augmentant le `cap` (1 641 ≪ 4 000) : ces deux pistes, suggérées par le root-cause erroné de B1, ne changeraient rien. **Effort S.** **Impact GEO/AEO : fort.** **Risque de régression : faible** (listes additives, job best-effort jamais bloquant ; +2 origin-renders par deploy). **Do-not-touch** : la magic string `stub.invalid` et le contrat ADR 0026 (`src/lib/prisma.ts`, `src/lib/redis.ts`, `Dockerfile.coolify-pull`, `SKIP_ENV_VALIDATION`, `BULLMQ_DISABLED`).

---

### [P1] LinkedIn — le seul profil tiers à autorité contredit le registre sur trois attributs d'entité (siège « Paris », nom, année de création)

**Symptôme.** Le verrou n°4 est levé sur la forme (la page existe désormais, elle n'est plus « introuvable ») mais il s'est retourné : la page publie **Headquarters : Paris**, **Locations Primary : Paris, FR**, **Founded : 2025**, sous le nom **« Axion-IA.com »** — trois contradictions frontales avec le registre (siège Grenoble, immatriculation portée au 01/09/2026, raison sociale « AXION IA SAS »). Elle ne mentionne ni organisme de formation, ni Qualiopi, ni Grenoble.

**Preuve live.** 19:12:44 UTC — `GET https://www.linkedin.com/company/axion-ia-france` (200, 160 ko) : titre « Axion-IA.com | LinkedIn » ; bloc « Industry: IT Services and IT Consulting · Company size: 2-10 employees · **Headquarters: Paris** · Type: Privately Held · **Founded: 2025** · Locations Primary: **Paris, FR** » ; 7 abonnés, 1 salarié listé (Williams J.) ; lien retour `https://axion-ia.com` **présent** (le `sameAs` est donc bien bidirectionnel). Contre-mesure registre 19:11:24 : siège `11 AVENUE PAUL VERLAINE 38100 GRENOBLE`.

**Preuve code.** `src/lib/seo.ts:906-911` : `sameAs` = `[...buildOrganizationSameAs(), linkedin/company/axion-ia-france, about.me, indiehackers]` — LinkedIn est déclaré comme **corroboration d'identité** de l'entité. `src/lib/seo.ts:921-928` (commentaire du `foundingLocation`) pose la doctrine qui est ici violée par le profil tiers : « L'ancrage entité **DOIT** refléter le RCS (sinon incohérence NAP ↔ registre = risque E-E-A-T). La visibilité Paris / Île-de-France reste portée par `areaServed` ». Le site respecte la règle ; LinkedIn la casse.

**Pourquoi c'est important.** L'audit du 20/07 relevait « Perplexity affirme : siège à **Paris** (faux, Grenoble) » sans en trouver la source, et `F4-moteurs-ia.md` conclut le 14/08 que « le registre officiel dit désormais Grenoble — l'erreur "Paris" n'a plus de racine côté SIRENE ». **Elle a une racine : LinkedIn**, c'est-à-dire la seule source tierce structurée que le site désigne lui-même comme référence d'identité. Tant qu'elle dit Paris, les moteurs et LLM ont un conflit de données à arbitrer sur l'attribut le plus utilisé pour la désambiguïsation locale.

**Patch prescrit.** Reste Will, action externe (5 min, hors code) : sur la page LinkedIn entreprise → renommer en « Axion-IA » (ou « AXION IA SAS »), Headquarters/Location = **Grenoble, Auvergne-Rhône-Alpes, FR**, Founded = **2026**, et ajouter la mention organisme de formation **une fois** le P0 ci-dessus tranché. **Effort S** (externe). **Impact GEO/AEO : fort.** **Risque de régression : nul** (aucune ligne de code). **Do-not-touch** : l'URL du profil (`company/axion-ia-france`) — la renommer casserait le `sameAs` de `seo.ts:908`.

---

### [P1] `sameAs` toujours à 3 entrées, zéro nœud registre — alors que trois fiches officielles répondent 200 ; Wikidata toujours à zéro item

**Symptôme.** Verrous n°5 et n°6 **inchangés depuis le 20/07** : `sameAs` = exactement les 3 mêmes URLs (LinkedIn, about.me, Indie Hackers), et aucun item Wikidata n'existe. Aucun lien vers une source de vérité publique (registre) n'est déclaré, alors que ce sont les nœuds de corroboration les moins chers et les plus fiables qui existent.

**Preuve live (UTC).**
- 19:12:00 — Wikidata API `wbsearchentities` : `search=Axion-IA` → **0 résultat** ; `search=Axion IA` → **0 résultat**. (Cohérent avec B1 : `WIKIDATA_QNUMBER_AXIONIA` non posée — mais je confirme ici qu'**aucun item n'existe** à référencer, donc la variable n'est pas le blocage : la création de l'item l'est.)
- 19:12:05 — `GET /fr` → `#organization.sameAs = ["https://www.linkedin.com/company/axion-ia-france","https://about.me/axion-ia","https://www.indiehackers.com/AxionIA"]`. Aucun autre champ d'ancrage : le nœud servi post-deploy n'a **ni `vatID`, ni `identifier`, ni `telephone`** (clés relevées : `@id, @type, address, alternateName, areaServed, contactPoint, description, founder, foundingDate, foundingLocation, hasCredential, hasOfferCatalog, image, knowsLanguage, legalName, logo, name, sameAs, slogan, url`).
- 19:12:25 — les 3 `sameAs` répondent **200** (aucun lien mort) : LinkedIn (page réelle), about.me « Axion IA - France » (lien retour vers axion-ia.com présent), Indie Hackers « Axion IA (@AxionIA) » (lien retour présent).
- 19:17:38 / 19:18:02 — **3 fiches registre disponibles, toutes 200 et peuplées** : `annuaire-entreprises.data.gouv.fr/entreprise/axion-ia-108018631`, `pappers.fr/entreprise/axion-ia-108018631`, `societe.com/societe/axion-ia-108018631.html` (titre « Société AXION IA à GRENOBLE (38100)… », 43 occurrences du SIREN, 11 de Grenoble).

**Preuve code.** `src/lib/seo.ts:906-911` (tableau `sameAs`) ; `src/lib/seo/wikidata-sameas.ts:28-37` (Q-number env-gaté, fallback vide). Aucun spec ne verrouille la longueur du tableau `sameAs` de l'Organization (grep `sameAs` sur `src/lib/seo/__tests__/**` et `src/lib/__tests__/**` : seuls `wikidata-sameas.spec.ts` et la doctrine « Person Manon sans sameAs » sortent) → l'ajout est libre.

**Patch prescrit.**
1. **(S, code)** Ajouter au tableau `src/lib/seo.ts:906-911` les 3 URLs registre ci-dessus (données publiques, sources d'autorité maximale pour la réconciliation d'entité française) — et, comme le prescrit `F4-moteurs-ia.md`, le profil Crunchbase qui capte déjà la requête brand.
2. **(reste Will, externe)** Créer l'item Wikidata **en dernier**, une fois les fiches registre référencées et le NDA publié (sinon suppression pour défaut de notoriété/sources — c'était déjà l'ordre d'attaque du 20/07).

**Effort** : S. **Impact GEO/AEO : fort** (triangulation d'entité = condition du Knowledge Panel et de la citation par un LLM). **Risque de régression : quasi nul** (champ additif, aucun test à amender). **Do-not-touch** : la factory Person de Manon (`seo-content-gen-factories.ts`) qui **doit** rester sans `sameAs` (doctrine v2.1, garde-fou `seo.ts:1073-1078`) ; le regex `^Q\d+$` de `wikidata-sameas.ts`.

---

### [P1] NAP sans « P » : aucun téléphone public, aucun Google Business Profile — verrou n°3 inchangé

**Symptôme.** L'entité n'expose **aucun numéro de téléphone** (ni sur la page contact, ni en JSON-LD), et **aucune fiche d'établissement** n'existe. Or un GBP/Bing Places/PagesJaunes exige un NAP complet et cohérent : sans téléphone, la triangulation locale est structurellement impossible.

**Preuve live (UTC).**
- 19:15:06 — `GET /fr/contact` : `"telephone"` en JSON-LD → **0**, liens `tel:` → **0**, motif téléphone FR → **0**. Seuls `contact@axion-ia.com` et `presse@axion-ia.com`.
- 19:12:05 — nœud `#organization` de la home : pas de clé `telephone` (liste des clés ci-dessus).
- 19:15 — SERP Bing `"Axion-IA" Grenoble avis` : **aucune fiche d'établissement, aucune map card, aucun knowledge panel** ; les résultats organiques sont **100 % des homonymes** (action.com, axiom.trade, axion.shop, axion-france.com, Axion sur Wikipédia FR et EN) — axion-ia.com **absent de la page 1**.
- Repo : `grep -rn "g.page|maps.app.goo.gl|goo.gl/maps|business.google|google.com/maps"` sur `src/` → **0 occurrence** (seules deux URLs `annuaire-entreprises` dans des données économiques de villes tierces).

**Preuve code.** `src/lib/seo.ts:952` : `...(env.COMPANY_PHONE ? { telephone: env.COMPANY_PHONE } : {})` ; `src/env.ts:255` : `COMPANY_PHONE: z.string().optional()` — variable jamais renseignée (preuve live : champ absent y compris sur un rendu runtime). `src/lib/seo/local-citations.ts:39-124` : les 10 annuaires du catalogue, **Google Business Profile en tête**, tous à `listingUrl: null` (cf. B1 : module jamais appelé en production).

**Patch prescrit.** Reste Will, externe et gratuit, dans cet ordre : (1) numéro professionnel dédié → poser `COMPANY_PHONE` côté Coolify (le champ `telephone` apparaît seul en JSON-LD) ; (2) **Google Business Profile** en *Service Area Business* (adresse siège masquée) avec le NAP exact du Kbis ; (3) Bing Places + PagesJaunes ; (4) renseigner les `listingUrl` du catalogue et injecter `buildLocalBusinessSameAsFR()` dans le `sameAs` de `#organization`. **Effort** : M (externe) + S (code, étape 4). **Impact GEO/AEO : fort** (GBP = levier n°1 du panneau local ; c'est aussi ce qui manque pour exister sur « … à Grenoble »). **Risque de régression : quasi nul.** **Do-not-touch** : le pattern *Service Area Business* de `buildLocalBusinessJsonLd` (pas de faux bureau par ville — décision 2026-05-23).

---

### [P1] `llms.txt` : le canal d'ingestion LLM affirme le maximum sans aucune ancre vérifiable, et désambiguïse le mauvais homonyme

**Symptôme.** Le fichier que les moteurs de réponse lisent en priorité porte le claim le plus fort (Qualiopi + financements publics, l. 20) **sans un seul identifiant vérifiable**, et son bloc « NE PAS CONFONDRE » (l. 4) vise `axionai.fr` — un homonyme sans autorité — alors que les deux collisions réellement dangereuses sont mesurées ailleurs dans ce rapport.

**Preuve live.** 19:18:02 UTC — `GET /llms.txt` (200, 10 499 o) : occurrences `SIREN` = **0**, `108018631` = **0**, `AXION IA SAS` = **0**, `Williams` = **0**, `Grenoble` = 1 (dans une URL de page ville, pas dans l'en-tête d'identité). L. 3 : « Cabinet IA opérationnel B2B pour entreprises. **Fondé en France, implanté en Europe.** » — aucune ville, aucune raison sociale, aucun dirigeant. (Nuance vs B1 qui relevait « aucune occurrence de Grenoble » à 17:57 : j'en compte 1, hors bloc d'identité — le constat de fond est identique.)

**Preuve code.** `src/app/llms.txt/route.ts` (générateur ; il référence déjà `/fr/mentions-legales` en l. 20 du rendu — le chaînage existe, les ancres dures manquent).

**Patch prescrit.** (S) Ajouter 3 lignes à l'en-tête du générateur : raison sociale exacte (`AXION IA SAS`), `SIREN 108018631 — RCS Grenoble`, siège `38100 Grenoble`, fondateur `Williams Jullin`, plus l'URL de la fiche registre. Étendre le bloc « NE PAS CONFONDRE » aux homonymes mesurés (AXION FORMATIONS / Saint-Quentin ; AXION G2 / Grenoble). **Coordonner avec A5** (surface partagée) et **avec le P0 Qualiopi** (ne pas renforcer un claim tant qu'il n'est pas corroborable). **Effort S.** **Impact GEO/AEO : moyen-fort.** **Risque : faible** (fichier texte ; vérifier les specs de `llms.txt` s'ils comptent des lignes).

---

### [P2] Trois valeurs différentes pour la date de création de l'entité

`foundingDate: "2026"` (année seule, `src/lib/seo.ts:920`) vs **01/09/2026** au registre (API 19:11:24 + pappers 19:15) vs **« Founded 2025 »** sur LinkedIn (19:12:44). Trois sources, trois valeurs : c'est précisément le type de divergence qui empêche une fusion d'entité propre. Patch (S) : aligner `foundingDate` sur la date d'immatriculation complète (`"2026-09-01"`) et corriger LinkedIn (cf. P1 LinkedIn). Impact faible-moyen, risque nul.

### [P2] Ancrage registre du fondateur dispersé — et un point de vigilance à vérifier en base

`GET recherche-entreprises?q=jullin williams` (19:22:08 UTC) → **7 sociétés**, dont 6 à Saint-Étienne/Saint-Chamond (INVEST SUN, WILSOPH actives ; SARL MELVYN, YELLOW SUN, SB FRANCE, 3J & CO/ZOZOTE fermées) et AXION IA à Grenoble. Le `sameAs` de la Person `/fr/equipe/williams#person` ne porte qu'**un** lien (`linkedin.com/in/williamsjullin/`, statut 999 = anti-bot LinkedIn, non concluant). Pour un moteur, l'empreinte registre du fondateur pointe majoritairement vers la Loire — ce qui dilue le rattachement Grenoble (constat déjà fait le 20/07 sous la forme « l'empreinte de Williams Jullin résout vers ZOZOTE/WILSOPH » : **inchangé**).

**[À CONFIRMER] — point de vigilance vérifiabilité** : *INVEST SUN* (SIREN 901434837, Saint-Étienne, active) a Williams Jullin parmi ses dirigeants au registre, et la mémoire projet la mentionne comme « premier client ». Aucun fichier de contenu du dépôt ne la cite (`grep -rli "invest sun"` sur `src/content/`, `src/app/`, `messages/` → **0**), mais les avis et cas concrets sont **en base**, hors de mon périmètre d'accès (F5 n'est pas autorisé aux SELECT prod). Si une référence, un avis ou un cas concret publié désignait nommément cette société comme client tiers, un vérificateur (ou un LLM avec accès registre) pourrait l'opposer publiquement. **À vérifier par un agent autorisé DB** (B6/D-squad) ; aucun patch prescrit tant que ce n'est pas établi.

### [P2] Descriptions d'entité divergentes entre les trois profils tiers

19:12:44–19:13:22 UTC : LinkedIn = « IT Services and IT Consulting… conseil, audit & intégration IA » ; about.me = « I am a consultant, AI Consultant, and AI Trainer in France » (en anglais, sur un site FR-only) ; Indie Hackers = « Cabinet d'IA opérationnelle pour TPE/PME… forfait fixe, résultat concret en jours ou semaines ». Aucune des trois ne reprend le positionnement SSOT (`src/lib/brand.ts`), aucune ne mentionne Grenoble ni l'activité de formation. C'est le constat « descriptions divergentes » du 20/07, **inchangé** : un LLM qui agrège ces profils obtient trois définitions de l'entreprise. Patch (S, externe) : recopier la description SSOT `BRAND` sur les trois profils. ⚠️ En le faisant, **ne pas** propager la formule Indie Hackers « résultat concret » : les CGV sont une obligation de **moyens** (décision actée n°8).

---

## Delta chiffré vs audit 2026-07-20 — les 6 verrous

| # | Verrou (état 2026-07-20) | État mesuré 2026-08-14 (UTC) | Verdict |
|---|---|---|---|
| 1 | **Mentions légales** : SIREN/RCS/TVA/adresse tous « communiqué sur demande » | Version fraîche **complète** (19:10:05) : AXION IA SAS, capital 1 000 €, ELITE BUREAUX - boîte 53, 11 Av. Paul Verlaine, 38100 Grenoble, RCS Grenoble, SIREN 108018631, SIRET 10801863100011, TVA FR51108018631, directeur de publication nommé, hébergeur Hetzner. **Mais** version stub servie après chaque deploy et figée 1 h à l'edge (19:09:38 et 19:23:29) | ✅ **levé sur le fond** / ⚠️ **repart en panne à chaque deploy** (P0-2) |
| 1bis | **Entité introuvable au registre** (« aucune structure trouvée », aucun Axion en Isère) | `q=axion ia` → **1 seule** structure en France : AXION IA, SIREN 108018631, Grenoble, dirigeant JULLIN WILLIAMS CHRISTIAN, NAF 62.02A (19:14:08). 3 fiches miroir 200 | ✅ **levé** |
| 2 | **Liste publique OF / NDA** : Qualiopi revendiqué, absent de la liste, aucun NDA publié | `est_organisme_formation = false`, `est_qualiopi = false`, `liste_id_organisme_formation = null` (19:11:24) ; **aucun NDA nulle part sur le site** (§12 sans ligne NDA, 19:10:05) ; claim toujours publié (home, §12, JSON-LD, llms.txt) | ❌ **inchangé — aggravé** (le claim est désormais aussi en mentions légales) |
| 3 | **Google Business Profile** : absent | Aucune fiche, aucune map card, aucun panneau (Bing 19:15) ; 0 URL GBP dans le dépôt ; catalogue 0/10 ; **et toujours aucun téléphone public** | ❌ **inchangé** |
| 4 | **LinkedIn entreprise** : `company/axion-ia-france` « introuvable en recherche, un sameAs mort nuit » | Page **vivante** (200, 19:12:44), lien retour vers axion-ia.com — mais **HQ Paris**, nom « Axion-IA.com », « Founded 2025 », 7 abonnés, aucune mention OF/Qualiopi | 🟠 **levé sur la forme, retourné sur le fond** (P1) |
| 5 | **Wikidata** : absent | `wbsearchentities` : **0 item** pour « Axion-IA » et « Axion IA » (19:12:00) | ❌ **inchangé** |
| 6 | **`sameAs` = 3 entrées** (LinkedIn, about.me, indiehackers) | **Toujours exactement 3** (19:12:05), toutes vivantes (200), **aucun** nœud registre/Wikidata/Crunchbase | ❌ **inchangé** |
| 7 | **Collisions homonymes** : AXION FORMATIONS (Saint-Quentin, Qualiopi), AXION G2 (Grenoble), axion.bj | AXION FORMATIONS : `est_organisme_formation=true`, `est_qualiopi=true`, NDA 22020045002 (19:14:08) et capte la requête OF/Qualiopi (19:16) ; AXION G2 Grenoble **actif** ; 6 « AXION » en Isère ; Bing brand = 100 % homonymes (19:15) | ❌ **inchangé — risque de captation confirmé live** |

---

## Mesures brutes

| Heure (UTC) | Cible | Statut / volume | Observation clé |
|---|---|---|---|
| 19:09:25 | `gh run list` | — | deploy atterri 18:26 ; run 18:54 `in_progress` → mes mesures sont à J+43…57 min post-atterrissage |
| 19:09:38 | `GET /fr/mentions-legales` | 200 / 1 172 538 o | stub : « communiqué sur demande » ×6, 0 SIREN, org sans `vatID` ; `x-nextjs-cache: STALE`, `cf-cache-status: MISS`, build `99ba93a0` |
| 19:10:05 | `GET /fr/mentions-legales?f5audit=2` | 200 | **complet** : SIREN ×2, SIRET ×4, TVA ×4 ; `x-nextjs-cache: HIT` |
| 19:11:24 | API recherche-entreprises `q=108018631` | 200 / 1 résultat | AXION IA, Grenoble, NAF 62.02A, création 01/09/2026, dirigeant JULLIN WILLIAMS CHRISTIAN ; **est_organisme_formation=false, est_qualiopi=false** |
| 19:12:00 | Wikidata `wbsearchentities` ×2 | 200 / 0+0 | aucun item |
| 19:12:05 | `GET /fr` | 200 / 1 577 128 o | 5 blocs JSON-LD ; org sans `vatID`/`identifier`/`telephone`/`aggregateRating` ; `sameAs` = 3 ; `foundingDate: "2026"` |
| 19:12:25 | 3 URLs `sameAs` | 200 ×3 | aucun lien mort |
| 19:12:44 | LinkedIn `company/axion-ia-france` | 200 / 160 043 o | **HQ Paris**, « Founded 2025 », nom « Axion-IA.com », 7 abonnés, lien retour OK |
| 19:13:18 | about.me/axion-ia | 200 / 110 212 o | « Axion IA - France », bio EN, 0 Paris / 0 Grenoble, lien retour OK |
| 19:13:22 | indiehackers.com/AxionIA | 200 / 42 440 o | « Cabinet d'IA opérationnelle pour TPE/PME… résultat concret » |
| 19:13:42 | data.gouv — dataset Liste publique OF | 200 | dataset `582c8978c751df788ec0bb7e` identifié (CSV ~ monactiviteformation) — non téléchargé (volume), le champ dérivé de l'API fait foi |
| 19:14:08 | API — `q=395041809`, `q=axion&departement=38`, `q=axion ia` | 200 | AXION FORMATIONS OF+Qualiopi ; 6 AXION en Isère (dont AXION G2 Grenoble actif) ; « axion ia » = 1 seul résultat |
| 19:15:06 | `GET /fr/contact` | 200 | 0 téléphone, 0 lien `tel:`, 2 e-mails |
| ~19:15 | SERP Bing `"Axion-IA" Grenoble avis` | — | 0 résultat axion-ia.com, 0 fiche/knowledge panel, 100 % homonymes |
| ~19:16 | SERP `"Axion-IA" Qualiopi … déclaration d'activité` | — | AXION FORMATIONS (C2RP + PagesJaunes) capte l'intention |
| 19:15 | pappers.fr/entreprise/axion-ia-108018631 | 200 | fiche réelle, **aucune** mention OF/Qualiopi |
| 19:17:38 | annuaire-entreprises / pappers / societe.com | 200 ×3 | 3 nœuds de corroboration disponibles, aucun déclaré en `sameAs` |
| 19:18:02 | `GET /llms.txt` | 200 / 10 499 o | 0 SIREN, 0 raison sociale, 0 fondateur ; claim Qualiopi + financements (l. 20) |
| 19:19:00 | `/fr/mentions-legales` (méta) | — | `robots: index, follow` ; canonical propre |
| 19:19:21 | `GET /sitemap/pages.xml` | 200 / 86 `<loc>` | **contient** `mentions-legales` (×3) — infirme le root-cause « hors sitemap » de B1 |
| 19:20:42→58 | réplication du sweep (32 sous-sitemaps) | — | **1 641 URLs**, `/fr/mentions-legales` rang **1 540** (cap = 4 000) ⇒ la page **est** balayée |
| 19:22:08 | API `q=jullin williams` | 200 / 7 | 7 sociétés, 6 dans la Loire |
| 19:22:08 | `GET /fr/equipe/williams` | 200 | Person `sameAs` = 1 seul lien |
| 19:22:28 | linkedin.com/in/williamsjullin | **999** | anti-bot LinkedIn — non concluant |
| 19:23:29 | `GET /fr/mentions-legales` (sans query) | 200 | **stub à nouveau**, `cf-cache-status: HIT` ⇒ edge figé sur la version amputée |

---

## Limites

- **Google Business Profile** : je n'ai pas d'accès à Google Maps / Places (pas d'outil navigateur, pas de clé API, POST interdit). La conclusion « aucun GBP » repose sur une **convergence d'indices** (aucune fiche/panneau côté Bing, 0 URL GBP dans le dépôt, catalogue `local-citations` 0/10, aucun téléphone publiable) et non sur une requête Places directe. À qualifier **[À CONFIRMER]** au sens strict — F3 (SERP Google live) peut le clore.
- **Liste publique des OF** : je me suis appuyé sur les champs dérivés `est_organisme_formation` / `est_qualiopi` / `liste_id_organisme_formation` de l'API `recherche-entreprises` (source officielle DINUM, alimentée par cette liste) plutôt que sur le téléchargement du CSV complet de `monactiviteformation.emploi.gouv.fr` (volume incompatible avec la contrainte « pas de charge machine »). Un décalage de quelques jours entre un enregistrement DREETS tout récent et sa parution dans la liste est possible — d'où le **STOP & ASK** plutôt qu'une affirmation.
- **Variables d'environnement Coolify non lues** : l'état de `QUALIOPI_CERTIFICATION_OBTENUE`, `OF_PUBLIC_DISCLOSURE_ENABLED`, `COMPANY_PHONE`, `WIKIDATA_QNUMBER_AXIONIA` est **inféré** du rendu runtime (méthode fiable : §12 affiché ⇒ les deux drapeaux Qualiopi sont à `true` ; `telephone` absent d'un rendu runtime ⇒ `COMPANY_PHONE` vide).
- **DB prod non consultée** : F5 n'est pas dans la liste des agents autorisés aux SELECT. L'état des champs `nda`, `qualiopi_organisme`, `qualiopi_validite` et le point de vigilance INVEST SUN restent donc inférés/ouverts.
- **LinkedIn profil personnel** : statut 999 (anti-bot) — je ne peux ni confirmer ni infirmer que `linkedin.com/in/williamsjullin/` est vivant et rattaché à la page entreprise. La page **entreprise**, elle, est confirmée (200 + contenu).
- **Effet de bord de mes propres mesures (à signaler honnêtement)** : mon GET de 19:09:38 sur `/fr/mentions-legales` a fait mettre en cache la version stub par Cloudflare pour ~1 h (constaté à 19:23:29). C'est exactement le mécanisme que je documente en P0-2 — mais cela signifie que l'edge sert la version amputée jusqu'à ~20:10 UTC ou jusqu'au prochain deploy/purge. Aucune écriture, aucune soumission d'URL, aucun POST n'a été effectué ; seules des requêtes GET/HEAD.
- **Deploy en vol** (run parti 18:54, atterrissage estimé 19:50–20:00 UTC) : toutes mes mesures sont antérieures. Le P0-2 se **ré-armera** à l'atterrissage. Ne pas re-mesurer entre 19:50 et ~20:50 UTC sans vérifier `gh run list -L 2 --workflow deploy-coolify.yml`.
- **SERP** : les recherches web disponibles ici portent sur un index majoritairement US ; les mesures Bing/organiques valent comme signal de désambiguïsation d'entité, pas comme mesure de position FR (c'est le périmètre de F2/F3).
