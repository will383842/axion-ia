# ADR 0054 — Enregistrement des visios : extension Chrome, routes authentifiées, R2 chiffré, pipeline par étapes

- **Statut** : **ACCEPTÉ** (ordre de Will du 28/09/2026 au soir : « c'est le crédit API qu'il faut utiliser »).
- **Date** : 2026-09-29
- **Auteur** : Will + Claude (chantier « enregistrement des visios »)
- **Référence** : `src/app/api/mcp/route.ts` (modèle du jeton machine et de la sortie `stub.invalid`) ; `src/lib/r2-storage.ts` ; `src/lib/pii-crypto.ts` ; `src/server/queue/connection.ts`, `src/server/queue/queues.ts`, `src/server/queue/worker.ts` (vidange au SIGTERM) ; `src/features/admin-rendezvous/visio.ts` ; `.github/workflows/deploy-coolify.yml` (`paths-ignore`) ; ADR 0026 (build externalisé, contrat `stub.invalid`), 0053, 0055, 0056.

## Contexte

Will utilise un compte Google personnel : l'enregistrement natif de Meet n'est pas disponible. Le Notetaker Calendly reste désactivé (décision du 01/09/2026), et aucun robot ne doit entrer dans la réunion.

Le compte rendu est rédigé côté serveur, par l'API OpenAI (ADR 0055). Le son doit donc atteindre le **worker**. Or les volumes disque sont montés sur le conteneur web seulement ; le worker n'en a aucun, et sa mémoire est limitée à 1 Go. Le seul stockage partagé entre les deux conteneurs est **Cloudflare R2**, déjà configuré sur l'un et l'autre.

Le worker est redéployé à chaque fusion, bien avant l'application (écart d'environ une heure) : tout traitement doit survivre à un arrêt et tolérer les deux versions en vol.

## Décision

1. **Extension Chrome MV3 maison**, dans ce dépôt (`extensions/enregistreur-meet/`), en JavaScript à modules ES, **sans dépendance ni étape de construction**, chargée **non empaquetée** (pas de Chrome Web Store). Deux pistes mono Opus à 32 kbit/s : l'onglet Meet (le client) et le micro (Will). Le son de l'onglet est rebranché vers les haut-parleurs, pour que Will entende toujours le client.
2. **Tranches autonomes de 180 s par piste** : l'extension arrête et relance son `MediaRecorder` toutes les 180 s, chaque tranche porte son en-tête WebM et se découpe en morceaux de 10 s. Aucun `ffmpeg` n'est nécessaire côté serveur. Constantes uniques `DUREE_TRANCHE_S = 180`, `DUREE_MORCEAU_S = 10`, `DEBIT_AUDIO_BPS = 32_000`, `TAILLE_MAX_TRANCHE_OCTETS = 24 * 1024 * 1024` (`src/server/visio/audio/constantes.ts`), recopiées dans le contrat de l'extension.
3. **L'extension parle directement au site**, par `https://axion-ia.com/api/enregistreur/*`, avec un **jeton d'appareil** (`Authorization: Bearer <64 hex>`) créé par Will dans la console, affiché une fois, collé dans les options de l'extension. Le jeton est stocké **haché**, comparé à temps constant, ~~expire à 90 jours~~, est révocable, et son titulaire est revérifié dans `ROLES_DOSSIER_ECHANGES` à chaque appel. Les routes ne lisent **aucun cookie** et n'émettent **aucun en-tête CORS** (un service worker d'extension qui déclare ses `host_permissions` n'y est pas soumis).
   - **Révision 02/10 : sans expiration, décision de Williams ; révocation seule.** Le jeton vaut jusqu'à sa révocation dans la console ; le rôle du titulaire reste revérifié à chaque appel. Sans migration : `expireLe` (non nul) reçoit la date sentinelle `JETON_SANS_EXPIRATION` (9999-12-31), renvoyée à l'extension comme `jetonExpireLe` — y compris pour les jetons créés avant, dont la date d'origine n'est plus lue. Plus d'alerte J-14 / J-3 (`visio.jeton_expire_j14` et `_j3` retirés du catalogue) ; les seuils restent publiés, inertes, dans le contrat v1.
   - **Liaison automatique (02/10, extension 1.4.0)** : « Relier à ma console » tire un nonce (16 octets, usage unique, 10 min, stockage de session), ouvre `/api/enregistreur/relier?nonce=…` (302 vers `rendez-vous/enregistreur?relier=…` seulement avec une session habilitée A2, sinon 404 sans `Location` ; marche drapeau fermé). « Relier » crée le jeton et le pose dans un élément masqué (`data-relier-nonce`, `data-relier-jeton`) ; le relais l'envoie (`jeton_relie`), le service worker ne l'accepte que d'un onglet axion-ia.com avec le nonce en attente, puis l'efface. Le jeton ne passe dans aucune URL. Le collage manuel reste possible.
4. **Démarrage en deux temps : rien n'est envoyé avant l'accord.** La capture démarre dans l'état `accord_en_attente` ; les morceaux restent dans l'IndexedDB de l'extension ; la route des morceaux répond **409** tant que l'enregistrement n'est pas `en_cours`. Sans « Accord obtenu » sous 3 minutes, l'extension **détruit** ses morceaux locaux ; « Refus » : destruction immédiate.
   - **Panneau latéral** : phrase d'annonce, compte à rebours, « Accord obtenu », « Refus », « Pause » (gain à zéro), « Arrêter », vumètres des deux pistes.
   - **Personne en plus** : gain à zéro au bout de 2 minutes sans « Nouvelle personne : accord obtenu » ; la fenêtre est journalisée (`fenetresHorsAccord`) et ses segments ne sont jamais transmis plus loin.
     - **Côté serveur (RGPD-01)** : une tranche de 180 s qui chevauche une fenêtre hors accord, sur l'une ou l'autre piste, **n'est jamais envoyée à OpenAI** (le micro peut capter le haut-parleur) ; un segment `horsAccord` sans parole garde sa place. Les fenêtres n'arrivent qu'avec la `fin` de l'extension : une session **close par le serveur** (`cloture_serveur`) n'est transcrite qu'après que Will a vérifié que personne n'est entré sans accord.
     - **Limite du comptage** : l'extension compte les **têtes**, elle ne reconnaît pas les personnes. Si une personne ayant donné son accord quitte l'appel pendant qu'un inconnu reste, le nombre de participants redescend au niveau accordé et la fenêtre hors accord **se ferme** alors que l'inconnu parle encore. Consigne à Will : si le nombre de participants a baissé puis remonté, ou si un inconnu est présent, **arrêter l'enregistrement** (« Arrêter »), quitte à le relancer après un nouvel accord.
   - **Pas d'arrêt sur le seul silence** ; arrêt si la salle est quittée depuis 2 minutes, ou à 2 h 55.
5. **Stockage : R2 existant, préfixe privé, chiffré avant l'écriture.** Clé **choisie par le serveur**, jamais par l'extension : `visio-audio/<enregistrementId>/<piste>/<tranche 4 chiffres>/<seq 5 chiffres>.bin`. Chaque morceau est chiffré (AES-256-GCM, clé `PII_ENCRYPTION_KEY`, format binaire dédié qui **lève** si la clé manque) avant `uploadToR2`, puis **purgé** selon l'ADR 0056. Une seule route accepte de l'audio : `PUT sessions/[id]/morceaux` (`application/octet-stream`, 256 Kio au plus, empreinte SHA-256 vérifiée, idempotente).
6. **Routes `/api/enregistreur/*`** : rencontres du jour, sessions, accord, refus, morceaux, battement, fin de tranche, fin, battement de l'appareil, ouverture d'une page de la console (302 seulement avec une session admin habilitée). Chaque route : `runtime = "nodejs"`, `dynamic = "force-dynamic"`, sortie anticipée si `DATABASE_URL` contient `stub.invalid` (ADR 0026), limite de débit par appareil.
7. **Contrat unique** : Zod dans `src/lib/schemas/enregistreur.ts`, **généré** vers `extensions/enregistreur-meet/contrat.json` et son empreinte ; en-tête `x-enregistreur-contrat: 1`. Un changement d'un seul côté rougit. Évolution **par ajout de champs facultatifs** seulement ; une rupture passe à la version 2, et le site sert les deux versions tant qu'une extension en version 1 bat.
8. **Liste blanche** des types Calendly enregistrables, plus les rencontres saisies dans la console sur une fiche client validée (ADR 0053 §14). Refus motivé (409) : rendez-vous apporteur, entretien de candidat planifié à ±30 minutes, opposition du contact au traitement par IA, reprise d'historique. **Aucun enregistrement ad hoc.**
9. **L'état vit en base, BullMQ ne sert qu'à réveiller le worker.** Une file `visio`, **concurrence 1**, charge de job `{ v: 1, rencontreId, etape }` seulement, créée par `src/server/queue/connection.ts` (qui rend `null` si `BULLMQ_DISABLED`). `TraitementVisio` porte l'étape, son statut et son jeton de propriété (`execution`) : prise atomique, bail de 5 minutes prolongé toutes les 60 s, écriture finale conditionnée au jeton. Un arrêt du worker (vidange de 25 s au SIGTERM) remet l'étape `a_faire` **sans compter d'essai**. Aucune étape tant qu'un enregistrement de la rencontre est actif.
10. **Le serveur est propriétaire de la clôture** : `accord_en_attente` plus de 3 minutes → `accord_non_confirme` ; `en_cours` sans signe de vie 10 minutes → `interrompu` ; `interrompu` jusqu'à `max(fin prévue, dernier signe) + 2 h` → `depose` avec `incomplet = true`. **Les messages en retard ne détruisent rien** : un accord local rejoué, daté dans les 3 minutes, est accepté même après la clôture ; un battement qui revient rouvre `interrompu` ; une `fin` tardive corrige la clôture d'office ; jamais après un refus ou un retrait. Plusieurs enregistrements successifs peuvent appartenir à la même rencontre (Meet gratuit coupe à 60 minutes dès trois participants), un seul actif à la fois.
11. **Drapeau** `ferme | pilote | ouvert`, lu **à l'exécution** par les deux conteneurs (`ENREGISTREMENT_VISIO_PILOTE`, `ENREGISTREMENT_VISIO_OUVERT`, défaut `ferme`), jamais figé au build ; on l'allume sur le worker d'abord. `ouvert` se comporte comme `pilote` tant que la date de fin du préavis n'est pas atteinte (ADR 0056).
12. **Fenêtre app/worker** : toute valeur d'énumération ou colonne écrite par le worker atterrit dans une PR **précédente** ; le worker tolère une table ou une colonne absente (étape reportée de 15 minutes sans compter d'essai, alerte au-delà de 2 heures).
13. **Témoins en base et panneau « État du circuit »** : battement du balayage, battement de l'appareil, versions, témoin de la clé de chiffrement, étapes en attente et leur âge, audios non purgés ~~, jetons qui expirent~~ (révision 02/10 : le jeton n'expire plus). Alertes Telegram **techniques seulement**, sans nom ni parole.
14. **Livraison de l'extension sans mise en ligne** : `extensions/**` est ajouté à `paths-ignore` du déploiement, **sans toucher** à la `concurrency` ni au contrat de build ; ses tests tournent dans Vitest (Gate A · couverture).

## Conséquences

- **Positives** : aucun robot dans la réunion ; rien ne quitte le poste de Will avant l'accord ; le son n'est jamais écrit en clair hors de sa mémoire ; aucun programme à installer sur le PC ; le pipeline survit aux déploiements fréquents ; tout le code est testé en CI.
- **Négatives** :
  - le son transite par nos serveurs et R2 (une copie chiffrée, temporaire) ;
  - une extension non empaquetée : Will clique « Recharger » quand elle change (rare, la logique vit dans le site), et Chrome peut la désactiver (contrôle de santé dans le panneau) ;
  - un appel d'une heure ≈ 30 Mo et ≈ 720 écritures R2, purgés en quelques jours : largement sous la franchise gratuite de R2, mesuré après la mise en ligne.

## Alternatives écartées

- Enregistrement natif de Meet : indisponible avec un compte Google personnel.
- Robots SaaS (Notetaker Calendly et équivalents) : décision du 01/09/2026.
- Programme local sur le PC de Will (transcription par faster-whisper sur sa carte graphique, rédaction par `claude -p` sur son abonnement, messagerie native de Chrome) : écarté le 28/09 au soir sur l'ordre de Will d'utiliser le crédit API OpenAI ; il imposait un PC allumé, une installation et un second programme à maintenir.
- Disque du serveur : monté sur le web seulement, le worker n'y a pas accès.
- Chrome Web Store : inutile pour une extension à usage unique.
- OBS : trop lourd pour Will ; reste un plan B si Chrome bloque la capture.

## Ce que cet ADR ne décide pas

Le modèle de transcription et de rédaction, le coût et le plafond (ADR 0055). Les durées de conservation, le consentement et le retrait (ADR 0056). Le poids des écrans de la console (ADR 0058).
