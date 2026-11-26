# Conception · Pinterest dans le Studio (calendrier → Zernio) et import en lot d'épingles

- Rôle : conception seule. Aucune ligne du Studio n'est modifiée par ce document.
- Dépôt lu : `studio-axion-ia-public`, branche `master`, commit `10d60d3` (clone `--depth 50`).
- Documentation Zernio lue le 2026-11-26 : `https://zernio.com/openapi.json` (version 1.841.0) et les pages publiques
  `docs.zernio.com/platforms/pinterest` (`/posts`, `/media`, `/reference`). L'extrait figé du dépôt
  (`docs/zernio/openapi-extrait-1.418.1.json`) porte déjà `PinterestPlatformData` (mêmes champs).
- Règles publiques respectées : aucun nom de personne, aucune IP, aucune clé, aucun identifiant réel (compte, tableau,
  post). Les identifiants ci-dessous sont des gabarits (`<accountId>`, `<boardId>`).

---

## 0. Ce que le code fait aujourd'hui (constat)

| Sujet | Où | Constat utile au plan |
| --- | --- | --- |
| Réseaux | `src/domaine/types.ts:1076` | `IdReseau = linkedin \| instagram \| facebook \| tiktok \| youtube \| youtube-shorts`. `ReseauDeclinaison` (l. 2054) en est un `Extract`. |
| Tables exhaustives | `Record<IdReseau, …>` dans `reseaux/codes.ts`, `reseaux/hashtags.ts` (`LIMITES_MOTS_DIESES`), `domaine/cadence/reglages.ts` (`NOMS`, `regles`), `domaine/buffer.ts` (`SERVICE_HISTORIQUE`), `domaine/ecriture-post/commentaire.ts` (`AVEC_LIEN`, `SANS_LIEN`), `domaine/republication/regles.ts`, `domaine/calendrier/formats-media.ts` (`LIMITES_FORMAT`, `NOM_RESEAU`), `components/calendrier/couleurs-reseaux.ts` | Ajouter `pinterest` à `IdReseau` casse la compilation à ces endroits : c'est la liste de travail de la PR 1, fournie par `tsc`. |
| Listes littérales | `RESEAUX_TAXONOMIE`, `RESEAUX_CADENCE`, `RESEAUX_REPUBLICATION`, `PREMIER_COMMENTAIRE_RESEAUX`, `mesures.ts:RESEAUX_LIEN`, `adaptation-derivation.ts:RESEAUX` | Non vérifiées par le compilateur : à traiter une par une (PR 1). |
| « Réseaux qui reçoivent un visuel » | **sept** copies de `["linkedin","instagram","facebook"]` : `envoi-visuel-creneau.ts:16`, `branchement-envoi-calendrier.ts:47`, `publications.ts:1323`, `zernio.ts:505`, `essai-zernio.ts:36`, `valider-entree.ts:75`, `rangement-contenus.ts:26` (+ `ReseauVisuelEnvoi`, `briques/visuels/reseaux.ts:Reseau`, zod `domaine/visuels/depot.ts:49,58`) | Une seule source à créer (PR 2) avant d'y ajouter Pinterest, sinon un oubli = un envoi refusé ou, pire, un réseau « prévu » jamais envoyé. |
| Corps Zernio | `fournisseurs/publication/zernio-corps.ts` | `RESEAUX_PLATEFORME` (envoi), `analyserCible` (`accountId`, `:fb:<page>`, `:li:<n°>`), `IMAGES_MAX`, `switch (plateforme)` → `platformSpecificData`. Toujours `isDraft`, `timezone Europe/Paris`, `metadata { origine:"studio", studioCle }`. |
| Liste fermée des routes | `zernio-client.ts:330` (`ROUTES`) | Toute route non listée est refusée : la lecture des tableaux doit y entrer (GET seulement). |
| Comptes | `fournisseurs/publication/zernio.ts:202` (`listerCanaux`) | Facebook et LinkedIn « éclatent » un compte en canaux (`:fb:`, `:li:`). Les autres plateformes passent telles quelles (`service = c.platform`) : un compte Pinterest y apparaît déjà, sans tableau. |
| Cible | `services/zernio-cibles.ts` | `CIBLE_EXPLICITE = ["facebook","linkedin"]` : jamais de cible par défaut pour ces deux-là. |
| Envoi d'un visuel | `publications.ts:1281` `envoyerVisuel` → `envoyerVisuelValide` | Le créneau est relu en base ; anti-doublon par `(visuelId, reseau, canal)` sous `sousVerrou` ; **toujours en brouillon** chez Zernio ; la promotion (`PUT {isDraft:false, scheduledFor}`) est faite plus tard par `promotion-envois.ts` après un GET (garde D5). |
| Tour du calendrier | `branchement-envoi-calendrier.ts` | Toutes les 5 min, porte `publicationEditorialeAutorisee` lue d'abord, un créneau validé → une ligne par réseau visuel ; `envoyerReel` → `envoyerVisuelDuCreneau`. |
| Rapatriement | `domaine/rapatriement-zernio.ts` (pur) + `services/rapatriement-zernio.ts` | `PLATEFORME_VERS_RESEAU` (inverse de `RESEAUX_PLATEFORME`, gardé par un test) ; un post est « connu » par `idExterne`, `cleEnvoi` ou clé d'envoi planifié ; sinon `reseau-inconnu` pour une plateforme absente de la table → **aujourd'hui un post Pinterest fait chez Zernio sort en écart `reseau-inconnu`, jamais au calendrier.** |
| Vue calendrier | `services/calendrier.ts` | Lit `creneauxEditoriaux` et `publications` du processus ; un créneau apparaît **avant tout envoi** (origine `creneau`). `FamilleEntree = "video" \| "carrousel"`. |
| Visuel | `domaine/visuels/visuel.ts` | `famille: carrousel \| carrousel-continu \| infographie` ; `rendu.pages[].x1Cle` = images envoyées à Instagram/Facebook ; `modeTexte` « simulation » refusé à l'envoi. |
| Persistance | `donnees/postgres/index.ts` | Table `documents (collection, id, data jsonb)` + **copie en mémoire du processus** rechargée au démarrage. Un script qui écrit dans Postgres hors du processus serveur n'est pas vu par la copie, et l'écriture suivante du serveur peut l'écraser. `appliquerLot` (`donnees/memoire`) = une transaction, puis la copie mémoire. |
| Imports existants | `app/(studio)/calendrier/importer/actions.ts` (L4-12), `services/import-plan/*` (L4-10) | Modèle à suivre : à blanc d'abord, idempotent par clé, créneaux nés « propose » → « à valider », contrôle « lus = créés ». |

### Ce que dit Zernio pour Pinterest (doc publique)

- `platformSpecificData` (`PinterestPlatformData`) : `title` (≤ 100), `boardId`, `boardSectionId` (avec `boardId`),
  `link` (URI de destination), `coverImageUrl` / `coverImageKeyFrameTime` (vidéo), `isAiGenerated`.
- **`boardId` est facultatif : absent, l'épingle part sur le premier tableau renvoyé par Pinterest.** La doc dit
  « Send boardId on every post ». → Même règle que la page Facebook : **jamais de tableau par défaut**, refus avant réseau.
- `content` = description de l'épingle, **800 signes** au plus (création et édition).
- **1 image ou 1 vidéo par épingle**, ni texte seul, ni carrousel. Images JPEG/PNG/WebP/GIF, 32 Mo max, **recommandé
  1000 × 1500 (2:3)** ; 1:1 et 1:2,1 acceptés. `altText` par média : 500 signes sur Pinterest.
- Après publication, **seule la description se modifie** : média, lien et tableau sont figés (un mauvais tableau ne se
  corrige qu'en retirant l'épingle).
- Tableaux : `GET /v1/accounts/{accountId}/pinterest-boards` → `{ boards: [{ id, name, description, privacy }] }`.
  `PUT` (tableau par défaut) et `POST` (création) existent : **le Studio ne les appelle pas** (hors liste fermée).
- Débit : « avoid bursts of 10 or more at once ». Un `publishNow` refusé rend **207** avec `post.status:"failed"`
  (le Studio n'utilise jamais `publishNow`, mais la promotion doit lire `platforms[].status` / `errorMessage`).
- Mesures par épingle : impressions, enregistrements (`saves`), clics.

---

## 1. Décisions de conception (à valider avant la PR 1)

1. **Le tableau fait partie de la cible**, comme la page Facebook : cible Studio `"<accountId>:pin:<boardId>"`.
   `listerCanaux` éclate un compte Pinterest en un canal par tableau (`genre: "tableau"`, nom « Compte · Tableau »).
   Avantages : `analyserCible`, `ciblesZernioPour` (cible explicite), `cleEnvoiPublication` (empreinte visuel, réseau,
   date, **compte+tableau**), l'anti-doublon et l'affichage du compte servent tels quels. `compteCible` du créneau porte
   cette cible ; aucun champ « tableau » séparé à garder cohérent.
2. **Pinterest ajouté à `CIBLE_EXPLICITE`** : rien de choisi = refus « choisissez le tableau », même avec un seul tableau.
3. **Une épingle est un `Visuel` de famille `"epingle"`** (ajout à l'union, stockage jsonb, **sans migration**) portant
   une image unique déjà fabriquée ailleurs ; aucun rendu Studio n'est lancé. Champs propres dans `Visuel.epingle`
   (titre, lien, texte alternatif, image). L'image est aussi exposée en `rendu.pages[0].x1Cle` pour réutiliser
   `verifierFichiers` / `envoyerVisuelValide` ; `rendu.pdfCle` reste vide et une garde refuse LinkedIn pour cette famille.
4. **Pinterest ne reçoit que des épingles** en V1 (famille `epingle`) : un carrousel 4:5 n'est pas envoyé sur Pinterest,
   une épingle n'est envoyée que sur Pinterest.
5. **Rien ne part sans validation** (ADR-0010) : l'import crée visuels et créneaux « à valider ». Un geste séparé
   « Valider ce lot » (confirmation explicite, nombre affiché) les passe « valide » ; seul le tour du calendrier envoie
   ensuite, en brouillon puis promotion, comme pour les carrousels.
6. **Texte alternatif : 125 signes** (valeur de référence `ALT_MAX_REFERENCE` du Studio), bien que Pinterest en
   accepte 500. Le relever est une décision séparée (question ouverte §6).
7. **Lien de destination obligatoire** pour une épingle du Studio (c'est le champ qui porte le trafic) : `https`, sans
   identifiants, ≤ 2 000 signes, **hôte dans une liste permise** (réglage, par défaut le domaine du site).
8. **Format** : 2:3 exigé (tolérance ± 1 %), largeur ≥ 1 000 px, JPEG/PNG/WebP, ≤ 20 Mo (marge sous 32 Mo). Contrôlé au
   dépôt par lecture de l'en-tête (`stockage.lireDebut`), jamais par l'extension seule.

---

## 2. Découpage en PR

Ordre : 1 → 2 → 3 → 4 → 5 → 6 → 7 ; 8 est indépendante après 3. Chaque PR est fusionnable seule **sans rien envoyer
de nouveau** : l'envoi Pinterest ne s'ouvre qu'en PR 5, derrière la porte existante, et l'essai borné le prouve.

### PR 1 · `pinterest` devient un réseau connu (types, tables, affichage) — aucun envoi

**Fichiers**
- `src/domaine/types.ts` : `IdReseau` += `"pinterest"` ; `TexteReseau` += `lien?: string` (le `titre?` existe déjà).
  `ReseauDeclinaison` **inchangé** (Pinterest n'est pas une déclinaison vidéo).
- Tables `Record<IdReseau, …>` listées au §0 : une entrée `pinterest` chacune —
  `CODES_RESEAU` (code court nouveau, unique : test existant de codes à étendre), `LIMITES_MOTS_DIESES` (2 à 5 mots,
  Pinterest les tolère mais ne les favorise pas), `cadence/reglages.ts` (`NOMS.pinterest = "Pinterest"`, règle
  d'espacement propre : 4/jour, 90 min mini entre deux épingles du même compte), `buffer.ts:SERVICE_HISTORIQUE`
  (`"pinterest"`), `ecriture-post/commentaire.ts` (`AVEC_LIEN`/`SANS_LIEN` : chaîne vide, pas de premier commentaire),
  `republication/regles.ts` (republication interdite : « pas de doublon d'épingle »), `calendrier/formats-media.ts`
  (`LIMITES_FORMAT.pinterest` : image seule, ratios `2:3` préféré, `1:1` toléré à l'affichage seulement ;
  `NOM_RESEAU.pinterest`), `couleurs-reseaux.ts` (teinte nouvelle passant le contraste existant).
- Listes littérales : `RESEAUX_TAXONOMIE` (donc `RESEAUX_CALENDRIER`, `IDS_RESEAUX_PLAN`) += `pinterest`.
  **Pas** dans `RESEAUX_CADENCE` ni `PREMIER_COMMENTAIRE_RESEAUX` ni `RESEAUX_REPUBLICATION` ni `mesures.ts:RESEAUX_LIEN`
  ni `adaptation-derivation.ts` (chacun avec un commentaire « Pinterest volontairement absent : … »).
- `src/reseaux/index.ts` (registre des profils) : profil `pinterest` (nom, monogramme, limites : titre 100, description
  800, alt 125, 1 image, ratio 2:3).
- `src/domaine/calendrier.ts` : `FamilleEntree` += `"epingle"` ; `lienMedia("epingle", id)` → fiche du visuel.
- `src/components/calendrier/*` : pastille et légende Pinterest (aucun nouvel écran).

**Données** : aucune ; `IdReseau` n'est stocké que comme chaîne dans le jsonb.

**Tests**
- `reseaux/registre.test.ts` : profil Pinterest présent et cohérent avec `LIMITES_FORMAT`.
- Test d'inventaire (nouveau, `src/domaine/reseaux-inventaire.test.ts`) : pour chaque liste littérale du §0, soit elle
  contient `pinterest`, soit elle figure dans une liste d'exclusions commentée → une nouvelle liste oubliée échoue.
- `couleurs-reseaux` : contraste AA de la nouvelle teinte.

**Risques** : un `switch` non exhaustif sur `IdReseau` (sans `Record`) qui tomberait dans un `default` silencieux →
recherche `switch (.*reseau` dans la revue de la PR ; `plateformeZernio("pinterest")` lève encore « non pris en
charge » : c'est voulu jusqu'à la PR 3.

---

### PR 2 · une seule liste des « réseaux qui reçoivent un visuel » (refactor sans effet)

**But** : supprimer les sept copies avant d'y ajouter Pinterest.

**Fichiers**
- Nouveau `src/domaine/visuels/reseaux-envoi.ts` :
  `export const RESEAUX_VISUEL_ENVOI = ["linkedin","instagram","facebook"] as const;`
  `export type ReseauVisuelEnvoi = (typeof RESEAUX_VISUEL_ENVOI)[number];`
  `export function estReseauVisuelEnvoi(r: string): r is ReseauVisuelEnvoi`.
- Remplacer les copies : `envoi-visuel-creneau.ts:16`, `branchement-envoi-calendrier.ts:47` (et le test `d.reseau === "tiktok"`
  devenu redondant), `publications.ts:1252,1323` (le type est ré-exporté pour les appelants), `zernio.ts:505`,
  `essai-zernio.ts:36,49` (message construit depuis la liste), `valider-entree.ts:75`, `rangement-contenus.ts:26`.
- `briques/visuels/reseaux.ts` (`Reseau`) et le zod de `domaine/visuels/depot.ts` **ne changent pas ici** (le dossier
  `briques/visuels` est copié dans l'image `studio-rendu` : imports relatifs seulement).

**Tests** : la suite existante doit passer sans modification d'attendus ; nouveau test « aucune copie littérale » :
lecture des sources `src/services/**` et refus de la chaîne `["linkedin", "instagram", "facebook"]` hors du nouveau
fichier.

**Risques** : quasi nuls (même valeur) ; c'est justement la PR qui doit être relue seule.

---

### PR 3 · corps Zernio Pinterest, tableaux, cible explicite — client prêt, envoi encore fermé

**Fichiers**
- `fournisseurs/publication/zernio-client.ts`
  - `ROUTES` += `{ methode:"GET", motif:/^\/v1\/accounts\/<SEGMENT_ID>\/pinterest-boards$/, route:"tableaux-pinterest" }`.
    **Aucun** `PUT`/`POST` sur cette route (test : refus de la porte).
  - `tableauxPinterest(accountId): Promise<{ id: string; name?: string; privacy?: string }[]>` (lecture, filtre des
    entrées sans `id` texte).
  - `RouteZernio` += `"tableaux-pinterest"` ; la journalisation masque l'identifiant (`masquerPersonne`, déjà utilisé).
- `fournisseurs/publication/zernio-corps.ts`
  - `RESEAUX_PLATEFORME.pinterest = "pinterest"` ; `IMAGES_MAX.pinterest = 1`.
  - `CibleZernio` += `tableauId?: string` ; `analyserCible` accepte `"<accountId>:pin:<boardId>"` avec
    `boardId` = `/^\d{1,24}$/` (segment numérique ; tout autre forme = « cible illisible »).
  - `DemandePublication` (dans `fournisseurs/types.ts`) += `epingle?: { titre: string; lien: string }`.
  - `mediasDemandes` : Pinterest → exactement **une image** (document, vidéo, ≥ 2 images = refus en phrase simple).
  - `case "pinterest"` du `switch` :
    - `cible.tableauId` absent → refus « Pinterest : aucun tableau choisi (le premier tableau du compte n'est jamais
      utilisé). » ;
    - `titre` : espaces normalisés, 1–100 signes, `exigerSansMotInterdit` ;
    - `lien` : `https`, sans `user:pass@`, ≤ 2 000, hôte ∈ `options.hotesLienPinterest` (nouvelle option, lue par
      l'appelant dans un réglage) sinon refus ;
    - `d.texte` (description) ≤ 800 signes ;
    - `specifique = { boardId, title, link, ...(d.contenuIA ? { isAiGenerated: true } : {}) }` ;
    - jamais `boardSectionId`, `coverImage*`, `firstComment`.
  - `premierCommentaireTransmissibleZernio("pinterest") === false` (déjà vrai par construction ; test explicite).
- `fournisseurs/publication/zernio.ts` (`listerCanaux`) : branche `c.platform === "pinterest"` → un canal par tableau
  `{ ...base, id: "<accountId>:pin:<boardId>", nom: "<compte> · <tableau>", genre: "tableau" }` ; compte sans tableau =
  aucun canal (le compte reste visible dans les réglages comme « sans tableau »). `CanalPublication.genre` += `"tableau"`.
- `services/zernio-cibles.ts` : `CIBLE_EXPLICITE` += `"pinterest"` ; message d'aide nommant les tableaux reliés.
- `fournisseurs/publication/zernio-client.ts`, fonction interne `promouvoir()` (garde D5 du `GET` avant `PUT`, appelée
  par `services/promotion-envois.ts`) : pour `platform === "pinterest"`, exiger `platformSpecificData.boardId ===`
  le tableau de la cible attendue (passé dans `DemandePromotionZernio`), sinon « à vérifier » et aucun `PUT`.
- `components/reglages/ConnexionsZernioReglages.tsx` : liste des tableaux par compte Pinterest (lecture seule).

**Données** : aucune.

**Tests** (`zernio-corps.test.ts`, `zernio-client.test.ts`, `zernio-cibles.test.ts`)
- **L'envoi porte le bon tableau** : cible `"acc:pin:111"` → `platforms[0].platformSpecificData.boardId === "111"`,
  `platform === "pinterest"`, `isDraft: true`, `metadata.studioCle` = clé d'envoi.
- Sans tableau, cible `"acc"` → refus avant réseau (client doublé : zéro requête).
- Titre 101 signes, description 801, lien `http:`, lien hors liste, 2 images, vidéo → refus nommés.
- `listerCanaux` : un compte, trois tableaux → trois canaux ; un tableau sans `id` ignoré.
- `ciblesZernioPour("pinterest", [])` avec un seul tableau → `CIBLE_ABSENTE` (jamais de défaut).
- Porte du client : `PUT /v1/accounts/x/pinterest-boards` et `POST …` refusés.
- Promotion : GET avant rendant un `boardId` différent → aucun `PUT`, état « à vérifier ».
- Test d'accord existant `RESEAUX_PLATEFORME` ↔ `PLATEFORME_VERS_RESEAU` : **échoue** tant que la PR 4 n'est pas là →
  la PR 3 ajoute aussi l'entrée inverse (voir PR 4) ou les deux PR sont fusionnées ensemble. Choix recommandé : mettre
  l'entrée `pinterest:"pinterest"` de `PLATEFORME_VERS_RESEAU` dès la PR 3 (une ligne), le reste du rapatriement en PR 4.

**Risques** : `boardId` réellement numérique ? (documenté en chaîne ; exemple numérique) → motif large `\d{1,24}` et
refus net sinon, à confirmer par l'essai réel (PR 5). Un compte avec des dizaines de tableaux allonge `listerCanaux` d'une
requête par compte Pinterest (une seule requête, pas une par tableau) : acceptable.

---

### PR 4 · rapatriement et synchro de retour Pinterest (lecture seule chez Zernio)

**Fichiers**
- `domaine/rapatriement-zernio.ts` : `PLATEFORME_VERS_RESEAU.pinterest = "pinterest"` (si pas déjà en PR 3) ;
  `PublicationARapatrier` garde `canalId = accountId` **complété du tableau** quand `platformSpecificData.boardId` est
  lu : `canalId = "<accountId>:pin:<boardId>"` (même forme qu'à l'envoi, pour que `nomsComptes` et l'anti-doublon
  retrouvent le canal). `mediaDiffuseur` : image, miniature https lue côté serveur (chemin RAP-3 inchangé).
- `PlateformePostZernio` (type) += `platformSpecificData?.boardId` en lecture.
- `services/rapatriement-zernio.ts` : `nomsComptes()` inclut les canaux tableau (nom « compte · tableau »).
- `services/calendrier.ts` : une publication rapatriée Pinterest s'affiche avec `famille: "epingle"`.
- Synchro de retour (statut publié / échec) : le chemin générique (`reconciliation-calendrier.ts` + relecture du post)
  marche par publication ; seule addition : lire `platforms[].status === "failed"` et `errorMessage` pour Pinterest
  (cas 207) et le traduire par `zernio-motifs-refus.ts` (motifs : « Unable to reach the URL », « requires a boardId »,
  « rate limit »).

**Données** : aucune (publications rapatriées = `publications`, déjà en jsonb).

**Tests** (`rapatriement-zernio.test.ts`)
- **Aucun doublon au rapatriement** : une épingle envoyée par le Studio (publication locale `cleEnvoi = K`,
  `idExterne = P`) + le même post lu chez Zernio (`_id = P`, `metadata.studioCle = K`) → `connus = 1`, `aCreer = []`.
- Variante « réponse perdue » : publication locale `etatEnvoi:"a-verifier"` **sans** `idExterne`, post Zernio avec
  `studioCle = K` → connu par la clé, rien créé.
- Variante « envoi planifié » : `envoisPlanifies` porte `cleDiffuseur = K` → connu.
- Deux passages successifs du rapatriement (non à blanc) sur le même post externe → 1 publication créée puis
  `existaient = 1`.
- Post Pinterest fait à la main chez Zernio (`origine` absente) → rapatrié, `origineDiffuseur:"externe"`, visible au
  calendrier, `canalId` avec tableau.
- Post Pinterest sans `boardId` lu → rapatrié avec `canalId = accountId` seul (affiché « tableau inconnu »), jamais écart.
- Plus aucun écart `reseau-inconnu` pour `platform:"pinterest"`.

**Risques** : la forme exacte de `platformSpecificData` dans `GET /v1/posts` n'est pas documentée pour Pinterest →
lecture défensive (absent = tableau inconnu, jamais une erreur).

---

### PR 5 · envoi d'une épingle depuis le calendrier (le Studio envoie, Zernio reçoit)

**Fichiers**
- `domaine/visuels/visuel.ts` : `famille` += `"epingle"` ; `modeTexte` += `"import"` ;
  `epingle?: { titre: string; lien: string; texteAlternatif: string; image: { cle: string; largeur: number; hauteur: number; mime: string; sha256: string; taille: number } }`.
- `domaine/visuels/depot.ts` (zod) : schéma de la famille `epingle` (les quatre champs obligatoires) ; `reseaux`
  accepte `"pinterest"` **seulement** pour cette famille.
- `domaine/visuels/reseaux-envoi.ts` (PR 2) : `RESEAUX_VISUEL_ENVOI` += `"pinterest"` et
  `reseauxEnvoiDeLaFamille(famille)` : `epingle → ["pinterest"]`, autres familles → les trois réseaux historiques.
- `services/publications.ts` (`envoyerVisuelValide`) : branche `pinterest` —
  - visuel `famille === "epingle"` exigé (sinon `VISUEL_REFUSE`) ;
  - fichier unique `v.epingle.image.cle`, alt = `v.epingle.texteAlternatif` ;
  - `demande.epingle = { titre: v.epingle.titre, lien: v.epingle.lien }`, `images: [{ url, texteAlternatif }]` ;
  - **titre et lien viennent du visuel, la description du créneau** (`c.textes.pinterest.texte`), comme la légende ;
  - `premierCommentaire` non vide → refus existant `PREMIER_COMMENTAIRE_NON_TRANSMIS`.
- `services/demande-publication-visuel.ts` : profil Pinterest (livrable `images`, `pagesMax: 1`, `legendeMax: 800`,
  `altMax: 125`) — **sans** toucher `briques/visuels/reseaux.ts` : la fonction lit un profil par
  `profilEnvoi(reseau)` qui délègue à `PROFILS_RESEAUX` pour les trois historiques.
- `services/envoi-visuel-creneau.ts` / `branchement-envoi-calendrier.ts` (`envoyerReel`) : textes alternatifs de
  l'épingle ; **plafond Pinterest de 3 envois par tour** (`PLAFOND_PINTEREST_PAR_TOUR`, constante, pas un réglage) :
  le reste attend le tour suivant (5 min), pour ne jamais faire la rafale de ≥ 10 que Zernio déconseille. Le plafond
  s'applique aussi aux promotions.
- `services/essai-zernio.ts` : l'essai borné accepte un créneau Pinterest (UN créneau, brouillon, jamais de promotion).
- Réglage : `publication.pinterest.hotes_lien` (liste d'hôtes permis pour le lien), lu par l'appelant et passé à
  `corpsPostZernio` ; vide = tout lien refusé (fermé par défaut).

**Données** : champs jsonb ajoutés (facultatifs pour les autres familles) ; **aucune migration**, aucune collection neuve.

**Tests**
- `envoyerVisuel` Pinterest (service doublé) : la demande transmise porte `cible "acc:pin:111"`, une image, l'alt du
  visuel, le titre et le lien du visuel, la description du créneau, `mode:"brouillon"`.
- Carrousel vers Pinterest → refus ; épingle vers Instagram → refus.
- Anti-doublon : deux appels → une seule publication, `deja: true` au second.
- Tour du calendrier : 7 créneaux Pinterest validés → 3 envois au tour 1, 3 au tour 2, 1 au tour 3.
- Porte fermée (`publicationEditorialeAutorisee` faux) → zéro lecture, zéro appel (test existant étendu à Pinterest).
- Réglage d'hôtes vide → refus nommé, zéro appel.

**Risques** : la promotion d'un brouillon Pinterest (`PUT isDraft:false`) n'a jamais été essayée → **essai réel borné
obligatoire avant d'ouvrir le tour** : un créneau, brouillon, lecture du post, contrôle du `boardId`, retrait. Tant que
l'essai n'est pas fait, `pinterest` reste hors de `RESEAUX_VISUEL_ENVOI` côté tour (drapeau de code levé dans une PR
d'une ligne après l'essai).

---

### PR 6 · import en lot d'épingles (JSON + images) → visuels + créneaux « à valider »

**Principe** : tout passe **dans le processus serveur** (route API authentifiée + action serveur), écritures par
`appliquerLot` (une transaction Postgres, puis la copie mémoire). Aucun script hors processus : il écrirait dans
Postgres sans que la copie mémoire du serveur le voie, et la prochaine écriture du serveur pourrait l'écraser.

**Format du fichier (version 1)**

```json
{
  "version": 1,
  "epingles": [
    {
      "cle": "guide-ia-pme-01",
      "titre": "…",
      "description": "…",
      "url": "https://<site>/…",
      "tableau": "<nom exact du tableau>",
      "texteAlternatif": "…",
      "image": "guide-ia-pme-01.jpg"
    }
  ]
}
```

- `cle` facultative (sinon `sha256(url + "\n" + tableau)`) ; elle rend l'import **idempotent** : identifiants dérivés
  `vis_epi_<h>` et `cre_epi_<h>` (h = 16 premiers hexa) → relancer le même fichier ne crée rien.
- `image` = nom d'un fichier déposé avec le lot (pas d'URL distante en V1 : pas de récupération serveur → pas de
  risque SSRF).
- `tableau` = **nom** du tableau, résolu en `boardId` par la liste lue chez Zernio : nom absent → ligne refusée ;
  nom porté par deux tableaux → ligne refusée (« ambigu, renommez ») ; jamais de tirage.

**Parcours** (page `app/(studio)/calendrier/importer-epingles/`)
1. Choisir le compte Pinterest (canaux du compte), le jour de départ, **les 4 heures** (défaut proposé, modifiable,
   jour de Paris), les jours exclus (facultatif), « alterner les tableaux » (coché par défaut).
2. Déposer le JSON → **à blanc** (action `analyserLotEpingles`, pure côté domaine) : erreurs par ligne, doublons
   (dans le fichier et déjà importés), tableaux résolus, planning proposé, liste des images attendues.
3. Déposer les images : adresses signées par `stockage.preparerDepot` (`typeEntite:"epingle"`), envoi direct du
   navigateur vers le stockage, puis `confirmerDepot` (sha256, taille) et contrôle du type réel + dimensions par
   `lireDebut` (en-têtes PNG/JPEG/WebP lus sans décoder l'image).
4. « Créer N épingles au calendrier » (action `importerLotEpingles`) : relit tout (fichier, images confirmées, tableaux,
   calendrier) et écrit en **un** `appliquerLot` : N `visuels` (`famille:"epingle"`, `statut:"a_valider"`,
   `modeTexte:"import"`, `reseaux:["pinterest"]`) + N `creneauxEditoriaux` (`visuelId`, `compteCible =
   "<accountId>:pin:<boardId>"`, `heuresParReseau.pinterest = <instant UTC>`, `textes.pinterest = { texte:
   description, premierCommentaire: "" }`, `statut:"a_valider"`, `origine:"vous"`, `decalages: 0`).
   Contrôle affiché « lus = créés + déjà là + refusés ».
5. « Valider ce lot » (action séparée, confirmation qui rappelle le nombre et la première/dernière date) : visuels
   `a_valider → valide`, créneaux `a_valider → valide` avec `valideeLe`/`valideePar` (transitions existantes, sous
   `sousVerrou`). Seul le tour du calendrier envoie ensuite.

**Planification (fonction pure `planifierEpingles`, `src/domaine/epingles/planification.ts`)**
- Entrées : épingles valides (ordre du fichier), jour de départ, heures (exactement 4, distinctes, triées), jours
  exclus, créneaux Pinterest **déjà au calendrier pour ce compte** (tous tableaux), horloge injectée.
- Sortie : jour + heure de Paris → instant UTC (`resoudreHeureParis`, gère les changements d'heure) ; un créneau déjà
  occupé (même compte, même heure) est sauté ; jamais dans le passé ni à moins de 2 h (marge > 30 min de promotion
  + tour) ; alternance des tableaux (tourniquet par tableau, ordre stable) si demandée ; `verifierEspacement` des
  règles Pinterest (PR 1).
- Résultat : `{ jour, heure, instant, epingleCle }[]` + avertissements (week-end, jour exclu sauté).

**Fichiers**
- `src/domaine/epingles/format-lot.ts` (zod du JSON, lecture, refus par ligne : titre 1–100, description 1–800, alt
  1–125 sans mot interdit, url https + hôte permis, tableau non vide, image `^[\w.-]{1,120}\.(jpe?g|png|webp)$`,
  doublons de `cle`).
- `src/domaine/epingles/planification.ts` (pur).
- `src/domaine/epingles/image.ts` (pur : lit largeur/hauteur/type depuis les premiers octets ; ratio 2:3 ± 1 %,
  largeur ≥ 1 000).
- `src/services/epingles/import-lot.ts` : `analyserLot` (à blanc), `preparerDepotsImages`, `confirmerImages`,
  `importerLot` (écriture `appliquerLot`), `validerLot` ; dépendances injectées (dépôts, stockage, client Zernio
  restreint à `tableauxPinterest`, horloge).
- `src/app/(studio)/calendrier/importer-epingles/{page.tsx, actions.ts}` : `exigerSession()` en tête de chaque action ;
  JSON ≤ 1 Mo (limite par défaut des actions serveur) ; 500 épingles max par lot.
- Lien depuis `calendrier/importer`.

**Données** : `visuels` et `creneauxEditoriaux` (collections existantes) ; journal de l'import dans `parametres` sous la
clé `import-epingles:<empreinte du fichier>` (rapport, compte lus/créés) — **aucune migration**.

**Tests**
- **Une épingle programmée apparaît au calendrier avant tout envoi** : import de 2 épingles (dépôts mémoire, client
  Zernio doublé qui **compte** ses appels) → `listerEntrees(du, au)` rend 2 entrées `origine:"creneau"`,
  `famille:"epingle"`, `reseaux:["pinterest"]`, statut `a_valider` ; le client a reçu **0** `creerPost` et 0 presign.
- Même test après « Valider ce lot » : toujours 0 appel tant que le tour n'a pas tourné.
- Idempotence : importer deux fois le même fichier → 2 créés puis 0 créé, 2 « déjà là ».
- `planifierEpingles` : 10 épingles, 4 heures → jours J, J, J, J, J+1 ×4, J+2 ×2 ; créneau déjà occupé sauté ;
  changement d'heure du dernier dimanche d'octobre et de mars ; alternance : jamais deux tableaux identiques
  consécutifs quand c'est possible.
- Tableau ambigu / inconnu → ligne refusée, les autres passent (rapport) ; erreur de **format** du fichier → rien écrit.
- Image 1080 × 1350 (4:5) → refusée ; 1000 × 1500 PNG → acceptée ; fichier `.jpg` qui est un PNG → type réel retenu ;
  image manquante → ligne « en attente d'image », jamais créée.
- Transaction : `appliquerLot` qui échoue au milieu → aucun visuel ni créneau dans la copie mémoire.
- Action sans session → refus avant lecture du corps.

**Risques**
- Images lourdes : dépôt direct navigateur → stockage (aucun octet d'image ne traverse le serveur) ; seuls les
  premiers octets sont relus.
- Gros lot validé d'un coup : la file d'envoi est lissée par le plafond de 3/tour (PR 5) et les brouillons ne partent
  qu'au fil des tours ; à vérifier que le tour ne prépare pas des brouillons des semaines à l'avance (sinon ajouter un
  horizon, ex. 7 jours, dans la ligne du tour pour Pinterest).
- Le nom du tableau peut changer chez Pinterest entre l'analyse et l'import → résolution refaite à l'étape 4.

---

### PR 7 · aperçu d'une épingle (fiche, calendrier) et retouche avant validation

**Fichiers**
- `components/visuels/ApercuEpingle.tsx` : image 2:3 (miniature servie par le serveur, jamais l'adresse signée brute
  au-delà de sa durée), titre (≤ 100, tronqué comme Pinterest), description, hôte du lien, tableau, mention
  « Généré par IA » si `contenuIA`.
- Fiche du créneau (`components/calendrier/FicheEntree*`) : pour `famille:"epingle"`, aperçu + champs modifiables
  **tant que le créneau n'est pas envoyé** (titre, lien, alt dans le visuel ; description dans `textes.pinterest`) ;
  après envoi, seule la description reste modifiable (règle Pinterest), le reste est grisé avec la raison.
- Changement de tableau = changement de `compteCible` (liste des canaux tableau) ; refusé après envoi.
- Le glisser-déposer existant (ADR-0014, `deplacer-programmation.ts`) fonctionne tel quel (le créneau est générique) ;
  test pour une épingle.

**Tests** : rendu de l'aperçu (titre long tronqué, lien affiché par son hôte), champs verrouillés après
`etatEnvoi:"envoye"`, déplacement d'une épingle validée → annulation de la version précédente (comportement existant).

**Risques** : faibles (interface).

---

### PR 8 (facultative) · mesures Pinterest

- `fournisseurs/mesures/zernio.ts` : lecture des métriques par épingle (impressions → `vues`, `saves`, `clicks`).
- `StatsPublication` += `enregistrements?: number; clics?: number` (facultatifs, jsonb).
- Tests de lecture défensive (champs absents = non mesuré, jamais 0).

---

## 3. Récapitulatif des tests exigés par la consigne

| Exigence | PR | Test |
| --- | --- | --- |
| Une épingle programmée apparaît dans le calendrier avant tout envoi | 6 | import → `listerEntrees` rend l'entrée, client Zernio à 0 appel (avant et après validation, avant le tour) |
| L'envoi Zernio porte le bon tableau | 3 (corps), 5 (chemin complet), 3 (promotion) | `platformSpecificData.boardId` = tableau de la cible ; refus sans tableau ; aucun `PUT` si le `GET` avant lit un autre tableau |
| Aucun doublon au rapatriement | 4 | connu par `idExterne`, par `studioCle` (même sans `idExterne`), par envoi planifié ; deux passages = une création |

## 4. Respect de la règle « rien chez Zernio hors calendrier »

- Le Studio n'a **aucun** chemin d'écriture Pinterest autre que `envoyerVisuel` depuis un créneau validé (PR 5) ; la
  liste fermée des routes refuse la création/le changement de tableau.
- Tout ce qui existe chez Zernio pour Pinterest remonte au calendrier par le rapatriement (PR 4), y compris une
  épingle faite à la main chez Zernio (`origineDiffuseur:"externe"`, signalée comme telle).
- L'écart calendrier ↔ Zernio (`compterEcart`) compte désormais Pinterest au lieu de l'ignorer comme
  `reseau-inconnu`.

## 5. Ordre de mise en ligne

1. PR 1, 2 (sans effet visible côté envoi).
2. PR 3 + entrée inverse du rapatriement ; PR 4 (les épingles faites chez Zernio apparaissent au calendrier).
3. PR 5 avec Pinterest **hors** du tour ; essai réel borné (un brouillon, contrôle du tableau, retrait) ; PR d'une
   ligne qui ouvre le tour.
4. PR 6 (import), PR 7 (aperçu) ; premier lot réel réduit (≤ 8 épingles, 2 jours) avant un gros lot.
5. PR 8 quand des épingles sont publiées depuis une semaine.

## 6. Questions ouvertes (à trancher par le fondateur)

1. Texte alternatif : garder 125 signes (valeur commune du Studio) ou autoriser 500 pour Pinterest ?
2. Hôtes permis pour le lien de destination : le seul domaine du site, ou une liste ?
3. Mention IA (`isAiGenerated`) : suivre `contenuIA` du visuel (proposé) ou toujours vraie pour les images générées ?
4. Heures par défaut des 4 créneaux quotidiens (proposition : 08:30, 12:30, 17:30, 21:00, heure de Paris).
5. Un seul compte Pinterest prévu ? (le plan en gère plusieurs, mais l'import demande d'en choisir un par lot.)
