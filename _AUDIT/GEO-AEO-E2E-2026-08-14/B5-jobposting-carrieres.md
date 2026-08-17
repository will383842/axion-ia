# B5 — JobPosting & fraîcheur carrières

**Date d'exécution** : 2026-08-14 22:38 UTC → 2026-08-15 00:40 UTC
**Mode** : AUDIT-ONLY STRICT (lecture de code + GET/HEAD prod uniquement — aucun build, aucun test, aucun accès DB : B5 n'est pas dans la liste des agents autorisés à `ssh axion-prod`).

**Périmètre réellement couvert**

- `src/lib/seo/job-posting.ts` (builder JSON-LD des offres DB) + sa spec.
- `src/lib/careers/freshness.ts` (logique pure) + `src/server/careers/freshness.ts` (requêtes) + spec.
- Chaîne de fraîcheur complète : `src/content/recrutement/dates.ts` → cron `formation-crons.offres-fraicheur` (`queues.ts`, `qualiopi-formation-crons-worker.ts`) → `notifications/format.ts` → `channels/telegram.ts` → bouton « Republier » (`src/features/admin-job-offers/actions.ts`).
- `src/app/sitemap-carrieres.xml/route.ts` et `src/app/sitemap-recrutement.xml/route.ts`.
- Les 2 JobPosting **statiques** : `/fr/devenir-commercial-ia` et `/fr/memo-isere`.
- Live : **les 54 pages d'offres** du sitemap carrières téléchargées et leur JSON-LD parsé intégralement, + hub `/fr/carrieres`, + `/fr/carrieres/data-engineer/postuler`, + les 2 pages statiques.

**Hors périmètre** (autres agents, croisés mais pas re-mesurés) : `lastmod` des entrées carrières dans `sitemap-index.xml` (**A2**), volumétrie/gating des sub-sitemaps DB (**A3**), activation réelle de la Google Indexing API (**A6**), liens locale-less `/carrieres/*` → 301 (**C4**), canonical des facettes du hub (**C5**), poids de page / Web Vitals (**G**).

---

## Résumé exécutif

Le socle JobPosting d'Axion-IA est **au-dessus de la moyenne du marché** : JSON-LD **inline** dans le HTML brut sur 54/54 offres (pas d'`afterInteractive` — le défaut transverse (b) ne touche PAS ma surface), garde-fous d'indexabilité corrects, sitemap `force-dynamic` non pollué par le stub de build, `/postuler` en `noindex`, aucun bump automatique de date dans le code. Deux défauts cassent néanmoins la couche Google for Jobs. **P0-1** : 10 offres **hybrides** sont déclarées `jobLocationType: TELECOMMUTE`, ce que Google interdit explicitement (« don't mark up jobs that allow occasional work-from-home ») — signal trompeur pour le candidat et risque de retrait des annonces. **P0-2** : 53 des 54 offres portent le **même `datePosted` à la milliseconde** (`2026-08-13T05:49:03.239Z`), avec trois effets en cascade — signal de génération en masse, falaise de péremption simultanée le 2026-09-27, et alerte Telegram de fraîcheur mesurée à **4 017 / 4 096 caractères** (2 % de marge avant échec silencieux). Trois P1 suivent : double JobPosting de la même offre commerciale sur deux URLs (20 villes communes), titres non conformes (nom d'entreprise, `(H/F)`, `(full remote)`, copy marketing) et `hiringOrganization` auto-référencé sur `/devenir-commercial-ia`.

---

## Findings

### [P0] Les offres hybrides sont déclarées « 100 % télétravail » (10/54)

- **Symptôme** : 10 offres en mode `hybrid` (donc partiellement en présentiel à Grenoble) émettent `jobLocationType: "TELECOMMUTE"` **en plus** de leur `jobLocation` Place. Google indexe alors ces annonces comme intégralement à distance ; un candidat de Lille les voit remonter sur « télétravail » et découvre le présentiel en lisant la page.
- **Preuve code** : `src/lib/seo/job-posting.ts:144-150` —
  ```ts
  // Hybride = présentiel + télétravail : signaler les DEUX à Google for Jobs
  if (offer.workMode === "hybrid") {
    jsonLd.jobLocationType = "TELECOMMUTE";
    jsonLd.applicantLocationRequirements = applicantLocationRequirements(offer, isFr);
  }
  ```
  Comportement **verrouillé par un test** : `src/lib/seo/__tests__/job-posting.spec.ts:93` (« hybride → Place + TELECOMMUTE (les deux) »).
- **Preuve live (2026-08-14 22:42 UTC)** : parsing des 54 JSON-LD → 10 offres cumulent `jobLocation` **et** `jobLocationType=TELECOMMUTE` : `architecte-cloud-ia`, `consultant-data-strategie`, `consultant-ia-generative`, `data-engineer`, `data-scientist`, `ingenieur-machine-learning`, `ingenieur-mlops`, `ingenieur-rag-llm`, `product-manager-ia`, `prompt-engineer`. Exemple : `/fr/carrieres/data-engineer` (l'une des 2 seules URLs à avoir capté des clics GSC en W33, cf. F2).
- **Preuve documentaire (WebFetch, 2026-08-15 00:20 UTC)** — `developers.google.com/search/docs/appearance/structured-data/job-posting` : « Set this property with the value `TELECOMMUTE` for jobs in which the employee may or must work remotely **100% of the time** » et « **Don't** mark up jobs that allow occasional work-from-home, jobs for which remote work is a negotiable benefit, or have other arrangements that are not 100% remote. »
- **Root-cause** : intention légitime (« ne pas rater les recherches télétravail ») implémentée par un champ dont la sémantique Google est exclusive, et figée par un test qui verrouille le comportement fautif au lieu de la règle.
- **Patch prescrit** : retirer les 2 lignes `jobLocationType`/`applicantLocationRequirements` de la branche `hybrid` (`job-posting.ts:147-150`) et laisser l'offre hybride en `jobLocation` Place seul. Réécrire `job-posting.spec.ts:93` en « hybride → Place SEUL, jamais TELECOMMUTE ». Compensation de visibilité honnête : `remoteDaysPerWeek` (champ DB déjà saisi en console, aujourd'hui mort — cf. P2-10) exposé en clair dans la `description` et dans la FAQ de l'offre (`carrieres/[slug]/page.tsx:132-135` produit déjà la bonne phrase pour l'humain).
- **Effort** : S (≈ 30 min, 2 fichiers).
- **Impact GEO/AEO** : **fort** — conformité Google for Jobs sur 18 % du parc d'offres, et suppression d'une affirmation trompeuse reprise telle quelle par les moteurs de réponse.
- **Risque de régression** : moyen. Le test `job-posting.spec.ts:93` échouera → il DOIT être réécrit dans le même patch. Perte assumée : les 10 offres sortent du filtre « télétravail » de Google for Jobs (c'est le but). **Do-not-touch** : la branche `remote` (`job-posting.ts:131-133`) et `applicantLocationRequirements()` (`:34-48`) — le ciblage francophonie de `monteur-video-freelance-distance` (22 pays) est correct et doit rester intact ; ne pas toucher `validThrough` ni `baseSalary` (décision actée 5).
- ⚠️ **STOP & ASK Will** : le comportement actuel est un choix documenté en commentaire, pas un oubli. Le patch le renverse — à valider explicitement.

---

### [P0] 53 offres sur 54 partagent le même `datePosted` à la milliseconde

- **Symptôme** : toutes les offres DB sauf une portent `datePosted: "2026-08-13T05:49:03.239Z"`. Trois conséquences en cascade :
  1. **Signal de masse** : Google for Jobs reçoit 53 annonces publiées à la même milliseconde par le même employeur — pattern de génération automatisée.
  2. **Falaise de péremption** : elles franchiront le seuil de 45 jours **le même jour** (≈ 2026-09-27). Le parc entier devient « vieux » d'un coup pour les filtres « 3 derniers jours / dernière semaine ».
  3. **Le garde-fou lui-même casse ce jour-là** : l'alerte Telegram générée pour 53 offres DB + 2 statiques mesure **4 017 caractères** contre une limite Telegram `sendMessage` de **4 096**. Marge = 79 caractères (2 %). Deux offres de plus, ou un `daysOld` à 3 chiffres (100 j → +56 car.), ou un `ADMIN_URL_PREFIX` plus long que 8 caractères font passer le message au-dessus : Telegram répond 400, `sendTelegramRaw` retourne `false` en fail-soft et n'écrit qu'un `console.warn`. **Le rappel de fraîcheur meurt en silence exactement le jour où il sert.**
- **Preuve code** :
  - `src/lib/seo/job-posting.ts:75,87` — `const posted = offer.publishedAt ?? offer.datePosted;` puis `datePosted: posted.toISOString()`.
  - `src/content/recrutement/dates.ts:19` — `JOB_OFFER_FRESHNESS_MAX_DAYS = 45`.
  - `src/server/queue/queues.ts:1510-1514` — cron hebdo `15 8 * * 1`.
  - `src/server/queue/workers/qualiopi-formation-crons-worker.ts:1148-1168` — envoie **toutes** les offres périmées dans un seul `notify()`, sans plafond ni pagination.
  - `src/server/notifications/format.ts:254-269` — une ligne `formatKV` par offre, aucune troncature.
  - `src/server/notifications/channels/telegram.ts:47-69` — un seul POST `sendMessage`, **aucun découpage**, `res.ok` faux → `console.warn` seul (`:59-68`).
  - Origine de l'écriture en masse : **aucun** script du dépôt ne peut produire une milliseconde identique — `scripts/seed-careers-offers.ts:113` évalue `new Date()` **par enregistrement dans la boucle** (`:85-126`), et aucune migration de `prisma/migrations/` ne touche `published_at` des `job_offers`. Un `UPDATE … SET published_at = now()` manuel (transaction unique → horodatage identique) est la seule hypothèse compatible. **[À CONFIRMER]** sur l'origine exacte — le symptôme, lui, est prouvé.
- **Preuve live (2026-08-14 22:42 UTC)** : distribution des `datePosted` sur les 54 pages d'offres → `2026-08-13T05:49:03.239Z` × **53**, `2026-08-11T03:23:32.083Z` × 1 (`monteur-video-freelance-distance`).
- **Preuve live (2026-08-15 00:31 UTC)** : simulation exacte du message MarkdownV2 à partir des 54 titres réels + les 2 entrées statiques, avec `escapeMarkdownV2` (`format.ts:95-97`) et `formatKV` (`:145-148`) → **4 017 caractères**, rupture dès la 55ᵉ ligne listée.
- **Root-cause** : `publishedAt` est traité comme un simple horodatage technique alors qu'il **est** la date que Google lit ; une écriture de masse l'a aligné, et aucun garde-fou (ni test, ni contrainte, ni alerte) ne détecte une collision de dates. Le cron de fraîcheur a été dimensionné pour « quelques offres », pas pour le parc entier.
- **Patch prescrit** (3 volets, indépendants) :
  1. **Étaler** — script one-shot AUDITÉ (hors chemin `revalidate`) qui redistribue `published_at` des 53 offres sur une fenêtre passée plausible, **en s'appuyant sur une date réelle vérifiable** (`created_at` de l'offre, ou `activity_log` `joboffer.created`/`joboffer.updated`). ⚠️ ce n'est PAS un bump : les dates doivent **reculer** ou rester égales, jamais avancer — sinon on retombe exactement dans l'interdit de la décision actée 5.
  2. **Plafonner l'alerte** — dans `qualiopi-formation-crons-worker.ts:1155-1166`, limiter à `stale.slice(0, 15)` + une ligne « … et N autres — voir la console ». Coût : 5 lignes. Supprime définitivement le risque de dépassement.
  3. **Découper le canal** — dans `telegram.ts`, chunker `opts.text` à 3 900 caractères sur les sauts de ligne et enchaîner les POST. Bénéficie à **toutes** les catégories de notification, pas seulement aux offres.
- **Effort** : volet 2 = S ; volet 3 = S/M ; volet 1 = M (script + relecture + exécution manuelle en prod par Will).
- **Impact GEO/AEO** : **fort** (volet 1, fraîcheur Google for Jobs sur 53 URLs) / **moyen** (volets 2-3, fiabilité du garde-fou).
- **Risque de régression** : volets 2 et 3 = faible. **Volet 1 = élevé** : toute erreur de sens (dates qui avancent) crée la fausse fraîcheur que la décision 5 interdit → exécution manuelle, dry-run obligatoire, jamais dans une migration Prisma automatique. **Do-not-touch** : `job-posting.ts:75` (règle `publishedAt ?? datePosted` — partagée avec `careers/freshness.ts:23-25` et `admin-job-offers/actions.ts:164` ; la désynchroniser ferait diverger la pastille console et ce que voit Google), `republishJobOfferAction` (`actions.ts:508-555`, correct : geste humain, garde-fous statut/pourvue/expirée, ping IndexNow + Google Indexing).

---

### [P1] Deux JobPosting concurrents pour la même offre commerciale, sur deux URLs

- **Symptôme** : `/fr/devenir-commercial-ia` et `/fr/memo-isere` émettent chacun un JobPosting pour **le même poste** — commercial indépendant / apporteur d'affaires, `employmentType: CONTRACTOR`, 100 % commission, même employeur — avec respectivement 60 et 104 `jobLocation` Places dont **20 villes strictement identiques**. Google traite ces deux URLs comme des annonces dupliquées : au mieux une seule survit (choix arbitraire), au pire les deux sont dépriorisées.
- **Preuve code** : `src/app/[locale]/devenir-commercial-ia/page.tsx:122-165` (JobPosting, `jobLocation: hubPlaces` `:160`) et `src/app/[locale]/memo-isere/page.tsx:350-391` (`jobLocation: MEMO_ZONE_PRINCIPALES.map(...)` `:378-387`). Les deux sont déclarées comme offres statiques distinctes dans `src/content/recrutement/dates.ts:36-48`, et les deux URLs sont poussées dans `src/app/sitemap-recrutement.xml/route.ts:26-32`.
- **Preuve live (2026-08-15 00:23 UTC)** : intersection calculée des `addressLocality` des deux JSON-LD = **20 communes** — Lyon, Villeurbanne, Grenoble, Échirolles, Saint-Martin-d'Hères, Meylan, Voreppe, Voiron, Moirans, Tullins, Vinay, Saint-Marcellin, Romans-sur-Isère, Bourg-de-Péage, Valence, Vienne, Rives, Bourgoin-Jallieu, L'Isle-d'Abeau, Villefontaine. Les deux pages sont `index, follow` avec canonical self.
- **Preuve documentaire (2026-08-15 00:20 UTC)** : Google prescrit **un seul** JobPosting avec un tableau `jobLocation` pour un poste multi-lieux, et la canonicalisation pour les copies d'une même annonce sur plusieurs URLs.
- **Root-cause** : `/memo-isere` est une **landing de campagne presse** (Sud-Grésivaudan, 2026-08-12) construite en dupliquant le bloc JobPosting de la page nationale au lieu de rester une page d'atterrissage éditoriale pointant vers l'annonce canonique.
- **Patch prescrit** : ne conserver qu'**un** JobPosting canonique — celui de `/fr/devenir-commercial-ia`, dont le `jobLocation` couvre déjà la France entière. Sur `/fr/memo-isere`, remplacer le bloc JobPosting par un `WebPage` + `FAQPage` (déjà présents) et un lien fort vers l'annonce nationale. Si la couverture fine du Sud-Grésivaudan doit être conservée pour Google for Jobs, **fusionner** `MEMO_ZONE_PRINCIPALES` dans `hubPlaces` côté page nationale plutôt que de maintenir deux annonces. Retirer alors l'entrée `/fr/memo-isere` de `STATIC_JOB_POSTINGS` (`dates.ts:41-47`) — elle n'aurait plus de JobPosting à surveiller.
- **Effort** : M.
- **Impact GEO/AEO** : **fort** — c'est l'offre qui porte tout le recrutement commercial, et le doublon fragilise les deux URLs à la fois.
- **Risque de régression** : moyen. `/fr/memo-isere` perd son éligibilité Google for Jobs propre (assumé — c'est le but) ; vérifier que le CTA candidature reste intact. **Do-not-touch** : `MEMO_ZONE_CLUSTERS` / `MEMO_ZONE_TOTAL` (`src/content/recrutement/memo-isere-zone.ts`) — servent aussi la prose de la page ; `sitemap-recrutement.xml` doit continuer à lister `/memo-isere` comme page indexable.

---

### [P1] `title` non conforme aux règles Google for Jobs sur ~16 offres

- **Symptôme** : le `title` du JobPosting est repris tel quel de `titleFr`, qui est un **titre de page marketing**, pas un intitulé de poste. Quatre offres contiennent le **nom de l'entreprise** (interdit explicitement), d'autres contiennent le mode de travail, le temps de travail ou `(H/F)`, et plusieurs dépassent 75 caractères de copy publicitaire. Le `title` est la chaîne que Google for Jobs affiche sur la carte **et** celle qu'il matche contre la requête du candidat : « Directeur des opérations (COO) — fais tourner la machine d'une startup tech IA qui livre en prod » ne matche pas « directeur des opérations ».
- **Preuve code** : `src/lib/seo/job-posting.ts:72` — `const title = isFr ? offer.titleFr : offer.titleEn;` (aucune normalisation). Même champ réutilisé en `<h1>` : `src/app/[locale]/carrieres/[slug]/page.tsx:278,391`.
- **Preuve live (2026-08-14 22:44 UTC)**, extraits des 54 `title` :
  | Problème | Exemples relevés |
  |---|---|
  | Nom d'entreprise dans le titre | « Monteur son / Sound designer — Podcast **Axion-IA.com** » · « Monteur vidéo / Motion designer — studio contenu **Axion-IA.com** » · « Office Manager - le pilier du quotidien d'**Axion-IA.com** » · « Producteur / Créateur de podcast — lance le podcast d'**Axion-IA.com** de A à Z » |
  | Mode de travail dans le titre | « Chargé de Recherche & Développement IA **(full remote)** » · « Designer UX/UI — produits web & SaaS IA **(full remote)** » · « Formateur / Intervenant IA en entreprise **(itinérant)** » · « Formateur / Intervenant IA à distance **(visio)** » |
  | Temps de travail / mention légale | « Référent handicap **(temps partiel)** » · « Chargé de dossiers subventions & financements **(H/F)** » · « Chargé de support / Hotline solutions SaaS **(h/f)** » |
  | Copy marketing (> 60 car.) | 96 car. « Directeur des opérations (COO) — fais tourner la machine… » · 88 car. « Assistant·e — accompagnement des entreprises… » · 80 car. « Directeur commercial — structure et accélère… » · 75 car. « Vidéaste / Content Creator — raconte la vie d'une startup tech IA en images » |
- **Preuve documentaire (2026-08-15 00:20 UTC)** : « **Don't** include job codes, addresses, dates, salaries, **company names** » ; « the title of the job (not the title of the posting) » ; l'abus de ponctuation décorative expose à une classification spam.
- **Root-cause** : un seul champ `titleFr` sert trois usages aux contraintes contradictoires — `<h1>` éditorial (accroche), `metaTitle` (SEO) et `JobPosting.title` (intitulé normalisé). Le contrôle de saisie (`src/features/admin-job-offers/actions.ts:209`) ne valide que la longueur ≤ 160.
- **Patch prescrit** : **ne pas toucher au contenu DB ni au `<h1>`**. Ajouter dans `job-posting.ts` un normaliseur `jobPostingTitle(raw)` appliqué en `:72` : couper au premier séparateur d'accroche (` — `, ` - `, ` · `), retirer les suffixes parenthésés `(h/f)`, `(H/F)`, `(full remote)`, `(visio)`, `(itinérant)`, `(temps partiel)`, retirer toute occurrence de `Axion-IA` / `Axion-IA.com`, puis `trim`. Conserver `/` et `&` (Google les accepte). Verrouiller par une spec dédiée (les 16 cas ci-dessus en table). Option plus propre à moyen terme : colonne `jobTitleClean` optionnelle en console, avec le normaliseur en repli.
- **Effort** : S (≈ 1 h avec la spec).
- **Impact GEO/AEO** : **fort** — le titre est le principal signal de matching de Google for Jobs, et il est aussi ce que citent les moteurs de réponse.
- **Risque de régression** : faible/moyen. Le normaliseur peut sur-couper un titre où le tiret est structurant (ex. « Chargé de communication & réseaux sociaux » est sain, mais « Consultant / Ingénieur IA — implémentation & développement » perdrait la 2ᵉ moitié : acceptable pour Google, à vérifier au cas par cas sur les 54). **Do-not-touch** : `offer.titleFr` en base et son usage `<h1>` / `metaTitle` / breadcrumb / ItemList du hub ; ne PAS réintroduire de lieu dans le titre (décision actée 5).

---

### [P1] `hiringOrganization` auto-référencé et hors graphe sur `/devenir-commercial-ia`

- **Symptôme** : le JobPosting de l'offre commerciale nationale déclare un employeur qui n'est **pas** relié au nœud `Organization` canonique du site : pas de `@id`, `name` = « Axion-IA (axion-ia.com) » (≠ le `name` canonique « Axion-IA »), `sameAs` = l'URL du site lui-même, pas de `logo`. Une auto-référence en `sameAs` n'apporte **aucune** désambiguïsation d'entité : Google et les LLM ne peuvent pas rattacher cette annonce à l'entité Axion-IA établie ailleurs.
- **Preuve code** : `src/app/[locale]/devenir-commercial-ia/page.tsx:154-159` —
  ```ts
  hiringOrganization: {
    "@type": "Organization",
    name: "Axion-IA (axion-ia.com)",
    url: SITE_URL,
    sameAs: SITE_URL,
  },
  ```
  À comparer avec les deux implémentations correctes : `src/lib/seo/job-posting.ts:15-22` et `src/app/[locale]/memo-isere/page.tsx:371-377` (toutes deux `@id: ${SITE_URL}/#organization` + `sameAs` LinkedIn).
- **Preuve live (2026-08-15 00:23 UTC)** : `/fr/devenir-commercial-ia` → `{"@type":"Organization","name":"Axion-IA (axion-ia.com)","url":"https://axion-ia.com","sameAs":"https://axion-ia.com"}`. `/fr/memo-isere` → `{"@type":"Organization","@id":"https://axion-ia.com/#organization","name":"Axion-IA",…,"sameAs":["https://www.linkedin.com/company/axion-ia-france"]}`. Les 54 offres DB → identique à memo-isere, **plus** `logo`.
- **Root-cause** : la page nationale est antérieure au builder mutualisé `job-posting.ts` (créé pour les offres DB) et n'a jamais été réalignée ; `sameAs: SITE_URL` est l'une des trois occurrences fautives déjà repérées transversalement par **F6**.
- **Patch prescrit** : remplacer le littéral par le même objet que `job-posting.ts:15-22` — idéalement en **exportant** `HIRING_ORG` depuis `src/lib/seo/job-posting.ts` et en l'important dans les deux pages statiques (SSOT unique, plus de dérive possible).
- **Effort** : S (≈ 15 min).
- **Impact GEO/AEO** : **moyen-fort** — résolution d'entité de l'annonce la plus stratégique du recrutement.
- **Risque de régression** : très faible. **Do-not-touch** : le `sameAs` LinkedIn `company/axion-ia-france` est **vérifié correct** (cf. F6) — ne pas le « corriger » ; ne pas modifier le `@id` `#organization` défini dans `src/lib/seo.ts`.

---

### [P2] `identifier` et `logo` absents des deux JobPosting statiques

- **Symptôme** : `identifier` est une propriété **recommandée** par Google (déduplication de l'annonce entre agrégateurs). Les 54 offres DB l'émettent (`PropertyValue` / slug) ; les 2 statiques non. Idem `hiringOrganization.logo`.
- **Preuve code** : `src/lib/seo/job-posting.ts:82-86` (présent) vs `devenir-commercial-ia/page.tsx:122-165` et `memo-isere/page.tsx:350-391` (absent dans les deux).
- **Preuve live (2026-08-15 00:23 UTC)** : clés du JSON-LD des 2 pages statiques — `identifier` absent, `image` absent, `logo` absent.
- **Patch** : ajouter `identifier: { "@type": "PropertyValue", name: "Axion-IA", value: "commercial-independant-ia" }` (et `memo-isere` si la page conserve un JobPosting après le P1). `logo` vient gratuitement avec le `HIRING_ORG` mutualisé du P1.
- **Effort** : S. **Impact** : faible-moyen. **Risque** : nul.

### [P2] `hiringOrganization.logo` pointe sur la bannière OG, pas sur le logo du graphe

- **Symptôme** : les 54 offres DB déclarent `logo: ${SITE_URL}/opengraph-image` — une bannière sociale 1200×630 générée dynamiquement, alors que le site dispose d'un vrai logo dédié `#logo` / `/logo-axion-ia.png` introduit précisément pour ce besoin.
- **Preuve code** : `src/lib/seo/job-posting.ts:20` vs `src/lib/seo.ts:24-44,889-891` (commentaire explicite : « conforme aux guidelines Google *logo* (attend une image carrée-ish, ratio ~1:1) … Désormais un vrai logo dédié »).
- **Preuve live (2026-08-14 22:44 UTC)** : `GET /opengraph-image` → 200, `image/png`, 126 873 octets. Ratio 1200/630 = **1,90** → **dans** la fourchette Google 0,75–2,5 : ce n'est donc **pas** une violation, mais un rendu dégradé (bannière textuelle recadrée en vignette d'employeur) et une incohérence avec le graphe d'identité.
- **Patch** : `logo: buildBrandLogoImageObject().url` (ou la constante `/logo-axion-ia.png` de `seo.ts:32-33`).
- **Effort** : S. **Impact** : faible. **Risque** : nul. **Do-not-touch** : la route `src/app/opengraph-image.tsx` (og:image de tout le site en dépend, cf. décision 2 `Allow: /api/og`).

### [P2] `jobBenefits` jamais émis sur les 54 offres DB (`perks` vide en base)

- **Symptôme** : le builder sait produire `jobBenefits` depuis `offer.perks`, mais **0/54** offres l'émettent — le champ « Avantages » de la console n'a jamais été renseigné. Les 2 offres statiques, elles, l'ont (en dur).
- **Preuve code** : `src/lib/seo/job-posting.ts:107-113` ; champ de saisie `src/features/admin-job-offers/actions.ts:244`.
- **Preuve live (2026-08-14 22:42 UTC)** : `jobBenefits` présent sur 0/54 offres ; l'encart « Ce qu'on offre » (`carrieres/[slug]/page.tsx:478-492`) est donc masqué partout.
- **Nuance importante** : `jobBenefits` **ne figure pas** dans la liste des propriétés exploitées par Google (vérifié 2026-08-15 00:20 UTC). L'intérêt est donc **AEO/LLM** (matière citable) et **UX** (encart de page), pas Google for Jobs.
- **Patch** : reste Will (saisie de contenu), pas de code. Éventuellement un défaut par catégorie dans `src/content/careers/employer-brand.ts`.
- **Effort** : M (contenu). **Impact** : faible. **Risque** : nul.

### [P2] Champs de la console jamais lus — dont `applicationDeadline`, qui double `validThrough`

- **Symptôme** : plusieurs champs saisissables en console ne sont exploités ni par le JSON-LD ni par la page publique : `applicationDeadline`, `requiresDriverLicense`, `requiresVehicle`, `remoteDaysPerWeek`, `teamName`, `managerName`. Le plus dangereux est `applicationDeadline` : un admin qui le renseigne croit **clore** l'annonce, alors que seul `validThrough` a cet effet (`job-posting.ts:68-69`, `job-offers.ts:31`). L'annonce reste indexée et candidatable.
- **Preuve code** : champs déclarés `src/features/admin-job-offers/actions.ts:237,241-243,246-247,366-367` ; aucune lecture — `grep` sur `applicationDeadline` / `requiresVehicle` / `remoteDaysPerWeek` hors du schéma d'upsert = 0 occurrence dans `job-posting.ts` et `carrieres/[slug]/page.tsx`. `startDate` est le seul à être affiché (`page.tsx:315-320`) mais n'est pas mappé en JSON-LD.
- **Preuve live** : n/a (surface console, non publique).
- **Patch** : soit retirer `applicationDeadline` du formulaire, soit l'aligner sur `validThrough` (un seul champ, un seul effet). Exposer `remoteDaysPerWeek` dans la description devient utile si le P0-1 est appliqué. ⚠️ Ne PAS ajouter de `validThrough` par défaut : décision actée 5.
- **Effort** : S. **Impact** : faible en GEO, **moyen en risque opérationnel** (offre fantôme). **Risque** : faible.

### [P2] `lastmod` de `/fr/memo-isere` désaligné dans `sitemap-recrutement.xml`

- **Symptôme** : les 3 URLs du sitemap recrutement partagent `COMMERCIAL_OFFER_DATE_POSTED` = `2026-08-12`, alors que `/fr/memo-isere` déclare `datePosted: "2026-08-13"` dans son JobPosting et dans `STATIC_JOB_POSTINGS`.
- **Preuve code** : `src/app/sitemap-recrutement.xml/route.ts:22,30-31` vs `src/app/[locale]/memo-isere/page.tsx:359` et `src/content/recrutement/dates.ts:46`.
- **Preuve live (2026-08-14 22:39 UTC)** : `GET /sitemap-recrutement.xml` → 200, 684 octets, 3 `<loc>`, `lastmod` identique sur les trois = `2026-08-12T00:00:00.000Z`.
- **Patch** : `lastmod` par entrée, en réutilisant `STATIC_JOB_POSTINGS` comme source unique.
- **Effort** : S. **Impact** : faible. **Risque** : nul.

### [P2] `ItemList` du hub carrières : `ListItem` sans `item` typé

- **Symptôme** : `/fr/carrieres` émet un `ItemList` de 54 `ListItem` plats (`name`/`url`/`description`) sans nœud `item` typé. Les moteurs de réponse n'y voient pas 54 `JobPosting` mais 54 liens anonymes.
- **Preuve live (2026-08-15 00:37 UTC)** : `numberOfItems: 54`, `itemListElement.length: 54`, ensemble des `item['@type']` = `[undefined]`.
- **Patch** : `item: { "@type": "JobPosting", "@id": <url>#jobposting", name, url }` (référence légère vers le JobPosting complet de la page fille — ne PAS dupliquer l'annonce entière, ce serait recréer le doublon du P1).
- **Effort** : S. **Impact** : faible. **Risque** : faible.

### [P2] [À CONFIRMER] Deux offres quasi-jumelles → risque de doublon Google for Jobs

- **Symptôme** : `assistant-dossiers-financement-clients` (« Assistant·e — accompagnement des entreprises sur leurs dossiers (financement & Qualiopi) ») et `assistant-financements-qualiopi` (« Assistant administratif — financements & Qualiopi ») décrivent apparemment le même poste, et sont les **seules** deux offres du parc à partager exactement la même photo.
- **Preuve live (2026-08-14 22:44 UTC / 00:36 UTC)** : images uniques = 53 sur 54 ; la collision porte sur ces deux slugs (`photo-1764025851210-9ad5ed83e01f`).
- **Preuve code** : `src/content/careers/careers-images.ts` (mapping slug → photo).
- **Pourquoi [À CONFIRMER]** : décision éditoriale (deux postes réellement distincts ?) — je n'ai pas accès à la DB pour comparer les corps d'annonce, et le contenu public ne tranche pas.
- **Patch** : si doublon → archiver l'une des deux ; sinon différencier titre + photo.
- **Effort** : S. **Impact** : faible. **Risque** : nul (action console).

### [P2] Tri du hub et des offres suggérées sur `datePosted` au lieu de la date effective

- **Symptôme** : `listPublishedJobOffers` et `listSuggestedOffers` trient sur `datePosted`, alors que la date que voient Google et la pastille de fraîcheur est `publishedAt ?? datePosted`. Avec 53 `publishedAt` identiques (P0-2), l'ordre affiché ne reflète plus aucune fraîcheur réelle.
- **Preuve code** : `src/lib/careers/job-offers.ts:11` et `:64`.
- **Patch** : `orderBy: [{ displayOrder: "asc" }, { publishedAt: "desc" }, { datePosted: "desc" }]`.
- **Effort** : S. **Impact** : faible. **Risque** : faible. **Do-not-touch** : `displayOrder` reste prioritaire (ordre manuel voulu).

---

## Ce qui est CORRECT — ne pas re-signaler

Vérifié cette nuit, à ne pas re-remonter en squad H :

1. **JSON-LD inline dans le HTML brut** sur 54/54 pages d'offres — `JsonLd` est appelé sans `strategy` (`carrieres/[slug]/page.tsx:346-347`), donc `strategy="inline"` par défaut (`src/components/marketing/JsonLd.tsx:36,50-57`). **Le défaut transverse (b) `afterInteractive` ne touche pas cette surface.**
2. **Garde-fous d'indexabilité cohérents sur 4 surfaces** : `buildJobPostingJsonLd` (`job-posting.ts:62-69`), `isJobOfferIndexable` (`job-offers.ts:24-33`), `generateMetadata` (`page.tsx:258-260`) et le sitemap (`sitemap-carrieres.xml/route.ts:33,43`) appliquent le même quadruplet `published / !filled / tier_1 / !expiré`. Aucune divergence trouvée.
3. **Aucun bump automatique de date nulle part** — décision 5 respectée : cron en lecture seule (`worker:1148-1168`), republication = clic humain avec confirmation explicite (`OfferLifecycleActions.tsx:60-63`), garde-fous statut/pourvue/expirée (`actions.ts:523-531`).
4. **`sitemap-carrieres.xml` en `force-dynamic`** (`route.ts:17`) : immunisé au stub `stub.invalid` du build GH Actions, avec `console.error` observable en cas d'échec DB (`:36-40`). 55 `<loc>` + 54 `<image:image>` mesurés à 22:39 UTC — cohérent avec les 54 pages servies en 200.
5. **`/carrieres/[slug]/postuler` en `noindex, follow`** avec canonical propre (mesuré 22:43 UTC) — pas de fuite de formulaire dans l'index.
6. **`applicantLocationRequirements` francophonie** : `monteur-video-freelance-distance` déclare 22 pays avec `identifier` ISO 3166-1 — implémentation exemplaire (`job-posting.ts:34-48`).
7. **`employmentType` multiple** correctement émis en tableau sur 8 offres (« CONTRACTOR + FULL_TIME ») — `job-posting.ts:92-94`.
8. **`validThrough` et `baseSalary` absents** = décisions actées 5, non re-signalés (0/54 `validThrough`, 3/54 sans rémunération publique).
9. **Aucune offre orpheline de lieu** : les 54 JSON-LD ont toutes soit `jobLocation`, soit `jobLocationType` — la branche `else` de `job-posting.ts:151-153` (qui produirait un JobPosting sans lieu) n'est atteinte par aucune offre en production.
10. **Ping d'indexation branché** sur publish / archive / filled / republish / delete, avec garde anti-noindex sur le canal Google (`actions.ts:41-56`). L'activation réelle de la Google Indexing API relève de **A6**.

---

## Mesures brutes

### Sitemaps carrières (2026-08-14 22:39 UTC)

| URL | Statut | Temps | Octets | `<loc>` | `<image:loc>` |
|---|---|---|---|---|---|
| `/sitemap-carrieres.xml` | 200 | 0,276 s | 29 564 | 55 (1 hub + 54 offres) | 54 |
| `/sitemap-recrutement.xml` | 200 | — | 684 | 3 | 0 |
| `/sitemap-index.xml` (entrées carrières) | 200 | — | — | `sitemap-carrieres.xml` + `sitemap-recrutement.xml` présents | `lastmod` = `2026-08-14T18:54:41.000Z` (famille `pages` — cf. A2) |

### Pages d'offres — 54/54 téléchargées (2026-08-14 22:41-22:42 UTC)

| Contrôle | Résultat |
|---|---|
| JobPosting présent | **54 / 54** |
| Blocs JSON-LD par page | 5, identiques partout : `JobPosting` \| `WebPage` \| `BreadcrumbList` \| `FAQPage` \| `Organization+WebSite+SiteNavigationElement` |
| Erreurs de parsing JSON | 0 |
| `robots` | `index, follow` sur 54/54 |
| Ni `jobLocation` ni `jobLocationType` | 0 |
| `applicantLocationRequirements` sans `TELECOMMUTE` | 0 |
| **`jobLocation` + `TELECOMMUTE` (hybride)** | **10** → P0-1 |
| **`datePosted` distincts** | **2** (53 × `2026-08-13T05:49:03.239Z`, 1 × `2026-08-11T03:23:32.083Z`) → P0-2 |
| `validThrough` | 0 (décision actée) |
| `baseSalary` / `incentiveCompensation` / ni l'un ni l'autre | 51 / 0 / 3 |
| `jobBenefits` | 0 |
| Images distinctes | 53 / 54 |
| Longueur `description` (HTML) | 1 625 → 4 499 caractères |
| Poids HTML brut moyen | **1 189 Ko** (94 Ko gzip mesuré sur `developpeur-web`) — dont 874 Ko de `<script>` (flight RSC) et 234 Ko de `<style>` inline ; **hors périmètre B5**, signalé pour la squad G |

### Pages statiques et hub (2026-08-15 00:23-00:37 UTC)

| URL | Statut | Blocs JSON-LD | JobPosting |
|---|---|---|---|
| `/fr/devenir-commercial-ia` | 200 | `BreadcrumbList`, `JobPosting`, `Organization+WebSite+SiteNavigationElement` | `datePosted` 2026-08-12 · CONTRACTOR · **60 Places** · `incentiveCompensation` · pas de `identifier` / `image` / `logo` · `sameAs` auto-référencé |
| `/fr/memo-isere` | 200 | `JobPosting`, `WebPage`, `BreadcrumbList`, `FAQPage`, `Organization+…` | `datePosted` 2026-08-13 · CONTRACTOR · **104 Places** · `incentiveCompensation` · pas de `identifier` / `image` |
| `/fr/carrieres` | 200 | `ItemList` (54), `CollectionPage`, `BreadcrumbList`, `FAQPage`, `Organization+…` | — |
| `/fr/carrieres/data-engineer/postuler` | 200 | `BreadcrumbList`, `Organization+…` | — · `robots: noindex, follow` ✅ |
| Intersection des villes DCI ∩ memo-isere | — | — | **20 communes** |

### Chaîne de fraîcheur (analyse statique + simulation, 2026-08-15 00:31 UTC)

| Élément | Valeur |
|---|---|
| Seuil de republication | 45 j (`dates.ts:19`) |
| Cadence du cron | hebdo, lundi 08:15 UTC (`queues.ts:1511-1513`) |
| Offres surveillées | 54 DB + 2 statiques |
| Date de péremption simultanée projetée | ≈ **2026-09-27** (53 offres d'un coup) |
| Longueur simulée du message Telegram (56 lignes, MarkdownV2 échappé) | **4 017 car.** |
| Limite Telegram `sendMessage` | 4 096 car. |
| Marge | **79 car. (2 %)** — rupture dès la 55ᵉ ligne listée |
| Découpage / troncature dans le code | **aucun** (`telegram.ts:47-69`, `format.ts:254-269`, `worker:1155-1166`) |
| Comportement en cas de dépassement | 400 Telegram → `res.ok=false` → `console.warn` seul → **échec silencieux** |

### Cache / livraison (2026-08-14 22:41 UTC)

`/fr/carrieres/developpeur-web` : `x-nextjs-cache: HIT`, `x-nextjs-prerender: 1`, `cf-cache-status: HIT`, `Age: 116`, `Cache-Control: s-maxage=3600, stale-while-revalidate=31532400`. Pas d'effet stub/ISR observable sur cette surface — mesures prises ≥ 2 h 40 après le dernier atterrissage (~19:50 UTC), donc **hors fenêtre post-deploy**.

---

## Limites

1. **Aucun accès DB.** B5 ne figure pas dans la liste des agents autorisés à interroger Postgres prod. Je n'ai donc pas pu : (a) confirmer l'**origine** de l'écriture en masse de `published_at` (hypothèse `UPDATE … SET published_at = now()` manuel, étayée par l'impossibilité pour les seeds du dépôt de produire une milliseconde identique — `seed-careers-offers.ts:113` évalue `new Date()` par enregistrement) ; (b) lire `created_at` / `activity_log` pour proposer des dates de remplacement chiffrées ; (c) trancher si `assistant-dossiers-financement-clients` et `assistant-financements-qualiopi` sont réellement le même poste. Les **symptômes** sont tous prouvés en live sur le HTML servi.
2. **Présence effective dans Google for Jobs non vérifiable.** Le widget Google for Jobs n'est pas exposé par l'outil `WebSearch` (résultats web classiques seulement) et le Rich Results Test n'est pas accessible en GET. La recherche `site:axion-ia.com carrieres` (2026-08-15 00:38 UTC) ne remonte que le hub `/fr/carrieres` ; **F2** rapporte 2 clics GSC sur `/fr/carrieres/data-engineer` en W33, ce qui prouve au moins une indexation en recherche classique. **Ce que je n'ai pas pu établir : si les 54 offres sont réellement servies dans le carrousel Google for Jobs, et si les 10 offres hybrides y ont déjà été retirées ou dépriorisées.** À contrôler manuellement dans GSC → « Offres d'emploi » (rapport d'améliorations) et via le Rich Results Test sur 3 URLs.
3. **Validation schema.org non exécutée en lab.** Contrainte machine (nuit) : aucun validateur local, aucun Lighthouse, aucune suite de tests lancée. La conformité a été établie par lecture du code, parsing intégral des 54 JSON-LD servis, et confrontation à la documentation Google officielle récupérée en direct (2026-08-15 00:20 UTC).
4. **Longueur du message Telegram = simulation, pas capture réelle.** Reproduite fidèlement à partir des 54 titres réels et des fonctions exactes du dépôt (`escapeMarkdownV2` `format.ts:95-97`, `formatKV` `:145-148`), mais avec une hypothèse de 8 caractères pour `ADMIN_URL_PREFIX` (secret, non lisible) et `daysOld = 45`. Un préfixe plus long ou un `daysOld` à 3 chiffres **réduisent** la marge de 79 caractères. Le seuil de rupture réel ne sera observable qu'au premier lundi où le parc est périmé.
5. **`prisma/schema.prisma` non relu ligne à ligne** : la nullabilité de `datePosted` / `publishedAt` a été déduite des usages (`publishedAt: Date | null`, `datePosted: Date` dans `careers/freshness.ts:23`) et des `select` Prisma, pas du schéma.
6. **Poids de page (1,19 Mo de HTML brut par offre)** relevé mais non instruit : c'est la surface de la squad G / des budgets Web Vitals, pas la mienne. Aucune mesure de terrain (INP/LCP) n'a été prise.
