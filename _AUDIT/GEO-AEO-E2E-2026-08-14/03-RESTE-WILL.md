# 03 — RESTE WILL : les actions que le code ne peut pas faire à ta place

- **Agent** : S3 (squad S — synthèse), 2026-08-15.
- **Sources** : liste canonique H6 (155 findings, GEO-001 → GEO-155), verdicts
  H1/H2/H3, analyse de risque H4, complétude H5, et les rapports d'origine —
  principalement **F4** (moteurs IA), **F5** (entité vérifiable), **F6** (backlinks
  et mentions tierces), plus B1, F2, F3, G3, A2, B5, H5.
- **Règle appliquée** : je ne liste **que du NOUVEAU**. Aucun « reste Will » déjà
  acté n'est répété (vidéo VSL, relecture avocat des CGV, tri des candidatures,
  ticket Bing UCM000007450870, adhésion au médiateur, recharge OpenAI / kill
  switch). Aucun finding réfuté par H1/H2/H3 n'est repris.
- **Ce document ne contient aucune action Qualiopi** — voir l'encadré ci-dessous.

---

## Ce que cette liste sert à réparer, en une phrase

Le site est techniquement bavard et l'entité est enfin résolvable au registre
(SIREN 108018631, AXION IA, Grenoble, dirigeant Jullin Williams — F5 l'a vérifié le
14/08 à 19:11 UTC, contre « aucune structure trouvée » le 20/07). **Mais les moteurs
de réponse ne parlent pas du site : ils parlent des fiches des autres.** Sur la
requête de marque « Qui est Axion-IA ? », F4 a mesuré 9 liens sources, **0 sur
axion-ia.com** — Crunchbase en #1, F6S en #2, puis sept homonymes américains. Sur
les deux requêtes commerciales testées, **0 mention**. Sur l'intent « avis », c'est
l'homonyme **Axion Formations (Saint-Quentin)** qui capte la réputation, avec ses
avis mitigés.

Aucune ligne de code ne corrige ça. Les patches de S2 remettront le site en état de
parler ; les 18 actions ci-dessous sont ce qui décide si **quelqu'un d'autre que toi
confirme ce que le site raconte**. C'est précisément ce qui manque à un moteur de
réponse pour oser te citer.

---

## 🔴 Encadré Qualiopi — aucune action ici, et pourquoi

Un audit blanc Qualiopi mené en parallèle (30 agents, 2026-08-15) a conclu que la
plateforme est non certifiable en l'état et que la production affirme partout une
certification jamais délivrée ; tu as déjà identifié la correction (drapeau
`QUALIOPI_CERTIFICATION_OBTENUE` à `false` côté Coolify + restart). **C'est acté
ailleurs, je ne le re-liste pas.**

Ce que cet audit-ci apporte, c'est la **confirmation par une voie totalement
indépendante** : F5 a interrogé le registre public le 14/08 à 19:11 UTC —
`est_organisme_formation = false`, `est_qualiopi = false`,
`liste_id_organisme_formation = null` ; aucun NDA publié nulle part sur le site ; et
le seul « Axion » vérifiablement Qualiopi est **AXION FORMATIONS**, Saint-Quentin,
NDA 22020045002 (`est_qualiopi = true`). C'est un **facteur aggravant majeur** du
déficit d'existence, pas un détail de conformité : F4 a mesuré que le critère de tri
des listicles qui captent « organisme formation IA Grenoble » est *précisément*
Qualiopi. Une affirmation qu'un moteur ne peut corroborer nulle part est une
affirmation qu'il ne reprendra jamais à son compte — et pire, elle l'envoie vers
l'homonyme qui, lui, est au registre.

**Conséquence opérationnelle sur cette liste** : trois actions ci-dessous portent un
champ « organisme de formation / Qualiopi » (LinkedIn, Google Business Profile,
Crunchbase). **Laisse ce champ vide** tant que l'audit dédié n'a pas tranché.
Renseigner un statut non corroborable sur une fiche tierce est exactement le geste
qui grave l'erreur là où tu ne pourras plus la reprendre.

---

## L'ordre compte — la chaîne de dépendances

H4 (§ C-4) impose une séquence, et l'inverser aggrave le problème au lieu de le
résoudre :

```
① Corriger les fiches tierces (LinkedIn, Pépites Tech, Crunchbase, F6S)
        ↓  ← elles disent aujourd'hui « Paris » et « 2025 »
② Patch code : les déclarer en sameAs de l'Organization   [S2, PAS toi]
        ↓
③ Ligne téléphonique → Google Business Profile → Bing Places → PagesJaunes
        ↓
④ Inclusion dans des comparatifs tiers + presse locale
        ↓
⑤ Wikidata — EN DERNIER, jamais avant
```

**Pourquoi ① avant ②** : la fiche Les Pépites Tech affiche « 138 Avenue des
Champs-Élysées 75008 PARIS » et la page LinkedIn « Paris, France / Founded 2025 »
(F6, mesuré 19:19 et 19:15 UTC). Déclarer ces URL en `sameAs` **avant** de les
corriger revient à signer toi-même l'erreur d'entité que tout le reste de l'audit
cherche à supprimer. H4 le classe explicitement « remède pire que le mal si l'ordre
est inversé ».

**Pourquoi ⑤ en dernier** : Wikidata exige des sources secondaires indépendantes. Au
14/08, F6 mesure **0 retombée presse** et LinkedIn affiche **7 abonnés**. Un item
créé aujourd'hui a une forte probabilité d'être supprimé pour défaut de notoriété —
et une suppression laisse une trace qui rend la seconde tentative plus difficile.

---

# VAGUE 1 — gratuit, moins de 2 h en tout, impact fort

Ces neuf actions sont classées par (impact ÷ effort) décroissant. Elles ne dépendent
de rien et peuvent être faites dans la foulée.

---

### R-01 · Corriger la page LinkedIn entreprise ⏱ 15 min · gratuit · impact **fort**

`GEO-110` (F5-P1-1, confirmé par re-fetch indépendant de H3 et par F6)

**Où** : `linkedin.com/company/axion-ia-france` → *Admin tools* → *Edit page*.

**Ce qui est faux aujourd'hui** (mesuré par F5 le 14/08 à 19:12:44 UTC, re-vérifié
par F6 à 19:15:10) :

| Champ LinkedIn | Valeur affichée | Vérité registre |
|---|---|---|
| Headquarters / Location | **Paris, FR** | Grenoble (38100) |
| Founded | **2025** | 2026 (immatriculation 01/09/2026) |
| Nom | **Axion-IA.com** | AXION IA SAS / « Axion-IA » |

**Quoi écrire** :
- *Name* : `Axion-IA` (ou `AXION IA SAS`).
- *Headquarters* et *Locations → Primary* : `11 Avenue Paul Verlaine, 38100
  Grenoble, Auvergne-Rhône-Alpes, France`.
- *Founded* : `2026`.
- *Website* : `https://axion-ia.com/fr` — **pas** `www.axion-ia.com` (F6 a mesuré que
  `www` fait deux 301 en cascade avant d'atterrir).
- *Description* : recopie le positionnement SSOT (`src/lib/brand.ts`). ⚠️ ne
  reprends **pas** la formule d'Indie Hackers « résultat concret » : les CGV sont une
  obligation de moyens (décision actée n°8).
- Champ organisme de formation / Qualiopi : **laisser vide** (voir encadré).

**🚫 Ne touche pas au slug de l'URL** (`company/axion-ia-france`) : il est déclaré en
`sameAs` dans `src/lib/seo.ts:908`, le renommer casserait la corroboration.

**Pourquoi c'est le n°1** : F5 démontre que cette page est **la racine** du « siège à
Paris » que Perplexity affirmait dès le 20/07 et que personne n'avait su expliquer.
Le registre dit Grenoble, le code dit Grenoble — c'est la seule source tierce à
autorité que le site désigne lui-même comme référence d'identité qui dit Paris. Tant
qu'elle le dit, les moteurs ont un conflit à arbitrer sur l'attribut le plus utilisé
pour la désambiguïsation locale.

---

### R-02 · Réclamer et corriger Crunchbase, puis F6S ⏱ 45 min · gratuit · impact **fort**

`GEO-020` (F4-P0) et `GEO-045` (F6-P1-4)

**Où** : `crunchbase.com/organization/axion-ia` → bouton *Claim this profile*
(gratuit ; l'abonnement Pro n'est **pas** nécessaire pour revendiquer et éditer).
Puis `f6s.com/member/axion-ia`.

**Pourquoi c'est aussi haut** : F4 a mesuré que sur « Qui est Axion-IA ? », le moteur
de réponse cite **Crunchbase en source #1 et F6S en #2**, et zéro fois axion-ia.com.
Ce sont littéralement les deux pages qui *définissent* ton entreprise pour les
moteurs de réponse aujourd'hui. Contre-épreuve de F4 (18:36:55 UTC) : le domaine
**est** bien indexé — 9 pages du site remontent sur une recherche restreinte. Ce
n'est donc pas un problème d'indexation, c'est un problème d'autorité d'entité.

**Première chose à faire : LIRE.** L'audit n'a **pas pu** voir le contenu de ces deux
fiches (Crunchbase répond 403 aux robots, F6S a un bot-wall — limites explicites de
F4 et F6). Tu es le seul à pouvoir constater ce qu'elles disent réellement. Note ce
que tu y trouves : c'est probablement la seconde source du « Paris », à côté de
LinkedIn.

**Quoi corriger, sur les deux** : siège Grenoble, année 2026, fondateur
**Williams** Jullin (avec un « s »), site `https://axion-ia.com/fr`, description
alignée sur le SSOT. Champ Qualiopi : vide.

**Dépendance aval** : ne demande pas à S2 d'ajouter ces URL en `sameAs` avant d'avoir
fait cette correction.

---

### R-03 · Corriger la fiche Les Pépites Tech ⏱ 20 min · gratuit · impact **fort**

`GEO-112` (F6-P1-3, re-fetch indépendant confirmé)

**Où** : `lespepitestech.com/startup-de-la-french-tech/axion-ia` (fiche ajoutée le
30/05/2026). Édition via le compte propriétaire, sinon par le formulaire de contact
du site.

**Ce qui est faux** (mesuré 19:19:02 UTC) : adresse « 138 Avenue des Champs-Élysées
75008 PARIS », rattachement au hub « **French Tech Grand Paris** », fondateur
orthographié « **William** Jullin ».

**Quoi écrire** : adresse Grenoble, rattachement **French Tech in the Alps**,
« Williams Jullin », et le lien vers `https://axion-ia.com/fr` — aujourd'hui la fiche
pointe `https://www.axion-ia.com?utm_source=LesPepitesTech.com`, ce qui déclenche
deux redirections avant la page finale.

**Détail qui compte** : c'est le **seul lien potentiellement dofollow** de tout le
profil de liens entrants (F6 a mesuré 8 mentions tierces, dont une seule sans
`rel="nofollow"`). Profite de l'édition pour demander une ancre de marque —
« Axion-IA » ou « cabinet IA Axion-IA » — plutôt que le « Visiter leur site »
générique actuel. F6 a relevé que **100 % des ancres entrantes sont génériques** :
aucun lien ne transmet de contexte sémantique.

---

### R-04 · Créer le QR `podcast` en console admin ⏱ 2 min · gratuit · impact acquisition

`GEO-144` (H5-6.4, confirmé live avec contrôle négatif)

**Où** : console admin → QR codes → nouveau. Slug `podcast`, destination
`https://axion-ia.com/fr/podcast`.

**Le fait** : `https://axion-ia.com/qr/podcast` répond **404** (mesuré 02:09 UTC,
35 octets, réponse identique à celle d'un slug inventé — donc l'enregistrement
`QrLink` n'existe pas ou est désactivé). Or deux fichiers du code documentent ce QR
comme la cible du **flyer papier** (`src/i18n/routing.ts:213` et
`src/app/[locale]/podcast/page.tsx:5`).

**Honnêteté sur l'impact** : l'impact GEO est **nul**. Je le place ici parce que le
rapport impact/effort est imbattable et parce que chaque flyer déjà distribué envoie
un prospect sur une page d'erreur. **À faire avant toute nouvelle impression.**

---

### R-05 · Régénérer le jeton OAuth Search Console avec le scope *write* ⏱ 15 min · gratuit · impact **moyen-fort**

`GEO-104` (F2-P1-1)

**Le fait** : le workflow hebdomadaire de soumission du sitemap principal échoue
depuis le 22/06 — **0 succès sur les 40 derniers runs**, log explicite
`HTTP 403 : Request had insufficient authentication scopes`. Le secret
`GSC_OAUTH_REFRESH_TOKEN` a été généré avec le scope `webmasters.readonly` : suffisant
pour l'export de performances (qui, lui, marche), insuffisant pour soumettre. Les
sitemaps images n'ont, eux, jamais été soumis depuis 3 échecs le 20/05.

**Où et quoi faire** — le workflow de remédiation est déjà écrit, il n'a jamais été
mené à terme parce qu'il exige une visite humaine d'une URL Google :

1. GitHub → *Actions* → `gsc-oauth-refresh-write.yml` → *Run workflow*, mode
   `generate`.
2. Ouvrir l'URL Google affichée dans les logs, autoriser, copier le code.
3. Relancer le même workflow en mode `exchange` avec le code.
4. Déclencher manuellement `gsc-submit-main-sitemap.yml` puis
   `gsc-submit-image-sitemaps.yml`, et **vérifier deux runs verts**.

Le scope write inclut le read : l'export hebdomadaire continuera de fonctionner.

---

### R-06 · Régler la Cache Rule Cloudflare sur les `.xml` ⏱ 10 min · gratuit · impact **moyen**

`GEO-119` (G3-P1-2 + F1-P2)

**Le fait** : Cloudflare réécrit le `max-age` des sitemaps (300 → 3600) et **ignore
le `s-maxage=600`** de l'origine. G3 a mesuré un `Age` de 2702 → 3429 s sur
`sitemap-index.xml` alors que le code demande 600 s : l'edge dépasse d'un facteur 5
la fraîcheur demandée, sur les 13 `/sitemap/*.xml` comme sur les 10 sous-sitemaps
custom. Résultat : ~50 min de latence de découverte supplémentaire par publication.

**Où** : console Cloudflare → *Rules* → *Cache Rules*, règle couvrant
`http.request.uri.path contains ".xml"`.

**Quoi régler** — ⚠️ H6 et H4 nuancent la prescription d'origine de G3 : **ne mets
pas « Respect origin » à l'aveugle**, le coût origine n'a été chiffré par personne.
Pose un **Edge TTL explicite de 600 s** (et Browser TTL « Respect origin »). C'est le
même résultat côté fraîcheur, avec un plancher connu côté charge.

**Quand ça compte vraiment** : aujourd'hui l'effet est atténué parce que la
production de contenu est à l'arrêt. Il redevient significatif **dès la reprise** —
c'est-à-dire exactement au moment du lancement.

---

### R-07 · Générer la clé API Bing Webmaster Tools ⏱ 10 min · gratuit · impact **moyen-fort** (différé)

`GEO-106` (F2-P1-2)

**Où** : Bing Webmaster Tools (compte déjà existant) → *Settings* → *API access* →
générer une clé. La poser en **secret GitHub** `BING_WMT_API_KEY`.

**Pourquoi** : Bing nourrit Copilot et le grounding de ChatGPT Search. Aujourd'hui
c'est un pilier GEO **sans aucun instrument de mesure** : le client API existe dans
le code (`bing-wmt-client.ts`) mais ses trois fonctions de lecture n'ont **aucun
appelant**, et la clé est vide. On pilote à l'aveugle.

**Honnêteté** : poser la clé seule ne produit rien — il faut le patch qui branche
l'export (S2, ~60 lignes greffées sur le workflow hebdomadaire existant). Fais la
clé maintenant pour que le patch n'attende pas.

**⚠️ Sans rapport avec le ticket UCM000007450870**, qui reste ton dossier acté chez
Microsoft. Ici il s'agit uniquement d'une clé de lecture d'API.

---

### R-08 · Demander l'ajout d'un lien sur JaimeLesStartups ⏱ 10 min · gratuit · impact **faible-moyen**

F6-P2-2

**Le fait** : `jaimelesstartups.fr/annonce-cofondateur/axion-ia/` (publié le
30/06/2026, HTTP 200 le 14/08 à 19:18) décrit Axion-IA **sans aucun lien cliquable**
vers le site. Une mention nue vaut comme signal d'entité pour un LLM, zéro pour le
crawl.

**Quoi faire** : mail à la rédaction, en demandant un lien vers
`https://axion-ia.com/fr` avec l'ancre « Axion-IA ». Sur un profil de 8 mentions
seulement, chacune compte.

---

### R-09 · Rectifier ton `AGENTS.md` global ⏱ 5 min · gratuit · impact indirect

`GEO-025` / arbitrage C-05 de H6

**Le fait** : `C:\Users\willi\AGENTS.md` (et le prompt maître de cet audit) portent
encore l'exception de budget Web Vitals sur **`/reserver`** — une page **supprimée le
2026-06-26** et redirigée en 301 vers `/appel` (`next.config.ts:280-289`). Le
`AGENTS.md` du dépôt, lui, est à jour et porte `/appel`.

**Quoi faire** : dans `C:\Users\willi\AGENTS.md`, remplacer la ligne d'exception
`/reserver` par celle du dépôt (`/appel` → INP ≤ 150 ms, First Load ≤ 110 KB gz).

**Pourquoi ça mérite 5 minutes** : tout agent futur (dont moi) raisonne sur ce
fichier. Il fait aujourd'hui arbitrer des budgets sur une page qui n'existe plus,
pendant que `/appel`, qui devrait avoir droit à 110 KB, est mesurée contre le seuil
de 75 KB. Le versant code (les 3 buckets `size-limit` morts) est dans le plan S2.

---

# VAGUE 2 — le NAP local : un téléphone, puis trois fiches

Cette vague est bloquée par un préalable unique : **il n'existe aucun numéro de
téléphone public**. F5 l'a vérifié le 14/08 à 19:15:06 — sur `/fr/contact` : zéro
`telephone` en JSON-LD, zéro lien `tel:`, zéro motif de numéro français ; seulement
deux adresses e-mail. Le NAP (*Name, Address, Phone*) n'a pas de « P », et sans « P »
la triangulation locale est structurellement impossible : Google Business Profile,
Bing Places et PagesJaunes exigent tous les trois un numéro.

---

### R-10 · Ouvrir une ligne professionnelle et poser `COMPANY_PHONE` ⏱ 1 h + 5 min · **payant** (~5-15 €/mois) · impact **fort** (débloquant)

`GEO-055` (F5-P1-3)

**Quoi** : un numéro dédié (fixe géographique 04 grenoblois de préférence, ou VoIP —
peu importe la technologie, ce qui compte est qu'il soit stable et te soit
rattachable).

**Puis** : Coolify → *Application* → *Env vars* → nouvelle variable `COMPANY_PHONE`,
scope RUN → restart. Le code est déjà prêt : `src/lib/seo.ts:952` émet
`telephone` dans le nœud `#organization` dès que la variable est renseignée, et
`src/env.ts:255` la déclare optionnelle. Rien d'autre à faire.

**C'est la seule action payante de la liste.** Elle débloque R-11, R-12 et R-13.

---

### R-11 · Créer le Google Business Profile ⏱ 30 min + 5-14 j de vérification · gratuit · impact **fort**

`GEO-046` / `GEO-055` (B1-P1-2 + F6-P1-2, fusionnés)

**Où** : `business.google.com` → créer un profil.

**Configuration impérative — *Service Area Business*** : coche « je livre des
biens/services à mes clients » et **masque l'adresse du siège**. Deux raisons : (a)
le siège est une domiciliation en centre d'affaires (ELITE BUREAUX - boîte 53), et
F5 signale explicitement un **risque de refus** si l'adresse est affichée comme un
établissement recevant du public ; (b) c'est cohérent avec le pattern déjà retenu
dans le code (`buildLocalBusinessJsonLd`, décision du 2026-05-23 : pas de faux bureau
par ville).

**NAP à recopier à l'identique du Kbis** : `AXION IA SAS` — 11 Avenue Paul Verlaine,
ELITE BUREAUX - boîte 53, 38100 Grenoble — téléphone R-10.

**Zone de service** : Grenoble + Isère + Auvergne-Rhône-Alpes.

**Catégorie** : « Consultant en informatique » ou « Cabinet de conseil ». ⚠️ **Ne
choisis pas « Centre de formation » / « Organisme de formation »** tant que l'audit
Qualiopi n'a pas tranché.

**Pourquoi c'est le levier n°1 du local** : B1 et F5 le disent tous deux, et F5 a
mesuré côté Bing (`"Axion-IA" Grenoble avis`, 19:15 UTC) **aucune fiche
d'établissement, aucune map card, aucun knowledge panel** — et 100 % d'homonymes en
page 1 (action.com, axion.shop, axion-france.com, l'axion de Wikipédia…).

**Réserve d'honnêteté** : F5 n'a pas pu interroger Google Places directement (pas
d'outil navigateur, POST interdit). La conclusion « aucun GBP » repose sur une
convergence d'indices, pas sur une requête Places. Si une fiche existe déjà, l'action
devient « la réclamer et corriger son NAP » — même bénéfice.

---

### R-12 · Bing Places ⏱ 10 min · gratuit · impact **moyen**

À faire **après** R-11 : Bing Places propose un import direct depuis Google Business
Profile, ce qui divise le temps par trois et garantit un NAP identique entre les
deux — la cohérence stricte entre citations est précisément ce que les moteurs
recoupent. Rappel : Bing est le socle de grounding de Copilot et de ChatGPT Search.

---

### R-13 · PagesJaunes ⏱ 20 min · gratuit · impact **moyen-faible**

Inscription gratuite. PagesJaunes est le premier des 10 annuaires du catalogue
`local-citations.ts` du code (aujourd'hui à `listingUrl: null`, comme les neuf
autres) et il reste une source de corroboration NAP lue en France.

**Une fois R-11 à R-13 faites** : transmets les URL des trois fiches à S2 — le patch
`local-citations.ts` (renseigner les `listingUrl` + injecter
`buildLocalBusinessSameAsFR()`) attend ces valeurs. Aujourd'hui la fonction de
couverture retourne « 0 sur 10 », un chiffre que F6 qualifie de **faux par
omission** : elle ignore les 8 profils qui existent réellement.

---

# VAGUE 3 — les chantiers longs, par ordre d'attaque

Ceux-là se comptent en semaines, pas en minutes. Ils sont classés dans l'ordre où ils
doivent être menés, pas par ratio.

---

### R-14 · Entrer dans 3 à 5 comparatifs tiers qui rankent ⏱ plusieurs semaines · gratuit à payant · impact **fort**

`GEO-107` (F4-P1-1, reproduit par H3)

**Le mécanisme, mesuré** : sur « meilleur organisme formation IA pour PME à
Grenoble », le moteur de réponse cite Arkavia, Almera, Proxiformation, IAvenir,
Mister IA, DataScientest. Sur « audit IA entreprise France recommandations » :
Jaydai, Mookay, Mister IA, eleven-labs, entreprise-ia.com. **Axion-IA : 0 mention
dans les deux.** F4 a poussé la contre-épreuve jusqu'à ouvrir l'article source — le
« TOP 5 des organismes de formation IA à Grenoble » d'Almera liste Almera, CCI
Grenoble, Cegos, GEM et M2i : tu n'y es pas.

**Ce que ça veut dire concrètement** : les moteurs génératifs ne classent pas les
prestataires, ils **résument les classements des autres**. Tant que tu n'apparais dans
aucun listicle qui ranke, tu es structurellement absent des réponses commerciales,
quelle que soit la qualité du site.

**Quoi faire** : identifier les 5 à 8 articles qui captent réellement « formation IA
Grenoble », « audit IA PME », « cabinet conseil IA » ; pour chacun, contacter
l'éditeur (beaucoup de ces annuaires/blogs acceptent des ajouts gratuits ou des
fiches sponsorisées). Au fur et à mesure, transmets les URL pour alimenter
`local-citations.ts`.

**⚠️ Dépendance dure** : F4 note que le critère de tri mis en avant dans **tous** ces
comparatifs est « certifié Qualiopi ». Tant que ce statut n'est pas tranché par
l'audit dédié, tu candidates avec un dossier incomplet sur le seul critère qui
sélectionne. Ne le renseigne pas « en attendant ».

---

### R-15 · Le glossaire : écrire, ou arbitrer, mais pas contourner ⏱ arbitrage 30 min · rédaction longue · gratuit · impact **fort**

`GEO-127` (A2-P1-2 + volet glossaire de F1-P1-4)

**Le fait** : les 60 pages `/glossaire/[slug]` sont `noindex` et absentes de tout
sitemap — `sitemap/glossaire.xml` n'émet que le hub. Ce n'est **pas** un bug : le
code applique délibérément un seuil `GLOSSARY_MIN_INDEX_WORDS = 80` qu'**aucun des 60
termes n'atteint** (mesuré dans le code : min 45 mots, moyenne 60,3, max 75).

**Pourquoi ça mérite ton temps** : le format glossaire — définition courte, factuelle,
autonome — est le format le plus cité par les moteurs de réponse. 60 pages
d'infrastructure sont prêtes, zéro n'est visible.

**Deux choses à faire, dans cet ordre** :

1. **Un arbitrage (30 min, à toi seul)**. Le comptage de mots inclut aujourd'hui le
   texte **EN, qui n'est plus rendu** depuis la décision « site français uniquement ».
   Passer le comptage en FR-only impose de recalibrer la barre — le code documente
   lui-même les deux options (`glossary-extension.ts:841-849` : ~55 ou 300). Personne
   ne peut trancher à ta place, et rien ne doit bouger côté métrique avant.
2. **Écrire.** ~60 mots FR supplémentaires par terme. Commence par un lot de 15
   termes à fort volume de recherche plutôt que d'attaquer les 60 : le bénéfice est
   immédiat et proportionnel.

**🚫 Les deux raccourcis sont interdits par le code lui-même**
(`glossary-extension.ts:834-839`) : baisser le seuil, ou retirer le filtre. Les deux
mettraient 60 pages minces au même gabarit dans l'index — profil doorway typique. Et
H4 a **éliminé** le patch qui consistait à déclarer les 60 URL `noindex` dans le
sitemap : ça produirait 60 erreurs « exclue par la balise noindex » en Search Console,
au moment précis où F2 mesure un drainage de visibilité.

---

### R-16 · Le pilote presse Isère/Drôme ⏱ semaines · gratuit · impact **moyen-fort**

F6 (état du plan `PLAN-ACTION-BACKLINKS-RP-AXION-IA.md`)

**Le fait** : Phase 1 du plan RP **non démarrée**, `PRESS_MEDIA_COVERAGE = []`,
**0 retombée**, **0 domaine média** dans les 8 mentions inventoriées.

**Note de crédit au passage** : le code gère cette absence honnêtement — la section
« Ils parlent de nous » est **entièrement masquée** quand il n'y a rien
(`presse/page.tsx:559-582`, décision du 2026-06-23), avec un commentaire explicite
« NEVER fabricate non-existent press mentions ». Aucune fausse retombée n'est
affichée. C'est le bon comportement, ne le change pas.

**Pourquoi ça vient après R-14** : une retombée presse locale est une source
secondaire indépendante — c'est le matériau exact qu'exige Wikidata (R-17), et c'est
aussi ce qui te fait entrer dans le champ de vision des rédacteurs de comparatifs.

**Ce que je ne re-liste pas** : le dossier de presse PDF et les visuels manquants sont
liés aux livrables visuels déjà en attente de ton côté — F6 le signale et dit
explicitement de ne pas rouvrir.

---

### R-17 · Créer l'item Wikidata — **en dernier** ⏱ 30 min + 5 min · gratuit · impact **fort** (si le socle existe)

`GEO-045` (B1-P1-1 + F5-P1-2)

**État mesuré** : F5 a interrogé l'API Wikidata le 14/08 à 19:12:00 —
`wbsearchentities` sur « Axion-IA » et « Axion IA » → **0 résultat**. Il n'existe
aucun item à référencer ; la variable d'environnement n'est donc pas le blocage,
c'est la **création** qui l'est.

**Quoi faire, le jour venu** : créer l'item `AXION IA SAS` (SIREN 108018631, siège
Grenoble, site officiel axion-ia.com), sourcé sur SIRENE, societe.com, annuaire-
entreprises et les retombées presse obtenues. Puis Coolify → env var
`WIKIDATA_QNUMBER_AXIONIA=Qxxxxxxx` (scope RUN) + restart. Le code injecte alors
automatiquement le lien Wikidata dans le `sameAs` de l'Organization
(`wikidata-sameas.ts`, fallback sûr si la variable est absente ou invalide).

**Pourquoi c'est le dernier maillon et pas le premier** : c'est ce que dit déjà
l'ordre d'attaque du 20/07, et F5 le répète. Wikidata supprime les items d'entreprises
sans sources secondaires indépendantes. Avec 0 retombée presse, 7 abonnés LinkedIn et
des fiches tierces encore à corriger, une création aujourd'hui se solde très
probablement par une suppression — qui rend la seconde tentative plus difficile que la
première.

---

### R-18 · Renseigner les « avantages » des 54 offres d'emploi ⏱ 1-2 h · gratuit · impact **faible**

B5-P2 (`jobBenefits`)

**Le fait** : le champ « Avantages » de la console n'a **jamais** été renseigné —
0 offre sur 54 émet `jobBenefits`, et l'encart « Ce qu'on offre » de la page carrière
est masqué partout.

**Nuance de H1, à connaître avant d'y passer du temps** : `jobBenefits` ne figure
**pas** dans les propriétés exploitées par Google for Jobs. L'intérêt est donc de la
matière citable pour les LLM et de l'UX de page — pas du référencement d'offre. C'est
pour ça que c'est en dernier.

---

# ARBITRAGES — des décisions, pas des actions

Ces points ne demandent aucune manipulation : ils demandent que tu tranches. S2 tient
les patches prêts derrière chacun ; ils sont **bloqués** tant que la décision n'est
pas rendue, parce qu'ils contredisent chacun une décision que tu as prise
toi-même.

**A-1 · Les 455 pages `/sites-web-augmentes/par-ville/*`** (`GEO-014`, P0, D4)
Elles sont `index, follow`, riches, et déclarées dans **aucun sitemap ni lien
interne**. C'est aujourd'hui le pire des deux mondes : indexables mais
indécouvrables. Les déclarer contredit ta décision du 2026-06-20 (sortir toute la
famille `par-ville` des sitemaps) ; les passer `noindex` la respecte. Il faut choisir
l'un des deux — le statu quo est le seul mauvais choix.

**A-2 · Les 95 pages villes à qualité auto-déclarée insuffisante** (`GEO-086`, D4)
95 des 480 pages villes indexées portent un `Quality score` < 75 posé par le système
lui-même, jamais remédié. H6 recommande par défaut de **les sortir du sitemap sans
toucher aux balises `<meta>`** — l'autre option casse un invariant du code. À
confirmer.

**A-3 · Les garanties de résultat incrustées dans les visuels** (`GEO-097`, E3,
confirmé par inspection visuelle)
Des héros villes publiés affichent « GAINS MESURABLES ASSURÉS » et « 100 % GAGNANT ».
Ça contredit frontalement ta décision actée n°8 (CGV = obligation de moyens, garanties
purgées du texte) — le texte a été nettoyé, l'image ne l'a pas été. Décision : refaire
ou retirer ces visuels. Deux autres visuels portent la graphie « Axion-IA.com » et une
faute (« RECOMMANDATIONS CONCRÉTÉS ») — `GEO-102`.

**A-4 · Les formations par-ville « sur devis »** (`GEO-135`, B2)
Elles annoncent « sur devis » alors que les prix sont publics partout ailleurs. Deux
décisions prises à deux jours d'écart, jamais réconciliées. B2 a eu raison de
documenter sans trancher : c'est un arbitrage commercial, pas technique.

**A-5 · `/fr/memo-isere`** (`GEO-146`)
Indexable, absente de `pages.xml`, sans aucun lien entrant. Deux lectures possibles :
landing volontairement discrète (→ la passer `noindex`, cohérence retrouvée) ou page
commerciale à part entière (→ la déclarer + l'ajouter aux listes du job `warm`).
Personne ne doit trancher ça à ta place.

**A-6 · Le logo Qualiopi** (`GEO-027`, G4) — cross-ref audit dédié
Le fichier est un PNG de **1,27 Mo servi brut sur 100 % des pages**, ce qui en fait un
des plus gros postes de poids du site. Point annexe et hors GEO, mais à connaître :
le fichier porte un **manifeste C2PA « GPT-4o / trainedAlgorithmicMedia »**, c'est-à-dire
qu'il se déclare lui-même comme généré par IA. La question de fond (afficher ou non ce
logo) relève de l'audit Qualiopi ; si la réponse est « non », le problème de poids
disparaît avec.

**A-7 · Les trois autres STOP techniques** — détaillés par S2, listés ici pour que tu
saches qu'ils t'attendent : `GEO-007` (le tier d'indexation écrasé en dur au publish,
qui renverse ta décision du 2026-06-17), `GEO-029` (sortir les schémas d'autorité de
`afterInteractive` — un ADR est requis) et `GEO-116` (bascule `inlineCss`, qui
contredit le Sprint 24bis).

---

# Ce que je n'ai volontairement PAS listé

Pour que tu n'aies pas à te demander si j'ai oublié quelque chose :

- **Tout ce qui touche à Qualiopi** — drapeau, NDA, numéro de certificat, certificateur
  COFRAC, date de validité, champs `qualiopi_*` de la console. B1 et F5 prescrivent des
  saisies ; elles sont **suspendues** à l'audit dédié, qui a la main.
- **Les six « restes Will » déjà actés** : vidéo VSL, relecture avocat des CGV, tri des
  candidatures, ticket Bing UCM000007450870, adhésion au médiateur de la consommation,
  recharge du crédit OpenAI / désarmement du kill switch. Le kill switch explique à lui
  seul quatre symptômes de cet audit (`GEO-076`) ; il n'en est pas moins déjà acté.
- **Le dossier de presse PDF et les visuels manquants** — dépendants des livrables
  visuels déjà en attente, F6 demande explicitement de ne pas rouvrir.
- **Toute action EN** (traduction, hreflang enrichi, profils anglophones) —
  décision définitive du 2026-08-12 : site français uniquement.

---

# Récapitulatif

| # | Action | Temps | Coût | Impact GEO | Dépend de |
|---|---|---|---|---|---|
| R-01 | Corriger LinkedIn entreprise | 15 min | gratuit | **fort** | — |
| R-02 | Réclamer + corriger Crunchbase & F6S | 45 min | gratuit | **fort** | — |
| R-03 | Corriger Les Pépites Tech | 20 min | gratuit | **fort** | — |
| R-04 | Créer le QR `podcast` | 2 min | gratuit | nul (acquisition) | — |
| R-05 | Jeton OAuth GSC en scope *write* | 15 min | gratuit | moyen-fort | — |
| R-06 | Cache Rule Cloudflare `.xml` | 10 min | gratuit | moyen | — |
| R-07 | Clé API Bing Webmaster | 10 min | gratuit | moyen-fort | patch S2 |
| R-08 | Lien sur JaimeLesStartups | 10 min | gratuit | faible-moyen | — |
| R-09 | Rectifier `AGENTS.md` global | 5 min | gratuit | indirect | — |
| R-10 | Ligne pro + `COMPANY_PHONE` | 1 h | **payant** | **fort** (débloque) | — |
| R-11 | Google Business Profile | 30 min + délai | gratuit | **fort** | R-10 |
| R-12 | Bing Places | 10 min | gratuit | moyen | R-11 |
| R-13 | PagesJaunes | 20 min | gratuit | moyen-faible | R-10 |
| R-14 | Entrer dans 3-5 comparatifs tiers | semaines | variable | **fort** | audit Qualiopi |
| R-15 | Glossaire : arbitrer puis écrire | 30 min + long | gratuit | **fort** | — |
| R-16 | Pilote presse Isère/Drôme | semaines | gratuit | moyen-fort | — |
| R-17 | Item Wikidata | 30 min | gratuit | **fort** | R-01→R-03, R-16 |
| R-18 | Avantages des 54 offres | 1-2 h | gratuit | faible | — |

**Total de la vague 1 : 9 actions, 2 h 12, entièrement gratuit.** C'est ce qui remet
ton entité d'accord avec elle-même sur les trois sources que les moteurs lisent
aujourd'hui à ta place.

---

## Limites de ce document

1. **Un seul moteur de réponse a été interrogé** (F4, re-tiré par H3 : moteur de
   réponse Claude + backend de recherche). Perplexity, ChatGPT Search et Gemini n'ont
   pas pu l'être — interfaces bloquées au fetch, pas de crédit API mobilisable. Les
   verdicts `GEO-020`, `GEO-107` et `GEO-108` **ne sont pas transposables tels quels**
   aux autres moteurs. Le mécanisme (les moteurs synthétisent des sources tierces) est
   lui général ; les classements précis, non.
2. **Trois fiches tierces n'ont pas pu être lues** : Crunchbase (403), F6S (bot-wall),
   et les registres légaux rendus côté client. Ce qu'elles affichent réellement reste
   `[À CONFIRMER]` — c'est la première chose à constater en faisant R-02.
3. **Aucun Google Business Profile n'a pu être interrogé directement** : la conclusion
   « aucun GBP » de F5 repose sur une convergence d'indices (aucune fiche côté Bing,
   0 URL GBP dans le dépôt, catalogue 0/10, aucun téléphone publiable), pas sur une
   requête Places.
4. **Aucune action de ce document n'a été exécutée** : l'audit est en lecture seule
   (GET/HEAD uniquement, aucune soumission d'URL, aucun POST). Tout ce qui est décrit
   ici reste entièrement à faire.
