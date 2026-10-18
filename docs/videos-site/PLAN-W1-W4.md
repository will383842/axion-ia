# Vidéos sur le site — plan des lots W1 à W4

> **PLAN SEULEMENT.** Ce document ne livre ni code, ni migration, ni déploiement.
> Il décrit ce que les lots W1-W4 feront, dans quel ordre, avec quels tests, et ce
> qu'il reste à trancher par Will. Rédigé le 2026-10-18 à partir de la structure
> **réelle** du dépôt (`main` à `f5105c91`).

## 0. Ce qui est déjà décidé (rappel, non rediscuté ici)

- **Aucune vidéo publiée pour l'instant.** Côté studio : un interrupteur par
  générateur + une case par vidéo, **tout éteint**. Côté site : un interrupteur
  d'allumage, **éteint par défaut** (§ 2).
- Le site s'organise **par thème** (aucune page de thème sous 3 vidéos), par
  **séries**, avec un maillage vers les services, formations, articles et villes.
- Les fichiers sont servis sous **`https://axion-ia.com/medias/...`** — même domaine,
  compartiment R2 public dédié derrière une règle Cloudflare. **Pas de sous-domaine.**
- YouTube passe par Buffer, **côté studio** : rien dans ce dépôt.
- Le site n'affiche **aucun logo ni nom de client**, jamais « certifié Qualiopi » sans
  le réglage, jamais « Grenoble », jamais « Aucun gain garanti » (§ 3.6).

## 1. Ce que la lecture du dépôt a établi (et qui change le plan)

| Constat (fichier réel)                                                                                                                                                                                                   | Conséquence pour le plan                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/csp.ts` (CSP publique et admin, posée par `src/proxy.ts`) **n'a pas de directive `media-src`** : les médias retombent sur `default-src 'self'`.                                                                 | Les vidéos de `/medias/` passent **déjà**. W1 ajoute quand même un `media-src 'self'` **explicite**, verrouillé par un test : il empêche qu'un futur `default-src` plus large ouvre les médias à tous les domaines, ou qu'un plus strict les casse en silence. Aucun `https:` générique. |
| `next.config.ts` ne pose une CSP qu'aux routes `/document/*` (avec `media-src data: blob: https:`), hors périmètre.                                                                                                      | On ne touche pas `next.config.ts` pour la CSP.                                                                                                                                                                                                                                           |
| Le `matcher` de `src/proxy.ts` exclut déjà `api/` et `videos/` (fichiers statiques des VSL dans `public/videos/`).                                                                                                       | `/api/interne/videos` ne passe pas par le proxy. **`medias/` doit être ajouté à l'exclusion** : si la règle Cloudflare tombe, la requête ne doit pas partir dans next-intl (redirection `/fr/medias/...` absurde).                                                                       |
| `/videos/` est **déjà pris** par les fichiers statiques des VSL (`src/content/recrutement/vsl-apporteur.ts`, `src/lib/lp/video-disponible.ts`).                                                                          | Les pages de visionnage vivent sous **`/fr/videos/...`** (avec la locale, aucun conflit) ; les **fichiers** du studio sous **`/medias/videos/...`**, jamais sous `/videos/`.                                                                                                             |
| Les routes internes signées existantes sont sous **`/api/internal/`** (anglais : `revalidate`, `crm-webhook`, `deploy-notify`…).                                                                                         | Le nom validé par Will est **`/api/interne/videos`** (nouveau dossier). Incohérence de nommage signalée → **décision D1**.                                                                                                                                                               |
| `src/server/partners/enveloppe.ts` et `src/server/crm-sync/inbound.ts` signent déjà en HMAC-SHA256 « horodatage.corps exact », fenêtre **300 s**, horodatage **contraint aux chiffres**.                                 | Le contrat vidéo réutilise **exactement** cette doctrine (§ 3.2) — y compris le piège de non-injectivité si l'horodatage peut porter un point.                                                                                                                                           |
| `src/server/partages/config.ts` : interrupteur « éteint tant qu'une variable manque », compartiment R2 **dédié**, jeton **dédié**, compartiments de sauvegarde **refusés**.                                              | Même motif pour le compartiment des médias (§ 3.5).                                                                                                                                                                                                                                      |
| `src/server/qualiopi/config/flag.ts` : drapeaux lus en `process.env` brut, **hors schéma `env.ts`**, défaut sûr `false`.                                                                                                 | Le drapeau `VIDEOS_SITE_ENABLED` suit la même convention (aucun impact sur la validation Zod du build GH Actions).                                                                                                                                                                       |
| `tests/unit/ci/drapeau-runtime-jamais-fige-au-build.spec.ts` : un drapeau lu par une route `force-static` est **figé au build** (incident P3-01).                                                                        | **Aucune** route vidéo n'est `force-static`. Le drapeau n'est **jamais** un build-arg. Toutes les routes vidéo sont `force-dynamic` ou ISR courte + revalidation à la publication.                                                                                                       |
| `src/app/llms.txt/route.ts` et `src/app/llms-full.txt/route.ts` sont en **`runtime = "edge"`** et entièrement statiques.                                                                                                 | Pour y lister les vidéos (lue en base), il faut passer ces deux routes en **`runtime = "nodejs"`** — changement non trivial, isolé dans un commit à part de W3 (§ 6).                                                                                                                    |
| `src/proxy.ts` tourne en Edge et s'interdit Prisma ; `src/server/content-gen/tombstone.ts` documente que Next 16 n'a **pas** de `gone()` natif.                                                                          | Le **410** d'une vidéo retirée demande un mécanisme dédié (§ 5.6, décision D6).                                                                                                                                                                                                          |
| `src/lib/seo/extended-schemas.ts` a déjà un `buildVideoObjectJsonLd` minimal (avec `embedUrl` optionnel, `thumbnailUrl` en chaîne).                                                                                      | W2 l'étend (ou le remplace) : `thumbnailUrl` en **tableau**, **jamais** d'`embedUrl`, `hasPart` (Clip), `potentialAction` (SeekToAction).                                                                                                                                                |
| `src/components/lp/VslVideo.tsx` : `<video src poster preload="none" playsInline>` rendu côté serveur, suivi Plausible (`trackFunnel`), sous-titres, transcription repliable. `VslVideoDiffere.tsx` est en `ssr: false`. | W2 réutilise **`VslVideo`** (balise dans le HTML dès le départ), **pas** `VslVideoDiffere` (balise absente du HTML initial : contraire à la demande et invisible pour Googlebot avant hydratation).                                                                                      |
| `src/server/reviews/presence.ts` : règle « s'affiche d'elle-même dès qu'un avis est publié », cache mémoire 5 min, stub-aware.                                                                                           | Même règle pour les vidéos : **0 vidéo publiée = 0 page, 0 sitemap, 0 lien**, sans redéploiement au premier allumage.                                                                                                                                                                    |
| `src/app/sitemap-avis.xml/route.ts` rend **404** quand rien n'est publié, et `sitemap-index.xml` ne le liste alors pas.                                                                                                  | `sitemap-videos.xml` suit **exactement** ce motif (§ 6).                                                                                                                                                                                                                                 |
| `src/lib/indexnow.ts` : cascade agrégateur → Yandex → Naver, `api.indexnow.org` répond **403** pour le domaine depuis août.                                                                                              | IndexNow est un **bonus** (Bing/Yandex/Naver, **pas Google**) ; un échec doit **alerter**, jamais casser la publication.                                                                                                                                                                 |
| `package.json` → bucket « SOMME des page chunks PUBLICS » : **cliquet 285 KB** (ADR 0069), non plus 265 KB comme l'écrit encore `AGENTS.md`.                                                                             | Les nouvelles routes publiques tombent dans ce cliquet ; la marge restante se lit sur la sortie de `pnpm bundle:check` du dernier run vert avant W2 (§ 9).                                                                                                                               |

## 2. Interrupteur d'allumage côté site — ÉTEINT par défaut

```ts
// src/server/videos/config.ts (W1) — même convention que src/server/qualiopi/config/flag.ts
export function videosSiteActives(): boolean {
  return process.env.VIDEOS_SITE_ENABLED === "true"; // toute autre valeur → false
}
```

Lu **au runtime** uniquement (Coolify, scope RUN, conteneur **app**). **Jamais** posé
comme variable de dépôt GitHub Actions ni comme build-arg (cf. P3-01).

| État                                        | Réception `POST/DELETE /api/interne/videos`       | Pages `/fr/videos/**` | `sitemap-videos.xml` | Index des plans du site | `llms.txt`     | Encarts « En vidéo » |
| ------------------------------------------- | ------------------------------------------------- | --------------------- | -------------------- | ----------------------- | -------------- | -------------------- |
| **Défaut** : drapeau absent                 | **503** `reception_eteinte`, **rien n'est écrit** | 404                   | 404                  | non listé               | pas de section | aucun                |
| Drapeau `true`, 0 vidéo `publiee`           | acceptée                                          | 404                   | 404                  | non listé               | pas de section | aucun                |
| Drapeau `true`, ≥ 1 vidéo `publiee`         | acceptée                                          | rendues               | 200, ≥ 1 `<url>`     | listé                   | section        | sur pages du thème   |
| Drapeau repassé à `false` après publication | 503                                               | 404 (noindex)         | 404                  | non listé               | retirée        | retirés              |

Les deux dernières colonnes « sans vidéo » sont la règle **automatique** du § 1 (motif
`avisPublies`) : le drapeau n'est pas la seule garde, il est la **première**.

---

## 3. Contrat d'échange signé avec le studio

### 3.1 Adresses

| Méthode  | Adresse                         | Rôle                                                                                    |
| -------- | ------------------------------- | --------------------------------------------------------------------------------------- |
| `POST`   | `/api/interne/videos`           | Publier une vidéo, ou une **nouvelle version** d'une vidéo déjà publiée.                |
| `DELETE` | `/api/interne/videos`           | Retirer une vidéo (statut `retiree`).                                                   |
| `GET`    | `/api/interne/reglages-publics` | Prérequis P3 : le studio lit les réglages du site qui bornent ce qu'il peut dire (§ 4). |

Toutes : `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `Cache-Control: no-store`,
`X-Robots-Tag: noindex`. `robots.ts` interdit déjà `/api/` dans les douze blocs : rien à
ajouter. Limitation de débit par IP via `checkRateLimit` (`src/lib/rate-limit.ts`),
comme `src/app/api/internal/revalidate/route.ts`.

### 3.2 Signature (identique pour les trois adresses)

En-têtes **obligatoires** :

| En-tête              | Forme exacte                                                                 | Refus si absent / malformé |
| -------------------- | ---------------------------------------------------------------------------- | -------------------------- |
| `X-Axion-Horodatage` | secondes Unix, **chiffres seulement** `^[0-9]{10}$`                          | 400 `entetes_invalides`    |
| `X-Axion-Nonce`      | 32 caractères hexadécimaux minuscules (128 bits aléatoires) `^[0-9a-f]{32}$` | 400                        |
| `X-Axion-Signature`  | `v1=` + 64 caractères hex                                                    | 400                        |
| `Content-Type`       | `application/json` (POST/DELETE)                                             | 415                        |

Chaîne signée (HMAC-SHA256, clé `VIDEOS_STUDIO_HMAC_SECRET`, ≥ 32 caractères) :

```
v1\n<horodatage>\n<nonce>\n<MÉTHODE>\n<chemin exact, sans domaine ni requête>\n<sha256 hex du corps BRUT>
```

- **Le corps brut**, octet pour octet, jamais un objet re-sérialisé (même doctrine que
  `partners/enveloppe.ts`).
- **Méthode et chemin dans la signature** : une requête `GET reglages-publics`
  interceptée ne peut pas être rejouée en `DELETE videos`.
- Séparateur `\n` + champs à forme contrainte (chiffres, hex) : la chaîne est
  **injective**, le piège documenté dans `enveloppe.ts` ne peut pas se produire.
- Comparaison **à temps constant** sur des empreintes de longueur fixe (motif
  `constantTimeEquals` de `api/internal/revalidate/route.ts`).
- **Rotation** : `VIDEOS_STUDIO_HMAC_SECRET_PRECEDENT` accepté s'il est posé ; une
  signature valide avec l'ancien secret est journalisée `secret_precedent`.

### 3.3 Ordre des contrôles (chaque refus est un test)

1. Drapeau éteint → **503** `reception_eteinte` (avant tout, rien n'est lu ni écrit).
2. Secret absent ou < 32 caractères → **503** `reception_non_configuree`.
3. En-têtes absents/malformés → **400** ; corps > 256 Kio → **413** (lu avec plafond,
   **avant** le calcul du HMAC).
4. Horodatage hors de **± 300 s** → **401** `horodatage_hors_fenetre`.
5. Signature fausse → **401** `signature_invalide` (aucun détail sur la cause).
6. **Nonce déjà vu** (table `SiteVideoReception`, § 3.7) :
   - même empreinte de corps → **rejeu idempotent** : la réponse **enregistrée** est
     renvoyée telle quelle, avec `X-Axion-Rejeu: 1`, **sans aucun effet** ;
   - empreinte différente → **409** `nonce_reutilise`.
7. Schéma Zod **strict** (`.strict()`, aucun champ inconnu) → **422** avec la liste des
   champs fautifs.
8. Gardes de contenu (§ 3.6) → **422** `contenu_interdit` + règle enfreinte.
9. Fichiers (§ 3.5) : `HEAD` de chaque chemin `/medias/...` → 200, `Content-Length`
   égal à `octets`, `Content-Type` attendu, `Accept-Ranges: bytes` sur la vidéo → sinon
   **422** `fichier_injoignable` (rien n'est écrit).
10. Règles de version (POST) : même `studioVideoId` + même `version` + même contenu →
    **200** sans effet (rejeu du **fait**, distinct du rejeu réseau) ; `version`
    inférieure à celle en base → **409** `version_perimee` ; `slug` différent de celui
    déjà publié → **409** `slug_immuable` (§ 8.3).

### 3.4 `POST /api/interne/videos` — champs exacts (`schemaVersion: 1`)

Payload en **camelCase** (code de ce dépôt ; l'exception snake_case de Partners tenait à
un schéma publié par l'autre dépôt, ce n'est pas le cas ici).

```jsonc
{
  "schemaVersion": 1,
  "studioVideoId": "vs_01j9…", // ^[a-z0-9_-]{8,64}$ — identifiant STABLE côté studio
  "version": 3, // entier ≥ 1, strictement croissant par studioVideoId
  "slug": "automatiser-ses-relances", // ^[a-z0-9]+(-[a-z0-9]+)*$, ≤ 80 car., IMMUABLE une fois publié
  "langue": "fr", // littéral "fr" (EN désactivé, cf. AGENTS.md)
  "titre": "…", // 20..100 car.
  "description": "…", // 80..300 car. — meta description + JSON-LD
  "resume": "…", // 400..1 500 car. — texte visible sous le lecteur
  "aRetenir": ["…", "…", "…"], // EXACTEMENT 3, chacun 20..200 car.
  "questions": [
    // 2 à 3 questions-réponses VISIBLES
    { "question": "…", "reponse": "…" }, // question 10..160, réponse 40..600
  ],
  "theme": "automatisation", // valeur de la liste FERMÉE src/content/videos/themes.ts (D3)
  "serie": { "slug": "…", "titre": "…", "rang": 2 }, // ou null
  "lien": { "type": "service", "chemin": "/fr/implementation" }, // type ∈ service|formation ; chemin ∈ liste blanche (§ 5.5)
  "dureeSecondes": 184, // entier 5..3 600
  "chapitres": [
    // [] OBLIGATOIRE si dureeSecondes < 30
    { "titre": "…", "debutSecondes": 0 },
    { "titre": "…", "debutSecondes": 42 }, // strictement croissant, < dureeSecondes, jamais deux au même début
  ],
  "fichiers": {
    "video": {
      "chemin": "/medias/videos/<slug>/v3/video-1080p.mp4",
      "type": "video/mp4",
      "octets": 18234112,
      "sha256": "…",
      "largeur": 1920,
      "hauteur": 1080,
    },
    "affiche169": {
      "chemin": "/medias/videos/<slug>/v3/affiche-16x9.avif",
      "type": "image/avif",
      "octets": 48211,
      "largeur": 1280,
      "hauteur": 720,
    },
    "vignette43": {
      "chemin": "/medias/videos/<slug>/v3/vignette-4x3.avif",
      "type": "image/avif",
      "octets": 40100,
      "largeur": 960,
      "hauteur": 720,
    },
    "vignette11": {
      "chemin": "/medias/videos/<slug>/v3/vignette-1x1.avif",
      "type": "image/avif",
      "octets": 35500,
      "largeur": 720,
      "hauteur": 720,
    },
    "sousTitres": {
      "chemin": "/medias/videos/<slug>/v3/sous-titres.fr.vtt",
      "type": "text/vtt",
      "octets": 4100,
    }, // ou null (D8)
  },
  "transcription": "…", // texte intégral ou null — affiché replié
  "ia": { "voixGeneree": true, "doubleNumerique": false }, // pilote la mention AI Act art. 50
  "personnesALImage": { "williams": false }, // pilote le créateur JSON-LD (§ 5.3)
  "attestations": { "aucunNomNiLogoDeClient": true }, // littéral true, sinon 422
}
```

- Tout `chemin` de `fichiers` doit commencer par `/medias/videos/<slug>/v<version>/` :
  un fichier d'une autre vidéo ou d'une autre version est refusé.
- La **date de publication** (`uploadDate`) n'est **pas** envoyée : le site la fixe à la
  première réception acceptée et ne la change plus ; `dateModified` suit les versions.

Réponse 200/201 :

```json
{
  "ok": true,
  "statut": "publiee",
  "slug": "…",
  "url": "https://axion-ia.com/fr/videos/…",
  "version": 3,
  "rejeu": false
}
```

### 3.5 Stockage public des fichiers

- **Le studio écrit, le site lit.** Le studio dépose les fichiers dans le compartiment
  R2 dédié (jeton limité à ce compartiment, côté studio), **puis** appelle `POST`. Le site
  **ne détient aucune clé d'écriture** sur ce compartiment (surface minimale) — **D4**.
- Chemins **versionnés et immuables** (`…/v3/…`) → `Cache-Control: public,
max-age=31536000, immutable` posé par la règle Cloudflare. Une nouvelle version ne
  réécrit jamais un fichier en place : aucune purge de cache n'est nécessaire à la
  publication, et l'ancienne version reste servie jusqu'à ce que la page bascule.
- Le compartiment des sauvegardes (`axion-ia-backups`, `axion-ia-backups-immutable`) et
  celui des partages sont **refusés** comme compartiment média, comme dans
  `partages/config.ts`.
- **À vérifier avant W1 (D5)** : la « règle Cloudflare » qui sert `/medias/*` depuis R2
  sur le **même nom d'hôte**. Un domaine personnalisé R2 est **par nom d'hôte**, pas par
  chemin ; les deux montages connus sont (a) une route Worker `axion-ia.com/medias/*`
  liée au compartiment (le compartiment peut alors rester **privé**), (b) une règle
  d'origine avec réécriture d'hôte vers un domaine R2 (selon l'offre Cloudflare). Dans
  les deux cas, **exiger les requêtes `Range` (206)** : sans elles, Safari iOS ne lit pas
  la vidéo et l'avance rapide est impossible. Test de bout en bout au § 10.

### 3.6 Gardes de contenu (refus 422, testées une par une)

Appliquées à **tous** les textes reçus (`titre`, `description`, `resume`, `aRetenir`,
`questions`, `chapitres[].titre`, `serie.titre`, `transcription`) :

| Règle                                        | Détection                                                                                                                                                                                            |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Jamais « Grenoble »                          | `/grenoble/i` (la mention RCS des mentions légales est hors de ce flux et n'est pas touchée)                                                                                                         |
| Jamais « Aucun gain garanti »                | `/aucun\s+gain\s+garanti/i`                                                                                                                                                                          |
| Jamais « certifié(e) Qualiopi » sans réglage | `/certifi\S\*\s+qualiopi                                                                                                                                                                             | qualiopi\s+certifi/i`refusé tant que`isQualiopiCertificationObtenue()`est`false` |
| Aucun nom ni logo de client                  | attestation `aucunNomNiLogoDeClient: true` **obligatoire** + liste noire optionnelle `src/content/videos/termes-interdits.ts` (vide dans le dépôt public, alimentable sans y écrire de nom : **D9**) |
| Financements (CPF, OPCO…)                    | mêmes règles que `checkTranslationBannedWords()` quand `isQualiopiPublicDisclosureEnabled()` est `false`                                                                                             |

Le site **re-vérifie au rendu** (une page ne rend jamais « certifié Qualiopi » si le
réglage est retombé à `false` entre-temps : la garde est appliquée à la lecture, pas
seulement à la réception — leçon P3-01).

### 3.7 `DELETE /api/interne/videos`

```json
{ "schemaVersion": 1, "studioVideoId": "vs_01j9…", "motif": "obsolete" }
```

`motif` ∈ `obsolete | erreur | demande_tiers | autre`. Effets, **dans la même
opération** (§ 8.4) : statut `retiree`, `retireeLe = now()`, page en **410**, sortie du
plan du site vidéo, de `llms.txt`/`llms-full.txt`, des encarts et de la galerie, purge
Cloudflare des URL de pages, ping IndexNow. Idempotent : une vidéo déjà retirée → 200
`{ "statut": "retiree", "rejeu": true }`. Vidéo inconnue → 404. **Le studio supprime
ensuite ses fichiers** de R2 (après le 200) et en purge le cache — **D4**.

### 3.8 Journal `SiteVideoReception`

Une ligne par requête **signée valide** (après l'étape 5) : `nonce` (unique), méthode,
chemin, horodatage, `corpsSha256`, `studioVideoId`, statut HTTP et corps de la réponse
rendue, `recueLe`. Il sert à la fois d'**anti-rejeu**, d'**idempotence réseau** et de
**trace** (« qui a publié quoi, quand »). Aucune donnée personnelle. Pas de purge en W1
(quelques lignes par semaine) ; une purge > 90 jours pourra être ajoutée plus tard.

---

## 4. Prérequis P3 — réglages lus par le studio

### 4.1 Noms exacts dans le code du site (vérifiés)

| Ce que dit le plan studio        | Nom exact dans ce dépôt                                                                                                          | Nature                                                                                                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `QUALIOPI_CERTIFICATION_OBTENUE` | variable `QUALIOPI_CERTIFICATION_OBTENUE`, lue par **`isQualiopiCertificationObtenue()`** — `src/server/qualiopi/config/flag.ts` | **variable d'environnement** brute (`=== "true"`), hors `env.ts`, défaut `false`                                                                                                  |
| `avisPublies`                    | **`avisPublies()`** — `src/server/reviews/presence.ts` (et `statsAvisPublies()` pour compte + moyenne)                           | ⚠️ **ce n'est PAS un réglage** : c'est une **règle dérivée de la base** (≥ 1 `CustomerReview` `status = "published"`), sans interrupteur manuel depuis le 2026-10-09, cache 5 min |
| (utile au studio, non demandé)   | `OF_PUBLIC_DISCLOSURE_ENABLED`, lue par **`isQualiopiPublicDisclosureEnabled()`** — même fichier                                 | variable d'environnement ; distincte de la certification depuis le 2026-07-25 (F13)                                                                                               |

⚠️ Il **ne faut pas** que le studio lise ces valeurs dans la table `SiteSetting` : aucune
des trois n'y vit.

### 4.2 Adresse signée de lecture proposée

`GET /api/interne/reglages-publics` — signature du § 3.2 (corps vide ⇒ sha256 de la
chaîne vide). Le nonce est vérifié **en forme** mais **pas journalisé** : une lecture
rejouée est inoffensive, et ne pas écrire en base sur un GET évite qu'un studio en
boucle remplisse la table. Fenêtre de 300 s inchangée.

```json
{
  "schemaVersion": 1,
  "luLe": "2026-10-18T10:00:00.000Z",
  "qualiopiCertificationObtenue": false,
  "ofPublicDisclosure": true,
  "avisPublies": false,
  "videosSiteActives": false
}
```

Booléens seulement : **aucun compte, aucune moyenne, aucun identifiant** (ce que le
studio doit savoir, c'est s'il **peut dire**, pas combien). Le studio relit ces réglages
**au moment de générer** et **une seconde fois juste avant le `POST`** ; le site
re-vérifie de toute façon (§ 3.6). Ce `GET` est livré **avec W1** (même module de
signature, même secret).

---

## 5. Lot W1 — Réception

### 5.1 Fichiers

| Action   | Fichier                                                                | Contenu                                                                                                                                                               |
| -------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| créer    | `prisma/migrations/2026MMDDHHMMSS_site_videos_reception/migration.sql` | § 5.2                                                                                                                                                                 |
| modifier | `prisma/schema.prisma`                                                 | `enum SiteVideoStatut`, `model SiteVideo`, `model SiteVideoReception`                                                                                                 |
| créer    | `src/server/videos/config.ts`                                          | `videosSiteActives()`, `raisonExtinction()` (motif `partages/config.ts`), secret courant + précédent                                                                  |
| créer    | `src/server/videos/signature.ts`                                       | construction de la chaîne, vérification à temps constant, formes des en-têtes — **pur**, sans Prisma                                                                  |
| créer    | `src/server/videos/contrat.ts`                                         | schéma Zod `schemaVersion: 1` (POST, DELETE, réponse de lecture) — **seule** source des champs                                                                        |
| créer    | `src/server/videos/gardes-contenu.ts`                                  | § 3.6                                                                                                                                                                 |
| créer    | `src/server/videos/fichiers.ts`                                        | `HEAD` des chemins `/medias/...` via `MEDIAS_ORIGINE` (défaut `https://axion-ia.com`, surchargeable en test) ; `ssrfSafeFetch` existant                               |
| créer    | `src/server/videos/reception.ts`                                       | orchestration § 3.3 ; seul **écrivain** de `SiteVideo` (cf. les gardes « cliquet des écrivains » du dépôt)                                                            |
| créer    | `src/server/videos/lecture.ts`                                         | `videosPubliees()`, `videoParSlug()`, `videosDuTheme()` — **stub-aware** (`stub.invalid` → `[]` / `null` sans appel), cache mémoire 5 min + `revalidateTag("videos")` |
| créer    | `src/app/api/interne/videos/route.ts`                                  | `POST`, `DELETE`                                                                                                                                                      |
| créer    | `src/app/api/interne/reglages-publics/route.ts`                        | `GET` (§ 4.2)                                                                                                                                                         |
| modifier | `src/lib/csp.ts`                                                       | `"media-src 'self'"` explicite (CSP publique et stricte)                                                                                                              |
| modifier | `src/proxy.ts`                                                         | `medias/` ajouté à l'exclusion du `matcher`                                                                                                                           |
| modifier | `src/lib/__tests__/csp-*.spec.ts` (ou nouveau)                         | verrou `media-src 'self'`, sans `https:` générique                                                                                                                    |
| créer    | `tests/unit/ci/aucun-ecrivain-de-site-video-hors-reception.spec.ts`    | seul `reception.ts` appelle `prisma.siteVideo.create/update/upsert`                                                                                                   |
| créer    | `docs/adr/0070-videos-du-studio-sur-le-site.md`                        | décisions de ce plan une fois tranchées                                                                                                                               |
| modifier | `docs/subprocessors` / registre                                        | **rien** : Cloudflare R2 est déjà sous-traitant (`*.r2.cloudflarestorage.com` dans la CSP) — à confirmer dans `src/content/subprocessors.ts`                          |

### 5.2 Migration — additive, rétrocompatible avec les deux conteneurs

```sql
CREATE TYPE "SiteVideoStatut" AS ENUM ('publiee', 'retiree');

CREATE TABLE "site_videos" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "studio_video_id"     VARCHAR(64)  NOT NULL UNIQUE,
  "version"             INTEGER      NOT NULL,
  "slug"                VARCHAR(80)  NOT NULL UNIQUE,
  "statut"              "SiteVideoStatut" NOT NULL DEFAULT 'publiee',
  "theme"               VARCHAR(60)  NOT NULL,
  "serie_slug"          VARCHAR(80),
  "serie_titre"         VARCHAR(120),
  "serie_rang"          INTEGER,
  "titre"               VARCHAR(100) NOT NULL,
  "description"         VARCHAR(300) NOT NULL,
  "resume"              TEXT         NOT NULL,
  "a_retenir"           JSONB        NOT NULL,
  "questions"           JSONB        NOT NULL,
  "chapitres"           JSONB        NOT NULL DEFAULT '[]',
  "fichiers"            JSONB        NOT NULL,
  "transcription"       TEXT,
  "duree_secondes"      INTEGER      NOT NULL,
  "lien_type"           VARCHAR(20)  NOT NULL,
  "lien_chemin"         VARCHAR(200) NOT NULL,
  "ia_voix_generee"     BOOLEAN      NOT NULL DEFAULT false,
  "ia_double_numerique" BOOLEAN      NOT NULL DEFAULT false,
  "williams_a_l_image"  BOOLEAN      NOT NULL DEFAULT false,
  "corps_sha256"        CHAR(64)     NOT NULL,
  "publiee_le"          TIMESTAMPTZ  NOT NULL,
  "modifiee_le"         TIMESTAMPTZ  NOT NULL,
  "retiree_le"          TIMESTAMPTZ,
  "motif_retrait"       VARCHAR(20)
);
CREATE INDEX "site_videos_statut_theme_idx" ON "site_videos" ("statut", "theme");
CREATE INDEX "site_videos_serie_idx"        ON "site_videos" ("serie_slug", "serie_rang");

CREATE TABLE "site_video_receptions" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "nonce"           CHAR(32)    NOT NULL UNIQUE,
  "methode"         VARCHAR(8)  NOT NULL,
  "chemin"          VARCHAR(80) NOT NULL,
  "horodatage"      INTEGER     NOT NULL,
  "corps_sha256"    CHAR(64)    NOT NULL,
  "studio_video_id" VARCHAR(64),
  "reponse_statut"  INTEGER     NOT NULL,
  "reponse_corps"   JSONB       NOT NULL,
  "recue_le"        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "site_video_receptions_recue_le_idx" ON "site_video_receptions" ("recue_le");
```

Pourquoi c'est sûr pour **app + worker** (section « DEUX conteneurs » d'`AGENTS.md`) :

- **Deux tables neuves et un type neuf** : aucune colonne existante modifiée, aucune
  valeur d'énumération existante touchée. L'ancienne app et l'ancien worker les ignorent.
- **Le worker ne lit ni n'écrit ces tables, dans aucun lot W1-W4**, et **aucune file
  BullMQ n'est créée** : IndexNow est appelé depuis l'app par `src/lib/indexnow.ts` dans
  `after()` (§ 6). Il n'y a donc **aucune forme de job** à faire tolérer aux deux versions.
- Le worker peut atterrir ~50 min avant l'app et donc avant la migration (c'est
  l'entrypoint **de l'app** qui migre) : sans effet, il n'y touche pas.
- **Ordre de déploiement** : un seul créneau suffit — migration (entrypoint app) puis code
  app dans la même image. Le drapeau reste **éteint** ; il n'est allumé par Will
  **qu'après** avoir vérifié `prisma migrate status` et l'existence des deux tables
  (procédure « Un déploiement vert ne prouve PAS que le schéma a bougé »). Allumer le
  drapeau avant cette vérification ferait répondre la réception en 500 au lieu de 503.
- **Énumération** : `publiee | retiree` seulement. Si un statut doit s'ajouter plus tard,
  la PR qui l'**ajoute** ne doit pas être celle qui l'**écrit** (« ajouter avant de lire »).
- **Retour arrière** : supprimer le code laisse deux tables inertes ; aucune donnée
  métier existante n'est impactée. Le SQL de suppression est écrit dans l'ADR, jamais
  exécuté par défaut.

### 5.3 Garde `stub.invalid`

- `lecture.ts` : `if (process.env.DATABASE_URL?.includes("stub.invalid")) return [] / null`
  **avant** tout `prisma.*` (motif `reviews/presence.ts`). Le Proxy de `src/lib/prisma.ts`
  couvrirait déjà `findMany`/`findUnique`, mais l'early-exit explicite est la règle du
  dépôt et évite un rendu SSG sur données vides figé.
- `reception.ts` n'est jamais appelé au build (route `force-dynamic`) ; un test vérifie
  qu'avec `DATABASE_URL=…stub.invalid…` la route répond **503** et ne tente aucune
  mutation (le Proxy les fait lever).
- `SKIP_ENV_VALIDATION` / `BULLMQ_DISABLED` : **non concernés** — `VIDEOS_SITE_ENABLED`,
  `VIDEOS_STUDIO_HMAC_SECRET`, `MEDIAS_ORIGINE` sont lus en `process.env` brut, hors
  schéma `env.ts` (s'ils y sont déclarés, ce sera en `.optional()`, comme les `R2_*`).

### 5.4 Étapes (1 commit chacune, **test rouge d'abord**)

| #    | Commit                                                   | Test rouge écrit en premier (il échoue avant, passe après)                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1.1 | `videos: interrupteur éteint par défaut`                 | `config.spec.ts` : absent / `"false"` / `"1"` / `"yes"` → `false` ; seul `"true"` → `true` ; secret < 32 → raison d'extinction                                                                                                                                                                                                                                                                                                                                |
| W1.2 | `videos: signature HMAC v1 (pure)`                       | `signature.spec.ts` : signature **fausse refusée** ; horodatage à ±301 s refusé, ±299 s accepté ; horodatage avec point / non numérique refusé ; méthode ou chemin changé → refusé ; corps modifié d'un octet → refusé ; secret précédent accepté et signalé                                                                                                                                                                                                  |
| W1.3 | `videos: contrat Zod v1`                                 | `contrat.spec.ts` : champ inconnu → 422 ; `aRetenir` à 2 ou 4 → refusé ; 1 ou 4 questions → refusé ; chapitres sur vidéo de 29 s → refusé ; deux chapitres au **même début** → refusé ; chapitres non croissants → refusé ; chemin de fichier hors `/medias/videos/<slug>/v<version>/` → refusé                                                                                                                                                               |
| W1.4 | `videos: gardes de contenu`                              | `gardes-contenu.spec.ts` : « Grenoble », « aucun gain garanti », « certifié Qualiopi » (réglage `false`) → refusés ; « certifié Qualiopi » avec réglage `true` → accepté ; attestation absente → refusé                                                                                                                                                                                                                                                       |
| W1.5 | `videos: migration SiteVideo + journal`                  | `tests/integration/videos/schema.spec.ts` : création, unicité `slug`, unicité `nonce` ; `prisma validate` vert                                                                                                                                                                                                                                                                                                                                                |
| W1.6 | `videos: réception POST/DELETE`                          | `route.spec.ts` (Prisma mocké) : drapeau éteint → **503 et zéro écriture** ; **rejeu même nonce même corps → même réponse, `X-Axion-Rejeu: 1`, zéro effet** ; même nonce corps différent → 409 ; même `studioVideoId`+`version` nouveau nonce → 200 sans effet ; version inférieure → 409 ; slug changé → 409 ; **retrait → statut `retiree`** et `retireeLe` posé ; retrait rejoué → 200 `rejeu: true` ; fichier `HEAD` 404 → 422 sans écriture ; stub → 503 |
| W1.7 | `videos: lecture des réglages publics (P3)`              | `reglages-publics.spec.ts` : non signé → 401 ; signé → les quatre booléens, **et rien d'autre** (snapshot des clés) ; `avisPublies` suit `avisPublies()` mocké                                                                                                                                                                                                                                                                                                |
| W1.8 | `csp: media-src 'self' explicite + proxy exclut medias/` | `csp-media-src.spec.ts` : la CSP publique **et** stricte contiennent exactement `media-src 'self'` ; `proxy-matcher.spec.ts` : `/medias/videos/x/v1/video.mp4` ne matche pas, `/fr/videos/x` matche                                                                                                                                                                                                                                                           |
| W1.9 | `videos: un seul écrivain de SiteVideo`                  | garde `tests/unit/ci/…` (rouge si on ajoute un `prisma.siteVideo.update` ailleurs)                                                                                                                                                                                                                                                                                                                                                                            |

À la fin de W1 : rien n'est visible sur le site, même drapeau allumé (aucune page n'existe
encore). C'est voulu : W1 peut atterrir sans aucun risque public.
