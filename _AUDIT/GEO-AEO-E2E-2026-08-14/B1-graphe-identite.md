# B1 — Graphe d'identité (Organization / WebSite / LocalBusiness / Person)

- **Date** : 2026-08-14, mesures live 17:49 → 17:57 UTC (toutes AVANT l'atterrissage du deploy en vol parti 17:33, estimé ≥ 18:30 UTC ; dernier deploy stable atterri ~14:57 UTC).
- **Périmètre couvert** : `src/lib/seo.ts` (buildOrganizationJsonLd, buildWebsiteJsonLd, buildPersonJsonLd, buildLocalBusinessJsonLd, buildPlaceJsonLd, buildSiegePostalAddress, describeRegistrationNumber), `src/lib/seo/wikidata-sameas.ts`, `src/lib/seo/local-citations.ts`, `src/lib/seo/williams-person.ts`, `src/lib/seo/manon-person.ts`, `src/lib/brand.ts` (SSOT BRAND/FOUNDER), `src/components/qualiopi/organization-credential.ts`, `src/server/qualiopi/config/public-identity.ts`, `src/lib/legal-identity.ts`, `src/lib/seo/__tests__/identite-legale-registre.spec.ts`, `src/app/[locale]/layout.tsx` (émission), `src/app/[locale]/mentions-legales/page.tsx`, listes du job `warm` (`.github/workflows/deploy-coolify.yml`). Live : home, /equipe/williams, /equipe/manon, /mentions-legales (×4), /conditions-generales, /a-propos, /contact, 1 page ville, llms.txt.

## Résumé exécutif

Le graphe d'identité est **globalement excellent dans sa version fraîche** : nœud `#organization` unique par `@id`, legalName « AXION IA SAS » aligné Kbis, adresse siège Grenoble exact-match SIRENE codée en dur, founder fusionné avec la Person `/equipe/williams#person`, Manon proprement disclosée (AI Act), NAP complet et cohérent sur les mentions légales régénérées (SIREN 108018631 / SIRET 10801863100011 / TVA FR51108018631). **Mais la version réellement servie après chaque deploy est amputée** : `vatID` + `identifier` (SIRET) dépendent d'env vars RUN absentes au build GH Actions, et les mentions légales (ISR, hors sitemap, hors listes du job `warm`) servent « communiqué sur demande » ×6 pendant des heures — constaté live ~3 h après le deploy de 14:57. Par ailleurs, la triangulation Wikidata est câblée mais jamais activée (env absente), et le module citations locales (0/10 annuaires) est du code mort.

## Findings

### [P0] Après chaque deploy, l'identité légale est amputée sur les pages figées au build : `#organization` sans `vatID`/SIRET + mentions légales en « communiqué sur demande »

**Symptôme.** Le même nœud `#organization` (même `@id`) déclare des champs différents selon la page servie : la home (revalidée) porte `vatID` + `identifier` SIRET, mais `/mentions-legales`, `/conditions-generales`, `/a-propos`, `/contact` servaient la version build (sans ces champs) **3 heures après** le deploy de 14:57. Pire : la page mentions légales — LA page que Google/LLMs recoupent avec SIRENE/INPI pour la fusion d'entité et le Knowledge Panel — affichait « Siège social : communiqué sur demande… Immatriculation RCS et SIREN communiqué sur demande… TVA communiqué sur demande » (×6) alors que le JSON-LD de la même page publie l'adresse complète. Incohérence visible-vs-structuré + état dominant dans le temps vu la fréquence des deploys (plusieurs/jour).

**Preuve code.**
- `src/lib/seo.ts:874-875` : `vatID = env.COMPANY_VAT_NUMBER`, `registrationNumber = env.COMPANY_REGISTRATION_NUMBER` — env RUN-scope Coolify uniquement.
- `.github/workflows/deploy-coolify.yml` : grep `COMPANY_VAT_NUMBER|COMPANY_REGISTRATION_NUMBER` → **0 occurrence** (pas des build-args) ⇒ toute page pré-rendue au build émet le nœud sans ces champs. C'est exactement la classe de divergence que le fix du 02/08 a éliminée pour l'ADRESSE (`seo.ts:802-816` + spec `identite-legale-registre.spec.ts:94-110`) — mais laissée ouverte pour vatID/SIRET.
- `src/app/[locale]/mentions-legales/page.tsx:23` (`revalidate = 3600`) + `:59` (`resolveLegalIdentity()` lit le SiteSetting `legal_overrides` en DB → au build stub, defaults `null` → `src/lib/legal-identity.ts:237-255` rend « communiqué sur demande »).
- `.github/workflows/deploy-coolify.yml:747` (liste revalidate du job `warm` : 5 paths, SANS `/fr/mentions-legales` ni `/fr/conditions-generales`) et `:778` (liste purge CF : idem). La page est aussi absente de `src/app/sitemap.ts` (grep `mentions-legales` → 0) ⇒ le sweep « warm full indexable surface » (`:827-862`) ne la touche jamais ⇒ la version stub persiste à l'origine jusqu'au premier visiteur organique, ré-armée à CHAQUE deploy.

**Preuve live (UTC).**
- 17:50:45 puis 17:52:14 — `GET /fr/mentions-legales` : « communiqué sur demande » ×6, org node **sans** `vatID` ni `identifier` (clés observées : @id, @type, address, …, hasCredential — pas de vatID), `x-nextjs-cache: STALE`, `cf-cache-status: HIT`, ~2 h 55 après l'atterrissage 14:57.
- 17:53:49 — même URL avec cache-bust (`?b1audit=1`, CF MISS, origin revalidé par mes hits) : « communiqué sur demande » ×0, texte complet « AXION IA SAS … au capital de 1 000 € · Siège social : ELITE BUREAUX - boîte 53, 11 Avenue Paul Verlaine, 38100 Grenoble. RCS de Grenoble, SIREN 108018631. SIRET (siège) : 10801863100011. TVA : FR51108018631 », et JSON-LD avec `vatID` + `identifier`. ⇒ le SiteSetting `legal_overrides` EST bien renseigné : seule la version stub servie fait défaut.
- 17:55:31 — `/fr/conditions-generales`, `/fr/a-propos`, `/fr/contact` : org node layout **sans** `vatID` (versions build encore servies).
- 17:49:06 — home : org node AVEC `vatID: FR51108018631` + `identifier {SIRET, 10801863100011}` (page revalidée).

**Root-cause.** Double dépendance runtime de champs d'identité pourtant publics et figés au registre : (1) `vatID`/SIRET via env non-build-args ; (2) identité mentions légales via DB (stub au build). Aucun des deux chemins n'est couvert par le job `warm` (revalidate + purge CF), et la page est hors sitemap donc hors sweep.

**Patch prescrit.**
1. **(S)** Ajouter `/fr/mentions-legales` et `/fr/conditions-generales` aux DEUX listes du job `warm` (`deploy-coolify.yml:747` et `:778`) — règle mémoire déjà actée : « toute page ISR lisant la DB doit rejoindre les DEUX listes ».
2. **(M)** Faire des identifiants légaux des build-args : passer `COMPANY_VAT_NUMBER` + `COMPANY_REGISTRATION_NUMBER` en `--build-arg` dans le workflow + `ARG/ENV` dans `Dockerfile` (données publiques du Kbis, non secrètes). Alternative alignée sur la doctrine du 02/08 : les figer en code comme l'adresse — mais cela exige d'amender la gate `scripts/check-anti-siren.sh` (écrite « avant l'immatriculation officielle », aujourd'hui obsolète dans son intention) et la spec 3b — ne pas le faire sans décision.

**Effort** : S (patch 1) + M (patch 2). **Impact GEO/AEO : fort** (fusion d'entité SIRENE/Knowledge Panel + cohérence structuré/visible sur la page de corroboration). **Risque de régression** : faible pour le patch 1 (listes additives, job best-effort jamais bloquant) ; moyen pour le patch 2 (toucher au Dockerfile/workflow = chemin de deploy — respecter le contrat `stub.invalid`, ne PAS toucher `SKIP_ENV_VALIDATION`, `BULLMQ_DISABLED`, ni la magic string). **Do-not-touch** : `src/lib/prisma.ts`, `src/lib/redis.ts`, `Dockerfile.coolify-pull`, la garde 3a-bis du spec (adresse sans env) — elle est correcte.

### [P1] Triangulation Wikidata jamais activée : `WIKIDATA_QNUMBER_AXIONIA` absente en prod → `sameAs` sans Wikidata

**Symptôme.** Le mécanisme « Knowledge Graph triangulation » (Sprint v7 Phase 10) est entièrement câblé mais dort : aucun lien `wikidata.org` dans le `sameAs` de l'Organization (ni de Manon).

**Preuve code.** `src/lib/seo/wikidata-sameas.ts:28-37` (lit `process.env.WIKIDATA_QNUMBER_AXIONIA`, fallback array vide) ; injection à `src/lib/seo.ts:906-911` (`sameAs: [...buildOrganizationSameAs(), LinkedIn, about.me, indiehackers]`). Manon : `seo-content-gen-factories.ts:87` (`buildPersonManonSameAs`). La var n'est déclarée nulle part ailleurs (pas dans `env.ts`, lecture directe process.env — fallback-safe voulu).

**Preuve live.** 17:49:06 UTC — home **rendue au runtime avec les env réels** (preuve : `vatID` présent) : `sameAs = ["https://www.linkedin.com/company/axion-ia-france", "https://about.me/axion-ia", "https://www.indiehackers.com/AxionIA"]` — pas de Wikidata ⇒ l'env var n'est pas posée côté Coolify (ou invalide au regex `^Q\d+$`).

**Root-cause.** L'item Wikidata n'a vraisemblablement jamais été créé ; l'env var n'a jamais été posée. Sous-note : `getWikidataConfigStatus()` (`wikidata-sameas.ts:67-81`), prévu « pour admin UI », n'est branché à aucune page admin (grep : consommé uniquement par son spec) — personne ne voit que c'est éteint.

**Patch prescrit.** Reste Will (action externe) : créer l'item Wikidata « AXION IA SAS » (SIREN 108018631, siège Grenoble, site officiel axion-ia.com — les notabilité/sources : SIRENE, societe.com, Kbis) puis poser `WIKIDATA_QNUMBER_AXIONIA=Qxxxxxxx` dans Coolify (RUN) + restart. Optionnel (S) : afficher `getWikidataConfigStatus()` dans la console admin content-gen/settings pour rendre l'état visible.

**Effort** : S côté code/config (l'essentiel est une action Will hors-code). **Impact GEO/AEO : fort** (ancrage cross-plateforme de l'entité pour Google KP, Perplexity, Claude — c'est le but explicite du module). **Risque de régression : quasi nul** (fallback-safe, champ purement additif). **Do-not-touch** : le regex de validation `^Q\d+$`.

### [P1] Citations locales NAP : module 100 % inerte — 0/10 annuaires listés, jamais injecté dans aucun JSON-LD

**Symptôme.** `LOCAL_CITATIONS_FR` recense 10 annuaires (PagesJaunes, **Google Business Profile**, Bing Places, Kompass, societe.com, Infogreffe, LinkedIn, French Tech, Mappy, 118000) — tous à `listingUrl: null`. `buildLocalBusinessSameAsFR()` retourne `[]` et, de toute façon, **aucun code de production ne l'appelle**.

**Preuve code.** `src/lib/seo/local-citations.ts:39-124` (les 10 entrées, toutes `listingUrl: null`) ; `:133-137` (filtre non-null → `[]`). Grep repo : `buildLocalBusinessSameAsFR` / `getLocalCitationsCoverage` / `LOCAL_CITATIONS_FR` ne sont référencés QUE par `local-citations.spec.ts` (qui verrouille même « listed=0 V1 »). `buildLocalBusinessJsonLd` (`seo.ts:1415-1475`) n'injecte jamais ce sameAs.

**Preuve live.** 17:55-17:56 UTC — `/fr/a-propos` (ProfessionalService) et `/fr/implantations/auvergne-rhone-alpes/grenoble` (Place) : aucun `sameAs` annuaire. Aucune page ne porte de corroboration NAP externe hormis les 3 profils sociaux de l'Organization.

**Root-cause.** V1 volontairement en attente des créations de fiches par Will — mais ni surface admin ni rappel : le module est invisible et dort depuis le Sprint v7.

**Patch prescrit.** Reste Will (externe, priorité 1 du catalogue lui-même) : créer au minimum **Google Business Profile** (Service Area Business, adresse siège masquée), **Bing Places**, **PagesJaunes** avec le NAP exact du Kbis (« AXION IA SAS », 11 Avenue Paul Verlaine, ELITE BUREAUX - boîte 53, 38100 Grenoble). Puis (S) renseigner les `listingUrl` dans le catalogue et injecter `buildLocalBusinessSameAsFR()` dans le `sameAs` du nœud `#organization` (pas dans chaque page ville). Corriger au passage le commentaire d'en-tête `local-citations.ts:8-9` (« 1 siège (Paris) » — obsolète, siège = Grenoble depuis le 30/07).

**Effort** : S code, M externe. **Impact GEO/AEO : fort** (GBP est le levier n°1 du Knowledge Panel local ; NAP triangulé = condition de la fusion d'entité). **Risque de régression : quasi nul** (additif) — adapter le spec LC5/LC6 qui verrouille `listed=0`. **Do-not-touch** : le pattern Service Area Business de `buildLocalBusinessJsonLd` (pas de fake bureau par ville — décision 2026-05-23).

### [P2] `hasCredential` Qualiopi émis sans numéro, sans validité, sans certificateur — même au runtime

**Symptôme.** Le nœud `#qualiopi` (émis sur toutes les pages) ne porte que la mention par défaut « …catégories d'actions suivantes : Actions de formation. » — pas d'`identifier` (n° de certificat), pas de « valable jusqu'au… », pas d'organisme certificateur COFRAC en `recognizedBy`.

**Preuve code.** `src/components/qualiopi/organization-credential.ts:25-34` (validité et issuer ajoutés SEULEMENT si renseignés en config admin) ; `src/lib/seo.ts:978` (`identifier` seulement si `number` non vide) ; `public-identity.ts:74-104` (lit `qualiopi_organisme`, `qualiopi_validite`, `qualiopi_categories_certifiees` — le fallback « Actions de formation » de la ligne 100 est exactement le texte observé).

**Preuve live.** 17:53:49 UTC — render FRAIS de /fr/mentions-legales (DB réelle, preuve : identité légale complète sur la même page) : `hasCredential` sans `identifier`, description sans date de validité, `recognizedBy` = Ministère du Travail seul. Idem home 17:49.

**Root-cause.** Champs `qualiopi_organisme` / `qualiopi_validite` vides dans la config admin. Pour le numéro : décision Will existante « le n° de certificat n'est JAMAIS affiché publiquement » (commentaire `public-identity.ts:84-91`) — elle vise le rendu des composants ; noter que `organization-credential.ts:31` publierait le n° en JSON-LD (public aussi) si Will le renseignait un jour : cohérence à trancher par Will, pas par un patch.

**Patch prescrit.** Reste Will (console admin) : renseigner `qualiopi_organisme` (certificateur COFRAC) + `qualiopi_validite` → le credential s'enrichit automatiquement (ISR ≤ 1 h). NE PAS renseigner le n° sans avoir tranché la question JSON-LD ci-dessus. **Effort** : S (saisie). **Impact : moyen** (crédential plus vérifiable pour Google/LLMs). **Risque : nul.**

### [P2] llms.txt sans ancres d'identité (SIREN, siège, fondateur) — cross-ref A5

17:57:12 UTC — `/llms.txt` : bloc d'identité présent (« Cabinet IA opérationnel B2B… NE PAS CONFONDRE avec… », Qualiopi mentionné) mais **aucune** occurrence de « Grenoble », « SIREN », « 108018631 », « Williams ». Pour un canal d'ingestion LLM, les ancres d'entité dures (raison sociale exacte, SIREN, siège, fondateur nommé) sont les meilleurs signaux de désambiguïsation — précisément le but du bloc « NE PAS CONFONDRE ». Patch (S) : ajouter 2 lignes d'identité registre au générateur llms.txt. Coordonner avec l'agent A5 (surface partagée).

### [P2] Divers non bloquants

- `getWikidataConfigStatus()` et `getLocalCitationsCoverage()` promis « pour admin UI » et branchés nulle part (grep : specs uniquement) — l'état de ces deux leviers est invisible de la console. Patch S groupé avec P1-1/P1-2.
- `local-citations.ts:8` : commentaire « siège (Paris) » obsolète (Grenoble depuis 30/07).
- `additionalType: "https://schema.org/AIGeneratedContent"` (Manon + articles) : type absent du vocabulaire schema.org publié — choix documenté « forward-compat draft 2026 » (`seo-content-gen-factories.ts:75-79`), inoffensif (URI ignorée par les validateurs). Aucune action ; mentionné pour éviter une re-découverte.

## Points sains vérifiés (anti-faux-positifs pour la synthèse)

- **Entité unique** : tous les nœuds secondaires se rattachent par `@id` (`publisher`, `parentOrganization`, `worksFor` → `/#organization` ; founder → `/fr/equipe/williams#person` = exactement l'@id du nœud Person servi sur `/fr/equipe/williams`, vérifié live 17:50). Pas de mini-Organization concurrent.
- **legalName/adresse** : « AXION IA SAS » (sans tiret, Kbis) + adresse avec complément « ELITE BUREAUX - boîte 53 » codée en dur (`seo.ts:825-834`), verrouillés par `identite-legale-registre.spec.ts` (3 invariants + interdiction d'env sur l'adresse). Footer visible « © 2026 AXION IA SAS » cohérent.
- **Cohérence SIREN/TVA** : FR51108018631 = FR + clé 51 + SIREN 108018631 ; SIRET 10801863100011 = SIREN + NIC 00011. Concordance JSON-LD ↔ mentions légales (version fraîche) ↔ Kbis documenté.
- **AggregateRating home** : 4.9 / 77 avis = `Math.round(4.88×10)/10` (`queries.ts:189`), reviewCount 77 = état de la base connu (77 avis, 4,88/5). Conforme, gaté ≥ 5 avis, niché sur l'entité par `@id`. Rien à corriger.
- **Manon** : zéro sameAs social (doctrine v2.1, garde-fou throw `seo.ts:1073-1078` + factory dédiée), disclosure AI Act complète live. Sain.
- **LocalBusiness villes** : mode Service Area Business respecté live (pas de geo/openingHours/priceRange fake sur la page ville testée ; `/a-propos` porte une adresse city-level Grenoble légitime).

## Mesures brutes

| Heure (UTC) | URL | Statut | Observation clé |
|---|---|---|---|
| 17:49:06 | /fr | 200 (1,75 Mo) | 6 blocs JSON-LD ; org layout AVEC vatID+SIRET ; sameAs sans Wikidata ; org aggregate 4.9/77 |
| 17:50:31 | /fr/equipe/williams, /fr/mentions-legales, /fr/recherche, /fr/a-propos, /fr/contact, /fr/equipe/manon | 200 ×6 | — |
| 17:50:45 | /fr/mentions-legales | 200 | « communiqué sur demande » ×6 ; org SANS vatID/identifier ; credential Qualiopi défauts |
| 17:52:14 | /fr/mentions-legales | 200 | idem ; `x-nextjs-cache: STALE`, `cf-cache-status: HIT`, Age 102, `s-maxage=3600, swr=31532400` |
| 17:53:49 | /fr/mentions-legales?b1audit=1 | 200 | CF MISS / Next HIT (revalidé) : identité COMPLÈTE (SIREN 108018631, SIRET 10801863100011, TVA FR51108018631, capital 1 000 €, RCS Grenoble) ; vatID+identifier présents |
| 17:55:31 | /fr/conditions-generales, /fr/a-propos, /fr/contact | 200 ×3 | org layout SANS vatID (versions build) ; PS a-propos : adresse Grenoble city-level, pas de fake claims |
| 17:56:40 | /fr/implantations/auvergne-rhone-alpes/grenoble | 200 | Place only (address city-level), pas de LB avec claims bureau |
| 17:57:12 | /llms.txt | 200 | identité sans SIREN/siège/fondateur ; Qualiopi présent |

Person /equipe/williams live : @id, name « Williams Jullin », jobTitle « Fondateur & CEO d'Axion-IA », sameAs LinkedIn réel, worksFor @id — fusion parfaite avec `Organization.founder`.

## Limites

- **Validation schema.org officielle non exécutée** : validator.schema.org / Rich Results Test exigent un POST (interdit — prod GET/HEAD only). Validation structurelle manuelle (parsing JSON, @ids, champs requis) uniquement.
- **DB prod non consultée** (B1 non autorisé SELECT) : l'état de `legal_overrides` et des configs Qualiopi est INFÉRÉ des renders runtime (fiable : le render frais 17:53 prouve `legal_overrides` renseigné et `qualiopi_organisme`/`qualiopi_validite` vides) ; la moyenne 4,88 → 4.9 s'appuie sur l'état de base documenté du digest, pas sur un SELECT.
- **Deploy en vol** (17:33, atterrissage ~18:30 UTC) : toutes mes mesures sont antérieures ; le P0 se ré-armera à l'atterrissage (les pages re-serviront la version stub) — ne pas re-mesurer entre 18:30 et ~19:30 sans vérifier `gh run list`.
- La présence effective des env `WIKIDATA_QNUMBER_*` côté Coolify n'a pas été lue directement (pas de SSH env-dump) — l'absence est prouvée par l'output runtime (page avec env réels, sans Wikidata dans sameAs).
- L'existence (ou non) d'un item Wikidata déjà créé pour Axion-IA n'a pas été vérifiée en ligne (hors périmètre outillage de cet agent ; à confirmer avant création pour éviter un doublon).
