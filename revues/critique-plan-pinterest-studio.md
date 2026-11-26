# Critique de complétude · plan « Pinterest dans le Studio » (calendrier → Zernio)

- Rôle : auditeur, lecture seule. Aucune ligne du Studio n'a été modifiée.
- Plan audité : `revues/conception-pinterest-studio.md`, branche `revue/conception-pinterest-studio` de ce dépôt.
- Dépôt lu : `studio-axion-ia-public`, branche `master`, commit `10d60d33` (#1752), **clone complet** (2 575 commits).
- Lu en entier ou en partie : `docs/adr/0001` à `0004`, `0010` à `0014` ; `docs/zernio/LISEZMOI.md`, `FINITIONS-RESTANTES.md` ;
  `docs/reseaux/REGLES-OFFICIELLES.md` ; `pilotage/REGLES-DE-FER.md`, `pilotage/consignes/auteur.md` ; `deploiement/` ;
  `deploiement/studio-rendu/Dockerfile`. PR relues : #1442 (retour « publié »), #1486/#1490/#1500/#1514/#1534/#1540/#1541/#1550
  (RAP-1 à RAP-3), #1232 (retrait), #1234 (déplacer), #1262 (CAL-22), #1284/#1300/#1348 (essai borné), #1411 (premier
  commentaire Instagram), et les PR ouvertes qui touchent la même zone (#1749).
- Documentation Zernio relue le 2026-11-26 : `https://zernio.com/openapi.json` (**version 1.843.0**, le plan citait 1.841.0) et
  `docs.zernio.com/platforms/pinterest` (`posts.mdx`, `media.mdx`, `analytics.mdx`, `reference.mdx`).
- Limite : les tests du Studio n'ont pas été lancés (dépendances du Studio non installées ici). Chaque fichier et chaque ligne
  cités ci-dessous ont été relus sur `master`.
- Décisions déjà prises (consigne) et appliquées au plan corrigé : texte alternatif **500 signes pour Pinterest seulement** ;
  hôte du lien = **domaine du site seul** (réglage) ; mention IA = **`contenuIA` du visuel** ; créneaux **08:30, 12:30, 17:30,
  21:00** heure de Paris ; **un seul compte Pinterest** (le code en tolère plusieurs).

---

## 1. Ce que le plan dit juste (vérifié sur `master`)

| Affirmation du plan                                                                                                                                                                                                                                                                                         | Vérification                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `IdReseau` à `src/domaine/types.ts:1076`, `ReseauDeclinaison` à l. 2054                                                                                                                                                                                                                                     | exact                                                                  |
| Copies de `["linkedin","instagram","facebook"]` : `envoi-visuel-creneau.ts:16`, `branchement-envoi-calendrier.ts:47`, `publications.ts:1252` (type) et `:1323`, `services/zernio.ts:505`, `essai-zernio.ts:36,49`, `valider-entree.ts:75`, `rangement-contenus.ts:26`, zod `domaine/visuels/depot.ts:49,58` | exact (mais il y en a d'autres, voir M-12)                             |
| Liste fermée `ROUTES` à `zernio-client.ts:330`                                                                                                                                                                                                                                                              | exact                                                                  |
| `promouvoir()` interne au client, appelée par `promotion-envois.ts`                                                                                                                                                                                                                                         | exact (`zernio-client.ts:998`, appel `promotion-envois.ts:232`)        |
| `listerCanaux` éclate Facebook/LinkedIn, laisse passer les autres plateformes                                                                                                                                                                                                                               | exact (`fournisseurs/publication/zernio.ts:202-227`)                   |
| `CIBLE_EXPLICITE = ["facebook","linkedin"]`                                                                                                                                                                                                                                                                 | exact (`services/zernio-cibles.ts:18`)                                 |
| Rapatriement : `PLATEFORME_VERS_RESEAU` inverse de `RESEAUX_PLATEFORME`, test d'accord, `reseau-inconnu` pour Pinterest aujourd'hui                                                                                                                                                                         | exact (`domaine/rapatriement-zernio.ts:36`, `raisonImpossible`)        |
| Persistance jsonb + copie mémoire, `appliquerLot` transactionnel                                                                                                                                                                                                                                            | exact (`donnees/memoire/index.ts:237`)                                 |
| `stockage.preparerDepot` / `confirmerDepot` / `lireDebut` existent                                                                                                                                                                                                                                          | exact (`fournisseurs/types.ts:624,626,638`)                            |
| `resoudreHeureParis`, `instantParis`, `verifierEspacement` existent                                                                                                                                                                                                                                         | exact (`lib/horloge-paris.ts:28,43`, `domaine/cadence/verifier.ts:59`) |
| `PinterestPlatformData` : `title` ≤ 100, `boardId`, `boardSectionId`, `link`, `coverImageUrl`, `coverImageKeyFrameTime`, `isAiGenerated` ; `boardId` absent = premier tableau                                                                                                                               | exact (spec 1.843.0)                                                   |
| 1 image ou 1 vidéo, JPEG/PNG/WebP/GIF, 32 Mo, 2:3 recommandé ; description 800 ; `altText` 500 sur Pinterest                                                                                                                                                                                                | exact (`media.mdx`, `MediaItem.altText` de la spec)                    |
| `GET /v1/accounts/{id}/pinterest-boards` → `{ boards: [{ id, name, description, privacy }] }` (plus `url` dans la page de doc), sans pagination                                                                                                                                                             | exact                                                                  |
| Rafales ≥ 10 déconseillées ; 207 + `platforms[].status:"failed"` sur `publishNow`                                                                                                                                                                                                                           | exact (`reference.mdx`)                                                |
| Règles publiques : aucun nom, aucune IP, aucune clé, aucun identifiant réel dans le plan                                                                                                                                                                                                                    | **respecté** (balayage du fichier : rien trouvé)                       |

---

## 2. MANQUES ET ERREURS du plan

Classement : **B** = bloquant (le résultat serait faux ou dangereux), **I** = important (oubli qui casse un écran, un test ou
une règle), **m** = mineur. Chemins relatifs à la racine du Studio, `master` `10d60d33`.

### 2.1 Bloquants

**B-1 · Une épingle importée n'apparaîtrait PAS au calendrier (semaine, mois), et le test proposé ne le verrait pas.**

- Le test du plan (§ PR 6, § 3) s'appuie sur `listerEntrees` de `src/services/calendrier.ts:42`. Cette fonction **n'est appelée
  par aucun écran** (seule occurrence : sa définition). La page `src/app/(studio)/calendrier/page.tsx` construit la semaine et
  le mois avec `listerCalendrier` (`src/services/publications.ts:1458`, appels `page.tsx:135,140,152`), qui ne lit que des
  **Publications**. Les créneaux seuls n'apparaissent que dans la vue « jour » (`PlanDuJour`, `charger-plan.ts:14`, statuts
  `propose | a_valider | valide`).
- Le chemin réel d'un carrousel est : créneau → `validerParLeFondateur` → `programmerVisuel`
  (`src/services/plan-vers-publication.ts:32`, appelé par `programmerEnUnClic`, `components/visuels/BoutonProgrammerVisuel.tsx:64`),
  qui crée une Publication `pub_<clé>` « manuel », statut `programmee`, et passe visuel et créneau à `programme`. **C'est cette
  Publication qui rend la carte visible** et c'est elle que le retour « publié » (#1442, `suivrePublicationConfirmee` dans
  `services/zernio.ts`) fait passer à `publiee`. Le plan (« Valider ce lot » = `a_valider → valide` seulement) produirait des
  épingles invisibles en semaine/mois, un créneau jamais `programme`, et un retour « publié » qui ne trouve pas `pub_<clé>`.
- `identifiantsProgrammation` (`services/plan-editorial.ts:114`) parcourt `RESEAUX_ENVOI` (`services/plan-editorial.ts:34`,
  liste littérale sans Pinterest) : même en appelant `programmerVisuel`, aucune Publication ne serait créée pour Pinterest.

**B-2 · Les grilles du calendrier filtrent sur une liste de 4 réseaux que le plan ne touche pas.**

- Le plan écrit « `RESEAUX_TAXONOMIE` (donc `RESEAUX_CALENDRIER`) ». Il confond deux constantes homonymes :
  `src/domaine/usine-calendrier.ts:27` (= `RESEAUX_TAXONOMIE`, contrat avec l'usine) et
  **`src/components/calendrier/BarreFiltres.tsx:9`** (`["linkedin","instagram","facebook","tiktok"]`, littérale).
- C'est la seconde que lisent la barre de filtres, `GrilleSemaine.tsx:317,324` (`reseaux.includes(e.reseau)`), `VueJour.tsx:52,55`,
  `GrilleMois.tsx:30`, `domaine/calendrier/regroupement.ts:61`, `ApercuPublication.tsx:298`, `EnTeteCalendrier.tsx:33` et la page
  (`page.tsx:62-64,96,168`). Sans Pinterest dans cette liste, **une épingle n'a ni pastille de filtre ni couloir** ; dès qu'un
  filtre réseau est posé, elle disparaît. Contraire à « tout ce qui est chez Zernio doit se voir au calendrier ».

**B-3 · Ajouter Pinterest au registre `RESEAUX` (`src/reseaux/index.ts:81`) l'ouvre à toute la chaîne VIDÉO.**

- Le plan propose « `src/reseaux/index.ts` : profil `pinterest` (nom, monogramme, limites…) ». Or `DefinitionReseau`
  (`src/reseaux/index.ts:33-58`) est un profil **vidéo** (durée max, export h264, LUFS, zones protégées, emplacements, fin au mot) ;
  `ratioPrefere: Ratio` n'accepte pas `2:3` (`Ratio = "9:16" | "1:1" | "4:5" | "16:9"`, `domaine/types.ts:26`).
- `listerReseaux()` (`src/reseaux/index.ts:210`) a **34 appelants**, dont les moteurs de montage (`moteurs/montage-tableau/*`,
  `montage-demo-facecam`, `conformite.ts`), les sous-titres (`services/sous-titres-par-reseau.ts`), le rôle « publication » du
  générateur (`generateur/roles/publication.ts`, écrit des textes avec Claude), la feuille d'envoi de la fiche vidéo
  (`services/comptes-envoi-zernio.ts:71`), les réglages (`Preferences.tsx`, `VosHashtags.tsx`). Pinterest y deviendrait une
  sortie vidéo possible, avec des appels Claude payants pour écrire ses textes.
- Tests qui cassent : `tests/reseaux/instantane-tables-formats.test.ts:157` (registre figé) et `:162` (zone combinée de tous les
  réseaux) ; `tests/taxonomie-contenu.test.ts:19` (`RESEAUX_TAXONOMIE` trié = ids de `RESEAUX`).

**B-4 · « Pinterest hors du tour tant que l'essai n'est pas fait » rend l'essai impossible.**

- L'essai borné passe par le même tour : `tourEnvoisCalendrierServeur` → `envoyerDepuisCreneau(deps, id)` → `deps.creneaux()`
  (`branchement-envoi-calendrier.ts:194`, filtre l. 219) → `envoyerReel` (l. 252, même filtre l. 253). Retirer
  Pinterest de la liste du tour retire aussi Pinterest de l'essai. Il faut **deux portes distinctes** : Pinterest admis pour le
  créneau d'essai, exclu du tour général tant qu'une constante n'est pas levée.

**B-5 · Texte alternatif 500 : le plan ne voit pas les trois plafonds à 125 en dur.**

- `ALT_MAX = 125` dans `fournisseurs/publication/zernio-corps.ts:16` (appliqué à toute image par `texteAlt`, l. 107) ;
  `ALT_MAX = 125` dans `services/branchement-envoi-calendrier.ts:48` (`textesAlternatifsDuVisuel`, l. 122, qui **ajoute
  « (page 1 sur 1) »**, absurde pour une épingle) ; `longueurAltMax` (`services/texte-alternatif-visuel.ts:15-17`) fait
  `Math.min(profil.altMax, ALT_MAX_REFERENCE.valeur)` : même un profil à 500 rendrait 125.
- `tests/reseaux/regles-officielles.test.ts:98` confronte `ALT_MAX` à `docs/reseaux/regles-officielles.json` : une constante
  Pinterest exige sa ligne dans le relevé.

**B-6 · La mention IA ne peut pas « suivre `contenuIA` du visuel » : ce champ n'existe pas.**

- `Visuel` (`domaine/visuels/visuel.ts:22-64`) n'a pas de `contenuIA`. `envoyerVisuelValide` (`services/publications.ts`, appel
  `service.envoyer` après l. 1385) ne pose jamais `contenuIA` dans la demande. Le plan PR 3 lit `d.contenuIA` : il serait
  toujours absent. Il faut le porter par l'épingle (`epingle.contenuIA`, obligatoire au format du lot) et le transmettre.

**B-7 · L'ADR-0004 (D6, D8, D10) n'est pas amendée.**

- D6 : « Chaque nouveau besoin d'API exige d'élargir la liste, donc une nouvelle ADR ou un amendement. » La route
  `GET /v1/accounts/{id}/pinterest-boards` n'est pas dans la liste de D6.
- D8 : la mention IA n'est transmise « que là où un champ existe : Instagram, TikTok » ; Pinterest `isAiGenerated` est un ajout.
- D10 : « texte alternatif exigé (125 signes) » pour toutes les images ; 500 pour Pinterest est un écart.
- D9 : cible explicite pour Facebook et LinkedIn ; Pinterest `:pin:<boardId>` est une troisième forme.
- Sans ADR-0015 (amendement), la PR 3 contredit une ADR « acceptée ».

### 2.2 Importants

**I-1 · Réglages : les comptes Pinterest ne s'afficheraient pas.** `src/app/(studio)/reglages/actions-zernio.ts:33`
`RESEAUX_CONNUS = ["instagram","facebook","linkedin","tiktok"]`, filtre l. 90 et 123. L'écran réel est
`components/reglages/Connexions.tsx` (`ConnexionsZernio`) ; `ConnexionsZernioReglages.tsx` cité par le plan n'est qu'un emballage.

**I-2 · Choix du tableau impossible avec un seul tableau.** `services/comptes-envoi-zernio.ts:51`
(`if (choix.length === 1 && reseau !== "facebook") return undefined;`) ne propose aucune case quand il n'y a qu'un canal ; or le
plan veut `CIBLE_EXPLICITE` pour Pinterest (« même avec un seul tableau ») → refus `CIBLE_ABSENTE` sans moyen de cocher.
De même `calendrier/charger-comptes.ts:24` pose d'office le seul canal comme `compteCible` d'un ajout manuel.

**I-3 · `ReseauDeclinaison` « inchangé » casse le typage de tout le chemin d'envoi.** Le tour, les envois planifiés et la
programmation sont typés `ReseauDeclinaison` : `domaine/envoi-planifie.ts:33,50,55` (`cleEnvoi`, `cleEnvoiCreneau`),
`services/envois-planifies.ts:12,39`, `services/envoi-depuis-creneau.ts:37,59`, `branchement-envoi-calendrier.ts:47,145,160,205,262`,
`services/plan-editorial.ts:34,114`, `plan-vers-publication.ts` (`plan: { reseau: ReseauDeclinaison }`). Il faut un type
`ReseauEnvoiCreneau = ReseauDeclinaison | "pinterest"` (et non élargir `ReseauDeclinaison`, qui pilote le générateur).

**I-4 · Cadence : contradiction interne.** Le plan veut « règle d'espacement propre : 4/jour, 90 min » mais exclut Pinterest
de `RESEAUX_CADENCE` (`domaine/cadence/reglages.ts:11`). `reglesParReseau()` (l. 104-108) ne construit des règles que pour
`RESEAUX_CADENCE` : `regles.pinterest` vaudrait `undefined` malgré le type `Record<IdReseau, …>`. Par ailleurs
`REGLAGES_CADENCE_DEFAUT.reseaux` (l. 110-118) est **l'endroit où vivent les heures par réseau** : les 4 créneaux décidés
(08:30, 12:30, 17:30, 21:00) doivent y être, et l'import doit les lire là, pas les coder dans la page.

**I-5 · Les deux ADR « calendrier » et « stockage » ne sont pas appliquées.** ADR-0012 : « avant toute programmation, le Studio
compare le contenu à ceux déjà publiés ou programmés (empreinte du texte et des visuels) » → l'import doit refuser ou signaler une
image (sha256) ou un couple (lien, tableau) déjà programmé, pas seulement une `cle` déjà importée. ADR-0011 : rangement par
réseau/format/contenu et « rien n'est supprimé » → le chemin de stockage des images d'épingles et l'absence de suppression doivent
être écrits.

**I-6 · Le dépôt des images doit passer par le service existant.** `services/envois.ts:17` tient la liste fermée
`TYPES_ENTITE` (`visage, voix, personnage, element, video, rush, accord, plan, entree`) et `commencerEnvoi` (l. 59) gère la taille
et le multipart. Appeler `stockage.preparerDepot` en direct contourne cette garde ; `typeEntite:"epingle"` y serait refusé
(« Destination inconnue ») tant qu'il n'y est pas ajouté.

**I-7 · L'édition après envoi est mal décrite.** Le plan (PR 7) laisse la description « modifiable après envoi (règle
Pinterest) ». Faux pour le Studio : l'édition passe par `POST /v1/posts/{id}/edit` (hors liste D6, hors ADR-0003 qui n'autorise
que deux formes de `PUT`) et Pinterest la tient en **bêta fermée** (« every edit request is rejected »). Après envoi, rien ne se
modifie depuis le Studio ; un changement = retrait (CAL-22/#1232, brouillon ou programmé seulement) puis recréation (CAL-23).

**I-8 · `zernio-motifs-refus.ts` n'existe pas.** Le plan PR 4 le cite. Les motifs fermés vivent dans
`fournisseurs/publication/zernio-erreurs.ts` (`CodeErreurZernio`, l. 36-55) et `domaine/guide-reseau/raison-refus.ts`. Le cas 207
est **déjà** traité génériquement par `creerPost` (`zernio-client.ts`, `STATUTS_ECHEC` l. 644, `issue: "echec" | "partiel"`) : il n'y
a rien à « ajouter pour Pinterest », seulement à tester.

**I-9 · Le domaine du lien a déjà sa garde.** `fournisseurs/publication/zernio-inbox-corps.ts:25` (`DOMAINES_PERMIS_PAR_DEFAUT`) et
`:76` (`lienDeChezNous`, https, sans identifiants ni port) + code d'erreur `lien-hors-domaine` (`zernio-erreurs.ts:55`, dans
`CODES_AVANT_RESEAU`). Le plan invente `hotesLienPinterest` et un nouveau message. À réutiliser (export de `lienDeChezNous` dans un
module commun), avec la décision « domaine du site seul » : égalité stricte d'hôte, **sans** sous-domaine.

**I-10 · Les écrans de visuels avaleraient 500 épingles.** `visuels/services/vues.ts:13-18` (`filtres` de l'écran Carrousels)
liste **toutes** les familles ; les actions « refaire », « relancer le rendu » y sont calculées sur le statut. `domaine/visuels/
reseaux-visuel.ts:15` range tout ce qui n'est pas infographie en « carrousel » (« Mes contenus »). `services/calendrier.ts:27,32`
et `app/(studio)/calendrier/charger-medias.ts` (`pagesDuVisuel`) supposent carrousel/infographie.

**I-11 · Les fichiers de `src/domaine/visuels/` sont copiés dans l'image `studio-rendu`.** `deploiement/studio-rendu/Dockerfile:80`
(`COPY src/domaine/visuels /app/src/domaine/visuels`) et `:81` (`src/briques/visuels`). Le plan crée `src/domaine/visuels/
reseaux-envoi.ts` et modifie `visuel.ts` et `depot.ts` : ces PR deviennent des PR « qui touchent studio-rendu » (reconstruction de
l'image de rendu, fusion par le pilote, cf. #1746). Voir § 4.

**I-12 · Listes de réseaux codées en dur que le plan oublie.**

| Fichier:ligne                                                                                                                                                                         | Liste                                            | Effet sans Pinterest                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `components/calendrier/BarreFiltres.tsx:9`                                                                                                                                            | `RESEAUX_CALENDRIER` (4)                         | B-2                                                                                      |
| `services/plan-editorial.ts:34`                                                                                                                                                       | `RESEAUX_ENVOI`                                  | B-1, aucune Publication                                                                  |
| `app/(studio)/reglages/actions-zernio.ts:33`                                                                                                                                          | `RESEAUX_CONNUS`                                 | I-1                                                                                      |
| `components/calendrier/couleurs-reseaux.ts:18`                                                                                                                                        | `RESEAUX_COLORES`                                | pas dans la légende                                                                      |
| `app/globals.css:61-66` et `:156-161`                                                                                                                                                 | jetons `--res-*` (clair et sombre)               | trait neutre, test de contraste absent                                                   |
| `components/calendrier/DecalerEntree.tsx:19`                                                                                                                                          | `RESEAUX` (4, type migration)                    | épingle absente de « À reprogrammer »                                                    |
| `services/plan-vers-publication.ts:114`                                                                                                                                               | `NOMS_RESEAUX` (3)                               | nom brut « pinterest » au retrait                                                        |
| `services/retirer-programmation.ts:223`, `services/deplacer-programmation.ts:123`                                                                                                     | `NOMS_RESEAUX` (5)                               | nom brut dans les phrases                                                                |
| `domaine/calendrier/formats-media.ts:33`                                                                                                                                              | `NOM_RESEAU`                                     | (déjà vu par `tsc`)                                                                      |
| `components/ecrire/ListeStock.tsx:13-15`                                                                                                                                              | `NOMS_RESEAUX` avec `as Record<IdReseau,string>` | **non vu par `tsc`** (transtypage)                                                       |
| `components/visuels/BoutonProgrammerVisuel.tsx:18`                                                                                                                                    | `HEURES`                                         | sans effet (épingles hors « un clic ») mais à exclure explicitement                      |
| `app/(studio)/carrousels/[id]/actions.ts:129`, `app/(studio)/infographies/actions.ts:16`                                                                                              | copies 3 réseaux                                 | hors `src/services/**` : échappent au test de PR 2                                       |
| `services/import-buffer/plafonds.ts:14`                                                                                                                                               | `OPERATIONS_PAR_JOUR`                            | aucun plafond du jour Pinterest                                                          |
| `services/promotion-envois.ts` (via `controlerGrille`)                                                                                                                                | grille 20/h                                      | Pinterest sans plafond du jour                                                           |
| `components/calendrier/LegendeCalendrier.tsx:14`, `AjouterEntree.tsx:119,130`, `DupliquerEntree.tsx:71`, `PictoReseau.tsx:18`, `CarteEntreeCalendrier.tsx:67`, `apercu-reseau.ts:114` | lisent `RESEAUX`                                 | dépend du choix de B-3                                                                   |
| `services/publications.ts:216,1369,1475`                                                                                                                                              | `obtenirReseau(r).nom` (lève si inconnu)         | **plantage de la page calendrier** dès qu'une publication Pinterest existe hors registre |
| `components/calendrier/FicheEntree.tsx:360`                                                                                                                                           | `estReseauDeclinaison`                           | contrôleur de texte jamais lu pour une épingle                                           |
| `services/mots-capacites.ts:18`, `zernio-inbox-corps.ts:190,219`                                                                                                                      | inbox                                            | Pinterest n'a pas d'inbox : exclusion volontaire à commenter                             |

**I-13 · Contrat avec l'usine ouvert par effet de bord.** `RESEAUX_TAXONOMIE` alimente `domaine/usine-calendrier.ts:27,62`
(refus `reseau_inconnu` 422 du contrat 2) : y ajouter Pinterest ouvre le contrat à l'usine sans décision ni version de contrat.
`tests/usine-calendrier-schemas.test.ts:197` exige l'égalité des deux listes. Il faut découpler (V1 : Pinterest hors contrat usine).

**I-14 · Rapatriement : ce que le plan promet en § 4 est plus large que ce que le code lit.** `STATUTS_RAPATRIES =
["scheduled","draft","publishing"]` (`domaine/rapatriement-zernio.ts:10`) : une épingle **déjà publiée** chez Zernio sans passer
par le Studio n'est jamais rapatriée. Soit on l'écrit (limite connue, commune à tous les réseaux), soit on ajoute `published`
borné (hors périmètre de ce chantier : à décider par le fondateur). Par ailleurs l'identifiant de rapatriement
`cleRapatriement(postId, accountId)` (l. 50) doit **rester sur l'accountId** ; seul `canalId` porte le tableau.

**I-15 · Tableaux secrets.** La doc (`posts.mdx`) : « You cannot pin to a secret board you do not own » ; `privacy` vaut
`PUBLIC | PROTECTED | SECRET`. Le plan n'en dit rien : V1 = seuls les tableaux `PUBLIC` deviennent des canaux.

**I-16 · Une PR ouverte touche les mêmes fichiers.** #1749 (compte du diffuseur en pause, 402) modifie `zernio-client.ts`,
`zernio-erreurs.ts`, `services/zernio.ts`, `BandeauEcartDiffuseur.tsx`, `tests/zernio/rap2-synchro.test.ts`. La PR 3 du plan doit
partir après sa fusion (règle de fer 4 : deux fiches qui touchent le même fichier ne partent jamais ensemble).

**I-17 · « Zone zernio » et annonce.** `pilotage/REGLES-DE-FER.md` règle 3 et `pilotage/consignes/auteur.md` point 4 : la zone
Zernio n'est jamais touchée par une routine ordinaire ; zone partagée = annonce écrite puis « libre ». Les PR 2 à 6 touchent la zone
Zernio et le calendrier : elles sont « manuelles / zone zernio », lancées par la session qui tient la zone, avec annonce.

### 2.3 Mineurs

- m-1 · Le plan cite la spec 1.841.0 ; elle est en **1.843.0** (rien de changé pour Pinterest). L'extrait figé
  `docs/zernio/openapi-extrait-1.418.1.json` ne contient pas `/v1/accounts/{accountId}/pinterest-boards` (9 chemins seulement) ; la
  route doit y être ajoutée par une session qui joint zernio.com (`docs/zernio/LISEZMOI.md` : « ne pas modifier à la main »).
- m-2 · `docs/reseaux/regles-officielles.json` et `REGLES-OFFICIELLES.md` : aucune section Pinterest ; `tests/reseaux/
regles-officielles.test.ts:49-58` fixe la liste des réseaux actifs. `IMAGES_MAX.pinterest = 1` et `ALT_MAX_PINTEREST = 500`
  doivent y avoir leur cellule (niveau « officiel », source `media.mdx` et `MediaItem.altText`).
- m-3 · `ratioDe` (`domaine/calendrier/formats-media.ts:74-79`) classe une image 2:3 en **9:16** (écart logarithmique plus petit
  qu'avec 4:5) : ne jamais l'utiliser pour contrôler une épingle.
- m-4 · `LIMITES_FORMAT` (`formats-media.ts:24`) n'a pas de champ ratio : la ligne Pinterest = image JPEG/PNG/WebP, 20 Mo (marge
  sous 32), rien d'autre ; le ratio se contrôle dans le domaine de l'épingle.
- m-5 · `FENETRE_CREATION_MS = 6 jours` (`services/envoi-depuis-creneau.ts:74`) existe déjà : le brouillon n'est jamais créé à plus
  de 6 jours (médias gardés 7 jours). Le « risque à vérifier » du plan (PR 6) est **résolu** : pas d'horizon à ajouter. En revanche
  `promotion-envois.ts:232` n'appelle pas `promouvoir` avec `medias` : aucune re-téléversement n'est faite par le calendrier (sans
  effet tant que la création reste à ≤ 6 jours).
- m-6 · Le plafond « 3 par tour » est utile côté **création** (un lot de 500 validé d'un coup crée ~24 brouillons au premier tour :
  4/jour × 6 jours) ; côté **promotion**, `SuiviDebitImport` (`import-buffer/plafonds.ts`) tient déjà le débit (25 req/min, 20 par
  heure et par compte) : y ajouter `pinterest` dans `OPERATIONS_PAR_JOUR` suffit, pas de second plafond.
- m-7 · `ModeTexte` (`visuel.ts:10`) : ajouter `"import"` n'est lu par aucune garde existante (seul `"simulation"` est refusé,
  `publications.ts`) ; le garder, c'est un libellé utile, mais le dire.
- m-8 · `typeContenuDuVisuel` (`reseaux-visuel.ts:15`) : une épingle est une « image » (`TYPES_CONTENU = video | image | carrousel`).
- m-9 · `essai-zernio.ts:49` : le message nomme « LinkedIn, Instagram ou Facebook » ; à construire depuis la liste.
- m-10 · Promotion : la garde « `boardId` relu = tableau attendu » est bonne, mais `DemandePromotionZernio` (`zernio-client.ts:202`)
  n'a pas la cible ; l'appelant (`promotion-envois.ts:232`) connaît `e.cle` et le créneau, pas le tableau → il faut le relire dans
  la Publication (`canalId`) retrouvée par `cleEnvoi`.

---

## 3. Zernio pour Pinterest : ce qui est vérifié (doc lue le 2026-11-26)

| Point             | Valeur                                                                                                                                                                                                                                                                      | Source                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Emplacement       | `platforms[0].platformSpecificData` de l'entrée `platform:"pinterest"` ; `content` = description                                                                                                                                                                            | `posts.mdx`, schéma `PinterestPlatformData` |
| Champs            | `title` (≤ 100 ; absent = 1re ligne du texte ou « Pin »), `boardId` (chaîne ; absent = premier tableau), `boardSectionId` (avec `boardId`), `link` (URI), `coverImageUrl`, `coverImageKeyFrameTime` (vidéo), `isAiGenerated` (vrai = libellé « AI modified » ; faux = rien) | spec 1.843.0                                |
| Texte alternatif  | `mediaItems[].altText`, **500** sur Pinterest                                                                                                                                                                                                                               | `MediaItem.altText`                         |
| Description       | 800 signes (création et édition)                                                                                                                                                                                                                                            | `pinterest.mdx`                             |
| Médias            | 1 image (JPEG, PNG, WebP, GIF ; 32 Mo ; min 100 × 100 ; 2:3 1000 × 1500 recommandé, 1:1, 1:2,1) **ou** 1 vidéo (MP4/MOV, 2 Go, 4 s à 15 min, 2:3, 1:1 ou 9:16) ; ni carrousel ni texte seul                                                                                 | `media.mdx`                                 |
| Adresse du média  | publique, sans authentification, bon `Content-Type`, sans redirection HTML ; sinon « Unable to reach the URL »                                                                                                                                                              | `media.mdx`, `reference.mdx`                |
| Tableaux          | `GET /v1/accounts/{accountId}/pinterest-boards` → `{ boards: [{ id, name, description, privacy, url }] }`, sans pagination ; `PUT` (tableau par défaut) et `POST` (création) existent : **hors liste fermée**                                                               | spec, `posts.mdx`                           |
| Tableaux secrets  | on ne peut épingler sur un tableau secret dont on n'est pas propriétaire                                                                                                                                                                                                    | `posts.mdx`                                 |
| Après publication | seule la description se modifie, par `POST /v1/posts/{id}/edit`, **en bêta fermée chez Pinterest** ; titre, média, lien, tableau figés                                                                                                                                      | `posts.mdx`, `reference.mdx`                |
| Débit             | éviter les rafales de 10 ou plus                                                                                                                                                                                                                                            | `reference.mdx`                             |
| Mesures           | `GET /v1/analytics?platform=pinterest` : `impressions`, `saves`, `clicks` par épingle ; `/v1/analytics/pinterest/account-insights` (compte, 89 jours)                                                                                                                       | `analytics.mdx`                             |
| Inbox             | aucune (ni commentaires ni messages)                                                                                                                                                                                                                                        | `reference.mdx`                             |

---

## 4. Fichiers « recouverts » côté serveur

- **Aucune liste de fichiers recouverts ni garde de dérive n'existe dans le dépôt public.** Recherché : `deploiement/`
  (`docker-compose.yml`, `mettre-a-jour.sh` en `git pull --ff-only`, sans copie de fichiers source), `.gitignore`, `pilotage/`,
  `docs/`, `scripts/`, `tests/deploiement/`, mots `recouvr*`, `dérive`, `skip-worktree`, `assume-unchanged`. Le seul mécanisme
  qui remplace des sources est l'**image `studio-rendu`**, qui copie des dossiers du Studio
  (`deploiement/studio-rendu/Dockerfile:47-82`).
- Ce que le plan touche dans cette copie : `src/domaine/visuels/visuel.ts`, `src/domaine/visuels/depot.ts`, le nouveau
  `src/domaine/visuels/reseaux-envoi.ts` (copiés par la l. 80) ; `src/briques/visuels/reseaux.ts` (l. 81, le plan a raison de ne
  pas le toucher). Conséquence : PR « qui touche studio-rendu », reconstruction de l'image de rendu, imports **relatifs**
  seulement dans ces fichiers, fusion par le pilote. Le plan corrigé place la nouvelle liste **hors** de `src/domaine/visuels/`.
- Valeurs qui vivent sur le serveur, jamais dans le dépôt (à ne pas écrire dans une PR) : identifiants de compte et de tableau
  (base, paramètre `zernio.canaux` lu par `services/comptes-envoi-zernio.ts:15`), pages interdites, réglages.
- Si le pilote tient une liste privée de fichiers patchés sur le serveur, elle n'est pas lisible d'ici : **à confirmer par la
  session de mise en ligne avant la PR 1** (point de contrôle inscrit au plan corrigé).

---

## 5. Règles du dépôt public

- Le plan audité ne contient ni nom de personne, ni IP, ni clé, ni identifiant réel. ✅
- Le plan corrigé ci-dessous garde la même règle : gabarits `<accountId>`, `<boardId>` ; données de test fictives (`exemple.fr`) ;
  domaine du site lu dans un réglage (défaut = hôte de `BASE_PUBLIQUE`, déjà public dans `domaine/site-videos/contrat.ts:100`).
- Interdit dans les PR : identifiants de compte ou de tableau, captures de la console Zernio, listes privées du serveur.

---

## 6. Corrections à apporter, PR par PR

| PR du plan   | Corrections                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| (avant tout) | Ajouter une **PR 0 documentaire** : ADR-0015 (amende ADR-0004 D6/D8/D9/D10 et ADR-0012 pour Pinterest) ; section Pinterest du relevé `docs/reseaux/regles-officielles.json` + `.md` ; route ajoutée à l'extrait OpenAPI. Confirmation du pilote sur les fichiers serveur (§ 4) et annonce de zone (I-17).                                                                                        |
| PR 1         | Ne **pas** ajouter Pinterest à `RESEAUX` vidéo tel quel (B-3) : registre d'affichage séparé ; ajouter Pinterest à `BarreFiltres.RESEAUX_CALENDRIER` (B-2), `RESEAUX_COLORES`, jetons CSS clair/sombre, `DecalerEntree`, noms de réseau centralisés (I-12) ; `RESEAUX_CADENCE` **avec** Pinterest et ses 4 heures (I-4) ; découpler le contrat usine (I-13) ; tests figés à mettre à jour nommés. |
| PR 2         | Liste unique hors `src/domaine/visuels/` (I-11) ; couvrir aussi `src/app/**` (I-12) et `plan-editorial.ts:34` ; type `ReseauEnvoiCreneau` (I-3).                                                                                                                                                                                                                                                 |
| PR 3         | Après #1749 (I-16) ; ADR-0015 d'abord ; alt 500 par plateforme (B-5) ; garde de lien = `lienDeChezNous` exporté, hôte exact (I-9) ; tableaux `PUBLIC` seulement (I-15) ; `comptesACocherZernio` et `charger-comptes` (I-2) ; `RESEAUX_CONNUS` (I-1) ; promotion : tableau relu depuis la Publication (m-10). Retirer « motifs-refus » (I-8).                                                     |
| PR 4         | Garder `cleRapatriement` sur l'accountId (I-14) ; `obtenirReseau` ne doit plus lever pour Pinterest (I-12) ; famille `epingle` au calendrier ; écrire la limite « publié hors Studio non rapatrié ».                                                                                                                                                                                             |
| PR 5         | `contenuIA` porté par l'épingle (B-6) ; deux portes essai / tour (B-4) ; textes alternatifs sans suffixe de page ; `RESEAUX_ENVOI` + `identifiantsProgrammation` (B-1) ; plafond de **création** par tour, plafond du jour dans `OPERATIONS_PAR_JOUR` (m-6).                                                                                                                                     |
| PR 6         | « Valider ce lot » = `validerParLeFondateur` + `programmerVisuel` par créneau (B-1) ; test sur `listerCalendrier` et la page, pas `listerEntrees` ; heures lues dans la cadence (I-4) ; dépôt par `services/envois.ts` (I-6) ; anti-répétition ADR-0012 (I-5) ; écrans de visuels filtrés (I-10).                                                                                                |
| PR 7         | Aucune modification après envoi (I-7) ; avant envoi, modification = règle CAL-23 existante (retour « à valider »).                                                                                                                                                                                                                                                                               |
| PR 8         | `enregistrements`, `clics` facultatifs ; `vues` ← `impressions` existe déjà (`fournisseurs/mesures/zernio.ts:39`).                                                                                                                                                                                                                                                                               |

---

## 7. PLAN CORRIGÉ COMPLET (prêt à coder)

Ordre : 0 → 1 → 2 → 3 → 4 → 5 (+ essai réel, puis 5b) → 6 → 7 ; 8 indépendante après 5b. Chaque PR est fusionnable seule **sans
rien envoyer de nouveau**. Toutes les PR : test rouge d'abord, aucun appel réel, aucun interrupteur allumé, `pnpm typecheck` +
suites voisines vertes dans la routine cloud. PR 2 à 6 : zone Zernio / calendrier, annonce écrite et « libre » avant de coder.

### PR 0 · Décisions écrites (documents seulement, aucun code)

**Fichiers**

- `docs/adr/0015-pinterest-epingles.md` (nouveau, statut « brouillon, à valider par le fondateur ») — amende :
  - ADR-0004 **D6** : `+ GET /v1/accounts/{id}/pinterest-boards` (lecture). Restent refusés : `PUT`/`POST` sur cette route,
    `POST /v1/posts/{id}/edit`, `GET/POST /v1/connect/pinterest/*`.
  - ADR-0004 **D8** : Pinterest `platformSpecificData.isAiGenerated: true` si `epingle.contenuIA === true` ; rien sinon.
  - ADR-0004 **D9** : cible `"<accountId>:pin:<boardId>"` ; jamais le premier tableau ; tableaux `PUBLIC` seulement.
  - ADR-0004 **D10** : Pinterest = 1 image JPEG/PNG/WebP, ≤ 20 Mo, 2:3 ± 1 %, largeur ≥ 1 000 px ; texte alternatif **1 à 500**
    signes (les autres réseaux restent à 125) ; lien obligatoire, https, hôte **égal** au domaine du site (réglage).
  - ADR-0010 : un lot importé naît « à valider » ; le geste « Valider ce lot » vaut validation datée du fondateur, créneau par
    créneau ; rien ne part avant le tour.
  - ADR-0012 : anti-répétition de l'import (empreinte de l'image, couple lien + tableau).
  - Limites écrites : aucune modification d'une épingle envoyée ; publié hors Studio non rapatrié (comme les autres réseaux).
- `docs/reseaux/regles-officielles.json` + `REGLES-OFFICIELLES.md` : section `pinterest` (deux couches, cellules « officiel »
  pour Zernio : 1 média, description 800, titre 100, alt 500, 32 Mo, débit ; constantes `IMAGES_MAX.pinterest`,
  `ALT_MAX_PINTEREST`).
- `docs/zernio/openapi-extrait-1.418.1.json` : chemin `/v1/accounts/{accountId}/pinterest-boards` (GET seul), régénéré par une
  session qui joint zernio.com (pas à la main).

**Tests** : `tests/reseaux/regles-officielles.test.ts` — liste `ACTIFS` + `pinterest`, constantes confrontées.

**Point de contrôle hors dépôt** : la session de mise en ligne confirme qu'aucun fichier visé par les PR 1 à 7 n'est patché sur le
serveur (§ 4).

### PR 1 · Pinterest réseau connu, affichage seulement (aucun envoi, aucune vidéo)

**Fichiers**

- `src/domaine/types.ts:1076` : `IdReseau += "pinterest"` ; `TexteReseau` inchangé (titre et lien vivent dans l'épingle).
  `ReseauDeclinaison` (l. 2054) **inchangé**.
- `src/reseaux/hors-video.ts` (nouveau) : `RESEAUX_HORS_VIDEO: DefinitionAffichageReseau[]` =
  `[{ id: "pinterest", nom: "Pinterest", monogramme: "P", codeClassement: "PI", legende: { longueurMax: 800, longueurVisible: 100,
motsDieseMax: 5, motsDieseConseilles: 2 }, etiquetteIA: "Mention « modifié par IA » de Pinterest" }]` ;
  `definitionAffichage(id)` (cherche dans `RESEAUX` puis `RESEAUX_HORS_VIDEO`) ; `nomDuReseau(id)` (jamais de levée : repli sur
  l'identifiant).
- `src/reseaux/index.ts` : `RESEAUX` et `listerReseaux()` **inchangés** (vidéo seulement) ; `obtenirReseau` inchangé.
- Affichage par `definitionAffichage` / `nomDuReseau` : `components/calendrier/PictoReseau.tsx:18`,
  `CarteEntreeCalendrier.tsx:67` (`definition`), `LegendeCalendrier.tsx:14` (légende = `RESEAUX` + hors vidéo),
  `apercu-reseau.ts:114` (ratio d'aperçu : `"2:3"` en chaîne d'affichage pour Pinterest, hors type `Ratio`),
  `services/publications.ts:216,1369,1475`, `services/plan-vers-publication.ts:114`, `services/retirer-programmation.ts:223`,
  `services/deplacer-programmation.ts:123`, `components/ecrire/ListeStock.tsx:13`, `domaine/calendrier/formats-media.ts:33`
  (toutes ces tables de noms remplacées par `nomDuReseau`).
- `components/calendrier/AjouterEntree.tsx:119`, `DupliquerEntree.tsx:71`, `components/bibliotheque/BlocLicence.tsx:63`,
  `services/proposer-semaine.ts:102` : inchangés (ils lisent `RESEAUX` vidéo → Pinterest absent, voulu en V1 : une épingle ne
  naît que par l'import).
- Tables `Record<IdReseau, …>` (liste fournie par `tsc`) : `reseaux/codes.ts:9` (`CODES_RESEAU.pinterest = "PI"`, code unique),
  `reseaux/hashtags.ts:116` (2 à 5), `domaine/buffer.ts:21` (`"pinterest"`), `domaine/ecriture-post/commentaire.ts:33,41` (vide),
  `domaine/republication/regles.ts:27` (republication interdite), `domaine/calendrier/formats-media.ts:24`
  (`pinterest: { image: { mimes: ["image/jpeg","image/png","image/webp"], tailleMax: 20 * Mo } }`),
  `components/calendrier/couleurs-reseaux.ts:8` (`var(--res-pinterest)`).
- `src/app/globals.css` : `--res-pinterest` dans `:root` (près de l. 61-66) **et** `.theme-sombre` (près de l. 156-161), contraste
  ≥ 3:1 sur la surface (trait), comme les autres.
- `components/calendrier/couleurs-reseaux.ts:18` `RESEAUX_COLORES += "pinterest"`.
- `components/calendrier/BarreFiltres.tsx:9` `RESEAUX_CALENDRIER += "pinterest"` (ordre : après TikTok) ; vérifier
  `page.tsx:168` (« tous allumés = aucun filtre ») avec 5 réseaux.
- `components/calendrier/DecalerEntree.tsx:19` : Pinterest dans `RESEAUX` et dans le type `Reseau` de
  `components/migration/logique.ts:6` (affichage seulement).
- `domaine/cadence/reglages.ts` : `NOMS.pinterest`, `RESEAUX_CADENCE += "pinterest"` (l. 11),
  `REGLAGES_CADENCE_DEFAUT.reseaux.pinterest = un(["08:30","12:30","17:30","21:00"], 4, 210)` (l. 110-118 ; 210 min = écart
  mini entre deux créneaux décidés) ; `reglesDeDepart("pinterest")` sans règle PDF.
- `domaine/taxonomie-contenu.ts:16` `RESEAUX_TAXONOMIE += "pinterest"` (donc `IDS_RESEAUX_PLAN` : `validerCreneau` l'accepte).
- `domaine/usine-calendrier.ts:27` : `RESEAUX_CALENDRIER = RESEAUX_TAXONOMIE.filter((r) => r !== "pinterest")` avec commentaire
  « Pinterest hors contrat 2 de l'usine (V1) ».
- Listes volontairement sans Pinterest, chacune avec un commentaire « Pinterest volontairement absent : … » :
  `PREMIER_COMMENTAIRE_RESEAUX` (`ecriture-post/commentaire.ts:13`), `RESEAUX_REPUBLICATION` (`republication/regles.ts:23`),
  `mesures.ts:112-113`, `reseaux/adaptation-derivation.ts:12`, `liens-bio.ts:10`, `mots-capacites.ts:18`,
  `zernio-inbox-corps.ts:190,219`, `components/visuels/BoutonProgrammerVisuel.tsx:18`, `domaine/calendrier/manques.ts:56,62`.

**Tests**

- Nouveau `tests/reseaux/inventaire-pinterest.test.ts` : lit les sources (`src/**/*.ts{,x}`, hors tests), repère toute
  **liste littérale** d'au moins trois identifiants de réseau ; chacune doit contenir `pinterest` ou figurer dans une table
  d'exclusions commentée du test → une nouvelle liste oubliée échoue.
- `tests/taxonomie-contenu.test.ts:19` : `RESEAUX_TAXONOMIE` = `RESEAUX` ∪ `RESEAUX_HORS_VIDEO`.
- `tests/usine-calendrier-schemas.test.ts:197` : `RESEAUX_CALENDRIER` = taxonomie sans Pinterest ; `pinterest` → 422
  `reseau_inconnu`.
- `tests/reseaux/instantane-tables-formats.test.ts:157,162` : **inchangés et verts** (preuve que la chaîne vidéo ne bouge pas).
- `couleurs-reseaux` : jeton présent en clair et en sombre ; contraste.
- `BarreFiltres` : 5 pastilles ; `filtrerParReseau` garde une entrée Pinterest ; `GrilleSemaine`/`VueJour` rendent une carte
  `data-reseau="pinterest"`.
- `nomDuReseau("pinterest") === "Pinterest"` ; `listerCalendrier` ne lève plus avec une publication Pinterest.
- `plateformeZernio("pinterest")` lève encore « non pris en charge » (voulu jusqu'à la PR 3).

### PR 2 · Une seule liste des réseaux qui reçoivent un visuel (refactor sans effet)

**Fichiers**

- Nouveau `src/domaine/reseaux-visuel-envoi.ts` (**hors** `src/domaine/visuels/`, donc hors image de rendu) :
  `RESEAUX_VISUEL_ENVOI = ["linkedin","instagram","facebook"] as const`, `ReseauVisuelEnvoi`, `estReseauVisuelEnvoi(r)`,
  `type ReseauEnvoiCreneau = ReseauDeclinaison | "pinterest"`.
- Remplacer : `services/envoi-visuel-creneau.ts:16`, `branchement-envoi-calendrier.ts:47` (+ test redondant `d.reseau === "tiktok"`
  l. 253), `services/publications.ts:1252` (ré-export du type) et `:1323`, `services/zernio.ts:505`, `services/essai-zernio.ts:36`
  (message l. 49 construit depuis la liste), `services/valider-entree.ts:75`, `services/rangement-contenus.ts:26`,
  `app/(studio)/carrousels/[id]/actions.ts:129`, `app/(studio)/infographies/actions.ts:16`.
- Typage `ReseauEnvoiCreneau` (sans changer de valeur) : `domaine/envoi-planifie.ts:33,50,55`, `services/envois-planifies.ts:12,39`,
  `services/envoi-depuis-creneau.ts:37,59`, `branchement-envoi-calendrier.ts` (`occupantsDuCompte`, `messageOccupe`,
  `etatEnvoiDuCreneau`, `creneaux`), `services/plan-editorial.ts:34,114`, `services/plan-vers-publication.ts` (type de `plan`).
- Non touchés : `briques/visuels/reseaux.ts` (copié dans l'image de rendu) et le zod `domaine/visuels/depot.ts`.

**Tests** : suite existante sans changement d'attendus ; nouveau `tests/visuels/liste-unique-reseaux-visuel.test.ts` : aucune
occurrence de la suite littérale `"linkedin", "instagram", "facebook"` dans `src/services/**` et `src/app/**` hors du nouveau fichier.

### PR 3 · Corps Zernio Pinterest, tableaux, cible explicite (client prêt, envoi encore fermé)

Prérequis : PR 0 fusionnée (ADR-0015), #1749 fusionnée ou fermée.

**Fichiers**

- `fournisseurs/publication/zernio-client.ts`
  - `RouteZernio += "tableaux-pinterest"` ; `ROUTES` (l. 330) `+= { methode: "GET", motif: /^\/v1\/accounts\/<SEGMENT_ID>\/pinterest-boards$/ }`.
  - `ClientZernio.tableauxPinterest(accountId): Promise<TableauPinterestZernio[]>` (`{ id, name?, privacy? }`, entrées sans `id`
    texte écartées).
  - `promouvoir()` (l. 998) : `DemandePromotionZernio += tableauAttendu?: string` ; si `avant.platforms[0].platform === "pinterest"`,
    exiger `platformSpecificData.boardId === tableauAttendu`, sinon `{ etat: "refuse" }` et aucun `PUT` (le service le range en
    « à vérifier »).
- `fournisseurs/publication/zernio-corps.ts`
  - `RESEAUX_PLATEFORME.pinterest = "pinterest"` (l. 118) ; `IMAGES_MAX.pinterest = 1` (l. 23) ;
    `ALT_MAX_PINTEREST = 500` ; `texteAlt(brut, max)` (l. 107) et `mediasDemandes` (l. 152) passent `ALT_MAX_PINTEREST` pour
    Pinterest, `ALT_MAX` sinon ; Pinterest : exactement une image, ni document ni vidéo ni deux images (refus nommés).
  - `CibleZernio += tableauId?: string` ; `analyserCible` (l. 60) : `genre === "pin" && /^\d{1,24}$/.test(reste)`.
  - `DemandePublication` (`fournisseurs/types.ts`) `+= epingle?: { titre: string; lien: string }`.
  - `OptionsCorps += domaineSite?: string` (lu par l'appelant dans le réglage `site.domaine`, défaut = hôte de `BASE_PUBLIQUE`).
  - `case "pinterest"` (switch l. 210) : `tableauId` absent → refus « Pinterest : aucun tableau choisi (le premier tableau n'est
    jamais utilisé) » ; titre normalisé 1–100 + `exigerSansMotInterdit` ; lien : `lienDuSite(lien, domaineSite)` (https, sans
    identifiants ni port, **hôte égal**), ≤ 2 000, sinon `ErreurZernio("lien-hors-domaine")` ; `d.texte` ≤ 800 ;
    `specifique = { boardId, title, link, ...(d.contenuIA === true ? { isAiGenerated: true } : {}) }` ; jamais
    `boardSectionId`, `coverImage*`, `firstComment`.
  - `premierCommentaireTransmissibleZernio("pinterest") === false` (inchangé, testé).
- `fournisseurs/publication/liens-du-site.ts` (nouveau) : `lienDuSite(lien, domaine)` (égalité stricte) et `lienDeChezNous`
  déplacé depuis `zernio-inbox-corps.ts:76` (export, même comportement pour l'inbox).
- `fournisseurs/publication/zernio.ts` `listerCanaux` (l. 202-227) : branche `c.platform === "pinterest"` → pour chaque tableau
  `privacy === "PUBLIC"` : canal `{ ...base, id: "<accountId>:pin:<boardId>", nom: "<compte> · <tableau>", genre: "tableau" }` ;
  aucun tableau public → aucun canal.
- `services/zernio-cibles.ts:18` `CIBLE_EXPLICITE += "pinterest"` ; message nommant les tableaux reliés.
- `services/comptes-envoi-zernio.ts:51` : toujours une liste pour `facebook` **et** `pinterest` (lire `CIBLE_EXPLICITE` exporté).
- `app/(studio)/calendrier/charger-comptes.ts:24` : jamais de canal posé d'office pour Pinterest.
- `app/(studio)/reglages/actions-zernio.ts:33` `RESEAUX_CONNUS += "pinterest"` ; `components/reglages/Connexions.tsx` : tableaux
  lus au dernier « Tester » (depuis `zernio.canaux`, l'écran ne lit jamais Zernio), tableaux non publics signalés « non utilisables ».
- `services/import-buffer/plafonds.ts:14` `OPERATIONS_PAR_JOUR.pinterest = 20` (marge sous le débit Pinterest ; 4 épingles/jour
  prévues).

**Tests** (`tests/zernio/*`)

- Corps : cible `"acc:pin:111"` → `platforms[0] = { platform: "pinterest", accountId: "acc", platformSpecificData: { boardId: "111",
title, link } }`, `isDraft: true`, `metadata.studioCle` = clé ; `contenuIA` vrai → `isAiGenerated: true`, faux → absent.
- Refus avant réseau (client doublé à zéro requête) : sans tableau, titre 101, description 801, alt 501, alt vide, lien `http:`,
  lien avec identifiants, sous-domaine, autre domaine, 2 images, vidéo, document.
- Alt 500 accepté sur Pinterest, 126 refusé sur Instagram (non-régression).
- `tests/zernio/z1p-corps-contrat.test.ts` : le corps Pinterest valide le schéma de l'extrait.
- Client : `GET .../pinterest-boards` accepté ; `PUT` et `POST` sur la même route, `POST /v1/posts/x/edit` refusés sans appel.
- `listerCanaux` : 1 compte, 3 tableaux dont 1 `SECRET` → 2 canaux ; tableau sans `id` écarté.
- `ciblesZernioPour("pinterest", [])` avec un seul tableau → `CIBLE_ABSENTE` ; `comptesACocherZernio("pinterest", 1 canal)` → une
  liste d'un choix.
- Promotion : GET avant avec `boardId` différent → aucun `PUT`.
- Accord `RESEAUX_PLATEFORME` ↔ `PLATEFORME_VERS_RESEAU` : l'entrée inverse `pinterest: "pinterest"` est ajoutée **ici** (une ligne
  dans `domaine/rapatriement-zernio.ts:36`).

### PR 4 · Rapatriement et retour Pinterest (lecture seule chez Zernio)

**Fichiers**

- `domaine/rapatriement-zernio.ts` : `canalId` = `"<accountId>:pin:<boardId>"` quand `platformSpecificData.boardId` est une chaîne
  numérique, sinon `accountId` (lecture défensive) ; `cleRapatriement(postId, accountId)` **inchangé** (l. 50) ; `mediaDe`
  inchangé. Commentaire : publié hors Studio = non rapatrié (`STATUTS_RAPATRIES`, l. 10, inchangé).
- `PlateformePostZernio` (type, `zernio-client.ts`) : `platformSpecificData?: { boardId?: unknown }` en lecture.
- `services/rapatriement-zernio.ts:132` `nomsComptes()` (lit aujourd'hui `comptesZernioEnregistres`, `services/zernio.ts:160`) : y ajouter les noms des canaux tableau lus dans `zernio.canaux` (`canauxZernioEnregistres`).
- `domaine/calendrier.ts` : `FamilleEntree += "epingle"` ; `lienMedia("epingle", id)` → fiche du visuel.
- `services/calendrier.ts:27,32` et `app/(studio)/calendrier/charger-medias.ts` (`pagesDuVisuel`) : famille `epingle` pour un
  visuel épingle ; une publication rapatriée Pinterest garde `MEDIA_DIFFUSEUR` avec la famille `epingle`.
- Rien à ajouter pour le 207 : `creerPost` le traite déjà (I-8).

**Tests** (`tests/zernio/rapatriement-*.test.ts`)

- Connue par `idExterne` ; par `metadata.studioCle` sans `idExterne` (« réponse perdue ») ; par envoi planifié
  (`cleDiffuseur`) → `connus = 1`, `aCreer = []`.
- Deux passages non à blanc sur le même post externe → 1 création, puis `existaient = 1`.
- Post Pinterest fait chez Zernio (sans `origine`) → rapatrié, `origineDiffuseur: "externe"`, `canalId` avec tableau, visible par
  `listerCalendrier` et par la grille (filtre `pinterest` allumé et éteint).
- Sans `boardId` → `canalId = accountId`, jamais un écart.
- `compterEcart` : plus aucun `reseau-inconnu` pour `platform: "pinterest"`.
- `creerPost` 207 Pinterest `failed` → `ErreurZernio("creation-incomplete")`, publication « à vérifier ».

### PR 5 · Envoi d'une épingle depuis le calendrier (tour général encore fermé à Pinterest)

**Fichiers**

- `domaine/visuels/visuel.ts` (copié dans l'image de rendu : imports relatifs, PR « studio-rendu ») :
  `famille += "epingle"` ; `ModeTexte += "import"` ; `epingle?: { titre: string; lien: string; texteAlternatif: string;
contenuIA: boolean; image: { cle: string; largeur: number; hauteur: number; mime: "image/jpeg" | "image/png" | "image/webp";
sha256: string; taille: number }; cle: string }` ; `reseaux` typé `(Reseau | "pinterest")[]`.
- `domaine/visuels/depot.ts:62` : `famille` accepte `"epingle"` ; `reseaux` accepte `"pinterest"` **seulement** si
  `famille === "epingle"` (refine) ; schéma `epingle` strict.
- `domaine/reseaux-visuel-envoi.ts` (PR 2) : `RESEAUX_VISUEL_ENVOI += "pinterest"` ; `reseauxEnvoiDeLaFamille(famille)` :
  `epingle → ["pinterest"]`, autres → les trois historiques ; `PINTEREST_TOUR_GENERAL = false` (constante de code).
- `services/publications.ts` `envoyerVisuelValide` (après l. 1323) : branche Pinterest — `v.famille === "epingle"` exigé (sinon
  `VISUEL_REFUSE`), et réciproquement une épingle refusée sur tout autre réseau ; fichier unique `v.epingle.image.cle`, alt
  `v.epingle.texteAlternatif` (sans suffixe) ; `demande.epingle = { titre, lien }`, `contenuIA: v.epingle.contenuIA`,
  `images: [{ url, texteAlternatif }]` ; description = `c.textes.pinterest.texte` ; `verifierTextesAEnvoyer` sur description +
  titre + lien ; `premierCommentaire` non vide → `PREMIER_COMMENTAIRE_NON_TRANSMIS` (existant) ; `domaineSite` lu dans le réglage.
- `services/demande-publication-visuel.ts` + `services/texte-alternatif-visuel.ts` : profil Pinterest local
  (`livrable: "images"`, `pagesMax: 1`, `legendeMax: 800`, `altMax: 500`) sans toucher `briques/visuels/reseaux.ts` ;
  `longueurAltMax("pinterest") = 500` (l. 15-17, la borne `ALT_MAX_REFERENCE` ne s'applique pas à Pinterest).
- `services/branchement-envoi-calendrier.ts` :
  - `creneaux()` (l. 194-245) : une ligne Pinterest n'est produite que si `PINTEREST_TOUR_GENERAL` **ou** si le tour est l'essai
    de ce créneau (`essaiId`) ;
  - `envoyerReel` (l. 252-275) : accepte `pinterest` ; textes alternatifs = `[v.epingle.texteAlternatif]` ;
  - plafond `CREATIONS_PINTEREST_PAR_TOUR = 3` (création de brouillons ; le reste au tour suivant, 5 min) ; la promotion reste
    réglée par `SuiviDebitImport` (PR 3).
- `services/promotion-envois.ts:232` : `tableauAttendu` relu dans la Publication de `cleEnvoi` (`canalId` → `:pin:<boardId>`).
- `services/plan-editorial.ts:34` `RESEAUX_ENVOI += "pinterest"` → `identifiantsProgrammation` (l. 114) rend la ligne Pinterest.
- `services/valider-entree.ts:75` : `partSeule` compte Pinterest (liste PR 2).
- `services/essai-zernio.ts:36,49` : un créneau Pinterest est éligible (UN créneau, brouillon, jamais de promotion).
- Réglage `site.domaine` (lu par `lireParametre`, défaut = hôte de `BASE_PUBLIQUE`) ; vide ou illisible = tout lien refusé.

**Tests**

- `envoyerVisuel` Pinterest (service doublé) : demande avec `cible "acc:pin:111"`, une image, alt 500 du visuel sans
  « (page 1 sur 1) », titre et lien du visuel, description du créneau, `contenuIA`, `mode: "brouillon"`.
- Carrousel vers Pinterest → refus ; épingle vers Instagram → refus.
- Anti-doublon : deux appels → une publication, `deja: true`.
- Tour général avec `PINTEREST_TOUR_GENERAL = false` : 0 ligne Pinterest, 0 appel ; tour d'essai sur un créneau Pinterest :
  1 brouillon, 0 promotion.
- 7 créneaux Pinterest dans la fenêtre de 6 jours, tour ouvert (constante forcée en test) : 3 brouillons au tour 1, 3 au tour 2,
  1 au tour 3.
- Porte fermée (`publicationEditorialeAutorisee` faux) : zéro lecture, zéro appel (test existant étendu).
- Réglage `site.domaine` vide → refus `lien-hors-domaine`, zéro appel.
- `programmerVisuel` sur un créneau Pinterest validé → `pub_<clé>` « manuel » `programmee`, créneau et visuel `programme`.
- Retour « publié » (#1442, `tests/calendrier/retour-published.test.ts` étendu) : épingle publiée → créneau `publie`,
  `pub_<clé>` `publiee`, envoi `envoye`.

**Essai réel borné (hors PR, geste du fondateur)** : un créneau Pinterest d'essai, brouillon ; lecture du post (`boardId`,
`title`, `link`, `altText`, `isAiGenerated`) ; retrait (`client.retirer`). Puis **PR 5b d'une ligne** :
`PINTEREST_TOUR_GENERAL = true`. La promotion (`PUT isDraft:false`) n'est pas couverte par l'essai : premier lot réel réduit
(≤ 8 épingles, 2 jours) avant tout gros lot.

### PR 6 · Import en lot d'épingles → visuels + créneaux « à valider », puis « Valider ce lot »

**Format (version 1)** : `{ "version": 1, "epingles": [{ "cle"?, "titre", "description", "url", "tableau", "texteAlternatif",
"contenuIA", "image" }] }` — `contenuIA` booléen **obligatoire** ; `tableau` = nom exact d'un tableau `PUBLIC` ; `image` = nom de
fichier déposé avec le lot (pas d'URL distante).

**Parcours** (`app/(studio)/calendrier/importer-epingles/`, lien depuis `calendrier/importer`)

1. Compte Pinterest (canaux de `zernio.canaux`, l'écran ne lit pas Zernio ; « Tester » dans Réglages rafraîchit), jour de
   départ, heures **lues dans la cadence** (`REGLAGES_CADENCE_DEFAUT.reseaux.pinterest`, modifiables pour ce lot), jours exclus,
   « alterner les tableaux ».
2. JSON → `analyserLotEpingles` (à blanc, pur) : erreurs par ligne, doublons (fichier, déjà importés, **même image sha256**,
   **même lien + tableau** déjà programmé — ADR-0012), tableaux résolus, planning, images attendues.
3. Images : `commencerEnvoi` de `services/envois.ts` avec `typeEntite: "epingle"` (ajouté à `TYPES_ENTITE`, l. 17 ; `entiteId` =
   clé dérivée), rangement ADR-0011 `epingles/pinterest/2x3/<cle>.<ext>` ; confirmation (sha256, taille) ; type réel et dimensions
   lus par `lireDebut` (en-têtes PNG/JPEG/WebP), jamais par l'extension.
4. « Créer N épingles au calendrier » (`importerLotEpingles`) : relit tout (fichier, images, `zernio.canaux`, calendrier) et écrit
   en **un** `appliquerLot` : N `visuels` (`famille: "epingle"`, `statut: "a_valider"`, `modeTexte: "import"`,
   `reseaux: ["pinterest"]`, `entree: { type: "session" }`, `coutCentimes: 0`) + N `creneauxEditoriaux` (`visuelId`,
   `compteCible = "<accountId>:pin:<boardId>"`, `heuresParReseau.pinterest`, `textes.pinterest = { texte: description,
premierCommentaire: "" }`, `statut: "a_valider"`, `origine: "vous"`, `decalages: 0`). Contrôle affiché « lus = créés + déjà là +
   refusés ».
5. « Valider ce lot » (confirmation : nombre, première et dernière date) : pour chaque créneau, sous `sousVerrou`, visuel
   `a_valider → valide` (`transitionPermise`), puis **`validerParLeFondateur` + `programmerVisuel`** (même chemin que
   `programmerEnUnClic`) → Publication `pub_<clé>` « manuel » `programmee`, créneau `programme`. Aucun appel Zernio : seul le tour
   envoie ensuite (≤ 6 jours avant, 3 créations par tour).

**Fichiers**

- `src/domaine/epingles/format-lot.ts` (zod : titre 1–100, description 1–800, alt 1–500 sans mot interdit, url via
  `lienDuSite`, tableau non vide, `contenuIA` booléen, image `^[\w.-]{1,120}\.(jpe?g|png|webp)$`, ≤ 500 lignes).
- `src/domaine/epingles/image.ts` (pur : largeur/hauteur/type depuis les premiers octets ; 2:3 ± 1 %, largeur ≥ 1 000, ≤ 20 Mo).
- `src/domaine/epingles/planification.ts` (pur `planifierEpingles` : heures de la cadence, `resoudreHeureParis`, créneau occupé
  sauté — même compte, tous tableaux —, jamais à moins de 3 h — `MARGE_CREATION_MS` —, tourniquet des tableaux,
  `verifierEspacement` avec les règles Pinterest de la PR 1, avertissements).
- `src/services/epingles/import-lot.ts` : `analyserLot`, `preparerDepotsImages`, `confirmerImages`, `importerLot`, `validerLot` ;
  dépendances injectées (dépôts, envois, canaux enregistrés, horloge).
- `src/app/(studio)/calendrier/importer-epingles/{page.tsx,actions.ts}` : `exigerSession()` en tête de chaque action ;
  JSON ≤ 1 Mo.
- `src/services/envois.ts:17` : `TYPES_ENTITE += "epingle"`.
- `src/visuels/services/vues.ts:13-18` : `famille !== "epingle"` dans les quatre filtres de l'écran Carrousels ;
  `actionsPermises` (l. 50) : aucune action de rendu pour une épingle.
- `src/domaine/visuels/reseaux-visuel.ts:15` : `epingle → "image"`.
- Journal de l'import : paramètre `import-epingles:<empreinte du fichier>` (rapport, lus/créés/refusés).

**Tests**

- Import de 2 épingles puis « Valider ce lot » : `listerCalendrier` rend 2 publications Pinterest ; la page semaine
  (`GrilleSemaine`, filtre allumé) montre 2 cartes `data-reseau="pinterest"` ; client Zernio doublé : **0** `creerPost`, 0 presign.
- Avant validation : 2 créneaux `a_valider` visibles dans `chargerPlanDuJour` ; 0 appel.
- Idempotence : même fichier deux fois → 2 créés puis 0, 2 « déjà là ».
- Anti-répétition : même image sous une autre `cle` → ligne refusée ; même lien + tableau → ligne refusée.
- `planifierEpingles` : 10 épingles, 4 heures → J ×4, J+1 ×4, J+2 ×2 ; créneau occupé sauté ; changements d'heure (dernier
  dimanche de mars et d'octobre) ; alternance des tableaux.
- Tableau inconnu, ambigu ou non public → ligne refusée, les autres passent ; format du fichier faux → rien écrit.
- Image 1080 × 1350 → refusée ; 1000 × 1500 PNG → acceptée ; `.jpg` qui est un PNG → type réel ; image manquante → « en attente
  d'image », jamais créée.
- `appliquerLot` qui échoue → aucun visuel ni créneau dans la copie mémoire.
- Action sans session → refus avant lecture du corps.
- Écran Carrousels : aucune épingle listée.

### PR 7 · Aperçu d'une épingle et retouche avant envoi

**Fichiers**

- `components/visuels/ApercuEpingle.tsx` : image 2:3 (adresse lue par le serveur à la demande, jamais une adresse signée gardée),
  titre tronqué, description, hôte du lien, tableau, mention « modifié par IA » si `contenuIA`.
- Fiche du créneau (`components/calendrier/FicheEntree.tsx`) : pour une épingle, aperçu et champs (titre, lien, alt, `contenuIA`
  dans le visuel ; description dans `textes.pinterest`) modifiables **tant qu'aucun brouillon n'existe chez Zernio** ; ensuite,
  la règle CAL-23 existante (`deplacer-programmation.ts` : retrait confirmé puis recréation, retour « à valider ») ; **après
  publication, rien n'est modifiable** (édition Pinterest en bêta fermée, hors liste fermée).
- Contrôle de texte : `FicheEntree.tsx:360` appelle un contrôle Pinterest (description ≤ 800, titre ≤ 100) au lieu de
  l'ignorer.
- Changement de tableau = changement de `compteCible` parmi les canaux tableau publics, refusé après création du brouillon.

**Tests** : rendu (titre long tronqué, hôte du lien) ; champs verrouillés quand un brouillon existe ; tout verrouillé après
`publiee` ; déplacement d'une épingle validée → comportement CAL-23 (retrait puis nouvelle version) ; `DecalerEntree.enPost`
rend la ligne Pinterest.

### PR 8 (après 5b) · Mesures Pinterest

- `fournisseurs/mesures/zernio.ts:39` : `vues ← impressions` existe déjà ; ajouter `enregistrements ← saves`,
  `clics ← clicks` (facultatifs).
- `domaine/types.ts` (`StatsPublication`, fusion de déclarations en fin de fichier) : `enregistrements?: number; clics?: number`.
- Tests : champs absents = non mesuré (jamais 0) ; aucune autre plateforme modifiée.

---

## 8. Mise en ligne

1. PR 0 (validation de l'ADR-0015 par le fondateur), confirmation des fichiers serveur.
2. PR 1, PR 2 (aucun effet d'envoi).
3. PR 3 (après #1749), PR 4 : les épingles faites chez Zernio et encore à venir apparaissent au calendrier.
4. PR 5 (Pinterest admis pour l'essai seulement) ; essai réel borné ; PR 5b (tour général ouvert).
5. PR 6, PR 7 ; premier lot réel ≤ 8 épingles sur 2 jours ; promotion relue ; puis lots plus gros.
6. PR 8 après une semaine d'épingles publiées.

VERDICT: BON
