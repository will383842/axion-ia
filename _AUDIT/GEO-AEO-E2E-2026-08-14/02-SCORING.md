# 02 — SCORING : grille de notation GEO/AEO sur 2 500 points

**Agent S1 (squad S, Phase 3) — 2026-08-15**

- **Source de vérité** : `H6-coherence-inter-rapports.md`, liste canonique dédupliquée
  **GEO-001 → GEO-155** (28 P0, 98 P1, 21 P2, 8 INCERTAINS), après arbitrage des
  21 contradictions, fusion des 25 doublons et élimination des 8 findings réfutés.
- **Règle de notation absolue** : **aucun finding réfuté n'entre dans une pénalité.**
  Les 8 éliminés de H6 (dont « `trackUsage` pollue le `lastmod` », « 3 hubs catégorie
  à 0 article », « creds GSC absents du worker », « les guides sont hors sitemap »)
  n'ont retiré **aucun point**. De même, les volumes corrigés par H6 sont les seuls
  utilisés : **289** pages galerie (pas 870), **126** articles de blog (pas 134 ni 61),
  **480** pages villes déclarées (pas ~2 150), **~10 785** URLs `par-ville`
  (pas ~4 300), **59** héros villes (pas 58), **3** guides dans `sitemap-blog`.
- **Règle de symétrie** : un domaine sain obtient une note haute. Quatre sous-critères
  de cette grille sont notés **au-dessus de 90 %** (doctrine robots, rendu serveur sans
  JS, architecture du sitemap-index, crawlabilité des images) parce que l'audit a
  mesuré qu'ils fonctionnent, pas parce qu'on n'a rien trouvé.
- **Fait établi hors audit, intégré sans être re-prescrit** : l'audit blanc Qualiopi
  du 2026-08-15 (30 agents) a conclu que la plateforme est **non certifiable en l'état**
  et que le site de production affirme partout une certification **jamais délivrée**
  (le drapeau `QUALIOPI_CERTIFICATION_OBTENUE=true` neutralise une garde que le code
  avait pourtant posée). Will a **déjà acté** l'action corrective. Conséquence ici, et
  seulement ici : la revendication Qualiopi cesse d'être une hypothèse de F5 pour
  devenir un **fait**, ce qui rend la note du sous-critère 9-d structurellement basse.
  **Aucune action Qualiopi n'est prescrite dans cette grille** — voir l'audit dédié.

---

## Comment lire cette grille

Chaque domaine vaut **250 points**, répartis en 5 à 7 sous-critères pondérés. La
pondération n'est pas arbitraire : elle suit **ce qu'un moteur — classique ou
génératif — consomme réellement en 2026**. C'est pourquoi, par exemple, « présence du
JSON-LD dans le HTML servi » pèse autant que « richesse des types » : un `FAQPage`
parfait qu'aucun crawler non-JS ne voit vaut, pour l'AEO, exactement zéro.

Trois colonnes accompagnent chaque domaine :

- **Score** : la note attribuée, justifiée finding par finding.
- **Récupérable P0** : les points que rendent **les seuls patches P0** de ce domaine.
  C'est la mesure du retour sur effort immédiat.
- **Plafond P0+P1** : l'estimation de ce que rend l'exécution **complète** du plan de
  patches. Elle est délibérément plus basse que la note maximale : deux domaines
  (moteurs classiques, moteurs IA) sont des **indicateurs retardés** qu'aucun commit
  n'achète — ils se gagnent en semaines de crawl et en preuves hors site.

---

# Domaine 1 — Crawl & découverte — **114 / 250**

### Barème

| Sous-critère | Pts | Pourquoi ce poids |
|---|---:|---|
| **1-a** Doctrine robots.txt et invariants d'accès | 60 | C'est la porte d'entrée. Une erreur ici (bloquer `/api/og`, ouvrir le training) coûte plus cher que tout le reste du domaine réuni. |
| **1-b** Canaux de notification aux moteurs | 50 | Sur un site à 17 629 routes SSG, la découverte passive ne suffit pas : IndexNow, soumission GSC et Bing sont le seul levier actif. |
| **1-c** Absence de pièges à crawl / économie du budget | 50 | Chaque hit gaspillé sur une facette infinie ou une URL noindex est un hit qui n'atteint pas une page commerciale. |
| **1-d** Observabilité du crawl réel | 40 | On ne pilote pas ce qu'on ne mesure pas. Sans log, tout diagnostic de crawl est une conjecture. |
| **1-e** Résilience de la découverte aux événements d'exploitation | 50 | Un site dont l'exploitation peut, seule, servir des hubs vides aux crawlers a un défaut de découverte, pas un défaut d'ops. |

### Score et justification

**1-a — 56/60.** Le meilleur sous-critère de tout l'audit avec 10-a. A1 a mesuré les
4 fichiers de politique **byte-identiques au code** (diff = 0), la doctrine « bloquer
training / garder citation » correctement implémentée et **verrouillée par 8 tests**
(`robots.spec.ts`), les invariants `Allow: /api/og`, `Allow: /api/markdown/` intacts
en code **et** en prod, et le middleware qui exclut proprement `.txt` et
`.well-known/`. E4 a confirmé de l'extérieur que `Disallow: /logos/clients/` est
**hermétique** (l'optimiseur refuse le SVG en 400) : zéro logo client dans l'index
images échantillonné. −4 pour les deux incohérences déclaratives P2 : `ai.txt` porte
`Allow: /` qui vaut **opt-IN au training** au sens du standard Spawning que le fichier
cite lui-même (**GEO-128**, A1), et `ai-policy.json` déclare `license: CC-BY-4.0` à la
racine en contradiction avec `training.allowed: false` (**GEO-129**, A1). Aucun bot de
citation ne lisant `ai.txt`, la pénalité reste symbolique.

**1-b — 14/50.** Trois canaux sur trois sont morts ou aveugles. La chaîne de
soumission GSC échoue en silence depuis au moins le 22/06 : **0 succès sur 40 runs**,
token OAuth au scope `readonly` (**GEO-104**, F2) — et les 4 sitemaps images n'ont
**jamais** été soumis. IndexNow n'atteint que Yandex : le client Bing WMT existe mais
n'a **aucun appelant**, et sa fonction de soumission n'est même pas écrite
(**GEO-105**, A6+F2). Bing est un angle mort total, les 3 fonctions du client n'ayant
aucun consommateur (**GEO-106**, F2). S'y ajoutent le bouton admin « Ping IndexNow »
structurellement mort (**GEO-133**) et l'absence de notification à la publication d'un
communiqué (**GEO-134**). Les 14 points restants récompensent le seul canal qui vit :
le cron IndexNow → Yandex, et la clé, irréprochable depuis l'audit du 2026-08-11.

**1-c — 20/50.** Quatre pièges cumulés. `/galerie` sert une canonical auto-référente
sur **n'importe quel paramètre inventé** et des variantes 0-résultat indexables
(**GEO-033**, C5). Le hub `/fr/implantations` pèse **8 792 194 octets** — reproduits à
l'octet par H2 — et émet 2 157 liens dont **~1 677 (78 %) vers des pages noindex**
(**GEO-034**, C4). Les 288 pages galerie exposent **576 liens `/telecharger`
crawlables**, sans `rel="nofollow"` et sans `Disallow`, qui déclenchent chacun une
transformation Sharp et 2 écritures DB (**GEO-035**, découverte H6). Enfin les deux
exports Observatoire, annoncés « données ouvertes » dans `llms.txt` et déclarés en
`DataDownload`, sont bloqués par `robots.txt` (**GEO-031**, A1+B4).

**1-d — 6/40.** Il n'existe **aucun access log HTTP nulle part** (**GEO-154**, F7,
statut INCERTAIN mais fortement corroboré côté code) ; le monitoring d'indexation est
un stub et `gscInspectUrl` n'a aucun appelant (**GEO-030**, F2+F7) ; et les CSV
hebdomadaires nommés « crawl-stats » **ne contiennent pas de crawl stats** — ce sont
des données Search Analytics, si bien que le gate « crawl budget < 30 % » n'a jamais
été mesuré une seule fois (**GEO-032**, F7). Les 6 points reconnaissent l'export
hebdomadaire GSC, qui tourne fidèlement depuis juin et a rendu possible tout le
chiffrage de F2.

**1-e — 18/50.** Un redémarrage de conteneur **hors pipeline** ne déclenche ni purge,
ni revalidate, ni chauffe : la prod sert alors des hubs vides aux crawlers sans
qu'aucune remédiation ne se produise (**GEO-001**, F7 — mécanisme confirmé,
l'événement du 18:49:06 restant `[À CONFIRMER]`). S'y ajoute `/qr/podcast` qui répond
**404 en production** alors que deux fichiers du code le documentent comme cible du
flyer papier et du QR dynamique (**GEO-144**, H5).

**Récupérable P0 seuls : +25** — GEO-001 est le seul P0 du domaine ; son patch ramène
1-e de 18 à ~43. Les 90 autres points du domaine sont dans les 7 P1 et 5 P2.

**Plafond P0+P1 estimé : ~204/250.**

---

# Domaine 2 — Sitemaps & feeds — **140 / 250**

### Barème

| Sous-critère | Pts | Pourquoi ce poids |
|---|---:|---|
| **2-a** Architecture du sitemap-index et gating anti-vide | 60 | Un index qui déclare un sub-sitemap vide dégrade la confiance dans **tout** l'index. C'est le socle. |
| **2-b** Exhaustivité de la déclaration | 60 | Une page indexable non déclarée est une page qui n'existe pas pour un crawler qui ne la trouve pas autrement. |
| **2-c** Fiabilité des `lastmod` | 40 | Le `lastmod` est le seul signal de priorité de recrawl que le protocole offre. Faux, il est pire qu'absent. |
| **2-d** Canal `llms.txt` / markdown / feeds pour moteurs IA | 60 | C'est le canal AEO natif : ce que les moteurs génératifs ingèrent **directement**, sans passer par le rendu. |
| **2-e** Exactitude déclarative et juridique des sitemaps images | 30 | Une licence fausse dans un sitemap engage juridiquement et pollue l'index images. |

### Score et justification

**2-a — 54/60.** A2 qualifie la surface de « saine et très au-dessus de la moyenne »,
et l'a prouvé : index 200 en 0,36 s, **38 sub-sitemaps** (4 mesures concordantes :
A2 17:48, F1 18:57, H2 et D4 02:56), **2 603 URLs** au total, gating anti-vide opérant
(`news` vide correctement retiré, `presse` gaté entrant avec 1 URL, `images-en` absent
comme prévu par le flag EN), **zéro URL `/en/` fuitée**, zéro trailing slash, IDs non
déclarés en 404 propre, `lastmod` différenciés par famille via fraîcheur git réelle.
−6 pour `guides.xml`, sub-sitemap redondant à 1 URL dont le `lastmod` est figé au
2026-06-08 pour toujours (**GEO-147**, A2) et pour `/fr/demande-devis/confirmation`,
`noindex` **et** déclarée dans `pages.xml` — 1 URL sur 86 (**GEO-130**, A2).

**2-b — 34/60.** Quatre surfaces indexables sont hors déclaration : `/fr/ressources`
(**GEO-131**, A3), `/fr/equipe/manon` — la page cible du `@id` `Person` de **tout** le
JSON-LD éditorial, alors que `/fr/equipe/williams` y est (**GEO-145**, H5),
`/fr/memo-isere` (**GEO-146**, A3+H5), et les 60 termes du glossaire, `noindex` faute
de substance, `glossaire.xml` n'émettant que le hub (**GEO-127**, A2+F1). S'y ajoute
un risque latent : `faq.xml` reste sur la convention metadata bakée sous stub, donc
les Q/R DB-only peuvent disparaître à chaque deploy — perte actuelle = 0 URL
(**GEO-148**, A2, INCERTAIN). Note importante : la plus grosse perte d'exhaustivité du
site, les **455 pages `/sites-web-augmentes/par-ville/*`** indexables et déclarées
nulle part, est comptée en domaine 6 pour ne pas être pénalisée deux fois.

**2-c — 16/40.** Le `lastmod` d'`images-fr.xml` est détruit sur **288 URLs** par des
écritures DB déclenchées par le crawl : H6 a mesuré **7 lignes bumpées en 8 h 20 de
nuit**, sans production de contenu ni activité humaine (**GEO-036**, A4 arbitré par
H1 puis H6). Le `lastmod` de `guides.xml` est figé (**GEO-147**). Le patch d'origine
d'A4 — basculer sur `publishedAt ?? createdAt` — est **éliminé seul** : il masquerait
la cause au lieu de la traiter.

**2-d — 20/60.** Le canal existe, il est complet et servi en 200 — et il est pollué.
`llms-full.txt` sert **26 tokens `{{price:…}}` bruts** aux moteurs IA, défaut stable
mesuré sur deux builds différents (**GEO-002**, A5, P0). Les types `glossaire` et
`centre-aide` sont annoncés en `<link rel="alternate">` et répondent **404**
(**GEO-038**, A5+F1) ; `/api/markdown/cas-concrets/*` répond **200 avec un corps vide**
— pire qu'un 404 (**GEO-039**, F1). Le feed FAQ sert 70 tokens de prix bruts,
1 550 items et 1,1 Mo **sans aucun `pubDate`** (**GEO-040**, A5). La base de
connaissances — **507 fiches citables** — est totalement absente de `llms.txt`
(**GEO-041**, D5) ; c'est le meilleur rapport effort/impact de la squad D : une ligne
statique. Enfin les deux fichiers annoncent une publication « hebdomadaire » devenue
fausse depuis le 2026-07-20 (**GEO-132**).

**2-e — 16/30.** `<image:license>` CC BY 4.0 est déclarée **inconditionnellement** sur
des photos Unsplash dans `sitemap-images-services.xml` (**GEO-037**, A4) — P1
juridique, P2 GEO.

**Récupérable P0 seuls : +16** — GEO-002 uniquement, effort S, qui rend 2-d de 20 à
~36. C'est le meilleur ratio points/effort de la grille entière.

**Plafond P0+P1 estimé : ~215/250.**

---

# Domaine 3 — JSON-LD & entité — **118 / 250**

### Barème

| Sous-critère | Pts | Pourquoi ce poids |
|---|---:|---|
| **3-a** Couverture et richesse des types | 60 | Le socle : sans les bons types, aucun enrichissement n'est possible. |
| **3-b** Présence effective dans le HTML servi | 50 | Un schéma qu'un crawler non-JS ne voit pas ne compte pas. Poids délibérément lourd. |
| **3-c** Exactitude factuelle du nœud entité | 50 | C'est le nœud que les moteurs génératifs recoupent avec les registres. Une contradiction interne le disqualifie. |
| **3-d** Offres et prix machine-readable | 45 | Le seul chemin pour qu'une IA cite un prix. Un prix faux est pire qu'un prix absent. |
| **3-e** JobPosting / Google for Jobs | 25 | Canal de visibilité réel et à part, avec ses règles propres. |
| **3-f** Avis et `AggregateRating` | 20 | Actif rare (77 avis réels) ; noté sur son **exploitabilité**, pas sur son existence. |

### Score et justification

**3-a — 55/60.** B4 : « socle prod-grade ». QAPage complet avec `answerCount`,
`upvoteCount` et auteur, FAQPage cappé à 50 éditoriales, `DefinedTerm`/`DefinedTermSet`
cohérents, `Dataset` avec distribution CSV/JSON, graphe `ImageObject` en SSOT à
3 consommateurs, `BreadcrumbList` systématique, `SiteNavigationElement` global,
`GeoCoordinates` déjà présents (`seo.ts:1457`, `:1511`) — ce qui rend les balises
`geo.*`/`ICBM` de la vieille checklist inutiles, et H5 a raison de les écarter.

**3-b — 18/50.** Une trentaine de gabarits — villes pSEO, secteurs, centre-aide,
stack-ia, glossaire hub — émettent leurs `FAQPage`/`QAPage`/`ItemList` en
`strategy="afterInteractive"`, donc **invisibles aux crawlers IA non-JS** qui sont la
cible même de l'AEO (**GEO-029**, B2+B4+D4+D5, corroboré par G2 : un seul bloc
résiduel de niveau layout sur `/audit/par-ville/lyon`). Portée retenue après arbitrage :
les **480 pages villes déclarées**, plus toute la famille `par-ville` hors sitemap.
Le nœud `Person` « Manon » est DB-dépendant, laissant un `author @id` orphelin sur
1 500+ fiches servies depuis le rendu de build (**GEO-047**, B4). Point à porter au
crédit du domaine, et contre-intuitif : H4 a démontré que repasser en `strategy="inline"`
**déplace** les octets du payload RSC vers le HTML au lieu de les ajouter et **retire**
du travail d'hydratation — l'hypothèse de travail est « TBT neutre à améliorant ».

**3-c — 12/50.** Le sous-critère le plus dégradé du domaine. `vatID` et `identifier`
SIRET sont **absents en permanence** du nœud `#organization` de toutes les pages 100 %
statiques, dont les 480 hubs villes indexables — H1 a établi la corrélation parfaite
sur 8 URLs, même build, T+5 h 30 : ISR ⇒ `vatID` présent, statique ⇒ `vatID` absent
(**GEO-003**, B1, P0). `sameAs` compte 3 entrées, aucun nœud registre, et Wikidata
renvoie `"search":[]` (**GEO-045**, B1+F5). Une `Organization` divergente est ré-émise
sous le **même `@id`** sur les 288 pages galerie, avec `foundingDate` **2024 et 2026
dans le même document** (**GEO-053**, E2). `x.com/AxionIA`, déclaré en `sameAs` du
graphe images, répond **404** sur 289 pages (**GEO-054**, F6). Et le NAP n'a pas de
« P » : aucun téléphone public dans le graphe (**GEO-055**, F5).

**3-d — 15/45.** L'`AggregateOffer` des hubs ville est incohérent et **partiellement
faux** : `lowPrice` à 1190 alors que 2 offres valent 990, `highPrice` qui ne borne
rien, coaching dirigeant au prix collaborateur, naming « Audit IA Flash » aboli —
5 sous-points sur 5 vérifiés (**GEO-042**, B2). Aucun prix machine-readable n'existe
sur les 4 fiches audit ni sur `/tarifs`, le nœud `offers` n'étant émis que si
`priceEur` est passé (**GEO-043**, B2). La doctrine « à partir de » (décision actée 4)
est respectée par cette notation : `priceSpecification.minPrice` en est la traduction
machine, pas une remise en cause.

**3-e — 8/25.** 10 offres hybrides sont déclarées « 100 % télétravail »
(`jobLocationType: TELECOMMUTE` **en plus** du `jobLocation`) (**GEO-004**, B5, P0).
53 offres sur 54 partagent le même `datePosted` à la milliseconde, produisant une
falaise de fraîcheur (**GEO-048**) — sans que cela justifie de reculer les dates, ce
que H1 et H4 ont éliminé comme remède pire que le mal et contraire à la décision 5.
Deux `JobPosting` concurrents coexistent pour la même offre commerciale sur deux URLs
(**GEO-049**), ~16 titres sont non conformes aux règles Google for Jobs (**GEO-050**),
et `hiringOrganization` est auto-référencé et hors graphe sur `/devenir-commercial-ia`
(**GEO-051**). Rappel : `validThrough` et `baseSalary` absents sont des décisions de
Will et **n'ont retiré aucun point**.

**3-f — 10/20.** L'actif est excellent et la donnée irréprochable : **77 avis réels,
moyenne exacte 4,8831** (68×5★ + 9×4★), affichée 4,9 par arrondi, `reviewCount: 77` en
JSON-LD, 77 slugs dans `sitemap-avis.xml` — 8 rapports concordants, zéro contradiction.
Mais l'exploitabilité SERP est nulle : l'`AggregateRating` n'existe que sur
`Organization` (self-serving, non éligible) et sur 5 facettes sans autorité — `/fr/audit`
porte 7 blocs `ld+json` et **zéro** `aggregateRating` (**GEO-052**, B6, vérifié par H6).

**Récupérable P0 seuls : +18** — GEO-003 (patch build-args, +10 sur 3-c) et GEO-004
(+7 sur 3-e). Attention à l'ordre : GEO-003 **conditionne** le patch `llms.txt` du
domaine 9 (H4 : les routes sont `runtime = "edge"` et écrire le SIREN en dur rougit
`check-anti-siren.sh` ; le seul chemin sûr passe par `env.COMPANY_*`).

**Plafond P0+P1 estimé : ~205/250.**

---

# Domaine 4 — Metadata & indexabilité — **158 / 250**

C'est le domaine le mieux noté, et il le mérite : C1, C2, C3 et C5 concluent tous les
quatre « globalement saine », avec **un seul P0** sur les 10 findings du domaine.

### Barème

| Sous-critère | Pts | Pourquoi ce poids |
|---|---:|---|
| **4-a** Title / description / canonical | 60 | Ce que l'utilisateur voit en SERP et ce que le moteur déduplique. |
| **4-b** hreflang et en-têtes `Link` | 40 | Un hreflang qui pointe vers une redirection est un signal invalidé pour tout le cluster. |
| **4-c** Open Graph / Twitter | 45 | Partage social + Discover, et coût serveur si mal caché. |
| **4-d** Robots meta / `X-Robots-Tag` / tiers d'indexation | 45 | Le mécanisme central de l'indexation au mérite du site. |
| **4-e** Redirections et codes | 35 | Chaînes, 404/410, soft-404 : l'hygiène qui économise du budget de crawl. |
| **4-f** Balisage éditorial complémentaire | 25 | `article:*` et `<time datetime>` : signaux de fraîcheur secondaires mais bon marché. |

### Score et justification

**4-a — 47/60.** Base saine. −13 pour la double marque dans les `<title>` :
`· Axion-IA · Axion-IA` sur ~290 pages galerie et `· FAQ Axion-IA · Axion-IA` sur les
fiches FAQ (**GEO-057**, C1+F3 — impact requalifié **moyen** après division du volume
par 3 par H6), et pour la canonical héritée du layout, qui fait annoncer
`canonical = /fr` à toute page sans `alternates` (**GEO-138**, C1 — P2 réel : les
3 pages touchées sont `noindex` ou `Disallow`, mais le piège est systémique).

**4-b — 14/40.** Le seul P0 du domaine, et il est site-wide : l'en-tête HTTP `Link`
déclare un hreflang `en` vers des **301** et un `x-default` vers une URL redirigeante,
sur **toutes** les pages (**GEO-005**, C1). Ce n'est pas un sujet « EN » — la décision 1
n'est pas rouverte : c'est un cluster hreflang invalide servi à chaque requête, qu'il
faut nettoyer précisément **parce que** le site est français uniquement.

**4-c — 28/45.** C2 : og:image + twitter:image absolues sur 14/15 pages stratégiques,
404 comprise, **zéro localhost** (le filet `site-url.ts` tient), `Allow: /api/og`
présent en prod et verrouillé par un spec, icônes et manifest tous 200 avec dimensions
binaires conformes. Deux vraies pertes : **aucune image OG générée n'est cachée par le
CDN** — `cf-cache-status: DYNAMIC`, ~2 s de rendu Satori à **chaque** fetch, mesuré
deux fois (1,985 s puis 2,026 s) (**GEO-058**, C2) ; et les og:image des articles blog
sont des Unsplash `w=1080`, **sous le plancher Discover**, avec des dimensions
déclarées 1200×630 fausses (**GEO-059**, C2).

**4-d — 30/45.** C3 : catchall = **vrai 404 HTTP**, 410 dur sur `/ia-*`, `X-Robots-Tag`
`noindex, follow` servi sur les stubs pSEO et **absent** des pages indexables, strip
`Set-Cookie` opérationnel. −15 pour les 11 URLs publiques stratégiques rendues
dynamiquement (`private, no-store`, `cf BYPASS`, 3 `Set-Cookie`) malgré leur
`revalidate` — dont `/fr/avis`, `/fr/observatoire-ia`, `/fr/presse`, `/fr/carrieres` —
avec un TTFB de 157 à 1 078 ms contre 29–66 ms en cache, 6/6 reproduites hors fenêtre
post-deploy (**GEO-061**, G1 ; corrections de H3 intégrées : `/fr/galerie` = 60 s,
`/fr/appel` = 900 s, `/fr/recherche` retirée de la liste).

**4-e — 27/35.** `/` → 301 `/fr`, aplatissement à 1 saut effectif pour les entrées
mappées, portail en 307 `private, no-store`. −8 pour `/en/book-a-call` → 301
`/fr/appel-a-call` → **404**, collision de préfixe sans frontière de segment dans
`mapEnToFr` — 1 ligne, 30 secondes (**GEO-060**, C3, impact moyen-faible car EN est
désactivé) — et pour les chaînes à 2 sauts persistées dans les corps (**GEO-081**,
C4+C3).

**4-f — 12/25.** `article:published_time` / `modified_time` / `author` / `section` /
`tag` sont présents sur `/actualites/` et **absents de `/blog/[slug]`**, soit
**126 articles** (**GEO-142**, H5 — volume corrigé par H6, pas 61), et aucune date
d'article n'est balisée `<time datetime>` (**GEO-143**, H5). La mécanique existe déjà
dans `buildProductMetadata` : c'est du câblage, pas de la conception.

**Récupérable P0 seuls : +22** — GEO-005 seul, qui rend 4-b de 14 à ~36. Un domaine
déjà bon qui passe à 180/250 pour un patch unique.

**Plafond P0+P1 estimé : ~215/250.**

---

# Domaine 5 — Content-gen : qualité AEO — **82 / 250**

30 findings, dont 6 P0. Avec le domaine 8, le plus dégradé de la grille — et le plus
paradoxal, parce que la **conception** y est excellente.

### Barème

| Sous-critère | Pts | Pourquoi ce poids |
|---|---:|---|
| **5-a** Conception AEO des prompts et chaîne de rendu | 50 | Ce que le système *vise*. Noté à part pour ne pas confondre l'intention et le résultat. |
| **5-b** Gates de qualité effectives | 55 | Ce qui empêche un contenu faible d'être publié. Sur un site à production automatisée, c'est le cœur. |
| **5-c** Véracité et E-E-A-T | 55 | Un moteur de réponse ne cite pas ce qu'il ne peut pas corroborer. Une stat fabriquée est un poison. |
| **5-d** Citations et sources | 35 | La monnaie de l'AEO : c'est par les sources qu'un contenu devient citable. |
| **5-e** Formats extractibles | 30 | Listes, tableaux, chiffres-clés, `HowTo` : ce qu'une IA prélève littéralement. |
| **5-f** Pilotage de la production | 25 | Cadence, mots-clés, fraîcheur : la boucle qui décide **de quoi** on parle. |

### Score et justification

**5-a — 42/50.** D2 est formelle : les prompts sont « d'un très bon niveau AEO 2026 »
(réponse directe 40-80 mots, `<p data-aeo="answer">` sous chaque H2, formats
extractibles, interdictions E-E-A-T explicites) et la chaîne de rendu est saine
(AnswerCard `.tldr-answer`, ancres H2 injectées, sommaire, FAQ en accordéon natif,
sélecteurs Speakable pointant vers des cibles réellement présentes dans le HTML brut).
Le capital intellectuel est là. C'est son exécution qui ne l'est pas.

**5-b — 6/55.** Le worker de publication écrit `const indexationTier = "tier_1_indexable"`
**en dur** et ne lit jamais le `shouldPromoteTier1` calculé en amont : le garde-fou
soft-404 **n'interdit rien** (**GEO-007**, D2, arbitré par H6 contre D3 — D3 décrivait
correctement le calcul, D2 avait raison sur l'effet). Conséquence directe : **40 % du
corpus indexé est sous le plancher de longueur de ses propres générateurs**, un article
de 175 mots est indexé (**GEO-008**, D2). La doctrine « block » ne bloque rien : seuls
SIREN/SIRET/RCS sont des hard-faults (**GEO-066**, D3). Le multi-judge est activé en
prod mais **inerte sur les 7 générateurs principaux** (**GEO-067**, D3). Et **100 % du
corpus KB publié est sous les seuils de sa propre quality-gate** — 44 mots contre 500,
zéro `<h2>` — ce qui prouve que les gates n'ont jamais tourné en prod (**GEO-068**, D5).

**5-c — 8/55.** Le finding le plus grave de tout l'audit sur le plan de la citabilité :
**26 % du corpus indexé publie une statistique propriétaire fabriquée ou un cas client
anonyme**, tous deux interdits en toutes lettres par les prompts, et que le détecteur
de doctrine ne voit pas (**GEO-009**, D2). Le JSON-LD de chaque article affirme une
supervision humaine que le HTML de la même page **dément deux lignes plus bas**
(**GEO-011**, D6). « Dernière vérification : `<date de l'article>` » sous le bloc
Sources est une affirmation E-E-A-T fausse (**GEO-071**, D6). Et la correction
automatique des chiffres réfutés réécrit des articles publiés **sans laisser aucune
trace publique** (**GEO-072**, D6). Facteur aggravant transverse, établi hors de cet
audit : le corpus affirme aussi une certification Qualiopi jamais délivrée — ce qui
place une revendication invérifiable dans le même document que des chiffres
invérifiables.

**5-d — 9/35.** Des URLs de citation **malformées (backtick)** sont servies dans le
HTML **et** dans le `CreativeWork` JSON-LD (**GEO-010**, D6, renforcé par H2 — le patch
est incomplet sans backfill DB). 54 % des liens de citation ont un intitulé
inexploitable, URL brute ou markdown, dégradant les ancres et `isBasedOn`
(**GEO-069**, D6). Le monitor de fraîcheur des liens écrit dans un système de fichiers
éphémère, figeant le catalogue au 2026-05-22 (**GEO-070**, D6).

**5-e — 12/30.** Les guides pilier n'ont ni sommaire ni `HowTo` : l'extracteur d'étapes
attend du markdown, le générateur écrit du HTML — JSON-LD = `Article` seul, zéro
`HowTo` (**GEO-064**, D2). Un double bloc « Sources » pollue le sommaire, l'`ItemList`
et le compteur de H2 du scorer (**GEO-065**, D2). Deux findings restent INCERTAINS et
**ne pénalisent pas** : formats extractibles quasi absents (**GEO-150**) et réponse
directe manquante sur 13 % des sections (**GEO-151**) — méthode saine, résultat non
reproduit par la Phase 2.

**5-f — 5/25.** Le sampler d'intentions `(slotIndex + seed) % total` avec des poids
fractionnaires retourne **toujours** la première clé : 100 % `informational` au
rallumage (**GEO-006**, D1 — le finding le plus solide de la squad D, à corriger
**avant** la recharge OpenAI). Le plancher de cadence à 96 jobs/jour rend `dailyArticles`
décoratif, mesuré ×4,8 la cible (**GEO-063**, D1). La banque de **1 835 mots-clés
stratégiques n'a jamais alimenté une seule génération** (`usage_count` = 0 depuis le
2026-06-16) (**GEO-074**, D8). Le kill-switch OpenAI gèle **aussi** le sync GSC
(pourtant gratuit), l'élagage tier-lifecycle, le cycle de vie news et le détecteur
d'opportunités — cause commune de 4 symptômes, un seul patch de découplage
(**GEO-076**, D8). Le détecteur d'opportunités est structurellement inerte
(**GEO-077**), le tracking GSC ne couvre que les articles (**GEO-078**), et le worker
anti-decay est triple-mort (**GEO-073**). Précision de méthode : l'arrêt de la machine
à contenu lui-même **n'a pas été compté** — c'est un reste-Will acté (décision 10).

**Récupérable P0 seuls : +55** — le plus gros gisement de la grille : GEO-006 (+6),
GEO-007 (+12), GEO-008 (+8), GEO-009 (+18), GEO-010 (+7), GEO-011 (+6). Réserve
majeure : **3 de ces 6 patches sont STOP & ASK Will** (GEO-007 renverse la décision du
2026-06-17 ; GEO-009 doit être testé à blanc sur les 129 articles avant activation) et
la remédiation du corpus déjà publié dépend de la recharge OpenAI, reste-Will acté.

**Plafond P0+P1 estimé : ~175/250** — plafonné, pas par le code, mais par le fait que
26 % du corpus doit être **réécrit**, pas seulement gaté.

---

# Domaine 6 — pSEO & maillage — **96 / 250**

### Barème

| Sous-critère | Pts | Pourquoi ce poids |
|---|---:|---|
| **6-a** Doctrine d'indexation au mérite | 50 | Le cœur de la stratégie pSEO du site : n'indexer que ce qui mérite de l'être. |
| **6-b** Découvrabilité des pages indexables | 50 | Produire une page riche et la rendre introuvable est la pire perte sèche possible. |
| **6-c** Intégrité des liens internes | 50 | Un lien en 404 ou en 301 sur tout un corpus dilue le budget et casse le silo. |
| **6-d** Différenciation on-page | 45 | Le risque doorway est le risque n°1 de tout dispositif pSEO. |
| **6-e** Architecture de crawl du silo | 30 | Profondeur, hubs, orphelins. |
| **6-f** Couverture `noindex` des familles non déclarées | 25 | Ce qui empêche les ~10 785 URLs `par-ville` de polluer l'index. |

### Score et justification

**6-a — 42/50.** D4 : « le dispositif fonctionne exactement comme il est écrit ».
**480 villes indexables** (premium ∩ unique), fichier généré parfaitement synchrone
(0 écart), cohérence page ↔ sitemap ↔ `X-Robots-Tag` sur toute la surface
`implantations`, tokens prix résolus, hreflang EN correctement absent. −8 pour les
95 pages sur 480 (20 % du corpus indexé) qui portent un défaut qualité **auto-déclaré**
(`// Quality score: 50`) jamais remédié (**GEO-086**, D4) — la doctrine se dément
elle-même sur un cinquième de son propre corpus.

**6-b — 12/50.** **455 pages `/sites-web-augmentes/par-ville/*`** sont `index, follow`,
riches (~2 100 mots uniques), et déclarées dans **aucun sitemap ni lien interne** :
0 lien mesuré depuis les hubs villes et les 5 pages services, pour 104 impressions et
**0 clic** (**GEO-014**, D4, P0). C'est la plus grosse perte sèche mesurée par l'audit :
de la valeur produite, indexable, et structurellement introuvable. Le patch est
**STOP & ASK** — il contredit la décision Will du 2026-06-20 de sortir toute la famille
`par-ville` des sitemaps.

**6-c — 10/50.** Deux casses franches et un défaut systémique. ~48 % des articles blog
échantillonnés portent un lien in-body vers `/implementations` qui atterrit en **404**,
alors que le prompt générateur v7-phase8 **impose** ce lien (**GEO-012**, C4). Le silo
FAQ — 87 fiches, surface AEO majeure — a ses CTA hub ↔ thématiques rendus en
`/fr/fr/*` → **404** (**GEO-013**, C4, meilleur rapport effort/impact de la squad C).
Et **tous** les liens internes injectés in-body sont locale-less, soit un 301 par lien
sur tout le corpus (**GEO-079**, C4), le hub carrières émettant ses 54 liens d'offres
de la même façon (**GEO-080**, C4). Points conservés : home → toutes pages stratégiques
en 1 clic, villes pSEO à profondeur ≤ 2, `/recherche` correctement `noindex, follow`,
glossaire et avis bien maillés, garde anti-ancres-imbriquées opérante.

**6-d — 12/45.** Même H1 sur les 2 157 pages villes, sans mot-clé de service, avec
`data-speakable-hero` posé sur une **question rhétorique** (**GEO-085**, D4) ; **65 %
des meta-descriptions** des villes indexées partagent leurs 80 premiers caractères
(**GEO-084**, D4, impact requalifié moyen-fort : Google réécrit les descriptions
dupliquées) ; similarité de rendu 6-grammes **médiane 0,52** après masquage du nom de
ville, pendant que la garde anti-doorway maison mesure les **fichiers copy** (20 % de
boilerplate = « ✅ OK ») et n'est branchée à aucune CI (**GEO-087**, D4).

**6-e — 12/30.** Le hub `/fr/implantations` à 8,8 Mo et 78 % de liens vers du noindex
(**GEO-034**, également compté en 1-c car il coûte des deux côtés : budget de crawl
**et** architecture) ; le hub `/connaissances` orphelin de la navigation, **48 fiches
liées sur 507** (**GEO-088**, D5+C4, reproduit à l'unité).

**6-f — 8/25.** `X-Robots-Tag` absent sur `/formations/par-ville/*` et
`/un-a-un/par-ville/*` — 2 verticales sur 5 — avec un test qui **verrouille une route
qui n'existe plus** (**GEO-083**, D4). H4 classe ce patch **RISQUE ÉLEVÉ** :
`seo-noindex-routes.ts` est consommé par `proxy.ts:336`, middleware Edge **sans
try/catch** ; le set de 455 slugs doit être **généré**, jamais saisi, sous peine de
500 sur toute la famille.

**Récupérable P0 seuls : +55** — GEO-012 (+18), GEO-013 (+12), GEO-014 (+28, sous
réserve d'arbitrage Will). GEO-012 et GEO-013 sont deux patches courts qui rendent
30 points à eux seuls : le meilleur retour sur effort du domaine.

**Plafond P0+P1 estimé : ~200/250.**

---

# Domaine 7 — Images — **87 / 250**

### Barème

| Sous-critère | Pts | Pourquoi ce poids |
|---|---:|---|
| **7-a** Crawlabilité et indexation effective | 45 | La condition nécessaire. Mesurée de l'extérieur, elle vaut plus qu'une déclaration interne. |
| **7-b** Sémantique (`alt`, `title`, `caption`) | 45 | Ce qui rend une image compréhensible par un moteur — et par un lecteur d'écran. |
| **7-c** Intégrité du graphe `ImageObject` | 40 | Le contrat structuré de chaque image : licence, vignette, page porteuse. |
| **7-d** Exactitude des métadonnées de fichier | 40 | Dimensions, poids, EXIF/IPTC : ce que Google Images lit dans le binaire. |
| **7-e** Cohérence déclaré ↔ rendu ↔ indexé | 40 | Déclarer une image qui n'est ni rendue ni indexée est un effort intégralement perdu. |
| **7-f** Conformité éditoriale et juridique des visuels | 20 | Un visuel publié engage autant qu'une phrase des CGV. |
| **7-g** Pipeline d'exploitation (upload, mesure) | 20 | Sans upload ni mesure, la banque d'images ne peut plus évoluer. |

### Score et justification

**7-a — 40/45.** La preuve live la plus forte de l'audit, et elle est bonne : E4 a
relevé un index-images tiers (Brave) renvoyant **44 résultats, tous rattachés à
`axion-ia.com`**, sans le moindre challenge anti-bot sur `Googlebot-Image`. Les
correctifs robots de juin (`Allow: /_next/image`, `Allow: /api/og`) ont tenu. Les
images **sont** crawlables et **sont** indexées.

**7-b — 12/45.** Le seed écrase `alt`/`title`/`caption` par une dérivation mécanique du
slug, et l'enrichissement ne les régénère jamais (**GEO-089**, E1 — requalifié P0 → P1
par H6 : la récurrence est réfutée, 24 runs de seed tous en mai 2026, et la moitié de
l'impact annoncé est nulle puisque Google a **déprécié** `<image:title>`/`<image:caption>`
en 2022 ; volume 133 ou 288, non tranché faute de DB). Les héros Unsplash des articles
content-gen portent un `alt` **en anglais**, sans aucune normalisation FR — ce qui
contredit frontalement la décision 1 et **renforce** donc le finding (**GEO-098**, E3).
Et un prix mort « 490 € » est gravé dans un `<title>` indexable et dans 2 légendes du
sitemap images (**GEO-015**, E1, P0 — root-cause corrigée : le prix est injecté dans le
**prompt système**, `scripts/enrich-images.cjs:41`, pas lu dans l'image ; le patch
« retoucher l'affiche » est éliminé).

**7-c — 10/40.** `acquireLicensePage` pointe `/fr/cgu` → **404** sur les 141
`ImageObject` des pages marketing (**GEO-016**, E2, P0) ; 75 `thumbnailUrl` sont en 404
dans les JSON-LD et dans la console admin (**GEO-093**, E1) ; 5 pages éditoriales sont
au sitemap images **sans** graph `ImageObject` ni `primaryImageOfPage` (**GEO-096**,
E2) ; et 9 images déclarées en JSON-LD et au sitemap **ne sont plus affichées**
(`/roi` ×4, `/formations/entreprise` ×5), l'image `representativeOfPage` n'étant pas
rendue du tout (**GEO-056**, E2, aggravé par H3).

**7-d — 8/40.** Zéro EXIF/XMP/IPTC sur 100 % des fichiers publiés,
`embedCopyrightMetadata()` n'ayant **aucun appelant** — module intégralement mort
(**GEO-090**, E1). `withMetadata({orientation:1})` **conserve** l'EXIF, GPS compris, au
lieu de le stripper, alors que le commentaire RGPD affirme l'inverse, et rien
n'auto-oriente les photos (**GEO-091**, E1). Dimensions et poids de la base sont
fictifs, devinés depuis le suffixe du slug, avec `fileSize = 0` partout (**GEO-092**,
E1 — mécanisme confirmé, comptages `[À CONFIRMER]`).

**7-e — 8/40.** Les sitemaps images villes déclarent une **bannière générique partagée**
pour toutes les villes, pas l'image rendue — 6/6 premiers `<image:loc>` identiques
(**GEO-099**, E3). Les 129 `<image:loc>` du sitemap blog pointent **tous** vers
`images.unsplash.com` : la valeur d'indexation du plus gros corpus éditorial est cédée
à un hôte tiers (**GEO-101**, E4). Et E4 a mesuré que l'URL réellement indexée n'est
**jamais** celle déclarée : 40/40 originaux hébergés sont des `/_next/image?url=…`,
**0** ne correspond à un `<image:loc>`.

**7-f — 6/20.** Des garanties de résultat sont **incrustées dans des visuels publiés**
(« GAINS MESURABLES ASSURÉS », « 100 % GAGNANT »), sur les 59 héros villes — ce qui
contredit la décision actée 8 (CGV = obligation de moyens) et constitue une exposition
réelle (**GEO-097**, E3, confirmé par inspection visuelle). Deux visuels affichent la
marque en « Axion-IA.com » (graphie LinkedIn) et l'un porte la faute « RECOMMANDATIONS
CONCRÉTÉS » (**GEO-102**, relevé neuf de H3).

**7-g — 3/20.** La chaîne d'upload admin est cassée de bout en bout : aucune image UUID
n'existe en prod, 3 valeurs par défaut divergentes pour `IMAGE_BANK_STORAGE_PATH`,
absente d'`env.ts` (**GEO-094**, E1, aggravé par H3 — mais le chemin Server Action est
déjà correct, à ne pas réécrire). `trackUsage()` n'est appelée nulle part :
`image_usage_logs` reste vide et la mesure des referrers IA est morte (**GEO-095**, E1
— **ordre critique** : ne poser ce patch qu'après avoir vérifié qu'il n'écrit pas sur
la ligne image, sinon il fabrique GEO-036). Et rien ne mesure la recherche d'images :
`type: "image"` n'est demandé nulle part dans les requêtes GSC (**GEO-100**, E4).

**Récupérable P0 seuls : +22** — GEO-015 (+8) et GEO-016 (+14). Le domaine 7 est
l'exemple type où **les P0 ne sont pas le sujet** : 14 des 16 findings sont des P1, et
c'est là que sont les 140 points manquants.

**Plafond P0+P1 estimé : ~190/250.**

---

# Domaine 8 — Présence sur les moteurs classiques — **48 / 250**

Domaine de **résultat**, pas de code : il note ce que le site obtient, pas ce qu'il
fait. C'est pourquoi il est le plus bas de la grille, et pourquoi ses P0 ne sont
presque pas « patchables ».

### Barème

| Sous-critère | Pts | Pourquoi ce poids |
|---|---:|---|
| **8-a** Trajectoire de visibilité mesurée | 80 | Le juge de paix. Pondération la plus lourde de toute la grille. |
| **8-b** Qualité de la demande captée | 50 | Être en top 3 sur des requêtes sans volume ne vaut rien. |
| **8-c** Visibilité des pages commerciales stratégiques | 45 | La visibilité doit atterrir là où l'argent se fait. |
| **8-d** Reconnaissance de la marque | 35 | Prérequis de tout le reste : si le moteur ne connaît pas le nom, aucun signal ne s'accumule. |
| **8-e** Chaîne de soumission et couverture Bing | 40 | Le levier actif — et le seul entièrement sous contrôle. |

### Score et justification

**8-a — 20/80.** F2 a mesuré, sur W31 → W33, une dégradation **continue** : position
moyenne pondérée **22,2 → 25,5**, clics **19 → 13**, CTR **2,36 % → 0,86 %** (÷2,7).
La home elle-même recule de 3,10 à 6,25 et perd 4 clics. H3 a testé la contre-hypothèse
de composition — elle a **échoué** : sur cohorte stable, c'est **pire** (23,19 → 30,17)
(**GEO-017**, F2, P0). Les 20 points reconnaissent ce qui monte réellement :
impressions **805 → 1 515**, pages avec impressions **196 → 268**. Le site gagne en
surface et perd en efficacité — exactement le profil d'une dilution non enrayée
(50 % des impressions W33 tombent au-delà de la position 20).

**8-b — 10/50.** Le top 10 est atteint sur 119 pages, mais sur des requêtes sans
demande : **26 pages en top 3 → 60 impressions → 2 clics** (**GEO-018**, F3, P0 ;
Google Suggest re-tiré par H3, liste vide).

**8-c — 6/45.** `/fr/audit`, page du service phare, est quasi absente de la SERP avec
**1 impression par semaine**, pendant que 117 pages villes en captent 481
(**GEO-019**, F3, P0). Le trafic organique ne touche pas l'offre.

**8-d — 4/35.** Google ne reconnaît pas la marque et **corrige « axion-ia » en
« action ia »** ; aucune requête de marque n'existe dans son autocomplete — liste
identique, même ordre, sur un second tirage à 7 h d'écart (**GEO-103**, F3). C'est le
verrou amont : sans entité de marque reconnue, rien ne s'accumule.

**8-e — 8/40.** La chaîne de soumission GSC est morte (**GEO-104**, 0/40 runs), Bing
est un angle mort d'observabilité totale (**GEO-106**), IndexNow n'atteint que Yandex
(**GEO-105**). Les 8 points vont à l'export hebdomadaire GSC, qui tourne fidèlement
depuis juin et est le seul instrument de mesure fiable du domaine.

**Récupérable P0 seuls : ≈ 0 à court terme.** C'est un constat important, pas un aveu
d'impuissance : les 3 P0 de ce domaine (GEO-017/018/019) sont des **diagnostics**, pas
des défauts patchables. Ils se récupèrent par les patches des domaines 1, 2, 5 et 6 —
avec 6 à 12 semaines de latence de crawl. Seul 8-e est directement actionnable
(réparation du scope OAuth : +12 à +15, mais ce sont des P1).

**Plafond P0+P1 estimé : ~90/250** — délibérément prudent : aucun patch de cette
Phase 3 ne fait remonter une position moyenne en moins d'un trimestre.

---

# Domaine 9 — Moteurs IA & entité vérifiable — **59 / 250**

### Barème

| Sous-critère | Pts | Pourquoi ce poids |
|---|---:|---|
| **9-a** Citation effective par les moteurs de réponse | 70 | La finalité même du GEO. Pondération la plus lourde du domaine. |
| **9-b** Résolvabilité de l'entité au registre | 45 | Le socle vérifiable : sans lui, aucune corroboration n'est possible. |
| **9-c** Corroboration par des tiers (`sameAs`, Wikidata, annuaires, NAP) | 45 | Un moteur ne croit pas un site sur parole : il recoupe. |
| **9-d** Véracité des revendications d'autorité | 50 | Une affirmation invérifiable au registre est précisément ce qu'un moteur **ne peut pas** reprendre à son compte. |
| **9-e** Canal déclaratif dédié aux IA comme ancre d'identité | 40 | `llms.txt` est la carte d'identité que l'on tend soi-même aux moteurs. |

### Score et justification

**9-a — 5/70.** Trois intentions testées, trois échecs mesurés. Sur la requête de
marque « Qui est Axion-IA ? », le moteur de réponse décrit correctement l'entreprise
**sans citer une seule fois `axion-ia.com`** : 9 liens, 0 sur le domaine, Crunchbase
en #1 et f6s en #2 (**GEO-020**, F4, P0, re-tiré par H3 avec un mix de sources
différent et un verdict identique). Sur les 2 requêtes commerciales : **0 citation**,
la place captée par des listicles tiers où Axion-IA n'apparaît pas — et le **critère de
tri du moteur est Qualiopi** (**GEO-107**, F4). Sur l'intent « avis », c'est l'homonyme
**Axion Formations (Saint-Quentin)** qui capte la réputation, aucune page `/fr/avis/**`
ne remontant (**GEO-108**, F4). Réserve de portée à conserver : **un seul** moteur de
réponse a été interrogé ; ces verdicts ne sont pas transposables tels quels à
Perplexity, ChatGPT Search ou Gemini.

**9-b — 32/45.** **La vraie bonne nouvelle de l'audit.** L'entité est désormais
résolvable au registre : `AXION IA`, SIREN 108018631, siège **Grenoble en exact-match**,
dirigeant Jullin Williams — la requête « axion ia » ne renvoie **qu'une** structure en
France, contre « aucune structure trouvée » le 2026-07-20 (F5). Et les mentions légales
publient enfin SIREN/SIRET/TVA/capital/RCS en clair. C'est le verrou qui a bougé.
−13 pour le fait que cette identité n'est pas encore **portée dans le code servi**
(cf. GEO-003, domaine 3) et pour le boilerplate presse public qui annonce « fondé en
2024 » contre Kbis et JSON-LD 2026, sans ancrer ni Grenoble ni le SIREN (**GEO-022**,
F6, P0).

**9-c — 6/45.** `sameAs` reste à 3 entrées, **zéro nœud registre**, alors que trois
pages miroir (annuaire-entreprises, societe.com, pappers) répondent 200 ; **Wikidata
renvoie toujours `"search":[]`** (**GEO-045**, B1+F5). Le module de citations locales
NAP est **100 % inerte** (0/10 annuaires), jamais injecté dans aucun JSON-LD, alors que
8 profils existent réellement (**GEO-046**, B1+F6). Les 2 fiches tierces les plus
visibles ancrent l'entité à **PARIS** (138 Champs-Élysées, 75008) et écorchent le nom du
fondateur (**GEO-112**, F6) — à corriger **avant** de déclarer quoi que ce soit en
`sameAs`. Et le seul tiers à autorité, LinkedIn, contredit le registre sur trois
attributs : « Paris » vs Grenoble, « 2025 » vs 2026, « Axion-IA.com » vs AXION IA, avec
7 abonnés (**GEO-110**, F5, re-fetch indépendant + addendum F6) — c'est la racine,
jamais identifiée jusqu'ici, du « siège à Paris » que les moteurs affirmaient le 20/07.
S'y ajoutent l'absence de téléphone public et de Google Business Profile
(**GEO-055**, F5) et le « moteur de backlinks passif CC BY » qui est du code mort,
`EmbedCodeButton` n'étant monté nulle part (**GEO-113**, F6).

**9-d — 2/50.** Le sous-critère le plus bas de toute la grille, et c'est délibéré. Le
statut « organisme de formation certifié Qualiopi », affirmé partout en production,
n'est corroboré par **aucun registre public** : `est_organisme_formation = false` **et**
`est_qualiopi = false`, aucun NDA publié nulle part sur le site, et le seul « Axion »
vérifiablement Qualiopi est l'homonyme **AXION FORMATIONS** de Saint-Quentin, NDA
22020045002 (**GEO-021**, F5, P0, vérifié au registre par H3). **Ce point n'est plus
une hypothèse** : l'audit blanc Qualiopi mené en parallèle (30 agents, 2026-08-15) a
établi indépendamment que la certification n'a **jamais été délivrée** et que le
drapeau `QUALIOPI_CERTIFICATION_OBTENUE=true` neutralise une garde que le code avait
posée. Deux voies d'enquête sans lien entre elles convergent : c'est un **fait**.
Pourquoi cela pèse 48 points de moins en GEO qu'en conformité : GEO-107 a mesuré que
le **critère de tri du moteur de réponse est précisément Qualiopi**. Le site revendique
donc le seul attribut qui déciderait de sa citation, sur le seul canal — le registre —
où un moteur peut le vérifier, et où il lit l'inverse. Le résultat n'est pas neutre, il
est **négatif** : la revendication invérifiable est ce qui empêche la reprise.
**Aucune action n'est prescrite ici** : l'action corrective est déjà identifiée et
actée par Will, et relève de l'audit Qualiopi dédié.

**9-e — 14/40.** Le canal existe et l'infrastructure est **irréprochable côté site**
(F4) : bots de citation autorisés, `llms.txt`/`ai.txt`/`ai-policy` en 200, doctrine
robots conforme au code. Mais son contenu affirme le maximum — Qualiopi, financements —
**sans aucune ancre vérifiable** : 0 occurrence de « SIREN », 0 de « 108018631 », 0 de
« Grenoble », et il désambiguïse le **mauvais** homonyme (`axionai.fr` au lieu d'AXION
FORMATIONS et de « action ia ») (**GEO-109**, F4+F5). H4 classe ce patch **RISQUE
ÉLEVÉ** et **dépendant de GEO-003**. S'y ajoute la divergence du slug LinkedIn :
3 occurrences `axion-ia` contre 8 `axion-ia-france`, les deux servies dans le même HTML
(**GEO-111**, F6).

**Récupérable P0 seuls : +8** — GEO-022 (boilerplate presse) est le seul P0 du domaine
qui soit un patch de code. GEO-020 est une mesure, et GEO-021 relève d'un reste-Will
acté hors de ce plan. **C'est le message central de la grille** : le domaine le plus
stratégique du GEO est celui où le code peut le moins. Ses 190 points manquants se
gagnent sur Wikidata, les annuaires, LinkedIn, le GBP et la véracité — pas dans une PR.

**Plafond P0+P1 estimé : ~110/250**, et l'essentiel de ce gain est du `03-RESTE-WILL`,
pas du `01-PLAN-PATCHES`.

---

# Domaine 10 — Perf & rendu crawler — **85 / 250**

### Barème

| Sous-critère | Pts | Pourquoi ce poids |
|---|---:|---|
| **10-a** Rendu serveur sans JS, absence de cloaking | 55 | Le prérequis absolu de l'AEO : les crawlers de citation n'exécutent pas de JS. |
| **10-b** Rapport signal/bruit du document | 45 | Un crawler qui doit lire 239 Ko avant le `<body>` paie une taxe sur chaque page. |
| **10-c** Poids et budget JS | 40 | Budget contractuel d'AGENTS.md, et déterminant INP/TBT. |
| **10-d** Poids média | 30 | Le plus facile à corriger, le plus visible en mobile-first. |
| **10-e** Fraîcheur et cohérence des caches (ISR/edge) | 40 | Ce qui décide si un crawler voit la vraie page ou une version amputée. |
| **10-f** Gates et instrumentation | 25 | Une garde ne vaut que si elle rougit. |
| **10-g** Sémantique et accessibilité du document | 15 | Ce qui rend le contenu extractible : `<main>`, outline, labels. |

### Score et justification

**10-a — 48/55.** Excellent, et démontré : sur 25 URLs sondées, G2 a trouvé le contenu
principal — h1, h2/h3, corps, réponses FAQ, **textes des 77 avis**, données de
l'observatoire, mega-menu et footer — **intégralement présent dans le HTML brut**, sans
Suspense différé, sans `ssr:false` sur du contenu, sans consentement bloquant, et
**sans le moindre cloaking** (15 pages × 3 UA, octet pour octet identiques à l'exception
des `<meta sentry-trace>`). C'est le socle qui rend tout le reste réparable. La perte
de JSON-LD non rendu est comptée en 3-b, pas ici : le **texte** est là.

**10-b — 8/45.** ~90 % du poids de chaque document est de la charge non-contenu —
payload RSC + CSS inlinée — soit une taxe directe sur le budget de crawl (**GEO-116**,
G1, 1 750 744 octets reproduits à 0,3 %). Le HTML brut transporte **920 650 octets de
CSS sérialisés 4 fois** : **52 % du document sur la home, jusqu'à 81 % sur les pages
légères**, le `<body>` ne commençant qu'au **239ᵉ Ko**, avec en prime une fuite des
utilitaires admin dans la feuille publique (**GEO-117**, G2, 3 corroborations
indépendantes). Avertissement H4, à ne pas perdre : le patch `@source not` prescrit par
G2 est **RISQUE ÉLEVÉ** — `admin.css` n'a **aucun** `@import "tailwindcss"`, l'exclusion
casserait la console admin **sans qu'aucune gate ne rougisse**.

**10-c — 6/40.** First Load JS ≈ **240 KB gz sur 100 % des routes** (278 KB avec les
polyfills), soit **×3,2 le budget de 75 KB** d'AGENTS.md, avec un socle partagé
identique partout et un chunk de page de 0,8 à 3 KB — et **aucune gate ne le mesure**
(**GEO-026**, G1).

**10-d — 4/30.** Le logo Qualiopi est un **PNG de 1 304 554 octets** servi brut sur
100 % des pages et affiché en 210 px (**GEO-027**, G4, pesé) ; l'avatar auteur est un
**PNG de 1 513 427 octets** affiché en 64 × 64 sur toutes les pages éditoriales
(**GEO-028**, G4, pesé). Soit **2,7 Mo purement décoratifs sur chaque page d'article**.
S'y ajoute la home mobile qui télécharge 62 Ko d'image hero jamais affichée
(**GEO-125**, G4 — patch corrigé par H4 : surcharger `sizes` **depuis la home**, ne pas
toucher `Illustration.tsx` partagé par tout le site).

**10-e — 8/40.** Les pages ISR lisant la DB sont absentes des deux listes du job `warm`,
laissant identité légale et bloc avis amputés ~1 h après chaque atterrissage
(**GEO-023**, P0, fusion de 8 findings — mécanisme corrigé par H6 : le cache Cloudflare
est **par PoP**, le warmer lancé depuis un runner GitHub ne chauffe pas le PoP que
voient les visiteurs français ; ce qui fige la version amputée est le **premier crawler
de chaque PoP**). `lhci`, `indexnow` et `warm` démarrent **en parallèle** après
`deploy` : les moteurs sont pingés et la page mesurée pendant la fenêtre stub
(**GEO-024**, P0 — retenir la variante G3, la variante G1 pouvant désarmer le seul gate
bloquant). Les ~480 hubs villes ne régénèrent jamais, faute de `cacheHandler` et de
volume `.next/cache` (**GEO-118**, G3). Cloudflare réécrit `max-age` 300 → 3600 et
ignore `s-maxage` sur **tous** les XML, rendant inopérant le correctif d'indexation
P1-13 (**GEO-119**, G3+F1). Et aucune mutation de contenu ne purge l'edge
(**GEO-120**, G3).

**10-f — 3/25.** Les deux gates de budget annoncés « bloquants » dans AGENTS.md sont en
`continue-on-error`, et `size-limit` cible **3 buckets `/reserver` morts** sans aucun
bucket `/appel` (**GEO-025**, G1, P0 — arbitrage C-05 de H6 : le `AGENTS.md` du dépôt
fait foi, `/reserver` a été supprimée le 2026-06-26 ; le `AGENTS.md` global et le
prompt maître de cet audit portent tous deux la valeur périmée et doivent être
rectifiés). Le seul gate réellement bloquant mesure **5 URLs, en desktop seul, sans
assertion INP** (**GEO-114**, G1). Les deux pages les plus lourdes du site ne sont dans
aucune gate, et l'audit `dom-size` qui les aurait détectées est **explicitement
désactivé** (**GEO-115**, G1). Aucune gate ne mesure le mobile, alors que les 2 projets
Playwright mobile existent (**GEO-121**, G4). Et la checklist des 60 items SEO/AEO —
dont 22 marqués `[BLOQUANT]` — n'est gardée par **rien** : son exécutant est un stub de
195 octets absent de tous les workflows (**GEO-062**, H5).

**10-g — 8/15.** Positif et mesuré par G4 : **CLS = 0 sur 8 pages**, LCP 756–792 ms,
aucun débordement horizontal, **aucune violation axe serious/critical** — menu mobile
ouvert, article et galerie compris. −7 pour les 7 `<main>` imbriqués sur ~291 pages
publiques, qui rendent le contenu principal non identifiable (**GEO-123**, sous-évalué
par G4 : 7 emplacements, pas 4), l'`aria-label` plus court que le texte visible
(WCAG 2.5.3 niveau A) sur la home et toute la famille villes (**GEO-122**), l'outline
cassé `h1 → h3` (**GEO-124**), et `/fr/faq` à 13 174 nœuds DOM et 1 646 éléments
interactifs hydratés (**GEO-126** — garde-fou capital : toute solution qui sort les Q/R
du HTML initial serait une **régression AEO nette**).

**Récupérable P0 seuls : +52** — GEO-023 (+12), GEO-024 (+6), GEO-025 (+10), GEO-026
(+8, le P0 rendant la gate rouge, pas le bundle léger), GEO-027 (+10), GEO-028 (+8).
**GEO-025 est à faire en premier de tout le plan** : tant que les gates sont en
`continue-on-error`, toute notation de risque des 44 autres patches est fausse — aucun
patch qui alourdit le bundle ne rougira.

**Plafond P0+P1 estimé : ~185/250.**

---

# Récapitulatif et verdict

| # | Domaine | Score | % | Findings (P0/P1/P2/INC) | Récupérable P0 | Plafond P0+P1 |
|---|---|---:|---:|---|---:|---:|
| 1 | Crawl & découverte | **114**/250 | 46 % | 1 / 7 / 5 / 2 | +25 | ~204 |
| 2 | Sitemaps & feeds | **140**/250 | 56 % | 1 / 6 / 7 / 1 | +16 | ~215 |
| 3 | JSON-LD & entité | **118**/250 | 47 % | 2 / 15 / 3 / 0 | +18 | ~205 |
| 4 | Metadata & indexabilité | **158**/250 | 63 % | 1 / 6 / 3 / 0 | +22 | ~215 |
| 5 | Content-gen qualité AEO | **82**/250 | 33 % | 6 / 16 / 3 / 5 | +55 | ~175 |
| 6 | pSEO & maillage | **96**/250 | 38 % | 3 / 10 / 0 / 0 | +55 | ~200 |
| 7 | Images | **87**/250 | 35 % | 2 / 14 / 0 / 0 | +22 | ~190 |
| 8 | Moteurs classiques | **48**/250 | 19 % | 3 / 4 / 0 / 0 | ~0 | ~90 |
| 9 | Moteurs IA & entité vérifiable | **59**/250 | 24 % | 3 / 7 / 0 / 0 | +8 | ~110 |
| 10 | Perf & rendu crawler | **85**/250 | 34 % | 6 / 13 / 0 / 0 | +52 | ~185 |
| | **TOTAL** | **987**/2 500 | **39,5 %** | **28 / 98 / 21 / 8** | **+273** | **~1 789** |

## Verdict de seuil

> ## 🔴 **987 / 2 500 — 39,5 %**
> Seuil 🟢 GO = 2 250 (90 %) · Seuil 🟠 = 1 750 (70 %) · **< 1 750 = 🔴**
> Le site est **1 263 points sous le seuil 🟢** et **763 points sous le seuil 🟠**.

### Les trois lectures qui comptent

**1. Les patches P0 seuls ne sortent pas du rouge.** 987 + 273 = **1 260 / 2 500
(50,4 %)** — toujours 🔴. Ce n'est pas un échec du plan P0 : c'est la structure de la
dette. **98 des 155 findings sont des P1**, et ils portent l'essentiel des points
manquants. Un plan qui s'arrêterait aux 28 P0 laisserait le site à mi-chemin.

**2. Le plan complet ne suffit pas non plus à atteindre 🟢, et c'est un résultat, pas
un aveu.** L'exécution intégrale des 45 patches (H4) place le site à **~1 789 / 2 500
(72 %) — 🟠**. Le plafond est imposé par les domaines 8 et 9, qui pèsent 500 points à
eux deux et plafonnent à ~200 : **aucune ligne de code n'achète une position moyenne
ni une citation par un moteur de réponse.** Ces 300 points-là se gagnent sur Wikidata,
les annuaires, LinkedIn, le GBP, la véracité des revendications — et en semaines.

**3. Le meilleur retour sur effort est concentré, et il est mesurable.** Trois domaines
récupèrent 162 des 273 points P0 : content-gen (+55), pSEO (+55) et perf (+52). Et
deux patches courts — `/implementations` en 404 (GEO-012) et le silo FAQ en `/fr/fr/`
(GEO-013) — rendent **30 points à eux seuls**. À l'inverse, GEO-025 (les gates en
`continue-on-error`) ne rend que 10 points mais **doit être posé en premier** : sans
lui, la notation de risque des 44 autres patches est sans valeur.

### Ce que cette note ne dit pas

Le score de 39,5 % n'est pas une note de qualité d'ingénierie. Quatre sous-critères
notés au-dessus de 87 % — doctrine robots (56/60), rendu serveur sans JS (48/55),
architecture du sitemap-index (54/60), crawlabilité des images (40/45) — montrent un
socle sérieusement construit et testé. Le déficit est ailleurs, et il est cohérent
d'un domaine à l'autre : **ce qui est construit n'est presque jamais gardé**. Les
gates sont en `continue-on-error`, la checklist des 60 items n'a qu'un stub de
195 octets pour exécutant, la quality-gate KB n'a jamais tourné, le multi-judge est
inerte, le garde-fou soft-404 est écrasé en dur, la garde anti-doorway mesure le
mauvais objet, `trackUsage` et `embedCopyrightMetadata` n'ont aucun appelant. C'est la
règle maison — *une garde ne vaut que si elle rougit* — vérifiée onze fois dans le même
audit.

### Note de traçabilité

Chaque pénalité de cette grille renvoie à un identifiant `GEO-xxx` de la liste
canonique H6 et à l'agent d'origine. Aucun point n'a été retiré sur la foi d'un finding
réfuté, d'un chiffre non sourcé (les 12 valeurs corrigées par H6 sont listées en tête),
d'un patch éliminé par H4, ou d'une recommandation contredisant une décision actée de
Will. Les 8 findings INCERTAINS n'ont pénalisé que là où ils étaient corroborés par une
seconde source indépendante (GEO-154, cité en 1-d, corroboré côté code par F7) ; les
autres — GEO-148 à GEO-153, GEO-155 — sont mentionnés sans coût en points.
