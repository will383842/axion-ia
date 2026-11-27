# Conception : encart vidéo automatique « Regardez cette vidéo »

> Document de conception (plan, aucun code). Rédigé le 2026-11-27 à partir de deux lectures
> en lecture seule : le dépôt du site (`axion-ia`) et la copie publique du Studio
> (`studio-axion-ia-public`, branche `master`). Chaque chemin cité a été lu ; ce qui n'a pas pu
> être vérifié est dit comme tel.

## 0. À retenir en dix lignes

1. **On ne part pas de zéro.** Le chantier « vidéos sur le site » existe des deux côtés
   (lots W1-W4 côté site, ADR 0070 ; lots S1-S4 côté Studio, codés et testés, aucun branché
   en réel). Un encart « En vidéo » existe déjà (`src/server/videos/encarts.ts`,
   `src/components/videos/EncartEnVideo.tsx`). La demande est donc une **refonte du moteur de
   choix**, pas un nouveau circuit.
2. **Le modèle « le Studio pousse, le site reçoit » reste le bon.** Le site n'appelle jamais
   le Studio, qui reste privé. Le « 100 % automatique » de la décision de Will s'entend
   après l'envoi : dès qu'une vidéo est publiée par le Studio, le site la choisit, la répartit
   et la retire tout seul, sans geste humain côté site.
3. **« Validée » ne veut pas dire « publique », mais une vidéo validée peut partir au site
   sans attendre les réseaux.** Dans le Studio, `validee` / `publiee` décrivent les réseaux
   sociaux ; l'envoi au site, lui, dépend de `statut prete` + case « Sur le site » + contrôles,
   **jamais** de l'étape éditoriale (`services/site-videos.ts:502-515,633`). Le seul signal
   fiable pour le site est donc l'état `en-ligne` du kit (`kit.site.etat`). Pour que les
   vidéos « validées non encore envoyées » rejoignent l'encart, il faut un petit
   déclencheur côté Studio (§ 1.7).
4. **Blocage : les deux contrats ne correspondent pas.** Le Studio envoie `versionContrat`,
   `idStudio`, `rubrique`… ; le site, en `.strict()`, attend `schemaVersion`,
   `studioVideoId`, `theme`… Tel quel, chaque envoi reçoit un 422. Il faut trancher quel
   contrat fait foi (recommandation : celui du site, déjà en production).
5. **« Lecture au clic » dans l'article contredit la doctrine écrite** du composant
   (« jamais de lecteur ici », « jamais de VideoObject »). Décision de Will + ADR nécessaires
   (§ 4.2). Recommandation : façade → page vidéo du site, sans JavaScript.
6. **Aucune URL publique stable de vidéo n'existe aujourd'hui** : le stockage public du
   Studio est factice (`STOCKAGE_PUBLIC_A_RELIER`). Geste de Will (seau R2 public + règle
   Cloudflare `/medias/*`).
7. **Bug existant à corriger d'abord** : les articles de la catégorie « implémentations »
   n'ont jamais d'encart (slug réel `blog-implementations-ia`, table de mots avec le singulier).
8. **Les 2 157 pages villes montrent toutes la même vidéo** (thème fixe `audit-ia`) : c'est le
   cas que le répartiteur doit régler.
9. **Les embeddings d'articles sont éteints par défaut** : le choix doit avoir un repli
   lexical dès le départ.
10. **Deux chiffres du brief sont périmés** : cliquet public 294 KB (ADR 0074, pas 265) ;
    terracotta public `#b23f16` (`src/app/globals.css:194`), `#c24a1b` n'est plus que
    l'admin. On écrit des classes de jetons, jamais d'hexadécimal (`scripts/check-anti-hex.sh`).

## 1. Le Studio (lecture : `studio-axion-ia-public`, master)

### 1.1 Modèle

- Postgres sert de magasin de documents (`documents(collection, id, data jsonb)`,
  `src/donnees/postgres/index.ts:5-8`). Types : `src/domaine/types.ts`.
- `Video` (`types.ts:752-820`) : `id`, `titre` (peut porter un code interne retiré par
  `titreSansCodeInterne`, `src/domaine/miniatures.ts:96`), `sujet?`, `ciblage?`, `serieId`,
  `langue`, `dureeCibleSec`, `ratios[]`, `mentionIA`, `distribution`.
- Il n'y a **pas de taxonomie** (ni thème ni catégorie) dans le Studio : seulement `sujet`,
  `ciblage`, `serieId`. La « rubrique » n'existe que dans le **passeport web**
  (`src/domaine/site-videos/types.ts:28-57`), saisie à la main : `titreWeb`, `resume`,
  `transcription`, `chapitres`, `aRetenir`, `questions`, `rubrique`, `motsCles`, `credits`.
- Sous-titres : `SousTitres` (`types.ts:1002-1043`), convertis en `.vtt` à la demande
  (`src/briques/sous-titres/export.ts`), non stockés. Pas de transcription stockée : elle vient
  du script validé.
- Vignette : celle de la miniature choisie, JPEG, largeur minimale 1200 px contrôlée par
  SITE-09 (`controles.ts:176-178`).

### 1.2 Statuts réels

- Technique (`types.ts:649`) : `brouillon | maquette | en_file | en_fabrication | prete | echec |
annulee | archivee`.
- Éditorial (`types.ts:651`) : `a_relire | validee | programmee | publiee` (« À valider /
  Accepté / Programmé / Publié », `statut-usine-video.ts:5-16`). `validee` est un geste de Will
  (`services/videos.ts:495-508`) ; `programmee`/`publiee` sont posés par Buffer, Zernio,
  les mesures ou la saisie manuelle : **ils concernent les réseaux, pas le site**.
- Site (`EtatSite.etat`, `site-videos/types.ts:63`) : `hors-ligne | envoi-en-cours | en-ligne |
retrait-en-cours | retiree | echec`. **C'est le critère de l'encart.**
- Correspondance avec la décision de Will : « validé / prête à publier » =
  `statut prete` + `etapeEditoriale validee` ; « déjà publiée » = `publiee` ; **éligible à
  l'encart = envoyée au site (`en-ligne`)**, ce qui n'arrive que si les contrôles SITE-01 à
  SITE-17 passent et que le générateur de la vidéo est autorisé pour le site (éteint par
  défaut).

### 1.3 Retrait

- `retirerDuSite` (`services/site-videos.ts:761-780`) : DELETE signé, effacement des fichiers
  publics, état `retiree`. `retirerAvantSuppression` (`:804-824`) est appelé par la suppression
  définitive et la corbeille. `retirerTout`/`republierTout` à l'extinction/rallumage d'un
  générateur (`:206-239`).
- **Trou** : `archiverVideos` (`services/videos.ts:386-399`) ne retire pas la page : une
  vidéo archivée resterait en ligne. → PR Studio S-3.
- Aucun webhook ni événement sortant : seulement `journaliser(...)`.

### 1.4 Fichiers

- Privé : R2 privé (`src/fournisseurs/r2/stockage.ts`), adresses signées 15 min / 24 h.
- Public prévu, **non relié** : `medias/videos/<idStudio>/<slug>-v<version>-<sha8>.<mp4|jpg|vtt>`
  sous `https://axion-ia.com/`, `Cache-Control: public, max-age=31536000, immutable`
  (`src/domaine/site-videos/contrat.ts:98-137`). Aujourd'hui `stockagePublic()` renvoie un
  stockage factice (`services/site-videos.ts:563-565`) et l'envoi réel est refusé
  (`:634-637`). Décision D7 : geste de Will (`PLAN-LOTS-STUDIO.md:561`).

### 1.5 API et signature

- Le Studio envoie, le site répond (`PLAN-LOTS-STUDIO.md:463`) :
  `GET /api/interne/videos/reglages`, `POST /api/interne/videos`,
  `DELETE /api/interne/videos/<id>` (`src/fournisseurs/site/fournisseur.ts:12-13`).
- HMAC-SHA256, trois en-têtes `x-axion-horodatage`, `x-axion-nonce`,
  `x-axion-signature: v1=…` ; délai 10 s, `redirect: "error"` (`http.ts:25-61`). Client inscrit
  seulement si `SITE_VIDEOS_URL` et `SITE_VIDEOS_SECRET` existent ; fournisseur « simulation »
  par défaut.
- Aucun flux RSS/JSON, aucune route publique de liste côté Studio. **Conclusion : pas de flux
  tiré par le site.** Un flux signé lisible par le site rouvrirait l'exposition du Studio, que
  la règle actuelle évite. On garde le « push signé » existant (déjà écrit, testé).

### 1.6 Écart de contrat (bloquant)

Comparaison champ par champ, relue dans les deux dépôts (Studio : `src/domaine/site-videos/contrat.ts:7-34,
corpsPasseport` ; site : `src/server/videos/contrat.ts:46-97`, tout objet `.strict()` donc un champ
inconnu = 422).

| Sujet | Studio (envoie) | Site (attend) | Écart |
| ----- | --------------- | ------------- | ----- |
| Version du contrat | `versionContrat: 1` | `schemaVersion: 1` | renommer |
| Identifiant | `idStudio` (libre) | `studioVideoId`, `^[a-z0-9_-]{8,64}$` | renommer + format (minuscules seulement) |
| Version de la page | `versionPasseport` | `version` (entier ≥ 1) | renommer |
| Slug | `slugPropose` | `slug` (≤ 80, kebab) | renommer |
| Langue | `langue` (libre) | `langue` = `"fr"` seulement | contrôle à ajouter |
| Titre | `titre` ; Studio : 1 à 60 (SITE-11) | `titre` 20 à 100 | **bornes incompatibles** : 1-19 passe chez le Studio et fait 422 ; ramener à 20-60 |
| Description | **absente** | `description` 80 à 300 | champ à créer |
| Résumé | `resume` (non vide) | `resume` 400 à 1 500 | bornes à reprendre |
| À retenir | `aRetenir[]` (3, SITE-10) | `aRetenir` exactement 3, 20 à 200 chacun | longueurs à reprendre |
| Questions | `questions[]` (2 ou 3) | 2 ou 3 ; `question` 10-160, `reponse` 40-600 | longueurs à reprendre |
| Thème | `rubrique` (texte libre) | `theme` ∈ liste fermée de 5 : `formations-ia`, `coaching-ia`, `audit-ia`, `automatisation`, `sites-web-ia` (`src/content/videos/themes.ts`) | liste fermée côté Studio |
| Série | **absente** (le Studio a `serieId`, non envoyé) | `serie` `{slug, titre, rang}` ou `null` | envoyer `null` au début |
| Lien | `lienService` (chaîne facultative) | `lien` `{type: service\|formation, chemin}`, obligatoire, liste blanche (`liens.ts`) | passer à l'objet ; devient obligatoire |
| Durée | `dureeSec` (décimale, au dixième) | `dureeSecondes` entier 5 à 3 600 | renommer + arrondir |
| Chapitres | `{debutSec, finSec, libelle}` | `{titre 2-120, debutSecondes}` ; aucun sous 30 s, débuts croissants | convertir, `finSec` supprimé |
| Fichiers | `urlVideo`, `urlVignette`, `urlVtt` (adresses complètes), + `largeur`, `hauteur`, `largeurVignette`, `hauteurVignette` | `fichiers{video, affiche169, vignette43, vignette11, sousTitres}`, chacun `{chemin, octets, type}` ; vidéo avec `sha256`, `largeur`, `hauteur` ; images avec `largeur`, `hauteur` | objet à reconstruire ; 3 images au lieu d'une |
| Clés de stockage | `medias/videos/<idStudio>/<slug>-v<version>-<sha8>.<ext>` (`contrat.ts:98,119`) | `/medias/videos/<slug>/v<version>/<fichier>` (`superRefine`) ; vérifié par `HEAD` | disposition incompatible (S-4) |
| Transcription | `transcription` | `transcription` 1 à 100 000 ou `null` | compatible |
| Mention IA | `contenuGenere` (un seul booléen) | `ia{voixGeneree, doubleNumerique}` | à scinder, dériver de `distribution` |
| Personnes à l'image | **absent** | `personnesALImage{williams}` | à créer (jamais par défaut) |
| Attestation | **absente** (case SITE-05 locale) | `attestations{aucunNomNiLogoDeClient: true}` | à envoyer quand la case est cochée |
| Publication | `publieLe` | **inconnu** | à retirer |
| Champs du Studio que le site refuse | `motsCles`, `generateur`, `credits` | — | **à retirer** de l'envoi |

Seul l'identifiant de signature est déjà compatible (voir plus bas).

Recommandation : **suivre le site** (en production, strict, portant les attestations).

**L'écart va au-delà des noms de champs** (relecture critique, vérifié) :

- **Longueurs** : le site exige `titre` 20-100, `description` 80-300, `resume` 400-1 500,
  chaque `aRetenir` 20-200, chaque `reponse` 40-600 (`src/server/videos/contrat.ts:53-60`). Le
  Studio ne contrôle que « non vide » (SITE-10, `controles.ts:181-191`) et plafonne le titre à
  60 (SITE-11, `:194-202`) : un titre de 15 caractères passe chez lui et reçoit un 422 au site.
- **Fichiers** : le site exige `/medias/videos/<slug>/v<version>/<fichier>` avec `sha256`,
  `octets`, largeur, hauteur, et vérifie chaque fichier par `HEAD`
  (`src/server/videos/contrat.ts:116-145`, `fichiers.ts`). Le Studio range sous
  `medias/videos/<idStudio>/<slug>-v<version>-<sha8>.<ext>` (`contrat.ts:98,119`) : disposition
  incompatible.
- Les signatures, elles, sont compatibles (même chaîne, `v1=`, nonce 32 hex, fenêtre 300 s).

### 1.7 « Validée mais pas encore envoyée » : comment l'encart les prend aussi

Décision de Will : l'encart prend les vidéos validées, prêtes à publier ou déjà publiées. Le
Studio n'a qu'une étape « validée » **pour les réseaux** ; mais l'envoi au site ne la lit pas
(`exigerSelectionnable`, `site-videos.ts:502-509` : seulement `statut prete` et générateur
autorisé ; `publierSansSession`, `:633` : case « Sur le site » cochée ; contrôles SITE-01 à 17).
**Ce n'est donc pas impossible**, et aucun changement du modèle éditorial n'est nécessaire.

Aujourd'hui seul `publicationAuto` (`:837-870`) coche la case et envoie, et seulement juste après
les finitions d'une **nouvelle** vidéo, si le générateur et son réglage `cleSiteAuto` sont allumés.
Une vidéo validée plus tard, ou antérieure, n'est jamais reprise. Proposition (PR Studio S-6) :

1. appeler `publicationAuto(videoId)` aussi depuis `changerEtapeEditoriale` quand l'étape devient
   `validee` (`services/videos.ts:495-508` ; pour une vidéo de version, après `validerVariante`) ;
2. une passe de rattrapage, à lancer à la main une fois, sur toutes les vidéos `prete` dont l'étape
   est `validee`, `programmee` ou `publiee` (modèle : `republierTout`, `site-videos.ts:225-239`) ;
3. les contrôles restent bloquants : une vidéo qui n'a pas de page complète (SITE-10, le
   passeport d'essai échoue toujours), pas de sous-titres, ou pas de case « Aucun client nommé »
   reste « à relire avant le site » et ne part pas.

**Le vrai obstacle n'est pas le statut mais le passeport web** (thème, résumé, à retenir,
questions) : tant que Will ne l'écrit pas, ou que l'écriture par Claude (réglage éteint) n'est pas
allumée, aucune vidéo ne part, validée ou non.

## 2. Le site : ce qui existe

- `SiteVideo` (`prisma/schema.prisma:18322-18372`) : `statut publiee|retiree`, `theme`,
  `serieSlug`, `titre`, `description`, `resume`, `aRetenir`, `questions`, `transcription`.
  Seul écrivain : `src/server/videos/reception.ts`, via `POST`/`DELETE` signés
  (`src/app/api/interne/videos/route.ts`).
- Lecture unique : `src/server/videos/lecture.ts:116-130` : seulement `publiee`, cache mémoire
  5 min vidé à chaque publication/retrait, `[]` si `VIDEOS_SITE_ENABLED` est éteint ou si la
  base est `stub.invalid`.
- Choix actuel (`encarts.ts`) : la vidéo **la plus récente du thème** ; thème du blog déduit
  de la catégorie par table de mots (`:50-88`) ; thème fixe `audit-ia` pour les villes (`:17`).
- Composant : `EncartEnVideo.tsx` + `CarteVideo.tsx` (serveur, sans JS, `<img>` 4:3 avec
  `width`/`height`, `loading="lazy"`, lien vers `/fr/videos/<slug>`).
- Pages hôtes : blog (`blog/[slug]/page.tsx:548,833`), villes (`:417`), formations, pages de
  service. **Guides, actualités, connaissances : pas d'encart**, et absents de `GABARITS_HOTES`
  (`apres-publication.ts:84-88`).
- Retrait automatique déjà en place (`apres-publication.ts`) : vide le cache, revalide les
  adresses fixes et les gabarits hôtes, purge Cloudflare au retrait ; le proxy rend 410 sur
  les vidéos retirées.
- SEO : `VideoObject` uniquement sur la page vidéo (`src/lib/seo/video-jsonld.ts`, sans
  `embedUrl`) ; plan du site vidéo (`sitemap.ts`) ; `llms.txt` (`llms.ts`).

### 2.1 Défauts constatés dans l'existant

1. « implémentations » sans encart (voir § 0.7) ; le test essaie un faux slug
   (`__tests__/encarts.spec.ts:121`).
2. Même vidéo sur les 2 157 villes.
3. `related-articles.ts:10` annonce un reclassement par embeddings qui n'existe pas.
4. Embeddings d'articles éteints par défaut (`OPENAI_EMBEDDINGS_ENABLED`,
   `persist-article-embedding.ts:7-8`).
5. `docs/videos-site/PLAN-W1-W4.md`, cité partout, est **absent du dépôt**.
6. `id="encart-en-video"` fixe : doublon si deux encarts sur une page.

## 3. Choix de la vidéo et répartiteur (site)

### 3.1 Où calculer

**Pas au rendu** : l'ISR (3600 s ; villes 86400 s) referait le choix et les compteurs globaux
demandent des écritures. Le choix est **calculé hors rendu et stocké** :

- table `encarts_video_affectations` : `contenuType`, `contenuId` (unique sur la paire),
  `siteVideoId`, `score`, `methode` (`embedding` | `lexical`), `choisiLe`, `versionAlgo`,
  `etat` (`active` | `orpheline`). Migration **additive**, colonnes nullables ;
- file BullMQ neuve `videos-encarts`, charge minimale (`{ tache, contenuId }` ou
  `{ tache: "reequilibrer", tick }`), le worker **ignore les tâches inconnues** ;
- déclencheurs : après la publication d'un contenu (accroche naturelle :
  `content-publish-worker.ts:1231`, tâche détachée comme l'embedding) et passe nocturne qui
  réaffecte orphelines et dépassements, et traite le stock existant (~100 contenus/jour + stock).
- **Revalidation** : `revalidatePath` ne fait rien dans le worker (`content-publish-worker.ts:1453-1455`
  passe par `revalidateContent`, API interne). Après chaque affectation on appelle
  `revalidateContent` pour le contenu concerné (par lots bornés la nuit) ; sinon l'article reste
  sans encart jusqu'à 1 h (ISR 3600).
- **Drapeau côté worker** : `videosPubliees()` rend `[]` si `VIDEOS_SITE_ENABLED` n'est pas
  « true » (`lecture.ts:117-118`). La variable doit être posée sur l'app **et** le worker ; le
  worker lit `SiteVideo` sans le cache mémoire de 5 min ; **garde « liste vide = ne rien
  toucher »** : jamais de passage massif en orphelines sur une liste vide.
- **Réactivité** : `apresPublication` met en file `{ tache: "reequilibrer", siteVideoId }`
  (borné) à chaque retrait ou arrivée, pour ne pas attendre la nuit (les tâches inconnues sont
  ignorées par un ancien worker : ordre de déploiement sûr).
- la page lit l'affectation puis résout la vidéo via `videosPubliees()` : une vidéo retirée
  disparaît à la revalidation déjà câblée.

### 3.2 Score de proximité

1. Candidats : `videosPubliees()` (jamais plus).
2. Score : cosinus article↔vidéo dans l'espace du fournisseur actif
   (`dedup/nearest-articles.ts:33-56`, texte vidéo via `buildVoyageEmbeddingText` sur
   titre + description + résumé + à retenir + questions). **Repli lexical** si un vecteur manque :
   recouvrement de jetons (`jetonsArticle`/`jetonsSujet`/`recouvrementSujet`,
   `src/data/external-links/pertinence-sujet.ts:137-183`) plus bonus si le thème de catégorie correspond.
3. Seuil de pertinence : on retient seulement `s ≥ seuilMin`, classé par score décroissant moins
   la pénalité de rotation. Un sujet voisin est un repli **permis**, pas une obligation : on
   n'écarte donc pas les scores élevés (la vidéo la plus pertinente reste la meilleure).
   `seuilMax` n'existe qu'en option, **éteinte par défaut**, sur décision de Will ; le seuil
   de doublon 0,85 (`dedup/`) est calibré article↔article et n'est pas transposable à un
   texte de vidéo plus court. Aucune vidéo ≥ `seuilMin` ⇒ **pas d'encart** (jamais de
   remplissage). Seuils à calibrer (démarche de `scripts/calibrer-seuils-voyage.ts`) avant
   allumage ; encart éteint tant que non calibré. La comparaison article↔vidéo demande une
   **nouvelle requête** (`findNearestArticles` ne compare que des articles, `nearest-articles.ts:33`).
4. Les embeddings vidéo : colonnes `embedding` (1536) et `embedding_voyage` (1024), nullables,
   remplis à la réception (`after()`) et en rattrapage nocturne (étendre
   `embeddings-backfill-worker.ts`).

### 3.3 Répartiteur

- Score effectif = `s − λ · (affectations actives / plafond)` ; **exclusion dure** si la vidéo
  atteint `plafondParVideo` sur `fenetreJours` ; départage stable `departageStable(contenuId,
slug)` (déterministe, pas d'aléatoire non reproductible).
- **Évitement des voisins** : on exclut toute vidéo déjà affectée aux « À lire aussi »
  (`findRelatedArticles`, 4), précédent/suivant (`loadAdjacentArticles`) et plus proches
  voisins sémantiques (`findNearestArticles`, 5).
- Villes : rotation déterministe (hachage du slug modulo les vidéos éligibles), en évitant la
  vidéo des communes proches (`VilleCommunesProches`), sans écriture par page.
- Concurrence : relire le compteur dans la transaction **ne suffit pas** (READ COMMITTED :
  deux transactions lisent `plafond − 1`). On prend `pg_advisory_xact_lock(hash(siteVideoId))`
  avant le comptage (ou file `videos-encarts` à `concurrency: 1`). **Test de course** : deux
  affectations parallèles, plafond 1, une seule passe.
- `plafondParVideo` compte les affectations **actives** dont `choisiLe` est dans
  `fenetreJours` (à figer dans E1). Les villes (rotation sans écriture) échappent au plafond :
  assumé et dit.
- Les candidats-villes se limitent aux vidéos de thèmes génériques ; la rotation utilise un
  hachage par rendez-vous (HRW), pas un modulo (un ajout/retrait ne rebat pas les 2 157 pages).
- Module **pur** (`src/server/videos/repartiteur/`), sans entrée/sortie, testable à froid.

## 4. Rendu mobile first

### 4.1 Composant

- XSS : aucun champ du Studio ne passe par `dangerouslySetInnerHTML` ; `src` reste le `chemin`
  contraint par la regex (`contrat.ts:142-145`) ; test dédié en E6. `sizes`/`srcset` sur la
  vignette 4:3 (ne pas charger 1 200 px sur 360 px).
- Composant serveur sans JS, `<section aria-labelledby>` avec **identifiant unique par
  instance** (corrige § 2.1.6), titre visible, durée lisible (« 2 min 10 »), mention de
  sous-titres si le `.vtt` existe.
- Façade : `<img>` avec `width`/`height` et ratio fixe (**CLS = 0**), `loading="lazy"`,
  `decoding="async"`, jamais `priority` (**aucun impact LCP** : l'encart est en fin de page,
  hors première vue). Pictogramme de lecture, zone tactile ≥ 44 px, contraste AA.
- Couleurs : classes de jetons (`text-terracotta`, `border-terracotta/50`) ; le terracotta
  public actuel est `#b23f16`. Aucun hexadécimal en dur.
- Mot interdit : le libellé et le texte de l'encart passent par `detecterInterdits`
  (`src/lib/contenu/interdits-publication.ts`) ; garde `gardes-contenu.ts` à la réception
  des vidéos. Le mot « Grenoble » n'apparaît jamais.
- Position : fin de page (comme aujourd'hui) ; « après le n-ième H2 » demande un découpage du
  corps HTML côté serveur (le corps est injecté par `dangerouslySetInnerHTML`) : **hors
  périmètre v1**, à reprendre seulement si la mesure le justifie.

### 4.2 « Lecture au clic » : décision de Will requise (ADR 0078)

La doctrine écrite (`EncartEnVideo.tsx:6-9`) interdit le lecteur dans l'article. Options :

|                     | Option                                                 | JS ajouté                 | Effet SEO                                           | Réserve                                           |
| ------------------- | ------------------------------------------------------ | ------------------------- | --------------------------------------------------- | ------------------------------------------------- |
| **A (recommandée)** | La façade mène à `/fr/videos/<slug>`                   | 0                         | La page vidéo reste la seule page « vidéo » indexée | Pas de lecture dans l'article ; un clic de plus   |
| B                   | `<video preload="none" poster controls>` natif au clic | 0 JS, mais octets au clic | Concurrence entre pages vidéo possible              | Lecture réelle dans l'article                     |
| C                   | `VslVideoDiffere` (import dynamique)                   | oui                       | idem B                                              | Entame le cliquet public (294 KB) ; INP à mesurer |

Option A tient « façade + lecture au clic » au sens où **le clic lance la lecture sur la page
dédiée**. Si Will veut la lecture sur place : B, après mesure.
Aucun lecteur tiers (doctrine). Pour B : sous-titres `<track>` si `.vtt` présent.

### 4.3 Web Vitals (budget : LCP ≤ 1800 ms, CLS 0, INP ≤ 100 ms, 75 KB gz/route)

- Option A : zéro JS ajouté, une image lazy à dimensions réservées : neutre sur LCP/CLS/INP.
- Poids : la page vidéo pèse ~286 KB gz, accepté par l'ADR 0071 sous condition de mesurer LCP
  et INP avant allumage. L'encart ne la charge pas.
- Avant d'allumer sur un type de page : mesure LCP/TBT/INP **en médiane sur plusieurs passages**
  (règle du dépôt : les octets se lisent sur une passe, le temps se borne en médiane).
- Au build : `stub.invalid` ⇒ pas d'encart ; l'ISR remplit ensuite. Toute nouvelle lecture
  commence par ce test.
- Image : la vignette 4:3 doit exister ; `fetchpriority` jamais haut.

## 5. Réglages console (écran ↔ back-end)

- Clé `ContentGenConfig` `videos_encarts` (`config-store.ts`), forme **déclarée une seule fois**
  (schéma Zod + défauts) dans un module importé par le worker, l'action et l'écran (motif
  `paires-similaires.ts`, qui valide sans transtyper).
- Champs : `actif` (défaut **faux**), `seuilMin`, `seuilMax` (optionnel, éteint par défaut), `plafondParVideo`, `fenetreJours`,
  `typesContenus`, `exclureVoisins`, `videosExclues[]` (liste d'identifiants).
- « Exclure une vidéo » : l'exclusion est lue par le répartiteur **et** purge les
  affectations existantes à la prochaine passe ; l'écran montre le nombre d'encarts concernés.
- Action serveur sur le modèle `editorial/reglages.ts` (permission, schéma Zod,
  `persistContentGenConfig` + `ContentGenAuditLog`, `logActivity`, Sentry, `revalidatePath`).
- Page `…/content-gen/settings/videos-encarts/` : `force-dynamic`, `auth()` puis `redirect`
  (`pnpm admin-gardes:check`), entrée dans `src/lib/admin-nav.ts`
  (`tests/unit/ci/route-admin-sans-entree-de-menu.spec.ts`), tableau lecture seule des
  affectations par vidéo, commentaire `// use-client:` pour tout composant client.
- **Test de parité** (aucun harnais générique n'existe) : un test lit les champs du schéma
  unique par introspection (`.shape`), jamais par liste écrite à la main, et exige que chacun soit (a) présent dans l'écran, (b) écrit par l'action, (c) lu par
  le répartiteur ; un champ affiché mais jamais lu fait rougir.
- Interrupteurs : `VIDEOS_SITE_ENABLED` (existant) **et** `actif` (nouveau) : les deux requis.

## 6. Vidéo retirée ou dépubliée dans le Studio

Chaîne : Studio (retrait, corbeille, suppression, extinction du générateur, **archivage après
S-3**) → `DELETE` signé → `reception.ts` met `retiree` → `apresPublication` vide le cache,
revalide les gabarits hôtes (à étendre aux guides, actualités, connaissances **avant** de les
rendre hôtes : sinon l'encart d'une vidéo retirée reste jusqu'à 1 h), purge Cloudflare →
le proxy rend 410 sur la page vidéo. Côté choix : la passe nocturne marque les affectations
**orphelines** et réaffecte ; entre-temps la page ne montre rien (la vidéo n'est plus dans
`videosPubliees()`), elle ne montre jamais une vidéo retirée. Une vidéo restaurée de la
corbeille ne revient pas toute seule (comportement Studio voulu, `corbeille.ts:51`).
Test de bout en bout à prévoir : retrait ⇒ encart absent sous un délai borné.

## 7. Données structurées : ce qu'apporte un VideoObject

Honnêtement : **peu, et il peut nuire sur une vidéo secondaire.**

- Google n'affiche un résultat vidéo enrichi que si la page est **dédiée à la vidéo** et que la
  vidéo en est un élément principal ; une vidéo en encart de fin d'article n'y est pas éligible.
  Le balisage seul ne la fait pas apparaître.
- Un `VideoObject` sur chaque article hôte multiplierait les « pages vidéo » concurrentes de
  la même vidéo, et diluerait la page vidéo canonique.
- Il demande des URL de contenu ou d'intégration réelles ; or le stockage public n'est pas relié.
- **Recommandation** : `VideoObject` uniquement sur la page vidéo (déjà le cas), jamais sur
  les pages hôtes. Sur l'hôte, l'apport utile est le **lien interne** (texte d'ancre clair,
  maillage vers la page vidéo) et la présence dans `sitemap-videos.xml`. Valeur pour les IA :
  la transcription et le résumé vivent sur la page vidéo, que l'encart relie.
- Aucun témoignage, aucune note, aucun faux avis dans le balisage ou le texte.

## 8. Règles de sécurité et d'éthique

- Rien de privé ne sort du Studio : le corps envoyé exclut déjà `blocRecette`, `origines`, les
  identifiants de fichiers privés, notes, personnages, distribution, chemins R2.
  **Mais il envoie** `idStudio`, `generateur`, `credits` et la transcription intégrale : à
  réexaminer dans S-1 (ne garder que le nécessaire).
- Visage/voix de Will : seulement si la vidéo est déjà **en ligne et validée** ; à dériver de
  `distribution` / `Personnage.nature === "moi"` pour remplir `ia.*` et
  `personnesALImage.williams` (les remplir à la main, jamais par défaut).
- « Grenoble » : dans la copie publique du Studio il est anonymisé (« Villeexemple »,
  `interdits.ts:131`) ; **à vérifier dans le dépôt privé** que la liste porte bien le vrai mot.
  Côté site, garde existante + test sur le libellé de l'encart.
- Pas de faux témoignage : les contrôles SITE-04 (avis) et SITE-05 (noms, logos de clients) restent
  bloquants ; **ils n'attrapent pas** un personnage `nature: "invente"`/`"reel"` qui parle comme
  un client : nouveau contrôle bloquant côté Studio (tout personnage autre que « moi » qui
  témoigne d'un résultat bloque l'envoi) + attestation côté site sur le modèle
  `aucunNomNiLogoDeClient` ; l'encart n'affiche jamais de citation attribuée.
- Signature HMAC, horodatage, nonce, déjà en place ; aucun nouveau secret.

## 9. Découpage en petites PR

Règles : toutes en **brouillon** pendant le travail ; migrations additives ; test rouge d'abord ;
le worker doit savoir lire avant que l'app n'émette (fenêtre app/worker, AGENTS.md).

### Studio (dépôt `studio-axion-ia-public`, PR séparées)

Classification « à annoncer » : suit la règle écrite du Studio. Sont **à annoncer** à la session qui
met le Studio en ligne les PR qui touchent les fichiers partagés (`PLAN-LOTS-STUDIO.md:624` :
`src/domaine/types.ts`, `formats/*`, `services/videos.ts`, `fournisseurs/index.ts`, fiche vidéo)
ou la zone interface ; elles portent le label `sensible-a-fusionner` dès qu'elles envoient
quelque chose.

| PR      | Contenu                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Classe                                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **S-0** | Décision de contrat (ADR croisé) : le contrat du site fait foi. Doc seule.                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Pas à annoncer                                                                                                   |
| **S-1** | Aligner `corpsPasseport` sur le schéma du site ; liste fermée de thèmes ; champ `description` ; **bornes de longueur du site reprises dans les contrôles** (nouveaux SITE-xx bloquants, SITE-11 ramené à 20-60) ; retirer `generateur` et `credits` de l'envoi (le site ne les attend pas) ; contrôle « personnage qui témoigne » ; **test de contrat croisé** (JSON fixture du Studio validé par le schéma Zod du site, versionné dans les deux dépôts) ; régénérer `docs/site-videos/contrat/*.json`, `s4-contrat`, `s4-signature`. | **À annoncer à la session qui met le Studio en ligne** (touche `types.ts` partagé), `sensible-a-fusionner`                                          |
| **S-2** | Vignettes 4:3 et 1:1 + affiche 16:9 (décision D6) via le système de vignettes v2.                                                                                                                                                                                                                                                                                                                                                                                                                                                     | **À annoncer à la session qui met le Studio en ligne** (zone interface/miniatures)                                                                  |
| **S-3** | `archiverVideos` appelle `retirerAvantSuppression` ; test rouge d'abord.                                                                                                                                                                                                                                                                                                                                                                                                                                                              | **À annoncer à la session qui met le Studio en ligne** (`services/videos.ts` partagé)                                                               |
| **S-4** | `StockagePublic` réel sur R2, seau public dédié, réglage éteint ; **adopter la disposition de clés du site** `/medias/videos/<slug>/v<version>/<fichier>` avec `sha256`, `octets`, dimensions (le site vérifie par `HEAD`).                                                                                                                                                                                                                                                                                                           | **À annoncer à la session qui met le Studio en ligne** (`fournisseurs/index.ts`), `sensible-a-fusionner` ; seau + règle `/medias/*` = geste de Will |
| **S-5** | Branchement : `SITE_VIDEOS_URL`, `SITE_VIDEOS_SECRET`, `fournisseur.site = http`. Fiche manuelle datée de Will, aucun code.                                                                                                                                                                                                                                                                                                                                                                                                           | Pas à annoncer (config) mais geste de Will                                                                       |
| **S-6** | Déclencheur « validée » et rattrapage des vidéos déjà validées ou publiées (§ 1.7). Test rouge d'abord. | **À annoncer à la session qui met le Studio en ligne** (`services/videos.ts`) |

Aucune route de liste n'est demandée au Studio.

### Site (dépôt `axion-ia`)

Documentation : `docs/encarts-video/{AUDIT,PLAN,DECOUPAGE}.md` sur le modèle de ce dossier, et
ADR **0078** (numéro à revérifier sur les PR ouvertes ; 0034, 0036, 0050 sont en double).

| PR     | Contenu                                                                                                                                                                                                                                                                                                                                                                                           | Dépendances      |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| **E0** | Corriger « implémentations » (test sur les vrais `BLOG_CATEGORY_SLUGS`) ; identifiant unique par instance.                                                                                                                                                                                                                                                                                        | —                |
| **E1** | Module pur du répartiteur + tests (seuil, plafond, voisins, départage). Aucune E/S.                                                                                                                                                                                                                                                                                                               | —                |
| **E2** | Migration additive : colonnes vecteur sur `site_videos`, table d'affectations.                                                                                                                                                                                                                                                                                                                    | —                |
| **E3** | Embeddings vidéo à la réception (`after()`) + rattrapage nocturne.                                                                                                                                                                                                                                                                                                                                | E2               |
| **E4** | File/worker `videos-encarts`, branchement publication, cron nocturne, revalidation par `revalidateContent`, file « rééquilibrer » depuis `apresPublication`. **Ne fusionne qu'une fois E2 atterrie en production** (`prisma migrate status`) ; sinon le worker tolère la table absente (erreur attrapée, rien fait). L'émetteur étant dans le worker, « worker avant app » ne s'applique pas ici. | E1, E2 atterrie  |
| **E5** | Réglages console : schéma unique, action, page, menu, journal, test de parité.                                                                                                                                                                                                                                                                                                                    | E1               |
| **E6** | Rendu par affectation (blog d'abord) ; étendre `GABARITS_HOTES` puis guides, actualités, connaissances.                                                                                                                                                                                                                                                                                           | E4, E5, ADR 0078 |
| **E7** | Rotation des villes (hachage + évitement des communes proches).                                                                                                                                                                                                                                                                                                                                   | E1, E6           |
| **E8** | Facultatif : lecture sur place (option B), après ADR, mesure et décision de Will.                                                                                                                                                                                                                                                                                                                 | E6               |

**Mise en ligne** : un type de page à la fois, interrupteur `actif` d'abord éteint ; mesure
LCP/INP en médiane avant chaque allumage ; seuils calibrés sur le stock réel.

## 10. Préalables (gestes de Will) et risques

1. Choisir le contrat qui fait foi (recommandation : le site).
2. Choisir l'option de rendu A/B/C (recommandation : A).
3. Le geste de Will (seau R2 public), en 3 étapes simples :
   1. dans Cloudflare, créer un **nouveau seau R2 réservé aux vidéos publiques**, distinct du seau
      privé du Studio, et y autoriser la lecture publique ;
   2. dans Cloudflare, sur le domaine du site, ajouter une règle qui envoie tout `/medias/*` vers
      ce seau (jamais vers le seau privé) ;
   3. donner au Studio l'accès en écriture à ce seau (clés dans ses variables), puis dire « c'est
      fait » : la session du Studio relie alors le dépôt réel (S-4), réglage éteint.
4. Allumer les générateurs autorisés pour le site côté Studio (éteints par défaut).
5. Confirmer quelle session met le Studio en ligne (elle reçoit les annonces des PR sensibles).
6. Vérifier « Grenoble » dans la liste du dépôt privé du Studio.

Risques : stock vidéo trop faible pour 100 contenus/jour (plafond saturé ⇒ « pas d'encart »,
voulu, mais à mesurer) ; seuils de proximité provisoires ; embeddings éteints ; plan
`PLAN-W1-W4.md` introuvable (le reconstituer dans `docs/encarts-video/`).
