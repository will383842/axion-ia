# ADR 0062 — Questionnaire de cadrage en ligne : lien HMAC sans stockage, envoi définitif unique

- **Statut** : proposé (PR `feat/questionnaire-en-ligne-projet`, sans migration)
- **Date** : 2026-10-01
- **Auteur** : A02 (architecte), sur la décision **D36** de Will
- **Prolonge** : le chantier visio (PR 7 : questionnaire de cadrage « à copier », `QuestionnaireCadrage`, `QuestionnaireQuestion`) ; ADR 0056 (effacement)
- **S'écarte de** : `_PLAN-SUITE-D-APPEL-2026-09-30/04-final/PLAN.md` (règles R2, R17/R72, R26, R78), **plan non implémenté** (D28)
- **Référence** : `src/app/questionnaire/[id]/[jeton]/` ; `src/server/visio/questionnaire-en-ligne/` (`jeton.ts`, `reponses.ts`, `constantes.ts`) ; `src/server/visio/gestes-suivi.ts` (`ecrireQuestions`, `ouvrirLienEnLigne`) ; `src/proxy.ts` (matcher) ; `next.config.ts` (en-têtes) ; `src/lib/observability/sentry-pii-scrub.ts`

> **Note de numérotation.** Le plan de la suite d'appel citait un « ADR 0062 » pour R10 (durée des liens). Ce plan n'est pas implémenté (D28) et aucun fichier 0062 n'existait sur `origin/main` le 2026-10-01 : ce numéro est pris ici. Le jour où le plan s'implémente, sa référence à R10 prend le premier numéro libre.

## Contexte

**D28** (01/10, 02 h 10) : Will ne veut pas implémenter la suite d'appel. Il veut d'abord la tester à la main, client par client.

**D36** (01/10, 05 h 20) est l'exception, et la seule : « je veux que le questionnaire soit un bouton dans l'e-mail qui ouvre un outil, et lorsqu'il le valide on reçoit toutes les informations, qui alimentent la fiche du client, dans le projet (un client peut avoir plusieurs projets) ». D39 précise : les questions deviennent un bouton dans l'e-mail, et non plus du texte.

L'existant suffit à porter D36 sans migration :

- `QuestionnaireCadrage` existe déjà : un par projet, versionné, avec `mode` qui vaut `a_copier` ou `en_ligne`. La valeur `en_ligne` était prévue mais n'était pas utilisée.
- Ses questions (`QuestionnaireQuestion`) portent la réponse, chiffrée par `chiffrerParole`.
- La console sait déjà afficher les réponses et lancer la lecture IA (`lire_reponses`).

Le plan (R2, R17/R72, R26, R62, R78) décrivait une architecture bien plus large : `AccesProjetClient` avec empreinte stockée, `QuestionnaireSoumission`, parties, compléments et suivi d'ouverture. Rien de tout cela n'existe, et D28 interdit de le construire maintenant. Cet ADR fixe ce que la version réduite fait, et en quoi elle s'écarte du plan.

## Décision

### 1. Le lien : HMAC dérivé d'`AUTH_SECRET`, rien de stocké

```
https://axion-ia.com/questionnaire/<questionnaireId>/<jeton>
jeton = base64url(HMAC-SHA256(K, "questionnaire-cadrage:v1:" + questionnaireId))   // 43 caractères
K     = SHA-256("axion-questionnaire-cadrage|" + AUTH_SECRET)
```

- **Il y a un lien par questionnaire**, c'est-à-dire par projet et par version. Le jeton ne donne accès qu'à ce questionnaire.
- **Aucun stockage.** Le serveur recalcule le jeton et le compare à temps constant. Il vérifie la forme (UUID et 43 caractères base64url), puis le jeton, **avant toute lecture de la base** : un lien forgé ne coûte aucune requête.
- **Séparation de domaine** : la clé est propre au questionnaire. C'est la doctrine de `server/email/opposition-jeton.ts` et de `dossier-client/message-de-retour.ts`. `AUTH_SECRET` est déjà exigé en production par `env.ts`. Il n'y a aucune variable Coolify à créer.
- **En production sans `AUTH_SECRET`**, aucun lien n'est fabriqué et aucun n'est valide. Hors production, une clé de développement fixe est utilisée.
- **Il n'y a pas d'expiration dans le temps** (c'est l'esprit de R10). Le lien s'éteint par l'état du questionnaire, jamais par une date (voir §3).
- **Rotation, conséquence assumée** : faire tourner `AUTH_SECRET` éteint tous les liens ouverts. Will renvoie alors le lien depuis la console. Cette rotation est rare et déconnecte déjà toutes les sessions admin. Le préfixe `v1:` permet une version 2 du calcul sans changer la forme de l'URL.
- **Le jeton est dans le chemin, il ne doit donc fuir nulle part** :
  - `Referrer-Policy: same-origin` est posé à deux endroits, l'en-tête et `<meta>` : l'adresse (donc le jeton) n'est transmise à aucun autre site. **Pas `no-referrer`** : avec cette valeur, le navigateur envoie `Origin: null` sur le POST du formulaire, et Next refuse l'action serveur (« Invalid Server Actions request », mesuré le 2026-10-01) — aucun envoi ne passait, avec ou sans JavaScript ;
  - la page ne charge aucun script tiers ;
  - le segment est masqué `[TOKEN]` dans les envois à Sentry (`SEGMENTS_SECRETS`). Les filtres génériques ne l'attrapent pas : il n'est pas hexadécimal et ne contient pas de point ;
  - sur les routes `/questionnaire/` (et `/document/`), Sentry ne reçoit **rien de la requête** : corps (jeton, réponses, nom), cookies, chaîne de requête et en-têtes `Next-Router-State-Tree`, `Next-Action`, `Referer` sont supprimés par `piiScrubBeforeSend` et `piiScrubBeforeSendTransaction`, et le SDK ne lit pas le corps (`httpIntegration({ ignoreIncomingRequestBody })`). Veto de la relecture sécurité de la PR 1258.

### 2. La route : une page racine hors `[locale]`

- Le fichier est `src/app/questionnaire/[id]/[jeton]/page.tsx`, avec son propre `layout.tsx` (sans en-tête, pied de page, chatbot ni mesure d'audience), sur le modèle de `src/app/maintenance/`.
- Le motif `questionnaire/` est **exclu du `matcher` de `src/proxy.ts`**. Sans cette exclusion, la règle 0bis redirige en 301 vers `/fr/questionnaire/…`, qui renvoie 404. Une garde extrait le vrai motif du matcher et vérifie aussi la contre-épreuve.
- Puisque le proxy ne voit plus la route, ses en-têtes sont posés par `next.config.ts` :
  - une CSP propre : `default-src 'self'`, aucun hôte tiers, `form-action 'self'`, `frame-ancestors 'none'` ;
  - `Referrer-Policy: same-origin` (voir §1) ;
  - `X-Robots-Tag: noindex, nofollow, noarchive`.
- La page est `force-dynamic`. Next pose donc `no-store`, et la page n'est jamais rendue au build (contrat `stub.invalid` de `AGENTS.md`). De plus, la lecture refuse elle-même la base factice.
- **Écart accepté** : faute de proxy, il n'y a pas de nonce. La CSP de la route garde donc `'unsafe-inline'` pour les scripts en ligne de Next. Ce choix est acceptable parce que la page n'a ni script tiers ni HTML injecté : aucun `dangerouslySetInnerHTML`, et les textes passent par React.
- Les en-têtes se vérifient **sur la réponse servie**, pas sur la configuration. Une règle `/:path*` pose déjà un `Referrer-Policy`. La vérification attend :
  - une seule CSP ;
  - un seul `Referrer-Policy`, qui vaut `same-origin` ;
  - `no-store` ;
  - `noindex` ;
  - `X-Frame-Options: DENY` ;
  - un statut 404 pour un jeton faux.
- **Le GET n'a aucun effet de bord.** Les analyseurs de liens (Outlook, Teams, Gmail) ouvrent la page : un GET lit et n'écrit rien. Aucun comptage d'ouverture n'est fait.

### 3. Ce que la page montre

Un même écran neutre, en 404 (« Ce lien ne fonctionne pas ou plus »), couvre tous les cas suivants, sans dire lequel :

- jeton invalide ;
- questionnaire inconnu, `clos`, ou pas `en_ligne` (un questionnaire « à copier » n'est exposé qu'après le geste « Lien du questionnaire en ligne » de Will) ;
- **version dépassée** : une version plus récente existe pour le projet (la console ne montre que la dernière) ;
- **dossier vidé par l'effacement RGPD** : une question au `texte` vide. `viderDossier` vide les textes sans changer le statut, et la page n'en réécrit jamais rien.

Une fois les réponses reçues, la page affiche « Vos réponses ont déjà été envoyées ». Elle n'affiche que les questions du client : ni celles posées de vive voix, ni la ligne « Qui répond ? ».

### 4. L'envoi : définitif et unique

- Le client passe par un brouillon gardé **dans son navigateur** (`localStorage`). Rien n'est envoyé au serveur avant le clic, et rien n'est « reçu » avant. Il relit ses réponses, puis l'envoi est **définitif** : « Une fois envoyées, vos réponses ne pourront plus être modifiées ». Les questions sans réponse ne bloquent pas. Un envoi entièrement vide est refusé sans rien écrire. Le brouillon local n'est effacé qu'à l'écran « Merci ».
- **Unicité** : le premier ordre de la transaction est `updateMany({ where: { id, mode: "en_ligne", statut: { in: ["brouillon","copie"] } }, data: { statut: "reponse_recue", reponseRecueLe } })`. Seul le premier envoi trouve la ligne. Le second (double clic, deux onglets) n'écrit rien et voit « déjà envoyé ».
- **Les questions sont relues sous ce verrou.** Les réponses ne s'écrivent que sur les questions de **ce** questionnaire : `where: { id, questionnaireId }` empêche toute lecture ou écriture dans le questionnaire d'un autre projet ou d'un autre client. Si le nombre de lignes écrites diffère du nombre de réponses retenues, la transaction est annulée : les questions ont changé entre-temps, et la page se recharge avec les nouvelles questions.
- **Sens symétrique, côté console** : « Écrire mes questions » ne remplace une version qu'après un `updateMany` conditionnel sur la même ligne (verrou et vérification d'état). Une réponse qui vient d'arriver n'est donc jamais effacée.
- **Remplacer ou créer une version.** Le remplacement en place n'est permis que pour un `brouillon` écrit par Will (`modele = "questions_ecrites_par_williams"`) ou un brouillon vide, sans réponse ni fait. Tout ce qui est déjà parti chez le client (`copie`) n'est jamais réécrit : c'est l'esprit de R17. Dans ce cas, une nouvelle version est créée. Si la précédente était un lien en ligne sans réponse, elle passe `clos` dans la même transaction, et Will envoie le nouveau lien.
- **Écriture** : chaque réponse est chiffrée par `chiffrerParole` et bornée à 5 000 caractères. Le serveur retire les caractères de contrôle et lit au plus 60 champs, avant même d'interroger la base.
- **Lecture IA** : `lire_reponses` n'est programmée que si le drapeau d'enregistrement le permet pour la rencontre d'ancrage, exactement comme pour une réponse collée par Will. La saisie du client, elle, n'attend pas le drapeau : ce n'est pas un traitement IA. Quand le drapeau est fermé, il n'existe pas aujourd'hui d'autre geste pour lancer la lecture plus tard que de recoller les réponses (accepté en pilote).
- **E-mail interne** : `questionnaire-reponses-recues` part vers `contact@axion-ia.com`. Il donne le client, le projet et un lien vers la console. **Il ne contient aucune réponse** : ce sont des paroles chiffrées en base, et les recopier dans une boîte de réception les ferait sortir de ce chiffrement. Le modèle est classé parmi les envois automatiques (une alerte interne garée est une alerte perdue) et enfilé sans `clientId` (aucune règle propre au client ne le retient). Une panne de la file ne fait pas échouer un envoi déjà écrit : elle est signalée à Sentry.

### 5. « Qui répond ? » : ligne d'ordre 0, solution provisoire

- La valeur est rangée **sans migration** dans une ligne `questionnaire_questions` d'**ordre 0**. Cette ligne a pour texte « Qui répond ? (nom et fonction) », `typeVise = autre` et `poseeDeViveVoix = true`, et sa réponse est chiffrée.
- Pourquoi cela tient :
  - `@@unique([questionnaireId, ordre])` garantit qu'elle est seule ;
  - P6 et « Écrire mes questions » numérotent à partir de 1 ;
  - elle est chiffrée, exportée et vidée comme les autres questions par l'effacement d'un client.
- Pourquoi pas en tête de la réponse 1 : `lire_reponses` cite les réponses mot pour mot. Un nom glissé dans la réponse 1 deviendrait un fait.
- **Le prix à payer** : chaque lecteur doit l'écarter. Le filtre est unique, `QUESTIONS_REELLES = { ordre: { gt: 0 } }` (`constantes.ts`). Il s'applique :
  - à la page publique ;
  - à la vue de la console ;
  - à `pourLecture` (l'IA ne lit jamais un nom) ;
  - à `ouvrirLienEnLigne` ;
  - à `enregistrerReponses` et à `marquerPoseeDeViveVoix`, qui refusent l'ordre 0.
- **Les bornes viennent de R26** : 80 caractères au plus, sans adresse web, e-mail ni numéro de téléphone. C'est un nom et une fonction, pas un canal de contact.
- **Limite RGPD connue** : c'est un texte libre, rattaché à aucun contact. L'effacement d'une **personne** (`effacerCeQuiSuitLesPersonnes`, qui suit `contactDestinataireId`) ne l'atteint pas. L'effacement du **client** l'atteint. Cette limite est à porter au registre (art. 30).
- **Contraction prévue** : quand R26/R62 s'implémentent, la valeur migre vers une colonne `quiRepond` de la future soumission, en migration additive, et la ligne d'ordre 0 disparaît.

### 6. `typeVise = autre` pour les questions écrites par Will

Les questions de « Écrire mes questions » (une par ligne, sans IA) prennent `typeVise = autre`, `cleVisee = null` et `faitSourceId = null`. C'est la valeur que P6 donne déjà à ses `questions_ouvertes` (`p6-questionnaire.ts`). La colonne est un enum NOT NULL, et tout autre type classerait d'office chaque réponse (en « besoin », en « objectif »…). `lire_reponses` produit donc des faits `autre` / `global`, que Will valide, écarte ou reclasse. Aucun index unique sur `faits(type, cle)` ne s'y oppose.

La garde P6 « ni lien ni prix » ne s'applique pas à ces questions, et c'est voulu : c'est le texte de Will.

### 7. Limiteur de débit : `surPanne: "laisser-passer"`, écrit explicitement

L'envoi est limité à 8 par quart d'heure et par IP **hachée** (`hashIp`). L'IP n'est jamais stockée en clair, ni dans Redis ni dans les rapports.

**En cas de panne de Redis, l'envoi passe.** C'est un écart assumé à R78, qui demande l'inverse (« panne = refus »), pour quatre raisons :

- l'écriture est gardée par le jeton et unique : un second envoi ne réécrit rien ;
- un jeton forgé ne coûte aucune requête ;
- le limiteur n'a donc rien d'essentiel à protéger ici ;
- un refus pendant une panne ferait perdre sa saisie au client sans JavaScript, qui n'a pas de brouillon local.

La conduite est écrite dans le code (`surPanne`), pas laissée au défaut. Une panne est toujours signalée à Sentry par `checkRateLimit`.

## Écarts au plan (consignés ici, pas dans une PR)

| Règle du plan | Ce que le plan prévoit                                                                                                                                                                                                                                                                                                 | Ce que fait D36                                                                                                                                                                                                                                                                                                    | Pourquoi                                                                                                                                                                                                                                                            |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R2**        | `AccesProjetClient` ; jeton `HMAC(SUITE_TOKEN_SECRET, accesId ‖ emissionNo)` dont **seule l'empreinte est stockée** ; `versionCle` pour survivre à une rotation ; révocation et « Changer le lien »                                                                                                                    | Jeton recalculé depuis `questionnaireId` et `AUTH_SECRET` dérivé ; **rien de stocké** ; on ne révoque pas, on **clôt** le questionnaire ; une rotation éteint les liens                                                                                                                                            | Aucune table ni secret nouveaux (D28). La portée est un seul questionnaire : la révocation fine et la survie à la rotation n'ont pas d'objet tant qu'il n'y a ni page projet ni parties.                                                                            |
| **R17 / R72** | `QuestionnaireSoumission` figée en ajout seul (preuve Qualiopi) ; brouillon sauvegardé **côté serveur** et repris sur un autre appareil ; compléments « Ajouter une précision » ; réouverture par Will avec révisions ; suivi « ouverte / commencée / envoyée » ; saisie arrivée après le verrou proposée en précision | Envoi définitif et unique par le **statut** du questionnaire (`reponse_recue`) ; réponses écrites dans les questions ; brouillon **local** au navigateur ; ni complément, ni réouverture en ligne, ni suivi d'ouverture. Une saisie arrivée après l'envoi voit « déjà envoyé » (le client peut écrire à contact@). | Le principe de Will (« envoi définitif ») est tenu par le verrou conditionnel. Le reste demande des tables nouvelles. Si Will doit reposer des questions, il crée une nouvelle version. Rien n'est réécrit : on ajoute une version, on ne modifie pas l'envoi reçu. |
| **R26**       | `quiRepond` sur la partie, avec historique et pré-rempli pour le collègue ; transmission d'une partie à un collègue                                                                                                                                                                                                    | « Qui répond ? » en ligne d'ordre 0 (§5), une valeur par envoi, mêmes bornes (80 caractères, ni lien, ni e-mail, ni téléphone) ; pas de transmission par parties : le client transfère le lien lui-même                                                                                                            | Il n'y a pas de parties. Le lien est au porteur, comme le prévoit R10.                                                                                                                                                                                              |
| **R78**       | `LIMITES_ESPACE_PROJET` ; **panne du limiteur = refus**                                                                                                                                                                                                                                                                | Une seule limite (envois par IP hachée) ; **panne = passage** (§7) ; bornes de taille côté serveur conservées                                                                                                                                                                                                      | Voir §7. Les autres limites de R78 portent sur des gestes qui n'existent pas ici.                                                                                                                                                                                   |

## Hors périmètre (D28 reste la règle)

Rien d'autre de la suite d'appel n'est construit par cette décision :

- pas de page projet aux couleurs du client ;
- pas de parties, de transmission à un collègue ni de « Changer le lien » ;
- pas de compléments, de dépôt de fichiers, de réouverture par Will en ligne, ni de suivi d'ouverture ou d'avancement ;
- pas de devis ni de signature dans la page, pas de visuels ;
- pas d'envoi d'e-mail **au client** par le site : Will met le lien sous un bouton de son propre e-mail ;
- pas de relance, pas de questionnaire multi-répondants (un lien, un envoi).

Tout cela reste décrit par le plan (révision 7.2) et attend le retour des essais manuels de Will. Le jour où le plan s'implémente :

1. `QuestionnaireSoumission` reprend l'envoi définitif ;
2. `AccesProjetClient` remplace le jeton recalculé (un ADR remplaçant celui-ci décidera du sort des liens déjà envoyés) ;
3. la ligne d'ordre 0 migre vers `quiRepond`.

## Conséquences

**Positives**

- D36 est livrée sans migration ni secret nouveau, sur le modèle et la vue de la console existants. Les réponses arrivent chiffrées sous chaque question du **projet**, et la lecture IA existante les reprend sans changement.
- Un lien forgé ne coûte rien. Un lien valide n'ouvre qu'un questionnaire et ne s'écrit qu'une fois. Une version dépassée, close ou effacée ne se rouvre jamais.

**Négatives, assumées**

- Une rotation d'`AUTH_SECRET` éteint les liens ouverts.
- Le brouillon ne suit pas le client d'un appareil à l'autre.
- Une ligne d'ordre 0 que chaque lecteur doit écarter (la garde et le filtre unique la tiennent).
- La CSP de la route garde `'unsafe-inline'` pour les scripts.
- Le limiteur passe quand Redis est en panne.
- L'effacement d'une personne n'atteint pas le texte libre « Qui répond ? ».
