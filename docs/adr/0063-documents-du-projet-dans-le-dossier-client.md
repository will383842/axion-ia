# ADR 0063 — Documents du projet dans le dossier client, stockés en base

- **Statut** : proposé (PR `feat/documents-projet`, label `schema` — approbation A02 bloquante)
- **Date** : 2026-10-01
- **Auteur** : A02 Architecte (spécification) + développeur du chantier (réalisation)
- **Constat** : premier cas réel, Teleos. Ce qui a été envoyé au client (l'e-mail tel qu'il est parti, le PDF joint, trois liens) et ce qui est interne (guide de l'auditeur, notes, compte rendu, devis) n'est rangé nulle part dans le dossier client. Décision du dirigeant (01/10) : « ça doit être stocké dans la base de données et pas sur un ordinateur ».
- **Prolonge** : ADR 0053 (dossier client : projets, clés composées « du même client », fusion réversible A3), ADR 0056 (RGPD du dossier client), ADR 0060 (registre de SQL brut par chantier et garde de dérive).
- **Référence** : `prisma/schema.prisma` (`DocumentProjet`, `DocumentProjetContenu`, `DocumentProjetOuverture`, enums `CoteDocumentProjet`, `NatureDocumentProjet`, `FormatFichierDocument`, `AnalyseAntivirusDocument`, `OrigineOuvertureDocument`, valeurs `document_*` de `ProjetEvenementAction`) ; route publique `src/app/document/[id]/[jeton]/route.ts` ; migration `prisma/migrations/20261001120000_documents_projet` ; plan d'architecture `_PLAN-SUITE-D-APPEL-2026-09-30/14-documents-projet/1-architecture.md`.

## Contexte

Le dossier client range tout par **projet** (fiche › onglet Projets › page du projet). Il n'y a aucun endroit pour les pièces d'un projet. Les trois modèles de fichiers existants ne conviennent pas : `ConsoleDocument`, `SocieteDocument` et `TrainerDocument` écrivent sur le volume `console-docs` (un disque du serveur, hors des sauvegardes de la base) et ne connaissent ni client ni projet.

Will aura des centaines de clients : la rubrique doit rester rapide (aucune liste ne doit charger des fichiers), étanche entre clients, et ne jamais rien détruire (ordre permanent du 29/09).

## Décision

### D1. Toujours dans un projet

Un document appartient à **un projet**, jamais à un client seul (version 1). Le dossier client exige déjà un projet pour ranger ; un document « sans projet » deviendrait une deuxième façon de ranger. Si le besoin apparaît, un nouvel ADR ajoutera une portée « entreprise », comme pour les faits.

### D2. Deux tables : les métadonnées, et les octets à part

- `documents_projet` : titre, côté, nature, date d'envoi, lien OU description du fichier, archivage, verdict antivirus, auteur.
- `documents_projet_contenus` : `document_id` (clé primaire et étrangère) et `octets bytea`.

**Pourquoi deux tables.** Prisma 5.22 rend toutes les colonnes scalaires sur un `findMany` sans `select`, et `omit` n'y est qu'en préversion (non activée ici). Avec une seule table, un oubli de `select` dans une liste chargerait 15 Mo par ligne. Avec deux, une liste **ne peut pas** charger les octets sans écrire `include: { contenu: true }` ou lire `documentProjetContenu` — ce que les tests interdisent hors de la route de téléchargement.

**Pas de relation Prisma vers `Projet` ni `Client`**, comme `ProjetContact` et `ProjetDevis` : la liaison est la clé composée en SQL brut. Cela évite aussi de toucher aux modèles `Projet` et `Client` (le chantier questionnaire, ADR 0062, travaille à côté).

**Pourquoi en base, pas sur un volume.** Décision du dirigeant : les documents suivent la sauvegarde de la base, sans second dispositif à sauvegarder (le volume `console-docs` n'est couvert par rien d'équivalent). Le coût — une base plus grosse — est borné par la taille maximale et le faible volume (quelques documents par projet).

### D3. Ce que la base garantit seule (SQL brut)

- **Aucun accès croisé** : clé composée `documents_projet_projet_meme_client (projet_id, client_id) → projets(id, client_id)`, `ON UPDATE CASCADE` (une fusion de fiches emporte les documents, « Défaire » les ramène), `ON DELETE RESTRICT`, `DEFERRABLE INITIALLY IMMEDIATE` (convention A3).
- **Exactement un de lien / fichier** ; un fichier porte ensemble nom, format, taille, empreinte et verdict.
- **Lien `https://` seulement**, sans identifiants (`user:mdp@`), sans espace ni caractère de contrôle (≤ 2 000 caractères).
- **Taille de 1 octet à 15 Mo** (15 728 640 octets), sur la description ET sur les octets.
- **Empreinte** SHA-256 hexadécimale, **recalculée par la base** à la validation de la transaction (`sha256()` de PostgreSQL), avec la taille : un contenu qui ne correspond pas est refusé.
- **Date d'envoi** obligatoire pour « envoyé au client », absente pour « interne ».
- **Un fichier infecté reste archivé.**

### D4. Formats : liste fermée, tout le reste dérivé

`FormatFichierDocument` = `pdf, html, eml, docx, xlsx, pptx, png, jpg, txt, md, csv`. Le type MIME, l'extension acceptée et la signature attendue (`%PDF-`, `PK\x03\x04` pour docx/xlsx/pptx, en-têtes PNG/JPEG, UTF-8 sans octet nul pour les formats texte) se **dérivent** de la valeur dans un seul module (`formats.ts`) ; aucune colonne MIME n'est stockée (RM-01). Un fichier dont l'extension, ou la signature, ne correspond pas au format est refusé.

Le **transport** limite la taille avant la base : `serverActions.bodySizeLimit` passe de `"10mb"` à `"16mb"`, et `experimental.proxyClientMaxBodySize` (défaut 10 Mo dans Next 16.3 — le corps d'une requête qui traverse `src/proxy.ts` est **tronqué** au-delà) est posé à `"16mb"` : la page du projet passe par le proxy, son action serveur aussi. La marge de 1 Mo couvre l'enveloppe multipart.

### D5. Rien ne se détruit, rien ne se réécrit

Triggers `documents_projet_immuable` et `documents_projet_contenus_immuable` : ni `DELETE` ni `UPDATE`, sauf l'archivage (`archive_le`, `archive_par_id`), le verdict antivirus (une seule fois, depuis `non_analyse`) et `client_id` (cascade d'une fusion). `TRUNCATE` refusé sur les deux tables. Une nouvelle version est **un nouveau document**.

Seule exception : le drapeau de session `axion.effacement_rgpd`, posé en `SET LOCAL` par `src/lib/rgpd-erase.ts` seul — la même porte que pour les faits et les preuves d'accord. Un seul code l'utilise pour ces tables (_amendement du 01/10, relectures sécurité et exactitude de #1259_) : la **purge des données du pilote** (`supprimerDonneesPilote`, reprise par `purgerPilote` et `rejouerEffacements`). `projets` étant RESTRICT envers les documents, la purge supprime, sous le drapeau et dans la même transaction, les octets, puis les documents des projets de test, puis les projets ; chaque document est journalisé (`effacements_journal`, cible `documents_projet`, motif `pilote`) pour que le rejeu après restauration le resupprime. Sans cela, la purge et le rejeu échouaient dès qu'un projet de test portait un document. Hors de ce chemin, une demande d'effacement visant une pièce reste traitée à la main, sous le même drapeau.

Archiver = masquer par défaut ; « Afficher les documents archivés » les rend visibles ; « Réafficher » les remet dans la liste.

### D6. Qui voit, qui écrit

Exactement la garde du dossier client (décision A2) : `gardeLectureEchanges` en première instruction de la page du projet (déjà en place), `exigerAccesEchanges` en première instruction de **chaque** action et de la route de téléchargement. Aucune liste de rôles nouvelle.

Toute lecture ou écriture d'un document se fait par le **triplet** `(id, projetId, clientId)` lu dans l'URL ou le formulaire et revérifié en base ; un identifiant de document d'un autre client répond « introuvable » (404), jamais 403 (ne pas confirmer qu'il existe).

### D7. Le téléchargement n'affiche jamais rien

Route `GET …/qualiopi/clients/[id]/projets/[projetId]/documents/[documentId]` (gestionnaire de route, `runtime = "nodejs"`, `dynamic = "force-dynamic"`). En-têtes, sans exception de format :

- `Content-Type: application/octet-stream` (jamais le type réel : un HTML ou un EML ne doit pas être interprété) ;
- `Content-Disposition: attachment; filename="<ascii>"; filename*=UTF-8''<encodé>` ;
- `X-Content-Type-Options: nosniff` ;
- `Content-Security-Policy: default-src 'none'; sandbox` ;
- `Cache-Control: private, no-store` ;
- `Content-Length`, et `X-Robots-Tag: noindex`.

Un lien n'est jamais « téléchargé » : il s'ouvre dans un nouvel onglet (`rel="noopener noreferrer"`).

### D8. Antivirus : le branchement existant, rien d'inventé

ClamAV **est** branché : `src/server/careers/clamav.ts` (conteneur `axion-clamav`, protocole `INSTREAM`, trois issues `sain | infecte | indisponible`), utilisé pour les vidéos des candidats. Il lit un **chemin** ; on lui ajoute une entrée par **tampon** (`analyserOctets(octets, delaiMs)`), sans changer son comportement actuel. À l'ajout, délai 30 s :

- `infecte` → refus, rien n'est écrit, message nommant la signature ;
- `sain` → enregistré, `analyse_antivirus = sain` ;
- `indisponible` → ~~enregistré `non_analyse`~~ **refusé, rien n'est écrit** (« La vérification antivirus ne répond pas pour l'instant : le fichier n'a pas été enregistré. Réessayez dans quelques minutes. ») — _amendement du 01/10 à la réalisation : consigne du chef de projet (« refus si pas de verdict sain ») et recommandation UX §6.2, plus sûre que la version initiale. La base admet toujours `non_analyse` et la route de téléchargement sait toujours le traiter : au téléchargement l'analyse est refaite sur les octets : `sain` → servi (et le verdict est écrit), `infecte` → verdict écrit, document archivé, jamais servi, `indisponible` → refus « antivirus momentanément indisponible, réessayez »._ **Un fichier n'entre ni ne sort jamais sans verdict sain.**

Les liens ne sont pas analysés.

### D9. Le journal : celui du projet

`projet_evenements` (ajout seul, trigger existant) reçoit quatre valeurs — `document_ajoute`, `document_archive`, `document_reaffiche`, `document_telecharge` — et une colonne nullable `document_id` sans clé étrangère. **Jamais** le titre ni le nom du fichier (ils peuvent nommer une personne). L'historique affiché de la page masque `document_telecharge` (bruit) ; le journal les garde.

Fenêtre de déploiement : l'application N-1 encore debout après la migration lirait une valeur `document_*` inconnue de son client Prisma dans l'historique — impossible tant qu'aucun document n'existe, et il ne peut en exister avant que l'application N serve la page. Le worker ne lit ni n'écrit ces tables. Accepté.

### D10. RGPD

Les deux modèles portent `rgpd: dossier-client` et sont **déclarés** (pas tus) : exclus de l'export automatique (`EXCLUSIONS_EXPORT_DOSSIER` : pièces d'entreprise citant des tiers, réponse manuelle) et en exception de l'effacement automatique (`EXCEPTIONS_EFFACEMENT_DOSSIER` : aucune colonne ne les rattache à une personne ; traitement manuel sous le drapeau), à une exception près : ceux des projets du pilote partent avec eux par la purge du pilote et son rejeu (voir D5).

### D11. Build

Aucune page statique ne lit ces tables (pages admin `force-dynamic`, routes `force-dynamic`). Le Proxy `stub.invalid` couvre de toute façon `findMany` (`[]`), `findFirst`/`findUnique` (`null` → 404) et `groupBy` (`[]` → compteurs à zéro). La route publique (D12) refuse en plus d'elle-même la base factice (404), comme la page du questionnaire (ADR 0062).

### D12. Une PAGE envoyée au client s'ouvre par un lien public (ajout du 01/10)

Décision du chef de projet pour Will (« que tout soit dans la base ») : Teleos ouvre « Programme de la journée d'audit », « Notre intervention » et la console d'exemple depuis axion-ia.com, sans compte, et le contenu vient de la base.

**Ce qui est partageable — et rien d'autre** : un document non archivé, `cote = envoye_au_client`, `nature = page_en_ligne`, `fichier_format = html`, `analyse_antivirus = sain`. Tout autre document (PDF, DOCX, EML, HTML interne…) reste en téléchargement réservé aux administrateurs (D7).

**Le lien** : `https://axion-ia.com/document/<documentId>/<jeton>`, même doctrine que l'ADR 0062, avec **sa propre clé** (séparation de domaine — un jeton de questionnaire ne vaut jamais pour un document, et réciproquement) :

```
K     = SHA-256("axion-document-projet|" + AUTH_SECRET)
jeton = base64url(HMAC-SHA256(K, "document-projet:v1:" + documentId))   // 43 caractères
```

Rien n'est stocké ; comparaison à temps constant ; forme (UUID, 43 caractères base64url) et jeton vérifiés **avant** toute lecture de la base. Production sans `AUTH_SECRET` : aucun lien. Révocation : l'archivage (le lien répond alors 404). Rotation d'`AUTH_SECRET` : tous les liens s'éteignent (Will les renvoie).

**La route** : gestionnaire `src/app/document/[id]/[jeton]/route.ts` (`GET` seul ; `HEAD` répond sans écrire), hors `[locale]`, motif `document/` **exclu du matcher** de `src/proxy.ts` (sinon la règle 0bis le redirige vers `/fr/document/…`, 404). Un seul écran 404 neutre pour tous les refus (jeton faux, archivé, non partageable, verdict non sain, base factice) : rien ne dit lequel.

**Les en-têtes de la réponse** (vérifiés sur la réponse servie, une seule valeur chacun — la règle `/:path*` de `next.config.ts` pose déjà `Referrer-Policy` et `X-Frame-Options`, d'où une règle `/document/:path*` dédiée, comme pour `/questionnaire/`) :

- `Content-Type: text/html; charset=utf-8` ;
- `Content-Security-Policy: sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline' https:; style-src 'unsafe-inline' https:; img-src data: blob: https:; font-src data: https:; media-src data: blob: https:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-src 'none'; frame-ancestors 'none'` — origine **opaque** (jamais `allow-same-origin`) : la page n'atteint ni les cookies, ni le stockage, ni les routes du site ; sans `allow-forms`, `allow-popups`, `allow-modals` ; `connect-src 'none'` coupe `fetch`, XHR et WebSocket (une page qui tenterait d'envoyer des données ne le peut pas) ;
- `X-Content-Type-Options: nosniff` ; `Referrer-Policy: no-referrer` ; `X-Robots-Tag: noindex, nofollow, noarchive` ; `Cache-Control: private, no-store` ; `X-Frame-Options: DENY`.

Conséquence assumée : une page partagée doit être **autonome** (styles et scripts en ligne, ou servis en https par un CDN ; aucune requête de données). La console d'exemple l'est, ou doit le devenir.

**Le jeton ne fuit nulle part** : `no-referrer` (les CDN chargés par la page ne le voient pas) ; segment masqué `[TOKEN]` dans `SEGMENTS_SECRETS` (`src/lib/observability/sentry-pii-scrub.ts`).

**Le journal d'ouverture** : table `documents_projet_ouvertures` (ajout seul, trigger, sans exception RGPD) : `document_id`, `ouvert_le`, `origine` (`navigateur` | `apercu_automatique`). **Ni IP, ni navigateur, ni personne.** L'origine est une heuristique : `navigateur` si `Sec-Fetch-Dest: document`, `Sec-Fetch-Mode: navigate`, `Sec-Fetch-User: ?1` et un agent utilisateur hors de la liste des robots et analyseurs connus (Outlook Safe Links, Teams, Slack, LinkedIn, Google, Microsoft Office, outils en ligne de commande, navigateurs sans tête) ; sinon `apercu_automatique`. La rubrique affiche « Ouvert 3 fois, dernière ouverture le … » (ouvertures `navigateur`) et, à part, « 2 aperçus automatiques ». Le texte ne dit jamais « lu ».

Écriture **best-effort et bornée** : l'ouverture est écrite après la vérification du jeton, jamais avant ; un échec d'écriture n'empêche pas de servir la page ; au-delà de 30 ouvertures par quart d'heure et par document (compteur Redis, `hashIp` jamais stocké), la page est servie sans écrire (un lien qui fuit ne remplit pas la table). Redis en panne : on sert, sans limiter.

**Ce que cela implique pour la personne qui ouvre** (à faire valider, voir « Négatives ») : un suivi d'ouverture d'un lien envoyé à une entreprise, sans donnée identifiante stockée.

## Conséquences

**Positives** — Chaque projet a ses pièces au bon endroit, sauvegardées avec la base. L'étanchéité entre clients, l'interdiction de détruire et l'intégrité du contenu ne dépendent pas du code : la base refuse. Un HTML déposé ne s'exécute jamais dans la console ; une page partagée au client s'exécute dans un bac à sable sans accès au site (D12). Will sait si le lien a été ouvert, sans que la base garde rien d'identifiant.

**Négatives et mitigations**

- La base grossit (borne : 15 Mo par fichier). Surveiller `pg_total_relation_size('documents_projet_contenus')` ; au-delà de quelques Go, rouvrir la question du stockage (nouvel ADR).
- La limite de corps des actions serveur et du proxy monte à 16 Mo pour **tout** le site (réglage global de Next). Les actions publiques restent filtrées par `allowedOrigins`.
- L'empreinte est calculée deux fois (application, base) : quelques dizaines de millisecondes pour 15 Mo, acceptées pour la garantie.
- **Lien public (D12) — trois risques résiduels, nommés :**
  1. _Du HTML arbitraire servi sous axion-ia.com._ Le bac à sable l'isole techniquement (origine opaque, aucun formulaire, aucune requête de données), mais une page peut toujours **ressembler** à une page d'Axion-IA, ou rediriger ailleurs. Seuls les administrateurs du dossier client déposent ; un compte administrateur compromis pourrait héberger une page trompeuse sur le domaine. Mitigation : partage limité à la nature `page_en_ligne` côté « envoyé », antivirus sain exigé, journal d'ajout.
  2. _Le suivi d'ouverture est un suivi de comportement._ Même sans IP ni navigateur, « ouvert le … » renseigne sur l'activité du destinataire. La CNIL encadre le suivi individuel de lecture des messages (pixels et liens de suivi) ; la base légale (intérêt légitime en B2B) et l'information du destinataire (une ligne dans l'e-mail ou la politique de confidentialité) sont **à faire valider par Will** avant le premier envoi. Interrupteur `DOCUMENTS_OUVERTURES_SUIVIES=true` (application) : absent, la page est servie sans écrire d'ouverture — c'est l'état tant que Will n'a pas validé.
  3. _Les ouvertures sont approximatives._ Les analyseurs de liens d'entreprise (Microsoft Defender, Proofpoint, Mimecast) imitent de plus en plus un vrai navigateur : une ouverture `navigateur` peut être un robot. D'où « ouvert », jamais « lu ».
- Cloudflare : la réponse porte `private, no-store` ; vérifier au premier déploiement `cf-cache-status: DYNAMIC` (ou `BYPASS`) sur `/document/…` — une règle « tout mettre en cache » qui forcerait une durée rendrait l'archivage inopérant et fausserait le compteur.

## Alternatives considérées

- **Volume `console-docs`** (comme `SocieteDocument`) : hors des sauvegardes de la base, refusé par le dirigeant.
- **Une seule table avec `bytea`** : une liste sans `select` chargerait les fichiers. Écarté (D2).
- **R2 (stockage objet)** : déjà utilisé pour les enregistrements chiffrés ; ajoute une dépendance réseau et une seconde sauvegarde pour quelques Mo par projet. Écarté pour la version 1.
- **Un journal dédié aux documents** : doublon du journal du projet, qui est déjà en ajout seul. Écarté (D9).
- **Servir le type réel en `inline`** pour les PDF : confortable, mais une seule règle sans exception est plus sûre. Écarté (D7).
- **Lien public dans un sous-domaine dédié** (ex. `pages.axion-ia.com`) : isolation encore plus forte (aucun cookie du site, même en cas d'erreur de configuration du bac à sable). Écarté pour la version 1 (DNS, certificat et routage Coolify à ajouter) ; à reconsidérer si le partage s'étend au-delà des pages déposées par Will.
- **Jeton stocké (empreinte en base, révocable un par un)** : prévu par le plan de la suite d'appel (`AccesProjetClient`), non implémenté (D28). L'archivage suffit à révoquer en version 1.
- **Pas de suivi d'ouverture** (comme le questionnaire, ADR 0062 : « le GET n'a aucun effet de bord ») : demandé explicitement pour savoir si le client a ouvert ; retenu avec les bornes de D12.
