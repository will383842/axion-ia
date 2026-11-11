# Guides par réseau — interrupteurs et secrets

Les routes internes signées du Studio (HMAC + horodatage + nonce) ont chacune leur interrupteur.
Tous sont lus **à l'exécution** (`process.env`, scope RUN, conteneur **app** seulement — jamais un
build-arg) et valent « éteint » sauf si la valeur est exactement `true`.

| Variable                           | Route                                                  | Défaut |
| ---------------------------------- | ------------------------------------------------------ | ------ |
| `GUIDES_RESEAU_ENABLED`            | `POST /api/interne/demandes-guide-reseau`              | éteint |
| `OPPOSITIONS_RESEAU_ENABLED`       | `POST /api/interne/oppositions-reseau`                 | éteint |
| `PAGE_GUIDE_RESEAU_ENABLED`        | `/guide-reseau` (page) et `POST /guide-reseau/envoyer` | éteint |
| `CONFIRMATIONS_PAGE_GUIDE_ENABLED` | `POST /api/interne/confirmations-page-guide`           | éteint |

Éteint → `503 reception_eteinte` ; rien n'est lu ni écrit. (La page `/guide-reseau` éteinte répond
**404**, sa route d'envoi **503** : voir plus bas.)

Pose depuis GitHub (cible `site` seulement) : `gh workflow run coolify-drapeau.yml -f cle=OPPOSITIONS_RESEAU_ENABLED -f valeur=true -f cible=site -f redeploy=true`
(puis `GUIDES_RESEAU_ENABLED`). Éteindre les oppositions exige `-f confirmer_extinction=true`.

## `OPPOSITIONS_RESEAU_ENABLED`

Reçoit le « stop » écrit par une personne en message privé d'un réseau. L'adresse est mise à
l'écart des envois (table `email_oppositions`, empreinte seulement, CRM prévenu, envois
programmés retirés). **Aucune suppression**, jamais le chemin d'effacement. Pas de table, pas de
migration : l'opération est idempotente par nature.

- **L'allumer AVANT `GUIDES_RESEAU_ENABLED`** : on doit pouvoir enregistrer un « stop » avant
  d'envoyer le premier guide.
- **Ne jamais l'éteindre pendant que le Studio tourne** : un « stop » refusé (503) serait perdu
  pour une personne qui a demandé à ne plus être contactée.
- Éteint par défaut.

## `PAGE_GUIDE_RESEAU_ENABLED` — la page « Recevoir le guide » (lot S2)

Page du site, **sans JavaScript client**, ouverte par le lien `https://axion-ia.com/guide-reseau?j=<jeton>`
(jeton signé créé par le Studio, valable **48 h** (décision du 11/11/2026), **usage unique**). La personne y saisit son prénom
(obligatoire, 1 à 50 caractères) et son adresse, et coche l'**unique** case, au texte exact :
« J'accepte de recevoir le guide et des informations d'Axion-IA, désinscription à tout moment »
(`src/content/guides-reseau.ts`, version `page-guide-2026-11-08`, empreinte sha256 écrite avec la preuve).

- **Éteinte par défaut.** Vraie seulement si la valeur est exactement `true` ; lue à la requête, jamais au build.
  Éteinte : page et merci en **404**, route d'envoi en **503**, rien n'est lu ni écrit.
- Pose (cible `site` seulement) : `gh workflow run coolify-drapeau.yml -f cle=PAGE_GUIDE_RESEAU_ENABLED -f valeur=true -f cible=site -f redeploy=true`.
- **Secret du lien : `GUIDES_RESEAU_LIEN_SECRET`** (≥ 32 caractères, scope RUN, conteneur **app**, jamais un build-arg).
  Il doit être **distinct** du secret des appels Studio→site (`GUIDES_RESEAU_HMAC_SECRET`) : à chaque requête,
  `verifierSecretsDistincts` le contrôle. Absent, court ou égal → la page montre sa page neutre (« ce lien ne peut pas
  être utilisé » + lien vers `/fr/guide-ia`), la cause n'est jamais dite à la personne (elle part au journal, sans valeur).
  Le Studio signe avec **le même** secret : le poser des deux côtés avant d'allumer.
- **Durée et tolérance du jeton** : 48 h exactement (`DUREE_JETON_SECONDES`) ; un jeton dont l'expiration
  dépasse `maintenant + 48 h + 5 min` (`DERIVE_HORLOGE_SECONDES`) est refusé comme « champs » (un jeton de 7 jours
  n'a pas été fabriqué par le Studio). Le format ne change pas. **Point final** : `normaliserJetonRecu` retire
  `. , ; : ! ? )` collés à la fin du lien (messagerie qui avale la ponctuation) dans la page ET dans la route
  d'envoi, avant la vérification et avant l'empreinte d'usage unique — avec ou sans point, c'est le même jeton.
  Fixture de référence du Studio : `lien-page-guide.v2.json` (son SHA-256 est inscrit dans le test des deux dépôts).
- À la validation : case obligatoire (422 sinon), adresse **opposée** = réponse identique à un succès (rien d'envoyé ni
  écrit), MX « non » = message d'erreur, MX inconnu = la demande passe, guide déjà parti il y a < 24 h = pas de second
  envoi. Aucune ligne `newsletter_subscribers`. L'e-mail du guide porte un lien de désinscription (porte d'opposition).
- **Écriture atomique (fiche SITE-ORIG).** La ligne `contacts_guide_reseau`, la demande du guide, l'**origine**
  (`guide_reseau_origines` : mot, réseau, compte, post, version M1) et la **preuve du consentement**
  (`consent_events`) sont écrites dans **UNE seule transaction, avant toute réponse**. Un arrêt du conteneur juste
  après la réponse ne peut donc plus laisser une fiche sans origine ni consentement. Si l'une des écritures échoue,
  tout est annulé (rien de partiel), le jeton n'est **pas** consommé et la route répond sa page d'erreur neutre
  (« Erreur. Réessayez dans quelques minutes. ») : la personne peut réessayer avec le même lien. Seul l'e-mail du guide
  part après la réponse (`after`). Aucun changement de contrat ni de schéma, pas de migration.
- **Plancher de durée.** La réponse ne part jamais avant `PLANCHER_REPONSE_MS` (250 ms, `page-confirmation.ts`), quelle
  que soit l'issue (succès, refus, erreur) : une adresse déjà connue et une adresse neuve ne se distinguent pas au
  chronomètre.
- **Ordre d'allumage conseillé** : `OPPOSITIONS_RESEAU_ENABLED` d'abord, puis le secret du lien, puis cette page.
- La route des confirmations (lot S4) n'est **pas** livrée par ce lot ; la synchro CRM est décrite plus bas (lot S3).

## Synchro CRM de la page « Recevoir le guide » (lot S3, 11/11/2026)

- `SYNCHRO_CRM_V3` (site, `true` seulement) : **éteint par défaut**. Allumé, l'événement
  `lead_magnet_requested` v3 d'une demande venue d'un réseau part **au clic** du lien du guide
  (bouton POST de la page du lien, adresse vérifiée, `verifie: true`), **jamais** au POST de la
  page « Recevoir le guide » (une saisie n'est pas une adresse vérifiée). Il porte `source_slug`
  `guide-reseau`, le prénom, la case cochée (`consentements`), le guide reçu (`guides_recus`) et
  l'origine (`payload.origines`). Il passe en plus par `CRM_SYNC_ENABLED` et
  `CRM_SYNC_GUIDE_ENABLED`. Éteint : le chemin v1 est inchangé.
- Opposition à l'adresse et exclusion (`CRM_SYNC_EXCLUSIONS_SHA256`) : contrôlées avant la
  transaction du clic, puis l'opposition **de nouveau, lue par la transaction elle-même**, avant d'écrire.
  Rien n'est supprimé : la demande est marquée traitée.
- `SYNCHRO_CRM_V3_NEWSLETTER_OPTIN` : interrupteur **séparé, éteint**, que rien ne lit encore ;
  il ne s'allumera qu'après l'avis de l'auditeur RGPD (consentement couplé, art. 7.4). Aucune ligne
  `newsletter_subscribers` n'est écrite par ce lot.
- Le chemin « adresse tapée dans la conversation » n'envoie plus rien au CRM à la réception (D1) ; son origine v3 reste écrite sur le site.
- stop sans adresse : abandonné (décision de Williams du 11/11/2026, lien de 48 h en contrepartie).
- Pose (cible `les-deux` obligatoire, le workflow refuse `site` ou `worker` seuls) :
  `gh workflow run coolify-drapeau.yml -f cle=SYNCHRO_CRM_V3 -f valeur=true -f cible=les-deux -f redeploy=true`.
  Même commande pour `SYNCHRO_CRM_V3_NEWSLETTER_OPTIN` (à ne **pas** allumer avant l'avis RGPD).
- Pas encore livré : la route « stop sans adresse » (Studio → site, 4.4) et le rattrapage dédié.

## `CONFIRMATIONS_PAGE_GUIDE_ENABLED` — les « merci » à envoyer (lot S4a)

`POST /api/interne/confirmations-page-guide` : le Studio y **réserve** la liste des « merci » à envoyer
après la validation de la page « Recevoir le guide » (`merci_statut = 'a_envoyer'`). Le merci part dès la
validation de la page, pas au clic du lien : la fenêtre de messagerie du réseau est courte.

- **Éteinte par défaut.** Vraie seulement si la valeur est exactement `true`, lue à la requête. Éteinte : `503 reception_eteinte`, rien n'est lu ni écrit. Elle couvre aussi la route d'accusé (lot S4b).
- Pose (cible `site` seulement, `true` ou `false` seulement, aucun secret dans le workflow) : `gh workflow run coolify-drapeau.yml -f cle=CONFIRMATIONS_PAGE_GUIDE_ENABLED -f valeur=true -f cible=site -f redeploy=true`.
- Secret : `GUIDES_RESEAU_HMAC_SECRET` (+ `_PRECEDENT`), **aucun repli** sur celui des vidéos ; absent ou < 32 caractères → `503 reception_non_configuree`. Seau de débit propre : `internal:confirmations-page-guide`.
- Corps (4 Ko max, champ inconnu → `400`) : `{"schemaVersion":1,"limite":50}` (`limite` facultative, 1 à 50). Ni `GET`, ni chaîne de requête.
- Réponse : `{"ok":true,"schemaVersion":1,"confirmations":[{"ref":"<empreinte du jeton>","valideLe":"<ISO 8601>"}]}` — rien d'autre (ni adresse, ni clé d'adresse, ni référence de conversation).
- Une ligne réservée passe à `reserve` : elle ne ressort pas tant que sa réservation a moins de 10 min. Les lignes `a_envoyer` de plus de 48 h passent à `expire` (conservées). Une adresse opposée, la marque `email_key = '-'` et les statuts `ecarte`/`ecartee` ne sont jamais proposés ; leur ligne n'est jamais supprimée, jamais réservée ; elle peut passer à `expire` après 48 h. **Reprise :** une ligne `reserve` depuis plus de 10 min (`DELAI_REPRISE_RESERVATION_MIN`, réponse ou accusé perdu) est reprise : `a_envoyer` si encore dans la fenêtre de 48 h, sinon `expire`. La reprise ne vise que `reserve` : une ligne `envoye` ou `hors_fenetre` n'est jamais reprise. **Engagement du Studio (STU-Z4) : revérifier l'opposition juste avant l'envoi.**
- **Aucune suppression.**

### Accusé de réception (lot S4b) — `POST /api/interne/confirmations-page-guide/issue`

Sans accusé, un merci déjà envoyé serait repris toutes les 10 min pendant 48 h. Même garde que la route de réservation (interrupteur vérifié en premier, `GUIDES_RESEAU_HMAC_SECRET` sans repli, corps 4 Ko, champ inconnu → `400`, ni `GET` ni chaîne de requête).

- Corps : `{"schemaVersion":1,"issues":[{"ref":"<empreinte>","issue":"envoye"|"hors_fenetre"|"echec"}]}` — 1 à 50 issues.
- `envoye` / `hors_fenetre` : `reserve` → statut demandé (mise à jour conditionnelle). Un accusé tardif, arrivé après une reprise (ligne revenue à `a_envoyer`), est aussi accepté : le merci est parti, il ne doit pas repartir.
- `echec` : `reserve` → `a_envoyer` si la ligne est encore dans la fenêtre de 48 h, sinon `expire` — seulement si la réservation date de plus de 10 min (un `echec` retardé d'une ancienne réservation ne doit pas annuler une réservation récente : deux « merci » partiraient).
- Une ligne `envoye` ne change plus jamais (le rejeu est sans effet) ; `hors_fenetre`, `expire`, `ecarte` non plus. Une `ref` inconnue est ignorée sans erreur. Aucune suppression.
- Réponse : `{"ok":true,"schemaVersion":1,"recus":<nombre d'issues reçues>}` — rien d'autre ; le journal ne porte que ce nombre.

## Interrupteurs du lot S3 et ordre d'allumage

Deux interrupteurs de plus figurent dans la liste fermée du workflow `coolify-drapeau.yml`,
**éteints par défaut** (valeur exactement `true` pour allumer, scope RUN) :

| Variable                          | Rôle                                                   | Défaut |
| --------------------------------- | ------------------------------------------------------ | ------ |
| `SYNCHRO_CRM_V3`                  | événement CRM v3 au clic du lien du guide              | éteint |
| `SYNCHRO_CRM_V3_NEWSLETTER_OPTIN` | interrupteur séparé, rien ne le lit encore (avis RGPD) | éteint |

**Ordre d'allumage** (chaque étape n'est faite qu'une fois la précédente vérifiée) :

1. CRM : `ORIGINES_V3_ENABLED` et le drapeau `crm.ingest.personnes_enabled` (côté CRM).
2. `SYNCHRO_CRM_V3`.
3. `CONFIRMATIONS_PAGE_GUIDE_ENABLED` — liste fermée du workflow `coolify-drapeau.yml` (cible `site`, `true`/`false`). **Précondition : n'allumer qu'une fois le Studio prêt à accuser chaque merci** (`envoye`, `hors_fenetre` ou `echec` sur `/issue`) ; sinon chaque merci est repris après 10 min et renvoyé pendant 48 h (un seul interrupteur couvre la réservation et l'accusé).
4. `PAGE_GUIDE_RESEAU_ENABLED`.
5. `LIEN_PAGE_GUIDE_ENABLED` — réglée dans Coolify (portée RUN) par la session de mise en ligne, hors workflow (aucune lecture sur `main` ni dans une PR ouverte au 11/11/2026).

(`OPPOSITIONS_RESEAU_ENABLED` puis le secret du lien restent des prérequis, voir plus haut.)

**Site ET worker redéployés ensemble.** Le rattrapage tourne dans le conteneur **worker**, qui
lirait l'ancien format si seul le site est mis à jour. Les deux sont bâtis différemment : le worker
atterrit 15 à 18 min (mesuré le 17/10/2026) **avant** l'app (voir « DEUX conteneurs » dans `AGENTS.md`). Poser avec
`cible=les-deux`, et ne rien allumer tant que l'app ET le worker ne servent pas le même commit
(contrôler les deux : `x-axion-build-sha` pour l'app, le contenu de `/app/src` pour le worker).

**Secret `GUIDES_RESEAU_LIEN_SECRET`.** Même valeur côté site et côté Studio, posée **avant** d'allumer
la page. Jamais via un workflow (les entrées en sont visibles), jamais dans un dépôt, un journal ou une PR :
saisie directe dans les variables d'environnement Coolify (scope RUN), côté Studio par son propre
mécanisme de secrets. Distinct de `GUIDES_RESEAU_HMAC_SECRET`.

**Tout arrêter** (ordre inverse de l'allumage), chacun avec `valeur=false`, `redeploy=true` :

1. `LIEN_PAGE_GUIDE_ENABLED` — réglée dans Coolify (portée RUN) par la session de mise en ligne, hors workflow (aucune lecture sur `main` ni dans une PR ouverte au 11/11/2026).
2. `PAGE_GUIDE_RESEAU_ENABLED`.
3. `CONFIRMATIONS_PAGE_GUIDE_ENABLED` — liste fermée du workflow `coolify-drapeau.yml` (cible `site`, `true`/`false`).
4. `SYNCHRO_CRM_V3` (et `SYNCHRO_CRM_V3_NEWSLETTER_OPTIN` s'il avait été allumé), cible `les-deux`.
5. Côté CRM : `crm.ingest.personnes_enabled`, puis `ORIGINES_V3_ENABLED`.

`OPPOSITIONS_RESEAU_ENABLED` reste **allumé** (un « stop » refusé serait perdu) ; il ne s'éteint que sur
incident, avec `confirmer_extinction=true`.

## Secret

`GUIDES_RESEAU_HMAC_SECRET` (≥ 32 caractères, + `GUIDES_RESEAU_HMAC_SECRET_PRECEDENT` pendant
une rotation). La route des oppositions n'a **aucun repli** sur `VIDEOS_STUDIO_HMAC_SECRET`
(la route des demandes de guide, elle, en garde un historique). Secret absent ou trop court →
`503 reception_non_configuree`.

## Corps de la requête (oppositions)

```json
{
  "schemaVersion": 1,
  "cleIdempotence": "run_xxx",
  "email": "a@b.fr",
  "motif": "stop",
  "reseau": "instagram",
  "occurredAt": "2026-11-06T10:00:00.000Z"
}
```

Tout autre champ → `422` (seuls les noms de champs sont rendus). Réponse : toujours
`200 {"ok":true,"type":"opposition","recue":true}`, que l'adresse soit nouvelle, déjà écartée ou
inconnue. Plafond du corps : 4 Ko.
