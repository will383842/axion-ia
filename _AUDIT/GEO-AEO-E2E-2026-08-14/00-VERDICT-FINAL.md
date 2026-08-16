# 00 — VERDICT FINAL

**Audit GEO/AEO end-to-end, 50 agents — Axion-IA, 2026-08-14/15.**
Agent S4 (squad synthèse). À lire en premier ; les trois autres livrables détaillent :
`02-SCORING.md` (la note), `01-PLAN-PATCHES.md` (le quoi faire), `03-RESTE-WILL.md`
(ce que le code ne peut pas faire).

Sources : 40 rapports d'agents (A1→G4) + 6 contre-vérifications (H1→H6). La liste
canonique dédupliquée et arbitrée est `H6` : **155 findings** (28 P0, 98 P1, 21 P2,
8 incertains), après élimination de 8 findings réfutés, retrait de 8 patches et
arbitrage de 21 contradictions entre agents. Aucun finding réfuté n'a servi dans ce
document.

---

## 1. Le verdict en trois lignes

> ## 🔴 **987 / 2 500 — 39,5 %**
> Seuils : 🟢 GO ≥ 2 250 · 🟠 ≥ 1 750 · **< 1 750 = 🔴**.
> Le site est **763 points sous le seuil orange**.

**La phrase qui résume la situation** : le socle technique est sérieusement construit
— le contenu est intégralement dans le HTML brut, la doctrine robots est propre et
testée, l'architecture des sitemaps est au-dessus de la moyenne du marché — mais
**presque rien de ce qui a été construit n'est gardé**, et **personne d'autre que
toi ne confirme ce que le site raconte**. Ce sont les deux seuls diagnostics de cet
audit ; les 155 findings en sont des déclinaisons.

Trois chiffres pour cadrer l'effort :

- Les **28 patches P0 seuls** font passer à **1 260 / 2 500 (50,4 %)** — toujours 🔴.
  Ce n'est pas un échec du plan : **98 des 155 findings sont des P1**, et ce sont eux
  qui portent la masse des points manquants.
- L'exécution **complète** des 45 patches (H4) plafonne à **~1 789 / 2 500 (72 %)** —
  🟠, pas 🟢. Le plafond n'est pas une timidité d'estimation : deux domaines qui pèsent
  500 points à eux seuls (présence sur les moteurs classiques, citation par les moteurs
  IA) ne s'achètent avec **aucune ligne de code**.
- Effort du plan complet : **~14 à 17 jours-homme**, dont **~2,5 jours pour les lots 1
  à 6** qui portent la majorité du gain immédiat (S2).

---

## 2. La réponse à LA question

**Un dirigeant de PME demande aujourd'hui à une IA « qui peut m'aider sur l'IA ? » —
Axion-IA sort-il ?**

**Non. Zéro fois, sur les trois intentions testées.** C'est mesuré, pas supposé (F4,
2026-08-14 entre 18:35 et 18:40 UTC, re-tiré par H3 avec un mix de sources différent
et un verdict identique) :

| Intention testée | Ce que le moteur répond | Axion-IA |
|---|---|---|
| Marque — « Qui est Axion-IA ? » | Décrit **correctement** l'entreprise, avec 9 liens sources : Crunchbase (#1), F6S (#2), puis 7 homonymes américains | **0 lien sur axion-ia.com** |
| Commerciale — « meilleur organisme formation IA pour PME à Grenoble » | Arkavia, Almera, Proxiformation, IAvenir, Mister IA, DataScientest — tous mis en avant comme « certifiés Qualiopi » | **0 mention** |
| Commerciale — « audit IA entreprise France recommandations » | Jaydai, Mookay, Mister IA, eleven-labs, entreprise-ia.com | **0 mention** |
| Réputation — « Axion-IA avis clients formation » | Indeed « Axion Formation », Indeed « Axion **Formations** — Saint-Quentin (02) », avis mitigés | **Aucune page `/fr/avis/**`** |

Deux détails de cette mesure valent le reste du rapport.

**Premier détail : ce n'est pas un problème d'indexation.** Contre-épreuve de F4 à
18:36:55 UTC — la même recherche restreinte au domaine renvoie 9 pages du site. Le
moteur **a** le site dans son index. Il choisit de répondre avec les fiches des autres.

**Second détail : le moteur trie sur Qualiopi.** Sur la requête commerciale Grenoble,
les six entreprises citées le sont avec la mention « certifié Qualiopi » comme critère
de sélection (GEO-107, F4).

### LE verrou n°1

**Le déficit d'existence vérifiable — et son aggravation par une revendication que le
registre contredit.**

L'entité est enfin résolvable au registre : `AXION IA`, SIREN 108018631, siège
**Grenoble en exact-match**, dirigeant Jullin Williams (F5, 14/08 19:11 UTC). C'est le
grand acquis depuis juillet. Mais :

- Le même registre porte `est_organisme_formation = false` **et** `est_qualiopi = false`,
  `liste_id_organisme_formation = null`, et aucun NDA n'est publié nulle part sur le
  site (F5, vérifié au registre par H3). Le seul « Axion » vérifiablement Qualiopi est
  l'homonyme **AXION FORMATIONS de Saint-Quentin**, NDA 22020045002.
- L'audit blanc Qualiopi mené en parallèle (30 agents, 2026-08-15) a établi
  **indépendamment** que la certification n'a jamais été délivrée. Deux voies d'enquête
  sans lien entre elles convergent : **c'est un fait, plus une hypothèse.**
  *L'action corrective est déjà identifiée et actée par toi ; ce document ne prescrit
  aucune action Qualiopi et renvoie à l'audit dédié.*

Ce que ça produit, en GEO, est mécanique : le site **revendique le seul attribut qui
déciderait de sa citation**, sur le seul canal — le registre — où un moteur peut le
vérifier, et où il lit l'inverse. Le résultat n'est pas neutre, il est négatif : la
revendication invérifiable est exactement ce qui empêche la reprise, et elle renvoie
le moteur vers l'homonyme qui, lui, est au registre.

Derrière ce verrou, les trois sources que les moteurs lisent aujourd'hui **à ta place**
se contredisent entre elles et contredisent le registre (F5 + F6, re-fetch indépendant
de H3) : LinkedIn dit « Paris », « fondé 2025 », « Axion-IA.com », avec **7 abonnés** ;
Les Pépites Tech dit « 138 Avenue des Champs-Élysées, 75008 Paris », hub « French Tech
Grand Paris », fondateur « **William** Jullin » ; Crunchbase et F6S — les deux fiches
qui *définissent* l'entreprise pour le moteur de réponse — n'ont jamais pu être lues
par l'audit (403 et bot-wall). Sur 8 mentions tierces, **une seule** est dofollow et
**100 % des ancres entrantes sont génériques** (F6).

Et Google, de son côté, **ne reconnaît pas la marque** : il corrige « axion-ia » en
« action ia », et aucune requête de marque n'existe dans son autocomplete — liste
identique, même ordre, sur un second tirage à 7 h d'écart (GEO-103, F3).

**Conclusion franche** : les patches de `01-PLAN-PATCHES.md` remettront le site en état
de parler. Ce sont les 18 actions de `03-RESTE-WILL.md` — dont **9 gratuites en
2 h 12 au total** — qui décideront si quelqu'un d'autre que toi confirme ce qu'il dit.
Sans elles, le meilleur code du monde ne produit pas une citation.

---

## 3. Le delta chiffré vs l'audit du 2026-07-20

**Le diagnostic du 20/07 — « déficit d'existence vérifiable, pas déficit de contenu » —
tient. Il est même plus vrai qu'il y a quatre semaines, parce que la surface de contenu
a encore grossi pendant que l'existence vérifiable n'a bougé que d'un cran.**

### ✅ Ce qui s'est amélioré (5 lignes, toutes réelles)

| Sujet | 2026-07-20 | 2026-08-14/15 | Source |
|---|---|---|---|
| Résolution au registre | « **aucune structure trouvée** » sur « axion-ia » ; empreinte du dirigeant renvoyait vers ZOZOTE/WILSOPH à Saint-Étienne | `AXION IA`, **SIREN 108018631**, siège Grenoble exact-match, dirigeant Jullin Williams — **une seule** structure en France | F5 |
| Mentions légales | SIREN/RCS/TVA/adresse tous « communiqué sur demande » (non conforme LCEN art. 19) | **publiés en clair** | F5 |
| Canal markdown pour les IA | `Disallow: /api/` dans les 12 blocs → aucun crawler IA ne pouvait lire le canal annoncé par `llms.txt` | `Allow: /api/markdown/` en prod, **verrouillé par 8 tests** | A1 |
| Avis clients | 54 avis, aucun rich snippet | **77 avis réels, moyenne exacte 4,8831** (68×5★ + 9×4★), 77 slugs au sitemap — 8 rapports concordants, zéro contradiction | B6 |
| Sitemaps | 38 sub-sitemaps, ~2 100 URLs, `lastmod` figé au 2026-06-08 sur les 83 URLs de `pages.xml` | 38 sub-sitemaps, **2 603 URLs**, index 200 en 0,36 s, `lastmod` différenciés par famille via fraîcheur git réelle, gating anti-vide opérant, **0 URL `/en/` fuitée** | A2 |

### 🔴 Ce qui a empiré (4 lignes, chiffrées)

| Sujet | Mesure | Source |
|---|---|---|
| **Visibilité Google** | W31 → W33 : position moyenne pondérée **22,2 → 25,5**, clics **19 → 13**, CTR **2,36 % → 0,86 % (÷2,7)**. La home elle-même recule de 3,10 à 6,25 et perd 4 clics | F2 |
| … et ce n'est pas un effet de composition | H3 a testé la contre-hypothèse : sur **cohorte stable** (83 pages communes aux deux semaines), c'est **pire** — 23,19 → 30,17 | H3 |
| **Dilution** | Impressions 805 → 1 515 et pages avec impressions 196 → 268 : le site gagne en surface et perd en efficacité. **50 % des impressions W33 tombent au-delà de la position 20** | F2 |
| **Citation de marque** | 20/07 (Perplexity) : le moteur citait **une** source — `axion-ia.com`. 14/08 (moteur de réponse Claude) : **9 sources, 0 sur le domaine**. ⚠️ Moteurs différents, donc pas une série comparable — mais le sens est le même : le domaine n'est plus la source qui définit l'entreprise | F4 |

À quoi s'ajoute le point Qualiopi, qui n'a pas « empiré » techniquement mais a changé de
statut : au 20/07 c'était un **STOP & ASK** ouvert (« certification obtenue ou en
cours ? ») ; au 15/08 c'est un **fait établi par deux audits indépendants**, dans un
contexte où la mesure F4 montre que c'est précisément le critère de tri des moteurs.

### ⚪ Ce qui n'a pas bougé (7 lignes)

| Sujet | État inchangé | Source |
|---|---|---|
| `sameAs` de l'Organization | **3 entrées**, toujours zéro nœud registre. Wikidata renvoie toujours `"search":[]` | B1 + F5 |
| Google Business Profile | Toujours aucun. Toujours **aucun téléphone public** dans le graphe — le NAP n'a pas de « P ». Le module de citations locales est **100 % inerte (0/10 annuaires)** alors que 8 profils existent réellement | F5 + F6 |
| Presse / mentions tierces | **0 retombée presse** ; 8 mentions, 1 seule dofollow, 100 % d'ancres génériques | F6 |
| Homonyme | AXION FORMATIONS (Saint-Quentin) capte toujours l'intent réputation — et le capte désormais de façon **mesurée** | F4 |
| URL de citation cassée (backtick) | Le défaut signalé le 20/07 est toujours servi, dans le HTML **et** dans le `CreativeWork` JSON-LD | D6 |
| `description` vide sur les BlogPosting | 1 cas signalé en juillet → **126 articles** mesurés aujourd'hui | B3, volume arbitré par H6 |
| `guides.xml` et `glossaire.xml` à 1 URL | Toujours des sub-sitemaps qui ne déclarent que leur hub ; le `lastmod` de `guides.xml` est figé au 2026-06-08 **pour toujours** | A2 + F1 |

**Lecture d'ensemble du delta** : un seul des deux verrous de juillet a sauté (la
résolvabilité au registre). Le second — être corroboré par des tiers — n'a **pas
bougé d'un pouce**, et c'est exactement celui qui décide de la citation.

---

## 3 bis. Ce qui est déjà solide — et qui ne doit pas être « réparé »

Cet audit a trouvé beaucoup de choses bien faites. Les omettre rendrait ce rapport
mensonger, et surtout ferait courir le risque qu'on casse ce qui marche. Quatre
sous-critères sont notés **au-dessus de 87 %** parce qu'on a mesuré qu'ils
fonctionnent, pas parce qu'on n'a rien cherché :

- **Rendu serveur sans JS, zéro cloaking (48/55).** Sur 25 URLs sondées, G2 a trouvé
  h1, h2/h3, corps, réponses FAQ, **les textes des 77 avis**, données de l'observatoire,
  mega-menu et footer **intégralement présents dans le HTML brut** — sans Suspense
  différé, sans `ssr:false` sur du contenu, sans consentement bloquant. Et 15 pages ×
  3 user-agents **octet pour octet identiques**. C'est le socle qui rend tout le reste
  réparable : les crawlers de citation, qui n'exécutent pas de JS, **voient le texte**.
- **Doctrine robots (56/60).** Les 4 fichiers de politique sont byte-identiques au code
  (diff = 0), la doctrine « bloquer l'entraînement / garder la citation » est
  correctement implémentée et **verrouillée par 8 tests**, les invariants `Allow: /api/og`
  et `Allow: /api/markdown/` sont intacts en code **et** en prod (A1). E4 a confirmé de
  l'extérieur que `Disallow: /logos/clients/` est hermétique.
- **Architecture des sitemaps (54/60).** A2 la qualifie de « saine et très au-dessus de
  la moyenne » et l'a prouvée : gating anti-vide opérant, zéro trailing slash, IDs non
  déclarés en 404 propre, zéro URL `/en/` fuitée.
- **Crawlabilité des images (40/45).** La preuve live la plus forte de l'audit : E4 a
  relevé un index-images tiers renvoyant **44 résultats, tous rattachés à axion-ia.com**,
  sans le moindre challenge anti-bot sur `Googlebot-Image`. Les correctifs robots de juin
  ont tenu.

S'y ajoutent : **CLS = 0 sur 8 pages, LCP 756–792 ms, aucune violation axe
serious/critical** (G4, menu mobile ouvert et galerie compris) ; un JSON-LD que B4
qualifie de « socle prod-grade » (QAPage complet, `DefinedTerm`/`DefinedTermSet`,
`Dataset` avec distribution, `BreadcrumbList` systématique, `GeoCoordinates` déjà
présents) ; des prompts content-gen que D2 juge « d'un très bon niveau AEO 2026 » ; un
dispositif pSEO dont D4 écrit qu'il « fonctionne exactement comme il est écrit »
(480 villes indexables, fichier généré parfaitement synchrone, 0 écart).

**Le capital intellectuel est là. C'est son exécution et sa garde qui ne le sont pas.**

---

## 4. Top 10 des découvertes

Classées par ce qu'elles coûtent réellement en visibilité, pas par leur sévérité
formelle.

### 1. 26 % du corpus indexé publie une statistique fabriquée ou un cas client anonyme
`GEO-009` (D2, P0)
**Ce que c'est** : les prompts générateurs interdisent en toutes lettres les statistiques
propriétaires et les cas clients anonymes. Le détecteur de doctrine ne les voit pas, et
26 % des articles indexés en contiennent.
**Ce que ça coûte** : c'est le finding le plus grave de tout l'audit sur le plan de la
citabilité. Un moteur de réponse ne cite pas ce qu'il ne peut pas corroborer ; un chiffre
inventé dans un article est ce qui disqualifie tout le domaine comme source. Facteur
aggravant : ce corpus affirme aussi la certification Qualiopi — on place donc une
revendication invérifiable dans le même document que des chiffres invérifiables.
**Ce que ça coûte de réparer** : le détecteur est un patch de M. Mais **26 % du corpus
doit être réécrit, pas seulement gaté** — et cette remédiation dépend de la recharge
OpenAI. C'est ce qui plafonne le domaine 5 à ~175/250 même plan complet exécuté.

### 2. Le garde-fou de qualité qui devait empêcher ça est écrasé en dur
`GEO-007` + `GEO-008` (D2, arbitrés par H6 contre D3, P0)
**Ce que c'est** : `content-gen-worker.ts:1221` calcule correctement un
`shouldPromoteTier1` qui interdit la promotion d'un soft-404. Ce booléen est transmis…
et jamais lu : `content-publish-worker.ts:618` écrit
`const indexationTier = "tier_1_indexable"` **en dur**.
**Ce que ça coûte** : **40 % du corpus indexé est sous le plancher de longueur de ses
propres générateurs** ; un article de 175 mots est indexé. Et **100 % du corpus KB
publié est sous les seuils de sa propre quality-gate** — 44 mots contre 500 requis,
zéro `<h2>` (D5), ce qui prouve que ces gates n'ont jamais tourné en production.
**Ce que ça coûte de réparer** : le patch est court mais **renverse une décision du
2026-06-17** → STOP & ASK (arbitrage A10 du plan). L'option recommandée n'est d'ailleurs
pas de renverser la décision, mais de faire enfin tourner la jambe d'élagage qu'elle
prévoyait et qui n'a jamais démarré (cause : le kill switch, `GEO-076`).

### 3. 455 pages riches, indexables, et structurellement introuvables
`GEO-014` (D4, P0)
**Ce que c'est** : les 455 pages `/sites-web-augmentes/par-ville/*` sortent
`index, follow`, pèsent ~2 100 mots uniques chacune, et ne sont déclarées dans **aucun
sitemap** ni atteignables par **aucun lien interne** — 0 lien mesuré depuis les hubs
villes et les 5 pages services.
**Ce que ça coûte** : 104 impressions et **0 clic**. C'est la plus grosse perte sèche
mesurée par l'audit : de la valeur produite, indexable, invisible.
**Ce que ça coûte de réparer** : rien techniquement, tout politiquement. Le patch
contredit ta décision du 2026-06-20 de sortir toute la famille `par-ville` des sitemaps
(inscrite en code, `sitemap.ts:401-412`). C'est binaire : on ouvre (sitemap + maillage)
ou on referme (`noindex` comme les 4 familles sœurs). Aujourd'hui elles sont indexables
**et** indécouvrables, ce qui est la seule position qui ne se défend pas.

### 4. Le service phare est absent de la SERP pendant que les pages villes captent tout
`GEO-019` + `GEO-018` (F3, P0)
**Ce que c'est** : `/fr/audit` — la page du service principal — enregistre
**1 impression par semaine** pendant que 117 pages villes en captent 481. Et le top 10
est atteint sur 119 pages, mais sur des requêtes sans demande : **26 pages en top 3 →
60 impressions → 2 clics**.
**Ce que ça coûte** : le trafic organique ne touche pas l'offre. C'est le symptôme
central du drainage mesuré par F2.
**Ce que ça coûte de réparer** : ce n'est pas patchable directement. C'est un
**diagnostic** qui se récupère par les patches des domaines 1, 2, 5 et 6 — avec 6 à
12 semaines de latence de crawl.

### 5. Les identifiants légaux disparaissent des pages statiques
`GEO-003` (B1, P0, corrélation établie par H1)
**Ce que c'est** : `vatID` et `identifier` SIRET sont **absents en permanence** du nœud
`#organization` de toutes les pages 100 % statiques — dont les 480 hubs villes
indexables. H1 a établi la corrélation parfaite sur 8 URLs, même build, à T+5 h 30 :
page ISR ⇒ `vatID` présent ; page statique ⇒ `vatID` absent.
**Ce que ça coûte** : le nœud entité est ce qu'un moteur génératif recoupe avec les
registres. Tu viens de gagner la résolvabilité au registre (le grand acquis du mois) et
elle n'est pas portée dans le HTML servi sur la majorité des pages.
**Ce que ça coûte de réparer** : M, via des build-args `COMPANY_*` (ADR requis, l'image
GHCR étant publique). ⚠️ **Ordre imposé** : ce patch conditionne celui de `llms.txt`
(`GEO-109`) — les routes `llms` sont `runtime = "edge"` et écrire le SIREN en dur
rougit `check-anti-siren.sh`.

### 6. Des liens internes morts sur deux corpus entiers
`GEO-012` + `GEO-013` (C4, P0)
**Ce que c'est** : ~48 % des articles de blog échantillonnés portent un lien in-body vers
`/implementations` qui atterrit en **404** — alors que le prompt générateur v7-phase8
**impose** ce lien. Et le silo FAQ (87 fiches, la surface de citation LLM n°1 du site)
a ses CTA hub ↔ thématiques rendus en `/fr/fr/*` → **404**.
**Ce que ça coûte** : des signaux de qualité négatifs bruts servis aux crawlers, sur les
deux corpus les plus citables du site.
**Ce que ça coûte de réparer** : **deux patches courts qui rendent 30 points à eux
seuls** — le meilleur rapport effort/impact de tout l'audit. Lot 3, quelques heures.
Seul point de vigilance : la règle de redirect ne doit pas capturer `/implantations`.

### 7. Après chaque déploiement, la prod sert une version amputée aux moteurs
`GEO-023` + `GEO-024` (fusion de 8 findings indépendants, P0)
**Ce que c'est** : les pages ISR qui lisent la base sont absentes des deux listes du job
`warm`. Résultat : après **chaque** atterrissage (plusieurs par jour), la home est
resservie sans `AggregateRating` ni bloc avis, et `/fr/mentions-legales` — la page que
Google et les LLM recoupent avec SIRENE — affiche « communiqué sur demande » six fois.
H6 a corrigé le mécanisme : le cache Cloudflare est **par PoP**, le warmer lancé depuis
un runner GitHub ne chauffe pas le PoP que voient les visiteurs français ; ce qui fige
la version amputée est **le premier crawler de chaque PoP**. Et `lhci`, `indexnow` et
`warm` ont tous les trois `needs: deploy` : **on pingue les moteurs pendant la fenêtre
stub**.
**Ce que ça coûte** : on notifie activement les moteurs d'aller voir une version du site
où l'identité légale et la preuve sociale ont disparu.
**Ce que ça coûte de réparer** : **~1 h, trois fichiers, aucune ligne applicative.**
C'est le lot 1 + lot 2. Huit agents indépendants ont prescrit le même patch.

### 8. Aucune garde ne garde quoi que ce soit
`GEO-025`, `GEO-026`, `GEO-062`, `GEO-087` (G1, H5, D4, P0/P1)
**Ce que c'est** : les deux gates de budget annoncées « bloquantes » dans `AGENTS.md`
sont en `continue-on-error` — et `size-limit` cible **3 buckets `/reserver` morts**
(page supprimée le 2026-06-26) sans **aucun** bucket `/appel`. La checklist des 60 items
SEO/AEO, dont 22 marqués `[BLOQUANT]`, a pour unique exécutant un **stub de 195 octets**
(`console.warn("[seo:audit] stub")`), absent de tous les workflows. La garde anti-doorway
mesure les **fichiers copy** au lieu du rendu et n'est branchée à aucune CI.
**Ce que ça coûte** : le First Load JS est à **240 KB gz sur 100 % des routes** — ×3,2
le budget de 75 KB — sans que rien ne rougisse. Et plus grave : **tant que c'est vrai,
la notation de risque des 44 autres patches est sans valeur**, puisque aucun patch qui
alourdit le bundle ne sera détecté.
**Ce que ça coûte de réparer** : le volet « vérité des gates » est **S, à faire en
premier de tout le plan** (lot 1). Le volet « ramener 240 KB à 75 KB » est un chantier
à part (lot 23, risque élevé, ADR).

### 9. Les canaux d'ingestion IA servent du code source aux moteurs
`GEO-002`, `GEO-038`, `GEO-039`, `GEO-040`, `GEO-041` (A5, F1, D5, P0/P1)
**Ce que c'est** : `llms-full.txt` — le fichier que tu tends toi-même aux moteurs —
sert **26 tokens `{{price:…}}` bruts** non résolus (défaut stable, mesuré sur deux builds
différents) ; le feed FAQ en sert **70**, sur 1 550 items et 1,1 Mo **sans aucun
`pubDate`** ; deux types annoncés en `<link rel="alternate">` répondent **404** ;
`/api/markdown/cas-concrets/*` répond **200 avec un corps vide** (pire qu'un 404) ; et
la base de connaissances — **507 fiches citables** — est totalement absente de `llms.txt`.
**Ce que ça coûte** : c'est le canal AEO natif, celui que les moteurs génératifs
ingèrent directement sans passer par le rendu. On y sert du gabarit non résolu.
**Ce que ça coûte de réparer** : lot 4, ~6 h, risque faible. Ajouter la KB à `llms.txt`
est **une ligne statique** — le meilleur rapport effort/impact de la squad D.

### 10. 2,7 Mo de PNG purement décoratifs sur chaque page d'article
`GEO-027` + `GEO-028` (G4, pesés)
**Ce que c'est** : le logo Qualiopi est un PNG de **1 304 554 octets** servi brut sur
100 % des pages et affiché en 210 px ; l'avatar auteur est un PNG de **1 513 427 octets**
affiché en 64 × 64 sur toutes les pages éditoriales.
**Ce que ça coûte** : une taxe fixe sur le budget de crawl et sur chaque visite mobile.
Elle s'ajoute au fait que ~90 % du poids de chaque document est déjà de la charge
non-contenu : **920 650 octets de CSS sérialisés 4 fois** dans le HTML brut, le `<body>`
ne commençant qu'au **239ᵉ Ko** (G2, 3 corroborations indépendantes).
**Ce que ça coûte de réparer** : S. ⚠️ **Vérifie d'abord** si la garde retire le logo
Qualiopi quand le drapeau retombe : si oui, ce poids-là disparaît gratuitement et
l'optimiser serait du travail perdu (le lot 6 est construit pour rester utile dans les
deux cas).

---

## 5. Top 5 quick wins

Fort impact, effort faible, risque faible. Renvois aux lots de `01-PLAN-PATCHES.md`.

| # | Lot | Ce que ça règle | Effort | Risque |
|---|---|---|---|---|
| 1 | **LOT 1** — chauffe post-déploiement + vérité des gates | La prod cesse de servir une version amputée après chaque deploy (`GEO-023`), et les gates cessent de mentir (`GEO-025`) | **~1 h**, 3 fichiers, 0 ligne applicative | faible — H4 a vérifié plutôt que supposé |
| 2 | **LOT 3** — liens internes morts | Le silo FAQ (87 fiches) et ~la moitié du corpus blog cessent d'envoyer les crawlers en 404 (`GEO-012`, `GEO-013`, + 3 autres) | ~3 h | faible |
| 3 | **LOT 4** — canaux d'ingestion IA | Plus de tokens `{{price}}` bruts, plus de 404 sur les alternates, et les 507 fiches KB entrent enfin dans `llms.txt` | ~6 h | faible |
| 4 | **LOT 5** — hreflang, canonical, double marque | Supprime un cluster hreflang invalide servi **à chaque requête sur toutes les pages** (`GEO-005`, seul P0 d'un domaine par ailleurs bon : 158/250) | ~2 h | faible-moyen |
| 5 | **LOT 6** — poids mort du rendu | Retire 2,7 Mo de PNG décoratifs par page d'article | ~2 h | faible |

**Deux notes d'ordonnancement qui comptent** :
- Les lots 1 et 2 touchent **le même fichier YAML** : si tu veux les deux, fais **une
  seule PR à deux commits**. Deux PR concurrentes se conflictent à coup sûr.
- Le lot 1 doit être posé **avant tout le reste**, pour la raison donnée au point 8 du
  top 10 : sans lui, la notation de risque de tous les autres patches repose sur une
  fausse sécurité.

**Le sixième quick win n'est pas un patch** : la **vague 1 de `03-RESTE-WILL.md`** —
9 actions, **2 h 12 au total, entièrement gratuit** — corrige LinkedIn, Crunchbase, F6S
et Les Pépites Tech. C'est ce qui remet ton entité d'accord avec elle-même sur les trois
sources que les moteurs lisent aujourd'hui à ta place. ⚠️ **L'ordre est contraignant** :
corriger les fiches **avant** qu'un patch les déclare en `sameAs` — les déclarer d'abord
reviendrait à signer toi-même l'erreur « Paris » qu'on cherche à supprimer.

---

## 6. Ce qu'on ne sait toujours pas

Les angles morts, pour que tu saches ce qui n'a **pas** été vérifié.

**Sur les moteurs de réponse — la limite la plus importante du rapport.**
**Un seul moteur a été interrogé** (moteur de réponse Claude + backend de recherche).
Perplexity, ChatGPT Search et Gemini n'ont pas pu l'être : interfaces bloquées au fetch,
outils navigateur réservés à la session principale, aucun crédit API mobilisable. Le
**mécanisme** (les moteurs synthétisent des sources tierces plutôt que le site) est
général ; les **classements précis** de `GEO-020`, `GEO-107` et `GEO-108` ne sont pas
transposables tels quels. Note aussi que la comparaison avec juillet porte sur deux
moteurs différents (Perplexity en juillet, Claude en août).

**Sur ce que les moteurs lisent à ton sujet.**
Trois fiches tierces n'ont pas pu être lues : **Crunchbase (403)**, **F6S (bot-wall)**,
et les registres légaux rendus côté client. Or Crunchbase et F6S sont **les deux
premières sources** du moteur sur la requête de marque. Ce qu'elles affichent réellement
reste `[À CONFIRMER]` — c'est la toute première chose à constater. De même, **aucun
Google Business Profile n'a pu être interrogé** : la conclusion « aucun GBP » repose sur
une convergence d'indices, pas sur une requête Places.

**Sur qui crawle réellement le site.**
**Il n'existe aucun access log HTTP nulle part** (`GEO-154`, F7 — statut incertain mais
fortement corroboré côté code). Les CSV hebdomadaires nommés « crawl-stats » ne
contiennent **pas** de crawl stats — ce sont des données Search Analytics, si bien que le
gate « crawl budget < 30 % » n'a **jamais été mesuré une seule fois**. Conséquence : tout
ce que ce rapport dit du budget de crawl est du raisonnement, pas de l'observation. En
particulier, l'attribution des bumps de `lastmod` aux bots (`GEO-035`/`036`) reste à
confirmer par **une requête SQL de 5 secondes**, prescrite dans H6 et à passer avant tout
patch.

**Sur Bing.**
Angle mort total : le client Bing Webmaster existe mais ses 3 fonctions n'ont **aucun
consommateur**, et la fonction de soumission n'est même pas écrite. On ne dispose
d'aucune donnée sur la présence Bing du site — ni pour la mesurer, ni pour l'infirmer.

**Sur les volumes.**
Plusieurs comptages sont restés `[À CONFIRMER]` faute d'accès base : le nombre d'images
touchées par l'écrasement des `alt` (**133 ou 288**, non tranché), les 75 vignettes en
404, les 78 dimensions fausses, l'historique des slugs KB, et les taux de corpus de D2 et
D4. Ils peuvent faire bouger l'**effort** des lots 18 et 22, pas leur ordre.

**Sur ce qui n'a été testé qu'en échantillon.**
La hiérarchie des titres et la conformité WCAG ont été mesurées sur **5 pages** — personne
sur les 480 villes déclarées ni sur les 126 articles. Un crawl complet était hors
périmètre (machine partagée, nuit). Les asymétries `article:*` et `<time datetime>` ont
une preuve **structurelle** (code) généralisable, mais une preuve live sur un seul
article.

**Sur un producteur jamais audité.**
`content-qa-extract-worker` — celui qui dérive les Q/R, c'est-à-dire la surface `QAPage`,
cœur de l'AEO — n'est cité par aucun des 43 rapports. B4 a audité le **schéma produit**,
personne n'a audité le **producteur**. Le diagnostiquer demande la base prod.

**Sur la méthode elle-même.**
**Aucune commande n'a été exécutée** : ni build, ni test, ni Lighthouse, ni requête base,
ni soumission d'URL (GET/HEAD uniquement). Toutes les affirmations du type « ce test
rougirait » sont des **lectures** de fichiers de test faites par H4, jamais des
exécutions. Les efforts S/M/L sont des estimations, pas des mesures. Et l'événement de
redémarrage hors pipeline du 18:49:06 qui a motivé `GEO-001` reste `[À CONFIRMER]` — seul
le **mécanisme** est prouvé.

**Enfin, le fait Qualiopi n'a pas été re-vérifié par cet audit-ci.** Il est transmis
comme établi par l'audit dédié du 2026-08-15, et n'a été **croisé** ici qu'avec les
findings F5, F4 et B1, qui sont eux confirmés dans ce périmètre. L'action corrective et
ses suites relèvent de cet audit-là.

---

## En une phrase, pour finir

Le site a cessé d'être introuvable au registre ; il n'a pas commencé à être confirmé par
qui que ce soit d'autre — et il affirme, sur le seul attribut qui déciderait de sa
citation, quelque chose que le registre contredit. **Répare d'abord ce que tu dis de toi
ailleurs (2 h 12, gratuit), puis ce que le site sert aux moteurs (2,5 jours). Le reste
peut attendre — et une partie du reste ne s'achète pas en code.**
